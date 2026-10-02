import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { UP, yawQuaternion } from './plane'
import { CREEK, groundHeight, wildBlocked } from './island'
import { dusk } from './daynight'
import { type Ramp, type Stroke, Strokes, blob, column, rng, rotateAbout } from './strokes'

const GULL_WHITE = ['#f6f4ec', '#ece9de', '#fbfaf4']
const GULL_TIP = ['#3a3f46', '#4a5058']

/** One gull as a shallow "M" of four strokes, drawn twice (flat and upright) so it reads from any angle. */
function gullStrokes(out: Stroke[], r: () => number, c: THREE.Vector3) {
  const side = new THREE.Vector3(1, 0, 0)
  const fwd = new THREE.Vector3(0, 0, 1)
  for (const sgn of [-1, 1]) {
    const inner = rotateAbout(side.clone().multiplyScalar(sgn), fwd, sgn * 0.35)
    const outer = rotateAbout(side.clone().multiplyScalar(sgn), fwd, -sgn * 0.25)
    const elbow = c.clone().addScaledVector(inner, 0.45)
    const tip = elbow.clone().addScaledVector(outer, 0.45)
    for (const n of [UP, fwd]) {
      out.push({ p: c.clone().addScaledVector(inner, 0.22), n, dir: inner, len: 0.5, wid: 0.12, color: new THREE.Color(GULL_WHITE[Math.floor(r() * 3)]) })
      out.push({ p: elbow.clone().lerp(tip, 0.5), n, dir: outer, len: 0.5, wid: 0.08, color: new THREE.Color(GULL_TIP[Math.floor(r() * 2)]) })
    }
  }
}

const FLOCKS = [
  { c: new THREE.Vector3(-20, 22, 30), r: 26, speed: 0.07, n: 5, seed: 1 },
  { c: new THREE.Vector3(45, 26, -10), r: 32, speed: -0.05, n: 4, seed: 2 },
  { c: new THREE.Vector3(0, 30, -60), r: 22, speed: 0.06, n: 3, seed: 3 },
]

/** Small flocks of painted gulls wheeling over the island by day. */
function Gulls() {
  const flocks = useMemo(
    () =>
      FLOCKS.map((f) => {
        const r = rng(40 + f.seed)
        const out: Stroke[] = []
        for (let k = 0; k < f.n; k++) gullStrokes(out, r, new THREE.Vector3((r() - 0.5) * 6, (r() - 0.5) * 2, (r() - 0.5) * 5 - k * 1.2))
        return out
      }),
    [],
  )
  const groups = useRef<(THREE.Group | null)[]>([])
  const root = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (root.current) root.current.visible = dusk.k < 0.5
    FLOCKS.forEach((f, i) => {
      const g = groups.current[i]
      if (!g) return
      const a = t * f.speed + i * 2
      g.position.set(f.c.x + Math.cos(a) * f.r, f.c.y + Math.sin(t * 0.4 + i) * 1.5, f.c.z + Math.sin(a) * f.r)
      g.rotation.y = -a - (f.speed > 0 ? 0 : Math.PI)
      g.scale.set(1.6, 1.6 * (1 + Math.sin(t * 6 + i) * 0.35), 1.6)
    })
  })
  return (
    <group ref={root}>
      {flocks.map((s, i) => (
        <group key={i} ref={(g) => (groups.current[i] = g)}>
          <Strokes strokes={s} />
        </group>
      ))}
    </group>
  )
}

const ramp = (light: string, mid: string, dark: string): Ramp => ({ light: [light], mid: [mid], dark: [dark] })
const PETS = [
  { kind: 'cat', fur: ramp('#f0b06a', '#d9893b', '#a5612a'), at: 30, side: 3.6 },
  { kind: 'cat', fur: ramp('#5a5c63', '#2f3036', '#1d1e22'), at: 78, side: -3.8 },
  { kind: 'dog', fur: ramp('#dcb486', '#b98a5a', '#80593a'), at: 52, side: 4.2 },
] as const

/** A sitting/standing pet built from a few dabbed blobs; faces +z in local space. */
function petStrokes(kind: 'cat' | 'dog', fur: Ramp, seed: number) {
  const r = rng(seed)
  const out: Stroke[] = []
  const dog = kind === 'dog'
  const k = dog ? 1.35 : 1
  blob(out, r, new THREE.Vector3(0, 0.32 * k, -0.12 * k), 0.2 * k, fur, 500)
  blob(out, r, new THREE.Vector3(0, 0.34 * k, 0.12 * k), 0.19 * k, fur, 500)
  blob(out, r, new THREE.Vector3(0, 0.56 * k, 0.3 * k), 0.15 * k, fur, 600)
  for (const x of [-0.1, 0.1]) {
    for (const z of [-0.18, 0.18]) column(out, r, new THREE.Vector3(x * k, 0, z * k), 0.24 * k, 0.04 * k, fur, 8)
    const ear = new THREE.Vector3(x * 0.8 * k, (dog ? 0.62 : 0.7) * k, 0.3 * k)
    out.push({ p: ear, n: new THREE.Vector3(0, 0, 1), dir: dog ? new THREE.Vector3(x > 0 ? 0.4 : -0.4, -1, 0) : UP, len: dog ? 0.16 : 0.12, wid: 0.07 * k, color: new THREE.Color(fur.dark[0]) })
  }
  const tail = new THREE.Vector3(0, 0.38 * k, -0.32 * k)
  for (let i = 0; i < 4; i++) {
    const p = tail.clone().add(new THREE.Vector3(0, i * 0.07, -i * (dog ? 0.04 : 0.02)))
    out.push({ p, n: new THREE.Vector3(1, 0, 0), dir: new THREE.Vector3(0, 1, dog ? -0.6 : -0.2).normalize(), len: 0.12, wid: 0.05 * k, color: new THREE.Color(fur.mid[0]) })
  }
  return out
}

/** Two cats and a dog loafing beside the woodland creek. */
function Pets() {
  const pets = useMemo(
    () =>
      PETS.flatMap((p, i) => {
        const c = CREEK[p.at]
        const along = CREEK[p.at + 1].clone().sub(c).setY(0).normalize()
        const across = new THREE.Vector3().crossVectors(UP, along)
        const at = c.clone().addScaledVector(across, p.side)
        if (wildBlocked(at, 0.3)) return []
        at.y = groundHeight(at)
        return [{ at, q: yawQuaternion(across.clone().multiplyScalar(-Math.sign(p.side))), strokes: petStrokes(p.kind, p.fur, 900 + i) }]
      }),
    [],
  )
  const refs = useRef<(THREE.Group | null)[]>([])
  useFrame(({ clock }) => {
    refs.current.forEach((g, i) => {
      if (g) g.scale.setScalar(1.5 * (1 + Math.sin(clock.elapsedTime * 2 + i) * 0.02))
    })
  })
  return (
    <>
      {pets.map((p, i) => (
        <group key={i} ref={(g) => (refs.current[i] = g)} position={p.at} quaternion={p.q}>
          <Strokes strokes={p.strokes} />
        </group>
      ))}
    </>
  )
}

/** Day-time gulls in the sky and a few pets in the woods. */
export function Critters() {
  return (
    <>
      <Gulls />
      <Pets />
    </>
  )
}
