# Project Roadmap

**Last Updated:** 2026-09-17 · **Version:** 0.1.0 (skeleton)

Full task checklist: [PLAN.md](./PLAN.md) — the original phase plan, retained for scope/effort context.
**This file is the living status source** when the two disagree. Changes since 2026-09-16 are in
[project-changelog.md](./project-changelog.md).
Principle: **validator before optimizer** — every plan (human or solver) passes the same rule engine.

## Phase Status

| Phase | Scope | Est. | Status | Progress |
|---|---|---|---|---|
| 0 | Domain & data: reference vessel, real BAPLIE files, freeze data model v1 | 1–2 wk | Not started (synthetic sample only) | ~10% |
| 1 | 3D + 2D viewer | 2–4 wk | In progress | ~70% |
| 2 | Manual editor + validation | 3–4 wk | In progress — editor shipped (Phases A–C), UX polish P1/P2 committed (`b61234a`) | ~60% |
| 3 | Auto-stow v1: greedy heuristic | 2–3 wk | Placeholder solver | ~15% |
| 4 | Optimization (CP-SAT) + stability | 4–8 wk | Stubs only | ~0% |
| 5 | AI layer | ongoing | Not started | 0% |

Percentages are rough estimates from code inspection, mirrored in [README](../README.md) and
[project-overview-pdr.md](./project-overview-pdr.md). Phase 2 credits the committed editor (place/move by
drag or click-to-pick, undo/redo, live validation) plus the P1/P2 pointer-feedback and bulk-retrieval
polish (committed 2026-09-17 as `b61234a`), but still counts BAPLIE IO, the remaining rules (IMDG, stack
height, OOG), swap, persistence and the unfinished browser click-through as open. The figure stays ~60%
— landing the commit closed no open item on that list.

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
- [x] One InstancedMesh for every size (per-instance length scale) — supersedes the earlier "separate mesh for 20'/45'" plan, since one mesh with per-instance scaling already renders each length correctly
- [ ] Selection outline shader (`TODO(phase-1)` in `ContainerInstances.tsx`)
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
- [x] Find a box in the Unplaced list at scale — search, size/type filters, sort, grouping, "Fits bay NN" and roving arrow-key focus (P2, committed `b61234a`; see below)
- [ ] PostgreSQL + plan versions

### Drag-drop stowage editor — Phases A–C (2026-09-16)

Spec: [confluence-260916 drag-drop stowage placeholders](../plans/reports/confluence-260916-1647-drag-drop-stowage-placeholders-feature-plan.md) · Plan: [260916-1647-drag-drop-stowage-placeholders](../plans/260916-1647-drag-drop-stowage-placeholders/plan.md)

