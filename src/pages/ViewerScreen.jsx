import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { StudentProfileCard, getStudentPhotoPath } from '../components/ui/StudentProfileCard'

export function ViewerScreen() {
  const { sessionId } = useParams()

  const [session, setSession]       = useState(null)
  const [focus, setFocus]           = useState(null)   // session_focus row
  const [students, setStudents]     = useState([])     // all enrolled students with team
  const [attendance, setAttendance] = useState([])
  const [hands, setHands]           = useState([])
  const [pollResponses, setPollResponses] = useState([])
  const [activePoll, setActivePoll] = useState(null)
  const [loading, setLoading]       = useState(true)
  const [clock, setClock]           = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => { loadAll() }, [sessionId])

  useEffect(() => {
    if (!sessionId) return
    const channel = supabase.channel(`viewer-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_focus',
        filter: `session_id=eq.${sessionId}` }, (p) => setFocus(p.new))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance',
        filter: `session_id=eq.${sessionId}` }, loadAttendance)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hands',
        filter: `session_id=eq.${sessionId}` }, loadHands)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls',
        filter: `session_id=eq.${sessionId}` }, loadActivePoll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_responses',
        filter: `session_id=eq.${sessionId}` }, loadPollResponses)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [sessionId])

  async function loadAll() {
    const { data: sess } = await supabase
      .from('sessions')
      .select('id, status, started_at, programs(name, enrollments(student_profiles(id, full_name, student_id, company, work_position, team, profile_photo_url)))')
      .eq('id', sessionId).single()
    if (!sess) { setLoading(false); return }
    setSession(sess)
    setStudents(sess.programs?.enrollments?.map(e => e.student_profiles).filter(Boolean) || [])

    // Load or create session_focus
    const { data: existingFocus } = await supabase
      .from('session_focus').select('*').eq('session_id', sessionId).maybeSingle()
    if (existingFocus) {
      setFocus(existingFocus)
    } else {
      const { data: newFocus } = await supabase
        .from('session_focus').insert({ session_id: sessionId, view: 'teams' }).select().single()
      setFocus(newFocus)
    }

    await Promise.all([loadAttendance(), loadHands(), loadActivePoll()])
    setLoading(false)
  }

  const loadAttendance = useCallback(async () => {
    const { data } = await supabase.from('attendance').select('student_id').eq('session_id', sessionId)
    setAttendance(data || [])
  }, [sessionId])

  const loadHands = useCallback(async () => {
    const { data } = await supabase.from('hands').select('student_id').eq('session_id', sessionId).is('lowered_at', null)
    setHands(data || [])
  }, [sessionId])

  const loadActivePoll = useCallback(async () => {
    const { data } = await supabase.from('polls').select('id, type, options, closed_at')
      .eq('session_id', sessionId).order('launched_at', { ascending: false }).limit(1).maybeSingle()
    setActivePoll(data || null)
    if (data) loadPollResponses(data.id)
  }, [sessionId])

  const loadPollResponses = useCallback(async (pollId) => {
    const id = pollId || activePoll?.id
    if (!id) return
    const { data } = await supabase.from('poll_responses').select('student_id, response').eq('poll_id', id)
    setPollResponses(data || [])
  }, [activePoll?.id])

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
    </div>
  )

  if (!session) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-500 text-xl">Session not found</p>
    </div>
  )

  // Group students by team
  const teams = {}
  students.forEach(s => {
    const team = s.team || 'Unassigned'
    if (!teams[team]) teams[team] = []
    teams[team].push(s)
  })

  const checkedInIds   = new Set(attendance.map(a => a.student_id))
  const handsUpIds     = new Set(hands.map(h => h.student_id))
  const respondedIds   = new Set(pollResponses.map(r => r.student_id))

  const selectedStudent = focus?.student_id
    ? students.find(s => s.id === focus.student_id)
    : null

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl">✋</span>
          <span className="font-bold">{session.programs?.name}</span>
          {focus?.view === 'profile' && selectedStudent && (
            <span className="text-gray-500 text-sm">· {selectedStudent.full_name}</span>
          )}
        </div>
        <div className="flex items-center gap-6 text-sm text-gray-500">
          <span>{checkedInIds.size} / {students.length} checked in</span>
          {handsUpIds.size > 0 && <span className="text-white">✋ {handsUpIds.size}</span>}
          <span className="font-mono">{clock.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">

        {/* Profile view */}
        {focus?.view === 'profile' && selectedStudent ? (
          <StudentProfileView
            student={selectedStudent}
            checkedIn={checkedInIds.has(selectedStudent.id)}
            handRaised={handsUpIds.has(selectedStudent.id)}
            responded={respondedIds.has(selectedStudent.id)}
            pollResponse={pollResponses.find(r => r.student_id === selectedStudent.id)?.response}
            activePoll={activePoll}
            programName={session?.programs?.name}
          />
        ) : focus?.view === 'roster' && focus?.team_name ? (
          /* Roster view — team's students */
          <RosterView
            teamName={focus.team_name}
            students={(teams[focus.team_name] || []).sort((a,b) => a.full_name.localeCompare(b.full_name))}
            checkedInIds={checkedInIds}
            handsUpIds={handsUpIds}
            respondedIds={respondedIds}
            sessionId={sessionId}
            focus={focus}
          />
        ) : (
          /* Teams list */
          <TeamsView
            teams={teams}
            checkedInIds={checkedInIds}
            handsUpIds={handsUpIds}
            sessionId={sessionId}
            focus={focus}
          />
        )}
      </div>
    </div>
  )
}

// ── Teams list ────────────────────────────────────────────
function TeamsView({ teams, checkedInIds, handsUpIds, sessionId }) {
  async function selectTeam(teamName) {
    await supabase.from('session_focus')
      .update({ view: 'roster', team_name: teamName, student_id: null, updated_at: new Date().toISOString() })
      .eq('session_id', sessionId)
  }

  const teamNames = Object.keys(teams).sort()

  return (
    <div className="flex-1 flex items-center justify-center p-12">
      <div className="w-full max-w-4xl">
        <p className="text-gray-500 text-sm uppercase tracking-widest text-center mb-8">Select a Team</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {teamNames.map(teamName => {
            const members    = teams[teamName]
            const checkedIn  = members.filter(s => checkedInIds.has(s.id)).length
            const handsUp    = members.filter(s => handsUpIds.has(s.id)).length
            return (
              <button key={teamName} onClick={() => selectTeam(teamName)}
                className="bg-gray-900 hover:bg-gray-800 border border-gray-700 hover:border-brand-500 rounded-2xl p-6 text-left transition-all group">
                <p className="font-bold text-white text-xl mb-2 group-hover:text-brand-400">{teamName}</p>
                <p className="text-gray-500 text-sm">{members.length} member{members.length !== 1 ? 's' : ''}</p>
                <div className="flex gap-3 mt-3 text-xs">
                  <span className={checkedIn === members.length ? 'text-green-400' : 'text-gray-600'}>
                    ✓ {checkedIn}/{members.length}
                  </span>
                  {handsUp > 0 && <span className="text-brand-400">✋ {handsUp}</span>}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Team roster ───────────────────────────────────────────
function RosterView({ teamName, students, checkedInIds, handsUpIds, respondedIds, sessionId }) {
  async function goBack() {
    await supabase.from('session_focus')
      .update({ view: 'teams', team_name: null, student_id: null, updated_at: new Date().toISOString() })
      .eq('session_id', sessionId)
  }

  async function selectStudent(studentId) {
    await supabase.from('session_focus')
      .update({ view: 'profile', student_id: studentId, updated_at: new Date().toISOString() })
      .eq('session_id', sessionId)
  }

  return (
    <div className="flex-1 flex flex-col p-12">
      <button onClick={goBack} className="text-gray-500 hover:text-white text-sm mb-8 text-left transition-colors">
        ← All Teams
      </button>
      <h2 className="text-3xl font-bold text-white mb-2">{teamName}</h2>
      <p className="text-gray-500 text-sm mb-8">{students.length} members</p>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {students.map(student => {
          const checkedIn  = checkedInIds.has(student.id)
          const handRaised = handsUpIds.has(student.id)
          const responded  = respondedIds.has(student.id)
          return (
            <button key={student.id} onClick={() => selectStudent(student.id)}
              className="bg-gray-900 hover:bg-gray-800 border border-gray-700 hover:border-brand-500 rounded-2xl p-4 text-left transition-all group">
              <div className="flex items-center gap-3 mb-2">
                <StudentAvatar student={student} size="10" />
                <div className="min-w-0">
                  <p className="font-semibold text-white text-sm truncate group-hover:text-brand-400">{student.full_name}</p>
                  <p className="text-gray-600 text-xs truncate">{student.work_position || student.company || ''}</p>
                </div>
              </div>
              <div className="flex gap-2 text-xs">
                {checkedIn  && <span className="text-green-400">✓ In</span>}
                {!checkedIn && <span className="text-gray-700">○ Out</span>}
                {handRaised && <span className="text-brand-400">✋</span>}
                {responded  && <span className="text-purple-400">✓ Poll</span>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Student profile view ──────────────────────────────────
function StudentProfileView({ student, checkedIn, handRaised, responded, pollResponse, activePoll, programName }) {
  const pollValue = activePoll && !activePoll.closed_at
    ? (responded ? pollResponse || '✓' : 'Waiting…')
    : (pollResponse || '—')

  return (
    <div className="flex-1 flex items-start justify-center p-10 overflow-y-auto bg-gray-950">
      <div className="w-full max-w-lg">
        <StudentProfileCard
          student={student}
          programName={programName}
          year={new Date().getFullYear()}
          status={{
            checkedIn,
            handRaised,
            responded,
            pollResponse: pollValue,
          }}
          dark
        />
      </div>
    </div>
  )
}

function StudentAvatar({ student, size = '10' }) {
  const initials = student?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'
  return (
    <div className={`w-${size} h-${size} rounded-full bg-brand-600 flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden`}
      style={{ minWidth: `${parseInt(size) * 4}px`, minHeight: `${parseInt(size) * 4}px` }}>
      {student?.profile_photo_url
        ? <img src={student.profile_photo_url} alt="" className="w-full h-full object-cover" />
        : <span style={{ fontSize: `${Math.max(0.7, parseInt(size) * 0.18)}rem` }}>{initials}</span>}
    </div>
  )
}
