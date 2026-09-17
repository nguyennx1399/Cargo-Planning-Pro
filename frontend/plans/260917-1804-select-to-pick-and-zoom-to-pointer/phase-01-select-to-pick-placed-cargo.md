# Phase 01 — Select-to-pick for placed cargo

## Context links

- `src/features/viewer3d/ContainerInstances.tsx` — `onClick` → `setSelected(idAt(e))`, press-drag arms a move
- `src/features/viewer3d/BreakbulkCargoInstances.tsx` — same shape for project cargo
- `src/store/begin-container-move.ts` — `canBeginContainerMove`, the support gate the drag path uses
- `src/store/hand-slice.ts` — `setHand` / `setPicked` / `cancelHand`, and the one-hand invariant
- `src/store/commit-placement.ts` — the commit resolver both triggers already share
- `src/features/viewer3d/AreaDropPlane.tsx` — the project-cargo click target while an item is in hand

## Overview

- **Priority:** high — today a placed box cannot be moved at all without a held drag.
- **Status:** implemented; verified in the app except the final commit click (see below).
- Adds the missing single-pointer path for items already on board: click to select, click again to pick
  up, click a target to place.

## Key insights

- `setSelected` is a plain setter, so "click the same item twice" has no meaning yet — the second click
  re-selects. The two-step rule is therefore new state logic, not a tweak.
- **The support gate must be reused.** `canBeginContainerMove` currently guards only the press-drag in
  `ContainerInstances`. A click-to-pick that skips it would let a planner take a box out from under a
  stack — the exact defect the support-integrity plan closed.
- **The two cargo kinds cancel differently, and that asymmetry is forced by what is drawn:**
  - a PICKED container stays rendered (only a DRAG hides its instance), so clicking it again is a real
    target and can put it down;
  - a picked project-cargo item is NOT rendered at all (`BreakbulkCargoInstances` filters it out to
    avoid colliding with its own ghost), and `AreaDropPlane`'s pick volume covers the ship and
    `stopPropagation`s — so there is nothing to click. Esc is its put-down.
  Do not "fix" this by rendering the item in hand; that reintroduces the ghost/solid overlap the Phase D
  prototype removed. Say it in the UI text instead.
- While something is in hand, a click on a DIFFERENT placed item is ignored: the gesture owns the
  pointer, and silently swapping the hand mid-gesture is how a planner places the wrong box.

## Requirements

**Functional**

