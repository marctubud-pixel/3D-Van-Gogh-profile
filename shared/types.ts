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
  /** Sub-section inside the landmark's interior (e.g. "TVC文案", "IP", "Photography"). */
  section?: string
  /** Long text shown in reading views (WRITE HOUSE pages). */
  body?: string
  duration?: string
  status?: string
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
  /** Interior sub-sections, in display order; projects pick one via `section`. */
  sections?: string[]
  /** Short line under the interior title plaque. */
  tagline?: string
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

export const DEFAULT_SECTIONS: Record<string, string[]> = {
  'print-house': ['TVC文案', '品牌文案', '电商文案', '人群文案'],
  'brand-museum': ['IP', '艺术', '品牌', '电商'],
  arcade: ['游戏经历', '游戏制作'],
  'my-studio': ['Photography', 'Reading', 'Vinyl', 'Games', 'Cycling', 'Film', 'Figures'],
}

export const DEFAULT_TAGLINE: Record<string, string> = {
  'print-house': 'Words make a brighter tomorrow',
  'brand-museum': '让品牌具像化',
  cinema: '选择票根放映作品',
  'experiment-lab': 'Ideas · Experiments · Prototypes · Play',
  arcade: 'Insert coin · Pick a game',
  'my-studio': 'Favorite things',
  observatory: 'Looking ahead',
}
