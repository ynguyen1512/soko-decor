// Palette and shared materials. Materials are module-level singletons: never dispose them.
import * as THREE from 'three'

export const C = {
  sky: 0x0a1222,
  street: 0x1a1b1f,
  band: 0x4a4c51,
  bandTrim: 0x8e9196,
  frame: 0x121316,
  redCladding: 0xb8202b,
  creamWall: 0xe2d6bd,
  pierGrey: 0x6f716f,
  pierBeige: 0xb9b2a3,
  sofa: 0xc8161e,
  leaf: 0x5f9a3a,
  needle: 0x1f4a24,
  needleDark: 0x12301a,
  velvet: 0x760a17,
  berry: 0xb5101c,
  ornamentRed: 0xa8121e,
  ornamentGold: 0xd9a441,
  ornamentSilver: 0xc9ccd2,
  giftRed: 0xb3141f,
  giftGold: 0xc99a3a,
  ledWarm: new THREE.Color(1.0, 0.8, 0.38),
  starWarm: new THREE.Color(1.0, 0.8, 0.45),
  signWhite: new THREE.Color(0.92, 0.96, 1.0),
  interior: new THREE.Color(1.0, 0.78, 0.45),
} as const

const cache = new Map<string, THREE.Material>()
function cached<T extends THREE.Material>(key: string, build: () => T): T {
  if (!cache.has(key)) cache.set(key, build())
  return cache.get(key) as T
}

export const standard = (color: number, roughness = 0.85, metalness = 0) =>
  cached(`std:${color}:${roughness}:${metalness}`, () => new THREE.MeshStandardMaterial({ color, roughness, metalness }))

export const needleMat = () =>
  cached('needle', () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, metalness: 0 }))

export const velvetMat = () =>
  cached('velvet', () => new THREE.MeshPhysicalMaterial({
    color: C.velvet, roughness: 0.8, sheen: 0.9, sheenRoughness: 0.32, sheenColor: new THREE.Color(0xc23a4a),
    side: THREE.DoubleSide,
  }))

export const glossyMat = (color: number) =>
  cached(`gloss:${color}`, () => new THREE.MeshPhysicalMaterial({
    color, roughness: 0.22, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.15, envMapIntensity: 0.6,
  }))

export const satinMat = (color: number) =>
  cached(`satin:${color}`, () => new THREE.MeshPhysicalMaterial({
    color, roughness: 0.4, metalness: 0.15, sheen: 0.6, sheenColor: new THREE.Color(0xffe0a0), envMapIntensity: 0.4,
  }))

/** Unlit glowing material; `intensity` > 1 pushes the colour over the bloom threshold. */
export const glowMat = (color: THREE.Color, intensity: number) =>
  cached(`glow:${color.getHexString()}:${intensity}`, () => {
    const m = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(intensity) })
    m.toneMapped = false
    return m
  })
