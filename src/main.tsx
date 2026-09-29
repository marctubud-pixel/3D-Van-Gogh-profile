import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './styles/global.css'
import { ContentGate } from './ui/ContentGate'
import { Welcome } from './ui/Welcome'
import { IndexPage } from './ui/IndexPage'
import { InfoPage } from './ui/InfoPage'
import { ProjectPage } from './portfolio/ProjectPage'
import { MapPage } from './navigation/MapPage'

const Explore = lazy(() => import('./app/Explore'))
const Admin = lazy(() => import('./admin/Admin'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={<div className="loading">LOADING MY WORLD…</div>}>
        <Routes>
          <Route path="/admin/*" element={<Admin />} />
          <Route element={<ContentGate />}>
            <Route path="/" element={<Welcome />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/index" element={<IndexPage />} />
            <Route path="/info" element={<InfoPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/project/:id" element={<ProjectPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
)
