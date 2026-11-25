import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PiggyBank } from 'lucide-react'
import { api } from '../../lib/api'
import type { Deposit, Paged } from '../../lib/types'
import { useAuth, useToast } from '../../lib/providers'
import { Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Pagination, StatusBadge, Table, TableSkeleton, Tabs, Td, Textarea, Th, Tr } from '../../components/ui'
import { date, money } from '../../lib/format'

export default function Deposits() {
  const { isOperator } = useAuth()
  const toast = useToast(); const qc = useQueryClient()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [sel, setSel] = useState<Deposit | null>(null)
  const [f, setF] = useState({ amount: 0, reason: '', forfeit: false })
  const q = useQuery({ queryKey: ['deposits', status, page], queryFn: () => api.get<Paged<Deposit>>('/deposits', { status, page, pageSize: 10 }) })
  const refund = useMutation({ mutationFn: () => api.post(`/deposits/${sel!.id}/refund`, { amount: Number(f.amount), reason: f.reason, forfeit: f.forfeit }), onSuccess: () => { toast.success('Deposit settled'); setSel(null); qc.invalidateQueries({ queryKey: ['deposits'] }) }, onError: (e: Error) => toast.error(e.message) })
  const open = (d: Deposit) => { setSel(d); setF({ amount: d.amount - d.refundedAmount, reason: '', forfeit: false }) }
  const held = q.data?.items.filter((d) => d.status === 'held').reduce((s, d) => s + d.amount, 0) ?? 0

  return (<>
    <PageHeader title="Security deposits" subtitle="Deposits held, refunded and deducted" />
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><Tabs value={status} onChange={(v) => { setStatus(v); setPage(1) }} tabs={[{ value: '', label: 'All' }, { value: 'held', label: 'Held' }, { value: 'partially_refunded', label: 'Partly refunded' }, { value: 'refunded', label: 'Refunded' }, { value: 'forfeited', label: 'Forfeited' }]} />
      {q.data && <span className="text-muted text-sm">Held on this page: <b className="text-[var(--text)]">{money(held)}</b></span>}</div>
    <Card className="overflow-hidden">
      {q.isLoading ? <TableSkeleton /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : q.data!.items.length === 0 ? <EmptyState icon={<PiggyBank className="size-7" />} title="No deposits" />
        : (<Table><thead><tr><Th>Lease</Th>{isOperator && <Th>Tenant</Th>}<Th>Received</Th><Th>Deposit</Th><Th>Refunded</Th><Th>Status</Th><Th /></tr></thead>
          <tbody>{q.data!.items.map((d) => (
            <Tr key={d.id}><Td className="font-semibold">{d.propertyName}<span className="text-muted block text-xs font-normal">Unit {d.unitNumber}</span></Td>{isOperator && <Td>{d.tenantName}</Td>}<Td>{date(d.receivedOn)}</Td><Td className="font-semibold">{money(d.amount)}</Td>
              <Td>{d.refundedAmount > 0 ? <>{money(d.refundedAmount)}<span className="text-muted block text-xs">{d.deductionReason}</span></> : '-'}</Td><Td><StatusBadge status={d.status} /></Td>
              <Td className="text-right">{isOperator && (d.status === 'held' || d.status === 'partially_refunded') && <Button size="sm" variant="secondary" onClick={() => open(d)}>Settle</Button>}</Td></Tr>))}</tbody></Table>)}
      {q.data && <Pagination page={q.data.page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} />}
    </Card>
    <Modal open={!!sel} onClose={() => setSel(null)} title="Settle deposit" footer={<><Button variant="secondary" onClick={() => setSel(null)}>Cancel</Button><Button loading={refund.isPending} onClick={() => refund.mutate()}>{f.forfeit ? 'Forfeit deposit' : 'Refund'}</Button></>}>
      <p className="text-muted mb-4 text-sm">Deposit of {sel && money(sel.amount)} for {sel?.tenantName}. A deposit can only be settled once its lease has ended.</p>
      <div className="space-y-4">
        <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" className="accent-brand-600 size-4" checked={f.forfeit} onChange={(e) => setF({ ...f, forfeit: e.target.checked })} />Forfeit the whole deposit (nothing refunded)</label>
        {!f.forfeit && <Field label="Refund amount (₹)"><Input type="number" min={0} max={sel ? sel.amount - sel.refundedAmount : 0} value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} /></Field>}
        <Field label="Reason for any deduction"><Textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} maxLength={300} placeholder="e.g. repainting charges" /></Field>
      </div>
    </Modal>
  </>)
}
