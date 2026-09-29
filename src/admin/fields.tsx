import { useState, type ReactNode } from 'react'
import type { Asset, AssetKind } from '../../shared/types'
import { AssetPicker } from './AssetPicker'

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

export function Text({ label, value, onChange, multiline, hint, placeholder }: {
  label: string
  value: string | undefined
  onChange: (v: string) => void
  multiline?: boolean
  hint?: string
  placeholder?: string
}) {
  return (
    <Field label={label} hint={hint}>
      {multiline ? (
        <textarea value={value ?? ''} rows={4} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  )
}

export function ListText({ label, value, onChange, hint }: { label: string; value: string[] | undefined; onChange: (v: string[]) => void; hint?: string }) {
  const [raw, setRaw] = useState((value ?? []).join(', '))
  return (
    <Field label={label} hint={hint ?? '用逗号分隔'}>
      <input
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value)
          onChange(e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean))
        }}
      />
    </Field>
  )
}

function Preview({ url, kind }: { url: string; kind: AssetKind }) {
  if (kind === 'image') return <img src={url} alt="" />
  if (kind === 'video') return <video src={url} muted />
  return <span className="file-chip">{decodeURIComponent(url.split('/').pop() ?? url)}</span>
}

/** Single media value: pick from library/upload, or paste a URL. */
export function MediaField({ label, kind, value, onChange, hint }: {
  label: string
  kind: AssetKind
  value: string | undefined
  onChange: (v: string) => void
  hint?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <Field label={label} hint={hint}>
      <div className="media-field">
        {value ? <Preview url={value} kind={kind} /> : <div className="media-empty">未设置</div>}
        <div className="media-actions">
          <input value={value ?? ''} placeholder="URL 或从媒体库选择" onChange={(e) => onChange(e.target.value)} />
          <div className="row tight">
            <button type="button" className="btn" onClick={() => setOpen(true)}>
              选择 / 上传
            </button>
            {value && (
              <button type="button" className="btn ghost" onClick={() => onChange('')}>
                清除
              </button>
            )}
          </div>
        </div>
      </div>
      {open && (
        <AssetPicker
          kind={kind}
          onClose={() => setOpen(false)}
          onPick={(a: Asset[]) => {
            if (a[0]) onChange(a[0].url)
            setOpen(false)
          }}
        />
      )}
    </Field>
  )
}

/** Ordered list of media URLs (gallery). */
export function MediaListField({ label, kind, value, onChange }: { label: string; kind: AssetKind; value: string[] | undefined; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const list = value ?? []
  const move = (i: number, d: number) => {
    const next = [...list]
    const j = i + d
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  return (
    <Field label={label}>
      <div className="media-list">
        {list.map((url, i) => (
          <div key={url + i} className="media-item">
            <Preview url={url} kind={kind} />
            <div className="row tight">
              <button type="button" className="btn ghost" onClick={() => move(i, -1)}>←</button>
              <button type="button" className="btn ghost" onClick={() => move(i, 1)}>→</button>
              <button type="button" className="btn ghost" onClick={() => onChange(list.filter((_, k) => k !== i))}>✕</button>
            </div>
          </div>
        ))}
        <button type="button" className="media-add" onClick={() => setOpen(true)}>
          + 添加
        </button>
      </div>
      {open && (
        <AssetPicker
          kind={kind}
          multiple
          onClose={() => setOpen(false)}
          onPick={(a) => {
            onChange([...list, ...a.map((x) => x.url)])
            setOpen(false)
          }}
        />
      )}
    </Field>
  )
}
