import { useMemo } from 'react'
import * as THREE from 'three'
import { Toon, geo } from '../world/toon'
import { Decal, textTex } from './parts'

export interface SignArm {
  /** Horizontal world direction the arm points. */
  dir: THREE.Vector3
  label: string
}

const WOOD = '#8c6a3c'
const BOARD = '#f2ecdf'
const INK = '#2f4a78'
const LEN = 2.2

/** Wooden fingerpost: one arrow board per destination, readable from both sides. */
export function Signpost({ arms }: { arms: SignArm[] }) {
  const boards = useMemo(
    () =>
      arms.map((a, i) => ({
        yaw: Math.atan2(-a.dir.z, a.dir.x),
        y: 2.5 - i * 0.48,
        tex: textTex([a.label], 256, 48, { fg: INK, bg: BOARD, weight: 800 }),
      })),
    [arms],
  )
  return (
    <group>
      <Toon geometry={geo.box} color={WOOD} position={[0, 1.4, 0]} scale={[0.14, 2.8, 0.14]} outline={0.02} />
      {boards.map((b, i) => (
        <group key={i} position={[0, b.y, 0]} rotation={[0, b.yaw, 0]}>
          <Toon geometry={geo.box} color={BOARD} position={[LEN / 2, 0, 0]} scale={[LEN, 0.38, 0.06]} outline={0.02} />
          <Toon geometry={geo.box} color={BOARD} position={[LEN, 0, 0]} rotation={[0, 0, Math.PI / 4]} scale={[0.27, 0.27, 0.06]} outline={0.02} />
          <Decal tex={b.tex} p={[LEN / 2, 0, 0.035]} w={LEN - 0.2} h={0.33} />
          <Decal tex={b.tex} p={[LEN / 2, 0, -0.035]} w={LEN - 0.2} h={0.33} r={[0, Math.PI, 0]} />
        </group>
      ))}
    </group>
  )
}
