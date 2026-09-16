# Code review — Phase C UI half (placeholders + drop), 2026-09-16

## Scope

- **Contract:** `plans/260916-1647-drag-drop-stowage-placeholders/phase-03-container-placeholders-and-drop.md` (read fully, incl. all dated corrections) + spec §6/§7.
- **Under review (UI half):** new `src/lib/drop-verdict.ts` (+test), `src/features/viewer3d/SlotPlaceholders.tsx`, `src/features/panels/{UnplacedCargoList,ContainerInspector,ProjectCargoPanel,ViewOptionsPanel}.tsx`, `src/features/bayplan/BayPlanDeckBlock.tsx`; modified `EmptySlotPicker.tsx`, `GhostContainerPreview.tsx`, `ContainerInstances.tsx`, `VesselScene.tsx`, `BayPlanView.tsx`, `Sidebar.tsx` (176 LOC), `styles.css`, `App.tsx` (wiring). Engine/store/lib-geometry changes in the working tree belong to Phase A / B / C-part-2 and are taken as reviewed; they are only checked for UI misuse.
- **LOC:** ~1.0k new/changed UI LOC; every file <200 (max non-test 198, `select.tsx`, pre-existing; Sidebar 176).
- **Method:** static trace against R3F 9.7 / drei 10.7.8 / three-stdlib 2.36.1 / react-dom 19.3 bundled sources in `node_modules`; a `vite-node` harness over both real vessels (`/tmp/phase-c-ui-audit/audit.ts`, `audit2.ts`) measuring the picker sets, parity, overlaps and the strip; `npx vitest run` on the 3 Phase C test files (33 passed); `grep` sweeps for gates and hygiene. Nothing executable here: no DOM test capability, none added (verified: no jsdom/testing-library/browser mode anywhere).

## Score: 7.5 / 10

Contract compliance is high: one gate, one resolver, three call sites, no UI-local placement rule anywhere, correct strip discipline, three-state tint from a single verdict object, keyboard/undo layer correct, hygiene clean, and the plan's measured numbers reproduce exactly. Deductions are for one reachable interaction defect in the release path and one picker-geometry claim that is measurably false (with a real targeting consequence for the 20' flow this phase exists for).

## Verdict on the browser hand-off

**Yes — safe to hand to a human for the click-through, with two specific things to watch** (they are the only places where I could not settle the outcome by reading): (A) click a container's row in the Unplaced list *after* a canvas interaction and confirm no box is placed by that click alone; (B) with a 20' box in hand, point at the AFT half's placeholder on bay 22 (BBC) and confirm which half the ghost snaps to. Everything else on the acceptance script is deterministically satisfied by code I verified and/or measured.

---

## 1. The picker's parity filter (priority 1) — sound, non-gating, measured

