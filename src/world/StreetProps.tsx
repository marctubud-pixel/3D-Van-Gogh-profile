import { useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import type { WorldLocation } from '../../shared/types'
import { R, dirFromLatLon, locationAnchors, surfaceQuaternion } from './sphere'
import { LINE_COLOR, Toon, geo } from './toon'

interface Spot {
  up: THREE.Vector3
  fwd: THREE.Vector3
}

/** Point on a road great circle at angle `t` (deg), offset sideways by `side` world units. */
function roadPoint(road: 'eq' | 'mer', t: number, side: number): Spot {
  const a = THREE.MathUtils.degToRad(t)
  const o = side / R
  if (road === 'eq') {
    const up = new THREE.Vector3(Math.sin(a) * Math.cos(o), Math.sin(o), Math.cos(a) * Math.cos(o)).normalize()
    return { up, fwd: new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)) }
  }
  const up = new THREE.Vector3(Math.sin(o), Math.sin(a) * Math.cos(o), Math.cos(a) * Math.cos(o)).normalize()
  return { up, fwd: new THREE.Vector3(0, Math.cos(a), -Math.sin(a)) }
}

function Placed({ spot, lift = 0, children }: { spot: Spot; lift?: number; children: ReactNode }) {
  const q = useMemo(() => surfaceQuaternion(spot.up, spot.fwd), [spot])
  return (
    <group position={spot.up.clone().multiplyScalar(R + lift)} quaternion={q}>
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

function TrafficCone() {
  return (
    <>
      <Toon geometry={geo.box} color="#e0773f" position={[0, 0.03, 0]} scale={[0.45, 0.06, 0.45]} outline={0.02} />
      <Toon geometry={geo.cone} color="#e0773f" position={[0, 0.38, 0]} scale={[0.34, 0.7, 0.34]} outline={0.025} />
      <Toon geometry={geo.cyl} color="#f3f4ee" position={[0, 0.42, 0]} scale={[0.22, 0.1, 0.22]} outline={0} />
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

function Fence({ length = 4 }: { length?: number }) {
  const posts = Math.max(2, Math.round(length / 1.2) + 1)
  return (
    <>
      {Array.from({ length: posts }, (_, i) => (
        <Toon key={i} geometry={geo.box} color="#9b8a74" position={[-length / 2 + (i * length) / (posts - 1), 0.5, 0]} scale={[0.12, 1, 0.12]} outline={0.015} />
      ))}
      {[0.4, 0.8].map((y) => (
        <Toon key={y} geometry={geo.box} color="#a8977f" position={[0, y, 0]} scale={[length, 0.1, 0.06]} outline={0.015} />
      ))}
    </>
  )
}

function Wires({ tops }: { tops: THREE.Vector3[] }) {
  const geometry = useMemo(() => {
    const pts: number[] = []
    for (let i = 0; i < tops.length; i++) {
      const a = tops[i]
      const b = tops[(i + 1) % tops.length]
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

/** Japanese small-town street furniture along the two ring roads and around the plaza. */
export function StreetProps({ locations }: { locations: WorldLocation[] }) {
  const layout = useMemo(() => {
    const blockers = locations.flatMap((l) => {
      const a = locationAnchors(l.lat, l.lon)
      return [a.building, a.parking]
    })
    const plaza = dirFromLatLon(0, 0)
    const free = (d: THREE.Vector3, r: number) => d.angleTo(plaza) * R > 9 && blockers.every((b) => b.angleTo(d) * R > r)
    const poles: Spot[] = []
    for (const road of ['eq', 'mer'] as const) {
      for (let t = -180; t < 180; t += 13) {
        const s = roadPoint(road, t + (road === 'mer' ? 6 : 0), 3.6)
        if (THREE.MathUtils.radToDeg(Math.asin(s.up.y)) < -33) continue
        if (free(s.up, 5)) poles.push(s)
      }
    }
    const cones: Spot[] = []
    const bollards: Spot[] = []
    locations.forEach((l, i) => {
      const a = locationAnchors(l.lat, l.lon)
      const side = new THREE.Vector3().crossVectors(a.parking, a.facing).normalize()
      for (const k of [-1, 1]) {
        const up = a.parking
          .clone()
          .add(a.facing.clone().multiplyScalar((1.7 + (i % 2) * 0.2) / R))
          .add(side.clone().multiplyScalar((k * 1.1) / R))
          .normalize()
        cones.push({ up, fwd: a.facing })
      }
    })
    for (let k = -2; k <= 2; k++) {
      if (k === 0) continue
      bollards.push(roadPoint('eq', (k * 2.2 * 180) / (Math.PI * R) + 7.5 * Math.sign(k), 2.2))
      bollards.push(roadPoint('eq', (k * 2.2 * 180) / (Math.PI * R) + 7.5 * Math.sign(k), -2.2))
    }
    const fences: Spot[] = []
    for (let lon = -170; lon <= 170; lon += 17) {
      const up = dirFromLatLon(-31, lon)
      if (free(up, 6)) fences.push({ up, fwd: new THREE.Vector3(Math.cos(THREE.MathUtils.degToRad(lon)), 0, -Math.sin(THREE.MathUtils.degToRad(lon))) })
    }
    const tops = poles.filter((p) => Math.abs(p.up.y) < 0.2).map((p) => p.up.clone().multiplyScalar(R + POLE_H - 0.6))
    return { poles, cones, bollards, fences, tops }
  }, [locations])

  return (
    <group>
      {layout.poles.map((s, i) => (
        <Placed key={`p${i}`} spot={s}>
          <UtilityPole />
        </Placed>
      ))}
      <Wires tops={layout.tops} />
      {layout.cones.map((s, i) => (
        <Placed key={`c${i}`} spot={s} lift={0.03}>
          <TrafficCone />
        </Placed>
      ))}
      {layout.bollards.map((s, i) => (
        <Placed key={`b${i}`} spot={s} lift={0.05}>
          <Bollard />
        </Placed>
      ))}
      {layout.fences.map((s, i) => (
        <Placed key={`f${i}`} spot={s}>
          <Fence length={5} />
        </Placed>
      ))}
      <Placed spot={roadPoint('mer', 10, -4.2)}>
        <group rotation={[0, Math.PI / 2, 0]}>
          <VendingMachine />
        </group>
      </Placed>
      <Placed spot={roadPoint('eq', -11, 3.6)}>
        <BusStop />
      </Placed>
    </group>
  )
}
