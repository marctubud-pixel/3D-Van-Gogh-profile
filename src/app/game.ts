import { create } from 'zustand'

export type PlayerState = 'RIDING' | 'PARKING' | 'DISMOUNTING' | 'WALKING' | 'INTERACTING' | 'MOUNTING'

export type Phase = 'intro' | 'flying' | 'play'

export interface Prompt {
  key: string
  label: string
}

interface GameState {
  phase: Phase
  teleport: { id: string; n: number } | null
  player: PlayerState
  prompt: Prompt | null
  toast: string | null
  openLocationId: string | null
  openProjectId: string | null
  routeTargetId: string | null
  mapOpen: boolean
  latLon: [number, number]
  resetCount: number
  setPhase: (p: Phase) => void
  teleportTo: (id: string) => void
  setPlayer: (s: PlayerState) => void
  setPrompt: (p: Prompt | null) => void
  showToast: (t: string) => void
  openLocation: (id: string | null) => void
  openProject: (id: string | null) => void
  setRouteTarget: (id: string | null) => void
  setMapOpen: (v: boolean) => void
  setLatLon: (v: [number, number]) => void
  returnToPlaza: () => void
}

let toastTimer: ReturnType<typeof setTimeout> | undefined

export const useGame = create<GameState>((set) => ({
  phase: 'intro',
  teleport: null,
  player: 'RIDING',
  prompt: null,
  toast: null,
  openLocationId: null,
  openProjectId: null,
  routeTargetId: null,
  mapOpen: false,
  latLon: [0, 0],
  resetCount: 0,
  setPhase: (phase) => set({ phase }),
  teleportTo: (id) =>
    set((s) => ({ teleport: { id, n: (s.teleport?.n ?? 0) + 1 }, mapOpen: false, openLocationId: null, openProjectId: null })),
  setPlayer: (player) => set({ player }),
  setPrompt: (prompt) => set((s) => (s.prompt?.label === prompt?.label ? s : { prompt })),
  showToast: (toast) => {
    clearTimeout(toastTimer)
    set({ toast })
    toastTimer = setTimeout(() => set({ toast: null }), 2600)
  },
  openLocation: (openLocationId) => set({ openLocationId, openProjectId: null }),
  openProject: (openProjectId) => set({ openProjectId }),
  setRouteTarget: (routeTargetId) => set({ routeTargetId }),
  setMapOpen: (mapOpen) => set({ mapOpen }),
  setLatLon: (latLon) => set({ latLon }),
  returnToPlaza: () =>
    set((s) => ({ resetCount: s.resetCount + 1, player: 'RIDING', openLocationId: null, openProjectId: null, mapOpen: false })),
}))

export const inputLocked = () => {
  const s = useGame.getState()
  return s.phase !== 'play' || s.player === 'INTERACTING' || s.mapOpen || s.openLocationId !== null
}
