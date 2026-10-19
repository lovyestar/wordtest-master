import { useState } from 'react'
import { playPronunciation } from '../lib/pronunciation'

interface Props {
  audioPath?: string
  word: string
  size?: 'sm' | 'lg'
  className?: string
}

// Renders nothing until the Cloud Function has attached audio to the word,
// so a just-added word simply gets its button a few seconds later.
export default function SpeakButton({ audioPath, word, size = 'sm', className = '' }: Props) {
  const [failed, setFailed] = useState(false)
  if (!audioPath) return null

  const iconSize = size === 'lg' ? 'h-6 w-6' : 'h-4 w-4'
  const padding = size === 'lg' ? 'p-2' : 'p-1.5'

  return (
    <button
      type="button"
      aria-label={`${word} 발음 듣기`}
      title={failed ? '재생하지 못했어요. 다시 눌러주세요.' : '발음 듣기'}
      onClick={(e) => {
        e.stopPropagation()
        setFailed(false)
        playPronunciation(audioPath).catch(() => setFailed(true))
      }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${padding} transition hover:bg-indigo-50 ${
        failed ? 'text-red-400' : 'text-slate-400 hover:text-indigo-600'
      } ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={iconSize} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5 6 9H3v6h3l5 4V5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
      </svg>
    </button>
  )
}
