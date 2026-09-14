import { useMemo, useState } from "react";
import type { HullOffsets, MainParticulars } from "@/types/vessel-geometry";
import { parseOffsetsCsv, type ParseError } from "@/engine/hull/offsets-csv-parser";
import { normalizeOffsets, type OffsetsCsvMeta } from "@/engine/hull/offsets-normalizer";
import { checkOffsetsFairness, type FairnessWarning } from "@/engine/hull/offsets-fairness-check";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SeverityAlertList } from "@/components/severity-alert-list";
import { ParticularsForm } from "./ParticularsForm";
import { FairnessWarningsList } from "./FairnessWarningsList";
import { BodyPlanView } from "./BodyPlanView";
import { OffsetsPreview3D } from "./OffsetsPreview3D";
import { HydrostaticsCheckPanel } from "./HydrostaticsCheckPanel";
import wigleySampleCsv from "@/data/fixtures/wigley-offsets.csv?raw";

type ImportResult = { kind: "errors"; errors: ParseError[] } | { kind: "ok"; offsets: HullOffsets; warnings: FairnessWarning[] };

const DEFAULT_PARTICULARS: MainParticulars = {
  loa_m: 172,
  lbp_m: 160,
  aft_overhang_m: 6,
  beam_m: 27.4,
  depth_m: 14,
  design_draft_m: 9.8,
  cb: 0.68,
};

/**
 * L2 offsets onboarding: paste/upload a CSV, check it for typos, preview the body plan and 3D
 * hull. Station mode is "x_m" only for now (station values already given as x in meters) —
 * station_number/frame modes exist in offsets-normalizer.ts but aren't exposed in this UI yet.
 * TODO(phase-5): grid editing (currently read-only preview), pdf.js GA tracer.
 */
export function OffsetsImportPanel() {
  const [csvText, setCsvText] = useState("");
  const [format, setFormat] = useState<"long" | "wide">("long");
  const [unit, setUnit] = useState<"mm" | "m">("m");
  const [particulars, setParticulars] = useState<MainParticulars>(DEFAULT_PARTICULARS);

  const result: ImportResult | null = useMemo(() => {
    if (csvText.trim().length === 0) return null;
    const parsed = parseOffsetsCsv(csvText, format);
    if ("errors" in parsed) return { kind: "errors", errors: parsed.errors };
    const meta: OffsetsCsvMeta = { unit, station: { kind: "x_m" } };
    const offsets = normalizeOffsets(parsed.table, meta);
    const warnings = checkOffsetsFairness(offsets, { beamM: particulars.beam_m });
    return { kind: "ok", offsets, warnings };
  }, [csvText, format, unit, particulars.beam_m]);

  const handleFile = (file: File) => {
    if (file.size > 1_000_000) {
      setCsvText("");
      alert("File too large (limit 1 MB for this demo importer).");
      return;
    }
    file.text().then(setCsvText);
  };

  return (
    <div className="onboarding-panel">
      <section>
        <h2>Vessel particulars</h2>
        <ParticularsForm particulars={particulars} onChange={setParticulars} />
      </section>

      <section>
        <h2>Offsets CSV</h2>
        <div className="field-row">
          <div className="grid gap-1.5">
            <Label htmlFor="csv-format">Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as "long" | "wide")}>
              <SelectTrigger id="csv-format" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="long">Long (station,waterline_z,half_breadth)</SelectItem>
                <SelectItem value="wide">Wide (station,&lt;wl0&gt;,&lt;wl1&gt;,...)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="csv-unit">Unit</Label>
            <Select value={unit} onValueChange={(v) => setUnit(v as "mm" | "m")}>
              <SelectTrigger id="csv-unit" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="m">meters</SelectItem>
                <SelectItem value="mm">millimeters</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        <Button variant="outline" onClick={() => { setCsvText(wigleySampleCsv); setFormat("long"); setUnit("m"); }}>
          Load Wigley sample (synthetic, analytic — for testing this importer)
        </Button>
        <Textarea
          className="font-mono text-xs"
          rows={6}
          placeholder="Or paste CSV here…"
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
        />
      </section>

      {result?.kind === "errors" && (
        <section>
          <h2>Parse errors</h2>
          <SeverityAlertList
            items={result.errors.map((err) => ({ message: `line ${err.line}: ${err.message}`, severity: "error" as const }))}
          />
        </section>
      )}

      {result?.kind === "ok" && (
        <>
          <section>
            <h2>Fairness check</h2>
            <FairnessWarningsList warnings={result.warnings} />
          </section>
          <section>
            <h2>Body plan</h2>
            <BodyPlanView offsets={result.offsets} beamM={particulars.beam_m} />
          </section>
          <section>
            <h2>3D preview</h2>
            <div className="onboarding-preview-3d">
              <OffsetsPreview3D offsets={result.offsets} particulars={particulars} />
            </div>
          </section>
          <section>
            <h2>Hydrostatics (computed)</h2>
            <HydrostaticsCheckPanel offsets={result.offsets} particulars={particulars} />
          </section>
        </>
      )}
    </div>
  );
}
