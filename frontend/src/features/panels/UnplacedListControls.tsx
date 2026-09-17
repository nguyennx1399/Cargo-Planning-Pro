import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UnplacedQuery, UnplacedSort, UnplacedGroupBy, SizeFilter, TypeFilter } from "@/lib/unplaced-query";

/**
 * The Unplaced section's controls (P2), split out of `UnplacedCargoList.tsx` to keep both files under
 * the 200-LOC rule. Presentation only: the query state has ONE owner (the list component) and this
 * component never filters anything itself — it reports the patch the planner asked for.
 *
 * The "Fits bay NN" toggle is offered only while a bay is filtered (`bay !== null`), because the
 * claim has no subject without one. Its `title` carries the caveat the wording cannot: the filter is
 * a size/parity claim, and the slot still has to pass every check before a box lands there (D6 —
 * this control decides what is SHOWN, never what may be placed).
 */
interface Props {
  query: UnplacedQuery;
  /** The viewer's bay filter (`usePlanStore.bayFilter`), or null — decides whether the toggle exists
   * at all, and what it is labelled. */
  bay: number | null;
  onChange: (patch: Partial<UnplacedQuery>) => void;
  onClear: () => void;
}

const SIZES: SizeFilter[] = ["any", "20", "40", "45"];
const TYPES: TypeFilter[] = ["any", "DRY", "REEFER", "OPEN_TOP", "FLAT_RACK", "TANK"];
const SORTS: { value: UnplacedSort; label: string }[] = [
  { value: "cargo", label: "Cargo order" },
  { value: "pod", label: "POD rotation" },
  { value: "weight", label: "Weight, heavy first" },
  { value: "id", label: "Id" },
];
const GROUPS: { value: UnplacedGroupBy; label: string }[] = [
  { value: "none", label: "No grouping" },
  { value: "pod", label: "Group by POD" },
  { value: "type", label: "Group by type" },
  { value: "size", label: "Group by size" },
];

/** The caveat the bay claim must carry wherever it is shown — the checkbox here, the per-row badge in
 * `UnplacedCargoList` — so the two can never word the same claim differently. */
export const BAY_CAVEAT = "Size and parity only — the slot still has to pass every check.";

/** One labelled `Select` in the 2-column control grid. */
function Picker<T extends string>({ id, label, value, options, onPick }: {
  id: string;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onPick: (value: T) => void;
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={(v) => v && onPick(v as T)}>
        <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export function UnplacedListControls({ query, bay, onChange, onClear }: Props) {
  const sizeOptions = SIZES.map((s) => ({ value: s, label: s === "any" ? "Any size" : `${s}'` }));
  const typeOptions = TYPES.map((t) => ({ value: t, label: t === "any" ? "Any type" : t }));

  return (
    <div className="unplaced-controls">
      {/* `type="search"` for the browser's own clear affordance; the label is for screen readers
          only, since the placeholder already names the fields the search covers. */}
      <Input
        className="unplaced-search"
        type="search"
        value={query.text}
        aria-label="Filter unplaced cargo"
        placeholder="id, size, type, POD or weight"
        onChange={(e) => onChange({ text: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-1.5">
        <Picker id="unplaced-size" label="Size" value={query.size} options={sizeOptions} onPick={(size) => onChange({ size })} />
        <Picker id="unplaced-type" label="Type" value={query.type} options={typeOptions} onPick={(type) => onChange({ type })} />
        <Picker id="unplaced-sort" label="Sort" value={query.sort} options={SORTS} onPick={(sort) => onChange({ sort })} />
        <Picker id="unplaced-group" label="Group" value={query.group} options={GROUPS} onPick={(group) => onChange({ group })} />
      </div>
      <div className="flex items-center justify-between gap-2 mt-1.5">
        {bay !== null ? (
          <span className="flex items-center gap-2" title={BAY_CAVEAT}>
            <Checkbox id="unplaced-fits-bay" checked={query.fitsBay} onCheckedChange={(v) => onChange({ fitsBay: v === true })} />
            <Label htmlFor="unplaced-fits-bay">Fits bay {String(bay).padStart(2, "0")}</Label>
          </span>
        ) : <span className="muted small">Pick a bay to check the fit</span>}
        <Button variant="outline" size="sm" onClick={onClear}>Clear</Button>
      </div>
    </div>
  );
}
