import { useFrame } from "@react-three/fiber";
import { usePlanStore } from "@/store/usePlanStore";

/** Ticks playbackCount forward every frame while playing — renders nothing, mounted inside
 * <Canvas> so useFrame runs in sync with the render loop instead of a separate setInterval. */
export function LoadingSequenceDriver({ totalPlacements }: { totalPlacements: number }) {
  const playbackPlaying = usePlanStore((s) => s.playbackPlaying);
  const playbackSpeed = usePlanStore((s) => s.playbackSpeed);
  const advancePlayback = usePlanStore((s) => s.advancePlayback);

  useFrame((_, delta) => {
    if (playbackPlaying) advancePlayback(playbackSpeed * delta, totalPlacements);
  });

  return null;
}
