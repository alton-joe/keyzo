import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { api, ApiError, session, setUnauthorizedHandler } from './api'
import type { AuthResponse, Role, User } from './types'

// ------------------------------------------------------------------ auth
type RegisterInput = { email: string; password: string; fullName: string; phone?: string; role: 'Owner' | 'Tenant' | 'Manager' | 'MaintenanceStaff' }
type AuthCtx = {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (input: RegisterInput) => Promise<User>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  hasRole: (...roles: Role[]) => boolean
  isOperator: boolean
}
const AuthContext = createContext<AuthCtx>(null!)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const apply = (r: AuthResponse) => {
    session.set({ accessToken: r.accessToken, refreshToken: r.refreshToken, accessExpiresAt: r.accessExpiresAt })
    setUser(r.user)
    return r.user
  }

  const refreshUser = useCallback(async () => { setUser(await api.get<User>('/auth/me')) }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null))
    if (!session.get()) { setLoading(false); return }
    api.get<User>('/auth/me').then(setUser)
      // only a genuine auth failure ends the session; a network blip or 429 must not log the user out
      .catch((e) => { if (e instanceof ApiError && (e.status === 401 || e.status === 403)) session.set(null) })
      .finally(() => setLoading(false))
  }, [])

  const value = useMemo<AuthCtx>(() => ({
    user, loading,
    login: async (email, password) => apply(await api.post<AuthResponse>('/auth/login', { email, password }, false)),
    register: async (input) => apply(await api.post<AuthResponse>('/auth/register', input, false)),
    logout: async () => {
      const s = session.get()
      try { if (s) await api.post('/auth/logout', { refreshToken: s.refreshToken }, false) } catch { /* ignore */ }
      session.set(null); setUser(null)
    },
    refreshUser,
    hasRole: (...roles) => !!user && roles.some((r) => user.roles.includes(r)),
    isOperator: !!user && user.roles.some((r) => r === 'SuperAdmin' || r === 'Owner' || r === 'Manager'),
  }), [user, loading, refreshUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ------------------------------------------------------------------ theme
type ThemeCtx = { dark: boolean; toggle: () => void }
const ThemeContext = createContext<ThemeCtx>({ dark: false, toggle: () => {} })
export const useTheme = () => useContext(ThemeContext)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const toggle = () => setDark((d) => {
    const next = !d
    document.documentElement.classList.toggle('dark', next)
    try { localStorage.setItem('keyzo-theme', next ? 'dark' : 'light') } catch { /* ignore */ }
    return next
  })
  return <ThemeContext.Provider value={{ dark, toggle }}>{children}</ThemeContext.Provider>
}

// ------------------------------------------------------------------ toasts
type Toast = { id: number; kind: 'success' | 'error' | 'info'; text: string }
type ToastCtx = { success: (t: string) => void; error: (t: string) => void; info: (t: string) => void }
const ToastContext = createContext<ToastCtx>(null!)
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, kind, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3500)
  }, [])
  const ctx = useMemo<ToastCtx>(() => ({ success: (t) => push('success', t), error: (t) => push('error', t), info: (t) => push('info', t) }), [push])
  const icons = { success: CheckCircle2, error: XCircle, info: Info }
  const colors = { success: 'text-emerald-500', error: 'text-rose-500', info: 'text-brand-500' }
  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2" role="status" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = icons[t.kind]
            return (
              <motion.div key={t.id} layout initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40 }} className="surface flex items-start gap-3 rounded-xl p-3.5 shadow-lift">
                <Icon className={`mt-0.5 size-5 shrink-0 ${colors[t.kind]}`} />
                <p className="text-sm leading-snug">{t.text}</p>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
