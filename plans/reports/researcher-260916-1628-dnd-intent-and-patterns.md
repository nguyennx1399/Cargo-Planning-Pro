# Research — Drag-and-drop cargo onto valid stowage placeholders (intent + patterns)

Date: 2026-09-16 · Scope: Part A repo intent, Part B technical patterns · Read-only

## Headline

**The pick/raycast half of this feature already exists and is wired into the scene.** What is
missing is (a) a mutable plan draft with `move`/`load` actions to commit into, and (b) the drop
resolver + snap + commit step. The feature is not greenfield — it is the last 2 of 4 pieces of an
entry the codebase calls `E3-04`.

---

## PART A — Project intent

### A1. What the docs say

**Feature is explicitly scheduled in Phase 2 (manual editor).**

- `docs/PLAN.md:37` — `- [ ] Move/swap container (2D drag first; 3D drag optional)`
- `docs/PLAN.md:44` — Phase 2 exit: *"a planner can fix a plan by hand and see every rule broken in real time."*
- `docs/PLAN.md:41` — `- [ ] Plan versioning (undo/redo on frontend, saved versions in DB)`
- `docs/project-roadmap.md:14` — Phase 2 row: `Manual editor + validation | 3–4 wk | Partially started (rule engine) | ~25%`
- `docs/project-roadmap.md:54` — `- [ ] Move/swap containers; debounced live validation`
- `docs/project-roadmap.md:55` — `- [ ] Undo/redo; PostgreSQL + plan versions`
- `docs/project-overview-pdr.md:47` — `| F6 | Move/swap containers in editor | 2 | ○ Stub |`
- `docs/project-overview-pdr.md:87` — Phase 2 exit: `Planner fixes plan by hand; violations shown real-time; export BAPLIE`
- `docs/PLAN.md:4-6` and `docs/project-overview-pdr.md:104` — Key decision, binding:
  **"validator before optimizer"** — *"Anything the solver produces must pass the same rule engine a human plan passes."*
- `docs/ARCHITECTURE.md` (Solver contract) — *"Every solver output goes through `validation.engine.validate(plan)` before returning."*
- `docs/codebase-summary.md:144-148` — "Manual Edit (Phase 2, **Stub**)" data flow: user drags → debounce → `POST /api/validate` → violations in Sidebar.
- `docs/codebase-summary.md:177` — Phase 2 stubs: `BAPLIE import/export; drag edit; undo/redo; PostgreSQL; plan versioning`

**Placement UX intent, already decided:**

- `docs/design-guidelines.md:195` — `- Drag-and-drop container move` (listed under 2D bay plan "Future enhancements (phase 1–2)")
- `docs/design-guidelines.md:335` — open question *"**Drag-and-drop:** Phase 1 (keyboard-only) or phase 2 (mouse support)?"*
- `docs/DOMAIN.md:19-28` — the 7 target hard constraints a drop must respect; `#6 No floating container (must be supported below)` is the one most likely to bite a DnD drop.

**Perf constraint that shapes the design:**

- `docs/project-overview-pdr.md:62` — `NF1 | 3D render performance | 20k containers @ 60fps | InstancedMesh per size`
- `docs/project-overview-pdr.md:105` — Key decision 2: *"One `InstancedMesh` per container size … one draw call each"*
- `docs/project-overview-pdr.md:63` — `NF2 | Validation latency | <100ms per check | debounce on edit`

### A2. Plans inventory

| Plan dir | Covers drag/placement? | Status |
|---|---|---|
| `plans/260911-0939-cargo-planner-v2-roadmap/` | Phase 2 = "Manual stow, rule engine, approx stability" — the umbrella. **`phase-02-manual-stowage-rules-approx-stability.md` is a DANGLING LINK** — referenced by `phase-01` context links, never written (dir has only phase-00, phase-01, plan.md, reference doc). | Umbrella only; phase-02 file absent |
| `plans/260911-0945-p1-frontend-stowage-demo/` | **YES — this is the relevant one.** `phase-02` = plan draft store + `move`/`swap`/`load`/`unload` actions + undo/redo. `phase-03` = 2D bay plan **drag & drop**. `phase-04` = 3D click-to-move + `TargetSlots`. | phase-01 6/8 done; **phase-02 0/6, phase-03 0/7, phase-04 0/7 → not started** |
| `plans/260911-1409-vessel-3d-model-pipeline/` | No (hull/geometry) | — |
| `plans/260911-1945-preview-cargo-below-deck/`, `260911-1955-cargo-loading-sequence-playback/`, `260912-0117-cargo-type-catalog-breakbulk/`, `260916-1514-find-bbc-sao-paulo-hydrostatic-data/` | No | — |

