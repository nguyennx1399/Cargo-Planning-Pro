# Codebase Summary

## Repository Structure

```
cargo-planner/
├── docs/                         # Project documentation
│   ├── PLAN.md                   # Phases 0–5, milestones, checklist
│   ├── ARCHITECTURE.md           # Diagram, tech decisions table, solver contract
│   ├── DOMAIN.md                 # Slot coordinates, hard constraints, glossary
│   ├── project-overview-pdr.md   # Requirements, user stories, success criteria
│   ├── project-roadmap.md        # Phase status, known gaps
│   ├── project-changelog.md      # Significant changes (starts 2026-09-16)
│   ├── codebase-summary.md       # This file
│   ├── code-standards.md         # Coding conventions, patterns
│   ├── system-architecture.md    # Component details, API reference
│   ├── deployment-guide.md       # Local dev, Docker, production setup
│   └── design-guidelines.md      # UI layout, colors, styles
├── frontend/                     # React 19 + TypeScript + Vite 6
│   ├── src/
│   │   ├── main.tsx              # App entry, React Query provider (no plan queries)
│   │   ├── App.tsx               # Layout: sidebar, 3D viewer, bay plan; loads the demo plan into the draft store
│   │   ├── types/domain.ts       # TypeScript mirrors of backend Pydantic models
│   │   ├── api/client.ts         # HTTP client (health, vessel, plan, validate, solve)
│   │   ├── store/
│   │   │   ├── usePlanStore.ts   # Zustand VIEW state (color mode, selection, filters, drag/pick gesture)
│   │   │   ├── usePlanDraftStore.ts # Editable plan + undo/redo (validate-then-mutate)
│   │   │   └── commit-placement.ts  # One commit resolver behind drag AND click-to-pick
│   │   ├── engine/
│   │   │   ├── stowage-model/    # StowageModel: stowage areas + container slots (single source of truth)
│   │   │   ├── placement/        # canPlaceContainer / canPlaceBreakbulk, reasons, placeholders
│   │   │   └── ...               # validation rules, packers, hull, vessel spec
│   │   ├── lib/
│   │   │   ├── colors.ts         # Color palette + schemes (POD, weight, type)
│   │   │   ├── drop-verdict.ts   # Three-state drop verdict for one slot + slot visibility rule
│   │   │   ├── drop-feedback.ts  # The ONE wording layer for every drop surface (P1)
│   │   │   ├── nearest-slot.ts   # Nearest-slot-centre resolution on the cursor ray's tier plane (P1)
│   │   │   ├── unplaced-query.ts # Pure search/filter/sort/group query for the Unplaced list (P2)
│   │   │   └── geometry.ts       # 3D math: bay/row/tier → position (DIM, LAYOUT)
│   │   ├── features/
│   │   │   ├── viewer3d/         # 3D scene (Canvas, Hull, InstancedMesh containers, empty-slot picker, placeholders, ghost, verdict chip)
│   │   │   ├── bayplan/          # 2D bay plan (CSS grid) with click-to-place
│   │   │   └── panels/           # Sidebar sections: plan, inspector, unplaced cargo (+ its controls), view options
│   │   └── styles.css            # Tailwind 4 entry + layout grid, chip/cursor/armed-ring rules
│   └── vite.config.ts            # Vite 6 alias (@→src), proxy /api → API_URL
├── backend/                      # Python 3.11 + FastAPI + Pydantic v2
│   ├── app/
│   │   ├── main.py               # FastAPI app, CORS middleware
│   │   ├── api/routes.py         # REST endpoints (health, vessels, plans, validate, stowage/solve)
│   │   ├── domain/
│   │   │   ├── models.py         # Pydantic models (Vessel, Container, StowagePlan, etc.)
│   │   │   └── slot.py           # Slot coordinate helpers (bay-row-tier)
│   │   ├── io/baplie.py          # BAPLIE import/export (stub)
│   │   ├── data/
│   │   │   ├── sample.py         # load_sample_vessel(), random_cargo()
│   │   │   └── sample_vessel.json # Reference vessel JSON (bays, rows, stacks)
│   │   ├── validation/
│   │   │   ├── engine.py         # validate(vessel, plan) → ValidationReport
│   │   │   ├── context.py        # ValidationContext (columns, containers, stacks)
│   │   │   └── rules.py          # Rule functions (slot_exists, size_fits_bay, stack_weight, etc.)
│   │   ├── solver/
│   │   │   ├── base.py           # StowageSolver Protocol interface
│   │   │   ├── greedy.py         # GreedySolver v1 (sort by POD/weight; basic placement)
│   │   │   ├── cpsat.py          # CpSatSolver (stub; OR-Tools phase 4)
│   │   │   └── registry.py       # SOLVERS dict
│   │   └── stability/calc.py     # Stability calculations (stub; GM, trim, SF/BM)
│   └── requirements.txt       # Dependencies (fastapi, pydantic, httpx, pytest, etc.)
│   (no tests/ directory — pytest is listed but the backend has no test suite yet)
├── docker-compose.yml            # Dev setup: api (:8000) + web (:5173); postgres commented
├── .dockerignore, Dockerfile     # Container images (python:3.11-slim, node:20-alpine)
└── README.md                      # Quick start, layout, run instructions
```

