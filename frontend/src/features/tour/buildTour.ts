import type { PublicUnitDetail, UnitTour } from '../../lib/types'
import { library, photoSrc, type HomeStyle, type LibraryPhoto, type RoomKind } from './photos'

export type TourStop = {
  key: string
  room: RoomKind
  /** short label for the floor-plan rail */
  label: string
  title: string
  caption?: string
  src: string
  srcSm?: string
  /** where the camera walks toward when leaving this room, in % */
  focal: [number, number]
  /** the closing stop: we step back outside to where the tour started */
  outro?: boolean
}

const styleOf = (propertyType: string): HomeStyle =>
  propertyType === 'villa' || propertyType === 'house' ? 'villa' : propertyType === 'studio' ? 'studio' : 'apartment'

/** Small deterministic PRNG so a unit always gets the same rooms (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function picker(style: HomeStyle, seed: number) {
  const rand = rng(seed)
  const used = new Set<string>()
  return (room: RoomKind, prefer?: string[]): LibraryPhoto => {
    const pool = library.filter((p) => p.room === room && p.styles.includes(style))
    const preferred = prefer?.map((id) => pool.find((p) => p.id === id)).find((p) => p && !used.has(p.id))
    const fresh = pool.filter((p) => !used.has(p.id))
    const choice = preferred ?? (fresh.length ? fresh : pool)[Math.floor(rand() * (fresh.length ? fresh.length : pool.length))]
    used.add(choice.id)
    return choice
  }
}

const has = (text: string, ...words: string[]) => words.some((w) => text.includes(w))

/** Real exterior photo for a listing that has no uploaded images yet - the same one its tour starts with. */
export const fallbackCover = (propertyType: string, propertyId: number, small = true) =>
  photoSrc(picker(styleOf(propertyType), propertyId * 7919)('exterior').id, small)

/** Gallery for a unit without uploaded photos: the rooms of its built-in tour. */
export const fallbackGallery = (d: PublicUnitDetail) =>
  buildTour(d).filter((s) => !s.outro && s.room !== 'door').map((s) => s.src)

/**
 * Builds the room-by-room walk for a unit. When the owner has set up a custom tour (photos of the actual home)
 * that is used as-is; otherwise a realistic tour is composed from the built-in photo library, shaped by the
 * unit's real layout: one stop per bedroom, up to two washrooms, a balcony / pool deck, and back outside.
 */
export function buildTour(d: PublicUnitDetail, custom?: UnitTour | null): TourStop[] {
  const c = d.card
  if (custom && custom.stops.length > 0) {
    const stops: TourStop[] = custom.stops.map((s) => ({
      key: `c${s.id}`, room: s.roomType === 'other' ? 'hall' : (s.roomType as RoomKind), label: s.title, title: s.title,
      caption: s.caption ?? undefined, src: s.imageUrl, focal: [Number(s.focalX), Number(s.focalY)],
    }))
    const first = stops[0]
    if (first.room === 'exterior') stops.push({ ...first, key: `${first.key}-out`, label: 'Outside', title: 'Back where we started', caption: `${c.propertyName}, ${c.city}`, outro: true })
    return stops
  }

  const style = styleOf(c.propertyType)
  const text = `${d.description ?? ''} ${d.propertyDescription ?? ''}`.toLowerCase()
  const building = picker(style, c.propertyId * 7919) // same exterior + door for every unit in a property
  const home = picker(style, c.unitId * 104729) // each unit gets its own interiors
  const stops: TourStop[] = []
  const add = (p: LibraryPhoto, label: string, title: string, caption?: string, extra?: Partial<TourStop>) =>
    stops.push({ key: `${p.id}-${stops.length}`, room: p.room, label, title, caption, src: photoSrc(p.id), srcSm: photoSrc(p.id, true), focal: p.f, ...extra })

  const floor = d.floorNo === 0 ? 'the ground floor' : `floor ${d.floorNo}`
  const bhk = style === 'studio' ? 'Studio' : `${c.bedrooms}BHK`

  // 1. arrive outside
  const ext = building('exterior')
  add(ext, 'Outside', c.propertyName, `${ext.tag ?? 'Arriving'} · ${c.city}`)

  // 2. the front door (opens in 3D)
  add(building('door'), 'Entrance', `Unit ${c.unitNumber}`, `${style === 'villa' ? 'Private entrance' : `Front door on ${floor}`} · scroll to step in`)

  // 3. hall / living room
  const hall = home('hall')
  add(hall, style === 'studio' ? 'Living' : 'Hall', style === 'studio' ? 'Studio living space' : 'Living room',
    hall.tag ?? `${Number(c.areaSqft).toLocaleString('en-IN')} sq ft ${bhk}${has(text, 'east-facing') ? ' · east-facing' : ''}`)

  // 4. bedrooms - one stop each
  const beds = style === 'studio' ? 1 : Math.max(1, Math.min(c.bedrooms, 4))
  for (let i = 0; i < beds; i++) {
    const b = home('bedroom')
    if (style === 'studio') add(b, 'Bed', 'Sleeping nook', b.tag ?? (has(text, 'furnished') ? 'Fully furnished' : 'Cosy sleeping corner'))
    else add(b, i === 0 ? 'Master' : `Bed ${i + 1}`, i === 0 ? 'Master bedroom' : `Bedroom ${i + 1}`,
      b.tag ?? (i === 0 ? (c.bathrooms > 1 ? 'With attached washroom' : 'Bright and airy') : i === 1 && has(text, 'workspace') ? 'Room for a home office' : 'Wardrobe and natural light'))
  }

  // 5. kitchen
  const k = home('kitchen', has(text, 'modular') ? ['kit-modular'] : undefined)
  add(k, 'Kitchen', style === 'studio' ? 'Kitchenette' : has(text, 'modular') ? 'Modular kitchen' : 'Kitchen', k.tag && !k.tag.startsWith('Modular') ? k.tag : 'Fitted cabinets and counter space')

  // 6. washrooms
  const baths = Math.max(1, Math.min(c.bathrooms, 2))
  for (let i = 0; i < baths; i++) {
    const w = home('bathroom')
    add(w, baths === 1 ? 'Washroom' : i === 0 ? 'Bath 1' : 'Bath 2', baths === 1 ? 'Washroom' : i === 0 ? 'Attached washroom' : 'Common washroom',
      c.bathrooms > 2 && i === 1 ? `${c.bathrooms} washrooms in total` : undefined)
  }

  // 7. balcony / terrace / pool deck
  const outside = style === 'villa'
    ? home('balcony', has(text, 'pool') ? ['pool-white', 'pool-court'] : has(text, 'lake') ? ['pool-dusk'] : undefined)
    : home('balcony', has(text, 'garden') ? ['bal-terrace'] : has(text, 'terrace') ? ['bal-terrace'] : has(text, 'skyline') ? ['bal-skyline'] : undefined)
  const outsideTitle = style === 'villa' ? (has(text, 'pool') ? 'Private pool' : has(text, 'garden') ? 'Garden & pool deck' : 'Pool deck')
    : has(text, 'garden') ? 'Garden access' : has(text, 'terrace') ? 'Terrace' : 'Balcony'
  add(outside, style === 'villa' ? 'Pool' : 'Balcony', outsideTitle, outside.tag)

  // 8. step back outside - the tour ends where it started
  add(ext, 'Outside', 'Back where we started', `${c.propertyName} · ${d.addressLine}, ${c.city}`, { outro: true })
  return stops
}
