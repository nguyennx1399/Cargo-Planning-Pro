"""Bedding / load-spreading calculations (BBC Guideline v1.0 ch. 2).

Hatch covers and tween-deck pontoons behave as beams resting on their ends: the governing check for a
concentrated load is the bending moment vs the moment produced by the rated uniform load (BM_lim).
"""
from calc_common import G, check, require_non_negative, require_positive

# Beam cross-section data. Timber: actual (sawn/shrunk) edge in cm for nominal square sizes; Wx = b*h^2/6.
TIMBER_ACTUAL_EDGE_CM = {10: 9.6, 15: 14.6, 20: 19.5, 25: 24.5}
# Standard HEB section modulus Wx [cm3] by nominal height (cm) - public steel-section data.
HEB_WX_CM3 = {10: 90, 12: 144, 14: 216, 16: 311, 18: 426, 20: 570, 22: 736, 24: 938, 26: 1150, 28: 1380,
              30: 1680, 32: 1930, 34: 2160, 36: 2400, 40: 2880}
PERMISSIBLE_STRESS = {"timber": 1.0, "steel": 15.0}  # kN/cm2 (mild steel; HT steel <= 65 % of yield)
# Condition-A max beam length r_max = min(1.2*s + k1, s + k2) [m], keyed by (material, nominal edge cm).
R_MAX_COEFFS = {("timber", 10): (0.8, 1.0), ("timber", 15): (1.5, 2.0), ("timber", 20): (2.0, 3.0),
                ("timber", 25): (2.4, 4.0), ("steel", 12): (3.0, 4.0), ("steel", 14): (3.2, 4.2),
                ("steel", 16): (3.4, 4.4), ("steel", 18): (3.6, 4.6), ("steel", 26): (4.0, 5.0),
                ("steel", 30): (5.0, 6.0)}
FLATRACK_SPAN_M = {"20": 6.0, "40": 12.0}  # effective span that reproduces the source factor tables


def bm_lim_pal(pal_t_m2, width_m, length_m):
    """§2.1.4 Limit moment of a cover/pontoon from its rated uniform load: PAL*w*t*g*w/8 [kN m].
    width_m = transverse span between supports, length_m = fore-aft length of the panel."""
    require_positive(pal_t_m2=pal_t_m2, width_m=width_m, length_m=length_m)
    return {"BM_lim_kNm": round(pal_t_m2 * width_m * length_m * G * width_m / 8, 1),
            "max_uniform_load_t": round(pal_t_m2 * width_m * length_m, 1)}


def bm_lim_stacks(n_stacks, stack_mass_t, width_m):
    """§2.1.4 Limit moment along a container-socket girder: n * m_s * g * w / 8 [kN m]."""
    require_positive(n_stacks=n_stacks, stack_mass_t=stack_mass_t, width_m=width_m)
    return {"BM_lim_kNm": round(n_stacks * stack_mass_t * G * width_m / 8, 1)}


def bm_single_unit(mass_t, span_m, loaded_length_m, offset_m=0.0, mode="contact", bm_lim_knm=None):
    """§2.1.5 One unit on a cover/pontoon of span t. mode 'contact': bedding carries load over s;
    mode 'bridging': unit rests only on the two ends of s (unit must be stiff enough to bridge)."""
    require_positive(mass_t=mass_t, span_m=span_m, loaded_length_m=loaded_length_m)
    t, s, e = span_m, loaded_length_m, abs(offset_m)
    if e + s / 2 > t / 2 + 1e-9:
        raise ValueError("load extends beyond the supports (e + s/2 > t/2)")
    w = mass_t * G
    if mode == "contact":
        bm = w / 8 * (2 * t - s) * (1 - 4 * e * e / (t * t))
    elif mode == "bridging":
        bm = w / 8 * (2 * t - 2 * s - 4 * e / t * (2 * e - s))
    else:
        raise ValueError("mode must be 'contact' or 'bridging'")
    out = {"BM_kNm": round(bm, 1), "F1_kN": round(w / 2 * (1 + 2 * e / t), 1),
           "F2_kN": round(w / 2 * (1 - 2 * e / t), 1)}
    if bm_lim_knm is not None:
        out["check"] = check(bm, bm_lim_knm, higher_is_ok=False)
    return out


def bm_multi_units(span_m, units, bm_lim_knm=None, steps=20000):
    """§2.1.5 Several units on one cover: max BM from the shear curve. Each unit = {mass_t, width_m,
    centre_m} with centre measured from support 1 and the load spread uniformly over width_m."""
    require_positive(span_m=span_m)
    if not units:
        raise ValueError("units must not be empty")
    loads = []
    for u in units:
        require_positive(mass_t=u["mass_t"], width_m=u["width_m"])
        lo, hi = u["centre_m"] - u["width_m"] / 2, u["centre_m"] + u["width_m"] / 2
        if lo < -1e-9 or hi > span_m + 1e-9:
            raise ValueError(f"unit at {u['centre_m']} m extends beyond the span")
        loads.append((u["mass_t"] * G, lo, hi))
    total = sum(w for w, _, _ in loads)
    f2 = sum(w * (lo + hi) / 2 for w, lo, hi in loads) / span_m
    f1 = total - f2

    def moment(x):
        m = f1 * x
        for w, lo, hi in loads:  # part of each distributed load left of x, times its lever
            if x > lo:
                covered = min(x, hi) - lo
                m -= w * covered / (hi - lo) * (x - (lo + covered / 2))
        return m

    best_x, best_m = 0.0, 0.0
    for i in range(steps + 1):
        x = span_m * i / steps
        m = moment(x)
        if m > best_m:
            best_x, best_m = x, m
    out = {"F1_kN": round(f1, 1), "F2_kN": round(f2, 1), "BM_max_kNm": round(best_m, 1),
           "at_m": round(best_x, 3)}
    if bm_lim_knm is not None:
        out["check"] = check(best_m, bm_lim_knm, higher_is_ok=False)
    return out


