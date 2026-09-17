# Phase P1 — Pointer feedback, slot precision and gesture affordances

## Context Links

- Shipped contract this polishes: `plans/260916-1647-drag-drop-stowage-placeholders/phase-03-container-placeholders-and-drop.md` (Key Insights + Corrections 1–2c, Risk Assessment)
- Acceptance script this phase **extends** (steps 1–21 stay untouched): `plans/reports/manual-click-through-260916-phase-c.md`
- Findings folded in: `plans/reports/code-reviewer-260916-phase-c-ui-review.md` §2 (H1 follow-through), §5 (M2/M3 gaps), M5, M6, Lows · `plans/reports/tester-260916-final-ac-verification.md` (1520/1554 reconciliation, 0.402 m worst case, 0.076 m dead zone) · `plans/reports/code-reviewer-260916-1955-phase-b-review.md` §W9 (strip discipline), §M4 (verdict memo) · `plans/reports/researcher-260916-1628-dnd-intent-and-patterns.md` (B4b/B5: no DnD library; WCAG 2.5.7)
- Repo rules: `docs/development-rules.md` (<200 LOC, kebab-case, YAGNI/KISS/DRY, comments explain *why*)

## Overview

- **Priority:** P2
- **Status:** **implemented 2026-09-16, uncommitted.** `npm run typecheck` clean · `npm run build` exit 0 ·
  **73 files / 566 tests green** (70/541 baseline + `nearest-slot` 10 + `drop-feedback` 11 + `drop-outcome` 4)
  · predicate⇔report parity 0 mismatches · demo **199** / BBC **36** · the four frozen guards green and
  unmodified · no `engine/`/`data/` diff · every touched file <200 LOC (`Sidebar.tsx` 190 → 183).
  Remaining: the human click-through (section F, steps 22–28 of `plans/reports/manual-click-through-260916-phase-c.md`)
  and the docs sync (step 13). Deviations from this file, all recorded in the implementation report:
  (a) `dropVerdictText` takes the container id as a third argument — the documented two-argument form
  cannot render its own example headline; (b) `resolveSlot` is used by `onClick` as well as
  `onPointerMove`, or the chip's slot and the committed slot could disagree inside an overlap band;
  (c) the resolution's tier height is read from the slot's own centre, not `[0, y, 0]`, because the
  picker sits under the attitude group; (d) `.viewport-armed` draws its ring as a positioned `::after`
  (an inset box-shadow on `.viewport` is painted under the R3F container); (e) the outcome lifetime
  tests live in `store/__tests__/drop-outcome.test.ts` — the 200-LOC rule and "prove it in
  `commit-placement.test.ts`" cannot both hold; (f) `quotedReason` in `drop-feedback.ts` mirrors
  `lib/drop-verdict.ts`'s private `toVerdict` selection rule, because that file is outside P1's set;
  (g) **a factual error in this file's step 22 text** — it names a "22/24 boundary", but BBC SAO PAULO's
  bays are 2/6/10/…/34, so bay 22's neighbour is **26** (pitch 13.010 m → a 0.382 m overlap band; the
  0.402 m worst case belongs to the 12.99 m pitches at 6/10, 14/18 and 30/34). The acceptance script now
  states the real pair and band.
- **Effort:** ~1–1.5 d
- **Description:** The shipped editor is logically sound (validator-first, one commit resolver, three-state tint from one verdict object) but **tells the planner almost nothing at the point of action**. Four gaps: the refusal/warning reason renders only in the sidebar, so the eye must leave the cursor; a rejected 3D pick has no post-click record (M2); a 3D drag-move's trailing click selects the wrong box (M5); and the canvas gives no cursor/threshold affordance. In the same pass, the **slot resolution** is made pointer-driven so a pointer near a bay boundary resolves the bay it is over — the recorded BBC 0.402 m hazard and the 0.076 m sibling-half dead zone both disappear, without shrinking the pick box.

## Key Insights

### 1. The pick-box constraint and the resolution rule are separate problems

Phase-03's risk table is explicit: *"Do not shrink the pick box — that reintroduces dead zones."* The
current code already violates the spirit of that instruction once: H2's fix sized the 20' volume to
`DIM.len20`, which removed a 7.258 m sibling overlap but **introduced a 0.076 m dead zone** between
the two halves of a 40' bay (`EmptySlotPicker.tsx:84-95`).

