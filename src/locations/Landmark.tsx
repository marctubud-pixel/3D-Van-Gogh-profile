import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { WorldLocation } from '../../shared/types'
import { R, locationAnchors, surfaceQuaternion } from '../world/sphere'
import { Toon, geo } from '../world/toon'

const CREAM = '#eee4cf'
const WARM_GRAY = '#cfc6b4'
const WINDOW = '#44525e'
const ROOF_DARK = '#5a6670'

function signTexture(text: string, bg: string) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = bg
  g.fillRect(0, 0, 512, 128)
  g.strokeStyle = '#3b4348'
  g.lineWidth = 8
  g.strokeRect(6, 8, 500, 112)
  g.fillStyle = '#f4ecd9'
  let size = 64
  g.font = `bold ${size}px "Trebuchet MS", sans-serif`
  while (g.measureText(text).width > 460 && size > 20) {
    size -= 2
    g.font = `bold ${size}px "Trebuchet MS", sans-serif`
  }
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, 256, 68)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function Sign({ text, color, position, width = 4 }: { text: string; color: string; position: [number, number, number]; width?: number }) {
  const tex = useMemo(() => signTexture(text, color), [text, color])
  return (
    <group position={position}>
      <Toon geometry={geo.box} color="#3b4348" scale={[width + 0.12, width / 4 + 0.12, 0.1]} outline={0.03} />
      <mesh position={[0, 0, 0.06]}>
        <planeGeometry args={[width, width / 4]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  )
}

function Windows({ rows, cols, w, h, y0, z, dx, dy }: { rows: number; cols: number; w: number; h: number; y0: number; z: number; dx: number; dy: number }) {
  const items: [number, number][] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) items.push([(c - (cols - 1) / 2) * dx, y0 + r * dy])
  return (
    <>
      {items.map(([x, y], i) => (
        <Toon key={i} geometry={geo.box} color={WINDOW} position={[x, y, z]} scale={[w, h, 0.08]} outline={0.02} />
      ))}
    </>
  )
}

function Door({ z, color }: { z: number; color: string }) {
  return (
    <>
      <Toon geometry={geo.box} color={WINDOW} position={[0, 0.8, z]} scale={[1.1, 1.6, 0.1]} outline={0.03} />
      <Toon geometry={geo.box} color={color} position={[0, 1.95, z + 0.35]} rotation={[0.35, 0, 0]} scale={[1.8, 0.08, 0.8]} outline={0.03} />
    </>
  )
}

