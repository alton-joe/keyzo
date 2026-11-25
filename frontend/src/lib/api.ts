import type { AuthResponse } from './types'

const BASE = '/api/v1'
const KEY = 'keyzo-auth'

export type Session = { accessToken: string; refreshToken: string; accessExpiresAt: string }

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

export const session = {
  get(): Session | null { try { return JSON.parse(localStorage.getItem(KEY) || 'null') } catch { return null } },
  set(s: Session | null) { try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY) } catch { /* private mode */ } },
}

let onUnauthorized: () => void = () => {}
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn }

let refreshing: Promise<boolean> | null = null
async function refresh(): Promise<boolean> {
  const s = session.get()
  if (!s) return false
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: s.refreshToken }) })
      if (!res.ok) return false
      const data: AuthResponse = await res.json()
      session.set({ accessToken: data.accessToken, refreshToken: data.refreshToken, accessExpiresAt: data.accessExpiresAt })
      return true
    } catch { return false } finally { setTimeout(() => { refreshing = null }, 0) }
  })()
  return refreshing
}

type Opts = { method?: string; body?: unknown; form?: FormData; query?: Record<string, unknown>; auth?: boolean; raw?: boolean }

function qs(query?: Record<string, unknown>) {
  if (!query) return ''
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

async function request<T>(path: string, opts: Opts = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = {}
  const s = session.get()
  if (opts.auth !== false && s) headers.Authorization = `Bearer ${s.accessToken}`
  let body: BodyInit | undefined
  if (opts.form) body = opts.form
  else if (opts.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.body) }

  let res: Response
  try {
    res = await fetch(`${BASE}${path}${qs(opts.query)}`, { method: opts.method ?? 'GET', headers, body })
  } catch {
    throw new ApiError(0, 'Cannot reach the Keyzo server. Please check that the API is running.')
  }

  if (res.status === 401 && retry && opts.auth !== false && s) {
    if (await refresh()) return request<T>(path, opts, false)
    session.set(null); onUnauthorized()
  }
  if (!res.ok) {
    let msg = res.status === 403 ? 'You do not have permission to do that.' : res.status === 429 ? 'Too many attempts. Please wait a moment.' : `Request failed (${res.status})`
    try {
      const j = await res.json()
      if (j?.detail) msg = j.detail
      else if (j?.errors) msg = Object.values(j.errors as Record<string, string[]>).flat().join(' ')
      else if (j?.title) msg = j.title
    } catch { /* not json */ }
    throw new ApiError(res.status, msg)
  }
  if (opts.raw) return res as unknown as T
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export const api = {
  get: <T>(path: string, query?: Record<string, unknown>, auth = true) => request<T>(path, { query, auth }),
  post: <T>(path: string, body?: unknown, auth = true) => request<T>(path, { method: 'POST', body: body ?? {}, auth }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, form: FormData) => request<T>(path, { method: 'POST', form }),
  /** Fetch a protected file (PDF receipt, tenant document, maintenance photo) and return a blob URL. */
  async blobUrl(path: string): Promise<string> {
    const res = await request<Response>(path, { raw: true })
    return URL.createObjectURL(await res.blob())
  },
  async download(path: string, filename: string) {
    const url = await api.blobUrl(path)
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  },
}
