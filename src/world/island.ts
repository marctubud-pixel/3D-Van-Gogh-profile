import * as THREE from 'three'
import { BUILDING_RADIUS, BUILDING_SCALE, LANDMARK_FIT, UP, flatDir, flatDistance, landmarkSetback, mapPoint, moveToward, planPoint, pointToPlan, type LocationAnchors } from './plane'

/** Control points (map lat, lon; see `mapToPlan`) of the island loop road: plaza → landmarks → observatory hill → back down to the plaza. */
const CTRL: [number, number][] = [
  [0, 0], [3, 12], [10, 22], [14, 34], [10, 46], [3, 56], [1, 68], [5, 80], [12, 90], [18, 100],
  [20, 112], [16, 124], [10, 134], [8, 146], [12, 158], [18, 168], [16, 180], [8, 190], [2, 200],
  [4, 212], [12, 220], [22, 226], [31, 232], [34, 244], [30, 258], [24, 272], [20, 288], [22, 304],
  [22, 320], [21, 334], [18, 347], [10, 357],
]

const SAMPLES = 520
const curve = new THREE.CatmullRomCurve3(
  CTRL.map(([a, b]) => mapPoint(a, b)),
  true,
  'centripetal',
)

/** Ground points (y = 0) sampled evenly along the road. */
export const ROUTE: THREE.Vector3[] = curve.getSpacedPoints(SAMPLES).map((p) => p.setY(0))
/** Arc length (world units) at each sample. */
export const ROUTE_S: number[] = []
/** Tangent (direction of travel) at each sample. */
export const ROUTE_TAN: THREE.Vector3[] = []
{
  let acc = 0
  ROUTE.forEach((p, i) => {
    if (i > 0) acc += flatDistance(ROUTE[i - 1], p)
    ROUTE_S.push(acc)
    const n = ROUTE.length - 1
    const a = ROUTE[i === 0 ? n - 1 : i - 1]
    const b = ROUTE[i === n ? 1 : i + 1]
    ROUTE_TAN.push(flatDir(b.clone().sub(a)))
  })
}
export const ROUTE_LEN = ROUTE_S[ROUTE_S.length - 1]

/** Wrap an arc length onto the loop [0, ROUTE_LEN). */
export function wrapS(s: number) {
  return ((s % ROUTE_LEN) + ROUTE_LEN) % ROUTE_LEN
}

function indexAt(s: number) {
  return Math.round((wrapS(s) / ROUTE_LEN) * (ROUTE.length - 1))
}

/** Road frame at arc length `s`: centreline point, tangent and right-hand side (up × tangent). */
export function routeFrame(s: number) {
  const i = indexAt(s)
  const at = ROUTE[i].clone()
  const tan = ROUTE_TAN[i].clone()
  const side = new THREE.Vector3().crossVectors(UP, tan).normalize()
  return { at, tan, side }
}

/** Ground point `off` world units to the side (+ = `side` vector) of the road at arc length `s`. */
export function routePoint(s: number, off = 0) {
  const f = routeFrame(s)
  return f.at.addScaledVector(f.side, off)
}

export interface RouteHit {
  i: number
  s: number
  /** Distance from the road centreline. */
  dist: number
  /** +1 when on the `side` of the road, -1 otherwise. */
  sign: number
}

export function nearestOnRoute(d: THREE.Vector3): RouteHit {
  let best = Infinity
  let bi = 0
  for (let i = 0; i < ROUTE.length; i++) {
    const dx = ROUTE[i].x - d.x
    const dz = ROUTE[i].z - d.z
    const q = dx * dx + dz * dz
    if (q < best) {
      best = q
      bi = i
    }
  }
  const p = ROUTE[bi]
  const t = ROUTE_TAN[bi]
  // side = up × tangent = (t.z, 0, -t.x)
  const lateral = (d.x - p.x) * t.z - (d.z - p.z) * t.x
  return { i: bi, s: ROUTE_S[bi], dist: Math.abs(lateral), sign: lateral >= 0 ? 1 : -1 }
}

/** Arc length of the summit bend, where the observatory sits. */
export const SUMMIT_S = nearestOnRoute(mapPoint(33, 238)).s

