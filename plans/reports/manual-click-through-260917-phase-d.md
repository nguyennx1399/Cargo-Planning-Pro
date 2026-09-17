# Manual click-through — project-cargo area drag & placement (Phase D)

**Why this document exists.** The repo still has no DOM test capability (vitest runs `environment: 'node'`;
jsdom/testing-library are deliberately not installed — the same standing decision as Phase C). So every step
below is a human-observed acceptance check: the logic behind it is traced, measured and reviewed, and the
pure parts are swept by unit tests, but no test can click a WebGL canvas. This script covers the **area**
drop path Phase D added — free-positioned project cargo on a stowage area, one level up from Phase C's
discrete container slots — plus the Phase D hardening: the approximation badge, the "fits in" hint and the
recorded-warning wording.

**Run it with:** `cd frontend && npm run dev` → http://localhost:5173

Two vessels carry both halves of this script: **BBC SAO PAULO** (4 declared areas, real GA-derived rects,
keep-outs and ratings) and **MV Demo Horizon** (1 area — a 15 %/85 % LOA guess, `source: "generic"`). Load
demo cargo *and* project cargo on both; the container stacks matter to two refusal steps.

Mark each step pass/fail as you go. Steps marked **[H]** verify a specific Phase D hardening decision and are
the ones most likely to fail; the rest are spec acceptance.

**Numbers used below** are the real model's, measured on the frozen tree:
BBC weather deck `x 9.05 … 122.9` (113.85 m), `z ±9.85` (**19.70 m of breadth**), rating `4 t/m²`, no clear
height. Hold 2 tank top `x 37.6 … 115.9`, `z ±9.1`, `20 t/m²`, `clear 14.6 m`. Hold 2 aft main-deck level
`x 11.5 … 31.1` (19.6 m), `clear 3.9 m`. Hold 1 tank top `x 115.95 … 123.65` (7.7 m), `z ±4.2`, `clear 10.4 m`.
Container stacks on BBC occupy `x 12.10 … 50.35` only — the deck abaft ~50 m is clear. Keep-outs inside the
deck rect: **crane 1 pedestal** `x 41.55 … 45.55, z -9.85 … -7`, **crane 2 pedestal** `x 86.30 … 90.30,
z -9.85 … -7`. Demo project cargo is 14 items, `BB001`–`BB014` (blades, nacelles, tower sections, 2 yachts);
`BB014` is the 30 × 6.5 × 7 m, 95 t yacht.

---

## D1. The two accept paths

1. **Baseline.** BBC SAO PAULO, *Load demo cargo* + *Load project cargo*. **Expect:** every row of the
   *Unplaced project cargo* list carries a badge reading **`fits in: weather deck, Hold 2 tank top`** — and
   nothing else, because Hold 1 tank top (7.7 × 8.4 m) and the Hold 2 aft main-deck level (`clear 3.9 m`)
   admit no item of the demo set. The hint above the list is the idle sentence.
2. **[H — requirement 2]** Press and hold a tower-section row (`wind_turbine_tower`, 24 × 5.5 × 5.5 m,
   110 t). **Expect:** the hint switches to **`BBxxx is in hand — fits in: weather deck, Hold 2 tank top.
   Click the deck where it should sit — R rotates it, Esc cancels.`** The list must show this instantly on
   press and must **not** flicker or re-word while the pointer moves: it is computed once per gesture, not
   per pointer move (the phase file is explicit; a re-word here means the sweep moved onto the move path).
   Then pick a **different** row (a 62 m blade) and confirm the list re-words for *that* item, not the first.
3. **Place on deck.** Still holding the tower, move over the clear deck abaft the stacks (≈ `x 60`,
   `z 0` — amidships, starboard side). **Expect:** translucent **green** rects appear over the *weather deck*
   and *Hold 2 tank top*, each with its own outline; the crane foundations/pedestals, the aft deck structure
   and the forward accommodation show as grey keep-out patches **clipped to the deck rect** (the crane
   foundations sit partly outboard and must not paint the water); the container stacks show as dark grey
   blocks; the weather-deck label reads **`weather deck · 4 t/m²`** with no badge and no clear height.
   The at-cursor chip's first line reads `weather deck 60.0 / 0.0 m — placing BBxxx`, the second
   **`Clean drop — no rule is triggered.`**
4. **Release.** **Expect:** the tower lands on the deck; its row leaves the Unplaced list; the Project cargo
   panel's summary line increments its `on deck` count by one; the area rects disappear (nothing in hand).
   `Cmd/Ctrl+Z` puts it back and re-adds the row; `Cmd/Ctrl+Shift+Z` re-places it.
