import { motion, useReducedMotion } from 'motion/react'
import { Link } from 'react-router-dom'
import { ArrowRight, Bike, Building2, Armchair, Home, KeyRound, LandPlot, Target, Rocket, Route } from 'lucide-react'
import { Reveal, Stagger, StaggerItem } from '../../components/motion'
import { Button } from '../../components/ui'

/* ---- brand icons as inline SVG (lucide dropped brand logos) ---- */
const MailIcon = () => (
  <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7.5 8 6 8-6" />
  </svg>
)
const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" className="size-[18px]" fill="currentColor" aria-hidden>
    <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4V21H3V9.75Zm6.5 0h3.8v1.54h.06c.53-1 1.82-2.04 3.75-2.04 4 0 4.74 2.63 4.74 6.05V21h-4v-4.96c0-1.18-.02-2.7-1.65-2.7-1.65 0-1.9 1.29-1.9 2.62V21h-4V9.75Z" />
  </svg>
)
const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r="0.6" fill="currentColor" />
  </svg>
)

const socialCls = 'text-muted flex size-10 items-center justify-center rounded-full border border-base bg-[var(--surface)] transition duration-300 hover:-translate-y-1 hover:border-transparent hover:bg-brand-600 hover:text-white hover:shadow-lift'

/** Email opens the visitor's mail app; the other social buttons are still placeholders. */
function SocialBtn({ label, href, children }: { label: string; href?: string; children: React.ReactNode }) {
  if (href) return <a href={href} aria-label={label} title={label} className={socialCls}>{children}</a>
  return (
    <button type="button" aria-label={label} title={label} onClick={(e) => e.preventDefault()}
      className={socialCls}>
      {children}
    </button>
  )
}

const team = [
  { name: 'Alton Joe', email: 'alton.joe@bcah.christuniversity.in', img: '/team/alton.webp', glow: 'from-brand-600 to-brand-400' },
  { name: 'Lakshay Maloo', email: 'lakshay.maloo@bcah.christuniversity.in', img: '/team/lakshay.webp', glow: 'from-[#9a6b2f] to-[#b8893b]' },
  { name: 'Sandra Siby', email: 'sandra.siby@bcah.christuniversity.in', img: '/team/sandra.webp', glow: 'from-[#35566b] to-[#4d7388]' },
]

const roadmap = [
  { icon: Home, title: 'Houses & apartments', status: 'Live today', text: 'Listings, virtual tours, applications, e-leases, rent and maintenance - all in one place.', live: true },
  { icon: Bike, title: 'Two-wheelers', status: 'Up next', text: 'Rent a scooter or bike by the day, week or month with the same trusted, verified flow.' },
  { icon: Armchair, title: 'Furniture', status: 'Planned', text: 'Furnish a home without buying - flexible plans for beds, sofas, desks and more.' },
  { icon: LandPlot, title: 'Land & plots', status: 'Vision', text: 'Lease land for farming, storage or events with clear terms and transparent paperwork.' },
]

