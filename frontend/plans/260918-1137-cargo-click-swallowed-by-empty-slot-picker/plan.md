# Fix: placed project cargo often cannot be selected

## Symptom (user, 2026-09-18)

"Sometimes I can not select project cargo." A click on a placed item on deck or in a hold does nothing:
not selected, and the previous selection is not cleared either.

## Root cause — reproduced in the browser (BBC SAO PAULO, 1440 × 900, default camera)

Raycasting all R3F handler objects at the projected centre of each of the 8 placed items:

| Item centre (screen) | 1st hit | Item's own mesh |
|---|---|---|
| all 8 | invisible `EmptySlotPicker` volume (`InstancedMesh`, 337 idle 40' slots) | 2nd–5th hit, or not in the top 5 |

`EmptySlotPicker` is mounted **while nothing is in hand** (idle hover-to-inspect an empty slot), and its
`onPointerMove`/`onClick` call `stopPropagation()`. Project cargo sits on hatch covers and in holds,
exactly where container slots are EMPTY, so the picker's volume is almost always the nearest hit: the item's
`onClick` (and hover tint) never runs. It only works on the item's edges, where it sticks out of the slot
grid, which is why it looks random. The same thing can happen to a container that has an empty slot volume in
front of it.

A second, smaller defect (code reading): `ContainerInstances` hover and click have no frontmost guard. When a
project-cargo item stands in FRONT of a stack, the item selects itself and then the stack's handler,
which runs next in the same dispatch, overwrites `selectedId`/`hoveredId` with the container. The press path
already uses `isFrontmostGestureHit`; click and hover do not.

## Phases

| # | Phase | Status | Priority |
|---|-------|--------|----------|
| 01 | [Idle slot picker yields to visible cargo](phase-01-idle-slot-picker-yields-to-cargo.md) | done | high |
| 02 | [Container click/hover respect frontmost](phase-02-container-click-hover-respect-frontmost.md) | done | medium |

01 fixes the reported bug on its own. 02 is independent and small.

## Ground rules

- **No change while a container is in hand**: the slot picker must keep winning then. Aiming at the slot
  above a stack, or at a slot under a project-cargo item to get its red refusal, is how placement works.
- One ownership rule, in `press-ownership.ts`, tested in node. No new per-layer special cases.
- Browser proof uses the same raycast probe as the diagnosis (phase 01 lists it).

## Result (2026-09-18)

- 8/8 placed items select on one click (the diagnosis: 0/8 at their centres). A 2nd click picks the item, and Esc puts it down.
- **Deviation, found in the browser:** project cargo's own `onClick` also lacked the frontmost guard. Two items along
  one ray both ran: the front one selected itself, then the one behind re-selected itself, so a 2nd click never reached
  `pick`. Guarded in `BreakbulkCargoInstances.tsx` (still no `stopPropagation`, so the area drop plane keeps its events).
- Unchanged, and verified: idle empty-slot inspect (22|4|2); container in hand → the slot wins over cargo behind it (33|5|82 + chip);
  item in front of a stack → the item gets hover + click; plain container click selects the container.
- Tests: `press-ownership.test.ts` (7). Suite 93 files / 742 tests. `tsc --noEmit` clean.
