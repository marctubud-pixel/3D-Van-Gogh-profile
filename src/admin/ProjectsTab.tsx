import { useState } from 'react'
import type { DocumentRef, MediaType, PortfolioProject, SiteContent } from '../../shared/types'
import { DEFAULT_SECTIONS, PROJECT_CATEGORIES } from '../../shared/types'
import { api } from '../data/api'
import { AssetPicker } from './AssetPicker'
import { Field, ListText, MediaField, MediaListField, Text } from './fields'

const MEDIA_TYPES: [MediaType, string][] = [
  ['text', '文字 Text'],
  ['gallery', '图集 Gallery'],
  ['video', '视频 Video'],
  ['prototype', '原型 Prototype'],
  ['document', '文档 Document'],
  ['link', '外链 Link'],
]

function blank(content: SiteContent): PortfolioProject {
  return {
    id: '',
    title: '新作品',
    category: PROJECT_CATEGORIES[0],
    mediaType: 'text',
    cover: '',
    locationId: content.locations[0]?.id ?? '',
    published: false,
  }
}

function DocumentsField({ value, onChange }: { value: DocumentRef[] | undefined; onChange: (v: DocumentRef[]) => void }) {
  const [open, setOpen] = useState(false)
  const list = value ?? []
  return (
    <Field label="文档 DOCUMENTS" hint="PDF 会在作品页内嵌预览">
      {list.map((d, i) => (
        <div key={d.url + i} className="repeat">
          <input value={d.name} onChange={(e) => onChange(list.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
          <a href={d.url} target="_blank" rel="noreferrer">
            打开
          </a>
          <button type="button" className="btn ghost" onClick={() => onChange(list.filter((_, k) => k !== i))}>
            ✕
          </button>
        </div>
      ))}
      <div>
        <button type="button" className="btn" onClick={() => setOpen(true)}>
          + 添加文档
        </button>
      </div>
      {open && (
        <AssetPicker
          kind="document"
          multiple
          onClose={() => setOpen(false)}
          onPick={(a) => {
            onChange([...list, ...a.map((x) => ({ name: x.originalName, url: x.url }))])
            setOpen(false)
          }}
        />
      )}
    </Field>
  )
}

function ProjectEditor({ initial, content, onSaved, onDeleted }: {
  initial: PortfolioProject
  content: SiteContent
  onSaved: (c: SiteContent, id: string) => void
  onDeleted: (c: SiteContent) => void
}) {
  const [p, setP] = useState(initial)
  const [saving, setSaving] = useState(false)
  const isNew = !initial.id
  const set = <K extends keyof PortfolioProject>(k: K, v: PortfolioProject[K]) => setP((s) => ({ ...s, [k]: v }))
  return (
    <form
      className="admin-form"
      onSubmit={async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
          if (isNew) {
            const r = await api.createProject(p)
            onSaved(r.content, r.id)
          } else onSaved(await api.saveProject(p), p.id)
        } finally {
          setSaving(false)
        }
      }}
    >
      <div className="admin-head">
        <h2>{isNew ? '新建作品' : p.title}</h2>
        <div className="row tight">
          {!isNew && (
            <a className="btn ghost" href={`/project/${p.id}`} target="_blank" rel="noreferrer">
              预览 ↗
            </a>
          )}
          {!isNew && (
            <button
              type="button"
              className="btn danger"
              onClick={async () => {
                if (confirm(`删除「${p.title}」？`)) onDeleted(await api.deleteProject(p.id))
              }}
            >
              删除
            </button>
          )}
          <button className="btn primary" disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>

      <div className="toggles">
        <label>
          <input type="checkbox" checked={p.published} onChange={(e) => set('published', e.target.checked)} /> 发布 Published
        </label>
        <label>
          <input type="checkbox" checked={!!p.featured} onChange={(e) => set('featured', e.target.checked)} /> 精选 Featured
        </label>
        <label>
          <input type="checkbox" checked={!!p.aiUsed} onChange={(e) => set('aiUsed', e.target.checked)} /> AI-assisted
        </label>
      </div>

      <div className="cols">
        <div>
          {isNew && <Text label="ID（用于 /project/:id，可留空自动生成）" value={p.id} onChange={(v) => set('id', v)} />}
          <Text label="标题 TITLE" value={p.title} onChange={(v) => set('title', v)} />
          <Text label="一句话 ONE-LINER" value={p.subtitle} onChange={(v) => set('subtitle', v)} />
          <Field label="所属区块 LANDMARK">
            <select value={p.locationId} onChange={(e) => set('locationId', e.target.value)}>
              {content.locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
          <Text
            label="栏目 SECTION（建筑内部分组）"
            value={p.section}
            onChange={(v) => set('section', v)}
            hint={`可选：${(content.locations.find((l) => l.id === p.locationId)?.sections ?? DEFAULT_SECTIONS[p.locationId] ?? []).join(' / ') || '此建筑不分栏目'}；留空归入第一个栏目`}
          />
          <Field label="分类 CATEGORY（INDEX 筛选）">
            <select value={p.category} onChange={(e) => set('category', e.target.value)}>
              {PROJECT_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="展示类型 MEDIA TYPE">
            <select value={p.mediaType} onChange={(e) => set('mediaType', e.target.value as MediaType)}>
              {MEDIA_TYPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Text label="年份 YEAR" value={p.year} onChange={(v) => set('year', v)} />
          <Field label="排序 ORDER（区块内，越小越前）">
            <input type="number" value={p.order ?? 0} onChange={(e) => set('order', Number(e.target.value))} />
          </Field>
          <Text label="时长 DURATION（影院片长 / ARCADE 游玩时间）" value={p.duration} onChange={(v) => set('duration', v)} placeholder="118 分钟" />
          <Text label="状态 STATUS（实验室显示）" value={p.status} onChange={(v) => set('status', v)} placeholder="已完成" />
          <Text label="我的角色 MY ROLE" value={p.role} onChange={(v) => set('role', v)} />
          <ListText label="工具 TOOLS" value={p.tools} onChange={(v) => set('tools', v)} />
          <ListText label="合作者 COLLABORATORS" value={p.collaborators} onChange={(v) => set('collaborators', v)} />
          <ListText label="标签 TAGS" value={p.tags} onChange={(v) => set('tags', v)} />
          <Text label="外部链接 / 原型地址" value={p.externalLink} onChange={(v) => set('externalLink', v)} placeholder="https://" />
        </div>
        <div>
          <MediaField label="封面 COVER" kind="image" value={p.cover} onChange={(v) => set('cover', v)} />
          <MediaField
            label="视频 VIDEO"
            kind="video"
            value={p.video}
            onChange={(v) => set('video', v)}
            hint="上传 MP4，或粘贴 YouTube / Vimeo / Bilibili 链接"
          />
          <MediaListField label="图集 GALLERY" kind="image" value={p.gallery} onChange={(v) => set('gallery', v)} />
          <DocumentsField value={p.documents} onChange={(v) => set('documents', v)} />
        </div>
      </div>

      <Text label="正文 BODY（WRITE HOUSE 翻页阅读，保留换行）" value={p.body} onChange={(v) => set('body', v)} multiline />

      <h3>CASE STUDY（BRIEF → PROBLEM → INSIGHT → STRATEGY → IDEA → EXECUTION → RESULT）</h3>
      <div className="cols">
        <Text label="CONTEXT / BRIEF" value={p.context} onChange={(v) => set('context', v)} multiline />
        <Text label="PROBLEM" value={p.problem} onChange={(v) => set('problem', v)} multiline />
        <Text label="INSIGHT" value={p.insight} onChange={(v) => set('insight', v)} multiline />
        <Text label="STRATEGY" value={p.strategy} onChange={(v) => set('strategy', v)} multiline />
        <Text label="IDEA" value={p.idea} onChange={(v) => set('idea', v)} multiline />
        <Text label="EXECUTION" value={p.execution} onChange={(v) => set('execution', v)} multiline />
        <Text label="WHAT I DID" value={p.contribution} onChange={(v) => set('contribution', v)} multiline />
        <Text label="RESULT" value={p.result} onChange={(v) => set('result', v)} multiline />
        <Text label="IMPACT" value={p.impact} onChange={(v) => set('impact', v)} multiline />
      </div>
    </form>
  )
}

export function ProjectsTab({ content, onSaved }: { content: SiteContent; onSaved: (c: SiteContent) => void }) {
  const [selected, setSelected] = useState<string | null>(content.projects[0]?.id ?? null)
  const [draft, setDraft] = useState<PortfolioProject | null>(null)
  const [locFilter, setLocFilter] = useState('')
  const project = draft ?? content.projects.find((p) => p.id === selected)
  const list = content.projects.filter((p) => !locFilter || p.locationId === locFilter)
  return (
    <div className="split">
      <div className="list">
        <button
          className="btn primary"
          onClick={() => {
            setDraft(blank(content))
            setSelected(null)
          }}
        >
          + 新建作品
        </button>
        <select value={locFilter} onChange={(e) => setLocFilter(e.target.value)}>
          <option value="">全部区块</option>
          {content.locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        {list.map((p) => (
          <button
            key={p.id}
            className={`list-item ${p.id === selected && !draft ? 'active' : ''}`}
            onClick={() => {
              setDraft(null)
              setSelected(p.id)
            }}
          >
            {p.cover ? <img src={p.cover} alt="" /> : <i style={{ background: content.locations.find((l) => l.id === p.locationId)?.color }} />}
            <div>
              <strong>{p.title}</strong>
              <small>
                {content.locations.find((l) => l.id === p.locationId)?.name} · {p.published ? '已发布' : '草稿'}
              </small>
            </div>
          </button>
        ))}
      </div>
      {project && (
        <ProjectEditor
          key={draft ? 'draft' : project.id}
          initial={project}
          content={content}
          onSaved={(c, id) => {
            onSaved(c)
            setDraft(null)
            setSelected(id)
          }}
          onDeleted={(c) => {
            onSaved(c)
            setSelected(c.projects[0]?.id ?? null)
          }}
        />
      )}
    </div>
  )
}
