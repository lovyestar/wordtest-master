import { Link } from 'react-router-dom'
import { useWordSets } from '../../hooks/useWordSets'

export default function WordStudyList() {
  const { wordSets, loading } = useWordSets()
  const activeSets = wordSets.filter((s) => s.active)

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-bold text-slate-900">단어 외우기</h1>
      <p className="mt-1 text-sm text-slate-500">
        단어를 하나씩 넘기며 단어를 외워봐요.
      </p>

      {loading ? (
        <p className="mt-6 text-center text-sm text-slate-400">불러오는 중...</p>
      ) : activeSets.length === 0 ? (
        <p className="mt-6 text-center text-sm text-slate-400">등록된 단어장이 없습니다.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {activeSets.map((set) => (
            <li key={set.id}>
              <Link
                to={`/word-study/${set.id}`}
                className="block rounded-xl border border-slate-200 bg-white px-5 py-4 transition hover:border-indigo-300"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{set.name}</span>
                  <span className="text-xs text-slate-400">{set.wordCount}단어</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {set.description}
                  {set.description && set.createdByName && ' · '}
                  {set.createdByName && `만든 사람: ${set.createdByName}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
