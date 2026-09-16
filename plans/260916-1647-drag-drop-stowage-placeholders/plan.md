---
title: "Drag-drop cargo onto valid stowage placeholders (Phases A–C)"
description: "StowageModel foundation, shared placement checks with an editable plan + undo, and container placeholders/drop in the 3D viewer."
status: in-verification
priority: P2
effort: 3.5d
branch: master
tags: [frontend, viewer3d, engine, drag-drop, stowage, r3f, zustand]
created: 2026-09-16
---

# Drag-and-drop cargo onto valid stowage placeholders — Phases A–C

Authoritative spec: `plans/reports/confluence-260916-1647-drag-drop-stowage-placeholders-feature-plan.md` (§4.1–4.7 and §10 are binding for new file names + module boundaries).
Execution scope this run: **A–C only.** D–E deferred.

**Progress — 2026-09-16 (sync-back).** All three phases of the A–C scope are implemented and verified: **A** tester PASS + code-reviewer 9/10, then **reopened and fixed** for the 20' half-slot defect; **B** code-reviewer 7/10, all findings fixed in a follow-up pass; **C** code-reviewer 7.5/10, both High findings + M1/M3/M4/M6 fixed. Final state: `npm run typecheck` clean, `npm run build` succeeds, **70 files / 541 tests green** (baseline was 56/396). Remaining: the **manual browser click-through** — no DOM test capability exists in this repo, so it cannot be automated; the script is `plans/reports/manual-click-through-260916-phase-c.md` and phase-03's two WCAG/manual-acceptance boxes stay unticked until a human runs it. **D–E remain deferred** (not planned, not started — see "Deferred" below).

## Phase status

| Phase | File | Scope | Effort | Status |
|---|---|---|---|---|
| A | [phase-01-stowage-model-foundation.md](phase-01-stowage-model-foundation.md) | `StowageModel` (types/coords/builder/occupancy); rewrite `breakbulk-deck-area` as thin wrappers | ~1 d est. | **complete + verified** — reviewer 9/10, no critical issues; **reopened and fixed** the same day for the 20' half-slot defect (odd half-bays enumerated; predicate/validator parity at 0 mismatches) |
| B | [phase-02-placement-checks-and-editable-plan.md](phase-02-placement-checks-and-editable-plan.md) | `canPlaceContainer`/`canPlaceBreakbulk` + `usePlanDraftStore` (undo/redo) + App wiring | ~1–1.5 d est. | **complete + verified** — reviewer 7/10; C1/H1/W1/W3 fixed in a follow-up pass, recorded as deviations 8–13; browser violation-list check unticked (no browser; replaced by `predicate-report-parity.test.ts` + the guard files) |
| C | [phase-03-container-placeholders-and-drop.md](phase-03-container-placeholders-and-drop.md) | `validSlotsFor`, `SlotPlaceholders`, picker/ghost from the model, commit on drop, 2D click-to-place | ~1.5 d est. | **complete except the manual browser click-through** — reviewer 7.5/10; H1/H2 + M1/M3/M4/M6 fixed; 20' pick volume sized by candidate; the 2 manual-acceptance boxes stay unticked |

Actual effort: all three phases landed **2026-09-16** (same day) against the ~3.5 d estimate.

**Dependencies:** strictly sequential A → B → C. B consumes A's model and occupancy; C consumes B's checks and draft store. Nothing in B or C can start before the phase above it lands and its acceptance is met.

