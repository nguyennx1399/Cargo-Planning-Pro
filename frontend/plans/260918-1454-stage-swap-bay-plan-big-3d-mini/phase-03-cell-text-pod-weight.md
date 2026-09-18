# Phase 03 — POD + weight text in big cells

## Context links
- [phase-02](phase-02-big-bay-plan-overview-and-detail.md): detail at 28 px in the plan layout
- `src/features/bayplan/OddSectionGrid.tsx`: cell render (`--c` inline, `data-box`)
- `src/features/bayplan/SheetHighlight.tsx`: hover/select override `--c` via CSS
- `src/lib/colors.ts`: `containerColor` returns hex (POD palette, type, IMDG) or `hsl(...)` (weight ramp)

## Overview
- **Priority:** medium.
- **Status:** done (2026-09-18).
- When a cell is at least `TEXT_MIN_CELL_PX` (26 px), it prints two short lines: the POD (the 3-letter location
  part of the UN/LOCODE, e.g. `SGSIN` → `SIN`) and the weight (`22.2`). In practice that is the detail in the plan
  layout. Smaller cells are unchanged.

## Key insights
- **Which cells get text:** `twenty` and `forty` cells. A `fortyTail` keeps only its "×"; its text is in the fore
  cell, as on a printed plan (the data is written once).
- **Readable text colour:** a pure `readableInk(color)` returns dark or white from the relative luminance of the
  background. It parses `#rgb`/`#rrggbb` and `hsl(h, s%, l%)`, since the weight ramp is hsl. It is set per cell as
  `--t`. `SheetHighlight` also sets `--t: var(--ink) !important` with its highlight, because the highlight colours
  (white, yellow) are light.
- **The short POD is shown, the full one is in the tooltip.** The last 3 letters of a 5-letter UN/LOCODE are the
  location. If the code is not 5 letters, show it as is, truncated to 3.
- **Weight:** one decimal under 100 t, and no text-size tricks. The font is about 8.5 px at 28 px cells and the
  line height is tight; this is checked on screen.

## Requirements
- `src/lib/bay-sheet/cell-text.ts`: `shortPod(locode)`, `cellWeightText(t)`, `readableInk(color)`, plus tests.
- `OddSectionGrid`: when `cellPx >= TEXT_MIN_CELL_PX` and the cell is `twenty`/`forty`, render
  `<span class="sheet-cell-text">SIN<br/>22.2</span>` and set `--t`.
- CSS: `.sheet-cell-text { color: var(--t); font-size: 8.5px; line-height: 1.05; … centered; pointer-events: none }`.
- `SheetHighlight`: add `--t` to both rules.

## Related code files
- Create: `src/lib/bay-sheet/cell-text.ts`, `src/lib/bay-sheet/__tests__/cell-text.test.ts`
- Modify: `OddSectionGrid.tsx`, `SheetHighlight.tsx`, `bay-plan-sizes.ts` (`TEXT_MIN_CELL_PX`), `styles.css`

## Implementation steps
1. `cell-text.ts` + tests:
   - `SGSIN` → `SIN`, `XX` → `XX`;
   - 22.25 → "22.3" and 5 → "5.0";
   - dark ink on a light POD yellow, white ink on dark navy, white on `hsl(210,35%,32%)`, dark on
     `hsl(210,35%,82%)`.
2. Render in `OddSectionGrid`; the highlight rule gets `--t`.
3. `npx tsc --noEmit` + suite.
4. Browser, plan layout, both ships:
   - the detail cells show the POD and weight and are readable in all 3 colour modes (screenshots);
   - × cells show no text;
   - a hovered/selected cell's text stays readable;
   - the overview (14 px) and the compact views show no text.

## Todo list
- [x] `cell-text.ts` + tests
- [x] Cell text render + `--t` + highlight rule
- [x] `npx tsc --noEmit` + suite green
- [x] Browser screenshots, 3 colour modes

## Success criteria
- In the big detail view, each box reads like a SEACOS/printed cell (POD + weight) without hovering, in every
  colour mode.

## Risk assessment
- **Text crowding at 28 px:** if unreadable, raise the detail cell to 30–32 px (one constant) before touching fonts.
- **hsl parsing:** only the format `weightColor` emits is supported. Anything else falls back to dark ink, which
  the tests pin.

## Security considerations
None.

## Next steps
Close the plan. Possible follow-ups (not requested): a 3-way layout, a draggable divider, text in the 14 px
overview, and `frameloop="demand"` for the mini-view.
