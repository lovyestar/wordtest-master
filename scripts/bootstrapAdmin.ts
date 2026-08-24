import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { adminApp } from './adminApp.js'

const [, , email, password, displayName] = process.argv

if (!email || !password) {
  console.error('사용법: npx tsx scripts/bootstrapAdmin.ts <email> <password> [displayName]')
  process.exit(1)
}

async function main() {
  const auth = getAuth(adminApp)
  const db = getFirestore(adminApp)

  const user = await auth
    .getUserByEmail(email)
    .catch(() => auth.createUser({ email, password, displayName: displayName ?? undefined }))

  await db.collection('admins').doc(user.uid).set({
    email,
    displayName: displayName ?? null,
    role: 'admin',
    createdAt: new Date(),
    createdBy: 'bootstrap-script',
  })

  console.log(`관리자 계정 생성/등록 완료: ${email} (uid: ${user.uid})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
