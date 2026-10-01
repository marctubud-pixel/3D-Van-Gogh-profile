import * as THREE from 'three'
import type { WorldLocation } from '../../shared/types'
import { R, SERVICE_CENTER, dirFromLatLon } from './sphere'
import { BRIDGE, ROUTE, ROUTE_S, landValue, landmarkBlockers, nearestOnRoute, routeFrame, routePoint } from './island'

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
const SETBACK = 7.5
const SPACING = 10

/** Stretches of road (arc length) lined with a few small houses. */
const TOWN_SPANS: [number, number][] = [
  [8, 50],
  [96, 122],
]

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

const KINDS: TownKind[] = ['house', 'shop', 'gable', 'shop', 'house', 'apartment']

/** Sparse low-rise houses along the first stretch of road, skipping landmarks, plaza and coast. */
export function townLots(locations: WorldLocation[]): TownLot[] {
  const rand = rng(99)
  const blockers = locations.flatMap(landmarkBlockers)
  blockers.push(dirFromLatLon(SERVICE_CENTER.lat, SERVICE_CENTER.lon), dirFromLatLon(0, 0))
  const lots: TownLot[] = []
  const bridgeS: [number, number] = [ROUTE_S[BRIDGE.a] - 6, ROUTE_S[BRIDGE.b] + 6]
  for (const [a, b] of TOWN_SPANS) {
    for (let s = a; s <= b; s += SPACING) {
      for (const sign of [-1, 1]) {
        const ss = s + (sign > 0 ? SPACING / 2 : 0)
        if (ss > bridgeS[0] && ss < bridgeS[1]) continue
        const up = routePoint(ss, sign * SETBACK)
        if (blockers.some((p) => p.angleTo(up) * R < 12)) continue
        if (landValue(up) < 6) continue
        if (nearestOnRoute(up).dist < SETBACK - 1) continue
        if (rand() < 0.2) continue
        const road = ROUTE[nearestOnRoute(up).i]
        const facing = road.clone().sub(up).projectOnPlane(up)
        if (facing.lengthSq() < 1e-10) facing.copy(routeFrame(ss).side).multiplyScalar(-sign)
        facing.normalize()
        const kind = rand() < 0.3 ? 'garden' : KINDS[Math.floor(rand() * KINDS.length)]
        lots.push({
          up,
          facing,
          kind,
          width: 4 + rand() * 1.2,
          depth: 3.6 + rand() * 0.8,
          height: kind === 'apartment' ? 6 + rand() * 1.5 : kind === 'gable' ? 3.2 : 3.6 + rand() * 2,
          seed: Math.floor(rand() * 1e6),
        })
      }
    }
  }
  return lots
}
