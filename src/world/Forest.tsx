import { useMemo } from 'react'
import * as THREE from 'three'
import { UP, flatDir, yawQuaternion } from './plane'
import { CREEK, MESAS, creekHalf, groundHeight } from './island'
import { brushify } from './brush'
import { toonMaterial } from './toon'
import { type Ramp, type Stroke, Strokes, blob, column, pick, rng, rotateAbout, shade } from './strokes'

const STONE = '#e6dcc2'
const CLIFF: Ramp = { light: ['#f1e9d3', '#ece2c8'], mid: ['#e2d6b8', '#d9cdae', '#ddd2b5'], dark: ['#c3b694', '#bdb08e'] }
const CRACK = ['#9c8f73', '#8f8368', '#a89a7c']
const MOSS: Ramp = { light: ['#8fcf8a', '#a3d58f'], mid: ['#5e9d6d', '#4f8f63', '#6aa874'], dark: ['#3f7a55', '#2f6650'] }
const WATER: Ramp = { light: ['#8fd0cc', '#9ad6cf'], mid: ['#5aa9b2', '#4f9fae', '#66b4ba'], dark: ['#3f8a9c', '#3a8396'] }
const RIPPLE = ['#f4faf6', '#e2f3ef', '#ffffff']
const BANK: Ramp = { light: ['#e9dfc4', '#e3d8b8'], mid: ['#d6caa9', '#cfc3a2'], dark: ['#b8ac8c'] }
const WOOD: Ramp = { light: ['#cbb08e', '#d3bb9a'], mid: ['#a88a69', '#9c7f60', '#b0937a'], dark: ['#7c6450', '#6f5948'] }

type Mesa = (typeof MESAS)[number]

/** Outcrop radius at bearing `a` and height fraction `t`: wobbly, narrowing in two stepped tiers. */
function mesaRadius(m: Mesa, a: number, t: number) {
  const wob = 1 + Math.sin(a * 3 + m.seed * 1.7) * 0.12 + Math.sin(a * 7 + m.seed * 4.1) * 0.06
  const tier = t > 0.62 ? 0.82 : 1
  return m.r * THREE.MathUtils.lerp(1, 0.84, t) * tier * wob
}

function mesaGeometry(m: Mesa) {
  const g = new THREE.CylinderGeometry(1, 1, 1, 28, 10)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const t = pos.getY(i) + 0.5
    const k = Math.hypot(x, z)
    const a = Math.atan2(z, x)
    const rad = mesaRadius(m, a, Math.min(t, 0.999)) * k
    pos.setXYZ(i, Math.cos(a) * rad, t * m.h, Math.sin(a) * rad)
  }
  g.computeVertexNormals()
  return g
}

