import type { ExamMode, ExamQuestion, ExamSession, WordEntry } from '../types'
import { sampleQuestions } from './quiz'

export function buildExamQuestions(entries: WordEntry[], session: Pick<ExamSession, 'mode' | 'questionCount'>): ExamQuestion[] {
  const picked = sampleQuestions(entries, session.questionCount)
  return picked.map((entry) => ({
    entryId: entry.id,
    word: entry.word,
    meaning: entry.meaning,
    direction: resolveDirection(session.mode),
  }))
}

function resolveDirection(mode: ExamSession['mode']): ExamMode {
  if (mode === 'mixed') return Math.random() < 0.5 ? 'en2ko' : 'ko2en'
  return mode
}
