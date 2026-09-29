import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { Toon, geo, toonMaterial } from '../world/toon'

const SKIN = '#f2d2b8'
const HAIR = '#262c3a'
const CAP = '#6b7c96'
const SHORTS = '#66778f'
const TEE = '#f3eee2'
const BAG = '#4d4846'
const SOCK = '#f5f3ec'
const SHOE = '#ebe9e2'
const SOLE = '#b6babc'
const STRIPE_BLUE = '#6a7ea3'
const STRIPE_CREAM = '#f1ebdd'

const limb = new THREE.CapsuleGeometry(0.5, 1, 4, 12)
const brim = new THREE.CylinderGeometry(0.5, 0.5, 1, 20, 1, false, -Math.PI / 2, Math.PI)
const sleeveGeo = new THREE.CylinderGeometry(0.5, 0.62, 1, 14, 1, true)
const shortsLegGeo = new THREE.CylinderGeometry(0.5, 0.56, 1, 14, 1, false)
const OPEN = 0.42
const LEG_LENGTH = 0.86

/** Loose boxy camp-shirt silhouette: straight hem, soft shoulders, open at the front. */
const shirtGeo = new THREE.LatheGeometry(
  [
    new THREE.Vector2(0.54, -0.1),
    new THREE.Vector2(0.55, 0.28),
    new THREE.Vector2(0.53, 0.44),
    new THREE.Vector2(0.42, 0.52),
    new THREE.Vector2(0.22, 0.57),
  ],
  28,
  OPEN,
  Math.PI * 2 - OPEN * 2,
)
const torsoGeo = new THREE.LatheGeometry(
  [
    new THREE.Vector2(0.001, -0.08),
    new THREE.Vector2(0.46, -0.06),
    new THREE.Vector2(0.48, 0.3),
    new THREE.Vector2(0.4, 0.5),
    new THREE.Vector2(0.18, 0.57),
    new THREE.Vector2(0.001, 0.58),
  ],
  24,
)

function stripeMaterial(repeat: number) {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 8
  const g = c.getContext('2d')!
  g.fillStyle = STRIPE_BLUE
  g.fillRect(0, 0, 32, 8)
  g.fillStyle = STRIPE_CREAM
  g.fillRect(32, 0, 32, 8)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  tex.repeat.set(repeat, 1)
  tex.magFilter = THREE.NearestFilter
  tex.colorSpace = THREE.SRGBColorSpace
  const m = toonMaterial('#ffffff').clone()
  m.map = tex
  m.side = THREE.DoubleSide
  return m
}

interface AvatarProps {
  pose: 'ride' | 'walk'
  speed: RefObject<number>
}

function Leg({ side, legRef, hip }: { side: number; legRef: RefObject<THREE.Group | null>; hip: number }) {
  const floor = -LEG_LENGTH
  return (
    <group ref={legRef} position={[side * 0.1, hip, 0]}>
      <Toon geometry={shortsLegGeo} color={SHORTS} position={[side * 0.01, -0.17, 0]} scale={[0.2, 0.34, 0.21]} outline={0.02} radial={false} />
      <Toon geometry={limb} color={SKIN} position={[0, -0.5, 0]} scale={[0.1, 0.2, 0.1]} outline={0.014} radial={false} />
      <Toon geometry={geo.cyl} color={SOCK} position={[0, floor + 0.17, 0]} scale={[0.105, 0.2, 0.105]} outline={0.012} />
      <Toon geometry={limb} color={SHOE} position={[0, floor + 0.07, 0.05]} rotation={[Math.PI / 2, 0, 0]} scale={[0.14, 0.1, 0.12]} outline={0.018} radial={false} />
      <Toon geometry={geo.box} color={SOLE} position={[0, floor + 0.02, 0.05]} scale={[0.14, 0.04, 0.3]} outline={0} />
      <Toon geometry={geo.box} color="#c9cccd" position={[side * 0.07, floor + 0.08, 0.06]} scale={[0.01, 0.05, 0.14]} outline={0} />
    </group>
  )
}

function Arm({ side, armRef, sleeve }: { side: number; armRef: RefObject<THREE.Group | null>; sleeve: THREE.Material }) {
  return (
    <group ref={armRef} position={[side * 0.22, 0.47, 0]}>
      <group rotation={[0, 0, side * 0.12]}>
        <Toon geometry={sleeveGeo} color="#fff" material={sleeve} position={[0, -0.1, 0]} scale={[0.15, 0.24, 0.16]} outline={0.016} radial={false} />
        <Toon geometry={limb} color={SKIN} position={[0, -0.33, 0]} scale={[0.075, 0.17, 0.075]} outline={0.012} radial={false} />
        <Toon geometry={geo.sphere} color={SKIN} position={[0, -0.55, 0.01]} scale={[0.075, 0.1, 0.06]} outline={0.01} radial={false} />
      </group>
    </group>
  )
}

