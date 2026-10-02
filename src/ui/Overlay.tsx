import { useEffect, type ReactNode } from 'react'

export function Overlay({ onClose, onBack, place, children }: { onClose: () => void; onBack?: () => void; place?: string; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === 'Escape') (onBack ?? onClose)()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose, onBack])
  return (
    <div className="overlay" onClick={onClose}>
      <svg className="paint-defs" aria-hidden>
        <filter id="paint-edge">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="9" />
        </filter>
      </svg>
      <div className={`overlay-panel${place ? ` place place-${place}` : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="overlay-bar">
          {onBack ? (
            <button className="btn ghost" onClick={onBack}>
              ← BACK
            </button>
          ) : (
            <span />
          )}
          <button className="btn ghost" onClick={onClose}>
            CLOSE · ESC
          </button>
        </div>
        <div className="overlay-body">{children}</div>
      </div>
    </div>
  )
}
