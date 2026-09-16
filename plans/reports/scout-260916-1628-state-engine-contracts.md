# Scout: state + domain + validation contracts for "drop cargo onto a slot"

Scout report, 2026-09-16. Read-only recon. NOTE: recovered late — this report was produced during the
research phase but not persisted with its siblings; content transcribed verbatim from the agent's hand-back.

## 0. Headline findings (read first)
1. **There is no plan mutator anywhere.** `usePlanStore.ts:51` says "UI/view state only. Plan data lives in React Query cache." That comment is stale: `api/client.ts:1-25` is documented **dead code** and `useQuery` is used nowhere. The plan is a derived `useMemo` in `frontend/src/App.tsx:39-44` over `(vessel, containers, cargoLoaded, projectCargoLoaded)`. A drop action therefore requires *introducing* plan state (useState / React Query / zundo — `usePlanStore.ts:52` TODO already names zundo for undo/redo).
2. **Validation already re-runs on any plan change, for free:** `App.tsx:49` `const report = useMemo(() => validatePlan(vessel, plan), [plan])`. Change the plan object identity → validation + stability re-run in the same render. No manual re-validate call exists.
3. **`BreakbulkItem` and `TargetSlot` do not exist** in the codebase (grep clean). The real names are `BreakbulkCargo` / `BreakbulkPlacement`, and there is no target-slot type at all.
4. **No per-slot validity entry point.** `validatePlan` is whole-plan only; "is this target valid?" must be expressed as a trial-plan validation or a new predicate.

## 1. `frontend/src/store/usePlanStore.ts` (106 lines, Zustand `create<ViewState>`)
Holds **zero** placements/cargo. Full state: `colorMode`, `paletteMode`, `showHull/showOnDeck/showUnderDeck`, `bayFilter`, `hoveredId`, `selectedId`, `hoveredSlot`, `draggingContainerId`, `exaggerate`, `playbackCount/Playing/Speed` (lines 54-67).
Actions (68-104): `setColorMode, setPaletteMode, toggleHull, toggleOnDeck, toggleUnderDeck, setBayFilter, setHovered, setSelected, setHoveredSlot, setDraggingContainer, toggleExaggerate, startOrResumePlayback, pausePlayback, resetPlayback, setPlaybackCount, setPlaybackSpeed, advancePlayback, resetForVesselChange`.
DnD-relevant state (verbatim, 16-22):
```ts
/** Raycast-resolved empty slot under the cursor (E3-04a) — null whenever the cursor is over a
 * container instead (hoveredId) or over nothing. Editor-only; not used by the read-only views. */
hoveredSlot: Slot | null;
/** Container id being dragged from the Unplaced list (E3-04b), or null when not dragging.
 * Combined with hoveredSlot, drives the ghost preview — snap-to-slot and committing the
 * placement are E3-04c/d, not implemented yet. */
draggingContainerId: string | null;
```
`resetForVesselChange` (95-104) clears `bayFilter, hoveredId, selectedId, hoveredSlot, draggingContainerId, playback*`.
**No add/remove/move mutator, no validation call, no keying scheme** — keying lives in the engine (see §4). Placed containers resolve hover via `hoveredId` (container id), empty slots via `hoveredSlot` (Slot object).

