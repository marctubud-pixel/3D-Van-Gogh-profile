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
  beachWidth,
  deckHeight,
  groundHeight,
  hillHeight,
  landValue,
  landmarkBlockers,
  nearestOnRoute,
  onServiceSquare,
  routeFrame,
  routePoint,
  surf,
} from './island'
import { townLots } from './townLayout'
import { GroundPaint, type ScenerySpot, meadowTone } from './GroundPaint'
import { IslandTitle } from './IslandTitle'
import { Toon, geo, toonMaterial } from './toon'
import { brushify } from './brush'
import { type Ramp, type Stroke, StrokeBuild, Strokes, rampFor, rng, rotateAbout, shade } from './strokes'

const SAND = '#e3d8b8'
const SEA = '#4f9fae'
const SHALLOW = '#6fbcc0'
const ASPHALT = '#6f848b'
const ROAD_HALF = 2
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
const MEADOW_GROUND = meadowTone(0.42)
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
      let y = 0
      if (land < 0) {
        c.set(land > -2.5 ? SHALLOW : SEA)
        y = -THREE.MathUtils.clamp(0.3 - land * 0.25, 0.3, 0.9)
      } else if (land < beachWidth(v)) {
        c.set(SAND)
        y = -0.3 + (land / beachWidth(v)) * 0.3
      } else {
        const h = hillHeight(v)
        y = h
        c.copy(MEADOW_GROUND)
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
  return <mesh geometry={geometry} material={paintedToon(SEA)} />
}

