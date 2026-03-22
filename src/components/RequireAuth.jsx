import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const STUDENT_SESSION_KEY = 'hr_student_session'

export function RequireAuth({ children, allowedRoles }) {
  const { isAuthenticated, role, loading } = useAuth()

  // Check localStorage directly for student session — covers the case where
  // React state hasn't updated yet immediately after signInStudent()
  const storedStudent = (() => {
    try { return JSON.parse(localStorage.getItem(STUDENT_SESSION_KEY)) } catch { return null }
  })()
  const effectiveRole = role || (storedStudent ? 'student' : null)
  const effectiveAuth = isAuthenticated || !!storedStudent

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
    </div>
  )

  if (!effectiveAuth) return <Navigate to="/login" replace />

  if (allowedRoles && !allowedRoles.includes(effectiveRole)) {
    return <Navigate to="/unauthorized" replace />
  }

  return children
}