## 2. `frontend/src/types/domain.ts` — the contract (verbatim)
```ts
export interface Slot {            // 111-115
  bay: number;
  row: number;
  tier: number;
}
export interface Placement {       // 117-120
  container_id: string;
  slot: Slot;
}
export type BreakbulkCategory = "wind_turbine_blade" | "wind_turbine_nacelle" | "wind_turbine_tower" | "yacht"; // 124
export interface BreakbulkCargo {  // 126-136
  id: string;
  category: BreakbulkCategory;
  length_m: number;   // ship-frame x extent
  width_m: number;    // ship-frame y extent (beam-wise)
  height_m: number;   // from its resting base up to its top
  weight_t: number;
  kg_above_base_m: number; // center of gravity above its own resting base — NOT always height_m/2
  pol: string;
  pod: string;
}
export interface BreakbulkPlacement { // 147-155
  cargo_id: string;
  x_m: number;      // vessel.length_m/2-symmetric x of the footprint CENTER, +bow
  z_m: number;      // transverse position of the footprint CENTER, +starboard
  rotation_deg: number; // 0 = length_m runs along x (fore-aft); 90 = swapped
  area_id?: string; // a `vessel.breakbulk_holds[].id`, or absent/"weather_deck"
}
export interface StowagePlan {     // 157-167
  id: string; vessel_id: string; voyage: string;
  ports: PortCall[]; containers: Container[];
  placements: Placement[]; unplaced: string[];
  breakbulk_cargo: BreakbulkCargo[]; breakbulk_placements: BreakbulkPlacement[];
}
export interface Violation {       // 171-177
  rule: string; severity: Severity; message: string;
  container_ids: string[]; slots: string[];
}
export interface ValidationReport { // 179-183
  ok: boolean; violations: Violation[]; kpis: Record<string, number>;
}
```
- `Container` (91-101): `id, size: "20"|"40"|"45", type, high_cube, weight_t, pol, pod, imdg_class, oog`. `unplaced: string[]` holds **container ids** (Sidebar.tsx:82-84 resolves them).
- `StackSpec` (7-15): `{bay,row,deck:"under"|"on",tiers:number[],max_weight_t,max_height_m,reefer_tiers}`; `vessel.stacks` is the source of every valid slot.
- **`BreakbulkPlacement.x_m` is NOT AP/LBP ship-frame** (big comment 138-146) — it is `length_m/2`-symmetric. Conversion for stability only in `lib/breakbulk-weight-item.ts:15-18`. Slot keying `slotCode` = 6-digit `"140682"` (`engine/slot-helpers.ts:52-53`), `parseSlotCode` at 56-60.

## 3. Validation public API
`frontend/src/engine/validate-plan.ts:19-22` (whole-plan, pure, framework-free):
```ts
export function validatePlan(vessel: Vessel, plan: StowagePlan): ValidationReport
```
Body: `buildValidationContext` (23) → orphan violations (25-31) → `ALL_RULES.flatMap((rule) => rule(ctx))` (34) → 7 breakbulk calls (35-41) → sort errors-first (44-47) → KPIs (49-72). **No per-slot overload, no memo/index by slot.**
Rule contract (`engine/validation-rules.ts:12`): `export type Rule = (ctx: ValidationContext) => Violation[];`
Registration: `ALL_RULES: Rule[]` at `validation-rules.ts:147-149` = `[slotExists, sizeFitsBayRule, cellConflict, twentyOnForty, noFloating, stackWeight, reeferPlug, overstow]`. Add-a-rule convention documented at 1-4 ("write a function + append to ALL_RULES + add pass/fail tests").
`engine/validation-context.ts:35-45` `ValidationContext` exposes `containers, stacks, podSequence, columns, cells, unmapped, orphans`; `buildValidationContext(vessel, plan)` at 55-58.
**Breakbulk rules are deliberately OUTSIDE ALL_RULES** (`breakbulk-validation-rules.ts:1-10`) — they never see `ValidationContext`. Each has the flat shape `(vessel, cargo, placements[, containerPlacements]) => Violation[]`:
`breakbulkOutOfDeckArea:56`, `breakbulkOverlap:80`, `breakbulkOverlapsContainer:97`, `breakbulkOverweight:114`, `breakbulkInKeepOut:139`, `breakbulkTooTall:154`, `breakbulkOverPressure:170`. All emit `slots: []` (line 30) — **breakbulk violations carry no slot codes**, so a Violation cannot index a breakbulk drop target.
Shared predicate module for "validator before optimizer" (DRY): `engine/placement-checks.ts:1-5` — `isTwenty, teuOf, sizeFitsBay(c,bay), tierBelow(stack,tier), plugOk(c,stack,tier)`.

