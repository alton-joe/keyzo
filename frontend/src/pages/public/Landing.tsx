import { lazy, Suspense, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react'
import { ArrowRight, BarChart3, Bell, Building2, CalendarClock, CheckCircle2, ChevronDown, FileSignature, KeyRound, MapPin, ReceiptIndianRupee, ShieldCheck, Wrench } from 'lucide-react'
import { scenes, sceneSrc } from '../../features/tour/photos'
import { api } from '../../lib/api'
import type { Paged, PublicStats, UnitCard } from '../../lib/types'
import { Button, Skeleton } from '../../components/ui'
import { CountUp, Parallax, Reveal, Stagger, StaggerItem } from '../../components/motion'
import { UnitCardView } from '../../components/UnitCardView'
import { money } from '../../lib/format'

/** One full-bleed city photo. Each scene fades in over the previous one and slowly pulls back as you scroll. */
function SceneLayer({ t, i, reduce }: { t: MotionValue<number>; i: number; reduce: boolean | null }) {
  const s = scenes[i]
  const opacity = useTransform(t, (v) => (i === 0 ? 1 : Math.min(1, Math.max(0, (v - (i - 0.7)) / 0.6))))
  const scale = useTransform(t, (v) => 1.16 - 0.12 * Math.min(1, Math.max(0, (v - (i - 1)) / 2)))
  const y = useTransform(t, (v) => `${(i - v) * 3}%`)
  return (
    <motion.div className="absolute inset-0" style={{ opacity }}>
      <motion.img src={sceneSrc(s.id)} srcSet={`${sceneSrc(s.id, true)} 1000w, ${sceneSrc(s.id)} 2000w`} sizes="100vw" alt={`${s.city} - ${s.caption}`}
        loading={i === 0 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : 'auto'} decoding="async" draggable={false}
        initial={i === 0 && !reduce ? { scale: 1.28, opacity: 0 } : false} animate={i === 0 ? { opacity: 1 } : undefined} transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
        style={reduce ? undefined : { scale, y }} className="absolute inset-0 size-full object-cover will-change-transform" />
    </motion.div>
  )
}

function Hero({ stats }: { stats?: PublicStats }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const t = useTransform(scrollYProgress, (v) => v * (scenes.length - 1))
  const [active, setActive] = useState(0)
  useMotionValueEvent(t, 'change', (v) => setActive(Math.min(scenes.length - 1, Math.round(v))))
  const yCard = useTransform(scrollYProgress, [0, 1], [0, -120])
  const textY = useTransform(scrollYProgress, [0.6, 1], [0, -60])
  const textOpacity = useTransform(scrollYProgress, [0.7, 0.98], [1, 0])

  return (
    // Tall wrapper: the stage stays pinned while the city photos change; the page then continues normally.
    // -mt-16 lets the photo run under the transparent header.
    <section ref={ref} className="relative -mt-16" style={{ height: reduce ? '100svh' : `${100 + (scenes.length - 1) * 70}svh` }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0" aria-hidden={false}>
          {scenes.map((s, i) => <SceneLayer key={s.id} t={t} i={i} reduce={reduce} />)}
        </div>
        {/* legibility: darken behind the copy, and melt the bottom edge into the page */}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-black/10" />
        <div aria-hidden className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/50 to-transparent" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/40 to-transparent" />

        <div className="relative mx-auto grid h-full max-w-7xl items-center gap-14 px-4 pt-16 pb-28 sm:px-6 sm:pb-32 lg:grid-cols-[1.05fr_1fr]">
        <motion.div style={reduce ? undefined : { opacity: textOpacity, y: textY }}>
          <motion.span initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-semibold backdrop-blur-md">
            Rental management platform
          </motion.span>
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.7 }}
            className="mt-6 text-5xl leading-[1.04] font-extrabold drop-shadow-lg sm:text-6xl lg:text-7xl">
            Every key.<br />Every lease.<br /><span className="text-amber-200">One place.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.7 }} className="mt-6 max-w-xl text-lg leading-relaxed text-white/85">
            Keyzo lets owners list properties, tenants apply and pay rent, and managers keep leases, invoices and repairs running smoothly - all on one secure platform.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.7 }} className="mt-9 flex flex-wrap gap-3">
            <Link to="/units"><Button size="lg" icon={<KeyRound className="size-5" />}>Find a home</Button></Link>
            <Link to="/register" className="on-photo-btn"><Button size="lg" variant="secondary" icon={<Building2 className="size-5" />}>List your property</Button></Link>
          </motion.div>
          <motion.dl initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-8 grid max-w-md grid-cols-3 gap-6 [@media(min-height:800px)]:mt-12">
            {[['Properties', stats?.properties], ['Homes', stats?.units], ['Cities', stats?.cities]].map(([k, v]) => (
              <div key={k as string}><dd className="font-display text-3xl font-extrabold">{v != null ? <CountUp to={v as number} /> : <Skeleton className="h-8 w-12" />}</dd><dt className="text-sm text-white/70">{k}</dt></div>
            ))}
          </motion.dl>
        </motion.div>

        {/* floating product preview */}
        <motion.div style={reduce ? undefined : { y: yCard }} className="relative mx-auto hidden w-full max-w-lg text-[var(--text)] lg:block">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.9, type: 'spring' }}
            className="surface relative rounded-3xl p-5 shadow-lift">
            <div className="flex items-center justify-between">
              <div><p className="text-muted text-xs font-semibold uppercase">This month</p><p className="font-display text-3xl font-extrabold">{money(184500)}</p></div>
              <span className="rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-bold text-emerald-600">+12.4%</span>
            </div>
            <div className="mt-5 flex h-28 items-end gap-2">
              {[38, 52, 44, 66, 58, 80, 72, 92].map((h, i) => (
                <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ delay: 0.5 + i * 0.07, duration: 0.7, ease: 'easeOut' }}
                  className={`flex-1 rounded-t-lg ${i === 7 ? 'gradient-brand' : 'bg-brand-500/20'}`} />
              ))}
            </div>
            <div className="mt-5 space-y-2.5">
              {[['Skyline Residency · 101', 'Paid', 'green'], ['Lakeview Villas · V1', 'Due in 3 days', 'amber'], ['Palm Grove · A1', 'Paid', 'green']].map(([a, b, c]) => (
                <div key={a} className="surface-2 flex items-center justify-between rounded-xl px-4 py-2.5 text-sm"><span className="font-medium">{a}</span>
                  <span className={`text-xs font-bold ${c === 'green' ? 'text-emerald-500' : 'text-amber-500'}`}>{b}</span></div>
              ))}
            </div>
          </motion.div>
          <div
            className="glass absolute -top-14 -left-4 hidden items-center gap-3 rounded-2xl px-4 py-3 shadow-lift sm:flex">
            <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500"><CheckCircle2 /></span>
            <div><p className="text-sm font-bold">Lease signed</p><p className="text-muted text-xs">Unit 301 · 11 months</p></div>
          </div>
          <div
            className="glass absolute -right-4 -bottom-8 hidden items-center gap-3 rounded-2xl px-4 py-3 shadow-lift sm:flex">
            <span className="flex size-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500"><Wrench /></span>
            <div><p className="text-sm font-bold">Repair assigned</p><p className="text-muted text-xs">Plumber arrives today</p></div>
          </div>
        </motion.div>
        </div>

        {/* where we are: the city behind the copy */}
        <div className="absolute inset-x-0 bottom-10 z-10 mx-auto flex max-w-7xl items-end justify-between gap-6 px-4 sm:bottom-12 sm:px-6">
          <div className="min-w-0">
            <AnimatePresence mode="wait">
              <motion.p key={active} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4 }}
                className="flex items-center gap-2 text-sm font-medium text-white/90 drop-shadow">
                <MapPin className="size-4 shrink-0 text-amber-300" /><b>{scenes[active].city}</b><span className="hidden text-white/70 sm:inline">· {scenes[active].caption}</span>
              </motion.p>
            </AnimatePresence>
            <div className="mt-3 flex gap-1.5" aria-hidden>
              {scenes.map((s, i) => <span key={s.id} className={`h-1 rounded-full transition-all duration-500 ${i === active ? 'w-10 bg-white' : 'w-4 bg-white/40'}`} />)}
            </div>
          </div>
          {!reduce && (
            <motion.div style={{ opacity: textOpacity }} className="hidden items-center gap-2 text-xs font-semibold tracking-widest text-white/70 uppercase sm:flex">
              Scroll <motion.span animate={{ y: [0, 6, 0] }} transition={{ duration: 1.6, repeat: Infinity }}><ChevronDown className="size-4" /></motion.span>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  )
}

