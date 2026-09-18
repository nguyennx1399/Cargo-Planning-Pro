"""Lifting-gear and suspension calculations (BBC Guideline v1.0 ch. 1.2).

All forces kN, lengths m, masses t, angles deg.
"""
import math

from calc_common import G, check, rad, require_angle_below, require_non_negative, require_positive


def net_sling_length(x, y, z, shackle_e, shackle_d):
    """§1.2.5 Net sling length = spatial diagonal hook->lifting point minus shackle effective length (E + D/2).

    x, y: horizontal offsets of the lifting point from the hook plumb line; z: vertical drop hook->point.
    shackle_e: inside length E [m]; shackle_d: bolt diameter D [m].
    """
    require_non_negative(x=x, y=y)
    require_positive(z=z)
    gross = math.sqrt(x * x + y * y + z * z)
    net = gross - (shackle_e + shackle_d / 2)
    return {"gross_length_m": round(gross, 3), "net_length_m": round(net, 3)}


def virtual_cog_rise(v, s, z, phi_deg, gamma_deg, spreader_mass_t, cargo_mass_t):
    """§1.2.6 Rise r of the virtual c.o.g. in a complex (spreader) suspension and stability verdict.

    v: spreader -> centre of suspension (hook) height; s: cargo fastening points -> spreader height;
    z: fastening points -> real c.o.g. height (c.o.g. above fastening points); phi: primary sling angle;
    gamma: secondary sling angle (negative when slings converge towards the base).
    Formula as printed in the source (c uses cos^2 gamma). Stable when virtual c.o.g. stays below the
    centre of suspension; the guideline asks for >= 1 m margin.
    """
    require_positive(v=v, s=s, cargo_mass_t=cargo_mass_t)
    require_non_negative(spreader_mass_t=spreader_mass_t)
    require_angle_below(90, phi_deg=phi_deg, gamma_deg=gamma_deg)
    require_positive(phi_deg=phi_deg)
    phi, gam = rad(phi_deg), rad(gamma_deg)
    ratio = spreader_mass_t / cargo_mass_t
    c = math.cos(gam) ** 2 - (1 + ratio) * math.sin(gam) * math.cos(gam) / math.tan(phi)
    denom = v * math.tan(phi) + s * math.tan(gam)
    if denom <= 1e-9:  # half-width at the fastening points must stay positive
        raise ValueError("slings cross: v*tan(phi) + s*tan(gamma) must be > 0")
    r = c * s - v * ratio - c * z * s * math.tan(gam) / denom
    cos_height = s + v                      # centre of suspension above fastening points
    virtual_cog_height = z + r              # virtual c.o.g. above fastening points
    verdict = check(cos_height - virtual_cog_height, 1.0, higher_is_ok=True)
    return {"c": round(c, 4), "r_m": round(r, 3), "centre_of_suspension_m": round(cos_height, 3),
            "virtual_cog_m": round(virtual_cog_height, 3), "stable": virtual_cog_height < cos_height,
            "margin_check_1m": verdict}


def hanging_forces_2pt(weight_kn, e1, e2):
    """§1.2.7 Two-point suspension: inverse proportionality. e1/e2 = horizontal distance of point 1/2 to c.o.g."""
    require_positive(weight_kn=weight_kn)
    require_non_negative(e1=e1, e2=e2)
    require_positive(span=e1 + e2)
    return {"H1_kN": round(weight_kn * e2 / (e1 + e2), 2), "H2_kN": round(weight_kn * e1 / (e1 + e2), 2)}


def hanging_forces_3pt(weight_kn, e_a, e_b, e_c, e_bc):
    """§1.2.7 Three-point suspension (statically determinate).

    A is alone on one side; B and C form the opposite pair. e_a: A -> c.o.g. line; e_bc: line B-C -> c.o.g.
    (measured across); e_b, e_c: B and C distances along the B-C line from the c.o.g. projection.
    """
    require_non_negative(e_a=e_a, e_b=e_b, e_c=e_c, e_bc=e_bc)  # c.o.g. must lie inside the lifting points
    require_positive(weight_kn=weight_kn, ab=e_a + e_bc, bc=e_b + e_c)
    h_a = weight_kn * e_bc / (e_a + e_bc)
    pair = weight_kn * e_a / (e_a + e_bc)
    return {"HA_kN": round(h_a, 2), "HB_kN": round(pair * e_c / (e_b + e_c), 2),
            "HC_kN": round(pair * e_b / (e_b + e_c), 2)}


