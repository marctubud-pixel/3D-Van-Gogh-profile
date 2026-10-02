import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { WorldLocation } from '../../shared/types'
import { NORTH, UP, flatDir, flatDistance, yawQuaternion } from './plane'
import {
  PLAZA,
  POND,
  ROUTE,
  ROUTE_S,
  ROUTE_TAN,
  SERVICE_POINT,
  forecourt,
  forecourtWalk,
  groundHeight,
  landValue,
  landmarkBlockers,
  locationAnchors,
  locationPoint,
  nearestOnRoute,
  segmentDistance,
  onServiceSquare,
  wildBlocked,
} from './island'
import { type Ramp, type Stroke, Strokes, blob, column, pick, rng, rotateAbout, shade } from './strokes'
import { playerPos } from './occlusion'
import { townLots } from './townLayout'
import { toonMaterial } from './toon'
import { QUALITY, type QualityLevel, levelOf, useQuality } from './quality'


const BUSH: Ramp = { light: ['#9fd48e', '#b7de9c', '#86c784'], mid: ['#5e9d6d', '#4f8f63', '#6aa874', '#3f7a55'], dark: ['#2f6650', '#28584a', '#244c46'] }
const CANOPY: Ramp = { light: ['#8fcf8a', '#a8d993'], mid: ['#4f8f5f', '#5e9d6d', '#62a06c'], dark: ['#2f6650', '#28584a'] }
const FOREST_CANOPY: Ramp = { light: ['#7fbf7c', '#93c98a'], mid: ['#3f7f5a', '#4a8a60', '#367352'], dark: ['#21504a', '#1d4540', '#28584a'] }
const PINE: Ramp = { light: ['#6aa874', '#5e9d6d'], mid: ['#3f7a5a', '#386f52', '#447f5e'], dark: ['#244c46', '#2a5a48'] }
const POPLAR: Ramp = { light: ['#b9d27a', '#c6da86'], mid: ['#8fb35e', '#9cbc66', '#84a957'], dark: ['#5f8a4a', '#567f45'] }
const UMBRELLA: Ramp = { light: ['#7aa86a', '#86b273'], mid: ['#4d7f4f', '#447548', '#568856'], dark: ['#2c5440', '#27493a'] }
const BIRCH_LEAF: Ramp = { light: ['#d5e08e', '#c9db84'], mid: ['#a5c46c', '#97b962', '#b1cc74'], dark: ['#6f9550', '#668a4b'] }
const BIRCH_BARK: Ramp = { light: ['#f4f1e8', '#ece8dc'], mid: ['#e2ddcf', '#d9d3c4'], dark: ['#3f3a36', '#c8c1b2'] }
const TRUNK: Ramp = { light: ['#8a7f76'], mid: ['#6e6660', '#655d57'], dark: ['#4b4440'] }
const ROCK: Ramp = { light: ['#ece4cb', '#e3d8b8'], mid: ['#d9cfb2', '#cfc4a5'], dark: ['#b2a88c'] }
const PAVING: Ramp = { light: ['#c6cabf', '#cbc9bd'], mid: ['#b8beb2', '#b2b8ad', '#bfbfb2'], dark: ['#a6ada3', '#adb0a4'] }
const SEA_FOAM = ['#e9f5f0', '#d6efe9', '#f4faf6']

const arc = flatDistance
const ROAD_EDGE = 2.1

export type SceneryKind = 'tree' | 'tall' | 'poplar' | 'umbrella' | 'birch' | 'pine' | 'bush' | 'rock'
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

/** Terrain normal at `p`, from central differences of the ground height. */
function slopeNormal(p: THREE.Vector3) {
  const e = 0.4
  const gx = groundHeight(new THREE.Vector3(p.x + e, 0, p.z)) - groundHeight(new THREE.Vector3(p.x - e, 0, p.z))
  const gz = groundHeight(new THREE.Vector3(p.x, 0, p.z + e)) - groundHeight(new THREE.Vector3(p.x, 0, p.z - e))
  return new THREE.Vector3(-gx / (2 * e), 1, -gz / (2 * e)).normalize()
}

