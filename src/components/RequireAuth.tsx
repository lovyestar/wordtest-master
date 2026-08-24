import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import FullScreenSpinner from './FullScreenSpinner'

export default function RequireAuth() {
  const { firebaseUser, loading } = useAuthStore()

  if (loading) return <FullScreenSpinner />
  if (!firebaseUser) return <Navigate to="/" replace />

  return <Outlet />
}
