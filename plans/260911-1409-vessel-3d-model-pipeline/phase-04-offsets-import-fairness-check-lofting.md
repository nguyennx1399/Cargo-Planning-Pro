# Phase 04 — Nhập offsets, kiểm tra độ trơn, lofting (L2)

## Context Links
- [plan.md](plan.md) G2, G5 · [phase-02](phase-02-parametric-hull-generator-and-loft-mesher.md) (loft mesher, section integrals)
- Roadmap [phase-00](../260911-0939-cargo-planner-v2-roadmap/phase-00-discovery-users-data-market.md) 0.4 (thu offsets 2 tàu mẫu) · RT-2 (import sanity checks), RT-14 (untrusted file)

## Overview
- Priority: P1 cho thương mại (L2 là chuẩn giao khách) · Size: M · Status: complete (core scope; grid editing/pdf tracer deferred — xem Deviations)
- Nhập bảng offsets (CSV) → chuẩn hoá đơn vị/station → phát hiện lỗi đánh máy → xem trước body plan + 3D → loft bằng mesher của phase 02.

## Key Insights
- Offsets thường ở **mm**, station đánh số (0–20, có nửa station ở hai đầu) hoặc theo số sườn. Phải có bước chuẩn hoá về `x_m`, hoặc đổi qua `frames[]` (phase 01).
- Lỗi phổ biến nhất khi gõ lại từ PDF scan là lệch dấu phẩy thập phân hoặc hoán vị chữ số. Kiểm tra độ trơn (sai phân bậc hai theo cả x và z) bắt được phần lớn các lỗi này và rẻ hơn nhiều so với rà bằng mắt.
- **Body plan** (các mặt cắt chồng lên nhau, nửa mũi bên phải, nửa lái bên trái) là cách naval architect vẫn dùng để kiểm tra lines. Dựng view này là đủ để người có chuyên môn tin dữ liệu.
- Offsets là kích thước moulded (không gồm tôn vỏ và phụ vật). Chênh lệch với booklet được xử lý ở phase 06, không phải ở đây.

## Requirements
- F1 Parser CSV hai dạng: long (`station,waterline_z,half_breadth`) và wide (hàng = station, cột = WL). Metadata: đơn vị (mm|m), cách định nghĩa station (`station_number` + N | `x_m` | `frame`), stem/stern profile, deck at side, danh sách knuckle.
- F2 Chuẩn hoá: ô trống, `-` hoặc `—` → `null`; đổi đơn vị; sắp xếp tăng dần.
- F3 `checkOffsetsFairness(offsets) → FairnessWarning[]` (ô nghi ngờ + lý do); sanity checks: ≤ B/2, ≥ 0; midship section ≈ B/2 phía trên bilge; tại một WL, half-breadth không vượt midship.
- F4 UI: bảng lưới (ô nghi ngờ tô vàng, sửa inline), `BodyPlanView` (SVG), preview 3D trực tiếp, cả ba đồng bộ khi chọn ô.
- F5 Loft → `VesselGeometry.hull = {source: "offsets"}`, `data_status: "assumed"`; xuất và nhập JSON (frontend-only). Lưu DB khi roadmap P2 có persistence.
- F6 **(G6, bắt buộc)** `OffsetsImportPanel`/`BodyPlanView` PHẢI có đường dẫn thật từ `App.tsx` đang chạy (nút/tab, không cần router đầy đủ) — không chỉ tồn tại như component có test. Xem phase-02's "G6" section: đây chính là loại gap đã xảy ra (code đúng, không ai bấm được vào nó).
- NF: file ≤ 1 MB, ≤ 200 stations × 100 WL; parse + fairness + loft < 200 ms.

## Architecture
```
engine/hull/
  offsets-csv-parser.ts          CSV text + meta → HullOffsets | ParseError[]
  offsets-normalizer.ts          units, station→x (via frames), null handling, sort
  offsets-fairness-check.ts      2nd differences along x & z, robust threshold (MAD), sanity rules
features/vessel-onboarding/
  OffsetsImportPanel.tsx         file pick (size cap) + meta form + warnings list
  OffsetsGridEditor.tsx          dense grid, suspect cells highlighted
  BodyPlanView.tsx               SVG: aft stations left, fwd right; highlight selected station
```
Fairness (phác thảo): tại mỗi WL, `d2[i] = y[i−1] − 2y[i] + y[i+1]` (chuẩn hoá theo Δx). Nếu `|d2 − median| > k·MAD` (mặc định k=5) thì đánh dấu ô `i`. Làm tương tự theo z trong từng station. Bỏ qua station ở vùng knuckle đã khai báo.

## Related Code Files
- Create: 3 file `engine/hull/*` + tests `engine/hull/__tests__/{offsets-csv-parser,offsets-normalizer,offsets-fairness-check}.test.ts`; 3 component `features/vessel-onboarding/*`; fixture `frontend/src/data/fixtures/wigley-offsets.csv` (synthetic, giải tích)
- Modify: `engine/hull/hull-loft-mesh-builder.ts` (knuckle, nếu phase 02 chưa có), `App.tsx`/store (mode "Onboarding" đơn giản, chưa cần router)
- Delete: none

