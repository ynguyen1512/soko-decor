// A DecorKit bundles the instance collectors one decor layer writes into, and turns them into
// meshes when the layer is finished.
import * as THREE from 'three'
import { C, glossyMat, needleMat, standard } from '../core/materials'
import { InstanceCollector, ballGeometry, bulbGeometry, createGlowMaterial, sprigGeometry } from './instancing'

const ledMat = createGlowMaterial(C.ledWarm, 4.2, 1)

let capGeo: THREE.BufferGeometry | null = null
const capGeometry = () => (capGeo ??= new THREE.CylinderGeometry(0.28, 0.28, 0.35, 10))

export function createKit() {
  return {
    needles: new InstanceCollector(sprigGeometry(), needleMat()),
    leds: new InstanceCollector(bulbGeometry(), ledMat),
    berries: new InstanceCollector(ballGeometry(), glossyMat(0xffffff)),
    ornaments: new InstanceCollector(ballGeometry(), glossyMat(0xffffff)),
    caps: new InstanceCollector(capGeometry(), standard(0xc8a04a, 0.35, 0.9)),
  }
}

export type DecorKit = ReturnType<typeof createKit>

export function buildKit(kit: DecorKit, name: string) {
  const g = new THREE.Group()
  g.name = name
  for (const [key, collector] of Object.entries(kit)) {
    if (collector.count > 0) g.add(collector.build(`${name}:${key}`))
  }
  return g
}

const needleBase = new THREE.Color(C.needle)
const needleDark = new THREE.Color(C.needleDark)
/** Slightly varied pine greens; `shade` 0 = deep inside, 1 = outer tips. */
export function needleColor(shade: number, jitter: number) {
  return needleDark.clone().lerp(needleBase, THREE.MathUtils.clamp(shade, 0, 1)).offsetHSL(jitter * 0.03, jitter * 0.08, jitter * 0.03)
}
