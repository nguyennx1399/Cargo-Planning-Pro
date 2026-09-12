---
name: cargo-catalog-breakbulk-phase03-04-followups
description: Phase 03-04 re-review of plans/260912-0117-cargo-type-catalog-breakbulk — confirms the LOA/LBP Critical bug from phase-01/02 review is FIXED and complete; two smaller follow-ups found
metadata:
  type: project
---

Phase 03-04 re-review (2026-09-12) of `plans/260912-0117-cargo-type-catalog-breakbulk`, focused on verifying the fix for [[cargo-catalog-breakbulk-phase01-02-followups]]'s Critical LOA-vs-LBP finding. Full report: `plans/260912-0117-cargo-type-catalog-breakbulk/reports/code-reviewer-phase-03-04-cargo-catalog-breakbulk.md`. 329/329 tests green, typecheck clean.

**Verdict: the Critical bug is genuinely fixed and complete.** `engine/cargo/breakbulk-mesh-builder.ts` and `lib/breakbulk-weight-item.ts` both correctly treat `BreakbulkPlacement.x_m`/`z_m` as `vessel.length_m/2`-symmetric and convert to scene/true-ship-frame respectively (option (b) from the prior review, traced side-by-side against `cargo-weight-item.ts`'s inversion — identical). All other call sites (`breakbulk-deck-area.ts`, `breakbulk-forbidden-zones.ts` (renamed `bayCenterXShipFrame`→`bayCenterXVesselRelative`, no stale refs), `naive-fill-breakbulk.ts`, `breakbulk-validation-rules.ts`, `breakbulk-overlap-check.ts`, `build-demo-plan.ts`) verified consistent by reading in full, not trusting the "already correct" claim blindly.

**High finding — the phase-03 "cross-system regression test" (`breakbulk-mesh-builder.test.ts`, "does not render inside that bay's actual scene x range") does NOT actually discriminate old-vs-new code.** Traced numerically: old bug is a constant `+(length_m-lbp_m)/2 = +6m` shift toward +x/bow, applied uniformly regardless of position. Test places the item on the bow side of the bow-most bay, i.e. exactly the side where the +6m shift moves the item further away (not into) the bay — passes under old buggy code too (11m clearance vs expected 5m, still positive). A real discriminating test needs the item on the aft/opposite side of a bay so the uniform shift pushes it toward the bay instead of away.
**Why:** matters because this is presented as THE regression guard for this exact bug class; a future reintroduction of `x_m - lbp_m/2` would slip through silently.
**How to apply:** recheck this test if this file changes again; recommend adding an aft-side placement case.

**Medium finding — `breakbulkWeightItem`'s `kg_m` omits `LAYOUT.hatchHeight` (0.6m) that the renderer uses as the deck reference for the same item.** `cargoWeightItem`'s `kg_m = sceneY + depth_m` folds in hatchHeight via `tierCenterY`'s onDeck base; `breakbulkWeightItem`'s `kg_m = depth_m + kg_above_base_m` skips it. Same class of mistake as the original bug (silently dropped reference-frame offset) but ~0.6m vs up to 12m — understates VCG slightly, overstates GM margin. Existing test for this is tautological (asserts code equals itself).
**Why:** same "silently reintroduce a smaller version of the same bug class" risk the original review warned about — worth checking any time `breakbulk-weight-item.ts` changes.
**How to apply:** if this file is touched again, verify `kg_m` includes `LAYOUT.hatchHeight` (or equivalent shared deck-base constant with the mesh builder) before treating it as consistent.

**Confirmed non-issues (checked, not just assumed):** tower cylinder `rotateZ` order is correct (rotate-then-translate, origin-centered) and doesn't affect collision safety since `footprintRect` is pure AABB off `x_m`/`z_m`, never the mesh; `BreakbulkCargoInstances.tsx` dropping its `VesselGeometry` requirement is a genuine improvement with nothing depending on the old null-guard (breakbulk fields are non-optional on `StowagePlan`).
