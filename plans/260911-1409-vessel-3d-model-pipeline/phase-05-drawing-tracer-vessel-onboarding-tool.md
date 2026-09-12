# Phase 05 — Công cụ onboarding tàu: tracing GA / body plan / capacity plan

## Context Links
- [plan.md](plan.md) G1, G4, G5 · [phase-03](phase-03-component-library-livery-paint-render-perf.md) (palette linh kiện) · [phase-04](phase-04-offsets-import-fairness-check-lofting.md) (offsets pipeline, BodyPlanView)
- Roadmap reference §4 (công cụ onboarding tàu), RT-2 (vessel data versioned/immutable), RT-14 (file import security)

## Overview
- Priority: P1 thương mại (đây là lợi thế UX: rút việc dựng tàu từ vài ngày xuống vài giờ) · Size: L · Status: **partial** — chỉ lớp engine thuần (calibration, bay-LCG, body-plan digitizer, publish checklist); pdf.js/canvas UI CHƯA làm, xem Deviations
- **G6: không áp dụng cho phần đã làm** — 4 module engine mới không có bề mặt UI (chưa mount vào `App.tsx`), nên không có gì để "wire vào demo". Đây KHÔNG phải bỏ sót G6, mà là quyết định phạm vi có chủ đích: phần UI thật (pdf.js, canvas, drag-drop) cần một trình duyệt để dựng/kiểm chứng đúng, và phiên làm việc này không có công cụ browser + đang bị giới hạn rate limit của tài khoản (subagent review không chạy được) — rủi ro dựng UI phức tạp mà không kiểm chứng được là quá cao. Xem Deviations.
- Người dùng tải PDF/ảnh bản vẽ lên làm nền, căn tỉ lệ bằng các điểm đã biết (AP, FP), rồi click để đặt cabin, cẩu, miệng hầm, tâm các bay, và số hoá body plan khi không có bảng offsets. Kết quả là một `VesselGeometry` hoàn chỉnh.

## Key Insights
- Bản scan thường bị lệch góc và co giãn nhẹ. Căn chỉnh bằng phép similarity 2 điểm (tỉ lệ + xoay + tịnh tiến) cho mỗi view, cộng **điểm thứ ba để đo sai số** (residual), sẽ bắt được scan bị méo.
- Sau khi căn, vẽ **thước số sườn** (từ `frames[]`) chồng lên bản vẽ. Nếu vạch sườn trùng vạch trên bản vẽ thì hệ toạ độ đúng (G1). Đây là bước kiểm chứng rẻ và thuyết phục nhất.
- Một bản vẽ GA có nhiều view (profile: x–z; plan: x–y; body plan: y–z). Mỗi vùng view có calibration riêng. Linh kiện lấy toạ độ từ view phù hợp.
- Dùng chung một component canvas cho GA, capacity plan và body plan (DRY). Số hoá body plan đi thẳng vào pipeline offsets của phase 04 (fairness → loft).
- Tâm bay từ capacity plan cho **LCG thật** của slot, thay cho `LAYOUT` tinh chỉnh tay (TODO trong `lib/geometry.ts`).

## Requirements
- F1 Mở PDF (pdf.js, render trong trình duyệt) hoặc PNG/JPG; chọn trang; pan/zoom mượt ở bản vẽ ≥ 8k px.
- F2 Khai báo vùng view: `profile`, `plan`, `body_plan`, `capacity_profile`.
- F3 Calibration mỗi view: 2 điểm đã biết (profile/plan: AP và FP trên baseline/centreline; body plan: centreline∩baseline và điểm B/2) → similarity; điểm thứ 3 tuỳ chọn → residual (m), cảnh báo nếu > 0.2% LBP; tuỳ chọn affine 3 điểm cho scan bị kéo giãn.
- F4 Overlay thước số sườn + đường baseline/DWL; overlay mesh loft hiện tại lên profile và body plan.
- F5 Palette đặt linh kiện: superstructure (kéo hình chữ nhật trên profile + bề rộng từ plan), funnel, crane (bệ trên plan + cao độ trên profile + form SWL/tầm với), mast, lifeboat, hatch opening (chữ nhật trên plan). Snap vào sườn; form số sửa được.
- F6 Bay calibration: click tâm bay trên capacity profile → bảng `bay → lcg_m` → vị trí slot. Cách thay thế: nhập CSV `bay,row,tier,lcg,tcg,vcg`.
- F7 Body plan digitizer: chọn station → click các điểm dọc đường cong → resample tại các WL chuẩn → `HullOffsets` → fairness + loft (phase 04).
- F8 Checklist trước khi publish:
  - Residual calibration đạt.
  - Cảnh báo fairness đã xử lý (hoặc bỏ qua có ghi log).
  - `slots-inside-hull` = 0 issue.
  - Linh kiện nằm trong LOA/B.
  - `validateVesselGeometry` sạch.
