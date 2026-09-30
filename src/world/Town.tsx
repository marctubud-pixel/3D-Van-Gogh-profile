import { useMemo } from 'react'
import * as THREE from 'three'
import type { WorldLocation } from '../../shared/types'
import { AcUnit, stripeMaterial } from '../locations/Landmark'
import { Fadeable } from './occlusion'
import { VendingMachine } from './StreetProps'
import { R, dirFromLatLon, surfaceQuaternion } from './sphere'
import { Toon, geo } from './toon'
import { SPUR_ROADS, townLots, type TownLot } from './townLayout'

const WALLS = ['#ece6d6', '#dfe3dc', '#d5e0da', '#e8dccb', '#cdd7d5', '#efe9dc']
const ROOFS = ['#4f7f86', '#5a676d', '#a4553f', '#6b8a7a', '#3f6f78']
const AWNINGS = ['#3f9c93', '#e0773f', '#3f78a8', '#c9524a', '#6aa06a']
const SHOP_NAMES = ['CAFE', 'BOOKS', 'LAUNDRY', 'RAMEN', 'FLOWERS', 'BAKERY', 'RECORDS', 'MARKET', 'BARBER', 'TOYS']
const GLASS = '#2d383d'
const TRIM = '#b8bdb5'

const gableGeo = (() => {
  const s = new THREE.Shape()
  s.moveTo(-0.5, 0)
  s.lineTo(0.5, 0)
  s.lineTo(0, 0.5)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false })
  g.translate(0, 0, -0.5)
  return g
})()

const signCache = new Map<string, THREE.CanvasTexture>()
function shopSign(text: string, bg: string) {
  const key = text + bg
  let t = signCache.get(key)
  if (!t) {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 64
    const g = c.getContext('2d')!
    g.fillStyle = bg
    g.fillRect(0, 0, 256, 64)
    g.fillStyle = '#f6f7f2'
    g.font = 'bold 40px "Trebuchet MS", sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(text, 128, 34)
    t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    signCache.set(key, t)
  }
  return t
}

function pick<T>(arr: T[], seed: number, salt: number) {
  return arr[(seed * (salt + 7) + salt * 13) % arr.length]
}

function WindowRow({ y, z, width, count, h = 0.9 }: { y: number; z: number; width: number; count: number; h?: number }) {
  const gap = width / count
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <group key={i} position={[-width / 2 + gap * (i + 0.5), y, z]}>
          <Toon geometry={geo.box} color={GLASS} scale={[gap * 0.55, h, 0.06]} outline={0} edges={false} />
          <Toon geometry={geo.box} color={TRIM} position={[0, -h / 2 - 0.05, 0.06]} scale={[gap * 0.65, 0.08, 0.14]} outline={0} edges={false} />
        </group>
      ))}
    </>
  )
}

function Rail({ y, z, width }: { y: number; z: number; width: number }) {
  return (
    <>
      <Toon geometry={geo.box} color="#8f9893" position={[0, y, z]} scale={[width, 0.06, 0.06]} outline={0} />
      <Toon geometry={geo.box} color="#dfe3dc" position={[0, y - 0.3, z]} scale={[width, 0.55, 0.04]} outline={0} />
      <Toon geometry={geo.box} color="#b8bdb5" position={[0, y - 0.6, z - 0.4]} scale={[width, 0.08, 0.8]} outline={0} />
    </>
  )
}

function StreetTree({ position, s = 1 }: { position: [number, number, number]; s?: number }) {
  return (
    <group position={position} scale={s}>
      <Fadeable height={2.2} radius={2.1}>
      <Toon geometry={geo.cyl} color="#6e6660" position={[0, 0.8, 0]} scale={[0.26, 1.6, 0.26]} outline={0.03} />
      <Toon geometry={geo.ico} color="#4f8f5f" position={[0, 2.1, 0]} scale={[1.8, 1.5, 1.8]} outline={0.05} radial={false} />
      <Toon geometry={geo.ico} color="#66a56f" position={[0.4, 2.6, 0.2]} scale={[1.1, 0.9, 1.1]} outline={0.04} radial={false} />
      </Fadeable>
    </group>
  )
}

