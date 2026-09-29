import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { Toon, geo, toonMaterial } from '../world/toon'

const SKIN = '#f0cfb4'
const HAIR = '#2b3140'
const CAP = '#6b7c93'
const SHORTS = '#66758a'
const TEE = '#f1ece0'
const BAG = '#4a4644'
const SOCK = '#f4f2ec'
const SHOE = '#e9e6de'
const SOLE = '#b9bcbd'

const limb = new THREE.CapsuleGeometry(0.5, 1, 4, 10)
const brim = new THREE.CylinderGeometry(0.5, 0.5, 1, 20, 1, false, -Math.PI / 2, Math.PI)

function stripeTexture() {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 8
  const g = c.getContext('2d')!
  ;['#6b7fa0', '#efe9dc'].forEach((col, i) => {
    g.fillStyle = col
    g.fillRect(i * 32, 0, 32, 8)
  })
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  tex.repeat.set(3, 1)
  tex.magFilter = THREE.NearestFilter
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

interface AvatarProps {
  pose: 'ride' | 'walk'
  speed: RefObject<number>
}

function Leg({ side, legRef, hip }: { side: number; legRef: RefObject<THREE.Group | null>; hip: number }) {
  return (
    <group ref={legRef} position={[side * 0.11, hip, 0]}>
      <Toon geometry={geo.box} color={SHORTS} position={[0, -0.17, 0]} scale={[0.19, 0.36, 0.21]} outline={0.02} />
      <Toon geometry={limb} color={SKIN} position={[0, -0.52, 0]} scale={[0.1, 0.3, 0.1]} outline={0.016} radial={false} />
      <Toon geometry={geo.cyl} color={SOCK} position={[0, -0.72, 0]} scale={[0.11, 0.14, 0.11]} outline={0.014} />
      <Toon geometry={geo.box} color={SHOE} position={[0, -0.8, 0.05]} scale={[0.14, 0.1, 0.27]} outline={0.02} />
      <Toon geometry={geo.box} color={SOLE} position={[0, -0.85, 0.05]} scale={[0.145, 0.03, 0.28]} outline={0} />
    </group>
  )
}

function Arm({ side, armRef, shirt }: { side: number; armRef: RefObject<THREE.Group | null>; shirt: THREE.Material }) {
  return (
    <group ref={armRef} position={[side * 0.27, 0.56, 0]} rotation={[0, 0, side * 0.08]}>
      <Toon geometry={geo.box} color="#fff" material={shirt} position={[side * 0.02, -0.1, 0]} scale={[0.17, 0.24, 0.19]} outline={0.018} />
      <Toon geometry={limb} color={SKIN} position={[side * 0.02, -0.38, 0]} scale={[0.085, 0.26, 0.085]} outline={0.014} radial={false} />
    </group>
  )
}

/** Creator Avatar: blue-gray cap, open short-sleeve wide-stripe shirt over a cream tee, slate shorts, white socks and sneakers, crossbody bag. */
export function Avatar({ pose, speed }: AvatarProps) {
  const legL = useRef<THREE.Group>(null)
  const legR = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const phase = useRef(0)
  const shirt = useMemo(() => {
    const base = toonMaterial('#ffffff').clone()
    base.map = stripeTexture()
    return base
  }, [])

  useFrame((_, dt) => {
    const v = speed.current ?? 0
    if (pose === 'walk') {
      phase.current += dt * v * 6
      const s = Math.sin(phase.current) * Math.min(1, v * 1.2) * 0.6
      if (legL.current) legL.current.rotation.x = s
      if (legR.current) legR.current.rotation.x = -s
      if (armL.current) armL.current.rotation.x = -s * 0.7
      if (armR.current) armR.current.rotation.x = s * 0.7
    } else {
      phase.current += (dt * v) / 0.34 * 0.45
      const p = phase.current
      if (legL.current) legL.current.rotation.x = -1.1 + Math.sin(p) * 0.45
      if (legR.current) legR.current.rotation.x = -1.1 - Math.sin(p) * 0.45
      if (armL.current) armL.current.rotation.x = -0.95
      if (armR.current) armR.current.rotation.x = -0.95
    }
  })

  const hip = pose === 'ride' ? 1.04 : 0.88
  const lean = pose === 'ride' ? 0.3 : 0
  const z = pose === 'ride' ? -0.3 : 0

  return (
    <group position={[0, 0, z]}>
      <Leg side={-1} legRef={legL} hip={hip} />
      <Leg side={1} legRef={legR} hip={hip} />
      <group position={[0, hip, 0]} rotation={[lean, 0, 0]}>
        {/* open camp shirt over tee */}
        <Toon geometry={geo.box} color="#fff" material={shirt} position={[0, 0.32, 0]} scale={[0.44, 0.58, 0.25]} outline={0.024} />
        <Toon geometry={geo.box} color={TEE} position={[0, 0.34, 0.1]} scale={[0.15, 0.52, 0.06]} outline={0} />
        <Toon geometry={geo.box} color="#efe9dc" position={[-0.09, 0.58, 0.12]} rotation={[0, 0, -0.5]} scale={[0.1, 0.14, 0.03]} outline={0.01} />
        <Toon geometry={geo.box} color="#efe9dc" position={[0.09, 0.58, 0.12]} rotation={[0, 0, 0.5]} scale={[0.1, 0.14, 0.03]} outline={0.01} />
        {/* crossbody strap (right shoulder to left hip) + bag */}
        <Toon geometry={geo.box} color={BAG} position={[0, 0.34, 0.135]} rotation={[0, 0, -0.75]} scale={[0.04, 0.72, 0.02]} outline={0} />
        <Toon geometry={geo.box} color={BAG} position={[0, 0.34, -0.135]} rotation={[0, 0, 0.75]} scale={[0.04, 0.72, 0.02]} outline={0} />
        <Toon geometry={geo.sphere} color={BAG} position={[-0.26, 0.1, 0.04]} scale={[0.1, 0.2, 0.18]} outline={0.018} radial={false} />
        <Arm side={-1} armRef={armL} shirt={shirt} />
        <Arm side={1} armRef={armR} shirt={shirt} />
        <Toon geometry={geo.cyl} color={SKIN} position={[0, 0.66, 0]} scale={[0.1, 0.1, 0.1]} outline={0} />
        {/* head, hair, cap */}
        <Toon geometry={geo.sphere} color={SKIN} position={[0, 0.84, 0]} scale={[0.27, 0.3, 0.27]} outline={0.022} radial={false} />
        <Toon geometry={geo.sphere} color={HAIR} position={[0, 0.86, -0.04]} scale={[0.29, 0.28, 0.27]} outline={0.018} radial={false} />
        <Toon geometry={geo.box} color={HAIR} position={[0, 0.78, -0.1]} scale={[0.26, 0.12, 0.1]} outline={0} />
        <Toon geometry={geo.dome} color={CAP} position={[0, 0.9, 0]} scale={[0.31, 0.24, 0.31]} outline={0.018} radial={false} />
        <Toon geometry={brim} color={CAP} position={[0, 0.91, 0.1]} scale={[0.28, 0.025, 0.36]} outline={0.012} radial={false} />
        <Toon geometry={geo.box} color="#2c3437" position={[0, 0.98, -0.15]} scale={[0.08, 0.04, 0.02]} outline={0} />
      </group>
    </group>
  )
}
