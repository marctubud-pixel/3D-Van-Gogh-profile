import fs from 'node:fs'
import path from 'node:path'
import type { Asset, SiteContent } from '../shared/types'
import { latLonToVector, seedContent } from '../shared/seed'

export const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR ?? 'storage')
export const UPLOAD_DIR = path.join(STORAGE_DIR, 'uploads')
const CONTENT_FILE = path.join(STORAGE_DIR, 'content.json')
const ASSETS_FILE = path.join(STORAGE_DIR, 'assets.json')

fs.mkdirSync(UPLOAD_DIR, { recursive: true })

function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return structuredClone(fallback)
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T
}

function writeJson(file: string, data: unknown) {
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
  fs.renameSync(tmp, file)
}

export function normalize(content: SiteContent): SiteContent {
  const locations = content.locations.map((l) => ({
    ...l,
    worldPosition: latLonToVector(l.lat, l.lon),
    mapPosition: [+(((l.lon + 540) % 360) / 3.6).toFixed(1), +(50 - l.lat / 1.8).toFixed(1)] as [number, number],
    projectIds: content.projects
      .filter((p) => p.locationId === l.id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((p) => p.id),
  }))
  return { ...content, locations }
}

export function getContent(): SiteContent {
  return normalize(readJson(CONTENT_FILE, seedContent))
}

export function saveContent(content: SiteContent): SiteContent {
  const normalized = normalize(content)
  writeJson(CONTENT_FILE, normalized)
  return normalized
}

export function getAssets(): Asset[] {
  return readJson<Asset[]>(ASSETS_FILE, [])
}

export function saveAssets(assets: Asset[]) {
  writeJson(ASSETS_FILE, assets)
}

export function publicContent(): SiteContent {
  const c = getContent()
  const projects = c.projects.filter((p) => p.published)
  const ids = new Set(projects.map((p) => p.id))
  return {
    ...c,
    projects,
    locations: c.locations.map((l) => ({ ...l, projectIds: l.projectIds.filter((id) => ids.has(id)) })),
  }
}
