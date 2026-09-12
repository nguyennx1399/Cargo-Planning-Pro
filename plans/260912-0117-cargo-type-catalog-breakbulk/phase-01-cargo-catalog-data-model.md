# Phase 01 — Data model + catalog cargo (container đủ size + breakbulk)

## Context Links
- [plan.md](plan.md)
- Code hiện tại: `frontend/src/types/domain.ts` (`Container`, `ContainerType`, `StowagePlan`), `frontend/src/data/demo-cargo-generator.ts`

## Overview
- Priority: nền tảng cho mọi phase sau · Size: S · Status: complete — code-reviewed, tested, không có vấn đề nào trong phạm vi phase này
- Thuần data + types, KHÔNG có engine đặt hàng, KHÔNG có UI/render. **G6 miễn phase này**: chưa có gì để "thấy" — mọi type/catalog chỉ hữu ích khi phase 02+ dùng tới. Lý do miễn: một schema chưa có consumer thì không có "đường dẫn vào demo" để nối, ép nối sớm sẽ tạo code chết.

## Key Insights
- `ContainerType` (domain.ts) đã khai báo `"OPEN_TOP" | "FLAT_RACK" | "TANK"` nhưng `generateDemoCargo()` chỉ từng sinh `"DRY" | "REEFER"`, size chỉ `"20" | "40"` (dù `ContainerSize` đã có `"45"`) — hoàn thiện đúng những gì ĐÃ khai báo trước khi thêm loại mới, tránh vừa sửa type vừa thêm field cùng lúc.
- Container thêm size/type mới KHÔNG cần schema mới — chỉ cần demo generator dùng tới field đã có, và `ContainerInstances.tsx`/`lib/geometry.ts DIM` phản ánh kích thước 45' đúng (dài hơn 40', không phải chỉ đổi nhãn).
- Breakbulk cargo cần schema HOÀN TOÀN MỚI vì đơn vị đo khác: không phải TEU/slot mà là kích thước vật lý (dài × rộng × cao) + vị trí đặt tự do (không rời rạc theo bay/row/tier).
- Kích thước tham khảo (nguồn: thông số phổ biến của turbine offshore thế hệ hiện tại và du thuyền hạng trung, KHÔNG phải catalogue hãng cụ thể — ghi rõ trong comment code là DEMO reference, không phải số kỹ thuật chính xác cho vận hành thật):
  - Cánh quạt tua bin (blade): dài 60–90m, rộng gốc ~4-5m (thu nhỏ dần), nặng 20–35t.
  - Nacelle (buồng máy): hộp ~12m × 4m × 4.5m, nặng 70–120t (rất nặng so với thể tích — cần lưu ý khi đặt KG).
  - Đoạn tháp (tower section): hình trụ, đường kính đáy ~5–6m thu nhỏ dần lên đỉnh ~3-4m, mỗi đoạn dài 20–30m, nặng 80–150t.
  - Du thuyền (yacht): dài 15–35m, rộng 4.5–7m, cao (từ đáy cẩu tới boong) 4–8m, nặng 20–150t tuỳ cỡ.

## Requirements
- F1 `types/domain.ts`: mở rộng `ContainerSize` không đổi (đã có `"45"`), KHÔNG cần sửa `Container` interface. Thêm mới:
  ```ts
  export type BreakbulkCategory = "wind_turbine_blade" | "wind_turbine_nacelle" | "wind_turbine_tower" | "yacht";

  export interface BreakbulkCargo {
    id: string;
    category: BreakbulkCategory;
    length_m: number;   // ship-frame x extent (dọc tàu)
    width_m: number;    // ship-frame y extent (ngang tàu)
    height_m: number;   // từ mặt đặt (deck) lên đỉnh
    weight_t: number;
    kg_above_base_m: number; // trọng tâm cách mặt đặt bao nhiêu (KHÔNG phải height_m/2 mặc định — nacelle đặc nặng ở đáy, blade rỗng nhẹ)
    pol: string;
    pod: string;
  }

  export interface BreakbulkPlacement {
    cargo_id: string;
    x_m: number;   // ship-frame x của TÂM footprint, từ AP
    z_m: number;   // ship-frame z của TÂM footprint (+ mạn phải) — ĐỔI TÊN so với Slot.row vì đây là toạ độ liên tục, không phải chỉ số hàng rời rạc
    rotation_deg: number; // 0 = length_m dọc theo x (dọc tàu); 90 = xoay ngang
  }
  ```
