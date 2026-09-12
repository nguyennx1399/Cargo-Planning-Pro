# Phase 02 — ShipGroup 3D: nghiêng/nún thật, mặt nước cố định

## Context Links
- [plan.md](plan.md) · [phase-01](phase-01-demo-stability-calc.md) (`computeIndicativeStability`, `cargoWeightItem`)
- Code hiện tại: `frontend/src/features/viewer3d/{Hull,VesselScene,ContainerInstances}.tsx`, `frontend/src/App.tsx`, `frontend/src/features/panels/Sidebar.tsx`, `frontend/src/store/usePlanStore.ts`
- Công thức góc/tư thế tham khảo: P1-demo [phase-06](../260911-0945-p1-frontend-stowage-demo/phase-06-indicative-stability-and-ship-attitude.md) §3D attitude — **chuyển thể sang toán học cụ thể** đã derive lại cho đúng quy ước `shipToScene` đã chốt (xem Key Insights, khác vài chỗ so với mô tả gốc)

## Overview
- Priority: cao — biến kết quả tính ở phase 01 thành thứ NHÌN THẤY ĐƯỢC · Size: M · Status: complete

## Key Insights
- **Mặt nước phải TÁCH RA khỏi `Hull.tsx`.** Hiện `WaterlineReference` là con của group trong CHÍNH `Hull.tsx` (cả `LoftedHull` và `SimpleBoxHull`) — nghĩa là nó di chuyển CÙNG hull. Để tàu "nún xuống so với mặt nước cố định", mặt nước phải là anh em (sibling) NGOÀI group tàu trong `VesselScene.tsx`, không phải con của nó.
- **`shipToScene` (đã chốt từ vessel-3d-model-pipeline phase 01) coi scene y=0 là MẶT BOONG**, không phải mặt nước — đây là quy ước ĐÃ DÙNG xuyên suốt cho hull loft mesh, container, linh kiện. KHÔNG đổi quy ước này (rủi ro lan rộng quá lớn, đụng mọi phase 1-6 trước). Thay vào đó: đặt mặt nước cố định tại WORLD y=0 (đại diện mặt biển thật), và dịch CẢ NHÓM tàu (group) theo `position.y = depth_m − draft_mean_m` — khi đó: đáy tàu (local y=−depth_m) ra world y=−draft_mean_m (đúng, chìm đúng mớn nước); mặt boong (local y=0) ra world y=depth_m−draft_mean_m (đúng, đúng freeboard). Suy ra bằng tay, không đoán — xem Architecture.
- Nghiêng (list) = xoay quanh trục X (dọc tàu, x=mũi+); Chúi (trim) = xoay quanh trục Z (ngang tàu). Đây LÀ 2 trục cho ĐÚNG hiệu ứng vật lý (roll quanh trục dọc, pitch quanh trục ngang) — không phải chọn tuỳ ý.
- **Dấu góc xoay (rotation.x/z dương nghĩa là mạn nào xuống, mũi hay lái xuống) không đoán được chỉ bằng đọc code** — phải verify bằng toán/test cụ thể (dùng `THREE.Object3D`/`Vector3`, chạy được trong Node/vitest, KHÔNG cần WebGL/browser) chứ không suy đoán rồi hy vọng đúng. Xem Implementation Steps bước 1.
- Trạng thái `critical` (từ phase 01, `list_deg: null`) tự động cho góc = 0 (giữ tàu thẳng) nhờ `?? 0` fallback trong `computeShipTransform` — không cần logic riêng cho "ẩn góc khi nguy hiểm", nó tự đúng nhờ thiết kế dữ liệu ở phase 01.
- Góc thật RẤT NHỎ (chúi 1m trên chiều dài 160m ≈ 0.36°) — gần như không thấy bằng mắt nếu không phóng đại. Cần toggle "Exaggerate" (nhân góc lên, ví dụ ×5), tắt mặc định, có ghi rõ trong UI đây là phóng đại để dễ nhìn chứ không phải số thật.

