import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import type { StowagePlan, Vessel } from "@/types/domain";
import { validSlotsFor } from "@/engine/placement/placeholders";
import { buildStowageModel } from "@/engine/stowage-model";
import { slotInBay } from "@/lib/drop-verdict";
import {
  DEFAULT_UNPLACED_QUERY, nextRowIndex, queryUnplacedRows, unplacedHeaderLabel,
} from "@/lib/unplaced-query";
import { Button } from "@/components/ui/button";
import { activeContainerId, usePlanStore } from "@/store/usePlanStore";
import { BAY_CAVEAT, UnplacedListControls } from "./UnplacedListControls";

/**
 * The unplaced-cargo list — the drag SOURCE, and the entry point of the WCAG 2.5.7 single-pointer
 * path (Phase C). Extracted from Sidebar.tsx (which was over the 200-LOC rule) with its handlers
 * unchanged:
 *
 *  - `mousedown` starts a drag (the ghost + placeholders appear, the tick follows the cursor);
 *  - `click` PICKs it instead — no drag gesture anywhere. A `<button>` fires that click for Enter and
 *    Space too, so the keyboard and the pointer share one handler, and a pick is placed by a second
 *    single click on a 3D placeholder or a highlighted bay-plan cell.
 *
 * The commit is NOT here: both triggers go through the one `commitPlacement` resolver (the
 * window-level release lives in Sidebar, which is mounted for a MOVE started in the 3D view too).
 *
 * P2 added bulk retrieval on top (400 unplaced rows on MV Demo Horizon): search, size/type/bay
 * filters, sort, grouping, arrow keys. That logic is the pure `lib/unplaced-query.ts`; this component
 * owns the query state, resolves the two memoised inputs the module cannot know (the bay's slots, the
 * POD sequence) and renders. Nothing here gates a drop — the filters decide what is SHOWN (D6).
 */
