# Phase 0 — Khám phá: người dùng, dữ liệu, thị trường

## Context Links
- Reference: [reference-v2-product-plan.md](./reference-v2-product-plan.md) §3 (UX), §4 (dữ liệu), §7 phase 0, §12 câu hỏi mở
- Docs: `docs/DOMAIN.md`, `docs/project-overview-pdr.md`, `docs/project-roadmap.md`
- Code liên quan: `backend/app/domain/models.py` (sẽ thành package ở phase 1), `backend/app/data/sample_vessel.json`
- Tiếp theo: [phase-01](./phase-01-viewer-and-ux-foundation.md)

## Overview
- Priority: P1 (chặn connector thật, stability, định vị thương mại)
- Status: pending
- Mô tả: phase không-code. Deliverable là tài liệu nghiên cứu, mapping dữ liệu, dữ liệu 2 tàu tham chiếu, ma trận cạnh tranh. Cỡ: 3M + 3S.

## Key Insights
- 3 câu hỏi mở (§12) chặn một phần: hệ thống shipment DB, khách hàng đầu tiên, tiếp cận planner. Nhiều việc vẫn bắt đầu được ngay (xem bảng "Bắt đầu được ngay?").
- Dữ liệu tàu KHÔNG có trong shipment DB → booklet là đường găng cho stability (phase 2/4).
- MPP break-bulk thường thiếu kích thước/trọng tâm/điểm cẩu → mapping phải ghi rõ trường "thiếu" để thiết kế màn hình hàng thiếu dữ liệu, không đoán ngầm.
- Quyền dùng dữ liệu shipment cho sản phẩm thương mại = rủi ro Cao → phải có văn bản trước khi đưa dữ liệu thật vào môi trường dev.
- Refactor phase 1 (CargoUnit/StowageSpace) chạy song song; "chốt data model" ở đây = review model đã refactor dựa trên mapping + booklet, không chờ.

## Requirements
Functional (deliverable):
1. Kịch bản phỏng vấn + ghi chép 5–8 buổi (container và MPP).
2. Journey map + danh sách điểm đau đã xác nhận + top-3 luồng công việc.
3. Phân tích shipment DB + mapping → `CargoUnit` (template bảng dưới).
4. Checklist dữ liệu tàu + dữ liệu đã trích cho 2 tàu tham chiếu (1 container, 1 MPP).
5. Ma trận cạnh tranh (tính năng, giá, điểm yếu UX).
6. Biên bản chốt data model v2 (diff so với phase 1 refactor).

Non-functional:
- Dữ liệu thật: chỉ lưu ngoài repo hoặc bản ẩn danh; không commit booklet/shipment gốc nếu chưa có quyền.
- Artifact dạng Markdown/CSV/XLSX, tên kebab-case.

## Architecture (vị trí artifact)

```
docs/research/v2-discovery/
├── interview-script.md                 # kịch bản phỏng vấn
├── interview-notes/{yymmdd}-{role}-{alias}.md   # ẩn danh, không tên thật
├── journey-map.md                      # + link Figma/FigJam
├── pain-points.md                      # bảng điểm đau, tần suất, mức độ, xác nhận bởi ai
├── top-3-workflows.md
├── shipment-db-analysis.md             # bảng, trường, chất lượng
├── shipment-to-cargo-unit-mapping.csv  # template bên dưới
├── vessel-data-checklist.md            # checklist bên dưới
├── reference-vessels/{vessel-alias}/   # CSV trích từ booklet (hoặc chỉ link nếu dữ liệu mật)
├── competitor-matrix.md
└── data-model-v2-decision.md           # biên bản chốt
```
Dữ liệu mật (booklet gốc, dump shipment): lưu kho tài liệu công ty, repo chỉ chứa link + bản ẩn danh.

## Related Code Files
- Create: chỉ file tài liệu ở `docs/research/v2-discovery/` (liệt kê trên)
- Modify: `docs/DOMAIN.md` (bổ sung thuật ngữ MPP sau phỏng vấn — thực hiện ở docs-sync phase 1)
- Delete: none

## Implementation Steps