Both defects come from the same root cause: **the winner is chosen by three's distance-sorted ray
intersection**, i.e. by which box's surface the ray enters first. That is a *depth* question being
asked where a *lateral position* question is meant. Fix the resolution rule and the box can go back
to being merely "the reachable region" — which must be complete (no dead zones) and nothing else.

### 2. What "nearest centre" actually buys — measured/reconciled numbers

| Case | Today (three's depth sort) | With pitch box + nearest centre |
|---|---|---|
| 40' on MV Demo Horizon | pitch is exactly `DIM.len40 + LAYOUT.bayGap` = **13.392 m** → boxes tile exactly, 0.000 m overlap | unchanged (exact tiling; only the tie-break at the exact midline changes, and it stays deterministic) |
| 40' on BBC SAO PAULO | declared pitches **13.09 / 12.99 / 13.09 / 12.99 / 13.09 / 13.01 / 13.06 / 12.99** (min 12.99, mean 13.0388) → against the 13.392 m box, **0.402 m total / 0.201 m per side at the minimum pitch**. A pointer within ~0.201 m of a boundary can resolve the neighbour | the split moves to the midpoint of the two bay centres — the bay the pointer is actually over. **No overlap band, no neighbour resolution** |
| 20' siblings (2 × `HALF_BAY_OFFSET_M` = **6.134 m** apart) | `DIM.len20` volume → **0 overlapping pairs** (was 1520 demo / 1554 BBC with the pitch box) at the cost of a **0.076 m dead zone** where the pointer resolves nothing | pitch box → 0 dead zones; the split is the midpoint of the sibling centres, so the pointer decides the half, never the camera side. The overlap is large (~7.3 m) but harmless: nearest centre is unambiguous |
| Vertical (tiers) | `tierCenterY` steps by exactly `LAYOUT.tierPitch` → boxes tile exactly | unchanged; a point strictly inside a box is always nearest to that box's own centre (proof: any point in the box is ≤ 1.325 m from its centre, any other tier's centre is ≥ 1.325 m away) |
| Idle set (nothing in hand) | 40'-bay grid only, exact tiling | unchanged |

**Correction to the code comment:** `EmptySlotPicker.tsx:90` still quotes "2400 overlapping pairs" on
MV Demo Horizon. The final tester reconciled this as a **unit error** — 2400 is the demo model's
*slot* count (boxes participating in ≥1 overlap), not a pair count; the pair count under the
definition that also reproduces BBC's 1554 is **1520** (degree histogram `{1:160, 2:1440} →
(160+2880)/2). Phase-03 packed this as a Phase E cleanup; this phase rewrites the comment anyway, so
it is folded in.

### 3. Alternatives considered and rejected (dimension 2)

| Candidate metric | Why rejected |
|---|---|
| Keep three's depth-sorted intersection | The recorded defect: with overlapping boxes the camera azimuth picks the winner (H2; and the 0.402 m BBC band). |
| Nearest centre to the raw intersection point `e.point` | `e.point` lies on the box's **entry face**, not under the pointer. For a box at the ship's centre under the default camera `[90, 55, 90]` with `fov 40`, slab arithmetic puts the entry on the +z face and biases its x by **≈ +1.25 m** — i.e. it only shifts the switchover line by ~9% of a pitch *and the shift flips sign when the camera orbits 180°*. Rejected: a movable, azimuth-dependent split is exactly the "jitter" class of bug this pass exists to remove. (Estimate from the geometry — reproduce with a probe before trusting it.) |
| Perpendicular distance from the slot centre to the cursor ray | Depth-blind: with the camera nearly end-on to the ship's length, distant bays sit within millimetres of the ray and would win over the bay under the pointer. |
| Screen-space (NDC) nearest centre | Correct for oblique views but degenerate end-on, where bays project to nearly the same screen point — precisely the camera angle where depth order *is* the right answer. |
| A second raycast against a per-slot-sized volume, first-hit wins | Reintroduces the dead-zone/overlap trade-off this phase removes, and adds a raycast per pointer move. |

**Adopted:** project the cursor ray onto the **horizontal plane through the hovered tier**, then take
the candidate whose centre is nearest in that plane (see Architecture). The plane crossing cancels
the entry-face bias (a ray aimed at a slot centre lands exactly on that centre); everything else
(tier, row) is left to the existing exact tilings.

