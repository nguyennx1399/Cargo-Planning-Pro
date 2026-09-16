# Viewer3D recon — stowage placeholders / empty slots / picking

Scout report, 2026-09-16. Read-only recon for "drag-and-drop cargo onto valid stowage placeholders".

## 1. Every file in `frontend/src/features/viewer3d/` (589 LOC total)

| File | LOC | Git | Purpose / key exports |
|---|---|---|---|
| `VesselScene.tsx` | 61 | **M** | Root `<Canvas>`; renders all children. Exports `VesselScene({vessel, plan, attitude})` |
| `ContainerInstances.tsx` | 131 | clean | One `InstancedMesh` for every visible container. Exports `ContainerInstances` |
| `BreakbulkCargoInstances.tsx` | 51 | **M** | One `<mesh>` per breakbulk placement (no instancing). Exports `BreakbulkCargoInstances` |
| `EmptySlotPicker.tsx` | 60 | **?? untracked** | Invisible pickable grid over empty slots (E3-04a). Exports `EmptySlotPicker` |
| `GhostContainerPreview.tsx` | 42 | **?? untracked** | Translucent drop preview at hovered empty slot (E3-04b). Exports `GhostContainerPreview` |
| `Hull.tsx` | 165 | **M** | 3 hull paths: LoftedHull (LOD), GltfHull, SimpleBoxHull. Exports `Hull` |
| `LoadingSequenceDriver.tsx` | 16 | clean | `useFrame` ticks `playbackCount`; returns null |
| `ShipAttitudeDriver.tsx` | 22 | clean | In-Canvas wrapper for the attitude hook; returns null |
| `useShipAttitude.ts` | 24 | clean | `useFrame` damps group pos.y / rot.x / rot.z |
| `WaterlineReference.tsx` | 17 | clean | Fixed sea plane at world y=0 |

### The untracked `EmptySlotPic*` file

Exact name: **`frontend/src/features/viewer3d/EmptySlotPicker.tsx`** (60 LOC, `??` untracked; sibling
`GhostContainerPreview.tsx` is the other untracked file). Repo has only 2 commits ("initial"), so both
are uncommitted work-in-progress.

API: `export function EmptySlotPicker({ vessel, plan }: { vessel: Vessel; plan: StowagePlan })` — no
other exports, no props beyond those two.

What it does:
- `:20` — `slots = useMemo(() => emptySlots(vessel, plan.placements), [vessel, plan.placements])`, from
  `@/engine/all-slots` (`allSlots(vessel)` derived from `vessel.stacks`; `emptySlots` = allSlots minus
  occupied keys `bay:row:tier`, `src/engine/all-slots.ts:7,22`).
- `:22-33` — `useLayoutEffect` writes a **translation-only** `Matrix4.setPosition(...slotToPosition(vessel, slot))`
  per instance (no rotation/scale), sets `mesh.count`, `needsUpdate`, `computeBoundingSphere`.
- `:41-44` — `<instancedMesh key={capacity} args={[undefined, undefined, capacity]}>` where
  `capacity = slots.length || 1`; the `key` remounts the mesh when the empty count changes (mirrors
  `ContainerInstances`).
- `:56` — pick volume `boxGeometry args={[DIM.len40 + LAYOUT.bayGap, LAYOUT.tierPitch, DIM.width + LAYOUT.rowGap]}`
  = `[13.392, 2.65, 2.498]`, `meshBasicMaterial visible={false}` (`:57`). Comment `:51-55` states the box is
  sized to the full bay pitch so adjacent pick boxes tile with no dead zones — i.e. **raycast itself does
  nearest-slot snapping (E3-04c)**.
- `:45-49` — `onPointerMove` → `e.stopPropagation(); setHoveredSlot(slotAt(e))`; `onPointerOut` →
  `setHoveredSlot(null)`. `slotAt` (`:35-36`) maps `e.instanceId` back into `slots[]`.

Wired, not orphaned: `VesselScene.tsx:51` renders `<EmptySlotPicker vessel={vessel} plan={plan} />` inside
the transformed `<group ref={shipGroupRef}>`. Its hover state is consumed by `GhostContainerPreview` and
displayed by `Sidebar.tsx:200-205`. Only the *git tracking* is missing.

## 2. Component tree + how cargo renders

