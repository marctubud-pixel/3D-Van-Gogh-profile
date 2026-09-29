import { useMemo } from 'react'
import * as THREE from 'three'
import type { WorldLocation } from '../../shared/types'
import { AcUnit, stripeMaterial } from '../locations/Landmark'
import { R, surfaceQuaternion } from './sphere'
import { Toon, geo } from './toon'
import { townLots, type TownLot } from './townLayout'

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

function TownBuilding({ lot }: { lot: TownLot }) {
  const { width: w, depth: d, height: h, seed, kind } = lot
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
  return (
    <group>
      {lots.map((lot, i) => (
        <group key={i} position={lot.up.clone().multiplyScalar(R)} quaternion={surfaceQuaternion(lot.up, lot.facing)}>
          <TownBuilding lot={lot} />
        </group>
      ))}
    </group>
  )
}
