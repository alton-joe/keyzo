import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Banknote, Building2, ClipboardList, FileClock, Percent, Wrench, CalendarClock, ReceiptIndianRupee, ShieldCheck, Users, UserCheck, ScrollText, CheckCircle2, Clock, Hammer, Siren, TrendingDown } from 'lucide-react'
import { api } from '../../lib/api'
import type { Dashboard as Dash } from '../../lib/types'
import { useAuth } from '../../lib/providers'
import { Button, Card, CardHeader, ErrorState, PageHeader, Skeleton, StatCard, StatusBadge } from '../../components/ui'
import { Donut, OccupancyBars, RentChart } from '../../components/charts'
import { CountUp, Stagger, StaggerItem } from '../../components/motion'
import { date, money } from '../../lib/format'

const Money = ({ v }: { v: number }) => <CountUp to={v} prefix="₹" />

function Operator({ d }: { d: Dash }) {
  const o = d.operator!
  return (<>
    <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StaggerItem><StatCard label="Collected this month" tone="green" icon={<Banknote />} value={<Money v={o.collectedThisMonth} />} hint={`of ${money(o.billedThisMonth)} billed`} /></StaggerItem>
      <StaggerItem><StatCard label="Outstanding rent" tone="red" icon={<AlertTriangle />} value={<Money v={o.outstanding} />} hint={`${o.overdueInvoices} overdue invoices`} /></StaggerItem>
      <StaggerItem><StatCard label="Occupancy" icon={<Percent />} value={<CountUp to={o.occupancyPct} suffix="%" decimals={1} />} hint={`${o.occupiedUnits} of ${o.units} units`} /></StaggerItem>
      <StaggerItem><StatCard label="Active leases" tone="sky" icon={<CalendarClock />} value={<CountUp to={o.activeLeases} />} hint={`${o.expiringLeases} expiring in 45 days`} /></StaggerItem>
      <StaggerItem><StatCard label="Properties" icon={<Building2 />} value={<CountUp to={o.properties} />} hint={`${o.units} rentable units`} /></StaggerItem>
      <StaggerItem><StatCard label="Pending applications" tone="amber" icon={<ClipboardList />} value={<CountUp to={o.pendingApplications} />} hint="Awaiting a decision" /></StaggerItem>
      <StaggerItem><StatCard label="Open maintenance" tone="amber" icon={<Wrench />} value={<CountUp to={o.openMaintenance} />} hint={o.urgentMaintenance ? `${o.urgentMaintenance} urgent` : 'None urgent'} /></StaggerItem>
      <StaggerItem><StatCard label="Expenses this month" tone="red" icon={<TrendingDown />} value={<Money v={o.expensesThisMonth} />} hint="Maintenance & upkeep" /></StaggerItem>
    </Stagger>

    <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
      <Card><CardHeader title="Rent billed vs collected" subtitle="Last 6 billing months" /><div className="p-5"><RentChart data={d.rentByMonth} /></div></Card>
      <Card><CardHeader title="Expenses by category" subtitle="Last 6 months" /><div className="p-5"><Donut data={d.expensesByCategory} /></div></Card>
    </div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <Card><CardHeader title="Occupancy by property" action={<Link to="/app/reports"><Button variant="ghost" size="sm">Reports</Button></Link>} /><div className="p-5"><OccupancyBars data={d.occupancy} /></div></Card>
      <Card><CardHeader title="Maintenance pipeline" subtitle="All requests by status" /><div className="p-5"><Donut data={d.maintenanceByStatus} money={false} /></div></Card>
    </div>
  </>)
}

