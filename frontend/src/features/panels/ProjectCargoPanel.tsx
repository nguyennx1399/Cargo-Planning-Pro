import type { StowagePlan, Vessel } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { CustomCargoForm } from "./CustomCargoForm";
import { isUnderDeck } from "@/engine/breakbulk-deck-area";

interface Props {
  vessel: Vessel;
  plan: StowagePlan;
  projectCargoLoaded: boolean;
  onToggleProjectCargo: () => void;
}

/** The "Project cargo" section of the sidebar, split out of Sidebar.tsx to keep that file under the
 * 200-LOC rule. Same copy and behaviour as before the split. */
export function ProjectCargoPanel({ vessel, plan, projectCargoLoaded, onToggleProjectCargo }: Props) {
  return (
    <section>
      <h2>Project cargo</h2>
      <Button variant="outline" onClick={onToggleProjectCargo}>
        {projectCargoLoaded ? "Clear project cargo" : "Load project cargo"}
      </Button>
      <p className="muted small">
        {projectCargoLoaded
          ? vessel.breakbulk_deck
            ? `Wind turbine blades/nacelle/tower sections + yachts — DEMO reference sizes, naive placement on this vessel's real hatch covers and holds (stowage spec), not an optimized stow.`
            : `Wind turbine blades/nacelle/tower sections + yachts — DEMO reference sizes, naive deck placement, not real GA. Some items may be unplaced if containers occupy most of the deck.`
          : "Breakbulk demo cargo (wind turbine components, yachts) — independent of container load."}
      </p>
      {projectCargoLoaded && plan.breakbulk_cargo.length > 0 && (
        <p className="muted small">
          {(() => {
            const inHolds = plan.breakbulk_placements.filter((p) => isUnderDeck(p.area_id)).length;
            const onDeck = plan.breakbulk_placements.length - inHolds;
            const unplaced = plan.breakbulk_cargo.length - plan.breakbulk_placements.length;
            const parts = [`${onDeck} on deck`];
            if (vessel.breakbulk_holds?.length) parts.push(`${inHolds} in holds`);
            if (unplaced > 0) parts.push(`${unplaced} unplaced (no room left)`);
            return parts.join(" · ");
          })()}
          {vessel.breakbulk_holds?.length ? " — untick Hull to see cargo in the holds." : ""}
        </p>
      )}
      <CustomCargoForm vessel={vessel} />
    </section>
  );
}
