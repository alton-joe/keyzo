import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { ImagePlus, Plus, Wrench, X } from 'lucide-react'
import { api } from '../../lib/api'
import type { LeaseItem, MaintItem, Paged } from '../../lib/types'
import { useAuth, useToast } from '../../lib/providers'
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Pagination, SearchBox, Select, StatusBadge, TableSkeleton, Tabs, Textarea } from '../../components/ui'
import { date, label, money, timeAgo } from '../../lib/format'

const categories = ['plumbing', 'electrical', 'appliance', 'structural', 'pest_control', 'cleaning', 'other']
const priorityColor = { urgent: 'red', high: 'amber', medium: 'blue', low: 'slate' } as const

function NewRequest({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast(); const qc = useQueryClient(); const nav = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [f, setF] = useState({ unitId: '', title: '', description: '', category: 'plumbing', priority: 'medium' })
  const leases = useQuery({ queryKey: ['leases', 'active-mine'], enabled: open, queryFn: () => api.get<Paged<LeaseItem>>('/leases', { Status: 'active', PageSize: 20 }) })
  const unitId = f.unitId || String(leases.data?.items[0]?.unitId ?? '')

  const create = useMutation({
    mutationFn: () => { const fd = new FormData(); fd.append('unitId', unitId); (['title', 'description', 'category', 'priority'] as const).forEach((k) => fd.append(k, f[k])); files.forEach((x) => fd.append('files', x)); return api.upload<{ item: { id: number } }>('/maintenance', fd) },
    onSuccess: (r) => { toast.success('Request submitted'); qc.invalidateQueries({ queryKey: ['maintenance'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); setFiles([]); setF({ unitId: '', title: '', description: '', category: 'plumbing', priority: 'medium' }); onClose(); nav(`/app/maintenance/${r.item.id}`) },
    onError: (e: Error) => toast.error(e.message),
  })
  return (
    <Modal open={open} onClose={onClose} wide title="New maintenance request" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={create.isPending} disabled={!unitId || !f.title || !f.description} onClick={() => create.mutate()}>Submit request</Button></>}>
      {leases.data && leases.data.items.length === 0 ? <p className="text-muted text-sm">You need an active lease to raise a request.</p> : (
        <div className="grid gap-4 sm:grid-cols-2">
          {leases.data && leases.data.items.length > 1 && <Field label="Home" className="sm:col-span-2"><Select value={unitId} onChange={(e) => setF({ ...f, unitId: e.target.value })}>{leases.data.items.map((l) => <option key={l.id} value={l.unitId}>{l.propertyName} · {l.unitNumber}</option>)}</Select></Field>}
          <Field label="What is the problem?" className="sm:col-span-2"><Input value={f.title} maxLength={150} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Kitchen tap is leaking" /></Field>
          <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{categories.map((c) => <option key={c} value={c}>{label(c)}</option>)}</Select></Field>
          <Field label="Priority"><Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{['low', 'medium', 'high', 'urgent'].map((c) => <option key={c} value={c}>{label(c)}</option>)}</Select></Field>
          <Field label="Details" className="sm:col-span-2"><Textarea value={f.description} maxLength={4000} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="When did it start? Where exactly? Anything we should know?" /></Field>
          <div className="sm:col-span-2"><p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Photos (up to 5)</p>
            <input ref={fileRef} hidden type="file" accept="image/*" multiple onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [])].slice(0, 5))} />
            <div className="flex flex-wrap gap-2">{files.map((x, i) => (<span key={i} className="surface-2 flex items-center gap-2 rounded-full py-1 pr-1.5 pl-3 text-xs font-medium">{x.name.slice(0, 22)}<button aria-label="Remove" onClick={() => setFiles(files.filter((_, j) => j !== i))}><X className="size-3.5" /></button></span>))}
              <Button size="sm" variant="secondary" icon={<ImagePlus className="size-4" />} onClick={() => fileRef.current?.click()}>Add photos</Button></div></div>
        </div>)}
    </Modal>
  )
}

export default function Maintenance() {
  const { hasRole, isOperator } = useAuth()
  const nav = useNavigate()
  const [status, setStatus] = useState('active')
  const [priority, setPriority] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const q = useQuery({ queryKey: ['maintenance', status, priority, search, page], placeholderData: keepPreviousData, queryFn: () => api.get<Paged<MaintItem>>('/maintenance', { Status: status, Priority: priority, Search: search, Page: page, PageSize: 10 }) })
  const staff = hasRole('MaintenanceStaff') && !isOperator

  return (<>
    <PageHeader title={staff ? 'My jobs' : 'Maintenance'} subtitle={staff ? 'Repairs assigned to you' : isOperator ? 'Requests, assignments and repair progress' : 'Report and track repairs in your home'}
      actions={hasRole('Tenant') && <Button icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>New request</Button>} />
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-3"><Tabs value={status} onChange={(v) => { setStatus(v); setPage(1) }} tabs={[{ value: 'active', label: 'Active' }, { value: 'open', label: 'Open' }, { value: 'assigned', label: 'Assigned' }, { value: 'in_progress', label: 'In progress' }, { value: 'completed', label: 'Completed' }, { value: '', label: 'All' }]} />
        <Select className="h-10 w-36" value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1) }} aria-label="Priority"><option value="">All priorities</option>{['urgent', 'high', 'medium', 'low'].map((p) => <option key={p} value={p}>{label(p)}</option>)}</Select></div>
      <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search requests…" />
    </div>
    <Card className="overflow-hidden">
      {q.isLoading ? <TableSkeleton /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : q.data!.items.length === 0
        ? <EmptyState icon={<Wrench className="size-7" />} title="Nothing here" text={hasRole('Tenant') ? 'Something broken? Raise a request and we will get it fixed.' : 'No requests match these filters.'} />
        : (<ul className="divide-y divide-[var(--border)]">{q.data!.items.map((m) => (
          <li key={m.id}><button onClick={() => nav(`/app/maintenance/${m.id}`)} className="flex w-full cursor-pointer flex-wrap items-center gap-4 px-5 py-4 text-left transition hover:bg-[var(--surface-2)]/60">
            <span className="bg-brand-500/10 text-brand-500 flex size-11 shrink-0 items-center justify-center rounded-xl"><Wrench className="size-5" /></span>
            <div className="min-w-0 flex-1"><p className="truncate font-bold">{m.title}</p>
              <p className="text-muted truncate text-sm">{m.propertyName} · Unit {m.unitNumber}{isOperator ? ` · ${m.tenantName}` : ''} · {label(m.category)} · {timeAgo(m.createdAt)}</p></div>
            <div className="flex flex-wrap items-center gap-2">
              {m.assignedTo && <span className="text-muted text-xs">→ {m.assignedTo}{m.scheduledFor ? ` · ${date(m.scheduledFor)}` : ''}</span>}
              {m.totalCost > 0 && <span className="text-muted text-xs">{money(m.totalCost)}</span>}
              <Badge color={priorityColor[m.priority as keyof typeof priorityColor] ?? 'slate'}>{label(m.priority)}</Badge><StatusBadge status={m.status} /></div>
          </button></li>))}</ul>)}
      {q.data && <Pagination page={q.data.page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} />}
    </Card>
    <NewRequest open={open} onClose={() => setOpen(false)} />
  </>)
}
