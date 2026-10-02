import { useMemo } from 'react'
import * as THREE from 'three'
import type { WorldLocation } from '../../shared/types'
import { NORTH, UP, flatDir, flatDistance, planPoint, pointToPlan, yawQuaternion } from './plane'
import {
  BRIDGE,
  HILL_TOP,
  PLAZA,
  PARK,
  POND,
  ROUTE,
  ROUTE_LEN,
  ROUTE_S,
  ROUTE_TAN,
  SERVICE_POINT,
  groundHeight,
  hillHeight,
  landValue,
  landmarkBlockers,
  nearestOnRoute,
  routeFrame,
  routePoint,
  surf,
} from './island'
import { townLots } from './townLayout'
import { GroundPaint, type ScenerySpot } from './GroundPaint'
import { IslandTitle } from './IslandTitle'
import { LINE_COLOR, Toon, geo, toonMaterial } from './toon'

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

const arc = flatDistance

/** Flat-map extent of the detailed island ground; the open sea continues beyond it. */
const GROUND = { x0: -110, x1: 130, y0: -128, y1: 120, step: 0.8 }

function PlanetBody() {
  const geometry = useMemo(() => {
    const nx = Math.round((GROUND.x1 - GROUND.x0) / GROUND.step)
    const ny = Math.round((GROUND.y1 - GROUND.y0) / GROUND.step)
    const g = new THREE.PlaneGeometry(1, 1, nx, ny)
    const pos = g.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const px = GROUND.x0 + (pos.getX(i) + 0.5) * (GROUND.x1 - GROUND.x0)
      const py = GROUND.y0 + (pos.getY(i) + 0.5) * (GROUND.y1 - GROUND.y0)
      const v = planPoint(px, py)
      const land = landValue(v)
      const patch = Math.sin(px * 0.22) * Math.sin(py * 0.18) * Math.sin((px + py) * 0.12)
      let y = 0
      if (land < 0) {
        c.set(land > -2.5 ? SHALLOW : SEA)
        y = -THREE.MathUtils.clamp(0.3 - land * 0.25, 0.3, 0.9)
      } else if (land < 2.4) {
        c.set(SAND)
        y = -0.3 + (land / 2.4) * 0.3
      } else {
        const h = hillHeight(v)
        y = h
        if (arc(v, PARK.center) < PARK.r) c.set(LAWN)
        else c.set(patch > 0.25 || h > 0.5 ? GRASS_DARK : GRASS)
      }
      pos.setXYZ(i, v.x, y, v.z)
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
      <OpenSea />
    </>
  )
}

/** Open sea reaching to the horizon around the island. */
function OpenSea() {
  const geometry = useMemo(() => {
    const g = new THREE.RingGeometry(0, 1, 96, 40)
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const k = Math.hypot(x, y)
      const rr = k < 1e-6 ? 0 : (Math.pow(k, 2.2) * 2200) / k
      const v = planPoint(10 + x * rr, y * rr).setY(-1.2)
      pos.setXYZ(i, v.x, v.y, v.z)
    }
    g.computeVertexNormals()
    return g
  }, [])
  return (
    <mesh geometry={geometry} material={toonMaterial(SEA)} />
  )
}

