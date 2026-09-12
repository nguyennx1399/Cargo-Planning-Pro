# Phase 06 — Thủy tĩnh tính từ offsets + đối chiếu stability booklet

## Context Links
- [plan.md](plan.md) G2, G3 · [phase-02](phase-02-parametric-hull-generator-and-loft-mesher.md) (`section-integrals.ts`) · [phase-04](phase-04-offsets-import-fairness-check-lofting.md)
- Roadmap: RT-2 (no assumed tables outside sandbox; UNVERIFIED watermark + export block), RT-7 (KN tables from booklet), RT-8 (version-stamped results); phase-00 0.4 (bảng thủy tĩnh booklet 2 tàu)
- P1-demo [phase-06](../260911-0945-p1-frontend-stowage-demo/phase-06-indicative-stability-and-ship-attitude.md) (định dạng bảng: Δ, T, KM, LCB, LCF, MTC, TPC)

## Overview
- Priority: P2 (giảm rủi ro lớn nhất: thiếu bảng thủy tĩnh) · Size: M · Status: complete (core scope; booklet-compare UI chưa mount — xem Deviations) · Roadmap P4 (có thể kéo sớm, xem Unresolved)
- Tích phân offsets để ra bảng thủy tĩnh even-keel theo mớn nước, rồi đối chiếu với booklet. Sai lệch nhỏ chứng tỏ mô hình vỏ tàu đúng.

## Key Insights
- Tính một lần lúc onboarding (không tính mỗi thao tác), rồi lưu thành bảng có provenance. Engine stability đọc **bảng**, không đọc thuật toán. Vì vậy chỉ cần một implementation TS dùng lại `section-integrals` (không phải viết bản song song trong Python, không vướng parity RT-8).
- Offsets là kích thước moulded. Δ booklet gồm tôn vỏ và phụ vật (bánh lái, chân vịt, ki hông), thường lớn hơn 0.3–1%. Dùng một hệ số `displacement_factor`, **chỉ hiệu chỉnh tại 1 mớn nước** và kiểm chứng ở các mớn còn lại. Nếu fit ở mọi mớn thì sẽ che mất lỗi.
- **Nói thẳng:** bảng computed không phải dữ liệu được đăng kiểm phê duyệt. Tính ổn định cho vận hành phải dùng booklet (IACS UR L5). Computed chỉ dùng để (a) kiểm chứng hull, (b) điền chỗ trống với nhãn `computed` + watermark + chặn export (RT-2), (c) sandbox/demo.
- Chỉ tính even-keel upright. KN/GZ (tàu nghiêng) và hydrostatics khi chúi lớn ngoài phạm vi. KN lấy từ booklet (RT-7).

## Requirements
- F1 `computeHydrostaticTable(geometry, {drafts, rho = 1.025, displacement_factor = 1.0}) → HydrostaticRow[]`, mỗi hàng gồm: T, ∇, Δ, KB, LCB, Awp, LCF, TPC, BMt, KMt, BMl, MTC, Cb, Cm, Cwp. Toạ độ theo ship frame, và có cột quy đổi "from midship" để khớp định dạng booklet.
- F2 Nhập bảng booklet (CSV theo template P0) → `compareHydrostatics(computed, booklet, tolerances) → report` (sai lệch từng ô, pass/fail từng đại lượng).
- F3 UI: bảng so sánh + biểu đồ từng đại lượng theo mớn (hai đường chồng nhau, vùng dung sai).
- F4 Kết quả lưu thành `HydrostaticTableRecord`: `{rows, status: "computed", provenance: {geometry_id, geometry_version, offsets_hash, engine_version, rho, displacement_factor}, booklet_check?: {passed, max_deviation_by_quantity}}`.
- F5 Nếu đạt dung sai, hull geometry được đánh dấu `verified` (hình học đã kiểm chứng). Bảng computed vẫn giữ `status: "computed"`.
- F6 **(G6, bắt buộc)** `HydrostaticsCheckPanel` PHẢI mount vào đường dẫn thật trong app đang chạy (trong `VesselOnboardingPage` của phase 05, hoặc tab riêng nếu phase 05 chưa xong) — không chỉ tồn tại như component có test.

