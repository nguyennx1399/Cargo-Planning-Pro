import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { StowagePlan, Vessel } from "@/types/domain";
import { validSlotsFor } from "@/engine/placement/placeholders";
import { activeContainerId, usePlanStore } from "@/store/usePlanStore";

/**
 * The unplaced-cargo list — the drag SOURCE, and the entry point of the WCAG 2.5.7 single-pointer
 * path (Phase C). Extracted from Sidebar.tsx (which was over the 200-LOC rule) with its handlers
 * unchanged in behaviour:
 *
 *  - `mousedown` starts a drag (the ghost + placeholders appear, the tick follows the cursor);
 *  - `click` PICKs the container instead — no drag gesture anywhere. A `<button>` fires that click
 *    for Enter and Space too, so the keyboard and the pointer share the one handler, and a pick is
 *    placed by a second single click on a 3D placeholder or a highlighted bay-plan cell.
 *
 * The commit itself is NOT here: both triggers go through the one `commitPlacement` resolver (the
 * window-level release lives in Sidebar, which is mounted for a MOVE started in the 3D view as well).
 */
export function UnplacedCargoList({ vessel, plan }: { vessel: Vessel; plan: StowagePlan }) {
  const { draggingContainerId, pickedId, setDraggingContainer, setPicked } = usePlanStore(
    useShallow((s) => ({
      draggingContainerId: s.draggingContainerId,
      pickedId: s.pickedId,
      setDraggingContainer: s.setDraggingContainer,
      setPicked: s.setPicked,
    }))
  );
  const activeId = usePlanStore(activeContainerId);

  const unplaced = useMemo(
    () => plan.unplaced.map((id) => plan.containers.find((c) => c.id === id)).filter((c) => c !== undefined),
    [plan.unplaced, plan.containers]
  );

  const activeContainer = activeId ? plan.containers.find((c) => c.id === activeId) : undefined;
  // One sweep per gesture start — the same `validSlotsFor` the placeholder layer renders from, so
  // the count and the boxes can never disagree. Counts every valid position, including ones the
  // viewer filters (bay / deck toggles) are currently hiding.
  const validCount = useMemo(
    () => (activeContainer ? validSlotsFor(vessel, plan, activeContainer).length : 0),
    [vessel, plan, activeContainer]
  );

  if (unplaced.length === 0) return null;

  return (
    <section>
      <h2>Unplaced ({unplaced.length})</h2>
      <p className="muted small">
        {activeContainer
          ? `${validCount} valid position${validCount === 1 ? "" : "s"} for ${activeContainer.id}. Click a highlighted slot in 3D or the bay plan to place it there.`
          : "Click to pick a container, then click a slot in 3D or the bay plan. Or drag one onto the hull. Esc cancels."}
      </p>
      <div className="unplaced-list">
        {unplaced.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`unplaced-item${draggingContainerId === c.id ? " unplaced-item-dragging" : ""}${
              pickedId === c.id ? " unplaced-item-picked" : ""
            }`}
            aria-pressed={pickedId === c.id}
            title={`${c.id} — ${c.size}'${c.high_cube ? " HC" : ""} ${c.type}, ${c.weight_t} t`}
            // Left button only: a middle/right press must not start a placement gesture.
            onMouseDown={(e) => e.button === 0 && setDraggingContainer(c.id)}
            onClick={() => setPicked(c.id)}
          >
            {c.id} · {c.size}'{c.high_cube ? " HC" : ""}
          </button>
        ))}
      </div>
    </section>
  );
}
