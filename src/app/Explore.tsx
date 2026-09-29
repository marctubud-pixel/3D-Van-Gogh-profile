import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ZONE_LABEL } from '../../shared/types'
import { useContent } from '../data/content'
import { LocationPanel } from '../locations/LocationPanel'
import { TownMap } from '../navigation/TownMap'
import { ProjectDetail } from '../portfolio/ProjectDetail'
import { InfoContent } from '../ui/InfoPage'
import { Overlay } from '../ui/Overlay'
import { hasWebGL } from '../ui/webgl'
import { World } from '../world/World'
import { useGame } from './game'

function zoneAt(lat: number, lon: number) {
  if (lat > 35) return ZONE_LABEL['future-hill']
  if (Math.abs(lon) > 100) return ZONE_LABEL['interest-area']
  return ZONE_LABEL['main-town']
}

export default function Explore() {
  const content = useContent((s) => s.content!)
  const navigate = useNavigate()
  const g = useGame()
  const [infoOpen, setInfoOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(true)

  useEffect(() => {
    if (!hasWebGL()) navigate('/index?fallback=1', { replace: true })
  }, [navigate])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === 'KeyM' && !useGame.getState().openLocationId) useGame.getState().setMapOpen(!useGame.getState().mapOpen)
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
        <button className="icon-btn" onClick={() => g.setMapOpen(true)} aria-label="MAP">
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
        {zoneAt(g.latLon[0], g.latLon[1])
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
          {g.prompt.label.replace(/^E · /, '').replace('BIKE PARKING · E · ', 'BIKE PARKING · ')}
        </div>
      )}
      {g.toast && <div className="toast">{g.toast}</div>}

      {helpOpen && (
        <div className="help">
          <strong>HOW TO PLAY</strong>
          <p>
            <kbd>W</kbd> 前进 <kbd>S</kbd> 刹车/后退 <kbd>A</kbd>
            <kbd>D</kbd> 转向 · 拖动鼠标看四周
          </p>
          <p>
            在 <b>P</b> 停车点按 <kbd>E</kbd> 停车下车，走到建筑门口按 <kbd>E</kbd> 查看作品
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
          <TownMap
            locations={content.locations}
            you={g.latLon}
            activeId={g.routeTargetId}
            onSelect={(l) => {
              g.setRouteTarget(g.routeTargetId === l.id ? null : l.id)
              g.showToast(`Route: follow the glowing beacon to ${l.name}`)
            }}
          />
          <div className="row">
            <button className="btn primary" onClick={() => g.returnToPlaza()}>
              RETURN TO PLAZA
            </button>
            {g.routeTargetId && (
              <button className="btn" onClick={() => g.setRouteTarget(null)}>
                CLEAR ROUTE
              </button>
            )}
          </div>
        </Overlay>
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
