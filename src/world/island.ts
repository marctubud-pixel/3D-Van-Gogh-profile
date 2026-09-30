import * as THREE from 'three'
import { BUILDING_RADIUS, R, dirFromLatLon, moveToward, type LocationAnchors } from './sphere'

/** Control points (lat, lon) of the single winding island road, from the plaza to the observatory hill. */
const CTRL: [number, number][] = [
  [0, 0], [3, 12], [10, 22], [14, 34], [10, 46], [3, 56], [1, 68], [5, 80], [12, 90], [18, 100],
  [20, 112], [16, 124], [10, 134], [8, 146], [12, 158], [18, 168], [16, 180], [8, 190], [2, 200],
  [4, 212], [12, 220], [22, 226], [31, 229],
]

const SAMPLES = 520
const curve = new THREE.CatmullRomCurve3(
  CTRL.map(([a, b]) => dirFromLatLon(a, b).multiplyScalar(R)),
  false,
  'centripetal',
)

/** Unit directions sampled evenly along the road. */
export const ROUTE: THREE.Vector3[] = curve.getSpacedPoints(SAMPLES).map((p) => p.normalize())
/** Arc length (world units) at each sample. */
export const ROUTE_S: number[] = []
/** Tangent (direction of travel) at each sample. */
export const ROUTE_TAN: THREE.Vector3[] = []
{
  let acc = 0
  ROUTE.forEach((p, i) => {
    if (i > 0) acc += ROUTE[i - 1].angleTo(p) * R
    ROUTE_S.push(acc)
    const a = ROUTE[Math.max(0, i - 1)]
    const b = ROUTE[Math.min(ROUTE.length - 1, i + 1)]
    ROUTE_TAN.push(b.clone().sub(a).projectOnPlane(p).normalize())
  })
}
export const ROUTE_LEN = ROUTE_S[ROUTE_S.length - 1]

function indexAt(s: number) {
  const t = THREE.MathUtils.clamp(s / ROUTE_LEN, 0, 1)
  return Math.round(t * (ROUTE.length - 1))
}

/** Surface frame on the road at arc length `s`: up, tangent and right-hand side (up × tangent). */
export function routeFrame(s: number) {
  const i = indexAt(s)
  const up = ROUTE[i].clone()
  const tan = ROUTE_TAN[i].clone()
  const side = new THREE.Vector3().crossVectors(up, tan).normalize()
  return { up, tan, side }
}

/** Point `off` world units to the side (+ = `side` vector) of the road at arc length `s`. */
export function routePoint(s: number, off = 0, along = 0) {
  const f = routeFrame(s)
  const p = f.up.clone()
  if (off) p.applyAxisAngle(f.tan, -off / R)
  if (along) p.applyAxisAngle(new THREE.Vector3().crossVectors(p, f.tan).normalize(), -along / R)
  return p.normalize()
}

export interface RouteHit {
  i: number
  s: number
  /** Arc distance from the road centreline. */
  dist: number
  /** +1 when on the `side` of the road, -1 otherwise. */
  sign: number
}

const _v = new THREE.Vector3()
export function nearestOnRoute(d: THREE.Vector3): RouteHit {
  let best = -2
  let bi = 0
  for (let i = 0; i < ROUTE.length; i++) {
    const dot = ROUTE[i].dot(d)
    if (dot > best) {
      best = dot
      bi = i
    }
  }
  const p = ROUTE[bi]
  const t = ROUTE_TAN[bi]
  _v.copy(d).sub(p)
  const along = _v.dot(t)
  const side = new THREE.Vector3().crossVectors(p, t)
  const lateral = _v.dot(side)
  const endCap = (bi === 0 && along < 0) || (bi === ROUTE.length - 1 && along > 0)
  const dist = endCap ? Math.acos(THREE.MathUtils.clamp(best, -1, 1)) * R : Math.abs(lateral) * R
  return { i: bi, s: ROUTE_S[bi], dist, sign: lateral >= 0 ? 1 : -1 }
}

/** Landmark placement along the road: arc length, side (+1/-1) and setback from the centreline. */
export const STOPS = {
  'print-house': { s: 20, side: -1, off: 10 },
  'brand-museum': { s: 40, side: -1, off: 10 },
  cinema: { s: 86, side: 1, off: 10 },
  arcade: { s: 110, side: -1, off: 9.5 },
  'experiment-lab': { s: 134, side: 1, off: 11 },
  'my-studio': { s: 158, side: -1, off: 9.5 },
  observatory: { s: ROUTE_LEN + 7, side: 1, off: 0 },
} as const

export const ROUTE_ORDER = ['print-house', 'brand-museum', 'cinema', 'arcade', 'experiment-lab', 'my-studio', 'observatory']

