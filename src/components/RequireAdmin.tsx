import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import FullScreenSpinner from './FullScreenSpinner'

export default function RequireAdmin() {
  const { firebaseUser, adminProfile, loading } = useAuthStore()

  if (loading) return <FullScreenSpinner />
  if (!firebaseUser || !adminProfile) return <Navigate to="/teacher/login" replace />

  return <Outlet />
}
