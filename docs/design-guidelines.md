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
│  - Container         │        + drop ghost            │
│  - Unplaced          │                                │
│  - Loading sequence  │      (Ship attitude/sinking    │
│  - Checks            │       driven by visible cargo) │
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

The same hexes are mirrored in `lib/colors.ts` (`HIGHLIGHT.valid|warning|invalid`, `DROP_TINT`) so the canvas and the panels agree.

**Color modes (container coloring):**

1. **POD (Port of Discharge)** — Color by destination port
   - Unique hue per port
   - Planners see discharge order at a glance
   - Example: Singapore = blue, Colombo = green, Port Klang = orange

2. **Weight** — Gradient from light to dark
   - Light = empty (4–8 tonnes)
   - Dark = heavy (25–30 tonnes)
   - Planners see weight distribution for balance

3. **Type** — Symbol/color by container type
   - Dry (standard) = blue
   - Reefer = cyan (with plug indicator)
   - OPEN_TOP = yellow
   - IMDG = red
   - OOG = purple outline

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

**Width:** 320px (fixed on left)

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
- Drop tint is one verdict (`lib/drop-verdict.ts`): **green** = clean, **amber** = accepted but recorded (the checks list will show it), **red** = refused (release places nothing). Wording lives in the sidebar, not on the mesh
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

**Current (skeleton): Basic** — plus the editor's WCAG 2.5.7 single-pointer path (click to pick, then click a target — no drag gesture) and the Esc / undo / redo keys. Unplaced rows are real `<button>`s, so Tab + Enter/Space picks.

**To do (phase 2+):**
- [ ] ARIA labels on interactive elements
- [ ] Full keyboard navigation (Tab, Enter, Arrow keys) — arrow-key nudging of a placement is not implemented
- [ ] Color contrast ratios (WCAG AA minimum 4.5:1)
- [ ] Screen reader testing (NVDA, JAWS)
- [ ] Focus indicators visible (:focus-visible)
- [ ] Alt text for images/icons

## Animation & Interaction

**3D container selection:**
- Outline or color tint when selected
- Smooth transition (0.2s) to avoid jank
- Deselect by clicking empty space

**Drop feedback (shipped):**
- Translucent placeholders on every valid slot while a container is in hand (one InstancedMesh)
- Ghost follows the cursor, tinted green (clean) / amber (accepted, recorded) / red (refused)
- Tint and reason text come from a single verdict object, so they can never disagree

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
.layout { display: grid; grid-template-columns: 320px 1fr; height: 100vh; }
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
- InstancedMesh in 3D (one draw call per size)

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
