import { useMemo } from 'react'
import * as THREE from 'three'
import type { WorldLocation } from '../../shared/types'
import { dirToPlan, planDir } from '../world/sphere'
import { BRIDGE, PLAZA, ROUTE, ROUTE_ORDER, TITLE_CENTER, landValue, locationDir } from '../world/island'

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
  const [x, y] = dirToPlan(d)
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

function useIslandImage() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    const step = 2
    c.width = W
    c.height = H
    const g = c.getContext('2d')!
    g.fillStyle = '#8cc3c9'
    g.fillRect(0, 0, W, H)
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        const px = VIEW.x0 + ((x + step / 2) / W) * (VIEW.x1 - VIEW.x0)
        const py = VIEW.y1 - ((y + step / 2) / H) * (VIEW.y1 - VIEW.y0)
        const v = landValue(planDir(px, py))
        if (v < 0) continue
        g.fillStyle = v < 2.4 ? '#e8dfc4' : '#a9cf93'
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
    g.strokeStyle = '#2c3437'
    g.lineWidth = 9
    g.stroke()
    g.strokeStyle = '#f3ecd8'
    g.lineWidth = 6
    g.stroke()
    path(BRIDGE.a, BRIDGE.b)
    g.strokeStyle = '#e36f4c'
    g.lineWidth = 6
    g.stroke()
    g.setLineDash([5, 6])
    path(0, ROUTE.length - 1)
    g.strokeStyle = '#c9a15d'
    g.lineWidth = 1.5
    g.stroke()
    return c.toDataURL()
  }, [])
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
        const [x, y] = dirToMap(locationDir(l))
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
