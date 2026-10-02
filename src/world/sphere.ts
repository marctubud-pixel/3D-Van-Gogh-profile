import * as THREE from 'three'
/** Ground radius: large enough that the island reads as flat, with only a soft fall-off at the horizon. */
export const R = 2400

export function dirFromLatLon(lat: number, lon: number) {
  const phi = THREE.MathUtils.degToRad(lat)
  const theta = THREE.MathUtils.degToRad(lon)
  return new THREE.Vector3(Math.cos(phi) * Math.sin(theta), Math.sin(phi), Math.cos(phi) * Math.cos(theta))
}

export function latLonFromDir(d: THREE.Vector3): [number, number] {
  const n = d.clone().normalize()
  return [THREE.MathUtils.radToDeg(Math.asin(n.y)), THREE.MathUtils.radToDeg(Math.atan2(n.x, n.z))]
}

/** Unit direction of the flat-map point (x east, y north) in world units, centred on lat 0 / lon 0. */
export function planDir(x: number, y: number) {
  return dirFromLatLon(THREE.MathUtils.radToDeg(y / R), THREE.MathUtils.radToDeg(x / R))
}

export function dirToPlan(d: THREE.Vector3): [number, number] {
  const n = d.clone().normalize()
  return [Math.atan2(n.x, n.z) * R, Math.asin(n.y) * R]
}

/** Legacy (lat, lon) map coordinates of the ring road → flat-map point: lon is the bearing round the island, lat pulls inward. */
export function mapToPlan(lat: number, lon: number): [number, number] {
  const t = THREE.MathUtils.degToRad(lon)
  const r = 80 - 1.1 * lat
  return [r * Math.sin(t), -r * Math.cos(t)]
}

export function mapDir(lat: number, lon: number) {
  const [x, y] = mapToPlan(lat, lon)
  return planDir(x, y)
}

/** Quaternion that orients local +Y to `up` and local +Z to `forward` (projected onto the tangent plane). */
export function surfaceQuaternion(up: THREE.Vector3, forward: THREE.Vector3) {
  const u = up.clone().normalize()
  const f = forward.clone().sub(u.clone().multiplyScalar(forward.dot(u))).normalize()
  const x = new THREE.Vector3().crossVectors(u, f)
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, u, f))
}

/** Default tangent "north" direction at a surface point, falling back near the poles. */
export function tangentNorth(up: THREE.Vector3) {
  const pole = Math.abs(up.y) > 0.98 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0)
  return pole.sub(up.clone().multiplyScalar(pole.dot(up))).normalize()
}

export function slerpDir(a: THREE.Vector3, b: THREE.Vector3, t: number) {
  const qa = new THREE.Quaternion().setFromUnitVectors(a.clone().normalize(), b.clone().normalize())
  const q = new THREE.Quaternion().slerp(qa, t)
  return a.clone().normalize().applyQuaternion(q)
}

export function arcDistance(a: THREE.Vector3, b: THREE.Vector3) {
  return a.clone().normalize().angleTo(b.clone().normalize()) * R
}

/** Move from `a` toward `b` along the great circle by `dist` world units (clamped to b). */
export function moveToward(a: THREE.Vector3, b: THREE.Vector3, dist: number) {
  const total = arcDistance(a, b)
  return total < 1e-6 ? a.clone().normalize() : slerpDir(a, b, Math.min(1, dist / total))
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
