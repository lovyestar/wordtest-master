import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import Footer from '../components/layout/Footer'
import { signInWithGoogle } from '../lib/auth'
import { useAuthStore } from '../store/authStore'

export default function LandingPage() {
  const { firebaseUser, loading } = useAuthStore()
  const [error, setError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)

  if (!loading && firebaseUser) return <Navigate to="/ranking" replace />

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

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <h1 className="text-3xl font-bold text-slate-900">광명고등학교 영단어 시스템</h1>
      <p className="mt-3 max-w-sm text-slate-600">
        구글 계정으로 로그인하고 랭킹, 단어 모의 시험, 단어 테스트를 이용하세요.
      </p>

      <button
        type="button"
        onClick={handleSignIn}
        disabled={signingIn || loading}
        className="mt-8 flex items-center gap-3 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
      >
        <GoogleIcon />
        {signingIn ? '로그인 중...' : '구글로 로그인'}
      </button>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <a
        href="/teacher/login"
        className="fixed bottom-2 right-3 text-[11px] text-slate-300 hover:text-slate-500"
      >
        관리자 페이지로 이동
      </a>

      <div className="absolute bottom-0 left-0 right-0">
        <Footer />
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
      />
    </svg>
  )
}
