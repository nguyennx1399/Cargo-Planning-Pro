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
   *Corrected 2026-09-16 (P1):* the worst case is **0.402 m total / 0.201 m per side** at BBC's **minimum** pitch (12.99 m), not "~0.18 m" — that figure was the same quantity per side at the **mean** pitch (13.0388 m). And the overlap no longer decides anything: the resolved slot is now the one whose centre is nearest the pointer, i.e. the split sits at the **midpoint of the two bay centres** rather than on the box surface the ray enters first. See step 22.
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
    *Updated 2026-09-16 (P1):* the recorded case now reads exactly **"Placed. Recorded, not blocked — the checks below will list it: &lt;reason&gt;"** (em dash, and it names the Checks list), and it is **amber, never green** — the same sentence the Sidebar's Container section and the at-cursor chip show, from one function per wording (`lib/drop-feedback.ts`). A **clean** drop shows no notice at all (the cell simply fills); a bare "Placed." was never a real message. Every 2D notice now names the origin, so this panel renders it in place while the chip renders only 3D (scene) outcomes.
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

## F. Pointer feedback, precision and affordances (P1, added 2026-09-16)

Same run, same app (`cd frontend && npm run dev`). These steps cover the follow-up phase P1
(`plans/260916-2117-optimize-drag-drop-ux/phase-01-pointer-feedback-and-precision.md`): the
at-cursor verdict chip, pointer-driven slot resolution, the cursor/armed affordances and the
release-path hardening. Everything here is **human-observed only** — there is still no DOM test
capability, so the pure parts (the resolution rule, the wordings, the outcome lifetime) are swept in
`lib/__tests__/nearest-slot.test.ts`, `lib/__tests__/drop-feedback.test.ts` and
`store/__tests__/drop-outcome.test.ts`, and the plumbing these steps exercise is what those cannot see.

