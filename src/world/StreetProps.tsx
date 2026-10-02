import { useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import type { WorldLocation } from '../../shared/types'
import { UP, flatDistance, yawQuaternion } from './plane'
import { BRIDGE, PLAZA, ROUTE_K, ROUTE_LEN, ROUTE_S, SERVICE_POINT, landmarkBlockers, onCivic, routeFrame, routePoint, surf } from './island'
import { type Ramp, type Stroke, StrokeBuild, StrokePaint, Strokes, column, dab, painted, rng, rotateAbout, shade } from './strokes'
import { Toon, geo } from './toon'

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


const WIRE = ['#3c4548', '#465154', '#353d40', '#525c5e']

/** Sagging wires drawn freehand: wobbling chains of overlapping strokes whose weight swells and thins, crossed so they read from any side. */
function Wires({ tops }: { tops: THREE.Vector3[] }) {
  const strokes = useMemo(() => {
    const r = rng(tops.length * 31 + 7)
    const out: Stroke[] = []
    const segs = 24
    for (let i = 0; i < tops.length - 1; i++) {
      const a = tops[i]
      const b = tops[i + 1]
      if (a.distanceTo(b) > 40) continue
      const sag = 1.6 + r() * 0.9
      const ph = r() * Math.PI * 2
      const side = new THREE.Vector3().subVectors(b, a).cross(UP).normalize()
      const at = (k: number) =>
        a
          .clone()
          .lerp(b, k)
          .add(new THREE.Vector3(0, -sag * 4 * k * (1 - k) * 0.5 + Math.sin(k * 9 + ph) * 0.04, 0))
          .addScaledVector(side, Math.sin(k * 5 + ph) * 0.05)
      for (let s = 0; s < segs; s++) {
        const p0 = at(s / segs)
        const p1 = at((s + 1) / segs)
        const dir = p1.clone().sub(p0)
        const len = dir.length() * (1.35 + r() * 0.4)
        dir.normalize()
        const k = (s + 0.5) / segs
        const swell = 0.75 + 0.5 * Math.sin(k * Math.PI * 2 + ph) ** 2
        const p = p0.lerp(p1, 0.5).add(new THREE.Vector3(0, (r() - 0.5) * 0.04, 0))
        const wid = (0.045 + r() * 0.03) * swell
        const color = new THREE.Color(WIRE[Math.floor(r() * WIRE.length)])
        const tilt = rotateAbout(dir, side, (r() - 0.5) * 0.12)
        const up = new THREE.Vector3().crossVectors(side, tilt).normalize()
        out.push({ p, n: side, dir: tilt, len, wid, color })
        out.push({ p: p.clone(), n: up, dir: tilt, len, wid, color })
      }
    }
    return out
  }, [tops])
  return <Strokes strokes={strokes} />
}

/** Street furniture along the island road: utility poles with wires and vending machines. */
export function StreetProps({ locations }: { locations: WorldLocation[] }) {
  const layout = useMemo(() => {
    const blockers = locations.flatMap(landmarkBlockers)
    blockers.push(SERVICE_POINT)
    const plaza = PLAZA
    const free = (d: THREE.Vector3, r: number) => flatDistance(d, plaza) > 8 && !onCivic(d, 1.5) && blockers.every((b) => flatDistance(b, d) > r)
    const bridge: [number, number] = [ROUTE_S[BRIDGE.a] - 3, ROUTE_S[BRIDGE.b] + 3]
    const runs: Spot[][] = [[]]
    for (let s = 6; s < ROUTE_LEN - 4; s += 34) {
      const spot = roadSpot(s, 3.7)
      if ((s > bridge[0] && s < bridge[1]) || !free(spot.at, 7)) {
        if (runs[runs.length - 1].length) runs.push([])
        continue
      }
      runs[runs.length - 1].push(spot)
    }
    const poles = runs.flat()
    const wires = runs.filter((r) => r.length > 1).map((r) => r.map((p) => surf(p.at, POLE_H - 0.6)))
    const vending: Spot[] = [18, 70, 124, 170]
      .map((s) => roadSpot(s * ROUTE_K, -4.2))
      .filter((v) => free(v.at, 6))
    return { poles, wires, vending }
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
