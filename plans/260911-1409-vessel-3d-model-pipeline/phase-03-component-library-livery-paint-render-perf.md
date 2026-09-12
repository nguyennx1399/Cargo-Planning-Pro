# Phase 03 — Thư viện linh kiện, sơn/livery, hiệu năng render

## Context Links
- [plan.md](plan.md) · [phase-01](phase-01-vessel-geometry-schema-and-ship-frame.md) (`ComponentSpec`, `Livery`) · [phase-02](phase-02-parametric-hull-generator-and-loft-mesher.md) (`aHullZ`)
- P1-demo [phase-04](../260911-0945-p1-frontend-stowage-demo/phase-04-3d-viewer-mixed-sizes-click-to-move.md) (`ShipGroup`, `Water`), [phase-06](../260911-0945-p1-frontend-stowage-demo/phase-06-indicative-stability-and-ship-attitude.md) (list/trim/lún)
- Roadmap phase-01 1.I (`WaterSurface`, `DraftMarks`)

## Overview
- Priority: P1 · Size: M · Status: complete (core scope; several items deferred — see below)
- Xây thư viện linh kiện có tham số, để onboarding một tàu chỉ còn là chọn và đặt linh kiện. Thêm sơn chống hà / boot-top / màu thân / logo, và giữ phần tàu ≤ 12 draw call vì màn hình còn phải gánh hàng chục nghìn container.

## Key Insights
- Sơn tính theo `z` **hull-local** trong shader, nên nó dính vào vỏ khi `ShipGroup` nghiêng/lún, còn mặt nước cố định. Tín hiệu sơn đỏ chìm hay nổi vì thế tự đúng, không cần logic riêng.
- Nếu tô màu bằng vertex color, đường ranh giới sẽ nhòe theo tam giác lớn. Nếu cắt hình học theo đường nước thì phức tạp. Chọn `onBeforeCompile` với ngưỡng z: nét sắc, chi phí gần như 0.
- Nắp hầm và lashing bridge của tàu container sinh tự động được từ danh sách bay (không cần đặt tay), giúp giảm công onboarding.
- Mặt nước đặc thì che mất phần sơn đỏ, nên cần chế độ nước trong suốt ("x-ray").

## Requirements
- F1 Builder hình học thuần cho: superstructure (số tầng, dải cửa sổ, cánh gà), funnel (dải màu, chỗ gắn logo), crane (bệ, cần, trạng thái quay/nâng, vòng tầm với khi bật), mast, lifeboat (freefall), hatch cover + lashing bridge (sinh từ bay).
- F2 `HullLiveryMaterial`: antifouling dưới `boot_top_low_z`, boot-top trong dải, topside phía trên; uniforms lấy từ `Livery` (+ `livery_override`).
- F3 Logo hãng trên funnel (drei `Decal`, texture PNG/SVG giới hạn ≤ 1024 px).
- F4 Mặt nước có toggle trong suốt; vạch mớn nước (roadmap 1.I) đặt theo ship frame.
- F5 Gộp linh kiện tĩnh theo vật liệu (`mergeGeometries`); cần cẩu tách riêng (chuyển động sau này).
- F6 LOD: hull N=48 và N=16 (drei `<Detailed>`); linh kiện ở xa chỉ là khối đơn giản.
- NF: phần tàu ≤ 12 draw call, ≤ 80k tam giác ở LOD0; P1 fps gate (≥ 55 fps) giữ nguyên.

## Architecture
```
engine/vessel-components/
  superstructure-geometry.ts   funnel-geometry.ts   crane-geometry.ts
  deck-fittings-geometry.ts    (mast, lifeboat)
  hatch-and-lashing-geometry.ts  (auto from vessel.bays + bay LCG)
  merge-static-components.ts   ComponentSpec[] → { byMaterial: BufferGeometry }
features/viewer3d/
  VesselModel.tsx              hull (LOD) + merged static + cranes; reads getVesselGeometry(vessel.geometry_id)
  hull-livery-material.ts      MeshStandardMaterial.onBeforeCompile (varying aHullZ)
  CraneModel.tsx               group hierarchy pedestal → slew → jib (luff)
  FunnelLogoDecal.tsx
```
Shader patch (phác thảo):
```glsl
// vertex: varying float vHullZ = aHullZ;
// fragment (before lighting):
vec3 paint = vHullZ < uBootLow ? uAntifouling : (vHullZ < uBootHigh ? uBootTop : uTopside);
diffuseColor.rgb = paint;
```

