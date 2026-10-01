import { useMemo } from 'react'
import * as THREE from 'three'
import { type Stroke, StrokePaint, dab, painted, pick, rampFor, useStrokeBuild } from '../world/strokes'
import { Toon, geo, toonMaterial } from '../world/toon'

export type V3 = [number, number, number]
/** Axis-aligned bounds: x0, x1, y0, y1, z0, z1. */
export type Bounds = [number, number, number, number, number, number]

export const PAL = {
  cream: '#efe8d6',
  creamShade: '#e2d8c2',
  stone: '#d9d2c1',
  navy: '#2f4a78',
  navyDark: '#23385c',
  roofSlate: '#8fa6b6',
  glass: '#a9cfd6',
  interior: '#f3dfb4',
  leaf: '#5e9a4c',
  leafLight: '#86b35a',
  leafDark: '#3e7545',
  cypress: '#3b6a45',
  trunk: '#7a5a3e',
  wood: '#b98a55',
  woodDark: '#8a633d',
  terracotta: '#c8653e',
  pot: '#c47a50',
  metal: '#7c8890',
  metalLight: '#b7bfc4',
  gold: '#d9aa45',
  coral: '#e2836a',
  teal: '#5f9aa6',
  rock: '#d8ccb2',
} as const

export function Bx({ c, b, o = 0.03, e, r, material }: { c: string; b: Bounds; o?: number; e?: boolean; r?: V3; material?: THREE.Material }) {
  const [x0, x1, y0, y1, z0, z1] = b
  return (
    <Toon
      geometry={geo.box}
      color={c}
      material={material}
      position={[(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]}
      scale={[x1 - x0, y1 - y0, z1 - z0]}
      rotation={r}
      outline={o}
      edges={e}
    />
  )
}

const texCache = new Map<string, THREE.CanvasTexture>()
/** Cached canvas texture; `draw` receives a context sized w×h pixels. */
export function canvasTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  let t = texCache.get(key)
  if (!t) {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    draw(c.getContext('2d')!)
    t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    texCache.set(key, t)
  }
  return t
}

interface TextOpts {
  fg: string
  bg?: string
  border?: string
  weight?: number
  font?: string
  stroke?: string
  align?: CanvasTextAlign
}

/** Multi-line lettering texture; lines share the vertical space evenly. */
export function textTex(lines: string[], w: number, h: number, o: TextOpts) {
  return canvasTex(`t:${lines.join('|')}:${w}:${h}:${JSON.stringify(o)}`, w, h, (g) => {
    if (o.bg) {
      g.fillStyle = o.bg
      g.fillRect(0, 0, w, h)
    }
    if (o.border) {
      g.strokeStyle = o.border
      g.lineWidth = h * 0.06
      g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth)
    }
    const lh = h / lines.length
    const face = o.font ?? '"Trebuchet MS", "Arial Black", Arial, sans-serif'
    const pad = o.border ? h * 0.14 : h * 0.04
    lines.forEach((line, i) => {
      let size = lh * 0.78
      g.font = `${o.weight ?? 800} ${size}px ${face}`
      while (g.measureText(line).width > w - pad * 2 && size > 8) {
        size -= 2
        g.font = `${o.weight ?? 800} ${size}px ${face}`
      }
      g.textAlign = o.align ?? 'center'
      g.textBaseline = 'middle'
      const x = o.align === 'left' ? pad : o.align === 'right' ? w - pad : w / 2
      const y = lh * i + lh / 2 + size * 0.04
      if (o.stroke) {
        g.lineWidth = size * 0.12
        g.strokeStyle = o.stroke
        g.lineJoin = 'round'
        g.strokeText(line, x, y)
      }
      g.fillStyle = o.fg
      g.fillText(line, x, y)
    })
  })
}

/** Flat textured quad facing +Z. */
export function Decal({ tex, p, w, h, r }: { tex: THREE.Texture; p: V3; w: number; h: number; r?: V3 }) {
  const lift = useStrokeBuild() ? 0.045 : 0
  return (
    <group position={p} rotation={r}>
      <mesh position={[0, 0, lift]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} />
      </mesh>
    </group>
  )
}

export const glassMaterial = (() => {
  const m = toonMaterial(PAL.glass).clone()
  m.transparent = true
  m.opacity = 0.38
  m.depthWrite = false
  return m
})()

