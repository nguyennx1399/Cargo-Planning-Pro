# Phase 01 — Support integrity on move & unplace

## Context links

- `src/engine/placement/can-place-container.ts` — the per-slot predicate (destination only today)
- `src/engine/validation-rules.ts` — the plan-wide `no_floating` rule this must agree with
- `src/store/usePlanDraftStore.ts:102` (`putContainer`), `:137` (`unplaceContainer`)
- `src/lib/drop-verdict.ts`, `src/engine/placement/placeholders.ts` — hover/ghost verdicts
- `src/features/panels/use-stowage-keyboard-shortcuts.ts`, `ContainerInspector.tsx` — Delete/unplace UI

## Overview

- **Priority:** high — the plan silently becomes physically impossible.
- **Status:** not started.
- A move or an unplace vacates a slot. Boxes standing on that slot lose their support, and nothing
  refuses (or even mentions) it. The plan-wide report catches it afterwards, so the app contradicts
  itself: the drop said "clean", the Checks panel says `no_floating`.

## Key insights

- Verified: `moveContainer("DEMU0000016", {bay:22,row:6,tier:86})` → `ok:true, reasons:[]`, and the
  report went 0 → 1 `no_floating`. The destination was genuinely fine; the ORIGIN was not.
- `canPlaceContainer`'s contract is "one candidate, one slot". Origin damage is a different question
  and must NOT be smuggled into it, or `validSlotsFor`'s sweep starts answering about the origin for
  all ~900 slots and every slot turns red for the same reason.
- The demo plan can already contain violations. The check must therefore compare **before vs after**
  and refuse only the floaters the edit CREATES — never blame the planner for pre-existing ones.
- `unplaceContainer` currently returns `void`. It needs to return `PlacementResult` like its siblings,
  which is a small API change with two call sites.

## Requirements

**Functional**

1. A move that would leave any box unsupported is refused, with a reason naming the dependents
   (e.g. `DEMU0000016: 2 containers stand on this slot (DEMU0000021, DEMU0000042)`), rule id
   `no_floating`, severity `error`.
2. Unplacing (Delete key, inspector button) is refused the same way, with the same wording.
3. The refusal is visible BEFORE the commit: pressing/picking a box that carries other boxes shows the
   reason instead of arming a hand that can never land anywhere.
4. Pre-existing floaters never block an unrelated edit.
5. A move WITHIN the same column that keeps the dependents supported is still allowed.

**Non-functional**

- Origin check is O(the column), not a plan sweep; it must not appear on the pointer-move path.
- No new rule vocabulary: reuse `no_floating` from `engine/placement/reason.ts`.

## Architecture

New pure module `src/engine/placement/support-dependents.ts`:

```ts
/** Ids that would lose their support if `containerId` left its current slot — [] when none. */
export function dependentsOf(vessel: Vessel, plan: StowagePlan, containerId: string): string[]
```

- Resolves the subject's placement, walks the tier directly above in the same 40'-bay column
  (`bayPosition`, `deckOf`, `tierBelow` — the same primitives `can-place-container.ts` uses, never a
  second definition of "the tier below"), and reports the ids whose halves lose their only support.
- A 20' half only supports the half it covers; a 40' box supports both. Reuse `pos.halves`.

Wiring (one guard, three readers):

| Caller | Change |
|---|---|
| `putContainer` (move only, i.e. subject already placed) | build the post-edit plan, `dependentsOf` on the PRE plan minus the subject; if non-empty → return `resultOf([...])` with the `no_floating` reason, write nothing |
| `unplaceContainer` | same guard; return `PlacementResult` instead of `void` |
| gesture start (`ContainerInstances` press, `UnplacedCargoList` row for a PLACED box, keyboard pick) | ask once, and on a non-empty answer record a `dropOutcome` with the reason instead of calling `setHand`/`setDraggingContainer` |

Keyboard Delete and the inspector's remove button surface the returned reasons through the existing
`dropOutcome` path — no second message channel.

## Related code files

**Create**
- `src/engine/placement/support-dependents.ts`
- `src/engine/__tests__/support-dependents.test.ts`
- `src/store/__tests__/move-support-guard.test.ts`

