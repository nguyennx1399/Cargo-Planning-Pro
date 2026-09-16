# Manual click-through — drag-and-drop stowage placeholders (Phases A–C)

**Why this document exists.** This repo has no DOM test capability (vitest runs `environment: 'node'`; jsdom/testing-library are deliberately not installed), so every interaction below is **unverified** — the logic behind it is traced, measured and reviewed, but no human or test has ever run it. This script is the one remaining acceptance step for Phases A–C.

**Run it with:** `cd frontend && npm run dev` → http://localhost:5173

The app opens on **BBC SAO PAULO** with demo cargo loaded. The Unplaced section should read `Unplaced (20)` and hint: *"Click to pick a container, then click a slot in 3D or the bay plan. Or drag one onto the hull. Esc cancels."*

Mark each step pass/fail as you go. Steps marked **[H]** verify a specific defect fix and are the ones most likely to fail; the rest are spec acceptance.

---

## A. Spec acceptance — drag a 40' box onto BBC bay 22 on deck

1. Press and hold a 40' row in Unplaced; drag onto the hull. **Expect:** translucent green boxes appear on the deck slots that box may occupy, and the hint switches to "N valid positions for &lt;id&gt;."
2. Set Bay = 22 in the bay selector to isolate it; move over bay 22 on deck. **Expect:** a green ghost follows the cursor at a clean slot; the Container section reads "Slot 22xxxx — placing &lt;id&gt;" + "Clean drop — no rule is triggered."
3. Release. **Expect:** the box lands in that slot, Unplaced drops to 19, the 2D bay plan (bay 22) shows it, Checks re-runs.
4. `Cmd/Ctrl+Z`. **Expect:** the box returns to Unplaced and leaves the slot.
   *Record the resolved bay.* Within ~0.18 m of a bay boundary the pitch-sized pick box may resolve the neighbouring bay (documented, by design — the box is deliberately oversized to leave no dead zones). Aim ~0.3 m inboard of bay 22's centre and record what you see rather than treating it as a bug.