22. **Boundary resolution (BBC, 40').** Drag or pick a 40' box, set Bay = 22, and hover ~0.10 m inboard
    (toward the bay's own centre) of the **22/26** boundary. *Corrected 2026-09-16: BBC's bays are
    2/6/10/…/34, so bay 22's neighbour is 26 — the phase file's "22/24 boundary" names a bay this
    vessel does not have. At this pair the pitch is 13.010 m, so the pick boxes overlap 0.382 m
    (0.191 m per side); the fleet's worst case is 0.402 m at the 12.99 m pitches (6/10, 14/18, 30/34),
    and "~0.18 m" was the mean-pitch per-side figure — see the corrected note under step 4.*
    **Expect:** the chip and the Sidebar both name bay **22**, and the ghost sits on bay 22's slot. The
    resolution split is now the **midpoint of the two bay centres** (0.409 m outboard of the visible
    cell edge here), so it follows the pointer rather than the camera. Step 4's own observation still
    stands and is now the *only* boundary note needed.
23. **At-cursor reason.** Hover an **empty but refused** slot (bay-26 row-04 column, "67.4t > limit
    60t"). **Expect:** a chip appears beside the cursor whose first line reads `Slot 2604xx — placing
    <id>` and whose second line reads `Refused: <the stack-weight message>` in **red** (a 3 px red left
    border), the ghost turns red, and the planner never has to look at the sidebar. Then hover a
    **valid** slot. **Expect:** the second line reads "Clean drop — no rule is triggered." in
    green/neutral.
24. **Post-click confirmation (M2).** Pick a 20' row, then click a **refused** placeholder.
    **Expect:** the chip reads `Not placed — <reason>` in red and the pick stays armed (the row is still
    outlined, another slot can be clicked). Move the cursor to a different slot.
    **Expect:** the "Not placed" message clears and the new slot's verdict takes over (M6 — no stale
    line anywhere, and it does NOT clear merely by moving off the canvas).
25. **Recorded-not-fatal (M3).** On MV Demo Horizon, drop onto an overstow slot.
    **Expect:** the chip reads `Placed. Recorded, not blocked — the checks below will list it: …` in
    **amber**, never in red, and the identical sentence appears in the Sidebar — and, for a 2D cell
    click, inside the bay-plan panel.
26. **Cursor affordances.** Nothing in hand: hover a placed container → the cursor becomes a grabbing
    hand; press and drag past ~4 px → it becomes a closed hand and the camera does not rotate. With a
    box picked: over a valid or amber slot the cursor is a pointer hand; over a refused slot it is the
    "not-allowed" cursor; over the water/hull (no slot) it is a crosshair. Releasing the box restores
    the neutral cursor.
27. **Armed ring.** Pick a container: a 2 px green ring appears inside the viewport edge while the pick
    is armed, and disappears on Esc, on a successful place, and on a vessel switch.
28. **Release robustness.** Start a drag and release with the **right** button → clean cancel, nothing
    placed. Start a drag, then switch away from the browser window and back (or press Esc) → no stuck
    ghost, no "In hand" line. Start a drag and release over the sidebar → clean cancel (unchanged from
    step 9).

---

## G. Bulk retrieval over the 400-row Unplaced list (P2, added 2026-09-16)

Same run, same app. These steps cover phase P2
(`plans/260916-2117-optimize-drag-drop-ux/phase-02-unplaced-list-bulk-index.md`): search, size/type
filters, the "Fits bay NN" claim, sort, grouping and arrow-key navigation over the Unplaced list —
which on **MV Demo Horizon** holds **400 rows** (the packer deliberately places no 20' box) inside
what used to be a 140 px window. The list logic is pure and swept by
`lib/__tests__/unplaced-query.test.ts` and `lib/__tests__/unplaced-query-bay-fit.test.ts` (row counts,
ordering, grouping partition, the header strings, the arrow-key arithmetic and the anti-divergence
property); what those cannot see is the wiring these six steps exercise.

29. **Baseline is unchanged.** Open MV Demo Horizon with demo cargo. **Expect:** the Unplaced section
    reads exactly `Unplaced (400)`, the hint line is the same sentence as before, and no row is
    hidden or reordered. The list is noticeably taller (320 px, was 140 px) and still scrolls, so
    roughly twice as many chips are visible at once. Rows still respond to a click (pick, step 11)
    and to press-and-drag (step 1). Then type `SGSIN` in the search box: **Expect** the header becomes
    `Unplaced (n of 400)` with `n` well under 400 and only SGSIN rows left; clear the box → back to
    exactly `Unplaced (400)`. *(Script step 1's string is asserted by a unit test, so a failure here
    is a wiring bug, not a wording change.)*
30. **Filters, sort, grouping.** Set Size = `20'` → only 20' rows (all of them, on the demo).
    Set Type = `REEFER` → the intersection (fewer rows than either filter alone). Group = `Group by
    POD` → collapsible headers appear with a per-group count on the right; clicking a header removes
    that group's rows and flips `aria-expanded`, clicking again restores them; the counts sum to the
    header's `shown`. Set Group = `No grouping`, Sort = `Weight, heavy first` → rows run heaviest
    first. **Clear** → 400 rows in the original plan order and `Unplaced (400)` again.
31. **"Fits this bay".** Set Bay = 22 (Show section). **Expect:** every row already carries a green
    `fits 22` badge (the badge states the size/parity claim per row, so it follows the *selected* bay,
    ticked or not) whose tooltip reads *"Size and parity only — the slot still has to pass every
    check."* Now tick `Fits bay 22`. **Expect: the list does not shrink — every row survives**, which is
    the truthful size/parity answer, not a no-op: bay 22 holds its own 40' cell **and** the 20' halves
    21/23, so both sizes fit, while the naive reading (*a slot is in bay 22 iff `slot.bay === 22`*)
    would have hidden all 400 of these 20' boxes. Untick → nothing else changes (the badges stay; they
    are per row). Change the bay to 26 with the tick still on. **Expect:** the checkbox stays ticked and
    is relabelled `Fits bay 26`, so the narrowed list is never silent; Clear (or unticking) restores
    everything. Now pick a container and check the 3D placeholders and the 2D outlined cells: they must
    still show exactly the slots that pass **every** check — the filter changed what is listed, never
    what may be placed. *(The `no fit` badge variant is unreachable on both demo vessels for the same
    reason, so it is covered only by the synthetic unit case; if rows disappear at this step, the
    filter is wrongly reading `slot.bay` instead of `slotInBay`.)*
32. **Typing is not hijacked.** Focus the search box and type `20`. **Expect:** the text appears and
    the row set narrows. Press ArrowLeft/ArrowRight with the caret in the box → **the bay filter must
    not change** (the bay readout stays where it was) and the caret moves. Press Esc in the box →
    **an armed pick is NOT cancelled** (the row stays outlined) and no placement happens; a browser
    that clears a `type="search"` field on Esc will also empty the box — either is fine, the pick
    surviving is the assertion. Now click outside the box (e.g. on the canvas) and press
    ArrowLeft/ArrowRight → the bay filter changes as before (regression check for step 2's navigation).
33. **Arrow-key navigation.** Click the first row, then press ArrowDown repeatedly. **Expect:** focus
    walks the rendered rows in order, each row gaining the focus ring, and the scroller follows — it
    does not scroll separately by a second amount. ArrowUp walks back; Home jumps to the first row and
    End to the last. Press Enter on a focused row → it is picked exactly as a click would be
    (`aria-pressed` flips, the hint switches to "In hand: …"). With a filter or a collapsed group
    active, navigation only ever visits rows that are on screen. Now group by POD and Tab onto a group
    **header**: ArrowDown enters that group's first row and ArrowUp leaves it to the previous group's
    last row (a *collapsed* group renders no rows, so its header is not a jump origin — Tab past it).
    Clicking a header to collapse also leaves focus on that header, so the next arrow key still acts
    on the list rather than on the page.
34. **State survives a placement.** With a search term, a grouping and a sort active, place a box from
    the list into a valid slot (drag, or pick-then-click). **Expect:** the row disappears, the header's
    `shown`/`total` both decrement, and the search text, filters, sort, grouping and the list's scroll
    position are all exactly as they were. Then place the last matching row → the section shows the
    "No container matches." line with a **Clear filters** action (not an empty box) and the controls
    still above it. Click **Clear filters** → the full list returns, `Unplaced (400)`, ungrouped, in
    plan order. `Cmd/Ctrl+Z` restores the placed boxes to the list without disturbing the filter
    state.

---

## Known limitations — do not report these as bugs

- **2D addresses whole bays only.** A 20' half-bay drop is 3D-only; the bay selector lists `vessel.bays` (even). Recorded for Phase D/E.
- **A drag cannot land on the 2D plan.** A `click` fires only on the nearest common ancestor of press and release, so a release over a cell whose press began on a list row never reaches that cell. Spec §7 asks for *click-to-place* in 2D, which works (steps 14–15).
- **BBC bay boundaries overlap ~0.18 m** by design — the oversized pick box is what buys zero dead zones. Do not "fix" the tiling.
  *Updated 2026-09-16 (P1):* the boxes still overlap (0.402 m total at the minimum pitch, and they must not be shrunk — that reintroduces dead zones), but the overlap no longer decides anything: a pointer resolves to the nearest slot **centre**, so the split is the midpoint of the two bay centres. For the 20' case this replaces the old 0.076 m dead zone between sibling halves.
- **The tooltip lives in the sidebar, not on the ghost** — a WebGL mesh carries no text. Tint and wording come from one verdict object, so they cannot disagree.

## Known gaps left unfixed (recorded, low impact)

*(Updated 2026-09-16, P1: the first two and the dead-code/`e.button`/`pointercancel` items below are
now **fixed** — verified by section F steps 24, 26 and 28. Only the `bayIndex`/`gotoBay` duplication,
a DRY nit with zero user-visible effect, is deliberately still open.)*

- A rejected **3D** pick's reason is visible only while the pointer stays on the slot; there is no post-click confirmation. (The 2D path does show a notice.) — **fixed:** the resolver records the outcome and the at-cursor chip shows it after the click.
- After a 3D drag-**move**, the container mesh's `onClick` still fires, so it may select a different box than the one you moved. No data effect. — **fixed:** a `movedRef` gate suppresses that trailing click.
- `HIGHLIGHT.ghost` is now dead; `bayIndex`/`gotoBay` are duplicated between `Sidebar` and `ViewOptionsPanel`; the window `mouseup` ignores `e.button`, and a release **outside the browser window** leaves the gesture armed (no `pointercancel`/`blur` listener). — **ghost deleted, `e.button` guarded, `pointercancel`/`blur` cancel added; the `bayIndex`/`gotoBay` duplication remains** (a new hook for zero user-visible change).
- `naiveFillPlan` still places 20' boxes nowhere, so the demo loads with 400 of 886 (demo vessel) unplaced on purpose — placing them by hand is the feature. Teaching the packer to fill half-bays is deliberately deferred.

## What to do with a failure

Note the step number and what you saw. Steps 7–10 **[H]** map to specific fixes and their reports carry the mechanism — a failure there is a fix regression, not a new mystery. Everything else is spec acceptance; a failure is a plan-level gap, and Phase D/E are the natural place to absorb it.
