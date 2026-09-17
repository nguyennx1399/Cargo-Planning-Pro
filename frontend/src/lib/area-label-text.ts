/**
 * area-label-text.ts — the ONE wording for what is written over a stowage area on the deck (Phase D,
 * requirements 1 and 3): the area's name plus the numbers that govern a drop in it, and the badge
 * that says whether the area is a real GA layout or an approximation. Pure — no three/react imports —
 * so the exact sentences the planner reads over the hull are asserted in a node test instead of
 * trusted to a screenshot.
 *
 * Requirement 3 (`"Hold 2 tank top · 20 t/m² · clear 14.6 m"`): rating AND clear height, in that
 * order, each present only when the area declares it. Phase B's draft showed the first one it found,
 * which silently hid the headroom on every rated area — the planner could not see why a tall item was
 * refused there.
 *
 * Requirement 1 (`"approximate — no GA layout"`): the badge. It deliberately names the SOURCE of the
 * number and not a quality score, so it cannot read as "this data is worse than the others" — it says
 * where the boundary came from. `area.source` is the only input; a `declared` area (one built from a
 * vessel's `*.stowage.json`) has no badge at all rather than a "measured" one, because there is
 * nothing to warn about.
 */
import type { StowageArea } from "@/engine/stowage-model";

/** The badge an approximate area carries. The exact string requirement 1 names. */
export const APPROXIMATE_AREA_BADGE = "approximate — no GA layout";

/** Two decimals, trailing zeros dropped. NOT cosmetic: the spec's own `maxHeight` values reach the
 * model with float noise after the metres/feet round-trip, so BBC's Hold 2 tank top renders
 * `clear 14.600000000000001 m` and the aft section `clear 3.8999999999999986 m` unrounded — digits
 * that look measured, are not, and would contradict the 14.6 m the vessel's own spec sheet states.
 * Two decimals is finer than any clearance a planner acts on. */
const decimal = (n: number): string => String(Math.round(n * 100) / 100);

/** The numbers that govern a drop in this area, in the order they are read: what the surface carries
 * (`loadRating`, t/m²), then how much headroom it has (`maxHeight`). A non-finite `maxHeight` is the
 * model's "declares no limit" (`Infinity`), never a real 0 m ceiling — the generic deck declares
 * neither number, so its title is its name alone and the badge carries the caveat. */
export function areaLabelTitle(area: StowageArea): string {
  const parts = [area.label];
  if (area.loadRating !== undefined) parts.push(`${decimal(area.loadRating)} t/m²`);
  if (Number.isFinite(area.maxHeight)) parts.push(`clear ${decimal(area.maxHeight)} m`);
  return parts.join(" · ");
}

/** The provenance badge, or null when the area came from the vessel's own GA data. */
export function areaLabelBadge(area: StowageArea): string | null {
  return area.source === "generic" ? APPROXIMATE_AREA_BADGE : null;
}
