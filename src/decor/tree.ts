// Christmas trees covered in warm fairy lights, built from instanced pine sprigs around a dark core.
import * as THREE from 'three'
import { C, standard } from '../core/materials'
import { type Rng, gauss, range } from '../core/rng'
import { type DecorKit, needleColor } from './kit'

export interface TreeOptions {
  height: number
  /** base radius as a fraction of the height */
  spread?: number
  sprigs?: number
  leds?: number
  baubles?: number
  /** return false for points that would poke through walls (e.g. the parapet band) */
  keep?: (p: THREE.Vector3) => boolean
  /** radius of the dark inner cone as a fraction of the base radius */
  coreRadius?: number
}

const coreMat = standard(C.needleDark, 0.95)
const baubleRed = new THREE.Color(C.ornamentRed)

/** Adds one tree standing at `base` to the kit; returns the solid core mesh. */
export function addTree(kit: DecorKit, rng: Rng, base: THREE.Vector3, opts: TreeOptions) {
  const H = opts.height
  const R = H * (opts.spread ?? 0.36)
  const sprigs = opts.sprigs ?? Math.round(1050 * H)
  const leds = opts.leds ?? Math.round(420 * H)
  const baubles = opts.baubles ?? Math.round(42 * H)
  const keep = opts.keep ?? (() => true)

  const core = new THREE.Mesh(new THREE.ConeGeometry(R * (opts.coreRadius ?? 0.82), H * 0.97, 14, 1, true), coreMat)
  core.position.set(base.x, base.y + H * 0.485, base.z)

  const tiers = 5
  /** Radius of the silhouette at height fraction t: tiered, so the tree reads as layered boughs. */
  const radiusAt = (t: number) => {
    const tier = (t * tiers) % 1
    return R * (1 - t) * (0.88 + 0.12 * (1 - tier)) + 0.03
  }
  const surfacePoint = (t: number, a: number, depth: number) => {
    const r = radiusAt(t) * depth
    return new THREE.Vector3(base.x + Math.cos(a) * r, base.y + t * H, base.z + Math.sin(a) * r)
  }

  for (let i = 0; i < sprigs; i++) {
    // more sprigs near the bottom, where the cone has more surface
    const t = 1 - Math.sqrt(rng()) * 0.97
    const a = rng() * Math.PI * 2
    const depth = range(rng, 0.7, 1.0)
    const pos = surfacePoint(t, a, depth * 0.8)
    const dir = new THREE.Vector3(Math.cos(a), range(rng, -0.55, 0.05), Math.sin(a)).normalize()
    const scale = range(rng, 0.24, 0.36) * (0.55 + 0.45 * (1 - t)) * (H / 1.8)
    // test the sprig's tip as well: a sprig rooted behind a wall can still reach through it
    if (!keep(pos) || !keep(pos.clone().addScaledVector(dir, scale * 1.15))) continue
    kit.needles.add(pos, {
      dir,
      spin: rng() * Math.PI * 2,
      scale,
      color: needleColor(0.4 + depth * 0.6, gauss(rng)),
    })
  }

  // leader at the top
  kit.needles.add(new THREE.Vector3(base.x, base.y + H * 0.93, base.z), { scale: H * 0.1, color: needleColor(0.9, 0) })

  for (let i = 0; i < leds; i++) {
    const t = 1 - Math.sqrt(rng()) * 0.96
    const pos = surfacePoint(t, rng() * Math.PI * 2, range(rng, 0.95, 1.12))
    if (!keep(pos)) continue
    kit.leds.add(pos, { scale: 0.014, phase: rng() })
  }

  for (let i = 0; i < baubles; i++) {
    const t = range(rng, 0.08, 0.85)
    const a = rng() * Math.PI * 2
    const pos = surfacePoint(t, a, 0.98)
    if (!keep(pos)) continue
    kit.ornaments.add(pos, { scale: range(rng, 0.03, 0.048) * (H / 1.5), color: baubleRed })
  }
  return core
}
