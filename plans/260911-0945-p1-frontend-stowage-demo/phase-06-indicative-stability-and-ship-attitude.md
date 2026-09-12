# Phase 06 — Indicative stability + ship attitude in 3D

## Context links
- Plan: [plan.md](plan.md) · Depends on [phase-01](phase-01-demo-data-and-rules-engine.md), [phase-04](phase-04-3d-viewer-mixed-sizes-click-to-move.md)
- Formulas: source doc §8. Red-team constraints RT-2 and RT-7 in the [roadmap plan](../260911-0939-cargo-planner-v2-roadmap/plan.md)
- Python stub: `backend/app/stability/calc.py`

## Overview
- **Priority:** P1 (the demo's "wow" moment) · **Size:** M · **Status:** Pending
- Compute displacement, drafts, trim, list and GM from **made-up demo hydrostatics** on every edit. Heel, trim and sink the 3D ship against fixed water. Keep the safety guards.

## Key insights
- The numbers are indicative only. Hydrostatics are invented for a plausible 1,500 TEU ship and flagged `verified:false`. The UI must always say "DEMO DATA" (RT-2).
- Guards come first (RT-7): GM ≤ 0.15 m → critical state and **no angle**; Δ outside the table → error and **no numbers**; |list| > 10° → "beyond small-angle model".
- Real angles are small (trim of 1 m over 172 m is 0.33°). Offer a clearly labelled "Exaggerate ×5" view toggle, off by default.

## Requirements
**Demo hydrostatics** (`src/data/demo-hydrostatics.ts`), interpolated linearly with **no extrapolation**:

| Δ (t) | T (m) | KM (m) | LCB (m, +fwd) | LCF (m) | MTC (t·m/cm) | TPC |
|---|---|---|---|---|---|---|
| 10000 | 4.2 | 13.9 | -1.0 | -2.0 | 260 | 32 |
| 14000 | 5.7 | 12.6 | -1.6 | -3.0 | 290 | 34 |
| 18000 | 7.1 | 11.9 | -2.2 | -3.9 | 320 | 36 |
| 22000 | 8.5 | 11.6 | -2.6 | -4.6 | 345 | 37 |
| 26000 | 9.8 | 11.5 | -3.0 | -5.2 | 370 | 38 |
| 30000 | 11.0 | 11.6 | -3.3 | -5.8 | 390 | 39 |

- Lightship: 7,500 t, LCG −8 m, KG 9.8 m. Fixed "constant" deadweight: 3,500 t, LCG −20 m, KG 4 m.
- LBP 160 m. Max draft 10.5 m.
- Tune these if the demo plan's GM falls outside 0.5–2.5 m; a test locks this in.

**Calc** (`src/engine/stability-indicative.ts`, pure):
- Δ = lightship + constant + Σ cargo.
- LCG = Σw·x / Δ, TCG = Σw·z / Δ (starboard +), KG = Σw·vcg / Δ. Container VCG = `vcgFromKeel` (Phase 04), at box centre.
- T_mean from the table. GM = KM − KG (no FSC in the demo; say so in the UI tooltip).
- trim = Δ·(LCG − LCB) / (100·MTC), where + means by the head.
- T_f = T_m + trim·(L/2 − LCF)/L and T_a = T_m − trim·(L/2 + LCF)/L.
- list = atan(TCG / GM), only when GM > 0.15.
- Output: `{status: "ok" | "warning" | "critical" | "out_of_range", values…, messages[]}`.

**Demo thresholds:**
- Error: GM < 0.15 m, |list| > 5°, T_max > 10.5 m.
- Warning: GM < 0.5 m, |list| > 2°, |trim| > 1.5 m.

**Stability violations** appear in ChecksPanel as rules `stability_gm`, `stability_list`, `stability_draft` (errors) and `stability_trim` (warning), so there is one violation list.

**StabilityPanel:**
- Δ, T_f / T_m / T_a, trim (by head/stern), list (port/stbd), GM, KG/KM.
- Status badges; a persistent "DEMO DATA — not for operational use" banner; the Exaggerate toggle.

**3D attitude** (`ShipAttitude` logic applied to `ShipGroup`):
- group.y = KEEL_DEPTH − T_mean, so the keel sits at −T_mean against water at y = 0.
- rotation.x = +list (starboard list lowers +z); rotation.z = −atan(trim / LBP) (by head lowers +x).
- Smooth transitions with `THREE.MathUtils.damp` in `useFrame` (~0.3 s).
- In the critical state: no rotation; a pulsing red hull edge plus the overlay text "UNSTABLE — GM below 0.15 m".

**Non-functional**
- Stability + validation recompute ≤ 16 ms per edit. The visual response starts within 300 ms of a drop.

## Related code files
- **Create:** `src/data/demo-hydrostatics.ts`, `src/engine/hydrostatic-table-lookup.ts`, `src/engine/stability-indicative.ts`, `src/features/panels/StabilityPanel.tsx`, `src/features/viewer3d/useShipAttitude.ts`, tests.
- **Modify:** `src/hooks/usePlanDerived.ts` (add stability and merge the stability violations), `ShipGroup.tsx`, `Hull.tsx` (critical edge state), `Sidebar.tsx` (mount the panel), `usePlanStore.ts` (`exaggerate` flag).

## Implementation steps
1. Table lookup + tests: in-range interpolation, exact rows, out of range → `null`.
2. Stability calc + tests:
   - Symmetric load gives list 0.
   - Adding a starboard weight gives starboard list.
   - GM ≤ 0.15 gives critical with no angle.
   - Δ beyond 30,000 t gives out_of_range.
   - The demo plan has GM in 0.5–2.5 m and |list| < 1°.
3. Merge the stability violations into the derived report.
4. StabilityPanel + banner.
5. Attitude hook with damping, plus the exaggerate toggle.
6. Visual check of demo script steps 2 and 7.

## Todo
- [ ] demo hydrostatics + lookup + tests
- [ ] stability calc + guards + tests
- [ ] violations merge
- [ ] StabilityPanel
- [ ] 3D attitude + damping + exaggerate
- [ ] critical-state visuals

## Success criteria
- All guard tests pass.
- Moving a 30 t box to the far-starboard top tier visibly heels the ship (with ×5 on) and the numbers change within 300 ms.
- The critical state never shows an angle.

## Risks
- Planners may read the demo numbers as real → a permanent banner in the panel and in 3D; tooltips say "no free surface, no GZ curve, invented hull data".
- Sign-convention mistakes → the directional tests in step 2 are mandatory.

## Security
Liability is addressed by the persistent disclaimer (it matches the README safety notice).

## Next
Phase 07 verification.
