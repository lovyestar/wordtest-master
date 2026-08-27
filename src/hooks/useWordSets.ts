import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../lib/firebase'
import { toMillis } from '../lib/firestoreUtils'
import type { WordSet } from '../types'

export function useWordSets() {
  const [wordSets, setWordSets] = useState<WordSet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'wordSets'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setWordSets(
        snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            name: data.name,
            description: data.description,
            active: data.active !== false,
            wordCount: data.wordCount ?? 0,
            createdBy: data.createdBy,
            createdByName: data.createdByName,
            createdAt: toMillis(data.createdAt),
          } satisfies WordSet
        }),
      )
      setLoading(false)
    })
    return unsub
  }, [])

  return { wordSets, loading }
}