/** Brush strokes over an outcrop: vertical sandstone dabs, dark cracks, and moss spilling over the top. */
function mesaStrokes(out: Stroke[], m: Mesa) {
  const r = rng(300 + m.seed * 17)
  const base = new THREE.Vector3(m.at.x, groundHeight(m.at) - 0.3, m.at.z)
  const n = Math.round(m.r * m.h * 26)
  for (let k = 0; k < n; k++) {
    const a = r() * Math.PI * 2
    const t = r()
    const rad = mesaRadius(m, a, t) + 0.04
    const nrm = new THREE.Vector3(Math.cos(a), 0.05, Math.sin(a)).normalize()
    const p = base.clone().add(new THREE.Vector3(Math.cos(a) * rad, t * m.h, Math.sin(a) * rad))
    const dir = rotateAbout(UP, nrm, (r() - 0.5) * 0.5)
    const crack = r() < 0.08
    out.push({
      p,
      n: nrm,
      dir,
      len: crack ? 0.9 + r() * 1.2 : 0.6 + r() * 0.7,
      wid: crack ? 0.05 + r() * 0.03 : 0.22 + r() * 0.16,
      color: crack ? new THREE.Color(pick(r, CRACK)) : shade(r, nrm, CLIFF),
    })
  }
  // moss cap, the tier ledge, and drips down the face
  const top = mesaRadius(m, 0, 1) * 0.95
  for (let k = 0; k < Math.round(top * top * 18); k++) {
    const a = r() * Math.PI * 2
    const rr = Math.sqrt(r()) * mesaRadius(m, a, 1) * 0.98
    const p = base.clone().add(new THREE.Vector3(Math.cos(a) * rr, m.h + 0.03 + r() * 0.02, Math.sin(a) * rr))
    out.push({ p, n: UP, dir: new THREE.Vector3(Math.cos(a + 1.5), 0, Math.sin(a + 1.5)), len: 0.6 + r() * 0.5, wid: 0.3 + r() * 0.2, color: shade(r, UP, MOSS) })
  }
  for (let k = 0; k < Math.round(m.r * 50); k++) {
    const a = r() * Math.PI * 2
    const ledge = r() < 0.5
    const t = ledge ? 0.62 : 1
    const drop = r() * (ledge ? 0.12 : 0.3)
    const rad = mesaRadius(m, a, Math.max(0, t - drop)) + 0.06
    const nrm = new THREE.Vector3(Math.cos(a), 0.2, Math.sin(a)).normalize()
    const p = base.clone().add(new THREE.Vector3(Math.cos(a) * rad, (t - drop) * m.h, Math.sin(a) * rad))
    out.push({ p, n: nrm, dir: UP.clone(), len: 0.4 + r() * 0.8, wid: 0.25 + r() * 0.2, color: shade(r, nrm, MOSS) })
  }
  const shrubs = 2 + Math.floor(r() * 3)
  for (let k = 0; k < shrubs; k++) {
    const a = r() * Math.PI * 2
    const rr = r() * top * 0.6
    blob(out, r, base.clone().add(new THREE.Vector3(Math.cos(a) * rr, m.h + 0.5, Math.sin(a) * rr)), 0.6 + r() * 0.4, MOSS, 220, 0.9)
  }
}

/** Flowing water dabs along the creek, white ripple flicks on top and sandy banks either side. */
function creekStrokes(out: Stroke[]) {
  const r = rng(808)
  for (let i = 0; i < CREEK.length - 1; i++) {
    const a = CREEK[i]
    const tan = flatDir(CREEK[i + 1].clone().sub(a))
    const side = new THREE.Vector3().crossVectors(UP, tan)
    const half = creekHalf(i)
    const step = a.distanceTo(CREEK[i + 1])
    const y = groundHeight(a)
    for (let k = 0; k < Math.round(half * step * 5); k++) {
      const o = (r() * 2 - 1) * half
      const p = a.clone().addScaledVector(side, o).addScaledVector(tan, r() * step)
      p.y = y - 0.3 + r() * 0.01
      const edge = Math.abs(o) / half
      out.push({ p, n: UP, dir: rotateAbout(tan, UP, (r() - 0.5) * 0.3), len: 0.6 + r() * 0.6, wid: 0.18 + r() * 0.12, color: shade(r, new THREE.Vector3(edge - 0.5, 1, 0).normalize(), WATER) })
    }
    if (r() < 0.7) {
      const p = a.clone().addScaledVector(side, (r() * 2 - 1) * half * 0.7)
      p.y = y - 0.28
      out.push({ p, n: UP, dir: rotateAbout(tan, UP, (r() - 0.5) * 0.2), len: 0.5 + r() * 0.9, wid: 0.05 + r() * 0.04, color: new THREE.Color(pick(r, RIPPLE)) })
    }
    for (const sgn of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const p = a.clone().addScaledVector(side, sgn * (half + 0.1 + r() * 0.45)).addScaledVector(tan, r() * step)
        p.y = groundHeight(p) - 0.12 + r() * 0.01
        out.push({ p, n: UP, dir: rotateAbout(tan, UP, (r() - 0.5) * 0.4), len: 0.4 + r() * 0.4, wid: 0.14 + r() * 0.1, color: shade(r, UP, BANK) })
      }
    }
  }
}

