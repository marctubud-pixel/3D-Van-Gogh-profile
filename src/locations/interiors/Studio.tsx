import { useState } from 'react'
import { Empty, Frame, Icon, Plaque, Thumb, sectionsOf, taglineOf, type InteriorProps } from './common'

export function Studio({ location, projects, onOpenProject, onClose }: InteriorProps) {
  const sections = sectionsOf(location, projects)
  const [si, setSi] = useState(() => Math.max(0, sections.findIndex((s) => s.projects.length)))
  const [pi, setPi] = useState(0)
  const section = sections[si]
  const list = section?.projects ?? []
  const p = list[pi]
  const shots = p ? [p.cover, ...(p.gallery ?? [])].filter(Boolean) : []
  return (
    <Frame kind="studio">
      <Plaque title={location.name} sub={taglineOf(location)} />
      <div className="studio">
        <ul className="int-list">
          {sections.map((s, i) => (
            <li key={s.name}>
              <button className={i === si ? 'on' : ''} onClick={() => { setSi(i); setPi(0) }}>
                <Icon name={s.name} />
                <span>{s.name}</span>
                <small>→</small>
              </button>
            </li>
          ))}
        </ul>
        <section className="studio-view">
          <h2 className="int-h2">
            <Icon name={section?.name ?? ''} />
            {section?.name}
            <span className="int-paged">
              {list.length ? pi + 1 : 0} / {list.length}
            </span>
          </h2>
          {p ? (
            <>
              <div className="album">
                {shots[0] ? <img className="int-thumb big" src={shots[0]} alt={p.title} /> : <Thumb project={p} className="big" />}
                <div className="album-side">
                  {list.slice(0, 3).map((x, k) => (
                    <button key={x.id} className={k === pi ? 'on' : ''} onClick={() => setPi(k)}>
                      <Thumb project={x} />
                    </button>
                  ))}
                </div>
              </div>
              <p className="studio-caption">
                <b>{p.title}</b> {p.subtitle}
              </p>
            </>
          ) : (
            <Empty text={`「${section?.name ?? ''}」的收藏还在整理中`} />
          )}
          <div className="int-actions">
            <button className="int-btn" disabled={!p} onClick={() => p && onOpenProject(p.id)}>
              ◉ VIEW
            </button>
            <button className="int-btn ghost" disabled={list.length < 2} onClick={() => setPi((pi + 1) % list.length)}>
              NEXT ITEM
            </button>
            <button className="int-btn ghost" onClick={onClose}>
              ← BACK
            </button>
          </div>
        </section>
      </div>
    </Frame>
  )
}
