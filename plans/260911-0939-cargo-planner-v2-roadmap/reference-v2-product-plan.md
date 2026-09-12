# Kế hoạch dự án: Cargo Planner 3D — v2 (tài liệu gốc từ user, 2026-09-11)

> Nguồn: user cung cấp nguyên văn. Đây là source of truth về sản phẩm cho plan này. Không sửa nội dung; mọi điều chỉnh ghi trong plan.md / phase files.

Sản phẩm thương mại lập kế hoạch xếp hàng cho tàu container và tàu đa năng (multipurpose, MPP), với mô phỏng 3D, cảnh báo vi phạm tức thì, mô phỏng trạng thái nổi của tàu (nghiêng, chúi, lún) và AI tự động xếp hàng. Trải nghiệm người dùng (UX) là ưu tiên số một.

## Các quyết định đã chốt

| Câu hỏi | Quyết định | Hệ quả chính |
|---|---|---|
| Loại tàu | Container + multipurpose | Cần hai kiểu không gian xếp hàng (slot và hầm hàng tự do) và hai engine xếp hàng |
| Nguồn dữ liệu | Database shipment | Có sẵn dữ liệu hàng. Dữ liệu tàu (thủy tĩnh, hầm hàng) vẫn phải lấy nguồn khác |
| Mục tiêu | Thương mại | Cần multi-tenant, bảo mật, phân quyền, định vị cạnh tranh, lộ trình đăng kiểm |
| Thời gian | Chưa quan trọng | Bỏ lịch theo tuần, dùng thứ tự ưu tiên và độ lớn công việc (S/M/L) |
| Ưu tiên | UX | UX thành một track xuyên suốt, có nghiên cứu người dùng và kiểm thử ở mọi phase |

## 1. Tổng quan

### 1.1 Vấn đề
Planner phải cân đối cùng lúc thứ tự dỡ hàng theo cảng, giới hạn tải trọng, hàng lạnh, hàng nguy hiểm và độ ổn định tàu. Với tàu đa năng, bài toán còn khó hơn: hàng có hình dạng bất kỳ (máy móc, thép, cấu kiện dự án, hàng siêu trường siêu trọng), phải tính tải trọng sàn hầm, vị trí tweendeck, và độ nghiêng khi tàu tự cẩu hàng nặng. Công cụ hiện có phần lớn là loading computer với giao diện cũ, nặng về bảng số, khó hình dung.

### 1.2 Giải pháp

| Lớp | Tên | Người dùng nhận được gì |
|---|---|---|
| 1 | Nhìn thấy | Tàu và toàn bộ hàng trong 3D, cùng bay plan / hold plan 2D |
| 2 | Kiểm soát | Xếp tay trực quan, báo lỗi ngay khi vi phạm ràng buộc |
| 3 | Trạng thái nổi | Tàu nghiêng, chúi, lún trong 3D so với mặt nước, có cảnh báo ngưỡng |
| 4 | Tự động hóa | AI sinh plan tối ưu cho cả container và hàng rời/dự án |

### 1.3 Định vị thương mại
Điểm khác biệt dự kiến là UX hiện đại (3D trực quan, phản hồi tức thì, học nhanh) và hỗ trợ tốt tàu đa năng, phân khúc có hàng hóa phức tạp nhưng ít công cụ trực quan. Cần xác minh bằng nghiên cứu cạnh tranh ở phase 0 (các tên thường gặp trong lĩnh vực: Navis MACS3 / StowMan, Kongsberg K-Load, Kockumation Loadmaster).

### 1.4 Nguyên tắc sản phẩm
- UX quyết định. Mọi tính năng phải được kiểm thử với planner thật trước khi coi là xong.
- Validator trước optimizer. Mọi plan, dù người hay AI tạo, đều qua cùng một bộ kiểm tra.
- Thấy hậu quả ngay. Mỗi thao tác phản ánh tức thì lên 3D, số liệu ổn định và danh sách vi phạm.
- Công cụ hỗ trợ quyết định trước, loading computer sau. Bắt đầu ở vai trò pre-planning, lộ trình đăng kiểm tính sau.

