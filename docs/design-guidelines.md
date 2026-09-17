# Design Guidelines

## UI Layout

**Three-panel layout (grid):**

```
┌─────────────────────────────────────────────────────┐
│            Cargo Planner 3D (Header)                  │
├──────────────────────┬────────────────────────────────┤
│                      │                                │
│  Sidebar             │      3D Viewer                 │
│  (300px)             │      (React Three Fiber)       │
│  Scrollable:         │                                │
│  - Cargo             │      - Canvas (full)           │
│  - Project cargo     │      - Hull + Containers       │
│  - Stability         │      - Waterline reference     │
│    (draft/trim/heel/ │      - Orbit controls          │
│    GM indicators)    │      - Gizmo helper            │
│  - Color by / Show   │      - Slot placeholders       │
│  - Container         │        + drop ghost + at-      │
│  - Unplaced          │        cursor verdict chip     │
│  - Loading sequence  │                                │
│  - Checks            │      (Ship attitude/sinking    │
│                      │       driven by visible cargo) │
│                      │                                │
├──────────────────────┴────────────────────────────────┤
│                2D Bay Plan (CSS grid)                 │
│          (bay cross-section, 35% of the stage)        │
└──────────────────────────────────────────────────────┘
```

**CSS Grid setup** (as in `styles.css`):

```css
.layout {
  position: relative;
  display: grid;
  grid-template-columns: 300px 1fr;  /* sidebar + stage */
  height: 100%;
}

.stage {
  display: grid;
  grid-template-rows: minmax(220px, 65%) minmax(160px, 35%);  /* 3D over bay plan */
  min-width: 0;
  min-height: 0;
}

.viewport { position: relative; min-height: 0; background: var(--stage); }

.bayplan {
  border-top: 1px solid var(--line);
  background: #fff;
  padding: 10px 14px;
  min-height: 0;
}
```

## Color System

**Palette (app tokens, `styles.css`):**

| Use | Token | Hex |
|-----|-------|-----|
| Background (3D stage) | `--stage` | #DCE3E9 |
| Panel background | `--panel` | #F4F6F8 |
| Border | `--line` | #CBD4DB |
| Text (primary) | `--ink` | #1D2B36 |
| Text (muted) | `--ink-soft` | #5E6E7B |
| OK / clean | `--ok` | #2E7D5B |
| Signal / accepted-with-warnings | `--signal` | #E0A030 |
| Error / refused | `--error` | #B83A2E |

The same hexes are mirrored in `lib/colors.ts` as `HIGHLIGHT.valid|warning|invalid` (alongside
`HIGHLIGHT.hover|selected`) so the canvas and the panels agree. `DROP_TINT` — the map from a slot
verdict to one of those three — lives in `lib/drop-verdict.ts`, not in `colors.ts`. `colors.ts` exports
only `podColorMap`, `containerColor` and `HIGHLIGHT`.

**Color modes (container coloring)** — the three that exist (`ColorMode = "pod" | "weight" | "type"`), all in `lib/colors.ts`:

1. **POD (Port of Discharge)** — Color by destination port
   - Fixed 6-colour palette, assigned in port-rotation order (`sequence`), wrapping past 6 ports
   - A colourblind-safe palette (Okabe & Ito 2008) is selectable (`paletteMode`) because the default red-orange vs green pair is a red-green confusion risk
   - Planners see discharge order at a glance

2. **Weight** — One continuous ramp, `hsl(210, 35%, L%)` with L from 82% (light) down to 32% (dark), clamped at 0–30 t
   - Light = low tonnage, dark = heavy
   - Planners see weight distribution for balance

3. **Type** — Flat colour per type, with IMDG overriding
   - Dry (standard) `#9AA5B1` · Reefer `#3A86C8` · OPEN_TOP `#B08D57` · FLAT_RACK `#8C6E54` · TANK `#6C8E5B`
   - Any container with an `imdg_class` renders `#D64545` regardless of type
   - Not yet built: a reefer "plug indicator" and a purple OOG outline (OOG is not represented in the viewer at all)

**Violation highlighting (in sidebar "Checks"):**

