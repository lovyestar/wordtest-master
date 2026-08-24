import { readFileSync } from 'node:fs'
import { getFirestore } from 'firebase-admin/firestore'
import { adminApp } from './adminApp.js'

const SOURCE_PATH =
  process.argv[2] ??
  '/private/tmp/claude-501/-Users-lovyestar-Pr-engkm-master/fc09e79d-0298-40de-833d-e425a64eaa36/scratchpad/entries_final.json'

interface RawEntry {
  word: string
  meaning: string
}

async function main() {
  const db = getFirestore(adminApp)
  const raw = JSON.parse(readFileSync(SOURCE_PATH, 'utf-8')) as RawEntry[]
  console.log(`${raw.length}개 단어를 불러왔습니다.`)

  const setRef = db.collection('wordSets').doc()
  await setRef.set({
    name: '광명고 영단어 (2022~2026 5년치)',
    description: 'PDF에서 추출한 기본 단어장',
    isDefault: true,
    active: true,
    wordCount: raw.length,
    createdBy: 'seed-script',
    createdAt: new Date(),
  })
  console.log(`단어장 생성됨: ${setRef.id}`)

  const CHUNK = 400
  for (let i = 0; i < raw.length; i += CHUNK) {
    const batch = db.batch()
    const chunk = raw.slice(i, i + CHUNK)
    chunk.forEach((entry, j) => {
      const entryRef = setRef.collection('entries').doc()
      batch.set(entryRef, { word: entry.word, meaning: entry.meaning, order: i + j })
    })
    await batch.commit()
    console.log(`${i + chunk.length}/${raw.length} 저장 완료`)
  }

  console.log('시딩 완료')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
