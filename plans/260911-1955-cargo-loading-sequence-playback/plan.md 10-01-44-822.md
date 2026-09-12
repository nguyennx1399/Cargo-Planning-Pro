# Ship Attitude While Loading — nghiêng (list) và nún (sinkage) so với mặt nước

- **Liên quan:** [P1 frontend demo](../260911-0945-p1-frontend-stowage-demo/plan.md) phase-06 (bản gốc đã đặc tả gần hết công thức/ngưỡng — plan này CHUYỂN THỂ, không copy nguyên: dùng bảng thủy tĩnh THẬT thay vì bảng gõ tay); [vessel-3d-model-pipeline phase-06](../260911-1409-vessel-3d-model-pipeline/phase-06-hydrostatics-from-offsets-booklet-check.md) (`computeHydrostaticTable`, `engine/hull/hydrostatic-table-calculator.ts` — nguồn số liệu thủy tĩnh cho plan này); [preview-cargo-below-deck](../260911-1945-preview-cargo-below-deck/plan.md) (cùng nhóm file `usePlanStore.ts`/`Sidebar.tsx`/viewer3d, đã Complete)
- **Status:** COMPLETE — all 3 phases implemented, tested (277/277 pass), code-reviewed, real bugs found+fixed (see phase files). **Lưu ý quan trọng:** sau khi "complete", người dùng báo white screen — nguyên nhân là 1 bug r3f hook-rule (`useShipAttitude` gọi ngoài `<Canvas>`) có từ phase 02, không subagent nào bắt được vì mọi vòng test trước giờ chỉ dùng `curl`/`npm test`/`npm run build`, KHÔNG render app thật. Đã sửa + xác nhận bằng headless Chrome thật (CDP), xem chi tiết ở [phase-02](phase-02-ship-attitude-3d.md#bug-nghiêm-trọng-tìm-được-sau-khi-đã-complete--white-screen-người-dùng-báo-cáo-không-phải-subagent).
- **Size:** M (3 phase)

## Mục đích thật (người dùng làm rõ)
Nhìn thấy **độ nghiêng (list) và độ nún (sinkage/draft)** của tàu so với mặt nước khi xếp hàng — không chỉ là hiệu ứng container xuất hiện dần (đó chỉ là CƠ CHẾ, không phải MỤC ĐÍCH). Tàu phải thật sự **nún xuống và nghiêng** trong 3D khi hàng được xếp lên, phản ánh vật lý ổn định (dù là số liệu DEMO, không phải bảng thủy tĩnh đã đăng kiểm).

## Phát hiện quan trọng khi viết lại plan
P1-demo phase-06 (viết trước khi có code thật) dự tính gõ tay một bảng thủy tĩnh giả định (`demo-hydrostatics.ts`, Δ/T/KM/LCB/LCF/MTC/TPC theo 6 mớn nước). Nhưng phiên làm việc trước đã xây THẬT `computeHydrostaticTable()` (`vessel-3d-model-pipeline` phase 06) — tính đúng các đại lượng này từ hull đã loft (`demo-horizon-geometry.ts`). **Dùng bảng THẬT này thay vì gõ tay** — chính xác hơn (khớp đúng hình dạng vỏ tàu demo, không phải số bịa), và tận dụng lại việc đã làm thay vì trùng lặp (DRY). Đã kiểm tra nhanh: tàu demo (LBP160/B27.4/T9.8/Cb0.68) cho Δ≈29,945t tại mớn thiết kế — quy mô hợp lý để tính lightship/hằng số phù hợp (xem phase 01).

## 3 mức độ chính xác (nhắc lại, không lặp lại toàn bộ chi tiết)
Giống `vessel-3d-model-pipeline` G3: bảng thủy tĩnh `computed` từ offsets **KHÔNG BAO GIỜ thay thế** stability booklet đã đăng kiểm (RT-2, IACS UR L5). Toàn bộ tính năng này là **DEMO DATA**, banner cố định trong UI, chỉ minh hoạ trực quan — không dùng cho vận hành thật.

## Phases
| # | Phase | Phụ thuộc | Status |
|---|---|---|---|
| 01 | [Stability calc engine (thuần, có test)](phase-01-demo-stability-calc.md) | — | ✓ Complete (252→260 tests) |
| 02 | [ShipGroup 3D — nghiêng/nún thật, mặt nước cố định](phase-02-ship-attitude-3d.md) | 01 | ✓ Complete (260→267 tests) |
| 03 | [Loading sequence playback — xem tiến trình sống động](phase-03-loading-sequence-playback.md) | 02 | ✓ Complete (267→277 tests, code-reviewed) |

Phase 01+02 ĐÃ đủ để thấy "trước/sau" (tàu rỗng vs tàu đầy, qua nút Load/Clear cargo có sẵn) nghiêng/nún đúng — đây là phần CỐT LÕI. Phase 03 biến nó thành "xem trực tiếp" (container xuất hiện dần, tàu nghiêng/nún dần theo, dừng khi xếp xong).

## Ngoài phạm vi (YAGNI)
- GZ curve / đường cong ổn định động (IS Code 2008) — ngoài phạm vi demo, cần booklet thật (roadmap phase 4).
- Free surface correction (FSC) — bỏ qua như P1-demo phase-06 gốc đã quyết định, ghi rõ trong tooltip UI.
- Trạng thái tàu nghiêng LỚN (>10°) — công thức nhỏ góc (small-angle) không còn đúng, chỉ báo "beyond small-angle model", không cố tính tiếp.
- Mô phỏng cẩu xếp hàng / heavy-lift ảnh hưởng ổn định tức thời — roadmap P2/P4.

## Success criteria (tổng)
- Xếp tàu từ rỗng → đầy (hoặc ngược lại) → mớn nước trung bình tăng/giảm đúng chiều, tàu nghiêng đúng hướng (hàng nặng lệch mạn nào, tàu nghiêng về mạn đó).
- GM ≤ 0.15m → trạng thái "unstable", KHÔNG hiện góc nghiêng (an toàn hơn là hiện số sai).
- Δ ngoài khoảng bảng thủy tĩnh đã tính → báo lỗi rõ ràng, không suy diễn ngầm.
- Banner "DEMO DATA — not for operational use" luôn hiện khi panel ổn định đang mở.
- `npm run typecheck`, `npm run build`, `npm test` xanh ở mọi phase; không có test cũ (234 bài, tính tới lúc viết plan này) bị đổi kỳ vọng ngoài ý muốn.
