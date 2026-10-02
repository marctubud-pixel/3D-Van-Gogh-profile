import { useMemo } from 'react'
import * as THREE from 'three'
import type { WorldLocation } from '../../shared/types'
import { planPoint, pointToPlan } from '../world/plane'
import { playerFwd } from '../world/occlusion'
import { BRIDGE, CIVIC, PLAZA, ROUTE, ROUTE_ORDER, SPOKES, TITLE_CENTER, landValue, locationPoint } from '../world/island'

interface TownMapProps {
  locations: WorldLocation[]
  you?: [number, number]
  activeId?: string | null
  onSelect: (loc: WorldLocation) => void
}

/** Map window on the flat island (x east, y north, world units) framing the island and its lettering. */
const VIEW = { x0: -100, x1: 118, y0: -150, y1: 104 }
const W = 520
const H = Math.round((W * (VIEW.y1 - VIEW.y0)) / (VIEW.x1 - VIEW.x0))

/** Percent position of the flat-map point (x, y) inside the map frame. */
export function toMap(x: number, y: number): [number, number] {
  return [((x - VIEW.x0) / (VIEW.x1 - VIEW.x0)) * 100, ((VIEW.y1 - y) / (VIEW.y1 - VIEW.y0)) * 100]
}

const dirToMap = (d: THREE.Vector3) => {
  const [x, y] = pointToPlan(d)
  return toMap(x, y)
}

/** Landmarks sorted by the route order; unknown ids follow at the end. */
export function routeSorted(locations: WorldLocation[]) {
  const rank = (id: string) => {
    const i = ROUTE_ORDER.indexOf(id)
    return i < 0 ? 99 : i
  }
  return [...locations].sort((a, b) => rank(a.id) - rank(b.id))
}

const PAPER = { sea: '#8cc3c9', beach: '#e8dfc4', land: '#a9cf93', casing: '#2c3437', road: '#f3ecd8', dash: '#c9a15d' }
const MINI_INK = { sea: 'rgba(0,0,0,0)', beach: '#4a5363', land: '#3e4757', casing: '#3e4757', road: '#9aa3b1', dash: '' }

function useIslandImage(ink = PAPER) {
  return useMemo(() => {
    const c = document.createElement('canvas')
    const step = 2
    c.width = W
    c.height = H
    const g = c.getContext('2d')!
    g.fillStyle = ink.sea
    g.fillRect(0, 0, W, H)
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        const px = VIEW.x0 + ((x + step / 2) / W) * (VIEW.x1 - VIEW.x0)
        const py = VIEW.y1 - ((y + step / 2) / H) * (VIEW.y1 - VIEW.y0)
        const v = landValue(planPoint(px, py))
        if (v < 0) continue
        g.fillStyle = v < 2.4 ? ink.beach : ink.land
        g.fillRect(x, y, step, step)
      }
    }
    const px = (d: THREE.Vector3) => {
      const [x, y] = dirToMap(d)
      return [(x / 100) * W, (y / 100) * H] as const
    }
    const path = (from: number, to: number) => {
      g.beginPath()
      for (let i = from; i <= to; i++) {
        const [x, y] = px(ROUTE[i])
        if (i === from) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
    }
    g.lineCap = 'round'
    g.lineJoin = 'round'
    path(0, ROUTE.length - 1)
    g.strokeStyle = ink.casing
    g.lineWidth = 9
    g.stroke()
    g.strokeStyle = ink.road
    g.lineWidth = 6
    g.stroke()
    const ppu = W / (VIEW.x1 - VIEW.x0)
    for (const k of SPOKES) {
      const [ax, ay] = px(k.a)
      const [bx, by] = px(k.b)
      g.beginPath()
      g.moveTo(ax, ay)
      g.lineTo(bx, by)
      g.strokeStyle = ink.road
      g.lineWidth = 3
      g.stroke()
    }
    const [cx, cy] = px(PLAZA)
    g.beginPath()
    g.arc(cx, cy, CIVIC.r * ppu, 0, Math.PI * 2)
    g.fillStyle = ink.road
    g.fill()
    if (!ink.dash) return c.toDataURL()
    path(BRIDGE.a, BRIDGE.b)
    g.strokeStyle = '#e36f4c'
    g.lineWidth = 6
    g.stroke()
    g.setLineDash([5, 6])
    path(0, ROUTE.length - 1)
    g.strokeStyle = ink.dash
    g.lineWidth = 1.5
    g.stroke()
    return c.toDataURL()
  }, [ink])
}

