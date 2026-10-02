import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { WorldLocation } from '../../shared/types'
import { inputLocked, useGame } from '../app/game'
import { Bike } from '../bike/Bike'
import { CAMERA } from '../camera/config'
import { BUILDING_RADIUS, NORTH, SERVICE_CENTER, UP, flatDir, flatDistance, planPoint, pointToPlan, yawQuaternion } from '../world/plane'
import { SERVICE_POINT, groundHeight, landmarkColliders, locationAnchors, locationPoint, nearestOnRoute, routeFrame, surf, walkable } from '../world/island'
import { camFocus, playerPos } from '../world/occlusion'
import { LOT_RADIUS, townLots } from '../world/townLayout'
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
    const focus = surf(cb.pos, cfg.focusHeight)
    const dirBack = riding ? cb.fwd.clone().applyAxisAngle(UP, lk.yaw) : ch.clone()
    let dist = cfg.distance
    const desired = new THREE.Vector3()
    for (let i = 0; i < 6; i++) {
      desired
        .copy(focus)
        .addScaledVector(dirBack, -Math.cos(lk.pitch) * dist)
        .addScaledVector(UP, Math.sin(lk.pitch) * dist)
      const blocked = colliders.some((c) => flatDistance(desired, c.at) < c.r + 0.4 && desired.y - groundHeight(c.at) < 10)
      if (!blocked) break
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
        {mode === 'ride' && <Avatar pose="ride" speed={speed} crank={crank} steer={steer} />}
      </group>
      <group ref={avatarGroup} visible={mode === 'walk'}>
        {mode === 'walk' && <Avatar pose="walk" speed={walkSpeed} />}
      </group>
    </>
  )
}
