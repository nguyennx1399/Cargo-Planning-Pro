# Phase 02 — Vùng deck + thuật toán đặt hàng breakbulk (diện tích, không phải slot)

## Context Links
- [plan.md](plan.md) · [phase-01](phase-01-cargo-catalog-data-model.md) (`BreakbulkCargo`/`BreakbulkPlacement`)
- Code tham khảo (KHÔNG sửa, chỉ đối chiếu pattern): `frontend/src/engine/naive-fill-plan.ts` (thuật toán greedy cho container), `frontend/src/engine/validate-plan.ts` + `validation-rules.ts` (pattern rule thuần)

## Overview
- Priority: lõi thuật toán — không có phase này thì breakbulk cargo không có vị trí · Size: M · Status: complete — code-reviewed, tested. Lưu ý: code-reviewer ban đầu nghi ngờ `deckArea`/`onDeckBayZones` sai hệ toạ độ, nhưng xác nhận lại (đọc kỹ toàn bộ file) là 2 file này TỰ NHẤT QUÁN đúng quy ước đã chọn (`vessel.length_m`-symmetric) — lỗi thật nằm ở phase 03/04 (nơi RENDER/STABILITY hiểu sai quy ước này), không phải ở đây.
- **G6 miễn phase này**: thuần thuật toán + validate, chưa có UI. Lý do: đặt hàng vào toạ độ mà chưa render ra thì không có gì để "thấy" — phase 03 mới là nơi bắt buộc lên demo.

## Key Insights
- Vùng deck khả dụng lấy đơn giản từ `vessel.length_m`/`beam_m` (KHÔNG cần `geometry_id`) trừ margin: mũi (không đặt hàng che tầm nhìn/neo), lái (thường có superstructure). Đây LÀ xấp xỉ DEMO — ghi rõ comment, không phải bố trí GA thật (đã nêu ở plan.md).
- Thuật toán greedy "shelf packing" (giống cách sắp ảnh vào khung): xếp từng item dọc theo 1 cạnh (theo x, dùng hết chiều dài available_length trước), hết chỗ thì "nhảy hàng" (tăng z, dùng width mới) — y hệt tinh thần `naiveFillPlan` (không phải optimizer thật, chỉ đủ để demo có hàng KHÔNG chồng lấn).
- Input order ảnh hưởng kết quả (item to đặt trước sẽ chiếm chỗ đẹp) — SẮP XẾP theo diện tích giảm dần trước khi xếp (item to khó đặt hơn, xếp trước tránh bị kẹt ở cuối) — quyết định kỹsẽ tránh trường hợp toàn bộ item cuối cùng bị "unplaced" chỉ vì thứ tự xui.
- Validate overlap dùng kiểm tra giao nhau của 2 hình chữ nhật đã xoay (rotation_deg chỉ 0 hoặc 90 trong thuật toán greedy — ĐƠN GIẢN HOÁ: không hỗ trợ góc tuỳ ý ở bước đặt tự động, `rotation_deg` khác 0/90 chỉ có ý nghĩa nếu sau này có UI kéo-thả chỉnh tay, NGOÀI PHẠM VI phase này).
- Container hiện tại (đã có vị trí qua `slotToPosition`) chiếm không gian TRÊN DECK khi ở tier "on deck" (tier ≥ 80) — breakbulk KHÔNG được chồng lên các bay đang có container on-deck. Cách đơn giản nhất: breakbulk chỉ đặt vào phần deck CÒN LẠI sau khi trừ đi vùng các bay có container on-deck (tính từ `vessel.bays`/`bayCenterX` — dùng làm "vùng cấm" hình chữ nhật theo x, toàn bộ beam theo z).

## Requirements
- F1 `engine/breakbulk-deck-area.ts` (thuần, test): `deckArea(vessel): {xMin, xMax, zMin, zMax}` — trừ margin mũi/lái (hằng số, ví dụ 15% LOA mỗi đầu) khỏi `vessel.length_m`, full `beam_m` trừ margin nhỏ 2 bên (mạn tàu).
- F2 `engine/breakbulk-forbidden-zones.ts` (thuần, test): `onDeckBayZones(vessel): {xMin, xMax}[]` — vùng x bị chiếm bởi container on-deck (dùng `bayCenterX` + `DIM.len40/2` cho mọi bay có ít nhất 1 tier ≥ 80 trong `stacks`).
- F3 `engine/naive-fill-breakbulk.ts` (thuần, test, đặt tên song song `naive-fill-plan.ts`): 
  ```ts
  export function naiveFillBreakbulk(
    vessel: Vessel,
    cargo: BreakbulkCargo[],
    forbiddenXZones: { xMin: number; xMax: number }[] // từ F2, optional param để test dễ cô lập
  ): { placements: BreakbulkPlacement[]; unplaced: string[] }
  ```
  Thuật toán: sort cargo theo `length_m * width_m` giảm dần → shelf-pack trong `deckArea()` (F1), bỏ qua các dải x trùng `forbiddenXZones` → item nào không còn chỗ thì vào `unplaced`.
