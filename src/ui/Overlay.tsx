import { useEffect, type ReactNode } from 'react'

export function Overlay({ onClose, onBack, children }: { onClose: () => void; onBack?: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === 'Escape') (onBack ?? onClose)()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose, onBack])
  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay-panel" onClick={(e) => e.stopPropagation()}>
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
