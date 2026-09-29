import { useEffect, useState } from 'react'
import type { Asset, AssetKind } from '../../shared/types'
import { api } from '../data/api'
import { AssetThumb, UploadButton, formatSize } from './AssetPicker'

const KINDS: (AssetKind | 'all')[] = ['all', 'image', 'video', 'document', 'audio', 'model', 'other']

export function MediaTab() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [kind, setKind] = useState<AssetKind | 'all'>('all')
  const [dragging, setDragging] = useState(false)
  useEffect(() => {
    api.assets().then(setAssets)
  }, [])
  const list = assets.filter((a) => kind === 'all' || a.kind === kind)
  return (
    <div
      className={`admin-form ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={async (e) => {
        e.preventDefault()
        setDragging(false)
        const files = [...e.dataTransfer.files]
        if (files.length) {
          const created = await api.upload(files)
          setAssets((a) => [...created, ...a])
        }
      }}
    >
      <div className="admin-head">
        <h2>媒体库 · MEDIA</h2>
        <UploadButton onUploaded={(c) => setAssets((a) => [...c, ...a])} label="上传图片 / 视频 / 文档" />
      </div>
      <p className="muted">支持拖拽上传。上传后可在「个人资料」「作品」中选择使用。</p>
      <div className="filters">
        {KINDS.map((k) => (
          <button key={k} className={`chip ${kind === k ? 'active' : ''}`} onClick={() => setKind(k)}>
            {k} ({k === 'all' ? assets.length : assets.filter((a) => a.kind === k).length})
          </button>
        ))}
      </div>
      <div className="asset-grid">
        {list.map((a) => (
          <div key={a.id} className="asset">
            <a href={a.url} target="_blank" rel="noreferrer">
              <AssetThumb asset={a} />
            </a>
            <span title={a.originalName}>{a.originalName}</span>
            <small>
              {a.kind} · {formatSize(a.size)}
            </small>
            <div className="row tight">
              <button className="btn ghost" onClick={() => navigator.clipboard.writeText(location.origin + a.url)}>
                复制链接
              </button>
              <button
                className="btn ghost"
                onClick={async () => {
                  if (!confirm(`删除 ${a.originalName}？引用它的内容将无法显示。`)) return
                  await api.deleteAsset(a.id)
                  setAssets((s) => s.filter((x) => x.id !== a.id))
                }}
              >
                删除
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
