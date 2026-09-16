# Phase A — StowageModel foundation (refactor, no visible UI change)

## Context Links

- Spec: `plans/reports/confluence-260916-1647-drag-drop-stowage-placeholders-feature-plan.md` §4.1–4.4 (types, builder, coords, occupancy), §7 Phase A, §10 file map.
- Recon: `plans/reports/scout-260916-1628-viewer3d-placeholders.md`, `plans/reports/scout-260916-1628-ui-deps.md`, `plans/reports/researcher-260916-1628-dnd-intent-and-patterns.md`.
- Superseded for the drag mechanism only: `plans/260911-0945-p1-frontend-stowage-demo/phase-03-interactive-2d-bay-plan.md`.
- Overview: [plan.md](plan.md).

## Overview

- **Priority:** P2
- **Size:** ~1 day
- **Status:** pending
- **Blocks:** Phase B and Phase C (both consume the model).

Behaviour-preserving refactor. After this phase the app must render BBC SAO PAULO and MV Demo Horizon exactly as before, with the single exception that project cargo may now fit beside container stacks (per-stack footprints instead of whole-bay x-zones).

## Key Insights

**The data the model needs already exists — this is a re-shape, not new parsing.**
- Weather deck = `vessel.breakbulk_deck` (`BreakbulkDeckLayout`: `area`, `keep_out[]`, `cargo_base_height_m`, `max_cargo_height_m?`, `deck_load_t_per_m2?`).
- Holds = `vessel.breakbulk_holds[]` (`BreakbulkHoldArea` = `BreakbulkDeckLayout` + `{id, label, level: "tweendeck"|"tank_top", hold?}`), already ordered largest-first by `holdAreasFromSpec` (`engine/vessel-spec/deck-layout-from-spec.ts:148-176`).
- `StowageLevel` (spec §4.1) is the same union as the spec type's `CargoSpaceLevel`: `"weather_deck" | "tweendeck" | "tank_top"`.
- So `StowageArea.surfaceY` = `cargoBaseHeight(vessel, areaId)`, `maxHeight` = `maxCargoHeight(vessel, areaId)` (`Infinity` when undeclared), `loadRating` = `deckLoadRating(vessel, areaId)`, `keepOuts` = `deckKeepOuts(vessel, areaId)`. Reuse the existing accessors when building; never re-derive from LOA fractions a second time.

**`engine/breakbulk-deck-area.ts` (91 LOC) is the surface Phase A must keep stable.** Its public API is `WEATHER_DECK_AREA_ID`, `areaIdOf`, `stowageAreaIds`, `isKnownArea`, `isUnderDeck`, `areaLabel`, `deckArea`, `deckKeepOuts`, `cargoBaseHeight`, `maxCargoHeight`, `deckLoadRating` — all consumed by `naive-fill-breakbulk.ts`, `breakbulk-validation-rules.ts`, `breakbulk-mesh-builder.ts`, `lib/breakbulk-weight-item.ts`, `Sidebar.tsx:15`. Signatures must not change, so there is no ripple.

**Three-state area lookup is load-bearing.** `layoutFor()` returns the layout, `null` for an *unknown hold id*, or `undefined` for the *generic weather deck* of a vessel with no `breakbulk_deck`. `deckArea` maps `null` → an empty rect at the origin and `undefined` → the 15%/85%-LOA approximation. The model builder must preserve this distinction (an unknown area id must stay "no usable area", not silently become generic).

**Generic-deck margins are exact constants to reproduce:** `BOW_MARGIN_FRACTION = 0.15`, `STERN_MARGIN_FRACTION = 0.15`, `BEAM_MARGIN_M = 1.5` (`breakbulk-deck-area.ts:18-20`), giving `x ∈ [0.15·LOA, 0.85·LOA]`, `z ∈ ±(beam/2 − 1.5)`. Spec §4.2 says the same in words; copy the arithmetic verbatim from the existing function rather than retyping it.

**Slot geometry sources — do not invent new ones.** `allSlots(vessel)` (`engine/all-slots.ts:7-14`) expands `vessel.stacks` (each `StackSpec` lists its valid `tiers` for one bay+row+deck). `slotToPosition(vessel, slot)` (`lib/geometry.ts:88-97`) returns `[bayCenterX, tierCenterY, rowCenterZ]`. Spec §4.1 requires `SlotDef.center` to be *identical* to `slotToPosition` — so compute it by calling it.

