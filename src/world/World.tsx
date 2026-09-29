import { Canvas, useFrame } from '@react-three/fiber'
import { Component, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import type { WorldLocation } from '../../shared/types'
import { useGame } from '../app/game'
import { CAMERA } from '../camera/config'
import { Landmark } from '../locations/Landmark'
import { Player } from '../player/Player'
import { Planet } from './Planet'

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
function SunRig() {
  const sun = useRef<THREE.DirectionalLight>(null)
  useFrame(({ camera }) => {
    const l = sun.current
    if (!l) return
    const up = camera.up.clone().normalize()
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
    const back = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion).projectOnPlane(up).normalize()
    const dir = up.multiplyScalar(1).add(right.multiplyScalar(0.7)).add(back.multiplyScalar(-0.35)).normalize()
    l.position.copy(camera.position).add(dir.multiplyScalar(60))
    l.target.position.copy(camera.position)
    l.target.updateMatrixWorld()
  })
  return <directionalLight ref={sun} intensity={1.7} color="#fff1dc" />
}

export function World({ locations, onError }: { locations: WorldLocation[]; onError: () => void }) {
  const routeTargetId = useGame((s) => s.routeTargetId)
  return (
    <WorldBoundary onError={onError}>
      <Canvas
        shadows={false}
        dpr={[1, 2]}
        camera={{ fov: CAMERA.fov, near: 0.1, far: 400, position: [0, 45, 12] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.NoToneMapping
          scene.background = new THREE.Color('#bfe0e0')
          scene.fog = new THREE.Fog('#cfe6e2', 40, 110)
        }}
      >
        <ambientLight intensity={1.15} color="#f4efe4" />
        <SunRig />
        <Planet locations={locations} />
        {locations.map((l) => (
          <Landmark key={l.id} loc={l} active={routeTargetId === l.id} />
        ))}
        <Player locations={locations} />
      </Canvas>
    </WorldBoundary>
  )
}
