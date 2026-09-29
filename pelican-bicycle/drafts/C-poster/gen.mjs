// Pelican Bay, style C: retro travel poster (WPA / art-deco screenprint).
// node gen.mjs  -> keyframe.svg + closeup.svg (same folder)
// Seven flat inks only; tones come from halftone dots, never gradients. No filters, no fonts
// (lettering is hand-built stroke capitals + glyph outlines converted to paths by ttf.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFont } from './ttf.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- inks (the whole poster uses only these)
const I = {
  P: '#F4E7CD', // paper cream: plumage, sun, sails, lettering
  K: '#F2AE86', // peach: low sky, bill, bare face skin, road
  O: '#EB8A33', // amber: legs, feet, pouch, rays, basket
  R: '#D4513A', // vermilion: mid sky, scarf, bill nail, lighthouse bands, title inline
  B: '#56679E', // periwinkle: upper sky, far sea, plumage shade + key line
  T: '#1D8882', // teal: bicycle frame, palms, dune grass
  N: '#1A1F35', // navy ink: flight feathers, tyres, key darks, title shadow
};
const KEY = I.B;          // key-line ink on the pelican
const KW = 2.2;           // key-line width

// ---------------------------------------------------------------- helpers
const D2R = Math.PI / 180;
const f = v => (Math.round(v * 100) / 100).toString();
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const rot = ([x, y], a) => { const c = Math.cos(a * D2R), s = Math.sin(a * D2R); return [x * c - y * s, x * s + y * c]; };
const lerp = (a, b, t) => a + (b - a) * t;
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const P = pts => pts.map((p, i) => (i ? 'L' : 'M') + f(p[0]) + ' ' + f(p[1])).join('') + 'Z';
function smooth(pts, closed = true, k = 1 / 6) {
  const n = pts.length; const g = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2 = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + (closed ? 'Z' : '');
}
const circ = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const J = (name, x, y, r, inner) => `<g id="j-${name}" transform="translate(${f(x)} ${f(y)})${r ? ` rotate(${f(r)})` : ''}">${inner}</g>`;
const key = (d, w = KW, c = KEY) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
// Halftone strip as round-capped zero-length strokes, radii quantised into bins (compact markup).
// dots in [x0,x1] x [y0,y1] on a hex grid of pitch s; radius eased r0 (top) -> r1 (bottom)
function dots(x0, x1, y0, y1, r0, r1, s, color, opts = {}) {
  const { seed = 1, jitter = 0, clip, ease = t => t } = opts; const R = rng(seed);
  const bins = new Map(); const rows = Math.ceil((y1 - y0) / (s * 0.866));
  for (let j = 0; j <= rows; j++) {
    const y = y0 + j * s * 0.866; if (y > y1 + .01) break;
    const r = lerp(r0, r1, ease((y - y0) / (y1 - y0 || 1)));
    if (r < 0.3) continue;
    const q = Math.round(r * 4) / 4;
    for (let x = x0 + (j % 2 ? s / 2 : 0); x <= x1; x += s) {
      const xx = x + (R() - .5) * jitter; if (clip && !clip(xx, y)) continue;
      if (!bins.has(q)) bins.set(q, []);
      bins.get(q).push(`M${Math.round(xx * 10) / 10} ${Math.round(y * 10) / 10}h0`);
    }
  }
  return [...bins].map(([q, a]) => `<path d="${a.join('')}" stroke="${color}" stroke-width="${f(q * 2)}" stroke-linecap="round" fill="none"/>`).join('');
}

// ---------------------------------------------------------------- pose (phi = 0 = the spec's rest pose)
function ik2(H, A, L1, L2, bend) {
  const dx = A[0] - H[0], dy = A[1] - H[1]; let d = Math.hypot(dx, dy);
  d = Math.min(Math.max(d, Math.abs(L1 - L2) + 1), 0.999 * (L1 + L2));
  const base = Math.atan2(dy, dx), c = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
  const a1 = base + bend * Math.acos(Math.max(-1, Math.min(1, c)));
  const K = [H[0] + L1 * Math.cos(a1), H[1] + L1 * Math.sin(a1)];
  return { a1: a1 / D2R, a2: Math.atan2(A[1] - K[1], A[0] - K[0]) / D2R, K };
}
const phi = 0;
const BB = [0, -80];
const alpha = p => 8 + 10 * Math.cos(p - 135 * D2R);
const pedN = [BB[0] + 50 * Math.cos(phi), BB[1] + 50 * Math.sin(phi)];
const pedF = [BB[0] + 50 * Math.cos(phi + Math.PI), BB[1] + 50 * Math.sin(phi + Math.PI)];
const aN = alpha(phi), aF = alpha(phi + Math.PI);
const ankN = add(pedN, rot([-17, -9], aN)), ankF = add(pedF, rot([-17, -9], aF));
const pelvis = [-45, -300];
const hipN = add(pelvis, [8, 0]), hipF = add(pelvis, [4, -3]);
const legN = ik2(hipN, ankN, 142, 134, -1), legF = ik2(hipF, ankF, 142, 134, -1);
const shN = add(pelvis, [80, -78]), shF = add(pelvis, [75, -83]);
const gripN = [114, -275], gripF = [111, -277];
const wN = ik2(shN, gripN, 78, 74, 1), wF = ik2(shF, gripF, 78, 74, 1);
const HEAD = [125, -520];

// ---------------------------------------------------------------- defs: halftone patterns
function patt(id, color, r, s, ang = 45) {
  return `<pattern id="${id}" width="${s}" height="${s}" patternUnits="userSpaceOnUse" patternTransform="rotate(${ang})"><circle cx="${s / 2}" cy="${s / 2}" r="${r}" fill="${color}"/></pattern>`;
}
let defs = '';
defs += patt('htB', I.B, 1.2, 4.4);   // light shade on plumage
defs += patt('htB2', I.B, 1.7, 4.4);  // mid shade on plumage
defs += patt('htN', I.N, 1.5, 4.4);   // far-side darkening
defs += patt('htR', I.R, 1.15, 3.8);  // bill / pouch / basket shading
defs += patt('htO', I.O, 1.1, 4.2);   // breast buff
defs += patt('htP', I.P, 1.55, 6.5, 30); // tint for rays on the blue sky
defs += patt('htPs', I.P, 1.0, 4.4);  // highlight on dark
{ // paper speckle: sparse ink voids over the whole print
  const R = rng(77); let d = '';
  for (let i = 0; i < 26; i++) d += `M${f(R() * 197)} ${f(R() * 173)}h0`;
  defs += `<pattern id="speck" width="197" height="173" patternUnits="userSpaceOnUse"><path d="${d}" stroke="${I.P}" stroke-width="1.3" stroke-linecap="round"/></pattern>`;
}

// ================================================================ SKY
const SUN = [1214, 388], SUN_R = 80;
const bands = [[0, 324, 'B'], [324, 374, 'R'], [374, 424, 'O'], [424, 471, 'K']];
function skySet(map, seed) {
  let s = '';
  for (const [y0, y1, c] of bands) s += `<rect x="-20" y="${y0}" width="1640" height="${y1 - y0 + 1}" fill="${I[map(c)]}"/>`;
  for (let i = 0; i < bands.length - 1; i++) {
    const y = bands[i][1], up = map(bands[i][2]), lo = map(bands[i + 1][2]);
    if (up === lo) continue;
    s += dots(-10, 1610, y + 2, y + 26, 3.1, 0.3, 7.5, I[up], { seed: seed + i });
  }
  return s;
}
let sky = skySet(c => c, 3);
{ // sunburst: in alternate wedges each band is printed one ink lighter (a cream tint on the blue)
  const lighter = { B: 'B', R: 'O', O: 'K', K: 'P' };
  let wd = ''; const n = 40;
  for (let k = 0; k < n; k += 2) {
    const a0 = (k / n) * 360 + 3, w = 360 / n * 0.5;
    wd += P([SUN, add(SUN, rot([2600, 0], a0)), add(SUN, rot([2600, 0], a0 + w))]);
  }
  defs += `<clipPath id="rays"><path d="${wd}"/></clipPath>`;
  sky += `<g clip-path="url(#rays)">${skySet(c => lighter[c], 11)}<rect x="-20" y="0" width="1640" height="324" fill="url(#htP)"/></g>`;
}
let sun = `<circle cx="${SUN[0]}" cy="${SUN[1]}" r="${SUN_R + 16}" fill="none" stroke="${I.P}" stroke-width="3"/>`;
sun += `<circle cx="${SUN[0]}" cy="${SUN[1]}" r="${SUN_R}" fill="${I.P}"/>`;
const bar = (x0, x1, y, h, c) => `<rect x="${x0}" y="${f(y - h / 2)}" width="${x1 - x0}" height="${h}" rx="${h / 2}" fill="${I[c]}"/>`;
sun += bar(1070, 1330, 414, 8, 'K') + bar(1136, 1400, 430, 6, 'O') + bar(1030, 1260, 444, 5, 'K') + bar(1190, 1430, 456, 4, 'O');
sun += bar(1290, 1480, 346, 5, 'O') + bar(870, 1060, 382, 4, 'K') + bar(930, 1120, 396, 3, 'P');
// deco cumulus: stacked lobes, flat base, printed in two inks
function cloud(x, y, s, lit, shade, id) {
  const lobes = [[0, 0, 34], [38, -14, 42], [84, -4, 36], [118, 6, 26], [-34, 8, 24]];
  let top = ''; for (const [dx, dy, r] of lobes) top += circ(x + dx * s, y + dy * s, r * s);
  return `<clipPath id="${id}"><rect x="${f(x - 70 * s)}" y="${f(y - 70 * s)}" width="${f(240 * s)}" height="${f(98 * s)}"/></clipPath>` +
    `<g clip-path="url(#${id})"><path d="${top}" fill="${I[lit]}"/><rect x="${f(x - 70 * s)}" y="${f(y + 10 * s)}" width="${f(240 * s)}" height="${f(20 * s)}" fill="${I[shade]}"/></g>` +
    `<rect x="${f(x - 52 * s)}" y="${f(y + 33 * s)}" width="${f(196 * s)}" height="${f(4 * s)}" rx="${f(2 * s)}" fill="${I[lit]}"/>`;
}
let clouds = cloud(470, 262, 0.62, 'K', 'O', 'cl1') + cloud(1030, 226, 0.5, 'K', 'O', 'cl2');

