import { doc, setDoc } from 'firebase/firestore'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'

export default function OnboardingPage() {
  const { firebaseUser, profile, profileLoading } = useAuthStore()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!profileLoading && profile?.studentId && profile.name) return <Navigate to="/ranking" replace />

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!firebaseUser) return
    const trimmedName = name.trim()
    const trimmedId = studentId.trim()
    if (!trimmedName || !trimmedId) {
      setError('이름과 학번을 모두 입력해주세요.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await setDoc(
        doc(db, 'users', firebaseUser.uid),
        {
          name: trimmedName,
          studentId: trimmedId,
          displayName: `${trimmedId} ${trimmedName}`,
        },
        { merge: true },
      )
      navigate('/ranking', { replace: true })
    } catch {
      setError('저장하지 못했습니다. 다시 시도해주세요.')
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto mt-24 max-w-sm px-4">
      <ThemeToggle className="fixed top-4 right-4" />
      <h1 className="text-center text-xl font-bold text-slate-900">가입 정보 입력</h1>
      <p className="mt-2 text-center text-sm text-slate-500">
        랭킹과 시험에는 구글 닉네임 대신 이름과 학번이 표시됩니다.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <input
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          placeholder="학번 (예: 3051)"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? '저장 중...' : '시작하기'}
        </button>
      </form>
    </div>
  )
}
