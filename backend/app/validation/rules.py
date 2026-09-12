"""Constraint rules. Each rule is a small pure function: context -> violations.

Add a rule = write a function + append it to ALL_RULES. Keep one test per rule.
"""
from __future__ import annotations

from collections.abc import Callable

from ..domain.models import ContainerType, Severity, Violation
from ..domain.slot import is_forty_bay
from .context import ValidationContext

Rule = Callable[[ValidationContext], list[Violation]]


def slot_exists(ctx: ValidationContext) -> list[Violation]:
    out = []
    for (bay, row, deck), items in ctx.columns.items():
        stack = ctx.stacks.get((bay, row, deck))
        for tier, cid in items:
            if stack is None or tier not in stack.tiers:
                out.append(Violation(rule="slot_exists", severity=Severity.ERROR,
                                     message=f"{cid}: slot does not exist on vessel",
                                     container_ids=[cid], slots=[f"{bay:02d}{row:02d}{tier:02d}"]))
    return out


def size_fits_bay(ctx: ValidationContext) -> list[Violation]:
    # TODO(phase-2): full 20'/40'/45' mixing rules (20' in odd bays, no 20' on top of 40', ...)
    out = []
    for p in ctx.plan.placements:
        c = ctx.containers[p.container_id]
        if c.size.value in ("40", "45") and not is_forty_bay(p.slot.bay):
            out.append(Violation(rule="size_fits_bay", severity=Severity.ERROR,
                                 message=f"{c.id}: {c.size.value}' container in 20' bay {p.slot.bay:02d}",
                                 container_ids=[c.id], slots=[p.slot.code]))
    return out


def stack_weight(ctx: ValidationContext) -> list[Violation]:
    out = []
    for key, items in ctx.columns.items():
        stack = ctx.stacks.get(key)
        if stack is None:
            continue
        total = sum(ctx.containers[cid].weight_t for _, cid in items)
        if total > stack.max_weight_t:
            bay, row, deck = key
            out.append(Violation(rule="stack_weight", severity=Severity.ERROR,
                                 message=f"Stack bay {bay:02d} row {row:02d} ({deck.value} deck): "
                                         f"{total:.1f}t > limit {stack.max_weight_t:.0f}t",
                                 container_ids=[cid for _, cid in items]))
    return out


def no_floating(ctx: ValidationContext) -> list[Violation]:
    out = []
    for key, items in ctx.columns.items():
        stack = ctx.stacks.get(key)
        if stack is None:
            continue
        occupied = {t for t, _ in items}
        for tier, cid in items:
            below = [t for t in stack.tiers if t < tier]
            if below and below[-1] not in occupied:
                out.append(Violation(rule="no_floating", severity=Severity.ERROR,
                                     message=f"{cid}: no container below (tier {below[-1]:02d} empty)",
                                     container_ids=[cid]))
    return out


def reefer_plug(ctx: ValidationContext) -> list[Violation]:
    out = []
    for key, items in ctx.columns.items():
        stack = ctx.stacks.get(key)
        if stack is None:
            continue
        for tier, cid in items:
            if ctx.containers[cid].type == ContainerType.REEFER and tier not in stack.reefer_tiers:
                out.append(Violation(rule="reefer_plug", severity=Severity.ERROR,
                                     message=f"{cid}: reefer on slot without plug", container_ids=[cid]))
    return out


def overstow(ctx: ValidationContext) -> list[Violation]:
    """Soft: a container discharged later sits on top of one discharged earlier."""
    # TODO(phase-3): also count hatch-cover overstow (on-deck cargo blocking under-deck discharge)
    out = []
    for items in ctx.columns.values():
        for i, (_, lower_id) in enumerate(items):
            lower_seq = ctx.pod_sequence.get(ctx.containers[lower_id].pod, 0)
            for _, upper_id in items[i + 1:]:
                if ctx.pod_sequence.get(ctx.containers[upper_id].pod, 0) > lower_seq:
                    out.append(Violation(rule="overstow", severity=Severity.WARNING,
                                         message=f"{upper_id} blocks {lower_id} (earlier discharge)",
                                         container_ids=[upper_id, lower_id]))
                    break
    return out


# TODO(phase-2): imdg_segregation, stack_height / visibility_line, oog_clearance
# TODO(phase-4): stability_limits, strength_limits (via app.stability)

ALL_RULES: list[Rule] = [slot_exists, size_fits_bay, stack_weight, no_floating, reefer_plug, overstow]
