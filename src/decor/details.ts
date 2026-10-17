// Close-up details, mirroring the "Chi tiết …" row of the original proposal sheet
// (docs/ref/decor-proposals.png). Each one names the variant that best shows it.
import type { Variant, VariantId } from './variants'

export type DetailId = 'garland' | 'bow' | 'berry' | 'ornament' | 'star' | 'gift'

export interface Detail {
  id: DetailId
  label: string
  title: string
  description: string
  /** shown when the current variant does not include this detail */
  fallback: VariantId
  has(v: Variant): boolean
}

export const DETAILS: readonly Detail[] = [
  {
    id: 'garland',
    label: 'Thông rủ',
    title: 'Chi tiết thông rủ',
    description: 'Dây thông lá kim quấn đèn LED vàng ấm chạy dọc mép ban công. Nhóm A rủ nhẹ đều 10–15cm; nhóm B bó thành cụm 25–30cm dưới mỗi cây, nối bằng dây võng.',
    fallback: 'A1',
    has: () => true,
  },
  {
    id: 'bow',
    label: 'Nơ nhung',
    title: 'Chi tiết nơ nhung',
    description: 'Nhung đỏ rượu vang bản rộng, quai phồng giữ phom, đuôi cắt chữ V. A2 dùng nơ cỡ vừa ~40cm; B2 dùng nơ lớn ~55cm, đuôi dài ~75cm, in logo "s" của Soko trên đuôi.',
    fallback: 'B2',
    has: (v) => !!(v.smallBows || v.largeBows),
  },
  {
    id: 'berry',
    label: 'Berry đỏ',
    title: 'Chi tiết berry đỏ',
    description: 'Chùm quả berry đỏ bóng 6–12 quả, cài xen trong lá thông để tạo điểm đỏ rải đều trên nền xanh và ánh đèn vàng.',
    fallback: 'A3',
    has: (v) => !!v.berries,
  },
  {
    id: 'ornament',
    label: 'Ornament',
    title: 'Chi tiết ornament',
    description: 'Quả châu Ø8–14cm ba màu đỏ, vàng, bạc, bề mặt bóng có nắp vàng, phản chiếu ánh đèn để dây thông nổi bật hơn.',
    fallback: 'A3',
    has: (v) => !!v.ornaments,
  },
  {
    id: 'star',
    label: 'Đèn ngôi sao',
    title: 'Chi tiết đèn ngôi sao',
    description: 'Đèn LED viền ngôi sao Ø20–25cm ánh vàng ấm, gắn xen kẽ cao thấp trên các cụm thông để tạo chiều sâu.',
    fallback: 'B3',
    has: (v) => !!v.stars,
  },
  {
    id: 'gift',
    label: 'Hộp quà',
    title: 'Chi tiết hộp quà',
    description: 'Hộp quà trang trí ~34×30×30cm, giấy satin đỏ và vàng với ruy băng chéo và nơ nhỏ, đặt trên mép ban công giữa các cây.',
    fallback: 'B3',
    has: (v) => !!v.gifts,
  },
]
