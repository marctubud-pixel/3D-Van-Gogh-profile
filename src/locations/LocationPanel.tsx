import type { SiteContent, WorldLocation } from '../../shared/types'
import { ZONE_LABEL } from '../../shared/types'
import { projectsFor } from '../data/content'
import { ProjectCard } from '../portfolio/ProjectCard'

interface Props {
  content: SiteContent
  location: WorldLocation
  onOpenProject: (id: string) => void
}

export function LocationPanel({ content, location, onOpenProject }: Props) {
  const projects = projectsFor(content, location)
  return (
    <div className="location-panel">
      <p className="eyebrow" style={{ color: location.color }}>
        {ZONE_LABEL[location.zone]} · {location.action}
      </p>
      <h1>{location.name}</h1>
      <p className="question">{location.question}</p>
      <p className="muted">{location.description}</p>
      <div className="grid">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} onClick={() => onOpenProject(p.id)} />
        ))}
        {!projects.length && <p className="muted">这里的内容正在建设中 · Coming soon.</p>}
      </div>
    </div>
  )
}
