import { useMemo } from 'react'
import * as THREE from 'three'
import type { WorldLocation } from '../../shared/types'
import { NORTH, UP, flatDistance, pointToPlan, yawQuaternion } from './plane'
import {
  BRIDGE,
  PARK,
  PLAZA,
  POND,
  ROUTE,
  ROUTE_LEN,
  ROUTE_S,
  ROUTE_TAN,
  SERVICE_POINT,
  groundHeight,
  landValue,
  landmarkBlockers,
  type RouteHit,
} from './island'
import { type Ramp, type Stroke, Strokes, blob, column, pick, rng, rotateAbout, shade } from './strokes'
import { townLots } from './townLayout'

const flat = (colors: string[]): Ramp => ({ light: colors, mid: colors, dark: colors })

const ASPHALT: Ramp = { light: ['#8396a0', '#7a8e96'], mid: ['#6f848b', '#667a82', '#748990'], dark: ['#566870', '#5b6e76'] }
const MEADOW: Ramp = { light: ['#86bf84', '#9acb8c', '#7ab87e', '#a8d39a'], mid: ['#72b07e', '#5e9d6d', '#68a875'], dark: ['#4a8462', '#3f7a5c'] }
const BLADE = { light: ['#a8d993', '#c2e3a0', '#8fcf8a'], mid: ['#6aa874', '#5e9d6d', '#7fb483'], dark: ['#3f7a55', '#346b52'] }
const BUSH: Ramp = { light: ['#9fd48e', '#b7de9c', '#86c784'], mid: ['#5e9d6d', '#4f8f63', '#6aa874', '#3f7a55'], dark: ['#2f6650', '#28584a', '#244c46'] }
const CANOPY: Ramp = { light: ['#8fcf8a', '#a8d993'], mid: ['#4f8f5f', '#5e9d6d', '#62a06c'], dark: ['#2f6650', '#28584a'] }
const PINE: Ramp = { light: ['#6aa874', '#5e9d6d'], mid: ['#3f7a5a', '#386f52', '#447f5e'], dark: ['#244c46', '#2a5a48'] }
const TRUNK: Ramp = { light: ['#8a7f76'], mid: ['#6e6660', '#655d57'], dark: ['#4b4440'] }
const ROCK: Ramp = { light: ['#ece4cb', '#e3d8b8'], mid: ['#d9cfb2', '#cfc4a5'], dark: ['#b2a88c'] }
const SEA_FOAM = ['#e9f5f0', '#d6efe9', '#f4faf6']

const arc = flatDistance

export type SceneryKind = 'tree' | 'pine' | 'bush' | 'rock'
export interface ScenerySpot {
  d: THREE.Vector3
  yaw: number
  kind: SceneryKind
  s: number
}

/** Ground point `off` units to the side and `along` units ahead of road sample `i`. */
function besideRoad(i: number, off: number, along: number) {
  const tan = ROUTE_TAN[i]
  const side = new THREE.Vector3().crossVectors(UP, tan)
  return ROUTE[i].clone().addScaledVector(side, off).addScaledVector(tan, along)
}

/** Map local (y-up, z-forward) strokes onto the ground at `d`. */
function place(out: Stroke[], local: Stroke[], d: THREE.Vector3, fwd: THREE.Vector3, scale = 1) {
  const q = yawQuaternion(fwd)
  const base = new THREE.Vector3(d.x, groundHeight(d), d.z)
  for (const k of local) {
    out.push({
      p: k.p.clone().multiplyScalar(scale).applyQuaternion(q).add(base),
      n: k.n.clone().applyQuaternion(q),
      dir: k.dir.clone().applyQuaternion(q),
      len: k.len * scale,
      wid: k.wid * scale,
      color: k.color,
    })
  }
}

const onDeck = (i: number) => i >= BRIDGE.a - 2 && i <= BRIDGE.b + 2