## Requirements
- F1 `lib/ship-attitude-transform.ts`: `computeShipTransform(attitude, depthM, lbpM): {positionY, rotationX, rotationZ}` — hàm THUẦN, không phụ thuộc React/r3f (chỉ dùng số + có thể dùng `three` như một thư viện toán, không dựng scene).
- F2 `features/viewer3d/useShipAttitude.ts`: hook dùng `useFrame` + `THREE.MathUtils.damp` áp `computeShipTransform` lên group ref mỗi frame (mượt, không giật).
- F3 `features/viewer3d/WaterlineReference.tsx` (tách khỏi `Hull.tsx`): mặt phẳng CỐ ĐỊNH tại world y=0, không còn dựa vào `holdDepth()` (số tuỳ chỉnh cũ) — kích thước theo `vessel.length_m`/`beam_m` như cũ.
- F4 `VesselScene.tsx`: bọc `<Hull>` + `<ContainerInstances>` trong MỘT `<group ref={shipGroupRef}>`; mount `<WaterlineReference>` NGOÀI group đó (cố định); gọi `useShipAttitude(shipGroupRef, attitude, depthM, lbpM, exaggerate)`.
- F5 `lib/use-indicative-stability.ts`: hook orchestration — tra `geometry` từ `vessel.geometry_id`, tính bảng thủy tĩnh (memo theo geometry, KHÔNG tính lại mỗi lần plan đổi), gọi `cargoWeightItem` cho mọi placement, gọi `computeIndicativeStability` (phase 01). Trả `StabilityResult | null` (`null` nếu tàu không có `geometry_id` — ví dụ `SimpleBoxHull` fallback, không có gì để tính).
- F6 `features/panels/StabilityPanel.tsx`: hiện Δ/T_f/T_m/T_a/trim/list/GM/KG-KM, badge trạng thái, banner "DEMO DATA — not for operational use" LUÔN hiện, toggle Exaggerate.
- F7 `App.tsx`: gọi `useIndicativeStability`, truyền `attitude` xuống `VesselScene`, truyền xuống `Sidebar` để mount `StabilityPanel`.
- F8 `usePlanStore.ts`: thêm `exaggerate: number` (mặc định `1`), `toggleExaggerate: () => void` (1↔5).
- NF: `Hull.tsx` không còn tự vẽ mặt nước (xoá code cũ khỏi cả 2 path); không có test nào của `WaterlineReference` cũ bị mất ý nghĩa (không có test nào render nó trực tiếp, kiểm bằng `grep` trước khi xoá).

## Architecture
```ts
// lib/ship-attitude-transform.ts
export interface ShipAttitudeInput { draftMeanM: number | null; listDeg: number | null; trimM: number | null; }
export interface ShipTransform { positionY: number; rotationX: number; rotationZ: number; }

export function computeShipTransform(attitude: ShipAttitudeInput, depthM: number, lbpM: number): ShipTransform {
  const draft = attitude.draftMeanM ?? depthM * 0.6; // không có số (out_of_range) -> fallback hợp lý, không NaN
  return {
    positionY: depthM - draft, // suy ra trong Key Insights: keel ra world y=-draft, deck ra world y=depthM-draft
    rotationX: ((attitude.listDeg ?? 0) * Math.PI) / 180,
    rotationZ: -Math.atan((attitude.trimM ?? 0) / lbpM), // dấu: xem bước xác nhận ở Implementation Steps
  };
}
```
```ts
// features/viewer3d/useShipAttitude.ts
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { computeShipTransform, type ShipAttitudeInput } from "@/lib/ship-attitude-transform";

export function useShipAttitude(
  groupRef: React.RefObject<THREE.Group>,
  attitude: ShipAttitudeInput,
  depthM: number, lbpM: number, exaggerate: number
) {
  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const t = computeShipTransform(attitude, depthM, lbpM);
    const k = 3; // damping rate — điều chỉnh nếu thấy quá nhanh/chậm khi có công cụ browser
    group.position.y = THREE.MathUtils.damp(group.position.y, t.positionY, k, delta);
    group.rotation.x = THREE.MathUtils.damp(group.rotation.x, t.rotationX * exaggerate, k, delta);
    group.rotation.z = THREE.MathUtils.damp(group.rotation.z, t.rotationZ * exaggerate, k, delta);
  });
}
```
```tsx
// VesselScene.tsx — thêm vào JSX hiện có
const shipGroupRef = useRef<THREE.Group>(null!);
useShipAttitude(shipGroupRef, attitude ?? EMPTY_ATTITUDE, geometryDepthM, geometryLbpM, exaggerate);
// ...
<WaterlineReference vessel={vessel} />  {/* NGOÀI group, cố định */}
<group ref={shipGroupRef}>
  <Hull vessel={vessel} />
  <ContainerInstances vessel={vessel} plan={plan} />
</group>
```
`lib/use-indicative-stability.ts`:
```ts
export function useIndicativeStability(vessel: Vessel, plan: StowagePlan): StabilityResult | null {
  const geometry = vessel.geometry_id ? getVesselGeometry(vessel.geometry_id) : undefined;
  const hydrostatics = useMemo(() => {
    if (!geometry?.hull.offsets) return null;
    const drafts = /* lưới mớn nước đủ rộng, ví dụ 3..depth-0.5 bước 0.5 */;
    return computeHydrostaticTable(geometry.hull.offsets, geometry.particulars, { drafts });
  }, [geometry]); // chỉ tính lại khi ĐỔI tàu, không phải mỗi lần đổi plan

  return useMemo(() => {
    if (!geometry || !hydrostatics) return null;
    const byId = new Map(plan.containers.map((c) => [c.id, c]));
    const cargo = plan.placements.map((p) => cargoWeightItem(vessel, geometry, byId.get(p.container_id)!, p.slot));
    const maxDraftM = geometry.particulars.depth_m - 1;
    return computeIndicativeStability(DEMO_LIGHTSHIP, DEMO_CONSTANT, cargo, hydrostatics, geometry.particulars.lbp_m, maxDraftM);
  }, [geometry, hydrostatics, plan.placements, plan.containers, vessel]);
}
```

