import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Bath, BedDouble, Check, DoorOpen, Layers, MapPin, Maximize2, ShieldCheck } from 'lucide-react'
import { fallbackGallery } from '../../features/tour/buildTour'
import { api } from '../../lib/api'
import type { PublicUnitDetail } from '../../lib/types'
import { useAuth, useToast } from '../../lib/providers'
import { Button, Card, ErrorState, Field, Input, Modal, PageLoader, Select, Textarea } from '../../components/ui'
import { Cover } from '../../components/UnitCardView'
import { Reveal } from '../../components/motion'
import { label, money, toISODate } from '../../lib/format'

export default function UnitDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const [img, setImg] = useState(0)
  const [open, setOpen] = useState(false)
  const tomorrow = toISODate(new Date(Date.now() + 86400000 * 7))
  const [form, setForm] = useState({ desiredMoveIn: tomorrow, leaseMonths: 11, occupants: 1, message: '' })

  const q = useQuery({ queryKey: ['public-unit', id], queryFn: () => api.get<PublicUnitDetail>(`/public/units/${id}`, undefined, false) })
  const apply = useMutation({
    mutationFn: () => api.post('/applications', { unitId: Number(id), ...form, leaseMonths: Number(form.leaseMonths), occupants: Number(form.occupants) }),
    onSuccess: () => { toast.success('Application submitted! We will notify you of the decision.'); setOpen(false); nav('/app/applications') },
    onError: (e: Error) => toast.error(e.message),
  })

  if (q.isLoading) return <PageLoader />
  if (q.isError) return <div className="mx-auto max-w-3xl px-4 py-16"><ErrorState error={q.error} retry={() => q.refetch()} /></div>
  const d = q.data!, c = d.card
  const images = d.images.length > 0 ? d.images : fallbackGallery(d)
  const tourHref = `/units/${c.unitId}/tour`

  const cta = () => {
    if (d.reserved) return <p className="surface-2 rounded-xl p-4 text-center text-sm font-medium">This home has been reserved and is not taking applications right now.</p>
    if (!user) return <Link to="/login" state={{ from: `/units/${id}` }}><Button size="lg" className="w-full">Sign in to apply</Button></Link>
    if (hasRole('Tenant')) return <Button size="lg" className="w-full" onClick={() => setOpen(true)}>Apply for this home</Button>
    return <p className="text-muted surface-2 rounded-xl p-4 text-center text-sm">Only tenant accounts can apply for homes.</p>
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Link to="/units" className="text-muted hover:text-brand-500 mb-6 inline-flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="size-4" />Back to homes</Link>
      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl shadow-lift">
              <Cover src={images[img]} seed={c.propertyId} alt={c.propertyName} className="h-72 w-full sm:h-[26rem]" />
              <Link to={tourHref} className="group absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 rounded-2xl bg-black/50 px-4 py-3 text-white backdrop-blur-md transition hover:bg-black/65 sm:inset-x-auto sm:right-4 sm:left-auto">
                <span className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-white/15"><DoorOpen className="size-5" /></span>
                  <span><span className="block text-sm font-bold">Take the house tour</span><span className="block text-xs text-white/75">Walk room to room as you scroll</span></span></span>
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            {images.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto">{images.map((s, i) => <button key={s} onClick={() => setImg(i)} aria-label={`Photo ${i + 1}`} className={`h-16 w-24 shrink-0 overflow-hidden rounded-xl border-2 ${i === img ? 'border-brand-500' : 'border-transparent opacity-70'}`}><img src={s.startsWith('/tour/') ? s.replace(/\.webp$/, '-sm.webp') : s} alt="" className="size-full object-cover" /></button>)}</div>}
          </Reveal>
          <Reveal delay={0.05} className="mt-8">
            <p className="text-brand-500 text-sm font-bold tracking-wide uppercase">{label(c.propertyType)}</p>
            <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">{c.propertyName} <span className="text-muted">· Unit {c.unitNumber}</span></h1>
            <p className="text-muted mt-2 flex items-center gap-2"><MapPin className="size-4" />{d.addressLine}, {c.city}, {c.state} {d.postalCode}</p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[[BedDouble, `${c.bedrooms} Bedrooms`], [Bath, `${c.bathrooms} Bathrooms`], [Maximize2, `${c.areaSqft} sqft`], [Layers, d.floorNo === 0 ? 'Ground floor' : `Floor ${d.floorNo}`]].map(([I, t], i) => {
                const Icon = I as typeof BedDouble
                return <div key={i} className="surface flex items-center gap-3 rounded-2xl p-4"><Icon className="text-brand-500 size-5" /><span className="text-sm font-semibold">{t as string}</span></div>
              })}
            </div>
          </Reveal>
          <Reveal className="mt-8"><h2 className="text-xl font-bold">About this home</h2>
            <p className="text-muted mt-3 leading-relaxed">{d.description ?? 'A well-kept home in a managed property.'}</p>
            {d.propertyDescription && <p className="text-muted mt-3 leading-relaxed">{d.propertyDescription}</p>}</Reveal>
          {d.amenities.length > 0 && (
            <Reveal className="mt-8"><h2 className="text-xl font-bold">Amenities</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">{d.amenities.map((a) => <li key={a.id} className="flex items-center gap-3 text-sm font-medium"><span className="flex size-7 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-500"><Check className="size-4" /></span>{a.name}</li>)}</ul></Reveal>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Reveal>
            <Card className="p-6">
              <p className="text-muted text-sm">Monthly rent</p>
              <p className="font-display text-4xl font-extrabold">{money(c.monthlyRent)}</p>
              <div className="mt-5 space-y-3 border-t border-base pt-5 text-sm">
                <div className="flex justify-between"><span className="text-muted">Security deposit</span><b>{money(c.depositAmount)}</b></div>
                <div className="flex justify-between"><span className="text-muted">Typical lease</span><b>11 months</b></div>
                {d.otherAvailableUnits > 0 && <div className="flex justify-between"><span className="text-muted">Other units here</span><b>{d.otherAvailableUnits} available</b></div>}
              </div>
              <div className="mt-6 space-y-3">{cta()}
                <Link to={tourHref}><Button size="lg" variant="secondary" className="w-full" icon={<DoorOpen className="size-5" />}>Take the house tour</Button></Link>
              </div>
              <p className="text-muted mt-4 flex items-center justify-center gap-2 text-xs"><ShieldCheck className="size-4 text-emerald-500" />Secure, no-fee online application</p>
            </Card>
          </Reveal>
        </aside>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={`Apply for ${c.propertyName} - ${c.unitNumber}`}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button loading={apply.isPending} onClick={() => apply.mutate()}>Submit application</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Desired move-in"><Input type="date" min={toISODate(new Date())} value={form.desiredMoveIn} onChange={(e) => setForm({ ...form, desiredMoveIn: e.target.value })} /></Field>
          <Field label="Lease length (months)"><Select value={form.leaseMonths} onChange={(e) => setForm({ ...form, leaseMonths: Number(e.target.value) })}>{[6, 11, 12, 24].map((m) => <option key={m} value={m}>{m} months</option>)}</Select></Field>
          <Field label="Occupants"><Input type="number" min={1} max={20} value={form.occupants} onChange={(e) => setForm({ ...form, occupants: Number(e.target.value) })} /></Field>
          <div />
          <Field label="Message to the manager" className="sm:col-span-2" hint="Upload ID and income proof from My profile to speed up approval."><Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} maxLength={1000} placeholder="Tell us a little about yourself..." /></Field>
        </div>
      </Modal>
    </div>
  )
}
