import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
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
  BEACH_SPOT,
  SERVICE_POINT,
  CREEK,
  SPOKES,
  SPOKE_HALF,
  civicLawn,
  onSpoke,
  FOREST,
  beachWidth,
  creekEdge,
  deckHeight,
  groundHeight,
  landmarkColliders,
  locationAnchors,
  locationPoint,
  terrainHeight,
  forecourt,
  forecourtWalk,
  landValue,
  landmarkBlockers,
  nearestOnRoute,
  onServiceSquare,
  routePoint,
  surf,
  wildBlocked,
} from './island'
import { Forest } from './Forest'
import { townLots } from './townLayout'
import { dusk } from './daynight'
import { GroundPaint, type ScenerySpot, meadowTone } from './GroundPaint'
import { IslandTitle } from './IslandTitle'
import { Toon, geo, toonMaterial } from './toon'
import { brushify } from './brush'
import { type Ramp, type Stroke, StrokeBuild, Strokes, pick, rampFor, rng, rotateAbout, shade } from './strokes'

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
const COURT = new THREE.Color('#cfc9b6')
const LAWN = meadowTone(0.55)
const AVENUE = new THREE.Color('#6f848b')
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
        const h = terrainHeight(v)
        y = h
        if (onServiceSquare(v, 0.2)) c.copy(civicLawn(v) ? LAWN : AVENUE)
        else if (onSpoke(v, 0.1)) c.copy(AVENUE)
        else c.copy(forecourt(v, -0.2) ? (forecourtWalk(v) ? COURT : LAWN) : MEADOW_GROUND)
        const e = creekEdge(v)
        if (e < 0.6) {
          y = h - 0.42 * THREE.MathUtils.smoothstep(0.6 - e, 0, 1.2)
          c.set(e < 0 ? SHALLOW : '#cfc6ab')
        }
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
      <NightSea />
      <DistantShores />
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

const SEA_NIGHT = new THREE.Color(0.36, 0.5, 1.05)
const WHITE = new THREE.Color(1, 1, 1)
const GLINTS = ['#f2cf6b', '#f6dd8e', '#e8c45a', '#a9c3ec', '#dfe8f4', '#7fa2dc']

/**
 * Night water in the "Starry Night Over the Rhône" mood: a multiply wash pulls every water surface
 * toward ultramarine, and short horizontal glints of lamplight and starlight float on top.
 */
function NightSea() {
  const wash = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        blending: THREE.MultiplyBlending,
        transparent: true,
        premultipliedAlpha: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )
  const glintMat = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), [])
  const washGeo = useMemo(() => {
    const g = new THREE.CircleGeometry(1400, 64)
    g.rotateX(-Math.PI / 2)
    g.translate(10, -0.22, 0)
    return g
  }, [])
  const glints = useMemo(() => {
    const r = rng(77)
    const geo = new THREE.PlaneGeometry(1, 1)
    geo.rotateX(-Math.PI / 2)
    const pts: { p: THREE.Vector3; yaw: number; len: number; wid: number; c: THREE.Color }[] = []
    for (let k = 0; k < 40000 && pts.length < 2200; k++) {
      const p = new THREE.Vector3(-110 + r() * 240, 0, -120 + r() * 248)
      const land = landValue(p)
      if (land > -0.4) continue
      // denser near the shore, where the lamps would reflect
      if (land < -6 && r() < 0.65) continue
      p.y = -0.18 + r() * 0.01
      pts.push({ p, yaw: 0.35 + (r() - 0.5) * 0.25, len: 0.8 + r() * 2.2, wid: 0.12 + r() * 0.12, c: new THREE.Color(pick(r, GLINTS)) })
    }
    const mesh = new THREE.InstancedMesh(geo, glintMat, pts.length)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    pts.forEach((g, i) => {
      q.setFromAxisAngle(UP, g.yaw)
      m.compose(g.p, q, new THREE.Vector3(g.len, 1, g.wid))
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, g.c)
    })
    mesh.frustumCulled = false
    return mesh
  }, [glintMat])
  const washRef = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const k = dusk.k
    wash.color.lerpColors(WHITE, SEA_NIGHT, k)
    if (washRef.current) washRef.current.visible = k > 0.01
    glintMat.opacity = k * (0.82 + Math.sin(clock.elapsedTime * 1.7) * 0.08)
    glints.visible = k > 0.01
  })
  return (
    <>
      <mesh ref={washRef} geometry={washGeo} material={wash} renderOrder={1} />
      <primitive object={glints} />
    </>
  )
}

