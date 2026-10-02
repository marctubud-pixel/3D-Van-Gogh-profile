import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { STROKE_GLSL } from './brush'

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
  vec3 col = mix(vec3(0.55, 0.80, 0.78), vec3(0.47, 0.76, 0.75), smoothstep(0.0, 0.8, h));
  vec2 k = dabs(vec2(atan(d.z, d.x) * 44.0, h * 56.0), 0.45);
  col *= 1.0 + k.y * k.x * 0.04;
  // flat pale cloud shapes with ragged, torn edges, like hand-cut brush patches
  vec3 q = d * vec3(2.4, 1.3, 2.4) + vec3(time * 0.004, 0.0, 0.0);
  q += vec3(fbm(q * 1.8), 0.0, fbm(q * 1.8 + 7.3)) * 0.55;
  float n = fbm(q) + (noise(d * 46.0) - 0.5) * 0.07 + (noise(d * 120.0) - 0.5) * 0.04;
  float band = smoothstep(-0.02, 0.18, h) * (1.0 - smoothstep(0.7, 0.95, h));
  float cloud = step(0.6, n * (0.55 + band * 0.6));
  col = mix(col, vec3(0.69, 0.90, 0.85), cloud);
  gl_FragColor = vec4(col, 1.0);
}
`

/** Flat painted sky dome with torn-edged pale cloud patches; follows the camera. */
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
    </>
  )
}