### 0.1 Phỏng vấn + quan sát 5–8 planner (M)
Kịch bản (outline, 60–75 phút):
1. Bối cảnh (5'): vai trò, loại tàu, số chuyến/tháng, công cụ đang dùng (MACS3, K-Load, Loadmaster, Excel...).
2. Quan sát (25'): xem họ làm một plan thật trên màn hình; ghi thời gian từng bước, số lần chuyển công cụ, chỗ lúng túng.
3. Luồng chuyến (10'): nhận booking → danh sách hàng → pre-plan → gửi tàu/cảng. Dữ liệu từ đâu, định dạng gì, ai duyệt.
4. Ràng buộc (10'): ràng buộc nào hay vi phạm nhất, kiểm tra ổn định lúc nào, ai quyết khi xung đột (planner vs chief officer).
5. MPP riêng (10'): hàng thiếu kích thước/trọng tâm xử lý thế nào, tải sàn, tweendeck, cẩu tàu, heavy-lift.
6. Đóng (5'): "cây đũa thần" — 1 việc muốn công cụ làm hộ; đồng ý tham gia kiểm thử khả dụng.
- Tuyển: 4 container + 3–4 MPP + ≥1 chief officer + ≥1 operations/commercial.
- Ghi chú ẩn danh theo template (vai trò, loại tàu, quan sát, trích dẫn, điểm đau).

### 0.2 Journey map, điểm đau, top-3 luồng (S)
- Journey map theo 7 luồng §3.2 (tạo chuyến → xuất) × vai trò; mỗi bước: hành động, công cụ, thời gian, cảm xúc, điểm đau.
- `pain-points.md` cột: id, mô tả, vai trò, tần suất (x/5 người), mức độ (1–3), bằng chứng (link note), cơ hội sản phẩm.
- Top-3 luồng = đầu vào wireframe Figma phase 1 (reference §13.5).

### 0.3 Phân tích shipment DB + mapping (M)
- Liệt kê bảng/trường, số bản ghi, % null theo trường, đơn vị (kg/t, cm/m), mã cảng (UN/LOCODE?), mã IMDG.
- Template `shipment-to-cargo-unit-mapping.csv`:

| source_table.field | target_field (CargoUnit / ContainerDetails / PortCall) | required? (container / breakbulk / project) | transform (đơn vị, mã) | % null / quality notes | fallback khi thiếu |
|---|---|---|---|---|---|
| e.g. `booking_item.gross_kg` | `CargoUnit.weight_t` | Y/Y/Y | kg→t ÷1000 | 2% null, vài giá trị 0 | → danh sách hàng thiếu dữ liệu |
| e.g. `booking_item.length_cm` | `CargoUnit.length_m` | derived/Y/Y | cm→m | 40% null ở break-bulk | → thiếu dữ liệu, không đoán |

- Target fields cần phủ: `id, kind, length_m, width_m, height_m, weight_t, cog_offset_m, stackable, max_stack_load_t, lifting_points, imdg_class, pol, pod, allowed_rotations, shape` + `ContainerDetails(iso_code, size, type, high_cube, oog)` + `PortCall(locode, sequence, eta, etd, max_draft_m)`.
- Chính sách ẩn danh: hash consignee/shipper, bỏ tên người, giữ thống kê kích thước/trọng lượng.

### 0.4 2 tàu tham chiếu + booklet (M)
`vessel-data-checklist.md` — trích từ stability booklet / loading manual:
- Chung: LOA, LBP, B, D, design draft, summer draft, ρ nước tham chiếu, hệ tọa độ (gốc AP hay midship, dấu TCG).
- Lightship: weight, LCG, VCG (KG), TCG.
- Bảng thủy tĩnh (theo draft, even keel, ρ=1.025): Δ, T, KM (KMt), LCB, LCF, MTC (t·m/cm), TPC, (KB, BMt nếu có). Ghi bước draft và giới hạn.
- Két: tên, loại (FO/DO/FW/BW), capacity m³, ρ, LCG/TCG/VCG theo mức đầy (sounding/ullage table), FSM tối đa.
- Hằng số: crew/stores/constant weight + tọa độ.
- Sức bền: frame stations, SF/BM cho phép (harbour/seagoing), weight distribution lightship theo station.
- Tiêu chí ổn định: GM min, IMO IS Code criteria (GZ area) — ghi chú cho phase 4.
- Hầm hàng (MPP): kích thước từng hầm (L×B×H theo khung sườn), tweendeck (cao độ, vị trí pontoon), miệng hầm (L×B), tải sàn t/m² (tank top, tweendeck, hatch cover), clear height.
- Slot (container): bay/row/tier, stack weight limit, reefer plugs, line of sight.
- Cẩu tàu: SWL, tầm với min/max, vị trí chân cẩu (x,y,z), chiều cao đầu cần, chế độ tandem.
- Kết quả tham chiếu: ≥2 loading condition có kết quả in sẵn (Δ, drafts, GM, trim) → dùng làm test case tay phase 2/4.
- Bản vẽ cho mô hình 3D (xem [vessel 3D model pipeline](../260911-1409-vessel-3d-model-pipeline/plan.md)):
  - Main particulars: LOA, LBP, B, D, design draft, Cb, overhang lái (aft end → AP).
  - **Bảng khoảng sườn** (frame spacing theo đoạn, sườn 0 ở đâu).
  - General Arrangement: profile + plan (cabin, ống khói, cẩu, miệng hầm, cột, xuồng cứu sinh).
  - **Lines plan / bảng offsets** (đơn vị, cách đánh số station, profile mũi/lái). Nếu chỉ có body plan scan thì ghi rõ (sẽ số hoá bằng tracer).
  - Capacity plan / cell guide: tâm bay, slot LCG/TCG/VCG nếu có bảng.
  - Thông số cẩu: SWL, tầm với min/max, vị trí bệ.
  - Ảnh tàu thật: màu sơn, logo, dải boot-top.
  - Danh sách sister ships dùng chung thiết kế.

### 0.5 Nghiên cứu cạnh tranh (S)
`competitor-matrix.md` cột: sản phẩm (Navis MACS3/StowMan, Kongsberg K-Load, Kockumation Loadmaster, + khác phát hiện), phân khúc tàu, hỗ trợ MPP/project cargo, 3D, auto-stow, stability class-approved, triển khai (on-prem/cloud), giá (công khai/ước lượng), điểm yếu UX (từ phỏng vấn), cơ hội.

### 0.6 Chốt data model v2 (S)
- Input: model sau refactor phase 1 (1.B), mapping 0.3, checklist 0.4.
- Output `data-model-v2-decision.md`: trường thêm/bỏ, trường optional vs required theo `kind`, đơn vị, hệ tọa độ. Diff → task nhỏ trong phase 1.

### Bắt đầu được ngay?

| Bước | Chờ câu hỏi mở? |
|---|---|
| 0.1 kịch bản, danh sách ứng viên | Không (tuyển thật cần "tiếp cận planner") |
| 0.2 | Sau ≥3 buổi phỏng vấn |
| 0.3 | Chờ "shipment DB thuộc hệ thống nào" + quyền dữ liệu; template làm ngay |
| 0.4 checklist | Không; thu booklet cần chọn tàu (phụ thuộc "khách hàng đầu tiên") |
| 0.5 | Không |
| 0.6 | Sau 0.3 + 0.4 + phase 1 bước 1.B |

## Todo List
- [ ] Soạn `interview-script.md`, danh sách 5–8 ứng viên
- [ ] Thực hiện phỏng vấn/quan sát, ghi note ẩn danh
- [ ] Journey map + `pain-points.md` + `top-3-workflows.md`
- [ ] Làm rõ quyền sử dụng shipment DB (văn bản)
- [ ] `shipment-db-analysis.md` + `shipment-to-cargo-unit-mapping.csv`
- [ ] Chọn 2 tàu tham chiếu, xin booklet, điền `vessel-data-checklist.md`
- [ ] Trích bảng thủy tĩnh/két/lightship/hầm hàng sang CSV
- [ ] Thu GA, lines plan/offsets, capacity plan, thông số cẩu, ảnh, bảng khoảng sườn của 2 tàu mẫu
- [ ] `competitor-matrix.md`
- [ ] `data-model-v2-decision.md`

## Success Criteria
- Điểm đau xác nhận bởi ≥3 người/điểm cho top-10.
- Mapping phủ 100% target fields (có giá trị hoặc ghi "không có nguồn").
- 2 tàu: đủ dữ liệu cho stability xấp xỉ (lightship + thủy tĩnh + ≥1 condition có kết quả) — MPP thêm hình học hầm/tweendeck/miệng hầm/tải sàn.
- Ma trận cạnh tranh ≥3 đối thủ.

## Risk Assessment
| Rủi ro | Giảm thiểu |
|---|---|
| Không tiếp cận được planner | Mạng lưới ngành, đổi dùng thử miễn phí lấy góp ý; phỏng vấn online + chia sẻ màn hình |
| Không có booklet | Bảng giả định (flag `data_status="assumed"`), synthetic vessel tiếp tục |
| Quyền dữ liệu chưa rõ | Chỉ dùng dữ liệu ẩn danh/synthetic; connector thật chờ |
| Mapping thiếu trường MPP nhiều | Thiết kế màn hình "hàng thiếu dữ liệu" (phase 1) là tính năng, không phải lỗi |

## Security Considerations
- NDA với người phỏng vấn/chủ tàu nếu cần; ẩn danh note.
- Booklet, dump shipment: không commit; truy cập theo nhu cầu.
- Credentials shipment DB (read-only) chỉ qua env/secret manager.

## Next Steps
- Top-3 luồng → wireframe Figma (phase 1 WP 1.F).
- Mapping → connector thật (phase 1 WP 1.K).
- Dữ liệu tàu → sample thật + stability (phase 2).

## Unresolved Questions
- Shipment DB thuộc hệ thống nào (IMOS/ERP/riêng)? Có kích thước + trọng tâm break-bulk không?
- Khách hàng đầu tiên: hãng container, chủ tàu MPP, hay đại lý? (quyết định tàu tham chiếu nào lấy trước)
- Tiếp cận planner được bao nhiêu người, qua kênh nào?
