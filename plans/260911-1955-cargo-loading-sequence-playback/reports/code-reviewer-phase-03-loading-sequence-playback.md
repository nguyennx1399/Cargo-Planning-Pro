# Code Review — Phase 03: Loading Sequence Playback

## Scope
- Files: `engine/playback-slice.ts` (+test), `store/usePlanStore.ts` (+test), `features/viewer3d/LoadingSequenceDriver.tsx`, `features/viewer3d/ContainerInstances.tsx`, `features/viewer3d/VesselScene.tsx`, `lib/use-indicative-stability.ts` (+test), `features/panels/LoadingSequencePanel.tsx`, `features/panels/Sidebar.tsx`, `App.tsx`, `data/vessel-geometry-catalog.ts`
- LOC: all reviewed files 8–112 lines, well under 200-LOC convention
- `npm run typecheck`: clean (0 errors). `npm test -- --run`: 277/277 pass (39 files), incl. new `playback-slice.test.ts` (6), `use-plan-store-playback.test.ts` (7), and playback cases added to `use-indicative-stability.test.ts` (3)
- Focus: perf during Play (60Hz store churn), store-action correctness vs plan pseudocode, ContainerInstances/InstancedMesh capacity-vs-count, stability-hook extraction, edge cases

## Overall Assessment
Solid, faithful implementation of the spec — store actions and `visiblePlacements` are byte-for-byte matches of the plan's pseudocode, `stabilityForVisiblePlan` is a clean pure extraction with correct dep-array wiring, and the InstancedMesh capacity/count split is intentional and correct (no stale-matrix risk). The one prior cross-phase bug (phase-01 `draft_fwd/aft` LCF formula) is now confirmed fixed. The main gap is perf hygiene: two places do O(everything) work on every 60Hz playback tick that only need O(visible-delta) or O(rare-change) work. Neither is a correctness bug, both are concrete and fixable.

## Critical Issues
None.

## High Priority

**H1 — `Sidebar.tsx` re-renders ~60×/sec during Play despite never reading `playbackCount`.**
`Sidebar.tsx:25` calls `const s = usePlanStore();` with no selector. Zustand's `useStore(api, selector = identity)` (confirmed in `node_modules/zustand/esm/react.mjs`) means this subscribes via `useSyncExternalStore` to `api.getState()` as a whole object; since `set()` always returns a new object, `Object.is` never matches and Sidebar re-renders on **every** store mutation — including all ~60/sec `advancePlayback` calls while playing — even though Sidebar itself never destructures `playbackCount`. This forces the entire Sidebar subtree (Cargo section, Color-by legend list, Show/bay-filter section, Container-info section, Checks/violations list up to 50 `<li>`s) to reconcile every animation frame, none of which changed. `ContainerInstances.tsx:27-28` has the same no-selector pattern, but there it's less wasteful since it legitimately needs `playbackCount` every tick anyway.
This directly contradicts the plan's own risk-table mitigation claim (phase-03.md Risk Assessment row 1: "Component dùng selector... chỉ re-render khi giá trị đọc thật sự đổi") — neither file actually uses a selector; both call the hook with zero arguments.
Note: `Sidebar` also receives a fresh `attitude` object as a prop every frame from `App.tsx` (necessary, `StabilityPanel` needs it live), so some re-render is unavoidable by design even after fixing this — but fixing H1 still removes the redundant full-store-subscription trigger and is a straightforward, low-risk change.
Fix: replace `usePlanStore()` in both files with per-field selectors (or `useShallow` from `zustand/react/shallow` for the object-shaped destructure) so each component only re-renders when a field it actually reads changes.

**H2 — `stabilityForVisiblePlan` rebuilds a `Map` over ALL `plan.containers` on every call, not just the visible slice.**
`lib/use-indicative-stability.ts:28`: `const byId = new Map(plan.containers.map((c) => [c.id, c]));` runs inside the pure function, invoked every time the outer `useMemo` fires — which is every playback tick since `playbackCount` is in its dep array (line 49). Demo cargo is 470 forty-footers + 400 twenty-footers (`demo-cargo-generator.ts:64`, default `forties=470, twenties=400`) = 870 containers, so this Map is rebuilt from 870 entries on every frame **regardless of how many containers are currently visible** — even at `playbackCount=1`, right after pressing Play. `ContainerInstances.tsx:30` already does the equivalent correctly, memoized separately on `[plan.containers]` only (bails every frame). `stabilityForVisiblePlan` has no such memoization since it's a plain pure function re-invoked wholesale each time.
Impact: ~870 Map insertions × 60/sec ≈ 52k wasted ops/sec at minimum, on top of the legitimately-needed O(visible) `cargoWeightItem` conversions. Not currently causing dropped frames (arithmetic is trivial, V8 handles this fine at this scale) but is pure waste and will get worse if the demo cargo count grows.
Fix: hoist `byId` construction out of `stabilityForVisiblePlan` into `useIndicativeStability`'s own separate `useMemo(() => new Map(plan.containers.map(c => [c.id, c])), [plan.containers])`, pass it in as a parameter. Keep `stabilityForVisiblePlan`'s test coverage — the function can still accept a pre-built map without losing purity/testability.