// ================================================================ FAR HEADLAND + LIGHTHOUSE (left)
let hills = '';
hills += `<path fill="${I.B}" d="${smooth([[-40, 472], [-30, 392], [40, 372], [118, 358], [176, 352], [232, 360], [262, 380], [300, 404], [352, 428], [430, 447], [520, 460], [640, 470], [640, 472]], false)}L-40 472Z"/>`;
hills += `<path fill="none" stroke="${I.P}" stroke-width="2" d="M258 382 L296 408 M276 400 L330 426 M300 418 L372 440 M330 432 L420 452"/>`;
hills += `<path fill="${I.T}" d="${smooth([[-40, 472], [-20, 430], [60, 418], [140, 426], [210, 446], [300, 462], [380, 471]], false)}L-40 472Z"/>`;
hills += dots(-20, 380, 440, 470, 0.3, 1.8, 5, I.N, { seed: 8, clip: (x, y) => y > 430 + (x - 140) * (x - 140) / 4000 + 8 });
{
  const x = 176, yb = 356, h = 92, wb = 13, wt = 8.5;
  const tw = y => lerp(wb, wt, (yb - y) / h);
  let L = `<path fill="${I.P}" d="${P([[x - wb, yb], [x - wt, yb - h], [x + wt, yb - h], [x + wb, yb]])}"/>`;
  for (const [y0, y1] of [[yb - 22, yb - 36], [yb - 52, yb - 66]]) L += `<path fill="${I.R}" d="${P([[x - tw(y0), y0], [x - tw(y1), y1], [x + tw(y1), y1], [x + tw(y0), y0]])}"/>`;
  L += `<rect x="${x - 12}" y="${yb - h - 4}" width="24" height="5" fill="${I.N}"/>`;
  L += `<rect x="${x - 7}" y="${yb - h - 17}" width="14" height="13" fill="${I.K}"/><path d="M${x - 7} ${yb - h - 17}h14v13h-14z M${x} ${yb - h - 17}v13" fill="none" stroke="${I.N}" stroke-width="1.6"/>`;
  L += `<path fill="${I.N}" d="M${x - 9} ${yb - h - 17} Q${x} ${yb - h - 31} ${x + 9} ${yb - h - 17}Z M${x - 1} ${yb - h - 29}h2v-6h-2z"/>`;
  L += `<clipPath id="lhb"><path d="M${x + 7} ${yb - h - 12} L${x + 84} ${yb - h - 26} L${x + 84} ${yb - h}Z M${x - 7} ${yb - h - 12} L${x - 76} ${yb - h - 26} L${x - 76} ${yb - h}Z"/></clipPath><rect clip-path="url(#lhb)" x="${x - 90}" y="${yb - h - 30}" width="190" height="34" fill="url(#htPs)"/>`;
  L += `<path fill="${I.P}" d="M${x + 16} ${yb + 2}h30v-14h-30z"/><path fill="${I.R}" d="M${x + 13} ${yb - 12}l18 -11l18 11z"/><rect x="${x + 24}" y="${yb - 8}" width="5" height="6" fill="${I.N}"/>`;
  hills += L;
}

// ================================================================ SEA
let sea = '';
sea += `<rect x="-20" y="470" width="1640" height="190" fill="${I.N}"/>`;
sea += `<rect x="-20" y="470" width="1640" height="72" fill="${I.B}"/>`;
sea += dots(-10, 1610, 543, 596, 3.3, 0.3, 7.5, I.B, { seed: 21 });
sea += `<rect x="-20" y="469" width="1640" height="2.5" fill="${I.N}"/>`;
{ // stylised wave ticks
  const R = rng(5); let dP = '', dB = '';
  for (let y = 482; y < 650; y += 7 + (y - 470) * 0.07) {
    const t = (y - 470) / 180, len = 8 + t * 20, gap = 26 + t * 44;
    for (let x = -20 + R() * gap; x < 1620; x += gap * (0.6 + R() * 0.8)) {
      if (Math.abs(x - SUN[0]) < 130 - t * 20 && y < 625) continue;
      const h = 1.2 + t * 2.4;
      const arc = `M${f(x)} ${f(y)}q${f(len / 2)} ${f(-h * 1.6)} ${f(len)} 0q${f(-len / 2)} ${f(-h * 0.5)} ${f(-len)} 0Z`;
      if (y < 540) dP += arc; else dB += arc;
    }
  }
  sea += `<path fill="${I.K}" d="${dP}"/><path fill="${I.B}" d="${dB}"/>`;
}
{ // sun glitter path
  const R = rng(9); let d1 = '', d2 = '';
  for (let y = 474, i = 0; y < 636; i++) {
    const t = (y - 470) / 170, h = 2.2 + t * 5, w = 140 - t * 30 + R() * 40;
    const cx = SUN[0] + (R() - .5) * 30, segs = 1 + Math.floor(R() * 3);
    let x = cx - w / 2;
    for (let s = 0; s < segs; s++) { const sw = w / segs - 6 - R() * 10; const r = `M${f(x)} ${f(y)}h${f(sw)}a${f(h / 2)} ${f(h / 2)} 0 0 1 0 ${f(h)}h${f(-sw)}a${f(h / 2)} ${f(h / 2)} 0 0 1 0 ${f(-h)}Z`; (i % 3 === 1 ? d2 += r : d1 += r); x += w / segs; }
    y += h + 3 + t * 6;
  }
  sea += `<path fill="${I.P}" d="${d1}"/><path fill="${I.O}" d="${d2}"/>`;
}
function sailboat(x, y, s, far) {
  let b = '';
  b += `<path fill="${I.N}" d="M${f(x - 44 * s)} ${f(y - 8 * s)} L${f(x + 50 * s)} ${f(y - 8 * s)} L${f(x + 38 * s)} ${f(y + 4 * s)} L${f(x - 34 * s)} ${f(y + 4 * s)}Z"/>`;
  b += `<rect x="${f(x - 1.4 * s)}" y="${f(y - 118 * s)}" width="${f(2.8 * s)}" height="${f(112 * s)}" fill="${I.N}"/>`;
  b += `<path fill="${I.P}" d="M${f(x - 3 * s)} ${f(y - 114 * s)} Q${f(x - 30 * s)} ${f(y - 60 * s)} ${f(x - 40 * s)} ${f(y - 14 * s)} L${f(x - 3 * s)} ${f(y - 14 * s)}Z"/>`;
  if (!far) b += `<path fill="${I.R}" d="M${f(x - 3 * s)} ${f(y - 64 * s)} L${f(x - 26 * s)} ${f(y - 64 * s)} Q${f(x - 30 * s)} ${f(y - 54 * s)} ${f(x - 32 * s)} ${f(y - 46 * s)} L${f(x - 3 * s)} ${f(y - 46 * s)}Z"/>`;
  b += `<path fill="${far ? I.P : I.B}" d="M${f(x + 3 * s)} ${f(y - 104 * s)} L${f(x + 44 * s)} ${f(y - 14 * s)} L${f(x + 3 * s)} ${f(y - 14 * s)}Z"/>`;
  b += `<path fill="${I.R}" d="M${f(x - 1 * s)} ${f(y - 124 * s)} l${f(14 * s)} ${f(4 * s)} l${f(-14 * s)} ${f(4 * s)}Z"/>`;
  if (!far) b += `<path fill="${I.P}" d="M${f(x - 50 * s)} ${f(y + 7 * s)}h${f(106 * s)}v${f(2.5 * s)}h${f(-106 * s)}z M${f(x - 36 * s)} ${f(y + 13 * s)}h${f(70 * s)}v${f(2 * s)}h${f(-70 * s)}z"/>`;
  return b;
}
let boats = sailboat(1062, 548, 0.9, false) + sailboat(1486, 492, 0.3, true) + sailboat(392, 494, 0.3, true);
const gull = (x, y, s, c) => `<path fill="${I[c]}" d="M${f(x - 14 * s)} ${f(y - 3 * s)} Q${f(x - 7 * s)} ${f(y - 9 * s)} ${x} ${y} Q${f(x + 7 * s)} ${f(y - 9 * s)} ${f(x + 14 * s)} ${f(y - 3 * s)} Q${f(x + 7 * s)} ${f(y - 5 * s)} ${x} ${f(y + 3 * s)} Q${f(x - 7 * s)} ${f(y - 5 * s)} ${f(x - 14 * s)} ${f(y - 3 * s)}Z"/>`;
let gulls = gull(1130, 292, 1.5, 'N') + gull(1172, 270, 1.1, 'N') + gull(1090, 262, 0.9, 'N') + gull(330, 318, 0.8, 'N') + gull(360, 300, 0.6, 'N');

