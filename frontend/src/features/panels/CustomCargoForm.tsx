/**
 * CustomCargoForm.tsx — define a piece of project cargo by its own dimensions, then place it like any
 * other item.
 *
 * The drag half is FREE and no code here touches it: the unplaced list renders `plan.breakbulk_cargo`
 * minus what is placed, and every gesture path (list drag, list pick, ghost, area drop plane, commit)
 * keys off the item found in that array. Adding a well-formed item is the whole feature.
 *
 * This component only renders and reports — every rule about what a valid item is lives in
 * `lib/custom-cargo-input.ts`, where a node test can reach it.
 *
 * The item goes into the STORE, not straight into the plan: `App.tsx` rebuilds the plan on every
 * vessel/toggle change, and an item written into the plan would be destroyed by the next toggle
 * (`data/with-custom-cargo.ts` explains the merge).
 */
import { useState } from "react";
import type { Vessel } from "@/types/domain";
import { parseCustomCargo, type CustomCargoErrors, type CustomCargoFields } from "@/lib/custom-cargo-input";
import { usePlanStore } from "@/store/usePlanStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EMPTY: CustomCargoFields = { name: "", length: "", width: "", height: "", weight: "", kg: "" };

/** The four dimensions every item needs, in the order a planner reads them off a drawing. */
const DIMENSION_FIELDS: { key: keyof CustomCargoFields; label: string; unit: string }[] = [
  { key: "length", label: "Length", unit: "m" },
  { key: "width", label: "Width", unit: "m" },
  { key: "height", label: "Height", unit: "m" },
  { key: "weight", label: "Weight", unit: "t" },
];

export function CustomCargoForm({ vessel }: { vessel: Vessel }) {
  const customCargo = usePlanStore((s) => s.customCargo);
  const addCustomCargo = usePlanStore((s) => s.addCustomCargo);
  const [fields, setFields] = useState<CustomCargoFields>(EMPTY);
  const [errors, setErrors] = useState<CustomCargoErrors>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  const set = (key: keyof CustomCargoFields, value: string) => {
    setFields((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = () => {
    const result = parseCustomCargo(fields, vessel, customCargo);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    addCustomCargo(result.item);
    setFields(EMPTY);
    setErrors({});
    setShowAdvanced(false);
  };

  return (
    <div className="custom-cargo-form">
      <p className="muted small">
        Add your own piece — it appears in the unplaced list below and is placed and checked exactly like
        the demo cargo.
      </p>
      <div className="custom-cargo-grid">
        {DIMENSION_FIELDS.map(({ key, label, unit }) => (
          <div key={key} className="grid gap-1">
            <Label htmlFor={`cc-${key}`}>{`${label} (${unit})`}</Label>
            <Input
              id={`cc-${key}`}
              inputMode="decimal"
              value={fields[key] ?? ""}
              onChange={(e) => set(key, e.target.value)}
              aria-invalid={errors[key] ? true : undefined}
            />
            {errors[key] && <span className="custom-cargo-error">{errors[key]}</span>}
          </div>
        ))}
      </div>

      <div className="grid gap-1">
        <Label htmlFor="cc-name">Name (optional)</Label>
        <Input id="cc-name" value={fields.name} onChange={(e) => set("name", e.target.value)} placeholder="CUSTOM-1" />
        {errors.name && <span className="custom-cargo-error">{errors.name}</span>}
      </div>

      {/* Centre of gravity is behind a disclosure because it defaults sensibly, but it is EDITABLE
          because the default is only a guess: the domain type warns it is not always half the height —
          a nacelle carries its machinery low — and the stability figures read this number. */}
      <Button variant="ghost" size="sm" className="self-start" onClick={() => setShowAdvanced((v) => !v)}>
        {showAdvanced ? "Hide" : "Show"} centre of gravity
      </Button>
      {showAdvanced && (
        <div className="grid gap-1">
          <Label htmlFor="cc-kg">Centre of gravity above base (m)</Label>
          <Input
            id="cc-kg"
            inputMode="decimal"
            value={fields.kg ?? ""}
            onChange={(e) => set("kg", e.target.value)}
            placeholder="half the height"
            aria-invalid={errors.kg ? true : undefined}
          />
          {errors.kg && <span className="custom-cargo-error">{errors.kg}</span>}
        </div>
      )}

      <Button variant="outline" size="sm" className="self-start" onClick={submit}>
        Add project cargo
      </Button>
    </div>
  );
}
