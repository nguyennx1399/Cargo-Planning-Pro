# Phase 05 — Create frames and stackable items

## Context links
- [phase-01](phase-01-stack-model-and-geometry-engine.md): `stacking`, `"support_frame"`
- `src/features/panels/CustomCargoForm.tsx` (125 LOC), `src/lib/custom-cargo-input.ts` (`parseCustomCargo`)
- `src/data/with-custom-cargo.ts`: custom items survive toggles

## Overview
- **Priority:** medium.
- **Status:** done (2026-09-18).
- The existing "+ Add project cargo" form learns two things: **Type** (Cargo | Support frame) and an
  optional **Max top load (t)**. That is enough to create every stack the rules allow.

## Key insights
- A frame is just an item with `category: "support_frame"` and `stacking` set. No new store, no new list:
  it appears in the unplaced list and is placed like any other item (the phase 04 drop surfaces handle the rest).
- **A frame without a max top load is meaningless**, so the field is REQUIRED for a frame. It is OPTIONAL
  for cargo: filled in = stackable, left empty = nothing may rest on it.
- The demo fleet stays unchanged. Marking demo blades stackable would be a data claim the demo cannot back
  up, and it would move pinned test expectations.

## Requirements
- Form: a Type toggle (base-ui toggle group, which the app already uses) plus a "Max top load (t)" input.
  The input's label says "required" for a frame and "optional: makes it stackable" for cargo.
- `parseCustomCargo`: validates the max top load (> 0, finite). It is required when type = frame. It
  produces `category: "support_frame"` for frames and `stacking: { max_top_load_t }` when given. The
  default name prefix is `FRAME-n` for frames.
- Unplaced list: a small "frame" / "stackable ≤ N t" tag on the row, so the planner can tell them apart.

## Related code files
- Modify: `CustomCargoForm.tsx` (stays under 200 LOC; if it would go over, move the type toggle out),
  `custom-cargo-input.ts`, `UnplacedProjectCargoList.tsx` (tag)
- Tests: `custom-cargo-input` cases (frame requires the load; cargo with and without the load; invalid
  load; FRAME-n naming)

## Implementation steps
1. `parseCustomCargo` + tests (this also pays off part of the deferred `custom-cargo-input` test debt).
2. Form fields + the tag in the list.
3. Browser: create "FRAME-1" 12 × 4 × 0.5 m, 3 t, max 60 t → it is listed with its tag; place it; stack a
   custom 10 × 3.5 × 3 m, 40 t item on it → clean; create a third item of 25 t on top → "max top load" refusal.

## Todo list
- [x] Parser + tests
- [x] Form type toggle + max top load
- [x] List tag
- [x] typecheck + suite green
- [x] Browser end-to-end stack from the form

## Success criteria
- Everything needed for a stack can be created in the UI. No hand-built plans are needed any more.

## Risk assessment
- **Form length** undoes part of the sidebar work: this is two fields behind the existing "+ Add" button,
  which is acceptable.

## Security considerations
Input is parsed with the existing numeric validation. There is no free-form HTML.

## Next steps
Close the plan. Possible follow-ups (NOT in scope): bridging frames, the discharge-order warning, and
naive fill auto-stacking.
