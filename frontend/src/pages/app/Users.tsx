import { useState } from 'react'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Plus, ShieldCheck } from 'lucide-react'
import { api } from '../../lib/api'
import type { Paged, User } from '../../lib/types'
import { useAuth, useToast } from '../../lib/providers'
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Pagination, SearchBox, Select, Table, TableSkeleton, Td, Th, Tr } from '../../components/ui'
import { date } from '../../lib/format'

export default function UsersPage() {
  const { hasRole, user: me } = useAuth()
  const toast = useToast(); const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const admin = hasRole('SuperAdmin')
  const blank = { fullName: '', email: '', phone: '', password: '', role: 'Manager' }
  const [f, setF] = useState(blank)
  const q = useQuery({ queryKey: ['users', search, role, page], placeholderData: keepPreviousData, queryFn: () => api.get<Paged<User>>('/users', { search, role, page, pageSize: 10 }) })
  const create = useMutation({ mutationFn: () => api.post('/users', f), onSuccess: () => { toast.success('Account created'); setOpen(false); setF(blank); qc.invalidateQueries({ queryKey: ['users'] }) }, onError: (e: Error) => toast.error(e.message) })
  const toggle = useMutation({ mutationFn: (u: User) => api.patch(`/users/${u.id}/active`, { active: !u.isActive }), onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }), onError: (e: Error) => toast.error(e.message) })
  const roles = admin ? ['SuperAdmin', 'Owner', 'Manager', 'Tenant', 'MaintenanceStaff'] : ['Manager', 'MaintenanceStaff']

  return (<>
    <PageHeader title="Team & users" subtitle={admin ? 'Every account on the platform' : 'Managers and maintenance staff you have added'} actions={<Button icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>Add user</Button>} />
    <div className="mb-5 flex flex-wrap gap-3"><SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search name or email…" />
      <Select className="w-48" value={role} onChange={(e) => { setRole(e.target.value); setPage(1) }} aria-label="Role"><option value="">All roles</option>{roles.map((r) => <option key={r} value={r}>{r}</option>)}</Select></div>
    <Card className="overflow-hidden">
      {q.isLoading ? <TableSkeleton /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : q.data!.items.length === 0 ? <EmptyState icon={<ShieldCheck className="size-7" />} title="No users yet" text="Add a manager or maintenance staff member to get started." action={<Button onClick={() => setOpen(true)}>Add user</Button>} />
        : (<Table><thead><tr><Th>User</Th><Th>Roles</Th><Th>Joined</Th><Th>Status</Th><Th /></tr></thead>
          <tbody>{q.data!.items.map((u) => (
            <Tr key={u.id}><Td><div className="flex items-center gap-3"><Avatar name={u.fullName} size={34} /><div><p className="font-bold">{u.fullName}</p><p className="text-muted text-xs">{u.email}{u.phone ? ` · ${u.phone}` : ''}</p></div></div></Td>
              <Td><div className="flex flex-wrap gap-1.5">{u.roles.map((r) => <Badge key={r} color="violet">{r}</Badge>)}</div></Td><Td>{date(u.createdAt)}</Td>
              <Td>{u.isActive ? <Badge color="green" dot>Active</Badge> : <Badge color="red" dot>Disabled</Badge>}</Td>
              <Td className="text-right">{u.id !== me?.id && <Button size="sm" variant={u.isActive ? 'danger' : 'soft'} onClick={() => toggle.mutate(u)}>{u.isActive ? 'Deactivate' : 'Activate'}</Button>}</Td></Tr>))}</tbody></Table>)}
      {q.data && <Pagination page={q.data.page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} />}
    </Card>
    <Modal open={open} onClose={() => setOpen(false)} title="Add user" footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button loading={create.isPending} disabled={!f.fullName || !f.email || f.password.length < 8} onClick={() => create.mutate()}>Create account</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name"><Input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></Field>
        <Field label="Role"><Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{roles.filter((r) => r !== 'SuperAdmin').map((r) => <option key={r} value={r}>{r}</option>)}</Select></Field>
        <Field label="Email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Temporary password" hint="At least 8 characters. Ask them to change it after signing in." className="sm:col-span-2"><Input type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
      </div>
    </Modal>
  </>)
}
