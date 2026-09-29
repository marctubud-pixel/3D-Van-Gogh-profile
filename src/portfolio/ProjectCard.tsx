import type { PortfolioProject } from '../../shared/types'
import { Cover } from './Cover'

export function ProjectCard({ project, onClick }: { project: PortfolioProject; onClick: () => void }) {
  return (
    <button className="card" onClick={onClick}>
      <Cover project={project} />
      <div className="card-body">
        <p className="eyebrow">
          {project.category}
          {project.year ? ` · ${project.year}` : ''}
        </p>
        <h3>{project.title}</h3>
        {project.subtitle && <p>{project.subtitle}</p>}
      </div>
    </button>
  )
}