function Admin({ d }: { d: Dash }) {
  const a = d.admin!
  return (<>
    <div className="gradient-brand relative mb-6 overflow-hidden rounded-2xl p-6 text-white shadow-lift">
      <div className="absolute -top-16 -right-16 size-56 rounded-full bg-white/10 blur-2xl" />
      <p className="relative flex items-center gap-2 text-sm font-semibold text-white/80"><ShieldCheck className="size-4" />Administrator · full access</p>
      <p className="relative mt-1 text-2xl font-extrabold">Everything across every owner, property and tenant</p>
    </div>
    <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StaggerItem><StatCard label="Total users" icon={<Users />} value={<CountUp to={a.totalUsers} />} hint={`${a.newUsersThisMonth} joined this month`} /></StaggerItem>
      <StaggerItem><StatCard label="Active accounts" tone="green" icon={<UserCheck />} value={<CountUp to={a.activeUsers} />} hint={`${a.inactiveUsers} deactivated`} /></StaggerItem>
      <StaggerItem><StatCard label="Administrators" tone="sky" icon={<ShieldCheck />} value={<CountUp to={a.administrators} />} hint="Fixed list of 3 approved emails" /></StaggerItem>
      <StaggerItem><StatCard label="Audit events today" tone="amber" icon={<ScrollText />} value={<CountUp to={a.auditEventsToday} />} hint={<Link to="/app/audit" className="text-brand-500">Open audit log</Link>} /></StaggerItem>
    </Stagger>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <Card><CardHeader title="Users by role" action={<Link to="/app/users"><Button variant="ghost" size="sm">Manage users</Button></Link>} /><div className="p-5"><Donut data={a.usersByRole} money={false} /></div></Card>
      <Card><CardHeader title="Recent activity" subtitle="Latest actions across the system" action={<Link to="/app/audit"><Button variant="ghost" size="sm">All</Button></Link>} />
        <ul className="divide-y divide-[var(--border)]">
          {a.recentActivity.length === 0 && <li className="text-muted p-5 text-sm">Nothing yet.</li>}
          {a.recentActivity.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <span><b>{e.userName ?? 'System'}</b> <span className="text-muted">{e.action.replace(/_/g, ' ')} · {e.entity.replace(/_/g, ' ')}{e.entityId ? ` #${e.entityId}` : ''}</span></span>
              <span className="text-muted shrink-0 text-xs">{date(e.createdAt)}</span>
            </li>))}
        </ul>
      </Card>
    </div>
    <h2 className="font-display mt-10 mb-4 text-lg font-extrabold">Portfolio &amp; money (all owners)</h2>
    <Operator d={d} />
  </>)
}

