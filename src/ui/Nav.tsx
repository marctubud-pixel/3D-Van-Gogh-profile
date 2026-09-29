import { Link, NavLink } from 'react-router-dom'
import { useContent } from '../data/content'

export function TopNav() {
  const name = useContent((s) => s.content?.profile.name)
  return (
    <header className="topnav">
      <Link to="/" className="brand">
        MY WORLD<span>{name ? ` · ${name}` : ''}</span>
      </Link>
      <nav>
        <NavLink to="/explore">EXPLORE</NavLink>
        <NavLink to="/map">MAP</NavLink>
        <NavLink to="/index">INDEX</NavLink>
        <NavLink to="/info">INFO</NavLink>
      </nav>
    </header>
  )
}