**`bayCenterXVesselRelative` in `breakbulk-forbidden-zones.ts:20-26` is a third copy of the bay-x math** (declared `container_layout.bay_center_x_m`, else the LOA/bowMargin/pitch fallback) and deliberately ignores the calibrated `geometry.bay_lcg_m` path that `lib/geometry.ts:56-59` has. That duplicate is exactly the "re-derived in several places" gap the spec's §3 names. The model owns it from now on; forbid-zones is deprecated after callers migrate.

**Cache identity is safe.** `getVesselCatalogEntry` memoises built vessels by id (`data/vessel-catalog.ts:24-31`), so a `WeakMap<Vessel, StowageModel>` gives a stable model across renders without any invalidation logic. Test fixtures spread into new objects → new cache entries, which is correct.

## Requirements

**Functional**
- One `StowageModel` per vessel: `areas: StowageArea[]`, `areaById`, `slots: SlotDef[]`, `slotByKey`.
- `buildStowageModel(vessel)` + `WeakMap` cache; optional dev-only `Object.freeze` on built vessels (spec §9).
- `areasAt(model, x_m, z_m, onDeck?)` — resolves a drop point to candidate areas; several can match (hatch cover over tank top), the deck toggle disambiguates.
- `coords.ts` is the ONLY home for scene↔`x_m` offsets: `placementXToSceneX`, `sceneXToPlacementX`, `placementToScene(x_m, z_m, surfaceY, lift)`, `rectFromCenter`, `rectContainsPoint`, `rectContainsRect`, `snap(value, step)`.
- `occupancy.ts`: `occupiedStacks(vessel, placements)` (one footprint per bay/row/deck that actually carries a container — reads *placements*, never capacity), `containerOccupancy(vessel, placements) → Map<areaId, OccupiedStack[]>`, `breakbulkOccupancy(cargo, placements) → Map<areaId, Rect[]>`.
- On-deck stacks block the weather deck; under-deck stacks block every hold area they overlap (a column passes through the tweendeck above the tank top); an undeclared row blocks the full beam (conservative fallback, spec §4.4).
- `naiveFillBreakbulk` gains `occupiedRects?: Record<areaId, Rect[]>`, seeded into `placedRects` per area; keeps the positional `forbiddenXZones` param for backward compatibility (`engine/__tests__/breakbulk-real-vessels-no-violations.test.ts:27` passes `[]`). Iterate hold areas from the model.
- `build-demo-plan.ts` `withBreakbulkCargo` switches to `occupiedRectsByArea(vessel, plan.placements)` instead of whole-bay x-zones.
- `breakbulkOverlapsContainer` checks per-area occupied stack rects; message names the stack (`overlaps on-deck container stack bay 30 row 04`).
- `breakbulk-mesh-builder.ts` and `lib/breakbulk-weight-item.ts` take their offsets and surface Y from `coords`/the model.
- Mark `engine/breakbulk-forbidden-zones.ts` deprecated; keep the file until no caller remains.

**Non-functional**
- Every code file < 200 LOC; kebab-case self-describing names; update existing files rather than adding "enhanced" copies.
- Zero new npm dependencies.
- The new modules are **pure** — no `react`, `three`, `zustand`, `@react-three/*`, `@tanstack/*` imports. Note `engine/__tests__/validate-plan.test.ts:69-79` (the RT-8 purity test) is **non-recursive**: it only scans files directly in `src/engine/`. New files under `engine/stowage-model/` and `engine/placement/` are not covered by it, so keep the purity voluntarily, and never add a three/react import to a file placed directly in `src/engine/`.
- `npm run typecheck` (tsc) passes.

## Architecture

Spec §4.1–4.4, with the existing accessors as the data source:

```
Vessel (breakbulk_deck? / breakbulk_holds[]? / container_layout? / stacks)
  │
  ▼  buildStowageModel(vessel)   [WeakMap<Vessel, StowageModel>]
StowageModel { areas: StowageArea[], areaById, slots: SlotDef[], slotByKey }

StowageArea  <- breakbulk_deck | breakbulk_holds[i]  (rect/keepOuts/surfaceY/maxHeight/loadRating/source)
SlotDef      <- vessel.stacks × tiers, center = slotToPosition(vessel, slot)

occupancy(plan.placements) ──> occupiedStacks / containerOccupancy / breakbulkOccupancy
coords.ts    ──> the only scene↔x_m offset home (mesh builder, weight item, picker, checks)
```