const gridCache = new Map<string, THREE.CanvasTexture>()
function mullionTex(cols: number, rows: number, color: string) {
  const key = `${cols}:${rows}:${color}`
  let t = gridCache.get(key)
  if (!t) {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 256
    const g = c.getContext('2d')!
    g.strokeStyle = color
    g.lineWidth = 7
    for (let i = 1; i < cols; i++) {
      g.beginPath()
      g.moveTo((i * 256) / cols, 0)
      g.lineTo((i * 256) / cols, 256)
      g.stroke()
    }
    for (let j = 1; j < rows; j++) {
      g.beginPath()
      g.moveTo(0, (j * 256) / rows)
      g.lineTo(256, (j * 256) / rows)
      g.stroke()
    }
    t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    gridCache.set(key, t)
  }
  return t
}

/**
 * Framed window facing +Z centred on `p`. `solid` paints an opaque glass tint (for panes on solid walls);
 * otherwise the pane is see-through into a recess.
 */
function mullionStrokes(w: number, h: number, cols: number, rows: number, frame: string) {
  return painted(`mullion:${w.toFixed(2)}:${h.toFixed(2)}:${cols}:${rows}:${frame}`, (r) => {
    const out: Stroke[] = []
    const ramp = rampFor(frame)
    const pal = [...ramp.mid, ...ramp.dark.slice(0, 1)]
    const line = (x0: number, y0: number, x1: number, y1: number) => {
      const L = Math.hypot(x1 - x0, y1 - y0)
      const n = Math.max(1, Math.round(L / 0.16))
      const a = Math.atan2(y1 - y0, x1 - x0)
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n
        out.push(dab(x0 + (x1 - x0) * t + (r() - 0.5) * 0.008, y0 + (y1 - y0) * t + (r() - 0.5) * 0.008, 0.002 + r() * 0.003, a + (r() - 0.5) * 0.08, (L / n) * 1.25, 0.035 + r() * 0.012, pick(r, pal)))
      }
    }
    for (let i = 1; i < cols; i++) line(-w / 2 + (w * i) / cols, -h / 2, -w / 2 + (w * i) / cols, h / 2)
    for (let j = 1; j < rows; j++) line(-w / 2, -h / 2 + (h * j) / rows, w / 2, -h / 2 + (h * j) / rows)
    return out
  })
}

export function Pane({ p, w, h, cols = 2, rows = 1, frame = PAL.navy, solid = false, r }: { p: V3; w: number; h: number; cols?: number; rows?: number; frame?: string; solid?: boolean; r?: V3 }) {
  const grid = mullionTex(cols, rows, frame)
  const brushed = useStrokeBuild() !== null
  const t = 0.08
  return (
    <group position={p} rotation={r}>
      {solid ? (
        <Toon geometry={geo.box} color="#8fb8c4" scale={[w, h, 0.02]} outline={0} edges={false} />
      ) : (
        <mesh material={glassMaterial} scale={[w, h, 1]}>
          <planeGeometry />
        </mesh>
      )}
      {brushed ? (
        <StrokePaint strokes={mullionStrokes(w, h, cols, rows, frame)} position={[0, 0, 0.03]} />
      ) : (
        <mesh position={[0, 0, 0.012]}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial map={grid} transparent toneMapped={false} />
        </mesh>
      )}
      <Bx c={frame} b={[-w / 2 - t, w / 2 + t, h / 2, h / 2 + t, -0.04, 0.05]} o={0} />
      <Bx c={frame} b={[-w / 2 - t, w / 2 + t, -h / 2 - t, -h / 2, -0.04, 0.05]} o={0} />
      <Bx c={frame} b={[-w / 2 - t, -w / 2, -h / 2, h / 2, -0.04, 0.05]} o={0} />
      <Bx c={frame} b={[w / 2, w / 2 + t, -h / 2, h / 2, -0.04, 0.05]} o={0} />
    </group>
  )
}

export function Bush({ p, s = 0.6, c = PAL.leaf }: { p: V3; s?: number; c?: string }) {
  return (
    <group position={p}>
      <Toon geometry={geo.ico} color={c} scale={[s * 1.2, s, s * 1.1]} outline={0.025} radial={false} />
      <Toon geometry={geo.ico} color={PAL.leafLight} position={[s * 0.35, s * 0.25, s * 0.2]} scale={s * 0.7} outline={0.02} radial={false} />
    </group>
  )
}

export function Planter({ p, w = 1.2, d = 0.6, h = 0.5, c = PAL.stone, plant = PAL.leaf, flowers }: { p: V3; w?: number; d?: number; h?: number; c?: string; plant?: string; flowers?: string }) {
  const n = Math.max(1, Math.round(w / 0.55))
  return (
    <group position={p}>
      <Bx c={c} b={[-w / 2, w / 2, 0, h, -d / 2, d / 2]} o={0.025} />
      {Array.from({ length: n }, (_, i) => (
        <Bush key={i} p={[(i - (n - 1) / 2) * (w / n), h + 0.15, 0]} s={Math.min(0.55, d * 0.85)} c={plant} />
      ))}
      {flowers &&
        Array.from({ length: n * 2 }, (_, i) => (
          <Toon key={`f${i}`} geometry={geo.sphere} color={flowers} position={[(i / (n * 2) - 0.45) * w, h + 0.32 + (i % 2) * 0.12, (i % 3) * 0.12 - 0.1]} scale={0.1} outline={0} />
        ))}
    </group>
  )
}

