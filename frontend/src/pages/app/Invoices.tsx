import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { CreditCard, Download, Receipt, RefreshCw } from 'lucide-react'
import { api } from '../../lib/api'
import type { Invoice, Paged, Payment } from '../../lib/types'
import { useAuth, useToast } from '../../lib/providers'
import { Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Pagination, SearchBox, Select, StatusBadge, Table, TableSkeleton, Tabs, Td, Th, Tr, Textarea } from '../../components/ui'
import { date, dateTime, label, money, moneyExact, monthLong, toISODate } from '../../lib/format'

const methods = ['upi', 'card', 'bank_transfer', 'cash', 'cheque']

function PayModal({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  const toast = useToast(); const qc = useQueryClient()
  const [f, setF] = useState({ amount: 0, method: 'upi', referenceNo: '', note: '' })
  useEffect(() => { if (invoice) setF({ amount: invoice.balance, method: 'upi', referenceNo: '', note: '' }) }, [invoice])
  const pay = useMutation({
    mutationFn: () => api.post<Payment>('/payments', { invoiceId: invoice!.id, ...f, amount: Number(f.amount) }),
    onSuccess: (p) => { toast.success(`Payment recorded - receipt ${p.receiptNumber}`); qc.invalidateQueries(); onClose() },
    onError: (e: Error) => toast.error(e.message),
  })
  return (
    <Modal open={!!invoice} onClose={onClose} title={`Pay ${invoice?.invoiceNumber ?? ''}`} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={pay.isPending} icon={<CreditCard className="size-4" />} onClick={() => pay.mutate()}>Record payment</Button></>}>
      {invoice && (<div className="space-y-4">
        <div className="surface-2 flex items-center justify-between rounded-xl p-4 text-sm"><span className="text-muted">{monthLong(invoice.periodMonth)} · {invoice.propertyName} {invoice.unitNumber}</span><b>Balance {moneyExact(invoice.balance)}</b></div>
        <Field label="Amount (₹)" hint="You can pay part of the balance"><Input type="number" min={1} max={invoice.balance} step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} /></Field>
        <Field label="Method"><Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{methods.map((m) => <option key={m} value={m}>{label(m)}</option>)}</Select></Field>
        <Field label="Reference / transaction id" hint="Optional"><Input value={f.referenceNo} maxLength={60} onChange={(e) => setF({ ...f, referenceNo: e.target.value })} /></Field>
        <Field label="Note"><Textarea className="min-h-16" value={f.note} maxLength={300} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <p className="text-muted text-xs">Payment gateways are not connected in this version - payments are recorded manually and each one is stored with a receipt.</p>
      </div>)}
    </Modal>
  )
}

export function ReceiptButton({ id, receipt }: { id: number; receipt: string }) {
  const toast = useToast()
  return <Button size="sm" variant="ghost" icon={<Download className="size-4" />} onClick={async () => { try { await api.download(`/payments/${id}/receipt`, `${receipt}.pdf`) } catch (e) { toast.error((e as Error).message) } }}>Receipt</Button>
}

export function InvoiceButton({ id, number }: { id: number; number: string }) {
  const toast = useToast()
  return <Button size="sm" variant="ghost" icon={<Download className="size-4" />} onClick={async () => { try { await api.download(`/invoices/${id}/pdf`, `${number}.pdf`) } catch (e) { toast.error((e as Error).message) } }}>Download invoice</Button>
}

