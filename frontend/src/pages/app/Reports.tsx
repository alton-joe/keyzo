import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Download } from 'lucide-react'
import { api } from '../../lib/api'
import type { ExpenseReport, IncomeReport, OccupancyPoint, OutstandingRow, Paged, PropertyListItem } from '../../lib/types'
import { Button, Card, CardHeader, EmptyState, ErrorState, PageHeader, Select, Skeleton, StatCard, Table, Td, Th, Tr, Tabs } from '../../components/ui'
import { Donut, OccupancyBars } from '../../components/charts'
import { date, money, moneyCompact, monthLabel } from '../../lib/format'
import { Banknote, Scale, TrendingDown, TriangleAlert } from 'lucide-react'

const axis = { fontSize: 12, fill: 'var(--muted)' }

function csv(name: string, rows: (string | number)[][]) {
  const text = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); a.download = `${name}.csv`; a.click()
}

export default function Reports() {
  const [tab, setTab] = useState<'income' | 'occupancy' | 'outstanding' | 'expenses'>('income')
  const [propertyId, setPropertyId] = useState('')
  const props = useQuery({ queryKey: ['properties', 'all'], queryFn: () => api.get<Paged<PropertyListItem>>('/properties', { PageSize: 100 }) })
  const income = useQuery({ queryKey: ['rep-income', propertyId], enabled: tab === 'income', queryFn: () => api.get<IncomeReport>('/reports/income', { propertyId }) })
  const occ = useQuery({ queryKey: ['rep-occ'], enabled: tab === 'occupancy', queryFn: () => api.get<OccupancyPoint[]>('/reports/occupancy') })
  const out = useQuery({ queryKey: ['rep-out', propertyId], enabled: tab === 'outstanding', queryFn: () => api.get<OutstandingRow[]>('/reports/outstanding', { propertyId }) })
  const exp = useQuery({ queryKey: ['rep-exp', propertyId], enabled: tab === 'expenses', queryFn: () => api.get<ExpenseReport>('/reports/expenses', { propertyId }) })

  return (<>
    <PageHeader title="Reports" subtitle="Income, occupancy, overdue rent and expenses"
      actions={<Select className="w-56" value={propertyId} onChange={(e) => setPropertyId(e.target.value)} aria-label="Property" disabled={tab === 'occupancy'}><option value="">All properties</option>{props.data?.items.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>} />
    <div className="mb-6"><Tabs value={tab} onChange={setTab} tabs={[{ value: 'income', label: 'Income' }, { value: 'occupancy', label: 'Occupancy' }, { value: 'outstanding', label: 'Overdue rent' }, { value: 'expenses', label: 'Expenses' }]} /></div>

    {tab === 'income' && (income.isLoading ? <Skeleton className="h-96" /> : income.isError ? <ErrorState error={income.error} retry={() => income.refetch()} /> : (() => {
      const r = income.data!
      const rows = r.months.map((m) => ({ name: monthLabel(m.month), Collected: m.collected, Expenses: m.expenses, Net: m.net }))
      return (<>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Billed" icon={<Scale />} value={money(r.totals.billed)} />
          <StatCard label="Collected" tone="green" icon={<Banknote />} value={money(r.totals.collected)} />
          <StatCard label="Expenses" tone="red" icon={<TrendingDown />} value={money(r.totals.expenses)} />
          <StatCard label="Net income" tone="sky" icon={<Banknote />} value={money(r.totals.net)} hint={`${money(r.totals.outstanding)} still outstanding`} /></div>
        <Card className="mt-6"><CardHeader title="Collected, expenses and net" subtitle="Last 6 months" action={<Button variant="secondary" size="sm" icon={<Download className="size-4" />} onClick={() => csv('income-report', [['Month', 'Billed', 'Collected', 'Outstanding', 'Expenses', 'Net'], ...r.months.map((m) => [m.month, m.billed, m.collected, m.outstanding, m.expenses, m.net])])}>CSV</Button>} />
          <div className="p-5"><ResponsiveContainer width="100%" height={300}><ComposedChart data={rows} margin={{ left: -8 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} /><YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={moneyCompact} width={64} />
            <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Collected" fill="#2c6144" radius={[6, 6, 0, 0]} maxBarSize={30} /><Bar dataKey="Expenses" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={30} /><Line dataKey="Net" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} /></ComposedChart></ResponsiveContainer></div></Card>
        <Card className="mt-6 overflow-hidden"><CardHeader title="By property" />
          <Table><thead><tr><Th>Property</Th><Th>Billed</Th><Th>Collected</Th><Th>Outstanding</Th><Th>Expenses</Th><Th>Net</Th></tr></thead>
            <tbody>{r.properties.map((p) => (<Tr key={p.propertyId}><Td className="font-semibold">{p.property}</Td><Td>{money(p.billed)}</Td><Td>{money(p.collected)}</Td><Td className={p.outstanding > 0 ? 'text-rose-500' : ''}>{money(p.outstanding)}</Td><Td>{money(p.expenses)}</Td><Td className="font-bold">{money(p.net)}</Td></Tr>))}
              {r.properties.length === 0 && <Tr><Td colSpan={6} className="text-muted text-center">No billing data</Td></Tr>}</tbody></Table></Card></>)
    })())}

    {tab === 'occupancy' && (occ.isLoading ? <Skeleton className="h-72" /> : occ.isError ? <ErrorState error={occ.error} retry={() => occ.refetch()} /> : (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="Occupancy by property" /><div className="p-5"><OccupancyBars data={occ.data!} /></div></Card>
        <Card><CardHeader title="Units occupied" /><div className="p-5"><ResponsiveContainer width="100%" height={Math.max(220, occ.data!.length * 60)}><BarChart data={occ.data!.map((o) => ({ name: o.property, Occupied: o.occupiedUnits, Vacant: o.totalUnits - o.occupiedUnits }))} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" /><XAxis type="number" tick={axis} axisLine={false} tickLine={false} allowDecimals={false} /><YAxis dataKey="name" type="category" tick={axis} axisLine={false} tickLine={false} width={120} />
          <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Occupied" stackId="a" fill="#2c6144" /><Bar dataKey="Vacant" stackId="a" fill="#b5d3bf" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div></Card></div>))}

    {tab === 'outstanding' && (out.isLoading ? <Skeleton className="h-72" /> : out.isError ? <ErrorState error={out.error} retry={() => out.refetch()} /> : (
      <Card className="overflow-hidden"><CardHeader title="Overdue rent" subtitle={`${out.data!.length} invoices · ${money(out.data!.reduce((s, r) => s + r.balance, 0))} outstanding`} action={<Button variant="secondary" size="sm" icon={<Download className="size-4" />} onClick={() => csv('overdue-rent', [['Invoice', 'Tenant', 'Property', 'Unit', 'Due', 'Days overdue', 'Balance'], ...out.data!.map((r) => [r.invoiceNumber, r.tenant, r.property, r.unit, r.dueDate, r.daysOverdue, r.balance])])}>CSV</Button>} />
        {out.data!.length === 0 ? <EmptyState icon={<TriangleAlert className="size-7" />} title="Nothing overdue" text="Every invoice is up to date." /> : (
          <Table><thead><tr><Th>Invoice</Th><Th>Tenant</Th><Th>Home</Th><Th>Due</Th><Th>Days overdue</Th><Th>Balance</Th></tr></thead>
            <tbody>{out.data!.map((r) => (<Tr key={r.invoiceId}><Td className="font-semibold"><Link to={`/app/invoices?invoice=${r.invoiceId}`} className="hover:text-brand-500">{r.invoiceNumber}</Link></Td><Td>{r.tenant}</Td><Td>{r.property} · {r.unit}</Td><Td>{date(r.dueDate)}</Td><Td className="font-semibold text-rose-500">{r.daysOverdue}</Td><Td className="font-bold">{money(r.balance)}</Td></Tr>))}</tbody></Table>)}</Card>))}

    {tab === 'expenses' && (exp.isLoading ? <Skeleton className="h-72" /> : exp.isError ? <ErrorState error={exp.error} retry={() => exp.refetch()} /> : (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="By category" subtitle={`Total ${money(exp.data!.total)}`} /><div className="p-5"><Donut data={exp.data!.byCategory} /></div></Card>
        <Card><CardHeader title="By property" /><div className="p-5"><Donut data={exp.data!.byProperty} /></div></Card></div>))}
  </>)
}
