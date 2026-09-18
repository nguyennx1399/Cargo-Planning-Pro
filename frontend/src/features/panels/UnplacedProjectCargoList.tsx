import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { BreakbulkCargo, StowagePlan, Vessel } from "@/types/domain";
import { freeRegionsFor } from "@/engine/placement/placeholders";
import { findFreeSpace } from "@/engine/placement/area-free-space";
import { buildStowageModel } from "@/engine/stowage-model";
import { handFitsInText } from "@/lib/area-fit-hint";
import { usePlanStore } from "@/store/usePlanStore";
import { removeCustomCargoFromPlan } from "@/store/custom-cargo-in-plan";

/** One item's answer to "where can this go at all": the areas whose own rect/height/rating admit it
 * (spec §4.6). Deliberately NOT a promise that a drop succeeds anywhere in them — occupancy and
 * keep-outs are the per-pose ghost's job — so the row says "fits in", never "will place". */
interface CargoRow {
  item: BreakbulkCargo;
  fitsIn: string[];
  /** Phase 03: did the free-space scan find anywhere this item could stand right now? A row can
   * `fitsIn` two areas and still have nowhere to go, which is what the old badge hid. */
  hasFreeSpace: boolean;
  /** What refused the most candidates when nothing was found — the engine's own sentence. */
  blocker: string | null;
  /** Why nothing fits, when nothing does: the first area-fit reason, the engine's own sentence. */
  whyNot: string | null;
}

/**
 * The unplaced project-cargo list — the drag SOURCE for breakbulk, and the entry point of the WCAG
 * 2.5.7 single-pointer path, exactly like `UnplacedCargoList` is for containers:
 *
 *  - `mousedown` starts a drag (the ghost + area placeholders appear under the cursor);
 *  - `click` PICKs it instead — no drag gesture anywhere. A `<button>` fires that click for Enter and
 *    Space too, so the keyboard and the pointer share one handler, and a pick is placed by a second
 *    single click on an area in 3D.
 *
 * Both go into the ONE hand field (`setHand`), which is what makes them mutually exclusive with a
 * container gesture by construction rather than by a check.
 *
 * The "fits in" hint is `freeRegionsFor`'s `feasible` set — the SAME call the 3D placeholder layer
 * makes, so the label and the drawn areas can never disagree. It is a swipe per row (one predicate per
 * area) memoised on the plan, i.e. once per mutation, like every other engine sweep in this panel
 * column; it is deliberately not per pointer move.
 *
 * The same answer is repeated for the item IN HAND (requirement 2), which is why it is computed for
 * that item too: a dragged item is usually still in `plan.breakbulk_placements` until it lands, so it
 * is absent from the row list above and would otherwise lose its hint exactly while the planner is
 * deciding where to put it. That second sweep is memoised on the hand id and the plan — one per
 * GESTURE, never per pointer move.
 */
