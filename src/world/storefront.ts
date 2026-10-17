// The Soko building as in docs/ref/storefront-night.png: dark rounded parapet band with the
// glowing sign and downlights, black shopfront with the lit interior, red standing-seam block and
// cream portico house above, piers, neighbours, street tree and paved sidewalk. All procedural.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { C, glowMat, standard } from '../core/materials'
import { createRng, gauss, range } from '../core/rng'
import { InstanceCollector } from '../decor/instancing'
import { FACADE, SIGN_X, bandOutline } from './facade'

const W = FACADE.halfWidth
const F = FACADE.front
const UP_Z = FACADE.upperWallZ
/** the cream house's sloped eave starts here and climbs to the right over the red block */
const EAVE_X = -1.05
const EAVE_Y = 6.3
const EAVE_SLOPE = 0.68

// ── helpers ──────────────────────────────────────────────────────────────────────────────────

/** Box from its min corner (x0, y0, z0) to its max corner (x1, y1, z1). */
function block(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, material: THREE.Material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), material)
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  return m
}

/** Box whose local origin is at (px, py, pz) of its own extent, so rotations pivot there. */
function pivotBox(w: number, h: number, d: number, px: number, py: number, material: THREE.Material) {
  const geo = new THREE.BoxGeometry(w, h, d)
  geo.translate(w / 2 - px, h / 2 - py, 0)
  return new THREE.Mesh(geo, material)
}

/** Extrudes a plan outline (x, z points) vertically from y0 to y1. */
function extrudePlan(pts: { x: number; z: number }[], y0: number, y1: number, material: THREE.Material) {
  const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, p.z)))
  const geo = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false })
  // shape (x, y) → world (x, z); extrusion +z → world −y, so the top face lands on y1
  geo.rotateX(Math.PI / 2)
  geo.translate(0, y1, 0)
  geo.computeVertexNormals()
  return new THREE.Mesh(geo, material)
}

/** Vertical wall swept along a plan polyline, with u = distance along it (for textures). */
function sweepWall(pts: { x: number; z: number }[], y0: number, y1: number, material: THREE.Material, flip = false) {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  let u = 0
  pts.forEach((p, i) => {
    if (i > 0) u += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z)
    pos.push(p.x, y0, p.z, p.x, y1, p.z)
    uv.push(u, 0, u, 1)
    if (i > 0) {
      const a = (i - 1) * 2
      if (flip) idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      else idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  })
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return new THREE.Mesh(geo, material)
}

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  draw(canvas.getContext('2d')!, w, h)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

function spot(color: number, intensity: number, from: THREE.Vector3Tuple, to: THREE.Vector3Tuple, angle: number, distance: number) {
  const s = new THREE.SpotLight(color, intensity, distance, angle, 1, 1.4)
  s.position.set(...from)
  s.target.position.set(...to)
  return [s, s.target] as const
}

// ── parapet band + sign ──────────────────────────────────────────────────────────────────────

function band() {
  const g = new THREE.Group()
  const dark = standard(C.band, 0.82)
  const trim = standard(C.bandTrim, 0.6)

  g.add(sweepWall(bandOutline(0, 18), FACADE.lipTop, FACADE.parapetTop, dark))
  g.add(sweepWall(bandOutline(-FACADE.bandThickness, 18), FACADE.lipTop, FACADE.parapetTop, dark, true))
  // rounded cap along the top, slightly proud of the face
  const capOuter = bandOutline(0.035, 18)
  const capInner = bandOutline(-FACADE.bandThickness - 0.02, 18).reverse()
  g.add(extrudePlan([...capOuter, ...capInner], FACADE.parapetTop, FACADE.capTop, trim))
  // light lip under the band, which is also the soffit over the shopfront
  g.add(extrudePlan(bandOutline(0.07, 18), FACADE.lipBottom, FACADE.lipTop, trim))

  // balcony floor behind the band
  g.add(block(-W + 0.1, FACADE.balconyFloor - 0.1, UP_Z, W - 0.1, FACADE.balconyFloor, F - 0.1, standard(0x3a3a3c, 0.9)))

  // downlights in the cap wash the band in soft scallops
  for (const x of [-2.9, 0, 2.87]) {
    g.add(...spot(0xfff0dc, 2.6, [x, FACADE.capTop - 0.04, F + 0.12], [x, FACADE.lipTop, F - 0.05], 0.95, 2.4))
  }
  return g
}

