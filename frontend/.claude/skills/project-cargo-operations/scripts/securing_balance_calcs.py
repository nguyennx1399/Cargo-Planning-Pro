"""Securing-arrangement balances (BBC Guideline v1.0 ch. 3.4, IMO CSS Code Annex 13 methods).

External forces Fx/Fy/Fz [kN] come from CSS Annex 13 acceleration tables (not part of the guideline)
and must be supplied by the caller.
"""
import math

from calc_common import G, check, rad, require_non_negative, require_positive

CS_DIVISOR = {"advanced": 1.5, "alternative": 1.35}
ALT_TIPPING_FACTOR = 0.9           # alternative method tipping balance factor on sum(CS*c)
RULE_OF_THUMB_MAX_MASS_T = 30.0    # BBC: IMO rule of thumb not allowed above 30 t
ROLL_AMPLITUDE_DEG, PITCH_AMPLITUDE_DEG = 30.0, 12.0


def _require_method(method):
    if method not in CS_DIVISOR:
        raise ValueError("method must be 'advanced' or 'alternative'")


def calculated_strength(msl_kn, method="advanced"):
    """CS = MSL / 1.5 (advanced) or MSL / 1.35 (alternative)."""
    require_positive(msl_kn=msl_kn)
    _require_method(method)
    return {"CS_kN": round(msl_kn / CS_DIVISOR[method], 1)}


def f_advanced(alpha_deg, friction=0.3):
    """Advanced method f-value: f = mu*sin(alpha) + cos(alpha). alpha = vertical lashing angle.
    Lashings steeper than 60 deg should not count for sliding."""
    a = rad(alpha_deg)
    return {"f": round(friction * math.sin(a) + math.cos(a), 3), "counts_for_sliding": alpha_deg <= 60}


def f_alternative(alpha_deg, beta_deg, friction=0.3):
    """Alternative method: fy = mu sin a + cos a cos b, fx = mu sin a + cos a sin b, where beta is the
    horizontal angle measured from the transverse direction."""
    a, b = rad(alpha_deg), rad(beta_deg)
    return {"fy": round(friction * math.sin(a) + math.cos(a) * math.cos(b), 3),
            "fx": round(friction * math.sin(a) + math.cos(a) * math.sin(b), 3)}


def sliding_balance(force_kn, mass_t, sum_cs_f_kn, friction=0.3, direction="transverse", fz_kn=0.0):
    """Transverse: Fy <= mu*m*g + sum(CS*f). Longitudinal: Fx <= mu*(m*g - Fz) + sum(CS*f)."""
    require_positive(mass_t=mass_t)
    require_non_negative(force_kn=force_kn, sum_cs_f_kn=sum_cs_f_kn, fz_kn=fz_kn)
    if direction not in ("transverse", "longitudinal"):
        raise ValueError("direction must be 'transverse' or 'longitudinal'")
    weight = mass_t * G
    normal = weight if direction == "transverse" else weight - fz_kn
    resistance = friction * max(normal, 0.0) + sum_cs_f_kn
    return {"acting_kN": round(force_kn, 1), "resisting_kN": round(resistance, 1),
            **check(resistance, force_kn, higher_is_ok=True)}


def tipping_balance(force_kn, lever_a_m, lever_b_m, mass_t, sum_cs_c_knm, direction="transverse",
                    fz_kn=0.0, additional_moment_knm=0.0, method="advanced"):
    """Transverse: F*a (+ M_add) <= b*m*g + sum(CS*c). Longitudinal: F*a (+ M_add) <= b*(m*g - Fz) + sum(CS*c).
    a = height of c.o.g. above tipping axis, b = horizontal c.o.g. distance to tipping axis.
    Alternative method multiplies sum(CS*c) by 0.9 (so CS = MSL/1.35 can be used throughout)."""
    require_positive(mass_t=mass_t, lever_a_m=lever_a_m)
    require_non_negative(force_kn=force_kn, lever_b_m=lever_b_m, sum_cs_c_knm=sum_cs_c_knm, fz_kn=fz_kn,
                         additional_moment_knm=additional_moment_knm)
    _require_method(method)
    if direction not in ("transverse", "longitudinal"):
        raise ValueError("direction must be 'transverse' or 'longitudinal'")
    weight = mass_t * G
    stabilising_weight = weight if direction == "transverse" else max(weight - fz_kn, 0.0)
    factor = ALT_TIPPING_FACTOR if method == "alternative" else 1.0
    acting = force_kn * lever_a_m + additional_moment_knm
    resisting = lever_b_m * stabilising_weight + factor * sum_cs_c_knm
    return {"acting_kNm": round(acting, 1), "resisting_kNm": round(resisting, 1),
            **check(resisting, acting, higher_is_ok=True)}