// ================================================================ SHORE: sand, beach cabanas, parasols
let shore = '';
shore += `<rect x="-20" y="640" width="1640" height="80" fill="${I.P}"/>`;
shore += dots(-10, 1610, 654, 704, 0.4, 2.6, 6.5, I.K, { seed: 31 });
{
  let d = 'M-20 640'; for (let x = -20; x <= 1620; x += 40) d += `q10 6 20 0q10 -6 20 0`; d += 'V652H-20Z';
  shore += `<path fill="${I.P}" d="${d}"/>`;
  let d2 = ''; for (let x = -20; x <= 1620; x += 40) d2 += `M${x} 646q10 6 20 0q10 -6 20 0`;
  shore += `<path fill="none" stroke="${I.B}" stroke-width="1.6" d="${d2}"/>`;
}
function cabana(x, y, w, h) {
  let c = ''; const stripes = 5, sw = w / stripes;
  for (let i = 0; i < stripes; i++) c += `<rect x="${f(x + i * sw)}" y="${y - h}" width="${f(sw + .3)}" height="${h}" fill="${I[i % 2 ? 'P' : 'R']}"/>`;
  c += `<path fill="${I.N}" d="M${x - 5} ${y - h} L${x + w / 2} ${y - h - 16} L${x + w + 5} ${y - h}Z"/>`;
  c += `<path fill="${I.N}" d="M${x - 4} ${y - h}h${w + 8}v3h${-w - 8}z"/><path fill="${I.N}" d="M${x + w / 2 - 5} ${y}v-17a5 5 0 0 1 10 0v17z"/>`;
  return c;
}
function parasol(x, y, s) {
  let c = `<rect x="${x - 1}" y="${f(y - 44 * s)}" width="2" height="${f(44 * s)}" fill="${I.N}"/>`;
  for (let i = 0; i < 6; i++) {
    const a0 = 180 + i * 30, a1 = a0 + 30, cc = [x, y - 40 * s];
    const p0 = add(cc, rot([30 * s, 0], a0)), p1 = add(cc, rot([30 * s, 0], a1));
    c += `<path fill="${I[i % 2 ? 'P' : 'O']}" d="M${f(cc[0])} ${f(cc[1])}L${f(p0[0])} ${f(p0[1])}Q${f((p0[0] + p1[0]) / 2)} ${f((p0[1] + p1[1]) / 2 + 5 * s)} ${f(p1[0])} ${f(p1[1])}Z"/>`;
  }
  return c;
}
shore += cabana(212, 700, 34, 30) + cabana(262, 700, 34, 30) + parasol(355, 696, 0.8) + cabana(1135, 700, 34, 30) + parasol(1216, 698, 0.8) + cabana(1270, 700, 34, 30);

// ================================================================ ROADSIDE: sea wall, lamp posts, palms
let roadside = '';
roadside += `<rect x="-20" y="708" width="1640" height="46" fill="${I.B}"/>`;
roadside += dots(-10, 1610, 728, 754, 0.3, 2.2, 5.5, I.N, { seed: 41 });
roadside += `<rect x="-20" y="700" width="1640" height="10" fill="${I.P}"/><rect x="-20" y="710" width="1640" height="3" fill="${I.N}"/>`;
{ let d = ''; for (let x = -20; x < 1620; x += 96) d += `M${x} 713v41`; roadside += `<path stroke="${I.N}" stroke-width="1.5" d="${d}"/>`; }
function lamp(x) {
  let l = '';
  l += `<path fill="${I.N}" d="M${x - 11} 704h22l-4 -14h-14z"/><rect x="${x - 3}" y="486" width="6" height="206" fill="${I.N}"/>`;
  l += `<rect x="${x - 6}" y="600" width="12" height="4" fill="${I.N}"/><rect x="${x - 5}" y="560" width="10" height="3" fill="${I.N}"/>`;
  l += `<path fill="none" stroke="${I.N}" stroke-width="3" d="M${x} 498q0 -26 26 -26q14 0 14 12"/>`;
  l += `<path fill="${I.N}" d="M${x + 30} 486h20l-4 -8h-12z"/><path fill="${I.P}" d="M${x + 32} 486h16l-3 14h-10z"/><circle cx="${x}" cy="486" r="4" fill="${I.N}"/>`;
  return l;
}
roadside += lamp(318) + lamp(1166);
// deco palm: tapered ringed trunk, arched crescent fronds with notched lower edges
function palm(x0, y0, x1, y1, s, bend = 60) {
  const c = [(x0 + x1) / 2 + bend * s, (y0 + y1) / 2];
  const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push([(1 - t) ** 2 * x0 + 2 * t * (1 - t) * c[0] + t * t * x1, (1 - t) ** 2 * y0 + 2 * t * (1 - t) * c[1] + t * t * y1]); }
  const left = [], right = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    const w = lerp(14, 8, i / 24) * s; left.push([pts[i][0] - dy / L * w, pts[i][1] + dx / L * w]); right.push([pts[i][0] + dy / L * w, pts[i][1] - dx / L * w]);
  }
  let p = `<path fill="${I.N}" d="${P([...left, ...right.slice().reverse()])}"/>`;
  let rings = ''; for (let i = 1; i < 24; i++) { const a = left[i], b = right[i]; const m = [lerp(a[0], b[0], .5), lerp(a[1], b[1], .5) + 3 * s]; rings += `M${f(a[0])} ${f(a[1])}Q${f(m[0])} ${f(m[1])} ${f(b[0])} ${f(b[1])}`; }
  p += `<path fill="none" stroke="${I.T}" stroke-width="${f(2 * s)}" d="${rings}"/>`;
  // fronds: [angle of departure, length, droop]
  const fronds = [[-178, 150, .55], [-150, 165, .42], [-118, 120, .25], [-72, 120, .25], [-35, 160, .42], [-6, 150, .6], [160, 110, .5], [25, 105, .55]];
  let dN = '', dT = '';
  fronds.forEach(([a, L, droop], k) => {
    const len = L * s, dir = rot([1, 0], a);
    const tip = add([x1, y1], [dir[0] * len, dir[1] * len + len * droop]);
    const ctrl = add([x1, y1], [dir[0] * len * 0.55, dir[1] * len * 0.55 - len * 0.18]);
    const Q = t => [(1 - t) ** 2 * x1 + 2 * t * (1 - t) * ctrl[0] + t * t * tip[0], (1 - t) ** 2 * y1 + 2 * t * (1 - t) * ctrl[1] + t * t * tip[1]];
    const up = [], dn = []; const n = 16;
    for (let i = 0; i <= n; i++) {
      const t = i / n, q = Q(t), q2 = Q(Math.min(1, t + .02)), q1 = Q(Math.max(0, t - .02));
      const tx = q2[0] - q1[0], ty = q2[1] - q1[1], tl = Math.hypot(tx, ty) || 1; let nx = -ty / tl, ny = tx / tl; if (ny < 0) { nx = -nx; ny = -ny; }
      const w = 16 * s * Math.sin(Math.PI * Math.min(1, t * 1.05)) ** 0.8;
      up.push([q[0] - nx * w * 0.35, q[1] - ny * w * 0.35]);
      const notch = i % 2 ? 0.45 : 1.15; dn.push([q[0] + nx * w * notch + tx / tl * (i % 2 ? 0 : 6 * s), q[1] + ny * w * notch + ty / tl * (i % 2 ? 0 : 6 * s)]);
    }
    const d = P([...up, ...dn.reverse()]);
    (k % 3 === 1 ? dT += d : dN += d);
  });
  p += `<path fill="${I.T}" d="${dT}"/><path fill="${I.N}" d="${dN}"/>`;
  p += `<path fill="${I.O}" d="${circ(x1 - 6 * s, y1 + 8 * s, 6 * s)}${circ(x1 + 6 * s, y1 + 10 * s, 6 * s)}${circ(x1, y1 + 16 * s, 5.5 * s)}"/>`;
  return p;
}
roadside += palm(1452, 706, 1402, 330, 0.8, 30) + palm(1544, 712, 1478, 118, 1.15, 70);

// ================================================================ ROAD
let road = '';
road += `<rect x="-20" y="754" width="1640" height="96" fill="${I.K}"/>`;
road += dots(-10, 1610, 762, 848, 0.3, 2.7, 6, I.O, { seed: 51 });
road += `<rect x="-20" y="752" width="1640" height="4" fill="${I.P}"/>`;
{ let d = ''; for (let x = -60; x < 1640; x += 157.08) d += `M${f(x)} 812h78v6h-78z`; road += `<path fill="${I.P}" d="${d}"/>`; }
road += `<rect x="-20" y="846" width="1640" height="6" fill="${I.P}"/><rect x="-20" y="852" width="1640" height="3" fill="${I.N}"/>`;
// shadow of bike + rider (sun ahead-right, shadow thrown back-left), solid periwinkle ink
let shadow = `<g transform="translate(680 790)"><path fill="${I.B}" d="M-262 4 C-210 -5 -40 -7 60 -5 C140 -4 250 -3 290 1 C250 8 120 11 20 10 C-80 10 -210 10 -262 4Z"/>` +
  dots(-300, 290, 12, 22, 2.1, 0.3, 6, I.B, { seed: 61 }) + `</g>`;