## 2. Phạm vi

### 2.1 Loại tàu và loại hàng

| Loại tàu | Không gian xếp hàng | Loại hàng |
|---|---|---|
| Container | Slot cố định theo bay/row/tier | Container 20'/40'/45', reefer, IMDG, OOG |
| Multipurpose | Hầm hàng, tweendeck, mặt boong: không gian 3D tự do + khu vực slot container | Container, break-bulk (thép, bao, pallet), project cargo, heavy-lift |

### 2.2 Ngoài phạm vi (giai đoạn đầu)
Tàu hàng rời thuần (bulk carrier), tàu dầu, ro-ro, tính lashing chi tiết cho hàng dự án, cộng tác nhiều người thời gian thực, chứng nhận đăng kiểm loading computer.

## 3. UX — track xuyên suốt

### 3.1 Người dùng và công việc cần làm

| Người dùng | Công việc chính | Điều họ cần nhất |
|---|---|---|
| Stowage planner (container) | Lập plan cho hàng nghìn container, nhiều cảng | Tốc độ, thao tác hàng loạt, bàn phím, bay plan quen thuộc |
| Cargo planner (MPP) | Xếp hàng hình dạng bất kỳ vào hầm, kiểm tra tải sàn, cẩu | Hình dung 3D chính xác, đo khoảng cách, va chạm |
| Chief officer | Kiểm tra plan trước khi làm hàng | Tóm tắt ổn định rõ ràng, cảnh báo nổi bật |
| Operations / commercial | Xem còn chỗ không, nhận thêm booking được không | Tổng quan dung tích còn trống, trả lời nhanh |

### 3.2 Luồng công việc cốt lõi cần thiết kế
1. Tạo chuyến và kéo hàng từ database shipment vào
2. Xem tổng quan: hàng nào chưa xếp, dung tích còn lại, trạng thái ổn định
3. Xếp hàng: tự động toàn bộ, tự động một phần, hoặc thủ công
4. Sửa plan: kéo thả, hoán đổi, khóa vị trí rồi cho AI xếp lại phần còn lại
5. Kiểm tra: vi phạm, ổn định, phát lại trình tự xếp dỡ
6. So sánh các phương án plan cạnh nhau
7. Xuất: BAPLIE, báo cáo PDF, gửi cho tàu và cảng

### 3.3 Nguyên tắc thiết kế

| Nguyên tắc | Cụ thể |
|---|---|
| Nói ngôn ngữ planner | Giữ quy ước bay plan và thuật ngữ ngành, không tự đặt khái niệm mới |
| 2D để làm, 3D để hiểu | Thao tác chính trên bay/hold plan 2D. 3D để kiểm tra, trình bày, và cho hàng MPP |
| Phản hồi dưới 300 ms | Ổn định, vi phạm, tàu nghiêng cập nhật ngay khi thả hàng |
| Dày thông tin nhưng bình tĩnh | Nhiều số liệu, ít màu. Màu đỏ và vàng chỉ dành cho vi phạm |
| Undo mọi thứ | Không thao tác nào mất dữ liệu, có lịch sử phiên bản |
| Người dùng chuyên nghiệp dùng bàn phím | Phím tắt, chọn hàng loạt, thanh lệnh tìm kiếm |
| AI minh bạch | Plan tự động luôn kèm lý do và cho phép khóa, sửa, xếp lại |

### 3.4 Quy trình UX

| Hoạt động | Khi nào | Công cụ |
|---|---|---|
| Phỏng vấn 5–8 planner (container và MPP) | Phase 0 | Phỏng vấn, quan sát màn hình làm việc thật |
| Bản đồ hành trình, danh sách điểm đau | Phase 0 | Journey map |
| Wireframe và prototype click được | Trước mỗi phase | Figma |
| Kiểm thử khả dụng với 3–5 người | Cuối mỗi phase | Kịch bản nhiệm vụ, đo thời gian và lỗi |
| Design system riêng | Từ phase 1 | Token màu, typography, component thư viện |