- **Error (hard constraint):** destructive Alert variant (red family) — clickable, selects the container in 3D
- **Warning (soft objective):** warning Alert variant (amber family)
- **No violations:** plain ok text (green)
- A drop that "records" an overridable limit is a warning and shows up in this same list — the amber tint at drop time is a promise this list keeps

## Typography

**Font stack (inherited from browser/OS):**

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
```

**Sizes:**

| Element | Size | Weight | Use |
|---------|------|--------|-----|
| Page title | 24px | 700 | App header (future) |
| Section heading | 18px | 600 | Panel titles (Plan Info, Legend) |
| Body text | 14px | 400 | Default text |
| Small text | 12px | 400 | Labels, hints, timestamps |
| Code/monospace | 12px | 400 | Slot codes, container IDs |

## Component Specs

### Sidebar

**Width:** 300px (fixed on left — `grid-template-columns: 300px 1fr` in `styles.css`)

**Sections** (in rendered order):

1. **Header** — vessel name, voyage id, and (when the app offers more than one vessel) the vessel selector. A vessel switch resets the draft and the gesture state.

2. **Cargo**
   - "Load demo cargo" / "Clear cargo (show empty hull)" toggle
   - Hint text that names the editor gesture ("drag any unplaced box onto a slot below, or clear the cargo to place them yourself")

3. **Project cargo**
   - "Load project cargo" / "Clear project cargo" (demo items, reference dimensions)

4. **Loading sequence**
   - Playback controls: ▶ Play | ⏸ Pause | ⟲ Reset buttons
   - Scrub bar: current container count (e.g., "45 / 150"); speed slider (1–60/s, default 30)
   - Auto-pauses at the end; a drag start also pauses playback (resuming stays explicit)

5. **Color by**
   - Color mode (POD / weight / type)
   - Palette selector (default / colorblind-safe) when colouring by POD
   - POD legend: one row per port (which is also the port rotation, in sequence order)

6. **Show**
   - "Show hull" / "Show on-deck" / "Show under-deck" toggles
   - Bay selector (or arrow-key bay navigation)

7. **Stability (indicative)** (**DEMO/Indicative Data Only**)
   - Live metrics: Draft (m), List (°), Trim (°), GM (m)
   - Status indicator: OK (green) | Warning (orange) | Critical (red) | Out of Range (gray)
   - Refreshes live as playback reveals cargo
   - "Exaggerate angles" toggle (1× real or 5× for visibility)
   - Warning: "DEMO DATA — Verify on approved loading computer"

8. **Container**
   - The selected or hovered box; while a container is in hand, what a drop on the hovered slot would do
   - Wording matches the drop tint: clean drop / "recorded, not blocked" (a warning the plan-wide report will also list) / refused, with the rule's reason

9. **Unplaced (n)**
   - The drag source AND the single-pointer entry point: mousedown drags, click (or Enter/Space on the focused row) picks
   - Lists what the current plan has not placed
   - **Bulk retrieval (P2)** — the section carries a control bar above the list, all of it driven by the
     pure `lib/unplaced-query.ts` + the presentation-only `UnplacedListControls.tsx`:
     | Control | Values | Notes |
     |---|---|---|
     | Search | free text | matches container id; the app's first text input |
     | Size | any / 20' / 40' / 45' | |
     | Type | any / DRY / REEFER / OPEN_TOP / FLAT_RACK / TANK | |
     | Sort | cargo order / POD rotation / weight heavy-first / id | |
     | Group | none / POD / type / size | collapsible headers, per-group count on the right, `aria-expanded` |
     | "Fits bay NN" | on/off | see below |
   - **"Fits bay NN" is a rendering-only filter** (decision D6). It hides rows whose *size and parity*
     cannot take a position in the bay the Show section selected, and it is worded that way: its
     tooltip reads `BAY_CAVEAT` = "Size and parity only — the slot still has to pass every check."
     Each row also carries a per-row `fits NN` badge. It **never** gates a drop —
     `commitPlacement → canPlaceContainer` remains the only gate, so the filter can only change what is
     listed, not what may be placed. The exact-predicate variant was measured at ≈11.2k
     `canPlaceContainer` calls ≈ 39 ms per recompute and rejected.
   - The header reads `Unplaced (n)` when nothing is filtered and `Unplaced (n of N)` when something
     is; an empty result renders "No container matches." with a **Clear filters** action rather than an
     empty box. `DEFAULT_UNPLACED_QUERY` reproduces the pre-P2 rendering exactly, so BBC still reads
     `Unplaced (20)`.
   - Keyboard: ArrowUp/Down walk the *rendered* rows, Home/End jump to the ends, and a group header
     participates (ArrowDown enters its first row). The list window is 320 px tall (was 140 px) —
     MV Demo Horizon holds 400 unplaced rows, and roughly twice as many chips are visible at once.
   - **Status:** implemented 2026-09-16, unit-tested, **committed 2026-09-17 as `b61234a` and manually
     exercised in-browser**. The full click-through — steps 22–34 of the manual acceptance — is still
     outstanding (no DOM test environment).

10. **Checks**
   - KPI row: Placed / Not placed / Overstows / Rule errors
   - Violation list styled by severity (capped at 50 shown); click one → highlight that container in 3D
   - Re-runs on every edit — a drop that "records" an overridable limit shows up here

Footer: "Planning aid only. Verify stability on the approved loading computer."

### 3D Viewer (Canvas)

**Camera:**
- Default FOV: 40°
- Initial position: [90, 55, 90] (diagonal corner view)
- Near plane: 0.5, far plane: 2000

**Lighting:**
- Ambient: Hemisphere light (white #fff, gray #8a9aa8, intensity 0.9)
- Directional: [60, 120, 40] intensity 1.2 (sun-like shadows)
- Result: Realistic shading without harsh shadows

**Controls:**
- OrbitControls (default, allows rotation + zoom)
- Middle-click drag to rotate, scroll to zoom
- Double-click to focus
- Keyboard shortcuts (future): numeric keypad for quick views

**Interaction:**
- Click container → select (highlight in sidebar)
- Press a container and drag past a small threshold → MOVE it (the camera must not rotate); release over a valid slot
- Hover container → tooltip with ID, size, weight, POD (future)
- Drag a row in the Unplaced list (or click it once to PICK it — the single-pointer path) → translucent boxes mark every valid slot and a ghost follows the cursor
- Drop tint is one verdict (`lib/drop-verdict.ts`): **green** = clean, **amber** = accepted but recorded (the checks list will show it), **red** = refused (release places nothing)
- **The wording is `lib/drop-feedback.ts`** (P1/D4) — one function per sentence, rendered by the at-cursor chip, the Container inspector and the 2D bay-plan notice alike, so no two surfaces can disagree about the same result. A clean drop says nothing at all; a recorded one reads "Placed. Recorded, not blocked — the checks below will list it: `<reason>`" in amber; a refusal reads "Not placed — `<reason>`" in red. A refused PICK stays armed; a refused DRAG is cleared.
- The outcome of the last committed drop is kept in `usePlanStore.dropOutcome` (P1/D5, written only by `commit-placement.ts`), so the message survives the pointer leaving the slot, and clears on the next gesture or on `setHoveredSlot` going stale
- Pointer affordances (`use-drop-cursor.ts`, truth table first-match-wins): open hand (`cursor-grab`) over a placed container with nothing in hand — what makes the ≤4 px select / >4 px move threshold discoverable *before* the gesture; closed hand (`cursor-grabbing`) while dragging; `cursor-pointer` over a slot a release would land on; `cursor-not-allowed` over a refused slot; `cursor-crosshair` over water/hull with a box in hand. A 2 px ring (`viewport-armed`) rides the viewport edge while a box is in hand
- Esc cancels a drag or pick; Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z (or Ctrl+Y) redo
- Right-click is reserved for OrbitControls' pan — the move/swap context menu is deferred to Phase D

### 2D Bay Plan (CSS grid)

**Layout:**
- Horizontal strip at bottom, showing a cross-section of ONE bay (chosen in the bay selector)
- Bay names (02, 04, 06…) as column headers
- Row labels (01L, 02L, 03L, 04L…) as row headers
- Slot cells colored by mode (same as 3D); hatch line between decks; weight-by-row bars
- Sync selection with 3D: click a cell → select in 3D; while an item is in hand, the cells it may go in are outlined and clicking one places it

**Future enhancements (phase 1–2):**
- Half-bay (20') drop targets — the 2D plan addresses whole bays only today
- Drag a container onto the plan directly (a drag release cannot reach a 2D cell; click-to-place is the supported path)
- Zoom for detailed view; Print to PDF

## Responsive Design

**Breakpoints (future; currently static layout):**

| Breakpoint | Screen | Layout |
|-----------|--------|--------|
| Desktop | ≥1024px | Sidebar + 3D + 2D |
| Tablet | 768–1023px | Sidebar collapses to icon bar; 3D + 2D stack vertically |
| Mobile | <768px | Sidebar in drawer; full-height 3D or 2D switcher |

**Current (phase 1):** Desktop-optimized; responsive planned for phase 2+.

## Accessibility (A11y)

**Current (better than "basic" in the editor)** — the editor's WCAG 2.5.7 single-pointer path (click to pick, then click a target — no drag gesture) and the Esc / undo / redo keys. Unplaced rows are real `<button>`s, so Tab + Enter/Space picks. The P2 list adds real ArrowUp/Down/Home/End roving focus over the rendered rows, `aria-expanded` on group headers and `aria-pressed` on a picked row.

**Load-bearing keyboard guard:** `panels/use-stowage-keyboard-shortcuts.ts` returns early when the event target is an `INPUT` or `TEXTAREA`. Without it the P2 search box would hijack the global keys — **Esc in the box would cancel an armed pick** and ArrowLeft/ArrowRight would page the bay filter while the caret moved. Any new text input inherits this protection for free; any new global key handler must respect it.

**Status note:** every interaction listed above is **unit-tested only.** No DOM test environment exists (`environment: 'node'`; jsdom/testing-library deliberately not installed), so none of it has been machine-verified in a browser. The manual click-through script (`plans/reports/manual-click-through-260916-phase-c.md`, steps 22–34) is outstanding for the P1/P2 work.

**To do (phase 2+):**
- [ ] ARIA labels on interactive elements broadly (the editor's Unplaced rows, group headers and picked state are covered; the rest is not)
- [x] Full keyboard navigation for the Unplaced list (Tab, Enter/Space, ArrowUp/Down/Home/End)
- [ ] Keyboard navigation for the 3D/bay-plan surface — arrow-key nudging of a placement is not implemented
- [ ] Color contrast ratios (WCAG AA minimum 4.5:1)
- [ ] Screen reader testing (NVDA, JAWS)
- [x] Focus indicators visible (:focus-visible, 2 px `--signal` outline in `styles.css`)
- [ ] Alt text for images/icons

## Animation & Interaction

**3D container selection:**
- Outline or color tint when selected
- Smooth transition (0.2s) to avoid jank
- Deselect by clicking empty space

**Drop feedback (Phases A–C committed 2026-09-16; P1 additions committed 2026-09-17 as `b61234a`, browser-exercised):**
- Translucent placeholders on every valid slot while a container is in hand (one InstancedMesh, `raycast={() => null}`)
- Ghost follows the cursor, tinted green (clean) / amber (accepted, recorded) / red (refused)
- Tint and reason text come from a single verdict object, so they can never disagree
- **P1:** an at-cursor verdict chip (`DropVerdictChip.tsx`) shows the same sentence next to the pointer — headline "Slot `<code>` — placing `<id>`", detail the verdict. It is `aria-hidden` on purpose: the accessible copy stays in the Container inspector, so pointer movement cannot flood an `aria-live` region
- **P1:** the committed outcome stays on screen after the drop (`dropOutcome`), so "Placed / Not placed" is still readable once the pointer has left the slot; a 2D bay-plan drop renders its notice in the panel instead of at the cursor
- **P1:** the `.viewport` cursor itself carries the affordance (`use-drop-cursor.ts`), plus a 2 px ring (`viewport-armed`) while a box is in hand

**Sidebar transitions:**
- Slide open/close for future drawer mode (phase 2)
- Smooth fade for violations list

**Validation feedback:**
- Synchronous as the draft changes — the plan-wide checks re-run on the new plan object (no debounce, no network round trip)
- A rejected drop changes nothing and returns its reasons for the sidebar to show

## Dark Mode (Future, Phase 2+)

**Planned color adjustments:**

| Light | Dark |
|-------|------|
| #ffffff (bg) | #1a1a1a |
| #333333 (text) | #e0e0e0 |
| #DCE3E9 (3D bg) | #2a2a2a |
| #e0e0e0 (border) | #444444 |

**Toggle:** Zustand store `colorMode` (currently: pod | weight | type). Future: add `"light"` | `"dark"` theme mode.

## CSS Organization

**Structure (frontend/src/styles.css):**

```css
/* Reset & base */
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: ...; font-size: 14px; line-height: 1.5; color: #333; }

