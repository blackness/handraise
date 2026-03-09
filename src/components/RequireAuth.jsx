import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// Redirects to login if not authenticated or wrong role
export function RequireAuth({ children, allowedRoles }) {
  const { isAuthenticated, role, loading } = useAuth()

  if (loading) return <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
  </div>

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return children
}
