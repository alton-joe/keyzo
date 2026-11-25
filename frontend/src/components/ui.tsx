import { forwardRef, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Inbox, Loader2, X } from 'lucide-react'
import { initials, label } from '../lib/format'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

// ------------------------------------------------------------------ Button
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
}
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, children, className, disabled, ...rest }, ref) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap cursor-pointer'
  const sizes = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-base' }
  const variants = {
    primary: 'gradient-brand text-white shadow-md hover:shadow-lift hover:-translate-y-0.5',
    secondary: 'surface hover:bg-[var(--surface-2)]',
    soft: 'bg-brand-500/10 text-brand-600 dark:text-brand-300 hover:bg-brand-500/20',
    ghost: 'hover:bg-[var(--surface-2)] text-muted hover:text-[var(--text)]',
    danger: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20',
  }
  return (
    <button ref={ref} disabled={disabled || loading} className={cx(base, sizes[size], variants[variant], className)} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  )
})

// ------------------------------------------------------------------ Card
export function Card({ children, className, hover, ...rest }: { children: ReactNode; className?: string; hover?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('surface rounded-2xl shadow-soft', hover && 'transition-all duration-300 hover:-translate-y-1 hover:shadow-lift', className)} {...rest}>{children}</div>
}
export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-base px-5 py-4">
      <div><h3 className="text-base font-bold">{title}</h3>{subtitle && <p className="text-muted mt-0.5 text-sm">{subtitle}</p>}</div>
      {action}
    </div>
  )
}

// ------------------------------------------------------------------ Form controls
const field = 'w-full rounded-xl border border-base bg-[var(--surface)] px-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 disabled:opacity-60'
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cx(field, 'h-11', className)} {...p} />
})
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cx(field, 'min-h-24 py-3', className)} {...p} />
})
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...p }, ref) {
  return <select ref={ref} className={cx(field, 'h-11 cursor-pointer pr-8', className)} {...p}>{children}</select>
})
export function Field({ label: l, hint, error, children, className }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-xs font-semibold tracking-wide text-muted uppercase">{l}</span>
      {children}
      {hint && !error && <span className="text-muted mt-1 block text-xs">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-rose-500">{error}</span>}
    </label>
  )
}

// ------------------------------------------------------------------ Badges
const tone: Record<string, string> = {
  green: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400',
  amber: 'bg-amber-500/14 text-amber-700 dark:text-amber-400',
  red: 'bg-rose-500/12 text-rose-700 dark:text-rose-400',
  blue: 'bg-sky-500/12 text-sky-700 dark:text-sky-400',
  violet: 'bg-[#35566b]/12 text-[#35566b] dark:text-[#8db0c4]',
  slate: 'bg-slate-500/12 text-slate-600 dark:text-slate-300',
}
const statusTone: Record<string, keyof typeof tone> = {
  available: 'green', active: 'green', approved: 'green', paid: 'green', completed: 'green', refunded: 'green', held: 'blue', verified: 'green',
  occupied: 'blue', open: 'blue', assigned: 'violet', in_progress: 'amber', pending: 'amber', partial: 'amber', upcoming: 'violet', partially_refunded: 'amber',
  overdue: 'red', rejected: 'red', terminated: 'red', urgent: 'red', forfeited: 'red', high: 'amber', medium: 'blue', low: 'slate',
  expired: 'slate', cancelled: 'slate', withdrawn: 'slate', maintenance: 'amber', inactive: 'slate',
}
export function Badge({ children, color = 'slate', dot }: { children: ReactNode; color?: keyof typeof tone; dot?: boolean }) {
  return <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', tone[color])}>{dot && <i className="size-1.5 rounded-full bg-current" />}{children}</span>
}
export function StatusBadge({ status }: { status: string }) {
  return <Badge color={statusTone[status] ?? 'slate'} dot>{label(status)}</Badge>
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span style={{ width: size, height: size, fontSize: size * 0.38 }}
      className="gradient-brand inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white">{initials(name)}</span>
  )
}

