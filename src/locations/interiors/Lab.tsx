import { useState } from 'react'
import { Doodle, Empty, Frame, Icon, Plaque, Thumb, pad, taglineOf, type InteriorProps } from './common'

export function Lab({ location, projects, onOpenProject }: InteriorProps) {
  const [i, setI] = useState(0)
  const p = projects[i]
  const doc = p?.documents?.[0]
  return (
    <Frame kind="lab">
      <Plaque title={location.name} sub={taglineOf(location)} />
      <div className="folders">
        <ul className="folder-tabs">
          {projects.map((x, k) => (
            <li key={x.id} style={{ ['--k' as string]: k }}>
              <button className={k === i ? 'on' : ''} onClick={() => setI(k)}>
                <Icon name={x.mediaType === 'video' ? 'film' : x.category} />
                <span>
                  实验日志 {pad(k + 1)}
                  <small>— {x.title}</small>
                </span>
              </button>
            </li>
          ))}
          {!projects.length && (
            <li>
              <button className="on">
                <Icon name="proto" />
                <span>
                  实验日志 01<small>— 待开始</small>
                </span>
              </button>
            </li>
          )}
          <Doodle>Keep exploring!</Doodle>
        </ul>
        <article className="folder-sheet">
          <span className="clip" aria-hidden />
          {p ? (
            <>
              <h2 className="int-h2">
                <Icon name={p.mediaType === 'video' ? 'film' : p.category} />
                实验日志 {pad(i + 1)}
              </h2>
              <p className="int-kicker">— {p.title}</p>
              <div className="folder-body">
                <button className="folder-media" onClick={() => (p.externalLink ? window.open(p.externalLink, '_blank') : onOpenProject(p.id))}>
                  <Thumb project={p} />
                  <span className="play-chip">▶ PLAY</span>
                </button>
                <div>
                  <h3 className="folder-title">{p.subtitle || p.title}</h3>
                  {p.context && <p className="folder-text">{p.context}</p>}
                  {p.tags?.length ? (
                    <div className="chips">
                      {p.tags.map((t) => (
                        <span key={t}>#{t}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <dl className="folder-meta">
                {p.year && (
                  <div>
                    <dt>创建时间</dt>
                    <dd>{p.year}</dd>
                  </div>
                )}
                {p.tools?.length ? (
                  <div>
                    <dt>使用工具</dt>
                    <dd>{p.tools.join(' · ')}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>项目状态</dt>
                  <dd>
                    <span className="status">{p.status || '已完成'}</span>
                  </dd>
                </div>
              </dl>
              <div className="int-actions">
                <button className="int-btn" onClick={() => (doc ? window.open(doc.url, '_blank') : onOpenProject(p.id))}>
                  {doc ? '查看文档' : '查看详情'} ›
                </button>
                <button className="int-btn ghost" disabled={!p.externalLink} onClick={() => p.externalLink && window.open(p.externalLink, '_blank')}>
                  打开附件 ›
                </button>
              </div>
            </>
          ) : (
            <Empty text="实验台还空着，在后台添加实验项目" />
          )}
          <span className="stamp" aria-hidden>
            EXPERIMENT · CREATE · ITERATE
          </span>
        </article>
      </div>
    </Frame>
  )
}
