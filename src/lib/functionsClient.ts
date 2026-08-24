import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'
import type { ExamMode, GradedAnswer } from '../types'

export interface SubmitResult {
  attemptId?: string
  totalQuestions: number
  correctCount: number
  wrongCount: number
  accuracy: number
  answers: GradedAnswer[]
}

export const submitMockExamAttemptFn = httpsCallable<
  { wordSetId: string; mode: ExamMode; answers: { entryId: string; answer: string }[] },
  SubmitResult
>(functions, 'submitMockExamAttempt')

export const submitExamAttemptFn = httpsCallable<
  { sessionId: string; answers: { entryId: string; answer: string }[] },
  SubmitResult
>(functions, 'submitExamAttempt')
