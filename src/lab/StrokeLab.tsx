import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import { Arcade, Cinema, CreativeMuseum, ExperimentLab, Observatory, ServiceCenter, Studio, WriteHouse } from '../locations/buildings'
import { LIGHT, StrokeBuild, type Stroke, Strokes, blob, column, pick, rng, rotateAbout, shade } from '../world/strokes'

const WALL = {
  light: ['#f1f1ea', '#e8e9e0', '#f4eedd', '#e1e6de'],
  mid: ['#d6d8cf', '#cfd3c9', '#dcd8c8', '#c8cfc8'],
  dark: ['#a9b1ad', '#9aa5a5', '#b0b3a6', '#8f9c9e'],
}
const ROOF = {
  light: ['#7fc6bd', '#93d2c6', '#6fbab3'],
  mid: ['#4f9f9a', '#5aa9a2', '#46918e'],
  dark: ['#2f6f70', '#2a6266', '#367a78'],
}
const NAVY = ['#2c3437', '#343e42', '#252c2f']

/** Fill a parallelogram (origin + u·[0,1] + v·[0,1]) with dabs; two passes: broad underpainting then finer marks. */
function paintFace(
  out: Stroke[],
  r: () => number,
  origin: THREE.Vector3,
  u: THREE.Vector3,
  v: THREE.Vector3,
  ramp: { light: string[]; mid: string[]; dark: string[] },
  strokeDir: THREE.Vector3,
  density = 9,
) {
  const n = new THREE.Vector3().crossVectors(u, v).normalize()
  const area = u.length() * v.length()
  const passes: [number, number, number, number][] = [
    [1.3, 0.55, 0.002, 1.4],
    [0.9, 0.32, 0.005, 1.6],
    [0.55, 0.13, 0.02, 1],
  ]
  for (const [len, wid, lift, mult] of passes) {
    const count = Math.round(area * density * mult)
    for (let i = 0; i < count; i++) {
      const a = r()
      const b = r()
      const p = origin.clone().addScaledVector(u, a).addScaledVector(v, b)
      p.addScaledVector(n, lift + r() * 0.015)
      const dir = rotateAbout(strokeDir, n, (r() - 0.5) * 0.5)
      out.push({ p, n, dir, len: len * (0.7 + r() * 0.6), wid: wid * (0.7 + r() * 0.6), color: shade(r, n, ramp) })
    }
  }
  return n
}

/** Ragged navy contour strokes along a segment, pushed out along `out`. */
function contour(outArr: Stroke[], r: () => number, a: THREE.Vector3, b: THREE.Vector3, outward: THREE.Vector3) {
  const d = b.clone().sub(a)
  const L = d.length()
  const steps = Math.max(1, Math.round(L / 0.45))
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) / steps
    const p = a.clone().addScaledVector(d, t).addScaledVector(outward, 0.04)
    outArr.push({
      p,
      n: outward,
      dir: rotateAbout(d.clone().normalize(), outward, (r() - 0.5) * 0.12),
      len: (L / steps) * 1.25,
      wid: 0.07 + r() * 0.05,
      color: new THREE.Color(pick(r, NAVY)),
    })
  }
}

