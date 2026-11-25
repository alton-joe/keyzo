import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Check, ClipboardList, FileSignature, X } from 'lucide-react'
import { api } from '../../lib/api'
import type { Application, Paged } from '../../lib/types'
import { useAuth, useToast } from '../../lib/providers'
import { Avatar, Button, Card, Confirm, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Pagination, StatusBadge, TableSkeleton, Tabs, Textarea, KeyValue } from '../../components/ui'
import { addMonthsISO, date, money } from '../../lib/format'

function LeaseModal({ app, onClose }: { app: Application | null; onClose: () => void }) {
  const toast = useToast(); const qc = useQueryClient()
  const [f, setF] = useState({ startDate: '', endDate: '', monthlyRent: 0, securityDeposit: 0, rentDueDay: 5, lateFee: 500, terms: '' })
  const [seed, setSeed] = useState<number | null>(null)
  if (app && seed !== app.id) {
    setSeed(app.id)
    setF({ startDate: app.desiredMoveIn, endDate: addMonthsISO(app.desiredMoveIn, app.leaseMonths), monthlyRent: app.monthlyRent, securityDeposit: app.monthlyRent * 2, rentDueDay: 5, lateFee: 500, terms: `${app.leaseMonths}-month lease. Rent is due by the ${5}th of every month. A flat late fee applies after the due date.` })
  }
  const create = useMutation({
    mutationFn: () => api.post<{ lease: { id: number } }>('/leases', { applicationId: app!.id, ...f }),
    onSuccess: (r) => { toast.success('Lease created'); qc.invalidateQueries(); onClose(); window.location.assign(`/app/leases/${r.lease.id}`) },
    onError: (e: Error) => toast.error(e.message),
  })
  const n = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: Number(e.target.value) })
  return (
    <Modal open={!!app} onClose={onClose} wide title={`Create lease - ${app?.tenantName}`} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={create.isPending} icon={<FileSignature className="size-4" />} onClick={() => create.mutate()}>Create lease</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start date"><Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
        <Field label="End date"><Input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></Field>
        <Field label="Monthly rent (₹)"><Input type="number" min={1} value={f.monthlyRent} onChange={n('monthlyRent')} /></Field>
        <Field label="Security deposit (₹)"><Input type="number" min={0} value={f.securityDeposit} onChange={n('securityDeposit')} /></Field>
        <Field label="Rent due day" hint="Day of month (1–28)"><Input type="number" min={1} max={28} value={f.rentDueDay} onChange={n('rentDueDay')} /></Field>
        <Field label="Flat late fee (₹)" hint="Charged once when rent is overdue"><Input type="number" min={0} value={f.lateFee} onChange={n('lateFee')} /></Field>
        <Field label="Terms" className="sm:col-span-2"><Textarea value={f.terms} onChange={(e) => setF({ ...f, terms: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}

export default function Applications() {
  const { isOperator, hasRole } = useAuth()
  const toast = useToast(); const qc = useQueryClient()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [decide, setDecide] = useState<{ app: Application; approve: boolean } | null>(null)
  const [note, setNote] = useState('')
  const [leaseFor, setLeaseFor] = useState<Application | null>(null)
  const [view, setView] = useState<Application | null>(null)
  const [withdraw, setWithdraw] = useState<Application | null>(null)

  const q = useQuery({ queryKey: ['applications', status, page], placeholderData: keepPreviousData, queryFn: () => api.get<Paged<Application>>('/applications', { Status: status, Page: page, PageSize: 10 }) })
  const decideM = useMutation({
    mutationFn: () => api.post(`/applications/${decide!.app.id}/decision`, { approve: decide!.approve, note }),
    onSuccess: () => { toast.success(decide!.approve ? 'Application approved' : 'Application rejected'); setDecide(null); setNote(''); qc.invalidateQueries({ queryKey: ['applications'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
    onError: (e: Error) => toast.error(e.message),
  })
  const withdrawM = useMutation({ mutationFn: () => api.post(`/applications/${withdraw!.id}/withdraw`), onSuccess: () => { toast.success('Application withdrawn'); setWithdraw(null); qc.invalidateQueries({ queryKey: ['applications'] }) }, onError: (e: Error) => toast.error(e.message) })

  return (<>
    <PageHeader title="Rental applications" subtitle={isOperator ? 'Review applicants and turn approved applications into leases' : 'Track the homes you have applied for'}
      actions={hasRole('Tenant') && <Link to="/units"><Button>Browse homes</Button></Link>} />
    <div className="mb-5"><Tabs value={status} onChange={(v) => { setStatus(v); setPage(1) }} tabs={[{ value: '', label: 'All' }, { value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }, { value: 'withdrawn', label: 'Withdrawn' }]} /></div>
    <Card className="overflow-hidden">
      {q.isLoading ? <TableSkeleton /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : q.data!.items.length === 0
        ? <EmptyState icon={<ClipboardList className="size-7" />} title="No applications" text={isOperator ? 'New applications from tenants will appear here.' : 'Browse available homes and apply in minutes.'} />
        : (<ul className="divide-y divide-[var(--border)]">
          {q.data!.items.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-4 px-5 py-4 transition hover:bg-[var(--surface-2)]/60">
              <Avatar name={isOperator ? a.tenantName : a.propertyName} />
              <button onClick={() => setView(a)} className="min-w-0 flex-1 cursor-pointer text-left">
                <p className="truncate font-bold">{isOperator ? a.tenantName : a.propertyName} <span className="text-muted font-medium">→ {isOperator ? `${a.propertyName} · ${a.unitNumber}` : `Unit ${a.unitNumber}`}</span></p>
                <p className="text-muted text-sm">Move-in {date(a.desiredMoveIn)} · {a.leaseMonths} months · {money(a.monthlyRent)}/mo · {a.verifiedDocuments}/{a.documentCount} documents verified</p>
              </button>
              <StatusBadge status={a.status} />
              <div className="flex gap-2">
                {isOperator && a.status === 'pending' && (<>
                  <Button size="sm" variant="soft" icon={<Check className="size-4" />} onClick={() => { setNote(''); setDecide({ app: a, approve: true }) }}>Approve</Button>
                  <Button size="sm" variant="danger" icon={<X className="size-4" />} onClick={() => { setNote(''); setDecide({ app: a, approve: false }) }}>Reject</Button></>)}
                {isOperator && a.status === 'approved' && !a.leaseId && <Button size="sm" icon={<FileSignature className="size-4" />} onClick={() => setLeaseFor(a)}>Create lease</Button>}
                {a.leaseId && <Link to={`/app/leases/${a.leaseId}`}><Button size="sm" variant="secondary">View lease</Button></Link>}
                {hasRole('Tenant') && a.status === 'pending' && <Button size="sm" variant="ghost" onClick={() => setWithdraw(a)}>Withdraw</Button>}
              </div>
            </li>))}
        </ul>)}
      {q.data && <Pagination page={q.data.page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} />}
    </Card>

    <Modal open={!!decide} onClose={() => setDecide(null)} title={decide?.approve ? 'Approve application' : 'Reject application'}
      footer={<><Button variant="secondary" onClick={() => setDecide(null)}>Cancel</Button><Button variant={decide?.approve ? 'primary' : 'danger'} loading={decideM.isPending} onClick={() => decideM.mutate()}>{decide?.approve ? 'Approve' : 'Reject'}</Button></>}>
      <p className="text-muted mb-4 text-sm">{decide?.approve ? 'Approving will automatically decline other pending applicants for this unit.' : 'The applicant will be notified.'}</p>
      <Field label="Note to applicant (optional)"><Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
    </Modal>
    <LeaseModal app={leaseFor} onClose={() => setLeaseFor(null)} />
    <Confirm open={!!withdraw} onClose={() => setWithdraw(null)} title="Withdraw application?" text="You can apply again later if the unit is still available." confirmLabel="Withdraw" danger loading={withdrawM.isPending} onConfirm={() => withdrawM.mutate()} />
    <Modal open={!!view} onClose={() => setView(null)} title="Application details" wide>
      {view && <KeyValue items={[
        { k: 'Applicant', v: view.tenantName }, { k: 'Contact', v: `${view.tenantEmail}${view.tenantPhone ? ' · ' + view.tenantPhone : ''}` },
        { k: 'Monthly income', v: view.tenantIncome ? money(view.tenantIncome) : 'Not provided' }, { k: 'Occupants', v: view.occupants },
        { k: 'Property', v: `${view.propertyName} · Unit ${view.unitNumber}` }, { k: 'Rent', v: money(view.monthlyRent) },
        { k: 'Desired move-in', v: date(view.desiredMoveIn) }, { k: 'Lease length', v: `${view.leaseMonths} months` },
        { k: 'Submitted', v: date(view.createdAt) }, { k: 'Status', v: <StatusBadge status={view.status} /> },
        { k: 'Message', v: view.message || '-' }, { k: 'Decision note', v: view.reviewNote || '-' }]} />}
    </Modal>
  </>)
}
