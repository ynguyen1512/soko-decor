// Facade dimensions (metres), estimated from the reference photo. x → right, y → up, z → street.
// Change these once the real measurements are known: decor and the materials estimate follow.

export const FACADE = {
  halfWidth: 4.2,
  groundHeight: 3.0,
  slabTop: 3.15,
  parapetTop: 4.5,
  balconyFloor: 3.6,
  bandThickness: 0.15,
  /** z of the curved parapet front at the centre and at both ends */
  frontCenterZ: 1.5,
  frontEndZ: 1.0,
  shopfrontZ: 0.3,
  upperTop: 9.6,
} as const

const sagitta = FACADE.frontCenterZ - FACADE.frontEndZ
/** Radius of the circular arc through the three front points. */
export const ARC_RADIUS = (FACADE.halfWidth ** 2 + sagitta ** 2) / (2 * sagitta)
const ARC_CENTER_Z = FACADE.frontCenterZ - ARC_RADIUS

/** z of the parapet's outer face at x (offset > 0 moves outward along the arc normal radius). */
export function frontZ(x: number, offset = 0): number {
  const r = ARC_RADIUS + offset
  return ARC_CENTER_Z + Math.sqrt(Math.max(0, r * r - x * x))
}

/** Outward unit normal (x, z) of the parapet front at x. */
export function frontNormal(x: number): { x: number; z: number } {
  const z = frontZ(x) - ARC_CENTER_Z
  const len = Math.hypot(x, z)
  return { x: x / len, z: z / len }
}

/** x positions of the seven balcony trees. */
export const TREE_XS = [-3.6, -2.4, -1.2, 0, 1.2, 2.4, 3.6] as const
export const TREE_HEIGHTS = [2.0, 2.35, 2.05, 2.45, 2.05, 2.35, 2.0] as const
