import { useEffect, useState, useRef } from 'react'
import Papa from 'papaparse'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { AdminLayout } from '../../components/layout/AdminLayout'

export function AdminPrograms() {
  const { user } = useAuth()
  const [programs, setPrograms] = useState([])
  const [teachers, setTeachers] = useState([])
  const [institutionId, setInstitutionId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', teacher_id: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [pageTab, setPageTab] = useState('programs')
  const [showImport, setShowImport] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: ap } = await supabase
      .from('admin_profiles').select('institution_id').eq('user_id', user.id).single()
    if (!ap) return
    setInstitutionId(ap.institution_id)
    const [{ data: progs }, { data: tchs }] = await Promise.all([
      supabase.from('programs')
        .select('id, name, archived, created_at, teacher_profiles(id, full_name), enrollments(id, student_profiles(id, full_name, student_id, company, work_position, profile_photo_url, team))')
        .eq('institution_id', ap.institution_id).order('name'),
      supabase.from('teacher_profiles').select('id, full_name').eq('institution_id', ap.institution_id).order('full_name'),
    ])
    setPrograms(progs || [])
    setTeachers(tchs || [])
    setLoading(false)
  }

  async function handleCreate(e) {
    e.preventDefault(); setError(''); setSaving(true)
    const { data: { user: authUser } } = await supabase.auth.getUser()
    const { data: ap, error: apErr } = await supabase.from('admin_profiles').select('institution_id').eq('user_id', authUser.id).single()
    if (apErr) console.error('admin_profiles error:', apErr)
    const instId = ap?.institution_id || institutionId
    if (!instId) { setError('Could not determine institution. Please refresh.'); setSaving(false); return }
    const { error } = await supabase.from('programs').insert({
      institution_id: instId, name: form.name.trim(), teacher_id: form.teacher_id || null,
    })
    if (error) { console.error('insert error:', error); setError(error.message); setSaving(false); return }
    setForm({ name: '', teacher_id: '' }); setShowForm(false); setSaving(false); loadData()
  }

  async function toggleArchive(program) {
    await supabase.from('programs').update({ archived: !program.archived }).eq('id', program.id)
    loadData()
  }

  const active   = programs.filter(p => !p.archived)
  const archived = programs.filter(p => p.archived)

  return (
    <AdminLayout>
      <div className="p-8 max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Programs</h1>
          {pageTab === 'programs' && !showForm && (
            <div className="flex gap-2">
              <button onClick={() => setShowImport(v => !v)} className="btn-secondary text-sm">
                ↑ Import Students
              </button>
              <button onClick={() => setShowForm(true)} className="btn-primary">+ New Program</button>
            </div>
          )}
        </div>

        {/* CSV Import panel */}
        {showImport && pageTab === 'programs' && (
          <ProgramCSVImport institutionId={institutionId} onDone={() => { setShowImport(false); loadData() }} onCancel={() => setShowImport(false)} />
        )}

        {/* Page tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
          {['programs', 'locations'].map(tab => (
            <button key={tab} onClick={() => setPageTab(tab)}
              className={`text-sm font-medium px-5 py-1.5 rounded-lg transition-colors capitalize ${
                pageTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {tab}
            </button>
          ))}
        </div>

        {pageTab === 'locations' ? (
          <LocationsPanel institutionId={institutionId} />
        ) : (
          <>
            {/* Create form */}
            {showForm && (
              <div className="card mb-6 border-brand-200 border-2">
                <h2 className="font-semibold text-gray-900 mb-4">New Program</h2>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Program Name</label>
                    <input className="input" placeholder="e.g. Leadership Fundamentals Q1 2026"
                      value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Teacher <span className="text-gray-400 font-normal">(optional)</span></label>
                    {teachers.length === 0 ? (
                      <p className="text-sm text-gray-400">No teachers added yet.</p>
                    ) : (
                      <select className="input bg-white" value={form.teacher_id}
                        onChange={e => setForm(f => ({ ...f, teacher_id: e.target.value }))}>
                        <option value="">Unassigned</option>
                        {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                      </select>
                    )}
                  </div>
                  {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                  <div className="flex gap-2">
                    <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create Program'}</button>
                    <button type="button" onClick={() => { setShowForm(false); setError('') }} className="btn-secondary">Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {loading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="card animate-pulse h-20" />)}</div>
            ) : active.length === 0 && !showForm ? (
              <div className="card border-dashed text-center py-12">
                <p className="text-4xl mb-3">📚</p>
                <p className="text-gray-500 font-medium">No programs yet</p>
                <p className="text-gray-400 text-sm mt-1">Use the button above to create your first program</p>
              </div>
            ) : (
              <div className="space-y-3">
                {active.map(program => (
                  <ProgramCard key={program.id} program={program} institutionId={institutionId}
                    isExpanded={expanded === program.id}
                    onToggleExpand={() => setExpanded(expanded === program.id ? null : program.id)}
                    onArchive={() => toggleArchive(program)} onReload={loadData} />
                ))}
              </div>
            )}

            {archived.length > 0 && (
              <div className="mt-10">
                <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Archived ({archived.length})</h2>
                <div className="space-y-2">
                  {archived.map(program => (
                    <ProgramCard key={program.id} program={program} institutionId={institutionId}
                      isExpanded={false} onToggleExpand={() => {}}
                      onArchive={() => toggleArchive(program)} onReload={loadData} isArchived />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  )
}


// ── Locations panel ───────────────────────────────────────
function LocationsPanel({ institutionId }) {
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!institutionId) return
    supabase.from('locations').select('id, name').eq('institution_id', institutionId).order('name')
      .then(({ data }) => { setLocations(data || []); setLoading(false) })
  }, [institutionId])

  async function addLocation(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)
    const { data } = await supabase.from('locations')
      .insert({ institution_id: institutionId, name: newName.trim() }).select().single()
    if (data) setLocations(l => [...l, data].sort((a,b) => a.name.localeCompare(b.name)))
    setNewName(''); setSaving(false)
  }

  async function deleteLocation(id) {
    await supabase.from('locations').delete().eq('id', id)
    setLocations(l => l.filter(loc => loc.id !== id))
  }

  if (loading) return <div className="card animate-pulse h-32" />

  return (
    <div>
      <p className="text-gray-500 text-sm mb-5">
        Locations are shown to students at login as a dropdown. Their profile location is pre-selected but they can change it if travelling.
      </p>
      <div className="space-y-2 mb-5">
        {locations.length === 0 ? (
          <div className="card border-dashed text-center py-8">
            <p className="text-gray-400 text-sm">No locations yet — add your first one below.</p>
          </div>
        ) : locations.map(loc => (
          <div key={loc.id} className="card flex items-center gap-4 py-3">
            <span className="text-sm font-medium text-gray-900 flex-1">📍 {loc.name}</span>
            <button onClick={() => deleteLocation(loc.id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
          </div>
        ))}
      </div>
      <form onSubmit={addLocation} className="flex gap-2 max-w-sm">
        <input className="input text-sm flex-1" placeholder="e.g. Toronto"
          value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
        <button type="submit" disabled={saving} className="btn-primary text-sm py-2 px-4">
          {saving ? '…' : 'Add Location'}
        </button>
      </form>
    </div>
  )
}


// ── Program card ──────────────────────────────────────────
function ProgramCard({ program, institutionId, isExpanded, onToggleExpand, onArchive, onReload, isArchived }) {
  const enrolledCount = new Set(program.enrollments?.map(e => e.student_profiles?.id).filter(Boolean)).size

  return (
    <div className={`card p-0 overflow-hidden ${isArchived ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">{program.name}</p>
          <p className="text-sm text-gray-400 mt-0.5">
            {enrolledCount} student{enrolledCount !== 1 ? 's' : ''} enrolled
            {program.teacher_profiles?.full_name && <> · {program.teacher_profiles.full_name}</>}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {!isArchived && (
            <button onClick={onToggleExpand} className="text-sm font-medium text-brand-500 hover:underline">
              {isExpanded ? 'Close ↑' : 'Manage ↓'}
            </button>
          )}
          <button onClick={onArchive} className="text-sm text-gray-400 hover:text-gray-600">
            {isArchived ? 'Unarchive' : 'Archive'}
          </button>
        </div>
      </div>
      {isExpanded && (
        <EnrollmentPanel program={program} institutionId={institutionId}
          enrolledIds={new Set(program.enrollments?.map(e => e.student_profiles?.id).filter(Boolean))}
          onReload={onReload} />
      )}
    </div>
  )
}


// ── Enrollment panel ──────────────────────────────────────
function EnrollmentPanel({ program, institutionId, enrolledIds, onReload }) {
  const [allStudents, setAllStudents] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(null)

  useEffect(() => {
    supabase.from('student_profiles')
      .select('id, full_name, student_id, company, team, profile_photo_url')
      .eq('institution_id', institutionId).eq('active', true).order('full_name')
      .then(({ data }) => { setAllStudents(data || []); setLoading(false) })
  }, [institutionId])

  async function toggleEnrollment(student) {
    setToggling(student.id)
    if (enrolledIds.has(student.id)) {
      const { data: enroll } = await supabase.from('enrollments').select('id')
        .eq('program_id', program.id).eq('student_id', student.id).single()
      if (enroll) await supabase.from('enrollments').delete().eq('id', enroll.id)
    } else {
      await supabase.from('enrollments').insert({ program_id: program.id, student_id: student.id })
    }
    setToggling(null); onReload()
  }

  async function enrollAll() {
    for (const s of allStudents.filter(s => !enrolledIds.has(s.id)))
      await supabase.from('enrollments').insert({ program_id: program.id, student_id: s.id })
    onReload()
  }

  async function unenrollAll() {
    await supabase.from('enrollments').delete().eq('program_id', program.id)
    onReload()
  }

  const filtered   = allStudents.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.student_id.toLowerCase().includes(search.toLowerCase()) ||
    (s.team || '').toLowerCase().includes(search.toLowerCase())
  )
  const enrolled   = filtered.filter(s => enrolledIds.has(s.id))
  const unenrolled = filtered.filter(s => !enrolledIds.has(s.id))

  return (
    <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
      <div className="flex items-center gap-3 mb-4">
        <input className="input bg-white text-sm py-2 max-w-xs" placeholder="Search students…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <button onClick={enrollAll} className="text-xs text-brand-500 hover:underline font-medium">Enroll all</button>
        <button onClick={unenrollAll} className="text-xs text-gray-400 hover:text-gray-600">Remove all</button>
      </div>
      {loading ? <div className="animate-pulse h-12 bg-gray-200 rounded-xl" /> :
        allStudents.length === 0 ? <p className="text-sm text-gray-400">No active students yet.</p> : (
          <div className="space-y-4">
            {enrolled.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Enrolled ({enrolled.length})</p>
                <div className="space-y-1">
                  {enrolled.map(s => <StudentEnrollRow key={s.id} student={s} enrolled loading={toggling === s.id} onToggle={() => toggleEnrollment(s)} />)}
                </div>
              </div>
            )}
            {unenrolled.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Not enrolled ({unenrolled.length})</p>
                <div className="space-y-1">
                  {unenrolled.map(s => <StudentEnrollRow key={s.id} student={s} enrolled={false} loading={toggling === s.id} onToggle={() => toggleEnrollment(s)} />)}
                </div>
              </div>
            )}
            {filtered.length === 0 && <p className="text-sm text-gray-400">No students match "{search}"</p>}
          </div>
        )}
    </div>
  )
}


// ── Student enroll row ────────────────────────────────────
function StudentEnrollRow({ student, enrolled, loading, onToggle }) {
  const initials = student.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className={`flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 border ${enrolled ? 'border-brand-100' : 'border-transparent'}`}>
      <div className="avatar w-7 h-7 text-xs flex-shrink-0">
        {student.profile_photo_url
          ? <img src={student.profile_photo_url} alt="" className="w-full h-full object-cover rounded-full" />
          : initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{student.full_name}</p>
        <p className="text-xs text-gray-400 truncate">
          {student.student_id}{student.team && <> · {student.team}</>}
        </p>
      </div>
      <button onClick={onToggle} disabled={loading}
        className={`text-xs font-medium flex-shrink-0 transition-colors ${enrolled ? 'text-red-400 hover:text-red-600' : 'text-brand-500 hover:text-brand-700'} disabled:opacity-40`}>
        {loading ? '…' : enrolled ? 'Remove' : '+ Enroll'}
      </button>
    </div>
  )
}


// ── CSV Import for Programs page ──────────────────────────
const REQUIRED_COLS = ['student_id', 'full_name', 'pin']

function ProgramCSVImport({ institutionId, onDone, onCancel }) {
  const fileRef = useRef()
  const [rows, setRows]           = useState([])
  const [importing, setImporting] = useState(false)
  const [results, setResults]     = useState(null)
  const [parseError, setParseError] = useState('')
  const [programs, setPrograms]   = useState([])
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
            work_position: row.work_position?.trim() || null,
            team: row.team?.trim() || null, location: row.location?.trim() || null,
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
          if (selectedProgramId) {
            const { data: existing } = await supabase.from('student_profiles')
              .select('id').eq('institution_id', institutionId).eq('student_id', row.student_id).single()
            if (existing) {
              const { error: enrollErr } = await supabase.from('enrollments')
                .insert({ program_id: selectedProgramId, student_id: existing.id })
              if (!enrollErr) enrolled++
            }
          }
        } else { errors.push(`${row.student_id}: ${error.message}`) }
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
      <p className="text-sm text-gray-500 mb-3">
        Required: <code className="bg-gray-100 px-1 rounded">student_id</code>{' '}
        <code className="bg-gray-100 px-1 rounded">full_name</code>{' '}
        <code className="bg-gray-100 px-1 rounded">pin</code>
        {' '}· Optional: <code className="bg-gray-100 px-1 rounded">team</code>{' '}
        <code className="bg-gray-100 px-1 rounded">location</code>{' '}
        <code className="bg-gray-100 px-1 rounded">company</code>{' '}
        <code className="bg-gray-100 px-1 rounded">work_position</code>
      </p>
      <a href="data:text/csv;charset=utf-8,student_id,full_name,pin,team,location,company,work_position%0ASTU001,Jane Smith,1234,Team Alpha,Toronto,Acme Corp,Senior Manager"
        download="handraise_students_template.csv" className="inline-block text-sm text-brand-500 hover:underline mb-4">
        ↓ Download template CSV
      </a>

      {programs.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Enroll into program <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <select className="input bg-white max-w-sm" value={selectedProgramId} onChange={e => setSelectedProgramId(e.target.value)}>
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
                <span className="text-sm font-medium">{rows.length} rows</span>
                {readyCount > 0 && <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">{readyCount} ready</span>}
                {errorCount > 0 && <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">{errorCount} errors</span>}
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
          {results.programName && <p className="text-sm text-gray-500">Enrolled into <strong>{results.programName}</strong></p>}
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
          {results.enrolled > 0 && (
            <div className="bg-brand-50 rounded-xl p-3 text-sm text-brand-700">
              ✓ {results.enrolled} student{results.enrolled !== 1 ? 's' : ''} enrolled
            </div>
          )}
          <button onClick={onDone} className="btn-primary">Done</button>
        </div>
      )}
    </div>
  )
}
