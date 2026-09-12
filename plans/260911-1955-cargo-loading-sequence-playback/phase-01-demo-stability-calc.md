# Phase 01 — Demo stability calc engine (thuần TS, có test)

## Context Links
- [plan.md](plan.md)
- Dùng lại: `frontend/src/engine/hull/hydrostatic-table-calculator.ts` (`computeHydrostaticTable`, đã có + test — vessel-3d-model-pipeline phase 06), `frontend/src/data/demo-horizon-geometry.ts` (hull demo đã loft), `frontend/src/lib/geometry.ts` (`bayCenterX`, `rowCenterZ`, `tierCenterY`), `frontend/src/lib/ship-frame.ts` (quy ước toạ độ)
- Công thức tham khảo gốc: P1-demo [phase-06](../260911-0945-p1-frontend-stowage-demo/phase-06-indicative-stability-and-ship-attitude.md) §Calc — **chuyển thể**, không copy nguyên (đổi nguồn bảng thủy tĩnh, đổi quy ước LCG sang "từ AP" thay vì "từ midship" cho khớp với ship frame đã chốt ở vessel-3d-model-pipeline phase 01)

## Overview
- Priority: cao — đây là phần "vật lý" cốt lõi mà cả plan tồn tại vì nó · Size: M · Status: complete

## Key Insights
- **Không gõ tay bảng thủy tĩnh demo** — dùng `computeHydrostaticTable(offsets, particulars, {drafts})` (đã có, đã test ở vessel-3d-model-pipeline phase 06) tính TRỰC TIẾP từ hull đã loft của `demo-horizon-geometry.ts`. Khớp đúng hình dạng vỏ tàu demo thay vì số bịa tay.
- Bảng thủy tĩnh có sẵn chỉ theo LƯỚI MỚN NƯỚC rời rạc (ví dụ mỗi 0.5m) — cần nội suy tuyến tính giữa 2 hàng để tra KM/LCB/LCF/MTC/TPC tại một Δ (lượng giãn nước) bất kỳ, không phải tại đúng một mớn đã tính sẵn.
- LCB/LCF từ `computeHydrostaticTable` đã ở ship frame (x từ AP) — **cùng quy ước** với vị trí container (qua `bayCenterX`+lbp/2). Không cần đổi qua "từ midship" như bản P1-demo gốc — đơn giản hơn, ít chỗ sai dấu hơn.
- Vị trí trọng tâm mỗi container (LCG/TCG/VCG) tính từ `Slot` có sẵn: `x_ship = bayCenterX(vessel, slot.bay) + lbp_m/2`, `y_ship (TCG) = rowCenterZ(vessel, slot.row)` (đã là ship-frame y, +mạn phải, không cần đổi), `z_ship (VCG) = tierCenterY(slot.tier) + depth_m` (nghịch đảo của `shipToScene`: `sceneY = shipZ - depth_m`).
- Đã kiểm tra nhanh: tàu demo cho Δ≈29,945t tại mớn thiết kế 9.8m (Cb=0.68) — dùng số này để CHỌN lightship/hằng số hợp lý (xem Implementation Steps 4), không đoán mò.
- An toàn trước, số liệu sau (RT-7, giữ nguyên từ P1-demo phase-06): GM ≤ 0.15m → trạng thái nguy hiểm, KHÔNG hiện góc nghiêng (hiện số sai còn nguy hiểm hơn không hiện). Δ ngoài bảng đã tính → lỗi rõ ràng, không suy diễn ngoại suy.

## Requirements
- F1 `engine/hydrostatic-table-lookup.ts`: `interpolateHydrostatics(table: HydrostaticRow[], targetDisplacementT: number): HydrostaticRow | null` — nội suy tuyến tính TẤT CẢ trường giữa 2 hàng kề nhau theo Δ mục tiêu; `null` nếu ngoài khoảng bảng.
- F2 `engine/stability-indicative.ts`: `computeIndicativeStability(input): StabilityResult` — tính Δ/KG/LCG/TCG từ lightship+hằng số+cargo; tra `interpolateHydrostatics`; GM=KMt−KG; list=atan(TCG/GM) (chỉ khi GM>ngưỡng); trim=Δ(LCG−LCB)/(100·MTC); T_f/T_a từ T_mean+trim. Trả về `status: "ok"|"warning"|"critical"|"out_of_range"` + mảng `messages`.
- F3 `data/demo-lightship.ts`: hằng số lightship + "constant" (FO/DO/FW/crew gộp) — số liệu DEMO, chọn sao cho GM hợp lý ở cả tàu rỗng và tàu đầy (xem bước 4).
- NF: toàn bộ pure function, không phụ thuộc React/three; test bao phủ mọi nhánh status.

