import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BRUSH, STROKE_GLSL } from './brush'

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
uniform float brush;
${STROKE_GLSL}
uniform float time;
varying vec3 vDir;
float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.07; a *= 0.5; } return v; }
void main() {
  vec3 d = normalize(vDir);
  float h = dot(d, normalize(up));
  vec3 top = vec3(0.39, 0.71, 0.72);
  vec3 horizon = vec3(0.62, 0.86, 0.82);
  vec3 col = mix(horizon, top, smoothstep(-0.05, 0.7, h));
  // brush-stroke streak clouds: stretched noise, hard thresholds
  vec3 q = d * vec3(1.3, 3.6, 1.3) + vec3(time * 0.006, 0.0, 0.0);
  float n = fbm(q + fbm(q * 1.7) * 0.9);
  float band = smoothstep(-0.15, 0.25, h) * (1.0 - smoothstep(0.75, 0.98, h));
  float c1 = step(0.6, n * band + 0.06);
  float c2 = step(0.68, n * band + 0.06);
  col = mix(col, vec3(0.70, 0.90, 0.86), c1 * 0.85);
  col = mix(col, vec3(0.84, 0.96, 0.92), c2);
  if (brush > 0.5) {
    vec2 sp = vec2(atan(d.z, d.x) * 22.0, h * 30.0);
    vec2 k = dabs(sp + vec2(time * 0.05, 0.0), 0.35);
    vec3 lit = mix(col * 1.18 + vec3(0.06, 0.05, -0.02), vec3(0.98, 0.93, 0.70), 0.18);
    vec3 dk = col * vec3(0.72, 0.82, 1.0);
    col = mix(col, k.y > 0.0 ? mix(col, lit, k.y) : mix(col, dk, -k.y), k.x);
  }
  gl_FragColor = vec4(col, 1.0);
}
`

/** Flat painted sky dome with streaky cel-shaded clouds; follows the camera. */
export function Sky() {
  const ref = useRef<THREE.Mesh>(null)
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { up: { value: new THREE.Vector3(0, 1, 0) }, time: { value: 0 }, brush: { value: BRUSH ? 1 : 0 } },
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
    <mesh ref={ref} material={mat} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[300, 48, 24]} />
    </mesh>
  )
}
