import { useMemo } from "react";
import type { HullOffsets, MainParticulars } from "@/types/vessel-geometry";
import { computeHydrostaticTable } from "@/engine/hull/hydrostatic-table-calculator";

const ROWS_TO_SHOW = ["draft_m", "displacement_t", "kb_m", "lcb_m", "kmt_m", "tpc_t_per_cm", "mtc_t_m_per_cm", "cb"] as const;
const LABELS: Record<(typeof ROWS_TO_SHOW)[number], string> = {
  draft_m: "T (m)",
  displacement_t: "Δ (t)",
  kb_m: "KB (m)",
  lcb_m: "LCB (m, from AP)",
  kmt_m: "KMt (m)",
  tpc_t_per_cm: "TPC (t/cm)",
  mtc_t_m_per_cm: "MTC (t·m/cm)",
  cb: "Cb",
};

/**
 * Even-keel hydrostatics computed from the imported/lofted offsets — a `computed` cross-check
 * against the stability booklet (plan G3), never a substitute. No booklet-compare UI yet (that
 * needs a second CSV upload); `compareHydrostatics`/`parseBookletCsv` exist and are tested,
 * just not wired into this panel this pass.
 */
export function HydrostaticsCheckPanel({ offsets, particulars }: { offsets: HullOffsets; particulars: MainParticulars }) {
  const rows = useMemo(() => {
    const drafts = [0.25, 0.5, 0.75, 1].map((f) => Math.round(particulars.design_draft_m * f * 10) / 10);
    return computeHydrostaticTable(offsets, particulars, { drafts });
  }, [offsets, particulars]);

  return (
    <div>
      <p className="muted small">
        DEMO DATA — computed from the imported hull only. Not approved for operational stability use; verify against the vessel's stability booklet.
      </p>
      <table className="hydrostatics-table">
        <thead>
          <tr>
            {ROWS_TO_SHOW.map((k) => (
              <th key={k}>{LABELS[k]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.draft_m}>
              {ROWS_TO_SHOW.map((k) => (
                <td key={k}>{row[k].toFixed(k === "cb" ? 3 : 1)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