- F9 Sister ship: clone `VesselGeometry` → đổi tên/IMO/livery (G4).
- F10 **(G6, bắt buộc)** `VesselOnboardingPage.tsx` PHẢI có đường dẫn thật từ app đang chạy (nút/tab từ `App.tsx`), xác nhận qua dev server trước khi đánh dấu phase complete.
- NF: thời gian onboarding L2 ≤ 3 giờ/tàu, đo trên 2 tàu tham chiếu.

## Architecture
```
engine/vessel-onboarding/
  drawing-calibration.ts        solveSimilarity(2 pts), solveAffine(3 pts), residual(pt)
  drawing-view-mapping.ts       view type → which ship axes (profile x,z | plan x,y | body y,z)
  body-plan-to-offsets.ts       traced polylines per station → HullOffsets (resample at WLs)
  bay-lcg-from-trace.ts         clicked bay centres → { bay: lcg_m }
  onboarding-publish-checklist.ts
features/vessel-onboarding/
  VesselOnboardingPage.tsx      split: DrawingCanvas | live 3D (VesselModel)
  DrawingCanvas.tsx             pdf.js page → canvas; pan/zoom; overlays layer (SVG)
  CalibrationTool.tsx  ViewRegionTool.tsx  FrameRulerOverlay.tsx
  ComponentPlacementTool.tsx    BodyPlanDigitizer.tsx  BayCalibrationTool.tsx
  OnboardingChecklist.tsx
store/useOnboardingStore.ts     draft VesselGeometry + undo (reuse history pattern of P1-demo ph02)
```
- Frontend-only: nhập và xuất `VesselGeometry` JSON. Khi roadmap P2 có DB thì lưu theo tenant, có version, bất biến sau khi publish (RT-2). Plan tham chiếu `geometry_id@version`.
- Dependency mới: `pdfjs-dist` (≥ 4.2.67). Worker bundle local, không dùng CDN.

## Related Code Files
- Create: các file liệt kê trên + tests `engine/vessel-onboarding/__tests__/{drawing-calibration,body-plan-to-offsets,bay-lcg-from-trace,onboarding-publish-checklist}.test.ts`
- Modify: `frontend/package.json` (`pdfjs-dist`), `App.tsx` (mode Onboarding), `lib/geometry.ts` (dùng bảng bay LCG khi geometry có), `types/vessel-geometry.ts` (thêm `bay_lcg_m?: Record<number, number>`)
- Delete: none

## Implementation Steps
1. `drawing-calibration.ts` + tests:
   - Round-trip similarity với xoay 3° và scale bất kỳ.
   - Affine khôi phục đúng co giãn trục.
   - Residual = 0 với điểm chính xác.
2. `DrawingCanvas` + pdf.js (`isEvalSupported: false`, giới hạn kích thước/trang/độ phân giải render) + pan/zoom.
3. View region + calibration UI + thước số sườn. Kiểm tra bằng bản vẽ synthetic tự vẽ (SVG → PDF) có sẵn các vạch sườn.
4. Palette đặt linh kiện (dùng builder phase 03); preview 3D đồng bộ.
5. Bay calibration + nhập CSV slot coords. Chạy lại `slots-inside-hull`.
6. Body plan digitizer → offsets → fairness → loft. Test: số hoá body plan của Wigley (render SVG) → Cb ±0.01.
7. Checklist + publish (download JSON) + clone sister ship.
8. Pilot có bấm giờ trên 2 tàu tham chiếu (người làm: dev + 1 người dùng mục tiêu), ghi `docs/research/v2-discovery/vessel-onboarding-timing.md`.

