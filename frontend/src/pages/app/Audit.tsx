import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { ScrollText } from 'lucide-react'
import { api } from '../../lib/api'
import type { AuditLog, Paged } from '../../lib/types'
import { Badge, Card, EmptyState, ErrorState, PageHeader, Pagination, Select, Table, TableSkeleton, Td, Th, Tr } from '../../components/ui'
import { dateTime, label } from '../../lib/format'

export default function Audit() {
  const [entity, setEntity] = useState('')
  const [page, setPage] = useState(1)
  const q = useQuery({ queryKey: ['audit', entity, page], placeholderData: keepPreviousData, queryFn: () => api.get<Paged<AuditLog>>('/audit-logs', { entity, page, pageSize: 15 }) })
  const tone = (a: string) => (['create', 'approved', 'register', 'verify', 'refund'].includes(a) ? 'green' : ['delete', 'terminate', 'rejected', 'deactivate', 'forfeit'].includes(a) ? 'red' : 'blue') as 'green' | 'red' | 'blue'
  return (<>
    <PageHeader title="Audit log" subtitle="Important activity recorded by the application and by database triggers" actions={
      <Select className="w-48" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1) }} aria-label="Entity"><option value="">All entities</option>{['user', 'property', 'unit', 'lease', 'lease_terms', 'payment', 'rental_application', 'deposit', 'expense', 'rent_invoice'].map((x) => <option key={x} value={x}>{label(x)}</option>)}</Select>} />
    <Card className="overflow-hidden">
      {q.isLoading ? <TableSkeleton rows={10} /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : q.data!.items.length === 0 ? <EmptyState icon={<ScrollText className="size-7" />} title="No activity yet" />
        : (<Table><thead><tr><Th>When</Th><Th>Who</Th><Th>Action</Th><Th>Entity</Th><Th>Details</Th></tr></thead>
          <tbody>{q.data!.items.map((a) => (
            <Tr key={a.id}><Td className="whitespace-nowrap">{dateTime(a.createdAt)}</Td><Td>{a.userName ?? <span className="text-muted">System / trigger</span>}</Td><Td><Badge color={tone(a.action)}>{label(a.action)}</Badge></Td>
              <Td>{label(a.entity)}{a.entityId ? ` #${a.entityId}` : ''}</Td><Td className="text-muted max-w-xs truncate font-mono text-xs">{a.details ?? '-'}</Td></Tr>))}</tbody></Table>)}
      {q.data && <Pagination page={q.data.page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} />}
    </Card>
  </>)
}
