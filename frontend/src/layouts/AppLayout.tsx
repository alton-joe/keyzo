import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import {
  Bell, Building2, ClipboardList, FileSignature, LayoutDashboard, LogOut, Menu, PiggyBank, ReceiptIndianRupee, ScrollText, Search,
  Settings2, ShieldCheck, TrendingDown, UserCircle2, Users, Wrench, BarChart3, X, Home,
} from 'lucide-react'
import { Logo } from '../components/Logo'
import { Avatar } from '../components/ui'
import { ThemeToggle } from './PublicLayout'
import { useAuth } from '../lib/providers'
import { api } from '../lib/api'
import type { Notification, Paged, Role } from '../lib/types'
import { timeAgo } from '../lib/format'

type NavItem = { to: string; label: string; icon: typeof Home; roles?: Role[]; end?: boolean }

const operator: Role[] = ['SuperAdmin', 'Owner', 'Manager']
const nav: { title: string; items: NavItem[] }[] = [
  { title: 'Overview', items: [{ to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  {
    title: 'Portfolio', items: [
      { to: '/app/properties', label: 'Properties', icon: Building2, roles: operator },
      { to: '/app/tenants', label: 'Tenants', icon: Users, roles: operator },
      { to: '/app/applications', label: 'Applications', icon: ClipboardList, roles: [...operator, 'Tenant'] },
      { to: '/app/leases', label: 'Leases', icon: FileSignature, roles: [...operator, 'Tenant'] },
    ],
  },
  {
    title: 'Money', items: [
      { to: '/app/invoices', label: 'Rent & payments', icon: ReceiptIndianRupee, roles: [...operator, 'Tenant'] },
      { to: '/app/deposits', label: 'Deposits', icon: PiggyBank, roles: [...operator, 'Tenant'] },
      { to: '/app/expenses', label: 'Expenses', icon: TrendingDown, roles: operator },
      { to: '/app/reports', label: 'Reports', icon: BarChart3, roles: operator },
    ],
  },
  {
    title: 'Operations', items: [
      { to: '/app/maintenance', label: 'Maintenance', icon: Wrench, roles: [...operator, 'Tenant', 'MaintenanceStaff'] },
      { to: '/app/users', label: 'Team & users', icon: ShieldCheck, roles: ['SuperAdmin', 'Owner'] },
      { to: '/app/audit', label: 'Audit log', icon: ScrollText, roles: ['SuperAdmin'] },
    ],
  },
  { title: 'Account', items: [{ to: '/app/profile', label: 'My profile', icon: UserCircle2 }] },
]

function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()
  const navigate = useNavigate()
  const count = useQuery({ queryKey: ['unread'], queryFn: () => api.get<{ count: number }>('/notifications/unread-count'), refetchInterval: 30000 })
  const list = useQuery({ queryKey: ['notif-preview'], queryFn: () => api.get<Paged<Notification>>('/notifications', { pageSize: 6 }), enabled: open })

  useEffect(() => {
    const f = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f)
  }, [])

  const go = async (n: Notification) => {
    if (!n.isRead) await api.post(`/notifications/${n.id}/read`)
    qc.invalidateQueries({ queryKey: ['unread'] }); qc.invalidateQueries({ queryKey: ['notifications'] })
    setOpen(false); if (n.link) navigate(n.link)
  }
  const unread = count.data?.count ?? 0
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-label={`Notifications (${unread} unread)`} className="text-muted relative rounded-xl p-2.5 transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]">
        <Bell className="size-5" />
        {unread > 0 && <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}
            className="surface absolute right-0 z-50 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-2xl shadow-lift">
            <div className="flex items-center justify-between border-b border-base px-4 py-3"><b className="text-sm">Notifications</b>
              <Link to="/app/notifications" onClick={() => setOpen(false)} className="text-brand-500 text-xs font-semibold">View all</Link></div>
            <div className="max-h-96 overflow-y-auto">
              {list.data?.items.length === 0 && <p className="text-muted p-6 text-center text-sm">You are all caught up.</p>}
              {list.data?.items.map((n) => (
                <button key={n.id} onClick={() => go(n)} className="flex w-full gap-3 border-b border-base px-4 py-3 text-left transition last:border-0 hover:bg-[var(--surface-2)]">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.isRead ? 'bg-transparent' : 'bg-brand-500'}`} />
                  <span className="min-w-0"><span className="block text-sm font-semibold">{n.title}</span><span className="text-muted line-clamp-2 text-xs">{n.message}</span><span className="text-muted mt-1 block text-[11px]">{timeAgo(n.createdAt)}</span></span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function AppLayout() {
  const { user, logout, hasRole } = useAuth()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const navigate = useNavigate()
  useEffect(() => { setOpen(false); window.scrollTo(0, 0) }, [loc.pathname])
  if (!user) return null

  const sections = nav.map((s) => ({ ...s, items: s.items.filter((i) => !i.roles || hasRole(...i.roles)) })).filter((s) => s.items.length)
  const roleLabel = user.roles.map((r) => r.replace('MaintenanceStaff', 'Maintenance staff').replace('SuperAdmin', 'Super admin')).join(' · ')

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5"><Link to="/"><Logo /></Link><button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X /></button></div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Main">
        {sections.map((s) => (
          <div key={s.title}>
            <p className="text-muted mb-2 px-3 text-[11px] font-bold tracking-widest uppercase">{s.title}</p>
            <ul className="space-y-1">
              {s.items.map((i) => (
                <li key={i.to}>
                  <NavLink to={i.to} end={i.end} className={({ isActive }) => `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'text-brand-600 dark:text-brand-300' : 'text-muted hover:bg-[var(--surface-2)] hover:text-[var(--text)]'}`}>
                    {({ isActive }) => (<>
                      {isActive && <motion.span layoutId="nav-active" className="bg-brand-500/12 absolute inset-0 rounded-xl" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                      <i.icon className="relative size-[18px]" /><span className="relative">{i.label}</span>
                    </>)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {hasRole('Tenant') && <Link to="/units" className="text-brand-600 dark:text-brand-300 bg-brand-500/8 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold"><Search className="size-[18px]" />Browse homes</Link>}
      </nav>
      <div className="border-t border-base p-4">
        <div className="flex items-center gap-3">
          <Avatar name={user.fullName} />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{user.fullName}</p><p className="text-muted truncate text-xs">{roleLabel}</p></div>
          <button onClick={async () => { await logout(); navigate('/') }} aria-label="Sign out" className="text-muted rounded-lg p-2 hover:bg-[var(--surface-2)] hover:text-rose-500"><LogOut className="size-[18px]" /></button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="surface sticky top-0 hidden h-screen border-y-0 border-l-0 lg:block">{sidebar}</aside>
      <AnimatePresence>
        {open && (<>
          <motion.div className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
          <motion.aside className="surface fixed inset-y-0 left-0 z-50 w-72 lg:hidden" initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: 'spring', damping: 30, stiffness: 320 }}>{sidebar}</motion.aside>
        </>)}
      </AnimatePresence>

      <div className="min-w-0">
        <header className="glass sticky top-0 z-30 flex h-16 items-center justify-between px-4 sm:px-8">
          <button className="rounded-xl p-2.5 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></button>
          <p className="text-muted hidden text-sm lg:block">Welcome back, <b className="text-[var(--text)]">{user.fullName.split(' ')[0]}</b></p>
          <div className="flex items-center gap-1"><ThemeToggle /><NotificationBell />
            <Link to="/app/profile" aria-label="Profile" className="text-muted hidden rounded-xl p-2.5 hover:bg-[var(--surface-2)] sm:block"><Settings2 className="size-5" /></Link></div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8">
          <AnimatePresence mode="wait">
            <motion.div key={loc.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}><Outlet /></motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
