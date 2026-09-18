# Phase 02 — Cargo manifest: Placed / Unplaced / All

## Context links
- [phase-01](phase-01-right-sidebar-shell-and-left-merge.md)
- `src/lib/unplaced-query.ts`: `UnplacedQuery`, `queryUnplacedRows`, groups, header label, `nextRowIndex`
- `src/features/panels/UnplacedCargoList.tsx`, `UnplacedListControls.tsx`: container list UI (drag = mousedown,
  pick = click, arrow keys)
- `src/features/panels/UnplacedProjectCargoList.tsx`: project cargo rows + fits-in / free-space hints
- `src/store/cargo-click-action.ts`, `begin-container-move.ts`, `begin-breakbulk-move.ts`: select → pick of
  PLACED cargo with the lift guards
- `src/engine/slot-helpers.ts`: `slotCode`

## Overview
- **Priority:** high.
- **Status:** not started.
- The Cargo tab becomes a manifest. A **kind switch** (Containers | Project cargo) and a **status switch**
  (Unplaced | Placed | All; default Unplaced, which is today's view) sit above the existing search / filters /
  sort / group. Placed rows show where the box sits and select it on click; unplaced rows behave exactly as today.

## Key insights
- **Extend the pure query rather than fork it:**
  - `UnplacedQuery` gains `status: "unplaced" | "placed" | "all"`;
  - the input becomes every container with an optional `slot` (from `plan.placements`);
  - the text search also matches the slot code ("260486"), and the row carries `slot?: Slot`;
  - a new sort `position` (bay → row → tier) makes the placed list read like a stowage listing;
  - the header label says "Placed 110 / 130" etc.
  Existing behaviour at `status: "unplaced"` stays byte-identical, and its tests keep passing unchanged.
- **Placed-row click = the 3D rule.** `cargoClickAction` (select, then pick on a second click) goes through
  `canBeginContainerMove` / `canBeginBreakbulkMove`, so the list can never lift a box the 3D view would refuse.
  Placed rows are not drag sources (YAGNI; the pick path covers moving). Selecting a row also highlights it in 3D
  and in the bay sheet (the shared `selectedId`).
- **Selection follows everywhere:** when `selectedId` changes elsewhere (a 3D click, a bay-sheet click), the
  manifest scrolls its row into view if the row is shown. This is the other half of "a list of all cargo".
- **Project cargo manifest:**
  - status as above;
  - a placed row shows its area and position ("weather deck · 87.5 m · on FRAME-1") and its stacking tag;
  - unplaced rows keep the fits-in / free-space hints (only unplaced rows run the free-space scan, so the cost is
    unchanged).
- **Size:** "All" on MV Demo Horizon is 886 container rows, 2.2× today's worst case (400). Measure the render. If it
  is slow, render only the first 200 rows per group with "Show all N". This is honest truncation, the same rule the
  Checks panel uses. No virtualisation library.

## Requirements
- `lib/unplaced-query.ts` → rename to `lib/cargo-manifest-query.ts` (keep a re-export shim only if other imports
  make that cheaper), with `status`, `slot`, the `position` sort and the label. If it would pass 200 lines, split the
  project-cargo query into its own module.
- `CargoManifest.tsx`: kind + status switches; it renders `ContainerManifestList` (evolved from
  `UnplacedCargoList`) or `ProjectCargoManifestList` (evolved from `UnplacedProjectCargoList`).
- Row UI: unplaced = today's button (mousedown drag, click pick); placed = a button with the position column, where
  click = `cargoClickAction` via the guards.
- Scroll-into-view on `selectedId` change.

## Related code files
- Modify/rename: `lib/unplaced-query.ts` (+ its tests), `UnplacedCargoList.tsx` → `ContainerManifestList.tsx`,
  `UnplacedProjectCargoList.tsx` → `ProjectCargoManifestList.tsx`, `UnplacedListControls.tsx` (status control)
- Create: `CargoManifest.tsx`
- Tests: query — the status partition, the slot search, the position sort, the label, and `unplaced` identical to
  before

## Implementation steps
1. Query extension + tests (the existing tests are the regression guard).
2. Container list evolution + the status control; the placed-row click through the guards.
3. Project-cargo list evolution (placed rows, position text).
4. `CargoManifest` with the kind switch; scroll-into-view.
5. `npx tsc --noEmit` + suite.
6. Browser, both ships:
   - Unplaced: identical to phase 01;
   - Placed: 110 (BBC) rows with slot codes; sort by position;
   - search "2604" finds bay-26 boxes;
   - click a placed row → selected in 3D and the sheet; a second click picks it (or refuses with the lift reason);
   - clicking a box in 3D scrolls the manifest to it;
   - "All" on Demo Horizon (886 rows): measure the render, and apply the 200-row cap only if needed.

## Todo list
- [ ] Query: status, slot, position sort, label + tests
- [ ] Container manifest list + status control + placed-row click
- [ ] Project-cargo manifest list
- [ ] `CargoManifest` kind switch + scroll-into-view
- [ ] `npx tsc --noEmit` + suite green
- [ ] Browser checks + the 886-row measurement

## Success criteria
- Every box, placed or not, can be found, filtered, sorted and selected from one list, and the unplaced workflow is
  unchanged.

## Risk assessment
- **Rename churn:** keep the diff reviewable by renaming files in their own step, with no logic changes mixed in.
- **Click semantics on placed rows** must match 3D: the shared `cargoClickAction` guarantees it.

## Security considerations
None.

## Next steps
Phase 03.
