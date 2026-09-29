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
        <span className="zone">{zoneAt(g.latLon[0], g.latLon[1])}</span>
        <div className="hud-actions">
          <button className="btn" onClick={() => g.setMapOpen(true)}>
            MAP · M
          </button>
          <Link className="btn" to="/index">
            INDEX
          </Link>
          <button className="btn" onClick={() => setInfoOpen(true)}>
            INFO
          </button>
        </div>
      </div>

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