## Related Code Files
- Create: `frontend/src/lib/ship-attitude-transform.ts` (+ test), `frontend/src/features/viewer3d/useShipAttitude.ts`, `frontend/src/features/viewer3d/WaterlineReference.tsx`, `frontend/src/lib/use-indicative-stability.ts`, `frontend/src/features/panels/StabilityPanel.tsx`
- Modify: `frontend/src/features/viewer3d/Hull.tsx` (xoá `WaterlineReference` khỏi cả 2 path), `frontend/src/features/viewer3d/VesselScene.tsx`, `frontend/src/App.tsx`, `frontend/src/features/panels/Sidebar.tsx`, `frontend/src/store/usePlanStore.ts` (thêm `exaggerate`)
- Delete: none (nội dung `WaterlineReference` DI CHUYỂN sang file mới, không xoá logic)

## Implementation Steps
1. **Xác nhận dấu rotation TRƯỚC khi viết `computeShipTransform` thật** — viết test dùng `THREE.Object3D`: đặt object tại gốc, set `rotation.x` bằng một góc dương nhỏ, đặt 2 điểm cục bộ `(0,0,+beam/2)` (mạn phải) và `(0,0,-beam/2)` (mạn trái), dùng `object.localToWorld()` để lấy toạ độ world, xác nhận điểm mạn phải có world.y THẤP HƠN mạn trái khi `listDeg` dương (nghiêng phải = mạn phải chìm xuống — đúng vật lý và đúng quy ước "+ = mạn phải" đã chọn ở phase 01). Làm tương tự cho `rotation.z`/trim với 2 điểm mũi/lái `(±lbp/2,0,0)`, xác nhận trim dương (chúi mũi) → mũi thấp hơn lái. CHỈ SAU KHI có test này pass mới xem là đúng dấu — không suy luận suông rồi viết thẳng vào Architecture (dấu trong pseudocode trên là DỰ ĐOÁN, có thể sai, bước này là để CHỐT THẬT).
2. `ship-attitude-transform.ts` với dấu đã xác nhận + test `positionY` (đáy tàu ra đúng world y=−draft, boong ra đúng world y=freeboard, dùng lại kỹ thuật `Object3D`/`localToWorld` như bước 1).
3. Tách `WaterlineReference` khỏi `Hull.tsx` sang file riêng, cố định tại world y=0 (không còn `holdDepth()`); xoá lời gọi trong cả `LoftedHull`/`SimpleBoxHull`.
4. `useShipAttitude.ts` — thin wiring, không cần test riêng (logic đã test ở bước 1-2; đây chỉ là `useFrame`+`damp`, rủi ro thấp).
5. `lib/use-indicative-stability.ts` — orchestration hook. Grid mớn nước cho `computeHydrostaticTable`: đủ rộng để phủ Δ tàu rỗng lẫn tàu đầy (đã xác định ở phase 01 bước 4).
6. `VesselScene.tsx`: bọc group, mount `WaterlineReference` ngoài, gọi `useShipAttitude`. Nhận thêm prop `attitude: StabilityResult | null`.
7. `App.tsx`: gọi `useIndicativeStability(vessel, plan)`, truyền `attitude` xuống `VesselScene` và `Sidebar`.
8. `StabilityPanel.tsx` + mount vào `Sidebar.tsx` (banner DEMO DATA cố định, badge trạng thái theo `attitude.status`, nút Exaggerate gọi `s.toggleExaggerate`).
9. `usePlanStore.ts`: thêm `exaggerate`/`toggleExaggerate`.
10. `npm run typecheck && npm test && npm run build`; `curl localhost:5173` xác nhận vẫn phục vụ. **Không có công cụ browser** để xác nhận animation mượt/tàu nhìn có nghiêng thật hay không bằng mắt — ghi rõ giới hạn này (nhưng KHÔNG áp dụng cho phần DẤU góc, vì bước 1 đã tự xác nhận bằng toán/test, không cần mắt thường cho phần đó).

