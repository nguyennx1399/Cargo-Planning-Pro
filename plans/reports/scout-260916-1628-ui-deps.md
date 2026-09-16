# UI / Dependency Recon — Cargo Planner Pro (drag-and-drop)

Scout report, 2026-09-16. Read-only recon.

## 1. `frontend/package.json` (42 LOC) — all deps verbatim

dependencies: `@base-ui/react` ^1.8.0 · `@react-three/drei` ^10.0.0 · `@react-three/fiber` ^9.0.0 ·
`@tanstack/react-query` ^5.59.0 · `class-variance-authority` ^0.7.1 · `cn` ^0.3.0 · `lucide-react` ^1.46.0 ·
`react` ^19.0.0 · `react-dom` ^19.0.0 · `shadcn` ^4.21.0 · `three` ^0.170.0 · `tw-animate-css` ^1.4.0 ·
`zustand` ^5.0.0

devDependencies: `@tailwindcss/vite` ^4.3.3 · `@types/node` ^20.19.43 · `@types/react` ^19.0.0 ·
`@types/react-dom` ^19.0.0 · `@types/three` ^0.170.0 · `@vitejs/plugin-react` ^4.3.0 ·
`@vitest/coverage-v8` ^5.0.0 · `tailwindcss` ^4.3.3 · `typescript` ^5.6.0 · `vite` ^6.0.0 · `vitest` ^3.2.7

scripts: `dev`=vite · `build`=tsc --noEmit && vite build · `typecheck`=tsc --noEmit · `preview`=vite preview ·
`test`=vitest run · `build:bbc-glb`=node scripts/build-bbc-sao-paulo-glb.mjs

**DnD libraries: NONE.** No dnd-kit, react-dnd, react-beautiful-dnd. No `draggable`/HTML5 DnD anywhere.
**Pointer-gesture lib: NOT DECLARED, but transitively present** — `@use-gesture/react` ^10.3.1 in
`frontend/package-lock.json:870`, pulled in by `@react-three/drei`. Usable only via drei; must be declared
explicitly to import directly.
Stack: React 19, R3F 9, drei 10, three 0.170, zustand 5, vitest 3.2.7, Vite 6, Tailwind 4, shadcn "base-nova"
(`frontend/components.json`).

## 2. `frontend/src/features/bayplan/BayPlanView.tsx` — 186 LOC (under 200 limit)
- Renders **DOM `div` cells in CSS Grid** — not canvas, not SVG. `CELL_PX = 14` fixed column width (line 11),
  shared by cells/row-labels/weight bars.
- Composes `DeckBlock` (on-deck + under-deck, split by `.bayplan-hatchline`) + `WeightDistribution` strip.
  Grid uses `gridTemplateColumns: repeat(${columns.length}, 14px)` (lines 148, 179, 98, 108).
- **slot→cell mapping:** one pass builds `containerAt: Map<"row:tier", Container>` from `visiblePlacements(...)`
  filtered by `p.slot.bay === s.bay` (lines 38-49, key written line 45); read back at line 159
  `containerAt.get(`${row}:${tier}`)`. Column basis = `bayRows` = vessel rows having a stack in this bay
  (lines 52-55), so both decks share alignment. Tiers sorted descending (line 156).
- **Pointer/drag handlers today: NONE.** Only `onMouseEnter`/`onMouseLeave` (lines 171-172) and `onClick`
  (line 173). No `onPointerDown`, `onDragStart`, `onDrop`, no `data-drop`. Line 17 carries
  `TODO(phase-2): drag & drop to move/swap containers -> POST /api/validate.`
- **Gap:** no slot-hover state here — `hoveredSlot` is set only by the 3D `EmptySlotPicker`. The 2D grid cannot
  currently resolve a drop target.

## 3. `frontend/src/features/panels/Sidebar.tsx` — 261 LOC (**EXCEEDS the 200-line modularization rule in `CLAUDE.md`**)
- **Lists:** (a) `Unplaced (n)` list, lines 211-230, from `plan.unplaced` (lines 82-85); (b) rule violations via
  `<SeverityAlertList items={report.violations.slice(0, 50)}>` lines 245-248; (c) static vessel/bay `Select`s and
  a `Checks` KPI `<dl>` (lines 232-252). No cargo catalogue / filter list.
- **Rendering:** each unplaced item is a plain `<div>` with `title` (lines 219-227) — no `<button>`, no `role`,
  no keyboard focus, no `draggable` attribute.
- **Draggable today: PARTIAL.** `onMouseDown={() => s.setDraggingContainer(c.id)}` at **line 222**; drag ends via
  a `window` `mouseup` listener (lines 76-81, deps lines 77/81). Dragging class `unplaced-item-dragging` line 221.
  Comments (lines 73-75, 202, 215) state drop does not commit — ghost preview only (E3-04b).
