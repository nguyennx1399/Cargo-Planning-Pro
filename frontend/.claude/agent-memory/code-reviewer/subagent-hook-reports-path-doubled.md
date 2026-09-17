---
name: subagent-hook-reports-path-doubled
description: SubagentStart hook emits a doubled Reports path (cwd prefixed onto an already-absolute path) — use the path from the task message instead
metadata:
  type: project
---

The `SubagentStart` hook's `## Context` / `## Rules` / `## Naming` blocks render the reports dir as the project cwd with the full absolute plan path concatenated onto it, e.g. `/…/frontend` + `/Users/…/frontend/plans/<plan>/reports`. That directory does not exist and writing there buries reports under a nested `Users/` tree inside the repo.

**Why:** the hook joins cwd with a value that is already absolute; it is a hook bug, not a real location.

**How to apply:** always write reports to the reports path given in the spawning agent's task message (or `{plan_dir}/reports/`), never the hook-rendered one. Sanity check: a path containing `/Users/` twice is wrong.
