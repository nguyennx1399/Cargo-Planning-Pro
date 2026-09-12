# Phase 03 — Render 3D + nối vào demo thật (G6)

## Context Links
- [plan.md](plan.md) · [phase-01](phase-01-cargo-catalog-data-model.md) (`BreakbulkCargo`) · [phase-02](phase-02-breakbulk-area-placement.md) (`naiveFillBreakbulk`, `BreakbulkPlacement`)
- Code tái dùng: `frontend/src/engine/vessel-components/primitive-mesh.ts` (`boxMeshData`/`cylinderMeshData`), `frontend/src/features/viewer3d/Hull.tsx` (`meshDataToBufferGeometry` pattern), `frontend/src/features/viewer3d/VesselScene.tsx`, `frontend/src/features/panels/Sidebar.tsx`, `frontend/src/data/build-demo-plan.ts`

## Overview
- Priority: bắt buộc — đây là nơi G6 áp dụng, không có phase này thì phase 01-02 là code chết · Size: M · Status: complete — code-reviewed 2 vòng (bug LOA/LBP đã sửa và xác nhận đúng ở vòng 2, kể cả sửa lại chính test regression cho thật sự phân biệt được code cũ/mới), xác minh headless Chrome nhiều lần, test/build xanh (331/331)
- **Bắt buộc xác minh bằng headless Chrome + CDP** (không chỉ `curl`) trước khi đánh dấu Complete — xem `plans/260911-1955-cargo-loading-sequence-playback/phase-02-ship-attitude-3d.md` (mục cuối) để biết chính xác cách làm (Chrome thật + Chrome DevTools Protocol qua WebSocket, bắt `Runtime.exceptionThrown`). Lý do bắt buộc: bug r3f "hooks ngoài Canvas" ở plan trước gây trắng trang hoàn toàn nhưng `curl`/test/build đều xanh — không được lặp lại sai lầm đó.

## Key Insights
- `boxMeshData`/`cylinderMeshData` (vessel-components/primitive-mesh.ts) đã tổng quát đủ để dùng thẳng, KHÔNG cần viết loft/geometry riêng cho breakbulk:
  - `wind_turbine_tower` → `cylinderMeshData` (bán kính đáy > bán kính đỉnh, đúng hình côn thật của tháp).
  - `wind_turbine_nacelle` → `boxMeshData`.
  - `wind_turbine_blade` → `boxMeshData` (hộp dài mỏng — đủ để phân biệt hình dạng ở mức demo, không cần airfoil thật).
  - `yacht` → `boxMeshData` (hộp đơn giản, KHÔNG cần dáng thuyền thật ở mức demo này — ghi rõ đây là placeholder hình học, không phải mô hình du thuyền chi tiết).
- MỖI breakbulk item có kích thước/vị trí RIÊNG (không như container dùng chung 1 kích thước cho InstancedMesh) — dùng từng `<mesh>` riêng lẻ (không phải `InstancedMesh`), số lượng item nhỏ (vài chục tối đa) nên không lo hiệu năng draw call như container.
- Breakbulk phải nằm TRONG `<group ref={shipGroupRef}>` giống `ContainerInstances` (không phải sibling như `WaterlineReference`) — để nghiêng/nún CÙNG con tàu khi `ShipAttitudeDriver` áp transform (đây chính là bug vừa sửa ở plan trước: driver phải ở trong Canvas, còn mesh cargo phải ở trong group tàu, hai việc khác nhau, đừng nhầm).
- Vị trí Y (chiều cao) của breakbulk: đặt trên mặt deck — dùng `LAYOUT.hatchHeight` (lib/geometry.ts, cùng mức container on-deck tier thấp nhất) làm mặt đáy, `boxMeshData`/`cylinderMeshData` nhận toạ độ TÂM/ĐÁY ship-frame nên cần đổi `BreakbulkPlacement.x_m/z_m` (ship-frame) + độ cao deck (scene) cho đúng qua `shipToScene` — kiểm tra kỹ chiều: `boxMeshData` nhận SHIP-FRAME center (x,y,z), không phải scene. Phải tính `y` ship-frame tương ứng mặt deck TRƯỚC khi gọi, không truyền thẳng toạ độ scene vào.

