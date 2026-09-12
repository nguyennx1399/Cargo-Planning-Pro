# Phase 07 — Nhập CAD/mesh (L3) + onboarding tự phục vụ

## Context Links
- [plan.md](plan.md) G2, G4, G5 · [phase-05](phase-05-drawing-tracer-vessel-onboarding-tool.md) · [phase-06](phase-06-hydrostatics-from-offsets-booklet-check.md)
- Roadmap P5 (thư viện tàu theo khách hàng, onboarding tự phục vụ; auth, tenant, object storage), P3 (job queue), RT-3, RT-14 (GLTF→GLB with limits, signed URLs)

## Overview
- Priority: P3 (tuỳ chọn cao cấp) · Size: L · Status: pending · Roadmap P5
- Nhận file 3D từ nhà máy, căn vào ship frame, tối ưu cho web (nén, LOD) và tuỳ chọn cắt lát ra offsets để đi qua cùng calculator thủy tĩnh. Mở toàn bộ công cụ onboarding cho khách hàng tự làm.

## Key Insights
- File gốc của NAPA/AVEVA/Cadmatic không đọc được trực tiếp. Hãy yêu cầu nhà máy **export STEP/IGES hoặc OBJ/GLB**. Rhino `.3dm` đọc được bằng `rhino3dm` (open source).
- STEP/IGES là NURBS và phải tessellate: chạy ở backend worker (job queue P3), không chạy trên trình duyệt người dùng.
- Mesh CAD thường chứa cả kết cấu bên trong, không kín, đơn vị mm, trục Y-up. Cần bước căn chỉnh và lọc vỏ ngoài. Cắt lát ra offsets chỉ đáng tin khi vỏ ngoài kín.
- Theo G2, mesh L3 là **hiển thị**. Tính toán vẫn đi qua offsets (cắt lát từ mesh, hoặc bảng offsets có sẵn), nên chỉ có một đường tính.

## Requirements
- F1 Upload GLB/glTF/OBJ/STL/STEP/IGES/3DM; giới hạn kích thước (ví dụ ≤ 200 MB), số tam giác sau tessellate, số node.
- F2 Job convert (backend worker): STEP/IGES/3DM → GLB (occt hoặc rhino3dm), rồi gltf-transform: dedup, weld, simplify, meshopt (Draco tuỳ chọn), sinh 2 LOD. Lưu object storage theo tenant, dùng signed URL.
- F3 Căn chỉnh: tự đoán đơn vị (bbox so với LOA) và trục up. UI chọn AP, baseline, centreline, rồi overlay mesh loft từ offsets (nếu có) kèm heatmap độ lệch.
- F4 Tuỳ chọn cắt lát: giao mặt phẳng station/WL với vỏ ngoài → `HullOffsets` → fairness (phase 04) → thủy tĩnh (phase 06).
- F5 Tự phục vụ:
  - Khách dùng tracer (phase 05), import CAD và clone sister ship trong tenant của mình.
  - Bước duyệt bởi role `vessel_data_approver` trước khi geometry được dùng trong plan.
  - Version bất biến sau khi duyệt (RT-2).
- F6 Decoder (meshopt/Draco wasm) host local, không dùng CDN ngoài.
- F7 **(G6, bắt buộc)** `CadImportPanel`/`ApprovalPanel` PHẢI mount vào flow onboarding thật đang chạy (phase 05), không chỉ tồn tại như component có test.

## Architecture
```
backend/app/vessel_models/                  (Python, roadmap P5 platform)
  upload_routes.py        signed upload URL, size caps, content sniffing
  convert_job.py          queue job: tessellate → GLB → gltf-transform (Node CLI in worker image)
  mesh_section_slicer.py  (hoặc TS) plane–mesh intersection → offsets
frontend/src/features/vessel-onboarding/
  CadImportPanel.tsx  MeshAlignmentTool.tsx  MeshDeviationOverlay.tsx  ApprovalPanel.tsx
frontend/src/features/viewer3d/
  VesselModel.tsx         hull.source === "mesh" → useGLTF(signedUrl) + LOD; components vẫn từ ComponentSpec
```

## Related Code Files
- Create: như trên (backend module mới + component frontend) + tests (convert với STEP mẫu synthetic, căn chỉnh đơn vị/trục, slicer trên mesh Wigley → Cb ±0.01)
- Modify: `features/viewer3d/VesselModel.tsx`, `types/vessel-geometry.ts` (`mesh_transform`, `mesh_lods`), docker worker image (Node + occt/rhino3dm)
- Delete: none

## Implementation Steps
1. Chốt công cụ chuyển đổi: occt-import-js hay FreeCAD/OCC CLI (xem Unresolved), prototype với 1 file STEP thật từ nhà máy (nếu có quyền).
2. Upload + job convert + tối ưu + lưu trữ theo tenant (dựa nền P3/P5).
3. Alignment tool + overlay độ lệch.
4. Slicer → offsets → fairness → thủy tĩnh; test Wigley.
5. Luồng tự phục vụ: role, duyệt, version bất biến, clone sister ship. Viết tài liệu hướng dẫn khách hàng.
6. Load test: GLB lớn nhất cho phép vẫn đạt fps gate khi có full container.

## Todo List
- [ ] chọn + prototype converter STEP/IGES
- [ ] upload an toàn + job convert + gltf-transform + LOD
- [ ] alignment + deviation overlay
- [ ] slicer mesh → offsets (+ test Wigley)
- [ ] tự phục vụ: role duyệt, version bất biến, clone
- [ ] tài liệu khách hàng + load test
- [ ] **(G6)** mount panel vào flow onboarding thật + xác nhận qua dev server

## Success Criteria
- Một file CAD thật hiển thị đúng vị trí (sai lệch với offsets ≤ 0.1% LBP), GLB sau tối ưu ≤ 10 MB, fps gate đạt.
- Một khách hàng pilot tự onboard được một tàu mà không cần đội mình can thiệp.
- **(G6)** Panel bấm được từ flow onboarding thật đang chạy.

## Risk Assessment
| Rủi ro | Giảm thiểu |
|---|---|
| Nhà máy không chia sẻ file CAD (sở hữu trí tuệ) | L2 vẫn là chuẩn; L3 là tuỳ chọn cao cấp |
| File CAD khổng lồ, nhiều chi tiết thừa | Giới hạn + simplify + chỉ giữ vỏ ngoài/thượng tầng; từ chối rõ ràng nếu vượt giới hạn |
| Converter crash hoặc treo với file độc hại | Worker cô lập (container, không mạng ra ngoài, timeout, giới hạn RAM) |

## Security Considerations
- File CAD là untrusted input:
  - Content sniffing, giới hạn kích thước và số tam giác.
  - Converter chạy sandbox (không egress, timeout); GLTF→GLB (bỏ URI ngoài) (RT-14).
- Lưu trữ theo tenant, signed URL hết hạn ngắn, mã hoá at rest (RT-1).
- Chỉ role duyệt mới publish được geometry dùng cho plan; audit log hành động (RT-10).

## Next Steps
- Thư viện tàu dùng chung (sister ships giữa các tenant) chỉ khi có thỏa thuận dữ liệu; mặc định tách tenant.

## Unresolved Questions
- occt-import-js (wasm, chạy được trong Node worker) hay FreeCAD CLI (nặng hơn, mạnh hơn)?
- Có hỗ trợ `.3dm` ngay không, hay chờ khách hàng yêu cầu?
