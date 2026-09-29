import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { WorldLocation } from '../../shared/types'
import { R, dirFromLatLon, locationAnchors, surfaceQuaternion, tangentNorth } from './sphere'
import { LINE_COLOR, Toon, geo, outlineMaterial, toonMaterial } from './toon'

const GRASS = '#a9bf8e'
const GRASS_DARK = '#93ac7b'
const SAND = '#e8dcbc'
const SEA = '#6fb3c0'
const SEA_LAT = -38

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function PlanetBody() {
  const geometry = useMemo(() => {
    const g = new THREE.SphereGeometry(R, 128, 96)
    const pos = g.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const c = new THREE.Color()
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize()
      const lat = THREE.MathUtils.radToDeg(Math.asin(v.y))
      const patch = Math.sin(v.x * 9) * Math.sin(v.z * 7) * Math.sin(v.y * 5)
      if (lat < SEA_LAT) {
        c.set(SEA)
        v.multiplyScalar(R - 0.35)
        pos.setXYZ(i, v.x, v.y, v.z)
      } else if (lat < SEA_LAT + 4) c.set(SAND)
      else c.set(patch > 0.25 ? GRASS_DARK : GRASS)
      colors.set([c.r, c.g, c.b], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    g.computeVertexNormals()
    return g
  }, [])
  const mat = useMemo(() => {
    const m = toonMaterial('#ffffff').clone()
    m.vertexColors = true
    return m
  }, [])
  return (
    <>
      <mesh geometry={geometry} material={mat} receiveShadow />
      <mesh geometry={geometry} material={outlineMaterial(0.25, false)} />
    </>
  )
}

function Road({ rotation }: { rotation: [number, number, number] }) {
  return (
    <group rotation={rotation}>
      <mesh>
        <cylinderGeometry args={[R + 0.04, R + 0.04, 3.4, 160, 1, true]} />
        <meshToonMaterial color="#c9c0ad" side={THREE.DoubleSide} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, s * 1.72, 0]}>
          <cylinderGeometry args={[R + 0.06, R + 0.06, 0.08, 160, 1, true]} />
          <meshBasicMaterial color={LINE_COLOR} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

interface PropSpot {
  pos: THREE.Vector3
  q: THREE.Quaternion
  kind: 'tree' | 'pine' | 'bush' | 'rock'
  s: number
}

function useProps(locations: WorldLocation[]) {
  return useMemo(() => {
    const rand = mulberry32(7)
    const blockers = locations.flatMap((l) => {
      const a = locationAnchors(l.lat, l.lon)
      return [a.building, a.parking, a.door]
    })
    blockers.push(dirFromLatLon(0, 0))
    const spots: PropSpot[] = []
    let guard = 0
    while (spots.length < 220 && guard++ < 5000) {
      const d = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize()
      const lat = THREE.MathUtils.radToDeg(Math.asin(d.y))
      if (lat < SEA_LAT + 1) continue
      if (Math.abs(d.y) * R < 3.2) continue
      if (Math.abs(d.x) * R < 3.2) continue
      if (blockers.some((b) => b.angleTo(d) * R < 7)) continue
      const beach = lat < SEA_LAT + 5
      const kind: PropSpot['kind'] = beach ? 'rock' : lat > 40 ? (rand() > 0.3 ? 'pine' : 'rock') : rand() > 0.55 ? 'tree' : rand() > 0.4 ? 'bush' : 'pine'
      const yaw = rand() * Math.PI * 2
      const fwd = tangentNorth(d).applyAxisAngle(d, yaw)
      spots.push({ pos: d.clone().multiplyScalar(R), q: surfaceQuaternion(d, fwd), kind, s: 0.7 + rand() * 0.7 })
    }
    return spots
  }, [locations])
}

function PropMesh({ kind }: { kind: PropSpot['kind'] }) {
  switch (kind) {
    case 'tree':
      return (
        <>
          <Toon geometry={geo.cyl} color="#8a6f58" position={[0, 0.8, 0]} scale={[0.3, 1.6, 0.3]} outline={0.03} />
          <Toon geometry={geo.ico} color="#7fa074" position={[0, 2.2, 0]} scale={[2, 1.7, 2]} outline={0.06} radial={false} />
          <Toon geometry={geo.ico} color="#8fb07f" position={[0.5, 2.8, 0.2]} scale={[1.2, 1, 1.2]} outline={0.05} radial={false} />
        </>
      )
    case 'pine':
      return (
        <>
          <Toon geometry={geo.cyl} color="#7a624f" position={[0, 0.5, 0]} scale={[0.25, 1, 0.25]} outline={0.03} />
          <Toon geometry={geo.cone} color="#5f8a70" position={[0, 2, 0]} scale={[1.6, 2.8, 1.6]} outline={0.05} />
        </>
      )
    case 'bush':
      return <Toon geometry={geo.ico} color="#88a877" position={[0, 0.35, 0]} scale={[1.2, 0.8, 1.1]} outline={0.04} radial={false} />
    case 'rock':
      return <Toon geometry={geo.ico} color="#a8a79c" position={[0, 0.2, 0]} scale={[1.3, 0.8, 1]} outline={0.05} radial={false} />
  }
}

function Plaza() {
  const up = dirFromLatLon(0, 0)
  const q = surfaceQuaternion(up, new THREE.Vector3(0, 1, 0))
  return (
    <group position={up.clone().multiplyScalar(R)} quaternion={q}>
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[5.5, 40]} />
        <meshToonMaterial color="#e2d8c0" />
      </mesh>
      <Toon geometry={geo.cyl} color="#d8cdb4" position={[-7, 0.4, 0]} scale={[2.4, 0.8, 2.4]} outline={0.05} />
      <Toon geometry={geo.cyl} color={SEA} position={[-7, 0.82, 0]} scale={[2, 0.05, 2]} outline={0} />
      <Toon geometry={geo.cyl} color="#d8cdb4" position={[-7, 1.4, 0]} scale={[0.3, 1.6, 0.3]} outline={0.03} />
      <group position={[5.5, 0, 3.5]}>
        <Toon geometry={geo.cyl} color="#5a6670" position={[0, 1.4, 0]} scale={[0.12, 2.8, 0.12]} outline={0.02} />
        {[
          ['MAIN TOWN', 0.4, '#c96f4a'],
          ['FUTURE HILL', -1.2, '#6f8fb8'],
          ['INTEREST', 2.2, '#8a9a5b'],
        ].map(([label, yaw, color], i) => (
          <group key={label as string} position={[0, 2.6 - i * 0.45, 0]} rotation={[0, yaw as number, 0]}>
            <Toon geometry={geo.box} color={color as string} position={[0.55, 0, 0]} scale={[1.2, 0.32, 0.06]} outline={0.02} />
          </group>
        ))}
      </group>
    </group>
  )
}