const steps = [
  { icon: Building2, title: 'List & organise', text: 'Owners register properties and units with photos, amenities and rent. Occupancy updates itself as leases start and end.', accent: 'from-brand-700 to-brand-500' },
  { icon: FileSignature, title: 'Apply & approve', text: 'Tenants browse available homes, upload documents and apply. Managers review and approve in one click, then draft the lease.', accent: 'from-[#35566b] to-[#4d7388]' },
  { icon: ReceiptIndianRupee, title: 'Bill & collect', text: 'Monthly invoices are generated automatically, late fees applied on time, and every payment gets a downloadable receipt.', accent: 'from-[#4b6b4a] to-[#6b8a5a]' },
  { icon: Wrench, title: 'Fix & track', text: 'Tenants raise requests with photos. Managers assign staff, who log progress and costs - expenses flow straight into reports.', accent: 'from-[#9a6b2f] to-[#b8893b]' },
]

// Leaflet is only fetched when the visitor scrolls down to the map section
const CityMap = lazy(() => import('../../features/map/CityMap'))

function ScrollStory() {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  useMotionValueEvent(scrollYProgress, 'change', (v) => setActive(Math.min(steps.length - 1, Math.floor(v * steps.length))))
  const S = steps[active]
  return (
    <section ref={ref} className="relative" style={{ height: `${steps.length * 85}vh` }}>
      <div className="sticky top-0 flex min-h-screen items-center">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="text-brand-500 text-sm font-bold tracking-widest uppercase">How Keyzo works</p>
            <h2 className="mt-3 text-4xl font-extrabold sm:text-5xl">From first listing to final repair.</h2>
            <ol className="mt-10 space-y-3">
              {steps.map((s, i) => (
                <li key={s.title}>
                  <button onClick={() => { const el = ref.current; if (el) window.scrollTo({ top: el.offsetTop + (el.offsetHeight / steps.length) * i + 4, behavior: 'smooth' }) }}
                    className={`flex w-full items-start gap-4 rounded-2xl p-4 text-left transition-all duration-500 ${i === active ? 'surface shadow-lift' : 'opacity-50 hover:opacity-80'}`}>
                    <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${i === active ? 'gradient-brand text-white' : 'surface-2'}`}>{i + 1}</span>
                    <span><span className="block font-bold">{s.title}</span>
                      <motion.span initial={false} animate={{ height: i === active ? 'auto' : 0, opacity: i === active ? 1 : 0 }} className="text-muted block overflow-hidden text-sm leading-relaxed">{s.text}</motion.span></span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <div className="relative mx-auto hidden aspect-square w-full max-w-md lg:block">
            <motion.div key={active} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', damping: 20 }}
              className={`absolute inset-0 flex items-center justify-center rounded-[2.5rem] bg-gradient-to-br ${S.accent} shadow-lift`}>
              <div className="absolute inset-6 rounded-[2rem] border border-white/25" />
              <S.icon className="size-32 text-white drop-shadow-xl" strokeWidth={1.2} />
              <span className="absolute bottom-8 left-8 font-display text-6xl font-extrabold text-white/30">0{active + 1}</span>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}

const features = [
  { icon: Building2, t: 'Properties & units', d: 'Multi-unit buildings, photos, amenities and live availability.' },
  { icon: FileSignature, t: 'Leases with history', d: 'Every change is versioned. Overlapping leases are blocked at the database.' },
  { icon: ReceiptIndianRupee, t: 'Automated rent', d: 'Invoices, flat late fees, partial payments and PDF receipts.' },
  { icon: Wrench, t: 'Maintenance desk', d: 'Requests with photos, staff assignment, progress logs and costs.' },
  { icon: BarChart3, t: 'Insightful reports', d: 'Income, occupancy, overdue rent and expense reports at a glance.' },
  { icon: ShieldCheck, t: 'Role-based security', d: 'Owners, managers, tenants and staff each see only their own data.' },
  { icon: Bell, t: 'Smart reminders', d: 'Rent due, lease expiry and repair updates reach the right person.' },
  { icon: CalendarClock, t: 'Always in sync', d: 'Nightly jobs expire leases, free units and flag overdue rent.' },
]

export default function Landing() {
  const stats = useQuery({ queryKey: ['public-stats'], queryFn: () => api.get<PublicStats>('/public/stats', undefined, false) })
  const units = useQuery({ queryKey: ['featured-units'], queryFn: () => api.get<Paged<UnitCard>>('/public/units', { pageSize: 6, sort: 'rent_desc' }, false) })

  return (
    <>
      <Hero stats={stats.data} />

      <Suspense fallback={<div className="h-svh" />}><CityMap /></Suspense>

      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-brand-500 text-sm font-bold tracking-widest uppercase">Everything you need</p>
          <h2 className="mt-3 text-4xl font-extrabold sm:text-5xl">One platform. Every part of renting.</h2>
          <p className="text-muted mt-4 text-lg">Designed around real rental workflows, backed by a rigorously designed relational database.</p>
        </Reveal>
        <Stagger className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <StaggerItem key={f.t}>
              <div className="surface group h-full rounded-2xl p-6 shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift">
                <span className="bg-brand-500/10 text-brand-500 group-hover:gradient-brand flex size-12 items-center justify-center rounded-xl transition-all duration-300 group-hover:text-white"><f.icon className="size-6" /></span>
                <h3 className="mt-5 text-lg font-bold">{f.t}</h3>
                <p className="text-muted mt-2 text-sm leading-relaxed">{f.d}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <ScrollStory />

      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-brand-500 text-sm font-bold tracking-widest uppercase">Available now</p><h2 className="mt-3 text-4xl font-extrabold">Homes ready to move in</h2></div>
          <Link to="/units"><Button variant="secondary" icon={<ArrowRight className="size-4" />}>Browse all</Button></Link>
        </Reveal>
        <Stagger className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {units.isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-96" />)
            : units.data?.items.map((u) => <StaggerItem key={u.unitId}><UnitCardView u={u} /></StaggerItem>)}
        </Stagger>
        {units.isError && <p className="text-muted mt-6 text-center text-sm">Listings will appear once the server is reachable.</p>}
      </section>

      <section className="relative overflow-hidden py-24">
        <Parallax speed={50} className="gradient-brand absolute inset-0 -z-10"><div className="size-full" /></Parallax>
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_45%)]" />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 text-white sm:px-6 md:grid-cols-4">
          {[['Occupancy', stats.data?.occupancyPct ?? 0, '%'], ['Active leases', stats.data?.activeLeases ?? 0, ''], ['Homes managed', stats.data?.units ?? 0, ''], ['Cities', stats.data?.cities ?? 0, '']].map(([k, v, s]) => (
            <Reveal key={k as string} className="text-center">
              <p className="font-display text-5xl font-extrabold sm:text-6xl"><CountUp to={v as number} suffix={s as string} decimals={s === '%' ? 1 : 0} /></p>
              <p className="mt-2 text-sm font-medium text-white/75">{k}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-28 text-center sm:px-6">
        <Reveal>
          <h2 className="text-4xl font-extrabold sm:text-6xl">Ready to unlock <span className="gradient-text">simpler renting?</span></h2>
          <p className="text-muted mx-auto mt-5 max-w-xl text-lg">Create a free account in under a minute - as a tenant looking for a home, or an owner ready to list.</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link to="/register"><Button size="lg">Create your account</Button></Link>
            <Link to="/login"><Button size="lg" variant="secondary">Try a demo login</Button></Link>
          </div>
        </Reveal>
      </section>
    </>
  )
}
