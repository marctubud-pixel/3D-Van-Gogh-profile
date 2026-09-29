import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { WorldLocation } from '../../shared/types'
import { R, locationAnchors, surfaceQuaternion } from '../world/sphere'
import { Toon, geo, toonMaterial } from '../world/toon'

const CREAM = '#e1e1d9'
const WARM_GRAY = '#b8bdb5'
const WINDOW = '#2d383d'
const ROOF_DARK = '#59656b'
const METAL_LIGHT = '#c9ccc8'

const stripeCache = new Map<string, THREE.MeshToonMaterial>()
export function stripeMaterial(color: string) {
  let m = stripeCache.get(color)
  if (!m) {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 8
    const g = c.getContext('2d')!
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#f3f4ee' : color
      g.fillRect(i * 16, 0, 16, 8)
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    m = toonMaterial('#ffffff').clone()
    m.map = t
    stripeCache.set(color, m)
  }
  return m
}

/** Wall-mounted air-conditioner unit, a recurring street detail. */
export function AcUnit({ position, rotation }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      <Toon geometry={geo.box} color="#eef0ea" scale={[1, 0.7, 0.4]} outline={0.03} />
      <Toon geometry={geo.cyl} color="#3a4549" position={[-0.15, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]} scale={[0.45, 0.04, 0.45]} outline={0} />
    </group>
  )
}

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
      <Toon geometry={geo.box} color={color} material={stripeMaterial(color)} position={[0, 1.95, z + 0.4]} rotation={[0.45, 0, 0]} scale={[2.2, 0.08, 0.9]} outline={0.03} />
    </>
  )
}

function Building({ loc }: { loc: WorldLocation }) {
  return (
    <group>
      <BuildingBody loc={loc} />
      <AcUnit position={[2.35, 1.6, 0.6]} rotation={[0, Math.PI / 2, 0]} />
      <Toon geometry={geo.cyl} color={WARM_GRAY} position={[-2.3, 2, 1.6]} scale={[0.14, 4, 0.14]} outline={0.02} />
    </group>
  )
}

const cinemaWallGeo = (() => {
  const sh = new THREE.Shape()
  sh.moveTo(-3.5, 0)
  sh.lineTo(3.5, 0)
  sh.lineTo(3.5, 7.4)
  sh.lineTo(-3.5, 6.4)
  sh.closePath()
  const g = new THREE.ExtrudeGeometry(sh, { depth: 5, bevelEnabled: false })
  g.translate(0, 0, -2.5)
  return g
})()

