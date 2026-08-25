import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useWordSetEntries } from '../../hooks/useWordSetEntries'
import { useWordSets } from '../../hooks/useWordSets'
import { isCorrectAnswer } from '../../lib/clientGrading'
import { DEFAULT_MOCK_EXAM_QUESTION_COUNT, QUESTION_COUNT_OPTIONS, sampleQuestions } from '../../lib/quiz'
import type { ExamMode, WordEntry } from '../../types'

const MODE_OPTIONS: { value: ExamMode; label: string }[] = [
  { value: 'en2ko', label: '단어 보고 뜻 맞추기' },
  { value: 'ko2en', label: '뜻 보고 단어 맞추기' },
]

export default function WordStudyRun() {
  const { setId } = useParams()
  const { wordSets } = useWordSets()
  const { entries, loading } = useWordSetEntries(setId)
  const set = wordSets.find((s) => s.id === setId)

  const [mode, setMode] = useState<ExamMode>('en2ko')
  const [questionCount, setQuestionCount] = useState(DEFAULT_MOCK_EXAM_QUESTION_COUNT)
  const [queue, setQueue] = useState<WordEntry[] | null>(null)
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [answerError, setAnswerError] = useState(false)
  const [checked, setChecked] = useState<{ correct: boolean } | null>(null)
  const [correctCount, setCorrectCount] = useState(0)

  const availableCountOptions = QUESTION_COUNT_OPTIONS.filter((n) => n <= entries.length || n === Infinity)
  const effectiveCount = Math.min(questionCount, entries.length)

  function handleStart() {
    setQueue(sampleQuestions(entries, effectiveCount))
    setIndex(0)
    setCorrectCount(0)
    setChecked(null)
    setAnswer('')
  }

  function handleRestart() {
    setQueue(null)
  }

  const question = queue?.[index]

  function handleCheck() {
    if (!question) return
    if (!answer.trim()) {
      setAnswerError(true)
      return
    }
    const correct = isCorrectAnswer(mode, answer, question.word, question.meaning)
    if (correct) setCorrectCount((c) => c + 1)
    setChecked({ correct })
  }

  function handleDontKnow() {
    if (!question) return
    setChecked({ correct: false })
  }

  function handleNext() {
    setAnswer('')
    setAnswerError(false)
    setChecked(null)
    setIndex((i) => i + 1)
  }

  // Once feedback is showing, Enter advances to the next card — the input
  // is gone at that point so the form's own onSubmit can't catch it.
  useEffect(() => {
    if (!checked) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter') handleNext()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked])

  if (!setId) return null

  if (!queue) {
    return (
      <div className="mx-auto max-w-lg">
        <Link to="/word-study" className="text-sm text-slate-400 hover:text-slate-700">
          ← 단어장 선택
        </Link>
        <h1 className="mt-2 text-xl font-bold text-slate-900">{set?.name ?? '단어 외우기'}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {loading ? '불러오는 중...' : `${entries.length}개 단어 · 랭킹에 반영되지 않아요`}
        </p>

        <section className="mt-6">
          <h2 className="text-sm font-semibold text-slate-700">방식</h2>
          <div className="mt-2 space-y-2">
            {MODE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${
                  mode === opt.value ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <span className="font-medium text-slate-800">{opt.label}</span>
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
          onClick={handleStart}
          disabled={loading || entries.length === 0}
          className="mt-8 w-full rounded-full bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          외우기 시작
        </button>
      </div>
    )
  }

  if (index >= queue.length) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm text-slate-500">완료!</p>
          <p className="mt-1 text-4xl font-extrabold text-indigo-600">
            {correctCount} / {queue.length}
          </p>
          <p className="mt-2 text-xs text-slate-400">랭킹에는 반영되지 않아요</p>
        </div>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={handleRestart}
            className="flex-1 rounded-full border border-slate-300 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            다시 외우기
          </button>
          <Link
            to="/word-study"
            className="flex-1 rounded-full bg-indigo-600 py-3 text-center text-sm font-semibold text-white hover:bg-indigo-700"
          >
            단어장 선택
          </Link>
        </div>
      </div>
    )
  }

  const prompt = mode === 'en2ko' ? question!.word : question!.meaning
  const placeholder = mode === 'en2ko' ? '뜻을 입력하세요' : '영단어를 입력하세요'
  const correctAnswerText = mode === 'en2ko' ? question!.meaning : question!.word

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
        <span>
          {index + 1} / {queue.length}
        </span>
        <span>
          맞은 개수 {correctCount}/{index + (checked ? 1 : 0)}
        </span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-400">
          {mode === 'en2ko' ? '이 단어의 뜻은?' : '이 뜻에 해당하는 단어는?'}
        </p>
        <p className="mt-3 text-2xl font-bold text-slate-900 break-keep">{prompt}</p>
      </div>

      {checked ? (
        <div className="mt-6">
          <div
            className={`rounded-xl border px-4 py-3 text-center text-sm ${
              checked.correct ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-600'
            }`}
          >
            {checked.correct ? (
              '정답입니다!'
            ) : (
              <>
                오답입니다. 정답: <span className="font-semibold">{correctAnswerText}</span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={handleNext}
            className="mt-4 w-full rounded-full bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            다음 단어
          </button>
        </div>
      ) : (
        <form
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault()
            handleCheck()
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
          />
          {answerError && <p className="mt-2 text-sm text-red-600">답을 입력하거나 모르겠어요를 눌러주세요.</p>}
          <button
            type="submit"
            className="mt-4 w-full rounded-full bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            확인
          </button>
          <button
            type="button"
            onClick={handleDontKnow}
            className="mt-2 w-full rounded-full py-2 text-xs font-medium text-slate-400 hover:text-slate-600"
          >
            모르겠어요
          </button>
        </form>
      )}
    </div>
  )
}
