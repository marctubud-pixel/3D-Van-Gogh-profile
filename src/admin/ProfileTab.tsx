import { useState } from 'react'
import type { Profile, SiteContent } from '../../shared/types'
import { api } from '../data/api'
import { ListText, MediaField, Text } from './fields'

export function ProfileTab({ content, onSaved }: { content: SiteContent; onSaved: (c: SiteContent) => void }) {
  const [p, setP] = useState<Profile>(content.profile)
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((s) => ({ ...s, [k]: v }))
  return (
    <form
      className="admin-form"
      onSubmit={async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
          onSaved(await api.saveProfile(p))
        } finally {
          setSaving(false)
        }
      }}
    >
      <div className="admin-head">
        <h2>个人资料 · INFO / CV</h2>
        <button className="btn primary" disabled={saving}>
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
      <div className="cols">
        <div>
          <Text label="名字 NAME" value={p.name} onChange={(v) => set('name', v)} />
          <Text label="标题 HEADLINE" value={p.headline} onChange={(v) => set('headline', v)} />
          <Text label="欢迎页标语 TAGLINE" value={p.tagline} onChange={(v) => set('tagline', v)} multiline />
          <Text label="简介 SHORT BIO" value={p.shortBio} onChange={(v) => set('shortBio', v)} multiline />
          <Text label="当前方向 CURRENT DIRECTION" value={p.currentDirection} onChange={(v) => set('currentDirection', v)} />
          <ListText label="技能 SKILLS" value={p.skills} onChange={(v) => set('skills', v)} />
          <ListText label="工作方式 HOW I WORK" value={p.howIWork} onChange={(v) => set('howIWork', v)} hint="流程步骤，用逗号分隔" />
        </div>
        <div>
          <MediaField label="头像 AVATAR" kind="image" value={p.avatar} onChange={(v) => set('avatar', v)} />
          <MediaField label="简历 CV（PDF / 文档）" kind="document" value={p.cvFile} onChange={(v) => set('cvFile', v)} />
          <Text label="邮箱 EMAIL" value={p.email} onChange={(v) => set('email', v)} />
          <Text label="所在地 LOCATION" value={p.location} onChange={(v) => set('location', v)} />
        </div>
      </div>

      <h3>经历 EXPERIENCE</h3>
      {p.experience.map((x, i) => (
        <div key={i} className="repeat">
          <input placeholder="时间 2023 — Now" value={x.period} onChange={(e) => set('experience', p.experience.map((y, k) => (k === i ? { ...y, period: e.target.value } : y)))} />
          <input placeholder="职位" value={x.title} onChange={(e) => set('experience', p.experience.map((y, k) => (k === i ? { ...y, title: e.target.value } : y)))} />
          <input placeholder="公司 / 组织" value={x.org} onChange={(e) => set('experience', p.experience.map((y, k) => (k === i ? { ...y, org: e.target.value } : y)))} />
          <input placeholder="描述" value={x.description ?? ''} onChange={(e) => set('experience', p.experience.map((y, k) => (k === i ? { ...y, description: e.target.value } : y)))} />
          <button type="button" className="btn ghost" onClick={() => set('experience', p.experience.filter((_, k) => k !== i))}>
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="btn" onClick={() => set('experience', [...p.experience, { period: '', title: '', org: '' }])}>
        + 添加经历
      </button>

      <h3>外部链接 LINKS</h3>
      {p.links.map((l, i) => (
        <div key={i} className="repeat">
          <input placeholder="名称（如 Bilibili）" value={l.label} onChange={(e) => set('links', p.links.map((y, k) => (k === i ? { ...y, label: e.target.value } : y)))} />
          <input placeholder="https://" value={l.url} onChange={(e) => set('links', p.links.map((y, k) => (k === i ? { ...y, url: e.target.value } : y)))} />
          <button type="button" className="btn ghost" onClick={() => set('links', p.links.filter((_, k) => k !== i))}>
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="btn" onClick={() => set('links', [...p.links, { label: '', url: '' }])}>
        + 添加链接
      </button>
    </form>
  )
}
