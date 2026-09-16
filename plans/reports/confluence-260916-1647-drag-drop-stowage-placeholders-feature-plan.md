# FEATURE PLAN — Drag-and-drop cargo onto valid stowage placeholders (every vessel)

Source: https://nguyennx1399.atlassian.net/wiki/external/MWM0ZGFkYzQ2ZjkyNGE5NjhjMDNhMmI1YzIxMmEwMzc
Retrieved 2026-09-16 via headless Chrome (page is public shared content).
Author on page: nadal.

---

-
-
-
-
 Shared Content

-

-

-

-
-
-
-
-
-
-
-
-
-
-
-
-

Log inTry Confluence for free, (opens new window)

# FEATURE PLAN — Drag-and-drop cargo onto valid stowage placeholders (every vessel)

By nadal

about an hour ago

# Drag-and-drop cargo onto valid stowage placeholders

Status: Plan only. Nothing implemented or committed yet.
Scope: Containers and project/breakbulk cargo, on deck and in holds, for every vessel. BBC SAO PAULO is the reference vessel.
Out of scope for now: automated tests (unit tests and Playwright) — to be added later.

## 1. Goal

When the planner picks a cargo item (from the Unplaced list or already on the ship):

- The 3D view shows placeholders: the places this item can legally go.

- Containers → empty slots (bay/row/tier) that pass size, reefer, weight and stack checks.

- Project cargo → highlighted stowage areas (hatch covers, tank top, tweendeck) with keep-outs and occupied zones greyed out.

- The planner drags the item. A ghost follows the cursor, snaps to a slot or grid, and turns green (valid) or red (with a reason).

- On drop, the plan updates, validation re-runs, and the change can be undone.

## 2. Design principles (why it works for every vessel)

Principle

What it means

Principle

What it means

Data, not the 3D model
Placeholders come from Vessel (built from the stowage spec JSON), never from GLB meshes. A vessel with no 3D model still works.

One source of truth
A single StowageModel per vessel. The packer, validator, 3D renderer, bay plan and drag-and-drop all read it, so what you see is what gets validated.

Graceful degradation
Each piece of data has a fallback: real spec data if available, otherwise generic geometry from LOA/beam/LAYOUT. Every vessel gets the feature; spec-driven vessels are simply more accurate.

Validator before UI
"Can this go here?" is one pure function shared by placeholders, drop preview and full plan validation.

One coordinate helper
All x_m ↔ scene conversions live in one file. This removes a whole class of bugs we have already hit (the x_m / ship-frame offset bugs).

## 3. Current state (what already exists)

- Vessel data: breakbulk_deck, breakbulk_holds, container_layout, stacks built from *.stowage.json (vessel-from-spec.ts, deck-layout-from-spec.ts).

- Breakbulk engine: breakbulk-deck-area.ts (area lookups), naive-fill-breakbulk.ts (packer), breakbulk-validation-rules.ts (7 rules).

- Container engine: validation-rules.ts, placement-checks.ts (sizeFitsBay, plugOk, tierBelow), all-slots.ts (emptySlots).

- Drag infrastructure (E3-04a/b): EmptySlotPicker.tsx (invisible instanced pick boxes over empty slots, sets hoveredSlot), GhostContainerPreview.tsx, Unplaced list sets draggingContainerId, mouseup cancels. There is no commit on drop yet.

- Plan state: App.tsx derives the plan with useMemo (demo builders). It is not editable, and the store holds view state only.

Gaps this feature closes

- Area and slot geometry are re-derived in several places (deckArea, bayCenterXVesselRelative, mesh builder sceneX, weight item).

- Container ↔ breakbulk conflicts block a whole bay across the full beam, which is too conservative. It should be per stack footprint.

- There is no editable plan, no single "can place here?" check, and no area placeholders for project cargo.

## 4. Architecture

Vessel (from stowage spec, or generic)
 │
 ▼
