import { useState } from 'react'
import { useLeaderboard } from '../hooks/useLeaderboard'
import { useWordSets } from '../hooks/useWordSets'
import { getKstDateKey } from '../lib/date'
import { useAuthStore } from '../store/authStore'

export default function RankingPage() {
  const dateKey = getKstDateKey()
  const { firebaseUser } = useAuthStore()
  const { wordSets, loading: wordSetsLoading } = useWordSets()
  const activeSets = wordSets.filter((s) => s.active)

  const [wordSetId, setWordSetId] = useState('')
  const selectedSetId = wordSetId || activeSets[0]?.id

  const { entries, loading } = useLeaderboard(dateKey, selectedSetId)
  const selectedSet = activeSets.find((s) => s.id === selectedSetId)

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-bold text-slate-900">오늘의 랭킹</h1>
      <p className="mt-1 text-sm text-slate-500">
        {dateKey}
        {selectedSet && ` · ${selectedSet.name}`} · 단어 모의 시험 최고 정답률 기준
      </p>

      {wordSetsLoading ? (
        <p className="mt-6 text-center text-sm text-slate-400">불러오는 중...</p>
      ) : activeSets.length === 0 ? (
        <p className="mt-6 text-center text-sm text-slate-400">등록된 단어장이 없습니다.</p>
      ) : (
        <>
          {activeSets.length > 1 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {activeSets.map((set) => (
                <button
                  key={set.id}
                  type="button"
                  onClick={() => setWordSetId(set.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    selectedSetId === set.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {set.name}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <p className="mt-6 text-center text-sm text-slate-400">불러오는 중...</p>
          ) : entries.length === 0 ? (
            <p className="mt-6 text-center text-sm text-slate-400">아직 오늘 응시한 기록이 없습니다.</p>
          ) : (
            <ol className="mt-6 space-y-2">
              {entries.map((entry, i) => {
                const isMe = entry.uid === firebaseUser?.uid
                return (
                  <li
                    key={entry.uid}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                      isMe ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <span
                      className={`w-7 shrink-0 text-center text-sm font-bold ${
                        i === 0
                          ? 'text-amber-500'
                          : i === 1
                            ? 'text-slate-400'
                            : i === 2
                              ? 'text-amber-700'
                              : 'text-slate-400'
                      }`}
                    >
                      {i + 1}
                    </span>
                    {entry.photoURL ? (
                      <img src={entry.photoURL} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-slate-200" />
                    )}
                    <span className="flex-1 truncate text-sm font-medium text-slate-800">
                      {entry.displayName}
                      {isMe && <span className="ml-1 text-xs text-indigo-500">(나)</span>}
                    </span>
                    <span className="text-sm font-bold text-indigo-600">{Math.round(entry.bestAccuracy * 100)}점</span>
                    <span className="text-xs text-slate-400">
                      {entry.correctCount}/{entry.totalQuestions}
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        </>
      )}
    </div>
  )
}