const paintedCache = new Map<string, THREE.MeshToonMaterial>()
/** Toon material with the world-space brush-dab shader, for large flat surfaces like water. */
function paintedToon(color: string) {
  let m = paintedCache.get(color)
  if (!m) {
    m = toonMaterial(color).clone()
    brushify(m)
    paintedCache.set(color, m)
  }
  return m
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
      const p = d.setY((onDeck ? deckHeight(i) : groundHeight(d)) + lift)
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

/** The single winding island road, with a bridge across the bay. */
function Road() {
  const road = useMemo(() => ribbon(-ROAD_HALF, ROAD_HALF, 0.07), [])
  return (
    <group>
      <mesh geometry={road} receiveShadow>
        <meshToonMaterial color={ASPHALT} gradientMap={toonMaterial('#fff').gradientMap} side={THREE.DoubleSide} />
      </mesh>
      <Bridge />
    </group>
  )
}

const RAIL: Ramp = rampFor('#e36f4c')

/** Freehand rail: a chain of overlapping, crossed strokes following the deck at `height`. */
function railStrokes(out: Stroke[], r: () => number, off: number, height: number, wid: number) {
  const at = (i: number) => {
    const side = new THREE.Vector3().crossVectors(UP, ROUTE_TAN[i]).normalize()
    return ROUTE[i].clone().addScaledVector(side, off).setY(deckHeight(i) + height)
  }
  for (let i = BRIDGE.a; i < BRIDGE.b; i++) {
    const a = at(i)
    const b = at(i + 1)
    const dir = b.clone().sub(a)
    const len = dir.length() * (1.3 + r() * 0.3)
    dir.normalize()
    const side = new THREE.Vector3().crossVectors(UP, dir).normalize()
    const p = a.lerp(b, 0.5).add(new THREE.Vector3(0, (r() - 0.5) * 0.03, 0))
    const tilt = rotateAbout(dir, side, (r() - 0.5) * 0.08)
    const up = new THREE.Vector3().crossVectors(side, tilt).normalize()
    out.push({ p, n: side, dir: tilt, len, wid: wid * (0.8 + r() * 0.4), color: shade(r, side, RAIL) })
    out.push({ p: p.clone(), n: up, dir: tilt, len, wid: wid * (0.8 + r() * 0.4), color: shade(r, up, RAIL) })
  }
}

function Bridge() {
  const parts = useMemo(() => {
    const deck = ribbon(-3.3, 3.3, 0.02, BRIDGE.a, BRIDGE.b)
    const posts: { pos: THREE.Vector3; q: THREE.Quaternion; h: number }[] = []
    const piers: { pos: THREE.Vector3; q: THREE.Quaternion; h: number }[] = []
    for (let i = BRIDGE.a; i <= BRIDGE.b; i += 3) {
      const at = ROUTE[i]
      const tan = ROUTE_TAN[i]
      const side = new THREE.Vector3().crossVectors(UP, tan).normalize()
      const q = yawQuaternion(tan)
      const h = deckHeight(i)
      for (const s of [-1, 1]) posts.push({ pos: at.clone().addScaledVector(side, s * 3.1).setY(h), q, h })
      if ((i - BRIDGE.a) % 9 === 0) piers.push({ pos: at.clone(), q, h })
    }
    const r = rng(53)
    const rails: Stroke[] = []
    for (const s of [-1, 1]) {
      railStrokes(rails, r, s * 3.1, 1.0, 0.12)
      railStrokes(rails, r, s * 3.1, 0.55, 0.07)
    }
    return { deck, posts, piers, rails }
  }, [])
  return (
    <group>
      <StrokeBuild seed={61}>
        <Toon geometry={parts.deck} color={DECK} outline={0} />
        {parts.posts.map((p, i) => (
          <group key={i} position={p.pos} quaternion={p.q}>
            <Toon geometry={geo.box} color="#e36f4c" position={[0, 0.5, 0]} scale={[0.14, 1, 0.14]} outline={0} />
          </group>
        ))}
        {parts.piers.map((p, i) => (
          <group key={i} position={p.pos} quaternion={p.q}>
            <Toon geometry={geo.box} color="#b9ad97" position={[0, (p.h - 1.8) / 2, 0]} scale={[6.2, p.h + 1.6, 0.9]} outline={0} />
          </group>
        ))}
      </StrokeBuild>
      <Strokes strokes={parts.rails} />
    </group>
  )
}

/** Beach spot nearest the service center: on the sand, facing the sea. */
function loungeSpot() {
  let best: { at: THREE.Vector3; d: number } | null = null
  for (let a = 0; a < 72; a++) {
    for (let rad = 8; rad < 45; rad += 1) {
      const at = SERVICE_POINT.clone().add(new THREE.Vector3(Math.cos((a / 72) * Math.PI * 2) * rad, 0, Math.sin((a / 72) * Math.PI * 2) * rad))
      const land = landValue(at)
      if (land < 0.6 || land > beachWidth(at) * 0.75) continue
      if (nearestOnRoute(at).dist < 5 || onServiceSquare(at, 1.5)) continue
      if (!best || rad < best.d) best = { at, d: rad }
      break
    }
  }
  if (!best) return null
  const at = best.at
  const e = 0.5
  const gx = landValue(at.clone().add(new THREE.Vector3(e, 0, 0))) - landValue(at.clone().add(new THREE.Vector3(-e, 0, 0)))
  const gz = landValue(at.clone().add(new THREE.Vector3(0, 0, e))) - landValue(at.clone().add(new THREE.Vector3(0, 0, -e)))
  const seaward = new THREE.Vector3(-gx, 0, -gz).normalize()
  return { at, seaward }
}

const LOUNGER = ['#e36f4c', '#3f78a8', '#e7b53f']

/** Striped deck chairs under a parasol on the sand by the service center. */
function BeachLounge() {
  const spot = useMemo(loungeSpot, [])
  if (!spot) return null
  const q = yawQuaternion(spot.seaward)
  return (
    <group position={surf(spot.at)} quaternion={q}>
      <StrokeBuild seed={71}>
        {LOUNGER.map((c, i) => {
          const x = (i - 1) * 1.6
          return (
            <group key={c} position={[x, 0, 0]} rotation={[0, (i - 1) * 0.12, 0]}>
              <Toon geometry={geo.box} color="#c9a77a" position={[0, 0.3, 0]} scale={[0.75, 0.06, 1.3]} outline={0} />
              <Toon geometry={geo.box} color={c} position={[0, 0.36, 0.15]} scale={[0.65, 0.04, 1.0]} outline={0} />
              <group position={[0, 0.34, -0.6]} rotation={[-0.75, 0, 0]}>
                <Toon geometry={geo.box} color={c} position={[0, 0.4, 0]} scale={[0.65, 0.8, 0.05]} outline={0} />
              </group>
              {[-0.32, 0.32].map((lx) =>
                [-0.55, 0.55].map((lz) => <Toon key={`${lx}${lz}`} geometry={geo.box} color="#a4835a" position={[lx, 0.15, lz]} scale={[0.05, 0.3, 0.05]} outline={0} />),
              )}
            </group>
          )
        })}
        <group position={[0.8, 0, -0.6]}>
          <Toon geometry={geo.cyl} color="#f3efe4" position={[0, 1.2, 0]} scale={[0.06, 2.4, 0.06]} outline={0} />
          <Toon geometry={geo.cone} color="#e36f4c" position={[0, 2.5, 0]} scale={[2.6, 0.55, 2.6]} outline={0} />
        </group>
        <group position={[-0.8, 0, -0.5]}>
          <Toon geometry={geo.cyl} color="#f3efe4" position={[0, 0.25, 0]} scale={[0.5, 0.06, 0.5]} outline={0} />
          <Toon geometry={geo.cyl} color="#a4835a" position={[0, 0.12, 0]} scale={[0.06, 0.25, 0.06]} outline={0} />
        </group>
      </StrokeBuild>
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

/** Starting plaza where the road begins, in front of the service center. */
function Plaza() {
  const q = yawQuaternion(routeFrame(0).tan)
  return (
    <group position={PLAZA} quaternion={q}>
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[6.5, 48]} />
        <meshToonMaterial color="#dcdfd6" gradientMap={toonMaterial('#fff').gradientMap} />
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
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} material={paintedToon(SHALLOW)}>
          <circleGeometry args={[POND.r, 40]} />
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
      <BeachLounge />
      <GroundPaint locations={locations} scenery={scenery} />
    </group>
  )
}