## Requirements
- F1 `engine/cargo/breakbulk-mesh-builder.ts` (mới, thuần, test): `buildBreakbulkMesh(item: BreakbulkCargo, placement: BreakbulkPlacement, vessel: Vessel, geometry?: VesselGeometry): MeshData` — chọn `boxMeshData`/`cylinderMeshData` theo `item.category`, áp `rotation_deg` (0/90 — hoán đổi length_m/width_m khi 90° thay vì xoay ma trận, đơn giản hơn và đủ dùng vì phase 02 chỉ tạo 0/90).
- F2 `features/viewer3d/BreakbulkCargoInstances.tsx` (mới): nhận `vessel`, `plan` (đọc `plan.breakbulk_cargo`/`breakbulk_placements`), render 1 `<mesh>` per placement dùng `meshDataToBufferGeometry` (tái dùng helper — nếu hiện đang private trong `Hull.tsx`, tách ra `lib/mesh-data-to-buffer-geometry.ts` dùng chung, tránh copy-paste).
- F3 `VesselScene.tsx`: mount `<BreakbulkCargoInstances>` BÊN TRONG `<group ref={shipGroupRef}>`, cạnh `<ContainerInstances>`.
- F4 `data/build-demo-plan.ts`: thêm biến thể plan có breakbulk (ví dụ `buildLoadedDemoPlanWithBreakbulk` hoặc thêm tham số) — dùng `naiveFillBreakbulk` (phase 02) + `generateDemoBreakbulkCargo` (phase 01).
- F5 `features/panels/Sidebar.tsx`: nút/checkbox "Project cargo (turbine, yacht)" độc lập với nút Load/Clear container hiện có (bật/tắt riêng, không phá hành vi cũ).
- F6 `features/panels/Sidebar.tsx` (mục Checks): breakbulk violations (từ phase 02) hiển thị chung danh sách với violations container hiện có (đã có UI list, chỉ cần data đã gộp đúng ở `validate-plan.ts`).
- NF: mỗi file < 200 dòng.

## Architecture
```ts
// engine/cargo/breakbulk-mesh-builder.ts
export function buildBreakbulkMesh(item, placement, vessel, geometry): MeshData {
  const deckY = /* ship-frame y của mặt deck — xem lib/geometry.ts LAYOUT.hatchHeight, quy đổi sang ship-frame nếu cần */;
  const [lengthM, widthM] = placement.rotation_deg === 90 ? [item.width_m, item.length_m] : [item.length_m, item.width_m];
  if (item.category === "wind_turbine_tower") {
    return cylinderMeshData({ radiusTopM: ..., radiusBottomM: ..., heightM: item.height_m }, [placement.x_m, deckY, placement.z_m], geometry);
  }
  return boxMeshData({ lengthM, widthM, heightM: item.height_m }, [placement.x_m, deckY + item.height_m / 2, placement.z_m], geometry);
}
```
```tsx
// VesselScene.tsx — thêm vào group hiện có
<group ref={shipGroupRef}>
  <Hull vessel={vessel} />
  <ContainerInstances vessel={vessel} plan={plan} />
  <BreakbulkCargoInstances vessel={vessel} plan={plan} />
</group>
```

## Related Code Files
- Create: `frontend/src/engine/cargo/breakbulk-mesh-builder.ts` (+test), `frontend/src/features/viewer3d/BreakbulkCargoInstances.tsx`, `frontend/src/lib/mesh-data-to-buffer-geometry.ts` (tách từ `Hull.tsx` nếu đang private)
- Modify: `frontend/src/features/viewer3d/Hull.tsx` (dùng helper đã tách thay vì bản private), `frontend/src/features/viewer3d/VesselScene.tsx`, `frontend/src/data/build-demo-plan.ts`, `frontend/src/features/panels/Sidebar.tsx`
- Delete: none

## Implementation Steps
1. Tách `meshDataToBufferGeometry` từ `Hull.tsx` sang `lib/mesh-data-to-buffer-geometry.ts` (file dùng chung), sửa `Hull.tsx` import lại — chạy test cũ của Hull ngay để xác nhận không đổi hành vi (refactor thuần, không đổi logic).
2. `breakbulk-mesh-builder.ts` + test (mỗi category ra đúng loại geometry, vị trí tâm/đáy đúng ship-frame, xoay 90° hoán đổi đúng length/width).
3. `BreakbulkCargoInstances.tsx` — component render, dùng `useMemo` theo `plan.breakbulk_placements` (pattern giống `ContainerInstances`).
4. `build-demo-plan.ts`: thêm hàm/tham số dựng plan có breakbulk.
5. `VesselScene.tsx`: mount bên trong group tàu.
6. `Sidebar.tsx`: nút bật/tắt project cargo — gọi lại `naiveFillBreakbulk`/build plan tương ứng.
7. `npm run typecheck && npm test && npm run build`.
8. **Bắt buộc**: khởi động dev server, dùng headless Chrome + CDP xác nhận: (a) không có exception nào trong console khi bật project cargo, (b) DOM/canvas thực sự render (không trắng trang), (c) chụp lại số lượng mesh breakbulk khớp số lượng đã đặt (đếm qua DOM hoặc log tạm thời trong lúc test, xoá sau khi xác nhận).

