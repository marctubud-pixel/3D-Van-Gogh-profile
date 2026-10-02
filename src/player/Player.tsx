import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { WorldLocation } from '../../shared/types'
import { inputLocked, useGame } from '../app/game'
import { Bike } from '../bike/Bike'
import { CAMERA } from '../camera/config'
import { BUILDING_RADIUS, LANDMARK_FIT, NORTH, SERVICE_CENTER, UP, flatDir, flatDistance, planPoint, pointToPlan, modelScale, yawQuaternion } from '../world/plane'
import { MESAS, SERVICE_POINT, groundHeight, landmarkColliders, locationAnchors, locationPoint, nearestOnRoute, routeFrame, surf, walkable } from '../world/island'
import { camFocus, playerPos } from '../world/occlusion'
import { LOT_RADIUS, townLots } from '../world/townLayout'
import { dusk } from '../world/daynight'
import { useQualityLevel } from '../world/quality'
import { Avatar } from './Avatar'

const RIDE_MAX = 6
const WALK_MAX = 3
/** Distance from a landmark within which the rider is offered auto-parking. */
const PARK_OFFER = BUILDING_RADIUS + 11
const PARK_S = 1.3
const DOOR_RADIUS = 2.6
const BIKE_RADIUS = 1.8
const TRANSITION_S = 0.55
const UTURN_RATE = 3.4
/** Overview of the whole island: orbit centre on the flat map, distance and pitch. */
const INTRO = { x: 0, y: -40, dist: 300, pitch: 0.3, aimAhead: 40 }
const FLY_S = 2.8

const keys = new Set<string>()

const _cf = new THREE.Vector3()
const _cr = new THREE.Vector3()
const _mv = new THREE.Vector3()
const _sd = new THREE.Vector3()

/** Ground point (y = 0) and horizontal unit heading. */
interface Body {
  pos: THREE.Vector3
  fwd: THREE.Vector3
}

function spawn(s = 3): Body {
  const f = routeFrame(s)
  return { pos: f.at, fwd: f.tan }
}

const ease = (t: number) => t * t * (3 - 2 * t)

/** Advance a body across the ground by `dist` world units and yaw it by `yaw` radians. */
function advance(b: Body, dist: number, yaw: number) {
  if (yaw) b.fwd.applyAxisAngle(UP, yaw)
  b.fwd.copy(flatDir(b.fwd))
  if (dist) b.pos.addScaledVector(b.fwd, dist)
}

