import { create } from 'zustand'

export type DayMode = 'auto' | 'day' | 'night'

const KEY = 'my-world-daynight'

/** Local evening/night hours count as night in auto mode. */
export const isNightHour = (h = new Date().getHours()) => h >= 19 || h < 6

function stored(): DayMode {
  if (typeof window === 'undefined') return 'auto'
  const v = localStorage.getItem(KEY)
  return v === 'day' || v === 'night' ? v : 'auto'
}

const LAMP_KEY = 'my-world-headlamp'

interface DayNightState {
  mode: DayMode
  setMode: (m: DayMode) => void
  lamp: boolean
  setLamp: (v: boolean) => void
}

export const useDayNight = create<DayNightState>((set) => ({
  mode: stored(),
  setMode: (mode) => {
    localStorage.setItem(KEY, mode)
    set({ mode })
  },
  lamp: typeof window === 'undefined' || localStorage.getItem(LAMP_KEY) !== '0',
  setLamp: (lamp) => {
    localStorage.setItem(LAMP_KEY, lamp ? '1' : '0')
    set({ lamp })
  },
}))

export const nightOf = (mode: DayMode) => (mode === 'auto' ? isNightHour() : mode === 'night')

/** Eased 0 (day) … 1 (night) blend shared with every painted material; advanced by <DayNightRig>. */
export const dusk = { k: nightOf(stored()) ? 1 : 0 }
