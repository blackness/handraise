import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export function StudentLoginPage() {
  const { signInStudent } = useAuth()
  const navigate = useNavigate()

  const [step, setStep]                   = useState('login')   // 'login' | 'location'
  const [studentId, setStudentId]         = useState('')
  const [pin, setPin]                     = useState('')
  const [error, setError]                 = useState('')
  const [loading, setLoading]             = useState(false)
  const [institutions, setInstitutions]   = useState([])
  const [institutionId, setInstitutionId] = useState('')
  const [locations, setLocations]         = useState([])
  const [locationsLoading, setLocationsLoading] = useState(false)
  const [location, setLocation]           = useState('')
  const [pendingStudent, setPendingStudent] = useState(null) // after login, before location confirm

  useEffect(() => {
    supabase.from('institutions').select('id, name').eq('status', 'active').order('name')
      .then(async ({ data }) => {
        if (!data?.length) return
        setInstitutions(data)
        const instId = data.length === 1 ? data[0].id : null
        if (instId) {
          setInstitutionId(instId)
          setLocationsLoading(true)
          const { data: locs } = await supabase.from('locations').select('id, name').eq('institution_id', instId).order('name')
          setLocations(locs || [])
          setLocationsLoading(false)
        }
      })
  }, [])

  // Load locations when institution is manually selected from dropdown
  useEffect(() => {
    if (!institutionId || institutions.length <= 1) return
    setLocationsLoading(true)
    supabase.from('locations').select('id, name').eq('institution_id', institutionId).order('name')
      .then(({ data }) => { setLocations(data || []); setLocationsLoading(false) })
  }, [institutionId])

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    if (!institutionId) { setError('Please select your organisation.'); return }
    setLoading(true)

    const { data, error } = await signInStudent(institutionId, studentId.trim(), pin)
    if (error) {
      setError('Invalid Student ID or PIN. Please try again.')
      setLoading(false)
      return
    }

    // If locations exist, go to location step
    if (locations.length > 0) {
      setPendingStudent(data)
      setLocation(data?.profile?.location || locations[0]?.name || '')
      setStep('location')
      setLoading(false)
    } else {
      window.location.href = '/session'
    }
  }

  async function handleLocationConfirm(e) {
    e.preventDefault()
    setLoading(true)

    // Update student's location if changed
    if (pendingStudent?.profile?.id && location) {
      await supabase.from('student_profiles')
        .update({ location })
        .eq('id', pendingStudent.profile.id)
    }

    window.location.href = '/session'
  }

  if (step === 'location') return (
    <div className="min-h-screen bg-brand-500 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-5xl">✋</span>
          <h1 className="text-3xl font-bold text-white mt-3">HandRaise</h1>
          <p className="text-brand-200 mt-1">Confirm your location</p>
        </div>
        <div className="card">
          <form onSubmit={handleLocationConfirm} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Where are you joining from?</label>
              <select className="input bg-white" value={location} onChange={e => setLocation(e.target.value)} required>
                <option value="">Select location…</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.name}>{loc.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Defaults to your profile location. Change if you're travelling.</p>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full text-lg py-4">
              {loading ? 'Joining…' : 'Join Session'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-brand-500 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-5xl">✋</span>
          <h1 className="text-3xl font-bold text-white mt-3">HandRaise</h1>
          <p className="text-brand-200 mt-1">Student Login</p>
        </div>
        <div className="card">
          <form onSubmit={handleLogin} className="space-y-4">
            {institutions.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organisation</label>
                <select className="input bg-white" value={institutionId}
                  onChange={e => setInstitutionId(e.target.value)} required>
                  <option value="">Select your organisation…</option>
                  {institutions.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student ID</label>
              <input type="text" className="input" placeholder="e.g. STU001" value={studentId}
                onChange={e => setStudentId(e.target.value)} required autoFocus autoCapitalize="off" autoCorrect="off" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PIN</label>
              <input type="password" inputMode="numeric" className="input tracking-widest text-center text-xl"
                placeholder="• • • •" value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} required maxLength={8} />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading || locationsLoading} className="btn-primary w-full text-lg py-4">
              {loading ? 'Signing in…' : locationsLoading ? 'Loading…' : 'Join Session'}
            </button>
          </form>
          <div className="mt-5 pt-5 border-t border-gray-100 text-center">
            <Link to="/login" className="text-sm text-gray-400 hover:text-gray-600">Admin / Teacher login →</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