- **It is genuinely only a rendering filter.** The only commit gate is `canPlaceContainer` inside `usePlanDraftStore.putContainer` (`usePlanDraftStore.ts:108`); the picker never writes plan state (`EmptySlotPicker.tsx:54` is a `.filter` on a render array). No `.ok` computation exists in any `.tsx` (grepped: only `result.ok` reads of the resolver's result).
- **It cannot hide a legal target.** `canPlaceContainer` itself enforces parity with `size_fits_bay`, severity `error` (`can-place-container.ts:123`, `reason.ts:70`) — the same `sizeFitsBay` function the filter uses. Measured: **0 violations** of `ok ⟹ sizeFitsBay` over 72,000 (container, slot) pairs on the demo and 40,230 on BBC; and the valid set minus the pickable set is **empty** for 40'/20'/reefer on both vessels (`valid-hidden-by-parity 0`).
- **It cannot admit an illegal target.** Blocked slots *are* in the in-gesture set by design; the commit re-validates. Confirmed.
- **Occupied slots are still excluded** (measured `occupied-in-pick 0` both vessels) — Correction 1 holds; no pick volume can steal `hoveredId`.
- **Parity claim holds structurally:** in-gesture sets are 100% even (40') / 100% odd (20') on both vessels, so no cross-parity box can exist inside one gesture. 40' pick counts 314 (234 refused) demo / 337 (263 refused) BBC reproduce the phase file exactly.
- **But the comment's second half is false** — see finding H2.

## 2. Event wiring (priority 2) — traced; one reachable defect

Paths traced against R3F's actual dispatcher (`node_modules/@react-three/fiber/dist/events-156d8d12.esm.js`):

- **`ContainerInstances` pointer-down + 4 px threshold — correct.** `onPointerDown` records `{id, clientX, clientY}` (`:129-133`); the move path clears the record when `buttons & 1 === 0` (`:140`, the off-mesh-release guard — `buttons` is a real `PointerEvent` property and R3F copies own+inherited non-function props onto the event, `:721-730`, so `e.nativeEvent.clientX` is valid), and only arming past `> 4` px (`:141`). A plain click (jitter < 4 px) cannot arm a move. A stale `downRef` left by an off-mesh release is harmless: it is only read under the `buttons` guard.
- **No move fires on a plain click; selection survives** — `onClick` still calls `setSelected(idAt(e))` (`:155-159`), and `idAt` uses the raycast's `instanceId`, which always matches the current matrices.
- **`click` after `mouseup` order is safe for both gesture kinds.** DOM order is mouseup → click. The release path calls `commitPlacement`, whose success/rejection paths clear the gesture (`commit-placement.ts:50-51`), so the later picker `onClick`/container `onClick` sees `activeContainerId === null` and does nothing (verified in `commit-placement.ts:39`). A row click's `click` then arms the pick (`UnplacedCargoList.tsx:67`) — and `setPicked` clears any drag (`usePlanStore.ts:96`), which also rescues the case where React's effect had not registered the window listener yet.
- **A rejected pick staying alive cannot commit elsewhere:** `pickedId` has no window listener; the next click's target comes from the raycast (`slotAt` / the bay cell), never from `hoveredSlot`.
- **`hoveredSlot` is NOT reliably nulled when the pointer is off a slot** — the one real hazard. Mechanism: R3F's `removeInteractivity` deletes a removed object's hover record **without firing `onPointerOut`** (`events-…esm.js:551-563`). The picker remounts on `key={capacity}` (`EmptySlotPicker.tsx:77`) whenever the in-gesture set's *length* changes — which any successful commit does (the empty count drops by one), and any 20' gesture does (idle 314/337 ↔ in-hand 1600/894, measured `idle capacity === gesture capacity ? false`). After that remount `internal.hovered` no longer contains the picker, so a following `pointerleave`/no-hit `pointermove` runs `cancelPointer` over an empty map and `hoveredSlot` keeps its pre-remount value. Concrete failure: place a box by clicking a slot in 3D (stale `hoveredSlot` = that slot), move the pointer off the grid over water to the sidebar, then **click another container's row** — mousedown arms the drag, the window `mouseup` at `Sidebar.tsx:82` commits `hoveredSlot` onto that stale slot. If the stale slot is the one just filled it is refused (cell_conflict, harmless); if the container is a 20' box and the stale slot is an empty odd half it is **accepted**, and the row disappears before its `click` can arm the pick — an accidental edit + history entry from a click that was meant to pick. The same window makes a drag released over the sidebar commit. Not Critical: the gate holds (no invalid plan, no validator bypass) and undo restores it. Fix: clear `hoveredSlot` in `setDraggingContainer`/`setPicked`, and/or guard the release (`if (!(e.target as Node).closest("canvas")) return cancelPlacement()`).
- **Release over the sidebar in the ordinary case is safe** (R3F's `onPointerLeave` on the canvas container → `cancelPointer([])` → `onPointerOut` → `setHoveredSlot(null)`; verified at `:820-822`, `:787-806`, `:16263`).

## 3. One gate, one action (priority 3) — verified

- Exactly three `commitPlacement` call sites in `src/features`: `EmptySlotPicker.tsx:92` (pick click), `BayPlanView.tsx:84` (bay-cell click), `Sidebar.tsx:82` (window release). No other `placeContainer`/`moveContainer`/`placeBreakbulk` route from `src/features` (grep).
- `cancelPlacement` covers Esc (`use-stowage-keyboard-shortcuts.ts:48`) and the nothing-to-commit release (`Sidebar.tsx:86`); the resolver's own success/rejection paths clear the drag and keep a rejected pick (`commit-placement.ts:50-51`); `resetForVesselChange` clears both (`usePlanStore.ts:114-124`).
- Gap: a mousedown-then-release-outside-the-browser (window blur) leaves the drag armed until the next click / Esc. Pre-existing risk class, acknowledged in the plan; worth a `pointercancel`/`blur` cancel later. Low.
- The window `mouseup` handler does not check `e.button`; a right-button release during an armed drag would commit. Low.

## 4. Move-preview strip discipline — verified (finding W9)

`drop-verdict.ts:45-48` (`subjectStrippedPlan`) mirrors the engine's private `previewPlan` (`placeholders.ts:50-53`) exactly: the same plan object when the subject is unplaced, a filtered copy otherwise. Measured proof on both real vessels: on the box's own slot the stripped verdict is `warning`/`valid`, while the *un-stripped* call returns `ok:false, "<id> and <id> occupy the same position"` — i.e. the W9 trap is avoided. A **fresh drop is not stripped into a different answer**: the strip is an identity for an unplaced subject, and measured `fresh-drop verdict mismatches vs raw predicate: 0` over 3 candidate shapes × 40 slots × 2 vessels, so the ghost/placeholder verdict equals the store's commit result on the same input.

## 5. Three-state tint + wording — correct, two small gaps

- Ghost (`GhostContainerPreview.tsx:49`), placeholders (`SlotPlaceholders.tsx:84`) and the Sidebar text (`ContainerInspector.tsx:49-57`) all read one `DropVerdict` object from `verdictForSlot`; `DROP_TINT` maps verdict → the `HIGHLIGHT` tokens that equal the CSS `--ok/--signal/--error` (`colors.ts:66-77`, `styles.css:90-92`). Amber is worded "Recorded, not refused — the checks below will list it: …", red "Refused: …" with `reasons.find(blocks)` (`drop-verdict.ts:52-56`), so a warning can never be shown as the reason a drop was refused.
- Gap (low): the release path surfaces a refusal (`Sidebar.tsx:87` → `ContainerInspector.tsx:76`) but **not** an accepted-with-warnings drop; the 2D path does (`BayPlanView.tsx:91-96`). Inconsistent, cosmetic.
- `BayPlanDeckBlock.tsx:65` outlines valid targets as valid-only (`validKeys` from `validSlotsFor`), which is right for 2D (no red affordance there) but means a 2D cell click on a blocked empty slot reports via the notice, not pre-hover. Acceptable.
- `HIGHLIGHT.ghost` (`colors.ts:69`) is now dead code (nothing reads it).

## 6. Hygiene (priority 6) — clean

| Item | Result |
|---|---|
| <200 LOC | ✓ all (Sidebar 176; SlotPlaceholders 106; UnplacedCargoList 75; ContainerInspector 79) |
| No new dependency | ✓ `package.json`/lock untouched; drei/three-stdlib/fiber pre-existing |
| No DOM tests added | ✓ no jsdom/testing-library/browser mode anywhere; new tests are node-env |
| Tests green | ✓ 33/33 in `drop-verdict` + `commit-placement` + `use-plan-draft-store` |
| No UI-half engine/store edits | ✓ the UI-half diffs touch only `src/features/*`, `src/lib/{drop-verdict,colors}.ts`, `styles.css`, `App.tsx` |
| Stale "Drop doesn't place it yet (E3-04c/d)" copy gone | ✓ (the one surviving `E3-04c` is a historical comment token, not UI copy) |
| `useStowageKeyboardShortcuts()` mounted once | ✓ only `Sidebar.tsx:40`; ignores INPUT/TEXTAREA; ArrowLeft/Right handler intact and disjoint (`Sidebar.tsx:63-73`) |
| D3 pause on drag start | ✓ atomic in `setDraggingContainer` (`usePlanStore.ts:89-94`) |
| `raycast={() => null}` on hull / ghost / placeholders | ✓ |

## 7. Implementer's unverifiable claims — settled where possible

The self-declared list (items 1–10 + parity tie-break) is **not on disk** — there is no implementation report in `plans/reports/` and the phase file carries only the browser-only WCAG/manual-acceptance TODOs. I settled the four claims named in the brief:

1. **"drei/three-stdlib check `controls.enabled` in the pointer handlers" — CONFIRMED.** drei's `OrbitControls` wraps three-stdlib's and connects to `events.connected || gl.domElement` (`node_modules/@react-three/drei/core/OrbitControls.js`), and `three-stdlib/controls/OrbitControls.js` returns early on `enabled === false` in `onPointerDown` (:616), `onPointerMove` (:630, :705), `onMouseWheel` (:726), `onContextMenu` (:817); its `useFrame` update is likewise gated (`if (controls.enabled)`). So `OrbitLock` freezing the orbit works, and it also freezes mid-gesture damping. Nuance: the rotation for the couple of pixels before the 4 px threshold is crossed is real (~1° at 800 px) — inherent to the threshold design.
2. **"R3F's `pointerleave → cancelPointer → onPointerOut`" — CONFIRMED, but incomplete.** `onPointerLeave: ['pointerleave', true]` on the canvas container (`:16263`), `handlePointer` maps it to `cancelPointer([])` (`:820-822`), which fires `onPointerOut` for hovered records not in the new hit list (`:787-806`). What the claim misses is the unmount hole (`removeInteractivity`, `:551-563`) that creates finding H1.
3. **"React flushes a `mouseup` effect before a fast row `mouseup`" — NOT substantiated by the source.** Passive effects are flushed from a NormalPriority Scheduler callback after the commit (`react-dom-client.development.js:19554-19561`) or at the end of the next commit (`do flushPendingEffects(); while (…)` at `:19392`); the discrete-event dispatch path (`dispatchDiscreteEvent` `:26099-26115` → `dispatchEvent` `:26133`) contains no flush. So the window-mouseup listener registration is a *macrotask after* mousedown, not synchronous. Consequence: a sub-frame click can miss the listener — benign (the row's `click` + mutual exclusion still produce a correct pick) — but it makes the release path best-effort, and the H1 window is real for human-speed clicks.
4. **The new parity tie-break — settled by measurement.** The filter removes the cross-parity steal (a 20' half's pitch box does cover its parent's centre: half offset 3.067 m vs box half-length 6.696 m), so a 40' target is reachable; but it does **not** resolve the sibling-half ambiguity (finding H2).

Browser-only items I could not settle (no DOM/WebGL here): which instance wins a raycast in the 3D view when boxes overlap; the live feel of the 4 px threshold; the WCAG click-pick → click-place script in 2D and 3D; the BBC bay-22 acceptance drop with the ~0.4 m boundary overlap.

---

## CRITICAL

None. No gate bypass, no data loss, no security surface (no network/auth/persistence added; the drop is validator-gated on every path).

## High priority

**H1 — A stale `hoveredSlot` can be committed by a click that was meant to pick (or by a release over the sidebar).**
`Sidebar.tsx:82` (commit) + `EmptySlotPicker.tsx:77` (remount) + R3F `events-……esm.js:551-563` (no `onPointerOut` on unmount).
Scenario: click-place a box in 3D (or Esc a 20' pick) → the picker's `capacity` changes → the mesh remounts and R3F drops its hover record without firing `onPointerOut` → `hoveredSlot` keeps the pre-remount slot → move the pointer off the grid over water to the sidebar (no hit → nothing clears it) → click another container's row: mousedown arms the drag, `mouseup` commits onto the stale slot (acceptance depends on `canPlaceContainer`; a legal stale target is silently placed, an illegal one is refused). Fix: reset `hoveredSlot` in `setDraggingContainer`/`setPicked` (cheap, also kills the cross-gesture staleness), and/or gate the release on the pointer being over the canvas.

**H2 — The 20' in-gesture pick set is ambiguous between the two halves of one 40' bay; the comment claims the opposite.**
`EmptySlotPicker.tsx:52-53` ("Both real sizes stay parity-pure, so within a gesture no two boxes overlap") and `:104` (the pitch-sized box). Measured on the loaded plans: for a 20' candidate the sibling halves (odd 21/23 around even 22, centres 6.134 m apart = 2 × `HALF_BAY_OFFSET_M`) both carry a 13.392 m pick box → **2400 overlapping pairs on the demo, 1554 on BBC, max overlap 7.258 m of 13.392 m**. three sorts intersections by distance, so the resolved half is decided by which box the ray enters first — i.e. by the camera side, not the pointer. With the default camera (+x/bow side) a pointer aimed at the AFT half's placeholder resolves to the FORE half for the whole 7.26 m shared band. Consequence: the headline 20' hand-placement flow can pick the wrong half of a bay (legal, undoable, but not what the planner pointed at). The 40' case is fine on the demo (min pitch 13.392 = box, exact tiling) and carries the documented 0.402 m BBC overlap. Fix: use a `len20`-sized pick volume for a 20' candidate (or two offset half-boxes) and correct the comment; keep the parity filter either way.

## Medium

- **M1 — The pitch-sized box cannot express the deck/bay view filters.** The picker ignores `showOnDeck`/`showUnderDeck`/`bayFilter` (`EmptySlotPicker.tsx:35-55`) while `SlotPlaceholders` honours them (`SlotPlaceholders.tsx:50-54`). A picked box can be committed into a hidden deck or a filtered bay (the ghost shows it, the placeholders don't) — legal, but the affordances disagree; the "N valid positions" hint deliberately counts unfiltered positions too.
- **M2 — A rejected pick in 3D surfaces its reason only while the pointer stays on the slot.** `EmptySlotPicker.tsx:92` discards the result; the reason is visible because `ContainerInspector` reads the hover verdict. Acceptable, but there is no post-click confirmation, and the 2D path does produce one.
- **M3 — An accepted-with-warnings drop via the release path is silent** (`Sidebar.tsx:87` only handles `!ok`), unlike the 2D notice (`BayPlanView.tsx:91-96`).
- **M4 — The hover path calls `verdictForSlot` twice per pointer move** (ghost + inspector) and, for a MOVE, `subjectStrippedPlan` builds a new plan object per call, defeating `indexFor`'s plan-identity cache (`can-place-container.ts:87-97`) → an index rebuild per call. Correct but wasteful on large plans; hoist the preview or memoise the verdict pair.
- **M5 — A 3D drag-move re-fires the container mesh's `onClick`** after the drop (R3F does not gate `onClick` by movement; the object identity and `initialHits` survive a same-count move) → `setSelected(idAt(e))` may select a different container than the one moved. No data effect; the picker's own click is neutralised by `cancelPlacement` (`commit-placement.ts:50`).
- **M6 — The Sidebar's `rejection` message persists until the next gesture or vessel switch** (`Sidebar.tsx:94-96`); it is cleared on gesture *start* by design, so a stale "Not placed — …" can sit under the inspector indefinitely.

## Low

- `HIGHLIGHT.ghost` dead (`colors.ts:69`); `bayIndex`/`gotoBay` duplicated between `Sidebar.tsx:56-60` and `ViewOptionsPanel.tsx:27-31` (DRY nit, behaviour identical).
- The window `mouseup` handler ignores `e.button`, and a release outside the browser window leaves the gesture armed until the next click/Esc (`Sidebar.tsx:78-91`) — no `pointercancel`/`blur` cancel.
- `bayCenterX`'s "bay not on this vessel at all" fallback (`geometry.ts:79`) is a plausible-place fallback, not a sentinel; UI code never feeds it an unknown bay, so no action.

## Edge cases scouted (beyond the diff)

1. Picker remount wipe → stale `hoveredSlot` (H1, the root cause; also the reason the "release over the sidebar" case is unsafe).
2. The subject's own slot is a *valid* target for a MOVE (`validSlotsFor` strips it) and is drawn as a green placeholder, but the picker excludes it as occupied → a highlighted, non-clickable affordance; clicking it falls through to `onPointerMissed` (`VesselScene.tsx:50`) and clears the selection. Cosmetic inconsistency between the two layers.
3. A 20' pick in 2D: no cell can ever be outlined (`validKeys` are odd-bay keys, cells are even-bay keys) and any cell click is refused with `size_fits_bay` — the documented 2D limitation, and the refusal message is actually informative.
4. `vessel.bays` holds only even bays, so odd-bay hover-to-inspect is unavailable when nothing is in hand (documented; the idle filter `isFortyBay`).
5. Undo/redo after a drop re-runs `validatePlan` and can restore a plan where `pickedId`'s container is placed elsewhere — the pick stays armed on a placed box (harmless: the resolver routes it to `moveContainer`).

## Positive observations

- The `SubjectStrippedPlan` mirroring, the `sizeFitsBay`-as-filter/`canPlaceContainer`-as-gate split, and the three-state verdict object are exactly the right decompositions, and each is documented at the point of risk.
- `EmptySlotPicker`'s "placeholders demo 800 → 2400" style self-documentation of *why* a filter exists (and the model-key warning: `"bay|row|tier"` authoritative, `"bay:row:tier"` fails open) is excellent for future readers.
- The `commitPlacement` post-commit state rule (success ends everything; a rejected drag clears; a rejected pick survives) is the load-bearing detail that makes the click-after-mouseup ordering safe — verified, not assumed.
- Hygiene is genuinely clean: no new deps, no DOM tests, no engine edits in the UI half, Sidebar split into four components with unchanged copy, one keyboard hook.

## Recommended actions

1. **H1** — clear `hoveredSlot` on gesture start (one line in `setDraggingContainer`/`setPicked`) and/or require the release to originate over the canvas in `Sidebar.tsx:80-88`. Highest value, lowest risk.
2. **H2** — size the pick volume by the candidate (20' → `len20`, or per-half boxes) and fix the comment's "no two boxes overlap" claim; the parity filter stays.
3. **M1/M3** — either apply the deck/bay view filters to the picker or state the asymmetry in the hint; surface an accepted-with-warnings drop on the release path for parity with 2D.
4. **M4** — memoise the hover verdict pair (ghost + inspector) per `(plan, container, hoveredSlot)`.
5. **M5/M6** — gate `ContainerInstances.onClick` on "no drag started since pointer-down" (a ref flag), and clear `rejection` when the hovered/selected focus changes.
6. Browser pass — the WCAG script (click-pick → click-place, 2D and 3D, Esc), plus scenario A (stale click) and B (20' aft half) above; record the BBC bay-22 boundary observation as the plan asks.

## Metrics

- Typecheck: not run here (no `tsc` pass requested of this review; the plan records it clean) — tests: 33/33 green on the three Phase C files.
- New deps: 0. DOM tests added: 0. Engine/store edits in the UI half: 0.
- Measured: 40' pickable 314/337 with 234/263 refused (matches the plan); 20' in-gesture 1600/894 all odd; parity invariant violations 0/112,230 pairs; strip self-conflict avoided on both vessels.

## Unresolved questions

1. The implementer's items 1–10 are not on disk — if the list names things beyond the four claims I settled, send it and I will check the rest.
2. H1's exact reachability (whether a real pointer path from a slot to the sidebar avoids every pick box) needs the browser; the mechanism is proven from R3F's source, the trigger frequency is not.
3. H2's visible jump (ghost snapping fore by ~6 m when the aft placeholder is clicked) should be confirmed in the browser; the box overlap is measured, the ray winner is inferred from three's distance sort.
4. Whether the 3D drag-move's trailing click (M5) actually reaches the mesh or is swallowed by the post-drop re-render depends on the React flush timing for a native-event update — browser-only.
