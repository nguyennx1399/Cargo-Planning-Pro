/**
 * ChecksPanel.tsx — the plan-wide report, one collapsible row per rule (sidebar reorganisation, phase 02).
 *
 * Replaces an inline section that rendered `report.violations.slice(0, 50)`: 46% of the sidebar's height,
 * and on the demo plan 149 of 199 overstows silently missing. Grouping (`lib/group-violations.ts`) keeps
 * every COUNT complete, so the summary cannot drop data.
 *
 * An expanded group is still capped — "Overstow" alone is 199 rows — but HONESTLY: the first
 * `EXPANDED_CAP` items, then "…and N more" with a button to show them all. The difference from before is
 * that any truncation is stated on screen, never hidden.
 *
 * Clicking an item selects its first container, as the old list did — a real navigation aid, kept.
 */
import { useState } from "react";
import type { ValidationReport } from "@/types/domain";
import { SeverityAlertList } from "@/components/severity-alert-list";
import { groupViolations, ruleLabel } from "@/lib/group-violations";
import { usePlanStore } from "@/store/usePlanStore";

/** How many items an expanded group shows before it asks. */
const EXPANDED_CAP = 50;

export function ChecksPanel({ report }: { report?: ValidationReport }) {
  const setSelected = usePlanStore((s) => s.setSelected);
  // Per-rule UI state: which groups are open, and which have had "show all" pressed.
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});

  if (!report) {
    return (
      <section>
        <h2>Checks</h2>
        <p className="muted">Checking plan…</p>
      </section>
    );
  }

  const groups = groupViolations(report.violations);

  return (
    <section>
      <h2>Checks</h2>
      <dl className="kv">
        <dt>Placed</dt><dd>{report.kpis.placed ?? 0}</dd>
        <dt>Not placed</dt><dd>{report.kpis.unplaced ?? 0}</dd>
        <dt>Overstows</dt><dd>{report.kpis.overstows ?? 0}</dd>
        <dt>Rule errors</dt><dd>{report.kpis.errors ?? 0}</dd>
      </dl>

      {groups.length === 0 ? (
        <p className="ok">No rule violations.</p>
      ) : (
        <div className="check-groups">
          {groups.map((group) => {
            const isOpen = open[group.rule] ?? false;
            const all = showAll[group.rule] ?? false;
            const visible = all ? group.items : group.items.slice(0, EXPANDED_CAP);
            const hidden = group.count - visible.length;
            return (
              <div key={group.rule} className={`check-group check-group-${group.severity}`}>
                <button
                  type="button"
                  className="check-group-header"
                  aria-expanded={isOpen}
                  onClick={() => setOpen((o) => ({ ...o, [group.rule]: !isOpen }))}
                >
                  <span className="check-group-chevron" aria-hidden>{isOpen ? "▾" : "▸"}</span>
                  <span className="check-group-label">{ruleLabel(group.rule)}</span>
                  <span className="check-group-count">{group.count}</span>
                </button>
                {isOpen && (
                  <>
                    <SeverityAlertList
                      items={visible}
                      onItemClick={(v) => v.container_ids[0] && setSelected(v.container_ids[0])}
                    />
                    {hidden > 0 && (
                      <button
                        type="button"
                        className="check-group-more muted small"
                        onClick={() => setShowAll((s) => ({ ...s, [group.rule]: true }))}
                      >
                        {`…and ${hidden} more — show all`}
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
