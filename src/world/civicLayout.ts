import * as THREE from 'three'
import { CIVIC, HALL_BEARING, PLAZA, SPOKES, SPOKE_HALF } from './island'
import { BUILDING_SCALE } from './plane'

export type CivicProp =
  | { kind: 'bench'; deg: number; rad: number }
  | { kind: 'planter'; deg: number; rad: number; i: number }
  | { kind: 'cypress'; deg: number; rad: number; i: number }
  | { kind: 'lamp'; deg: number; rad: number }
  | { kind: 'newsstand'; deg: number; rad: number; label: string }
  | { kind: 'cafe'; deg: number; rad: number; i: number }
  | { kind: 'tree'; deg: number; rad: number }

/** Footprint radius of each prop in model units, used for walker and bike collisions. */
export const PROP_RADIUS: Record<CivicProp['kind'], number> = {
  bench: 0.8,
  planter: 0.9,
  cypress: 0.35,
  lamp: 0.2,
  newsstand: 1.15,
  cafe: 1.0,
  tree: 0.45,
}

/** Fountain basin radius in world units. */
export const FOUNTAIN_RADIUS = 2.7 * 0.9 * BUILDING_SCALE + 0.3

/**
 * Plaza furniture in model units around the plaza centre: benches ring the fountain, everything else stands on the lawn
 * wedges between the avenues so the asphalt stays clear.
 */
export function civicLayout(): CivicProp[] {
  const ways = [...SPOKES.map((k) => ({ b: k.bearing, pad: 0 })), { b: HALL_BEARING, pad: 6 }]
    .map((w) => ({ ...w, b: (w.b + 360) % 360 }))
    .sort((a, b) => a.b - b.b)
  const bedW = (CIVIC.lawnIn + CIVIC.lawnOut) / 2
  const bed = bedW / BUILDING_SCALE
  const edge = (CIVIC.lawnOut - 1) / BUILDING_SCALE
  const gapDeg = THREE.MathUtils.radToDeg(Math.asin((SPOKE_HALF + 0.9) / bedW))
  const out: CivicProp[] = []
  const specials = ['PRESSE', 'cafe', 'FLEURS']
  ways.forEach((w, i) => {
    const n = ways[(i + 1) % ways.length]
    const nb = n.b > w.b ? n.b : n.b + 360
    const mid = (w.b + nb) / 2
    const half = (nb - w.b) / 2 - gapDeg - Math.max(w.pad, n.pad) - 3
    if (half < 6) return
    out.push({ kind: 'bench', deg: mid, rad: 4.2 })
    for (const k of [-1, 1]) out.push({ kind: 'cypress', deg: mid + k * half, rad: bed, i })
    out.push({ kind: 'lamp', deg: mid + half * 0.75, rad: edge })
    const sp = specials[i]
    if (sp === 'cafe') {
      for (const k of [-1, 1]) out.push({ kind: 'cafe', deg: mid + k * half * 0.32, rad: bed, i: k < 0 ? 0 : 1 })
    } else if (sp) {
      out.push({ kind: 'newsstand', deg: mid, rad: bed, label: sp })
      for (const k of [-1, 1]) out.push({ kind: 'planter', deg: mid + k * half * 0.55, rad: bed, i: i + k + 1 })
    } else {
      out.push({ kind: 'planter', deg: mid, rad: bed, i })
      for (const k of [-1, 1]) out.push({ kind: 'tree', deg: mid + k * half * 0.55, rad: bed })
    }
  })
  return out
}

/** World-space circle colliders for the fountain and plaza furniture. */
export function civicColliders() {
  return [
    { at: PLAZA.clone(), r: FOUNTAIN_RADIUS },
    ...civicLayout().map((p) => {
      const t = THREE.MathUtils.degToRad(p.deg)
      const rad = p.rad * BUILDING_SCALE
      return { at: new THREE.Vector3(PLAZA.x + Math.cos(t) * rad, 0, PLAZA.z - Math.sin(t) * rad), r: PROP_RADIUS[p.kind] * BUILDING_SCALE }
    }),
  ]
}
