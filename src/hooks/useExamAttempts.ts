import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../lib/firebase'
import { toMillis } from '../lib/firestoreUtils'
import type { ExamAttempt } from '../types'

export function useExamAttempts(sessionId: string | undefined) {
  const [attempts, setAttempts] = useState<ExamAttempt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sessionId) return
    const q = query(collection(db, 'examSessions', sessionId, 'attempts'), orderBy('startedAt', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      setAttempts(
        snap.docs.map((d) => {
          const data = d.data()
          return {
            uid: data.uid,
            studentName: data.studentName,
            wordSetId: data.wordSetId,
            questions: data.questions ?? [],
            status: data.status,
            activeSessionToken: data.activeSessionToken,
            startedAt: toMillis(data.startedAt),
            submittedAt: data.submittedAt ? toMillis(data.submittedAt) : undefined,
            correctCount: data.correctCount,
            wrongCount: data.wrongCount,
            accuracy: data.accuracy,
            disqualifiedAt: data.disqualifiedAt ? toMillis(data.disqualifiedAt) : undefined,
            disqualifiedReason: data.disqualifiedReason,
            answers: data.answers,
          } satisfies ExamAttempt
        }),
      )
      setLoading(false)
    })
    return unsub
  }, [sessionId])

  return { attempts, loading }
}
