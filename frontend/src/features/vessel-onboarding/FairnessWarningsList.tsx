import type { FairnessWarning } from "@/engine/hull/offsets-fairness-check";

export function FairnessWarningsList({ warnings }: { warnings: FairnessWarning[] }) {
  if (warnings.length === 0) return <p className="ok">No fairness warnings — grid looks smooth.</p>;
  return (
    <ul className="violations">
      {warnings.slice(0, 100).map((w, i) => (
        <li key={i} className="warning">
          st {w.station}, wl {w.waterline}: {w.message}
        </li>
      ))}
      {warnings.length > 100 && <li className="muted">…and {warnings.length - 100} more</li>}
    </ul>
  );
}
