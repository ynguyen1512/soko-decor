// Pine garland along the top edge of the curved parapet, in two styles from the brief:
//   light   – thin garland draped along the whole edge (10–15 cm)
//   cluster – full bunches (25–30 cm) at each tree, linked by shallow swags
import * as THREE from 'three'
import { C } from '../core/materials'
import { type Rng, gauss, pick, range } from '../core/rng'
import { FACADE, TREE_XS, frontNormal, frontZ } from '../world/facade'
import { type DecorKit, needleColor } from './kit'

export type DrapeStyle = 'light' | 'cluster'

const TOP = FACADE.parapetTop + 0.05
const W = FACADE.halfWidth
const SWAG_DIP = 0.2

/** Point on the parapet top edge at x, raised by `dy` and pushed outward by `out`. */
export function edgePoint(x: number, dy = 0, out = 0) {
  const n = frontNormal(x)
  return new THREE.Vector3(x + n.x * out, TOP + dy, frontZ(x) + n.z * out)
}

function outwardDir(x: number, down: number, spread: number, rng: Rng) {
  const n = frontNormal(x)
  return new THREE.Vector3(n.x + gauss(rng) * spread, -down + gauss(rng) * spread, n.z + gauss(rng) * spread).normalize()
}

/** Arc length of the parapet front edge between x0 and x1. */
export function edgeLength(x0 = -W, x1 = W) {
  let len = 0
  const steps = 200
  for (let i = 0; i < steps; i++) {
    const a = x0 + ((x1 - x0) * i) / steps
    const b = x0 + ((x1 - x0) * (i + 1)) / steps
    len += Math.hypot(b - a, frontZ(b) - frontZ(a))
  }
  return len
}

/** Height offset of the swag between two cluster anchors at x. */
function swagDy(x: number) {
  const anchors = [-W, ...TREE_XS, W]
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i]
    const b = anchors[i + 1]
    if (x >= a && x <= b) {
      const u = (x - a) / (b - a)
      const dip = i === 0 || i === anchors.length - 2 ? SWAG_DIP * 0.6 : SWAG_DIP
      return -0.03 - dip * 4 * u * (1 - u)
    }
  }
  return 0
}

export interface Garland {
  style: DrapeStyle
  lengthM: number
  clusterXs: readonly number[]
  /** where a hanging accessory looks attached at x (front of the garland) */
  attachPoint(x: number, dy?: number): THREE.Vector3
  /** a random point on the garland's outer surface, for berries and ornaments */
  surfacePoint(rng: Rng): THREE.Vector3
}

