import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { STROKE_GLSL } from './brush'
import { dusk } from './daynight'
import { routeFrame } from './island'

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
uniform float view;
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
  // night: Starry Night sky built from thick, separated dabs laid along flow lines
  float az = atan(d.z, d.x);
  float hh = max(h, 0.0);
  float flow = fbm(vec3(az * 1.6, hh * 3.0, time * 0.01));
  vec3 nsky = mix(vec3(0.10, 0.19, 0.42), vec3(0.04, 0.08, 0.25), smoothstep(0.0, 0.7, hh));
  // default flow: gently waving horizontal lanes
  float wv = hh + 0.025 * sin(az * 5.0 + hh * 14.0) + (flow - 0.5) * 0.05;
  vec2 uv = vec2(az * 30.0, wv * 92.0);
  // the long rolling current the vortices ride on
  float wy = hh - 0.21 - 0.05 * sin(az * 3.0 + 1.3) - (flow - 0.5) * 0.08;
  float pale = 0.18 + 0.6 * exp(-wy * wy / 0.005);
  float warm = 0.0;
  float swirl = 0.0;
  // the painting's interlocking double curl plus a few lesser curls round the horizon
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 c = i == 0 ? vec2(view - 0.3, 0.21) : i == 1 ? vec2(view + 0.02, 0.17) : vec2(view + 1.6 + fi * 1.4, 0.2);
    float R = i == 0 ? 0.13 : i == 1 ? 0.09 : 0.075;
    vec2 o = vec2(mod(az - c.x + 3.14159, 6.28318) - 3.14159, hh - c.y);
    float r = length(o);
    if (r < R) {
      float ang = atan(o.y, o.x) * (i == 1 ? -1.0 : 1.0);
      float rr = r * 92.0;
      // spiral lanes: radius drifts with angle so the strokes wind inward
      uv = vec2(ang * rr / 2.4, rr + ang * 1.3);
      pale = 0.45 + 0.4 * smoothstep(R, R * 0.3, r);
      swirl = smoothstep(R, R * 0.8, r);
    }
  }
  // big haloed stars: concentric dabs round a bright core
  vec2 sc = vec2(az * 5.0, hh * 6.5);
  vec2 cell = floor(sc);
  vec2 ctr = (cell + 0.5 + (vec2(hash(vec3(cell, 5.0)), hash(vec3(cell, 9.0))) - 0.5) * 0.4) / vec2(5.0, 6.5);
  vec2 so = vec2(az, hh) - ctr;
  float sr = length(so);
  float on = step(0.78, hash(vec3(cell, 3.0))) * smoothstep(0.1, 0.25, hh);
  if (on > 0.5 && sr < 0.055) {
    float ang = atan(so.y, so.x);
    uv = vec2(ang * sr * 92.0 / 2.0, sr * 92.0);
    warm = smoothstep(0.055, 0.025, sr);
    swirl = smoothstep(0.055, 0.045, sr);
  }
  // crescent moon fixed in the sky, wrapped in its own rings of strokes
  float ma = view + 0.55;
  vec2 mo = vec2(mod(az - ma + 3.14159, 6.28318) - 3.14159, hh - 0.24);
  float mr = length(mo);
  if (mr < 0.15) {
    float ang = atan(mo.y, mo.x);
    uv = vec2(ang * mr * 92.0 / 2.2, mr * 92.0);
    warm = max(warm, smoothstep(0.15, 0.06, mr));
    swirl = smoothstep(0.15, 0.13, mr);
  }
  // one dab per staggered cell, leaving dark sky between strokes
  float row = floor(uv.y);
  float x = uv.x + hash(vec3(row, 1.0, 2.0)) * 3.0;
  float colI = floor(x);
  vec2 bf = vec2(fract(x), fract(uv.y)) - 0.5;
  float id = hash(vec3(colI, row, 4.0));
  float tone = hash(vec3(colI, row, 8.0));
  float bend = bf.y + 0.12 * sin(bf.x * 3.0 + id * 6.0);
  float reach = 0.16 + id * 0.12;
  float e = length(vec2(max(abs(bf.x) - reach, 0.0) * 1.3, bend * (1.0 + 0.5 * abs(bf.x))));
  float dab = 1.0 - smoothstep(0.15, 0.22, e);
  vec3 cool = id < 0.35 ? vec3(0.15, 0.30, 0.64) : id < 0.7 ? vec3(0.24, 0.43, 0.74) : vec3(0.27, 0.48, 0.55);
  vec3 light = mix(vec3(0.52, 0.70, 0.86), vec3(0.84, 0.90, 0.86), tone);
  vec3 sCol = mix(cool, light, step(1.0 - pale, tone));
  sCol = mix(sCol, mix(vec3(0.93, 0.80, 0.36), vec3(0.98, 0.94, 0.72), tone), step(0.25, warm));
  nsky = mix(nsky, sCol, dab * swirl);
  nsky = mix(nsky, vec3(1.0, 0.97, 0.82), on * smoothstep(0.014, 0.008, sr));
  float star = step(0.997, hash(floor(d * 150.0))) * smoothstep(0.05, 0.3, hh);
  nsky = mix(nsky, vec3(1.0, 0.95, 0.75), star);
  vec2 mo2 = mo - vec2(0.018, 0.012);
  float moon = smoothstep(0.05, 0.044, mr) * smoothstep(0.036, 0.044, length(mo2));
  nsky = mix(nsky, vec3(1.0, 0.86, 0.35), moon);
  col = mix(col, nsky, night);
  gl_FragColor = vec4(col, 1.0);
}
`

/** Fixed sky azimuth of the Starry Night composition: straight ahead of the rider leaving the service center. */
const VIEW = (() => {
  const t = routeFrame(3).tan
  return Math.atan2(t.z, t.x)
})()

/** Flat painted sky dome with torn-edged pale cloud patches; follows the camera. */
export function Sky() {
  const ref = useRef<THREE.Mesh>(null)
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { up: { value: new THREE.Vector3(0, 1, 0) }, time: { value: 0 }, night: { value: dusk.k }, view: { value: VIEW } },
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

