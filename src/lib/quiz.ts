export const DEFAULT_MOCK_EXAM_QUESTION_COUNT = 50
// Infinity stands in for "전체" (all words in the set).
export const QUESTION_COUNT_OPTIONS = [10, 20, 50, 100, Infinity]

export function shuffle<T>(items: T[]): T[] {
  const pool = [...items]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool
}

export function sampleQuestions<T>(items: T[], count: number): T[] {
  return shuffle(items).slice(0, Math.min(count, items.length))
}
