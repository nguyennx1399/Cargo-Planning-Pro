# Phase 03 — Loading sequence playback: xem tàu nghiêng/nún SỐNG khi xếp hàng

## Context Links
- [plan.md](plan.md) · [phase-01](phase-01-demo-stability-calc.md) (`computeIndicativeStability`) · [phase-02](phase-02-ship-attitude-3d.md) (`useShipAttitude`, `useIndicativeStability`, `VesselScene` đã có ShipGroup)
- Code: `frontend/src/store/usePlanStore.ts`, `frontend/src/features/panels/Sidebar.tsx`, `frontend/src/features/viewer3d/{ContainerInstances,VesselScene}.tsx`, `frontend/src/App.tsx`, `frontend/src/engine/naive-fill-plan.ts`

## Overview
- Priority: hoàn thiện mục đích ("khi xếp hàng" — quá trình, không chỉ 2 trạng thái đầu/cuối) · Size: S–M · Status: complete — code-reviewed (2026-09-11), 2 High perf-hygiene findings both fixed same session (xem "Bug tìm được qua code-reviewer"), typecheck/test(277/277)/build xanh sau sửa. See `reports/code-reviewer-phase-03-loading-sequence-playback.md`, `reports/tester-phase-03-loading-sequence-playback.md`.
- Thêm playback state, driver dùng `useFrame` tăng dần số container hiển thị theo thời gian, cắt `plan.placements` tại `playbackCount` — VÀ nối `playbackCount` vào `useIndicativeStability` (phase 02) để tàu nghiêng/nún SỐNG theo từng container xuất hiện, không chỉ nhảy 2 trạng thái tĩnh.

## Key Insights
- `ContainerInstances.tsx` đã dùng `mesh.count = items.length` (InstancedMesh) — cắt `items` từ MỘT PHẦN `plan.placements` là đủ, không cần render path mới.
- `useFrame` mượt hơn `setInterval`, đồng bộ vòng lặp render — driver PHẢI là con của `<Canvas>` (đặt trong `VesselScene.tsx`).
- `plan.placements` (từ `naive-fill-plan.ts`) đã có thứ tự hợp lệ làm thứ tự xếp: thuật toán fill bottom-up theo từng stack, nên trong MỘT stack cụ thể, tier dưới luôn xuất hiện trước tier trên trong mảng kết quả — không cần thuật toán sắp xếp lại riêng.
- **Đây là điểm khác biệt với bản nháp đầu tiên của phase này**: không chỉ "hiện container dần dần" cho đẹp — mục đích thật là `useIndicativeStability` (phase 02) phải tính lại Δ/KG/TCG/LCG chỉ từ những container ĐANG HIỂN THỊ (không phải toàn bộ `plan.placements`), để tàu nghiêng/nún đúng với TRẠNG THÁI ĐANG XEM, không phải trạng thái cuối cùng.
- `playbackCount: number | null` — `null` nghĩa "hiện toàn bộ ngay" (đúng hành vi hiện tại của nút "Load demo cargo" + phase 02, không phá gì). Chỉ khi bấm Play mới chuyển sang số cụ thể.
- Kéo thanh scrub lúc đang Play phải tự pause (không để driver ghi đè giá trị vừa kéo ở frame sau).
- Đổi `cargoLoaded` (nút Load/Clear cargo) phải reset playback về `null` — nếu không, lần load sau có thể kẹt ở `playbackCount` cũ.

