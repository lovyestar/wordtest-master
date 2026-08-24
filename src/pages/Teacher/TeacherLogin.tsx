import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { signInAdmin, signOutUser } from '../../lib/auth'
import { useAuthStore } from '../../store/authStore'

export default function TeacherLogin() {
  const { firebaseUser, adminProfile, loading } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && firebaseUser && adminProfile) return <Navigate to="/teacher" replace />

  if (!loading && firebaseUser && !adminProfile) {
    return (
      <div className="mx-auto mt-24 max-w-sm text-center">
        <p className="text-sm font-semibold text-red-600">관리자 권한이 없는 계정입니다.</p>
        <p className="mt-1 text-xs text-slate-500">{firebaseUser.email}</p>
        <button
          type="button"
          onClick={() => signOutUser()}
          className="mt-6 rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          다른 계정으로 로그인
        </button>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signInAdmin(email, password)
    } catch {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto mt-24 max-w-sm">
      <h1 className="text-center text-xl font-bold text-slate-900">관리자 로그인</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </div>
  )
}
