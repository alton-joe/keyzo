import { useState } from 'react'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Plus, Trash2, TrendingDown } from 'lucide-react'
import { api } from '../../lib/api'
import type { Expense, Paged, PropertyListItem } from '../../lib/types'
import { useToast } from '../../lib/providers'
import { Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Pagination, Select, Table, TableSkeleton, Td, Th, Tr, Badge } from '../../components/ui'
import { date, label, money, toISODate } from '../../lib/format'

const cats = ['maintenance', 'repairs', 'utilities', 'tax', 'insurance', 'salary', 'other']

export default function Expenses() {
  const toast = useToast(); const qc = useQueryClient()
  const [propertyId, setPropertyId] = useState('')
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ propertyId: '', category: 'utilities', description: '', amount: 0, expenseDate: toISODate(new Date()) })
  const props = useQuery({ queryKey: ['properties', 'all'], queryFn: () => api.get<Paged<PropertyListItem>>('/properties', { PageSize: 100 }) })
  const q = useQuery({ queryKey: ['expenses', propertyId, category, page], placeholderData: keepPreviousData, queryFn: () => api.get<Paged<Expense>>('/expenses', { PropertyId: propertyId, Category: category, Page: page, PageSize: 10 }) })
  const create = useMutation({ mutationFn: () => api.post('/expenses', { ...f, propertyId: Number(f.propertyId), amount: Number(f.amount) }), onSuccess: () => { toast.success('Expense recorded'); setOpen(false); qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) }, onError: (e: Error) => toast.error(e.message) })
  const del = useMutation({ mutationFn: (id: number) => api.del(`/expenses/${id}`), onSuccess: () => { toast.success('Expense deleted'); qc.invalidateQueries({ queryKey: ['expenses'] }) }, onError: (e: Error) => toast.error(e.message) })

  return (<>
    <PageHeader title="Expenses" subtitle="Property costs - maintenance jobs are booked here automatically" actions={<Button icon={<Plus className="size-4" />} onClick={() => { setF({ ...f, propertyId: String(props.data?.items[0]?.id ?? '') }); setOpen(true) }}>Add expense</Button>} />
    <div className="mb-5 flex flex-wrap gap-3">
      <Select className="w-56" value={propertyId} onChange={(e) => { setPropertyId(e.target.value); setPage(1) }} aria-label="Property"><option value="">All properties</option>{props.data?.items.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
      <Select className="w-44" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }} aria-label="Category"><option value="">All categories</option>{cats.map((c) => <option key={c} value={c}>{label(c)}</option>)}</Select>
    </div>
    <Card className="overflow-hidden">
      {q.isLoading ? <TableSkeleton /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : q.data!.items.length === 0 ? <EmptyState icon={<TrendingDown className="size-7" />} title="No expenses recorded" />
        : (<Table><thead><tr><Th>Date</Th><Th>Property</Th><Th>Category</Th><Th>Description</Th><Th>Amount</Th><Th /></tr></thead>
          <tbody>{q.data!.items.map((e) => (
            <Tr key={e.id}><Td>{date(e.expenseDate)}</Td><Td className="font-semibold">{e.propertyName}{e.unitNumber && <span className="text-muted block text-xs font-normal">Unit {e.unitNumber}</span>}</Td>
              <Td><Badge color="violet">{label(e.category)}</Badge></Td><Td>{e.description}{e.requestId && <span className="text-muted block text-xs">From maintenance job #{e.requestId}</span>}</Td>
              <Td className="font-semibold">{money(e.amount)}</Td><Td className="text-right">{!e.requestId && <Button size="sm" variant="ghost" aria-label="Delete expense" onClick={() => del.mutate(e.id)}><Trash2 className="size-4 text-rose-500" /></Button>}</Td></Tr>))}</tbody></Table>)}
      {q.data && <Pagination page={q.data.page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} />}
    </Card>
    <Modal open={open} onClose={() => setOpen(false)} title="Add expense" footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button loading={create.isPending} disabled={!f.propertyId || !f.description || f.amount <= 0} onClick={() => create.mutate()}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Property" className="sm:col-span-2"><Select value={f.propertyId} onChange={(e) => setF({ ...f, propertyId: e.target.value })}>{props.data?.items.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{cats.map((c) => <option key={c} value={c}>{label(c)}</option>)}</Select></Field>
        <Field label="Date"><Input type="date" value={f.expenseDate} onChange={(e) => setF({ ...f, expenseDate: e.target.value })} /></Field>
        <Field label="Description" className="sm:col-span-2"><Input maxLength={300} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Amount (₹)"><Input type="number" min={1} value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} /></Field>
      </div>
    </Modal>
  </>)
}
