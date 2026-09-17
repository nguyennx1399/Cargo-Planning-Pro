# Phase 01 — Hull hides for any gesture

## Context links

- `src/features/viewer3d/VesselScene.tsx:107` — `<Hull vessel={vessel} hidden={item !== null && view.showUnderDeck} />`
- `src/features/viewer3d/Hull.tsx:28-39` — what `hidden` means and why it is a prop
- `src/store/hand-slice.ts` — `inHand`, `activeBreakbulkId`, `dragInFlight`

## Overview

- **Priority:** high — it is the whole visible half of the request.
- **Status:** implemented and verified in the app (2026-09-17).
- Today the hull steps aside only for a project-cargo gesture, and only when "Under deck" is ticked.
  A container drag keeps the shell plating between the camera and every under-deck slot, so the
  placeholders that `SlotPlaceholders` is already drawing are simply not visible.

## Key insights

- `hidden` does not unmount the hull: every path returns `null` from the render with the geometry
  already built (`Hull.tsx:33`), so a gesture start does not pay for the loft or the GLB traversal
  again. Toggling it per gesture is therefore cheap by construction.
- Hiding the hull hides the deck, hatch covers, cranes and superstructure with it — they are merged
  into the hull component. That is what the project-cargo path already does, and what makes under-deck
  slots reachable by eye.
- The condition needs the WHOLE hand, not the project-cargo projection. `VesselScene` currently reads
  `activeBreakbulkId`; `inHand !== null` is the field that covers both kinds (`hand-slice.ts`).
- Do NOT use `dragInFlight`: it is true only for a held drag, and a PICK (the WCAG 2.5.7 path, and the
  only path the browser tooling can drive) must get the same view.

## Requirements

**Functional**

1. While anything is in hand — container or project cargo, drag or pick — the hull is hidden.
2. On release, cancel, Esc or a vessel change, the hull comes back.
3. The viewer's own "Hull" checkbox still wins: unticking it hides the hull with nothing in hand, and
   the gesture rule never re-shows it.

**Non-functional**

- No new store field: the condition is derived from `inHand`.
- No geometry rebuild per gesture (already guaranteed by `hidden` semantics — do not "optimise" it into
  an unmount).

## Architecture

One condition change in `VesselScene`:

```tsx
const inHand = usePlanStore((s) => s.inHand);          // both kinds, both modes
...
<Hull vessel={vessel} hidden={inHand !== null} />
```

`Hull`'s own `showHull || hidden` logic already gives requirement 3 for free (`Hull.tsx:130,149`).
Update `Hull.tsx`'s header comment: it currently documents the narrower "item in hand AND under-deck
shown" rule, and a stale comment about a load-bearing visibility rule is how the next reader
reintroduces the old condition.

## Related code files

**Modify**
- `src/features/viewer3d/VesselScene.tsx` (the condition + the comment above it)
- `src/features/viewer3d/Hull.tsx` (header comment only)

**Create / Delete** — none.

## Implementation steps

1. Read `inHand` in `VesselScene` (it already subscribes to the store; add the field to the existing
   selector rather than a second `usePlanStore` call where one fits).
2. Replace the `hidden` expression; drop the now-unused `view.showUnderDeck` dependency IF nothing else
   in that expression needs it (it is still needed elsewhere in the component — check before deleting).
3. Fix `Hull.tsx`'s header comment to state the new rule.
4. `npm run typecheck` and `npx vitest run src/`.
5. Verify in the browser through the PICK path (see the plan's verification note): pick an unplaced
   CONTAINER row → hull gone, under-deck placeholders visible; Esc → hull back; untick "Hull", pick
   again, release → hull stays hidden.

## Todo list

- [x] `VesselScene` condition on `inHand` (new `handInUse` boolean selector)
- [x] `Hull.tsx` header comment matches the new rule
- [x] typecheck clean + `npx vitest run src/` = 87 files / 696 tests green
- [x] Browser check: container pick hides the hull, Esc restores it
- [x] Browser check: the "Hull" toggle still wins
- [x] Bonus check: project cargo with "Under deck" OFF now hides the hull (the old rule refused to)

### Verified in the app, via the PICK path

| Check | Result |
|---|---|
| Pick an unplaced container (DEMU0000021) | hull gone; its valid-slot placeholders, previously buried inside the plating, are visible |
| Esc | hull back |
| Untick "Hull", pick, Esc | hull stays hidden — the viewer toggle still wins (`!showHull \|\| hidden`) |
| Pick project cargo with "Under deck" OFF | hull hides — under the old condition it stayed up |

`view.showUnderDeck` is still read elsewhere in `VesselScene` (the `regions` filter), so nothing went
dead with the condition change.

### Code review outcome (report in `reports/`)

Verdict: clean, no critical/high. Findings acted on:

- **`handInUse` is now a named selector** in `hand-slice.ts`, beside `activeContainerId` /
  `activeBreakbulkId` / `dragInFlight`, instead of an inline `s.inHand !== null` in the component —
  and it now has its own test (`store/__tests__/hand-in-use.test.ts`, 5 cases), because the thing it
  drives (an invisible ship) is otherwise guarded only by a human looking at the canvas.
- **`Hull.tsx`'s "returns null with the hull BUILT, never unmounted" was overstated** and is corrected:
  the three.js objects DO leave the scene; what survives a hide is the lofted geometry's `useMemo` and
  drei's `useGLTF` cache, because every hook runs before the early return.
- **Re-render cost confirmed nil:** a boolean selector under zustand's default `Object.is` re-renders
  only when it flips, which is twice per gesture, inside the same `set()` as the rest of the hand
  patch. The pointer-rate writer is `setHoveredPose`, which this component already subscribed to.
- **Both hull branches exercised:** BBC SAO PAULO (GLB/mesh) and MV Demo Horizon (lofted + LOD) — the
  reviewer's open question. Hull hides on both.

**Finding REJECTED — undo/redo does not need `cancelHand()`.** The review argued that undoing past the
operation that introduced the picked cargo leaves `inHand.id` dangling and the ship invisible. Not
reachable: `plan.containers` / `plan.breakbulk_cargo` change only through `loadPlan` (`App.tsx:64`,
the vessel/toggles effect), and `loadPlan` resets `past: []` / `future: []`. Undo/redo only swap
snapshots within ONE cargo list, so the id always resolves. Left alone deliberately.

**Note on screenshots:** the browser pane can return a stale frame right after an interaction — the
first capture after a pick showed the old scene, and the next one (~1 s later) showed the change. Every
result above was confirmed on a settled frame, not the first one.

## Success criteria

- Picking or dragging an unplaced container hides the hull and reveals the under-deck placeholders.
- Releasing/cancelling restores it, including after a refused drop.
- With "Hull" unticked, nothing about a gesture re-shows it.

## Risk assessment

| Risk | Mitigation |
|---|---|
| Losing the ship outline mid-gesture is disorienting | The user chose this over a fade; `WaterlineReference` and the placed cargo still give the shape. Revisit only if it reads badly in the browser check |
| A gesture that ends without clearing `inHand` leaves the ship invisible | `inHand` is cleared by the one hand writer (`handState`/`endHand`) on commit, Esc, cancel and vessel change — already covered by the store tests |
| Someone "optimises" `hidden` into an unmount | Header comment in `Hull.tsx` states why it must not be |

## Security considerations

None — view state only.

## Next steps

Phase 02's outline is drawn at deck level and is mostly hidden under a visible hull, so land this first.
