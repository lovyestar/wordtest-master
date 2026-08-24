import { doc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { signInWithGoogle, submitTeacherApplication } from '../../lib/auth'
import { db } from '../../lib/firebase'
import { useAuthStore } from '../../store/authStore'
import type { TeacherApplicationStatus } from '../../types'

export default function TeacherSignup() {
  const { firebaseUser, adminProfile, loading } = useAuthStore()
  const navigate = useNavigate()

  const [signingIn, setSigningIn] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [applicationStatus, setApplicationStatus] = useState<TeacherApplicationStatus | 'none' | null>(null)

  useEffect(() => {
    if (!firebaseUser || adminProfile) return
    getDoc(doc(db, 'teacherApplications', firebaseUser.uid)).then((snap) => {
      setApplicationStatus(snap.exists() ? (snap.data().status as TeacherApplicationStatus) : 'none')
    })
  }, [firebaseUser, adminProfile])

  if (!loading && firebaseUser && adminProfile) return <Navigate to="/teacher" replace />

  async function handleSignIn() {
    setError(null)
    setSigningIn(true)
    try {
      await signInWithGoogle()
    } catch {
      setError('로그인에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setSigningIn(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('이름을 입력해주세요.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await submitTeacherApplication(name)
      navigate('/teacher/login', { replace: true })
    } catch {
      setError('신청에 실패했습니다. 다시 시도해주세요.')
      setSubmitting(false)
    }
  }

  // Only an already-pending request blocks a new submission — a rejected
  // applicant can simply apply again (resubmitting resets status to
  // 'pending' since the application doc is keyed by their uid).
  if (!loading && firebaseUser && applicationStatus === 'pending') {
    return (
      <div className="mx-auto mt-24 max-w-sm text-center">
        <p className="text-sm font-semibold text-amber-600">이미 승인 대기 중인 신청이 있습니다.</p>
        <p className="mt-1 text-xs text-slate-500">승인이 완료되면 관리자 페이지를 이용할 수 있어요.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto mt-24 max-w-sm px-4 text-center">
      <a href="/teacher/login" className="mb-4 block text-xs text-slate-400 hover:text-slate-600">
        ← 관리자 로그인으로 돌아가기
      </a>
      <h1 className="text-xl font-bold text-slate-900">선생님 가입 신청</h1>
      <p className="mt-2 text-sm text-slate-500">
        구글 계정으로 로그인 후 이름을 입력하면 관리자 승인 후 관리자 페이지를 이용할 수 있습니다.
      </p>

      {!firebaseUser ? (
        <button
          type="button"
          onClick={handleSignIn}
          disabled={signingIn}
          className="mt-8 w-full rounded-full border border-slate-300 bg-white py-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
        >
          {signingIn ? '로그인 중...' : '구글로 로그인'}
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-3 text-left">
          <p className="text-center text-xs text-slate-400">{firebaseUser.email}</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? '신청 중...' : '가입 신청'}
          </button>
        </form>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  )
}