export function Pot({ p, s = 1, tree }: { p: V3; s?: number; tree?: boolean }) {
  return (
    <group position={p} scale={s}>
      <Toon geometry={geo.cyl} color={PAL.pot} position={[0, 0.2, 0]} scale={[0.45, 0.4, 0.45]} outline={0.02} />
      {tree ? (
        <>
          <Toon geometry={geo.cyl} color={PAL.trunk} position={[0, 0.7, 0]} scale={[0.06, 0.7, 0.06]} outline={0} />
          <Toon geometry={geo.ico} color={PAL.leaf} position={[0, 1.2, 0]} scale={[0.7, 0.6, 0.7]} outline={0.02} radial={false} />
        </>
      ) : (
        <Bush p={[0, 0.5, 0]} s={0.35} />
      )}
    </group>
  )
}

export function Cypress({ p, h = 2.6 }: { p: V3; h?: number }) {
  return (
    <group position={p}>
      <Toon geometry={geo.cyl} color={PAL.trunk} position={[0, 0.2, 0]} scale={[0.1, 0.4, 0.1]} outline={0} />
      <Toon geometry={geo.sphere} color={PAL.cypress} position={[0, h * 0.42, 0]} scale={[0.5, h * 0.8, 0.5]} outline={0.025} radial={false} />
      <Toon geometry={geo.cone} color={PAL.cypress} position={[0, h * 0.85, 0]} scale={[0.4, h * 0.35, 0.4]} outline={0.02} />
    </group>
  )
}

export function Tree({ p, s = 1 }: { p: V3; s?: number }) {
  return (
    <group position={p} scale={s}>
      <Toon geometry={geo.cyl} color={PAL.trunk} position={[0, 0.8, 0]} scale={[0.16, 1.6, 0.16]} outline={0.02} />
      <Toon geometry={geo.ico} color={PAL.leaf} position={[0, 1.9, 0]} scale={[1.6, 1.2, 1.5]} outline={0.03} radial={false} />
      <Toon geometry={geo.ico} color={PAL.leafLight} position={[0.4, 2.3, 0.2]} scale={[0.9, 0.8, 0.9]} outline={0.025} radial={false} />
    </group>
  )
}

export function Rock({ p, s = 0.8 }: { p: V3; s?: number }) {
  return <Toon geometry={geo.ico} color={PAL.rock} position={p} scale={[s * 1.3, s * 0.8, s]} outline={0.03} radial={false} />
}

/** Hanging vine strands down a wall face (facing +Z) starting at top `p`. */
export function Vines({ p, w = 0.8, len = 1.2 }: { p: V3; w?: number; len?: number }) {
  const strands = Math.max(2, Math.round(w / 0.25))
  return (
    <group position={p}>
      {Array.from({ length: strands }, (_, i) => {
        const l = len * (0.55 + ((i * 37) % 10) / 22)
        return (
          <group key={i} position={[(i / (strands - 1) - 0.5) * w, 0, 0]}>
            {Array.from({ length: Math.ceil(l / 0.22) }, (_, k) => (
              <Toon key={k} geometry={geo.ico} color={k % 2 ? PAL.leafLight : PAL.leaf} position={[((k * 13) % 3) * 0.03 - 0.03, -k * 0.22, 0]} scale={0.2} outline={0} radial={false} />
            ))}
          </group>
        )
      })}
    </group>
  )
}

