import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, Building2, CheckCircle2, ClipboardList, KeyRound, Wrench } from 'lucide-react'
import { Logo } from '../../components/Logo'
import { Button, Field, Input } from '../../components/ui'
import { useAuth, useToast } from '../../lib/providers'
import { ThemeToggle } from '../../layouts/PublicLayout'

function Shell({ title, subtitle, children, aside }: { title: string; subtitle: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between"><Link to="/"><Logo /></Link><ThemeToggle /></div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
            <p className="text-muted mt-2">{subtitle}</p>
            <div className="mt-8">{children}</div>
          </motion.div>
        </div>
      </div>
      <div className="gradient-brand relative hidden overflow-hidden lg:block">
        <div className="relative flex h-full flex-col justify-center p-14 text-white">
          <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="max-w-md text-5xl leading-tight font-extrabold">Rent smarter, from the first viewing to the last receipt.</motion.h2>
          <ul className="mt-10 max-w-md space-y-5">
            {[[KeyRound, 'Browse homes and apply online'], [Building2, 'Owners track income and occupancy live'], [Wrench, 'Repairs assigned, tracked and costed'], [CheckCircle2, 'Secure role-based access for everyone']].map(([I, t], i) => {
              const Icon = I as typeof KeyRound
              return <motion.li key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 + i * 0.1 }} className="flex items-center gap-4"><span className="flex size-11 items-center justify-center rounded-xl bg-white/15"><Icon className="size-5" /></span><span className="font-medium">{t as string}</span></motion.li>
            })}
          </ul>
          {aside}
        </div>
      </div>
    </div>
  )
}

const demos = [
  ['Owner', 'owner@keyzo.app'], ['Manager', 'manager@keyzo.app'], ['Tenant', 'tenant@keyzo.app'], ['Staff', 'staff@keyzo.app'],
]

export function Login() {
  const { login, user } = useAuth()
  const nav = useNavigate()
  const loc = useLocation() as { state?: { from?: string } }
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  if (user) return <Navigate to={loc.state?.from ?? '/app'} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true)
    try { await login(email, password); nav(loc.state?.from ?? '/app', { replace: true }) }
    catch (err) { toast.error((err as Error).message) } finally { setBusy(false) }
  }

  return (
    <Shell title="Welcome back" subtitle="Sign in to manage your rentals.">
      <form onSubmit={submit} className="space-y-5">
        <Field label="Email"><Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></Field>
        <Field label="Password"><Input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></Field>
        <Button size="lg" className="w-full" loading={busy} type="submit" icon={<ArrowRight className="size-5" />}>Sign in</Button>
      </form>
      <div className="surface-2 mt-8 rounded-2xl p-4">
        <p className="text-muted text-xs font-semibold tracking-wide uppercase">Demo accounts · password Keyzo@123</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {demos.map(([r, e]) => <button key={e} type="button" onClick={() => { setEmail(e); setPassword('Keyzo@123') }} className="surface hover:border-brand-500 cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold transition">{r}</button>)}
        </div>
      </div>
      <p className="text-muted mt-8 text-center text-sm">New to Keyzo? <Link to="/register" className="text-brand-600 dark:text-brand-300 font-semibold">Create an account</Link></p>
    </Shell>
  )
}

export function Register() {
  const { register, user } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', role: 'Tenant' as 'Tenant' | 'Owner' | 'Manager' | 'MaintenanceStaff' })
  const [busy, setBusy] = useState(false)
  if (user) return <Navigate to="/app" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true)
    try { await register(form); toast.success('Welcome to Keyzo!'); nav('/app', { replace: true }) }
    catch (err) { toast.error((err as Error).message) } finally { setBusy(false) }
  }
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

  return (
    <Shell title="Create your account" subtitle="Pick how you will use Keyzo. Administrator access is granted automatically to the approved administrator emails.">
      <form onSubmit={submit} className="space-y-5">
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Account type">
          {([['Tenant', 'I am looking for a home', KeyRound], ['Owner', 'I own properties', Building2], ['Manager', 'I manage properties', ClipboardList], ['MaintenanceStaff', 'I handle repairs', Wrench]] as const).map(([r, t, I]) => (
            <button type="button" key={r} role="radio" aria-checked={form.role === r} onClick={() => setForm({ ...form, role: r })}
              className={`cursor-pointer rounded-2xl border-2 p-4 text-left transition ${form.role === r ? 'border-brand-500 bg-brand-500/8' : 'border-base hover:border-brand-300'}`}>
              <I className={`size-6 ${form.role === r ? 'text-brand-500' : 'text-muted'}`} /><p className="mt-2 font-bold">{r === 'MaintenanceStaff' ? 'Maintenance staff' : r}</p><p className="text-muted text-xs">{t}</p>
            </button>
          ))}
        </div>
        <Field label="Full name"><Input required maxLength={120} value={form.fullName} onChange={set('fullName')} autoComplete="name" /></Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Email"><Input type="email" required value={form.email} onChange={set('email')} autoComplete="email" /></Field>
          <Field label="Phone"><Input type="tel" maxLength={20} value={form.phone} onChange={set('phone')} autoComplete="tel" /></Field>
        </div>
        <Field label="Password" hint="At least 8 characters"><Input type="password" required minLength={8} value={form.password} onChange={set('password')} autoComplete="new-password" /></Field>
        <Button size="lg" className="w-full" loading={busy} type="submit">Create account</Button>
      </form>
      <p className="text-muted mt-8 text-center text-sm">Already have an account? <Link to="/login" className="text-brand-600 dark:text-brand-300 font-semibold">Sign in</Link></p>
    </Shell>
  )
}