def rule_of_thumb(mass_t, msl_sum_per_side_kn):
    """IMO rule of thumb: sum of MSL on each side >= unit weight. Not allowed by BBC above 30 t."""
    require_positive(mass_t=mass_t)
    if mass_t > RULE_OF_THUMB_MAX_MASS_T:
        return {"applicable": False, "reason": "unit > 30 t: use advanced/alternative calculation"}
    return {"applicable": True, **check(msl_sum_per_side_kn, mass_t * G, higher_is_ok=True)}


def roll_period(breadth_m, gm_m):
    """Large-amplitude roll period estimate T = 0.78 * B / sqrt(GM)."""
    require_positive(breadth_m=breadth_m, gm_m=gm_m)
    return {"T_s": round(0.78 * breadth_m / math.sqrt(gm_m), 2)}


def pitch_period(lpp_m):
    """Pitch period estimate T = 0.5 * sqrt(Lpp)."""
    require_positive(lpp_m=lpp_m)
    return {"T_s": round(0.5 * math.sqrt(lpp_m), 2)}


def angular_acceleration(period_s, amplitude_deg):
    """Peak angular acceleration of harmonic motion c = amplitude * (2 pi / T)^2 [1/s2]
    (source uses 30 deg for roll, 12 deg for pitch)."""
    require_positive(period_s=period_s, amplitude_deg=amplitude_deg)
    return {"c_per_s2": round(rad(amplitude_deg) * (2 * math.pi / period_s) ** 2, 4)}


def polar_radius(shape, width_m=None, height_m=None, diameter_m=None):
    """Polar radius of inertia i_p in the tipping plane.
    solid_box: sqrt(w2+h2)/sqrt(12); hollow_box: (w+h)/sqrt(12); solid_cylinder: d/sqrt(8); hollow_cylinder: d/2."""
    if shape in ("solid_box", "hollow_box"):
        require_positive(width_m=width_m, height_m=height_m)
        if shape == "solid_box":
            return {"ip_m": round(math.sqrt(width_m ** 2 + height_m ** 2) / math.sqrt(12), 3)}
        return {"ip_m": round((width_m + height_m) / math.sqrt(12), 3)}
    if shape in ("solid_cylinder", "hollow_cylinder"):
        require_positive(diameter_m=diameter_m)
        return {"ip_m": round(diameter_m / (math.sqrt(8) if shape == "solid_cylinder" else 2), 3)}
    raise ValueError("shape must be solid_box, hollow_box, solid_cylinder or hollow_cylinder")


def additional_tipping_moment(mass_t, ip_m, angular_accel_per_s2=None, breadth_m=None, gm_m=None,
                              lpp_m=None, plane="transverse"):
    """Extra tipping moment from rotational inertia of large deck units: M_add = c * m * ip^2 [kN m].
    Give angular_accel directly, or B+GM (transverse, 30 deg roll) / Lpp (longitudinal, 12 deg pitch)."""
    require_positive(mass_t=mass_t, ip_m=ip_m)
    if angular_accel_per_s2 is None:
        if plane == "transverse":
            period = roll_period(breadth_m, gm_m)["T_s"]
            angular_accel_per_s2 = angular_acceleration(period, ROLL_AMPLITUDE_DEG)["c_per_s2"]
        elif plane == "longitudinal":
            period = pitch_period(lpp_m)["T_s"]
            angular_accel_per_s2 = angular_acceleration(period, PITCH_AMPLITUDE_DEG)["c_per_s2"]
        else:
            raise ValueError("plane must be 'transverse' or 'longitudinal'")
    return {"c_per_s2": angular_accel_per_s2, "M_add_kNm": round(angular_accel_per_s2 * mass_t * ip_m ** 2, 1)}
