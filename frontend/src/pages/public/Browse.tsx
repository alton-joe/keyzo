import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { SlidersHorizontal, SearchX } from 'lucide-react'
import { api } from '../../lib/api'
import type { Paged, UnitCard } from '../../lib/types'
import { Button, EmptyState, ErrorState, Field, Input, Pagination, Select, Skeleton } from '../../components/ui'
import { UnitCardView } from '../../components/UnitCardView'
import { Reveal, Stagger, StaggerItem } from '../../components/motion'

export default function Browse() {
  const [params] = useSearchParams()
  const [f, setF] = useState({ q: '', city: params.get('city') ?? '', type: '', bedrooms: '', minRent: '', maxRent: '', sort: 'newest', page: 1 })
  const [showFilters, setShowFilters] = useState(false)
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v, page: 1 }))

  const cities = useQuery({ queryKey: ['cities'], queryFn: () => api.get<string[]>('/public/cities', undefined, false) })
  const q = useQuery({
    queryKey: ['units', f], placeholderData: keepPreviousData,
    queryFn: () => api.get<Paged<UnitCard>>('/public/units', { Q: f.q, City: f.city, Type: f.type, Bedrooms: f.bedrooms, MinRent: f.minRent, MaxRent: f.maxRent, Sort: f.sort, Page: f.page, PageSize: 9 }, false),
  })

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <Reveal>
        <h1 className="text-4xl font-extrabold sm:text-5xl">Find your next <span className="gradient-text">home</span></h1>
        <p className="text-muted mt-3 max-w-2xl text-lg">Browse verified, ready-to-rent homes. Apply online in minutes.</p>
      </Reveal>

      <div className="surface mt-8 rounded-2xl p-4 shadow-soft">
        <div className="flex flex-wrap gap-3">
          <Input className="min-w-56 flex-1" placeholder="Search by property, area or city" value={f.q} onChange={(e) => set('q', e.target.value)} aria-label="Search" />
          <Select className="w-44" value={f.city} onChange={(e) => set('city', e.target.value)} aria-label="City">
            <option value="">All cities</option>{cities.data?.map((c) => <option key={c}>{c}</option>)}
          </Select>
          <Select className="w-44" value={f.sort} onChange={(e) => set('sort', e.target.value)} aria-label="Sort">
            <option value="newest">Newest</option><option value="rent_asc">Rent: low to high</option><option value="rent_desc">Rent: high to low</option><option value="area_desc">Largest first</option>
          </Select>
          <Button variant="secondary" icon={<SlidersHorizontal className="size-4" />} onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>Filters</Button>
        </div>
        {showFilters && (
          <div className="mt-4 grid gap-3 border-t border-base pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Property type"><Select value={f.type} onChange={(e) => set('type', e.target.value)}><option value="">Any</option>{['apartment', 'house', 'villa', 'studio', 'hostel'].map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}</Select></Field>
            <Field label="Bedrooms"><Select value={f.bedrooms} onChange={(e) => set('bedrooms', e.target.value)}><option value="">Any</option>{[1, 2, 3].map((b) => <option key={b} value={b}>{b}</option>)}<option value="4">4+</option></Select></Field>
            <Field label="Min rent (₹)"><Input type="number" min={0} value={f.minRent} onChange={(e) => set('minRent', e.target.value)} placeholder="0" /></Field>
            <Field label="Max rent (₹)"><Input type="number" min={0} value={f.maxRent} onChange={(e) => set('maxRent', e.target.value)} placeholder="No limit" /></Field>
          </div>
        )}
      </div>

      <div className="mt-8">
        {q.isLoading ? <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-96" />)}</div>
          : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} />
          : q.data!.items.length === 0 ? <EmptyState icon={<SearchX className="size-7" />} title="No homes match your search" text="Try widening the filters or clearing the search." action={<Button variant="secondary" onClick={() => setF({ q: '', city: '', type: '', bedrooms: '', minRent: '', maxRent: '', sort: 'newest', page: 1 })}>Clear filters</Button>} />
          : (
            <>
              <p className="text-muted mb-4 text-sm">{q.data!.total} homes found</p>
              <Stagger key={`${f.page}-${q.data!.total}`} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {q.data!.items.map((u) => <StaggerItem key={u.unitId}><UnitCardView u={u} /></StaggerItem>)}
              </Stagger>
              <div className="surface mt-8 overflow-hidden rounded-2xl"><Pagination page={q.data!.page} pageSize={q.data!.pageSize} total={q.data!.total} onPage={(p) => { setF((s) => ({ ...s, page: p })); window.scrollTo({ top: 0, behavior: 'smooth' }) }} /></div>
            </>
          )}
      </div>
    </div>
  )
}
