"""Ship stability during crane lifts (BBC Guideline v1.0 ch. 1.3).

Masses t, levels m above base. The worst condition is the highest topping position of the crane(s).
"""
import math

from calc_common import check, require_non_negative, require_positive

GM_MIN_M = 0.6      # never less (source §1.3.3)
GM_TARGET_M = 1.0   # "in the range of 1 metre"


def crane_boom_heeling_mass(boom_mass_t, boom_cog_from_pivot_m, boom_effective_length_m):
    """§1.3.1 Part of the boom mass acting at the boom top: Q = mb * e1 / e."""
    require_positive(boom_mass_t=boom_mass_t, boom_effective_length_m=boom_effective_length_m)
    require_non_negative(boom_cog_from_pivot_m=boom_cog_from_pivot_m)
    return {"Q_t": round(boom_mass_t * boom_cog_from_pivot_m / boom_effective_length_m, 2)}


def anti_heeling_ballast(cargo_t, gear_t, boom_q_t, half_breadth_m, outreach_m, tank_distance_m):
    """§1.3.3 Ballast to be transferred between opposite heeling tanks: S = (P+R+Q)*(B/2 + a)/sy.

    outreach_m (a) is measured from the ship's rail; tank_distance_m (sy) between tank centres.
    """
    require_positive(cargo_t=cargo_t, half_breadth_m=half_breadth_m, tank_distance_m=tank_distance_m)
    require_non_negative(gear_t=gear_t, boom_q_t=boom_q_t, outreach_m=outreach_m)
    lever = half_breadth_m + outreach_m
    s = (cargo_t + gear_t + boom_q_t) * lever / tank_distance_m
    # S rounded up: the tank capacity must never fall short of the requirement.
    return {"S_t": math.ceil(s * 10) / 10, "heeling_moment_tm": round((cargo_t + gear_t + boom_q_t) * lever, 1)}


def lifting_kg_gm(displacement_t, kg_c, km_lift, cargo_t, gear_t, boom_q_t, boom_top_p, boom_sea_q,
                  gear_sea_r, ballast_s_t, ballast_sz):
    """§1.3.3 KG_C* and GM_C* at the worst lifting moment.

    KG* = KG + [P(p-KG) + Q(p-q) + R(p-r) + S*sz] / (disp + P); GM* = KM* - KG*, where km_lift is KM for
    the lifting displacement (disp + P) in the actual trim. kg_c must already be free-surface corrected.
    """
    require_positive(displacement_t=displacement_t, kg_c=kg_c, km_lift=km_lift, cargo_t=cargo_t)
    require_non_negative(gear_t=gear_t, boom_q_t=boom_q_t, ballast_s_t=ballast_s_t)
    moment = (cargo_t * (boom_top_p - kg_c) + boom_q_t * (boom_top_p - boom_sea_q)
              + gear_t * (boom_top_p - gear_sea_r) + ballast_s_t * ballast_sz)
    kg_star = kg_c + moment / (displacement_t + cargo_t)
    gm_star = km_lift - kg_star
    return {"KG_star_m": round(kg_star, 3), "GM_star_m": round(gm_star, 3),
            "min_0_6": check(gm_star, GM_MIN_M, higher_is_ok=True),
            "at_or_above_target_1_0": gm_star >= GM_TARGET_M - 0.1}


def swl_radius_interpolate(swl_table, load_t):
    """§1.3.1 Linear interpolation of working radius for a load between tabulated SWL steps.

    swl_table: list of [radius_m, swl_t] pairs (any order). Returns the max radius allowed for load_t.
    """
    require_positive(load_t=load_t)
    pts = sorted(((float(r), float(w)) for r, w in swl_table), key=lambda p: p[1])
    if len(pts) < 2:
        raise ValueError("need at least two [radius, swl] pairs")
    if load_t > pts[-1][1]:
        raise ValueError(f"load {load_t} t exceeds max SWL {pts[-1][1]} t")
    if load_t <= pts[0][1]:
        return {"max_radius_m": pts[0][0], "note": "at or below smallest tabulated SWL"}
    for (r_lo, w_lo), (r_hi, w_hi) in zip(pts, pts[1:]):
        if w_lo <= load_t <= w_hi:
            radius = r_lo + (load_t - w_lo) * (r_hi - r_lo) / (w_hi - w_lo)
            return {"max_radius_m": round(radius, 2)}
    raise ValueError("load not bracketed by table")  # unreachable with sorted input


def hoisting_angle_critical_load_pct(hoisting_angle_deg, friction=0.3):
    """§1.4.1 Hook load share above which a unit resting on barge/jetty may slide at hoisting angle delta.

    Sliding starts when horizontal pull T*sin(d) exceeds mu*(W - T*cos(d)) -> T/W = mu/(sin d + mu cos d).
    Reproduces the source table (1/2/3 deg -> ~95/90/85 % at mu 0.3).
    """
    require_positive(friction=friction)
    d = math.radians(abs(hoisting_angle_deg))
    if d <= 0:
        return {"critical_load_pct": 100.0}
    pct = 100 * friction / (math.sin(d) + friction * math.cos(d))
    return {"critical_load_pct": round(min(pct, 100.0), 1)}