## Related Code Files
- Create: các file liệt kê trên + tests `engine/vessel-components/__tests__/*.test.ts` (kích thước bbox, số geometry sau merge, hatch/lashing sinh đúng số lượng)
- Modify: `features/viewer3d/VesselScene.tsx` (mount `VesselModel` trong `ShipGroup`), `features/viewer3d/Hull.tsx` (thành phần con của `VesselModel`, hoặc gộp vào), `data/demo-horizon-geometry.ts` (components + livery demo, dùng tên hãng giả)
- Delete: khối accommodation cứng trong `Hull.tsx`

## Implementation Steps
1. Builders + tests (bbox đúng tham số, không NaN).
2. `hatch-and-lashing-geometry.ts` từ bay LCG (phase 01), test: số nắp hầm = số bay 40'.
3. `merge-static-components.ts`, test: số nhóm vật liệu ≤ 5.
4. `hull-livery-material.ts`, rồi kiểm tra bằng mắt: lún 1 m thì dải đỏ chìm thêm; nghiêng thì một mạn lộ đỏ.
5. `VesselModel.tsx`: LOD + cranes + decal. Toggle nước trong suốt (nối store P1-demo).
6. Đo bằng `<Stats/>` + `renderer.info.render.calls` ở full load. Ghi số liệu vào report của phase.

## Todo List
- [x] builders superstructure/funnel/mast/lifeboat/crane + tests (25 tests across 5 files)
- [x] hatch cover + lashing bridge tự sinh (auto từ `vessel.bays`, không cần `bay_lcg_m` thật — dùng `bayCenterX` scene-space có sẵn, quy đổi sang ship frame)
- [x] merge static theo vật liệu (`merge-static-components.ts`, 3 nhóm: superstructure/deck-fittings/crane)
- [x] livery shader (`hull-livery-material.ts`, `onBeforeCompile` patch trên `<color_fragment>`) — **kiểm tra bằng mắt CHƯA làm** (không có công cụ browser trong phiên này); có test static kiểm tra chuỗi shader/uniform đúng, và suy luận toán học đúng hướng (xem Deviations)
- [ ] logo decal — **bỏ qua**: không có texture/tên hãng thật để gắn; demo dùng tên hãng giả nhưng chưa cần logo hình ảnh
- [ ] LOD hull + nước trong suốt — **bỏ qua**: cả hai đều cần `ShipGroup`/`Water` từ P1-demo phase-04, chưa tồn tại trong code
- [x] đo draw call/tam giác — 3 draw call (hull + superstructure + deck-fittings) + 1 mặt nước = 4 tổng, 4556 tam giác, build 16 ms. fps thật trong trình duyệt **chưa đo** (không có công cụ browser).