- F4 `engine/breakbulk-overlap-check.ts` (thuần, test): `rectsOverlap(a, b): boolean` (2 hình chữ nhật ship-frame, có tính `rotation_deg` 0/90 khi tính extent thật theo x/z) — dùng lại trong F3 VÀ trong validate (F5).
- F5 `engine/breakbulk-validation-rules.ts` (thuần, test): các rule độc lập, KHÔNG đụng `validation-rules.ts`/`ALL_RULES` cũ:
  - `breakbulkOutOfDeckArea`: item nằm ngoài `deckArea()`.
  - `breakbulkOverlap`: 2 item breakbulk chồng lấn nhau (dùng F4).
  - `breakbulkOverlapsContainer`: item breakbulk chồng lên vùng container on-deck (F2 + F4).
  - `breakbulkOverweight`: tổng trọng lượng breakbulk trên 1 dải x (ví dụ mỗi 20m dọc tàu) vượt ngưỡng cố định (hằng số DEMO, ví dụ 200t/20m — ghi rõ đây là số áng chừng, không phải sức bền kết cấu thật).
- F6 `engine/validate-plan.ts`: gọi thêm các rule ở F5 trên `plan.breakbulk_cargo`/`plan.breakbulk_placements`, gộp `Violation[]` vào report hiện có (không đổi `ValidationReport` shape).
- NF: mỗi file < 200 dòng.

## Architecture
```ts
// engine/naive-fill-breakbulk.ts
export function naiveFillBreakbulk(vessel: Vessel, cargo: BreakbulkCargo[], forbiddenXZones: XZone[]) {
  const area = deckArea(vessel); // F1
  const sorted = [...cargo].sort((a, b) => b.length_m * b.width_m - a.length_m * a.width_m);
  const placements: BreakbulkPlacement[] = [];
  const unplaced: string[] = [];
  let cursorX = area.xMin, rowZ = area.zMin, rowHeight = 0;
  for (const item of sorted) {
    // thử đặt tại (cursorX, rowZ); nếu tràn width -> next row; nếu tràn length hoặc dính forbiddenXZones -> unplaced
    // ...
  }
  return { placements, unplaced };
}
```

## Related Code Files
- Create: `frontend/src/engine/breakbulk-deck-area.ts` (+test), `frontend/src/engine/breakbulk-forbidden-zones.ts` (+test), `frontend/src/engine/naive-fill-breakbulk.ts` (+test), `frontend/src/engine/breakbulk-overlap-check.ts` (+test), `frontend/src/engine/breakbulk-validation-rules.ts` (+test)
- Modify: `frontend/src/engine/validate-plan.ts` (gọi thêm breakbulk rules)
- Delete: none

## Implementation Steps
1. `breakbulk-deck-area.ts` + test (margin cố định, biên đúng dấu ship-frame x từ AP).
2. `breakbulk-overlap-check.ts` + test (2 hình chữ nhật không xoay, xoay 90°, không chồng lấn, chạm biên = không chồng).
3. `breakbulk-forbidden-zones.ts` + test (dùng vessel demo thật, xác nhận số vùng khớp số bay có container on-deck).
4. `naive-fill-breakbulk.ts` + test: cô lập test bằng cách truyền `forbiddenXZones=[]` trước (chỉ test thuật toán packing), rồi 1 test riêng có forbidden zone để xác nhận item né đúng.
5. `breakbulk-validation-rules.ts` + test — mỗi rule 1 test rõ ràng vi phạm + 1 test không vi phạm.
6. Wire vào `validate-plan.ts`, chạy lại toàn bộ test cũ đảm bảo không đổi kỳ vọng (report cũ khi `breakbulk_cargo=[]` phải giống hệt trước).
7. `npm run typecheck && npm test && npm run build`.