def hanging_forces_4pt(weight_kn, x1, x2, e, y1, y2):
    """§1.2.7 Four-point suspension approximated as nested two-point systems (statically indeterminate).

    Longitudinal distances of the point pairs from the c.o.g. are x1 + e/2 and x2 + e/2 (e = c.o.g. offset
    band); y1, y2 transverse distances. Numbering follows the source: points 1-2 are the pair at
    distance x1 (so they take the x2 share), points 3-4 the pair at x2; points 1 and 4 lie at y1
    (taking the y2 share), points 2 and 3 at y2.
    """
    require_non_negative(x1=x1, x2=x2, e=e, y1=y1, y2=y2)  # c.o.g. must lie inside the lifting points
    require_positive(weight_kn=weight_kn, span_x=x1 + x2 + e, span_y=y1 + y2)
    span_x, span_y = x1 + x2 + e, y1 + y2
    lx_a = (x2 + e / 2) / span_x
    lx_b = (x1 + e / 2) / span_x
    forces = {"H1_kN": weight_kn * lx_a * y2 / span_y, "H2_kN": weight_kn * lx_a * y1 / span_y,
              "H3_kN": weight_kn * lx_b * y1 / span_y, "H4_kN": weight_kn * lx_b * y2 / span_y}
    out = {k: round(v, 2) for k, v in forces.items()}
    out["sum_kN"] = round(sum(forces.values()), 2)
    return out


def effective_sling_force(hanging_kn, alpha_deg, beta_deg, method="exact"):
    """§1.2.7 Force in an inclined sling from its hanging (vertical) force.

    alpha: angle from vertical in side view, beta: in front view. exact: H*sqrt(tan2a + tan2b + 1);
    approx (conservative): H/(cos a * cos b). Spatial angle gamma checked: prefer <=30, never >60 deg.
    """
    require_positive(hanging_kn=hanging_kn)
    require_angle_below(90, alpha_deg=alpha_deg, beta_deg=beta_deg)
    a, b = rad(alpha_deg), rad(beta_deg)
    tan_g = math.sqrt(math.tan(a) ** 2 + math.tan(b) ** 2)
    gamma = math.degrees(math.atan(tan_g))
    if method == "exact":
        force = hanging_kn * math.sqrt(tan_g ** 2 + 1)
    elif method == "approx":
        force = hanging_kn / (math.cos(a) * math.cos(b))
    else:
        raise ValueError("method must be 'exact' or 'approx'")
    return {"force_kN": round(force, 2), "spatial_angle_deg": round(gamma, 2),
            "preferred_max_30": gamma <= 30, "absolute_max_60": check(gamma, 60, higher_is_ok=False)}


def spreader_support_wire_force(hanging_kn, gamma_deg, spreader_mass_t):
    """§1.2.8 Force in each support wire of a compression spreader, as printed:
    F_S = (H*(1 - cos g) + W_S/2) / cos g. The source's worked example (192.8 kN for 598.4 kN, 40 deg, 2 t)
    differs ~1.5% from this formula (195.5 kN); the printed formula is the conservative one.
    """
    require_positive(hanging_kn=hanging_kn)
    require_non_negative(spreader_mass_t=spreader_mass_t)
    require_angle_below(90, gamma_deg=gamma_deg)
    cg = math.cos(rad(gamma_deg))
    w_s = spreader_mass_t * G
    force = (hanging_kn * (1 - cg) + w_s / 2) / cg
    return {"force_kN": round(force, 2), "required_wll_t": math.ceil(force / G * 100) / 100}


def safety_factor(breaking_load, wll):
    """§1.1.5 Safety factor BL/WLL (wire 4-5, synthetic fibre 7.1 per source)."""
    require_positive(breaking_load=breaking_load, wll=wll)
    return {"safety_factor": round(breaking_load / wll, 3)}
