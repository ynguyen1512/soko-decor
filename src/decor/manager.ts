// Owns all decor: the balcony trees shared by every proposal, one lazily-built layer per variant,
// the warm light the garland throws on the facade, and the lights on/off + twinkle state.
import * as THREE from 'three'
import { createRng } from '../core/rng'
import { FACADE, TREE_HEIGHTS, TREE_XS, frontZ } from '../world/facade'
import { createBow } from './accessories'
import { lightUniforms } from './instancing'
import { buildKit, createKit } from './kit'
import { addTree } from './tree'
import { VARIANTS, type VariantId, type VariantLayer, buildVariant } from './variants'

const POP_SECONDS = 0.45
const SWITCH_SECONDS = 0.6

/** Balcony trees are wider than the balcony is deep: drop sprigs that would show through the band. */
const insideBalcony = (p: THREE.Vector3) =>
  p.y > FACADE.parapetTop - 0.05 || (p.z < frontZ(p.x, -FACADE.bandThickness - 0.03) && p.z > 0.04)

function createTrees() {
  const rng = createRng(2026)
  const kit = createKit()
  const g = new THREE.Group()
  g.name = 'trees'
  TREE_XS.forEach((x, i) => {
    // trees stand in planters, so their base sits a little above the balcony floor
    const base = new THREE.Vector3(x, FACADE.balconyFloor + 0.15, frontZ(x) - 0.68)
    g.add(addTree(kit, rng, base, { height: TREE_HEIGHTS[i], spread: 0.33, coreRadius: 0.6, keep: insideBalcony }))
  })
  // the small tree inside the left shop window, with a red bow on top
  const inside = new THREE.Vector3(-2.75, 0, -0.9)
  g.add(addTree(kit, rng, inside, { height: 1.5, spread: 0.34, leds: 200, baubles: 30 }))
  const bow = createBow(0.09, 0.6)
  bow.position.set(inside.x, inside.y + 1.45, inside.z + 0.12)
  g.add(bow)
  g.add(buildKit(kit, 'trees'))
  return g
}

/** Warm fill standing in for thousands of bulbs: lights the band, the trees and the wall behind. */
function createGlowLights() {
  const g = new THREE.Group()
  const lights: { light: THREE.PointLight; base: number }[] = []
  for (const x of [-3.4, -1.7, 0, 1.7, 3.4]) {
    const front = new THREE.PointLight(0xffa955, 0.6, 2.4, 1.6)
    front.position.set(x, FACADE.parapetTop + 0.25, frontZ(x) + 0.7)
    const back = new THREE.PointLight(0xffb465, 1.3, 3.2, 1.6)
    back.position.set(x, FACADE.parapetTop + 1.5, frontZ(x) - 0.15)
    g.add(front, back)
    lights.push({ light: front, base: front.intensity }, { light: back, base: back.intensity })
  }
  return { group: g, lights }
}

export function createDecorManager(root: THREE.Object3D) {
  root.add(createTrees())
  const glow = createGlowLights()
  root.add(glow.group)

  const layers = new Map<VariantId, VariantLayer>()
  let current: VariantId | null = null
  // pop-ins run on wall-clock time so they finish even when frames are slow
  const pops: { obj: THREE.Object3D; start: number; done: boolean }[] = []

  let lightsOn = true
  let onLevel = 1
  let switchFade = 1

  function layer(id: VariantId) {
    let l = layers.get(id)
    if (!l) {
      const v = VARIANTS.find((x) => x.id === id)!
      l = buildVariant(v)
      l.group.visible = false
      root.add(l.group)
      layers.set(id, l)
    }
    return l
  }

  function show(id: VariantId) {
    if (id === current) return layer(id)
    if (current) layer(current).group.visible = false
    const l = layer(id)
    l.group.visible = true
    current = id
    pops.length = 0
    const now = performance.now() / 1000
    l.pops.forEach((obj, i) => {
      obj.userData.baseScale ??= obj.scale.x
      pops.push({ obj, start: now + i * 0.06, done: false })
      obj.scale.setScalar(0.0001)
    })
    switchFade = 0
    return l
  }

  function update(dt: number, elapsed: number) {
    lightUniforms.uTime.value = elapsed
    const target = lightsOn ? 1 : 0
    onLevel += (target - onLevel) * Math.min(1, dt * 6)
    switchFade = Math.min(1, switchFade + dt / SWITCH_SECONDS)
    // new garland lights come up softly after a switch
    lightUniforms.uOn.value = onLevel * (0.25 + 0.75 * switchFade)
    for (const { light, base } of glow.lights) light.intensity = base * (0.12 + 0.88 * lightUniforms.uOn.value)

    const now = performance.now() / 1000
    for (const p of pops) {
      if (p.done) continue
      const t = THREE.MathUtils.clamp((now - p.start) / POP_SECONDS, 0, 1)
      // ease-out-back for a small overshoot
      const k = t - 1
      const s = 1 + 2.4 * k * k * k + 1.4 * k * k
      p.obj.scale.setScalar(p.obj.userData.baseScale * Math.max(0.0001, s))
      p.done = t >= 1
    }
  }

  return {
    show,
    update,
    /** Pre-builds the remaining variants during idle time so switching is instant. */
    warmUp() {
      const queue = VARIANTS.map((v) => v.id).filter((id) => !layers.has(id))
      const next = () => {
        const id = queue.shift()
        if (!id) return
        layer(id)
        setTimeout(next, 30)
      }
      setTimeout(next, 300)
    },
    setLightsOn(on: boolean) { lightsOn = on },
    get lightsOn() { return lightsOn },
    setTwinkle(on: boolean) { lightUniforms.uTwinkle.value = on ? 1 : 0 },
  }
}

export type DecorManager = ReturnType<typeof createDecorManager>
