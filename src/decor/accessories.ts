// Individual accessories: velvet bows, neon star lights and gift boxes. Ornaments and berries are
// instanced and placed by the garland generator.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { C, satinMat, velvetMat } from '../core/materials'
import { createGlowMaterial } from './instancing'

// ── velvet bow ───────────────────────────────────────────────────────────────────────────────
// Built like a real wired-velvet bow (docs/ref): wide ribbon swept into two soft, slightly
// drooping loops, a ribbon-wrapped knot and two long cupped tails with V-cut ends. Units: the bow
// is ~2 wide before scaling, origin at the knot, facing +Z.

const RIBBON = 0.56

/** A flat ribbon swept along `curve`; `widthDir(t, p)` gives the direction its width runs. */
function ribbonStrip(curve: THREE.Curve<THREE.Vector3>, samples: number, widthDir: (t: number, p: THREE.Vector3) => THREE.Vector3) {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const tangent = new THREE.Vector3()
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const p = curve.getPointAt(t)
    curve.getTangentAt(t, tangent)
    // width direction kept perpendicular to the ribbon's path
    const w = widthDir(t, p).projectOnPlane(tangent).normalize().multiplyScalar(RIBBON / 2)
    pos.push(p.x - w.x, p.y - w.y, p.z - w.z, p.x + w.x, p.y + w.y, p.z + w.z)
    uv.push(0, t, 1, t)
    if (i > 0) {
      const a = (i - 1) * 2
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** One soft loop: out and up from the knot, round the end, sagging back underneath. */
function loopGeometry(side: 1 | -1) {
  const pts = [
    [0.08, 0.08, 0.1], [0.4, 0.44, 0.17], [0.86, 0.52, 0.1], [1.14, 0.2, 0.0],
    [1.1, -0.24, 0.03], [0.74, -0.4, 0.12], [0.3, -0.24, 0.16], [0.08, -0.06, 0.12],
  ].map(([x, y, z]) => new THREE.Vector3(side * x, y, z))
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal')
  const centre = new THREE.Vector3(side * 0.6, 0.04, 0.05)
  // the ribbon faces partly forward and cups backward at its outer edge: a puffy loop
  const strip = ribbonStrip(curve, 80, (_t, p) => p.clone().sub(centre).setZ(0).normalize().multiplyScalar(0.8).add(new THREE.Vector3(0, 0, -0.6)))
  // heavy velvet: the loops droop a little at their outer ends
  strip.rotateZ(side * -0.14)
  return strip
}

/** One tail hanging from the knot: wide, cupped across, gently waved, V-cut at the end. */
function tailGeometry(side: 1 | -1, length: number) {
  const width = RIBBON * 0.95
  const g = new THREE.PlaneGeometry(width, length, 4, 24)
  g.translate(0, -length / 2, 0)
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x0 = pos.getX(i)
    let y = pos.getY(i)
    const s = THREE.MathUtils.clamp(-y / length, 0, 1) // 0 at the knot → 1 at the end
    // V notch: pull the last row up towards the centre line
    if (s > 0.999) y += 0.26 * (1 - Math.abs(x0) / (width / 2))
    const widen = 1 + s * 0.18
    const x = x0 * widen + side * (0.1 + 0.34 * Math.sqrt(s))
    const cup = 0.05 * (1 - (2 * x0 / width) ** 2)
    const z = 0.03 + cup + 0.06 * Math.sin(s * 4.2 + (side > 0 ? 1.4 : 0)) * s
    pos.setXYZ(i, x, y, z)
  }
  g.computeVertexNormals()
  return g
}

function knotGeometry() {
  const knot = new RoundedBoxGeometry(0.4, 0.46, 0.26, 4, 0.11)
  knot.translate(0, 0, 0.12)
  return knot
}

const bowCache = new Map<number, THREE.BufferGeometry>()

/** Loops, knot and the plain (left) tail merged; the right tail is separate so it can carry a logo. */
export function bowGeometry(tail: number) {
  const key = Math.round(tail * 100)
  const hit = bowCache.get(key)
  if (hit) return hit
  const parts = [loopGeometry(-1), loopGeometry(1), knotGeometry(), tailGeometry(-1, tail)]
  const geo = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))
  bowCache.set(key, geo)
  return geo
}

const tailCache = new Map<number, THREE.BufferGeometry>()
function rightTail(tail: number) {
  const key = Math.round(tail * 100)
  if (!tailCache.has(key)) tailCache.set(key, tailGeometry(1, tail))
  return tailCache.get(key)!
}

const logoTailMats = new Map<number, THREE.Material>()
/** Velvet with the white Soko "s" printed on the lower part of the tail. */
function logoTailMaterial(tail: number) {
  const key = Math.round(tail * 100)
  const hit = logoTailMats.get(key)
  if (hit) return hit
  const cw = 128
  const ch = 512
  const width = RIBBON * 0.95
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = `#${new THREE.Color(C.velvet).getHexString(THREE.SRGBColorSpace)}`
  ctx.fillRect(0, 0, cw, ch)
  // canvas top = the knot end; squash vertically so the glyph is not stretched along the tail
  ctx.save()
  ctx.translate(cw / 2, ch * 0.66)
  ctx.scale(1, ((ch / tail) / (cw / width)))
  ctx.fillStyle = '#f3ede4'
  ctx.font = `800 104px 'Fraunces', Georgia, serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('s', 0, 0)
  ctx.restore()
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 4
  const m = (velvetMat() as THREE.MeshPhysicalMaterial).clone()
  m.color.set(0xffffff)
  m.map = map
  logoTailMats.set(key, m)
  return m
}

/**
 * Velvet bow. `size` scales the ~2-unit-wide bow (0.28 ≈ 56 cm), `tail` is the tail length in
 * bow units, `logo` prints the Soko "s" on one tail as on the real large bows.
 */
export function createBow(size: number, tail: number, logo = false) {
  const bow = new THREE.Group()
  bow.name = 'bow'
  bow.add(new THREE.Mesh(bowGeometry(tail), velvetMat()))
  bow.add(new THREE.Mesh(rightTail(tail), logo ? logoTailMaterial(tail) : velvetMat()))
  bow.scale.setScalar(size)
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