function Building({ loc }: { loc: WorldLocation }) {
  const c = loc.color
  switch (loc.id) {
    case 'print-house':
      return (
        <group>
          <Toon geometry={geo.box} color={CREAM} position={[0, 2, 0]} scale={[5, 4, 4]} outline={0.08} />
          <Toon geometry={geo.roof} color={c} position={[0, 5, 0]} rotation={[0, Math.PI / 4, 0]} scale={[5.2, 2, 4.4]} outline={0.08} />
          <Toon geometry={geo.box} color={WARM_GRAY} position={[1.6, 5.4, -0.6]} scale={[0.5, 1.6, 0.5]} outline={0.05} />
          <Windows rows={1} cols={2} w={0.9} h={0.9} y0={3} z={2.02} dx={3} dy={0} />
          <Door z={2.02} color={c} />
          <Sign text={loc.name} color={c} position={[0, 4.15, 2.1]} width={3.2} />
        </group>
      )
    case 'brand-museum':
      return (
        <group>
          <Toon geometry={geo.box} color={WARM_GRAY} position={[0, 0.25, 0]} scale={[7.4, 0.5, 5]} outline={0.06} />
          <Toon geometry={geo.box} color={CREAM} position={[0, 2.3, -0.4]} scale={[6.6, 3.6, 3.8]} outline={0.08} />
          {[-2.6, -1.3, 1.3, 2.6].map((x) => (
            <Toon key={x} geometry={geo.cyl} color={CREAM} position={[x, 2.3, 1.9]} scale={[0.45, 3.6, 0.45]} outline={0.05} />
          ))}
          <Toon geometry={geo.box} color={c} position={[0, 4.4, 0]} scale={[7.2, 0.6, 5]} outline={0.07} />
          <Door z={1.52} color={c} />
          <Sign text="BRAND & CREATIVE" color="#8a6d3b" position={[0, 5.2, 2.5]} width={4.4} />
        </group>
      )
    case 'cinema':
      return (
        <group>
          <Toon geometry={geo.box} color={CREAM} position={[0, 2.8, -0.5]} scale={[6, 5.6, 5]} outline={0.08} />
          <Toon geometry={geo.box} color={c} position={[0, 0.9, 2.2]} scale={[6.4, 0.25, 1.4]} outline={0.05} />
          <Toon geometry={geo.box} color={c} position={[0, 6.2, 1.6]} rotation={[-0.08, 0, 0]} scale={[1.2, 3.4, 0.4]} outline={0.05} />
          <Sign text="MARC CINEMA" color={c} position={[0, 4.2, 2.05]} width={5} />
          <Windows rows={1} cols={2} w={1.1} h={1.5} y0={2.2} z={2.02} dx={3.6} dy={0} />
          <Door z={2.02} color={c} />
          {[-2.2, 2.2].map((x) => (
            <Toon key={x} geometry={geo.box} color="#f1e3b5" position={[x, 1.6, 2.1]} scale={[0.9, 1.3, 0.1]} outline={0.03} />
          ))}
        </group>
      )
    case 'experiment-lab':
      return (
        <group>
          <Toon geometry={geo.box} color={CREAM} position={[0, 1.8, 0]} scale={[5.5, 3.6, 4.5]} outline={0.08} />
          <Toon geometry={geo.dome} color={c} position={[-0.8, 3.6, -0.3]} scale={[3.2, 2.6, 3.2]} outline={0.06} radial={false} />
          <Toon geometry={geo.cyl} color={ROOF_DARK} position={[1.8, 4.6, 0.8]} scale={[0.1, 2, 0.1]} outline={0.03} />
          <Toon geometry={geo.sphere} color="#e0a75a" position={[1.8, 5.7, 0.8]} scale={0.4} outline={0.03} radial={false} />
          <Windows rows={1} cols={3} w={0.8} h={0.8} y0={2.6} z={2.27} dx={1.6} dy={0} />
          <Door z={2.27} color={c} />
          <Sign text="EXPERIMENT LAB" color={c} position={[0, 3.3, 2.35]} width={3.6} />
        </group>
      )
    case 'arcade':
      return (
        <group>
          <Toon geometry={geo.box} color={c} position={[0, 2.2, 0]} scale={[5.4, 4.4, 4.2]} outline={0.08} />
          {[0, 1, 2].map((i) => (
            <Toon key={i} geometry={geo.box} color={['#d9b45a', '#c96f4a', '#6fb3ae'][i]} position={[0, 0.5 + i * 0.25, 2.12]} scale={[5.42, 0.18, 0.05]} outline={0} />
          ))}
          <Windows rows={1} cols={2} w={1.2} h={1.2} y0={2.6} z={2.12} dx={3.2} dy={0} />
          <Door z={2.12} color="#d9b45a" />
          <Sign text="ARCADE" color="#2f3e5c" position={[0, 5, 1.6]} width={4} />
        </group>
      )
    case 'my-studio':
      return (
        <group>
          <Toon geometry={geo.box} color={CREAM} position={[0, 1.6, 0]} scale={[4.4, 3.2, 3.8]} outline={0.08} />
          <Toon geometry={geo.box} color={c} position={[0, 3.35, 0]} rotation={[0, 0, 0.08]} scale={[4.9, 0.35, 4.3]} outline={0.06} />
          <Toon geometry={geo.box} color={WARM_GRAY} position={[-1.4, 4, -1]} scale={[0.5, 1.4, 0.5]} outline={0.05} />
          <Toon geometry={geo.box} color="#7a6553" position={[1.5, 1.1, 2.3]} scale={[0.9, 0.08, 0.5]} outline={0.02} />
          <Windows rows={1} cols={2} w={0.9} h={0.9} y0={2.2} z={1.92} dx={2.6} dy={0} />
          <Door z={1.92} color={c} />
          <Sign text="MY STUDIO" color={c} position={[0, 2.95, 1.98]} width={2.6} />
        </group>
      )
    case 'observatory':
      return (
        <group>
          <Toon geometry={geo.cone} color="#9bb07f" position={[0, -0.5, -3.5]} scale={[10, 2.6, 8]} outline={0.08} />
          <Toon geometry={geo.cyl} color={CREAM} position={[0, 2.4, 0]} scale={[4.6, 4.8, 4.6]} outline={0.08} />
          <Toon geometry={geo.dome} color={c} position={[0, 4.8, 0]} scale={[4.8, 4.2, 4.8]} outline={0.07} radial={false} />
          <Toon geometry={geo.box} color={ROOF_DARK} position={[0, 6.2, 0.9]} rotation={[-0.7, 0, 0]} scale={[0.7, 0.7, 2.4]} outline={0.04} />
          <Door z={2.3} color={c} />
          <Sign text="OBSERVATORY" color={c} position={[0, 3.6, 2.4]} width={3.2} />
        </group>
      )
    default:
      return (
        <group>
          <Toon geometry={geo.box} color={CREAM} position={[0, 2, 0]} scale={[4.5, 4, 4]} outline={0.08} />
          <Toon geometry={geo.box} color={c} position={[0, 4.2, 0]} scale={[4.9, 0.4, 4.4]} outline={0.06} />
          <Door z={2.02} color={c} />
          <Sign text={loc.name} color={c} position={[0, 3.2, 2.1]} width={3.2} />
        </group>
      )
  }
}

