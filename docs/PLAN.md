# Plan

Assumption: **container vessels** (bay/row/tier slots). Break-bulk/project cargo would
replace the solver layer with 3D bin packing; the viewer and app shell stay the same.

Principle: build the **validator before the optimizer**. Anything the solver produces must
pass the same rule engine a human plan passes. The "AI" is layered on top of a correct core.

---

## Phase 0 — Domain & data (1–2 weeks)

- [ ] Pick one reference vessel (a feeder, ~1,000–2,500 TEU, keeps data small)
- [ ] Collect: vessel profile (bays/rows/tiers, stack limits, reefer plugs), hydrostatic tables, lightship
- [ ] Collect 3–5 real BAPLIE files (+ port rotation with ETA/ETD)
- [ ] Freeze data model v1 (`backend/app/domain/models.py` ⇄ `frontend/src/types`)
- [ ] Write `docs/DOMAIN.md` constraints list, agreed with a planner if possible

**Exit:** sample vessel + sample cargo load without hand edits.

## Phase 1 — 3D + 2D viewer (2–4 weeks)

- [x] App shell, Vite, R3F canvas, orbit controls (skeleton)
- [x] Instanced container rendering from plan data (skeleton, mock data)
- [ ] Accurate hull shape per vessel (start: box/extruded outline; later: GLTF model)
- [ ] Color modes: POD, weight, type (reefer/IMDG/OOG), overstow highlight
- [ ] Bay clipping / "show only bay N", under-deck vs on-deck toggle
- [ ] Hover tooltip + click select (raycast on InstancedMesh `instanceId`)
- [ ] 2D bay plan view (SVG), synced selection with 3D
- [ ] Performance check: 20,000 instances @ 60fps

**Exit:** open a BAPLIE, see it in 3D and 2D, inspect any container.

## Phase 2 — Manual editor + validation (3–4 weeks)

- [ ] BAPLIE import (EDIFACT D.95B / SMDG 2.2 & 3.1) in `app/io/baplie.py`
- [ ] Move/swap container (2D drag first; 3D drag optional)
- [ ] Rule engine: slot size compatibility, stack weight, stack height, reefer plug,
      IMDG segregation (simplified table first), overstow count, visibility line
- [ ] Live violations panel (backend `/validate` endpoint, debounce on edit)
- [ ] Plan versioning (undo/redo on frontend, saved versions in DB)
- [ ] BAPLIE export

**Exit:** a planner can fix a plan by hand and see every rule broken in real time.

## Phase 3 — Auto-stow v1: heuristic (2–3 weeks)

- [ ] Greedy: sort by discharge order (last POD first), heavy before light, fill bottom-up
- [ ] Respect all hard rules via the validator
- [ ] KPIs: restows, stack-weight margin, bays used, crane-split balance
- [ ] Benchmark harness: run solver on N sample loads → CSV of KPIs

**Exit:** auto plan with 0 hard violations and restow count reported.

## Phase 4 — Optimization + stability (4–8 weeks)

- [ ] Stability calc: displacement, KG, GM, trim, list from hydrostatics + tanks
- [ ] Longitudinal strength: shear force / bending moment vs. limits
- [ ] Master bay planning with OR-Tools CP-SAT (groups → bays, trim/GM constraints)
- [ ] Slot planning per bay (CP-SAT or local search: tabu / simulated annealing)
- [ ] Async jobs + progress over WebSocket
- [ ] Compare vs greedy on the benchmark harness

**Exit:** plans beat greedy on KPIs and stay within stability limits.

## Phase 5 — AI layer (ongoing)

- [ ] Learn from historical plans → warm-start / group-to-bay priors for the solver
- [ ] LLM assistant: explain placements, run what-if (calls solver/validator, never computes stability itself)
- [ ] Multi-port re-planning (update plan at each port as cargo changes)
- [ ] Research track: deep RL for slot planning

---

## Cross-cutting

- Safety: this is **decision support**. Official loading computers need class approval
  (IACS UR L5). Always show "verify on approved loading computer".
- Types: generate TS types from FastAPI OpenAPI (`openapi-typescript`) once models stabilize.
- Testing: unit tests for slot math and each rule; golden-file tests for BAPLIE round-trip.
- DB: PostgreSQL (vessels, voyages, plans, plan_versions). Not wired in skeleton yet.
