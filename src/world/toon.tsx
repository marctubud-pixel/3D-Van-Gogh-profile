import { useMemo } from 'react'
import * as THREE from 'three'
import { BRUSH } from './brush'
import { StrokePartMesh, StrokeRigPart, useStrokeBuild, useStrokeRig, type PaintFn } from './strokes'

export const LINE_COLOR = BRUSH ? '#1f2d5a' : '#2c3437'

let gradient: THREE.DataTexture | null = null
function toonGradient() {
  if (!gradient) {
    const data = new Uint8Array([150, 150, 150, 255, 255, 255, 255, 255])
    gradient = new THREE.DataTexture(data, 2, 1, THREE.RGBAFormat)
    gradient.minFilter = THREE.NearestFilter
    gradient.magFilter = THREE.NearestFilter
    gradient.generateMipmaps = false
    gradient.needsUpdate = true
  }
  return gradient
}

const toonCache = new Map<string, THREE.MeshToonMaterial>()
export function toonMaterial(color: string) {
  let m = toonCache.get(color)
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
    toonCache.set(color, m)
  }
  return m
}

const outlineVertex = /* glsl */ `
uniform float thickness;
uniform float radial;
float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  vec3 dir = radial > 0.5 ? normalize(position + vec3(1e-4)) : normalize(normal);
  float wobble = 0.65 + 0.7 * hash(floor(position * 2.3));
  vec3 p = position + dir * thickness * wobble;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`
const outlineFragment = /* glsl */ `
uniform vec3 color;
void main() { gl_FragColor = vec4(color, 1.0); }
`

const outlineCache = new Map<string, THREE.ShaderMaterial>()
export function outlineMaterial(thickness: number, radial: boolean) {
  const key = `${thickness}:${radial}`
  let m = outlineCache.get(key)
  if (!m) {
    m = new THREE.ShaderMaterial({
      uniforms: {
        thickness: { value: thickness },
        radial: { value: radial ? 1 : 0 },
        color: { value: new THREE.Color(LINE_COLOR) },
      },
      vertexShader: outlineVertex,
      fragmentShader: outlineFragment,
      side: THREE.BackSide,
    })
    outlineCache.set(key, m)
  }
  return m
}

const edgeCache = new WeakMap<THREE.BufferGeometry, THREE.EdgesGeometry>()
function edgesFor(g: THREE.BufferGeometry) {
  let e = edgeCache.get(g)
  if (!e) {
    e = new THREE.EdgesGeometry(g, 35)
    edgeCache.set(g, e)
  }
  return e
}
export const edgeMaterial = new THREE.LineBasicMaterial({ color: LINE_COLOR })

type Vec3 = [number, number, number]

interface ToonProps {
  geometry: THREE.BufferGeometry
  color: string
  position?: Vec3
  rotation?: Vec3
  scale?: Vec3 | number
  outline?: number
  radial?: boolean
  material?: THREE.Material
  edges?: boolean
  /** Per-point colour used when painted inside a <StrokeRig> (replaces `material`). */
  paint?: PaintFn
}

/** A toon-shaded mesh with an inverted-hull, slightly wobbly charcoal outline. */
export function Toon({ geometry, color, position, rotation, scale, outline = 0.06, radial = true, material, edges, paint }: ToonProps) {
  const mat = useMemo(() => material ?? toonMaterial(color), [material, color])
  const hull = outline * (BRUSH ? 0.9 : 0.55)
  const line = useMemo(() => outlineMaterial(hull, radial), [hull, radial])
  const showEdges = edges ?? (outline > 0 && CREASED.has(geometry))
  const stroked = useStrokeBuild() !== null && !material
  const rig = useStrokeRig()
  if (rig) {
    return (
      <group position={position} rotation={rotation}>
        <StrokeRigPart geometry={geometry} color={color} scale={scale} outline={showEdges} paint={paint} />
      </group>
    )
  }
  if (stroked) {
    return (
      <group position={position} rotation={rotation} scale={scale}>
        <StrokePartMesh geometry={geometry} color={color} outline={showEdges} />
      </group>
    )
  }
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={geometry} material={mat} castShadow receiveShadow />
      {outline > 0 && <mesh geometry={geometry} material={line} />}
      {showEdges && <lineSegments geometry={edgesFor(geometry)} material={edgeMaterial} />}
    </group>
  )
}

export const geo = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 20),
  cone: new THREE.ConeGeometry(0.5, 1, 16),
  roof: new THREE.ConeGeometry(0.72, 1, 4),
  sphere: new THREE.SphereGeometry(0.5, 20, 14),
  dome: new THREE.SphereGeometry(0.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
  ico: new THREE.IcosahedronGeometry(0.5, 1),
  wheel: new THREE.TorusGeometry(0.34, 0.045, 8, 28),
  torusRack: new THREE.TorusGeometry(0.4, 0.04, 6, 16, Math.PI),
  octa: new THREE.OctahedronGeometry(0.5, 0),
}

const CREASED = new Set<THREE.BufferGeometry>([geo.box, geo.roof, geo.cyl, geo.cone])
