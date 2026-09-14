import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { Container, DeckLevel, StackSpec, StowagePlan, Vessel } from "@/types/domain";
import { usePlanStore, type ColorMode } from "@/store/usePlanStore";
import { containerColor, podColorMap, HIGHLIGHT } from "@/lib/colors";
import { visiblePlacements } from "@/engine/playback-slice";

/**
 * 2D bay plan (cross-section of one bay, rows across, tiers up) — the planner's main working
 * view. Reuses the same colorMode/paletteMode/selection state as the 3D viewer (usePlanStore) so
 * clicking/hovering a cell here highlights the matching container in 3D and vice versa.
 * TODO(phase-2): drag & drop to move/swap containers -> POST /api/validate.
 */
export function BayPlanView({ vessel, plan }: { vessel: Vessel; plan: StowagePlan }) {
  const s = usePlanStore(
    useShallow((state) => ({
      bay: state.bayFilter,
      colorMode: state.colorMode,
      paletteMode: state.paletteMode,
      playbackCount: state.playbackCount,
      hoveredId: state.hoveredId,
      selectedId: state.selectedId,
      setHovered: state.setHovered,
      setSelected: state.setSelected,
    }))
  );

  const pods = useMemo(() => podColorMap(plan.ports, s.paletteMode), [plan.ports, s.paletteMode]);

  const byId = useMemo(() => new Map(plan.containers.map((c) => [c.id, c])), [plan.containers]);
  const containerAt = useMemo(() => {
    const m = new Map<string, Container>(); // key `${row}:${tier}`
    for (const p of visiblePlacements(plan.placements, s.playbackCount)) {
      if (p.slot.bay !== s.bay) continue;
      const c = byId.get(p.container_id);
      if (c) m.set(`${p.slot.row}:${p.slot.tier}`, c);
    }
    return m;
  }, [plan.placements, s.playbackCount, s.bay, byId]);

  if (s.bay === null) {
    return (
      <div className="bayplan-placeholder">
        <strong>Bay plan</strong>
        <span>Pick a bay to see its cross-section. {vessel.bays.length} bays on this vessel.</span>
      </div>
    );
  }

  const count = [...containerAt.values()].length;

  return (
    <div className="bayplan-grid">
      <strong>Bay {String(s.bay).padStart(2, "0")}</strong> <span className="muted small">{count} containers</span>
      <DeckBlock
        deck="on" bay={s.bay} vessel={vessel} containerAt={containerAt} colorMode={s.colorMode} pods={pods}
        hoveredId={s.hoveredId} selectedId={s.selectedId} setHovered={s.setHovered} setSelected={s.setSelected}
      />
      <div className="bayplan-hatchline" />
      <DeckBlock
        deck="under" bay={s.bay} vessel={vessel} containerAt={containerAt} colorMode={s.colorMode} pods={pods}
        hoveredId={s.hoveredId} selectedId={s.selectedId} setHovered={s.setHovered} setSelected={s.setSelected}
      />
    </div>
  );
}

interface DeckBlockProps {
  deck: DeckLevel;
  bay: number;
  vessel: Vessel;
  containerAt: Map<string, Container>;
  colorMode: ColorMode;
  pods: Record<string, string>;
  hoveredId: string | null;
  selectedId: string | null;
  setHovered: (id: string | null) => void;
  setSelected: (id: string | null) => void;
}

/** One deck level's grid (rows across, tiers up). On-deck and under-deck are rendered as
 * separate grids — real vessels commonly have different row counts per deck level (see
 * demo-container-vessel.ts: 10 on-deck rows vs 8 under-deck) — rather than forcing one shared
 * column layout that wouldn't line up correctly. */
function DeckBlock({ deck, bay, vessel, containerAt, colorMode, pods, hoveredId, selectedId, setHovered, setSelected }: DeckBlockProps) {
  const stacksByRow = useMemo(() => {
    const inBay = vessel.stacks.filter((st) => st.bay === bay && st.deck === deck);
    const byRow = new Map<number, StackSpec>(inBay.map((st) => [st.row, st]));
    // vessel.rows is documented port -> starboard; keep only rows that actually exist on this deck.
    return vessel.rows.filter((r) => byRow.has(r)).map((r) => byRow.get(r)!);
  }, [vessel.stacks, vessel.rows, bay, deck]);

  if (stacksByRow.length === 0) return null;

  // Descending tier = visually top-to-bottom: for both deck levels, the tier value nearest the
  // hatch line is the lowest on-deck tier / highest under-deck tier (see tierCenterY in geometry.ts).
  const tiersByRow = stacksByRow.map((st) => [...st.tiers].sort((a, b) => b - a));
  const maxTierCount = Math.max(...tiersByRow.map((t) => t.length));

  return (
    <div className={`bayplan-deck bayplan-deck-${deck}`}>
      <div className="bayplan-deck-label muted small">{deck === "on" ? "On deck" : "Under deck"}</div>
      <div className="bayplan-cells" style={{ gridTemplateColumns: `repeat(${stacksByRow.length}, 1fr)` }}>
        {Array.from({ length: maxTierCount }, (_, tierRow) =>
          stacksByRow.map((st, col) => {
            const tier = tiersByRow[col][tierRow];
            if (tier === undefined) return <div key={`${st.row}-empty-${tierRow}`} className="bayplan-cell-blank" />;
            const container = containerAt.get(`${st.row}:${tier}`);
            const isHovered = container && container.id === hoveredId;
            const isSelected = container && container.id === selectedId;
            const fill = container
              ? isSelected ? HIGHLIGHT.selected : isHovered ? HIGHLIGHT.hover : containerColor(container, colorMode, pods)
              : undefined;
            return (
              <div
                key={`${st.row}-${tier}`}
                className={container ? "bayplan-cell bayplan-cell-filled" : "bayplan-cell"}
                style={fill ? { background: fill } : undefined}
                title={container ? `Row ${st.row}, tier ${tier} — ${container.id}` : `Row ${st.row}, tier ${tier} — empty`}
                onMouseEnter={() => container && setHovered(container.id)}
                onMouseLeave={() => container && setHovered(null)}
                onClick={() => setSelected(container ? container.id : null)}
              />
            );
          })
        )}
      </div>
      <div className="bayplan-row-labels" style={{ gridTemplateColumns: `repeat(${stacksByRow.length}, 1fr)` }}>
        {stacksByRow.map((st) => (
          <span key={st.row} className="muted">{st.row}</span>
        ))}
      </div>
    </div>
  );
}