def section_modulus(material, nominal_cm):
    """Wx [cm3] for a square timber beam (actual dims) or an HEB steel beam."""
    if material == "timber":
        a = TIMBER_ACTUAL_EDGE_CM.get(nominal_cm)
        if a is None:
            raise ValueError(f"timber size must be one of {sorted(TIMBER_ACTUAL_EDGE_CM)}")
        return round(a ** 3 / 6, 1)
    if material == "steel":
        if nominal_cm not in HEB_WX_CM3:
            raise ValueError(f"HEB size must be one of {sorted(HEB_WX_CM3)}")
        return HEB_WX_CM3[nominal_cm]
    raise ValueError("material must be 'timber' or 'steel'")


def beams_required(mass_t, beam_length_m, loaded_length_m, material, nominal_cm=None, wx_cm3=None,
                   condition="A", offset_m=0.0, stress_kn_cm2=None):
    """§2.2.3 Number of load-spreading beams.
    A: beams lie full length on the deck -> n = m g (r - s) 100 / (8 sigma Wx), r = beam length.
    B: beams bridge between supports r apart -> (2r - s), times (1 - 4e^2/r^2) when loaded off-centre."""
    require_positive(mass_t=mass_t, beam_length_m=beam_length_m, loaded_length_m=loaded_length_m)
    require_non_negative(offset_m=offset_m)
    if material not in PERMISSIBLE_STRESS:
        raise ValueError("material must be 'timber' or 'steel'")
    wx = wx_cm3 if wx_cm3 is not None else section_modulus(material, nominal_cm)
    sigma = stress_kn_cm2 if stress_kn_cm2 is not None else PERMISSIBLE_STRESS[material]
    require_positive(wx_cm3=wx, stress_kn_cm2=sigma)
    r, s, e = beam_length_m, loaded_length_m, offset_m
    if e + s / 2 > r / 2 + 1e-9:
        raise ValueError("load extends beyond the beam supports (e + s/2 > r/2)")
    if condition == "A":
        lever = r - s
    elif condition == "B":
        lever = (2 * r - s) * (1 - 4 * e * e / (r * r))
    else:
        raise ValueError("condition must be 'A' or 'B'")
    if lever <= 0:
        raise ValueError("beam must be longer than the loaded length")
    n = mass_t * G * lever * 100 / (8 * sigma * wx)
    out = {"n_exact": round(n, 2), "n_required": max(1, int(-(-n // 1))), "Wx_cm3": wx}
    coeffs = R_MAX_COEFFS.get((material, nominal_cm)) if condition == "A" else None
    if coeffs:
        r_max = min(1.2 * s + coeffs[0], s + coeffs[1])
        out["r_max_m"] = round(r_max, 2)
        out["length_check"] = check(r, r_max, higher_is_ok=False)
    elif condition == "A":
        out["length_check"] = "not tabulated for this section - verify beam deflection vs deck"
    return out


def flatrack_factor(size, loaded_length_m, offset_m=0.0):
    """§2.2.5 Permissible concentrated load factor on a 20'/40' flatrack (P = P0 * factor).
    factor = L/((2L - s)(1 - 4e^2/L^2)) with L = 6 m (20') or 12 m (40'); matches the source tables."""
    span = FLATRACK_SPAN_M.get(str(int(float(size))))
    if span is None:
        raise ValueError("size must be '20' or '40'")
    require_positive(loaded_length_m=loaded_length_m)
    s, e = loaded_length_m, abs(offset_m)
    if s > span or e + s / 2 > span / 2 + 1e-9:
        raise ValueError("load does not fit on the platform with this offset")
    return {"factor": round(span / ((2 * span - s) * (1 - 4 * e * e / (span * span))), 3)}


def flatrack_bridging_load(payload_t, castings_span_m, bridged_length_m):
    """§2.2.5 Load bridging distance s on a platform: P = P0 * r / (2r - 2s). For s > r/2 the result
    can exceed P0 - then corner-casting loads to the deck govern instead."""
    require_positive(payload_t=payload_t, castings_span_m=castings_span_m)
    require_non_negative(bridged_length_m=bridged_length_m)
    r, s = castings_span_m, bridged_length_m
    if s >= r:
        raise ValueError("bridged length must be shorter than the casting span")
    p = payload_t * r / (2 * r - 2 * s)
    return {"P_t": round(p, 2), "exceeds_payload_check_corner_castings": p > payload_t}
