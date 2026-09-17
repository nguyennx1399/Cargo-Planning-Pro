/**
 * unplaced-query.ts — everything the Unplaced list does with its rows, as pure data (Phase P2): text
 * search, size/type filters, the "Fits bay NN" claim, sort and grouping. One module, so the list
 * component is presentation only and every ordering claim below is a node test (no DOM test
 * capability in this repo, by decision D7).
 * Deliberately VIEW-FREE: it takes `Container[]` (already in plan order), a query and a small
 * context, and imports no React, no store, no vessel — testability, and COST, because a keystroke
 * re-runs this over 400 rows and so must never reach the engine's predicate (hence the size/parity
 * bay filter, see `bayFits`). `commitPlacement → canPlaceContainer` stays the only gate (D6).
 */
import type { Container, ContainerSize, ContainerType } from "@/types/domain";
import type { SlotDef } from "@/engine/stowage-model";
import { sizeFitsBay } from "@/engine/placement-checks";

export type SizeFilter = "any" | ContainerSize;
export type TypeFilter = "any" | ContainerType;
/** `cargo` = plan order (`plan.unplaced`) — also the rendering default, see `sortRows`. */
export type UnplacedSort = "cargo" | "pod" | "weight" | "id";
export type UnplacedGroupBy = "none" | "pod" | "type" | "size";

export interface UnplacedQuery {
  /** Free text over id, size, high-cube flag, type, POL, POD and weight. Empty = no filtering. */
  text: string;
  size: SizeFilter;
  type: TypeFilter;
  /** The "Fits bay NN" toggle: hide the rows whose size and parity cannot take a position in the bay
   * `ctx.baySlots` describes. Inert when no bay is claimed (`baySlots === null`) — the bay IS its
   * slots, so there is no second bay number here that could disagree with them. */
  fitsBay: boolean;
  sort: UnplacedSort;
  group: UnplacedGroupBy;
}

/** Unfiltered, ungrouped, plan order — the rendering this list had before P2, so acceptance script
 * step 1 ("The Unplaced section should read `Unplaced (20)`") stays true by construction. */
export const DEFAULT_UNPLACED_QUERY: UnplacedQuery = {
  text: "",
  size: "any",
  type: "any",
  fitsBay: false,
  sort: "cargo",
  group: "none",
};

export interface UnplacedRow {
  container: Container;
  /** Does this container's SIZE AND PARITY fit the filtered bay (see `bayFits`)? Always false when no
   * bay is filtered — there is no bay to be about. Shown per row, so the claim is on the row itself
   * rather than implied by a filter hiding things. */
  fitsBay: boolean;
}

export interface UnplacedGroup {
  key: string;
  /** Display label; `""` for the single group of an ungrouped query. */
  label: string;
  rows: UnplacedRow[];
}

export interface UnplacedResult {
  /** A partition of `ordered`: one unnamed group when grouping is off, else one per distinct value.
   * Collapsing is the component's state — the module always returns every row. */
  groups: UnplacedGroup[];
  /** The filtered rows in render order, flattened. `ordered.length === shown`. */
  ordered: UnplacedRow[];
  shown: number;
  /** The input length — what the header's denominator means. */
  total: number;
}

export interface UnplacedContext {
  /** POD locode -> rotation sequence (`plan.ports`), for the POD sort. Unknown POD sorts last. */
  podSequence: Record<string, number>;
  /** The filtered bay's own slots (`buildStowageModel(vessel).slots.filter(slotInBay…)`), or null when
   * no bay is filtered. **This IS the bay**: the claim is made about exactly the slots it describes,
   * so no second bay number can disagree with them. Passed in, not derived here — that sweep is the
   * caller's memo, keyed on vessel/bay, and typing must never re-run it. */
  baySlots: readonly SlotDef[] | null;
}

/** The bay filter's whole claim, in one place: "this container's size can take a position in this
 * bay" — `sizeFitsBay` (size + parity) and nothing else. Over-approximate BY DECISION: it ignores
 * whether any slot is free, so it can only ever show MORE rows than the engine would accept, never
 * fewer (the anti-divergence test proves it cannot hide a container `validSlotsFor` accepts there).
 * The exact variant measured ≈39 ms per recompute, after every drop (plan.md #2). */
function bayFits(container: Container, bayNumbers: readonly number[]): boolean {
  return bayNumbers.some((bay) => sizeFitsBay(container, bay));
}

/** The distinct bay numbers of the filtered bay's slots — `sizeFitsBay` reads `slot.bay` alone, so
 * collapsing a bay's ~240 slot defs to ≤3 numbers makes the per-row check O(#bays), not O(#slots). */
function distinctBays(slots: readonly SlotDef[]): number[] {
  const out: number[] = [];
  for (const slot of slots) if (!out.includes(slot.bay)) out.push(slot.bay);
  return out;
}

/** The searchable text of one row, weight included as a string so a numeric query finds a box by its
 * weight ("22.7") as well as by its id. Rebuilt per keystroke: 400 short templates is trivial, and a
 * prebuilt index would be one more structure to invalidate on every plan edit. */
