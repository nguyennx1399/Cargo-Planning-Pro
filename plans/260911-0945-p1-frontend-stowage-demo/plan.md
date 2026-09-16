# Phase 1 (frontend-first) — Interactive Stowage Demo

- **Parent roadmap:** [../260911-0939-cargo-planner-v2-roadmap/plan.md](../260911-0939-cargo-planner-v2-roadmap/plan.md) (Phase 1, container track)
- **Status:** Planned · **Total size:** ~4–6 weeks, 1 frontend dev
- **Goal:** Standalone browser demo: ~1,500 TEU sample container ship, pre-stowed cargo, planner can move/swap/load/unload/add/edit cargo, run auto-stow, undo/redo, and see rule violations + indicative list/trim/draft (ship heels in 3D) instantly.

## Decisions (user, 2026-09-11)
| Topic | Decision |
|---|---|
| Runtime | Frontend-only. Sample data bundled; rules, stability, auto-stow in TypeScript in the browser. No backend calls. |
| Vessel | Generated ~1,600 TEU container ship, 10×40' bays (800 cells; 12 bays don't fit the 172 m hull), mixed 20'/40' (470×40' + 400×20') |
| Adjustments | Move/swap, edit properties, load/unload/add, auto-stow, undo/redo |
| Stability | Live rules + indicative list/trim/draft from **demo** hydrostatics, labelled "DEMO DATA" |

## Out of scope
Backend changes, persistence/auth, BAPLIE, MPP holds, CargoUnit refactor (RT-12), multi-select, IMDG segregation, real hydrostatics, mobile layout.

## Phases
| # | Phase | Size | Depends | Status |
|---|---|---|---|---|
| 1 | [Demo data + TS rules engine](phase-01-demo-data-and-rules-engine.md) | M | — | Implemented, tested; code review pending |
| 2 | [Plan draft store, history, auto-stow, app wiring](phase-02-plan-draft-store-history-auto-stow.md) | M | 1 | Pending |
| 3 | [Interactive 2D bay plan (move/swap/drag)](phase-03-interactive-2d-bay-plan.md) | L | 2 | Pending |
| 4 | [3D viewer upgrades (20'/40', click-to-move)](phase-04-3d-viewer-mixed-sizes-click-to-move.md) | M | 2 | Pending |
| 5 | [Cargo editing panels](phase-05-cargo-editing-panels.md) | M | 2 | Pending |
| 6 | [Indicative stability + ship attitude](phase-06-indicative-stability-and-ship-attitude.md) | M | 1, 4 | Pending |
| 7 | [Demo polish, perf gate, docs](phase-07-demo-polish-perf-gate-docs.md) | S | 3–6 | Pending |

Phases 3, 4, 5 can run in parallel after 2 (distinct file ownership, listed per phase).

## Demo script (acceptance walkthrough)
1. App opens with no backend: ship ~95% stowed, 30 "late booking" boxes unplaced, 0 errors, GM ≈ 1 m, list ≈ 0°.
2. Drag a 30 t box to top tier far starboard: list rises, 3D ship heels within 300 ms.
3. Drop a 20' onto a 40' → blocked with a reason. Stack a 20' on a 40' via the edit path → `twenty_on_forty` error.
4. Increase a box weight → `stack_weight` error → Ctrl+Z restores.
5. Add a reefer and place it on a non-plug slot → `reefer_plug` error.
6. "Auto-stow remaining" places the unplaced boxes with 0 new hard errors; current placements are kept.
7. Push GM below 0.15 m (heavy on-deck) → critical "unstable" state, no heel angle shown.

## Red-team alignment
RT-1 sample data only · RT-2 permanent DEMO DATA banner, `verified:false` hydro · RT-7 GM ≤ 0.15 m → no angle, out-of-table → error · RT-8 engine = pure TS modules (no React) + perf gate · RT-4/12 container model kept, no refactor.

## Success criteria (overall)
- `npm run typecheck`, `npm run build`, `npm test` pass; every rule, stability guard, auto-stow and history has unit tests.
- Demo script passes end to end in Chrome with backend stopped.
- ≥55 fps orbiting at full load (~870 boxes) on the reference laptop; validate + stability recompute ≤16 ms per edit (dev overlay).

## Open questions
1. Reference laptop for the perf gate (M1/M2 Mac assumed).
2. Host the static demo (e.g. Vercel) now, or local only?
3. Python rules will lag the TS mixed-size rules; port back in the roadmap's Phase 2 (golden fixtures)?
