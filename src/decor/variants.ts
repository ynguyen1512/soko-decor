// The six decor proposals from the brief (A1–B3) and the generator that turns each into a 3D
// layer plus an estimated bill of materials.
import * as THREE from 'three'
import { C } from '../core/materials'
import { createRng } from '../core/rng'
import { TREE_XS } from '../world/facade'
import { createBow, createGift, createStar } from './accessories'
import { type DrapeStyle, addBerries, addGarland, addOrnaments, edgePoint } from './garland'
import type { DetailId } from './details'
import { buildKit, createKit } from './kit'

export type VariantId = 'A1' | 'A2' | 'A3' | 'B1' | 'B2' | 'B3'

export interface Variant {
  id: VariantId
  title: string
  description: string
  drape: DrapeStyle
  smallBows?: boolean
  largeBows?: boolean
  ornaments?: boolean
  berries?: boolean
  stars?: boolean
  gifts?: boolean
}

export const VARIANTS: readonly Variant[] = [
  { id: 'A1', title: 'Thông rủ nhẹ toàn bộ (10–15cm)', description: 'Tối ưu chi phí, gọn gàng, vẫn tạo hiệu ứng mềm mại', drape: 'light' },
  { id: 'A2', title: 'Thông rủ toàn bộ + nơ nhung', description: 'Thêm nơ nhung đỏ để tạo điểm nhấn và nhận diện rõ Giáng sinh', drape: 'light', smallBows: true },
  { id: 'A3', title: 'Thông rủ toàn bộ + ornament', description: 'Tăng sự nổi bật với ornament đỏ, vàng, bạc', drape: 'light', ornaments: true, berries: true },
  { id: 'B1', title: 'Thông rủ theo cụm (25–30cm)', description: 'Rủ theo từng cụm ở giữa các cây, tiết kiệm chi phí nhưng vẫn đẹp', drape: 'cluster', berries: true },
  { id: 'B2', title: 'Thông rủ theo cụm + nơ lớn', description: 'Các cụm rủ kết hợp nơ nhung bản lớn tạo điểm nhấn rõ ràng', drape: 'cluster', largeBows: true, berries: true },
  { id: 'B3', title: 'Thông rủ theo cụm + hộp quà/đèn sao', description: 'Kết hợp phụ kiện như hộp quà, đèn ngôi sao để tăng chiều sâu', drape: 'cluster', stars: true, gifts: true, berries: true },
]

export interface BomLine {
  label: string
  qty: number
  unit: string
  note?: string
}

export interface VariantLayer {
  group: THREE.Group
  bom: BomLine[]
  /** accessories that pop in when the variant is shown */
  pops: THREE.Object3D[]
  /** where the camera looks for each close-up detail this variant has */
  focus: Partial<Record<DetailId, THREE.Vector3>>
}

const LEDS_PER_STRING = 100
/** a bow under every tree plus one each side, as in the A2 render */
const SMALL_BOW_XS = [-3.85, ...TREE_XS, 3.45]