/** Arc lengths below are laid out on a 276-unit reference loop and stretched to the real one. */
export const ROUTE_K = ROUTE_LEN / 276

/** Landmark placement along the road: arc length, side (+1/-1) and setback from the centreline. */
export const STOPS = {
  'print-house': { s: 20 * ROUTE_K, side: -1, off: 10 },
  'brand-museum': { s: 40 * ROUTE_K, side: -1, off: 10 },
  cinema: { s: 86 * ROUTE_K, side: 1, off: 10 },
  arcade: { s: 110 * ROUTE_K, side: -1, off: 9.5 },
  'experiment-lab': { s: 134 * ROUTE_K, side: 1, off: 11 },
  'my-studio': { s: 158 * ROUTE_K, side: -1, off: 9.5 },
  observatory: { s: SUMMIT_S, side: 1, off: 10 },
} as const

export const ROUTE_ORDER = ['print-house', 'brand-museum', 'cinema', 'arcade', 'experiment-lab', 'my-studio', 'observatory']

const BAY = { s: 64 * ROUTE_K, off: 8, r: 9 }
const CINEMA_LOBE = { s: STOPS.cinema.s, off: 13, r: 12 }
const STUDIO = STOPS['my-studio']
const bayCenter = routePoint(BAY.s, BAY.off)
const lobeCenter = routePoint(CINEMA_LOBE.s, CINEMA_LOBE.off)
/** Starting plaza just before the loop's origin, and the service center behind it. */
export const PLAZA = routePoint(-1, -2.3)
export const SERVICE_POINT = routePoint(-2, -11.2)
const plazaCenter = PLAZA
/** Observatory hilltop: the road climbs over its shoulder and winds back down. */
export const HILL_TOP = routePoint(SUMMIT_S, 5)
const HILL = { plateau: 12, radius: 58, height: 13 }

/** Park around the lab: open lawn with a pond. */
export const PARK = { center: routePoint(STOPS['experiment-lab'].s, 12), r: 14 }
export const POND = { center: routePoint(STOPS['experiment-lab'].s - 10, 12), r: 3.4 }

/** Smooth coastline wobble, sampled on the flat map. */
export function noise(d: THREE.Vector3) {
  const [px, py] = pointToPlan(d)
  const x = px / 40
  const y = py / 40
  return (
    Math.sin(x * 11 + 1.3) * Math.sin(y * 13 + 0.4) * 0.6 +
    Math.sin(x * 23 + y * 17) * 0.25 +
    Math.sin(y * 29 - x * 7) * 0.15
  )
}

/** Broad headlands and coves around the shore. */
function coves(d: THREE.Vector3) {
  const [px, py] = pointToPlan(d)
  const a = Math.atan2(py, px)
  return Math.sin(a * 5 + 0.7) * 0.6 + Math.sin(a * 9 - 1.1) * 0.4
}

/** Width of the sand band at `d` (beaches widen in coves, narrow on headlands). */
export function beachWidth(d: THREE.Vector3) {
  return 2.4 - coves(d) * 1.1 + noise(d) * 0.4
}

const arc = flatDistance

/** Signed distance-like land value: > 0 on land, < 0 at sea. */
const ROUTE_PLAN = ROUTE.map((d) => pointToPlan(d))

