import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../lib/firebase'
import { toMillis } from '../lib/firestoreUtils'
import type { LeaderboardEntry } from '../types'

export function useLeaderboard(dateKey: string, wordSetId: string | null | undefined) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!wordSetId) {
      setEntries([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(
      collection(db, 'leaderboards', dateKey, 'wordSets', wordSetId, 'entries'),
      orderBy('bestAccuracy', 'desc'),
      limit(100),
    )
    const unsub = onSnapshot(q, (snap) => {
      setEntries(
        snap.docs.map((d) => {
          const data = d.data()
          return {
            uid: data.uid,
            displayName: data.displayName,
            photoURL: data.photoURL ?? undefined,
            bestAccuracy: data.bestAccuracy,
            correctCount: data.correctCount,
            wrongCount: data.wrongCount,
            totalQuestions: data.totalQuestions,
            updatedAt: toMillis(data.updatedAt),
          } satisfies LeaderboardEntry
        }),
      )
      setLoading(false)
    })
    return unsub
  }, [dateKey, wordSetId])

  return { entries, loading }
}
