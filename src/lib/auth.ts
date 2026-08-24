import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
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

export async function signOutUser() {
  await signOut(auth)
}
