import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Seeded RNG so the painting is stable between reloads. */
export function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const LIGHT = new THREE.Vector3(0.55, 0.8, 0.35).normalize()

export interface Stroke {
  p: THREE.Vector3
  n: THREE.Vector3
  dir: THREE.Vector3
  len: number
  wid: number
  color: THREE.Color
}

/** Flat, crisp-edged dab with ragged ends and a few bristle streaks. */
function brushTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 64
  const g = c.getContext('2d')!
  const r = rng(7)
  g.fillStyle = '#fff'
  g.beginPath()
  const top: [number, number][] = []
  const bot: [number, number][] = []
  for (let i = 0; i <= 16; i++) {
    const x = 6 + (i / 16) * 244
    const t = i / 16
    const half = 26 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.04)), 0.35)
    top.push([x, 32 - half - r() * 3])
    bot.push([x, 32 + half + r() * 3])
  }
  g.moveTo(top[0][0], 32)
  for (const [x, y] of top) g.lineTo(x, y)
  for (const [x, y] of bot.reverse()) g.lineTo(x, y)
  g.closePath()
  g.fill()
  g.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 5; i++) {
    g.fillRect(150 + r() * 100, 8 + r() * 48, 30 + r() * 60, 1.5)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

let sharedBrush: THREE.MeshBasicMaterial | null = null
const brushMat = () =>
  (sharedBrush ??= new THREE.MeshBasicMaterial({ map: brushTexture(), alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: false }))

export function pick(r: () => number, palette: string[]) {
  return palette[Math.floor(r() * palette.length)]
}

/** Light/mid/dark palette chosen by facing; random jitter keeps neighbouring dabs distinct. */
export function shade(r: () => number, n: THREE.Vector3, ramp: { light: string[]; mid: string[]; dark: string[] }) {
  const k = n.dot(LIGHT) + (r() - 0.5) * 0.5
  return new THREE.Color(pick(r, k > 0.55 ? ramp.light : k > 0.05 ? ramp.mid : ramp.dark))
}

export function rotateAbout(v: THREE.Vector3, axis: THREE.Vector3, a: number) {
  return v.clone().applyAxisAngle(axis, a)
}

/** Picture-plane helpers: a dab in a local XY plane facing +Z, and a cache for painted pictures. */
const FACE = new THREE.Vector3(0, 0, 1)
export function dab(x: number, y: number, z: number, a: number, len: number, wid: number, color: string): Stroke {
  return { p: new THREE.Vector3(x, y, z), n: FACE, dir: new THREE.Vector3(Math.cos(a), Math.sin(a), 0), len, wid, color: new THREE.Color(color) }
}

const paintCache = new Map<string, Stroke[]>()
export function painted(key: string, make: (r: () => number) => Stroke[]) {
  let s = paintCache.get(key)
  if (!s) {
    s = make(rng(key.length * 977 + key.charCodeAt(0)))
    paintCache.set(key, s)
  }
  return s
}

export function Strokes({ strokes }: { strokes: Stroke[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geom = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  const mat = useMemo(brushMat, [])
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const basis = new THREE.Matrix4()
    strokes.forEach((s, i) => {
      const x = s.dir.clone().normalize()
      const z = s.n.clone().normalize()
      const y = new THREE.Vector3().crossVectors(z, x).normalize()
      x.crossVectors(y, z).normalize()
      basis.makeBasis(x.multiplyScalar(s.len), y.multiplyScalar(s.wid), z)
      basis.setPosition(s.p)
      m.setMatrixAt(i, basis)
      m.setColorAt(i, s.color)
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [strokes])
  return <instancedMesh ref={ref} args={[geom, mat, strokes.length]} />
}


export interface Ramp {
  light: string[]
  mid: string[]
  dark: string[]
}

const rampCache = new Map<string, Ramp>()
/** Light/mid/dark brush palette derived from one flat colour. */
export function rampFor(color: string): Ramp {
  let ramp = rampCache.get(color)
  if (!ramp) {
    const hsl = { h: 0, s: 0, l: 0 }
    new THREE.Color(color).getHSL(hsl)
    const v = (dh: number, ds: number, dl: number) =>
      '#' + new THREE.Color().setHSL((hsl.h + dh + 1) % 1, THREE.MathUtils.clamp(hsl.s + ds, 0, 1), THREE.MathUtils.clamp(hsl.l + dl, 0, 1)).getHexString()
    ramp = {
      light: [v(-0.01, -0.02, 0.08), v(0, 0, 0.12), v(-0.015, -0.05, 0.06)],
      mid: [v(0, 0, 0), v(0.01, 0.02, -0.03), v(-0.01, -0.02, 0.025)],
      dark: [v(0.03, -0.04, -0.13), v(0.04, -0.06, -0.18), v(0.02, -0.02, -0.1)],
    }
    rampCache.set(color, ramp)
  }
  return ramp
}

const CONTOUR = ['#2c3437', '#343e42', '#252c2f']
const UP = new THREE.Vector3(0, 1, 0)

const edgeCache = new WeakMap<THREE.BufferGeometry, THREE.EdgesGeometry>()
function edgesOf(g: THREE.BufferGeometry) {
  let e = edgeCache.get(g)
  if (!e) {
    e = new THREE.EdgesGeometry(g, 35)
    edgeCache.set(g, e)
  }
  return e
}

/** Per-point base colour for a painted part (e.g. shirt stripes), in the part's painted frame. */
export type PaintFn = (p: THREE.Vector3) => string

interface PaintOpts {
  /** Dab size relative to the part's middle dimension. */
  sizeK?: number
  /** Lay dabs along the part's longest axis instead of world up (tubes, limbs). */
  alongLong?: boolean
  paint?: PaintFn
}

/** Cover a transformed geometry's surface with dabs; dab size follows the part's thickness. */
function paintGeometry(out: Stroke[], r: () => number, g: THREE.BufferGeometry, m: THREE.Matrix4, color: string, outline: boolean, opts: PaintOpts = {}) {
  const pos = g.getAttribute('position')
  const idx = g.getIndex()
  const nTri = idx ? idx.count / 3 : pos.count / 3
  const verts: THREE.Vector3[] = []
  for (let i = 0; i < pos.count; i++) verts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m))
  const box = new THREE.Box3().setFromPoints(verts)
  const size = box.getSize(new THREE.Vector3())
  const dims = [size.x, size.y, size.z].sort((a, b) => a - b)
  const s = THREE.MathUtils.clamp(dims[1] * (opts.sizeK ?? 0.6), opts.sizeK ? 0.03 : 0.05, 0.55)
  const ref = UP.clone()
  if (opts.alongLong && dims[2] > dims[1] * 2.2) {
    if (size.x === dims[2]) ref.set(1, 0, 0)
    else if (size.z === dims[2]) ref.set(0, 0, 1)
  }
  const tris: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3][] = []
  const cum: number[] = []
  let area = 0
  const e1 = new THREE.Vector3()
  const e2 = new THREE.Vector3()
  for (let t = 0; t < nTri; t++) {
    const a = verts[idx ? idx.getX(t * 3) : t * 3]
    const b = verts[idx ? idx.getX(t * 3 + 1) : t * 3 + 1]
    const c = verts[idx ? idx.getX(t * 3 + 2) : t * 3 + 2]
    e1.subVectors(b, a)
    e2.subVectors(c, a)
    const n = new THREE.Vector3().crossVectors(e1, e2)
    const ar = n.length() / 2
    if (ar < 1e-6) continue
    area += ar
    tris.push([a, b, c, n.normalize()])
    cum.push(area)
  }
  if (!tris.length) return
  const ramp = rampFor(color)
  const count = THREE.MathUtils.clamp(Math.round((area * 1.7) / (s * s * 0.35)), 4, 5000)
  for (let k = 0; k < count; k++) {
    const target = r() * area
    let lo = 0
    let hi = cum.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (cum[mid] < target) lo = mid + 1
      else hi = mid
    }
    const [a, b, c, n] = tris[lo]
    let u = r()
    let v = r()
    if (u + v > 1) {
      u = 1 - u
      v = 1 - v
    }
    const p = a.clone().addScaledVector(e1.subVectors(b, a), u).addScaledVector(e2.subVectors(c, a), v)
    const lift = 0.008 + r() * 0.02
    const dir = ref.clone().addScaledVector(n, -n.dot(ref))
    if (dir.lengthSq() < 0.04) dir.set(ref.y, ref.z, ref.x).addScaledVector(n, -n.dot(new THREE.Vector3(ref.y, ref.z, ref.x)))
    dir.normalize()
    const swirl = rotateAbout(dir, n, (r() - 0.5) * 0.5)
    let len = s * (0.7 + r() * 0.6)
    const wid = s * 0.36 * (0.7 + r() * 0.6)
    for (const ax of ['x', 'y', 'z'] as const) {
      const half = (len / 2) * Math.abs(swirl[ax]) + (wid / 2) * Math.sqrt(Math.max(0, 1 - swirl[ax] ** 2 - n[ax] ** 2))
      const lo = box.min[ax] + half
      const hi = box.max[ax] - half
      if (lo <= hi) p[ax] = THREE.MathUtils.clamp(p[ax], lo, hi)
      else {
        p[ax] = (box.min[ax] + box.max[ax]) / 2
        if (Math.abs(swirl[ax]) > 0.3) len = Math.min(len, (size[ax] / Math.abs(swirl[ax])) * 0.95)
      }
    }
    p.addScaledVector(n, lift)
    out.push({ p, n, dir: swirl, len, wid, color: shade(r, n, opts.paint ? rampFor(opts.paint(p)) : ramp) })
  }
  if (!outline) return
  const centre = box.getCenter(new THREE.Vector3())
  const ep = edgesOf(g).getAttribute('position')
  const w = Math.min(0.07, s * 0.35)
  for (let i = 0; i + 1 < ep.count; i += 2) {
    const a = new THREE.Vector3().fromBufferAttribute(ep, i).applyMatrix4(m)
    const b = new THREE.Vector3().fromBufferAttribute(ep, i + 1).applyMatrix4(m)
    const d = b.clone().sub(a)
    const L = d.length()
    if (L < 1e-4) continue
    const mid = a.clone().lerp(b, 0.5)
    const outward = mid.clone().sub(centre)
    outward.addScaledVector(d, -outward.dot(d) / (L * L))
    if (outward.lengthSq() < 1e-8) continue
    outward.normalize()
    const steps = Math.max(1, Math.round(L / 0.45))
    for (let k = 0; k < steps; k++) {
      const t = (k + 0.5) / steps
      out.push({
        p: a.clone().addScaledVector(d, t).addScaledVector(outward, 0.03),
        n: outward,
        dir: rotateAbout(d.clone().normalize(), outward, (r() - 0.5) * 0.1),
        len: (L / steps) * 1.2,
        wid: w * (0.8 + r() * 0.5),
        color: new THREE.Color(pick(r, CONTOUR)),
      })
    }
  }
}

