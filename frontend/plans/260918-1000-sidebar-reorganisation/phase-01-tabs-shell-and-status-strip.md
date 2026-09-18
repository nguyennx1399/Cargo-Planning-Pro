# Phase 01 — Tabs shell, status strip, section moves

## Context links

- `src/features/panels/Sidebar.tsx` — current single-column layout; mounts `useStowageKeyboardShortcuts` and `useStowageDropRelease`
- `node_modules/@base-ui/react/tabs` — accessible tabs primitive, already a dependency
- `src/components/ui/*` — the shadcn-style wrappers the app uses (button, select, toggle-group, …); no `tabs.tsx` yet
- `src/features/panels/use-stowage-keyboard-shortcuts.ts` — global ArrowLeft/Right = camera pan, `[` `]` = bay
- `src/store/usePlanStore.ts` — view state lives here

## Overview

- **Priority:** high — it is the reorganisation itself.
- **Status:** done (2026-09-18).
- Replace the single 5.6-screen column with a fixed header + status strip, three tabs, and a fixed
  disclaimer footer.

## Key insights

- **The two global hooks MUST stay at the Sidebar root.** `useStowageKeyboardShortcuts` (undo/redo, Esc,
  R, Delete, arrows, brackets) and `useStowageDropRelease` (the window-level release that commits or
  cancels every drag) are mounted in `Sidebar.tsx` today. If either ends up inside a tab body, switching
  to another tab unmounts it: drags would never release and shortcuts would stop working. Keep them where
  they are, above the tabs, and say so in a comment.
- **Arrow keys will now conflict.** A focused tablist uses ArrowLeft/Right to move between tabs (that is
  the accessible pattern, and base-ui implements it). Since the arrow-key plan, ArrowLeft/Right are ALSO
  global camera-pan keys. With a tab focused, one press would switch tab AND pan the ship. The global
  handler's typing guard only exempts INPUT/TEXTAREA; it must also yield when focus is inside an element
  that owns arrow keys — `[role="tablist"]` at minimum (and ideally `[role="listbox"]`, sliders, and the
  Radix/base-ui select). Fix it in the guard, not in the tabs.
- **Errors must not hide behind a tab.** Moving Checks to its own tab means an error introduced while on
  Load would be invisible. A one-line status strip under the header — placed · warnings · errors, from the
  report the Checks section already reads — keeps that visible everywhere. Clicking it switches to Check.
