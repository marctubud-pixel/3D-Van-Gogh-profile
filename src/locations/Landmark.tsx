import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { WorldLocation } from '../../shared/types'
import { playerPos } from '../world/occlusion'
import { BUILDING_SCALE, LANDMARK_FIT, UP, flatDistance, landmarkSetback, yawQuaternion } from '../world/plane'
import { PLAZA, SERVICE_FACING, SERVICE_POINT, SPOKES, locationAnchors, locationPoint, nearestOnRoute, routeFrame, routePoint, surf } from '../world/island'
import { Toon, geo, toonMaterial } from '../world/toon'
import { type Stroke, StrokeBuild, StrokePaint, column, dab, painted, rampFor } from '../world/strokes'
import { Decal, textTex } from './parts'
import { Forecourt } from './Forecourt'
import { Signpost } from './Signpost'
import { Arcade, Cinema, CivicPlaza, CreativeMuseum, ExperimentLab, Observatory, ServiceCenter, Studio, WriteHouse } from './buildings'

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
      <Toon geometry={geo.cyl} color="#7f8b8f" position={[-0.15, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]} scale={[0.45, 0.04, 0.45]} outline={0} />
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

const signPostStrokes = () =>
  painted('parking-post', (r) => {
    const out: Stroke[] = []
    column(out, r, new THREE.Vector3(0, 0, 0), 2.75, 0.06, rampFor('#5a6670'), 60)
    return out
  })

/** Round sign plate painted from short dabs on both faces, with a darker rim stroked around the edge. */
function plateStrokes(color: string) {
  return painted(`parking-disc:${color}`, (r) => {
    const ramp = rampFor(color)
    const pickC = (list: string[]) => list[Math.floor(r() * list.length)]
    const out: Stroke[] = []
    const R = 0.44
    for (const z of [0.03, -0.03]) {
      for (let y = -0.38; y <= 0.39; y += 0.09) {
        for (let x = -0.38; x <= 0.39; x += 0.16) {
          if (Math.hypot(x, y) > R - 0.08) continue
          const s = dab(x + (r() - 0.5) * 0.04, y + (r() - 0.5) * 0.02, z, (r() - 0.5) * 0.15, 0.22 + r() * 0.06, 0.11, pickC(r() < 0.3 ? ramp.light : ramp.mid))
          if (z < 0) s.n = s.n.clone().negate()
          out.push(s)
        }
      }
      for (let k = 0; k < 18; k++) {
        const a = (k / 18) * Math.PI * 2
        const s = dab(Math.cos(a) * R, Math.sin(a) * R, z * 1.2, a + Math.PI / 2 + (r() - 0.5) * 0.1, 0.2, 0.07, pickC(ramp.dark))
        if (z < 0) s.n = s.n.clone().negate()
        out.push(s)
      }
    }
    return out
  })
}

