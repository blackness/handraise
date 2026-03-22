import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const nav = [
  { to: '/admin',          label: 'Dashboard',  icon: '⬛' },
  { to: '/admin/students', label: 'Students',   icon: '👤' },
  { to: '/admin/programs', label: 'Programs',   icon: '📚' },
  { to: '/admin/monitor',  label: 'Monitor',    icon: '🖥️' },
  { to: '/admin/profile',  label: 'My Profile', icon: '⚙️' },
]

export function AdminLayout({ children }) {
  const { signOut, user } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex bg-gray-50">

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className="w-60 bg-brand-500 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-6 py-6 border-b border-brand-400">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✋</span>
            <span className="text-white font-bold text-lg tracking-tight">HandRaise</span>
          </div>
          <p className="text-brand-300 text-xs mt-1">Admin Panel</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white text-brand-500'
                    : 'text-brand-200 hover:bg-brand-400 hover:text-white'
                }`
              }
            >
              <span className="text-base">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-brand-400">
          <p className="text-brand-300 text-xs truncate mb-2">{user?.email}</p>
          <button
            onClick={handleSignOut}
            className="text-brand-300 hover:text-white text-xs transition-colors"
          >
            Sign out →
          </button>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────── */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

    </div>
  )
}
