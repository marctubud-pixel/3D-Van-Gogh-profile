import { useEffect, useRef, useState } from 'react'
import type { Asset, AssetKind } from '../../shared/types'
import { api } from '../data/api'

const ACCEPT: Partial<Record<AssetKind, string>> = {
  image: 'image/*',
  video: 'video/*',
  audio: 'audio/*',
  document: '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.key,.pages',
  model: '.glb,.gltf',
}

export function formatSize(n: number) {
  if (n > 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(n / 1024))} KB`
}

export function AssetThumb({ asset }: { asset: Asset }) {
  if (asset.kind === 'image') return <img src={asset.url} alt={asset.originalName} loading="lazy" />
  if (asset.kind === 'video') return <video src={asset.url} muted preload="metadata" />
  return <div className="asset-icon">{asset.originalName.split('.').pop()?.toUpperCase()}</div>
}

export function UploadButton({ accept, onUploaded, label = '上传文件' }: { accept?: string; onUploaded: (a: Asset[]) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    setError(null)
    try {
      onUploaded(await api.upload([...files]))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  return (
    <>
      <input ref={input} type="file" multiple accept={accept} hidden onChange={(e) => upload(e.target.files)} />
      <button type="button" className="btn primary" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? '上传中…' : label}
      </button>
      {error && <span className="error">{error}</span>}
    </>
  )
}

interface PickerProps {
  kind: AssetKind
  multiple?: boolean
  onPick: (a: Asset[]) => void
  onClose: () => void
}

export function AssetPicker({ kind, multiple, onPick, onClose }: PickerProps) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [selected, setSelected] = useState<string[]>([])
  useEffect(() => {
    api.assets().then(setAssets)
  }, [])
  const list = assets.filter((a) => a.kind === kind)
  const toggle = (a: Asset) => {
    if (!multiple) return onPick([a])
    setSelected((s) => (s.includes(a.id) ? s.filter((x) => x !== a.id) : [...s, a.id]))
  }
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>媒体库 · {kind}</strong>
          <div className="row tight">
            <UploadButton
              accept={ACCEPT[kind]}
              onUploaded={(created) => {
                setAssets((a) => [...created, ...a])
                const matching = created.filter((c) => c.kind === kind)
                if (!multiple && matching[0]) onPick([matching[0]])
                else setSelected((s) => [...s, ...matching.map((c) => c.id)])
              }}
            />
            {multiple && (
              <button type="button" className="btn" disabled={!selected.length} onClick={() => onPick(selected.map((id) => assets.find((a) => a.id === id)!))}>
                确认添加 ({selected.length})
              </button>
            )}
            <button type="button" className="btn ghost" onClick={onClose}>
              关闭
            </button>
          </div>
        </div>
        <div className="asset-grid">
          {list.map((a) => (
            <button type="button" key={a.id} className={`asset ${selected.includes(a.id) ? 'selected' : ''}`} onClick={() => toggle(a)}>
              <AssetThumb asset={a} />
              <span>{a.originalName}</span>
            </button>
          ))}
          {!list.length && <p className="muted">还没有此类文件，点击上方上传。</p>}
        </div>
      </div>
    </div>
  )
}
