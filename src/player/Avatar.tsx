import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { CRANK, GRIP_POS } from '../bike/Bike'
import { Toon, geo, toonMaterial } from '../world/toon'

const SKIN = '#f2d2b8'
const HAIR = '#262c3a'
const CAP = '#6b7c96'
const SHORTS = '#66778f'
const TEE = '#f3eee2'
const BAG = '#4d4846'
const SOCK = '#f5f3ec'
const SHOE = '#ebe9e2'
const SOLE = '#b6babc'
const STRIPE_BLUE = '#6a7ea3'
const STRIPE_CREAM = '#f1ebdd'

const limb = new THREE.CapsuleGeometry(0.5, 1, 4, 12)
const brim = new THREE.CylinderGeometry(0.5, 0.5, 1, 20, 1, false, -Math.PI / 2, Math.PI)
const sleeveGeo = new THREE.CylinderGeometry(0.5, 0.62, 1, 14, 1, true)
const shortsLegGeo = new THREE.CylinderGeometry(0.5, 0.56, 1, 14, 1, false)
const OPEN = 0.42
const LEG_LENGTH = 0.86
const HIP_WALK = 0.86
const HIP_RIDE = 1.02
const HIP_X_RIDE = 0.13
const AVATAR_Z_RIDE = -0.34
const LEAN_RIDE = 0.35
const THIGH = 0.38
const SHIN = 0.44
const UPPER = 0.3
const FORE = 0.28

const DOWN = new THREE.Vector3(0, -1, 0)
const _v = new THREE.Vector3()
const _axis = new THREE.Vector3()
const _end = new THREE.Vector3()
const _mid = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _t = new THREE.Vector3()

/** Loose boxy camp-shirt silhouette: straight hem, soft shoulders, open at the front. */
const shirtGeo = new THREE.LatheGeometry(
  [
    new THREE.Vector2(0.54, -0.1),
    new THREE.Vector2(0.55, 0.28),
    new THREE.Vector2(0.53, 0.44),
    new THREE.Vector2(0.42, 0.52),
    new THREE.Vector2(0.22, 0.57),
  ],
  28,
  OPEN,
  Math.PI * 2 - OPEN * 2,
)
const torsoGeo = new THREE.LatheGeometry(
  [
    new THREE.Vector2(0.001, -0.08),
    new THREE.Vector2(0.46, -0.06),
    new THREE.Vector2(0.48, 0.3),
    new THREE.Vector2(0.4, 0.5),
    new THREE.Vector2(0.18, 0.57),
    new THREE.Vector2(0.001, 0.58),
  ],
  24,
)

function stripeMaterial(repeat: number) {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 8
  const g = c.getContext('2d')!
  g.fillStyle = STRIPE_BLUE
  g.fillRect(0, 0, 32, 8)
  g.fillStyle = STRIPE_CREAM
  g.fillRect(32, 0, 32, 8)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  tex.repeat.set(repeat, 1)
  tex.magFilter = THREE.NearestFilter
  tex.colorSpace = THREE.SRGBColorSpace
  const m = toonMaterial('#ffffff').clone()
  m.map = tex
  m.side = THREE.DoubleSide
  return m
}

interface Joint {
  root: THREE.Group | null
  mid: THREE.Group | null
  end: THREE.Group | null
}

/** Two-bone IK: aims root's -Y at the knee/elbow and mid's -Y at the target, bending toward `pole`. */
function solveIK(j: Joint, rootPos: THREE.Vector3, target: THREE.Vector3, L1: number, L2: number, pole: THREE.Vector3) {
  if (!j.root || !j.mid) return
  _v.copy(target).sub(rootPos)
  const d = THREE.MathUtils.clamp(_v.length(), Math.abs(L1 - L2) + 0.01, L1 + L2 - 0.005)
  const dir = _v.normalize()
  const cosA = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)
  const bend = Math.acos(THREE.MathUtils.clamp(cosA, -1, 1))
  _axis.crossVectors(dir, pole)
  if (_axis.lengthSq() < 1e-6) _axis.set(1, 0, 0)
  else _axis.normalize()
  _mid.copy(dir).applyAxisAngle(_axis, bend)
  j.root.quaternion.setFromUnitVectors(DOWN, _mid)
  _end.copy(target).sub(rootPos).addScaledVector(_mid, -L1)
  _q.copy(j.root.quaternion).invert()
  _end.applyQuaternion(_q).normalize()
  j.mid.quaternion.setFromUnitVectors(DOWN, _end)
  if (j.end) j.end.quaternion.copy(j.root.quaternion).multiply(j.mid.quaternion).invert()
}

