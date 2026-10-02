import { useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import type { WorldLocation } from '../../shared/types'
import { R, surfaceQuaternion } from './sphere'
import { BRIDGE, PLAZA, ROUTE_K, ROUTE_LEN, ROUTE_S, SERVICE_DIR, landmarkBlockers, routeFrame, routePoint, surf } from './island'
import { StrokeBuild } from './strokes'
import { LINE_COLOR, Toon, geo } from './toon'

interface Spot {
  up: THREE.Vector3
  fwd: THREE.Vector3
}

/** Spot beside the road at arc length `s`, offset sideways by `off` world units. */
function roadSpot(s: number, off: number): Spot {
  return { up: routePoint(s, off), fwd: routeFrame(s).tan }
}

function Placed({ spot, lift = 0, children }: { spot: Spot; lift?: number; children: ReactNode }) {
  const q = useMemo(() => surfaceQuaternion(spot.up, spot.fwd), [spot])
  return (
    <group position={surf(spot.up, lift)} quaternion={q}>
      {children}
    </group>
  )
}

const POLE_H = 7

function UtilityPole() {
  return (
    <>
      <Toon geometry={geo.cyl} color="#8f9893" position={[0, POLE_H / 2, 0]} scale={[0.26, POLE_H, 0.26]} outline={0.03} />
      <Toon geometry={geo.box} color="#7f8883" position={[0, POLE_H - 0.6, 0]} scale={[0.12, 0.12, 1.8]} outline={0.02} />
      <Toon geometry={geo.cyl} color="#9aa29d" position={[0.3, POLE_H - 1.6, 0]} scale={[0.45, 0.8, 0.45]} outline={0.03} />
      <Toon geometry={geo.box} color="#e7b53f" position={[0, 1.8, 0.14]} scale={[0.2, 0.9, 0.04]} outline={0.015} />
    </>
  )
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
      const mid = a.clone().add(b).multiplyScalar(0.5)
      const sag = mid.clone().normalize().multiplyScalar(-0.5)
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
    blockers.push(SERVICE_DIR)
    const plaza = PLAZA
    const free = (d: THREE.Vector3, r: number) => d.angleTo(plaza) * R > 8 && blockers.every((b) => b.angleTo(d) * R > r)
    const bridge: [number, number] = [ROUTE_S[BRIDGE.a] - 3, ROUTE_S[BRIDGE.b] + 3]
    const runs: Spot[][] = [[]]
    for (let s = 6; s < ROUTE_LEN - 4; s += 14) {
      const spot = roadSpot(s, 3.7)
      if ((s > bridge[0] && s < bridge[1]) || !free(spot.up, 7)) {
        if (runs[runs.length - 1].length) runs.push([])
        continue
      }
      runs[runs.length - 1].push(spot)
    }
    const poles = runs.flat()
    const wires = runs.filter((r) => r.length > 1).map((r) => r.map((p) => surf(p.up, POLE_H - 0.6)))
    const bollards: Spot[] = []
    for (const s of bridge) for (const k of [-1, 1]) bollards.push(roadSpot(s, k * 2.4))
    const vending: Spot[] = [18, 70, 124, 170]
      .map((s) => roadSpot(s * ROUTE_K, -4.2))
      .filter((v) => free(v.up, 6))
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
