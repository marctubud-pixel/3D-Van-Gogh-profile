import { PerformanceMonitor } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Component, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import * as THREE from 'three'
import { QUALITY, useQuality, useQualityLevel } from './quality'
import { dusk, nightOf, useDayNight } from './daynight'
import { setLitGlow, setNightTint } from './strokes'
import { StreetLamps } from './StreetLamps'
import type { WorldLocation } from '../../shared/types'
import { useGame } from '../app/game'
import { CAMERA } from '../camera/config'
import { Landmark, ServiceCenterSite } from '../locations/Landmark'
import { Player } from '../player/Player'
import { BrushPass } from './brush'
import { Planet } from './Planet'
import { Critters } from './Critters'
import { Sky } from './Sky'
import { StreetProps } from './StreetProps'
import { Town } from './Town'

class WorldBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onError()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

/** Keeps a soft afternoon sun above the viewer wherever they are on the planet. */
function SunRig({ sun }: { sun: RefObject<THREE.DirectionalLight | null> }) {
  const size = QUALITY[useQualityLevel()].shadowMap
  useLayoutEffect(() => {
    const l = sun.current
    if (!l || !size) return
    l.shadow.mapSize.set(size, size)
    l.shadow.map?.dispose()
    l.shadow.map = null
  }, [size, sun])
  useFrame(({ camera }) => {
    const l = sun.current
    if (!l) return
    const up = camera.up.clone().normalize()
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
    const back = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion).projectOnPlane(up).normalize()
    const dir = up.multiplyScalar(1).add(right.multiplyScalar(0.7)).add(back.multiplyScalar(-0.35)).normalize()
    const focus = camera.position.clone().add(new THREE.Vector3(0, 0, -6).applyQuaternion(camera.quaternion))
    l.position.copy(focus).add(dir.multiplyScalar(50))
    l.target.position.copy(focus)
    l.target.updateMatrixWorld()
  })
  return (
    <directionalLight
      ref={sun}
      intensity={1.9}
      color="#fff6e6"
      castShadow={size > 0}
      shadow-bias={-0.0025}
      shadow-normalBias={0.12}
      shadow-camera-left={-28}
      shadow-camera-right={28}
      shadow-camera-top={28}
      shadow-camera-bottom={-28}
      shadow-camera-near={1}
      shadow-camera-far={120}
    />
  )
}

const DAY = { bg: new THREE.Color('#9fdbd2'), amb: new THREE.Color('#c9dcdc'), sun: new THREE.Color('#fff6e6'), tint: new THREE.Color(1, 1, 1) }
const NIGHT = { bg: new THREE.Color('#1b2a4a'), amb: new THREE.Color('#c9dcdc'), sun: new THREE.Color('#fff6e6'), tint: new THREE.Color(0.46, 0.46, 0.48) }

/** Eases between day and night: background, light colour/intensity and the tint of every unlit painted material. */
function DayNightRig({ ambient, sun }: { ambient: RefObject<THREE.AmbientLight | null>; sun: RefObject<THREE.DirectionalLight | null> }) {
  const mode = useDayNight((s) => s.mode)
  const tint = useRef(new THREE.Color())
  useFrame(({ scene }, dt) => {
    const target = nightOf(mode) ? 1 : 0
    dusk.k = THREE.MathUtils.damp(dusk.k, target, 2.5, Math.min(dt, 0.1))
    if (Math.abs(dusk.k - target) < 0.002) dusk.k = target
    const k = dusk.k
    if (scene.background instanceof THREE.Color) scene.background.lerpColors(DAY.bg, NIGHT.bg, k)
    if (ambient.current) {
      ambient.current.color.lerpColors(DAY.amb, NIGHT.amb, k)
      ambient.current.intensity = THREE.MathUtils.lerp(1.2, 0.55, k)
    }
    if (sun.current) {
      sun.current.color.lerpColors(DAY.sun, NIGHT.sun, k)
      sun.current.intensity = THREE.MathUtils.lerp(1.9, 0.45, k)
    }
    setNightTint(tint.current.lerpColors(DAY.tint, NIGHT.tint, k))
    setLitGlow(k)
  })
  return null
}

/** Samples the frame rate for the HUD and, in auto mode, steps quality down or up to keep it smooth. */
function QualityGovernor() {
  const acc = useRef({ t: 0, n: 0 })
  useFrame((_, dt) => {
    const a = acc.current
    a.t += dt
    a.n++
    if (a.t < 0.5) return
    useQuality.getState().setFps(Math.round(a.n / a.t))
    a.t = 0
    a.n = 0
  })
  const auto = useQuality((s) => s.mode === 'auto')
  const step = useQuality((s) => s.step)
  if (!auto) return null
  return <PerformanceMonitor bounds={() => [30, 55]} flipflops={4} onDecline={() => step(-1)} onIncline={() => step(1)} />
}

export function World({ locations, onError }: { locations: WorldLocation[]; onError: () => void }) {
  const routeTargetId = useGame((s) => s.routeTargetId)
  const dpr = QUALITY[useQualityLevel()].dpr
  const ambient = useRef<THREE.AmbientLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  return (
    <WorldBoundary onError={onError}>
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        dpr={[1, dpr]}
        camera={{ fov: CAMERA.fov, near: 0.1, far: 3000, position: [0, 45, 12] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.NoToneMapping
          scene.background = new THREE.Color('#9fdbd2')
        }}
      >
        <QualityGovernor />
        <ambientLight ref={ambient} intensity={1.2} color="#c9dcdc" />
        <DayNightRig ambient={ambient} sun={sun} />
        <Sky />
        <SunRig sun={sun} />
        <Planet locations={locations} />
        <StreetProps locations={locations} />
        <StreetLamps locations={locations} />
        <Town locations={locations} />
        <Critters />
        {locations.map((l) => (
          <Landmark key={l.id} loc={l} active={routeTargetId === l.id} />
        ))}
        <ServiceCenterSite />
        <Player locations={locations} />
        <BrushPass />
      </Canvas>
    </WorldBoundary>
  )
}
