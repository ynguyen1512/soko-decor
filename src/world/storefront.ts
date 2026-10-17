// The Soko building: curved balcony parapet with the glowing sign, the lit shopfront with its
// interior, the upper floors, neighbours and the street. Everything is procedural.
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { C, glowMat, standard } from '../core/materials'
import { FACADE, frontZ } from './facade'

const W = FACADE.halfWidth

function box(w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  m.position.set(x, y + h / 2, z)
  return m
}

/** Plan-shaped slab (front arc → back wall at z = 0) between y0 and y1. */
function planSlab(y0: number, y1: number, outset: number, material: THREE.Material) {
  const shape = new THREE.Shape()
  const hw = W + outset
  shape.moveTo(-hw, 0)
  const steps = 48
  for (let i = 0; i <= steps; i++) {
    const x = -hw + (2 * hw * i) / steps
    shape.lineTo(x, frontZ(x, outset))
  }
  shape.lineTo(hw, 0)
  shape.closePath()
  return extrudeUp(shape, y0, y1, material)
}

/** The parapet band: a U-shaped wall following the front arc and returning to the facade. */
function parapetBand(material: THREE.Material) {
  const t = FACADE.bandThickness
  const shape = new THREE.Shape()
  const steps = 64
  shape.moveTo(-W, 0)
  for (let i = 0; i <= steps; i++) {
    const x = -W + (2 * W * i) / steps
    shape.lineTo(x, frontZ(x))
  }
  shape.lineTo(W, 0)
  shape.lineTo(W - t, 0)
  for (let i = steps; i >= 0; i--) {
    const x = -(W - t) + (2 * (W - t) * i) / steps
    shape.lineTo(x, frontZ(x, -t))
  }
  shape.lineTo(-(W - t), 0)
  shape.closePath()
  return extrudeUp(shape, FACADE.slabTop, FACADE.parapetTop, material)
}

/** Extrudes a shape drawn in (x, z) plan coordinates vertically from y0 to y1. */
function extrudeUp(shape: THREE.Shape, y0: number, y1: number, material: THREE.Material) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false, curveSegments: 4 })
  // shape (x, y) → world (x, z); extrusion +z → world −y, so the top face lands on y1
  geo.rotateX(Math.PI / 2)
  geo.translate(0, y1, 0)
  geo.computeVertexNormals()
  return new THREE.Mesh(geo, material)
}

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  draw(ctx)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function signMesh() {
  const tex = canvasTexture(1024, 384, (ctx) => {
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.font = `700 230px 'Fraunces', Georgia, serif`
    ctx.fillText('soko.', 512, 250)
    ctx.font = `600 46px 'JetBrains Mono', ui-monospace, monospace`
    ctx.letterSpacing = '6px'
    ctx.fillText('cafe.bake.brunch', 512, 330)
  })
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, color: C.signBlue.clone().multiplyScalar(1.4),
  })
  mat.toneMapped = false
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.825), mat)
  sign.position.set(0, 3.82, frontZ(0) + 0.012)
  return sign
}