- F2 `StowagePlan` (domain.ts): thêm 2 field MỚI, optional-with-default để không phá `StowagePlan` literal hiện có trong test cũ:
  ```ts
  breakbulk_cargo: BreakbulkCargo[];
  breakbulk_placements: BreakbulkPlacement[];
  ```
  Không dùng `?:` optional — dùng bắt buộc nhưng CẬP NHẬT mọi nơi tạo `StowagePlan` literal (grep `: StowagePlan` và mọi hàm trả `StowagePlan`) để luôn có 2 field này (mảng rỗng nếu chưa dùng) — tránh kiểu "optional rồi quên check" (bài học từ session trước: optional dễ bị bỏ sót hơn required + cập nhật hết chỗ gọi, TypeScript sẽ tự báo lỗi thiếu field ở mọi literal).
- F3 `data/breakbulk-cargo-catalog.ts` (mới): danh sách cố định `BREAKBULK_CATALOG: Record<BreakbulkCategory, Omit<BreakbulkCargo, "id"|"pol"|"pod">[]>` hoặc đơn giản hơn — vài biến thể kích thước cho mỗi category (ví dụ 2 cỡ blade, 1 nacelle, 2 đoạn tower, 2 cỡ yacht), theo số liệu ở Key Insights.
- F4 `data/demo-cargo-generator.ts`: thêm tham số tuỳ chọn cho `generateDemoCargo` hoặc hàm mới nhỏ để sinh thêm 45'/OPEN_TOP/FLAT_RACK/TANK (tỷ lệ nhỏ, ví dụ mỗi loại ~2-3% tổng số) — GIỮ nguyên hành vi mặc định khi không truyền tham số mới (không phá test cũ `demo-data.test.ts`).
- F5 `data/demo-breakbulk-generator.ts` (mới): `generateDemoBreakbulkCargo(seed): BreakbulkCargo[]` — chọn vài item cố định từ catalog (ví dụ 3 bộ tua bin đầy đủ = 3 blade + 1 nacelle + 2 tower, cộng 1-2 yacht), gán id/pol/pod.
- NF: mỗi file < 200 dòng; tên file kebab-case.

## Architecture
Không có luồng runtime mới ở phase này — chỉ types + data tĩnh. Luồng sẽ dùng ở phase 02+:
```
BreakbulkCargo[] (catalog/generator) ──┐
                                        ├─→ naiveFillBreakbulk() [phase 02] ─→ BreakbulkPlacement[]
StowagePlan.breakbulk_cargo ───────────┘
```

