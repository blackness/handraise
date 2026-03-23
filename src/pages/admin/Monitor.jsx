import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { StudentProfileCard } from '../../components/ui/StudentProfileCard'

// Standalone page — no login required, no admin chrome
export function ProfileMonitor() {
  const [searchParams] = useSearchParams()
  const institutionId   = searchParams.get('institution')
  const targetStudentId = searchParams.get('student')
  const sessionId       = searchParams.get('session')

  const [programs, setPrograms]               = useState([])
  const [allStudentsFlat, setAllStudentsFlat] = useState([]) // all students across all programs
  const [selectedProgram, setSelectedProgram] = useState(null)
  const [selectedTeam, setSelectedTeam]       = useState(null)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [students, setStudents]               = useState([])
  const [loading, setLoading]                 = useState(true)
  const [institutionName, setInstitutionName] = useState('')

  useEffect(() => { loadPrograms() }, [])

  // Realtime: watch session_focus if a session is provided
  useEffect(() => {
    if (!sessionId) return
    const channel = supabase.channel(`profile-monitor-${sessionId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'session_focus',
        filter: `session_id=eq.${sessionId}`
      }, (payload) => {
        const studentId = payload.new?.student_id
        if (!studentId) return
        // Find student across all programs
        setAllStudentsFlat(prev => {
          const found = prev.find(s => s.id === studentId)
          if (found) setSelectedStudent(found)
          return prev
        })
        // Also find and select their program
        setPrograms(prev => {
          for (const program of prev) {
            const enrolled = program.enrollments?.map(e => e.student_profiles).filter(s => s?.active) || []
            const target = enrolled.find(s => s.id === studentId)
            if (target) {
              setSelectedProgram(program)
              setStudents(enrolled)
              setSelectedStudent(target)
              break
            }
          }
          return prev
        })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [sessionId])

  async function loadPrograms() {
    let query = supabase.from('programs')
      .select('id, name, institution_id, institutions(name), enrollments(student_profiles(id, full_name, student_id, company, work_position, team, location, profile_photo_url, active))')
      .eq('archived', false)
      .order('name')

    if (institutionId) query = query.eq('institution_id', institutionId)

    const { data } = await query
    setPrograms(data || [])
    if (data?.[0]?.institutions?.name) setInstitutionName(data[0].institutions.name)

    // Flatten all students for realtime lookup
    const flat = (data || []).flatMap(p =>
      p.enrollments?.map(e => e.student_profiles).filter(s => s?.active) || []
    )
    setAllStudentsFlat(flat)

    // Deep-link: if a student ID is in the URL, find and show them immediately
    if (targetStudentId && data) {
      for (const program of data) {
        const allStudents = program.enrollments?.map(e => e.student_profiles).filter(s => s?.active) || []
        const target = allStudents.find(s => s.id === targetStudentId)
        if (target) {
          setSelectedProgram(program)
          setStudents(allStudents)
          setSelectedStudent(target)
          break
        }
      }
    }

    // If session provided, check current focus
    if (sessionId) {
      const { data: focus } = await supabase
        .from('session_focus').select('student_id').eq('session_id', sessionId).maybeSingle()
      if (focus?.student_id && data) {
        for (const program of data) {
          const enrolled = program.enrollments?.map(e => e.student_profiles).filter(s => s?.active) || []
          const target = enrolled.find(s => s.id === focus.student_id)
          if (target) {
            setSelectedProgram(program)
            setStudents(enrolled)
            setSelectedStudent(target)
            break
          }
        }
      }
    }

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
}


// ── Live Monitor — teacher screen, subscribes to session_focus ──
export function LiveMonitor() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session')

  const [student, setStudent]         = useState(null)
  const [programName, setProgramName] = useState('')
  const [allStudents, setAllStudents] = useState([])
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    if (!sessionId) { setLoading(false); return }
    loadSession()
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return
    const channel = supabase.channel(`live-monitor-${sessionId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'session_focus',
        filter: `session_id=eq.${sessionId}`
      }, (payload) => {
        const studentId = payload.new?.student_id
        if (studentId) {
          const found = allStudents.find(s => s.id === studentId)
          if (found) setStudent(found)
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [sessionId, allStudents])

  async function loadSession() {
    const { data: sess } = await supabase
      .from('sessions')
      .select('id, programs(name, enrollments(student_profiles(id, full_name, student_id, company, work_position, team, location, profile_photo_url, active)))')
      .eq('id', sessionId).single()

    if (!sess) { setLoading(false); return }
    setProgramName(sess.programs?.name || '')
    const enrolled = sess.programs?.enrollments?.map(e => e.student_profiles).filter(s => s?.active) || []
    setAllStudents(enrolled)

    // Check if there's already a focused student
    const { data: focus } = await supabase
      .from('session_focus').select('student_id').eq('session_id', sessionId).maybeSingle()
    if (focus?.student_id) {
      const found = enrolled.find(s => s.id === focus.student_id)
      if (found) setStudent(found)
    }

    setLoading(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
    </div>
  )

  if (!sessionId) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400">No session specified.</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Minimal header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3">
        <span className="text-xl">✋</span>
        <span className="font-bold text-gray-900">{programName || 'Live Monitor'}</span>
        <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium ml-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Live
        </span>
      </div>

      {/* Profile */}
      <div className="flex-1 flex items-center justify-center p-8">
        {!student ? (
          <div className="text-center">
            <p className="text-6xl mb-4 opacity-20">👤</p>
            <p className="text-gray-400">Waiting for admin to select a student…</p>
          </div>
        ) : (
          <StudentProfileCard
            student={student}
            programName={programName}
            year={new Date().getFullYear()}
          />
        )}
      </div>
    </div>
  )
}
