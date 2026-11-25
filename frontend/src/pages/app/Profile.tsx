import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2, Upload } from 'lucide-react'
import { api } from '../../lib/api'
import type { TenantProfile } from '../../lib/types'
import { useAuth, useToast } from '../../lib/providers'
import { Avatar, Badge, Button, Card, CardHeader, Field, Input, PageHeader, Select, Textarea } from '../../components/ui'
import { label } from '../../lib/format'
import { TenantDocs } from './Tenants'

function Account() {
  const { user, refreshUser } = useAuth()
  const toast = useToast()
  const [f, setF] = useState({ fullName: user?.fullName ?? '', phone: user?.phone ?? '' })
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' })
  const save = useMutation({ mutationFn: () => api.put('/auth/me', f), onSuccess: async () => { await refreshUser(); toast.success('Profile saved') }, onError: (e: Error) => toast.error(e.message) })
  const change = useMutation({ mutationFn: () => api.post('/auth/change-password', pw), onSuccess: () => { toast.success('Password changed. Other devices were signed out.'); setPw({ currentPassword: '', newPassword: '' }) }, onError: (e: Error) => toast.error(e.message) })
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader title="Account" />
        <div className="space-y-4 p-5">
          <div className="flex items-center gap-4"><Avatar name={user!.fullName} size={56} /><div><p className="font-bold">{user!.email}</p><div className="mt-1 flex flex-wrap gap-1.5">{user!.roles.map((r) => <Badge key={r} color="violet">{r}</Badge>)}</div></div></div>
          <Field label="Full name"><Input value={f.fullName} maxLength={120} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></Field>
          <Field label="Phone"><Input value={f.phone} maxLength={20} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Button loading={save.isPending} disabled={!f.fullName} onClick={() => save.mutate()}>Save changes</Button></div></Card>
      <Card><CardHeader title="Change password" />
        <div className="space-y-4 p-5">
          <Field label="Current password"><Input type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
          <Field label="New password" hint="At least 8 characters"><Input type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
          <Button variant="secondary" loading={change.isPending} disabled={!pw.currentPassword || pw.newPassword.length < 8} onClick={() => change.mutate()}>Update password</Button></div></Card>
    </div>
  )
}

function TenantSection() {
  const toast = useToast(); const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [docType, setDocType] = useState('id_proof')
  const q = useQuery({ queryKey: ['tenant-me'], queryFn: () => api.get<TenantProfile>('/tenants/me') })
  const [f, setF] = useState({ dateOfBirth: '', occupation: '', employer: '', monthlyIncome: '', emergencyContactName: '', emergencyContactPhone: '', permanentAddress: '', idProofType: '', idProofNumber: '' })
  useEffect(() => { const t = q.data; if (t) setF({ dateOfBirth: t.dateOfBirth ?? '', occupation: t.occupation ?? '', employer: t.employer ?? '', monthlyIncome: t.monthlyIncome?.toString() ?? '', emergencyContactName: t.emergencyContactName ?? '', emergencyContactPhone: t.emergencyContactPhone ?? '', permanentAddress: t.permanentAddress ?? '', idProofType: t.idProofType ?? '', idProofNumber: t.idProofNumber ?? '' }) }, [q.data])
  const save = useMutation({ mutationFn: () => api.put('/tenants/me', { ...f, dateOfBirth: f.dateOfBirth || null, monthlyIncome: f.monthlyIncome ? Number(f.monthlyIncome) : null, idProofType: f.idProofType || null }), onSuccess: () => { toast.success('Tenant profile saved'); qc.invalidateQueries({ queryKey: ['tenant-me'] }) }, onError: (e: Error) => toast.error(e.message) })
  const upload = useMutation({ mutationFn: (file: File) => { const fd = new FormData(); fd.append('docType', docType); fd.append('file', file); return api.upload('/tenants/documents', fd) }, onSuccess: () => { toast.success('Document uploaded'); qc.invalidateQueries({ queryKey: ['tenant-me'] }) }, onError: (e: Error) => toast.error(e.message) })
  const del = useMutation({ mutationFn: (id: number) => api.del(`/tenants/documents/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant-me'] }), onError: (e: Error) => toast.error(e.message) })
  const s = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  if (!q.data) return null
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <Card><CardHeader title="Tenant details" subtitle="Shared with property managers when you apply" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Date of birth"><Input type="date" value={f.dateOfBirth} onChange={s('dateOfBirth')} /></Field>
          <Field label="Occupation"><Input value={f.occupation} maxLength={100} onChange={s('occupation')} /></Field>
          <Field label="Employer"><Input value={f.employer} maxLength={120} onChange={s('employer')} /></Field>
          <Field label="Monthly income (₹)"><Input type="number" min={0} value={f.monthlyIncome} onChange={s('monthlyIncome')} /></Field>
          <Field label="ID proof type"><Select value={f.idProofType} onChange={s('idProofType')}><option value="">Select…</option>{['aadhaar', 'passport', 'driving_license', 'voter_id', 'pan'].map((t) => <option key={t} value={t}>{label(t)}</option>)}</Select></Field>
          <Field label="ID number"><Input value={f.idProofNumber} maxLength={40} onChange={s('idProofNumber')} /></Field>
          <Field label="Emergency contact"><Input value={f.emergencyContactName} maxLength={120} onChange={s('emergencyContactName')} /></Field>
          <Field label="Emergency phone"><Input value={f.emergencyContactPhone} maxLength={20} onChange={s('emergencyContactPhone')} /></Field>
          <Field label="Permanent address" className="sm:col-span-2"><Textarea className="min-h-20" value={f.permanentAddress} maxLength={300} onChange={s('permanentAddress')} /></Field>
          <div className="sm:col-span-2"><Button loading={save.isPending} onClick={() => save.mutate()}>Save details</Button></div></div></Card>
      <Card><CardHeader title="Verification documents" subtitle="JPG, PNG, WEBP or PDF up to 8 MB" />
        <div className="space-y-4 p-5">
          <div className="flex gap-2"><Select value={docType} onChange={(e) => setDocType(e.target.value)} aria-label="Document type">{['id_proof', 'address_proof', 'income_proof', 'employment_letter', 'other'].map((t) => <option key={t} value={t}>{label(t)}</option>)}</Select>
            <input ref={fileRef} hidden type="file" accept="image/*,application/pdf" onChange={(e) => { const file = e.target.files?.[0]; if (file) upload.mutate(file); e.target.value = '' }} />
            <Button variant="secondary" icon={<Upload className="size-4" />} loading={upload.isPending} onClick={() => fileRef.current?.click()}>Upload</Button></div>
          <TenantDocs docs={q.data.documents} tenantId={q.data.id} />
          {q.data.documents.filter((d) => !d.isVerified).length > 0 && <div className="flex flex-wrap gap-2">{q.data.documents.filter((d) => !d.isVerified).map((d) => <Button key={d.id} size="sm" variant="ghost" icon={<Trash2 className="size-4 text-rose-500" />} onClick={() => del.mutate(d.id)}>Remove {label(d.docType)}</Button>)}</div>}</div></Card>
    </div>
  )
}

export default function Profile() {
  const { hasRole } = useAuth()
  return (<><PageHeader title="My profile" subtitle="Your account, security and tenant details" /><Account />{hasRole('Tenant') && <TenantSection />}</>)
}