buildStowageModel(vessel) ── cached per vessel object
 ├─ areas: StowageArea[] (weather deck + holds)
 └─ slots: SlotDef[] (every bay/row/tier with footprint + scene position)
 │
 ├─ occupancy(plan) → what containers/breakbulk already take, per area
 ├─ canPlaceContainer(...) → {ok, reasons[]}
 ├─ canPlaceBreakbulk(...) → {ok, reasons[]}
 ├─ placeholders(...) → valid slots / free regions for the dragged item
 │
 ├─ packer (naive-fill-breakbulk, naive-fill-plan)
 ├─ validatePlan (rules)
 └─ 3D: SlotPlaceholders, AreaPlaceholders, Ghost, Breakbulk meshes

### 4.1 Types — src/engine/stowage-model/types.ts

type StowageLevel = "weather_deck" | "tweendeck" | "tank_top";

interface StowageArea {
 id: string; label: string; level: StowageLevel; hold?: string;
 onDeck: boolean;
 rect: Rect; // x_m convention (0 = LOA stern end, +fwd), z +stbd
 keepOuts: BreakbulkKeepOut[];
 surfaceY: number; // scene y of resting surface (main deck = 0)
 maxHeight: number; // Infinity if not declared
 loadRating?: number; // t/m²
 source: "declared" | "generic";
}

interface SlotDef {
 key: string; // "bay|row|tier"
 bay: number; row: number; tier: number; deck: "on" | "under";
 rect: Rect; // plan-view 40' footprint, x_m convention
 center: [x, y, z]; // scene — identical to slotToPosition
 areaId: string | null; // area the stack stands in/over
 maxStackWeightT: number;
}

interface StowageModel {
 vesselId: string; lengthM: number; beamM: number;
 areas: StowageArea[]; areaById: Map<string, StowageArea>;
 slots: SlotDef[]; slotByKey: Map<string, SlotDef>;
}

### 4.2 Builder — build-stowage-model.ts

- Weather deck: vessel.breakbulk_deck if present. Otherwise generic: x from 15% LOA to 85% LOA, z = ±(beam/2 − 1.5 m), surface = LAYOUT.hatchHeight, source: "generic".

- Holds: one area per vessel.breakbulk_holds entry, in declared order (largest first).

- Slots: for each stack × tier, use slotToPosition to get the centre and a 40' × 2.438 m footprint.

- areaId = weather deck if an on-deck slot overlaps the deck rect.

- areaId = the first hold area containing an under-deck slot's centre.

- areaId = null otherwise.

- Cache: WeakMap<Vessel, StowageModel>. Vessel objects must be treated as immutable (builders already return new objects; tests use spreads).

- areasAt(model, x_m, z_m, onDeck?): resolves a drop point to candidate areas. Several can match, e.g. hatch cover above tank top; the deck toggle picks one.

### 4.3 Coordinates — coords.ts (the ONLY place offsets live)

placementXToSceneX, sceneXToPlacementX, placementToScene(x_m, z_m, surfaceY, lift), rectFromCenter, rectContainsPoint, rectContainsRect, snap(value, step).

### 4.4 Occupancy — occupancy.ts

- occupiedStacks(vessel, placements): one footprint per bay/row/deck that actually carries a container. It reads placements, not capacity, so an empty ship stays free. A row the vessel doesn't declare blocks the full beam (conservative fallback).

- containerOccupancy(vessel, placements): Map<areaId, OccupiedStack[]>.

- On-deck stacks block the weather deck.

- Under-deck stacks block every hold area they overlap (a container column passes through the tweendeck above the tank top).

- breakbulkOccupancy(cargo, placements): Map<areaId, Rect[]> from footprintRect.

### 4.5 Placement checks — src/engine/placement/

One pure function per cargo kind returns { ok: boolean; reasons: Reason[] }. Each reason carries {rule, message, severity}. Full-plan validation calls the same checks per item, so the UI and the report never disagree.
canPlaceContainer(model, plan, container, slot)

- Slot exists in the model.

- Slot is empty.

- sizeFitsBay.

- Tier below is filled (no floating box). Exception: bottom tier.

- plugOk (reefer needs a plug tier).

- Stack weight ≤ maxStackWeightT after adding.

- Height ≤ max_height_m (under deck).

- No breakbulk item occupies that stack footprint in the same area.

- Warnings only: overstow by POD, stability.

