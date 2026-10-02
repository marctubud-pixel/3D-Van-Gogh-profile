import type { ComponentType } from 'react'
import type { SiteContent, WorldLocation } from '../../../shared/types'
import { projectsFor } from '../../data/content'
import { Arcade } from './Arcade'
import { BrandMuseum } from './BrandMuseum'
import { Cinema } from './Cinema'
import { Lab } from './Lab'
import { Observatory } from './Observatory'
import { Studio } from './Studio'
import { WriteHouse } from './WriteHouse'
import type { InteriorProps } from './common'

const BY_ID: Record<string, ComponentType<InteriorProps>> = {
  'print-house': WriteHouse,
  'brand-museum': BrandMuseum,
  cinema: Cinema,
  'experiment-lab': Lab,
  arcade: Arcade,
  'my-studio': Studio,
  observatory: Observatory,
}

export function hasInterior(id: string) {
  return id in BY_ID
}

export function Interior({ content, location, onOpenProject, onClose }: { content: SiteContent; location: WorldLocation; onOpenProject: (id: string) => void; onClose: () => void }) {
  const View = BY_ID[location.id]
  return (
    <div className={`int-place int-place-${location.id}`}>
      <View location={location} projects={projectsFor(content, location)} onOpenProject={onOpenProject} onClose={onClose} />
    </div>
  )
}
