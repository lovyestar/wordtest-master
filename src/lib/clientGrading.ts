import type { ExamMode } from '../types'

// Mirrors functions/src/grading.ts — duplicated because the study mode
// grades locally (no server round trip: nothing here is ever submitted or
// scored, so there's no integrity concern requiring Cloud Functions).
export function normalizeAnswer(input: string): string {
  return input.trim().replace(/\s+/g, ' ')
}

function meaningVariants(meaning: string): string[] {
  const variants = new Set<string>()
  for (const part of meaning.split(',')) {
    const full = normalizeAnswer(part)
    if (full) variants.add(full)
    const stripped = normalizeAnswer(part.replace(/\([^)]*\)/g, ''))
    if (stripped) variants.add(stripped)
  }
  return [...variants]
}

export function isCorrectAnswer(mode: ExamMode, submitted: string, word: string, meaning: string): boolean {
  const given = normalizeAnswer(submitted ?? '')
  if (mode === 'en2ko') {
    return meaningVariants(meaning).includes(given)
  }
  return given.toLowerCase() === normalizeAnswer(word).toLowerCase()
}