5. **Place in a hold.** Untick **Hull** so the holds are visible. Pick a 62 m blade again, move over
   **Hold 2 tank top** (its label reads **`Hold 2 tank top · 20 t/m² · clear 14.6 m`** — name, rating, clear
   height, in that order; **[H — requirement 3]**), aim *abaft* the container stacks (≈ `x 85`, `z 0`).
   **Expect:** green, clean chip, and on release the item lands **below the main deck** — the Project cargo
   summary's `in holds` count increments. This is the one hold surface any demo item fits, which is why step
   4 of the "Known limitations" list is what it is.

## D2. Every refusal path (nothing must be committed)

6. **[H — outside the rect]** Pick `BB014` (the 30 m yacht) and drag it astern of the deck edge, over the
   water / the aft deck structure (≈ `x 4`). **Expect:** no green placeholder there, the ghost turns **red**,
   and the chip reads **`Refused: BB014: footprint extends outside the usable deck area`**. Release →
   nothing is placed, the Unplaced count is unchanged, and the chip switches to
   **`Not placed — BB014: footprint extends outside the usable deck area`**.
7. **[H — crane pedestal]** Still with `BB014`, aim at the **port-side crane 2 pedestal** — `x ≈ 88`,
   `z ≈ -7`, i.e. the grey patch on the port side amidships (the area is 19.70 m wide, so a 6.5 m-wide item
   sits with its edge near `z -9.8`). **Expect:** **`Refused: BB014: footprint overlaps crane 2 pedestal`**,
   first-reason wording, red. This is the keep-out path, not the stack path — there is no container stack
   abaft `x 50.35` here.
8. **[H — container stack]** Aim `BB014` at the stack zone, ≈ `x 18`, `z -7.5` (bay 12–24, port side).
   **Expect:** **`Refused: BB014: footprint overlaps on-deck container stack bay 12 row 04`** (numbers
   depend on which stack the pointer resolves). Stacks are checked whatever else is true, so this must refuse
   even though the deck under it is otherwise clear.
9. **[H — rotation must refuse]** With `BB014` in hand over the weather deck, press **R**. The yacht's 30 m
   length now lies athwartships, against **19.70 m** of deck breadth. **Expect:** the ghost turns **red** and
   the chip reads **`Refused: BB014: footprint extends outside the usable deck area`**; no placeholder is
   drawn for the rotated footprint, and releasing places nothing. `R` again (or `R`,`R`) returns it to 0° and
   the ghost goes green again.
   *Measured on the frozen tree:* the same rule refuses the 24 m tower on **Hold 2 tank top** (18.20 m
   athwartships) with **`Refused: BBxxx: footprint extends outside Hold 2 tank top`** — the case the Phase D
   prototype recorded. Either instance is a pass; the yacht-on-deck one is the one that names the 19.70 m
   figure the phase file uses.
10. **R must not reshuffle the AREAS.** While holding an item, press R repeatedly. **Expect:** the set of
    green/red area rects and the `fits in:` hint do **not** change — area feasibility is deliberately
    rotation-0 ("does this item belong in this area"), and only the ghost answers the pose question. A rect
    that flips colour on R is the bug this step exists to catch.

## D3. MV Demo Horizon — the approximation badge and the recorded warning (D4)

11. **[H — requirement 1, badge]** Switch the vessel to **MV Demo Horizon** and load project cargo.
    **Expect:** exactly **one** area rect, and its label reads **`weather deck`** with the badge
    **`approximate — no GA layout`** beneath it, in a neutral grey pill — deliberately *not* tinted with the
    green/red verdict colour, because it describes where the boundary came from, not whether this item fits.
    The label must carry no rating and no clear height: the approximation declares neither, and printing
    `clear Infinity m` would be worse than printing nothing.
