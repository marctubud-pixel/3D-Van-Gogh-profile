import { useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import type { WorldLocation } from '../../shared/types'
import { flatDistance, yawQuaternion } from './plane'
import { BRIDGE, PLAZA, ROUTE_K, ROUTE_LEN, ROUTE_S, SERVICE_POINT, landmarkBlockers, routeFrame, routePoint, surf } from './island'
import { type Ramp, type Stroke, StrokeBuild, StrokePaint, column, dab, painted, shade } from './strokes'
import { LINE_COLOR, Toon, geo } from './toon'

interface Spot {
  at: THREE.Vector3
  fwd: THREE.Vector3
}

/** Spot beside the road at arc length `s`, offset sideways by `off` world units. */
function roadSpot(s: number, off: number): Spot {
  return { at: routePoint(s, off), fwd: routeFrame(s).tan }
}

function Placed({ spot, lift = 0, children }: { spot: Spot; lift?: number; children: ReactNode }) {
  const q = useMemo(() => yawQuaternion(spot.fwd), [spot])
  return (
    <group position={surf(spot.at, lift)} quaternion={q}>
      {children}
    </group>
  )
}

const POLE_H = 7

const POLE: Ramp = { light: ['#a7aea8', '#b3b9b2'], mid: ['#8f9893', '#858e89', '#969e98'], dark: ['#6a736f', '#5f6864'] }
const ARM: Ramp = { light: ['#9aa29c'], mid: ['#7f8883', '#77807b'], dark: ['#5c6561'] }
const CAN: Ramp = { light: ['#c3c9c3', '#b7beb8'], mid: ['#9aa29d', '#a4aba5'], dark: ['#757e7a'] }
const INSULATOR: Ramp = { light: ['#f2efe6'], mid: ['#dcd8cc'], dark: ['#b9b5aa'] }
const TAG = ['#e7b53f', '#efc456', '#d9a432']

/** Horizontal bar of dabs wrapped around the z axis. */
function bar(out: Stroke[], r: () => number, y: number, half: number, rad: number, ramp: Ramp, count: number) {
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2
    const n = new THREE.Vector3(Math.cos(a), Math.sin(a), 0)
    out.push({ p: new THREE.Vector3(n.x * rad, y + n.y * rad, (r() * 2 - 1) * half), n, dir: new THREE.Vector3(0, 0, 1), len: 0.35 + r() * 0.25, wid: rad * 1.4, color: shade(r, n, ramp) })
  }
}

/** Utility pole built entirely from brush strokes: shaft, crossarm, insulators, transformer and tag. */
const poleStrokes = () =>
  painted('utility-pole', (r) => {
    const out: Stroke[] = []
    column(out, r, new THREE.Vector3(0, 0, 0), POLE_H, 0.13, POLE, 190)
    bar(out, r, POLE_H - 0.6, 0.9, 0.07, ARM, 46)
    for (const z of [-0.8, -0.35, 0.35, 0.8]) column(out, r, new THREE.Vector3(0, POLE_H - 0.53, z), 0.22, 0.05, INSULATOR, 6)
    column(out, r, new THREE.Vector3(0.36, POLE_H - 2, 0), 0.8, 0.22, CAN, 60)
    for (const y of [POLE_H - 1.98, POLE_H - 1.2]) bar(out, r, y, 0.2, 0.03, ARM, 4)
    for (let k = 0; k < 8; k++) {
      const d = dab((r() - 0.5) * 0.12, 1.4 + r() * 0.8, 0.15, Math.PI / 2 + (r() - 0.5) * 0.2, 0.3 + r() * 0.15, 0.09, TAG[Math.floor(r() * TAG.length)])
      out.push(d)
    }
    return out
  })

function UtilityPole() {
  return <StrokePaint strokes={poleStrokes()} />
}


function Bollard() {
  return (
    <>
      <Toon geometry={geo.cyl} color="#2f3a3d" position={[0, 0.5, 0]} scale={[0.22, 1, 0.22]} outline={0.02} />
      {[0.35, 0.7].map((y) => (
        <Toon key={y} geometry={geo.cyl} color="#e7b53f" position={[0, y, 0]} scale={[0.23, 0.1, 0.23]} outline={0} />
      ))}
    </>
  )
}

