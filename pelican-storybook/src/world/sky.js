// OWNER: sky. Layers L-sky, L-stars, L-sunmoon, L-clouds (+ the palette in core/palette.js).
// Style B (docs/STYLE-B.md): a warm storybook gouache sky. A soft painted wash from the zenith to the horizon with
// dry-brush streaks and a static gouache mottle; a watercolour sun (soft blooms, a wobbly disc with a pigment
// back-run edge, thin cloud wisps across it); a big gentle cream moon; stars as little painted crosses with a few
// twinkles, and a pelican-shaped constellation; puffy three-tone gouache clouds (puff() from the draft) with rim
// light, brush dabs and dry-brush flecks; high wisps, a mackerel sky, stratus bands, a far horizon bank; three
// storybook toys crossing the sky (a patchwork hot-air balloon, a striped airship, a red biplane towing a
// hand-lettered "Pelican Bay" banner); painted pelicans in a V, hand-drawn gulls and a far skein.
// PERFORMANCE (STYLE-B §2): no filters at all. Measured: any filter in the sky re-runs on every camera move (the
// cinematic camera rolls every frame), so the gouache look is baked: wobble = seeded jitter + Catmull-Rom, soft cloud
// edges = feathered skirts, mottle = faint pigment blotches, glows = radial gradients.
// CALM (STYLE-B §6): clouds drift slowly; nothing in the sky is fast.
import { fmt1, fmt2 } from '../core/math.js';
import { h, refs } from '../core/svg.js';
import { hash } from './route.js';
import { DIST_PER_REV as DIST_PER_REV_ } from '../contract.js';

export const id = 'sky';
// storybook toy paints (graded by the hour like the core materials)
export const materials = {
  skyToyRed: '#D8443A', skyToyRedLo: '#A82E2E', skyToyCream: '#F6EAD0', skyToyCreamLo: '#D8C3A0',
  skyToyTeal: '#1F8A8A', skyToyTealLo: '#146466', skyToyYellow: '#FAC957', skyToyWood: '#C89B5E', skyToyWoodLo: '#9A6E3C',
  skyToyBlue: '#5B7FC0', skyToyBrass: '#D9A441', skyBird: '#FFF6EC', skyBirdShade: '#E9D3D2', skyBirdDark: '#231D26',
  skyBirdBill: '#F4A284', skyBirdPouch: '#FAC957',
};

// ---------------------------------------------------------------------------------------------- helpers
const f = fmt2;   // = String(Math.round(x * 100) / 100), fast (core/math.js)
const f1 = fmt1;
const D2R = Math.PI / 180;
const P = (x, y) => f1(x) + ' ' + f1(y);
const wrap = (x, m) => ((x % m) + m) % m;
const circ = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
// closed / open Catmull-Rom -> cubic path (the draft's cr())
function cr(pts, closed = true, k = 1 / 6) {
  const n = pts.length; let d = `M${P(...pts[0])}`;
  const g = i => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    d += `C${P(p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k)} ${P(p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k)} ${P(...p2)}`;
  }
  return d + (closed ? 'Z' : '');
}
// puffy cloud outline along a baseline (the draft's puff(), made lobed): n round lobes under a sine envelope that
// meet in shallow notches, then a softly flattened, slightly wavy base. Seeded; returns the points.
function puffPts(R, cx, cy, w, hh, n, flat = 0.25) {
  const rr = (a, b) => a + (b - a) * R();
  const env = t => Math.sin(Math.PI * t) ** 0.8 * hh, x0 = cx - w / 2, pts = [[x0, cy - env(0.02) * 0.5]], lobes = [];
  let hPrev = env(0);
  for (let i = 0; i < n; i++) {
    const ta = i / n, tb = (i + 1) / n, dt = tb - ta, hM = env((ta + tb) / 2) * rr(0.86, 1.12) + hh * 0.08;
    const lobe = [[x0 + w * (ta + dt * 0.2), cy - (hPrev * 0.35 + hM * 0.65) * 0.97], [x0 + w * (ta + dt * 0.5), cy - hM], [x0 + w * (ta + dt * 0.8), cy - hM * 0.95]];
    pts.push(...lobe); lobes.push(lobe);
    hPrev = hM;
    if (i < n - 1) pts.push([x0 + w * tb, cy - Math.min(hM, env(tb)) * rr(0.84, 0.92)]);
  }
  pts.top = pts.length; pts.lobes = lobes;
  pts.push([cx + w / 2 + hh * 0.12, cy + hh * flat * 0.2]);
  for (let i = n; i >= 0; i -= 2) pts.push([cx - w / 2 + (w * i) / n, cy + hh * flat * rr(0.3, 0.6)]);
  pts.push([cx - w / 2 - hh * 0.12, cy + hh * flat * 0.2]);
  return pts;
}
// wobbly ellipse (seeded jitter: the hand-drawn edge baked into geometry)
const blob = (R, cx, cy, rx, ry, n, amp, a0 = 0) => Array.from({ length: n }, (_, i) => {
  const a = a0 + (i / n) * 2 * Math.PI, k = 1 + (R() - 0.5) * amp;
  return [cx + rx * k * Math.cos(a), cy + ry * k * Math.sin(a)];
});
// tapered gouache brush stroke along a gentle arc (a filled shape: a heavy head, a dry thinning tail)
function brush(R, x, y, len, w, bend = 0, ang = 0, head = 0.18) {
  const n = 10, top = [], bot = [], c = Math.cos(ang * D2R), s = Math.sin(ang * D2R);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const prof = t < head ? 0.45 + 0.55 * Math.sin((t / head) * Math.PI / 2) : Math.pow(1 - (t - head) / (1 - head), 0.55);
    const wt = w * Math.max(0.04, prof) * (0.85 + 0.3 * R());
    const px = len * t, py = bend * Math.sin(Math.PI * t) + (R() - 0.5) * w * 0.15;
    top.push([px, py - wt / 2]); bot.push([px, py + wt / 2]);
  }
  const pts = [...top, ...bot.reverse()].map(([px, py]) => [x + px * c - py * s, y + px * s + py * c]);
  return cr(pts);
}
// a few bristle lines inside a stroke (open paths, thin)
function bristles(R, x, y, len, w, bend = 0, ang = 0, k = 3) {
  const c = Math.cos(ang * D2R), s = Math.sin(ang * D2R); let d = '';
  for (let j = 0; j < k; j++) {
    const off = (R() - 0.5) * w * 0.7, t0 = R() * 0.25, t1 = 0.55 + R() * 0.4, pts = [];
    for (let i = 0; i <= 4; i++) { const t = t0 + (t1 - t0) * (i / 4); const px = len * t, py = bend * Math.sin(Math.PI * t) + off * (1 - t * 0.5); pts.push([x + px * c - py * s, y + px * s + py * c]); }
    d += cr(pts, false);
  }
  return d;
}