### 3.5 Chỉ số UX
Thời gian hoàn thành plan so với công cụ họ đang dùng, số lỗi thao tác mỗi nhiệm vụ, tỷ lệ hoàn thành nhiệm vụ không cần hướng dẫn, thời gian học đến khi tự làm được plan đầu tiên, và điểm hài lòng (SUS) sau mỗi vòng kiểm thử.

## 4. Chiến lược dữ liệu
Database shipment giải quyết được dữ liệu hàng, nhưng không chứa dữ liệu tàu cần cho tính ổn định. Cần ba nguồn:

| Nguồn | Chứa gì | Lấy từ đâu | Cách đưa vào |
|---|---|---|---|
| Hàng hóa | Shipment/booking: loại hàng, trọng lượng, kích thước, POL/POD, ngày, hàng nguy hiểm | Database shipment | Connector đọc DB, map sang mô hình chuẩn |
| Tàu | Kích thước, hầm hàng, tweendeck, slot, tải trọng sàn, bảng thủy tĩnh, két, lightship, SF/BM | Stability booklet và loading manual của chủ tàu, hoặc dữ liệu từ đăng kiểm | Công cụ "onboarding tàu": nhập bảng từ Excel/CSV, dựng hình hầm hàng |
| Chuyến và cảng | Port rotation, ETA/ETD, giới hạn mớn nước | Database shipment hoặc hệ thống voyage | Cùng connector |

### 4.1 Lớp tích hợp
Viết một connector tách biệt, đọc database shipment và chuyển sang mô hình dữ liệu chuẩn của ứng dụng. Nhờ vậy khi bán cho khách hàng khác, chỉ cần viết thêm connector cho hệ thống của họ (IMOS/Veson, ERP, file Excel, BAPLIE), phần lõi không đổi.

### 4.2 Kiểm tra chất lượng dữ liệu
Hàng break-bulk và project cargo thường thiếu kích thước, trọng tâm, điểm cẩu, hoặc khả năng xếp chồng. Ứng dụng cần một màn hình "hàng thiếu dữ liệu" cho planner bổ sung trước khi xếp, thay vì âm thầm đoán.

### 4.3 Quyền sử dụng dữ liệu
Vì là sản phẩm thương mại, cần làm rõ database shipment thuộc về ai và bạn có quyền dùng để phát triển, kiểm thử sản phẩm hay không. Nên dùng dữ liệu đã ẩn danh cho phát triển, và dữ liệu thật của khách hàng chỉ nằm trong tenant của chính họ.

## 5. Kiến trúc

```
┌───────────────────────────── Frontend (React + R3F) ─────────────────────────────┐
│ Bay plan / Hold plan 2D │ 3D Viewer (tàu, hàng, mặt nước) │ Bảng ổn định │ Timeline  │
│ Thư viện tàu │ Hàng chưa xếp │ Vi phạm │ So sánh phương án │ Design system          │
└──────────────┬───────────────────────────────────────────────────────────────────┘
               │ REST + WebSocket
┌──────────────▼──────────────────────── Backend (FastAPI) ────────────────────────┐
│ auth/tenants   phân quyền, multi-tenant, audit log                                │
│ connectors/    database shipment, BAPLIE, Excel  →  mô hình chuẩn                 │
│ vessels/       thư viện tàu, onboarding (thủy tĩnh, hầm hàng)                     │
│ validation/    rule engine chung: slot rules + space rules (va chạm, tải sàn)     │
│ stability/     draft, trim, list, GM, SF/BM, nghiêng khi cẩu                      │
│ sequence/      trình tự xếp dỡ, trạng thái tàu theo từng bước                     │
│ solver/        ContainerSolver (slot)  +  SpaceSolver (3D packing cho MPP)        │
└──────────────┬───────────────────────────────────────────────────────────────────┘
      PostgreSQL (dữ liệu theo tenant)     Job queue     Object storage (model 3D)
```

## 6. Mô hình dữ liệu (tổng quát hóa cho MPP)
Thay đổi quan trọng nhất so với skeleton: "Container" trở thành một trường hợp của "CargoUnit", và "Slot" trở thành một trường hợp của "StowageSpace".