interface AvatarProps {
  pose: 'ride' | 'walk'
  speed: RefObject<number>
  crank?: RefObject<number>
  steer?: RefObject<number>
}

function Leg({ side, refs, hip, hipX }: { side: number; refs: RefObject<Joint>; hip: number; hipX: number }) {
  const floor = -LEG_LENGTH
  return (
    <group
      ref={(g) => {
        refs.current.root = g
      }}
      position={[side * hipX, hip, 0]}
    >
      <Toon soft geometry={shortsLegGeo} color={SHORTS} position={[side * 0.01, -0.17, 0]} scale={[0.2, 0.34, 0.21]} outline={0.02} radial={false} />
      <Toon soft geometry={limb} color={SKIN} position={[0, -0.19, 0]} scale={[0.11, 0.28, 0.11]} outline={0.014} radial={false} />
      <group
        ref={(g) => {
          refs.current.mid = g
        }}
        position={[0, -THIGH, 0]}
      >
        <Toon soft geometry={limb} color={SKIN} position={[0, -0.19, 0]} scale={[0.095, 0.25, 0.095]} outline={0.014} radial={false} />
        <Toon soft geometry={geo.cyl} color={SOCK} position={[0, -0.36, 0]} scale={[0.1, 0.18, 0.1]} outline={0.012} />
        <group
          ref={(g) => {
            refs.current.end = g
          }}
          position={[0, -SHIN, 0]}
        >
          <Toon soft geometry={limb} color={SHOE} position={[0, floor + LEG_LENGTH - 0.79, 0.05]} rotation={[Math.PI / 2, 0, 0]} scale={[0.14, 0.1, 0.12]} outline={0.018} radial={false} />
          <Toon soft geometry={geo.box} color={SOLE} position={[0, -0.06, 0.05]} scale={[0.14, 0.04, 0.3]} outline={0} />
          <Toon soft geometry={geo.box} color="#c9cccd" position={[side * 0.07, -0.01, 0.06]} scale={[0.01, 0.05, 0.14]} outline={0} />
        </group>
      </group>
    </group>
  )
}

function Arm({ side, refs, sleeve }: { side: number; refs: RefObject<Joint>; sleeve: THREE.Material }) {
  return (
    <group
      ref={(g) => {
        refs.current.root = g
      }}
      position={[side * 0.22, 0.47, 0]}
    >
      <Toon soft geometry={sleeveGeo} color="#fff" material={sleeve} position={[0, -0.1, 0]} scale={[0.15, 0.24, 0.16]} outline={0.016} radial={false} />
      <Toon soft geometry={limb} color={SKIN} position={[0, -0.15, 0]} scale={[0.08, 0.16, 0.08]} outline={0.012} radial={false} />
      <group
        ref={(g) => {
          refs.current.mid = g
        }}
        position={[0, -UPPER, 0]}
      >
        <Toon soft geometry={limb} color={SKIN} position={[0, -0.13, 0]} scale={[0.07, 0.14, 0.07]} outline={0.012} radial={false} />
        <Toon soft geometry={geo.sphere} color={SKIN} position={[0, -FORE, 0.01]} scale={[0.075, 0.1, 0.06]} outline={0.01} radial={false} />
      </group>
    </group>
  )
}

