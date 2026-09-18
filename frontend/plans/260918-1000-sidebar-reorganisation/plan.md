# Sidebar reorganisation — tabs by task

## Why (measured 2026-09-18, BBC SAO PAULO, 1440 × 900 viewport)

The sidebar is **5 004 px tall — 5.6 screens**.

| Section | Height | Note |
|---|---|---|
| Checks | **2 285 px** | 46% of the sidebar — and it is only the FIRST 50 violations (see below) |
| Unplaced containers | 553 px | used constantly while planning |
| Project cargo | 473 px | mostly the custom-cargo form, always expanded |
| Unplaced project cargo | 383 px | used constantly |
| Color by · Show · Loading sequence · Stability · Cargo · header | 109–216 px each | set occasionally |
| Container inspector | 70 px | the live drop readout — sits ~1 400 px down, off-screen during a drag |

The deeper problem is ORDER, not length: what is used while placing (unplaced lists, inspector) sits
below four panels that are set once per session.

**A defect found while measuring:** `Sidebar.tsx` renders `report.violations.slice(0, 50)`. On the demo
plan that is 50 of 199 overstows — **149 are never shown, and nothing on screen says so**.

## Decisions taken (user, 2026-09-18)

1. **Tabs by task: Load · View · Check.**
2. **Checks grouped by rule, with counts**, each rule expandable to its items.
3. **The custom-cargo form sits behind a "+ Add project cargo" button.**

## Target layout

```
┌───────────────────────────────┐
│ BBC SAO PAULO · voyage · vessel ▾ │  ← always visible
│ 110/110 placed · 199 ⚠ · 0 ✖      │  ← status strip, always visible (new)
├──────┬──────┬───────────────────┤
│ Load │ View │ Check             │
├──────┴──────┴───────────────────┤
│ LOAD:  cargo toggles · inspector ·│
│        unplaced containers ·      │
│        project cargo (+ add) ·    │
│        unplaced project cargo     │
│ VIEW:  colour by · show toggles · │
│        bay · reset · stowage box ·│
│        free space                 │
│ CHECK: checks (grouped) ·         │
│        stability · loading seq.   │
├───────────────────────────────────┤
│ Planning aid only. Verify …       │  ← disclaimer, always visible
└───────────────────────────────────┘
```

## Phases

| # | Phase | Status | Priority |
|---|-------|--------|----------|
| 01 | [Tabs shell, status strip, section moves](phase-01-tabs-shell-and-status-strip.md) | done | high |
| 02 | [Checks grouped by rule](phase-02-checks-grouped-by-rule.md) | done | high |
| 03 | [Custom-cargo form behind a button](phase-03-custom-cargo-form-behind-button.md) | done | medium |

01 is the structure; 02 and 03 each shrink one section and are independent of each other. 02 also
fixes the silent 50-item cap, which is a correctness issue in its own right.

## Ground rules

- **Move, don't rewrite.** Every panel keeps its own component and behaviour; this plan changes WHERE
  they render, not what they do.
- **Anything safety- or error-related stays visible on every tab**: the disclaimer and a one-line
  status (placed / warnings / errors). Putting Checks on its own tab must not make a new error invisible
  while the planner is on Load.
- **The global hooks stay at the Sidebar root**, outside the tabs (see phase 01): unmounting them with a
  tab would silently break drop-release and every keyboard shortcut.
- Files under 200 LOC; `Sidebar.tsx` should get SHORTER, since sections move into tab bodies.
