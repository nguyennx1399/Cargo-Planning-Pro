# Vessel 3D Model Pipeline — từ bản vẽ tàu tới mô hình 3D + thủy tĩnh

- **Parent:** [roadmap v2](../260911-0939-cargo-planner-v2-roadmap/plan.md) (cross-cutting P0→P5) · liên quan [P1 frontend demo](../260911-0945-p1-frontend-stowage-demo/plan.md)
- **Nguồn:** brief user 2026-09-11 (tài liệu cần có, 3 mức độ chính xác, lofting, thư viện linh kiện, tracing GA, sơn/đường nước, hiệu năng, 1 hệ toạ độ, 1 nguồn hình học)
- **Status:** In progress (Phase 01–04, 06 complete; Phase 05 partial — engine layer only, UI deferred; Phase 07 pending). Phase 04–06 self-verified only — session rate limit blocked the usual tester/code-reviewer subagents; re-run them when capacity returns (see phase-04 file § "Xác minh vòng 2", phase-05/06 files § Deviations). Phase 06 caught and self-fixed a real bug in this session's own Wigley test fixture orientation — see phase-06 § Deviations before reusing that fixture for anything z-direction-sensitive.

## Mục tiêu
Một tài liệu hình học tàu `VesselGeometry` duy nhất dùng cho cả hiển thị 3D lẫn tính toán, có 3 mức độ chính xác, và quy trình onboarding đủ nhanh để làm cho nhiều tàu (sản phẩm thương mại).

## Nguyên tắc ràng buộc (mọi phase)
- **G1 Một hệ toạ độ:** ship frame của roadmap P1: `x` từ AP về mũi, `y` dương về mạn phải, `z` từ baseline. Khoảng sườn lấy từ bảng `frames[]` (có thể thay đổi dọc tàu). Scene chỉ đổi qua đúng một hàm `shipToScene`.
- **G2 Một nguồn hình học:** lưới offsets (`HullOffsets`) là dạng chuẩn. L1 sinh offsets từ tham số, L2 nhập offsets, còn mesh L3 chỉ để hiển thị (cắt lát ra offsets là tuỳ chọn). Chỉ có một loft mesher và một bộ tích phân dùng chung.
- **G3 Thủy tĩnh tính từ offsets có trạng thái `computed`:** KHÔNG thay thế booklet (RT-2, IACS UR L5). Chỉ dùng để kiểm chứng hull, điền chỗ trống (có nhãn) và chạy sandbox/demo.
- **G4 Sister ships:** `VesselGeometry` là tài liệu độc lập, có version và hash. `Vessel` tham chiếu `geometry_id`, có thể override livery.
- **G5 Bản vẽ chủ tàu là dữ liệu mật** (RT-1, RT-14): không commit. Đến P2 xử lý hoàn toàn trong trình duyệt. File upload là untrusted input, phải giới hạn kích thước.
- **G6 Mọi phase PHẢI wire vào demo thật, không chỉ pass test.** Bài học từ phase 01–03: engine code (`engine/hull/*`, `engine/vessel-components/*`) được viết, test đầy đủ, typecheck/build xanh — nhưng `App.tsx` vẫn gọi backend API cũ (`/api/vessels/{id}`), nên **không hiển thị gì mới** khi mở app thật, mãi tới khi người dùng hỏi "sao demo không đổi gì". Từ nay, một phase chỉ tính "Complete" khi:
  1. Có đường dẫn thật từ `App.tsx` (hoặc trang/tab mới) tới code mới — không phải chỉ import trong test.
  2. Đã chạy `npm run dev`, xác nhận bằng `curl`/kiểm tra HTML hoặc (khi có công cụ browser) chụp ảnh màn hình — ghi rõ trong phase file phần nào đã xác nhận bằng mắt, phần nào chỉ xác nhận qua test/suy luận.
  3. Nếu phase KHÔNG có bề mặt UI (ví dụ phase 01 — thuần schema/toạ độ), ghi rõ lý do được miễn ở Success Criteria, không im lặng bỏ qua.
  Xem "Đã áp dụng vào demo" bên dưới cho việc khắc phục phase 01–03.

## 3 mức độ chính xác
| Mức | Đầu vào | Hull source | data_status | Mục tiêu thời gian/tàu |
|---|---|---|---|---|
| L1 Tham số | Main particulars + Cb + kiểu mũi/đuôi | `parametric` | `synthetic` | < 5 phút |
| L2 Theo bản vẽ | Offsets (hoặc body plan trace) + GA | `offsets` | `assumed` → `verified` sau phase 06 | ≤ 3 giờ |
| L3 CAD | STEP/IGES/GLB/OBJ từ nhà máy | `mesh` (+ offsets cắt lát) | theo kiểm chứng | tuỳ file |

