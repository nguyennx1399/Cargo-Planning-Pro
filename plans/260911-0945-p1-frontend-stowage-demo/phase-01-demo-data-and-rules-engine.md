# Phase 01 — Demo data + TypeScript rules engine

## Context links
- Plan: [plan.md](plan.md) · Domain: `docs/DOMAIN.md` (slot codes, axes)
- Port source: `backend/app/validation/{rules,context}.py`, `backend/app/domain/slot.py`, `backend/app/data/sample.py`

## Overview
- **Priority:** P0 (everything builds on it) · **Size:** M · **Status:** Pending
- Bundle the demo vessel and cargo in the frontend. Port the 6 Python rules to pure TS and extend them for mixed 20'/40'. Add Vitest.

## Key insights
- The skeleton is 40'-only (`sample.py:46`, `ContainerInstances.tsx:61`). Mixed sizes need half-aware occupancy: a 40' in bay 02 fills both 20' halves (bays 01 fore, 03 aft) at the same row/tier.
- The engine must be framework-free (`src/engine/**` imports no React/Zustand/three) so it can be shared or ported later (RT-8).
- Keep `types/domain.ts` as the backend mirror. Put demo-only types (hydrostatics) in the engine/data modules.

## Requirements
**Functional**
- `buildDemoVessel()` returns a `Vessel` named "MV Demo Horizon", LOA 172 m, beam 27.4 m.
  - 40' bays 02, 06, … 38 (10 bays); 20' bays are 01/03, 05/07, …
  - Rows port→stbd: on deck `[10,8,6,4,2,1,3,5,7,9]`; under deck `[8,6,4,2,1,3,5,7]`.
  - Tiers: under 02–10 (5), on 82–88 (4). 800 FEU cells = 1,600 TEU.
  - *Changed during implementation:* the planned 12 bays × 13.4 m pitch + 22 m bow margin did not fit a 172 m hull.
- Stack limits: under deck 130 t, on deck 90 t per 40' column. Tuned so edits can break them.
- Reefer plugs: on-deck tiers 82 and 84 in the 4 aftmost bays.
- `generateDemoCargo(seed)` is deterministic (mulberry32):
  - 470 × 40' and 400 × 20' boxes; 8% reefer, 3% IMDG, 30% HC (40' only).
  - Weights: 20' 4–28 t, 40' 4–30 t. POL VNSGN; PODs SGSIN, MYPKG, LKCMB, AEJEA.
  - IDs use prefix `DEMU` and a valid ISO 6346 check digit.
- `validatePlan(vessel, plan): ValidationReport` runs these rules:

| Rule | Sev | Logic |
|---|---|---|
| slot_exists | error | Parent 40' stack exists and the tier is in `stack.tiers` |
| size_fits_bay | error | 40' → even bay; 20' → odd bay |
| cell_conflict | error | Two boxes on the same half, or a 40' overlapping a 20' at the same row/tier |
| twenty_on_forty | error | A 20' sits directly on a 40' |
| no_floating | error | Every occupied half above the lowest tier has its half below occupied |
| stack_weight | error | Σ weight per (40' bay, row, deck) > `max_weight_t` |
| reefer_plug | error | REEFER on a tier not in `reefer_tiers` |
| overstow | warning | Per half-column: box above has a later POD sequence than a box below |

- KPIs: `placed`, `unplaced`, `teu_placed`, `teu_capacity`, `utilisation_pct`, `errors`, `warnings`, `overstows`.

**Non-functional**
- `validatePlan` on ~800 placements takes ≤ 5 ms (rough micro-bench in a test, logged).

## Architecture
```
src/engine/
  slot-helpers.ts          isFortyBay, parentFortyBay, halvesOf, isOnDeck, slotCode, parseSlotCode
  validation-context.ts    cells map `${fortyBay}|${row}|${tier}` -> {fore?, aft?, forty?}; columns; pod seq
  placement-checks.ts      small predicates reused by rules AND auto-stow (DRY): supportOk, sizeOk, plugOk, columnWeight
  validation-rules.ts      ALL_RULES: Rule[]  (split into rules-occupancy.ts / rules-limits.ts if >200 LOC)
  validate-plan.ts         runs ALL_RULES, builds KPIs -> ValidationReport
src/data/
  demo-container-vessel.ts buildDemoVessel()
  demo-cargo-generator.ts  mulberry32, iso6346CheckDigit, generateDemoCargo, DEMO_PORTS
```
`Rule = (ctx: ValidationContext) => Violation[]`. This matches the Python signature, so porting stays 1:1.

## Related code files
- **Create:** the files above, plus `src/engine/__tests__/*.test.ts` and `src/engine/__tests__/test-vessel-fixture.ts` (2 bays × 2 rows).
- **Modify:** `package.json` (devDeps `vitest`; script `"test": "vitest run"`). `vite.config.ts` stays unchanged: Vitest reuses it, including the `@` alias, and its defaults (node env, `*.test.ts`) are enough.
- **Delete:** none.

## Implementation steps
1. Add Vitest and the `test` script, and check that an empty test run passes.
2. `slot-helpers.ts`: port `slot.py` and add `halvesOf(bay)` (`{fortyBay, half: "fore"|"aft"|"both"}`).
3. `validation-context.ts`: build the cells and columns once per run, with tiers sorted bottom→top.
4. `placement-checks.ts`, then the rules, one function each. Messages follow the Python style (`"{id}: reefer on slot without plug"`).
5. `validate-plan.ts`: aggregate the rules and compute KPIs. Sort errors before warnings.
6. Data generators. `iso6346CheckDigit` uses letter values A=10, B=12…Z=38, skipping multiples of 11, weights 2^i, mod 11 then mod 10.
7. Tests: at least one pass and one fail case per rule, plus check-digit known values (`CSQU3054383` → 3) and generator determinism.

## Todo
- [x] Vitest setup
- [x] slot-helpers + tests
- [x] context + placement-checks
- [x] 8 rules + tests
- [x] validate-plan + KPIs
- [x] demo vessel + cargo generators + tests
- [ ] code review (code-reviewer agent). Paused 2026-09-11 for usage limits; resume with `/cook` on this file.
- [ ] finalize: docs sync. Not a git repo, so there's no commit step.

Status 2026-09-11: implemented; typecheck clean; 78/78 tests pass; validatePlan takes 4.6 ms for 870 boxes. Tester report: `reports/tester-260911-1007-phase-01-engine.md`.

## Success criteria
`npm test` is green, with ≥16 rule tests. `npm run typecheck` is green. There are no React or three imports under `src/engine`.

## Risks
- Half-aware logic bugs → table-driven tests for 20/20, 40, 20+40 overlap, and 20 on 40.
- TS/Python rule drift → record it in the Phase 07 docs as a known gap (roadmap Phase 2 adds golden fixtures).

## Security
No real data: everything is synthetic (RT-1).

## Next
Phase 02 consumes `validatePlan`, the generators, and `placement-checks`.
