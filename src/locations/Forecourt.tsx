import { useMemo } from 'react'
import * as THREE from 'three'
import { BUILDING_SCALE, LANDMARK_FIT, UP, type LocationAnchors } from '../world/plane'
import { groundHeight } from '../world/island'
import { Toon, geo, toonGradient } from '../world/toon'

/** Ground markings in front of a landmark: x runs along the facade, z out from the door toward the road. */
const PX = 32
const Z0 = -1.4
const Z1 = 3.6

type Ctx = CanvasRenderingContext2D
interface Frame {
  g: Ctx
  hw: number
  park: number
}

const toPx = (f: Frame, x: number, z: number): [number, number] => [(x + f.hw) * PX, (Z1 - z) * PX]

function rect(f: Frame, x0: number, z0: number, x1: number, z1: number) {
  const [a, b] = toPx(f, x0, z1)
  f.g.rect(a, b, (x1 - x0) * PX, (z1 - z0) * PX)
}

function fillRect(f: Frame, color: string, x0: number, z0: number, x1: number, z1: number) {
  f.g.beginPath()
  rect(f, x0, z0, x1, z1)
  f.g.fillStyle = color
  f.g.fill()
}

function bicycleBay(f: Frame) {
  const { g } = f
  const cx = f.park
  g.beginPath()
  rect(f, cx - 1.4, -0.2, cx + 1.4, 1.3)
  g.strokeStyle = '#f4f1e6'
  g.lineWidth = 0.1 * PX
  g.stroke()
  const [ix, iz] = toPx(f, cx, 0.75)
  const s = PX * 0.32
  g.lineWidth = 0.07 * PX
  g.beginPath()
  g.arc(ix - s, iz, s * 0.75, 0, Math.PI * 2)
  g.moveTo(ix + s * 1.75, iz)
  g.arc(ix + s, iz, s * 0.75, 0, Math.PI * 2)
  g.moveTo(ix - s, iz)
  g.lineTo(ix - s * 0.2, iz - s)
  g.lineTo(ix + s * 0.6, iz - s)
  g.lineTo(ix + s, iz)
  g.moveTo(ix - s * 0.2, iz - s)
  g.lineTo(ix, iz)
  g.lineTo(ix + s * 0.6, iz - s)
  g.stroke()
  const [tx, tz] = toPx(f, cx, 0.05)
  g.fillStyle = '#f4f1e6'
  g.font = `800 ${Math.round(PX * 0.34)}px sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'alphabetic'
  g.fillText('BICYCLE', tx, tz)
}

function arrows(f: Frame, color: string, from: number, to: number) {
  const { g } = f
  g.strokeStyle = color
  g.lineWidth = 0.12 * PX
  for (let z = from; z > to; z -= 0.9) {
    const [x0, y0] = toPx(f, -0.45, z - 0.35)
    const [x1, y1] = toPx(f, 0, z)
    const [x2, y2] = toPx(f, 0.45, z - 0.35)
    g.beginPath()
    g.moveTo(x0, y0)
    g.lineTo(x1, y1)
    g.lineTo(x2, y2)
    g.stroke()
  }
}

const STYLE: Record<string, (f: Frame) => void> = {
  cinema: (f) => {
    fillRect(f, '#d8b04a', -1.25, Z0, 1.25, Z1)
    fillRect(f, '#a8323a', -1.1, Z0, 1.1, Z1)
    const { g } = f
    g.fillStyle = '#e9c45c'
    for (let z = 0.6; z < Z1; z += 1.2) {
      const [x, y] = toPx(f, 0, z)
      g.beginPath()
      for (let i = 0; i < 10; i++) {
        const r = (i % 2 ? 0.12 : 0.3) * PX
        const t = (i / 10) * Math.PI * 2 - Math.PI / 2
        g.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r)
      }
      g.fill()
    }
  },
  'experiment-lab': (f) => {
    const { g } = f
    g.save()
    g.beginPath()
    rect(f, -f.hw, Z0, f.hw, Z0 + 0.35)
    g.clip()
    fillRect(f, '#e7bb2f', -f.hw, Z0, f.hw, Z0 + 0.35)
    g.strokeStyle = '#26292e'
    g.lineWidth = 0.16 * PX
    for (let x = -f.hw; x < f.hw + 1; x += 0.5) {
      const [a, b] = toPx(f, x, Z0)
      g.beginPath()
      g.moveTo(a, b)
      g.lineTo(a + 0.35 * PX, b - 0.35 * PX)
      g.stroke()
    }
    g.restore()
    for (let z = 0.4; z < Z1 - 0.2; z += 0.6) fillRect(f, '#f4f1e6', -1, z, 1, z + 0.32)
  },
  arcade: (f) => {
    const { g } = f
    g.setLineDash([0.3 * PX, 0.2 * PX])
    g.beginPath()
    rect(f, -1.4, Z0 + 0.1, 1.4, Z1 - 0.2)
    g.strokeStyle = '#3fb7c4'
    g.lineWidth = 0.1 * PX
    g.stroke()
    g.setLineDash([])
    arrows(f, '#d0569d', Z1 - 0.5, 0.2)
  },
  'brand-museum': (f) => {
    fillRect(f, '#8f8577', -1, -0.3, 1, 0.5)
    const { g } = f
    g.beginPath()
    rect(f, -1.7, Z0 + 0.1, 1.7, Z1 - 0.2)
    g.strokeStyle = '#efe8d6'
    g.lineWidth = 0.08 * PX
    g.stroke()
  },
  'print-house': (f) => {
    fillRect(f, '#7a5a38', -0.9, -0.3, 0.9, 0.5)
    arrows(f, '#efe8d6', Z1 - 0.5, 1)
  },
  'my-studio': (f) => {
    fillRect(f, '#d39a2c', -0.9, -0.3, 0.9, 0.5)
    const { g } = f
    const dots = ['#d9534f', '#3f8fc4', '#e2b13c', '#5aa469']
    for (let i = 0; i < 6; i++) {
      const [x, y] = toPx(f, (i % 2 ? 0.35 : -0.35), 1 + i * 0.42)
      g.fillStyle = dots[i % dots.length]
      g.beginPath()
      g.ellipse(x, y, 0.16 * PX, 0.24 * PX, 0, 0, Math.PI * 2)
      g.fill()
    }
  },
  observatory: (f) => {
    const { g } = f
    const [x, y] = toPx(f, 0, 1.8)
    const r = 1.4 * PX
    g.strokeStyle = '#efe8d6'
    g.lineWidth = 0.08 * PX
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.stroke()
    g.fillStyle = '#46557a'
    for (let i = 0; i < 4; i++) {
      const t = (i * Math.PI) / 2
      g.beginPath()
      g.moveTo(x + Math.cos(t) * r, y + Math.sin(t) * r)
      g.lineTo(x + Math.cos(t + Math.PI / 2) * r * 0.18, y + Math.sin(t + Math.PI / 2) * r * 0.18)
      g.lineTo(x - Math.cos(t + Math.PI / 2) * r * 0.18, y - Math.sin(t + Math.PI / 2) * r * 0.18)
      g.fill()
    }
  },
}

/** Ground in front of the door kept flat on the levelled pad; the mesh follows the terrain where it slopes. */
function plane(a: LocationAnchors, hw: number) {
  const across = new THREE.Vector3().crossVectors(UP, a.facing).normalize()
  const nx = Math.ceil(hw * 2)
  const nz = Math.ceil(Z1 - Z0)
  const g = new THREE.PlaneGeometry(1, 1, nx, nz)
  const pos = g.attributes.position as THREE.BufferAttribute
  const uv = g.attributes.uv as THREE.BufferAttribute
  const d = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    const x = -hw + uv.getX(i) * hw * 2
    const z = Z1 - (1 - uv.getY(i)) * (Z1 - Z0)
    d.copy(a.door).addScaledVector(across, x).addScaledVector(a.facing, z)
    pos.setXYZ(i, d.x, groundHeight(d) + 0.035, d.z)
  }
  g.computeVertexNormals()
  return { geometry: g, across }
}

export function Forecourt({ id, a }: { id: string; a: LocationAnchors }) {
  const fit = LANDMARK_FIT[id]
  const hw = Math.min(8, (fit?.halfWidth ?? 4.2) * BUILDING_SCALE * (fit?.scale ?? 1))
  const built = useMemo(() => {
    const { geometry, across } = plane(a, hw)
    const park = a.parking.clone().sub(a.door).dot(across)
    const c = document.createElement('canvas')
    c.width = Math.round(hw * 2 * PX)
    c.height = Math.round((Z1 - Z0) * PX)
    const f: Frame = { g: c.getContext('2d')!, hw, park }
    STYLE[id]?.(f)
    bicycleBay(f)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    const material = new THREE.MeshToonMaterial({
      map: tex,
      transparent: true,
      gradientMap: toonGradient(),
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
    const rack = a.door.clone().addScaledVector(across, park + Math.sign(park || 1) * 1.9).addScaledVector(a.facing, 0.5)
    return { geometry, material, across, park, rack }
  }, [a, hw, id])
  const yaw = Math.atan2(built.across.x, built.across.z)
  const posts = id === 'cinema' ? [0.8, 2, 3.2].flatMap((z) => [-1.45, 1.45].map((x) => a.door.clone().addScaledVector(built.across, x).addScaledVector(a.facing, z))) : []
  return (
    <>
      <mesh geometry={built.geometry} material={built.material} receiveShadow renderOrder={1} />
      <group position={[built.rack.x, groundHeight(built.rack), built.rack.z]} rotation={[0, yaw + Math.PI / 2, 0]}>
        {[-0.55, 0, 0.55].map((x) => (
          <Toon key={x} geometry={geo.torusRack} color="#9aa3ad" position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]} scale={[1, 1.6, 1]} outline={0.02} />
        ))}
      </group>
      {posts.map((p, i) => (
        <group key={i} position={[p.x, groundHeight(p), p.z]}>
          <Toon geometry={geo.cyl} color="#d6a63c" position={[0, 0.45, 0]} scale={[0.08, 0.9, 0.08]} outline={0.02} />
          <Toon geometry={geo.sphere} color="#e9c45c" position={[0, 0.92, 0]} scale={[0.14, 0.14, 0.14]} outline={0.02} />
        </group>
      ))}
      {posts.length > 0 &&
        [-1.45, 1.45].map((x) => {
          const m = a.door.clone().addScaledVector(built.across, x).addScaledVector(a.facing, 2)
          return (
            <Toon
              key={x}
              geometry={geo.box}
              color="#a8323a"
              position={[m.x, groundHeight(m) + 0.75, m.z]}
              rotation={[0, yaw, 0]}
              scale={[0.05, 0.05, 2.4]}
              outline={0.02}
            />
          )
        })}
    </>
  )
}
