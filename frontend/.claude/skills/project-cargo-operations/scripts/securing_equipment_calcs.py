"""Strength of securing equipment and welded fittings (BBC Guideline v1.0 ch. 3.2).

MSL = maximum securing load [kN]. Weld figures assume mild steel S235, safety class "Normal",
ordinary seam quality and a fillet A-measure of 6 mm, as in the source.
"""
from calc_common import require_non_negative, require_positive

# MSL as fraction of breaking load (IMO CSS Code Annex 13).
MSL_FRACTION = {"shackle_ring_deckeye_turnbuckle": 0.50, "fibre_rope": 0.33, "web_lashing": 0.50,
                "wire_rope_single_use": 0.80, "wire_rope_reusable": 0.30, "steel_band_single_use": 0.70,
                "chain_high_tensile": 0.50}
TIMBER_MSL_KN_PER_CM2 = 0.3  # normal to the grain

# Residual strength of wire rope after a narrow bend, by bend ratio b/d (b = bend diameter, d = rope dia).
BEND_RATIOS = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0]
BEND_RESIDUAL_STEADY = [0.50, 0.65, 0.72, 0.77, 0.81, 0.85, 0.89, 0.93, 0.96, 0.99]
BEND_RESIDUAL_SLIPPING = [0.25, 0.50, 0.60, 0.65, 0.70, 0.75, 0.79, 0.83, 0.87, 0.90]

FILLET_KN_PER_CM = {"shear": 5.0, "tension": 6.0}      # per cm seam length, A = 6 mm
BUTT_KN_PER_CM2 = {"shear": 8.7, "tension": 12.0}      # per cm2 seam area (length x plate thickness)
STEEL_SHEAR_KN_CM2 = 10.4                              # permissible shear stress of S235 plate


def _require_load(load):
    if load not in ("shear", "tension"):
        raise ValueError("load must be 'shear' or 'tension'")


def msl_from_breaking_load(material, breaking_load_kn=None, timber_area_cm2=None):
    """MSL from certified breaking load per CSS Annex 13 table (timber: 0.3 kN/cm2 of loaded area)."""
    if material == "timber":
        require_positive(timber_area_cm2=timber_area_cm2)
        return {"MSL_kN": round(TIMBER_MSL_KN_PER_CM2 * timber_area_cm2, 1)}
    if material not in MSL_FRACTION:
        raise ValueError(f"material must be 'timber' or one of {sorted(MSL_FRACTION)}")
    require_positive(breaking_load_kn=breaking_load_kn)
    return {"MSL_kN": round(MSL_FRACTION[material] * breaking_load_kn, 1)}


def wire_bend_residual(bend_ratio, slipping=False):
    """Residual strength fraction after a narrow bend (linear interpolation, clamped to table range).
    Use slipping=True when a long lashing passes corners of a large unit (rope works in the bend)."""
    require_positive(bend_ratio=bend_ratio)
    table = BEND_RESIDUAL_SLIPPING if slipping else BEND_RESIDUAL_STEADY
    if bend_ratio <= BEND_RATIOS[0]:
        return {"residual": table[0]}
    if bend_ratio >= BEND_RATIOS[-1]:
        return {"residual": table[-1]}
    for i in range(len(BEND_RATIOS) - 1):
        lo, hi = BEND_RATIOS[i], BEND_RATIOS[i + 1]
        if lo <= bend_ratio <= hi:
            frac = (bend_ratio - lo) / (hi - lo)
            return {"residual": round(table[i] + frac * (table[i + 1] - table[i]), 3)}
    raise ValueError("bend ratio out of range")  # unreachable


def wire_lashing_msl(wire_bl_kn, parts=1, bend_residual=1.0, single_use=True, component_msls_kn=()):
    """MSL of a wire rope lashing = weakest link of wire (parts x BL x residual x MSL fraction) and
    every other component (deck ring, shackles, turnbuckle, cargo fitting)."""
    require_positive(wire_bl_kn=wire_bl_kn, parts=parts, bend_residual=bend_residual)
    frac = MSL_FRACTION["wire_rope_single_use" if single_use else "wire_rope_reusable"]
    wire = wire_bl_kn * parts * bend_residual * frac
    candidates = {"wire": wire, **{f"component_{i + 1}": m for i, m in enumerate(component_msls_kn)}}
    weakest = min(candidates, key=candidates.get)
    return {"wire_MSL_kN": round(wire, 1), "lashing_MSL_kN": round(candidates[weakest], 1),
            "governed_by": weakest}


