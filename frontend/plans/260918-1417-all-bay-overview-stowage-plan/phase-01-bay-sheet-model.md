# Phase 01 — Bay sheet model: odd-bay sections, facts, stack weights, legend

## Context links
- [plan.md](plan.md): decisions, conventions, sources
- `src/engine/slot-helpers.ts`: `bayPosition(bay, fortyBays)`, `isFortyBay`, `twentyBaysOf`, `parseSlotCode`
- `src/engine/validation-context.ts`: `buildValidationContext(vessel, plan)` → `columns` (stackKey → entries),
  `stacks` (stackKey → `StackSpec` with `max_weight_t`)
- `src/engine/stowage-model/*`: `buildStowageModel(vessel).slots` (key, bay, row, tier, deck, rect, areaId)
- `src/engine/playback-slice.ts`: `visiblePlacements`
- `src/lib/colors.ts`: `containerColor`, `podColorMap`, `weightColor` (0–30 t ramp), `TYPE_COLORS`
- `src/engine/breakbulk-overlap-check.ts`: `footprintRect`, `rectsOverlap`

## Overview
- **Priority:** high.
- **Status:** done (2026-09-18).
- Pure functions that turn (vessel, plan, report, playbackCount) into bay PAIRS (40' bay + its two odd
  sections), each with its cells, facts and stack weights, plus a colour legend. There is no UI in this phase.

## Key insights
- A 40' bay `b` has two sections: FORE `b − 1` (left, bow side) and AFT `b + 1` (right). Bays are numbered bow
  → stern, and the sheet is drawn bow → stern.
- Cell kinds in an odd section (key `row:tier`):
  - `twenty`: a 20' box stowed in this odd bay;
  - `forty`: a 40' box in the parent, drawn in the FORE section;
  - `fortyTail`: the same 40' box in the AFT section, drawn as "×";
  - absent: an empty position.
  All three kinds carry the `Container`, so hover, select and tooltips work on every cell of a box.
- Rows and tiers come from the 40' bay's `StackSpec`s (halves share their parent's stacks). Rows are in
  `vessel.rows` order, already port → starboard.
- **Stack weight = the rule's own number.** Build `buildValidationContext(vessel, visiblePlan)` once and read
  `columns`/`stacks` per (40' bay, row, deck): `weightT = Σ entries' weight`, `maxT = stack.max_weight_t`,
  `over = weightT > maxT + 1e-9` (the rule's tolerance). The same context means the same rounding and the same
  inclusion of both halves.
- **Free space in TEU:** per 40' cell, empty = 2 TEU; one 20' present = 1 TEU, but only if the model has a slot
  for the other half; a 40' = 0. TEU is the unit loading computers report.
- **Problems:** a violation's `slots` (slot codes) → `parseSlotCode` → `bayPosition` → its 40' pair; keep the
  worst severity. Project-cargo violations (no slots) belong to no bay.
- **Project cargo:** an item "sits in" pair `b` on a deck when its `footprintRect` overlaps, in x, the union of
  that bay's slot rects IN THE SAME AREA (on deck: weather deck; under deck: that hold).
- **Legend** depends on the colour mode. `pod` gives one entry per POD in rotation order, with colour and count
  of PLACED boxes. `type` gives one entry per type present, plus "IMDG" (red), with counts. `weight` gives the
  ramp's bands (e.g. 0–10, 10–20, 20–30+ t) with the colours `weightColor` returns at the band middle, and
  counts. The legend builder calls the SAME `containerColor`/`weightColor`, so a legend colour always equals a
  cell colour.

## Requirements
```ts
type CellKind = "twenty" | "forty" | "fortyTail";
interface SheetCell { kind: CellKind; box: Container }
interface OddSection { bay: number; cells: Map<string, SheetCell> }            // key `${row}:${tier}`
interface StackWeight { weightT: number; maxT: number; over: boolean }
interface BayPair {
  fortyBay: number;
  fore: OddSection; aft: OddSection;
  rows: number[];                                                             // port → starboard
  tiers: { on: number[]; under: number[] };                                  // descending
  hasStack: ReadonlySet<string>;                                             // `${deck}|${row}`
  stackWeights: Map<string, StackWeight>;                                    // `${deck}|${row}`
  facts: { n20: number; n40: number; weightT: number; freeTeu: number;
           worst: Severity | null; projectCargo: { on: string[]; under: string[] } };
}
bayPairs(vessel, plan, report | undefined, playbackCount): BayPair[]          // bow → stern
colorLegend(containers: readonly Container[], mode: ColorMode, pods): LegendEntry[]
```

## Related code files
- Create: `src/lib/bay-sheet/bay-pairs.ts` (sections and cells),
  `src/lib/bay-sheet/bay-pair-facts.ts` (counts, TEU, problems, project cargo, stack weights),
  `src/lib/bay-sheet/color-legend.ts`
- Create tests: `src/lib/bay-sheet/__tests__/bay-pairs.test.ts`, `bay-pair-facts.test.ts`, `color-legend.test.ts`

## Implementation steps
1. `bay-pairs.ts`: for each `vessel.bays` 40' bay, build rows, tiers and `hasStack` from its stacks, then place the
   visible placements: an odd slot bay → `bayPosition` → the pair's fore or aft section as `twenty`; an even slot
   bay → fore `forty` + aft `fortyTail` at the same row:tier.
2. `bay-pair-facts.ts`: n20/n40/weight (each box counted once), freeTeu, worst severity, project cargo, and
   stack weights from one validation context.
3. `color-legend.ts` as described.
4. Tests on the real demo plans (bbc-sao-paulo, demo-horizon) plus small fixtures:
   - **The 20' regression:** every placement appears; Σ(n20 + n40) = placements; every 20' box is in exactly
     one section; every 40' box appears exactly twice (forty + fortyTail).
   - Bay 21 → pair 22 fore, bay 23 → pair 22 aft.
   - For each stack, the weight equals the sum of its boxes, and `over` is true exactly for the stacks the report
     lists as `stack_weight` violations (checked against `validatePlan`).
   - freeTeu on a fixture: empty cell 2, one 20' 1, a 40' 0.
   - An overstow violation marks its pair `warning`; project-cargo-only violations mark no pair.
   - A demo blade on the hatch covers lists under `projectCargo.on` of the bays it spans, and no others.
   - `playbackCount = k` shows only the first k placements.
   - The legend: pod entries in rotation order with counts summing to the placed boxes; the weight bands'
     colours equal `containerColor` for a box of that weight.

## Todo list
- [x] `bay-pairs.ts`
- [x] `bay-pair-facts.ts` (stack weights from the validation context)
- [x] `color-legend.ts`
- [x] Tests incl. the 20' regression and rule parity for stack weight
- [x] `npx tsc --noEmit` + suite green

## Success criteria
- Every box is accounted for, the stack weights equal the engine's, and the legend colours equal the cell colours.

## Risk assessment
- **Halves with no parent** (`bayPosition` → null): count them in a test; this must be 0 on both demo ships.
- **Cost:** one validation context + one model pass per plan change; memoised in the views.
- **Ships with 40'-only bays** (no half slots): both sections are still drawn (40' and ×), and freeTeu only
  counts halves the model has.

## Security considerations
None.

## Next steps
Phase 02.
