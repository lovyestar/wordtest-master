import { Link } from 'react-router-dom'
import { useExamSessions } from '../../hooks/useExamSessions'

export default function WordTestList() {
  const { sessions, loading } = useExamSessions()
  const open = sessions.filter((s) => s.status === 'open')

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-bold text-slate-900">단어 테스트</h1>
      <p className="mt-1 text-sm text-slate-500">선생님이 시작한 감독 시험에 응시할 수 있습니다.</p>

      {loading ? (
        <p className="mt-6 text-center text-sm text-slate-400">불러오는 중...</p>
      ) : open.length === 0 ? (
        <p className="mt-10 text-center text-sm text-slate-400">현재 진행 중인 시험이 없습니다.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {open.map((s) => (
            <li key={s.id}>
              <Link
                to={`/word-test/${s.id}`}
                className="block rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 transition hover:border-emerald-400"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{s.name}</span>
                  <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-medium text-white">응시 가능</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  문항 {s.questionCount}개 · 제한시간 {Math.round(s.durationSeconds / 60)}분
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
