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

export const reviewTeacherApplicationFn = httpsCallable<
  { uid: string; approve: boolean },
  { status: 'approved' | 'rejected' }
>(functions, 'reviewTeacherApplication')

export const removeAdminFn = httpsCallable<{ uid: string }, { removed: boolean }>(functions, 'removeAdmin')

export const generateMissingPronunciationsFn = httpsCallable<
  { wordSetId: string },
  { total: number; generated: number; failed: number }
>(functions, 'generateMissingPronunciations', { timeout: 540_000 })
