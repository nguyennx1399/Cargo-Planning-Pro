/**
 * The stage layout choice (stage-swap plan, phase 01): toggles, is remembered, survives a vessel change,
 * and never breaks the app when storage is missing, holds garbage, or throws.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readPref, writePref } from "../view-prefs-storage";

const fakeStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("view prefs storage", () => {
  it("falls back when storage is missing (node) and when the value is not an allowed one", () => {
    expect(readPref("x", ["a", "b"] as const, "a")).toBe("a");
    vi.stubGlobal("localStorage", fakeStorage({ "cpp.x": "zzz" }));
    expect(readPref("x", ["a", "b"] as const, "a")).toBe("a");
  });

  it("reads back what it wrote", () => {
    vi.stubGlobal("localStorage", fakeStorage());
    writePref("x", "b");
    expect(readPref("x", ["a", "b"] as const, "a")).toBe("b");
  });

  it("swallows a storage that throws", () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("quota"); } });
    expect(() => writePref("x", "b")).not.toThrow();
    expect(readPref("x", ["a", "b"] as const, "a")).toBe("a");
  });
});

describe("useStageLayout", () => {
  it("starts from the remembered layout, toggles, and remembers the new one", async () => {
    const storage = fakeStorage({ "cpp.stageLayout": "plan" });
    vi.stubGlobal("localStorage", storage);
    const { useStageLayout } = await import("../stage-layout-store");
    expect(useStageLayout.getState().stageLayout).toBe("plan");
    useStageLayout.getState().toggleStageLayout();
    expect(useStageLayout.getState().stageLayout).toBe("3d");
    expect(storage.data.get("cpp.stageLayout")).toBe("3d");
  });

  it("defaults to the 3D layout with no storage", async () => {
    const { useStageLayout } = await import("../stage-layout-store");
    expect(useStageLayout.getState().stageLayout).toBe("3d");
  });

  it("is not touched by a vessel change", async () => {
    const { useStageLayout } = await import("../stage-layout-store");
    const { usePlanStore } = await import("../usePlanStore");
    useStageLayout.getState().setStageLayout("plan");
    usePlanStore.getState().resetForVesselChange();
    expect(useStageLayout.getState().stageLayout).toBe("plan");
  });
});