## Architecture
```ts
// engine/hydrostatic-table-lookup.ts
import type { HydrostaticRow } from "./hull/hydrostatic-table-calculator";
export function interpolateHydrostatics(table: HydrostaticRow[], targetDisplacementT: number): HydrostaticRow | null {
  const sorted = [...table].sort((a, b) => a.displacement_t - b.displacement_t);
  const min = sorted[0], max = sorted[sorted.length - 1];
  if (targetDisplacementT < min.displacement_t || targetDisplacementT > max.displacement_t) return null;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    if (targetDisplacementT >= a.displacement_t && targetDisplacementT <= b.displacement_t) {
      const f = (targetDisplacementT - a.displacement_t) / (b.displacement_t - a.displacement_t);
      return lerpRow(a, b, f);
    }
  }
  return null; // không tới được nếu sorted có >=2 phần tử và target trong khoảng
}
function lerpRow(a: HydrostaticRow, b: HydrostaticRow, f: number): HydrostaticRow { /* lerp từng field số */ }
```
```ts
// engine/stability-indicative.ts
import type { HydrostaticRow } from "./hull/hydrostatic-table-calculator";
import { interpolateHydrostatics } from "./hydrostatic-table-lookup";

export interface WeightItem { weight_t: number; lcg_m: number; tcg_m: number; kg_m: number; }
export type StabilityStatus = "ok" | "warning" | "critical" | "out_of_range";
export interface StabilityResult {
  status: StabilityStatus;
  displacement_t: number;
  kg_m: number; lcg_m: number; tcg_m: number;
  draft_mean_m: number | null; draft_fwd_m: number | null; draft_aft_m: number | null;
  gm_m: number | null;
  list_deg: number | null;  // + = nghiêng mạn phải (starboard)
  trim_m: number | null;    // + = chúi mũi (by the head)
  messages: string[];
}

const GM_CRITICAL_M = 0.15, GM_WARNING_M = 0.5;
const LIST_ERROR_DEG = 5, LIST_WARNING_DEG = 2;
const TRIM_WARNING_M = 1.5;

export function computeIndicativeStability(
  lightship: WeightItem, constant: WeightItem, cargo: WeightItem[],
  hydrostatics: HydrostaticRow[], lbpM: number, maxDraftM: number
): StabilityResult {
  const items = [lightship, constant, ...cargo];
  const displacement_t = items.reduce((s, i) => s + i.weight_t, 0);
  const lcg_m = items.reduce((s, i) => s + i.weight_t * i.lcg_m, 0) / displacement_t;
  const tcg_m = items.reduce((s, i) => s + i.weight_t * i.tcg_m, 0) / displacement_t;
  const kg_m = items.reduce((s, i) => s + i.weight_t * i.kg_m, 0) / displacement_t;

  const row = interpolateHydrostatics(hydrostatics, displacement_t);
  if (!row) return { status: "out_of_range", displacement_t, kg_m, lcg_m, tcg_m, draft_mean_m: null, draft_fwd_m: null, draft_aft_m: null, gm_m: null, list_deg: null, trim_m: null, messages: [`Displacement ${displacement_t.toFixed(0)}t outside the computed hydrostatic table range`] };

  const gm_m = row.kmt_m - kg_m;
  const messages: string[] = [];
  if (gm_m <= GM_CRITICAL_M) {
    return { status: "critical", displacement_t, kg_m, lcg_m, tcg_m, draft_mean_m: row.draft_m, draft_fwd_m: null, draft_aft_m: null, gm_m, list_deg: null, trim_m: null, messages: ["GM at or below 0.15 m — unstable, angle not shown"] };
  }

  const list_deg = (Math.atan(tcg_m / gm_m) * 180) / Math.PI;
  const trim_m = (displacement_t * (lcg_m - row.lcb_m)) / (100 * row.mtc_t_m_per_cm);
  const draft_fwd_m = row.draft_m + (trim_m * (lbpM / 2 - row.lcf_m)) / lbpM;
  const draft_aft_m = row.draft_m - (trim_m * (lbpM / 2 + row.lcf_m)) / lbpM;

  let status: StabilityStatus = "ok";
  if (gm_m < GM_WARNING_M || Math.abs(list_deg) > LIST_WARNING_DEG || Math.abs(trim_m) > TRIM_WARNING_M) status = "warning";
  if (Math.abs(list_deg) > LIST_ERROR_DEG || Math.max(draft_fwd_m, draft_aft_m) > maxDraftM) status = "critical";

  return { status, displacement_t, kg_m, lcg_m, tcg_m, draft_mean_m: row.draft_m, draft_fwd_m, draft_aft_m, gm_m, list_deg, trim_m, messages };
}
```
Vị trí container (dùng ở phase 02, không phải trong file này — giữ `stability-indicative.ts` thuần, không phụ thuộc `Vessel`/`Slot`):
```ts
// helper riêng, ví dụ trong lib/geometry.ts hoặc file mới cargo-weight-item.ts
export function cargoWeightItem(vessel: Vessel, geometry: VesselGeometry, container: Container, slot: Slot): WeightItem {
  return {
    weight_t: container.weight_t,
    lcg_m: bayCenterX(vessel, slot.bay) + geometry.particulars.lbp_m / 2,
    tcg_m: rowCenterZ(vessel, slot.row),
    kg_m: tierCenterY(slot.tier) + geometry.particulars.depth_m,
  };
}
```

