// Analytic secondary motion (keeps solvePose pure & exactly periodic when baked).
// Steady-state response of a damped oscillator (natural freq wn, damping z) to a drive at `w`:
export function response(w, wn, z) {
  const r = w / wn;
  const H = 1 / Math.sqrt((1 - r * r) ** 2 + (2 * z * r) ** 2);
  const psi = Math.atan2(2 * z * r, 1 - r * r);
  return { H, psi };
}
// Driven by the 2×crank body bob: gain·H·cos(2φ − ψ)
export function bobDriven(phi, rpm, wn, z, gain) {
  const w = 2 * (2 * Math.PI * rpm / 60);
  const { H, psi } = response(w, wn, z);
  return gain * H * Math.cos(2 * phi - psi);
}
// Closed-form damped impulse response at time tau after the kick.
export function impulse(tau, amp, wn, z) {
  if (tau < 0 || tau > 6) return 0;
  const wd = wn * Math.sqrt(Math.max(1e-6, 1 - z * z));
  return amp * Math.exp(-z * wn * tau) * Math.sin(wd * tau);
}
// Sum of impulse responses for events of `type` in the list.
export function kicks(t, events, type, amp, wn, z, delay = 0) {
  let s = 0;
  for (const e of events || []) if (e.type === type) s += impulse(t - e.t0 - delay, amp, wn, z);
  return s;
}
