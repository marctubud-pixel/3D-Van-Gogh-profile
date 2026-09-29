export type Zone = 'main-town' | 'interest-area' | 'future-hill'

export type InteractionAction = 'READ' | 'VIEW' | 'WATCH' | 'PLAY' | 'BROWSE' | 'LISTEN'

export type MediaType = 'text' | 'gallery' | 'video' | 'prototype' | 'document' | 'link'

export interface DocumentRef {
  name: string
  url: string
}

export interface LinkRef {
  label: string
  url: string
}

export interface PortfolioProject {
  id: string
  title: string
  subtitle?: string
  category: string
  mediaType: MediaType
  year?: string
  context?: string
  problem?: string
  insight?: string
  strategy?: string
  idea?: string
  execution?: string
  role?: string
  contribution?: string
  collaborators?: string[]
  tools?: string[]
  aiUsed?: boolean
  result?: string
  impact?: string
  cover: string
  gallery?: string[]
  video?: string
  documents?: DocumentRef[]
  externalLink?: string
  tags?: string[]
  locationId: string
  featured?: boolean
  published: boolean
  order?: number
}

export interface WorldLocation {
  id: string
  name: string
  zone: Zone
  question: string
  description: string
  action: InteractionAction
  color: string
  /** Spherical placement on the planet: latitude / longitude in degrees. */
  lat: number
  lon: number
  worldPosition: [number, number, number]
  mapPosition: [number, number]
  projectIds: string[]
  parking: boolean
  theme?: string
  navigable?: boolean
}

export interface Experience {
  period: string
  title: string
  org: string
  description?: string
}

export interface Profile {
  name: string
  headline: string
  tagline: string
  shortBio: string
  currentDirection: string
  avatar?: string
  experience: Experience[]
  skills: string[]
  howIWork: string[]
  cvFile?: string
  email?: string
  location?: string
  links: LinkRef[]
}

export interface SiteContent {
  profile: Profile
  locations: WorldLocation[]
  projects: PortfolioProject[]
}

export type AssetKind = 'image' | 'video' | 'document' | 'audio' | 'model' | 'other'

export interface Asset {
  id: string
  url: string
  originalName: string
  kind: AssetKind
  mime: string
  size: number
  createdAt: string
}

export const ZONE_LABEL: Record<Zone, string> = {
  'main-town': 'MAIN TOWN',
  'interest-area': 'INTEREST AREA',
  'future-hill': 'FUTURE HILL',
}

export const PROJECT_CATEGORIES = [
  'Writing',
  'Brand / Creative',
  'Film',
  'Interactive',
  'Games',
  'Experiments',
  'Personal',
  'Future',
] as const
