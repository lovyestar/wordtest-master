import { Link } from 'react-router-dom'
import { useExamSessions } from '../../hooks/useExamSessions'
import { useWordSets } from '../../hooks/useWordSets'

export default function TeacherDashboard() {
  const { wordSets } = useWordSets()
  const { sessions } = useExamSessions()
  const openSessions = sessions.filter((s) => s.status === 'open')

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">대시보드</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link
          to="/teacher/word-sets"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-indigo-300"
        >
          <p className="text-sm text-slate-500">단어장</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{wordSets.length}개</p>
        </Link>
        <Link
          to="/teacher/exams"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-indigo-300"
        >
          <p className="text-sm text-slate-500">진행 중인 시험</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{openSessions.length}개</p>
        </Link>
      </div>

      {openSessions.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-slate-700">지금 진행 중</h2>
          <ul className="mt-2 space-y-2">
            {openSessions.map((s) => (
              <li key={s.id}>
                <Link
                  to={`/teacher/exams/${s.id}`}
                  className="block rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 hover:border-emerald-400"
                >
                  {s.name} 모니터링 →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