| Thực thể | Trường chính |
|---|---|
| CargoUnit | id, kind (container / breakbulk / project), kích thước D×R×C, trọng lượng, trọng tâm, xếp chồng được không, tải trọng chồng lên tối đa, điểm cẩu, IMDG, POL, POD, ràng buộc hướng xoay |
| ContainerDetails | ISO 6346, cỡ, loại, HC, reefer (mở rộng của CargoUnit) |
| StowageSpace | id, loại (slot-area / hold / tweendeck / deck), hình khối, tải trọng sàn t/m², chiều cao thông thủy, kích thước miệng hầm |
| SlotGrid | bay/row/tier cho khu vực container (trên tàu container và vùng container của MPP) |
| Placement | CargoUnit → StowageSpace + vị trí (x, y, z) + hướng xoay, hoặc → slot |
| Vessel | kích thước, danh sách StowageSpace, lightship, bảng thủy tĩnh, két, giới hạn SF/BM, cẩu tàu (tải, tầm với) |
| PortCall | UN/LOCODE, thứ tự, ETA, ETD, giới hạn mớn nước |
| LoadingSequence | bước load/discharge, hàng, cẩu, thời điểm |
| StabilityResult | displacement, draft mũi/giữa/lái, trim, list, GM, SF/BM, trạng thái ngưỡng |

## 7. Lộ trình theo phase
Độ lớn công việc: S vài ngày · M 1–2 tuần · L 3 tuần trở lên. Thứ tự là thứ tự ưu tiên.

### Phase 0 — Khám phá: người dùng, dữ liệu, thị trường

| Công việc | Cỡ |
|---|---|
| Phỏng vấn và quan sát 5–8 planner (cả container và MPP) | M |
| Journey map, danh sách điểm đau, xác định 3 luồng công việc quan trọng nhất | S |
| Phân tích database shipment: bảng, trường, chất lượng dữ liệu, mapping sang CargoUnit | M |
| Chọn 2 tàu tham chiếu (1 container, 1 MPP), thu thập stability booklet | M |
| Nghiên cứu cạnh tranh: tính năng, giá, điểm yếu UX | S |
| Chốt data model tổng quát (CargoUnit, StowageSpace) | S |

Hoàn thành khi: có danh sách điểm đau đã xác nhận, mapping dữ liệu shipment, dữ liệu 2 tàu mẫu.

### Phase 1 — Viewer và nền tảng UX

| Công việc | Cỡ | Trạng thái |
|---|---|---|
| App shell, 3D canvas, container bằng InstancedMesh | — | Đã có |
| Refactor skeleton sang CargoUnit / StowageSpace | S | |
| Design system: màu, chữ, component, bố cục chuẩn | M | |
| Thân tàu thật và hầm hàng MPP (tweendeck, miệng hầm) trong 3D | M | |
| Render hàng break-bulk và project cargo (hộp, trụ, model GLTF) | M | |
| Mặt nước và thước mớn nước | S | |
| Bay plan 2D (container) và hold plan 2D (MPP, nhìn từ trên xuống và mặt cắt) | L | |
| Connector đọc database shipment, màn hình hàng chưa xếp và hàng thiếu dữ liệu | M | |
| Kiểm thử khả dụng vòng 1 | S | |

Hoàn thành khi: kéo một chuyến thật từ database shipment và xem trực quan được, planner hiểu màn hình mà không cần hướng dẫn.

### Phase 2 — Xếp tay, rule engine, trạng thái nổi xấp xỉ

| Công việc | Cỡ |
|---|---|
| Kéo thả container vào slot, hoán đổi, chọn hàng loạt | M |
| Đặt hàng MPP tự do: kéo, xoay, bắt dính vào sàn/vách, đo khoảng cách | L |
| Rule engine slot: cỡ, trọng lượng stack, chiều cao, reefer, IMDG, lơ lửng, overstow | M |
| Rule engine không gian: va chạm, tải trọng sàn t/m², chiều cao thông thủy, lọt miệng hầm, xếp chồng | L |
| Tính ổn định xấp xỉ: displacement, draft, trim, list, GM | M |
| Tàu nghiêng, chúi, lún trong 3D, bảng ổn định với cảnh báo ngưỡng | S |
| Undo/redo, lịch sử phiên bản, phím tắt | M |
| Kiểm thử khả dụng vòng 2 | S |