## Phases
| # | Phase | Roadmap | Size | Depends | Status |
|---|---|---|---|---|---|
| 01 | [Schema VesselGeometry + ship frame](phase-01-vessel-geometry-schema-and-ship-frame.md) | P1 | S | — | Complete |
| 02 | [Hull tham số L1 + loft mesher dùng chung](phase-02-parametric-hull-generator-and-loft-mesher.md) | P1 | M | 01 | Complete |
| 03 | [Thư viện linh kiện, sơn/livery, hiệu năng](phase-03-component-library-livery-paint-render-perf.md) | P1 | M | 02, P1-demo ph04 | Complete (core scope; LOD/water-toggle/logo-decal/draft-marks deferred) |
| 04 | [Nhập offsets + lofting L2](phase-04-offsets-import-fairness-check-lofting.md) | P2 | M | 02 | Complete (self-verified; subagent review pending — rate limit) |
| 05 | [Công cụ onboarding: tracing GA/body plan](phase-05-drawing-tracer-vessel-onboarding-tool.md) | P2 | L | 03, 04 | Partial (engine layer only — calibration math, bay-LCG, body-plan digitizer, publish checklist; pdf.js/canvas UI not started) |
| 06 | [Thủy tĩnh từ offsets + đối chiếu booklet](phase-06-hydrostatics-from-offsets-booklet-check.md) | P4 | M | 04, dữ liệu P0 | Complete (core scope; booklet-compare UI + tàu tham chiếu thật chưa làm) |
| 07 | [Nhập CAD L3 + onboarding tự phục vụ](phase-07-cad-mesh-import-and-self-serve-onboarding.md) | P5 | L | 05, 06, nền P5 | Pending |

Thu thập tài liệu (GA, lines plan/offsets, capacity plan, cẩu, ảnh) của 2 tàu mẫu thuộc roadmap **P0 bước 0.4** (đã cập nhật).

## Đã áp dụng vào demo (retrofit, 2026-09-11)
Phase 01–03 hoàn thành đúng scope kỹ thuật nhưng KHÔNG hiển thị trong app thật (G6 chưa tồn tại lúc đó). Đã vá:
- `frontend/src/data/build-demo-plan.ts` (mới): `buildDemoVesselAndCargo()`, `buildEmptyDemoPlan()`, `buildLoadedDemoPlan()` — tàu/cargo/plan dựng hoàn toàn ở frontend, không gọi backend.
- `frontend/src/App.tsx`: đổi từ `useQuery` gọi `/api/vessels/{id}` sang gọi thẳng các hàm trên — khớp quyết định gốc của P1-demo plan ("Frontend-only... No backend calls"), việc "chuyển App.tsx" này vốn thuộc P1-demo phase 2 nhưng chưa ai làm.
- `frontend/src/engine/naive-fill-plan.ts` (mới): fill cargo demo kiểu naive (không phải auto-stow thật) để có hàng nhìn thấy trên tàu.
- `frontend/src/features/panels/Sidebar.tsx`: nút "Load demo cargo" / "Clear cargo" + wire `validatePlan()` (trước đó panel "Checks" treo mãi ở "Checking plan…" vì `report` không bao giờ được truyền).
- **Giới hạn phát hiện được, chưa sửa** (ghi lại để không quên): `naiveFillPlan` chỉ xếp được container 40'; 400 container 20' luôn "unplaced" vì `vessel.stacks` chỉ có bay chẵn (40'). Xếp 20' vào nửa bay lẻ (fore/aft, share 1 tier vật lý) là logic domain riêng, chưa tồn tại ở đâu trong code — thuộc phạm vi P1-demo phase 4, KHÔNG phải phase nào của plan này.
- Đã xác nhận qua: `npm run typecheck`, `npm test` (168/168), `npm run build`, và `curl localhost:5173` (dev server đang chạy, Vite HMR tự áp dụng thay đổi) — CHƯA có ảnh chụp màn hình browser thật trong phiên này (không có công cụ browser).

## Liên kết plan khác
- Roadmap phase-01 1.G (hull + hầm) và 1.I (mặt nước, vạch mớn): thực hiện qua phase 01–03 của plan này.
- P1-demo phase-04: hạng mục "hull resize/bow taper" giao cho phase 02; `ShipGroup`/`Water` vẫn do P1-demo phase-04 làm.
- P1-demo phase-06: bảng thủy tĩnh demo phải khớp thể tích hull tham số trong ±5% (test ở phase 02), để phần sơn đỏ chìm/nổi đúng với con số hiển thị.

## Success criteria (tổng)
- L1: tàu mới hiển thị từ particulars, Cb sai lệch ≤ 0.002, không slot under-deck nào xuyên vỏ tàu.
- L2: onboard mỗi tàu tham chiếu ≤ 3 giờ (đo thật). Thể tích mesh loft khớp tích phân offsets ±1%.
- Thủy tĩnh computed nằm trong dung sai so với booklet ở ≥ 3 mớn nước cho cả 2 tàu tham chiếu.
- Không regression perf gate P1 (≥ 55 fps); phần tàu ≤ 12 draw call.

## Unresolved questions
1. XLSX offsets: parse trực tiếp (SheetJS, rủi ro license/CDN) hay chỉ nhận CSV? Đề xuất: chỉ CSV ở phase 04.
2. Đưa phase 06 lên sớm để sinh bảng thủy tĩnh demo từ hull tham số (cho P1 demo nhất quán)? Đề xuất: có, nhỏ, vẫn giữ nhãn DEMO DATA.
3. Dung sai đối chiếu booklet (phase 06) cần naval architect/đăng kiểm xác nhận.
4. Chuyển đổi STEP/IGES: occt-import-js (wasm) hay FreeCAD CLI ở backend worker?