function signMesh() {
  const tex = canvasTexture(1400, 560, (ctx, w) => {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    // blue halo first, then the bright white face of the channel letters
    const passes = [[42, 'rgba(90,150,255,0.9)'], [14, 'rgba(170,205,255,0.9)'], [0, '#ffffff']] as const
    for (const [blur, color] of passes) {
      ctx.shadowColor = color
      ctx.shadowBlur = blur
      ctx.fillStyle = blur ? 'rgba(220,235,255,0.95)' : '#ffffff'
      ctx.font = `800 330px 'Fraunces', Georgia, serif`
      ctx.letterSpacing = '-4px'
      ctx.fillText('soko.', w / 2, 340)
      ctx.font = `700 74px 'Be Vietnam Pro', system-ui, sans-serif`
      ctx.letterSpacing = '7px'
      ctx.fillText('cafe.dine.brunch', w / 2 - 6, 470)
    }
  })
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: C.signWhite.clone().multiplyScalar(0.94) })
  mat.toneMapped = false
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.2), mat)
  sign.position.set(SIGN_X, 3.62, F + 0.012)
  const fill = new THREE.PointLight(0x9cbcff, 0.6, 2.2, 1.8)
  fill.position.set(SIGN_X, 3.6, F + 0.5)
  const g = new THREE.Group()
  g.add(sign, fill)
  return g
}

// ── shopfront + interior ─────────────────────────────────────────────────────────────────────

const RIGHT_WIN: [number, number] = [0.81, 4.04]
const LEFT_WIN: [number, number] = [-4.17, -2.38]
const DOOR: [number, number] = [-1.62, 0.05]

