import * as THREE from 'three'

/** World up: the island lies in the x/z plane, y is elevation. */
export const UP = new THREE.Vector3(0, 1, 0)
/** Map north (flat-map +y) points along world -z. */
export const NORTH = new THREE.Vector3(0, 0, -1)

/** Ground point (y = 0) of the flat-map coordinate (x east, y north). */
export function planPoint(x: number, y: number) {
  return new THREE.Vector3(x, 0, -y)
}

export function pointToPlan(p: THREE.Vector3): [number, number] {
  return [p.x, -p.z]
}

/** Legacy (lat, lon) map coordinates of the ring road → flat-map point: lon is the bearing round the island, lat pulls inward. */
export function mapToPlan(lat: number, lon: number): [number, number] {
  const t = THREE.MathUtils.degToRad(lon)
  const r = 80 - 1.1 * lat
  return [r * Math.sin(t), -r * Math.cos(t)]
}

export function mapPoint(lat: number, lon: number) {
  const [x, y] = mapToPlan(lat, lon)
  return planPoint(x, y)
}

/** Horizontal part of `v`, normalised (zero vector stays zero). */
export function flatDir(v: THREE.Vector3) {
  const d = new THREE.Vector3(v.x, 0, v.z)
  return d.lengthSq() > 1e-12 ? d.normalize() : d
}

/** Rotation about world up that turns local +Z toward `forward` (its horizontal part). */
export function yawQuaternion(forward: THREE.Vector3) {
  return new THREE.Quaternion().setFromAxisAngle(UP, Math.atan2(forward.x, forward.z))
}

/** Horizontal distance between two points. */
export function flatDistance(a: THREE.Vector3, b: THREE.Vector3) {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

/** Ground point `dist` units from `a` toward `b` (clamped to b). */
export function moveToward(a: THREE.Vector3, b: THREE.Vector3, dist: number) {
  const total = flatDistance(a, b)
  const t = total < 1e-6 ? 0 : Math.min(1, dist / total)
  return new THREE.Vector3(a.x + (b.x - a.x) * t, 0, a.z + (b.z - a.z) * t)
}

export interface LocationAnchors {
  building: THREE.Vector3
  road: THREE.Vector3
  parking: THREE.Vector3
  door: THREE.Vector3
  facing: THREE.Vector3
}

/** Uniform scale applied to every landmark model. */
export const BUILDING_SCALE = 1.6
export const BUILDING_RADIUS = 3.3 * BUILDING_SCALE

/**
 * Per-landmark fit in model units: extra `scale`, `front` face depth (kept on the street line),
 * `halfWidth`/`back` footprint, and `park` offset (world units) of the bike stand beside the door.
 */
export const LANDMARK_FIT: Record<string, { scale: number; front: number; back: number; halfWidth: number; park: number }> = {
  'brand-museum': { scale: 1, front: 3.4, back: 6.2, halfWidth: 10, park: 5.4 },
  cinema: { scale: 1.15, front: 3.7, back: 3.1, halfWidth: 8.8, park: 4.6 },
  observatory: { scale: 1.45, front: 4, back: 4, halfWidth: 4.2, park: 3.6 },
}

/** World-space distance a landmark model is pushed back so its enlarged frontage stays on the street line. */
export function landmarkSetback(id: string) {
  const f = LANDMARK_FIT[id]
  return f ? f.front * BUILDING_SCALE * (f.scale - 1) : 0
}

/** ISLAND SERVICE CENTER beside the starting plaza (static, not CMS-driven). */
export const SERVICE_CENTER = { radius: 7 } as const
