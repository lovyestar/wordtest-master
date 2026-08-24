import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect } from 'react'
import { auth, db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import type { AdminProfile, UserProfile } from '../types'

export function useAuthListener() {
  useEffect(() => {
    const setAuth = useAuthStore.getState().setAuth

    let unsubUser: (() => void) | undefined
    let unsubAdmin: (() => void) | undefined

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      unsubUser?.()
      unsubAdmin?.()

      if (!firebaseUser) {
        useAuthStore.getState().reset()
        return
      }

      setAuth({ firebaseUser, loading: false, profileLoading: true })

      unsubUser = onSnapshot(doc(db, 'users', firebaseUser.uid), (snap) => {
        setAuth({
          profile: snap.exists() ? ({ uid: snap.id, ...snap.data() } as UserProfile) : null,
          profileLoading: false,
        })
      })

      unsubAdmin = onSnapshot(doc(db, 'admins', firebaseUser.uid), (snap) => {
        setAuth({
          adminProfile: snap.exists() ? ({ uid: snap.id, ...snap.data() } as AdminProfile) : null,
        })
      })
    })

    return () => {
      unsubAuth()
      unsubUser?.()
      unsubAdmin?.()
    }
  }, [])
}