**Modify**
- `src/store/usePlanDraftStore.ts` (guard in `putContainer` move branch + `unplaceContainer` signature)
- `src/features/viewer3d/ContainerInstances.tsx` (refuse to arm a move that would strand boxes)
- `src/features/panels/use-stowage-keyboard-shortcuts.ts`, `src/features/panels/ContainerInspector.tsx`
  (consume the new `PlacementResult` from unplace)
- `src/lib/drop-feedback.ts` only if a new origin-shaped outcome is genuinely needed — prefer reusing
  the existing slot-shaped outcome with the subject's CURRENT slot as the target.

**Delete** — none.

## Implementation steps

1. Write `support-dependents.ts` with its header comment; no store, no three imports.
2. Unit-test it directly: 40' over 40', 20' half over 40', 40' over two 20' halves, top box (no
   dependents), on-deck tier 82 (nothing below, but boxes above it DO depend on it), bay with no stack
   spec.
3. Guard `putContainer`'s move branch. Compare dependents before/after so a move inside the column
   that still supports them passes.
4. Change `unplaceContainer` to return `PlacementResult`; update both call sites.
5. Gate gesture start in `ContainerInstances` (and the unplaced-list row for placed boxes) on the same
   answer, recording the reason as the drop outcome.
6. `npm run typecheck`, `npm run test`.
7. Manual check in the browser (dev server + the same method used to gather the evidence): press a
   bottom box of a stack → the reason appears, no ghost arms; press a top box → normal move.

## Todo list

- [x] `support-dependents.ts` + unit tests (9 cases, incl. 20'/40' halves, deck boundary, pre-existing floater)
- [x] `putContainer` move guard (before/after comparison)
- [x] `unplaceContainer` returns `PlacementResult`; call sites updated (see note below)
- [x] Gesture-start refusal + recorded reason (`store/begin-container-move.ts`, called by `ContainerInstances`)
- [x] Store-level regression test: the exact DEMU0000016 case from the evidence table
- [x] typecheck clean + `npx vitest run src/` = 85 files / 665 tests green
- [~] Manual 3D check — **blocked by tooling**, see below

### Notes from implementation

- **`unplaceContainer` had no UI call site at all.** The plan assumed the keyboard Delete and the
  inspector used it; they do not — `use-stowage-keyboard-shortcuts.ts` only unplaces project cargo
  (`unplaceBreakbulk`). Only tests called it. Signature changed, tests updated, nothing else to wire.
- **Only one surface starts a MOVE of a placed box:** the 3D press-drag in `ContainerInstances`. The
  unplaced list only ever starts placements of UNPLACED boxes, which can strand nothing. So the
  gesture-start gate has exactly one call site.
- **Manual 3D verification could not be driven by the browser tooling:** the automation's drag does not
  deliver the intermediate pointer moves R3F needs to cross the 4 px press threshold (hover events do
  arrive; held-button drags do not). The same limitation was hit while gathering the phase 02 evidence.
  The gate's logic is therefore covered in node (`begin-container-move.test.ts`), leaving only the
  single call line in `ContainerInstances.tsx:169` unexercised by automation. **Needs one human
  press-drag on a bottom box of a stack to close out.**

## Success criteria

- The reproduction case (`moveContainer("DEMU0000016", bay 22/row 06/tier 86)` on the loaded demo
  plan) returns `ok:false` with a `no_floating` reason naming `DEMU0000021`.
- `validatePlan` `no_floating` count cannot increase through any UI edit path.
- Existing suite still green, including the 199-overstow baseline.

## Risk assessment

| Risk | Mitigation |
|---|---|
| Whole placeholder layer turns red because the origin is bad | Refuse at gesture start instead of per-slot; the per-slot sweep keeps answering only about destinations |
| Pre-existing floaters block unrelated edits | Before/after comparison, tested explicitly |
| Delete becomes unusable on a loaded ship | The message names the boxes to move first; unplacing a top box is unaffected |
| Double definition of "tier below" | `support-dependents.ts` calls `tierBelow`/`bayPosition`, never its own arithmetic |

## Security considerations

None — local state only, no I/O, no user data.

## Next steps

Independent of phases 02/03; can be implemented and shipped on its own.
