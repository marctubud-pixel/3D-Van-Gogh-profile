import { type DayMode, nightOf, useDayNight } from '../world/daynight'
import { type QualityMode, levelOf, useQuality } from '../world/quality'

const MODES: QualityMode[] = ['auto', 'high', 'medium', 'low']
const DAY_MODES: DayMode[] = ['auto', 'day', 'night']
const DAY_LABEL: Record<DayMode, string> = { auto: '自动', day: '白天', night: '夜晚' }
const LABEL: Record<QualityMode, string> = { auto: '自动', high: '高', medium: '中', low: '低' }

/** Toolbar buttons for day/night, grass on/off and render quality (with the live frame rate in its tip). */
export function QualityToggle() {
  const mode = useQuality((s) => s.mode)
  const level = useQuality(levelOf)
  const fps = useQuality((s) => s.fps)
  const setMode = useQuality((s) => s.setMode)
  const grass = useQuality((s) => s.grass)
  const setGrass = useQuality((s) => s.setGrass)
  const day = useDayNight((s) => s.mode)
  const setDay = useDayNight((s) => s.setMode)
  const night = nightOf(day)
  const nextDay = DAY_MODES[(DAY_MODES.indexOf(day) + 1) % DAY_MODES.length]
  const next = MODES[(MODES.indexOf(mode) + 1) % MODES.length]
  return (
    <>
      <button className="bar-btn" onClick={() => setDay(nextDay)} aria-label="DAY/NIGHT">
        <svg viewBox="0 0 24 24">
          {night ? (
            <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
          ) : (
            <>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </>
          )}
        </svg>
        <small>
          {DAY_LABEL[day]}
          {day === 'auto' && `（${night ? '夜' : '日'}）`}
        </small>
      </button>
      <button className={`bar-btn${grass ? '' : ' off'}`} onClick={() => setGrass(!grass)} aria-label="GRASS">
        <svg viewBox="0 0 24 24">
          <path d="M6 20c0-5-1-9-3-12M10 20c0-6 0-10 2-14M14 20c0-4 1-8 4-11M18 20c0-3 1-5 3-7" />
        </svg>
        <small>草 {grass ? '开' : '关'}</small>
      </button>
      <button className="bar-btn" onClick={() => setMode(next)} aria-label="QUALITY">
        <svg viewBox="0 0 24 24">
          <rect x="3" y="6" width="18" height="13" rx="2" />
          <path d="M8 6l1.5-2.5h5L16 6" />
          <circle cx="12" cy="12.5" r="3.5" />
        </svg>
        <small>
          画质 {LABEL[mode]}
          {mode === 'auto' && `（${LABEL[level]}）`} · {fps} FPS
        </small>
      </button>
    </>
  )
}