### 4. The reason must live in DOM, so give it one wording and one source

A WebGL mesh carries no text (phase-03's "Known limitations"). The chip is a DOM overlay; the Sidebar
stays the persistent, screen-reader-visible readout. To guarantee they can never disagree, both call
the **same** `drop-feedback.ts` functions — and the 2D bay-plan notice is migrated onto them too,
which removes the last place where two paths word the same outcome differently
(`BayPlanView.tsx:88,94` says `"Placed. Recorded, not blocked: …"` while
`ContainerInspector.tsx:82` says `"Placed. Recorded, not blocked — the checks below will list it: …"`).

### 5. Contradictions found between the reports and the tree (folded in where cheap)

| Claim in a report | Tree today | Action |
|---|---|---|
| `manual-click-through-260916-phase-c.md:19,59` — "BBC bay boundaries overlap ~0.18 m" | the reconciled figure is **0.402 m total / 0.201 m per side** at the minimum pitch 12.99; "~0.18 m" is the mean-pitch **per-side** value | correct in place under step 4 + add step 22 (do not delete step 4) |
| `code-reviewer-260916-phase-c-ui-review.md:6` — `Sidebar.tsx` 176 LOC, `ContainerInspector` 79, `SlotPlaceholders` 106 | **190 / 87 / 100** — the H1 + M3 follow-up grew them after the review measured | note; P1 shrinks Sidebar again (removing `releaseNotice`), and the phase's own LOC budget is set against today's numbers |
| `code-reviewer-260916-1955-phase-b-review.md:64` §W3 — `can-place-container.ts` is "198/200", split it before Phase C | **177 LOC** — `placement-reason-builders.ts` was extracted in the follow-up, so W3 is resolved | no action |
| `EmptySlotPicker.tsx:90` — "2400 overlapping pairs" | **1520** (unit error, above) | fixed in step 4 |
| `.unplaced-item { cursor: grab }` exists (`styles.css:171`) | so the *list row* already signals draggability | dimension 3's remaining gap is the **canvas**, not the list |
| `manual-click-through…md:64` — "A rejected 3D pick's reason is visible only while the pointer stays on the slot" | confirmed at `EmptySlotPicker.tsx:116` (`commitPlacement(target)` result discarded) | fixed in steps 3 + 5 (M2) |

## Requirements

**Functional**

1. While a container is in hand (dragged or picked) and a slot is hovered, a **DOM overlay chip** near the cursor shows the slot code and the verdict — green "clean", amber "recorded, not blocked", red "Refused: <message>" — with the **same wording** the Sidebar shows.
2. A **rejected pick** leaves a post-click record (M2); an **accepted-with-warnings** drop reads as recorded-not-fatal on every path (release, pick, 2D, Sidebar) from one wording (M3).
3. The last drop outcome clears as soon as the planner inspects a **different** slot, and on gesture start — no stale "Not placed — …" (M6).
4. Slot resolution is by **nearest slot centre to the cursor's ray crossing on the tier plane**, not by three's depth-sorted intersection.
5. The pick volume is the **pitch box for every candidate** (all parities, all sizes) — no dead zones.
6. The canvas shows a **cursor** that reflects what the next release will do, plus an "armed" ring while a pick/drag is in flight.
7. A 3D drag **move** must not be followed by a `click` that selects a different box (M5).
8. Releases are hardened: the window `mouseup` ignores non-primary buttons; `pointercancel`/window `blur` cancel an armed gesture (Lows).

**Non-functional**

- No new npm dependency; every file <200 LOC; kebab-case modules / PascalCase components / kebab-case hooks as today.
- No engine or rule change: `engine/placement/**`, `engine/validation-rules.ts` and the frozen contracts are **untouched**. Rule ids/messages, predicate⇔report parity, the 199/36 demo reports and the geometry snapshot must hold.
- Validator-first: no UI-local placement rule may gate a drop. `commitPlacement → canPlaceContainer` remains the only gate; the picker's parity filter stays rendering-only.
- The hover path must stay **one predicate call per pointer move**: the chip must call `verdictForSlot` with the same `(vessel, plan, container, slot)` so it hits `drop-verdict.ts`'s one-entry memo (M4's fix must not be undone).
- No DOM test tooling; every new assertion is node-env.

## Architecture

