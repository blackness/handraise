import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { AdminLayout } from '../../components/layout/AdminLayout'

export function AdminProfile() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName]     = useState('')
  const [saving, setSaving]         = useState(false)
  const [msg, setMsg]               = useState('')
  const [error, setError]           = useState('')

  const [currentPw, setCurrentPw]   = useState('')
  const [newPw, setNewPw]           = useState('')
  const [confirmPw, setConfirmPw]   = useState('')
  const [savingPw, setSavingPw]     = useState(false)
  const [pwMsg, setPwMsg]           = useState('')
  const [pwError, setPwError]       = useState('')

  useEffect(() => {
    supabase
      .from('admin_profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => { if (data) setFullName(data.full_name || '') })
  }, [])

  async function handleSaveProfile(e) {
    e.preventDefault()
    setSaving(true); setMsg(''); setError('')
    const { error } = await supabase
      .from('admin_profiles')
      .update({ full_name: fullName.trim() })
      .eq('user_id', user.id)
    if (error) setError(error.message)
    else setMsg('Profile saved!')
    setSaving(false)
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    setPwMsg(''); setPwError('')
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return }
    if (newPw.length < 6)    { setPwError('Password must be at least 6 characters.'); return }

    setSavingPw(true)

    // Verify current password by re-signing in
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPw,
    })

    if (signInErr) { setPwError('Current password is incorrect.'); setSavingPw(false); return }

    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) setPwError(error.message)
    else {
      setPwMsg('Password updated!')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    }
    setSavingPw(false)
  }

  return (
    <AdminLayout>
      <div className="p-8 max-w-lg mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-500 mt-1">{user?.email}</p>
        </div>

        {/* Profile */}
        <div className="card mb-5">
          <h2 className="font-semibold text-gray-900 mb-4">Profile</h2>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input className="input" value={fullName}
                onChange={e => setFullName(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input className="input bg-gray-50 text-gray-400" value={user?.email} disabled />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            {msg   && <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">{msg}</p>}
            <button type="submit" disabled={saving} className="btn-primary w-full">
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
          </form>
        </div>

        {/* Password */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Change Password</h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input type="password" className="input" placeholder="••••••••"
                value={currentPw} onChange={e => setCurrentPw(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input type="password" className="input" placeholder="••••••••"
                value={newPw} onChange={e => setNewPw(e.target.value)} required minLength={6} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input type="password" className="input" placeholder="••••••••"
                value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required minLength={6} />
            </div>
            {pwError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{pwError}</p>}
            {pwMsg   && <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">{pwMsg}</p>}
            <button type="submit" disabled={savingPw} className="btn-primary w-full">
              {savingPw ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </AdminLayout>
  )
}