## Requirements
- F1 `engine/playback-slice.ts` (thuần, có test): `visiblePlacements(placements, playbackCount)` — `null` → nguyên mảng; số → cắt `Math.floor()` phần tử đầu.
- F2 `usePlanStore.ts`: thêm `playbackCount: number | null` (default `null`), `playbackPlaying: boolean` (default `false`), `playbackSpeed: number` (default `30`, container/giây), actions `startOrResumePlayback`, `pausePlayback`, `resetPlayback`, `setPlaybackCount`, `setPlaybackSpeed`, `advancePlayback(deltaCount, maxCount)`.
- F3 `features/viewer3d/LoadingSequenceDriver.tsx` (mới): `useFrame`, mỗi frame gọi `advancePlayback(playbackSpeed*delta, totalPlacements)` NẾU `playbackPlaying`. Không render gì.
- F4 `ContainerInstances.tsx`: đọc `playbackCount` (selector), dùng `visiblePlacements(plan.placements, playbackCount)` trước khi filter/map hiện có.
- F5 `lib/use-indicative-stability.ts` (sửa từ phase 02): nhận thêm tham số `playbackCount: number | null`, cắt `plan.placements` bằng `visiblePlacements` TRƯỚC khi tính `cargo: WeightItem[]` — tàu chỉ "nặng" đúng bằng số container đang hiện.
- F6 `VesselScene.tsx`: mount `<LoadingSequenceDriver totalPlacements={plan.placements.length} />` trong `<Canvas>`.
- F7 `Sidebar.tsx`: section "Loading sequence" — nút Play/Pause, Reset, tiến trình "`{shown} / {total}`", thanh trượt tốc độ, thanh scrub.
- F8 `App.tsx`: `onToggleCargo` gọi thêm `resetPlayback()`; truyền `playbackCount` vào `useIndicativeStability`.
- NF: không thêm dependency mới; mỗi file < 200 LOC.

## Architecture
```ts
// engine/playback-slice.ts
export function visiblePlacements<T>(placements: T[], playbackCount: number | null): T[] {
  return playbackCount === null ? placements : placements.slice(0, Math.floor(playbackCount));
}
```
```ts
// usePlanStore.ts — thêm vào ViewState
playbackCount: null, playbackPlaying: false, playbackSpeed: 30,
startOrResumePlayback: () => set((s) => ({ playbackCount: s.playbackCount ?? 0, playbackPlaying: true })),
pausePlayback: () => set({ playbackPlaying: false }),
resetPlayback: () => set({ playbackCount: null, playbackPlaying: false }),
setPlaybackCount: (n) => set({ playbackCount: n, playbackPlaying: false }), // scrub tự pause
setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
advancePlayback: (deltaCount, maxCount) => set((s) => {
  if (s.playbackCount === null) return {};
  const next = Math.min(s.playbackCount + deltaCount, maxCount);
  return { playbackCount: next, playbackPlaying: next < maxCount }; // tự pause khi xong ("cho đến khi hoàn thành")
}),
```
```tsx
// LoadingSequenceDriver.tsx
import { useFrame } from "@react-three/fiber";
import { usePlanStore } from "@/store/usePlanStore";
export function LoadingSequenceDriver({ totalPlacements }: { totalPlacements: number }) {
  const playbackPlaying = usePlanStore((s) => s.playbackPlaying);
  const playbackSpeed = usePlanStore((s) => s.playbackSpeed);
  const advancePlayback = usePlanStore((s) => s.advancePlayback);
  useFrame((_, delta) => { if (playbackPlaying) advancePlayback(playbackSpeed * delta, totalPlacements); });
  return null;
}
```
`use-indicative-stability.ts` (đổi so với phase 02):
```ts
export function useIndicativeStability(vessel: Vessel, plan: StowagePlan, playbackCount: number | null): StabilityResult | null {
  // ...geometry/hydrostatics memo giống phase 02...
  return useMemo(() => {
    if (!geometry || !hydrostatics) return null;
    const byId = new Map(plan.containers.map((c) => [c.id, c]));
    const visible = visiblePlacements(plan.placements, playbackCount);
    const cargo = visible.map((p) => cargoWeightItem(vessel, geometry, byId.get(p.container_id)!, p.slot));
    return computeIndicativeStability(DEMO_LIGHTSHIP, DEMO_CONSTANT, cargo, hydrostatics, geometry.particulars.lbp_m, geometry.particulars.depth_m - 1);
  }, [geometry, hydrostatics, plan.placements, plan.containers, playbackCount, vessel]);
}
```

