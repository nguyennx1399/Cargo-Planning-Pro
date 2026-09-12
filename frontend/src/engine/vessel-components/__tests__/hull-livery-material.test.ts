import { describe, expect, it } from "vitest";
import { applyHullLiveryPatch, createHullLiveryMaterial, type HullLiveryShaderTarget } from "../hull-livery-material";
import type { Livery } from "@/types/vessel-geometry";

const livery: Livery = {
  topside_color: "#2B4C6F",
  antifouling_color: "#8B1A1A",
  boot_top_color: "#1A1A1A",
  boot_top_low_z_m: 9.5,
  boot_top_high_z_m: 10.3,
  superstructure_color: "#E8ECEF",
};

/** Minimal stand-in for the real shader three.js hands to onBeforeCompile — real GLSL
 * compilation needs a WebGL context, unavailable in vitest; this checks the string patching
 * logic in isolation. */
function mockShader(): HullLiveryShaderTarget {
  return {
    vertexShader: "#include <common>\nvoid main() {\n#include <begin_vertex>\n}",
    fragmentShader: "#include <common>\nvoid main() {\n#include <color_fragment>\n}",
    uniforms: {},
  };
}

describe("applyHullLiveryPatch", () => {
  it("sets uniforms from the livery and depth", () => {
    const shader = mockShader();
    applyHullLiveryPatch(shader, livery, 14);
    expect(shader.uniforms.uDepthM.value).toBe(14);
    expect(shader.uniforms.uBootLow.value).toBe(9.5);
    expect(shader.uniforms.uBootHigh.value).toBe(10.3);
    expect(shader.uniforms.uAntifouling).toBeDefined();
    expect(shader.uniforms.uTopside).toBeDefined();
  });

  it("injects the varying and paint branch into both shaders", () => {
    const shader = mockShader();
    applyHullLiveryPatch(shader, livery, 14);
    expect(shader.vertexShader).toContain("varying float vHullZ;");
    expect(shader.vertexShader).toContain("vHullZ = position.y;");
    expect(shader.fragmentShader).toContain("varying float vHullZ;");
    expect(shader.fragmentShader).toContain("diffuseColor.rgb = hullPaint;");
    expect(shader.fragmentShader).toContain("shipZ < uBootLow");
  });

  it("does not throw if the include markers are already gone (defensive no-op patch)", () => {
    const shader: HullLiveryShaderTarget = { vertexShader: "void main(){}", fragmentShader: "void main(){}", uniforms: {} };
    expect(() => applyHullLiveryPatch(shader, livery, 14)).not.toThrow();
  });
});

describe("createHullLiveryMaterial", () => {
  it("creates a MeshStandardMaterial with onBeforeCompile wired", () => {
    const material = createHullLiveryMaterial(livery, 14);
    expect(material.type).toBe("MeshStandardMaterial");
    expect(typeof material.onBeforeCompile).toBe("function");
  });
});