function haystack(c: Container): string {
  return `${c.id} ${c.size} ${c.high_cube ? "hc high-cube" : ""} ${c.type} ${c.pol} ${c.pod} ${c.weight_t}`.toLowerCase();
}

/** Unknown pods last; the difference form stays safe for two of them (`Infinity - Infinity` is NaN). */
const podRank = (podSequence: Record<string, number>, pod: string): number =>
  podSequence[pod] ?? Number.MAX_SAFE_INTEGER;

/** `cargo` keeps the input order and sorts nothing — the default path allocates no array and runs no
 * comparator. `id` compares CODE UNITS, not `localeCompare`: collation is locale-dependent, which
 * would make the asserted order machine-specific. `.sort` is stable per spec, so equal keys keep
 * plan order (the "weight descending, stable" requirement). */
function sortRows(rows: UnplacedRow[], sort: UnplacedSort, podSequence: Record<string, number>): UnplacedRow[] {
  if (sort === "cargo") return rows;
  const out = [...rows];
  if (sort === "weight") out.sort((a, b) => b.container.weight_t - a.container.weight_t);
  else if (sort === "pod") {
    out.sort((a, b) => podRank(podSequence, a.container.pod) - podRank(podSequence, b.container.pod));
  } else {
    out.sort((a, b) => (a.container.id < b.container.id ? -1 : a.container.id > b.container.id ? 1 : 0));
  }
  return out;
}

/** Group order follows first appearance in the SORTED rows, so there is one ordering rule to learn
 * (the sort control) and grouping only partitions — a group-by with its own private ordering would
 * be a second, invisible rule. Groups whose rows were all filtered out simply do not exist. */
function groupRows(rows: UnplacedRow[], by: UnplacedGroupBy): UnplacedGroup[] {
  if (by === "none") return [{ key: "all", label: "", rows }];
  const groups: UnplacedGroup[] = [];
  const byKey = new Map<string, UnplacedGroup>();
  for (const row of rows) {
    const c = row.container;
    const key = by === "pod" ? c.pod : by === "type" ? c.type : c.size;
    let group = byKey.get(key);
    if (!group) {
      group = { key, label: by === "size" ? `${key}'` : key, rows: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.rows.push(row);
  }
  return groups;
}

/** Filter → sort → group, in that order, over containers already in plan order. Filter order (text,
 * size, type, bay) is cheapest-first and every step is a pure read of a container: nothing here
 * consults the plan, so no filter can encode a placement rule. */
export function queryUnplacedRows(
  containers: readonly Container[],
  query: UnplacedQuery,
  ctx: UnplacedContext,
): UnplacedResult {
  const needle = query.text.trim().toLowerCase();
  // Empty/absent slots = no bay claim at all, so nothing is marked and nothing is hidden by it: a bay
  // that holds no slots cannot make a size/parity claim about anything, and treating it as one would
  // empty the list with no explanation. The badge is computed whenever a bay IS claimed, ticked or
  // not — the tick only hides.
  const bayNumbers = ctx.baySlots?.length ? distinctBays(ctx.baySlots) : null;

  const rows: UnplacedRow[] = [];
  for (const container of containers) {
    if (needle && !haystack(container).includes(needle)) continue;
    if (query.size !== "any" && container.size !== query.size) continue;
    if (query.type !== "any" && container.type !== query.type) continue;
    const fitsBay = bayNumbers !== null && bayFits(container, bayNumbers);
    if (query.fitsBay && bayNumbers !== null && !fitsBay) continue;
    rows.push({ container, fitsBay });
  }
  const ordered = sortRows(rows, query.sort, ctx.podSequence);
  return { groups: groupRows(ordered, query.group), ordered, shown: ordered.length, total: containers.length };
}

/** Two forms on purpose, and the unfiltered one is byte-identical to the pre-P2 string:
 * `Unplaced (400)` answers "how much cargo is waiting", and the moment that stops being the
 * question the count must say so — `0 of 400` and `0` mean very different things to a planner.
 * Count equality IS the "is anything filtered" test: no filter hides rows without lowering `shown`,
 * and a query that happens to match everything hides nothing and should not claim otherwise. */
export function unplacedHeaderLabel(result: UnplacedResult): string {
  return result.shown === result.total
    ? `Unplaced (${result.total})`
    : `Unplaced (${result.shown} of ${result.total})`;
}

/**
 * The arrow-key step. `current` is the focused row's index in the RENDERED rows (what "next" means
 * on a wrapped chip list: next in document order, not the next chip to the right), or -1 when no row
 * is focused. Clamped at both ends; -1 is returned only when there is nothing to focus at all, so
 * callers can `focus()` after a `>= 0` check. From nothing focused a forward step lands on the first
 * row and a backward step on the last; Home/End are the same function from the two ends
 * (`nextRowIndex(-1, 1, n)` / `nextRowIndex(n, -1, n)`).
 */
export function nextRowIndex(current: number, delta: number, count: number): number {
  if (count <= 0) return -1;
  if (current < 0) return delta >= 0 ? 0 : count - 1;
  const next = current + delta;
  if (next < 0) return 0;
  return next > count - 1 ? count - 1 : next;
}