## Related Code Files
- Create: `frontend/src/engine/playback-slice.ts`, `frontend/src/engine/__tests__/playback-slice.test.ts`, `frontend/src/features/viewer3d/LoadingSequenceDriver.tsx`, `frontend/src/store/__tests__/use-plan-store-playback.test.ts`
- Modify: `frontend/src/store/usePlanStore.ts`, `frontend/src/features/panels/Sidebar.tsx`, `frontend/src/features/viewer3d/{ContainerInstances,VesselScene}.tsx`, `frontend/src/App.tsx`, `frontend/src/lib/use-indicative-stability.ts` (từ phase 02, thêm tham số)
- Delete: none

## Implementation Steps
1. `playback-slice.ts` + test (mảng rỗng, `null`→nguyên mảng, số→cắt đúng, số thập phân→floor, số > length→không lỗi vì `Array.slice` tự clamp).
2. `usePlanStore.ts`: thêm state/actions. Test riêng qua `usePlanStore.getState()` (không cần render React):
   - `startOrResumePlayback()` từ `null` → `{playbackCount:0, playbackPlaying:true}`.
   - `advancePlayback(5,10)` hai lần liên tiếp từ 0 → 5 → 10, lần 2 tự `playbackPlaying=false` (đạt max).
   - `advancePlayback` khi `playbackCount===null` → no-op (phòng hờ driver gọi trước khi Play).
   - `setPlaybackCount(n)` luôn kèm `playbackPlaying=false`.
   - `resetPlayback()` → `{playbackCount:null, playbackPlaying:false}` từ bất kỳ trạng thái nào.
3. `LoadingSequenceDriver.tsx` — wiring nhỏ, không cần test riêng (logic đã test ở bước 2).
4. `ContainerInstances.tsx`: `visiblePlacements` + selector `playbackCount`, thêm vào dependency array `useMemo` hiện có.
5. Sửa `use-indicative-stability.ts` (phase 02) — thêm tham số `playbackCount`, cắt trước khi tính cargo. Test: cùng plan, `playbackCount=0` → Δ ≈ chỉ lightship+constant (tàu "rỗng"); `playbackCount=null` → Δ khớp full plan (bằng kết quả phase 02 test).
6. `VesselScene.tsx`: mount driver; `App.tsx`: đọc `playbackCount` từ store, truyền vào `useIndicativeStability`, gọi `resetPlayback()` trong `onToggleCargo`.
7. `Sidebar.tsx`: section "Loading sequence" (Play/Pause, Reset, tiến trình, speed slider, scrub slider).
8. `npm run typecheck && npm test && npm run build`; `curl localhost:5173` xác nhận vẫn phục vụ.

## Todo List
- [x] `playback-slice.ts` + test
- [x] `usePlanStore.ts` playback state/actions + test qua `getState()`
- [x] `LoadingSequenceDriver.tsx`, mount vào `VesselScene.tsx`
- [x] `ContainerInstances.tsx` dùng `visiblePlacements` + selector
- [x] `use-indicative-stability.ts` nhận `playbackCount` + test Δ tại `playbackCount=0` vs `null` (logic lõi tách thành `stabilityForVisiblePlan` — pure function, test được không cần render React, không có `@testing-library/react` trong repo)
- [x] `Sidebar.tsx` — tạo `LoadingSequencePanel.tsx` riêng (theo đúng pattern `StabilityPanel.tsx`), mount vào Sidebar
- [x] `App.tsx` reset playback khi toggle cargo + truyền `playbackCount`
- [x] typecheck/test/build xanh (277/277, tăng từ 267); dev server vẫn phục vụ (HTTP 200)

