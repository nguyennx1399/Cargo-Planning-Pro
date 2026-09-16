import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { Container, DeckLevel, StackSpec, StowagePlan, Vessel } from "@/types/domain";
import { usePlanStore, type ColorMode } from "@/store/usePlanStore";
import { containerColor, podColorMap, HIGHLIGHT } from "@/lib/colors";
import { visiblePlacements } from "@/engine/playback-slice";

// Fixed column width (px) shared by the cell grid, row labels, and weight bars, so all three
// stay visually aligned. Using a fixed size instead of 1fr keeps the whole bay plan compact for
// a quick overview instead of stretching cells to fill the panel's full width.
const CELL_PX = 14;

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
  // Built together in one pass: containerAt feeds the grid cells, weightByRow feeds the
  // port/starboard weight-distribution strip (E3-03d) below it.
  const { containerAt, weightByRow } = useMemo(() => {
    const containerAt = new Map<string, Container>(); // key `${row}:${tier}`
    const weightByRow = new Map<number, number>();
    for (const p of visiblePlacements(plan.placements, s.playbackCount)) {
      if (p.slot.bay !== s.bay) continue;
      const c = byId.get(p.container_id);
      if (!c) continue;
      containerAt.set(`${p.slot.row}:${p.slot.tier}`, c);
      weightByRow.set(p.slot.row, (weightByRow.get(p.slot.row) ?? 0) + c.weight_t);
    }
    return { containerAt, weightByRow };
  }, [plan.placements, s.playbackCount, s.bay, byId]);
  // Union of rows across both deck levels, port -> starboard — shared column basis for both
  // DeckBlocks and the weight strip below them, so a given row lines up vertically everywhere.
  const bayRows = useMemo(
    () => vessel.rows.filter((r) => vessel.stacks.some((st) => st.bay === s.bay && st.row === r)),
    [vessel.stacks, vessel.rows, s.bay]
  );

  if (s.bay === null) {
    return (
      <div className="bayplan-placeholder">
        <strong>Bay plan</strong>
        <span>Pick a bay to see its cross-section. {vessel.bays.length} bays on this vessel.</span>
      </div>
    );
  }

  const containersHere = [...containerAt.values()];
  const totalWeight = containersHere.reduce((sum, c) => sum + c.weight_t, 0);

  return (
    <div className="bayplan-grid">
      <div className="bayplan-header">
        <strong>Bay {String(s.bay).padStart(2, "0")}</strong>
        <span className="muted small">{containersHere.length} containers · {totalWeight.toFixed(1)} t</span>
      </div>
      <DeckBlock
        deck="on" bay={s.bay} columns={bayRows} vessel={vessel} containerAt={containerAt} colorMode={s.colorMode} pods={pods}
        hoveredId={s.hoveredId} selectedId={s.selectedId} setHovered={s.setHovered} setSelected={s.setSelected}
      />
      <div className="bayplan-hatchline" />
      <DeckBlock
        deck="under" bay={s.bay} columns={bayRows} vessel={vessel} containerAt={containerAt} colorMode={s.colorMode} pods={pods}
        hoveredId={s.hoveredId} selectedId={s.selectedId} setHovered={s.setHovered} setSelected={s.setSelected}
      />
      <WeightDistribution rows={bayRows} weightByRow={weightByRow} />
    </div>
  );
}

/** Port/starboard weight profile for the bay (E3-03d) — one bar per row, height proportional to
 * that row's total container weight, so an imbalance reads visually left-to-right/right-to-left. */
function WeightDistribution({ rows, weightByRow }: { rows: number[]; weightByRow: Map<number, number> }) {
  if (rows.length === 0) return null;
  const maxWeight = Math.max(1, ...rows.map((r) => weightByRow.get(r) ?? 0));

  return (
    <div className="bayplan-weightdist">
      <div className="bayplan-deck-label muted small">Weight by row (port ↔ starboard)</div>
      <div className="bayplan-weightdist-bars" style={{ gridTemplateColumns: `repeat(${rows.length}, ${CELL_PX}px)` }}>
        {rows.map((r) => {
          const w = weightByRow.get(r) ?? 0;
          return (
            <div key={r} className="bayplan-weightdist-col" title={`Row ${r}: ${w.toFixed(1)} t`}>
              <div className="bayplan-weightdist-bar" style={{ height: `${Math.round((w / maxWeight) * 100)}%` }} />
            </div>
          );
        })}
      </div>
      <div className="bayplan-row-labels" style={{ gridTemplateColumns: `repeat(${rows.length}, ${CELL_PX}px)` }}>
        {rows.map((r) => <span key={r} className="muted">{r}</span>)}
      </div>
    </div>
  );
}