export default function Invoices() {
  const { isOperator, hasRole } = useAuth()
  const toast = useToast(); const qc = useQueryClient()
  const [params] = useSearchParams()
  const [tab, setTab] = useState<'invoices' | 'payments'>('invoices')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pay, setPay] = useState<Invoice | null>(null)
  const [gen, setGen] = useState(false)
  const [genMonth, setGenMonth] = useState(toISODate(new Date()).slice(0, 7))

  const inv = useQuery({ queryKey: ['invoices', status, search, page], placeholderData: keepPreviousData, enabled: tab === 'invoices', queryFn: () => api.get<Paged<Invoice>>('/invoices', { Status: status, Search: search, Page: page, PageSize: 10 }) })
  const pays = useQuery({ queryKey: ['payments', page], placeholderData: keepPreviousData, enabled: tab === 'payments', queryFn: () => api.get<Paged<Payment>>('/payments', { Page: page, PageSize: 10 }) })
  const focus = params.get('invoice')
  const focused = useQuery({ queryKey: ['invoice', focus], enabled: !!focus, queryFn: () => api.get<{ invoice: Invoice }>(`/invoices/${focus}`) })
  useEffect(() => { if (focused.data && focused.data.invoice.balance > 0) setPay(focused.data.invoice) }, [focused.data])

  const generate = useMutation({
    mutationFn: () => api.post<{ created: number }>('/invoices/generate', { month: `${genMonth}-01` }),
    onSuccess: (r) => { toast.success(r.created ? `${r.created} invoice(s) generated` : 'All invoices for that month already exist'); setGen(false); qc.invalidateQueries() },
    onError: (e: Error) => toast.error(e.message),
  })
  const jobs = useMutation({ mutationFn: () => api.post('/jobs/run'), onSuccess: () => { toast.success('Nightly jobs executed: leases synced, late fees applied'); qc.invalidateQueries() }, onError: (e: Error) => toast.error(e.message) })

  const list = tab === 'invoices' ? inv : pays
  return (<>
    <PageHeader title="Rent & payments" subtitle={isOperator ? 'Invoices, collections and receipts' : 'Your rent invoices and payment history'}
      actions={isOperator && <>{hasRole('SuperAdmin') && <Button variant="secondary" icon={<RefreshCw className="size-4" />} loading={jobs.isPending} onClick={() => jobs.mutate()}>Run nightly jobs</Button>}<Button icon={<Receipt className="size-4" />} onClick={() => setGen(true)}>Generate invoices</Button></>} />
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-3"><Tabs value={tab} onChange={(v) => { setTab(v); setPage(1) }} tabs={[{ value: 'invoices', label: 'Invoices' }, { value: 'payments', label: 'Payments' }]} />
        {tab === 'invoices' && <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1) }} tabs={[{ value: '', label: 'All' }, { value: 'pending', label: 'Upcoming' }, { value: 'overdue', label: 'Overdue' }, { value: 'paid', label: 'Paid' }]} />}</div>
      {tab === 'invoices' && isOperator && <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search invoice, tenant, unit…" />}
    </div>
    <Card className="overflow-hidden">
      {list.isLoading ? <TableSkeleton /> : list.isError ? <ErrorState error={list.error} retry={() => list.refetch()} />
        : tab === 'invoices' ? (inv.data!.items.length === 0 ? <EmptyState icon={<Receipt className="size-7" />} title="No invoices" text="Invoices are generated monthly for every active lease." /> :
          <Table><thead><tr><Th>Invoice</Th>{isOperator && <Th>Tenant</Th>}<Th>Month</Th><Th>Due</Th><Th>Total</Th><Th>Balance</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>{inv.data!.items.map((i) => (
              <Tr key={i.id}><Td className="font-semibold">{i.invoiceNumber}<span className="text-muted block text-xs font-normal">{i.propertyName} · {i.unitNumber}</span></Td>
                {isOperator && <Td>{i.tenantName}</Td>}<Td>{monthLong(i.periodMonth)}</Td><Td>{date(i.dueDate)}</Td>
                <Td>{money(i.amount + i.lateFee)}{i.lateFee > 0 && <span className="block text-xs text-rose-500">incl. {money(i.lateFee)} late fee</span>}</Td>
                <Td className={i.balance > 0 ? 'font-semibold' : 'text-muted'}>{money(i.balance)}</Td><Td><StatusBadge status={i.status} /></Td>
                <Td className="text-right">{i.balance > 0 && i.status !== 'cancelled' && <Button size="sm" onClick={() => setPay(i)}>Pay</Button>}{i.status === 'paid' && <InvoiceButton id={i.id} number={i.invoiceNumber} />}</Td></Tr>))}</tbody></Table>)
        : (pays.data!.items.length === 0 ? <EmptyState icon={<CreditCard className="size-7" />} title="No payments yet" /> :
          <Table><thead><tr><Th>Receipt</Th>{isOperator && <Th>Tenant</Th>}<Th>Invoice</Th><Th>Paid on</Th><Th>Method</Th><Th>Amount</Th><Th /></tr></thead>
            <tbody>{pays.data!.items.map((p) => (
              <Tr key={p.id}><Td className="font-semibold">{p.receiptNumber}</Td>{isOperator && <Td>{p.tenantName}</Td>}<Td>{p.invoiceNumber}<span className="text-muted block text-xs">{p.propertyName} · {p.unitNumber}</span></Td>
                <Td>{dateTime(p.paidAt)}</Td><Td>{label(p.method)}{p.referenceNo && <span className="text-muted block text-xs">{p.referenceNo}</span>}</Td><Td className="font-semibold">{moneyExact(p.amount)}</Td>
                <Td className="text-right"><ReceiptButton id={p.id} receipt={p.receiptNumber} /></Td></Tr>))}</tbody></Table>)}
      {list.data && <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />}
    </Card>
    <PayModal invoice={pay} onClose={() => setPay(null)} />
    <Modal open={gen} onClose={() => setGen(false)} title="Generate monthly invoices" footer={<><Button variant="secondary" onClick={() => setGen(false)}>Cancel</Button><Button loading={generate.isPending} onClick={() => generate.mutate()}>Generate</Button></>}>
      <p className="text-muted mb-4 text-sm">Creates an invoice for every active lease that does not have one for the chosen month. Safe to run more than once.</p>
      <Field label="Billing month"><Input type="month" value={genMonth} onChange={(e) => setGenMonth(e.target.value)} /></Field>
    </Modal>
  </>)
}
