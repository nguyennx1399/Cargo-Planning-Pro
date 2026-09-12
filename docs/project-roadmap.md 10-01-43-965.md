# Project Roadmap

**Last Updated:** 2026-09-11 · **Version:** 0.1.0 (skeleton)

Full task checklist: [PLAN.md](./PLAN.md). This file tracks status against the actual code.
Principle: **validator before optimizer** — every plan (human or solver) passes the same rule engine.

## Phase Status

| Phase | Scope | Est. | Status | Progress |
|---|---|---|---|---|
| 0 | Domain & data: reference vessel, real BAPLIE files, freeze data model v1 | 1–2 wk | Not started (synthetic sample only) | ~10% |
| 1 | 3D + 2D viewer | 2–4 wk | In progress | ~60% |
| 2 | Manual editor + validation | 3–4 wk | Partially started (rule engine) | ~25% |
| 3 | Auto-stow v1: greedy heuristic | 2–3 wk | Placeholder solver | ~15% |
| 4 | Optimization (CP-SAT) + stability | 4–8 wk | Stubs only | ~0% |
| 5 | AI layer | ongoing | Not started | 0% |

Percentages are rough estimates from code inspection.

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
- [~] Hover / select (store + instance handlers present); deck & bay filters (store state; UI partial)
- [ ] Separate InstancedMesh for 20'/45'; selection outline
- [ ] 2D SVG bay plan synced with 3D (`BayPlanView.tsx` is a stub)
- [ ] Perf check: 20k instances @ 60fps
- [ ] Draft marks, water transparency toggle (deferred: need ShipGroup from P1-demo)
- [ ] LOD (hull N=16 simplification, deferred)

## Phase 2 — Editor + Validation

- [x] Rule engine + `POST /api/validate`; violations shown in Sidebar
- [x] Rules: `slot_exists`, `size_fits_bay` (partial), `stack_weight`, `no_floating`, `reefer_plug`, `overstow` (soft)
- [ ] Rules: IMDG segregation, stack height / visibility line, OOG clearance, full size mixing
- [ ] BAPLIE import/export (`io/baplie.py` stub)
- [ ] Move/swap containers; debounced live validation
- [ ] Undo/redo; PostgreSQL + plan versions

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

## Unresolved Questions

- Which reference vessel / real BAPLIE samples for phase 0?
- IMDG: simplified segregation table first, or full IMDG code?