## Todo List
- [x] Bước 1: test xác nhận dấu rotation bằng `THREE.Object3D` — **kết quả**: `rotation.x=+angle` hạ mạn phải (+z) xuống ĐÚNG như dự đoán (không cần đảo dấu); `rotation.z=+angle` lại NÂNG mũi lên (+x) — NGƯỢC với "chúi mũi = mũi xuống", nên `rotationZ` phải có dấu trừ (đã đoán đúng ngay từ pseudocode ban đầu, nhưng vẫn CHỨNG MINH bằng test, không chỉ tin may mắn đoán đúng)
- [x] `ship-attitude-transform.ts` + test (8 test: positionY đáy/boong đúng world y, fallback khi draft null, list dương/âm/không đúng mạn, trim dương/âm đúng mũi/lái)
- [x] Tách `WaterlineReference.tsx`, xoá khỏi `Hull.tsx` (cả 2 path `LoftedHull`/`SimpleBoxHull` giờ `return null` gọn khi `showHull=false`, không còn `<>...</>` lồng nhau)
- [x] `useShipAttitude.ts`
- [x] `use-indicative-stability.ts`
- [x] `VesselScene.tsx`: ShipGroup + mặt nước cố định + gọi hook
- [x] `StabilityPanel.tsx` + mount Sidebar
- [x] `exaggerate` trong store
- [x] `App.tsx` wiring
- [x] typecheck/test/build xanh (260/260, tăng từ 252); dev server vẫn phục vụ (HTTP 200)

## Vấn đề phát sinh khi nối dây (đã sửa)
`StabilityResult` (phase 01, snake_case — khớp quy ước `HydrostaticRow` toàn bộ engine layer) và `ShipAttitudeInput` (phase 02, camelCase — khớp quy ước phía r3f/three.js) đặt tên KHÁC NHAU cho cùng khái niệm (`draft_mean_m` vs `draftMeanM`...) — TypeScript báo lỗi ngay ở bước typecheck (không phải bug âm thầm). Sửa bằng một hàm chuyển đổi nhỏ `shipAttitudeInputFromStability()` trong `ship-attitude-transform.ts`, KHÔNG đổi tên field ở bên nào (mỗi bên giữ đúng quy ước của layer mình).