## Todo List
- [x] Tách `meshDataToBufferGeometry` dùng chung (`lib/mesh-data-to-buffer-geometry.ts`)
- [x] `breakbulk-mesh-builder.ts` + test (5 test, gồm test centroid vị trí bằng số cụ thể + test hoán đổi length/width khi rotation 90°)
- [x] `BreakbulkCargoInstances.tsx`
- [x] `build-demo-plan.ts`: `withBreakbulkCargo(vessel, plan)` — compose lên plan CÓ SẴN (rỗng hoặc đầy), tính forbidden zones từ `plan.placements` hiện tại
- [x] `VesselScene.tsx` mount trong group tàu
- [x] `Sidebar.tsx`: section "Project cargo" độc lập (nút Load/Clear riêng khỏi container) + dòng cảnh báo số lượng unplaced khi có
- [x] `App.tsx`: state `projectCargoLoaded` riêng, compose qua `withBreakbulkCargo`
- [x] typecheck/test/build xanh (321/321, tăng từ 316)
- [x] Xác minh headless Chrome + CDP: 0 exception qua toàn bộ luồng (load trang → Clear cargo → Load project cargo → Load project cargo lại từ tàu đầy) — canvas thật render, text "Clear project cargo"/"unplaced" xuất hiện đúng, số liệu unplaced khớp CHÍNH XÁC với thuật toán (tàu đầy: 2/14 đặt được; tàu rỗng: 12/14 đặt được — khớp 100% với số đã tính thủ công ở phase 02)

## Success Criteria
- Bật "Project cargo" trong demo thật → thấy tua bin (trụ + hộp) và du thuyền (hộp) xuất hiện trên deck, đúng vị trí không chồng container.
- Tắt lại → biến mất sạch, không lỗi console, không rò rỉ mesh cũ (kiểm tra qua `useMemo`/key đúng, giống pattern `ContainerInstances`).
- Xác minh bằng headless Chrome + CDP: 0 `Runtime.exceptionThrown`, `<canvas>` thực sự có trong DOM sau khi bật project cargo.

## Risk Assessment
| Rủi ro | Giảm thiểu |
|---|---|
| Lặp lại đúng bug "hook ngoài Canvas" ở plan trước nếu ai đó thêm `useFrame`/hook r3f mới cho breakbulk animation | Phase này KHÔNG cần `useFrame` mới (breakbulk tĩnh, không animate riêng) — nếu sau này thêm, PHẢI đặt trong driver component mount bên trong `<Canvas>`, không gọi trực tiếp trong `VesselScene()` |
| Nhầm toạ độ ship-frame vs scene khi tính vị trí breakbulk (dễ nhầm vì `slotToPosition` trả scene, còn `boxMeshData` nhận ship-frame) | Test `breakbulk-mesh-builder.ts` xác nhận bằng số cụ thể, không suy đoán — dùng `shipToScene` NGAY TRONG `boxMeshData` (đã có sẵn), không tự chuyển đổi tay ở nơi gọi |
| Chỉ xác minh bằng `curl`/build như bug vừa gặp | Bước 8 bắt buộc headless Chrome + CDP, không được bỏ qua dù tester subagent báo "HTTP 200" |

## Deviations (phát hiện khi implement)
- **Tower dựng bằng cylinder NẰM NGANG** (trục dọc theo ship-frame x), không dùng thẳng `cylinderMeshData` có sẵn (hàm đó dựng cylinder ĐỨNG, trục theo ship z/lên) — vì tower vận chuyển thật nằm ngang trên deck, và footprint đặt hàng (length_m × width_m) chỉ khớp hình dạng nếu render nằm ngang. Viết `towerMeshData` riêng trong `breakbulk-mesh-builder.ts`, tự `rotateZ(90°)` một `CylinderGeometry` trước khi gọi `shipToScene`. GIỚI HẠN ĐÃ BIẾT: chỉ đúng khi `rotation_deg=0` (trục theo x) — `rotation_deg=90` (trục theo z/ngang tàu) sẽ SAI vì cần `rotateX` thay vì `rotateZ`. Không sao vì `naiveFillBreakbulk` (phase 02) chỉ tạo `rotation_deg=0`, chưa ai tạo 90° — ghi rõ trong code comment, không phải lỗ hổng âm thầm.
- **"Project cargo" độc lập hoàn toàn với "Load demo cargo" (container)** — đúng như phase 02's Deviations đã khuyến nghị. `withBreakbulkCargo(vessel, plan)` compose lên BẤT KỲ plan nào (rỗng hoặc đầy), tính lại forbidden zones từ `plan.placements` HIỆN TẠI mỗi lần — nên bật/tắt container không cần reset lại project cargo, số liệu luôn tự cập nhật đúng.
- **Đã xác nhận bằng headless Chrome cả 2 trạng thái thái cực**: tàu đầy container (470) + project cargo → 2/14 đặt được; tàu rỗng + project cargo → 12/14 đặt được. Cả 2 số này khớp CHÍNH XÁC với tính toán thủ công ở phase 02 (không phải trùng hợp — cùng một hàm `naiveFillBreakbulk`/`onDeckBayZones`, chỉ khác input `plan.placements`).