`breakbulk-deck-area.ts` becomes thin wrappers: each existing export resolves `model.areaById.get(areaId ?? WEATHER_DECK_AREA_ID)` and returns the same shape as today.

**`areaId` assignment rules (spec §4.2):** on-deck slot overlapping the weather-deck rect → weather deck; under-deck slot whose *centre* falls in a hold area → that hold; otherwise `null`. On-deck vs under-deck is `tier >= 80` (the existing `ON_DECK_TIER_THRESHOLD` in `breakbulk-forbidden-zones.ts:9` and `validation-rules.ts`'s tier convention).

**Slot footprint:** 40' × 2.438 m in plan view per spec §4.2. No vessel in the app has an odd bay (see Phase C), so a constant 40' footprint is correct today — carry a one-line TODO comment rather than branching for 20' now (YAGNI).

## Related Code Files

**Create**
- `frontend/src/engine/stowage-model/types.ts` — `StowageLevel`, `StowageArea`, `SlotDef`, `StowageModel`.
- `frontend/src/engine/stowage-model/coords.ts` — the offset home.
- `frontend/src/engine/stowage-model/build-stowage-model.ts` — builder + `WeakMap` cache + `areasAt`.
- `frontend/src/engine/stowage-model/occupancy.ts` — three occupancy functions.
- `frontend/src/engine/stowage-model/index.ts` — barrel.
- `frontend/src/engine/stowage-model/__tests__/coords.test.ts`, `build-stowage-model.test.ts`, `occupancy.test.ts` (pure-engine unit tests, this phase).

**Modify**
- `frontend/src/engine/breakbulk-deck-area.ts` — rewrite as wrappers over the model; public signatures unchanged.
- `frontend/src/engine/naive-fill-breakbulk.ts` — `occupiedRects` option; hold areas from the model.
- `frontend/src/engine/breakbulk-validation-rules.ts` — `breakbulkOverlapsContainer` per-area stack rects + named message.
- `frontend/src/engine/breakbulk-forbidden-zones.ts` — deprecation banner; keep exports.
- `frontend/src/data/build-demo-plan.ts` — `withBreakbulkCargo` uses `occupiedRectsByArea`.
- `frontend/src/engine/cargo/breakbulk-mesh-builder.ts` — offsets via `coords`, surface via area `surfaceY`.
- `frontend/src/lib/breakbulk-weight-item.ts` — same.

**Delete** — none in Phase A. <!-- Updated: Validation Session 1 - shim deletion scheduled for Phase E -->
`breakbulk-deck-area.ts` is deprecated-but-kept here (Session 1 decision: wrapper now, migrate its 6 callers and delete the file in **Phase E**) — add the caller-migration + deletion to Phase E's scope rather than leaving the shim permanently.

## Implementation Steps

1. Read `engine/breakbulk-deck-area.ts`, `lib/geometry.ts`, `types/domain.ts` (`BreakbulkDeckLayout`, `BreakbulkHoldArea`, `BreakbulkPlacement`, `ContainerLayout`) and `engine/vessel-spec/deck-layout-from-spec.ts` end to end before writing anything; the x_m convention comment on `BreakbulkPlacement` (`types/domain.ts:138-146`) is the contract.
2. Write `stowage-model/types.ts` exactly per spec §4.1. Reuse the domain type names (`BreakbulkKeepOut`, `Rect` from `engine/breakbulk-overlap-check.ts`) instead of redeclaring them (DRY).
3. Write `stowage-model/coords.ts`: `placementXToSceneX(x_m, lengthM) = x_m - lengthM / 2` and its inverse (this is the inversion `breakbulk-mesh-builder.ts:27-29` and `lib/breakbulk-weight-item.ts:15` already do by hand — make it one function), plus `placementToScene`, `rectFromCenter` (mirrors `footprintRect`), `rectContainsPoint`, `rectContainsRect`, `snap`. No three.js import; return plain tuples.
4. Write `build-stowage-model.ts`: areas from `vessel.breakbulk_deck` (or the generic 15%/85% + beam−1.5 m rect, `source: "generic"`) and from `vessel.breakbulk_holds` in declared order; `source: "declared"` for both declared cases. Slots from `allSlots(vessel)` with `center = slotToPosition(vessel, slot)`, `deck` from `tier >= 80`, `maxStackWeightT` from the resolving `StackSpec.max_weight_t`, and `areaId` per the rules above. Wrap the build in `WeakMap.get`/`set`. Add `areasAt(model, x_m, z_m, onDeck?)`.
5. Write `occupancy.ts`: `occupiedStacks`, `containerOccupancy`, `breakbulkOccupancy`. Read `plan.placements`, not `vessel.stacks` — an empty ship must stay free (the same reasoning `breakbulk-forbidden-zones.ts:28-33` documents).
6. Write `index.ts` barrel, then rewrite `breakbulk-deck-area.ts` to delegate to the model while keeping every export name and signature. Keep `isUnderDeck` and `areaIdOf` behaviourally identical.
7. Add `naive-fill-breakbulk.ts`'s `occupiedRects?: Record<string, Rect[]>` option: seed `placedRects` with it per area (keeps keep-outs seeded as today), and iterate `vessel.breakbulk_holds` from the model instead of re-reading them. Keep the `forbiddenXZones` positional parameter and its behaviour.
8. Rework `breakbulkOverlapsContainer` to test each footprint against that area's occupied stack rects; build the message from the stacking bay/row. Keep the rule id `breakbulk_overlaps_container`.
9. Point `breakbulk-mesh-builder.ts` and `lib/breakbulk-weight-item.ts` at `coords` + the area's `surfaceY`; delete their local `sceneX` helpers.
10. Switch `build-demo-plan.ts`'s `withBreakbulkCargo` to `occupiedRectsByArea(vessel, plan.placements)` and drop its `onDeckBayZones`/`underDeckBayZones` imports; leave `holdForbiddenXZones` unset once occupancy covers it (verify no regression on BBC first).
11. Add the deprecation banner to `breakbulk-forbidden-zones.ts`; grep for remaining callers and leave them working.
12. Write the three `__tests__` files: coords round-trip (`placementXToSceneX ∘ sceneXToPlacementX` = identity), builder (area count/order/source for BBC vs MV Demo Horizon, the generic-deck rect matches the old `deckArea` output exactly, slot count = `allSlots().length`, `areaId` spot-checks), occupancy (empty plan → no occupancy; one on-deck container blocks only the weather deck; one under-deck container blocks its hold area).
13. Run `npm run typecheck` and `npm test`; then boot `npm run dev` and visually confirm BBC SAO PAULO and MV Demo Horizon render unchanged with the demo cargo and project cargo toggles.

## Todo List

- [ ] Read the four context files end to end (deck-area, geometry, domain types, deck-layout-from-spec)
- [ ] `stowage-model/types.ts` per spec §4.1, reusing domain types
- [ ] `stowage-model/coords.ts` with `placementXToSceneX`/`sceneXToPlacementX` + rect helpers + `snap`
- [ ] `stowage-model/build-stowage-model.ts`: areas (declared + generic), slots, `areaId` rules, `WeakMap` cache
- [ ] `areasAt(model, x_m, z_m, onDeck?)` with multi-match support
- [ ] `occupancy.ts`: `occupiedStacks`, `containerOccupancy`, `breakbulkOccupancy` (placements, not capacity)
- [ ] `stowage-model/index.ts` barrel
- [ ] Rewrite `breakbulk-deck-area.ts` as wrappers; all exports + signatures unchanged
- [ ] `naive-fill-breakbulk.ts`: add `occupiedRects`, keep `forbiddenXZones`; holds from the model
- [ ] `breakbulkOverlapsContainer`: per-area stack rects + stack-naming message, same rule id
- [ ] Move `breakbulk-mesh-builder.ts` + `breakbulk-weight-item.ts` offsets onto `coords`/`surfaceY`
- [ ] `withBreakbulkCargo` uses `occupiedRectsByArea`
- [ ] Deprecate `breakbulk-forbidden-zones.ts`, callers still green
- [ ] Unit tests: coords round-trip, builder (BBC + MV Demo Horizon + generic rect equality), occupancy
- [ ] `npm run typecheck` clean; `npm test` 396/396; both vessels visually unchanged

## Success Criteria

**Spec acceptance, quoted verbatim (spec §7 Phase A):**
> - tsc passes. The app renders BBC SAO PAULO and the generic demo vessel exactly as before, apart from project cargo that may now fit beside container stacks.
> - The BBC demo plan still has 0 breakbulk/stack-weight errors.

**Repo-specific additions**
- `cd frontend && npm run typecheck` passes.
- Existing suite still passes: 56 files / 396 tests (396 passing today; the `validate-plan.test.ts:66` wall-clock assertion is flaky and must not be "fixed" or weakened as part of this phase).
- `engine/__tests__/breakbulk-real-vessels-no-violations.test.ts` stays green — it calls `naiveFillBreakbulk(vessel, cargo, [])` positionally, so the third parameter's type and position are frozen.
- `engine/__tests__/naive-fill-breakbulk.test.ts` (7 tests) and `lib/__tests__/breakbulk-weight-item.test.ts` (5 tests) stay green — they pin today's placement coordinates and KG, which is exactly the behaviour this phase must not move.
- No new dependency in `frontend/package.json`.
- No file over 200 LOC.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Coordinate regression (the x_m / ship-frame bug class this phase exists to kill) | Medium | High | Single `coords.ts`; never pass `x_m` into `shipToScene`; coords round-trip unit test; visually diff both vessels. |
| `deckArea` output drift breaks the BBC demo | Medium | High | Assert the generic rect equals the pre-refactor `deckArea` values in a test written against the old constants (0.15/0.15/1.5); compare BBC's declared rect byte-for-byte. |
| Under-deck vs on-deck `areaId` mis-assignment silently frees/blocks the wrong area | Medium | Medium | Explicit occupancy tests for one on-deck and one under-deck container; `areasAt` spot-checks against BBC's known hatch/hold rects. |
| `breakbulkOverlapsContainer` becoming per-stack *loosens* a rule and lets the packer place cargo a validator now flags | Medium | High | **Tie-breaker (Validation Session 1): land the loosening in Phase A, and if a NEW violation appears on BBC, revert that one rule to whole-bay and record it as a Phase D task — do not chase it inside a behaviour-preserving phase.** `breakbulk-real-vessels-no-violations.test.ts` is the gate. <!-- Updated: Validation Session 1 - loosening tie-breaker --> |
| Model cache staleness if a vessel object is mutated | Low | Medium | WeakMap keyed on object identity; dev-only `Object.freeze` (spec §9); tests use spreads, which yields fresh entries by design. |
| Accidental three/react import into `src/engine/*.ts` root | Low | Medium | Keep all new modules in subdirectories; the RT-8 test only scans the root, so root purity is a real (if narrow) gate. |

## Security Considerations

- Frontend-only, read-only data flow: no new network calls, no auth, no server trust boundary, no persistence. The FastAPI backend is untouched by this phase.
- No user input is parsed or rendered unescaped; the builder consumes typed vessel data only. Keep tooltip/label text as React children so React's escaping applies.
- Keep the "Planning aid only. Verify stability on the approved loading computer." notice (`Sidebar.tsx:254`) — decision-support framing is a stated requirement (`docs/project-overview-pdr.md:71`).
- Do not commit anything from `frontend/.env*` or other secrets while doing the pre-flight hygiene commits (`plan.md` pre-flight item 1–2).

## Next Steps

- Phase B (`phase-02-placement-checks-and-editable-plan.md`) consumes `StowageModel.areaById`, `slotByKey`, `coords` and `occupancy` to build `canPlaceContainer`/`canPlaceBreakbulk`. Do not start it until the visual diff and the 396 tests are green.
- **Phase E handoff (Validation Session 1):** migrate `breakbulk-deck-area.ts`'s 6 callers (`naive-fill-breakbulk`, `breakbulk-validation-rules`, `breakbulk-mesh-builder`, `lib/breakbulk-weight-item`, `Sidebar.tsx`, plus tests) onto the model directly, then delete the shim. Do not let it become permanent. <!-- Updated: Validation Session 1 - Phase E shim deletion -->
- Carrier of the deferred items: per-area occupancy is the prerequisite for Phase D's `freeRegionsFor` (occupied rects per area) and for Phase E's gap/lashing checks.
