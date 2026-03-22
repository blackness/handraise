import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { AdminLayout } from '../../components/layout/AdminLayout'

export function AdminRoster() {
  const { user } = useAuth()
  const [programs, setPrograms]         = useState([])
  const [selectedProgram, setSelectedProgram] = useState(null)
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [students, setStudents]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [institutionId, setInstitutionId] = useState(null)

  useEffect(() => { loadPrograms() }, [])

  async function loadPrograms() {
    const { data: ap } = await supabase
      .from('admin_profiles').select('institution_id').eq('user_id', user.id).single()
    if (!ap) return
    setInstitutionId(ap.institution_id)
    const { data } = await supabase
      .from('programs')
      .select('id, name, enrollments(student_profiles(id, full_name, student_id, company, work_position, team, location, profile_photo_url, active))')
      .eq('institution_id', ap.institution_id)
      .eq('archived', false)
      .order('name')
    setPrograms(data || [])
    setLoading(false)
  }

  function selectProgram(program) {
    setSelectedProgram(program)
    setSelectedLocation(null)
    setSelectedStudent(null)
    const enrolled = program.enrollments
      ?.map(e => e.student_profiles)
      .filter(s => s?.active) || []
    setStudents(enrolled)
  }

  // Group students by location
  const locationGroups = {}
  students.forEach(s => {
    const loc = s.location || 'No Location'
    if (!locationGroups[loc]) locationGroups[loc] = []
    locationGroups[loc].push(s)
  })
  const locationNames = Object.keys(locationGroups).sort()

  const rosterStudents = selectedLocation
    ? (locationGroups[selectedLocation] || []).sort((a, b) => a.full_name.localeCompare(b.full_name))
    : []

  return (
    <AdminLayout>
      <div className="flex h-screen overflow-hidden">

        {/* ── Col 1: Programs ─────────────────────────── */}
        <div className="w-56 border-r border-gray-100 bg-white flex flex-col flex-shrink-0">
          <div className="px-4 py-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">Programs</h2>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {loading ? (
              <div className="px-4 space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}
              </div>
            ) : programs.map(program => (
              <button key={program.id} onClick={() => selectProgram(program)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  selectedProgram?.id === program.id
                    ? 'bg-brand-50 text-brand-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}>
                {program.name}
              </button>
            ))}
          </div>
        </div>

        {/* ── Col 2: Locations ────────────────────────── */}
        <div className="w-48 border-r border-gray-100 bg-white flex flex-col flex-shrink-0">
          <div className="px-4 py-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">
              {selectedProgram ? 'Locations' : '—'}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {!selectedProgram ? (
              <p className="px-4 py-3 text-xs text-gray-400">Select a program</p>
            ) : locationNames.length === 0 ? (
              <p className="px-4 py-3 text-xs text-gray-400">No students enrolled</p>
            ) : locationNames.map(loc => (
              <button key={loc} onClick={() => { setSelectedLocation(loc); setSelectedStudent(null) }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  selectedLocation === loc
                    ? 'bg-brand-50 text-brand-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}>
                <span className="block truncate">📍 {loc}</span>
                <span className="text-xs text-gray-400">{locationGroups[loc].length} students</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Col 3: Students ─────────────────────────── */}
        <div className="w-56 border-r border-gray-100 bg-white flex flex-col flex-shrink-0">
          <div className="px-4 py-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">
              {selectedLocation || '—'}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {!selectedLocation ? (
              <p className="px-4 py-3 text-xs text-gray-400">Select a location</p>
            ) : rosterStudents.map(student => (
              <button key={student.id} onClick={() => setSelectedStudent(student)}
                className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                  selectedStudent?.id === student.id
                    ? 'bg-brand-50'
                    : 'hover:bg-gray-50'
                }`}>
                <StudentAvatar student={student} size="7" />
                <div className="min-w-0">
                  <p className={`text-sm truncate ${selectedStudent?.id === student.id ? 'text-brand-700 font-medium' : 'text-gray-700'}`}>
                    {student.full_name}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{student.team || student.student_id}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Col 4: Profile ──────────────────────────── */}
        <div className="flex-1 bg-gray-50 overflow-y-auto">
          {!selectedStudent ? (
            <div className="flex items-center justify-center h-full text-center p-8">
              <div>
                <p className="text-5xl mb-4">👤</p>
                <p className="text-gray-400">Select a student to view their profile</p>
              </div>
            </div>
          ) : (
            <StudentProfileDetail student={selectedStudent} />
          )}
        </div>

      </div>
    </AdminLayout>
  )
}

function StudentProfileDetail({ student }) {
  return (
    <div className="p-8 max-w-lg">
      {/* Avatar + name */}
      <div className="flex items-center gap-6 mb-8">
        <StudentAvatar student={student} size="20" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{student.full_name}</h2>
          {student.work_position && <p className="text-gray-500 mt-0.5">{student.work_position}</p>}
          {student.company      && <p className="text-gray-400 text-sm">{student.company}</p>}
        </div>
      </div>

      {/* Details */}
      <div className="space-y-3">
        {[
          { label: 'Student ID', value: student.student_id },
          { label: 'Team',       value: student.team },
          { label: 'Location',   value: student.location },
          { label: 'Company',    value: student.company },
          { label: 'Position',   value: student.work_position },
        ].filter(r => r.value).map(row => (
          <div key={row.label} className="flex items-center gap-4 bg-white rounded-xl px-5 py-3 border border-gray-100">
            <span className="text-sm text-gray-400 w-24 flex-shrink-0">{row.label}</span>
            <span className="text-sm font-medium text-gray-900">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StudentAvatar({ student, size = '8' }) {
  const initials = student?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'
  const px = parseInt(size) * 4
  return (
    <div className={`rounded-full bg-brand-500 flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden`}
      style={{ width: px, height: px, minWidth: px, minHeight: px }}>
      {student?.profile_photo_url
        ? <img src={student.profile_photo_url} alt="" className="w-full h-full object-cover" />
        : <span style={{ fontSize: Math.max(10, px * 0.3) }}>{initials}</span>}
    </div>
  )
}
