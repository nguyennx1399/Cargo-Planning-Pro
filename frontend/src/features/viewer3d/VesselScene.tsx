import { useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, GizmoHelper, GizmoViewport } from "@react-three/drei";
import { useShallow } from "zustand/react/shallow";
import * as THREE from "three";
import type { StowagePlan, Vessel } from "@/types/domain";
import type { StabilityResult } from "@/engine/stability-indicative";
import { freeRegionsFor } from "@/engine/placement/placeholders";
import { areaVisible } from "@/lib/drop-verdict";
import { Hull } from "./Hull";
import { ContainerInstances } from "./ContainerInstances";
import { BreakbulkCargoInstances } from "./BreakbulkCargoInstances";
import { EmptySlotPicker } from "./EmptySlotPicker";
import { GhostContainerPreview } from "./GhostContainerPreview";
import { SlotPlaceholders } from "./SlotPlaceholders";
import { AreaPlaceholders } from "./AreaPlaceholders";
import { AreaDropPlane } from "./AreaDropPlane";
import { GhostBreakbulkPreview } from "./GhostBreakbulkPreview";
import { FreeSpaceView } from "./FreeSpaceView";
import { StowageBoundingBox } from "./StowageBoundingBox";
import { WaterlineReference } from "./WaterlineReference";
import { LoadingSequenceDriver } from "./LoadingSequenceDriver";
import { ShipAttitudeDriver } from "./ShipAttitudeDriver";
import { activeBreakbulkId, dragInFlight, handInUse, usePlanStore } from "@/store/usePlanStore";
import { getVesselGeometry } from "@/data/vessel-geometry-catalog";
import { shipAttitudeInputFromStability } from "@/lib/ship-attitude-transform";
import { horizontalPanOffset, type Vec3 } from "@/lib/camera-pan";

/**
 * Freezes camera orbit while a drag is in flight: left-drag orbits by default, so without this the
 * ship spins instead of the box being placed. Covers BOTH kinds of cargo — a project-cargo item is
 * dragged with the same held button, so the same lock applies.
 *
 * `OrbitControls` sets `makeDefault`, which is what publishes its instance to `state.controls` (typed
 * as a bare `EventDispatcher`, hence the cast). Deliberately NOT locked for a PICK — no pointer is
 * held down then, and rotating the ship to find a target for the picked item is exactly what that flow
 * needs.
 */
function OrbitLock() {
  const dragging = usePlanStore(dragInFlight);
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;

  useEffect(() => {
    if (controls) controls.enabled = !dragging;
  }, [controls, dragging]);

  return null;
}

/** The app's default framing. ONE constant, because the Canvas and `ViewReset` must agree: a reset that
 * puts the camera somewhere the app never starts from is worse than no reset at all. */
const DEFAULT_CAMERA: [number, number, number] = [90, 55, 90];

/**
 * Puts the camera and the orbit target back on the ship when `resetView()` is pressed.
 *
 * It exists because of `zoomToCursor` below: zooming toward the pointer MOVES `controls.target`, so
 * after a few zooms the target can sit off the ship and orbiting then swings the camera around open
 * sea. Nothing else in the app re-centres, so the escape hatch ships with the feature.
 *
 * Driven by a nonce rather than a boolean: the planner may press Reset twice in a row from two
 * different drifted positions, and a boolean would only fire once. `count === 0` means "never pressed",
 * which is what keeps this effect from overriding the Canvas's own initial camera on mount.
 */
function ViewReset() {
  const count = usePlanStore((s) => s.viewResetCount);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update(): void } | null;
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    if (!controls || count === 0) return;
    camera.position.set(...DEFAULT_CAMERA);
    controls.target.set(0, 0, 0);
    controls.update();
  }, [count, controls, camera]);

  return null;
}

/**
 * Slides the camera and the orbit target together when an arrow key is pressed — panning, not orbiting
 * (moving only the camera would swing the view). The offset maths is `lib/camera-pan.ts`; this component
 * is only the wiring, and it is driven by a nonce for the same reason `ViewReset` is: two presses in the
 * same direction must be two events.
 */