## Todo List
- [x] `breakbulk-deck-area.ts` + test
- [x] `breakbulk-overlap-check.ts` + test
- [x] `breakbulk-forbidden-zones.ts` + test (đọc `plan.placements` thật, KHÔNG đọc `vessel.stacks` — xem Deviations)
- [x] `naive-fill-breakbulk.ts` + test (shelf-pack có "skip qua obstacle trong cùng hàng" thay vì bỏ cả hàng)
- [x] `breakbulk-validation-rules.ts` + test
- [x] Wire vào `validate-plan.ts`
- [x] typecheck/test/build xanh (316/316, tăng từ 287)

## Deviations (phát hiện khi implement, khác với draft ban đầu)
- **`onDeckBayZones` phải đọc `plan.placements` (container ĐANG xếp trong plan hiện tại), KHÔNG phải `vessel.stacks` (sức chứa khai báo tĩnh của tàu).** Bản nháp phase file ban đầu viết "`onDeckBayZones(vessel)`" dựa trên `vessel.stacks.filter(s => s.deck === "on")` — nhưng tàu demo có `deck: "on"` StackSpec cho MỌI bay (khai báo sức chứa, không phải trạng thái hiện tại), nên nếu làm đúng bản nháp thì TOÀN BỘ 10 bay của tàu demo bị coi là "cấm", không còn chỗ nào cho breakbulk dù tàu có đang rỗng hay không. Sửa: hàm nhận thêm `placements: Placement[]`, chỉ coi bay bị cấm khi CÓ container thật đang ở tier ≥ 80 trong plan đó — khớp đúng cách `ContainerInstances.tsx` tự phân biệt on/under deck.
- **Đã tự kiểm chứng bằng số liệu thật (không đoán)**: chạy thử `naiveFillBreakbulk` với 14 item demo (phase 01) trên tàu demo — (a) tàu RỖNG (không container): 12/14 đặt được, 2 unplaced (2 item lớn nhất không đủ chỗ) — chấp nhận được; (b) tàu ĐẦY (470 container, on-deck chiếm ~7 bay): chỉ 2/14 đặt được — ĐÚNG NHƯ DỰ ĐOÁN theo Success Criteria đã sửa (không phải bug, tàu đầy hàng thì deck breakbulk cũng phải hẹp lại theo đúng vật lý). Phase 03 nên mount "Project cargo" độc lập, không phụ thuộc trạng thái Load/Clear container, để người dùng thấy được cảnh đẹp nhất (tàu rỗng + breakbulk) thay vì mặc định luôn bật cùng lúc với container đầy.

## Success Criteria
- `naiveFillBreakbulk` đặt đúng, không chồng lấn, trên vessel TỔNG HỢP (test tự tạo, kiểm soát được kích thước) — không bắt buộc phải đặt hết 100% item trên tàu demo thật: cánh quạt tua bin dài 60-85m là số liệu THẬT (offshore wind), tàu demo (172m LOA) có thể không đủ chỗ cho tất cả cùng lúc khi container đã chiếm phần lớn deck — giống tiền lệ đã chấp nhận với container 20' unplaced (`naive-fill-plan.ts`). Nếu tàu demo cho unplaced, đó là kết quả THẬT của thuật toán, không phải bug — quyết định số lượng item demo generator chọn (phase 01/03) để cân bằng "đủ để thấy đẹp" mới thuộc phase 03 (Sidebar wiring), không phải phase này.
- Không có 2 placement nào chồng lấn nhau hoặc chồng lên container on-deck — xác nhận bằng test dùng chính `rectsOverlap`, không chỉ "nhìn qua số liệu".
- `validatePlan()` với plan có breakbulk chồng lấn cố ý → trả về đúng violation, không throw, không bỏ sót.

## Risk Assessment
| Rủi ro | Giảm thiểu |
|---|---|
| Thuật toán greedy xếp sai thứ tự khiến item to bị kẹt cuối, unplaced dù còn đủ diện tích tổng | Sort theo diện tích giảm dần trước khi xếp (Key Insights) |
| Forbidden zones tính sai dấu ship-frame (x từ AP hay từ mũi) → breakbulk chồng lên container mà không bị phát hiện | Test F2 dùng vessel demo thật, so khớp thủ công ít nhất 1 bay cụ thể |
| `validate-plan.ts` gộp rule mới làm đổi thứ tự/nội dung violation cũ | Test hồi quy: plan rỗng breakbulk phải cho `ValidationReport` giống hệt trước khi sửa |

## Security Considerations
N/A — thuần client-side, không nhập liệu ngoài.

## Next Steps
- Phase 03 dùng `BreakbulkPlacement[]` (từ phase này) để render 3D và nối vào demo thật.
