import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContent } from '../data/content'
import { LocationPanel } from '../locations/LocationPanel'
import { TopNav } from '../ui/Nav'
import { TownMap } from './TownMap'

export function MapPage() {
  const content = useContent((s) => s.content!)
  const [selected, setSelected] = useState<string | null>(null)
  const navigate = useNavigate()
  const loc = content.locations.find((l) => l.id === selected)
  return (
    <div className="page">
      <TopNav />
      <main className="page-body">
        <h1 className="page-title">MAP</h1>
        <TownMap locations={content.locations} activeId={selected} onSelect={(l) => setSelected(l.id)} />
        {loc ? (
          <LocationPanel content={content} location={loc} onOpenProject={(id) => navigate(`/project/${id}`)} />
        ) : (
          <p className="muted center">选择一个地点 · Select a location</p>
        )}
      </main>
    </div>
  )
}
