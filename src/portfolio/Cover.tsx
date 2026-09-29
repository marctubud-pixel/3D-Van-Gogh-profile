import type { PortfolioProject } from '../../shared/types'

const PALETTE = ['#c96f4a', '#d9b45a', '#5f9e9a', '#6f8fb8', '#8a9a5b', '#b5524a', '#4d6fa8']

function hashColor(s: string) {
  let h = 0
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0
  return PALETTE[Math.abs(h) % PALETTE.length]
}

export function Cover({ project, className = '' }: { project: PortfolioProject; className?: string }) {
  if (project.cover) return <img className={`cover ${className}`} src={project.cover} alt={project.title} loading="lazy" />
  return (
    <div className={`cover placeholder ${className}`} style={{ background: hashColor(project.id) }}>
      <span>{project.title}</span>
    </div>
  )
}