/** Warm interior behind the glass: walls, ceiling light strips, arches, tables and red chairs. */
function interior() {
  const g = new THREE.Group()
  const depth = 3.2
  const back = FACADE.shopfrontZ - depth
  const h = FACADE.groundHeight - 0.25

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf2dfbd, roughness: 0.9, emissive: 0xffc070, emissiveIntensity: 0.55 })
  const room = new THREE.Mesh(new THREE.BoxGeometry(2 * W - 0.4, h, depth), new THREE.MeshStandardMaterial({
    color: 0xf2dfbd, roughness: 0.9, emissive: 0xffb860, emissiveIntensity: 0.35, side: THREE.BackSide,
  }))
  room.position.set(0, h / 2, back + depth / 2)
  g.add(room)

  // cream arches on the back wall
  for (const x of [-3.0, -1.6, 1.6, 3.0]) {
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.09, 8, 24, Math.PI), wallMat)
    arch.position.set(x, 1.55, back + 0.08)
    g.add(arch)
    g.add(box(0.18, 1.55, 0.16, x - 0.42, 0, back + 0.08, wallMat), box(0.18, 1.55, 0.16, x + 0.42, 0, back + 0.08, wallMat))
  }

  // ceiling light strips
  const strip = glowMat(C.interior, 2.2)
  for (const z of [back + 0.8, back + 1.9]) g.add(box(2 * W - 1.2, 0.03, 0.08, 0, h - 0.04, z, strip))

  // tables + red chairs
  const tableMat = standard(0xe9dcc6, 0.6)
  const chairMat = standard(0xb4161d, 0.6)
  for (const x of [-3.2, -1.9, 1.9, 3.2]) {
    const z = back + 1.6
    g.add(box(0.06, 0.72, 0.06, x, 0, z, tableMat), box(0.6, 0.04, 0.6, x, 0.72, z, tableMat))
    g.add(box(0.4, 0.45, 0.4, x - 0.45, 0, z, chairMat), box(0.4, 0.45, 0.4, x + 0.45, 0, z, chairMat))
  }

  // floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * W - 0.4, depth), standard(0x9c7a58, 0.7))
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, 0.005, back + depth / 2)
  g.add(floor)

  // the light inside spills onto the sidewalk as well (no shadows)
  for (const x of [-2.6, 0, 2.6]) {
    const light = new THREE.PointLight(0xffb15e, 5, 7, 1.6)
    light.position.set(x, 2.2, back + 1.6)
    g.add(light)
  }
  return g
}

function shopfront() {
  const g = new THREE.Group()
  const frame = standard(C.frame, 0.6, 0.3)
  const z = FACADE.shopfrontZ
  const H = FACADE.groundHeight

  g.add(interior())

  // frame: side piers, top beam, kick plate, door mullions
  g.add(box(0.35, H, 0.5, -W + 0.175, 0, z, frame), box(0.35, H, 0.5, W - 0.175, 0, z, frame))
  g.add(box(2 * W, 0.3, 0.5, 0, H - 0.3, z, frame), box(2 * W, 0.32, 0.5, 0, 0, z, frame))
  for (const x of [-1.05, -0.95, 0.95, 1.05]) g.add(box(0.08, H - 0.3, 0.3, x, 0, z, frame))
  g.add(box(0.06, H - 0.3, 0.2, 0, 0, z + 0.05, frame))
  for (const x of [-0.12, 0.12]) g.add(box(0.03, 0.9, 0.05, x, 0.8, z + 0.2, standard(0xb8b8b8, 0.3, 0.9)))
  // thin transom bars
  g.add(box(2 * W - 0.7, 0.05, 0.1, 0, 2.38, z, frame))

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * W - 0.7, H - 0.6),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.12, depthWrite: false }),
  )
  glass.position.set(0, 0.32 + (H - 0.6) / 2, z)
  g.add(glass)
  return g
}