canPlaceBreakbulk(model, plan, item, {areaId, x_m, z_m, rotation})

- Area exists.

- Footprint inside area.rect.

- Not in a keep-out.

- No overlap with other breakbulk in the same area.

- No overlap with occupied container stacks.

- Height ≤ area.maxHeight.

- Footprint pressure ≤ loadRating.

- 20 m band weight ≤ rating × band area.

- Warnings: source: "generic" area (approximate), hatch opening not checked yet.

These are the existing 7 breakbulk rules refactored to work on one candidate item instead of the whole list. breakbulk-validation-rules.ts becomes a loop over canPlaceBreakbulk.

### 4.6 Placeholders — placeholders.ts

- Containers: validSlotsFor(model, plan, container) returns SlotDef[] where canPlaceContainer.ok. It also returns blockedSlots with their first reason, for a red hover tooltip. Cost: BBC has ~900 slot-tiers × 9 cheap checks, well under a millisecond.

- Project cargo: freeRegionsFor(model, plan, item) returns, per area:

- the area rect, keep-outs, and occupied rects (containers + breakbulk) for drawing;

- feasible: boolean — the item fits by height, pressure and footprint at all;

- optional candidateSpots: the first N positions from the existing shelf packer, shown as "suggested" markers.

- It does not compute the exact free polygon. The live check on drag is enough and much simpler.

### 4.7 Editable plan + undo — src/store/usePlanDraftStore.ts

interface PlanDraftState {
 plan: StowagePlan | null;
 past: StowagePlan[]; future: StowagePlan[];
 loadPlan(plan): void; // on vessel change / demo load
 placeContainer(id, slot): Result; // runs canPlaceContainer first
 moveContainer(id, slot): Result;
 unplaceContainer(id): void;
 placeBreakbulk(id, pose): Result; // pose = {areaId, x_m, z_m, rotation_deg}
 moveBreakbulk(id, pose): Result;
 unplaceBreakbulk(id): void;
 undo(): void; redo(): void;
}

App.tsx stops deriving the plan with useMemo. It builds the demo plan once per vessel and calls loadPlan. validatePlan stays a useMemo over the draft plan.

## 5. What each vessel needs (data checklist)

Data

Used for

Source (spec-driven vessel)

Fallback (any vessel)

Data

Used for

Source (spec-driven vessel)

Fallback (any vessel)

LOA, beam, depth
coords, generic areas
particulars
Vessel.length_m/beam_m

Weather-deck area + keep-outs + rating
project cargo on deck
cargo_spaces (weather_deck) + obstructions
15% / 85% LOA, beam − 1.5 m, no keep-outs, demo band limit

Hold areas (surface, clear height, rating)
project cargo in holds
cargo_spaces tank_top / tweendeck
none → deck only

Container grid (bays, rows, tiers, stack weights)
container slots
containers.stowage
vessel.stacks + LAYOUT spacing

Bay x positions / tier base heights
slot position
container_layout
LAYOUT constants

Hatch openings
"can it be lowered in?" (Phase E)
open_hatch_*
skip check, warn

Onboarding a new vessel = write its *.stowage.json. No code changes. The spec validator already reports missing fields and confidence levels. The UI shows a "generic / approximate" badge on areas with source: "generic" or confidence C/D.

## 6. UX flow

- Pick: drag from the Unplaced list, or press on a placed item (container instance or breakbulk mesh). Sets dragging = {kind, id} and optionally hides the item's current placement.

- Show placeholders:

- Container: translucent green boxes on valid empty slots. Other empty slots are hidden, or faint red if "show blocked" is on. The bay filter and on-deck/under-deck toggles still apply.

- Project cargo: each feasible area is drawn as a flat green outline at surfaceY. Keep-outs are hatched grey, occupied rects dark grey. Infeasible areas are faint red with the reason ("too tall 14.6 m > 10.4 m").

- Hover/drag:

- Container: the existing pick boxes resolve the slot. The ghost snaps to it and is green or red with the first reason.

- Project cargo: raycast against an invisible plane per visible area at surfaceY, then x_m/z_m via coords, snap (see decision D2), and run canPlaceBreakbulk live. The ghost box/cylinder is green or red. R rotates 0°/90°.

