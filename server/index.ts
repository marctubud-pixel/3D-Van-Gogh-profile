import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import multer from 'multer'
import type { AssetKind, PortfolioProject, Profile, SiteContent, WorldLocation } from '../shared/types'
import { checkPassword, issueToken, requireAdmin, usingDefaultPassword } from './auth'
import { UPLOAD_DIR, getAssets, getContent, publicContent, saveAssets, saveContent } from './store'

const PORT = Number(process.env.PORT ?? 3001)
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB ?? 500)

const app = express()
app.use(express.json({ limit: '5mb' }))
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }))

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '')
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`)
    },
  }),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
})

function kindOf(mime: string, name: string): AssetKind {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (/\.(png|jpe?g|gif|webp|avif|svg)$/i.test(name)) return 'image'
  if (/\.(mp4|mov|webm|m4v|mkv)$/i.test(name)) return 'video'
  if (/\.(mp3|wav|m4a|ogg|flac)$/i.test(name)) return 'audio'
  if (/\.(glb|gltf)$/i.test(name)) return 'model'
  if (/\.(pdf|docx?|pptx?|xlsx?|txt|md|key|pages)$/i.test(name) || mime.startsWith('application/') || mime.startsWith('text/'))
    return 'document'
  return 'other'
}

function slugify(s: string) {
  const base = s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return base || `project-${crypto.randomBytes(3).toString('hex')}`
}

app.get('/api/content', (_req, res) => {
  res.json(publicContent())
})

app.post('/api/auth/login', (req, res) => {
  if (!checkPassword(req.body?.password)) {
    res.status(401).json({ error: '密码错误' })
    return
  }
  res.json({ token: issueToken() })
})

const admin = express.Router()
admin.use(requireAdmin)

admin.get('/content', (_req, res) => {
  res.json(getContent())
})

admin.put('/profile', (req, res) => {
  const content = getContent()
  content.profile = req.body as Profile
  res.json(saveContent(content))
})

admin.put('/locations/:id', (req, res) => {
  const content = getContent()
  const idx = content.locations.findIndex((l) => l.id === req.params.id)
  if (idx < 0) {
    res.status(404).json({ error: 'Location not found' })
    return
  }
  content.locations[idx] = { ...(req.body as WorldLocation), id: req.params.id }
  res.json(saveContent(content))
})

admin.post('/projects', (req, res) => {
  const content = getContent()
  const body = req.body as PortfolioProject
  let id = slugify(body.id || body.title || '')
  while (content.projects.some((p) => p.id === id)) id = `${id}-${crypto.randomBytes(2).toString('hex')}`
  content.projects.push({ ...body, id })
  res.json({ content: saveContent(content), id })
})

admin.put('/projects/:id', (req, res) => {
  const content = getContent()
  const idx = content.projects.findIndex((p) => p.id === req.params.id)
  if (idx < 0) {
    res.status(404).json({ error: 'Project not found' })
    return
  }
  content.projects[idx] = { ...(req.body as PortfolioProject), id: req.params.id }
  res.json(saveContent(content))
})

admin.delete('/projects/:id', (req, res) => {
  const content: SiteContent = getContent()
  content.projects = content.projects.filter((p) => p.id !== req.params.id)
  res.json(saveContent(content))
})

admin.get('/assets', (_req, res) => {
  res.json(getAssets())
})

admin.post('/upload', upload.array('files', 50), (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? []
  const assets = getAssets()
  const created = files.map((f) => ({
    id: path.parse(f.filename).name,
    url: `/uploads/${f.filename}`,
    originalName: Buffer.from(f.originalname, 'latin1').toString('utf8'),
    kind: kindOf(f.mimetype, f.originalname),
    mime: f.mimetype,
    size: f.size,
    createdAt: new Date().toISOString(),
  }))
  saveAssets([...created, ...assets])
  res.json(created)
})

admin.delete('/assets/:id', (req, res) => {
  const assets = getAssets()
  const asset = assets.find((a) => a.id === req.params.id)
  if (asset) {
    const file = path.join(UPLOAD_DIR, path.basename(asset.url))
    if (fs.existsSync(file)) fs.unlinkSync(file)
  }
  saveAssets(assets.filter((a) => a.id !== req.params.id))
  res.json({ ok: true })
})

app.use('/api/admin', admin)

if (process.env.NODE_ENV === 'production') {
  const dist = path.resolve('dist')
  app.use(express.static(dist))
  app.get(/^(?!\/api|\/uploads).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

app.listen(PORT, () => {
  console.log(`[my-world] api listening on http://localhost:${PORT}`)
  if (usingDefaultPassword) console.warn('[my-world] ADMIN_PASSWORD not set, using default password "admin"')
})