function houseStrokes() {
  const r = rng(11)
  const s: Stroke[] = []
  const W = 4
  const D = 3.4
  const H = 2.8
  const RH = 1.5
  const x0 = -W / 2
  const z0 = -D / 2
  const up = new THREE.Vector3(0, 1, 0)
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
  // walls: front, back, left, right — vertical strokes
  paintFace(s, r, V(x0, 0, -z0), V(W, 0, 0), V(0, H, 0), WALL, up)
  paintFace(s, r, V(-x0, 0, z0), V(-W, 0, 0), V(0, H, 0), WALL, up)
  paintFace(s, r, V(x0, 0, z0), V(0, 0, D), V(0, H, 0), WALL, up)
  paintFace(s, r, V(-x0, 0, -z0), V(0, 0, -D), V(0, H, 0), WALL, up)
  // gable triangles: painted as shrinking strips
  for (const [xf, sign] of [[-x0, 1], [x0, -1]] as const) {
    const n = V(sign, 0, 0)
    for (let i = 0; i < 90; i++) {
      const y = r() * RH
      const half = (D / 2) * (1 - y / RH)
      const p = V(xf + sign * (0.01 + r() * 0.02), H + y, (r() - 0.5) * 2 * half)
      s.push({ p, n, dir: rotateAbout(up, n, (r() - 0.5) * 0.5), len: Math.min(0.5 + r() * 0.3, (RH - y) * 1.2 + 0.1), wid: 0.12 + r() * 0.1, color: shade(r, n, WALL) })
    }
  }
  // roof planes: strokes run down the slope
  const ov = 0.35
  const ridgeL = V(x0 - ov, H + RH, 0)
  const ridgeR = V(-x0 + ov, H + RH, 0)
  for (const sign of [1, -1]) {
    const eave = V(x0 - ov, H - 0.25, sign * (D / 2 + ov))
    const u = V(W + ov * 2, 0, 0)
    const v = ridgeL.clone().sub(eave)
    const n = new THREE.Vector3().crossVectors(u, v).normalize()
    if (n.y < 0) n.negate()
    paintFace(s, r, eave, u, v, ROOF, v.clone().normalize(), 10)
    contour(s, r, eave, eave.clone().add(u), n)
    contour(s, r, eave, eave.clone().add(v), n)
    contour(s, r, eave.clone().add(u), eave.clone().add(u).add(v), n)
  }
  contour(s, r, ridgeL, ridgeR, up)
  // door and windows: deep teal / warm yellow dabs with navy frames
  const front = V(0, 0, 1)
  const rect = (cx: number, cy: number, w: number, h: number, fill: string[], z: number, n: THREE.Vector3, axis: 'x' | 'z') => {
    const U = axis === 'x' ? V(1, 0, 0) : V(0, 0, 1)
    for (let i = 0; i < Math.round(w * h * 40); i++) {
      const p = U.clone().multiplyScalar(cx + (r() - 0.5) * w).add(V(0, cy + (r() - 0.5) * h, 0))
      if (axis === 'x') p.z = z
      else p.x = z
      p.addScaledVector(n, 0.04 + r() * 0.01)
      s.push({ p, n, dir: rotateAbout(up, n, (r() - 0.5) * 0.3), len: 0.3 + r() * 0.2, wid: 0.09 + r() * 0.05, color: new THREE.Color(pick(r, fill)) })
    }
    const c = (a: number, b: number) => (axis === 'x' ? V(cx + a, cy + b, z) : V(z, cy + b, cx + a)).addScaledVector(n, 0.05)
    contour(s, r, c(-w / 2, -h / 2), c(w / 2, -h / 2), n)
    contour(s, r, c(w / 2, -h / 2), c(w / 2, h / 2), n)
    contour(s, r, c(w / 2, h / 2), c(-w / 2, h / 2), n)
    contour(s, r, c(-w / 2, h / 2), c(-w / 2, -h / 2), n)
  }
  const DOOR = ['#e36f4c', '#ea8156', '#d4613f', '#f0956a']
  const GLASS = ['#2d383d', '#3a4a50', '#4f6a70', '#8fc4c4']
  rect(-0.7, 0.85, 0.85, 1.7, DOOR, -z0, front, 'x')
  rect(0.95, 1.6, 0.9, 0.8, GLASS, -z0, front, 'x')
  rect(0, 1.6, 0.9, 0.8, GLASS, x0, V(-1, 0, 0), 'z')
  rect(0, 1.6, 0.9, 0.8, GLASS, -x0, V(1, 0, 0), 'z')
  // box contours
  const corners = [
    [x0, z0],
    [-x0, z0],
    [-x0, -z0],
    [x0, -z0],
  ]
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i]
    const [bx, bz] = corners[(i + 1) % 4]
    const outward = V(ax + bx, 0, az + bz).normalize()
    contour(s, r, V(ax, 0, az), V(ax, H, az), V(ax, 0, az).normalize())
    contour(s, r, V(ax, 0.02, az), V(bx, 0.02, bz), outward)
    contour(s, r, V(ax, H, az), V(bx, H, bz), outward)
  }
  return s
}