function upperFloors() {
  const g = new THREE.Group()
  const red = standard(C.redWall, 0.75)
  const cream = standard(C.creamWall, 0.85)
  const dark = standard(C.frame, 0.6, 0.3)
  const y0 = FACADE.slabTop
  const top = FACADE.upperTop

  // red cladding (left) with horizontal panel joints
  g.add(box(4.9, top - y0, 0.3, -W + 2.45, y0, -0.15, red))
  for (let y = y0 + 1.1; y < top; y += 1.1) g.add(box(4.9, 0.03, 0.04, -W + 2.45, y, 0.01, standard(0x6e1f27, 0.8)))

  // cream bay (right) with the warm arched window
  g.add(box(3.5, top - y0, 0.3, W - 1.75, y0, -0.15, cream))
  const arch = new THREE.Shape()
  const aw = 1.05
  const ay0 = 4.55
  const ay1 = 7.3
  arch.moveTo(-aw, ay0)
  arch.lineTo(aw, ay0)
  arch.lineTo(aw, ay1)
  arch.absarc(0, ay1, aw, 0, Math.PI, false)
  arch.lineTo(-aw, ay0)
  const winMat = new THREE.MeshStandardMaterial({ color: 0x2a1a10, emissive: 0xffb257, emissiveIntensity: 0.85 })
  const win = new THREE.Mesh(new THREE.ShapeGeometry(arch, 24), winMat)
  win.position.set(2.45, 0, 0.02)
  g.add(win)
  // window mullions
  g.add(box(0.06, ay1 + aw - ay0, 0.05, 2.45, ay0, 0.05, dark))
  for (const y of [5.5, 6.5]) g.add(box(2 * aw, 0.05, 0.05, 2.45, y, 0.05, dark))

  // top-floor balcony slab + railing
  g.add(box(2 * W + 0.2, 0.18, 1.0, 0, 7.9, 0.5, standard(0xdedad2, 0.8)))
  const rail = standard(0x2b2b2e, 0.5, 0.5)
  g.add(box(2 * W + 0.2, 0.05, 0.05, 0, 8.95, 0.98, rail))
  for (let x = -W; x <= W + 0.01; x += 0.14) g.add(box(0.025, 0.9, 0.025, x, 8.08, 0.98, rail))

  // balcony floor behind the parapet (the trees stand on it)
  g.add(planSlab(FACADE.balconyFloor - 0.05, FACADE.balconyFloor, -0.05, standard(0x7a756e, 0.9)))
  return g
}

function neighbours() {
  const g = new THREE.Group()
  const wall = standard(C.neighbour, 0.9)
  g.add(box(6, 11, 6, -W - 3.1, 0, -2.6, wall))
  const dim = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: 0xffc27a, emissiveIntensity: 0.03 })
  for (const y of [4.3, 6.8, 9.2]) g.add(box(0.7, 1.0, 0.05, -W - 1.4, y, 0.42, dim))
  g.add(box(5, 13, 6, W + 3.6, 0, -3.0, standard(0x2e2c2b, 0.9)))

  // big street tree on the right
  const leaf = standard(0x10200f, 0.95)
  const blobs: THREE.BufferGeometry[] = []
  const seeds = [[0, 6.2, 0, 1.9], [0.9, 7.4, -0.3, 1.5], [-0.6, 7.8, 0.2, 1.4], [0.4, 5.2, 0.6, 1.3], [-0.2, 8.8, -0.2, 1.1]]
  for (const [x, y, z, r] of seeds) {
    const s = new THREE.IcosahedronGeometry(r, 1)
    s.translate(x, y, z)
    blobs.push(s)
  }
  const crown = new THREE.Mesh(mergeGeometries(blobs), leaf)
  crown.position.set(W + 1.6, 0, 2.6)
  const trunk = box(0.3, 5, 0.3, W + 1.6, 0, 2.6, standard(0x1d1612, 0.9))
  g.add(crown, trunk)
  return g
}

function street() {
  const g = new THREE.Group()
  const road = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), standard(C.street, 0.55))
  road.rotation.x = -Math.PI / 2
  road.position.set(0, 0, 10)
  g.add(road)
  g.add(box(30, 0.12, 4.2, 0, 0, 2.4, standard(C.sidewalk, 0.8)))
  g.add(box(30, 0.14, 0.18, 0, 0, 4.5, standard(0x4a4a4e, 0.7)))
  return g
}

export function createStorefront() {
  const g = new THREE.Group()
  g.name = 'storefront'
  const concrete = standard(C.concrete, 0.8)

  g.add(street(), neighbours(), shopfront(), upperFloors())
  g.add(planSlab(FACADE.groundHeight, FACADE.slabTop, 0, concrete))
  g.add(parapetBand(concrete))
  g.add(planSlab(FACADE.parapetTop, FACADE.parapetTop + 0.05, 0.03, standard(0xd9d4cb, 0.7)))
  g.add(signMesh())

  // cool spill from the sign onto the band
  const signLight = new THREE.PointLight(0x9cbcff, 0.7, 2.6, 1.8)
  signLight.position.set(0, 3.8, frontZ(0) + 0.6)
  g.add(signLight)
  return g
}
