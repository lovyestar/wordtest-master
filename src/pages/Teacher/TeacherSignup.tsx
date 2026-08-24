import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signUpTeacher } from '../../lib/auth'

export default function TeacherSignup() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password || !name.trim()) {
      setError('아이디(이메일), 비밀번호, 이름을 모두 입력해주세요.')
      return
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await signUpTeacher(email.trim(), password, name.trim())
      navigate('/teacher/login', { replace: true })
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'auth/email-already-in-use') {
        setError('이미 등록된 이메일입니다.')
      } else {
        setError('가입에 실패했습니다. 다시 시도해주세요.')
      }
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto mt-24 max-w-sm px-4">
      <h1 className="text-center text-xl font-bold text-slate-900">선생님 가입 신청</h1>
      <p className="mt-2 text-center text-sm text-slate-500">
        가입 신청 후 관리자 승인이 완료되면 관리자 페이지를 이용할 수 있습니다.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="사용할 아이디 (이메일)"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호 (6자 이상)"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting ? '신청 중...' : '가입 신청'}
        </button>
      </form>
    </div>
  )
}