```
                 pointermove over the pick mesh (R3F)
                              │
      e.ray / e.point / e.camera ─┬─► cursorOnTierPlane()   [component: three.js]
                                  │        │ local [x,y,z]
                                  │        ▼
                                  │   nearestSlotIndex()    [lib/nearest-slot.ts — PURE, tested]
                                  │        │ index
                                  │        ▼
                                  └─► setHoveredSlot(slots[i])

  hoveredSlot ─┬─► GhostContainerPreview   (tint, 3D)
               ├─► SlotPlaceholders        (tint, 3D)
               ├─► EmptySlotPicker         (click target → commitPlacement)
               ├─► ContainerInspector      (wording) ─┐
               └─► DropVerdictChip         (chip)     ├─► drop-feedback.ts  [PURE, tested]
                                                      ┘   dropVerdictText / dropOutcomeText / dropCursorClass
  commitPlacement(target, origin) ─► usePlanDraftStore.putContainer ─► canPlaceContainer   [the ONE gate]
               └─► usePlanStore.dropOutcome { slot, message, ok, origin }
                        └─► chip (origin "scene") · BayPlanView notice (origin "bayplan")
                        └─► cleared by setHoveredSlot(<a different slot>) or a new gesture
```

**Resolution rule, precisely.** In `EmptySlotPicker.onPointerMove`:

1. `slot0 = slots[e.instanceId]` — three's first hit, used **only** to learn the tier's height.
2. `yWorld = mesh.localToWorld([0, slot0.center[1], 0]).y`.
3. `t = (yWorld − e.ray.origin.y) / e.ray.direction.y`; if `|e.ray.direction.y| < 1e-6` (cursor ray parallel to the deck) fall back to `slot0`.
4. `local = mesh.worldToLocal(e.ray.at(t))` — the pointer's position on the tier plane, in slot space.
5. `slot = slots[nearestSlotIndex(local, slots)] ?? slot0` → `setHoveredSlot(slot)`.

`e.ray`, `e.point`, `e.camera` and `e.instanceId` are all on R3F's `ThreeEvent`
(`@react-three/fiber/dist/declarations/src/core/events.d.ts:8-30`). Steps 2–4 are three.js calls in
the component (verified by typecheck + the click-through); step 5's **decision rule** is pure and
carries all the precision claims.

**Outcome lifetime (store invariant, node-tested).**

| Trigger | `dropOutcome` |
|---|---|
| `commitPlacement(t, "scene"\|"bayplan")` refused | `{ slot, message: <first blocking reason>, ok: false, origin }` |
| `commitPlacement` accepted **with** a recorded reason | `{ slot, message, ok: true, origin }` |
| `commitPlacement` accepted clean | `null` |
| `commitPlacement(null)` (nothing to commit) | unchanged |
| `setHoveredSlot(next)` where `next !== null` and `next.key !== outcome.slot.key` | `null` — the planner has moved on |
| `setHoveredSlot(null)` | **unchanged** — leaving the canvas must not wipe the message before it is read |
| `setDraggingContainer(id)` / `setPicked(id)` with a non-null id | `null` |
| `resetForVesselChange()` | `null` |

The chip renders the hover verdict while a container is in hand and a slot is hovered; otherwise it
renders the outcome. Because the outcome's text for a refused slot is byte-identical to the hover
verdict's, the hand-over is visually seamless — and the message survives the pointer leaving the slot.

## Related Code Files

**Create**

- `frontend/src/lib/nearest-slot.ts` — `cursorOnTierPlane(tierY, rayOrigin, rayDir): Vec3 | null` and `nearestSlotIndex(cursor, centres): number` (pure; deterministic tie-break = lowest index, and callers guarantee a stable candidate order).
- `frontend/src/lib/drop-feedback.ts` — `dropVerdictText(slot, verdict)`, `dropOutcomeText(outcome)`, `dropCursorClass(state)` (all pure).
- `frontend/src/features/viewer3d/DropVerdictChip.tsx` — the overlay (chip + imperative pointer positioning).
- `frontend/src/features/viewer3d/use-drop-cursor.ts` — reads the store, returns `dropCursorClass(...) + " viewport-armed"` for the viewport wrapper.
- Tests: `frontend/src/lib/__tests__/nearest-slot.test.ts`, `frontend/src/lib/__tests__/drop-feedback.test.ts`.

**Modify**

