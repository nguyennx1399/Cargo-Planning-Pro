import { useMemo } from "react";
import type { Container, DeckLevel, Slot, StackSpec, Vessel } from "@/types/domain";
import type { ColorMode } from "@/store/usePlanStore";
import { containerColor, HIGHLIGHT } from "@/lib/colors";

/** Fixed column width (px) shared by the cell grid, row labels, and weight bars, so all three
 * stay visually aligned (see BayPlanView). */
const CELL_PX = 14;

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
  /** `bay|row|tier` keys of the slots the container in hand may go in (the drag's valid set), or
   * null when nothing is in hand — no drop affordance then. Keys are the stowage model's own. */
  validKeys: ReadonlySet<string> | null;
  /** A cell click; the parent owns the decision (place the container in hand, else select). One
   * handler for both decks, so the on-deck and under-deck halves cannot behave differently. */
  onCellClick: (slot: Slot, container: Container | undefined) => void;
}

/** One deck level's grid (rows across, tiers up). Both deck levels share the same `columns`
 * (not just the rows that happen to have a stack on THIS deck) so a given row's column lines up
 * vertically between the on-deck and under-deck blocks — row 8 sits directly above row 8 even
 * though under-deck commonly has fewer physical rows than on-deck (see demo-container-vessel.ts:
 * 10 on-deck rows vs 8 under-deck). Rows absent on this deck render as blank columns instead of
 * being dropped, which would otherwise stretch the remaining columns and break that alignment. */
export function DeckBlock({ deck, bay, columns, vessel, containerAt, colorMode, pods, hoveredId, selectedId, setHovered, validKeys, onCellClick }: DeckBlockProps) {
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
            // A valid drop target is OUTLINED (styles.css `.bayplan-cell-valid`), not filled: a
            // filled cell already means "a container is here", and the POD palette itself contains
            // greens — an outline can never be confused with cargo.
            const isValidTarget = !container && (validKeys?.has(`${bay}|${row}|${tier}`) ?? false);
            const fill = container
              ? isSelected ? HIGHLIGHT.selected : isHovered ? HIGHLIGHT.hover : containerColor(container, colorMode, pods)
              : undefined;
            return (
              <div
                key={`${row}-${tier}`}
                className={container ? "bayplan-cell bayplan-cell-filled" : isValidTarget ? "bayplan-cell bayplan-cell-valid" : "bayplan-cell"}
                style={fill ? { background: fill } : undefined}
                title={
                  container ? `Row ${row}, tier ${tier} — ${container.id}`
                  : isValidTarget ? `Row ${row}, tier ${tier} — valid position, click to place`
                  : `Row ${row}, tier ${tier} — empty`
                }
                onMouseEnter={() => container && setHovered(container.id)}
                onMouseLeave={() => container && setHovered(null)}
                onClick={() => onCellClick({ bay, row, tier }, container)}
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
