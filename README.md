# Soko Decor 3D

Xem 3D 6 phương án trang trí Giáng sinh (A1–B3) cho mặt tiền Soko, dựng hoàn toàn bằng code
(Three.js + TypeScript, không dùng file mô hình có sẵn).

**Demo:** https://ynguyen1512.github.io/soko-decor/ (mỗi lần push lên `main`, GitHub Actions tự build và deploy lại).

## Chạy

```bash
npm install
npm run dev      # http://localhost:5174
npm run build    # type-check + build ra dist/
```

Link mở thẳng một phương án, góc nhìn hoặc cận cảnh chi tiết: `/?v=B2&view=close`, `/?v=B2&detail=bow`
(`view` = `front` | `close` | `angle` | `street`; `detail` = `garland` | `bow` | `berry` | `ornament` | `star` | `gift`).

## Thao tác

- Kéo để xoay, cuộn/chụm để zoom, chuột phải hoặc 2 ngón để di chuyển.
- Phím `1`–`6` hoặc bấm thẻ ở dưới để đổi phương án.
- Hàng "Chi tiết" (thông rủ, nơ nhung, berry, ornament, đèn ngôi sao, hộp quà): bay camera tới cận cảnh kèm mô tả.
- Nút Đèn, thanh trượt Độ sáng (10–100%), Nhấp nháy, Tự xoay ở góc phải trên.
- Bảng "Ước tính vật tư" tự tính theo mô hình đang hiển thị.

## Cấu trúc

| File | Nội dung |
|---|---|
| `docs/ref/` | Ảnh tham chiếu: mặt tiền thật ban đêm và bảng 6 phương án |
| `src/world/facade.ts` | **Kích thước mặt tiền** (ngang, cao, độ cong ban công, vị trí cây). Sửa ở đây khi có số đo thật |
| `src/world/storefront.ts` | Toà nhà: ban công cong, bảng hiệu, cửa kính + nội thất, tầng trên, nhà bên, vỉa hè |
| `src/decor/variants.ts` | Định nghĩa 6 phương án và bảng vật tư |
| `src/decor/garland.ts` | Dây thông: rủ nhẹ toàn bộ / rủ theo cụm, berry, ornament |
| `src/decor/tree.ts` | Cây thông có đèn |
| `src/decor/accessories.ts` | Nơ nhung (in logo trên đuôi), đèn ngôi sao, hộp quà |
| `src/decor/details.ts` | Nội dung hàng "Chi tiết" cận cảnh |
| `src/decor/instancing.ts` | Instancing (lá thông, bóng LED) và shader đèn nhấp nháy |
| `src/decor/manager.ts` | Quản lý các lớp decor, bật/tắt đèn, hiệu ứng chuyển phương án |
| `src/core/scene.ts` | Renderer, bloom, camera, điều khiển |
| `src/ui/` | Giao diện overlay |

Số liệu vật tư là ước tính từ mô hình, cần đo thực tế trước khi báo giá.