/** Tilt a flat stroke so it lies in the slope plane instead of poking out of the hillside. */
function conformToSlope(k: Stroke) {
  const n = slopeNormal(k.p)
  k.n = n
  k.dir = k.dir.clone().addScaledVector(n, -k.dir.dot(n)).normalize()
  return k
}

/** Map local (y-up, z-forward) strokes onto the ground at `d`; `conform` lays flat strokes along the slope. */
function place(out: Stroke[], local: Stroke[], d: THREE.Vector3, fwd: THREE.Vector3, scale = 1, conform = false) {
  const q = yawQuaternion(fwd)
  const base = new THREE.Vector3(d.x, 0, d.z)
  for (const k of local) {
    const p = k.p.clone().multiplyScalar(scale).applyQuaternion(q).add(base)
    p.y += groundHeight(p)
    const s: Stroke = {
      p,
      n: k.n.clone().applyQuaternion(q),
      dir: k.dir.clone().applyQuaternion(q),
      len: k.len * scale,
      wid: k.wid * scale,
      color: k.color,
    }
    out.push(conform ? conformToSlope(s) : s)
  }
}

/** Service plaza paving: pale strokes swept in rings around the centre, ragged at the rim. */
function plazaStrokes(out: Stroke[]) {
  const r = rng(23)
  const y = groundHeight(PLAZA) + 0.08
  for (let k = 0; k < 1500; k++) {
    const rad = 6.7 * Math.sqrt(r())
    const a = r() * Math.PI * 2
    const p = new THREE.Vector3(PLAZA.x + Math.cos(a) * rad, y + r() * 0.01, PLAZA.z + Math.sin(a) * rad)
    if (nearestOnRoute(p).dist < 2.3) continue
    const dir = rotateAbout(new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), UP, (r() - 0.5) * 0.5)
    out.push({ p, n: UP, dir, len: 0.35 + r() * 0.3, wid: 0.12 + r() * 0.08, color: shade(r, UP, PAVING) })
  }
}


const DASH = ['#eef1ea', '#f4f5ef', '#e3e7df']
const DASH_ON = 1.6
const DASH_PERIOD = 2.8

/** Centre-line dashes, each laid down as a few overlapping white strokes. */
function dashStrokes(out: Stroke[]) {
  const r = rng(19)
  const local: Stroke[] = []
  for (let i = 0; i < ROUTE.length - 1; i++) {
    if (ROUTE_S[i] % DASH_PERIOD > DASH_ON) continue
    local.length = 0
    for (let k = 0; k < 2; k++) {
      local.push({ p: new THREE.Vector3((r() - 0.5) * 0.05, 0.12 + r() * 0.01, (r() - 0.5) * 0.2), n: UP, dir: rotateAbout(new THREE.Vector3(0, 0, 1), UP, (r() - 0.5) * 0.08), len: 0.55 + r() * 0.2, wid: 0.13 + r() * 0.04, color: new THREE.Color(pick(r, DASH)) })
    }
    place(out, local, ROUTE[i], ROUTE_TAN[i], 1, true)
  }
}

const MEADOW_TONES = ['#1f4a45', '#2f6454', '#4d8556', '#72a35c', '#98bf6c', '#bad289'].map((c) => new THREE.Color(c))

/** 0 = deep teal shadow mass, 1 = sunlit yellow-green; large soft zones like blocked-in paint. */
export function meadowZone(x: number, z: number) {
  const v = Math.sin(x * 0.31 + Math.cos(z * 0.27) * 1.6) * 0.55 + Math.sin(z * 0.42 - x * 0.18) * 0.35 + Math.sin((x + z) * 0.9) * 0.1
  return THREE.MathUtils.clamp(0.55 + v * 0.55, 0, 1)
}

/** Colour along the meadow tone ramp, sampled at `t` in [0, 1]. */
export function meadowTone(t: number, out = new THREE.Color()) {
  const f = THREE.MathUtils.clamp(t, 0, 1) * (MEADOW_TONES.length - 1)
  const i = Math.min(Math.floor(f), MEADOW_TONES.length - 2)
  return out.copy(MEADOW_TONES[i]).lerp(MEADOW_TONES[i + 1], f - i)
}

