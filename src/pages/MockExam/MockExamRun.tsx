import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { submitMockExamAttemptFn } from '../../lib/functionsClient'
import type { ExamMode, MockExamQuestion } from '../../types'

interface RunState {
  wordSetId: string
  mode: ExamMode
  questions: MockExamQuestion[]
}

export default function MockExamRun() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as RunState | null

  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [answerError, setAnswerError] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!state || state.questions.length === 0) {
    navigate('/mock-exam', { replace: true })
    return null
  }

  const { wordSetId, mode, questions } = state
  const question = questions[index]
  const isLast = index === questions.length - 1
  const prompt = mode === 'en2ko' ? question.word : question.meaning
  const placeholder = mode === 'en2ko' ? '뜻을 입력하세요' : '영단어를 입력하세요'

  async function advance(value: string) {
    const nextAnswers = { ...answers, [question.entryId]: value.trim() }
    setAnswers(nextAnswers)
    setAnswer('')
    setAnswerError(false)

    if (!isLast) {
      setIndex((i) => i + 1)
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const payload = questions.map((q) => ({ entryId: q.entryId, answer: nextAnswers[q.entryId] ?? '' }))
      const res = await submitMockExamAttemptFn({ wordSetId, mode, answers: payload })
      navigate(`/mock-exam/result/${res.data.attemptId}`, { state: res.data })
    } catch {
      setError('채점 중 오류가 발생했습니다. 다시 시도해주세요.')
      setSubmitting(false)
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
      <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
        <span>
          {index + 1} / {questions.length}
        </span>
        <div className="h-1.5 flex-1 mx-3 rounded-full bg-slate-200">
          <div
            className="h-1.5 rounded-full bg-indigo-500 transition-all"
            style={{ width: `${((index + (isLast ? 1 : 0)) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-400">
          {mode === 'en2ko' ? '이 단어의 뜻은?' : '이 뜻에 해당하는 단어는?'}
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

      {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
    </div>
  )
}