const LEAF = {
  light: ['#8fcf8a', '#a3d993', '#7cc283', '#b5dd9a'],
  mid: ['#5e9d6d', '#4f8f63', '#6aa874', '#3f7a55'],
  dark: ['#2f6650', '#28584a', '#2e5f5c', '#244c46'],
}
const BARK = {
  light: ['#a88a6a', '#b89a78'],
  mid: ['#7a604a', '#86694f', '#6c5442'],
  dark: ['#4a3d36', '#3e3a3a', '#34393c'],
}

function treeStrokes() {
  const r = rng(23)
  const s: Stroke[] = []
  const base = new THREE.Vector3(-5, 0, 1.5)
  const up = new THREE.Vector3(0, 1, 0)
  // trunk: vertical bark strokes wrapped around a tapering cylinder, with a lean
  for (let i = 0; i < 260; i++) {
    const t = r()
    const y = t * 3.2
    const ang = r() * Math.PI * 2
    const rad = 0.32 * (1 - t * 0.45)
    const n = new THREE.Vector3(Math.cos(ang), 0.1, Math.sin(ang)).normalize()
    const p = base.clone().add(new THREE.Vector3(Math.cos(ang) * rad + t * t * 0.4, y, Math.sin(ang) * rad))
    s.push({ p, n, dir: rotateAbout(up, n, (r() - 0.5) * 0.3), len: 0.45 + r() * 0.3, wid: 0.08 + r() * 0.05, color: shade(r, n, BARK) })
  }
  // canopy: clustered blobs; each dab sits on a blob surface and curls around it (swirl tangent)
  const blobs: [number, number, number, number][] = [
    [0.3, 4.4, 0, 1.6],
    [-0.9, 3.9, 0.4, 1.15],
    [1.3, 3.8, -0.3, 1.1],
    [0.4, 5.4, 0.2, 1.05],
    [0.1, 3.6, 1.0, 1.0],
    [0.6, 4.0, -1.0, 1.0],
  ]
  for (const [bx, by, bz, br] of blobs) {
    const c = base.clone().add(new THREE.Vector3(bx, by, bz))
    const count = Math.round(br * br * 260)
    for (let i = 0; i < count; i++) {
      const n = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1)
      if (n.lengthSq() > 1 || n.lengthSq() < 0.01) {
        i--
        continue
      }
      n.normalize()
      const rad = br * (0.82 + r() * 0.3)
      const p = c.clone().addScaledVector(n, rad)
      const swirl = new THREE.Vector3().crossVectors(n, up)
      if (swirl.lengthSq() < 1e-3) swirl.set(1, 0, 0)
      const dir = rotateAbout(swirl.normalize(), n, 0.6 + (r() - 0.5) * 0.9)
      s.push({ p, n, dir, len: 0.35 + r() * 0.3, wid: 0.1 + r() * 0.07, color: shade(r, n, LEAF) })
    }
  }
  return s
}

const GROUND = {
  light: ['#86bf84', '#9acb8c', '#7ab87e', '#a8d39a'],
  mid: ['#72b07e', '#5e9d6d', '#68a875', '#7fb483'],
  dark: ['#4a8462', '#3f7a5c', '#4d7f6a'],
}
const ASPHALT = { light: ['#8396a0', '#7a8e96'], mid: ['#6f848b', '#667a82', '#748990'], dark: ['#566870', '#5b6e76'] }
const SIDEWALK = { light: ['#e4e8de', '#dfe3d8'], mid: ['#d5dad1', '#cdd3ca'], dark: ['#b4bcb6'] }
const PAINT = ['#eef1ea', '#f6f7f1', '#e4e7df']

/** Gently winding road through the scene, passing in front of the house. */
const ROAD = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-16, 0, 9),
  new THREE.Vector3(-8, 0, 5.2),
  new THREE.Vector3(0, 0, 4.6),
  new THREE.Vector3(7, 0, 2.5),
  new THREE.Vector3(13, 0, -4),
  new THREE.Vector3(17, 0, -12),
])
const ROAD_HALF = 1.5
const WALK = 0.7
const ROAD_PTS = ROAD.getSpacedPoints(400)

function roadDistance(x: number, z: number) {
  let best = Infinity
  for (const p of ROAD_PTS) best = Math.min(best, (p.x - x) ** 2 + (p.z - z) ** 2)
  return Math.sqrt(best)
}