- `frontend/src/features/viewer3d/EmptySlotPicker.tsx` (123 LOC) — steps 2–5 of the resolution rule; pitch box for all candidates; delete `pickLength`; rewrite the box/parity comments (stale 2400 figure).
- `frontend/src/store/usePlanStore.ts` (139) — `dropOutcome` + `setDropOutcome`; the `setHoveredSlot` clearing rule; gesture-start and vessel-reset clears.
- `frontend/src/store/commit-placement.ts` (64) — `origin` parameter + set `dropOutcome`; doc comment for the lifetime table.
- `frontend/src/features/panels/Sidebar.tsx` (190) — drop the local `releaseNotice` state/prop; `e.button` guard; `pointercancel`/`blur` cancel.
- `frontend/src/features/panels/ContainerInspector.tsx` (87) — read `dropOutcome` from the store; use `dropVerdictText`/`dropOutcomeText`.
- `frontend/src/features/bayplan/BayPlanView.tsx` (163) — notice text via `dropOutcomeText`; pass `"bayplan"` to `commitPlacement`.
- `frontend/src/features/viewer3d/ContainerInstances.tsx` (167) — M5: suppress `onClick` when a drag started since this pointer-down.
- `frontend/src/App.tsx` — `<div className={`viewport ${cursorClass}`}>` + `<DropVerdictChip vessel={vessel} plan={plan} />` inside `.viewport`.
- `frontend/src/lib/colors.ts` (77) — delete dead `HIGHLIGHT.ghost` (recorded Low).
- `frontend/src/styles.css` — `.drop-chip`, `.viewport-armed`.
- `frontend/src/store/__tests__/commit-placement.test.ts` — outcome semantics + `origin`.
- `plans/reports/manual-click-through-260916-phase-c.md` — append section **F** (steps 22–28), annotate step 4's 0.18 m figure, note step 14's unified wording.

**Delete:** none (no file is removed; the size-aware pick branch is a code deletion inside `EmptySlotPicker.tsx`).

## Implementation Steps

1. **`nearest-slot.ts` + tests.** `nearestSlotIndex(cursor, centres)` returns the argmin of squared distance with the lowest index on a tie (document that tie order therefore depends on the caller's stable slot order). `cursorOnTierPlane(tierY, origin, dir)` returns the ray's crossing at `y = tierY`, or `null` when `|dir.y| < 1e-6` or `t < 0`.
   Tests must include, using real vessel data where possible:
   - a point exactly at a 40' bay centre resolves to that bay on **both** vessels, for every bay (sweep the model's own slot centres);
   - **every** x across BBC's minimum pitch (12.99) resolves to the bay whose centre is nearer — i.e. the reconciled 0.402 m hazard is gone;
   - the 20' sibling halves of a 40' bay: sampling x across the full pitch yields a resolution at **every** sample (zero dead zones) and the split is the midpoint of the two sibling centres;
   - the vertical case: a point strictly inside a box resolves to that box's own tier;
   - determinism: identical inputs give identical indices across calls.
2. **Picker resolution.** Rewire `EmptySlotPicker.onPointerMove` to steps 1–5 and set the box to `[DIM.len40 + LAYOUT.bayGap, LAYOUT.tierPitch, DIM.width + LAYOUT.rowGap]` unconditionally; drop `pickLength` from the geometry and the `key` (leave `capacity`). Rewrite the comment block to state: the box defines *reachability* (zero dead zones, pitch tiling), the resolution rule defines *precision* (nearest centre), and the parity filter keeps the in-gesture set to destinations the size can actually use (still rendering-only).
3. **Store outcome.** Add `dropOutcome`/`setDropOutcome`, the `setHoveredSlot` clearing rule, and clears on gesture start + `resetForVesselChange`. Implement exactly the lifetime table. Extend `store/__tests__/commit-placement.test.ts`: a refused pick STILL sets the outcome and keeps `pickedId` (M2); a refused drag sets it and clears `draggingContainerId`; an accepted-with-warning sets `ok: true`; a clean commit sets `null`; hovering a different slot clears it; hovering `null` does not.
4. **`drop-feedback.ts` + tests.** Pure composition:
   - `dropVerdictText(slot, verdict)` → `{ tone: "ok"|"warn"|"error", headline, detail }` — headline `Slot 220082 — placing DEMU0001136` / detail `Clean drop — no rule is triggered.` | `Recorded, not refused — the checks below will list it: <msg>` | `Refused: <msg>`.
   - `dropOutcomeText(outcome)` → `Not placed — <msg>` (ok:false) | `Placed. Recorded, not blocked — the checks below will list it: <msg>` (ok:true).
   - `dropCursorClass(state)` → the truth table `{dragging → "cursor-grabbing"}`, `{active && verdict==="invalid" → "cursor-not-allowed"}`, `{active && verdict → "cursor-pointer"}`, `{active && !overSlot → "cursor-crosshair"}`, `{!active && overContainer → "cursor-grab"}`, else `""`.
   Tests pin: a **warning is never worded as a refusal** on any of the three surfaces; the reason message appears verbatim; the full cursor table; the slot code uses `slotCode` (not a hand-built string).
