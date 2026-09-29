import { useContent } from '../data/content'
import { TopNav } from './Nav'

export function InfoContent() {
  const p = useContent((s) => s.content!.profile)
  return (
    <div className="info">
      <div className="info-head">
        {p.avatar && <img className="avatar" src={p.avatar} alt={p.name} />}
        <div>
          <h1>{p.name}</h1>
          <p className="eyebrow">{p.headline}</p>
        </div>
      </div>
      <p className="bio">{p.shortBio}</p>
      <section>
        <h3>CURRENT DIRECTION</h3>
        <p>{p.currentDirection}</p>
      </section>
      {p.howIWork.length > 0 && (
        <section>
          <h3>HOW I WORK</h3>
          <div className="flow">
            {p.howIWork.map((s, i) => (
              <span key={i}>{s}</span>
            ))}
          </div>
        </section>
      )}
      {p.experience.length > 0 && (
        <section>
          <h3>EXPERIENCE</h3>
          <ul className="exp">
            {p.experience.map((e, i) => (
              <li key={i}>
                <span className="period">{e.period}</span>
                <div>
                  <strong>{e.title}</strong> · {e.org}
                  {e.description && <p>{e.description}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {p.skills.length > 0 && (
        <section>
          <h3>SKILLS</h3>
          <div className="tags">
            {p.skills.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
        </section>
      )}
      <section>
        <h3>CONTACT</h3>
        {p.email && (
          <p>
            <a href={`mailto:${p.email}`}>{p.email}</a>
          </p>
        )}
        {p.location && <p>{p.location}</p>}
        <div className="links">
          {p.links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noreferrer">
              {l.label} ↗
            </a>
          ))}
        </div>
      </section>
      {p.cvFile && (
        <a className="btn primary" href={p.cvFile} target="_blank" rel="noreferrer">
          DOWNLOAD CV
        </a>
      )}
    </div>
  )
}

export function InfoPage() {
  return (
    <div className="page">
      <TopNav />
      <main className="page-body narrow">
        <InfoContent />
      </main>
    </div>
  )
}
