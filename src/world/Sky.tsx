import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

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
  vec3 top = vec3(0.42, 0.66, 0.70);
  vec3 horizon = vec3(0.94, 0.80, 0.62);
  vec3 col = mix(horizon, top, smoothstep(-0.02, 0.6, h));
  col = mix(col, vec3(0.99, 0.88, 0.72), smoothstep(0.12, -0.08, h) * 0.55);
  // brush-stroke streak clouds: stretched noise, hard thresholds
  vec3 q = d * vec3(1.3, 3.6, 1.3) + vec3(time * 0.006, 0.0, 0.0);
  float n = fbm(q + fbm(q * 1.7) * 0.9);
  float band = smoothstep(-0.15, 0.25, h) * (1.0 - smoothstep(0.75, 0.98, h));
  float c1 = smoothstep(0.58, 0.66, n * band + 0.06);
  float c2 = smoothstep(0.68, 0.76, n * band + 0.06);
  col = mix(col, vec3(0.86, 0.83, 0.76), c1 * 0.8);
  col = mix(col, vec3(0.99, 0.94, 0.86), c2);
  gl_FragColor = vec4(col, 1.0);
}
`

/** Flat painted sky dome with streaky cel-shaded clouds; follows the camera. */
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
    <mesh ref={ref} material={mat} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[300, 48, 24]} />
    </mesh>
  )
}