## Related Code Files
- Create: `frontend/src/engine/hydrostatic-table-lookup.ts`, `frontend/src/engine/stability-indicative.ts`, `frontend/src/lib/cargo-weight-item.ts`, `frontend/src/data/demo-lightship.ts`, tests cho cả 4 file
- Modify: none (phase này thuần thêm mới, không sửa gì hiện có)
- Delete: none

## Implementation Steps
1. `hydrostatic-table-lookup.ts` + test: nội suy đúng giữa 2 hàng; đúng giá trị TẠI một hàng có sẵn (f=0 hoặc f=1); `null` khi Δ nhỏ hơn min hoặc lớn hơn max của bảng; bảng chỉ 1 hàng → coi input không hợp lệ (throw hoặc `null`, chọn 1 và test rõ).
2. `stability-indicative.ts` + test (dùng bảng THẬT: `computeHydrostaticTable(demo-horizon offsets, particulars, {drafts: [dải mớn hợp lý, ví dụ 3..13 bước 0.5]})`, không phải bảng giả):
   - Tải đối xứng (mọi cargo tcg_m=0) → `list_deg` ≈ 0.
   - Cargo lệch hẳn sang mạn phải (tcg_m dương) → `list_deg` dương (đúng hướng — nghiêng về mạn nặng hơn).
   - `kg_m` đủ cao để GM≤0.15 → `status: "critical"`, `list_deg: null`.
   - Δ vượt quá hàng lớn nhất trong bảng đã tính → `status: "out_of_range"`.
   - Trim dấu đúng: LCG lệch về mũi (x lớn hơn LCB) → `trim_m` dương (chúi mũi theo quy ước đã chọn) — xác nhận bằng một case cụ thể, không chỉ tin công thức.
