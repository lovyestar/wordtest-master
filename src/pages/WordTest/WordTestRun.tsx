import { addDoc, collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import FullScreenSpinner from '../../components/FullScreenSpinner'
import { db } from '../../lib/firebase'
import { submitExamAttemptFn } from '../../lib/functionsClient'
import { useAuthStore } from '../../store/authStore'
import type { AttemptStatus, ExamQuestion, ViolationType } from '../../types'

interface AttemptDoc {
  status: AttemptStatus
  questions: ExamQuestion[]
  activeSessionToken: string
  startedAt: { toMillis(): number } | null
  disqualifiedReason?: ViolationType
}

interface SessionDoc {
  durationSeconds: number
}

export default function WordTestRun() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { firebaseUser } = useAuthStore()

  const [attempt, setAttempt] = useState<AttemptDoc | null>(null)
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [lockedOut, setLockedOut] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)

  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [answerError, setAnswerError] = useState(false)
  const answersRef = useRef<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const myTokenRef = useRef<string>(crypto.randomUUID())
  const disqualifiedRef = useRef(false)
  const submittedRef = useRef(false)

  const attemptPath = sessionId && firebaseUser ? `examSessions/${sessionId}/attempts/${firebaseUser.uid}` : null

  const disqualify = useCallback(
    async (type: ViolationType) => {
      if (disqualifiedRef.current || submittedRef.current || !attemptPath) return
      disqualifiedRef.current = true
      try {
        await addDoc(collection(db, attemptPath, 'violations'), { type, at: serverTimestamp() })
        await updateDoc(doc(db, attemptPath), {
          status: 'disqualified',
          disqualifiedAt: serverTimestamp(),
          disqualifiedReason: type,
        })
      } catch {
        // best-effort: local state already reflects the freeze
      }
    },
    [attemptPath],
  )

  // Load session duration once.
  useEffect(() => {
    if (!sessionId) return
    const unsub = onSnapshot(doc(db, 'examSessions', sessionId), (snap) => {
      const data = snap.data() as SessionDoc | undefined
      if (data) setDurationSeconds(data.durationSeconds)
    })
    return unsub
  }, [sessionId])

  // Subscribe to the attempt doc; claim this tab as the active one.
  useEffect(() => {
    if (!attemptPath) return
    const ref = doc(db, attemptPath)
    let claimed = false

    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return
      const data = snap.data() as AttemptDoc
      setAttempt(data)
      setLoading(false)

      if (!claimed && data.status === 'in_progress') {
        claimed = true
        updateDoc(ref, { activeSessionToken: myTokenRef.current }).catch(() => {})
        return
      }

      if (data.activeSessionToken !== myTokenRef.current && data.status === 'in_progress') {
        setLockedOut(true)
      }
    })
    return unsub
  }, [attemptPath])

  // Detect an actual browser reload (vs. normal in-app navigation) and log
  // it as a non-fatal flag for the teacher, per the anti-cheat design.
  useEffect(() => {
    if (!attemptPath) return
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (nav?.type === 'reload') {
      addDoc(collection(db, attemptPath, 'violations'), {
        type: 'page_reload',
        at: serverTimestamp(),
      }).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Anti-cheat listeners, armed only while in_progress, not locked out.
  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress' || lockedOut) return

    function onVisibility() {
      if (document.hidden) disqualify('visibility_hidden')
    }
    function onBlur() {
      disqualify('blur')
    }
    function onFullscreenChange() {
      if (!document.fullscreenElement) disqualify('fullscreen_exit')
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [attempt, lockedOut, disqualify])

  // Server-anchored countdown.
  useEffect(() => {
    if (!attempt?.startedAt || durationSeconds == null) return
    const deadline = attempt.startedAt.toMillis() + durationSeconds * 1000
    const tick = () => setRemaining(Math.max(0, Math.round((deadline - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [attempt?.startedAt, durationSeconds])

  const submit = useCallback(async () => {
    if (!sessionId || submittedRef.current) return
    submittedRef.current = true
    setSubmitting(true)
    try {
      const questions = attempt?.questions ?? []
      const payload = questions.map((q) => ({ entryId: q.entryId, answer: answersRef.current[q.entryId] ?? '' }))
      const res = await submitExamAttemptFn({ sessionId, answers: payload })
      navigate(`/word-test/${sessionId}/result`, { state: res.data })
    } catch {
      submittedRef.current = false
      setSubmitting(false)
    }
  }, [sessionId, attempt, navigate])

  // Auto-submit when time runs out.
  useEffect(() => {
    if (remaining === 0 && attempt?.status === 'in_progress' && !lockedOut) {
      submit()
    }
  }, [remaining, attempt?.status, lockedOut, submit])

  if (!sessionId || !firebaseUser) return <Navigate to="/word-test" replace />
  if (loading) return <FullScreenSpinner />
  if (!attempt) return <p className="text-center text-sm text-slate-400">응시 정보를 찾을 수 없습니다.</p>

  if (lockedOut) {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="text-lg font-semibold text-amber-600">다른 창에서 이 시험이 진행 중입니다.</p>
        <p className="mt-2 text-sm text-slate-500">한 번에 하나의 창에서만 응시할 수 있습니다.</p>
      </div>
    )
  }

  if (attempt.status === 'disqualified') {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="text-lg font-semibold text-red-600">부정행위로 응시가 취소되었습니다.</p>
        <p className="mt-2 text-sm text-slate-500">시험 중 다른 화면으로 이동하여 자동으로 실격 처리되었습니다.</p>
      </div>
    )
  }

  if (attempt.status !== 'in_progress') {
    return <Navigate to={`/word-test/${sessionId}/result`} replace />
  }

  const questions = attempt.questions
  const question = questions[index]
  const isLast = index === questions.length - 1
  const prompt = question.direction === 'en2ko' ? question.word : question.meaning
  const placeholder = question.direction === 'en2ko' ? '뜻을 입력하세요' : '영단어를 입력하세요'
  const minutes = remaining != null ? Math.floor(remaining / 60) : 0
  const seconds = remaining != null ? remaining % 60 : 0

  function advance(value: string) {
    answersRef.current[question.entryId] = value.trim()
    setAnswer('')
    setAnswerError(false)
    if (isLast) {
      submit()
    } else {
      setIndex((i) => i + 1)
    }
  }

  function handleNext() {
    if (!answer.trim()) {
      setAnswerError(true)
      return
    }
    advance(answer)
  }

  function handleDontKnow() {
    advance('')
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 flex items-center justify-between text-sm">
        <span className="text-slate-400">
          {index + 1} / {questions.length}
        </span>
        <span className={`font-mono font-semibold ${remaining != null && remaining < 30 ? 'text-red-600' : 'text-slate-700'}`}>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-400">
          {question.direction === 'en2ko' ? '이 단어의 뜻은?' : '이 뜻에 해당하는 단어는?'}
        </p>
        <p className="mt-3 text-2xl font-bold text-slate-900 break-keep">{prompt}</p>
      </div>

      <form
        className="mt-6"
        onSubmit={(e) => {
          e.preventDefault()
          if (!submitting) handleNext()
        }}
      >
        <input
          autoFocus
          value={answer}
          onChange={(e) => {
            setAnswer(e.target.value)
            if (answerError) setAnswerError(false)
          }}
          placeholder={placeholder}
          className={`w-full rounded-xl border px-4 py-3 text-center text-lg focus:outline-none ${
            answerError ? 'border-red-400 focus:border-red-500' : 'border-slate-300 focus:border-indigo-500'
          }`}
          disabled={submitting}
        />
        {answerError && <p className="mt-2 text-sm text-red-600">답을 입력하거나 모르겠어요를 눌러주세요.</p>}
        <button
          type="submit"
          disabled={submitting}
          className="mt-4 w-full rounded-full bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? '채점 중...' : isLast ? '제출하기' : '다음'}
        </button>
        <button
          type="button"
          onClick={handleDontKnow}
          disabled={submitting}
          className="mt-2 w-full rounded-full py-2 text-xs font-medium text-slate-400 hover:text-slate-600 disabled:opacity-50"
        >
          모르겠어요
        </button>
      </form>
    </div>
  )
}