- Drop: valid → store action → plan updates → validation re-runs. Invalid → see decision D1.

- Esc cancels. Ctrl/Cmd+Z / Shift+Z undo/redo. Right-click or Delete → unplace.

- Sidebar: "N valid slots" / "fits in: Weather deck, Hold 2 tank top" hint while dragging.

## 7. Phases

### Phase A — StowageModel foundation (refactor, no visible UI change)

Tasks

- Create src/engine/stowage-model/ with types.ts, coords.ts, build-stowage-model.ts, occupancy.ts, index.ts (as in §4.1–4.4).

- Rewrite breakbulk-deck-area.ts as thin wrappers over the model (deckArea, deckKeepOuts, cargoBaseHeight, maxCargoHeight, deckLoadRating, isKnownArea, areaLabel, stowageAreaIds). Public signatures don't change, so there is no ripple.

- naive-fill-breakbulk.ts: add option occupiedRects?: Record<areaId, Rect[]>, seeded into placedRects per area. Iterate hold areas from the model. Keep forbiddenXZones for backward compatibility.

- build-demo-plan.ts: withBreakbulkCargo uses occupiedRectsByArea(vessel, plan.placements) instead of whole-bay x-zones.

- breakbulkOverlapsContainer: check per-area occupied stack rects. The message names the stack ("overlaps on-deck container stack bay 30 row 04").

- breakbulk-mesh-builder.ts and breakbulk-weight-item.ts: use coords.placementXToSceneX and area surfaceY.

- Mark breakbulk-forbidden-zones.ts as deprecated. Keep it until no caller remains.

Acceptance

- tsc passes. The app renders BBC SAO PAULO and the generic demo vessel exactly as before, apart from project cargo that may now fit beside container stacks.

- The BBC demo plan still has 0 breakbulk/stack-weight errors.

Effort: ~1 day.

### Phase B — Placement checks + editable plan

Tasks

- Create src/engine/placement/can-place-container.ts and can-place-breakbulk.ts (§4.5) with a Reason type.

- Refactor breakbulk-validation-rules.ts to loop canPlaceBreakbulk (keep rule ids and messages). Container rules keep running as today; only the per-slot checks are shared.

- Create usePlanDraftStore with undo/redo (plain past/future arrays capped at 100; no new library).

- App.tsx: loadPlan on vessel change and demo toggles. Viewer, Sidebar and BayPlan read the draft plan.

- resetForVesselChange also clears drag state.

Acceptance: the same plan gives the same violations as before. Store actions reject invalid moves with reasons.
Effort: ~1–1.5 days.

### Phase C — Container placeholders + drop

Tasks

- Create placeholders.ts: validSlotsFor.

- SlotPlaceholders.tsx: an instanced translucent box over each valid slot while dragging.kind === "container", using SlotDef.center.

- EmptySlotPicker: read positions from model.slots, restricted to the current drag's valid + blocked slots.

- GhostContainerPreview: colour and tooltip from canPlaceContainer.

- Commit on pointer-up over a slot. Invalid → D1 behaviour. Mouseup elsewhere → cancel (existing).

- Drag an already-placed container: pointer-down on a ContainerInstances instance starts moveContainer (hide its instance while dragging).

- Bay plan view: click-to-place into the highlighted slot (2D fallback, same checks).

Acceptance: drag an unplaced 40' box onto BBC bay 22 on deck and it lands in that slot. A 20' box shows no placeholders in 40' bays. A reefer shows only plug tiers. Undo restores it.
Effort: ~1.5 days.

### Phase D — Project cargo placeholders + drop

Tasks

- freeRegionsFor (§4.6).

- AreaPlaceholders.tsx: area outline and fill at surfaceY + 0.02, keep-outs, occupied rects, labels ("Hatch covers · 4 t/m²", "Hold 2 tank top · clear 14.6 m"). Hold areas are shown only when "Under deck" is on; hull auto-hides while dragging into holds.

- AreaDropPlane.tsx: invisible plane per visible area. Pointer → x_m/z_m → snap → live canPlaceBreakbulk.

