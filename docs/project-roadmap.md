# Project Roadmap

**Last Updated:** 2026-09-16 · **Version:** 0.1.0 (skeleton)

Full task checklist: [PLAN.md](./PLAN.md). This file tracks status against the actual code.
Principle: **validator before optimizer** — every plan (human or solver) passes the same rule engine.

## Phase Status

| Phase | Scope | Est. | Status | Progress |
|---|---|---|---|---|
| 0 | Domain & data: reference vessel, real BAPLIE files, freeze data model v1 | 1–2 wk | Not started (synthetic sample only) | ~10% |
| 1 | 3D + 2D viewer | 2–4 wk | In progress | ~70% |
| 2 | Manual editor + validation | 3–4 wk | In progress — manual container editor shipped (drag-drop stowage Phases A–C) | ~55% |
| 3 | Auto-stow v1: greedy heuristic | 2–3 wk | Placeholder solver | ~15% |
| 4 | Optimization (CP-SAT) + stability | 4–8 wk | Stubs only | ~0% |
| 5 | AI layer | ongoing | Not started | 0% |

Percentages are rough estimates from code inspection. Phase 2 credits the shipped editor (place/move by drag or click-to-pick, undo/redo, live validation) but still counts BAPLIE IO, the remaining rules (IMDG, stack height, OOG) and persistence as open.

## Phase 0 — Domain & Data

- [x] Data model draft: `backend/app/domain/models.py` ⇄ `frontend/src/types/domain.ts`
- [x] Synthetic feeder profile `backend/app/data/sample_vessel.json` + `random_cargo()`
- [ ] Real reference vessel (profile, hydrostatics, lightship)
- [ ] 3–5 real BAPLIE files + port rotation
- [ ] Constraints list agreed with a planner (`DOMAIN.md` draft exists)

## Phase 1 — Viewer

- [x] App shell, Vite, R3F canvas, orbit controls
- [x] Instanced container rendering from plan data
- [x] Color modes POD / weight / type (+IMDG) — `lib/colors.ts`, Sidebar toggle
- [x] Ship frame coordinate system & VesselGeometry schema ([vessel-3d-model-pipeline phase-01](../plans/260911-1409-vessel-3d-model-pipeline/phase-01-vessel-geometry-schema-and-ship-frame.md))
- [x] Parametric hull (L1 via `engine/hull/*`)
- [x] Offsets CSV import + MAD-based fairness check + L2 lofting, wired into a "Vessel onboarding" app mode ([phase-04](../plans/260911-1409-vessel-3d-model-pipeline/phase-04-offsets-import-fairness-check-lofting.md)) — read-only grid preview (no in-place editing yet), no VesselGeometry JSON export/import yet
- [x] Component library (superstructure, funnel, mast, lifeboat via `engine/vessel-components/*`)
- [x] Hull livery paint (antifouling/boot-top/topside bands by ship-frame z, shader-based via `onBeforeCompile`)
- [x] Auto-generated hatch covers & lashing bridges (from vessel bay list)
- [x] Merged components by material; perf: **3 draw calls** (hull + superstructure + deck-fittings) + 1 water = 4 total, ≤8800 triangles
- [x] Hover / select (store + instance handlers present); deck & bay filters (store state; UI partial)
- [ ] Separate InstancedMesh for 20'/45'; selection outline
- [x] 2D bay plan synced with 3D (`BayPlanView.tsx` — a CSS grid, not SVG: bay cross-section, weight by row, click-to-place)
- [ ] Perf check: 20k instances @ 60fps
- [ ] Draft marks, water transparency toggle (deferred: need ShipGroup from P1-demo)
- [ ] LOD (hull N=16 simplification, deferred)

## Phase 2 — Editor + Validation

