# Phase 02 — Valid-slot envelope outline

## Context links

- `src/features/viewer3d/SlotPlaceholders.tsx` — already computes the valid, visible slot set
- `src/features/viewer3d/area-rect-graphics.tsx:74` — `AreaRectOutline`, the border project cargo uses
- `src/features/viewer3d/AreaPlaceholders.tsx:29` — the `LIFT` stack that keeps layers off each other
- `src/engine/stowage-model/types.ts` — `SlotDef.rect` (placement x convention) and `.center` (scene)
- `src/lib/drop-verdict.ts` — `DROP_TINT`, the one place a verdict becomes a colour

## Overview

- **Priority:** medium — the "border in general of the available area" half of the request.
- **Status:** implemented and verified in the app (2026-09-17).
- A container gesture draws one translucent box per valid slot and nothing that says, at a glance,
  *where on the ship this box may go at all*. Project cargo has had that border since Phase D.

## Key insights

- `SlotPlaceholders` already holds exactly the right set: `validSlotsFor(...)` filtered by
  `slotVisible` — valid AND visible under the current toggles. Computing the envelope anywhere else
  would either duplicate that sweep (~1 ms per gesture) or disagree with it. Draw the outline from
  INSIDE that component.
- `SlotDef.rect` is already in the placement-x convention `AreaRectOutline` expects, so the envelope is
  a min/max fold — no coordinate conversion, no new convention.
- The vertical placement must be a DECK's plane, not a slot centre: use the lowest tier's base in that
  set (`min(center[1]) − height/2`) plus a small lift, mirroring `AreaPlaceholders`' `LIFT` discipline
  so the outline never z-fights with a placeholder box.
- A bounding rect over scattered valid slots claims more ground than is valid. That is accepted — the
  request asks for the border "in general", and the per-slot boxes stay the precise answer. Say it in
  the module header so nobody later "fixes" it into a per-slot hull.

## Requirements

**Functional**

1. While a container is in hand, draw one outline per deck level that has at least one valid, visible
   slot: the bounding rect of that level's slots.
2. No valid slots on a level → no outline for it. No gesture → nothing drawn.
3. The outline follows the same toggles as the placeholders: it is derived from the same filtered set,
   so unticking "Under deck" removes the under-deck outline with its placeholders.
4. Colour matches the drop vocabulary (`DROP_TINT.valid`), so it cannot drift from the placeholder tint.

**Non-functional**

- `raycast={() => null}` like every other drawn layer: it must never intercept the pick.
- One sweep per gesture; the envelope is an O(n) fold over a set the component already has.
- Pure arithmetic in its own module, node-tested on both vessels; the component only draws.

## Architecture

New pure module `src/lib/slot-envelope.ts`:

```ts
export interface SlotEnvelope { deck: "on" | "under"; rect: Rect; y: number }
/** Bounding rect per deck level over the slots given, with the y of that level's lowest base. */
export function slotEnvelopes(slots: readonly SlotDef[], heightM: number): SlotEnvelope[]
```

- groups by `SlotDef.deck`, folds `rect` min/max, takes `min(center[1]) − heightM / 2`;
- returns `[]` for an empty set; order is deterministic (`on` before `under`) so the drawn order is
  stable across gestures.

`SlotPlaceholders` renders, after its instanced mesh:

```tsx
{slotEnvelopes(slots, height).map((e) => (
  <AreaRectOutline key={e.deck} rect={e.rect} lengthM={vessel.length_m} y={e.y + ENVELOPE_LIFT} color={DROP_TINT.valid} />
))}
```

The component's return becomes a `<group>` wrapping the mesh and the outlines. It stays well under the
200-LOC rule (~95 lines today).

## Related code files

**Create**
- `src/lib/slot-envelope.ts`
- `src/lib/__tests__/slot-envelope.test.ts`

**Modify**
- `src/features/viewer3d/SlotPlaceholders.tsx` (wrap in a group, render the outlines, extend the header)

**Delete** — none.

## Implementation steps

1. Write `slot-envelope.ts` with its header (including the "bounding rect over-claims, on purpose" note).
2. Test it against real model slots from both vessels: on/under split, a single-slot set (degenerate
   rect), an empty set, and that every valid slot's rect lies inside its level's envelope.
3. Render the outlines from `SlotPlaceholders`; keep `raycast={() => null}` on anything new.
4. `npm run typecheck`, `npx vitest run src/`.
5. Browser check through the PICK path: pick an unplaced 40' box → one outline around the on-deck drop
   region and one under deck; untick "Under deck" → the under-deck outline goes with its placeholders;
   pick a 20' box → the outline follows the odd-bay set (different envelope).

## Todo list

- [x] `slot-envelope.ts` + 8 tests (both vessels, containment property, deck order, base-not-centre,
      high-cube offset, single slot, empty set)
- [x] Outlines rendered from `SlotPlaceholders` (wrapped in a `<group>`, `AreaRectOutline`, `DROP_TINT.valid`)
- [x] typecheck clean + `npx vitest run src/` = 89 files / 709 tests green
- [x] Browser check, including the deck toggle and a 20' vs 40' box

### Verified in the app

| Check | Result |
|---|---|
| 20' box, BBC SAO PAULO | one green outline around the on-deck valid region, placeholders inside it |
| 40' box, MV Demo Horizon, cargo cleared | TWO outlined levels — on deck and under deck — each enclosing its own placeholders |
| Untick "Under deck" with the box still in hand | the under-deck outline goes with its placeholders; the on-deck one stays |
| Esc | both gone with the placeholders |

### Note on tooling

`npx prettier --write` was run on `SlotPlaceholders.tsx` by mistake. This repo has NO prettier config,
so it reformatted unrelated lines to an 80-column default against the file's ~110. Reverted with
`git checkout` and the change was re-applied by hand; the final diff touches only the block that had to
be re-indented into the new `<group>`. Do not run prettier here.

## Success criteria

- A container gesture shows a border around the region its box can occupy, per deck level.
- The border disappears with its placeholders when a toggle hides that level, and on release.
- No new picking surface: the pick still belongs to `EmptySlotPicker` alone.

## Risk assessment

| Risk | Mitigation |
|---|---|
| Bounding rect implies valid ground that is not valid | Stated in the header and in this plan; the per-slot boxes remain the precise layer. If it misleads in practice, the fallback is per-bay outlines (the option not taken) |
| Z-fighting with placeholders or the deck | Explicit lift, following `AreaPlaceholders`' existing `LIFT` ordering |
| Outline drawn where no slot is visible | Derived from the SAME filtered set the placeholders use — cannot diverge by construction |
| Colour drifts from the placeholder tint | Reuses `DROP_TINT`, the one place a verdict becomes a colour |

## Security considerations

None — view state only.

## Next steps

Optional follow-up, not planned: the same envelope could label itself ("14 slots here") the way the
area placeholders label their rect. Left out as YAGNI until asked.
