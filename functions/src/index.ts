import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { logger, setGlobalOptions } from 'firebase-functions/v2'
import { getKstDateKey, isCorrectAnswer, type ExamDirection } from './grading.js'
import { ensurePronunciation, pronunciationPath } from './pronunciation.js'

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
  const submittedAt = new Date()
  await attemptRef.set({
    uid,
    wordSetId,
    mode,
    totalQuestions,
    correctCount,
    wrongCount,
    accuracy,
    answers: graded,
    submittedAt,
  })

  // Leaderboard aggregation runs inline (not via a separate Firestore
  // trigger) so a submission either fully lands — attempt + leaderboard
  // together — or fails loudly to the caller. A previous trigger-based
  // design silently lost updates whenever the trigger was mid-redeploy.
  await updateLeaderboard(uid, wordSetId, {
    accuracy,
    correctCount,
    wrongCount,
    totalQuestions,
    submittedAt,
  })

  return { attemptId: attemptRef.id, totalQuestions, correctCount, wrongCount, accuracy, answers: graded }
})

async function updateLeaderboard(
  uid: string,
  wordSetId: string,
  attempt: { accuracy: number; correctCount: number; wrongCount: number; totalQuestions: number; submittedAt: Date },
) {
  const dateKey = getKstDateKey(attempt.submittedAt)
  const userSnap = await db.doc(`users/${uid}`).get()
  const user = userSnap.data() as { displayName?: string; photoURL?: string } | undefined

  const leaderboardCollection = db.collection(`leaderboards/${dateKey}/wordSets/${wordSetId}/entries`)
  const leaderboardRef = leaderboardCollection.doc(uid)

  let wroteNewBest = false
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(leaderboardRef)
    if (existing.exists && (existing.data()?.bestAccuracy ?? 0) >= attempt.accuracy) {
      return
    }
    wroteNewBest = true
    tx.set(leaderboardRef, {
      uid,
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
    if (topDoc && topDoc.id === uid && topDoc.data().firstPlaceCounted !== true) {
      await topDoc.ref.set({ firstPlaceCounted: true }, { merge: true })
      await db.doc(`users/${uid}`).set({ firstPlaceCount: FieldValue.increment(1) }, { merge: true })
    }
  }
}

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

// ---- Teacher signup approval: a prospective teacher self-registers a
// Firebase Auth account and a `teacherApplications` doc client-side, but
// only this function (called by an existing admin) can grant the
// `admins/{uid}` doc that actually unlocks teacher access. ----

interface ReviewTeacherApplicationPayload {
  uid: string
  approve: boolean
}

export const reviewTeacherApplication = onCall<ReviewTeacherApplicationPayload>(async (request) => {
  const reviewerUid = request.auth?.uid
  if (!reviewerUid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.')

  const reviewerSnap = await db.doc(`admins/${reviewerUid}`).get()
  if (!reviewerSnap.exists || reviewerSnap.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', '최고 관리자만 승인/거절할 수 있습니다.')
  }

  const { uid, approve } = request.data ?? {}
  if (!uid || typeof approve !== 'boolean') {
    throw new HttpsError('invalid-argument', '잘못된 요청입니다.')
  }

  const applicationRef = db.doc(`teacherApplications/${uid}`)
  const applicationSnap = await applicationRef.get()
  if (!applicationSnap.exists) {
    throw new HttpsError('not-found', '신청 내역을 찾을 수 없습니다.')
  }
  const application = applicationSnap.data() as { email: string; name: string; status: string }
  if (application.status !== 'pending') {
    throw new HttpsError('failed-precondition', '이미 처리된 신청입니다.')
  }

  await applicationRef.update({
    status: approve ? 'approved' : 'rejected',
    reviewedAt: FieldValue.serverTimestamp(),
    reviewedBy: reviewerUid,
  })

  if (approve) {
    await db.doc(`admins/${uid}`).set({
      email: application.email,
      displayName: application.name,
      role: 'teacher',
      createdAt: FieldValue.serverTimestamp(),
      createdBy: reviewerUid,
    })
    // Only now — actually approved — does the student-facing profile pick
    // up the "{name} 선생님" nickname and skip the student-ID onboarding
    // gate. A pending or rejected applicant must never show as a teacher.
    await db.doc(`users/${uid}`).set(
      {
        name: application.name,
        displayName: `${application.name} 선생님`,
        isTeacher: true,
        email: application.email,
      },
      { merge: true },
    )
  }
  // Reject: leave the applicant's Auth account and `users/{uid}` profile
  // alone. Teachers sign in with the same Google account as students, so
  // deleting it would destroy any real student history tied to that uid.

  return { status: approve ? 'approved' : 'rejected' }
})

// ---- Admin removal: revokes an existing admin's access. Only callable by
// another admin, and an admin cannot remove themselves (avoids accidentally
// locking every admin out of the account). ----

export const removeAdmin = onCall<{ uid: string }>(async (request) => {
  const callerUid = request.auth?.uid
  if (!callerUid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.')

  const callerSnap = await db.doc(`admins/${callerUid}`).get()
  if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', '최고 관리자만 삭제할 수 있습니다.')
  }

  const { uid } = request.data ?? {}
  if (!uid) throw new HttpsError('invalid-argument', '잘못된 요청입니다.')
  if (uid === callerUid) {
    throw new HttpsError('failed-precondition', '본인 계정은 삭제할 수 없습니다.')
  }

  // Only revoke the admin grant — the Auth account and `users/{uid}`
  // profile stay intact since teachers sign in with the same Google
  // account as students (deleting it would destroy real student history).
  await db.doc(`admins/${uid}`).delete()
  return { removed: true }
})

// ---- Word pronunciation: synthesized once with Google Cloud TTS, stored in
// Storage, and linked from the entry's `audioPath` so every device plays the
// same audio (browser speech synthesis varies wildly between devices). ----

async function syncEntryPronunciation(
  ref: FirebaseFirestore.DocumentReference,
  word: unknown,
  currentPath: unknown,
): Promise<'generated' | 'skipped'> {
  const expected = typeof word === 'string' ? pronunciationPath(word) : null
  if (currentPath === (expected ?? undefined)) return 'skipped'
  const path = expected ? await ensurePronunciation(word as string) : null
  // Writing audioPath re-fires the trigger, but the second run sees a
  // matching path and stops. If the word changed mid-generation, the later
  // run sees a mismatch again and corrects it.
  await ref.update({ audioPath: path ?? FieldValue.delete() })
  return 'generated'
}

export const onWordEntryWritten = onDocumentWritten(
  // Caps parallel TTS calls during a bulk import at 10 × 5 = 50 (the default
  // would be 80 per instance); the retry in synthesize() absorbs quota bursts.
  { document: 'wordSets/{setId}/entries/{entryId}', maxInstances: 10, concurrency: 5 },
  async (event) => {
    const after = event.data?.after
    if (!after?.exists) return
    try {
      await syncEntryPronunciation(after.ref, after.get('word'), after.get('audioPath'))
    } catch (err) {
      // Entry deleted mid-generation: nothing left to link.
      if ((err as { code?: number }).code === 5) return
      logger.error('pronunciation generation failed', { path: after.ref.path, err })
    }
  },
)

// Backfill for words added before this feature existed, and a manual retry
// for any word whose trigger run failed.
export const generateMissingPronunciations = onCall<{ wordSetId: string }>(
  { timeoutSeconds: 540 },
  async (request) => {
    const uid = request.auth?.uid
    if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.')
    const adminSnap = await db.doc(`admins/${uid}`).get()
    if (!adminSnap.exists) throw new HttpsError('permission-denied', '선생님만 실행할 수 있습니다.')

    const { wordSetId } = request.data ?? {}
    if (!wordSetId) throw new HttpsError('invalid-argument', '잘못된 요청입니다.')

    const snap = await db.collection(`wordSets/${wordSetId}/entries`).get()
    const pending = snap.docs.filter((d) => {
      const expected = pronunciationPath(String(d.get('word') ?? ''))
      return d.get('audioPath') !== (expected ?? undefined)
    })

    let generated = 0
    let failed = 0
    const queue = [...pending]
    const workers = Array.from({ length: 5 }, async () => {
      for (let d = queue.shift(); d; d = queue.shift()) {
        try {
          await syncEntryPronunciation(d.ref, d.get('word'), d.get('audioPath'))
          generated += 1
        } catch (err) {
          failed += 1
          logger.error('pronunciation backfill failed', { path: d.ref.path, err })
        }
      }
    })
    await Promise.all(workers)

    return { total: snap.size, generated, failed }
  },
)