5. **`DropVerdictChip.tsx`.** `position: fixed`, `pointer-events: none`, `aria-hidden="true"`; a `window` `pointermove` listener (attached once, passive) writes `clientX/clientY` into a ref and mutates `style.transform`, flipping to the left/top near the viewport edges — **no store write and no `setState` per pointer move** (that would re-render the sidebar tree at pointer frequency). Content from `dropVerdictText` / `dropOutcomeText`; tone → the existing `warn`/`error`/`ok` classes so the chip's colour tokens match the canvas tint. Document why the chip is `aria-hidden`: the Sidebar carries the same text accessibly, and an `aria-live` region updated on pointer move would flood a screen reader.
6. **`use-drop-cursor.ts` + `App.tsx`.** Hook returns the class string; `App` applies it to `.viewport` (`cursor` inherits to the canvas — verified: `three-stdlib/controls/OrbitControls.js` sets no cursor of its own) and renders the chip inside `.viewport`. Nothing in hand + a hovered placed container → `cursor-grab`, which is what makes the ≤4 px select / >4 px move threshold discoverable *before* the gesture starts.
7. **Wording unification.** `ContainerInspector` and `BayPlanView` call the shared functions; `BayPlanView` passes `"bayplan"` so its outcome renders in-panel (the chip renders `"scene"` only). Annotate the script's step 14 wording change.
8. **M5.** In `ContainerInstances`, set a `movedRef` when the 4 px threshold arms a move and clear it on the next `onPointerDown`; `onClick` returns early while it is set. Selection on a plain click (script step 17) is unaffected.
9. **Release hardening.** `Sidebar`'s window handler returns early unless `e.button === 0`; add `pointercancel` and window `blur` listeners that call `cancelPlacement()` while a drag is armed. Remove the local `releaseNotice` state (now in the store).
10. **CSS + dead code.** `.drop-chip` (panel background, `--line` border, radius, 12px, `max-width: 340px`, `line-clamp` on the detail), `.viewport-armed` (`box-shadow: inset 0 0 0 2px var(--ok)`). Delete `HIGHLIGHT.ghost`.
11. **Extend the acceptance script** (section F, steps 22–28 — see Success Criteria) and annotate step 4.
12. **Verify the frozen contracts:** `npm run typecheck` · `npm run build` · `npx vitest run` (expect ≥541 green, 0 failures) · `predicate-report-parity` and the four guard files green **unmodified** · `git diff --stat` shows no `engine/` source change.
13. **Docs sync (delegate to `docs-manager`):** changelog entry + roadmap note.

## Todo List