Hoàn thành khi: planner lập được plan hoàn chỉnh bằng tay nhanh hơn công cụ họ đang dùng, và thấy tàu nghiêng ngay khi thả hàng nặng.

### Phase 3 — Auto-stow phiên bản đầu

| Công việc | Cỡ |
|---|---|
| ContainerSolver greedy: cảng cuối xếp trước, nặng dưới, cân bằng | M |
| SpaceSolver heuristic 3D packing (extreme points) cho hàng MPP, có tải sàn và thứ tự dỡ | L |
| Xếp một phần: khóa hàng đã đặt, AI xếp phần còn lại | S |
| Bộ benchmark trên dữ liệu shipment thật, xuất KPI | S |
| UX cho AI: xem trước, giải thích, chấp nhận từng phần | M |
| Kiểm thử khả dụng vòng 3 | S |

Hoàn thành khi: plan tự động không vi phạm ràng buộc cứng, planner tin và dùng làm điểm khởi đầu.

### Phase 4 — Tối ưu hóa và ổn định chính xác

| Công việc | Cỡ |
|---|---|
| Ổn định chính xác từ bảng thủy tĩnh, két, mặt thoáng | M |
| Sức bền dọc SF/BM | M |
| Nghiêng khi cẩu hàng nặng bằng cẩu tàu (heavy-lift), gợi ý counter-ballast | M |
| Loading sequence và phát lại trên timeline | M |
| Gợi ý ballast | M |
| CP-SAT hai tầng cho container | L |
| Tối ưu SpaceSolver (metaheuristic: genetic / simulated annealing) | L |
| So sánh phương án plan cạnh nhau | M |

Hoàn thành khi: plan tối ưu tốt hơn heuristic trên KPI, mọi bước trong trình tự đều trong ngưỡng ổn định.

### Phase 5 — Sẵn sàng thương mại (có thể chạy song song từ phase 2)

| Công việc | Cỡ |
|---|---|
| Multi-tenant, đăng nhập, phân quyền (planner, chief officer, xem) | M |
| Audit log: ai sửa gì, khi nào | S |
| Thư viện tàu theo khách hàng, công cụ onboarding tàu tự phục vụ | L |
| Connector cho hệ thống phổ biến khác (Excel, BAPLIE, IMOS/Veson) | M |
| Báo cáo PDF cho tàu và cảng | S |
| Bảo mật: mã hóa, sao lưu, tách dữ liệu tenant | M |
| Điều khoản sử dụng, giới hạn trách nhiệm (công cụ hỗ trợ, không thay loading computer) | S |
| Mô hình giá (theo tàu/tháng hoặc theo chuyến), trang giới thiệu, bản dùng thử | M |

### Phase 6 — Lớp AI nâng cao (liên tục)
Học từ plan lịch sử để khởi tạo lời giải, trợ lý LLM giải thích và chạy what-if (chỉ gọi solver và validator), lập lại kế hoạch tại mỗi cảng, nghiên cứu deep RL.

### Lộ trình dài hạn
Chứng nhận type approval loading computer với tổ chức đăng kiểm (DNV, ABS, BV...), mở rộng sang tàu hàng rời và ro-ro.

## 8. Tính toán trạng thái nổi (tham chiếu kỹ thuật)

| Đại lượng | Công thức |
|---|---|
| Lượng giãn nước | Δ = lightship + Σ hàng + Σ két + hằng số |
| Trọng tâm | LCG = Σ(w·x)/Δ · TCG = Σ(w·y)/Δ · KG = Σ(w·z)/Δ |
| Mớn nước trung bình | tra bảng thủy tĩnh theo Δ |
| Chiều cao thế vững | GM = KM − KG − FSC |
| Góc nghiêng | tan(list) = TCG / GM |
| Độ chúi | trim = Δ·(LCG − LCB) / (100·MTC) |
| Mớn mũi và lái | từ mớn trung bình, trim và vị trí LCF |
| Nghiêng khi cẩu (MPP) | Khi hàng rời khỏi sàn, trọng tâm hàng coi như nằm ở đầu cần cẩu: G nâng lên w·h/Δ (h = khoảng cách từ trọng tâm hàng đến đầu cần), góc nghiêng tan(θ) = w·d / (Δ·GM mới), với d là tầm với ngang |

