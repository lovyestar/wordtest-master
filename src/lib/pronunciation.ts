const STORAGE_HOST =
  import.meta.env.VITE_USE_EMULATOR === 'true' ? 'http://127.0.0.1:9199' : 'https://firebasestorage.googleapis.com'
const BUCKET = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET

// Built synchronously (no getDownloadURL round trip) so play() runs inside
// the tap handler — iOS Safari refuses to start audio after an await.
// storage.rules makes pronunciations/ publicly readable for this.
export function pronunciationUrl(audioPath: string): string {
  return `${STORAGE_HOST}/v0/b/${BUCKET}/o/${encodeURIComponent(audioPath)}?alt=media`
}

// One shared element: tapping a second word stops the first instead of
// overlapping them.
let player: HTMLAudioElement | null = null

export function playPronunciation(audioPath: string): Promise<void> {
  player ??= new Audio()
  player.pause()
  player.src = pronunciationUrl(audioPath)
  return player.play().catch((err: unknown) => {
    // Interrupted by the next tap — not a playback failure.
    if (err instanceof DOMException && err.name === 'AbortError') return
    throw err
  })
}