## Bug tìm được qua `code-reviewer` (đã sửa, vòng 2 sau khi "complete")
1. **`draft_fwd_m`/`draft_aft_m` sai khung quy chiếu LCF (bug toán thật, không phải typo).** `stability-indicative.ts` dòng ~91-92 (cũ) viết `(lbpM/2 − row.lcf_m)`/`(lbpM/2 + row.lcf_m)`, giả định `row.lcf_m` đo TỪ GIỮA TÀU (quy ước bảng gõ tay cũ ở P1-demo). Nhưng `computeHydrostaticTable` thật (dùng từ phase 01 plan này) xuất `lcf_m` đo TỪ AP (đồng nhất với `lcb_m`, `lcg_m`) — khác quy ước. Hậu quả: với tàu demo (LCF ≈ 79m từ AP, gần nhưng không đúng giữa=80m), công thức cũ cho tỷ lệ chúi mũi/lái méo khoảng ~99%/1% thay vì ~50/50 đúng, dù `draft_mean_m`/`trim_m` vẫn đúng. Phát hiện bởi `code-reviewer` subagent (không phải tự phát hiện). Sửa: `draft_fwd_m = draft + trim×(lbpM−lcf_m)/lbpM`, `draft_aft_m = draft − trim×lcf_m/lbpM` (khoảng cách F→FP = lbpM−lcf_m, F→AP = lcf_m). Thêm test `stability-indicative.test.ts` với bảng LCF lệch tâm rõ (70m, khác `lbpM/2=80`) để bắt lại đúng lớp bug này nếu tái diễn — fixture cũ `lcf_m=80` trùng `lbpM/2` nên không bắt được.
2. **`getVesselGeometry` không cache — `useMemo([geometry])` không có tác dụng.** `vessel-geometry-catalog.ts` gọi `buildDemoHorizonGeometry()` (40 vòng lặp bisection fit Cb) MỚI mỗi lần gọi, nên `geometry` là object reference MỚI mỗi render → `useMemo` trong `use-indicative-stability.ts` không bao giờ khớp dependency, tính lại bảng thủy tĩnh mỗi lần render thay vì chỉ khi đổi tàu — đúng thứ mục Risk Assessment ở trên nói sẽ tránh nhưng thực ra không tránh được. Ảnh hưởng trực tiếp tới phase 03 (playback gọi hook này mỗi frame). Sửa: thêm `Map` cache theo id trong `getVesselGeometry`, trả cùng reference cho các lần gọi sau.
3. **Dọn nhỏ:** đổi `Pick<import("@/engine/stability-indicative").StabilityResult, ...>` (inline import type, không cần thiết vì không có circular import) sang `import type { StabilityResult }` ở đầu file — dễ đọc/grep hơn.
- Không sửa (chấp nhận, ghi nhận): fallback sinkage khi `SimpleBoxHull` (không có `geometry_id`) dùng `FALLBACK_DRAFT_FRACTION_OF_DEPTH` thay vì `positionY=0` — path này hiện KHÔNG được dùng tới (tàu demo duy nhất luôn có `geometry_id`), sửa bây giờ sẽ thêm phức tạp cho nhánh chưa ai chạm tới (YAGNI); để lại như TODO nếu sau này có tàu không có geometry.

## Bug NGHIÊM TRỌNG tìm được SAU KHI đã "complete" — white screen (người dùng báo cáo, không phải subagent)
Sau khi cả plan (3 phase) đã được đánh dấu complete/sync-back, người dùng báo "white screen". Nguyên nhân: `VesselScene.tsx` gọi `useShipAttitude(shipGroupRef, ...)` (dùng `useFrame` của react-three-fiber) TRỰC TIẾP trong thân hàm `VesselScene()` — nhưng thân hàm đó chạy NGOÀI `<Canvas>` (Canvas chỉ là MỘT phần tử JSX được return ra, không phải nơi hook đang thực thi). r3f throw ngay: `"R3F: Hooks can only be used within the Canvas component!"` — crash toàn bộ React tree, không có ErrorBoundary nên trắng trang hoàn toàn.

**Lỗi này có từ chính commit gốc của phase 02** (dòng gọi `useShipAttitude` y hệt vị trí cũ), nghĩa là **plan này CHƯA BAO GIỜ thực sự chạy được trong trình duyệt thật**, dù cả tester và code-reviewer (2 lượt, phase 02 lẫn phase 03) đều báo "PASS", "HTTP 200", "dev server healthy". Lý do: mọi vòng xác minh trước giờ chỉ dùng `curl`/`npm run build`/`npm test` — không cái nào THỰC SỰ RENDER app trong browser. `curl` chỉ lấy được `index.html` tĩnh (luôn 200 dù JS phía sau crash hoàn toàn) — đây là đúng lớp lỗi mà `App.tsx` từng gặp đầu phiên ("why i didn't see anything in demo") nhưng lần này ở tầng sâu hơn (runtime hook-rule violation của r3f, không phải business logic).

**Cách phát hiện thật (lần đầu trong session này dùng được)**: headless Chrome thật (`/Applications/Google Chrome.app`) + Chrome DevTools Protocol (WebSocket tới `--remote-debugging-port`), bắt `Runtime.exceptionThrown`/`Runtime.consoleAPICalled` — không chỉ dump DOM tĩnh mà chạy JS thật, có stack trace chính xác đến dòng gây lỗi. Environment sandbox này không có GPU thật nên cần thêm cờ `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader` để có WebGL software rendering (nếu không sẽ báo lỗi "WebGLRenderer: Error creating WebGL context" — lỗi MÔI TRƯỜNG headless, không phải lỗi app; đã tách biệt rõ 2 loại lỗi này bằng cách so sánh có/không cờ swiftshader).

