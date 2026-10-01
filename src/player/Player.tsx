import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { WorldLocation } from '../../shared/types'
import { inputLocked, useGame } from '../app/game'
import { Bike } from '../bike/Bike'
import { CAMERA } from '../camera/config'
import { BUILDING_RADIUS, SERVICE_CENTER, R, arcDistance, dirFromLatLon, latLonFromDir, slerpDir, surfaceQuaternion } from '../world/sphere'
import { TITLE_CENTER, landmarkColliders, locationAnchors, nearestOnRoute, routeFrame, surf, walkable } from '../world/island'
import { camFocus, playerUp } from '../world/occlusion'
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
const INTRO_DIST = 118
const FLY_S = 2.8

const keys = new Set<string>()

const _cf = new THREE.Vector3()
const _cr = new THREE.Vector3()
const _mv = new THREE.Vector3()
const _sd = new THREE.Vector3()

interface Body {
  up: THREE.Vector3
  fwd: THREE.Vector3
}

function spawn(s = 3): Body {
  const f = routeFrame(s)
  return { up: f.up, fwd: f.tan }
}

const ease = (t: number) => t * t * (3 - 2 * t)

/** Advance a body along the sphere surface by `dist` world units and yaw it by `yaw` radians. */
function advance(b: Body, dist: number, yaw: number) {
  if (yaw) b.fwd.applyAxisAngle(b.up, yaw)
  if (dist) {
    const axis = new THREE.Vector3().crossVectors(b.up, b.fwd).normalize()
    const q = new THREE.Quaternion().setFromAxisAngle(axis, dist / R)
    b.up.applyQuaternion(q).normalize()
    b.fwd.applyQuaternion(q)
  }
  b.fwd.projectOnPlane(b.up).normalize()
}

