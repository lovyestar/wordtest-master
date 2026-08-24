import { cert, getApps, initializeApp } from 'firebase-admin/app'

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
if (!keyPath) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS 환경변수에 서비스 계정 키 JSON 경로를 지정해주세요.')
  process.exit(1)
}

export const adminApp = getApps()[0] ?? initializeApp({ credential: cert(keyPath) })
