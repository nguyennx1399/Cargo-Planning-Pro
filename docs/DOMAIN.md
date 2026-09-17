# Domain notes

## Slot coordinates (ISO bay-row-tier)

- **Bay**: odd = 20' positions (01, 03, 05…), even = 40' spanning two 20' bays
  (bay 02 = bays 01+03). Numbered from **bow to stern**.
- **Row**: `00` on centerline (only if odd number of rows); odd rows to **starboard**
  (01, 03…), even rows to **port** (02, 04…), counting outward.
- **Tier**: under deck 02, 04, 06… from the bottom; on deck 82, 84, 86… (sometimes 80+).
- Slot string: `BBRRTT`, e.g. `140682` = bay 14, row 06, tier 82 (on deck).

## 3D axes used in the app

- **Scene coordinates:** `x` = longitudinal (bow = +x), `y` = vertical (up), `z` = transverse (starboard = +z)
- **Ship frame coordinates** (ISO/naval convention): `x` = longitudinal from **aft perpendicular (AP)** toward bow, `y` = from **baseline** upward, `z` = transverse **+starboard**
- Conversion: See `frontend/src/lib/ship-frame.ts` (`shipToScene`, `sceneToShip`). Phase 0 of [vessel-3d-model-pipeline](../plans/260911-1409-vessel-3d-model-pipeline/plan.md) defines the contract.
- **Placement footprint `x_m` is NOT ship frame:** `BreakbulkPlacement.x_m` is symmetric about `vessel.length_m / 2` (0 at the stern end, +bow). Convert to scene x only through `engine/stowage-model/coords.ts` (`placementXToSceneX` / `sceneXToPlacementX`) — re-deriving the offset by hand has caused a real bug.
- Units: meters. 20' = 6.058 m, 40' = 12.192 m, width 2.438 m, height 2.591 m (HC 2.896 m)

## Hard constraints (target list)

Status column = what the code enforces **today**. The live gate is the frontend predicate
`engine/placement/can-place-container.ts`; `/api/validate` implements a thinner subset, so a plan
can pass one and fail the other.

| # | Constraint | Status |
|---|---|---|
| 1 | Size fits slot (20' in odd bay, 40' in even bay, no 20' under 40' unless allowed) | **enforced** — `size_fits_bay` + `twenty_on_forty` |
| 2 | Stack weight ≤ limit (per row, under/on deck) | **enforced** — `stack_weight` |
| 3 | Stack height ≤ limit (hatch clearance, visibility line on deck) | **partly** — `max_height` (hatch clearance) is enforced; the on-deck visibility line is TODO |
| 4 | Reefer only on slots with plugs | **enforced** — `reefer_plug` |
| 5 | IMDG segregation (distance/separation by class) | **not implemented** — no rule anywhere; `imdg_class` is carried but never checked |
| 6 | No floating container (must be supported below) | **enforced** — `no_floating` |
| 7 | Stability: GM ≥ min, trim/list within limits | **DEMO/indicative only — NOT a hard constraint.** Nothing enforces these as limits. The frontend (`engine/stability-indicative.ts`) computes GM/trim/list/drafts with advisory warning thresholds and is explicitly labelled demo-grade, not for operational use; the backend (`stability/calc.py`) is a stub that sums cargo weight and leaves every other field `None`. Treat as a target for phase 4 |
| 8 | Longitudinal strength: SF/BM ≤ allowable | **not implemented** — no shear-force or bending-moment calculation exists in either half; backend `stability/calc.py` documents it as a phase-4 TODO |

Item 7 is listed here because it is a *target*, not because the system checks it. Per IACS UR L5, any
stability figure this app produces must be re-verified on a class-approved loading computer.

## Soft objectives

- Minimize overstows / restows (container for later POD above one for earlier POD)
- Heavy containers low in the stack
- Balance crane split per port
- Minimize ballast needed for trim/list

## Glossary

POL / POD — port of loading / discharge · ETA / ETD — estimated time of arrival / departure ·
VGM — verified gross mass · OOG — out of gauge · GM — metacentric height ·
SF / BM — shear force / bending moment · BAPLIE — EDIFACT bay plan message.
