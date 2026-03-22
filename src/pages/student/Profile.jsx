import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export function StudentProfile() {
  const { student, signOut, refreshStudent } = useAuth()
  const navigate = useNavigate()
  const profile = student?.profile

  const [form, setForm]             = useState({ full_name: '', company: '', work_position: '', location: '' })
  const [locations, setLocations]   = useState([])
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin]         = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [saving, setSaving]         = useState(false)
  const [savingPin, setSavingPin]   = useState(false)
  const [msg, setMsg]               = useState('')
  const [pinMsg, setPinMsg]         = useState('')
  const [error, setError]           = useState('')
  const [pinError, setPinError]     = useState('')

  // Photo
  const fileRef                         = useRef()
  const imgRef                          = useRef()
  const [imgSrc, setImgSrc]             = useState(null)
  const [crop, setCrop]                 = useState()
  const [completedCrop, setCompletedCrop] = useState()
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  useEffect(() => {
    if (profile) {
      setForm({
        full_name:     profile.full_name || '',
        company:       profile.company || '',
        work_position: profile.work_position || '',
        location:      profile.location || '',
      })

      // Load institution locations
      if (profile.institution_id) {
        supabase.from('locations').select('id, name')
          .eq('institution_id', profile.institution_id).order('name')
          .then(({ data }) => setLocations(data || []))
      }
    }
  }, [profile])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  // ── Save profile ──────────────────────────────────────
  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setMsg('')
    setError('')

    const { error } = await supabase
      .from('student_profiles')
      .update({
        full_name:     form.full_name.trim(),
        company:       form.company.trim() || null,
        work_position: form.work_position.trim() || null,
        location:      form.location || null,
      })
      .eq('id', profile.id)

    if (error) { setError(error.message) }
    else {
      setMsg('Profile saved!')
      if (refreshStudent) await refreshStudent()
    }
    setSaving(false)
  }

  // ── Change PIN ────────────────────────────────────────
  async function handlePinChange(e) {
    e.preventDefault()
    setPinError('')
    setPinMsg('')

    if (newPin.length < 4)          { setPinError('New PIN must be at least 4 digits.'); return }
    if (newPin !== confirmPin)       { setPinError('PINs do not match.'); return }

    setSavingPin(true)

    // Verify current PIN
    const { data: valid } = await supabase.rpc('student_login', {
      p_institution_id: profile.institution_id,
      p_student_id:     profile.student_id,
      p_pin:            currentPin,
    })

    if (!valid?.success) {
      setPinError('Current PIN is incorrect.')
      setSavingPin(false)
      return
    }

    // Hash and save new PIN
    const { data: hashed, error: hashErr } = await supabase.rpc('hash_pin', { p_pin: newPin })
    if (hashErr) { setPinError(hashErr.message); setSavingPin(false); return }

    const { error } = await supabase
      .from('student_profiles')
      .update({ pin_hash: hashed })
      .eq('id', profile.id)

    if (error) { setPinError(error.message) }
    else {
      setPinMsg('PIN updated successfully!')
      setCurrentPin('')
      setNewPin('')
      setConfirmPin('')
    }
    setSavingPin(false)
  }

  // ── Photo upload ──────────────────────────────────────
  function onFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImgSrc(reader.result)
    reader.readAsDataURL(file)
  }

  function onImageLoad(e) {
    const { width, height } = e.currentTarget
    const c = centerCrop(
      makeAspectCrop({ unit: '%', width: 80 }, 1, width, height),
      width, height
    )
    setCrop(c)
  }

  async function uploadCroppedPhoto() {
    if (!completedCrop || !imgRef.current) return
    setUploadingPhoto(true)

    // Draw crop to canvas
    const canvas = document.createElement('canvas')
    const scaleX = imgRef.current.naturalWidth  / imgRef.current.width
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height
    canvas.width  = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    ctx.drawImage(
      imgRef.current,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width  * scaleX,
      completedCrop.height * scaleY,
      0, 0, 256, 256
    )

    // Convert to blob
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85))
    const path = `${profile.institution_id}/${profile.id}/avatar.jpg`

    const { error: uploadErr } = await supabase.storage
      .from('profile-photos')
      .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })

    if (!uploadErr) {
      const { data: { publicUrl } } = supabase.storage.from('profile-photos').getPublicUrl(path)
      await supabase.from('student_profiles')
        .update({ profile_photo_url: publicUrl + '?t=' + Date.now() })
        .eq('id', profile.id)
      if (refreshStudent) await refreshStudent()
      setImgSrc(null)
      setMsg('Photo updated!')
    }

    setUploadingPhoto(false)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/join')
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
        <button onClick={() => navigate('/session')} className="text-brand-500 text-sm font-medium">
          ← Back to session
        </button>
        <button onClick={handleSignOut} className="text-gray-400 text-sm hover:text-gray-600">
          Sign out
        </button>
      </div>

      <div className="max-w-lg mx-auto px-5 py-8 space-y-6">

        {/* Avatar */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-full bg-brand-500 flex items-center justify-center text-white text-3xl font-bold overflow-hidden">
            {profile?.profile_photo_url
              ? <img src={profile.profile_photo_url} alt="" className="w-full h-full object-cover" />
              : profile?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
            }
          </div>

          {!imgSrc && (
            <>
              <button onClick={() => fileRef.current.click()} className="text-sm text-brand-500 font-medium hover:underline">
                Change photo
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
            </>
          )}

          {/* Crop UI */}
          {imgSrc && (
            <div className="w-full space-y-3">
              <ReactCrop
                crop={crop}
                onChange={c => setCrop(c)}
                onComplete={c => setCompletedCrop(c)}
                aspect={1}
                circularCrop
              >
                <img ref={imgRef} src={imgSrc} onLoad={onImageLoad} className="max-w-full rounded-xl" />
              </ReactCrop>
              <div className="flex gap-2">
                <button
                  onClick={uploadCroppedPhoto}
                  disabled={uploadingPhoto}
                  className="btn-primary text-sm flex-1"
                >
                  {uploadingPhoto ? 'Uploading…' : 'Save photo'}
                </button>
                <button onClick={() => setImgSrc(null)} className="btn-secondary text-sm">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Profile form */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Profile</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input className="input" value={form.full_name}
                onChange={e => set('full_name', e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
              <input className="input" placeholder="Optional" value={form.company}
                onChange={e => set('company', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Work Position</label>
              <input className="input" placeholder="Optional" value={form.work_position}
                onChange={e => set('work_position', e.target.value)} />
            </div>
            {locations.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <select className="input bg-white" value={form.location} onChange={e => set('location', e.target.value)}>
                  <option value="">Select location…</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.name}>{loc.name}</option>
                  ))}
                </select>
              </div>
            )}

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            {msg   && <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">{msg}</p>}

            <button type="submit" disabled={saving} className="btn-primary w-full">
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
          </form>
        </div>

        {/* PIN change */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Change PIN</h2>
          <form onSubmit={handlePinChange} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current PIN</label>
              <input className="input tracking-widest text-center" inputMode="numeric"
                placeholder="• • • •" value={currentPin}
                onChange={e => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                required minLength={4} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New PIN</label>
              <input className="input tracking-widest text-center" inputMode="numeric"
                placeholder="• • • •" value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                required minLength={4} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New PIN</label>
              <input className="input tracking-widest text-center" inputMode="numeric"
                placeholder="• • • •" value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                required minLength={4} />
            </div>

            {pinError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{pinError}</p>}
            {pinMsg   && <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">{pinMsg}</p>}

            <button type="submit" disabled={savingPin} className="btn-primary w-full">
              {savingPin ? 'Updating…' : 'Update PIN'}
            </button>
          </form>
        </div>

        {/* Student ID info */}
        <div className="text-center text-xs text-gray-300 pb-4">
          Student ID: <span className="font-mono">{profile?.student_id}</span>
        </div>

      </div>
    </div>
  )
}
