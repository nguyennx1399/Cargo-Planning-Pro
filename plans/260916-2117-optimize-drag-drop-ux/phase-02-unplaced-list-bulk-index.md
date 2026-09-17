# Phase P2 — Bulk index for the 400-row Unplaced list

## Context Links

- Shipped code this phase reworks: `frontend/src/features/panels/UnplacedCargoList.tsx` (75 LOC), `frontend/src/styles.css:169-178` (`.unplaced-list`, `.unplaced-item*`)
- Acceptance script this phase **extends** (steps 1–28 stay untouched): `plans/reports/manual-click-through-260916-phase-c.md`
- Engine primitives reused: `engine/placement-checks.ts` (`sizeFitsBay`), `engine/placement/placeholders.ts` (`validSlotsFor`), `engine/slot-helpers.ts` (`bayPosition`), `lib/drop-verdict.ts` (`slotVisible`)
- Findings folded in: `plans/reports/tester-260916-final-ac-verification.md` (400 unplaced of 886 on MV Demo Horizon; BBC 20 unplaced) · `plans/reports/code-reviewer-260916-phase-c-ui-review.md` §1 (the parity filter is rendering-only and may stay that way) · `plans/reports/researcher-260916-1628-dnd-intent-and-patterns.md` B5 (a DnD library would earn its place only on sortable DOM chrome — deliberately still not taken)
- Repo rules: `docs/development-rules.md` (<200 LOC, kebab-case, YAGNI/KISS/DRY, comments explain *why*)

## Overview

- **Priority:** P2
- **Effort:** ~0.5–1 d
- **Status:** **implemented 2026-09-16, uncommitted** — 75 files / 586 tests green (+20 tests),
  typecheck clean, build exit 0, frozen guards green and unmodified, `git diff --stat` empty under
  `frontend/src/{engine,data}`. Every file under 200 LOC (199 is the worst). Open: the browser
  click-through (steps 29–34 of the acceptance script) and the docs sync.
  **Finding (recorded, not a defect):** because every bay a planner can select has both a 40' cell and
  its two 20' halves, the size/parity claim is satisfied by **every** size in **every** bay on both real
  vessels — the ticked filter narrows nothing there, which is the true answer, and the anti-divergence
  suite proves the naive `slot.bay === bay` reading would instead hide the whole 20' fleet. The exact
  variant stays the recorded follow-up. See step 31 of the acceptance script.
- **Description:** `naiveFillPlan` deliberately places no 20' box, so MV Demo Horizon loads with **400 unplaced containers of 886** — and the Unplaced section renders all 400 as chips in a **140 px** scroller (`.unplaced-list`, `styles.css:169`) containing ~2000 px of content. Finding one container means scrolling a keyhole; there is no search, no filter, no sort, no grouping, no arrow-key movement. This is the highest-value item in the whole pass and it is **list logic: pure and node-testable**, so almost all of it moves from (c) human-observed to (a) machine-checked.

## Key Insights

### 1. The bottleneck is retrieval, not rendering

400 `<button>`s is not a performance problem. The problem is that the planner knows *what* they want
("a 20' reefer for SGSIN") and the UI offers only scroll position. Concretely: with ~90 px chips in a
260 px panel the list is ~2 chips per row → ~200 rows → ~2 400 px of content behind a 140 px window,
i.e. roughly **17 viewports of scrolling** to eyeball the whole set.

### 2. "Which of these fit the bay I am looking at" — the one item that needs a decision

`validSlotsFor` is the exact answer and it is *unaffordable* here: it sweeps every model slot
(2 400 on the demo), so 400 candidates ≈ 960 k predicate calls. Two workable variants, measured:

| Variant | Cost | Truthfulness |
|---|---|---|
| Exact: `canPlaceContainer` over the **bay's own slots only** (`≈28` slots per bay — BBC bay 3 has 28) × 400 rows = **11 200 predicate calls** | at the recorded ≈3.5 µs/slot: **≈39 ms** per recompute | exact (plug, weight, overstow, `no_floating`, `max_height` all included) |
| Size/parity: `sizeFitsBay(c, s.bay)` for the bay's slots, `some(...)` | **O(28)** O(1)-ish per row, sub-millisecond | over-approximate: says "the bay's parity fits your size", says nothing about whether a slot is free |

