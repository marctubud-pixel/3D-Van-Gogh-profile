import { useMemo } from 'react'
import * as THREE from 'three'
import type { WorldLocation } from '../../shared/types'
import { dirFromLatLon, latLonFromDir } from '../world/sphere'
import { BRIDGE, ROUTE, ROUTE_ORDER, TITLE_CENTER, landValue } from '../world/island'

interface TownMapProps {
  locations: WorldLocation[]
  you?: [number, number]
  activeId?: string | null
  onSelect: (loc: WorldLocation) => void
}

/** Map window (degrees) framing the island and its lettering. */
const VIEW = { lon0: -40, lon1: 250, lat0: -48, lat1: 50 }
const W = 580
const H = Math.round((W * (VIEW.lat1 - VIEW.lat0)) / (VIEW.lon1 - VIEW.lon0) * 1.25)

function unwrap(lon: number) {
  let l = lon
  while (l < VIEW.lon0) l += 360
  while (l > VIEW.lon0 + 360) l -= 360
  return l
}

/** Percent position of (lat, lon) inside the map frame. */
export function toMap(lat: number, lon: number): [number, number] {
  return [((unwrap(lon) - VIEW.lon0) / (VIEW.lon1 - VIEW.lon0)) * 100, ((VIEW.lat1 - lat) / (VIEW.lat1 - VIEW.lat0)) * 100]
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
        const lon = VIEW.lon0 + (x / W) * (VIEW.lon1 - VIEW.lon0)
        const lat = VIEW.lat1 - (y / H) * (VIEW.lat1 - VIEW.lat0)
        const v = landValue(dirFromLatLon(lat, lon))
        if (v < 0) continue
        g.fillStyle = v < 2.4 ? '#e8dfc4' : '#a9cf93'
        g.fillRect(x, y, step, step)
      }
    }
    const px = (d: THREE.Vector3) => {
      const [la, lo] = latLonFromDir(d)
      const [x, y] = toMap(la, lo)
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
  const [sx, sy] = toMap(0, -12)
  const [tx, ty] = toMap(TITLE_CENTER.lat, TITLE_CENTER.lon)
  return (
    <div className="townmap" style={{ aspectRatio: `${W} / ${H}`, backgroundImage: `url(${img})`, backgroundSize: '100% 100%' }}>
      <div className="map-plaza" style={{ left: `${sx}%`, top: `${sy}%` }}>
        START · SERVICE CENTER
      </div>
      <div className="map-title" style={{ left: `${tx}%`, top: `${ty}%` }}>
        MARC ISLAND
      </div>
      {sorted.map((l, i) => {
        const [x, y] = toMap(l.lat, l.lon)
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
