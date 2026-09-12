"""Stability & longitudinal strength.

TODO(phase-4):
- Inputs: lightship (weight, LCG, VCG), tank conditions, cargo placements,
  hydrostatic tables (displacement -> draft, KM, LCB, MTC, TPC).
- Outputs: displacement, drafts fwd/aft, trim, list, GM (with free surface correction),
  shear force & bending moment at frame stations vs. allowable.
- This is decision support only; results must be verified on a class-approved loading computer.
"""
from __future__ import annotations

from dataclasses import dataclass

from ..domain.models import StowagePlan, Vessel


@dataclass
class StabilityResult:
    displacement_t: float
    gm_m: float | None
    trim_m: float | None
    list_deg: float | None
    within_limits: bool | None


def compute_stability(vessel: Vessel, plan: StowagePlan) -> StabilityResult:
    """Skeleton: only sums cargo weight. Everything else is unknown until phase 4."""
    by_id = {c.id: c for c in plan.containers}
    cargo_t = sum(by_id[p.container_id].weight_t for p in plan.placements)
    return StabilityResult(
        displacement_t=cargo_t, gm_m=None, trim_m=None, list_deg=None, within_limits=None,
    )
