# Phase 01 — Schema VesselGeometry + ship frame

## Context Links
- [plan.md](plan.md) G1, G2, G4 · roadmap [phase-01](../260911-0939-cargo-planner-v2-roadmap/phase-01-viewer-and-ux-foundation.md) (quyết định hệ toạ độ, `lib/ship-frame.ts`)
- Code: `frontend/src/types/domain.ts`, `frontend/src/lib/geometry.ts` (layout theo `length_m/2 − bowMargin`, gốc scene = giữa tàu, y=0 tại boong), `frontend/src/data/demo-container-vessel.ts`
- P1-demo [phase-04](../260911-0945-p1-frontend-stowage-demo/phase-04-3d-viewer-mixed-sizes-click-to-move.md) (sở hữu `lib/geometry.ts`, thêm `KEEL_DEPTH`)

## Overview
- Priority: P1 · Size: S · Status: complete
- Chốt hợp đồng dữ liệu `VesselGeometry` (hull, frames, linh kiện, livery) và các hàm chuyển toạ độ. Chuyển vị trí slot của demo sang ship frame mà scene không đổi.

## Key Insights
- Hiện tại vị trí slot được tính từ `LAYOUT` (tinh chỉnh tay), không từ ship frame. Nếu hull đi theo ship frame còn container thì không, container sẽ "trôi" khỏi hầm, đúng rủi ro G1.
- LOA ≠ LBP: tàu nhô ra sau AP (overhang lái) và trước FP (mũi, bulb). Cần `aft_overhang_m`, nên `x ∈ [−aft_overhang, LBP + fwd_overhang]`.
- Khoảng sườn thường không đều (khu peak mũi/lái dày hơn), nên cần bảng `frames[]` theo đoạn chứ không phải một hằng số.
- Midship (⊗) = AP + LBP/2. Bảng thủy tĩnh demo (P1-demo ph06) đo LCB/LCF "+fwd từ midship", nên cần helper đổi qua lại.

## Requirements
- F1 Types `VesselGeometry` (TS, pure data, JSON-serializable, `schema_version: 1`).
- F2 `frameToX`, `xToFrame`, `shipToScene`, `sceneToShip`, `lcgFromMidship` (có test hai chiều).
- F3 `validateVesselGeometry(doc) → GeometryIssue[]`: sanity check theo RT-2.
- F4 Demo "MV Demo Horizon" có `geometry_id` + catalog bundled. Vị trí slot tính qua ship frame, và scene giữ nguyên số (characterization test).
- NF: file < 200 LOC; không thêm dependency.

## Architecture
```ts
// frontend/src/types/vessel-geometry.ts
export type GeometryDataStatus = "synthetic" | "assumed" | "computed" | "verified";
export interface FrameSegment { from_frame: number; to_frame: number; spacing_m: number } // frame 0 = AP (x=0)
export interface MainParticulars {
  loa_m: number; lbp_m: number; aft_overhang_m: number;   // aft end → AP
  beam_m: number; depth_m: number; design_draft_m: number; cb: number;
}
export interface ParametricHullParams {
  bow: "bulbous" | "conventional"; stern: "transom" | "cruiser";
  parallel_midbody: [number, number];   // fraction of LBP from AP, e.g. [0.30, 0.62]
  bilge_radius_m?: number; bulb?: { length_m: number; breadth_m: number; height_m: number };
}
export interface HullOffsets {
  stations_x_m: number[];                // ship frame x, ascending (may exceed LBP for bulb/stem)
  waterlines_z_m: number[];              // ascending from baseline
  half_breadths_m: (number | null)[][];  // [station][waterline]; null = outside hull
  knuckles?: { station: number; waterline: number }[];
  stem_profile?: [number, number][]; stern_profile?: [number, number][];  // (x,z)
  deck_at_side_z_m?: number[];           // per station; default = depth_m
}
export type HullSpec =
  | { source: "parametric"; params: ParametricHullParams; offsets?: HullOffsets }  // offsets = cached generation
  | { source: "offsets"; offsets: HullOffsets }
  | { source: "mesh"; mesh_uri: string; offsets?: HullOffsets };
export type ComponentSpec =   // discriminated by kind; positions in ship frame (m)
  | { kind: "superstructure"; x_aft_m; x_fwd_m; width_m; tiers: number; tier_height_m; y_center_m?: number }
  | { kind: "funnel"; x_m; y_m; base_z_m; height_m; length_m; width_m }
  | { kind: "crane"; id; pedestal: [x, y, z]; pedestal_height_m; jib_length_m; swl_t; outreach_min_m; outreach_max_m }
  | { kind: "mast"; x_m; y_m; base_z_m; height_m }
  | { kind: "lifeboat"; x_m; y_m; z_m; freefall: boolean };
  // hatch_cover, lashing_bridge: auto-generated from bays/spaces (phase 03), not stored
export interface Livery {
  topside_color: string; antifouling_color: string; boot_top_color: string;
  boot_top_low_z_m: number; boot_top_high_z_m: number;   // light/deep draft band
  superstructure_color: string; funnel_bands?: { color: string; from_z_m: number; to_z_m: number }[];
  logo_uri?: string;
}
export interface VesselGeometry {
  schema_version: 1; id: string; version: number; design_name: string;
  data_status: GeometryDataStatus; particulars: MainParticulars; frames: FrameSegment[];
  hull: HullSpec; components: ComponentSpec[]; livery: Livery;
  provenance: { source_docs: string[]; notes?: string };   // doc titles only, no confidential files
}
```
- `Vessel` (domain.ts) thêm `geometry_id?: string` và `livery_override?: Partial<Livery>` (G4). Hàm `getVesselGeometry(id)` đọc từ `src/data/vessel-geometry-catalog.ts`.
- `lib/ship-frame.ts` (file mà roadmap P1 đã dự kiến):
  - `shipToScene(g, [x, y, z]) = [x − lbp/2, z − depth, y]` → giữ nguyên gốc ShipGroup hiện có (midship, boong, tâm).
  - `frameToX` là hàm piecewise theo `frames[]`, cho phép frame âm.