function interior() {
  const g = new THREE.Group()
  const back = -4.0
  const h = 2.55
  const x0 = -4.15
  const x1 = 4.0
  const white = new THREE.MeshStandardMaterial({ color: 0xf3e3c0, roughness: 0.8, emissive: 0xffc46e, emissiveIntensity: 0.16 })

  const room = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, -back), new THREE.MeshStandardMaterial({
    color: 0xeed8a8, roughness: 0.9, emissive: 0xffb04a, emissiveIntensity: 0.2, side: THREE.BackSide,
  }))
  room.position.set((x0 + x1) / 2, h / 2, back / 2)
  g.add(room)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, -back), standard(0xd9c7a8, 0.5))
  floor.rotation.x = -Math.PI / 2
  floor.position.set((x0 + x1) / 2, 0.005, back / 2)
  g.add(floor)

  // ceiling cove strips
  const cove = glowMat(C.interior, 1.5)
  for (const z of [-0.5, -1.6, -2.8]) g.add(block(x0 + 0.3, h - 0.05, z - 0.03, x1 - 0.3, h - 0.02, z + 0.03, cove))

  // right room: organic white arches receding into the space
  for (const z of [-1.3, -2.5]) {
    const shape = new THREE.Shape()
    shape.moveTo(RIGHT_WIN[0], 0)
    shape.lineTo(x1, 0)
    shape.lineTo(x1, h)
    shape.lineTo(RIGHT_WIN[0], h)
    shape.closePath()
    for (const [cx, hw] of [[1.65, 0.62], [3.1, 0.7]]) {
      const hole = new THREE.Path()
      hole.moveTo(cx - hw, 0)
      hole.lineTo(cx + hw, 0)
      hole.lineTo(cx + hw, 1.25)
      hole.absellipse(cx, 1.25, hw, 0.95, 0, Math.PI, false)
      hole.lineTo(cx - hw, 0)
      shape.holes.push(hole)
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 3 })
    const panel = new THREE.Mesh(geo, white)
    panel.position.z = z
    g.add(panel)
  }
  // glowing oval porthole on the right wall
  const oval = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), glowMat(new THREE.Color(1.0, 0.85, 0.5), 1.3))
  oval.scale.set(0.55, 1, 1)
  oval.rotation.y = -Math.PI / 2
  oval.position.set(x1 - 0.02, 1.45, -0.7)
  g.add(oval)

  // left room: oval mirror on the side wall, lit stair treads at the back
  const mirror = new THREE.Mesh(new THREE.CircleGeometry(0.5, 40), new THREE.MeshStandardMaterial({ color: 0xc9c2b0, roughness: 0.08, metalness: 1, envMapIntensity: 3 }))
  mirror.scale.set(0.55, 1, 1)
  mirror.rotation.y = Math.PI / 2
  mirror.position.set(x0 + 0.03, 1.5, -0.55)
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.045, 8, 48), white)
  frame.scale.set(0.55, 1, 1)
  frame.rotation.y = Math.PI / 2
  frame.position.copy(mirror.position)
  g.add(mirror, frame)
  const tread = glowMat(new THREE.Color(1, 0.9, 0.7), 1.6)
  for (let i = 0; i < 6; i++) {
    const y = 1.5 + i * 0.17
    g.add(block(-3.15, y, -2.6 + i * 0.05, -2.45, y + 0.04, -2.2 + i * 0.05, i % 2 ? white : tread))
  }

  // furniture: red sofas, cream stools, tables with small topiary cones
  const red = new THREE.MeshStandardMaterial({ color: C.sofa, roughness: 0.65 })
  const stool = standard(0xe8dcc6, 0.7)
  const leg = standard(0x2a2a2a, 0.5, 0.6)
  const sofa = (sx0: number, sx1: number, z: number, depth = 0.6) => {
    const seat = new THREE.Mesh(new RoundedBoxGeometry(sx1 - sx0, 0.45, depth, 3, 0.08), red)
    seat.position.set((sx0 + sx1) / 2, 0.225, z)
    const backrest = new THREE.Mesh(new RoundedBoxGeometry(sx1 - sx0, 0.5, 0.18, 3, 0.07), red)
    backrest.position.set((sx0 + sx1) / 2, 0.6, z - depth / 2 + 0.09)
    g.add(seat, backrest)
  }
  sofa(-4.05, -3.0, -1.0)
  sofa(1.0, 3.95, -3.55)
  sofa(2.6, 3.95, -1.9, 0.5)

  for (const win of [LEFT_WIN, RIGHT_WIN]) {
    for (let x = win[0] + 0.35; x < win[1] - 0.2; x += 0.62) {
      const top = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.1, 0.42, 2, 0.03), stool)
      top.position.set(x, 0.62, -0.42)
      g.add(top, block(x - 0.02, 0, -0.44, x + 0.02, 0.58, -0.4, leg))
    }
  }

  const topiary = standard(0x24502a, 0.9)
  const tableMat = standard(0xeee3cf, 0.6)
  const pot = standard(0xd8cbb3, 0.6)
  const rng = createRng(182)
  const tables = [[1.2, -1.0], [1.9, -1.9], [2.6, -1.0], [3.3, -2.2], [1.4, -2.9], [2.3, -3.0], [3.6, -1.2], [2.9, -2.9], [1.0, -2.2], [3.7, -3.1]]
  for (const [x, z] of tables) {
    g.add(block(x - 0.25, 0.7, z - 0.25, x + 0.25, 0.74, z + 0.25, tableMat), block(x - 0.03, 0, z - 0.03, x + 0.03, 0.7, z + 0.03, leg))
    const hgt = range(rng, 0.35, 0.6)
    const cone = new THREE.Mesh(new THREE.ConeGeometry(hgt * 0.3, hgt, 10), topiary)
    cone.position.set(x, 0.82 + hgt / 2, z)
    g.add(cone, block(x - 0.05, 0.74, z - 0.05, x + 0.05, 0.82, z + 0.05, pot))
  }

  // the light inside spills onto the sidewalk too (no shadows)
  for (const x of [-3.2, -0.8, 1.6, 3.3]) {
    const light = new THREE.PointLight(0xffb14f, 2.6, 7, 1.6)
    light.position.set(x, 2.2, -1.6)
    g.add(light)
  }
  return g
}

