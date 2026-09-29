export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export function isMobile(): boolean {
  return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 760
}
