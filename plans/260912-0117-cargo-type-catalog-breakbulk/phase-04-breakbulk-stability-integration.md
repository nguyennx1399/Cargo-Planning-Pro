# Phase 04 — Tích hợp breakbulk vào tính ổn định (GM/trim/list)

## Context Links
- [plan.md](plan.md) · [phase-01](phase-01-cargo-catalog-data-model.md) (`BreakbulkCargo`) · [phase-02](phase-02-breakbulk-area-placement.md) (`BreakbulkPlacement`) · [phase-03](phase-03-breakbulk-3d-rendering-demo-wiring.md) (render, demo wiring)
- Code hiện tại (KHÔNG sửa logic lõi, chỉ mở rộng input): `frontend/src/lib/cargo-weight-item.ts` (`cargoWeightItem` cho container), `frontend/src/lib/use-indicative-stability.ts` (`stabilityForVisiblePlan`), `frontend/src/engine/stability-indicative.ts` (`computeIndicativeStability`, `WeightItem`)

## Overview
- Priority: hoàn thiện mục đích cuối — hàng nặng bất thường (nacelle 100t+) phải ảnh hưởng thấy được lên GM/trim/list · Size: S · Status: complete — code-reviewed 2 vòng (bug LOA/LBP + kg_m hatchHeight, cả 2 đã sửa), test/build xanh (331/331)

## Key Insights
- `computeIndicativeStability` (đã Complete, plan trước) nhận `WeightItem[]` tổng quát — KHÔNG cần sửa file này chút nào, chỉ cần đưa đủ `WeightItem` vào, bao gồm cả breakbulk.
- `cargoWeightItem(vessel, geometry, container, slot)` hiện tại lấy `kg_m` từ `tierCenterY(slot.tier) + depth_m` — công thức này gắn với container CÓ TIER, breakbulk KHÔNG có tier. Cần hàm SONG SONG `breakbulkWeightItem(vessel, geometry, item, placement)` dùng `item.kg_above_base_m` (đã có ở phase 01, khác nhau theo category — nacelle nặng ở đáy nên KG thấp hơn height_m/2, blade thì có thể coi gần đều) + mặt đáy đặt hàng (deck level, giống phase 03 tính `deckY`).
- `stabilityForVisiblePlan` (use-indicative-stability.ts) hiện chỉ map qua `plan.placements`/`plan.containers` — sửa để CỘNG THÊM mảng breakbulk weight items vào `cargo` trước khi gọi `computeIndicativeStability`. Đây là thay đổi DUY NHẤT cần vào file lõi, và chỉ là "thêm phần tử vào mảng", không đổi logic tính toán.
- Playback (loading-sequence-playback, đã Complete) cắt cargo theo `playbackCount` trên `plan.placements` (container) — breakbulk KHÔNG cần playback (chỉ vài item, không có ý nghĩa "xếp dần từng cái" như hàng trăm container). Quyết định: breakbulk LUÔN hiện đầy đủ trong tính ổn định khi bật "Project cargo", KHÔNG bị cắt bởi `playbackCount` — cần ghi rõ trong code comment để người đọc sau không tưởng nhầm là bug.
- Test sanity quan trọng nhất: thêm 1 nacelle 100t đặt LỆCH hẳn về 1 mạn (z_m lớn) → `list_deg` phải đổi dấu/độ lớn theo đúng hướng đó, so sánh với plan không có nacelle — đây là test "have I actually wired this in" chứ không chỉ "does the math not crash".

## Requirements
- F1 `lib/breakbulk-weight-item.ts` (mới, test): 
  ```ts
  export function breakbulkWeightItem(vessel: Vessel, geometry: VesselGeometry, item: BreakbulkCargo, placement: BreakbulkPlacement): WeightItem {
    // kg_m = deck level (ship-frame z từ baseline) + item.kg_above_base_m
    // lcg_m = placement.x_m ; tcg_m = placement.z_m  (đã là ship-frame, không cần đổi)
  }
  ```
- F2 `lib/use-indicative-stability.ts`: `stabilityForVisiblePlan` nhận thêm mảng breakbulk weight items đã tính sẵn (hoặc tự tính bên trong bằng `plan.breakbulk_cargo`/`breakbulk_placements` + F1) — GHÉP vào `cargo` trước khi gọi `computeIndicativeStability`. KHÔNG cắt theo `playbackCount` (Key Insights).
- F3 test hồi quy: `stabilityForVisiblePlan` với `breakbulk_cargo=[]` cho kết quả giống hệt trước phase này (không đổi hành vi khi không có breakbulk).
- NF: không đổi shape `WeightItem`/`StabilityResult`; mỗi file < 200 dòng.

