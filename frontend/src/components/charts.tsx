import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { MonthPoint, NamedValue, OccupancyPoint } from '../lib/types'
import { label, moneyCompact, money, monthLabel } from '../lib/format'

export const CHART_COLORS = ['#2c6144', '#b8893b', '#35566b', '#a0523d', '#6b8a5a', '#7a6a3a', '#5a9672']
const axis = { fontSize: 12, fill: 'var(--muted)' }

function Tip({ active, payload, label: l, money: asMoney = true }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; money?: boolean }) {
  if (!active || !payload?.length) return null
  return (
    <div className="surface rounded-xl px-3.5 py-2.5 text-xs shadow-lift">
      {l && <p className="mb-1.5 font-bold">{l}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2"><i className="size-2 rounded-full" style={{ background: p.color }} /><span className="text-muted">{p.name}</span><b className="ml-auto pl-4">{asMoney ? money(p.value) : p.value}</b></p>
      ))}
    </div>
  )
}

export function RentChart({ data, paidLabel = 'Collected' }: { data: MonthPoint[]; paidLabel?: string }) {
  const rows = data.map((d) => ({ ...d, name: monthLabel(d.month), Billed: d.billed, [paidLabel]: d.collected }))
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows} barGap={4} margin={{ left: -8, right: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={moneyCompact} width={64} />
        <Tooltip content={<Tip />} cursor={{ fill: 'var(--surface-2)' }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Billed" fill="#c7d2fe" radius={[6, 6, 0, 0]} maxBarSize={28} />
        <Bar dataKey={paidLabel} fill="#2c6144" radius={[6, 6, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function Donut({ data, money: asMoney = true, height = 240 }: { data: NamedValue[]; money?: boolean; height?: number }) {
  const rows = data.map((d) => ({ name: label(d.name), value: d.value }))
  const total = rows.reduce((s, r) => s + r.value, 0)
  if (!total) return <p className="text-muted flex items-center justify-center text-sm" style={{ height }}>No data yet</p>
  return (
    <div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={3} stroke="none" cornerRadius={6}>
              {rows.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip content={<Tip money={asMoney} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="font-display text-xl font-extrabold">{asMoney ? moneyCompact(total) : total}</p><p className="text-muted text-xs">Total</p>
        </div>
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {rows.map((r, i) => <li key={r.name} className="flex items-center gap-2"><i className="size-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} /><span className="text-muted truncate">{r.name}</span></li>)}
      </ul>
    </div>
  )
}

export function OccupancyBars({ data }: { data: OccupancyPoint[] }) {
  if (!data.length) return <p className="text-muted py-10 text-center text-sm">No properties yet</p>
  return (
    <ul className="space-y-5">
      {data.map((o) => (
        <li key={o.propertyId}>
          <div className="mb-1.5 flex items-center justify-between text-sm"><span className="font-semibold">{o.property}</span><span className="text-muted">{o.occupiedUnits}/{o.totalUnits} units · <b className="text-[var(--text)]">{o.occupancyPct}%</b></span></div>
          <div className="surface-2 h-2.5 overflow-hidden rounded-full"><div className="gradient-brand h-full rounded-full transition-all duration-1000" style={{ width: `${o.occupancyPct}%` }} /></div>
        </li>
      ))}
    </ul>
  )
}
