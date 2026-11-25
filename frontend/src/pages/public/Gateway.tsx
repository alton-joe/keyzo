import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { sceneSrc } from '../../features/tour/photos'
import { ArrowRight, Car, Home, Map, Armchair, type LucideIcon } from 'lucide-react'

type Category = { key: string; title: string; text: string; icon: LucideIcon; accent: string; to?: string }

const categories: Category[] = [
  { key: 'homes', title: 'Homes', text: 'Apartments, villas and houses for rent - browse, tour, apply and pay rent online.', icon: Home, accent: 'from-brand-700 to-brand-500', to: '/homes' },
  { key: 'land', title: 'Land', text: 'Plots and open land for lease.', icon: Map, accent: 'from-[#4b6b4a] to-[#6b8a5a]' },
  { key: 'furniture', title: 'Furniture', text: 'Furnish your space with rentable furniture.', icon: Armchair, accent: 'from-[#9a6b2f] to-[#b8893b]' },
  { key: 'vehicles', title: 'Vehicles', text: 'Cars and bikes, available to rent.', icon: Car, accent: 'from-[#35566b] to-[#4d7388]' },
]

function CategoryCard({ c, i, reduce }: { c: Category; i: number; reduce: boolean | null }) {
  const live = !!c.to
  const body = (
    <>
      <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${c.accent} ${live ? '' : 'opacity-40'}`} />
      <div className="flex items-start justify-between">
        <span className={`flex size-14 items-center justify-center rounded-2xl text-white shadow-soft ${live ? `bg-gradient-to-br ${c.accent} transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3` : 'surface-2 text-muted'}`}>
          <c.icon className="size-7" />
        </span>
        {live ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-70" /><span className="relative inline-flex size-2 rounded-full bg-emerald-500" /></span>
            Live now
          </span>
        ) : (
          <span className="surface-2 text-muted rounded-full px-3 py-1 text-xs font-bold">Coming soon</span>
        )}
      </div>
      <h3 className="mt-8 text-2xl font-extrabold">{c.title}</h3>
      <p className="text-muted mt-2 text-sm leading-relaxed">{c.text}</p>
      <div className={`mt-6 inline-flex items-center gap-2 text-sm font-bold ${live ? 'text-brand-500' : 'text-muted'}`}>
        {live ? <>Explore homes <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1.5" /></> : 'We are working on it'}
      </div>
    </>
  )
  const cls = `surface text-[var(--text)] group relative block h-full overflow-hidden rounded-3xl p-7 shadow-soft transition-all duration-300 ${live ? 'cursor-pointer hover:-translate-y-2 hover:shadow-lift' : 'cursor-not-allowed opacity-75'}`
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + i * 0.09, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
      {live ? <Link to={c.to!} className={cls} aria-label={`Open ${c.title}`}>{body}</Link> : <div className={cls} aria-disabled="true">{body}</div>}
    </motion.div>
  )
}

export default function Gateway() {
  const reduce = useReducedMotion()
  return (
    <section className="relative -mt-16 flex min-h-svh items-center overflow-hidden pt-16 text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-slate-950">
        <img src={sceneSrc('bengaluru')} srcSet={`${sceneSrc('bengaluru', true)} 1000w, ${sceneSrc('bengaluru')} 2000w`} sizes="100vw" alt="" decoding="async"
          className="absolute inset-0 size-full scale-110 object-cover blur-[6px]" />
        <div className="absolute inset-0 bg-black/60" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/50 to-transparent" />
      </div>
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <motion.h1 initial={reduce ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
            className="text-6xl font-extrabold sm:text-7xl lg:text-8xl">Keyzo</motion.h1>
          <motion.p initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.7 }}
            className="mt-5 text-xl font-semibold sm:text-2xl">Rent anything, all in one place.</motion.p>
          <motion.p initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.7 }}
            className="mx-auto mt-3 max-w-xl text-white/75">Pick what you want to rent to get started.</motion.p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((c, i) => <CategoryCard key={c.key} c={c} i={i} reduce={reduce} />)}
        </div>
      </div>
    </section>
  )
}