- [x] Rule engine + `POST /api/validate`; violations shown in Sidebar (the running demo validates locally via `engine/validate-plan.ts`)
- [x] Rules: `slot_exists`, `size_fits_bay` (partial), `stack_weight`, `no_floating`, `reefer_plug`, `overstow` (soft)
- [ ] Rules: IMDG segregation, stack height / visibility line, OOG clearance, full size mixing
- [ ] BAPLIE import/export (`io/baplie.py` stub)
- [x] Place/move a container by drag from the Unplaced list, or by click-to-pick then click a target; every commit is validated before the mutation and violations re-run on the edit
- [ ] Swap two containers (not implemented)
- [x] Undo/redo (client-side, cap 100 — `usePlanDraftStore`)
- [ ] PostgreSQL + plan versions

### Drag-drop stowage editor — Phases A–C (2026-09-16)

Spec: [confluence-260916 drag-drop stowage placeholders](../plans/reports/confluence-260916-1647-drag-drop-stowage-placeholders-feature-plan.md) · Plan: [260916-1647-drag-drop-stowage-placeholders](../plans/260916-1647-drag-drop-stowage-placeholders/plan.md)

- [x] **A — StowageModel:** `engine/stowage-model/` (areas, slots incl. 20' odd half-bays, occupancy); `breakbulk-deck-area.ts` becomes a thin shim
- [x] **B — Placement checks + editable plan:** `engine/placement/` predicates; `usePlanDraftStore` (validate-then-mutate, undo/redo); App loads the demo plan into the draft store
- [x] **C — Container placeholders + drop:** `validSlotsFor`, 3D placeholders, three-state ghost tint, one commit resolver for drag and click-to-pick, bay-plan click-to-place, undo/redo/Esc keys
- [ ] **C (acceptance):** the manual browser click-through — [script](../plans/reports/manual-click-through-260916-phase-c.md). Engine/store behaviour is unit-tested; the browser interactions are not machine-verified (no DOM test environment)
- [ ] **D — Project cargo placeholders + drop** (deferred): `freeRegionsFor`, area drop plane, ghost breakbulk preview, 0/90° rotation, deck-vs-hold selection
- [ ] **E — Hardening & realism** (deferred): hatch-opening check, adjustable tweendeck pontoon levels, multi-select/nudging, magnet snapping, Playwright, **and deleting the `breakbulk-deck-area.ts` shim**

## Phase 3 — Greedy Auto-stow

- [x] `greedy-v0`: last POD first, heavy first, bottom-up, reefer plug aware
- [ ] Check weight/size/rules per slot before placing
- [ ] Validate solver output in `/stowage/solve` (ARCHITECTURE.md contract; not enforced yet)
- [ ] KPIs + benchmark harness (CSV)

## Phase 4 — Optimization + Stability

- [ ] Stability: displacement, KG, GM, trim, list (`stability/calc.py` stub)
- [ ] Longitudinal strength SF/BM
- [ ] CP-SAT master bay + slot planning (`solver/cpsat.py` raises → HTTP 501)
- [ ] Async jobs + WebSocket progress; benchmark vs greedy

## Phase 5 — AI Layer

- [ ] Warm-start priors from historical plans
- [ ] LLM assistant (explains, calls solver/validator; never computes stability itself)
- [ ] Multi-port re-planning; RL research track

## Cross-cutting

- [ ] Generate TS types from OpenAPI (`openapi-typescript`) once models stabilize
- [ ] Tests: one per rule; BAPLIE golden-file round-trip (currently only `test_api`, `test_slot`)
- [ ] "Verify on approved loading computer" disclaimer in UI (IACS UR L5)

## Known Gaps

1. `/stowage/solve` returns solver output without running `validate()`.
2. Greedy ignores stack weight and size fit → demo plan may contain violations.
3. No persistence; in-memory vessel cache only.
4. `breakbulk-deck-area.ts` is a temporary shim (11 exports) over `engine/stowage-model/`; Phase E deletes it once its callers migrate.
5. The 2D bay plan addresses whole bays only — a 20' odd half-bay drop is 3D-only. `naiveFillPlan` still places no 20' box, so a demo plan loads with those unplaced by design.

## Unresolved Questions

- Which reference vessel / real BAPLIE samples for phase 0?
- IMDG: simplified segregation table first, or full IMDG code?
