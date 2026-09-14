import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { Severity } from "@/types/domain";

export interface SeverityItem {
  message: string;
  severity: Severity;
}

interface SeverityAlertListProps<T extends SeverityItem> {
  items: T[];
  onItemClick?: (item: T, index: number) => void;
  className?: string;
}

export function SeverityAlertList<T extends SeverityItem>({ items, onItemClick, className }: SeverityAlertListProps<T>) {
  return (
    // aria-live="polite" on the list, not role="alert" (Alert's default) on every item — these
    // are static/frequently-recomputed list rows, not one-off urgent alerts; per-item role="alert"
    // would re-announce assertively on every render (e.g. every playback tick in StabilityPanel).
    <div className={cn("grid gap-1.5 mt-2.5", className)} aria-live="polite">
      {items.map((item, i) => (
        <Alert
          key={i}
          role={onItemClick ? "button" : undefined}
          tabIndex={onItemClick ? 0 : undefined}
          variant={item.severity === "error" ? "destructive" : "warning"}
          className={cn("py-2 px-3 text-xs", onItemClick && "cursor-pointer")}
          onClick={() => onItemClick?.(item, i)}
          onKeyDown={onItemClick ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onItemClick(item, i)) : undefined}
        >
          <AlertDescription>{item.message}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