// ================================================================ FOREGROUND: coastal shrubs, dune-grass fans, poppies
let fg = '';
fg += `<rect x="-20" y="856" width="1640" height="60" fill="${I.N}"/>`;
{
  const R = rng(123);
  // rounded shrub mounds (teal, shaded underside), low in the middle so the wheels stay clear
  let dT = '', dN = '';
  const shrubs = [];
  for (let x = -30; x < 1660; x += 70 + R() * 50) {
    const mid = x > 400 && x < 1000; const h = mid ? 16 + R() * 10 : 30 + R() * 26; const w = 60 + R() * 50;
    shrubs.push([x, h, w]);
  }
  for (const [x, h, w] of shrubs) {
    const lobes = 3 + Math.floor(R() * 2); let d = '';
    for (let i = 0; i < lobes; i++) { const u = (i + .5) / lobes; const lx = x - w / 2 + u * w, lr = w / lobes * 0.75, ly = 872 - h * (1 - Math.abs(u - .5) * 1.1) + lr * .6; d += circ(lx, ly, lr); }
    d += `M${f(x - w / 2)} 900V872H${f(x + w / 2)}V900Z`;
    dT += d;
  }
  fg += `<path fill="${I.T}" d="${dT}"/>`;
  fg += dots(-10, 1610, 850, 890, 0.3, 2.2, 5, I.N, { seed: 71 });
  // dune-grass fans framing the corners, short tufts elsewhere
  const fan = (cx, base, H, n, spread, c) => {
    let d = '';
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1) - 0.5, h = H * (0.7 + R() * 0.35) * (1 - Math.abs(u) * 0.6);
      const ang = u * spread, tip = [cx + Math.sin(ang * D2R) * h, base - Math.cos(ang * D2R) * h], w = 3.4;
      const bend = u * 18 + 6;
      d += `M${f(cx - w)} ${base}Q${f((cx + tip[0]) / 2 + bend)} ${f((base + tip[1]) / 2)} ${f(tip[0] + bend * .6)} ${f(tip[1])}Q${f((cx + tip[0]) / 2 + bend + w)} ${f((base + tip[1]) / 2 + 4)} ${f(cx + w)} ${base}Z`;
    }
    return `<path fill="${c}" d="${d}"/>`;
  };
  fg += fan(60, 892, 96, 9, 70, I.T) + fan(96, 892, 70, 7, 60, I.N) + fan(1540, 892, 100, 9, 70, I.T) + fan(1500, 892, 72, 7, 60, I.N);
  fg += fan(300, 890, 50, 6, 60, I.N) + fan(1210, 890, 54, 6, 60, I.N) + fan(1330, 892, 44, 5, 50, I.T) + fan(380, 892, 40, 5, 50, I.T);
  // poppies (vermilion + amber), stems in navy
  let fl = '';
  for (const [x, y, s, c] of [[132, 836, 1.1, 'R'], [168, 850, .8, 'O'], [352, 848, .9, 'R'], [1160, 846, 1, 'O'], [1250, 852, .8, 'R'], [1452, 838, 1.1, 'R'], [1418, 852, .75, 'O'], [620, 866, .6, 'R'], [900, 868, .6, 'O'], [1010, 862, .7, 'R']]) {
    fl += `<path stroke="${I.N}" stroke-width="2" fill="none" d="M${x} ${y + 44}q-4 -22 0 -44"/>`;
    fl += `<path fill="${I[c]}" d="M${x} ${f(y + 2 * s)}C${f(x - 16 * s)} ${f(y + 2 * s)} ${f(x - 16 * s)} ${f(y - 14 * s)} ${f(x - 8 * s)} ${f(y - 16 * s)}C${f(x - 4 * s)} ${f(y - 10 * s)} ${f(x - 2 * s)} ${f(y - 10 * s)} ${x} ${f(y - 16 * s)}C${f(x + 2 * s)} ${f(y - 10 * s)} ${f(x + 4 * s)} ${f(y - 10 * s)} ${f(x + 8 * s)} ${f(y - 16 * s)}C${f(x + 16 * s)} ${f(y - 14 * s)} ${f(x + 16 * s)} ${f(y + 2 * s)} ${x} ${f(y + 2 * s)}Z"/>`;
    fl += `<path fill="${I.N}" d="M${f(x - 3 * s)} ${f(y + 1 * s)}h${f(6 * s)}l${f(-3 * s)} ${f(-6 * s)}z"/>`;
  }
  fg += fl;
}
// streamline speed lines (fx), trailing the rider
let fx = '';
{
  const ln = (x0, x1, y, w, c) => `<path stroke="${I[c]}" stroke-width="${w}" stroke-linecap="round" d="M${x0} ${y}H${x1}"/>`;
  fx += ln(338, 432, 598, 3.4, 'P') + ln(300, 420, 612, 3.4, 'P') + ln(356, 436, 626, 3.4, 'P');
}

