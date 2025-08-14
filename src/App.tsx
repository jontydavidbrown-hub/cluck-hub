
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { NavLink } from "react-router-dom"

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/daily-log', label: 'Daily Log' },
  { to: '/weights', label: 'Weights' },
  { to: '/feed-silos', label: 'Feed & Silos' },
  { to: '/reminders', label: 'Reminders' },
  { to: '/setup', label: 'Setup' },
]

export default function App() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen">
      <div className="hidden md:grid md:grid-cols-[240px_1fr]">
        <aside className="min-h-screen bg-white border-r">
          <div className="px-4 py-4 border-b">
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">Cluck Hub</h1>
            <p className="text-xs text-slate-500">Farm management</p>
          </div>
          <nav className="p-2 space-y-1">
            {links.map(l => (
              <NavItem key={l.to} to={l.to} label={l.label} currentPath={pathname} />
            ))}
          </nav>
        </aside>
        <main className="bg-slate-50">
          <div className="mx-auto max-w-5xl p-4">
            <Outlet />
          </div>
        </main>
      </div>

      <div className="md:hidden max-w-md mx-auto bg-white min-h-screen shadow relative">
        <header className="sticky top-0 z-20 bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
          <h1 className="text-base font-semibold">Cluck Hub</h1>
          <button aria-label="Open menu" className="px-3 py-2 rounded bg-white/10" onClick={()=>setOpen(true)}>☰</button>
        </header>
        <main className="p-4">
          <Outlet />
        </main>
        {open && <div className="fixed inset-0 z-30 bg-black/40" onClick={()=>setOpen(false)} />}
        <aside className={'fixed z-40 top-0 right-0 h-full w-64 bg-white shadow-lg transform transition-transform ' + (open ? 'translate-x-0' : 'translate-x-full')}>
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-semibold">Menu</div>
            <button aria-label="Close menu" className="px-2 py-1 rounded border" onClick={()=>setOpen(false)}>✕</button>
          </div>
          <nav className="p-2 space-y-1">
            {links.map(l => (
              <MobileItem key={l.to} to={l.to} label={l.label} onClick={()=>setOpen(false)} />
            ))}
          </nav>
        </aside>
      </div>
    </div>
  )
}

function NavItem({ to, label, currentPath }:{ to:string; label:string; currentPath:string }) {
  const isActive = to === '/' ? currentPath === '/' : currentPath.startsWith(to)
  return (
    <NavLink to={to} className={'block px-3 py-2 rounded-lg text-sm ' + (isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100')} end>
      {label}
    </NavLink>
  )
}

function MobileItem({ to, label, onClick }:{ to:string; label:string; onClick:()=>void }) {
  return (
    <NavLink to={to} className={({ isActive }) => 'block px-4 py-3 text-base ' + (isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-700')} end onClick={onClick}>
      {label}
    </NavLink>
  )
}