5. **20' box.** Press a row whose label ends `· 20'`. **Expect:** placeholders appear **only on odd (half) bay positions**, never centred in a 40' bay; hovering an even bay now yields no hover at all (a 40' position is not a legal half). An even-bay release commits nothing. *2D cannot do this at all — the bay plan addresses whole bays only.*
6. **REEFER.** Pick/press a `REEFER` row. **Expect:** placeholders sit only on the plug positions (BBC: bays 26/30/34, on-deck tiers 82/84) — measured as 2 reachable positions.

### Defect-specific checks in the drag path

7. **[H — red hover]** With a 40' row pressed or picked, hover an **empty but refused** slot. Use a deck slot with no box under it ("no container below"), or the bay-26 row-04 column ("Stack bay 26 row 04 (under deck): 67.4t > limit 60t"). **Expect:** no green placeholder there, the ghost turns **red**, and the Container section reads "Refused: &lt;first reason&gt;". Release there → the box is **not** placed, Unplaced is unchanged, and the section shows "Not placed — &lt;reason&gt;".
8. **[H1a — stale-hover click]** Hover a slot so the sidebar reads "Empty slot …", then click an unplaced row **once, without moving**, and release over the sidebar. **Expect:** the item is **picked** and **nothing is placed** (Unplaced count unchanged; no new box in 3D or 2D). Repeat this immediately after a successful 3D place, and again after Esc — those are the two moments the pick meshes remount and a stale slot could be committed.
9. **[H1b — off-canvas release]** Press a row and release over the sidebar. **Expect:** clean cancel — no placement, no stuck ghost, no "In hand" line. Then press, drag over the hull, and release over the **bay plan**. **Expect:** cancel; nothing lands.
10. **[H2 — sibling halves]** Pick a 20' box and click the **aft** half placeholder of one 40' bay (bay 22 is a good target). **Expect:** it lands in the half you clicked — check the resolved slot in the bay readout — not the fore half. Before the fix the camera side decided this, jumping ~6 m; the ghost should now step only ~0.076 m between sibling halves.

## B. WCAG 2.5.7 — one click to pick, one click to place, **no drag anywhere**

11. 3D: click an Unplaced row once without moving. **Expect:** it gains the picked outline; the row must **not** start a move. Container section: "In hand: &lt;id&gt; — click a highlighted slot in 3D or the bay plan, or drop it there. Esc cancels."
12. Move the cursor over the hull with no button pressed. **Expect:** placeholders + ghost appear. Click a placeholder. **Expect:** it is placed; Unplaced drops; the box appears in 3D and in the 2D plan.
13. Esc mid-pick. **Expect:** the pick clears (row un-highlights, hint reverts).
14. 2D: pick a 40' row, set Bay to a bay with outlined cells, click an outlined cell. **Expect:** "Placed." (or "Placed. Recorded, not blocked: …" for an overstow). Then pick again and click a **non-outlined** cell. **Expect:** "Not placed — &lt;reason&gt;" and the pick **stays alive** so you can click elsewhere. The reason wording should match the rule vocabulary in Checks.
15. Keyboard pick: Tab to a row, press Enter. **Expect:** it picks (the row is a real `<button>`).
16. **[M1 — hidden slots]** Untick "Under deck" and/or set Bay = 26, then hover an empty slot that is now hidden. **Expect:** no hover readout, no ghost, no placeholder. Clicking it in 2D is **refused** rather than silently placed.

## C. Selection and moves must not regress

17. Nothing in hand: click a placed container. **Expect:** yellow selection + its detail panel. Press and release on a container while jiggling 1–2 px. **Expect:** still a selection; nothing moves.
18. Press and drag past ~4 px. **Expect:** that instance disappears and the ghost follows the cursor (a MOVE); **the camera must not rotate**. Release over a valid slot → it moves; `Cmd/Ctrl+Z` restores it.

## D. Hover-to-inspect with nothing in hand

19. Fresh state: hover an empty deck slot → "Empty slot 220082", no ghost. Hover a placed container → its details. Move the cursor off the canvas to the sidebar → the "Empty slot …" line clears.

## E. Extras

20. **[M3/M6 — amber path]** On **MV Demo Horizon** (loaded plan — measured to have 5 overstow-warning slots), drag a box onto an overstow slot. **Expect:** the ghost is **amber** and the release produces "Placed. Recorded, not blocked — the checks below will list it: &lt;overstow message&gt;"; the Checks list contains that container. Start the next gesture → the line clears.
21. The old copy "Drop doesn't place it yet (E3-04c/d)" is gone. Esc/undo do not hijack typing in an input.

---

## Known limitations — do not report these as bugs

- **2D addresses whole bays only.** A 20' half-bay drop is 3D-only; the bay selector lists `vessel.bays` (even). Recorded for Phase D/E.
- **A drag cannot land on the 2D plan.** A `click` fires only on the nearest common ancestor of press and release, so a release over a cell whose press began on a list row never reaches that cell. Spec §7 asks for *click-to-place* in 2D, which works (steps 14–15).
- **BBC bay boundaries overlap ~0.18 m** by design — the oversized pick box is what buys zero dead zones. Do not "fix" the tiling.
- **The tooltip lives in the sidebar, not on the ghost** — a WebGL mesh carries no text. Tint and wording come from one verdict object, so they cannot disagree.

## Known gaps left unfixed (recorded, low impact)

- A rejected **3D** pick's reason is visible only while the pointer stays on the slot; there is no post-click confirmation. (The 2D path does show a notice.)
- After a 3D drag-**move**, the container mesh's `onClick` still fires, so it may select a different box than the one you moved. No data effect.
- `HIGHLIGHT.ghost` is now dead; `bayIndex`/`gotoBay` are duplicated between `Sidebar` and `ViewOptionsPanel`; the window `mouseup` ignores `e.button`, and a release **outside the browser window** leaves the gesture armed (no `pointercancel`/`blur` listener).
- `naiveFillPlan` still places 20' boxes nowhere, so the demo loads with 400 of 886 (demo vessel) unplaced on purpose — placing them by hand is the feature. Teaching the packer to fill half-bays is deliberately deferred.

## What to do with a failure

Note the step number and what you saw. Steps 7–10 **[H]** map to specific fixes and their reports carry the mechanism — a failure there is a fix regression, not a new mystery. Everything else is spec acceptance; a failure is a plan-level gap, and Phase D/E are the natural place to absorb it.
