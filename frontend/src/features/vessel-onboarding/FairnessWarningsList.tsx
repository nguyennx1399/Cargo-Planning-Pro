import { SeverityAlertList } from "@/components/severity-alert-list";
import type { FairnessWarning } from "@/engine/hull/offsets-fairness-check";

export function FairnessWarningsList({ warnings }: { warnings: FairnessWarning[] }) {
  if (warnings.length === 0) return <p className="ok">No fairness warnings — grid looks smooth.</p>;
  return (
    <>
      <SeverityAlertList
        items={warnings.slice(0, 100).map((w) => ({
          message: `st ${w.station}, wl ${w.waterline}: ${w.message}`,
          severity: "warning" as const,
        }))}
      />
      {warnings.length > 100 && <p className="muted small mt-1.5">…and {warnings.length - 100} more</p>}
    </>
  );
}