export function Player({ locations }: { locations: WorldLocation[] }) {
  const { camera, gl } = useThree()
  const anchors = useMemo(() => locations.map((l) => ({ loc: l, ...locationAnchors(locationPoint(l), l.id) })), [locations])
  const colliders = useMemo(
    () => [
      ...anchors.flatMap((a) => landmarkColliders(a, a.loc.id)),
      { at: SERVICE_POINT, r: SERVICE_CENTER.radius },
      ...MESAS.map((m) => ({ at: m.at, r: m.r })),
      ...townLots(locations)
        .filter((l) => l.kind !== 'garden')
        .map((l) => ({ at: l.at, r: LOT_RADIUS })),
    ],
    [anchors, locations],
  )

  const rider = useRef<Body>(spawn())
  const walker = useRef<Body>(spawn())
  const speed = useRef(0)
  const steer = useRef(0)
  const crank = useRef(0)
  const walkSpeed = useRef(0)
  const transition = useRef(0)
  const look = useRef<{ yaw: number; pitch: number; dragging: boolean; lastDrag: number }>({
    yaw: 0,
    pitch: CAMERA.walking.pitch,
    dragging: false,
    lastDrag: 0,
  })
  const uturn = useRef(0)
  /** Walking camera heading (tangent), independent of where the avatar faces. */
  const camHead = useRef(new THREE.Vector3())
  const frameAt = useRef<(typeof anchors)[number] | null>(null)
  const frameK = useRef(0)
  /** Pose at the landmark door the rider walks to after auto-parking. */
  const doorPose = useRef<Body | null>(null)
  const park = useRef<{ from: Body; to: Body } | null>(null)
  const orbit = useRef({ yaw: -0.35, pitch: INTRO.pitch })
  const fly = useRef<{ t: number; pos: THREE.Vector3; target: THREE.Vector3 } | null>(null)
  const snap = useRef(false)
  const lastLatLon = useRef(0)
  const bikeGroup = useRef<THREE.Group>(null)
  const avatarGroup = useRef<THREE.Group>(null)
  const camTarget = useRef(new THREE.Vector3())
  const [mode, setMode] = useState<'ride' | 'walk'>('ride')

  const resetCount = useGame((s) => s.resetCount)
  useEffect(() => {
    rider.current = spawn()
    walker.current = spawn()
    speed.current = 0
    walkSpeed.current = 0
    look.current.yaw = 0
    uturn.current = 0
    park.current = null
    doorPose.current = null
    transition.current = 0
    snap.current = true
    setMode('ride')
  }, [resetCount])

  const teleport = useGame((s) => s.teleport)
  useEffect(() => {
    if (!teleport) return
    const a = anchors.find((x) => x.loc.id === teleport.id)
    if (!a) return
    const hit = nearestOnRoute(a.building)
    rider.current = spawn(Math.max(0, hit.s - 9))
    speed.current = 0
    uturn.current = 0
    park.current = null
    doorPose.current = null
    transition.current = 0
    look.current.yaw = 0
    snap.current = true
    setMode('ride')
    const g = useGame.getState()
    g.setPlayer('RIDING')
    g.showToast(`已抵达 ${a.loc.name} · 按 E 停靠`)
  }, [teleport, anchors])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.add(e.code)
      if (e.code === 'KeyE' && !e.repeat) onInteract()
      if ((e.code === 'KeyS' || e.code === 'ArrowDown') && !e.repeat) startUturn()
    }
    const up = (e: KeyboardEvent) => keys.delete(e.code)
    const blur = () => keys.clear()
    const el = gl.domElement
    const pd = () => (look.current.dragging = true)
    const pu = () => (look.current.dragging = false)
    const pm = (e: PointerEvent) => {
      if (!look.current.dragging) return
      if (useGame.getState().phase === 'intro') {
        const o = orbit.current
        o.yaw -= e.movementX * 0.005
        o.pitch = THREE.MathUtils.clamp(o.pitch + e.movementY * 0.003, 0.2, 1.35)
        return
      }
      if (inputLocked()) return
      look.current.lastDrag = performance.now()
      const riding = useGame.getState().player === 'RIDING'
      const k = riding ? 0.5 : 1
      if (riding) look.current.yaw -= e.movementX * 0.005 * k
      else camHead.current.applyAxisAngle(UP, -e.movementX * 0.005)
      look.current.pitch += e.movementY * 0.004 * k
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    el.addEventListener('pointerdown', pd)
    window.addEventListener('pointerup', pu)
    window.addEventListener('pointermove', pm)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      el.removeEventListener('pointerdown', pd)
      window.removeEventListener('pointerup', pu)
      window.removeEventListener('pointermove', pm)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, anchors])

  function nearestParking() {
    const p = rider.current.pos
    let best: (typeof anchors)[number] | undefined
    let bd = PARK_OFFER
    for (const a of anchors) {
      if (!a.loc.parking) continue
      const d = flatDistance(p, a.building)
      if (d < bd) {
        bd = d
        best = a
      }
    }
    return best
  }

  function startUturn() {
    if (inputLocked() || transition.current > 0) return
    if (useGame.getState().player !== 'RIDING' || uturn.current !== 0) return
    uturn.current = Math.PI * (steer.current < -0.1 ? -1 : 1)
  }

  function nearestDoor() {
    return anchors.find((a) => flatDistance(walker.current.pos, a.door) < DOOR_RADIUS)
  }

  function onInteract() {
    const g = useGame.getState()
    if (inputLocked() || transition.current > 0) return
    if (g.player === 'RIDING') {
      const spot = nearestParking()
      if (!spot) {
        g.showToast('靠近建筑时会出现 P 停靠提示')
        return
      }
      g.setPlayer('PARKING')
      transition.current = PARK_S
      uturn.current = 0
      const r = rider.current
      const tan = routeFrame(nearestOnRoute(spot.parking).s).tan
      if (tan.dot(r.fwd) < 0) tan.negate()
      park.current = { from: { pos: r.pos.clone(), fwd: r.fwd.clone() }, to: { pos: spot.parking.clone(), fwd: flatDir(tan) } }
      doorPose.current = { pos: spot.door.clone(), fwd: flatDir(spot.facing.clone().negate()) }
    } else if (g.player === 'WALKING') {
      const door = nearestDoor()
      if (door) {
        g.setPlayer('INTERACTING')
        g.openLocation(door.loc.id)
        return
      }
      if (flatDistance(walker.current.pos, rider.current.pos) < BIKE_RADIUS) {
        g.setPlayer('MOUNTING')
        transition.current = TRANSITION_S
      }
    }
  }

  function collide(b: Body) {
    for (const c of colliders) {
      const d = flatDistance(b.pos, c.at)
      if (d < c.r) {
        const away = flatDir(b.pos.clone().sub(c.at))
        if (away.lengthSq() < 1e-12) away.copy(b.fwd).negate()
        b.pos.addScaledVector(away, c.r - d)
      }
    }

  }

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const g = useGame.getState()
    const locked = inputLocked()
    const fwdKey = !locked && (keys.has('KeyW') || keys.has('ArrowUp'))
    const backKey = !locked && (keys.has('KeyS') || keys.has('ArrowDown'))
    const left = !locked && (keys.has('KeyA') || keys.has('ArrowLeft'))
    const right = !locked && (keys.has('KeyD') || keys.has('ArrowRight'))
    const turn = (left ? 1 : 0) - (right ? 1 : 0)

    if (transition.current > 0) {
      transition.current -= Math.min(rawDt, 0.25)
      const pk = park.current
      if (g.player === 'PARKING' && pk) {
        const t = ease(1 - Math.max(0, transition.current) / PARK_S)
        const fdt = Math.min(rawDt, 0.25)
        const r = rider.current
        const prev = r.pos.clone()
        r.pos.lerpVectors(pk.from.pos, pk.to.pos, t)
        r.fwd.lerpVectors(pk.from.fwd, pk.to.fwd, t).setY(0)
        if (r.fwd.lengthSq() < 1e-6) r.fwd.copy(pk.to.fwd)
        r.fwd.normalize()
        speed.current = (flatDistance(prev, r.pos) / Math.max(fdt, 1e-3)) * 0.8
        crank.current += ((speed.current * fdt) / 0.34) * 0.45
      } else speed.current = THREE.MathUtils.damp(speed.current, 0, 10, dt)
      walkSpeed.current = 0
      if (transition.current <= 0) {
        transition.current = 0
        if (g.player === 'PARKING') {
          park.current = null
          speed.current = 0
          g.setPlayer('DISMOUNTING')
          transition.current = TRANSITION_S
        } else if (g.player === 'DISMOUNTING' && doorPose.current) {
          const d = doorPose.current
          walker.current = { pos: d.pos.clone(), fwd: d.fwd.clone() }
          camHead.current.copy(d.fwd)
          doorPose.current = null
          speed.current = 0
          setMode('walk')
          g.setPlayer('WALKING')
        } else if (g.player === 'DISMOUNTING') {
          camHead.current.copy(rider.current.fwd)
          const side = new THREE.Vector3().crossVectors(UP, rider.current.fwd).normalize()
          walker.current = { pos: rider.current.pos.clone().addScaledVector(side, 0.9), fwd: rider.current.fwd.clone() }
          speed.current = 0
          setMode('walk')
          g.setPlayer('WALKING')
        } else if (g.player === 'MOUNTING') {
          look.current.yaw = 0
          setMode('ride')
          g.setPlayer('RIDING')
        }
      }
    }

    const player = useGame.getState().player
    if (player === 'RIDING') {
      const spot = nearestParking()
      const turning = uturn.current !== 0
      // a tap on S swings the bike round 180°; holding it afterwards brakes
      const max = spot ? RIDE_MAX * 0.75 : RIDE_MAX
      const target = turning ? Math.min(Math.max(speed.current, 0), 1.6) : fwdKey ? max : 0
      const rate = turning ? 5 : backKey ? 6 : fwdKey ? 2.4 : 1.4
      speed.current = THREE.MathUtils.damp(speed.current, target, rate, dt)
      crank.current += ((speed.current * dt) / 0.34) * 0.45
      let yaw: number
      if (turning) {
        const step = Math.sign(uturn.current) * Math.min(Math.abs(uturn.current), UTURN_RATE * dt)
        uturn.current -= step
        if (Math.abs(uturn.current) < 1e-4) uturn.current = 0
        yaw = step
        steer.current = THREE.MathUtils.damp(steer.current, Math.sign(step), 10, dt)
      } else {
        // progressive steering: builds up while held, springs back; gentler at speed
        steer.current = THREE.MathUtils.damp(steer.current, turn, turn !== 0 ? 5 : 9, dt)
        const turnRate = THREE.MathUtils.lerp(2.4, 1.6, Math.min(1, Math.abs(speed.current) / RIDE_MAX))
        yaw = steer.current * dt * turnRate
      }
      const prev = rider.current.pos.clone()
      advance(rider.current, speed.current * dt, yaw)
      collide(rider.current)
      if (!walkable(rider.current.pos)) {
        rider.current.pos.copy(prev)
        speed.current *= 0.3
      }
      g.setPrompt(spot && !locked ? { key: 'E', label: `E · P 停靠 — ${spot.loc.name}` } : null)
    } else if (player === 'WALKING') {
      // camera-relative WASD: W walks into the screen, A/D strafe, S steps back
      const mz = (fwdKey ? 1 : 0) - (backKey ? 1 : 0)
      const mx = (left ? 1 : 0) - (right ? 1 : 0)
      const moving = mz !== 0 || mx !== 0
      walkSpeed.current = THREE.MathUtils.damp(walkSpeed.current, moving ? WALK_MAX : 0, 8, dt)
      if (moving) {
        _cf.copy(flatDir(camHead.current))
        if (_cf.lengthSq() < 1e-8) _cf.copy(walker.current.fwd)
        _cr.crossVectors(_cf, UP)
        _mv.copy(_cf).multiplyScalar(mz).addScaledVector(_cr, -mx).normalize()
        _sd.crossVectors(UP, walker.current.fwd)
        const yaw = Math.atan2(_mv.dot(_sd), _mv.dot(walker.current.fwd))
        walker.current.fwd.applyAxisAngle(UP, THREE.MathUtils.clamp(yaw, -11 * dt, 11 * dt))
      }
      const prevW = walker.current.pos.clone()
      advance(walker.current, walkSpeed.current * dt, 0)
      collide(walker.current)
      if (!walkable(walker.current.pos)) walker.current.pos.copy(prevW)
      const door = nearestDoor()
      if (door) g.setPrompt({ key: 'E', label: `E · ${door.loc.action} — ${door.loc.name}` })
      else if (flatDistance(walker.current.pos, rider.current.pos) < BIKE_RADIUS) g.setPrompt({ key: 'E', label: 'E · RIDE' })
      else g.setPrompt(null)
    } else {
      g.setPrompt(null)
    }

    // place bike + avatar
    const r = rider.current
    if (bikeGroup.current) {
      bikeGroup.current.position.copy(surf(r.pos))
      const lean = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        -steer.current * Math.min(1, Math.abs(speed.current) / RIDE_MAX) * 0.28,
      )
      bikeGroup.current.quaternion.copy(yawQuaternion(r.fwd)).multiply(lean)
    }
    const w = mode === 'walk' ? walker.current : r
    if (avatarGroup.current) {
      avatarGroup.current.position.copy(surf(w.pos))
      avatarGroup.current.quaternion.copy(yawQuaternion(w.fwd))
    }

    // camera: riding = small look-around around the heading; walking = free orbit that auto-returns behind
    // while auto-parking, frame the door the avatar is about to stand at
    const dp = (player === 'PARKING' || player === 'DISMOUNTING') && doorPose.current
    const cb = dp || w
    const riding = mode === 'ride' && !dp
    const cfg = riding ? CAMERA.riding : CAMERA.walking
    const lk = look.current
    if (riding) {
      lk.yaw = THREE.MathUtils.clamp(lk.yaw, -cfg.maxYaw, cfg.maxYaw)
      lk.pitch = THREE.MathUtils.clamp(lk.pitch, cfg.pitch - cfg.maxPitch, cfg.pitch + cfg.maxPitch)
    } else {
      lk.pitch = THREE.MathUtils.clamp(lk.pitch, 0.05, 1.1)
    }
    const idle = performance.now() - lk.lastDrag > CAMERA.recenterDelay * 1000
    const ch = camHead.current
    if (dp) ch.copy(dp.fwd)
    ch.setY(0)
    if (ch.lengthSq() < 1e-8) ch.copy(cb.fwd)
    ch.normalize()
    if (riding) {
      if (!lk.dragging) {
        lk.yaw = THREE.MathUtils.damp(lk.yaw, 0, 3, dt)
        lk.pitch = THREE.MathUtils.damp(lk.pitch, cfg.pitch, 3, dt)
      }
    } else if (!lk.dragging && idle) {
      // walking: the camera heading drifts behind the avatar only while walking forward-ish
      const walkingOn = fwdKey && walkSpeed.current > 0.3
      if (walkingOn) {
        _sd.crossVectors(UP, ch)
        const a = Math.atan2(cb.fwd.dot(_sd), cb.fwd.dot(ch))
        ch.applyAxisAngle(UP, a * (1 - Math.exp(-1.6 * dt))).normalize()
      }
      lk.pitch = THREE.MathUtils.damp(lk.pitch, cfg.pitch, 1.5, dt)
    }
    // near an entrance on foot (or while parking), pull back to show the whole building front-on
    const fa = riding ? undefined : anchors.find((a) => flatDistance(a.door, cb.pos) < FRAME_RANGE)
    if (fa) frameAt.current = fa
    frameK.current = THREE.MathUtils.damp(frameK.current, fa ? 1 : 0, 2.2, dt)
    const fk = frameK.current
    const focus = surf(cb.pos, cfg.focusHeight)
    const dirBack = riding ? cb.fwd.clone().applyAxisAngle(UP, lk.yaw) : ch.clone()
    let dist: number = cfg.distance
    let pitch = lk.pitch
    const fr = frameAt.current
    if (fr && fk > 0.001) {
      const k = modelScale(fr.loc.id)
      focus.lerp(surf(fr.building, 2.2 * k), fk)
      dirBack.lerp(fr.facing.clone().negate(), fk).normalize()
      dist = THREE.MathUtils.lerp(dist, Math.max(10 * k, (LANDMARK_FIT[fr.loc.id]?.halfWidth ?? 4) * k * 1.3), fk)
      pitch = THREE.MathUtils.lerp(pitch, 0.26, fk)
    }
    const desired = new THREE.Vector3()
    for (let i = 0; i < 6; i++) {
      desired
        .copy(focus)
        .addScaledVector(dirBack, -Math.cos(pitch) * dist)
        .addScaledVector(UP, Math.sin(pitch) * dist)
      const blocked = colliders.some((c) => flatDistance(desired, c.at) < c.r + 0.4 && desired.y - groundHeight(c.at) < 10)
      if (!blocked || fk > 0.5) break
      dist *= 0.75
    }
    desired.y = Math.max(desired.y, groundHeight(desired) + 1.2)
    const phase = g.phase
    if (phase === 'intro') {
      const o = orbit.current
      if (!lk.dragging) o.yaw += dt * 0.05
      const center = surf(planPoint(INTRO.x, INTRO.y))
      const back = NORTH.clone().negate().applyAxisAngle(UP, o.yaw)
      camera.position
        .copy(center)
        .addScaledVector(back, Math.cos(o.pitch) * INTRO.dist)
        .addScaledVector(UP, Math.sin(o.pitch) * INTRO.dist)
      camera.up.copy(UP)
      const aim = center.clone().addScaledVector(back, INTRO.aimAhead)
      camera.lookAt(aim)
      camTarget.current.copy(aim)
      fly.current = null
    } else if (phase === 'flying') {
      if (!fly.current) fly.current = { t: 0, pos: camera.position.clone(), target: camTarget.current.clone() }
      const f = fly.current
      f.t = Math.min(1, f.t + Math.min(rawDt, 0.25) / FLY_S)
      const e = ease(f.t)
      camera.position.lerpVectors(f.pos, desired, e)
      camTarget.current.copy(f.target).lerp(focus, ease(Math.min(1, f.t * 1.3)))
      camera.up.copy(UP)
      camera.lookAt(camTarget.current)
      if (f.t >= 1) g.setPhase('play')
    } else {
      if (snap.current) {
        camera.position.copy(desired)
        camTarget.current.copy(focus)
        camera.up.copy(UP)
        snap.current = false
      }
      camera.position.lerp(desired, 1 - Math.exp(-cfg.follow * dt))
      camTarget.current.lerp(focus, 1 - Math.exp(-cfg.follow * 1.5 * dt))
      camera.up.copy(UP)
      camera.lookAt(camTarget.current)
    }
    camFocus.copy(camTarget.current)
    playerPos.copy(w.pos)

    const now = performance.now()
    if (now - lastLatLon.current > 200) {
      lastLatLon.current = now
      g.setPlan(pointToPlan(w.pos))
    }
  })

  return (
    <>
      <group ref={bikeGroup}>
        <Bike speed={speed} steer={steer} crank={crank} kickstand={mode === 'walk'} />
        <BikeLamp on={mode === 'ride'} />
        {mode === 'ride' && <Avatar pose="ride" speed={speed} crank={crank} steer={steer} />}
      </group>
      <HeadlightPool rider={rider} on={mode === 'ride'} />
      <group ref={avatarGroup} visible={mode === 'walk'}>
        {mode === 'walk' && <Avatar pose="walk" speed={walkSpeed} />}
      </group>
    </>
  )
}

