import { Link, useParams } from 'react-router-dom'
import { useContent } from '../data/content'
import { TopNav } from '../ui/Nav'
import { ProjectDetail } from './ProjectDetail'

export function ProjectPage() {
  const { id } = useParams()
  const content = useContent((s) => s.content!)
  const project = content.projects.find((p) => p.id === id)
  return (
    <div className="page">
      <TopNav />
      <main className="page-body narrow">
        <Link to="/index" className="back">
          ← INDEX
        </Link>
        {project ? (
          <ProjectDetail project={project} location={content.locations.find((l) => l.id === project.locationId)} />
        ) : (
          <p>Project not found.</p>
        )}
      </main>
    </div>
  )
}