// Hand-lettering: DejaVu Serif Bold (Latin) and WenQuanYi Zen Hei (CJK) outlines at em 20, extracted at build time
// with tools/ttf.mjs (both licences allow embedding outlines). [advance, path] per glyph, baseline y = 0.
const GLYPHS = {
  "P": [15.04, 'M0.94 0L0.94 -1.18L2.8 -1.18L2.8 -13.4L0.94 -13.4L0.94 -14.58L9.24 -14.58Q11.67 -14.58 13.11 -13.42Q14.54 -12.27 14.54 -10.32Q14.54 -8.37 13.1 -7.2Q11.66 -6.04 9.24 -6.04L6.56 -6.04L6.56 -1.18L8.92 -1.18L8.92 0ZM6.56 -7.22L7.66 -7.22Q8.93 -7.22 9.68 -8.06Q10.44 -8.91 10.44 -10.32Q10.44 -11.73 9.69 -12.56Q8.94 -13.4 7.66 -13.4L6.56 -13.4Z'],
  "e": [12.72, 'M8.02 -5.86Q8.02 -7.91 7.64 -8.74Q7.26 -9.56 6.34 -9.56Q5.45 -9.56 5.06 -8.75Q4.68 -7.94 4.68 -6.04L4.68 -5.86ZM11.82 -4.7L4.68 -4.7L4.68 -4.62Q4.68 -2.61 5.28 -1.71Q5.89 -0.82 7.24 -0.82Q8.36 -0.82 9.05 -1.42Q9.75 -2.01 9.94 -3.14L11.56 -3.14Q11.14 -1.38 9.89 -0.55Q8.64 0.28 6.4 0.28Q3.7 0.28 2.26 -1.14Q0.82 -2.56 0.82 -5.2Q0.82 -7.77 2.29 -9.22Q3.77 -10.66 6.4 -10.66Q8.97 -10.66 10.35 -9.15Q11.73 -7.63 11.82 -4.7Z'],
  "l": [7.6, 'M5.62 -1.18L7.1 -1.18L7.1 0L0.68 0L0.68 -1.18L2.16 -1.18L2.16 -14.02L0.68 -14.02L0.68 -15.2L5.62 -15.2Z'],
  "i": [7.6, 'M1.84 -13.32Q1.84 -14.11 2.38 -14.65Q2.93 -15.2 3.72 -15.2Q4.49 -15.2 5.03 -14.65Q5.58 -14.11 5.58 -13.32Q5.58 -12.55 5.03 -12.01Q4.49 -11.46 3.72 -11.46Q2.93 -11.46 2.38 -12Q1.84 -12.54 1.84 -13.32ZM5.62 -1.18L7.1 -1.18L7.1 0L0.68 0L0.68 -1.18L2.16 -1.18L2.16 -9.2L0.68 -9.2L0.68 -10.38L5.62 -10.38Z'],
  "c": [12.18, 'M11.28 -3.24Q10.91 -1.46 9.76 -0.59Q8.61 0.28 6.64 0.28Q3.87 0.28 2.34 -1.15Q0.82 -2.59 0.82 -5.2Q0.82 -7.77 2.32 -9.22Q3.83 -10.66 6.5 -10.66Q7.59 -10.66 8.69 -10.46Q9.79 -10.25 10.94 -9.84L10.94 -6.96L9.84 -6.96Q9.69 -8.28 9.07 -8.92Q8.46 -9.56 7.34 -9.56Q5.9 -9.56 5.29 -8.58Q4.68 -7.61 4.68 -5.2Q4.68 -2.84 5.27 -1.83Q5.87 -0.82 7.22 -0.82Q8.26 -0.82 8.89 -1.45Q9.52 -2.07 9.66 -3.24Z'],
  "a": [12.96, 'M11.02 -6.38L11.02 -1.18L12.5 -1.18L12.5 0L7.56 0L7.56 -1.32Q6.88 -0.5 6.04 -0.11Q5.2 0.28 4.12 0.28Q2.53 0.28 1.67 -0.57Q0.82 -1.43 0.82 -3.02Q0.82 -4.77 2.05 -5.63Q3.27 -6.5 5.74 -6.5L7.56 -6.5L7.56 -7.12Q7.56 -8.38 6.96 -8.98Q6.37 -9.58 5.12 -9.58Q4.08 -9.58 3.52 -9.16Q2.96 -8.73 2.72 -7.76L1.62 -7.76L1.62 -10Q2.55 -10.33 3.54 -10.5Q4.54 -10.66 5.64 -10.66Q8.43 -10.66 9.72 -9.63Q11.02 -8.59 11.02 -6.38ZM7.56 -3.26L7.56 -5.34L6.26 -5.34Q5.29 -5.34 4.78 -4.81Q4.26 -4.29 4.26 -3.3Q4.26 -2.31 4.63 -1.83Q5.01 -1.34 5.78 -1.34Q6.58 -1.34 7.07 -1.87Q7.56 -2.39 7.56 -3.26Z'],
  "n": [14.54, 'M0.68 0L0.68 -1.18L2.16 -1.18L2.16 -9.2L0.68 -9.2L0.68 -10.38L5.62 -10.38L5.62 -8.92Q6.24 -9.84 7.04 -10.25Q7.84 -10.66 9.06 -10.66Q10.81 -10.66 11.7 -9.63Q12.6 -8.6 12.6 -6.6L12.6 -1.18L14.08 -1.18L14.08 0L7.88 0L7.88 -1.18L9.14 -1.18L9.14 -6.7Q9.14 -8.02 8.8 -8.53Q8.47 -9.04 7.64 -9.04Q6.59 -9.04 6.1 -8.28Q5.62 -7.51 5.62 -5.84L5.62 -1.18L6.88 -1.18L6.88 0Z'],
  " ": [6.96, ''],
  "B": [16.9, 'M0.94 0L0.94 -1.18L2.8 -1.18L2.8 -13.4L0.94 -13.4L0.94 -14.58L9.58 -14.58Q12.25 -14.58 13.58 -13.68Q14.92 -12.78 14.92 -10.98Q14.92 -9.68 14 -8.92Q13.08 -8.15 11.26 -7.96Q13.46 -7.75 14.63 -6.79Q15.8 -5.82 15.8 -4.22Q15.8 -2.05 14.17 -1.03Q12.53 0 9.04 0ZM6.56 -8.5L7.84 -8.5Q9.52 -8.5 10.33 -9.11Q11.14 -9.72 11.14 -10.98Q11.14 -12.25 10.36 -12.82Q9.57 -13.4 7.84 -13.4L6.56 -13.4ZM6.56 -1.18L7.96 -1.18Q9.82 -1.18 10.72 -1.92Q11.62 -2.67 11.62 -4.22Q11.62 -5.78 10.71 -6.55Q9.8 -7.32 7.96 -7.32L6.56 -7.32Z'],
  "y": [11.62, 'M6.24 2.34Q5.77 3.49 5.11 3.96Q4.44 4.44 3.32 4.44Q2.84 4.44 2.26 4.34Q1.67 4.23 0.98 4.02L0.98 1.86L2.08 1.87Q2.11 2.62 2.44 2.98Q2.76 3.34 3.42 3.34Q4.05 3.34 4.44 2.99Q4.83 2.65 5.22 1.68L5.38 1.32L0.86 -9.2L-0.26 -9.2L-0.26 -10.38L5.72 -10.38L5.72 -9.2L4.48 -9.2L7.12 -3.06L9.58 -9.2L8.2 -9.2L8.2 -10.38L12.1 -10.38L12.1 -9.2L10.84 -9.2Z'],
  "鹈": [20, 'M6.33 2.4Q5.61 2.32 4.9 2.4Q4.96 1.07 4.96 -0.25L4.96 -3.46Q3.71 -1.19 1.23 1.09Q0.84 0.53 0.2 0.27Q1.31 -0.7 2.26 -1.93Q3.2 -3.16 4.32 -5.29L1.8 -5.29L1.78 -9.45L4.96 -9.45L4.96 -11.54L3.54 -11.54Q2.62 -11.54 1.72 -11.48Q1.76 -11.99 1.72 -12.48Q2.62 -12.44 3.54 -12.44L5.55 -12.44Q6.54 -14.02 7.29 -16.07Q7.95 -15.76 8.65 -15.61Q8.18 -14.18 7.09 -12.44L9.51 -12.44L9.51 -8.54L6.27 -8.54L6.27 -6.21L9.69 -6.21L9.69 -2.66Q9.69 -1.95 8.91 -1.46Q8.11 -0.98 7.15 -1Q7.3 -1.91 6.76 -2.7Q7.09 -2.6 7.48 -2.52Q8.16 -2.5 8.27 -2.54Q8.38 -2.58 8.38 -2.83L8.38 -5.29L6.27 -5.29L6.27 -0.25Q6.27 1.07 6.33 2.4ZM5.16 -13.28L3.93 -12.54L2.07 -15.62L3.3 -16.37ZM4.96 -6.21L4.96 -8.54L3.09 -8.54Q3.09 -7.42 3.11 -6.21ZM6.27 -9.45L8.2 -9.45L8.2 -11.54L6.5 -11.54L6.45 -11.46Q6.41 -11.54 6.27 -11.54ZM17.11 -2.54Q17.07 -2.01 17.11 -1.48Q16.29 -1.52 15.47 -1.52L12.79 -1.52Q11.97 -1.52 11.17 -1.48Q11.21 -2.01 11.17 -2.54Q11.97 -2.48 12.79 -2.48L15.47 -2.48Q16.29 -2.48 17.11 -2.54ZM15.98 -10.2L15 -9.3L13.69 -11.33L14.67 -12.23ZM15.64 -6.64Q15.76 -7.66 15.31 -8.28Q15.74 -8.2 16.37 -8.19Q16.99 -8.18 17.07 -8.28Q17.15 -8.38 17.15 -8.67L17.15 -12.66L14.45 -12.66L14.24 -12.4Q14.16 -12.54 14.08 -12.66Q13.75 -12.66 13.24 -12.66L13.24 -5.86L19.28 -5.86L19.28 0.88Q19.28 1.58 18.79 2.11Q18.05 2.77 16.39 2.75Q16.52 1.72 16.02 1.11Q16.52 1.19 17.24 1.2Q17.95 1.21 18.06 1.09Q18.16 0.98 18.16 0.55L18.16 -4.9L12.11 -4.9L12.11 -13.61Q12.91 -13.61 13.69 -13.61Q14.34 -14.41 14.67 -15.62Q15.21 -15.31 15.84 -15.16Q15.61 -14.24 15.18 -13.61L18.26 -13.61L18.26 -8.44Q18.26 -7.83 17.79 -7.3Q17.11 -6.66 15.64 -6.64Z'],
  "鹕": [20, 'M9.82 -5.21L7.89 -5.21Q8.01 -2.29 7.04 -0.42Q6.07 1.45 4.49 2.4Q4.14 1.7 3.38 1.45Q6.54 0.06 6.6 -4.47L6.58 -14.88L11.11 -14.88L11.11 0.23Q11.13 1.52 10.39 1.99Q9.53 2.52 8.14 2.48Q8.32 1.62 7.77 0.92Q8.24 1 8.87 1.01Q9.49 1.02 9.65 0.84Q9.82 0.57 9.82 -0.53ZM2.3 -0.43L1.02 -0.43L1.02 -7.6Q1.84 -7.6 2.62 -7.6L2.62 -10.72L0.33 -10.68Q0.39 -11.15 0.33 -11.62L2.62 -11.58L2.62 -13.89Q2.62 -15.2 2.56 -16.48Q3.26 -16.43 3.96 -16.48Q3.89 -15.2 3.89 -13.89L3.89 -11.58L6.45 -11.62Q6.41 -11.15 6.45 -10.68L3.89 -10.72L3.89 -7.6L5.53 -7.6L5.53 -0.43L4.26 -0.43L4.26 -2.05L2.3 -2.05ZM9.82 -10.49L9.82 -14.04L7.85 -14.04L7.87 -10.49ZM9.82 -6L9.82 -9.73L7.87 -9.73L7.89 -6ZM4.26 -6.74L2.3 -6.74L2.3 -2.83L4.26 -2.83ZM17.3 -2.54Q17.27 -2.01 17.3 -1.48Q16.54 -1.52 15.78 -1.52L13.28 -1.52Q12.52 -1.52 11.76 -1.48Q11.8 -2.01 11.76 -2.54Q12.52 -2.48 13.28 -2.48L15.78 -2.48Q16.54 -2.48 17.3 -2.54ZM16.25 -10.2L15.33 -9.3L14.12 -11.33L15.02 -12.23ZM15.94 -6.64Q16.05 -7.66 15.64 -8.28Q16.04 -8.2 16.61 -8.19Q17.19 -8.18 17.27 -8.28Q17.34 -8.38 17.34 -8.67L17.34 -12.66L14.82 -12.66L14.63 -12.4Q14.55 -12.54 14.49 -12.66Q14.16 -12.66 13.69 -12.66L13.69 -5.86L19.34 -5.86L19.34 0.88Q19.34 1.58 18.87 2.11Q18.18 2.77 16.62 2.75Q16.76 1.72 16.29 1.11Q16.76 1.19 17.42 1.2Q18.09 1.21 18.18 1.09Q18.28 0.98 18.28 0.55L18.28 -4.9L12.66 -4.9L12.66 -13.61Q13.38 -13.61 14.12 -13.61Q14.71 -14.41 15.02 -15.62Q15.53 -15.31 16.11 -15.16Q15.9 -14.24 15.51 -13.61L18.38 -13.61L18.38 -8.44Q18.38 -7.83 17.93 -7.3Q17.3 -6.66 15.94 -6.64Z'],
  "湾": [20, 'M15.47 -7.11L9.28 -7.11Q8.38 -7.11 7.46 -7.07Q7.5 -7.56 7.46 -8.07Q8.38 -8.01 9.28 -8.01L16.78 -8.01L16.78 -4.71L9.14 -4.67L8.61 -3.11L17.73 -3.11L16.76 0.96Q16.33 2.54 12.62 2.5Q12.73 2.03 12.59 1.62Q12.44 1.21 12.13 0.94Q12.87 1.02 14.05 0.94Q15.23 0.86 15.36 0.76Q15.49 0.66 15.53 0.47L16.17 -2.21L6.91 -2.21L7.95 -5.2L7.95 -5.49L8.05 -5.49L8.13 -5.7L8.77 -5.49L15.47 -5.53ZM18.24 -8.57Q16.86 -10.61 14.8 -11.97L15.61 -13.16Q17.89 -11.64 19.43 -9.37ZM7.83 -12.3Q8.48 -12.01 9.18 -11.84Q8.65 -10.12 7.4 -8.09L6.6 -6.82Q6.09 -7.3 5.41 -7.38Q6.43 -8.79 7.19 -10.68ZM14.61 -8.55Q13.89 -8.63 13.16 -8.55Q13.22 -9.88 13.22 -11.21L13.22 -13.57L11.46 -13.57L11.46 -11.31Q11.46 -9.98 11.52 -8.65Q10.8 -8.71 10.1 -8.65Q10.16 -9.98 10.16 -11.31L10.16 -13.57L7.71 -13.57Q6.82 -13.57 5.9 -13.54Q5.94 -14.02 5.9 -14.53Q6.82 -14.49 7.71 -14.49L12.23 -14.49L10.21 -15.8L11 -16.99L13.57 -15.31L13.03 -14.49L17.44 -14.49Q18.36 -14.49 19.28 -14.53Q19.22 -14.02 19.28 -13.54Q18.36 -13.57 17.44 -13.57L14.53 -13.57L14.53 -11.21Q14.53 -9.88 14.61 -8.55ZM2.23 2.3Q1.6 1.84 0.7 1.8Q1.35 0.21 2.03 -1.82Q2.71 -3.85 4.04 -8.87L4.63 -8.46L2.93 -1.05ZM3.38 -8.93L2.44 -7.97L0.25 -10.62L1.19 -11.6ZM3.65 -12.23Q2.64 -13.71 1.43 -15L2.32 -16.02Q3.59 -14.65 4.67 -13.09Z'],
};

// ---------------------------------------------------------------------------------------------- geometry
const HZ = 470;
const X0 = -420, X1 = 2020;
const CLOUD_W = 3200;                   // cloud wrap span
const CLOUD_K = 0.018, CLOUD_V = 2.6;   // calm: parallax factor on the ridden distance + a slow breeze (px/s)
const PLANE_SPAN = 3200, PLANE_V = 20;  // biplane loop (px) and screen speed (px/s)
const FLOCK_SPAN = 2600, SKEIN_SPAN = 2600, SHIP_SPAN = 2600, BALLOON_SPAN = 2800, GULL_SPAN = 2400;
const T_HERO = 3.2, D_HERO = T_HERO * DIST_PER_REV_;
const OFF0 = D_HERO * CLOUD_K + T_HERO * CLOUD_V;   // cloud offset at the hero frame (drawn at hero position + OFF0)

