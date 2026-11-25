import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from 'motion/react'
import Lenis from 'lenis'
import { ArrowLeft, ChevronDown, ChevronUp, KeyRound, MapPin, X } from 'lucide-react'
import type { TourStop } from './buildTour'

/* ------------------------------------------------------------------------------------------------
 * Scroll choreography. The page is (n - 1) "segments" tall; scroll progress maps to t in [0, n-1].
 * t = i means you are standing in room i. Inside each segment the first HOLD part is a slow push-in
 * (you're looking around), the rest is the walk: the room zooms toward its doorway (focal point) and
 * blurs out while the next room settles in. The front door instead zooms to the door and swings open
 * as two 3D panels.
 * ---------------------------------------------------------------------------------------------- */
const HOLD = 0.38
const SEG_VH = 115

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const smooth = (a: number, b: number, x: number) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k) }
/** 0 while standing in room i, rising to 1 as you arrive in room i + 1 */
const leaveK = (t: number, i: number) => easeInOut(clamp01((t - i - HOLD) / (1 - HOLD)))

type Look = { opacity: number; scale: number; blur: number; origin: string }

function lookOf(t: number, i: number, stops: TourStop[], lite: boolean): Look {
  const s = stops[i]
  const d = t - i
  const focal = `${s.focal[0]}% ${s.focal[1]}%`
  if (d < -1 || d > 1) return { opacity: 0, scale: 1, blur: 0, origin: focal }
  const blurMax = lite ? 0 : 1
  if (d <= 0) {
    // arriving from the previous room
    const prev = stops[i - 1]
    if (!prev) return { opacity: 1, scale: 1, blur: 0, origin: focal }
    const k = leaveK(t, i - 1)
    if (prev.room === 'door') return { opacity: k > 0.38 ? 1 : 0, scale: 1.24 - 0.24 * smooth(0.38, 1, k), blur: 0, origin: '50% 50%' }
    if (s.outro) return { opacity: smooth(0.1, 0.65, k), scale: 1.5 - 0.5 * k, blur: 6 * (1 - k) * blurMax, origin: '50% 50%' }
    return { opacity: smooth(0.12, 0.68, k), scale: 1.16 - 0.16 * k, blur: 7 * (1 - smooth(0.2, 1, k)) * blurMax, origin: '50% 50%' }
  }
  // standing, then walking out toward the focal point
  const stand = clamp01(d / HOLD)
  const k = leaveK(t, i)
  if (s.room === 'door') return { opacity: 1, scale: 1, blur: 0, origin: focal } // handled by DoorLayer
  return { opacity: 1 - smooth(0.42, 0.95, k), scale: 1 + 0.045 * stand + 1.5 * k, blur: 9 * smooth(0.2, 1, k) * blurMax, origin: focal }
}

function Photo({ stop, className, style }: { stop: TourStop; className?: string; style?: React.ComponentProps<typeof motion.img>['style'] }) {
  return (
    <motion.img src={stop.src} srcSet={stop.srcSm ? `${stop.srcSm} 800w, ${stop.src} 1600w` : undefined} sizes="100vw" alt={stop.title}
      draggable={false} decoding="async" onLoad={(e) => { e.currentTarget.style.opacity = '1' }}
      className={`absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-700 select-none ${className ?? ''}`} style={style} />
  )
}

function RoomLayer({ t, i, stops, lite }: { t: MotionValue<number>; i: number; stops: TourStop[]; lite: boolean }) {
  const opacity = useTransform(t, (v) => lookOf(v, i, stops, lite).opacity)
  const scale = useTransform(t, (v) => lookOf(v, i, stops, lite).scale)
  const filter = useTransform(t, (v) => { const b = lookOf(v, i, stops, lite).blur; return b > 0.05 ? `blur(${b.toFixed(2)}px)` : 'none' })
  const transformOrigin = useTransform(t, (v) => lookOf(v, i, stops, lite).origin)
  return (
    <motion.div className="absolute inset-0 overflow-hidden will-change-transform" style={{ opacity, zIndex: stops.length - i }}>
      <motion.div className="absolute inset-0 will-change-transform" style={{ scale, filter, transformOrigin }}>
        <Photo stop={stops[i]} />
      </motion.div>
    </motion.div>
  )
}