/** Pocket garden between houses: trees, hedge, bench and a roadside vending machine. */
function Garden({ lot }: { lot: TownLot }) {
  const { width: w, depth: d, seed } = lot
  const vend = seed % 2 === 0
  return (
    <group>
      <Toon geometry={geo.box} color="#5e9d6d" position={[0, 0.3, -d / 2 + 0.3]} scale={[w, 0.6, 0.6]} outline={0.03} />
      <StreetTree position={[-w * 0.25, 0, -0.4]} s={0.9 + (seed % 3) * 0.1} />
      <StreetTree position={[w * 0.3, 0, -0.9]} s={0.8} />
      <Toon geometry={geo.ico} color="#4f8f5f" position={[w * 0.35, 0.35, 0.6]} scale={[1, 0.7, 0.9]} outline={0.03} radial={false} />
      <group position={[0, 0, 0.4]}>
        <Toon geometry={geo.box} color="#a4553f" position={[0, 0.45, 0]} scale={[1.4, 0.08, 0.4]} outline={0.02} />
        {[-0.55, 0.55].map((x) => (
          <Toon key={x} geometry={geo.box} color="#5a676d" position={[x, 0.22, 0]} scale={[0.08, 0.44, 0.36]} outline={0} />
        ))}
      </group>
      {vend && (
        <group position={[-w * 0.3, 0, d / 2 - 0.5]}>
          <VendingMachine />
        </group>
      )}
    </group>
  )
}

