import { useMemo } from 'react'
import * as THREE from 'three'
import { type Stroke, StrokePaint, pick, rng, useStrokeBuild } from '../world/strokes'
import { Toon, geo } from '../world/toon'
import {
  Bench,
  Bush,
  Bx,
  Cypress,
  Decal,
  GableRoof,
  PAL,
  Pane,
  Planter,
  Pot,
  Rail,
  Rock,
  Steps,
  Tree,
  Vines,
  WallLamp,
  canvasTex,
  gableGeo,
  textTex,
} from './parts'

const torusGeo = new THREE.TorusGeometry(0.42, 0.2, 10, 24)
const ribGeo = new THREE.TorusGeometry(1, 0.025, 4, 24, Math.PI)
const halfDisc = new THREE.CylinderGeometry(0.5, 0.5, 1, 20, 1, false, -Math.PI / 2, Math.PI)

function paintingTex(seed: number) {
  return canvasTex(`paint:${seed}`, 96, 128, (g) => {
    g.fillStyle = '#f4efe2'
    g.fillRect(0, 0, 96, 128)
    const cols = ['#e2836a', '#5f9aa6', '#e7b957', '#2f4a78']
    g.fillStyle = cols[seed % 4]
    g.beginPath()
    g.ellipse(48, 50 + (seed % 3) * 10, 30, 22, seed, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = cols[(seed + 1) % 4]
    g.beginPath()
    g.moveTo(0, 128)
    g.quadraticCurveTo(40, 60 + seed * 7, 96, 100)
    g.lineTo(96, 128)
    g.fill()
    g.strokeStyle = '#2f4a78'
    g.lineWidth = 6
    g.strokeRect(3, 3, 90, 122)
  })
}

function Artwork({ p, seed, s = 1, r }: { p: [number, number, number]; seed: number; s?: number; r?: [number, number, number] }) {
  return <Decal tex={paintingTex(seed)} p={p} w={0.55 * s} h={0.73 * s} r={r} />
}

/* ------------------------------------------------------------------ */
/* BRAND & CREATIVE MUSEUM — U-shaped courtyard gallery behind a portal */

export function CreativeMuseum({ name }: { name: string }) {
  const title = useMemo(() => {
    const words = name.split(' ')
    const last = words.length > 1 ? words.pop()! : ''
    return textTex(last ? [words.join(' '), last] : [name], 512, 180, { fg: PAL.navy, weight: 800 })
  }, [name])
  const bc = textTex(['B+C'], 256, 160, { fg: PAL.coral, stroke: PAL.navy, weight: 900 })
  const W = PAL.cream
  const roof = (b: [number, number, number, number]) => (
    <>
      <Bx c={PAL.roofSlate} b={[b[0] + 0.12, b[1] - 0.12, b[3] - 0.02, b[3] + 0.04, b[2] + 0.12, 0]} o={0} />
    </>
  )
  return (
    <group>
      {/* paving */}
      <Bx c="#efe9dc" b={[-3.8, 3.8, -0.4, 0.12, -3.2, 3.4]} o={0.03} />
      {/* left wing */}
      <Bx c={W} b={[-3.7, -2.0, 0.1, 2.9, -3.0, 1.8]} o={0.06} />
      <Bx c={PAL.roofSlate} b={[-3.55, -2.15, 2.9, 2.96, -2.85, 1.65]} o={0} />
      <Pane p={[-2.85, 1.25, 1.81]} w={1.4} h={1.9} cols={2} solid />
      <Artwork p={[-3.2, 1.35, 1.84]} seed={0} />
      <Artwork p={[-2.5, 1.2, 1.84]} seed={1} s={0.8} />
      <Pane p={[-1.99, 1.25, 0.1]} w={2.8} h={1.9} cols={4} solid r={[0, Math.PI / 2, 0]} />
      <Artwork p={[-1.96, 1.4, -0.6]} seed={2} r={[0, Math.PI / 2, 0]} />
      <Artwork p={[-1.96, 1.4, 0.8]} seed={3} r={[0, Math.PI / 2, 0]} />
      {/* right wing, projecting further forward */}
      <Bx c={W} b={[2.0, 3.7, 0.1, 3.15, -3.0, 2.5]} o={0.06} />
      <Bx c={PAL.roofSlate} b={[2.15, 3.55, 3.15, 3.21, -2.85, 2.35]} o={0} />
      <Bx c={W} b={[2.0, 3.7, 0.1, 0.35, 2.5, 3.0]} o={0.02} />
      <Pane p={[2.85, 1.3, 2.51]} w={1.4} h={2.0} cols={2} solid />
      <Artwork p={[3.2, 1.4, 2.54]} seed={1} />
      <Toon geometry={geo.sphere} color="#cfc8b8" position={[2.5, 1.0, 2.55]} scale={[0.22, 0.6, 0.18]} outline={0.015} radial={false} />
      <Bx c={PAL.stone} b={[2.35, 2.65, 0.3, 0.7, 2.45, 2.65]} o={0.01} />
      <Pane p={[1.99, 1.3, 0.2]} w={2.8} h={2.0} cols={4} solid r={[0, -Math.PI / 2, 0]} />
      <Artwork p={[1.96, 1.4, 0.4]} seed={3} r={[0, -Math.PI / 2, 0]} />
      {/* back wing with colonnade facing the courtyard */}
      <Bx c={W} b={[-2.0, 2.0, 0.1, 2.7, -3.0, -1.7]} o={0.05} />
      <Bx c={PAL.roofSlate} b={[-1.9, 1.9, 2.7, 2.76, -2.9, -1.6]} o={0} />
      <Bx c={W} b={[-2.0, 2.0, 2.45, 2.7, -1.7, -1.1]} o={0.02} />
      <Pane p={[0, 1.2, -1.69]} w={3.6} h={1.9} cols={5} solid />
      {[-1.5, 1.5].map((x, i) => (
        <Artwork key={x} p={[x * 0.55, 1.3, -1.66]} seed={i + 2} />
      ))}
      {[-1.8, -0.6, 0.6, 1.8].map((x) => (
        <Toon key={x} geometry={geo.cyl} color={W} position={[x, 1.3, -1.2]} scale={[0.14, 2.4, 0.14]} outline={0.015} />
      ))}
      {roof([0, 0, 0, 0])}
      {/* courtyard: sculpture, tree, bench, planters */}
      <Bx c="#f4f0e6" b={[-2.0, 2.0, 0.12, 0.14, -1.7, 2.4]} o={0} />
      <Bx c="#d8d0bf" b={[-0.7, 0.7, 0.14, 0.2, -0.3, 1.0]} o={0.015} />
      <Bx c={PAL.stone} b={[-0.35, 0.35, 0.2, 0.5, 0.05, 0.65]} o={0.02} />
      <Toon geometry={torusGeo} color="#e7e2d6" position={[0, 1.05, 0.35]} scale={[0.9, 1.2, 0.9]} outline={0.03} radial={false} />
      <Tree p={[0.9, 0.12, -0.6]} s={0.8} />
      <Bench p={[-1.1, 0.12, 0.9]} yaw={0.4} w={1.0} />
      <Planter p={[-1.5, 0.12, -1.0]} w={0.6} d={0.5} />
      <Planter p={[1.5, 0.12, 1.4]} w={0.6} d={0.5} />
      {/* entrance portal */}
      <Bx c={W} b={[-1.95, -0.9, 0.12, 3.55, 2.3, 2.85]} o={0.05} />
      <Bx c={W} b={[0.9, 1.95, 0.12, 3.55, 2.3, 2.85]} o={0.05} />
      <Bx c={W} b={[-0.9, 0.9, 2.5, 3.55, 2.3, 2.85]} o={0.04} />
      <Decal tex={title} p={[0, 3.05, 2.86]} w={2.9} h={1.0} />
      <Bx c={PAL.coral} b={[-1.7, -1.15, 0.5, 2.1, 2.85, 2.87]} o={0} />
      <Bx c={PAL.teal} b={[1.15, 1.7, 0.5, 2.1, 2.85, 2.87]} o={0} />
      <Decal tex={bc} p={[1.96, 1.4, 2.55]} w={0.8} h={0.5} r={[0, Math.PI / 2, 0]} />
      <WallLamp p={[-1.4, 2.35, 2.86]} />
      <WallLamp p={[1.4, 2.35, 2.86]} />
      <Steps x={[-1.2, 1.2]} z0={2.85} n={2} rise={0.07} run={0.3} c="#ebe4d4" />
      {/* planting */}
      <Planter p={[-2.9, 0.12, 2.5]} w={1.4} d={0.7} />
      <Planter p={[-0.9, 0.12, 3.15]} w={0.9} d={0.5} />
      <Planter p={[1.35, 0.12, 3.15]} w={0.6} d={0.5} />
      <Planter p={[2.85, 0.12, 3.25]} w={1.5} d={0.5} />
      <Tree p={[-1.4, 0.6, 3.15]} s={0.45} />
      <Tree p={[1.35, 0.6, 3.15]} s={0.4} />
      <Cypress p={[-3.8, 0.12, 1.6]} h={2.8} />
      <Cypress p={[3.85, 0.12, 2.9]} h={2.8} />
      <Cypress p={[3.85, 0.12, -0.6]} h={2.4} />
      <Bush p={[-3.5, 0.3, 2.9]} s={0.5} c={PAL.leafDark} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* MARC CINEMA — Art Deco stepped tower, rounded drum, lit marquee     */

function marqueeTex(name: string) {
  return canvasTex(`marquee:${name}`, 640, 160, (g) => {
    g.fillStyle = '#f3ecd9'
    g.fillRect(0, 0, 640, 160)
    for (let y = 70; y < 160; y += 18) {
      g.fillStyle = '#e4dcc6'
      g.fillRect(0, y, 640, 2)
    }
    g.fillStyle = '#b8483b'
    g.fillRect(0, 0, 640, 58)
    g.font = '800 42px "Trebuchet MS", Arial, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = '#fbf3e4'
    g.fillText(name, 320, 31)
    g.fillStyle = '#2b3a4d'
    g.font = '800 34px "Courier New", monospace'
    g.fillText('GOOD STORIES', 320, 88)
    g.fillText('BRIGHTER PEOPLE', 320, 132)
  })
}

function posterTex(kind: 'sun' | 'sail') {
  return canvasTex(`poster:${kind}`, 96, 144, (g) => {
    g.fillStyle = '#f5ecdc'
    g.fillRect(0, 0, 96, 144)
    g.fillStyle = '#3c6fae'
    g.fillRect(0, 84, 96, 60)
    if (kind === 'sun') {
      g.fillStyle = '#e8715a'
      g.beginPath()
      g.arc(48, 62, 22, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#5b8fc8'
      g.beginPath()
      g.moveTo(0, 110)
      g.quadraticCurveTo(30, 70, 70, 100)
      g.lineTo(96, 144)
      g.lineTo(0, 144)
      g.fill()
    } else {
      g.fillStyle = '#e8715a'
      g.beginPath()
      g.moveTo(50, 20)
      g.lineTo(50, 84)
      g.lineTo(22, 84)
      g.fill()
      g.fillStyle = '#b8483b'
      g.fillRect(24, 86, 50, 8)
    }
    g.strokeStyle = '#2f4a78'
    g.lineWidth = 8
    g.strokeRect(4, 4, 88, 136)
  })
}

export function Cinema({ name }: { name: string }) {
  const W = PAL.cream
  const N = PAL.navy
  const marquee = marqueeTex(name)
  const mc = textTex(['MC'], 128, 96, { fg: '#56606a', weight: 800 })
  const fins: [number, number, number][] = [
    [0, 0.9, 3.3],
    [-0.72, 0.5, 2.5],
    [0.72, 0.5, 2.5],
    [-1.18, 0.42, 1.8],
    [1.18, 0.42, 1.8],
    [-1.6, 0.4, 1.1],
    [1.6, 0.4, 1.1],
  ]
  const drumWindows = [-0.9, -0.45, 0, 0.45, 0.9]
  return (
    <group>
      <Bx c="#ece5d4" b={[-3.8, 3.8, -0.4, 0.1, -3.1, 3.7]} o={0.03} />
      {/* side wings */}
      <Bx c={W} b={[-3.5, -1.9, 0.1, 3.2, -2.7, 2.2]} o={0.06} />
      <Bx c={N} b={[-3.55, -1.85, 3.2, 3.32, -2.75, 2.25]} o={0.015} />
      <Bx c={W} b={[1.9, 3.3, 0.1, 3.0, -2.7, 2.2]} o={0.06} />
      <Bx c={N} b={[1.85, 3.35, 3.0, 3.12, -2.75, 2.25]} o={0.015} />
      {[-3.2, -2.3].map((x) => (
        <Bx key={x} c={N} b={[x - 0.08, x + 0.08, 0.9, 2.2, 2.2, 2.23]} o={0} />
      ))}
      {[2.3, 3.0].map((x) => (
        <Bx key={x} c={N} b={[x - 0.08, x + 0.08, 0.9, 2.2, 2.2, 2.23]} o={0} />
      ))}
      <Bx c="#7d8893" b={[-3.3, -2.5, 3.32, 3.9, -2.2, -1.2]} o={0.02} />
      <Bx c="#7d8893" b={[2.2, 3.0, 3.12, 3.7, -2.0, -1.0]} o={0.02} />
      <Rail pts={[[-3.45, 2.1], [-3.45, -2.6], [-1.95, -2.6]]} y={3.32} h={0.45} />
      <Rail pts={[[3.25, 2.1], [3.25, -2.6], [1.95, -2.6]]} y={3.12} h={0.45} />
      <Vines p={[-2.4, 3.2, 2.24]} w={0.6} len={1.4} />
      <Vines p={[3.0, 3.0, 2.24]} w={0.5} len={1.2} />
      {/* central mass */}
      <Bx c={W} b={[-2.4, 2.4, 0.1, 4.6, -2.8, 1.0]} o={0.06} />
      <Bx c={N} b={[-2.45, 2.45, 4.6, 4.7, -2.85, 1.0]} o={0.015} />
      <Toon geometry={geo.cyl} color={W} position={[0, 4.2, 0.6]} scale={[4, 3.2, 4]} outline={0.06} />
      <Toon geometry={geo.cyl} color={N} position={[0, 5.86, 0.6]} scale={[4.15, 0.16, 4.15]} outline={0.02} />
      {drumWindows.map((a) => (
        <group key={a} position={[2.01 * Math.sin(a), 4.85, 0.6 + 2.01 * Math.cos(a)]} rotation={[0, a, 0]}>
          <Pane p={[0, 0, 0]} w={0.38} h={1.5} cols={1} rows={3} solid />
        </group>
      ))}
      {/* stepped Art Deco crown */}
      {fins.map(([x, w, h]) => (
        <group key={x}>
          <Bx c={W} b={[x - w / 2, x + w / 2, 5.9, 5.9 + h, -0.4, 0.9]} o={0.04} />
          <Bx c={N} b={[x - w / 2 - 0.03, x + w / 2 + 0.03, 5.9 + h, 5.98 + h, -0.43, 0.93]} o={0} />
        </group>
      ))}
      <Decal tex={mc} p={[0, 8.35, 0.91]} w={0.6} h={0.45} />
      <Pane p={[0, 7.3, 0.91]} w={0.35} h={1.0} cols={1} rows={2} solid />
      {/* marquee */}
      <Bx c={W} b={[-2.8, 2.8, 2.6, 3.95, 2.2, 3.15]} o={0.04} />
      <Bx c={N} b={[-2.85, 2.85, 3.95, 4.05, 2.15, 3.2]} o={0.015} />
      <Bx c={N} b={[-2.9, 2.9, 2.5, 2.62, 2.15, 3.3]} o={0.015} />
      <Decal tex={marquee} p={[0, 3.28, 3.16]} w={5.2} h={1.3} />
      {Array.from({ length: 11 }, (_, i) => (
        <mesh key={i} position={[-2.5 + i * 0.5, 2.48, 3.15]}>
          <sphereGeometry args={[0.07, 8, 6]} />
          <meshBasicMaterial color="#ffd978" toneMapped={false} />
        </mesh>
      ))}
      {/* lobby: recessed glazing, doors, posters */}
      <Bx c={W} b={[-1.9, -1.15, 0.1, 2.6, 1.0, 2.2]} o={0.04} />
      <Bx c={W} b={[1.15, 1.9, 0.1, 2.6, 1.0, 2.2]} o={0.04} />
      <Bx c="#f5e6c4" b={[-1.15, 1.15, 0.1, 2.5, 0.95, 1.05]} o={0} />
      <Bx c="#e9dfca" b={[-1.15, 1.15, 2.4, 2.6, 1.0, 2.2]} o={0} />
      <Pot p={[-0.8, 0.1, 1.3]} s={0.7} />
      <Pot p={[0.8, 0.1, 1.3]} s={0.7} />
      <Pane p={[0, 1.2, 2.1]} w={2.25} h={2.2} cols={4} rows={2} />
      <Bx c={N} b={[-0.45, 0.45, 0.1, 1.9, 2.08, 2.16]} o={0} />
      <Bx c="#9cc5cf" b={[-0.4, -0.03, 0.2, 1.8, 2.16, 2.17]} o={0} />
      <Bx c="#9cc5cf" b={[0.03, 0.4, 0.2, 1.8, 2.16, 2.17]} o={0} />
      <Bx c={PAL.gold} b={[-0.12, -0.08, 0.8, 1.2, 2.17, 2.22]} o={0} />
      <Bx c={PAL.gold} b={[0.08, 0.12, 0.8, 1.2, 2.17, 2.22]} o={0} />
      {[-1.52, 1.52].map((x, i) => (
        <group key={x}>
          <Bx c={N} b={[x - 0.32, x + 0.32, 0.55, 1.85, 2.2, 2.24]} o={0} />
          <Decal tex={posterTex(i ? 'sail' : 'sun')} p={[x, 1.2, 2.25]} w={0.54} h={1.18} />
        </group>
      ))}
      {/* planting */}
      <Planter p={[-2.8, 0.1, 2.75]} w={1.3} d={0.6} flowers={PAL.coral} />
      <Planter p={[2.7, 0.1, 2.75]} w={1.1} d={0.6} flowers="#f4efe0" />
      <Planter p={[-1.55, 0.1, 2.75]} w={0.5} d={0.4} />
      <Planter p={[1.55, 0.1, 2.75]} w={0.5} d={0.4} />
      <Cypress p={[-3.2, 0.1, 3.3]} h={2.0} />
      <Cypress p={[-2.3, 0.1, 3.35]} h={2.4} />
      <Cypress p={[2.4, 0.1, 3.35]} h={2.3} />
      <Tree p={[-3.9, 0.1, 1.2]} s={0.8} />
      <Tree p={[3.8, 0.1, 0.8]} s={0.75} />
      <Bush p={[3.4, 0.35, 3.3]} s={0.45} c={PAL.leafDark} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* EXPERIMENT LAB — industrial cream box with rooftop plant & side yard */

function Palm({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      {Array.from({ length: 8 }, (_, i) => (
        <group key={i} rotation={[0, (i / 8) * Math.PI * 2, 0]}>
          <Toon geometry={geo.box} color={i % 2 ? PAL.leaf : PAL.leafDark} position={[0, 0.35, 0.45]} rotation={[0.35 + (i % 3) * 0.15, 0, 0]} scale={[0.26, 0.03, 1.1]} outline={0.01} />
        </group>
      ))}
      <Toon geometry={geo.ico} color={PAL.leafDark} scale={[0.6, 0.4, 0.6]} outline={0.02} radial={false} />
    </group>
  )
}

function DeskScene({ p, w }: { p: [number, number, number]; w: number }) {
  return (
    <group position={p}>
      <Bx c={PAL.wood} b={[-w / 2, w / 2, 0.75, 0.82, -0.3, 0.2]} o={0.01} />
      {[-w / 2 + 0.1, w / 2 - 0.1].map((x) => (
        <Bx key={x} c={PAL.metal} b={[x - 0.03, x + 0.03, 0, 0.75, -0.05, 0.05]} o={0} />
      ))}
      <Bx c="#dfe3df" b={[-w / 4 - 0.2, -w / 4 + 0.2, 0.82, 1.15, -0.2, -0.1]} o={0.01} />
      <Bx c="#4f7f95" b={[-w / 4 - 0.16, -w / 4 + 0.16, 0.86, 1.12, -0.095, -0.09]} o={0} />
      <Bx c="#dfe3df" b={[w / 4 - 0.18, w / 4 + 0.18, 0.82, 1.1, -0.2, -0.1]} o={0.01} />
      <Toon geometry={geo.cyl} color="#3d4a52" position={[0, 1.1, -0.1]} rotation={[0, 0, 0.6]} scale={[0.04, 0.6, 0.04]} outline={0} />
      <Bush p={[w / 2 - 0.2, 1.0, -0.15]} s={0.25} />
      <Bx c={PAL.woodDark} b={[-w / 2 + 0.1, -w / 2 + 0.5, 0, 0.45, 0.25, 0.55]} o={0.01} />
    </group>
  )
}

export function ExperimentLab({ name }: { name: string }) {
  const W = '#ece6d6'
  const N = '#28508c'
  const exp = textTex(['EXP.'], 320, 128, { fg: N, stroke: '#1b3560', weight: 900 })
  const motto = textTex(['PLAY TEST', 'FAIL LEARN', 'REPEAT'], 360, 240, { fg: '#40587a', weight: 800, align: 'left' })
  const sign = textTex([name], 512, 96, { fg: '#f1ecdf', bg: N, border: '#a9b7c8', weight: 700 })
  const P = '#646f78'
  return (
    <group>
      <Bx c="#b9bfc1" b={[-3.8, 3.9, -0.4, 0.12, -2.9, 3.2]} o={0.03} />
      {/* volumes */}
      <Bx c={W} b={[-3.5, -1.3, 0.12, 4.3, -2.6, 1.1]} o={0.06} />
      <Bx c={W} b={[-1.3, 3.2, 0.12, 3.5, -2.6, 1.1]} o={0.06} />
      <Bx c={W} b={[-3.5, -1.3, 2.4, 4.3, 1.1, 1.9]} o={0.05} />
      <Bx c={W} b={[-1.3, 3.2, 2.4, 3.5, 1.1, 1.9]} o={0.05} />
      {[
        [-3.5, -3.1],
        [-0.85, 0.85],
        [3.0, 3.2],
      ].map(([a, b]) => (
        <Bx key={a} c={W} b={[a, b, 0.12, 2.4, 1.1, 1.9]} o={0.03} />
      ))}
      <Bx c="#474f56" b={[-3.55, -1.25, 4.3, 4.38, -2.65, 1.95]} o={0} />
      <Bx c="#dcd5c3" b={[-1.3, 3.2, 3.2, 3.5, 1.9, 1.95]} o={0} />
      <Decal tex={exp} p={[-2.4, 3.25, 1.92]} w={2.0} h={0.8} />
      <Decal tex={motto} p={[2.0, 2.78, 1.92]} w={1.5} h={0.72} />
      <Decal tex={sign} p={[0, 2.85, 1.95]} w={1.7} h={0.32} />
      <WallLamp p={[0, 3.25, 1.92]} c="#3a4046" />
      {/* windows with benches & monitors visible */}
      <Bx c="#f1e3c1" b={[-3.1, -0.85, 0.3, 2.3, 1.1, 1.15]} o={0} />
      <Bx c="#f1e3c1" b={[0.85, 3.0, 0.3, 2.3, 1.1, 1.15]} o={0} />
      <Bx c={W} b={[-3.1, -0.85, 0.12, 0.3, 1.1, 1.9]} o={0} />
      <Bx c={W} b={[0.85, 3.0, 0.12, 0.3, 1.1, 1.9]} o={0} />
      <DeskScene p={[-1.95, 0.3, 1.5]} w={1.9} />
      <DeskScene p={[1.9, 0.3, 1.5]} w={1.8} />
      <Pane p={[-1.97, 1.3, 1.88]} w={2.2} h={2.0} cols={2} />
      <Pane p={[1.92, 1.3, 1.88]} w={2.1} h={2.0} cols={2} />
      {/* double door with transom */}
      <Bx c={N} b={[-0.6, 0.6, 0.12, 2.5, 1.9, 1.98]} o={0.02} />
      <Pane p={[0, 2.3, 1.99]} w={1.0} h={0.3} cols={1} solid />
      {[-0.28, 0.28].map((x) => (
        <group key={x}>
          <Bx c="#355f9c" b={[x - 0.26, x + 0.26, 0.2, 2.1, 1.98, 2.0]} o={0.01} />
          <Bx c="#7fa1b8" b={[x - 0.16, x + 0.16, 1.1, 1.9, 2.0, 2.01]} o={0} />
          <Bx c={PAL.gold} b={[x * 0.25 - 0.02, x * 0.25 + 0.02, 0.9, 1.3, 2.0, 2.05]} o={0} />
        </group>
      ))}
      {/* roof plant: pipe gantry, stacks, HVAC, railing, palm */}
      <Bx c={P} b={[1.2, 1.6, 3.5, 5.4, -2.2, -1.8]} o={0.02} />
      <Bx c={P} b={[2.7, 3.1, 3.5, 5.4, -2.2, -1.8]} o={0.02} />
      <Bx c={P} b={[1.1, 3.2, 5.0, 5.4, -2.25, -1.75]} o={0.02} />
      <Toon geometry={geo.cyl} color={P} position={[2.9, 4.3, -0.6]} scale={[0.14, 1.6, 0.14]} outline={0} />
      <Toon geometry={geo.cyl} color={P} position={[3.25, 2.0, -0.6]} scale={[0.14, 3.2, 0.14]} outline={0} />
      <Toon geometry={geo.cyl} color="#8a9197" position={[-0.6, 4.1, -0.8]} scale={[0.28, 1.2, 0.28]} outline={0.02} />
      <Toon geometry={geo.cyl} color="#8a9197" position={[-0.1, 3.95, -0.9]} scale={[0.26, 0.9, 0.26]} outline={0.02} />
      <Bx c="#c9ced0" b={[-1.2, -0.3, 3.5, 4.2, 0.2, 1.0]} o={0.02} />
      <Bx c="#6c757b" b={[-1.1, -0.4, 3.75, 4.05, 1.0, 1.02]} o={0} />
      <Rail pts={[[-1.1, 1.8], [3.1, 1.8], [3.1, -2.5]]} y={3.5} h={0.45} c="#3f474d" />
      <Palm p={[-2.4, 4.4, -0.4]} />
      <Vines p={[-3.3, 4.3, 1.92]} w={0.5} len={2.4} />
      <Vines p={[-1.5, 4.3, 1.92]} w={0.4} len={1.5} />
      {/* side services on the +x face */}
      <Toon geometry={geo.cyl} color="#6f7a82" position={[3.22, 1.8, 1.8]} scale={[0.1, 3.4, 0.1]} outline={0} />
      {[0.6, 1.0, 1.4, 1.8, 2.2, 2.6, 3.0].map((y) => (
        <Bx key={y} c="#5e676d" b={[3.24, 3.3, y - 0.02, y + 0.02, 0.9, 1.3]} o={0} />
      ))}
      <Bx c="#5e676d" b={[3.24, 3.3, 0.4, 3.4, 0.88, 0.92]} o={0} />
      <Bx c="#5e676d" b={[3.24, 3.3, 0.4, 3.4, 1.28, 1.32]} o={0} />
      <Bx c="#9aa2a6" b={[3.2, 3.5, 0.9, 1.6, -0.2, 0.4]} o={0.015} />
      <Bx c="#9aa2a6" b={[3.2, 3.45, 1.9, 2.4, -1.2, -0.7]} o={0.015} />
      <Bx c="#e6e8e4" b={[3.2, 3.55, 2.4, 2.9, 0.0, 0.6]} o={0.015} />
      <Rail pts={[[3.2, -0.3], [4.0, -0.3], [4.0, -2.5], [3.2, -2.5]]} y={0.12} h={1.4} c="#6f777b" spacing={0.55} />
      <Bx c="#3f6f62" b={[3.3, 3.95, 0.12, 1.0, -2.3, -1.4]} o={0.02} />
      <Bx c="#c9a77a" b={[3.35, 3.8, 0.12, 0.5, -1.2, -0.7]} o={0.015} />
      <Toon geometry={geo.cone} color="#e0703c" position={[3.7, 0.4, 0.3]} scale={[0.3, 0.55, 0.3]} outline={0.015} />
      {/* frontage */}
      <Planter p={[-3.0, 0.12, 2.4]} w={1.2} d={0.55} />
      <Tree p={[-3.6, 0.12, 2.3]} s={0.6} />
      <Bench p={[-1.3, 0.12, 2.5]} w={1.1} />
      <Pot p={[-2.1, 0.12, 2.6]} s={0.7} />
      <Pot p={[-0.8, 0.12, 2.6]} s={0.7} />
      <Planter p={[1.4, 0.12, 2.4]} w={1.6} d={0.5} flowers="#f4efe0" />
      <Pot p={[2.5, 0.12, 2.6]} s={0.7} />
      <Planter p={[3.0, 0.12, 2.5]} w={0.5} d={0.45} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* ARCADE — saturated blue two-storey with stair, pergola & big sign   */

function Cabinet({ p, c, screen = '#3b6fd0' }: { p: [number, number, number]; c: string; screen?: string }) {
  return (
    <group position={p}>
      <Bx c={c} b={[-0.25, 0.25, 0, 1.5, -0.25, 0.25]} o={0.015} />
      <Bx c="#1d2430" b={[-0.2, 0.2, 0.85, 1.25, 0.25, 0.27]} o={0} />
      <Bx c={screen} b={[-0.16, 0.16, 0.9, 1.2, 0.27, 0.28]} o={0} />
      <Bx c="#f2d25a" b={[-0.22, 0.22, 1.32, 1.45, 0.25, 0.27]} o={0} />
      <Bx c={c} b={[-0.25, 0.25, 0.68, 0.78, 0.25, 0.45]} o={0.01} />
    </group>
  )
}

export function Arcade({ name }: { name: string }) {
  const B = '#2a5bd0'
  const BD = '#2149a8'
  const N = '#1f2f55'
  const sign = textTex([name], 640, 160, { fg: '#f7d24a', bg: '#d4452f', border: '#f08a3a', stroke: '#6b1f16', weight: 900 })
  const play = canvasTex('arcade:play', 96, 160, (g) => {
    g.fillStyle = '#f6f3ea'
    g.fillRect(0, 0, 96, 160)
    g.fillStyle = '#f2b43b'
    g.beginPath()
    g.arc(48, 52, 26, Math.PI, 0)
    g.fill()
    g.fillStyle = '#3f8fd8'
    g.fillRect(0, 110, 96, 50)
    g.fillStyle = '#1f3f84'
    g.font = '900 30px Arial, sans-serif'
    g.textAlign = 'center'
    g.fillText('PLAY', 48, 96)
  })
  const my = textTex(['MY', 'GAME'], 96, 96, { fg: '#f1ecdf', bg: N, weight: 700 })
  const run = 0.26
  return (
    <group>
      <Bx c="#e9e3d4" b={[-3.8, 3.8, -0.4, 0.12, -2.8, 3.1]} o={0.03} />
      {/* shop box with recessed glazed ground floor */}
      <Bx c={B} b={[-1.2, 3.2, 0.12, 3.0, -2.4, 1.2]} o={0.06} />
      <Bx c={B} b={[-1.2, 3.2, 1.9, 3.0, 1.2, 2.2]} o={0.05} />
      <Bx c={B} b={[-1.2, -0.95, 0.12, 1.9, 1.2, 2.2]} o={0.03} />
      <Bx c={B} b={[2.95, 3.2, 0.12, 1.9, 1.2, 2.2]} o={0.03} />
      <Bx c="#f3e2bf" b={[-0.95, 2.95, 0.12, 1.9, 1.15, 1.2]} o={0} />
      <Cabinet p={[0.4, 0.12, 1.55]} c="#d8402e" />
      <Cabinet p={[1.7, 0.12, 1.55]} c="#eeeae0" screen="#58a8e0" />
      {[0.8, 1.1, 2.1, 2.4].map((x) => (
        <group key={x}>
          <Toon geometry={geo.cyl} color="#d8402e" position={[x, 0.55, 1.9]} scale={[0.22, 0.06, 0.22]} outline={0} />
          <Toon geometry={geo.cyl} color="#2a2f38" position={[x, 0.33, 1.9]} scale={[0.04, 0.45, 0.04]} outline={0} />
        </group>
      ))}
      <Pane p={[1.0, 0.98, 2.15]} w={3.9} h={1.72} cols={5} rows={1} frame={BD} />
      <Bx c={PAL.gold} b={[0.97, 1.0, 0.7, 1.2, 2.16, 2.2]} o={0} />
      <Bx c={PAL.gold} b={[1.03, 1.06, 0.7, 1.2, 2.16, 2.2]} o={0} />
      {/* sign + awning */}
      <Bx c="#d4452f" b={[-0.3, 3.1, 2.1, 2.95, 2.2, 2.35]} o={0.03} />
      <Decal tex={sign} p={[1.4, 2.52, 2.36]} w={3.35} h={0.82} />
      <Bx c={N} b={[-0.9, 3.0, 1.78, 1.86, 2.2, 2.9]} r={[0.12, 0, 0]} o={0.02} />
      <Bx c={PAL.navyDark} b={[-1.0, -0.94, 1.9, 2.9, 2.2, 2.3]} o={0} />
      <group position={[-1.1, 2.45, 2.55]} rotation={[0, Math.PI / 2, 0]}>
        <Bx c="#f6f3ea" b={[-0.3, 0.3, -0.5, 0.5, -0.05, 0.05]} o={0.02} />
        <Decal tex={play} p={[0, 0, 0.06]} w={0.55} h={0.92} />
        <Decal tex={play} p={[0, 0, -0.06]} w={0.55} h={0.92} r={[0, Math.PI, 0]} />
      </group>
      <Decal tex={my} p={[-1.08, 1.2, 2.21]} w={0.3} h={0.3} />
      <WallLamp p={[-0.75, 1.5, 2.2]} c="#2a2f38" />
      <WallLamp p={[3.05, 1.5, 2.2]} c="#2a2f38" />
      <Toon geometry={geo.cyl} color={N} position={[-1.15, 1.6, 1.8]} scale={[0.1, 3.0, 0.1]} outline={0} />
      {/* stair tower and upper room */}
      <Bx c={B} b={[-2.4, -1.2, 0.12, 5.3, -2.4, -0.4]} o={0.06} />
      <Bx c={B} b={[-1.2, 0.9, 3.0, 5.8, -2.4, -0.6]} o={0.06} />
      <Bx c={BD} b={[-2.45, -1.15, 5.3, 5.4, -2.45, -0.35]} o={0.015} />
      <Bx c={N} b={[-2.1, -1.5, 0.12, 2.0, -0.42, -0.38]} o={0.015} />
      <Bx c="#f1c769" b={[-1.95, -1.65, 1.0, 1.7, -0.38, -0.36]} o={0} />
      <Bx c={N} b={[-2.42, -2.38, 3.0, 4.9, -1.9, -1.0]} o={0.015} />
      <Bx c="#f1c769" b={[-2.44, -2.42, 3.8, 4.5, -1.75, -1.15]} o={0} />
      <Bx c={BD} b={[-2.9, -2.4, 5.0, 5.1, -2.0, -0.9]} o={0.015} />
      <Pane p={[-0.2, 4.3, -0.58]} w={0.7} h={0.9} cols={1} solid frame="#f1ecdf" />
      <Bx c="#f6f3ea" b={[-0.95, 0.35, 3.3, 4.0, -0.58, -0.56]} r={[0, 0, 0]} o={0.02} />
      {/* exterior stair rising toward the back */}
      {Array.from({ length: 11 }, (_, i) => (
        <Bx key={i} c="#e6e0d2" b={[-3.5, -2.45, 0.12, 0.12 + (i + 1) * 0.27, 2.25 - (i + 1) * run, 2.25 - i * run]} o={0.015} />
      ))}
      <Bx c={B} b={[-3.5, -2.45, 0.12, 3.09, -2.4, -0.61]} o={0.04} />
      <Rail pts={[[-3.52, 2.2], [-3.52, -0.6]]} y={0.4} h={0.9} c={N} spacing={0.45} />
      <Rail pts={[[-3.52, -0.6], [-3.52, -2.4]]} y={3.09} h={0.8} c={N} />
      {/* roof terrace: pergola, railing, machines */}
      {[
        [0.95, 2.1],
        [3.1, 2.1],
        [3.1, -2.3],
      ].map(([x, z]) => (
        <Bx key={`${x}${z}`} c={BD} b={[x - 0.08, x + 0.08, 3.0, 5.6, z - 0.08, z + 0.08]} o={0.015} />
      ))}
      <Bx c={BD} b={[-1.2, 3.2, 5.5, 5.65, 2.02, 2.18]} o={0.015} />
      <Bx c={BD} b={[-1.2, 3.2, 5.5, 5.65, -2.38, -2.22]} o={0.015} />
      {Array.from({ length: 12 }, (_, i) => (
        <Bx key={i} c={B} b={[-1.1 + i * 0.37, -1.02 + i * 0.37, 5.65, 5.75, -2.4, 2.2]} o={0} />
      ))}
      <Rail pts={[[0.9, 2.15], [3.15, 2.15], [3.15, -2.35]]} y={3.0} h={0.55} c={N} />
      <Cabinet p={[1.4, 3.0, 0.8]} c="#3a64c8" screen="#f0b44c" />
      <Cabinet p={[2.4, 3.0, 0.8]} c="#d8402e" />
      <Vines p={[0.3, 5.75, 2.2]} w={1.4} len={0.9} />
      <Vines p={[3.1, 5.75, 2.2]} w={0.3} len={2.0} />
      <Bush p={[-0.5, 5.9, 2.0]} s={0.4} />
      <Bush p={[2.6, 5.9, 2.0]} s={0.4} />
      <Vines p={[-2.35, 5.3, -0.36]} w={0.4} len={1.2} />
      {/* frontage */}
      <Planter p={[-1.9, 0.12, 0.3]} w={0.9} d={0.5} />
      <Planter p={[-0.35, 0.12, 2.65]} w={0.9} d={0.5} />
      <Planter p={[2.65, 0.12, 2.65]} w={0.9} d={0.5} />
      {[-2.2, 0.5, 3.4].map((x) => (
        <group key={x} position={[x, 0.12, 2.95]}>
          <Toon geometry={geo.cyl} color={N} position={[0, 0.35, 0]} scale={[0.14, 0.7, 0.14]} outline={0.01} />
          <Toon geometry={geo.sphere} color={N} position={[0, 0.72, 0]} scale={0.16} outline={0} />
        </group>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* OBSERVATORY — round cream drum, slotted blue dome, railed terrace   */

export function Observatory({ name }: { name: string }) {
  const sign = textTex([name], 512, 96, { fg: '#f1ecdf', bg: '#34507c', border: '#9fb2c9', weight: 800 })
  const obs = canvasTex('obs:badge', 128, 128, (g) => {
    g.fillStyle = '#efe8d6'
    g.beginPath()
    g.arc(64, 64, 60, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = '#34507c'
    g.lineWidth = 6
    g.stroke()
    g.fillStyle = '#34507c'
    g.font = '800 30px Arial, sans-serif'
    g.textAlign = 'center'
    g.fillText('OBS.', 64, 92)
    g.beginPath()
    g.moveTo(64, 22)
    g.lineTo(70, 46)
    g.lineTo(64, 58)
    g.lineTo(58, 46)
    g.fill()
  })
  const T = 0.75
  const DR = 2.2
  const railPts = Array.from({ length: 15 }, (_, i) => {
    const a = 0.32 + (i / 14) * (Math.PI * 2 - 0.64)
    return [3.35 * Math.sin(a), 3.35 * Math.cos(a)] as [number, number]
  })
  const windows = [-1.05, -0.6, 0.6, 1.05, 1.8, -1.8]
  return (
    <group>
      <Toon geometry={geo.cone} color="#9bb07f" position={[0, -0.6, -4.2]} scale={[10, 2.4, 7]} outline={0.08} />
      {/* terrace */}
      <Toon geometry={geo.cyl} color="#e6dcc4" position={[0, T / 2 - 0.4, 0]} scale={[7.2, T + 0.8, 7.2]} outline={0.06} />
      <Toon geometry={geo.cyl} color="#efe8d8" position={[0, T + 0.01, 0]} scale={[7.0, 0.02, 7.0]} outline={0} />
      <Rail pts={railPts} y={T} h={0.6} c={PAL.navyDark} spacing={0.8} />
      <Steps x={[-0.9, 0.9]} z0={3.3} n={3} rise={T / 3} run={0.32} c="#e6dcc4" />
      <Bx c="#e6dcc4" b={[-1.3, -0.9, 0, T + 0.3, 3.2, 4.2]} o={0.02} />
      <Bx c="#e6dcc4" b={[0.9, 1.3, 0, T + 0.3, 3.2, 4.2]} o={0.02} />
      {/* drum + dome */}
      <Toon geometry={geo.cyl} color={PAL.cream} position={[0, T + 1.45, 0]} scale={[DR * 2, 2.9, DR * 2]} outline={0.06} />
      <Toon geometry={geo.cyl} color="#e0d6c0" position={[0, T + 2.85, 0]} scale={[DR * 2 + 0.1, 0.12, DR * 2 + 0.1]} outline={0.015} />
      <Toon geometry={geo.cyl} color="#3f5f8f" position={[0, T + 3.1, 0]} scale={[DR * 2 + 0.25, 0.38, DR * 2 + 0.25]} outline={0.03} />
      <Toon geometry={geo.dome} color="#4f73a6" position={[0, T + 3.28, 0]} scale={[DR * 2 + 0.1, DR * 2 + 0.2, DR * 2 + 0.1]} outline={0.07} radial={false} />
      {[-0.9, -0.45, 0.45, 0.9, 1.6, -1.6, 2.4, -2.4].map((a) => (
        <Toon key={a} geometry={ribGeo} color="#3f5f8f" position={[0, T + 3.28, 0]} rotation={[0, a + Math.PI / 2, 0]} scale={[DR + 0.07, DR + 0.12, DR + 0.07]} outline={0} radial={false} />
      ))}
      {/* shutter slot with telescope */}
      <group position={[0, T + 3.28, 0]}>
        {[0.12, 0.3, 0.48, 0.66, 0.84, 1.02, 1.2].map((phi) => (
          <group key={phi} rotation={[phi, 0, 0]}>
            <Bx c="#1c2433" b={[-0.42, 0.42, DR + 0.12, DR + 0.2, -0.2, 0.2]} o={0} />
            <Bx c={PAL.gold} b={[-0.5, -0.42, DR + 0.12, DR + 0.24, -0.2, 0.2]} o={0} />
            <Bx c={PAL.gold} b={[0.42, 0.5, DR + 0.12, DR + 0.24, -0.2, 0.2]} o={0} />
          </group>
        ))}
        <Toon geometry={geo.cyl} color="#f2efe6" position={[0, 1.75, 0.95]} rotation={[0.75, 0, 0]} scale={[0.36, 1.1, 0.36]} outline={0.02} />
      </group>
      {windows.map((a) => (
        <group key={a} position={[(DR + 0.01) * Math.sin(a), T + 1.4, (DR + 0.01) * Math.cos(a)]} rotation={[0, a, 0]}>
          <Pane p={[0, 0, 0]} w={0.32} h={0.95} cols={1} rows={2} frame="#2e6f80" solid />
        </group>
      ))}
      {/* entrance */}
      <Bx c="#e6dcc4" b={[-0.75, 0.75, T, T + 2.2, DR - 0.3, DR + 0.18]} o={0.03} />
      <Bx c="#7a5a3b" b={[-0.55, 0.55, T, T + 1.9, DR + 0.18, DR + 0.22]} o={0.015} />
      <Bx c="#4f7f95" b={[-0.45, -0.05, T + 1.1, T + 1.7, DR + 0.22, DR + 0.23]} o={0} />
      <Bx c="#4f7f95" b={[0.05, 0.45, T + 1.1, T + 1.7, DR + 0.22, DR + 0.23]} o={0} />
      <Bx c={PAL.gold} b={[-0.08, -0.04, T + 0.7, T + 1.1, DR + 0.22, DR + 0.26]} o={0} />
      <Bx c={PAL.gold} b={[0.04, 0.08, T + 0.7, T + 1.1, DR + 0.22, DR + 0.26]} o={0} />
      <Bx c="#34507c" b={[-1.05, 1.05, T + 2.25, T + 2.7, DR + 0.05, DR + 0.2]} o={0.02} />
      <Decal tex={sign} p={[0, T + 2.47, DR + 0.21]} w={2.0} h={0.4} />
      <WallLamp p={[-0.6, T + 2.95, DR + 0.05]} />
      <WallLamp p={[0.6, T + 2.95, DR + 0.05]} />
      <Decal tex={obs} p={[1.45 * 1.08, T + 1.3, 1.62 * 1.08]} w={0.6} h={0.6} r={[0, 0.73, 0]} />
      <Pot p={[-1.0, T, DR + 0.4]} s={0.75} />
      <Pot p={[1.0, T, DR + 0.4]} s={0.75} />
      {/* annex with rooftop telescope */}
      <Bx c={PAL.cream} b={[-3.3, -1.7, T, T + 2.2, -1.0, 1.4]} o={0.05} />
      <Bx c="#e0d6c0" b={[-3.35, -1.65, T + 2.2, T + 2.3, -1.05, 1.45]} o={0.015} />
      <Bx c="#3f5f8f" b={[-3.0, -2.5, T, T + 1.5, 1.4, 1.44]} o={0.015} />
      <Bx c="#b8b0a0" b={[-2.2, -1.9, T + 1.3, T + 1.6, 1.4, 1.43]} o={0} />
      <Rail pts={[[-3.25, 1.35], [-3.25, -0.95], [-1.75, -0.95]]} y={T + 2.3} h={0.45} />
      <Rail pts={[[-3.25, 1.35], [-2.0, 1.35]]} y={T + 2.3} h={0.45} />
      <group position={[-2.5, T + 2.3, 0.2]}>
        {[0, 2.1, 4.2].map((a) => (
          <Toon key={a} geometry={geo.cyl} color="#3f5f8f" position={[Math.sin(a) * 0.2, 0.35, Math.cos(a) * 0.2]} rotation={[Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3]} scale={[0.05, 0.75, 0.05]} outline={0} />
        ))}
        <Toon geometry={geo.cyl} color="#f2efe6" position={[0.2, 0.95, 0.1]} rotation={[0, 0, 1.0]} scale={[0.22, 1.3, 0.22]} outline={0.02} />
        <Toon geometry={geo.cyl} color={PAL.gold} position={[0.72, 1.3, 0.1]} rotation={[0, 0, 1.0]} scale={[0.25, 0.08, 0.25]} outline={0} />
      </group>
      <Vines p={[-3.2, T + 2.3, 1.45]} w={0.5} len={1.2} />
      <Vines p={[-1.2, T + 2.95, DR - 0.3]} w={0.3} len={1.0} />
      {/* terrace telescope */}
      <group position={[-1.6, T, 2.4]}>
        <Toon geometry={geo.cyl} color="#3f5f8f" position={[0, 0.4, 0]} scale={[0.12, 0.8, 0.12]} outline={0} />
        <Toon geometry={geo.cyl} color="#f2efe6" position={[0, 0.9, 0]} rotation={[0.9, 0.4, 0]} scale={[0.14, 0.7, 0.14]} outline={0.015} />
      </group>
      {/* rocks & greenery */}
      {[
        [-3.8, 2.2, 0.8],
        [3.9, 1.8, 0.7],
        [-2.2, 3.9, 0.6],
        [2.6, 3.6, 0.55],
        [-4.1, -0.8, 0.6],
      ].map(([x, z, s]) => (
        <Rock key={`${x}${z}`} p={[x, 0.1, z]} s={s} />
      ))}
      {[
        [-3.0, 3.3],
        [3.4, 2.9],
        [-4.0, 0.9],
        [4.1, 0.2],
        [1.6, 4.1],
        [-1.4, 4.2],
      ].map(([x, z]) => (
        <Bush key={`${x}${z}`} p={[x, 0.3, z]} s={0.55} />
      ))}
      <Cypress p={[3.6, 0.1, -1.0]} h={2.2} />
      <Cypress p={[3.1, 0.1, -2.2]} h={2.6} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* WRITE HOUSE — tiled low-rise with awnings and book-lined windows    */

function booksTex() {
  return canvasTex('books', 256, 256, (g) => {
    g.fillStyle = '#b98a55'
    g.fillRect(0, 0, 256, 256)
    const cols = ['#3f6f8f', '#c86b4a', '#e3c27a', '#6f8f5a', '#f0e6d0', '#2f4a78', '#a0523c']
    for (let row = 0; row < 4; row++) {
      const y0 = row * 64 + 8
      g.fillStyle = '#8a633d'
      g.fillRect(0, y0 + 50, 256, 6)
      let x = 4
      let k = row * 3
      while (x < 250) {
        const w = 8 + ((k * 7) % 9)
        const h = 36 + ((k * 11) % 12)
        g.fillStyle = cols[k % cols.length]
        g.fillRect(x, y0 + 50 - h, w, h)
        x += w + 2
        k++
      }
    }
  })
}

function tileMaterialTex() {
  return canvasTex('tiles', 128, 128, (g) => {
    g.fillStyle = '#f3f1ea'
    g.fillRect(0, 0, 128, 128)
    g.strokeStyle = '#d6d4cc'
    g.lineWidth = 2
    for (let i = 0; i <= 128; i += 16) {
      g.beginPath()
      g.moveTo(i, 0)
      g.lineTo(i, 128)
      g.stroke()
      g.beginPath()
      g.moveTo(0, i)
      g.lineTo(128, i)
      g.stroke()
    }
  })
}

function Awning({ x, w, y, z }: { x: number; w: number; y: number; z: number }) {
  return (
    <group position={[x, y, z]}>
      <Toon geometry={geo.box} color="#f0ead8" position={[0, -0.12, 0.35]} rotation={[0.35, 0, 0]} scale={[w, 0.06, 0.8]} outline={0.02} />
      <Toon geometry={geo.box} color="#e6dcc4" position={[0, -0.34, 0.72]} scale={[w, 0.16, 0.04]} outline={0.01} />
      <Toon geometry={geo.cyl} color={PAL.metalLight} position={[0, 0.02, 0.02]} rotation={[0, 0, Math.PI / 2]} scale={[0.08, w + 0.1, 0.08]} outline={0} />
    </group>
  )
}

export function WriteHouse({ name }: { name: string }) {
  const title = textTex([name], 512, 96, { fg: '#34507c', weight: 800 })
  const wh = textTex(['WH'], 96, 96, { fg: '#f1ecdf', bg: '#34507c', weight: 700 })
  const books = booksTex()
  const tiles = tileMaterialTex()
  const H = 3.4
  const band = 2.55
  const F = 2.1
  const sections: [number, number, number][] = [
    [-3.1, -1.1, 0],
    [-0.55, 1.35, 0.75],
    [1.8, 3.3, 0.75],
  ]
  return (
    <group>
      <Bx c="#ece6d8" b={[-3.9, 3.9, -0.4, 0.12, -2.6, 3.0]} o={0.03} />
      <Bx c="#f0ebdf" b={[-3.6, 3.6, 0.12, H, -2.4, 1.1]} o={0.06} />
      <Bx c={PAL.roofSlate} b={[-3.45, 3.45, H, H + 0.05, -2.25, F - 0.15]} o={0} />
      <Bx c="#f0ebdf" b={[-3.6, 3.6, band, H, 1.1, F]} o={0.05} />
      <Bx c="#c9c9c2" b={[1.8, 2.6, H, H + 0.55, -1.2, -0.4]} o={0.02} />
      <Bx c="#6c757b" b={[1.9, 2.5, H + 0.15, H + 0.4, -0.4, -0.38]} o={0} />
      {/* tiled piers and sills between openings */}
      {[
        [-3.6, -3.1],
        [-1.1, -0.55],
        [1.35, 1.8],
        [3.3, 3.6],
      ].map(([a, b]) => (
        <group key={a}>
          <Bx c="#f3f1ea" b={[a, b, 0.12, band, 1.1, F]} o={0.03} />
          <Decal tex={tiles} p={[(a + b) / 2, band / 2 + 0.06, F + 0.01]} w={b - a} h={band - 0.1} />
        </group>
      ))}
      {sections.map(([a, b, sill], i) => (
        <group key={a}>
          <Bx c="#f3e2bf" b={[a, b, 0.12, band, 1.05, 1.1]} o={0} />
          <Decal tex={books} p={[(a + b) / 2, 1.5, 1.12]} w={b - a - 0.1} h={1.8} />
          {sill > 0 && (
            <>
              <Bx c="#f3f1ea" b={[a, b, 0.12, sill, 1.1, F]} o={0.02} />
              <Decal tex={tiles} p={[(a + b) / 2, sill / 2 + 0.06, F + 0.01]} w={b - a} h={sill - 0.06} />
            </>
          )}
          <Bx c={PAL.wood} b={[a + 0.25, b - 0.25, 0.8, 0.88, 1.2, 1.7]} o={0.01} />
          <Bx c={PAL.woodDark} b={[a + 0.35, a + 0.4, 0.12, 0.8, 1.3, 1.6]} o={0} />
          <Bx c={PAL.woodDark} b={[b - 0.4, b - 0.35, 0.12, 0.8, 1.3, 1.6]} o={0} />
          <Toon geometry={geo.cone} color="#f3e2a8" position={[(a + b) / 2 + 0.3, 1.1, 1.45]} scale={[0.26, 0.2, 0.26]} outline={0.01} />
          <Toon geometry={geo.cyl} color="#3d4a52" position={[(a + b) / 2 + 0.3, 0.95, 1.45]} scale={[0.03, 0.18, 0.03]} outline={0} />
          <Bush p={[b - 0.35, 1.1, 1.35]} s={0.22} />
          {i === 0 ? (
            <>
              <Bx c="#e7ddc8" b={[a + 0.3, a + 0.9, 0.12, 0.8, 1.4, 1.95]} o={0.01} />
              <Pot p={[b - 0.35, 0.12, 1.6]} s={0.9} tree />
              {[0, 1, 2, 3].map((k) => (
                <Bx key={k} c="#3d6ea8" b={[a + 0.05 + k * 0.12, a + 0.1 + k * 0.12, 0.12, band - 0.05, F - 0.05 - (k % 2) * 0.12, F]} o={0} />
              ))}
            </>
          ) : (
            <Pane p={[(a + b) / 2, (band + sill) / 2, F - 0.02]} w={b - a - 0.06} h={band - sill - 0.06} cols={i === 1 ? 4 : 4} rows={3} frame="#2f5c96" />
          )}
        </group>
      ))}
      <Awning x={-2.1} w={2.1} y={band + 0.1} z={F} />
      <Awning x={0.4} w={2.0} y={band + 0.1} z={F} />
      <Decal tex={title} p={[2.3, 2.98, F + 0.01]} w={2.3} h={0.45} />
      <WallLamp p={[1.0, 3.15, F]} />
      <WallLamp p={[3.45, 3.15, F]} />
      <WallLamp p={[-3.35, 2.2, F]} />
      <Decal tex={wh} p={[-3.35, 1.6, F + 0.01]} w={0.34} h={0.34} />
      <Vines p={[-3.2, H, F + 0.02]} w={0.9} len={0.9} />
      <Vines p={[3.62, H, F - 0.3]} w={0.5} len={2.2} />
      <Bush p={[-2.9, H + 0.2, F - 0.3]} s={0.4} />
      <Bush p={[3.1, H + 0.2, F - 0.3]} s={0.45} />
      <Bx c="#9aa2a6" b={[3.6, 3.75, 0.9, 1.6, 0.8, 1.4]} o={0.015} />
      {/* frontage */}
      <Planter p={[-3.4, 0.12, 2.55]} w={0.8} d={0.6} />
      <Tree p={[-3.4, 0.62, 2.55]} s={0.4} />
      <Pot p={[-0.8, 0.12, 2.5]} s={0.8} />
      <Planter p={[0.3, 0.12, 2.55]} w={1.1} d={0.55} flowers="#f4efe0" />
      <Planter p={[1.3, 0.12, 2.55]} w={0.6} d={0.55} />
      <Tree p={[1.3, 0.62, 2.55]} s={0.4} />
      <Planter p={[2.9, 0.12, 2.6]} w={1.4} d={0.55} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* MY STUDIO — mint gabled pair, timber posts, deck & display window  */

export function Studio({ name }: { name: string }) {
  const MINT = '#aee0d0'
  const T = '#1d6f8c'
  const sign = textTex([name], 384, 96, { fg: T, bg: '#f4efe0', border: PAL.wood, weight: 800 })
  const ms = textTex(['MS'], 128, 128, { fg: T, weight: 800 })
  const hobby = textTex(['HOBBY', 'STUDIO.'], 128, 96, { fg: '#f1ecdf', bg: '#2e4a66', weight: 600 })
  const blind = canvasTex('blind', 256, 64, (g) => {
    for (let x = 0; x < 256; x += 6) {
      g.fillStyle = x % 12 ? '#b58b56' : '#9c7443'
      g.fillRect(x, 0, 6, 64)
    }
  })
  const record = (x: number, c: string) => (
    <group key={x} position={[x, 0.95, 0.15]}>
      <Bx c={c} b={[-0.22, 0.22, -0.22, 0.22, -0.02, 0.02]} o={0.01} />
      <Toon geometry={geo.cyl} color="#222" position={[0.05, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]} scale={[0.3, 0.02, 0.3]} outline={0} />
    </group>
  )
  const deckY = 0.55
  return (
    <group>
      <Bx c="#dcd9cf" b={[-3.9, 3.9, -0.4, 0.1, -2.8, 3.2]} o={0.03} />
      {/* left gable (ridge front-to-back) */}
      <group position={[-2.1, deckY, -0.6]}>
        <Toon geometry={gableGeo(2.6, 2.6, 1.3, 3.6)} color={MINT} outline={0.05} edges />
        <GableRoof w={2.6} h={2.6} ridge={1.3} d={3.6} />
      </group>
      {/* right long volume (ridge along x) */}
      <group position={[1.35, deckY, -0.8]} rotation={[0, Math.PI / 2, 0]}>
        <Toon geometry={gableGeo(3.2, 2.5, 1.2, 4.3)} color={MINT} outline={0.05} edges />
        <GableRoof w={3.2} h={2.5} ridge={1.3} d={4.3} />
      </group>
      {/* front porch roof over display + timber posts */}
      <Toon geometry={geo.box} color="#8f99a4" position={[1.35, deckY + 2.55, 1.3]} rotation={[0.28, 0, 0]} scale={[4.6, 0.12, 1.3]} outline={0.03} />
      <Bx c={PAL.wood} b={[-0.95, 3.6, deckY + 2.3, deckY + 2.45, 1.75, 1.9]} o={0.015} />
      {[-0.8, 3.45].map((x) => (
        <Bx key={x} c={PAL.wood} b={[x - 0.09, x + 0.09, deckY, deckY + 2.4, 1.72, 1.9]} o={0.015} />
      ))}
      {[-3.3, -0.9].map((x) => (
        <Bx key={x} c={PAL.wood} b={[x - 0.09, x + 0.09, deckY, deckY + 2.6, 1.5, 1.68]} o={0.015} />
      ))}
      {/* deck + steps */}
      <Bx c={PAL.wood} b={[-3.5, 3.7, deckY - 0.12, deckY, -0.4, 2.1]} o={0.03} />
      <Bx c={PAL.stone} b={[-3.4, 3.6, 0, deckY - 0.12, -0.4, 1.95]} o={0.02} />
      <Steps x={[-3.0, -1.4]} z0={2.1} n={2} rise={deckY / 2} run={0.32} c="#dedbd2" />
      {/* left entry */}
      <Bx c={T} b={[-2.85, -1.35, deckY, deckY + 2.15, 1.18, 1.26]} o={0.02} />
      {[-2.48, -1.72].map((x) => (
        <Bx key={x} c="#f3e2bf" b={[x - 0.3, x + 0.3, deckY + 0.12, deckY + 2.0, 1.26, 1.27]} o={0} />
      ))}
      <Bx c={T} b={[-2.13, -2.07, deckY, deckY + 2.15, 1.27, 1.3]} o={0} />
      <Bx c={PAL.gold} b={[-2.2, -2.16, deckY + 0.8, deckY + 1.2, 1.27, 1.32]} o={0} />
      <Bx c={PAL.gold} b={[-2.04, -2.0, deckY + 0.8, deckY + 1.2, 1.27, 1.32]} o={0} />
      <Bx c="#f4efe0" b={[-3.0, -1.2, deckY + 2.25, deckY + 2.75, 1.2, 1.26]} o={0.02} />
      <Decal tex={sign} p={[-2.1, deckY + 2.5, 1.27]} w={1.75} h={0.44} />
      <WallLamp p={[-2.1, deckY + 3.05, 1.2]} c="#2a2f38" />
      <WallLamp p={[-3.1, deckY + 1.9, 1.2]} c="#2a2f38" />
      <Decal tex={hobby} p={[-3.1, deckY + 1.3, 1.21]} w={0.4} h={0.3} />
      {[-2.3, -1.9].map((x) => (
        <Pane key={x} p={[x, deckY + 3.1, 1.21]} w={0.25} h={0.35} cols={1} frame={T} solid />
      ))}
      {/* right display window */}
      <Bx c="#f3dfb4" b={[-0.7, 3.3, deckY, deckY + 2.3, 0.8, 0.83]} o={0} />
      <group position={[0.2, deckY, 0.88]}>
        <Bx c={PAL.woodDark} b={[-0.8, 3.0, 0.62, 0.68, -0.05, 0.25]} o={0} />
        <Bx c={PAL.woodDark} b={[-0.8, 3.0, 1.35, 1.4, -0.05, 0.25]} o={0} />
        {[
          [-0.4, '#e28b5a'],
          [0.2, '#5f9aa6'],
          [0.8, '#e7b957'],
          [1.6, '#d7703f'],
          [2.2, '#6f8f5a'],
        ].map(([x, c]) => record(x as number, c as string))}
        {[0.2, 0.8, 1.6, 2.2].map((x) => (
          <Bx key={x} c="#3a3f45" b={[x - 0.14, x + 0.14, 1.4, 1.6, 0.05, 0.2]} o={0.01} />
        ))}
      </group>
      <Pane p={[1.3, deckY + 1.15, 1.2]} w={4.0} h={2.2} cols={4} rows={1} frame={T} />
      <Decal tex={blind} p={[1.9, deckY + 1.95, 1.23]} w={2.2} h={0.55} />
      {[0.4, 1.3, 2.2].map((x) => (
        <group key={x} position={[x, deckY + 2.1, 0.8]}>
          <Toon geometry={geo.cyl} color="#2a2f38" position={[0, 0.2, 0]} scale={[0.02, 0.4, 0.02]} outline={0} />
          <Toon geometry={geo.cone} color="#2a2f38" scale={[0.25, 0.18, 0.25]} outline={0} />
        </group>
      ))}
      <Decal tex={ms} p={[3.51, deckY + 1.5, -0.6]} w={0.6} h={0.6} r={[0, Math.PI / 2, 0]} />
      <Pane p={[3.51, deckY + 1.5, -1.9]} w={1.0} h={0.35} cols={2} frame={T} solid r={[0, Math.PI / 2, 0]} />
      {/* planting */}
      <Planter p={[-3.1, deckY, 1.6]} w={0.7} d={0.4} />
      <Pot p={[-1.1, deckY, 1.55]} s={0.8} />
      <Planter p={[-0.1, deckY, 1.7]} w={0.9} d={0.4} flowers="#f4efe0" />
      <Planter p={[2.8, deckY, 1.7]} w={0.8} d={0.4} />
      <Bush p={[3.3, deckY + 0.5, 1.6]} s={0.45} c={PAL.leafDark} />
      {[-0.5, 0.6, 1.7, 2.8].map((x) => (
        <Bush key={x} p={[x, 0.3, 2.4]} s={0.5} />
      ))}
      <Bush p={[-3.8, 0.35, 1.4]} s={0.6} />
      <Bush p={[3.9, 0.35, 1.2]} s={0.55} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* ISLAND SERVICE CENTER — Mediterranean hall, clock tower & fountain  */

function clockTex() {
  return canvasTex('clock', 128, 128, (g) => {
    g.fillStyle = '#f7f3ea'
    g.beginPath()
    g.arc(64, 64, 60, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = '#8a8f96'
    g.lineWidth = 5
    g.stroke()
    g.strokeStyle = '#2f4a78'
    g.lineWidth = 3
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      g.beginPath()
      g.moveTo(64 + Math.sin(a) * 48, 64 - Math.cos(a) * 48)
      g.lineTo(64 + Math.sin(a) * 54, 64 - Math.cos(a) * 54)
      g.stroke()
    }
    g.lineWidth = 6
    g.beginPath()
    g.moveTo(64, 64)
    g.lineTo(64 + 26, 64 - 18)
    g.moveTo(64, 64)
    g.lineTo(40, 40)
    g.stroke()
  })
}

function mapTex() {
  return canvasTex('islandmap', 192, 128, (g) => {
    g.fillStyle = '#7cc6de'
    g.fillRect(0, 0, 192, 128)
    g.fillStyle = '#9cc98a'
    g.beginPath()
    g.ellipse(96, 70, 60, 36, 0.3, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#e8d8a8'
    g.beginPath()
    g.ellipse(80, 64, 24, 14, 0.2, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#2f4a78'
    g.font = '800 18px Arial, sans-serif'
    g.fillText('ISLAND GUIDE', 8, 20)
  })
}

/* Hand-painted panels: each picture is laid down dab by dab in its local XY plane. */

const FACE = new THREE.Vector3(0, 0, 1)
function dab(x: number, y: number, z: number, a: number, len: number, wid: number, color: string): Stroke {
  return { p: new THREE.Vector3(x, y, z), n: FACE, dir: new THREE.Vector3(Math.cos(a), Math.sin(a), 0), len, wid, color: new THREE.Color(color) }
}

const paintCache = new Map<string, Stroke[]>()
function painted(key: string, make: (r: () => number) => Stroke[]) {
  let s = paintCache.get(key)
  if (!s) {
    s = make(rng(key.length * 977 + key.charCodeAt(0)))
    paintCache.set(key, s)
  }
  return s
}

function clockStrokes() {
  return painted('clock', (r) => {
    const out: Stroke[] = []
    const cream = ['#f7f3ea', '#efe6d2', '#fbf8ef', '#e6dcc6', '#f3ead8']
    for (let rr = 0.04; rr < 0.45; rr += 0.055) {
      const n = Math.max(3, Math.ceil((Math.PI * 2 * rr) / 0.07))
      for (let i = 0; i < n; i++) {
        const t = ((i + r() * 0.6) / n) * Math.PI * 2
        const q = rr + (r() - 0.5) * 0.03
        out.push(dab(Math.cos(t) * q, Math.sin(t) * q, 0.002 + r() * 0.006, t + Math.PI / 2 + (r() - 0.5) * 0.5, 0.1 + r() * 0.05, 0.045 + r() * 0.015, pick(r, cream)))
      }
    }
    const rim = ['#7f8a96', '#6c7784', '#95a0aa', '#5f6a77']
    for (let i = 0; i < 34; i++) {
      const t = ((i + r() * 0.5) / 34) * Math.PI * 2
      const q = 0.49 + (r() - 0.5) * 0.03
      out.push(dab(Math.cos(t) * q, Math.sin(t) * q, 0.012 + r() * 0.004, t + Math.PI / 2 + (r() - 0.5) * 0.3, 0.13, 0.055 + r() * 0.015, pick(r, rim)))
    }
    for (let i = 0; i < 12; i++) {
      const t = (i / 12) * Math.PI * 2
      out.push(dab(Math.cos(t) * 0.37, Math.sin(t) * 0.37, 0.02, t + (r() - 0.5) * 0.25, i % 3 ? 0.06 : 0.09, i % 3 ? 0.03 : 0.04, '#2f4a78'))
    }
    const hand = (a: number, L: number, w: number) => {
      for (let k = 0; k < 3; k++) {
        const d = (L * (k + 0.5)) / 3
        out.push(dab(Math.cos(a) * d, Math.sin(a) * d, 0.026 + k * 0.002, a + (r() - 0.5) * 0.12, (L / 3) * 1.35, w * (0.85 + r() * 0.3), pick(r, ['#2f4a78', '#263d63', '#34548a'])))
      }
    }
    hand(Math.PI / 5, 0.24, 0.06)
    hand((3 * Math.PI) / 4, 0.34, 0.045)
    out.push(dab(0, 0, 0.034, r() * 3, 0.07, 0.06, '#c9a24a'))
    return out
  })
}

function sailStrokes() {
  return painted('sail', (r) => {
    const out: Stroke[] = []
    const W = 0.25
    const sky = ['#f5ecdc', '#f1e2c8', '#f8f1e4', '#efd9bf', '#e9e4d2']
    const sea = ['#3c6fae', '#4a7fbe', '#335f99', '#5b8fc8']
    for (let y = -0.47; y < 0.48; y += 0.045) {
      for (let x = -W + 0.04; x < W - 0.03; x += 0.07) {
        const wet = y < -0.08
        const px = x + (r() - 0.5) * 0.03
        const py = y + (r() - 0.5) * 0.02
        out.push(dab(px, py, 0.002 + r() * 0.005, (wet ? Math.sin(px * 18) * 0.25 : 0) + (r() - 0.5) * 0.2, 0.09 + r() * 0.03, 0.045 + r() * 0.012, pick(r, wet ? sea : sky)))
      }
    }
    for (let i = 0; i < 10; i++) out.push(dab(-0.2 + r() * 0.4, -0.15 - r() * 0.3, 0.012, (r() - 0.5) * 0.3, 0.06, 0.018, '#dbe8f2'))
    const sun = ['#f0a35e', '#e98a4f', '#f5b874']
    for (let i = 0; i < 9; i++) {
      const t = (i / 9) * Math.PI * 2
      out.push(dab(0.14 + Math.cos(t) * 0.035, 0.33 + Math.sin(t) * 0.035, 0.012, t + Math.PI / 2, 0.06, 0.04, pick(r, sun)))
    }
    const sail = ['#e8715a', '#f08a6c', '#d65f4a', '#ee7c60']
    for (let y = -0.02; y < 0.36; y += 0.035) {
      const half = ((0.38 - y) / 0.4) * 0.2
      for (let x = 0.03 - half + 0.03; x < 0.03; x += 0.05) out.push(dab(x + r() * 0.015, y, 0.016 + r() * 0.004, 1.05 + (r() - 0.5) * 0.25, 0.08, 0.04, pick(r, sail)))
    }
    for (let k = 0; k < 4; k++) out.push(dab(0.045, -0.02 + k * 0.1, 0.022, Math.PI / 2 + (r() - 0.5) * 0.06, 0.12, 0.018, '#3a2f2a'))
    for (let x = -0.17; x < 0.17; x += 0.06) out.push(dab(x, -0.075 + (r() - 0.5) * 0.01, 0.024, (r() - 0.5) * 0.15, 0.08, 0.045, pick(r, ['#b8483b', '#a33f34', '#c4564a'])))
    return out
  })
}

function mapStrokes() {
  return painted('islandmap', (r) => {
    const out: Stroke[] = []
    const sea = ['#7cc6de', '#6ab8d4', '#8fd3e6', '#5aa9c9']
    for (let y = -0.33; y < 0.34; y += 0.05) {
      for (let x = -0.52; x < 0.52; x += 0.07) {
        const px = x + (r() - 0.5) * 0.03
        const py = y + (r() - 0.5) * 0.02
        out.push(dab(px, py, 0.002 + r() * 0.005, Math.sin(px * 7) * 0.5 + Math.cos(py * 9) * 0.4, 0.09 + r() * 0.03, 0.045 + r() * 0.012, pick(r, sea)))
      }
    }
    const cx = 0.06
    const cy = -0.03
    const rot = 0.3
    const at = (u: number, v: number): [number, number] => [cx + u * Math.cos(rot) - v * Math.sin(rot), cy + u * Math.sin(rot) + v * Math.cos(rot)]
    const ring = (rx: number, ry: number, n: number, z: number, pal: string[], len: number, wid: number) => {
      for (let i = 0; i < n; i++) {
        const t = ((i + r() * 0.5) / n) * Math.PI * 2
        const [x, y] = at(Math.cos(t) * rx, Math.sin(t) * ry)
        const [x2, y2] = at(Math.cos(t + 0.05) * rx, Math.sin(t + 0.05) * ry)
        out.push(dab(x, y, z, Math.atan2(y2 - y, x2 - x) + (r() - 0.5) * 0.3, len, wid, pick(r, pal)))
      }
    }
    ring(0.38, 0.22, 36, 0.01, ['#e8d8a8', '#f0e2b8', '#dccb96'], 0.09, 0.05)
    const green = ['#9cc98a', '#86b877', '#b0d69a', '#74a866']
    for (let k = 0.85; k > 0.05; k -= 0.17) ring(0.34 * k, 0.19 * k, Math.ceil(30 * k) + 3, 0.014 + (1 - k) * 0.004, green, 0.08, 0.045)
    const road = ['#5c6b78', '#6d7c88']
    for (let i = 0; i < 18; i++) {
      if (i % 2) continue
      const t = (i / 18) * Math.PI * 2
      const [x, y] = at(Math.cos(t) * 0.22, Math.sin(t) * 0.11)
      out.push(dab(x, y, 0.022, t + Math.PI / 2 + rot, 0.06, 0.022, pick(r, road)))
    }
    const pins = ['#e8715a', '#f0b04a', '#2f58a0', '#e8715a', '#9b5fc0', '#f0b04a', '#d65f4a']
    pins.forEach((c, i) => {
      const t = (i / pins.length) * Math.PI * 2 + 0.2
      const [x, y] = at(Math.cos(t) * 0.22, Math.sin(t) * 0.11)
      out.push(dab(x, y, 0.028, r() * 3, 0.04, 0.035, c))
    })
    return out
  })
}

function ShutterWindow({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Pane p={[0, 0, 0]} w={0.55} h={0.8} cols={2} rows={2} frame="#2f4a78" solid />
      <Bx c="#2f58a0" b={[-0.62, -0.32, -0.42, 0.42, 0, 0.05]} o={0.01} />
      <Bx c="#2f58a0" b={[0.32, 0.62, -0.42, 0.42, 0, 0.05]} o={0.01} />
      <Planter p={[0, -0.55, 0.12]} w={0.7} d={0.22} h={0.14} c={PAL.pot} flowers="#f4efe0" />
    </group>
  )
}

export function ServiceCenter() {
  const W = '#f2ecdf'
  const sign = textTex(['ISLAND SERVICE CENTER'], 512, 64, { fg: '#f1ecdf', bg: '#2f4a78', border: '#c9d2dc', weight: 700 })
  const welcome = textTex(['WELCOME TO', 'MARC ISLAND'], 384, 160, { fg: '#2f4a78', weight: 800 })
  const about = textTex(['ABOUT MARC'], 192, 48, { fg: '#2f4a78', weight: 800 })
  const guide = textTex(['ISLAND GUIDE'], 192, 48, { fg: '#2f4a78', weight: 800 })
  const brushed = useStrokeBuild() !== null
  const water = useMemo(() => new THREE.MeshBasicMaterial({ color: '#6fd0e0', toneMapped: false }), [])
  const jet = useMemo(() => new THREE.MeshBasicMaterial({ color: '#e8fbff', transparent: true, opacity: 0.8, toneMapped: false }), [])
  const H = 4.6
  return (
    <group>
      <Bx c="#efe6d4" b={[-5.2, 5.2, -0.4, 0.12, -3.0, 4.2]} o={0.03} />
      {/* main two-storey hall */}
      <Bx c={W} b={[-3.3, 1.9, 0.12, H, -2.8, 0.4]} o={0.07} />
      <group position={[-0.7, H + 0.7, -1.2]} scale={[2.85 / 0.509, 1.4, 1.85 / 0.509]}>
        <Toon geometry={geo.roof} color={PAL.terracotta} rotation={[0, Math.PI / 4, 0]} outline={0.06} />
      </group>
      {[-2.4, 1.0].map((x) => (
        <group key={x}>
          <Bx c={W} b={[x - 0.3, x + 0.3, H + 0.4, H + 1.5, -1.5, -0.9]} o={0.03} />
          <Bx c={PAL.terracotta} b={[x - 0.36, x + 0.36, H + 1.5, H + 1.62, -1.56, -0.84]} o={0.015} />
        </group>
      ))}
      {[-2.4, -0.7, 1.0].map((x) => (
        <ShutterWindow key={x} p={[x, 3.4, 0.41]} />
      ))}
      {[-2.4, 1.0].map((x) => (
        <ShutterWindow key={x} p={[x, 1.45, 0.41]} />
      ))}
      <Bx c="#2f4a78" b={[-1.7, 0.3, 2.35, 2.72, 0.4, 0.5]} o={0.015} />
      <Decal tex={sign} p={[-0.7, 2.535, 0.51]} w={1.95} h={0.34} />
      {/* arched door */}
      <Bx c="#e4dac6" b={[-1.35, -0.05, 0.12, 1.75, 0.4, 0.55]} o={0.02} />
      <Toon geometry={halfDisc} color="#e4dac6" position={[-0.7, 1.75, 0.47]} rotation={[Math.PI / 2, 0, 0]} scale={[1.3, 0.15, 1.3]} outline={0.02} />
      <Bx c="#2f58a0" b={[-1.15, -0.25, 0.12, 1.7, 0.55, 0.58]} o={0.01} />
      <Toon geometry={halfDisc} color="#2f58a0" position={[-0.7, 1.7, 0.56]} rotation={[Math.PI / 2, 0, 0]} scale={[0.9, 0.04, 0.9]} outline={0} />
      <Bx c="#8fb8c4" b={[-1.05, -0.75, 0.9, 1.6, 0.58, 0.59]} o={0} />
      <Bx c="#8fb8c4" b={[-0.65, -0.35, 0.9, 1.6, 0.58, 0.59]} o={0} />
      <Bx c={PAL.gold} b={[-0.76, -0.73, 0.7, 1.0, 0.58, 0.62]} o={0} />
      <Bx c={PAL.gold} b={[-0.67, -0.64, 0.7, 1.0, 0.58, 0.62]} o={0} />
      <WallLamp p={[-1.65, 2.1, 0.4]} />
      <WallLamp p={[0.25, 2.1, 0.4]} />
      <Vines p={[1.75, H, 0.42]} w={0.3} len={2.4} />
      {/* clock/bell tower */}
      <Bx c={W} b={[1.9, 3.3, 0.12, 6.9, -1.8, -0.2]} o={0.07} />
      <Bx c="#1f2733" b={[2.25, 2.95, 5.8, 6.6, -0.22, -0.18]} o={0} />
      <Toon geometry={halfDisc} color="#1f2733" position={[2.6, 6.6, -0.2]} rotation={[Math.PI / 2, 0, 0]} scale={[0.7, 0.04, 0.7]} outline={0} />
      <Toon geometry={geo.cone} color="#8a6b3a" position={[2.6, 6.1, -0.3]} scale={[0.35, 0.4, 0.35]} outline={0.01} />
      <Bx c="#e4dac6" b={[1.85, 3.35, 6.9, 7.05, -1.85, -0.15]} o={0.02} />
      <group position={[2.6, 7.6, -1.0]} scale={[0.95 / 0.509, 1.1, 1.05 / 0.509]}>
        <Toon geometry={geo.roof} color={PAL.terracotta} rotation={[0, Math.PI / 4, 0]} outline={0.05} />
      </group>
      <Toon geometry={geo.sphere} color={PAL.gold} position={[2.6, 8.25, -1.0]} scale={0.18} outline={0.01} />
      {brushed ? <StrokePaint strokes={clockStrokes()} position={[2.6, 4.9, -0.165]} /> : <Decal tex={clockTex()} p={[2.6, 4.9, -0.18]} w={1.05} h={1.05} />}
      <Vines p={[2.0, 4.2, -0.18]} w={0.25} len={2.2} />
      {/* welcome wall */}
      <Bx c={W} b={[3.3, 5.1, 0.12, 2.5, -1.4, -0.9]} o={0.05} />
      <Decal tex={welcome} p={[4.2, 1.5, -0.89]} w={1.7} h={0.72} />
      {[3.7, 4.2, 4.7].map((x) => (
        <WallLamp key={x} p={[x, 2.25, -0.9]} />
      ))}
      <Cypress p={[5.3, 0.12, -1.6]} h={3.0} />
      {/* pergola on the left */}
      {[
        [-4.9, 0.0],
        [-3.5, 0.0],
        [-4.9, 1.6],
        [-3.5, 1.6],
      ].map(([x, z]) => (
        <Bx key={`${x}${z}`} c={PAL.woodDark} b={[x - 0.08, x + 0.08, 0.12, 2.2, z - 0.08, z + 0.08]} o={0.015} />
      ))}
      {[0.0, 1.6].map((z) => (
        <Bx key={z} c={PAL.woodDark} b={[-5.1, -3.3, 2.2, 2.32, z - 0.08, z + 0.08]} o={0.015} />
      ))}
      {[-4.9, -4.5, -4.1, -3.7].map((x) => (
        <Bx key={x} c={PAL.wood} b={[x - 0.05, x + 0.05, 2.32, 2.42, -0.2, 1.8]} o={0} />
      ))}
      <Vines p={[-4.2, 2.45, 1.7]} w={1.4} len={0.8} />
      <Bench p={[-4.2, 0.12, 0.8]} yaw={Math.PI / 2} w={1.2} />
      {/* fountain */}
      <group position={[-0.7, 0.12, 2.3]}>
        <Toon geometry={geo.cyl} color="#e2d8c2" position={[0, 0.2, 0]} scale={[2.6, 0.4, 2.0]} outline={0.03} />
        <mesh position={[0, 0.38, 0]} scale={[2.35, 1, 1.75]} rotation={[-Math.PI / 2, 0, 0]} material={water}>
          <circleGeometry args={[0.5, 24]} />
        </mesh>
        <Toon geometry={geo.cyl} color="#e2d8c2" position={[0, 0.7, 0]} scale={[0.2, 0.8, 0.2]} outline={0.015} />
        <Toon geometry={geo.cyl} color="#e2d8c2" position={[0, 1.1, 0]} scale={[0.9, 0.16, 0.9]} outline={0.02} />
        <mesh position={[0, 1.2, 0]} rotation={[-Math.PI / 2, 0, 0]} material={water}>
          <circleGeometry args={[0.4, 16]} />
        </mesh>
        <mesh position={[0, 1.55, 0]} material={jet}>
          <cylinderGeometry args={[0.03, 0.06, 0.7, 6]} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[Math.sin(i * 1.57 + 0.8) * 0.8, 0.6, Math.cos(i * 1.57 + 0.8) * 0.6]} material={jet}>
            <cylinderGeometry args={[0.02, 0.04, 0.45, 6]} />
          </mesh>
        ))}
      </group>
      {/* guide board, about pillar, bike rack */}
      <group position={[-3.4, 0.12, 2.8]} rotation={[0, 0.5, 0]}>
        <Bx c="#e4dac6" b={[-0.55, 0.55, 0, 0.7, -0.15, 0.15]} o={brushed ? 0 : 0.02} />
        <group position={[0, 0.95, 0.05]} rotation={[-0.5, 0, 0]}>
          <Bx c="#e4dac6" b={[-0.6, 0.6, -0.4, 0.4, -0.05, 0.05]} o={brushed ? 0 : 0.02} />
          {brushed ? (
            <>
              <StrokePaint strokes={mapStrokes()} position={[0, 0, 0.085]} />
              <Decal tex={guide} p={[-0.3, 0.29, 0.07]} w={0.42} h={0.1} />
            </>
          ) : (
            <Decal tex={mapTex()} p={[0, 0, 0.06]} w={1.1} h={0.72} />
          )}
        </group>
      </group>
      <group position={[2.4, 0.12, 2.6]}>
        <Bx c="#f2ecdf" b={[-0.45, 0.45, 0, 2.0, -0.2, 0.2]} o={brushed ? 0 : 0.03} />
        <Decal tex={about} p={[0, 1.8, 0.21]} w={0.8} h={0.2} />
        {brushed ? <StrokePaint strokes={sailStrokes()} position={[0, 1.05, 0.235]} /> : <Decal tex={posterTex('sail')} p={[0, 1.05, 0.21]} w={0.55} h={1.0} />}
      </group>
      {[3.3, 3.7, 4.1].map((x) => (
        <Toon key={x} geometry={geo.torusRack} color="#3f4a55" position={[x, 0.12, 3.1]} rotation={[0, Math.PI / 2, 0]} outline={0.015} radial={false} />
      ))}
      {/* benches, pots, greenery */}
      <Bench p={[-2.4, 0.12, 1.1]} w={1.2} />
      <Bench p={[1.0, 0.12, 1.1]} w={1.2} />
      <Bench p={[-0.7, 0.12, 3.8]} w={1.3} />
      <Pot p={[-2.1, 0.12, 3.4]} s={1.1} tree />
      <Pot p={[0.9, 0.12, 3.4]} s={1.1} tree />
      <Pot p={[-1.6, 0.12, 0.7]} s={0.8} tree />
      <Pot p={[0.2, 0.12, 0.7]} s={0.8} tree />
      <Planter p={[3.9, 0.12, 0.4]} w={2.0} d={0.8} flowers="#f4efe0" />
      <Planter p={[-4.6, 0.12, 3.3]} w={1.0} d={0.6} flowers="#f4efe0" />
      <Cypress p={[-3.5, 0.12, -0.4]} h={2.6} />
      <Cypress p={[1.5, 0.12, 0.6]} h={2.4} />
      <Tree p={[-4.8, 0.12, -1.8]} s={0.8} />
    </group>
  )
}
