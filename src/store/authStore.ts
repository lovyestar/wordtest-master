import { create } from 'zustand'
import type { User } from 'firebase/auth'
import type { AdminProfile, UserProfile } from '../types'

interface AuthState {
  firebaseUser: User | null
  profile: UserProfile | null
  profileLoading: boolean
  adminProfile: AdminProfile | null
  loading: boolean
  setAuth: (partial: Partial<AuthState>) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  profile: null,
  profileLoading: true,
  adminProfile: null,
  loading: true,
  setAuth: (partial) => set(partial),
  reset: () => set({ firebaseUser: null, profile: null, profileLoading: true, adminProfile: null, loading: false }),
}))
