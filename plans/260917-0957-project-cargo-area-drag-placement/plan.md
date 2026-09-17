---
title: "Project cargo — set up stowage areas and drag cargo anywhere inside them (Phase D)"
description: "Area placeholders, a per-area drop plane, live-checked free positioning with 0.5 m snap + 0/90° rotation, and the unplaced project-cargo list."
status: planned
priority: P2
effort: 2.5–3 d
branch: master
tags: [frontend, viewer3d, engine, drag-drop, breakbulk, project-cargo, r3f, zustand]
created: 2026-09-17
---

# Project cargo — area setup + free drag placement (Phase D)

Continues `plans/260916-1647-drag-drop-stowage-placeholders/` (Phases A–C, shipped 2026-09-16).
Authoritative spec: `plans/reports/confluence-260916-1647-drag-drop-stowage-placeholders-feature-plan.md` §4.6, §5, §6, §7 Phase D.
Interactive prototype of the whole gesture, built and driven in a browser this run: [visuals/area-drag-prototype.html](visuals/area-drag-prototype.html) (real BBC SAO PAULO areas).

**The two questions this plan answers**
1. *How do I set up the available area?* — write it in the vessel's `*.stowage.json` (`cargo_spaces` + `obstructions`); no code change. Phase 01 documents the path and the generic fallback.
2. *How do I move cargo anywhere inside it?* — one invisible drop plane per visible area, pointer → `x_m/z_m` → snap 0.5 m → clamp inside the area → live `canPlaceBreakbulk` → green/amber/red ghost → click/release commits. Phases 02–03.

**Containers are done and unchanged.** Containers snap to discrete `bay|row|tier` slots (Phase C). Project cargo is *free-positioned* inside a rectangle — a different mechanism sharing one predicate, one store and one commit resolver.

## Phase status

| Phase | File | Scope | Effort | Status |
|---|---|---|---|---|
| 01 | [phase-01-stowage-area-setup-and-free-regions.md](phase-01-stowage-area-setup-and-free-regions.md) | Area authoring path + `freeRegionsFor` + pure pose helpers (snap/clamp/scene↔pose) | ~0.5 d | planned |
| 02 | [phase-02-area-placeholders-and-ghost-preview.md](phase-02-area-placeholders-and-ghost-preview.md) | `AreaPlaceholders`, `AreaDropPlane`, `GhostBreakbulkPreview`, `verdictForPose` | ~1 d | planned |
| 03 | [phase-03-in-hand-state-commit-and-move.md](phase-03-in-hand-state-commit-and-move.md) | `inHand {kind,id}` store refactor, breakbulk commit, unplaced list, move/rotate/unplace | ~1 d | planned |
| 04 | [phase-04-hardening-docs-and-acceptance.md](phase-04-hardening-docs-and-acceptance.md) | Generic-area badge, sidebar hints, docs, manual click-through | ~0.5 d | planned |

**Dependencies:** strictly sequential 01 → 02 → 03; 04 last. 02 consumes 01's pose helpers and region data; 03 consumes 02's verdict + ghost.

## Decisions (carried from the spec + this run's prototype)

| # | Decision |
|---|---|
| D1 | Hard rules (outside area, keep-out, overlap, too tall, over pressure) **block**; overridable limits (20 m band weight, generic area) **warn** and are recorded. Unchanged from Phase C. |
| D2 | Snap = **0.5 m grid**. Magnet-to-neighbour stays Phase E. |
| D4 | `source: "generic"` areas are droppable, with a badge + recorded warning. |
| **D-P1** | **Snap first, then clamp to grid-rounded inward bounds.** Clamp-then-snap rounds the centre back outside the area (observed: 6.5 m item, z ±9.1 m hold → clamp −5.85 → snap −6.0 → 0.15 m over). Pinned by a unit test. |
| **D-P2** | **Clamp the ghost inside the hovered area by default** (toggleable). Clamping never relaxes a rule — overlap/keep-out still refuse. |
| **D-P3** | Rotation stays **0°/90° only** (`footprintRect` understands nothing else). Arbitrary angles = engine change, not planned. |
| **D-P4** | Keep-outs are **clipped to the area rect** for drawing; a crane foundation outside the usable rect is not drawn (it would read as "the area reaches here"). |
| **D-P5** | Hull **auto-hides** while an item is in hand and under-deck areas are shown. |

## Deferred (Phase E, unchanged)

Hatch-opening check (no data — `open_hatch_*` is the wrong field), adjustable tweendeck pontoon levels, breakbulk stacked on containers/flat-racks, lashing clearances, multi-select + keyboard nudge, magnet snapping, Playwright, deleting the `breakbulk-deck-area.ts` shim.

## Open questions

1. **Weather deck = one envelope rect over 18 declared `cargo_spaces`.** `bestEnvelope` collapses them, so the usable rect can include deck that is not really flat/usable. Accept for now (the check refuses nothing it should); real fix = multi-rect areas. **Owner: Nadal + spec data.**
2. **Container slots vs areas in one gesture** — default adopted: the hand's `kind` decides which layer mounts; never both.
3. **Breakbulk-on-breakbulk stacking** — out of scope; every drop rests on the area surface.
