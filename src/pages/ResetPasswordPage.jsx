import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [ready, setReady]         = useState(false)

  useEffect(() => {
    // Supabase puts the token in the URL hash — wait for the session to be set
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 6)  { setError('Password must be at least 6 characters.'); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      navigate('/login')
    }
  }

  return (
    <div className="min-h-screen bg-brand-500 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-5xl">✋</span>
          <h1 className="text-3xl font-bold text-white mt-3">HandRaise</h1>
          <p className="text-brand-200 mt-1">Set new password</p>
        </div>

        <div className="card">
          {!ready ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-500 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Verifying reset link…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input type="password" className="input" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                  required minLength={6} autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input type="password" className="input" placeholder="••••••••"
                  value={confirm} onChange={e => setConfirm(e.target.value)}
                  required minLength={6} />
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Saving…' : 'Set Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