3. `cargo-weight-item.ts` + test: một vài `Slot` cụ thể trên tàu demo → so khớp thủ công với `slotToPosition`/`bayCenterX` hiện có (không được lệch khỏi vị trí container đã render trong 3D).
4. `demo-lightship.ts`: chọn `lightship`/`constant` (weight/lcg/kg) sao cho:
   - Tàu RỖNG (chỉ lightship+constant, cargo=[]) → GM trong khoảng hợp lý cho tàu container (ví dụ 1–3m), không rơi vào `critical`/`out_of_range`.
   - Tàu ĐẦY (dùng `naiveFillPlan` demo thật, ~470 container 40') → GM vẫn dương, không quá thấp; `list_deg` nhỏ (thuật toán fill không cố ý cân bằng mạn, nên có thể lệch — chấp nhận miễn còn nhỏ, không assert bằng 0).
   - Đây là việc THỬ VÀ CHỈNH (chạy test, xem số, chỉnh `lightship`/`constant`), không đoán mò — ghi số liệu cuối cùng đã chọn vào code comment kèm lý do (ví dụ "Δ rỗng ~14,500t để GM≈2m khi rỗng").
5. `npm run typecheck && npm test && npm run build`.

## Todo List
- [x] `hydrostatic-table-lookup.ts` + test (6 test: giá trị đúng tại một hàng có sẵn, nội suy, ngoài khoảng cả 2 đầu, bảng <2 hàng, không cần bảng đã sort sẵn)
- [x] `stability-indicative.ts` + test (10 test: đối xứng, lệch mạn phải/trái đúng dấu, critical, out_of_range, trim mũi/lái đúng dấu, + 3 test trên tàu demo THẬT)
- [x] `cargo-weight-item.ts` + test khớp với `slotToPosition` hiện có (round-trip qua `shipToScene` cho 3 slot khác nhau, sai số <1e-6)
- [x] `demo-lightship.ts` — số liệu đã tune, GM hợp lý ở cả rỗng và đầy (kiểm bằng test thật trên `naiveFillPlan` — **đạt ngay lần thử đầu tiên**, không cần lặp lại nhiều vòng)
- [x] typecheck/test/build xanh (252/252, tăng từ 242)

## Phát hiện ngoài kế hoạch: bug Cb thật ở hull demo (vessel-3d-model-pipeline phase 02)
Khi tính bảng thủy tĩnh thật để chọn số lightship, phát hiện `blockCoefficient` trên hull demo cho **0.8646**, không phải `particulars.cb: 0.68` như khai báo. Nguyên nhân: `parallel_midbody: [0.1, 0.9]` (chỉnh ở vessel-3d-model-pipeline phase 02 để bay 2/38 không xuyên vỏ) khiến 80% chiều dài tàu LUÔN ở full beam — về mặt hình học, Cb tối thiểu đạt được ở cấu hình này là ~0.86 dù entrance power giảm xuống cực trị (`ENTRANCE_POWER_MIN=0.4`), không cách nào xuống 0.68. Đã kiểm tra bằng cách quét toàn bộ target Cb {0.55..0.85} — TẤT CẢ đều saturate về 0.8646.
**Đã sửa (tối thiểu, an toàn)**: cập nhật `particulars.cb` trong `demo-horizon-geometry.ts` thành `0.86` (đúng thực tế, có comment giải thích) — KHÔNG đổi hình học/mesh (offsets không đổi, vì `blockCoefficient` không phụ thuộc field `cb` sau khi đã fit xong). Bảng thủy tĩnh dùng cho stability calc vẫn đúng (tính từ offsets THẬT, không phụ thuộc `cb` ghi trên nhãn).
**Chưa sửa** (thuộc phạm vi khác, không phải plan này): hull demo giờ boxy hơn dự định (Cb 0.86 thay vì 0.68) — cách sửa đúng là thu hẹp `parallel_midbody` lại và bỏ hàng ngoài cùng under-deck ở bay 2/38 (phương án (b) đã ghi sẵn ở vessel-3d-model-pipeline phase 02's plan, chưa làm khi đó) — đụng `demo-container-vessel.ts` (file P1-demo sở hữu), nên để plan khác xử lý.

## Bug thứ hai tự phát hiện: test tự viết sai, không phải code sai
5/10 test ban đầu fail vì `SIMPLE_TABLE` (bảng tự tạo cho unit test) có khoảng Δ [10000,19500] nhưng tổng trọng lượng dùng trong test chỉ ~9000t — rơi ra ngoài bảng, `status` thành `out_of_range` một cách âm thầm. Test đầu tiên ("symmetric list=0") **PASS NHẦM** vì `toBeCloseTo(0,6)` coerce `null` thành `0` khi so sánh; các test còn lại (`toBeGreaterThan`/`toBeLessThan`) bắt lỗi đúng ("received object" — tức `null`). Đã sửa: mở rộng khoảng bảng test xuống [5000,19500], thêm `expect(status).toBe("ok")` ở test đối xứng để chặn kiểu pass-nhầm này tái diễn.

## Số liệu đã chọn (đã verify, không phải đoán)
- `DEMO_LIGHTSHIP`: 13,000t, LCG 75m (lệch lái so với midship 80m), KG 9.5m.
- `DEMO_CONSTANT`: 1,500t, LCG 70m, KG 4m (thấp, mô phỏng két nhiên liệu/nước).
- Tàu rỗng (Δ=14,500t): GM > 0.5m, không critical/out_of_range.
- Tàu đầy (naiveFillPlan, Δ≈14,500+8,179=22,679t, 470 container 40'): GM > 0.15m, |list| < 5°, status `ok`/`warning`, không `critical`/`out_of_range`.

## Success Criteria
- Test bao phủ đủ 4 nhánh status (`ok`/`warning`/`critical`/`out_of_range`) và ít nhất 1 test dấu (list, trim) xác nhận đúng hướng vật lý bằng số cụ thể — **đạt**.
- Chạy `computeIndicativeStability` trên plan demo đầy đủ (naiveFillPlan) cho kết quả `status !== "out_of_range"` và `status !== "critical"` — **đạt ngay lần đầu**, không cần hạ ngưỡng.

## Risk Assessment
| Rủi ro | Giảm thiểu |
|---|---|
| Δ tàu đầy vượt quá dải mớn nước đã tính trong `computeHydrostaticTable` (bảng chỉ tính ở các mớn cụ thể, không tự mở rộng) | Bước 2 dùng dải mớn đủ rộng (ví dụ tới gần depth_m) khi gọi `computeHydrostaticTable`; bước 4 kiểm tra Δ đầy tải nằm trong dải |
| Dấu list/trim sai (nhầm mạn, nhầm mũi/lái) | Test dấu cụ thể ở bước 2, không chỉ tin công thức chép lại |
| Lightship/constant chọn tuỳ tiện khiến GM phi thực tế (âm hoặc quá lớn) | Bước 4 yêu cầu tune bằng test thật, ghi lý do vào comment |

## Security Considerations
N/A — tính toán thuần client-side, dữ liệu synthetic.

## Next Steps
- Phase 02 dùng `computeIndicativeStability` + `cargoWeightItem` để tính tư thế tàu (list/trim/sinkage) và áp vào `ShipGroup` trong 3D.