## 4. `frontend/src/engine/all-slots.ts` (26 lines)
```ts
export function allSlots(vessel: Vessel): Slot[]                                    // 7-14, from vessel.stacks × stack.tiers
export function emptySlots(vessel: Vessel, placements: Placement[]): Slot[]         // 22-25
```
Private `slotKey(s) => `${s.bay}:${s.row}:${s.tier}`` (16-18). **Three competing key conventions exist**: this one, `slotCode` `"140682"` (`slot-helpers.ts:52`), and `cellKey/stackKey` `"bay|row|tier"` (`validation-context.ts:47-53`).
Consumer: `features/viewer3d/EmptySlotPicker.tsx:22` feeds the raycast pick mesh; sets `hoveredSlot` on `onPointerMove` (53-56), clears on `onPointerOut` (57). Pick box is full grid pitch (63-67) so raycast does nearest-slot snapping (E3-04c) with no dead zones.

## 5. Geometry/occupancy constraints on a target
`frontend/src/engine/breakbulk-deck-area.ts` — `DeckArea {xMin,xMax,zMin,zMax}` (4-9); `WEATHER_DECK_AREA_ID = "weather_deck"` (12); `areaIdOf(p)` (22); `stowageAreaIds(vessel)` (33); `isKnownArea(vessel, areaId?)` (37); `isUnderDeck` (41); `areaLabel` (45); `deckArea(vessel, areaId?): DeckArea` (56-68); `deckKeepOuts(vessel, areaId?): BreakbulkKeepOut[]` (71); `cargoBaseHeight(vessel, areaId?)` (78); `maxCargoHeight(vessel, areaId?): number` (83, Infinity if undeclared); `deckLoadRating(vessel, areaId?): number|undefined` (88).
Invalidating conditions: unknown `area_id` → empty rect (54-55, so everything reads out-of-area); footprint outside `area` (bow/stern margins 0.15·LOA, 1.5 m off each shell when no declared layout, 18-20/60-67); rect overlaps a `keep_out`; `height_m > maxCargoHeight`; footprint pressure `weight_t/(length_m·width_m) > deck_load_t_per_m2`.
`frontend/src/engine/breakbulk-forbidden-zones.ts` — `XZone {xMin,xMax}` (4-7); `ON_DECK_TIER_THRESHOLD = 80` (9); `bayCenterXVesselRelative` (20-26, x_m convention, deliberately not ship-frame, 11-19); `onDeckBayZones(vessel, placements): XZone[]` (34-40); `underDeckBayZones` (44-50). Keyed off **actual placements**, not `vessel.stacks` (29-33) — capacity alone must not block the deck. Container bay approximated as one 40' length (`DIM.len40`), overlap test is x-only (106 of validation rules).
`frontend/src/engine/breakbulk-overlap-check.ts`: `Rect` (3-8), `footprintRect(item, placement): Rect` (12-22, swaps length/width at `rotation_deg === 90`), `rectsOverlap` (26-28, edge-touching ≠ overlap).
Edge tolerance `EDGE_TOLERANCE_M = 1e-6` (`breakbulk-validation-rules.ts:40`) because center↔rect round-trips drift in IEEE 754 (33-39).

## 6. `frontend/src/engine/naive-fill-breakbulk.ts` — closest analogue to "find valid target"
```ts
export interface BreakbulkFillResult { placements: BreakbulkPlacement[]; unplaced: string[] } // 17-20
export interface BreakbulkFillOptions { useHolds?: boolean; holdForbiddenXZones?: XZone[] }    // 54-59
export function naiveFillBreakbulk(
  vessel: Vessel,
  cargo: BreakbulkCargo[],
  forbiddenXZones: XZone[],
  options: BreakbulkFillOptions = {}
): BreakbulkFillResult                                                                          // 144-149
```
Greedy first-fit shelf packing, sorted by footprint area desc (150). Weather deck first (151), then holds in declared order while `useHolds ?? true` (154-161).
**The reusable per-item feasibility check** (62-68):
```ts
function areaRejection(vessel: Vessel, item: BreakbulkCargo, areaId: string, area: DeckArea): string | null {
  if (item.length_m > area.xMax - area.xMin || item.width_m > area.zMax - area.zMin) return "footprint";
  if (item.height_m > maxCargoHeight(vessel, areaId)) return "height";
  const rating = deckLoadRating(vessel, areaId);
  if (rating !== undefined && item.weight_t / (item.length_m * item.width_m) > rating) return "pressure";
  return null;
}
```
`findXInRow(startX, lengthM, widthM, rowZ, area, forbiddenXZones, placedRects): number | null` (25-52) is the closest thing to "is this x valid, and where does it snap to" — it advances past blocking zones/rects and returns the leftmost fit. Keep-outs are seeded into `placedRects` (79) so they block exactly like cargo. Placement construction (128-129): `{ cargo_id, x_m: spot.x + length_m/2, z_m: spot.z + width_m/2, rotation_deg: 0 }`, plus `area_id` only when not the weather deck. **`rotation_deg` is always 0 on creation** — no UI path produces 90 today.

