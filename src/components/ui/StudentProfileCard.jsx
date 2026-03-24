import { useState } from 'react'

export function getStudentPhotoPath(student, programName, year) {
  if (!student?.full_name) return null
  const name = student.full_name
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '')
  const prog = programName
    ? programName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    : 'general'
  const yr = year || new Date().getFullYear()
  return `/images/${prog}/${yr}/${name}.jpg`
}

export function StudentProfileCard({ student, programName, year, status, dark = false }) {
  const photoPath = getStudentPhotoPath(student, programName, year)
  const [photoError, setPhotoError] = useState(false)

  const initials = student?.full_name
    ?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'

  const textPrimary   = dark ? 'text-white'     : 'text-gray-900'
  const textSecondary = dark ? 'text-gray-300'  : 'text-gray-600'
  const textMuted     = dark ? 'text-gray-400'  : 'text-gray-400'
  const cardBg        = dark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100'

  // Ordered profile fields — no student ID
  const fields = [
    { label: 'Team',     value: student.team },
    { label: 'Company',  value: student.company },
    { label: 'Position', value: student.work_position },
    { label: 'Location', value: student.location },
  ].filter(f => f.value)

  return (
    <div className="w-full mx-auto">

      {/* Main card — photo left, details right */}
      <div className="flex items-start gap-8">

        {/* Photo */}
        <div className="flex-shrink-0">
          {photoPath && !photoError ? (
            <img
              src={photoPath}
              alt={student.full_name}
              onError={() => setPhotoError(true)}
              className="w-72 h-72 rounded-full object-cover border-4 border-white shadow-xl"
            />
          ) : (
            <div className="w-72 h-72 rounded-full bg-brand-500 flex items-center justify-center border-4 border-white shadow-xl">
              <span className="text-white font-bold" style={{ fontSize: '6rem' }}>{initials}</span>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0 pt-2">
          <h2 className={`font-bold leading-tight ${textPrimary}`} style={{ fontSize: '72px' }}>
            {student.full_name}
          </h2>

          {/* Profile fields */}
          <div className="mt-6 space-y-6">
            {fields.map(f => (
              <div key={f.label}>
                <p className={`${textMuted}`} style={{ fontSize: '36px' }}>{f.label}</p>
                <p className={`font-medium leading-tight ${textSecondary}`} style={{ fontSize: '60px' }}>{f.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Status row — only shown in live session context */}
      {status && (
        <div className="grid grid-cols-3 gap-3 mt-8">
          <StatusTile label="Checked In" value={status.checkedIn ? 'Present' : 'Not in'}   active={status.checkedIn}  color="green" dark={dark} />
          <StatusTile label="Hand"        value={status.handRaised ? 'Raised ✋' : 'Down'}  active={status.handRaised} color="brand" dark={dark} />
          <StatusTile label="Poll"        value={status.pollResponse || (status.responded ? '✓' : '—')} active={status.responded} color="purple" dark={dark} />
        </div>
      )}
    </div>
  )
}

function StatusTile({ label, value, active, color, dark }) {
  const light = {
    green:  { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700' },
    brand:  { bg: 'bg-brand-50',  border: 'border-brand-200',  text: 'text-brand-700' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  }
  const darkC = {
    green:  { bg: 'bg-green-900/30',  border: 'border-green-700',  text: 'text-green-400' },
    brand:  { bg: 'bg-brand-900/30',  border: 'border-brand-700',  text: 'text-brand-400' },
    purple: { bg: 'bg-purple-900/30', border: 'border-purple-700', text: 'text-purple-400' },
  }
  const c = dark ? darkC[color] : light[color]
  const inactiveBg = dark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-100'

  return (
    <div className={`rounded-2xl p-4 border text-center ${active ? `${c.bg} ${c.border}` : inactiveBg}`}>
      <p className={`text-xs uppercase tracking-wide mb-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{label}</p>
      <p className={`text-sm font-semibold ${active ? c.text : dark ? 'text-gray-600' : 'text-gray-400'}`}>{value}</p>
    </div>
  )
}
