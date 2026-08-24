import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore, type Timestamp } from 'firebase-admin/firestore'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2'
import { getKstDateKey, isCorrectAnswer, type ExamDirection } from './grading.js'

initializeApp()
const db = getFirestore()

// Seoul region: keeps latency low for the school's users and matches the
// Firestore location chosen when the Firebase project is created.
setGlobalOptions({ region: 'asia-northeast3' })

const MAX_ANSWERS = 500

interface RawAnswer {
  entryId: string
  answer: string
}

interface GradedAnswer extends RawAnswer {
  word: string
  meaning: string
  correct: boolean
}

function gradeAgainstEntries(
  answers: RawAnswer[],
  entryMap: Map<string, { word: string; meaning: string }>,
  directionFor: (entryId: string) => ExamDirection,
): { graded: GradedAnswer[]; correctCount: number } {
  let correctCount = 0
  const graded = answers.map(({ entryId, answer }) => {
    const entry = entryMap.get(entryId)
    if (!entry) {
      return { entryId, word: '', meaning: '', answer: answer ?? '', correct: false }
    }
    const correct = isCorrectAnswer(directionFor(entryId), answer ?? '', entry.word, entry.meaning)
    if (correct) correctCount += 1
    return { entryId, word: entry.word, meaning: entry.meaning, answer: answer ?? '', correct }
  })
  return { graded, correctCount }
}

// ---- Mock exam: student submits raw answers, server grades against the
// real word set so results can't be fabricated client-side. ----

interface SubmitMockExamPayload {
  wordSetId: string
  mode: ExamDirection
  answers: RawAnswer[]
}

export const submitMockExamAttempt = onCall<SubmitMockExamPayload>(async (request) => {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.')

  const { wordSetId, mode, answers } = request.data ?? {}
  if (
    !wordSetId ||
    (mode !== 'en2ko' && mode !== 'ko2en') ||
    !Array.isArray(answers) ||
    answers.length === 0
  ) {
    throw new HttpsError('invalid-argument', '잘못된 요청입니다.')
  }
  if (answers.length > MAX_ANSWERS) {
    throw new HttpsError('invalid-argument', '문항 수가 너무 많습니다.')
  }

  const entryIds = [...new Set(answers.map((a) => a.entryId))]
  const entrySnaps = await db.getAll(
    ...entryIds.map((id) => db.doc(`wordSets/${wordSetId}/entries/${id}`)),
  )
  const entryMap = new Map<string, { word: string; meaning: string }>()
  for (const snap of entrySnaps) {
    if (snap.exists) {
      const data = snap.data() as { word: string; meaning: string }
      entryMap.set(snap.id, { word: data.word, meaning: data.meaning })
    }
  }

  const { graded, correctCount } = gradeAgainstEntries(answers, entryMap, () => mode)
  const totalQuestions = graded.length
  const wrongCount = totalQuestions - correctCount
  const accuracy = totalQuestions > 0 ? correctCount / totalQuestions : 0

  const attemptRef = db.collection('mockExamAttempts').doc()
  await attemptRef.set({
    uid,
    wordSetId,
    mode,
    totalQuestions,
    correctCount,
    wrongCount,
    accuracy,
    answers: graded,
    submittedAt: FieldValue.serverTimestamp(),
  })

  return { attemptId: attemptRef.id, totalQuestions, correctCount, wrongCount, accuracy, answers: graded }
})

// ---- Leaderboard aggregation: only the day's best accuracy per user is kept. ----

