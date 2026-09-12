import type { StowagePlan, ValidationReport, Vessel } from "@/types/domain";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// Currently dead code — App.tsx builds everything client-side (see data/build-demo-plan.ts).
// If this is ever wired up against a real backend, note that `res.json() as Promise<T>` bypasses
// tsc entirely: a StowagePlan from a backend that doesn't yet send breakbulk_cargo/
// breakbulk_placements would come back with those fields undefined, and every consumer
// (validate-plan.ts, use-indicative-stability.ts) would throw at runtime, not compile time.
export const api = {
  vessel: (id: string) => http<Vessel>(`/api/vessels/${id}`),
  demoPlan: (n = 150, seed = 42) => http<StowagePlan>(`/api/plans/demo?n=${n}&seed=${seed}`),
  validate: (plan: StowagePlan) =>
    http<ValidationReport>("/api/validate", { method: "POST", body: JSON.stringify(plan) }),
  // TODO(phase-3): solve(req) -> POST /api/stowage/solve
  // TODO(phase-2): importBaplie(file), exportBaplie(planId)
};
