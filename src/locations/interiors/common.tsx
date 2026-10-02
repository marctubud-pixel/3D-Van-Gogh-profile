import { useLayoutEffect, useRef, type ReactNode } from 'react'
import type { PortfolioProject, WorldLocation } from '../../../shared/types'
import { DEFAULT_SECTIONS, DEFAULT_TAGLINE } from '../../../shared/types'
import { Cover } from '../../portfolio/Cover'

export interface InteriorProps {
  location: WorldLocation
  projects: PortfolioProject[]
  onOpenProject: (id: string) => void
  onClose: () => void
}

export interface Section {
  name: string
  projects: PortfolioProject[]
}

/** Groups projects into the landmark's sections; projects without a matching section fall into the first one. */
export function sectionsOf(location: WorldLocation, projects: PortfolioProject[]): Section[] {
  const configured = location.sections?.length ? location.sections : (DEFAULT_SECTIONS[location.id] ?? [])
  const list: Section[] = configured.map((name) => ({ name, projects: [] }))
  const find = (name?: string) => list.find((s) => s.name.toLowerCase() === name?.trim().toLowerCase())
  for (const p of projects) {
    const hit = find(p.section)
    if (hit) hit.projects.push(p)
    else if (!configured.length && p.section) list.push({ name: p.section.trim(), projects: [p] })
    else if (list[0]) list[0].projects.push(p)
    else list.push({ name: '全部', projects: [p] })
  }
  return list
}

export function taglineOf(location: WorldLocation) {
  return location.tagline || DEFAULT_TAGLINE[location.id] || location.description
}

export function pad(n: number) {
  return String(n).padStart(2, '0')
}

