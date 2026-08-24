import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWordSets } from '../../../hooks/useWordSets'
import { db } from '../../../lib/firebase'
import { useAuthStore } from '../../../store/authStore'
import type { ExamSessionMode } from '../../../types'

const MODE_OPTIONS: { value: ExamSessionMode; label: string }[] = [
  { value: 'en2ko', label: '단어 보고 뜻 맞추기' },
  { value: 'ko2en', label: '뜻 보고 단어 맞추기' },
  { value: 'mixed', label: '혼합' },
]

export default function ExamNew() {
  const { wordSets, loading } = useWordSets()
  const { firebaseUser } = useAuthStore()
  const navigate = useNavigate()
  const activeSets = wordSets.filter((s) => s.active)

  const [name, setName] = useState('')
  const [wordSetId, setWordSetId] = useState('')
  const [questionCount, setQuestionCount] = useState(20)
  const [durationMinutes, setDurationMinutes] = useState(15)
  const [mode, setMode] = useState<ExamSessionMode>('en2ko')
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const selectedSetId = wordSetId || activeSets[0]?.id

  async function handleCreate() {
    if (!firebaseUser || !selectedSetId || !name.trim()) {
      setError('시험 이름과 단어장을 확인해주세요.')
      return
    }
    setCreating(true)
    setError(null)
    try {
      const ref = await addDoc(collection(db, 'examSessions'), {
        name: name.trim(),
        wordSetId: selectedSetId,
        createdBy: firebaseUser.uid,
        createdAt: serverTimestamp(),
        durationSeconds: durationMinutes * 60,
        questionCount,
        mode,
        status: 'open',
        openedAt: serverTimestamp(),
      })
      navigate(`/teacher/exams/${ref.id}`)
    } catch {
      setError('시험을 생성하지 못했습니다.')
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold text-slate-900">새 시험 시작</h1>

      <label className="mt-6 block text-sm font-medium text-slate-700">
        시험 이름
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 3월 1주차 단어 테스트"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </label>

      <label className="mt-4 block text-sm font-medium text-slate-700">
        단어장
        {loading ? (
          <p className="mt-1 text-sm text-slate-400">불러오는 중...</p>
        ) : (
          <select
            value={selectedSetId ?? ''}
            onChange={(e) => setWordSetId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            {activeSets.map((set) => (
              <option key={set.id} value={set.id}>
                {set.name} ({set.wordCount}단어)
              </option>
            ))}
          </select>
        )}
      </label>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <label className="block text-sm font-medium text-slate-700">
          문항 수
          <input
            type="number"
            min={1}
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          제한시간(분)
          <input
            type="number"
            min={1}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </label>
      </div>

      <label className="mt-4 block text-sm font-medium text-slate-700">
        출제 방식
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as ExamSessionMode)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        >
          {MODE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleCreate}
        disabled={creating}
        className="mt-6 w-full rounded-full bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {creating ? '시작하는 중...' : '시험 시작 (학생 응시 즉시 가능)'}
      </button>
    </div>
  )
}
