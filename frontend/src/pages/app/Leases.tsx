import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { CalendarClock, Check, FileSignature, X } from 'lucide-react'
import { api } from '../../lib/api'
import type { LeaseItem, Paged, Renewal } from '../../lib/types'
import { useAuth, useToast } from '../../lib/providers'
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, PageHeader, Pagination, SearchBox, StatusBadge, Table, TableSkeleton, Tabs, Td, Th, Tr } from '../../components/ui'
import { date, money } from '../../lib/format'
import { useNavigate } from 'react-router-dom'

export default function Leases() {
  const { isOperator } = useAuth()
  const nav = useNavigate()
  const toast = useToast(); const qc = useQueryClient()
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const q = useQuery({ queryKey: ['leases', status, search, page], placeholderData: keepPreviousData, queryFn: () => api.get<Paged<LeaseItem>>('/leases', { Status: status, Search: search, Page: page, PageSize: 10 }) })
  const renewals = useQuery({ queryKey: ['renewals', 'pending'], enabled: isOperator, queryFn: () => api.get<Paged<Renewal>>('/leases/renewals', { status: 'pending', pageSize: 5 }) })
  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: number; approve: boolean }) => api.post(`/leases/renewals/${id}/decision`, { approve }),
    onSuccess: () => { toast.success('Renewal decision saved'); qc.invalidateQueries({ queryKey: ['renewals'] }); qc.invalidateQueries({ queryKey: ['leases'] }) }, onError: (e: Error) => toast.error(e.message),
  })

  return (<>
    <PageHeader title="Leases" subtitle={isOperator ? 'Agreements, renewals and expiry tracking' : 'Your rental agreements'} />
    {isOperator && renewals.data && renewals.data.items.length > 0 && (
      <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
        <CardHeader title={`Renewal requests (${renewals.data.total})`} subtitle="Tenants asking to extend their stay" />
        <ul className="divide-y divide-[var(--border)]">{renewals.data.items.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
            <div className="min-w-0 flex-1"><p className="font-semibold">{r.tenantName} · {r.propertyName} {r.unitNumber}</p>
              <p className="text-muted text-sm">Extend to {date(r.requestedEndDate)}{r.proposedRent ? ` at ${money(r.proposedRent)}/mo` : ''}{r.note ? ` — “${r.note}”` : ''}</p></div>
            <Button size="sm" variant="soft" icon={<Check className="size-4" />} loading={decide.isPending} onClick={() => decide.mutate({ id: r.id, approve: true })}>Approve</Button>
            <Button size="sm" variant="danger" icon={<X className="size-4" />} onClick={() => decide.mutate({ id: r.id, approve: false })}>Decline</Button>
          </li>))}</ul>
      </Card>)}

    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1) }} tabs={[{ value: '', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'expiring', label: 'Expiring soon' }, { value: 'upcoming', label: 'Upcoming' }, { value: 'expired', label: 'Expired' }, { value: 'terminated', label: 'Terminated' }]} />
      {isOperator && <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search tenant or unit…" />}
    </div>
    <Card className="overflow-hidden">
      {q.isLoading ? <TableSkeleton /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : q.data!.items.length === 0
        ? <EmptyState icon={<FileSignature className="size-7" />} title="No leases found" text={isOperator ? 'Approve an application to create a lease.' : 'Your lease will appear here once an application is approved.'} />
        : (<Table><thead><tr><Th>Home</Th>{isOperator && <Th>Tenant</Th>}<Th>Period</Th><Th>Rent</Th><Th>Outstanding</Th><Th>Status</Th></tr></thead>
          <tbody>{q.data!.items.map((l) => (
            <Tr key={l.id} onClick={() => nav(`/app/leases/${l.id}`)}>
              <Td><Link to={`/app/leases/${l.id}`} className="font-bold hover:text-brand-500">{l.propertyName}</Link><span className="text-muted block text-xs">Unit {l.unitNumber}</span></Td>
              {isOperator && <Td>{l.tenantName}</Td>}
              <Td>{date(l.startDate)} → {date(l.endDate)}{l.status === 'active' && l.daysToExpiry <= 45 && <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-amber-500"><CalendarClock className="size-3.5" />{l.daysToExpiry} days left</span>}</Td>
              <Td>{money(l.monthlyRent)}</Td>
              <Td className={l.outstanding > 0 ? 'font-semibold text-rose-500' : 'text-muted'}>{money(l.outstanding)}</Td>
              <Td><div className="flex flex-wrap gap-1.5"><StatusBadge status={l.status} />{l.renewalPending && <Badge color="amber">Renewal asked</Badge>}</div></Td>
            </Tr>))}</tbody></Table>)}
      {q.data && <Pagination page={q.data.page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} />}
    </Card>
  </>)
}
