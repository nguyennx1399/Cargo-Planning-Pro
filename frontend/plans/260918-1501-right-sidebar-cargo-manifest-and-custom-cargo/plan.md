# Right sidebar: cargo manifest + custom project cargo

## Ask (user, 2026-09-18)

A right sidebar with 2 tabs: one for the cargo list, one for custom project cargo.

## Decisions (user, 2026-09-18)

| Topic | Decision |
|---|---|
| Cargo tab | **Both:** a manifest of ALL cargo with a **Placed / Unplaced / All** filter. Unplaced rows keep drag/pick exactly as today. |
| Custom tab | **Form + my items:** the add form always open (cargo or support frame), and below it the list of items the planner created, each with pick/place, edit and delete. |
| Left sidebar | **Merge Load into View:** the Load tab goes away, and the cargo toggles + Container inspector move into View. The left sidebar becomes **View · Check**. |
| Behaviour | **Collapsible, remembered:** a 300 px panel with a collapse button; collapsed, a thin strip with the tab icons; the state is remembered. |

## Where the code stands (verified)

- `.layout { grid-template-columns: 300px 1fr }`; below 760 px it becomes a single column.
- Left `Sidebar.tsx` (133 LOC) tabs: **Load** (cargo toggle, `ContainerInspector`, `UnplacedCargoList`,
  `ProjectCargoPanel` = project-cargo load toggle + "+ Add project cargo" form, `UnplacedProjectCargoList`),
  **View** and **Check**. The drop-release and keyboard-shortcut hooks live at the Sidebar root and must stay mounted.
- `UnplacedCargoList.tsx` (199 LOC) + `UnplacedListControls.tsx` (100) render from the pure
  `lib/unplaced-query.ts` (199): text/size/type/fits-bay filters, 4 sorts, 3 groupings, and arrow keys.
  It shows UNPLACED containers only.
- `UnplacedProjectCargoList.tsx` (175) shows unplaced project cargo with "fits in" / free-space hints, the
  stacking tags, and a remove "×" on custom items.
- Custom items: `usePlanStore.customCargo`, added/removed via `store/custom-cargo-in-plan.ts` (keeps
  placements + history). The form is `CustomCargoForm.tsx` + the pure `lib/custom-cargo-input.ts`.
- `SidebarTab = "load" | "view" | "check"` (default "load"); a test asserts that set.
- The stage-swap plan (`260918-1454`, not cooked) also edits `App.tsx`/the layout CSS. This plan only touches the
  **columns**, and that one only the **stage**, so they compose in either order.

## Phases

| # | Phase | Status | Priority |
|---|-------|--------|----------|
| 01 | [Right sidebar shell, tabs, collapse; Load merged into View](phase-01-right-sidebar-shell-and-left-merge.md) | not started | high |
| 02 | [Cargo manifest: Placed / Unplaced / All](phase-02-cargo-manifest.md) | not started | high |
| 03 | [Custom tab: form + my items (pick, edit, delete)](phase-03-custom-cargo-tab.md) | not started | medium |

The order matters: 01 → 02 → 03. After 01, everything already lives in its new place with today's behaviour.

## Ground rules

- **Move, then extend.** Phase 01 moves components unchanged; the new behaviour comes in 02 and 03.
- **The query stays pure and tested.** The manifest extends `lib/unplaced-query.ts` (or a sibling module); no
  filtering logic lives in components.
- **Placing is unchanged:** drag/pick from a row goes through the same store calls → the same commit resolver.
- The global hooks stay at the LEFT Sidebar root (always mounted); the right sidebar mounts none.
- Files under 200 LOC, `npx tsc --noEmit` (never `tsc -b`).

## Unresolved questions
1. **Editing a custom item that is ON BOARD:** the plan allows editing only UNPLACED items (a placed one shows
   "Unplace to edit"). Changing the size of an item under a stack or next to others could silently break the
   checks. Confirm, or ask for "edit re-validates in place".
2. **Very narrow screens (< 760 px):** the right sidebar starts collapsed and stacks under the stage. Confirm this is
   acceptable, since the app is desktop-first.
