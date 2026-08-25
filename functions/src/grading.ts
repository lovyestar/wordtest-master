export type ExamDirection = 'en2ko' | 'ko2en'

export function normalizeAnswer(input: string): string {
  return input.trim().replace(/\s+/g, ' ')
}

// Meanings are printed as comma-separated alternatives (e.g. "포기하다, 버리다"),
// sometimes with a parenthetical object/context marker (e.g. "(미래를) 짊어지다").
// Any one alternative counts as correct on its own, and so does the same
// alternative with its parenthetical prefix dropped — but nothing outside
// that explicit list (no fuzzy/synonym leniency).
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

export function isCorrectAnswer(
  direction: ExamDirection,
  submitted: string,
  word: string,
  meaning: string,
): boolean {
  const given = normalizeAnswer(submitted ?? '')
  if (direction === 'en2ko') {
    return meaningVariants(meaning).includes(given)
  }
  return given.toLowerCase() === normalizeAnswer(word).toLowerCase()
}

// KST (Asia/Seoul) date key, independent of the server's own timezone,
// so the daily leaderboard resets at Korean midnight regardless of where
// the Cloud Function region runs.
export function getKstDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}
