import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { Toon, geo, toonMaterial } from '../world/toon'

const MINT = '#86b8ab'
const TIRE = '#3a464c'
const METAL = '#c9ccc8'
const SEAT = '#7a5641'
const GRIP = '#8a5e46'
const WHEEL_R = 0.34

type Vec3 = [number, number, number]

/** Sweep a round tube along a smooth curve through the given points (in the bike's YZ plane unless x set). */
function CurveTube({ points, r = 0.035, color = MINT }: { points: Vec3[]; r?: number; color?: string }) {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)))
    return new THREE.TubeGeometry(curve, 24, r, 8, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points), r])
  return <Toon geometry={geometry} color={color} outline={0.018} radial={false} edges={false} />
}

const tireGeo = new THREE.TorusGeometry(WHEEL_R, 0.045, 8, 32)
const rimGeo = new THREE.TorusGeometry(WHEEL_R - 0.05, 0.012, 6, 32)
const fenderGeo = new THREE.TorusGeometry(WHEEL_R + 0.07, 0.035, 4, 24, Math.PI * 0.9)
const spokeGeo = (() => {
  const pts: number[] = []
  const n = 16
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const b = a + 0.5
    pts.push(0, 0, 0, Math.cos(b) * (WHEEL_R - 0.05), Math.sin(b) * (WHEEL_R - 0.05), 0)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  return g
})()
const spokeMat = new THREE.LineBasicMaterial({ color: '#9aa0a0' })

function Wheel() {
  return (
    <group rotation={[0, Math.PI / 2, 0]}>
      <Toon geometry={tireGeo} color={TIRE} outline={0.015} radial={false} />
      <Toon geometry={rimGeo} color={METAL} outline={0} />
      <lineSegments geometry={spokeGeo} material={spokeMat} />
      <Toon geometry={geo.cyl} color={METAL} rotation={[Math.PI / 2, 0, 0]} scale={[0.06, 0.1, 0.06]} outline={0} />
    </group>
  )
}

function Fender({ start }: { start: number }) {
  return (
    <group rotation={[0, Math.PI / 2, 0]}>
      <group rotation={[0, 0, start]}>
        <Toon geometry={fenderGeo} color={MINT} scale={[1, 1, 1.6]} outline={0.012} radial={false} />
      </group>
    </group>
  )
}

interface BikeProps {
  speed: RefObject<number>
  steer: RefObject<number>
  kickstand?: boolean
}

