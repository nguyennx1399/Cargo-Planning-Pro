# Phase 02 — Bay pair renderer + rebuilt single-bay view

## Context links
- [phase-01](phase-01-bay-sheet-model.md): `BayPair`, `SheetCell`, `StackWeight`
- `src/features/bayplan/BayPlanView.tsx`: today's detail view; its `onCellClick` = select, or
  `commitPlacement(landingSlotFor(vessel, plan, slot) ?? slot, "bayplan")`; `validKeys` from
  `landingSlotsOnly(validSlotsFor(...))`; the `dropOutcome` notice
- `src/features/bayplan/BayPlanDeckBlock.tsx`: today's per-deck grid (to be replaced)
- `src/lib/colors.ts`: `containerColor`, `HIGHLIGHT`
- `src/store/usePlanStore.ts`: `bayFilter`/`setBayFilter`, `activeContainerId`, hover/select

## Overview
- **Priority:** high.
- **Status:** done (2026-09-18).
- One component draws a `BayPair` (fore section | aft section, deck over hatch line over hold, stack-weight
  lines) at a caller-chosen cell size. The single-bay view is rebuilt on it. 20' boxes appear, and "← All bays"
  is added.

## Key insights
- **Cell visuals:**
  - `twenty` and `forty` are filled with `containerColor`;
  - `fortyTail` is the same colour at low opacity with a "×";
  - selected/hovered use `HIGHLIGHT` (every cell of that box lights up, including its ×);
  - a valid target is an outline, never a fill (as today).
- **Click → slot**, then the unchanged commit:
  - nothing in hand → select the cell's box (a × selects its 40' box);
  - a 20' in hand → `{ bay: section.bay (odd), row, tier }`;
  - a 40' in hand → `{ bay: pair.fortyBay, row, tier }`, whichever section was clicked.
- **Valid outline:** a 20' in hand outlines a cell when its odd key is valid; a 40' in hand outlines the same
  row:tier in BOTH sections when the 40' key is valid. The planner sees the whole 40' footprint.
- **Stack-weight line:**
  - one row of small cells per deck, aligned to the row columns;
  - on-deck stacks ABOVE the deck block, hold stacks BELOW the hold block, so each sits by its own stack;
  - drawn once per pair, spanning both sections, because the limit is per 40' stack.
  - Detail view (14 px cells): the number (t), red when over.
  - Overview (10 px): utilisation tint (≤ 80 % neutral, ≤ 100 % amber, > 100 % red), with "84.2 / 90 t" in the
    tooltip.
- **Labels:**
  - section headers are the odd bay numbers ("21", "23") under a pair bracket "22";
  - row labels under the hold block;
  - tier labels on the left of each section in the detail view only (the overview omits them to save width).

## Requirements
- `BayPairSheet.tsx` props: `pair`, `cellPx`, `showNumbers` (the stack-weight digits), `showTierLabels`, and
  the interaction bundle (`hoveredId`, `selectedId`, `setHovered`, `validKeys`, `onCellClick`, `colorMode`,
  `pods`).
- `OddSectionGrid.tsx`: one section, both decks; `StackWeightRow.tsx`: one deck's stack line.
- Detail view: `BayPairSheet` at `cellPx = 14` with numbers and tier labels, plus the existing
  weight-by-row strip (now fed from the pair, so 20' weights count), plus the header
  `← All bays · Bay 22 (21 | 23) · 12 × 20', 8 × 40' · 184 t · 20 TEU free`.
- Shared hook `use-bay-plan-interaction.ts`: `validKeys`, `onCellClick(section, pair, row, tier, cell)`, and
  the bay-plan drop-outcome notice. The overview uses it in phase 03.

## Related code files
- Create: `src/features/bayplan/BayPairSheet.tsx`, `OddSectionGrid.tsx`, `StackWeightRow.tsx`,
  `use-bay-plan-interaction.ts`
- Modify: `BayPlanView.tsx` (detail on `BayPairSheet`, header, "← All bays"; the null branch keeps the hint
  until phase 03)
- Delete: `BayPlanDeckBlock.tsx`, once nothing imports it
- CSS: `.sheet-*` classes; the × via a CSS pseudo-element or an inline SVG, sized to `cellPx`

## Implementation steps
1. The interaction hook, lifted from `BayPlanView` with the half-aware slot mapping above.
2. `OddSectionGrid` and `StackWeightRow`, then `BayPairSheet` composing them.
3. Rebuild the detail view on it; delete `BayPlanDeckBlock.tsx`.
4. Unit-test the pure part of the interaction (cell → slot for 20'/40'/nothing in hand; valid-key lookup for both
   sections) in `__tests__/bay-cell-target.test.ts`, keeping that logic in a pure `bay-cell-target.ts`.
5. `npx tsc --noEmit` + suite.
6. Browser, demo-horizon (it has 20' and 40'):
   - open a bay → its 20' boxes appear in their odd sections, 40' boxes in the fore section with × aft;
   - the header count equals the 3D count for that bay;
   - hover a × → the 40' box highlights in 3D; click → it is selected;
   - with a 20' in hand, one odd cell is outlined, and a click places it there;
   - with a 40' in hand, both sections are outlined at the same row:tier, and a click places it;
   - stack-weight numbers match the Check tab's stack_weight messages, and an over-limit stack is red.

## Todo list
- [x] `bay-cell-target.ts` + tests
- [x] Interaction hook
- [x] `OddSectionGrid`, `StackWeightRow`, `BayPairSheet`
- [x] Detail view rebuilt; `BayPlanDeckBlock.tsx` deleted
- [x] `npx tsc --noEmit` + suite green
- [x] Browser checks on demo-horizon

## Success criteria
- The single-bay view shows every box, 20' included, in print-style odd sections, with stack weights that equal
  the engine's.
- 20' and 40' boxes can both be placed from it.

## Risk assessment
- **Selecting via × must not confuse placing:** with a 40' in hand, a click on either section places, and with
  nothing in hand it selects. This is the same rule in both sections, pinned by the `bay-cell-target` tests.
- **Weight-by-row strip:** it now includes 20' weights, so its numbers will change, correctly. Note it in the
  report.

## Security considerations
None.

## Next steps
Phase 03.
