import type { MainParticulars } from "@/types/vessel-geometry";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELDS: { key: keyof MainParticulars; label: string }[] = [
  { key: "loa_m", label: "LOA (m)" },
  { key: "lbp_m", label: "LBP (m)" },
  { key: "aft_overhang_m", label: "Aft overhang (m)" },
  { key: "beam_m", label: "Beam (m)" },
  { key: "depth_m", label: "Depth (m)" },
  { key: "design_draft_m", label: "Design draft (m)" },
  { key: "cb", label: "Cb (reference only, not fitted)" },
];

export function ParticularsForm({
  particulars,
  onChange,
}: {
  particulars: MainParticulars;
  onChange: (p: MainParticulars) => void;
}) {
  return (
    <div className="particulars-form">
      {FIELDS.map(({ key, label }) => (
        <div key={key} className="grid gap-1.5">
          <Label htmlFor={key}>{label}</Label>
          <Input
            id={key}
            type="number"
            step="any"
            value={particulars[key]}
            onChange={(e) => onChange({ ...particulars, [key]: Number(e.target.value) })}
          />
        </div>
      ))}
    </div>
  );
}
