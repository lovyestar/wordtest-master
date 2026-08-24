// Mirrors functions/src/grading.ts#getKstDateKey so the client shows the
// same "today" the server used when aggregating the leaderboard.
export function getKstDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}