function roadStrokes() {
  const r = rng(41)
  const s: Stroke[] = []
  const n = new THREE.Vector3(0, 1, 0)
  const L = ROAD.getLength()
  const band = (count: number, from: number, to: number, ramp: typeof ASPHALT, lift: number, len: number, wid: number) => {
    for (let i = 0; i < count; i++) {
      const u = r()
      const p = ROAD.getPointAt(u)
      const t = ROAD.getTangentAt(u)
      const side = new THREE.Vector3(-t.z, 0, t.x)
      const off = from + r() * (to - from)
      p.addScaledVector(side, off).setY(lift + r() * 0.01)
      s.push({ p, n, dir: rotateAbout(t, n, (r() - 0.5) * 0.2), len: len * (0.7 + r() * 0.6), wid: wid * (0.7 + r() * 0.6), color: shade(r, n, ramp) })
    }
  }
  band(Math.round(L * 9), -ROAD_HALF, ROAD_HALF, ASPHALT, 0.02, 0.8, 0.22)
  band(Math.round(L * 4), ROAD_HALF, ROAD_HALF + WALK, SIDEWALK, 0.03, 0.6, 0.2)
  band(Math.round(L * 4), -ROAD_HALF - WALK, -ROAD_HALF, SIDEWALK, 0.03, 0.6, 0.2)
  // dashed centre line and curb contours
  for (let d = 0; d < L; d += 1.6) {
    const u = d / L
    const p = ROAD.getPointAt(u).setY(0.05)
    const t = ROAD.getTangentAt(u)
    s.push({ p, n, dir: t, len: 0.75, wid: 0.12, color: new THREE.Color(pick(r, PAINT)) })
  }
  for (const off of [ROAD_HALF, -ROAD_HALF, ROAD_HALF + WALK, -ROAD_HALF - WALK]) {
    for (let d = 0; d < L; d += 0.45) {
      const u = d / L
      const t = ROAD.getTangentAt(u)
      const p = ROAD.getPointAt(u).addScaledVector(new THREE.Vector3(-t.z, 0, t.x), off).setY(0.06)
      s.push({ p, n, dir: rotateAbout(t, n, (r() - 0.5) * 0.1), len: 0.55, wid: 0.06 + r() * 0.03, color: new THREE.Color(pick(r, NAVY)) })
    }
  }
  return s
}

function groundStrokes() {
  const r = rng(5)
  const s: Stroke[] = []
  const n = new THREE.Vector3(0, 1, 0)
  const shadowDir = new THREE.Vector2(-LIGHT.x, -LIGHT.z).normalize()
  const inShadow = (x: number, z: number) => {
    const house = Math.abs(x - shadowDir.x * 1.4) < 2.4 && Math.abs(z - shadowDir.y * 1.4) < 2.1
    const tx = x + 5 - shadowDir.x * 2.6
    const tz = z - 1.5 - shadowDir.y * 2.6
    return house || tx * tx + tz * tz < 2.6
  }
  for (let i = 0; i < 2600; i++) {
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r()) * 16
    const x = Math.cos(a) * d
    const z = Math.sin(a) * d
    if (roadDistance(x, z) < ROAD_HALF + WALK - 0.1) continue
    const p = new THREE.Vector3(x, 0.002 + r() * 0.01, z)
    const flow = Math.sin(x * 0.35) * 0.9 + Math.cos(z * 0.3) * 0.6
    const dir = new THREE.Vector3(Math.cos(flow), 0, Math.sin(flow))
    const ramp = inShadow(x, z) ? { light: GROUND.dark, mid: GROUND.dark, dark: GROUND.dark } : GROUND
    s.push({ p, n, dir, len: 0.6 + r() * 0.6, wid: 0.2 + r() * 0.14, color: shade(r, n, ramp) })
  }
  return s
}

