import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useContent } from '../data/content'

export function ContentGate() {
  const { content, load } = useContent()
  useEffect(() => {
    load()
  }, [load])
  if (!content) return <div className="loading">LOADING MY WORLD…</div>
  return <Outlet />
}
