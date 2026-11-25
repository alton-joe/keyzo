import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ArrowRight, Crosshair, Home, LocateFixed, MapPin, Navigation } from 'lucide-react'
import { api } from '../../lib/api'
import { useTheme } from '../../lib/providers'
import { sceneSrc } from '../tour/photos'
import type { Paged, UnitCard } from '../../lib/types'
import { money } from '../../lib/format'

// ---------------------------------------------------------------------------------------------------------------
// Coordinates for the cities Keyzo can list homes in. Anything the database returns that is not here is skipped.
// ---------------------------------------------------------------------------------------------------------------
type Place = { lat: number; lng: number; scene?: string }
const PLACES: Record<string, Place> = {
  Bengaluru: { lat: 12.9716, lng: 77.5946, scene: 'bengaluru' },
  Chennai: { lat: 13.0827, lng: 80.2707, scene: 'chennai' },
  Kochi: { lat: 9.9312, lng: 76.2673, scene: 'kochi' },
  Mysuru: { lat: 12.2958, lng: 76.6394 },
  Coimbatore: { lat: 11.0168, lng: 76.9558 },
  Madurai: { lat: 9.9252, lng: 78.1198 },
  Thiruvananthapuram: { lat: 8.5241, lng: 76.9366 },
  Hyderabad: { lat: 17.385, lng: 78.4867 },
  Pune: { lat: 18.5204, lng: 73.8567 },
  Mumbai: { lat: 19.076, lng: 72.8777 },
  Delhi: { lat: 28.6139, lng: 77.209 },
  Kolkata: { lat: 22.5726, lng: 88.3639 },
  Ahmedabad: { lat: 23.0225, lng: 72.5714 },
  Visakhapatnam: { lat: 17.6868, lng: 83.2185 },
}
const ALIASES: Record<string, string> = {
  bangalore: 'Bengaluru', bengaluru: 'Bengaluru', madras: 'Chennai', cochin: 'Kochi', ernakulam: 'Kochi',
  mysore: 'Mysuru', trivandrum: 'Thiruvananthapuram', bombay: 'Mumbai', 'new delhi': 'Delhi', calcutta: 'Kolkata', vizag: 'Visakhapatnam',
}
const canonical = (c: string) => {
  const k = c.trim().toLowerCase()
  if (ALIASES[k]) return ALIASES[k]
  return Object.keys(PLACES).find((p) => p.toLowerCase() === k) ?? null
}
const DEFAULT_TOUR = ['Bengaluru', 'Kochi', 'Chennai', 'Mysuru']

type Stop = { name: string; lat: number; lng: number; scene?: string; homes: number; fromRent: number | null; units: UnitCard[] }

const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const r = (d: number) => (d * Math.PI) / 180, R = 6371
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
const fmtCoord = (lat: number, lng: number) => `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}  ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`

// Esri's gray canvas basemaps: no API key needed, and there is a matching light and dark style.
const esri = (layer: string) => `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/${layer}/MapServer/tile/{z}/{y}/{x}`
const TILES = {
  light: { base: esri('World_Light_Gray_Base'), labels: esri('World_Light_Gray_Reference') },
  dark: { base: esri('World_Dark_Gray_Base'), labels: esri('World_Dark_Gray_Reference') },
}
const ATTRIBUTION = 'Tiles © Esri — Esri, DeLorme, NAVTEQ'

const pinHtml = (s: Stop) =>
  `<span class="kz-ring"></span><span class="kz-dot"></span><span class="kz-tag">${s.name}<b>${s.homes}</b></span>`