`App.tsx:91` → `<VesselScene>` → `VesselScene.tsx:29` `<Canvas>` → children: `WaterlineReference` (sibling,
world y=0), `LoadingSequenceDriver`, `ShipAttitudeDriver`, then `<group ref={shipGroupRef}>` (`:47`)
containing `Hull` `:48`, `ContainerInstances` `:49`, `BreakbulkCargoInstances` `:50`, `EmptySlotPicker` `:51`,
`GhostContainerPreview` `:52`; finally `OrbitControls` `:55` + `GizmoHelper`/`GizmoViewport` `:56-58`. The
whole ship group is transformed per-frame by `useShipAttitude`.

**ContainerInstances** — single `InstancedMesh` (`:112-129`), `boxGeometry [0.97, 0.96, 0.95]` (`:127`).
- Source: `visiblePlacements(plan.placements, playbackCount)` (`:52`) filtered by `tier >= 80` → on deck (`:54`),
  `showOnDeck`/`showUnderDeck`, `bayFilter` (`:53-58`).
- Position: `slotToPosition(vessel, p.slot)` (`:64`). Rotation: identity quaternion (`:78,80`) — **no rotation
  is ever applied**. Scale: `(LENGTH_BY_SIZE[container.size], high_cube ? DIM.heightHC : DIM.height, DIM.width)`
  (`:65-66,81`), so 20'/40'/45' share one unit cube via per-instance scale.
- Color, separate `useLayoutEffect` (`:91-104`): `selectedId → HIGHLIGHT.selected (#FFD23F)`,
  `hoveredId → HIGHLIGHT.hover`, else `containerColor(container, colorMode, pods)`; `setColorAt` +
  `instanceColor.needsUpdate`.
- Source data: `plan.placements`, `plan.containers`, `plan.ports` (`:48-49`).

**BreakbulkCargoInstances** — deliberately **no** InstancedMesh (comment `:15-19`: individually shaped cargo,
few dozen items). Per-item `<mesh geometry={meshDataToBufferGeometry(buildBreakbulkMesh(item, p, vessel))}>`
(`:36,45`), position baked into the geometry in scene coords. Color from `CATEGORY_COLOR` by `item.category`
(`:8-13,35`). Filtered by `isUnderDeck(p.area_id)` + `showOnDeck`/`showUnderDeck` (`:44`). **No pointer
handlers, no hover/selected coloring** — not pickable today.

**Hull** — three paths (`:32,45,54`): offsets → drei `<Detailed>` LOD `LoftedHull`+`SimpleBoxHull` (`:39-42`);
`hull.source === "mesh"` → `<Suspense>` + `GltfHull` (`:49-51`); else `SimpleBoxHull`. Critically, **every hull
mesh opts out of picking** with `raycast={() => null}` (`:124`, `:126`) and `GltfHull` traverses the loaded GLB
setting `child.raycast = () => null` (`:79-83`), explicitly so the hull never steals clicks from
`EmptySlotPicker`/`ContainerInstances` (comment `:76-78`).

## 3. Picking / raycasting today — yes, it exists (R3F event system only)

- `ContainerInstances.tsx:116-124` — occupied-container picking: `onPointerMove` → `setHovered(idAt(e))`,
  `onPointerOut` → `setHovered(null)`, `onClick` → `setSelected(idAt(e))`; `idAt` maps `e.instanceId` (`:106-107`).
- `EmptySlotPicker.tsx:45-49` — empty-slot picking: `onPointerMove` → `setHoveredSlot`, `onPointerOut` → null.
- `VesselScene.tsx:31` — `Canvas onPointerMissed={() => setSelected(null)}`.
- `BayPlanView.tsx:173` — 2D SVG deck block `onClick` → `setSelected(container?.id ?? null)` (non-3D).
- **No** `onPointerDown`, **no** `onPointerUp`/drop handler, **no** drei `<Select>` (anywhere), **no** `useCursor`,
  **no** hover cursor change, **no** explicit `new THREE.Raycaster()` — all picking is R3F's implicit event
  raycasting; the only "raycast" strings are the `() => null` opt-outs in `Hull.tsx:81,124,126` and
  `GhostContainerPreview.tsx:36`. Hover is pointer-move-only, so touch devices get nothing.

## 4. Camera / controls, and world-position access

- `VesselScene.tsx:30` — `camera={{ position: [90, 55, 90], fov: 40, near: 0.5, far: 2000 }}`, `dpr={[1,2]}` (`:32`).
- `VesselScene.tsx:3,55` — drei **`OrbitControls`** with `makeDefault`, `target={[0,0,0]}`,
  `maxPolarAngle={Math.PI * 0.49}`; plus `GizmoHelper`/`GizmoViewport` (`:56-58`). `makeDefault` is what lets
  other components reach the controls instance via `useThree(s => s.controls)` (e.g. to set `enabled=false`
  during a drag) — currently unused.
