---
title: "Drag-drop UX polish pass — pointer feedback, precision, bulk list"
description: "At-cursor verdict feedback, pointer-driven slot resolution, gesture affordances and a searchable/groupable Unplaced list for the drag-drop editor shipped today."
status: pending
priority: P2
effort: 2d
branch: master
tags: [frontend, viewer3d, ux, drag-drop, r3f, panels, polish]
created: 2026-09-16
---

# Drag-drop UX polish pass (Phases P1–P2)

Follows Phases A–C (committed 2026-09-16 in `0950760`…`ff34642`). No new interaction models:
multi-select, swap, keyboard nudging of a placed box, "suggest a spot", drag-onto-2D and magnet
snapping stay deferred (Phase D/E of `plans/reports/confluence-260916-1647-…-feature-plan.md`).

**Baseline to hold (all machine-checked):** `npm run typecheck` clean · `npm run build` exit 0 ·
**70 files / 541 tests green** · predicate⇔report parity 0 mismatches · demo report **199** /
BBC **36** violations · `engine/__tests__/{validate-plan,breakbulk-real-vessels-no-violations}.test.ts`,
`data/__tests__/bbc-sao-paulo-containers.test.ts` and the geometry snapshot stay green **unmodified**.

## Phase status

| Phase | File | Scope | Effort | Status |
|---|---|---|---|---|
| P1 | [phase-01-pointer-feedback-and-precision.md](phase-01-pointer-feedback-and-precision.md) | At-cursor verdict chip, pointer-driven slot resolution (`nearestSlotIndex`), cursor/armed affordances, one wording for drop outcomes, release-path hardening | ~1–1.5 d | **implemented 2026-09-16, uncommitted** — 73 files / 566 tests green, typecheck clean, build exit 0, frozen guards unmodified. Open: the browser click-through (steps 22–28) and the docs sync |
| P2 | [phase-02-unplaced-list-bulk-index.md](phase-02-unplaced-list-bulk-index.md) | Search / filter / group / sort / "fits this bay" / arrow-key nav over the 400-row Unplaced list, from one pure query module | ~0.5–1 d | **implemented 2026-09-16, uncommitted** — 75 files / 586 tests green (+20), typecheck clean, build exit 0, frozen guards unmodified, review pass folded in. Open: the browser click-through (steps 29–34) and the docs sync |

**Dependencies:** none between them — either ships first. Sequential is recommended only because both
append to `styles.css` and the repo's ownership rule prefers one writer per file. P1 shrinks
`Sidebar.tsx` (190 → ~180) and removes `ContainerInspector`'s prop, so running P1 first leaves more
LOC headroom for P2.

## Why two phases, not one

The four dimensions the user picked split cleanly along a file boundary: dimensions 1–3 are the
**gesture surface** (canvas, picker, store outcome, cursor) and share `EmptySlotPicker` +
`usePlanStore` + `styles.css`; dimension 4 is the **list** (`UnplacedCargoList` and a new pure
module) and touches none of them. Splitting gives two independently shippable, independently
verifiable increments of ~1 d each instead of one ~2 d review unit. A single phase was rejected:
the two halves share no code, and the 400-row list (P2) can land first as a pure usability win even
if the P1 pointer-resolution decision is still open.

## Decisions adopted — recorded verbatim, do not re-litigate

| # | Decision |
|---|---|
| D1 | **The pick volume goes back to the pitch box for EVERY candidate** (`DIM.len40 + LAYOUT.bayGap`); the size-aware 20' volume is deleted. Precision comes from the resolution rule, not from shrinking the box — this honours phase-03's risk table ("do not shrink the pick box — that reintroduces dead zones") and removes the 0.076 m sibling-half dead zone it cost. |
| D2 | **Resolution = nearest slot centre to the cursor's ray crossing on the tier plane**, restricted to the candidate set — never three's distance-sorted box order. Rejects the recorded H2 "camera side decides" defect and the 0.402 m BBC boundary hazard for all four shapes. |
| D3 | **No new npm dependency.** Tailwind 4 utilities + existing shadcn (`input`, `select`, `checkbox`, `toggle-group`, `label`) only. |
| D4 | **The chip and the Sidebar read the same `drop-feedback.ts`.** One function per wording; the chip is `aria-hidden` (the Sidebar stays the screen-reader source) so no `aria-live` spam on pointer move. |
| D5 | **`dropOutcome` moves into `usePlanStore`** (one place), replacing `Sidebar`'s local `releaseNotice`; it is set by the release path AND by the pick click (fixes review M2) and cleared on gesture start. |
| D6 | **Validator-first unchanged:** `commitPlacement → canPlaceContainer` stays the only gate. The picker's parity filter stays rendering-only; P2's bay filter is a *rendering* filter worded as a size/parity claim and never gates a drop. |
| D7 | Tests: pure-engine/lib/store unit tests only, `environment: 'node'`. No DOM test tooling added. Anything not machine-checkable becomes a numbered step appended to `plans/reports/manual-click-through-260916-phase-c.md` (**extend steps 1–21, never replace**). |

## Pointers

- Spec (binding for §4.x module boundaries): `plans/reports/confluence-260916-1647-drag-drop-stowage-placeholders-feature-plan.md`
- Shipped plan + phase files (design decisions, dated corrections): `plans/260916-1647-drag-drop-stowage-placeholders/`
- Acceptance script this plan extends: `plans/reports/manual-click-through-260916-phase-c.md`
- Findings folded in: `code-reviewer-260916-phase-c-ui-review.md` (M2, M5, M6, Lows, H2 follow-through) · `tester-260916-final-ac-verification.md` (1520/1554, 0.402 m, 0.076 m, BBC 20' reefer) · `code-reviewer-260916-1955-phase-b-review.md` (W9 strip discipline, M4 memo) · `researcher-260916-1628-dnd-intent-and-patterns.md` (WCAG 2.5.7, no DnD library)

## Resolved by the user — 2026-09-16 (recorded, do not re-open)

1. **D2 approved: go.** Nearest-centre resolution + the pitch box for every candidate. The resolution boundary moves from "which box the ray enters first" to "which centre is nearer the pointer" — accepted as a deliberate behavioural change to the core gesture, justified because it converts both recorded precision defects (the 0.402 m BBC boundary hazard and the sibling-half ambiguity) from human-observed into node-tested. Evidence and the four rejected alternatives are in phase-01 Key Insights.
2. **"Fits bay NN" = size/parity only, worded as such.** Rejected the exact-predicate variant on its measurement: ≈11.2k `canPlaceContainer` calls ≈ **39 ms per recompute**, and it recomputes after every drop — a hitch landing exactly when a box is being placed. Ships with a per-row badge stating the weaker claim plus an anti-divergence test proving the filter can never hide a container the engine would accept in that bay. The exact variant stays a recorded follow-up with its measurement.
