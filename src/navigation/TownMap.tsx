import type { WorldLocation } from '../../shared/types'
import { ZONE_LABEL } from '../../shared/types'

interface TownMapProps {
  locations: WorldLocation[]
  you?: [number, number]
  activeId?: string | null
  onSelect: (loc: WorldLocation) => void
}

function toMap(lat: number, lon: number): [number, number] {
  return [((((lon + 180) % 360) + 360) % 360) / 3.6, 50 - lat / 1.8]
}

/** Stylized tourist map: equirectangular unwrap of the mini planet. */
export function TownMap({ locations, you, activeId, onSelect }: TownMapProps) {
  const [yx, yy] = you ? toMap(you[0], you[1]) : [0, 0]
  const [px, py] = toMap(0, 0)
  return (
    <div className="townmap">
      <div className="map-sea" style={{ top: `${50 + 38 / 1.8}%` }} />
      <div className="map-road h" style={{ top: '50%' }} />
      <div className="map-road v" style={{ left: '50%' }} />
      <div className="map-road v" style={{ left: '0%' }} />
      <div className="map-road v" style={{ left: '100%' }} />
      <div className="map-zone" style={{ left: '38%', top: '60%' }}>
        {ZONE_LABEL['main-town']}
      </div>
      <div className="map-zone" style={{ left: '4%', top: '60%' }}>
        {ZONE_LABEL['interest-area']}
      </div>
      <div className="map-zone" style={{ left: '44%', top: '6%' }}>
        {ZONE_LABEL['future-hill']}
      </div>
      <div className="map-plaza" style={{ left: `${px}%`, top: `${py}%` }}>
        PLAZA
      </div>
      {locations.map((l) => {
        const [x, y] = toMap(l.lat, l.lon)
        return (
          <button
            key={l.id}
            className={`map-pin ${activeId === l.id ? 'active' : ''}`}
            style={{ left: `${x}%`, top: `${y}%`, ['--pin' as string]: l.color }}
            onClick={() => onSelect(l)}
          >
            <i />
            <span>{l.name}</span>
          </button>
        )
      })}
      {you && (
        <div className="map-you" style={{ left: `${yx}%`, top: `${yy}%` }}>
          <i />
          <span>YOU ARE HERE</span>
        </div>
      )}
    </div>
  )
}
