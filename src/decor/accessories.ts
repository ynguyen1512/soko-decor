// Individual accessories: velvet bows, neon star lights and gift boxes. Ornaments and berries are
// instanced and placed by the garland generator.
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { C, satinMat, velvetMat } from '../core/materials'
import { createGlowMaterial } from './instancing'

const bowCache = new Map<number, THREE.BufferGeometry>()

/** One ribbon tail hanging from the knot, bending outward, with a V-cut end. */
function tailGeometry(side: 1 | -1, length: number) {
  const g = new THREE.PlaneGeometry(0.34, length, 2, 18)
  g.translate(0, -length / 2, 0)
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i)
    let y = pos.getY(i)
    const s = -y / length // 0 at knot → 1 at end
    // V notch: the middle column of the last row is pulled up
    if (s > 0.999 && Math.abs(x) < 1e-6) y += 0.22
    const widen = 1 + s * 0.25
    x = x * widen + side * (0.08 + 0.42 * s)
    const z = 0.07 * Math.sin(s * 5 + side) + 0.04 * s
    pos.setXYZ(i, x, y, z)
  }
  g.computeVertexNormals()
  return g
}

/**
 * Velvet bow, ~2 units wide before scaling, origin at the knot, facing +Z.
 * `tail` is the tail length in the same units (long tails for the B2 "large bow" look).
 */
export function bowGeometry(tail: number) {
  const key = Math.round(tail * 100)
  const hit = bowCache.get(key)
  if (hit) return hit
  const parts: THREE.BufferGeometry[] = []
  for (const side of [-1, 1] as const) {
    // a flat ribbon loop: a torus squashed into a wide band, pinched towards the knot
    const loop = new THREE.TorusGeometry(0.46, 0.15, 6, 36)
    loop.scale(1, 0.58, 1)
    const lp = loop.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < lp.count; i++) {
      const x = lp.getX(i)
      const pinch = THREE.MathUtils.smoothstep(-x * side, 0.1, 0.46)
      lp.setY(i, lp.getY(i) * (1 - 0.55 * pinch))
      lp.setZ(i, lp.getZ(i) * 0.28)
    }
    loop.computeVertexNormals()
    loop.rotateZ(side * 0.3)
    loop.translate(side * 0.48, 0.06, 0)
    parts.push(loop, tailGeometry(side, tail))
  }
  const knot = new THREE.SphereGeometry(0.2, 14, 10)
  knot.scale(0.9, 1.15, 0.55)
  knot.translate(0, 0, 0.05)
  parts.push(knot)
  const geo = mergeGeometries(parts.map((p) => p.toNonIndexed()))
  bowCache.set(key, geo)
  return geo
}

export function createBow(size: number, tail: number) {
  const bow = new THREE.Mesh(bowGeometry(tail), velvetMat())
  bow.scale.setScalar(size)
  bow.name = 'bow'
  return bow
}

let starGeo: THREE.BufferGeometry | null = null
const starMat = createGlowMaterial(C.starWarm, 3.2, 0.25)

/** Neon five-point star outline, radius 1 before scaling, facing +Z. */
export function createStar(size: number) {
  if (!starGeo) {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / 5
      const r = i % 2 === 0 ? 1 : 0.46
      pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0))
    }
    const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.08)
    starGeo = new THREE.TubeGeometry(curve, 160, 0.055, 6, true)
  }
  const star = new THREE.Mesh(starGeo, starMat)
  star.scale.setScalar(size)
  star.name = 'star'
  return star
}

/** Gift box sitting on its base (origin at bottom centre), with ribbon cross and a small bow. */
export function createGift(w: number, h: number, d: number, paper: number, ribbon: number) {
  const g = new THREE.Group()
  g.name = 'gift'
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), satinMat(paper))
  body.position.y = h / 2
  const lid = new THREE.Mesh(new THREE.BoxGeometry(w * 1.06, h * 0.16, d * 1.06), satinMat(paper))
  lid.position.y = h * 0.92
  const rw = Math.min(w, d) * 0.16
  const bandA = new THREE.Mesh(new THREE.BoxGeometry(rw, h * 1.02, d * 1.08), satinMat(ribbon))
  bandA.position.y = h / 2
  const bandB = new THREE.Mesh(new THREE.BoxGeometry(w * 1.08, h * 1.02, rw), satinMat(ribbon))
  bandB.position.y = h / 2
  const bow = new THREE.Mesh(bowGeometry(0.5), satinMat(ribbon))
  bow.scale.setScalar(Math.min(w, d) * 0.32)
  bow.position.y = h + Math.min(w, d) * 0.12
  g.add(body, lid, bandA, bandB, bow)
  return g
}
