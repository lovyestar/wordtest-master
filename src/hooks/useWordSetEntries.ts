import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../lib/firebase'
import type { WordEntry } from '../types'

export function useWordSetEntries(wordSetId: string | null | undefined) {
  const [entries, setEntries] = useState<WordEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!wordSetId) {
      setEntries([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(collection(db, 'wordSets', wordSetId, 'entries'), orderBy('order', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      setEntries(
        snap.docs.map(
          (d) => ({ id: d.id, word: d.data().word, meaning: d.data().meaning, order: d.data().order }) as WordEntry,
        ),
      )
      setLoading(false)
    })
    return unsub
  }, [wordSetId])

  return { entries, loading }
}
