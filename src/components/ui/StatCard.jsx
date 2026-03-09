export function StatCard({ label, value, sub, accent = false }) {
  return (
    <div className={`card ${accent ? 'bg-brand-500 border-brand-500' : ''}`}>
      <p className={`text-sm font-medium ${accent ? 'text-brand-200' : 'text-gray-500'}`}>
        {label}
      </p>
      <p className={`text-4xl font-bold mt-1 ${accent ? 'text-white' : 'text-brand-500'}`}>
        {value ?? '—'}
      </p>
      {sub && (
        <p className={`text-xs mt-1 ${accent ? 'text-brand-300' : 'text-gray-400'}`}>{sub}</p>
      )}
    </div>
  )
}
