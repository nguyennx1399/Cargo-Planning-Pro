import type { HullOffsets } from "@/types/vessel-geometry";

/**
 * Classic naval-architecture body plan: stations aft of midship drawn mirrored on the LEFT
 * (half-breadth going left from the centreline), stations forward of midship on the RIGHT —
 * every station sharing one vertical (z) axis and centreline, the way a naval architect checks
 * lines fairness by eye.
 */
export function BodyPlanView({ offsets, beamM }: { offsets: HullOffsets; beamM: number }) {
  const width = 480;
  const height = 260;
  const pad = 20;
  const maxZ = Math.max(...offsets.waterlines_z_m, 1);
  const halfBeam = beamM / 2;
  const scale = (height - 2 * pad) / maxZ;
  const pxPerM = Math.min(scale, (width / 2 - pad) / (halfBeam || 1));

  const midshipX = (offsets.stations_x_m[0] + offsets.stations_x_m[offsets.stations_x_m.length - 1]) / 2;
  const toY = (z: number) => height - pad - z * pxPerM;
  const centerX = width / 2;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="body-plan" role="img" aria-label="Body plan">
      <line x1={centerX} y1={0} x2={centerX} y2={height} stroke="var(--line)" />
      <line x1={0} y1={height - pad} x2={width} y2={height - pad} stroke="var(--line)" />
      {offsets.stations_x_m.map((x, si) => {
        const isAft = x < midshipX;
        const points = offsets.waterlines_z_m
          .map((z, wi) => {
            const v = offsets.half_breadths_m[si][wi];
            if (v === null) return null;
            const dx = v * pxPerM * (isAft ? -1 : 1);
            return `${centerX + dx},${toY(z)}`;
          })
          .filter((p): p is string => p !== null);
        if (points.length < 2) return null;
        return (
          <polyline
            key={si}
            points={points.join(" ")}
            fill="none"
            stroke={isAft ? "#5E6E7B" : "#1D2B36"}
            strokeWidth={1}
          />
        );
      })}
    </svg>
  );
}