type StrokePart =
  | { obj: THREE.Object3D; geometry: THREE.BufferGeometry; color: string; outline: boolean }
  | { obj: THREE.Object3D; local: Stroke[] }

class StrokeRegistry {
  parts = new Set<StrokePart>()
  onChange: (() => void) | null = null
  add(p: StrokePart) {
    this.parts.add(p)
    this.onChange?.()
  }
  remove(p: StrokePart) {
    this.parts.delete(p)
    this.onChange?.()
  }
}

const StrokeCtx = createContext<StrokeRegistry | null>(null)

/** True inside a <StrokeBuild>: meshes there should register as brush-stroke parts. */
export function useStrokeBuild() {
  return useContext(StrokeCtx)
}

const baseCache = new Map<string, THREE.MeshBasicMaterial>()
function baseMaterial(color: string) {
  let m = baseCache.get(color)
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: rampFor(color).mid[1], polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 })
    baseCache.set(color, m)
  }
  return m
}

/** Flat base-colour mesh whose surface is rebuilt from brush strokes by the enclosing <StrokeBuild>. */
export function StrokePartMesh({ geometry, color, outline }: { geometry: THREE.BufferGeometry; color: string; outline: boolean }) {
  const reg = useContext(StrokeCtx)
  const ref = useRef<THREE.Mesh>(null)
  useLayoutEffect(() => {
    const obj = ref.current
    if (!reg || !obj) return
    const part = { obj, geometry, color, outline }
    reg.add(part)
    return () => reg.remove(part)
  }, [reg, geometry, color, outline])
  return <mesh ref={ref} geometry={geometry} material={baseMaterial(color)} visible={!reg} />
}