const BUSH = {
  light: ['#9fd48e', '#b7de9c', '#86c784'],
  mid: ['#5e9d6d', '#4f8f63', '#6aa874', '#3f7a55'],
  dark: ['#2f6650', '#28584a', '#244c46'],
}
const BLADE = {
  light: ['#a8d993', '#c2e3a0', '#8fcf8a'],
  mid: ['#6aa874', '#5e9d6d', '#7fb483'],
  dark: ['#3f7a55', '#346b52'],
}
const POLE = { light: ['#9aa39e', '#a8aea8'], mid: ['#7c8580', '#6f7873'], dark: ['#4b5350', '#3f4644'] }
const VEND = {
  light: ['#f4f6f2', '#eef1ea'],
  mid: ['#d8dcd5', '#e2e5df'],
  dark: ['#aab2ae', '#9ea7a4'],
}
const VEND_RED = ['#e36f4c', '#d4613f', '#ea8156']
const VEND_PANEL = ['#2d383d', '#3a4a50']
const VEND_GOODS = ['#f3d36a', '#8fc4c4', '#e36f4c', '#eef1ea', '#7fb483']

const UP = new THREE.Vector3(0, 1, 0)

function clearOfScene(x: number, z: number, pad = 0.4) {
  if (roadDistance(x, z) < ROAD_HALF + WALK + pad) return false
  if (Math.abs(x) < 2.4 + pad && Math.abs(z) < 2.1 + pad) return false
  if ((x + 5) ** 2 + (z - 1.5) ** 2 < (1.6 + pad) ** 2) return false
  return true
}

function bushStrokes() {
  const r = rng(77)
  const s: Stroke[] = []
  const spots: [number, number, number][] = [
    [2.9, -0.8, 0.7],
    [2.9, -2.4, 0.55],
    [-2.9, -1.2, 0.6],
    [-1.6, -2.7, 0.65],
    [1.2, -2.8, 0.7],
    [-7.5, 2.0, 0.8],
    [-9.0, -1.5, 0.9],
    [6.5, -2.0, 0.75],
    [9.5, 3.5, 0.8],
    [4.5, 7.5, 0.7],
    [-3.5, 9.5, 0.85],
    [-11.0, 3.0, 0.6],
  ]
  for (const [x, z, br] of spots) {
    const lumps = 2 + Math.floor(r() * 3)
    for (let k = 0; k < lumps; k++) {
      const c = new THREE.Vector3(x + (r() - 0.5) * br * 1.6, br * (0.55 + r() * 0.3), z + (r() - 0.5) * br * 1.6)
      blob(s, r, c, br * (0.6 + r() * 0.4), BUSH, 300, 0.85)
    }
  }
  // grass field: dense, near-upright blades on a jittered grid
  const cell = 0.2
  for (let gx = -16.5; gx < 16.5; gx += cell) {
    for (let gz = -16.5; gz < 16.5; gz += cell) {
      const x = gx + r() * cell
      const z = gz + r() * cell
      if (x * x + z * z > 16 * 16) continue
      if (!clearOfScene(x, z, -0.05)) continue
      const yaw = r() * Math.PI
      const face = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw))
      const lean = (r() - 0.5) * 0.25
      const across = new THREE.Vector3(-face.z, 0, face.x)
      const dir = rotateAbout(UP, face, lean)
      const len = 0.22 + r() * 0.16
      const n = new THREE.Vector3().crossVectors(across, dir).normalize()
      const p = new THREE.Vector3(x, 0, z).addScaledVector(dir, len / 2)
      const tone = r()
      const ramp = tone < 0.55 ? BLADE.mid : tone < 0.85 ? BLADE.light : BLADE.dark
      s.push({ p, n, dir, len, wid: 0.07 + r() * 0.03, color: new THREE.Color(pick(r, ramp)) })
    }
  }
  return s
}

