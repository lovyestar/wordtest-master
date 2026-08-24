import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import FullScreenSpinner from './FullScreenSpinner'

export default function RequireProfile() {
  const { profile, profileLoading } = useAuthStore()

  if (profileLoading) return <FullScreenSpinner />
  if (!profile?.studentId || !profile.name) return <Navigate to="/welcome" replace />

  return <Outlet />
}
