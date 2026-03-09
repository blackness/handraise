import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export function StudentLoginPage() {
  const { signInStudent } = useAuth()
  const navigate = useNavigate()
  const [studentId, setStudentId] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Institutions list for the selector - fetched on mount
  const [institutions, setInstitutions] = useState([])
  const [institutionId, setInstitutionId] = useState('')

  // Load institutions on mount (public read needed - adjust RLS if required)
  useEffect(() => {
    supabase
      .from('institutions')
      .select('id, name')
      .eq('status', 'active')
      .order('name')
      .then(({ data }) => {
        if (data) setInstitutions(data)
        if (data?.length === 1) setInstitutionId(data[0].id) // auto-select if only one
      })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!institutionId) {
      setError('Please select your organisation.')
      return
    }

    setLoading(true)
    const { error } = await signInStudent(institutionId, studentId.trim(), pin)

    if (error) {
      setError('Invalid Student ID or PIN. Please try again.')
      setLoading(false)
    } else {
      navigate('/session')
    }
  }

  return (
    <div className="min-h-screen bg-brand-500 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-5xl">✋</span>
          <h1 className="text-3xl font-bold text-white mt-3">HandRaise</h1>
          <p className="text-brand-200 mt-1">Student Login</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">

            {institutions.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organisation
                </label>
                <select
                  className="input bg-white"
                  value={institutionId}
                  onChange={e => setInstitutionId(e.target.value)}
                  required
                >
                  <option value="">Select your organisation…</option>
                  {institutions.map(inst => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Student ID
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. STU001"
                value={studentId}
                onChange={e => setStudentId(e.target.value)}
                required
                autoFocus
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PIN</label>
              <input
                type="password"
                inputMode="numeric"
                className="input tracking-widest text-center text-xl"
                placeholder="• • • •"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                required
                maxLength={8}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full text-lg py-4"
            >
              {loading ? 'Signing in…' : 'Join Session'}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-gray-100 text-center">
            <Link to="/login" className="text-sm text-gray-400 hover:text-gray-600">
              Admin / Teacher login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
