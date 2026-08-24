import { collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useExamSessions } from '../../../hooks/useExamSessions'
import { db } from '../../../lib/firebase'

const STATUS_LABEL: Record<string, string> = {
  draft: '준비중',
  open: '진행중',
  closed: '종료',
}
const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-500',
  open: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-slate-100 text-slate-400',
}

export default function ExamList() {
  const { sessions, loading } = useExamSessions()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function closeSession(id: string) {
    await updateDoc(doc(db, 'examSessions', id), { status: 'closed', closedAt: serverTimestamp() })
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`"${name}" 시험을 삭제할까요? 응시 기록이 모두 삭제되며 되돌릴 수 없습니다.`)) return
    setDeletingId(id)
    try {
      const attemptsSnap = await getDocs(collection(db, 'examSessions', id, 'attempts'))
      const docs = attemptsSnap.docs
      for (let i = 0; i < docs.length; i += 400) {
        const batch = writeBatch(db)
        docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref))
        await batch.commit()
      }
      await deleteDoc(doc(db, 'examSessions', id))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">시험 관리</h1>
        <Link
          to="/teacher/exams/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          새 시험 시작
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">이름</th>
              <th className="px-4 py-3">문항/시간</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-400" colSpan={4}>
                  불러오는 중...
                </td>
              </tr>
            ) : sessions.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-400" colSpan={4}>
                  아직 생성된 시험이 없습니다.
                </td>
              </tr>
            ) : (
              sessions.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3">
                    <Link to={`/teacher/exams/${s.id}`} className="font-medium text-indigo-600 hover:underline">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {s.questionCount}문항 · {Math.round(s.durationSeconds / 60)}분
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[s.status]}`}>
                      {STATUS_LABEL[s.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s.status === 'open' && (
                      <button
                        type="button"
                        onClick={() => closeSession(s.id)}
                        className="mr-3 text-xs text-red-500 hover:text-red-700"
                      >
                        종료
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id, s.name)}
                      disabled={deletingId === s.id}
                      className="mr-3 text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                    >
                      {deletingId === s.id ? '삭제 중...' : '삭제'}
                    </button>
                    <Link to={`/teacher/exams/${s.id}`} className="text-xs text-slate-400 hover:text-slate-700">
                      모니터링 →
                    </Link>
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