function ParkingSpot({ color }: { color: string }) {
  const pTex = useMemo(() => signTexture('P', color), [color])
  return (
    <group>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.6, 24]} />
        <meshBasicMaterial color="#d8cfb9" />
      </mesh>
      <Toon geometry={geo.cyl} color="#5a6670" position={[1.9, 1.1, 0]} scale={[0.08, 2.2, 0.08]} outline={0.02} />
      <Toon geometry={geo.box} color="#4d6fa8" position={[1.9, 2.2, 0]} scale={[0.7, 0.7, 0.06]} outline={0.02} />
      <mesh position={[1.9, 2.2, 0.04]}>
        <planeGeometry args={[0.5, 0.5]} />
        <meshBasicMaterial map={pTex} />
      </mesh>
      {[-0.6, 0, 0.6].map((x) => (
        <Toon key={x} geometry={geo.torusRack} color="#8e979b" position={[x, 0, -1.2]} outline={0.015} radial={false} />
      ))}
    </group>
  )
}

function Beacon({ active, height }: { active: boolean; height: number }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.position.y = height + Math.sin(clock.elapsedTime * 2) * 0.3
    ref.current.rotation.y = clock.elapsedTime
    const s = active ? 1.4 + Math.sin(clock.elapsedTime * 5) * 0.15 : 0.8
    ref.current.scale.setScalar(s)
  })
  return (
    <group ref={ref}>
      <Toon geometry={geo.octa} color={active ? '#f0b44c' : '#f1e3b5'} scale={[0.8, 1.2, 0.8]} outline={0.04} radial={false} />
    </group>
  )
}

interface LandmarkProps {
  loc: WorldLocation
  active: boolean
}

export function Landmark({ loc, active }: LandmarkProps) {
  const a = useMemo(() => locationAnchors(loc.lat, loc.lon), [loc.lat, loc.lon])
  const buildingQ = useMemo(() => surfaceQuaternion(a.building, a.facing), [a])
  const parkingQ = useMemo(() => surfaceQuaternion(a.parking, a.facing), [a])
  const bPos = a.building.clone().multiplyScalar(R)
  const pPos = a.parking.clone().multiplyScalar(R)
  return (
    <>
      <group position={bPos} quaternion={buildingQ}>
        <Building loc={loc} />
        <Beacon active={active} height={loc.id === 'observatory' ? 11 : 9} />
      </group>
      {loc.parking && (
        <group position={pPos} quaternion={parkingQ}>
          <ParkingSpot color="#4d6fa8" />
        </group>
      )}
    </>
  )
}
