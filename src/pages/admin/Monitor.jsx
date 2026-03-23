import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { StudentProfileCard } from '../../components/ui/StudentProfileCard'

// Standalone page — no login required, no admin chrome
export function ProfileMonitor() {
  const [searchParams] = useSearchParams()
  const institutionId = searchParams.get('institution')

  const [programs, setPrograms]               = useState([])
  const [selectedProgram, setSelectedProgram] = useState(null)
  const [selectedTeam, setSelectedTeam]       = useState(null)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [students, setStudents]               = useState([])
  const [loading, setLoading]                 = useState(true)
  const [institutionName, setInstitutionName] = useState('')

  useEffect(() => { loadPrograms() }, [])

  async function loadPrograms() {
    // Load all institutions if no param, or specific one
    let query = supabase.from('programs')
      .select('id, name, institution_id, institutions(name), enrollments(student_profiles(id, full_name, student_id, company, work_position, team, location, profile_photo_url, active))')
      .eq('archived', false)
      .order('name')

    if (institutionId) query = query.eq('institution_id', institutionId)

    const { data } = await query
    setPrograms(data || [])
    if (data?.[0]?.institutions?.name) setInstitutionName(data[0].institutions.name)
    setLoading(false)
  }

  function selectProgram(program) {
    setSelectedProgram(program)
    setSelectedTeam(null)
    setSelectedStudent(null)
    const enrolled = program.enrollments
      ?.map(e => e.student_profiles)
      .filter(s => s?.active) || []
    setStudents(enrolled)
  }

  function back() {
    setSelectedProgram(null)
    setSelectedTeam(null)
    setSelectedStudent(null)
    setStudents([])
  }

  // Group by team
  const teamGroups = {}
  students.forEach(s => {
    const team = s.team || 'No Team'
    if (!teamGroups[team]) teamGroups[team] = []
    teamGroups[team].push(s)
  })
  const teamNames = Object.keys(teamGroups).sort(a => a === 'No Team' ? 1 : -1)

  const visibleStudents = selectedTeam
    ? (teamGroups[selectedTeam] || []).sort((a, b) => a.full_name.localeCompare(b.full_name))
    : students.sort((a, b) => a.full_name.localeCompare(b.full_name))

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-xl">✋</span>
          {selectedProgram ? (
            <>
              <button onClick={back} className="text-brand-500 hover:text-brand-700 text-sm font-medium">
                ← Programs
              </button>
              <h1 className="text-lg font-bold text-gray-900">{selectedProgram.name}</h1>
              <span className="text-sm text-gray-400">
                {visibleStudents.length} student{visibleStudents.length !== 1 ? 's' : ''}
                {selectedTeam && ` · ${selectedTeam}`}
              </span>
            </>
          ) : (
            <h1 className="text-lg font-bold text-gray-900">
              {institutionName ? `${institutionName} — Profile Monitor` : 'Profile Monitor'}
            </h1>
          )}
        </div>

        {/* Team tabs */}
        {selectedProgram && teamNames.length > 1 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            <button
              onClick={() => { setSelectedTeam(null); setSelectedStudent(null) }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                !selectedTeam ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              All ({students.length})
            </button>
            {teamNames.map(team => (
              <button key={team} onClick={() => { setSelectedTeam(team); setSelectedStudent(null) }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedTeam === team ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {team} ({teamGroups[team].length})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Programs or Students */}
        <div className="w-64 border-r border-gray-100 bg-white flex flex-col flex-shrink-0 overflow-y-auto">
          {!selectedProgram ? (
            loading ? (
              <div className="p-4 space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : programs.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">No programs found.</p>
            ) : (
              <div className="p-3 space-y-1">
                {programs.map(program => {
                  const count = program.enrollments?.filter(e => e.student_profiles?.active).length ?? 0
                  return (
                    <button key={program.id} onClick={() => selectProgram(program)}
                      className="w-full text-left px-4 py-3 rounded-xl hover:bg-brand-50 transition-colors group">
                      <p className="font-medium text-gray-900 group-hover:text-brand-700 text-sm">{program.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{count} student{count !== 1 ? 's' : ''}</p>
                    </button>
                  )
                })}
              </div>
            )
          ) : (
            <div className="p-2">
              {visibleStudents.length === 0 ? (
                <p className="p-4 text-sm text-gray-400">No students in this team.</p>
              ) : visibleStudents.map(student => (
                <button key={student.id} onClick={() => setSelectedStudent(student)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-colors ${
                    selectedStudent?.id === student.id ? 'bg-brand-50 border border-brand-100' : 'hover:bg-gray-50'
                  }`}>
                  <StudentAvatar student={student} size={36} />
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${selectedStudent?.id === student.id ? 'text-brand-700' : 'text-gray-900'}`}>
                      {student.full_name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {student.location || student.team || student.student_id}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Profile */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {!selectedStudent ? (
            <div className="flex items-center justify-center h-full text-center p-8">
              <div>
                <p className="text-5xl mb-4 opacity-20">👤</p>
                <p className="text-gray-400 text-sm">
                  {!selectedProgram ? 'Select a program to get started' : 'Select a student to view their profile'}
                </p>
              </div>
            </div>
          ) : (
            <ProfileDetail student={selectedStudent} programName={selectedProgram?.name} />
          )}
        </div>
      </div>
    </div>
  )
}

// Keep AdminMonitor as a wrapper that redirects to the standalone page
export function AdminMonitor() {
  const navigate = useNavigate()
  const [institutionId, setInstitutionId] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: ap } = await supabase.from('admin_profiles').select('institution_id').eq('user_id', user.id).single()
      if (ap) setInstitutionId(ap.institution_id)
    })
  }, [])

  if (institutionId) {
    window.location.href = `/monitor?institution=${institutionId}`
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
    </div>
  )
}

function ProfileDetail({ student, programName }) {
  return (
    <div className="p-8">
      <StudentProfileCard
        student={student}
        programName={programName}
        year={new Date().getFullYear()}
      />
    </div>
  )
}

function StudentAvatar({ student, size = 32 }) {
  const initials = student?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'
  return (
    <div className="rounded-full bg-brand-500 flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden"
      style={{ width: size, height: size, minWidth: size }}>
      {student?.profile_photo_url
        ? <img src={student.profile_photo_url} alt="" className="w-full h-full object-cover" />
        : <span style={{ fontSize: Math.max(10, size * 0.32) }}>{initials}</span>}
    </div>
  )
}) {
  const initials = student?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'
  return (
    <div className="rounded-full bg-brand-500 flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden"
      style={{ width: size, height: size, minWidth: size }}>
      {student?.profile_photo_url
        ? <img src={student.profile_photo_url} alt="" className="w-full h-full object-cover" />
        : <span style={{ fontSize: Math.max(10, size * 0.32) }}>{initials}</span>}
    </div>
  )
}
