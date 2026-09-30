// Two-bone analytic IK. Angles are absolute, radians, SVG convention (y down, +angle = clockwise).
// bend = -1: joint on the counter-clockwise side of hip→target (legs: knee forward)
// bend = +1: joint on the clockwise side (wings: elbow below the shoulder→grip line)
export function ik2(hx, hy, tx, ty, L1, L2, bend = -1, soft = 0.97) {
  let dx = tx - hx, dy = ty - hy;
  let d = Math.hypot(dx, dy);
  const base = Math.atan2(dy, dx);
  const max = L1 + L2, min = Math.abs(L1 - L2) + 1;
  let clamped = false;
  // soft IK: ease the last 3% of reach instead of snapping straight
  const ds = soft * max;
  if (d > ds) {
    const over = d - ds, room = max * 0.999 - ds;
    d = ds + room * (1 - Math.exp(-over / room));
    clamped = true;
  }
  if (d < min) { d = min; clamped = true; }
  const c = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
  const a1 = base + bend * Math.acos(Math.max(-1, Math.min(1, c)));
  const jx = hx + L1 * Math.cos(a1), jy = hy + L1 * Math.sin(a1);
  const ex = hx + d * Math.cos(base), ey = hy + d * Math.sin(base);
  const a2 = Math.atan2(ey - jy, ex - jx);
  return { a1, a2, d, clamped, joint: [jx, jy], end: [ex, ey] };
}