/* Layout */
.layout { display: grid; grid-template-columns: 300px 1fr; height: 100vh; }
.sidebar { overflow-y: auto; border-right: 1px solid #e0e0e0; background: #f9f9f9; }
.stage { display: grid; grid-template-rows: 1fr 200px; grid-template-columns: 1fr 1fr; }
.viewport { overflow: hidden; background: #DCE3E9; }
.bayplan { border-top: 1px solid #e0e0e0; overflow-y: auto; }

/* Sidebar sections */
.sidebar-section { padding: 16px; border-bottom: 1px solid #e0e0e0; }
.sidebar-section h3 { margin-bottom: 12px; font-size: 14px; font-weight: 600; }

/* Violations */
.violation { padding: 8px; margin-bottom: 8px; border-left: 4px solid; border-radius: 2px; }
.violation.error { border-color: #cc0000; background: #ffe6e6; }
.violation.warning { border-color: #ff9900; background: #ffe6cc; }

/* Controls */
button { padding: 8px 16px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; }
button:hover { background: #f0f0f0; }
input { padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; }

/* State messages */
.state { display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; }
.state p { margin: 8px; }
.state code { font-family: monospace; background: #f0f0f0; padding: 2px 6px; border-radius: 2px; }
.muted { color: #999; }
```

## Icon System (Future)

**Planned icons (phase 2+):**

| Icon | Use | Library |
|------|-----|---------|
| ⚠️ | Warning | Unicode emoji |
| ❌ | Error | Unicode emoji |
| ✅ | Success | Unicode emoji |
| 👁️ | Visibility toggle | Unicode emoji |
| 🔄 | Refresh/retry | Unicode emoji |
| ⚙️ | Settings | Unicode emoji |

Or: Use Heroicons or Feather icon library for consistency.

## Print Styles (Future, Phase 2+)

```css
@media print {
  .viewport { page-break-inside: avoid; }
  .sidebar { display: none; }
  .bayplan { page-break-after: always; }
}
```

## Performance Considerations

**Rendering:**
- Use CSS Grid/Flexbox (fast layouts)
- Avoid CSS animations on containers (use transform instead)
- InstancedMesh in 3D (one draw call for every container, all sizes in the same mesh)

**State:**
- Zustand selectors for granular updates (avoid full re-renders)
- Two stores: view state (`usePlanStore`) and the editable plan (`usePlanDraftStore`)
- Plan data is not fetched: the demo plan is built in the frontend and loaded into the draft store (no React Query query for it)

**Bundle size:**
- Tree-shake unused Three.js modules
- Lazy-load heavy libraries (future)

## Open Design Questions

1. **Dark mode:** Include in phase 1 or defer?
2. **Responsive breakpoints:** Required for phase 1 or phase 2+?
3. **Icon library:** Emoji, Heroicons, or custom SVGs?
4. **Accessibility level:** WCAG A, AA, or AAA target?
5. **Drag-and-drop:** Resolved — mouse drag AND a single-pointer click-to-pick path (WCAG 2.5.7) both ship in the Phase 2 editor, sharing one commit resolver. Keyboard-only reordering (arrow-key nudging) is not implemented.
6. **Drop wordings:** Resolved — `lib/drop-feedback.ts` is the single source (`lib/drop-verdict.ts` keeps the tint only). The at-cursor chip is deliberately `aria-hidden`; whether a future DOM test environment should assert the chip's text or the inspector's is open.
7. **"Fits bay NN" strength:** Resolved as a rendering-only size/parity filter (D6). The exact-predicate variant stays a recorded follow-up with its measurement (≈39 ms per recompute at ≈11.2k `canPlaceContainer` calls).
8. **Should the frontend call the API?** Open and consequential — the app is entirely client-side today, so the backend's validator, greedy solver and 5 endpoints have no consumer. Wiring them (or deleting them) is not yet scheduled.
