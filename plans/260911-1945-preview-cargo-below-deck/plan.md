# Preview Cargo Below Deck

- **Related:** [P1 frontend demo](../260911-0945-p1-frontend-stowage-demo/plan.md) — its phase-04 already owns `features/viewer3d/**`/`lib/geometry.ts` (not started yet); this plan touches the same files for one small feature and should be coordinated with whoever picks that phase up, not merged into it (kept separate: this is a UI toggle, not the "20'/40' mixed sizes + click-to-move" restructure that phase owns).
- **Status:** Complete
- **Size:** S (single phase, <3 tasks — no task hydration per skill rule)

## Problem
Under-deck cargo (`plan.store`'s existing `showUnderDeck` toggle) can already be isolated from on-deck cargo, but the **hull and deck fittings stay fully opaque/visible regardless** — hatch covers in particular sit right at deck level with a solid, non-transparent material (`merge-static-components.ts`'s "deck-fittings" group), physically blocking a top-down or 3D-orbit view into the hold even when only under-deck containers are shown. There's no way today to "see inside" the ship.

## Goal
A "Hull" visibility toggle next to the existing On deck / Under deck checkboxes in the Sidebar's "Show" section. Unchecked: hides the hull mesh and all merged component groups (superstructure, deck-fittings, crane), leaving only the water reference plane and containers — giving a clear, unobstructed view of under-deck stowage. Checked (default): current behavior, unchanged.

## Scope (v1, this plan)
- One new boolean in the view store (`usePlanStore`), one checkbox in `Sidebar.tsx`, conditional rendering in `Hull.tsx` (both `LoftedHull` and `SimpleBoxHull` paths, so it works for any vessel — with or without `geometry_id`).
- No new engine/math code — pure UI wiring, reusing everything already built this session (`Hull.tsx`, `merge-static-components.ts`, the store pattern already used for `showOnDeck`/`showUnderDeck`).

## Explicitly out of scope (YAGNI for v1 — note for later if actually needed)
- **Splitting hatch covers into their own material group** (currently merged with funnel/mast/lifeboat under "deck-fittings" in `merge-static-components.ts`) so a user could hide *just* the hatch covers while keeping masts/funnel visible for spatial context. Real usability improvement, but doubles the file's material-group count and needs its own tests; do this only if the binary hull toggle turns out to be too blunt in practice.
- A dedicated 2D "hold plan" cross-section view (top view + section, per roadmap phase-01 1.J / P1-demo's `BayPlanView` — currently a stub). That's a materially bigger feature (SVG grid, its own file) already scoped elsewhere; this plan is 3D-only.
- Camera automation ("fly inside the hold"). OrbitControls (already present) is enough; no camera tweening added.
- A 3-way Solid/Transparent/Hidden toggle. Binary (shown/hidden) is enough for v1 — the hull mesh is already semi-transparent (opacity 0.18) when shown, so "Solid vs Transparent" isn't really a missing state today, only "blocks the hatch/deck view vs doesn't."

## Phases
| # | Phase | Depends | Status |
|---|---|---|---|
| 01 | [Hull visibility toggle](phase-01-hull-visibility-toggle.md) | — | Complete |

## Success criteria
- Unchecking "Hull" hides the hull mesh + all component groups in both the lofted-hull path (vessel with `geometry_id`) and the box-hull fallback path (vessel without one).
- Checking it back shows everything exactly as before (no state loss, no re-fetch, no perf regression — this is pure visibility, not remount, so no rebuild of the hull mesh).
- Combined with the existing "Under deck" checkbox and "On deck" unchecked, a user sees under-deck cargo with nothing else in the way.
- `npm run typecheck`, `npm run build`, `npm test` all green; no change to any existing test's expectations (this is additive, not a behavior change to anything that exists).
