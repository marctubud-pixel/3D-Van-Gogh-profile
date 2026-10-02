import { isMobile } from '../ui/webgl'

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number
}

/** Coarse device tier, read once: phones and low-core / low-memory machines paint fewer, broader strokes. */
export const LOW_END = (() => {
  if (typeof window === 'undefined') return false
  const nav: NavigatorWithMemory = navigator
  return isMobile() || (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4
})()