/** Creator Avatar after the character sheet: slim ~6.5-head proportions, blue-gray cap, loose open wide-stripe camp shirt over a cream tee, slate shorts, crew socks, chunky sneakers, crossbody bag. */
export function Avatar({ pose, speed }: AvatarProps) {
  const legL = useRef<THREE.Group>(null)
  const legR = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const phase = useRef(0)
  const shirt = useMemo(() => stripeMaterial(7), [])
  const sleeve = useMemo(() => stripeMaterial(3), [])

  useFrame((_, dt) => {
    const v = speed.current ?? 0
    if (pose === 'walk') {
      phase.current += dt * v * 5.5
      const s = Math.sin(phase.current) * Math.min(1, Math.abs(v) * 1.2) * 0.55
      if (legL.current) legL.current.rotation.x = s
      if (legR.current) legR.current.rotation.x = -s
      if (armL.current) armL.current.rotation.x = -s * 0.8
      if (armR.current) armR.current.rotation.x = s * 0.8
    } else {
      phase.current += (dt * v) / 0.34 * 0.45
      const p = phase.current
      if (legL.current) legL.current.rotation.x = -1.1 + Math.sin(p) * 0.45
      if (legR.current) legR.current.rotation.x = -1.1 - Math.sin(p) * 0.45
      if (armL.current) armL.current.rotation.x = -0.95
      if (armR.current) armR.current.rotation.x = -0.95
    }
  })

  const hip = pose === 'ride' ? 1.04 : 0.86
  const lean = pose === 'ride' ? 0.3 : 0
  const z = pose === 'ride' ? -0.3 : 0

  return (
    <group position={[0, 0, z]}>
      <Leg side={-1} legRef={legL} hip={hip} />
      <Leg side={1} legRef={legR} hip={hip} />
      <group position={[0, hip, 0]} rotation={[lean, 0, 0]}>
        <Toon geometry={shortsLegGeo} color={SHORTS} position={[0, -0.02, 0]} scale={[0.36, 0.16, 0.22]} outline={0.015} radial={false} />
        {/* cream tee + open striped shirt */}
        <Toon geometry={torsoGeo} color={TEE} scale={[0.37, 1, 0.21]} outline={0} radial={false} />
        <Toon geometry={shirtGeo} color="#fff" material={shirt} scale={[0.43, 1, 0.26]} outline={0.02} radial={false} />
        {[-1, 1].map((s) => (
          <Toon key={s} geometry={geo.box} color={STRIPE_CREAM} position={[s * 0.09, 0.5, 0.12]} rotation={[0.25, 0, s * -0.55]} scale={[0.09, 0.16, 0.015]} outline={0.008} />
        ))}
        {/* crossbody strap from right shoulder to left hip, small pouch on the left */}
        <Toon geometry={geo.box} color={BAG} position={[-0.01, 0.3, 0.135]} rotation={[0, 0, -0.72]} scale={[0.035, 0.68, 0.015]} outline={0} />
        <Toon geometry={geo.box} color={BAG} position={[-0.01, 0.3, -0.135]} rotation={[0, 0, 0.72]} scale={[0.035, 0.68, 0.015]} outline={0} />
        <Toon geometry={geo.sphere} color={BAG} position={[-0.25, 0.04, 0.05]} scale={[0.1, 0.17, 0.16]} outline={0.016} radial={false} />
        <Arm side={-1} armRef={armL} sleeve={sleeve} />
        <Arm side={1} armRef={armR} sleeve={sleeve} />
        {/* neck, head, hair, cap */}
        <Toon geometry={geo.cyl} color={SKIN} position={[0, 0.62, 0]} scale={[0.09, 0.12, 0.09]} outline={0} />
        <Toon geometry={geo.sphere} color={SKIN} position={[0, 0.79, 0.01]} scale={[0.24, 0.28, 0.25]} outline={0.018} radial={false} />
        {[-1, 1].map((s) => (
          <Toon key={s} geometry={geo.sphere} color={SKIN} position={[s * 0.12, 0.78, 0]} scale={[0.04, 0.07, 0.05]} outline={0.008} radial={false} />
        ))}
        {[-1, 1].map((s) => (
          <Toon key={`eye${s}`} geometry={geo.sphere} color={HAIR} position={[s * 0.05, 0.78, 0.128]} scale={[0.028, 0.042, 0.02]} outline={0} radial={false} />
        ))}
        <Toon geometry={geo.box} color="#c98f7a" position={[0, 0.71, 0.128]} scale={[0.03, 0.008, 0.01]} outline={0} />
        <Toon geometry={geo.sphere} color={HAIR} position={[0, 0.81, -0.03]} scale={[0.26, 0.26, 0.25]} outline={0.016} radial={false} />
        {[-0.08, 0, 0.08].map((x, i) => (
          <Toon key={x} geometry={geo.cone} color={HAIR} position={[x, 0.86, 0.11]} rotation={[Math.PI + 0.3, 0, (i - 1) * 0.3]} scale={[0.06, 0.09, 0.04]} outline={0} />
        ))}
        {[-1, 1].map((s) => (
          <Toon key={s} geometry={geo.cone} color={HAIR} position={[s * 0.115, 0.8, 0.05]} rotation={[Math.PI, 0, 0]} scale={[0.04, 0.1, 0.05]} outline={0} />
        ))}
        <Toon geometry={geo.dome} color={CAP} position={[0, 0.86, 0]} scale={[0.27, 0.2, 0.28]} outline={0.016} radial={false} />
        <Toon geometry={brim} color={CAP} position={[0, 0.87, 0.1]} scale={[0.23, 0.02, 0.3]} outline={0.01} radial={false} />
        <Toon geometry={geo.sphere} color="#2c3437" position={[0, 0.94, -0.12]} scale={[0.07, 0.04, 0.03]} outline={0} radial={false} />
      </group>
    </group>
  )
}
