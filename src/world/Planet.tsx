import { useMemo } from 'react'
import * as THREE from 'three'
import type { WorldLocation } from '../../shared/types'
import { R, dirFromLatLon, locationAnchors, surfaceQuaternion, tangentNorth } from './sphere'
import { LINE_COLOR, Toon, geo, outlineMaterial, toonMaterial } from './toon'

const GRASS = '#72b07e'
const GRASS_DARK = '#5e9d6d'
const SAND = '#e3d8b8'
const SEA = '#4f9fae'
const ASPHALT = '#6f848b'
const SIDEWALK = '#d5dad1'
const PAINT = '#eef1ea'
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

function dashTexture() {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 8
  const g = c.getContext('2d')!
  g.fillStyle = PAINT
  g.fillRect(0, 0, 36, 8)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.repeat.set(90, 1)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** A band on the sphere surface around the equator of the rotated frame. */
function Band({ width, lift, color, map, basic }: { width: number; lift: number; color: string; map?: THREE.Texture; basic?: boolean }) {
  const r = R + lift
  const half = width / 2 / r
  return (
    <mesh receiveShadow>
      <sphereGeometry args={[r, 220, 1, 0, Math.PI * 2, Math.PI / 2 - half, half * 2]} />
      {basic ? (
        <meshBasicMaterial color={color} map={map} transparent={!!map} alphaTest={map ? 0.5 : 0} />
      ) : (
        <meshToonMaterial color={color} gradientMap={toonMaterial('#fff').gradientMap} />
      )}
    </mesh>
  )
}

function Road({ rotation }: { rotation: [number, number, number] }) {
  const dash = useMemo(() => dashTexture(), [])
  return (
    <group rotation={rotation}>
      <Band width={6.4} lift={0.03} color={SIDEWALK} />
      {[-1, 1].map((s) => (
        <group key={s} rotation={[0, 0, 0]}>
          <mesh rotation={[0, 0, 0]} position={[0, 0, 0]}>
            <sphereGeometry args={[R + 0.035, 220, 1, 0, Math.PI * 2, Math.PI / 2 + s * (3.2 / R) - 0.03 / R, 0.06 / R]} />
            <meshBasicMaterial color={LINE_COLOR} />
          </mesh>
        </group>
      ))}
      <Band width={3.8} lift={0.05} color={ASPHALT} />
      {[-1, 1].map((s) => (
        <mesh key={s}>
          <sphereGeometry args={[R + 0.06, 220, 1, 0, Math.PI * 2, Math.PI / 2 + s * (1.6 / R) - 0.06 / R, 0.12 / R]} />
          <meshBasicMaterial color={PAINT} />
        </mesh>
      ))}
      <Band width={0.14} lift={0.065} color="#ffffff" map={dash} basic />
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
      if (Math.abs(d.y) * R < 4.2) continue
      if (Math.abs(d.x) * R < 4.2) continue
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
          <Toon geometry={geo.cyl} color="#6e6660" position={[0, 0.8, 0]} scale={[0.3, 1.6, 0.3]} outline={0.03} />
          <Toon geometry={geo.ico} color="#4f8f5f" position={[0, 2.2, 0]} scale={[2, 1.7, 2]} outline={0.06} radial={false} />
          <Toon geometry={geo.ico} color="#62a06c" position={[0.5, 2.8, 0.2]} scale={[1.2, 1, 1.2]} outline={0.05} radial={false} />
        </>
      )
    case 'pine':
      return (
        <>
          <Toon geometry={geo.cyl} color="#6e6660" position={[0, 0.5, 0]} scale={[0.25, 1, 0.25]} outline={0.03} />
          <Toon geometry={geo.cone} color="#3f7a5a" position={[0, 2, 0]} scale={[1.6, 2.8, 1.6]} outline={0.05} />
        </>
      )
    case 'bush':
      return <Toon geometry={geo.ico} color="#4f8f5f" position={[0, 0.35, 0]} scale={[1.2, 0.8, 1.1]} outline={0.04} radial={false} />
    case 'rock':
      return <Toon geometry={geo.ico} color="#d9cfb2" position={[0, 0.2, 0]} scale={[1.3, 0.8, 1]} outline={0.05} radial={false} />
  }
}

function checkerTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 264
  const g = c.getContext('2d')!
  for (let y = 0; y < 12; y++)
    for (let x = 0; x < 12; x++) {
      g.fillStyle = (x + y) % 2 ? '#e4e7df' : '#d3d8ce'
      g.fillRect(x * 22, y * 22, 22, 22)
    }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function Plaza() {
  const checker = useMemo(() => checkerTexture(), [])
  const up = dirFromLatLon(0, 0)
  const q = surfaceQuaternion(up, new THREE.Vector3(0, 1, 0))
  return (
    <group position={up.clone().multiplyScalar(R)} quaternion={q}>
      <mesh position={[0, 0.09, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[5.6, 48]} />
        <meshToonMaterial map={checker} gradientMap={toonMaterial('#fff').gradientMap} />
      </mesh>
      <mesh position={[0, 0.085, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[5.6, 5.7, 48]} />
        <meshBasicMaterial color={LINE_COLOR} />
      </mesh>
      <Toon geometry={geo.cyl} color="#d8cdb4" position={[-3.9, 0.4, 3.9]} scale={[2.4, 0.8, 2.4]} outline={0.05} />
      <Toon geometry={geo.cyl} color={SEA} position={[-3.9, 0.82, 3.9]} scale={[2, 0.05, 2]} outline={0} />
      <Toon geometry={geo.cyl} color="#d8cdb4" position={[-3.9, 1.4, 3.9]} scale={[0.3, 1.6, 0.3]} outline={0.03} />
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

/** Dark brush-stroke grass tufts scattered over the meadows. */
function GrassTufts({ locations }: { locations: WorldLocation[] }) {
  const mesh = useMemo(() => {
    const blade = new THREE.ConeGeometry(0.05, 0.5, 3)
    blade.translate(0, 0.25, 0)
    const parts: THREE.BufferGeometry[] = []
    ;[-0.25, 0, 0.22].forEach((tilt, i) => {
      const b = blade.clone()
      b.scale(1, 0.7 + i * 0.25, 1)
      b.rotateZ(tilt)
      b.translate(i * 0.08 - 0.08, 0, 0)
      parts.push(b)
    })
    const merged = mergeTuft(parts)
    const count = 1400
    const m = new THREE.InstancedMesh(merged, new THREE.MeshBasicMaterial({ color: '#3f7a55' }), count)
    const rand = mulberry32(21)
    const blockers = locations.map((l) => locationAnchors(l.lat, l.lon).building)
    const mat = new THREE.Matrix4()
    let n = 0
    let guard = 0
    while (n < count && guard++ < 20000) {
      const d = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize()
      const lat = THREE.MathUtils.radToDeg(Math.asin(d.y))
      if (lat < SEA_LAT + 4) continue
      if (Math.abs(d.y) * R < 3.6 || Math.abs(d.x) * R < 3.6) continue
      if (d.angleTo(dirFromLatLon(0, 0)) * R < 7) continue
      if (blockers.some((b) => b.angleTo(d) * R < 4.5)) continue
      const q = surfaceQuaternion(d, tangentNorth(d).applyAxisAngle(d, rand() * Math.PI * 2))
      const s = 0.7 + rand() * 0.9
      mat.compose(d.clone().multiplyScalar(R), q, new THREE.Vector3(s, s, s))
      m.setMatrixAt(n++, mat)
    }
    m.count = n
    return m
  }, [locations])
  return <primitive object={mesh} />
}

function mergeTuft(parts: THREE.BufferGeometry[]) {
  const positions: number[] = []
  for (const p of parts) {
    const g = p.index ? p.toNonIndexed() : p
    positions.push(...(g.attributes.position.array as Float32Array))
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return out
}

export function Planet({ locations }: { locations: WorldLocation[] }) {
  const props = useProps(locations)
  return (
    <group>
      <PlanetBody />
      <Road rotation={[0, 0, 0]} />
      <Road rotation={[0, 0, Math.PI / 2]} />
      <Plaza />
      <GrassTufts locations={locations} />
      {props.map((p, i) => (
        <group key={i} position={p.pos} quaternion={p.q} scale={p.s}>
          <PropMesh kind={p.kind} />
        </group>
      ))}
    </group>
  )
}
