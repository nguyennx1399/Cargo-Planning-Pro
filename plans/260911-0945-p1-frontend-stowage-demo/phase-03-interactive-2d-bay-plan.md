# Phase 03 — Interactive 2D bay plan (move / swap / drag & drop)

## Context links
- Plan: [plan.md](plan.md) · Depends on [phase-02](phase-02-plan-draft-store-history-auto-stow.md)
- Current: `src/features/bayplan/BayPlanView.tsx` (placeholder), `docs/design-guidelines.md` §2D Bay Plan
- Source principle: "2D để làm, 3D để hiểu" (the 2D view is the main working surface)

## Overview
- **Priority:** P0 (core of "cargo adjustment") · **Size:** L · **Status:** Pending
- A real SVG cross-section per 40' bay. Select, pick-and-place, drag-and-drop, swap and unload, with a live "what would break" preview.

## Key insights
- **Layout:** a 180 px bottom strip can't fit 10 rows × 7 tiers. Put the bay plan to the right of the 3D view instead (`.stage` columns `1fr minmax(420px, 38%)`), with a stacked fallback below 1100 px.
- **One placement mechanism:** a shared `pickedId`. Click, drag, keyboard and 3D (Phase 04) all set and resolve it. Drag-and-drop is sugar on top of pick-and-place.
- **Pointer events, not HTML5 DnD:** HTML5 drag-and-drop doesn't mix HTML and SVG well. Use pointer events plus `document.elementFromPoint` with `data-drop` attributes, so the unplaced list (HTML) and the SVG cells share one drop resolver.
- **20' halves:** each cell renders as one 40' box or two 20' halves (fore on the left = odd bay b−1, aft on the right = b+1). When a 20' is dropped, the pointer x within the cell picks the half.

## Requirements
**Functional**
- **Bay navigator:** prev/next buttons, `[` and `]` keys, and a bay strip of 10 small buttons showing fill % and a red dot if the bay has errors. Default bay: 02.
- **SVG grid:**
  - On-deck block above a hatch line, under-deck block below.
  - Row labels in port→stbd order (`10 08 … 01 … 09`), tier labels 82/84/86 and 08…02.
  - Cells that don't exist are not drawn. Empty cells are outlined. Reefer-plug cells get a small plug glyph.
  - Box fill uses the same color mode as 3D (`containerColor`). Selected is yellow, hovered is white, cells in an error violation get a red outline.
- **Interactions:**
  - Click a box to select it; the 3D view and sidebar sync.
  - `M` or double-click a box to pick it. While picked, empty target cells tint green (allowed) or red (would add hard errors).
  - Click a target cell to move. Click a same-size box to swap. `Esc` cancels.
  - Drag a box onto a cell to move or swap. Drag it onto the unplaced list to unload. Drag an unplaced item onto a cell to load.
  - `Delete` unloads the selected box.
  - A blocked drop shows a toast with the `ActionResult.reason`.
- **Hover preview:** while picked, hovering a target runs `validatePlan` on the hypothetical draft. A tooltip shows the violations it would add (e.g. "+ stack_weight: 82 t > 75 t").

**Non-functional**
- The hover preview takes ≤ 16 ms (reuse the engine; run only when the hovered cell changes).
- Keyboard-only is possible: Tab through boxes, Enter to pick, arrow keys to move the target cursor, Enter to drop.

## Architecture
```
BayPlanView ─ BayNavigator (strip + prev/next)
           └─ BayPlanGrid (SVG, viewBox scales) ─ BayCell × n  [data-drop="cell" data-bay data-row data-tier]
usePointerDragAndDrop()  → usePlanStore.drag {payloadId, x, y}; on pointerup: resolveDropTarget(el) → store action
useMovePreview(pickedId, hoverTarget) → diff(validate(hypo), current) → PreviewTooltip
ToastHost (global, tiny) ← ActionResult.reason
```

## Related code files
- **Create:**
  - `src/features/bayplan/BayNavigator.tsx`, `BayPlanGrid.tsx`, `BayCell.tsx`
  - `src/features/bayplan/bay-plan-layout.ts` (cell geometry, pure)
  - `src/hooks/usePointerDragAndDrop.ts`, `src/hooks/useMovePreview.ts`
  - `src/features/common/ToastHost.tsx`, `src/store/useToastStore.ts`
- **Modify:** `BayPlanView.tsx` (rewrite), `usePlanStore.ts` (add `pickedId`, `drag`, `hoverTarget`; `bayFilter` default 2), `styles.css` (stage layout, bay plan), `useKeyboardShortcuts.ts`.
- **File ownership (parallel run):** `features/bayplan/**`, `features/common/**`, the hooks above, `styles.css`. Phase 05 owns the sidebar panels; the unplaced list only needs a `data-drop="unplaced"` attribute on its root (agreed contract).

## Implementation steps
1. Update the layout CSS so the stage is side-by-side.
2. `bay-plan-layout.ts`: map vessel + bay to cell rects and half rects, with tests.
3. `BayPlanGrid` + `BayCell` read-only rendering, with selection/hover sync.
4. Pick-and-place via clicks and the store actions, plus toasts.
5. Pointer drag-and-drop hook plus the drop resolver (cells and the unplaced list).
6. Move preview + target tinting.
7. Bay navigator with fill %/error dots, and keyboard navigation.

## Todo
- [ ] side-by-side layout
- [ ] layout math + tests
- [ ] SVG grid render + sync
- [ ] pick & place + toasts
- [ ] drag & drop (cells ↔ unplaced list)
- [ ] hover preview
- [ ] navigator + keyboard

## Success criteria
- Demo script steps 2–5 can be done entirely in 2D.
- Every blocked action shows a reason.
- The target cursor and the preview never lag visibly (≤ 16 ms per hover change).

## Risks
- SVG with ~100 cells per bay is fine. Don't render all bays at once.
- Drop ambiguity at half boundaries → use a 20% dead zone in the middle and snap to the nearer half.

## Security
N/A (client-only).

## Next
Phase 07 checks the demo script end to end.