/** Creator Avatar after the character sheet: slim ~6.5-head proportions, blue-gray cap, loose open wide-stripe camp shirt over a cream tee, slate shorts, crew socks, chunky sneakers, crossbody bag. Riding pose is IK-solved so feet stay on the pedals and hands on the grips. */
export function Avatar({ pose, speed, crank, steer }: AvatarProps) {
  const legL = useRef<Joint>({ root: null, mid: null, end: null })
  const legR = useRef<Joint>({ root: null, mid: null, end: null })
  const armL = useRef<Joint>({ root: null, mid: null, end: null })
  const armR = useRef<Joint>({ root: null, mid: null, end: null })
  const phase = useRef(0)
  const shirt = useMemo(() => stripeMaterial(7), [])
  const sleeve = useMemo(() => stripeMaterial(3), [])

  const hip = pose === 'ride' ? HIP_RIDE : HIP_WALK
  const hipX = pose === 'ride' ? HIP_X_RIDE : 0.1
  const poleLegL = useMemo(() => new THREE.Vector3(-0.25, 0, 1).normalize(), [])
  const poleLegR = useMemo(() => new THREE.Vector3(0.25, 0, 1).normalize(), [])
  const poleArmL = useMemo(() => new THREE.Vector3(-0.6, -0.5, -0.3).normalize(), [])
  const poleArmR = useMemo(() => new THREE.Vector3(0.6, -0.5, -0.3).normalize(), [])

  useFrame((_, dt) => {
    const v = speed.current ?? 0
    if (pose === 'walk') {
      phase.current += dt * v * 5.5
      const s = Math.sin(phase.current) * Math.min(1, Math.abs(v) * 1.2) * 0.55
      for (const [j, sw] of [
        [legL.current, s],
        [legR.current, -s],
      ] as const) {
        if (j.root) j.root.rotation.set(sw, 0, 0)
        if (j.mid) j.mid.rotation.set(sw > 0 ? sw * 0.7 : -sw * 0.15, 0, 0)
        if (j.end && j.root && j.mid) j.end.rotation.set(-(sw + j.mid.rotation.x) * 0.8, 0, 0)
      }
      for (const [j, sw] of [
        [armL.current, -s],
        [armR.current, s],
      ] as const) {
        if (j.root) j.root.rotation.set(sw * 0.7, 0, 0)
        if (j.mid) j.mid.rotation.set(-0.2, 0, 0)
      }
      return
    }
    // ride: feet on pedals, hands on grips
    const th = crank?.current ?? 0
    const st = steer?.current ?? 0
    for (const [j, sgn, pole] of [
      [legR.current, 1, poleLegR],
      [legL.current, -1, poleLegL],
    ] as const) {
      // pedal: crank rotates about x; right pedal at +r, left at -r
      _t.set(
        sgn * CRANK.x,
        CRANK.y + sgn * CRANK.r * Math.cos(th) + 0.06,
        CRANK.z + sgn * CRANK.r * Math.sin(th) + 0.05 - AVATAR_Z_RIDE,
      )
      solveIK(j, _v.set(sgn * HIP_X_RIDE, HIP_RIDE, 0), _t, THIGH, SHIN, pole)
    }
    for (const [j, sgn, pole] of [
      [armL.current, -1, poleArmL],
      [armR.current, 1, poleArmR],
    ] as const) {
      // grip in bike space (rotates with the fork about its pivot at z=0.54), then into torso space
      const gx = sgn * GRIP_POS.x * Math.cos(st * 0.5) + (GRIP_POS.z - 0.54) * Math.sin(st * 0.5)
      const gz = 0.54 - sgn * GRIP_POS.x * Math.sin(st * 0.5) + (GRIP_POS.z - 0.54) * Math.cos(st * 0.5)
      _t.set(gx, GRIP_POS.y, gz - AVATAR_Z_RIDE)
      _t.y -= HIP_RIDE
      _t.applyAxisAngle(new THREE.Vector3(1, 0, 0), -LEAN_RIDE)
      solveIK(j, _v.set(sgn * 0.22, 0.47, 0), _t, UPPER, FORE, pole)
    }
  })

  return (
    <group position={[0, 0, pose === 'ride' ? AVATAR_Z_RIDE : 0]}>
      <Leg side={-1} refs={legL} hip={hip} hipX={hipX} />
      <Leg side={1} refs={legR} hip={hip} hipX={hipX} />
      <group position={[0, hip, 0]} rotation={[pose === 'ride' ? LEAN_RIDE : 0, 0, 0]}>
        <Toon soft geometry={shortsLegGeo} color={SHORTS} position={[0, -0.02, 0]} scale={[0.36, 0.16, 0.22]} outline={0.015} radial={false} />
        {/* cream tee + open striped shirt */}
        <Toon soft geometry={torsoGeo} color={TEE} scale={[0.37, 1, 0.21]} outline={0} radial={false} />
        <Toon soft geometry={shirtGeo} color="#fff" material={shirt} scale={[0.43, 1, 0.26]} outline={0.02} radial={false} />
        {[-1, 1].map((s) => (
          <Toon soft key={s} geometry={geo.box} color={STRIPE_CREAM} position={[s * 0.09, 0.5, 0.12]} rotation={[0.25, 0, s * -0.55]} scale={[0.09, 0.16, 0.015]} outline={0.008} />
        ))}
        {/* crossbody strap from right shoulder to left hip, small pouch on the left */}
        <Toon soft geometry={geo.box} color={BAG} position={[-0.01, 0.3, 0.135]} rotation={[0, 0, -0.72]} scale={[0.035, 0.68, 0.015]} outline={0} />
        <Toon soft geometry={geo.box} color={BAG} position={[-0.01, 0.3, -0.135]} rotation={[0, 0, 0.72]} scale={[0.035, 0.68, 0.015]} outline={0} />
        <Toon soft geometry={geo.sphere} color={BAG} position={[-0.25, 0.04, 0.05]} scale={[0.1, 0.17, 0.16]} outline={0.016} radial={false} />
        <Arm side={-1} refs={armL} sleeve={sleeve} />
        <Arm side={1} refs={armR} sleeve={sleeve} />
        {/* neck, head, hair, cap */}
        <Toon soft geometry={geo.cyl} color={SKIN} position={[0, 0.62, 0]} scale={[0.09, 0.12, 0.09]} outline={0} />
        <Toon soft geometry={geo.sphere} color={SKIN} position={[0, 0.79, 0.01]} scale={[0.24, 0.28, 0.25]} outline={0.018} radial={false} />
        {[-1, 1].map((s) => (
          <Toon soft key={s} geometry={geo.sphere} color={SKIN} position={[s * 0.12, 0.78, 0]} scale={[0.04, 0.07, 0.05]} outline={0.008} radial={false} />
        ))}
        {[-1, 1].map((s) => (
          <Toon soft key={`eye${s}`} geometry={geo.sphere} color={HAIR} position={[s * 0.05, 0.78, 0.128]} scale={[0.028, 0.042, 0.02]} outline={0} radial={false} />
        ))}
        <Toon soft geometry={geo.box} color="#c98f7a" position={[0, 0.71, 0.128]} scale={[0.03, 0.008, 0.01]} outline={0} />
        <Toon soft geometry={geo.sphere} color={HAIR} position={[0, 0.81, -0.03]} scale={[0.26, 0.26, 0.25]} outline={0.016} radial={false} />
        {[-0.08, 0, 0.08].map((x, i) => (
          <Toon soft key={x} geometry={geo.cone} color={HAIR} position={[x, 0.86, 0.11]} rotation={[Math.PI + 0.3, 0, (i - 1) * 0.3]} scale={[0.06, 0.09, 0.04]} outline={0} />
        ))}
        {[-1, 1].map((s) => (
          <Toon soft key={s} geometry={geo.cone} color={HAIR} position={[s * 0.115, 0.8, 0.05]} rotation={[Math.PI, 0, 0]} scale={[0.04, 0.1, 0.05]} outline={0} />
        ))}
        <Toon soft geometry={geo.dome} color={CAP} position={[0, 0.86, 0]} scale={[0.27, 0.2, 0.28]} outline={0.016} radial={false} />
        <Toon soft geometry={brim} color={CAP} position={[0, 0.87, 0.1]} scale={[0.23, 0.02, 0.3]} outline={0.01} radial={false} />
        <Toon soft geometry={geo.sphere} color="#2c3437" position={[0, 0.94, -0.12]} scale={[0.07, 0.04, 0.03]} outline={0} radial={false} />
      </group>
    </group>
  )
}
