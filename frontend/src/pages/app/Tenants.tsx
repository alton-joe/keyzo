import { useState } from 'react'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { BadgeCheck, Download, FileText, Users } from 'lucide-react'
import { api } from '../../lib/api'
import type { Paged, TenantListItem, TenantProfile } from '../../lib/types'
import { useToast } from '../../lib/providers'
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, KeyValue, Modal, PageHeader, Pagination, PageLoader, SearchBox, Table, TableSkeleton, Td, Th, Tr } from '../../components/ui'
import { date, label, money } from '../../lib/format'

export function TenantDocs({ docs, canVerify, tenantId }: { docs: TenantProfile['documents']; canVerify?: boolean; tenantId?: number }) {
  const toast = useToast(); const qc = useQueryClient()
  const verify = useMutation({ mutationFn: ({ id, v }: { id: number; v: boolean }) => api.patch(`/tenants/documents/${id}/verify`, { verified: v }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenant', tenantId] }); qc.invalidateQueries({ queryKey: ['applications'] }) }, onError: (e: Error) => toast.error(e.message) })
  const open = async (id: number) => { try { window.open(await api.blobUrl(`/tenants/documents/${id}/file`), '_blank') } catch (e) { toast.error((e as Error).message) } }
  if (!docs.length) return <p className="text-muted text-sm">No documents uploaded.</p>
  return (
    <ul className="divide-y divide-[var(--border)] rounded-xl border border-base">{docs.map((d) => (
      <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
        <FileText className="text-brand-500 size-5" /><div className="min-w-0 flex-1"><p className="truncate font-semibold">{label(d.docType)}</p><p className="text-muted truncate text-xs">{d.originalName} · {date(d.uploadedAt)}</p></div>
        {d.isVerified ? <Badge color="green"><BadgeCheck className="size-3.5" />Verified</Badge> : <Badge color="amber">Unverified</Badge>}
        <Button size="sm" variant="ghost" icon={<Download className="size-4" />} onClick={() => open(d.id)}>View</Button>
        {canVerify && <Button size="sm" variant="soft" onClick={() => verify.mutate({ id: d.id, v: !d.isVerified })}>{d.isVerified ? 'Unverify' : 'Verify'}</Button>}
      </li>))}</ul>
  )
}

export default function Tenants() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sel, setSel] = useState<number | null>(null)
  const q = useQuery({ queryKey: ['tenants', search, page], placeholderData: keepPreviousData, queryFn: () => api.get<Paged<TenantListItem>>('/tenants', { search, page, pageSize: 10 }) })
  const t = useQuery({ queryKey: ['tenant', sel], enabled: sel != null, queryFn: () => api.get<TenantProfile>(`/tenants/${sel}`) })

  return (<>
    <PageHeader title="Tenants" subtitle="People renting from, or applying to, your properties" actions={<SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search name or email…" />} />
    <Card className="overflow-hidden">
      {q.isLoading ? <TableSkeleton /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : q.data!.items.length === 0 ? <EmptyState icon={<Users className="size-7" />} title="No tenants yet" />
        : (<Table><thead><tr><Th>Tenant</Th><Th>Current home</Th><Th>Occupation</Th><Th>Leases</Th><Th>Outstanding</Th></tr></thead>
          <tbody>{q.data!.items.map((x) => (
            <Tr key={x.id} onClick={() => setSel(x.id)}>
              <Td><div className="flex items-center gap-3"><Avatar name={x.fullName} size={34} /><div><p className="font-bold">{x.fullName}</p><p className="text-muted text-xs">{x.email}</p></div></div></Td>
              <Td>{x.currentProperty ? `${x.currentProperty} · ${x.currentUnit}` : <span className="text-muted">-</span>}</Td><Td>{x.occupation ?? '-'}</Td><Td>{x.leaseCount}</Td>
              <Td className={x.outstanding > 0 ? 'font-semibold text-rose-500' : 'text-muted'}>{money(x.outstanding)}</Td></Tr>))}</tbody></Table>)}
      {q.data && <Pagination page={q.data.page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} />}
    </Card>
    <Modal open={sel != null} onClose={() => setSel(null)} wide title="Tenant profile">
      {t.isLoading || !t.data ? <PageLoader /> : (<div className="space-y-6">
        <div className="flex items-center gap-4"><Avatar name={t.data.fullName} size={56} /><div><h3 className="text-xl font-bold">{t.data.fullName}</h3><p className="text-muted text-sm">{t.data.email}{t.data.phone ? ` · ${t.data.phone}` : ''}</p></div></div>
        <KeyValue items={[{ k: 'Occupation', v: t.data.occupation }, { k: 'Employer', v: t.data.employer }, { k: 'Monthly income', v: t.data.monthlyIncome ? money(t.data.monthlyIncome) : '-' }, { k: 'Date of birth', v: date(t.data.dateOfBirth) },
          { k: 'ID proof', v: t.data.idProofType ? `${label(t.data.idProofType)} · ${t.data.idProofNumber ?? ''}` : '-' }, { k: 'Emergency contact', v: t.data.emergencyContactName ? `${t.data.emergencyContactName} · ${t.data.emergencyContactPhone ?? ''}` : '-' }, { k: 'Permanent address', v: t.data.permanentAddress }]} />
        <div><h4 className="mb-3 font-bold">Verification documents</h4><TenantDocs docs={t.data.documents} canVerify tenantId={t.data.id} /></div>
      </div>)}
    </Modal>
  </>)
}