## Related Code Files
- Create: `frontend/src/data/breakbulk-cargo-catalog.ts`, `frontend/src/data/demo-breakbulk-generator.ts`, `frontend/src/data/__tests__/breakbulk-cargo-catalog.test.ts`
- Modify: `frontend/src/types/domain.ts` (thêm `BreakbulkCategory`/`BreakbulkCargo`/`BreakbulkPlacement`, thêm 2 field vào `StowagePlan`), `frontend/src/data/demo-cargo-generator.ts` (thêm size/type container mới), `frontend/src/data/build-demo-plan.ts` (mọi nơi tạo `StowagePlan` literal — thêm `breakbulk_cargo: []`/`breakbulk_placements: []` cho tới khi phase 02 điền thật), `frontend/src/lib/geometry.ts` (DIM — thêm `len45` nếu container 45' cần kích thước riêng biệt trong scene)
- Delete: none

## Implementation Steps
1. Thêm `BreakbulkCategory`/`BreakbulkCargo`/`BreakbulkPlacement` + 2 field bắt buộc vào `StowagePlan` trong `domain.ts`. Chạy `npm run typecheck` ngay — TS sẽ liệt kê MỌI chỗ tạo `StowagePlan` thiếu field mới (đây chính là cơ chế an toàn thay vì optional).
2. Sửa từng chỗ typecheck báo lỗi (dự kiến: `build-demo-plan.ts` 2 hàm, có thể vài chỗ trong test fixtures) — thêm `breakbulk_cargo: [], breakbulk_placements: []`.
3. `data/breakbulk-cargo-catalog.ts` — viết catalog theo số liệu Key Insights, mỗi entry có id ổn định (không random) để test dễ assert.
4. `data/demo-breakbulk-generator.ts` + test: sinh ra đúng số lượng, category hợp lệ, không trùng id, tổng trọng lượng nằm trong khoảng hợp lý (sanity, không phải test kỹ thuật).
5. `data/demo-cargo-generator.ts`: thêm 45'/OPEN_TOP/FLAT_RACK/TANK với tỷ lệ nhỏ — viết test riêng xác nhận ÍT NHẤT 1 container mỗi loại mới xuất hiện với seed mặc định (không chỉ "có khả năng xuất hiện").
6. `lib/geometry.ts`: thêm `DIM.len45` (thực tế container 45' dài 13.716m, không phải 12.192m như 40') nếu phase 03 cần render đúng — làm luôn ở đây vì cùng nhóm "kích thước container" (tránh quay lại sửa file này 2 lần).
7. `npm run typecheck && npm test && npm run build`.

## Todo List
- [x] `BreakbulkCategory`/`BreakbulkCargo`/`BreakbulkPlacement` + `StowagePlan` fields
- [x] Sửa mọi chỗ tạo `StowagePlan` literal (theo báo lỗi typecheck — 4 chỗ: `build-demo-plan.ts` ×2 qua `basePlanFields`, `naive-fill-plan.test.ts`, `test-vessel-fixture.ts`)
- [x] `breakbulk-cargo-catalog.ts` + test
- [x] `demo-breakbulk-generator.ts` + test (2 bộ turbine đầy đủ + 2 yacht, 14 item)
- [x] `demo-cargo-generator.ts`: 45'/OPEN_TOP/FLAT_RACK/TANK qua `specialCounts` (opt-in, mặc định rỗng để KHÔNG phá test cũ 470/400) + test cả 2 trường hợp (mặc định = 0, có truyền = đúng số lượng)
- [x] `DIM.len45` trong `lib/geometry.ts` (13.716m, kích thước ISO thật)
- [x] typecheck/test/build xanh (287/287, tăng từ 277)

## Success Criteria
- Catalog có ít nhất 2 biến thể mỗi category breakbulk (trừ nacelle có thể 1), số liệu nằm trong khoảng Key Insights đã nêu.
- `generateDemoCargo()` mặc định (không truyền tham số mới) cho kết quả GIỐNG HỆT trước đây — test cũ (`demo-data.test.ts`) không đổi kỳ vọng.
- Toàn bộ `StowagePlan` literal trong codebase có đủ 2 field mới — xác nhận bằng `npm run typecheck` sạch (không phải bằng đọc mắt).

## Risk Assessment
| Rủi ro | Giảm thiểu |
|---|---|
| Thêm field bắt buộc vào `StowagePlan` phá test fixture cũ ở nơi không ngờ tới | Dùng chính `npm run typecheck` làm checklist — không đoán, để trình biên dịch liệt kê hết |
| Số liệu kích thước/trọng lượng breakbulk không thực tế, gây GM âm/vô lý ở phase 04 | Đã tham khảo khoảng thực tế offshore wind turbine/yacht hạng trung (Key Insights) — phase 04 sẽ có test sanity riêng cho GM sau khi thêm breakbulk |
| Container 45' dùng chung `DIM.len40` cũ, render sai kích thước ở phase 03 | Thêm `DIM.len45` ngay ở phase này dù chưa dùng tới UI, để phase 03 không phải quay lại sửa `lib/geometry.ts` |

## Vấn đề phát sinh: rủi ro ở trên ĐÃ THÀNH SỰ THẬT (phát hiện + sửa sau khi cả 4 phase "xong")
Đúng như rủi ro đã lường trước ở bảng trên — nhưng KHÔNG phase nào (2/3/4, đều chỉ lo breakbulk) thực sự đi wire `specialCounts` vào `build-demo-plan.ts` thật hay sửa `ContainerInstances.tsx` dùng `DIM.len45`. Code-reviewer phát hiện (xếp Low, vì "chưa ai gọi `specialCounts` nên chưa lộ ra") khi review phase 01-02. Đã sửa bổ sung: `buildDemoVesselAndCargo()` giờ gọi `generateDemoCargo(42, {specialCounts: {...}})` thật; `ContainerInstances.tsx` dùng `LENGTH_BY_SIZE: Record<ContainerSize, number>` để mỗi instance tự scale đúng theo `container.size` (thay vì cứng `DIM.len40` cho mọi container). Thêm `data/__tests__/build-demo-plan.test.ts` (3 test) xác nhận cả 4 loại mới THẬT SỰ xuất hiện và được xếp trong demo thật, không chỉ trong test cô lập. Xác minh headless Chrome: 0 exception khi tải trang mặc định (giờ có cả 40'/45'/OPEN_TOP/FLAT_RACK/TANK cùng lúc).

**Bài học:** khi 1 phase tạo ra 1 khả năng mới (`specialCounts`) nhưng KHÔNG có phase nào sau đó chịu trách nhiệm rõ ràng "bật nó lên trong demo thật", nó dễ trở thành code chết dù mọi test đều xanh — đúng tinh thần G6 nhưng ở góc chưa được phase nào minh danh phụ trách.

## Security Considerations
N/A — dữ liệu tĩnh, không nhập từ người dùng.

## Next Steps
- Phase 02 dùng `BreakbulkCargo[]` (catalog/generator) + vùng deck (từ `vessel.length_m`/`beam_m`) để sinh `BreakbulkPlacement[]`.