const LAMP_AT = new THREE.Vector3(0, 0.9, 0.6)
const FLAT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)
/** Walking within this distance of a door frames the whole building. */
const FRAME_RANGE = 7
const BEAM_LEN = 11
const BEAM_TILT = 0.12

/** Open cone with its apex at the origin, opening toward +z. */
const beamGeo = (() => {
  const g = new THREE.ConeGeometry(1.7, BEAM_LEN, 32, 1, true)
  g.rotateX(-Math.PI / 2)
  g.translate(0, 0, BEAM_LEN / 2)
  return g
})()

/** Volumetric-looking light cone: brightest at the lamp and along the axis, fading toward the rim and the far end. */
function beamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { k: { value: 0 }, color: { value: new THREE.Color('#ffe7b0') } },
    vertexShader: /* glsl */ `
      varying float vT;
      varying float vFacing;
      void main() {
        vT = uv.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vFacing = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float k;
      uniform vec3 color;
      varying float vT;
      varying float vFacing;
      void main() {
        float along = pow(vT, 1.6);
        float core = pow(vFacing, 2.0);
        gl_FragColor = vec4(color * k * 0.5 * along * core, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  })
}

/** Smooth elliptical light spot (no brush texture) for where the beam meets the road. */
let spotTex: THREE.CanvasTexture | null = null
function spotMaterial() {
  if (!spotTex) {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    r.addColorStop(0, 'rgba(255,255,255,1)')
    r.addColorStop(0.45, 'rgba(255,255,255,0.55)')
    r.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = r
    g.fillRect(0, 0, 128, 128)
    spotTex = new THREE.CanvasTexture(c)
  }
  return new THREE.MeshBasicMaterial({
    map: spotTex,
    color: '#ffe3a6',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  })
}

/** Bike headlamp: bright lens, a geometric light cone and, above low quality, a real spot light down the road. */
function BikeLamp({ on }: { on: boolean }) {
  const real = useQualityLevel() !== 'low'
  const beam = useMemo(beamMaterial, [])
  const lens = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fff4d6', toneMapped: false }), [])
  const group = useRef<THREE.Group>(null)
  const spot = useRef<THREE.SpotLight>(null)
  const target = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.set(0, 0, 9)
    return o
  }, [])
  useFrame(() => {
    const k = on ? dusk.k : 0
    beam.uniforms.k.value = k
    if (group.current) group.current.visible = k > 0.01
    if (spot.current) spot.current.intensity = k * 36
  })
  return (
    <group ref={group} position={LAMP_AT}>
      <mesh material={lens}>
        <sphereGeometry args={[0.07, 10, 8]} />
      </mesh>
      <mesh geometry={beamGeo} material={beam} rotation={[BEAM_TILT, 0, 0]} />
      <group rotation={[BEAM_TILT, 0, 0]}>
        <primitive object={target} />
      </group>
      {real && <spotLight ref={spot} target={target} color="#ffe2a8" angle={0.42} penumbra={0.5} distance={20} decay={1.2} intensity={0} />}
    </group>
  )
}

/** Light spot on the road where the headlamp beam lands, following the ground. */
function HeadlightPool({ rider, on }: { rider: { current: Body }; on: boolean }) {
  const mat = useMemo(spotMaterial, [])
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const k = on ? dusk.k : 0
    mat.opacity = k * 0.55
    mat.visible = k > 0.01
    const m = ref.current
    if (k <= 0.01 || !m) return
    const r = rider.current
    m.position.copy(surf(r.pos.clone().addScaledVector(r.fwd, 7.2), 0.05))
    m.quaternion.copy(yawQuaternion(r.fwd).multiply(FLAT))
  })
  return (
    <mesh ref={ref} material={mat} scale={[3.6, 7.5, 1]}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  )
}
