import { useState } from 'react'
import type { InteractionAction, SiteContent, WorldLocation, Zone } from '../../shared/types'
import { ZONE_LABEL } from '../../shared/types'
import { api } from '../data/api'
import { Field, Text } from './fields'

const ACTIONS: InteractionAction[] = ['READ', 'VIEW', 'WATCH', 'PLAY', 'BROWSE', 'LISTEN']

function LocationEditor({ initial, content, onSaved }: { initial: WorldLocation; content: SiteContent; onSaved: (c: SiteContent) => void }) {
  const [l, setL] = useState(initial)
  const set = <K extends keyof WorldLocation>(k: K, v: WorldLocation[K]) => setL((s) => ({ ...s, [k]: v }))
  const projects = content.projects.filter((p) => p.locationId === l.id)
  return (
    <form
      className="admin-form"
      onSubmit={async (e) => {
        e.preventDefault()
        onSaved(await api.saveLocation(l))
      }}
    >
      <div className="admin-head">
        <h2>{l.name}</h2>
        <button className="btn primary">保存</button>
      </div>
      <div className="cols">
        <div>
          <Text label="名称 NAME" value={l.name} onChange={(v) => set('name', v)} hint="显示在地图、Overlay 中（3D 招牌使用固定字样）" />
          <Text label="核心问题 QUESTION" value={l.question} onChange={(v) => set('question', v)} />
          <Text label="描述 DESCRIPTION" value={l.description} onChange={(v) => set('description', v)} multiline />
          <Field label="区域 ZONE">
            <select value={l.zone} onChange={(e) => set('zone', e.target.value as Zone)}>
              {(Object.keys(ZONE_LABEL) as Zone[]).map((z) => (
                <option key={z} value={z}>
                  {ZONE_LABEL[z]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="交互动作 ACTION">
            <select value={l.action} onChange={(e) => set('action', e.target.value as InteractionAction)}>
              {ACTIONS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </Field>
        </div>
        <div>
          <Field label="主题色 COLOR">
            <input type="color" value={l.color} onChange={(e) => set('color', e.target.value)} />
          </Field>
          <Field label="纬度 LAT（-30 ~ 75）" hint="球面位置；靠近道路（纬度 0 或经度 0/180）最合适">
            <input type="number" step="1" value={l.lat} onChange={(e) => set('lat', Number(e.target.value))} />
          </Field>
          <Field label="经度 LON（-180 ~ 180）">
            <input type="number" step="1" value={l.lon} onChange={(e) => set('lon', Number(e.target.value))} />
          </Field>
          <Field label="停车点 PARKING">
            <input type="checkbox" checked={l.parking} onChange={(e) => set('parking', e.target.checked)} />
          </Field>
          <Field label={`此区块作品（${projects.length}）`} hint="在「作品」页设置作品所属区块">
            <ul className="plain">
              {projects.map((p) => (
                <li key={p.id}>
                  {p.title} {!p.published && <em>（未发布）</em>}
                </li>
              ))}
            </ul>
          </Field>
        </div>
      </div>
    </form>
  )
}

export function LocationsTab({ content, onSaved }: { content: SiteContent; onSaved: (c: SiteContent) => void }) {
  const [id, setId] = useState(content.locations[0]?.id)
  const loc = content.locations.find((l) => l.id === id)
  return (
    <div className="split">
      <div className="list">
        {content.locations.map((l) => (
          <button key={l.id} className={`list-item ${l.id === id ? 'active' : ''}`} onClick={() => setId(l.id)}>
            <i style={{ background: l.color }} />
            <div>
              <strong>{l.name}</strong>
              <small>
                {ZONE_LABEL[l.zone]} · {l.projectIds.length} 项
              </small>
            </div>
          </button>
        ))}
      </div>
      {loc && <LocationEditor key={loc.id} initial={loc} content={content} onSaved={onSaved} />}
    </div>
  )
}
