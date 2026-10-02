import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { STROKE_GLSL } from './brush'
import { type Ramp, type Stroke, Strokes, blob, rng } from './strokes'

const vertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`

const fragment = /* glsl */ `
uniform vec3 up;
${STROKE_GLSL}
uniform float time;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = dot(d, normalize(up));
  vec3 top = vec3(0.39, 0.71, 0.72);
  vec3 horizon = vec3(0.62, 0.86, 0.82);
  vec3 col = mix(horizon, top, smoothstep(-0.05, 0.7, h));
  vec2 sp = vec2(atan(d.z, d.x) * 44.0, h * 56.0);
  vec2 k = dabs(sp, 0.45);
  vec3 lit = mix(col * 1.06 + vec3(0.02, 0.02, 0.0), vec3(0.95, 0.96, 0.86), 0.12);
  vec3 dk = col * vec3(0.9, 0.95, 1.0);
  col = mix(col, k.y > 0.0 ? mix(col, lit, k.y) : mix(col, dk, -k.y), k.x * 0.6);
  gl_FragColor = vec4(col, 1.0);
}
`

/** Painted sky dome laid in visible dabs; follows the camera. */
export function Sky() {
  const ref = useRef<THREE.Mesh>(null)
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { up: { value: new THREE.Vector3(0, 1, 0) }, time: { value: 0 } },
        vertexShader: vertex,
        fragmentShader: fragment,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [],
  )
  useFrame(({ camera, clock }) => {
    ref.current?.position.copy(camera.position)
    mat.uniforms.up.value.copy(camera.up)
    mat.uniforms.time.value = clock.elapsedTime
  })
  return (
    <>
      <mesh ref={ref} material={mat} renderOrder={-1} frustumCulled={false}>
        <sphereGeometry args={[300, 48, 24]} />
      </mesh>
      <Clouds />
    </>
  )
}

const CLOUD: Ramp = { light: ['#fdfbf3', '#ffffff', '#f7f3e6'], mid: ['#eef2ec', '#e4ece9', '#f1efe6'], dark: ['#c3d6d8', '#b6cdd2', '#cddfdd'] }

/** Cumulus clouds ringing the island, each a cluster of flattened brush-dab puffs. */
function cloudStrokes() {
  const r = rng(77)
  const clouds: { at: THREE.Vector3; strokes: Stroke[] }[] = []
  for (let c = 0; c < 14; c++) {
    const a = (c / 14) * Math.PI * 2 + (r() - 0.5) * 0.3
    const R = 160 + r() * 80
    const centre = new THREE.Vector3(Math.cos(a) * R, 26 + r() * 26, Math.sin(a) * R)
    const along = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a))
    const size = 9 + r() * 6
    const puffs = 4 + Math.floor(r() * 4)
    const out: Stroke[] = []
    for (let k = 0; k < puffs; k++) {
      const t = k / (puffs - 1) - 0.5
      const br = size * (1 - Math.abs(t) * 0.9) * (0.7 + r() * 0.4)
      const pc = centre.clone().addScaledVector(along, t * size * 3.2).add(new THREE.Vector3(0, br * 0.35 - Math.abs(t) * size * 0.3, (r() - 0.5) * size))
      const start = out.length
      blob(out, r, pc, br, CLOUD, 12, br * 0.6)
      for (let i = start; i < out.length; i++) out[i].p.y = pc.y + Math.max(out[i].p.y - pc.y, -br * 0.25) * 0.6
    }
    clouds.push({ at: centre.setY(0).normalize(), strokes: out })
  }
  return clouds
}

const _cam = new THREE.Vector3()

/** Clouds drift slowly; from the high overview, those between the camera and the island are hidden so they never cover it. */
function Clouds() {
  const clouds = useMemo(cloudStrokes, [])
  const ref = useRef<THREE.Group>(null)
  useFrame(({ camera }, dt) => {
    const g = ref.current
    if (!g) return
    g.rotation.y += dt * 0.004
    _cam.copy(camera.position).setY(0).applyAxisAngle(UP_Y, -g.rotation.y).normalize()
    const high = camera.position.y > 100
    g.children.forEach((c, i) => {
      c.visible = !high || clouds[i].at.dot(_cam) < 0.35
    })
  })
  return (
    <group ref={ref}>
      {clouds.map((c, i) => (
        <group key={i}>
          <Strokes strokes={c.strokes} />
        </group>
      ))}
    </group>
  )
}

const UP_Y = new THREE.Vector3(0, 1, 0)
