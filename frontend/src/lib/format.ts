const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const inrFull = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = new Intl.NumberFormat('en-IN')

export const money = (v: number | null | undefined) => (v == null ? '-' : inr.format(v))
export const moneyExact = (v: number | null | undefined) => (v == null ? '-' : inrFull.format(v))
/** 1,25,000 -> "1.25L" style compact INR, used in charts and tiles. */
export const moneyCompact = (v: number) => {
  const a = Math.abs(v), s = v < 0 ? '-' : ''
  if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(2).replace(/\.?0+$/, '')}Cr`
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(2).replace(/\.?0+$/, '')}L`
  if (a >= 1e3) return `${s}₹${(a / 1e3).toFixed(1).replace(/\.0$/, '')}K`
  return `${s}₹${a}`
}
export const number = (v: number) => num.format(v)

const d = (s: string) => new Date(s.length <= 10 ? `${s}T00:00:00` : s)
export const date = (s: string | null | undefined) =>
  s ? d(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
export const dateTime = (s: string | null | undefined) =>
  s ? d(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'
export const monthLabel = (s: string) =>
  new Date(`${s.slice(0, 7)}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
export const monthLong = (s: string) =>
  new Date(`${s.slice(0, 7)}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

export function timeAgo(s: string) {
  const diff = (Date.now() - new Date(s).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  return date(s)
}

export const label = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')
export const toISODate = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
export const addMonthsISO = (iso: string, months: number) => { const x = d(iso); x.setMonth(x.getMonth() + months); x.setDate(x.getDate() - 1); return toISODate(x) }
