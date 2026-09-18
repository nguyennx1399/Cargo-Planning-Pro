/**
 * custom-cargo-input.ts — turning what a planner typed into a `BreakbulkCargo`, or into the reasons it
 * cannot be one.
 *
 * Pure and separate from the form so the rules are node-testable and the component only renders: the
 * form is allowed to change shape without anyone re-deciding what a valid piece of cargo is.
 *
 * WHAT IT GUARDS, and why each one:
 *  - every dimension parses as a number and is > 0 — a zero-width item has no footprint, and the
 *    placement rules would silently accept it everywhere;
 *  - nothing is longer or wider than the vessel itself — a 200 m "item" is a typo, and letting it
 *    through produces a scene object bigger than the ship and a "nothing fits" answer that reads as a
 *    bug;
 *  - weight > 0, because it feeds the deck-rating and stability sums;
 *  - `kg_above_base_m` (centre of gravity above its own base) defaults to HALF THE HEIGHT but stays
 *    editable and must land inside [0, height]. The domain type's own comment warns this is "NOT always
 *    height_m/2" — a nacelle is bottom-heavy — so the default is a starting point, never a fact;
 *  - the id is unique, because every gesture, placement and verdict is keyed by it.
 */
import type { BreakbulkCargo, Vessel } from "@/types/domain";

export interface CustomCargoFields {
  name: string;
  length: string;
  width: string;
  height: string;
  weight: string;
  /** Centre of gravity above the item's own base. Blank = half the height. */
  kg?: string;
}

export type CustomCargoErrors = Partial<Record<keyof CustomCargoFields, string>>;

export type CustomCargoParse =
  | { ok: true; item: BreakbulkCargo }
  | { ok: false; errors: CustomCargoErrors };

/** Upper bound on height: taller than this and it is a typo, not cargo. Deck clear heights are checked
 * for real by `canPlaceBreakbulk`; this only stops absurd input reaching the scene. */
const MAX_HEIGHT_M = 60;

const positiveNumber = (raw: string): number | null => {
  const value = Number(raw.trim());
  return Number.isFinite(value) && value > 0 ? value : null;
};

/** `CUSTOM-1`, `CUSTOM-2`, … — the first index not already taken, so removing one and adding another
 * cannot resurrect a live id. */
export function nextCustomCargoId(existing: readonly { id: string }[]): string {
  const taken = new Set(existing.map((c) => c.id));
  for (let n = 1; ; n++) {
    const id = `CUSTOM-${n}`;
    if (!taken.has(id)) return id;
  }
}

export function parseCustomCargo(
  fields: CustomCargoFields,
  vessel: Vessel,
  existing: readonly { id: string }[],
): CustomCargoParse {
  const errors: CustomCargoErrors = {};

  const length = positiveNumber(fields.length);
  const width = positiveNumber(fields.width);
  const height = positiveNumber(fields.height);
  const weight = positiveNumber(fields.weight);

  if (length === null) errors.length = "Length must be a number greater than 0";
  else if (length > vessel.length_m) errors.length = `Longer than the vessel (${vessel.length_m} m)`;

  if (width === null) errors.width = "Width must be a number greater than 0";
  else if (width > vessel.beam_m) errors.width = `Wider than the vessel's beam (${vessel.beam_m} m)`;

  if (height === null) errors.height = "Height must be a number greater than 0";
  else if (height > MAX_HEIGHT_M) errors.height = `Taller than ${MAX_HEIGHT_M} m — check the figure`;

  if (weight === null) errors.weight = "Weight must be a number greater than 0";

  // CoG is only meaningful once the height parsed; reporting it against a broken height would be noise.
  let kgAboveBase = height === null ? 0 : height / 2;
  if (fields.kg !== undefined && fields.kg.trim() !== "" && height !== null) {
    const kg = Number(fields.kg.trim());
    if (!Number.isFinite(kg) || kg < 0 || kg > height) {
      errors.kg = `Centre of gravity must be between 0 and the height (${height} m)`;
    } else {
      kgAboveBase = kg;
    }
  }

  const name = fields.name.trim();
  if (name && existing.some((c) => c.id === name)) errors.name = `"${name}" is already used`;

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    item: {
      id: name || nextCustomCargoId(existing),
      category: "general",
      length_m: length as number,
      width_m: width as number,
      height_m: height as number,
      weight_t: weight as number,
      kg_above_base_m: kgAboveBase,
      // POL/POD drive discharge-order checks only; a hand-sketched item has no voyage legs yet, and the
      // rules treat an empty string as "no port given" (same as the demo's own unset fields).
      pol: "",
      pod: "",
    },
  };
}
