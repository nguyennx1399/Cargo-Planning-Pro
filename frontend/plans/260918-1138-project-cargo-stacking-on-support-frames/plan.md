# Project cargo stacking on support frames

## Ask (user, 2026-09-18)

In practice, project cargo is sometimes stacked on other project cargo using stacking frames. The planner
cannot model that today.

## Decisions (user, 2026-09-18)

1. **Item-on-item stacking via stackable frames.** The upper item rests ON the lower item or frame, and
   the LOWER one carries the load. Bridging frames (legs to the deck over an item) are out of scope.
2. **A frame is its own item.** It is placed like any project cargo (L × W × H, tare weight, max top
   load). Once placed, its top is a surface other cargo can be dropped on.
3. **Checks:** top-load limit · fully supported (footprint within the support's top) · stack height
   within the area's clear height. Discharge order is NOT checked.
4. **Any number of levels.**

## Where the code stands (verified)

- Every item rests on its AREA's floor: `cargoBaseHeight(vessel, area_id)` is the only height source
  (mesh builder, ghost, stability `kg_m`).
- `breakbulk_overlap` flags any two footprints overlapping in the same area, height-blind, so a stack is
  reported as an overlap today.
- `breakbulk_too_tall` compares `item.height_m` with the area's clear height, which ignores what it stands on.
- `canPlaceBreakbulk` is the only authority for both the drop preview and the plan-wide rules, so
  stacking goes into it once and both follow.
- Containers already refuse to lift a box that carries others (`canBeginContainerMove`). Project cargo
  gets the same rule.

## Data model (the whole change to the plan format)

```ts
BreakbulkCategory += "support_frame"
BreakbulkCargo.stacking?: { max_top_load_t: number }   // present = others may rest on its top
BreakbulkPlacement.on_cargo_id?: string                // the item/frame it rests on; absent = area floor
```
An upper placement keeps its support's `area_id`, so every per-area rule still groups correctly. Old plans
have no `on_cargo_id`, so they read as floor items and nothing changes for them.

## Phases

| # | Phase | Status | Priority |
|---|-------|--------|----------|
| 01 | [Stack model + geometry engine](phase-01-stack-model-and-geometry-engine.md) | done | high |
| 02 | [Stacking rules in canPlaceBreakbulk](phase-02-stacking-rules-in-can-place-breakbulk.md) | done | high |
| 03 | [Render, stability, lift guard at real height](phase-03-render-stability-and-lift-guard.md) | done | high |
| 04 | [Drop onto a support's top](phase-04-drop-onto-support-top.md) | done | high |
| 05 | [Create frames and stackable items](phase-05-create-frames-and-stackable-items.md) | done | medium |

The order matters: 01 → 02 → 03 → 04. Phase 05 depends only on 01 and can run after it. Until 04 lands,
stacks exist only in hand-built plans and tests.

## Ground rules

- **The predicate is the only authority.** No stacking rule lives in UI code.
- **Floor items are byte-identical.** Every existing breakbulk message, test and demo plan stays unchanged
  (`breakbulk-real-vessels-no-violations`, the demo fleet). Naive fill does NOT auto-stack.
- Files under 200 LOC. `can-place-breakbulk.ts` is already at 191 lines, so the stacking checks go in a
  new module (`breakbulk-stack-checks.ts`) that it calls.
- One height function (`elevationOf`) used by the mesh, the ghost, stability and the rules.

## Result (2026-09-18)

All 5 phases are done. The suite is 99 files / 793 tests (+49 tests), and `tsc --noEmit` is clean.

**Verified in the browser (BBC SAO PAULO):** the form refuses a frame with no max top load; FRAME-1
(12 × 4 × 0.5 m, 3 t, ≤ 60 t) is listed as "frame ≤ 60 t" and placed on the hatch covers. With a 40 t item
in hand, the pointer over the frame resolves to `onCargoId: FRAME-1`, the ghost sits on the frame, and the
chip reads "on FRAME-1, weather deck 87.5 / 0.5 m — Clean drop". The click commits `on_cargo_id: FRAME-1`
with 0 errors. A 25 t item on the same frame is refused (overlap + "FRAME-1: 65.0t on top exceeds its 60t max
top load"). Delete on FRAME-1 is refused with "FRAME-1 carries CUSTOM-1 — lift it off first". Beside the
frame, the pose falls to the floor (no `onCargoId`).

### Deviations from the phase files
- **Phase 02:** the 20 m band helpers moved to `breakbulk-band-weight.ts` (unchanged) to keep
  `can-place-breakbulk.ts` under 200 lines. `topRect` was dropped: `footprintRect` already is the top.
  `candidatePlan` reuses the plan itself when the item is already at that pose, so the plan-wide rules build
  the stack index once per plan.
- **Phase 03:** `buildBreakbulkMesh` / `breakbulkWeightItem` take an optional `elevationM = 0` instead of a
  required `baseY` (no churn in the ~15 existing callers). Removing custom cargo needs no lift guard: it is
  only offered for unplaced items.
- **Phase 04:** NO separate `SupportTopDropPlanes` layer. `AreaDropPlane`'s box encloses every top, is
  entered first, and stops propagation, so a second layer could never get the pointer. Tops are instead
  extra probes for the drop plane's own resolver (`lib/support-top-probes.ts`), whose "highest surface wins"
  rule already puts the pose on a top. Tops use `pad: [0, 0]` so cargo can still be dropped beside a frame.
  `samePose` now compares `onCargoId`.
- **Found while verifying, fixed:** adding ANY custom item rebuilt the whole plan (`customCargo` was a
  dependency of the App rebuild effect), wiping every hand-made placement and the undo history. That made
  stacking impossible in the UI. Adds and removes now edit the current draft and its history
  (`store/custom-cargo-in-plan.ts`); the rebuild follows only the vessel and the toggles.
- **Small extra:** the drop chip names the support ("on FRAME-1, …").

### Not done / open
- The perf test `validate-plan.test.ts › validates ~870 boxes quickly` failed once under full-suite load
  (4–9 ms alone, 50 ms bound; this plan adds no work to a plan without project cargo). It is flaky under load.
- The unplaced list's "fits in" hint only considers floors, not frame tops.
- The Delete-key refusal reads "Not placed — …" (the shared outcome wording).
