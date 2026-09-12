/**
 * Constraint rules. TS port of backend/app/validation/rules.py, extended for mixed 20'/40' stowage.
 * Each rule is a small pure function: context -> violations.
 * Add a rule = write a function + append it to ALL_RULES + add pass/fail tests.
 */
import type { Severity, StackSpec, Violation } from "@/types/domain";
import { plugOk, sizeFitsBay, tierBelow } from "./placement-checks";
import { isFortyBay, slotCode } from "./slot-helpers";
import { HALVES, cellKey, type ColumnEntry, type ValidationContext } from "./validation-context";

export type Rule = (ctx: ValidationContext) => Violation[];

const pad2 = (n: number): string => String(n).padStart(2, "0");
const codeOf = (e: ColumnEntry): string => slotCode(e.placement.slot);

function violation(rule: string, severity: Severity, message: string, containerIds: string[], slots: string[] = []): Violation {
  return { rule, severity, message, container_ids: containerIds, slots };
}

/** Every placed box with its stack spec (undefined when the vessel has no such stack). */
function* entriesWithStack(ctx: ValidationContext): Generator<{ e: ColumnEntry; stack: StackSpec | undefined }> {
  for (const [key, entries] of ctx.columns) {
    const stack = ctx.stacks.get(key);
    for (const e of entries) yield { e, stack };
  }
}

export const slotExists: Rule = (ctx) => {
  const out = ctx.unmapped.map((p) =>
    violation("slot_exists", "error", `${p.container_id}: bay ${pad2(p.slot.bay)} does not exist on vessel`, [p.container_id], [slotCode(p.slot)]));
  for (const { e, stack } of entriesWithStack(ctx)) {
    if (!stack || !stack.tiers.includes(e.tier)) {
      out.push(violation("slot_exists", "error", `${e.containerId}: slot does not exist on vessel`, [e.containerId], [codeOf(e)]));
    }
  }
  return out;
};

export const sizeFitsBayRule: Rule = (ctx) => {
  const out: Violation[] = [];
  for (const p of ctx.plan.placements) {
    const c = ctx.containers.get(p.container_id);
    if (!c || sizeFitsBay(c, p.slot.bay)) continue;
    const bayKind = isFortyBay(p.slot.bay) ? "40'" : "20'";
    out.push(violation("size_fits_bay", "error", `${c.id}: ${c.size}' container in ${bayKind} bay ${pad2(p.slot.bay)}`, [c.id], [slotCode(p.slot)]));
  }
  return out;
};

/** Two boxes on the same 20' half, including a 40' overlapping a 20' at the same row/tier. */
export const cellConflict: Rule = (ctx) => {
  const out: Violation[] = [];
  const seen = new Set<string>();
  for (const cell of ctx.cells.values()) {
    for (const half of HALVES) {
      const ids = cell[half];
      if (ids.length < 2) continue;
      const signature = [...ids].sort().join("|");
      if (seen.has(signature)) continue; // a 40'+40' clash shows up on both halves
      seen.add(signature);
      out.push(violation("cell_conflict", "error", `${ids.join(" and ")} occupy the same position`, [...ids], [slotCode(cell.slot)]));
    }
  }
  return out;
};

/** A 20' has no corner-casting support in the middle of a 40' below it. */
export const twentyOnForty: Rule = (ctx) => {
  const out: Violation[] = [];
  for (const { e, stack } of entriesWithStack(ctx)) {
    if (!stack || ctx.containers.get(e.containerId)?.size !== "20") continue;
    const below = tierBelow(stack, e.tier);
    const cell = below === null ? undefined : ctx.cells.get(cellKey(e.fortyBay, e.row, below));
    if (!cell) continue;
    const forties = [...new Set(e.halves.flatMap((h) => cell[h]))].filter((id) => ctx.containers.get(id)?.size !== "20");
    if (forties.length) {
      out.push(violation("twenty_on_forty", "error", `${e.containerId}: 20' stowed on top of 40' ${forties.join(", ")}`, [e.containerId, ...forties], [codeOf(e)]));
    }
  }
  return out;
};

/** Every half a box covers needs a box below it, except on the lowest tier of its stack. */
export const noFloating: Rule = (ctx) => {
  const out: Violation[] = [];
  for (const { e, stack } of entriesWithStack(ctx)) {
    const below = stack ? tierBelow(stack, e.tier) : null;
    if (below === null) continue;
    const cell = ctx.cells.get(cellKey(e.fortyBay, e.row, below));
    const emptyHalf = e.halves.find((h) => !cell || cell[h].length === 0);
    if (!emptyHalf) continue;
    const where = e.halves.length === 2 ? `${emptyHalf} half of tier ${pad2(below)}` : `tier ${pad2(below)}`;
    out.push(violation("no_floating", "error", `${e.containerId}: no container below (${where} empty)`, [e.containerId], [codeOf(e)]));
  }
  return out;
};

export const stackWeight: Rule = (ctx) => {
  const out: Violation[] = [];
  for (const [key, entries] of ctx.columns) {
    const stack = ctx.stacks.get(key);
    if (!stack) continue;
    const total = entries.reduce((sum, e) => sum + (ctx.containers.get(e.containerId)?.weight_t ?? 0), 0);
    if (total <= stack.max_weight_t + 1e-9) continue; // tolerance for float sums of 0.1 t weights
    out.push(violation("stack_weight", "error",
      `Stack bay ${pad2(stack.bay)} row ${pad2(stack.row)} (${stack.deck} deck): ${total.toFixed(1)}t > limit ${stack.max_weight_t.toFixed(0)}t`,
      entries.map((e) => e.containerId), entries.map(codeOf)));
  }
  return out;
};

export const reeferPlug: Rule = (ctx) => {
  const out: Violation[] = [];
  for (const { e, stack } of entriesWithStack(ctx)) {
    const c = ctx.containers.get(e.containerId);
    if (!stack || !c || plugOk(c, stack, e.tier)) continue;
    out.push(violation("reefer_plug", "error", `${c.id}: reefer on slot without plug`, [c.id], [codeOf(e)]));
  }
  return out;
};

/** Soft: a box discharged later sits above one discharged earlier (checked per 20' half-column). */
export const overstow: Rule = (ctx) => {
  // TODO(phase-3): also count hatch-cover overstow (on-deck cargo blocking under-deck discharge)
  const out: Violation[] = [];
  const seen = new Set<string>();
  const seq = (id: string): number => ctx.podSequence.get(ctx.containers.get(id)?.pod ?? "") ?? 0;
  for (const entries of ctx.columns.values()) {
    for (const half of HALVES) {
      const halfColumn = entries.filter((e) => e.halves.includes(half));
      halfColumn.forEach((lower, i) => {
        const blocker = halfColumn.slice(i + 1).find((upper) => seq(upper.containerId) > seq(lower.containerId));
        if (!blocker) return;
        const signature = `${blocker.containerId}|${lower.containerId}`;
        if (seen.has(signature)) return; // a 40' over a 40' appears in both half-columns
        seen.add(signature);
        out.push(violation("overstow", "warning", `${blocker.containerId} blocks ${lower.containerId} (earlier discharge)`,
          [blocker.containerId, lower.containerId], [codeOf(blocker), codeOf(lower)]));
      });
    }
  }
  return out;
};

// TODO(phase-2): imdg_segregation, stack_height / visibility_line, oog_clearance

export const ALL_RULES: Rule[] = [
  slotExists, sizeFitsBayRule, cellConflict, twentyOnForty, noFloating, stackWeight, reeferPlug, overstow,
];