// ================================================================ BICYCLE (rider-local)
const RH = [-125, -100], FH = [173, -100];
const SC = [-60.5, -278], HT = [112, -245], HB = [125.6, -203.2];
function wheel() {
  let w = '';
  w += `<circle r="95.5" fill="none" stroke="${I.N}" stroke-width="9"/>`;
  w += `<circle r="91.3" fill="none" stroke="${I.O}" stroke-width="1.6"/>`;
  w += `<circle r="89.4" fill="none" stroke="${I.P}" stroke-width="3.2"/>`;
  w += `<circle r="87.3" fill="none" stroke="${I.N}" stroke-width="1"/>`;
  let d = '';
  for (let i = 0; i < 32; i++) {
    const ah = i * 11.25, dir = (i % 4 < 2) ? 1 : -1, ar = ah + dir * 67.5;
    const h = rot([11, 0], ah), r = rot([87.5, 0], ar);
    d += `M${f(h[0])} ${f(h[1])}L${f(r[0])} ${f(r[1])}`;
  }
  w += `<path stroke="${I.P}" stroke-width="1" d="${d}"/>`;
  w += `<circle r="13" fill="${I.P}"/><circle r="13" fill="none" stroke="${I.N}" stroke-width="1.4"/><circle r="6" fill="${I.N}"/><circle r="2.2" fill="${I.P}"/>`;
  w += `<rect x="-2" y="-88" width="4" height="8" fill="${I.N}"/>`;
  w += `<rect x="-5" y="40" width="10" height="7" rx="2" fill="${I.O}" transform="rotate(20)"/>`;
  return w;
}
const bike = {};
bike.wheelRear = wheel();
bike.wheelFront = wheel();
{ // frame (static, rider coords): fenders, tubes, saddle
  let F = '';
  const arcPath = (c, r, a0, a1) => { const p0 = add(c, rot([r, 0], a0)), p1 = add(c, rot([r, 0], a1)); return `M${f(p0[0])} ${f(p0[1])}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f(p1[0])} ${f(p1[1])}`; };
  const fender = (c, a0, a1) => `<path fill="none" stroke="${I.P}" stroke-width="8" stroke-linecap="round" d="${arcPath(c, 107.5, a0, a1)}"/><path fill="none" stroke="${I.R}" stroke-width="1.6" d="${arcPath(c, 106.5, a0 + 3, a1 - 3)}"/>`;
  const stay = (c, a) => { const p = add(c, rot([106, 0], a)); return `M${f(c[0])} ${f(c[1])}L${f(p[0])} ${f(p[1])}`; };
  F += `<path stroke="${I.N}" stroke-width="2" d="${stay(RH, 168)}${stay(RH, 205)}${stay(FH, 10)}${stay(FH, -20)}"/>`;
  F += fender(RH, 160, 300) + fender(FH, 195, 375);
  F += `<rect x="-238" y="-126" width="8" height="12" rx="2" fill="${I.R}" transform="rotate(-18 -234 -120)"/>`;
  const tube = (a, b, w, c = I.T) => `<path stroke="${c}" stroke-width="${w}" stroke-linecap="round" d="M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}"/>`;
  F += tube(RH, BB, 7) + tube([-44, -226], RH, 6.5);
  F += tube([-49, -241], SC, 6, I.P);
  F += tube(BB, [-49, -241], 10.5);
  F += tube([-44, -228], [114, -238], 9.5);
  F += tube(BB, [121, -214], 12);
  F += tube(HT, HB, 14);
  F += `<path stroke="${I.P}" stroke-width="1.4" fill="none" d="M8 -94 L112 -205 M-36 -226 L104 -236 M-6 -94 L-44 -218"/>`;
  F += `<path stroke="${I.P}" stroke-width="3" d="M${HT[0] - 1} ${HT[1] + 3}l14 -4.5 M${HB[0] - 5} ${HB[1] - 1}l14 -4.5"/>`;
  F += `<circle cx="-47" cy="-230" r="7" fill="${I.T}"/><circle cx="-47" cy="-230" r="3" fill="${I.P}"/><circle cx="0" cy="-80" r="13" fill="${I.T}"/>`;
  F += `<path fill="${I.P}" d="M118 -232l5 -8l5 8l-5 8z"/><path fill="${I.R}" d="M121 -232l2 -3l2 3l-2 3z"/>`;
  // sprung leather saddle
  F += `<path fill="none" stroke="${I.N}" stroke-width="1.8" d="M-88 -278c-5 3 5 5 0 8c-5 3 5 5 0 8M-72 -278c-5 3 5 5 0 8c-5 3 5 5 0 8"/>`;
  F += `<path stroke="${I.N}" stroke-width="2.5" d="M-95 -262L-60 -276L-30 -281"/>`;
  F += `<path fill="${I.N}" d="M-103 -287C-103 -294 -86 -296 -62 -291C-45 -288 -30 -287 -21 -285C-18 -284 -18 -281 -21 -280C-40 -278 -60 -278 -80 -276C-96 -275 -104 -279 -103 -287Z"/>`;
  F += `<path fill="none" stroke="${I.K}" stroke-width="1.3" d="M-98 -288C-86 -293 -66 -290 -40 -286"/><circle cx="-97" cy="-281" r="1.4" fill="${I.P}"/><circle cx="-90" cy="-280" r="1.4" fill="${I.P}"/>`;
  bike.frame = F;
}
bike.fork = `<path fill="none" stroke="${I.T}" stroke-width="8.5" stroke-linecap="round" d="M${HB[0]} ${HB[1]}C139 -158 152 -118 ${FH[0]} ${FH[1]}"/>` +
  `<path fill="none" stroke="${I.P}" stroke-width="1.3" d="M129 -196C141 -158 152 -122 168 -104"/><path fill="${I.P}" d="M120 -206h14v6h-14z" transform="rotate(18 127 -203)"/>`;
{ // bars: steerer, stem, swept-back bar, grip, bell, basket with fish, headlamp
  let Bh = '';
  Bh += `<path stroke="${I.N}" stroke-width="2.2" d="M152 -226L171 -104M206 -226L176 -104"/>`;
  Bh += `<path stroke="${I.P}" stroke-width="5" stroke-linecap="round" d="M106.4 -262.1L112 -245M106.4 -262.1L132 -269"/>`;
  Bh += `<path fill="none" stroke="${I.P}" stroke-width="4.5" stroke-linecap="round" d="M130 -269C146 -272 150 -282 138 -283L124 -278"/>`;
  Bh += `<path stroke="${I.N}" stroke-width="8.5" stroke-linecap="round" d="M126 -277.5L102 -273.5"/>`;
  Bh += `<path fill="${I.P}" d="M117 -284a7 7 0 0 1 14 0z"/><rect x="116" y="-284.5" width="16" height="2.4" fill="${I.N}"/><circle cx="124" cy="-292" r="1.6" fill="${I.N}"/><path stroke="${I.N}" stroke-width="1.5" d="M129 -283l5 -4"/>`;
  const bx0 = 140, bx1 = 222, by0 = -292, by1 = -226;
  const bpath = `M${bx0 - 3} ${by0}L${bx1 + 3} ${by0}L${bx1 - 3} ${by1}Q${(bx0 + bx1) / 2} ${by1 + 4} ${bx0 + 3} ${by1}Z`;
  // fish poking out (drawn first, basket in front)
  let fish = '';
  fish += `<g transform="translate(164 -302) rotate(-66)"><path fill="${I.B}" d="M-26 0C-12 -12 16 -12 30 -2C33 0 33 3 30 5C16 13 -12 12 -26 0Z"/><path fill="${I.P}" d="M-18 3C-4 10 16 10 28 4C16 8 -4 7 -18 3Z"/><path fill="none" stroke="${I.T}" stroke-width="2" d="M-8 -7Q2 -1 -6 7M4 -8Q12 0 5 8"/><circle cx="21" cy="-2" r="3.4" fill="${I.P}"/><circle cx="21.8" cy="-2.2" r="1.8" fill="${I.N}"/><path fill="${I.N}" d="M31 1l6 -3l-2 4l2 3z"/><path fill="${I.T}" d="M-4 -9l6 -6l6 5z"/></g>`;
  fish += `<g transform="translate(208 -302) rotate(-108)"><path fill="${I.P}" d="M-20 0C-8 -9 10 -8 18 -1C10 7 -8 8 -20 0Z"/><path fill="${I.B}" d="M17 -1L34 -13L29 -1L34 11Z"/><path fill="none" stroke="${I.B}" stroke-width="1.5" d="M-2 -6Q4 0 -2 6"/></g>`;
  fish += `<g transform="translate(188 -298) rotate(-22)"><path fill="${I.K}" d="M-16 0C-6 -9 9 -9 18 -1C9 6 -6 8 -16 0Z"/><path fill="${I.R}" d="M-16 0l-8 -6v12z"/><circle cx="10" cy="-1.5" r="2.2" fill="${I.N}"/></g>`;
  Bh += fish;
  Bh += `<path fill="${I.O}" d="${bpath}"/>`;
  let weave = ''; for (let y = by0 + 9; y < by1; y += 9) weave += `M${bx0} ${y}H${bx1}`;
  let v = ''; for (let x = bx0 + 4, i = 0; x < bx1; x += 7, i++) for (let r = 0; r < 4; r++) v += `M${x} ${by0 + r * 18 + (i % 2 ? 0 : 4.5)}v9`;
  Bh += `<clipPath id="bk"><path d="${bpath}"/></clipPath><g clip-path="url(#bk)"><path stroke="${I.R}" stroke-width="2.2" d="${weave}"/><path stroke="${I.K}" stroke-width="2.4" d="${v}"/><rect x="${bx0 - 4}" y="${by0}" width="26" height="80" fill="url(#htR)"/><rect x="${bx0}" y="${by1 - 14}" width="90" height="20" fill="url(#htR)"/></g>`;
  Bh += `<path fill="${I.N}" d="M${bx0 - 5} ${by0 - 3}H${bx1 + 5}V${by0 + 4}H${bx0 - 5}Z"/><path fill="none" stroke="${I.N}" stroke-width="2" d="${bpath}"/>`;
  Bh += `<path stroke="${I.N}" stroke-width="2.5" d="M132 -269L142 -262"/>`;
  Bh += `<path stroke="${I.N}" stroke-width="2.5" d="M126 -214L136 -218"/>`;
  Bh += `<path fill="${I.P}" d="M131 -226h12a8 8 0 0 1 0 16h-12a4 8 0 0 1 0 -16z"/><path fill="${I.N}" d="M143 -226v16h2v-16z"/><path fill="${I.K}" d="M145 -226a4 8 0 0 1 0 16z"/><path fill="none" stroke="${I.O}" stroke-width="1.2" d="M134 -222.5h9"/>`;
  bike.bars = Bh;
}
{ // drivetrain
  const teeth = (n, rt, rr) => { const pts = []; for (let i = 0; i < n; i++) { const a = i / n * 360; pts.push(rot([rr, 0], a - 360 / n * 0.35), rot([rt, 0], a - 360 / n * 0.15), rot([rt, 0], a + 360 / n * 0.15), rot([rr, 0], a + 360 / n * 0.35)); } return P(pts); };
  bike.cog = `<path fill="${I.P}" d="${teeth(16, 10.8, 8.3)}"/><circle r="5" fill="${I.N}"/>`;
  const CD = 'M-124.92,-109.57 L0.23,-108.55 A28.556,28.556 0 1 1 -8.69,-52.80 L-127.91,-90.88 A9.573,9.573 0 0 1 -124.92,-109.57 Z';
  bike.chain = `<path d="${CD}" fill="none" stroke="${I.N}" stroke-width="4.2" stroke-linejoin="round"/><path pathLength="100" d="${CD}" fill="none" stroke="${I.B}" stroke-width="2" stroke-dasharray="0.45 0.55"/>`;
  let ring = `<path fill="${I.P}" fill-rule="evenodd" d="${teeth(48, 30.2, 27.3)}${circ(0, 0, 21)}"/><circle r="28" fill="none" stroke="${I.N}" stroke-width=".8"/>`;
  let spider = ''; for (let k = 0; k < 5; k++) { const a = k * 72 - 90; const p = rot([22, 0], a), q1 = rot([6, -3.4], a), q2 = rot([6, 3.4], a); spider += `M${f(q1[0])} ${f(q1[1])}L${f(p[0])} ${f(p[1])}L${f(q2[0])} ${f(q2[1])}Z`; }
  ring += `<path fill="${I.P}" d="${spider}"/><circle r="9" fill="${I.P}"/>`;
  for (let k = 0; k < 5; k++) { const p = rot([21, 0], k * 72 - 90); ring += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="1.6" fill="${I.N}"/>`; }
  bike.chainring = ring;
  const crankArm = far => `<path fill="${far ? I.B : I.N}" d="M0 -6.5L50 -4A4 4 0 0 1 50 4L0 6.5A6.5 6.5 0 0 1 0 -6.5Z"/>` + (far ? '' : `<path stroke="${I.P}" stroke-width="1.3" d="M4 -3L46 -1.6"/><circle r="4.2" fill="${I.P}"/><circle r="1.8" fill="${I.N}"/>`) + `<circle cx="50" cy="0" r="3" fill="${far ? I.N : I.P}"/>`;
  bike.crankNear = crankArm(false);
  bike.crankFar = crankArm(true);
  const pedal = far => `<rect x="-13" y="-4" width="26" height="8" rx="2" fill="${far ? I.B : I.N}"/>` + (far ? '' : `<rect x="-11" y="-1.5" width="4" height="3" fill="${I.O}"/><rect x="7" y="-1.5" width="4" height="3" fill="${I.O}"/>`);
  bike.pedalNear = pedal(false);
  bike.pedalFar = pedal(true);
}

// ================================================================ PELICAN
const pel = {};
// ---- legs. thigh: feathered "trousers" for the first half, then bare orange tibia to the knee
function thigh(far) {
  const skin = far ? I.R : I.O, plume = far ? I.B : I.P;
  let t = '';
  t += `<path fill="${skin}" d="M40 -7.5L142 -5.5A5.5 5.5 0 0 1 142 5.5L40 7.5Z"/>`;
  if (!far) t += `<path fill="${I.R}" d="M40 3L142 2.2L142 5.5L40 7.5Z"/>`;
  else t += `<path fill="url(#htN)" d="M40 -7.5L142 -5.5L142 5.5L40 7.5Z"/>`;
  t += `<circle cx="142" cy="0" r="7.5" fill="${skin}"/>`;
  const o = smooth([[-18, -17], [14, -19], [44, -16], [62, -12], [74, -9], [68, -4], [78, 0], [66, 4], [72, 9], [56, 12], [48, 18], [30, 20], [0, 20], [-20, 6]]);
  t += `<path fill="${plume}" d="${o}"/>`;
  if (!far) {
    t += `<clipPath id="thc"><path d="${o}"/></clipPath><g clip-path="url(#thc)"><path fill="url(#htB2)" d="M-30 8C20 10 50 6 90 2L90 30L-30 30Z"/></g>`;
    t += key(`M74 -9L68 -4L78 0L66 4L72 9L56 12L48 18L30 20`, 2);
    t += `<path fill="none" stroke="${I.B}" stroke-width="1.5" d="M30 -2q8 5 15 3M50 -5q7 5 13 3"/>`;
  } else t += `<path fill="url(#htN)" d="${o}"/>`;
  return t;
}
function shank(far) {
  const c = far ? I.R : I.O;
  let s = `<path fill="${c}" d="M-4 -6.5L134 -4.5A4.5 4.5 0 0 1 134 4.5L-4 6.5A6.5 6.5 0 0 1 -4 -6.5Z"/>`;
  if (!far) {
    s += `<path fill="${I.R}" d="M0 2.4L134 1.8L134 4.5L0 6.4Z"/>`;
    let ticks = ''; for (let x = 16; x < 126; x += 9) ticks += `M${x} -4.6l2.4 2.6`;
    s += `<path stroke="${I.R}" stroke-width="1.1" d="${ticks}"/>`;
  } else s += `<path fill="url(#htN)" d="M-4 -6.5L134 -4.5L134 4.5L-4 6.5Z"/>`;
  s += `<circle cx="0" cy="0" r="7.5" fill="${c}"/>`;
  if (!far) s += `<path fill="none" stroke="${I.R}" stroke-width="1.2" d="M-3 -4a5 5 0 0 1 6 -1"/>`;
  return s;
}
function foot(far) {
  // ball on the pedal at (17,9); toes to x~50; heel -6. Webbing drapes over the pedal nose.
  const c = far ? I.R : I.O, web = far ? I.R : I.K, line = far ? I.N : I.R;
  let s = '';
  s += `<path fill="${web}" d="M4 3L51 5.5Q45 9 48 12.5Q40 12.5 42 17Q34 15 33 19L8 11Z"/>`;
  s += `<path fill="url(#htR)" d="M4 3L51 5.5Q45 9 48 12.5Q40 12.5 42 17Q34 15 33 19L8 11Z"/>`;
  s += `<path fill="${c}" d="M-7 1C-7 -6 2 -7.5 8 -4.5C20 -1 38 1.5 50 2.4C53 2.8 53 5.8 50 6L30 5.8C20 6 12 6.2 7 6.5L-5 7C-8 6.5 -8 3 -7 1Z"/>`;
  s += `<path fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round" d="M20 5.5L48 12.5M16 6.5L42 17M12 7L33 19"/>`;
  s += `<path fill="none" stroke="${line}" stroke-width="1" d="M22 3.4L48 4.2M8 -3q6 3 14 4"/>`;
  s += `<path fill="${I.N}" d="M50 2.6l4 1.6l-4 1.6zM48 11.3l3.6 2.4l-4 .6zM42 15.8l3 3l-4 -.4zM33 17.9l2.4 3l-3.6 -.8z"/>`;
  s += `<circle cx="0" cy="0" r="6.2" fill="${c}"/>`;
  return s;
}
pel.thighNear = thigh(false); pel.thighFar = thigh(true);
pel.shankNear = shank(false); pel.shankFar = shank(true);
pel.footNear = foot(false); pel.footFar = foot(true);

// ---- wings. upper: shoulder->elbow (+y trailing); lower: elbow->wrist; hand: wrist on the grip
function wingUpper(far) {
  const c = far ? I.B : I.P;
  // leading edge smooth, trailing edge a row of rounded covert tips
  const pts = [[-8, -19], [22, -19], [54, -14], [80, -10], [89, -2], [84, 8], [72, 12]];
  const tips = [[62, 17], [52, 16], [44, 22], [34, 20], [26, 26], [16, 23], [6, 27], [-6, 22], [-14, 14], [-18, 4]];
  const o = smooth([...pts, ...tips]);
  let s = '';
  if (!far) s += `<path fill="${I.B}" transform="translate(-3 5)" d="${o}"/>`; // cast shadow on the flank
  s += `<path fill="${c}" d="${o}"/>`;
  if (!far) {
    s += `<clipPath id="wuc"><path d="${o}"/></clipPath><g clip-path="url(#wuc)"><path fill="url(#htB)" d="M-30 12C20 9 60 7 100 5L100 50L-30 50Z"/>`;
    let sc = ''; for (const [x0, y0, n] of [[4, -5, 5], [10, 8, 4]]) for (let i = 0; i < n; i++) sc += `M${x0 + i * 14} ${y0}q7 7.5 14 0`;
    s += `<path fill="none" stroke="${I.B}" stroke-width="1.5" d="${sc}"/></g>`;
    s += key(o);
  } else s += `<path fill="url(#htN)" d="${o}"/>`;
  return s;
}
function wingLower(far) {
  const c = far ? I.B : I.P;
  let s = '';
  let sec = '', sheen = '';
  for (let i = 0; i < 7; i++) {
    const x = -2 + i * 11.5, L = 38 - i * 2.6;
    sec += `M${f(x - 2)} 2C${f(x - 5)} ${f(12 + L * .4)} ${f(x - 12)} ${f(L)} ${f(x - 16)} ${f(L + 5)}C${f(x - 6)} ${f(L + 3)} ${f(x + 7)} ${f(10 + L * .45)} ${f(x + 11)} 2Z`;
    sheen += `M${f(x + 3)} 8Q${f(x - 3)} ${f(L * .72)} ${f(x - 11)} ${f(L + 1)}`;
  }
  s += `<path fill="${I.N}" d="${sec}"/>`;
  if (!far) s += `<path fill="none" stroke="${I.B}" stroke-width="1.1" d="${sheen}"/>`;
  const o = smooth([[-10, -11], [30, -11], [62, -8], [80, -6], [85, 1], [78, 7], [58, 10], [30, 12], [-6, 13], [-15, 1]]);
  s += `<path fill="${c}" d="${o}"/>`;
  if (!far) {
    s += `<clipPath id="wlc"><path d="${o}"/></clipPath><g clip-path="url(#wlc)"><path fill="url(#htB)" d="M-20 4L90 2L90 20L-20 20Z"/></g>`;
    s += `<path fill="${I.P}" d="M-6 10q6 9 13 1q6 9 13 0q6 9 13 0q6 8 12 0q5 7 11 -1q5 6 10 -1L70 6L-6 7Z"/>`;
    s += key(`M-6 10q6 9 13 1q6 9 13 0q6 9 13 0q6 8 12 0q5 7 11 -1q5 6 10 -1`, 1.5);
    s += key(o);
  } else s += `<path fill="url(#htN)" d="${o}"/>`;
  return s;
}
function wingHand(far) {
  let s = '';
  const prim = [[20, 40, 10], [36, 36, 9], [52, 30, 8], [68, 22, 7]];
  let d = '';
  for (const [a, L, w] of prim) {
    const tip = rot([L, 0], a), b1 = rot([2, -w / 2], a), b2 = rot([2, w / 2], a), m1 = rot([L * 0.6, -w * 0.62], a), m2 = rot([L * 0.66, w * 0.58], a);
    d += `M${f(b1[0])} ${f(b1[1])}Q${f(m1[0])} ${f(m1[1])} ${f(tip[0])} ${f(tip[1])}Q${f(m2[0])} ${f(m2[1])} ${f(b2[0])} ${f(b2[1])}Z`;
  }
  s += `<path fill="${I.N}" d="${d}"/>`;
  if (!far) s += `<path fill="none" stroke="${I.B}" stroke-width="1.1" d="${prim.map(([a, L]) => { const p = rot([8, 0], a), q = rot([L * .8, 0], a); return `M${f(p[0])} ${f(p[1])}L${f(q[0])} ${f(q[1])}`; }).join('')}"/>`;
  const fingers = `M-12 -6C-8 -13 4 -14 11 -8C15 -4 15 3 11 7C9 9 6 8 7 5C9 2 8 -3 4 -5C0 -7 -6 -5 -8 -1Z` +
    `M-10 -1C-8 -9 2 -10 7 -5C11 -1 10 6 6 10C3 12 0 11 1 7C3 4 2 -1 -1 -2C-4 -3 -7 -1 -8 2Z` +
    `M-9 5C-8 -2 -1 -4 3 -1C7 3 5 10 0 13C-3 14 -6 12 -4 9C-2 7 -3 3 -5 2Z`;
  s += `<path fill="${I.N}" d="${fingers}"/>`;
  if (!far) s += `<path fill="none" stroke="${I.B}" stroke-width="1" d="M-6 -8C0 -11 7 -9 10 -4M-4 -2C0 -5 4 -3 6 1M-4 5C-1 3 2 5 2 9"/>`;
  if (!far) s += `<path fill="${I.P}" d="M-22 -10C-16 -13 -9 -12 -6 -8C-9 -4 -9 2 -7 7C-12 9 -18 8 -22 4Z"/>` + key(`M-6 -8C-9 -4 -9 2 -7 7`, 1.6);
  return s;
}
pel.wingNearUpper = wingUpper(false); pel.wingFarUpper = wingUpper(true);
pel.wingNearLower = wingLower(false); pel.wingFarLower = wingLower(true);
pel.wingNearHand = wingHand(false); pel.wingFarHand = wingHand(true);

// ---- body (pelvis-local): spec ellipse, warped into a deep-chested teardrop
{
  const pts = [];
  for (let i = 0; i < 28; i++) {
    const t = i / 28 * Math.PI * 2; let ex = 98 * Math.cos(t), ey = 58 * Math.sin(t);
    const back = Math.max(0, -Math.cos(t)); ey *= 1 - 0.3 * back * back; ex *= 1 + 0.06 * back;
    if (Math.sin(t) > 0 && Math.cos(t) > 0) { ex *= 1.03; ey *= 1.02; }
    const p = rot([ex, ey], -18); pts.push([32 + p[0], -50 + p[1]]);
  }
  const o = smooth(pts);
  let b = `<path fill="${I.P}" d="${o}"/>`;
  b += `<clipPath id="bdc"><path d="${o}"/></clipPath><g clip-path="url(#bdc)">`;
  b += `<path fill="url(#htB)" d="M-100 -40C-50 -52 30 -76 150 -110L150 40L-100 40Z"/>`;
  b += `<path fill="url(#htB)" d="M-90 -12C-40 -10 40 -20 150 -42L150 40L-90 40Z"/>`;
  b += `<path fill="url(#htB2)" d="M-90 -2C-40 2 20 -2 80 -14L80 40L-90 40Z"/>`;
  let sc = '';
  for (const [x0, y0, n] of [[-54, -80, 5], [-48, -64, 5], [-44, -48, 4]]) for (let i = 0; i < n; i++) { const x = x0 + i * 17, y = y0 - i * 4.5; sc += `M${x} ${y}q8.5 9 17 -4.5`; }
  b += `<path fill="none" stroke="${I.B}" stroke-width="1.6" d="${sc}"/>`;
  b += `<path fill="url(#htO)" d="M98 -106C120 -98 132 -78 130 -58C118 -64 106 -82 98 -106Z"/>`;
  b += `</g>` + key(o);
  pel.body = b;
}
{
  const td = 'M10 -10C-2 -12 -14 -10 -26 -4C-22 -2 -22 0 -28 3C-22 5 -21 7 -25 10C-12 12 0 12 10 8Z';
  pel.tail = `<g transform="rotate(14)"><path fill="${I.P}" d="${td}"/><path fill="url(#htB2)" d="${td}"/>` + key(td, 2) + key('M-4 -2L-20 -1M-4 4L-18 6', 1.3) + `</g>`;
}
function neckOutline(P0, P1, P2, P3, w0, w1, n = 9) {
  const Bz = t => { const u = 1 - t; return [u * u * u * P0[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * P3[0], u * u * u * P0[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * P3[1]]; };
  const L = [], Rr = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), p = Bz(t), a = Bz(Math.max(0, t - .01)), b = Bz(Math.min(1, t + .01));
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), w = lerp(w0, w1, t) / 2;
    L.push([p[0] + dy / l * w, p[1] - dx / l * w]); Rr.push([p[0] - dy / l * w, p[1] + dx / l * w]);
  }
  return { L, R: Rr };
}
{
  const P0 = [67, -392], P1 = add(P0, [30, -58]), P3 = add(HEAD, [-14, 10]), P2 = add(P3, [-58, 34]);
  const nk = neckOutline(P0, P1, P2, P3, 34, 24);
  const back = nk.L, front = nk.R;
  const o = smooth([...front, ...back.slice().reverse()]);
  let s = `<path fill="${I.P}" d="${o}"/>`;
  const inner = back.map((p, i) => { const q = front[i]; return [lerp(p[0], q[0], 0.38), lerp(p[1], q[1], 0.38)]; });
  s += `<path fill="url(#htB)" d="${smooth([...inner, ...back.slice().reverse()])}"/>`;
  const fr = front.slice(0, 5).map((p, i) => { const q = back[i]; return [lerp(p[0], q[0], 0.3), lerp(p[1], q[1], 0.3)]; });
  s += `<path fill="url(#htO)" d="${smooth([...front.slice(0, 5), ...fr.reverse()])}"/>`;
  s += key(smooth(front, false)) + key(smooth(back, false));
  pel.neck = s;
}
function ribbon(center, w0, w1, stripe, cA, cB, twist) {
  const n = center.length; const L = [], Rr = [];
  for (let i = 0; i < n; i++) {
    const a = center[Math.max(0, i - 1)], b = center[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    const w = lerp(w0, w1, i / (n - 1)) * (twist ? (0.55 + 0.45 * Math.abs(Math.cos(i / (n - 1) * Math.PI * twist))) : 1) / 2;
    L.push([center[i][0] + dy / l * w, center[i][1] - dx / l * w]); Rr.push([center[i][0] - dy / l * w, center[i][1] + dx / l * w]);
  }
  let s = '';
  for (let i = 0; i < n - 1; i++) {
    const c = Math.floor(i / stripe) % 2 ? cB : cA;
    s += `<path fill="${c}" d="${P([L[i], L[i + 1], Rr[i + 1], Rr[i]])}" stroke="${c}" stroke-width=".6"/>`;
  }
  const e0 = L[n - 1], e1 = Rr[n - 1], dir = [center[n - 1][0] - center[n - 2][0], center[n - 1][1] - center[n - 2][1]], dl = Math.hypot(...dir);
  let fr = ''; for (let k = 0; k <= 4; k++) { const p = [lerp(e0[0], e1[0], k / 4), lerp(e0[1], e1[1], k / 4)]; fr += `M${f(p[0])} ${f(p[1])}l${f(dir[0] / dl * 9)} ${f(dir[1] / dl * 9)}`; }
  s += `<path stroke="${cA}" stroke-width="2" stroke-linecap="round" d="${fr}"/>`;
  return s;
}
function curve(pts, n) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]); return out;
}
{
  let s = '';
  s += ribbon(curve([[56, -394], [26, -388], [-6, -398], [-38, -388], [-66, -392], [-96, -378]], 7), 19, 11, 4, I.R, I.P, 1.3);
  s += ribbon(curve([[56, -404], [28, -420], [-6, -418], [-40, -440], [-74, -436], [-104, -456], [-138, -452], [-160, -466]], 7), 22, 12, 4, I.R, I.P, 2.2);
  const wrap = 'M46 -410C62 -416 86 -412 97 -401C101 -392 99 -384 93 -378C80 -371 60 -371 47 -377C41 -388 41 -401 46 -410Z';
  s += `<path fill="${I.R}" d="${wrap}"/>`;
  s += `<clipPath id="swc"><path d="${wrap}"/></clipPath><g clip-path="url(#swc)"><path stroke="${I.P}" stroke-width="5" d="M55 -422L49 -366M70 -422L64 -366M85 -422L79 -366M100 -422L94 -366"/><path fill="url(#htN)" d="M38 -386C60 -377 80 -377 102 -386L102 -360L38 -360Z"/></g>`;
  s += `<path fill="${I.R}" d="M86 -393C94 -391 99 -385 97 -378C105 -370 110 -357 106 -344C100 -350 95 -354 88 -355C92 -363 90 -372 84 -378C82 -384 82 -390 86 -393Z"/>`;
  s += `<path stroke="${I.P}" stroke-width="3.5" d="M93 -372L103 -368M94 -362L106 -358"/><path stroke="${I.R}" stroke-width="2" stroke-linecap="round" d="M98 -347l2 7M102 -346l3 6M106 -346l3 5"/>`;
  s += `<circle cx="90" cy="-386" r="7.5" fill="${I.R}"/><path fill="url(#htN)" d="${circ(90, -386, 7.5)}"/>`;
  pel.scarf = s;
}
{
  let h = '';
  const o = smooth([[-27, 10], [-31, -6], [-23, -23], [-6, -31], [12, -30], [27, -23], [36, -13], [44, -6], [32, -1], [24, 6], [16, 14], [2, 19], [-12, 19]]);
  h += `<path fill="${I.P}" d="${o}"/>`;
  h += `<clipPath id="hdc"><path d="${o}"/></clipPath><g clip-path="url(#hdc)"><path fill="url(#htB)" d="M-40 6C-20 13 0 16 40 12L40 40L-40 40Z"/><path fill="url(#htB)" d="M-40 -40L-18 -40C-27 -20 -25 0 -17 20L-40 20Z"/>`;
  // bare pink facial skin: wraps the eye and runs seamlessly into the bill
  h += `<path fill="${I.K}" d="${smooth([[-9, -5], [0, -13], [14, -18], [28, -15], [44, -6], [32, -1], [22, 4], [10, 1]])}"/>`;
  h += `</g>`;
  // a contented smile: the gape line hooks up at the corner of the mouth
  h += `<path fill="none" stroke="${I.R}" stroke-width="2" stroke-linecap="round" d="M36 8.6C28 6.6 20 5 15 3.6C12 2.6 10.5 0.5 10.5 -2"/>`;
  h += key(smooth([[29, -21], [12, -30], [-6, -31], [-23, -23], [-31, -6], [-27, 10], [-12, 19], [2, 19], [16, 14]], false));
  h += key(smooth([[26, -22], [36, -13], [44, -6]], false), 1.6);
  pel.head = h;
  pel.eye = `<circle r="5.8" fill="${I.R}"/><circle r="4.1" fill="${I.N}"/><circle cx="1.7" cy="-1.9" r="1.6" fill="${I.P}"/>` +
    `<path fill="none" stroke="${I.N}" stroke-width="2.2" stroke-linecap="round" d="M-8 -3.8Q0 -10.5 8.5 -4.8"/>` +
    `<path fill="none" stroke="${I.R}" stroke-width="1.3" stroke-linecap="round" d="M-5 6Q1 8.6 6.4 5.4"/>`;
  // crest-local: +x = back along the nape, +y = up; tips droop toward -y
  const cd = smooth([[-6, 13], [14, 12], [32, 7], [44, 1], [30, -1], [44, -8], [28, -9], [38, -17], [22, -15], [26, -23], [12, -18], [-4, -12]]);
  pel.crest = `<path fill="${I.P}" d="${cd}"/><clipPath id="crc"><path d="${cd}"/></clipPath><path clip-path="url(#crc)" fill="url(#htB)" d="M-10 -2L50 -6L50 -30L-10 -30Z"/>` +
    key('M4 11C18 11 30 6 44 1C34 -1 30 -1 30 -1C36 -4 40 -6 44 -8C36 -8 32 -9 28 -9C32 -12 36 -15 38 -17C32 -16 26 -15 22 -15C24 -18 25 -21 26 -23C20 -21 16 -19 12 -18', 1.6) +
    key('M4 2Q16 0 26 -3M4 -6Q12 -8 20 -10', 1.1);
}
pel.billUpper = `<path fill="${I.K}" d="M-4 -13C20 -13 60 -9 100 -6.5C112 -6 120 -7.5 124 -6.5C130 -4.5 132 3 128 9C126 5.5 122 3 118 2L-2 2C-6 -2 -7 -8 -4 -13Z"/>` +
  `<path fill="none" stroke="${I.R}" stroke-width="1.6" d="M2 -8.5C40 -6.5 80 -4.5 116 -3.2"/>` +
  `<path fill="${I.R}" d="M116 -6C121 -7 126 -6.5 128.5 -3.5C131.5 1 130 5.5 128 9C126 5 121.5 2.2 116 1.6Z"/>` +
  `<path fill="none" stroke="${I.P}" stroke-width="1.4" stroke-linecap="round" d="M8 -11C40 -9 70 -7.5 96 -6.4"/>` +
  `<path fill="url(#htR)" d="M-2 -2C30 -1 80 0 118 0L118 2L-2 2Z"/>` +
  `<path fill="none" stroke="${I.R}" stroke-width="2" stroke-linecap="round" d="M-2 2C4 2.6 9 1 12 -2.4"/>`;