export function UnplacedCargoList({ vessel, plan }: { vessel: Vessel; plan: StowagePlan }) {
  const { draggingContainerId, pickedId, bayFilter, setDraggingContainer, setPicked } = usePlanStore(
    useShallow((s) => ({
      draggingContainerId: s.draggingContainerId,
      pickedId: s.pickedId,
      bayFilter: s.bayFilter,
      setDraggingContainer: s.setDraggingContainer,
      setPicked: s.setPicked,
    }))
  );
  const activeId = usePlanStore(activeContainerId);
  // The one owner of the query and of which groups are collapsed: the only vessel-specific input is
  // the bay, and that lives in the store (cleared on a vessel switch). Nothing is persisted.
  const [query, setQuery] = useState(DEFAULT_UNPLACED_QUERY);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set<string>());
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());

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

  // The bay filter's universe, resolved ONCE per (vessel, bay): the pure module takes the slots and
  // never sweeps the model, so typing cannot re-run this. `slotInBay` is the membership rule the 3D
  // layers use too — a 20' half belongs to its 40' parent, the only bay the selectors can name.
  const baySlots = useMemo(
    () => (bayFilter === null ? null : buildStowageModel(vessel).slots.filter((slot) => slotInBay(slot, bayFilter, vessel))),
    [vessel, bayFilter]
  );
  const podSequence = useMemo(() => Object.fromEntries(plan.ports.map((p) => [p.locode, p.sequence])), [plan.ports]);
  // The bay comes from the store, not the query: there is one bay selector in the app
  // (ViewOptionsPanel) and this list must agree with the 3D view at all times. The tick survives a
  // bay change — deliberately: the checkbox stays visible and relabelled, so the narrowing is never
  // silent, and Clear (or un-ticking) restores the full list.
  const result = useMemo(() => queryUnplacedRows(unplaced, query, { podSequence, baySlots }), [unplaced, query, podSequence, baySlots]);

  const clearAll = () => { setQuery(DEFAULT_UNPLACED_QUERY); setCollapsed(new Set()); };

  // The rows actually MOUNTED, in document order — what the arrow keys walk — plus each group's row
  // offset: the seam a focused header steps from, so arrows never land in a collapsed group (M1).
  const renderedIds: string[] = [];
  const seams = new Map<string, number>();
  for (const group of result.groups) {
    seams.set(group.key, renderedIds.length);
    if (!collapsed.has(group.key)) for (const row of group.rows) renderedIds.push(row.container.id);
  }

  /** ArrowUp/Down walk the rendered rows in document order (the list wraps, so there are no spatial
   * rows); Home/End are the jumps that matter over 400 rows. The search field lives OUTSIDE this
   * container, so it cannot be stolen from — nor can it steal these keys. */
  const onListKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    // `closest`, not the event target itself: a row's own badge span is not focusable today, but the
    // lookup must not depend on that staying true.
    const el = e.target as HTMLElement;
    const rowEl = el.closest<HTMLElement>("[data-container-id]");
    const headerEl = rowEl ? null : el.closest<HTMLElement>("[data-seam]");
    const arrow = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    const seam = headerEl ? Number(headerEl.dataset.seam) : -1;
    // A focused row steps from itself; a header steps from the seam in front of its own rows (Down
    // enters the group, Up leaves it upwards); -1 is the seam before the first group, -2 is no origin.
    const current = rowEl
      ? renderedIds.indexOf(rowEl.dataset.containerId ?? "")
      : seam >= 0 ? seam - (arrow < 0 ? 0 : 1) : -2;
    const next =
      e.key === "Home" ? nextRowIndex(-1, 1, renderedIds.length)
        : e.key === "End" ? nextRowIndex(renderedIds.length, -1, renderedIds.length)
          : arrow !== 0 && current >= -1 ? nextRowIndex(current, arrow, renderedIds.length)
            : -1;
    if (next < 0) return;
    e.preventDefault(); // focus() already scrolls the row into view; the browser must not scroll too
    rowRefs.current.get(renderedIds[next])?.focus();
  };

  if (unplaced.length === 0) return null;

  return (
    <section>
      <h2>{unplacedHeaderLabel(result)}</h2>
      <p className="muted small">
        {activeContainer
          ? `${validCount} valid position${validCount === 1 ? "" : "s"} for ${activeContainer.id}. Click a highlighted slot in 3D or the bay plan to place it there.`
          : "Click to pick a container, then click a slot in 3D or the bay plan. Or drag one onto the hull. Esc cancels."}
      </p>
      <UnplacedListControls
        query={query}
        bay={bayFilter}
        onChange={(patch) => setQuery((prev) => ({ ...prev, ...patch }))}
        onClear={clearAll}
      />
      <div className="unplaced-list" onKeyDown={onListKeyDown}>
        {result.shown === 0 && (
          <p className="unplaced-nomatch">
            No container matches.{" "}
            <Button variant="link" size="xs" onClick={clearAll}>Clear filters</Button>
          </p>
        )}
        {result.groups.map((group) => (
          <div className="unplaced-group" key={group.key}>
            {query.group !== "none" && (
              <button
                type="button"
                className="unplaced-groupheader"
                data-seam={seams.get(group.key)}
                aria-expanded={!collapsed.has(group.key)}
                onClick={(e) => {
                  // Focus the header explicitly: Safari does not focus a button on click, so without
                  // this a collapse started from a row would drop focus to <body> and every arrow
                  // key would go silent (review M1).
                  e.currentTarget.focus();
                  setCollapsed((prev) => {
                    const next = new Set(prev);
                    if (!next.delete(group.key)) next.add(group.key);
                    return next;
                  });
                }}
              >
                <span>{group.label}</span>
                <span className="unplaced-groupcount">{group.rows.length}</span>
              </button>
            )}
            {!collapsed.has(group.key) && (
              <div className="unplaced-rows">
                {group.rows.map((row) => (
                  <button
                    key={row.container.id}
                    type="button"
                    data-container-id={row.container.id}
                    ref={(el) => { if (el) rowRefs.current.set(row.container.id, el); else rowRefs.current.delete(row.container.id); }}
                    className={`unplaced-item${draggingContainerId === row.container.id ? " unplaced-item-dragging" : ""}${
                      pickedId === row.container.id ? " unplaced-item-picked" : ""
                    }`}
                    aria-pressed={pickedId === row.container.id}
                    title={`${row.container.id} — ${row.container.size}'${row.container.high_cube ? " HC" : ""} ${row.container.type}, ${row.container.weight_t} t`}
                    // Left button only: a middle/right press must not start a placement gesture.
                    onMouseDown={(e) => e.button === 0 && setDraggingContainer(row.container.id)}
                    onClick={() => setPicked(row.container.id)}
                  >
                    {row.container.id} · {row.container.size}'{row.container.high_cube ? " HC" : ""}
                    {!!baySlots?.length && (
                      // The claim, on the row rather than implied by a filter hiding things, gated on
                      // the same thing the filter is: a bay that makes no claim badges nothing. The
                      // `title` is the honest half — size and parity, not a free slot.
                      <span
                        className={`unplaced-fit${row.fitsBay ? "" : " unplaced-nofit"}`}
                        title={BAY_CAVEAT}
                      >
                        {row.fitsBay ? "fits" : "no fit"} {String(bayFilter).padStart(2, "0")}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