export default function CityMap() {
  const reduce = useReducedMotion()
  const { dark } = useTheme()

  // ------------------------------------------------------------------ data -> itinerary
  const units = useQuery({
    queryKey: ['map-units'],
    queryFn: () => api.get<Paged<UnitCard>>('/public/units', { PageSize: 100, Sort: 'newest' }, false),
    staleTime: 60_000,
  })
  const stops = useMemo<Stop[]>(() => {
    const byCity = new Map<string, UnitCard[]>()
    for (const u of units.data?.items ?? []) {
      const c = canonical(u.city)
      if (c) byCity.set(c, [...(byCity.get(c) ?? []), u])
    }
    const names = new Set<string>(DEFAULT_TOUR)
    byCity.forEach((_, c) => names.add(c))
    const all: Stop[] = [...names].map((name) => {
      const list = byCity.get(name) ?? []
      return { name, ...PLACES[name], homes: list.length, fromRent: list.length ? Math.min(...list.map((u) => u.monthlyRent)) : null, units: list }
    })
    // order the journey as a sensible route: start where the most homes are, then always hop to the nearest unvisited city
    const left = [...all].sort((a, b) => b.homes - a.homes)
    const route: Stop[] = [left.shift()!]
    while (left.length) {
      const last = route[route.length - 1]
      left.sort((a, b) => km(last, a) - km(last, b))
      route.push(left.shift()!)
    }
    return route
  }, [units.data])

  // ------------------------------------------------------------------ scroll -> active city
  const wrapRef = useRef<HTMLElement>(null)
  const [active, setActive] = useState(0)
  const n = stops.length
  const { scrollYProgress } = useScroll({ target: wrapRef, offset: ['start start', 'end end'] })
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (reduce) return
    setActive(Math.max(0, Math.min(n - 1, Math.round(v * (n - 1)))))
  })
  const pick = useCallback((i: number) => {
    if (reduce || !wrapRef.current) { setActive(i); return }
    const el = wrapRef.current
    const top = el.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: top + (n > 1 ? i / (n - 1) : 0) * (el.offsetHeight - window.innerHeight), behavior: 'smooth' })
  }, [n, reduce])

  // ------------------------------------------------------------------ the Leaflet map
  const mapEl = useRef<HTMLDivElement>(null)
  const hud = useRef<HTMLSpanElement>(null)
  const map = useRef<L.Map | null>(null)
  const tile = useRef<L.LayerGroup | null>(null)
  const markers = useRef<L.Marker[]>([])
  const trail = useRef<{ line: L.Polyline; dot: L.CircleMarker; raf: number } | null>(null)
  const you = useRef<L.Marker | null>(null)
  const prev = useRef<number | null>(null)
  const [geo, setGeo] = useState<{ state: 'idle' | 'busy' | 'ok' | 'error'; text?: string; nearest?: number }>({ state: 'idle' })

  // create once
  useEffect(() => {
    if (!mapEl.current || map.current) return
    const m = L.map(mapEl.current, {
      zoomControl: false, scrollWheelZoom: false, doubleClickZoom: true, attributionControl: true,
      dragging: !L.Browser.mobile, touchZoom: true, zoomSnap: 0.25, minZoom: 4, maxZoom: 15, worldCopyJump: true,
    }).setView([16.5, 78.5], 5)
    m.attributionControl.setPrefix(false)
    L.control.zoom({ position: 'bottomright' }).addTo(m)
    const paint = () => { if (hud.current) { const c = m.getCenter(); hud.current.textContent = `${fmtCoord(c.lat, c.lng)}  ·  z${m.getZoom().toFixed(1)}` } }
    m.on('move', paint); paint()
    map.current = m
    return () => { cancelAnimationFrame(trail.current?.raf ?? 0); m.remove(); map.current = null; tile.current = null; markers.current = [] }
  }, [])

  // basemap follows the site theme
  useEffect(() => {
    const m = map.current; if (!m) return
    tile.current?.remove()
    const set = dark ? TILES.dark : TILES.light
    const base = L.tileLayer(set.base, { maxNativeZoom: 16, maxZoom: 19, attribution: ATTRIBUTION })
    const labels = L.tileLayer(set.labels, { maxNativeZoom: 16, maxZoom: 19, pane: 'shadowPane' })
    tile.current = L.layerGroup([base, labels]).addTo(m)
  }, [dark])

  // city pins + the faint route that links them (rebuilt when the itinerary changes)
  const routeLine = useRef<L.Polyline | null>(null)
  useEffect(() => {
    const m = map.current; if (!m || n === 0) return
    markers.current.forEach((k) => k.remove()); routeLine.current?.remove()
    routeLine.current = L.polyline(stops.map((s) => [s.lat, s.lng] as L.LatLngTuple), { color: '#2c6144', weight: 2, opacity: 0.45, dashArray: '2 9', lineCap: 'round' }).addTo(m)
    markers.current = stops.map((s, i) => {
      const k = L.marker([s.lat, s.lng], { icon: L.divIcon({ className: 'kz-pin', html: pinHtml(s), iconSize: [0, 0] }), keyboard: false, riseOnHover: true }).addTo(m)
      k.on('click', () => pick(i))
      return k
    })
    markers.current[active]?.getElement()?.classList.add('is-active')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, pick])

  // travel to the active city: smooth fly-to + a GPS "ping" that runs along the route while the camera moves
  useEffect(() => {
    const m = map.current, s = stops[active]; if (!m || !s) return
    markers.current.forEach((k, i) => k.getElement()?.classList.toggle('is-active', i === active))
    const t = window.setTimeout(() => {
      const from = prev.current != null ? stops[prev.current] : null
      const duration = reduce ? 0.01 : from ? Math.min(3.4, 1.6 + km(from, s) / 600) : 2.4
      m.flyTo([s.lat, s.lng], 10.5, { duration, easeLinearity: 0.18, animate: !reduce })
      if (from && !reduce && from !== s) {
        cancelAnimationFrame(trail.current?.raf ?? 0); trail.current?.line.remove(); trail.current?.dot.remove()
        const line = L.polyline([[from.lat, from.lng]], { color: '#fbbf24', weight: 4, opacity: 0.95, lineCap: 'round' }).addTo(m)
        const dot = L.circleMarker([from.lat, from.lng], { radius: 7, color: '#fff', weight: 3, fillColor: '#2c6144', fillOpacity: 1 }).addTo(m)
        const t0 = performance.now(), ms = duration * 1000
        const state = { line, dot, raf: 0 }
        const step = (now: number) => {
          const p = Math.min(1, (now - t0) / ms), e = p < 0.5 ? 2 * p * p : 1 - (2 - 2 * p) ** 2 / 2
          const pt: L.LatLngTuple = [from.lat + (s.lat - from.lat) * e, from.lng + (s.lng - from.lng) * e]
          line.setLatLngs([[from.lat, from.lng], pt]); dot.setLatLng(pt)
          if (p < 1) state.raf = requestAnimationFrame(step)
          else window.setTimeout(() => { line.remove(); dot.remove() }, 900)
        }
        state.raf = requestAnimationFrame(step); trail.current = state
      }
      prev.current = active
    }, 140)
    return () => window.clearTimeout(t)
  }, [active, stops, reduce])

  // keep Leaflet sized correctly when the layout changes
  useEffect(() => { const t = setTimeout(() => map.current?.invalidateSize(), 400); return () => clearTimeout(t) }, [n])

  // ------------------------------------------------------------------ "locate me" (browser GPS)
  const locate = () => {
    if (!('geolocation' in navigator)) { setGeo({ state: 'error', text: 'This browser has no location support.' }); return }
    setGeo({ state: 'busy' })
    navigator.geolocation.getCurrentPosition((pos) => {
      const me = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      const m = map.current; if (!m) return
      you.current?.remove()
      you.current = L.marker([me.lat, me.lng], { icon: L.divIcon({ className: 'kz-you', html: '<span class="kz-ring"></span><span class="kz-dot"></span>', iconSize: [0, 0] }), keyboard: false, zIndexOffset: 1000 }).addTo(m)
      let best = 0, bestKm = Infinity
      stops.forEach((s, i) => { const d = km(me, s); if (d < bestKm) { best = i; bestKm = d } })
      m.flyTo([me.lat, me.lng], 11, { duration: reduce ? 0.01 : 2.2, easeLinearity: 0.2 })
      setGeo({ state: 'ok', nearest: best, text: bestKm < 3 ? `You are in ${stops[best].name}` : `${Math.round(bestKm).toLocaleString()} km from ${stops[best].name}` })
    }, (err) => setGeo({ state: 'error', text: err.code === 1 ? 'Location permission was denied.' : 'Could not get your location.' }),
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 })
  }

  // keep the active city visible inside the (scrollable) list
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const list = listRef.current, tab = list?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!list || !tab) return
    if (list.scrollHeight > list.clientHeight) list.scrollTo({ top: tab.offsetTop - list.clientHeight / 2 + tab.offsetHeight / 2, behavior: 'smooth' })
    else if (list.scrollWidth > list.clientWidth) list.scrollTo({ left: tab.offsetLeft - list.clientWidth / 2 + tab.offsetWidth / 2, behavior: 'smooth' })
  }, [active, stops])

  const cur = stops[active]
  return (
    <section ref={wrapRef} aria-label="Explore cities on the map" className="relative" style={{ height: reduce ? 'auto' : `${100 + Math.max(0, n - 1) * 55}svh` }}>
      <div className={`${reduce ? 'h-[80svh]' : 'sticky top-0 h-svh'} relative overflow-hidden`}>
        <div ref={mapEl} className="kz-map absolute inset-0" role="application" aria-label="Interactive map of Keyzo cities" />
        {/* soft edge fades so the map melts into the page */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] h-32 bg-gradient-to-b from-[var(--bg)] to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] h-24 bg-gradient-to-t from-[var(--bg)] to-transparent" />

        {/* heading + live GPS readout */}
        <div className="pointer-events-none absolute inset-x-0 top-20 z-[600] mx-auto flex max-w-7xl flex-col gap-3 px-4 sm:px-6 md:top-24">
          <div className="pointer-events-auto max-w-md">
            <p className="text-brand-500 text-sm font-bold tracking-widest uppercase">Where we are</p>
            <h2 className="mt-1 text-3xl font-extrabold sm:text-4xl">Scroll to travel across cities</h2>
          </div>
          <div className="glass pointer-events-auto flex w-fit items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-soft" aria-live="off">
            <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex size-2 rounded-full bg-emerald-500" /></span>
            <Crosshair className="text-muted size-3.5" /><span ref={hud} className="font-mono tracking-tight tabular-nums" />
          </div>
        </div>

        {/* control panel */}
        <div className="absolute inset-x-3 bottom-4 z-[700] md:inset-x-auto md:top-1/2 md:right-6 md:bottom-auto md:w-[22rem] md:-translate-y-1/2 lg:right-[max(1.5rem,calc((100vw-80rem)/2+1.5rem))]">
          <div className="glass shadow-lift overflow-hidden rounded-3xl border border-base">
            <AnimatePresence mode="wait">
              {cur && (
                <motion.div key={cur.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35 }}>
                  <div className="relative h-28 md:h-36">
                    {cur.scene ? <img src={sceneSrc(cur.scene, true)} alt="" className="size-full object-cover" />
                      : <div className="gradient-brand size-full" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    <div className="absolute inset-x-4 bottom-3 flex items-end justify-between text-white">
                      <div><p className="flex items-center gap-1 text-[11px] font-semibold tracking-widest text-white/80 uppercase"><MapPin className="size-3" />Stop {active + 1} of {n}</p>
                        <h3 className="font-display text-2xl leading-tight font-extrabold">{cur.name}</h3></div>
                      <div className="text-right"><p className="font-display text-2xl leading-none font-extrabold">{cur.homes}</p><p className="text-[11px] text-white/80">{cur.homes === 1 ? 'home' : 'homes'}</p></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-4 pt-3 text-sm">
                    <span className="text-muted">{cur.fromRent != null ? <>From <b className="text-[var(--text)]">{money(cur.fromRent)}</b>/mo</> : 'Homes arriving soon'}</span>
                    <span className="text-muted font-mono text-xs tabular-nums">{fmtCoord(cur.lat, cur.lng)}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 py-3 md:max-h-60 md:flex-col md:overflow-x-hidden md:overflow-y-auto" role="tablist" aria-label="Cities" ref={listRef}>
              {stops.map((s, i) => (
                <button key={s.name} role="tab" aria-selected={i === active} onClick={() => pick(i)}
                  className={`group relative flex shrink-0 cursor-pointer items-center gap-2.5 rounded-2xl px-3 py-2 text-left text-sm transition md:shrink ${i === active ? 'bg-brand-500 text-white shadow-soft' : 'hover:bg-brand-500/10'}`}>
                  <span className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${i === active ? 'bg-white/20' : 'bg-brand-500/10 text-brand-500'}`}>{i + 1}</span>
                  <span className="font-semibold">{s.name}</span>
                  <span className={`ml-auto flex items-center gap-1 text-xs ${i === active ? 'text-white/85' : 'text-muted'}`}><Home className="size-3" />{s.homes}</span>
                </button>
              ))}
            </div>

            <div className="border-t border-base flex items-center gap-2 p-3">
              <Link to={`/units?city=${encodeURIComponent(cur?.name ?? '')}`} className="flex-1">
                <span className="gradient-brand flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-soft transition hover:brightness-110">
                  Browse homes in {cur?.name}<ArrowRight className="size-4" /></span>
              </Link>
              <button onClick={locate} disabled={geo.state === 'busy'} aria-label="Find my location"
                className="surface-2 hover:text-brand-500 flex size-11 cursor-pointer items-center justify-center rounded-xl transition disabled:opacity-60">
                {geo.state === 'busy' ? <Navigation className="size-5 animate-pulse" /> : <LocateFixed className="size-5" />}
              </button>
            </div>
            <AnimatePresence>
              {geo.text && (
                <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className={`overflow-hidden px-4 pb-3 text-xs font-semibold ${geo.state === 'error' ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {geo.text}{geo.state === 'ok' && geo.nearest != null && geo.nearest !== active && <button onClick={() => pick(geo.nearest!)} className="text-brand-500 ml-2 cursor-pointer underline">Go there</button>}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* scroll cue */}
        {!reduce && active === 0 && <div className="text-muted pointer-events-none absolute bottom-6 left-1/2 z-[600] hidden -translate-x-1/2 text-xs font-semibold tracking-widest uppercase md:block">Keep scrolling ↓</div>}
      </div>
    </section>
  )
}
