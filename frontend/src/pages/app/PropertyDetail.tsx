import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ImagePlus, MapPin, Pencil, Plus, Star, Trash2, Upload } from 'lucide-react'
import { api } from '../../lib/api'
import type { Amenity, PropertyDetail, Unit, UserLookup } from '../../lib/types'
import { useAuth, useToast } from '../../lib/providers'
import { Badge, Button, Card, CardHeader, Confirm, EmptyState, ErrorState, Field, Input, Modal, PageHeader, PageLoader, Select, StatusBadge, Table, Td, Textarea, Th, Tr } from '../../components/ui'
import { CoverArt } from '../../components/UnitCardView'
import { label, money } from '../../lib/format'

const types = ['apartment', 'house', 'villa', 'studio', 'hostel']

export function PropertyFormModal({ open, onClose, property }: { open: boolean; onClose: () => void; property?: PropertyDetail }) {
  const { hasRole } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const nav = useNavigate()
  const blank = { name: '', description: '', propertyType: 'apartment', addressLine: '', city: '', state: '', postalCode: '', country: 'India', ownerId: '', managerId: '', amenityIds: [] as number[] }
  const [f, setF] = useState(blank)
  const amenities = useQuery({ queryKey: ['amenities'], queryFn: () => api.get<Amenity[]>('/amenities', undefined, false), enabled: open })
  const managers = useQuery({ queryKey: ['lookup', 'Manager'], queryFn: () => api.get<UserLookup[]>('/users/lookup/Manager'), enabled: open && hasRole('SuperAdmin', 'Owner') })
  const owners = useQuery({ queryKey: ['lookup', 'Owner'], queryFn: () => api.get<UserLookup[]>('/users/lookup/Owner'), enabled: open && hasRole('SuperAdmin') && !property })

  useEffect(() => {
    if (!open) return
    setF(property ? { name: property.name, description: property.description ?? '', propertyType: property.propertyType, addressLine: property.addressLine, city: property.city, state: property.state, postalCode: property.postalCode, country: property.country, ownerId: String(property.ownerId), managerId: property.managerId ? String(property.managerId) : '', amenityIds: property.amenities.map((a) => a.id) } : blank)
  }, [open, property]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: () => {
      const body = { ...f, ownerId: f.ownerId ? Number(f.ownerId) : null, managerId: f.managerId ? Number(f.managerId) : null }
      return property ? api.put<PropertyDetail>(`/properties/${property.id}`, body) : api.post<PropertyDetail>('/properties', body)
    },
    onSuccess: (p) => { toast.success(property ? 'Property updated' : 'Property created'); qc.invalidateQueries({ queryKey: ['properties'] }); qc.invalidateQueries({ queryKey: ['property', String(p.id)] }); onClose(); if (!property) nav(`/app/properties/${p.id}`) },
    onError: (e: Error) => toast.error(e.message),
  })
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })
  const toggle = (id: number) => setF({ ...f, amenityIds: f.amenityIds.includes(id) ? f.amenityIds.filter((x) => x !== id) : [...f.amenityIds, id] })

  return (
    <Modal open={open} onClose={onClose} wide title={property ? 'Edit property' : 'Add property'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()} disabled={!f.name || !f.addressLine || !f.city || !f.state || !f.postalCode}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Property name"><Input value={f.name} onChange={set('name')} maxLength={150} /></Field>
        <Field label="Type"><Select value={f.propertyType} onChange={set('propertyType')}>{types.map((t) => <option key={t} value={t}>{label(t)}</option>)}</Select></Field>
        <Field label="Address" className="sm:col-span-2"><Input value={f.addressLine} onChange={set('addressLine')} maxLength={250} /></Field>
        <Field label="City"><Input value={f.city} onChange={set('city')} /></Field>
        <Field label="State"><Input value={f.state} onChange={set('state')} /></Field>
        <Field label="Postal code"><Input value={f.postalCode} onChange={set('postalCode')} maxLength={12} /></Field>
        <Field label="Country"><Input value={f.country} onChange={set('country')} /></Field>
        {hasRole('SuperAdmin') && !property && <Field label="Owner"><Select value={f.ownerId} onChange={set('ownerId')}><option value="">Select owner…</option>{owners.data?.map((o) => <option key={o.id} value={o.id}>{o.fullName}</option>)}</Select></Field>}
        {hasRole('SuperAdmin', 'Owner') && <Field label="Manager" hint="Optional"><Select value={f.managerId} onChange={set('managerId')}><option value="">Unassigned</option>{managers.data?.map((m) => <option key={m.id} value={m.id}>{m.fullName}</option>)}</Select></Field>}
        <Field label="Description" className="sm:col-span-2"><Textarea value={f.description} onChange={set('description')} maxLength={4000} /></Field>
        <div className="sm:col-span-2"><p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Amenities</p>
          <div className="flex flex-wrap gap-2">{amenities.data?.map((a) => (
            <button type="button" key={a.id} onClick={() => toggle(a.id)} aria-pressed={f.amenityIds.includes(a.id)} className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${f.amenityIds.includes(a.id) ? 'border-brand-500 bg-brand-500/12 text-brand-600 dark:text-brand-300' : 'border-base text-muted hover:border-brand-300'}`}>{a.name}</button>))}</div></div>
      </div>
    </Modal>
  )
}

function UnitModal({ open, onClose, propertyId, unit }: { open: boolean; onClose: () => void; propertyId: number; unit?: Unit }) {
  const toast = useToast(); const qc = useQueryClient()
  const blank = { unitNumber: '', floorNo: 0, bedrooms: 1, bathrooms: 1, areaSqft: 600, monthlyRent: 15000, depositAmount: 30000, status: 'available', description: '' }
  const [f, setF] = useState(blank)
  useEffect(() => { if (open) setF(unit ? { unitNumber: unit.unitNumber, floorNo: unit.floorNo, bedrooms: unit.bedrooms, bathrooms: unit.bathrooms, areaSqft: unit.areaSqft, monthlyRent: unit.monthlyRent, depositAmount: unit.depositAmount, status: unit.status, description: unit.description ?? '' } : blank) }, [open, unit]) // eslint-disable-line react-hooks/exhaustive-deps
  const save = useMutation({
    mutationFn: () => unit ? api.put(`/properties/units/${unit.id}`, f) : api.post(`/properties/${propertyId}/units`, f),
    onSuccess: () => { toast.success(unit ? 'Unit updated' : 'Unit added'); qc.invalidateQueries({ queryKey: ['property', String(propertyId)] }); onClose() },
    onError: (e: Error) => toast.error(e.message),
  })
  const n = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: Number(e.target.value) })
  return (
    <Modal open={open} onClose={onClose} title={unit ? `Edit unit ${unit.unitNumber}` : 'Add unit'} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} disabled={!f.unitNumber} onClick={() => save.mutate()}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Unit number"><Input value={f.unitNumber} onChange={(e) => setF({ ...f, unitNumber: e.target.value })} maxLength={20} /></Field>
        <Field label="Floor"><Input type="number" value={f.floorNo} onChange={n('floorNo')} /></Field>
        <Field label="Bedrooms"><Input type="number" min={0} max={20} value={f.bedrooms} onChange={n('bedrooms')} /></Field>
        <Field label="Bathrooms"><Input type="number" min={0} max={20} value={f.bathrooms} onChange={n('bathrooms')} /></Field>
        <Field label="Area (sqft)"><Input type="number" min={1} value={f.areaSqft} onChange={n('areaSqft')} /></Field>
        <Field label="Status" hint={unit?.status === 'occupied' ? 'Occupancy follows the lease' : undefined}>
          <Select value={f.status} disabled={unit?.status === 'occupied'} onChange={(e) => setF({ ...f, status: e.target.value })}>{unit?.status === 'occupied' && <option value="occupied">Occupied</option>}<option value="available">Available</option><option value="maintenance">Under maintenance</option><option value="inactive">Inactive</option></Select></Field>
        <Field label="Monthly rent (₹)"><Input type="number" min={1} value={f.monthlyRent} onChange={n('monthlyRent')} /></Field>
        <Field label="Security deposit (₹)"><Input type="number" min={0} value={f.depositAmount} onChange={n('depositAmount')} /></Field>
        <Field label="Description" className="sm:col-span-2"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={500} /></Field>
      </div>
    </Modal>
  )
}

export default function PropertyDetailPage() {
  const { id } = useParams()
  const { hasRole } = useAuth()
  const toast = useToast(); const qc = useQueryClient()
  const [edit, setEdit] = useState(false)
  const [unitModal, setUnitModal] = useState<{ open: boolean; unit?: Unit }>({ open: false })
  const [del, setDel] = useState<Unit | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const q = useQuery({ queryKey: ['property', id], queryFn: () => api.get<PropertyDetail>(`/properties/${id}`) })
  const refresh = () => qc.invalidateQueries({ queryKey: ['property', id] })
  const owner = hasRole('SuperAdmin', 'Owner')

  const upload = useMutation({
    mutationFn: (files: FileList) => { const fd = new FormData(); Array.from(files).forEach((f) => fd.append('files', f)); return api.upload(`/properties/${id}/images`, fd) },
    onSuccess: () => { toast.success('Photos uploaded'); refresh() }, onError: (e: Error) => toast.error(e.message),
  })
  const removeImg = useMutation({ mutationFn: (i: number) => api.del(`/properties/images/${i}`), onSuccess: () => { refresh() }, onError: (e: Error) => toast.error(e.message) })
  const cover = useMutation({ mutationFn: (i: number) => api.patch(`/properties/images/${i}/cover`), onSuccess: refresh })
  const toggleActive = useMutation({ mutationFn: (a: boolean) => api.patch(`/properties/${id}/active`, { active: a }), onSuccess: () => { toast.success('Property updated'); refresh(); qc.invalidateQueries({ queryKey: ['properties'] }) }, onError: (e: Error) => toast.error(e.message) })
  const delUnit = useMutation({ mutationFn: (u: Unit) => api.del(`/properties/units/${u.id}`), onSuccess: () => { toast.success('Unit deleted'); setDel(null); refresh() }, onError: (e: Error) => { toast.error(e.message); setDel(null) } })

  if (q.isLoading) return <PageLoader />
  if (q.isError) return <ErrorState error={q.error} retry={() => q.refetch()} />
  const p = q.data!
  const occupied = p.units.filter((u) => u.status === 'occupied').length

  return (<>
    <Link to="/app/properties" className="text-muted hover:text-brand-500 mb-4 inline-flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="size-4" />All properties</Link>
    <PageHeader title={p.name} subtitle={`${label(p.propertyType)} · ${p.city}, ${p.state}`}
      actions={<>{!p.isActive && <Badge color="red">Inactive</Badge>}<Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setEdit(true)}>Edit</Button>
        {owner && <Button variant={p.isActive ? 'danger' : 'soft'} loading={toggleActive.isPending} onClick={() => toggleActive.mutate(!p.isActive)}>{p.isActive ? 'Deactivate' : 'Activate'}</Button>}</>} />

    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <Card>
        <CardHeader title="Photos" action={<><input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files?.length && upload.mutate(e.target.files)} />
          <Button size="sm" variant="secondary" icon={<Upload className="size-4" />} loading={upload.isPending} onClick={() => fileRef.current?.click()}>Upload</Button></>} />
        <div className="p-5">
          {p.images.length === 0 ? <div className="relative"><CoverArt seed={p.id} className="h-48 rounded-2xl" /><p className="text-muted mt-3 flex items-center gap-2 text-sm"><ImagePlus className="size-4" />No photos yet - upload some to make this listing shine.</p></div> : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{p.images.map((i) => (
              <div key={i.id} className="group relative aspect-[4/3] overflow-hidden rounded-xl">
                <img src={i.url} alt="" className="size-full object-cover" />
                {i.isCover && <span className="gradient-brand absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-white">COVER</span>}
                <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 p-2 opacity-0 transition group-hover:opacity-100">
                  {!i.isCover && <button onClick={() => cover.mutate(i.id)} aria-label="Make cover" className="rounded-lg bg-white/90 p-1.5 text-slate-800"><Star className="size-4" /></button>}
                  <button onClick={() => removeImg.mutate(i.id)} aria-label="Delete photo" className="rounded-lg bg-white/90 p-1.5 text-rose-600"><Trash2 className="size-4" /></button></div></div>))}</div>)}
        </div>
      </Card>
      <Card className="p-5">
        <h3 className="font-bold">Details</h3>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex gap-3"><MapPin className="text-muted mt-0.5 size-4 shrink-0" /><span>{p.addressLine}, {p.city}, {p.state} {p.postalCode}</span></div>
          <div className="flex justify-between"><dt className="text-muted">Owner</dt><dd className="font-semibold">{p.ownerName}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Manager</dt><dd className="font-semibold">{p.managerName ?? 'Unassigned'}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Occupancy</dt><dd className="font-semibold">{occupied}/{p.units.length} units</dd></div>
        </dl>
        {p.description && <p className="text-muted mt-4 border-t border-base pt-4 text-sm leading-relaxed">{p.description}</p>}
        {p.amenities.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5 border-t border-base pt-4">{p.amenities.map((a) => <span key={a.id} className="surface-2 rounded-full px-2.5 py-1 text-xs font-medium">{a.name}</span>)}</div>}
      </Card>
    </div>

    <Card className="mt-6 overflow-hidden">
      <CardHeader title={`Units (${p.units.length})`} subtitle="Rentable spaces in this property" action={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => setUnitModal({ open: true })}>Add unit</Button>} />
      {p.units.length === 0 ? <EmptyState title="No units yet" text="Add units so tenants can apply." /> : (
        <Table><thead><tr><Th>Unit</Th><Th>Layout</Th><Th>Rent</Th><Th>Deposit</Th><Th>Status</Th><Th>Tenant</Th><Th /></tr></thead>
          <tbody>{p.units.map((u) => (
            <Tr key={u.id}>
              <Td className="font-bold">{u.unitNumber}<span className="text-muted block text-xs font-normal">Floor {u.floorNo}</span></Td>
              <Td>{u.bedrooms} bd · {u.bathrooms} ba · {u.areaSqft} sqft</Td><Td>{money(u.monthlyRent)}</Td><Td>{money(u.depositAmount)}</Td>
              <Td><StatusBadge status={u.status} /></Td><Td>{u.currentTenant ?? <span className="text-muted">-</span>}</Td>
              <Td className="text-right whitespace-nowrap"><Button size="sm" variant="ghost" aria-label="Edit unit" onClick={() => setUnitModal({ open: true, unit: u })}><Pencil className="size-4" /></Button>
                {owner && <Button size="sm" variant="ghost" aria-label="Delete unit" onClick={() => setDel(u)}><Trash2 className="size-4 text-rose-500" /></Button>}</Td>
            </Tr>))}</tbody></Table>)}
    </Card>

    <PropertyFormModal open={edit} onClose={() => setEdit(false)} property={p} />
    <UnitModal open={unitModal.open} unit={unitModal.unit} propertyId={p.id} onClose={() => setUnitModal({ open: false })} />
    <Confirm open={!!del} onClose={() => setDel(null)} danger title="Delete unit?" text={`Unit ${del?.unitNumber} will be permanently removed. Units with lease history cannot be deleted.`} confirmLabel="Delete" loading={delUnit.isPending} onConfirm={() => del && delUnit.mutate(del)} />
  </>)
}