- [x] `lib/nearest-slot.ts` + `lib/__tests__/nearest-slot.test.ts` (both functions; real-vessel sweeps; zero-dead-zone and 0.402 m regressions) — 3741 real centres swept across both vessels, 2599 samples across BBC's 12.99 m pitch, 3349 per vessel across a 40' pitch for the 20' siblings, zero dead zones
- [x] `EmptySlotPicker.tsx`: nearest-centre resolution, pitch box for all candidates, comment rewrite (stale 2400 → the 1520 pair count, both definitions reproduced by the tester) — 161 LOC; `resolveSlot` shared by move and click
- [x] `usePlanStore.ts`: `dropOutcome`, `setDropOutcome`, `setHoveredSlot` clearing rule, gesture/reset clears — 173 LOC
- [x] `commit-placement.ts`: `origin` parameter, sets `dropOutcome`, lifetime doc comment — 91 LOC
- [x] Outcome lifetime table tests (incl. M2) — **split into `store/__tests__/drop-outcome.test.ts`** (4 tests) to keep both files under 200 LOC; `commit-placement.test.ts` is unchanged apart from the `dropOutcome` reset in `beforeEach`
- [x] `lib/drop-feedback.ts` + `lib/__tests__/drop-feedback.test.ts` (wording + cursor truth table) — 159/148 LOC, incl. the M4 memo-identity guard
- [x] `DropVerdictChip.tsx` (fixed-position overlay, imperative pointer tracking, `aria-hidden`) — 115 LOC
- [x] `use-drop-cursor.ts` + `App.tsx` wiring (`viewport` class + chip inside `.viewport`) — 43 LOC hook
- [x] Unify wording: `ContainerInspector` + `BayPlanView` on `drop-feedback.ts`; `commitPlacement` origins — 3 call sites, one writer of `dropOutcome`
- [x] `ContainerInstances.tsx`: suppress the trailing `onClick` after a drag move (M5) — `movedRef`
- [x] `Sidebar.tsx`: drop `releaseNotice`, `e.button` guard, `pointercancel`/`blur` cancel — 190 → 183 LOC
- [x] `styles.css`: `.drop-chip`, `.viewport-armed` (as a positioned `::after`); delete dead `HIGHLIGHT.ghost` — verified emitted in the built CSS
- [x] Extend `plans/reports/manual-click-through-260916-phase-c.md` with section F (steps 22–28) + the step-4 and step-14 annotations (+ the superseded "known gaps" bullets)
- [x] Frozen-contract verification sweep (typecheck, build, full suite, guards unmodified) — see the Overview status
- [ ] Docs sync via `docs-manager` — **not done** (step 13; needs a `docs-manager` spawn, and `docs/` is outside this phase's file ownership)

## Success Criteria

**Machine-checked (node, `npx vitest run`)**

- `nearest-slot.test.ts` proves, on both real vessels' models: correct bay at every bay centre; BBC's 12.99 m minimum pitch resolves to the bay the pointer is over across its whole span; a resolution exists at **every** sample across a 40' bay's pitch (zero dead zones) and the 20' sibling split is the centres' midpoint; deterministic ties.
- `drop-feedback.test.ts` proves: one wording per outcome across the three surfaces; a `warning` verdict is never rendered with refusal wording; the cursor truth table in full.
- `commit-placement.test.ts` proves the outcome lifetime table, including that a **refused pick sets the outcome and leaves the pick armed** (M2) and that hovering a different slot clears it (M6).
- `npm run typecheck` clean; `npm run build` exit 0; suite ≥541 tests, 0 failures; parity 0 mismatches; demo report **199** / BBC **36**; `validate-plan.test.ts`, `breakbulk-real-vessels-no-violations.test.ts`, `bbc-sao-paulo-containers.test.ts` and `geometry-characterization.test.ts` green **and unmodified** (`git status --porcelain` clean for those four paths).
- `git diff --stat` shows **no** change under `frontend/src/engine/` or `frontend/src/data/`.
- Every new/changed file <200 LOC (`Sidebar.tsx` must end **below** its current 190).

**Human-observed (append to `plans/reports/manual-click-through-260916-phase-c.md` as section F; steps 1–21 stay as they are)**

- **22. Boundary resolution (BBC, 40').** Drag or pick a 40' box, set Bay = 22, and hover ~0.10 m inboard of the 22/24 boundary (≈0.20 m is the old hazard band; the script's step 4 note says "~0.18 m" — see the corrected figure). **Expect:** the chip and the Sidebar both name bay **22**, and the ghost sits on bay 22's slot. Step 4's own observation still stands and is now the *only* boundary note needed.
- **23. At-cursor reason.** Hover an **empty but refused** slot (bay-26 row-04 column, "67.4t > limit 60t"). **Expect:** a chip appears beside the cursor reading `2604xx — Refused: …` in **red**, the ghost turns red, and the planner never has to look at the sidebar. Then hover a **valid** slot: the chip reads "Clean drop — no rule is triggered." in green/neutral.
- **24. Post-click confirmation (M2).** Pick a 20' row, then click a **refused** placeholder. **Expect:** the chip reads `Not placed — <reason>` in red and the pick stays armed (the row is still outlined, another slot can be clicked). Move the cursor to a different slot. **Expect:** the "Not placed" message clears and the new slot's verdict takes over (M6 — no stale line).
- **25. Recorded-not-fatal (M3).** On MV Demo Horizon, drop onto an overstow slot. **Expect:** the chip reads `Placed. Recorded, not blocked — the checks below will list it: …` in **amber**, never in red, and the identical sentence appears in the Sidebar and (for a 2D cell click) inside the bay-plan panel.
- **26. Cursor affordances.** Nothing in hand: hover a placed container → the cursor becomes a grabbing hand; press and drag past ~4 px → it becomes a closed hand and the camera does not rotate. With a box picked: over a valid or amber slot the cursor is a pointer hand; over a refused slot it is the "not-allowed" cursor; over the water/hull (no slot) it is a crosshair. Releasing the box restores the neutral cursor.
- **27. Armed ring.** Pick a container: a 2 px green ring appears inside the viewport edge while the pick is armed and disappears on Esc, on a successful place, and on a vessel switch.
- **28. Release robustness.** Start a drag and release with the **right** button → clean cancel, nothing placed. Start a drag, then switch away from the browser window and back (or press Esc) → no stuck ghost, no "In hand" line. Start a drag and release over the sidebar → clean cancel (unchanged from step 9).

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Nearest-centre regresses an interaction the phase-A–C tests cannot see (no DOM tests) | Medium | Medium | The resolution rule is pure and swept over **every** real slot centre on both vessels before any pointer touches it; the honest residual (the ray→plane plumbing: `worldToLocal`, the `e.ray` reading) is confined to ~6 component lines and is covered by click-through steps 22–23. Ship behind a single `nearestSlotIndex` call so a revert is one line. |
| The tier-plane projection behaves badly at an extreme camera angle (near-vertical, or end-on with the ray parallel to the deck) | Low | Medium | `|dir.y| < 1e-6` falls back to three's first hit; the same fallback covers a `t < 0` (plane behind the camera) case. Both are unit-tested. |
| A chip that follows the cursor annoys or occludes the target | Medium | Low | Offset +16/+18 px, flips near the viewport edges, `max-width: 340px`, `line-clamp` on the detail, `pointer-events: none`. Steps 23–24 are the human veto. |
| The chip adds a third `verdictForSlot` call per pointer move and undoes M4's memo | Low | Medium | All three readers pass the same `(vessel, plan, container, slot)` identity, so `drop-verdict.ts`'s one-entry memo serves them; assert object identity in `drop-feedback.test.ts`/`drop-verdict.test.ts` so a future refactor that breaks the memo fails a test. |
| Scope creep into a first-use tour / tooltip system | Medium | Low | Deliberately rejected (YAGNI): the row `title`, the existing hint copy, `cursor-grab` and the chip deliver the same information at the point of use; a dismissible callout would add a persistence key and a component for no new information. Recorded in "Next Steps" as not-planned. |
| Store-rule change (`setHoveredSlot` clearing the outcome) surprises another subscriber | Low | Low | The clearing rule is enforced by tests and documented as a store invariant next to `hoveredSlot`'s existing "cleared on gesture start" comment. `hoveredSlot` itself is unchanged. |

## Security Considerations

- No auth, network, persistence or user input is added — the chip renders text already present in the DOM, from the plan's own data.
- All interpolated content is React-escaped JSX text; no `dangerouslySetInnerHTML`, no `innerHTML` (the imperative work is limited to `style.transform` on our own element).
- `aria-hidden` is used deliberately on a duplicated, decorative-by-design readout; the accessible source (Sidebar) keeps the same information and remains unchanged in role/order.

## Next Steps

- **Blocked on the human decision in `plan.md` #1** (nearest-centre go/no-go). Everything else in P1 is independent of it and can start immediately.
- **Not in this phase, on purpose:** `bayIndex`/`gotoBay` duplication between `Sidebar` and `ViewOptionsPanel` (recorded Low — a new hook for zero user-visible change; not one of the four dimensions); `HIGHLIGHT.ghost`'s deletion *is* folded in; the two Phase-B test-quality findings (tautological `can-place-breakbulk` parity block, zero-coverage `can-place-container` fixture assertion) and the BBC 20' reefer's `valid > 0` assertion stay with Phase D/E — none are UX.
- **Phase E remains the owner of:** multi-select, swap, keyboard nudging, "suggest a spot", 2D drag targets, magnet snapping, the `breakbulk-deck-area.ts` shim deletion.
