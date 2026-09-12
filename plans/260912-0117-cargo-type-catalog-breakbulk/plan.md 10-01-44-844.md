# Bộ cargo mở rộng — Container đủ size + hàng breakbulk (tua bin gió, du thuyền)

- **Liên quan:** [P1 frontend demo](../260911-0945-p1-frontend-stowage-demo/plan.md) (`Container`/`StowagePlan`/`naiveFillPlan` gốc), [vessel-3d-model-pipeline phase-03](../260911-1409-vessel-3d-model-pipeline/phase-03-component-library-livery-paint-render-perf.md) (`engine/vessel-components/primitive-mesh.ts` — tái dùng cho mesh cargo breakbulk), [cargo-loading-sequence-playback](../260911-1955-cargo-loading-sequence-playback/plan.md) (`WeightItem`/`computeIndicativeStability`/`useIndicativeStability` — nơi cargo mới phải nối vào)
- **Status:** COMPLETE — all 4 phases code-reviewed, tested, verified via headless Chrome + CDP (334/334 tests passing)
- **Size:** L (4 phase)
- **Quyết định phạm vi (người dùng chọn):** Đầy đủ — không chỉ thư viện 3D/data model, mà còn thuật toán đặt hàng breakbulk theo vùng diện tích (không phải slot), validate va chạm, và tích hợp vào tính ổn định (GM/trim/list).

