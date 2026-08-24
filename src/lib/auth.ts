import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth'
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

export async function signInAdmin(email: string, password: string) {
  const result = await signInWithEmailAndPassword(auth, email, password)
  return result.user
}

// Self-registers a teacher account. This does NOT grant admin access by
// itself — it creates a `teacherApplications` doc that an existing admin
// must approve (via the reviewTeacherApplication Cloud Function) before
// the account can reach any /teacher route.
export async function signUpTeacher(email: string, password: string, name: string) {
  const result = await createUserWithEmailAndPassword(auth, email, password)
  const user = result.user
  await updateProfile(user, { displayName: name })
  await setDoc(doc(db, 'teacherApplications', user.uid), {
    uid: user.uid,
    email,
    name,
    status: 'pending',
    requestedAt: serverTimestamp(),
  })
  return user
}

export async function signOutUser() {
  await signOut(auth)
}