function shopfront() {
  const g = new THREE.Group()
  const black = standard(C.frame, 0.55, 0.2)
  const H = FACADE.groundHeight
  const z0 = -0.06
  const z1 = 0.1

  g.add(interior())

  // kick plate, head beam, the two black piers either side of the door
  g.add(block(-W, 0, z0, RIGHT_WIN[1], 0.3, z1, black))
  g.add(block(-W, H - 0.12, z0, RIGHT_WIN[1], H, z1, black))
  g.add(block(LEFT_WIN[1], 0, z0, DOOR[0], H, z1 + 0.02, black))
  g.add(block(DOOR[1], 0, z0, RIGHT_WIN[0], H, z1 + 0.02, black))
  // window jambs and the mullion in the big window
  for (const x of [LEFT_WIN[0], RIGHT_WIN[1] - 0.05, 2.37]) g.add(block(x, 0.3, z0, x + 0.06, H, z1 - 0.03, black))
  // counter-height ledge behind the glass
  for (const win of [LEFT_WIN, RIGHT_WIN]) g.add(block(win[0], 0.95, -0.25, win[1], 1.03, -0.05, black))

  // double door: thick black leaves with glass, transom above
  const doorTop = 2.28
  g.add(block(DOOR[0], doorTop, z0, DOOR[1], H, z1, black))
  const leafW = (DOOR[1] - DOOR[0] - 0.12) / 2
  const handle = standard(0x1a1a1a, 0.3, 0.8)
  for (let i = 0; i < 2; i++) {
    const lx = DOOR[0] + 0.06 + i * leafW
    g.add(block(lx, 0, -0.02, lx + 0.1, doorTop, 0.06, black), block(lx + leafW - 0.1, 0, -0.02, lx + leafW, doorTop, 0.06, black))
    g.add(block(lx, 0, -0.02, lx + leafW, 0.32, 0.06, black), block(lx, doorTop - 0.12, -0.02, lx + leafW, doorTop, 0.06, black))
    const hx = i === 0 ? lx + leafW - 0.16 : lx + 0.13
    g.add(block(hx, 0.85, 0.06, hx + 0.025, 1.5, 0.09, handle))
  }
  g.add(block(DOOR[0], 0, -0.02, DOOR[0] + 0.06, doorTop, 0.06, black), block(DOOR[1] - 0.06, 0, -0.02, DOOR[1], doorTop, 0.06, black))
  // red "soko's" sticker on the right leaf
  const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.3), new THREE.MeshStandardMaterial({
    map: canvasTexture(256, 200, (ctx, w, h) => {
      ctx.fillStyle = '#c8141c'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#fff'
      ctx.font = `800 74px 'Fraunces', Georgia, serif`
      ctx.textAlign = 'center'
      ctx.fillText("soko's", w / 2, 92)
      ctx.font = `600 26px 'Be Vietnam Pro', sans-serif`
      ctx.fillText('cafe.dine.brunch', w / 2, 150)
    }),
    emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.6,
  }))
  sticker.position.set(DOOR[0] + 0.06 + leafW * 1.5, 1.05, 0.065)
  g.add(sticker)

  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.1, depthWrite: false, envMapIntensity: 2 })
  const panes: [number, number][] = [LEFT_WIN, RIGHT_WIN, [DOOR[0] + 0.06, DOOR[1] - 0.06]]
  for (const [a, b] of panes) {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(b - a, H - 0.42), glass)
    pane.position.set((a + b) / 2, 0.3 + (H - 0.42) / 2, 0.01)
    g.add(pane)
  }
  return g
}

// ── upper floors ─────────────────────────────────────────────────────────────────────────────