/** Mint Japanese city bicycle (mamachari): curved step-through frame, full fenders, chain guard, rear carrier, swept-back bars. */
export function Bike({ speed, steer, kickstand = false }: BikeProps) {
  const front = useRef<THREE.Group>(null)
  const rear = useRef<THREE.Group>(null)
  const fork = useRef<THREE.Group>(null)
  const crank = useRef<THREE.Group>(null)
  const reflector = useMemo(() => toonMaterial('#d9574a'), [])

  useFrame((_, dt) => {
    const spin = ((speed.current ?? 0) * dt) / WHEEL_R
    if (front.current) front.current.rotation.x += spin
    if (rear.current) rear.current.rotation.x += spin
    if (crank.current) crank.current.rotation.x += spin * 0.45
    if (fork.current) fork.current.rotation.y = (steer.current ?? 0) * 0.5
  })

  return (
    <group>
      {/* rear wheel + fender + carrier */}
      <group position={[0, WHEEL_R, -0.54]}>
        <group ref={rear}>
          <Wheel />
        </group>
        <Fender start={Math.PI * 0.05} />
      </group>
      <Toon geometry={geo.box} color={METAL} position={[0, 0.78, -0.6]} scale={[0.2, 0.025, 0.4]} outline={0.012} />
      {[-0.09, 0.09].map((x) => (
        <CurveTube key={x} points={[[x, 0.78, -0.78], [x, 0.56, -0.62], [x, WHEEL_R, -0.54]]} r={0.012} color={METAL} />
      ))}
      <Toon geometry={geo.box} color="#fff" material={reflector} position={[0, 0.66, -0.96]} scale={[0.06, 0.08, 0.02]} outline={0.01} />

      {/* front: fork, wheel, fender, swept-back handlebar with brown grips */}
      <group ref={fork} position={[0, 0, 0.54]}>
        <group position={[0, WHEEL_R, 0]}>
          <group ref={front}>
            <Wheel />
          </group>
          <Fender start={Math.PI * 0.05} />
        </group>
        <CurveTube points={[[0, WHEEL_R, 0], [0, 0.7, -0.07], [0, 1.02, -0.13]]} r={0.026} color={MINT} />
        <CurveTube points={[[0, 1.02, -0.13], [0, 1.14, -0.16], [0, 1.16, -0.2]]} r={0.02} color={METAL} />
        <CurveTube points={[[-0.3, 1.14, -0.36], [-0.2, 1.16, -0.24], [0, 1.16, -0.2], [0.2, 1.16, -0.24], [0.3, 1.14, -0.36]]} r={0.016} color={METAL} />
        {[-0.3, 0.3].map((x) => (
          <Toon key={x} geometry={geo.cyl} color={GRIP} position={[x * 1.05, 1.14, -0.4]} rotation={[Math.PI / 2, 0, 0]} scale={[0.05, 0.12, 0.05]} outline={0.01} />
        ))}
        <Toon geometry={geo.cyl} color="#ecebe4" position={[0, 0.9, 0.0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.1, 0.07, 0.1]} outline={0.012} />
      </group>

      {/* curved U step-through frame */}
      <CurveTube points={[[0, 1.0, 0.42], [0, 0.72, 0.3], [0, 0.46, 0.08], [0, 0.4, -0.08], [0, 0.46, -0.2]]} r={0.04} />
      <CurveTube points={[[0, 0.36, -0.1], [0, 0.62, -0.22], [0, 0.88, -0.3]]} r={0.034} />
      <CurveTube points={[[0.05, WHEEL_R, -0.54], [0.03, 0.35, -0.3], [0, 0.36, -0.1]]} r={0.018} />
      <CurveTube points={[[0.05, WHEEL_R, -0.54], [0.02, 0.6, -0.42], [0, 0.82, -0.29]]} r={0.018} />
      <CurveTube points={[[0, 0.86, -0.3], [0, 0.98, -0.34]]} r={0.02} color={METAL} />
      <Toon geometry={geo.sphere} color={SEAT} position={[0, 1.02, -0.36]} scale={[0.2, 0.08, 0.3]} outline={0.016} radial={false} />

      {/* chain guard + crank */}
      <Toon geometry={geo.box} color={MINT} position={[0.09, 0.37, -0.32]} scale={[0.03, 0.12, 0.46]} outline={0.012} />
      <group ref={crank} position={[0.1, 0.36, -0.1]}>
        <Toon geometry={geo.cyl} color={MINT} rotation={[0, 0, Math.PI / 2]} scale={[0.2, 0.03, 0.2]} outline={0.012} />
        <Toon geometry={geo.box} color={METAL} position={[0.02, 0.1, 0]} scale={[0.02, 0.2, 0.03]} outline={0} />
        <Toon geometry={geo.box} color={TIRE} position={[0.07, 0.2, 0]} scale={[0.1, 0.03, 0.07]} outline={0.01} />
        <Toon geometry={geo.box} color={METAL} position={[-0.21, -0.1, 0]} scale={[0.02, 0.2, 0.03]} outline={0} />
        <Toon geometry={geo.box} color={TIRE} position={[-0.26, -0.2, 0]} scale={[0.1, 0.03, 0.07]} outline={0.01} />
      </group>

      {/* left kickstand */}
      <group position={[-0.06, 0.32, -0.36]} rotation={[kickstand ? 0.2 : -1.3, 0, kickstand ? -0.25 : 0]}>
        <Toon geometry={geo.box} color={METAL} position={[0, -0.16, 0]} scale={[0.025, 0.32, 0.025]} outline={0.01} />
      </group>
    </group>
  )
}
