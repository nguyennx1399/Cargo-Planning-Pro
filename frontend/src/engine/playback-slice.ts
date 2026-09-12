// Slices a placements array to "the first N shown so far" for the loading-sequence playback —
// `null` means "show everything" (the default, unchanged behavior), a number means "show only
// this many, in the array's own order" (see naive-fill-plan.ts for why that order is already a
// valid loading sequence).
export function visiblePlacements<T>(placements: T[], playbackCount: number | null): T[] {
  return playbackCount === null ? placements : placements.slice(0, Math.floor(playbackCount));
}