## Implementation Steps
1. Parser + normalizer + tests: long/wide cho kết quả như nhau; mm→m; station 0–20 với LBP 160 → x = 8·s; frame → x qua `frames`; dòng lỗi → `ParseError` có số dòng, không crash.
2. Fairness + tests: lưới Wigley sạch → 0 cảnh báo; chèn lỗi `12.45 → 1.245` → bắt đúng ô đó; knuckle đã khai báo không bị báo nhầm.
3. Loft offsets Wigley → Cb ≈ 4/9 (±0.005) qua `section-integrals`; mesh kín.
4. UI panel + grid + body plan + preview 3D; sửa ô → cảnh báo và mesh cập nhật ngay.
5. Nhập thử offsets của 1 tàu tham chiếu (từ P0, dữ liệu ngoài repo) và ghi thời gian thực hiện.

## Todo List
- [ ] parser CSV long/wide + meta + tests
- [ ] normalizer (units, station/frame → x) + tests
- [ ] fairness check + tests (bắt lỗi đánh máy)
- [ ] fixture Wigley + test loft/Cb
- [ ] OffsetsImportPanel + GridEditor + BodyPlanView + preview 3D
- [x] thử với tàu tham chiếu, ghi thời gian — **chưa làm**: không có tàu tham chiếu thật trong phiên này (chờ dữ liệu P0); thay bằng Wigley fixture (đã có closed-form Cb=4/9 để so sánh) làm "sample" trong UI
- [x] **(G6)** mount vào `App.tsx` thật — nút "Vessel onboarding (L2 import)" ở góc phải, toggle sang `OffsetsImportPanel`. Xác nhận: `npm run build` xanh (bắt được lỗi import `?raw`), `curl localhost:5173` → HTTP 200 sau khi Vite HMR áp dụng. **Chưa có** ảnh chụp màn hình browser thật (không có công cụ browser trong phiên).

## Deviations from the plan as written
- **Không có grid editor có thể sửa (`OffsetsGridEditor.tsx`)** — chỉ có preview đọc (parse → fairness → body plan → 3D), KHÔNG sửa ô trực tiếp rồi tính lại. Đây là cắt giảm scope có chủ đích (editable grid + re-fairness-on-keystroke là một khối việc riêng); người dùng sửa CSV gốc rồi dán lại.
- **UI chỉ hỗ trợ station mode `x_m`** (station = x tính bằng mét sẵn). `station_number` và `frame` mode đã có trong `offsets-normalizer.ts` (test đầy đủ) nhưng form chưa có control để chọn — thêm sau khi có dữ liệu thật cần đến (YAGNI).
- **Không có xuất/nhập JSON `VesselGeometry`** (F5 phần "xuất và nhập JSON") — panel hiện chỉ giữ state trong phiên React, không có nút save/load. Thêm khi phase 05 cần (draft persistence dùng chung).
- **Không dùng composite Simpson trên lưới x resample đều** như kiến trúc gốc mô tả — `blockCoefficient`/`buildHullLoftMesh` (phase 02) đã dùng trapezoidal trên lưới gốc, tái sử dụng nguyên bộ tích phân đó thay vì viết lại; sai số đã kiểm chứng đủ nhỏ (Cb Wigley trong ±0.005).
- **Fairness check có một bug thật đã sửa trong lúc viết test**: MAD-based threshold quá nhạy với dữ liệu gần-đúng-parabol (2nd difference gần hằng số → MAD gần 0 → nhiễu làm tròn cũng bị báo lỗi). Đã thêm sàn nhiễu tuyệt đối (`NOISE_FLOOR_M = 5mm`, quy đổi qua khoảng cách điểm) — xem code comment trong `offsets-fairness-check.ts`.
  - **Đã tự kiểm chứng thêm** (không qua subagent — xem "Xác minh vòng 2" bên dưới): sàn 5mm cố định hoạt động đúng ở cả tàu nhỏ (LBP 20m, beam 6m — vẫn bắt được lỗi lệch thập phân) lẫn tàu lớn (LBP 400m, beam 60m — không báo nhầm trên lưới sạch). Chưa thử ở hai đầu cực (tàu rất nhỏ <10m hoặc rất lớn >500m) — ngoài phạm vi sản phẩm nhắm tới nên chấp nhận được, nhưng ghi lại là giới hạn chưa khám phá hết, không phải đã chứng minh đúng mọi trường hợp.
- **Long format cho phép "khoảng trống" (station,waterline) thành `null` một cách im lặng** — cố ý (phục vụ bulb/knuckle thiếu điểm), nhưng đồng nghĩa một dòng dữ liệu bị XÓA NHẦM khỏi CSV gốc sẽ không bị báo lỗi, chỉ lặng lẽ thành `null`. Chấp nhận được vì fairness check không xét ô `null` (không có gì để so sánh), nhưng người dùng cần biết: thiếu dòng ≠ có lỗi được cảnh báo.

