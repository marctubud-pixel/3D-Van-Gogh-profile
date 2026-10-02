import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import type { WorldLocation } from '../../shared/types'
import { UP, flatDistance } from './plane'
import { BRIDGE, PLAZA, ROUTE_LEN, ROUTE_S, SERVICE_POINT, groundHeight, landmarkBlockers, routeFrame, routePoint } from './island'
import { dusk } from './daynight'
import { type Ramp, type Stroke, Strokes, blob, column, glowMat, rng, rotateAbout, shade } from './strokes'

const POST: Ramp = { light: ['#4f6a78', '#56717e'], mid: ['#3c5463', '#35495a', '#425a68'], dark: ['#2a3a48', '#24333f'] }
const HEAD: Ramp = { light: ['#fff4cf', '#fffae6'], mid: ['#ffe7a3', '#ffeec0'], dark: ['#f6d77f', '#f2cf72'] }
const POOL = ['#ffe6a0', '#ffdc8a', '#fff0c4']
const LAMP_H = 4.4
const OFF = new THREE.Color('#c9c6b8')
const ON = new THREE.Color('#ffffff')

/** Road lamps built from brush strokes along the inner road edge; heads and ground pools light up at night. */
export function StreetLamps({ locations }: { locations: WorldLocation[] }) {
  const parts = useMemo(() => {
    const blockers = locations.flatMap(landmarkBlockers)
    blockers.push(SERVICE_POINT)
    const r = rng(77)
    const posts: Stroke[] = []
    const heads: Stroke[] = []
    const pools: Stroke[] = []
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
      const floor = tip.clone().setY(groundHeight(tip) + 0.1)
      for (let k = 0; k < 26; k++) {
        const rad = 2.2 * Math.sqrt(r())
        const a = r() * Math.PI * 2
        const p = floor.clone().add(new THREE.Vector3(Math.cos(a) * rad, r() * 0.01, Math.sin(a) * rad))
        pools.push({ p, n: UP, dir: routeFrame(s).tan.clone(), len: 0.6 + r() * 0.5, wid: 0.25 + r() * 0.15, color: new THREE.Color(POOL[Math.floor(r() * POOL.length)]) })
      }
    }
    return { posts, heads, pools }
  }, [locations])

  const headMat = useMemo(() => {
    const m = glowMat().clone()
    m.color.copy(OFF)
    return m
  }, [])
  const poolMat = useMemo(() => {
    const m = glowMat().clone()
    m.transparent = true
    m.opacity = 0
    m.depthWrite = false
    m.blending = THREE.AdditiveBlending
    m.alphaTest = 0
    return m
  }, [])

  useFrame(() => {
    headMat.color.lerpColors(OFF, ON, dusk.k)
    poolMat.opacity = dusk.k * 0.35
    poolMat.visible = dusk.k > 0.01
  })

  return (
    <group>
      <Strokes strokes={parts.posts} />
      <Strokes strokes={parts.heads} material={headMat} />
      <Strokes strokes={parts.pools} material={poolMat} />
    </group>
  )
}
