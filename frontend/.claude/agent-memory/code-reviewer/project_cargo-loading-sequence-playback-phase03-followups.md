---
name: cargo-loading-sequence-playback-phase03-followups
description: Phase-03 (playback controls) review of plans/260911-1955-cargo-loading-sequence-playback — no correctness bugs, 2 High perf-hygiene findings around zustand no-selector re-renders and redundant Map rebuilds during 60Hz playback
metadata:
  type: project
---

Phase-03 review (2026-09-11) of `plans/260911-1955-cargo-loading-sequence-playback/phase-03-loading-sequence-playback.md` (Play/Pause/Reset/scrub for the loading-sequence playback). No Critical/High correctness bugs — store actions and `visiblePlacements` are verbatim matches of the plan's own pseudocode, `stabilityForVisiblePlan` extraction is faithful, InstancedMesh capacity(=total)/count(=visible) split is correct by design. Full report: `plans/260911-1955-cargo-loading-sequence-playback/reports/code-reviewer-phase-03-loading-sequence-playback.md`.

**Finding 1 (High, perf-only) — `Sidebar.tsx` and `ContainerInstances.tsx` both call `usePlanStore()` with zero args (no selector).**
Confirmed via `node_modules/zustand/esm/react.mjs`: no-arg call defaults to `identity` selector, and since `set()` always returns a new state object, `useSyncExternalStore` re-renders on EVERY store mutation. During playback, `advancePlayback` fires ~60/sec, so both components re-render ~60/sec — `Sidebar` even though it never reads `playbackCount` at all (drags the whole Cargo/Color-by/Show/Container/Checks subtree along for nothing). This directly contradicts the plan's own Risk Assessment table claim that these components "dùng selector" (use a selector) — they don't, it's a whole-store destructure, a pre-existing pattern that phase-03's 60Hz driver turns from rare-and-harmless into continuous-and-wasteful.
**Why:** zustand's no-selector `useStore()` call subscribes to the whole state object by reference; any project code using this pattern will re-render on unrelated state changes. Not unique to this feature — general zustand usage gotcha.
**How to apply:** when reviewing any future zustand-store-driven perf work in this repo (viewer3d components especially, since `VesselScene`'s subtree re-renders every animation frame by design during playback/attitude updates), grep for `usePlanStore()` with no selector arg first — it's an easy, high-signal smell to check.

**Finding 2 (High, perf-only) — `stabilityForVisiblePlan` (lib/use-indicative-stability.ts) rebuilds a `Map` over ALL `plan.containers` (~870 in the demo, `forties=470`/`twenties=400` in `demo-cargo-generator.ts`) on every call, not just the visible slice.**
Runs inside the outer `useMemo` whose deps include `playbackCount` — so this ~870-entry Map rebuild happens every playback tick (~60/sec) regardless of how many containers are actually visible yet. `ContainerInstances.tsx` already does the equivalent correctly (memoized separately on `[plan.containers]`, bails every frame) — `stabilityForVisiblePlan` should do the same (hoist `byId` construction out, pass in as a param).
**Why:** the function was extracted as a standalone pure function for testability (no `@testing-library/react` in this repo), which is good, but the extraction didn't preserve the memoization boundary that existed implicitly when this logic was inline in the hook.
**How to apply:** when reviewing pure-function extractions from React hooks in this codebase generally, check whether any O(large-N) work inside the extracted function was previously covered by an outer `useMemo` with a narrower dep array — extraction can silently lose that memoization.

Neither finding blocks merge; both are flagged as Recommended Actions, not required fixes, given [[project_cargo-loading-sequence-playback-phase01-followups]]'s user context (frontend-only demo, "no fake data/mocks" but pragmatic perf standard per `development-rules.md`: "Don't be too harsh on code linting... Prioritize functionality and readability over strict style enforcement").