/** Axis-aligned box painted on its 5 visible faces with contour strokes on every edge. */
function paintBox(out: Stroke[], r: () => number, c: THREE.Vector3, w: number, h: number, d: number, ramp: typeof VEND) {
  const V = (x: number, y: number, z: number) => new THREE.Vector3(c.x + x, c.y + y, c.z + z)
  paintFace(out, r, V(-w / 2, 0, d / 2), new THREE.Vector3(w, 0, 0), new THREE.Vector3(0, h, 0), ramp, UP, 14)
  paintFace(out, r, V(w / 2, 0, -d / 2), new THREE.Vector3(-w, 0, 0), new THREE.Vector3(0, h, 0), ramp, UP, 14)
  paintFace(out, r, V(-w / 2, 0, -d / 2), new THREE.Vector3(0, 0, d), new THREE.Vector3(0, h, 0), ramp, UP, 14)
  paintFace(out, r, V(w / 2, 0, d / 2), new THREE.Vector3(0, 0, -d), new THREE.Vector3(0, h, 0), ramp, UP, 14)
  paintFace(out, r, V(-w / 2, h, d / 2), new THREE.Vector3(w, 0, 0), new THREE.Vector3(0, 0, -d), ramp, new THREE.Vector3(1, 0, 0), 14)
  const xs = [-w / 2, w / 2]
  const zs = [-d / 2, d / 2]
  for (const x of xs) for (const z of zs) contour(out, r, V(x, 0, z), V(x, h, z), new THREE.Vector3(x, 0, z).normalize())
  for (const y of [0.01, h]) {
    contour(out, r, V(-w / 2, y, d / 2), V(w / 2, y, d / 2), new THREE.Vector3(0, y > 0.5 ? 1 : 0, 1).normalize())
    contour(out, r, V(-w / 2, y, -d / 2), V(w / 2, y, -d / 2), new THREE.Vector3(0, y > 0.5 ? 1 : 0, -1).normalize())
    contour(out, r, V(-w / 2, y, -d / 2), V(-w / 2, y, d / 2), new THREE.Vector3(-1, y > 0.5 ? 1 : 0, 0).normalize())
    contour(out, r, V(w / 2, y, -d / 2), V(w / 2, y, d / 2), new THREE.Vector3(1, y > 0.5 ? 1 : 0, 0).normalize())
  }
}

/** Patch of flat dabs on the +z face of a box at (c), local rect centred at (cx, cy). */
function frontPatch(out: Stroke[], r: () => number, c: THREE.Vector3, zf: number, cx: number, cy: number, w: number, h: number, colors: string[], dens = 60, lift = 0.03) {
  const n = new THREE.Vector3(0, 0, 1)
  for (let i = 0; i < Math.round(w * h * dens); i++) {
    const p = new THREE.Vector3(c.x + cx + (r() - 0.5) * w, c.y + cy + (r() - 0.5) * h, c.z + zf + lift + r() * 0.01)
    out.push({ p, n, dir: rotateAbout(UP, n, (r() - 0.5) * 0.3), len: Math.min(h, 0.22 + r() * 0.12), wid: 0.06 + r() * 0.04, color: new THREE.Color(pick(r, colors)) })
  }
  const P = (a: number, b: number) => new THREE.Vector3(c.x + cx + a, c.y + cy + b, c.z + zf + lift + 0.015)
  contour(out, r, P(-w / 2, -h / 2), P(w / 2, -h / 2), n)
  contour(out, r, P(w / 2, -h / 2), P(w / 2, h / 2), n)
  contour(out, r, P(w / 2, h / 2), P(-w / 2, h / 2), n)
  contour(out, r, P(-w / 2, h / 2), P(-w / 2, -h / 2), n)
}

function vendingStrokes() {
  const r = rng(91)
  const s: Stroke[] = []
  const c = new THREE.Vector3(3.2, 0, 0.1)
  const W = 0.95
  const H = 1.9
  const D = 0.7
  paintBox(s, r, c, W, H, D, VEND)
  const zf = D / 2
  frontPatch(s, r, c, zf, 0, H - 0.18, W * 0.92, 0.22, VEND_RED, 90)
  frontPatch(s, r, c, zf, -0.08, 1.15, W * 0.68, 0.9, VEND_PANEL, 50)
  // goods: rows of small bright dabs inside the window
  for (let row = 0; row < 3; row++) {
    for (let k = 0; k < 5; k++) {
      const p = new THREE.Vector3(c.x - 0.08 + (k - 2) * 0.12, c.y + 0.85 + row * 0.27, c.z + zf + 0.06)
      s.push({ p, n: new THREE.Vector3(0, 0, 1), dir: UP, len: 0.17, wid: 0.07, color: new THREE.Color(pick(r, VEND_GOODS)) })
    }
  }
  frontPatch(s, r, c, zf, 0.36, 1.05, 0.12, 0.5, ['#c9cec8', '#b8bfba'], 120)
  frontPatch(s, r, c, zf, 0, 0.28, W * 0.7, 0.18, VEND_PANEL, 90)
  return s
}

