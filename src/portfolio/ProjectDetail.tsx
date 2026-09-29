import type { PortfolioProject, WorldLocation } from '../../shared/types'
import { Cover } from './Cover'

const CASE_FIELDS: [keyof PortfolioProject, string][] = [
  ['context', 'CONTEXT / BRIEF'],
  ['problem', 'PROBLEM'],
  ['insight', 'INSIGHT'],
  ['strategy', 'STRATEGY'],
  ['idea', 'IDEA'],
  ['execution', 'EXECUTION'],
  ['contribution', 'WHAT I DID'],
  ['result', 'RESULT'],
  ['impact', 'IMPACT'],
]

function isEmbeddable(url: string) {
  return /youtube\.com|youtu\.be|vimeo\.com|bilibili\.com/.test(url)
}

function embedUrl(url: string) {
  const yt = url.match(/(?:youtu\.be\/|v=)([\w-]{6,})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vm = url.match(/vimeo\.com\/(\d+)/)
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`
  const bv = url.match(/bilibili\.com\/video\/(BV\w+)/)
  if (bv) return `https://player.bilibili.com/player.html?bvid=${bv[1]}&autoplay=0`
  return url
}

export function ProjectDetail({ project, location }: { project: PortfolioProject; location?: WorldLocation }) {
  return (
    <article className="project">
      <header className="project-head">
        <p className="eyebrow">
          {project.category}
          {project.year ? ` · ${project.year}` : ''}
          {location ? ` · ${location.name}` : ''}
        </p>
        <h1>{project.title}</h1>
        {project.subtitle && <p className="one-liner">{project.subtitle}</p>}
      </header>

      {project.video ? (
        isEmbeddable(project.video) ? (
          <div className="video-frame">
            <iframe src={embedUrl(project.video)} title={project.title} allowFullScreen allow="autoplay; fullscreen" />
          </div>
        ) : (
          <video className="video" src={project.video} controls poster={project.cover || undefined} />
        )
      ) : (
        <Cover project={project} className="hero" />
      )}

      <dl className="meta">
        {project.role && (
          <>
            <dt>MY ROLE</dt>
            <dd>{project.role}</dd>
          </>
        )}
        {project.tools?.length ? (
          <>
            <dt>TOOLS</dt>
            <dd>{project.tools.join(' · ')}</dd>
          </>
        ) : null}
        {project.collaborators?.length ? (
          <>
            <dt>COLLABORATORS</dt>
            <dd>{project.collaborators.join(' · ')}</dd>
          </>
        ) : null}
        {project.aiUsed && (
          <>
            <dt>AI</dt>
            <dd>AI-assisted</dd>
          </>
        )}
      </dl>

      <div className="case">
        {CASE_FIELDS.filter(([k]) => project[k]).map(([k, label]) => (
          <section key={k}>
            <h3>{label}</h3>
            <p>{String(project[k])}</p>
          </section>
        ))}
      </div>

      {project.gallery?.length ? (
        <div className="gallery">
          {project.gallery.map((src) => (
            <a key={src} href={src} target="_blank" rel="noreferrer">
              <img src={src} alt="" loading="lazy" />
            </a>
          ))}
        </div>
      ) : null}

      {project.documents?.length ? (
        <section className="docs">
          <h3>DOCUMENTS</h3>
          {project.documents.map((d) => (
            <div key={d.url} className="doc">
              <a href={d.url} target="_blank" rel="noreferrer">
                {d.name}
              </a>
              {/\.pdf$/i.test(d.url) && <iframe className="pdf" src={d.url} title={d.name} />}
            </div>
          ))}
        </section>
      ) : null}

      {project.externalLink && (
        <a className="btn primary" href={project.externalLink} target="_blank" rel="noreferrer">
          {project.mediaType === 'prototype' ? 'PLAY PROTOTYPE ↗' : 'OPEN LINK ↗'}
        </a>
      )}

      {project.tags?.length ? (
        <div className="tags">
          {project.tags.map((t) => (
            <span key={t}>#{t}</span>
          ))}
        </div>
      ) : null}
    </article>
  )
}