function redBlock() {
  const g = new THREE.Group()
  const red = new THREE.MeshStandardMaterial({ color: C.redCladding, roughness: 0.55, metalness: 0.1 })
  const seam = new THREE.MeshStandardMaterial({ color: 0xc92a33, roughness: 0.45, metalness: 0.15 })
  const x0 = -3.52
  const x1 = -0.02
  const z = -1.0
  g.add(block(x0, FACADE.balconyFloor, z - 0.6, x1, 11, z, red))
  // standing seams every ~0.42 m and a horizontal joint between the panel tiers
  for (let x = x0 + 0.42; x < x1 - 0.1; x += 0.42) g.add(block(x - 0.012, FACADE.balconyFloor, z, x + 0.012, 11, z + 0.03, seam))
  g.add(block(x0, 6.42, z, x1, 6.47, z + 0.035, seam))
  // black-framed window in the upper tier
  const dark = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.2, metalness: 0.2, emissive: 0x2a2016, emissiveIntensity: 0.3 })
  const frame = standard(0x111214, 0.5, 0.3)
  g.add(block(-2.42, 6.5, z, -0.76, 7.35, z + 0.06, frame), block(-2.36, 6.56, z + 0.02, -0.82, 7.29, z + 0.07, dark))
  g.add(block(-1.6, 6.56, z + 0.06, -1.56, 7.29, z + 0.08, frame))
  // round illuminated logo at the top corner
  const logoMat = new THREE.MeshBasicMaterial({
    map: canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#1e3a8a'
      ctx.font = `800 170px 'Fraunces', Georgia, serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('s', w / 2, h / 2 + 6)
    }),
    color: new THREE.Color(0.8, 0.8, 0.8),
  })
  logoMat.toneMapped = false
  const logo = new THREE.Mesh(new THREE.CircleGeometry(0.42, 48), logoMat)
  logo.position.set(-2.9, 7.95, z + 0.08)
  g.add(logo)
  return g
}

function creamHouse() {
  const g = new THREE.Group()
  const cream = new THREE.MeshStandardMaterial({ color: C.creamWall, roughness: 0.9 })
  const trimWhite = standard(0xf4efe4, 0.7)
  const timber = standard(0x3a2a20, 0.75)
  const darkRoof = standard(0x202124, 0.8)
  const z = UP_Z

  // gable wall: its top-left edge runs up under the sloped eave
  const eaveAt = (x: number) => EAVE_Y + Math.tan(EAVE_SLOPE) * (x - EAVE_X)
  const gable = new THREE.Shape([
    new THREE.Vector2(-0.02, FACADE.balconyFloor), new THREE.Vector2(4.7, FACADE.balconyFloor),
    new THREE.Vector2(4.7, eaveAt(4.7)), new THREE.Vector2(-0.02, eaveAt(-0.02)),
  ])
  const wall = new THREE.Mesh(new THREE.ExtrudeGeometry(gable, { depth: 0.8, bevelEnabled: false }), cream)
  wall.position.z = z - 0.8
  g.add(wall)

  // arched window: dark night glass with a mullion grid
  const cx = 2.18
  const r = 0.88
  const spring = 4.95
  const arch = new THREE.Shape()
  arch.moveTo(cx - r, FACADE.balconyFloor)
  arch.lineTo(cx + r, FACADE.balconyFloor)
  arch.lineTo(cx + r, spring)
  arch.absarc(cx, spring, r, 0, Math.PI, false)
  arch.lineTo(cx - r, FACADE.balconyFloor)
  const glass = new THREE.Mesh(new THREE.ShapeGeometry(arch, 32), new THREE.MeshStandardMaterial({
    color: 0x14171c, roughness: 0.1, metalness: 0.6, emissive: 0x3a2a18, emissiveIntensity: 0.35,
  }))
  glass.position.z = z + 0.01
  g.add(glass)
  const mull = standard(0x1a1b1e, 0.5, 0.3)
  g.add(block(cx - 0.025, FACADE.balconyFloor, z, cx + 0.025, spring + r, z + 0.05, mull))
  g.add(block(cx - r, spring - 0.02, z, cx + r, spring + 0.02, z + 0.05, mull))
  for (const a of [Math.PI / 4, (3 * Math.PI) / 4]) {
    const bar = pivotBox(0.04, r, 0.05, 0.02, 0, mull)
    bar.position.set(cx, spring, z + 0.025)
    bar.rotation.z = a - Math.PI / 2
    g.add(bar)
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.04, 0.05, 6, 40, Math.PI), trimWhite)
  ring.position.set(cx, spring, z + 0.03)
  g.add(ring)

  // portico: two cream pillars carrying a wide white arch, a dark canopy roof above
  const pz0 = z + 0.25
  const pz1 = z + 0.6
  for (const px of [0.72, 3.72]) g.add(block(px, FACADE.balconyFloor, pz0, px + 0.2, 6.35, pz1, trimWhite))
  const archPanel = new THREE.Shape()
  archPanel.moveTo(0.62, 5.6)
  archPanel.lineTo(4.02, 5.6)
  archPanel.lineTo(4.02, 6.38)
  archPanel.lineTo(0.62, 6.38)
  archPanel.closePath()
  const hole = new THREE.Path()
  hole.moveTo(0.92, 5.6)
  hole.lineTo(3.72, 5.6)
  hole.absellipse(2.32, 5.6, 1.4, 0.55, 0, Math.PI, false)
  hole.lineTo(0.92, 5.6)
  archPanel.holes.push(hole)
  const archMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(archPanel, { depth: 0.2, bevelEnabled: false }), trimWhite)
  archMesh.position.z = pz0 + 0.1
  g.add(archMesh)
  // timber brace at the left pillar
  const brace = pivotBox(0.06, 0.9, 0.08, 0.03, 0.45, timber)
  brace.position.set(0.98, 5.95, pz1)
  brace.rotation.z = -0.7
  g.add(brace)
  // dark canopy roof, tilted down towards the street
  const canopy = pivotBox(3.75, 0.16, 1.15, 0, 0, darkRoof)
  canopy.position.set(0.5, 6.38, z + 0.3)
  canopy.rotation.x = 0.18
  g.add(canopy)

  // wooden balcony with X railing above the portico
  g.add(block(1.4, 6.62, z, 3.15, 6.72, z + 0.55, timber))
  const railZ = z + 0.52
  g.add(block(1.4, 7.25, railZ, 3.15, 7.3, railZ + 0.05, timber), block(1.4, 6.72, railZ, 3.15, 6.76, railZ + 0.05, timber))
  const bays = 4
  const bw = (3.15 - 1.4) / bays
  for (let i = 0; i <= bays; i++) g.add(block(1.4 + i * bw - 0.025, 6.72, railZ, 1.4 + i * bw + 0.025, 7.3, railZ + 0.05, timber))
  for (let i = 0; i < bays; i++) {
    const mx = 1.4 + (i + 0.5) * bw
    const len = Math.hypot(bw, 0.5)
    for (const s of [1, -1]) {
      const bar = pivotBox(len, 0.03, 0.04, len / 2, 0.015, timber)
      bar.position.set(mx, 7.01, railZ + 0.02)
      bar.rotation.z = s * Math.atan2(0.5, bw)
      g.add(bar)
    }
  }

  // sloped eave with white rafter tails running up over the red block
  const eaveLen = 7.5
  // overhangs from behind the gable to just in front of the red block
  const eaveZ0 = z - 0.2
  const eaveZ1 = -0.75
  const eave = pivotBox(eaveLen, 0.2, eaveZ1 - eaveZ0, 0, 0.1, darkRoof)
  eave.position.set(EAVE_X, EAVE_Y + 0.08, (eaveZ0 + eaveZ1) / 2)
  eave.rotation.z = EAVE_SLOPE
  g.add(eave)
  for (let i = 1; i < 14; i++) {
    const t = (i / 14) * eaveLen * 0.6
    g.add(block(-0.035, -0.24, -0.9, 0.035, 0, -0.8, trimWhite).translateX(EAVE_X + Math.cos(EAVE_SLOPE) * t).translateY(EAVE_Y + Math.sin(EAVE_SLOPE) * t))
  }
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.22, 16), standard(0xd9d9d9, 0.4, 0.6))
  lamp.position.set(-0.62, 6.5, -0.6)
  lamp.rotation.z = Math.PI / 2
  g.add(lamp)

  // warm uplights make the portico glow
  g.add(...spot(0xffc77a, 6, [1.2, FACADE.balconyFloor + 0.1, z + 0.9], [1.4, 6.4, z], 0.9, 4.5))
  g.add(...spot(0xffc77a, 6, [3.3, FACADE.balconyFloor + 0.1, z + 0.9], [3.1, 6.4, z], 0.9, 4.5))
  const under = new THREE.PointLight(0xffc06a, 1.4, 3, 1.6)
  under.position.set(2.3, 6.0, z + 0.5)
  g.add(under)
  return g
}

// ── piers, neighbours, street ────────────────────────────────────────────────────────────────

function piers() {
  const g = new THREE.Group()
  const grey = standard(C.pierGrey, 0.9)
  g.add(block(-4.78, 0, -0.4, -W, 4.5, 0.12, grey))
  g.add(block(RIGHT_WIN[1], 0, -0.4, 4.7, 4.45, 0.12, standard(C.pierBeige, 0.85)))
  // house number
  const num = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.16), new THREE.MeshStandardMaterial({
    map: canvasTexture(180, 80, (ctx, w, h) => {
      ctx.fillStyle = '#2a2622'
      ctx.font = `700 56px 'Be Vietnam Pro', sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('182', w / 2, h / 2)
    }),
    transparent: true,
  }))
  num.position.set(4.37, 1.55, 0.125)
  g.add(num)
  // small wall box on the left pier
  g.add(block(-4.62, 1.5, 0.12, -4.5, 2.2, 0.18, standard(0xcfcac0, 0.6)))
  return g
}

