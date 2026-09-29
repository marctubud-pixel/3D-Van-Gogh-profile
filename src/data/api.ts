import type { Asset, PortfolioProject, Profile, SiteContent, WorldLocation } from '../../shared/types'

const TOKEN_KEY = 'my-world-admin-token'

export const auth = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const token = auth.get()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const res = await fetch(url, { ...init, headers })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new ApiError(res.status, body.error ?? res.statusText)
  }
  return (await res.json()) as T
}

export const api = {
  publicContent: () => request<SiteContent>('/api/content'),
  login: (password: string) => request<{ token: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  adminContent: () => request<SiteContent>('/api/admin/content'),
  saveProfile: (p: Profile) => request<SiteContent>('/api/admin/profile', { method: 'PUT', body: JSON.stringify(p) }),
  saveLocation: (l: WorldLocation) =>
    request<SiteContent>(`/api/admin/locations/${encodeURIComponent(l.id)}`, { method: 'PUT', body: JSON.stringify(l) }),
  createProject: (p: PortfolioProject) =>
    request<{ content: SiteContent; id: string }>('/api/admin/projects', { method: 'POST', body: JSON.stringify(p) }),
  saveProject: (p: PortfolioProject) =>
    request<SiteContent>(`/api/admin/projects/${encodeURIComponent(p.id)}`, { method: 'PUT', body: JSON.stringify(p) }),
  deleteProject: (id: string) => request<SiteContent>(`/api/admin/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  assets: () => request<Asset[]>('/api/admin/assets'),
  upload: (files: File[]) => {
    const fd = new FormData()
    files.forEach((f) => fd.append('files', f))
    return request<Asset[]>('/api/admin/upload', { method: 'POST', body: fd })
  },
  deleteAsset: (id: string) => request<{ ok: boolean }>(`/api/admin/assets/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}
