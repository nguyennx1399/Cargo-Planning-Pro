# Phase 05 — Cargo editing panels (inspector, unplaced list, add/remove, checks, toolbar)

## Context links
- Plan: [plan.md](plan.md) · Depends on [phase-02](phase-02-plan-draft-store-history-auto-stow.md)
- Current: `src/features/panels/Sidebar.tsx` (read-only inspector + checks, 114 LOC)

## Overview
- **Priority:** P0 · **Size:** M · **Status:** Pending
- Turn the sidebar into the planner's control panel: edit the selected box, manage unplaced cargo, add or remove boxes, see the checks, and run auto-stow/undo/redo/reset.

## Key insights
- Sidebar.tsx will pass 200 LOC → split it into focused panel components; `Sidebar` only composes them.
- The inputs and the store actions both validate (defence in depth). The UI shows inline errors, and the store rejects invalid patches.
- Violations drive navigation. Clicking one selects the box and jumps the bay plan to it (`bayFilter`).

## Requirements
**Functional**
- **PlanToolbar** (top of sidebar):
  - Undo and Redo, with the next label in the tooltip and disabled when empty.
  - "Auto-stow remaining", "Re-stow all" (with confirm), "Reset demo" (with confirm).
- **ContainerInspector** (selected box):
  - Editable fields:
    - Weight: number, 2.0–32.5 t, step 0.1. Commit on blur or Enter; one history entry per commit.
    - POD: select from the rotation, excluding POL.
    - Type: DRY or REEFER.
    - HC: toggle, 40' only.
    - IMDG: none or class 1–9.
  - Read-only: ID, slot code, size. Size is editable only while the box is unplaced.
  - Buttons: Move (pick), Unload, Delete (confirm).
  - Shows any violations that involve this box.
- **UnplacedCargoPanel**:
  - List with search (id) and a POD filter; count, TEU and weight totals.
  - Each row: size, type glyph, weight, POD color chip, and a Place button (sets `pickedId`).
  - Root has `data-drop="unplaced"` (the drag target contract with Phase 03).
- **AddContainerForm** (inline in the unplaced panel): size, type, HC, weight, POD, IMDG. The ISO 6346 id is generated automatically. The new box goes into the unplaced list.
- **ChecksPanel**:
  - KPI grid: placed/total, TEU %, errors, warnings, overstows.
  - Violations grouped by rule with counts; errors first; click → select + jump to bay.
  - "No rule violations" when clean.
- **ViewOptionsPanel**: the existing color mode, deck toggles and bay select, moved out of Sidebar unchanged.
- **Keyboard:** `Delete` unloads, `M` picks, `Esc` cancels (shared hook with Phase 03).

**Non-functional**
- Inputs have labels and use `aria-invalid` plus an error message. Focus stays visible (`:focus-visible` already styled).
- The unplaced list stays smooth up to ~200 items. No virtualisation needed (YAGNI).

## Architecture
```
Sidebar ─ PlanToolbar
        ├ ContainerInspector ─ NumberField / SelectField (tiny shared form controls)
        ├ UnplacedCargoPanel ─ AddContainerForm
        ├ ChecksPanel
        ├ StabilityPanel      (Phase 06 slot; placeholder until then)
        └ ViewOptionsPanel
```

## Related code files
- **Create:** `src/features/panels/PlanToolbar.tsx`, `ContainerInspector.tsx`, `UnplacedCargoPanel.tsx`, `AddContainerForm.tsx`, `ChecksPanel.tsx`, `ViewOptionsPanel.tsx`, `src/features/panels/form-controls.tsx`.
- **Modify:** `Sidebar.tsx` (compose only), `styles.css` (panel and form styles; coordinate with Phase 03: append-only section `/* panels */`).
- **File ownership:** `features/panels/**`.

## Implementation steps
1. Extract ViewOptionsPanel and ChecksPanel from Sidebar (no behaviour change); check typecheck.
2. PlanToolbar wired to undo/redo/autoStow/reset.
3. ContainerInspector read/edit plus the per-box violation list.
4. UnplacedCargoPanel + AddContainerForm (+ drop contract attribute).
5. Violation click → select + bay jump.
6. Store-level tests for patch validation (NaN, negative, >32.5, HC on a 20') → `ok:false`.

## Todo
- [ ] extract existing panels
- [ ] toolbar
- [ ] inspector edit + validation
- [ ] unplaced list + add form
- [ ] violation navigation
- [ ] patch validation tests

## Success criteria
- Demo script steps 3–6 can be done from the sidebar.
- Every edit is undoable as exactly one step.
- Invalid input never reaches the store.

## Risks
- Every keystroke in weight creates history noise → commit on blur/Enter only.
- The sidebar gets long → sections are collapsible (`<details>`), and Inspector + Checks stay open by default.

## Security
Sanitise all numeric input (finite, clamped). No `dangerouslySetInnerHTML`.

## Next
Phase 06 fills the StabilityPanel slot.
