import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CalendarPlus, History, Pencil, XCircle } from 'lucide-react'
import { api } from '../../lib/api'
import type { Invoice, LeaseDetail, Paged } from '../../lib/types'
import { useAuth, useToast } from '../../lib/providers'
import { Button, Card, CardHeader, Confirm, ErrorState, Field, Input, KeyValue, Modal, PageHeader, PageLoader, StatusBadge, Table, Td, Textarea, Th, Tr } from '../../components/ui'
import { date, label, money, monthLong } from '../../lib/format'

export default function LeaseDetailPage() {
  const { id } = useParams()
  const { isOperator, hasRole } = useAuth()
  const toast = useToast(); const qc = useQueryClient()
  const [edit, setEdit] = useState(false)
  const [terminate, setTerminate] = useState(false)
  const [renew, setRenew] = useState(false)
  const q = useQuery({ queryKey: ['lease', id], queryFn: () => api.get<LeaseDetail>(`/leases/${id}`) })
  const invoices = useQuery({ queryKey: ['lease-invoices', id], queryFn: () => api.get<Paged<Invoice>>('/invoices', { LeaseId: id, PageSize: 12 }) })
  const refresh = () => { qc.invalidateQueries({ queryKey: ['lease', id] }); qc.invalidateQueries({ queryKey: ['leases'] }); qc.invalidateQueries({ queryKey: ['lease-invoices', id] }) }

  const [f, setF] = useState({ endDate: '', monthlyRent: 0, securityDeposit: 0, rentDueDay: 5, lateFee: 0, terms: '' })
  const [rf, setRf] = useState({ requestedEndDate: '', proposedRent: '', note: '' })

  const update = useMutation({ mutationFn: () => api.put(`/leases/${id}`, f), onSuccess: () => { toast.success('Lease updated - a new version was recorded'); setEdit(false); refresh() }, onError: (e: Error) => toast.error(e.message) })
  const term = useMutation({ mutationFn: () => api.post(`/leases/${id}/terminate`), onSuccess: () => { toast.success('Lease terminated'); setTerminate(false); refresh() }, onError: (e: Error) => toast.error(e.message) })
  const renewM = useMutation({ mutationFn: () => api.post(`/leases/${id}/renewals`, { requestedEndDate: rf.requestedEndDate, proposedRent: rf.proposedRent ? Number(rf.proposedRent) : null, note: rf.note }), onSuccess: () => { toast.success('Renewal request sent'); setRenew(false); refresh() }, onError: (e: Error) => toast.error(e.message) })
  const decide = useMutation({ mutationFn: ({ rid, approve }: { rid: number; approve: boolean }) => api.post(`/leases/renewals/${rid}/decision`, { approve }), onSuccess: () => { toast.success('Renewal decision saved'); refresh() }, onError: (e: Error) => toast.error(e.message) })

  if (q.isLoading) return <PageLoader />
  if (q.isError) return <ErrorState error={q.error} retry={() => q.refetch()} />
  const d = q.data!, l = d.lease
  const openEdit = () => { setF({ endDate: l.endDate, monthlyRent: l.monthlyRent, securityDeposit: l.securityDeposit, rentDueDay: d.rentDueDay, lateFee: d.lateFee, terms: d.terms ?? '' }); setEdit(true) }
  const n = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: Number(e.target.value) })
  const pending = d.renewals.find((r) => r.status === 'pending')

  return (<>
    <Link to="/app/leases" className="text-muted hover:text-brand-500 mb-4 inline-flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="size-4" />All leases</Link>
    <PageHeader title={`${l.propertyName} · Unit ${l.unitNumber}`} subtitle={`Lease #${l.id} · ${l.tenantName}`}
      actions={<><StatusBadge status={l.status} />
        {isOperator && l.status === 'active' && <><Button variant="secondary" icon={<Pencil className="size-4" />} onClick={openEdit}>Edit terms</Button><Button variant="danger" icon={<XCircle className="size-4" />} onClick={() => setTerminate(true)}>Terminate</Button></>}
        {hasRole('Tenant') && l.status === 'active' && !pending && <Button icon={<CalendarPlus className="size-4" />} onClick={() => { setRf({ requestedEndDate: '', proposedRent: '', note: '' }); setRenew(true) }}>Request renewal</Button>}</>} />

    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Card className="p-6"><KeyValue items={[
        { k: 'Tenant', v: l.tenantName }, { k: 'Monthly rent', v: money(l.monthlyRent) },
        { k: 'Start date', v: date(l.startDate) }, { k: 'End date', v: `${date(l.endDate)}${l.status === 'active' ? ` (${l.daysToExpiry} days left)` : ''}` },
        { k: 'Security deposit', v: money(l.securityDeposit) }, { k: 'Rent due day', v: `${d.rentDueDay}th of each month` },
        { k: 'Flat late fee', v: money(d.lateFee) }, { k: 'Outstanding', v: <span className={l.outstanding > 0 ? 'font-bold text-rose-500' : ''}>{money(l.outstanding)}</span> }]} />
        {d.terms && <div className="mt-6 border-t border-base pt-5"><p className="text-muted text-xs font-semibold tracking-wide uppercase">Terms</p><p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{d.terms}</p></div>}
      </Card>
      <div className="space-y-6">
        {d.deposit && <Card className="p-5"><p className="text-muted text-xs font-semibold tracking-wide uppercase">Security deposit</p>
          <p className="font-display mt-1 text-2xl font-extrabold">{money(d.deposit.amount)}</p>
          <div className="mt-2 flex items-center gap-2"><StatusBadge status={d.deposit.status} />{d.deposit.refundedAmount > 0 && <span className="text-muted text-xs">{money(d.deposit.refundedAmount)} refunded</span>}</div></Card>}
        <Card>
          <CardHeader title="Renewals" />
          {d.renewals.length === 0 ? <p className="text-muted p-5 text-sm">No renewal requests.</p> : <ul className="divide-y divide-[var(--border)]">{d.renewals.map((r) => (
            <li key={r.id} className="p-4 text-sm"><div className="flex items-center justify-between"><b>Until {date(r.requestedEndDate)}</b><StatusBadge status={r.status} /></div>
              <p className="text-muted mt-1">{r.proposedRent ? `Proposed ${money(r.proposedRent)}/mo` : 'Same rent'}{r.note ? ` — ${r.note}` : ''}</p>
              {isOperator && r.status === 'pending' && <div className="mt-3 flex gap-2"><Button size="sm" variant="soft" onClick={() => decide.mutate({ rid: r.id, approve: true })}>Approve</Button><Button size="sm" variant="danger" onClick={() => decide.mutate({ rid: r.id, approve: false })}>Decline</Button></div>}</li>))}</ul>}
        </Card>
      </div>
    </div>

    <Card className="mt-6 overflow-hidden"><CardHeader title="Rent invoices" action={<Link to="/app/invoices"><Button size="sm" variant="secondary">All invoices</Button></Link>} />
      <Table><thead><tr><Th>Invoice</Th><Th>Month</Th><Th>Due</Th><Th>Amount</Th><Th>Paid</Th><Th>Status</Th></tr></thead>
        <tbody>{invoices.data?.items.map((i) => (<Tr key={i.id}><Td className="font-semibold"><Link to={`/app/invoices?invoice=${i.id}`} className="hover:text-brand-500">{i.invoiceNumber}</Link></Td><Td>{monthLong(i.periodMonth)}</Td><Td>{date(i.dueDate)}</Td><Td>{money(i.amount + i.lateFee)}</Td><Td>{money(i.amountPaid)}</Td><Td><StatusBadge status={i.status} /></Td></Tr>))}
          {invoices.data?.items.length === 0 && <Tr><Td colSpan={6} className="text-muted text-center">No invoices yet</Td></Tr>}</tbody></Table></Card>

    <Card className="mt-6"><CardHeader title="Agreement history" subtitle="Every change to the terms is versioned automatically by the database" action={<History className="text-muted size-5" />} />
      <ol className="space-y-0 p-5">{d.versions.map((v, i) => (
        <li key={v.versionNo} className="relative flex gap-4 pb-6 last:pb-0">
          {i < d.versions.length - 1 && <span className="absolute top-8 bottom-0 left-[15px] w-px bg-[var(--border)]" />}
          <span className="gradient-brand relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">v{v.versionNo}</span>
          <div className="text-sm"><p className="font-semibold">{v.changeReason ?? label('update')} <span className="text-muted font-normal">· {date(v.createdAt)}</span></p>
            <p className="text-muted">{date(v.startDate)} → {date(v.endDate)} · {money(v.monthlyRent)}/mo · deposit {money(v.securityDeposit)}</p></div></li>))}</ol></Card>

    <Modal open={edit} onClose={() => setEdit(false)} wide title="Edit lease terms" footer={<><Button variant="secondary" onClick={() => setEdit(false)}>Cancel</Button><Button loading={update.isPending} onClick={() => update.mutate()}>Save changes</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="End date"><Input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></Field>
        <Field label="Monthly rent (₹)"><Input type="number" min={1} value={f.monthlyRent} onChange={n('monthlyRent')} /></Field>
        <Field label="Security deposit (₹)"><Input type="number" min={0} value={f.securityDeposit} onChange={n('securityDeposit')} /></Field>
        <Field label="Rent due day"><Input type="number" min={1} max={28} value={f.rentDueDay} onChange={n('rentDueDay')} /></Field>
        <Field label="Flat late fee (₹)"><Input type="number" min={0} value={f.lateFee} onChange={n('lateFee')} /></Field>
        <Field label="Terms" className="sm:col-span-2"><Textarea value={f.terms} onChange={(e) => setF({ ...f, terms: e.target.value })} /></Field>
      </div>
    </Modal>
    <Modal open={renew} onClose={() => setRenew(false)} title="Request a lease renewal" footer={<><Button variant="secondary" onClick={() => setRenew(false)}>Cancel</Button><Button loading={renewM.isPending} disabled={!rf.requestedEndDate} onClick={() => renewM.mutate()}>Send request</Button></>}>
      <div className="grid gap-4">
        <Field label="New end date" hint={`Current end date is ${date(l.endDate)}`}><Input type="date" min={l.endDate} value={rf.requestedEndDate} onChange={(e) => setRf({ ...rf, requestedEndDate: e.target.value })} /></Field>
        <Field label="Proposed rent (₹)" hint="Leave empty to keep the current rent"><Input type="number" min={1} value={rf.proposedRent} onChange={(e) => setRf({ ...rf, proposedRent: e.target.value })} /></Field>
        <Field label="Note"><Textarea value={rf.note} onChange={(e) => setRf({ ...rf, note: e.target.value })} maxLength={500} /></Field>
      </div>
    </Modal>
    <Confirm open={terminate} onClose={() => setTerminate(false)} danger title="Terminate this lease?" text="The unit becomes available and future unpaid invoices are cancelled. This cannot be undone." confirmLabel="Terminate lease" loading={term.isPending} onConfirm={() => term.mutate()} />
  </>)
}