## Deviations from the plan as written
**Đã làm** (4 file `engine/vessel-onboarding/*.ts`, tất cả pure function, có test, đã tự kiểm chứng — KHÔNG qua subagent do rate limit tài khoản, xem plan.md):
- `drawing-calibration.ts`: `solveSimilarity` (2 điểm, chia số phức để lấy scale+xoay trong một bước, không cần lượng giác), `solveAffine` (3 điểm, công thức ma trận 2×2 chuẩn: A = M'·M⁻¹), `residual`. Test round-trip với xoay 3° + scale bất kỳ, và một điểm thứ 3 KHÔNG dùng để giải vẫn map đúng (chứng minh đúng là biến đổi toàn cục, không phải overfit 2 điểm).
- `bay-lcg-from-trace.ts`: click → `bay_lcg_m`, cộng cảnh báo sanity (bay lạ, click trùng lặp). Bỏ định dạng CSV thay thế `bay,row,tier,lcg,tcg,vcg` (F6) — không khớp kiểu `bay_lcg_m` hiện có (chỉ theo bay, không theo slot); để dành khi kiểu dữ liệu mở rộng.
- `body-plan-to-offsets.ts`: đường cong click (keel→deck) → offsets tại các waterline chuẩn, tái dùng spline Catmull-Rom của phase 02. Test: dựng lại đúng một đường cong quadratic đã biết trong sai số 2%.
- `onboarding-publish-checklist.ts`: gộp calibration residual + fairness count + `checkSlotsInsideHull` (phase 02) + `validateVesselGeometry` (phase 01) thành một verdict `readyToPublish`. Test bằng chính tàu demo thật (không phải fixture giả): cả 4 điều kiện chặn publish đều có test riêng.

**CHƯA làm** (cắt phạm vi có chủ đích, không phải quên):
- `DrawingCanvas.tsx` + pdf.js — cần thêm dependency mới (`pdfjs-dist`), có bề mặt bảo mật cần cân nhắc kỹ (CVE-2024-4367 đã ghi trong Security Considerations), và cần trình duyệt thật để kiểm chứng pan/zoom/render PDF hoạt động đúng.
- `CalibrationTool.tsx`, `ViewRegionTool.tsx`, `FrameRulerOverlay.tsx`, `ComponentPlacementTool.tsx`, `BodyPlanDigitizer.tsx`, `BayCalibrationTool.tsx`, `OnboardingChecklist.tsx`, `VesselOnboardingPage.tsx` — toàn bộ UI tương tác (kéo thả, click-to-place, canvas overlay).
- `useOnboardingStore.ts` — chưa cần vì chưa có UI để giữ state.
- `package.json` (`pdfjs-dist`), mount vào `App.tsx` — không làm vì chưa có UI để mount.
- Pilot bấm giờ trên tàu tham chiếu thật — không thể làm (không có dữ liệu tàu thật, không có người dùng thật trong phiên).

## Todo List
- [x] calibration math + tests (5 test, round-trip similarity + affine)
- [ ] DrawingCanvas + pdf.js an toàn
- [ ] view regions + calibration UI + thước số sườn
- [ ] palette đặt linh kiện + preview 3D
- [x] bay calibration (hàm thuần) — CHƯA có UI click
- [x] body plan digitizer → offsets (hàm thuần) — CHƯA có UI trace
- [x] checklist (hàm thuần, test qua tàu demo thật) — CHƯA có UI publish/clone sister ship
- [ ] pilot bấm giờ 2 tàu
- [ ] **(G6, chưa áp dụng được)** mount `VesselOnboardingPage` vào `App.tsx` — chờ UI thật

## Success Criteria
- Residual calibration trên bản vẽ tàu tham chiếu ≤ 0.2% LBP; thước sườn trùng vạch trên bản vẽ. — **chưa đo được** (không có bản vẽ/UI thật).
- Onboarding L2 ≤ 3 giờ/tàu (đo thật); sister ship ≤ 15 phút. — **chưa đo được**.
- Mô hình nhìn giống ảnh tàu thật (người dùng mục tiêu xác nhận). — **chưa làm được**.
- **(G6)** Trang onboarding bấm được từ app đang chạy. — **chưa đạt**, xem lý do ở Overview.
- Đạt: `npm run typecheck`, `npm run build`, `npm test` (210/210) xanh; 4 module engine mới đều có test độc lập, một số dùng trực tiếp tàu demo thật (không phải fixture giả) để test.

## Risk Assessment
| Rủi ro | Giảm thiểu |
|---|---|
| Scan chất lượng thấp, nhiều trang | Chọn trang, zoom sâu, calibration riêng từng view, residual cảnh báo |
| Người dùng không biết AP/FP nằm đâu trên bản vẽ | Hướng dẫn trong app + hình minh hoạ; mặc định dùng đường vuông góc có ghi trên bản vẽ |
| Scope phình (biến thành CAD tool) | Chỉ đặt linh kiện có sẵn + số hoá station; không vẽ tự do (YAGNI) |
| Công cụ quá chuyên môn cho planner | Người dùng mục tiêu là đội onboarding của mình/đại lý ở giai đoạn đầu; tự phục vụ ở phase 07 |

## Security Considerations
- pdf.js từng có lỗ hổng thực thi JS (CVE-2024-4367): dùng ≥ 4.2.67 và `isEvalSupported: false`; không bật form/JS trong PDF.
- Bản vẽ chỉ xử lý trong trình duyệt, không upload ở phase này (G5). Giới hạn file ≤ 50 MB, ≤ 50 trang, canvas ≤ 16k px.
- `VesselGeometry` xuất ra không nhúng ảnh bản vẽ, chỉ số liệu.

## Next Steps
- Phase 06 dùng offsets đã số hoá để tính thủy tĩnh. Phase 07 mở cho khách hàng tự làm (auth, tenant, lưu trữ).
