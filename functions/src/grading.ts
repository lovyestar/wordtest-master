export type ExamDirection = 'en2ko' | 'ko2en'

export function normalizeAnswer(input: string): string {
  return input.trim().replace(/\s+/g, ' ')
}

// Meanings are printed as comma-separated alternatives (e.g. "포기하다, 버리다").
// Any one of the listed alternatives counts as correct on its own — but
// nothing outside that explicit list (no fuzzy/synonym leniency).
export function isCorrectAnswer(
  direction: ExamDirection,
  submitted: string,
  word: string,
  meaning: string,
): boolean {
  const given = normalizeAnswer(submitted ?? '')
  if (direction === 'en2ko') {
    const validAnswers = meaning.split(',').map((part) => normalizeAnswer(part))
    return validAnswers.includes(given)
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
