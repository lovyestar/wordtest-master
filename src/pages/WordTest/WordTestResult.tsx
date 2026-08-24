import { doc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { db } from '../../lib/firebase'
import { useAuthStore } from '../../store/authStore'
import type { GradedAnswer } from '../../types'

interface ResultData {
  totalQuestions: number
  correctCount: number
  wrongCount: number
  accuracy: number
  answers: GradedAnswer[]
}

export default function WordTestResult() {
  const { sessionId } = useParams()
  const location = useLocation()
  const { firebaseUser } = useAuthStore()
  const stateData = location.state as ResultData | null

  const [data, setData] = useState<ResultData | null>(stateData)
  const [loading, setLoading] = useState(!stateData)

  useEffect(() => {
    if (stateData || !sessionId || !firebaseUser) return
    getDoc(doc(db, 'examSessions', sessionId, 'attempts', firebaseUser.uid)).then((snap) => {
      if (snap.exists()) setData(snap.data() as ResultData)
      setLoading(false)
    })
  }, [sessionId, firebaseUser, stateData])

  if (loading) return <p className="text-center text-sm text-slate-400">불러오는 중...</p>
  if (!data) return <p className="text-center text-sm text-slate-400">결과를 찾을 수 없습니다.</p>

  const accuracyPct = Math.round(data.accuracy * 100)

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-slate-500">시험 종료</p>
        <p className="mt-1 text-5xl font-extrabold text-indigo-600">{accuracyPct}%</p>
        <p className="mt-3 text-sm text-slate-600">
          {data.totalQuestions}문제 중 <span className="font-semibold text-emerald-600">{data.correctCount}개 정답</span>,{' '}
          <span className="font-semibold text-red-500">{data.wrongCount}개 오답</span>
        </p>
      </div>

      <div className="mt-6 space-y-2">
        {data.answers.map((a) => (
          <div
            key={a.entryId}
            className={`rounded-lg border px-4 py-3 text-sm ${
              a.correct ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-800">
                {a.word} <span className="text-slate-400">–</span> {a.meaning}
              </span>
              <span className={a.correct ? 'text-emerald-600' : 'text-red-500'}>{a.correct ? '정답' : '오답'}</span>
            </div>
            {!a.correct && <p className="mt-1 text-xs text-slate-500">내 답안: {a.answer || '(빈 답안)'}</p>}
          </div>
        ))}
      </div>

      <Link
        to="/word-test"
        className="mt-8 block rounded-full bg-indigo-600 py-3 text-center text-sm font-semibold text-white hover:bg-indigo-700"
      >
        목록으로
      </Link>
    </div>
  )
}