const BRIDGE_AT = 62
const SPAN = 5.2
const DECK_W = 1.5
const RISE = 0.9

/** Little arched footbridge over the creek, built from plank and rail strokes. */
function footbridge(out: Stroke[]) {
  const r = rng(515)
  const c = CREEK[BRIDGE_AT]
  const along = flatDir(CREEK[BRIDGE_AT + 1].clone().sub(c))
  const across = new THREE.Vector3().crossVectors(UP, along)
  const y0 = groundHeight(c)
  const at = (t: number, w: number, lift: number) =>
    c.clone().addScaledVector(across, (t - 0.5) * SPAN).addScaledVector(along, w).setY(y0 + Math.sin(Math.PI * t) * RISE + lift)
  const planks = 18
  for (let k = 0; k <= planks; k++) {
    const t = k / planks
    const slope = Math.cos(Math.PI * t) * RISE * Math.PI / SPAN
    const n = UP.clone().addScaledVector(across, -slope).normalize()
    out.push({ p: at(t, 0, 0.06), n, dir: along.clone(), len: DECK_W + r() * 0.1, wid: SPAN / planks * 1.15, color: shade(r, n, WOOD) })
    for (const sgn of [-1, 1]) {
      const rail = at(t, sgn * DECK_W * 0.48, 0.85)
      const dir = across.clone().addScaledVector(UP, slope).normalize()
      const side = along.clone().multiplyScalar(sgn)
      out.push({ p: rail, n: side, dir, len: SPAN / planks * 1.5, wid: 0.09, color: shade(r, side, WOOD) })
      if (k % 3 === 0) column(out, r, at(t, sgn * DECK_W * 0.48, 0.05), 0.85, 0.06, WOOD, 6)
    }
  }
}

function deckGeometry() {
  const c = CREEK[BRIDGE_AT]
  const shape = new THREE.Shape()
  const n = 16
  shape.moveTo(-SPAN / 2, 0)
  for (let k = 0; k <= n; k++) {
    const t = k / n
    shape.lineTo((t - 0.5) * SPAN, Math.sin(Math.PI * t) * RISE + 0.04)
  }
  for (let k = n; k >= 0; k--) {
    const t = k / n
    shape.lineTo((t - 0.5) * SPAN, Math.sin(Math.PI * t) * RISE - 0.22)
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: DECK_W, bevelEnabled: false })
  g.translate(0, 0, -DECK_W / 2)
  const along = flatDir(CREEK[BRIDGE_AT + 1].clone().sub(c))
  const q = yawQuaternion(along)
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(c.x, groundHeight(c), c.z), q, new THREE.Vector3(1, 1, 1)))
  return g
}

const matCache = new Map<string, THREE.MeshToonMaterial>()
function stoneMat(color: string) {
  let m = matCache.get(color)
  if (!m) {
    m = toonMaterial(color).clone()
    brushify(m)
    matCache.set(color, m)
  }
  return m
}

/** Sandstone outcrops, the woodland creek and its footbridge. */
export function Forest() {
  const built = useMemo(() => {
    const strokes: Stroke[] = []
    for (const m of MESAS) mesaStrokes(strokes, m)
    creekStrokes(strokes)
    footbridge(strokes)
    return {
      strokes,
      mesas: MESAS.map((m) => ({ geo: mesaGeometry(m), at: new THREE.Vector3(m.at.x, groundHeight(m.at) - 0.3, m.at.z) })),
      deck: deckGeometry(),
    }
  }, [])
  return (
    <group>
      {built.mesas.map((m, i) => (
        <mesh key={i} geometry={m.geo} position={m.at} material={stoneMat(STONE)} castShadow receiveShadow />
      ))}
      <mesh geometry={built.deck} material={stoneMat('#a88a69')} castShadow />
      <Strokes strokes={built.strokes} />
    </group>
  )
}
