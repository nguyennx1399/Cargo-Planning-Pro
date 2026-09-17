# Cargo Planner 3D — Project Overview & Requirements

## Executive Summary

**Cargo Planner 3D** is a decision-support tool for stowage planning on container vessels. It enables marine planners to:
- View ship and cargo in interactive 3D, with synchronized 2D bay plan
- Manually edit placements with live rule validation
- Generate initial plans via automated solvers (greedy heuristic → optimization engine)

**Status:** Working demo, phases 0–5 in progress. The 3D/2D viewer and the manual stowage editor are
functional and unit-tested; the solver, stability and backend layers remain stubs. The frontend builds
and validates its demo plan entirely in the browser — the backend API exists but nothing in the app
calls it. A drag-drop UX polish pass is implemented in the working tree but **uncommitted and not
browser-verified** (no DOM test environment; manual click-through steps 22–34 outstanding).

## Users & Use Cases

**Primary:** Stowage planners at shipping lines, freight forwarders, vessel operators.

**Use cases:**
1. Load a BAPLIE file; inspect vessel capacity and cargo breakdown
2. Place containers manually; see hard/soft violations in real time
3. Fix violations by moving containers (swapping two containers is **not implemented** — place or move
   instead; project-cargo drop is deferred to Phase D)
4. Auto-generate a plan with the solver; review and refine
5. Export corrected plan as BAPLIE for loading computer approval
6. Find a box to place in a long unplaced list — search by id, filter by size/type, sort, group, or
   narrow to the bay in view (P2; uncommitted, not browser-verified)

## Scope & Non-Goals

**In scope (phases 1–5):**
- 3D + 2D visualization of vessel stowage
- Manual editing with real-time constraint validation
- Greedy auto-stow (v1) and CP-SAT optimization (phase 4)
- Stability calculation (GM, trim, SF/BM)
- BAPLIE import/export
- Multi-port voyage planning

**Not in scope:**
- Official approval (decision support only; always verify on class-approved loading computer)
- Historical plan analytics (future)
- Integration with TMS/ERP systems (future)

## Functional Requirements

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| F1 | Load demo vessel + random cargo | 1 | ✓ Complete — built client-side (`data/build-demo-plan.ts`); no API call |
| F2 | 3D viewer with instanced rendering | 1 | ✓ Complete — one InstancedMesh for all sizes, per-instance length scale |
| F3 | Color modes (POD, weight, type) | 1 | ✓ Complete |
| F4 | 2D bay plan view, synced selection | 1 | ✓ Complete (CSS grid, not SVG; also click-to-place) |
| F5 | BAPLIE import (D.95B, SMDG 2.2/3.1) | 2 | ○ Stub |
| F6 | Move/swap containers in editor | 2 | ✓ Partial — place/move a container by drag or click-to-pick; **swap not implemented**, project-cargo drop deferred to Phase D |
| F6a | Drag-drop stowage: valid-slot placeholders, three-state ghost (clean / accepted-with-warnings / refused), undo/redo (cap 100), WCAG 2.5.7 click-to-pick | 2 | ✓ Committed + unit-tested (Phases A–C); the manual browser click-through is the outstanding acceptance step |
| F6b | Drop-surface UX: nearest-centre slot resolution, one wording layer (`lib/drop-feedback.ts`), at-cursor verdict chip, cursor + "armed" ring, `dropOutcome` surviving the pointer leaving the slot | 2 | ◐ **Implemented + unit-tested; uncommitted, not browser-verified** (P1) |
| F6c | Bulk retrieval over the Unplaced list: search, size/type filters, sort, grouping, "Fits bay NN", roving arrow-key focus | 2 | ◐ **Implemented + unit-tested; uncommitted, not browser-verified** (P2). "Fits bay NN" is rendering-only (D6) |
| F7 | Hard constraint validation | 2 | ✓ Partial — 8 container rules (7 hard + soft `overstow`) plus 7 breakbulk rules, run by `engine/validate-plan.ts`; backend `validation/rules.py` carries 5 hard + soft `overstow`. IMDG, stack height, OOG, stability, strength TODO |
| F8 | Soft objective tracking (overstows, weight, restows) | 2 | ○ Stub |
| F9 | Greedy auto-stow | 3 | ✓ Partial (sorts by POD/weight; no rule checks yet) |
| F9a | Loading sequence playback (Play/Pause/Reset/Scrub) | 3 | ✓ Complete (**DEMO/indicative data only**) |
| F10 | Optimize with OR-Tools CP-SAT | 4 | ○ Stub |
| F11 | Indicative stability calc: GM, trim, heel, draft | 3–4 | ✓ Complete (**DEMO DATA only; not for operational use**) |
| F11a | Break-bulk/project cargo (wind turbine, yacht) with deck placement & validation | 3–4 | ✓ Complete (**DEMO dimensions only; reference figures**) |
| F12 | Async solver jobs + WebSocket progress | 4 | ○ Stub |
| F13 | AI assistant layer | 5 | ○ Research only |