function Tenant({ d }: { d: Dash }) {
  const t = d.tenant!
  const inv = t.nextInvoice
  return (<>
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      {/* plain div, not <Card>: Card's opaque surface background would hide the gradient (white text on white) */}
      <div className="gradient-brand relative overflow-hidden rounded-2xl p-7 text-white shadow-lift">
        <div className="absolute -top-16 -right-16 size-56 rounded-full bg-white/10 blur-2xl" />
        {t.activeLease ? (<div className="relative">
          <p className="text-sm font-semibold text-white/75">Your home</p>
          <h2 className="mt-1 text-3xl font-extrabold">{t.activeLease.propertyName}</h2>
          <p className="text-white/80">Unit {t.activeLease.unitNumber}</p>
          <div className="mt-6 flex flex-wrap gap-8">
            <div><p className="text-xs text-white/70 uppercase">Monthly rent</p><p className="font-display text-2xl font-extrabold">{money(t.activeLease.monthlyRent)}</p></div>
            <div><p className="text-xs text-white/70 uppercase">Lease ends</p><p className="font-display text-2xl font-extrabold">{date(t.activeLease.endDate)}</p></div>
            <div><p className="text-xs text-white/70 uppercase">Days left</p><p className="font-display text-2xl font-extrabold">{t.activeLease.daysToExpiry}</p></div>
          </div>
          <Link to={`/app/leases/${t.activeLease.leaseId}`}><Button variant="secondary" className="mt-6 text-[var(--text)]">View lease</Button></Link>
        </div>) : (<div className="relative"><h2 className="text-2xl font-extrabold">No active lease yet</h2><p className="mt-2 text-white/80">Find a home and apply - we will notify you as soon as it is approved.</p>
          <Link to="/units"><Button variant="secondary" className="mt-5 text-[var(--text)]">Browse homes</Button></Link></div>)}
      </div>
      <Card className="p-6">
        <p className="text-muted text-xs font-semibold tracking-wide uppercase">Next rent due</p>
        {inv ? (<>
          <p className="font-display mt-2 text-4xl font-extrabold">{money(inv.balance)}</p>
          <p className="text-muted mt-1 text-sm">{inv.invoiceNumber} · due {date(inv.dueDate)}</p>
          <div className="mt-3"><StatusBadge status={inv.status} /></div>
          <Link to={`/app/invoices?invoice=${inv.id}`}><Button className="mt-5 w-full" icon={<ReceiptIndianRupee className="size-4" />}>Pay now</Button></Link>
        </>) : <p className="mt-3 flex items-center gap-2 font-semibold text-emerald-500"><CheckCircle2 />You are all paid up</p>}
      </Card>
    </div>
    <Stagger className="mt-6 grid gap-4 sm:grid-cols-3">
      <StaggerItem><StatCard label="Outstanding" tone={t.outstanding > 0 ? 'red' : 'green'} icon={<AlertTriangle />} value={money(t.outstanding)} /></StaggerItem>
      <StaggerItem><StatCard label="Open requests" tone="amber" icon={<Wrench />} value={t.openRequests} hint={<Link to="/app/maintenance" className="text-brand-500">View requests</Link>} /></StaggerItem>
      <StaggerItem><StatCard label="Pending applications" icon={<FileClock />} value={t.pendingApplications} hint={<Link to="/app/applications" className="text-brand-500">View applications</Link>} /></StaggerItem>
    </Stagger>
    <Card className="mt-6"><CardHeader title="Your rent history" subtitle="Billed vs paid, last 6 months" /><div className="p-5"><RentChart data={d.rentByMonth} paidLabel="Paid" /></div></Card>
  </>)
}

function Staff({ d }: { d: Dash }) {
  const s = d.staff!
  return (<>
    <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StaggerItem><StatCard label="Newly assigned" tone="sky" icon={<Hammer />} value={s.assigned} /></StaggerItem>
      <StaggerItem><StatCard label="In progress" tone="amber" icon={<Clock />} value={s.inProgress} /></StaggerItem>
      <StaggerItem><StatCard label="Urgent" tone="red" icon={<Siren />} value={s.urgent} /></StaggerItem>
      <StaggerItem><StatCard label="Done this month" tone="green" icon={<CheckCircle2 />} value={s.completedThisMonth} /></StaggerItem>
    </Stagger>
    <Card className="mt-6"><CardHeader title="Your jobs by status" action={<Link to="/app/maintenance"><Button size="sm">Open my jobs</Button></Link>} /><div className="p-5"><Donut data={d.maintenanceByStatus} money={false} /></div></Card>
  </>)
}

export default function Dashboard() {
  const { user } = useAuth()
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<Dash>('/reports/dashboard') })
  const sub = q.data?.view === 'admin' ? 'Administrator overview of the whole platform' : q.data?.view === 'operator' ? 'Your portfolio at a glance' : q.data?.view === 'tenant' ? 'Your home, rent and requests' : 'Your maintenance workload'
  return (<>
    <PageHeader title={`Hello, ${user?.fullName.split(' ')[0]} 👋`} subtitle={q.data ? sub : undefined} />
    {q.isLoading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} />
      : q.data!.view === 'admin' ? <Admin d={q.data!} /> : q.data!.view === 'operator' ? <Operator d={q.data!} /> : q.data!.view === 'tenant' ? <Tenant d={q.data!} /> : <Staff d={q.data!} />}
  </>)
}
