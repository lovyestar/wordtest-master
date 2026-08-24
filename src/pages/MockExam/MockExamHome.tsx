import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWordSetEntries } from '../../hooks/useWordSetEntries'
import { useWordSets } from '../../hooks/useWordSets'
import { DEFAULT_MOCK_EXAM_QUESTION_COUNT, QUESTION_COUNT_OPTIONS, sampleQuestions } from '../../lib/quiz'
import type { ExamMode, MockExamQuestion } from '../../types'

const MODE_OPTIONS: { value: ExamMode; label: string; hint: string }[] = [
  { value: 'en2ko', label: '단어 보고 뜻 맞추기', hint: '영단어를 보고 뜻을 입력합니다' },
  { value: 'ko2en', label: '뜻 보고 단어 맞추기', hint: '뜻을 보고 영단어를 입력합니다' },
]

export default function MockExamHome() {
  const navigate = useNavigate()
  const { wordSets, loading: wordSetsLoading } = useWordSets()
  const activeSets = wordSets.filter((s) => s.active)

  const [wordSetId, setWordSetId] = useState<string>('')
  const [mode, setMode] = useState<ExamMode>('en2ko')
  const [questionCount, setQuestionCount] = useState(DEFAULT_MOCK_EXAM_QUESTION_COUNT)
  const [starting, setStarting] = useState(false)

  const selectedSetId = wordSetId || activeSets[0]?.id
  const { entries, loading: entriesLoading } = useWordSetEntries(selectedSetId)

  const availableCountOptions = QUESTION_COUNT_OPTIONS.filter((n) => n <= entries.length || n === Infinity)
  const effectiveCount = Math.min(questionCount, entries.length)

  function handleStart() {
    if (!selectedSetId || entries.length === 0) return
    setStarting(true)
    const questions: MockExamQuestion[] = sampleQuestions(entries, effectiveCount).map((e) => ({
      entryId: e.id,
      word: e.word,
      meaning: e.meaning,
    }))
    navigate('/mock-exam/run', { state: { wordSetId: selectedSetId, mode, questions } })
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-bold text-slate-900">단어 모의 시험</h1>
      <p className="mt-1 text-sm text-slate-500">
        단어장에서 무작위로 문제를 출제합니다. 오늘의 최고 정답률이 랭킹에 반영돼요.
      </p>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-slate-700">단어장 선택</h2>
        {wordSetsLoading ? (
          <p className="mt-2 text-sm text-slate-400">불러오는 중...</p>
        ) : activeSets.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">등록된 단어장이 없습니다.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {activeSets.map((set) => (
              <label
                key={set.id}
                className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${
                  selectedSetId === set.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <span>
                  <span className="font-medium text-slate-800">{set.name}</span>
                  <span className="ml-2 text-xs text-slate-400">{set.wordCount}단어</span>
                </span>
                <input
                  type="radio"
                  name="wordSet"
                  className="accent-indigo-600"
                  checked={selectedSetId === set.id}
                  onChange={() => setWordSetId(set.id)}
                />
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-slate-700">시험 방식</h2>
        <div className="mt-2 space-y-2">
          {MODE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${
                mode === opt.value ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <span>
                <span className="font-medium text-slate-800">{opt.label}</span>
                <span className="block text-xs text-slate-400">{opt.hint}</span>
              </span>
              <input
                type="radio"
                name="mode"
                className="accent-indigo-600"
                checked={mode === opt.value}
                onChange={() => setMode(opt.value)}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-slate-700">문제 수</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {availableCountOptions.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setQuestionCount(n)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                effectiveCount === Math.min(n, entries.length)
                  ? 'bg-indigo-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {n === Infinity ? `전체 (${entries.length})` : `${n}개`}
            </button>
          ))}
        </div>
      </section>

      <button
        type="button"
        disabled={!selectedSetId || entriesLoading || entries.length === 0 || starting}
        onClick={handleStart}
        className="mt-8 w-full rounded-full bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
      >
        {starting ? '준비 중...' : '모의 시험 시작'}
      </button>
    </div>
  )
}
