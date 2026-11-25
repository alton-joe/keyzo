import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, Clock, PlayCircle, UserPlus, XCircle } from 'lucide-react'
import { api } from '../../lib/api'
import type { MaintDetail, UserLookup } from '../../lib/types'
import { useAuth, useToast } from '../../lib/providers'
import { Badge, Button, Card, CardHeader, Confirm, ErrorState, Field, Input, KeyValue, Modal, PageHeader, PageLoader, Select, StatusBadge, Textarea } from '../../components/ui'
import { date, dateTime, label, money, toISODate } from '../../lib/format'

function Photo({ id }: { id: number }) {
  const [src, setSrc] = useState<string>()
  useEffect(() => { let url: string; api.blobUrl(`/maintenance/images/${id}`).then((u) => { url = u; setSrc(u) }).catch(() => {}); return () => { if (url) URL.revokeObjectURL(url) } }, [id])
  return src ? <a href={src} target="_blank" rel="noreferrer"><img src={src} alt="Issue" className="aspect-[4/3] w-full rounded-xl object-cover" /></a> : <div className="skeleton aspect-[4/3] rounded-xl" />
}

export default function MaintenanceDetailPage() {
  const { id } = useParams()
  const { isOperator, hasRole, user } = useAuth()
  const toast = useToast(); const qc = useQueryClient()
  const q = useQuery({ queryKey: ['maint', id], queryFn: () => api.get<MaintDetail>(`/maintenance/${id}`) })
  const staffList = useQuery({ queryKey: ['lookup', 'MaintenanceStaff'], enabled: isOperator, queryFn: () => api.get<UserLookup[]>('/users/lookup/MaintenanceStaff') })
  const [assign, setAssign] = useState(false)
  const [af, setAf] = useState({ staffId: '', scheduledFor: '' })
  const [update, setUpdate] = useState<null | 'in_progress' | 'completed'>(null)
  const [uf, setUf] = useState({ note: '', cost: 0 })
  const [cancel, setCancel] = useState(false)
  const refresh = () => { qc.invalidateQueries({ queryKey: ['maint', id] }); qc.invalidateQueries({ queryKey: ['maintenance'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['expenses'] }) }

  const assignM = useMutation({ mutationFn: () => api.post(`/maintenance/${id}/assign`, { staffId: Number(af.staffId), scheduledFor: af.scheduledFor || null }), onSuccess: () => { toast.success('Assigned'); setAssign(false); refresh() }, onError: (e: Error) => toast.error(e.message) })
  const logM = useMutation({ mutationFn: () => api.post(`/maintenance/${id}/logs`, { status: update, note: uf.note, cost: Number(uf.cost) }), onSuccess: () => { toast.success('Progress saved'); setUpdate(null); setUf({ note: '', cost: 0 }); refresh() }, onError: (e: Error) => toast.error(e.message) })
  const cancelM = useMutation({ mutationFn: () => api.post(`/maintenance/${id}/cancel`), onSuccess: () => { toast.success('Request cancelled'); setCancel(false); refresh() }, onError: (e: Error) => toast.error(e.message) })

  if (q.isLoading) return <PageLoader />
  if (q.isError) return <ErrorState error={q.error} retry={() => q.refetch()} />
  const d = q.data!, m = d.item
  const closed = m.status === 'completed' || m.status === 'cancelled'
  const mine = hasRole('MaintenanceStaff') && d.assignedStaffId === user?.id
  const steps = ['open', 'assigned', 'in_progress', 'completed']
  const stepIdx = steps.indexOf(m.status)
  const colors = { urgent: 'red', high: 'amber', medium: 'blue', low: 'slate' } as const

  return (<>
    <Link to="/app/maintenance" className="text-muted hover:text-brand-500 mb-4 inline-flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="size-4" />Back</Link>
    <PageHeader title={m.title} subtitle={`${m.propertyName} · Unit ${m.unitNumber} · raised ${dateTime(m.createdAt)}`}
      actions={<><Badge color={colors[m.priority as keyof typeof colors] ?? 'slate'}>{label(m.priority)} priority</Badge><StatusBadge status={m.status} />
        {isOperator && !closed && <Button icon={<UserPlus className="size-4" />} onClick={() => { setAf({ staffId: String(d.assignedStaffId ?? ''), scheduledFor: '' }); setAssign(true) }}>{m.assignedTo ? 'Reassign' : 'Assign staff'}</Button>}
        {(isOperator || mine) && !closed && m.status !== 'open' && <>
          {m.status === 'assigned' && <Button variant="soft" icon={<PlayCircle className="size-4" />} onClick={() => setUpdate('in_progress')}>Start work</Button>}
          <Button variant="soft" icon={<CheckCircle2 className="size-4" />} onClick={() => setUpdate('completed')}>Mark complete</Button></>}
        {!closed && (isOperator || hasRole('Tenant')) && <Button variant="danger" icon={<XCircle className="size-4" />} onClick={() => setCancel(true)}>Cancel</Button>}</>} />

    {m.status !== 'cancelled' && (
      <Card className="mb-6 p-6"><ol className="flex items-center">{steps.map((s, i) => (
        <li key={s} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-2"><span className={`flex size-9 items-center justify-center rounded-full text-sm font-bold transition ${i <= stepIdx ? 'gradient-brand text-white' : 'surface-2 text-muted'}`}>{i < stepIdx || m.status === 'completed' ? <CheckCircle2 className="size-5" /> : i + 1}</span><span className="text-xs font-semibold">{label(s)}</span></div>
          {i < steps.length - 1 && <span className={`mx-2 mb-6 h-0.5 flex-1 rounded ${i < stepIdx ? 'bg-brand-500' : 'bg-[var(--border)]'}`} />}</li>))}</ol></Card>)}

    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">
        <Card className="p-6"><h3 className="font-bold">Description</h3><p className="text-muted mt-2 leading-relaxed whitespace-pre-line">{d.description}</p>
          {d.images.length > 0 && <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">{d.images.map((i) => <Photo key={i.id} id={i.id} />)}</div>}</Card>
        <Card><CardHeader title="Activity" subtitle="Every status change is logged" />
          <ol className="p-5">{d.logs.map((l, i) => (
            <li key={l.id} className="relative flex gap-4 pb-5 last:pb-0">
              {i < d.logs.length - 1 && <span className="absolute top-7 bottom-0 left-[11px] w-px bg-[var(--border)]" />}
              <span className="bg-brand-500/15 text-brand-500 relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full"><Clock className="size-3.5" /></span>
              <div className="text-sm"><p className="font-semibold"><StatusBadge status={l.status} /> <span className="text-muted ml-1 font-normal">{l.author ?? 'System'} · {dateTime(l.createdAt)}</span></p>
                {l.note && <p className="text-muted mt-1">{l.note}</p>}{l.cost > 0 && <p className="mt-1 font-semibold">Cost: {money(l.cost)}</p>}</div></li>))}</ol></Card>
      </div>
      <Card className="h-fit p-6"><KeyValue items={[{ k: 'Category', v: label(m.category) }, { k: 'Reported by', v: m.tenantName }, { k: 'Assigned to', v: m.assignedTo ?? 'Not assigned yet' }, { k: 'Scheduled for', v: m.scheduledFor ? date(m.scheduledFor) : '-' }, { k: 'Total cost', v: m.totalCost ? money(m.totalCost) : '-' }, { k: 'Completed', v: m.completedAt ? dateTime(m.completedAt) : '-' }]} /></Card>
    </div>

    <Modal open={assign} onClose={() => setAssign(false)} title="Assign to maintenance staff" footer={<><Button variant="secondary" onClick={() => setAssign(false)}>Cancel</Button><Button loading={assignM.isPending} disabled={!af.staffId} onClick={() => assignM.mutate()}>Assign</Button></>}>
      <div className="space-y-4">
        <Field label="Staff member"><Select value={af.staffId} onChange={(e) => setAf({ ...af, staffId: e.target.value })}><option value="">Select…</option>{staffList.data?.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}</Select></Field>
        <Field label="Scheduled date" hint="Optional"><Input type="date" min={toISODate(new Date())} value={af.scheduledFor} onChange={(e) => setAf({ ...af, scheduledFor: e.target.value })} /></Field></div>
    </Modal>
    <Modal open={!!update} onClose={() => setUpdate(null)} title={update === 'completed' ? 'Complete this job' : 'Start work'} footer={<><Button variant="secondary" onClick={() => setUpdate(null)}>Cancel</Button><Button loading={logM.isPending} onClick={() => logM.mutate()}>Save</Button></>}>
      <div className="space-y-4"><Field label="Progress note"><Textarea value={uf.note} maxLength={1000} onChange={(e) => setUf({ ...uf, note: e.target.value })} placeholder="What was done?" /></Field>
        <Field label="Cost incurred (₹)" hint="Booked automatically as a maintenance expense for the property"><Input type="number" min={0} value={uf.cost} onChange={(e) => setUf({ ...uf, cost: Number(e.target.value) })} /></Field></div>
    </Modal>
    <Confirm open={cancel} onClose={() => setCancel(false)} danger title="Cancel this request?" text="The request will be closed. You can raise a new one any time." confirmLabel="Cancel request" loading={cancelM.isPending} onConfirm={() => cancelM.mutate()} />
  </>)
}