/** Ribbon following the route between lateral offsets `a` and `b`; uv.x runs along the arc length. */
function ribbon(a: number, b: number, lift: number, from = 0, to = ROUTE.length - 1) {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const side = new THREE.Vector3()
  for (let i = from; i <= to; i++) {
    const at = ROUTE[i]
    side.crossVectors(UP, ROUTE_TAN[i]).normalize()
    for (const off of [a, b]) {
      const d = at.clone().addScaledVector(side, off)
      const onDeck = i >= BRIDGE.a && i <= BRIDGE.b
      const p = d.setY((onDeck ? 0 : groundHeight(d)) + lift)
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
      const at = ROUTE[i]
      const tan = ROUTE_TAN[i]
      const side = new THREE.Vector3().crossVectors(UP, tan).normalize()
      const q = yawQuaternion(tan)
      for (const s of [-1, 1]) posts.push({ pos: at.clone().addScaledVector(side, s * 3.1), q })
      if ((i - BRIDGE.a) % 9 === 0) piers.push({ pos: at.clone(), q })
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



function randomHeading(rand: () => number) {
  return NORTH.clone().applyAxisAngle(UP, rand() * Math.PI * 2)
}

/** Random point on or around the island: along the road, within `spread` of the centreline. */
function islandSample(rand: () => number, spread = 40) {
  return routePoint(rand() * (ROUTE_LEN + 20) - 10, (rand() * 2 - 1) * spread)
}

function useBlockers(locations: WorldLocation[]) {
  return useMemo(() => {
    const b = locations.flatMap(landmarkBlockers)
    return {
      buildings: b,
      service: SERVICE_POINT,
      plaza: PLAZA,
      lots: townLots(locations).map((l) => l.at),
    }
  }, [locations])
}

function useProps(locations: WorldLocation[]) {
  const bl = useBlockers(locations)
  return useMemo(() => {
    const rand = mulberry32(7)
    const spots: ScenerySpot[] = []
    const free = (d: THREE.Vector3, road = 4.6) => {
      const hit = nearestOnRoute(d)
      if (hit.dist < road) return null
      if (bl.buildings.some((b) => arc(b, d) < 9.5)) return null
      if (arc(bl.service, d) < 10 || arc(bl.plaza, d) < 7.5) return null
      if (bl.lots.some((b) => arc(b, d) < 4.5)) return null
      if (arc(POND.center, d) < POND.r + 1.2) return null
      return landValue(d, hit)
    }
    const push = (d: THREE.Vector3, kind: ScenerySpot['kind'], s: number) => spots.push({ d, yaw: rand() * Math.PI * 2, kind, s })

    let guard = 0
    while (spots.length < 240 && guard++ < 9000) {
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
      const [cx, cy] = pointToPlan(d)
      const clump = Math.sin(cx * 0.5) * Math.sin(cy * 0.42 + 1) * Math.sin((cx - cy) * 0.3 + 2)
      if (!hill && clump < 0.05) continue
      const kind: ScenerySpot['kind'] = hill ? (rand() > 0.25 ? 'pine' : 'bush') : rand() > 0.5 ? 'tree' : rand() > 0.45 ? 'bush' : 'pine'
      push(d, kind, 0.8 + rand() * 0.6)
    }
    guard = 0
    let park = 0
    while (park < 26 && guard++ < 2000) {
      const d = PARK.center.clone().addScaledVector(randomHeading(rand), (PARK.r + 4) * Math.sqrt(rand()))
      const land = free(d, 5)
      if (land === null || land < 3) continue
      if (arc(d, PARK.center) < PARK.r - 5 && rand() < 0.7) continue
      push(d, rand() > 0.3 ? 'tree' : 'bush', 0.9 + rand() * 0.5)
      park++
    }
    return spots
  }, [bl])
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
  const q = yawQuaternion(routeFrame(0).tan)
  return (
    <group position={PLAZA} quaternion={q}>
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
      const t = NORTH.clone().applyAxisAngle(UP, yaw)
      const d = POND.center.clone().addScaledVector(t, POND.r + 1.4)
      const toPond = flatDir(POND.center.clone().sub(d))
      return { pos: surf(d), q: yawQuaternion(toPond.negate()) }
    })
    return { pond: { pos: surf(POND.center, 0.03), q: yawQuaternion(NORTH) }, benches }
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

export function Planet({ locations }: { locations: WorldLocation[] }) {
  const scenery = useProps(locations)
  return (
    <group>
      <PlanetBody />
      <IslandTitle />
      <Road />
      <Plaza />
      <Park />
      <GroundPaint locations={locations} scenery={scenery} />
    </group>
  )
}