**Fix**: tạo `features/viewer3d/ShipAttitudeDriver.tsx` — component con RỖNG (return `null`), nhận `groupRef`/`attitude`/`depthM`/`lbpM`/`exaggerate` qua props, gọi `useShipAttitude` bên trong nó; mount component này làm con trực tiếp của `<Canvas>` trong `VesselScene.tsx` (cùng cấp với `WaterlineReference`/`LoadingSequenceDriver`/`group`) — giống pattern `LoadingSequenceDriver` đã làm ĐÚNG ngay từ đầu (phase 03), chỉ là `useShipAttitude` (phase 02) chưa từng được đặt đúng chỗ.

Xác nhận sau khi sửa (headless Chrome, cờ swiftshader): 0 console error, 0 exception, DOM có `<canvas data-engine="three.js r170">` thật và toàn bộ Sidebar/StabilityPanel/LoadingSequencePanel render đúng dữ liệu (Δ 22679t, GM 2.30m, v.v. — số thật từ engine, không phải placeholder). `npm run typecheck && npm test && npm run build` vẫn xanh (277/277) sau fix.

**Bài học cho session sau**: `curl`/`npm run build` KHÔNG đủ để xác nhận "app chạy được" cho bất kỳ code r3f/React nào — phải thực sự render bằng browser (headless Chrome + CDP là cách khả thi trong môi trường không có browser tool sẵn). Cân nhắc thêm bước này vào quy trình xác minh chuẩn cho mọi phase có đụng tới `viewer3d/`.

## Success Criteria
- Test bước 1 pass — dấu rotation đã CHỨNG MINH đúng bằng toán, không chỉ "trông có vẻ đúng" — **đạt**.
- Toggle Load/Clear cargo (nút có sẵn từ trước) → tàu rỗng/tàu đầy cho `positionY`/`rotationX`/`rotationZ` khác nhau rõ rệt — **đạt gián tiếp**: `stability-indicative.test.ts` (phase 01) đã xác nhận `draft_mean_m` tàu đầy > tàu rỗng; `ship-attitude-transform.test.ts` xác nhận `positionY` phụ thuộc đúng `draftMeanM`.
- Banner DEMO DATA hiện mọi lúc panel mở; trạng thái `critical` không hiện góc (list_deg null → rotation.x đích = 0) — **đạt bằng thiết kế** (`?? 0` fallback trong `computeShipTransform`, không cần logic riêng).
- `npm run typecheck`, `npm run build`, `npm test` xanh (260/260); characterization snapshot không đổi (di chuyển `WaterlineReference` không có test riêng trước đó, không có gì bị đỏ).

## Risk Assessment
| Rủi ro | Giảm thiểu |
|---|---|
| Đoán sai dấu rotation, tàu nghiêng/chúi NGƯỢC hướng thật khi có người xem bằng mắt | Bước 1 bắt buộc test toán trước, không suy đoán |
| `computeHydrostaticTable` tính lại mỗi lần plan đổi (tốn, dù có lẽ vẫn đủ nhanh) | `useMemo` tách riêng theo `geometry` (không đổi khi plan đổi), chỉ `computeIndicativeStability` tính lại theo plan (rẻ hơn nhiều) |
| Quên tách `WaterlineReference`, mặt nước vẫn di chuyển theo tàu (bug âm thầm — vẫn chạy, vẫn build được, nhưng sai mục đích chính của cả plan) | Bước 3 làm SỚM, độc lập; success criteria có mục riêng kiểm tra bằng test/log vị trí, không chỉ "biên dịch được" |
| `SimpleBoxHull` fallback (tàu không có `geometry_id`) không có gì để tính stability | `useIndicativeStability` trả `null` rõ ràng cho case này; `VesselScene`/`StabilityPanel` xử lý `attitude === null` (không nghiêng/nún, không hiện panel) — không throw, không NaN |

## Security Considerations
N/A — thuần client-side.

## Next Steps
- Phase 03 nối `attitude` với `playbackCount` (chỉ tính trên cargo ĐANG hiện, không phải toàn bộ plan) để xem tàu nghiêng/nún SỐNG khi container xuất hiện dần.
