import { type QualityMode, levelOf, useQuality } from '../world/quality'

const MODES: QualityMode[] = ['auto', 'high', 'medium', 'low']
const LABEL: Record<QualityMode, string> = { auto: '自动', high: '高', medium: '中', low: '低' }

/** HUD controls: grass on/off and render quality cycling, with the live frame rate. */
export function QualityToggle() {
  const mode = useQuality((s) => s.mode)
  const level = useQuality(levelOf)
  const fps = useQuality((s) => s.fps)
  const setMode = useQuality((s) => s.setMode)
  const grass = useQuality((s) => s.grass)
  const setGrass = useQuality((s) => s.setGrass)
  const next = MODES[(MODES.indexOf(mode) + 1) % MODES.length]
  return (
    <div className="quality-ctl">
      <button className="quality-btn" onClick={() => setGrass(!grass)} title="草叶开关：关掉后地面换成平铺笔触">
        草 {grass ? '开' : '关'}
      </button>
      <button className="quality-btn" onClick={() => setMode(next)} title="切换画质">
        画质 {LABEL[mode]}
        {mode === 'auto' && <span>（{LABEL[level]}）</span>}
        <small>{fps} FPS</small>
      </button>
    </div>
  )
}
