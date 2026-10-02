import { useState } from 'react'
import { BrushText, Doodle, Empty, Frame, Icon, Plaque, Thumb, cycle, taglineOf, type InteriorProps } from './common'

function Player({ src, poster }: { src: string; poster?: string }) {
  const yt = src.match(/(?:youtu\.be\/|v=)([\w-]{6,})/)
  const vm = src.match(/vimeo\.com\/(\d+)/)
  const bv = src.match(/bilibili\.com\/video\/(BV\w+)/)
  const embed = yt
    ? `https://www.youtube.com/embed/${yt[1]}?autoplay=1`
    : vm
      ? `https://player.vimeo.com/video/${vm[1]}?autoplay=1`
      : bv
        ? `https://player.bilibili.com/player.html?bvid=${bv[1]}&autoplay=1`
        : null
  if (embed) return <iframe className="ticket-media" src={embed} title="player" allow="autoplay; fullscreen" allowFullScreen />
  return <video className="ticket-media" src={src} poster={poster || undefined} controls autoPlay />
}

export function Cinema({ location, projects, onOpenProject, onClose }: InteriorProps) {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const film = projects[i]
  const go = (d: number) => {
    setI(cycle(i, d, projects.length))
    setPlaying(false)
  }
  const rows: [string, string | undefined][] = film
    ? [
        ['影片名称', film.title],
        ['影片类型', film.tags?.length ? film.tags.join(' / ') : film.category],
        ['上映日期', film.year],
        ['影片时长', film.duration],
        ['剧情简介', film.context || film.subtitle],
      ]
    : []
  return (
    <Frame kind="cinema">
      <Plaque title={location.name} sub={`✦ ${taglineOf(location)} ✦`}>
        <span className="marquee-bulbs" aria-hidden />
      </Plaque>
      <div className="ticket-row">
        <button className="int-arrow" aria-label="上一部" disabled={projects.length < 2} onClick={() => go(-1)}>
          ◀
        </button>
        {film ? (
          <article className="ticket">
            <div className="ticket-still">
              {playing && film.video ? <Player src={film.video} poster={film.cover} /> : <Thumb project={film} />}
            </div>
            <div className="ticket-info">
              <h2>
                <BrushText text={film.title} size={30} />
              </h2>
              {film.subtitle && <p className="int-kicker">{film.subtitle}</p>}
              <p>
                <Icon name="film" />
                {film.tags?.length ? film.tags.join(' / ') : film.category}
              </p>
              {film.year && (
                <p>
                  <Icon name="tool" />
                  {film.year}
                </p>
              )}
              <span className="ticket-stamp">
                No.{String(i + 1).padStart(3, '0')}
              </span>
            </div>
          </article>
        ) : (
          <article className="ticket">
            <Empty text="放映厅还没有排片" />
          </article>
        )}
        <button className="int-arrow" aria-label="下一部" disabled={projects.length < 2} onClick={() => go(1)}>
          ▶
        </button>
      </div>
      {film && (
        <dl className="ticket-table">
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          <Doodle className="side">Good movies, brighter days</Doodle>
        </dl>
      )}
      <div className="int-actions wide">
        <button
          className="int-btn yellow"
          disabled={!film}
          onClick={() => (film?.video ? setPlaying(true) : film && onOpenProject(film.id))}
        >
          ▶ {film?.video ? '播放' : '详情'}
        </button>
        <button className="int-btn ghost" onClick={onClose}>
          离开影院
        </button>
        <button className="int-btn ghost" disabled={projects.length < 2} onClick={() => go(1)}>
          ↻ 再看一部
        </button>
      </div>
    </Frame>
  )
}
