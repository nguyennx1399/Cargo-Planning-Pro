# Phase 01 — Stage layout swap, canvas kept mounted

## Context links
- [plan.md](plan.md)
- `src/App.tsx`: `<main className="stage">` → `.viewport` (VesselScene, DropVerdictChip) + `.bayplan` (BayPlanView)
- `src/styles.css`: `.stage`, `.viewport`, `.bayplan`, `.viewport-armed::after`
- `src/store/usePlanStore.ts`: view state slice (`sidebarTab`, `showFreeSpace`, …)
- `src/features/viewer3d/DropVerdictChip.tsx`: the cursor chip inside `.viewport`

## Overview
- **Priority:** high.
- **Status:** done (2026-09-18).
- A store field `stageLayout: "3d" | "plan"`, a swap button, and CSS. In "plan", the bay plan fills the stage and
  `.viewport` becomes a fixed-size box in the bottom-right corner, with a click-to-swap-back overlay.

## Key insights
- **CSS-only swap:** keep the JSX order, add `stage-plan` to `.stage`:
  - `.stage-plan { grid-template-rows: 1fr; position: relative }`;
  - `.stage-plan .bayplan { grid-row: 1 }`;
  - `.stage-plan .viewport { position: absolute; right: 12px; bottom: 12px; width: 320px; height: 200px; z-index: 5 }`
    with a border and shadow.
  R3F sizes its canvas from its parent with a ResizeObserver, so the canvas follows with no remount and no camera
  reset.
- **Mini-view is look-only.** An overlay button covers it (`aria-label="Show the 3D view large"`), so a click
  swaps back instead of orbiting, selecting or dropping into a 320 px view. Drops still work through the bay
  plan, and the chip is hidden while mini.
- **Remember the choice:** read `localStorage` at store init and write on change, both in `try/catch` (private
  mode, previews, tests: no `window`). Key: `cpp.stageLayout`.
- **The swap button lives where the eye is:**
  - normal layout: top-left of the 3D view, "⇅ Bay plan view";
  - plan layout: the bay plan header, "⛴ 3D view", plus the mini-view overlay.
  One `StageSwapButton` component, placed twice.
- **Esc** keeps its current meaning (cancel the hand). No new shortcut (YAGNI).

## Requirements
- `usePlanStore`: `stageLayout`, `setStageLayout`, `toggleStageLayout`; persisted as above; the initial value
  comes from storage (default "3d"). Kept across vessel switches (like `sidebarTab`).
- `StageSwapButton.tsx`, and `MiniViewOverlay` (it can live in the same file).
- `App.tsx`: the stage class from the store; the overlay and button placed inside `.viewport`; the chip rendered
  only when `stageLayout === "3d"`.
- CSS as above. The bay plan in "plan" needs padding-top so it stays clear of the floating onboarding button.

## Related code files
- Modify: `src/store/usePlanStore.ts` (field + persistence helper; move the helper out if the store would pass
  200 lines), `src/App.tsx`, `src/styles.css`
- Create: `src/features/stage/StageSwapButton.tsx`, `src/store/stage-layout-storage.ts` (read/write with try/catch)
- Tests: `src/store/__tests__/stage-layout.test.ts` (default, toggle, survives `resetForVesselChange`, storage
  read/write, and storage throwing → still works)

## Implementation steps
1. The storage helper + store field + tests.
2. `StageSwapButton` + overlay; wire them in `App.tsx`; hide the chip when mini.
3. CSS for `.stage-plan`.
4. `npx tsc --noEmit` + suite.
5. Browser (1440 × 900):
   - toggle → the bay plan fills the stage, and 3D shows in the corner, rendering;
   - the canvas element is IDENTICAL before and after (keep a JS reference, compare), and the camera position is
     unchanged;
   - click the mini-view → back to normal;
   - reload → the layout is remembered;
   - the drop chip does not appear in mini;
   - normal layout: pixel sizes are unchanged from before (65/35).

## Todo list
- [x] Storage helper + store field + tests
- [x] `StageSwapButton` + mini overlay + App wiring
- [x] CSS
- [x] `npx tsc --noEmit` + suite green
- [x] Browser: no remount, swap both ways, persistence

## Success criteria
- One click swaps the stage and back, the 3D view keeps its camera and state, and the choice survives a reload.

## Risk assessment
- **R3F on a tiny canvas:** a 320 × 200 canvas is cheap. The frame loop keeps running, which is acceptable; if
  the fan spins, `frameloop="demand"` is a follow-up, not in scope.
- **Zoom-to-cursor / pan state:** untouched, because the canvas never remounts.

## Security considerations
`localStorage` holds only the layout name. Reads are validated against the two allowed values.

## Next steps
Phase 02.