function paintedLettersTexture(text: string, color: string) {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 160
  const g = c.getContext('2d')!
  let size = 120
  g.font = `900 ${size}px "Trebuchet MS", "Arial Black", sans-serif`
  while (g.measureText(text).width > 980 && size > 40) {
    size -= 4
    g.font = `900 ${size}px "Trebuchet MS", "Arial Black", sans-serif`
  }
  g.fillStyle = color
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, 512, 86)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function posterTexture(seed: number) {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 192
  const g = c.getContext('2d')!
  g.fillStyle = '#f1ece0'
  g.fillRect(0, 0, 128, 192)
  g.fillStyle = seed ? '#e8826a' : '#e8826a'
  g.beginPath()
  g.arc(seed ? 96 : 50, seed ? 130 : 70, 38, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#3f8f8a'
  g.beginPath()
  g.moveTo(0, 192)
  g.quadraticCurveTo(40, seed ? 70 : 100, 90, 130)
  g.lineTo(128, 192)
  g.fill()
  g.fillStyle = '#9cc9a6'
  g.fillRect(seed ? 0 : 70, 150, 60, 42)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** MARC CINEMA: cream facade with sloped roofline, painted lettering, teal canopy over glass doors, poster annex. */
function Cinema({ name }: { name: string }) {
  const letters = useMemo(() => paintedLettersTexture(name, '#d9705a'), [name])
  const posters = useMemo(() => [posterTexture(0), posterTexture(1)], [])
  const TEAL = '#5f9ea0'
  const BASE = '#b9c6bf'
  const ANNEX = '#d5dcd3'
  const f = 2.53
  return (
    <group>
      <Toon geometry={cinemaWallGeo} color="#f1ecd9" outline={0.07} edges />
      <Toon geometry={geo.box} color={TEAL} position={[0, 6.95, 0]} rotation={[0, 0, Math.atan2(1, 7)]} scale={[7.3, 0.22, 5.3]} outline={0.04} />
      <Toon geometry={geo.box} color={BASE} position={[0, 0.25, 0]} scale={[7.1, 0.5, 5.1]} outline={0.03} />
      <Toon geometry={geo.box} color={BASE} position={[-3.3, 3.2, f - 0.1]} scale={[0.4, 6.4, 0.3]} outline={0.02} />
      {/* upper windows */}
      {[
        [-1.2, 5.3, 2.6],
        [1.9, 5.5, 1.4],
      ].map(([x, y, w]) => (
        <group key={x} position={[x, y, f]}>
          <Toon geometry={geo.box} color="#9aa7a3" scale={[w + 0.2, 1.3, 0.06]} outline={0} />
          <Toon geometry={geo.box} color={WINDOW} position={[0, 0, 0.04]} scale={[w, 1.1, 0.04]} outline={0} edges={false} />
          <Toon geometry={geo.box} color="#9aa7a3" position={[0, -0.7, 0.1]} scale={[w + 0.4, 0.12, 0.25]} outline={0.015} />
        </group>
      ))}
      <mesh position={[0.2, 3.8, f + 0.01]}>
        <planeGeometry args={[6.4, 1]} />
        <meshBasicMaterial map={letters} transparent />
      </mesh>
      {/* canopy over glass double doors */}
      <Toon geometry={geo.box} color={TEAL} position={[1, 2.75, f + 0.7]} scale={[4.4, 0.3, 1.5]} outline={0.03} />
      <Toon geometry={geo.box} color={BASE} position={[1, 1.3, f + 0.02]} scale={[3.8, 2.6, 0.08]} outline={0} />
      {[-0.1, 1.05].map((x) => (
        <Toon key={x} geometry={geo.box} color={WINDOW} position={[x + 0.5, 1.2, f + 0.08]} scale={[1.05, 2.2, 0.04]} outline={0} edges={false} />
      ))}
      {[0.85, 1.15].map((x) => (
        <Toon key={x} geometry={geo.box} color={METAL_LIGHT} position={[x, 1.2, f + 0.12]} scale={[0.05, 0.5, 0.05]} outline={0} />
      ))}
      {/* poster annex */}
      <Toon geometry={geo.box} color={ANNEX} position={[-2.2, 1.35, f + 0.4]} scale={[2.6, 2.7, 0.8]} outline={0.04} />
      <Toon geometry={geo.box} color={TEAL} position={[-2.2, 2.75, f + 0.4]} scale={[2.8, 0.12, 0.95]} outline={0.02} />
      {posters.map((t, i) => (
        <group key={i} position={[-2.8 + i * 1.2, 1.4, f + 0.81]}>
          <Toon geometry={geo.box} color="#46525a" scale={[0.9, 1.35, 0.04]} outline={0} />
          <mesh position={[0, 0, 0.03]}>
            <planeGeometry args={[0.75, 1.2]} />
            <meshBasicMaterial map={t} />
          </mesh>
        </group>
      ))}
      {/* drainpipe + meter box */}
      <Toon geometry={geo.cyl} color="#8fa3a0" position={[3.35, 3.5, f]} scale={[0.14, 7, 0.14]} outline={0.015} />
      <Toon geometry={geo.cyl} color="#8f9893" position={[3.1, 0.55, f + 0.4]} scale={[0.06, 1.1, 0.06]} outline={0} />
      <Toon geometry={geo.box} color="#e1e1d9" position={[3.1, 1.2, f + 0.42]} scale={[0.45, 0.4, 0.2]} outline={0.015} />
    </group>
  )
}

function BuildingBody({ loc }: { loc: WorldLocation }) {
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
      return <Cinema name={loc.name} />
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
        <meshBasicMaterial color="#8499a0" />
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