The exact variant recomputes whenever the **plan** changes — i.e. after every single drop — which is a
39 ms hitch in the middle of the interaction the pass exists to smooth. It also duplicates the
picker's/placeholder's job: once a box is picked, the 3D view and the 2D bay plan already show
exactly which slots in that bay are open.

**Default adopted:** the size/parity variant, labelled as such (`Fits bay 22` with
`title="Size and parity only — the slot still has to pass every check."`), plus a per-row `fitsBay`
badge so the claim is visible per row rather than implied by a filter. It never hides a box whose
size could take a slot in that bay (proved against the engine, below), so it cannot cost the planner
a reachable container. The exact variant is recorded in Next Steps with its measurement, pending the
human decision in `plan.md` #2.

### 3. Bay membership is a `bayPosition` question, not a `bay` equality question

A 20' box in a 40' bay 22 lives in slot **21 or 23** (its `slot.bay` is odd), so `slot.bay === 22`
would report "nothing fits bay 22" for every 20' box on board — the exact opposite of the truth. The
membership rule is the one `slotVisible` already uses (`drop-verdict.ts:54`):
`bayPosition(slot.bay, vessel.bays)?.fortyBay === bay`. That expression is currently duplicated
inline; this phase extracts `slotInBay(slot, bay, vessel)` and has `slotVisible` call it, so the
"which bay is this slot in" question has exactly one answer in the codebase.

### 4. Behaviour preservation is a testable requirement

Script step 1 reads the section out loud: *"The Unplaced section should read `Unplaced (20)`"* on BBC
with demo cargo and no filters. The default query must therefore reproduce today's rendering
byte-for-byte: plan order, no grouping, no rows hidden, and the header string exactly
`Unplaced (${total})`. Only when a filter is active does it become `Unplaced (${shown} of ${total})` —
so the exact strings are formatter functions in the pure module and are asserted, not eyeballed.

### 5. Two free wins found while scoping

- `styles.css:171` already sets `cursor: grab` on `.unplaced-item`, so dimension 3's list-row
  affordance exists. What does not exist is any affordance for the **canvas** (fixed in P1) — and no
  affordance anywhere for the 4 px select/move threshold.
- `.unplaced-list`'s `max-height: 140px` is the single cheapest bulk improvement in the file: the
  sidebar already scrolls (`overflow-y: auto`), so raising the list to ~320 px costs nothing and
  roughly doubles the visible set. No virtualisation, no library — YAGNI at 400 rows.

## Requirements

**Functional**