function neighbours() {
  const g = new THREE.Group()
  g.add(block(-11, 0, -3, -4.78, 9.5, -0.2, standard(0x5a554d, 0.95)))
  g.add(block(-4.78, 4.5, -2.4, -3.52, 7.6, -1.2, standard(0x3a3835, 0.95)))
  const win = new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.3, emissive: 0xffb060, emissiveIntensity: 0.02 })
  const grille = standard(0x2a2724, 0.7)
  for (const y of [5.2, 8.2]) {
    g.add(block(-6.4, y, -0.22, -5.2, y + 1.6, -0.16, win))
    for (let x = -6.35; x < -5.2; x += 0.12) g.add(block(x, y, -0.16, x + 0.02, y + 1.6, -0.12, grille))
  }
  g.add(block(-5.8, 2.8, -0.2, -5.0, 3.4, 0.25, standard(0x9a9790, 0.6)))
  // building beyond the street tree, with a few entrance steps
  g.add(block(4.7, 0, -2.5, 12, 9, -0.4, standard(0x6d685f, 0.9)))
  const step = standard(0x8f8a82, 0.8)
  for (let i = 0; i < 4; i++) g.add(block(6.0, i * 0.17, -0.4 - (3 - i) * 0.28, 8, (i + 1) * 0.17, -0.4 - (2 - i) * 0.28, step))
  return g
}