export function Player({ locations }: { locations: WorldLocation[] }) {
  const { camera, gl } = useThree()
  const anchors = useMemo(() => locations.map((l) => ({ loc: l, ...locationAnchors(l.lat, l.lon, l.id) })), [locations])
  const colliders = useMemo(
    () => [
      ...anchors.flatMap((a) => landmarkColliders(a, a.loc.id)),
      { at: locationAnchors(SERVICE_CENTER.lat, SERVICE_CENTER.lon).building, r: SERVICE_CENTER.radius },
      ...townLots(locations)
        .filter((l) => l.kind !== 'garden')
        .map((l) => ({ at: l.up, r: LOT_RADIUS })),
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
  const orbit = useRef({ lat: TITLE_CENTER.lat + 22, lon: TITLE_CENTER.lon - 8 })
  const fly = useRef<{ t: number; pos: THREE.Vector3; up: THREE.Vector3 } | null>(null)
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
        o.lon -= e.movementX * 0.25
        o.lat = THREE.MathUtils.clamp(o.lat + e.movementY * 0.2, -70, 70)
        return
      }
      if (inputLocked()) return
      look.current.lastDrag = performance.now()
      const riding = useGame.getState().player === 'RIDING'
      const k = riding ? 0.5 : 1
      if (riding) look.current.yaw -= e.movementX * 0.005 * k
      else camHead.current.applyAxisAngle(walker.current.up, -e.movementX * 0.005)
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
    const p = rider.current.up
    let best: (typeof anchors)[number] | undefined
    let bd = PARK_OFFER
    for (const a of anchors) {
      if (!a.loc.parking) continue
      const d = arcDistance(p, a.building)
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
    return anchors.find((a) => arcDistance(walker.current.up, a.door) < DOOR_RADIUS)
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
      const toFwd = tan.projectOnPlane(spot.parking).normalize()
      park.current = { from: { up: r.up.clone(), fwd: r.fwd.clone() }, to: { up: spot.parking.clone(), fwd: toFwd } }
      doorPose.current = { up: spot.door.clone(), fwd: spot.facing.clone().negate().projectOnPlane(spot.door).normalize() }
    } else if (g.player === 'WALKING') {
      const door = nearestDoor()
      if (door) {
        g.setPlayer('INTERACTING')
        g.openLocation(door.loc.id)
        return
      }
      if (arcDistance(walker.current.up, rider.current.up) < BIKE_RADIUS) {
        g.setPlayer('MOUNTING')
        transition.current = TRANSITION_S
      }
    }
  }

  function collide(b: Body) {
    for (const c of colliders) {
      const d = arcDistance(b.up, c.at)
      if (d < c.r) {
        const away = b.up.clone().sub(c.at).projectOnPlane(b.up).normalize()
        const axis = new THREE.Vector3().crossVectors(b.up, away).normalize()
        b.up.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, (c.r - d) / R)).normalize()
        b.fwd.projectOnPlane(b.up).normalize()
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
        const prev = r.up.clone()
        r.up.copy(slerpDir(pk.from.up, pk.to.up, t))
        r.fwd.copy(pk.from.fwd).lerp(pk.to.fwd, t).projectOnPlane(r.up)
        if (r.fwd.lengthSq() < 1e-6) r.fwd.copy(pk.to.fwd)
        r.fwd.normalize()
        speed.current = (arcDistance(prev, r.up) / Math.max(fdt, 1e-3)) * 0.8
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
          walker.current = { up: d.up.clone(), fwd: d.fwd.clone() }
          camHead.current.copy(d.fwd)
          doorPose.current = null
          speed.current = 0
          setMode('walk')
          g.setPlayer('WALKING')
        } else if (g.player === 'DISMOUNTING') {
          camHead.current.copy(rider.current.fwd)
          const side = new THREE.Vector3().crossVectors(rider.current.up, rider.current.fwd).normalize()
          walker.current = { up: rider.current.up.clone(), fwd: rider.current.fwd.clone() }
          advance(walker.current, 0, 0)
          const axis = new THREE.Vector3().crossVectors(walker.current.up, side).normalize()
          walker.current.up.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, 0.9 / R)).normalize()
          walker.current.fwd.projectOnPlane(walker.current.up).normalize()
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
      const prev = rider.current.up.clone()
      advance(rider.current, speed.current * dt, yaw)
      collide(rider.current)
      if (!walkable(rider.current.up)) {
        rider.current.up.copy(prev)
        rider.current.fwd.projectOnPlane(prev).normalize()
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
        _cf.copy(camHead.current).projectOnPlane(walker.current.up)
        if (_cf.lengthSq() < 1e-8) _cf.copy(walker.current.fwd)
        else _cf.normalize()
        _cr.crossVectors(_cf, walker.current.up)
        _mv.copy(_cf).multiplyScalar(mz).addScaledVector(_cr, -mx).normalize()
        _sd.crossVectors(walker.current.up, walker.current.fwd)
        const yaw = Math.atan2(_mv.dot(_sd), _mv.dot(walker.current.fwd))
        walker.current.fwd.applyAxisAngle(walker.current.up, THREE.MathUtils.clamp(yaw, -11 * dt, 11 * dt))
        walker.current.fwd.projectOnPlane(walker.current.up).normalize()
      }
      const prevW = walker.current.up.clone()
      advance(walker.current, walkSpeed.current * dt, 0)
      collide(walker.current)
      if (!walkable(walker.current.up)) {
        walker.current.up.copy(prevW)
        walker.current.fwd.projectOnPlane(prevW).normalize()
      }
      const door = nearestDoor()
      if (door) g.setPrompt({ key: 'E', label: `E · ${door.loc.action} — ${door.loc.name}` })
      else if (arcDistance(walker.current.up, rider.current.up) < BIKE_RADIUS) g.setPrompt({ key: 'E', label: 'E · RIDE' })
      else g.setPrompt(null)
    } else {
      g.setPrompt(null)
    }

    // place bike + avatar
    const r = rider.current
    if (bikeGroup.current) {
      bikeGroup.current.position.copy(surf(r.up))
      const lean = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        -steer.current * Math.min(1, Math.abs(speed.current) / RIDE_MAX) * 0.28,
      )
      bikeGroup.current.quaternion.copy(surfaceQuaternion(r.up, r.fwd)).multiply(lean)
    }
    const w = mode === 'walk' ? walker.current : r
    if (avatarGroup.current) {
      avatarGroup.current.position.copy(surf(w.up))
      avatarGroup.current.quaternion.copy(surfaceQuaternion(w.up, w.fwd))
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
    ch.projectOnPlane(cb.up)
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
        _sd.crossVectors(cb.up, ch)
        const a = Math.atan2(cb.fwd.dot(_sd), cb.fwd.dot(ch))
        ch.applyAxisAngle(cb.up, a * (1 - Math.exp(-1.6 * dt))).normalize()
      }
      lk.pitch = THREE.MathUtils.damp(lk.pitch, cfg.pitch, 1.5, dt)
    }
    const focus = surf(cb.up, cfg.focusHeight)
    const dirBack = riding ? cb.fwd.clone().applyAxisAngle(cb.up, lk.yaw) : ch.clone()
    let dist = cfg.distance
    const desired = new THREE.Vector3()
    for (let i = 0; i < 6; i++) {
      desired
        .copy(focus)
        .addScaledVector(dirBack, -Math.cos(lk.pitch) * dist)
        .addScaledVector(cb.up, Math.sin(lk.pitch) * dist)
      const blocked = colliders.some((c) => arcDistance(desired, c.at) < c.r + 0.4 && desired.length() < R + 10)
      if (!blocked) break
      dist *= 0.75
    }
    const phase = g.phase
    if (phase === 'intro') {
      const o = orbit.current
      if (!lk.dragging) o.lon += dt * 3
      camera.position.copy(dirFromLatLon(o.lat, o.lon).multiplyScalar(INTRO_DIST))
      camera.up.set(0, 1, 0)
      camera.lookAt(0, 0, 0)
      camTarget.current.set(0, 0, 0)
      fly.current = null
    } else if (phase === 'flying') {
      if (!fly.current) fly.current = { t: 0, pos: camera.position.clone(), up: camera.up.clone() }
      const f = fly.current
      f.t = Math.min(1, f.t + dt / FLY_S)
      const e = ease(f.t)
      const dir = slerpDir(f.pos, desired, e)
      camera.position.copy(dir.multiplyScalar(THREE.MathUtils.lerp(f.pos.length(), desired.length(), e)))
      camTarget.current.set(0, 0, 0).lerp(focus, ease(Math.min(1, f.t * 1.3)))
      camera.up.copy(f.up).lerp(w.up, e).normalize()
      camera.lookAt(camTarget.current)
      if (f.t >= 1) g.setPhase('play')
    } else {
      if (snap.current) {
        camera.position.copy(desired)
        camTarget.current.copy(focus)
        camera.up.copy(w.up)
        snap.current = false
      }
      camera.position.lerp(desired, 1 - Math.exp(-cfg.follow * dt))
      camTarget.current.lerp(focus, 1 - Math.exp(-cfg.follow * 1.5 * dt))
      camera.up.lerp(w.up, 0.1).normalize()
      camera.lookAt(camTarget.current)
    }
    camFocus.copy(camTarget.current)
    playerUp.copy(w.up)

    const now = performance.now()
    if (now - lastLatLon.current > 200) {
      lastLatLon.current = now
      g.setLatLon(latLonFromDir(w.up))
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
