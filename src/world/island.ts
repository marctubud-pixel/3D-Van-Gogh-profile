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
/** Channel linking the bay under the bridge to the open sea, so water flows on both sides of the deck. */
const CHANNEL = { a: routePoint(BAY.s, 2), b: routePoint(BAY.s, -30), r: 5 }
const lobeCenter = routePoint(CINEMA_LOBE.s, CINEMA_LOBE.off)
/** Starting plaza just before the loop's origin, and the service center behind it. */
export const PLAZA = routePoint(-1, -2.3)
export const SERVICE_POINT = routePoint(-2, -11.2)
/** Civic square around the service center, in its model frame (x along the road, z toward it). */
export const SERVICE_SQUARE = { x: 10, back: -3.4, wingBack: -1.6, front: 5.2 } as const
let serviceFrame: { f: THREE.Vector3; s: THREE.Vector3 } | null = null
function serviceAxes() {
  if (!serviceFrame) {
    const f = locationAnchors(SERVICE_POINT).facing.clone()
    serviceFrame = { f, s: new THREE.Vector3().crossVectors(UP, f).normalize() }
  }
  return serviceFrame
}
/** World point at model coords (x, z) of the service square. */
export function servicePoint(x: number, z: number) {
  const { f, s } = serviceAxes()
  return SERVICE_POINT.clone().addScaledVector(s, x * BUILDING_SCALE).addScaledVector(f, z * BUILDING_SCALE)
}
/** True when `p` lies on the paved civic square (with `pad` world units of margin). */
export function onServiceSquare(p: THREE.Vector3, pad = 0) {
  const { f, s } = serviceAxes()
  const d = p.clone().sub(SERVICE_POINT).setY(0)
  const x = Math.abs(d.dot(s)) / BUILDING_SCALE
  const z = d.dot(f) / BUILDING_SCALE
  const k = pad / BUILDING_SCALE
  const back = x < 4.5 ? SERVICE_SQUARE.back : SERVICE_SQUARE.wingBack
  return x < SERVICE_SQUARE.x + k && z > back - k && z < SERVICE_SQUARE.front + k
}
/** Extra blocker points covering the square's side wings. */
export const serviceWings = () => [servicePoint(-7, 1.5), servicePoint(7, 1.5)]
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

export function segmentDistance(d: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) {
  const abx = b.x - a.x
  const abz = b.z - a.z
  const t = THREE.MathUtils.clamp(((d.x - a.x) * abx + (d.z - a.z) * abz) / (abx * abx + abz * abz), 0, 1)
  return Math.hypot(d.x - a.x - abx * t, d.z - a.z - abz * t)
}

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
  v = Math.min(v, arc(d, bayCenter) - BAY.r, segmentDistance(d, CHANNEL.a, CHANNEL.b) - CHANNEL.r - noise(d) * 0.6)
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
  return hit.i >= BRIDGE.a && hit.i <= BRIDGE.b && hit.dist < 3.2
}

const BRIDGE_RISE = 1.5
const BRIDGE_MID = ROUTE[(BRIDGE.a + BRIDGE.b) >> 1]
const BRIDGE_REACH = (ROUTE_S[BRIDGE.b] - ROUTE_S[BRIDGE.a]) / 2 + 4

/** Deck height at arc length `s`: a gentle hump that meets both abutments with zero slope. */
export function deckAt(s: number) {
  const t = THREE.MathUtils.clamp((s - ROUTE_S[BRIDGE.a]) / (ROUTE_S[BRIDGE.b] - ROUTE_S[BRIDGE.a]), 0, 1)
  return BRIDGE_RISE * Math.sin(Math.PI * t) ** 2
}

/** Deck height at road sample `i`. */
export const deckHeight = (i: number) => deckAt(ROUTE_S[i])

