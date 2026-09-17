/**
 * AreaPlaceholders.tsx — what the free-positioning drop TARGETS look like (Phase D, requirements 1/2):
 * one translucent rect per stowage area, drawn on that area's own resting surface, with the keep-outs
 * that eat into it, the ground already taken, and a label naming the area and the number that governs
 * it.
 *
 * Green = the item in hand belongs in this area, faint red = it does not, and the red label carries
 * the FIRST reason the engine gave for the area — the predicate's own sentence, never a UI-local
 * second wording. Feasibility is deliberately rotation-0 and position-independent (`FreeRegion`'s doc),
 * so pressing R must not reshuffle these colours: the per-pose ghost is the authority on the pose.
 *
 * Keep-outs arrive already clipped to the area rect (D-P4) — drawing a whole keep-out would show an
 * obstacle on deck space no footprint can reach, so nothing here re-clips them.
 *
 * Every mesh is `raycast={() => null}`: this is the DRAWN layer, `AreaDropPlane` is the pickable one.
 * Mounted only while a project-cargo item is in hand — with nothing in hand `regions` is empty and
 * this renders no object at all.
 *
 * The label's wording (name · rating · clear height, plus the approximation badge) lives in
 * `lib/area-label-text.ts` — one source for the two strings, so the badge and the predicate's own
 * warning message (D4) cannot drift apart.
 */
import type { Vessel } from "@/types/domain";
import type { FreeRegion } from "@/engine/placement/placeholders";
import { areaLabelBadge, areaLabelTitle } from "@/lib/area-label-text";
import { DROP_TINT } from "@/lib/drop-verdict";
import { AreaRectFill, AreaRectLabel, AreaRectOutline } from "./area-rect-graphics";

/** How far each layer floats above the surface it belongs to. The heights are ordered fill < outline
 * < keep-out < occupied so nothing z-fights, and all of them stay far below a real cargo base. */
const LIFT = { fill: 0.02, outline: 0.03, keepOut: 0.04, keepOutLine: 0.05, occupied: 0.06, label: 0.1 };

const FILL_OPACITY = { feasible: 0.2, infeasible: 0.12, keepOut: 0.9, occupied: 0.55 };
/** Keep-outs and taken ground are structure, not verdicts — they keep one grey each whatever the
 * item in hand is, so a red deck never reads as "this keep-out is the refusal". */
const KEEP_OUT = { fill: "#8A97A3", line: "#67737F" };
const OCCUPIED = "#39424B";

export function AreaPlaceholders({ vessel, regions }: { vessel: Vessel; regions: readonly FreeRegion[] }) {
  if (regions.length === 0) return null;
  const lengthM = vessel.length_m;

  return (
    <group>
      {regions.map(({ area, feasible, reason, keepOuts, occupied }) => {
        const y = area.surfaceY;
        const tint = DROP_TINT[feasible ? "valid" : "invalid"];

        return (
          <group key={area.id}>
            <AreaRectFill
              rect={area.rect}
              lengthM={lengthM}
              y={y + LIFT.fill}
              color={tint}
              opacity={feasible ? FILL_OPACITY.feasible : FILL_OPACITY.infeasible}
            />
            <AreaRectOutline rect={area.rect} lengthM={lengthM} y={y + LIFT.outline} color={tint} />
            {keepOuts.map((keepOut, i) => (
              <group key={`keep-out-${i}`}>
                <AreaRectFill
                  rect={keepOut}
                  lengthM={lengthM}
                  y={y + LIFT.keepOut}
                  color={KEEP_OUT.fill}
                  opacity={FILL_OPACITY.keepOut}
                />
                <AreaRectOutline rect={keepOut} lengthM={lengthM} y={y + LIFT.keepOutLine} color={KEEP_OUT.line} />
              </group>
            ))}
            {occupied.map((rect, i) => (
              <AreaRectFill
                key={`occupied-${i}`}
                rect={rect}
                lengthM={lengthM}
                y={y + LIFT.occupied}
                color={OCCUPIED}
                opacity={FILL_OPACITY.occupied}
              />
            ))}
            <AreaRectLabel
              rect={area.rect}
              lengthM={lengthM}
              y={y + LIFT.label}
              title={areaLabelTitle(area)}
              badge={areaLabelBadge(area)}
              detail={reason?.message ?? null}
              color={tint}
            />
          </group>
        );
      })}
    </group>
  );
}