**Phase-03 already decided the mechanism** (`phase-03-interactive-2d-bay-plan.md:14-16`), quote:

- *"**One placement mechanism:** a shared `pickedId`. Click, drag, keyboard and 3D (Phase 04) all set and resolve it. Drag-and-drop is sugar on top of pick-and-place."*
- *"**Pointer events, not HTML5 DnD:** HTML5 drag-and-drop doesn't mix HTML and SVG well. Use pointer events plus `document.elementFromPoint` with `data-drop` attributes, so the unplaced list (HTML) and the SVG cells share one drop resolver."*
- Acceptance item `phase-03:71` — `- [ ] drag & drop (cells ↔ unplaced list)`; risk `phase-03:82` — *"Drop ambiguity at half boundaries → use a 20% dead zone in the middle and snap to the nearer half."*

⚠️ **Checkbox caveat:** the demo plan's todos are **stale, not authoritative**. `phase-06` (stability/attitude) shows 0/6 yet `lib/use-indicative-stability.ts`, `engine/stability-indicative.ts`, `StabilityPanel.tsx`, `ShipAttitudeDriver.tsx` all exist and are tested. Verify actual state in code before treating any box as truth.

### A3. Known gaps this closes / constraints that conflict

**Gaps closed:**
- `docs/project-roadmap.md:83-87` "Known Gaps" — none are *this* feature (they are solve-not-validated, greedy ignores rules, no persistence). The relevant gap is the PDR stub row F6 and `codebase-summary.md:177` (`drag edit`).
- Frontend capability gap: `App.tsx:45-50` computes `plan` in a `useMemo` from `buildLoadedDemoPlan`/`withBreakbulkCargo`. **There is no plan mutation path at all** — `usePlanStore` is view state only (`usePlanStore.ts:52`: `// TODO(phase-2): editable plan draft + undo/redo stack`). Drag-and-drop has nothing to commit into until `usePlanDraftStore` (demo-plan `phase-02`) exists. **This is a hard prerequisite, not a parallel task.**

**Constraints that conflict / must be honored:**
1. **Validator-first** — a drop must run the same predicates as the engine, not invent a UI-only "can drop" check. Reuse `engine/placement-checks.ts` (`sizeFitsBay`, `plugOk`, `teuOf`, `tierBelow`) and `engine/validate-plan.ts` (`validatePlan(vessel, plan)` is already called in `App.tsx:51` per render).
2. **InstancedMesh strategy** — drop resolution must map `instanceId → slot` per mesh. `ContainerInstances.tsx:26-28` uses **ONE** InstancedMesh for all sizes (matrix-scaled per instance), not one per size as `ARCHITECTURE.md`/PDR claim — so occupied-slot resolution lives on one mesh; empty slots live on `EmptySlotPicker`. Two meshes, two id maps, one resolver.
3. **Perf budget** — pick volume must stay instanced (it is), and `usePlanStore` reads must use selectors/`useShallow` (`ContainerInstances.tsx:26`, `GhostContainerPreview.tsx:19` already do).
4. **Safety framing** — decision support only; `docs/project-overview-pdr.md:71` requires the "Verify on approved loading computer" notice (demo badge exists via `DemoDataBadge` intent).

### A4. What already exists in code (the E3-04 trail)

`E3-04a..d` exists **only in code comments** — no plan file in `plans/` references it (grep across `docs/`, `plans/`, `.claude/` returns code comments only). Treat it as an off-disk epic; the authoritative plan is demo-plan `phase-03`/`phase-04`.

