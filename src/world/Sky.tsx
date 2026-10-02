import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { STROKE_GLSL } from './brush'
import { dusk } from './daynight'

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
uniform float night;
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
  // night: Starry Night sky -- a rolling cobalt current, curling vortices, haloed stars and a crescent moon
  float az = atan(d.z, d.x);
  float hh = max(h, 0.0);
  vec3 nsky = mix(vec3(0.17, 0.29, 0.52), vec3(0.06, 0.12, 0.33), smoothstep(0.0, 0.75, hh));
  float flow = fbm(vec3(az * 1.6, hh * 3.0, time * 0.01));
  // long horizontal current that waves across the sky
  float wy = hh - 0.42 - 0.07 * sin(az * 3.0 + 1.3) - (flow - 0.5) * 0.12;
  float current = exp(-wy * wy / 0.012);
  float streak = 0.5 + 0.5 * sin(wy * 110.0 + sin(az * 2.0) * 1.5 + flow * 6.0);
  // a couple of big curls riding on the current
  float swirl = 0.0;
  float ring = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 c = vec2(-2.4 + fi * 1.7, 0.45 + 0.06 * sin(fi * 2.1));
    float da = mod(az - c.x + 3.14159, 6.28318) - 3.14159;
    vec2 o = vec2(da * 0.55, hh - c.y);
    float r = length(o);
    float R = 0.16 + 0.05 * fi * (2.0 - fi) * 0.5;
    float w = exp(-r * r / (R * R));
    float ang = atan(o.y, o.x);
    ring = max(ring, w * (0.5 + 0.5 * sin(r * 70.0 - ang * 2.0 + flow * 4.0)));
    swirl = max(swirl, w);
  }
  vec2 sk = dabs(vec2(az * 30.0 + wy * 40.0, hh * 48.0 + flow * 6.0), 0.5);
  nsky = mix(nsky, mix(vec3(0.20, 0.38, 0.66), vec3(0.42, 0.62, 0.80), streak), current * 0.75);
  nsky = mix(nsky, mix(vec3(0.16, 0.34, 0.62), vec3(0.62, 0.78, 0.86), ring), swirl * 0.85);
  nsky *= 0.9 + sk.x * sk.y * 0.25;
  // haloed stars: each cell may hold one star with concentric yellow rings
  vec2 sc = vec2(az * 7.0, hh * 9.0);
  vec2 cell = floor(sc);
  vec2 f = fract(sc) - 0.5;
  float hs = hash(vec3(cell, 3.0));
  float sr = length(f + (vec2(hash(vec3(cell, 5.0)), hash(vec3(cell, 9.0))) - 0.5) * 0.4);
  float on = step(0.72, hs) * smoothstep(0.08, 0.25, hh);
  float halo = on * (smoothstep(0.32, 0.0, sr) * (0.55 + 0.45 * sin(sr * 60.0)));
  float core = on * smoothstep(0.09, 0.03, sr);
  nsky = mix(nsky, vec3(0.93, 0.88, 0.52), halo * 0.55);
  nsky = mix(nsky, vec3(1.0, 0.97, 0.80), core);
  // small scattered stars
  float star = step(0.997, hash(floor(d * 150.0))) * smoothstep(0.05, 0.3, hh);
  nsky = mix(nsky, vec3(1.0, 0.95, 0.75), star);
  // crescent moon with a glowing ring
  vec3 md = normalize(vec3(0.62, 0.5, -0.6));
  float mr = acos(clamp(dot(d, md), -1.0, 1.0));
  vec3 md2 = normalize(md + vec3(0.03, 0.02, 0.03));
  float mr2 = acos(clamp(dot(d, md2), -1.0, 1.0));
  float moon = smoothstep(0.075, 0.068, mr) * smoothstep(0.06, 0.068, mr2);
  float mhalo = smoothstep(0.32, 0.07, mr) * (0.6 + 0.4 * sin(mr * 120.0));
  nsky = mix(nsky, vec3(0.95, 0.85, 0.45), mhalo * 0.6);
  nsky = mix(nsky, vec3(1.0, 0.86, 0.35), moon);
  col = mix(col, nsky, night);
  gl_FragColor = vec4(col, 1.0);
}
`

/** Flat painted sky dome with torn-edged pale cloud patches; follows the camera. */
export function Sky() {
  const ref = useRef<THREE.Mesh>(null)
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { up: { value: new THREE.Vector3(0, 1, 0) }, time: { value: 0 }, night: { value: dusk.k } },
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
    mat.uniforms.night.value = dusk.k
  })
  return (
    <>
      <mesh ref={ref} material={mat} renderOrder={-1} frustumCulled={false}>
        <sphereGeometry args={[300, 48, 24]} />
      </mesh>
    </>
  )
}