const MINI = { size: 148, reach: 45 }

/** Round corner map centred on the player, turning with their heading arrow; click opens the full map. */
export function MiniMap({ locations, you, onOpen }: { locations: WorldLocation[]; you: [number, number]; onOpen: () => void }) {
  const img = useIslandImage(MINI_INK)
  const ppu = MINI.size / (MINI.reach * 2)
  const half = MINI.size / 2
  const bx = half - (you[0] - VIEW.x0) * ppu
  const by = half - (VIEW.y1 - you[1]) * ppu
  const bearing = Math.atan2(playerFwd.x, -playerFwd.z)
  return (
    <button
      className="minimap"
      onClick={onOpen}
      aria-label="MINIMAP"
      style={{ backgroundImage: `url(${img})`, backgroundSize: `${(VIEW.x1 - VIEW.x0) * ppu}px ${(VIEW.y1 - VIEW.y0) * ppu}px`, backgroundPosition: `${bx}px ${by}px` }}
    >
      {locations.map((l) => {
        const [lx, ly] = pointToPlan(locationPoint(l))
        const dx = lx - you[0]
        const dy = ly - you[1]
        if (Math.hypot(dx, dy) > MINI.reach * 0.92) return null
        return (
          <i key={l.id} className="mm-pin" style={{ left: half + dx * ppu, top: half - dy * ppu, ['--pin' as string]: l.color }}>
            <span>{l.name}</span>
          </i>
        )
      })}
      <i className="mm-you" style={{ transform: `translate(-50%, -66%) rotate(${bearing}rad)` }} />
      <b className="mm-n">N</b>
    </button>
  )
}

/** Illustrated island map: the winding road, numbered stops and your position. */
export function TownMap({ locations, you, activeId, onSelect }: TownMapProps) {
  const img = useIslandImage()
  const sorted = routeSorted(locations)
  const [yx, yy] = you ? toMap(you[0], you[1]) : [0, 0]
  const [sx, sy] = dirToMap(PLAZA)
  const [tx, ty] = dirToMap(TITLE_CENTER)
  return (
    <div className="townmap" style={{ aspectRatio: `${W} / ${H}`, width: `min(100%, calc(64vh * ${W / H}))`, margin: '0 auto', backgroundImage: `url(${img})`, backgroundSize: '100% 100%' }}>
      <div className="map-plaza" style={{ left: `${sx}%`, top: `${sy}%` }}>
        START · SERVICE CENTER
      </div>
      <div className="map-title" style={{ left: `${tx}%`, top: `${ty}%` }}>
        MARC ISLAND
      </div>
      {sorted.map((l, i) => {
        const [x, y] = dirToMap(locationPoint(l))
        return (
          <button
            key={l.id}
            className={`map-pin ${activeId === l.id ? 'active' : ''}`}
            style={{ left: `${x}%`, top: `${y}%`, ['--pin' as string]: l.color }}
            onClick={() => onSelect(l)}
          >
            <i />
            <span>
              {String(i + 1).padStart(2, '0')} {l.name}
            </span>
          </button>
        )
      })}
      {you && (
        <div className="map-you" style={{ left: `${yx}%`, top: `${yy}%` }}>
          <i />
          <span>YOU</span>
        </div>
      )}
    </div>
  )
}