function poleStrokes() {
  const r = rng(53)
  const s: Stroke[] = []
  const tops: THREE.Vector3[] = []
  const H = 5.2
  for (const u of [0.12, 0.34, 0.56, 0.78, 0.97]) {
    const p = ROAD.getPointAt(u)
    const t = ROAD.getTangentAt(u)
    const side = new THREE.Vector3(t.z, 0, -t.x)
    const base = p.clone().addScaledVector(side, ROAD_HALF + WALK + 0.45)
    column(s, r, base, H, 0.14, POLE, 160)
    // crossarm
    const arm = new THREE.Vector3(-t.z, 0, t.x).cross(UP).normalize()
    const armN = new THREE.Vector3().crossVectors(arm, UP).normalize()
    for (let i = 0; i < 14; i++) {
      const p2 = base.clone().add(new THREE.Vector3(0, H - 0.5 + (r() - 0.5) * 0.08, 0)).addScaledVector(arm, (r() - 0.5) * 1.4).addScaledVector(armN, 0.12)
      s.push({ p: p2, n: armN, dir: arm, len: 0.4 + r() * 0.2, wid: 0.1, color: shade(r, armN, POLE) })
    }
    contour(s, r, base.clone().add(new THREE.Vector3(0, H - 0.56, 0)).addScaledVector(arm, -0.75), base.clone().add(new THREE.Vector3(0, H - 0.56, 0)).addScaledVector(arm, 0.75), armN)
    // insulators
    for (const o of [-0.55, 0, 0.55]) {
      const ip = base.clone().add(new THREE.Vector3(0, H - 0.35, 0)).addScaledVector(arm, o).addScaledVector(armN, 0.13)
      s.push({ p: ip, n: armN, dir: UP, len: 0.22, wid: 0.1, color: new THREE.Color(pick(r, ['#eef1ea', '#d5dad1'])) })
    }
    tops.push(base.clone().add(new THREE.Vector3(0, H - 0.28, 0)))
    contour(s, r, base, base.clone().add(new THREE.Vector3(0, H, 0)), armN)
  }
  // sagging wires: thin dark strokes along catenaries between neighbouring poles
  for (let i = 0; i + 1 < tops.length; i++) {
    for (const lift of [0, -0.12]) {
      const a = tops[i].clone().add(new THREE.Vector3(0, lift, 0))
      const b = tops[i + 1].clone().add(new THREE.Vector3(0, lift, 0))
      const seg = 26
      for (let k = 0; k < seg; k++) {
        const t0 = k / seg
        const t1 = (k + 1) / seg
        const sag = (t: number) => -1.0 * 4 * t * (1 - t)
        const p0 = a.clone().lerp(b, t0).add(new THREE.Vector3(0, sag(t0), 0))
        const p1 = a.clone().lerp(b, t1).add(new THREE.Vector3(0, sag(t1), 0))
        const dir = p1.clone().sub(p0)
        const n = new THREE.Vector3().crossVectors(dir, UP).cross(dir).normalize().negate()
        s.push({ p: p0.clone().lerp(p1, 0.5), n, dir, len: dir.length() * 1.15, wid: 0.035, color: new THREE.Color(pick(r, NAVY)) })
      }
    }
  }
  return s
}

const SKY = ['#9edbd1', '#b3e3da', '#d6f0e8', '#63b5b8', '#eaf6f0', '#7fc4c2']

function skyStrokes() {
  const r = rng(3)
  const s: Stroke[] = []
  for (let i = 0; i < 900; i++) {
    const az = r() * Math.PI * 2
    const el = 0.02 + r() * 1.2
    const dirOut = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el))
    const p = dirOut.clone().multiplyScalar(70 + r() * 6)
    const tangent = new THREE.Vector3(-Math.sin(az), 0, Math.cos(az))
    const swirl = Math.sin(az * 3 + el * 4) * 0.9
    s.push({
      p,
      n: dirOut.clone().negate(),
      dir: rotateAbout(tangent, dirOut, swirl),
      len: 6 + r() * 7,
      wid: 1.1 + r() * 1.2,
      color: new THREE.Color(pick(r, SKY)),
    })
  }
  return s
}