- **The disclaimer is safety text**, not decoration ("Planning aid only. Verify stability on the approved
  loading computer." — also the README's warning). It moves out of the scroll body into a fixed footer so
  it is on screen on every tab.
- **Tab state belongs in the store**, not `useState`: App may remount the Sidebar on a vessel switch, and
  losing the planner's tab on every vessel change would be irritating. Session-scoped only.
- **Do not auto-switch tabs on a gesture.** Tempting (pick an item → jump to Load to see the inspector),
  but a tab changing under the planner is disorienting, and the drop verdict is already at the cursor
  (`DropVerdictChip`). Stated here so it is not "improved" later.

## Section → tab mapping

| Tab | Sections, in order |
|---|---|
| **Load** | Cargo toggles · Container inspector · Unplaced containers · Project cargo (toggle + add) · Unplaced project cargo |
| **View** | Color by · Show (hull/deck toggles, bay, reset view, stowage box, free space) |
| **Check** | Checks · Stability · Loading sequence |

Inspector moves ABOVE the unplaced list: it is the readout of the thing being placed, so it belongs next
to where placing starts.

## Requirements

**Functional**

1. Header (vessel name, voyage, vessel selector) and a status strip are visible on every tab.
2. Three tabs, Load default; the chosen tab survives a vessel switch within the session.
3. Every existing section appears on exactly one tab, per the mapping; no behaviour changes.
4. The disclaimer is visible on every tab.
5. Clicking the status strip opens the Check tab.
6. With a tab focused, ArrowLeft/Right switch tabs and do NOT pan the camera; elsewhere they still pan.
7. Drags still release/cancel and all shortcuts still work regardless of the active tab.

**Non-functional**

- Each tab body fits in roughly one screen at 1440 × 900 with the default demo data (Check may scroll
  once phase 02 lands — measure after).
- No new dependency: `@base-ui/react/tabs` wrapped as `components/ui/tabs.tsx`.

## Architecture

- `src/components/ui/tabs.tsx` — thin wrapper over base-ui Tabs, styled like the existing ui primitives.
- `src/store/usePlanStore.ts` — `sidebarTab: "load" | "view" | "check"` + `setSidebarTab`.
- `src/features/panels/SidebarStatusStrip.tsx` — one line from `report.kpis`, click → `setSidebarTab("check")`.
- `src/features/panels/Sidebar.tsx` — keeps the hooks and the header; renders the strip, the tabs, and the
  footer; each tab body is a list of the existing panel components (no logic moves).
- `use-stowage-keyboard-shortcuts.ts` — widen the focus guard:

```ts
const ownsArrowKeys = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  target.closest('[role="tablist"], [role="listbox"], [role="slider"], [role="combobox"]') !== null;
```

## Related code files

**Create**
- `src/components/ui/tabs.tsx`
- `src/features/panels/SidebarStatusStrip.tsx`

**Modify**
- `src/features/panels/Sidebar.tsx`
- `src/store/usePlanStore.ts`
- `src/features/panels/use-stowage-keyboard-shortcuts.ts`
- `src/styles.css` (fixed header/strip/footer, scrollable tab body)

**Delete** — none.

## Implementation steps

1. `tabs.tsx` wrapper.
2. Store field + action.
3. Status strip component.
4. Restructure `Sidebar.tsx`: hooks + header + strip at the top, tabs with the mapped sections, footer.
5. Widen the arrow-key guard.
6. Layout CSS: header/strip/footer fixed, the tab body is the only scrolling region.
7. `npm run typecheck`, `npx vitest run src/`.
8. Browser:
   - every section is reachable on its tab, none missing, none duplicated;
   - measure each tab body's height (target ≈ one screen);
   - on the View tab, pick a placed container in 3D and drop it → the drag still releases (hooks alive);
   - focus the tablist, press → : tab changes, camera does not move; click the canvas, press → : camera pans;
   - switch vessel → the tab is kept;
   - introduce a warning while on Load → the strip updates.

## Todo list

- [x] `components/ui/tabs.tsx`
- [x] `sidebarTab` in the store
- [x] `SidebarStatusStrip`
- [x] Sidebar restructure (hooks stay at root, disclaimer in a fixed footer)
- [x] Arrow-key guard widened
- [x] Layout CSS
- [x] typecheck + suite green
- [x] Browser checks incl. the arrow-key conflict (tablist keeps arrows, canvas pans), strip → Check, tab kept across vessel switch. Drag-on-another-tab checked in code only (hooks mounted at Sidebar root, outside tabs); synthetic pointer events cannot drive an R3F drag

## Success criteria

- The working controls are at the top of the default tab; no tab needs more than about one screen.
- No behaviour regression: drags release, shortcuts work, on every tab.
- Errors and the disclaimer are never hidden by the tab choice.

## Risk assessment

| Risk | Mitigation |
|---|---|
| A global hook unmounts with a tab — drags never release | Hooks stay at the Sidebar root, commented; browser check drags from the View tab |
| One arrow press switches tab AND pans the ship | Widen the focus guard; browser check both focus states |
| An error goes unnoticed on the Load tab | Always-visible status strip |
| Disclaimer scrolled away | Fixed footer |
| Tab resets on every vessel switch | Store-held tab state |

## Security considerations

None — layout only.

## Next steps

Phase 02 shrinks Check; phase 03 shrinks Load.
