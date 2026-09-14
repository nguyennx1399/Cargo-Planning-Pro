import { useMemo } from "react";
import type { PortCall } from "@/types/domain";
import { usePlanStore, type ColorMode, type PaletteMode } from "@/store/usePlanStore";
import { podColorMap } from "@/lib/colors";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const MODES: { id: ColorMode; label: string }[] = [
  { id: "pod", label: "POD" },
  { id: "weight", label: "Weight" },
  { id: "type", label: "Type" },
];

/** Extracted from Sidebar.tsx to keep it under the ~200-line convention — self-contained
 * (only needs `ports` for the POD legend, everything else comes from usePlanStore). */
export function ColorModeControl({ ports }: { ports: PortCall[] }) {
  const colorMode = usePlanStore((s) => s.colorMode);
  const setColorMode = usePlanStore((s) => s.setColorMode);
  const paletteMode = usePlanStore((s) => s.paletteMode);
  const setPaletteMode = usePlanStore((s) => s.setPaletteMode);
  const pods = useMemo(() => podColorMap(ports, paletteMode), [ports, paletteMode]);

  return (
    <section>
      <h2>Color by</h2>
      <ToggleGroup value={[colorMode]} onValueChange={(v) => v[0] && setColorMode(v[0] as ColorMode)} aria-label="Color by">
        {MODES.map((m) => (
          <ToggleGroupItem key={m.id} value={m.id}>{m.label}</ToggleGroupItem>
        ))}
      </ToggleGroup>
      {colorMode === "pod" && (
        <>
          <div className="grid gap-1.5 mt-2">
            <Label htmlFor="palette-mode">Palette</Label>
            <Select value={paletteMode} onValueChange={(v) => setPaletteMode(v as PaletteMode)}>
              <SelectTrigger id="palette-mode" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="colorblind">Colorblind-safe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ul className="legend">
            {ports.filter((p) => p.sequence > 0).map((p) => (
              <li key={p.locode}>
                <i style={{ background: pods[p.locode] }} /> {p.name} <span className="muted">{p.locode}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
