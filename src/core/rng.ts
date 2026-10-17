// Seeded random numbers so every variant is generated identically on every load.

export type Rng = () => number

/** mulberry32: tiny, fast, good enough for scattering decor. Returns floats in [0, 1). */
export function createRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const range = (rng: Rng, min: number, max: number) => min + (max - min) * rng()

export const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)]

/** Approximately normal (sum of 3 uniforms), mean 0, roughly within ±1. */
export const gauss = (rng: Rng) => (rng() + rng() + rng()) / 1.5 - 1