/** Wall-mounted gooseneck lamp facing +Z. */
export function WallLamp({ p, c = PAL.navy }: { p: V3; c?: string }) {
  return (
    <group position={p}>
      <Bx c={c} b={[-0.03, 0.03, -0.05, 0.25, 0, 0.3]} o={0} />
      <Toon geometry={geo.dome} color={c} position={[0, -0.1, 0.32]} rotation={[0, 0, 0]} scale={[0.3, 0.2, 0.3]} outline={0.015} radial={false} />
      <mesh position={[0, -0.12, 0.32]}>
        <sphereGeometry args={[0.07, 8, 6]} />
        <meshBasicMaterial color="#ffe6a0" toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Railing between points on the XZ plane at base height `y`. */
export function Rail({ pts, y, h = 0.55, c = PAL.navyDark, spacing = 0.7 }: { pts: [number, number][]; y: number; h?: number; c?: string; spacing?: number }) {
  const parts = useMemo(() => {
    const out: { p: V3; len: number; yaw: number; posts: V3[] }[] = []
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i]
      const [bx, bz] = pts[i + 1]
      const len = Math.hypot(bx - ax, bz - az)
      const n = Math.max(1, Math.round(len / spacing))
      const posts: V3[] = []
      for (let k = 0; k <= n; k++) posts.push([ax + ((bx - ax) * k) / n, y + h / 2, az + ((bz - az) * k) / n])
      out.push({ p: [(ax + bx) / 2, y + h, (az + bz) / 2], len, yaw: Math.atan2(bx - ax, bz - az), posts })
    }
    return out
  }, [pts, y, h, spacing])
  return (
    <>
      {parts.map((s, i) => (
        <group key={i}>
          <Toon geometry={geo.box} color={c} position={s.p} rotation={[0, s.yaw, 0]} scale={[0.06, 0.06, s.len + 0.06]} outline={0} />
          <Toon geometry={geo.box} color={c} position={[s.p[0], y + h * 0.5, s.p[2]]} rotation={[0, s.yaw, 0]} scale={[0.035, 0.035, s.len]} outline={0} />
          {s.posts.map((q, k) => (
            <Toon key={k} geometry={geo.cyl} color={c} position={q} scale={[0.05, h, 0.05]} outline={0} />
          ))}
        </group>
      ))}
    </>
  )
}

export function Bench({ p, yaw = 0, w = 1.4 }: { p: V3; yaw?: number; w?: number }) {
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      <Bx c={PAL.wood} b={[-w / 2, w / 2, 0.38, 0.48, -0.22, 0.22]} o={0.02} />
      <Bx c={PAL.stone} b={[-w / 2 + 0.05, -w / 2 + 0.25, 0, 0.38, -0.2, 0.2]} o={0.015} />
      <Bx c={PAL.stone} b={[w / 2 - 0.25, w / 2 - 0.05, 0, 0.38, -0.2, 0.2]} o={0.015} />
    </group>
  )
}

/** Solid steps descending toward +Z from `z0`; the top step is `n * rise` high. */
export function Steps({ x, z0, n, rise = 0.18, run = 0.32, c = PAL.stone }: { x: [number, number]; z0: number; n: number; rise?: number; run?: number; c?: string }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <Bx key={i} c={c} b={[x[0], x[1], -0.4, (n - i) * rise, z0, z0 + (i + 1) * run]} o={0.02} />
      ))}
    </>
  )
}

/** Extruded house section: rectangular walls of height `h` with a gable of `ridge` height, profile in XY, depth along Z. */
const gableCache = new Map<string, THREE.ExtrudeGeometry>()
export function gableGeo(w: number, h: number, ridge: number, d: number) {
  const key = `${w}:${h}:${ridge}:${d}`
  let g = gableCache.get(key)
  if (!g) {
    const s = new THREE.Shape()
    s.moveTo(-w / 2, -0.4)
    s.lineTo(w / 2, -0.4)
    s.lineTo(w / 2, h)
    s.lineTo(0, h + ridge)
    s.lineTo(-w / 2, h)
    s.closePath()
    g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false })
    g.translate(0, 0, -d / 2)
    gableCache.set(key, g)
  }
  return g
}

/** Pitched roof over a gable section (ridge along Z) with timber fascia boards. */
export function GableRoof({ w, h, ridge, d, over = 0.35, c = '#8f99a4', trim = PAL.wood }: { w: number; h: number; ridge: number; d: number; over?: number; c?: string; trim?: string }) {
  const ang = Math.atan2(ridge, w / 2)
  const len = Math.hypot(w / 2, ridge) + over
  return (
    <>
      {[-1, 1].map((sd) => (
        <group key={sd} position={[(sd * w) / 4, h + ridge / 2, 0]} rotation={[0, 0, -sd * ang]}>
          <Toon geometry={geo.box} color={c} position={[(sd * over) / 2, 0.1, 0]} scale={[len, 0.14, d + over * 1.6]} outline={0.03} />
          <Toon geometry={geo.box} color={trim} position={[(sd * over) / 2, -0.02, (d + over * 1.6) / 2]} scale={[len, 0.22, 0.1]} outline={0.015} />
          <Toon geometry={geo.box} color={trim} position={[(sd * over) / 2, -0.02, -(d + over * 1.6) / 2]} scale={[len, 0.22, 0.1]} outline={0.015} />
        </group>
      ))}
      <Toon geometry={geo.box} color="#6f7a85" position={[0, h + ridge + 0.14, 0]} scale={[0.22, 0.12, d + over * 1.6]} outline={0.015} />
    </>
  )
}