export const detailItems = [
  ['sky:O:gouache-wash', 'O', 'five-paint sky wash from the zenith to the horizon (time-of-day keyed)'],
  ['sky:T:gouache-mottle', 'T', 'baked gouache mottle: pale blooms and pooled pigment over the whole sky'],
  ['sky:T:pigment-granulation', 'T', 'granulation specks of the zenith paint in the upper sky'],
  ['sky:T:brush-streaks-cool', 'T', 'dry-brush streaks of cool violet in the upper sky'],
  ['sky:T:brush-streaks-rose', 'T', 'rose streaks in the middle of the wash'],
  ['sky:T:brush-streaks-warm', 'T', 'warm peach streaks low in the sky'],
  ['sky:T:bristle-marks', 'T', 'bristle lines dragged through the streaks'],
  ['sky:O:horizon-glow', 'O', 'soft glow band sitting on the horizon'],
  ['sky:O:horizon-light-line', 'O', 'hand-painted light line just above the sea'],
  ['sky:O:sun-glow-wash', 'O', 'wide watercolour glow around the sun'],
  ['sky:O:sun-bloom', 'O', 'inner bloom of the glow'],
  ['sky:O:sun-disc', 'O', 'wobbly painted sun disc'],
  ['sky:O:sun-core', 'O', 'pale pooled core, off-centre like wet paint'],
  ['sky:T:sun-backrun-edge', 'T', 'darker pigment back-run along the disc edge'],
  ['sky:T:sun-brush-dabs', 'T', 'brush dabs inside the disc'],
  ['sky:O:sun-cloud-wisps', 'O', 'thin painted cloud wisps across the sun'],
  ['sky:O:cumulus-large', 'O', 'wide three-tone gouache cumulus'],
  ['sky:O:cumulus-tower', 'O', 'taller cumulus with a heaped top'],
  ['sky:O:cumulus-small', 'O', 'small puff'],
  ['sky:O:cumulus-flat', 'O', 'flat-bottomed fair-weather cloud near the sun'],
  ['sky:O:cloud-lit-top', 'O', 'the lit top puff of each cloud'],
  ['sky:O:cloud-mid-tone', 'O', 'the rose middle tone'],
  ['sky:O:cloud-shade-base', 'O', 'the violet shaded base'],
  ['sky:T:cloud-rim-light', 'T', 'rim light along the sun-facing bumps'],
  ['sky:T:cloud-brush-dabs', 'T', 'dry-brush highlight dabs on the tops'],
  ['sky:T:cloud-brush-texture', 'T', 'long dry strokes dragged across the middle tone'],
  ['sky:T:cloud-feathered-edge', 'T', 'soft feathered skirt around each cloud (the painted soft edge, baked)'],
  ['sky:T:cloud-belly-glaze', 'T', 'cool glaze under the belly'],
  ['sky:T:cloud-edge-flecks', 'T', 'dry-brush flecks along the lower edges'],
  ['sky:O:stratus-bands', 'O', 'long painted stratus bands low over the sea'],
  ['sky:O:cirrus-wisps', 'O', 'high thin brush wisps'],
  ['sky:T:mackerel-sky', 'T', 'rows of tiny puffs (altocumulus)'],
  ['sky:O:horizon-bank', 'O', 'far cloud bank sitting on the horizon'],
  ['sky:O:fish-cloud', 'O', 'a cloud shaped like a fish (egg), comes by later'],
  ['sky:O:rain-cloud', 'O', 'small grey cloud with a soft rain veil (virga), comes by later'],
  ['sky:O:balloon-envelope', 'O', 'patchwork hot-air balloon'],
  ['sky:T:balloon-patch-stitches', 'T', 'patchwork seams and stitches'],
  ['sky:O:balloon-basket', 'O', 'wicker basket with weave'],
  ['sky:O:balloon-ropes', 'O', 'ropes and sandbags'],
  ['sky:O:balloon-flag', 'O', 'pennant on the basket'],
  ['sky:O:balloon-burner', 'O', 'burner flame; at night it glows inside the envelope'],
  ['sky:O:airship', 'O', 'striped toy airship envelope'],
  ['sky:O:airship-gores', 'O', 'red gore stripes'],
  ['sky:T:airship-highlight', 'T', 'soft highlight and belly shade'],
  ['sky:O:airship-fins', 'O', 'teal tail fins'],
  ['sky:O:airship-gondola', 'O', 'wooden gondola'],
  ['sky:O:airship-windows', 'O', 'lit round windows (a tiny pelican passenger in one)'],
  ['sky:O:airship-rigging', 'O', 'rigging lines'],
  ['sky:O:airship-propeller', 'O', 'rear propeller'],
  ['sky:O:airship-pennant', 'O', 'pennant on the tail'],
  ['sky:O:biplane', 'O', 'red toy biplane fuselage'],
  ['sky:O:biplane-wings', 'O', 'cream wings with teal tips'],
  ['sky:T:biplane-wing-stitching', 'T', 'rib stitching on the wings'],
  ['sky:O:biplane-struts', 'O', 'wooden struts and bracing wires'],
  ['sky:O:biplane-prop', 'O', 'propeller blur disc, blades and spinner'],
  ['sky:O:biplane-pilot', 'O', 'pelican pilot with goggles and a red scarf'],
  ['sky:O:biplane-gear', 'O', 'wheels and axle'],
  ['sky:O:biplane-tail', 'O', 'teal fin with a red stripe, tailplane'],
  ['sky:O:biplane-star', 'O', 'yellow star on the fuselage'],
  ['sky:O:biplane-nav-lights', 'O', 'wing-tip and tail lights (glow at night)'],
  ['sky:O:biplane-puffs', 'O', 'little exhaust puffs'],
  ['sky:O:tow-rope', 'O', 'tow rope and bridle'],
  ['sky:O:banner', 'O', 'fluttering cloth banner (5 panels)'],
  ['sky:O:banner-lettering', 'O', 'hand-lettered "Pelican Bay 鹈鹕湾" in serif'],
  ['sky:T:banner-stitching', 'T', 'running stitches along the hems'],
  ['sky:O:banner-scallops', 'O', 'scalloped red hem'],
  ['sky:O:banner-streamers', 'O', 'ribbon streamers at the tail'],
  ['sky:O:banner-pole', 'O', 'spreader pole with knobs'],
  ['sky:O:pelican-v-formation', 'O', 'painted pelicans flying in a V (flapping)'],
  ['sky:O:gulls', 'O', 'hand-drawn gulls (flapping)'],
  ['sky:O:bird-skein', 'O', 'far skein of small birds'],
  ['sky:O:moon', 'O', 'big gentle cream moon'],
  ['sky:O:moon-glow', 'O', 'warm glow and a soft violet halo'],
  ['sky:T:moon-maria', 'T', 'soft painted maria'],
  ['sky:O:moon-craters', 'O', 'little crater rings'],
  ['sky:T:moon-shade', 'T', 'shaded limb and a highlight'],
  ['sky:O:star-crosses', 'O', 'stars painted as little crosses (3 sizes)'],
  ['sky:O:star-dots', 'O', 'tiny dot stars'],
  ['sky:O:twinkle-stars', 'O', 'a few twinkling stars'],
  ['sky:O:glow-stars', 'O', 'bright stars with a soft glow'],
  ['sky:O:pelican-constellation', 'O', 'a constellation drawn as a pelican (egg)'],
  ['sky:T:milky-wash', 'T', 'Milky Way as a soft brushed wash'],
  ['sky:O:shooting-stars', 'O', 'shooting stars with soft tails'],
].map(([key, kind, what]) => ({ id: key.split(':')[2], layer: 'sky', kind, what, key }));
const DD = key => ({ 'data-detail': key });

