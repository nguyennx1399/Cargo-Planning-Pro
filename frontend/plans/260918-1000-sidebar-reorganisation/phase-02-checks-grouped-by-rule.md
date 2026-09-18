# Phase 02 — Checks grouped by rule, with counts

## Context links

- `src/features/panels/Sidebar.tsx` — the Checks section: KPI list + `SeverityAlertList items={report.violations.slice(0, 50)}`
- `src/components/severity-alert-list.tsx` — renders one alert per violation; row click selects its first container
- `src/types/domain.ts:179` — `Violation { rule, severity, message, container_ids, slots }`
- `src/engine/validate-plan.ts` — produces `ValidationReport`

## Overview

- **Priority:** high — it is 46% of the sidebar, AND it silently drops data.
- **Status:** done (2026-09-18).
- Replace the flat, capped list with one row per rule (count + worst severity), each expandable to its
  own items.

## Key insights

- **The current list is truncated with no notice.** `slice(0, 50)` shows 50 of 199 overstows on the demo
  plan; the other 149 exist in the report and are invisible. A grouped view fixes this structurally: the
  COUNT per rule is always complete, so nothing can be silently dropped from the summary.
- **Row click must keep working.** Clicking a violation today selects its first container — a real
  navigation aid. The expanded items keep that behaviour; reuse `SeverityAlertList` for the expanded body
  rather than re-implementing it.
- **An expanded group can still be huge** (199 overstows). Cap the EXPANDED body too, but honestly: show
  the first N and a line "…and 149 more" with a way to show all. The difference from today is that the
  truncation is stated, not hidden.
- **Order matters**: errors before warnings, then by count descending, so the thing that blocks the plan
  is always the first row.
- Grouping is pure data shaping — put it in a node-testable function, not in the component.

## Requirements

**Functional**

1. One row per rule: human-readable rule name, count, severity (the worst in the group), tint by severity.
2. Rows sorted errors → warnings → info, then by count descending.
3. A row expands to its items (the existing alert rendering); clicking an item still selects its first
   container.
4. An expanded group shows at most N items, followed by "…and K more" and a control to show all — never a
   silent cut.
5. The KPI line (placed / not placed / overstows / errors) stays at the top of the section.
6. "No rule violations." when empty, as today.

**Non-functional**

- Grouping is a pure function with a test.
- Collapsed by default: the section is a handful of rows tall until the planner asks for detail.

## Architecture

- `src/lib/group-violations.ts` — pure:

```ts
export interface ViolationGroup {
  rule: string;
  severity: Severity;        // worst in the group
  count: number;
  items: Violation[];        // all of them — truncation is a VIEW decision, not a data one
}
export function groupViolations(violations: readonly Violation[]): ViolationGroup[];
```

- `src/features/panels/ChecksPanel.tsx` — the whole Checks section, moved out of `Sidebar.tsx` (which
  shrinks accordingly): KPI line + groups; each group a disclosure; body = `SeverityAlertList` over the
  first N items + the "…and K more" control.
- Rule labels: map the rule ids to readable names in the same file or next to it (`overstow` →
  "Overstow", `no_floating` → "No container below", …) with the raw id as a fallback for anything
  unmapped, so a new rule never renders blank.

## Related code files

**Create**
- `src/lib/group-violations.ts` + test
- `src/features/panels/ChecksPanel.tsx`

**Modify**
- `src/features/panels/Sidebar.tsx` (render `ChecksPanel` on the Check tab; the inline section goes)

**Delete** — none.

## Implementation steps

1. `group-violations.ts` + tests: grouping, worst-severity, ordering, empty input, the counts being
   complete (199 in → a group of 199, not 50).
2. `ChecksPanel` with disclosures and the honest cap.
3. Replace the inline Checks section.
4. `npm run typecheck`, `npx vitest run src/`.
5. Browser: on the loaded demo plan the section is a few rows tall; "Overstow · 199" expands to 50 items
   plus "…and 149 more"; "show all" shows 199; clicking an item selects its container.

## Todo list

- [x] `group-violations.ts` + tests
- [x] `ChecksPanel` (disclosures, honest cap, rule labels)
- [x] Sidebar uses it
- [x] typecheck + suite green
- [x] Browser: demo-horizon Overstow 199 → "…and 149 more — show all" → all 199 rows; item click selects DEMU0000058

## Success criteria

- The Checks section is a handful of rows until expanded.
- Every violation is COUNTED; any truncation is stated on screen.
- Clicking an item still takes you to its container.

## Risk assessment

| Risk | Mitigation |
|---|---|
| A new rule id renders with no label | Fallback to the raw id |
| "Show all" re-creates the 2 000 px wall | It is opt-in, per group; that is the point |
| Errors buried under a large warning group | Severity-first ordering |

## Security considerations

None.

## Next steps

Independent of phase 03.
