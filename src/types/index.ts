export type ExamMode = 'en2ko' | 'ko2en'
export type ExamSessionMode = ExamMode | 'mixed'
export type ExamSessionStatus = 'draft' | 'open' | 'closed'
export type AttemptStatus = 'in_progress' | 'submitted' | 'disqualified' | 'timed_out'
export type ViolationType = 'visibility_hidden' | 'blur' | 'fullscreen_exit' | 'page_reload'

export interface WordEntry {
  id: string
  word: string
  meaning: string
  order: number
  /** Storage path of the synthesized pronunciation, set by a Cloud Function. */
  audioPath?: string
}

export interface WordSet {
  id: string
  name: string
  description?: string
  active: boolean
  wordCount: number
  createdBy: string
  createdByName?: string
  createdAt: number
}

export interface UserProfile {
  uid: string
  displayName?: string
  name?: string
  studentId?: string
  isTeacher?: boolean
  email: string
  photoURL?: string
  firstPlaceCount?: number
}

export interface AdminProfile {
  uid: string
  email: string
  displayName?: string
  role: 'admin' | 'teacher'
}

export type TeacherApplicationStatus = 'pending' | 'approved' | 'rejected'

export interface TeacherApplication {
  uid: string
  email: string
  name: string
  status: TeacherApplicationStatus
  requestedAt: number
  reviewedAt?: number
  reviewedBy?: string
}

export interface MockExamQuestion {
  entryId: string
  word: string
  meaning: string
}

export interface MockExamAnswer {
  entryId: string
  answer: string
}

export interface GradedAnswer {
  entryId: string
  word: string
  meaning: string
  answer: string
  correct: boolean
}

export interface MockExamAttempt {
  id: string
  uid: string
  wordSetId: string
  mode: ExamMode
  totalQuestions: number
  correctCount: number
  wrongCount: number
  accuracy: number
  submittedAt: number
  answers: GradedAnswer[]
}

export interface LeaderboardEntry {
  uid: string
  displayName: string
  photoURL?: string
  bestAccuracy: number
  correctCount: number
  wrongCount: number
  totalQuestions: number
  updatedAt: number
}

export interface ExamSession {
  id: string
  name: string
  wordSetId: string
  wordSetName?: string
  createdBy: string
  createdByName?: string
  createdAt: number
  durationSeconds: number
  questionCount: number
  mode: ExamSessionMode
  status: ExamSessionStatus
  openedAt?: number
  closedAt?: number
}

export interface ExamQuestion {
  entryId: string
  word: string
  meaning: string
  direction: ExamMode
}

export interface ExamAttempt {
  uid: string
  studentName: string
  wordSetId: string
  questions: ExamQuestion[]
  status: AttemptStatus
  activeSessionToken: string
  startedAt: number
  submittedAt?: number
  correctCount?: number
  wrongCount?: number
  accuracy?: number
  answers?: GradedAnswer[]
  disqualifiedAt?: number
  disqualifiedReason?: ViolationType
}

export type ViolationLogType = ViolationType | 'returned'

/** Context captured on the student's device at the moment of a violation. */
export interface ViolationDetail {
  /** Seconds since the exam screen opened. */
  elapsedSec: number
  questionNumber: number
  visibility: string
  hasFocus: boolean
  fullscreen: boolean
  online: boolean
  viewport: string
  screen: string
  userAgent: string
  /** Client wall-clock time (ISO); the trusted time is `at`. */
  clientTime: string
  /** Seconds the student was away (type === 'returned' only). */
  awaySec?: number
  /** Last events leading up to the violation, newest last, e.g. "-0.4s key Ctrl+T". */
  recent: string[]
}

export interface ExamViolation {
  id: string
  type: ViolationLogType
  at: number
  detail?: ViolationDetail
}
