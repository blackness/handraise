import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const POLL_TYPE_LABELS = {
  yes_no:     'Yes / No',
  true_false: 'True / False',
  ab:         'A / B',
  abc:        'A / B / C',
  abcd:       'A / B / C / D',
  abcde:      'A / B / C / D / E',
  rating:     '1–5 Rating',
  word_cloud: 'Word Cloud',
  confidence: 'Check Understanding',
}

const POLL_OPTIONS = {
  yes_no:     ['Yes', 'No'],
  true_false: ['True', 'False'],
  ab:         ['A', 'B'],
  abc:        ['A', 'B', 'C'],
  abcd:       ['A', 'B', 'C', 'D'],
  abcde:      ['A', 'B', 'C', 'D', 'E'],
  rating:     ['1', '2', '3', '4', '5'],
  confidence: ['1', '2', '3', '4', '5'],
}

const CONFIDENCE_LABELS = { '1': 'Totally lost', '2': 'A bit unsure', '3': 'Mostly got it', '4': 'Pretty clear', '5': 'Got it' }
const CONFIDENCE_COLORS = { '1': '#ef4444', '2': '#f97316', '3': '#f59e0b', '4': '#84cc16', '5': '#22c55e' }
const BAR_COLORS = ['#818cf8', '#6366f1', '#a855f7', '#0ea5e9', '#14b8a6']