def fillet_seam_msl(seam_length_cm, load="shear"):
    """Fillet weld (A = 6 mm): 5 kN/cm in shear, 6 kN/cm in tension."""
    require_positive(seam_length_cm=seam_length_cm)
    _require_load(load)
    return {"MSL_kN": round(FILLET_KN_PER_CM[load] * seam_length_cm, 1)}


def butt_seam_msl(seam_length_cm, plate_thickness_cm, load="shear"):
    """Butt weld: 8.7 kN/cm2 shear, 12 kN/cm2 tension over seam area (A-measure = plate thickness)."""
    require_positive(seam_length_cm=seam_length_cm, plate_thickness_cm=plate_thickness_cm)
    _require_load(load)
    return {"MSL_kN": round(BUTT_KN_PER_CM2[load] * seam_length_cm * plate_thickness_cm, 1)}


def plate_stopper_msl(length_cm, thickness_cm, clip_height_cm=None, clip_lever_cm=None):
    """Plate stopper. Plain (both long sides + end welded): MSLxy = 5*(2L + t).
    With clip function (vertical hold against tipping) the seam must run fully round the plate, so
    MSLxy = 5*2(L + t) and MSLz = min(plate shear 10.4*h*t, weld bending 6*2(L+t)*L/(L + 5e))."""
    require_positive(length_cm=length_cm, thickness_cm=thickness_cm)
    seam_cm = 2 * (length_cm + thickness_cm) if clip_height_cm is not None else 2 * length_cm + thickness_cm
    out = {"MSLxy_kN": round(5 * seam_cm, 1)}
    if clip_height_cm is not None:
        require_positive(clip_height_cm=clip_height_cm)
        require_non_negative(clip_lever_cm=clip_lever_cm)
        plate = STEEL_SHEAR_KN_CM2 * clip_height_cm * thickness_cm
        weld = 6 * 2 * (length_cm + thickness_cm) * length_cm / (length_cm + 5 * clip_lever_cm)
        out.update({"MSLz_plate_kN": round(plate, 1), "MSLz_weld_kN": round(weld, 1),
                    "MSLz_kN": round(min(plate, weld), 1)})
    return out


def low_h_beam_stopper_msl(flange_width_cm=None, flat_length_cm=None):
    """Low H-beam stopper: upright, welded all round -> 5*6*b; laid flat, welded on flange edges -> 5*2*L."""
    if flange_width_cm is not None:
        require_positive(flange_width_cm=flange_width_cm)
        return {"MSLxy_kN": round(5 * 6 * flange_width_cm, 1)}
    require_positive(flat_length_cm=flat_length_cm)
    return {"MSLxy_kN": round(5 * 2 * flat_length_cm, 1)}


def high_h_beam_stopper_msl(table_msl_kn, base_length_cm, height_cm, flange_width_cm):
    """High H-beam stopper. table_msl_kn = source table value for H = L (guideline §3.2.3 - ask the user for
    it, never estimate; the tables are not bundled with this skill). If H < L
    scale by L/H, capped by the shear criterion 5*2*(L + b). H must not exceed L."""
    require_positive(table_msl_kn=table_msl_kn, base_length_cm=base_length_cm, height_cm=height_cm,
                     flange_width_cm=flange_width_cm)
    if height_cm > base_length_cm:
        raise ValueError("effective height H must not exceed base length L")
    cap = 5 * 2 * (base_length_cm + flange_width_cm)
    scaled = table_msl_kn * base_length_cm / height_cm
    return {"MSLxy_kN": round(min(scaled, cap), 1), "shear_cap_kN": cap, "capped": scaled > cap}


def angle_stopper_msl(length_cm):
    """Angle stopper, both directions: 5*2*L."""
    require_positive(length_cm=length_cm)
    return {"MSLxy_kN": round(10 * length_cm, 1)}


def lashing_plate_msl(length_cm, thickness_cm):
    """Welded lashing plate aligned with the lashing direction: 5*2*(L + t)."""
    require_positive(length_cm=length_cm, thickness_cm=thickness_cm)
    return {"MSL_kN": round(10 * (length_cm + thickness_cm), 1)}