export function buildVariant(v: Variant): VariantLayer {
  const rng = createRng(0x50c0 + v.id.charCodeAt(0) * 31 + v.id.charCodeAt(1))
  const kit = createKit()
  const group = new THREE.Group()
  group.name = `variant:${v.id}`
  const pops: THREE.Object3D[] = []
  const bom: BomLine[] = []
  const focus: VariantLayer['focus'] = {}

  const garland = addGarland(kit, rng, v.drape)
  focus.garland = garland.attachPoint(TREE_XS[1] + 0.45, -0.05)
  if (v.drape === 'light') {
    bom.push({ label: 'Dây thông rủ nhẹ 10–15cm', qty: Math.ceil(garland.lengthM * 1.1), unit: 'm', note: 'đã cộng 10% hao hụt' })
  } else {
    bom.push({ label: 'Cụm thông rủ 25–30cm', qty: garland.clusterXs.length, unit: 'cụm' })
    bom.push({ label: 'Dây thông nối giữa các cụm', qty: Math.ceil(garland.lengthM * 1.25), unit: 'm', note: 'tính cả độ võng' })
  }

  if (v.berries) {
    const berries = addBerries(kit, rng, garland, v.drape === 'light' ? 5 : 4)
    focus.berry = berries.sample
    bom.push({ label: 'Chùm berry đỏ', qty: berries.clusters, unit: 'chùm' })
  }

  if (v.ornaments) {
    const n = addOrnaments(kit, rng, garland, 11)
    focus.ornament = n.sample
    bom.push({ label: 'Ornament đỏ', qty: n.red, unit: 'quả', note: 'Ø8–14cm' })
    bom.push({ label: 'Ornament vàng', qty: n.gold, unit: 'quả', note: 'Ø8–14cm' })
    bom.push({ label: 'Ornament bạc', qty: n.silver, unit: 'quả', note: 'Ø8–14cm' })
  }

  if (v.smallBows) {
    for (const x of SMALL_BOW_XS) {
      const bow = createBow(0.2, 1.1)
      bow.position.copy(garland.attachPoint(x, -0.08))
      bow.lookAt(bow.position.clone().add(new THREE.Vector3(x * 0.04, 0, 1)))
      group.add(bow)
      pops.push(bow)
      if (x === TREE_XS[1]) focus.bow = bow.position.clone().add(new THREE.Vector3(0, -0.06, 0))
    }
    bom.push({ label: 'Nơ nhung đỏ (cỡ vừa)', qty: SMALL_BOW_XS.length, unit: 'cái', note: 'ngang ~40cm' })
  }

  if (v.largeBows) {
    // skip the middle tree: long tails there would hang over the sign
    const xs = [TREE_XS[0], TREE_XS[1], TREE_XS[3], TREE_XS[4]]
    for (const x of xs) {
      // wide wine velvet with the Soko "s" printed on one tail, like the real large bows
      const bow = createBow(0.28, 2.7, true)
      bow.position.copy(garland.attachPoint(x, 0.04))
      bow.lookAt(bow.position.clone().add(new THREE.Vector3(x * 0.04, 0, 1)))
      group.add(bow)
      pops.push(bow)
      if (x === TREE_XS[1]) focus.bow = bow.position.clone().add(new THREE.Vector3(0, -0.28, 0))
    }
    bom.push({ label: 'Nơ nhung bản lớn, in logo', qty: xs.length, unit: 'cái', note: 'ngang ~55cm, đuôi ~75cm' })
  }

  if (v.stars) {
    TREE_XS.forEach((x, i) => {
      const star = createStar(i % 2 === 0 ? 0.13 : 0.1)
      star.position.copy(garland.attachPoint(x, i % 2 === 0 ? -0.1 : 0.06)).add(new THREE.Vector3(0, 0, 0.04))
      star.lookAt(star.position.clone().add(new THREE.Vector3(x * 0.04, 0, 1)))
      group.add(star)
      pops.push(star)
      if (i === 1) focus.star = star.position.clone()
    })
    bom.push({ label: 'Đèn ngôi sao LED', qty: TREE_XS.length, unit: 'cái', note: 'Ø20–25cm' })
  }

  if (v.gifts) {
    // between the trees
    const spots = TREE_XS.slice(1).map((x, i) => (x + TREE_XS[i]) / 2)
    spots.forEach((x, i) => {
      const red = i % 2 === 0
      const gift = createGift(0.34, 0.3, 0.3, red ? C.giftRed : C.giftGold, red ? C.giftGold : C.giftRed)
      // sitting on the parapet cap, between the trees and above the garland rope
      gift.position.copy(edgePoint(x, 0.07, -0.14))
      gift.rotation.y = (i - 1.5) * 0.25
      group.add(gift)
      pops.push(gift)
      if (i === 1) focus.gift = gift.position.clone().add(new THREE.Vector3(0, 0.15, 0))
    })
    bom.push({ label: 'Hộp quà trang trí', qty: spots.length, unit: 'hộp', note: '34×30×30cm' })
  }

  const leds = kit.leds.count
  bom.push({ label: 'Đèn LED dây (vàng ấm)', qty: Math.ceil(leds / LEDS_PER_STRING), unit: 'dây', note: `≈${leds} bóng, ${LEDS_PER_STRING} bóng/dây` })

  group.add(buildKit(kit, `variant:${v.id}`))
  return { group, bom, pops, focus }
}