const FLOWER = ['#e9c13c', '#f0d257', '#d9a92e']
const FLECK = ['#f2f0e2', '#b9d4e8', '#e6e8f2']

/**
 * Painted meadow after Van Gogh's green wheat fields: sickle-shaped blades that sweep up and arc over
 * downwind, toned from the local light/shadow zone so strokes read as masses rather than confetti.
 */
export function meadowBlades(out: Stroke[], r: () => number, x: number, z: number, count: number, y = 0, scale = 1) {
  const flow = windAngle(x, z)
  const zone = meadowZone(x, z)
  for (let b = 0; b < count; b++) {
    const yaw = flow + (r() - 0.5) * 0.5
    const w = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw))
    const across = new THREE.Vector3(-w.z, 0, w.x)
    const arched = r() < 0.65
    const lean = arched ? 0.15 + r() * 0.3 : (r() - 0.4) * 0.35
    const bend = arched ? 0.32 + r() * 0.2 : 0.06 + r() * 0.1
    const L = (arched ? 0.4 + r() * 0.3 : 0.22 + r() * 0.2) * (0.8 + zone * 0.4) * scale
    const segs = arched ? 4 : 2
    const seg = L / segs
    const wid = (0.09 + r() * 0.05) * scale
    const base = r() < 0.06 ? 0 : 0.12 + r() * 0.5 + (zone - 0.5) * 0.25
    const p = new THREE.Vector3(x + (r() - 0.5) * 0.16, y, z + (r() - 0.5) * 0.16)
    for (let k = 0; k < segs; k++) {
      const th = lean + bend * k
      const dir = UP.clone().multiplyScalar(Math.cos(th)).addScaledVector(w, Math.sin(th)).normalize()
      const n = new THREE.Vector3().crossVectors(across, dir).normalize()
      const lift = arched && k === segs - 2 && r() < 0.35 ? 0.35 : (k / segs) * 0.22
      out.push({ p: p.clone().addScaledVector(dir, seg / 2), n, dir, len: seg * 1.45, wid: wid * (1 - k * 0.15), color: meadowTone(base + lift) })
      p.addScaledVector(dir, seg)
    }
  }
  if (scale >= 0.6 && zone > 0.45 && r() < 0.012) {
    for (let k = 0; k < 5; k++) {
      const a = r() * Math.PI * 2
      out.push({ p: new THREE.Vector3(x + (r() - 0.5) * 0.5, y + 0.3 + r() * 0.2, z + (r() - 0.5) * 0.5), n: new THREE.Vector3(Math.cos(a), 0.6, Math.sin(a)).normalize(), dir: new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), len: 0.09, wid: 0.07, color: new THREE.Color(pick(r, FLOWER)) })
    }
  } else if (r() < 0.01) {
    out.push({ p: new THREE.Vector3(x, y + 0.25 + r() * 0.15, z), n: UP, dir: new THREE.Vector3(Math.cos(flow), 0, Math.sin(flow)), len: 0.07, wid: 0.05, color: new THREE.Color(pick(r, FLECK)) })
  }
}

/** Shared wind field: neighbouring blades bend the same way, so the lawn reads as flowing clumps. */
function windAngle(x: number, z: number) {
  return Math.sin(x * 0.21 + Math.cos(z * 0.17) * 1.3) * 1.4 + Math.cos(z * 0.13 - x * 0.07) * 0.9
}

interface Clear {
  buildings: THREE.Vector3[]
  lots: THREE.Vector3[]
  paths: PathSeg[]
}

interface PathSeg {
  a: THREE.Vector3
  b: THREE.Vector3
  half: number
  /** Landmark the path leads to; set on the main approach only, which gets the building's railing. */
  railing?: string
}

const SLAB = ['#d9d2bf', '#cfc8b4', '#e2dccb', '#c6c0ad', '#d6cdb6']