- Also owns Alt-free ArrowLeft/Right bay nav via window keydown (lines 62-72) — a competing global key handler to
  note when adding drag keys.

## 4. `frontend/src/App.tsx` — 101 LOC
- Layout: `.layout` grid `300px 1fr` (`styles.css:146`) → `<Sidebar>` + `<main className="stage">`; `.stage` is
  rows `minmax(220px,65%) minmax(160px,35%)` (`styles.css:147`) holding `.viewport` (`<VesselScene>`, line 91)
  above `.bayplan` (`<BayPlanView>`, line 94). So 3D and 2D are **stacked vertically**, not side-by-side.
- **No `DndContext`, no drag provider, no global pointer handling.** Only handler is the mode toggle `onClick`
  (line 65).
- Mode switch `demo` | `onboarding` (line 28); plan built in-memory via
  `buildLoadedDemoPlan`/`buildEmptyDemoPlan`/`withBreakbulkCargo` (lines 43-48) — no mutation/commit path exists,
  matching the "drop doesn't commit" state.

## 5. `frontend/src/styles.css` — 218 LOC
- **Approach: plain global CSS** (single file, imported once in `main.tsx:5`) **+ Tailwind v4** via
  `@import "tailwindcss"` (line 1), `tw-animate-css`, `shadcn/tailwind.css`, `@theme inline` tokens, `@layer base`.
  **Not CSS modules, not CSS-in-JS.** Tailwind utility classes are used inline in TSX (e.g. `Sidebar.tsx:96,156`);
  app-specific components use hand-written classes in this file.
- **Drag/cursor styling that exists:** `.unplaced-item { cursor: grab; user-select: none }` (line 176);
  `.unplaced-item-dragging { cursor: grabbing; border-color: var(--signal) }` (line 178);
  `.bayplan-cell { cursor: pointer }` (line 191); `.bayplan-cell-filled:hover { outline: 2px solid var(--ink) }`
  (line 195).