- Backend mirror (Pydantic) hoãn tới khi roadmap P2 có persistence (YAGNI). Khi đó types chuyển sang sinh từ OpenAPI (RT-12).

## Related Code Files
- Create: `frontend/src/types/vessel-geometry.ts`, `frontend/src/lib/ship-frame.ts`, `frontend/src/engine/vessel-geometry/validate-vessel-geometry.ts`, `frontend/src/data/demo-horizon-geometry.ts`, `frontend/src/data/vessel-geometry-catalog.ts`, tests `frontend/src/lib/__tests__/ship-frame.test.ts`, `frontend/src/engine/vessel-geometry/__tests__/validate-vessel-geometry.test.ts`, `frontend/src/lib/__tests__/geometry-characterization.test.ts`
- Modify: `frontend/src/types/domain.ts` (`geometry_id`, `livery_override`), `frontend/src/data/demo-container-vessel.ts`, `frontend/src/lib/geometry.ts` (bay LCG theo ship frame → `shipToScene`)
- Delete: none

## Implementation Steps
1. Viết characterization test TRƯỚC: snapshot `slotToPosition` của mọi slot demo (sau P1-demo ph04 bước 1, hoặc cập nhật snapshot một lần khi ph04 đổi 20').
2. Tạo types + `ship-frame.ts`, kèm test: `frameToX` ở biên đoạn, frame âm, round-trip `xToFrame(frameToX(f)) = f`, `sceneToShip(shipToScene(p)) = p`, và midship → scene x = 0.
3. `validate-vessel-geometry.ts`, trả về issues `{path, severity, message}`:
   - LBP < LOA; `aft_overhang` + LBP ≤ LOA; draft < depth; Cb ∈ [0.35, 0.90].
   - `frames` liên tục, đơn điệu, spacing > 0.
   - Offsets: kích thước lưới khớp, x/z tăng dần, half-breadth ∈ [0, B/2 + 0.05].
   - Linh kiện nằm trong LOA/B; boot-top low < high ≤ depth.
4. `demo-horizon-geometry.ts`: LOA 172, LBP 160, aft_overhang 6, B 27.4, D 14 (= `KEEL_DEPTH`), T 9.8, Cb theo phase 02, frames 1 đoạn 0.8 m, `data_status: "synthetic"`.
5. `geometry.ts`: `bayLcgFromAp(bay)` → `shipToScene`. Chọn hằng số sao cho characterization test không đổi (sai lệch ≤ 1 mm).
6. `npm run typecheck && npm test` xanh.

## Todo List
- [x] characterization test vị trí slot
- [x] types VesselGeometry + domain.ts fields
- [x] ship-frame.ts + tests
- [x] validate-vessel-geometry + tests
  - [x] checkComponents now validates beam (Y) envelope + LOA (X) ✓
  - [x] checkFrames treats frames[0].from_frame !== 0 as error (not warning) ✓
- [x] demo geometry + catalog
- [x] geometry.ts qua ship frame, snapshot không đổi

## G6 (wire vào demo)
**Miễn** — phase này thuần schema + hàm toạ độ (`shipToScene`, `validateVesselGeometry`), không có bề mặt UI/hình học nào để hiển thị. Xác nhận thay thế: characterization snapshot test (`geometry-characterization.test.ts`) chứng minh KHÔNG có gì trong demo bị ảnh hưởng, đúng như kỳ vọng của phase.

## Success Criteria
- ✓ Mọi hàm chuyển toạ độ có test round-trip; characterization test không đổi.
- ✓ Validator bắt đủ các lỗi đã liệt kê (mỗi lỗi ≥ 1 test).
- ✓ 102 tests all passing, no build/typecheck errors.
- ✓ Both code-review findings closed: beam envelope check + frames[0] invariant enforcement.

## Risk Assessment
| Rủi ro | Giảm thiểu |
|---|---|
| Đụng file với P1-demo ph04 (`geometry.ts`) | Làm sau ph04 bước 1 hoặc cùng một dev; ghi rõ bàn giao ownership |
| Quy ước dấu `y` khác booklet (có booklet lấy mạn trái dương) | Ghi quy ước ở P0 checklist; khi import thì đổi dấu, nội bộ luôn +stbd |
| Schema phải đổi sau khi gặp dữ liệu thật | `schema_version` + hàm migrate khi lên v2; review sau P0 0.6 |

## Security Considerations
- `provenance.source_docs` chỉ lưu tên tài liệu, không lưu file hay nội dung mật.

## Next Steps
- Phase 02 dùng `HullOffsets`, `ParametricHullParams`, `ship-frame.ts` để sinh offsets từ particulars.
- Phase 02 sẽ dựng loft mesher chung cho L1, L2, L3 (G2 constraint).
