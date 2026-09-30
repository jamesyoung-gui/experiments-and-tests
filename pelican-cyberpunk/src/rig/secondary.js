// Analytic secondary motion + pure timing helpers (keeps solvePose pure & exactly periodic when baked).
// Everything here is a pure function of its arguments: no state, no Math.random.

// ---------------------------------------------------------------------------------------------
// 1. Steady-state response of a damped oscillator (natural freq wn rad/s, damping z) to a drive at w.
//    H = gain, psi = phase LAG (0..π). A child driven by its parent therefore always peaks AFTER it.
export function response(w, wn, z) {
  const r = w / wn;
  const H = 1 / Math.sqrt((1 - r * r) ** 2 + (2 * z * r) ** 2);
  const psi = Math.atan2(2 * z * r, 1 - r * r);
  return { H, psi };
}
// Legacy helper: driven directly by the 2×crank body bob: gain·H·cos(2φ − ψ)
export function bobDriven(phi, rpm, wn, z, gain) {
  const w = 2 * (2 * Math.PI * rpm / 60);
  const { H, psi } = response(w, wn, z);
  return gain * H * Math.cos(2 * phi - psi);
}
// Phasor chain: a signal A·cos(2φ − θ). child(parent, w, wn, z, gain) returns the child's phasor, whose
// lag θ is the parent's lag PLUS the child's own response lag, so follow-through order is guaranteed
// (pelvis → head → crest/bill → pouch; pelvis → tail; pelvis → scarf root → scarf tip).
export const phasor = (A, th) => ({ A, th });
export function child(parent, w, wn, z, gain = 1) {
  const { H, psi } = response(w, wn, z);
  return { A: parent.A * H * gain, th: parent.th + psi };
}
export const evalPh = (p, phi2) => p.A * Math.cos(phi2 - p.th);   // phi2 = 2φ (the bob's phase)

// ---------------------------------------------------------------------------------------------
// 2. Closed-form damped impulse response at time tau after the kick.
export function impulse(tau, amp, wn, z) {
  if (tau < 0 || tau > 6) return 0;
  const wd = wn * Math.sqrt(Math.max(1e-6, 1 - z * z));
  return amp * Math.exp(-z * wn * tau) * Math.sin(wd * tau);
}
// Smooth-onset variant: starts with zero slope (no velocity pop at the event boundary).
export function impulseSoft(tau, amp, wn, z, rise = 0.05) {
  if (tau <= 0) return 0;
  const k = tau < rise ? smooth01(tau / rise) : 1;
  return impulse(tau, amp, wn, z) * k;
}
// Sum of impulse responses for events of `type` in the list.
export function kicks(t, events, type, amp, wn, z, delay = 0) {
  let s = 0;
  for (const e of events || []) if (e.type === type) s += impulse(t - e.t0 - delay, amp, wn, z);
  return s;
}