pel.billLower = `<path fill="${I.K}" d="M-2 0L116 0C118 1 118 3 115 4.4L0 6.4C-4 5.4 -4 1 -2 0Z"/><path stroke="${I.R}" stroke-width="1.4" d="M0 .4L116 .4"/>`;
{ // pouch (pouch-local: hangs in +y from the lower mandible, runs back onto the throat; scaling about (0,0) reads as a jiggle)
  const po = 'M-8 -4L110 -4C102 5 88 15 68 24C50 32 28 37 8 34C-10 32 -26 26 -38 18C-36 10 -30 4 -20 -1Z';
  pel.pouch = `<path fill="${I.O}" d="${po}"/>` +
    `<clipPath id="poc"><path d="${po}"/></clipPath><g clip-path="url(#poc)"><path fill="url(#htR)" d="M-30 14C-10 30 18 34 40 33C62 31 82 20 100 6L100 50L-30 50Z"/></g>` +
    `<path fill="none" stroke="${I.R}" stroke-width="1.3" stroke-linecap="round" d="M14 5C30 13 52 15 74 11M4 15C22 25 44 27 62 22M-22 14C-8 22 8 26 22 28"/>` +
    `<path fill="none" stroke="${I.P}" stroke-width="1.6" stroke-linecap="round" d="M16 -1C34 3 56 3 82 0"/>` +
    key(`M110 -4C102 5 88 15 68 24C50 32 28 37 8 34C-10 32 -26 26 -38 18`, 1.6, I.R);
}