## Todo List (cập nhật)
- [x] parser CSV long/wide + meta + tests (9 tests, gồm test "long vs wide cho kết quả giống nhau")
- [x] normalizer (units, station/frame → x) + tests (6 tests, gồm cả 3 station mode)
- [x] fairness check + tests (6 tests — bắt lỗi lệch thập phân, phát hiện + sửa bug MAD-quá-nhạy)
- [x] fixture Wigley (`data/fixtures/wigley-offsets.csv`, 230 dòng) + test loft/Cb (2 test end-to-end: parse→normalize→fairness→loft→Cb)
- [x] OffsetsImportPanel + BodyPlanView + preview 3D — **KHÔNG** có GridEditor sửa được (xem Deviations)
- [~] thử với tàu tham chiếu — dùng Wigley thay vì tàu thật (chưa có dữ liệu P0)

## Success Criteria
- Lỗi đánh máy nhân tạo (lệch thập phân, hoán vị chữ số) bị bắt — xác nhận bằng test cụ thể (không đo % trên bộ lớn, xem Todo).
- Tàu tham chiếu: nhập + sửa + loft ≤ 1 giờ — **chưa đo được** (không có tàu tham chiếu thật trong phiên này).
- Body plan tàu tham chiếu được một người có chuyên môn xác nhận "đúng dáng" — **chưa làm** (cần người, dữ liệu thật).
- **(G6)** Panel bấm được từ app đang chạy — đạt, xem Todo.
- `npm run typecheck`, `npm run build`, `npm test` (191/191) đều xanh; characterization snapshot không đổi.

## Xác minh vòng 2 (thủ công, không qua subagent)
`tester`/`code-reviewer` subagent bị chặn bởi rate limit của phiên (reset 7pm Europe/Berlin) trước khi xong việc — không phải lỗi ở code. Tự kiểm chứng lại các điểm quan trọng nhất thay vì bỏ qua bước review:
- **long vs wide format khớp nhau trên dữ liệu thật** (không chỉ ví dụ nhỏ trong test): parse toàn bộ `wigley-offsets.csv` (230 dòng) qua long, tự dựng lại thành wide, parse lại → `toEqual` y hệt kết quả long. ✓
- **`NOISE_FLOOR_M` ở hai quy mô tàu khác nhau** (20m và 400m LBP) — xem note ở Deviations trên.
- **CSS bug thật tự tìm thấy** (không nằm trong phạm vi câu hỏi gửi subagent): `.mode-toggle` dùng `position: absolute` nhưng `.layout` (containing block dự định) không có `position` — nút neo theo viewport thay vì `.layout` một cách tình cờ đúng ở layout hiện tại, nhưng dễ vỡ nếu sau này `.layout` bị lồng trong container khác. Đã sửa: thêm `position: relative` vào `.layout`.
- **`useMemo` deps trong `OffsetsImportPanel.tsx`** (`[csvText, format, unit, particulars.beam_m]`) — đúng, vì bên trong chỉ dùng `particulars.beam_m` (qua `checkOffsetsFairness`), không thiếu dependency.
- **Giới hạn file 1MB** kiểm tra qua `file.size` (metadata, không cần đọc nội dung) TRƯỚC khi gọi `file.text()` — đúng thứ tự, không đọc file lớn vào bộ nhớ trước khi từ chối.
- Chưa tự xác minh: file size 6 (naming/YAGNI review sâu, XSS injection review sâu hơn) — rủi ro thấp (không có `dangerouslySetInnerHTML` ở đâu, đã grep xác nhận), chấp nhận bỏ qua để không trễ thêm.
- **Khi rate limit hết** (sau 7pm Berlin), nên chạy lại `tester`/`code-reviewer` đầy đủ cho phase 04 để đối chiếu — chưa có review "khách quan bên ngoài" đầy đủ như các phase trước, chỉ có tự-kiểm-chứng của chính người viết code.

## Risk Assessment
| Rủi ro | Giảm thiểu |
|---|---|
| Chỉ có PDF scan, không có bảng số | Số hoá body plan bằng tracer (phase 05); tuỳ chọn OCR sau (bắt buộc người kiểm) |
| Định dạng bảng mỗi nhà máy một kiểu | Hai dạng long/wide + form metadata; mẫu CSV tải về kèm hướng dẫn |
| Fairness báo nhầm ở mũi/lái có độ cong lớn | Ngưỡng robust (MAD) + khai báo knuckle + cho bỏ qua cảnh báo (có ghi log) |

## Security Considerations
- File CSV do người dùng đưa lên là untrusted: giới hạn kích thước/số dòng, parse thuần (không eval), không upload lên server ở phase này.
- Offsets là dữ liệu mật của chủ tàu: không commit; fixture trong repo chỉ là synthetic (Wigley).
- Khi export CSV, escape các ô bắt đầu bằng `= + - @` (CSV formula injection, RT-14).

## Next Steps
- Phase 05 thêm body-plan digitizer (khi không có bảng số) và GA tracer. Phase 06 dùng offsets đã loft để tính thủy tĩnh.