/** Bakes every registered part's base colour into one merged mesh per colour, so a building costs a handful of draws. */
function mergeBases(parts: Iterable<StrokePart>, inv: THREE.Matrix4) {
  const byColor = new Map<string, THREE.BufferGeometry[]>()
  const m = new THREE.Matrix4()
  for (const part of parts) {
    if ('local' in part) continue
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', part.geometry.getAttribute('position').clone())
    if (part.geometry.index) g.setIndex(part.geometry.index.clone())
    g.applyMatrix4(m.multiplyMatrices(inv, part.obj.matrixWorld))
    const list = byColor.get(part.color) ?? []
    list.push(g.index ? g.toNonIndexed() : g)
    byColor.set(part.color, list)
  }
  return [...byColor].flatMap(([color, list]) => {
    const merged = mergeGeometries(list)
    list.forEach((g) => g.dispose())
    return merged ? [{ color, geometry: merged }] : []
  })
}

const RigCtx = createContext(false)

/** True inside a <StrokeRig>: each part carries its own strokes so animated joints keep them attached. */
export function useStrokeRig() {
  return useContext(RigCtx)
}

/** Animated subtree (avatar, bike) painted part-by-part with brush strokes. */
export function StrokeRig({ children }: { children: ReactNode }) {
  return <RigCtx.Provider value>{children}</RigCtx.Provider>
}

