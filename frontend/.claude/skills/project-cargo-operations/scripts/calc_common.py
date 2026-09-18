"""Shared helpers for the project-cargo calculators.

Units used across all modules: mass t, force kN, length m, angles in degrees (converted internally),
section modulus cm3, stress kN/cm2. g = 9.81 m/s2 as in the source guideline.
"""
import math

G = 9.81


def rad(deg):
    """Degrees -> radians."""
    return math.radians(deg)


def require_positive(**values):
    """Raise ValueError for any value that is not strictly positive."""
    for name, value in values.items():
        if value is None or not math.isfinite(value) or value <= 0:
            raise ValueError(f"{name} must be > 0 (got {value})")


def require_non_negative(**values):
    """Raise ValueError for any value that is negative."""
    for name, value in values.items():
        if value is None or not math.isfinite(value) or value < 0:
            raise ValueError(f"{name} must be >= 0 (got {value})")


def require_angle_below(limit_deg, **angles):
    """Raise ValueError for any |angle| at or beyond limit_deg (e.g. 90 deg makes cos = 0)."""
    for name, value in angles.items():
        if abs(value) >= limit_deg:
            raise ValueError(f"|{name}| must be < {limit_deg} deg (got {value})")


def check(value, limit, higher_is_ok):
    """Uniform limit verdict: ok flag plus signed margin (positive = inside the limit)."""
    margin = value - limit if higher_is_ok else limit - value
    return {"ok": margin >= 0, "limit": limit, "margin": round(margin, 4)}
