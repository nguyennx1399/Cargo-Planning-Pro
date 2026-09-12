# Phase 04 — 3D viewer: 20'/40' meshes, click-to-move, ship group

## Context links
- Plan: [plan.md](plan.md) · Depends on [phase-02](phase-02-plan-draft-store-history-auto-stow.md)
- Current: `src/features/viewer3d/{VesselScene,ContainerInstances,Hull}.tsx`, `src/lib/geometry.ts`

## Overview
- **Priority:** P1 · **Size:** M · **Status:** Pending
- Render mixed sizes correctly, let the planner place a picked box by clicking a 3D slot, and restructure the scene so Phase 06 can heel and trim the ship.

## Key insights
- Today one InstancedMesh scales every box to 40' (`ContainerInstances.tsx:61`). The fix is two InstancedMeshes (20', 40'), each with its own `items` → instanceId map.
- `usePlanStore()` without selectors re-renders on every hover (`ContainerInstances.tsx:26`). Use selectors / `useShallow`.
- **Ship group:** put the hull + containers + target slots in one `<group>` whose local origin is the deck at midship. Water is a separate, fixed plane. Phase 06 then only sets the group transform.

## Requirements
**Functional**
- `geometry.ts`:
  - `slotToPosition` handles odd bays: fore 20' = parent center + (len40 − len20)/2; aft = parent center − (len40 − len20)/2 (bow is +x).
  - Add `KEEL_DEPTH = 14` m and `vcgFromKeel(slot, hc)` (used by Phase 06).
  - Under-deck rows use the under-deck row list, centred.
- `ContainerInstances`: two meshes; 40' scale `DIM.len40`, 20' scale `DIM.len20`; HC height. Colors and hover/select work in both.
- `TargetSlots` (only while `pickedId` is set): an instanced translucent box per empty cell of the right size. Green or red tint from the same allowed check as Phase 03 (cheap predicates only; the full preview stays 2D). Click → `move`/`load`.
- **Selection sync:** clicking in 3D sets `selectedId` and switches `bayFilter` to that bay, so the 2D view follows.
- Camera "focus bay" button: tweens the OrbitControls target to the selected bay.
- Hull resized to the vessel (LOA 172, beam 27.4, depth `KEEL_DEPTH`). The real hull shape comes from [vessel 3D model pipeline](../260911-1409-vessel-3d-model-pipeline/plan.md) phase 02 (parametric hull generator). Until then, keep the box resized to the vessel. Accommodation etc. come from its phase 03.
- Permanent HTML overlay in the corner: "DEMO DATA — indicative, not for operational use" (RT-2).

**Non-functional**
- ≥ 55 fps orbiting with ~800 boxes on the reference laptop.
- Matrices are recomputed only when placements or filters change; colors only when mode/hover/selection changes.

## Architecture
```
<Canvas>
  <Water/>                         fixed, y = 0 plane (Phase 06 positions the ship against it)
  <ShipGroup>                      transform set by Phase 06 (list, trim, sinkage); identity for now
     <Hull/> <ContainerInstances/> <TargetSlots/>
  </ShipGroup>
  <OrbitControls/> <GizmoHelper/>
</Canvas>
<DemoDataBadge/>                   HTML overlay
```

## Related code files
- **Create:** `src/features/viewer3d/ShipGroup.tsx`, `TargetSlots.tsx`, `Water.tsx`, `DemoDataBadge.tsx`, `src/lib/geometry.test.ts` (or under `__tests__`).
- **Modify:** `VesselScene.tsx`, `ContainerInstances.tsx` (split per size; extract `useContainerInstanceItems.ts` if >200 LOC), `Hull.tsx`, `lib/geometry.ts`.
- **File ownership:** `features/viewer3d/**`, `lib/geometry.ts`.

## Implementation steps
1. Geometry: 20' offsets, keel depth, under-deck rows, and tests (bay 01 center > bay 02 center > bay 03 center on x).
2. Split the meshes and adopt selectors.
3. Restructure the scene into ShipGroup + Water; resize the hull.
4. TargetSlots + click-to-move wired to the store actions and toasts.
5. Selection → bay sync and the focus-bay tween.
6. Add the DemoDataBadge overlay.
7. Quick fps check with drei `<Stats/>` (dev only).

## Todo
- [ ] geometry 20' + keel + tests
- [ ] 20'/40' instanced meshes + selectors
- [ ] ShipGroup / Water / hull resize
- [ ] TargetSlots click-to-move
- [ ] selection ↔ bay sync, focus tween
- [ ] demo badge
- [ ] fps check

## Success criteria
- 20' boxes sit in the fore/aft halves with no overlap.
- A picked box can be placed from 3D.
- 2D and 3D selection always agree.
- The fps target is met.

## Risks
- Raycasting two meshes plus target slots → call `stopPropagation` on the nearest hit only; disable raycasting on the hull and water (`raycast={() => null}`).
- The transparent hull hurts depth sorting → `depthWrite={false}` (already used) and render order hull < boxes.

## Security
N/A.

## Next
Phase 06 drives the ShipGroup transform.
