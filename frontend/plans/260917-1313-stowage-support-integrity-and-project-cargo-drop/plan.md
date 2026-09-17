# Stowage support integrity + project-cargo drop targeting

Two defects reported by the user, both reproduced against the running code (not inferred):

1. **Moving a container out from under a stack is accepted and leaves the boxes above it floating.**
   The drop check only judges the DESTINATION; nothing judges what the box LEAVES BEHIND.
2. **Project cargo drag "does nothing" in the 3D scene.**
   The area drop planes resolve a pose only over parts of the deck (dead zones over the container
   stacks), resolve to the HOLD below when "Under deck" is on, and — with the default loaded plan —
   every pose on every area is refused, while the sidebar still promises "fits in: weather deck".

## Reproduction evidence (already run, keep as the regression baseline)

| Claim | How it was proven |
|---|---|
| Destination-side `no_floating` already works | `canPlaceContainer` refuses tier 04/06/84/86 in an empty bay, 40' and 20' halves alike |
| Origin-side is unguarded | `moveContainer("DEMU0000016", bay 22/row 06/tier 86)` returned `ok:true, reasons:[]`; `validatePlan` then went from **0 → 1** `no_floating` violations |
| `unplaceContainer` has no check at all | reads the plan, filters, applies — no predicate call (`usePlanDraftStore.ts:137`) |
| Nowhere to drop project cargo | BBC SAO PAULO + demo cargo + project cargo: **0 valid poses of 2126 sampled** across all 4 areas for BB005 |
| On-deck dead zones | picked BB013, "Under deck" off: pointer at one deck point → `weather deck 97.0 / 7.0 m`; two other deck points → **no pose at all** (no chip, no ghost) |
| Wrong area wins | "Under deck" on: every probed deck point resolved to `Hold 2 tank top`, always `Refused: BB007 overlaps BB005` |
| ~~Data bug~~ **WITHDRAWN** | I read `area_id: undefined` off BB001-003 and called it a bug. It is not: `areaIdOf` defaults an absent `area_id` to the weather deck (`stowage-model/types.ts:75`) and `naive-fill-breakbulk.ts:141` omits it deliberately, exactly as the store's own `breakbulkPlacementOf` does. Occupancy is keyed correctly. |

## Phases

| # | Phase | Status | Priority |
|---|---|---|---|
| 01 | [Support integrity on move & unplace](phase-01-support-integrity-on-move-and-unplace.md) | implemented, reviewed — follow-ups open | high |
| 02 | [Project-cargo drop-target resolver](phase-02-project-cargo-drop-target-resolver.md) | implemented, dead zones gone | high |
| 03 | [Honest "where can it go"](phase-03-free-space-hint-and-area-id-fix.md) | implemented, verified live | medium |

## Key dependencies

- Phase 01 is self-contained (engine + draft store + UI reason surfacing).
- Phase 02 must land before 03 is testable by hand: today you cannot aim at the deck at all.
- Phase 03 depends on 02's resolver only for the manual check; its engine work is independent.

## Ground rules carried into every phase

- ONE predicate. No UI-local placement rule: `canPlaceContainer` / `canPlaceBreakbulk` stay the only
  gates, and any new check is a new **reason** emitted by them (or by a pure module they call).
- Reason ids stay the ones `engine/validation-rules.ts` already emits (`no_floating`), so the chip,
  the sidebar and the plan-wide report word the same thing the same way.
- Files stay under 200 LOC; new logic goes in its own kebab-case module with a header comment in the
  style of the surrounding engine files.
- No test is "fixed" by weakening it. The demo plan already carries 199 `overstow` warnings — that is
  the baseline, not a regression.