Công thức (x từ AP, y half-breadth, tích phân dọc x):
```
A(x,T) = 2∫₀ᵀ y dz        ∇ = ∫A dx            Δ = ρ·∇·factor
LCB = ∫x·A dx / ∇         KB = ∫A·z̄(x) dx / ∇
Awp = 2∫y_wl dx           LCF = 2∫x·y_wl dx / Awp        TPC = Awp·ρ/100
I_T = (2/3)∫y_wl³ dx      BMt = I_T/∇        KMt = KB + BMt
I_L = 2∫(x−LCF)²·y_wl dx  BMl = I_L/∇        MTC ≈ Δ·BMl/(100·LBP)
Cb = ∇/(LBP·B·T)          Cm = A(midship)/(B·T)          Cwp = Awp/(LBP·B)
```
Dung sai đề xuất (cần naval architect/đăng kiểm xác nhận): Δ ±1.0%, LCB và LCF ±0.5% LBP, KMt ±1.0% (tối thiểu 0.05 m), TPC ±1.0%, MTC ±2.0%.

## Architecture
```
engine/hull/
  section-integrals.ts            (phase 02) + first/second moments of waterplane
  hydrostatic-table-calculator.ts geometry → HydrostaticRow[]
  hydrostatic-booklet-compare.ts  computed vs booklet → report
  hydrostatic-csv-io.ts           parse booklet CSV / export computed CSV (formula-escape)
features/vessel-onboarding/
  HydrostaticsCheckPanel.tsx      table + per-quantity chart (dataviz conventions)
```

## Related Code Files
- Create: 3 file engine + panel + tests `engine/hull/__tests__/{hydrostatic-table-calculator,hydrostatic-booklet-compare,hydrostatic-csv-io}.test.ts`
- Modify: `engine/hull/section-integrals.ts`, `types/vessel-geometry.ts` (`HydrostaticTableRecord`), `data/demo-hydrostatics.ts` (tuỳ chọn: sinh từ hull tham số)
- Delete: none

## Implementation Steps
1. Test giải tích TRƯỚC:
   - Sà lan hộp L×B×T: ∇, KB = T/2, BMt = B²/(12T), LCF = L/2, BMl = L²/(12T); sai số ≤ 1e-6.
   - Wigley: Cb = 4/9; Cwp = 2/3; KB và BMt theo công thức đóng.
2. Calculator: resample x đều (dùng spline dọc tàu của phase 02), composite Simpson; lưới mớn bước 0.1–0.2 m trong `[T_min, T_max]` của booklet.
3. CSV I/O + compare + tests (sai lệch và pass/fail đúng ở biên dung sai).
4. Panel so sánh + biểu đồ.
5. Chạy trên 2 tàu tham chiếu:
   - Hiệu chỉnh `displacement_factor` tại design draft, rồi kiểm ở ≥ 3 mớn khác.
   - Ghi báo cáo ở `plans/260911-1409-vessel-3d-model-pipeline/reports/`. Chỉ ghi số liệu sai lệch, không ghi bảng gốc nếu dữ liệu mật.
6. Tuỳ chọn (P1 demo): sinh `demo-hydrostatics.ts` từ hull tham số. Giữ nhãn DEMO DATA; test GM demo 0.5–2.5 m vẫn phải xanh.
7. Golden test cho tàu thật: chỉ khi đã có quyền dữ liệu (RT-1). Có thể dùng fixture đã **scale + đổi tên** (Δ ∝ λ³, chiều dài ∝ λ), vẫn cần chủ tàu đồng ý.

## Deviations from the plan as written
- **Tìm và sửa một bug thật ngay trong lúc tự viết test** (không qua subagent, rate limit chưa hết — xem plan.md): fixture Wigley DÙNG SAI hướng waterline cho việc test KB/BMt/Awp/Cwp. Fixture Wigley có sẵn từ phase 02/04 (`y` lớn nhất ở `z=0` đáy tàu, bằng 0 ở `z=T` mặt nước) là NGƯỢC với công thức Wigley chuẩn (beam lớn nhất PHẢI ở mặt nước thiết kế). Điều này không ảnh hưởng Cb (đối xứng qua phép lật z) nên các test Cb trước đó (phase 02, 04) vẫn đúng — nhưng sẽ cho kết quả sai/suy biến (Awp≈0) nếu dùng để test các đại lượng phụ thuộc hướng z như ở đây. Đã định nghĩa RIÊNG một fixture Wigley đúng hướng (`wigleyOffsetsWaterlineOriented`) chỉ trong file test của phase này — KHÔNG sửa fixture chung (rủi ro lan rộng quá cao khi không có subagent review). Ghi lại làm việc dọn dẹp sau: fixture Wigley dùng chung ở phase 02/04 nên được sửa hướng đúng, hoặc đổi tên rõ ràng để không gây hiểu lầm.
- **Một lỗi thứ hai tự tìm thấy VÀ tự sửa ngay trong test, không phải trong code**: hằng số KB kỳ vọng tay tính sai lần đầu (3T/8 thay vì 5T/8 đúng) — dùng tích phân số brute-force (lưới 2000×2000) để xác nhận công thức đúng trước khi sửa test. Code (`sectionMomentAboutBaseline`, `computeHydrostaticTable`) đã ĐÚNG từ đầu; chỉ giá trị kỳ vọng trong test bị sai.
- **`HydrostaticsCheckPanel` chỉ hiện bảng computed** — KHÔNG có UI upload booklet CSV / so sánh trực quan (biểu đồ theo mớn). `compareHydrostatics`/`parseBookletCsv` đều có, đều có test, nhưng chưa mount vào panel (cần thêm một input file + state, để dành cho lần sau khi có booklet thật để thử).
- **Chưa chạy trên 2 tàu tham chiếu thật** — không có dữ liệu tàu thật trong phiên này (giống phase 04, 05).

