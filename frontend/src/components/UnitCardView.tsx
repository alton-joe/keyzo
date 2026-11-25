import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { Bath, BedDouble, Building2, DoorOpen, MapPin, Maximize2 } from 'lucide-react'
import type { UnitCard } from '../lib/types'
import { money, label } from '../lib/format'
import { fallbackCover } from '../features/tour/buildTour'

const palettes = [
  ['#234f38', '#3a7a56'], ['#35566b', '#4d7388'], ['#4b6b4a', '#6b8a5a'], ['#9a6b2f', '#b8893b'], ['#6b4a3a', '#8a6450'], ['#2f5d5a', '#4a7f7a'],
]

/** Elegant generated artwork shown when a property has no photo yet. */
export function CoverArt({ seed, className = '' }: { seed: number; className?: string }) {
  const [a, b] = palettes[seed % palettes.length]
  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${className}`} style={{ backgroundImage: `linear-gradient(135deg, ${a}, ${b})` }} aria-hidden>
      <svg className="absolute inset-0 size-full opacity-20" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice">
        {Array.from({ length: 7 }).map((_, i) => <rect key={i} x={10 + i * 27} y={120 - 30 - ((i * 37 + seed * 13) % 60)} width="18" height="200" rx="3" fill="#fff" />)}
      </svg>
      <Building2 className="relative size-12 text-white/90 drop-shadow" strokeWidth={1.5} />
    </div>
  )
}

export function Cover({ src, seed, className = '', alt = '' }: { src: string | null | undefined; seed: number; className?: string; alt?: string }) {
  return src ? <img src={src} alt={alt} loading="lazy" className={`object-cover ${className}`} /> : <CoverArt seed={seed} className={className} />
}

export function UnitCardView({ u }: { u: UnitCard }) {
  return (
    <motion.div whileHover={{ y: -6 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }} className="relative">
      {/* sibling (not nested) link so the card stays valid HTML */}
      <Link to={`/units/${u.unitId}/tour`} className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-black/75">
        <DoorOpen className="size-3.5" />House tour
      </Link>
      <Link to={`/units/${u.unitId}`} className="surface group block overflow-hidden rounded-2xl shadow-soft transition-shadow hover:shadow-lift">
        <div className="relative h-48 overflow-hidden">
          <Cover src={u.coverImage ?? fallbackCover(u.propertyType, u.propertyId)} seed={u.propertyId} alt={u.propertyName} className="size-full transition-transform duration-700 group-hover:scale-110" />
          <span className="glass absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-semibold">{label(u.propertyType)}</span>
          <span className="gradient-brand absolute right-3 bottom-3 rounded-xl px-3 py-1.5 text-sm font-bold text-white shadow-lg">{money(u.monthlyRent)}<span className="text-xs font-medium opacity-80"> /mo</span></span>
        </div>
        <div className="p-5">
          <h3 className="line-clamp-1 text-lg font-bold">{u.propertyName} <span className="text-muted font-medium">- {u.unitNumber}</span></h3>
          <p className="text-muted mt-1 flex items-center gap-1.5 text-sm"><MapPin className="size-4" />{u.city}, {u.state}</p>
          <div className="text-muted mt-4 flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5"><BedDouble className="size-4" />{u.bedrooms} bd</span>
            <span className="flex items-center gap-1.5"><Bath className="size-4" />{u.bathrooms} ba</span>
            <span className="flex items-center gap-1.5"><Maximize2 className="size-4" />{u.areaSqft} sqft</span>
          </div>
          {u.amenities.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {u.amenities.slice(0, 3).map((a) => <span key={a} className="surface-2 rounded-full px-2.5 py-1 text-xs font-medium">{a}</span>)}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  )
}