export function UnplacedProjectCargoList({ vessel, plan }: { vessel: Vessel; plan: StowagePlan }) {
  // The row's own state comes from the ONE hand field, not from the container-shaped projection: a
  // project-cargo item never fills `draggingContainerId`/`pickedId`, so reading those would leave every
  // row looking untouched while one of them is in hand.
  const { hand, handMode, setHand, customCargo } = usePlanStore(
    useShallow((s) => ({
      hand: s.inHand,
      handMode: s.handMode,
      setHand: s.setHand,
      customCargo: s.customCargo,
    })),
  );
  // Only the planner's own items can be removed: the demo set is fixture data, and deleting from it
  // would desync the list from the plan the demo builder produces on the next rebuild.
  const customIds = new Set(customCargo.map((c) => c.id));

  const rows = useMemo<CargoRow[]>(() => {
    const placed = new Set(plan.breakbulk_placements.map((p) => p.cargo_id));
    const model = buildStowageModel(vessel);
    return plan.breakbulk_cargo
      .filter((c) => !placed.has(c.id))
      .map((item) => {
        const regions = freeRegionsFor(vessel, plan, item);
        const feasible = regions.filter((r) => r.feasible);
        // Phase 03: "fits in: weather deck" is about whether the item BELONGS there, and says nothing
        // about whether the ground is still free — on the loaded demo plan every row listed two areas
        // while every pose in them was refused. The scan answers the second question; it is one call
        // per row per plan mutation (measured: 6 rows = 3105 predicate calls = 15 ms), never per
        // pointer move, and it early-exits the moment it finds a spot.
        const scan = findFreeSpace(model, plan, item, feasible.map((r) => r.area), vessel);
        return {
          item,
          fitsIn: feasible.map((r) => r.area.label),
          hasFreeSpace: scan.areaId !== null,
          blocker: scan.blocker?.message ?? null,
          whyNot: regions.find((r) => r.reason)?.reason?.message ?? null,
        };
      });
  }, [vessel, plan]);

  // The hand's own "fits in" answer. Keyed on the hand ID and the plan, so it is one sweep per
  // gesture start (and one per plan mutation) — the requirement explicitly forbids a per-move sweep,
  // and `hand`'s identity only changes when `setHand` is called, i.e. at a gesture boundary.
  const handItem = useMemo(
    () => (hand?.kind === "breakbulk" ? plan.breakbulk_cargo.find((c) => c.id === hand.id) ?? null : null),
    [plan.breakbulk_cargo, hand],
  );
  // The hand's own answer, and the only place the FREE-SPACE scan runs (Phase 03): "fits in: …" is
  // about whether the item belongs in an area, not about whether the ground is still free, and on a
  // loaded ship those differ — every pose can be refused while the hint lists two areas. One scan per
  // gesture (the memo key is the hand item + plan), never per pointer move; the early exit makes the
  // "there is room" case cheap.
  const handFitsIn = useMemo(() => {
    if (!handItem) return null;
    const feasible = freeRegionsFor(vessel, plan, handItem).filter((r) => r.feasible);
    const labels = feasible.map((r) => r.area.label);
    const scan = findFreeSpace(buildStowageModel(vessel), plan, handItem, feasible.map((r) => r.area), vessel);
    return handFitsInText(labels, { found: scan.areaId !== null, blocker: scan.blocker?.message ?? null });
  }, [vessel, plan, handItem]);

  if (rows.length === 0) return null;

  const handId = hand?.kind === "breakbulk" ? hand.id : null;
  const isPicked = (id: string) => handId === id && handMode === "pick";

  return (
    <section>
      <h2>Unplaced project cargo</h2>
      <p className="muted small">
        {handId
          ? `${handId} is in hand${handFitsIn ? ` — ${handFitsIn}` : ""}. Click the deck where it should sit — R rotates it, Esc cancels.`
          : "Click to pick a project-cargo item, then click the deck where it should sit. Or drag one onto the ship. An item already on board: click to select it, click again to pick it up. R rotates, Esc cancels."}
      </p>
      <div className="unplaced-list">
        {rows.map(({ item, fitsIn, hasFreeSpace, blocker, whyNot }) => (
          <button
            key={item.id}
            type="button"
            data-cargo-id={item.id}
            className={`unplaced-item${handId === item.id && handMode === "drag" ? " unplaced-item-dragging" : ""}${
              isPicked(item.id) ? " unplaced-item-picked" : ""
            }`}
            aria-pressed={isPicked(item.id)}
            title={`${item.id} — ${item.length_m} × ${item.width_m} m, ${item.height_m} m tall, ${item.weight_t} t`}
            // Left button only: a middle/right press must not start a placement gesture.
            onMouseDown={(e) => e.button === 0 && setHand({ kind: "breakbulk", id: item.id }, "drag")}
            onClick={() => setHand({ kind: "breakbulk", id: item.id }, "pick")}
          >
            {item.id} · {item.length_m} × {item.width_m} m · {item.weight_t} t
            {/* Stacking: say which items can carry others, and how much, before the planner drags. */}
            {item.stacking &&
              ` · ${item.category === "support_frame" ? "frame" : "stackable"} ≤ ${item.stacking.max_top_load_t} t`}
            {customIds.has(item.id) && (
              <span
                role="button"
                tabIndex={0}
                aria-label={`Remove ${item.id}`}
                className="unplaced-remove"
                // The row itself is a pick/drag source, so this must not reach it — a click meant to
                // delete an item would otherwise also take it in hand.
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  removeCustomCargoFromPlan(item.id);
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.stopPropagation();
                  e.preventDefault();
                  removeCustomCargoFromPlan(item.id);
                }}
              >
                ×
              </span>
            )}
            <span
              className={`unplaced-fit${fitsIn.length === 0 || !hasFreeSpace ? " unplaced-nofit" : ""}`}
              title={(fitsIn.length === 0 ? whyNot : blocker) ?? undefined}
            >
              {handFitsInText(fitsIn, { found: hasFreeSpace, blocker: null })}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