let leafTex: THREE.Texture | null = null
function leafTexture() {
  return (leafTex ??= canvasTexture(64, 128, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(w / 2, h - 2)
    ctx.bezierCurveTo(w * 0.05, h * 0.65, w * 0.1, h * 0.2, w / 2, 2)
    ctx.bezierCurveTo(w * 0.9, h * 0.2, w * 0.95, h * 0.65, w / 2, h - 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(w / 2, h - 2)
    ctx.lineTo(w / 2, 8)
    ctx.stroke()
  }))
}

/** The big street tree at the right: feathery drooping branchlets of instanced leaf cards. */
function streetTree() {
  const g = new THREE.Group()
  const rng = createRng(77)
  const trunkMat = standard(0x1c1815, 0.95)
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 6.5, 12), trunkMat)
  trunk.position.set(5.3, 3.25, 2.9)
  g.add(trunk)
  for (const [ax, az, len] of [[-0.9, 0.2, 2.6], [0.5, -0.3, 2.2], [-0.4, -0.6, 2.4]]) {
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, len, 8), trunkMat)
    limb.position.set(5.3 - Math.sin(ax) * len * 0.5, 5.6 + Math.cos(ax) * len * 0.5, 2.9 + az * len * 0.3)
    limb.rotation.set(az, 0, ax)
    g.add(limb)
  }

  const leafGeo = new THREE.PlaneGeometry(0.065, 0.15)
  leafGeo.translate(0, 0.075, 0)
  const mat = new THREE.MeshStandardMaterial({ map: leafTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.75 })
  const leaves = new InstanceCollector(leafGeo, mat)
  const centre = new THREE.Vector3(5.7, 6.9, 2.6)
  const base = new THREE.Color(C.leaf)
  for (let b = 0; b < 460; b++) {
    const p = new THREE.Vector3(gauss(rng) * 2.0, gauss(rng) * 1.9, gauss(rng) * 1.3).add(centre)
    if (p.x < 3.2) p.x = 3.2 + rng() * 0.6
    if (p.y < 3.4) p.y = 3.4 + rng() * 0.8
    const out = p.clone().sub(centre).setY(0).normalize()
    const dir = new THREE.Vector3(out.x + gauss(rng) * 0.5, -0.15, out.z + gauss(rng) * 0.5).normalize()
    const side = new THREE.Vector3(0, 1, 0).cross(dir).normalize()
    const len = range(rng, 0.5, 0.95)
    const pairs = 14
    for (let i = 0; i < pairs; i++) {
      const s = (i / pairs) * len
      const at = p.clone().addScaledVector(dir, s).add(new THREE.Vector3(0, -0.35 * s * s, 0))
      for (const k of [1, -1]) {
        const leafDir = side.clone().multiplyScalar(k).addScaledVector(dir, 0.6).add(new THREE.Vector3(0, -0.25, 0)).normalize()
        const color = base.clone().multiplyScalar(0.7 + rng() * 0.5).offsetHSL(gauss(rng) * 0.02, 0, 0)
        leaves.add(at, { dir: leafDir, spin: rng() * Math.PI, scale: range(rng, 0.8, 1.25), color })
      }
    }
  }
  g.add(leaves.build('street-tree'))
  // the street lamp that lights it from below right
  const lamp = new THREE.PointLight(0xfff2d6, 16, 10, 1.4)
  lamp.position.set(6.6, 4.0, 5.0)
  g.add(lamp)
  return g
}

