import { useEffect, useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export function StudentSession() {
  const { student, signOut } = useAuth()
  const navigate = useNavigate()

  const [session, setSession]       = useState(null)   // active session
  const [waiting, setWaiting]       = useState(false)  // no session yet
  const [hand, setHand]             = useState(null)   // current hand row
  const [checkedIn, setCheckedIn]   = useState(false)
  const [activePoll, setActivePoll] = useState(null)
  const [responded, setResponded]   = useState(false)
  const [queuePos, setQueuePos]     = useState(null)
  const [loading, setLoading]       = useState(true)
  const [calledOn, setCalledOn]     = useState(false)  // flash when called on

  const profile = student?.profile

  // ── Find active session for this student ─────────────
  useEffect(() => { findSession() }, [])

  async function findSession() {
    // Find programs this student is enrolled in
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('program_id')
      .eq('student_id', profile.id)

    if (!enrollments?.length) { setWaiting(true); setLoading(false); return }

    const programIds = enrollments.map(e => e.program_id)

    // Find active session for any of those programs
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, program_id, status, programs(name)')
      .in('program_id', programIds)
      .eq('status', 'active')
      .limit(1)

    if (!sessions?.length) {
      setWaiting(true)
      setLoading(false)
      // Subscribe to session start
      subscribeToSessionStart(programIds)
      return
    }

    await enterSession(sessions[0])
    setLoading(false)
  }

  function subscribeToSessionStart(programIds) {
    const channel = supabase.channel('waiting-for-session')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions' },
        async (payload) => {
          if (payload.new.status === 'active' && programIds.includes(payload.new.program_id)) {
            const { data } = await supabase
              .from('sessions')
              .select('id, program_id, status, programs(name)')
              .eq('id', payload.new.id)
              .single()
            if (data) {
              setWaiting(false)
              await enterSession(data)
              supabase.removeChannel(channel)
            }
          }
        })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }

  async function enterSession(sess) {
    setSession(sess)

    // Check if already checked in
    const { data: att } = await supabase
      .from('attendance')
      .select('id')
      .eq('session_id', sess.id)
      .eq('student_id', profile.id)
      .maybeSingle()
    setCheckedIn(!!att)

    // Check for active hand
    const { data: h } = await supabase
      .from('hands')
      .select('id, raised_at')
      .eq('session_id', sess.id)
      .eq('student_id', profile.id)
      .is('lowered_at', null)
      .maybeSingle()
    setHand(h || null)

    // Check for active poll
    await loadActivePoll(sess.id)

    // Subscribe to realtime updates
    subscribeToSession(sess.id)
  }

  function subscribeToSession(sessionId) {
    const channel = supabase.channel(`student-session-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls',
        filter: `session_id=eq.${sessionId}` }, () => loadActivePoll(sessionId))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hands',
        filter: `session_id=eq.${sessionId}` }, (payload) => {
          // Detect if our hand was called on
          if (payload.new.student_id === profile.id && payload.new.called_on_at && !payload.old.called_on_at) {
            setCalledOn(true)
            setTimeout(() => setCalledOn(false), 5000)
          }
          if (payload.new.student_id === profile.id) {
            if (payload.new.lowered_at) setHand(null)
          }
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions',
        filter: `id=eq.${sessionId}` }, (payload) => {
          if (payload.new.status === 'ended') {
            setSession(s => ({ ...s, status: 'ended' }))
          }
        })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }

  const loadActivePoll = useCallback(async (sessionId) => {
    const sid = sessionId || session?.id
    if (!sid) return

    const { data } = await supabase
      .from('polls')
      .select('id, type, options, launched_at')
      .eq('session_id', sid)
      .is('closed_at', null)
      .order('launched_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data?.id !== activePoll?.id) setResponded(false)
    setActivePoll(data || null)

    // Also check confidence checks
    if (!data) {
      const { data: cc } = await supabase
        .from('confidence_checks')
        .select('id, launched_at')
        .eq('session_id', sid)
        .is('closed_at', null)
        .order('launched_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setActivePoll(cc ? { ...cc, type: 'confidence' } : null)
      if (cc?.id !== activePoll?.id) setResponded(false)
    }
  }, [session?.id, activePoll?.id])

  // Queue position
  useEffect(() => {
    if (!hand || !session) { setQueuePos(null); return }
    supabase
      .from('hands')
      .select('id', { count: 'exact' })
      .eq('session_id', session.id)
      .is('lowered_at', null)
      .lte('raised_at', hand.raised_at)
      .then(({ count }) => setQueuePos(count))
  }, [hand, session])

  // ── Actions ──────────────────────────────────────────
  async function checkIn() {
    await supabase.from('attendance').insert({
      student_id:    profile.id,
      session_id:    session.id,
      checked_in_at: new Date().toISOString(),
      status:        'present',
    })
    setCheckedIn(true)
  }

  async function raiseHand() {
    const { data } = await supabase.from('hands').insert({
      student_id: profile.id,
      session_id: session.id,
      raised_at:  new Date().toISOString(),
    }).select().single()
    setHand(data)
  }

  async function lowerHand() {
    if (!hand) return
    await supabase.from('hands').update({ lowered_at: new Date().toISOString() }).eq('id', hand.id)
    setHand(null)
  }

  async function submitResponse(response) {
    if (responded) return
    const table  = activePoll.type === 'confidence' ? 'confidence_responses' : 'poll_responses'
    const field  = activePoll.type === 'confidence' ? 'score' : 'response'
    const fkField = activePoll.type === 'confidence' ? 'check_id' : 'poll_id'

    await supabase.from(table).insert({
      [fkField]:   activePoll.id,
      session_id:  session.id,
      student_id:  profile.id,
      [field]:     response,
    })
    setResponded(true)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/join')
  }

  if (loading) return (
    <div className="min-h-screen bg-brand-500 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
    </div>
  )

  // ── Waiting for session ───────────────────────────────
  if (waiting) return (
    <div className="min-h-screen bg-brand-500 flex flex-col items-center justify-center p-6 text-center">
      <span className="text-6xl mb-6">⏳</span>
      <h1 className="text-2xl font-bold text-white">Class hasn't started yet</h1>
      <p className="text-brand-200 mt-2">You'll be connected automatically when your session begins.</p>
      <div className="flex items-center gap-2 mt-6">
        <div className="w-2 h-2 rounded-full bg-brand-300 animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 rounded-full bg-brand-300 animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 rounded-full bg-brand-300 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <p className="text-brand-300 text-sm mt-8">{profile?.full_name}</p>
      <button onClick={handleSignOut} className="text-brand-300 text-xs hover:text-white mt-2 transition-colors">
        Sign out
      </button>
    </div>
  )

  // ── Session ended ─────────────────────────────────────
  if (session?.status === 'ended') return (
    <div className="min-h-screen bg-brand-500 flex flex-col items-center justify-center p-6 text-center">
      <span className="text-6xl mb-6">👋</span>
      <h1 className="text-2xl font-bold text-white">Session ended</h1>
      <p className="text-brand-200 mt-2">Thanks for participating!</p>
      <button onClick={handleSignOut} className="btn-secondary mt-8 bg-white text-brand-500">
        Sign out
      </button>
    </div>
  )

  // ── Called on flash ───────────────────────────────────
  if (calledOn) return (
    <div className="min-h-screen bg-green-500 flex flex-col items-center justify-center p-6 text-center animate-pulse">
      <span className="text-8xl mb-6">🎯</span>
      <h1 className="text-3xl font-bold text-white">You've been called on!</h1>
      <p className="text-green-100 mt-3 text-lg">It's your turn to speak</p>
    </div>
  )

  // ── Check in screen ───────────────────────────────────
  if (!checkedIn) return (
    <SessionShell profile={profile} session={session} onSignOut={handleSignOut}>
      <div className="flex flex-col items-center justify-center flex-1 text-center px-6">
        <span className="text-7xl mb-6">👋</span>
        <h2 className="text-2xl font-bold text-gray-900">Welcome!</h2>
        <p className="text-gray-500 mt-2 mb-8">Tap to check in to today's session</p>
        <button onClick={checkIn} className="btn-primary text-xl py-5 px-12 rounded-2xl w-full max-w-xs">
          Check In
        </button>
      </div>
    </SessionShell>
  )

  // ── Active poll ───────────────────────────────────────
  if (activePoll && !responded) return (
    <SessionShell profile={profile} session={session} onSignOut={handleSignOut}>
      <PollUI poll={activePoll} onSubmit={submitResponse} />
    </SessionShell>
  )

  // ── Poll responded ────────────────────────────────────
  if (activePoll && responded) return (
    <SessionShell profile={profile} session={session} onSignOut={handleSignOut}>
      <div className="flex flex-col items-center justify-center flex-1 text-center px-6">
        <span className="text-6xl mb-4">✅</span>
        <h2 className="text-xl font-bold text-gray-900">Response received</h2>
        <p className="text-gray-400 mt-2 text-sm">Waiting for the next question…</p>
        <div className="mt-12 w-full max-w-xs">
          <HandButton hand={hand} onRaise={raiseHand} onLower={lowerHand} queuePos={queuePos} />
        </div>
      </div>
    </SessionShell>
  )

  // ── Main session view ─────────────────────────────────
  return (
    <SessionShell profile={profile} session={session} onSignOut={handleSignOut}>
      <div className="flex flex-col items-center justify-center flex-1 px-6 pb-8">
        <HandButton hand={hand} onRaise={raiseHand} onLower={lowerHand} queuePos={queuePos} />
      </div>
    </SessionShell>
  )
}


// ── Session shell (header + layout) ──────────────────────
function SessionShell({ profile, session, onSignOut, children }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-900 text-sm">{session?.programs?.name}</p>
          <p className="text-xs text-gray-400">{profile?.full_name}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/profile" className="text-xs text-gray-400 hover:text-gray-600">Profile</Link>
          <button onClick={onSignOut} className="text-xs text-gray-400 hover:text-gray-600">Sign out</button>
        </div>
      </div>
      {children}
    </div>
  )
}


// ── Hand raise button ─────────────────────────────────────
function HandButton({ hand, onRaise, onLower, queuePos }) {
  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-xs">
      <button
        onClick={hand ? onLower : onRaise}
        className={`w-48 h-48 rounded-full text-6xl shadow-lg transition-all duration-200 active:scale-95 flex flex-col items-center justify-center gap-2
          ${hand
            ? 'bg-brand-500 shadow-brand-200 scale-105'
            : 'bg-white border-4 border-gray-200 hover:border-brand-300 hover:shadow-xl'
          }`}
      >
        <span>✋</span>
        <span className={`text-sm font-semibold ${hand ? 'text-white' : 'text-gray-400'}`}>
          {hand ? 'Hand raised' : 'Raise hand'}
        </span>
      </button>

      {hand && queuePos && (
        <div className="text-center">
          <p className="text-brand-500 font-bold text-2xl">#{queuePos}</p>
          <p className="text-gray-400 text-sm">in the queue</p>
        </div>
      )}

      {hand && (
        <button onClick={onLower} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          Lower hand
        </button>
      )}
    </div>
  )
}


// ── Poll UI ───────────────────────────────────────────────
function PollUI({ poll, onSubmit }) {
  const [textInput, setTextInput] = useState('')

  const POLL_OPTIONS = {
    yes_no:          ['Yes', 'No'],
    true_false:      ['True', 'False'],
    ab:              ['A', 'B'],
    abc:             ['A', 'B', 'C'],
    abcd:            ['A', 'B', 'C', 'D'],
    abcde:           ['A', 'B', 'C', 'D', 'E'],
    rating:          ['1', '2', '3', '4', '5'],
    confidence:      ['1', '2', '3', '4', '5'],
  }

  const options = POLL_OPTIONS[poll.type] || poll.options || []
  const isConfidence = poll.type === 'confidence'
  const isRating = poll.type === 'rating' || isConfidence
  const isWordCloud = poll.type === 'word_cloud'

  const CONFIDENCE_LABELS = {
    '1': 'Totally lost',
    '2': 'A bit unsure',
    '3': 'Mostly got it',
    '4': 'Pretty clear',
    '5': 'Got it completely',
  }

  const CONFIDENCE_COLORS = {
    '1': 'bg-red-500',
    '2': 'bg-orange-400',
    '3': 'bg-amber-400',
    '4': 'bg-lime-500',
    '5': 'bg-green-500',
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 pb-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-4xl mb-3 block">{isConfidence ? '🎯' : '📊'}</span>
          <h2 className="text-xl font-bold text-gray-900">
            {isConfidence ? 'How well did you understand that?' : 'Answer the question'}
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {isConfidence ? 'Be honest — this helps the trainer' : 'Look at the screen for the question'}
          </p>
        </div>

        {/* Word cloud */}
        {isWordCloud && (
          <div className="space-y-3">
            <input
              className="input text-center text-lg"
              placeholder="Type your response…"
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              maxLength={50}
              autoFocus
            />
            <button
              onClick={() => textInput.trim() && onSubmit(textInput.trim())}
              disabled={!textInput.trim()}
              className="btn-primary w-full text-lg py-4"
            >
              Submit
            </button>
          </div>
        )}

        {/* Rating / Confidence */}
        {isRating && (
          <div className="space-y-3">
            {options.map(opt => (
              <button
                key={opt}
                onClick={() => onSubmit(opt)}
                className={`w-full py-4 rounded-2xl font-semibold text-white text-lg transition-all active:scale-95
                  ${isConfidence ? CONFIDENCE_COLORS[opt] : 'bg-brand-500 hover:bg-brand-600'}`}
              >
                {opt}
                {isConfidence && (
                  <span className="block text-sm font-normal opacity-80">{CONFIDENCE_LABELS[opt]}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Letter / Yes-No / True-False options */}
        {!isRating && !isWordCloud && (
          <div className={`grid gap-3 ${options.length === 2 ? 'grid-cols-2' : options.length <= 3 ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-3'}`}>
            {options.map(opt => (
              <button
                key={opt}
                onClick={() => onSubmit(opt)}
                className="bg-white border-2 border-gray-200 hover:border-brand-400 hover:bg-brand-50
                           rounded-2xl py-6 text-2xl font-bold text-gray-700 hover:text-brand-600
                           transition-all active:scale-95 shadow-sm"
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
