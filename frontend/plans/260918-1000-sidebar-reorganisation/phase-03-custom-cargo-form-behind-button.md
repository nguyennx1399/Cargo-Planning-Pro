# Phase 03 — Custom-cargo form behind "+ Add project cargo"

## Context links

- `src/features/panels/CustomCargoForm.tsx` — the form (always rendered today)
- `src/features/panels/ProjectCargoPanel.tsx` — mounts it at the bottom of the Project cargo section
- `plans/260917-1840-gravity-landing-slot/phase-05-auto-pick-new-custom-cargo.md` — the (uncooked) phase
  that puts a newly created item straight into hand

## Overview

- **Priority:** medium.
- **Status:** done (2026-09-18).
- The form is most of Project cargo's 473 px and is only used when entering a new item. Collapse it
  behind one button.

## Key insights

- **Collapse, don't unmount state carelessly.** If the form is unmounted when collapsed, anything typed
  but not yet submitted is lost. Either keep the form mounted and hide it, or accept the loss and say so.
  Recommended: unmount on successful Add (the form is cleared anyway) and on an explicit Cancel; keep it
  open otherwise — so half-typed input is never discarded by a stray click.
- **Interaction with the gravity plan's phase 05.** If that phase is cooked, a successful Add puts the item
  in hand; collapsing the form at the same moment is the natural end of the flow. If it is not cooked, the
  form still collapses on Add and the item appears in the unplaced list below. Either order works; neither
  phase depends on the other.
- The button is the discoverable entry point, so its label must say what it does: "+ Add project cargo".

## Requirements

1. The Project cargo section shows the load/clear toggle and a "+ Add project cargo" button; the form is
   hidden.
2. The button opens the form in place; a Cancel closes it.
3. A successful Add closes the form (and, if phase 05 is in, the item is in hand).
4. Validation errors keep the form open with the errors shown.
5. Opening/closing never discards typed input except on Cancel.

## Architecture

- `ProjectCargoPanel` holds `const [adding, setAdding] = useState(false)`.
- `CustomCargoForm` gains `onDone?: () => void` (called after a successful Add) and a Cancel button that
  calls the same prop. It stays self-contained otherwise.

## Related code files

**Modify**
- `src/features/panels/ProjectCargoPanel.tsx`
- `src/features/panels/CustomCargoForm.tsx`

**Create / Delete** — none.

## Implementation steps

1. `onDone` prop + Cancel button on the form.
2. Toggle state in `ProjectCargoPanel`; render the button when closed, the form when open.
3. `npm run typecheck`, `npx vitest run src/`.
4. Browser: section is short by default; open → type → invalid → stays open with errors; valid → closes
   and the item is listed (or in hand); open → type → Cancel → closes.
5. Re-measure the Load tab height against phase 01's target.

## Todo list

- [x] `onDone` + Cancel on the form
- [x] Toggle in the panel
- [x] typecheck + suite green
- [x] Browser checks: open → Cancel closes; valid Add closes and item is listed. Load tab 1 445 px in a 608 px scroll region (was 5 004 px sidebar)

## Success criteria

- Project cargo collapses to two controls by default.
- Entering an item is one click more than today, and nothing typed is lost by accident.

## Risk assessment

| Risk | Mitigation |
|---|---|
| Half-typed input lost | Only Cancel and a successful Add close the form |
| Planners entering many items find the extra click tedious | The trade-off chosen; the "keep form filled" variant from the gravity plan's phase 05 notes is the escape hatch |

## Security considerations

None.

## Next steps

After all three phases, re-measure the three tab bodies and record the numbers in `plan.md` next to the
5 004 px baseline.
