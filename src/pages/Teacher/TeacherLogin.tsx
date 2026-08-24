import { doc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { signInWithGoogle, signOutUser } from '../../lib/auth'
import { db } from '../../lib/firebase'
import { useAuthStore } from '../../store/authStore'
import type { TeacherApplicationStatus } from '../../types'

export default function TeacherLogin() {
  const { firebaseUser, adminProfile, loading } = useAuthStore()
  const [error, setError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)
  const [applicationStatus, setApplicationStatus] = useState<TeacherApplicationStatus | 'none' | null>(null)

  useEffect(() => {
    if (!firebaseUser || adminProfile) return
    getDoc(doc(db, 'teacherApplications', firebaseUser.uid)).then((snap) => {
      setApplicationStatus(snap.exists() ? (snap.data().status as TeacherApplicationStatus) : 'none')
    })
  }, [firebaseUser, adminProfile])

  if (!loading && firebaseUser && adminProfile) return <Navigate to="/teacher" replace />

  if (!loading && firebaseUser && !adminProfile) {
    return (
      <div className="mx-auto mt-24 max-w-sm text-center">
        {applicationStatus === 'pending' ? (
          <>
            <p className="text-sm font-semibold text-amber-600">선생님 등록 승인 대기 중입니다.</p>
            <p className="mt-1 text-xs text-slate-500">승인이 완료되면 이 계정으로 관리자 페이지를 이용할 수 있어요.</p>
          </>
        ) : applicationStatus === 'rejected' ? (
          <>
            <p className="text-sm font-semibold text-red-600">가입 신청이 거절되었습니다.</p>
            <a href="/teacher/signup" className="mt-1 inline-block text-xs text-indigo-500 hover:underline">
              다시 신청하기 →
            </a>
          </>
        ) : applicationStatus === 'none' ? (
          <>
            <p className="text-sm font-semibold text-slate-700">아직 선생님으로 등록되지 않은 계정입니다.</p>
            <a href="/teacher/signup" className="mt-1 inline-block text-xs text-indigo-500 hover:underline">
              가입 신청하기 →
            </a>
          </>
        ) : (
          <p className="text-sm font-semibold text-red-600">관리자 권한이 없는 계정입니다.</p>
        )}
        <p className="mt-3 text-xs text-slate-500">{firebaseUser.email}</p>
        <button
          type="button"
          onClick={() => signOutUser()}
          className="mt-6 rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          다른 계정으로 로그인
        </button>
        <a href="/" className="mt-4 block text-xs text-slate-400 hover:text-slate-600">
          ← 일반 로그인으로 돌아가기
        </a>
      </div>
    )
  }

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
    <div className="mx-auto mt-24 max-w-sm text-center">
      <a href="/" className="mb-4 block text-xs text-slate-400 hover:text-slate-600">
        ← 일반 로그인으로 돌아가기
      </a>
      <h1 className="text-xl font-bold text-slate-900">관리자 로그인</h1>
      <p className="mt-2 text-sm text-slate-500">승인된 선생님 계정만 관리자 페이지를 이용할 수 있습니다.</p>

      <button
        type="button"
        onClick={handleSignIn}
        disabled={signingIn}
        className="mt-8 w-full rounded-full border border-slate-300 bg-white py-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
      >
        {signingIn ? '로그인 중...' : '구글로 로그인'}
      </button>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <a href="/teacher/signup" className="mt-6 block text-xs text-slate-400 hover:text-slate-600">
        처음이신가요? 선생님 가입 신청
      </a>
    </div>
  )
}