/** Flat-colour strip along the road between lateral offsets `a` and `b`. */
function roadRibbon(a: number, b: number, y: number) {
  const pos: number[] = []
  const idx: number[] = []
  const pts = ROAD.getSpacedPoints(200)
  pts.forEach((p, i) => {
    const t = ROAD.getTangentAt(i / (pts.length - 1))
    const side = new THREE.Vector3(-t.z, 0, t.x)
    const pa = p.clone().addScaledVector(side, a)
    const pb = p.clone().addScaledVector(side, b)
    pos.push(pa.x, y, pa.z, pb.x, y, pb.z)
    if (i > 0) {
      const k = i * 2
      idx.push(k - 2, k - 1, k, k - 1, k + 1, k)
    }
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  return g
}

/** Solid base colours under the sparse strokes: grass disc, sidewalks and asphalt. */
function BaseColors() {
  const walkL = useMemo(() => roadRibbon(ROAD_HALF, ROAD_HALF + WALK, 0.006), [])
  const walkR = useMemo(() => roadRibbon(-ROAD_HALF - WALK, -ROAD_HALF, 0.006), [])
  const road = useMemo(() => roadRibbon(-ROAD_HALF, ROAD_HALF, 0.01), [])
  const side = THREE.DoubleSide
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[16.5, 96]} />
        <meshBasicMaterial color="#6aa977" />
      </mesh>
      <mesh geometry={walkL}>
        <meshBasicMaterial color="#d5dad1" side={side} />
      </mesh>
      <mesh geometry={walkR}>
        <meshBasicMaterial color="#d5dad1" side={side} />
      </mesh>
      <mesh geometry={road}>
        <meshBasicMaterial color="#6f848b" side={side} />
      </mesh>
    </>
  )
}

/** Sandbox for building geometry entirely out of brush strokes (Van Gogh test). */
/** `/lab?b=service`: a real landmark rebuilt from strokes, for side-by-side checks. */
function BuildingLab({ which }: { which: string }) {
  const v = (new URLSearchParams(window.location.search).get('cam') ?? '9,6,14,0,2.5,0').split(',').map(Number)
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas
        camera={{ fov: 45, position: [v[0], v[1], v[2]], near: 0.1, far: 200 }}
        gl={{ antialias: true }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.NoToneMapping
          scene.background = new THREE.Color('#8fd0c8')
        }}
      >
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[16, 64]} />
          <meshBasicMaterial color="#6aa977" />
        </mesh>
        <StrokeBuild seed={11}>
          {which === 'write' ? (
            <WriteHouse name="WRITE HOUSE" />
          ) : which === 'brand' ? (
            <CreativeMuseum name="BRAND & CREATIVE MUSEUM" />
          ) : which === 'cinema' ? (
            <Cinema name="MARC CINEMA" />
          ) : which === 'arcade' ? (
            <Arcade name="ARCADE" />
          ) : which === 'lab' ? (
            <ExperimentLab name="EXPERIMENT LAB" />
          ) : which === 'studio' ? (
            <Studio name="MY STUDIO" />
          ) : which === 'observatory' ? (
            <Observatory name="OBSERVATORY" />
          ) : (
            <ServiceCenter />
          )}
        </StrokeBuild>
        <OrbitControls target={[v[3], v[4], v[5]]} enableDamping />
      </Canvas>
    </div>
  )
}

export default function StrokeLab() {
  const b = new URLSearchParams(window.location.search).get('b')
  return b ? <BuildingLab which={b} /> : <StreetLab />
}

function StreetLab() {
  const all = useMemo(() => [...groundStrokes(), ...roadStrokes(), ...houseStrokes(), ...treeStrokes(), ...bushStrokes(), ...vendingStrokes(), ...poleStrokes(), ...skyStrokes()], [])
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas
        camera={{ fov: 45, position: [10, 5.5, 12], near: 0.1, far: 200 }}
        gl={{ antialias: true }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.NoToneMapping
          scene.background = new THREE.Color('#8fd0c8')
        }}
      >
        <BaseColors />
        <Strokes strokes={all} />
        <OrbitControls target={[-1, 2, 0]} enableDamping />
      </Canvas>
    </div>
  )
}