- **World position is not obtained anywhere today.** No use of `e.point`, `e.ray`, `useThree(s => s.raycaster)`,
  `unproject`, or pointer→plane math (grep-verified). The only available hook is the R3F `ThreeEvent.point`
  prop inside the existing `onPointerMove` handlers; note it is world-space, so it includes the per-frame
  ship-group attitude transform from `useShipAttitude.ts:20-22`.

## 5. Selection state wire-up today

- Store: `src/store/usePlanStore.ts` — `hoveredId` `:14`, `selectedId` `:15`, `hoveredSlot: Slot | null` `:18`,
  `draggingContainerId` `:22`; setters `setHovered` `:33`, `setSelected` `:34`, `setHoveredSlot` `:35` (both
  setters are plain `set({...})`, `:75-76`); all four cleared by `resetForVesselChange` `:98-101`.
- Click a 3D container → `setSelected(id)` → yellow `#FFD23F` in `ContainerInstances.tsx:98`; click empty
  space → `onPointerMissed` clears.
- Click a 2D bay-plan block → same `setSelected` (`BayPlanView.tsx:173`).
- `Sidebar.tsx:86-88` — `focusId = selectedId ?? hoveredId`; `:192-199` renders the Container detail panel
  (ID/Slot/Size/Weight/Route); `:200-205` renders `Empty slot {bay}{row}{tier}` from `hoveredSlot`; `:207` hint
  text. `Sidebar.tsx:247` — violation click → `setSelected(container_ids[0])`.
- **Drag today (in-progress, E3-04b):** `Sidebar.tsx:222` unplaced item `onMouseDown` →
  `setDraggingContainer(c.id)`; `Sidebar.tsx:76-81` global `mouseup` clears it; `GhostContainerPreview`
  (`VesselScene.tsx:52`, code at `GhostContainerPreview.tsx:23-41`) draws a translucent `HIGHLIGHT.ghost` box at
  `slotToPosition(vessel, hoveredSlot)` while both `draggingContainerId` and `hoveredSlot` are set
  (`raycast={() => null}` so it never self-picks). **Release commits nothing** — `Sidebar.tsx:215` says
  "Drop doesn't place it yet (E3-04c/d)".

## Gaps blocking real drag-and-drop (ranked)

1. **No mutation path exists.** `usePlanStore` actions are only UI/playback toggles (`:27-48`); grepping
   `src/engine/` for place/move/assign/commit/relocate finds no placement mutator. Committing a drop needs new
   store action(s) + likely an engine place/validate function.
2. **No `onPointerUp`/drop handler in 3D** — nothing consumes `hoveredSlot` + `draggingContainerId` to commit.
3. **OrbitControls conflict** — left-drag currently orbits the camera, so a canvas drag-to-place will fight it.
   `makeDefault` (`VesselScene.tsx:55`) is the intended lever (`enabled={!draggingContainerId}`), not yet wired.
4. Both E3-04 files are untracked and must be `git add`-ed by whoever implements E3-04c/d.
5. `BreakbulkCargoInstances` is entirely unpickable (no handlers, no hover/selected color).

## Unresolved questions

- **Pick-volume length vs 20' bays.** `EmptySlotPicker.tsx:56` hardcodes `DIM.len40 + LAYOUT.bayGap` (13.392 m)
  as the box length. That tiles exactly only on `bayCenterX`'s fallback path, where bay pitch is *defined* as
  `DIM.len40 + LAYOUT.bayGap` (`src/lib/geometry.ts:59`). Real vessels get declared
  `container_layout.bay_center_x_m` (from the stowage spec, `src/data/vessel-from-spec.ts:60`) or calibrated
  `geometry.bay_lcg_m` (`geometry.ts:53-57`) — if those bays are packed at 20'-scale pitch (~7.26 m), one
  13.392 m pick box overlaps neighbouring bays and nearest-slot snapping may resolve the wrong slot. Needs
  verification against actual BBC SAO PAULO bay centers.
- Does "no raycast miss in a gap" hold vertically? The box height is `LAYOUT.tierPitch` (2.65) but `tierCenterY`
  bases come from `on_deck_base_y_m`/`under_deck_base_y_m` or `hatchHeight`/`-holdDepth` (`geometry.ts:74-86`) —
  a hold whose tiers are spaced differently from `tierPitch` would leave vertical dead zones.
- No plan directory exists yet for E3-04; the E3-04 crew should create `plans/260916-1628-*`.
