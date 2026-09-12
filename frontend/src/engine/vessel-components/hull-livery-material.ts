// Paints the hull mesh by ship-frame z (antifouling below boot-top, boot-top band, topside
// above), via a MeshStandardMaterial.onBeforeCompile patch — so the boundary is a sharp line,
// not blurred across triangle-sized vertex colors, and costs one extra branch per fragment.
//
// The mesh's own local-space Y IS ship-frame z, offset by depth (shipToScene: sceneY = shipZ -
// depth_m — see lib/ship-frame.ts), so no separate "hull-local z" attribute is needed: read
// `position.y` in the vertex shader and add depth back. Using LOCAL (object-space) position,
// not world position, is deliberate — the paint boundary must move WITH the hull when phase 6
// tilts/sinks it, not stay fixed in world space.
import * as THREE from "three";
import type { Livery } from "@/types/vessel-geometry";

export interface HullLiveryShaderTarget {
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, THREE.IUniform>;
}

export function createHullLiveryMaterial(livery: Livery, depthM: number): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial();
  material.onBeforeCompile = (shader) => applyHullLiveryPatch(shader, livery, depthM);
  // The patched GLSL is structurally identical for every vessel (only uniform VALUES differ,
  // and three.js already recompiles/rebinds uniforms without needing a new program for that) —
  // so this key only needs to be stable and distinct from unrelated materials' keys, not
  // per-instance. A per-vessel key here would force a separate shader program compile for
  // every vessel/depth combination for no correctness benefit.
  material.customProgramCacheKey = () => "hull-livery-material";
  return material;
}

/** Exported separately so it can be unit-tested against a plain mock shader object, without a
 * WebGL context (real GLSL compilation only happens inside three's renderer). */
export function applyHullLiveryPatch(shader: HullLiveryShaderTarget, livery: Livery, depthM: number): void {
  shader.uniforms.uDepthM = { value: depthM };
  shader.uniforms.uBootLow = { value: livery.boot_top_low_z_m };
  shader.uniforms.uBootHigh = { value: livery.boot_top_high_z_m };
  shader.uniforms.uAntifouling = { value: new THREE.Color(livery.antifouling_color) };
  shader.uniforms.uBootTop = { value: new THREE.Color(livery.boot_top_color) };
  shader.uniforms.uTopside = { value: new THREE.Color(livery.topside_color) };

  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying float vHullZ;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\nvHullZ = position.y;");

  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      "#include <common>\n" +
        "varying float vHullZ;\n" +
        "uniform float uDepthM;\n" +
        "uniform float uBootLow;\n" +
        "uniform float uBootHigh;\n" +
        "uniform vec3 uAntifouling;\n" +
        "uniform vec3 uBootTop;\n" +
        "uniform vec3 uTopside;"
    )
    .replace(
      "#include <color_fragment>",
      "#include <color_fragment>\n" +
        "{\n" +
        "  float shipZ = vHullZ + uDepthM;\n" +
        "  vec3 hullPaint = shipZ < uBootLow ? uAntifouling : (shipZ < uBootHigh ? uBootTop : uTopside);\n" +
        "  diffuseColor.rgb = hullPaint;\n" +
        "}"
    );
}
