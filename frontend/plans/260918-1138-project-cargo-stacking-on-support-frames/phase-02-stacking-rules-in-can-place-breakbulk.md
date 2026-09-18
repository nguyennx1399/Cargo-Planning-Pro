# Phase 02 — Stacking rules in canPlaceBreakbulk

## Context links
- [plan.md](plan.md) · [phase-01](phase-01-stack-model-and-geometry-engine.md)
- `src/engine/placement/can-place-breakbulk.ts` (191 LOC; the MESSAGE CONTRACT in its header)
- `src/engine/breakbulk-validation-rules.ts`: plan-wide wrappers that dedup by message
- `src/engine/placement/reason.ts`: `PLACEMENT_RULES`, `RULE_SEVERITY`
- `src/engine/placement/placeholders.ts`: the list of area-level rules used for placeholders
- `src/engine/validate-plan.ts`, `src/lib/group-violations.ts` (`RULE_LABELS`)

## Overview
- **Priority:** high.
- **Status:** done (2026-09-18).
- `BreakbulkPose` gains `onCargoId?`. The predicate learns height, so stacks stop reading as overlaps, and
  three new rules are added. Floor items keep every existing message byte for byte.

## Key insights
- **Overlap becomes 3-D.** Two footprints in one area only conflict when their VERTICAL ranges
  `[elev, elev + height)` also intersect. That one change makes a stack legal while still catching two
  items side by side at the same level, or an item hanging through another.
- **Stack height** replaces the height-blind clear-height test: `elev + height > area.maxHeight`. When
  `elev = 0` the old message text is kept exactly (it is pinned by tests). A stacked item gets its own text.
- **Top load** has to be checked all the way down the chain. Adding 5 t on the top of a 3-high stack loads
  every support below it. Report each overloaded support once (the message names the SUPPORT, so the
  wrapper's message dedup collapses repeats).
- **Pressure** belongs to the item that touches the floor. It becomes `(own + loadAbove) / footprint` for
  the chain's bottom item. For a plan with no stacks that is the current number exactly.
- The 20 m band weight already counts every item in the area by x-centre, so stacked weight still reaches
  the deck. That is correct as is and needs no change.

## Requirements — new rules (all `error` unless stated)
| rule | when | message |
|---|---|---|
| `breakbulk_unsupported` | footprint not within the support's top rect (± `EDGE_TOLERANCE_M`) | `${id}: footprint overhangs ${supportId}` |
| `breakbulk_support_invalid` | chain broken: missing / cycle / not stackable / other area / resting on itself | `${id}: cannot rest on ${supportId} (${why})` |
| `breakbulk_support_overloaded` | `loadAbove(S) + candidate > S.stacking.max_top_load_t` for any S in the chain | `${S}: ${load}t on top exceeds its ${max}t max top load` |

Changed: `breakbulk_overlap` (vertical-aware), `breakbulk_too_tall` (elevation-aware),
`breakbulk_over_pressure` (stack weight on the bottom item).

## Architecture
- New `src/engine/placement/breakbulk-stack-checks.ts`: `stackReasons(plan, item, pose, rect, area)` returns
  `Reason[]` for unsupported / invalid / overloaded, and exports `verticalRange` for the overlap loop.
  `can-place-breakbulk.ts` calls it and stays under 200 LOC. If it would go over, move the overlap loop
  out as well.
- Evaluating a CANDIDATE uses the plan with the candidate's own placement removed and the candidate
  re-added at `pose` (the same "exclude then re-add" the predicate already does for band weight). This
  keeps "already placed" and "new drop" identical.
- `placementOf(item, pose)` carries `on_cargo_id`, and `poseOf(placement)` in the rules file carries it back.
- The plan-wide wrappers are three new exported functions in `breakbulk-validation-rules.ts`, registered
  in `validate-plan.ts`. Add the labels in `RULE_LABELS`: "Project cargo overhangs its support",
  "Invalid stacking support", "Support top load exceeded".
- `placeholders.ts`: the new rules depend on the pose's support, not on the area. Leave them out of the
  area-level set and add a comment saying why.

## Implementation steps
1. `reason.ts`: add the 3 rule ids + severities.
2. `breakbulk-stack-checks.ts` with the three checks and `verticalRange`.
3. `can-place-breakbulk.ts`: `pose.onCargoId`; vertical-aware overlap; elevation-aware too_tall (old text
   when elev = 0); pressure on the chain bottom with the stack weight; call `stackReasons`.
4. Wrappers + `validate-plan` registration + `RULE_LABELS`.
5. Tests (`breakbulk-stacking-rules.test.ts`): a legal 2-high stack → no violations; 3-high → elevations
   and loads; overhang → unsupported; 1 t over the limit → overloaded names the right support; the top of
   the stack over the clear height → too_tall (new text); side-by-side overlap at the same level still
   reported; a cycle → invalid, no hang; resting on a non-stackable item → invalid; the preview and the
   plan rule agree for the same pose.
6. Full suite: every existing breakbulk and demo test is unchanged.

## Todo list
- [x] Rule ids + severities
- [x] `breakbulk-stack-checks.ts`
- [x] Predicate wired (overlap 3-D, too_tall, pressure, stack reasons)
- [x] Wrappers, validate-plan, labels
- [x] Tests
- [x] typecheck + suite green, existing messages untouched

## Success criteria
- A legal stack validates clean, and each of the three checks refuses its own case with a clear message.
- Zero diffs in the existing breakbulk test expectations.

## Risk assessment
- **Message-contract drift** on floor items: guarded by the existing pinned tests. Run them before and after.
- **Cost:** chain walks are memoised in phase 01. The overlap loop only calls `verticalRange` on footprint
  hits, which are already rare.

## Security considerations
None.

## Next steps
Phase 03.