const SHORE_WALLS = ['#efe6d2', '#e8dcc0', '#f2ead8', '#e4d2b4', '#dfe3dc']
const SHORE_ROOFS = ['#b8563c', '#c86f4a', '#3f6f80', '#a84a3a', '#5b7f8c']
const WIN_DAY = new THREE.Color('#4a5f70')
const WIN_NIGHT = new THREE.Color(2.4, 1.75, 0.7)
const SHORES = [
  { a: 0.5, r: 260, w: 120 },
  { a: 1.7, r: 300, w: 160 },
  { a: 2.9, r: 240, w: 90 },
  { a: 4.1, r: 320, w: 180 },
  { a: 5.3, r: 270, w: 110 },
]

/** Far-off coastal towns on the horizon: painted houses by day, lit windows and reflections by night. */
function DistantShores() {
  const winMat = useMemo(() => new THREE.MeshBasicMaterial({ color: WIN_DAY.clone(), toneMapped: false }), [])
  const glowMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#f2cf6b',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  )
  const built = useMemo(() => {
    const r = rng(91)
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
    const roof = new THREE.ConeGeometry(0.75, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0)
    const pane = new THREE.PlaneGeometry(1, 1)
    const streak = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
    const houses: THREE.Matrix4[] = []
    const roofs: THREE.Matrix4[] = []
    const wallC: THREE.Color[] = []
    const roofC: THREE.Color[] = []
    const wins: THREE.Matrix4[] = []
    const streaks: THREE.Matrix4[] = []
    const hills: THREE.Matrix4[] = []
    const q = new THREE.Quaternion()
    const v = new THREE.Vector3()
    for (const sh of SHORES) {
      const c = new THREE.Vector3(10 + Math.cos(sh.a) * sh.r, 0, Math.sin(sh.a) * sh.r)
      const inward = new THREE.Vector3(10, 0, 0).sub(c).setY(0).normalize()
      const side = new THREE.Vector3(-inward.z, 0, inward.x)
      const yaw = Math.atan2(inward.x, inward.z)
      q.setFromAxisAngle(UP, yaw)
      hills.push(new THREE.Matrix4().compose(c.clone().addScaledVector(inward, -18).setY(-2), q, new THREE.Vector3(sh.w * 0.6, 9 + r() * 7, 30)))
      hills.push(new THREE.Matrix4().compose(c.clone().setY(-1.2), q, new THREE.Vector3(sh.w * 0.55, 3, 16)))
      const n = Math.round(sh.w / 4)
      for (let k = 0; k < n; k++) {
        const t = (k / n - 0.5) * sh.w * 0.85 + (r() - 0.5) * 3
        const depth = -r() * 16
        const p = c.clone().addScaledVector(side, t).addScaledVector(inward, depth + 4)
        const lift = Math.max(0, -depth) * 0.45
        const hw = 4.5 + r() * 4
        const hh = 5 + r() * 8
        const hd = 4.5 + r() * 3.5
        p.y = 0.5 + lift
        houses.push(new THREE.Matrix4().compose(p, q, new THREE.Vector3(hw, hh, hd)))
        wallC.push(new THREE.Color(pick(r, SHORE_WALLS)))
        roofs.push(new THREE.Matrix4().compose(v.copy(p).setY(p.y + hh), q, new THREE.Vector3(hw * 1.15, 1.6 + r() * 1.4, hd * 1.15)))
        roofC.push(new THREE.Color(pick(r, SHORE_ROOFS)))
        const rows = Math.max(1, Math.floor(hh / 2.6))
        for (let row = 0; row < rows; row++) {
          for (const off of [-0.25, 0.25]) {
            if (r() < 0.3) continue
            const wp = p
              .clone()
              .addScaledVector(side, off * hw)
              .addScaledVector(inward, hd / 2 + 0.05)
            wp.y = p.y + 1.8 + row * 2.6
            wins.push(new THREE.Matrix4().compose(wp, q, new THREE.Vector3(1.2, 1.6, 1)))
          }
        }
        if (r() < 0.6) {
          const sp = p.clone().addScaledVector(inward, 12 + r() * 20).setY(-0.15)
          const sq = new THREE.Quaternion().setFromAxisAngle(UP, yaw)
          streaks.push(new THREE.Matrix4().compose(sp, sq, new THREE.Vector3(0.6 + r() * 0.8, 1, 10 + r() * 16)))
        }
      }
    }
    const inst = (g: THREE.BufferGeometry, m: THREE.Material, ms: THREE.Matrix4[], cs?: THREE.Color[]) => {
      const mesh = new THREE.InstancedMesh(g, m, ms.length)
      ms.forEach((x, i) => mesh.setMatrixAt(i, x))
      cs?.forEach((x, i) => mesh.setColorAt(i, x))
      mesh.frustumCulled = false
      return mesh
    }
    const tinted = (base: string) => {
      const m = toonMaterial(base).clone()
      m.color.set('#ffffff')
      brushify(m)
      return m
    }
    return {
      hills: inst(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), paintedToon('#5e8f5a'), hills),
      houses: inst(box, tinted('#ffffff'), houses, wallC),
      roofs: inst(roof, tinted('#ffffff'), roofs, roofC),
      wins: inst(pane, winMat, wins),
      streaks: inst(streak, glowMat, streaks),
    }
  }, [winMat, glowMat])
  useFrame(() => {
    const k = dusk.k
    winMat.color.lerpColors(WIN_DAY, WIN_NIGHT, k)
    glowMat.opacity = k * 0.55
    built.streaks.visible = k > 0.01
  })
  return (
    <>
      <primitive object={built.hills} />
      <primitive object={built.houses} />
      <primitive object={built.roofs} />
      <primitive object={built.wins} />
      <primitive object={built.streaks} />
    </>
  )
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

