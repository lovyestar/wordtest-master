import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider()
  const hd = import.meta.env.VITE_GOOGLE_HD
  if (hd) provider.setCustomParameters({ hd })

  const result = await signInWithPopup(auth, provider)
  const user = result.user

  // Deliberately not copying user.displayName from the Google profile —
  // students set their own real name + student ID on first login instead
  // (see OnboardingPage), so the ranking/exam nickname is always identifiable.
  const userRef = doc(db, 'users', user.uid)
  const existing = await getDoc(userRef)
  await setDoc(
    userRef,
    {
      email: user.email ?? '',
      photoURL: user.photoURL ?? null,
      lastLoginAt: serverTimestamp(),
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  )

  return user
}

// Teachers sign in with the same Google flow as students (signInWithGoogle
// above) — this only submits the pending approval request, using whichever
// Google account is already signed in. It also stamps the student-facing
// profile with a "{name} 선생님" nickname and an isTeacher flag so the
// same account can use the regular tabs without being asked for a
// student ID (see RequireProfile).
export async function submitTeacherApplication(name: string) {
  const user = auth.currentUser
  if (!user) throw new Error('로그인이 필요합니다.')
  const trimmedName = name.trim()

  await setDoc(doc(db, 'teacherApplications', user.uid), {
    uid: user.uid,
    email: user.email ?? '',
    name: trimmedName,
    status: 'pending',
    requestedAt: serverTimestamp(),
  })

  await setDoc(
    doc(db, 'users', user.uid),
    {
      name: trimmedName,
      displayName: `${trimmedName} 선생님`,
      isTeacher: true,
      email: user.email ?? '',
      photoURL: user.photoURL ?? null,
    },
    { merge: true },
  )
}

export async function signOutUser() {
  await signOut(auth)
}
