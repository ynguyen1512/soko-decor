// Facade dimensions (metres), measured off the reference photo (band ≈ 8.4 m ≈ 1105 px, so
// ≈ 131 px/m). x → right, y → up, z → street. The parapet band is the origin in x.
// Change these once the real measurements are known: decor and the materials estimate follow.

export const FACADE = {
  /** half length of the dark parapet band */
  halfWidth: 4.2,
  /** plan radius of the band's rounded ends */
  cornerRadius: 0.42,
  /** z of the band's front face */
  front: 0.4,
  /** the band returns back to the facade piers at this z */
  back: -0.1,
  bandThickness: 0.12,
  /** top of the black shopfront frame */
  groundHeight: 2.62,
  /** light trim under the band */
  lipBottom: 2.62,
  lipTop: 2.75,
  parapetTop: 4.6,
  capTop: 4.68,
  balconyFloor: 4.25,
  /** the trees stand in planters whose tops sit just behind the band cap */
  treeBase: 4.6,
  /** setback of the upper floors behind the band */
  upperWallZ: -1.6,
} as const

const W = FACADE.halfWidth
const R = FACADE.cornerRadius
const F = FACADE.front

/** z of the band's outer face at x (offset > 0 grows the outline outward). */
export function frontZ(x: number, offset = 0): number {
  const inner = W - R
  const ax = Math.abs(x)
  if (ax <= inner) return F + offset
  const r = R + offset
  const dx = Math.min(ax - inner, r)
  return F - R + Math.sqrt(Math.max(0, r * r - dx * dx))
}

/** Outward unit normal (x, z) of the band's face at x. */
export function frontNormal(x: number): { x: number; z: number } {
  const inner = W - R
  const ax = Math.abs(x)
  if (ax <= inner) return { x: 0, z: 1 }
  const dx = Math.min(ax - inner, R)
  const dz = Math.sqrt(Math.max(0, R * R - dx * dx))
  return { x: (Math.sign(x) * dx) / R, z: dz / R }
}

/**
 * Plan outline of the band (x, z), from the left pier round the front to the right pier.
 * `offset` grows it outward (negative = inner face).
 */
export function bandOutline(offset = 0, steps = 14): { x: number; z: number }[] {
  const inner = W - R
  const r = R + offset
  const pts: { x: number; z: number }[] = [{ x: -inner - r, z: FACADE.back }]
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI - (i / steps) * (Math.PI / 2)
    pts.push({ x: -inner + Math.cos(a) * r, z: F - R + Math.sin(a) * r })
  }
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI / 2 - (i / steps) * (Math.PI / 2)
    pts.push({ x: inner + Math.cos(a) * r, z: F - R + Math.sin(a) * r })
  }
  pts.push({ x: inner + r, z: FACADE.back })
  return pts
}

/** x positions and heights of the five balcony trees (left-weighted, as in the photo). */
export const TREE_XS = [-3.03, -1.66, -0.37, 0.97, 2.3] as const
export const TREE_HEIGHTS = [1.62, 1.24, 1.58, 1.28, 1.52] as const

/** The sign sits left of centre. */
export const SIGN_X = -0.71
