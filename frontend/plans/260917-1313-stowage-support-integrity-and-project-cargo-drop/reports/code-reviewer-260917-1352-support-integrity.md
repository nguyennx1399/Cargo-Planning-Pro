# Code review — Phase 01 support integrity on move & unplace

Date: 2026-09-17 13:52 · Reviewer: code-reviewer · Verified state: `npx vitest run` on the 3 phase files = 27 passed.

## Scope

- NEW `src/engine/placement/support-dependents.ts` (109 LOC)
- NEW `src/store/begin-container-move.ts` (48 LOC)
- MOD `src/store/usePlanDraftStore.ts` (putContainer move guard, unplaceContainer signature)
- MOD `src/features/viewer3d/ContainerInstances.tsx` (3 lines of Phase 01 in an otherwise Phase-03 dirty file)
- NEW tests: `src/engine/__tests__/support-dependents.test.ts`, `src/store/__tests__/move-support-guard.test.ts` (grew to 375 lines mid-review), `src/store/__tests__/begin-container-move.test.ts`

## Overall

Rule is correct. The three focus areas asked about (mixed 20'/40', deck boundary, "only the tier directly
above") all check out against the plan-wide rule, and I could not construct a false positive or a missed
real floater. No unguarded mutation path left. Defects are DRY drift (a second tier-adjacency
derivation), one unmet requirement (container unplace has no UI to guard), and a batch of vacuous tests
appended to the store test file.

No critical issues. No security surface (local state, no I/O).

## Verified correct (evidence)

1. **Deck boundary.** `isSupported` resolves the stack per `deckOf(tier)` and returns true when
   `tierBelow` is null (`support-dependents.ts:55-59`) → on-deck tier 82 rests on the hatch cover.
   `boxesResting` scopes `higher` to the subject's OWN deck stack (`:69-74`), so the top under-deck box
   never lists tier 82 as a dependent. Identical to `validation-rules.ts:82-96` (`noFloating`).
   Pinned by `support-dependents.test.ts:125`.
2. **Mixed 20'/40'.** Halves come from `bayPosition` (`slot-helpers.ts:30-35`) on BOTH sides — the
   dependent's `pos.halves` and the occupancy scan (`support-dependents.ts:44,61`). A 20' half marks only
   its own half; a 40' above requires `every(halves)`. Same semantics as `validation-rules.ts:89` and
   `can-place-container.ts:139`. Pinned by `support-dependents.test.ts:86,99`.
3. **"Only the tier directly above" is exactly the blast radius.** `noFloating` judges each box solely by
   the tier directly below it (`validation-rules.ts:84-86`); a box two tiers up therefore cannot change
   verdict when this box leaves. Pinned by `support-dependents.test.ts:75`.
4. **Before-vs-after cannot blame a pre-existing floater** — `isSupported(before) && !isSupported(after)`
   (`support-dependents.ts:100`) is the definition, not an approximation. And it cannot miss a real one:
   the only boxes whose `tierBelow` cell changes are those at the tier directly above the vacated cell.
5. **The gate's "treat a move as a removal"** (`begin-container-move.ts:36`) is strictly safe, no false
   refusal: a move always vacates every half of the origin cell; the only same-cell destination is the
   other half, which is occupied whenever a dependent depended on it (so `canPlaceContainer` refuses it
   first). Gate ⊇ store guard, never contradicts it.
6. **No unguarded mutation path.** Writers of `placements` are `putContainer` / `unplaceContainer` /
   `undo` / `redo` / `loadPlan` (`usePlanDraftStore.ts:105-160`); the single production caller of
   place/move is `commit-placement.ts:74-77`; the bay plan commits through it (`BayPlanView.tsx:95`); the
   pick path arms unplaced boxes only (`UnplacedCargoList.tsx:175-176`); 3D drag is now gated
   (`ContainerInstances.tsx:170`). No `usePlanDraftStore.setState` anywhere.
7. **A refusal writes nothing and adds no history entry** — asserted at `move-support-guard.test.ts:52-53`.

## High

**H1 — `unplaceContainer` has ZERO production call sites; requirement 2 is unmet, not just untested.**
Confirmed: grep finds only tests (`move-support-guard.test.ts:65,76,89,98`,
`use-plan-draft-store.test.ts:97,99`). Delete/Backspace unplaces PROJECT CARGO only, and says so
explicitly (`use-stowage-keyboard-shortcuts.ts:34-44`); `ContainerInspector.tsx` has no remove button.
→ The signature change is safe (your reading was right), but the new `unplaceContainer` guard is dead
code in the shipped app, and phase step 4's "two call sites" does not exist.
Action: either wire a container unplace (Delete on a selected container id + inspector button) and consume
the `PlacementResult` through `dropOutcome`, or strike requirement 2 / step 4 from the phase file. Do not
leave the plan claiming coverage the UI does not have.

**H2 — second definition of tier adjacency, the exact thing the phase's risk table forbids.**
`support-dependents.ts:72-74` re-derives "the tier above" (`stack.tiers.filter(t => t > tier)` + `Math.min`)
instead of a shared primitive beside `tierBelow` (`placement-checks.ts:18-22`). It is the inverse function,
and it already diverges: `tierBelow` guards `stack.tiers.includes(tier)` and returns null; `boxesResting`
does not, so a subject standing on a tier the stack spec does not list still gets a "tier above".
Fix: export `tierAbove(stack, tier): number | null` from `placement-checks.ts` (same `includes` guard) and
call it. One definition per direction, both in the same file.

## Medium

**M1 — `stackFor` duplicated.** `support-dependents.ts:56` and `:70` inline `vessel.stacks.find(s => ...)`;
the shared lookup already exists as `can-place-container.ts:101` (module-private). Export it (or move it
next to `tierBelow`) and use it in all three places — this is the same column identity the guard must
share with the destination check.

**M2 — third implementation of cell occupancy.** `occupiedHalves` (`support-dependents.ts:32-47`) is a
third "which halves of this cell are filled" next to `validation-context.ts:52` (`cellKey` / `ctx.cells`)
and `can-place-container.ts:91` (`indexFor`). The header's justification (no cached index, runs a handful
of times) is reasonable — keep it — but the semantics must not drift from `noFloating`. They match today.
Cheapest insurance is already half-written: the "no edit may increase the plan's no_floating count"
invariant (`move-support-guard.test.ts:56`) — extend it into a small property test over many random
subjects rather than one.