/** Continuous arc length of `d` projected onto the road around sample `hit.i`. */
function projectedS(d: THREE.Vector3, hit: RouteHit) {
  const p = ROUTE[hit.i]
  const t = ROUTE_TAN[hit.i]
  return hit.s + (d.x - p.x) * t.x + (d.z - p.z) * t.z
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

interface Pad {
  c: THREE.Vector3
  f: THREE.Vector3
  side: THREE.Vector3
  hw: number
  front: number
  back: number
  reach: number
  h: number
}

const PAD_FEATHER = 3
let pads: Pad[] | null = null

/** Level building plots for the route landmarks, at the height of the ground outside each door. */
function landmarkPads() {
  pads ??= Object.keys(STOPS).map((id) => {
    const a = locationAnchors(locationPoint({ id, lat: 0, lon: 0 }), id)
    const fit = LANDMARK_FIT[id]
    const k = BUILDING_SCALE * (fit?.scale ?? 1)
    const hw = (fit?.halfWidth ?? 4.2) * k + 0.8
    const front = flatDistance(a.door, a.building) + 0.6
    const back = (fit?.back ?? 3.3) * k + landmarkSetback(id) + 0.8
    return { c: a.building, f: a.facing, side: new THREE.Vector3().crossVectors(UP, a.facing).normalize(), hw, front, back, reach: Math.hypot(hw, Math.max(front, back)) + PAD_FEATHER, h: hillHeight(a.door) }
  })
  return pads
}

/** Terrain with landmark plots levelled so building floors sit flush with the ground around them. */
export function terrainHeight(d: THREE.Vector3) {
  let h = hillHeight(d)
  for (const p of landmarkPads()) {
    if (flatDistance(d, p.c) > p.reach) continue
    const dx = d.x - p.c.x
    const dz = d.z - p.c.z
    const x = Math.abs(dx * p.side.x + dz * p.side.z)
    const z = dx * p.f.x + dz * p.f.z
    const e = Math.max(x - p.hw, z - p.front, -z - p.back, 0)
    const w = 1 - THREE.MathUtils.smoothstep(e, 0, PAD_FEATHER)
    h += (p.h - h) * w
  }
  return h
}

/** Ground height at `d` for bodies and props (arched on the bridge deck). */
export function groundHeight(d: THREE.Vector3) {
  if (flatDistance(d, BRIDGE_MID) < BRIDGE_REACH) {
    const hit = nearestOnRoute(d)
    if (onBridge(d, hit)) return deckAt(projectedS(d, hit))
  }
  return terrainHeight(d)
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

/** Woodland in the loop's southern interior, crossed by a creek that runs from a rock spring into the bay. */
export const FOREST = { center: planPoint(15, -25), r: 24 }
const CREEK_PLAN: [number, number][] = [
  [-6, -36], [2, -31], [10, -30], [18, -33], [25, -32], [32, -27], [38, -22], [45, -19], [50, -18], [56, -17], [61, -16],
]
export const CREEK = new THREE.CatmullRomCurve3(CREEK_PLAN.map(([x, y]) => planPoint(x, y))).getSpacedPoints(140)
const CREEK_BOX = (() => {
  const b = new THREE.Box3().setFromPoints(CREEK)
  return b.expandByScalar(4)
})()
/** Half-width of the creek at polyline sample `i` (widens toward the mouth). */
export const creekHalf = (i: number) => 0.9 + (i / (CREEK.length - 1)) * 0.9

/** Distance from `d` to the creek's water edge (negative inside the water); Infinity well away from it. */
export function creekEdge(d: THREE.Vector3) {
  if (d.x < CREEK_BOX.min.x || d.x > CREEK_BOX.max.x || d.z < CREEK_BOX.min.z || d.z > CREEK_BOX.max.z) return Infinity
  let best = Infinity
  for (let i = 0; i < CREEK.length - 1; i++) {
    const a = CREEK[i]
    const b = CREEK[i + 1]
    const abx = b.x - a.x
    const abz = b.z - a.z
    const t = THREE.MathUtils.clamp(((d.x - a.x) * abx + (d.z - a.z) * abz) / (abx * abx + abz * abz), 0, 1)
    const e = Math.hypot(d.x - a.x - abx * t, d.z - a.z - abz * t) - creekHalf(i + t)
    if (e < best) best = e
  }
  return best
}

/** Sandstone outcrops with mossy tops, after the cliffs in the reference art. */
export const MESAS = [
  { at: planPoint(-8, -38), r: 5.5, h: 9, seed: 1 },
  { at: planPoint(32, -38), r: 4.5, h: 6.5, seed: 2 },
  { at: planPoint(5, -46), r: 5, h: 7.5, seed: 3 },
  { at: planPoint(40, -34), r: 4.5, h: 6, seed: 4 },
  { at: planPoint(25, -10), r: 4, h: 5.5, seed: 5 },
]

/** True where the ground is creek water or under an outcrop (no grass, props or houses there). */
export function wildBlocked(d: THREE.Vector3, pad = 0) {
  return creekEdge(d) < pad || MESAS.some((m) => flatDistance(d, m.at) < m.r + pad)
}