function ViewPan() {
  const { seq, dx } = usePlanStore((s) => s.viewPan);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update(): void } | null;
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    if (!controls || seq === 0) return;
    const offset = horizontalPanOffset(
      camera.position.toArray() as unknown as Vec3,
      controls.target.toArray() as unknown as Vec3,
      camera.up.toArray() as unknown as Vec3,
      dx,
    );
    camera.position.set(camera.position.x + offset[0], camera.position.y + offset[1], camera.position.z + offset[2]);
    controls.target.set(controls.target.x + offset[0], controls.target.y + offset[1], controls.target.z + offset[2]);
    controls.update();
    // `seq` alone drives this: `dx` is read from the same state snapshot and must not re-fire on its own.
  }, [seq]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export function VesselScene({ vessel, plan, attitude }: { vessel: Vessel; plan: StowagePlan; attitude: StabilityResult | null }) {
  const setSelected = usePlanStore((s) => s.setSelected);
  const exaggerate = usePlanStore((s) => s.exaggerate);
  const view = usePlanStore(
    useShallow((s) => ({
      showOnDeck: s.showOnDeck,
      showUnderDeck: s.showUnderDeck,
      bayFilter: s.bayFilter,
    })),
  );
  const shipGroupRef = useRef<THREE.Group>(null!);

  // The item in hand, resolved from the store's single hand field (Phase 03 deleted the temporary
  // `b`-key state this used to hold). Holding the ID rather than the object is what makes a vessel
  // switch safe: an id that no longer resolves simply means no hand. `hoveredPose` is the store's —
  // `AreaDropPlane` is its only writer, and the ghost, the chip and the cursor hook read the same
  // value, so no layer can be looking at a different pose than the one that would be committed.
  const handId = usePlanStore(activeBreakbulkId);
  const hoveredPose = usePlanStore((s) => s.hoveredPose);
  // The hull's own condition: ANY gesture, either kind, either mode (`handInUse`, defined beside its
  // sibling predicates in the hand slice). One view for every gesture — the planner gets the same
  // unobstructed ship whether the target is a tank top, an under-deck slot, or a hatch cover a crane
  // stands over.
  const gestureActive = usePlanStore(handInUse);
  // The free-space overlay answers "what is still empty"; the gesture layers answer "where may THIS item
  // go". Two translucent layers over the same cells would clutter and, worse, contradict — so the
  // overlay yields to any gesture.
  const showFreeSpace = usePlanStore((s) => s.showFreeSpace);
  // The stowage box is NOT gated on the hand (unlike the free-space overlay): it is edges only, and
  // seeing the envelope while placing is part of what it is for.
  const showStowageBox = usePlanStore((s) => s.showStowageBox);
  const item = useMemo(
    () => (handId ? plan.breakbulk_cargo.find((c) => c.id === handId) ?? null : null),
    [plan.breakbulk_cargo, handId],
  );

  // ONE sweep per gesture start (`freeRegionsFor` costs a predicate call per area plus an occupancy
  // grouping), filtered by the viewer's own deck rule — the same `areaVisible` the drop planes apply,
  // so the drawn layer and the pickable layer are always the same set of areas.
  const regions = useMemo(
    () => (item ? freeRegionsFor(vessel, plan, item).filter((region) => areaVisible(region.area, view)) : []),
    [vessel, plan, item, view],
  );
  const areas = useMemo(() => regions.map((region) => region.area), [regions]);

  const geometry = vessel.geometry_id ? getVesselGeometry(vessel.geometry_id) : undefined;
  const depthM = geometry?.particulars.depth_m ?? 14;
  const lbpM = geometry?.particulars.lbp_m ?? vessel.length_m;

  return (
    <Canvas
      camera={{ position: DEFAULT_CAMERA, fov: 40, near: 0.5, far: 2000 }}
      onPointerMissed={() => setSelected(null)}
      dpr={[1, 2]}
    >
      <color attach="background" args={["#DCE3E9"]} />
      <hemisphereLight args={["#ffffff", "#8a9aa8", 0.9]} />
      <directionalLight position={[60, 120, 40]} intensity={1.2} />

      <WaterlineReference vessel={vessel} />
      <LoadingSequenceDriver totalPlacements={plan.placements.length} />
      <ShipAttitudeDriver
        groupRef={shipGroupRef}
        attitude={shipAttitudeInputFromStability(attitude)}
        depthM={depthM}
        lbpM={lbpM}
        exaggerate={exaggerate}
      />
      {/* The area layers and the ghost live INSIDE the attitude group, so heel and trim carry them
          with the cargo they describe. */}
      <group ref={shipGroupRef}>
        <Hull vessel={vessel} hidden={gestureActive} />
        <ContainerInstances vessel={vessel} plan={plan} />
        <BreakbulkCargoInstances vessel={vessel} plan={plan} />
        <SlotPlaceholders vessel={vessel} plan={plan} />
        {/* "Never both" (Phase D open question 2) is enforced INSIDE each pick layer now, keyed on the
            hand's kind: `EmptySlotPicker` unmounts itself under a project-cargo hand, and this layer is
            mounted only for one. Clearing `hoveredSlot` when the hand fills is the hand slice's job
            (`handState`), not an effect here — an unmounted pick volume delivers no `onPointerOut`. */}
        <EmptySlotPicker vessel={vessel} plan={plan} />
        <GhostContainerPreview vessel={vessel} plan={plan} />
        {item ? <AreaPlaceholders vessel={vessel} regions={regions} /> : null}
        {item ? <AreaDropPlane vessel={vessel} item={item} areas={areas} /> : null}
        <GhostBreakbulkPreview vessel={vessel} plan={plan} item={item} pose={hoveredPose} />
        {showFreeSpace && !gestureActive ? <FreeSpaceView vessel={vessel} plan={plan} /> : null}
        {showStowageBox ? <StowageBoundingBox vessel={vessel} /> : null}
      </group>

      <OrbitLock />
      <ViewReset />
      <ViewPan />
      {/* `zoomToCursor`: the wheel converges on what is UNDER THE POINTER instead of pulling the camera
          toward the ship's centre. It moves `controls.target` as it goes — `ViewReset` above is the
          recovery for that drift. */}
      <OrbitControls makeDefault zoomToCursor target={[0, 0, 0]} maxPolarAngle={Math.PI * 0.49} />
      <GizmoHelper alignment="bottom-right" margin={[64, 64]}>
        <GizmoViewport labelColor="white" axisHeadScale={0.9} />
      </GizmoHelper>
    </Canvas>
  );
}