// ---------------------------------------------------------------- rider assembly (flat slot list, back -> front)
const hand = 15;
const RL = [];
RL.push(J('wingFarUpper', ...shF, wF.a1, pel.wingFarUpper));
RL.push(J('wingFarLower', ...wF.K, wF.a2, pel.wingFarLower));
RL.push(J('wingFarHand', ...gripF, hand, pel.wingFarHand));
RL.push(J('pedalFar', ...pedF, aF, bike.pedalFar));
RL.push(J('footFar', ...ankF, aF, pel.footFar));
RL.push(J('shankFar', ...legF.K, legF.a2, pel.shankFar));
RL.push(J('thighFar', ...hipF, legF.a1, pel.thighFar));
RL.push(J('crankFar', ...BB, phi / D2R + 180, bike.crankFar));
RL.push(J('wheelRear', ...RH, 0, bike.wheelRear));
RL.push(J('wheelFront', ...FH, 0, bike.wheelFront));
RL.push(J('frame', 0, 0, 0, bike.frame));
RL.push(J('fork', 0, 0, 0, bike.fork));
RL.push(J('bars', 0, 0, 0, bike.bars));
RL.push(J('cog', ...RH, 0, bike.cog));
RL.push(J('chain', 0, 0, 0, bike.chain));
RL.push(J('chainring', ...BB, 0, bike.chainring));
RL.push(J('crankNear', ...BB, phi / D2R, bike.crankNear));
RL.push(J('neck', 0, 0, 0, pel.neck));
RL.push(J('tail', ...add(pelvis, [-62, -38]), 8, pel.tail));
RL.push(J('body', ...pelvis, 0, pel.body));
RL.push(`<g id="pb-scarf">${pel.scarf}</g>`);
RL.push(J('pedalNear', ...pedN, aN, bike.pedalNear));
RL.push(J('shankNear', ...legN.K, legN.a2, pel.shankNear));
RL.push(J('footNear', ...ankN, aN, pel.footNear));
RL.push(J('thighNear', ...hipN, legN.a1, pel.thighNear));
const billLo = add(HEAD, [16, 6]);
RL.push(J('pouch', ...add(billLo, rot([6, 5], 14)), 14, pel.pouch));
RL.push(J('billLower', ...billLo, 14, pel.billLower));
RL.push(J('billUpper', ...add(HEAD, [16, 2]), 14, pel.billUpper));
RL.push(J('head', ...HEAD, 0, pel.head));
RL.push(J('eye', ...add(HEAD, [6, -7]), 0, pel.eye));
RL.push(J('crest', ...add(HEAD, [-20, -16]), 200, pel.crest));
RL.push(J('wingNearUpper', ...shN, wN.a1, pel.wingNearUpper));
RL.push(J('wingNearLower', ...wN.K, wN.a2, pel.wingNearLower));
RL.push(J('wingNearHand', ...gripN, hand, pel.wingNearHand));
const rider = `<g id="L-rider" transform="translate(680 790)">${RL.join('\n')}</g>`;