/** True when `d` lies inside the closed road loop. */
function insideLoop(d: THREE.Vector3) {
  const [x, y] = pointToPlan(d)
  let inside = false
  for (let i = 0, j = ROUTE_PLAN.length - 1; i < ROUTE_PLAN.length; j = i++) {
    const [xi, yi] = ROUTE_PLAN[i]
    const [xj, yj] = ROUTE_PLAN[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function landValue(d: THREE.Vector3, hit = nearestOnRoute(d)) {
  let w = 21 + noise(d) * 2 + coves(d) * 2.2
  if (hit.sign === STUDIO.side) {
    const k = Math.max(0, 1 - Math.abs(hit.s - STUDIO.s) / 16)
    w = THREE.MathUtils.lerp(w, 15.2, k)
  }
  let v = insideLoop(d) ? w + hit.dist : w - hit.dist
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

const BRIDGE_RISE = 1.5
const BRIDGE_MID = ROUTE[(BRIDGE.a + BRIDGE.b) >> 1]
const BRIDGE_REACH = (ROUTE_S[BRIDGE.b] - ROUTE_S[BRIDGE.a]) / 2 + 4

/** Arched deck height at road sample `i` (0 at both abutments). */
export function deckHeight(i: number) {
  const t = THREE.MathUtils.clamp((i - BRIDGE.a) / (BRIDGE.b - BRIDGE.a), 0, 1)
  return BRIDGE_RISE * Math.sin(Math.PI * t)
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

/** Ground height at `d` for bodies and props (arched on the bridge deck). */
export function groundHeight(d: THREE.Vector3) {
  if (flatDistance(d, BRIDGE_MID) < BRIDGE_REACH) {
    const hit = nearestOnRoute(d)
    if (onBridge(d, hit)) return deckHeight(hit.i)
  }
  return hillHeight(d)
}

/** World-space point on the terrain above ground point `d`, raised by `lift`. */
export function surf(d: THREE.Vector3, lift = 0) {
  return new THREE.Vector3(d.x, groundHeight(d) + lift, d.z)
}

/** Centre of the "MARC ISLAND" lettering in the sea south of the island. */
export const TITLE_CENTER = planPoint(0, -124)

/** Ground point of a CMS location: route stops sit at their slot, anything else at its map (lat, lon). */
export function locationPoint(l: { id: string; lat: number; lon: number }) {
  const st = (STOPS as Record<string, { s: number; side: number; off: number } | undefined>)[l.id]
  return st ? routePoint(st.s, st.side * st.off) : mapPoint(l.lat, l.lon)
}

/** Building, door, road-side stop and side-of-building parking for a landmark standing at `building`. */
export function locationAnchors(building: THREE.Vector3, id = ''): LocationAnchors {
  const hit = nearestOnRoute(building)
  const road = ROUTE[hit.i].clone()
  let facing = flatDir(road.clone().sub(building))
  if (facing.lengthSq() < 1e-10) facing = ROUTE_TAN[hit.i].clone()
  const front = (LANDMARK_FIT[id]?.front ?? 0) * BUILDING_SCALE + 0.6
  const door = moveToward(building, road, Math.max(BUILDING_RADIUS + 0.8, front))
  // bike stands against the frontage just beside the door, leaving the entrance clear
  const along = new THREE.Vector3().crossVectors(UP, facing).normalize()
  const toward = ROUTE_TAN[hit.i].dot(along) < 0 ? 1 : -1
  const parking = door
    .clone()
    .addScaledVector(along, toward * (LANDMARK_FIT[id]?.park ?? 2.6))
    .addScaledVector(facing, 0.5)
  return { building, road, parking, door, facing }
}

/** Collision circles covering a landmark's footprint (one circle unless the model is wider than deep). */
export function landmarkColliders(a: LocationAnchors, id: string) {
  const f = LANDMARK_FIT[id]
  if (!f) return [{ at: a.building, r: BUILDING_RADIUS }]
  const k = BUILDING_SCALE * f.scale
  const front = f.front * BUILDING_SCALE
  const back = f.back * k + landmarkSetback(id)
  const hw = f.halfWidth * k
  const r = (front + back) / 2
  const mid = (front - back) / 2
  const side = new THREE.Vector3().crossVectors(UP, a.facing).normalize()
  const span = Math.max(0, hw - r)
  const n = span > 0 ? Math.ceil((span * 2) / (r * 1.2)) + 1 : 1
  return Array.from({ length: n }, (_, i) => {
    const x = n === 1 ? 0 : -span + (span * 2 * i) / (n - 1)
    return { at: a.building.clone().addScaledVector(a.facing, mid).addScaledVector(side, x), r }
  })
}

/** Points other scenery keeps clear of: footprint centres plus the bike stand. */
export function landmarkBlockers(l: { id: string; lat: number; lon: number }) {
  const a = locationAnchors(locationPoint(l), l.id)
  return [a.building, a.parking, ...landmarkColliders(a, l.id).map((c) => c.at)]
}