## Success Criteria
- Bấm Play từ tàu rỗng → container xuất hiện dần THEO THỜI GIAN THỰC, và `StabilityPanel` (phase 02) cập nhật Δ/draft/list SỐNG theo, không nhảy thẳng tới số cuối.
- Đạt đủ `plan.placements.length` → tự dừng.
- Pause/Resume giữ đúng vị trí đang dừng; Reset → về trạng thái "hiện toàn bộ ngay" (giống `cargoLoaded=true` cũ).
- Không có test hiện có (tính tới cuối phase 02) bị đổi kỳ vọng ngoài phần `use-indicative-stability.ts` CHỦ ĐỘNG sửa (thêm tham số — cập nhật lời gọi ở mọi nơi dùng nó).

## Risk Assessment
| Rủi ro | Giảm thiểu |
|---|---|
| `useFrame` gọi action mỗi frame (~60/giây) gây re-render thừa | Component dùng selector (`ContainerInstances`, `LoadingSequenceDriver`) chỉ re-render khi giá trị đọc thật sự đổi |
| Scrub và auto-play giằng co | `setPlaybackCount` luôn `playbackPlaying=false`; driver check `playbackPlaying` trước khi advance |
| Đổi `cargoLoaded` không reset playback → hiển thị sai lần sau | F8 xử lý trong `onToggleCargo` |
| Quên cập nhật lời gọi `useIndicativeStability` cũ (từ phase 02, chưa có tham số `playbackCount`) sau khi đổi chữ ký hàm | `npm run typecheck` sẽ báo lỗi ngay (thiếu tham số bắt buộc) — không phải rủi ro âm thầm |

## Bug tìm được qua `code-reviewer` (đã sửa)
Không có lỗi đúng/sai (Critical/High correctness) — 2 phát hiện High là perf-hygiene, cả 2 đã sửa vì rẻ và đúng ngay trọng tâm của phase này (mượt khi Play):
1. **H1 — `Sidebar.tsx`/`ContainerInstances.tsx` gọi `usePlanStore()` KHÔNG có selector**, mâu thuẫn trực tiếp với dòng risk-table gốc ở trên ("Component dùng selector... chỉ re-render khi giá trị đọc thật sự đổi" — thực ra không file nào dùng selector, cả hai gọi hook với 0 tham số). Hậu quả: `Sidebar` re-render TOÀN BỘ cây con (Cargo/Color-by/Show/Container/Checks) mỗi lần `advancePlayback` chạy (~60/giây khi đang Play) dù `Sidebar` không hề đọc `playbackCount`. Sửa: cả hai file chuyển sang `useShallow` (từ `zustand/react/shallow`) chỉ lấy đúng field cần dùng.
2. **H2 — `stabilityForVisiblePlan` dựng lại `Map` từ TOÀN BỘ `plan.containers` (~870 container demo) mỗi lần gọi**, dù chỉ cần tra cứu phần đang hiển thị. Hàm này chạy lại mỗi tick playback (nằm trong `useMemo` có `playbackCount` ở dependency). Sửa: tách việc dựng `byId` ra `useMemo` RIÊNG trong `useIndicativeStability`, chỉ phụ thuộc `plan.containers` (không phụ thuộc `playbackCount`) — truyền vào làm tham số cho `stabilityForVisiblePlan` thay vì tự dựng bên trong.
- Không sửa (chấp nhận theo khuyến nghị reviewer, YAGNI): M1 (`computeBoundingSphere()` mỗi tick), M2 (`attitude` prop-drill buộc `Sidebar` re-render dù đã fix H1, do vẫn nhận prop mới mỗi frame — cần tách sâu hơn nếu sau này thấy giật thật), L1/L2 (double-clamp vô hại, không xung đột).

## Security Considerations
N/A — thuần client-side.

## Next Steps
- Animation di chuyển container (rơi vào slot thay vì hiện ngay) — stretch goal riêng, không nằm trong plan này.
- Thứ tự xếp "giống nghiệp vụ thật" hơn (không chỉ thứ tự thuật toán fill) — việc của `naive-fill-plan.ts`/solver thật (P1-demo phase 2/3), không phải phase này.
