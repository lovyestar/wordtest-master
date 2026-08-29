import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useWordSetEntries } from '../../../hooks/useWordSetEntries'
import { useWordSets } from '../../../hooks/useWordSets'
import { db } from '../../../lib/firebase'

export default function WordSetEditor() {
  const { setId } = useParams()
  const { wordSets } = useWordSets()
  const { entries, loading } = useWordSetEntries(setId)
  const set = wordSets.find((s) => s.id === setId)

  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [savingName, setSavingName] = useState(false)

  useEffect(() => {
    if (set && !editingName) setNameDraft(set.name)
  }, [set, editingName])

  const [word, setWord] = useState('')
  const [meaning, setMeaning] = useState('')
  const [adding, setAdding] = useState(false)

  const [bulkText, setBulkText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)

  if (!setId) return null

  async function handleAddEntry() {
    if (!word.trim() || !meaning.trim()) return
    setAdding(true)
    try {
      await addDoc(collection(db, 'wordSets', setId!, 'entries'), {
        word: word.trim(),
        meaning: meaning.trim(),
        order: entries.length,
      })
      await updateDoc(doc(db, 'wordSets', setId!), { wordCount: increment(1) })
      setWord('')
      setMeaning('')
    } finally {
      setAdding(false)
    }
  }

  async function handleDeleteEntry(entryId: string) {
    await deleteDoc(doc(db, 'wordSets', setId!, 'entries', entryId))
    await updateDoc(doc(db, 'wordSets', setId!), { wordCount: increment(-1) })
  }

  async function toggleActive() {
    if (!set) return
    await updateDoc(doc(db, 'wordSets', setId!), { active: !set.active })
  }

  async function handleSaveName() {
    const trimmed = nameDraft.trim()
    if (!trimmed || trimmed === set?.name) {
      setEditingName(false)
      return
    }
    setSavingName(true)
    try {
      await updateDoc(doc(db, 'wordSets', setId!), { name: trimmed })
      setEditingName(false)
    } finally {
      setSavingName(false)
    }
  }

  async function handleBulkImport() {
    const lines = bulkText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length === 0) return

    setImporting(true)
    setImportMsg(null)
    try {
      let order = entries.length
      let count = 0
      let batch = writeBatch(db)
      for (const line of lines) {
        const sepMatch = line.match(/\t|,/)
        if (!sepMatch || sepMatch.index == null) continue
        const w = line.slice(0, sepMatch.index).trim()
        const m = line.slice(sepMatch.index + 1).trim()
        if (!w || !m) continue
        const ref = doc(collection(db, 'wordSets', setId!, 'entries'))
        batch.set(ref, { word: w, meaning: m, order })
        order += 1
        count += 1
        if (count % 400 === 0) {
          await batch.commit()
          batch = writeBatch(db)
        }
      }
      await batch.commit()
      if (count > 0) {
        await updateDoc(doc(db, 'wordSets', setId!), { wordCount: increment(count) })
      }
      setImportMsg(`${count}개 단어를 추가했습니다.`)
      setBulkText('')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div>
      <Link to="/teacher/word-sets" className="text-sm text-slate-400 hover:text-slate-700">
        ← 단어장 목록
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <div>
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-2xl font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSaveName}
                disabled={savingName}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                저장
              </button>
              <button
                type="button"
                onClick={() => setEditingName(false)}
                className="text-sm text-slate-400 hover:text-slate-600"
              >
                취소
              </button>
            </div>
          ) : (
            <h1 className="text-2xl font-bold text-slate-900">
              {set?.name ?? '단어장'}{' '}
              <button
                type="button"
                onClick={() => setEditingName(true)}
                className="align-middle text-xs font-normal text-slate-400 hover:text-indigo-600"
              >
                수정
              </button>
            </h1>
          )}
          <p className="mt-1 text-sm text-slate-500">
            {entries.length}개 단어
            {set?.createdByName && ` · 만든 사람: ${set.createdByName}`}
          </p>
        </div>
        {set && (
          <button
            type="button"
            onClick={toggleActive}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              set.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {set.active ? '사용 중 (학생에게 노출)' : '숨김 (학생에게 노출 안 됨)'}
          </button>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">단어 추가</h2>
        <div className="mt-2 flex gap-2">
          <input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="영단어"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <input
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            placeholder="뜻"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleAddEntry}
            disabled={adding || !word.trim() || !meaning.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            추가
          </button>
        </div>

        <h2 className="mt-6 text-sm font-semibold text-slate-700">여러 개 한 번에 가져오기</h2>
        <p className="mt-1 text-xs text-slate-400">한 줄에 하나씩, "단어,뜻" 또는 "단어[탭]뜻" 형식으로 붙여넣으세요.</p>
        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          rows={5}
          placeholder={'abandon,포기하다, 버리다\nabsolute,절대적인'}
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleBulkImport}
          disabled={importing || !bulkText.trim()}
          className="mt-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600"
        >
          {importing ? '가져오는 중...' : '가져오기'}
        </button>
        {importMsg && <p className="mt-2 text-xs text-emerald-600">{importMsg}</p>}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-2">단어</th>
              <th className="px-4 py-2">뜻</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-400" colSpan={3}>
                  불러오는 중...
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-2 font-medium text-slate-800">{entry.word}</td>
                  <td className="px-4 py-2 text-slate-600">{entry.meaning}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => handleDeleteEntry(entry.id)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
