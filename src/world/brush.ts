import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/** Experimental Van Gogh–style impasto strokes, enabled with `?brush` in the URL. */
export const BRUSH = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('brush')

const strokeVertexHead = /* glsl */ `
varying vec3 vBW;
varying vec3 vBN;
`
const strokeVertexBody = /* glsl */ `
vec4 bw = vec4(transformed, 1.0);
vec3 bn = objectNormal;
#ifdef USE_INSTANCING
bw = instanceMatrix * bw;
bn = mat3(instanceMatrix) * bn;
#endif
vBW = (modelMatrix * bw).xyz;
vBN = normalize(mat3(modelMatrix) * bn);
`

export const STROKE_GLSL = /* glsl */ `
float bh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bn2(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(bh(i), bh(i + vec2(1, 0)), f.x), mix(bh(i + vec2(0, 1)), bh(i + vec2(1, 1)), f.x), f.y);
}
// Returns (coverage, tone) of the top-most dab covering p; strokes follow a swirling flow field.
vec2 dabs(vec2 p, float flowScale) {
  vec2 c = floor(p);
  vec2 res = vec2(0.0);
  float best = -1.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 id = c + vec2(i, j);
    float r = bh(id);
    vec2 ctr = id + 0.5 + (vec2(r, bh(id + 7.3)) - 0.5) * 0.8;
    float ang = bn2(ctr * flowScale) * 6.2832 * 1.4 + (r - 0.5) * 0.5;
    vec2 dir = vec2(cos(ang), sin(ang));
    vec2 d = p - ctr;
    float along = dot(d, dir);
    float across = dot(d, vec2(-dir.y, dir.x));
    float len = 0.55 + 0.35 * bh(id + 3.1);
    float wid = 0.13 + 0.07 * bh(id + 5.7);
    float a = clamp(along / len, -1.0, 1.0);
    float taper = wid * (1.0 - a * a * 0.55);
    float m = (1.0 - smoothstep(len * 0.92, len, abs(along))) * (1.0 - smoothstep(taper * 0.75, taper, abs(across)));
    float order = bh(id + 11.9);
    if (m > 0.5 && order > best) { best = order; res = vec2(1.0, bh(id + 17.3) * 2.0 - 1.0 + a * 0.15); }
  }
  return res;
}
vec3 paintStrokes(vec3 col, vec3 wp, vec3 wn) {
  vec3 w = pow(abs(wn), vec3(4.0));
  w /= (w.x + w.y + w.z);
  float s = 1.5;
  vec2 a = dabs(wp.yz * s, 0.22) * w.x;
  vec2 b = dabs(wp.zx * s + 13.0, 0.22) * w.y;
  vec2 cc = dabs(wp.xy * s + 29.0, 0.22) * w.z;
  vec2 d = a + b + cc;
  float t = d.y;
  vec3 light = col * 1.32 + vec3(0.10, 0.08, -0.02);
  vec3 dark = col * vec3(0.55, 0.66, 0.95);
  vec3 painted = t > 0.0 ? mix(col, light, t) : mix(col, dark, -t);
  return mix(col * 0.93, painted, d.x);
}
`

const strokeFragment = /* glsl */ `
#include <color_fragment>
diffuseColor.rgb = paintStrokes(diffuseColor.rgb, vBW, normalize(vBN));
`

const patched = new WeakSet<THREE.Material>()

export function brushify(m: THREE.Material) {
  if (patched.has(m) || !(m instanceof THREE.MeshToonMaterial)) return
  patched.add(m)
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${strokeVertexHead}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${strokeVertexBody}`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${strokeVertexHead}\n${STROKE_GLSL}`)
      .replace('#include <color_fragment>', strokeFragment)
  }
  m.customProgramCacheKey = () => 'brush'
  m.needsUpdate = true
}

/** Applies brush strokes to every toon material in the scene (re-scans so lazily mounted meshes are covered). */
export function BrushPass() {
  const scene = useThree((s) => s.scene)
  useFrame(({ clock }) => {
    if (!BRUSH) return
    if (Math.floor(clock.elapsedTime * 2) % 4 !== 0 && clock.elapsedTime > 1) return
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const mats: THREE.Material[] = Array.isArray(o.material) ? o.material : [o.material]
        mats.forEach(brushify)
      }
    })
  })
  return null
}