/** Footpaths from the road to entrances set well back from it, with a cross path halfway along long ones. */
function footpaths(locations: WorldLocation[]): PathSeg[] {
  const out: PathSeg[] = []
  for (const l of locations) {
    const a = locationAnchors(locationPoint(l), l.id)
    const dir = flatDir(a.door.clone().sub(a.road))
    const start = a.road.clone().addScaledVector(dir, ROAD_EDGE)
    const len = flatDistance(start, a.door)
    if (len < 2.5) continue
    out.push({ a: start, b: a.door.clone(), half: 0.75, railing: l.id })
    if (len < 5) continue
    const mid = start.clone().lerp(a.door, 0.5)
    const across = new THREE.Vector3().crossVectors(UP, dir)
    out.push({ a: mid.clone().addScaledVector(across, -2.8), b: mid.clone().addScaledVector(across, 2.8), half: 0.5 })
  }
  return out
}

const onPath = (d: THREE.Vector3, paths: PathSeg[], pad = 0) => paths.some((s) => segmentDistance(d, s.a, s.b) < s.half + pad)

type Railing = 'stanchion' | 'barrier' | 'picket'

/** Approach railing per landmark: velvet-rope stanchions, crowd barriers or a painted picket fence. */
const RAILING: Record<string, { kind: Railing; post: string; rail: string }> = {
  cinema: { kind: 'stanchion', post: '#d6a63c', rail: '#a8323a' },
  'experiment-lab': { kind: 'barrier', post: '#c9d0d4', rail: '#e0573a' },
  arcade: { kind: 'stanchion', post: '#3fb7c4', rail: '#6d3a96' },
  'brand-museum': { kind: 'picket', post: '#f1ece0', rail: '#e5ddcb' },
  'print-house': { kind: 'picket', post: '#a07a45', rail: '#8c6a3c' },
  'my-studio': { kind: 'picket', post: '#e2b13c', rail: '#d39a2c' },
  observatory: { kind: 'barrier', post: '#2f3a56', rail: '#46557a' },
}

interface Block {
  p: THREE.Vector3
  yaw: number
  s: [number, number, number]
  c: string
}

/** Separate stepping slabs down each footpath plus the landmark's own railing along the main approach. */
function pathBlocks(paths: PathSeg[]) {
  const r = rng(61)
  const out: Block[] = []
  const put = (p: THREE.Vector3, yaw: number, s: [number, number, number], c: string, lift = 0) =>
    out.push({ p: new THREE.Vector3(p.x, groundHeight(p) + lift + s[1] / 2, p.z), yaw, s, c })
  for (const seg of paths) {
    const dir = flatDir(seg.b.clone().sub(seg.a))
    const across = new THREE.Vector3().crossVectors(UP, dir)
    const yaw = Math.atan2(dir.x, dir.z)
    const len = flatDistance(seg.a, seg.b)
    const rows = Math.floor(len / 0.78)
    for (let k = 0; k < rows; k++) {
      const at = seg.a.clone().addScaledVector(dir, (k + 0.5) * (len / rows))
      const two = seg.half > 0.6 && k % 2 === 0
      const pieces = two ? [-0.5, 0.5] : [0]
      for (const o of pieces) {
        const w = two ? seg.half * 0.92 : seg.half * 1.6
        const p = at.clone().addScaledVector(across, o * seg.half * 1.02 + (r() - 0.5) * 0.06)
        put(p, yaw + (r() - 0.5) * 0.12, [w, 0.07, 0.56 + r() * 0.08], pick(r, SLAB), -0.015)
      }
    }
    const style = seg.railing ? RAILING[seg.railing] : undefined
    if (!style) continue
    const from = 0.6
    const to = len - 1.4
    const n = Math.max(1, Math.round((to - from) / 1.4))
    const step = (to - from) / n
    for (const sgn of [-1, 1]) {
      for (let k = 0; k <= n; k++) {
        const at = seg.a.clone().addScaledVector(dir, from + k * step).addScaledVector(across, sgn * (seg.half + 0.45))
        if (style.kind === 'stanchion') {
          put(at, yaw, [0.1, 0.85, 0.1], style.post)
          put(at, yaw, [0.26, 0.05, 0.26], style.post)
        } else if (style.kind === 'barrier') {
          put(at, yaw, [0.07, 0.95, 0.07], style.post)
          put(at, yaw, [0.07, 0.05, 0.5], style.post)
        } else put(at, yaw, [0.11, 0.7, 0.11], style.post)
        if (k === n) continue
        const mid = at.clone().addScaledVector(dir, step / 2)
        if (style.kind === 'stanchion') put(mid, yaw, [0.05, 0.06, step], style.rail, 0.66)
        else if (style.kind === 'barrier') {
          put(mid, yaw, [0.05, 0.06, step], style.post, 0.86)
          put(mid, yaw, [0.05, 0.06, step], style.post, 0.2)
          put(mid, yaw, [0.035, 0.22, step * 0.9], style.rail, 0.55)
          for (const f of [-0.25, 0, 0.25]) put(mid.clone().addScaledVector(dir, f * step), yaw, [0.03, 0.62, 0.03], style.post, 0.24)
        } else {
          put(mid, yaw, [0.06, 0.08, step], style.rail, 0.5)
          put(mid, yaw, [0.06, 0.08, step], style.rail, 0.22)
        }
      }
    }
  }
  return out
}