## Non-Functional Requirements

| # | Requirement | Target | Notes |
|---|---|---|---|
| NF1 | 3D render performance | 20k containers @ 60fps | One InstancedMesh for all sizes; **not yet benchmarked** |
| NF2 | Validation latency | <100ms per check | Runs synchronously on every plan change (no debounce, no network) |
| NF3 | Solver speed (greedy) | <10s for 2000 containers | heuristic; local machine |
| NF4 | Solver speed (CP-SAT) | <60s per bay group | background job; WebSocket progress |
| NF5 | Data consistency | Single source of truth | Frontend types mirror the backend models; kept in sync by hand while the two are unwired |
| NF6 | Security | No auth (local) → OAuth2 (prod future) | Role-based access (planner, supervisor, admin) |

## Safety & Legal

**This is DECISION SUPPORT ONLY.** All plans must be verified on an **official loading computer** certified per **IACS UR L5** before cargo operations.

- App must always display: "Verify on approved loading computer"
- **Stability calculations are DEMO/INDICATIVE DATA:** Computed from simplified hydrostatics and weight distribution; not suitable for operational use
  - Does not account for actual ballast, fuel, or sludge at departure
  - Uses reference hydrostatics for a nominal load condition
  - Displayed angles are exaggerated 5× for visualization (real angles often <1°)
- Hard constraints approximate real rules; use certified software for final approval
- Loading sequence playback is a visualization aid only; does not simulate actual stowage operations

## Success Criteria Per Phase

| Phase | Exit Criteria |
|-------|---|
| 0 | Sample vessel profile + 3–5 real BAPLIE files loaded; domain model frozen |
| 1 | Open BAPLIE → see in 3D + 2D; select any container; 20k instances @ 60fps *(selection and 2D/3D sync are done; BAPLIE import and the 20k benchmark are not)* |
| 2 | Planner fixes plan by hand; violations shown real-time; export BAPLIE *(fix-by-hand and live validation are done; BAPLIE export is not)* |
| 3 | Auto-stow runs; 0 hard violations; restow count reported; KPI benchmark created |
| 4 | CP-SAT plans beat greedy on KPIs; within stability limits; async jobs working |
| 5 | AI explains placements; what-if solver calls; multi-port re-planning |

## Tech Stack Overview

**Frontend:** React 19 + TypeScript + Vite 6 + React Three Fiber 9 + drei 10 + three.js + Zustand 5 + TanStack Query 5 (provider mounted, no queries run) + Tailwind 4 + shadcn

**Backend:** Python 3.11 + FastAPI + Pydantic v2 + uvicorn; OR-Tools, NumPy (phase 4); pytest + httpx declared but no test suite exists

**Data:** PostgreSQL (phase 2+); BAPLIE EDIFACT interchange; JSON API (defined, unused by the app)

**Deployment:** Docker Compose (dev); cloud future (K8s / serverless)

## Key Decisions

1. **Validator before optimizer:** Anything the solver produces must pass the same rule engine a human plan passes
2. **One InstancedMesh for all container sizes:** per-instance matrix scale makes a 20' render at 20' while every box shares one draw call; 10k–20k boxes @ 60fps is the target
3. **Zustand state:** Two stores — small view state (selection, color mode, filters, drag/pick gesture + `dropOutcome`) and the editable plan with undo/redo (`usePlanDraftStore`, validate-then-mutate). Plan data is not in the React Query cache, and no query runs at all
4. **FastAPI + Protocol-based solvers:** Easy to add new solver implementations; interface enforced at type level
5. **BAPLIE (EDIFACT):** Industry standard interchange format; round-trip testing golden files
6. **One wording layer per outcome (P1/D4):** every surface that describes a drop — at-cursor chip, Container inspector, 2D bay-plan notice — renders `lib/drop-feedback.ts`, so no two can disagree. The chip is `aria-hidden`; the accessible copy stays in the sidebar

## Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Solver bugs → unsafe plans | Critical | Validation engine catches all violations before return; tester reviews all solver outputs — **not true today:** `/stowage/solve` returns solver output without validating it (roadmap gap 1), and greedy ignores stack weight and size fit |
| Stability calcs wrong | Critical | Use reference hydrostatics; phase 4 review with naval architect; always show "verify on certified computer" |
| 3D perf degrades | High | Benchmark at 20k instances; InstancedMesh optimization; LOD (future) |
| BAPLIE parse errors | Medium | Golden-file tests; support D.95B + SMDG 2.2/3.1 variants; fallback to manual entry |
| Multi-port re-planning complexity | Medium | Start with single voyage; test with 3–5 real port rotations; constraint relaxation heuristic (phase 5) |

## Open Questions

- Which reference vessel for phase 0? (feeder ~1–2.5k TEU preferred)
- IMDG segregation table scope: full IACS or simplified rules first?
- Stability: ballast / fuel model in phase 4 or defer to post-MVP?
- AI assistant: LLM + solver calls or pure RL agent in phase 5?
