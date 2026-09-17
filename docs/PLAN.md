# Plan

> **Status source: [`project-roadmap.md`](./project-roadmap.md).** This file is the *original* phase
> plan, kept for scope and effort context — the estimates and the phase boundaries below are still the
> yardstick for "how far along are we". Its checkboxes are the plan as it was written, and they lag
> the code; where the two disagree, the roadmap (and the code) win. Last reconciled with the code on
> 2026-09-17. Recent changes: [project-changelog.md](./project-changelog.md).

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
- [x] Instanced container rendering from plan data
- [x] Accurate hull shape per vessel — L1 parametric hull (`engine/hull/*`) plus offsets CSV import, fairness check and L2 lofting behind a "Vessel onboarding" mode. GLTF/L2-from-file import still open
- [x] Color modes: POD, weight, type (reefer/IMDG/OOG). **Not** an overstow-highlight mode — overstows are a rule outcome, shown in the Checks list
- [x] Bay clipping / "show only bay N" (`bayFilter` in `usePlanStore` + ViewOptionsPanel), under-deck vs on-deck toggle
- [x] Hover + click select (raycast on InstancedMesh `instanceId`). Hover *tooltip* is still future work
- [x] 2D bay plan view, synced selection with 3D (built as a CSS grid, not SVG)
- [ ] Performance check: 20,000 instances @ 60fps

**Exit:** open a BAPLIE, see it in 3D and 2D, inspect any container.

## Phase 2 — Manual editor + validation (3–4 weeks)

- [ ] BAPLIE import (EDIFACT D.95B / SMDG 2.2 & 3.1) in `app/io/baplie.py`
- [x] Move a container: drag from the Unplaced list, or click-to-pick then click a target (3D placeholder or 2D bay cell); **swap is not implemented**, and project-cargo drop is deferred (Phase D)
- [x] One shared `StowageModel` (`engine/stowage-model/`) as the source of truth for stowage areas and slots, including 20' odd half-bays; one placement predicate per cargo kind (`engine/placement/`) shared by the drop UI, the ghost and the full-plan report
- [x] Rule engine, implemented: slot size compatibility (`size_fits_bay`), cell conflict, 20'-on-40', stack weight, no floating, reefer plug, overstow count (soft)
- [ ] Rule engine, remaining: stack height / visibility line, IMDG segregation (simplified table first), OOG clearance
- [x] Live violations panel: validation re-runs on every edit. Runs in the frontend (`engine/validate-plan.ts`); the backend `/validate` endpoint is not called by the demo
- [x] Undo/redo on the frontend (`usePlanDraftStore`, cap 100); saved versions in DB still pending
- [ ] BAPLIE export
- [x] Drop UX: three-state verdict (`lib/drop-verdict.ts`), one wording layer (`lib/drop-feedback.ts`), nearest-centre slot resolution (`lib/nearest-slot.ts`), at-cursor chip, cursor affordances. **Uncommitted and not browser-verified** — see [project-roadmap.md](./project-roadmap.md) P1/P2
- [x] Retrieve from a long unplaced list: pure `lib/unplaced-query.ts` + `UnplacedListControls.tsx` (search, filters, sort, grouping, "fits bay", arrow-key nav). **Uncommitted and not browser-verified** — see [project-roadmap.md](./project-roadmap.md) P2

**Exit:** a planner can fix a plan by hand and see every rule broken in real time.

## Phase 3 — Auto-stow v1: heuristic (2–3 weeks)

- [x] Greedy: sort by discharge order (last POD first), heavy before light, fill bottom-up (`greedy-v0`)
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
  Today the app is entirely client-side and `api/client.ts` has no importers, so nothing keeps the
  two type sets honest but hand-editing.
- Testing: unit tests for slot math and each rule; golden-file tests for BAPLIE round-trip.
  **Status:** frontend has 75 files / 586 tests (pure-unit, node environment, no DOM tests); the
  backend has none — `backend/tests/` does not exist.
- DB: PostgreSQL (vessels, voyages, plans, plan_versions). Not wired in skeleton yet.
