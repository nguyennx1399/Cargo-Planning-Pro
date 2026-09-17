# Phase 03 — Honest "where can it go" + `area_id` data fix

## Context links

- `src/engine/placement/placeholders.ts` — `freeRegionsFor`, `AREA_FIT_RULES`
- `src/features/panels/UnplacedProjectCargoList.tsx` — the "fits in: …" hint
- `src/engine/naive-fill-breakbulk.ts` — writes the demo placements
- `src/engine/stowage-model/occupancy.ts` — `breakbulkOccupancy` (keyed by `area_id`)

## Overview

- **Priority:** medium — not a crash, but it is the app lying to the planner.
- **Status:** implemented and verified in the app (2026-09-17).
- On the default vessel with the default demo plan, **BB005 has 0 valid poses out of 2126 sampled**
  across all four areas, while the sidebar says `fits in: weather deck, Hold 2 tank top`. After
  phase 02 the planner will be able to aim — and will still be refused everywhere, with no clue why.

## Key insights

- `freeRegionsFor.feasible` deliberately projects only `AREA_FIT_RULES` (rect, height, pressure). That
  design is right for "does this item belong in this area"; it is wrong as the ONLY thing the planner
  is told, because occupancy is what actually refuses every pose.
- Refusal counts from the sweep (BB005, loaded demo plan): weather deck — `breakbulk_overlap` 1260,
  `breakbulk_overlaps_container` 534, `breakbulk_in_keep_out` 324, `out_of_deck_area` 510; Hold 2 tank
  top — `breakbulk_overlap` 1380, `overlaps_container` 247.
- ~~Data bug: `area_id: undefined`~~ — **WITHDRAWN, it was never a bug.** `areaIdOf`
  (`stowage-model/types.ts:75`) defaults an absent `area_id` to the weather deck, `naive-fill-breakbulk.ts:141`
  omits it on purpose for exactly that reason, and the draft store's `breakbulkPlacementOf` does the
  same. `breakbulkOccupancy` keys those items under the weather deck correctly. I misread a raw field
  dump while gathering evidence. No code change here.
- The unplaced demo items are genuinely large (BB005: 24 × 5.5 m, 110 t). "No room on a loaded ship"
  may be the honest answer — the fix is to SAY it, not to relax a rule.

## Requirements

**Functional**

1. `area_id` is always set on a generated breakbulk placement; no placement carries `undefined`.
2. The unplaced project-cargo row distinguishes three states: *fits and there is room*, *fits but no
   free space right now* (with the dominant reason), *does not fit this vessel at all*.
3. The hint stays one sweep per plan mutation / per gesture — never per pointer move.

**Non-functional**

- No new rule ids; the wording comes from the reasons `canPlaceBreakbulk` already emits.
- `placeholders.ts` stays under the file-size rule; put the sampling helper in its own module if needed.

## Architecture

- Extend `FreeRegion` with a `hasFreeSpace: boolean` + `blocker: Reason | null`, computed by a coarse
  grid probe of the area (step = a few metres, the item's own footprint, rotation 0 and 90) that stops
  at the first accepted pose. Worst case is one area-sized sweep per gesture, the same budget
  `freeRegionsFor` already spends.
- `UnplacedProjectCargoList` words the three states from that field; `fitsInText` gains the "no room"
  variant rather than a second text builder.
- Fix `naiveFillBreakbulk` to stamp the area id it packed into, and add a test asserting every emitted
  placement has one.

## Related code files

**Create**
- `src/engine/placement/area-free-space.ts` (the probe) + its test

**Modify**
- `src/engine/placement/placeholders.ts` (`FreeRegion` fields)
- `src/lib/area-fit-hint.ts` (`fitsInText` variants)
- `src/features/panels/UnplacedProjectCargoList.tsx`
- `src/engine/naive-fill-breakbulk.ts`
- tests touching `FreeRegion` / the hint text

**Delete** — none.

## Implementation steps

1. Fix the `area_id: undefined` case and add the assertion test (fast, independent).
2. Write `area-free-space.ts` with a first-accepted-pose probe; unit test it on both vessels, empty and
   loaded (empty ship → free space; loaded BBC → no free space for BB005).
3. Thread `hasFreeSpace`/`blocker` through `FreeRegion` and the row text.
4. `npm run typecheck`, `npm run test`.
5. Manual: on the loaded BBC plan, the rows say "no room"; after `Clear cargo (show empty hull)` they
   say the areas they fit in, and an item actually drops.

## Todo list

- [x] ~~`area_id` stamped by `naiveFillBreakbulk`~~ — **withdrawn, never a bug** (see Key insights)
- [x] `area-free-space.ts` scan + 7 tests (loaded → none, free deck → a pose the PREDICATE accepts,
      early-exit cost, oversize item, scan-step honesty)
- [x] Hint wording (`handFitsInText`) + 3 wording tests; threaded into BOTH the in-hand line and every row
- [x] typecheck clean + `npx vitest run src/` = 87 files / 696 tests green
- [x] Manual check in the running app

### Verified in the app (BBC SAO PAULO, default loaded plan)

Row badge, live: `BB005 · 24 × 5.5 m · 110 t — fits in: weather deck, Hold 2 tank top — but no free
spot found`, tooltip `BB001 overlaps BB005`, flagged with the `unplaced-nofit` class. The in-hand line
reads the same with the blocker inline. Before this phase both said only `fits in: weather deck,
Hold 2 tank top` while **zero** poses were placeable.

### Deviations from the plan, and why

- **Requirement 1 (`area_id`) dropped** — the premise was wrong, see Key insights. No code change.
- **`FreeRegion` NOT extended.** The plan put `hasFreeSpace`/`blocker` on `FreeRegion`; that would make
  every caller of `freeRegionsFor` (including the 3D placeholder layer, which runs it per gesture and
  does not need the answer) pay for the scan. The scan is its own module and its own call instead, so
  the cost lands only where the answer is rendered.
- **Cost, measured rather than assumed.** I first scoped the scan to the item in hand alone, fearing
  the per-row cost. Measured it: all 6 rows = 3105 predicate calls = **15 ms** per plan mutation, so the
  per-row state the requirement asked for is affordable and is now implemented.

### Not verified live

A successful LANDING. The demo data has no free spot for any unplaced item — with containers cleared
too, the placed project cargo (BB001–BB010) still fills the deck — so the app cannot be driven to a
green drop without hand-editing the plan. `canPlaceBreakbulk` accepting a scanned pose on a free deck
IS covered in node. This is the product question below, not a code defect.

## Success criteria

- No generated placement has `area_id: undefined`.
- On the loaded BBC demo plan every unplaced project-cargo row says there is no free space, and names
  the dominant blocker.
- On the cleared ship the rows say where the item fits, and a drop lands.

## Risk assessment

| Risk | Mitigation |
|---|---|
| The probe becomes an expensive sweep | First-accepted-pose exit, coarse step, one call per gesture/mutation — measure and note the cost like phase B did (≈1.05 ms for 447 slots) |
| Fixing `area_id` shifts occupancy and breaks the frozen no-violations test | Run `breakbulk-real-vessels-no-violations.test.ts` early; if it moves, understand the shift before touching the test |
| Wording implies a promise ("will place") | Keep the sidebar's existing "fits in" hedge; the ghost's own verdict stays the only promise |

## Security considerations

None.

## Next steps

After this, the remaining open question is product-level: whether the demo should ship a loaded plan
with zero room for its own unplaced project cargo.