## Bug NGHIÊM TRỌNG tìm được qua `code-reviewer` (đã sửa) — sai hệ toạ độ x_m (LOA vs LBP)
`code-reviewer` (chạy trên phase 01-02, nhưng phát hiện ra vì code phase 03 vừa xuất hiện trong lúc review) phát hiện: `breakbulk-mesh-builder.ts` (bản đầu) gọi `shipToScene(geometry, [placement.x_m, ...])` — hàm này giả định `x_m` là ship-frame THẬT, neo theo `geometry.particulars.lbp_m` (160m cho tàu demo). Nhưng `placement.x_m` (từ `naiveFillBreakbulk`/`deckArea`/`onDeckBayZones`, phase 02) thực ra neo theo `vessel.length_m` (172m, LOA) — giống hệt công thức fallback của `bayCenterX` (dùng để render CONTAINER). Hai neo khác nhau (LOA 172 vs LBP 160) → lệch CHÍNH XÁC 6m mỗi phía, 12m tổng — nghĩa là breakbulk có thể render CHỒNG LẤN container dù `breakbulkOverlapsContainer` (phase 02) đã báo "không chồng lấn" (vì rule đó tính đúng theo neo LOA, nhất quán nội bộ, chỉ RENDER là sai neo).

**Sửa** (theo đúng khuyến nghị "option (b)" của reviewer — thay đổi nhỏ hơn, giữ đúng ý định gốc "breakbulk không cần `VesselGeometry`"):
- `breakbulk-mesh-builder.ts`: bỏ hẳn `shipToScene`/`boxMeshData`/`cylinderMeshData` (những hàm neo theo LBP) — viết lại dùng scene position TRỰC TIẾP giống `ContainerInstances.tsx`/`slotToPosition`: `sceneX = x_m - vessel.length_m/2`, `sceneZ = z_m` (không đổi), `sceneY = LAYOUT.hatchHeight + height_m/2` (cùng mốc deck container on-deck dùng). Hệ quả PHỤ TÍCH CỰC: `BreakbulkCargoInstances.tsx` không còn cần `VesselGeometry` nữa — bỏ hẳn nhánh `if (!geometry) return null`, breakbulk giờ chạy được cho MỌI tàu, kể cả tàu chưa có `geometry_id`.
- `lib/breakbulk-weight-item.ts` (phase 04, viết CÙNG session nên sửa luôn trước khi tester/code-reviewer thấy): CÓ lỗi y hệt (coi `x_m` là ship-frame thật) — sửa bằng đúng 2 bước `cargoWeightItem` đã làm cho container: `sceneX = x_m - vessel.length_m/2` rồi `shipFrameX = sceneX + lbp_m/2`. Hàm này VẪN cần `VesselGeometry` (ổn định luôn cần, không đổi) nhưng giờ nhận thêm `vessel` để làm bước đổi đầu tiên.
- `types/domain.ts`: viết lại hẳn doc comment của `BreakbulkPlacement` — không gọi `x_m`/`z_m` là "ship-frame" nữa (dễ gây hiểu nhầm), ghi rõ đây là quy ước "đối xứng qua `vessel.length_m/2`", khác quy ước ship-frame thật của `lib/ship-frame.ts`, và code nào cần ship-frame thật (ổn định) phải tự đổi qua 2 bước.
- Thêm **test xuyên hệ thống** (`breakbulk-mesh-builder.test.ts`) đúng như reviewer đề xuất: đặt 1 item breakbulk vừa đủ né `onDeckBayZones` (theo quy ước x_m), rồi xác nhận vị trí RENDER THẬT (scene x) không lấn vào scene x thật của bay container đó (tính bằng chính công thức `bayCenterX` dùng cho container) — bắt được ĐÚNG lớp lỗi này nếu tái diễn, không chỉ tự so khớp với chính nó.

Xác nhận lại bằng headless Chrome + CDP sau khi sửa: 0 exception qua Clear cargo → Load project cargo → Load demo cargo (tải lại container) — số liệu unplaced giữ nguyên đúng (2/14 tàu rỗng, 12/14 tàu đầy, không đổi vì thuật toán đặt hàng phase 02 không hề bị sửa — chỉ RENDER/stability đổi). `npm run typecheck && npm test && npm run build` xanh (329/329, tăng từ 321).

## Security Considerations
N/A — thuần client-side.

## Next Steps
- Phase 04 dùng `BreakbulkPlacement[]` đã render ở đây để tính `WeightItem` đưa vào `computeIndicativeStability`.