const ICONS: [RegExp, string][] = [
  [/tvc|tv|电视|广告/i, 'M3 7h18v11H3z M8 3l4 4 4-4 M7 21h10'],
  [/电商|shop|cart|e-?com/i, 'M3 4h3l2.5 11h10L21 7H7 M10 20a1 1 0 1 0 0-.1 M17 20a1 1 0 1 0 0-.1'],
  [/人群|people|audience|community/i, 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M3 20c.5-3.5 3-5 6-5s5.5 1.5 6 5 M16 11a2.5 2.5 0 1 0 0-5 M17 15c2.5.3 3.7 2 4 5'],
  [/品牌|brand|tag/i, 'M3 12V4h8l10 10-8 8z M7.5 8a.5.5 0 1 0 0-.1'],
  [/^ip$|character|角色|figure|手办/i, 'M8 9h8v8H8z M10 9V6h4v3 M11 12h.01 M13 12h.01 M6 13h2 M16 13h2 M10 17v3 M14 17v3'],
  [/艺术|art|paint/i, 'M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2s0-2 1.5-2H18a3 3 0 0 0 3-3c0-6-4-11-9-11z M7.5 11a1 1 0 1 0 0-.1 M10 7a1 1 0 1 0 0-.1 M15 7.5a1 1 0 1 0 0-.1'],
  [/photo|摄影|camera/i, 'M3 8h4l2-3h6l2 3h4v11H3z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  [/read|阅读|book|书|writ|文案/i, 'M3 5c3-1 6-1 9 1v14c-3-2-6-2-9-1z M21 5c-3-1-6-1-9 1v14c3-2 6-2 9-1z'],
  [/vinyl|music|音乐|唱片/i, 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M12 6.5a5.5 5.5 0 0 0-5.5 5.5'],
  [/game|游戏|play/i, 'M6 8h12a4 4 0 0 1 3.5 6l-1 2a2.5 2.5 0 0 1-4-.5L15 14H9l-1.5 1.5a2.5 2.5 0 0 1-4 .5l-1-2A4 4 0 0 1 6 8z M8 10v3 M6.5 11.5h3 M15.5 11h.01 M17.5 12.5h.01'],
  [/cycl|bike|骑/i, 'M6 18a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M18 18a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M6 14.5l4-6h5l3 6 M9 8.5h3 M12 14.5l3-6'],
  [/film|电影|影|video|ai/i, 'M3 10h18v10H3z M3 10l2-5 16 0-2 5 M8 5l-2 5 M13 5l-2 5 M18 5l-2 5'],
  [/proto|互动|interact|click/i, 'M9 11V5a1.5 1.5 0 0 1 3 0v5 M12 10V8.5a1.5 1.5 0 0 1 3 0V11 M15 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a5 5 0 0 1-4-2l-3-4a1.5 1.5 0 0 1 2.3-2L9 15'],
  [/clock|time|时间/i, 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2'],
  [/tool|工具/i, 'M14 6a4 4 0 0 0 5 5l-9 9a2 2 0 0 1-3-3l9-9z'],
  [/visual|视觉|image|图/i, 'M3 5h18v14H3z M3 16l5-5 4 4 3-3 6 6 M16 9.5a1.5 1.5 0 1 0 0-.1'],
]

export function Icon({ name, className = '' }: { name: string; className?: string }) {
  const d = ICONS.find(([re]) => re.test(name))?.[1] ?? 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z'
  return (
    <svg className={`int-icon ${className}`} viewBox="0 0 24 24" aria-hidden>
      <path d={d} />
    </svg>
  )
}

export function Plaque({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <header className="int-plaque">
      {children}
      <h1>
        <BrushText text={title} size={46} />
      </h1>
      {sub && <p>{sub}</p>}
    </header>
  )
}

export function Frame({ kind, children }: { kind: string; children: ReactNode }) {
  return <div className={`int int-${kind}`}>{children}</div>
}

export function Thumb({ project, className = '' }: { project: PortfolioProject; className?: string }) {
  return <Cover project={project} className={`int-thumb ${className}`} />
}

export function Empty({ text = '这里的内容正在建设中，在后台添加作品后会出现在这里' }: { text?: string }) {
  return <p className="int-empty">{text}</p>
}

export function Doodle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`int-doodle ${className}`}>{children}</span>
}

export function Paged({ index, total }: { index: number; total: number }) {
  return (
    <span className="int-paged">
      {total ? index + 1 : 0} / {total}
    </span>
  )
}

export function cycle(i: number, d: number, n: number) {
  return n ? (i + d + n) % n : 0
}

const SIGN_FACE = '"Trebuchet MS", "Arial Black", Arial, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif'

function seeded(text: string) {
  let h = 2166136261
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9
    return ((h >>> 0) % 10000) / 10000
  }
}

/**
 * Lettering painted the way the building signs are: glyphs are rasterised, then each inked cell
 * becomes one short dab laid along the letter's local direction. Colour comes from CSS `color`.
 */
export function BrushText({ text, size, className = '' }: { text: string; size: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useLayoutEffect(() => {
    const c = ref.current
    if (!c) return
    const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
    probe.fillStyle = getComputedStyle(c).color
    probe.fillRect(0, 0, 1, 1)
    const [cr, cg, cb] = probe.getImageData(0, 0, 1, 1).data
    const font = `800 ${size}px ${SIGN_FACE}`
    probe.font = font
    const w = Math.ceil(probe.measureText(text).width + size * 0.5)
    const h = Math.ceil(size * 1.4)
    const mask = document.createElement('canvas')
    mask.width = w
    mask.height = h
    const g = mask.getContext('2d', { willReadFrequently: true })!
    g.font = font
    g.textBaseline = 'middle'
    g.fillText(text, size * 0.25, h / 2)
    const px = g.getImageData(0, 0, w, h).data
    const ink = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && px[(y * w + x) * 4 + 3] > 120
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    c.width = w * dpr
    c.height = h * dpr
    c.style.width = `${w}px`
    c.style.height = `${h}px`
    const o = c.getContext('2d')!
    o.scale(dpr, dpr)
    const r = seeded(text)
    const step = Math.max(1.6, size / 14)
    for (let y = step / 2; y < h; y += step) {
      for (let x = step / 2; x < w; x += step) {
        const jx = Math.round(x + (r() - 0.5) * step * 0.3)
        const jy = Math.round(y + (r() - 0.5) * step * 0.3)
        if (!ink(jx, jy)) continue
        let hr = 0
        while (hr < step * 4 && ink(jx - hr, jy) && ink(jx + hr, jy)) hr++
        let vr = 0
        while (vr < step * 4 && ink(jx, jy - vr) && ink(jx, jy + vr)) vr++
        const t = r() * 0.14
        const to = r() < 0.5 ? 255 : 28
        o.fillStyle = `rgb(${cr + (to - cr) * t}, ${cg + (to - cg) * t}, ${cb + (to - cb) * t})`
        const len = step * (1.7 + r() * 0.5)
        const wid = step * (1.1 + r() * 0.2)
        o.save()
        o.translate(jx, jy)
        o.rotate((hr >= vr ? 0 : Math.PI / 2) + (r() - 0.5) * 0.35)
        o.beginPath()
        o.roundRect(-len / 2, -wid / 2, len, wid, wid / 2)
        o.fill()
        o.restore()
      }
    }
  }, [text, size])
  return <canvas ref={ref} className={`brush-text ${className}`} role="img" aria-label={text} />
}
