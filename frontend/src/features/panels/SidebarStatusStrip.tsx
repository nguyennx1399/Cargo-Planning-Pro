/**
 * SidebarStatusStrip.tsx — the one line of plan health that is visible on EVERY sidebar tab.
 *
 * WHY IT EXISTS: moving Checks onto its own tab means an error introduced while the planner is on Load
 * (or View) would otherwise be invisible until they happened to open Check. This strip keeps placed /
 * warnings / errors in view everywhere, and clicking it opens the Check tab for the detail.
 *
 * The numbers come from `severityTotals` over the same report the Checks panel reads, so the strip and
 * the panel can never disagree.
 */
import type { StowagePlan, ValidationReport } from "@/types/domain";
import { severityTotals } from "@/lib/group-violations";
import { usePlanStore } from "@/store/usePlanStore";

export function SidebarStatusStrip({ plan, report }: { plan: StowagePlan; report?: ValidationReport }) {
  const setSidebarTab = usePlanStore((s) => s.setSidebarTab);
  if (!report) return <p className="status-strip muted small">Checking plan…</p>;

  const totals = severityTotals(report.violations);
  const placed = plan.placements.length;
  const total = plan.containers.length;

  return (
    <button
      type="button"
      className={`status-strip${totals.error > 0 ? " status-strip-error" : ""}`}
      onClick={() => setSidebarTab("check")}
      title="Open the Check tab"
    >
      <span>{`${placed} / ${total} placed`}</span>
      <span className={totals.warning > 0 ? "status-warn" : "muted"}>{`${totals.warning} warning${totals.warning === 1 ? "" : "s"}`}</span>
      <span className={totals.error > 0 ? "status-error" : "muted"}>{`${totals.error} error${totals.error === 1 ? "" : "s"}`}</span>
    </button>
  );
}
