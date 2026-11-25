import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Building2, MapPin, Plus } from 'lucide-react'
import { api } from '../../lib/api'
import type { Paged, PropertyListItem } from '../../lib/types'
import { useAuth } from '../../lib/providers'
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Pagination, SearchBox, Select, Skeleton } from '../../components/ui'
import { Cover } from '../../components/UnitCardView'
import { PropertyFormModal } from './PropertyDetail'
import { label, money } from '../../lib/format'

export default function Properties() {
  const { hasRole } = useAuth()
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const q = useQuery({ queryKey: ['properties', search, type, page], placeholderData: keepPreviousData, queryFn: () => api.get<Paged<PropertyListItem>>('/properties', { Search: search, Type: type, Page: page, PageSize: 9 }) })
  const canCreate = hasRole('SuperAdmin', 'Owner')

  return (<>
    <PageHeader title="Properties" subtitle="Buildings and communities you manage" actions={canCreate && <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Add property</Button>} />
    <div className="mb-6 flex flex-wrap gap-3">
      <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search properties..." />
      <Select className="w-44" value={type} onChange={(e) => { setType(e.target.value); setPage(1) }} aria-label="Type"><option value="">All types</option>{['apartment', 'house', 'villa', 'studio', 'hostel'].map((t) => <option key={t} value={t}>{label(t)}</option>)}</Select>
    </div>
    {q.isLoading ? <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-80" />)}</div>
      : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} />
      : q.data!.items.length === 0 ? <Card><EmptyState icon={<Building2 className="size-7" />} title="No properties yet" text="Add your first property to start managing units, tenants and rent." action={canCreate && <Button onClick={() => setCreating(true)}>Add property</Button>} /></Card>
      : (<>
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {q.data!.items.map((p) => {
            const pct = p.totalUnits ? Math.round((100 * p.occupiedUnits) / p.totalUnits) : 0
            return (
              <Link key={p.id} to={`/app/properties/${p.id}`} className="surface group overflow-hidden rounded-2xl shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
                <div className="relative h-40 overflow-hidden"><Cover src={p.coverImage} seed={p.id} alt={p.name} className="size-full transition-transform duration-700 group-hover:scale-110" />
                  <span className="glass absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-semibold">{label(p.propertyType)}</span>
                  {!p.isActive && <span className="absolute top-3 right-3"><Badge color="red">Inactive</Badge></span>}</div>
                <div className="p-5">
                  <h3 className="text-lg font-bold">{p.name}</h3>
                  <p className="text-muted mt-1 flex items-center gap-1.5 text-sm"><MapPin className="size-4" />{p.city}, {p.state}</p>
                  <div className="mt-4"><div className="mb-1.5 flex justify-between text-xs"><span className="text-muted">Occupancy</span><b>{p.occupiedUnits}/{p.totalUnits} · {pct}%</b></div>
                    <div className="surface-2 h-2 overflow-hidden rounded-full"><div className="gradient-brand h-full rounded-full" style={{ width: `${pct}%` }} /></div></div>
                  <div className="text-muted mt-4 flex items-center justify-between border-t border-base pt-4 text-xs">
                    <span>{p.minRent != null ? `${money(p.minRent)} – ${money(p.maxRent)}` : 'No units yet'}</span><span>Mgr: {p.managerName ?? 'Unassigned'}</span></div>
                </div>
              </Link>
            )
          })}
        </div>
        <Card className="mt-6 overflow-hidden"><Pagination page={q.data!.page} pageSize={q.data!.pageSize} total={q.data!.total} onPage={setPage} /></Card>
      </>)}
    <PropertyFormModal open={creating} onClose={() => setCreating(false)} />
  </>)
}