- `E3-04a` **DONE** — `features/viewer3d/EmptySlotPicker.tsx`: invisible instanced pick mesh over every empty slot. Key detail (line 51-56): pick box is sized to the full grid **pitch** (`DIM.len40 + LAYOUT.bayGap` × `LAYOUT.tierPitch` × `DIM.width + LAYOUT.rowGap`) so boxes tile with **zero dead zones** — *"raycasting itself does nearest-slot snapping (E3-04c): any pointer position over the ship's slot grid resolves to some slot, never a miss in a gap."* `onPointerMove` → `setHoveredSlot`.
- `E3-04b` **PARTIAL** — `features/viewer3d/GhostContainerPreview.tsx`: translucent ghost at `hoveredSlot` while `draggingContainerId` is set. `Sidebar.tsx:219` sets the drag on `onMouseDown`; `Sidebar.tsx:73-82` clears it on window `mouseup`. `Sidebar.tsx:215` tells the user: *"Drag onto the hull to preview a slot. Drop doesn't place it yet (E3-04c/d)."* — **mouseup just cancels.**
- `E3-04c` **NOT DONE** — snap. (Raycast snapping is arguably already free from the pitch-sized pick volume.)
- `E3-04d` **NOT DONE** — commit the placement.
- Store already has the slots for it: `hoveredSlot`, `draggingContainerId`, `setHoveredSlot`, `setDraggingContainer` (`store/usePlanStore.ts:16-22, 35-36`).
- Supporting pure modules already exist: `engine/all-slots.ts` (`allSlots`, `emptySlots`), `engine/placement-checks.ts`.
- Scene wiring done: `VesselScene.tsx:49-52` renders `ContainerInstances` + `EmptySlotPicker` + `GhostContainerPreview`.

**Consequences for the plan:**
- The empty-slot pick box is 40'-pitch sized. For a **20' target in an odd bay** the pick volume overshoots ±~0.6 m into neighbouring bays → needs a size-aware pick volume (or accept pitch snapping + `sizeFitsBay` rejection in the ghost tint).
- **No drop target for swap.** `EmptySlotPicker` covers *empty* slots only. Dropping onto an *occupied* slot (swap) must resolve via `ContainerInstances`' `instanceId` → placement — and its hover currently sets `hoveredId`, not a slot. Two different hover channels must be unified in the resolver.
- **Touch/keyboard absent.** The only drag origin is `onMouseDown` (`Sidebar.tsx:219`). Given `design-guidelines.md:335`, pick-and-place (`pickedId`) is the accessibility answer, and demo-plan `phase-03:37` already designs it: *"Keyboard-only is possible: Tab through boxes, Enter to pick, arrow keys to move the target cursor, Enter to drop."*

---

## PART B — Technical patterns

### B4. R3F drag-and-drop approaches

**(a) drei `DragControls` / `useDrag` / `<Select>` — version status verified against locked version.**

Checked the installed range (`frontend/package.json:16` → `@react-three/drei ^10.0.0`) against npm/unpkg for **10.7.8**:

- **`useDrag` does NOT exist in drei 10.** Verified authoritatively: `@react-three/drei@10.7.8` has exactly three drag files (`/web/DragControls.{js,cjs.js,d.ts}`) and `useDrag` is present in **0** package files. There is no drei `useDrag` export in `web/index.d.ts` and no `useDrag.d.ts`. No deprecation shim — it is simply gone from the public surface (it was the old hook API in drei 8/9; the site docs page no longer exists). If you see `useDrag` in a tutorial, it is `@use-gesture/react`'s own hook (a separate dep) or a pre-v9 drei snippet.
- **`DragControls` exists but is a poor fit here.** Its prop surface is `{autoTransform, matrix, axisLock, dragLimits, onHover, onDragStart, onDrag, onDragEnd, children, dragConfig}` (`DragControlsProps`). Gotchas: (i) it drives **one `THREE.Matrix4` / one group** — no InstancedMesh, no per-instance target, so it cannot address "thousands of slots"; (ii) it moves objects **freely in a camera-facing drag plane** (`onDrag(localMatrix, deltaLocalMatrix, worldMatrix, deltaWorldMatrix)`) — no snapping, so you would raycast anyway and inherit dead code; (iii) it mutates `defaultControls.enabled = false` on drag start (fine — you want OrbitControls off) but that is the only thing you actually need from it.
- **`<Select>` / `useSelect()`** — present and maintained (`/web/Select.{js,d.ts}`), but it is **selection**, not dragging: `{multiple, box, border, backgroundColor, onChange, onChangePointerUp, filter}`. Uses `SelectionBox` + temporary DOM listeners, disables `events.enabled` and `controls.enabled` while box-selecting. Useful later for the "select a group of slots" case; irrelevant to a single-cargo drop.

