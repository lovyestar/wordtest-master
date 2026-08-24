import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useWordSetEntries } from '../../hooks/useWordSetEntries'
import { useWordSets } from '../../hooks/useWordSets'

export default function WordSetBrowseDetail() {
  const { setId } = useParams()
  const { wordSets } = useWordSets()
  const { entries, loading } = useWordSetEntries(setId)
  const set = wordSets.find((s) => s.id === setId)
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? entries.filter(
        (e) =>
          e.word.toLowerCase().includes(search.trim().toLowerCase()) || e.meaning.includes(search.trim()),
      )
    : entries

  return (
    <div className="mx-auto max-w-lg">
      <Link to="/word-sets" className="text-sm text-slate-400 hover:text-slate-700">
        ← 단어장 목록
      </Link>
      <h1 className="mt-2 text-xl font-bold text-slate-900">{set?.name ?? '단어장'}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {entries.length}개 단어
        {set?.createdByName && ` · 만든 사람: ${set.createdByName}`}
      </p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="단어 또는 뜻 검색"
        className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
      />

      <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">불러오는 중...</p>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">검색 결과가 없습니다.</p>
        ) : (
          filtered.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-medium text-slate-800">{entry.word}</span>
              <span className="text-slate-500">{entry.meaning}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