export function PresenterScreen() {
  const { sessionId } = useParams()

  const [session, setSession]             = useState(null)
  const [activePoll, setActivePoll]       = useState(null)
  const [pollResponses, setPollResponses] = useState([])
  const [enrolled, setEnrolled]           = useState([])
  const [attendance, setAttendance]       = useState([])
  const [loading, setLoading]             = useState(true)
  const [clock, setClock]                 = useState(new Date())
  const activePollRef                     = useRef(null)

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => { loadSession() }, [sessionId])

  useEffect(() => {
    if (!sessionId) return
    const channel = supabase.channel(`presenter-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls',
        filter: `session_id=eq.${sessionId}` }, loadActivePoll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_responses',
        filter: `session_id=eq.${sessionId}` }, (payload) => loadPollResponses(payload.new?.poll_id, false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'confidence_checks',
        filter: `session_id=eq.${sessionId}` }, loadActivePoll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'confidence_responses',
        filter: `session_id=eq.${sessionId}` }, (payload) => loadPollResponses(payload.new?.check_id, true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance',
        filter: `session_id=eq.${sessionId}` }, loadAttendance)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions',
        filter: `id=eq.${sessionId}` }, (p) => {
          if (p.new.status === 'ended') setSession(s => ({ ...s, status: 'ended' }))
        })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [sessionId])

  async function loadSession() {
    const { data } = await supabase
      .from('sessions')
      .select('id, status, started_at, programs(name, enrollments(student_profiles(id)))')
      .eq('id', sessionId).single()
    if (!data) { setLoading(false); return }
    setSession(data)
    setEnrolled(data.programs?.enrollments?.map(e => e.student_profiles).filter(Boolean) || [])
    await Promise.all([loadActivePoll(), loadAttendance()])
    setLoading(false)
  }

  const loadActivePoll = useCallback(async () => {
    const [{ data: poll }, { data: cc }] = await Promise.all([
      supabase.from('polls').select('id, type, options, launched_at, closed_at')
        .eq('session_id', sessionId).order('launched_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('confidence_checks').select('id, launched_at, closed_at')
        .eq('session_id', sessionId).order('launched_at', { ascending: false }).limit(1).maybeSingle(),
    ])

    const pollOpen = poll && !poll.closed_at
    const ccOpen   = cc && !cc.closed_at
    let active = null

    if (pollOpen && ccOpen) {
      active = new Date(poll.launched_at) > new Date(cc.launched_at) ? poll : { ...cc, type: 'confidence' }
    } else if (pollOpen) {
      active = poll
    } else if (ccOpen) {
      active = { ...cc, type: 'confidence' }
    } else {
      const candidates = [poll, cc ? { ...cc, type: 'confidence' } : null].filter(Boolean)
      candidates.sort((a, b) => new Date(b.launched_at) - new Date(a.launched_at))
      active = candidates[0] || null
    }

    activePollRef.current = active
    setActivePoll(active)
    if (active) loadPollResponses(active.id, active.type === 'confidence')
  }, [sessionId])

  const loadPollResponses = useCallback(async (pollId, isConf) => {
    const id   = pollId || activePollRef.current?.id
    const conf = isConf ?? activePollRef.current?.type === 'confidence'
    if (!id) return

    const table    = conf ? 'confidence_responses' : 'poll_responses'
    const fkField  = conf ? 'check_id' : 'poll_id'
    const valField = conf ? 'score' : 'response'

    const { data } = await supabase
      .from(table)
      .select(valField)
      .eq(fkField, id)
    setPollResponses((data || []).map(r => ({ response: String(r[valField]) })))
  }, [])

  const loadAttendance = useCallback(async () => {
    const { data } = await supabase.from('attendance').select('id').eq('session_id', sessionId)
    setAttendance(data || [])
  }, [sessionId])

  useEffect(() => { if (activePoll?.id) loadPollResponses(activePoll.id, activePoll.type === 'confidence') }, [activePoll?.id])

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

  if (session.status === 'ended') return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
      <span className="text-7xl">👋</span>
      <p className="text-white text-3xl font-bold">Session ended</p>
      <p className="text-gray-500">Thanks for participating</p>
    </div>
  )

  const responseCount = pollResponses.length
  const enrolledCount = enrolled.length
  const responsePct   = enrolledCount > 0 ? Math.round((responseCount / enrolledCount) * 100) : 0
  const isOpen        = activePoll && !activePoll.closed_at

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* Top bar */}
      <div className="flex items-center justify-between px-10 py-4 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl">✋</span>
          <span className="font-bold text-white">{session.programs?.name}</span>
          {activePoll && (
            <span className={`ml-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide ${isOpen ? 'text-brand-400' : 'text-gray-600'}`}>
              {isOpen && <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />}
              {POLL_TYPE_LABELS[activePoll.type]}
              {!isOpen && <span className="ml-1 text-gray-700">· closed</span>}
            </span>
          )}
        </div>
        <div className="flex items-center gap-8 text-sm text-gray-500">
          <span>{attendance.length}<span className="text-gray-700">/{enrolledCount} checked in</span></span>
          <span className="font-mono">{clock.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Main content — always poll results */}
      <div className="flex-1 flex flex-col items-center justify-center px-16 py-12">
        {!activePoll ? (
          <WaitingState programName={session.programs?.name} />
        ) : activePoll.type === 'word_cloud' ? (
          <WordCloudView responses={pollResponses} isOpen={isOpen} />
        ) : (
          <BarChartView
            poll={activePoll}
            responses={pollResponses}
            enrolled={enrolled}
            isOpen={isOpen}
          />
        )}
      </div>

      {/* Response progress bar — bottom */}
      {activePoll && (
        <div className="px-10 pb-8 flex-shrink-0">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>{isOpen ? 'Collecting responses…' : 'Poll closed'}</span>
            <span className="font-medium text-gray-400">{responseCount} / {enrolledCount} &nbsp;·&nbsp; {responsePct}%</span>
          </div>
          <div className="bg-gray-800 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-700 ${isOpen ? 'bg-brand-500' : 'bg-gray-600'}`}
              style={{ width: `${responsePct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}


// ── Waiting state ─────────────────────────────────────────
function WaitingState({ programName }) {
  return (
    <div className="text-center">
      <div className="text-8xl mb-6 opacity-10">📊</div>
      <p className="text-gray-600 text-2xl">No poll active</p>
      <p className="text-gray-700 text-base mt-2">Results will appear here when a poll is launched</p>
    </div>
  )
}


// ── Bar chart ─────────────────────────────────────────────
function BarChartView({ poll, responses, enrolled, isOpen }) {
  const isConf    = poll.type === 'confidence'
  const options   = POLL_OPTIONS[poll.type] || poll.options || []
  const total     = responses.length

  const tally = {}
  options.forEach(o => { tally[o] = 0 })
  responses.forEach(r => { tally[r.response] = (tally[r.response] || 0) + 1 })
  const max = Math.max(...Object.values(tally), 1)

  return (
    <div className="w-full max-w-4xl">
      <div className="space-y-5">
        {options.map((opt, i) => {
          const count   = tally[opt] || 0
          const barPct  = max > 0 ? Math.round((count / max) * 100) : 0
          const sharePct = total > 0 ? Math.round((count / total) * 100) : 0
          const color   = isConf ? CONFIDENCE_COLORS[opt] : BAR_COLORS[i % BAR_COLORS.length]

          return (
            <div key={opt} className="flex items-center gap-6">
              {/* Label */}
              <div className="w-32 text-right flex-shrink-0">
                <span className="text-2xl font-bold text-gray-200">{opt}</span>
                {isConf && (
                  <p className="text-xs text-gray-600 mt-0.5">{CONFIDENCE_LABELS[opt]}</p>
                )}
              </div>

              {/* Bar */}
              <div className="flex-1 bg-gray-800 rounded-full h-14 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 flex items-center justify-end pr-5"
                  style={{
                    width: `${barPct}%`,
                    minWidth: count > 0 ? '4rem' : '0',
                    backgroundColor: color,
                  }}
                >
                  {count > 0 && barPct > 12 && (
                    <span className="text-white font-bold text-lg">{sharePct}%</span>
                  )}
                </div>
              </div>

              {/* Count */}
              <div className="w-12 text-right flex-shrink-0">
                <span className="text-2xl font-bold text-gray-400">{count}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ── Word cloud ────────────────────────────────────────────
function WordCloudView({ responses, isOpen }) {
  const freq = {}
  responses.forEach(r => {
    r.response.toLowerCase().split(/\s+/).forEach(w => {
      if (w.length > 1) freq[w] = (freq[w] || 0) + 1
    })
  })
  const max   = Math.max(...Object.values(freq), 1)
  const words = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 40)

  if (words.length === 0) return (
    <div className="text-center">
      <p className="text-gray-600 text-2xl">{isOpen ? 'Waiting for responses…' : 'No responses'}</p>
    </div>
  )

  return (
    <div className="flex flex-wrap gap-5 justify-center max-w-5xl">
      {words.map(([word, count]) => (
        <span
          key={word}
          className="font-bold transition-all duration-500"
          style={{
            fontSize:  `${Math.max(1.2, (count / max) * 6)}rem`,
            color:     `hsl(${(word.charCodeAt(0) * 37) % 360}, 70%, 65%)`,
          }}
        >
          {word}
        </span>
      ))}
    </div>
  )
}
