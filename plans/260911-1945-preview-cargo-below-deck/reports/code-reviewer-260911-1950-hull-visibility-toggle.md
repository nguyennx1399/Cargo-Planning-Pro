# Code Review: Hull Visibility Toggle

## Scope
- Files: `store/usePlanStore.ts`, `features/panels/Sidebar.tsx`, `features/viewer3d/Hull.tsx`
- LOC: 39 / 129 / 133 (all well under 200 limit)
- Focus: full diff review, small feature (~20 lines)
- `npm run typecheck`: clean, no errors

## Overall Assessment
Clean, correct, matches plan exactly. Ship as-is.

## Critical Issues
None.

## High Priority
None.

## Medium Priority
None.

## Low Priority
None.

## Findings by review question

1. **Store pattern mirror** — `showHull`/`toggleHull` (usePlanStore.ts:7,14,26,33) is byte-for-byte the same shape as `showOnDeck`/`toggleOnDeck`: same default `true`, same `set((s) => ({ showX: !s.showX }))` updater style, same field ordering conventions. No divergence.

2. **JSX scoping in Hull.tsx** — In both `LoftedHull` (lines 72-81) and `SimpleBoxHull` (lines 95-118), the `{showHull && (<>...</>)}` block wraps exactly the hull mesh + component groups; `WaterlineReference` sits outside the block in both, unconditional as required. No React key/fragment issue: the fragment itself needs no `key` (it's not part of an array), and the `.map` inside `LoftedHull` already keys each generated `<mesh key={group}>` correctly. Toggling `showHull` unmounts/remounts only the meshes inside the fragment — the `useMemo`'d `hullGeometry`/`hullMaterial`/`componentGeometries` stay cached since their dependency arrays are untouched, so no rebuild cost on toggle (confirmed by reading the `useMemo` blocks directly, matches the plan's stated risk mitigation).

3. **Zustand selector usage** — `usePlanStore((s) => s.showHull)` in both sub-components (Hull.tsx:48, 88) is correct atomic-selector usage. No stale closure risk (Zustand subscribes per-selector and re-renders on shallow-compared value change; `boolean` needs no custom equality). This correctly avoids the whole-store destructure anti-pattern that `Sidebar.tsx` uses (acceptable there since Sidebar is a plain DOM tree, not inside the R3F scene graph — no wasted mesh-tree re-renders).

4. **File size** — `Hull.tsx` at 133 LOC (up from 123 baseline noted in the plan), comfortably under 200.

5. **YAGNI/KISS/dead code/naming** — None found. No new abstractions, no unused state, naming (`showHull`/`toggleHull`) consistent with existing `showOnDeck`/`showUnderDeck`/`toggleOnDeck`/`toggleUnderDeck`. Checkbox placement in Sidebar.tsx:69 matches plan's stated ordering (Hull, then On deck, Under deck).

## Edge Cases Found by Scout
None applicable — this is additive UI state with no data flow, no async, no shared mutation. Toggling has no interaction with `bayFilter`, `hoveredId`/`selectedId`, or any container-instance logic; `ContainerInstances.tsx` (not in the diff) is unaffected since it doesn't read `showHull`.

## Positive Observations
- Exactly matches phase-01 plan's Architecture section, down to variable names and comment placement.
- Both hull render paths (`LoftedHull` and `SimpleBoxHull`) covered — the plan's called-out risk of forgetting `SimpleBoxHull` did not happen.
- Correct selector discipline inside the R3F scene graph, avoiding the whole-store re-render anti-pattern the plan explicitly warned about.

## Recommended Actions
None required.

## Metrics
- Type Coverage: typecheck clean (0 errors)
- Test Coverage: not re-run (tester agent covering in parallel, per task instructions)
- Linting Issues: none observed

## Unresolved Questions
None.