// ---------------------------------------------------------------------------------------------- build
export function build(ctx) {
  const { v, rng } = ctx;
  let defs = '';
  const LINE = v('line'), LSOFT = v('lineSoft');
  const S = (col, w, o = {}) => ({ fill: 'none', stroke: col, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...o });

  // ======================== L-sky: the painted wash
  let sky = '';
  defs += h('linearGradient', { id: 'sky-grad', x1: 0, y1: 0, x2: 0, y2: 480, gradientUnits: 'userSpaceOnUse' },
    [[0, 'skyTop'], [0.32, 'skyHigh'], [0.6, 'skyMid'], [0.82, 'skyLow'], [1, 'skyHaze']].map(([o, t]) => h('stop', { offset: o, 'stop-color': v(t) })));
  defs += h('linearGradient', { id: 'sky-hzGlow', x1: 0, y1: 400, x2: 0, y2: 474, gradientUnits: 'userSpaceOnUse' },
    h('stop', { offset: 0, 'stop-color': v('skyGlow'), 'stop-opacity': 0 }), h('stop', { offset: 0.7, 'stop-color': v('skyGlow'), 'stop-opacity': 0.55 }),
    h('stop', { offset: 1, 'stop-color': v('skyGlow'), 'stop-opacity': 0.9 }));
  // the wide watercolour glow of the sun is painted INTO the wash (a radial gradient that follows the sun), so it
  // never lies over the sky as a separate veil
  const RG = (id2, stops, r, o = {}) => h('radialGradient', { id: id2, cx: 0, cy: 0, r, gradientUnits: 'userSpaceOnUse', ...o }, stops.map(([o2, t, a]) => h('stop', { offset: o2, 'stop-color': v(t), 'stop-opacity': a })));
  defs += RG('sky-sunWash', [[0, 'sunGlow', 0.95], [0.18, 'sunHalo', 0.7], [0.5, 'sunBloom', 0.25], [1, 'sunBloom', 0]], 520, { 'data-ref': 'sky-sunWash', gradientTransform: 'translate(1451 330)' });
  sky += h('rect', { x: X0, y: -420, width: X1 - X0, height: 896, fill: 'url(#sky-grad)' });
  sky += h('rect', { ...DD('sky:O:sun-glow-wash'), 'data-ref': 'sky-sunWashR', x: 931, y: -190, width: 1040, height: 666, fill: 'url(#sky-sunWash)' });
  // gouache mottle, baked (a filter here re-ran on every camera move): uneven pigment coverage as large wobbly
  // blotches at a few percent: pale blooms where the wash dried lighter, pooled pigment where it dried darker, and
  // granulation specks in the upper sky
  {
    const R = rng('mottle'); let lite = '', dark = '', gran = '';
    for (let i = 0; i < 40; i++) {
      const x = X0 + 60 + R() * (X1 - X0 - 120), y = -40 + R() * 470, rx = 110 + R() * 220, ry = 16 + R() * 34;
      const pts = blob(R, x, y, rx, ry, 11, 0.5, R() * 6);
      if (i % 2) lite += cr(pts); else dark += cr(pts);
    }
    for (let i = 0; i < 160; i++) { const x = X0 + R() * (X1 - X0), y = -40 + Math.pow(R(), 1.6) * 300, r = 0.8 + R() * 1.6; gran += cr(blob(R, x, y, r, r * 0.8, 5, 0.5)); }
    sky += h('g', DD('sky:T:gouache-mottle'), h('path', { d: dark, fill: '#4A3060', opacity: 0.03 }), h('path', { d: lite, fill: '#FFF6EC', opacity: 0.05 }));
    sky += h('path', { ...DD('sky:T:pigment-granulation'), d: gran, fill: v('skyTop'), opacity: 0.35 });
  }

  // dry-brush streaks: long horizontal strokes, three paints by height (the draft's 38 soft strokes, baked)
  {
    const R = rng('streaks');
    const bands = [['cool', 'skyWashCool', 10, 210, 26, [0.12, 0.24]], ['rose', 'skyWashRose', 190, 330, 20, [0.12, 0.22]], ['warm', 'skyWashWarm', 300, 452, 26, [0.16, 0.3]]];
    let br = '';
    for (const [nm, tok, y0, y1, n, [oa, ob]] of bands) {
      let d = '', dh = '';
      for (let i = 0; i < n; i++) {
        const y = y0 + R() * (y1 - y0), x = X0 + 80 + R() * (X1 - X0 - 200), len = 140 + R() * 300, w = 5 + R() * 11, bend = (R() - 0.5) * 8, ang = (R() - 0.5) * 1.6;
        if (i % 2) d += brush(R, x, y, len, w, bend, ang); else dh += brush(R, x, y, len, w, bend, ang);
        if (i % 3 === 0) br += bristles(R, x, y, len, w, bend, ang, 2 + (i % 2));
      }
      sky += h('g', DD('sky:T:brush-streaks-' + nm), h('path', { d, fill: v(tok), opacity: oa }), h('path', { d: dh, fill: v(tok), opacity: ob }));
    }
    sky += h('path', { ...DD('sky:T:bristle-marks'), d: br, ...S(v('skyWashWarm'), 0.9, { opacity: 0.3 }) });
  }
  sky += h('rect', { ...DD('sky:O:horizon-glow'), x: X0, y: 400, width: X1 - X0, height: 76, fill: 'url(#sky-hzGlow)' });
  {
    const R = rng('hzline'); const pts = [];
    for (let x = X0; x <= X1; x += 80) pts.push([x, 465.5 + (R() - 0.5) * 1.6]);
    sky += h('path', { ...DD('sky:O:horizon-light-line'), d: cr(pts, false), ...S(v('skyGlow'), 2.2, { opacity: 0.8 }) });
  }
  // ======================== L-sunmoon: sun (local coords, centre 0,0) and moon
  defs += RG('sky-sunBloom', [[0, 'sunCore', 0.9], [0.35, 'sunGlow', 0.6], [0.7, 'sunGlow', 0.22], [1, 'sunGlow', 0]], 150);
  let sun = '';
  {
    const R = rng('sun');
    sun += h('circle', { ...DD('sky:O:sun-bloom'), r: 150, fill: 'url(#sky-sunBloom)' });
    const disc = blob(R, 0, 0, 46, 46, 22, 0.06);
    let dsc = h('path', { d: cr(disc), fill: v('sunRing') });
    dsc += h('path', { ...DD('sky:O:sun-core'), d: cr(blob(R, -4, -5, 34, 33, 16, 0.08)), fill: v('sunCore'), opacity: 0.9 });
    // back-run: pigment dried darker at the wet edge, a broken ring of tapered arcs
    let br = '';
    for (let a = 0; a < 360; a += 26 + R() * 50) {
      const a1 = a + 20 + R() * 45, pts = [];
      for (let k = 0; k <= 5; k++) { const aa = (a + (a1 - a) * (k / 5)) * D2R, r = 44.5 + (R() - 0.5) * 1.2; pts.push([r * Math.cos(aa), r * Math.sin(aa)]); }
      br += cr(pts, false);
    }
    dsc += h('path', { ...DD('sky:T:sun-backrun-edge'), d: br, ...S(v('sunBloom'), 1.5, { opacity: 0.28 }) });
    let dabs = '';
    for (let i = 0; i < 7; i++) { const a = R() * 2 * Math.PI, r = R() * 26; dabs += brush(R, r * Math.cos(a) - 8, r * Math.sin(a), 12 + R() * 12, 3 + R() * 2, 1.5, -20 + R() * 40); }
    dsc += h('path', { ...DD('sky:T:sun-brush-dabs'), d: dabs, fill: v('sunCore'), opacity: 0.75 });
    sun += h('g', DD('sky:O:sun-disc'), dsc);
    // thin cloud wisps drawn across the lower half (golden hour bars, painted)
    let w1 = '', w2 = '';
    for (const [x, y, L2, w] of [[-190, 18, 170, 5], [-40, 30, 200, 4], [60, 8, 130, 3.4], [-240, 40, 120, 3]]) w1 += brush(R, x, y, L2, w, 2, 0.4);
    for (const [x, y, L2, w] of [[-150, 26, 120, 2.6], [30, 38, 150, 2.4]]) w2 += brush(R, x, y, L2, w, -1.5, -0.5);
    sun += h('g', DD('sky:O:sun-cloud-wisps'), h('path', { d: w1, fill: v('sunBar1'), opacity: 0.8 }), h('path', { d: w2, fill: v('sunBar2'), opacity: 0.85 }));
  }

  let moon = '';
  defs += RG('sky-moonGlow', [[0, 'moonHalo1', 0.75], [0.3, 'moonHalo1', 0.35], [0.6, 'moonHalo2', 0.2], [1, 'moonHalo2', 0]], 230);
  {
    const R = rng('moon'), MR = 58;
    moon += h('circle', { ...DD('sky:O:moon-glow'), r: 230, fill: 'url(#sky-moonGlow)' });
    moon += h('path', { d: cr(blob(R, 0, 0, MR + 24, MR + 24, 20, 0.05)), ...S(v('moonHalo1'), 5, { opacity: 0.12 }) });
    const disc = blob(R, 0, 0, MR, MR, 24, 0.04);
    moon += h('path', { ...DD('sky:O:moon'), d: cr(disc), fill: v('moon') });
    // maria: soft blotches, then a shaded limb (lower left) and a creamy highlight (upper right)
    const maria = [[-16, -12, 17, 12], [14, 10, 14, 10], [-8, 22, 10, 7], [20, -18, 9, 7], [-26, 8, 7, 9]];
    moon += h('path', { ...DD('sky:T:moon-maria'), d: maria.map(([x, y, rx, ry]) => cr(blob(R, x, y, rx, ry, 9, 0.3))).join(''), fill: v('moonShade'), opacity: 0.55 });
    moon += h('g', DD('sky:T:moon-shade'),
      h('path', { d: `M${-MR * 0.2} ${MR * 0.98}A${MR} ${MR} 0 0 1 ${-MR * 0.98} ${MR * 0.2}Q${-MR * 0.7} ${MR * 0.7} ${-MR * 0.2} ${MR * 0.98}Z`, fill: v('moonShade'), opacity: 0.6 }),
      h('path', { d: brush(R, 8, -42, 34, 5, -6, 30), fill: v('moonRing'), opacity: 0.9 }));
    const craters = [[22, 24, 5.5], [-30, -20, 4], [2, -34, 4.6], [-2, 36, 3], [36, -2, 3.4], [-38, 14, 2.8], [12, -6, 2.4]];
    moon += h('path', { ...DD('sky:O:moon-craters'), d: craters.map(([x, y, r]) => cr(blob(R, x, y, r, r * 0.9, 7, 0.2))).join(''), ...S(v('moonShade'), 1.4) });
    moon += h('path', { d: cr(disc), ...S(v('moonShade'), 1.2, { opacity: 0.6 }) });
  }
  const sunmoon = h('g', { 'data-ref': 'sky-sun', transform: 'translate(1451 330)' }, sun) +
    h('g', { 'data-ref': 'sky-moon', transform: 'translate(134 587)', visibility: 'hidden' }, moon);

  // ======================== L-stars
  let stars = '';
  {
    // a painted cross: two tapered strokes (vertical a touch longer), slightly tilted by hand
    const cross = (x, y, r, R) => {
      const a = (R() - 0.5) * 16, w = r * 0.34;
      return brush(R, x - r, y, 2 * r, w, 0, a, 0.5) + brush(R, x, y - r * 1.15, 2.3 * r, w, 0, 90 + a, 0.5);
    };
    const R = rng('stars'); const b = ['', '', ''], dots = [];
    for (let i = 0; i < 150; i++) {
      const x = X0 + R() * (X1 - X0), y = -80 + Math.pow(R(), 1.3) * 520, m = R();
      if (y > 440) continue;
      if (m < 0.55) { dots.push(`M${f1(x)} ${f1(y)}h0`); continue; }
      const k = m < 0.85 ? 0 : m < 0.96 ? 1 : 2;
      b[k] += cross(x, y, [2.6, 4.2, 6][k], R);
    }
    stars += h('path', { ...DD('sky:O:star-dots'), d: dots.join(''), ...S(v('star'), 1.8) });
    stars += h('g', DD('sky:O:star-crosses'), b.map((d, i) => h('path', { d, fill: v('star'), opacity: [0.75, 0.9, 1][i] })));
    // bright stars with a soft glow
    defs += h('radialGradient', { id: 'sky-starGlow' }, h('stop', { offset: 0, 'stop-color': v('star'), 'stop-opacity': 0.7 }), h('stop', { offset: 1, 'stop-color': v('star'), 'stop-opacity': 0 }));
    const R2 = rng('glowstars'); let gs = '', gc = '';
    for (let i = 0; i < 7; i++) { const x = 60 + R2() * 1480, y = 30 + R2() * 260; gs += h('circle', { cx: f1(x), cy: f1(y), r: 13, fill: 'url(#sky-starGlow)' }); gc += cross(x, y, 7.5, R2); }
    stars += h('g', DD('sky:O:glow-stars'), gs, h('path', { d: gc, fill: v('star') }));
    // twinkling subset: three groups whose opacity breathes (stepped)
    const R3 = rng('tw');
    for (let g = 0; g < 3; g++) {
      let d = '';
      for (let i = 0; i < 5; i++) d += cross(40 + R3() * 1520, 30 + R3() * 330, 4 + R3() * 2.5, R3);
      stars += h('path', { ...(g === 0 ? DD('sky:O:twinkle-stars') : {}), 'data-ref': 'sky-tw' + g, d, fill: v('star') });
    }
    // the Pelican: a storybook constellation (dotted lines + crosses) high over the left sky
    const PEL = [[0, 44], [36, 24], [78, 16], [94, -16], [100, -40], [116, -46], [128, -38], [196, -22], [150, -10], [118, -8], [106, 20], [84, 48], [40, 58]];
    const lines = PEL.map((p, i) => [p, PEL[(i + 1) % PEL.length]]).concat([[[128, -38], [150, -10]]]);   // + the gape line
    const shrink = ([a, b2]) => { const dx = b2[0] - a[0], dy = b2[1] - a[1], L2 = Math.hypot(dx, dy), k = 7 / L2; return `M${f(a[0] + dx * k)} ${f(a[1] + dy * k)}L${f(b2[0] - dx * k)} ${f(b2[1] - dy * k)}`; };
    const R4 = rng('pelcon');
    stars += h('g', { ...DD('sky:O:pelican-constellation'), transform: 'translate(1160 112)' },
      h('path', { d: lines.map(shrink).join(''), ...S(v('starLine'), 1.4, { 'stroke-dasharray': '2 5', opacity: 0.9 }) }),
      h('path', { d: PEL.map(([x, y], i) => cross(x, y, i === 7 ? 6.5 : 4.2, R4)).join('') + cross(110, -32, 3, R4), fill: v('star') }));
    // Milky Way: soft diagonal brushed wash
    const R5 = rng('milky'); let mw = '';
    for (let i = 0; i < 40; i++) { const u = R5(); const x = -200 + u * 2000, y = 420 - u * 520 + (R5() - 0.5) * 90; mw += brush(R5, x, y, 120 + R5() * 160, 14 + R5() * 22, (R5() - 0.5) * 10, -14.5); }
    stars += h('path', { ...DD('sky:T:milky-wash'), d: mw, fill: v('milky'), opacity: 0.22 });
    // shooting stars: a soft tapered tail pointing to -x (the head at 0,0)
    const R6 = rng('shoot');
    const streak = h('path', { d: brush(R6, -120, 0, 120, 3.4, 0, 0, 0.02), fill: v('star'), opacity: 0.8 }) + h('path', { d: cross(0, 0, 5, R6), fill: v('star') });
    stars += h('g', { ...DD('sky:O:shooting-stars'), 'data-ref': 'sky-shoot0', opacity: 0 }, streak) + h('g', { 'data-ref': 'sky-shoot1', opacity: 0 }, streak);
  }
  const starsL = h('g', { 'data-ref': 'sky-stars', style: 'opacity:var(--pb-n-starAlpha)', visibility: 'hidden' }, stars);

  // ======================== L-clouds
  const drift = []; let still = '';
  // three-tone gouache cloud: shade base, rose middle, lit top (the draft's cloud()), plus baked painterly marks
  function cloud(seed, cx, cy, w, hh, n, key, o = {}) {
    const R = rng('cl' + seed);
    const base = puffPts(R, cx, cy, w, hh, n), mid = puffPts(R, cx + w * 0.05, cy - hh * 0.18, w * 0.86, hh * 0.9, n - 1);
    const hi = puffPts(R, cx + w * 0.12, cy - hh * 0.38, w * 0.6, hh * 0.65, Math.max(3, n - 3));
    const lit = o.lit || 'cloudLit', md = o.mid || 'cloudMid', sh = o.shade || 'cloudShade';
    // soft painted edge, baked: a feathered skirt (the base grown by a few units, faint) under the three tones
    const grow = (pts, k) => pts.map(([x, y]) => [cx + (x - cx) * (1 + k / (w / 2)), cy - hh * 0.2 + (y - cy + hh * 0.2) * (1 + k / hh)]);
    let soft = h('path', { ...DD('sky:T:cloud-feathered-edge'), d: cr(grow(base, 3.2)) + cr(grow(mid, 2.4)), fill: v(md), opacity: 0.3 }) +
      h('path', { ...DD('sky:O:cloud-shade-base'), d: cr(base), fill: v(sh) }) +
      h('path', { ...DD('sky:O:cloud-mid-tone'), d: cr(mid), fill: v(md) }) +
      h('path', { ...DD('sky:O:cloud-lit-top'), d: cr(hi), fill: v(lit), opacity: 0.95 });
    // cool glaze under the belly: a lens hugging the flat base
    const by = cy + hh * 0.1;
    soft += h('path', { ...DD('sky:T:cloud-belly-glaze'), d: brush(R, cx - w * 0.42, by, w * 0.8, hh * 0.16, hh * 0.05, 0, 0.3), fill: v('cloudBank'), opacity: 0.55 });
    let crisp = '';
    // rim light along the sun-facing bumps of the lit top and the middle tone (right half)
    // a short lit arc on the crown of each sun-facing lobe of the top puff (and the far right lobes of the middle tone)
    const rimOf = (pts, k0) => pts.lobes.filter((_, i) => i >= pts.lobes.length * k0).map(l => cr(l.map(([x, y], j) => [x + (j - 1) * 0.6, y + 2.4]), false)).join('');
    crisp += h('path', { ...DD('sky:T:cloud-rim-light'), d: rimOf(hi, 0.25), ...S(v('cloudRim'), 2.2, { opacity: 0.7 }) });
    // long dry strokes dragged across the middle tone (the gouache brush direction)
    let tex = '';
    for (let i = 0; i < 3 + Math.round(w / 160); i++) tex += brush(R, cx - w * 0.4 + R() * w * 0.3, cy - hh * (0.05 + R() * 0.3), w * (0.25 + R() * 0.35), 1.6 + R() * 1.4, (R() - 0.5) * 3, (R() - 0.5) * 3, 0.2);
    crisp += h('path', { ...DD('sky:T:cloud-brush-texture'), d: tex, fill: v('cloudLit'), opacity: 0.3 });
    // dry-brush dabs on the lit top
    let dabs = '';
    for (let i = 0; i < Math.round(w / 45); i++) { const p = hi[1 + Math.floor(R() * (hi.length / 2 - 1))]; dabs += brush(R, p[0] - 6, p[1] + 5 + R() * hh * 0.2, 10 + R() * 14, 2.2 + R() * 1.6, -1, -8 + R() * 16); }
    crisp += h('path', { ...DD('sky:T:cloud-brush-dabs'), d: dabs, fill: v('cloudRim'), opacity: 0.6 });
    // flecks along the lower edge (tiny tapered ticks just outside the silhouette)
    let fl = '';
    for (let i = 0; i < Math.round(w / 30); i++) { const x = cx - w * 0.45 + R() * w * 0.9; fl += brush(R, x, cy + hh * 0.2 + R() * 4, 6 + R() * 10, 1.6 + R(), 0.6, (R() - 0.5) * 10); }
    crisp += h('path', { ...DD('sky:T:cloud-edge-flecks'), d: fl, fill: v(sh), opacity: 0.55 });
    return h('g', DD(key), soft, crisp);
  }
  // drawn at hero-frame position + OFF0 (the offset the clouds have drifted by at the hero frame)
  const at = (x, mk) => drift.push([x + OFF0, mk]);
  const O = OFF0;
  at(300, cloud('a', 300 + O, 215, 480, 90, 9, 'sky:O:cumulus-large'));
  at(120, cloud('b', 120 + O, 150, 230, 50, 6, 'sky:O:cumulus-small'));
  at(930, cloud('c', 930 + O, 150, 300, 84, 7, 'sky:O:cumulus-tower'));
  at(1250, cloud('d', 1250 + O, 232, 300, 42, 6, 'sky:O:cumulus-flat'));
  at(1590, cloud('e', 1590 + O, 140, 260, 50, 5, 'sky:O:cumulus-small'));
  at(2150, cloud('f', 2150 + O, 190, 420, 76, 8, 'sky:O:cumulus-large'));
  at(-420, cloud('g', -420 + O, 250, 360, 70, 7, 'sky:O:cumulus-tower'));
  // stratus: long painted bands low over the sea
  {
    const R = rng('stratus');
    const band = (x, y, rows) => { let d1 = '', d2 = ''; for (const [dx, dy, L2, w] of rows) { d1 += brush(R, x + dx, y + dy, L2, w, 1.5, 0.2, 0.3); d2 += brush(R, x + dx + L2 * 0.12, y + dy + w * 0.55, L2 * 0.7, w * 0.45, 1, 0.2, 0.3); }
      return h('g', DD('sky:O:stratus-bands'), h('path', { d: d1, fill: v('cloudLit'), opacity: 0.8 }), h('path', { d: d2, fill: v('cloudMid'), opacity: 0.75 })); };
    at(40, band(40 + O, 396, [[0, 0, 520, 9], [80, 12, 300, 5]]));
    at(640, band(640 + O, 420, [[0, 0, 480, 8], [120, -9, 220, 4.5]]));
    at(980, band(980 + O, 374, [[0, 0, 310, 7]]));
    at(1900, band(1900 + O, 404, [[0, 0, 420, 8], [60, 12, 260, 5]]));
  }
  // cirrus: high thin brush wisps with hooked ends (far and static)
  {
    const R = rng('cirrus'); let d = '', d2 = '';
    for (const [x, y] of [[420, 60], [520, 84], [640, 46], [1060, 40], [1160, 64], [1330, 34], [-120, 70], [1720, 60]]) {
      const L2 = 90 + R() * 90;
      d += brush(R, x, y, L2, 3.4 + R() * 1.5, -6, -3, 0.1);
      d2 += brush(R, x + L2 * 0.2, y + 6, L2 * 0.6, 1.8, -3, -2, 0.1);
    }
    still += h('g', DD('sky:O:cirrus-wisps'), h('path', { d, fill: v('cloudHigh'), opacity: 0.55 }), h('path', { d: d2, fill: v('cloudHigh'), opacity: 0.4 }));
  }
  // mackerel sky: rows of tiny painted puffs, smaller toward the top
  {
    const R = rng('mack'); let d = '', u = '';
    for (let row = 0; row < 4; row++) {
      const y = 96 - row * 12, r = 6.4 - row * 1.1;
      for (let x = 150 + O + row * 18 + R() * 10; x < 470 + O - row * 30;) {
        const w = r * (2 + R() * 1.8), yy = y + (R() - 0.5) * 4;
        if (R() < 0.18) { x += w + 6; continue; }        // gaps: the cloudlets break up irregularly
        d += cr(blob(R, x, yy, w / 2, r * (0.55 + R() * 0.3), 9, 0.2).map(([px, py]) => [px, Math.min(py, yy + r * 0.22)]));
        u += brush(R, x - w * 0.42, yy + r * 0.12, w * 0.84, Math.max(1.2, r * 0.28), 0, 0, 0.3);
        x += w + 4 + R() * 9;
      }
    }
    at(150, h('g', DD('sky:T:mackerel-sky'), h('path', { d, fill: v('cloudLit'), opacity: 0.7 }), h('path', { d: u, fill: v('cloudMid'), opacity: 0.6 })));
  }
  // far horizon bank (flat bottoms sitting on the horizon, pale mauve, no line: atmospheric perspective)
  {
    const R = rng('bank'); let d = '';
    for (let x = X0 + 40; x < X1 - 100;) {
      const w = 160 + R() * 220, hh = 10 + R() * 12;
      d += cr(puffPts(R, x + w / 2, HZ + 1, w, hh, 5 + Math.floor(R() * 3), 0));
      x += w + 20 + R() * 180;
    }
    still += h('path', { ...DD('sky:O:horizon-bank'), d, fill: v('cloudBank'), opacity: 0.7 });
  }
  // the fish cloud (egg): a puffy fish with a tail, an eye hole and bubbles; comes by later in the loop
  {
    const R = rng('fish'), x = 2600 + O, y = 150;
    const body = blob(R, x, y, 70, 30, 18, 0.12);
    const tail = [[x - 64, y], [x - 104, y - 26], [x - 96, y], [x - 104, y + 24]];
    at(2600, h('g', DD('sky:O:fish-cloud'),
      h('path', { d: cr(tail) + cr(body), fill: v('cloudMid') }), h('path', { d: cr(blob(R, x + 6, y - 8, 56, 18, 14, 0.12)), fill: v('cloudLit') }),
      h('path', { d: circ(x + 44, y - 6, 4.2), fill: v('cloudShade'), opacity: 0.7 }),
      h('path', { d: `M${x + 24} ${y - 22}q-8 22 0 44M${x - 6} ${y - 26}q-8 26 0 52`, ...S(v('cloudRim'), 2.4, { opacity: 0.7 }) }),
      h('path', { d: circ(x + 86, y - 26, 5) + circ(x + 98, y - 42, 3.4) + circ(x + 104, y - 56, 2.2), fill: v('cloudLit'), opacity: 0.85 })));
  }
  // a small rain cloud with a soft painted rain veil (virga); comes by later
  {
    const R = rng('virga'), x = 2900 + O, y = 200;
    let veil = '';
    for (let i = 0; i < 9; i++) veil += brush(R, x - 70 + i * 16, y + 14, 50 + R() * 40, 5 + R() * 3, 3, 78, 0.25);
    at(2900, h('g', DD('sky:O:rain-cloud'), h('path', { d: veil, fill: v('cloudShade'), opacity: 0.35 }),
      cloud('h', x, y, 190, 44, 6, 'sky:O:cumulus-small', { lit: 'cloudMid', mid: 'cloudShade', shade: 'cloudBank' })));
  }
  const clouds = still + drift.map(([ax, mk], i) => h('g', { 'data-ref': 'sky-cl' + i, 'data-ax': f(ax) }, mk)).join('');

  // ======================== flyovers (no filters: they bob, flap and flutter)
  // night lights on the toys: warm glows that fade in with the lamps (untagged: invisible by day)
  defs += h('radialGradient', { id: 'sky-lampG' }, h('stop', { offset: 0, 'stop-color': v('lamp'), 'stop-opacity': 0.85 }), h('stop', { offset: 0.4, 'stop-color': v('lampGlow'), 'stop-opacity': 0.35 }), h('stop', { offset: 1, 'stop-color': v('lampGlow'), 'stop-opacity': 0 }));
  const nightGlow = (cx, cy, rx, ry) => h('ellipse', { cx, cy, rx, ry, fill: 'url(#sky-lampG)', style: 'opacity:var(--pb-n-lampOn)' });
  // ---- painted pelicans in a V: white coverts, dark flight feathers, peach bill; three flap frames swapped by href
  const birdSym = (bid, W, T) => {
    // near wing: white coverts from the shoulder to the wrist, black secondaries along the trailing edge, a long black
    // hand whose tip splits into two finger primaries
    const S0 = [3, -1.6], Rr = [-6, -0.6], up = Math.sign(W[1]) || -1;
    const arm = cr([S0, [(S0[0] + W[0]) / 2 + 1.2, (S0[1] + W[1]) / 2 + up * 0.9], W, [(W[0] + Rr[0]) / 2 - 0.4, (W[1] + Rr[1]) / 2], Rr]);
    const sec = `M${f(W[0])} ${f(W[1])}L${f(Rr[0])} ${f(Rr[1])}L${f(Rr[0] - 2.4)} ${f(Rr[1] - up * 0.4)}L${f(W[0] - 2.6)} ${f(W[1] - up * 0.3)}Z`;
    const dx = T[0] - W[0], dy = T[1] - W[1], L2 = Math.hypot(dx, dy), nx = -dy / L2, ny = dx / L2;
    const hp = (u, o) => [W[0] + dx * u + nx * o, W[1] + dy * u + ny * o];
    const hand = cr([hp(0, -1.8), hp(0.5, -1.7), hp(0.86, -1.1), hp(1, -0.5), hp(0.9, 0.2), hp(0.97, 0.9), hp(0.8, 1.4), hp(0.4, 1.9), hp(0, 1.8)]);
    return h('g', { id: bid },
      h('path', { d: 'M-15 0.8Q-7 -4.4 4 -3.8Q8.4 -4.2 10 -2Q9.6 0.8 5 1.8Q-5 4 -15 0.8Z', fill: v('skyBird'), stroke: v('lineSoft'), 'stroke-width': 0.7 }),
      h('path', { d: 'M8.6 -3L24 -0.2L9 0.6Z', fill: v('skyBirdBill') }), h('path', { d: 'M9 0.4L21.4 0.2Q15 3 9.2 1.8Z', fill: v('skyBirdPouch') }),
      h('path', { d: 'M-15 0.6l-3.4 -1.4l0.8 2.8Z', fill: v('skyBirdShade') }),
      h('path', { d: sec + hand, fill: v('skyBirdDark') }),
      h('path', { d: arm, fill: v('skyBird'), stroke: v('lineSoft'), 'stroke-width': 0.6 }));
  };
  defs += birdSym('sky-bird0', [-3, -11], [-9, -24]) + birdSym('sky-bird1', [-7, -4], [-23, -7]) + birdSym('sky-bird2', [-3, 8], [-8, 19]);
  const V = [[0, 0], [-38, -16], [-34, 18], [-74, -31], [-68, 36], [-110, -45], [-102, 54]];
  const flock = h('g', { 'data-ref': 'sky-flock', ...DD('sky:O:pelican-v-formation') },
    V.map(([x, y], i) => h('use', { 'data-ref': 'sky-b' + i, href: '#sky-bird' + (i % 3), transform: `translate(${x} ${y}) scale(${f(1.1 - i * 0.04)})` })));
  // ---- hand-drawn gulls (the draft's brown M ticks), two flap frames
  // (filled brush shapes, not hairlines: a tapered stroke of ink per wing)
  defs += h('path', { id: 'sky-gull0', d: 'M-14.5 2.6Q-9 -8.4 0.4 0.4Q9 -8.4 14.5 2.6Q8.4 -5 0 3Q-8.4 -5 -14.5 2.6Z', fill: v('lineSoft') }) +
    h('path', { id: 'sky-gull1', d: 'M-13.5 -3.6Q-7 0.4 0 0Q7 0.4 13.5 -3.6Q7 2.6 0 2.8Q-7 2.6 -13.5 -3.6Z', fill: v('lineSoft') });
  const GULLS = [[0, 0, 1.2, -4], [52, 26, 0.95, 6], [480, 55, 0.85, 0], [530, 38, 0.65, -8]];
  const gulls = h('g', { 'data-ref': 'sky-gulls', ...DD('sky:O:gulls') }, GULLS.map(([x, y, s, a], i) => h('use', { 'data-ref': 'sky-g' + i, href: '#sky-gull' + (i % 2), transform: `translate(${x} ${y}) rotate(${a}) scale(${s})` })));
  // ---- far skein (small, soft, no outline)
  let skein = '';
  for (let i = 0; i < 11; i++) {
    const x = i * 14 + (i % 2) * 4, y = i * 4.2 - (i % 3) * 2.2, w = 5.4 - i * 0.14, up = i % 2 ? 2.2 : 3.4;
    skein += `M${f(x - w)} ${f(y - up)}Q${f(x - w / 2)} ${f(y - up - 1)} ${f(x)} ${f(y + 0.6)}Q${f(x + w / 2)} ${f(y - up - 1)} ${f(x + w)} ${f(y - up)}Q${f(x + w / 2)} ${f(y - up + 0.4)} ${f(x)} ${f(y + 1.9)}Q${f(x - w / 2)} ${f(y - up + 0.4)} ${f(x - w)} ${f(y - up)}Z`;
  }
  const skeinG = h('g', { 'data-ref': 'sky-skein' }, h('path', { ...DD('sky:O:bird-skein'), d: skein, fill: v('cloudShade') }));

  // ---- patchwork hot-air balloon (local: envelope centre 0,0; basket below)
  const balloon = (() => {
    const R = rng('balloon'), EW = 30, EH = 34;
    // envelope outline: a round top narrowing to the throat at y = 36
    const env = [];
    for (let i = 0; i <= 16; i++) { const a = Math.PI + (i / 16) * Math.PI; env.push([EW * Math.cos(a), EH * 0.9 * Math.sin(a)]); }
    env.push([EW * 0.92, 10], [EW * 0.6, 26], [8, 38], [-8, 38], [-EW * 0.6, 26], [-EW * 0.92, 10]);
    const envD = cr(env);
    // gores: 6 vertical lens strips, alternating paints
    const cols = ['skyToyRed', 'skyToyCream', 'skyToyYellow', 'skyToyTeal', 'skyToyCream', 'skyToyRed'];
    const gx = k => -EW + (2 * EW * k) / 6;
    const gore = k => { const x0 = gx(k), x1 = gx(k + 1), sq = x => x * 0.26;
      return `M${f(sq(x0))} ${-EH * 0.9}C${f(x0 * 1.02)} -24 ${f(x0 * 1.08)} 8 ${f(x0 * 0.27)} 38L${f(x1 * 0.27)} 38C${f(x1 * 1.08)} 8 ${f(x1 * 1.02)} -24 ${f(sq(x1))} ${-EH * 0.9}Z`; };
    defs += h('clipPath', { id: 'sky-balClip' }, h('path', { d: cr(env.map(([x, y]) => [x * 0.97, y * 0.975 + 0.6])) }));   // inset: keeps the outline
    let g = h('path', { d: envD, fill: v('skyToyCream'), stroke: LINE, 'stroke-width': 1.4 }) + h('g', { 'clip-path': 'url(#sky-balClip)' },
      cols.map((c, k) => h('path', { d: gore(k), fill: v(c) })),
      h('path', { d: 'M-40 -6Q0 2 40 -6L40 2Q0 10 -40 2Z', fill: v('skyToyBlue'), opacity: 0.85 }),                 // a sash band
      h('path', { d: brush(R, -26, 6, 50, 26, 6, -4, 0.4), fill: v('skyToyRedLo'), opacity: 0.22 }),                  // shade glaze (lower left)
      h('path', { d: brush(R, 6, -22, 16, 5, -3, -50), fill: v('skyToyCream'), opacity: 0.8 }));                      // highlight
    // stitches: running dashes along the gore seams + little cross stitches on two patches
    let st = '';
    for (let k = 1; k < 6; k++) { const x0 = gx(k); st += `M${f(x0 * 0.26)} ${-EH * 0.9 + 2}C${f(x0 * 1.02)} -24 ${f(x0 * 1.08)} 8 ${f(x0 * 0.27)} 37`; }
    const env2 = '';
    g += h('path', { ...DD('sky:T:balloon-patch-stitches'), d: st, ...S(LSOFT, 0.8, { 'stroke-dasharray': '2 2.2' }) });
    g += h('path', { d: 'M-18 -12l3 3m0 -3l-3 3M10 14l3 3m0 -3l-3 3M16 -20l2.6 2.6m0 -2.6l-2.6 2.6', ...S(LSOFT, 0.8) });
    const basket = h('g', DD('sky:O:balloon-basket'),
      h('path', { d: 'M-8 52h16l-1.6 11h-12.8Z', fill: v('skyToyWood'), stroke: LINE, 'stroke-width': 1.1, 'stroke-linejoin': 'round' }),
      h('path', { d: 'M-7.6 55.5h15.2M-7 59h14M-4 52v11M0 52v11M4 52v11', ...S(v('skyToyWoodLo'), 0.7) }),
      h('path', { d: 'M-9 51h18v2.4h-18Z', fill: v('skyToyWoodLo'), stroke: LINE, 'stroke-width': 0.9 }));
    const ropes = h('g', DD('sky:O:balloon-ropes'),
      h('path', { d: 'M-8 38L-8 51M8 38L8 51M-3 38L-4 51M3 38L4 51', ...S(LSOFT, 0.7) }),
      h('path', { d: 'M-8 38h16v2.4h-16Z', fill: v('skyToyWoodLo') }),
      h('path', { d: circ(-10, 57, 2.2) + circ(10, 57, 2.2), fill: v('skyToyCreamLo'), stroke: LINE, 'stroke-width': 0.7 }));
    // the burner: a little flame over the basket; at night it lights the envelope's throat from inside
    const burner = h('g', DD('sky:O:balloon-burner'), nightGlow(0, 36, 22, 16),
      h('path', { d: 'M-2.4 49Q-3 44 0 40Q3 44 2.4 49Z', fill: v('skyToyYellow'), stroke: v('skyToyRed'), 'stroke-width': 0.7 }));
    const flag = h('path', { ...DD('sky:O:balloon-flag'), d: 'M8 52V44l7 2.2l-7 2.2', fill: v('skyToyRed'), stroke: LINE, 'stroke-width': 0.8, 'stroke-linejoin': 'round' });
    return h('g', { 'data-ref': 'sky-balloon' }, h('g', { ...DD('sky:O:balloon-envelope') }, g,
      h('path', { d: 'M-4 -31.4a4 2 0 0 0 8 0Z', fill: v('skyToyYellow'), stroke: LINE, 'stroke-width': 0.9 })), burner, basket, ropes, flag);
  })();

  // ---- striped toy airship (local, nose at +x; drawn a little softer: it is far)
  const ship = (() => {
    const R = rng('ship'), A = 62, B = 19;
    const env = [];
    for (let i = 0; i < 26; i++) { const a = (i / 26) * 2 * Math.PI, x = Math.cos(a), taper = x < 0 ? 1 + x * 0.18 : 1; env.push([A * x * (x < 0 ? 1.08 : 1), B * Math.sin(a) * taper * (1 + (R() - 0.5) * 0.02)]); }
    const envD = cr(env);
    defs += h('clipPath', { id: 'sky-shipClip' }, h('path', { d: cr(env.map(([x, y]) => [x * 0.985, y * 0.95])) }));   // inset: keeps the outline
    const goreD = [-36, -6, 24].map(x => `M${x - 8} -30C${x - 14} -10 ${x - 14} 10 ${x - 8} 30L${x + 6} 30C${x} 10 ${x} -10 ${x + 6} -30Z`).join('');
    return h('g', { 'data-ref': 'sky-ship' },
      h('g', DD('sky:O:airship'), h('path', { d: envD, fill: v('skyToyCream'), ...{ stroke: LSOFT, 'stroke-width': 1.3 } }),
        h('g', { 'clip-path': 'url(#sky-shipClip)' },
          h('path', { ...DD('sky:O:airship-gores'), d: goreD, fill: v('skyToyRed'), opacity: 0.92 }),
          h('g', DD('sky:T:airship-highlight'), h('path', { d: brush(R, -60, 12, 120, 14, 3, 0, 0.3), fill: v('skyToyCreamLo'), opacity: 0.55 }),
            h('path', { d: brush(R, -34, -11, 70, 4.4, -2, -1), fill: '#FFFDF6', opacity: 0.7 }))),
        h('path', { d: 'M60 -4.5a4.6 4.6 0 0 1 0 9a2 4.5 0 0 1 0 -9Z', fill: v('skyToyYellow'), stroke: LSOFT, 'stroke-width': 0.9 })),
      h('path', { ...DD('sky:O:airship-fins'), d: 'M-50 -9L-72 -24L-60 -25L-40 -13Z M-50 9L-72 24L-60 25L-40 13Z', fill: v('skyToyTeal'), stroke: LSOFT, 'stroke-width': 1, 'stroke-linejoin': 'round' }),
      h('path', { ...DD('sky:O:airship-pennant'), d: 'M-66 -24V-38Q-56 -37 -48 -32Q-56 -30 -66 -29Z', fill: v('skyToyRed'), stroke: LSOFT, 'stroke-width': 0.9, 'stroke-linejoin': 'round' }),
      h('path', { ...DD('sky:O:airship-rigging'), d: 'M-16 16L-10 25M16 16L10 25M0 19V25', ...S(LSOFT, 0.8) }),
      h('path', { ...DD('sky:O:airship-gondola'), d: 'M-16 25H18Q16 34 6 35H-8Q-16 33 -16 25Z', fill: v('skyToyWood'), stroke: LSOFT, 'stroke-width': 1, 'stroke-linejoin': 'round' }),
      nightGlow(0, 29.5, 22, 9),
      h('g', DD('sky:O:airship-windows'), h('path', { d: circ(-8, 29.5, 2.4) + circ(0, 29.5, 2.4) + circ(8, 29.5, 2.4), fill: v('lamp'), stroke: LSOFT, 'stroke-width': 0.6 }),
        h('path', { d: 'M7 29.6a1.7 1.7 0 1 1 1.2 -1.6l3 1.2l-3 0.6Z', fill: v('skyBird') })),              // a tiny pelican passenger
      h('g', DD('sky:O:airship-propeller'), h('path', { d: 'M-16 29.5h-4', ...S(LSOFT, 1) }),
        h('path', { d: 'M-21 23.5q-1.8 6 0 12q1.8 -6 0 -12Z', fill: v('skyToyCreamLo'), stroke: LSOFT, 'stroke-width': 0.7 })));
  })();

  // ---- red toy biplane (+x) towing the banner (plane-local: nose at +x)
  const PS = 1.25;
  const planeArt = (() => {
    const R = rng('plane');
    return h('g', { transform: `scale(${PS})` },
      h('path', { ...DD('sky:O:biplane-puffs'), d: circ(-18, 7, 2.4) + circ(-26, 9, 3) + circ(-35.5, 10.6, 2.5) + circ(-44, 11.8, 1.8), fill: v('skyToyCream'), opacity: 0.75 }),
      h('g', DD('sky:O:biplane-gear'), h('path', { d: 'M4 6L9 15.5M18 6L11 15.5', ...S(v('skyToyWoodLo'), 1.5) }),
        h('circle', { cx: 10, cy: 16.5, r: 4.4, fill: v('tyre'), stroke: LINE, 'stroke-width': 0.8 }), h('circle', { cx: 10, cy: 16.5, r: 1.6, fill: v('skyToyCream') })),
      h('path', { ...DD('sky:O:biplane-wings'), d: cr([[-12, 5], [30, 4.4], [33, 7.4], [30, 10.2], [-10, 10.4], [-13, 7.6]]), fill: v('skyToyCream'), stroke: LINE, 'stroke-width': 1 }),   // lower wing
      h('g', { ...DD('sky:O:biplane-tail') }, h('path', { d: cr([[-44, -3], [-50, -18], [-43, -19.5], [-36, -6]]), fill: v('skyToyTeal'), stroke: LINE, 'stroke-width': 1 }),
        h('path', { d: 'M-47.6 -13.4L-41 -14.4L-39.4 -10.4L-45.6 -9.6Z', fill: v('skyToyRed') }),
        h('path', { d: cr([[-56, -1.4], [-40, -2.4], [-38, 0.6], [-54, 1.6]]), fill: v('skyToyTeal'), stroke: LINE, 'stroke-width': 0.9 })),
      h('g', DD('sky:O:biplane'), h('path', { d: cr([[34, -6.6], [18, -7.4], [-8, -5.6], [-30, -3.4], [-50, -1], [-50, 2.4], [-30, 4.8], [-4, 7], [34, 6.6]]), fill: v('skyToyRed'), stroke: LINE, 'stroke-width': 1.2 }),
        h('path', { d: brush(R, -40, -2, 70, 2.6, -0.6, -1.5), fill: '#FFE9D8', opacity: 0.55 }),
        h('path', { d: 'M-40 3.4Q-10 6.4 30 5', ...S(v('skyToyRedLo'), 1.6, { opacity: 0.6 }) })),
      h('path', { ...DD('sky:O:biplane-star'), d: 'M-20 -3.2l1.2 2.6l2.8 .3l-2.1 1.9l.6 2.8l-2.5 -1.4l-2.5 1.4l.6 -2.8l-2.1 -1.9l2.8 -.3Z', fill: v('skyToyYellow'), stroke: LINE, 'stroke-width': 0.5 }),
      h('g', DD('sky:O:biplane-struts'),
        h('path', { d: 'M-2 -18.5L-0.5 6M24 -18.5L25.5 6M10 -18.5L12 -6M16 -18.5L17 -6', ...S(v('skyToyWoodLo'), 1.6) }),
        h('path', { d: 'M-2 -18L25 5.5M24 -18L-0.5 5.5', ...S(LSOFT, 0.5) })),
      h('g', DD('sky:O:biplane-pilot'),
        h('path', { d: 'M-5 -9.5Q-12 -15 -24 -12Q-17 -11 -21 -7.6Q-13 -9.6 -6 -6.5Z', fill: v('skyToyRed'), stroke: LINE, 'stroke-width': 0.6 }),   // scarf
        h('path', { d: 'M-16 -12.4l1.6 2.4M-19.6 -11l1.4 2.4', ...S(v('skyToyCream'), 0.8) }),
        h('circle', { cx: -1.5, cy: -10, r: 4.6, fill: v('skyBird'), stroke: LINE, 'stroke-width': 0.9 }),
        h('path', { d: 'M-6 -10.6Q-2 -16.4 3 -10.6Z', fill: v('skyToyWoodLo') }),                           // leather cap
        h('circle', { cx: 1.4, cy: -10.6, r: 1.8, fill: v('skyToyBlue'), stroke: v('skyToyBrass'), 'stroke-width': 0.9 }),   // goggles
        h('path', { d: 'M2 -8.6L15.5 -7L2.2 -6.2Z', fill: v('skyBirdBill'), stroke: LINE, 'stroke-width': 0.5 }),
        h('path', { d: 'M2.2 -6.6L13 -6.8Q8 -4 2.4 -5Z', fill: v('skyBirdPouch') })),
      h('path', { ...DD('sky:O:biplane-wings'), d: cr([[-16, -24], [32, -24.6], [35, -21.4], [32, -18.4], [-14, -18], [-17, -21]]), fill: v('skyToyCream'), stroke: LINE, 'stroke-width': 1 }),  // upper wing
      h('path', { d: 'M28 -24.2Q35 -24 35 -21.2Q35 -18.6 28 -18.6Z', fill: v('skyToyTeal') }),
      h('g', DD('sky:O:biplane-nav-lights'), nightGlow(35, -21.4, 6, 6), nightGlow(-49, -18, 5, 5),
        h('path', { d: circ(35.4, -21.4, 1.3), fill: v('skyToyRed'), stroke: LINE, 'stroke-width': 0.4 }), h('path', { d: circ(-49, -18.4, 1.1), fill: v('lamp'), stroke: LINE, 'stroke-width': 0.4 })),
      h('path', { ...DD('sky:T:biplane-wing-stitching'), d: [-10, -4, 2, 8, 14, 20, 26].map(x => `M${x} -23v4.2`).join('') + [-6, 0, 6, 12, 18, 24].map(x => `M${x} 5.8v3.6`).join(''), ...S(v('skyToyCreamLo'), 0.9, { 'stroke-dasharray': '1.2 1' }) }),
      h('path', { d: 'M28 -7.5h8a3 3 0 0 1 3 3v9a3 3 0 0 1 -3 3h-8Z', fill: v('skyToyCream'), stroke: LINE, 'stroke-width': 1 }),     // cowling
      h('path', { d: 'M31 -7.2v14.4', ...S(v('skyToyYellow'), 1.6) }),
      h('g', DD('sky:O:biplane-prop'), h('ellipse', { cx: 42, cy: 0, rx: 3, ry: 17, fill: v('skyToyCream'), opacity: 0.45 }),
        h('path', { d: 'M42 0Q44 -8 42.4 -15.5Q40.4 -8 42 0Q40.4 8 42.4 15.5Q44 8 42 0Z', fill: v('skyToyWood'), stroke: LINE, 'stroke-width': 0.6 }),
        h('path', { d: 'M39 -2.6Q45 -2.6 45 0Q45 2.6 39 2.6Z', fill: v('skyToyYellow'), stroke: LINE, 'stroke-width': 0.7 })));
  })();
  // banner: 5 panels skewed about their front edge (a travelling wave), letters distributed per panel
  const BL = 230, BH = 32, NP = 5, PW = BL / NP, BX = -178;
  const WORD = [...'Pelican Bay'].map(ch => [ch, 1]).concat([[' ', 1], ['鹈', 0.8], ['鹕', 0.8], ['湾', 0.8]]);
  let pen = 0; const glyphs = [];
  for (const [ch, s] of WORD) { if (ch === ' ') { pen += 7; continue; } const [adv, d] = GLYPHS[ch]; glyphs.push({ x: pen, w: adv * s, d, s }); pen += adv * s + (s < 1 ? 1.5 : 0.4); }
  const tx0 = -BL + (BL - pen) / 2 - 3;
  let panels = '', letters = '';
  {
    const R = rng('banner');
    for (let i = 0; i < NP; i++) {
      const xa = -(i + 1) * PW, xb = -i * PW, last = i === NP - 1;
      const cloth = last ? `M${f(xb + 0.6)} ${-BH / 2}L${xa - 14} ${-BH / 2}L${xa - 4} 0L${xa - 14} ${BH / 2}L${f(xb + 0.6)} ${BH / 2}Z` : `M${f(xb + 0.6)} ${-BH / 2}H${f(xa - 0.6)}V${BH / 2}H${f(xb + 0.6)}Z`;
      const x0 = xa - (last ? 10 : 0.6), x1 = xb + 0.6;
      // scalloped hem along the bottom
      let sc = `M${f(x0)} ${BH / 2 - 3}`; for (let x = x0; x < x1 - 0.5;) { const w = Math.min(7.6, x1 - x); sc += `a${f(w / 2)} ${f(w / 2)} 0 0 0 ${f(w)} 0`; x += w; } sc += `V${BH / 2 - 5.4}H${f(x0)}Z`;
      const mine = glyphs.filter(g => { const cx = tx0 + g.x + g.w / 2; return cx >= xa && cx < xb; });
      panels += h('g', { 'data-ref': 'sky-pan' + i },
        h('path', { ...(i === 0 ? DD('sky:O:banner') : {}), d: cloth, fill: v('skyToyCream'), stroke: LINE, 'stroke-width': 1.1, 'stroke-linejoin': 'round' }),
        h('path', { d: brush(R, xa, BH / 2 - 9, PW, 6, 0, 0, 0.4), fill: v('skyToyCreamLo'), opacity: 0.5 }),
        h('path', { ...(i === 1 ? DD('sky:O:banner-scallops') : {}), d: sc, fill: v('skyToyRed') }),
        h('path', { ...(i === 2 ? DD('sky:T:banner-stitching') : {}), d: `M${f(x0 + 1)} ${-BH / 2 + 3}H${f(x1 - 1)}`, ...S(v('skyToyRed'), 0.9, { 'stroke-dasharray': '2.4 1.8' }) }),
        last ? h('path', { ...DD('sky:O:banner-streamers'), d: `M${xa - 14} ${-BH / 2 + 1}q-10 -6 -26 -2q10 1 22 5Z M${xa - 14} ${BH / 2 - 1}q-12 7 -28 3q12 -1 24 -6Z`, fill: v('skyToyTeal'), stroke: LINE, 'stroke-width': 0.6 }) : '');
      // the lettering of this panel rides the same skew, in a group drawn over every cloth (glyphs may straddle a seam)
      if (mine.length) letters += h('g', { 'data-ref': 'sky-pant' + i, ...(i === 2 ? DD('sky:O:banner-lettering') : {}), fill: LINE },
        mine.map(g => h('path', { transform: `translate(${f(tx0 + g.x)} ${g.s < 1 ? 5.4 : 6.4})${g.s < 1 ? ` scale(${g.s})` : ''}`, d: g.d })));
    }
  }
  const banner = h('g', { transform: `translate(${BX} 4)` }, panels, letters,
    h('path', { ...DD('sky:O:banner-pole'), d: `M-1.6 ${-BH / 2 - 3}h3.4v${BH + 6}h-3.4Z` + circ(0.1, -BH / 2 - 4, 2.4) + circ(0.1, BH / 2 + 4, 2.4), fill: v('skyToyWood'), stroke: LINE, 'stroke-width': 0.8 }));
  const rope = h('path', { ...DD('sky:O:tow-rope'), d: `M${BX + 1} ${4 - BH / 2}L${BX + 26} 4L${BX + 1} ${4 + BH / 2}M${BX + 26} 4Q${f((BX + 26 - 60 * PS) / 2)} 13 ${f(-60 * PS)} 1`, ...S(LSOFT, 1.1) });
  const plane = h('g', { 'data-ref': 'sky-plane', transform: 'translate(1290 78)' }, h('g', { 'data-ref': 'sky-planeBody' }, rope, banner, planeArt));

  return {
    defs,
    layers: {
      'L-sky': h('g', DD('sky:O:gouache-wash'), sky),   // the whole painted wash (its marks are tagged inside)
      'L-stars': starsL,
      'L-sunmoon': sunmoon,
      'L-clouds': h('g', { 'data-ref': 'sky-shipG' }, ship) + skeinG + clouds + h('g', { 'data-ref': 'sky-balloonG' }, balloon) + h('g', { 'data-ref': 'sky-gullsG' }, gulls) + h('g', { 'data-ref': 'sky-flockG' }, flock) + plane,
    },
  };
}