/** Sparse dabs over the solid asphalt, with ragged edges that blend into the verge grass. */
function roadStrokes(out: Stroke[]) {
  const r = rng(41)
  const step = ROUTE_LEN / (ROUTE.length - 1)
  const local: Stroke[] = []
  for (let i = 0; i < ROUTE.length - 1; i++) {
    if (onDeck(i)) continue
    local.length = 0
    const band = (count: number, a: number, b: number, ramp: Ramp, lift: number, len: number, wid: number) => {
      for (let k = 0; k < count; k++) {
        const x = a + r() * (b - a)
        const p = new THREE.Vector3(x, lift + r() * 0.01, (r() - 0.5) * step)
        local.push({ p, n: UP, dir: rotateAbout(new THREE.Vector3(0, 0, 1), UP, (r() - 0.5) * 0.2), len: len * (0.7 + r() * 0.6), wid: wid * (0.7 + r() * 0.6), color: shade(r, UP, ramp) })
      }
    }
    band(r() < 0.5 ? 4 : 3, -1.7, 1.7, ASPHALT, 0.1, 0.8, 0.22)
    for (const sgn of [-1, 1]) {
      band(2, sgn * 1.75, sgn * 2.15, ASPHALT, 0.1, 0.7, 0.2)
      band(r() < 0.7 ? 1 : 0, sgn * 2, sgn * 2.4, MEADOW, 0.11, 0.6, 0.2)
    }
    place(out, local, ROUTE[i], ROUTE_TAN[i])
  }
}

interface Clear {
  buildings: THREE.Vector3[]
  lots: THREE.Vector3[]
}

function blocked(d: THREE.Vector3, c: Clear, pad: number) {
  if (arc(d, PLAZA) < 7.5 + pad || arc(d, SERVICE_POINT) < 9 + pad) return true
  if (arc(d, POND.center) < POND.r + 0.8) return true
  return c.buildings.some((b) => arc(b, d) < 5 + pad) || c.lots.some((b) => arc(b, d) < 3 + pad)
}

/** Dense, short, near-upright grass along both verges, plus sparse flat dabs over the open meadows. */
function grassStrokes(out: Stroke[], c: Clear) {
  const r = rng(77)
  const step = ROUTE_LEN / (ROUTE.length - 1)
  const local: Stroke[] = []
  const cell = 0.3
  for (let i = 0; i < ROUTE.length - 1; i++) {
    if (onDeck(i)) continue
    for (let a = -step / 2; a < step / 2; a += cell) {
      for (const sign of [-1, 1]) {
        for (let off = 2.15; off < 9; off += cell) {
          const o = sign * (off + r() * cell)
          const along = a + r() * cell
          const d = besideRoad(i, o, along)
          const hit: RouteHit = { i, s: ROUTE_S[i], dist: Math.abs(o), sign }
          if (landValue(d, hit) < 2.6) continue
          if (blocked(d, c, 0)) continue
          local.length = 0
          const yaw = r() * Math.PI
          const face = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw))
          const across = new THREE.Vector3(-face.z, 0, face.x)
          const dir = rotateAbout(UP, face, (r() - 0.5) * 0.25)
          const len = 0.22 + r() * 0.16
          const n = new THREE.Vector3().crossVectors(across, dir).normalize()
          const tone = r()
          const ramp = tone < 0.55 ? BLADE.mid : tone < 0.85 ? BLADE.light : BLADE.dark
          local.push({ p: dir.clone().multiplyScalar(len / 2), n, dir, len, wid: 0.07 + r() * 0.03, color: new THREE.Color(pick(r, ramp)) })
          place(out, local, d, ROUTE_TAN[i])
        }
      }
    }
  }
  // open meadow: flat colour dabs flowing in soft swirls
  const flow: Stroke[] = []
  for (let k = 0; k < 26000; k++) {
    const i = Math.floor(r() * (ROUTE.length - 1))
    const o = (r() * 2 - 1) * 45
    const d = besideRoad(i, o, (r() - 0.5) * step)
    if (Math.abs(o) < 2.1 || onDeck(i)) continue
    const hit: RouteHit = { i, s: ROUTE_S[i], dist: Math.abs(o), sign: o >= 0 ? 1 : -1 }
    if (landValue(d, hit) < 2.6) continue
    const [px, py] = pointToPlan(d)
    const f = Math.sin(px * 0.09) * 0.9 + Math.cos(py * 0.08) * 0.6
    flow.length = 0
    flow.push({ p: new THREE.Vector3(0, 0.03 + r() * 0.01, 0), n: UP, dir: new THREE.Vector3(Math.cos(f), 0, Math.sin(f)), len: 0.7 + r() * 0.7, wid: 0.22 + r() * 0.14, color: shade(r, UP, arc(d, PARK.center) < PARK.r ? flat(MEADOW.light) : MEADOW) })
    place(out, flow, d, NORTH)
  }
}