/** One rig part: flat base mesh plus strokes baked in its (unscaled) local frame, so they move with the part. */
export function StrokeRigPart({ geometry, color, scale, outline, paint, seed = 1 }: { geometry: THREE.BufferGeometry; color: string; scale?: [number, number, number] | number; outline: boolean; paint?: PaintFn; seed?: number }) {
  const sc = typeof scale === 'number' ? [scale, scale, scale] : (scale ?? [1, 1, 1])
  const [sx, sy, sz] = sc
  const strokes = useMemo(() => {
    const out: Stroke[] = []
    paintGeometry(out, rng(seed + Math.round((sx * 31 + sy * 17 + sz * 7) * 1000)), geometry, new THREE.Matrix4().makeScale(sx, sy, sz), color, outline, { sizeK: 0.42, alongLong: true, paint })
    return out
  }, [geometry, color, outline, paint, seed, sx, sy, sz])
  return (
    <>
      <mesh geometry={geometry} material={baseMaterial(color)} scale={[sx, sy, sz]} castShadow />
      <Strokes strokes={strokes} />
    </>
  )
}

/** Hand-placed strokes in this group's local frame, merged into the enclosing <StrokeBuild>. */
export function StrokePaint({ strokes, position, rotation }: { strokes: Stroke[]; position?: [number, number, number]; rotation?: [number, number, number] }) {
  const reg = useContext(StrokeCtx)
  const ref = useRef<THREE.Group>(null)
  useLayoutEffect(() => {
    const obj = ref.current
    if (!reg || !obj) return
    const part = { obj, local: strokes }
    reg.add(part)
    return () => reg.remove(part)
  }, [reg, strokes])
  return <group ref={ref} position={position} rotation={rotation} />
}

