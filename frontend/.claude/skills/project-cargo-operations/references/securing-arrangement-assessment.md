# Securing arrangements & their assessment

Source: BBC Guideline v1.0 (2009) §3.3–3.4 (IMO CSS Code Annex 13 methods).
Script: `scripts/securing_balance_calcs.py`.

## Layout rules
- Pure sliding restraint: ~40 % of device capacity to port, 40 % to starboard, ~10 % each fore and aft; tipping
  is usually covered by the same devices. Verify with the advanced calculation.
- Each lashing has one job (port, stbd, fwd or aft).
- Vertical angle α ≤ 60° for sliding lashings (up to 90° acceptable for tipping).
- Horizontal deviation β from the intended direction ≤ 30°, else discount it or use the alternative method.
- Longitudinal components of transverse lashings should balance fore/aft; otherwise add longitudinal devices.
- Transverse tipping lashings with α < 45° **and** β > 45° don't count in the tipping balance.
- Tall units with a short fore-aft base: check longitudinal tipping.

## Units without lashing points
- Allowed: **half loops** (lashing half round the unit, both ends to the same side — each end counts as one
  lashing), **head loops** (grommet over the top as an anchor for direct lashings), welded stoppers, shoring.
- Banned for heavy units: **friction loops** (over the top, pre-tensioned for friction) and **silly loops**
  (round the unit, ends to opposite sides — look like two lashings, act as none).

## Homogeneity
Arrange devices symmetric about the c.o.g., aligned with the force they take, and with similar effective
elasticity. A stiff unit on stoppers + lashings loads only the stoppers in sliding (lashings don't stretch) —
count the lashings for tipping only. A flexible unit racks, so lashings and stoppers share.

## Visual inspection checklist
1. Friction layer in place (dunnage, plywood, timber, mats)? 2. Devices against sliding both ways, both axes?
3. Tipping risk — devices against it both axes? 4. Levers a, b, c identified? 5. MSL and angles per device/group?
6. Sliding lashings α ≤ 60°? 7. β ≤ 30°? 8. Loads shared homogeneously? 9. Balanced about the c.o.g.?
10. Wire lashings built correctly (type, clips)? 11. Pre-tension right (long lashings harder, short ones less)?
12. Shores properly built and secured against loosening? 13. Stoppers where planned, welds sound?
14. Everything reachable at sea for re-tightening?

## Methods
- **IMO rule of thumb**: sum of MSL per side ≥ unit weight (≈1 g transverse). Ignores ship, position, angles
  and friction; α ≤ 60°, adequate friction, steep tipping lashings excluded. **BBC: not for units > 30 t.**
- **Advanced method**: CS = MSL/1.5; `f = μ·sin α + cos α`; group devices of equal CS and direction.
- **Alternative method**: CS = MSL/1.35; each lashing individually with real β (from transverse):
  `fy = μ·sin α + cos α·cos β`, `fx = μ·sin α + cos α·sin β`; tipping balance uses 0.9·Σ(CS·c).
  Heavier input — use approved software.

## Balances (Fx, Fy, Fz from CSS Annex 13 incl. wind/spray; m mass; μ friction)
- Transverse sliding: `Fy ≤ μ·m·g + Σ(CS·f)`
- Longitudinal sliding: `Fx ≤ μ·(m·g − Fz) + Σ(CS·f)`
- Transverse tipping: `Fy·a (+M_add) ≤ b·m·g + Σ(CS·c)`
- Longitudinal tipping (not in Annex 13, BBC adds it): `Fx·a (+M_add) ≤ b·(m·g − Fz) + Σ(CS·c)`
- a = c.o.g. height above tipping axis, b = horizontal c.o.g. distance to tipping axis, c = lever of each
  anti-tipping device about the axis.

## Additional tipping moment (large deck units, > ~10 m height/breadth in the tipping plane)
Rotational inertia adds `M_add = c·m·i_p²` [kN·m] regardless of stowage height:
- Roll: `Tφ = 0.78·B/√GM`, `c = φ·(2π/Tφ)²` with φ = 30° (rad). Pitch: `Tψ = 0.5·√Lpp`, ψ = 12°.
- i_p (plane of tipping, w × h): solid box `√(w² + h²)/√12`, hollow box `(w + h)/√12`,
  solid cylinder `d/√8`, hollow cylinder `d/2`. Pick between solid and hollow per mass distribution.
- Worked case (RTG crane 130 t, 24 × 12 × 25 m, on deck high, B 20.2, GM 1.5, Lpp 113.5): M_add ≈ 8.5 %
  of the ordinary transverse tipping moment but ≈ 57 % longitudinally (large i_p, short pitch period) —
  tipping governed that arrangement; higher GM (2.0 m) would raise transverse forces ~20 %.

## LashCon (DNV) caveats
No interpolation between stowage levels (deck low/high); cannot drop steep lashings from sliding while keeping
them for tipping; uses c = d·sin α (wrong when the securing point is above deck, e.g. ship's side);
advanced mode needs lashings re-entered for longitudinal effect; max 10 devices → grouping needed.
