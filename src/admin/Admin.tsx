import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { SiteContent } from '../../shared/types'
import { ApiError, api, auth } from '../data/api'
import { useContent } from '../data/content'
import '../styles/admin.css'
import { LocationsTab } from './LocationsTab'
import { MediaTab } from './MediaTab'
import { ProfileTab } from './ProfileTab'
import { ProjectsTab } from './ProjectsTab'

type Tab = 'profile' | 'locations' | 'projects' | 'media'

const TABS: [Tab, string][] = [
  ['profile', '个人资料 / INFO'],
  ['locations', '功能区块 / LANDMARKS'],
  ['projects', '作品 / PROJECTS'],
  ['media', '媒体库 / MEDIA'],
]

function Login({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="admin-login">
      <form
        className="welcome-card"
        onSubmit={async (e) => {
          e.preventDefault()
          try {
            auth.set((await api.login(password)).token)
            onLogin()
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
          }
        }}
      >
        <h1>ADMIN</h1>
        <p className="muted">MY WORLD 内容后台</p>
        <input type="password" autoFocus placeholder="管理员密码" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="error">{error}</p>}
        <button className="btn primary big" type="submit">
          登录
        </button>
        <p>
          <Link to="/">← 返回主页</Link>
        </p>
      </form>
    </div>
  )
}

export default function Admin() {
  const [authed, setAuthed] = useState(!!auth.get())
  const [content, setContent] = useState<SiteContent | null>(null)
  const [tab, setTab] = useState<Tab>('projects')
  const [flash, setFlash] = useState<string | null>(null)

  useEffect(() => {
    if (!authed) return
    api
      .adminContent()
      .then(setContent)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          auth.clear()
          setAuthed(false)
        }
      })
  }, [authed])

  if (!authed) return <Login onLogin={() => setAuthed(true)} />
  if (!content) return <div className="loading">LOADING…</div>

  const update = (c: SiteContent, msg = '已保存') => {
    setContent(c)
    useContent.setState({ content: null })
    setFlash(msg)
    setTimeout(() => setFlash(null), 1800)
  }

  return (
    <div className="admin">
      <aside className="admin-side">
        <Link to="/" className="brand">
          MY WORLD
        </Link>
        <p className="eyebrow">ADMIN</p>
        {TABS.map(([id, label]) => (
          <button key={id} className={`side-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
        <div className="side-foot">
          <a className="btn" href="/" target="_blank" rel="noreferrer">
            预览主页 ↗
          </a>
          <button
            className="btn ghost"
            onClick={() => {
              auth.clear()
              setAuthed(false)
            }}
          >
            退出登录
          </button>
        </div>
      </aside>
      <main className="admin-main">
        {tab === 'profile' && <ProfileTab content={content} onSaved={update} />}
        {tab === 'locations' && <LocationsTab content={content} onSaved={update} />}
        {tab === 'projects' && <ProjectsTab content={content} onSaved={update} />}
        {tab === 'media' && <MediaTab />}
      </main>
      {flash && <div className="flash">{flash}</div>}
    </div>
  )
}
