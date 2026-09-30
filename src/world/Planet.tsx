import { useMemo } from 'react'
import * as THREE from 'three'
import type { WorldLocation } from '../../shared/types'
import { R, SERVICE_CENTER, dirFromLatLon, surfaceQuaternion, tangentNorth } from './sphere'
import {
  BRIDGE,
  HILL_TOP,
  PARK,
  POND,
  ROUTE,
  ROUTE_LEN,
  ROUTE_S,
  ROUTE_TAN,
  groundHeight,
  hillHeight,
  landValue,
  locationAnchors,
  nearestOnRoute,
  routeFrame,
  routePoint,
  surf,
} from './island'
import { townLots } from './townLayout'
import { Fadeable } from './occlusion'
import { IslandTitle } from './IslandTitle'
import { LINE_COLOR, Toon, geo, outlineMaterial, toonMaterial } from './toon'

const GRASS = '#72b07e'
const GRASS_DARK = '#5e9d6d'
const LAWN = '#86bf84'
const SAND = '#e3d8b8'
const SEA = '#4f9fae'
const SHALLOW = '#6fbcc0'
const ASPHALT = '#6f848b'
const SIDEWALK = '#d5dad1'
const PAINT = '#eef1ea'
const DECK = '#c9b79a'

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const arc = (a: THREE.Vector3, b: THREE.Vector3) => a.angleTo(b) * R

