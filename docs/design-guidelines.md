# Design Guidelines

## UI Layout

**Three-panel layout (grid):**

```
┌─────────────────────────────────────────────────────┐
│            Cargo Planner 3D (Header)                │
├──────────────────────┬────────────────────────────────┤
│                      │                                │
│  Sidebar             │      3D Viewer                 │
│  (320px)             │      (React Three Fiber)       │
│  Scrollable:         │                                │
│  - Plan info         │      - Canvas (full)           │
│  - Stability Panel   │      - Hull + Containers       │
│    (draft/trim/heel/ │      - Waterline reference     │
│    GM indicators)    │      - Orbit controls          │
│  - Legend            │      - Gizmo helper            │
│  - Violations        │                                │
│  - Loading Sequence  │      (Ship attitude/sinking    │
│    (Play/Pause/etc)  │       driven by visible cargo) │
│                      │                                │
├──────────────────────┴────────────────────────────────┤
│                   2D Bay Plan (SVG)                   │
│                   (200px height, stub)                │
└──────────────────────────────────────────────────────┘
```

**CSS Grid setup:**

```css
.layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  height: 100vh;
  gap: 0;
}

.stage {
  display: grid;
  grid-template-rows: 1fr 200px;
  grid-template-columns: 1fr 1fr;  /* 50/50 split: 3D + 2D bay plan */
}

.viewport {
  grid-column: 1 / 2;
  overflow: hidden;
  background: #DCE3E9;  /* Light gray for 3D background */
}

.bayplan {
  grid-column: 1 / 3;  /* Span both columns at bottom */
  border-top: 1px solid #e0e0e0;
  overflow-y: auto;
  background: #ffffff;
}
```

## Color System

**Palette (from lib/colors.ts, currently stub):**

| Use | Color | Hex |
|-----|-------|-----|
| Background (3D) | Light gray | #DCE3E9 |
| Background (UI) | White | #ffffff |
| Border | Light gray | #e0e0e0 |
| Text (primary) | Dark gray | #333333 |
| Text (secondary) | Medium gray | #666666 |
| Text (muted) | Light gray | #999999 |

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

**Violation highlighting (in sidebar):**

- **Error (hard constraint):** Red (#cc0000)
- **Warning (soft objective):** Orange (#ff9900)
- **Success (no violations):** Green (#00cc00)

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

**Sections:**
1. **Plan Info**
   - Vessel name, IMO
   - Voyage ID
   - Port rotation (compact)
   - Placements count: "Placed: 148/150 (98.7%)"

2. **Legend**
   - Color mode selector (radio buttons or tabs)
   - Color/symbol key (3 rows max)
   - "Show on-deck" / "Show under-deck" / "Show hull" toggles
   - "Filter by bay" input (or dropdown)

3. **Stability Panel** (**DEMO/Indicative Data Only**)
   - Live metrics: Draft (m), List (°), Trim (°), GM (m)
   - Status indicator: OK (green) | Warning (orange) | Critical (red) | Out of Range (gray)
   - Refreshes live as playback reveals cargo
   - "Exaggerate angles" toggle (1× real or 5× for visibility)
   - Warning: "DEMO DATA — Verify on approved loading computer"

4. **Violations Panel**
   - Sort by severity (errors first)
   - Scrollable list
   - Click violation → highlight container in 3D
   - Error count badge (red)
   - Warning count badge (orange)

5. **Loading Sequence Panel**
   - Playback controls: ▶ Play | ⏸ Pause | ⟲ Reset buttons
   - Scrub bar: Shows current container count (e.g., "45 / 150")
   - Speed slider: Containers per second (1–60, default 30)
   - Timeline: Visual progress bar
   - Auto-pauses when all containers revealed

6. **KPI Summary** (future)
   - Placed / Unplaced count
   - Overstow count
   - Stack weight margin %
   - Crane split balance

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
- Hover container → tooltip with ID, size, weight, POD (future)
- Right-click → context menu to move/swap (phase 2)

### 2D Bay Plan (SVG, Stub)

**Layout:**
- Horizontal strip at bottom
- Bay names (02, 04, 06…) as column headers
- Row labels (01L, 02L, 03L, 04L…) as row headers
- Slot boxes colored by mode (same as 3D)
- Sync selection with 3D: click slot → highlight in 3D

**Future enhancements (phase 1–2):**
- Drag-and-drop container move
- Zoom SVG for detailed view
- Print to PDF

## Responsive Design

**Breakpoints (future; currently static layout):**

| Breakpoint | Screen | Layout |
|-----------|--------|--------|
| Desktop | ≥1024px | Sidebar + 3D + 2D |
| Tablet | 768–1023px | Sidebar collapses to icon bar; 3D + 2D stack vertically |
| Mobile | <768px | Sidebar in drawer; full-height 3D or 2D switcher |

**Current (phase 1):** Desktop-optimized; responsive planned for phase 2+.

## Accessibility (A11y)

**Current (skeleton):** Basic.

**To do (phase 2+):**
- [ ] ARIA labels on interactive elements
- [ ] Keyboard navigation (Tab, Enter, Arrow keys)
- [ ] Color contrast ratios (WCAG AA minimum 4.5:1)
- [ ] Screen reader testing (NVDA, JAWS)
- [ ] Focus indicators visible (:focus-visible)
- [ ] Alt text for images/icons

## Animation & Interaction

**3D container selection:**
- Outline or color tint when selected
- Smooth transition (0.2s) to avoid jank
- Deselect by clicking empty space

**Sidebar transitions:**
- Slide open/close for future drawer mode (phase 2)
- Smooth fade for violations list

**Validation feedback:**
- Real-time (debounced 300ms) as user edits
- Violations update instantly once backend responds
- No loading spinner (assuming <100ms latency)

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
- React Query for server state (plan data cached)

**Bundle size:**
- Tree-shake unused Three.js modules
- Lazy-load heavy libraries (future)

## Open Design Questions

1. **Dark mode:** Include in phase 1 or defer?
2. **Responsive breakpoints:** Required for phase 1 or phase 2+?
3. **Icon library:** Emoji, Heroicons, or custom SVGs?
4. **Accessibility level:** WCAG A, AA, or AAA target?
5. **Drag-and-drop:** Phase 1 (keyboard-only) or phase 2 (mouse support)?
