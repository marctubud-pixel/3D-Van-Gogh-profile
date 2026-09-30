import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { WorldLocation } from '../../shared/types'
import { inputLocked, useGame } from '../app/game'
import { Bike } from '../bike/Bike'
import { CAMERA } from '../camera/config'
import {
  BUILDING_RADIUS,
  R,
  arcDistance,
  dirFromLatLon,
  latLonFromDir,
  locationAnchors,
  surfaceQuaternion,
  tangentNorth,
} from '../world/sphere'
import { camFocus, playerUp } from '../world/occlusion'
import { LOT_RADIUS, townLots } from '../world/townLayout'
import { Avatar } from './Avatar'

const RIDE_MAX = 6
const WALK_MAX = 2.2
const SLOW_ZONE = 6
const PARK_RADIUS = 2.4
const DOOR_RADIUS = 2.4
const BIKE_RADIUS = 1.8
const TRANSITION_S = 0.55
const SEA_LIMIT_LAT = -35

const keys = new Set<string>()

const _cf = new THREE.Vector3()
const _cr = new THREE.Vector3()
const _mv = new THREE.Vector3()
const _sd = new THREE.Vector3()

interface Body {
  up: THREE.Vector3
  fwd: THREE.Vector3
}

function spawn(): Body {
  const up = dirFromLatLon(0, -3)
  return { up, fwd: new THREE.Vector3(1, 0, 0).projectOnPlane(up).normalize() }
}

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
  const anchors = useMemo(() => locations.map((l) => ({ loc: l, ...locationAnchors(l.lat, l.lon) })), [locations])
  const colliders = useMemo(
    () => [
      ...anchors.map((a) => ({ at: a.building, r: BUILDING_RADIUS })),
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
  const noParkHinted = useRef(false)
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
    setMode('ride')
  }, [resetCount])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.add(e.code)
      if (e.code === 'KeyE' && !e.repeat) onInteract()
    }
    const up = (e: KeyboardEvent) => keys.delete(e.code)
    const blur = () => keys.clear()
    const el = gl.domElement
    const pd = () => (look.current.dragging = true)
    const pu = () => (look.current.dragging = false)
    const pm = (e: PointerEvent) => {
      if (!look.current.dragging || inputLocked()) return
      look.current.lastDrag = performance.now()
      const riding = useGame.getState().player === 'RIDING'
      const k = riding ? 0.5 : 1
      look.current.yaw -= e.movementX * 0.005 * k
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
    return anchors.filter((a) => a.loc.parking).find((a) => arcDistance(p, a.parking) < PARK_RADIUS)
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
        g.showToast('Find a bike parking spot to dismount.')
        noParkHinted.current = true
        return
      }
      g.setPlayer('PARKING')
      transition.current = TRANSITION_S
      const r = rider.current
      r.up.copy(spot.parking)
      r.fwd.copy(spot.facing).projectOnPlane(r.up).normalize()
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
    const [lat] = latLonFromDir(b.up)
    if (lat < SEA_LIMIT_LAT) {
      const north = tangentNorth(b.up)
      const axis = new THREE.Vector3().crossVectors(b.up, north).normalize()
      b.up.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, THREE.MathUtils.degToRad(SEA_LIMIT_LAT - lat))).normalize()
      b.fwd.projectOnPlane(b.up).normalize()
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
      transition.current -= dt
      speed.current = THREE.MathUtils.damp(speed.current, 0, 10, dt)
      walkSpeed.current = 0
      if (transition.current <= 0) {
        transition.current = 0
        if (g.player === 'PARKING') {
          g.setPlayer('DISMOUNTING')
          transition.current = TRANSITION_S
        } else if (g.player === 'DISMOUNTING') {
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
          setMode('ride')
          g.setPlayer('RIDING')
        }
      }
    }

    const player = useGame.getState().player
    const nearParking = anchors.filter((a) => a.loc.parking).map((a) => arcDistance(rider.current.up, a.parking))
    const inSlowZone = nearParking.some((d) => d < SLOW_ZONE)

    if (player === 'RIDING') {
      // S backs up once (nearly) stopped; while rolling forward it brakes hard
      const max = inSlowZone ? RIDE_MAX * 0.6 : RIDE_MAX
      const target = fwdKey ? max : backKey ? (speed.current > 0.15 ? 0 : -1.4) : 0
      const rate = backKey && speed.current > 0 ? 6 : fwdKey ? 2.4 : backKey ? 2.2 : 1.4
      speed.current = THREE.MathUtils.damp(speed.current, target, rate, dt)
      crank.current += ((speed.current * dt) / 0.34) * 0.45
      // progressive steering: builds up while held, springs back; gentler at speed
      steer.current = THREE.MathUtils.damp(steer.current, turn, turn !== 0 ? 5 : 9, dt)
      const turnRate = THREE.MathUtils.lerp(2.4, 1.6, Math.min(1, Math.abs(speed.current) / RIDE_MAX))
      const yaw = steer.current * dt * turnRate * Math.sign(speed.current || 1)
      advance(rider.current, speed.current * dt, yaw)
      collide(rider.current)
      const spot = nearestParking()
      g.setPrompt(spot ? { key: 'E', label: `BIKE PARKING · E · PARK — ${spot.loc.name}` } : null)
    } else if (player === 'WALKING') {
      // camera-relative WASD: W walks into the screen, A/D strafe, S steps back
      const mz = (fwdKey ? 1 : 0) - (backKey ? 1 : 0)
      const mx = (left ? 1 : 0) - (right ? 1 : 0)
      const moving = mz !== 0 || mx !== 0
      walkSpeed.current = THREE.MathUtils.damp(walkSpeed.current, moving ? WALK_MAX : 0, 8, dt)
      if (moving) {
        _cf.copy(camTarget.current).sub(camera.position).projectOnPlane(walker.current.up)
        if (_cf.lengthSq() < 1e-8) _cf.copy(walker.current.fwd)
        else _cf.normalize()
        _cr.crossVectors(_cf, walker.current.up)
        _mv.copy(_cf).multiplyScalar(mz).addScaledVector(_cr, -mx).normalize()
        _sd.crossVectors(walker.current.up, walker.current.fwd)
        const yaw = Math.atan2(_mv.dot(_sd), _mv.dot(walker.current.fwd))
        walker.current.fwd.applyAxisAngle(walker.current.up, THREE.MathUtils.clamp(yaw, -7 * dt, 7 * dt))
        walker.current.fwd.projectOnPlane(walker.current.up).normalize()
      }
      advance(walker.current, walkSpeed.current * dt, 0)
      collide(walker.current)
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
      bikeGroup.current.position.copy(r.up).multiplyScalar(R)
      const lean = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        -steer.current * Math.min(1, Math.abs(speed.current) / RIDE_MAX) * 0.28,
      )
      bikeGroup.current.quaternion.copy(surfaceQuaternion(r.up, r.fwd)).multiply(lean)
    }
    const w = mode === 'walk' ? walker.current : r
    if (avatarGroup.current) {
      avatarGroup.current.position.copy(w.up).multiplyScalar(R)
      avatarGroup.current.quaternion.copy(surfaceQuaternion(w.up, w.fwd))
    }

    // camera: riding = small look-around around the heading; walking = free orbit that auto-returns behind
    const riding = mode === 'ride'
    const cfg = riding ? CAMERA.riding : CAMERA.walking
    const lk = look.current
    if (riding) {
      lk.yaw = THREE.MathUtils.clamp(lk.yaw, -cfg.maxYaw, cfg.maxYaw)
      lk.pitch = THREE.MathUtils.clamp(lk.pitch, cfg.pitch - cfg.maxPitch, cfg.pitch + cfg.maxPitch)
    } else {
      lk.pitch = THREE.MathUtils.clamp(lk.pitch, 0.05, 1.1)
    }
    const idle = performance.now() - lk.lastDrag > CAMERA.recenterDelay * 1000
    // walking: auto-follow while walking forward (or after idle); strafing leaves the orbit free
    const moving = riding ? Math.abs(speed.current) > 0.3 : fwdKey && Math.abs(walkSpeed.current) > 0.3
    if (!lk.dragging && (riding || idle || moving)) {
      const rate = riding ? 3 : moving ? 2.2 : 1.2
      lk.yaw = THREE.MathUtils.damp(lk.yaw, 0, rate, dt)
      lk.pitch = THREE.MathUtils.damp(lk.pitch, cfg.pitch, rate, dt)
    }
    const focus = w.up.clone().multiplyScalar(R + cfg.focusHeight)
    const dirBack = w.fwd.clone().applyAxisAngle(w.up, lk.yaw)
    let dist = cfg.distance
    const desired = new THREE.Vector3()
    for (let i = 0; i < 6; i++) {
      desired
        .copy(focus)
        .addScaledVector(dirBack, -Math.cos(lk.pitch) * dist)
        .addScaledVector(w.up, Math.sin(lk.pitch) * dist)
      const blocked = colliders.some((c) => arcDistance(desired, c.at) < c.r + 0.4)
      if (!blocked) break
      dist *= 0.75
    }
    camera.position.lerp(desired, 1 - Math.exp(-cfg.follow * dt))
    camTarget.current.lerp(focus, 1 - Math.exp(-cfg.follow * 1.5 * dt))
    camera.up.lerp(w.up, 0.1).normalize()
    camera.lookAt(camTarget.current)
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
