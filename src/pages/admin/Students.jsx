import { useEffect, useState, useRef } from 'react'
import Papa from 'papaparse'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { AdminLayout } from '../../components/layout/AdminLayout'

export function AdminStudents() {
  const { user } = useAuth()
  const [students, setStudents] = useState([])
  const [institutionId, setInstitutionId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [view, setView] = useState('list')
  const [selected, setSelected] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: ap } = await supabase
      .from('admin_profiles').select('institution_id').eq('user_id', user.id).single()
    if (!ap) return
    setInstitutionId(ap.institution_id)
    const { data } = await supabase
      .from('student_profiles')
      .select('id, student_id, full_name, company, work_position, team, location, profile_photo_url, active, created_at, enrollments(programs(id, name))')
      .eq('institution_id', ap.institution_id)
      .order('full_name')
    setStudents(data || [])
    setLoading(false)
  }

  async function toggleActive(student) {
    await supabase.from('student_profiles').update({ active: !student.active }).eq('id', student.id)
    loadData()
  }

  const filtered = students.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.student_id.toLowerCase().includes(search.toLowerCase()) ||
    (s.company || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.team || '').toLowerCase().includes(search.toLowerCase())
  )

  const active   = filtered.filter(s => s.active)
  const inactive = filtered.filter(s => !s.active)

  return (
    <AdminLayout>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Students</h1>
            <p className="text-gray-500 mt-1">
              {students.filter(s => s.active).length} active · {students.filter(s => !s.active).length} inactive
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setView('csv')} className="btn-secondary text-sm">↑ Import CSV</button>
            <button onClick={() => setView('add')} className="btn-primary text-sm">+ Add Student</button>
          </div>
        </div>

        {view === 'edit' && selected && (
          <EditStudentForm
            student={selected}
            institutionId={institutionId}
            onDone={() => { setView('list'); setSelected(null); loadData() }}
            onCancel={() => { setView('list'); setSelected(null) }}
          />
        )}
        {view === 'add' && (
          <AddStudentForm institutionId={institutionId}
            onDone={() => { setView('list'); loadData() }} onCancel={() => setView('list')} />
        )}
        {view === 'csv' && (
          <CSVImport institutionId={institutionId}
            onDone={() => { setView('list'); loadData() }} onCancel={() => setView('list')} />
        )}
        {view === 'reset' && selected && (
          <PinResetForm student={selected}
            onDone={() => { setView('list'); setSelected(null) }}
            onCancel={() => { setView('list'); setSelected(null) }} />
        )}

        {view === 'list' && (
          <>
            <div className="mb-5">
              <input className="input max-w-sm" placeholder="Search by name, ID, company or team…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {loading ? (
              <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="card animate-pulse h-16" />)}</div>
            ) : students.length === 0 ? (
              <div className="card border-dashed text-center py-12">
                <p className="text-4xl mb-3">👤</p>
                <p className="text-gray-500 font-medium">No students yet</p>
                <div className="flex gap-2 justify-center mt-4">
                  <button onClick={() => setView('csv')} className="btn-secondary text-sm">↑ Import CSV</button>
                  <button onClick={() => setView('add')} className="btn-primary text-sm">+ Add Student</button>
                </div>
              </div>
            ) : (
              <>
                <StudentTable students={active} onToggle={toggleActive}
                  onEdit={s => { setSelected(s); setView('edit') }}
                  onReset={s => { setSelected(s); setView('reset') }} />
                {inactive.length > 0 && (
                  <div className="mt-8">
                    <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                      Inactive ({inactive.length})
                    </h2>
                    <StudentTable students={inactive} onToggle={toggleActive}
                      onEdit={s => { setSelected(s); setView('edit') }}
                      onReset={s => { setSelected(s); setView('reset') }} dimmed />
                  </div>
                )}
                {filtered.length === 0 && search && (
                  <p className="text-center text-gray-400 py-8">No students match "{search}"</p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  )
}

function StudentTable({ students, onToggle, onReset, onEdit, dimmed }) {
  if (students.length === 0) return null
  return (
    <div className="card p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left px-5 py-3 text-gray-500 font-medium">Student</th>
            <th className="text-left px-5 py-3 text-gray-500 font-medium">ID</th>
            <th className="text-left px-5 py-3 text-gray-500 font-medium hidden md:table-cell">Programs</th>
            <th className="text-left px-5 py-3 text-gray-500 font-medium hidden lg:table-cell">Team / Location</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          {students.map((s, i) => {
            const programs = s.enrollments?.map(e => e.programs?.name).filter(Boolean) || []
            return (
              <tr key={s.id} className={`border-b border-gray-50 ${dimmed ? 'opacity-50' : ''} ${i === students.length - 1 ? 'border-0' : ''}`}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar student={s} size={8} />
                    <button onClick={() => onEdit(s)} className="font-medium text-brand-600 hover:underline text-left">
                      {s.full_name}
                    </button>
                  </div>
                </td>
                <td className="px-5 py-3 text-gray-500 font-mono text-xs">{s.student_id}</td>
                <td className="px-5 py-3 hidden md:table-cell">
                  {programs.length > 0
                    ? <div className="flex flex-wrap gap-1">
                        {programs.map(p => (
                          <span key={p} className="bg-brand-50 text-brand-600 text-xs px-2 py-0.5 rounded-full">{p}</span>
                        ))}
                      </div>
                    : <span className="text-gray-300 text-xs">Not enrolled</span>
                  }
                </td>
                <td className="px-5 py-3 text-gray-400 hidden lg:table-cell">
                  {[s.team, s.location].filter(Boolean).join(' · ') || '—'}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3 justify-end">
                    <button onClick={() => onReset(s)} className="text-xs text-brand-500 hover:underline">Reset PIN</button>
                    <button onClick={() => onToggle(s)} className="text-xs text-gray-400 hover:text-gray-600">
                      {s.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function EditStudentForm({ student, institutionId, onDone, onCancel }) {
  const [form, setForm] = useState({
    full_name:     student.full_name || '',
    student_id:    student.student_id || '',
    company:       student.company || '',
    work_position: student.work_position || '',
    team:          student.team || '',
    location:      student.location || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [locations, setLocations] = useState([])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  useEffect(() => {
    if (!institutionId) return
    supabase.from('locations').select('id, name').eq('institution_id', institutionId).order('name')
      .then(({ data }) => setLocations(data || []))
  }, [institutionId])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setSaving(true)
    const { error } = await supabase.from('student_profiles').update({
      full_name:     form.full_name.trim(),
      student_id:    form.student_id.trim(),
      company:       form.company.trim() || null,
      work_position: form.work_position.trim() || null,
      team:          form.team.trim() || null,
      location:      form.location || null,
    }).eq('id', student.id)
    if (error) { setError(error.message); setSaving(false); return }
    onDone()
  }

  return (
    <div className="card mb-6 border-brand-200 border-2">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold text-gray-900">Edit Profile</h2>
        <span className="text-sm text-gray-400">{student.full_name}</span>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input className="input" value={form.full_name} onChange={e => set('full_name', e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Student ID</label>
            <input className="input" value={form.student_id} onChange={e => set('student_id', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Team <span className="text-gray-400 font-normal">(optional)</span></label>
            <input className="input" placeholder="Team Alpha" value={form.team} onChange={e => set('team', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location <span className="text-gray-400 font-normal">(optional)</span></label>
            {locations.length > 0 ? (
              <select className="input bg-white" value={form.location} onChange={e => set('location', e.target.value)}>
                <option value="">No location</option>
                {locations.map(loc => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
              </select>
            ) : (
              <input className="input" placeholder="Toronto" value={form.location} onChange={e => set('location', e.target.value)} />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company <span className="text-gray-400 font-normal">(optional)</span></label>
            <input className="input" placeholder="Acme Corp" value={form.company} onChange={e => set('company', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Work Position <span className="text-gray-400 font-normal">(optional)</span></label>
            <input className="input" placeholder="Senior Manager" value={form.work_position} onChange={e => set('work_position', e.target.value)} />
          </div>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Changes'}</button>
          <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  )
}

function Avatar({ student, size = 8 }) {
  const initials = student.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className={`avatar w-${size} h-${size} text-xs flex-shrink-0`}>
      {student.profile_photo_url
        ? <img src={student.profile_photo_url} alt={student.full_name} className="w-full h-full object-cover" />
        : initials}
    </div>
  )
}

function AddStudentForm({ institutionId, onDone, onCancel }) {
  const [form, setForm] = useState({ student_id: '', full_name: '', pin: '', company: '', work_position: '', team: '', location: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.pin.length < 4) { setError('PIN must be at least 4 digits.'); return }
    setSaving(true)
    const { data: hashed, error: hashErr } = await supabase.rpc('hash_pin', { p_pin: form.pin })
    if (hashErr) { setError(hashErr.message); setSaving(false); return }
    const { error: insertErr } = await supabase.from('student_profiles').insert({
      institution_id: institutionId,
      student_id:     form.student_id.trim(),
      full_name:      form.full_name.trim(),
      pin_hash:       hashed,
      company:        form.company.trim() || null,
      work_position:  form.work_position.trim() || null,
      team:           form.team.trim() || null,
      location:       form.location.trim() || null,
      team:           form.team.trim() || null,
    })
    if (insertErr) {
      setError(insertErr.code === '23505' ? 'A student with that ID already exists.' : insertErr.message)
      setSaving(false); return
    }
    onDone()
  }

  return (
    <div className="card mb-6 border-brand-200 border-2">
      <h2 className="font-semibold text-gray-900 mb-5">Add Student</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input className="input" placeholder="Jane Smith" value={form.full_name}
              onChange={e => set('full_name', e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Student ID</label>
            <input className="input" placeholder="STU001" value={form.student_id}
              onChange={e => set('student_id', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Initial PIN</label>
            <input className="input" placeholder="4–8 digits" inputMode="numeric"
              value={form.pin} onChange={e => set('pin', e.target.value.replace(/\D/g, '').slice(0, 8))}
              required minLength={4} maxLength={8} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Team <span className="text-gray-400 font-normal">(optional)</span></label>
            <input className="input" placeholder="Team Alpha" value={form.team}
              onChange={e => set('team', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company <span className="text-gray-400 font-normal">(optional)</span></label>
            <input className="input" placeholder="Acme Corp" value={form.company}
              onChange={e => set('company', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Work Position <span className="text-gray-400 font-normal">(optional)</span></label>
            <input className="input" placeholder="Senior Manager" value={form.work_position}
              onChange={e => set('work_position', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location <span className="text-gray-400 font-normal">(optional)</span></label>
            <input className="input" placeholder="Toronto" value={form.location}
              onChange={e => set('location', e.target.value)} />
          </div>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Adding…' : 'Add Student'}</button>
          <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  )
}

function PinResetForm({ student, onDone, onCancel }) {
  const [pin, setPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (pin.length < 4) { setError('PIN must be at least 4 digits.'); return }
    setSaving(true)
    const { data: hashed, error: hashErr } = await supabase.rpc('hash_pin', { p_pin: pin })
    if (hashErr) { setError(hashErr.message); setSaving(false); return }
    const { error: updateErr } = await supabase.from('student_profiles').update({ pin_hash: hashed }).eq('id', student.id)
    if (updateErr) { setError(updateErr.message); setSaving(false); return }
    onDone()
  }

  return (
    <div className="card mb-6 border-amber-200 border-2">
      <h2 className="font-semibold text-gray-900 mb-1">Reset PIN</h2>
      <p className="text-sm text-gray-500 mb-5">Setting a new PIN for <strong>{student.full_name}</strong></p>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-xs">
        <input className="input tracking-widest text-center text-xl" placeholder="• • • •"
          inputMode="numeric" value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
          required minLength={4} maxLength={8} autoFocus />
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Set PIN'}</button>
          <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  )
}

const REQUIRED_COLS = ['student_id', 'full_name', 'pin']

function CSVImport({ institutionId, onDone, onCancel }) {
  const fileRef = useRef()
  const [rows, setRows] = useState([])
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState(null)
  const [parseError, setParseError] = useState('')
  const [programs, setPrograms] = useState([])
  const [selectedProgramId, setSelectedProgramId] = useState('')

  useEffect(() => {
    if (!institutionId) return
    supabase.from('programs').select('id, name').eq('institution_id', institutionId)
      .eq('archived', false).order('name')
      .then(({ data }) => setPrograms(data || []))
  }, [institutionId])

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setParseError(''); setRows([]); setResults(null)
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_'),
      complete: ({ data, errors }) => {
        if (errors.length) { setParseError('Could not parse CSV.'); return }
        const missing = REQUIRED_COLS.filter(c => !Object.keys(data[0] || {}).includes(c))
        if (missing.length) { setParseError(`Missing required columns: ${missing.join(', ')}`); return }
        const validated = data.map((row, i) => {
          const issues = []
          if (!row.student_id?.trim()) issues.push('Missing student_id')
          if (!row.full_name?.trim())  issues.push('Missing full_name')
          if (!row.pin?.trim())        issues.push('Missing pin')
          if (row.pin && !/^\d{4,8}$/.test(row.pin.trim())) issues.push('PIN must be 4–8 digits')
          return {
            _row: i + 2, _issues: issues, _status: issues.length ? 'error' : 'ready',
            student_id: row.student_id?.trim(), full_name: row.full_name?.trim(),
            pin: row.pin?.trim(), company: row.company?.trim() || null,
            work_position: row.work_position?.trim() || null, team: row.team?.trim() || null,
            location: row.location?.trim() || null,
          }
        })
        setRows(validated)
      }
    })
  }

  async function handleImport() {
    setImporting(true)
    const ready = rows.filter(r => r._status === 'ready')
    let imported = 0, skipped = 0, enrolled = 0, errors = []

    for (const row of ready) {
      const { data: hashed, error: hashErr } = await supabase.rpc('hash_pin', { p_pin: row.pin })
      if (hashErr) { errors.push(`${row.student_id}: ${hashErr.message}`); continue }

      const { data: inserted, error } = await supabase.from('student_profiles').insert({
        institution_id: institutionId, student_id: row.student_id, full_name: row.full_name,
        pin_hash: hashed, company: row.company, work_position: row.work_position,
        team: row.team, location: row.location,
      }).select('id').single()

      if (error) {
        if (error.code === '23505') {
          skipped++
          // Still enroll existing student if program selected
          if (selectedProgramId) {
            const { data: existing } = await supabase.from('student_profiles')
              .select('id').eq('institution_id', institutionId).eq('student_id', row.student_id).single()
            if (existing) {
              const { error: enrollErr } = await supabase.from('enrollments')
                .insert({ program_id: selectedProgramId, student_id: existing.id })
              if (!enrollErr) enrolled++
            }
          }
        } else {
          errors.push(`${row.student_id}: ${error.message}`)
        }
      } else {
        imported++
        if (selectedProgramId && inserted) {
          const { error: enrollErr } = await supabase.from('enrollments')
            .insert({ program_id: selectedProgramId, student_id: inserted.id })
          if (!enrollErr) enrolled++
        }
      }
    }

    setResults({ imported, skipped, enrolled, errors, programName: programs.find(p => p.id === selectedProgramId)?.name })
    setImporting(false)
  }

  const readyCount = rows.filter(r => r._status === 'ready').length
  const errorCount = rows.filter(r => r._status === 'error').length

  return (
    <div className="card mb-6 border-brand-200 border-2">
      <h2 className="font-semibold text-gray-900 mb-1">Import Students via CSV</h2>
      <p className="text-sm text-gray-500 mb-2">
        Required: <code className="bg-gray-100 px-1 rounded">student_id</code>{' '}
        <code className="bg-gray-100 px-1 rounded">full_name</code>{' '}
        <code className="bg-gray-100 px-1 rounded">pin</code>
        {' '}· Optional: <code className="bg-gray-100 px-1 rounded">team</code>{' '}
        <code className="bg-gray-100 px-1 rounded">location</code>{' '}
        <code className="bg-gray-100 px-1 rounded">company</code>{' '}
        <code className="bg-gray-100 px-1 rounded">work_position</code>
      </p>
      <a href="data:text/csv;charset=utf-8,student_id,full_name,pin,team,location,company,work_position%0ASTU001,Jane Smith,1234,Team Alpha,Toronto,Acme Corp,Senior Manager"
        download="handraise_students_template.csv"
        className="inline-block text-sm text-brand-500 hover:underline mb-4">
        ↓ Download template CSV
      </a>

      {/* Program selector */}
      {programs.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Enroll into program <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <select className="input bg-white max-w-sm" value={selectedProgramId}
            onChange={e => setSelectedProgramId(e.target.value)}>
            <option value="">Don't enroll — just create profiles</option>
            {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      {!results && (
        <>
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-brand-300 transition-colors mb-4"
            onClick={() => fileRef.current.click()}>
            <p className="text-gray-400 text-sm">Click to select a CSV file</p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </div>
          {parseError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{parseError}</p>}
          {rows.length > 0 && (
            <>
              <div className="flex items-center gap-4 mb-3">
                <span className="text-sm font-medium text-gray-700">{rows.length} rows</span>
                {readyCount > 0 && <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">{readyCount} ready</span>}
                {errorCount > 0 && <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">{errorCount} errors</span>}
              </div>
              <div className="card p-0 overflow-hidden mb-4 max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-2 text-gray-500 font-medium">Row</th>
                      <th className="text-left px-4 py-2 text-gray-500 font-medium">ID</th>
                      <th className="text-left px-4 py-2 text-gray-500 font-medium">Name</th>
                      <th className="text-left px-4 py-2 text-gray-500 font-medium">Team</th>
                      <th className="text-left px-4 py-2 text-gray-500 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row._row} className={`border-b border-gray-50 ${row._status === 'error' ? 'bg-red-50' : ''}`}>
                        <td className="px-4 py-2 text-gray-400">{row._row}</td>
                        <td className="px-4 py-2 font-mono">{row.student_id}</td>
                        <td className="px-4 py-2">{row.full_name}</td>
                        <td className="px-4 py-2 text-gray-400">{row.team || '—'}</td>
                        <td className="px-4 py-2">
                          {row._status === 'error'
                            ? <span className="text-red-600">{row._issues.join(', ')}</span>
                            : <span className="text-green-600">✓ Ready</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {readyCount > 0 && (
                <div className="flex gap-2">
                  <button onClick={handleImport} disabled={importing} className="btn-primary">
                    {importing ? 'Importing…' : `Import ${readyCount} student${readyCount !== 1 ? 's' : ''}`}
                  </button>
                  <button onClick={onCancel} className="btn-secondary">Cancel</button>
                </div>
              )}
            </>
          )}
          {rows.length === 0 && !parseError && (
            <button onClick={onCancel} className="btn-secondary mt-2">Cancel</button>
          )}
        </>
      )}

      {results && (
        <div className="space-y-3">
          {results.programName && (
            <p className="text-sm text-gray-500">
              Enrolled into <strong>{results.programName}</strong>
            </p>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{results.imported}</p>
              <p className="text-xs text-green-600 mt-1">Imported</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{results.skipped}</p>
              <p className="text-xs text-amber-600 mt-1">Already existed</p>
            </div>
            <div className="bg-red-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{results.errors.length}</p>
              <p className="text-xs text-red-600 mt-1">Errors</p>
            </div>
          </div>
          {results.programName && results.enrolled > 0 && (
            <div className="bg-brand-50 rounded-xl p-3 text-sm text-brand-700">
              ✓ {results.enrolled} student{results.enrolled !== 1 ? 's' : ''} enrolled into {results.programName}
            </div>
          )}
          {results.errors.length > 0 && (
            <div className="bg-red-50 rounded-xl p-3 text-xs text-red-600 space-y-1">
              {results.errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
          <button onClick={onDone} className="btn-primary">Done</button>
        </div>
      )}
    </div>
  )
}
