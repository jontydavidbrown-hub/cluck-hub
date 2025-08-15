import { Outlet, NavLink } from 'react-router-dom'
import { useState } from 'react'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/daily-log', label: 'Daily Log' },
  { to: '/weights', label: 'Weights' },
  { to: '/feed-silos', label: 'Feed & Silos' },
  { to: '/reminders', label: 'Reminders' },
  { to: '/setup', label: 'Setup' },
  { to: '/user', label: 'User' },
]

export default function App() {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-2 rounded-lg border" onClick={() => setOpen(v => !v)} aria-label="Toggle menu">
              ☰
            </button>
            <a href="/" className="font-bold">Cluck Hub</a>
          </div>
          <nav className="hidden md:flex gap-1">
            {links.map(l => <DesktopItem key={l.to} to={l.to} label={l.label} />)}
          </nav>
        </div>
        {/* Mobile menu */}
        {open && (
          <nav className="md:hidden border-t border-slate-200 bg-white">
            {links.map(l => (
              <MobileItem key={l.to} to={l.to} label={l.label} onClick={() => setOpen(false)} />
            ))}
          </nav>
        )}
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-7xl p-4">
        <Outlet />
      </main>
    </div>
  )
}

function DesktopItem({ to, label }:{ to:string; label:string }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        'block px-3 py-2 rounded-lg text-sm ' +
        (isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100')
      }>
      {label}
    </NavLink>
  )
}

function MobileItem({ to, label, onClick }:{ to:string; label:string; onClick:()=>void }) {
  return (
    <NavLink
      to={to}
      end
      onClick={onClick}
      className={({ isActive }) =>
        'block px-4 py-3 text-base ' +
        (isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-700')
      }>
      {label}
    </NavLink>
  )
}