// ================================================================ LETTERING
// Hand-built deco capitals: monoline strokes (w=24 in a 100-high box), clipped flush to cap and base lines.
const LET = {
  P: { w: 76, s: [['M12 112V12H40A24 23 0 0 1 40 58H12', 24]] },
  E: { w: 64, s: [['M64 12H12V88H64', 24], ['M12 50H56', 22]] },
  L: { w: 60, s: [['M12 -10V88H60', 24]] },
  I: { w: 24, s: [['M12 -10V110', 24]] },
  C: { w: 76, s: [['M76 12H46A34 38 0 0 0 12 50A34 38 0 0 0 46 88H76', 24]] },
  A: { w: 90, s: [['M10 118L45 -14L80 118', 24], ['M20 76H70', 18]] },
  N: { w: 82, s: [['M12 112V-2L70 102V-12', 24]] },
  B: { w: 78, s: [['M12 -10V110', 24], ['M12 12H42A20 19 0 0 1 42 50H12', 24], ['M12 50H44A22 19 0 0 1 44 88H12', 24]] },
  Y: { w: 84, s: [['M2 -14L42 54L82 -14', 24], ['M42 50V112', 24]] },
};
function lettering(str, x, y, s, { fill, shadow, inline, depth = 7, gap = 13 }) {
  let pen = 0; const parts = [];
  for (const ch of str) { if (ch === ' ') { pen += 44; continue; } const L = LET[ch]; parts.push({ L, x: pen }); pen += L.w + gap; }
  const w = pen - gap, clipId = 'tclip' + Math.round(x);
  const glyphs = sw0 => parts.map(({ L, x }) => L.s.map(([d, sw]) => `<path transform="translate(${x} 0)" d="${d}" stroke-width="${sw0 || sw}"/>`).join('')).join('');
  const layer = (dx, dy, c, sw) => `<g transform="translate(${f(dx)} ${f(dy)})"><g clip-path="url(#${clipId})" fill="none" stroke="${c}" stroke-miterlimit="12">${glyphs(sw)}</g></g>`;
  let g = `<clipPath id="${clipId}"><rect x="-20" y="0" width="${w + 40}" height="100"/></clipPath>`;
  for (let i = depth; i >= 1; i--) g += layer(i * 0.9, i * 0.9, shadow);
  g += layer(0, 0, fill);
  if (inline) g += layer(0, 0, inline, 2.6);
  return { svg: `<g transform="translate(${x} ${y}) scale(${s})">${g}</g>`, w: w * s };
}
const zh = loadFont('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc');
const lat = loadFont('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf');
let title = '';
{
  const T = lettering('PELICAN BAY', 70, 42, 1.12, { fill: I.P, shadow: I.N, inline: I.R, depth: 8 });
  title += T.svg;
  const sx = 70 + T.w + 30, sy = 38;
  let g = ''; ['鹈', '鹕', '湾'].forEach((ch, i) => { g += zh.text(ch, { size: 40, x: sx + 8, y: sy + 40 + i * 42 }).d; });
  title += `<rect x="${f(sx + 4)}" y="${sy + 4}" width="56" height="140" rx="6" fill="${I.N}"/><rect x="${f(sx)}" y="${sy}" width="56" height="140" rx="6" fill="${I.R}"/><rect x="${f(sx + 3.5)}" y="${sy + 3.5}" width="49" height="133" rx="4" fill="none" stroke="${I.P}" stroke-width="1.6"/>`;
  title += `<path d="${g}" fill="${I.P}" stroke="${I.P}" stroke-width="1.6" stroke-linejoin="round"/>`;
  const tag = lat.text('THE COAST ROAD  ·  BY BICYCLE', { size: 21, track: 5.2, sx: 0.92 });
  const tagX = 74, tagY = 206;
  title += `<rect x="${tagX - 4}" y="${tagY - 22}" width="${f(tag.width + 28)}" height="31" fill="${I.N}"/><path transform="translate(${tagX + 10} ${tagY})" d="${tag.d}" fill="${I.P}"/>`;
  title += `<path fill="${I.P}" d="M${f(tagX + tag.width + 40)} ${tagY - 7}l6 -6l6 6l-6 6z"/>`;
}

// ================================================================ BORDER (screen-fixed)
const border = `<path fill-rule="evenodd" fill="${I.P}" d="M-10 -10H1610V910H-10Z M16 16V884H1584V16Z"/><rect x="22" y="22" width="1556" height="856" fill="none" stroke="${I.N}" stroke-width="3"/>`;

// ================================================================ ASSEMBLE
const svg = (vb, w = 1600, h = 900) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}" height="${h}">
<title>Pelican Bay - retro travel poster keyframe</title>
<defs>${defs}</defs>
<g id="L-sky">${sky}</g>
<g id="L-sunmoon">${sun}</g>
<g id="L-clouds">${clouds}</g>
<g id="L-hills-far">${hills}</g>
<g id="L-sea">${sea}</g>
<g id="L-boats">${boats}</g>
<g id="L-gulls-far">${gulls}</g>
<g id="L-shore">${shore}</g>
<g id="L-roadside">${roadside}</g>
<g id="L-road">${road}</g>
<g id="L-shadow">${shadow}</g>
<g id="L-fx-back">${fx}</g>
${rider}
<g id="L-foreground">${fg}</g>
<g id="L-title">${title}</g>
<rect x="0" y="0" width="1600" height="900" fill="url(#speck)"/>
<g id="L-letterbox">${border}</g>
</svg>`;
fs.writeFileSync(path.join(here, 'keyframe.svg'), svg('0 0 1600 900'));
fs.writeFileSync(path.join(here, 'closeup.svg'), svg('440 220 560 580', 1120, 1160));
console.log('ok', (fs.statSync(path.join(here, 'keyframe.svg')).size / 1024).toFixed(0) + ' KB');