## 7. Weight-item adapters
- `frontend/src/lib/cargo-weight-item.ts:9-19` — `cargoWeightItem(vessel, geometry, container, slot): WeightItem`; derives LCG/TCG/KG from the same `bayCenterX/rowCenterZ/tierCenterY` the viewer renders with (`lib/geometry.ts:48/65/74`, plus `slotToPosition:88`), no separate lookup table.
- `frontend/src/lib/breakbulk-weight-item.ts:14-30` — `breakbulkWeightItem(vessel, geometry, item, placement): WeightItem`; two-step `x_m → scene → true ship-frame` conversion (15-18) and `kg_m` via `cargoBaseHeight(vessel, placement.area_id)` (28), i.e. the placement's own area decides base height.

## 8. Unresolved questions for the drop design
1. **Where does the mutated plan live?** Nothing owns it today (`App.tsx:29-44` derived useMemo). Options: lift to `useState`, React Query cache (comment claims it, code doesn't), or zundo per `usePlanStore.ts:52`. Undo/redo is already a declared phase-2 TODO.
2. **Container drop vs breakbulk drop are different problems.** Container drop → `Slot` (`Placement`), breakbulk drop → `(x_m, z_m, rotation_deg, area_id)` with no slot concept. "Drop cargo onto a slot" only maps cleanly to the container path; for breakbulk the raycast `hoveredSlot` would have to be converted to footprint center + area, and `x_m/z_m` are center-based (not snapped) — `naive-fill-breakbulk.ts:128` is the only precedent for producing them.
3. **Target validity: trial-plan `validatePlan` vs. new predicate.** Whole-plan validation is pure and already wired (`App.tsx:49`), so "clone plan, append placement, validate, filter violations naming this container" is the DRY-consistent zero-new-API route. A per-slot predicate would duplicate `slotExists`/`sizeFitsBayRule`/`cellConflict`/`noFloating`/`stackWeight`/`reeferPlug` logic that `placement-checks.ts` only partially shares.
4. **No slot index in `ValidationReport`** and breakbulk violations always carry `slots: []` (`breakbulk-validation-rules.ts:30`) — filtering violations back to a specific drop target needs a `container_ids` match (container rules do populate it).
5. **`hoveredSlot` is only set by `EmptySlotPicker`** (empty slots). Dropping onto an *occupied* slot (a swap/move) is unmodelled: `GhostContainerPreview.tsx:16-23` returns null when `hoveredId` is set instead of `hoveredSlot`, and `Sidebar.tsx:78` clears `draggingContainerId` on any global mouseup — so today releasing the mouse just cancels (documented at `GhostContainerPreview.tsx:8-15`).
6. Three slot-key conventions (§4) — pick one if a drop action needs a lookup map.

---

**Resolved since this report was written** (see `plans/260916-1647-drag-drop-stowage-placeholders/plan.md`): item 1 → `usePlanDraftStore` (Phase B); item 3 → new pure predicates `canPlaceContainer`/`canPlaceBreakbulk` shared by placeholders, preview and validation (spec §4.5, Phase B); item 5 → occupied-slot drops handled via pick-and-place plus the `ContainerInstances` move path (Phase C); item 6 → the model's `bay|row|tier` key (`slotByKey`) is authoritative.