export default function About() {
  const reduce = useReducedMotion()
  return (
    <div className="overflow-x-clip">
      {/* ---------------- hero + founders (photos visible on first load) ---------------- */}
      <section className="relative isolate px-4 pt-8 pb-14 sm:px-6 sm:pt-10">
        <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_srgb,var(--color-brand-500)_12%,transparent),transparent)]" />

        <div className="mx-auto max-w-5xl">
          <div className="mb-5 text-center">
            <motion.span initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="surface inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold">
              Meet the founders
            </motion.span>
            <motion.h1 initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.7 }}
              className="mt-4 text-3xl leading-[1.1] font-extrabold sm:text-5xl">
              Renting should feel <span className="gradient-text">simple,</span> not stressful.
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.7 }}
              className="text-muted mx-auto mt-3 max-w-2xl leading-relaxed">
              Keyzo is built by three students who were tired of renting running on phone calls, paper receipts and blind trust.
            </motion.p>
          </div>

          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="gradient-text mb-4 text-center text-2xl font-extrabold tracking-wide sm:text-3xl">
            Team 6
          </motion.p>

          <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.2 } } }} className="grid gap-6 sm:grid-cols-3 sm:gap-7">
            {team.map((p) => (
              <motion.article key={p.name} variants={{ hidden: { opacity: 0, y: 26 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } } }}
                whileHover={reduce ? undefined : { y: -8 }} className="group relative h-full">
                <div aria-hidden className={`absolute -inset-px rounded-[28px] bg-gradient-to-br ${p.glow} opacity-40 blur-md transition duration-500 group-hover:opacity-90`} />
                <div className="surface relative flex h-full flex-col overflow-hidden rounded-[28px] shadow-soft">
                  <div className="relative aspect-[4/5] overflow-hidden">
                    <img src={p.img} alt={p.name} className="size-full object-cover object-top transition duration-700 group-hover:scale-105" />
                    <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent" />
                  </div>
                  <div className="flex flex-1 flex-col items-center px-5 pt-4 pb-5 text-center">
                    <h3 className="text-xl font-extrabold">{p.name}</h3>
                    <div className="mt-4 flex gap-2.5">
                      <SocialBtn label={`Email ${p.name}`} href={`mailto:${p.email}`}><MailIcon /></SocialBtn>
                      <SocialBtn label={`${p.name} on LinkedIn`}><LinkedInIcon /></SocialBtn>
                      <SocialBtn label={`${p.name} on Instagram`}><InstagramIcon /></SocialBtn>
                    </div>
                  </div>
                </div>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ---------------- problem ---------------- */}
      <section className="px-4 py-14 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
          <Reveal>
            <div className="surface relative h-full overflow-hidden rounded-3xl p-8 sm:p-10">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-rose-500/12 text-rose-500"><Target className="size-6" /></span>
              <h2 className="mt-5 text-2xl font-extrabold sm:text-3xl">The problem we saw</h2>
              <p className="text-muted mt-4 leading-relaxed">Finding and managing a rental in India is still stitched together from brokers, WhatsApp forwards, handwritten agreements and cash receipts.</p>
              <ul className="mt-5 space-y-3 text-sm">
                {[
                  'Tenants can’t trust listings - photos are stale and details are vague.',
                  'Owners chase rent, lose track of deposits and juggle repair calls.',
                  'Agreements and payment history are scattered, so disputes are hard to settle.',
                  'There is no single, transparent record both sides can rely on.',
                ].map((t) => (
                  <li key={t} className="flex gap-3"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-rose-500" />{t}</li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="relative h-full overflow-hidden rounded-3xl p-8 text-white sm:p-10 gradient-brand">
              <div aria-hidden className="absolute -top-20 -right-20 size-72 rounded-full bg-white/10 blur-2xl" />
              <span className="relative flex size-12 items-center justify-center rounded-2xl bg-white/20"><KeyRound className="size-6" /></span>
              <h2 className="relative mt-5 text-2xl font-extrabold sm:text-3xl">Our answer: Keyzo</h2>
              <p className="relative mt-4 leading-relaxed text-white/85">One secure platform where properties, tenants, leases, rent and maintenance live together - clear for tenants, effortless for owners.</p>
              <ul className="relative mt-5 space-y-3 text-sm text-white/95">
                {[
                  'Verified listings with immersive virtual house tours.',
                  'Digital applications and leases - no paperwork piles.',
                  'Automatic invoices, deposits and payment history.',
                  'Maintenance requests tracked from report to fix.',
                ].map((t) => (
                  <li key={t} className="flex gap-3"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-amber-300" />{t}</li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- journey ---------------- */}
      <section className="px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <Reveal className="mb-10 text-center">
            <p className="text-brand-600 dark:text-brand-300 text-sm font-bold tracking-widest uppercase">Our story</p>
            <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">How we got here</h2>
          </Reveal>
          <div className="relative space-y-8 pl-8 sm:pl-10">
            <div aria-hidden className="absolute top-2 bottom-2 left-[11px] w-0.5 bg-gradient-to-b from-brand-500 via-brand-400 to-amber-500 sm:left-[15px]" />
            {[
              { icon: Route, t: 'A shared frustration', d: 'Three friends in the same BCA class, each with a story about a rental gone wrong - a lost deposit, a missed repair, an unclear agreement.' },
              { icon: Building2, t: 'A database project, with a purpose', d: 'What began as our DBMS project turned into a real question: what would renting look like if it were designed properly from scratch?' },
              { icon: KeyRound, t: 'Built for both sides', d: 'We designed Keyzo around owners, managers and tenants together - with a clean database, secure roles and an interface that feels effortless.' },
              { icon: Rocket, t: 'Today', d: 'Keyzo runs house and apartment rentals end to end - and we’re only getting started.' },
            ].map((s, i) => (
              <Reveal key={s.t} delay={i * 0.05} className="relative">
                <span className="gradient-brand absolute top-1 -left-8 flex size-6 items-center justify-center rounded-full text-white ring-4 ring-[var(--bg)] sm:-left-10 sm:size-8"><s.icon className="size-3 sm:size-4" /></span>
                <h3 className="text-lg font-bold">{s.t}</h3>
                <p className="text-muted mt-1 leading-relaxed">{s.d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- roadmap ---------------- */}
      <section className="px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-10 text-center">
            <p className="text-brand-600 dark:text-brand-300 text-sm font-bold tracking-widest uppercase">What’s next</p>
            <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">Beyond homes: rent anything, simply</h2>
            <p className="text-muted mx-auto mt-3 max-w-2xl">Today Keyzo handles house rentals. The same trusted flow - verify, agree, pay, maintain - is built to stretch to much more.</p>
          </Reveal>
          <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {roadmap.map((r) => (
              <StaggerItem key={r.title}>
                <div className={`surface relative h-full rounded-3xl p-6 transition duration-300 hover:-translate-y-1.5 hover:shadow-lift ${r.live ? 'ring-2 ring-brand-500/60' : ''}`}>
                  <span className={`flex size-12 items-center justify-center rounded-2xl ${r.live ? 'gradient-brand text-white' : 'bg-brand-500/10 text-brand-600 dark:text-brand-300'}`}><r.icon className="size-6" /></span>
                  <span className={`mt-5 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide uppercase ${r.live ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'surface-2 text-muted'}`}>{r.status}</span>
                  <h3 className="mt-2 text-lg font-bold">{r.title}</h3>
                  <p className="text-muted mt-1.5 text-sm leading-relaxed">{r.text}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="px-4 pt-10 pb-24 sm:px-6">
        <Reveal>
          <div className="gradient-brand relative mx-auto max-w-5xl overflow-hidden rounded-[32px] px-6 py-14 text-center text-white sm:px-12">
            <div aria-hidden className="absolute -bottom-24 -left-16 size-72 rounded-full bg-white/10 blur-2xl" />
            <h2 className="relative text-3xl font-extrabold sm:text-4xl">Ready to find your next key?</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-white/85">Browse verified homes or list your own property in minutes.</p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/units"><Button size="lg" variant="secondary" icon={<ArrowRight className="size-5" />}>Find a home</Button></Link>
              <Link to="/register" className="on-photo-btn"><Button size="lg" variant="secondary">List your property</Button></Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  )
}