export function VendingMachine() {
  return (
    <>
      <Toon geometry={geo.box} color="#3f78a8" position={[0, 0.95, 0]} scale={[0.9, 1.9, 0.7]} outline={0.03} />
      <Toon geometry={geo.box} color="#e8ecf0" position={[0, 1.3, 0.36]} scale={[0.7, 0.8, 0.03]} outline={0.015} />
      <Toon geometry={geo.box} color="#2d383d" position={[0, 0.3, 0.36]} scale={[0.6, 0.18, 0.03]} outline={0.01} />
    </>
  )
}

function BusStop() {
  return (
    <>
      <Toon geometry={geo.cyl} color="#8f9893" position={[0, 1.3, 0]} scale={[0.08, 2.6, 0.08]} outline={0.02} />
      <Toon geometry={geo.cyl} color="#3f78a8" position={[0, 2.6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.7, 0.06, 0.7]} outline={0.02} />
      <Toon geometry={geo.box} color="#f3f4ee" position={[0, 1.6, 0.05]} scale={[0.35, 0.6, 0.04]} outline={0.015} />
    </>
  )
}


function Wires({ tops }: { tops: THREE.Vector3[] }) {
  const geometry = useMemo(() => {
    const pts: number[] = []
    for (let i = 0; i < tops.length - 1; i++) {
      const a = tops[i]
      const b = tops[i + 1]
      if (a.distanceTo(b) > 20) continue
      const sag = new THREE.Vector3(0, -0.5, 0)
      const segs = 8
      for (let s = 0; s < segs; s++) {
        for (const k of [s / segs, (s + 1) / segs]) {
          const p = a.clone().lerp(b, k).add(sag.clone().multiplyScalar(4 * k * (1 - k)))
          pts.push(p.x, p.y, p.z)
        }
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [tops])
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={LINE_COLOR} />
    </lineSegments>
  )
}

/** Street furniture along the island road: utility poles with wires, bridge bollards, vending machines. */
export function StreetProps({ locations }: { locations: WorldLocation[] }) {
  const layout = useMemo(() => {
    const blockers = locations.flatMap(landmarkBlockers)
    blockers.push(SERVICE_POINT)
    const plaza = PLAZA
    const free = (d: THREE.Vector3, r: number) => flatDistance(d, plaza) > 8 && blockers.every((b) => flatDistance(b, d) > r)
    const bridge: [number, number] = [ROUTE_S[BRIDGE.a] - 3, ROUTE_S[BRIDGE.b] + 3]
    const runs: Spot[][] = [[]]
    for (let s = 6; s < ROUTE_LEN - 4; s += 14) {
      const spot = roadSpot(s, 3.7)
      if ((s > bridge[0] && s < bridge[1]) || !free(spot.at, 7)) {
        if (runs[runs.length - 1].length) runs.push([])
        continue
      }
      runs[runs.length - 1].push(spot)
    }
    const poles = runs.flat()
    const wires = runs.filter((r) => r.length > 1).map((r) => r.map((p) => surf(p.at, POLE_H - 0.6)))
    const bollards: Spot[] = []
    for (const s of bridge) for (const k of [-1, 1]) bollards.push(roadSpot(s, k * 2.4))
    const vending: Spot[] = [18, 70, 124, 170]
      .map((s) => roadSpot(s * ROUTE_K, -4.2))
      .filter((v) => free(v.at, 6))
    return { poles, wires, bollards, vending }
  }, [locations])

  return (
    <group>
      {layout.poles.map((s, i) => (
        <Placed key={`p${i}`} spot={s}>
          <StrokeBuild seed={i + 3}>
            <UtilityPole />
          </StrokeBuild>
        </Placed>
      ))}
      {layout.wires.map((w, i) => (
        <Wires key={i} tops={w} />
      ))}
      {layout.bollards.map((s, i) => (
        <Placed key={`b${i}`} spot={s} lift={0.05}>
          <Bollard />
        </Placed>
      ))}
      {layout.vending.map((s, i) => (
        <Placed key={`v${i}`} spot={s}>
          <group rotation={[0, Math.PI / 2, 0]}>
            <StrokeBuild seed={i + 41}>
              <VendingMachine />
            </StrokeBuild>
          </group>
        </Placed>
      ))}
      <Placed spot={roadSpot(4, 3.8)}>
        <BusStop />
      </Placed>
    </group>
  )
}