/** Asphalt strips of the plaza avenues, broken where the creek footbridge carries them. */
function avenueRibbon() {
  const pos: number[] = []
  const idx: number[] = []
  for (const k of SPOKES) {
    const len = flatDistance(k.a, k.b)
    const along = flatDir(k.b.clone().sub(k.a))
    const side = new THREE.Vector3().crossVectors(UP, along)
    const n = Math.ceil(len)
    let open = false
    for (let i = 0; i <= n; i++) {
      const c = k.a.clone().addScaledVector(along, (len * i) / n)
      if (creekEdge(c) < 3 || i > n - (ROAD_HALF - 0.3)) {
        open = false
        continue
      }
      for (const o of [-SPOKE_HALF, SPOKE_HALF]) {
        const d = c.clone().addScaledVector(side, o)
        pos.push(d.x, groundHeight(d) + 0.06, d.z)
      }
      const v = pos.length / 3
      if (open) idx.push(v - 4, v - 2, v - 3, v - 3, v - 2, v - 1)
      open = true
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** The single winding island road, with a bridge across the bay. */
function Road() {
  const road = useMemo(() => ribbon(-ROAD_HALF, ROAD_HALF, 0.07), [])
  const avenues = useMemo(avenueRibbon, [])
  return (
    <group>
      <mesh geometry={road} receiveShadow>
        <meshToonMaterial color={ASPHALT} gradientMap={toonMaterial('#fff').gradientMap} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={avenues} receiveShadow>
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
      const at = BEACH_SPOT.clone().add(new THREE.Vector3(Math.cos((a / 72) * Math.PI * 2) * rad, 0, Math.sin((a / 72) * Math.PI * 2) * rad))
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
      if (wildBlocked(d, 1.2)) return null
      return landValue(d, hit)
    }
    const push = (d: THREE.Vector3, kind: ScenerySpot['kind'], s: number) => spots.push({ d, yaw: rand() * Math.PI * 2, kind, s })
    const pickKind = (mix: [ScenerySpot['kind'], number][]) => {
      let t = rand() * mix.reduce((a, [, w]) => a + w, 0)
      for (const [k, w] of mix) if ((t -= w) <= 0) return k
      return mix[0][0]
    }

    let guard = 0
    while (spots.length < 240 && guard++ < 9000) {
      const d = islandSample(rand)
      const land = free(d)
      if (land === null || land < 0.6) continue
      if (arc(d, PARK.center) < PARK.r + 2) continue
      if (arc(d, FOREST.center) < FOREST.r) continue
      if (land < 3) {
        if (rand() < 0.5) push(d, 'rock', 0.6 + rand() * 0.8)
        continue
      }
      const hill = arc(d, HILL_TOP) < 28
      // leave open meadows: only plant in clumps
      const [cx, cy] = pointToPlan(d)
      const clump = Math.sin(cx * 0.5) * Math.sin(cy * 0.42 + 1) * Math.sin((cx - cy) * 0.3 + 2)
      if (!hill && clump < 0.05) continue
      const kind = hill
        ? pickKind([['pine', 6], ['bush', 2.5], ['umbrella', 1.5]])
        : pickKind([['tree', 3.5], ['umbrella', 1.5], ['poplar', 1.5], ['bush', 2], ['pine', 1.5]])
      push(d, kind, 0.8 + rand() * 0.6)
    }
    guard = 0
    let park = 0
    while (park < 26 && guard++ < 2000) {
      const d = PARK.center.clone().addScaledVector(randomHeading(rand), (PARK.r + 4) * Math.sqrt(rand()))
      const land = free(d, 5)
      if (land === null || land < 3) continue
      if (arc(d, PARK.center) < PARK.r - 5 && rand() < 0.7) continue
      push(d, pickKind([['tree', 4], ['birch', 2], ['poplar', 1], ['bush', 3]]), 0.9 + rand() * 0.5)
      park++
    }
    // woodland: tall broadleaf trees thinning toward the rim, bushes and boulders along the creek
    guard = 0
    const forest: THREE.Vector3[] = []
    while (forest.length < 42 && guard++ < 6000) {
      const d = FOREST.center.clone().addScaledVector(randomHeading(rand), FOREST.r * Math.sqrt(rand()))
      const land = free(d, 6)
      if (land === null || land < 3 || wildBlocked(d, 2)) continue
      if (arc(d, FOREST.center) > FOREST.r * 0.7 && rand() < 0.5) continue
      if (forest.some((f) => arc(f, d) < 4.2)) continue
      forest.push(d)
      push(d, pickKind([['tall', 4], ['birch', 2.5], ['tree', 2], ['poplar', 1]]), 1 + rand() * 0.6)
    }
    for (let k = 0, n = 0; k < 900 && n < 60; k++) {
      const i = Math.floor(rand() * CREEK.length)
      const side = new THREE.Vector3(rand() - 0.5, 0, rand() - 0.5).normalize()
      const d = CREEK[i].clone().addScaledVector(side, 2.2 + rand() * 2.5)
      const land = free(d, 5)
      if (land === null || land < 3 || wildBlocked(d, 0.4)) continue
      push(d, rand() > 0.45 ? 'bush' : 'rock', 0.6 + rand() * 0.7)
      n++
    }
    // street greenery filling the verges between buildings
    for (let s = 4, n = 0; s < ROUTE_LEN - 4 && n < 50; s += 4.5) {
      if (s > ROUTE_S[BRIDGE.a] - 6 && s < ROUTE_S[BRIDGE.b] + 6) continue
      for (const sign of [-1, 1]) {
        if (rand() < 0.45) continue
        const d = routePoint(s, sign * (5.4 + rand() * 1.8))
        if (nearestOnRoute(d).dist < 4.6) continue
        if (bl.buildings.some((b) => arc(b, d) < 8) || bl.lots.some((b) => arc(b, d) < 3.4)) continue
        if (arc(bl.service, d) < 10 || arc(bl.plaza, d) < 7.5 || arc(POND.center, d) < POND.r + 1.5) continue
        if (onServiceSquare(d, 1) || wildBlocked(d, 1.2) || landValue(d) < 3) continue
        if (spots.some((p) => arc(p.d, d) < 2.6)) continue
        push(d, pickKind([['tree', 3], ['poplar', 2], ['bush', 3], ['umbrella', 1]]), 0.7 + rand() * 0.4)
        n++
      }
    }
    return spots
  }, [bl])
}

/** Lawn, pond and benches around the lab. */
function Park() {
  const items = useMemo(() => {
    const lab = locationAnchors(locationPoint({ id: 'experiment-lab', lat: 0, lon: 0 }), 'experiment-lab')
    const walls = landmarkColliders(lab, 'experiment-lab')
    const benches = [0.4, 2.1, 3.8, 5.2].flatMap((yaw) => {
      const t = NORTH.clone().applyAxisAngle(UP, yaw)
      const d = POND.center.clone().addScaledVector(t, POND.r + 1.4)
      if (walls.some((c) => arc(c.at, d) < c.r + 1.2) || nearestOnRoute(d).dist < 3) return []
      const toPond = flatDir(POND.center.clone().sub(d))
      return [{ pos: surf(d), q: yawQuaternion(toPond.negate()) }]
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
      <Park />
      <BeachLounge />
      <Forest />
      <GroundPaint locations={locations} scenery={scenery} />
    </group>
  )
}
