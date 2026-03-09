import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { AdminLayout } from '../../components/layout/AdminLayout'
import { formatDistanceToNow } from 'date-fns'

const POLL_TYPES = [
  { key: 'yes_no',          label: 'Yes / No',   options: ['Yes', 'No'] },
  { key: 'true_false',      label: 'True / False', options: ['True', 'False'] },
  { key: 'ab',              label: 'A / B',       options: ['A', 'B'] },
  { key: 'abc',             label: 'A / B / C',   options: ['A', 'B', 'C'] },
  { key: 'abcd',            label: 'A / B / C / D', options: ['A', 'B', 'C', 'D'] },
  { key: 'abcde',           label: 'A / B / C / D / E', options: ['A', 'B', 'C', 'D', 'E'] },
  { key: 'rating',          label: '1 – 5 Rating', options: ['1', '2', '3', '4', '5'] },
  { key: 'word_cloud',      label: 'Word Cloud',  options: [] },
  { key: 'multiple_choice', label: 'Multi Choice', options: [] },
]

export function AdminSession() {
  const { sessionId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [session, setSession]       = useState(null)
  const [program, setProgram]       = useState(null)
  const [enrolled, setEnrolled]     = useState([])  // all enrolled students
  const [hands, setHands]           = useState([])  // active raised hands
  const [calledOn, setCalledOn]     = useState([])  // called-on log this session
  const [attendance, setAttendance] = useState([])  // checked-in students
  const [activePoll, setActivePoll] = useState(null)
  const [pollResponses, setPollResponses] = useState([])
  const [loading, setLoading]       = useState(true)
  const [tab, setTab]               = useState('hands') // 'hands' | 'attendance'
  const [ending, setEnding]         = useState(false)

  // ── Initial load ─────────────────────────────────────
  useEffect(() => { loadSession() }, [sessionId])

  // ── Realtime subscriptions ───────────────────────────
  useEffect(() => {
    if (!sessionId) return

    const channel = supabase.channel(`session-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hands',
        filter: `session_id=eq.${sessionId}` }, loadHands)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance',
        filter: `session_id=eq.${sessionId}` }, loadAttendance)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls',
        filter: `session_id=eq.${sessionId}` }, loadActivePoll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_responses',
        filter: `session_id=eq.${sessionId}` }, loadPollResponses)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [sessionId])

  async function loadSession() {
    const { data } = await supabase
      .from('sessions')
      .select('id, status, started_at, programs(id, name, enrollments(student_profiles(id, full_name, student_id, company, work_position, profile_photo_url)))')
      .eq('id', sessionId)
      .single()

    if (!data) { navigate('/admin'); return }
    setSession(data)
    setProgram(data.programs)
    setEnrolled(data.programs?.enrollments?.map(e => e.student_profiles).filter(Boolean) || [])

    await Promise.all([loadHands(), loadAttendance(), loadActivePoll()])
    setLoading(false)
  }

  const loadHands = useCallback(async () => {
    const { data } = await supabase
      .from('hands')
      .select('id, raised_at, lowered_at, called_on_at, student_profiles(id, full_name, student_id, company, work_position, profile_photo_url)')
      .eq('session_id', sessionId)
      .is('lowered_at', null)
      .order('raised_at', { ascending: true })
    setHands(data || [])

    const { data: called } = await supabase
      .from('hands')
      .select('id, called_on_at, student_profiles(id, full_name, profile_photo_url)')
      .eq('session_id', sessionId)
      .not('called_on_at', 'is', null)
      .order('called_on_at', { ascending: false })
      .limit(10)
    setCalledOn(called || [])
  }, [sessionId])

  const loadAttendance = useCallback(async () => {
    const { data } = await supabase
      .from('attendance')
      .select('id, checked_in_at, status, student_profiles(id, full_name, student_id, company, profile_photo_url)')
      .eq('session_id', sessionId)
      .order('checked_in_at', { ascending: true })
    setAttendance(data || [])
  }, [sessionId])

  const loadActivePoll = useCallback(async () => {
    const { data } = await supabase
      .from('polls')
      .select('id, type, options, launched_at, show_on_presenter')
      .eq('session_id', sessionId)
      .is('closed_at', null)
      .order('launched_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setActivePoll(data || null)
    if (data) loadPollResponses()
  }, [sessionId])

  const loadPollResponses = useCallback(async () => {
    if (!activePoll?.id) return
    const { data } = await supabase
      .from('poll_responses')
      .select('response')
      .eq('poll_id', activePoll.id)
    setPollResponses(data || [])
  }, [activePoll?.id])

  // Reload poll responses when activePoll changes
  useEffect(() => { if (activePoll) loadPollResponses() }, [activePoll?.id])

  // ── Hand actions ─────────────────────────────────────
  async function callOn(hand) {
    await supabase.from('hands').update({
      called_on_at: new Date().toISOString(),
      lowered_at:   new Date().toISOString(),
    }).eq('id', hand.id)
  }

  async function lowerHand(hand) {
    await supabase.from('hands').update({ lowered_at: new Date().toISOString() }).eq('id', hand.id)
  }

  async function lowerAllHands() {
    await supabase.from('hands')
      .update({ lowered_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .is('lowered_at', null)
  }

  // ── Poll actions ─────────────────────────────────────
  async function launchPoll(type) {
    // Close any open poll first
    if (activePoll) {
      await supabase.from('polls').update({ closed_at: new Date().toISOString() }).eq('id', activePoll.id)
    }
    await supabase.from('polls').insert({
      session_id: sessionId,
      type,
      launched_at: new Date().toISOString(),
    })
  }

  async function closePoll() {
    if (!activePoll) return
    await supabase.from('polls').update({ closed_at: new Date().toISOString() }).eq('id', activePoll.id)
    setActivePoll(null)
    setPollResponses([])
  }

  async function togglePresenter() {
    if (!activePoll) return
    await supabase.from('polls').update({ show_on_presenter: !activePoll.show_on_presenter }).eq('id', activePoll.id)
  }

  async function launchConfidenceCheck() {
    await supabase.from('confidence_checks').insert({
      session_id: sessionId,
      launched_at: new Date().toISOString(),
    })
  }

  // ── End session ──────────────────────────────────────
  async function endSession() {
    setEnding(true)
    if (activePoll) await supabase.from('polls').update({ closed_at: new Date().toISOString() }).eq('id', activePoll.id)
    await supabase.from('sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', sessionId)
    navigate('/admin')
  }

  if (loading) return (
    <AdminLayout>
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    </AdminLayout>
  )

  const presenterUrl = `${window.location.origin}/presenter/${sessionId}`

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-green-600 uppercase tracking-wide">Live</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{program?.name}</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              Started {formatDistanceToNow(new Date(session.started_at), { addSuffix: true })}
              {' · '}{attendance.length} checked in · {enrolled.length} enrolled
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={presenterUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary text-sm py-2"
            >
              📺 Presenter screen ↗
            </a>
            <button
              onClick={endSession}
              disabled={ending}
              className="btn-danger text-sm py-2"
            >
              {ending ? 'Ending…' : 'End Session'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left: Hand queue + attendance ─────────── */}
          <div className="lg:col-span-1 space-y-4">

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setTab('hands')}
                className={`flex-1 text-sm font-medium py-1.5 rounded-lg transition-colors ${tab === 'hands' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                ✋ Hands {hands.length > 0 && <span className="ml-1 bg-brand-500 text-white text-xs rounded-full px-1.5">{hands.length}</span>}
              </button>
              <button
                onClick={() => setTab('attendance')}
                className={`flex-1 text-sm font-medium py-1.5 rounded-lg transition-colors ${tab === 'attendance' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                👥 Attendance
              </button>
            </div>

            {tab === 'hands' && (
              <HandQueue
                hands={hands}
                calledOn={calledOn}
                onCallOn={callOn}
                onLower={lowerHand}
                onLowerAll={lowerAllHands}
              />
            )}

            {tab === 'attendance' && (
              <AttendancePanel
                enrolled={enrolled}
                attendance={attendance}
              />
            )}
          </div>

          {/* ── Right: Poll panel + launcher ──────────── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Active poll */}
            {activePoll ? (
              <ActivePollPanel
                poll={activePoll}
                responses={pollResponses}
                enrolled={enrolled}
                onClose={closePoll}
                onTogglePresenter={togglePresenter}
                presenterUrl={presenterUrl}
              />
            ) : (
              <div className="card text-center py-8 border-dashed">
                <p className="text-gray-400 text-sm">No active poll</p>
                <p className="text-gray-300 text-xs mt-1">Launch one below</p>
              </div>
            )}

            {/* Poll launcher */}
            <PollLauncher onLaunch={launchPoll} onConfidenceCheck={launchConfidenceCheck} />
          </div>

        </div>
      </div>
    </AdminLayout>
  )
}


// ── Hand Queue ────────────────────────────────────────────
function HandQueue({ hands, calledOn, onCallOn, onLower, onLowerAll }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">
          Queue {hands.length > 0 ? `(${hands.length})` : ''}
        </p>
        {hands.length > 1 && (
          <button onClick={onLowerAll} className="text-xs text-red-400 hover:text-red-600">
            Lower all
          </button>
        )}
      </div>

      {hands.length === 0 ? (
        <div className="card text-center py-6 border-dashed">
          <p className="text-2xl mb-1">✋</p>
          <p className="text-gray-400 text-sm">No hands raised</p>
        </div>
      ) : (
        <div className="space-y-2">
          {hands.map((hand, i) => (
            <HandCard
              key={hand.id}
              hand={hand}
              position={i + 1}
              onCallOn={() => onCallOn(hand)}
              onLower={() => onLower(hand)}
            />
          ))}
        </div>
      )}

      {/* Called on log */}
      {calledOn.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Called on</p>
          <div className="space-y-1">
            {calledOn.map(hand => (
              <div key={hand.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50">
                <Avatar student={hand.student_profiles} size={6} />
                <span className="text-sm text-gray-500 line-through truncate">
                  {hand.student_profiles?.full_name}
                </span>
                <span className="text-xs text-gray-300 ml-auto flex-shrink-0">
                  {formatDistanceToNow(new Date(hand.called_on_at), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function HandCard({ hand, position, onCallOn, onLower }) {
  const s = hand.student_profiles
  return (
    <div className="card flex items-center gap-3 py-3">
      <span className="text-xs font-bold text-gray-300 w-4 text-center flex-shrink-0">
        {position}
      </span>
      <Avatar student={s} size={8} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm truncate">{s?.full_name}</p>
        <p className="text-xs text-gray-400 truncate">
          {[s?.work_position, s?.company].filter(Boolean).join(' · ') || s?.student_id}
        </p>
      </div>
      <div className="flex gap-1.5 flex-shrink-0">
        <button onClick={onCallOn} className="btn-primary text-xs py-1.5 px-3">
          Call on
        </button>
        <button onClick={onLower} className="btn-secondary text-xs py-1.5 px-3">
          Lower
        </button>
      </div>
    </div>
  )
}


// ── Attendance Panel ──────────────────────────────────────
function AttendancePanel({ enrolled, attendance }) {
  const checkedInIds = new Set(attendance.map(a => a.student_profiles?.id).filter(Boolean))
  const checkedIn  = attendance
  const absent     = enrolled.filter(s => !checkedInIds.has(s.id))

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700">
        {checkedIn.length} of {enrolled.length} checked in
      </p>

      {checkedIn.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Present ({checkedIn.length})</p>
          <div className="space-y-1">
            {checkedIn.map(a => (
              <div key={a.id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-green-100">
                <Avatar student={a.student_profiles} size={6} />
                <span className="text-sm text-gray-900 flex-1 truncate">{a.student_profiles?.full_name}</span>
                <span className="text-xs text-gray-300 flex-shrink-0">
                  {formatDistanceToNow(new Date(a.checked_in_at), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {absent.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Not checked in ({absent.length})</p>
          <div className="space-y-1">
            {absent.map(s => (
              <div key={s.id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 opacity-50">
                <Avatar student={s} size={6} />
                <span className="text-sm text-gray-500 truncate">{s.full_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


// ── Active Poll Panel ─────────────────────────────────────
function ActivePollPanel({ poll, responses, enrolled, onClose, onTogglePresenter, presenterUrl }) {
  const pollType  = POLL_TYPES.find(p => p.key === poll.type)
  const options   = pollType?.options || []
  const total     = responses.length
  const pct       = enrolled.length > 0 ? Math.round((total / enrolled.length) * 100) : 0

  // Tally responses
  const tally = {}
  options.forEach(o => { tally[o] = 0 })
  responses.forEach(r => { tally[r.response] = (tally[r.response] || 0) + 1 })

  const maxVal = Math.max(...Object.values(tally), 1)

  return (
    <div className="card border-brand-200 border-2">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
            <span className="text-xs font-medium text-brand-500 uppercase tracking-wide">Poll Active</span>
          </div>
          <p className="font-semibold text-gray-900">{pollType?.label}</p>
          <p className="text-sm text-gray-400 mt-0.5">
            {total} response{total !== 1 ? 's' : ''} · {pct}% of class
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onTogglePresenter}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              poll.show_on_presenter
                ? 'bg-brand-500 text-white border-brand-500'
                : 'bg-white text-gray-500 border-gray-200 hover:border-brand-300'
            }`}
          >
            📺 {poll.show_on_presenter ? 'Showing' : 'Show on projector'}
          </button>
          <button onClick={onClose} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
            Close poll
          </button>
        </div>
      </div>

      {/* Results bars */}
      {poll.type === 'word_cloud' ? (
        <WordCloudResults responses={responses} />
      ) : (
        <div className="space-y-2">
          {options.map(opt => {
            const count = tally[opt] || 0
            const barPct = Math.round((count / maxVal) * 100)
            return (
              <div key={opt} className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-600 w-24 flex-shrink-0">{opt}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                  <div
                    className="h-full bg-brand-400 rounded-full transition-all duration-500 flex items-center pl-3"
                    style={{ width: `${barPct}%`, minWidth: count > 0 ? '2rem' : '0' }}
                  />
                </div>
                <span className="text-sm font-semibold text-gray-700 w-8 text-right">{count}</span>
                <span className="text-xs text-gray-400 w-8">
                  {total > 0 ? `${Math.round((count / total) * 100)}%` : '0%'}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Response progress */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
          <span>Responses</span>
          <span>{total} / {enrolled.length}</span>
        </div>
        <div className="bg-gray-100 rounded-full h-1.5">
          <div
            className="bg-green-400 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function WordCloudResults({ responses }) {
  const freq = {}
  responses.forEach(r => {
    const words = r.response.toLowerCase().split(/\s+/)
    words.forEach(w => { if (w) freq[w] = (freq[w] || 0) + 1 })
  })
  const max = Math.max(...Object.values(freq), 1)
  const words = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 30)

  if (words.length === 0) return <p className="text-center text-gray-300 py-4 text-sm">Waiting for responses…</p>

  return (
    <div className="flex flex-wrap gap-2 py-2">
      {words.map(([word, count]) => (
        <span
          key={word}
          className="bg-brand-50 text-brand-600 rounded-lg px-2 py-1 font-medium transition-all"
          style={{ fontSize: `${Math.max(0.7, (count / max) * 1.8)}rem` }}
        >
          {word}
        </span>
      ))}
    </div>
  )
}


// ── Poll Launcher ─────────────────────────────────────────
function PollLauncher({ onLaunch, onConfidenceCheck }) {
  const quickTypes = POLL_TYPES.filter(t => t.key !== 'multiple_choice')

  return (
    <div className="card">
      <p className="text-sm font-medium text-gray-700 mb-3">Launch Poll</p>
      <div className="flex flex-wrap gap-2">
        {quickTypes.map(type => (
          <button
            key={type.key}
            onClick={() => onLaunch(type.key)}
            className="text-xs font-medium px-3 py-2 rounded-xl bg-gray-100 hover:bg-brand-50 hover:text-brand-600 transition-colors border border-transparent hover:border-brand-200"
          >
            {type.label}
          </button>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
        <button
          onClick={onConfidenceCheck}
          className="text-xs font-medium px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-colors"
        >
          🎯 Check Understanding
        </button>
        <span className="text-xs text-gray-400">Launches a 1–5 confidence check</span>
      </div>
    </div>
  )
}


// ── Avatar ────────────────────────────────────────────────
function Avatar({ student, size = 8 }) {
  if (!student) return <div className={`avatar w-${size} h-${size} text-xs`}>?</div>
  const initials = student.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className={`avatar w-${size} h-${size} text-xs flex-shrink-0`}>
      {student.profile_photo_url
        ? <img src={student.profile_photo_url} alt={student.full_name} className="w-full h-full object-cover rounded-full" />
        : initials
      }
    </div>
  )
}