1. Click a placed item (either kind) with nothing in hand and nothing selected → it is selected
   (today's behaviour, including the inspector for containers).
2. Click the SAME item again → it is taken in hand (pick mode); the ghost, placeholders and hull-hiding
   behave exactly as they do for a pick from the unplaced list.
3. With it in hand, click a valid target → it moves there through the existing commit resolver.
4. Put down without moving: Esc (both kinds), or clicking the same container again (containers only —
   see Key insights).
5. Clicking empty water clears the selection (`onPointerMissed`, already wired) and, if something is in
   hand, ends the gesture.
6. A container that carries other boxes is REFUSED at pick-up with the same `no_floating` reason the
   drag path gives, and stays merely selected.

**Non-functional**

- The click decision is a pure function, unit-tested; the components only dispatch it.
- No change to the drag path, the commit resolver, or any placement rule.

## Architecture

New module `src/store/cargo-click-action.ts`:

```ts
export type CargoClickAction = "select" | "pick" | "putDown" | "ignore";

/** What a click on a PLACED item means, given what is selected and what is in hand. */
export function cargoClickAction(
  state: { selectedId: string | null; inHand: Hand | null; handMode: HandMode },
  clickedId: string,
): CargoClickAction;
```

Rules (the whole state machine, and the reason it is testable):

| in hand | selected | click on | action |
|---|---|---|---|
| none | not this id | this id | `select` |
| none | this id | this id | `pick` |
| this id | — | this id | `putDown` |
| another id | — | this id | `ignore` |

Both instance components call it and dispatch:

```ts
switch (cargoClickAction(usePlanStore.getState(), id)) {
  case "select":  setSelected(id); break;
  case "pick":    // containers: gate first, then setPicked(id)
                  if (canBeginContainerMove(vessel, plan, id)) setPicked(id);
                  // project cargo: setHand({ kind: "breakbulk", id }, "pick")
                  break;
  case "putDown": cancelPlacement(); break;
  case "ignore":  break;
}
```

`movedRef` still suppresses the trailing click of a drag; the `breakbulkHand` guard in
`ContainerInstances` still keeps the container layer out of a project-cargo gesture.

**Discoverability:** the existing hint line under the unplaced lists is the natural place to say it —
extend the project-cargo hint and add the equivalent for containers ("click a box to select it, click
again to pick it up"). One sentence each, no new panel.

## Related code files

**Create**
- `src/store/cargo-click-action.ts`
- `src/store/__tests__/cargo-click-action.test.ts`

**Modify**
- `src/features/viewer3d/ContainerInstances.tsx` (onClick dispatch; keep the gate)
- `src/features/viewer3d/BreakbulkCargoInstances.tsx` (onClick dispatch)
- `src/features/panels/UnplacedCargoList.tsx` and/or `UnplacedProjectCargoList.tsx` (hint wording)

**Delete** — none.

## Implementation steps

1. Write `cargo-click-action.ts` with the table above as its header, and test all four rows plus the
   "nothing selected, nothing in hand" entry case.
2. Wire `ContainerInstances`: dispatch, with `canBeginContainerMove` in front of `pick`. A refused
   pick-up leaves the item selected and records the reason (the gate already writes `dropOutcome`).
3. Wire `BreakbulkCargoInstances`: dispatch; `pick` → `setHand({kind:"breakbulk", id}, "pick")`.
4. Hint wording.
5. `npm run typecheck`, `npx vitest run src/`.
6. Browser check (all click-driven, so fully drivable):
   - click a placed container → selected, inspector shows it, hull still up;
   - click it again → hull hides, placeholders appear, chip follows the pointer;
   - click an empty valid slot → it moves; the plan's placed count is unchanged and the box is at the
     new slot;
   - click a bottom-of-stack box twice → refusal reason, no hand armed;
   - same first two steps for a project-cargo item, then Esc to put it down.

## Todo list

- [x] `cargo-click-action.ts` + 7 tests (every row of the table, plus the two invariants)
- [x] `ContainerInstances` dispatch, `canBeginContainerMove` kept in front of `pick`
- [x] `BreakbulkCargoInstances` dispatch
- [x] Hint wording for both lists
- [x] typecheck clean + `npx vitest run src/` = 90 files / 716 tests green
- [~] Browser check — three of four branches confirmed, see below

### Verified in the app (BBC SAO PAULO, DEMU0000422 at slot 340588, a top-of-stack box)

| Step | Signal | Result |
|---|---|---|
| 1st click | `.viewport` class, inspector | `"viewport "` — NOT armed; inspector shows the box. One click never arms a hand |
| 2nd click | `.viewport` class, canvas | `"viewport cursor-crosshair viewport-armed"`; hull hidden, placeholders drawn |
| hover targets while held | drop chip | live verdicts naming the box: `Slot 140504 — placing DEMU0000422 · Refused: no container below` |
| 3rd click on the held box | `.viewport` class | `"viewport cursor-grab"` — armed cleared, i.e. `putDown` works |

**NOT verified live: the final commit click** (armed → click a VALID slot → the box moves). Finding a
green slot by pointer on the loaded demo proved impractical: the ship is 110/110 placed, so nearly
every valid target is buried, and `EmptySlotPicker`'s pitch-sized volumes for the many EMPTY slots
occlude the cargo from most camera angles. The commit itself is the pre-existing
`commitPlacement` path, unchanged by this phase and covered by `store/__tests__/commit-placement.test.ts`.
The `ignore` branch is likewise unit-tested only.

### Side observation, not part of this phase

With a bay filter active, the bay-plan panel reports `Bay NN · 0 containers` for every bay walked
(02, 06, 10, 14, 18) on a plan with 110 placed containers. Either the panel counts by a key the
placements do not match, or the demo's placements sit in odd (20') bays the panel does not attribute to
their 40' parent. Worth a look; it is not caused by this change.

## Success criteria

- A placed box can be moved with clicks alone, no held drag anywhere.
- The second click on a carrying box refuses with the `no_floating` reason instead of arming.
- Inspect-by-click still works: one click never arms a hand.
- Drag behaviour is byte-for-byte unchanged.

## Risk assessment

| Risk | Mitigation |
|---|---|
| Click-to-pick bypasses the support gate | The gate is called on the `pick` branch; a store-level test already covers the gate itself |
| The trailing click of a drag arms a pick | `movedRef` already suppresses it — keep that guard when rewriting `onClick` |
| Project cargo cannot be put down by clicking | Documented asymmetry; Esc works, and the hint says so |
| A click mid-gesture swaps the hand | `ignore` row in the table, tested |

## Security considerations

None — view/plan state only, no I/O.

## Next steps

Independent of phase 02.