- [x] **A — StowageModel:** `engine/stowage-model/` (areas, slots incl. 20' odd half-bays, occupancy); `breakbulk-deck-area.ts` becomes a thin shim
- [x] **B — Placement checks + editable plan:** `engine/placement/` predicates; `usePlanDraftStore` (validate-then-mutate, undo/redo); App loads the demo plan into the draft store
- [x] **C — Container placeholders + drop:** `validSlotsFor`, 3D placeholders, three-state ghost tint, one commit resolver for drag and click-to-pick, bay-plan click-to-place, undo/redo/Esc keys
- [ ] **C (acceptance):** the manual browser click-through — [script](../plans/reports/manual-click-through-260916-phase-c.md). Engine/store behaviour is unit-tested; the browser interactions are not machine-verified (no DOM test environment). The drag/drop flow has since been hand-exercised (that is how the `b61234a` defect was found), but the full script, steps 22–34, is unrun
- [ ] **D — Project cargo placeholders + drop** (deferred): `freeRegionsFor`, area drop plane, ghost breakbulk preview, 0/90° rotation, deck-vs-hold selection
- [ ] **E — Hardening & realism** (deferred): hatch-opening check, adjustable tweendeck pontoon levels, multi-select/nudging, magnet snapping, Playwright, **and deleting the `breakbulk-deck-area.ts` shim**

### Drag-drop UX polish — Phases P1–P2 (2026-09-16, committed 2026-09-17 as `b61234a`)

Plan: [260916-2117-optimize-drag-drop-ux](../plans/260916-2117-optimize-drag-drop-ux/plan.md) · Acceptance: steps 22–34 of the [same click-through script](../plans/reports/manual-click-through-260916-phase-c.md)

Status: **implemented 2026-09-16, unit-tested and committed 2026-09-17** (`b61234a`
`fix: drag/drop container feature`; 75 files / 586 tests green, typecheck clean, build exit 0), and
**manually exercised in-browser** — that exercise is how the container drag/drop defect fixed in
`b61234a` was found. The repo still has no DOM test environment (`environment: 'node'`; jsdom and
testing-library are deliberately not installed), so no *test* covers the pointer. Open: the full
browser click-through (steps 22–34) and the docs sync. Landed, not released — do not read either
phase as complete.

- [x] **P1 — pointer feedback & precision:** cursor-driven slot resolution by nearest slot **centre** to the ray's tier-plane crossing (`lib/nearest-slot.ts`) — closes the recorded H2 "camera side decides" defect, the 0.402 m BBC bay-boundary hazard and the 0.076 m sibling-half dead zone; one wording layer (`lib/drop-feedback.ts`) behind every surface; at-cursor verdict chip (`DropVerdictChip.tsx`, `aria-hidden`); cursor classes + 2 px "armed" ring (`use-drop-cursor.ts`); `dropOutcome` in `usePlanStore` (D5) replacing `Sidebar`'s local notice, written only by `commit-placement.ts`; release hardening (`e.button` guard, `pointercancel`/`blur` cancel)
- [x] **P2 — bulk retrieval over the Unplaced list:** pure `lib/unplaced-query.ts` + presentation-only `UnplacedListControls.tsx`; search, size/type filters, sort (cargo order / POD rotation / weight heavy-first / id), grouping (none / POD / type / size, collapsible with per-group counts), ArrowUp/Down/Home/End roving focus, "Fits bay NN" toggle; list height 140 px → 320 px; header becomes `Unplaced (n of N)` when filtered, "No container matches." + Clear filters when empty
- [x] **Keyboard:** Esc and the arrow keys in `use-stowage-keyboard-shortcuts.ts` return early on INPUT/TEXTAREA, so Esc inside the new search box does not cancel an armed pick
- [ ] **Acceptance (both phases):** browser click-through steps 22–34 — human-observed only

**Decision D6 (recorded):** the "Fits bay NN" toggle is a **rendering-only** filter worded as a
size/parity claim (`BAY_CAVEAT = "Size and parity only — the slot still has to pass every check."`).
It never gates a drop — `commitPlacement → canPlaceContainer` remains the only gate. The
exact-predicate variant was measured at ≈11.2k `canPlaceContainer` calls ≈ 39 ms per recompute and was
rejected.

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
- [ ] Tests, backend: **there is no `backend/tests/` directory** and pytest collects nothing — despite
      `pytest` and `httpx` sitting in `backend/requirements.txt`. One test per rule is still TODO.
      (An earlier revision of this file claimed `test_api`/`test_slot` existed; they do not.)
- [x] Tests, frontend: 75 files / 586 tests green (`cd frontend && npm test`), pure-unit only. Note the command **exits non-zero** — the default vitest `include` also sweeps ClaudeKit's `.claude/**` tests (30 failed files, 0 under `src/**`); see [codebase-summary.md](./codebase-summary.md)
- [ ] DOM/interaction tests — no jsdom, no testing-library; every pointer interaction is human-observed
- [ ] BAPLIE golden-file round-trip (phase 2/3)
- [ ] CI of any kind (`.github/` does not exist; typecheck/build/test are run by hand)
- [ ] "Verify on approved loading computer" disclaimer in UI (IACS UR L5)

## Known Gaps

1. `/stowage/solve` returns solver output without running `validate()`.
2. Greedy ignores stack weight and size fit → demo plan may contain violations.
3. No persistence; in-memory vessel cache only.
4. `breakbulk-deck-area.ts` is a temporary shim (11 exports) over `engine/stowage-model/`; Phase E deletes it once its callers migrate.
5. The 2D bay plan addresses whole bays only — a 20' odd half-bay drop is 3D-only. `naiveFillPlan` still places no 20' box, so a demo plan loads with those unplaced by design.
6. **The frontend and the backend are not wired.** `frontend/src/api/client.ts` has no importers and
   there is no `fetch`/`axios`/`/api/` call anywhere in `frontend/src`; the demo plan is built by
   `data/build-demo-plan.ts` and validated by `engine/validate-plan.ts`. The Vite `/api` proxy and the
   mounted React Query provider are configured but idle. The backend's 5 endpoints are real but
   reachable only by hand (curl, `/docs`).
7. **No machine-verified interaction anywhere.** The repo has no DOM test environment, so every
   pointer/drag/keyboard behaviour in the editor rests on unit tests plus manual browser exercise.
   Drag/drop and pick-and-place have been driven by hand in a browser (that is how the `b61234a`
   defect was found), but the acceptance click-through — steps 22–34 — is still unrun, so nothing
   beyond that ad-hoc pass has human coverage.

## Unresolved Questions

- Which reference vessel / real BAPLIE samples for phase 0?
- IMDG: simplified segregation table first, or full IMDG code?
