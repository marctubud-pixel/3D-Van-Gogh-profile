import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { QualityToggle } from '../ui/QualityToggle'
import { BrushText } from '../locations/interiors/common'
import { ZONE_LABEL } from '../../shared/types'
import { useContent } from '../data/content'
import { LocationPanel } from '../locations/LocationPanel'
import { Interior, hasInterior } from '../locations/interiors/Interior'
import { MiniMap, TownMap, routeSorted } from '../navigation/TownMap'
import { ProjectDetail } from '../portfolio/ProjectDetail'
import { InfoContent } from '../ui/InfoPage'
import { Overlay } from '../ui/Overlay'
import { hasWebGL } from '../ui/webgl'
import { World } from '../world/World'
import { flatDistance, planPoint } from '../world/plane'
import { locationPoint } from '../world/island'
import type { WorldLocation } from '../../shared/types'
import { useDayNight } from '../world/daynight'
import { useGame } from './game'

function zoneAt(locations: WorldLocation[], x: number, y: number) {
  const p = planPoint(x, y)
  let best: WorldLocation | undefined
  let bd = Infinity
  for (const l of locations) {
    const d = flatDistance(locationPoint(l), p)
    if (d < bd) {
      bd = d
      best = l
    }
  }
  return best ? ZONE_LABEL[best.zone] : ZONE_LABEL['main-town']
}

const HELP_SEEN = 'my-world-help-seen'

export default function Explore() {
  const content = useContent((s) => s.content!)
  const navigate = useNavigate()
  const g = useGame()
  const [infoOpen, setInfoOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(() => !localStorage.getItem(HELP_SEEN))
  const [mapPick, setMapPick] = useState<string | null>(null)
  const intro = g.phase !== 'play'
  const closeHelp = () => {
    localStorage.setItem(HELP_SEEN, '1')
    setHelpOpen(false)
  }

  useEffect(() => {
    useGame.getState().setPhase('intro')
  }, [])

  useEffect(() => {
    if (!hasWebGL()) navigate('/index?fallback=1', { replace: true })
  }, [navigate])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === 'KeyM' && useGame.getState().phase === 'play' && !useGame.getState().openLocationId) useGame.getState().setMapOpen(!useGame.getState().mapOpen)
      if (e.code === 'KeyL' && useGame.getState().phase === 'play') useDayNight.getState().setLamp(!useDayNight.getState().lamp)
      if (e.code === 'KeyW') closeHelp()
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
          <p>拖动环视小岛 · Drag to look around the island</p>
          <button className="btn primary big" onClick={() => g.setPhase('flying')}>
            开始 START
          </button>
        </div>
      )}

      {!intro && (
      <>
      <Link to="/" className="hud-brand" aria-label="MY WORLD">
        <BrushText text="MY WORLD" size={18} />
      </Link>

      <div className="hud-zone">
        <BrushText text={zoneAt(content.locations, g.plan[0], g.plan[1])} size={22} />
      </div>

      {!g.mapOpen && <MiniMap locations={content.locations} you={g.plan} onOpen={() => { setMapPick(null); g.setMapOpen(true) }} />}

      <nav className="hud-bar">
        <button className="bar-btn" onClick={() => { setMapPick(null); g.setMapOpen(true) }} aria-label="MAP">
          <svg viewBox="0 0 24 24">
            <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14" />
          </svg>
          <small>地图 · M</small>
        </button>
        <Link className="bar-btn" to="/index" aria-label="INDEX">
          <svg viewBox="0 0 24 24">
            <path d="M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z" />
          </svg>
          <small>作品索引</small>
        </Link>
        <button className="bar-btn" onClick={() => setInfoOpen(true)} aria-label="INFO">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
          </svg>
          <small>关于我</small>
        </button>
        <i className="bar-sep" />
        <QualityToggle />
        <i className="bar-sep" />
        <button className="bar-btn" onClick={() => setHelpOpen(!helpOpen)} aria-label="HELP">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" />
            <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01" />
          </svg>
          <small>操作说明</small>
        </button>
        <button className="bar-btn" onClick={() => g.returnToPlaza()} aria-label="PLAZA">
          <svg viewBox="0 0 24 24">
            <path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4" />
          </svg>
          <small>回到出发点</small>
        </button>
      </nav>

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
            骑车时随时按 <kbd>E</kbd> 在路边停车步行，再到车旁按 <kbd>E</kbd> 上车；在建筑附近按 <kbd>E</kbd> 会自动停到门口，走到门口按 <kbd>E</kbd> 查看作品
          </p>
          <p>
            <kbd>M</kbd> 地图 · <kbd>L</kbd> 车灯 · <kbd>ESC</kbd> 关闭
          </p>
          <button className="btn ghost" onClick={closeHelp}>
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
              you={g.plan}
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

      {location && !project && hasInterior(location.id) && (
        <Overlay onClose={closeLocation} place={location.id} bare>
          <Interior content={content} location={location} onOpenProject={(id) => g.openProject(id)} onClose={closeLocation} />
        </Overlay>
      )}

      {location && (project || !hasInterior(location.id)) && (
        <Overlay onClose={closeLocation} onBack={project ? () => g.openProject(null) : undefined} place={location.id}>
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
