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
      ...townLots(locations).map((l) => ({ at: l.up, r: LOT_RADIUS })),
    ],
    [anchors, locations],
  )

  const rider = useRef<Body>(spawn())
  const walker = useRef<Body>(spawn())
  const speed = useRef(0)
  const steer = useRef(0)
  const walkSpeed = useRef(0)
  const transition = useRef(0)
  const look = useRef({ yaw: 0, pitch: 0.2, dragging: false })
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
      look.current.yaw -= e.movementX * 0.005
      look.current.pitch = THREE.MathUtils.clamp(look.current.pitch + e.movementY * 0.004, 0.05, 1.1)
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
      r.fwd.copy(spot.facing).applyAxisAngle(spot.parking, Math.PI / 2).projectOnPlane(r.up).normalize()
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
      const max = inSlowZone ? RIDE_MAX * 0.6 : RIDE_MAX
      const target = fwdKey ? max : backKey ? -0.5 : 0
      const rate = backKey && speed.current > 0 ? 5 : fwdKey ? 2 : 1.4
      speed.current = THREE.MathUtils.damp(speed.current, target, rate, dt)
      steer.current = THREE.MathUtils.damp(steer.current, turn, 6, dt)
      const yaw = steer.current * dt * 1.5 * THREE.MathUtils.clamp(Math.abs(speed.current) / 3 + 0.25, 0.25, 1) * Math.sign(speed.current || 1)
      advance(rider.current, speed.current * dt, yaw)
      collide(rider.current)
      const spot = nearestParking()
      g.setPrompt(spot ? { key: 'E', label: `BIKE PARKING · E · PARK — ${spot.loc.name}` } : null)
    } else if (player === 'WALKING') {
      const target = fwdKey ? WALK_MAX : backKey ? -WALK_MAX * 0.6 : 0
      walkSpeed.current = THREE.MathUtils.damp(walkSpeed.current, target, 8, dt)
      advance(walker.current, walkSpeed.current * dt, turn * dt * 2.4)
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
      const lean = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -steer.current * Math.min(1, Math.abs(speed.current)) * 0.18)
      bikeGroup.current.quaternion.copy(surfaceQuaternion(r.up, r.fwd)).multiply(lean)
    }
    const w = mode === 'walk' ? walker.current : r
    if (avatarGroup.current) {
      avatarGroup.current.position.copy(w.up).multiplyScalar(R)
      avatarGroup.current.quaternion.copy(surfaceQuaternion(w.up, w.fwd))
    }

    // camera
    const riding = mode === 'ride'
    if (!look.current.dragging && riding) look.current.yaw = THREE.MathUtils.damp(look.current.yaw, 0, 2.5, dt)
    if (riding) look.current.yaw = THREE.MathUtils.clamp(look.current.yaw, -1.0, 1.0)
    const cfg = riding ? CAMERA.riding : CAMERA.walking
    const pitch = riding ? cfg.pitch : look.current.pitch
    const back = w.fwd.clone().applyAxisAngle(w.up, look.current.yaw).multiplyScalar(-Math.cos(pitch) * cfg.distance)
    const focus = w.up.clone().multiplyScalar(R + cfg.focusHeight)
    const desired = focus.clone().add(back).add(w.up.clone().multiplyScalar(Math.sin(pitch) * cfg.distance))
    camera.position.lerp(desired, 1 - Math.exp(-cfg.follow * dt))
    camTarget.current.lerp(focus, 1 - Math.exp(-cfg.follow * 1.5 * dt))
    camera.up.lerp(w.up, 0.1).normalize()
    camera.lookAt(camTarget.current)

    const now = performance.now()
    if (now - lastLatLon.current > 200) {
      lastLatLon.current = now
      g.setLatLon(latLonFromDir(w.up))
    }
  })

  return (
    <>
      <group ref={bikeGroup}>
        <Bike speed={speed} steer={steer} kickstand={mode === 'walk'} />
        {mode === 'ride' && <Avatar pose="ride" speed={speed} />}
      </group>
      <group ref={avatarGroup} visible={mode === 'walk'}>
        {mode === 'walk' && <Avatar pose="walk" speed={walkSpeed} />}
      </group>
    </>
  )
}
