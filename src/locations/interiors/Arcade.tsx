import { useState } from 'react'
import { Empty, Frame, Icon, Plaque, Thumb, pad, taglineOf, type InteriorProps } from './common'

export function Arcade({ location, projects, onOpenProject, onClose }: InteriorProps) {
  const [i, setI] = useState(0)
  const p = projects[i]
  return (
    <Frame kind="arcade">
      <Plaque title={location.name} sub={taglineOf(location)} />
      <div className="cabinet">
        <div className="cabinet-screen">
          {projects.length ? (
            <ul className="cartridges">
              {projects.map((x, k) => (
                <li key={x.id}>
                  <button className={k === i ? 'on' : ''} onClick={() => setI(k)} onDoubleClick={() => onOpenProject(x.id)}>
                    <Thumb project={x} />
                    <span>
                      {pad(k + 1)} {x.title}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="INSERT COIN · 游戏卡带还没放进来" />
          )}
        </div>
        <aside className="cabinet-info">
          <h2 className="int-h2">
            <Icon name="game" />
            {p ? p.title : 'NO GAME'}
          </h2>
          {p && <p className="folder-text">{p.subtitle || p.context}</p>}
          {p?.tags?.length ? (
            <div className="chips">
              {p.tags.map((t) => (
                <span key={t}>#{t}</span>
              ))}
            </div>
          ) : null}
          <p className="int-kicker">{location.question}</p>
        </aside>
      </div>
      <div className="int-actions wide">
        <button className="int-btn yellow" disabled={!p} onClick={() => p && onOpenProject(p.id)}>
          ▶ START
        </button>
        <button className="int-btn ghost" onClick={onClose}>
          EXIT
        </button>
      </div>
    </Frame>
  )
}
