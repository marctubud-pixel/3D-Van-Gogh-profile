import { useState } from 'react'
import { Doodle, Empty, Frame, Icon, Paged, Plaque, cycle, sectionsOf, taglineOf, type InteriorProps } from './common'

export function WriteHouse({ location, projects, onOpenProject }: InteriorProps) {
  const sections = sectionsOf(location, projects)
  const [si, setSi] = useState(() => Math.max(0, sections.findIndex((s) => s.projects.length)))
  const [pi, setPi] = useState(0)
  const section = sections[si]
  const list = section?.projects ?? []
  const page = list[pi]
  const text = page?.body || page?.context || page?.subtitle || ''
  return (
    <Frame kind="book">
      <Plaque title={location.name} sub={taglineOf(location)} />
      <div className="book">
        <nav className="book-tabs" aria-hidden>
          <span>IDEA</span>
          <span>WORDS</span>
          <span>LIFE</span>
        </nav>
        <section className="book-page left">
          <h2 className="int-h2">
            <Icon name="writing" />
            文案作品
          </h2>
          <p className="int-kicker">· WRITING PORTFOLIO ·</p>
          <ul className="int-list">
            {sections.map((s, i) => (
              <li key={s.name}>
                <button className={i === si ? 'on' : ''} onClick={() => { setSi(i); setPi(0) }}>
                  <Icon name={s.name} />
                  <span>{s.name}</span>
                  <small>{s.projects.length || ''}</small>
                </button>
              </li>
            ))}
          </ul>
          <Doodle>Good ideas travel further.</Doodle>
        </section>
        <section className="book-page right">
          {page ? (
            <article className="book-sheet">
              <h2>{page.title}</h2>
              {page.subtitle && <p className="int-kicker">—— {page.subtitle} ——</p>}
              <div className="book-text">{text}</div>
              <footer>
                <Paged index={pi} total={list.length} />
                <div className="int-actions">
                  <button className="int-btn" onClick={() => onOpenProject(page.id)}>
                    查看全文
                  </button>
                  <button className="int-btn ghost" disabled={list.length < 2} onClick={() => setPi(cycle(pi, -1, list.length))}>
                    ◀ 上一页
                  </button>
                  <button className="int-btn" disabled={list.length < 2} onClick={() => setPi(cycle(pi, 1, list.length))}>
                    下一页 ▶
                  </button>
                </div>
              </footer>
            </article>
          ) : (
            <Empty text={`「${section?.name ?? location.name}」还没有文章`} />
          )}
          <Doodle className="note">A brighter you</Doodle>
        </section>
      </div>
    </Frame>
  )
}