// ---------------------------------------------------------------------------------------------- attach
// composited strips (see core/sheets.js): the sun, the moon, every cloud, the airship, the balloon, the gulls, the
// skein and the pelican V move by a pure translate, so each is its own compositor layer; the biplane (bob, roll, fluttering banner) gets a sheet of its own so its repaint touches nothing else.
const N_CLOUDS = 16;
export const sheets = ['[data-ref="sky-sun"]', '[data-ref="sky-moon"]', ...Array.from({ length: N_CLOUDS }, (_, i) => `[data-ref="sky-cl${i}"]`),
  '[data-ref="sky-shipG"]', '[data-ref="sky-skein"]', '[data-ref="sky-balloonG"]', '[data-ref="sky-gullsG"]', '[data-ref="sky-flockG"]'];
export const isolate = ['[data-ref="sky-plane"]'];
export function attach(svg, ctx) {
  const r = refs(svg, 'sky-');
  const st = { flap: [], gflap: [] };
  const set = (el, k, val, key) => { if (el && st[key] !== val) { st[key] = val; el.setAttribute(k, val); } };
  const pan = [0, 1, 2, 3, 4].map(i => r['pan' + i]), pant = [0, 1, 2, 3, 4].map(i => r['pant' + i]);
  const birds = [0, 1, 2, 3, 4, 5, 6].map(i => r['b' + i]);
  const gulls = [0, 1, 2, 3].map(i => r['g' + i]);
  const clouds = Object.keys(r).filter(k => /^cl\d+$/.test(k)).map(k => [r[k], +r[k].getAttribute('data-ax')]);
  const flyOn = (el, u, u0, span, seed, p) => { const c = Math.floor(u / span), on = c === Math.floor(u0 / span) || hash(c, seed) < p; const vis = on ? 'visible' : 'hidden'; if (el.__vis !== vis) { el.__vis = vis; el.setAttribute('visibility', vis); } return c; };
  return {
    update(fr) {
      const t = fr.t, reduced = fr.reduced || ctx.reduced, D = fr.distance || 0;
      const sun = fr.sun, moon = fr.moon;
      // sun + moon (their blooms travel with them)
      set(r.sun, 'transform', `translate(${f(sun.x)} ${f(sun.y)})`, 'sun');
      if (st.wash !== r.sun.getAttribute('transform')) {   // the glow painted into the wash follows the sun (only on a tod change)
        st.wash = r.sun.getAttribute('transform');
        r.sunWash.setAttribute('gradientTransform', st.wash);
        r.sunWashR.setAttribute('x', f(sun.x - 520)); r.sunWashR.setAttribute('y', f(Math.max(-420, sun.y - 520)));
        r.sunWashR.setAttribute('visibility', sun.elev < -0.42 ? 'hidden' : 'visible');
      }
      set(r.sun, 'visibility', sun.elev < -0.42 ? 'hidden' : 'visible', 'sunVis');
      set(r.moon, 'transform', `translate(${f(moon.x)} ${f(moon.y)})`, 'moon');
      set(r.moon, 'visibility', moon.elev > -0.32 && fr.night > 0.02 ? 'visible' : 'hidden', 'moonVis');
      // stars
      const sa = fr.pal && fr.pal.num ? fr.pal.num.starAlpha : fr.night;
      const starVis = sa > 0.01 ? 'visible' : 'hidden';
      set(r.stars, 'visibility', starVis, 'starVis');
      if (starVis === 'visible') {
        const tt = Math.floor(t * 6) / 6;             // twinkles breathe slowly, stepped at 6 Hz
        for (let g = 0; g < 3; g++) {
          const o = reduced ? 0.8 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(tt * (1.1 + g * 0.37) + g * 2.1)) ** 2;
          set(r['tw' + g], 'opacity', o.toFixed(2), 'tw' + g);
        }
        for (let k = 0; k < 2; k++) {
          const Pd = k ? 23.3 : 14.1, dur = 1.3, ph = wrap(t + k * 5.7, Pd);
          const el = r['shoot' + k];
          if (reduced || ph > dur || sa < 0.5) { set(el, 'opacity', '0', 'sh' + k); continue; }
          const n = Math.floor((t + k * 5.7) / Pd), u = ph / dur;
          const x0 = 300 + wrap(n * 523 + k * 311, 1000), y0 = 40 + wrap(n * 97, 120), ang = 152 + (n % 3) * 6;
          const x = x0 + Math.cos(ang * D2R) * 200 * u, y = y0 + Math.sin(ang * D2R) * 200 * u;
          el.setAttribute('transform', `translate(${f(x)} ${f(y)}) rotate(${ang}) scale(${f(0.6 + 0.5 * Math.sin(Math.PI * u))} 1)`);
          el.setAttribute('opacity', Math.sin(Math.PI * u).toFixed(2)); st['sh' + k] = '';
        }
      }
      // clouds: slow parallax + a slow breeze. (journey) every pass of a cloud is a new cloud: its wrap cycle seeds a
      // height and whether it is there at all, so the sky never repeats (the hero cycle keeps its composed layout)
      const off = D * CLOUD_K + t * CLOUD_V;
      for (let i = 0; i < clouds.length; i++) {
        const [el, ax] = clouds[i], u = ax - off + 700, dx = wrap(u, CLOUD_W) - 700 - ax;
        const cyc = Math.floor(u / CLOUD_W), cyc0 = Math.floor((ax - OFF0 + 700) / CLOUD_W);
        let dy = 0, on = true;
        if (cyc !== cyc0) { dy = (hash(cyc, i * 3 + 1) - 0.5) * 60; on = hash(cyc, i * 3 + 3) > 0.25; }
        const vis = on ? 'visible' : 'hidden';
        if (el.__vis !== vis) { el.__vis = vis; el.setAttribute('visibility', vis); }
        el.setAttribute('transform', `translate(${f(dx)} ${f(dy)})`);
      }
      // (journey) flyovers are scheduled, not looped: each wrap cycle is seeded on/off (the hero cycle always shows), so
      // the toys come by once every few minutes with gaps, and rarely together
      const su = 240 + 200 + t * 6 - D * 0.012, sx = wrap(su, SHIP_SPAN) - 200;
      const su0 = 440 + T_HERO * 6 - D_HERO * 0.012, sc2 = flyOn(r.shipG, su, su0, SHIP_SPAN, 91, 0.4);
      const sdy = sc2 === Math.floor(su0 / SHIP_SPAN) ? 0 : (hash(sc2, 92) - 0.5) * 60;
      r.shipG.setAttribute('transform', `translate(${f(sx)} ${f(292 + sdy + 3 * Math.sin(t * 0.4))})`);
      // balloon: drifts slowly +x, rises and sinks on a long swell
      const bu = 640 + 300 + t * 4 - D * 0.01, bx = wrap(bu, BALLOON_SPAN) - 300;
      const bc = flyOn(r.balloonG, bu, 940 + T_HERO * 4 - D_HERO * 0.01, BALLOON_SPAN, 95, 0.45);
      const bdy = bc === Math.floor((940 + T_HERO * 4 - D_HERO * 0.01) / BALLOON_SPAN) ? 0 : (hash(bc, 96) - 0.5) * 80;
      r.balloonG.setAttribute('transform', `translate(${f(bx)} ${f(96 + bdy + 7 * Math.sin(t * 0.21))})`);
      // skein of far birds (drifting -x)
      const ku = 370 + 300 - t * 8 - D * 0.015, kx = wrap(ku, SKEIN_SPAN) - 300;
      flyOn(r.skein, ku, 670 - T_HERO * 8 - D_HERO * 0.015, SKEIN_SPAN, 93, 0.55);
      r.skein.setAttribute('transform', `translate(${f(kx)} ${f(176 + 4 * Math.sin(t * 0.3))})`);
      // gulls: slow, a lazy flap
      const gu = 560 + 300 + t * 10 - D * 0.02, gx = wrap(gu, GULL_SPAN) - 300;
      flyOn(r.gullsG, gu, 860 + T_HERO * 10 - D_HERO * 0.02, GULL_SPAN, 97, 0.7);
      r.gullsG.setAttribute('transform', `translate(${f(gx)} ${f(150 + 5 * Math.sin(t * 0.35))})`);
      for (let i = 0; i < gulls.length; i++) {
        const fr2 = wrap(t * 1.3 + i * 0.29, 1) < 0.5 ? 0 : 1;
        if (st.gflap[i] !== fr2) { st.gflap[i] = fr2; gulls[i].setAttribute('href', '#sky-gull' + fr2); }
      }
      // pelican V: flies +x, slower than the rider (net drift -x)
      const fu = 1175 + 400 + t * 20 - D * 0.02, fx = wrap(fu, FLOCK_SPAN) - 400, fc = Math.floor(fu / FLOCK_SPAN), fc0 = Math.floor((1175 + 400 + T_HERO * 20 - D_HERO * 0.02) / FLOCK_SPAN);
      const fdy = fc === fc0 ? 0 : (hash(fc, 71) - 0.5) * 120;
      r.flockG.setAttribute('transform', `translate(${f(fx)} ${f(330 + fdy + 5 * Math.sin(t * 0.5))})`);
      for (let i = 0; i < birds.length; i++) {
        const ph = wrap(t * 2.2 + i * 0.37, 1); const fr3 = ph < 0.33 ? 0 : ph < 0.55 ? 1 : ph < 0.85 ? 2 : 1;
        if (st.flap[i] !== fr3) { st.flap[i] = fr3; birds[i].setAttribute('href', '#sky-bird' + fr3); }
      }
      // biplane loop (+x, screen speed PLANE_V) with a gentle bob; banner flutter = a slow travelling skew wave
      const pu = 1290 + 700 + t * PLANE_V, px = wrap(pu, PLANE_SPAN) - 700;
      flyOn(r.plane, pu, 1990 + T_HERO * PLANE_V, PLANE_SPAN, 94, 0.38);
      if (r.plane.__vis === 'hidden') return;   // last block: nothing else to update this frame
      const py = 78 + 5 * Math.sin(t * 0.5), pr = 1.2 * Math.cos(t * 0.5);
      r.plane.setAttribute('transform', `translate(${f(px)} ${f(py)}) rotate(${f(pr)})`);
      let yy = 0; const amp = reduced ? 0.3 : 1;
      for (let i = 0; i < pan.length; i++) {
        const th = amp * (1.2 + 1.5 * i) * Math.sin(t * 4.6 - i * 0.95) * D2R, tn = Math.tan(th);
        const pxv = -i * 46;                                // panel front edge (banner-local)
        const m = `matrix(1 ${tn.toFixed(4)} 0 1 0 ${(yy - pxv * tn).toFixed(2)})`;
        pan[i].setAttribute('transform', m); if (pant[i]) pant[i].setAttribute('transform', m);
        yy -= 46 * tn;                                      // offset at this panel's tail edge
      }
    },
  };
}