/** Short side street leaving the ring road, built as flat strips hugging the sphere. */
function SpurRoad({ lon, dir, len }: { lon: number; dir: 1 | -1; len: number }) {
  const geos = useMemo(() => {
    const strip = (half: number, lift: number) => {
      const pos: number[] = []
      const idx: number[] = []
      const steps = 24
      for (let i = 0; i <= steps; i++) {
        const lat = dir * (2.5 + (len * i) / steps)
        const c = dirFromLatLon(lat, lon)
        const east = new THREE.Vector3(Math.cos(THREE.MathUtils.degToRad(lon)), 0, -Math.sin(THREE.MathUtils.degToRad(lon)))
        for (const sgn of [-1, 1]) {
          const p = c.clone().addScaledVector(east, (sgn * half) / R).normalize().multiplyScalar(R + lift)
          pos.push(p.x, p.y, p.z)
        }
        if (i < steps) {
          const a = i * 2
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
        }
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      g.setIndex(idx)
      g.computeVertexNormals()
      return g
    }
    return { walk: strip(2.4, 0.028), road: strip(1.5, 0.048) }
  }, [lon, dir, len])
  return (
    <group>
      <mesh geometry={geos.walk} receiveShadow>
        <meshToonMaterial color="#d5dad1" side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geos.road} receiveShadow>
        <meshToonMaterial color="#6f848b" side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function TownBuilding({ lot }: { lot: TownLot }) {
  const { width: w, depth: d, height: h, seed, kind } = lot
  if (kind === 'garden') return <Garden lot={lot} />
  const wall = pick(WALLS, seed, 1)
  const roof = pick(ROOFS, seed, 2)
  const accent = pick(AWNINGS, seed, 3)
  const front = d / 2 + 0.03
  const floors = Math.max(1, Math.round(h / 2.6))
  return (
    <group>
      <Toon geometry={geo.box} color={wall} position={[0, h / 2, 0]} scale={[w, h, d]} outline={0.06} />
      <Toon geometry={geo.box} color={TRIM} position={[0, 0.2, 0]} scale={[w + 0.08, 0.4, d + 0.08]} outline={0} />
      {kind === 'gable' ? (
        <Toon geometry={gableGeo} color={roof} position={[0, h, 0]} scale={[w + 0.5, 3, d + 0.4]} outline={0.05} edges />
      ) : (
        <Toon geometry={geo.box} color={roof} position={[0, h + 0.1, 0]} scale={[w + 0.3, 0.2, d + 0.3]} outline={0.04} />
      )}
      {kind === 'shop' ? (
        <>
          <Toon geometry={geo.box} color={GLASS} position={[0, 1.1, front]} scale={[w * 0.8, 1.6, 0.06]} outline={0} edges={false} />
          <Toon geometry={geo.box} color={accent} material={stripeMaterial(accent)} position={[0, 2.25, front + 0.45]} rotation={[0.5, 0, 0]} scale={[w * 0.9, 0.06, 1]} outline={0.02} />
          <group position={[0, 2.95, front + 0.02]}>
            <Toon geometry={geo.box} color="#2c3437" scale={[w * 0.6 + 0.08, 0.58, 0.06]} outline={0} />
            <mesh position={[0, 0, 0.04]}>
              <planeGeometry args={[w * 0.6, 0.5]} />
              <meshBasicMaterial map={shopSign(pick(SHOP_NAMES, seed, 4), accent)} />
            </mesh>
          </group>
          {h > 4 && <WindowRow y={h - 1} z={front} width={w * 0.8} count={2} />}
        </>
      ) : (
        <>
          <Toon geometry={geo.box} color={GLASS} position={[w * 0.28, 0.9, front]} scale={[0.9, 1.6, 0.06]} outline={0} edges={false} />
          <Toon geometry={geo.box} color={roof} position={[w * 0.28, 1.85, front + 0.3]} scale={[1.3, 0.08, 0.6]} outline={0.02} />
          <WindowRow y={1.4} z={front} width={w * 0.45} count={1} h={0.8} />
          {Array.from({ length: floors - 1 }, (_, f) => (
            <group key={f}>
              <WindowRow y={2.6 * (f + 1) + 0.9} z={front} width={w * 0.8} count={kind === 'apartment' ? 3 : 2} />
              {(kind === 'apartment' || f === 0) && <Rail y={2.6 * (f + 1) + 0.5} z={front + 0.8} width={w * 0.85} />}
            </group>
          ))}
        </>
      )}
      {kind === 'apartment' && (
        <Toon geometry={geo.box} color="#8f9893" position={[w / 2 + 0.45, h / 2 - 0.3, 0]} rotation={[Math.atan2(h - 0.6, d) - Math.PI / 2, 0, 0]} scale={[0.8, 0.12, Math.hypot(h - 0.6, d)]} outline={0.02} />
      )}
      <AcUnit position={[-w / 2 - 0.2, 1.4 + (seed % 3) * 0.6, d * 0.1]} rotation={[0, -Math.PI / 2, 0]} />
      <Toon geometry={geo.cyl} color={TRIM} position={[-w / 2 + 0.15, h / 2, front + 0.05]} scale={[0.1, h, 0.1]} outline={0} />
    </group>
  )
}

/** Dense low-rise seaside-town blocks lining the MAIN TOWN roads. */
export function Town({ locations }: { locations: WorldLocation[] }) {
  const lots = useMemo(() => townLots(locations), [locations])
  const trees = useMemo(
    () =>
      SPUR_ROADS.flatMap((sp) =>
        [-1, 1].flatMap((side) =>
          [0.35, 0.7, 1].map((k) => {
            const lat = sp.dir * (3 + sp.len * k)
            const c = dirFromLatLon(lat, sp.lon)
            const east = new THREE.Vector3(Math.cos(THREE.MathUtils.degToRad(sp.lon)), 0, -Math.sin(THREE.MathUtils.degToRad(sp.lon)))
            return c.addScaledVector(east, (side * 3.4) / R).normalize()
          }),
        ),
      ),
    [],
  )
  return (
    <group>
      {SPUR_ROADS.map((sp) => (
        <SpurRoad key={sp.lon} {...sp} />
      ))}
      {trees.map((up, i) => (
        <group key={`st${i}`} position={up.clone().multiplyScalar(R)} quaternion={surfaceQuaternion(up, new THREE.Vector3(0, 1, 0))}>
          <StreetTree position={[0, 0, 0]} s={0.85} />
        </group>
      ))}
      {lots.map((lot, i) => (
        <group key={i} position={lot.up.clone().multiplyScalar(R)} quaternion={surfaceQuaternion(lot.up, lot.facing)}>
          <TownBuilding lot={lot} />
        </group>
      ))}
    </group>
  )
}
