import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Menu, Moon, Sun, X } from 'lucide-react'
import { Logo } from '../components/Logo'
import { Button } from '../components/ui'
import { ScrollProgress, SmoothScroll } from '../components/motion'
import { useAuth, useTheme } from '../lib/providers'

export function ThemeToggle() {
  const { dark, toggle } = useTheme()
  return (
    <button onClick={toggle} aria-label="Toggle dark mode" className="text-muted rounded-xl p-2.5 transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={dark ? 'd' : 'l'} initial={{ rotate: -80, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 80, opacity: 0 }} transition={{ duration: 0.18 }} className="block">
          {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}

export default function PublicLayout() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { user } = useAuth()
  const loc = useLocation()

  useEffect(() => { const f = () => setScrolled(window.scrollY > 16); f(); window.addEventListener('scroll', f, { passive: true }); return () => window.removeEventListener('scroll', f) }, [])
  useEffect(() => { setOpen(false); window.scrollTo(0, 0) }, [loc.pathname])

  // the Founders link lives in the header of the home page (and stays visible on the About page itself)
  // Header adapts to where the visitor is:
  //  - top level (lobby, Founders): Homes, Founders
  //  - inside the Homes section (/homes, /units...): Lobby (category picker), Homes (rental landing page), Find a home, Founders
  // The Founders page is shared, so it keeps the header of the section the visitor came from.
  const section = loc.pathname === '/homes' || loc.pathname.startsWith('/units') ? 'homes' : loc.pathname === '/' ? 'lobby' : null
  if (section) { try { sessionStorage.setItem('keyzo-section', section) } catch { /* ignore */ } }
  let remembered: string | null = null
  try { remembered = sessionStorage.getItem('keyzo-section') } catch { /* ignore */ }
  const inHomes = (section ?? remembered) === 'homes'
  const founders = { to: '/about', label: 'Founders', end: false }
  const links = inHomes
    ? [{ to: '/', label: 'Lobby', end: true }, { to: '/homes', label: 'Homes', end: true }, { to: '/units', label: 'Find a home', end: false }, founders]
    : [{ to: '/homes', label: 'Homes', end: true }, founders]
  const link = ({ isActive }: { isActive: boolean }) => `rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive ? 'text-brand-600 dark:text-brand-300' : 'text-muted hover:text-[var(--text)]'}`

  return (
    <div className="min-h-screen">
      <SmoothScroll />
      <ScrollProgress />
      <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled || open ? 'glass shadow-soft' : loc.pathname === '/homes' || loc.pathname === '/' ? 'on-photo' : ''}`}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="Keyzo home"><Logo /></Link>
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={link}>{l.label}</NavLink>)}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <ThemeToggle />
            {user ? <Link to="/app"><Button>Open dashboard</Button></Link> : (<>
              <Link to="/login"><Button variant="ghost">Sign in</Button></Link>
              <Link to="/register"><Button>Get started</Button></Link>
            </>)}
          </div>
          <div className="flex items-center gap-1 md:hidden">
            <ThemeToggle />
            <button className="rounded-xl p-2.5" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>{open ? <X /> : <Menu />}</button>
          </div>
        </div>
        <AnimatePresence>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-base md:hidden">
              <div className="flex flex-col gap-1 p-4">
                {links.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={link}>{l.label}</NavLink>)}
                {user ? <Link to="/app"><Button className="mt-2 w-full">Open dashboard</Button></Link> : (
                  <div className="mt-2 grid grid-cols-2 gap-2"><Link to="/login"><Button variant="secondary" className="w-full">Sign in</Button></Link><Link to="/register"><Button className="w-full">Get started</Button></Link></div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="pt-16"><Outlet /></main>

      <footer className="border-t border-base">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo />
            <p className="text-muted mt-4 max-w-sm text-sm leading-relaxed">Keyzo brings properties, tenants, leases, rent and maintenance together in one secure, beautifully simple platform.</p>
          </div>
          <div><h4 className="mb-3 text-sm font-bold">Explore</h4><ul className="text-muted space-y-2 text-sm"><li><Link to="/units" className="hover:text-brand-500">Find a home</Link></li><li><Link to="/register" className="hover:text-brand-500">List a property</Link></li><li><Link to="/login" className="hover:text-brand-500">Sign in</Link></li></ul></div>
          <div><h4 className="mb-3 text-sm font-bold">Built with</h4><ul className="text-muted space-y-2 text-sm"><li>VB.NET (.NET 10)</li><li>MySQL 8</li><li>React + Tailwind</li></ul></div>
        </div>
        <div className="text-muted border-t border-base py-5 text-center text-xs">© {new Date().getFullYear()} Keyzo · DBMS Project · Team 6 · 4BCA B</div>
      </footer>
    </div>
  )
}
