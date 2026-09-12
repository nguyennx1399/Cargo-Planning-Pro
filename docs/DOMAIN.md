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
- Units: meters. 20' = 6.058 m, 40' = 12.192 m, width 2.438 m, height 2.591 m (HC 2.896 m)

## Hard constraints (target list)

1. Size fits slot (20' in odd bay, 40' in even bay, no 20' under 40' unless allowed)
2. Stack weight ≤ limit (per row, under/on deck)
3. Stack height ≤ limit (hatch clearance, visibility line on deck)
4. Reefer only on slots with plugs
5. IMDG segregation (distance/separation by class)
6. No floating container (must be supported below)
7. Stability: GM ≥ min, trim/list within limits
8. Longitudinal strength: SF/BM ≤ allowable

## Soft objectives

- Minimize overstows / restows (container for later POD above one for earlier POD)
- Heavy containers low in the stack
- Balance crane split per port
- Minimize ballast needed for trim/list

## Glossary

POL / POD — port of loading / discharge · ETA / ETD — estimated time of arrival / departure ·
VGM — verified gross mass · OOG — out of gauge · GM — metacentric height ·
SF / BM — shear force / bending moment · BAPLIE — EDIFACT bay plan message.