## Todo List
- [x] tests giải tích box + Wigley (11 test: box barge — ∇/KB/LCB/Awp/LCF/TPC/BMt/KMt/BMl/MTC/Cb/Cm/Cwp đều khớp công thức đóng; Wigley đúng hướng — Cb=4/9, Cwp=2/3, KB=5T/8)
- [x] hydrostatic-table-calculator (mở rộng `section-integrals.ts` phase 02: `sectionMomentAboutBaseline` tích phân đóng theo từng đoạn tuyến tính, không dùng trapezoidal đơn giản cho mô-men — chính xác hơn)
- [x] booklet CSV I/O + compare + tests (7+6 test — biên dung sai LCB/LCF theo %LBP, sàn tuyệt đối KMt, bỏ qua hàng booklet không khớp mớn nào đã tính)
- [x] HydrostaticsCheckPanel — bảng computed, CHƯA có booklet compare UI (xem Deviations)
- [ ] chạy 2 tàu tham chiếu + báo cáo sai lệch
- [ ] (tuỳ chọn) bảng demo sinh từ hull tham số
- [x] **(G6)** mount `HydrostaticsCheckPanel` vào `OffsetsImportPanel` (đã mount sẵn trong `App.tsx` từ phase 04) — không cần toggle mới, chỉ thêm section. Xác nhận: `npm run build` xanh, `curl localhost:5173` → HTTP 200. Chưa có ảnh chụp màn hình browser thật.

## Success Criteria
- Test giải tích xanh — đạt, 11 test (xem Todo).
- Cả 2 tàu tham chiếu: mọi đại lượng nằm trong dung sai ở ≥ 3 mớn — **chưa đo được** (không có tàu tham chiếu thật).
- Bảng computed luôn mang nhãn `computed`; UI và export tuân thủ RT-2 — đạt cho UI (banner "DEMO DATA... Not approved for operational stability use"); export CSV escape formula injection đã làm (`hydrostatic-csv-io.ts`), có ghi chú giới hạn (số âm hợp lệ sẽ bị escape nhầm — chưa có field nào âm trong sản phẩm hiện tại nên chưa phải vấn đề thật).
- **(G6)** Panel bấm được từ app đang chạy — đạt.
- `npm run typecheck`, `npm run build`, `npm test` (234/234) đều xanh; characterization snapshot không đổi; không có regression ở test phase 02 sau khi mở rộng `section-integrals.ts`.

## Risk Assessment
| Rủi ro | Giảm thiểu |
|---|---|
| Người dùng coi bảng computed là bảng phê duyệt | Nhãn `computed` ở mọi nơi hiển thị; không cho thay booklet trong luồng vận hành; câu chữ trong UI do người có chuyên môn duyệt |
| Sai lệch lớn do offsets thiếu phần mũi quả lê/đuôi | Profile stem/stern bắt buộc khi nhập; báo cáo sai lệch theo mớn giúp khoanh vùng (mớn thấp lệch → bulb/đáy) |
| Booklet dùng ρ hoặc gốc toạ độ khác | Ghi ρ, gốc, dấu ở P0 checklist; compare quy đổi trước khi so |

## Security Considerations
- Bảng booklet là dữ liệu mật: xử lý client-side, không commit; report chỉ chứa sai lệch.
- Export CSV escape formula (RT-14).

## Next Steps
- Roadmap P4 (ổn định chính xác) dùng booklet làm chuẩn, computed làm kiểm chứng chéo. Phase 07 có thể cắt lát mesh CAD ra offsets rồi đi qua cùng calculator.

## Unresolved Questions
- Kéo phase này lên sớm (P1/P2) để bảng demo và hull tham số nhất quán? Phần calculator nhỏ; phần đối chiếu booklet vẫn chờ dữ liệu P0.