- **Missing:** no `.dragover`/drop-target/`.drop-allowed`/`.drop-blocked` classes, no `touch-action`, no
  `pointer-events: none` on overlays, no drag ghost/cursor-following element styling. `--signal` (#E0A030) and
  `--error` (#B83A2E) already exist (lines 90-91) and would fit allow/deny tinting.

## 6. Tests + runner
- **Runner: vitest ^3.2.7**, invoked `npm test` → `vitest run` (`package.json:11`). Coverage via
  `@vitest/coverage-v8`.
- **Config location: NONE.** No `vitest.config.ts` anywhere; `frontend/vite.config.ts` has no `test` key (only
  `react()`/`tailwindcss()` plugins, `@` alias, dev proxy to :8000). Vitest therefore runs on defaults —
  `environment: 'node'`, auto-includes `**/*.test.ts`.
- **No DOM capability:** `jsdom` and `happy-dom` appear only as **optional peerDependencies of vitest**
  (`frontend/package-lock.json:3646-3647, 3665-3670`) — not declared, not usable. `@testing-library/*` absent.
  Grep for `render(`/`fireEvent`/`userEvent`/`screen.`/`jsdom` across `frontend/src` hit **only `main.tsx`**
  (the real `createRoot` render). **Zero component/interaction tests exist.**
- **56 test files** (`find src -path '*__tests__*' -name '*.test.ts*'`, excluding 1 snapshot), all pure-logic
  `node` env. By dir: data 7, engine 16, engine/cargo 1, engine/hull 14, engine/vessel-components 5,
  engine/vessel-geometry 1, engine/vessel-onboarding 4, engine/vessel-spec 1, lib 6, store 1.
- Most DnD-relevant existing tests:
  - `frontend/src/store/__tests__/use-plan-store-playback.test.ts` — Zustand slice via `getState()`/`setState()`,
    no React render (the pattern any new drag-state test should copy).
  - `frontend/src/engine/__tests__/all-slots.test.ts` — `allSlots`/`emptySlots` expansion + occupied-slot
    exclusion (the drop-target set).
  - `frontend/src/engine/__tests__/slot-helpers.test.ts` — `parseSlotCode`/`slotCode`/`bayPosition`/
    `twentyBaysOf` round-trips, incl. 20' fore/aft half-bay mapping (needed for half-bay drop resolution).
  - `frontend/src/engine/__tests__/playback-slice.test.ts` — `visiblePlacements` windowing.
  - `frontend/src/lib/__tests__/geometry-characterization.test.ts` (+ `__snapshots__/`) — geometry snapshot lock;
    touching slot geometry will churn this.

## Bonus: pre-existing DnD scaffolding already built (E3-04a/E3-04b)
- **Store state already present:** `hoveredSlot: Slot | null` and `draggingContainerId: string | null` — declared
  `frontend/src/store/usePlanStore.ts:16-22`, setters lines 35-36, initial values lines 62-63, implementations
  lines 76-77, reset line 100-101. Store is view-state only (comment line 51);
  `TODO(phase-2): editable plan draft + undo/redo stack (zundo or custom history)` line 52.
- `frontend/src/features/viewer3d/GhostContainerPreview.tsx` (42 LOC) — translucent ghost mesh + `Edges`, rendered
  only while dragging; explicitly cancels on release (comment lines 11-17); `raycast={() => null}` so it doesn't
  block picking (line 36).
- `frontend/src/features/viewer3d/EmptySlotPicker.tsx` (60 LOC) — invisible `instancedMesh` over every empty slot,
  sets `hoveredSlot` via `onPointerMove`/`onPointerOut` (lines 45-49). Pick volume is sized to the **full grid
  pitch** (`DIM.len40 + LAYOUT.bayGap` × `LAYOUT.tierPitch` × `DIM.width + LAYOUT.rowGap`, line 56) so adjacent
  boxes tile with no dead zones → **raycasting already performs nearest-slot snapping** (comment lines 51-55).
- `frontend/src/engine/all-slots.ts` (25 LOC) — `allSlots(vessel)` from `vessel.stacks`,
  `emptySlots(vessel, placements)` minus occupied.
- `frontend/src/lib/geometry.ts:88` — `slotToPosition(vessel, slot)` returns `[bayCenterX, tierCenterY, rowCenterZ]`;
  `tierCenterY` (line 74) handles 20'/40' tier parity and real `container_layout` bases.
- Wiring: `frontend/src/features/viewer3d/VesselScene.tsx:51-52` mounts `EmptySlotPicker` then
  `GhostContainerPreview` inside the attitude group; `:31` `onPointerMissed` clears selection.
- Occupied-slot picking (3D): `frontend/src/features/viewer3d/ContainerInstances.tsx:106,116,120,121`.

## Bonus: an existing design decision that constrains the approach
`plans/260911-0945-p1-frontend-stowage-demo/phase-03-interactive-2d-bay-plan.md` (status **Pending**) already
specifies this exact feature:
- **"Pointer events, not HTML5 DnD:"** use pointer events + `document.elementFromPoint` with `data-drop`
  attributes so the HTML unplaced list and cells share one drop resolver (line 15). Also
  `usePointerDragAndDrop() → usePlanStore.drag {payloadId,x,y}` (line 43).
- One shared `pickedId` — click, drag, keyboard, 3D all resolve it; "drag-and-drop is sugar on top of
  pick-and-place" (line 14).
- Plans a **SVG rewrite** of `BayPlanView` (`BayPlanGrid`/`BayCell`, new `bay-plan-layout.ts` pure geometry +
  tests) and a **side-by-side layout** `.stage` columns `1fr minmax(420px, 38%)` with stacked fallback <1100px
  (line 13) — current CSS is stacked rows (`styles.css:147`).
- Cross-phase contract already agreed: unplaced-list root gets **`data-drop="unplaced"`** —
  `plans/260911-0945-p1-frontend-stowage-demo/phase-05-cargo-editing-panels.md:34`.
- 20' halves: pointer x within a cell picks fore/aft half; risk note prescribes a 20% mid-cell dead zone +
  snap to nearer half (lines 16, 82).

## Recommendation
No DnD library needs to be added, and the pre-existing plan says not to. Reusable infra (drag state, ghost,
snapping raycast, empty-slot set, slot→position) is already in place for the 3D path; the missing pieces are
(a) a pointer-events drag hook + `elementFromPoint`/`data-drop` drop resolver, (b) 2D cell `data-drop` attributes
and 2D slot-hover, (c) the commit/mutation path (store has no plan-draft slice), and (d) DOM test capability
(add `jsdom`/`happy-dom` + `@testing-library/react`, plus a vitest config) if interaction tests are required.

## Unresolved questions
1. Report filename mismatch: caller asked `scout-260916-1628-ui-deps.md`; SubagentStart hook mandates
   `Explore-260916-1628-{slug}.md`. Which wins?
2. Should DnD follow the existing pointer-events + `data-drop` plan, or is a library (dnd-kit) now preferred?
   The plan predates this request.
3. Is SVG-DOM rewrite of `BayPlanView` in scope, or do we keep the current `div` CSS-Grid cells?
4. `Sidebar.tsx` (261 LOC) already breaches the 200-line rule and owns the drag source — refactor before or during
   the DnD work?
5. Should drops commit locally (needs a plan-draft slice + undo/redo) or POST `/api/validate` per the
   `BayPlanView.tsx:17` TODO? `backend/` was not inspected.
6. Confirm the `@use-gesture/react` transitive (drei) path is acceptable vs. declaring it explicitly.
