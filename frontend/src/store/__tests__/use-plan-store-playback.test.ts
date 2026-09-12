import { beforeEach, describe, expect, it } from "vitest";
import { usePlanStore } from "../usePlanStore";

// Exercises the playback slice directly via getState()/setState() — no React render needed,
// since this is plain Zustand state + actions.
describe("usePlanStore playback slice", () => {
  beforeEach(() => {
    usePlanStore.setState({ playbackCount: null, playbackPlaying: false, playbackSpeed: 30 });
  });

  it("startOrResumePlayback from null starts at 0, playing", () => {
    usePlanStore.getState().startOrResumePlayback();
    expect(usePlanStore.getState().playbackCount).toBe(0);
    expect(usePlanStore.getState().playbackPlaying).toBe(true);
  });

  it("startOrResumePlayback from a paused count resumes from there, not 0", () => {
    usePlanStore.setState({ playbackCount: 7, playbackPlaying: false });
    usePlanStore.getState().startOrResumePlayback();
    expect(usePlanStore.getState().playbackCount).toBe(7);
    expect(usePlanStore.getState().playbackPlaying).toBe(true);
  });

  it("advancePlayback moves toward maxCount and auto-pauses on reaching it", () => {
    usePlanStore.setState({ playbackCount: 0, playbackPlaying: true });
    usePlanStore.getState().advancePlayback(5, 10);
    expect(usePlanStore.getState().playbackCount).toBe(5);
    expect(usePlanStore.getState().playbackPlaying).toBe(true);

    usePlanStore.getState().advancePlayback(5, 10);
    expect(usePlanStore.getState().playbackCount).toBe(10);
    expect(usePlanStore.getState().playbackPlaying).toBe(false); // "cho đến khi hoàn thành" -> auto-pause at max
  });

  it("advancePlayback is a no-op when playbackCount is null (driver ticking before Play)", () => {
    usePlanStore.setState({ playbackCount: null, playbackPlaying: false });
    usePlanStore.getState().advancePlayback(5, 10);
    expect(usePlanStore.getState().playbackCount).toBeNull();
  });

  it("setPlaybackCount (scrub) always pauses playback", () => {
    usePlanStore.setState({ playbackCount: 3, playbackPlaying: true });
    usePlanStore.getState().setPlaybackCount(8);
    expect(usePlanStore.getState().playbackCount).toBe(8);
    expect(usePlanStore.getState().playbackPlaying).toBe(false);
  });

  it("resetPlayback returns to null/not-playing from any state", () => {
    usePlanStore.setState({ playbackCount: 42, playbackPlaying: true });
    usePlanStore.getState().resetPlayback();
    expect(usePlanStore.getState().playbackCount).toBeNull();
    expect(usePlanStore.getState().playbackPlaying).toBe(false);
  });

  it("pausePlayback stops playing without touching playbackCount", () => {
    usePlanStore.setState({ playbackCount: 4, playbackPlaying: true });
    usePlanStore.getState().pausePlayback();
    expect(usePlanStore.getState().playbackCount).toBe(4);
    expect(usePlanStore.getState().playbackPlaying).toBe(false);
  });
});
