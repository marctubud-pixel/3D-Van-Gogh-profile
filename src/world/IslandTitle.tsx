import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import fontUrl from 'three/examples/fonts/helvetiker_bold.typeface.json?url'
import { R, tangentNorth } from './sphere'
import { TITLE_CENTER } from './island'
import { outlineMaterial, toonMaterial } from './toon'

const LINES: [string, number, number][] = [
  ['MARC', 7, 9],
  ['ISLAND', -7, 9],
]

/** Lay a flat text geometry (x = east, y = north, z = height) on the sea around `center`. */
function layOnSea(g: THREE.BufferGeometry, center: THREE.Vector3) {
  const north = tangentNorth(center)
  const east = new THREE.Vector3().crossVectors(north, center).normalize()
  const pos = g.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    v.copy(center).multiplyScalar(R).addScaledVector(east, x).addScaledVector(north, y).normalize().multiplyScalar(R - 0.9 + z)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
}

/** "MARC ISLAND" lettering rising out of the sea as sandy grass-topped islets. */
export function IslandTitle() {
  const [geoms, setGeoms] = useState<THREE.BufferGeometry[]>([])
  useEffect(() => {
    let alive = true
    new FontLoader().load(fontUrl, (font) => {
      if (!alive) return
      const center = TITLE_CENTER
      const out = LINES.map(([text, y, size]) => {
        const g = new TextGeometry(text, {
          font,
          size,
          depth: 2,
          curveSegments: 5,
          bevelEnabled: true,
          bevelThickness: 0.3,
          bevelSize: 0.35,
          bevelSegments: 2,
        })
        g.computeBoundingBox()
        const bb = g.boundingBox!
        g.translate(-(bb.max.x + bb.min.x) / 2, y - size / 2, 0)
        layOnSea(g, center)
        return g
      })
      setGeoms(out)
    })
    return () => {
      alive = false
    }
  }, [])
  const grass = toonMaterial('#72b07e')
  const sand = toonMaterial('#e3d8b8')
  return (
    <group>
      {geoms.map((g, i) => (
        <group key={i}>
          <mesh geometry={g} material={[grass, sand]} castShadow receiveShadow />
          <mesh geometry={g} material={outlineMaterial(0.12, false)} />
        </group>
      ))}
    </group>
  )
}