**Deferred — kept on the roadmap, not planned here:**
- **D — Project cargo placeholders + drop:** `freeRegionsFor`, `AreaPlaceholders`, `AreaDropPlane`, `GhostBreakbulkPreview`, unplaced project-cargo list, R-key 0/90° rotation, deck-vs-hold area selection.
- **E — Hardening & realism:** hatch-opening check, adjustable tweendeck pontoon levels, mixed stacking/lashing clearances, multi-select + keyboard nudging, magnet snapping (D2b), Playwright, **and deleting the `breakbulk-deck-area.ts` shim once its callers migrate to the model** (Validation Session 1).
- **Investigate — the single stranded 20' reefer (deferred 2026-09-16, user decision).** BBC SAO PAULO's `DEMU0001136` (20' REEFER, VNSGN→SGSIN, 22.7 t) has **zero** valid slots, which is the "19/20" figure the 20' workstream recorded. Suspicion: the vessel declares reefer plugs only on **even** bays (26/30/34) while `sizeFitsBay` sends 20' boxes to **odd** half-bays — so unless a half-slot inherits its 40' parent's `reefer_tiers` through `plugOk`/`stackFor`, the combination is *structurally* unplaceable rather than merely blocked by a loaded plan. The final tester verified the parity sweep passes (so no silent mismatch), but whether this is correct behaviour or a plug-resolution gap is unresolved. **Owner: Phase D/E.** Evidence: `plans/reports/tester-260916-final-ac-verification.md`; the equal-and-opposite question is whether the parity test's reefer case should assert `valid > 0` per vessel (it would currently fail on BBC, turning the gap red).
- Also from the final verification, Phase E cleanup: `EmptySlotPicker.tsx`'s comment still quotes the disputed "2400" overlap figure (the plan now records 1520 as correct), and two test-quality findings from the Phase B review remain unfixed — a now-tautological `can-place-breakbulk.test.ts` parity block (the rules it compares against call the predicate), and a zero-coverage assertion in `can-place-container.test.ts` that only exercises its own fixture builder.

## Supersedes — do not build both

`plans/260911-0945-p1-frontend-stowage-demo/phase-02-plan-draft-store-history-auto-stow.md`, `phase-03-interactive-2d-bay-plan.md` and `phase-04-3d-viewer-mixed-sizes-click-to-move.md` describe a **different** drag mechanism: DOM pointer-events + `document.elementFromPoint` + `data-drop` attributes + one shared `pickedId`, plus an SVG rewrite of `BayPlanView` and a side-by-side `.stage` layout.
**The Confluence spec supersedes that for drag-and-drop:** raycast stays (a canvas has no DOM rects to hit-test), `EmptySlotPicker` is re-sourced from the model, and the 2D bay plan is only a click-to-place fallback. Preserved because the spec is silent and those files got it right: the plan-draft store with undo/redo (phase-02), the 20% mid-cell dead-zone rule for 20' halves, and the `data-drop="unplaced"` contract should the 2D path be revived. `BayPlanView` stays `div` CSS-grid (no SVG rewrite); `.stage` stays stacked rows.

## Decisions adopted — recorded verbatim, do not re-litigate

| # | Decision |
|---|---|
| Tests | Pure-engine unit tests ONLY (`coords`, `occupancy`, `can-place-*`), written inside each phase. NO Playwright, NO jsdom/DOM/interaction tests, no new test toolchain (vitest runs `environment: 'node'`; jsdom/happy-dom are not installed). |
| D1 | Invalid drop: **block** hard physical rules (outside area, overlap, keep-out, slot size); **warn** overridable limits (overweight band, pressure, overstow). Severity configurable per rule. |
| D2 | Project-cargo snapping = **0.5 m grid now**; magnet-to-neighbours deferred to Phase E. |
| D3 | **Pause playback on drag start.** |
| D4 | Generic/"approximate" areas are **droppable with a badge + warning**. |

## Pre-flight / repo hygiene (do before Phase A — not a phase)

1. `frontend/src/features/viewer3d/EmptySlotPicker.tsx` and `GhostContainerPreview.tsx` are **untracked** (`??`) and Phase C modifies both. `BreakbulkCargoInstances.tsx`, `Hull.tsx`, `VesselScene.tsx` are modified. Commit this viewer3d baseline first so the Phase C diff is reviewable.
2. `.claude/` holds 418 uncommitted entries (204 deletions + 213 untracked ≈ 204 rename pairs) left by the batch-rename corruption that was renamed back. Commit that baseline separately, before any feature work.
3. Baseline to record: `cd frontend && npm test` → **56 files / 396 tests, all passing**; `npm run typecheck` clean.
4. Re-run both after every phase. `Sidebar.tsx` is already 261 LOC (breaches the 200-LOC rule) — Phase C splits it rather than growing it.

## Verified repo facts (checked this run — corrections to the spec's own assumptions)

- `data/deck-layout-from-spec.ts` does **not** exist; the real path is `frontend/src/engine/vessel-spec/deck-layout-from-spec.ts` (exports `apXToPlacementX`, `deckLayoutFromSpec`, `holdAreasFromSpec`). Path correction, not a gap.
- `frontend/src/engine/naive-fill-plan.ts` **exists** (48 LOC, `naiveFillPlan(vessel, containers)`).
- `*.stowage.json` `cargo_spaces` **exists** (`types/vessel-stowage-spec.ts:178`) and is populated for BBC SAO PAULO.
- `open_hatch_*` **exists but is not what the spec assumes**: only `open_hatch_draft_m` / `open_hatch_dwt_t` on `VesselParticularsSpec` (`types/vessel-stowage-spec.ts:116-117`) — open-hatch *condition* particulars, not hatch-*opening* dimensions. Phase E's "can it be lowered in?" check has no data source; fallback per spec §5 is skip + warn.
- The pre-existing failure is NOT deterministic: the suite passes 396/396 today. The cited assertion is `validate-plan.test.ts:66` `expect(ms).toBeLessThan(50)` (not line 65) — a wall-clock perf assertion, so it is flaky by nature. Do not plan to fix it; do not treat an intermittent failure as ours.
- **No vessel in the app declares an odd (20') stack bay** — BBC builds bays only from `spec.containers.stowage.bays` = [2,6,…,34] (its `twenty_foot_only` is explicitly unplanned) and MV Demo Horizon uses `2 + 4i` = [2,…,38]. <!-- Corrected 2026-09-16 (20' reopen): the FACT stands, the CONCLUSION below it did not. --> This bullet first concluded "so a 20' container has zero valid slots anywhere today". That consequence was wrong, and it was the defect: the validator's own `bayPosition`/`slotExists` already addresses the odd halves of a 40' bay, so the model was reopened to enumerate them (`stowage-model/slot-enumeration.ts`; demo 800 → 2400 slots, BBC 447 → 1341) and `canPlaceContainer` now agrees with `validatePlan` at **0 mismatches**. `naiveFillPlan` was deliberately left alone, so the demo's 20' boxes still load unplaced — placing them by hand is the feature. See phase-01's Status block and phase-03's corrections.

## Questions — resolved this run, and still open

**Resolved 2026-09-16 (user decisions — recorded, do not re-open):**
- **WCAG 2.5.7 vs the 2D fallback (was Q5) → option (a) adopted.** Phase C builds **pick-and-place** (`pickedId`: click/Enter to pick, then click a 3D placeholder or a 2D bay cell to place) as the primary, non-drag placement mechanism, reviving the superseded phase-03 design. Drag becomes sugar on top of the same commit resolver. A bay-plan-only-while-dragging fallback was rejected as knowingly non-compliant.
- **Baseline commits (pre-flight) → approved.** `.claude/` rename repair and the viewer3d baseline (incl. the two untracked picker/preview files) are committed before Phase A, as two separate commits.

**Open — default adopted (agent-proposed, user did not object; challenge during validation if wrong):**
1. **`StackSpec.max_height_m` semantics (Phase B)** — ~~open~~ **RESOLVED by Validation Session 1: per-item check** (`container.high_cube ? DIM.heightHC : DIM.height` ≤ `max_height_m`). See the Validation Log below.
2. **D1 "configurable per rule severity" has no config surface** in the spec. **Default: a code-level severity table in `engine/placement/reason.ts`**, not a user-facing setting (YAGNI).
3. **`plan.unplaced` ownership (Phase B)** — **default: derived** from `containers` − `placements` on every mutation (single source of truth); `Sidebar.tsx:82-85` reads the array directly.
4. **`EmptySlotPicker` when nothing is dragged (Phase C)** — **default: keep the full empty-slot picker mounted when idle** so hover-to-inspect (`Sidebar.tsx:200-205`) survives; swap to the drag's valid+blocked set only while dragging or while an item is picked.
5. **Store file naming** — **default: follow the spec + the existing sibling** (`src/store/usePlanDraftStore.ts`, camelCase), kebab-case for engine modules, PascalCase for components — matching current code.
6. **Spec §6's "Right-click or Delete → unplace"** — **default: deferred to Phase D.** Right-click collides with OrbitControls' pan button; Delete needs `selectedId`, which exists. Say if Delete is wanted in A–C.

**Open — genuinely blocked, no A–C impact:**
7. **`open_hatch_*` is the wrong data for Phase E.** The hatch-opening check needs opening *dimensions*; the type only has `open_hatch_draft_m`/`open_hatch_dwt_t` — open-hatch *condition* particulars. Either add spec fields (`hatch_opening_length_m`/`width_m`) or ship the spec §5 fallback (skip the check, warn). **Owner: Nadal + spec data.**

---

## Validation Log

### Session 1 — 2026-09-16
**Trigger:** Initial plan validation, immediately after plan creation from the Confluence spec (Gate 2 of `/cook`, after the spec was retrieved from a public share link).
**Questions asked:** 4

#### Questions & Answers

1. **[Architecture]** Phase A keeps `breakbulk-deck-area.ts` alive as thin wrappers over the new model (11 exports, no ripple). Keep that shim, or migrate its 6 callers and delete it?
   - Options: Wrapper now, delete in Phase E (Recommended) | Migrate callers in A, delete the file | Keep the wrapper permanently
   - **Answer:** Wrapper now, delete in Phase E
   - **Rationale:** A behaviour-preserving refactor should not also carry a 6-caller migration, but the spec's stated gap ("area and slot geometry are re-derived in several places") only truly closes when the shim is gone. Deferring the deletion to E keeps Phase A's blast radius small while preventing a permanent second geometry source.

2. **[Scope]** The per-stack `breakbulkOverlapsContainer` change frees project cargo beside container stacks — during a run whose UI is container-only. When should that behavioural loosening land?
   - Options: Land in A; tighten back if BBC regresses (Recommended) | Land in A unconditionally, fix violations | Defer the loosening to Phase D
   - **Answer:** Land in A; tighten back if BBC regresses
   - **Rationale:** The loosening is a *rule* change, not a UI change, so it can land in A — but a behaviour-preserving phase must not absorb a cleanup campaign. Naming the tie-breaker up front (revert the single rule, log it for Phase D) prevents an implementer from either silently accepting a new violation or blowing the phase's scope open.

3. **[UX]** Phase C adds "drag a placed container to move it", but today a click on a container selects it. How should the two coexist?
   - Options: Pointer-down past a drag threshold (Recommended) | Defer placed-container dragging to D | Move on plain pointer-down
   - **Answer:** Pointer-down, past a drag threshold
   - **Rationale:** Selection is already wired end-to-end (`ContainerInstances.onClick → setSelected`, the 2D bay plan, the Sidebar detail panel). Starting a move on plain pointer-down would silently redefine the app's primary selection gesture; a small threshold keeps both, and costs only the threshold constant.

4. **[Assumptions]** `StackSpec.max_height_m` carries a stowage space's whole `clear_height_m` but is used as a per-stack limit. Treat it as per-item or per-space?
   - Options: Per-item: box height ≤ max_height_m (Recommended) | Per-space: stacked column height ≤ clear height
   - **Answer:** Per-item: box height ≤ max_height_m
   - **Rationale:** Under-deck placement is a hard physical constraint; the failure mode of a false rejection (planner retries elsewhere) is far cheaper than the failure mode of a false acceptance (an over-tall column passing validation). Recorded as a conscious trade-off, reversible in one predicate.

#### Confirmed Decisions
- `breakbulk-deck-area.ts` stays as a wrapper through Phases A–D and is **deleted in Phase E** after its callers migrate.
- Per-stack `breakbulkOverlapsContainer` lands in Phase A; a new BBC violation → revert that one rule to whole-bay and log it for Phase D.
- Placed-container dragging requires a **small drag threshold**; a click without movement still selects.
- `max_height_m` is a **per-item** height check (conservative), not a per-space column check.
- (Carried from before validation) Phase C builds **pick-and-place** for WCAG 2.5.7; baseline commits approved as pre-flight.

#### Action Items
- [x] Propagate all four decisions into `phase-01`, `phase-02`, `phase-03` with `Validation Session 1` markers
- [x] Add the Phase E shim-deletion task to the deferred list in this file and to phase-01's Next Steps
- [ ] Phase E owner: write the caller-migration + deletion task when E is planned
- [x] Phase A implementer: report the BBC violation count explicitly after step 8 (per-stack rule) — this is the gate for decision 2 <!-- Tick: gate met 2026-09-16. The loosening changed NO placement (differential harness, both vessels, byte-identical old-vs-new) and `breakbulk-real-vessels-no-violations.test.ts` stayed green; the reviewer independently confirmed "no new violation → the Session-1 revert condition is not met" (`plans/reports/code-reviewer-260916-1930-phase-a-review.md` §"Per-stack loosening"). No revert, no Phase D follow-up needed. -->

#### Impact on Phases
- **Phase A:** Risk table — the `breakbulkOverlapsContainer` loosening now carries the explicit tie-breaker; "Delete" section and Next Steps note the Phase E handoff; the deprecation banner stays but is time-boxed to E rather than indefinite.
- **Phase B:** the `max_height_m` "ambiguity to settle" paragraph becomes a **decided** per-item check — no implementer discretion left.
- **Phase C:** the placed-container drag (Requirements + step 9) now requires a drag threshold so click-to-select survives.
- **Phase D/E:** E inherits the shim deletion; D is unaffected by all four decisions.

#### Recommendation
Proceed to implementation. The four decisions are closed, no decision blocks Phase A, and every phase's acceptance criteria name its own guard test.