/** Every Toon part inside is drawn as one batch of brush strokes (Van Gogh look). */
export function StrokeBuild({ seed = 1, children }: { seed?: number; children: ReactNode }) {
  const root = useRef<THREE.Group>(null)
  const reg = useMemo(() => new StrokeRegistry(), [])
  const [version, setVersion] = useState(0)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [bases, setBases] = useState<{ color: string; geometry: THREE.BufferGeometry }[]>([])
  useLayoutEffect(() => () => bases.forEach((b) => b.geometry.dispose()), [bases])
  useLayoutEffect(() => {
    reg.onChange = () => setVersion((v) => v + 1)
    return () => {
      reg.onChange = null
    }
  }, [reg])
  useLayoutEffect(() => {
    const g = root.current
    if (!g) return
    g.updateWorldMatrix(true, true)
    const inv = g.matrixWorld.clone().invert()
    const r = rng(seed)
    const out: Stroke[] = []
    const m = new THREE.Matrix4()
    const nm = new THREE.Matrix3()
    for (const part of reg.parts) {
      m.multiplyMatrices(inv, part.obj.matrixWorld)
      if ('local' in part) {
        nm.getNormalMatrix(m)
        for (const k of part.local) {
          out.push({
            ...k,
            p: k.p.clone().applyMatrix4(m),
            n: k.n.clone().applyMatrix3(nm).normalize(),
            dir: k.dir.clone().transformDirection(m),
          })
        }
      } else paintGeometry(out, r, part.geometry, m, part.color, part.outline)
    }
    setStrokes(out)
    setBases(mergeBases(reg.parts, inv))
  }, [reg, seed, version])
  return (
    <group ref={root}>
      <StrokeCtx.Provider value={reg}>{children}</StrokeCtx.Provider>
      {bases.map((b) => (
        <mesh key={b.geometry.uuid} geometry={b.geometry} material={baseMaterial(b.color)} />
      ))}
      {strokes.length > 0 && <Strokes key={strokes.length} strokes={strokes} />}
    </group>
  )
}


/** Dabs wrapped over a sphere-ish blob, curling around it like foliage. */
export function blob(out: Stroke[], r: () => number, c: THREE.Vector3, br: number, ramp: Ramp, density = 260, size = 1) {
  const count = Math.round(br * br * density)
  for (let i = 0; i < count; i++) {
    const n = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1)
    if (n.lengthSq() > 1 || n.lengthSq() < 0.01) {
      i--
      continue
    }
    n.normalize()
    if (n.y < -0.35) n.y = -n.y * 0.3
    n.normalize()
    const p = c.clone().addScaledVector(n, br * (0.82 + r() * 0.3))
    const swirl = new THREE.Vector3().crossVectors(n, UP)
    if (swirl.lengthSq() < 1e-3) swirl.set(1, 0, 0)
    const dir = rotateAbout(swirl.normalize(), n, 0.6 + (r() - 0.5) * 0.9)
    out.push({ p, n, dir, len: (0.3 + r() * 0.28) * size, wid: (0.09 + r() * 0.06) * size, color: shade(r, n, ramp) })
  }
}

/** Vertical dabs wrapped round a cylinder from `base` up `h`. */
export function column(out: Stroke[], r: () => number, base: THREE.Vector3, h: number, rad: number, ramp: Ramp, count: number) {
  for (let i = 0; i < count; i++) {
    const y = r() * h
    const ang = r() * Math.PI * 2
    const n = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang))
    const p = base.clone().add(new THREE.Vector3(n.x * rad, y, n.z * rad))
    out.push({ p, n, dir: rotateAbout(UP, n, (r() - 0.5) * 0.15), len: 0.4 + r() * 0.3, wid: rad * 0.9, color: shade(r, n, ramp) })
  }
}