const BAY = { s: 64, off: 8, r: 9 }
const CINEMA_LOBE = { s: STOPS.cinema.s, off: 13, r: 12 }
const STUDIO = STOPS['my-studio']
const bayCenter = routePoint(BAY.s, BAY.off)
const lobeCenter = routePoint(CINEMA_LOBE.s, CINEMA_LOBE.off)
const plazaCenter = dirFromLatLon(0, -4)
const lastFrame = routeFrame(ROUTE_LEN)
/** Observatory hilltop, just past the end of the road. */
export const HILL_TOP = lastFrame.up.clone().applyAxisAngle(new THREE.Vector3().crossVectors(lastFrame.up, lastFrame.tan).normalize(), -7 / R).normalize()
const HILL = { plateau: 9, radius: 26, height: 4.2 }

/** Park around the lab: open lawn with a pond. */
export const PARK = { center: routePoint(STOPS['experiment-lab'].s, 12), r: 14 }
export const POND = { center: routePoint(STOPS['experiment-lab'].s - 10, 12), r: 3.4 }

function noise(d: THREE.Vector3) {
  return (
    Math.sin(d.x * 11 + 1.3) * Math.sin(d.y * 13 + 0.4) * Math.sin(d.z * 9 + 2.1) * 0.6 +
    Math.sin(d.x * 23 + d.z * 17) * 0.25 +
    Math.sin(d.y * 29 - d.x * 7) * 0.15
  )
}

const arc = (a: THREE.Vector3, b: THREE.Vector3) => a.angleTo(b) * R

/** Signed distance-like land value: > 0 on land, < 0 at sea. */
export function landValue(d: THREE.Vector3, hit = nearestOnRoute(d)) {
  let w = 21 + noise(d) * 2
  if (hit.sign === STUDIO.side) {
    const k = Math.max(0, 1 - Math.abs(hit.s - STUDIO.s) / 16)
    w = THREE.MathUtils.lerp(w, 15.2, k)
  }
  let v = w - hit.dist
  v = Math.max(v, 20 - arc(d, plazaCenter), CINEMA_LOBE.r + noise(d) * 2 - arc(d, lobeCenter))
  v = Math.min(v, arc(d, bayCenter) - BAY.r)
  return v
}

/** Road-sample index range that crosses the bay. */
export const BRIDGE = (() => {
  let a = -1
  let b = -1
  for (let i = 0; i < ROUTE.length; i++) {
    if (Math.abs(ROUTE_S[i] - BAY.s) > BAY.r + 4) continue
    if (landValue(ROUTE[i]) < 1.2) {
      if (a < 0) a = i
      b = i
    }
  }
  return { a: Math.max(0, a - 3), b: Math.min(ROUTE.length - 1, b + 3) }
})()

export function onBridge(d: THREE.Vector3, hit = nearestOnRoute(d)) {
  return hit.i >= BRIDGE.a && hit.i <= BRIDGE.b && hit.dist < 2.3
}

/** Terrain elevation above the base radius (only the observatory hill rises). */
export function hillHeight(d: THREE.Vector3) {
  const r = arc(d, HILL_TOP)
  if (r > HILL.radius) return 0
  const t = THREE.MathUtils.clamp((HILL.radius - r) / (HILL.radius - HILL.plateau), 0, 1)
  return HILL.height * t * t * (3 - 2 * t)
}

export function walkable(d: THREE.Vector3) {
  const hit = nearestOnRoute(d)
  return landValue(d, hit) > 0.8 || onBridge(d, hit)
}

/** Ground height at `d` for bodies and props (bridge deck = 0). */
export function groundHeight(d: THREE.Vector3) {
  return hillHeight(d)
}

/** World-space point on the ground at unit direction `d`, raised by `lift`. */
export function surf(d: THREE.Vector3, lift = 0) {
  return d.clone().normalize().multiplyScalar(R + groundHeight(d) + lift)
}

/** Centre of the "MARC ISLAND" lettering in the southern sea. */
export const TITLE_CENTER = { lat: -34, lon: 112 }

/** Building, door, road-side stop and side-of-building parking for a landmark at (lat, lon). */
export function locationAnchors(lat: number, lon: number): LocationAnchors {
  const building = dirFromLatLon(lat, lon)
  const hit = nearestOnRoute(building)
  const road = ROUTE[hit.i].clone()
  let facing = road.clone().sub(building).projectOnPlane(building)
  if (facing.lengthSq() < 1e-10) facing = ROUTE_TAN[hit.i].clone()
  facing.normalize()
  const door = moveToward(building, road, BUILDING_RADIUS + 0.8)
  const beside = hit.s - (BUILDING_RADIUS + 1.6) >= 0 ? -(BUILDING_RADIUS + 1.6) : BUILDING_RADIUS + 1.6
  const parking = routePoint(hit.s, (hit.sign || 1) * Math.min(6.5, Math.max(4.2, hit.dist - 2)), beside)
  return { building, road, parking, door, facing }
}