export const onMockExamAttemptCreate = onDocumentCreated(
  'mockExamAttempts/{attemptId}',
  async (event) => {
    const snap = event.data
    if (!snap) return
    const attempt = snap.data() as {
      uid: string
      wordSetId: string
      accuracy: number
      correctCount: number
      wrongCount: number
      totalQuestions: number
      submittedAt: Timestamp
    }
    if (!attempt.submittedAt) return

    const dateKey = getKstDateKey(attempt.submittedAt.toDate())
    const userSnap = await db.doc(`users/${attempt.uid}`).get()
    const user = userSnap.data() as { displayName?: string; photoURL?: string } | undefined

    const leaderboardCollection = db.collection(
      `leaderboards/${dateKey}/wordSets/${attempt.wordSetId}/entries`,
    )
    const leaderboardRef = leaderboardCollection.doc(attempt.uid)

    let wroteNewBest = false
    await db.runTransaction(async (tx) => {
      const existing = await tx.get(leaderboardRef)
      if (existing.exists && (existing.data()?.bestAccuracy ?? 0) >= attempt.accuracy) {
        return
      }
      wroteNewBest = true
      tx.set(leaderboardRef, {
        uid: attempt.uid,
        displayName: user?.displayName ?? '익명',
        photoURL: user?.photoURL ?? null,
        bestAccuracy: attempt.accuracy,
        correctCount: attempt.correctCount,
        wrongCount: attempt.wrongCount,
        totalQuestions: attempt.totalQuestions,
        updatedAt: FieldValue.serverTimestamp(),
      })
    })

    // Award a lifetime "#1 finishes" counter the first time this user's
    // entry becomes today's top score for this word set — not re-awarded
    // on every subsequent resubmission while they stay in the lead.
    if (wroteNewBest) {
      const topSnap = await leaderboardCollection.orderBy('bestAccuracy', 'desc').limit(1).get()
      const topDoc = topSnap.docs[0]
      if (topDoc && topDoc.id === attempt.uid && topDoc.data().firstPlaceCounted !== true) {
        await topDoc.ref.set({ firstPlaceCounted: true }, { merge: true })
        await db.doc(`users/${attempt.uid}`).set(
          { firstPlaceCount: FieldValue.increment(1) },
          { merge: true },
        )
      }
    }
  },
)

// ---- Proctored exam: attempt doc (with its fixed question snapshot) is
// created directly by the client via security rules; only grading is
// server-authoritative. ----

interface SubmitExamPayload {
  sessionId: string
  answers: RawAnswer[]
}

export const submitExamAttempt = onCall<SubmitExamPayload>(async (request) => {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.')

  const { sessionId, answers } = request.data ?? {}
  if (!sessionId || !Array.isArray(answers)) {
    throw new HttpsError('invalid-argument', '잘못된 요청입니다.')
  }

  const attemptRef = db.doc(`examSessions/${sessionId}/attempts/${uid}`)
  const attemptSnap = await attemptRef.get()
  if (!attemptSnap.exists) {
    throw new HttpsError('failed-precondition', '응시 기록을 찾을 수 없습니다.')
  }
  const attempt = attemptSnap.data() as {
    status: string
    questions: { entryId: string; word: string; meaning: string; direction: ExamDirection }[]
  }
  if (attempt.status !== 'in_progress') {
    throw new HttpsError('failed-precondition', '이미 종료되었거나 실격된 응시입니다.')
  }

  const answerMap = new Map(answers.map((a) => [a.entryId, a.answer ?? '']))
  const entryMap = new Map(attempt.questions.map((q) => [q.entryId, { word: q.word, meaning: q.meaning }]))
  const directionMap = new Map(attempt.questions.map((q) => [q.entryId, q.direction]))

  const rawAnswers: RawAnswer[] = attempt.questions.map((q) => ({
    entryId: q.entryId,
    answer: answerMap.get(q.entryId) ?? '',
  }))
  const { graded, correctCount } = gradeAgainstEntries(
    rawAnswers,
    entryMap,
    (entryId) => directionMap.get(entryId) ?? 'en2ko',
  )
  const totalQuestions = graded.length
  const wrongCount = totalQuestions - correctCount
  const accuracy = totalQuestions > 0 ? correctCount / totalQuestions : 0

  await attemptRef.update({
    status: 'submitted',
    correctCount,
    wrongCount,
    accuracy,
    answers: graded,
    submittedAt: FieldValue.serverTimestamp(),
  })

  return { totalQuestions, correctCount, wrongCount, accuracy, answers: graded }
})
