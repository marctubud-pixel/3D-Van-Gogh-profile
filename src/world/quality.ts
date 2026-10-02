import { create } from 'zustand'
import { isMobile } from '../ui/webgl'

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number
}

/** Coarse device tier, read once: phones and low-core / low-memory machines start at a lower quality. */
export const LOW_END = (() => {
  if (typeof window === 'undefined') return false
  const nav: NavigatorWithMemory = navigator
  return isMobile() || (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4
})()

export type QualityLevel = 'high' | 'medium' | 'low'
export type QualityMode = 'auto' | QualityLevel

export interface QualitySettings {
  dpr: number
  shadowMap: number
  /** Meadow tiles closer than this (m) are painted at full density. */
  near: number
  /** Meadow tiles closer than this (m) use the mid level of detail. */
  far: number
  grassSpacing: number
  grassScale: number
}

export const QUALITY: Record<QualityLevel, QualitySettings> = {
  high: { dpr: 2, shadowMap: 2048, near: 24, far: 52, grassSpacing: 0.18, grassScale: 1 },
  medium: { dpr: 1.5, shadowMap: 1024, near: 18, far: 42, grassSpacing: 0.22, grassScale: 1.1 },
  low: { dpr: 1, shadowMap: 0, near: 12, far: 30, grassSpacing: 0.28, grassScale: 1.25 },
}

const ORDER: QualityLevel[] = ['low', 'medium', 'high']
const MODE_KEY = 'my-world-quality'
const GRASS_KEY = 'my-world-grass'

function storedMode(): QualityMode {
  if (typeof window === 'undefined') return 'auto'
  const v = localStorage.getItem(MODE_KEY)
  return v === 'high' || v === 'medium' || v === 'low' ? v : 'auto'
}

interface QualityState {
  mode: QualityMode
  /** Level picked by the frame-rate monitor while in auto mode. */
  autoLevel: QualityLevel
  fps: number
  /** Standing grass blades; off paints the meadow with flat dabs instead. */
  grass: boolean
  setGrass: (on: boolean) => void
  setMode: (m: QualityMode) => void
  step: (dir: -1 | 1) => void
  setFps: (fps: number) => void
}

export const useQuality = create<QualityState>((set) => ({
  mode: storedMode(),
  autoLevel: LOW_END ? 'medium' : 'high',
  fps: 0,
  grass: typeof window === 'undefined' || localStorage.getItem(GRASS_KEY) !== 'off',
  setGrass: (grass) => {
    localStorage.setItem(GRASS_KEY, grass ? 'on' : 'off')
    set({ grass })
  },
  setMode: (mode) => {
    localStorage.setItem(MODE_KEY, mode)
    set({ mode })
  },
  step: (dir) =>
    set((s) => {
      const i = Math.min(ORDER.length - 1, Math.max(0, ORDER.indexOf(s.autoLevel) + dir))
      return { autoLevel: ORDER[i] }
    }),
  setFps: (fps) => set({ fps }),
}))

export const levelOf = (s: { mode: QualityMode; autoLevel: QualityLevel }): QualityLevel =>
  s.mode === 'auto' ? s.autoLevel : s.mode

export const useQualityLevel = () => useQuality(levelOf)
