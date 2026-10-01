import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'

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
  }, [strokes])
  return <instancedMesh ref={ref} args={[geom, mat, strokes.length]} frustumCulled={false} />
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

/** Cover a transformed geometry's surface with dabs; dab size follows the part's thickness. */
function paintGeometry(out: Stroke[], r: () => number, g: THREE.BufferGeometry, m: THREE.Matrix4, color: string, outline: boolean) {
  const pos = g.getAttribute('position')
  const idx = g.getIndex()
  const nTri = idx ? idx.count / 3 : pos.count / 3
  const verts: THREE.Vector3[] = []
  for (let i = 0; i < pos.count; i++) verts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m))
  const box = new THREE.Box3().setFromPoints(verts)
  const size = box.getSize(new THREE.Vector3())
  const dims = [size.x, size.y, size.z].sort((a, b) => a - b)
  const s = THREE.MathUtils.clamp(dims[1] * 0.6, 0.05, 0.55)
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
    p.addScaledVector(n, 0.008 + r() * 0.02)
    const dir = UP.clone().addScaledVector(n, -n.y)
    if (dir.lengthSq() < 0.04) dir.set(1, 0, 0).addScaledVector(n, -n.x)
    dir.normalize()
    const swirl = rotateAbout(dir, n, (r() - 0.5) * 0.5)
    out.push({ p, n, dir: swirl, len: s * (0.7 + r() * 0.6), wid: s * 0.36 * (0.7 + r() * 0.6), color: shade(r, n, ramp) })
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
  return <mesh ref={ref} geometry={geometry} material={baseMaterial(color)} />
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
  }, [reg, seed, version])
  return (
    <group ref={root}>
      <StrokeCtx.Provider value={reg}>{children}</StrokeCtx.Provider>
      {strokes.length > 0 && <Strokes key={strokes.length} strokes={strokes} />}
    </group>
  )
}
