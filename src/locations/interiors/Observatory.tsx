import { useState } from 'react'
import { BrushText, Frame, Plaque, taglineOf, type InteriorProps } from './common'

function spot(k: number, n: number): [number, number] {
  const a = (k / Math.max(1, n)) * Math.PI * 2 + 0.6
  const r = 30 + ((k * 37) % 12)
  return [50 + Math.cos(a) * r, 50 + Math.sin(a) * r * 0.72]
}

export function Observatory({ location, projects, onOpenProject }: InteriorProps) {
  const goals = location.description.split('·').map((s) => s.trim()).filter(Boolean)
  const stars = projects.length
    ? projects.map((p) => ({ id: p.id, label: p.title, text: p.subtitle || p.context || '' }))
    : goals.map((g) => ({ id: '', label: g, text: '' }))
  const [i, setI] = useState(0)
  const cur = stars[i]
  const pts = stars.map((_, k) => spot(k, stars.length))
  return (
    <Frame kind="observatory">
      <Plaque title={location.name} sub={taglineOf(location)} />
      <div className="starmap">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <polyline points={[...pts, pts[0]].filter(Boolean).map((p) => p.join(',')).join(' ')} />
        </svg>
        {stars.map((s, k) => (
          <button
            key={s.label + k}
            className={`star${k === i ? ' on' : ''}`}
            style={{ left: `${pts[k][0]}%`, top: `${pts[k][1]}%` }}
            onClick={() => setI(k)}
          >
            ✦<span>{s.label}</span>
          </button>
        ))}
        <article className="star-card">
          <p className="int-kicker">{location.question}</p>
          <h2>
            <BrushText text={cur?.label ?? ''} size={26} />
          </h2>
          {cur?.text && <p>{cur.text}</p>}
          {cur?.id ? (
            <button className="int-btn" onClick={() => onOpenProject(cur.id)}>
              观测详情 ›
            </button>
          ) : (
            <p className="int-empty">Coming soon · 还在望远镜里</p>
          )}
        </article>
      </div>
    </Frame>
  )
}
