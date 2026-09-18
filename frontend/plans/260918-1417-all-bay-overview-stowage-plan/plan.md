# All-bay overview (SEACOS-style bay sheets) in the bottom panel

## Ask (user, 2026-09-18)

A stowage-planner screen in the bottom panel (where the bay plan is) that shows ALL bays, "mostly the
same feature as SEACOS". Plan carefully.

## What SEACOS / MACS3 does (research, 2026-09-18)

SEACOS is the Interschalt family (IS Seacos): the MACS3 loading computer and the StowMan[s] stowage
planner. Public sources confirm:
- multiple bay views with individual settings, and a longitudinal section / top view;
- containers coloured by a criterion (e.g. port of discharge), and text "information areas" per container;
- per-stack limits checked (stack weight), with results tables and statistics.
Screen-level details (exact layout, markings) are not public; the conventions below come from standard
printed bay plans, which these tools follow:
- **one section per 20' (odd) bay**, rows across, tiers up, deck above the hatch line and hold below;
- a **40' box occupies both odd bays** of its pair: drawn in the fore one, marked "×" in the aft one;
- rows: even numbers to port (left) … 00/01 … odd to starboard (right), viewed from aft. The app's
  `vessel.rows` is already in this order (`[10, 8 … 2, 1, 3 … 9]`);
