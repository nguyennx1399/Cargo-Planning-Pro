from __future__ import annotations

from ..domain.models import Severity, StowagePlan, ValidationReport, Vessel
from .context import ValidationContext
from .rules import ALL_RULES


def validate(vessel: Vessel, plan: StowagePlan) -> ValidationReport:
    ctx = ValidationContext(vessel=vessel, plan=plan)
    violations = [v for rule in ALL_RULES for v in rule(ctx)]
    kpis = {
        "placed": float(len(plan.placements)),
        "unplaced": float(len(plan.unplaced)),
        "overstows": float(sum(1 for v in violations if v.rule == "overstow")),
        "errors": float(sum(1 for v in violations if v.severity == Severity.ERROR)),
    }
    return ValidationReport(ok=kpis["errors"] == 0, violations=violations, kpis=kpis)
