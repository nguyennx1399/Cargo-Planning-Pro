# Code Review — hull hides for ANY gesture (260917-1525)

Scope: `src/features/viewer3d/VesselScene.tsx` (hull `hidden` expr + new selector), `src/features/viewer3d/Hull.tsx` (comment only). Pre-existing uncommitted work in the same two files deliberately NOT reviewed.

Verdict: **change is correct and cheap.** No Critical/High. 3 Low notes + 1 comment-accuracy nit.

## 1. Re-render cost — clean, no extra renders

- zustand v5 (`package.json:27`), default `Object.is` on the SELECTOR RESULT. `(s) => s.inHand !== null` returns a boolean → selector runs on every store write (one `!==`, free), component re-renders only when the boolean flips. `inHand` object identity churn is invisible to it.
- Flips exactly twice per gesture (`handState` / `endHand`, hand-slice.ts:89,113). Both flips are written in the SAME `set()` as the other hand fields → one notification, one render.
- Nothing writes `inHand` per pointer move: the pointer-rate writer is `setHoveredPose` (hand-slice.ts:162), and it dedupes via `samePose` before returning a new state.
- VesselScene already subscribes to `hoveredPose` (VesselScene.tsx:65) — an object replaced per CELL change during a project-cargo gesture. That subscription, not the new boolean, is the dominant re-render driver, and it is pre-existing.
- Net delta vs the old expression: a container gesture used to re-render VesselScene 0 times (neither `activeBreakbulkId` nor `hoveredPose` moves for a container hand); it now re-renders 2× per gesture (start + end). That is the minimum cost of the feature, and 2 renders/gesture is nothing — R3F reconciles children, the Canvas root is not recreated. `args={[...]}`/`position={[...]}` literals in the tree are compared element-wise by R3F's `is.equ`, so no three.js object is reconstructed on those extra renders.

## 2. `view.showUnderDeck` — NOT dead, still load-bearing

VesselScene.tsx:82 `freeRegionsFor(...).filter((region) => areaVisible(region.area, view))`, and `areaVisible` (src/lib/drop-verdict.ts:79-81) branches on `showOnDeck`/`showUnderDeck`. Whole `view` shallow selector (showOnDeck/showUnderDeck/bayFilter) stays needed. Do not remove.

## 3. Paths where `inHand` could stay non-null — all covered except one

Covered: Esc (`use-stowage-keyboard-shortcuts.ts:67`), commit ok / refused drag (`commit-placement.ts:121-122`), window `mouseup`+`pointercancel`+`blur` while dragging (`use-stowage-drop-release.ts:46,52-55`), vessel change (`usePlanStore.ts:121` spreads `endHand()`). Refused PICK staying armed is intentional and the hull staying hidden there is correct — the gesture has not ended, and the armed state IS visible to the planner (`unplaced-item-picked` + `aria-pressed`, UnplacedCargoList.tsx:170-172, plus the verdict chip).

**LOW — dangling hand after undo/redo leaves the ship invisible.** `usePlanDraftStore` undo/redo (usePlanDraftStore.ts:172,178) never touches the hand. Arm a PICK, Ctrl+Z past the op that introduced that cargo → `inHand.id` no longer resolves in `plan`, so every layer keyed on the resolved item goes dark (`item` is null at VesselScene.tsx:73 → no placeholders, no drop plane) while `handInUse` stays true → hull hidden, nothing to place onto, only Esc recovers. The old expression self-healed for project cargo precisely because it tested `item !== null`. Narrow repro, but the fix is one line: call `cancelHand()` from undo/redo (correct regardless — a stale hand is also a stale commit target).

**LOW — hull now hides even when the gesture's targets are on deck.** With "Under deck" unticked, `regions` is filtered to on-deck areas, yet the hull still steps aside. No occlusion is being solved there (on-deck targets are not behind the plating), so the planner loses ship context for no gain. Same for a container gesture with under-deck hidden. Acceptable as KISS — just note that Hull.tsx's new comment ("the shell plating sits between the camera and the targets") is not true in that configuration.

## 4. `hidden` contract in Hull.tsx — accurate, one wording nit

- `!showHull || hidden` at Hull.tsx:118 (GltfHull), :137 (LoftedHull), :156 (SimpleBoxHull) — toggle wins, gesture cannot re-show. Matches the comment and the browser check.
- All three read `showHull` and run their hooks (`useGLTF`, the loft `useMemo` at :120-132) BEFORE the early return, so the expensive work is preserved across a hide/show — the "do not optimise into an unmount" claim holds for the React components.
- **Nit:** "returns null with the hull BUILT, never unmounted" overstates it. The three.js meshes/primitive ARE removed from the scene graph; what survives is the memoised geometry + the GLTF cache. Suggest: "the components stay mounted so the loft memo and the GLB cache survive; only the scene objects come and go."
- Note `Detailed` (Hull.tsx:55): both LOD children render null while hidden, so the LOD has zero levels for the duration and re-adds them on show. Empirically fine (Esc restores, per your browser pass on the parametric demo vessel). The `source: "mesh"` vessel (bbc-sao-paulo, `src/data/bbc-sao-paulo-geometry.ts:59`) goes down the `GltfHull` branch instead and was NOT exercised by hand — one click-through there closes the last gap.

## Minor / convention

**LOW — inline selector breaks the slice's own convention.** `activeContainerId`, `activeBreakbulkId`, `dragInFlight` all live as named exports in `hand-slice.ts:185-195`; `s.inHand !== null` is written inline at VesselScene.tsx:72 instead. Exporting `handInUse` from the slice would keep every hand-derived predicate in one place and make the hull rule assertable from the slice's existing unit tests (nothing currently guards this behaviour — no test asserts the hull `hidden` prop, and R3F components are not covered by the 87-file suite).

## Positives

- Boolean-returning selector (not an object/`useShallow`) is exactly the right shape here.
- Comment explains why NOT `dragInFlight` and why not the project-cargo projection — the two wrong answers a future reader would reach for.
- `hidden` stays a prop; Hull.tsx still knows nothing about the hand.

## Unresolved questions

1. Should undo/redo clear the hand? (Fixes the dangling-hand hull-invisible case and a stale commit target at once — but out of this phase's scope?)
2. Keep hiding the hull when the visible targets are all on deck, or gate on "at least one hidden-by-plating target exists"? Current behaviour is simpler; confirm it is what you want before it is documented as the rule.
3. Was the `source: "mesh"` vessel (bbc-sao-paulo → `GltfHull`) click-through checked, or only the parametric demo vessel?
