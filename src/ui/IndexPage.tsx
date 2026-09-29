import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PROJECT_CATEGORIES } from '../../shared/types'
import { useContent } from '../data/content'
import { ProjectCard } from '../portfolio/ProjectCard'
import { TopNav } from './Nav'

export function IndexPage() {
  const content = useContent((s) => s.content!)
  const [params] = useSearchParams()
  const [filter, setFilter] = useState<string>('Featured')
  const navigate = useNavigate()
  const projects = useMemo(() => {
    const sorted = [...content.projects].sort((a, b) => (b.year ?? '').localeCompare(a.year ?? '') || (a.order ?? 0) - (b.order ?? 0))
    if (filter === 'All') return sorted
    if (filter === 'Featured') return sorted.filter((p) => p.featured)
    return sorted.filter((p) => p.category === filter)
  }, [content.projects, filter])
  const tabs = ['Featured', 'All', ...PROJECT_CATEGORIES]
  return (
    <div className="page">
      <TopNav />
      <main className="page-body">
        {params.get('fallback') && <p className="notice">当前设备不支持 3D 模式，已切换到 INDEX 浏览。</p>}
        <h1 className="page-title">INDEX</h1>
        <div className="filters">
          {tabs.map((t) => (
            <button key={t} className={t === filter ? 'chip active' : 'chip'} onClick={() => setFilter(t)}>
              {t}
            </button>
          ))}
        </div>
        <div className="grid">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onClick={() => navigate(`/project/${p.id}`)} />
          ))}
          {!projects.length && <p className="muted">暂无作品。</p>}
        </div>
      </main>
    </div>
  )
}