/** The front door: zoom until the door fills the screen, then it splits into two panels that swing open in 3D. */
function DoorLayer({ t, i, stops }: { t: MotionValue<number>; i: number; stops: TourStop[] }) {
  const s = stops[i]
  const [fx, fy] = s.focal
  const enter = useTransform(t, (v) => lookOf(v, i, stops, false))
  const opacity = useTransform(enter, (l) => l.opacity)
  const zoomTransform = useTransform(t, (v) => {
    const d = v - i
    if (d <= 0) { const l = lookOf(v, i, stops, false); return `scale(${l.scale})` }
    const stand = clamp01(d / HOLD)
    const z = easeInOut(clamp01(leaveK(v, i) / 0.5))
    const sc = (1 + 0.045 * stand) * (1 + 1.35 * z)
    return `translate(${(z * sc * (50 - fx)).toFixed(3)}%, ${(z * sc * (50 - fy)).toFixed(3)}%) scale(${sc.toFixed(4)})`
  })
  const open = useTransform(t, (v) => easeInOut(clamp01((leaveK(v, i) - 0.42) / 0.58)))
  const leftRot = useTransform(open, (o) => 108 * o)
  const rightRot = useTransform(open, (o) => -108 * o)
  const shade = useTransform(open, (o) => 0.6 * o)
  const panels = useTransform(open, (o) => 1 - smooth(0.82, 1, o))
  const seam = useTransform(t, (v) => { const k = leaveK(v, i); return smooth(0.3, 0.45, k) * (1 - smooth(0.5, 0.7, k)) })

  return (
    <motion.div className="absolute inset-0 overflow-hidden" style={{ opacity, zIndex: stops.length - i, perspective: 1500 }}>
      {(['left', 'right'] as const).map((side) => (
        <motion.div key={side} className="absolute inset-0 will-change-transform"
          style={{
            clipPath: side === 'left' ? 'inset(0 50% 0 0)' : 'inset(0 0 0 50%)',
            transformOrigin: side === 'left' ? '0% 50%' : '100% 50%',
            rotateY: side === 'left' ? leftRot : rightRot, opacity: panels,
          }}>
          <motion.div className="absolute inset-0" style={{ transform: zoomTransform }}><Photo stop={s} /></motion.div>
          <motion.div className="absolute inset-0 bg-black" style={{ opacity: shade }} />
        </motion.div>
      ))}
      {/* a sliver of warm light appears in the gap just before the door opens */}
      <motion.div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-amber-100 blur-[2px]" style={{ opacity: seam }} />
    </motion.div>
  )
}

export default function HouseTour({ stops, heading, subheading, detailsHref, rentLabel }:
  { stops: TourStop[]; heading: string; subheading: string; detailsHref: string; rentLabel?: string }) {
  const reduce = useReducedMotion()
  if (reduce || stops.length < 2) return <StillTour stops={stops} heading={heading} subheading={subheading} detailsHref={detailsHref} />
  return <ScrollTour stops={stops} heading={heading} subheading={subheading} detailsHref={detailsHref} rentLabel={rentLabel} />
}

