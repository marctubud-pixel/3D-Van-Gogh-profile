import * as THREE from 'three'
import type { WorldLocation } from '../../shared/types'
import { R, SERVICE_CENTER, dirFromLatLon, locationAnchors } from './sphere'

export type TownKind = 'house' | 'shop' | 'apartment' | 'gable' | 'garden'

export interface TownLot {
  up: THREE.Vector3
  /** Tangent direction the facade faces (toward the road). */
  facing: THREE.Vector3
  kind: TownKind
  width: number
  depth: number
  height: number
  seed: number
}

/** Collision radius used for filler buildings. */
export const LOT_RADIUS = 2.6
const SETBACK = 6.2
const SPACING = 7.2

/** Side streets branching off the equator road: longitude, direction (+1 north / -1 south), length in degrees of latitude. */
export const SPUR_ROADS: { lon: number; dir: 1 | -1; len: number }[] = [
  { lon: 40, dir: 1, len: 16 },
  { lon: -42, dir: -1, len: 16 },
  { lon: 76, dir: -1, len: 14 },
  { lon: -80, dir: 1, len: 14 },
]

function nearSpur(up: THREE.Vector3) {
  const lat = THREE.MathUtils.radToDeg(Math.asin(up.y))
  const lon = THREE.MathUtils.radToDeg(Math.atan2(up.x, up.z))
  return SPUR_ROADS.some((s) => {
    const along = lat * s.dir
    if (along < -1 || along > s.len + 4) return false
    return Math.abs(lon - s.lon) * (Math.PI / 180) * R * Math.cos(Math.asin(up.y)) < 5.5
  })
}

function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const KINDS: TownKind[] = ['house', 'shop', 'apartment', 'gable', 'shop', 'house']

/** Filler town blocks lining both ring roads through MAIN TOWN, skipping landmarks and the plaza. */
export function townLots(locations: WorldLocation[]): TownLot[] {
  const rand = rng(99)
  const blockers = locations.flatMap((l) => {
    const a = locationAnchors(l.lat, l.lon)
    return [a.building, a.parking]
  })
  const plaza = dirFromLatLon(0, 0)
  const service = dirFromLatLon(SERVICE_CENTER.lat, SERVICE_CENTER.lon)
  const lots: TownLot[] = []
  const step = THREE.MathUtils.radToDeg(SPACING / R)
  const off = SETBACK / R

  const add = (up: THREE.Vector3, facing: THREE.Vector3) => {
    if (up.angleTo(plaza) * R < 10) return
    if (up.angleTo(service) * R < 10) return
    if (blockers.some((b) => b.angleTo(up) * R < 7.5)) return
    if (THREE.MathUtils.radToDeg(Math.asin(up.y)) < -30) return
    if (nearSpur(up)) return
    const kind = rand() < 0.3 ? 'garden' : KINDS[Math.floor(rand() * KINDS.length)]
    const tall = kind === 'apartment'
    lots.push({
      up,
      facing,
      kind,
      width: 4 + rand() * 1.2,
      depth: 3.6 + rand() * 0.8,
      height: tall ? 6 + rand() * 1.5 : kind === 'gable' ? 3.2 : 3.6 + rand() * 2,
      seed: Math.floor(rand() * 1e6),
    })
  }

  // equator road, main-town span
  for (let t = -95; t <= 95; t += step) {
    const a = THREE.MathUtils.degToRad(t)
    for (const s of [-1, 1]) {
      const up = new THREE.Vector3(Math.sin(a) * Math.cos(off), s * Math.sin(off), Math.cos(a) * Math.cos(off)).normalize()
      const facing = new THREE.Vector3(0, -s, 0).projectOnPlane(up).normalize()
      add(up, facing)
    }
  }
  // meridian road through the plaza, north toward FUTURE HILL and south to the shore
  for (let t = -28; t <= 34; t += step) {
    const a = THREE.MathUtils.degToRad(t)
    for (const s of [-1, 1]) {
      const up = new THREE.Vector3(s * Math.sin(off), Math.sin(a) * Math.cos(off), Math.cos(a) * Math.cos(off)).normalize()
      const facing = new THREE.Vector3(-s, 0, 0).projectOnPlane(up).normalize()
      add(up, facing)
    }
  }
  return lots
}
