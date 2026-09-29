// Shared drawing utilities: seeded noise, curves, and the brush-stroke engine.
// ───────────────────────── utilities ─────────────────────────
export const D = Math.PI / 180;
export const f = n => (Math.round(n * 10) / 10).toString();
export const f2 = n => (Math.round(n * 100) / 100).toString();
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export const MAIN = rng(20260929);
export const rand = (a = 0, b = 1) => a + (b - a) * MAIN();
export const rs = () => Math.floor(MAIN() * 1e6);
export function vnoise(seed, freq = 6) {
  const r = rng(seed); const v = Array.from({ length: 256 }, () => r() * 2 - 1);
  return t => { const x = t * freq; const i = Math.floor(x), fr = x - i, s = fr * fr * (3 - 2 * fr); return v[i & 255] * (1 - s) + v[(i + 1) & 255] * s; };
}
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
export const rot = (p, deg) => { const c = Math.cos(deg * D), s = Math.sin(deg * D); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; };
export const xf = (o, deg, p) => add(o, rot(p, deg)); // local -> parent

export function catmull(P, n = 60) {
  if (P.length === 2) return Array.from({ length: n + 1 }, (_, i) => [lerp(P[0][0], P[1][0], i / n), lerp(P[0][1], P[1][1], i / n)]);
  const pts = [P[0], ...P, P[P.length - 1]], segs = P.length - 1, out = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n * segs; const s = Math.min(Math.floor(u), segs - 1); const t = u - s;
    const p0 = pts[s], p1 = pts[s + 1], p2 = pts[s + 2], p3 = pts[s + 3]; const t2 = t * t, t3 = t2 * t;
    out.push([0, 1].map(k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
  }
  return out;
}
export function closedCR(P, per = 8) {
  const n = P.length, out = [];
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    for (let j = 0; j < per; j++) {
      const t = j / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  return out;
}
export function cubicPts(p0, p1, p2, p3, n = 40) {
  const o = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    o.push([0, 1].map(k => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]));
  }
  return o;
}
export function resample(P, n) {
  const L = [0];
  for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const tot = L[L.length - 1] || 1, out = []; let j = 0;
  for (let i = 0; i < n; i++) {
    const s = tot * i / (n - 1);
    while (j < L.length - 2 && L[j + 1] < s) j++;
    const seg = (L[j + 1] - L[j]) || 1, t = clamp((s - L[j]) / seg, 0, 1);
    out.push([lerp(P[j][0], P[j + 1][0], t), lerp(P[j][1], P[j + 1][1], t)]);
  }
  return out;
}
export function normals(C) {
  const n = C.length;
  return C.map((_, i) => {
    const a = C[Math.max(0, i - 1)], b = C[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1;
    return [-ty / l, tx / l];
  });
}
export const pathOf = (pts, close = true) => 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + (close ? 'Z' : '');
export const blob = (P, per = 8) => pathOf(closedCR(P, per));
export const lineOf = (P, n = 40) => pathOf(catmull(P, n), false);
export function smoothClosed(P) {
  const n = P.length, m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const s = m(P[n - 1], P[0]); let d = `M${f(s[0])} ${f(s[1])}`;
  for (let i = 0; i < n; i++) { const q = m(P[i], P[(i + 1) % n]); d += `Q${f(P[i][0])} ${f(P[i][1])} ${f(q[0])} ${f(q[1])}`; }
  return d + 'Z';
}
// outline polygon around a centreline with width function w(t)
export function stroke(C, wfn, cap = 0.7) {
  const n = C.length, N = normals(C), L = [], Rr = [];
  for (let i = 0; i < n; i++) {
    const w = Math.max(0.05, wfn(i / (n - 1))) / 2;
    L.push([C[i][0] + N[i][0] * w, C[i][1] + N[i][1] * w]);
    Rr.push([C[i][0] - N[i][0] * w, C[i][1] - N[i][1] * w]);
  }
  const t0 = [N[0][1], -N[0][0]], t1 = [N[n - 1][1], -N[n - 1][0]];
  const w0 = wfn(0) / 2 * cap, w1 = wfn(1) / 2 * cap;
  const sc = [C[0][0] - t0[0] * w0, C[0][1] - t0[1] * w0], ec = [C[n - 1][0] + t1[0] * w1, C[n - 1][1] + t1[1] * w1];
  return smoothClosed([sc, ...L, ec, ...Rr.reverse()]);
}
export function prof({ w = 6, a = 0.12, b = 0.3, min = 0.12, amin = 0.5, jit = 0.12, seed = 1, fr = 5, pw = 1 } = {}) {
  const nz = vnoise(seed, fr);
  return t => w * Math.max(min, (amin + (1 - amin) * sstep(0, a, t)) * Math.pow(1 - sstep(1 - b, 1, t), pw)) * (1 + jit * nz(t));
}
export function bristles(C, wf, { k = 6, seed = 1, runout = .4, gap = .25 } = {}) {
  const r = rng(seed * 7 + 3), N = normals(C), out = [];
  for (let j = 0; j < k; j++) {
    const u = (j + .5) / k - .5, o = u + (r() - .5) * .5 / k, edge = Math.abs(u) * 2;
    const t1 = 1 - runout * (.25 + .75 * edge) * (.35 + .65 * r()), t0 = r() * .06 * edge;
    const bw = (1.5 + .9 * r()) / k;
    // optional gap: splits the bristle in two (dry-brush skip)
    const g0 = r() < gap ? lerp(t0 + .2, t1 - .1, r()) : 2, g1 = g0 + .04 + .12 * r();
    const segs = [[t0, Math.min(t1, g0)], [g1, t1]];
    for (const [s0, s1] of segs) {
      if (s1 - s0 < .06) continue;
      const pts = [], ws = [];
      for (let i = 0; i < C.length; i++) {
        const t = i / (C.length - 1); if (t < s0 || t > s1) continue;
        const W = wf(t); pts.push([C[i][0] + N[i][0] * o * W, C[i][1] + N[i][1] * o * W]); ws.push(W * bw);
      }
      if (pts.length < 3) continue;
      const m = pts.length;
      out.push({ d: stroke(pts, t => ws[Math.round(t * (m - 1))] * (1 - .75 * sstep(.75, 1, t)) * (.5 + .5 * sstep(0, .15, t))), op: .45 + .55 * r() });
    }
  }
  return out;
}
// One brush mark. P = guide points; dry = 0 (wet) … 1 (all bristles).
export function brush(P, o = {}) {
  const { w = 4, n = 44, a = .12, b = .35, min = .1, amin = .55, jit = .15, seed = rs(), dry = 0, k = 7, runout = .45, gap = .25,
    color = null, op = 1, pw = 1, fr = 5, pre = false } = o;
  const C = pre ? P : resample(catmull(P, Math.max(n * 3, 90)), n);
  const wf = prof({ w, a, b, min, amin, jit, seed, pw, fr });
  let s = '';
  if (dry < 1) {
    const cut = 1 - dry * .55, m = Math.max(3, Math.round(n * cut));
    const Cc = C.slice(0, m);
    const wc = prof({ w: w * (1 - dry * .25), a: a / cut, b: Math.min(1, b / cut + dry * .3), min, amin, jit, seed, pw, fr });
    s += `<path d="${stroke(Cc, wc)}"${op < 1 ? ` opacity="${f2(op)}"` : ''}/>`;
  }
  if (dry > 0) for (const br of bristles(C, wf, { k, seed, runout, gap })) s += `<path d="${br.d}" opacity="${f2(br.op * op * (dry < 1 ? .9 : 1))}"/>`;
  return color ? `<g fill="${color}">${s}</g>` : s;
}
export const g = (attrs, ...kids) => `<g ${attrs}>${kids.join('')}</g>`;
export const P = (d, attrs = '') => `<path d="${d}" ${attrs}/>`;