- tiers: hold 02, 04 …; deck 82, 84 … (already the app's convention).

Sources: [MACS3](https://en.wikipedia.org/wiki/MACS3) ·
[Stowage plan for container ships](https://en.wikipedia.org/wiki/Stowage_plan_for_container_ships) ·
[Bay plan / slot identification](https://knowledgeofsea.com/container-vessel-stowage-plan-slot-identification/) ·
[IS Seacos Asia](https://splash247.com/is-seacos-asia-unveils-innovations-for-increasing-efficiency-and-safety/)

## Decisions (user, 2026-09-18, two rounds)

| Topic | Decision |
|---|---|
| Layout | Every bay's cross-section in one strip, bow → stern (a printed stowage-plan sheet). |
| 20'/40' | **Odd-bay sections (print style):** one section per 20' bay; a 40' box is drawn in the fore odd bay and marked × in the aft one. |
| Navigation | The overview is the panel default. Clicking a bay pair opens the single-bay view, which gets "← All bays". |
| Interaction | Full: hover/select sync with 3D, and with cargo in hand the valid cells are outlined in every bay and a click places it. |
| Cell content | Colour only (by the current colour mode) + tooltip. |
| Stack limits | Stack weight vs `max_weight_t` per stack, red when over. |
| Per bay | Count, weight, free space, problem mark → Check tab, project-cargo marker. |
| Extras | A colour legend for the current colour mode, with counts. (Zoom, deck filter and a resizable panel were not chosen.) |

## Where the code stands (verified)

- `features/bayplan/BayPlanView.tsx` (171 LOC) shows ONE 40' bay (`bayFilter`) or a hint; `BayPlanDeckBlock.tsx`
  draws one deck at `CELL_PX = 14`.
- **Bug the new model fixes:** the view keeps `p.slot.bay === bayFilter` (the even bay), but 20' boxes sit in
  ODD bays, so every 20' box is missing (the open "bay plan shows 0 containers" item). `bayPosition()` in
  `engine/slot-helpers.ts` is the mapping to use.
- Stack weight is judged per **40' stack** (both halves together) by `stackWeight` over
  `buildValidationContext(vessel, plan).columns`. The sheet reads the same context, so its numbers equal the
  rule's.
- Panel: `.stage` rows are `65% / 35%`, about 315 px tall. Odd-bay sections double the width: BBC SAO PAULO
  (9 × 40' bays → 18 sections) will scroll sideways. This was accepted with the choice.

## Phases

| # | Phase | Status | Priority |
|---|-------|--------|----------|
| 01 | [Bay sheet model: odd-bay sections, facts, stack weights, legend](phase-01-bay-sheet-model.md) | done | high |
| 02 | [Bay pair renderer + rebuilt single-bay view](phase-02-bay-pair-renderer-and-detail-view.md) | done | high |
| 03 | [Overview strip + legend + interaction](phase-03-overview-strip-legend-interaction.md) | done | high |

The order matters: 01 → 02 → 03. Phase 02 alone already fixes the missing 20' boxes.

## Ground rules

- **One model, two views.** The overview and the single-bay view both render `BayPair`s from the same pure
  model, so they cannot disagree.
- **One commit path.** A cell click with cargo in hand → `commitPlacement(landingSlotFor(...) ?? slot, "bayplan")`,
  unchanged. Valid cells come from `validSlotsFor` + `landingSlotsOnly`, the same set as the 3D layer.
- **The engine is the source of truth for limits.** Stack weights come from the validation context, and
  problem marks from the report. No second copy of any rule.
- Files under 200 LOC, node tests for every pure piece, `npx tsc --noEmit` (never `tsc -b`).

## Unresolved questions
1. The overview's stack-weight cells are about 10 px wide, too narrow for digits. The plan shows utilisation
   by colour there (numbers in the tooltip), and numbers in the single-bay view. Confirm, or ask for
   numbers in the overview (wider cells, more scrolling).
2. Where a 40' is drawn (fore odd bay) and marked × (aft odd bay) follows the print convention. If your
   SEACOS screen does it the other way round, it is a one-line switch in the model.

## Result (2026-09-18)

All 3 phases are done. The suite is 102 files / 815 tests (+22 tests), `tsc --noEmit` is clean, and every new file
is under 160 lines.

**Verified in the browser:**
- **BBC SAO PAULO:** 9 pairs; the footers sum to 110 = the status strip; bays 26/30/34 are loaded with a warning dot
  (overstow); the demo blades show PC bars on bays 06–22. Hovering a × lights both cells, and a click selects the
  40' in 3D and in the inspector.
- **Drill-in:** Bay 26 → the detail with stack tonnes and 3D filtered; "← All bays" → back with the scroll
  position kept (546 → 546).
- **20' placement:** 18 outlined cells, which is the sidebar's "18 valid positions". A click placed it at 010682:
  a 20' cell appears, and the footer reads `1×20' … 55 TEU free`.
- **40' placement:** the same row:tier is outlined in both sections. A click on the AFT (×) section placed it at
  bay 02; bay 34 went 35 → 34.
- **Problem dot** → the Check tab, without drilling in. The legend sums to the placed count in all 3 modes, and
  cells recolour with it.
- **MV Demo Horizon:** 10 pairs, footers = 486 = the status strip, 8 warning dots, the strip scrolls
  (2 533 / 1 112 px).

### Deviations from the phase files
- **Hover performance:** the first build re-rendered every cell on hover (Demo Horizon p90 ≈ 70 ms against 16 ms
  for the single-bay view). The plan's fallback was applied: `SheetHighlight` paints hover/selection with one CSS
  rule on `data-box`, and cards are memoised. The result is p90 ≈ 29 ms and median ≈ 10 ms.
- **Ship-wide tier axis** in the overview (not in the plan), so every hatch line is level across the sheet, as in
  print. The single-bay view keeps its own tiers.
- **Stack-weight rows** are drawn once, under the FORE section, with an equal-height spacer in the aft section. The
  plan said "spanning both sections"; that cannot align to rows.
- **The demo fill never places a 20' box**, so the regression tests add 3 hand-placed 20' boxes per demo plan (a
  guard test fails if that ever becomes vacuous).
- `BayPlanDeckBlock.tsx` was deleted (left unstaged). `IMDG_COLOR`, `weightColor` and `TYPE_COLORS` are now exported
  from `lib/colors.ts`.

### Open
- The sidebar's "N valid positions" can differ from the sheet by one for a MOVE: 10 against the sheet's 9 for
  DEMU0000145. The sheet shows the engine's gravity-projected set (the same set as the 3D placeholders). The
  sidebar count predates this plan.
- Orientation: the sheet runs bow → stern left → right, while the default 3D camera shows the bow on the right,
  so the two are mirrored. Flip the sheet if SEACOS draws stern → bow.
- The stack-weight display in the overview is a tint (numbers in the tooltip), per the unresolved question above.