- GhostBreakbulkPreview.tsx: reuse buildBreakbulkMesh with the candidate pose; green/red with reason.

- Sidebar: an Unplaced project cargo list with drag handles (same pattern as containers). Pressing on a placed breakbulk mesh starts a move.

- R key rotates 0/90°. The mesh builder must support a 90° tower (known limitation today).

- Deck vs hold selection: the area under the cursor wins; when both match, prefer the one whose level toggle is visible, and Shift switches.

Acceptance: drag a 62 m blade over BBC hatch covers → green except over crane pedestals and container stacks. Drag it into the Hold 1 tank top (7.7 m long) → red "footprint". Drop → renders there, KG updates in the stability panel.
Effort: ~2 days.

### Phase E — Hardening & realism

- Hatch-opening check (item must pass through open_hatch_*), with a warning when data is missing.

- Tweendeck pontoon levels: choose a level per drop, which changes the surface and clear height of the tank top below.

- Mixed stacking: project cargo on top of containers (flat-rack), lashing clearances, a minimum gap between items (configurable, e.g. 0.3 m).

- Multi-select move, keyboard nudging (arrow keys = snap step), a "suggest spot" button (packer from the cursor).

- Tests: unit tests for model / checks / occupancy per vessel spec, and Playwright drag scenarios. Deferred as requested.

## 8. Open decisions (need Nadal)

#

Decision

Options

Recommendation

#

Decision

Options

Recommendation

D1
Invalid drop
(a) Block: snap back and toast the reason. (b) Warn: allow it, the item shows red and appears in the violations list.
(a) for hard physical rules (outside area, overlap, keep-out, slot size). (b) for limits planners override with approval (overweight band, pressure, overstow). Configurable per rule severity.

D2
Project cargo snapping
(a) 0.5 m grid. (b) free movement. (c) grid + magnet to edges of neighbours/areas.
(a) now (simple, deterministic, readable coordinates). (c) in Phase E.

D3
Drag while playback runs
disable / pause playback
Pause playback on drag start.

D4
Generic (approximate) areas
allow drop / allow with badge
Allow with "approximate" badge and warning.

## 9. Risks & mitigations

- Coordinate bugs (seen before) → a single coords.ts; mesh, weight item, picker and checks all import it.

- Model cache staleness if a vessel object is mutated → vessels are treated as immutable; a dev-only Object.freeze on built vessels.

- Raycast conflicts (hull, containers, area planes) → while dragging, disable pointer events on the hull and other layers; only drop targets are pickable.

- Performance with large container ships (20k+ slot-tiers) → instanced meshes; compute validSlotsFor once per drag start, not per pointer move.

- Spec data confidence C/D (e.g. BBC crane pedestal z, reefer bays) → show confidence in the tooltip; see the TASK page "find documents" (2785281).

## 10. File map (new / changed)

New: engine/stowage-model/{types,coords,build-stowage-model,occupancy,index}.ts, engine/placement/{can-place-container,can-place-breakbulk,placeholders}.ts, store/usePlanDraftStore.ts, features/viewer3d/{SlotPlaceholders,AreaPlaceholders,AreaDropPlane,GhostBreakbulkPreview}.tsx
Changed: engine/breakbulk-deck-area.ts, engine/naive-fill-breakbulk.ts, engine/breakbulk-validation-rules.ts, data/build-demo-plan.ts, engine/cargo/breakbulk-mesh-builder.ts, lib/breakbulk-weight-item.ts, features/viewer3d/{EmptySlotPicker,GhostContainerPreview,ContainerInstances,BreakbulkCargoInstances,VesselScene}.tsx, features/panels/Sidebar.tsx, features/bayplan/BayPlanView.tsx, App.tsx, store/usePlanStore.ts
Deprecated: engine/breakbulk-forbidden-zones.ts (removed after Phase A callers migrate)
Related: Delivery Backlog v2 (E3-04a–d) · 3D plan (1671180) · TASK find vessel documents (2785281)

POWERED BY

 {"serverDuration": 54, "requestCorrelationId": "1b1ed0451b404f4dbb0e606988a97065"}