## Medium Priority

**M1 — `mesh.computeBoundingSphere()` runs unconditionally every playback tick, O(visible count) extra cost on top of necessary matrix writes.**
`ContainerInstances.tsx:68` calls this inside the matrices `useLayoutEffect`, which fires every time `items` changes — every frame during Play, since `items.length` grows each tick. `computeBoundingSphere()` on an `InstancedMesh` iterates all `count` instance transforms. At the tail end of playback (~470 40' containers visible, matching `forties=470`), that's another ~470 matrix ops × 60/sec ≈ 28k/sec, purely for bounding-sphere upkeep (used for raycasting/frustum culling), stacked on top of the already-necessary `setMatrixAt` loop. Not a correctness bug; worth throttling (e.g., recompute only every N frames, or compute once from the known hull bounding box) if profiling shows it matters at current container counts — flagging as a known cost, not demanding an immediate fix.

**M2 — Root cause of H1's severity: `attitude` is prop-drilled through all of `Sidebar`, not scoped to `StabilityPanel`.**
`App.tsx` computes `attitude` once and passes it to both `VesselScene` and `Sidebar`. Since `attitude` is a new object every playback frame (required — it must reflect current visible cargo), `Sidebar` cannot avoid re-rendering every frame purely from a props standpoint, independent of H1's whole-store subscription. Fixing H1 alone won't eliminate all wasted reconciliation of non-playback sections (Cargo/Color-by/Show/Container/Checks). A cleaner (but heavier) fix would move `attitude` consumption fully inside `StabilityPanel` via its own store/context read, decoupling it from `Sidebar`'s render — likely not worth doing yet at current app scale (YAGNI), noting for future if Sidebar grows more sections or container counts grow substantially.

## Low Priority

**L1 — `setPlaybackCount` has no defensive clamping**, unlike `advancePlayback`'s `Math.min(..., maxCount)`. Currently harmless: the only caller is the range `<input>` with `min={0} max={total}`, and both `visiblePlacements` (via `Array.slice`) and `LoadingSequencePanel`'s `shown` display (`Math.min(Math.floor(playbackCount), total)`) self-clamp downstream regardless. Worth a one-line `Math.max(0, Math.min(n, total))` inside the action itself for defense-in-depth if `setPlaybackCount` ever gets a second caller, but not urgent.

**L2 — Redundant (not conflicting) double-clamping**: `advancePlayback`'s `Math.min` and `visiblePlacements`'s `Array.slice` natural clamp both guard against overshoot independently. Confirmed they agree in all tested cases (`playback-slice.test.ts`, `use-plan-store-playback.test.ts`) — not a bug, just noting the redundancy exists by design, not oversight.

## Positive Observations
- `usePlanStore.ts` actions (`advancePlayback`, `startOrResumePlayback`, `resetPlayback`, `setPlaybackCount`) are verbatim matches of the phase file's Architecture pseudocode; auto-pause-at-max correctly uses `Math.min` so a slow frame at high `playbackSpeed` cannot overshoot `maxCount` in one jump — confirmed both by code read and by the test `"advancePlayback moves toward maxCount and auto-pauses on reaching it"`.
- `visiblePlacements` is pure, minimal, and fully tested (null passthrough, integer slice, fractional floor, over-length clamp, empty array) — exactly matches spec F1.
- `stabilityForVisiblePlan` extraction is faithful and side-effect-free; the outer `useMemo`'s dep array (`[geometry, hydrostatics, plan.placements, plan.containers, playbackCount, vessel]`) is an exact match of the phase file's pseudocode line, and correctly includes `playbackCount`.
- Phase-02's flagged risk ("computeHydrostaticTable tính lại mỗi lần plan đổi") stays mitigated under the new 60Hz `playbackCount` churn: the `hydrostatics` useMemo depends on `[geometry]` only (not `playbackCount`), and `getVesselGeometry` (touched this session, `data/vessel-geometry-catalog.ts`) now returns a cached, stable reference via a `Map`, confirmed read at both call sites (`VesselScene.tsx:21`, `use-indicative-stability.ts:36`). Verified this holds during playback, not just at rare plan-edit time as originally scoped.
- InstancedMesh `capacity = plan.placements.length || 1` (unsliced) vs `mesh.count = items.length` (sliced) split is intentional and correct: `key={capacity}` only forces a remount when the *total* placement count changes (cargo load/clear), not on every playback tick; matrices are only ever written for `[0, items.length)`, and indices `>= mesh.count` are simply not rendered by three.js — no stale-matrix artifacts, confirmed by tracing both `useLayoutEffect`s.
- Phase-01's previously-flagged `draft_fwd_m`/`draft_aft_m` LCF-reference-frame bug (see prior memory note) is now fixed in `engine/stability-indicative.ts:100-101`, with an explicit code comment documenting the fix and citing "Bug found in code review." Confirmed the correct AP-referenced formula (`row.draft_m + trim_m*(lbpM - row.lcf_m)/lbpM`) is in place.
- Phase-01's adjacent `VesselScene.tsx` typecheck break (raw `StabilityResult` passed where `ShipAttitudeInput` expected) is also fixed — `VesselScene.tsx:24` now correctly calls `shipAttitudeInputFromStability(attitude)`. `npm run typecheck` confirmed clean.
- `LoadingSequenceDriver` is mounted exactly once (`VesselScene.tsx:37`, inside `<Canvas>`) — no duplicate-driver double-advance risk.
- Edge cases handled correctly: `total === 0` disables Play/scrub in `LoadingSequencePanel`; empty-plan `capacity` falls back to `1` to avoid a zero-arg `instancedMesh` crash; `cargoLoaded` toggle calls `resetPlayback()` synchronously in the same handler as `setCargoLoaded`, so no stale-`totalPlacements` race against the driver.
- `LoadingSequencePanel.tsx` follows `StabilityPanel.tsx`'s established pattern well (per-field selectors, no whole-store destructure — actually cleaner than `Sidebar.tsx` and `ContainerInstances.tsx` in this respect).
- All reviewed files comfortably under the 200-LOC convention; naming consistent with existing conventions (kebab-case for non-component modules, PascalCase for components, matching pre-existing `StabilityPanel.tsx`/`VesselScene.tsx` style).

## Edge Cases Found (tracing beyond the diff)
- Confirmed no race between scrub (`setPlaybackCount`, always pauses) and the driver's per-frame `advancePlayback` (checks `playbackPlaying` before advancing) — driver simply won't fire the frame after a scrub since `playbackPlaying` is already false in the same store update.
- Confirmed large `useFrame` delta (e.g., tab backgrounded then resumed) cannot cause `playbackCount` to overshoot `maxCount`, since `Math.min` clamps regardless of `deltaCount` magnitude — safe even for pathological delta spikes.
- Confirmed `validatePlan` (in `App.tsx`, feeding the Checks panel) is memoized on `[plan]` only, not `playbackCount` — does NOT re-run every playback frame, so that particular expensive-looking computation is safe.
- Confirmed `stabilityForVisiblePlan`'s `cargoWeightItem` conversion itself is cheap arithmetic (no lookups/search), so the H2 finding's actual cost is dominated by the unnecessary full `byId` Map rebuild, not the per-item math.

## Recommended Actions
1. (High, H1) Convert `Sidebar.tsx` and `ContainerInstances.tsx` from `usePlanStore()` whole-store calls to per-field selectors or `useShallow`.
2. (High, H2) Hoist the `byId` Map construction in `stabilityForVisiblePlan` out into a separately-memoized `useMemo(..., [plan.containers])` in `useIndicativeStability`, pass as a parameter.
3. (Medium, M1) Consider throttling or removing the per-frame `computeBoundingSphere()` call in `ContainerInstances.tsx` if profiling shows it matters at current/expected container counts.
4. (Low, L1) Add defensive clamping to `setPlaybackCount` for consistency with `advancePlayback`.

## Metrics
- Typecheck: 0 errors
- Tests: 277/277 passing (39 files)
- New test files this phase: `playback-slice.test.ts` (6 cases), `use-plan-store-playback.test.ts` (7 cases), 3 playback cases added to `use-indicative-stability.test.ts`
- Linting: not run separately (no dedicated lint script found beyond `tsc --noEmit`); no syntax/compile issues found

## Unresolved Questions
- None blocking. H1/H2 are perf-hygiene, not correctness bugs — safe to ship as-is and fix opportunistically, per the user's stated priority (functionality/readability over strict optimization) unless profiling on real hardware shows dropped frames during Play at full 870-container scale.
