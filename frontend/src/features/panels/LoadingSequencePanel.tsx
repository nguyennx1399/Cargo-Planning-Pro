import { usePlanStore } from "@/store/usePlanStore";

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
      <div className="segmented" role="group" aria-label="Playback controls">
        <button onClick={playbackPlaying ? pausePlayback : startOrResumePlayback} disabled={total === 0}>
          {playbackPlaying ? "Pause" : "Play"}
        </button>
        <button onClick={resetPlayback} disabled={playbackCount === null}>
          Reset
        </button>
      </div>
      <p className="muted small">{shown} / {total} placed</p>
      <label className="field">
        Progress
        <input
          type="range"
          min={0}
          max={total}
          step={1}
          value={shown}
          onChange={(e) => setPlaybackCount(Number(e.target.value))}
          disabled={total === 0}
        />
      </label>
      <label className="field">
        Speed ({playbackSpeed}/s)
        <input
          type="range"
          min={1}
          max={100}
          step={1}
          value={playbackSpeed}
          onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
        />
      </label>
    </section>
  );
}