/** All footpath slabs and railings in one instanced draw. */
function PathStones({ paths }: { paths: PathSeg[] }) {
  const blocks = useMemo(() => pathBlocks(paths), [paths])
  const geom = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const mat = useMemo(() => new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: toonMaterial('#fff').gradientMap }), [])
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    blocks.forEach((b, i) => {
      o.position.copy(b.p)
      o.rotation.set(0, b.yaw, 0)
      o.scale.set(...b.s)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, c.set(b.c))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [blocks])
  if (!blocks.length) return null
  return <instancedMesh key={blocks.length} ref={ref} args={[geom, mat, blocks.length]} castShadow receiveShadow />
}

function paved(d: THREE.Vector3, pad: number) {
  return arc(d, PLAZA) < 7.5 + pad || arc(d, SERVICE_POINT) < 6 + pad || onServiceSquare(d, pad + 0.4) || arc(d, POND.center) < POND.r + 0.8
}

/** Bare ground round buildings: no grass in landmark forecourts or house front yards. */
const bareYard = (d: THREE.Vector3, c: Clear) => forecourt(d, 0.6) || c.lots.some((b) => arc(b, d) < 6.5)

function nearBuilding(d: THREE.Vector3, c: Clear, pad: number) {
  return c.buildings.some((b) => arc(b, d) < 5 + pad) || c.lots.some((b) => arc(b, d) < 3 + pad)
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
    } else if (sp.kind === 'tall') {
      // slender trunk and a high, layered crown like the woodland in the reference art
      const lean = new THREE.Vector3((r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5)
      column(local, r, new THREE.Vector3(0, 0, 0), 3.6, 0.17, TRUNK, 70)
      const top = new THREE.Vector3(0, 3.8, 0).add(lean)
      blob(local, r, top, 1.35, FOREST_CANOPY, 80, 1.6)
      for (let k = 0; k < 3; k++) {
        const a = r() * Math.PI * 2
        blob(local, r, top.clone().add(new THREE.Vector3(Math.cos(a) * 0.9, 0.4 + r() * 0.9, Math.sin(a) * 0.9)), 0.8 + r() * 0.35, FOREST_CANOPY, 80, 1.4)
      }
    } else if (sp.kind === 'poplar') {
      // columnar Lombardy poplar: short trunk, tall narrow flame of a crown
      column(local, r, new THREE.Vector3(0, 0, 0), 1.1, 0.12, TRUNK, 24)
      for (let k = 0; k < 7; k++) {
        const t = k / 6
        blob(local, r, new THREE.Vector3((r() - 0.5) * 0.15, 1.3 + k * 0.55, (r() - 0.5) * 0.15), 0.62 * (1 - t * 0.55), POPLAR, 120, 1.1)
      }
    } else if (sp.kind === 'umbrella') {
      // Mediterranean stone pine: bare leaning trunk under a broad flat crown
      const lean = new THREE.Vector3((r() - 0.5) * 0.8, 0, (r() - 0.5) * 0.8)
      for (let k = 0; k < 8; k++) {
        const t = k / 8
        column(local, r, lean.clone().multiplyScalar(t).setY(t * 3), 0.38, 0.13, TRUNK, 6)
      }
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + r()
        blob(local, r, lean.clone().add(new THREE.Vector3(Math.cos(a) * 0.9, 3.1 + r() * 0.25, Math.sin(a) * 0.9)), 0.85, UMBRELLA, 90, 1.5)
      }
    } else if (sp.kind === 'birch') {
      // slim white-barked birch with a light, airy crown
      column(local, r, new THREE.Vector3(0, 0, 0), 2.9, 0.09, BIRCH_BARK, 60)
      for (let k = 0; k < 5; k++) {
        const a = r() * Math.PI * 2
        blob(local, r, new THREE.Vector3(Math.cos(a) * 0.5, 2.3 + r() * 1.3, Math.sin(a) * 0.5), 0.5, BIRCH_LEAF, 120, 1.1)
      }
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

const WAVE_DEEP = ['#2c6890', '#295f86', '#33729a']
const WAVE_MID = ['#3c88aa', '#4594b2', '#3a80a3']
const WAVE_LIGHT = ['#6db6c2', '#79c1c4', '#62abbb']
const WAVE_SHALLOW = ['#8fd3cb', '#9edbd0', '#7fc9c4']
const WAVE_CAP = ['#f2f7f1', '#e3f1ee', '#d2ebe8']
const SWELL = new THREE.Vector3(0.35, 0, -1).normalize()
const CREST = new THREE.Vector3().crossVectors(UP, SWELL)

/**
 * Painted sea after Van Gogh's Saintes-Maries seascapes: rows of swell drawn as long crest-wise
 * strokes banded deep ultramarine → turquoise toward each crest, curled white caps on the crests,
 * and pale breaker lines following the shore.
 */
function seaStrokes(out: Stroke[]) {
  const r = rng(91)
  const step = 1.3
  for (let x = -110; x < 130; x += step) {
    for (let z = -120; z < 128; z += step) {
      const p = new THREE.Vector3(x + (r() - 0.5) * step, 0, z + (r() - 0.5) * step)
      const land = landValue(p)
      if (land > -0.3) continue
      p.y = -THREE.MathUtils.clamp(0.3 - land * 0.25, 0.3, 0.9) + 0.04 + r() * 0.01
      const along = p.dot(SWELL)
      const across = p.dot(CREST)
      const ph = along * 0.55 + Math.sin(across * 0.08 + along * 0.03) * 2.2
      const w = 0.5 + 0.5 * Math.sin(ph)
      const dir = rotateAbout(CREST, UP, Math.cos(ph) * 0.35 + (r() - 0.5) * 0.25)
      const tones = land > -2.4 ? WAVE_SHALLOW : w > 0.8 ? WAVE_LIGHT : w > 0.4 ? WAVE_MID : WAVE_DEEP
      out.push({ p, n: UP, dir, len: 1.3 + r() * 1.1, wid: 0.3 + r() * 0.2, color: new THREE.Color(pick(r, tones)) })
      if (land < -2.4 && w > 0.94 && r() < 0.3) {
        // a curling white cap: three strokes bending over the crest
        for (let j = 0; j < 3; j++) {
          const a = j * 0.75
          const c = p.clone().addScaledVector(CREST, Math.cos(a) * 0.45).addScaledVector(SWELL, Math.sin(a) * 0.45)
          c.y += 0.01
          const t = CREST.clone().multiplyScalar(-Math.sin(a)).addScaledVector(SWELL, Math.cos(a)).normalize()
          out.push({ p: c, n: UP, dir: t, len: 0.55, wid: 0.13 - j * 0.03, color: new THREE.Color(pick(r, WAVE_CAP)) })
        }
      } else if (land > -1.6 && land < -0.5 && r() < 0.6) {
        // breaker line running along the coast
        const e = 0.6
        const gx = landValue(new THREE.Vector3(p.x + e, 0, p.z)) - landValue(new THREE.Vector3(p.x - e, 0, p.z))
        const gz = landValue(new THREE.Vector3(p.x, 0, p.z + e)) - landValue(new THREE.Vector3(p.x, 0, p.z - e))
        const coast = new THREE.Vector3(-gz, 0, gx).normalize()
        if (coast.lengthSq() > 0.5) out.push({ p: p.clone().setY(p.y + 0.015), n: UP, dir: coast, len: 1.2 + r() * 0.8, wid: 0.1 + r() * 0.06, color: new THREE.Color(pick(r, WAVE_CAP)) })
      }
    }
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

const TILE = 12
const ISLAND_TILES = { i0: -10, i1: 11, j0: -11, j1: 11 }
const LOD = [
  (q: QualityLevel) => ({ spacing: QUALITY[q].grassSpacing, count: 2, scale: QUALITY[q].grassScale }),
  () => ({ spacing: 0.42, count: 2, scale: 1.5 }),
  () => ({ spacing: 1.0, count: 2, scale: 2.6 }),
]
/** Distant tiles are batched FAR_CHUNK × FAR_CHUNK into one draw. */
const FAR_CHUNK = 3
const tileCache = new Map<string, Stroke[]>()

/** Painted meadow for one ground tile; higher `lod` levels are sparser with broader blades for distance. */
function meadowTile(tx: number, tz: number, lod: number, q: QualityLevel, c: Clear) {
  const key = `${tx},${tz},${lod},${q}`
  let out = tileCache.get(key)
  if (out) return out
  out = []
  const r = rng(tx * 7919 + tz * 104729 + lod * 31 + 17)
  const { spacing, count, scale } = LOD[lod](q)
  const d = new THREE.Vector3()
  for (let x = tx * TILE; x < (tx + 1) * TILE; x += spacing) {
    for (let z = tz * TILE; z < (tz + 1) * TILE; z += spacing) {
      d.set(x + (r() - 0.5) * spacing, 0, z + (r() - 0.5) * spacing)
      const hit = nearestOnRoute(d)
      if (hit.dist < 2.15 || landValue(d, hit) < 2.6 || paved(d, 0) || bareYard(d, c) || wildBlocked(d, 0.3) || onPath(d, c.paths, 0.1)) continue
      const low = nearBuilding(d, c, -1.8) ? 0.3 : nearBuilding(d, c, 0) ? 0.5 : 1
      meadowBlades(out, r, d.x, d.z, count, groundHeight(d), scale * low)
    }
  }
  if (tileCache.size > 700) tileCache.delete(tileCache.keys().next().value as string)
  tileCache.set(key, out)
  return out
}

/** Meadow over the whole island in tiles: dense around the player, sparser and broader further out. */
/** Grass-free ground: flat, flowing colour dabs lying on the meadow, one draw for the whole island. */
function flatMeadow(c: Clear) {
  const out: Stroke[] = []
  const r = rng(4242)
  const step = 0.7
  const d = new THREE.Vector3()
  const { i0, i1, j0, j1 } = ISLAND_TILES
  for (let x = i0 * TILE; x < (i1 + 1) * TILE; x += step) {
    for (let z = j0 * TILE; z < (j1 + 1) * TILE; z += step) {
      d.set(x + (r() - 0.5) * step, 0, z + (r() - 0.5) * step)
      const hit = nearestOnRoute(d)
      if (hit.dist < 2.1 || landValue(d, hit) < 2.6 || paved(d, 0) || bareYard(d, c) || wildBlocked(d, 0.3) || onPath(d, c.paths, 0.1)) continue
      const f = windAngle(d.x, d.z)
      const zone = meadowZone(d.x, d.z)
      out.push(
        conformToSlope({
          p: new THREE.Vector3(d.x, groundHeight(d) + 0.03 + r() * 0.01, d.z),
          n: UP,
          dir: new THREE.Vector3(Math.cos(f), 0, Math.sin(f)),
          len: 0.8 + r() * 0.7,
          wid: 0.24 + r() * 0.14,
          color: meadowTone(0.15 + r() * 0.5 + (zone - 0.5) * 0.3),
        }),
      )
    }
  }
  return out
}

/** A few flat lawn dabs on the green beside the paved forecourt walks; never grass blades. */
function yardStrokes(c: Clear) {
  const out: Stroke[] = []
  const r = rng(977)
  const step = 1.1
  const d = new THREE.Vector3()
  const { i0, i1, j0, j1 } = ISLAND_TILES
  for (let x = i0 * TILE; x < (i1 + 1) * TILE; x += step) {
    for (let z = j0 * TILE; z < (j1 + 1) * TILE; z += step) {
      d.set(x + (r() - 0.5) * step, 0, z + (r() - 0.5) * step)
      if (!forecourt(d, 0.6) || r() > 0.55) continue
      if (forecourtWalk(d) || nearestOnRoute(d).dist < 2.2 || paved(d, 0) || onPath(d, c.paths, 0.2)) continue
      const f = windAngle(d.x, d.z)
      out.push(
        conformToSlope({
          p: new THREE.Vector3(d.x, groundHeight(d) + 0.03, d.z),
          n: UP,
          dir: new THREE.Vector3(Math.cos(f), 0, Math.sin(f)),
          len: 0.7 + r() * 0.5,
          wid: 0.18 + r() * 0.1,
          color: meadowTone(0.35 + r() * 0.4),
        }),
      )
    }
  }
  return out
}

function YardLawn({ clear }: { clear: Clear }) {
  const strokes = useMemo(() => yardStrokes(clear), [clear])
  return <Strokes key={strokes.length} strokes={strokes} />
}

function FlatMeadow({ clear }: { clear: Clear }) {
  const strokes = useMemo(() => flatMeadow(clear), [clear])
  return <Strokes key={strokes.length} strokes={strokes} />
}

function Meadow({ clear }: { clear: Clear }) {
  const [tiles, setTiles] = useState<string[]>([])
  const last = useRef(0)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (t - last.current < 0.4) return
    last.current = t
    const q = levelOf(useQuality.getState())
    const { near, far } = QUALITY[q]
    const want: string[] = []
    const { i0, i1, j0, j1 } = ISLAND_TILES
    for (let ci = i0; ci <= i1; ci += FAR_CHUNK) {
      for (let cj = j0; cj <= j1; cj += FAR_CHUNK) {
        const cell: string[] = []
        for (let i = ci; i < Math.min(ci + FAR_CHUNK, i1 + 1); i++) {
          for (let j = cj; j < Math.min(cj + FAR_CHUNK, j1 + 1); j++) {
            const dist = Math.hypot((i + 0.5) * TILE - playerPos.x, (j + 0.5) * TILE - playerPos.z)
            const lod = dist < near ? 0 : dist < far ? 1 : 2
            cell.push(`${i},${j},${lod},${lod === 0 ? q : 'high'}`)
          }
        }
        if (cell.every((k) => k.endsWith(',2,high'))) want.push(cell.join(';'))
        else want.push(...cell)
      }
    }
    const next = want.join('|')
    if (next !== tiles.join('|')) setTiles(want)
  })
  return (
    <>
      {tiles.map((k) => (
        <MeadowTile key={k} id={k} clear={clear} />
      ))}
    </>
  )
}

function MeadowTile({ id, clear }: { id: string; clear: Clear }) {
  const strokes = useMemo(
    () =>
      id.split(';').flatMap((k) => {
        const [tx, tz, lod, q] = k.split(',')
        return meadowTile(Number(tx), Number(tz), Number(lod), q as QualityLevel, clear)
      }),
    [id, clear],
  )
  return strokes.length ? <Strokes strokes={strokes} /> : null
}

/** Brush-stroke layer for the whole island ground: road grain, meadow, foliage and sea foam. */
export function GroundPaint({ locations, scenery }: { locations: WorldLocation[]; scenery: ScenerySpot[] }) {
  const clear = useMemo<Clear>(
    () => ({ buildings: locations.flatMap(landmarkBlockers), lots: townLots(locations).map((l) => l.at), paths: footpaths(locations) }),
    [locations],
  )
  const grass = useQuality((s) => s.grass)
  const strokes = useMemo(() => {
    const out: Stroke[] = []
    plazaStrokes(out)
    dashStrokes(out)
    sceneryStrokes(out, scenery)
    seaStrokes(out)
    foamStrokes(out)
    return out
  }, [scenery])
  return (
    <>
      <Strokes key={strokes.length} strokes={strokes} />
      <PathStones paths={clear.paths} />
      <YardLawn clear={clear} />
      {grass ? <Meadow clear={clear} /> : <FlatMeadow clear={clear} />}
    </>
  )
}
