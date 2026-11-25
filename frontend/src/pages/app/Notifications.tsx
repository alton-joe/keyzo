import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { api } from '../../lib/api'
import type { Notification, Paged } from '../../lib/types'
import { Button, Card, EmptyState, ErrorState, PageHeader, Pagination, TableSkeleton, Tabs } from '../../components/ui'
import { timeAgo } from '../../lib/format'

export default function Notifications() {
  const qc = useQueryClient(); const nav = useNavigate()
  const [unread, setUnread] = useState(false)
  const [page, setPage] = useState(1)
  const q = useQuery({ queryKey: ['notifications', unread, page], placeholderData: keepPreviousData, queryFn: () => api.get<Paged<Notification>>('/notifications', { unreadOnly: unread, page, pageSize: 15 }) })
  const refresh = () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['unread'] }); qc.invalidateQueries({ queryKey: ['notif-preview'] }) }
  const all = useMutation({ mutationFn: () => api.post('/notifications/read-all'), onSuccess: refresh })
  const go = async (n: Notification) => { if (!n.isRead) { await api.post(`/notifications/${n.id}/read`); refresh() } if (n.link) nav(n.link) }
  return (<>
    <PageHeader title="Notifications" subtitle="Rent reminders, lease updates and repair progress" actions={<Button variant="secondary" icon={<CheckCheck className="size-4" />} loading={all.isPending} onClick={() => all.mutate()}>Mark all read</Button>} />
    <div className="mb-5"><Tabs value={unread ? 'unread' : 'all'} onChange={(v) => { setUnread(v === 'unread'); setPage(1) }} tabs={[{ value: 'all', label: 'All' }, { value: 'unread', label: 'Unread' }]} /></div>
    <Card className="overflow-hidden">
      {q.isLoading ? <TableSkeleton /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : q.data!.items.length === 0 ? <EmptyState icon={<Bell className="size-7" />} title="You are all caught up" />
        : (<ul className="divide-y divide-[var(--border)]">{q.data!.items.map((n) => (
          <li key={n.id}><button onClick={() => go(n)} className="flex w-full cursor-pointer gap-4 px-5 py-4 text-left transition hover:bg-[var(--surface-2)]/60">
            <span className={`mt-2 size-2.5 shrink-0 rounded-full ${n.isRead ? 'bg-[var(--border)]' : 'bg-brand-500'}`} />
            <span className="min-w-0 flex-1"><span className={`block ${n.isRead ? 'font-medium' : 'font-bold'}`}>{n.title}</span><span className="text-muted block text-sm">{n.message}</span></span>
            <span className="text-muted shrink-0 text-xs">{timeAgo(n.createdAt)}</span></button></li>))}</ul>)}
      {q.data && <Pagination page={q.data.page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} />}
    </Card>
  </>)
}