function PlanetBody() {
  const geometry = useMemo(() => {
    const g = new THREE.SphereGeometry(R, 256, 160)
    const pos = g.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const c = new THREE.Color()
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize()
      const land = landValue(v)
      const patch = Math.sin(v.x * 9) * Math.sin(v.z * 7) * Math.sin(v.y * 5)
      let r = R
      if (land < 0) {
        c.set(land > -2.5 ? SHALLOW : SEA)
        r = R - THREE.MathUtils.clamp(0.3 - land * 0.25, 0.3, 0.9)
      } else if (land < 2.4) {
        c.set(SAND)
        r = R - 0.3 + (land / 2.4) * 0.3
      } else {
        const h = hillHeight(v)
        r = R + h
        if (arc(v, PARK.center) < PARK.r) c.set(LAWN)
        else c.set(patch > 0.25 || h > 0.5 ? GRASS_DARK : GRASS)
      }
      pos.setXYZ(i, v.x * r, v.y * r, v.z * r)
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

/** Ribbon following the route between lateral offsets `a` and `b`; uv.x runs along the arc length. */
function ribbon(a: number, b: number, lift: number, from = 0, to = ROUTE.length - 1) {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const side = new THREE.Vector3()
  for (let i = from; i <= to; i++) {
    const up = ROUTE[i]
    side.crossVectors(up, ROUTE_TAN[i]).normalize()
    for (const off of [a, b]) {
      const d = up.clone().addScaledVector(side, off / R).normalize()
      const onDeck = i >= BRIDGE.a && i <= BRIDGE.b
      const p = d.multiplyScalar(R + (onDeck ? 0 : groundHeight(d)) + lift)
      pos.push(p.x, p.y, p.z)
      uv.push(ROUTE_S[i], off === a ? 0 : 1)
    }
    if (i < to) {
      const k = (i - from) * 2
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
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
  t.repeat.set(0.4, 1)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** The single winding island road, with a bridge across the bay. */
function Road() {
  const g = useMemo(() => {
    const dash = dashTexture()
    return {
      dash,
      walk: ribbon(-3.2, 3.2, 0.04),
      edgeL: ribbon(-3.26, -3.14, 0.05),
      edgeR: ribbon(3.14, 3.26, 0.05),
      road: ribbon(-1.9, 1.9, 0.07),
      lineL: ribbon(-1.72, -1.6, 0.08),
      lineR: ribbon(1.6, 1.72, 0.08),
      center: ribbon(-0.07, 0.07, 0.085),
    }
  }, [])
  const gradient = toonMaterial('#fff').gradientMap
  return (
    <group>
      <mesh geometry={g.walk} receiveShadow>
        <meshToonMaterial color={SIDEWALK} gradientMap={gradient} side={THREE.DoubleSide} />
      </mesh>
      {[g.edgeL, g.edgeR].map((e, i) => (
        <mesh key={i} geometry={e}>
          <meshBasicMaterial color={LINE_COLOR} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh geometry={g.road} receiveShadow>
        <meshToonMaterial color={ASPHALT} gradientMap={gradient} side={THREE.DoubleSide} />
      </mesh>
      {[g.lineL, g.lineR].map((e, i) => (
        <mesh key={i} geometry={e}>
          <meshBasicMaterial color={PAINT} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh geometry={g.center}>
        <meshBasicMaterial color="#ffffff" map={g.dash} transparent alphaTest={0.5} side={THREE.DoubleSide} />
      </mesh>
      <Bridge />
    </group>
  )
}

function Bridge() {
  const parts = useMemo(() => {
    const deck = ribbon(-3.3, 3.3, 0.02, BRIDGE.a, BRIDGE.b)
    const posts: { pos: THREE.Vector3; q: THREE.Quaternion }[] = []
    const piers: { pos: THREE.Vector3; q: THREE.Quaternion }[] = []
    for (let i = BRIDGE.a; i <= BRIDGE.b; i += 3) {
      const f = { up: ROUTE[i], tan: ROUTE_TAN[i] }
      const side = new THREE.Vector3().crossVectors(f.up, f.tan).normalize()
      for (const s of [-1, 1]) {
        const d = f.up.clone().addScaledVector(side, (s * 3.1) / R).normalize()
        posts.push({ pos: d.clone().multiplyScalar(R), q: surfaceQuaternion(d, f.tan) })
      }
      if ((i - BRIDGE.a) % 9 === 0) piers.push({ pos: f.up.clone().multiplyScalar(R), q: surfaceQuaternion(f.up, f.tan) })
    }
    const rails = [-1, 1].map((s) => ribbon(s * 3.05, s * 3.15, 0.95, BRIDGE.a, BRIDGE.b))
    return { deck, posts, piers, rails }
  }, [])
  return (
    <group>
      <mesh geometry={parts.deck} receiveShadow>
        <meshToonMaterial color={DECK} gradientMap={toonMaterial('#fff').gradientMap} side={THREE.DoubleSide} />
      </mesh>
      {parts.rails.map((r, i) => (
        <mesh key={i} geometry={r}>
          <meshToonMaterial color="#e36f4c" gradientMap={toonMaterial('#fff').gradientMap} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {parts.posts.map((p, i) => (
        <group key={i} position={p.pos} quaternion={p.q}>
          <Toon geometry={geo.box} color="#e36f4c" position={[0, 0.5, 0]} scale={[0.14, 1, 0.14]} outline={0.015} />
        </group>
      ))}
      {parts.piers.map((p, i) => (
        <group key={i} position={p.pos} quaternion={p.q}>
          <Toon geometry={geo.box} color="#b9ad97" position={[0, -0.9, 0]} scale={[6.2, 1.6, 0.9]} outline={0.04} />
        </group>
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

function randomTangent(d: THREE.Vector3, rand: () => number) {
  return tangentNorth(d).applyAxisAngle(d, rand() * Math.PI * 2)
}

/** Random point on or around the island: along the road, within `spread` of the centreline. */
function islandSample(rand: () => number, spread = 24) {
  return routePoint(rand() * (ROUTE_LEN + 20) - 10, (rand() * 2 - 1) * spread)
}

function useBlockers(locations: WorldLocation[]) {
  return useMemo(() => {
    const b = locations.flatMap((l) => {
      const a = locationAnchors(l.lat, l.lon)
      return [a.building, a.parking]
    })
    return {
      buildings: b,
      service: dirFromLatLon(SERVICE_CENTER.lat, SERVICE_CENTER.lon),
      plaza: dirFromLatLon(0, 0),
      lots: townLots(locations).map((l) => l.up),
    }
  }, [locations])
}

function useProps(locations: WorldLocation[]) {
  const bl = useBlockers(locations)
  return useMemo(() => {
    const rand = mulberry32(7)
    const spots: PropSpot[] = []
    const free = (d: THREE.Vector3, road = 4.6) => {
      const hit = nearestOnRoute(d)
      if (hit.dist < road) return null
      if (bl.buildings.some((b) => arc(b, d) < 9.5)) return null
      if (arc(bl.service, d) < 10 || arc(bl.plaza, d) < 7.5) return null
      if (bl.lots.some((b) => arc(b, d) < 4.5)) return null
      if (arc(POND.center, d) < POND.r + 1.2) return null
      return landValue(d, hit)
    }
    const push = (d: THREE.Vector3, kind: PropSpot['kind'], s: number) =>
      spots.push({ pos: surf(d, kind === 'rock' ? -0.1 : 0), q: surfaceQuaternion(d, randomTangent(d, rand)), kind, s })

    let guard = 0
    while (spots.length < 170 && guard++ < 6000) {
      const d = islandSample(rand)
      const land = free(d)
      if (land === null || land < 0.6) continue
      if (arc(d, PARK.center) < PARK.r + 2) continue
      if (land < 3) {
        if (rand() < 0.5) push(d, 'rock', 0.6 + rand() * 0.8)
        continue
      }
      const hill = arc(d, HILL_TOP) < 28
      // leave open meadows: only plant in clumps
      const clump = Math.sin(d.x * 21) * Math.sin(d.y * 17 + 1) * Math.sin(d.z * 19 + 2)
      if (!hill && clump < 0.05) continue
      const kind: PropSpot['kind'] = hill ? (rand() > 0.25 ? 'pine' : 'bush') : rand() > 0.5 ? 'tree' : rand() > 0.45 ? 'bush' : 'pine'
      push(d, kind, 0.8 + rand() * 0.6)
    }
    guard = 0
    let park = 0
    while (park < 26 && guard++ < 2000) {
      const d = PARK.center.clone().applyAxisAngle(randomTangent(PARK.center, rand), ((PARK.r + 4) * Math.sqrt(rand())) / R).normalize()
      const land = free(d, 5)
      if (land === null || land < 3) continue
      if (arc(d, PARK.center) < PARK.r - 5 && rand() < 0.7) continue
      push(d, rand() > 0.3 ? 'tree' : 'bush', 0.9 + rand() * 0.5)
      park++
    }
    return spots
  }, [bl])
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

/** Starting plaza where the road begins, in front of the service center. */
function Plaza() {
  const checker = useMemo(() => checkerTexture(), [])
  const up = dirFromLatLon(0, -4)
  const q = surfaceQuaternion(up, routeFrame(0).tan)
  return (
    <group position={up.clone().multiplyScalar(R)} quaternion={q}>
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[6.5, 48]} />
        <meshToonMaterial map={checker} gradientMap={toonMaterial('#fff').gradientMap} />
      </mesh>
      <mesh position={[0, 0.055, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[6.5, 6.6, 48]} />
        <meshBasicMaterial color={LINE_COLOR} />
      </mesh>
      <group position={[4.6, 0, 3.8]}>
        <Toon geometry={geo.cyl} color="#5a6670" position={[0, 1.4, 0]} scale={[0.12, 2.8, 0.12]} outline={0.02} />
        <Toon geometry={geo.box} color="#c96f4a" position={[0.6, 2.5, 0]} scale={[1.3, 0.34, 0.06]} outline={0.02} />
      </group>
    </group>
  )
}

/** Lawn, pond and benches around the lab. */
function Park() {
  const items = useMemo(() => {
    const benches = [0.4, 2.1, 3.8, 5.2].map((yaw) => {
      const t = tangentNorth(POND.center).applyAxisAngle(POND.center, yaw)
      const d = POND.center.clone().applyAxisAngle(new THREE.Vector3().crossVectors(POND.center, t).normalize(), (POND.r + 1.4) / R).normalize()
      const toPond = POND.center.clone().sub(d).projectOnPlane(d).normalize()
      return { pos: surf(d), q: surfaceQuaternion(d, toPond.negate()) }
    })
    return { pond: { pos: surf(POND.center, 0.03), q: surfaceQuaternion(POND.center, tangentNorth(POND.center)) }, benches }
  }, [])
  return (
    <group>
      <group position={items.pond.pos} quaternion={items.pond.q}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <circleGeometry args={[POND.r + 0.5, 40]} />
          <meshToonMaterial color="#cfc6ab" gradientMap={toonMaterial('#fff').gradientMap} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <circleGeometry args={[POND.r, 40]} />
          <meshToonMaterial color={SHALLOW} gradientMap={toonMaterial('#fff').gradientMap} />
        </mesh>
      </group>
      {items.benches.map((b, i) => (
        <group key={i} position={b.pos} quaternion={b.q}>
          <Toon geometry={geo.box} color="#a4553f" position={[0, 0.45, 0]} scale={[1.5, 0.08, 0.45]} outline={0.02} />
          <Toon geometry={geo.box} color="#a4553f" position={[0, 0.8, -0.2]} scale={[1.5, 0.35, 0.06]} outline={0.02} />
          {[-0.6, 0.6].map((x) => (
            <Toon key={x} geometry={geo.box} color="#5a676d" position={[x, 0.22, 0]} scale={[0.08, 0.44, 0.4]} outline={0} />
          ))}
        </group>
      ))}
    </group>
  )
}

/** Dark brush-stroke grass tufts scattered over the meadows. */
function GrassTufts({ locations }: { locations: WorldLocation[] }) {
  const bl = useBlockers(locations)
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
    const count = 1100
    const m = new THREE.InstancedMesh(merged, new THREE.MeshBasicMaterial({ color: '#3f7a55' }), count)
    const rand = mulberry32(21)
    const mat = new THREE.Matrix4()
    let n = 0
    let guard = 0
    while (n < count && guard++ < 12000) {
      const d = islandSample(rand, 20)
      const hit = nearestOnRoute(d)
      if (hit.dist < 3.8 || landValue(d, hit) < 3) continue
      if (arc(d, bl.plaza) < 8 || arc(d, bl.service) < 9) continue
      if (bl.buildings.some((b) => arc(b, d) < 7)) continue
      const q = surfaceQuaternion(d, randomTangent(d, rand))
      const s = 0.7 + rand() * 0.9
      mat.compose(surf(d), q, new THREE.Vector3(s, s, s))
      m.setMatrixAt(n++, mat)
    }
    m.count = n
    return m
  }, [bl])
  return <primitive object={mesh} />
}

/** White wave streaks on the open sea. */
function SeaFoam() {
  const mesh = useMemo(() => {
    const g = new THREE.CircleGeometry(1, 12)
    g.rotateX(-Math.PI / 2)
    const count = 240
    const m = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: '#e9f5f0' }), count)
    const rand = mulberry32(5)
    const mat = new THREE.Matrix4()
    let n = 0
    let guard = 0
    while (n < count && guard++ < 5000) {
      const d = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize()
      if (landValue(d) > -3) continue
      const q = surfaceQuaternion(d, randomTangent(d, rand))
      mat.compose(d.clone().multiplyScalar(R - 0.85), q, new THREE.Vector3(0.9 + rand() * 1.6, 1, 0.12 + rand() * 0.1))
      m.setMatrixAt(n++, mat)
    }
    m.count = n
    return m
  }, [])
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
      <SeaFoam />
      <IslandTitle />
      <Road />
      <Plaza />
      <Park />
      <GrassTufts locations={locations} />
      {props.map((p, i) => (
        <group key={i} position={p.pos} quaternion={p.q} scale={p.s}>
          {p.kind === 'tree' || p.kind === 'pine' ? (
            <Fadeable height={p.kind === 'tree' ? 2.2 : 1.4}>
              <PropMesh kind={p.kind} />
            </Fadeable>
          ) : (
            <PropMesh kind={p.kind} />
          )}
        </group>
      ))}
    </group>
  )
}
