/**
 * Reason builders for the container predicate — the per-rule message strings, split out of
 * `can-place-container.ts` so both files keep real headroom under the phase's 200-LOC limit.
 *
 * `overstowReasons` reproduces the plan rule's SELECTION (`validation-rules.ts:128-141`), not only its
 * wording: within one 20' half-column (sorted bottom -> top) a lower box reports only the NEAREST box
 * above it whose POD sequence is later. Pairing the candidate with EVERY higher-POD box in its column
 * instead names blockers the report never lists — measured +18 pairs on BBC SAO PAULO (54 vs 36) and
 * +99 on the demo vessel (298 vs 199) — so a Phase C tooltip would blame a box the violation list
 * never mentions.
 *
 * `twentyOnFortyReasons` exists for the same reason on the other blocking rule the predicate used to
 * omit (code review H2): `twenty_on_forty` is an `error` in the plan-wide report, so without it here
 * a 20' box dropped onto a 40' below showed a green ghost and then appeared in the violation list —
 * reachable as soon as the model exposes 20' half slots.
 *
 * `pad2`/`reason` live here because both predicates format their messages with them.
 */
import type { StowageArea } from "@/engine/stowage-model";
import type { HalfSide } from "@/engine/slot-helpers";
import type { PlacementRule, Reason } from "./reason";
import { severityOf } from "./reason";

export const pad2 = (n: number): string => String(n).padStart(2, "0");

export const reason = (rule: PlacementRule, message: string): Reason => ({ rule, message, severity: severityOf(rule) });

/** D4's generic-area caveat — the message string, here with the other per-rule ones. It names the
 * area and NOT the candidate: this is a fact about the data, so the plan-wide rule's per-message
 * dedup (`breakbulk-validation-rules.ts`) collapses it to one line per approximate area instead of
 * one per item resting on it. `AreaPlaceholders` shows the same fact as a badge
 * (`lib/area-label-text.ts`); keep the two sentences recognisably the same claim. */
export function approximateAreaReason(area: StowageArea): Reason {
  return reason(
    "breakbulk_approximate_area",
    `${area.label}: approximate area — no GA layout, so its extent is a fraction-of-LOA estimate`,
  );
}

/** Occupancy of one 40' cell's 20' halves, in placement order (`PlanIndex.cells`). */
export interface CellHalves {
  fore: string[];
  aft: string[];
}

/** The parts of a placed box the checks read out of its `40'bay|row|deck` column. */
export interface ColumnBox {
  readonly id: string;
  readonly tier: number;
  readonly podSeq: number;
  readonly halves: readonly HalfSide[];
}

/** `twenty_on_forty` for the halves the candidate covers: a 20' has no corner-casting support in the
 * middle of a box below it, so a non-20' occupying any half it stands on blocks the drop. Reproduces
 * `validation-rules.ts`'s selection exactly — the same tier-below lookup (the caller passes the cell
 * the rule's own `tierBelow` resolves, so a gap or a tier the stack lacks skips the check), the same
 * per-half union, and the same "the ids the plan does not know are not 40'/45'" filter.
 *
 * A 40'+40' pair is not affected: the rule only ever evaluates a 20' subject. */
export function twentyOnFortyReasons(
  cellBelow: CellHalves | undefined,
  halves: readonly HalfSide[],
  id: string,
  nonTwenty: ReadonlySet<string>,
): Reason[] {
  if (!cellBelow) return [];
  const forties = [...new Set(halves.flatMap((h) => cellBelow[h]))].filter((other) => nonTwenty.has(other));
  if (forties.length === 0) return [];
  return [reason("twenty_on_forty", `${id}: 20' stowed on top of 40' ${forties.join(", ")}`)];
}

/** `cell_conflict` for the halves the candidate covers — message identical to the plan rule's:
 * append the new box last, and dedupe a 40'-over-40' pair reported on both halves. */
export function cellConflictReasons(cell: CellHalves | undefined, halves: readonly HalfSide[], id: string): Reason[] {
  if (!cell) return [];
  const out: Reason[] = [];
  const seen = new Set<string>();
  for (const half of halves) {
    if (cell[half].length === 0) continue;
    const message = `${[...cell[half], id].join(" and ")} occupy the same position`;
    if (seen.has(message)) continue;
    seen.add(message);
    out.push(reason("cell_conflict", message));
  }
  return out;
}

/** The overstow pairs this candidate would create in its own column, in either direction — it can
 * bury a box below it, or be buried by one above. Soft/non-blocking (D1).
 *
 * The candidate is inserted at the position the committed plan would give it — last among its own
 * tier, because a placement is appended — and then the rule's own loop runs over the half-column, as
 * `buildValidationContext` sorts it (`:104`). Only pairs that name the candidate are reported; every
 * other pair is another box's business and the plan rule already lists it. */
export function overstowReasons(
  column: readonly ColumnBox[] | undefined,
  tier: number,
  podSeq: number,
  id: string,
  halves: readonly HalfSide[],
): Reason[] {
  if (!column) return [];
  const out: Reason[] = [];
  const seen = new Set<string>();
  for (const half of halves) {
    const halfColumn = column.filter((e) => e.halves.includes(half));
    const at = halfColumn.findIndex((e) => e.tier > tier);
    halfColumn.splice(at === -1 ? halfColumn.length : at, 0, { id, tier, podSeq, halves });
    halfColumn.forEach((lower, i) => {
      const blocker = halfColumn.slice(i + 1).find((upper) => upper.podSeq > lower.podSeq);
      if (!blocker || (blocker.id !== id && lower.id !== id)) return;
      const signature = `${blocker.id}|${lower.id}`;
      if (seen.has(signature)) return; // a 40' over a 40' appears in both half-columns
      seen.add(signature);
      out.push(reason("overstow", `${blocker.id} blocks ${lower.id} (earlier discharge)`));
    });
  }
  return out;
}
