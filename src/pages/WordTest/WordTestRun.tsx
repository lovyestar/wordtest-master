import { addDoc, collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import FullScreenSpinner from '../../components/FullScreenSpinner'
import { db } from '../../lib/firebase'
import { submitExamAttemptFn } from '../../lib/functionsClient'
import { startEvidenceRecorder, type EvidenceRecorder } from '../../lib/violationEvidence'
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

const DISQUALIFY_MESSAGE: Record<ViolationType, string> = {
  visibility_hidden: '시험 중 다른 탭으로 이동했거나 브라우저 창을 최소화했습니다.',
  blur: '시험 창에서 다른 창·프로그램으로 포커스가 이동했습니다.',
  fullscreen_exit: '시험 중 전체화면을 해제했습니다.',
  page_reload: '시험 중 페이지를 새로고침했습니다.',
}

interface LogLine {
  id: number
  time: string
  key: string
  value: string
  ok: boolean
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
  const [localDisqualified, setLocalDisqualified] = useState<ViolationType | false>(false)
  const [logLines, setLogLines] = useState<LogLine[]>([])
  const [noticeVisible, setNoticeVisible] = useState(true)

  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [answerError, setAnswerError] = useState(false)
  const answersRef = useRef<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const myTokenRef = useRef<string>(crypto.randomUUID())
  const disqualifiedRef = useRef(false)
  const submittedRef = useRef(false)
  const wasFullscreenRef = useRef(false)
  const indexRef = useRef(0)
  const recorderRef = useRef<EvidenceRecorder | null>(null)
  const disqualifiedAtRef = useRef(0)
  const returnLoggedRef = useRef(false)

  const attemptPath = sessionId && firebaseUser ? `examSessions/${sessionId}/attempts/${firebaseUser.uid}` : null

  const disqualify = useCallback(
    async (type: ViolationType) => {
      if (disqualifiedRef.current || submittedRef.current || !attemptPath) return
      disqualifiedRef.current = true
      disqualifiedAtRef.current = Date.now()
      // Freeze the UI right away; the Firestore writes below may be delayed
      // or throttled while the tab is in the background.
      setLocalDisqualified(type)
      recorderRef.current?.push(`DISQUALIFIED (${type})`)
      const detail = recorderRef.current?.snapshot(indexRef.current + 1)
      await Promise.allSettled([
        updateDoc(doc(db, attemptPath), {
          status: 'disqualified',
          disqualifiedAt: serverTimestamp(),
          disqualifiedReason: type,
        }),
        addDoc(collection(db, attemptPath, 'violations'), { type, at: serverTimestamp(), ...(detail && { detail }) }),
      ])
    },
    [attemptPath],
  )

  // Rolling event timeline attached to violations as evidence for the teacher.
  useEffect(() => {
    if (!attemptPath) return
    const recorder = startEvidenceRecorder()
    recorderRef.current = recorder

    // After a disqualification, log when the student comes back so the teacher
    // can see how long they were away.
    function onReturn() {
      if (!disqualifiedRef.current || returnLoggedRef.current || document.hidden) return
      returnLoggedRef.current = true
      const awaySec = Math.round((Date.now() - disqualifiedAtRef.current) / 1000)
      addDoc(collection(db, attemptPath!, 'violations'), {
        type: 'returned',
        at: serverTimestamp(),
        detail: recorder.snapshot(indexRef.current + 1, awaySec),
      }).catch(() => {})
    }
    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('focus', onReturn)
    return () => {
      document.removeEventListener('visibilitychange', onReturn)
      window.removeEventListener('focus', onReturn)
      recorder.stop()
      recorderRef.current = null
    }
  }, [attemptPath])

  useEffect(() => {
    indexRef.current = index
  }, [index])

  // Cosmetic live feed of what CheckStar is checking; each line fades out by
  // itself (see .cs-log-line in index.css). Detection itself lives below.
  // Starts once the opening notice has faded.
  const status = attempt?.status
  const activeToken = attempt?.activeSessionToken
  useEffect(() => {
    const id = setTimeout(() => setNoticeVisible(false), 6000)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    if (status !== 'in_progress' || lockedOut) return
    let seq = 0
    let prev = -1
    const pad = (n: number) => String(n).padStart(3, '0')
    const probes: (() => [string, string, boolean])[] = [
      () => ['visibility.watch', document.hidden ? 'hidden' : 'visible', !document.hidden],
      () => ['focus.lock', document.hasFocus() ? 'held' : 'lost', document.hasFocus()],
      () => {
        const fs = !wasFullscreenRef.current || !!document.fullscreenElement
        return ['fullscreen.guard', wasFullscreenRef.current ? (fs ? 'engaged' : 'released') : 'standby', fs]
      },
      () => ['viewport.sentinel', `${window.innerWidth}x${window.innerHeight} stable`, true],
      () => {
        const ok = activeToken === myTokenRef.current
        return ['session.token', ok ? `${myTokenRef.current.slice(0, 8)}… verified` : 'mismatch', ok]
      },
      () => ['tab.exclusive', '1 active window', true],
      () => ['net.link', navigator.onLine ? 'online' : 'offline', navigator.onLine],
      () => ['clock.sync', `server-anchored · drift ${Math.floor(Math.random() * 9)}ms`, true],
      () => ['heartbeat', `seq#${pad(seq)} · ack`, true],
      () => ['violations', '0 flagged', true],
      () => ['tab.switch', 'trap armed', true],
      () => ['exit.fullscreen', 'trap armed', true],
    ]
    const push = () => {
      let k = Math.floor(Math.random() * probes.length)
      if (k === prev) k = (k + 1) % probes.length
      prev = k
      const [key, value, ok] = probes[k]()
      const line: LogLine = { id: seq, time: new Date().toLocaleTimeString('en-GB'), key, value, ok }
      seq += 1
      setLogLines((p) => [...p.slice(-4), line])
      setTimeout(() => setLogLines((p) => p.filter((l) => l.id !== line.id)), 4500)
    }
    let interval: ReturnType<typeof setInterval>
    const start = setTimeout(() => {
      push()
      interval = setInterval(push, 1800)
    }, 6500)
    return () => {
      clearTimeout(start)
      clearInterval(interval)
    }
  }, [status, lockedOut, activeToken])

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
        detail: recorderRef.current?.snapshot(indexRef.current + 1),
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
      if (document.fullscreenElement) wasFullscreenRef.current = true
      else disqualify('fullscreen_exit')
    }
    // Backstop for events missed while the tab was in the background (e.g.
    // Chromebook tab-switch / exit-fullscreen keys): re-check on return and
    // periodically.
    function check() {
      if (document.fullscreenElement) wasFullscreenRef.current = true
      if (document.hidden) disqualify('visibility_hidden')
      else if (!document.hasFocus()) disqualify('blur')
      else if (wasFullscreenRef.current && !document.fullscreenElement) disqualify('fullscreen_exit')
    }
    const intervalId = setInterval(check, 500)
    window.addEventListener('focus', check)
    window.addEventListener('pageshow', check)

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      clearInterval(intervalId)
      window.removeEventListener('focus', check)
      window.removeEventListener('pageshow', check)
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

  if (localDisqualified || attempt.status === 'disqualified') {
    return (
      <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center text-center">
        <p className="text-lg font-semibold text-red-600">부정행위로 응시가 취소되었습니다.</p>
        <p className="mt-3 text-sm font-medium text-slate-700">
          사유: {DISQUALIFY_MESSAGE[localDisqualified || attempt.disqualifiedReason || 'visibility_hidden']}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          CheckStar가 발생 시각과 당시 상태를 기록했으며, 선생님이 확인할 수 있습니다.
        </p>
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
    <div className="mx-auto flex min-h-[80vh] w-full max-w-lg flex-col justify-center">
      <div className="fixed top-4 left-4 z-30 flex items-center gap-3 border border-slate-200 border-l-[3px] border-l-emerald-500 bg-white/80 py-2.5 pl-3.5 pr-5 shadow-sm backdrop-blur-md dark:border-slate-700 dark:border-l-emerald-400 dark:bg-slate-900/70">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <div className="leading-tight">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">CheckStar</p>
          <p className="mt-0.5 text-sm font-medium text-slate-800 dark:text-slate-100">안전하게 시험을 관리하는 중입니다</p>
        </div>
      </div>

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

      <div
        aria-live="polite"
        className={`pointer-events-none fixed bottom-6 left-4 z-30 w-72 overflow-hidden border border-slate-200 bg-white/85 shadow-2xl backdrop-blur-xl transition-all duration-700 dark:border-slate-700 dark:bg-slate-900/80 ${
          noticeVisible ? 'cs-notice-in opacity-100' : 'translate-y-3 opacity-0'
        }`}
      >
        <div className="relative flex items-start gap-3 px-4 py-3.5">
          <div className="cs-icon-glow relative flex h-9 w-9 shrink-0 items-center justify-center bg-emerald-600 text-white">
<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
              <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z" />
              <path className="cs-check" d="M8.5 12l2.5 2.5 4.5-5" pathLength={1} />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">CheckStar · 감독 시작</p>
            <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">화면 이탈을 실시간으로 감지합니다</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
              <li className="cs-notice-item" style={{ animationDelay: '0.5s' }}><span className="mr-2 inline-block h-1 w-1 bg-emerald-500 align-middle" />탭 전환 · 창 포커스 이탈</li>
              <li className="cs-notice-item" style={{ animationDelay: '0.8s' }}><span className="mr-2 inline-block h-1 w-1 bg-emerald-500 align-middle" />전체화면 해제</li>
              <li className="cs-notice-item text-slate-700 dark:text-slate-200" style={{ animationDelay: '1.1s' }}><span className="mr-2 inline-block h-1 w-1 bg-emerald-500 align-middle" />감지 즉시 응시가 취소됩니다</li>
            </ul>
          </div>
        </div>
        <div className="relative h-0.5 w-full">
          <div className="cs-notice-bar h-full w-full origin-left bg-emerald-500" />
          <span className="cs-bar-head absolute -top-[3px] h-2 w-2 bg-emerald-400" />
        </div>
      </div>

      <div aria-hidden className="pointer-events-none fixed bottom-6 left-4 z-20 space-y-0.5 opacity-25 font-mono text-[11px] leading-5">
        {logLines.map((l) => (
          <p key={l.id} className="cs-log-line flex gap-2 whitespace-nowrap">
            <span className="text-slate-400 dark:text-slate-500">{l.time}</span>
            <span className={l.ok ? 'text-emerald-500' : 'text-red-500'}>{l.ok ? '▸' : '✕'}</span>
            <span className="w-32 font-semibold text-slate-600 dark:text-slate-300">{l.key}</span>
            <span className={l.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}>{l.value}</span>
          </p>
        ))}
      </div>
    </div>
  )
}
