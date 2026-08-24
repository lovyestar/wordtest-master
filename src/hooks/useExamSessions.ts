import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../lib/firebase'
import { toMillis } from '../lib/firestoreUtils'
import type { ExamSession } from '../types'

function mapSession(id: string, data: Record<string, unknown>): ExamSession {
  return {
    id,
    name: data.name as string,
    wordSetId: data.wordSetId as string,
    createdBy: data.createdBy as string,
    createdAt: toMillis(data.createdAt),
    durationSeconds: data.durationSeconds as number,
    questionCount: data.questionCount as number,
    mode: data.mode as ExamSession['mode'],
    status: data.status as ExamSession['status'],
    openedAt: data.openedAt ? toMillis(data.openedAt) : undefined,
    closedAt: data.closedAt ? toMillis(data.closedAt) : undefined,
  }
}

export function useExamSessions() {
  const [sessions, setSessions] = useState<ExamSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'examSessions'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setSessions(snap.docs.map((d) => mapSession(d.id, d.data())))
      setLoading(false)
    })
    return unsub
  }, [])

  return { sessions, loading }
}
