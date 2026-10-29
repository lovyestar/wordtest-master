import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import FullScreenSpinner from '../../components/FullScreenSpinner'
import ThemeToggle from '../../components/ThemeToggle'
import { useWordSetEntries } from '../../hooks/useWordSetEntries'
import { useWordSets } from '../../hooks/useWordSets'
import { db } from '../../lib/firebase'
import { buildExamQuestions } from '../../lib/examSession'
import { useAuthStore } from '../../store/authStore'
import type { AttemptStatus, ExamSession } from '../../types'

export default function WordTestStart() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { firebaseUser } = useAuthStore()

  const [session, setSession] = useState<ExamSession | null | undefined>(undefined)
  const [existingStatus, setExistingStatus] = useState<AttemptStatus | null>(null)
  const [checking, setChecking] = useState(true)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const { entries } = useWordSetEntries(session?.wordSetId)
  const { wordSets } = useWordSets()
  const wordSetName = wordSets.find((w) => w.id === session?.wordSetId)?.name

  useEffect(() => {
    if (!sessionId || !firebaseUser) return
    let cancelled = false
    ;(async () => {
      const sessionSnap = await getDoc(doc(db, 'examSessions', sessionId))
      if (cancelled) return
      if (!sessionSnap.exists()) {
        setSession(null)
        setChecking(false)
        return
      }
      const data = sessionSnap.data()
      setSession({
        id: sessionSnap.id,
        name: data.name,
        wordSetId: data.wordSetId,
        createdBy: data.createdBy,
        createdByName: data.createdByName,
        createdAt: 0,
        durationSeconds: data.durationSeconds,
        questionCount: data.questionCount,
        mode: data.mode,
        status: data.status,
      })

      const attemptSnap = await getDoc(doc(db, 'examSessions', sessionId, 'attempts', firebaseUser.uid))
      if (attemptSnap.exists()) {
        setExistingStatus(attemptSnap.data().status as AttemptStatus)
      }
      setChecking(false)
    })()
    return () => {
      cancelled = true
    }
  }, [sessionId, firebaseUser])

  if (!sessionId) return <Navigate to="/word-test" replace />
  if (checking || session === undefined) return <FullScreenSpinner />
  if (session === null) {
    return <p className="text-center text-sm text-slate-400">존재하지 않는 시험입니다.</p>
  }

  if (existingStatus === 'in_progress') {
    return <Navigate to={`/word-test/${sessionId}/run`} replace />
  }
  if (existingStatus === 'submitted') {
    return <Navigate to={`/word-test/${sessionId}/result`} replace />
  }
  if (existingStatus === 'disqualified') {
    return (
      <div className="mx-auto max-w-md text-center">
        <ThemeToggle className="fixed top-4 right-4" />
        <p className="text-lg font-semibold text-red-600">부정행위로 응시가 취소되었습니다.</p>
        <p className="mt-2 text-sm text-slate-500">이 시험은 다시 응시할 수 없습니다.</p>
      </div>
    )
  }

  if (session.status !== 'open') {
    return <p className="text-center text-sm text-slate-400">현재 응시할 수 없는 시험입니다.</p>
  }

  async function handleStart() {
    if (!firebaseUser || !sessionId || !session) return
    const trimmed = name.trim()
    if (!trimmed) {
      setError('실명을 입력해주세요.')
      return
    }
    if (entries.length === 0) {
      setError('단어 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
      return
    }

    setStarting(true)
    setError(null)
    await new Promise((resolve) => setTimeout(resolve, 2000))
    try {
      const questions = buildExamQuestions(entries, session)
      const attemptRef = doc(db, 'examSessions', sessionId, 'attempts', firebaseUser.uid)
      await setDoc(attemptRef, {
        uid: firebaseUser.uid,
        studentName: trimmed,
        wordSetId: session.wordSetId,
        questions,
        status: 'in_progress',
        activeSessionToken: crypto.randomUUID(),
        startedAt: serverTimestamp(),
      })
      // Best-effort, non-blocking: some browsers/embeds deny or simply never
      // resolve this promise (no fullscreen support), which must never stall
      // exam start — the visibilitychange/blur listeners still cover those cases.
      document.documentElement.requestFullscreen?.().catch(() => {})
      navigate(`/word-test/${sessionId}/run`, { replace: true })
    } catch {
      setError('시험을 시작하지 못했습니다. 다시 시도해주세요.')
      setStarting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center">
      <ThemeToggle className="fixed top-4 right-4" />
      <h1 className="text-xl font-bold text-slate-900">{session.name}</h1>
      <p className="mt-1 text-sm text-slate-500">단어장: {wordSetName ?? '-'}</p>
      <p className="mt-0.5 text-sm text-slate-500">
        문항 {session.questionCount}개 · 제한시간 {Math.round(session.durationSeconds / 60)}분
        {session.createdByName && ` · 출제: ${session.createdByName}`}
      </p>

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-semibold">응시 전 확인해주세요</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>구글 로그인 여부와 관계없이 반드시 본인의 실명을 입력해야 합니다.</li>
          <li>
            시험 중에는 <b>CheckStar</b>가 화면 이탈(다른 탭/창 전환, 전체화면 벗어남)을 감지하며, 감지 시
            부정행위로 처리되어 응시가 자동 취소됩니다.
          </li>
          <li>시험을 시작하면 중간에 되돌릴 수 없습니다.</li>
        </ul>
      </div>

      <label className="mt-6 block text-sm font-medium text-slate-700">
        실명
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 홍길동"
          className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-base focus:border-indigo-500 focus:outline-none"
        />
      </label>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleStart}
        disabled={starting}
        className="mt-6 w-full rounded-full bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
      >
        {starting ? 'CheckStar가 시작하고 있습니다...' : '시험 시작 (CheckStar 감시가 시작됩니다)'}
      </button>
    </div>
  )
}
