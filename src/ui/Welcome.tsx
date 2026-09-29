import { Link, useNavigate } from 'react-router-dom'
import { useContent } from '../data/content'
import { hasWebGL, isMobile } from './webgl'

export function Welcome() {
  const profile = useContent((s) => s.content!.profile)
  const navigate = useNavigate()
  const enter = () => {
    if (!hasWebGL()) navigate('/index?fallback=1')
    else if (isMobile()) navigate('/map')
    else navigate('/explore')
  }
  return (
    <div className="welcome">
      <div className="welcome-sky">
        <div className="sun" />
        <div className="planet-arc" />
      </div>
      <main className="welcome-card">
        <p className="eyebrow">{profile.headline}</p>
        <h1>MY WORLD</h1>
        <p className="tagline">{profile.tagline}</p>
        <button className="btn primary big" onClick={enter}>
          ENTER MY WORLD
        </button>
        <div className="welcome-links">
          <Link to="/index">INDEX</Link>
          <Link to="/info">INFO</Link>
          <Link to="/map">MAP</Link>
        </div>
      </main>
      <footer className="welcome-foot">
        <span>© {profile.name}</span>
        <Link to="/admin" className="admin-link">
          ADMIN
        </Link>
      </footer>
    </div>
  )
}