1. **Search** over a container's id, size, high-cube flag, type, POL, POD and weight (case-insensitive substring; a numeric-only query also matches the weight). Empty query = no filtering.
2. **Filters**: size (any / 20' / 40' / 45') and type (any / DRY / REEFER / OPEN_TOP / FLAT_RACK / TANK), plus a **"Fits bay NN"** toggle that is only offered when a bay filter is set.
3. **Sort**: cargo order (default = `plan.unplaced` order), POD rotation sequence, weight desc, id asc. Locale-independent, stable, and stable across renders.
4. **Group**: none (default) / POD / type / size — collapsible, with per-group counts.
5. **Keyboard**: ArrowUp/ArrowDown move focus along the rendered rows, Home/End jump to the ends, Enter picks (native `<button>`); the search field must not steal bay navigation, and bay navigation must not steal typing.
6. Header: `Unplaced (N)` unfiltered (unchanged), `Unplaced (S of N)` filtered; `total === 0` keeps today's `return null`; `total > 0 && shown === 0` renders the controls plus a "no match" line and a **Clear filters** action.
7. The list is taller (≈320 px) and its scroll position/state survive a placement.

**Non-functional**

- No new npm dependency; no virtualisation; no debounce (a 400-row scan is ~400 string comparisons per keystroke — measured trivial).
- Every new module <200 LOC, kebab-case; components updated in place (no parallel "enhanced" file).
- **No placement rule is added or changed.** The bay filter is a *rendering* filter, exactly like the picker's parity filter (`code-reviewer-260916-phase-c-ui-review.md` §1): `commitPlacement → canPlaceContainer` stays the only gate, and no row or filter state reaches a commit path.
- Frozen contracts untouched: no `engine/`, `data/` or `store/` change is required by this phase.

## Architecture

```
  plan.unplaced (ids) ──► containers            vessel + bayFilter (usePlanStore)
            │                                            │
            ▼                                            ▼
  queryUnplacedRows(containers, query, ctx)     baySlots = model.slots.filter(slotInBay(…, bay))
   ├─ filter: text · size · type · fitsBay ◄──── fitsBay(c) = baySlots.some(s => sizeFitsBay(c, s.bay))
   ├─ sort:   cargo | podSequence | weight | id
   ├─ group:  none | pod | type | size
   └─► { groups, ordered, shown, total }
            │
            ├─► unplacedHeaderLabel(result)      [PURE, tested — pins "Unplaced (20)"]
            └─► UnplacedCargoList  ── rows ──► <button> (unchanged handlers: mousedown → drag, click → pick)
                                   └─ arrow keys ──► nextRowIndex()  [PURE, tested] ──► ref.focus()
```

`lib/unplaced-query.ts` is deliberately **view-free**: it takes `Container[]`, the query object and a
small context (`podSequence: Record<string, number>`, `baySlots: readonly SlotDef[] | null`) and
returns plain data. It never imports React, the stores, the vessel or `validSlotsFor` — that is what
makes every claim below node-testable, and it keeps the module's cost predictable.

`slotInBay(slot, bay, vessel)` goes into `lib/drop-verdict.ts` next to `slotVisible` (which then calls
it) — the same file already owns "which slots are worth picking and drawing".

## Related Code Files

**Create**

- `frontend/src/lib/unplaced-query.ts` (199 LOC) — `UnplacedQuery`, `UnplacedRow`, `UnplacedGroup`, `UnplacedResult`, `queryUnplacedRows`, `unplacedHeaderLabel`, `nextRowIndex`, `DEFAULT_UNPLACED_QUERY`.
- `frontend/src/features/panels/UnplacedListControls.tsx` (98 LOC) — search `Input`, size/type `Select`s, group/sort `Select`s, the "Fits bay NN" `Checkbox` + `Label`, Clear.
- `frontend/src/lib/__tests__/unplaced-query.test.ts` (166 LOC) — query results over the real 400-row demo and the BBC set (the pure suite).
- `frontend/src/lib/__tests__/unplaced-query-bay-fit.test.ts` (88 LOC) + `frontend/src/lib/__tests__/unplaced-query-fixtures.ts` (49 LOC) — **added during implementation:** the suite outgrew 200 LOC, so it is split at the claim boundary (results vs the bay claim) and the shared real-vessel fixtures sit in a non-collected helper, as `engine/__tests__/test-vessel-fixture.ts` already does.

**Modify**

- `frontend/src/features/panels/UnplacedCargoList.tsx` (75 → ~150) — hold the query state, resolve `baySlots`, render groups/rows, wire arrow-key navigation, keep the two existing hint strings and both handlers verbatim.
- `frontend/src/lib/drop-verdict.ts` (156 → ~168) — export `slotInBay`, reuse it inside `slotVisible`.
- `frontend/src/lib/__tests__/drop-verdict.test.ts` — `slotInBay` cases (odd half belongs to its 40' parent; an unknown bay is in no bay).
- `frontend/src/features/panels/Sidebar.tsx` (190) + `frontend/src/features/panels/use-stowage-keyboard-shortcuts.ts` (54) — correct the now-stale "no text inputs in demo mode" comments (`Sidebar.tsx:63-64`, `use-stowage-keyboard-shortcuts.ts:22-23`): P2 introduces the first text input, and these guards are what keep it from hijacking typing. Comments only.
- `frontend/src/styles.css` — `.unplaced-list` max-height 140 → 320 px, `.unplaced-search`, `.unplaced-group`, `.unplaced-groupheader`, `.unplaced-nomatch`.
- `plans/reports/manual-click-through-260916-phase-c.md` — append section **G** (steps 29–34).

**Delete:** none.

## Implementation Steps

1. **`slotInBay` first** (it is a dependency of the bay filter): `slotInBay(slot, bay, vessel)` = `bayPosition(slot.bay, vessel.bays)?.fortyBay === bay`; rewrite `slotVisible`'s last line to call it. Extend `drop-verdict.test.ts`: for both real vessels, every odd half of a 40' bay reports membership of that parent bay and of no other.
2. **`unplaced-query.ts`.** Pure functions, no React/store/vessel imports:
   - `queryUnplacedRows(containers, query, ctx)` → `{ groups, ordered, shown, total }`. Filter order: text → size → type → fitsBay; sort; group. Text matching covers `id`, `size`, `high_cube`, `type`, `pol`, `pod`, and `String(weight_t)` (so `22.7` finds the BBC reefer by weight). Id sort uses code-unit comparison (`a < b`), **not** `localeCompare` — locale-dependent ordering would make the suite machine-specific.
   - `unplacedHeaderLabel(result)` → `Unplaced (${total})` when nothing is filtered, else `Unplaced (${shown} of ${total})`.
   - `nextRowIndex(current, delta, count)` → clamped, `-1 → 0` on a forward step from nothing focused.
   Comment the *why* on each: the header formatter exists to keep script step 1's exact string, and the two count forms exist because "0 of 400" and "0" mean different things to a planner.
3. **`unplaced-query.test.ts`.** Fixture = the real demo plan (`buildDemoVesselAndCargo` + `buildLoadedDemoPlan`) and the real BBC pair:
   - `total === 400` on MV Demo Horizon (the recorded figure; BBC = 20) and unfiltered `ordered` equals `plan.unplaced.map(...)` in plan order;
   - `unplacedHeaderLabel` returns exactly `Unplaced (400)` / `Unplaced (20)`;
   - grouping partitions the filtered set (Σ group rows === `shown`) and every row appears once;
   - weight sort is descending and stable for equal weights; id sort is deterministic on a mixed-case/digit fixture;
   - `nextRowIndex` clamps at both ends and never returns an out-of-range index;
   - **anti-divergence against the engine:** for each of 40'/20'/reefer candidates on both vessels, every slot in `validSlotsFor` satisfies `sizeFitsBay` — i.e. the bay filter can never hide a container the engine would accept in that bay. Re-asserts the invariant the picker's parity filter relies on (recorded 0 violations / 112 230 pairs) in the new module's terms.
4. **`UnplacedListControls.tsx`** — controlled from `UnplacedCargoList` (one owner of the query state); `Input` with `type="search"`, `placeholder="id, size, type, POD or weight"`, `aria-label="Filter unplaced cargo"`; two `Select`s for size/type; two for group/sort; a `Checkbox` + `Label` for the bay toggle, rendered only when `bayFilter !== null` (labelled with the 2-digit bay); Clear resets everything. No custom tooltip machinery — the `title` attribute carries the honest caveat.
5. **`UnplacedCargoList.tsx`** — keep the `useMemo` for the container lookup and `validSlotsFor` count (they are the existing behaviour), keep `mousedown`/`click` and `aria-pressed` verbatim, add: query state, the `baySlots` memo (keyed on vessel + `bayFilter`; `null` when no bay is filtered), the rows/groups render (rendering only the visible + focused rows; collapsed groups render headers only), an `onKeyDown` on the list container that maps ArrowUp/ArrowDown/Home/End through `nextRowIndex` and calls `focus()` on the row refs, and the no-match branch. The two existing hint strings stay byte-identical, so steps 1 and 11–12 of the script still describe what the human sees.
6. **CSS.** Raise `.unplaced-list` to `max-height: 320px`; add the search row, group header (uppercase, muted, sticky inside the scroller), and no-match styles. Keep the chip layout (`flex-wrap`) — a single-column list was considered and rejected: it halves the density for the common 20-row case (BBC) to help the 400-row case that search now solves.
7. **Correct the stale guard comments** in `Sidebar.tsx` and `use-stowage-keyboard-shortcuts.ts` (see Related Code Files). No behaviour change — the `INPUT`/`TEXTAREA` guards already exist and are what make the new search field safe.
8. **Extend the acceptance script** with section G (steps 29–34, below).
9. **Verify:** `npm run typecheck`, `npm run build`, `npx vitest run` (≥541 + the new files green, 0 failures), the four frozen guard files unmodified, `git diff --stat` clean for `frontend/src/engine/**` and `frontend/src/data/**`.
10. **Docs sync (delegate to `docs-manager`).**

## Todo List

- [x] `lib/drop-verdict.ts`: `slotInBay` (reused by `slotVisible`) + `drop-verdict.test.ts` cases — 167 / 129 LOC
- [x] `lib/unplaced-query.ts` (199 LOC, view-free, kebab-case)
- [x] `lib/__tests__/unplaced-query.test.ts` (166) — real demo + BBC fixtures, header strings, partition, sort stability, `nextRowIndex`
- [x] `lib/__tests__/unplaced-query-bay-fit.test.ts` (95) + `lib/__tests__/unplaced-query-fixtures.ts` (49) — **deviation:** the pure suite passed 200 LOC, so it is split along its two claim boundaries (query results vs the bay claim) and the shared fixtures move to a non-collected helper, the pattern `engine/__tests__/test-vessel-fixture.ts` already uses. Engine anti-divergence lives in the bay-fit file.
- [x] `features/panels/UnplacedListControls.tsx` (98)
- [x] `features/panels/UnplacedCargoList.tsx`: query state, `baySlots`, groups, arrow-key nav, no-match branch, handlers/copy unchanged — 199 LOC
- [x] `styles.css`: list height 140 → 320 px, search row, sticky group header, per-row fit badge, no-match
- [x] Correct the stale "no text inputs" comments in `Sidebar.tsx` (184) + `use-stowage-keyboard-shortcuts.ts` (56)
- [x] Extend `plans/reports/manual-click-through-260916-phase-c.md` with section G (steps 29–34)
- [x] Frozen-contract verification sweep (typecheck, build, full suite twice, guards unmodified, engine/data diff empty)
- [x] **Post-implementation review pass** (`code-reviewer`, 0 Critical/High, D6 + behaviour preservation + `slotVisible` identity verified clean). Folded in: the arrow keys now work from a group header and after a collapse (the seam model, review M1) with an explicit `focus()` for Safari; row/header lookups use `closest()`; the dead `UnplacedContext`/query `bay` field is gone (the bay IS `baySlots`); an empty slot list makes no claim, and the badge is gated on the same condition the filter is; the caveat string has one home (`BAY_CAVEAT`); a comment records the 4-apart-bay-grid assumption behind "exactly its 40' parent". Accepted and documented, not changed: the ref-callback churn at 400 rows (~1–2 ms/keystroke, measured), `type="search"`'s native clear, and the tick surviving a bay change (visible: the checkbox stays shown and relabelled).
- [ ] Docs sync via `docs-manager` — deferred, `docs/` is out of this phase's ownership

## Success Criteria

**Machine-checked (node, `npx vitest run`)**

- `unplacedHeaderLabel` returns exactly `Unplaced (400)` / `Unplaced (20)` unfiltered and `Unplaced (S of N)` filtered — script step 1's string is pinned by a test.
- Unfiltered `queryUnplacedRows` returns all 400 demo rows in plan order (and 20 on BBC), so the default rendering is byte-identical to today's.
- Groups partition the filtered set; every row appears exactly once; per-group counts sum to `shown`.
- Sort stability and locale-independence (id order asserted on a mixed-case/digit fixture; equal weights keep plan order).
- `nextRowIndex` never returns an out-of-range index and clamps at both ends.
- Bay filter anti-divergence: every slot in `validSlotsFor(candidate)` on both vessels satisfies `sizeFitsBay` — the filter cannot hide a container the engine would accept in that bay.
- `slotInBay`: an odd half reports membership of exactly its 40' parent; an unknown bay reports none.
- `npm run typecheck` clean; `npm run build` exit 0; suite ≥541 tests, 0 failures; demo 199 / BBC 36; the four frozen guards green and unmodified; `git diff --stat` shows no change under `engine/` or `data/`.
- Every new/changed file <200 LOC.

**Human-observed (append to `plans/reports/manual-click-through-260916-phase-c.md` as section G; steps 1–28 stay as they are)**

- **29. Baseline unchanged.** Open MV Demo Horizon with demo cargo: the Unplaced section reads exactly `Unplaced (400)`; the hint line is the same sentence as before; the list is scrollable over a visibly taller window and rows still respond to click (pick, step 11) and press-and-drag (step 1). Type `SGSIN` → the header becomes `Unplaced (n of 400)` and only matching rows remain; clear the box → back to 400.
- **30. Filters and grouping.** Set size = 20' → only 20' rows; set type = REEFER → the intersection; group by POD → collapsible headers with per-group counts (collapsing removes the group's rows, expanding restores them); sort by weight → descending. Clear all → 400 rows in the original order.
- **31. Fits this bay.** Set Bay = 22, then tick `Fits bay 22`. **Expect:** the surviving set is every row whose *size and parity* can take a position inside bay 22's footprint — including 20' rows (their half positions 21/23 lie in bay 22), which a naive "bay number equals 22" test would have wrongly hidden. Untick → every row returns. With a box picked afterwards, the 3D placeholders and the 2D outlined cells still show exactly the slots that pass every check (the filter changed nothing about placement).
- **32. Typing is not hijacked.** Focus the search box and type `20`; press ArrowLeft/ArrowRight while the caret is in the box → **the bay filter must not change and the caret moves**; press Esc in the box → the text clears and an armed pick is **not** cancelled (the Esc shortcut is guarded on text inputs). Then click outside the box and press ArrowLeft/ArrowRight → the bay filter changes as before (regression check for step 2's navigation).
- **33. Arrow-key navigation.** Focus a row (Tab or click) and press ArrowDown repeatedly → focus walks the rendered rows in order and the scroller follows; ArrowUp walks back; Home/End jump to the first/last row. Press Enter on a focused row → it is picked exactly as a click would (the row is still a `<button>`, `aria-pressed` flips). With a filter active, navigation only visits the visible rows.
- **34. State survives a placement.** With a filter and a grouping active, place a box from the list into a valid slot. **Expect:** the row disappears, the header's `shown`/`total` decrement, and the filter/grouping/sort/search state is unchanged. Then place the last matching row → `shown === 0` renders the no-match line with Clear (not an empty section), and Clear restores the full list.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The default rendering drifts from today's and breaks the existing script's step 1 | Medium | Medium | The unfiltered path is asserted byte-for-byte (header string, plan order, no rows hidden) *before* the controls are wired; grouping defaults to "none" and the two hint strings are not reworded. |
| "Fits bay NN" is read as "a slot is free here" and the planner trusts a false positive | Medium | Medium | Wording keeps the claim to size/parity; the `title` says the slot still has to pass every check; the badge is shown per row rather than implied by a filter; the exact variant and its 39 ms cost are recorded for the follow-up decision. |
| A 400-row re-render on every keystroke janks | Low | Low | Filter/sort is a ~400-element array scan with no engine calls; the expensive sweeps (`validSlotsFor`, `baySlots`) are memos keyed on vessel/plan/bay and are **not** touched by typing. Confirm with a `console.time` probe during step 30 if it feels off. |
| The new search `Input` breaks the global Esc/arrow key handlers | Low | Medium | Both handlers already return early on `INPUT`/`TEXTAREA`; P2 corrects their stale comments and adds step 32 as the explicit regression check. |
| Arrow-key navigation fights the wrapped chip layout (no spatial rows) | Low | Low | Movement is defined as previous/next in rendered order and documented as such; Home/End give the jump the planner actually wants over 400 rows. |
| Someone later routes the filtered list into a store action (e.g. "place all matching") | Low | High | Out of scope and explicitly rejected (the packer owns bulk filling; `naiveFillPlan`'s 20' omission is deliberate). The module is view-free with no store import, so the wiring does not exist to abuse. |

## Security Considerations

- No auth, network, storage or persistence is added. Filter state is component-local and discarded on unmount; nothing is written to `localStorage` — a deliberate rejection of a persisted "last filter" (YAGNI, and it avoids a new key on a shared machine).
- The search field is a controlled `input`; its value is compared, never interpolated into HTML. Rows continue to render as React text.
- No placement path gains a new entry point: the filter changes what is *displayed*, and the only commit calls remain the three existing `commitPlacement` sites.

## Next Steps

- **Blocked on the human decision in `plan.md` #2** (exact vs size/parity bay fit). The default (size/parity) is implemented; switching later is one function inside `unplaced-query.ts` plus its test.
- **Measured while implementing:** on both real vessels the size/parity claim is satisfied by every size in every bay (each selectable bay has a 40' cell *and* its two 20' halves), so the ticked filter currently narrows nothing — the truthful answer, not a bug. It still hides correctly where a parity really is missing (synthetic case in `unplaced-query-bay-fit.test.ts`), and the anti-divergence suite proves it can never hide a box the engine accepts. If the planner wants the filter to *narrow*, that is the exact variant below, and that is the trade the decision already recorded.
- **Recorded follow-up (not planned):** exact per-bay fit via `canPlaceContainer` over `baySlots`, gated behind the other filters and memoised on `(plan, bay)` — measure the ≈39 ms estimate first, and only if the planner asks for it.
- **Explicitly not planned:** virtualisation or a sortable-list library (B5: a DnD library earns its place only on DOM chrome — not needed at 400 rows with search); a persisted last-filter; a "place all matching" bulk action (the packer's job, deferred by design).
- **Phase D/E keep:** the BBC 20' reefer's `valid > 0` assertion, the two Phase-B test-quality findings, multi-select/swap/keyboard nudging, and the `breakbulk-deck-area.ts` shim deletion.
