import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { PublicUnitDetail, UnitTour } from '../../lib/types'
import { ErrorState, PageLoader } from '../../components/ui'
import { label, money } from '../../lib/format'
import { buildTour } from '../../features/tour/buildTour'
import HouseTour from '../../features/tour/HouseTour'

/** Full-screen, scroll-driven walk through one unit: outside -> front door -> every room -> back outside. */
export default function Tour() {
  const { id } = useParams()
  const unit = useQuery({ queryKey: ['public-unit', id], queryFn: () => api.get<PublicUnitDetail>(`/public/units/${id}`, undefined, false) })
  // A missing/failed custom tour is not an error - we fall back to the built-in photo library.
  const custom = useQuery({ queryKey: ['public-unit-tour', id], retry: false,
    queryFn: () => api.get<UnitTour>(`/public/units/${id}/tour`, undefined, false).catch(() => null) })

  const stops = useMemo(() => (unit.data && !custom.isLoading ? buildTour(unit.data, custom.data) : null), [unit.data, custom.data, custom.isLoading])

  if (unit.isError) return <div className="mx-auto max-w-3xl px-4 py-16"><ErrorState error={unit.error} retry={() => unit.refetch()} /></div>
  if (!unit.data || !stops) return <div className="flex min-h-screen items-center justify-center bg-black"><PageLoader /></div>

  const c = unit.data.card
  return (
    <HouseTour stops={stops} detailsHref={`/units/${c.unitId}`} rentLabel={money(c.monthlyRent)}
      heading={`${c.propertyName} · Unit ${c.unitNumber}`}
      subheading={[label(c.propertyType), c.propertyType === 'studio' ? `${Number(c.areaSqft)} sq ft` : `${c.bedrooms} bed · ${c.bathrooms} bath`, c.city].join(' · ')} />
  )
}
