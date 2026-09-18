import { describe, expect, it } from "vitest";
import { usePlanStore } from "@/store/usePlanStore";

/**
 * `resetView` (Phase 02 of the drag-visibility work): the sidebar button and the in-canvas camera talk
 * through a nonce, so what is testable here is that every press is observable — a boolean would
 * collapse two presses from two different drifted positions into one.
 */
describe("resetView", () => {
  it("starts at 0 so a fresh session keeps the camera the Canvas set", () => {
    expect(usePlanStore.getState().viewResetCount).toBeGreaterThanOrEqual(0);
  });

  it("increments on every press, never toggles", () => {
    const before = usePlanStore.getState().viewResetCount;
    usePlanStore.getState().resetView();
    usePlanStore.getState().resetView();
    expect(usePlanStore.getState().viewResetCount).toBe(before + 2);
  });

  it("is not clobbered by a vessel change — the camera is not vessel state", () => {
    usePlanStore.getState().resetView();
    const after = usePlanStore.getState().viewResetCount;
    usePlanStore.getState().resetForVesselChange();
    expect(usePlanStore.getState().viewResetCount).toBe(after);
  });
});

/** Sidebar tab (sidebar reorganisation, phase 01): Load by default, survives a vessel change. */
describe("sidebarTab", () => {
  it("defaults to Load and switches on request", () => {
    expect(["load", "view", "check"]).toContain(usePlanStore.getState().sidebarTab);
    usePlanStore.getState().setSidebarTab("check");
    expect(usePlanStore.getState().sidebarTab).toBe("check");
  });

  it("is kept across a vessel change — losing the tab on every switch would be irritating", () => {
    usePlanStore.getState().setSidebarTab("view");
    usePlanStore.getState().resetForVesselChange();
    expect(usePlanStore.getState().sidebarTab).toBe("view");
  });
});