**M3 — `dropOutcome` lifetime doc is now false.** `commit-placement.ts:25` declares itself "the ONE place
`usePlanStore.dropOutcome` is written"; `begin-container-move.ts:40` writes it too. Add the row to that
table, or better, expose `recordRefusal(result, slot, origin)` from `commit-placement.ts` and call it.
Same line also hand-rolls the reason shape that `usePlanDraftStore.ts:33` (`fail`) already builds — export
one `failure(rule, message)` from `engine/placement/reason.ts` and use it in both.

**M4 — vacuous tests appended to `move-support-guard.test.ts` (lines 105-375).** They pass without
asserting:
- `:190-228` "allows move within same column when dependents stay supported": `targetTier = tier + 2` is BY
  CONSTRUCTION the dependent's occupied slot, so `if (isOccupied) return` always fires. The test body never
  runs. Requirement 5 still has no store-level coverage.
- `:166-189` "supports 45' container with BBC SAO PAULO": unrelated to support integrity, builds a demo
  plan on a non-demo vessel (`buildLoadedDemoPlan(bbcVessel, ...)`), and every assertion sits inside
  `if (unplaced45 && validSlots.length > 0)`.
- `:310-375` undo/redo `toBeLessThanOrEqual(before)`: undo/redo restore snapshots; the comparison is
  trivially equal and would not catch a regression.
- ~10 `if (!x) return;` silent skips: these convert a broken fixture assumption into a green test. Use
  `expect(x).toBeDefined()` or a `describe.skipIf`.