interface DeckBlockProps {
  deck: DeckLevel;
  bay: number;
  columns: number[];
  vessel: Vessel;
  containerAt: Map<string, Container>;
  colorMode: ColorMode;
  pods: Record<string, string>;
  hoveredId: string | null;
  selectedId: string | null;
  setHovered: (id: string | null) => void;
  setSelected: (id: string | null) => void;
}

/** One deck level's grid (rows across, tiers up). Both deck levels share the same `columns`
 * (not just the rows that happen to have a stack on THIS deck) so a given row's column lines up
 * vertically between the on-deck and under-deck blocks — row 8 sits directly above row 8 even
 * though under-deck commonly has fewer physical rows than on-deck (see demo-container-vessel.ts:
 * 10 on-deck rows vs 8 under-deck). Rows absent on this deck render as blank columns instead of
 * being dropped, which would otherwise stretch the remaining columns and break that alignment. */
function DeckBlock({ deck, bay, columns, vessel, containerAt, colorMode, pods, hoveredId, selectedId, setHovered, setSelected }: DeckBlockProps) {
  const byRow = useMemo(() => {
    const inBay = vessel.stacks.filter((st) => st.bay === bay && st.deck === deck);
    return new Map<number, StackSpec>(inBay.map((st) => [st.row, st]));
  }, [vessel.stacks, bay, deck]);

  if (byRow.size === 0) return null;

  const maxTierCount = Math.max(1, ...[...byRow.values()].map((st) => st.tiers.length));

  return (
    <div className={`bayplan-deck bayplan-deck-${deck}`}>
      <div className="bayplan-deck-label muted small">{deck === "on" ? "On deck" : "Under deck"}</div>
      <div className="bayplan-cells" style={{ gridTemplateColumns: `repeat(${columns.length}, ${CELL_PX}px)` }}>
        {Array.from({ length: maxTierCount }, (_, tierRow) =>
          columns.map((row) => {
            const st = byRow.get(row);
            if (!st) return <div key={`${row}-void-${tierRow}`} className="bayplan-cell-blank" />;
            // Descending tier = visually top-to-bottom: for both deck levels, the tier value
            // nearest the hatch line is the lowest on-deck tier / highest under-deck tier
            // (see tierCenterY in geometry.ts).
            const tiers = [...st.tiers].sort((a, b) => b - a);
            const tier = tiers[tierRow];
            if (tier === undefined) return <div key={`${row}-empty-${tierRow}`} className="bayplan-cell-blank" />;
            const container = containerAt.get(`${row}:${tier}`);
            const isHovered = container && container.id === hoveredId;
            const isSelected = container && container.id === selectedId;
            const fill = container
              ? isSelected ? HIGHLIGHT.selected : isHovered ? HIGHLIGHT.hover : containerColor(container, colorMode, pods)
              : undefined;
            return (
              <div
                key={`${row}-${tier}`}
                className={container ? "bayplan-cell bayplan-cell-filled" : "bayplan-cell"}
                style={fill ? { background: fill } : undefined}
                title={container ? `Row ${row}, tier ${tier} — ${container.id}` : `Row ${row}, tier ${tier} — empty`}
                onMouseEnter={() => container && setHovered(container.id)}
                onMouseLeave={() => container && setHovered(null)}
                onClick={() => setSelected(container ? container.id : null)}
              />
            );
          })
        )}
      </div>
      <div className="bayplan-row-labels" style={{ gridTemplateColumns: `repeat(${columns.length}, ${CELL_PX}px)` }}>
        {columns.map((row) => (
          <span key={row} className="muted">{byRow.has(row) ? row : ""}</span>
        ))}
      </div>
    </div>
  );
}