// ------------------------------------------------------------------ Feedback
export function Spinner({ className }: { className?: string }) { return <Loader2 className={cx('size-5 animate-spin text-brand-500', className)} /> }
export function PageLoader() { return <div className="flex min-h-[40vh] items-center justify-center"><Spinner className="size-8" /></div> }
export function Skeleton({ className }: { className?: string }) { return <div className={cx('skeleton rounded-xl', className)} /> }
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return <div className="space-y-3 p-5">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
}
export function EmptyState({ title, text, action, icon }: { title: string; text?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="bg-brand-500/10 text-brand-500 mb-4 flex size-14 items-center justify-center rounded-2xl">{icon ?? <Inbox className="size-7" />}</div>
      <h4 className="text-base font-bold">{title}</h4>
      {text && <p className="text-muted mt-1 max-w-sm text-sm">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <EmptyState title="Something went wrong" text={error instanceof Error ? error.message : 'Please try again.'}
      action={retry && <Button variant="secondary" onClick={retry}>Try again</Button>} />
  )
}

// ------------------------------------------------------------------ Modal
export function Modal({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div role="dialog" aria-modal="true" aria-label={title}
            initial={{ y: 40, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className={cx('surface flex max-h-[92vh] w-full flex-col rounded-t-3xl shadow-2xl sm:rounded-3xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
            <div className="flex items-center justify-between border-b border-base px-6 py-4">
              <h3 className="text-lg font-bold">{title}</h3>
              <button onClick={onClose} aria-label="Close" className="text-muted rounded-lg p-1.5 hover:bg-[var(--surface-2)]"><X className="size-5" /></button>
            </div>
            <div className="overflow-y-auto px-6 py-5">{children}</div>
            {footer && <div className="flex justify-end gap-2 border-t border-base px-6 py-4">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Confirm({ open, onClose, onConfirm, title, text, confirmLabel = 'Confirm', danger, loading }:
  { open: boolean; onClose: () => void; onConfirm: () => void; title: string; text: string; confirmLabel?: string; danger?: boolean; loading?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button></>}>
      <p className="text-muted text-sm leading-relaxed">{text}</p>
    </Modal>
  )
}

// ------------------------------------------------------------------ Layout bits
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>{subtitle && <p className="text-muted mt-1 text-sm">{subtitle}</p>}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({ label: l, value, icon, hint, tone: t = 'brand' }: { label: string; value: ReactNode; icon: ReactNode; hint?: ReactNode; tone?: 'brand' | 'green' | 'amber' | 'red' | 'sky' }) {
  const tones = { brand: 'bg-brand-500/12 text-brand-500', green: 'bg-emerald-500/12 text-emerald-500', amber: 'bg-amber-500/14 text-amber-500', red: 'bg-rose-500/12 text-rose-500', sky: 'bg-sky-500/12 text-sky-500' }
  return (
    <Card hover className="p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-muted text-xs font-semibold tracking-wide uppercase">{l}</p>
          <p className="font-display mt-2 truncate text-2xl font-extrabold">{value}</p>
          {hint && <p className="text-muted mt-1 text-xs">{hint}</p>}
        </div>
        <div className={cx('flex size-11 shrink-0 items-center justify-center rounded-xl', tones[t])}>{icon}</div>
      </div>
    </Card>
  )
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="surface-2 inline-flex flex-wrap gap-1 rounded-xl p-1" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}
          className={cx('relative rounded-lg px-3.5 py-1.5 text-sm font-semibold transition cursor-pointer', value === t.value ? 'surface shadow-sm' : 'text-muted hover:text-[var(--text)]')}>
          {t.label}{t.count != null && <span className="text-muted ml-1.5 text-xs">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null
  return (
    <div className="flex items-center justify-between border-t border-base px-5 py-3 text-sm">
      <span className="text-muted">Page {page} of {pages} - {total} total</span>
      <div className="flex gap-1">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft className="size-4" /></Button>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight className="size-4" /></Button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ Table
export function Table({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">{children}</table></div>
}
export const Th = ({ children, className }: { children?: ReactNode; className?: string }) =>
  <th className={cx('text-muted border-b border-base px-5 py-3 text-xs font-semibold tracking-wide uppercase whitespace-nowrap', className)}>{children}</th>
export const Td = ({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) =>
  <td colSpan={colSpan} className={cx('border-b border-base px-5 py-3.5 align-middle', className)}>{children}</td>
export const Tr = ({ children, onClick }: { children: ReactNode; onClick?: () => void }) =>
  <tr onClick={onClick} className={cx('transition-colors hover:bg-[var(--surface-2)]/60', onClick && 'cursor-pointer')}>{children}</tr>

export function SearchBox({ value, onChange, placeholder = 'Search...' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [local, setLocal] = useState(value)
  useEffect(() => { const t = setTimeout(() => onChange(local), 300); return () => clearTimeout(t) }, [local]) // eslint-disable-line react-hooks/exhaustive-deps
  return <Input value={local} onChange={(e) => setLocal(e.target.value)} placeholder={placeholder} className="max-w-xs" aria-label={placeholder} />
}

export function KeyValue({ items }: { items: { k: string; v: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map((i) => (
        <div key={i.k}><dt className="text-muted text-xs font-semibold tracking-wide uppercase">{i.k}</dt><dd className="mt-1 text-sm font-medium">{i.v ?? '-'}</dd></div>
      ))}
    </dl>
  )
}