**(b) Plain pointer events + raycasting on placeholder meshes — the fit.** Maturity: highest — this is *the* idiom R3F is built around and the maintainer (drcmda) actively recommends it over hand-rolled DOM listeners ("all it can do is waste cpu and create race conditions"), suggesting an **invisible mesh as hit area** rather than custom `addEventListener`. Gotchas: (i) pointer capture (`e.target.setPointerCapture(e.pointerId)`) is needed when the pointer leaves the mesh/window mid-drag — **note the project currently uses a `window` `mouseup` listener instead** (`Sidebar.tsx:73-82`), which works because the drag *starts* in the DOM sidebar; (ii) only meshes with handlers are raycast ("it only raycasts stuff that has actual handlers on them"); (iii) normalize with `gl.domElement.getBoundingClientRect()`, **not** `window.innerWidth/innerHeight` — the latter is a documented source of cursor drift, and it matters most when the drop coordinate originates from a DOM drag outside the canvas; (iv) `stopPropagation` on the nearest hit when multiple meshes overlap.

**(c) HTML5 drag events from a DOM sidebar onto the canvas.** Maturity: works, but worst fit. Gotchas: (i) HTML5 DnD is **mouse/pen only — `drag*` events never fire for touch on Chrome/Firefox/Safari**; (ii) `DataTransfer` lifecycle quirks (you can't read data on `dragover`, only `drop`); (iii) no `dragover` → no per-slot live preview unless you also handle `dragover` and raycast on each fire, which fires continuously; (iv) it does not compose with pointer events, so you'd maintain two input paths. The project independently reached this conclusion for the 2D SVG case (`phase-03:15`: *"HTML5 drag-and-drop doesn't mix HTML and SVG well"*) — the same reasoning applies with more force to canvas.

**Fit for "drop onto a small target slot among thousands" — (b) wins decisively**, and the repo already implements it. The `EmptySlotPicker` pitch-sized pick volume (B4 above) means **raycast *is* the snapping algorithm**: no cheap "nearest slot" post-processing needed, and cost is one instanced raycast regardless of camera angle.

### B5. Library or custom pointers?

**Recommendation: no DnD library. Custom pointer handling, continuing the `E3-04` path.**

Reasoning:
1. **Both candidates are DOM-centric by construction.** `dnd-kit` is a Pointer-Events implementation whose collision detection intersects **cached `getBoundingClientRect()` of registered DOM droppables** — a canvas has no droppable elements to register. `react-dnd` wraps **HTML5 DnD**, which B4(c) rules out (no touch, no SVG mixing).
2. **The canvas owns the coordinates and the engine owns hit-testing.** This is the standard conclusion for canvas/WebGL editors: *"For canvas-style apps, no off-the-shelf drag library covers the load-bearing path. The renderer owns coordinates, the engine owns hit-testing, and you reach for a library only on the chrome."* Figma is the canonical example — custom hit-testing against the scene graph rather than `elementFromPoint`.
3. **Known dnd-kit-over-canvas bug** ([issue #1897](https://github.com/clauderic/dnd-kit/issues/1897)): dnd-kit forces `position: fixed !important` and `pointer-events: none !important` during drag; after `onDragEnd` there is a window where `pointer-events` remain `none` and events fall through to the canvas layer, breaking rapid re-drags. Workaround is disabling the drop animation — extra risk for zero benefit.
4. **Adds a dependency to a bundle already carrying three.js.** dnd-kit core is ~14 kB gzip; the whole drop path here is one `useEffect` + one `instanceId` lookup.
5. **YAGNI/KISS/DRY:** the hard parts (empty-slot discovery, zero-dead-zone pick volume, ghost preview, reuse of `placement-checks`) are already written and tested. A library would replace none of it.

**Where a library *would* earn its place:** sortable DOM chrome only — e.g. reordering the Unplaced list, or the eventual multi-select/layer panels. Keep that door open; do not introduce it for the 3D drop.

**Binding accessibility note (affects scope):** **WCAG 2.5.7 "Dragging Movements" (AA, WCAG 2.2)** requires every drag operation to also be achievable with a **single pointer without dragging**. A keyboard-only alternative does **not** satisfy it — you need both 2.5.7 (click-to-move / move menu) and 2.1.1 (keyboard). The repo already has the right shape for this: `pickedId` pick-and-place is the primary mechanism and drag is "sugar on top of it" (`phase-03:14`). Ship click-to-move **first**; drag becomes an additive gesture.

---

## Recommended shape (for the planner)

Prereq: `usePlanDraftStore` (demo-plan `phase-02`) with `move`/`swap`/`load`/`unload` returning `ActionResult = {ok:true} | {ok:false, reason}`.

Then, per repo convention (one placement mechanism, `pickedId`):
1. Unify the hover channel — occupied (`ContainerInstances.instanceId` → placement) **and** empty (`EmptySlotPicker.instanceId` → slot) resolve to one `hoverTarget` (`{slot, occupantId|null}`).
2. Make the empty pick volume size-aware (20' vs 40' pitch) so odd-bay 20' targets don't bleed into neighbours.
3. Tint the ghost green/red from `placement-checks` predicates (`sizeFitsBay`, `plugOk`, `tierBelow` for support) — never a UI-only rule.
4. On `pointerup`: call the store action; on `ok:false` toast the `reason` (matches `phase-03:32`). Do not skip the validator.
5. Keep `draggingContainerId` mouse-based; add `pickedId` click/keyboard path for WCAG 2.5.7 in the same pass (cheaper than retrofitting).

## Unresolved questions

1. **Where does the plan draft live** — is demo-plan `phase-02` to be executed first as its own step, or folded into this feature? Without it there is no commit target. (Also: `App.tsx:45-50` derives `plan` in a `useMemo` — that wiring must move to the store.)
2. **Does the drop validate server-side** (`POST /api/validate`, per `codebase-summary.md:144-148`) or client-side only? Current app is frontend-only (`App.tsx:51` calls `validatePlan` locally); backend TS/Python rule parity is itself an open item (`p1-frontend-stowage-demo/plan.md` open Q3).
3. **Scope of the drop**: unplaced→empty only, or also move/swap/unload? `phase-02` defines all four; `EmptySlotPicker` supports only the empty-slot half.
4. **Is `E3-04` an abandoned off-disk epic?** Its `a/b` are done and `c/d` are the remaining work, but no plan file owns it. Somebody must adopt it into a plan or it will drift. Confirm with the user which plan dir should own this feature.
5. **`docs/ARCHITECTURE.md` vs code divergence**: the doc's key decision says "One `InstancedMesh` per container size"; `ContainerInstances.tsx:26-28` uses one mesh for all sizes. Decide which is authoritative before writing a resolver against it.
6. Two live plan dirs claim overlapping ground (`v2-roadmap` phase-02 dangling vs `p1-frontend-stowage-demo` phase-02/03/04). Which is the source of truth?
7. Perf gate: no measured figure for "20k instances @ 60fps" exists (`project-roadmap.md:44` unchecked) — does the drop resolver need a budget test, or defer to the existing perf gate?

## Sources

- [dnd-kit issue #1897 — pointer events pass through after dragEnd](https://github.com/clauderic/dnd-kit/issues/1897)
- [dnd-kit — Configuring Sensors](https://dndkit.com/react/guides/sensors/)
- [Design a Drag and Drop System (canvas hit-testing)](https://sujeet.pro/articles/design-drag-drop-system)
- [Library guide — drag-and-drop (2025 landscape, WCAG 2.5.7)](https://github.com/ancoleman/ai-design-components/blob/main/skills/implementing-drag-drop/references/library-guide.md)
- [three.js forum — pointer events, invisible hit areas, pointer capture](https://discourse.threejs.org/t/pointer-events-2023/57861/2)
- [three.js forum — moving a mesh in canvas](https://discourse.threejs.org/t/moving-mesh-in-canvas/74478/2)
- [Stack Overflow — raycast coordinate normalization vs canvas rect](https://stackoverflow.com/questions/73836180/react-three-fiber-raycast-on-texture)
- Source-verified via unpkg: `@react-three/drei@10.7.8` `/web/DragControls.d.ts`, `/web/Select.d.ts`, `/web/index.d.ts`, package file manifest