export function addGarland(kit: DecorKit, rng: Rng, style: DrapeStyle): Garland {
  const length = edgeLength()
  const sprig = (pos: THREE.Vector3, dir: THREE.Vector3, size: number, shade: number) =>
    kit.needles.add(pos, { dir, spin: rng() * Math.PI * 2, scale: size, color: needleColor(shade, gauss(rng)) })

  // rope along the top edge (both styles; thinner under clusters)
  const ropeR = style === 'light' ? 0.075 : 0.055
  const ropeCount = Math.round(length * (style === 'light' ? 300 : 170))
  for (let i = 0; i < ropeCount; i++) {
    const x = range(rng, -W, W)
    const a = rng() * Math.PI * 2
    const r = ropeR * Math.sqrt(rng())
    const pos = edgePoint(x, Math.sin(a) * r, 0.03 + Math.cos(a) * r)
    const size = style === 'light' ? range(rng, 0.13, 0.19) : range(rng, 0.11, 0.16)
    sprig(pos, outwardDir(x, 0.35, 0.7, rng), size, 0.35 + rng() * 0.65)
  }

  if (style === 'light') {
    // short tips hanging over the band all along the edge
    const tips = Math.round(length * 150)
    for (let i = 0; i < tips; i++) {
      const x = range(rng, -W, W)
      const pos = edgePoint(x, range(rng, -0.04, 0.03), range(rng, 0.05, 0.1))
      sprig(pos, outwardDir(x, 2.2, 0.25, rng), range(rng, 0.1, 0.16), 0.5 + rng() * 0.5)
    }
  } else {
    // swags on the band face between clusters
    const swagCount = Math.round(length * 150)
    for (let i = 0; i < swagCount; i++) {
      const x = range(rng, -W, W)
      const a = rng() * Math.PI * 2
      const r = 0.05 * Math.sqrt(rng())
      const pos = edgePoint(x, swagDy(x) + Math.sin(a) * r, 0.06 + Math.abs(Math.cos(a)) * r)
      sprig(pos, outwardDir(x, 0.6, 0.6, rng), range(rng, 0.11, 0.16), 0.4 + rng() * 0.6)
    }
    // hanging bunches at each tree
    for (const cx of TREE_XS) {
      for (let i = 0; i < 300; i++) {
        const drop = Math.pow(rng(), 0.8) // 0 = top of bunch, 1 = lowest tip
        const x = cx + gauss(rng) * 0.3 * (1 - drop * 0.55)
        const pos = edgePoint(x, 0.06 - drop * 0.36, range(rng, 0.04, 0.17))
        sprig(pos, outwardDir(x, 0.8 + drop * 1.6, 0.45, rng), range(rng, 0.18, 0.28) * (1 - drop * 0.3), 0.3 + rng() * 0.7)
      }
    }
  }

  const surfacePoint = (r: Rng) => {
    const x = range(r, -W + 0.05, W - 0.05)
    if (style === 'light') return edgePoint(x, range(r, -0.12, 0.08), range(r, 0.1, 0.16))
    // cluster: two thirds on bunches, the rest along the swags
    if (r() < 0.66) {
      const cx = pick(r, TREE_XS)
      const drop = r()
      const bx = cx + gauss(r) * 0.24 * (1 - drop * 0.5)
      return edgePoint(bx, 0.04 - drop * 0.3, range(r, 0.17, 0.24))
    }
    return edgePoint(x, swagDy(x), range(r, 0.1, 0.13))
  }

  // fairy lights
  const ledCount = Math.round(length * (style === 'light' ? 140 : 70)) + (style === 'cluster' ? TREE_XS.length * 110 : 0)
  for (let i = 0; i < ledCount; i++) {
    const p = surfacePoint(rng)
    kit.leds.add(p.addScaledVector(new THREE.Vector3(0, gauss(rng) * 0.03, 0), 1), { scale: 0.013, phase: rng() })
  }

  return {
    style,
    lengthM: length,
    clusterXs: style === 'cluster' ? TREE_XS : [],
    attachPoint: (x, dy = 0) => edgePoint(x, (style === 'cluster' ? -0.08 : -0.04) + dy, style === 'cluster' ? 0.4 : 0.27),
    surfacePoint,
  }
}

const berryRed = new THREE.Color(C.berry)

/** Clusters of 6–12 glossy red berries on the garland surface. Returns the number of clusters. */
export function addBerries(kit: DecorKit, rng: Rng, garland: Garland, perMetre: number) {
  const clusters = Math.round(garland.lengthM * perMetre)
  for (let c = 0; c < clusters; c++) {
    const centre = garland.surfacePoint(rng)
    const n = 6 + Math.floor(rng() * 7)
    for (let i = 0; i < n; i++) {
      const p = centre.clone().add(new THREE.Vector3(gauss(rng) * 0.035, gauss(rng) * 0.035, Math.abs(gauss(rng)) * 0.02))
      kit.berries.add(p, { scale: range(rng, 0.011, 0.016), color: berryRed })
    }
  }
  return clusters
}

const ORNAMENT_COLOURS = [
  { key: 'red', color: new THREE.Color(C.ornamentRed), weight: 0.45 },
  { key: 'gold', color: new THREE.Color(C.ornamentGold), weight: 0.35 },
  { key: 'silver', color: new THREE.Color(C.ornamentSilver), weight: 0.2 },
] as const

/** Glossy baubles in red / gold / silver. Returns counts per colour. */
export function addOrnaments(kit: DecorKit, rng: Rng, garland: Garland, perMetre: number) {
  const counts = { red: 0, gold: 0, silver: 0 }
  const total = Math.round(garland.lengthM * perMetre)
  for (let i = 0; i < total; i++) {
    let roll = rng()
    const choice = ORNAMENT_COLOURS.find((c) => (roll -= c.weight) < 0) ?? ORNAMENT_COLOURS[0]
    const r = pick(rng, [0.04, 0.05, 0.06, 0.07])
    const p = garland.surfacePoint(rng).add(new THREE.Vector3(0, -0.02, 0.02))
    kit.ornaments.add(p, { scale: r, color: choice.color })
    kit.caps.add(p.clone().add(new THREE.Vector3(0, r * 1.02, 0)), { scale: r })
    counts[choice.key]++
  }
  return counts
}
