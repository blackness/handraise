import { useState } from 'react'

// Generates the local image path from student name and program/year context
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

// Large profile card — used in Viewer and Monitor
export function StudentProfileCard({ student, programName, year, status, dark = false }) {
  const photoPath = getStudentPhotoPath(student, programName, year)
  const [photoError, setPhotoError] = useState(false)

  const initials = student?.full_name
    ?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'

  return (
    <div className="w-full max-w-lg mx-auto">

      {/* Photo */}
      <div className="flex justify-center mb-6">
        <div className="relative">
          {photoPath && !photoError ? (
            <img
              src={photoPath}
              alt={student.full_name}
              onError={() => setPhotoError(true)}
              className="w-48 h-48 rounded-full object-cover border-4 border-white shadow-xl"
            />
          ) : (
            <div className="w-48 h-48 rounded-full bg-brand-500 flex items-center justify-center border-4 border-white shadow-xl">
              <span className="text-white font-bold text-6xl">{initials}</span>
            </div>
          )}
        </div>
      </div>

      {/* Name + role */}
      <div className="text-center mb-6">
        <h2 className={`text-3xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{student.full_name}</h2>
        {student.work_position && (
          <p className={`text-lg mt-1 ${dark ? 'text-gray-300' : 'text-gray-500'}`}>{student.work_position}</p>
        )}
        {student.company && (
          <p className={`mt-0.5 ${dark ? 'text-gray-400' : 'text-gray-400'}`}>{student.company}</p>
        )}
        <div className="flex justify-center gap-2 mt-3 flex-wrap">
          {student.team && (
            <span className="bg-brand-50 text-brand-600 text-sm font-medium px-3 py-1 rounded-full">
              {student.team}
            </span>
          )}
          {student.location && (
            <span className="bg-gray-100 text-gray-600 text-sm px-3 py-1 rounded-full">
              📍 {student.location}
            </span>
          )}
        </div>
      </div>

      {/* Status row — only shown when in a live session context */}
      {status && (
        <div className="grid grid-cols-3 gap-3 mt-2">
          <StatusTile
            label="Checked In"
            value={status.checkedIn ? 'Present' : 'Not in'}
            active={status.checkedIn}
            color="green"
          />
          <StatusTile
            label="Hand"
            value={status.handRaised ? 'Raised ✋' : 'Down'}
            active={status.handRaised}
            color="brand"
          />
          <StatusTile
            label="Poll"
            value={status.pollResponse || (status.responded ? '✓' : '—')}
            active={status.responded}
            color="purple"
          />
        </div>
      )}

      {/* Detail rows */}
      <div className="space-y-2 mt-4">
        {[
          { label: 'Student ID', value: student.student_id },
          { label: 'Company',    value: student.company },
          { label: 'Position',   value: student.work_position },
          { label: 'Team',       value: student.team },
          { label: 'Location',   value: student.location },
        ].filter(f => f.value).map(f => (
          <div key={f.label} className="flex items-center bg-white rounded-xl px-5 py-3 border border-gray-100">
            <span className="text-sm text-gray-400 w-28 flex-shrink-0">{f.label}</span>
            <span className="text-sm font-medium text-gray-900">{f.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatusTile({ label, value, active, color }) {
  const colors = {
    green:  { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700' },
    brand:  { bg: 'bg-brand-50',  border: 'border-brand-200',  text: 'text-brand-700' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  }
  const c = colors[color]
  return (
    <div className={`rounded-2xl p-4 border text-center ${active ? `${c.bg} ${c.border}` : 'bg-gray-50 border-gray-100'}`}>
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-sm font-semibold ${active ? c.text : 'text-gray-400'}`}>{value}</p>
    </div>
  )
}