/** Roadside "P" sign that pulses when the rider is close enough to auto-park. */
function ParkingSpot({ color, up }: { color: string; up: THREE.Vector3 }) {
  const pTex = useMemo(() => textTex(['P'], 96, 96, { fg: '#f4f1e6', weight: 900 }), [])
  const plate = useMemo(() => plateStrokes(color), [color])
  const sign = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!sign.current) return
    const near = flatDistance(up, playerPos) < 14
    sign.current.scale.setScalar(near ? 1.15 + Math.sin(clock.elapsedTime * 5) * 0.1 : 1)
  })
  return (
    <group>
      <StrokeBuild seed={5}>
        <StrokePaint strokes={signPostStrokes()} />
      </StrokeBuild>
      <group ref={sign} position={[0, 2.7, 0]}>
        <StrokeBuild seed={9}>
          <StrokePaint strokes={plate} />
          <Decal tex={pTex} p={[0, 0, 0.01]} w={0.62} h={0.62} />
        </StrokeBuild>
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

/** Height of the model-space floor slab; models are sunk by it so floors sit flush with the road. */
const PLINTH = 0.12

const BEACON_HEIGHT: Record<string, number> = { observatory: 11, cinema: 10.5, arcade: 7.5, 'my-studio': 6.5 }

/** Landmarks already rebuilt from brush strokes. */
const STROKED = new Set(['print-house', 'brand-museum', 'cinema', 'arcade', 'experiment-lab', 'my-studio', 'observatory'])

interface LandmarkProps {
  loc: WorldLocation
  active: boolean
  /** Name of the next stop along the loop, shown on the roadside fingerpost. */
  next?: string
}

export function Landmark({ loc, active, next }: LandmarkProps) {
  const a = useMemo(() => locationAnchors(locationPoint(loc), loc.id), [loc])
  const fit = LANDMARK_FIT[loc.id]?.scale ?? 1
  const buildingQ = useMemo(() => yawQuaternion(a.facing), [a])
  const parkingQ = useMemo(() => yawQuaternion(a.facing), [a])
  const bPos = useMemo(() => surf(a.building), [a])
  // the sign stands off the building's flank on the parking side, so it never covers the facade
  const pPos = useMemo(() => {
    const across = new THREE.Vector3().crossVectors(UP, a.facing).normalize()
    const side = Math.sign(a.parking.clone().sub(a.door).dot(across)) || 1
    const half = (LANDMARK_FIT[loc.id]?.halfWidth ?? 4.2) * BUILDING_SCALE * fit
    const front = flatDistance(a.door, a.building) - 0.8
    return surf(a.building.clone().addScaledVector(across, side * (half + 1.8)).addScaledVector(a.facing, front))
  }, [a, loc.id, fit])
  return (
    <>
      <group position={bPos} quaternion={buildingQ}>
        <group position={[0, -PLINTH * BUILDING_SCALE * fit, -landmarkSetback(loc.id)]} scale={BUILDING_SCALE * fit}>
          {STROKED.has(loc.id) ? (
            <StrokeBuild seed={loc.id.length * 31}>
              <BuildingBody loc={loc} />
            </StrokeBuild>
          ) : (
            <BuildingBody loc={loc} />
          )}
        </group>
        <Beacon active={active} height={(BEACON_HEIGHT[loc.id] ?? 9) * BUILDING_SCALE * fit} />
      </group>
      {STROKED.has(loc.id) && <Forecourt id={loc.id} a={a} />}
      {next && <NextSign building={a.building} label={next} />}
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
  const q = useMemo(() => yawQuaternion(SERVICE_FACING), [])
  return (
    <group position={surf(SERVICE_POINT).add(new THREE.Vector3(0, -PLINTH * BUILDING_SCALE, 0))} quaternion={q} scale={BUILDING_SCALE}>
      <StrokeBuild seed={11}>
        <ServiceCenter />
      </StrokeBuild>
    </group>
  )
}

/** Roadside fingerpost just past a landmark, pointing on along the loop to the next stop. */
function NextSign({ building, label }: { building: THREE.Vector3; label: string }) {
  const at = useMemo(() => {
    const hit = nearestOnRoute(building)
    const s = hit.s + 8
    return { pos: surf(routePoint(s, hit.sign * 4.6)), arms: [{ dir: routeFrame(s).tan, label: `NEXT · ${label}` }] }
  }, [building, label])
  return (
    <group position={at.pos}>
      <Signpost arms={at.arms} />
    </group>
  )
}

/** Central round plaza with its fountain and a fingerpost naming every avenue. */
export function CivicPlazaSite() {
  const sign = useMemo(() => {
    const dir = SPOKES[0].a.clone().sub(PLAZA).setY(0).normalize()
    const side = new THREE.Vector3().crossVectors(UP, dir)
    return {
      pos: surf(PLAZA.clone().addScaledVector(dir, 5).addScaledVector(side, 2.2)),
      arms: SPOKES.map((k, i) => ({ dir: k.b.clone().sub(k.a).setY(0).normalize(), label: i === 0 ? `01 ${k.label}` : k.label })),
    }
  }, [])
  return (
    <>
      <group position={surf(PLAZA)} scale={BUILDING_SCALE}>
        <StrokeBuild seed={12}>
          <CivicPlaza />
        </StrokeBuild>
      </group>
      <group position={sign.pos}>
        <Signpost arms={sign.arms} />
      </group>
    </>
  )
}