## Per-Module Purpose

### Frontend (`frontend/src/`)

| Module | Purpose | Key Exports | Status |
|--------|---------|---|--------|
| `main.tsx` | React entry point; mounts the TanStack Query provider (no plan queries remain) | queryClient | ✓ Complete |
| `App.tsx` | Top-level layout; vessel catalog entry + demo-plan build, loaded into the draft store; validation run locally; owns the viewport cursor/armed-ring wrapper | App component | ✓ Complete |
| `types/domain.ts` | TS interfaces mirror Python models | Vessel, Container, BreakbulkCargo, BreakbulkPlacement, StowagePlan, ValidationReport, etc. | ✓ Mirrors backend (manual sync) |
| `api/client.ts` | HTTP client with typed endpoints — **no importers; no runtime call path from the app** | api object (vessel, demoPlan, validate, solve stubs) | ○ Unused |
| `store/usePlanStore.ts` | Zustand **view state** only (colorMode, paletteMode, selection, filters, playback, **drag/pick gesture: hoveredSlot, draggingContainerId, pickedId, dropOutcome**) | usePlanStore, ColorMode, PaletteMode | ✓ Complete |
| `store/usePlanDraftStore.ts` | The **editable plan**: loadPlan, place/move/unplace container + breakbulk, undo/redo (cap 100). Validate-then-mutate, derived `unplaced`, never mutates in place | usePlanDraftStore, PlanDraftState | ✓ Complete |
| `store/commit-placement.ts` | The one resolver both drop triggers go through (drag release, click-to-pick); `cancelPlacement()` for Esc/release-outside; **sole writer of `dropOutcome`** | commitPlacement, cancelPlacement | ✓ Complete |
| `engine/stowage-model/` | **Single source of truth** for stowage areas + container slots (6 files: types, coords, builder, slot enumeration, occupancy) | buildStowageModel, areasAt, slotDefs, occupiedStacks, containerOccupancy, breakbulkOccupancy, occupiedRectsByArea, placementXToSceneX, sceneXToPlacementX, areaIdOf | ✓ Complete |
| `engine/placement/` | **One predicate per cargo kind**, shared by drop UI, ghost and full-plan validation (5 files) | canPlaceContainer, canPlaceBreakbulk, BreakbulkPose, PlacementResult, Reason, validSlotsFor, blockedSlots, blockedReasonFor, verdictOf, RULE_SEVERITY | ✓ Complete |
| `engine/breakbulk-deck-area.ts` | **Temporary shim** — thin wrappers resolving the model's area by id (11 exports) so old callers work; delete in Phase E | deckArea, deckKeepOuts, cargoBaseHeight, maxCargoHeight, stowageAreaIds, … | ✓ Complete (shim) |
| `lib/drop-verdict.ts` | "What would dropping on THIS slot do" — one verdict read by the ghost, placeholders, bay plan and sidebar; also owns the shared slot-visibility rule and `DROP_TINT` | verdictForSlot, verdictsForSlots, DROP_TINT, slotVisible | ✓ Complete |
| `lib/drop-feedback.ts` | **P1:** the ONE wording for what a drop *would* do and what it *did* (P1/D4) — chip, ContainerInspector and bay-plan notice all render its output; also owns `dropCursorClass` | dropOutcomeOf, dropVerdictText, dropOutcomeText, dropCursorClass, DropOutcome, DropTone | ✓ Complete (unit-tested; browser-unverified) |
| `lib/nearest-slot.ts` | **P1:** slot resolution — nearest slot **centre** to the cursor ray's tier-plane crossing (replaces "which pick box the ray entered first") | cursorOnTierPlane, nearestSlotIndex | ✓ Complete (unit-tested; browser-unverified) |
| `lib/unplaced-query.ts` | **P2:** pure search/filter/sort/group/arrow-key query over the unplaced rows; `DEFAULT_UNPLACED_QUERY` reproduces the pre-P2 rendering exactly | queryUnplacedRows, unplacedHeaderLabel, nextRowIndex, DEFAULT_UNPLACED_QUERY, UnplacedQuery | ✓ Complete (unit-tested; browser-unverified) |
| `lib/geometry.ts` | 3D coordinate transforms | slotToPosition, bayCenterX, rowCenterZ, tierCenterY, DIM, LAYOUT | ✓ Complete |
| `lib/colors.ts` | Color schemes by attribute (POD palette, weight ramp, type/IMDG) | podColorMap, containerColor, HIGHLIGHT | ✓ Complete |
| `lib/ship-attitude-transform.ts` | Transform weight distribution (LCG, TCG, KG) to ship sinking/healing angles | shipAttitudeFromWeights, ShipAttitude | ✓ Complete |
| `lib/use-indicative-stability.ts` | Hook: combine stability engine + hydrostatic lookup; **DEMO DATA only** | useIndicativeStability | ✓ Complete |
| `engine/stability-indicative.ts` | Indicative (DEMO DATA) draft/list/trim/GM from weight distribution + hydrostatic table lookup | WeightItem, StabilityResult, calculateStability | ✓ Complete |
| `engine/hydrostatic-table-lookup.ts` | Interpolate ship hydrostatic properties (displacement, LCB, MCT, KM) by draft | interpolateHydrostatics | ✓ Complete |
| `engine/playback-slice.ts` | Zustand store slice for loading sequence playback state management | playbackActions, playbackSlice | ✓ Complete |
| `engine/validate-plan.ts` | Frontend validation entry point; runs all rules against plan | validatePlan | ✓ Complete |
| `engine/validation-rules.ts` | Frontend constraint rule functions | slot_exists, stack_weight, no_floating, etc. | ✓ Partial |
| `engine/validation-context.ts` | Frontend ValidationContext (pre-indexed columns, stacks, containers) | ValidationContext | ✓ Complete |
| `engine/breakbulk-validation-rules.ts` | Breakbulk-specific validation (overlap, forbidden zones, deck area) — now loops over `canPlaceBreakbulk`, rule ids/messages unchanged | checkBreakbulkOverlap, checkForbiddenZones, etc. | ✓ Complete |
| `engine/breakbulk-overlap-check.ts` | 2D polygon overlap detection for breakbulk deck cargo | polygonsOverlap | ✓ Complete |
| `engine/breakbulk-forbidden-zones.ts` | Define restricted deck areas (hatches, cranes, etc.) | isForbiddenZone | ✓ Complete |
| `engine/hull/` | Parametric L1 hull generation (Cb fit, loft mesher, validation) | parametric-hull-generator, hull-loft-mesh-builder, section-integrals, slots-inside-hull-check, etc. (7 files) | ✓ Phase 2 complete |
| `engine/vessel-components/` | Component library builders (superstructure, funnel, mast, lifeboat, hatch covers, lashing bridges) + material merging | superstructure-geometry, funnel-geometry, crane-geometry, deck-fittings-geometry, hatch-and-lashing-geometry, merge-static-components (9 files) | ✓ Phase 3 complete |
| `engine/mesh-data.ts` | Mesh data utilities and livery shader material (`hull-livery-material.ts`: antifouling/boot-top/topside paint via `onBeforeCompile`) | HullLiveryMaterial, customProgramCacheKey | ✓ Phase 3 complete |
| `features/viewer3d/VesselScene.tsx` | R3F Canvas, lighting, orbit controls, ship attitude transform | VesselScene | ✓ Complete |
| `features/viewer3d/Hull.tsx` | Hull rendering (parametric L1, phase 2; GLTF L2 phase 4) | Hull component | ✓ Phase 2 (L1 parametric) |
| `features/viewer3d/ContainerInstances.tsx` | InstancedMesh for all sizes (20'/40'/45'); renders each container at correct length; raycast selection; filtered by playback state | ContainerInstances | ✓ Complete |
| `features/viewer3d/BreakbulkCargoInstances.tsx` | Render break-bulk deck cargo (wind turbine, yacht); positioned by x/z footprint + rotation; filtered by playback state; **DEMO dimensions only** | BreakbulkCargoInstances | ✓ Complete |
| `features/viewer3d/useShipAttitude.ts` | Hook: compute ship attitude (heel/trim/sinking) from visible cargo weight; updates 3D scene | useShipAttitude | ✓ Complete |
| `features/viewer3d/WaterlineReference.tsx` | Visual waterline mesh in 3D scene (responsive to ship attitude) | WaterlineReference | ✓ Complete |
| `features/viewer3d/LoadingSequenceDriver.tsx` | Playback controls (Play/Pause/Reset/Scrub) for reveal-over-time loading animation | LoadingSequenceDriver | ✓ Complete |
| `features/viewer3d/SlotPlaceholders.tsx` | Translucent box on every VALID slot while a container is dragged or picked; one InstancedMesh, `raycast={() => null}` so it is a hint layer, not a target layer | SlotPlaceholders | ✓ Complete |
| `features/viewer3d/EmptySlotPicker.tsx` | The **pick/target layer**: invisible InstancedMesh over the empty slots the cursor may target; owns the ray, the tier plane and the `nearestSlotIndex` resolution; the single click and release trigger both call `commitPlacement` | EmptySlotPicker | ✓ Complete |
| `features/viewer3d/GhostContainerPreview.tsx` | The box that follows the cursor during a drag, tinted green/amber/red from `DROP_TINT` | GhostContainerPreview | ✓ Complete |
| `features/viewer3d/DropVerdictChip.tsx` | **P1:** at-cursor verdict chip — the hover verdict or the last committed `dropOutcome`; `aria-hidden` by design (the Sidebar stays the screen-reader source, so pointer moves don't spam `aria-live`) | DropVerdictChip | ✓ Complete (unit-tested; browser-unverified) |
| `features/viewer3d/use-drop-cursor.ts` | **P1:** returns the `.viewport` cursor class list (grab / grabbing / pointer / not-allowed / crosshair) plus the `viewport-armed` 2 px ring while a box is in hand | useDropCursor | ✓ Complete (unit-tested; browser-unverified) |
| `features/bayplan/BayPlanView.tsx` | 2D bay plan (CSS grid, not SVG): bay cross-section, hatch line, weight-by-row bars, click-to-place a dragged/picked box | BayPlanView | ✓ Complete |
| `features/bayplan/BayPlanDeckBlock.tsx` | One deck's cell grid inside the bay plan; highlights the slots the item in hand may go in | BayPlanDeckBlock | ✓ Complete |
| `features/panels/Sidebar.tsx` | Composes the sidebar sections below + violations list; owns the window-level release and bay navigation; reads `dropOutcome` from the store | Sidebar | ✓ Partial (displays violations) |
| `features/panels/ContainerInspector.tsx` | "Container" section: selected/hovered box, or what a drop on the hovered slot would do (renders `lib/drop-feedback.ts` text) | ContainerInspector | ✓ Complete |
| `features/panels/UnplacedCargoList.tsx` | Unplaced list — the drag source, the WCAG 2.5.7 single-pointer entry point (mousedown drags, click picks), **and** the P2 retrieval surface (search, filters, sort, grouping, roving arrow-key focus) | UnplacedCargoList | ✓ Complete |
| `features/panels/UnplacedListControls.tsx` | **P2:** presentation-only control bar for the list (search box, size/type selects, "Fits bay NN" toggle, sort, grouping); owns `BAY_CAVEAT` | UnplacedListControls, BAY_CAVEAT | ✓ Complete (unit-tested; browser-unverified) |
| `features/panels/ProjectCargoPanel.tsx` | "Project cargo" section (load/clear demo project cargo) | ProjectCargoPanel | ✓ Complete |
| `features/panels/ViewOptionsPanel.tsx` | "Show" section: hull / deck toggles, bay selector | ViewOptionsPanel | ✓ Complete |
| `features/panels/use-stowage-keyboard-shortcuts.ts` | Global editing keys: Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z (and Ctrl+Y) redo, Esc cancel; **Esc and the arrow keys return early on INPUT/TEXTAREA**, so the P2 search box never cancels an armed pick or moves the bay | useStowageKeyboardShortcuts | ✓ Complete |
| `features/panels/StabilityPanel.tsx` | Display stability metrics: draft, list, trim, GM; **DEMO DATA caveat** | StabilityPanel | ✓ Complete |
| `features/panels/LoadingSequencePanel.tsx` | Playback controls and timeline for loading sequence animation | LoadingSequencePanel | ✓ Complete |
| `styles.css` | Tailwind 4 entry (`@import "tailwindcss"` + shadcn tokens) + layout grid (sidebar / viewer / bayplan), drop-chip, cursor and armed-ring rules | — | ✓ Complete |

### Backend (`backend/app/`)

| Module | Purpose | Key Exports | Status |
|--------|---------|---|--------|
| `main.py` | FastAPI app creation, CORS, router include | app | ✓ Complete |
| `api/routes.py` | REST endpoints (health, vessels, plans, validate, solve) | router (APIRouter) | ✓ Partial (solve TODO→async job) |
| `domain/models.py` | Pydantic models (single source of truth) | Vessel, Container, PortCall, Slot, StowagePlan, ValidationReport, Violation | ✓ Complete |
| `domain/slot.py` | Slot code parsing & helpers | parse_slot, is_forty_bay, is_on_deck, row_side | ✓ Complete |
| `data/sample.py` | Demo vessel + cargo generation | load_sample_vessel, random_cargo, SAMPLE_PORTS | ✓ Complete |
| `data/sample_vessel.json` | Reference feeder vessel profile | — | ✓ Complete |
| `validation/engine.py` | Main validation orchestrator | validate(vessel, plan) | ✓ Complete |
| `validation/context.py` | ValidationContext (pre-indexed columns, stacks) | ValidationContext | ✓ Complete |
| `validation/rules.py` | Rule functions executed by engine | slot_exists, size_fits_bay, stack_weight, no_floating, reefer_plug, overstow, ALL_RULES | ✓ Partial (6 rules; IMDG, stack height, OOG, stability, strength TODO) |
| `solver/base.py` | StowageSolver Protocol | StowageSolver (Protocol, name + solve) | ✓ Complete |
| `solver/greedy.py` | Greedy v1 auto-stow | GreedySolver (sorts by POD/weight) | ✓ Partial (no rule checks) |
| `solver/cpsat.py` | OR-Tools CP-SAT solver stub | CpSatSolver | ○ Stub (raises NotImplementedError) |
| `solver/registry.py` | Solver factory | SOLVERS dict | ✓ Complete |
| `stability/calc.py` | Stability calculations (GM, trim, SF/BM) | — | ○ Stub |

## Data Flow

### Load & Display

```
1. App.tsx resolves the vessel catalog entry, then builds the demo plan IN THE FRONTEND
   └─> buildDemoPlan (data/build-demo-plan.ts) → naiveFillPlan → StowagePlan
   └─> loadPlan(vessel, plan) into usePlanDraftStore (frontend-only demo path; no backend call)

2. Every view reads the draft: VesselScene, Sidebar, BayPlanView, stability
   └─> ContainerInstances renders all sizes in ONE InstancedMesh (per-instance length scale)
   └─> one draw call (target 60fps @ 20k containers; not yet benchmarked)

3. Validation runs locally against the draft (engine/validate-plan.ts, re-run on plan change)
   └─> violations[] + kpis{placed, unplaced, overstows, errors}
   └─> Sidebar displays violations
```

> `POST /api/validate` (backend `engine.validate`) remains the server-side contract, but the running demo never calls it — `api/client.ts` currently has no importers.

### Manual Edit (committed 2026-09-16: Phases A–C; **P1/P2 uncommitted, not browser-verified**)

```
1. Planner picks up a container: mousedown-drag from the Unplaced list, or click to PICK it
   └─> usePlanStore gesture state (draggingContainerId | pickedId — mutually exclusive; drag pauses playback)
2. Placeholders + ghost appear: SlotPlaceholders renders validSlotsFor(...), memoised per (vessel, plan, container)
   └─> ghost + hovered slot tinted by lib/drop-verdict.ts: green clean / amber accepted-but-recorded / red refused
   └─> P1: EmptySlotPicker resolves WHICH slot by nearest centre to the cursor ray's tier-plane
       crossing (lib/nearest-slot.ts) — not by the first pick box the ray enters
   └─> P1: DropVerdictChip shows the same sentence at the cursor; use-drop-cursor.ts sets the
       viewport cursor + the 2 px "armed" ring
3. Release over a 3D slot or a 2D bay cell (or a click, on the pick path)
   └─> commitPlacement(target) → usePlanDraftStore.placeContainer | moveContainer
   └─> canPlaceContainer validates BEFORE any state change (validate-then-mutate)
   └─> rejected: reasons returned, plan byte-identical, no history entry
   └─> accepted: new StowagePlan + history entry; `unplaced` re-derived
   └─> the result is stored as usePlanStore.dropOutcome (P1/D5), so the "Placed / Not placed"
       message survives the pointer leaving the slot; commit-placement.ts is its only writer
   └─> P1 wording contract (lib/drop-feedback.ts): clean drop → no notice at all; overstow →
       "Placed. Recorded, not blocked — the checks below will list it: <reason>" in amber;
       refusal → "Not placed — <reason>" in red. A refused PICK stays armed; a refused DRAG clears
4. Undo/redo (cap 100) and Esc: features/panels/use-stowage-keyboard-shortcuts.ts
   └─> Esc returns early on INPUT/TEXTAREA, so Esc in the P2 search box does not cancel a pick
5. Validation re-runs against the new draft; Sidebar lists the violations
```

### Bulk Retrieval over the Unplaced List (**P2, uncommitted, not browser-verified**)

```
1. UnplacedListControls writes a UnplacedQuery into UnplacedCargoList's local state
   └─> text / size / type / fitsBay / sort / group; DEFAULT_UNPLACED_QUERY reproduces the
       pre-P2 rendering exactly (BBC still reads `Unplaced (20)`)
2. lib/unplaced-query.ts (pure, 199 LOC) answers with rows + groups + the header label
   └─> `Unplaced (n)` when nothing is filtered, `Unplaced (n of N)` when something is
   └─> empty result renders "No container matches." with a Clear filters action
   └─> grouping by POD / type / size is collapsible with per-group counts
   └─> nextRowIndex drives ArrowUp/Down/Home/End roving focus over the RENDERED rows only
3. "Fits bay NN" is a RENDERING-ONLY filter (decision D6), worded as a size/parity claim:
   BAY_CAVEAT = "Size and parity only — the slot still has to pass every check."
   └─> it never gates a drop; `commitPlacement → canPlaceContainer` remains the only gate
   └─> the exact-predicate variant was measured at ~11.2k canPlaceContainer calls (~39 ms per
       recompute) and rejected
```

**Deferred (Phases D–E, not built):** project-cargo placeholders and drop, 0/90° rotation, deck-vs-hold area selection; hardening (hatch-opening check, tweendeck pontoon levels, multi-select/nudging, magnet snapping, Playwright); deleting the `breakbulk-deck-area.ts` shim. Swapping two containers is not implemented.

### Auto-Stow (Phase 3, Partial — backend endpoint only, no frontend caller)

> There is no "Solve" button in the app. This describes the API contract a future UI would call;
> nothing in `frontend/src` reaches it today.

```
1. POST /api/stowage/solve {vessel_id, solver: "greedy-v0", plan}
2. Backend: solver.solve(vessel, cargo, ports, voyage)
   └─> GreedySolver sorts by discharge order, weight
   └─> Fills free slots bottom-up, respects reefer only
   └─> NOT validated yet (gap vs ARCHITECTURE.md contract; the caller could POST /api/validate)
3. Returns: StowagePlan with placements[] + unplaced[]
4. Frontend displays new plan; user can refine
```

> The frontend's *demo* plan is filled by a different, frontend-only heuristic —
> `engine/naive-fill-plan.ts` (`naiveFillPlan`), which does respect size/bay, reefer and stack
> weight. It is not the real solver; it exists so the demo has cargo to show.

## Implemented vs. Stub Status

| Component | Lines | Implemented | Stub / TODO |
|-----------|-------|---|---|
| **Frontend** | ~17.4k (src, ~190 TS/TSX files; 17,694 incl. `styles.css`) | types, geometry math, both stores, stowage model + placement checks, drop verdict + one wording layer, nearest-slot resolution, unplaced query, color schemes, 3D scene, empty-slot picker, L1 parametric hull, 2D bay plan, container place/move editor | L2 hull (offsets import), project-cargo drop (Phase D), BAPLIE IO |
| **Backend** | 575 (all Python, incl. stubs) | Pydantic models, slot helpers, 6 validation rules, greedy solver, 5 endpoints | hydrostatics, tanks, CP-SAT, BAPLIE |
| **Validation** | 151 | engine, context, 6 rules | IMDG, stack height, OOG, stability, strength |
| **Solvers** | 83 | GreedySolver (basic sort) | no rule checks; CP-SAT stub |
| **API** | 64 | health, vessels, plans, demo, validate | async solve jobs, BAPLIE IO |
| **Tests** | — | 75 files / 586 tests, all frontend | backend has none; no DOM/interaction tests |

### Key Stubs (Marked TODO(phase-N))

- **Phase 1:** L1 parametric hull ✓; performance check (one `instancedMesh` already renders all sizes — see `ContainerInstances.tsx`)
- **Phase 2:** BAPLIE import/export; swap two containers (place/move and undo/redo now exist); PostgreSQL; plan versioning
- **Phase 3:** Greedy rule checks; KPI benchmark; split/balance optimization
- **Phase 4:** CP-SAT solver; stability calc; async job queue; WebSocket progress
- **Phase 5:** AI assistant; what-if planner; multi-port re-planning; RL research

## Key Files by Purpose

### Type Definitions (Single Source of Truth)
- `backend/app/domain/models.py` (121 LOC)
- `frontend/src/types/domain.ts` (mirrors above)
- **Convention:** Keep in sync via manual sync rule (phase 2: `openapi-typescript` auto-gen)

### Validation Rules
- `backend/app/validation/rules.py` (104 LOC)
- **Pattern:** Pure functions `Rule: ValidationContext → Violation[]`
- **To add a rule:** Write function, append to `ALL_RULES` list, write test

### Solver Interface
- `backend/app/solver/base.py` (12 LOC, Protocol)
- **Pattern:** Implement `StowageSolver` Protocol with `.name` and `.solve()` method
- **Registry:** `solver/registry.py` injects solvers into routes

### Stowage Model & Placement Checks (the drop/validation core)

- `frontend/src/engine/stowage-model/` — `buildStowageModel(vessel)` (cached per vessel object) is the single source of truth for stowage areas and slots; `coords.ts` is the ONLY home of the x_m↔scene-x offset; `slot-enumeration.ts` enumerates 40' bays **and their 20' odd half-bays**.
- `frontend/src/engine/placement/` — `canPlaceContainer` / `canPlaceBreakbulk` are the one predicate per cargo kind; the drop UI, the ghost and `breakbulk-validation-rules.ts` all call them. Rule ids and messages are shared with the plan-wide report.
- **Boundary:** only `placement/` may answer "can this go there"; `lib/drop-verdict.ts` only phrases the answer for the UI.
- **To add a rule:** add the id to `PLACEMENT_RULES` + `RULE_SEVERITY` (`placement/reason.ts`), emit it from the predicate, and mirror it in the plan-wide rule so the two agree (there is a parity test).

### 3D Rendering
- `frontend/src/features/viewer3d/ContainerInstances.tsx` (167 LOC)
- **Pattern:** ONE InstancedMesh for every size — per-instance matrix scale (`LENGTH_BY_SIZE`) makes a 20' render at 20' while sharing the draw call; instance ID → raycast selection
- **Geometry:** `lib/geometry.ts` transforms slot → [x, y, z] position; slot footprints come from the stowage model, never re-derived in the scene
- **Targeting:** `EmptySlotPicker.tsx` is the companion pick layer over *empty* slots; `lib/nearest-slot.ts` picks the winning candidate by nearest slot centre to the cursor ray's tier-plane crossing

## Dependencies & Versions

| Package | Version | Role |
|---------|---------|------|
| **Frontend** | | |
| React | 19 | UI framework |
| TypeScript | 5 | Type safety |
| Vite | 6 | Build tool (dev server, HMR) |
| @react-three/fiber | 9 | React ↔ Three.js declarative |
| three | 0.170 | 3D rendering |
| @react-three/drei | 10 | R3F utilities (OrbitControls, etc.) |
| zustand | 5 | State management (view state + editable plan) |
| @tanstack/react-query | 5.59 | Server state + caching — **provider mounted, no queries run** |
| tailwindcss + @tailwindcss/vite | 4.3.3 | Utility CSS (`@import "tailwindcss"` in `styles.css`) |
| shadcn | 4.21 | Component primitives (+ `@base-ui/react`, `lucide-react`) |
| vitest | 3.2.7 | Unit test runner (`npm test`) |
| @vitest/coverage-v8 | 5 | Coverage — **pinned a major ahead of vitest 3; latent mismatch, no `vitest.config.*` exists** |
| **Backend** | | |
| FastAPI | 0.115+ | Web framework |
| Pydantic | 2 | Data validation |
| uvicorn | 0.30+ | ASGI server |
| httpx | 0.27+ | HTTP client (declared for tests; no tests exist) |
| pytest | 8+ | Declared, but no test suite exists |
| (ortools) | 9.11+ | OR-Tools (phase 4; commented) |
| (numpy) | 1.24+ | Numerics (phase 4; commented) |

**Tooling gaps:** there is no eslint or prettier config anywhere in the repo, no `vitest.config.*`
(vitest runs with defaults), and no CI (`.github/` does not exist) — typecheck, build and test are run
by hand.

## Database Schema (Phase 2)

> PostgreSQL. Not yet implemented; commented in docker-compose.yml.

```
vessels(id PK, name, imo, length_m, beam_m, ...)
  → has many stacks (bay, row, deck, max_weight_t, reefer_tiers)

plans(id PK, vessel_id FK, voyage, created_at, status)
  ↓ has many plan_versions
  
plan_versions(id PK, plan_id FK, version, created_at, created_by)
  → has many placements (container_id, slot, position)

containers(id PK, voyage_id FK, size, type, weight_t, pol, pod, imdg_class, ...)

port_calls(id PK, voyage_id FK, locode, name, sequence, eta, etd)
```

## Testing Strategy

| Layer | Tool | Coverage | Status |
|-------|------|----------|--------|
| Frontend engine + stores | vitest (`environment: 'node'`) | pure-unit | ✓ **75 files / 586 tests passing (2026-09-17)** — incl. stowage-model, placement predicates, draft store, predicate↔report parity, `nearest-slot`, `drop-feedback`, `unplaced-query` |
| Frontend components | — | — | ○ No DOM/interaction tests (jsdom/happy-dom not installed; `environment: 'node'`; Playwright deferred to Phase E) |
| Backend | pytest (declared) | — | ○ **No `backend/tests/` directory at all** — pytest collects nothing |
| Solver benchmarks | Golden-file harness (BAPLIE round-trip) | TBD | ○ Phase 3 |

> The P1/P2 drag-drop UX pass is **unit-tested but not browser-verified** — the pure parts (slot
> resolution, wordings, outcome lifetime, the list query) are asserted in node tests, but no test or
> human has driven the actual pointer. See `plans/reports/manual-click-through-260916-phase-c.md`
> steps 22–34.

**To run:**
```bash
cd frontend && npm test          # vitest, one run
cd frontend && npm run typecheck # tsc --noEmit
```

## Naming Conventions Observed

**Backend (Python):**
- Models, functions, variables: `snake_case`
- Protocol classes: `PascalCase` (e.g., `StowageSolver`)
- Pydantic enums: `PascalCase` (e.g., `DeckLevel`, `ContainerSize`)
- Private functions: `_helper_name`

**Frontend (TypeScript):**
- Components: `PascalCase` (e.g., `VesselScene`, `ContainerInstances`)
- Hooks: `useXxx` (e.g., `usePlanStore`)
- Variables, functions: `camelCase`
- Types, interfaces: `PascalCase` (e.g., `Vessel`, `ColorMode`)
- Constants: `UPPER_CASE` (e.g., `DIM`, `LAYOUT`)
- CSS classes, files: `kebab-case` (e.g., `styles.css`, `.viewport`)

**Note:** Existing frontend uses `PascalCase` for component files. CLAUDE.md prefers `kebab-case` for new files — this is an open design tension.

## Integration Points

| Interface | Method | Status | Notes |
|-----------|--------|--------|-------|
| Frontend ↔ Backend API | REST JSON | ○ **Not wired** | `api/client.ts` has no importers; no `fetch` anywhere in `frontend/src`. Types still mirror the models |
| Frontend ↔ Store | Zustand selectors | ✓ Prod | two stores: view state (`usePlanStore`) and the editable plan (`usePlanDraftStore`); narrow subscriptions avoid canvas re-renders |
| Backend ↔ Validation | Protocol dispatch | ✓ Prod | pure functions; rules added via ALL_RULES list |
| Backend ↔ Solver | Protocol dispatch | ✓ Prod | solver.solve() contract enforced |
| Backend ↔ DB | SQLAlchemy ORM | ○ Phase 2 | currently in-memory store |
| Frontend ↔ 3D Engine | R3F declarative | ✓ Prod | one InstancedMesh + one picker mesh; raycast selection |
| Frontend ↔ Local Storage | JSON (future) | ○ Phase 2 | plan draft auto-save |

## Build & Deploy

**Frontend:**
- `npm run dev` → Vite dev server :5173; proxies /api → API_URL (default: http://localhost:8000)
- `npm run build` → vite build (tsc --noEmit + tree-shake)
- `npm run typecheck` → tsc --noEmit

**Backend:**
- `python -m venv .venv && source .venv/bin/activate`
- `pip install -r requirements.txt`
- `uvicorn app.main:app --reload --port 8000`

**Docker:**
- `docker compose up --build` → api :8000 + web :5173 (hot reload both)
- Future: PostgreSQL, Redis job queue, K8s deployment

## Open Questions

1. **Type Generation:** Generate TS types from OpenAPI schema via `openapi-typescript` (phase 2)?
2. **Component File Naming:** Keep `PascalCase` (existing) or migrate to `kebab-case` (CLAUDE.md)?
3. **IMDG Rules:** Full IACS table or simplified rules first?
4. **Stability Model:** Ballast / fuel simulation in phase 4 or post-MVP?
5. **Multi-Solver Testing:** Benchmark harness with real BAPLIE files ready?
