/**
 * area-rect-graphics.tsx — the drawing primitives every area layer is built from: a horizontal rect
 * fill, its outline, and a world-anchored label. `AreaPlaceholders` composes them for the drawn layer
 * and `AreaDropPlane` reuses the transform for the pickable one, so no two layers re-derive where an
 * area's rectangle IS (the same "one coordinate helper" rule as `engine/stowage-model/coords.ts`).
 *
 * ONE unit plane and ONE edge geometry are shared by every rectangle of every area and scaled per
 * mesh, and neither is built until the first rect is drawn: opening an area layer allocates two
 * geometries, not two per rectangle, and an idle scene allocates none.
 *
 * Colours arrive as props from `DROP_TINT` (the drawn layer) — this module owns geometry and layout,
 * never a verdict.
 */
import * as THREE from "three";
import { Html } from "@react-three/drei";
import type { Rect } from "@/engine/breakbulk-overlap-check";
import { placementXToSceneX } from "@/engine/stowage-model";

let unitPlane: THREE.PlaneGeometry | undefined;
let unitEdges: THREE.BufferGeometry | undefined;

/** A 1×1 plane lying in the XZ plane, rotated once on construction (never per mesh). */
export function areaUnitPlane(): THREE.PlaneGeometry {
  return (unitPlane ??= new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
}

/** Its four borders, extracted by `EdgesGeometry`. Scaled by the same matrix as the fill it belongs
 * to, so an outline can never drift off its rectangle. */
export function areaUnitEdges(): THREE.BufferGeometry {
  return (unitEdges ??= new THREE.EdgesGeometry(areaUnitPlane()));
}

/** The provenance badge's own colours — neutral by construction (see `AreaRectLabel`): a slate chip
 * on a near-white pill, legible over both the sea and a dark hold floor, and matching the keep-out
 * grey family so nothing about it reads as a green/amber/red verdict. Fixed here rather than passed
 * in as a prop because it is not a verdict: there is exactly one badge and exactly one look. */
const BADGE = { background: "rgba(255,255,255,.88)", border: "#67737F", color: "#39424B" };

export interface AreaRectProps {
  /** The rectangle in x_m/z_m space (stern-anchored x, +starboard z), as the model carries it. */
  rect: Rect;
  /** `vessel.length_m` — the x_m → scene-x shift, in one place. */
  lengthM: number;
  /** Scene y the rect is drawn at. */
  y: number;
  color: string;
}

/** Position and scale for a rect's plane mesh: the rect's centre in scene x/z, at height `y`, sized
 * to the rect's own extents. */
export function areaRectTransform(rect: Rect, lengthM: number, y: number) {
  return {
    position: [placementXToSceneX((rect.xMin + rect.xMax) / 2, lengthM), y, (rect.zMin + rect.zMax) / 2] as [
      number,
      number,
      number,
    ],
    scale: [rect.xMax - rect.xMin, 1, rect.zMax - rect.zMin] as [number, number, number],
  };
}

/** A translucent horizontal wash. `raycast={() => null}` — a drawn rect is a HINT, and the one
 * pickable surface per area is `AreaDropPlane`; two pickable layers over one rectangle would race
 * for the pointer and the loser would silently stop receiving moves. */
export function AreaRectFill({ rect, lengthM, y, color, opacity }: AreaRectProps & { opacity: number }) {
  const { position, scale } = areaRectTransform(rect, lengthM, y);
  return (
    <mesh geometry={areaUnitPlane()} position={position} scale={scale} raycast={() => null}>
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

/** The rectangle's border. Callers stack it a hair above their own fill so the two never z-fight. */
export function AreaRectOutline({ rect, lengthM, y, color }: AreaRectProps) {
  const { position, scale } = areaRectTransform(rect, lengthM, y);
  return (
    <lineSegments geometry={areaUnitEdges()} position={position} scale={scale} raycast={() => null}>
      <lineBasicMaterial color={color} />
    </lineSegments>
  );
}

/**
 * The area's name, the numbers that govern it, its provenance and — when the area cannot take the
 * item at all — the predicate's own reason, anchored to the rect's centre. Screen-sized (no
 * `distanceFactor`): four areas on one ship, and a label that shrinks with distance is unreadable
 * exactly where the hold floors are.
 *
 * `badge` is deliberately NOT tinted with the verdict `color`: it says where the area's boundary came
 * from (`lib/area-label-text.ts`), which is true whatever is in hand. Tinting it red because the
 * item does not fit here would read as "this data is bad" — the exact confusion the badge exists to
 * prevent, and the one the phase file's risk table names.
 *
 * `pointerEvents: none` is load-bearing: a DOM label sits ABOVE the canvas, so without it the label
 * would swallow the pointer over the very rectangle it names and the drop plane underneath would stop
 * publishing poses.
 */
export function AreaRectLabel({
  rect,
  lengthM,
  y,
  title,
  badge,
  detail,
  color,
}: AreaRectProps & { title: string; badge?: string | null; detail?: string | null }) {
  const { position } = areaRectTransform(rect, lengthM, y);
  return (
    <Html position={position} center className="area-placeholder-label" style={{ pointerEvents: "none" }}>
      <span
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          font: "600 11px/1.4 system-ui, sans-serif",
          color,
          textShadow: "0 1px 3px rgba(255,255,255,.9)",
        }}
      >
        {title}
        {badge ? (
          <span
            style={{
              marginTop: 2,
              padding: "1px 6px",
              borderRadius: 999,
              border: `1px solid ${BADGE.border}`,
              background: BADGE.background,
              color: BADGE.color,
              font: "600 10px/1.4 system-ui, sans-serif",
            }}
          >
            {badge}
          </span>
        ) : null}
        {detail ? <span style={{ fontWeight: 400 }}>{detail}</span> : null}
      </span>
    </Html>
  );
}
