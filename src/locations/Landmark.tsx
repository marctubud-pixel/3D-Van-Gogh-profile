import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { WorldLocation } from '../../shared/types'
import { playerUp } from '../world/occlusion'
import { BUILDING_SCALE, R, SERVICE_CENTER, surfaceQuaternion } from '../world/sphere'
import { locationAnchors, surf } from '../world/island'
import { Toon, geo, toonMaterial } from '../world/toon'
import { StrokeBuild } from '../world/strokes'
import { Arcade, Cinema, CreativeMuseum, ExperimentLab, Observatory, ServiceCenter, Studio, WriteHouse } from './buildings'

const CREAM = '#e1e1d9'
const WARM_GRAY = '#b8bdb5'
const WINDOW = '#2d383d'

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

function Door({ z, color }: { z: number; color: string }) {
  return (
    <>
      <Toon geometry={geo.box} color={WINDOW} position={[0, 0.8, z]} scale={[1.1, 1.6, 0.1]} outline={0.03} />
      <Toon geometry={geo.box} color={color} material={stripeMaterial(color)} position={[0, 1.95, z + 0.4]} rotation={[0.45, 0, 0]} scale={[2.2, 0.08, 0.9]} outline={0.03} />
    </>
  )
}

function BuildingBody({ loc }: { loc: WorldLocation }) {
  switch (loc.id) {
    case 'print-house':
      return <WriteHouse name={loc.name} />
    case 'brand-museum':
      return <CreativeMuseum name={loc.name} />
    case 'cinema':
      return <Cinema name={loc.name} />
    case 'experiment-lab':
      return <ExperimentLab name={loc.name} />
    case 'arcade':
      return <Arcade name={loc.name} />
    case 'my-studio':
      return <Studio name={loc.name} />
    case 'observatory':
      return <Observatory name={loc.name} />
    default:
      return (
        <group>
          <Toon geometry={geo.box} color={CREAM} position={[0, 2, 0]} scale={[4.5, 4, 4]} outline={0.08} />
          <Toon geometry={geo.box} color={loc.color} position={[0, 4.2, 0]} scale={[4.9, 0.4, 4.4]} outline={0.06} />
          <Door z={2.02} color={loc.color} />
          <Sign text={loc.name} color={loc.color} position={[0, 3.2, 2.1]} width={3.2} />
          <AcUnit position={[2.35, 1.6, 0.6]} rotation={[0, Math.PI / 2, 0]} />
          <Toon geometry={geo.cyl} color={WARM_GRAY} position={[-2.3, 2, 1.6]} scale={[0.14, 4, 0.14]} outline={0.02} />
        </group>
      )
  }
}

/** Roadside "P" sign that pulses when the rider is close enough to auto-park. */
function ParkingSpot({ color, up }: { color: string; up: THREE.Vector3 }) {
  const pTex = useMemo(() => signTexture('P', color), [color])
  const sign = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!sign.current) return
    const near = up.angleTo(playerUp) * R < 14
    sign.current.scale.setScalar(near ? 1.15 + Math.sin(clock.elapsedTime * 5) * 0.1 : 1)
  })
  return (
    <group>
      <Toon geometry={geo.cyl} color="#5a6670" position={[0, 1.3, 0]} scale={[0.1, 2.6, 0.1]} outline={0.02} />
      <group ref={sign} position={[0, 2.7, 0]}>
        <Toon geometry={geo.box} color={color} scale={[0.9, 0.9, 0.08]} outline={0.025} />
        <mesh position={[0, 0, 0.05]}>
          <planeGeometry args={[0.66, 0.66]} />
          <meshBasicMaterial map={pTex} />
        </mesh>
      </group>
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

const BEACON_HEIGHT: Record<string, number> = { observatory: 11, cinema: 10.5, arcade: 7.5, 'my-studio': 6.5 }

/** Landmarks already rebuilt from brush strokes. */
const STROKED = new Set(['print-house', 'brand-museum', 'cinema', 'arcade', 'experiment-lab', 'my-studio', 'observatory'])

interface LandmarkProps {
  loc: WorldLocation
  active: boolean
}

export function Landmark({ loc, active }: LandmarkProps) {
  const a = useMemo(() => locationAnchors(loc.lat, loc.lon), [loc.lat, loc.lon])
  const buildingQ = useMemo(() => surfaceQuaternion(a.building, a.facing), [a])
  const parkingQ = useMemo(() => surfaceQuaternion(a.parking, a.facing), [a])
  const bPos = surf(a.building)
  const pPos = useMemo(() => {
    const away = a.parking.clone().sub(a.door).projectOnPlane(a.parking).normalize()
    return surf(a.parking.clone().addScaledVector(away, 1.5 / R).normalize())
  }, [a])
  return (
    <>
      <group position={bPos} quaternion={buildingQ}>
        <group scale={BUILDING_SCALE}>
          {STROKED.has(loc.id) ? (
            <StrokeBuild seed={loc.id.length * 31}>
              <BuildingBody loc={loc} />
            </StrokeBuild>
          ) : (
            <BuildingBody loc={loc} />
          )}
        </group>
        <Beacon active={active} height={(BEACON_HEIGHT[loc.id] ?? 9) * BUILDING_SCALE} />
      </group>
      {loc.parking && (
        <group position={pPos} quaternion={parkingQ}>
          <ParkingSpot color="#4d6fa8" up={a.parking} />
        </group>
      )}
    </>
  )
}

/** Static welcome hall beside the central plaza. */
export function ServiceCenterSite() {
  const a = useMemo(() => locationAnchors(SERVICE_CENTER.lat, SERVICE_CENTER.lon), [])
  const q = useMemo(() => surfaceQuaternion(a.building, a.facing), [a])
  return (
    <group position={surf(a.building)} quaternion={q} scale={BUILDING_SCALE}>
      <StrokeBuild seed={11}>
        <ServiceCenter />
      </StrokeBuild>
    </group>
  )
}