Recommend deleting the three above and replacing them with one hand-built mixed-bay plan case (see M5).

**M5 — the demo fixture cannot exercise the half logic.** Measured: the loaded demo plan has 486
placements and **0** odd-bay (20') placements. So every store-level and gesture-level test runs 40'-only,
and the mixed 20'/40' path is covered only by the pure unit test's hand-built plans. Worse, the test column
helpers key columns as `` `${bay}|${row}` `` (`move-support-guard.test.ts:20,86`,
`begin-container-move.test.ts:12`), which treats bays 13/14/15 as three columns — on any vessel with 20'
placements those helpers will pick a wrong "top of stack" and the tests will flake. Use
`bayPosition(bay, vessel.bays).fortyBay` in the helpers, and add one store-level mixed-bay refusal case.

## Low

- **L1 — playback slice vs guard.** `ContainerInstances` renders `visiblePlacements(..., playbackCount)`
  but the gate reads the full plan (`ContainerInstances.tsx:170`), so during playback a drag can be refused
  naming boxes that are not drawn yet. Rare; either ignore or mention playback in the message.
- **L2 — predicate with a side effect.** `canBeginContainerMove` writes to the store
  (`begin-container-move.ts:40`). Returning `string[] | null` (the stranded ids) and letting the caller
  record would keep the module store-free and pure-testable; name it `beginContainerMove` if the write stays.
- **L3 — a refused drag leaves nothing selected.** `movedRef.current = true` is set before the gate
  (`ContainerInstances.tsx:168-171`), so the press is consumed and the box is not selected either: the
  planner is told "move them first" with no inspector open on the offender. Consider
  `setSelected(down.id)` on the refusal branch.
- **L4 — `planWithout(plan, id)` duplicated** at `begin-container-move.ts:36`, `drop-verdict.ts:107`,
  `pose-verdict.ts:39` and in three tests. One exported helper.
- **L5 — commit hygiene.** `ContainerInstances.tsx` mixes Phase 01 (3 lines, `:169-171`) with Phase 03
  press-ownership/breakbulk-hand work. Split the commits.

## Positive

- Module headers explain WHY (not what) and pre-empt the two design questions a reader would raise
  (why not inside `canPlaceContainer`, why before-vs-after). Exemplary for this repo.
- The gate at gesture start is the right call: it keeps `validSlotsFor`'s ~900-slot sweep answering about
  destinations only, so the placeholder layer cannot turn uniformly red.
- Refusal reuses `no_floating` + the existing `dropOutcome` channel — no new rule vocabulary, one wording
  (`strandedMessage`) shared by store and gate.
- `unplaceContainer` on an unplaced box returns `ok` rather than a refusal (`usePlanDraftStore.ts:151-153`)
  — correct intent semantics, and tested.
- `support-dependents.ts` at 109 LOC, no store import, pure — respects the 200-LOC rule and is testable.

## Plan file TODO status (observed)

- [x] `support-dependents.ts` + unit tests
- [x] `putContainer` move guard (before/after)
- [~] `unplaceContainer` returns `PlacementResult` — done, but **no call sites exist** (H1)
- [~] Gesture-start refusal — 3D drag only; no container pick/keyboard path exists to gate
- [x] Store-level regression test (generalised from DEMU0000016 to "first stacked column")
- [x] typecheck + full suite green (reported 85 files / 665 tests)
- [ ] Manual 3D check

## Unresolved questions

1. Should containers get an unplace UI at all (Delete on a selected container / inspector button)? If not,
   requirement 2 and step 4 should be struck and the `unplaceContainer` guard documented as API-only.
2. Should a refused pick-up also select the box, so "move them first" has an inspector to act in?
3. Should the gate see the playback slice instead of the full plan during playback?
4. Is the BBC SAO PAULO / 45' test (`move-support-guard.test.ts:166`) intentional here, or a leftover from
   another task's file?
5. `move-support-guard.test.ts` grew ~270 lines DURING this review (another session writing concurrently).
   Findings M4/M5 describe the file as of 14:04 — re-check if it moved again.
