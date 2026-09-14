import type { StabilityResult } from "@/engine/stability-indicative";
import { usePlanStore } from "@/store/usePlanStore";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SeverityAlertList } from "@/components/severity-alert-list";

const STATUS_LABEL: Record<StabilityResult["status"], string> = {
  ok: "OK",
  warning: "Warning",
  critical: "Unstable",
  out_of_range: "Out of table range",
};

/** Indicative (DEMO DATA) stability — never a substitute for the vessel's stability booklet
 * (RT-2, IACS UR L5). Banner stays visible any time this panel is shown. */
export function StabilityPanel({ attitude }: { attitude: StabilityResult | null }) {
  const exaggerate = usePlanStore((s) => s.exaggerate);
  const toggleExaggerate = usePlanStore((s) => s.toggleExaggerate);

  return (
    <section>
      <h2>Stability (indicative)</h2>
      <p className="muted small">DEMO DATA — computed from the demo hull only. Not for operational use; verify against the stability booklet.</p>
      {!attitude ? (
        <p className="muted">No hull geometry to compute stability from.</p>
      ) : (
        <>
          <p className={attitude.status === "ok" ? "ok" : attitude.status === "warning" ? "warning" : "error"}>
            {STATUS_LABEL[attitude.status]}
          </p>
          <dl className="kv">
            <dt>Δ</dt><dd>{attitude.displacement_t.toFixed(0)} t</dd>
            <dt>T mean</dt><dd>{attitude.draft_mean_m?.toFixed(2) ?? "—"} m</dd>
            <dt>T fwd</dt><dd>{attitude.draft_fwd_m?.toFixed(2) ?? "—"} m</dd>
            <dt>T aft</dt><dd>{attitude.draft_aft_m?.toFixed(2) ?? "—"} m</dd>
            <dt>Trim</dt><dd>{attitude.trim_m !== null ? `${Math.abs(attitude.trim_m).toFixed(2)} m ${attitude.trim_m >= 0 ? "by head" : "by stern"}` : "—"}</dd>
            <dt>List</dt><dd>{attitude.list_deg !== null ? `${Math.abs(attitude.list_deg).toFixed(1)}° ${attitude.list_deg >= 0 ? "stbd" : "port"}` : "—"}</dd>
            <dt>GM</dt><dd>{attitude.gm_m?.toFixed(2) ?? "—"} m</dd>
            <dt>KG</dt><dd>{attitude.kg_m.toFixed(2)} m</dd>
          </dl>
          {attitude.messages.length > 0 && (
            <SeverityAlertList
              items={attitude.messages.map((m) => ({ message: m, severity: attitude.status === "critical" ? "error" as const : "warning" as const }))}
            />
          )}
        </>
      )}
      <div className="flex items-center gap-2">
        <Checkbox id="exaggerate" checked={exaggerate > 1} onCheckedChange={toggleExaggerate} />
        <Label htmlFor="exaggerate">Exaggerate angle (×5, for visibility)</Label>
      </div>
    </section>
  );
}
