import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { AdminLayout } from '../../components/layout/AdminLayout'
import { StatCard } from '../../components/ui/StatCard'
import { formatDistanceToNow } from 'date-fns'

export function AdminDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [institution, setInstitution] = useState(null)
  const [stats, setStats] = useState({ students: null, programs: null, sessions: null })
  const [activeSessions, setActiveSessions] = useState([])
  const [recentSessions, setRecentSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadDashboard() }, [])

  useEffect(() => {
    const channel = supabase.channel('admin-sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => loadSessions())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [institution])

  async function loadDashboard() {
    setLoading(true)
    await Promise.all([loadInstitution(), loadStats(), loadSessions()])
    setLoading(false)
  }

  async function loadInstitution() {
    const { data } = await supabase
      .from('admin_profiles').select('institution_id, institutions(id, name, plan, status)').eq('user_id', user.id).single()
    if (data?.institutions) setInstitution(data.institutions)
  }

  async function loadStats() {
    const { data: ap } = await supabase.from('admin_profiles').select('institution_id').eq('user_id', user.id).single()
    if (!ap) return
    const [s, p, sess] = await Promise.all([
      supabase.from('student_profiles').select('id', { count: 'exact', head: true }).eq('institution_id', ap.institution_id).eq('active', true),
      supabase.from('programs').select('id', { count: 'exact', head: true }).eq('institution_id', ap.institution_id).eq('archived', false),
      supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('institution_id', ap.institution_id).eq('status', 'ended'),
    ])
    setStats({ students: s.count, programs: p.count, sessions: sess.count })
  }

  async function loadSessions() {
    const { data: ap } = await supabase.from('admin_profiles').select('institution_id').eq('user_id', user.id).single()
    if (!ap) return
    const { data: active } = await supabase.from('sessions')
      .select('id, status, started_at, name, programs(name), hands(id, lowered_at), attendance(id)')
      .eq('institution_id', ap.institution_id).eq('status', 'active').order('started_at', { ascending: false })
    setActiveSessions(active || [])
    const { data: recent } = await supabase.from('sessions')
      .select('id, started_at, ended_at, name, programs(name)')
      .eq('institution_id', ap.institution_id).eq('status', 'ended').order('ended_at', { ascending: false }).limit(5)
    setRecentSessions(recent || [])
  }

  async function startSession(programId, sessionName = null) {
    const { data, error } = await supabase.from('sessions')
      .insert({ program_id: programId, institution_id: institution.id, status: 'active', started_at: new Date().toISOString(), name: sessionName || null })
      .select().single()
    if (!error && data) navigate(`/admin/session/${data.id}`)
  }

  async function endSession(sessionId) {
    await supabase.from('sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', sessionId)
  }

  if (loading) return (
    <AdminLayout>
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    </AdminLayout>
  )

  return (
    <AdminLayout>
      <div className="p-8 max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{institution?.name ?? 'Dashboard'}</h1>
          <p className="text-gray-500 mt-1">
            {activeSessions.length > 0
              ? `${activeSessions.length} session${activeSessions.length !== 1 ? 's' : ''} live right now`
              : 'No active sessions'}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Active Students" value={stats.students} accent />
          <StatCard label="Programs"        value={stats.programs} />
          <StatCard label="Sessions Run"    value={stats.sessions} />
          <StatCard label="Status" value={institution?.status ?? '—'} sub={`Plan: ${institution?.plan ?? '—'}`} />
        </div>

        {/* Active Sessions */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Live Sessions</h2>
            <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Updating live
            </span>
          </div>
          {activeSessions.length === 0 ? (
            <div className="card border-dashed text-center py-10">
              <p className="text-3xl mb-3">🎓</p>
              <p className="text-gray-500 font-medium">No sessions running</p>
              <p className="text-gray-400 text-sm mt-1">Start a session from a program below</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeSessions.map(session => {
                const handsUp  = session.hands?.filter(h => !h.lowered_at).length ?? 0
                const attendees = session.attendance?.length ?? 0
                const label = [session.programs?.name, session.name].filter(Boolean).join(' — ')
                return (
                  <div key={session.id} className="card flex items-center gap-4">
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{label}</p>
                      <p className="text-sm text-gray-400 mt-0.5">
                        Started {formatDistanceToNow(new Date(session.started_at), { addSuffix: true })}
                        {' · '}{attendees} checked in
                        {handsUp > 0 && <span className="text-brand-500 font-medium"> · ✋ {handsUp} hand{handsUp !== 1 ? 's' : ''} up</span>}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => navigate(`/admin/session/${session.id}`)} className="btn-primary text-sm py-2 px-4">Open Dashboard</button>
                      <button onClick={() => endSession(session.id)} className="text-sm py-2 px-4 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors">End</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Programs */}
        <ProgramsPanel institutionId={institution?.id} onStart={(programId, name) => startSession(programId, name)} />

        {/* Recent */}
        {recentSessions.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Sessions</h2>
            <div className="card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-gray-500 font-medium">Program</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium">Started</th>
                    <th className="text-left px-5 py-3 text-gray-500 font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSessions.map((s, i) => {
                    const duration = s.ended_at && s.started_at ? Math.round((new Date(s.ended_at) - new Date(s.started_at)) / 60000) : null
                    const label = [s.programs?.name, s.name].filter(Boolean).join(' — ')
                    return (
                      <tr key={s.id} className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${i === recentSessions.length - 1 ? 'border-0' : ''}`}
                        onClick={() => navigate(`/admin/session/${s.id}`)}>
                        <td className="px-5 py-3 font-medium text-gray-900">{label}</td>
                        <td className="px-5 py-3 text-gray-500">{formatDistanceToNow(new Date(s.started_at), { addSuffix: true })}</td>
                        <td className="px-5 py-3 text-gray-500">{duration ? `${duration} min` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </AdminLayout>
  )
}

function ProgramsPanel({ institutionId, onStart }) {
  const navigate = useNavigate()
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [startModal, setStartModal] = useState(null)

  useEffect(() => {
    if (!institutionId) return
    supabase.from('programs')
      .select('id, name, teacher_profiles(full_name), enrollments(id)')
      .eq('institution_id', institutionId).eq('archived', false).order('name')
      .then(({ data }) => { setPrograms(data || []); setLoading(false) })
  }, [institutionId])

  return (
    <>
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Programs</h2>
          <button onClick={() => navigate('/admin/programs')} className="text-sm text-brand-500 hover:underline font-medium">
            Manage programs →
          </button>
        </div>
        {loading ? <div className="card animate-pulse h-20" /> :
          programs.length === 0 ? (
            <div className="card border-dashed text-center py-8">
              <p className="text-gray-400 text-sm">No programs yet.</p>
              <button onClick={() => navigate('/admin/programs')} className="btn-primary mt-3 text-sm py-2">Create a program</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {programs.map(program => (
                <div key={program.id} className="card flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{program.name}</p>
                    <p className="text-sm text-gray-400 mt-0.5">
                      {program.enrollments?.length ?? 0} students
                      {program.teacher_profiles?.full_name && <> · {program.teacher_profiles.full_name}</>}
                    </p>
                  </div>
                  <button onClick={() => setStartModal(program)} className="btn-primary text-sm py-2 px-4 flex-shrink-0">
                    ▶ Start
                  </button>
                </div>
              ))}
            </div>
          )}
      </section>

      {startModal && (
        <StartSessionModal
          program={startModal}
          onStart={(name) => { onStart(startModal.id, name); setStartModal(null) }}
          onCancel={() => setStartModal(null)}
        />
      )}
    </>
  )
}

function StartSessionModal({ program, onStart, onCancel }) {
  const [name, setName] = useState('')
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
        <h2 className="font-bold text-gray-900 text-lg mb-1">{program.name}</h2>
        <p className="text-gray-500 text-sm mb-5">
          Give this session a name if running multiple concurrently (e.g. "Section 1", "Morning Group").
          Leave blank for a single cohort.
        </p>
        <input
          className="input mb-5"
          placeholder="Session name (optional)"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
        <div className="flex gap-2">
          <button onClick={() => onStart(name.trim() || null)} className="btn-primary flex-1">
            Start Session
          </button>
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}
