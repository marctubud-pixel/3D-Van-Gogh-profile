import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { WorldLocation } from '../../shared/types'
import { NORTH, UP, flatDistance, yawQuaternion } from './plane'
import {
  BRIDGE,
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
  nearestOnRoute,
} from './island'
import { type Ramp, type Stroke, Strokes, blob, column, pick, rng, rotateAbout, shade } from './strokes'
import { playerPos } from './occlusion'
import { townLots } from './townLayout'
import { QUALITY, type QualityLevel, levelOf, useQuality } from './quality'


const ASPHALT: Ramp = { light: ['#8396a0', '#7a8e96'], mid: ['#6f848b', '#667a82', '#748990'], dark: ['#566870', '#5b6e76'] }
const BUSH: Ramp = { light: ['#9fd48e', '#b7de9c', '#86c784'], mid: ['#5e9d6d', '#4f8f63', '#6aa874', '#3f7a55'], dark: ['#2f6650', '#28584a', '#244c46'] }
const CANOPY: Ramp = { light: ['#8fcf8a', '#a8d993'], mid: ['#4f8f5f', '#5e9d6d', '#62a06c'], dark: ['#2f6650', '#28584a'] }
const PINE: Ramp = { light: ['#6aa874', '#5e9d6d'], mid: ['#3f7a5a', '#386f52', '#447f5e'], dark: ['#244c46', '#2a5a48'] }
const TRUNK: Ramp = { light: ['#8a7f76'], mid: ['#6e6660', '#655d57'], dark: ['#4b4440'] }
const ROCK: Ramp = { light: ['#ece4cb', '#e3d8b8'], mid: ['#d9cfb2', '#cfc4a5'], dark: ['#b2a88c'] }
const PAVING: Ramp = { light: ['#c6cabf', '#cbc9bd'], mid: ['#b8beb2', '#b2b8ad', '#bfbfb2'], dark: ['#a6ada3', '#adb0a4'] }
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

const onDeck = (i: number) => i >= BRIDGE.a - 2 && i <= BRIDGE.b + 2

/** Sparse dabs over the solid asphalt, with ragged edges that blend into the verge grass. */
function roadStrokes(out: Stroke[]) {
  const r = rng(41)
  const step = ROUTE_LEN / (ROUTE.length - 1)
  const local: Stroke[] = []
  for (let i = 0; i < ROUTE.length - 1; i++) {
    if (onDeck(i) || arc(ROUTE[i], PLAZA) < 7) continue
    local.length = 0
    const band = (count: number, a: number, b: number, ramp: Ramp, lift: number, len: number, wid: number) => {
      for (let k = 0; k < count; k++) {
        const x = a + r() * (b - a)
        const p = new THREE.Vector3(x, lift + r() * 0.01, (r() - 0.5) * step)
        local.push({ p, n: UP, dir: rotateAbout(new THREE.Vector3(0, 0, 1), UP, (r() - 0.5) * 0.2), len: len * (0.7 + r() * 0.6), wid: wid * (0.7 + r() * 0.6), color: shade(r, UP, ramp) })
      }
    }
    band(r() < 0.5 ? 3 : 2, -1.7, 1.7, ASPHALT, 0.1, 1.7, 0.13)
    for (const sgn of [-1, 1]) {
      band(1, sgn * 1.75, sgn * 2.15, ASPHALT, 0.1, 1.4, 0.13)
    }
    place(out, local, ROUTE[i], ROUTE_TAN[i])
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
    place(out, local, ROUTE[i], ROUTE_TAN[i])
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
}

function paved(d: THREE.Vector3, pad: number) {
  return arc(d, PLAZA) < 7.5 + pad || arc(d, SERVICE_POINT) < 9 + pad || arc(d, POND.center) < POND.r + 0.8
}

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

const SEA_DEEP: Ramp = { light: ['#62adb8', '#6cb5bd'], mid: ['#4f9fae', '#4896a6', '#57a5b2'], dark: ['#3f8a9c', '#3a8396'] }
const SEA_SHALLOW: Ramp = { light: ['#8fd0cc', '#9ad6cf'], mid: ['#6fbcc0', '#78c3c4', '#66b4ba'], dark: ['#5aa9b2'] }

/** Painted sea around the island: flat, wind-aligned dabs over the water body, paler in the shallows. */
function seaStrokes(out: Stroke[]) {
  const r = rng(91)
  const step = 1.25
  const wind = new THREE.Vector3(1, 0, 0.35).normalize()
  for (let x = -110; x < 130; x += step) {
    for (let z = -120; z < 128; z += step) {
      const p = new THREE.Vector3(x + (r() - 0.5) * step, 0, z + (r() - 0.5) * step)
      const land = landValue(p)
      if (land > -0.3) continue
      p.y = -THREE.MathUtils.clamp(0.3 - land * 0.25, 0.3, 0.9) + 0.04 + r() * 0.01
      const dir = rotateAbout(wind, UP, Math.sin(x * 0.05 + z * 0.03) * 0.5 + (r() - 0.5) * 0.4)
      const ramp = land > -2.8 ? SEA_SHALLOW : SEA_DEEP
      out.push({ p, n: UP, dir, len: 1.1 + r() * 0.9, wid: 0.32 + r() * 0.2, color: shade(r, new THREE.Vector3(r() - 0.5, 1, 0).normalize(), ramp) })
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
      if (hit.dist < 2.15 || landValue(d, hit) < 2.6 || paved(d, 0)) continue
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
      if (hit.dist < 2.1 || landValue(d, hit) < 2.6 || paved(d, 0) || nearBuilding(d, c, -1.8)) continue
      const f = windAngle(d.x, d.z)
      const zone = meadowZone(d.x, d.z)
      out.push({
        p: new THREE.Vector3(d.x, groundHeight(d) + 0.03 + r() * 0.01, d.z),
        n: UP,
        dir: new THREE.Vector3(Math.cos(f), 0, Math.sin(f)),
        len: 0.8 + r() * 0.7,
        wid: 0.24 + r() * 0.14,
        color: meadowTone(0.15 + r() * 0.5 + (zone - 0.5) * 0.3),
      })
    }
  }
  return out
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
    () => ({ buildings: locations.flatMap(landmarkBlockers), lots: townLots(locations).map((l) => l.at) }),
    [locations],
  )
  const grass = useQuality((s) => s.grass)
  const strokes = useMemo(() => {
    const out: Stroke[] = []
    roadStrokes(out)
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
      {grass ? <Meadow clear={clear} /> : <FlatMeadow clear={clear} />}
    </>
  )
}
