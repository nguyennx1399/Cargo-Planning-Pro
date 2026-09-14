import { usePlanStore } from "@/store/usePlanStore";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Pause, Play, RotateCcw } from "lucide-react";

/** Play/pause/scrub controls for the loading-sequence playback (phase 03) — drives
 * ContainerInstances + the live stability recompute via playbackCount in the store. */
export function LoadingSequencePanel({ total }: { total: number }) {
  const playbackCount = usePlanStore((s) => s.playbackCount);
  const playbackPlaying = usePlanStore((s) => s.playbackPlaying);
  const playbackSpeed = usePlanStore((s) => s.playbackSpeed);
  const startOrResumePlayback = usePlanStore((s) => s.startOrResumePlayback);
  const pausePlayback = usePlanStore((s) => s.pausePlayback);
  const resetPlayback = usePlanStore((s) => s.resetPlayback);
  const setPlaybackCount = usePlanStore((s) => s.setPlaybackCount);
  const setPlaybackSpeed = usePlanStore((s) => s.setPlaybackSpeed);

  const shown = playbackCount === null ? total : Math.min(Math.floor(playbackCount), total);

  return (
    <section>
      <h2>Loading sequence</h2>
      <p className="muted small">Watch the ship sink and heel as cargo is added, one container at a time.</p>
      <div className="flex gap-2" role="group" aria-label="Playback controls">
        <Button onClick={playbackPlaying ? pausePlayback : startOrResumePlayback} disabled={total === 0}>
          {playbackPlaying ? <Pause /> : <Play />}
          {playbackPlaying ? "Pause" : "Play"}
        </Button>
        <Button variant="outline" onClick={resetPlayback} disabled={playbackCount === null}>
          <RotateCcw /> Reset
        </Button>
      </div>
      <p className="muted small">{shown} / {total} placed</p>
      <div className="grid gap-1.5 mt-2">
        <Label id="playback-progress-label" htmlFor="playback-progress">Progress</Label>
        <Slider
          id="playback-progress"
          aria-labelledby="playback-progress-label"
          min={0}
          max={total}
          step={1}
          value={shown}
          // single-thumb slider: shadcn's generated wrapper types value/onValueChange as
          // number | readonly number[] regardless of usage, so narrow the runtime-safe number.
          onValueChange={(v) => setPlaybackCount(v as number)}
          disabled={total === 0}
        />
      </div>
      <div className="grid gap-1.5 mt-2">
        <Label id="playback-speed-label" htmlFor="playback-speed">Speed ({playbackSpeed}/s)</Label>
        <Slider
          id="playback-speed"
          aria-labelledby="playback-speed-label"
          min={1}
          max={100}
          step={1}
          value={playbackSpeed}
          onValueChange={(v) => setPlaybackSpeed(v as number)}
        />
      </div>
    </section>
  );
}
