import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import FullScreenSpinner from './FullScreenSpinner'

export default function RequireProfile() {
  const { profile, profileLoading } = useAuthStore()

  if (profileLoading) return <FullScreenSpinner />
  const complete = !!profile?.name && (!!profile.studentId || !!profile.isTeacher)
  if (!complete) return <Navigate to="/welcome" replace />

  return <Outlet />
}