Hiển thị 3D: mặt nước cố định, thân tàu dịch theo mớn nước và xoay theo list, trim. Khi phát lại trình tự hoặc mô phỏng cẩu, tàu chuyển động theo từng bước.

## 9. Chỉ số đo lường

| Nhóm | Chỉ số |
|---|---|
| UX | Thời gian lập plan so với công cụ hiện tại, tỷ lệ hoàn thành nhiệm vụ, số lỗi thao tác, thời gian học, điểm SUS |
| Chất lượng plan | Restow, lỗi ràng buộc cứng (mục tiêu 0), ổn định trong suốt trình tự, tận dụng dung tích hầm (MPP) |
| Hiệu năng | 60fps với 20.000 container, cập nhật ổn định dưới 300 ms |
| Kinh doanh | Số khách hàng dùng thử, tỷ lệ chuyển sang trả phí, số tàu đang dùng |

## 10. Hiện trạng
Skeleton đã chạy được cho tàu container: domain model, rule engine 6 rule mẫu, GreedySolver tối thiểu, API cơ bản, 3D viewer với InstancedMesh. Bước đầu tiên của phase 1 là tổng quát hóa sang CargoUnit / StowageSpace để hỗ trợ MPP.

## 11. Rủi ro và giảm thiểu

| Rủi ro | Mức độ | Giảm thiểu |
|---|---|---|
| Thiếu dữ liệu tàu (thủy tĩnh, hầm hàng) | Cao | Công cụ onboarding tàu, bắt đầu với 2 tàu mẫu, bảng giả định khi chưa có |
| Dữ liệu shipment thiếu kích thước, trọng tâm hàng MPP | Cao | Màn hình hàng thiếu dữ liệu, không đoán ngầm |
| Quyền sử dụng database shipment cho sản phẩm thương mại | Cao | Làm rõ chủ sở hữu dữ liệu, dùng dữ liệu ẩn danh khi phát triển |
| Tính ổn định sai dẫn đến quyết định nguy hiểm | Cao | Định vị công cụ hỗ trợ, đối chiếu stability booklet, điều khoản trách nhiệm |
| Hỗ trợ MPP làm phạm vi phình to | Cao | Làm container trước ở mỗi phase, MPP theo sau trên cùng kiến trúc |
| Không tiếp cận được planner để nghiên cứu UX | Trung bình | Tận dụng mạng lưới trong ngành hàng hải, đề nghị dùng thử miễn phí đổi lấy góp ý |
| Đối thủ lớn đã có quan hệ khách hàng | Trung bình | Tập trung UX và phân khúc MPP, bán như công cụ pre-planning bổ sung trước |

## 12. Câu hỏi còn mở

| Câu hỏi | Ảnh hưởng tới |
|---|---|
| Database shipment thuộc hệ thống nào (IMOS, hệ thống riêng, ERP)? Có kích thước và trọng tâm hàng break-bulk không? | Connector, chất lượng dữ liệu |
| Khách hàng đầu tiên là ai: hãng tàu container, chủ tàu MPP, hay đại lý? | Thứ tự làm container hay MPP trước |
| Có tiếp cận được planner để phỏng vấn không? | Toàn bộ track UX |

## 13. Việc làm tiếp theo
1. Xác định cấu trúc database shipment: bảng nào chứa hàng, trường nào có sẵn, thiếu gì cho MPP.
2. Lên danh sách 5–8 planner có thể phỏng vấn và soạn kịch bản phỏng vấn.
3. Chọn 2 tàu tham chiếu và xin stability booklet.
4. Refactor skeleton sang CargoUnit / StowageSpace.
5. Làm wireframe Figma cho 3 luồng công việc quan trọng nhất trước khi code tiếp.
