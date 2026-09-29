import { create } from 'zustand'
import type { PortfolioProject, SiteContent, WorldLocation } from '../../shared/types'
import { seedContent } from '../../shared/seed'
import { api } from './api'

interface ContentState {
  content: SiteContent | null
  error: string | null
  load: () => Promise<void>
}

export const useContent = create<ContentState>((set, get) => ({
  content: null,
  error: null,
  load: async () => {
    if (get().content) return
    try {
      set({ content: await api.publicContent() })
    } catch (e) {
      set({ content: seedContent, error: e instanceof Error ? e.message : String(e) })
    }
  },
}))

export function projectsFor(content: SiteContent, loc: WorldLocation): PortfolioProject[] {
  return loc.projectIds.map((id) => content.projects.find((p) => p.id === id)).filter((p): p is PortfolioProject => !!p)
}
