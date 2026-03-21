import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { RequireAuth } from './components/RequireAuth'

// Auth pages
import { LoginPage } from './pages/LoginPage'
import { StudentLoginPage } from './pages/StudentLoginPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'

// Platform owner
import { PlatformDashboard } from './pages/platform/Dashboard'
import { PlatformInstitutions } from './pages/platform/Institutions'

// Admin
import { AdminDashboard } from './pages/admin/Dashboard'
import { AdminStudents } from './pages/admin/Students'
import { AdminPrograms } from './pages/admin/Programs'
import { AdminSession } from './pages/admin/Session'
import { AdminProfile } from './pages/admin/Profile'

// Teacher
import { TeacherDashboard } from './pages/teacher/Dashboard'
import { TeacherSession } from './pages/teacher/Session'

// Student
import { StudentSession } from './pages/student/Session'
import { StudentProfile } from './pages/student/Profile'

// Presenter screen (no auth required - display only)
import { PresenterScreen } from './pages/PresenterScreen'
import { ViewerScreen } from './pages/ViewerScreen'

function RoleRedirect() {
  const { role, loading } = useAuth()
  if (loading) return null
  if (role === 'platform_owner') return <Navigate to="/platform" replace />
  if (role === 'admin')          return <Navigate to="/admin" replace />
  if (role === 'teacher')        return <Navigate to="/teacher" replace />
  if (role === 'student')        return <Navigate to="/session" replace />
  return <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ── Public ──────────────────────────────────────── */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/join"  element={<StudentLoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Presenter screen — no auth, designed for projector */}
        <Route path="/presenter/:sessionId" element={<PresenterScreen />} />
        <Route path="/viewer/:sessionId"    element={<ViewerScreen />} />

        {/* ── Role redirect from root ──────────────────────── */}
        <Route path="/" element={<RoleRedirect />} />

        {/* ── Platform Owner ──────────────────────────────── */}
        <Route path="/platform" element={
          <RequireAuth allowedRoles={['platform_owner']}>
            <PlatformDashboard />
          </RequireAuth>
        } />
        <Route path="/platform/institutions" element={
          <RequireAuth allowedRoles={['platform_owner']}>
            <PlatformInstitutions />
          </RequireAuth>
        } />

        {/* ── Admin ───────────────────────────────────────── */}
        <Route path="/admin" element={
          <RequireAuth allowedRoles={['admin']}>
            <AdminDashboard />
          </RequireAuth>
        } />
        <Route path="/admin/students" element={
          <RequireAuth allowedRoles={['admin']}>
            <AdminStudents />
          </RequireAuth>
        } />
        <Route path="/admin/programs" element={
          <RequireAuth allowedRoles={['admin']}>
            <AdminPrograms />
          </RequireAuth>
        } />
        <Route path="/admin/session/:sessionId" element={
          <RequireAuth allowedRoles={['admin']}>
            <AdminSession />
          </RequireAuth>
        } />
        <Route path="/admin/profile" element={
          <RequireAuth allowedRoles={['admin']}>
            <AdminProfile />
          </RequireAuth>
        } />

        {/* ── Teacher ─────────────────────────────────────── */}
        <Route path="/teacher" element={
          <RequireAuth allowedRoles={['teacher']}>
            <TeacherDashboard />
          </RequireAuth>
        } />
        <Route path="/teacher/session/:sessionId" element={
          <RequireAuth allowedRoles={['teacher']}>
            <TeacherSession />
          </RequireAuth>
        } />

        {/* ── Student ─────────────────────────────────────── */}
        <Route path="/session" element={
          <RequireAuth allowedRoles={['student']}>
            <StudentSession />
          </RequireAuth>
        } />
        <Route path="/profile" element={
          <RequireAuth allowedRoles={['student']}>
            <StudentProfile />
          </RequireAuth>
        } />

        {/* ── Fallback ─────────────────────────────────────── */}
        <Route path="/unauthorized" element={
          <div className="min-h-screen flex items-center justify-center text-brand-500">
            <p>You don't have access to this page.</p>
          </div>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  )
}