## Mục đích
Mở rộng "bộ cargo" ngoài container ISO chuẩn: (1) hoàn thiện các size/type container đã khai báo trong `ContainerType` nhưng chưa được demo generator dùng tới (45', OPEN_TOP, FLAT_RACK, TANK), và (2) thêm hàng breakbulk/project cargo (tua bin gió: cánh quạt/nacelle/đoạn tháp, du thuyền) — loại hàng KHÔNG xếp theo slot bay/row/tier mà chiếm một vùng diện tích (footprint) trên deck.

## Phát hiện quan trọng khi khảo sát code hiện tại
- `Container`/`Placement`/`Slot` (types/domain.ts) gắn chặt với lưới slot rời rạc (bay/row/tier) và `vessel.stacks: StackSpec[]`. Toàn bộ `validation-rules.ts`/`validation-context.ts`/`naive-fill-plan.ts`/`ContainerInstances.tsx` (InstancedMesh — 1 geometry dùng chung cho mọi container) đều dựa trên giả định "mọi cargo đều nằm trong 1 slot rời rạc". Hàng breakbulk phá vỡ giả định này — **không sửa lại hệ slot cũ, mà thêm một hệ đặt hàng SONG SONG** (diện tích/footprint) để không đụng vỡ container hiện có (rủi ro thấp hơn, đúng YAGNI).
- `engine/vessel-components/primitive-mesh.ts` đã có sẵn `boxMeshData()`/`cylinderMeshData()` — build mesh hộp/trụ đặt đúng theo `shipToScene`, vốn dùng cho linh kiện tàu (cần cẩu, ống khói...) nhưng đủ tổng quát để tái dùng thẳng cho cargo breakbulk (tháp tua bin = trụ, nacelle = hộp, cánh quạt = hộp dài mỏng, du thuyền = hộp đơn giản) — tránh viết lại logic dựng mesh (DRY).
- `WeightItem`/`computeIndicativeStability` (từ plan cargo-loading-sequence-playback, đã Complete) đã tổng quát: chỉ cần `{weight_t, lcg_m, tcg_m, kg_m}`, không quan tâm cargo có phải container hay không. Chỉ cần viết một hàm `breakbulkWeightItem()` song song với `cargoWeightItem()` hiện có, rồi gộp cả 2 mảng `WeightItem[]` lại trước khi gọi `computeIndicativeStability` — không cần sửa engine ổn định.
- `Vessel.length_m`/`beam_m` (domain.ts) luôn có sẵn (không phụ thuộc `geometry_id` tuỳ chọn) — dùng để tính vùng deck khả dụng cho breakbulk mà KHÔNG bắt buộc tàu phải có `VesselGeometry` đầy đủ (khớp cách `SimpleBoxHull` fallback đã hoạt động).
- Diện tích deck thật (vị trí hatch cover, khoang nào chịu tải bao nhiêu) không có trong dữ liệu hiện tại — nằm ngoài phạm vi demo (giống cách thủy tĩnh `computed` không thay booklet thật). Dùng một HÌNH CHỮ NHẬT deck đơn giản (trừ margin mũi/lái) làm vùng đặt hàng — ghi rõ đây là xấp xỉ DEMO, không phải bản vẽ bố trí thật.

## Nguyên tắc ràng buộc
- **Không sửa `Container`/`Placement`/`Slot`/`naive-fill-plan.ts` hiện có** — cộng thêm `BreakbulkCargo`/`BreakbulkPlacement` như trường MỚI trong `StowagePlan`, không đổi shape cũ (không phá test/plan trước).
- **G6 (từ vessel-3d-model-pipeline):** mọi phase phải có đường dẫn thật từ `App.tsx`/demo tới code mới, không chỉ pass test. Phase 1–2 KHÔNG có bề mặt UI (thuần data/thuật toán) — ghi rõ lý do miễn ở phase đó; phase 3 là nơi bắt buộc phải thấy được trong demo thật.
- **Xác minh phải render app thật, không chỉ `curl`/`npm test`/`npm run build`** — bài học mới nhất từ plan cargo-loading-sequence-playback (bug r3f hook-ngoài-Canvas gây trắng trang, không subagent nào bắt được vì chỉ dùng `curl`). Từ phase 3 (có UI) trở đi, PHẢI xác nhận bằng headless Chrome + CDP (xem `plans/260911-1955-cargo-loading-sequence-playback/phase-02-ship-attitude-3d.md` phần cuối để biết cách làm) trước khi đánh dấu Complete.
- **DEMO DATA**: kích thước/trọng lượng tua bin gió, du thuyền là số liệu THAM KHẢO (dựa trên tua bin gió ngoài khơi cỡ thật và du thuyền cỡ trung phổ biến), không phải catalogue nhà sản xuất cụ thể nào — ghi rõ trong code comment, không cần banner UI riêng (khác với thủy tĩnh — đây không phải số an toàn vận hành, chỉ là kích thước tham khảo để demo).

## Phases
| # | Phase | Phụ thuộc | Status |
|---|---|---|---|
| 01 | [Data model + catalog cargo (container đủ size + breakbulk)](phase-01-cargo-catalog-data-model.md) | — | Complete |
| 02 | [Vùng deck + thuật toán đặt hàng breakbulk (diện tích, không phải slot)](phase-02-breakbulk-area-placement.md) | 01 | Complete |
| 03 | [Render 3D + nối vào demo thật (G6)](phase-03-breakbulk-3d-rendering-demo-wiring.md) | 02 | Complete |
| 04 | [Tích hợp vào tính ổn định (GM/trim/list)](phase-04-breakbulk-stability-integration.md) | 03 | Complete |

## Bugs Found & Fixed During Implementation
- **Phase 03/04 (CRITICAL):** Coordinate system mismatch (LOA vs LBP) caused 6–12m shift between where breakbulk was validated/placed vs. where it rendered/weighted for stability. Found during code-review round 2, fixed (sửa ship-frame convention), re-verified correct.
- **Phase 03 (Medium):** Regression test didn't discriminate old vs. new code — fixed to properly catch coordinate bugs.
- **Phase 04 (Medium):** Missing `LAYOUT.hatchHeight` in KG calculation (0.6m offset) — fixed to align with container on-deck tier convention.

## Post-Completion Success-Criteria Gap (Found & Fixed)
After all 4 phases marked done, re-check against Success Criteria revealed: container types added in phase 01 (45'/OPEN_TOP/FLAT_RACK/TANK) were never wired into running demo (only in isolated tests). Fixed: wired `specialCounts` into `buildDemoVesselAndCargo()`, fixed `ContainerInstances.tsx` to use `LENGTH_BY_SIZE` per container size. Verified via test + headless Chrome (0 exceptions, all container types render at correct dimensions).

## Ngoài phạm vi (YAGNI)
- Bố trí deck thật theo bản vẽ (hatch cover, khoang chịu tải riêng biệt) — cần dữ liệu GA thật, thuộc phạm vi vessel onboarding (vessel-3d-model-pipeline phase 05/07), không phải plan này.
- Thuật toán tối ưu đặt hàng breakbulk (bin-packing tối ưu, xoay để tối đa hoá diện tích) — chỉ làm thuật toán greedy đơn giản (giống `naiveFillPlan`), đủ để demo, không phải solver thật.
- Lashing/gia cố cho hàng breakbulk (số lượng, vị trí điểm neo) — chỉ có validate trọng lượng/diện tích, không tính lực lashing thật.
- Nhập catalogue cargo tuỳ ý qua UI (upload kích thước riêng) — chỉ có danh sách cố định trong code, người dùng chọn từ đó.

## Success criteria (tổng)
- Container: `generateDemoCargo`/`ContainerInstances` xử lý được ít nhất 1 loại mới trong {45', OPEN_TOP, FLAT_RACK, TANK} có hiển thị khác biệt (không chỉ đổi field mà không có gì thấy được). **Lưu ý:** ban đầu bị bỏ sót — `specialCounts` (phase 01) chưa bao giờ được gọi trong `build-demo-plan.ts` thật (chỉ có trong test), và `ContainerInstances.tsx` vẫn scale mọi instance theo `DIM.len40` bất kể `size` (code-reviewer phát hiện, xếp Low vì "chưa ai gọi tới nên chưa lộ ra"). Đã phát hiện lại và sửa SAU KHI cả 4 phase "xong": wire `specialCounts` vào `buildDemoVesselAndCargo()` thật + sửa `ContainerInstances.tsx` dùng `LENGTH_BY_SIZE` theo `container.size` — xác nhận bằng test (`build-demo-plan.test.ts`, 3 test) + headless Chrome (0 exception).
- Breakbulk: demo có thể "Load project cargo" và thấy tua bin gió + du thuyền render đúng vị trí trên deck, không chồng lấn nhau, không chồng lấn container.
- `validatePlan` báo lỗi rõ ràng khi breakbulk cargo vượt vùng deck hoặc chồng lấn — không âm thầm bỏ qua.
- Thêm breakbulk cargo nặng, lệch tâm → `StabilityPanel` phản ánh đúng chiều (GM giảm, list/trim đổi hướng hợp lý) — xác minh bằng test số, không chỉ "trông có vẻ đúng".
- `npm run typecheck`, `npm run build`, `npm test` xanh ở mọi phase; không có test cũ bị đổi kỳ vọng ngoài ý muốn.
