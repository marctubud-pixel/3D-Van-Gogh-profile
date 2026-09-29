import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { Toon, geo, toonMaterial } from '../world/toon'

const SKIN = '#e3c3a4'
const CAP = '#6d8196'
const SHORTS = '#6f8199'
const OFFWHITE = '#efe6d3'
const BAG = '#40464b'

function stripeTexture() {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 8
  const g = c.getContext('2d')!
  const colors = ['#3c4d6b', '#7d97b5', '#efe6d3', '#7d97b5']
  colors.forEach((col, i) => {
    g.fillStyle = col
    g.fillRect(i * 16, 0, 16, 8)
  })
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  tex.repeat.set(2, 1)
  tex.magFilter = THREE.NearestFilter
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

interface AvatarProps {
  pose: 'ride' | 'walk'
  speed: RefObject<number>
}

/** Stylized Creator Avatar: blue-gray cap, wide-stripe overshirt, off-white tee, slate shorts, crossbody bag. */
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
      const s = Math.sin(phase.current) * Math.min(1, v * 1.2) * 0.7
      if (legL.current) legL.current.rotation.x = s
      if (legR.current) legR.current.rotation.x = -s
      if (armL.current) armL.current.rotation.x = -s * 0.8
      if (armR.current) armR.current.rotation.x = s * 0.8
    } else {
      phase.current += (dt * v) / 0.34 * 0.45
      const p = phase.current
      if (legL.current) legL.current.rotation.x = -1.1 + Math.sin(p) * 0.45
      if (legR.current) legR.current.rotation.x = -1.1 - Math.sin(p) * 0.45
      if (armL.current) armL.current.rotation.x = -1.0
      if (armR.current) armR.current.rotation.x = -1.0
    }
  })

  const hip = pose === 'ride' ? 1.04 : 0.86
  const lean = pose === 'ride' ? 0.35 : 0
  const z = pose === 'ride' ? -0.3 : 0

  return (
    <group position={[0, 0, z]}>
      <group ref={legL} position={[-0.1, hip, 0]}>
        <Toon geometry={geo.box} color={SHORTS} position={[0, -0.16, 0]} scale={[0.15, 0.32, 0.17]} outline={0.02} />
        <Toon geometry={geo.box} color={SKIN} position={[0, -0.5, 0]} scale={[0.1, 0.4, 0.11]} outline={0.018} />
        <Toon geometry={geo.box} color={OFFWHITE} position={[0, -0.78, 0.05]} scale={[0.12, 0.12, 0.24]} outline={0.02} />
      </group>
      <group ref={legR} position={[0.1, hip, 0]}>
        <Toon geometry={geo.box} color={SHORTS} position={[0, -0.16, 0]} scale={[0.15, 0.32, 0.17]} outline={0.02} />
        <Toon geometry={geo.box} color={SKIN} position={[0, -0.5, 0]} scale={[0.1, 0.4, 0.11]} outline={0.018} />
        <Toon geometry={geo.box} color={OFFWHITE} position={[0, -0.78, 0.05]} scale={[0.12, 0.12, 0.24]} outline={0.02} />
      </group>
      <group position={[0, hip, 0]} rotation={[lean, 0, 0]}>
        <Toon geometry={geo.box} color={OFFWHITE} position={[0, 0.3, 0]} scale={[0.43, 0.59, 0.25]} outline={0.025} material={shirt} />
        <Toon geometry={geo.box} color={OFFWHITE} position={[0, 0.48, 0.1]} scale={[0.16, 0.18, 0.06]} outline={0} />
        {/* crossbody strap + bag */}
        <Toon geometry={geo.box} color={BAG} position={[0, 0.32, 0]} rotation={[0, 0, 0.8]} scale={[0.05, 0.72, 0.27]} outline={0} />
        <Toon geometry={geo.box} color={BAG} position={[0.18, 0.08, -0.14]} scale={[0.22, 0.16, 0.08]} outline={0.02} />
        <group ref={armL} position={[-0.27, 0.54, 0]}>
          <Toon geometry={geo.box} color="#3c4d6b" position={[0, -0.1, 0]} scale={[0.14, 0.2, 0.15]} outline={0.018} />
          <Toon geometry={geo.box} color={SKIN} position={[0, -0.36, 0]} scale={[0.09, 0.36, 0.1]} outline={0.016} />
        </group>
        <group ref={armR} position={[0.27, 0.54, 0]}>
          <Toon geometry={geo.box} color="#3c4d6b" position={[0, -0.1, 0]} scale={[0.14, 0.2, 0.15]} outline={0.018} />
          <Toon geometry={geo.box} color={SKIN} position={[0, -0.36, 0]} scale={[0.09, 0.36, 0.1]} outline={0.016} />
        </group>
        <Toon geometry={geo.cyl} color={SKIN} position={[0, 0.64, 0]} scale={[0.1, 0.1, 0.1]} outline={0} />
        <Toon geometry={geo.box} color={SKIN} position={[0, 0.82, 0]} scale={[0.26, 0.28, 0.26]} outline={0.025} />
        <Toon geometry={geo.box} color="#4a3f38" position={[0, 0.84, -0.05]} scale={[0.27, 0.2, 0.2]} outline={0} />
        <Toon geometry={geo.dome} color={CAP} position={[0, 0.94, 0]} scale={[0.3, 0.2, 0.3]} outline={0.02} radial={false} />
        <Toon geometry={geo.box} color={CAP} position={[0, 0.95, 0.19]} scale={[0.24, 0.025, 0.16]} outline={0.015} />
      </group>
    </group>
  )
}