function street() {
  const g = new THREE.Group()
  const pavers = canvasTexture(512, 512, (ctx, w, h) => {
    const rng = createRng(9)
    ctx.fillStyle = '#5d564f'
    ctx.fillRect(0, 0, w, h)
    const rows = 8
    const cols = 4
    const bh = h / rows
    const bw = w / cols
    for (let r = 0; r < rows; r++) {
      for (let c = -1; c < cols; c++) {
        const x = c * bw + (r % 2 ? bw / 2 : 0)
        const v = 120 + Math.floor(rng() * 30)
        ctx.fillStyle = `rgb(${v + 14},${v + 4},${v - 6})`
        ctx.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6)
      }
    }
  })
  pavers.wrapS = pavers.wrapT = THREE.RepeatWrapping
  pavers.repeat.set(30 / 1.2, 3.4 / 0.6)
  const walk = new THREE.Mesh(new THREE.PlaneGeometry(30, 3.4), new THREE.MeshStandardMaterial({ map: pavers, roughness: 0.85 }))
  walk.rotation.x = -Math.PI / 2
  walk.position.set(0, 0, 1.8)
  g.add(walk)
  // granite plinth along the building, curb, asphalt
  g.add(block(-15, -0.01, 0.1, 15, 0.04, 0.35, standard(0x2c2b2a, 0.6)))
  g.add(block(-15, -0.15, 3.5, 15, 0.0, 3.72, standard(0x8a8680, 0.8)))
  const road = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), standard(C.street, 0.6))
  road.rotation.x = -Math.PI / 2
  road.position.set(0, -0.15, 23.7)
  g.add(road)
  return g
}

export function createStorefront() {
  const g = new THREE.Group()
  g.name = 'storefront'
  g.add(street(), neighbours(), piers(), shopfront(), band(), signMesh(), redBlock(), creamHouse(), streetTree())
  return g
}
