import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import { Fragment, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useExamAttempts } from '../../../hooks/useExamAttempts'
import { db } from '../../../lib/firebase'
import type { ExamSession } from '../../../types'

const STATUS_LABEL: Record<string, string> = {
  in_progress: '응시 중',
  submitted: '제출 완료',
  disqualified: '부정행위 실격',
  timed_out: '시간 초과',
}
const STATUS_STYLE: Record<string, string> = {
  in_progress: 'bg-amber-100 text-amber-700',
  submitted: 'bg-emerald-100 text-emerald-700',
  disqualified: 'bg-red-100 text-red-700',
  timed_out: 'bg-slate-100 text-slate-500',
}
const VIOLATION_LABEL: Record<string, string> = {
  visibility_hidden: '탭 전환 감지',
  blur: '창 포커스 이탈',
  fullscreen_exit: '전체화면 이탈',
  page_reload: '새로고침',
}

export default function ExamMonitor() {
  const { sessionId } = useParams()
  const [session, setSession] = useState<ExamSession | null>(null)
  const { attempts, loading } = useExamAttempts(sessionId)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!sessionId) return
    return onSnapshot(doc(db, 'examSessions', sessionId), (snap) => {
      if (!snap.exists()) return
      const data = snap.data()
      setSession({
        id: snap.id,
        name: data.name,
        wordSetId: data.wordSetId,
        createdBy: data.createdBy,
        createdAt: 0,
        durationSeconds: data.durationSeconds,
        questionCount: data.questionCount,
        mode: data.mode,
        status: data.status,
      })
    })
  }, [sessionId])

  async function closeSession() {
    if (!sessionId) return
    await updateDoc(doc(db, 'examSessions', sessionId), { status: 'closed', closedAt: serverTimestamp() })
  }

  function toggleExpanded(uid: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  if (!session) return <p className="text-sm text-slate-400">불러오는 중...</p>

  const submittedCount = attempts.filter((a) => a.status === 'submitted').length
  const disqualifiedCount = attempts.filter((a) => a.status === 'disqualified').length

  return (
    <div>
      <Link to="/teacher/exams" className="text-sm text-slate-400 hover:text-slate-700">
        ← 시험 목록
      </Link>

      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{session.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {session.questionCount}문항 · {Math.round(session.durationSeconds / 60)}분 · 응시 {attempts.length}명
            (제출 {submittedCount} · 실격 {disqualifiedCount})
          </p>
        </div>
        {session.status === 'open' ? (
          <button
            type="button"
            onClick={closeSession}
            className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            시험 종료
          </button>
        ) : (
          <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-500">종료됨</span>
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">이름</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">정답률</th>
              <th className="px-4 py-3">점수</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-400" colSpan={5}>
                  불러오는 중...
                </td>
              </tr>
            ) : attempts.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-400" colSpan={5}>
                  아직 응시자가 없습니다.
                </td>
              </tr>
            ) : (
              attempts.map((a) => {
                const hasAnswers = a.status === 'submitted' && (a.answers?.length ?? 0) > 0
                const isOpen = expanded.has(a.uid)
                return (
                  <Fragment key={a.uid}>
                    <tr>
                      <td className="px-4 py-3 font-medium text-slate-800">{a.studentName}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[a.status]}`}>
                          {STATUS_LABEL[a.status] ?? a.status}
                        </span>
                        {a.status === 'disqualified' && a.disqualifiedReason && (
                          <span className="ml-2 text-xs text-red-500">
                            ({VIOLATION_LABEL[a.disqualifiedReason] ?? a.disqualifiedReason})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {a.status === 'submitted' && a.accuracy != null
                          ? `${Math.round(a.accuracy * 100)}% (${a.correctCount}/${a.correctCount! + a.wrongCount!})`
                          : '–'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {a.status === 'submitted' && a.accuracy != null ? `${Math.round(a.accuracy * 100)}점` : '–'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {hasAnswers && (
                          <button
                            type="button"
                            onClick={() => toggleExpanded(a.uid)}
                            className="text-xs text-indigo-500 hover:text-indigo-700"
                          >
                            {isOpen ? '정오표 닫기' : '정오표 보기'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {hasAnswers && isOpen && (
                      <tr>
                        <td colSpan={5} className="bg-slate-50 px-4 py-3">
                          <div className="space-y-1">
                            {a.answers!.map((ans) => (
                              <div
                                key={ans.entryId}
                                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${
                                  ans.correct ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
                                }`}
                              >
                                <span className="font-medium text-slate-700">
                                  {ans.word} <span className="text-slate-400">–</span> {ans.meaning}
                                </span>
                                <span className="text-slate-500">
                                  {ans.correct ? '정답' : `오답 · 입력: ${ans.answer || '(빈 답안)'}`}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
