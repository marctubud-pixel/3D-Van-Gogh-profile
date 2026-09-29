import { useFrame } from '@react-three/fiber'
import { useRef, type RefObject } from 'react'
import type * as THREE from 'three'
import { Toon, geo } from '../world/toon'

const FRAME = '#6f98a3'
const DARK = '#474f55'
const METAL = '#9aa3a6'
const SEAT = '#6b5647'

type Vec3 = [number, number, number]

function Tube({ from, to, r = 0.035, color = FRAME }: { from: Vec3; to: Vec3; r?: number; color?: string }) {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const dz = to[2] - from[2]
  const len = Math.hypot(dx, dy, dz)
  const mid: Vec3 = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2]
  const pitch = Math.atan2(dz, dy)
  return <Toon geometry={geo.cyl} color={color} position={mid} rotation={[pitch, 0, 0]} scale={[r * 2, len, r * 2]} outline={0.025} />
}

interface BikeProps {
  speed: RefObject<number>
  steer: RefObject<number>
  kickstand?: boolean
}

/** Japanese coastal city bicycle: low step-through frame, no basket, right-side single speed, left kickstand. */
export function Bike({ speed, steer, kickstand = false }: BikeProps) {
  const front = useRef<THREE.Group>(null)
  const rear = useRef<THREE.Group>(null)
  const fork = useRef<THREE.Group>(null)
  const crank = useRef<THREE.Group>(null)

  useFrame((_, dt) => {
    const spin = ((speed.current ?? 0) * dt) / 0.34
    if (front.current) front.current.rotation.x += spin
    if (rear.current) rear.current.rotation.x += spin
    if (crank.current) crank.current.rotation.x += spin * 0.45
    if (fork.current) fork.current.rotation.y = (steer.current ?? 0) * 0.5
  })

  return (
    <group>
      <group ref={rear} position={[0, 0.34, -0.52]}>
        <Toon geometry={geo.wheel} color={DARK} rotation={[0, Math.PI / 2, 0]} outline={0.02} radial={false} />
        <Toon geometry={geo.cyl} color={METAL} rotation={[0, 0, Math.PI / 2]} scale={[0.08, 0.1, 0.08]} outline={0} />
      </group>
      <group ref={fork} position={[0, 0, 0.52]}>
        <group ref={front} position={[0, 0.34, 0]}>
          <Toon geometry={geo.wheel} color={DARK} rotation={[0, Math.PI / 2, 0]} outline={0.02} radial={false} />
        </group>
        <Tube from={[0, 0.34, 0]} to={[0, 0.95, -0.08]} r={0.028} color={METAL} />
        <Tube from={[-0.24, 1.02, -0.14]} to={[0.24, 1.02, -0.14]} r={0.022} color={METAL} />
        <Toon geometry={geo.box} color={DARK} position={[0.27, 1.02, -0.14]} scale={[0.08, 0.05, 0.05]} outline={0.015} />
        <Toon geometry={geo.box} color={DARK} position={[-0.27, 1.02, -0.14]} scale={[0.08, 0.05, 0.05]} outline={0.015} />
        <Toon geometry={geo.cyl} color="#e9dfc6" position={[0, 0.88, 0.02]} rotation={[Math.PI / 2, 0, 0]} scale={[0.1, 0.07, 0.1]} outline={0.015} />
        <Toon geometry={geo.box} color={FRAME} position={[0, 0.62, 0.02]} scale={[0.05, 0.03, 0.26]} outline={0} />
      </group>
      {/* step-through frame */}
      <Tube from={[0, 0.34, -0.1]} to={[0, 0.9, 0.44]} />
      <Tube from={[0, 0.34, -0.1]} to={[0, 0.82, -0.28]} />
      <Tube from={[0, 0.34, -0.1]} to={[0.06, 0.34, -0.52]} r={0.022} />
      <Tube from={[0, 0.82, -0.28]} to={[0.06, 0.34, -0.52]} r={0.022} />
      <Tube from={[0, 0.82, -0.28]} to={[0, 0.95, -0.33]} r={0.022} color={METAL} />
      <Toon geometry={geo.box} color={SEAT} position={[0, 0.98, -0.34]} scale={[0.16, 0.06, 0.26]} outline={0.02} />
      {/* rear carrier + mudguards */}
      <Toon geometry={geo.box} color={METAL} position={[0, 0.74, -0.58]} scale={[0.16, 0.025, 0.36]} outline={0.015} />
      <Toon geometry={geo.box} color="#e9dfc6" position={[0, 0.72, 0.42]} scale={[0.06, 0.02, 0.2]} outline={0} />
      {/* right-side single-speed drivetrain */}
      <group ref={crank} position={[0.08, 0.34, -0.1]}>
        <Toon geometry={geo.cyl} color={METAL} rotation={[0, 0, Math.PI / 2]} scale={[0.22, 0.02, 0.22]} outline={0.015} />
        <Toon geometry={geo.box} color={DARK} position={[0.03, 0.1, 0]} scale={[0.02, 0.2, 0.03]} outline={0} />
        <Toon geometry={geo.box} color={DARK} position={[0.08, 0.2, 0]} scale={[0.1, 0.03, 0.06]} outline={0.01} />
        <Toon geometry={geo.box} color={DARK} position={[-0.19, -0.1, 0]} scale={[0.02, 0.2, 0.03]} outline={0} />
        <Toon geometry={geo.box} color={DARK} position={[-0.24, -0.2, 0]} scale={[0.1, 0.03, 0.06]} outline={0.01} />
      </group>
      <Toon geometry={geo.box} color="#5d676c" position={[0.1, 0.34, -0.31]} scale={[0.03, 0.08, 0.42]} outline={0.01} />
      {/* left kickstand */}
      <group position={[-0.06, 0.3, -0.32]} rotation={[kickstand ? 0.2 : -1.3, 0, kickstand ? -0.25 : 0]}>
        <Toon geometry={geo.box} color={METAL} position={[0, -0.15, 0]} scale={[0.025, 0.3, 0.025]} outline={0.01} />
      </group>
    </group>
  )
}