function Clouds() {
  const ref = useRef<THREE.Group>(null)
  const clouds = useMemo(() => {
    const rand = mulberry32(3)
    return Array.from({ length: 14 }, () => {
      const d = new THREE.Vector3(rand() * 2 - 1, rand() * 1.4 - 0.2, rand() * 2 - 1).normalize()
      return { pos: d.multiplyScalar(R + 16 + rand() * 8), s: 2 + rand() * 3 }
    })
  }, [])
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.01
  })
  return (
    <group ref={ref}>
      {clouds.map((c, i) => (
        <group key={i} position={c.pos} scale={c.s}>
          <Toon geometry={geo.ico} color="#f7f2e6" scale={[2.2, 0.9, 1.4]} outline={0.04} radial={false} />
          <Toon geometry={geo.ico} color="#f7f2e6" position={[0.7, 0.35, 0]} scale={[1.3, 0.9, 1.1]} outline={0.04} radial={false} />
        </group>
      ))}
    </group>
  )
}

export function Planet({ locations }: { locations: WorldLocation[] }) {
  const props = useProps(locations)
  return (
    <group>
      <PlanetBody />
      <Road rotation={[0, 0, 0]} />
      <Road rotation={[0, 0, Math.PI / 2]} />
      <Plaza />
      {props.map((p, i) => (
        <group key={i} position={p.pos} quaternion={p.q} scale={p.s}>
          <PropMesh kind={p.kind} />
        </group>
      ))}
      <Clouds />
    </group>
  )
}
