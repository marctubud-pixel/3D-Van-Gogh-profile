import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { WorldLocation } from '../../shared/types'
import { UP, flatDistance } from './plane'
import { BRIDGE, PLAZA, ROUTE_LEN, ROUTE_S, SERVICE_POINT, groundHeight, serviceWings, landmarkBlockers, routeFrame, routePoint } from './island'
import { dusk } from './daynight'
import { type Ramp, type Stroke, Strokes, blob, column, glowMat, glowPoolMat, rng, rotateAbout, shade } from './strokes'
import { playerPos } from './occlusion'
import { useQualityLevel } from './quality'

const POST: Ramp = { light: ['#4f6a78', '#56717e'], mid: ['#3c5463', '#35495a', '#425a68'], dark: ['#2a3a48', '#24333f'] }
const HEAD: Ramp = { light: ['#fff4cf', '#fffae6'], mid: ['#ffe7a3', '#ffeec0'], dark: ['#f6d77f', '#f2cf72'] }
const LAMP_H = 4.4
const OFF = new THREE.Color('#c9c6b8')
const ON = new THREE.Color('#ffffff')

/** Road lamps built from brush strokes along the inner road edge; heads and ground pools light up at night. */
export function StreetLamps({ locations }: { locations: WorldLocation[] }) {
  const parts = useMemo(() => {
    const blockers = locations.flatMap(landmarkBlockers)
    blockers.push(SERVICE_POINT, ...serviceWings())
    const r = rng(77)
    const posts: Stroke[] = []
    const heads: Stroke[] = []
    const pools: Stroke[] = []
    const halos: Stroke[] = []
    const bulbs: THREE.Vector3[] = []
    const bridge: [number, number] = [ROUTE_S[BRIDGE.a] - 3, ROUTE_S[BRIDGE.b] + 3]
    for (let s = 2; s < ROUTE_LEN - 2; s += 17) {
      if (s > bridge[0] && s < bridge[1]) continue
      const at = routePoint(s, -3.6)
      if (flatDistance(at, PLAZA) < 7.5 || blockers.some((b) => flatDistance(b, at) < 6)) continue
      const base = at.clone().setY(groundHeight(at))
      column(posts, r, base, LAMP_H, 0.07, POST, 70)
      const toRoad = routePoint(s, 0).sub(at).setY(0).normalize()
      const top = base.clone().add(new THREE.Vector3(0, LAMP_H, 0))
      const tip = top.clone().addScaledVector(toRoad, 1.1).add(new THREE.Vector3(0, -0.15, 0))
      const side = new THREE.Vector3().crossVectors(toRoad, UP).normalize()
      for (let k = 0; k < 6; k++) {
        const t = (k + 0.5) / 6
        const p = top.clone().lerp(tip, t).add(new THREE.Vector3(0, Math.sin(t * Math.PI) * 0.18, 0))
        const dir = rotateAbout(tip.clone().sub(top).normalize(), side, (r() - 0.5) * 0.15)
        const n = new THREE.Vector3().crossVectors(dir, side).normalize()
        posts.push({ p, n, dir, len: 0.3, wid: 0.09, color: shade(r, n, POST) })
        posts.push({ p: p.clone(), n: side, dir, len: 0.3, wid: 0.09, color: shade(r, side, POST) })
      }
      const bulb = tip.clone().add(new THREE.Vector3(0, -0.2, 0))
      blob(heads, r, bulb, 0.22, HEAD, 420, 0.6)
      bulbs.push(bulb)
      const floor = bulb.clone().setY(groundHeight(bulb) + 0.04)
      const tan = routeFrame(s).tan.clone()
      pools.push({ p: floor, n: UP, dir: tan, len: 7.5, wid: 7.5, color: new THREE.Color('#ffd98a') })
      pools.push({ p: floor.clone().setY(floor.y + 0.01), n: UP, dir: tan, len: 3.6, wid: 3.6, color: new THREE.Color('#fff0c8') })
      halos.push({ p: bulb.clone(), n: toRoad.clone().negate(), dir: side, len: 1.6, wid: 1.6, color: new THREE.Color('#ffe7a8') })
      halos.push({ p: bulb.clone(), n: side.clone(), dir: toRoad, len: 1.6, wid: 1.6, color: new THREE.Color('#ffe7a8') })
    }
    return { posts, heads, pools, halos, bulbs }
  }, [locations])

  const headMat = useMemo(() => {
    const m = glowMat().clone()
    m.color.copy(OFF)
    return m
  }, [])
  const poolMat = useMemo(() => glowPoolMat('#ffffff'), [])
  const haloMat = useMemo(() => {
    const m = glowPoolMat('#ffffff')
    m.side = THREE.DoubleSide
    return m
  }, [])
  const level = useQualityLevel()
  const lightCount = level === 'low' ? 0 : level === 'medium' ? 3 : 5
  const lights = useRef<(THREE.PointLight | null)[]>([])

  useFrame(() => {
    const k = dusk.k
    headMat.color.lerpColors(OFF, ON, k)
    poolMat.opacity = k * 0.75
    poolMat.visible = k > 0.01
    haloMat.opacity = k * 0.9
    haloMat.visible = k > 0.01
    if (!lightCount) return
    const near = parts.bulbs
      .map((b) => ({ b, d: flatDistance(b, playerPos) }))
      .sort((x, y) => x.d - y.d)
      .slice(0, lightCount)
    lights.current.forEach((l, i) => {
      if (!l) return
      const n = near[i]
      l.visible = k > 0.01 && !!n
      if (!n) return
      l.position.copy(n.b)
      l.intensity = k * 40
    })
  })

  return (
    <group>
      <Strokes strokes={parts.posts} />
      <Strokes strokes={parts.heads} material={headMat} />
      <Strokes strokes={parts.pools} material={poolMat} />
      <Strokes strokes={parts.halos} material={haloMat} />
      {Array.from({ length: lightCount }, (_, i) => (
        <pointLight key={i} ref={(l) => { lights.current[i] = l }} color="#ffd38a" distance={12} decay={1.6} intensity={0} />
      ))}
    </group>
  )
}