12. **[H — requirement 1, recorded warning]** Press a row (the hint now reads
    `BBxxx is in hand — fits in: weather deck. …` — one area, since this vessel has only one), drag over the
    deck, release. **Expect:** the ghost is **amber**, never green and never red; the chip's second line is
    **`Recorded, not refused — the checks below will list it: weather deck: approximate area — no GA layout,
    so its extent is a fraction-of-LOA estimate`**; the identical sentence appears in the Sidebar's Container
    readout; and the **Checks** list gains exactly **one** entry for that sentence — one per *area*, never one
    per item resting on it. Place a second and third item and confirm the Checks list still shows only the
    one line (the predicate's message names no item id, on purpose).
13. **[H — the 20 m band]** In the same gesture family, place a **tower section** (110 t) at ≈ `x 38`,
    `z 0`, then a **nacelle** (95 t) at ≈ `x 34`, `z 6` — same 20 m band (the first band runs `26–46 m`), and
    side by side in z so they do not overlap each other. **Expect:** the second drop's chip and Sidebar read
    **`Deck band 26-46m: 205t exceeds the 200t demo limit`** in **amber**, and the Checks list lists it. The
    band sentence is quoted *instead of* the approximation sentence because it is pushed first — a concrete
    limit must never be displaced by the background caveat (both are recorded; only one line is shown).
    *On this vessel the band is reachable only here: the generic deck has no rating, so its band limit is the
    200 t DEMO constant. BBC's rated surfaces put their band limits at 1.5–7 kt, which no demo item can
    approach — see the Known limitations.*
14. Start the next gesture. **Expect:** the amber line clears (the outcome record's lifetime is one gesture),
    and the Checks list entry stays — it is the plan's, not the gesture's.

## D4. Gesture lifecycle: move, undo, redo, Esc, off-canvas

15. **Move a placed item.** Nothing in hand; press on a placed item and drag past ~4 px. **Expect:** the
    instance disappears and the ghost follows the cursor as a MOVE (the camera must not rotate), the chip
    reads the new target area/position, and on release the item is at the new pose. `Cmd/Ctrl+Z` restores the
    old pose; `Cmd/Ctrl+Shift+Z` re-applies it.
16. **Esc mid-gesture.** Pick a row (or start a drag). Press **Esc**. **Expect:** the hand clears — the row
    un-highlights, the hint reverts to the idle sentence, the area rects disappear, no placement happens.
17. **Release off-canvas.** Press a row and release over the sidebar. **Expect:** a clean cancel — no
    placement, no stuck ghost, no "In hand" line. Repeat releasing over the browser chrome / outside the
    window (alt-tab away and back counts): the gesture must cancel rather than stay armed.
18. **Nothing in hand = no area layer.** With no item in hand the deck must show **no** area rects at all —
    the drawn layer renders nothing when the region list is empty. Hovering a placed item still selects it.

## D5. Keyboard-only (WCAG 2.5.7 — one click to pick, one click to place)

19. **Tab** to a row in the Unplaced project cargo list and press **Enter**. **Expect:** the row is picked
    (it is a real `<button>`; `aria-pressed` flips, the hint switches to the in-hand sentence with its
    `fits in:` list), with **no** drag and **no** mouse movement.
20. Move the cursor (no button pressed) over a valid deck spot and **click once**. **Expect:** the item is
    placed, the row leaves the list, and the same success as step 4. Then confirm Esc still cancels from the
    keyboard, and that Esc/undo do not hijack typing in the Unplaced search box.

## D6. Regression: nothing about Phase C's container path changed

21. Pick a container row and place it in a slot on BBC: the ghost is green, the chip says
    `Slot 220082 — placing <id>` / `Clean drop — no rule is triggered.`, and 2D click-to-place still works.
    **Expect:** no area rects on the deck while a *container* is in hand (the project-cargo area layer
    mounts only for a breakbulk item), and no `fits in:` list for a container.

---

## Known limitations — do not report these as bugs

1. **The `nothing fits` hint is unreachable on both demo vessels.** Every demo item fits at least one area
   (BBC: weather deck + Hold 2 tank top; Demo Horizon: the single generic deck), so the empty-state sentence
   can only be produced by a synthetic item — it is pinned by
   `lib/__tests__/area-fit-hint.test.ts`, not by this script.
2. **The 20 m band warning is unreachable on BBC** with the demo cargo: a rated area's band limit is
   `rating × 20 m × breadth` (4 t/m² × 20 × 19.7 = 1576 t on the weather deck), far above the heaviest demo
   item. It is reachable on MV Demo Horizon only, where the limit is the 200 t DEMO constant (step 13).
3. **2D addresses whole bays only** — containers, not areas. There is no 2D view of a stowage area, so every
   step above is 3D-only. Recorded for Phase E.
4. **Two of BBC's four areas admit no demo item.** Hold 1 tank top is 7.7 × 8.4 m and the Hold 2 aft
   main-deck level has a 3.9 m clear height; the smallest demo item is a 12 × 4 m nacelle and the shortest is
   a 18 m yacht. They are drawn, labelled and pickable, and hovering one shows the predicate's own refusal —
   that is the correct answer, not a missing feature.
5. **A rejected pose's reason is visible while the pointer stays on it**, and after a click the outcome
   record keeps the sentence; there is no history of past refusals beyond that.
6. **The tooltip lives in the sidebar/chip, not on the ghost** — a WebGL mesh carries no text. Tint, chip,
   sidebar and Checks wording all come from the same verdict/outcome objects, so they cannot disagree.

## What to do with a failure

Note the step number, the vessel and what you saw. Steps 2, 11, 12 and 13 are the Phase D hardening itself
(badge, hint, recorded warning) and map to specific decisions in
`plans/260917-0957-project-cargo-area-drag-placement/`; a failure there is a hardening regression, not a new
mystery. The refusal steps (6–9) are the D1 rule set and are unit-swept — a failure there means the UI is not
reading the predicate, which the same-run Checks list will confirm. Everything else is spec acceptance, and
Phase E is the natural place to absorb a gap.

## Run log

*(Appended after the run — see the table below.)*
