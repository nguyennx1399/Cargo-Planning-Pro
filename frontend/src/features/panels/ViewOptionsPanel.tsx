import { useShallow } from "zustand/react/shallow";
import type { Vessel } from "@/types/domain";
import { usePlanStore } from "@/store/usePlanStore";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** The "Show" section of the sidebar (hull / deck toggles and the bay selector), split out of
 * Sidebar.tsx to keep that file under the 200-LOC rule. Store-driven, so it takes only the vessel
 * (for the bay list). The ArrowLeft/Right bay navigation that also drives `bayFilter` stays in
 * Sidebar, where it already lived. */
export function ViewOptionsPanel({ vessel }: { vessel: Vessel }) {
  const s = usePlanStore(
    useShallow((state) => ({
      showHull: state.showHull,
      toggleHull: state.toggleHull,
      showOnDeck: state.showOnDeck,
      toggleOnDeck: state.toggleOnDeck,
      showUnderDeck: state.showUnderDeck,
      toggleUnderDeck: state.toggleUnderDeck,
      bayFilter: state.bayFilter,
      setBayFilter: state.setBayFilter,
      resetView: state.resetView,
    }))
  );
  const bayIndex = s.bayFilter === null ? -1 : vessel.bays.indexOf(s.bayFilter);
  const gotoBay = (delta: number) => {
    const next = bayIndex === -1 ? (delta > 0 ? 0 : vessel.bays.length - 1) : bayIndex + delta;
    if (next >= 0 && next < vessel.bays.length) s.setBayFilter(vessel.bays[next]);
  };

  return (
    <section>
      <h2>Show</h2>
      {/* The recovery for zoom-to-pointer: the wheel moves the orbit target as it zooms, so the ship can
          end up off-centre with no way back. Sits with the other view controls because that is where a
          planner looks when the view is wrong. */}
      <Button variant="outline" size="sm" className="self-start" onClick={s.resetView}>
        Reset view
      </Button>
      <div className="flex items-center gap-2">
        <Checkbox id="show-hull" checked={s.showHull} onCheckedChange={s.toggleHull} />
        <Label htmlFor="show-hull">Hull</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="show-on-deck" checked={s.showOnDeck} onCheckedChange={s.toggleOnDeck} />
        <Label htmlFor="show-on-deck">On deck</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="show-under-deck" checked={s.showUnderDeck} onCheckedChange={s.toggleUnderDeck} />
        <Label htmlFor="show-under-deck">Under deck</Label>
      </div>
      <div className="grid gap-1.5 mt-2">
        <Label htmlFor="bay-filter">Bay</Label>
        <div className="flex gap-1.5">
          <Button variant="outline" size="icon" aria-label="Previous bay" disabled={bayIndex === 0} onClick={() => gotoBay(-1)}>
            <ChevronLeft />
          </Button>
          <Select value={s.bayFilter === null ? "all" : String(s.bayFilter)} onValueChange={(v) => s.setBayFilter(v === "all" ? null : Number(v))}>
            <SelectTrigger id="bay-filter" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All bays</SelectItem>
              {vessel.bays.map((b) => <SelectItem key={b} value={String(b)}>Bay {String(b).padStart(2, "0")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" aria-label="Next bay" disabled={bayIndex === vessel.bays.length - 1} onClick={() => gotoBay(1)}>
            <ChevronRight />
          </Button>
        </div>
      </div>
    </section>
  );
}