function sceneryStrokes(out: Stroke[], spots: ScenerySpot[]) {
  const r = rng(13)
  const local: Stroke[] = []
  for (const sp of spots) {
    local.length = 0
    if (sp.kind === 'tree') {
      column(local, r, new THREE.Vector3(0, 0, 0), 1.8, 0.16, TRUNK, 40)
      blob(local, r, new THREE.Vector3(0, 2.3, 0), 1.25, CANOPY, 110, 1.5)
      blob(local, r, new THREE.Vector3(0.55, 2.9, 0.2), 0.8, CANOPY, 110, 1.3)
      blob(local, r, new THREE.Vector3(-0.5, 2.6, -0.3), 0.75, CANOPY, 110, 1.3)
    } else if (sp.kind === 'pine') {
      column(local, r, new THREE.Vector3(0, 0, 0), 1.2, 0.13, TRUNK, 24)
      for (let k = 0; k < 4; k++) blob(local, r, new THREE.Vector3(0, 1.2 + k * 0.75, 0), 0.95 - k * 0.2, PINE, 150, 1.2)
    } else if (sp.kind === 'bush') {
      const lumps = 2 + Math.floor(r() * 3)
      for (let k = 0; k < lumps; k++) blob(local, r, new THREE.Vector3((r() - 0.5) * 1.1, 0.45 + r() * 0.2, (r() - 0.5) * 1.1), 0.5 + r() * 0.3, BUSH, 300, 0.85)
    } else {
      blob(local, r, new THREE.Vector3(0, 0.1, 0), 0.6, ROCK, 220, 0.9)
    }
    place(out, local, sp.d, NORTH.clone().applyAxisAngle(UP, sp.yaw), sp.s)
  }
}

/** Short white wave strokes drifting on the open sea. */
function foamStrokes(out: Stroke[]) {
  const r = rng(5)
  const local: Stroke[] = []
  let n = 0
  for (let k = 0; k < 6000 && n < 700; k++) {
    const i = Math.floor(r() * (ROUTE.length - 1))
    const o = (r() * 2 - 1) * 70
    const d = besideRoad(i, o, 0)
    if (landValue(d) > -2) continue
    local.length = 0
    local.push({ p: new THREE.Vector3(0, -0.8, 0), n: UP, dir: new THREE.Vector3(1, 0, 0), len: 1 + r() * 1.8, wid: 0.14 + r() * 0.1, color: new THREE.Color(pick(r, SEA_FOAM)) })
    place(out, local, d, ROUTE_TAN[i])
    n++
  }
}

/** Brush-stroke layer for the whole island ground: road grain, verge grass, meadows, foliage and sea foam. */
export function GroundPaint({ locations, scenery }: { locations: WorldLocation[]; scenery: ScenerySpot[] }) {
  const strokes = useMemo(() => {
    const clear: Clear = {
      buildings: locations.flatMap(landmarkBlockers),
      lots: townLots(locations).map((l) => l.at),
    }
    const out: Stroke[] = []
    roadStrokes(out)
    grassStrokes(out, clear)
    sceneryStrokes(out, scenery)
    foamStrokes(out)
    return out
  }, [locations, scenery])
  return <Strokes key={strokes.length} strokes={strokes} />
}

