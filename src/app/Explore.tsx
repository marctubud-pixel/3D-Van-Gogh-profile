import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ZONE_LABEL } from '../../shared/types'
import { useContent } from '../data/content'
import { LocationPanel } from '../locations/LocationPanel'
import { TownMap, routeSorted } from '../navigation/TownMap'
import { ProjectDetail } from '../portfolio/ProjectDetail'
import { InfoContent } from '../ui/InfoPage'
import { Overlay } from '../ui/Overlay'
import { hasWebGL } from '../ui/webgl'
import { World } from '../world/World'
import { dirFromLatLon } from '../world/sphere'
import type { WorldLocation } from '../../shared/types'
import { useGame } from './game'

function zoneAt(locations: WorldLocation[], lat: number, lon: number) {
  const p = dirFromLatLon(lat, lon)
  let best: WorldLocation | undefined
  let bd = Infinity
  for (const l of locations) {
    const d = dirFromLatLon(l.lat, l.lon).angleTo(p)
    if (d < bd) {
      bd = d
      best = l
    }
  }
  return best ? ZONE_LABEL[best.zone] : ZONE_LABEL['main-town']
}

export default function Explore() {
  const content = useContent((s) => s.content!)
  const navigate = useNavigate()
  const g = useGame()
  const [infoOpen, setInfoOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(true)
  const [mapPick, setMapPick] = useState<string | null>(null)
  const intro = g.phase !== 'play'

  useEffect(() => {
    useGame.getState().setPhase('intro')
  }, [])

  useEffect(() => {
    if (!hasWebGL()) navigate('/index?fallback=1', { replace: true })
  }, [navigate])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === 'KeyM' && useGame.getState().phase === 'play' && !useGame.getState().openLocationId) useGame.getState().setMapOpen(!useGame.getState().mapOpen)
      if (e.code === 'KeyW') setHelpOpen(false)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  const location = content.locations.find((l) => l.id === g.openLocationId)
  const project = content.projects.find((p) => p.id === g.openProjectId)

  const closeLocation = () => {
    g.openLocation(null)
    if (useGame.getState().player === 'INTERACTING') g.setPlayer('WALKING')
  }

  return (
    <div className="explore">
      <World locations={content.locations} onError={() => navigate('/index?fallback=1', { replace: true })} />

      {g.phase === 'intro' && (
        <div className="intro">
          <p>拖动旋转星球 · Drag to spin the island</p>
          <button className="btn primary big" onClick={() => g.setPhase('flying')}>
            开始 START
          </button>
        </div>
      )}

      {!intro && (
      <>
      <div className="hud-top">
        <Link to="/" className="brand">
          MY WORLD
        </Link>
        <Link className="icon-btn hud-menu" to="/index" aria-label="INDEX">
          <svg viewBox="0 0 24 24">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </Link>
      </div>

      <div className="hud-dock">
        <button className="icon-btn" onClick={() => { setMapPick(null); g.setMapOpen(true) }} aria-label="MAP">
          <svg viewBox="0 0 24 24">
            <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14" />
          </svg>
          <small>MAP · M</small>
        </button>
        <Link className="icon-btn" to="/index" aria-label="INDEX">
          <svg viewBox="0 0 24 24">
            <path d="M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z" />
          </svg>
          <small>INDEX</small>
        </Link>
        <button className="icon-btn" onClick={() => setInfoOpen(true)} aria-label="INFO">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
          </svg>
          <small>INFO</small>
        </button>
        <button className="icon-btn" onClick={() => g.returnToPlaza()} aria-label="PLAZA">
          <svg viewBox="0 0 24 24">
            <path d="M3 11l9-7 9 7 M6 9v11h12V9 M10 20v-6h4v6" />
          </svg>
          <small>RETURN TO PLAZA</small>
        </button>
      </div>

      <h2 className="zone-label">
        {zoneAt(content.locations, g.latLon[0], g.latLon[1])
          .split(' ')
          .map((w) => (
            <span key={w} style={{ display: 'block' }}>
              {w}
            </span>
          ))}
      </h2>

      <div className="hud-state">{g.player}</div>

      {g.prompt && !location && (
        <div className="prompt">
          <kbd>{g.prompt.key}</kbd>
          {g.prompt.label.replace(/^E · /, '')}
        </div>
      )}
      {g.toast && <div className="toast">{g.toast}</div>}

      {helpOpen && (
        <div className="help">
          <strong>HOW TO PLAY</strong>
          <p>
            <kbd>W</kbd> 前进 <kbd>S</kbd> 掉头（按住刹车） <kbd>A</kbd>
            <kbd>D</kbd> 转向 · 拖动鼠标看四周
          </p>
          <p>
            靠近建筑出现 <b>P 停靠</b> 时按 <kbd>E</kbd> 自动停车下车，走到门口按 <kbd>E</kbd> 查看作品
          </p>
          <p>
            <kbd>M</kbd> 地图 · <kbd>ESC</kbd> 关闭
          </p>
          <button className="btn ghost" onClick={() => setHelpOpen(false)}>
            GOT IT
          </button>
        </div>
      )}

      {g.mapOpen && (
        <Overlay onClose={() => g.setMapOpen(false)}>
          <h1 className="page-title">MAP</h1>
          <div className="map-layout">
            <TownMap
              locations={content.locations}
              you={g.latLon}
              activeId={mapPick ?? g.routeTargetId}
              onSelect={(l) => setMapPick(l.id)}
            />
            <ol className="map-stops">
              {routeSorted(content.locations).map((l, i) => (
                <li key={l.id} className={(mapPick ?? g.routeTargetId) === l.id ? 'active' : ''}>
                  <b>{String(i + 1).padStart(2, '0')}</b>
                  <span onClick={() => setMapPick(l.id)}>{l.name}</span>
                  <button className="btn primary" onClick={() => g.teleportTo(l.id)}>
                    直接抵达
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <div className="row">
            <button className="btn" onClick={() => g.returnToPlaza()}>
              回到出发点
            </button>
            {mapPick && (
              <button
                className="btn"
                onClick={() => {
                  g.setRouteTarget(mapPick)
                  g.setMapOpen(false)
                  g.showToast('沿着发光的信标骑过去吧')
                }}
              >
                标记路线
              </button>
            )}
            {g.routeTargetId && (
              <button className="btn" onClick={() => g.setRouteTarget(null)}>
                清除路线
              </button>
            )}
          </div>
        </Overlay>
      )}
      </>
      )}

      {location && (
        <Overlay onClose={closeLocation} onBack={project ? () => g.openProject(null) : undefined}>
          {project ? (
            <ProjectDetail project={project} location={location} />
          ) : (
            <LocationPanel content={content} location={location} onOpenProject={(id) => g.openProject(id)} />
          )}
        </Overlay>
      )}

      {infoOpen && (
        <Overlay onClose={() => setInfoOpen(false)}>
          <InfoContent />
        </Overlay>
      )}
    </div>
  )
}
