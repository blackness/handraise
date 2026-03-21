import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

// ─── Student session storage key ────────────────────────────
const STUDENT_SESSION_KEY = 'hr_student_session'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)       // Supabase auth user (admin/teacher/platform owner)
  const [student, setStudent] = useState(null) // PIN-authenticated student
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  // ── Supabase Auth: admin / teacher / platform owner ──────
  useEffect(() => {
    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUserRole(session.user)
      } else {
        // Check for stored student session
        loadStoredStudentSession()
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Redirect to reset page instead of logging in
        window.location.href = '/reset-password'
        return
      }
      if (session?.user) {
        loadUserRole(session.user)
        setStudent(null)
        localStorage.removeItem(STUDENT_SESSION_KEY)
      } else if (!localStorage.getItem(STUDENT_SESSION_KEY)) {
        setUser(null)
        setRole(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadUserRole(authUser) {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', authUser.id)
      .single()

    if (error || !data) {
      console.error('Could not load user role:', error)
      setLoading(false)
      return
    }

    setUser(authUser)
    setRole(data.role)
    setStudent(null)
    setLoading(false)
  }

  // ── Student PIN auth ──────────────────────────────────────
  // Students don't use Supabase Auth. We validate their PIN against
  // student_profiles using an RPC function, then store their profile
  // in localStorage as a lightweight session.

  async function loadStoredStudentSession() {
    const stored = localStorage.getItem(STUDENT_SESSION_KEY)
    if (!stored) {
      setLoading(false)
      return
    }

    try {
      const parsed = JSON.parse(stored)
      // Verify the token is still valid against student_sessions table
      const { data, error } = await supabase
        .from('student_sessions')
        .select('student_id, expires_at')
        .eq('token', parsed.token)
        .single()

      if (error || !data || new Date(data.expires_at) < new Date()) {
        localStorage.removeItem(STUDENT_SESSION_KEY)
        setLoading(false)
        return
      }

      setStudent(parsed)
      setRole('student')
    } catch {
      localStorage.removeItem(STUDENT_SESSION_KEY)
    }

    setLoading(false)
  }

  async function signInWithEmail(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signInStudent(institutionId, studentId, pin) {
    // Call an RPC function that validates the PIN hash server-side
    // and returns a session token. See: supabase/functions/student-login/
    const { data, error } = await supabase.rpc('student_login', {
      p_institution_id: institutionId,
      p_student_id: studentId,
      p_pin: pin
    })

    if (error || !data?.success) {
      return { error: error || new Error('Invalid Student ID or PIN') }
    }

    const studentSession = {
      token: data.token,
      profile: data.profile,  // { id, full_name, company, work_position, profile_photo_url }
      institutionId
    }

    localStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify(studentSession))
    setStudent(studentSession)
    setRole('student')
    setUser(null)

    return { error: null, data: studentSession }
  }

  async function signOut() {
    if (role === 'student') {
      // Invalidate the student token server-side
      if (student?.token) {
        await supabase
          .from('student_sessions')
          .delete()
          .eq('token', student.token)
      }
      localStorage.removeItem(STUDENT_SESSION_KEY)
      setStudent(null)
      setRole(null)
    } else {
      await supabase.auth.signOut()
      setUser(null)
      setRole(null)
    }
  }

  async function refreshStudent() {
    if (!student?.profile?.id) return
    const { data } = await supabase
      .from('student_profiles')
      .select('id, full_name, company, work_position, profile_photo_url, student_id, institution_id')
      .eq('id', student.profile.id)
      .single()
    if (data) {
      const updated = { ...student, profile: data }
      localStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify(updated))
      setStudent(updated)
    }
  }

  const value = {
    user,
    student,
    role,
    loading,
    isAuthenticated: !!(user || student),
    isPlatformOwner: role === 'platform_owner',
    isAdmin: role === 'admin',
    isTeacher: role === 'teacher',
    isStudent: role === 'student',
    signInWithEmail,
    signInStudent,
    signOut,
    refreshStudent,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
