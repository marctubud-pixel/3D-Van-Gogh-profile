import { useFrame, useThree } from '@react-three/fiber'
import { useRef, type ReactNode } from 'react'
import * as THREE from 'three'

/** World-space point the camera looks at (updated by Player each frame). */
export const camFocus = new THREE.Vector3(0, 42, 0)
/** Unit up-direction of the player's current position on the planet. */
export const playerUp = new THREE.Vector3(0, 1, 0)

const seg = new THREE.Line3()
const closest = new THREE.Vector3()
const world = new THREE.Vector3()

/**
 * Fades a subtree of meshes while it blocks the line between the camera and the player.
 * MeshToonMaterials are cloned lazily on first fade; hull/edge line objects hide instead.
 */
export function Fadeable({ radius = 2.6, height = 2.4, children }: { radius?: number; height?: number; children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const center = useRef<THREE.Vector3 | null>(null)
  const three = useThree()

  useFrame(() => {
    const g = group.current
    if (!g) return
    if (!center.current) {
      g.getWorldPosition(world)
      const up = world.clone().normalize()
      center.current = world.clone().addScaledVector(up, height)
    }
    seg.start.copy(three.camera.position)
    seg.end.copy(camFocus)
    seg.closestPointToPoint(center.current, true, closest)
    const blocked = closest.distanceTo(center.current) < radius
    const nearFocus = center.current.distanceTo(camFocus) < 1.5
    const fade = blocked && !nearFocus
    let cloned = false
    g.traverse((o) => {
      if (o instanceof THREE.LineSegments) {
        o.visible = !fade
      } else if (o instanceof THREE.Mesh) {
        const m = o.material
        if (m instanceof THREE.MeshToonMaterial) {
          if (fade && !m.transparent) cloned = true
          if (m.transparent) m.opacity = fade ? 0.28 : 1
        } else if (m instanceof THREE.ShaderMaterial) {
          o.visible = !fade
        }
      }
    })
    if (cloned) {
      g.traverse((o) => {
        if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshToonMaterial) {
          const m = o.material.clone()
          m.transparent = true
          m.opacity = 0.28
          o.material = m
        }
      })
    }
  })

  return <group ref={group}>{children}</group>
}
