# Phase 01 — Right sidebar shell, tabs, collapse; Load merged into View

## Context links
- [plan.md](plan.md)
- `src/App.tsx`: `.layout` → `<Sidebar …/>` + `<main className="stage">`
- `src/features/panels/Sidebar.tsx`: the Load/View/Check tabs; the root hooks `useStowageKeyboardShortcuts`,
  `useStowageDropRelease`
- `src/features/panels/ProjectCargoPanel.tsx`: the project-cargo load toggle + the "+ Add project cargo" button/form
- `src/components/ui/tabs.tsx`, `src/store/usePlanStore.ts` (`SidebarTab`, `sidebarTab`)
- `src/styles.css`: `.layout`, `.sidebar*`, the 760 px media query

## Overview
- **Priority:** high.
- **Status:** not started.
- A new `RightSidebar` (Cargo · Custom tabs, collapsible, remembered) is added as a third layout column. The left
  Load tab is removed: the cargo toggles + inspector go into View, and the lists and the form move right, unchanged.

## Key insights
- **Moving the lists right does not affect dragging:** the drop-release hook listens on `window` and is mounted at
  the LEFT Sidebar root, so a drag that starts in the right sidebar is released by it exactly as before. It must
  not be mounted twice.
- **The project-cargo panel is split:**
  - the "Load/Clear project cargo" toggle goes to View next to the container toggle ("Cargo" section, two
    buttons);
  - the form goes to the Custom tab. It stays behind "+ Add project cargo" in this phase and is opened
    permanently in phase 03.
- **SidebarTab becomes `"view" | "check"`**, default "view". The test that lists the tabs is updated, and the
  status strip still opens "check".
- **Right-sidebar state:** `rightTab: "cargo" | "custom"`, `rightCollapsed: boolean`, both remembered in
  `localStorage` through one small try/catch helper. If the stage-swap plan's `stage-layout-storage.ts` exists by
  then, generalise it to `view-prefs-storage.ts` instead of adding a second one.
- **Collapsed:** the column shrinks to about 36 px showing two icon buttons (📋 Cargo, ＋ Custom) with counts as
  badges. Clicking one expands the panel to that tab. The grid template comes from a class
  (`layout-right-collapsed`), so the stage just gets wider (R3F resizes, no remount).
- **Tab labels carry counts:** "Cargo 20" (unplaced containers + unplaced project cargo) and "Custom 3" (items
  created). The planner sees work waiting even when collapsed.

## Requirements
- `src/features/panels/RightSidebar.tsx`: header (title + collapse button), `Tabs` (cargo | custom), bodies:
  - Cargo → `UnplacedCargoList`, then `UnplacedProjectCargoList` (moved as-is; phase 02 replaces them);
  - Custom → `CustomCargoForm` behind today's button (moved as-is; phase 03 changes it).
- Left `Sidebar.tsx`: tabs View · Check. View = the "Cargo" section (container toggle + project-cargo toggle) +
  `ContainerInspector` + `ColorModeControl` + `ViewOptionsPanel`.
- `ProjectCargoPanel.tsx` is reduced to the toggle (or folded into the Cargo section and deleted).
- Store: `rightTab`, `rightCollapsed`, setters, persistence; `SidebarTab` narrowed.
- `App.tsx`: renders `<RightSidebar vessel plan />` after `<main>`; the layout class reflects `rightCollapsed`.
- CSS: `.layout { grid-template-columns: 300px 1fr 300px }`, `.layout-right-collapsed { … 1fr 36px }`,
  `.right-sidebar` mirroring `.sidebar` (border-left, flex column, its own scroll); the 760 px query stacks it and
  starts it collapsed.

## Related code files
- Create: `RightSidebar.tsx`, `src/store/view-prefs-storage.ts` (or generalise the stage-swap one)
- Modify: `Sidebar.tsx`, `ProjectCargoPanel.tsx`, `App.tsx`, `usePlanStore.ts`, `styles.css`,
  `src/store/__tests__/view-reset.test.ts`
- Tests: `src/store/__tests__/right-sidebar-prefs.test.ts` (defaults, toggle, persistence, storage throwing)

## Implementation steps
1. Store fields + prefs helper + tests; narrow `SidebarTab`, fix the test.
2. `RightSidebar` with the moved components; `App` + CSS columns.
3. The left View tab composition; split/fold `ProjectCargoPanel`.
4. `npx tsc --noEmit` + suite.
5. Browser, 1440 × 900:
   - three columns; the left tabs are View · Check; the right tabs are Cargo · Custom with counts;
   - drag an unplaced container from the RIGHT list onto the 3D view → placed (the release hook works);
   - pick a project-cargo row → place by clicking the deck;
   - collapse → the stage widens (the canvas element stays the same) and the icons show counts; clicking an icon
     expands to that tab;
   - reload → the tab and collapsed state are remembered;
   - keyboard shortcuts (R, Esc, Delete, arrows, `[` `]`) still work.

## Todo list
- [ ] Store fields + prefs + tests; `SidebarTab` narrowed
- [ ] `RightSidebar` + moved lists/form
- [ ] Left View composition; project-cargo toggle moved
- [ ] App columns + CSS (+ collapsed, + narrow screens)
- [ ] `npx tsc --noEmit` + suite green
- [ ] Browser checks

## Success criteria
- Everything that was in Load is reachable (toggles/inspector left, lists/form right), and drag/pick works from
  the right sidebar.

## Risk assessment
- **Stage width shrinks by 300 px:** the 3D view and the bay overview get narrower (the overview scrolls sideways
  already). Collapse gives it back.
- **Two sidebars both show "Cargo":** the left section is the load TOGGLES, the right tab is the LIST. Headings
  make that explicit ("Demo cargo" vs "Cargo list").

## Security considerations
`localStorage` holds only UI prefs; values are validated on read.

## Next steps
Phase 02.
