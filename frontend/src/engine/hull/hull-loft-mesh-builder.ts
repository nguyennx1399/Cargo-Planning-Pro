// Builds a closed triangle mesh from a HullOffsets grid, in SCENE space (already run through
// shipToScene) so normals come out correctly oriented after computeVertexNormals(). The one
// mesher every hull source (parametric, offsets-import, CAD-sliced) shares (plan G2).
//
// Per station, the cross-section is traced as a single open "U": starboard deck edge -> down
// the starboard skin -> across the flat bottom -> up the port skin -> port deck edge. Between
// consecutive stations this gives a full ring of quads (shell) PLUS one more quad connecting
// the two open ends (the deck). The first and last station are each capped with a simple fan
// triangulation (see capLoop) so the tube is genuinely closed rather than open-ended — the
// generator always degenerates both end stations to zero half-breadth, so these caps come out
// as zero-area triangles that just pinch the mesh shut at the stem/sternpost line.
// TODO(phase-4): a fan from vertex 0 only stays non-self-intersecting for a star-shaped loop;
// fine while end stations are exactly degenerate (this generator), but an offsets-import end
// station that isn't a true point will need a real polygon triangulation instead.
import * as THREE from "three";
import type { HullOffsets, MainParticulars } from "@/types/vessel-geometry";
import { shipToScene } from "@/lib/ship-frame";
import { catmullRomResample, type Point2 } from "./catmull-rom-spline";
import { halfBreadthAt } from "./section-integrals";

export interface HullMeshData {
  positions: Float32Array;
  normals: Float32Array;
  index: Uint32Array;
}

export interface HullLoftMeshOptions {
  /** Points per side of the U (deck -> keel or keel -> deck). Loop has 2x this many points. */
  sectionPoints?: number;
}

const DEFAULT_SECTION_POINTS = 24;

export function buildHullLoftMesh(
  offsets: HullOffsets,
  particulars: MainParticulars,
  opts: HullLoftMeshOptions = {}
): HullMeshData {
  const sectionPoints = opts.sectionPoints ?? DEFAULT_SECTION_POINTS;
  const geometry = { particulars };
  const deckZAt = (si: number) => offsets.deck_at_side_z_m?.[si] ?? particulars.depth_m;

  const loops: Point2[][] = offsets.stations_x_m.map((_, si) => buildStationLoop(offsets, si, deckZAt(si), sectionPoints));
  const loopSize = loops[0].length;

  const positions: number[] = [];
  const vertexOffset: number[] = [];
  for (let si = 0; si < offsets.stations_x_m.length; si++) {
    vertexOffset.push(positions.length / 3);
    const x = offsets.stations_x_m[si];
    for (const [y, z] of loops[si]) {
      const [sx, sy, sz] = shipToScene(geometry, [x, y, z]);
      positions.push(sx, sy, sz);
    }
  }

  const indexArr: number[] = [];
  for (let si = 0; si < offsets.stations_x_m.length - 1; si++) {
    const base0 = vertexOffset[si];
    const base1 = vertexOffset[si + 1];
    for (let j = 0; j < loopSize - 1; j++) {
      pushQuad(indexArr, base0 + j, base0 + j + 1, base1 + j + 1, base1 + j);
    }
    // deck cap: closes the open ends of the U (index 0 = stbd deck edge, last = port deck edge)
    pushQuad(indexArr, base0 + loopSize - 1, base0, base1, base1 + loopSize - 1);
  }
  capLoop(indexArr, vertexOffset[0], loopSize, /* flip */ true);
  capLoop(indexArr, vertexOffset[vertexOffset.length - 1], loopSize, /* flip */ false);

  const bufferGeometry = new THREE.BufferGeometry();
  bufferGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  bufferGeometry.setIndex(indexArr);
  bufferGeometry.computeVertexNormals();

  return {
    positions: bufferGeometry.getAttribute("position").array as Float32Array,
    normals: bufferGeometry.getAttribute("normal").array as Float32Array,
    index: bufferGeometry.getIndex()!.array as Uint32Array,
  };
}

/** One station's cross-section as an open loop: starboard deck edge -> keel -> port deck edge,
 * each side resampled to `sectionPoints` via a centripetal Catmull-Rom through the raw
 * (halfBreadth, z) table so the skin is smooth even with a coarse waterline table. */
function buildStationLoop(offsets: HullOffsets, si: number, deckZ: number, sectionPoints: number): Point2[] {
  const zs = offsets.waterlines_z_m.filter((z) => z <= deckZ);
  if (zs.length === 0 || zs[zs.length - 1] < deckZ) zs.push(deckZ);
  const starboardControl: Point2[] = zs.slice().reverse().map((z) => [halfBreadthAt(offsets, si, z), z]);

  const starboardSide = catmullRomResample(starboardControl, sectionPoints); // deck -> keel
  const portSide: Point2[] = starboardSide
    .slice()
    .reverse()
    .map(([y, z]): Point2 => [-y, z]); // keel -> deck, mirrored to port

  return [...starboardSide, ...portSide];
}

function pushQuad(indexArr: number[], a: number, b: number, c: number, d: number) {
  indexArr.push(a, b, c, a, c, d);
}

/** Fan-triangulates a loop from its own first vertex, closing it into a cap. `flip` reverses
 * winding so the two ends of the tube can be capped with opposite orientation. */
function capLoop(indexArr: number[], base: number, loopSize: number, flip: boolean) {
  for (let j = 1; j < loopSize - 1; j++) {
    const b = base + j;
    const c = base + j + 1;
    if (flip) indexArr.push(base, c, b);
    else indexArr.push(base, b, c);
  }
}
