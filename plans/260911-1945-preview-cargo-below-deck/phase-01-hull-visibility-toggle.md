# Phase 01 — Hull visibility toggle

## Context Links
- [plan.md](plan.md)
- Code: `frontend/src/store/usePlanStore.ts` (state pattern to follow: `showOnDeck`/`showUnderDeck`), `frontend/src/features/panels/Sidebar.tsx` ("Show" section, line ~67-78), `frontend/src/features/viewer3d/Hull.tsx` (both `LoftedHull` and `SimpleBoxHull`)

## Overview
- Priority: low-effort, user-requested · Size: S · Status: Complete
- Add a `showHull` boolean to the view store, a checkbox in the Sidebar next to the existing deck-level toggles, and conditional rendering in `Hull.tsx` so unchecking it hides the hull + all deck fittings/components, leaving only cargo and the water reference plane visible.

## Key Insights
- The exact toggle pattern already exists twice (`showOnDeck`, `showUnderDeck`) — this is a third instance of the same pattern, not a new one. Follow it exactly for consistency (boolean field + `toggleX` action + checkbox `onChange={s.toggleX}`).
- `Hull.tsx` has TWO render paths (`LoftedHull` for vessels with `geometry_id`, `SimpleBoxHull` fallback for those without). Both must respect the toggle — don't special-case one.
- The water reference plane (`WaterlineReference`) should stay visible even with the hull hidden — it's a thin, already-transparent spatial reference (draft line), not part of "the hull blocking cargo," and removing it would make the scene harder to orient in, not easier.
- `Hull` is currently a **component that receives only `vessel`**, not plan/store-derived props — it already calls `usePlanStore` indirectly? No — checked: it does NOT currently import `usePlanStore` at all (unlike `ContainerInstances.tsx`, which does). This phase adds that import to `Hull.tsx` (and both its sub-components), which is a genuinely new dependency edge worth naming explicitly, not just an incidental line.
- No mesh rebuild needed: hiding is `hullVisible ? <mesh/.../> : null`, not remounting — the (potentially expensive) `useMemo`'d `buildHullLoftMesh`/`buildStaticComponentMeshes` calls stay cached exactly as before, only conditionally rendered. Toggling must not trigger a geometry rebuild (verify via the existing `useMemo` dependency arrays being untouched by this change).

## Requirements
- F1 `usePlanStore`: add `showHull: boolean` (default `true`) and `toggleHull: () => void`, matching the existing `showOnDeck`/`toggleOnDeck` pattern exactly.
- F2 `Sidebar.tsx`: add a third checkbox in the "Show" section: `<label className="check"><input type="checkbox" checked={s.showHull} onChange={s.toggleHull} /> Hull</label>`.
- F3 `Hull.tsx`: both `LoftedHull` and `SimpleBoxHull` read `showHull` from the store and skip rendering the hull mesh + component meshes (but NOT `WaterlineReference`) when it's `false`.
- NF: no new dependency; no change to any `useMemo` dependency array (mesh-build caching must survive toggling); file stays under 200 LOC (`Hull.tsx` is at 123 today, this adds ~10-15 lines).

## Architecture
```tsx
// usePlanStore.ts — additive, same shape as showOnDeck/toggleOnDeck
showHull: boolean;
toggleHull: () => void;
...
showHull: true,
toggleHull: () => set((s) => ({ showHull: !s.showHull })),

// Hull.tsx — both LoftedHull and SimpleBoxHull gain:
const showHull = usePlanStore((s) => s.showHull);
// ...inside the returned <group>:
{showHull && (
  <>
    <mesh geometry={hullGeometry} material={hullMaterial} raycast={() => null} />
    {Object.entries(componentGeometries).map(...)}
  </>
)}
<WaterlineReference vessel={vessel} />  {/* always rendered, outside the showHull check */}
```
Use the selector form `usePlanStore((s) => s.showHull)` (not the whole-store destructure `Sidebar.tsx` uses) — `Hull.tsx` re-renders on every store change otherwise, and `ContainerInstances.tsx` already sets the precedent of selector usage for a component inside the 3D scene (`usePlanStore()` without a selector on every render is exactly the anti-pattern P1-demo phase-04's own Key Insights called out for `ContainerInstances.tsx` at the time — don't reintroduce it here).

## Related Code Files
- Modify: `frontend/src/store/usePlanStore.ts`, `frontend/src/features/panels/Sidebar.tsx`, `frontend/src/features/viewer3d/Hull.tsx`
- Create: none
- Delete: none

## Implementation Steps
1. `usePlanStore.ts`: add `showHull`/`toggleHull` exactly mirroring `showOnDeck`/`toggleOnDeck`.
2. `Sidebar.tsx`: add the checkbox. Decide placement — before or after the two deck checkboxes; put it first (`Hull`, then `On deck`, then `Under deck`) since hiding the hull is the "big" toggle a user reaches for first when they say "let me see inside."
3. `Hull.tsx`: add `const showHull = usePlanStore((s) => s.showHull);` inside both `LoftedHull` and `SimpleBoxHull`; wrap the hull mesh + (for `LoftedHull`) the component-groups `.map(...)` in a `{showHull && (...)}` block; leave `WaterlineReference` unconditional in both.
4. `npm run typecheck && npm test && npm run build`.
5. Since the dev server is already running (per this session's earlier work), confirm via `curl localhost:5173` that it still serves 200 after the change (no visual/browser verification tool available this session — same limitation noted throughout the vessel-3d-model-pipeline plan's later phases).

## Todo List
- [x] `showHull`/`toggleHull` in the store
- [x] Sidebar checkbox
- [x] `Hull.tsx` conditional render (both paths), `WaterlineReference` stays unconditional
- [x] typecheck/test/build green; dev server still responds

## Success Criteria
- All 4 items in Todo List done and verified.
- No existing test's assertions change (this is purely additive UI state — nothing in the current 234-test suite renders `Hull.tsx` or exercises `usePlanStore`, so no existing test should need updating; if one does, that's a signal this change touched something wider than intended).

## Risk Assessment
| Risk | Mitigation |
|---|---|
| Forgetting one of the two `Hull.tsx` render paths (`SimpleBoxHull` is easy to overlook since `LoftedHull` is what actually renders for the demo vessel today) | Explicitly listed both in Requirements/Architecture; step 3 names both by name |
| Using the whole-store destructure (`usePlanStore()`) instead of a selector, causing unnecessary re-renders of the (potentially expensive) hull mesh tree on every hover/selection change elsewhere in the store | Architecture section calls out the selector form explicitly, with the `ContainerInstances.tsx` precedent |
| Toggling accidentally triggers a `useMemo` rebuild of the hull/component geometry (expensive: mesh construction, not just visibility) | Explicitly checked in Key Insights + Implementation Steps: dependency arrays for `hullGeometry`/`componentGeometries`/`hullMaterial` must stay untouched; only the JSX wrapping changes |

## Security Considerations
N/A — client-side visibility toggle, no new data flow.

## Next Steps
- If a binary hull toggle proves too blunt in practice (user wants to keep seeing masts/funnel for orientation while hiding just the hatch covers), revisit the "split hatch-covers into their own material group" idea noted in `plan.md`'s Explicitly Out of Scope section.
