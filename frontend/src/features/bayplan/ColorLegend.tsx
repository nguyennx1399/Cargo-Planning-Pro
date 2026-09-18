/**
 * ColorLegend.tsx — the key for the sheet's cell colours in the current colour mode, with counts of the
 * placed boxes (all-bay overview plan, phase 03). Colours and counts come from `colorLegend`, which uses
 * the cells' own colour functions, so a chip always matches a cell.
 */
import { useMemo } from "react";
import type { Container, PortCall } from "@/types/domain";
import type { ColorMode } from "@/store/usePlanStore";
import { colorLegend } from "@/lib/bay-sheet";

const TITLE: Record<ColorMode, string> = { pod: "Port of discharge", type: "Type", weight: "Weight" };

export function ColorLegend({ boxes, mode, pods, ports }: {
  boxes: readonly Container[]; mode: ColorMode; pods: Record<string, string>; ports: readonly PortCall[];
}) {
  const entries = useMemo(() => colorLegend(boxes, mode, pods, ports), [boxes, mode, pods, ports]);
  return (
    <div className="legend-chips" aria-label={`Colour key: ${TITLE[mode]}`}>
      <span className="muted small">{TITLE[mode]}</span>
      {entries.map((e) => (
        <span key={e.label} className="legend-chip">
          <i style={{ background: e.color }} />
          {e.label} <span className="muted">{e.count}</span>
        </span>
      ))}
    </div>
  );
}
