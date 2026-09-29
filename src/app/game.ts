import { create } from 'zustand'

export type PlayerState = 'RIDING' | 'PARKING' | 'DISMOUNTING' | 'WALKING' | 'INTERACTING' | 'MOUNTING'

export interface Prompt {
  key: string
  label: string
}

interface GameState {
  player: PlayerState
  prompt: Prompt | null
  toast: string | null
  openLocationId: string | null
  openProjectId: string | null
  routeTargetId: string | null
  mapOpen: boolean
  latLon: [number, number]
  resetCount: number
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
  player: 'RIDING',
  prompt: null,
  toast: null,
  openLocationId: null,
  openProjectId: null,
  routeTargetId: null,
  mapOpen: false,
  latLon: [0, 0],
  resetCount: 0,
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
  return s.player === 'INTERACTING' || s.mapOpen || s.openLocationId !== null
}