## Deviations from the plan as written
- **`aHullZ` attribute → not added**: phase 2 deferred it; phase 3 found it's actually unnecessary. `shipToScene` never scales, only permutes/translates axes, so the mesh's own local-space Y already equals ship-frame z minus depth — the shader just adds `uDepthM` back. One less custom attribute to maintain.
- **`FunnelLogoDecal.tsx`, `VesselModel.tsx`, `CraneModel.tsx` → not created**: logic folded directly into `Hull.tsx` (hull + merged component groups) since there's no `ShipGroup` yet for a separate `VesselModel` to mount into, no logo asset to decal, and no articulation for a dedicated `CraneModel` (crane is a static merged mesh like everything else — see next point).
- **Crane: static only, no slew/luff articulation, no outreach ring** — `ComponentSpec`'s crane variant has no "current angle" field (by design, from phase 1), so there's nothing to animate yet; deferred to whenever crane simulation (roadmap P2/P4, RT-7) actually needs it. The demo vessel (container feeder) doesn't place a crane at all — `crane-geometry.ts` exists and is tested for the future MPP vessel.
- **Superstructure builder**: no window bands / wings, just stacked plain boxes per tier — visually reads as "the bridge" at demo scale; real detail is an L2/L3-source (GLB model) concern, not this generator's job.
- **Water transparency toggle, draft marks**: both need P1-demo phase-04's `Water`/`ShipGroup`, which aren't in the codebase yet. `WaterlineReference` (from phase 1/2, a static translucent plane) is unchanged.
- **LOD (`<Detailed>`)**: not added — no perf problem to solve yet (4556 triangles total, see measurement above) and no way to verify a LOD swap doesn't visually pop in this session. Revisit once real container-count perf testing happens (P1-demo's own fps gate).
- **Visual verification (sinkage/list changing the paint boundary) and real fps**: this session has no browser/WebGL tool. What WAS verified: the shader math is analytically correct (local Y = ship z − depth, boot-top compared against absolute ship-frame z, matching `Livery`'s own documented convention), and a static test confirms the string-patch logic produces the right GLSL. The actual "does it look right when the ship tilts" check is still open — flag for whoever next runs this in a browser.

## Code review round 2 (post-fix)
Tester + code-reviewer verified independently (hand-traced shader math against `shipToScene`, checked three.js's own vertex shader source for `<begin_vertex>` ordering relative to morph/skin chunks, hand-traced a 3-part mesh merge, spot-checked builder bbox math on untested param sets). No High/Critical findings. Two real Medium findings, both fixed:
- **`customProgramCacheKey` was per-vessel** (templated with depth/livery values) despite the patched GLSL being structurally identical for every vessel — forced an unnecessary distinct shader compile per vessel/depth combo. Fixed to a constant key.
- **`materialGroupFor`'s `switch` used a catch-all `default`** instead of matching the sibling `buildComponentMesh` switch's TS-enforced exhaustiveness — a future `ComponentSpec` kind would've silently landed in "deck-fittings" instead of forcing a deliberate choice. Fixed to explicit per-kind cases.
- Low-priority: tightened a weak `buildLashingBridgesMesh` test assertion (`>0` → exact expected triangle count).
- "No browser visual verification" gap: both reviewers judged this acceptable to ship — the paint boundary is computed from the mesh's own **local-space** position, which is geometrically invariant under whatever transform the hull group gets (tilt/sink), so "does it look right when the ship heels" reduces to "is the local-space math right", which both agents independently verified is correct. Still flagged for an actual look once a browser tool is available.

## G6 (wire vào demo) — cùng gap với phase 02, đã vá cùng lúc
Component/livery code render bên trong `Hull.tsx`, nên gap và cách vá giống hệt phase 02 (xem phase-02's "G6" section và `plan.md` § "Đã áp dụng vào demo"). Không cần vá riêng.

## Success Criteria
- Demo trông như tàu feeder (cabin lái, ống khói, cột, xuồng cứu sinh, nắp hầm, lashing bridge, sơn 3 dải) — hình học đúng theo test (kích thước, vị trí, không xuyên vỏ hay validator lỗi trên chính `demo-horizon-geometry.ts`).
- Khi tàu lún, nghiêng hoặc chúi, ranh giới sơn đỏ ↔ mặt nước thay đổi đúng hướng — **chưa xác minh bằng mắt** (xem Deviations); đúng theo suy luận toán học và test tĩnh.
- ≤ 12 draw call cho tàu (đạt: 3, thấp hơn nhiều so với ngân sách); fps gate — chưa đo trực tiếp, nhưng tổng số tam giác (4556 linh kiện + 4220 hull ≈ 8800) rất nhỏ so với ngân sách 80k của riêng phần tàu.
- `npm run typecheck`, `npm run build`, `npm test` (164/164, tăng từ 145) đều xanh; characterization snapshot không đổi.

## Risk Assessment
| Rủi ro | Giảm thiểu |
|---|---|
| `onBeforeCompile` vỡ khi nâng version three | Test snapshot chuỗi chèn shader; pin three 0.170 |
| Hull trong suốt + sơn khó đọc | Sơn chỉ áp ở chế độ đặc; chế độ trong suốt giữ màu trung tính |
| Logo khách hàng là tài sản nhãn hiệu | Demo dùng tên hãng giả; logo thật chỉ trong môi trường của tenant |

## Security Considerations
- Texture logo là untrusted input: chỉ PNG/SVG đã rasterize, ≤ 1 MB, ≤ 1024 px, load từ origin nội bộ (không URL tuỳ ý); không render SVG trực tiếp vào DOM.

## Next Steps
- Phase 05 dùng các builder này làm "palette" đặt linh kiện. Cẩu MPP sau này có animation cho mô phỏng heavy-lift (roadmap P2/P4, RT-7).