// ---------------------------------------------------------------------------------------------
// 3. Easing + keyframe tracks (X-sheet style). Keys: [[tau, value], ...] sorted by tau.
//    Monotone cubic Hermite (Fritsch–Carlson): slow-in/slow-out at every extreme, no overshoot unless
//    the keys ask for one, C1-continuous, and flat (zero slope) at the first and last key.
export const smooth01 = u => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
export const smoother01 = u => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (u * (u * 6 - 15) + 10));
export function hermite(p0, m0, p1, m1, D, u) {
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * D * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * D * m1;
}
const trackCache = new WeakMap();
function slopes(keys) {
  let m = trackCache.get(keys);
  if (m) return m;
  const n = keys.length; m = new Array(n).fill(0);
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((keys[i + 1][1] - keys[i][1]) / (keys[i + 1][0] - keys[i][0]));
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else { const w1 = 2 * (keys[i + 1][0] - keys[i][0]) + (keys[i][0] - keys[i - 1][0]), w2 = (keys[i + 1][0] - keys[i][0]) + 2 * (keys[i][0] - keys[i - 1][0]); m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
  }
  trackCache.set(keys, m);
  return m;
}
export function track(keys, tau) {
  const n = keys.length;
  if (tau <= keys[0][0]) return keys[0][1];
  if (tau >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0; while (tau > keys[i + 1][0]) i++;
  const m = slopes(keys), D = keys[i + 1][0] - keys[i][0];
  return hermite(keys[i][1], m[i], keys[i + 1][1], m[i + 1], D, (tau - keys[i][0]) / D);
}

// ---------------------------------------------------------------------------------------------
// 4. Spring follower as a short FIR: child(t) = Σ wᵢ · parent(t − dᵢ), weights from the step response of
//    a damped oscillator. Gives a genuine lag plus 1–2 overshoots for ANY pure parent signal fn(t)
//    (event tracks, gaze saccades, hop). Returns the RELATIVE deflection child − parent.
const firCache = new Map();
function firWeights(wn, z, taps, span) {
  const key = `${wn}|${z}|${taps}|${span}`;
  let w = firCache.get(key);
  if (w) return w;
  // impulse response of a unit-DC-gain 2nd-order system, sampled at the tap delays
  const wd = wn * Math.sqrt(Math.max(1e-6, 1 - z * z));
  const raw = [];
  for (let i = 0; i < taps; i++) { const d = (i + 0.5) * span / taps; raw.push(Math.exp(-z * wn * d) * Math.sin(wd * d)); }
  const s = raw.reduce((a, b) => a + b, 0);
  w = raw.map(x => x / s);
  firCache.set(key, w);
  return w;
}
export function follow(fn, t, wn, z, taps = 10, span = 0.6) {
  const w = firWeights(wn, z, taps, span);
  let acc = 0;
  for (let i = 0; i < taps; i++) acc += w[i] * fn(t - (i + 0.5) * span / taps);
  return acc - fn(t);
}

// ---------------------------------------------------------------------------------------------
// 5. Deterministic hash → [0,1). Integer cell index + salt. Used for blinks, gaze and gusts.
export function hash01(i, salt = 0) {
  let h = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((salt | 0) + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; h = Math.imul(h, 0x846ca68b); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
// Cell index helper: with a loop period (baked story loop) cells repeat exactly every loopT seconds.
export function cellOf(t, cell, loopT) {
  if (loopT) { const n = Math.max(1, Math.round(loopT / cell)); const tt = ((t % loopT) + loopT) % loopT; const k = Math.floor(tt / cell); return { k, n, base: t - tt, tt, cell: loopT / n }; }
  return { k: Math.floor(t / cell), n: 0, base: 0, tt: t, cell };
}
export const cellKey = (k, n) => (n ? ((k % n) + n) % n : k);

// ---------------------------------------------------------------------------------------------
// 6. Gusts: one cause, many effects. A gust front sweeps right → left across the screen at GUST.speed
//    world units/s; gust(t, x) is its strength (0..1) at world x. Palms, sea glints, the scarf, crest and
//    primaries can all read it so they react in screen-x order. Pure and loopable.
export const GUST = { cell: 12, speed: 1400, rise: 0.35, fall: 1.4, x0: 2000 };
export function gust(t, x = 700, loopT) {
  // arrival time at x = cell start + offset + (x0 − x)/speed
  let g = 0;
  const lag = (GUST.x0 - x) / GUST.speed;
  for (const dk of [0, -1]) {
    const c = cellOf(t - lag, GUST.cell, loopT);
    const k = c.k + dk, key = cellKey(k, c.n);
    if (hash01(key, 71) < 0.35) continue;                 // ~65% of cells carry a gust
    const t0 = c.base + k * c.cell + 1 + hash01(key, 72) * (c.cell - 4);
    const tau = t - lag - t0;
    const amp = 0.6 + 0.4 * hash01(key, 73);
    if (tau > 0 && tau < GUST.rise + GUST.fall * 3) g = Math.max(g, amp * smooth01(tau / GUST.rise) * Math.exp(-Math.max(0, tau - GUST.rise) / GUST.fall));
  }
  return g;
}
