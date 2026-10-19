import { createHash } from 'node:crypto'
import { TextToSpeechClient } from '@google-cloud/text-to-speech'
import { getStorage } from 'firebase-admin/storage'

// Changing the voice changes every file path (the voice is part of the
// hash), so existing words get re-synthesized by the trigger/backfill
// instead of silently keeping the old voice.
const VOICE = { languageCode: 'en-US', name: 'en-US-Neural2-F' }
const SPEAKING_RATE = 0.9

let ttsClient: TextToSpeechClient | null = null
function getTtsClient(): TextToSpeechClient {
  ttsClient ??= new TextToSpeechClient()
  return ttsClient
}

// What actually gets read aloud. Word entries can carry notes that
// shouldn't be spoken: "(v.)", "[미]", "~에 대해", and dictionary
// placeholders like "sb"/"sth" that TTS would spell out letter by letter.
export function speakableText(word: string): string {
  return word
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/[~…]/g, ' ')
    .replace(/[ᄀ-ᇿ㄰-㆏가-힯]/g, ' ') // Korean notes
    .replace(/\bsb\b/gi, 'somebody')
    .replace(/\bsth\b/gi, 'something')
    .replace(/\//g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,]+|[\s,]+$/g, '')
}

// Same text + same voice → same file, so a word that appears in several
// word sets is synthesized and stored only once.
export function pronunciationPath(word: string): string | null {
  const text = speakableText(word)
  if (!/[A-Za-z]/.test(text)) return null
  const hash = createHash('sha1').update(`${VOICE.name}|${text}`).digest('hex')
  return `pronunciations/${hash}.mp3`
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function synthesize(text: string): Promise<Uint8Array> {
  // A bulk import fires hundreds of triggers at once and can hit the TTS
  // per-minute quota, so back off and retry on RESOURCE_EXHAUSTED (8) and
  // UNAVAILABLE (14) instead of failing the word outright.
  for (let attempt = 0; ; attempt++) {
    try {
      const [response] = await getTtsClient().synthesizeSpeech({
        input: { text },
        voice: VOICE,
        audioConfig: { audioEncoding: 'MP3', speakingRate: SPEAKING_RATE },
      })
      if (!response.audioContent) throw new Error('TTS returned no audio')
      return typeof response.audioContent === 'string'
        ? Buffer.from(response.audioContent, 'base64')
        : response.audioContent
    } catch (err) {
      const code = (err as { code?: number }).code
      if (attempt >= 4 || (code !== 8 && code !== 14)) throw err
      await sleep(1000 * 2 ** attempt + Math.random() * 1000)
    }
  }
}

// Returns the Storage path of the word's audio, generating it if missing.
export async function ensurePronunciation(word: string): Promise<string | null> {
  const path = pronunciationPath(word)
  if (!path) return null
  const file = getStorage().bucket().file(path)
  const [exists] = await file.exists()
  if (!exists) {
    const audio = await synthesize(speakableText(word))
    await file.save(Buffer.from(audio), {
      resumable: false,
      contentType: 'audio/mpeg',
      metadata: { cacheControl: 'public, max-age=31536000, immutable' },
    })
  }
  return path
}
