# Ship stability during crane lifts

Source: BBC Guideline v1.0 (2009) §1.3. Script: `scripts/stability_calcs.py`.

## Parameters
Ship constants (capacity plan / crane documentation):
| Sym | Meaning |
|---|---|
| B | moulded breadth (use B/2 as lever to the rail) |
| q | boom-top (main hoist) level above base, sea position |
| r | level of stowed lifting gear (spreaders, traverses) above base, sea position |
| sy | transverse distance between centres of the opposite heeling tanks |
| Q | boom mass effectively acting at the boom top: `Q = mb·e1/e` (mb boom mass, e1 pivot→boom c.o.g., e pivot→hoist) |
| f | offset of the boom's lower pivot from the crane-post centre |

Per-lift variables:
| Sym | Meaning |
|---|---|
| P | cargo mass · R: slings/spreaders mass · S: ballast to transfer at max heel (several tank pairs if needed) |
| a | max outreach beyond the ship's rail (from pre-planning) |
| p | max boom-top elevation above base during the lift (if unsure: highest topping position) |
| sz | vertical shift of the transferred ballast · d: working radius |

## Crane capacity vs radius
- SWL depends on working radius d. Plan with **P + R** against the SWL/radius curve; this fixes max outreach
  a and the feasible stowage place.
- SWL is usually tabulated in 50 t steps → interpolate linearly for intermediate loads
  (`swl_radius_interpolate`).
- Simulate turning in/out (scale paper model on the capacity plan, or software) for large units.
- Single crane: hook must stay in the permitted range throughout; highest boom elevation usually at the stowage end.
- Dual crane with connecting beam: outreach limited by beam length and post spacing; max elevation typically as
  the unit passes between the posts. Hoist wires must remain vertical.
- Dual crane without beam: unit longer than the gap between posts goes through end-first; max elevation may
  occur outboard, between posts or at stowage — check all.

## Stability check (master's responsibility, document it, send to BBC)
1. Loading computer: actual condition with all cargo, tanks, covers/pontoons in place, cranes in sea
   position → displacement Δ and KG_C (free-surface corrected).
2. Required anti-heeling ballast: `S = (P + R + Q)·(B/2 + a) / sy`. The source tank must hold S; the
   receiving tank must be able to take it.
3. Worst lifting moment (highest topping):
   `KG*_C = KG_C + [P·(p − KG_C) + Q·(p − q) + R·(p − r) + S·sz] / (Δ + P)`
   `GM*_C = KM* − KG*_C` with KM* for displacement Δ + P in the actual trim.
4. Criterion: **GM*_C ≈ 1 m, never below 0.6 m.**

## Stability pontoons (outriggers)
- Use the hydrostatic tables for activated pontoons in every calculation.
- Designed only for ±3° heel. **Operational heel limit with pontoons: 1°** (unless the ship's manual says
  otherwise). Correct heel with ballast immediately when approaching it.
- Overloading the outriggers (pontoon lifted too high or pushed too deep) collapses the extra righting lever
  instantly → capsize risk with the load on the hook. Never rely on pontoons beyond their range.
