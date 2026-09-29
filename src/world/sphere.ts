import * as THREE from 'three'
import { PLANET_RADIUS } from '../../shared/seed'

export const R = PLANET_RADIUS

export function dirFromLatLon(lat: number, lon: number) {
  const phi = THREE.MathUtils.degToRad(lat)
  const theta = THREE.MathUtils.degToRad(lon)
  return new THREE.Vector3(Math.cos(phi) * Math.sin(theta), Math.sin(phi), Math.cos(phi) * Math.cos(theta))
}

export function latLonFromDir(d: THREE.Vector3): [number, number] {
  const n = d.clone().normalize()
  return [THREE.MathUtils.radToDeg(Math.asin(n.y)), THREE.MathUtils.radToDeg(Math.atan2(n.x, n.z))]
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

/** Nearest point on the two road great circles (equator and the lon 0/180 meridian). */
export function nearestRoadDir(d: THREE.Vector3) {
  const n = d.clone().normalize()
  const onEquator = new THREE.Vector3(n.x, 0, n.z)
  const onMeridian = new THREE.Vector3(0, n.y, n.z)
  const candidates = [onEquator, onMeridian].filter((v) => v.lengthSq() > 1e-6).map((v) => v.normalize())
  return candidates.reduce((best, v) => (v.angleTo(n) < best.angleTo(n) ? v : best))
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

export const BUILDING_RADIUS = 3.3

export function locationAnchors(lat: number, lon: number): LocationAnchors {
  const building = dirFromLatLon(lat, lon)
  const road = nearestRoadDir(building)
  const parking = moveToward(road, building, 1.4)
  const door = moveToward(building, road, BUILDING_RADIUS + 0.6)
  const facing = road.clone().sub(building).projectOnPlane(building).normalize()
  return { building, road, parking, door, facing }
}