## Architecture
```ts
// lib/use-indicative-stability.ts — sửa bên trong stabilityForVisiblePlan
const containerCargo = visible.map((p) => cargoWeightItem(vessel, geometry, byId.get(p.container_id)!, p.slot));
const breakbulkCargo = plan.breakbulk_placements.map((bp) =>
  breakbulkWeightItem(vessel, geometry, breakbulkById.get(bp.cargo_id)!, bp)
); // KHÔNG dùng visiblePlacements ở đây — breakbulk luôn đầy đủ
const cargo = [...containerCargo, ...breakbulkCargo];
```

## Related Code Files
- Create: `frontend/src/lib/breakbulk-weight-item.ts`, `frontend/src/lib/__tests__/breakbulk-weight-item.test.ts`
- Modify: `frontend/src/lib/use-indicative-stability.ts` (gộp breakbulk vào `cargo`), `frontend/src/lib/__tests__/use-indicative-stability.test.ts` (thêm case có breakbulk)
- Delete: none

## Implementation Steps
1. `breakbulk-weight-item.ts` + test: xác nhận `lcg_m`/`tcg_m` khớp thẳng `placement.x_m`/`z_m` (không qua `shipToScene` — `WeightItem` dùng ship-frame trực tiếp, giống `cargoWeightItem` hiện tại dùng scene rồi cộng lại lbp/2... **kiểm tra kỹ**: `cargoWeightItem` hiện tại có bước `sceneX + lbp_m/2` để đổi VỀ ship-frame vì nó xuất phát từ `slotToPosition` (trả về scene) — breakbulk thì `placement.x_m`/`z_m` ĐÃ LÀ ship-frame ngay từ đầu (phase 01 định nghĩa vậy), nên KHÔNG cần bước đổi ngược này. Ghi rõ sự khác biệt này trong comment để tránh nhầm lẫn (đây là chỗ dễ sai nhất của cả phase).
2. Sửa `stabilityForVisiblePlan` — thêm tham số hoặc đọc thẳng `plan.breakbulk_cargo`/`breakbulk_placements`, gộp mảng.
3. Test hồi quy F3.
4. Test sanity: nacelle nặng lệch mạn → so sánh `list_deg` có/không breakbulk (Key Insights) — đây là test QUAN TRỌNG NHẤT của phase, không được bỏ qua.
5. `npm run typecheck && npm test && npm run build`.
6. Xác minh nhanh bằng headless Chrome + CDP: bật "Project cargo" (phase 03) trong demo thật, đọc số trên `StabilityPanel` (Δ/GM/list) trước/sau khi bật — xác nhận số ĐỔI (không phải render breakbulk nhưng số liệu ổn định vẫn y nguyên, tức chưa nối dây thật).

## Todo List
- [x] `breakbulk-weight-item.ts` + test (phát hiện + sửa đúng bug ship-frame vs "vessel.length_m/2-symmetric" đã lường trước ở bước 1 — xem "Bug NGHIÊM TRỌNG" bên dưới, cùng gốc với phase 03)
- [x] Sửa `stabilityForVisiblePlan` gộp breakbulk
- [x] Test hồi quy (breakbulk rỗng = không đổi)
- [x] Test sanity nacelle lệch mạn → list đổi đúng hướng (2 test: so với không breakbulk, và so port vs starboard)
- [x] typecheck/test/build xanh (329/329)
- [x] Xác minh headless Chrome + CDP: Δ hiện đúng bao gồm cả breakbulk (22869t khi bật Project cargo + đầy container), 0 exception

## Bug NGHIÊM TRỌNG (chung gốc với phase 03 — xem chi tiết ở phase-03 file)
`breakbulk-weight-item.ts` bản đầu mắc ĐÚNG lỗi y hệt `breakbulk-mesh-builder.ts`: coi `placement.x_m` là ship-frame thật (neo `lbp_m`) trong khi nó thực ra neo `vessel.length_m` (LOA) — khiến `lcg_m` tính sai, kéo theo `trim_m`/`draft_fwd_m`/`draft_aft_m` sai (dù `list_deg`/`tcg_m` không bị ảnh hưởng vì trục ngang không có vấn đề LOA/LBP). Sửa bằng đúng 2 bước `cargoWeightItem` đã làm: `sceneX = x_m - vessel.length_m/2` rồi `+ lbp_m/2`. Hàm nhận thêm tham số `vessel`. Thêm test hồi quy riêng khẳng định "không được coi x_m là ship-frame thật" (so sánh `lcg_m !== x_m` khi `length_m !== lbp_m`, đúng thực tế tàu demo 172≠160).

## Vòng review thứ 2 (code-reviewer xác nhận bug LOA/LBP đã sửa đúng, tìm thêm 2 vấn đề nhỏ hơn)
1. **(High) Test "xuyên hệ thống" ở phase 03 không thực sự phân biệt được code cũ/mới**: test đặt item ở phía MŨI của bay (phía mà lỗi cũ +6m đẩy item RA XA bay, không phải VÀO bay) — nên test đó PASS ở cả code đúng lẫn code sai, không phải regression guard thật. Đã sửa: thêm test THỨ HAI đặt item ở phía LÁI của bay với khoảng hở 3m (nhỏ hơn 6m của lỗi cũ) — tự tay tính bằng Node xác nhận: code đúng cho khoảng hở 3m (48.2 < mép bay 51.2, không chồng), code lỗi cũ sẽ đẩy item vào ĐÚNG vùng cấm (54.2 > 51.2, chồng lấn) — giờ mới là regression test thật, đã tự kiểm chứng bằng số cụ thể chứ không chỉ tin lời reviewer.
2. **(Medium) `breakbulkWeightItem`'s `kg_m` thiếu `LAYOUT.hatchHeight`** — cùng LỚP lỗi với bug LOA/LBP (bỏ sót một mốc tham chiếu ngầm), chỉ nhỏ hơn nhiều (0.6m so với 6-12m). `breakbulk-mesh-builder.ts` render item trên mặt `LAYOUT.hatchHeight` (đúng mốc container on-deck dùng qua `tierCenterY`), nhưng `kg_m` lại tính `depth_m + kg_above_base_m`, thiếu mất `hatchHeight` — khiến KG bị đánh giá THẤP hơn thực tế 0.6m (GM bị đánh giá CAO hơn thực tế một chút, không nguy hiểm ở mức DEMO nhưng vẫn là sai). Sửa: `kg_m: depth_m + LAYOUT.hatchHeight + kg_above_base_m`. Thêm test so khớp CHÉO với `cargoWeightItem` (container ở tier 82, tier thấp nhất on-deck) — dùng CÙNG MỘT mốc tham chiếu, không tự định nghĩa lại công thức riêng cho từng bên.

Xác nhận lại: `npm run typecheck && npm test && npm run build` xanh (331/331, tăng từ 329) + headless Chrome + CDP (Load/Clear project cargo) — 0 exception.

## Success Criteria
- Bật "Project cargo" trong demo thật → `StabilityPanel` hiện Δ tăng đúng bằng tổng trọng lượng breakbulk đã thêm (sai số làm tròn).
- Nacelle/tower đặt lệch hẳn 1 mạn → `list_deg` đổi dấu đúng hướng so với không có breakbulk — xác nhận bằng test số cụ thể.
- Không có breakbulk (`breakbulk_cargo=[]`, mặc định trước phase 03 bật nút) → mọi số liệu ổn định giống hệt trước phase này.

## Risk Assessment
| Rủi ro | Giảm thiểu |
|---|---|
| Nhầm ship-frame vs scene khi tính `lcg_m`/`tcg_m` cho breakbulk (khác cách container làm) | Ghi rõ trong comment + test riêng so khớp bằng số cụ thể, không suy đoán (xem Implementation Steps bước 1) |
| Breakbulk cực nặng (nacelle 100t+) đẩy Δ tổng ra ngoài khoảng bảng thủy tĩnh đã tính (`hydrostatics` memo, khoảng draft cố định) → `out_of_range` thay vì số thật | Test sanity phải xác nhận status vẫn `ok`/`warning`, KHÔNG phải `out_of_range`, với tải demo đầy đủ (container + breakbulk); nếu ra `out_of_range`, phải nới khoảng `drafts` trong `use-indicative-stability.ts` (đã có tiền lệ tương tự ở phase 01 plan trước) |
| Quên rằng breakbulk không bị cắt bởi `playbackCount`, tưởng là bug | Comment rõ trong code + ghi trong Key Insights/phase file |

## Security Considerations
N/A — thuần client-side.

## Next Steps
- Không còn phase tiếp theo trong plan này. Ngoài phạm vi tương lai (roadmap): lashing thật, bố trí deck theo GA thật (xem plan.md mục "Ngoài phạm vi").
