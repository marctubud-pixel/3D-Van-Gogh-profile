import { useState } from 'react'
import { BrushText, Empty, Frame, Icon, Plaque, Thumb, sectionsOf, taglineOf, type InteriorProps } from './common'

export function Arcade({ location, projects, onOpenProject }: InteriorProps) {
  const sections = sectionsOf(location, projects)
  const [si, setSi] = useState(0)
  const section = sections[si]
  const list = section?.projects ?? []
  return (
    <Frame kind="arcade">
      <Plaque title={location.name} sub={taglineOf(location)} />
      <nav className="game-tabs">
        {sections.map((s, i) => (
          <button key={s.name} className={i === si ? 'on' : ''} onClick={() => setSi(i)}>
            <Icon name="game" />
            {s.name}
          </button>
        ))}
      </nav>
      <section className="game-board">
        <header className="game-head">
          <Icon name="game" />
          <BrushText text={section?.name ?? location.name} size={28} />
          <span className="game-motto">
            PLAY
            <br />
            GAMES
            <br />
            BE HAPPY
          </span>
        </header>
        <ul className="game-list">
          {list.map((p) => {
            const demo = p.externalLink
            return (
              <li key={p.id} className="game-row">
                <button className="game-pick" onClick={() => onOpenProject(p.id)}>
                  <Thumb project={p} />
                  <span>
                    <b>{p.title}</b>
                    {p.duration ? (
                      <small>
                        <Icon name="clock" className="clock" />
                        游玩时间 {p.duration}
                      </small>
                    ) : (
                      p.subtitle && <small>{p.subtitle}</small>
                    )}
                  </span>
                </button>
                {demo && (
                  <a className="int-btn" href={demo} target="_blank" rel="noreferrer">
                    Play Demo
                  </a>
                )}
              </li>
            )
          })}
        </ul>
        {!list.length && <Empty text={`「${section?.name ?? ''}」还没有内容，在后台添加作品并选择这个栏目`} />}
      </section>
    </Frame>
  )
}
