import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

/** Seeded RNG so the painting is stable between reloads. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const LIGHT = new THREE.Vector3(0.55, 0.8, 0.35).normalize()

interface Stroke {
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

const brushMat = () =>
  new THREE.MeshBasicMaterial({ map: brushTexture(), alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: false })

function pick(r: () => number, palette: string[]) {
  return palette[Math.floor(r() * palette.length)]
}

/** Light/mid/dark palette chosen by facing; random jitter keeps neighbouring dabs distinct. */
function shade(r: () => number, n: THREE.Vector3, ramp: { light: string[]; mid: string[]; dark: string[] }) {
  const k = n.dot(LIGHT) + (r() - 0.5) * 0.5
  return new THREE.Color(pick(r, k > 0.55 ? ramp.light : k > 0.05 ? ramp.mid : ramp.dark))
}

function rotateAbout(v: THREE.Vector3, axis: THREE.Vector3, a: number) {
  return v.clone().applyAxisAngle(axis, a)
}

function Strokes({ strokes }: { strokes: Stroke[] }) {
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

const WALL = {
  light: ['#dfe6f3', '#c9d8f0', '#e8dccf', '#bcd0ee'],
  mid: ['#a9c1e6', '#97b1dd', '#b5b8dc', '#c2cfe8'],
  dark: ['#7f97c9', '#6f86bd', '#8c8fc4', '#5f78ad'],
}
const ROOF = {
  light: ['#f0a35a', '#f6bd6d', '#e98a48'],
  mid: ['#d9733f', '#c9632f', '#e0844c'],
  dark: ['#a64a2a', '#8f3f26', '#b5583a'],
}
const NAVY = ['#1f2d5a', '#253a6e', '#18244a']

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
  const DOOR = ['#2f6f68', '#3b8075', '#275e5a', '#4a8c7c']
  const GLASS = ['#f3d36a', '#f7e08a', '#e9bf4f', '#9cc7c0']
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
  light: ['#b9d46a', '#d4dd78', '#9fc95f', '#e6d36a'],
  mid: ['#6fa64a', '#5d9a48', '#7fb456', '#4f8a52'],
  dark: ['#2f6a4a', '#285a4f', '#1f4d4a', '#3b5f7a'],
}
const BARK = {
  light: ['#c98a4a', '#d8a05a'],
  mid: ['#8f5a34', '#a06a3c', '#7a4b2e'],
  dark: ['#4a3328', '#3a2c3a', '#2a2a4a'],
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
  light: ['#e6c56a', '#efd27a', '#d9b45a', '#f0dca0'],
  mid: ['#c99a4a', '#b9884a', '#d2a65a', '#a8b46a'],
  dark: ['#7a8a8a', '#6a7aa0', '#8a7a8a'],
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
  for (let i = 0; i < 14000; i++) {
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r()) * 16
    const x = Math.cos(a) * d
    const z = Math.sin(a) * d
    const p = new THREE.Vector3(x, 0.002 + r() * 0.01, z)
    const flow = Math.sin(x * 0.35) * 0.9 + Math.cos(z * 0.3) * 0.6
    const dir = new THREE.Vector3(Math.cos(flow), 0, Math.sin(flow))
    const ramp = inShadow(x, z) ? { light: GROUND.dark, mid: GROUND.dark, dark: GROUND.dark } : GROUND
    s.push({ p, n, dir, len: 0.6 + r() * 0.6, wid: 0.2 + r() * 0.14, color: shade(r, n, ramp) })
  }
  return s
}

const SKY = ['#8fc6e0', '#a7d6e6', '#c6e6ea', '#6fa8d6', '#e8efe0', '#7fb4e0']

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

/** Sandbox for building geometry entirely out of brush strokes (Van Gogh test). */
export default function StrokeLab() {
  const all = useMemo(() => [...groundStrokes(), ...houseStrokes(), ...treeStrokes(), ...skyStrokes()], [])
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas
        camera={{ fov: 45, position: [10, 5.5, 12], near: 0.1, far: 200 }}
        gl={{ antialias: true }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.NoToneMapping
          scene.background = new THREE.Color('#9fcfe0')
        }}
      >
        <Strokes strokes={all} />
        <OrbitControls target={[-1, 2, 0]} enableDamping />
      </Canvas>
    </div>
  )
}