function ScrollTour({ stops, heading, subheading, detailsHref, rentLabel }:
  { stops: TourStop[]; heading: string; subheading: string; detailsHref: string; rentLabel?: string }) {
  const n = stops.length
  const ref = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const lenis = useRef<Lenis | null>(null)
  const nav = useNavigate()
  const [lite] = useState(() => typeof window !== 'undefined' && (window.innerWidth < 768 || (navigator.hardwareConcurrency ?? 8) <= 4))

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const p = useSpring(scrollYProgress, { stiffness: 220, damping: 38, mass: 0.35 })
  const t = useTransform(p, (v) => clamp01(v) * (n - 1))

  // re-render only when the room changes or the end card toggles - the animation itself runs on motion values
  const [idx, setIdx] = useState(0)
  const [atEnd, setAtEnd] = useState(false)
  useMotionValueEvent(t, 'change', (v) => {
    const base = Math.floor(v)
    const next = Math.min(n - 1, base + (leaveK(v, base) > 0.5 ? 1 : 0))
    setIdx((cur) => (cur === next ? cur : next))
    setAtEnd(v >= n - 1.1)
  })

  // smooth wheel scrolling just for the tour
  useEffect(() => {
    window.scrollTo(0, 0)
    const l = new Lenis({ lerp: 0.075, smoothWheel: true, wheelMultiplier: 0.9 })
    lenis.current = l
    let id = requestAnimationFrame(function raf(time) { l.raf(time); id = requestAnimationFrame(raf) })
    return () => { cancelAnimationFrame(id); l.destroy(); lenis.current = null }
  }, [])

  // preload the next rooms so the walk never waits on the network
  useEffect(() => {
    const small = window.innerWidth < 900
    for (let j = idx + 1; j <= Math.min(n - 1, idx + 3); j++) { const img = new Image(); img.src = (small && stops[j].srcSm) || stops[j].src }
  }, [idx, n, stops])

  const goTo = useCallback((i: number) => {
    const el = ref.current
    if (!el) return
    const target = Math.max(0, Math.min(n - 1, i))
    const top = el.getBoundingClientRect().top + window.scrollY
    const y = top + (target / (n - 1)) * (el.offsetHeight - window.innerHeight) + 2
    if (lenis.current) lenis.current.scrollTo(y, { duration: 1.6 + Math.min(2, Math.abs(target - idx) * 0.35) })
    else window.scrollTo({ top: y, behavior: 'smooth' })
  }, [n, idx])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); goTo(idx + 1) }
      else if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); goTo(idx - 1) }
      else if (e.key === 'Escape') nav(detailsHref)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goTo, idx, nav, detailsHref])

  // keep the active room visible in the floor-plan rail on small screens
  useEffect(() => { railRef.current?.querySelector<HTMLElement>(`[data-i="${Math.min(idx, n - 2)}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }) }, [idx, n])

  const progress = useTransform(t, (v) => v / (n - 1))
  const introOpacity = useTransform(t, [0, 0.3], [1, 0])
  const introY = useTransform(t, [0, 0.3], [0, -40])
  const current = stops[idx]
  const railStops = stops.slice(0, -1) // the outro returns to the first stop

  // only mount rooms near the camera (the next ones are preloaded above)
  const near = (i: number) => Math.abs(i - idx) <= 2

  return (
    <div ref={ref} className="relative bg-black" style={{ height: `${(n - 1) * SEG_VH + 100}vh` }}>
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden bg-black text-white">
        {/* the house */}
        <div className="absolute inset-0">
          {stops.map((s, i) => near(i) && (s.room === 'door'
            ? <DoorLayer key={s.key} t={t} i={i} stops={stops} />
            : <RoomLayer key={s.key} t={t} i={i} stops={stops} lite={lite} />))}
        </div>

        {/* cinematic grade: vignette + legibility gradients */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[60] bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.45))]" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-[60] h-36 bg-gradient-to-b from-black/60 to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-[60] h-72 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />

        {/* top bar */}
        <div className="absolute inset-x-0 top-0 z-[70] flex items-center justify-between gap-3 px-4 pt-4 sm:px-8 sm:pt-6">
          <Link to={detailsHref} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-sm font-semibold backdrop-blur-md transition hover:bg-white/20">
            <ArrowLeft className="size-4" /><span className="hidden sm:inline">Home details</span>
          </Link>
          <div className="min-w-0 text-center">
            <p className="truncate text-sm font-bold sm:text-base">{heading}</p>
            <p className="truncate text-xs text-white/70">{subheading}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-white/10 px-3 py-2 text-xs font-bold tabular-nums backdrop-blur-md sm:inline">{Math.min(idx + 1, n - 1)} / {n - 1}</span>
            <Link to={detailsHref} aria-label="Close tour" className="rounded-full bg-white/10 p-2 backdrop-blur-md transition hover:bg-white/20"><X className="size-5" /></Link>
          </div>
        </div>
        <motion.div aria-hidden className="absolute inset-x-0 top-0 z-[71] h-[3px] origin-left bg-gradient-to-r from-amber-300 via-white to-amber-300" style={{ scaleX: progress }} />

        {/* welcome card */}
        <motion.div className="pointer-events-none absolute inset-0 z-[65] flex flex-col items-center justify-center px-6 text-center" style={{ opacity: introOpacity, y: introY }}>
          <p className="text-xs font-bold tracking-[0.3em] text-amber-200 uppercase">House tour</p>
          <h1 className="mt-4 max-w-3xl text-4xl leading-tight font-extrabold drop-shadow-xl sm:text-6xl">{heading}</h1>
          <p className="mt-4 text-base text-white/85 sm:text-lg">{subheading}</p>
          <div className="mt-12 flex flex-col items-center gap-3 text-sm text-white/80">
            <span className="flex h-11 w-7 items-start justify-center rounded-full border-2 border-white/60 p-1.5"><motion.span className="block h-2 w-1 rounded-full bg-white" animate={{ y: [0, 12, 0], opacity: [1, 0.2, 1] }} transition={{ duration: 1.8, repeat: Infinity }} /></span>
            Scroll to walk in
          </div>
        </motion.div>

        {/* room caption */}
        <div className="absolute bottom-28 left-0 z-[70] px-5 sm:bottom-32 sm:px-10">
          <AnimatePresence mode="wait">
            {idx > 0 && !atEnd && (
              <motion.div key={current.key} initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -16, filter: 'blur(6px)' }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}>
                <p className="text-xs font-bold tracking-[0.25em] text-amber-200 uppercase">{String(idx + 1).padStart(2, '0')} · {current.label}</p>
                <h2 className="mt-2 text-3xl font-extrabold drop-shadow-lg sm:text-5xl">{current.title}</h2>
                {current.caption && <p className="mt-2 max-w-xl text-sm text-white/85 sm:text-base">{current.caption}</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* end card - back outside where the tour began */}
        <AnimatePresence>
          {atEnd && (
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-x-4 bottom-28 z-[72] mx-auto max-w-xl rounded-3xl border border-white/15 bg-black/45 p-6 text-center backdrop-blur-xl sm:bottom-32 sm:p-8">
              <p className="text-xs font-bold tracking-[0.25em] text-amber-200 uppercase">Tour complete</p>
              <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">{current.title}</h2>
              <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-white/80"><MapPin className="size-4 shrink-0" />{current.caption}</p>
              {rentLabel && <p className="mt-4 font-display text-3xl font-extrabold">{rentLabel}<span className="text-base font-medium text-white/70"> /month</span></p>}
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Link to={detailsHref} className="gradient-brand inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 font-semibold shadow-lg transition hover:-translate-y-0.5"><KeyRound className="size-5" />Apply for this home</Link>
                <button onClick={() => goTo(0)} className="inline-flex h-12 items-center justify-center rounded-xl bg-white/10 px-6 font-semibold transition hover:bg-white/20">Walk through again</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* floor-plan rail */}
        <div className="absolute inset-x-0 bottom-0 z-[70] px-3 pb-4 sm:px-8 sm:pb-6">
          <div className="mx-auto flex max-w-5xl items-center gap-2">
            <button onClick={() => goTo(idx - 1)} disabled={idx === 0} aria-label="Previous room" className="hidden shrink-0 rounded-full bg-white/10 p-2 backdrop-blur-md transition hover:bg-white/20 disabled:opacity-30 sm:block"><ChevronUp className="size-5" /></button>
            <div ref={railRef} className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto rounded-2xl bg-black/35 p-1.5 backdrop-blur-md [scrollbar-width:none]">
              {railStops.map((s, i) => {
                const active = i === idx || (idx === n - 1 && i === 0)
                const visited = i < idx
                return (
                  <button key={s.key} data-i={i} onClick={() => goTo(i)} aria-current={active ? 'step' : undefined}
                    className={`relative shrink-0 rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors duration-300 sm:flex-1 sm:text-sm ${active ? 'text-black' : visited ? 'text-white/90 hover:bg-white/10' : 'text-white/55 hover:bg-white/10'}`}>
                    {active && <motion.span layoutId="tour-rail-active" className="absolute inset-0 rounded-xl bg-white" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
                    <span className="relative">{s.label}</span>
                  </button>
                )
              })}
            </div>
            <button onClick={() => goTo(idx + 1)} disabled={idx >= n - 1} aria-label="Next room" className="hidden shrink-0 rounded-full bg-white/10 p-2 backdrop-blur-md transition hover:bg-white/20 disabled:opacity-30 sm:block"><ChevronDown className="size-5" /></button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Reduced-motion version: the same rooms as a calm, readable photo walk. */
function StillTour({ stops, heading, subheading, detailsHref }: { stops: TourStop[]; heading: string; subheading: string; detailsHref: string }) {
  const rooms = useMemo(() => stops.filter((s) => !s.outro), [stops])
  return (
    <div className="min-h-screen bg-black px-4 py-6 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link to={detailsHref} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-sm font-semibold hover:bg-white/20"><ArrowLeft className="size-4" />Home details</Link>
        <h1 className="mt-8 text-4xl font-extrabold">{heading}</h1>
        <p className="mt-2 text-white/75">{subheading}</p>
        <ol className="mt-10 space-y-10">
          {rooms.map((s, i) => (
            <li key={s.key}>
              <img src={s.srcSm ?? s.src} srcSet={s.srcSm ? `${s.srcSm} 800w, ${s.src} 1600w` : undefined} sizes="(min-width: 1024px) 1024px, 100vw" alt={s.title} loading={i < 2 ? 'eager' : 'lazy'} className="aspect-[16/9] w-full rounded-2xl object-cover" />
              <p className="mt-3 text-xs font-bold tracking-[0.25em] text-amber-200 uppercase">{String(i + 1).padStart(2, '0')} · {s.label}</p>
              <h2 className="mt-1 text-2xl font-bold">{s.title}</h2>
              {s.caption && <p className="text-white/75">{s.caption}</p>}
            </li>
          ))}
        </ol>
        <Link to={detailsHref} className="gradient-brand mt-12 inline-flex h-12 items-center rounded-xl px-6 font-semibold">Apply for this home</Link>
      </div>
    </div>
  )
}
