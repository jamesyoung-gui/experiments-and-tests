// Neon Pelican: concept keyframe (edition X). Hand-authored SVG generator.
// node drafts/X-concept/gen.mjs  ->  drafts/X-concept/keyframe.svg (+ closeup.svg)
// Rider pose comes from the project's pure solver at crank phi = 0 (rig-spec geometry), so every joint is exact.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const { solvePose } = await import(pathToFileURL(path.join(ROOT, 'src/rig/solve.js')).href);
const { BIKE, CHAIN_D, RIDER_X, GROUND_Y } = await import(pathToFileURL(path.join(ROOT, 'src/contract.js')).href);

const P = solvePose(0, { crank: 0, distance: 0, cadence: 60, events: [] });
const J = P.joints, NK = P.neck;

// ------------------------------------------------------------------ palette (STYLE-X §1)
const C = {
  void: '#07060F', night0: '#141029', night1: '#261A45', steel: '#3A3F5C', haze: '#5B3F7A',
  mag: '#FF2E88', cyan: '#19E6FF', acid: '#C6FF3D', amber: '#FFB547', plume: '#E9E6F2',
  magCore: '#FFD3E7', cyanCore: '#D8FBFF', acidCore: '#F1FFD0', amberCore: '#FFF0D2',
  red: '#FF3B4E', ink: '#0A0816',
  plumeShade: '#B8B0D8', plumeDeep: '#8A80B4', flight: '#15121F', flightSheen: '#3E3A5E',
  bill: '#F4A58E', billEdge: '#D9705A', pouch0: '#F9C74F', pouch1: '#F4A340', face: '#F7C1B5', iris: '#8B1E1E',
  feet: '#F08A3C', web: '#F5A05A', jacket: '#1C1932', jacketHi: '#2E2A52', jacketLo: '#110F20',
  frame: '#14121C', frameHi: '#4A4F70',
};
const CN = "'WenQuanYi Zen Hei','DejaVu Sans',sans-serif";
const SANS = "'DejaVu Sans',sans-serif";
const BOLD = "'DejaVu Sans',sans-serif";
const MONO = "'DejaVu Sans Mono',monospace";

// ------------------------------------------------------------------ helpers
const f = n => String(Math.round(n * 10) / 10);
const pt = p => f(p[0]) + ' ' + f(p[1]);
const D2R = Math.PI / 180;
const rot = ([x, y], a) => { const c = Math.cos(a * D2R), s = Math.sin(a * D2R); return [x * c - y * s, x * s + y * c]; };
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const lerp = (a, b, t) => a + (b - a) * t;
const lerp2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const norm = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const perp = v => [-v[1], v[0]];
function smooth(pts, closed = true, k = 1 / 6) {
  const n = pts.length, g = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  let d = `M${pt(pts[0])}`; const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    d += `C${pt([p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k])} ${pt([p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k])} ${pt(p2)}`;
  }
  return d + (closed ? 'Z' : '');
}
const poly = pts => 'M' + pts.map(pt).join('L') + 'Z';
const line = pts => 'M' + pts.map(pt).join('L');
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
let UID = 0; const uid = p => `${p}${UID++}`;
const DEFS = [];
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const bez = (p0, p1, p2, p3, t) => { const u = 1 - t; return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]; };
const bezT = (p0, p1, p2, p3, t) => { const u = 1 - t; return norm([3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]), 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1])]); };
// ribbon outline around a centerline with widths
function ribbon(cl, w0, w1, capped = true) {
  const L = [], R = [];
  for (let i = 0; i < cl.length; i++) {
    const a = cl[Math.max(0, i - 1)], b = cl[Math.min(cl.length - 1, i + 1)];
    const n = perp(norm(sub(b, a))), w = lerp(w0, w1, i / (cl.length - 1)) / 2;
    L.push(add(cl[i], mul(n, w))); R.push(add(cl[i], mul(n, -w)));
  }
  return smooth([...L, ...R.reverse()], true);
}
const lg = (id, x1, y1, x2, y2, stops, units = 'objectBoundingBox') => { DEFS.push(`<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${units === 'user' ? ' gradientUnits="userSpaceOnUse"' : ''}>${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`); return `url(#${id})`; };
const rgd = (id, stops, extra = '') => { DEFS.push(`<radialGradient id="${id}" ${extra}>${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</radialGradient>`); return `url(#${id})`; };
// glow blob (radial gradient disc), cheap
const GL = {};
function glowGrad(col) { if (!GL[col]) GL[col] = rgd(uid('gg'), [[0, col, 1], [0.35, col, 0.45], [1, col, 0]]); return GL[col]; }
const blob = (x, y, rx, ry, col, op = 1) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="${glowGrad(col)}" opacity="${op}"/>`;
// stacked-stroke neon line (no filters: rider/moving parts)
const neonStroke = (d, col, core, w = 2, op = 1) => `<g fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"><path d="${d}" stroke="${col}" stroke-width="${w * 6}" opacity=".12"/><path d="${d}" stroke="${col}" stroke-width="${w * 3}" opacity=".28"/><path d="${d}" stroke="${col}" stroke-width="${w * 1.4}"/><path d="${d}" stroke="${core}" stroke-width="${w * 0.55}"/></g>`;

// Dual-colour rim fill (cyan crescent on the side opposite a, magenta on the side opposite b), in local coords.
// a, b are WORLD vectors; rotated into the part's local frame by rot.
function rimFill(d, { base, cy = C.cyan, mg = C.mag, rot: r = 0, a = [3.2, 0.6], b = [-3, 2.6], stroke = C.ink, sw = 1.3, extra = '', over = '' }) {
  const k = uid('rf'); const al = rot(a, -r), bl = rot(b, -r);
  DEFS.push(`<path id="${k}" d="${d}"/><clipPath id="${k}c"><use href="#${k}"/></clipPath><clipPath id="${k}a"><use href="#${k}" transform="translate(${f(al[0])} ${f(al[1])})"/></clipPath><clipPath id="${k}b"><use href="#${k}" transform="translate(${f(bl[0])} ${f(bl[1])})"/></clipPath>`);
  return `<g clip-path="url(#${k}c)"><use href="#${k}" fill="${cy}"/><g clip-path="url(#${k}a)"><use href="#${k}" fill="${mg}"/><g clip-path="url(#${k}b)"><use href="#${k}" fill="${base}"/>${extra}</g></g>${over}</g>` +
    (stroke ? `<use href="#${k}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>` : '');
}
const slot = (name, body) => { const j = J[name]; const s = (j.sx && (j.sx !== 1 || j.sy !== 1) && name !== 'eye') ? ` scale(${f(j.sx)} ${f(j.sy)})` : ''; return `<g id="j-${name}" transform="translate(${f(j.x)} ${f(j.y)}) rotate(${f(j.rot)})${s}">${body}</g>`; };

// neon text for static sheets (filter bloom allowed)
function neonText(x, y, txt, { size = 20, col = C.mag, core, font = CN, weight = 'normal', anchor = 'middle', ls = 0, op = 1, glow = 'fGlow', extra = '' } = {}) {
  core = core || '#FFFFFF';
  const a = `x="${f(x)}" y="${f(y)}" font-family="${font}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="${ls}" ${extra}`;
  return `<g opacity="${op}"><text ${a} fill="${col}" stroke="${col}" stroke-width="${size / 16}" filter="url(#${glow})">${esc(txt)}</text><text ${a} fill="${core}" stroke="${col}" stroke-width="${size / 30}">${esc(txt)}</text></g>`;
}
// vertical sign (stacked CJK characters in a boxed lightbox)
function vSign(x, y, chars, { size = 30, col = C.mag, box = true, sub = '', subSize = 9, pad = 7, frame = C.ink, core } = {}) {
  const w = size + pad * 2, hgt = chars.length * size * 1.08 + pad * 2 + (sub ? subSize * 1.6 : 0);
  let s = `<g>`;
  if (box) s += `<rect x="${f(x - w / 2)}" y="${f(y)}" width="${f(w)}" height="${f(hgt)}" rx="3" fill="${frame}" opacity=".92"/><rect x="${f(x - w / 2 + 2)}" y="${f(y + 2)}" width="${f(w - 4)}" height="${f(hgt - 4)}" rx="2" fill="none" stroke="${col}" stroke-width="1.6" filter="url(#fGlow)"/><rect x="${f(x - w / 2 + 2)}" y="${f(y + 2)}" width="${f(w - 4)}" height="${f(hgt - 4)}" rx="2" fill="none" stroke="${core || '#fff'}" stroke-width=".5" opacity=".7"/>`;
  [...chars].forEach((ch, i) => { s += neonText(x, y + pad + size * 0.9 + i * size * 1.08, ch, { size, col, core }); });
  if (sub) s += neonText(x, y + hgt - pad - 1, sub, { size: subSize, col, font: BOLD, weight: 'bold', core });
  return s + '</g>';
}
// bracket (post-and-arm) holding a sign off a wall
const bracket = (x0, y, x1) => `<path d="M${f(x0)} ${f(y)}H${f(x1)}M${f(x0)} ${f(y + 8)}L${f(x1)} ${f(y)}" stroke="#0B0918" stroke-width="2.2" fill="none"/>`;

// ------------------------------------------------------------------ filters + shared defs
DEFS.push(`
<filter id="fGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="fGlowL" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="fB1" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.1"/></filter>
<filter id="fB2" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.4"/></filter>
<filter id="fB5" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>
<filter id="fB12" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="12"/></filter>
<filter id="fB30" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="30"/></filter>
<filter id="fRefl" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="2.5 9"/></filter>
<filter id="fReflS" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="1.2 3.5"/></filter>
<pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#000" opacity=".22"/></pattern>
<pattern id="carbon" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="${C.frame}"/><rect width="2" height="2" fill="#1C1A28"/><rect x="2" y="2" width="2" height="2" fill="#1C1A28"/></pattern>
<pattern id="rib" width="2.4" height="10" patternUnits="userSpaceOnUse"><rect width="2.4" height="10" fill="#2A2646"/><rect width="1" height="10" fill="#15122A"/></pattern>
`);
const chromeG = lg('chrome', 0, 0, 0, 1, [[0, '#FFFFFF'], [0.35, '#B9C3E6'], [0.55, '#5A607E'], [0.75, '#E9A2D0'], [1, '#2A2E48']]);
const chromeH = lg('chromeH', 0, 0, 1, 0, [[0, '#2A2E48'], [0.3, '#DDE6FF'], [0.5, '#7B84A8'], [0.8, '#FFB6DC'], [1, '#2A2E48']]);

// ============================================================================================ WORLD
const W = [];
// ---- sky
W.push(`<rect width="1600" height="900" fill="${lg('sky', 0, 0, 0, 900, [[0, C.void], [0.14, '#0E0A21'], [0.3, '#1A1238'], [0.42, '#2E1D55'], [0.5, C.haze], [0.56, '#9C3A80'], [0.61, '#E8486F'], [0.66, '#FF8A55'], [0.72, '#6A2E6E'], [1, '#1A1030']], 'user')}"/>`);
// stars through the smog
{ const r = rng(7); let d = ''; for (let i = 0; i < 70; i++) { const x = r() * 1600, y = r() * 210; d += `M${f(x)} ${f(y)}h.01`; } W.push(`<path d="${d}" stroke="#E9E6F2" stroke-width="1.3" stroke-linecap="round" opacity=".35"/>`); }
// smog sun (neon dusk) behind the right gap
W.push(`<g><circle cx="1105" cy="505" r="300" fill="${glowGrad('#FF4F7E')}" opacity=".55"/><circle cx="1105" cy="505" r="150" fill="${glowGrad('#FFB547')}" opacity=".7"/>
<circle cx="1105" cy="505" r="62" fill="${rgd('sunD', [[0, '#FFF3D6'], [0.55, '#FFC06A'], [1, '#FF5A7A']])}"/>
${[0, 1, 2, 3, 4].map(i => `<rect x="1030" y="${478 + i * 11}" width="150" height="${2 + i * 0.8}" fill="#8E2F6E" opacity=".55"/>`).join('')}</g>`);
// smog clouds, lit from below
{ const r = rng(11); let s = '<g filter="url(#fB12)">';
  for (let i = 0; i < 16; i++) { const x = r() * 1700 - 50, y = 70 + r() * 330, w = 180 + r() * 380, h = 14 + r() * 26; s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(w / 2)}" ry="${f(h)}" fill="#2B1B4E" opacity="${f(0.5 + r() * 0.4)}"/><ellipse cx="${f(x + 10)}" cy="${f(y + h * 0.7)}" rx="${f(w * 0.42)}" ry="${f(h * 0.35)}" fill="${y > 250 ? '#FF5E8E' : '#8C4BAA'}" opacity="${f(0.18 + r() * 0.2)}"/>`; }
  W.push(s + '</g>'); }
// searchlights (static sheet: blurred cones)
function cone(x, y, ang, len, w0, w1, col, op) { const d = rot([0, -1], ang), n = perp(d); const e = add([x, y], mul(d, len)); const id = uid('sl'); lg(id, x, y, e[0], e[1], [[0, col, op], [0.6, col, op * 0.35], [1, col, 0]], 'user'); return `<path d="${poly([add([x, y], mul(n, w0)), add(e, mul(n, w1)), add(e, mul(n, -w1)), add([x, y], mul(n, -w0))])}" fill="url(#${id})"/>`; }
W.push(`<g filter="url(#fB5)" style="mix-blend-mode:screen">${cone(290, 560, -24, 640, 4, 70, '#BFEFFF', 0.28)}${cone(520, 600, 14, 700, 4, 60, '#FFB9DE', 0.22)}${cone(1060, 128, -58, 900, 2, 95, '#D8FBFF', 0.3)}${cone(1480, 560, 20, 660, 4, 70, '#BFEFFF', 0.22)}${cone(1500, 560, -8, 600, 4, 50, '#FFD1E7', 0.16)}</g>`);

// ---- far skyline (two depths, thousands of windows, merged paths)
function skyline(seed, x0, x1, base, hMin, hMax, fill, winOp, density, winScale = 1) {
  const r = rng(seed); let body = '', rimD = ''; const wins = { a: '', c: '', m: '', w: '' };
  let x = x0; const lights = [];
  while (x < x1) {
    const w = (18 + r() * 52) * winScale, top = base - (hMin + Math.pow(r(), 1.6) * (hMax - hMin));
    const kind = r();
    if (kind < 0.25) body += `M${f(x)} ${f(base)}V${f(top + 16)}L${f(x + w * 0.5)} ${f(top)}L${f(x + w)} ${f(top + 16)}V${f(base)}Z`;
    else if (kind < 0.45) body += `M${f(x)} ${f(base)}V${f(top + 26)}H${f(x + w * 0.2)}V${f(top)}H${f(x + w * 0.8)}V${f(top + 26)}H${f(x + w)}V${f(base)}Z`;
    else body += `M${f(x)} ${f(base)}V${f(top)}H${f(x + w)}V${f(base)}Z`;
    if (r() < 0.45) { const ax = x + w * (0.3 + r() * 0.4), ah = 14 + r() * 40; body += `M${f(ax - 0.8)} ${f(top + 2)}V${f(top - ah)}h1.6V${f(top + 2)}Z`; lights.push([ax, top - ah]); }
    rimD += `M${f(x + w)} ${f(top + 2)}V${f(Math.min(base, top + 90))}`;
    const cw = 5 * winScale, ch = 7 * winScale;
    for (let yy = top + 8; yy < base - 4; yy += ch) for (let xx = x + 3; xx < x + w - 4; xx += cw) {
      if (r() > density) continue; const k = r(); const key = k < 0.5 ? 'a' : k < 0.72 ? 'c' : k < 0.86 ? 'm' : 'w';
      wins[key] += `M${f(xx)} ${f(yy)}h${f(2 * winScale)}v${f(3 * winScale)}h${f(-2 * winScale)}z`;
    }
    x += w + r() * 6;
  }
  return `<g><path d="${body}" fill="${fill}"/><path d="${rimD}" stroke="#FF5E9E" stroke-width="1" opacity=".25"/>
  <path d="${wins.a}" fill="${C.amber}" opacity="${winOp}"/><path d="${wins.c}" fill="${C.cyan}" opacity="${winOp}"/><path d="${wins.m}" fill="${C.mag}" opacity="${winOp}"/><path d="${wins.w}" fill="#FFF3E0" opacity="${winOp}"/>
  ${lights.map(([lx, ly]) => `<circle cx="${f(lx)}" cy="${f(ly)}" r="1.6" fill="${C.red}"/>`).join('')}</g>`;
}
W.push(`<g opacity=".85">${skyline(3, -30, 1640, 610, 90, 250, '#3A2660', 0.45, 0.18, 0.8)}</g>`);
W.push(`<rect x="0" y="380" width="1600" height="260" fill="${lg('hz1', 0, 0, 0, 1, [[0, '#FF6E8E', 0], [0.55, '#E8487A', 0.35], [1, '#5B3F7A', 0.1]])}"/>`);
// data-spire beacon (the lighthouse, re-themed) in the right gap
W.push(`<g><path d="M1052 640V300L1058 132L1064 300V640Z" fill="#1B1233"/><path d="M1040 320h36l-6 10h-24zM1044 250h28l-5 8h-18zM1047 190h22l-4 7h-14z" fill="#24183F"/>
<path d="M1064 300V640" stroke="#FF5E9E" stroke-width="1.2" opacity=".6"/>
<circle cx="1058" cy="132" r="5" fill="#fff"/><circle cx="1058" cy="132" r="26" fill="${glowGrad(C.cyan)}"/>${[195, 254, 324].map(y => `<path d="M1044 ${y}h28" stroke="${C.cyan}" stroke-width="1.5" filter="url(#fGlow)"/>`).join('')}</g>`);
W.push(skyline(5, -30, 1640, 640, 60, 200, '#1C1434', 0.75, 0.24, 1));
// maglev: elevated guideway + train racing alongside (static, glows allowed)
W.push(`<g>
<path d="M-10 452H1610V462H-10Z" fill="#150F29"/><path d="M-10 452H1610" stroke="${C.cyan}" stroke-width="1.2" opacity=".7" filter="url(#fGlow)"/>
${[40, 260, 480, 700, 920, 1140, 1360, 1580].map(x => `<path d="M${x - 7} 462h14l-3 180h-8z" fill="#130D25"/>`).join('')}
<path d="M880 440 L1010 437 L1010 447 L880 449Z" fill="${lg('trail', 0, 0, 1, 0, [[0, C.cyan, 0], [1, '#D8FBFF', 0.75]])}" filter="url(#fB2)"/>
<path d="M1008 450 C1006 436 1014 428 1030 427 H1230 C1262 427 1282 437 1290 450 Z" fill="#E9E6F2"/>
<path d="M1030 427 H1230 C1262 427 1282 437 1290 450 L1286 450 C1276 441 1258 434 1232 434 H1030Z" fill="#FFFFFF"/>
<path d="M1014 437 H1250" stroke="#0E1633" stroke-width="5"/><path d="M1016 437 H1248" stroke="${C.cyan}" stroke-width="3" stroke-dasharray="9 3" filter="url(#fGlow)"/>
<path d="M1010 449 H1288" stroke="${C.mag}" stroke-width="2" filter="url(#fGlow)"/>
<text x="1100" y="447" font-family="${BOLD}" font-weight="bold" font-size="6" fill="#3A3F5C">磁浮 MAGLEV · LINE 7</text>
<circle cx="1283" cy="444" r="2.5" fill="#fff" filter="url(#fGlow)"/></g>`);
// flying-car traffic lanes (far, blurred streaks)
{ const r = rng(21); let s = '<g filter="url(#fB1)">';
  for (const [y0, dir, n] of [[168, 1, 9], [205, -1, 7], [300, 1, 8], [355, -1, 6]]) for (let i = 0; i < n; i++) {
    const x = r() * 1600, y = y0 + (r() - 0.5) * 12, L = 16 + r() * 30, head = dir > 0 ? '#FFF6E0' : C.red;
    s += `<path d="M${f(x)} ${f(y)}h${f(-dir * L)}" stroke="${head}" stroke-width="1.4" opacity=".55" stroke-linecap="round"/><circle cx="${f(x)}" cy="${f(y)}" r="1.7" fill="${head}"/>`;
  } W.push(s + '</g>'); }
// haze between far and mid
W.push(`<rect x="0" y="300" width="1600" height="400" fill="${lg('hz2', 0, 0, 0, 1, [[0, '#5B3F7A', 0], [0.6, '#7A3C82', 0.35], [1, '#3A2458', 0.5]])}"/>`);

// hover car crossing the right gap (flying traffic, closer lane)
W.push(`<g transform="translate(1110 376)"><path d="M40 2L260 -6L260 8Z" fill="${lg('hcT', 0, 0, 1, 0, [[0, C.red, 0.6], [1, C.red, 0]])}" filter="url(#fB2)"/>
<path d="M-38 4C-36 -6 -20 -12 0 -12H22C34 -12 44 -6 46 4L40 10H-32Z" fill="#221A3C"/><path d="M-16 -11C-10 -20 12 -20 20 -11Z" fill="#7EEBFF" opacity=".7"/><path d="M-36 6H44" stroke="${C.mag}" stroke-width="1.6" filter="url(#fGlow)"/>
<path d="M-38 0L-200 -20L-200 28Z" fill="${lg('hcB', 1, 0, 0, 0, [[0, '#FFFFFF', 0], [1, '#FFF6E0', 0.45]])}" filter="url(#fB2)"/><circle cx="-37" cy="1" r="3" fill="#fff" filter="url(#fGlow)"/><circle cx="44" cy="2" r="2.4" fill="${C.red}" filter="url(#fGlow)"/></g>`);
// ---- mid towers with signage
const MID = [];
function tower(x0, x1, top, { seed = 1, side = 16, sideLeft = false, fill = '#191330', winLit = 0.16, cols = 14, rows = 20, ac = true, dim = 1, roof = true }) {
  const r = rng(seed), base = 760; let s = '<g>';
  const gid = uid('tw'); lg(gid, 0, 0, 0, 1, [[0, '#0D0A1D'], [0.55, fill], [1, '#2A1B48']]);
  s += `<rect x="${x0}" y="${top}" width="${x1 - x0}" height="${base - top}" fill="url(#${gid})"/>`;
  const sx = sideLeft ? x0 - side : x1;
  s += `<path d="M${sx} ${top + (sideLeft ? 6 : 0)}h${side}v${base - top}h${-side}Z" fill="${sideLeft ? '#0C0919' : '#2B1D4F'}"/>`;
  s += `<path d="M${sideLeft ? x0 : x1} ${top}V${base}" stroke="${sideLeft ? C.cyan : C.mag}" stroke-width="1.2" opacity=".55"/>`;
  // floor ledges
  let led = '', win = '', lit = { a: '', c: '', m: '' }, acd = '', pipes = '';
  for (let y = top + 18; y < 590; y += rows) led += `M${x0} ${y}H${x1}`;
  for (let y = top + 24; y < 580; y += rows) for (let x = x0 + 8; x < x1 - 10; x += cols) {
    const q = r(); if (q < winLit * dim) { const k = r(); lit[k < 0.6 ? 'a' : k < 0.85 ? 'c' : 'm'] += `M${x} ${y}h${cols - 6}v${rows - 10}h${-(cols - 6)}z`; }
    else win += `M${x} ${y}h${cols - 6}v${rows - 10}h${-(cols - 6)}z`;
    if (ac && r() < 0.07) acd += `M${x - 1} ${y + rows - 10}h${cols - 4}v6h${-(cols - 4)}z`;
  }
  pipes += `M${x0 + 4} ${top + 10}V590M${x1 - 5} ${top + 30}V590`;
  let band = ''; for (let k = 0; k < 3; k++) { if (r() < 0.55 * dim) { const y = top + 24 + Math.floor(r() * ((580 - top) / rows - 1)) * rows; band += `M${x0 + 8} ${y}H${x1 - 8}v${rows - 10}H${x0 + 8}z`; } }
  s += `<path d="${band}" fill="${r() < 0.5 ? '#7EEBFF' : '#FFC98A'}" opacity="${0.22 * dim}"/>`;
  s += `<path d="${win}" fill="#0B0918" opacity=".45"/><path d="${lit.a}" fill="${C.amber}" opacity="${0.55 * dim}"/><path d="${lit.c}" fill="#7EEBFF" opacity="${0.5 * dim}"/><path d="${lit.m}" fill="#FF7DB5" opacity="${0.5 * dim}"/>`;
  s += `<path d="${led}" stroke="#342653" stroke-width="1.4"/><path d="${acd}" fill="#3A3F5C" stroke="#0B0918" stroke-width=".8"/><path d="${pipes}" stroke="#0B0918" stroke-width="2"/>`;
  if (roof) s += `<path d="M${x0 + 12} ${top}v-14h26v14M${x0 + 18} ${top - 14}v-8h14v8M${x1 - 30} ${top}v-30M${x1 - 30} ${top - 30}l-8 -6M${x1 - 30} ${top - 22}h10" stroke="#0E0A1D" stroke-width="2.4" fill="#0E0A1D"/><circle cx="${x1 - 30}" cy="${top - 31}" r="2" fill="${C.red}" filter="url(#fGlow)"/>`;
  return s + '</g>';
}
MID.push(tower(-20, 150, 18, { seed: 31, side: 14, rows: 22, cols: 15 }));
MID.push(tower(150, 335, 138, { seed: 32, side: 12, rows: 20, cols: 14 }));
MID.push(tower(335, 478, 262, { seed: 33, side: 16, rows: 18, cols: 13 }));
MID.push(tower(555, 772, 102, { seed: 34, side: 14, sideLeft: true, rows: 22, cols: 16, dim: 0.55 }));
MID.push(tower(772, 985, 186, { seed: 35, side: 18, rows: 20, cols: 15, dim: 0.45, winLit: 0.12 }));
MID.push(tower(1228, 1412, 58, { seed: 36, side: 14, sideLeft: true, rows: 21, cols: 15 }));
MID.push(tower(1412, 1640, 150, { seed: 37, side: 0, sideLeft: true, rows: 19, cols: 14 }));
// signs on the mid towers
const SG = [];
SG.push(`<g style="mix-blend-mode:screen">${[[118, 250, 90, 160, C.mag, 0.45], [245, 268, 150, 90, C.red, 0.35], [452, 380, 70, 150, C.cyan, 0.5], [665, 175, 150, 80, C.cyan, 0.35], [968, 400, 50, 90, C.mag, 0.4], [1320, 180, 120, 130, C.mag, 0.3], [1320, 326, 110, 60, C.red, 0.4], [1438, 290, 60, 130, C.acid, 0.3], [1536, 430, 90, 40, C.amber, 0.4], [34, 470, 50, 90, C.amber, 0.35]].map(([x, y, rx, ry, c, o]) => blob(x, y, rx, ry, c, o)).join('')}</g>`);
SG.push(bracket(150, 196, 136) + vSign(118, 176, '鱼丸', { size: 34, col: C.mag, sub: 'FISHBALL', subSize: 8 }));
SG.push(vSign(34, 420, 'ラーメン', { size: 20, col: C.amber, sub: 'RAMEN', subSize: 7 }));
// ramen billboard on T2
SG.push(`<g><rect x="164" y="226" width="160" height="84" rx="4" fill="#150E22" stroke="${C.red}" stroke-width="2" filter="url(#fGlow)"/><rect x="164" y="226" width="160" height="84" rx="4" fill="none" stroke="#FFD0D0" stroke-width=".7"/>
<path d="M204 262h52c0 18-10 28-26 28s-26-10-26-28z" fill="none" stroke="${C.amber}" stroke-width="2.4" filter="url(#fGlow)"/><path d="M214 256c4-8-4-12 0-20M230 256c4-8-4-12 0-20M246 256c4-8-4-12 0-20" stroke="#FFFFFF" stroke-width="1.4" fill="none" opacity=".75"/>
<path d="M258 250l30-22M262 254l30-20" stroke="${C.amber}" stroke-width="1.6"/>
${neonText(296, 262, '拉面', { size: 26, col: C.red })}${neonText(296, 296, 'RAMEN', { size: 15, col: C.amber, font: BOLD, weight: 'bold' })}</g>`);
SG.push(vSign(322, 384, '网吧', { size: 18, col: C.cyan, sub: 'NET', subSize: 7 }));
// cyber clinic (cyan key light on the pelican's left)
SG.push(bracket(478, 318, 468) + vSign(452, 296, '义体诊所', { size: 28, col: C.cyan, sub: 'CYBER CLINIC', subSize: 5.6 }));
SG.push(`<g transform="translate(400 520)"><path d="M-10 -3h7v-7h6v7h7v6h-7v7h-6v-7h-7z" fill="${C.cyan}" filter="url(#fGlowL)"/><path d="M-10 -3h7v-7h6v7h7v6h-7v7h-6v-7h-7z" fill="#E6FDFF"/></g>`);
// T4 holo billboard (courier ad) high above the rider
SG.push(`<g><rect x="572" y="126" width="186" height="96" fill="#0B1630" opacity=".7"/><rect x="572" y="126" width="186" height="96" fill="none" stroke="${C.cyan}" stroke-width="1.5" filter="url(#fGlow)"/>
${Array.from({ length: 24 }, (_, i) => `<path d="M572 ${128 + i * 4}h186" stroke="${C.cyan}" stroke-width=".6" opacity=".18"/>`).join('')}
<g transform="translate(610 176)" opacity=".9"><path d="M-20 10c0-18 14-26 26-22l4-8 5 9c8 2 12 8 12 14l30 5-30 4c-6 10-26 12-38 6z" fill="none" stroke="${C.acid}" stroke-width="2" filter="url(#fGlow)"/><circle cx="4" cy="-6" r="1.8" fill="${C.acid}"/></g>
${neonText(705, 168, '鹈鹕外卖', { size: 24, col: C.cyan })}${neonText(705, 190, 'PELICAN EXPRESS', { size: 10.5, col: C.acid, font: BOLD, weight: 'bold', ls: 1 })}
${neonText(705, 208, '30分钟 · 30 MIN OR THE FISH IS FREE', { size: 6, col: C.cyan, font: CN })}</g>`);
// T5 small signs (kept dim: the head reads against dark facade)
SG.push(vSign(968, 360, '酒吧', { size: 18, col: C.mag, sub: 'BAR', subSize: 7 }));
SG.push(`<g opacity=".8"><rect x="790" y="210" width="72" height="18" fill="#12081E"/>${neonText(826, 224, 'HOTEL 旅馆', { size: 10, col: C.amber, font: CN })}</g>`);
// T6 hologram koi billboard + NO PELICANS
SG.push(`<g><rect x="1246" y="96" width="150" height="176" fill="#0A1A36" opacity=".55"/>${Array.from({ length: 44 }, (_, i) => `<path d="M1246 ${98 + i * 4}h150" stroke="${C.cyan}" stroke-width=".7" opacity=".16"/>`).join('')}
<rect x="1246" y="96" width="150" height="176" fill="none" stroke="${C.mag}" stroke-width="1.4" filter="url(#fGlow)"/>
<g transform="translate(1322 180) rotate(-24)" filter="url(#fGlow)" opacity=".95"><path d="M-58 0c20-26 62-30 88-8c-26 22-66 22-88 8z" fill="${C.mag}" opacity=".35"/><path d="M-58 0c20-26 62-30 88-8c-26 22-66 22-88 8z" fill="none" stroke="#FF9CC8" stroke-width="2"/>
<path d="M30 -8l26-20-6 20 6 18z" fill="${C.cyan}" opacity=".6" stroke="#B8F6FF" stroke-width="1.4"/><path d="M-20 -14l10-18 12 16M-16 10l8 14 10-12" fill="none" stroke="#FF9CC8" stroke-width="1.5"/>
<circle cx="-42" cy="-4" r="3" fill="#fff"/>${[[-26, -6], [-10, -2], [6, -8], [-18, 6], [0, 6]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="none" stroke="${C.amber}" stroke-width="1.1" opacity=".8"/>`).join('')}</g>
${neonText(1321, 256, '锦鲤 KOI · 游戏厅 ARCADE', { size: 9.5, col: C.cyan })}</g>`);
SG.push(`<g transform="translate(1320 326)"><rect x="-68" y="-30" width="136" height="62" rx="5" fill="#150712"/><circle cx="-40" cy="1" r="21" fill="none" stroke="${C.red}" stroke-width="4" filter="url(#fGlow)"/>
<path d="M-54 6c4-10 12-12 18-10l2-6h3l1 7 16 3-15 2c-4 8-18 10-25 4z" fill="#FFE3E6"/><path d="M-55 -14l30 30" stroke="${C.red}" stroke-width="4" filter="url(#fGlow)"/><path d="M-55 -14l30 30" stroke="#FFD7DC" stroke-width="1.2"/>
${neonText(20, -2, '禁止鹈鹕', { size: 17, col: C.red })}${neonText(20, 20, 'NO PELICANS', { size: 10, col: '#FF7A88', font: BOLD, weight: 'bold' })}</g>`);
SG.push(vSign(1438, 196, '外卖', { size: 30, col: C.acid, sub: 'DELIVERY', subSize: 6.6 }));
SG.push(`<g><rect x="1480" y="412" width="112" height="34" fill="#140B08" stroke="${C.amber}" stroke-width="1.4" filter="url(#fGlow)"/>${neonText(1536, 437, '当铺 PAWN', { size: 16, col: C.amber, font: CN })}</g>`);
SG.push(vSign(1582, 250, '按摩', { size: 16, col: C.mag, sub: '24H', subSize: 7 }));
// small shop signs scattered over the facades ("full of signs"), avoiding the rider's head zone and big signs
{ const r = rng(61); const words = ['按摩', '旅馆', '药 PHARM', '麻将', '卡拉OK', '寿司', '电玩', '回收', 'OPEN', '修理 REPAIR', '茶', '网咖', 'ロボ', '云 CLOUD', '义眼', 'SOBA', '烧烤', 'BAR', '牙科', 'ホテル', '面', '酒'];
  const cols = [C.mag, C.cyan, C.amber, C.acid, C.red, '#B79CFF'];
  const avoid = [[520, 170, 1000, 580], [690, 170, 1000, 360], [560, 120, 770, 230], [90, 170, 340, 330], [420, 280, 490, 470], [1230, 90, 1410, 370], [1400, 190, 1470, 390], [1470, 400, 1600, 460], [940, 350, 1000, 430], [0, 400, 70, 540], [290, 370, 350, 460], [980, 0, 1240, 600], [470, 0, 560, 600]];
  let placed = 0, tries = 0;
  while (placed < 22 && tries < 600) { tries++;
    const x = 30 + r() * 1480, y = 110 + r() * 440, w = pick(r, words), vert = r() < 0.35 && !/[A-Z]/.test(w), size = 9 + r() * 5;
    const bw = vert ? size + 8 : w.length * size * (/[A-Z]/.test(w) ? 0.7 : 1.05) + 10, bh = vert ? w.length * size * 1.1 + 8 : size + 9;
    if (x + bw > 1570 || avoid.some(([a, b, c, d]) => x + bw > a && x < c && y + bh > b && y < d)) continue;
    avoid.push([x - 6, y - 6, x + bw + 6, y + bh + 6]); placed++;
    const c = pick(r, cols);
    SG.push(blob(x + bw / 2, y + bh / 2, bw, bh * 1.2, c, 0.25) + `<rect x="${f(x)}" y="${f(y)}" width="${f(bw)}" height="${f(bh)}" rx="2" fill="#0B0816" stroke="${c}" stroke-width="1" filter="url(#fGlow)" opacity=".95"/>`);
    if (vert) [...w].forEach((ch, i) => SG.push(neonText(x + bw / 2, y + 4 + size * 0.95 + i * size * 1.1, ch, { size, col: c })));
    else SG.push(neonText(x + bw / 2, y + bh - 5, w, { size, col: c }));
  } }
// cables everywhere (catenaries between towers)
{ const r = rng(41); let d = '';
  const cat = (x0, y0, x1, y1, sag) => { const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + sag; d += `M${f(x0)} ${f(y0)}Q${f(mx)} ${f(my + sag)} ${f(x1)} ${f(y1)}`; };
  for (let i = 0; i < 12; i++) cat(150 + r() * 30, 150 + r() * 260, 335 + r() * 10, 270 + r() * 200, 10 + r() * 20);
  for (let i = 0; i < 8; i++) cat(478, 280 + r() * 250, 555, 150 + r() * 380, 8 + r() * 20);
  for (let i = 0; i < 10; i++) cat(985, 200 + r() * 250, 1228, 120 + r() * 300, 20 + r() * 30);
  for (let i = 0; i < 7; i++) cat(-10, 60 + r() * 120, 150, 20 + r() * 80, 10 + r() * 20);
  MID.push(`<path d="${d}" stroke="#08060F" stroke-width="1.3" fill="none" opacity=".9"/>`); }
// lantern strings across the street (left and right; the rider's zone stays clean)
function lanterns(x0, y0, x1, y1, sag, n, col) {
  let s = `<path d="M${x0} ${y0}Q${(x0 + x1) / 2} ${(y0 + y1) / 2 + sag * 2} ${x1} ${y1}" stroke="#0A0712" stroke-width="1.2" fill="none"/>`;
  for (let i = 1; i < n; i++) { const t = i / n, x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * (x0 + x1) / 2 + t * t * x1, y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * ((y0 + y1) / 2 + sag * 2) + t * t * y1;
    const c = i % 3 === 0 ? C.amber : col;
    s += `<circle cx="${f(x)}" cy="${f(y + 8)}" r="14" fill="${glowGrad(c)}" opacity=".6"/><path d="M${f(x)} ${f(y)}v2" stroke="#0A0712"/><ellipse cx="${f(x)}" cy="${f(y + 8)}" rx="5.5" ry="6.5" fill="${c}"/><ellipse cx="${f(x - 1.5)}" cy="${f(y + 6.5)}" rx="2" ry="3" fill="#FFF2DA" opacity=".8"/><path d="M${f(x - 4)} ${f(y + 2)}h8M${f(x - 4)} ${f(y + 14)}h8M${f(x)} ${f(y + 14)}v4" stroke="#1A0A08" stroke-width="1.2"/>`; }
  return s;
}
SG.push(lanterns(-10, 468, 470, 486, 26, 14, C.red));
SG.push(lanterns(990, 470, 1230, 458, 18, 7, C.red));
SG.push(lanterns(1230, 470, 1610, 440, 24, 11, C.red));

// ---- street level (storefronts at y 580..760)
const ST = [];
ST.push(`<rect x="0" y="380" width="1600" height="260" fill="${lg('fogM', 0, 0, 0, 1, [[0, '#8C3C8E', 0], [0.6, '#B0447E', 0.22], [1, '#FF5E8E', 0.3]])}"/>`);
ST.push(`<g filter="url(#fB12)" opacity=".75">${[[140, 540, 300, 30], [700, 520, 380, 26], [1350, 540, 320, 30], [1060, 560, 200, 24]].map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#C85A9A" opacity=".25"/>`).join('')}</g>`);
// noodle stall (amber) under T1-T3
ST.push(`<g>
<rect x="0" y="600" width="425" height="160" fill="#1A0E14"/>
<rect x="10" y="640" width="400" height="104" fill="${lg('stallIn', 0, 0, 0, 1, [[0, '#FFD08A'], [0.5, '#FF9A4A'], [1, '#7A2E22']])}"/>
<rect x="0" y="600" width="425" height="40" fill="#240C1A"/>
${Array.from({ length: 17 }, (_, i) => `<path d="M${i * 25} 640h25l-4 14h-17z" fill="${i % 2 ? '#C21E5A' : '#2A0C1E'}"/>`).join('')}
<path d="M0 640H425" stroke="${C.mag}" stroke-width="2.2" filter="url(#fGlow)"/>
${neonText(110, 628, '鱼丸 · 拉面', { size: 22, col: C.mag })}${neonText(300, 628, 'FISHBALL NOODLE', { size: 12, col: C.amber, font: BOLD, weight: 'bold' })}
${[40, 90, 140, 290, 340, 385].map((x, i) => `<path d="M${x} 654h34v34h-34z" fill="#EFE3CF" opacity=".92"/><text x="${x + 17}" y="${680}" font-family="${CN}" font-size="18" text-anchor="middle" fill="#2A0C1E">${'鱼丸面汤饭茶'[i]}</text>`).join('')}
<path d="M10 712H410v10H10z" fill="#3A1A18"/><path d="M10 712H410" stroke="#FFD9A0" stroke-width="1.4"/>
${[60, 118, 176, 234].map((x, i) => `<g fill="#1A0A12"><ellipse cx="${x}" cy="${700 - (i % 2) * 3}" rx="12" ry="14"/><circle cx="${x + 2}" cy="${682 - (i % 2) * 3}" r="8"/><path d="M${x - 8} 722h16v20h-3v-16h-10v16h-3z"/></g>`).join('')}
<g fill="#1A0A12"><circle cx="340" cy="668" r="9"/><path d="M324 712c0-26 6-36 16-36s16 10 16 36z"/><path d="M330 662h20l-3-8h-14z" fill="#EFE3CF"/></g>
<path d="M300 700c2-10 16-10 18 0z" fill="#2A1010"/>
</g>`);
ST.push(`<g filter="url(#fB12)" opacity=".7">${[[312, 660], [300, 610], [330, 570], [290, 540], [350, 520]].map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="${26 + i * 6}" ry="${16 + i * 4}" fill="#FFE2C4" opacity="${0.45 - i * 0.06}"/>`).join('')}</g>`);
// convenience store behind the bike (cool light: black frame + orange legs read against it)
ST.push(`<g>
<rect x="430" y="580" width="560" height="180" fill="#120C22"/>
<rect x="430" y="580" width="560" height="34" fill="#0C1428"/>
<path d="M430 614H990" stroke="${C.cyan}" stroke-width="2" filter="url(#fGlow)"/>
${neonText(560, 604, '便利店', { size: 20, col: C.cyan })}${neonText(760, 604, 'NEON MART', { size: 17, col: '#FFFFFF', font: BOLD, weight: 'bold', ls: 2, core: '#fff' })}${neonText(930, 604, '24H', { size: 17, col: C.acid, font: BOLD, weight: 'bold' })}
<rect x="442" y="624" width="536" height="128" fill="${lg('store', 0, 0, 0, 1, [[0, '#9FE9F2'], [0.45, '#5CB6CF'], [1, '#2B3F6A']])}" opacity=".85"/>
${[630, 664, 698].map(y => `<path d="M442 ${y + 28}H978" stroke="#1E2E4E" stroke-width="3"/>` + Array.from({ length: 44 }, (_, i) => `<rect x="${446 + i * 12}" y="${y + 8 + (i * 7 % 5)}" width="8" height="${20 - (i * 7 % 5)}" fill="${['#FF7DB5', '#FFD27A', '#7EEBFF', '#F1FFD0', '#B79CFF'][i % 5]}" opacity=".55"/>`).join('')).join('')}
${[442, 576, 710, 844, 978].map(x => `<path d="M${x} 624V752" stroke="#101A30" stroke-width="5"/>`).join('')}
<path d="M442 752H978" stroke="#0B1020" stroke-width="4"/>
<g fill="#1A2440" opacity=".85"><circle cx="905" cy="668" r="9"/><path d="M890 752v-50c0-18 30-18 30 0v50z"/></g>
<rect x="442" y="624" width="536" height="128" fill="url(#scan)" opacity=".35"/>
</g>`);
// vending machines + robot cat
ST.push(`<g>${[1000, 1058, 1116].map((x, i) => `<g><rect x="${x}" y="622" width="52" height="132" rx="3" fill="#1A1A2E"/><rect x="${x + 4}" y="628" width="44" height="72" fill="${['#DFFBFF', '#FFE0EE', '#F1FFD0'][i]}" opacity=".95"/>
${Array.from({ length: 12 }, (_, k) => `<rect x="${x + 7 + (k % 4) * 10.5}" y="${633 + Math.floor(k / 4) * 22}" width="7" height="15" rx="2" fill="${['#FF2E88', '#19E6FF', '#FFB547', '#6B3FD0'][(k + i) % 4]}"/>`).join('')}
<rect x="${x + 4}" y="706" width="30" height="10" fill="#0B0918"/><rect x="${x + 36}" y="706" width="12" height="16" fill="${C.acid}" opacity=".8"/><rect x="${x + 6}" y="734" width="40" height="12" fill="#0B0918"/>
<rect x="${x - 6}" y="612" width="64" height="150" fill="${glowGrad(i === 1 ? C.mag : C.cyan)}" opacity=".35"/></g>`).join('')}
<text x="1084" y="617" font-family="${CN}" font-size="10" fill="#E6FDFF" text-anchor="middle">自动售货 VENDING</text>
<g transform="translate(1142 622)"><path d="M-14 0c0-14 4-20 14-20s14 6 14 20z" fill="#2A2C44"/><path d="M-10 -18l-2-12 8 7M10 -18l2-12-8 7" fill="#2A2C44"/><circle cx="0" cy="-24" r="10" fill="#2A2C44"/><path d="M-12 -30l2-10 6 8M12 -30l-2-10-6 8" fill="#2A2C44"/>
<path d="M-6 -25h4M3 -25h4" stroke="${C.cyan}" stroke-width="2.4" stroke-linecap="round" filter="url(#fGlow)"/><path d="M-9 -15h18" stroke="${C.mag}" stroke-width="1.6" stroke-dasharray="2 2"/><path d="M13 -2c10 0 12-10 8-16" stroke="#2A2C44" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M0 -34v-8" stroke="#2A2C44"/><circle cx="0" cy="-43" r="1.6" fill="${C.acid}"/></g>
</g>`);
// clinic shopfront + shutter
ST.push(`<g><rect x="1225" y="590" width="385" height="170" fill="#0E0B1E"/>
<rect x="1240" y="630" width="170" height="122" fill="${lg('clin', 0, 0, 0, 1, [[0, '#BDFBFF'], [1, '#2C7F9E']])}" opacity=".8"/>
<path d="M1240 690h170M1325 630v122" stroke="#0E2A3E" stroke-width="3"/><path d="M1270 660h30M1285 645v30" stroke="#0E3A4E" stroke-width="6"/>
<rect x="1240" y="598" width="170" height="26" fill="#07161E"/>${neonText(1325, 618, '义体诊所 CYBER CLINIC', { size: 13, col: C.cyan })}
<rect x="1425" y="620" width="180" height="140" fill="#2A2640"/>${Array.from({ length: 20 }, (_, i) => `<path d="M1425 ${624 + i * 7}h180" stroke="#15122A" stroke-width="2"/>`).join('')}
<path d="M1440 690c14-26 40-10 30 8s26 22 40-6M1520 660l24 26M1548 664l-26 20" stroke="${C.acid}" stroke-width="3" fill="none" opacity=".75"/><text x="1515" y="740" font-family="${BOLD}" font-weight="bold" font-size="15" fill="${C.mag}" opacity=".85" text-anchor="middle">GULP!</text>
</g>`);
// sidewalk + curb
ST.push(`<rect x="0" y="752" width="1600" height="12" fill="#1C1532"/><path d="M0 752H1600" stroke="#5B3F7A" stroke-width="1.2"/><path d="M0 764H1600" stroke="#FF6FA8" stroke-width="1.5" opacity=".55"/>`);
// street props: lamp posts, holo-marker, bollards, steam vent, people with LED umbrellas
function lamp(x) { return `<g><path d="M${x} 760V470" stroke="#0B0918" stroke-width="6"/><path d="M${x} 480q0-16 30-16h14" stroke="#0B0918" stroke-width="4" fill="none"/><rect x="${x + 36}" y="460" width="24" height="7" rx="2" fill="#0B0918"/>
<ellipse cx="${x + 48}" cy="470" rx="11" ry="3" fill="#FFF1D8"/><circle cx="${x + 48}" cy="476" r="40" fill="${glowGrad(C.amber)}" opacity=".6"/>
<path d="M${x - 8} 560h16v44h-16z" fill="#0B0918"/>${neonText(x, 590, '鹈', { size: 11, col: C.mag })}</g>`; }
ST.push(`<g filter="url(#fB5)" style="mix-blend-mode:screen"><path d="M1248 474L1200 760H1330L1272 474Z" fill="${lg('lc1', 0, 0, 0, 1, [[0, C.amber, 0.35], [1, C.amber, 0.02]])}"/><path d="M54 474L10 760H130L78 474Z" fill="url(#lc1)"/><path d="M0 654L-10 760H430L420 654Z" fill="${lg('lc2', 0, 0, 0, 1, [[0, C.amber, 0.3], [1, C.amber, 0]])}"/></g>`);
ST.push(lamp(1212));
ST.push(lamp(18));
function person(x, base, s, col, walk = 1) {
  const u = `<g transform="translate(${x} ${base}) scale(${s})">
  <path d="M-9 0l3-40h12l3 40h-5l-3-30-2 30z" fill="#0B0918"/><path d="M-12 -40c0-26 4-36 12-36s12 10 12 36z" fill="#120E20"/><circle cx="0" cy="-82" r="7" fill="#120E20"/>
  <path d="M8 -60l6 -26" stroke="#120E20" stroke-width="3"/><path d="M14 -86V-110" stroke="#9AA0C0" stroke-width="1.4"/>
  <path d="M-30 -104c6-24 64-24 70 0z" fill="${col}" opacity=".28"/><path d="M-30 -104c6-24 64-24 70 0" fill="none" stroke="${col}" stroke-width="2.2"/>
  ${[-18, -4, 12, 28].map(k => `<path d="M${5} -120L${k} -104" stroke="${col}" stroke-width="1.4" opacity=".9"/>`).join('')}<circle cx="5" cy="-121" r="1.6" fill="#fff"/></g>`;
  return `<g filter="url(#fGlow)">${u}</g>`;
}
ST.push(person(1300, 760, 0.95, C.cyan));
ST.push(person(1372, 762, 0.82, C.mag));
ST.push(person(1540, 762, 1.05, C.acid));
ST.push(person(250, 760, 0.8, C.cyan));
// holo-marker (the km stone)
ST.push(`<g><path d="M1176 760v-28h20v28z" fill="#1A1630"/><path d="M1176 732h20" stroke="${C.cyan}" stroke-width="1.5"/>
<path d="M1170 726l16 -10 16 10" fill="${C.cyan}" opacity=".2"/><rect x="1158" y="672" width="56" height="42" fill="${C.cyan}" opacity=".14"/>
<rect x="1158" y="672" width="56" height="42" fill="none" stroke="${C.cyan}" stroke-width="1" filter="url(#fGlow)"/>
${neonText(1186, 690, 'KM 00.3', { size: 10, col: C.cyan, font: MONO })}${neonText(1186, 706, '鹈鹕湾', { size: 9, col: C.cyan })}</g>`);
ST.push(`<g fill="#0B0918">${[1238, 1290, 1560].map(x => `<rect x="${x}" y="736" width="9" height="24" rx="2"/><rect x="${x}" y="740" width="9" height="3" fill="${C.acid}"/>`).join('')}</g>`);

// ---- road (wet asphalt) with reflections
const ROAD = [];
ROAD.push(`<rect x="0" y="764" width="1600" height="136" fill="${lg('road', 0, 0, 0, 1, [[0, '#1A1230'], [0.4, '#0E0A1C'], [1, '#07060F']])}"/>`);
// mirrored world (reflection) clipped to the road
DEFS.push(`<clipPath id="roadClip"><rect x="0" y="764" width="1600" height="136"/></clipPath><clipPath id="riderReflClip"><rect x="0" y="790" width="1600" height="110"/></clipPath>
<mask id="ripple"><rect x="0" y="764" width="1600" height="136" fill="${lg('rfade', 0, 0, 0, 1, [[0, '#fff', 0.85], [0.5, '#fff', 0.5], [1, '#fff', 0.25]])}"/>${(() => { const r = rng(55); let d = ''; for (let i = 0; i < 90; i++) { const y = 766 + r() * 134, x = r() * 1600, w = 40 + r() * 260; d += `M${f(x)} ${f(y)}h${f(w)}`; } return `<path d="${d}" stroke="#000" stroke-width="1.6" opacity=".7"/>`; })()}</mask>`);
ROAD.push(`<g clip-path="url(#roadClip)" mask="url(#ripple)"><g filter="url(#fRefl)" opacity=".75"><use href="#midStreet" transform="translate(0 1528) scale(1 -1)"/></g></g>`);
{ const r = rng(71); let d = ''; for (let i = 0; i < 1400; i++) { d += `M${f(r() * 1600)} ${f(766 + r() * 134)}h.01`; } ROAD.push(`<path d="${d}" stroke="#3A2F5C" stroke-width="1.4" stroke-linecap="round" opacity=".5"/>`); }
ROAD.push(`<rect x="0" y="764" width="1600" height="40" fill="${lg('sheen', 0, 0, 0, 1, [[0, '#FF7DB5', 0.28], [1, '#FF7DB5', 0]])}"/>`);
ROAD.push(`<g transform="translate(420 830) scale(1 .28)"><circle r="40" fill="#1A1430" stroke="#3A3F5C" stroke-width="4"/><path d="M-30 -10H30M-34 4H34M-28 18H28M-26 -24H26" stroke="#2A2548" stroke-width="4"/></g>`);
// neon streak reflections under the brightest signs (vertical smears on the wet asphalt)
ROAD.push(`<g filter="url(#fB5)" style="mix-blend-mode:screen">${[[118, 14, C.mag], [245, 30, C.red], [300, 60, C.amber], [452, 12, C.cyan], [968, 10, C.mag], [1084, 70, C.cyan], [1212, 14, C.amber], [1325, 60, C.cyan], [1438, 14, C.acid], [1536, 40, C.amber], [18, 12, C.amber], [1120, 26, C.mag]].map(([x, w, c], i) => { const id = uid('st'); lg(id, 0, 0, 0, 1, [[0, c, 0.55], [0.5, c, 0.22], [1, c, 0]]); return `<rect x="${x - w / 2}" y="766" width="${w}" height="${110 + (i * 37) % 30}" fill="url(#${id})"/>`; }).join('')}</g>`);
// lane markings: bike lane stripe + painted symbol (squashed perspective)
ROAD.push(`<g opacity=".7"><path d="M0 872H1600" stroke="${C.cyan}" stroke-width="3" stroke-dasharray="60 30" opacity=".35"/>
<g transform="translate(1260 842) scale(1 .32)"><circle cx="-26" cy="0" r="16" fill="none" stroke="#9FEFFF" stroke-width="4"/><circle cx="26" cy="0" r="16" fill="none" stroke="#9FEFFF" stroke-width="4"/><path d="M-26 0l14-24h24l14 24M-12 -24l12 24" fill="none" stroke="#9FEFFF" stroke-width="4"/>
<text x="0" y="60" font-family="${CN}" font-size="34" fill="#9FEFFF" text-anchor="middle">自行车道 BIKE</text></g>
<g transform="translate(250 850) scale(1 .3)"><text x="0" y="0" font-family="${CN}" font-size="60" fill="#E9E6F2" text-anchor="middle" opacity=".5">慢 SLOW</text></g></g>`);
// puddles (sharper mirror)
DEFS.push(`<clipPath id="pud"><ellipse cx="1040" cy="822" rx="150" ry="14"/><ellipse cx="300" cy="808" rx="120" ry="10"/><ellipse cx="1420" cy="858" rx="170" ry="16"/><ellipse cx="560" cy="872" rx="110" ry="9"/></clipPath>`);
ROAD.push(`<g clip-path="url(#pud)"><rect x="0" y="760" width="1600" height="140" fill="#0A0716"/><g filter="url(#fReflS)" opacity=".9"><use href="#midStreet" transform="translate(0 1528) scale(1 -1)"/></g></g>`);
ROAD.push(`<g fill="none" stroke="#FFFFFF" stroke-width=".8" opacity=".25"><ellipse cx="1040" cy="822" rx="150" ry="14"/><ellipse cx="300" cy="808" rx="120" ry="10"/><ellipse cx="1420" cy="858" rx="170" ry="16"/><ellipse cx="560" cy="872" rx="110" ry="9"/></g>`);
// steam vent
ROAD.push(`<g><rect x="1140" y="796" width="54" height="7" rx="2" fill="#1C1830"/><path d="M1144 799h46" stroke="#0B0918" stroke-dasharray="3 2" stroke-width="3"/>
<g filter="url(#fB12)" opacity=".6">${[[1167, 780, 24], [1160, 740, 34], [1175, 690, 44], [1162, 640, 50]].map(([x, y, r], i) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.7}" fill="${i < 2 ? '#FFD7EA' : '#C9B8FF'}" opacity="${0.5 - i * 0.1}"/>`).join('')}</g></g>`);

// ============================================================================================ RIDER
const R = [];      // rider markup in rider-local coords, back -> front
const FAR = { plume: '#8C85AE', shade: '#6A6390', jacket: '#100E1E', flight: '#0B0A12', feet: '#A8602E', web: '#B8703E' };

// ---------------- wing parts
function wingUpper(far) {
  const r = J[far ? 'wingFarUpper' : 'wingNearUpper'].rot;
  const d = smooth([[-16, -20], [20, -21], [58, -17], [84, -13], [90, 0], [84, 13], [58, 17], [20, 20], [-16, 18], [-24, 0]]);
  const extra = far ? '' : `<path d="${smooth([[-10, -14], [30, -15], [70, -11], [80, -8]], false)}" stroke="${C.jacketHi}" stroke-width="3" fill="none" opacity=".8"/>
    <path d="M-6 12Q36 16 76 10" stroke="${C.mag}" stroke-width="1.4" fill="none" opacity=".9"/><path d="M40 -18q-4 18 2 36" stroke="${C.jacketLo}" stroke-width="1.2" fill="none"/>
    <g transform="translate(26 0) rotate(${f(-r)})"><rect x="-13" y="-8" width="26" height="15" rx="2" fill="#0E0C18" stroke="${C.mag}" stroke-width="1"/><text x="0" y="3.5" font-family="${CN}" font-size="10" fill="#FFE3F0" text-anchor="middle">鹈鹕</text></g>`;
  let s = rimFill(d, { base: far ? FAR.jacket : C.jacket, rot: r, extra, cy: far ? '#2A6F8A' : C.cyan, mg: far ? '#7A2E60' : C.mag });
  // ribbed cuff at the elbow
  s += `<path d="M70 -15h16v30h-16z" fill="url(#rib)" opacity="${far ? 0.5 : 1}"/><path d="M70 -15h16v30h-16z" fill="none" stroke="${C.ink}" stroke-width="1.1"/>`;
  return s;
}
function wingLower(far) {
  const r = J[far ? 'wingFarLower' : 'wingNearLower'].rot;
  const pl = far ? FAR.plume : C.plume, fl = far ? FAR.flight : C.flight;
  // black secondaries trailing under/back
  let fe = '';
  for (let i = 0; i < 7; i++) { const x = 4 + i * 10; fe += `<path d="${smooth([[x, 4], [x + 9, 6], [x - 4 + i * 0.5, 30 - i * 1.8], [x - 10, 26 - i * 1.6]])}" fill="${fl}" stroke="${far ? '#050409' : C.flightSheen}" stroke-width=".8"/>`; }
  let s = fe;
  const cov = smooth([[0, -12], [30, -12], [62, -9], [78, -5], [80, 4], [60, 10], [28, 12], [2, 10], [-6, 0]]);
  const sc = far ? '' : [...Array(6)].map((_, i) => `<path d="M${8 + i * 11} -6q5 5 0 12" stroke="${C.plumeShade}" stroke-width="1" fill="none"/>`).join('');
  s += rimFill(cov, { base: pl, rot: r, extra: sc, cy: far ? '#3E7C98' : C.cyan, mg: far ? '#8A3A70' : C.mag });
  s += `<path d="M-4 -14h12v28h-12z" fill="url(#rib)" opacity="${far ? 0.5 : 1}"/><path d="M-4 -14h12v28h-12z" fill="none" stroke="${C.ink}" stroke-width="1.1"/>`;
  if (!far) s += `<path d="M-4 -12h12" stroke="${C.mag}" stroke-width="1.2"/>`;
  return s;
}
function wingHand(far) {
  const fl = far ? FAR.flight : C.flight;
  // primaries: a fist of black feathers wrapped around the grip (grip at origin, r = 6)
  let s = '';
  for (let i = 0; i < 4; i++) { const a = -40 + i * 26; const tip = rot([30 - i * 3, 0], a + 60); s += `<path d="${smooth([rot([-6, -8], a), rot([4, -10], a), add(tip, [2, 0]), tip, rot([2, 6], a)])}" fill="${fl}" stroke="${far ? '#050409' : C.flightSheen}" stroke-width=".9"/>`; }
  s += `<path d="${smooth([[-12, -6], [-2, -11], [9, -8], [11, 2], [4, 9], [-8, 8]])}" fill="${fl}" stroke="${far ? '#050409' : '#4B4670'}" stroke-width="1"/>`;
  if (!far) s += `<path d="M-6 -9q8 -4 15 2" stroke="${C.mag}" stroke-width="1.4" fill="none"/><path d="M-11 4q2 5 8 5" stroke="${C.cyan}" stroke-width="1.2" fill="none"/>`;
  return s;
}
// ---------------- leg parts
function thigh(far) {
  const r = J[far ? 'thighFar' : 'thighNear'].rot;
  const d = smooth([[-16, -16], [20, -20], [70, -15], [128, -10], [150, -4], [150, 7], [128, 11], [70, 17], [20, 20], [-16, 16], [-24, 0]]);
  const sc = far ? '' : [...Array(9)].map((_, i) => `<path d="M${10 + i * 14} ${-12 + i * 0.6}q6 ${8 - i * 0.4} 0 ${22 - i * 1.2}" stroke="${C.plumeShade}" stroke-width="1.1" fill="none"/>`).join('');
  const vol = `<path d="M-10 18Q60 20 146 8" stroke="${far ? FAR.shade : C.plumeShade}" stroke-width="12" fill="none" opacity=".55"/>`;
  return rimFill(d, { base: far ? FAR.plume : C.plume, rot: r, extra: vol + sc, cy: far ? '#3E7C98' : C.cyan, mg: far ? '#8A3A70' : C.mag });
}
function shank(far) {
  const r = J[far ? 'shankFar' : 'shankNear'].rot;
  const d = smooth([[-4, -7], [30, -6.5], [100, -5], [132, -5.5], [138, 0], [132, 5.5], [100, 5], [30, 6.5], [-4, 7], [-8, 0]]);
  const sc = [...Array(13)].map((_, i) => `M${12 + i * 9} -5v10`).join('');
  return rimFill(d, { base: far ? FAR.feet : C.feet, rot: r, cy: far ? '#3E7C98' : C.cyan, mg: far ? '#8A3A70' : '#FF5E9E', a: [2.4, 0], b: [-2.2, 1],
    extra: `<path d="${sc}" stroke="${far ? '#7A401C' : '#B8561E'}" stroke-width=".8" opacity=".7"/>` });
}
function foot(far) {
  const r = J[far ? 'footFar' : 'footNear'].rot;
  const ft = far ? FAR.feet : C.feet, wb = far ? FAR.web : C.web;
  let s = '';
  // webbed toes reaching over the pedal (ball at 17,9), toes to x 48
  s += `<path d="${smooth([[14, 1], [32, 2], [52, 8], [54, 14], [42, 16], [24, 15], [12, 12]])}" fill="${wb}" opacity=".95" stroke="${C.ink}" stroke-width="1"/>`;
  s += `<path d="M14 6Q34 7 53 12M14 9Q30 12 46 15M14 3Q32 2 50 7" stroke="${ft}" stroke-width="3.4" fill="none" stroke-linecap="round"/><path d="M14 6Q34 7 50 12M14 9Q30 11 44 14M14 4Q30 3 46 8" stroke="${C.ink}" stroke-width=".7" fill="none" opacity=".6"/>`;
  s += `<path d="M52 11l4 3-3 1zM45 15l4 2-3 1zM49 6l4 2-3 1z" fill="#1A1420"/>` + (far ? "" : `<path d="M20 2Q36 1 52 7" stroke="${C.mag}" stroke-width="1" fill="none"/>`);
  // high-top sneaker wrap over the ankle and heel
  const sh = smooth([[-10, -16], [8, -17], [16, -8], [22, 4], [22, 12], [4, 14], [-10, 12], [-14, 0]]);
  s += rimFill(sh, { base: far ? '#0D0B16' : '#1A1730', rot: r, cy: far ? '#2A6F8A' : C.cyan, mg: far ? '#7A2E60' : C.mag, a: [2, 0], b: [-2, 1.4],
    extra: far ? '' : `<path d="M-8 -4l6 -3 6 3 6 -3" stroke="#E9E6F2" stroke-width="1.5" fill="none"/>` });
  s += `<path d="M-12 11H22" stroke="${far ? '#7A2E60' : C.mag}" stroke-width="3"/>`;
  if (!far) s += `<path d="M-12 11H22" stroke="#FFD3E7" stroke-width=".9"/>` + [0, 5, 10].map(x => `<circle cx="${x + 2}" cy="-11" r="1.2" fill="${C.cyan}"/>`).join('');
  return s;
}
// ---------------- bike parts
function pedal(far) {
  return `<rect x="-14" y="-3.5" width="28" height="7" rx="2" fill="${far ? '#0D0B14' : '#22202E'}" stroke="${C.ink}" stroke-width="1"/><path d="M-12 -3.5h24" stroke="${far ? '#3A3F5C' : '#8A90B0'}" stroke-width="1"/>
  <rect x="-14" y="-1.5" width="4" height="3" fill="${far ? '#6A4A1A' : C.amber}"/><rect x="10" y="-1.5" width="4" height="3" fill="${far ? '#6A4A1A' : C.amber}"/>`;
}
function crankArm(far) {
  // arm along +x from BB to pedal (50)
  return `<path d="M-2 -5.5L50 -3.8Q55 0 50 3.8L-2 5.5Z" fill="${far ? '#1A1826' : chromeG}" stroke="${C.ink}" stroke-width="1"/><circle cx="50" cy="0" r="4" fill="${far ? '#20202E' : '#4A4F70'}" stroke="${C.ink}" stroke-width=".8"/>` + (far ? '' : `<path d="M4 -3.5L46 -2.6" stroke="#FFFFFF" stroke-width="1" opacity=".7"/>`);
}
function wheel(front) {
  const col = front ? C.cyan : C.mag, core = front ? C.cyanCore : C.magCore, col2 = front ? C.mag : C.cyan;
  let s = '';
  // light-trail wedges (speed) on the spokes
  for (let i = 0; i < 6; i++) { const a0 = i * 60 + (front ? 12 : 30), a1 = a0 + 34; const p = rr => `M${pt(rot([rr, 0], a0))}A${rr} ${rr} 0 0 1 ${pt(rot([rr, 0], a1))}`; s += `<path d="${p(62)}" stroke="${col}" stroke-width="16" fill="none" opacity=".08"/><path d="${p(78)}" stroke="${col}" stroke-width="1.4" fill="none" opacity=".55"/><path d="${p(46)}" stroke="${col2}" stroke-width="1" fill="none" opacity=".35"/>`; }
  // 32 spokes, 3-cross
  let sp = '';
  for (let i = 0; i < 32; i++) { const a = i * 11.25, side = i % 2 ? 1 : -1; const h0 = rot([11, 0], a), rim = rot([88, 0], a + side * 56); sp += `M${pt(h0)}L${pt(rim)}`; }
  s += `<path d="${sp}" stroke="#A7AED0" stroke-width=".75" opacity=".75"/>`;
  // tyre + wet sheen + tread
  s += `<circle r="95.5" fill="none" stroke="#0C0A14" stroke-width="9.5"/><circle r="99.4" fill="none" stroke="#2A2740" stroke-width="1.2" stroke-dasharray="2 3"/>`;
  s += `<path d="M${pt(rot([99.5, 0], 150))}A99.5 99.5 0 0 1 ${pt(rot([99.5, 0], 250))}" stroke="${C.cyan}" stroke-width="1.6" fill="none" opacity=".7"/><path d="M${pt(rot([99.5, 0], 280))}A99.5 99.5 0 0 1 ${pt(rot([99.5, 0], 20))}" stroke="${C.mag}" stroke-width="1.8" fill="none" opacity=".8"/>`;
  s += `<text font-family="${BOLD}" font-weight="bold" font-size="5" fill="#6A6F90" letter-spacing="1"><textPath href="#tyreTxt">NEON·700×32C · 霓虹</textPath></text>`;
  // glowing rim (stacked strokes, no filters)
  s += `<circle r="89.5" fill="none" stroke="${col}" stroke-width="14" opacity=".1"/><circle r="89.5" fill="none" stroke="${col}" stroke-width="6" opacity=".35"/><circle r="89.5" fill="none" stroke="${col}" stroke-width="2.8"/><circle r="89.5" fill="none" stroke="${core}" stroke-width="1.1"/><circle r="86.2" fill="none" stroke="${col2}" stroke-width=".7" opacity=".7"/>`;
  // valve + reflector
  s += `<g transform="rotate(${front ? 232 : 118})"><rect x="78" y="-1.6" width="9" height="3.2" fill="${chromeH}"/></g><g transform="rotate(${front ? 30 : 300})"><rect x="54" y="-2.5" width="12" height="5" rx="1" fill="${C.amber}" opacity=".9"/></g>`;
  // hub
  s += `<circle r="12" fill="none" stroke="#5A607E" stroke-width="2"/><circle r="7" fill="${chromeG}" stroke="${C.ink}" stroke-width="1"/><circle r="2.4" fill="#1A1826"/><path d="M-4 -4l8 8" stroke="${col}" stroke-width="1" opacity=".8"/>`;
  return s;
}
DEFS.push(`<path id="tyreTxt" d="M-92 0A92 92 0 1 1 92 0A92 92 0 1 1 -92 0"/>`);
function cog() { let d = ''; for (let i = 0; i < 16; i++) { const a = i * 22.5; d += (i ? 'L' : 'M') + pt(rot([9.2, 0], a - 6)) + 'L' + pt(rot([10.8, 0], a - 3)) + 'L' + pt(rot([10.8, 0], a + 3)) + 'L' + pt(rot([9.2, 0], a + 6)); } return `<path d="${d}Z" fill="${chromeG}" stroke="${C.ink}" stroke-width=".7"/><circle r="5" fill="#2A2E48"/>`; }
function chainring() {
  let d = ''; for (let i = 0; i < 48; i++) { const a = i * 7.5; d += (i ? 'L' : 'M') + pt(rot([28.4, 0], a - 2.4)) + 'L' + pt(rot([30.2, 0], a - 1)) + 'L' + pt(rot([30.2, 0], a + 1)) + 'L' + pt(rot([28.4, 0], a + 2.4)); }
  let s = `<path d="${d}Z" fill="#6C7396" stroke="${C.ink}" stroke-width=".7"/><circle r="27" fill="#1A1826"/><circle r="25.5" fill="none" stroke="${C.mag}" stroke-width="1.2"/><circle r="25.5" fill="none" stroke="${C.mag}" stroke-width="5" opacity=".18"/>`;
  let sp = ''; for (let i = 0; i < 5; i++) { const a = i * 72 - 18; sp += `M${pt(rot([4, -4], a))}L${pt(rot([24, -4], a))}L${pt(rot([24, 4], a))}L${pt(rot([4, 4], a))}Z`; }
  s += `<path d="${sp}" fill="${chromeG}" stroke="${C.ink}" stroke-width=".7"/>` + [...Array(5)].map((_, i) => `<circle cx="${f(rot([21, 0], i * 72 - 18)[0])}" cy="${f(rot([21, 0], i * 72 - 18)[1])}" r="1.6" fill="#1A1826"/>`).join('') + `<circle r="7" fill="${chromeG}" stroke="${C.ink}" stroke-width=".8"/>`;
  return s;
}
function tube(a, b, w, { led = null, glow = null, hi = true } = {}) {
  const n = perp(norm(sub(b, a))); const up = n[1] < 0 ? n : mul(n, -1);
  let s = `<path d="M${pt(a)}L${pt(b)}" stroke="${C.ink}" stroke-width="${w + 2.6}" stroke-linecap="round"/><path d="M${pt(a)}L${pt(b)}" stroke="url(#carbon)" stroke-width="${w}" stroke-linecap="round"/>`;
  if (hi) s += `<path d="M${pt(add(a, mul(up, w * 0.3)))}L${pt(add(b, mul(up, w * 0.3)))}" stroke="${C.frameHi}" stroke-width="${Math.max(1, w * 0.18)}" stroke-linecap="round" opacity=".8"/>`;
  if (glow) { const o = mul(up, -w * 0.42); s += neonStroke(`M${pt(add(a, o))}L${pt(add(b, o))}`, glow, C.magCore, 1.1, 0.95); }
  if (led) { const o = mul(up, w * 0.36); s += neonStroke(`M${pt(add(lerp2(a, b, 0.06), o))}L${pt(add(lerp2(a, b, 0.94), o))}`, led, C.cyanCore, 1.1); }
  return s;
}
// frame geometry (rig-spec §1)
const BB = BIKE.bb, RH = BIKE.rearHub, FH = BIKE.frontHub, STT = BIKE.seatTubeTop, HT0 = BIKE.headTop, HT1 = BIKE.headBottom;
const htAt = s => lerp2(HT0, HT1, s);
function frame() {
  let s = '';
  // rear rack + courier whip antenna + tail light
  s += `<path d="M-40 -214L-156 -208M-150 -208L-127 -104M-108 -208L-124 -104" stroke="#2A2838" stroke-width="3" fill="none"/><path d="M-40 -214L-156 -208" stroke="#5A607E" stroke-width="1" />`;
  s += `<path d="M-156 -209L-186 -318" stroke="#3A3F5C" stroke-width="1.6"/><path d="M-186 -318l-30 8 30 10z" fill="${C.mag}" opacity=".85"/><path d="M-186 -318l-30 8 30 10z" fill="none" stroke="${C.magCore}" stroke-width=".8"/><text x="-196" y="-305" font-family="${CN}" font-size="7" fill="#fff" text-anchor="middle" transform="rotate(-2 -196 -307)">外卖</text><circle cx="-186" cy="-319" r="2" fill="#fff"/><circle cx="-186" cy="-319" r="8" fill="${glowGrad(C.mag)}"/>`;
  s += `<rect x="-166" y="-212" width="12" height="8" rx="2" fill="#2A0A14"/>` + neonStroke('M-164 -208h8', C.red, '#FFD0D6', 2);
  // stays
  s += tube(add(STT, [4, 12]), RH, 6);
  s += tube(BB, RH, 7, { glow: C.mag });
  // seat tube, top tube, down tube, head tube
  s += tube(BB, STT, 11);
  s += tube(add(STT, [2, 8]), htAt(0.18), 10, { led: C.cyan });
  s += tube(htAt(0.8), add(BB, [5, -6]), 13, { glow: C.mag });
  s += `<path d="M${pt(HT0)}L${pt(HT1)}" stroke="${C.ink}" stroke-width="17" stroke-linecap="round"/><path d="M${pt(HT0)}L${pt(HT1)}" stroke="url(#carbon)" stroke-width="14"/><path d="M${pt(add(HT0, [-4, 0]))}L${pt(add(HT1, [-4, 0]))}" stroke="${C.frameHi}" stroke-width="2"/>`;
  s += `<path d="M${pt(add(HT0, [-6, 0]))}l12 0M${pt(add(HT1, [-6, 1]))}l13 0" stroke="${chromeH}" stroke-width="4"/>`;
  // head badge: tiny pelican glyph in cyan
  const hb = htAt(0.5); s += `<circle cx="${f(hb[0] + 1)}" cy="${f(hb[1])}" r="4.2" fill="#0A0716" stroke="${C.cyan}" stroke-width="1"/><path d="M${f(hb[0] - 1)} ${f(hb[1] + 1)}l5 -1" stroke="${C.cyan}" stroke-width="1.2"/>`;
  // down-tube lettering
  const dt0 = htAt(0.8), dtA = Math.atan2(BB[1] - 6 - dt0[1], BB[0] + 5 - dt0[0]) / D2R + 180;
  s += `<text transform="translate(38 -120) rotate(${f(dtA)})" font-family="${BOLD}" font-weight="bold" font-size="7.5" fill="${C.mag}" letter-spacing="1.5" text-anchor="middle" dy="2.6">NEON·7</text>`;
  // energy can in a cage on the down tube
  s += `<g transform="translate(70 -150) rotate(${f(dtA - 180)})"><rect x="-17" y="-14" width="34" height="11" rx="3" fill="${C.acid}"/><rect x="-17" y="-14" width="34" height="11" rx="3" fill="none" stroke="${C.ink}" stroke-width="1"/><text x="0" y="-5.6" font-family="${CN}" font-size="7" text-anchor="middle" fill="#0A0716">能量 ENERGY</text><path d="M-14 -3h28" stroke="#1A1826" stroke-width="1.6"/></g>`;
  // lugs + BB shell
  s += `<circle cx="${BB[0]}" cy="${BB[1]}" r="10" fill="#1A1826" stroke="${C.ink}" stroke-width="1.2"/><circle cx="${STT[0]}" cy="${STT[1]}" r="6" fill="#2A2E48" stroke="${C.ink}" stroke-width="1"/>`;
  // cables
  s += `<path d="M${pt(add(HT0, [-2, -8]))}Q88 -250 60 -232T-30 -220" stroke="#5A607E" stroke-width="1.2" fill="none"/><path d="M120 -226Q96 -186 60 -148T8 -92" stroke="#5A607E" stroke-width="1" fill="none"/>`;
  // seat post + saddle
  s += `<path d="M${pt(STT)}L${pt(BIKE.seatClamp)}" stroke="${C.ink}" stroke-width="7.5"/><path d="M${pt(STT)}L${pt(BIKE.seatClamp)}" stroke="${chromeH}" stroke-width="5.2"/>`;
  s += `<path d="M-84 -283L-60.5 -278L-40 -283" stroke="#5A607E" stroke-width="2" fill="none"/>`;
  s += `<path d="${smooth([[-102, -289], [-92, -293.5], [-62, -292.5], [-36, -289.5], [-23, -286.5], [-26, -282], [-48, -281], [-78, -281.5], [-99, -283.5]])}" fill="#16131F" stroke="${C.ink}" stroke-width="1.2"/><path d="M-96 -287Q-60 -290 -28 -285" stroke="${C.mag}" stroke-width=".9" stroke-dasharray="2 1.5" fill="none"/>`;
  return s;
}
function fork() {
  const crown = HT1, axisEnd = add(HT1, mul(norm(sub(HT1, HT0)), BIKE.forkLen));
  let s = `<path d="M${pt(add(crown, [-2, 2]))}L${pt(lerp2(crown, axisEnd, 0.62))}Q${pt(add(axisEnd, [2, 3]))} ${pt(FH)}" stroke="${C.ink}" stroke-width="10" fill="none" stroke-linecap="round"/>
  <path d="M${pt(add(crown, [-2, 2]))}L${pt(lerp2(crown, axisEnd, 0.62))}Q${pt(add(axisEnd, [2, 3]))} ${pt(FH)}" stroke="url(#carbon)" stroke-width="7" fill="none" stroke-linecap="round"/>
  <path d="M${pt(add(crown, [-4, 4]))}L${pt(add(lerp2(crown, axisEnd, 0.62), [-2.4, 0]))}" stroke="${C.cyan}" stroke-width="1.2" opacity=".85"/>`;
  s += `<rect x="${f(crown[0] - 9)}" y="${f(crown[1] - 2)}" width="18" height="7" rx="2" fill="#1A1826" stroke="${C.ink}"/>`;
  // front rack for the delivery box
  s += `<path d="M146 -226L${pt(add(FH, [-2, -4]))}M214 -226L${pt(add(FH, [3, -4]))}M140 -226H224M${pt(add(crown, [4, 4]))}L148 -226" stroke="#3A3F5C" stroke-width="2.4" fill="none"/>`;
  // headlamp
  s += `<rect x="${BIKE.lamp[0] - 10}" y="${BIKE.lamp[1] - 6}" width="18" height="12" rx="4" fill="#1A1826" stroke="${C.ink}"/><circle cx="${BIKE.lamp[0] + 7}" cy="${BIKE.lamp[1]}" r="5" fill="#E6FDFF"/><circle cx="${BIKE.lamp[0] + 7}" cy="${BIKE.lamp[1]}" r="14" fill="${glowGrad(C.cyan)}"/>`;
  return s;
}
function bars() {
  let s = '';
  // steerer spacer + stem
  s += `<path d="M${pt(HT0)}L${pt(BIKE.steererTop)}" stroke="${C.ink}" stroke-width="11"/><path d="M${pt(HT0)}L${pt(BIKE.steererTop)}" stroke="#2A2838" stroke-width="8.4"/>`;
  s += `<path d="M${pt(add(BIKE.steererTop, [-1, 2]))}L${pt(BIKE.stem)}" stroke="${C.ink}" stroke-width="9" stroke-linecap="round"/><path d="M${pt(add(BIKE.steererTop, [-1, 2]))}L${pt(BIKE.stem)}" stroke="#262434" stroke-width="6.4" stroke-linecap="round"/><path d="M${pt(add(BIKE.steererTop, [0, -1]))}L${pt(add(BIKE.stem, [0, -2.4]))}" stroke="${C.cyan}" stroke-width="1" opacity=".9"/>`;
  // swept-back city bar to the grips
  const bar = `M${pt(BIKE.stem)}C140 -271 142 -279 132 -279.5L${pt(BIKE.gripNear)}`;
  s += `<path d="M132 -270C139 -273 140 -279 130 -280L${pt(BIKE.gripFar)}" stroke="#15131C" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  s += `<path d="${bar}" stroke="${C.ink}" stroke-width="6.4" fill="none" stroke-linecap="round"/><path d="${bar}" stroke="${chromeH}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  s += `<rect x="${BIKE.gripNear[0] - 12}" y="${BIKE.gripNear[1] - 4.5}" width="18" height="9" rx="4" fill="#1C1A26" stroke="${C.ink}"/>`;
  // bell (chrome) on the bar
  s += `<path d="M118 -281a6 5 0 0 1 12 0z" fill="${chromeG}" stroke="${C.ink}" stroke-width=".8"/><circle cx="124" cy="-286.5" r="1.4" fill="#8A90B0"/>`;
  // holo speedo emitter on the stem
  s += `<rect x="125" y="-276" width="9" height="4" rx="1" fill="#0E0C18" stroke="${C.cyan}" stroke-width=".6"/>`;
  // delivery box on the front rack
  const { x0, x1, y0, y1 } = BIKE.basket;
  s += `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="5" fill="${lg('box', 0, 0, 1, 1, [[0, '#2A2448'], [1, '#110E20']])}" stroke="${C.ink}" stroke-width="1.4"/>`;
  // glowing fish peeking from the half-open lid
  s += `<g transform="translate(166 -296) rotate(-28)"><path d="M-14 0c6-8 20-8 26 0c-6 8-20 8-26 0zM12 0l8-6v12z" fill="${C.cyan}" opacity=".95"/><path d="M-14 0c6-8 20-8 26 0c-6 8-20 8-26 0z" fill="none" stroke="${C.cyanCore}" stroke-width="1"/><circle cx="-8" cy="-1.5" r="1.4" fill="#062030"/></g>`;
  s += `<g transform="translate(196 -299) rotate(-58)"><path d="M-14 0c6-8 20-8 26 0c-6 8-20 8-26 0zM12 0l8-6v12z" fill="${C.amber}"/><path d="M-14 0c6-8 20-8 26 0c-6 8-20 8-26 0z" fill="none" stroke="#FFF0D2" stroke-width="1"/><circle cx="-8" cy="-1.5" r="1.4" fill="#3A1A08"/></g>`;
  s += blob(180, -292, 46, 18, C.cyan, 0.55);
  s += `<path d="M${x0 - 2} ${y0 - 1}L${x1 - 4} ${y0 - 12}L${x1 + 2} ${y0 - 7}L${x0 + 6} ${y0 + 3}Z" fill="#2E2850" stroke="${C.ink}" stroke-width="1.2"/>`;
  s += neonStroke(`M${x0 + 4} ${y0 + 5}H${x1 - 4}`, C.mag, C.magCore, 0.9);
  s += neonStroke(`M${x0 + 3} ${y1 - 4}H${x1 - 3}`, C.cyan, C.cyanCore, 0.8);
  s += `<text x="${(x0 + x1) / 2}" y="${y0 + 28}" font-family="${CN}" font-size="15" text-anchor="middle" fill="#FFFFFF" stroke="${C.mag}" stroke-width=".5">鹈鹕外卖</text>`;
  s += `<text x="${(x0 + x1) / 2}" y="${y0 + 39}" font-family="${BOLD}" font-weight="bold" font-size="6.6" text-anchor="middle" fill="${C.cyan}" letter-spacing=".6">PELICAN EXPRESS</text>`;
  // courier pictogram + QR + number
  s += `<g transform="translate(${x0 + 12} ${y0 + 52})"><path d="M-6 3c0-7 5-10 9-9l2-4 2 5 10 2-10 2c-2 4-9 6-13 4z" fill="${C.acid}"/></g>`;
  let qr = ''; const qrr = rng(9); for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) if (qrr() < 0.5 || (i < 2 && j < 2)) qr += `M${x1 - 22 + i * 2.4} ${y1 - 22 + j * 2.4}h2.4v2.4h-2.4z`;
  s += `<rect x="${x1 - 24}" y="${y1 - 24}" width="18.4" height="18.4" fill="#E9E6F2"/><path d="${qr}" fill="#0A0716"/>`;
  s += `<text x="${x0 + 26}" y="${y1 - 10}" font-family="${MONO}" font-size="6" fill="${C.acid}">#0719</text>`;
  s += `<rect x="${x1 - 3}" y="${y0 + 8}" width="3" height="40" fill="${C.acid}" opacity=".8"/>`;
  return s;
}
function chain() {
  return `<path d="${CHAIN_D}" fill="none" stroke="#2A2E48" stroke-width="3.6" pathLength="100"/><path d="${CHAIN_D}" fill="none" stroke="#B9C3E6" stroke-width="2.6" pathLength="100" stroke-dasharray="1.1 .9"/><path d="${CHAIN_D}" fill="none" stroke="#FFFFFF" stroke-width="1.2" pathLength="100" stroke-dasharray=".3 3.7" stroke-linecap="round"/>`;
}
// ---------------- pelican body parts
const NECK = (() => {
  const { p0, p1, p2, p3, w0, w1 } = NK; const L = [], Rr = [], C0 = [];
  for (let i = 0; i <= 16; i++) { const t = -0.08 + i / 16 * 1.12; const b = bez(p0, p1, p2, p3, t), tg = bezT(p0, p1, p2, p3, Math.max(0, Math.min(1, t))), n = perp(tg); const w = lerp(w0, w1, Math.max(0, Math.min(1, t))) / 2; L.push(add(b, mul(n, w))); Rr.push(add(b, mul(n, -w))); C0.push(b); }
  return { d: smooth([...L, ...Rr.reverse()]), L, R: Rr.reverse(), C: C0, at: t => ({ p: bez(p0, p1, p2, p3, t), n: perp(bezT(p0, p1, p2, p3, t)), w: lerp(w0, w1, t) }) };
})();
function neck() {
  const sc = [...Array(10)].map((_, i) => { const q = NECK.at(0.12 + i * 0.08); return `<path d="M${pt(add(q.p, mul(q.n, q.w * 0.35)))}q${f(q.n[1] * 4)} ${f(-q.n[0] * 4)} ${f(-q.n[0] * q.w * 0.5)} ${f(-q.n[1] * q.w * 0.5)}" stroke="${C.plumeShade}" stroke-width="1" fill="none"/>`; }).join('');
  return rimFill(NECK.d, { base: C.plume, extra: sc + `<path d="${smooth(NECK.R.slice(2, 15).map(p => add(p, [3, 1])), false)}" stroke="${C.plumeShade}" stroke-width="5" fill="none" opacity=".45"/>`, a: [3.6, 1], b: [-3.4, 2] });
}
function tail() {
  let s = '';
  for (let i = 0; i < 5; i++) { const y = -10 + i * 5, len = 44 - Math.abs(i - 2) * 3; s += `<path d="${smooth([[0, y - 4], [-len * 0.6, y - 5 + i], [-len, y + i * 1.5], [-len + 2, y + 5 + i * 1.5], [-len * 0.6, y + 5], [0, y + 4]])}" fill="${i % 2 ? C.plume : '#D6D0EA'}" stroke="${C.ink}" stroke-width="1.1"/>`; }
  s += `<path d="M-40 -14l-6 8M-42 -2l-4 6" stroke="${C.mag}" stroke-width="1.2" opacity=".8"/>`;
  return s;
}
const ELL = (e, g) => { const p = rot([e * 98, g * 58], -18); return [32 + p[0], -50 + p[1]]; };
function body() {
  const br = J.body.rot;
  const pts = []; for (let i = 0; i < 28; i++) { const th = i / 28 * Math.PI * 2; let p = ELL(Math.cos(th), Math.sin(th)); if (p[0] > 70 && p[1] < -40) p = add(p, [4, -3]); pts.push(p); }
  const bd = smooth(pts);
  // plumage (chest bib shows at the front)
  const chestSc = [...Array(12)].map((_, i) => { const x = 90 + (i % 3) * 10, y = -88 + Math.floor(i / 3) * 18; return `<path d="M${x - 5} ${y}q5 6 10 0" stroke="${C.plumeShade}" stroke-width="1" fill="none"/>`; }).join('');
  let s = rimFill(bd, { base: C.plume, rot: br, extra: chestSc });
  // jacket = body clipped left of the zipper line
  const jk = uid('jk');
  DEFS.push(`<clipPath id="${jk}"><path d="${poly([[-200, -220], [108, -220], [104, -102], [96, -70], [88, -36], [82, -16], [40, -10], [0, -12], [-40, -18], [-70, -24], [-200, -30]])}"/></clipPath>`);
  const jd = smooth(pts.map(p => [p[0] < 0 ? p[0] - 1 : p[0], p[1]]));
  const panel = `<path d="M-40 -90Q10 -112 70 -100" stroke="${C.jacketHi}" stroke-width="2.2" fill="none"/><path d="M-50 -60Q0 -80 80 -70" stroke="${C.mag}" stroke-width="1.5" fill="none"/><path d="M-50 -60Q0 -80 80 -70" stroke="${C.mag}" stroke-width="5" fill="none" opacity=".18"/>
    <path d="M-30 -30Q10 -20 40 -40" stroke="${C.jacketLo}" stroke-width="1.4" fill="none"/><path d="M-10 -96q12 16 4 40M40 -104q8 18 0 44" stroke="${C.jacketLo}" stroke-width="1.2" fill="none"/>
    <g transform="translate(-6 -42) rotate(-12)"><rect x="-26" y="-9" width="52" height="16" rx="2" fill="#0A0914" stroke="${C.cyan}" stroke-width="1"/><text x="0" y="3.5" font-family="${BOLD}" font-weight="bold" font-size="9" fill="${C.cyan}" text-anchor="middle" letter-spacing="1">PELICAN</text></g>
    <path d="M-40 -92Q-60 -60 -58 -34" stroke="${C.cyan}" stroke-width="1.2" fill="none" opacity=".7"/><path d="M20 -108Q40 -80 36 -40" stroke="${C.jacketHi}" stroke-width="1.6" fill="none"/>`;
  s += `<g clip-path="url(#${jk})">${rimFill(jd, { base: lg('jkG', 0.3, 0, 0.6, 1, [[0, '#3A2E6A'], [0.45, C.jacket], [1, '#100D1E']]), rot: br, extra: panel, sw: 1.4 })}</g>`;
  // zipper
  s += `<path d="M104 -102L96 -70L88 -36L83 -18" stroke="#0A0914" stroke-width="3" fill="none"/><path d="M104 -102L96 -70L88 -36L83 -18" stroke="#8A90B0" stroke-width="1" stroke-dasharray="1.2 1.2" fill="none"/>`;
  // belly feathers below the hem
  s += [...Array(9)].map((_, i) => `<path d="M${-40 + i * 13} ${-4 + Math.abs(i - 4) * 0.8}q6 5 12 0" stroke="${C.plumeShade}" stroke-width="1.1" fill="none"/>`).join('');
  // ribbed hem band with reflective strip
  const hem = smooth([[-72, -30], [-40, -22], [0, -16], [40, -14], [83, -20]], false);
  s += `<g clip-path="url(#${jk}b)"><path d="${hem}" stroke="${C.ink}" stroke-width="12" fill="none"/><path d="${hem}" stroke="url(#rib)" stroke-width="10" fill="none"/><path d="${hem}" stroke="${C.acid}" stroke-width="1.4" fill="none" transform="translate(0 -3)"/></g>`;
  DEFS.push(`<clipPath id="${jk}b"><path d="${bd}"/></clipPath>`);
  return s;
}
// collar + LED scarf (rider space, drawn right after the body)
function scarf() {
  let s = '';
  // ribbed collar at the neck base
  const c0 = NECK.at(0.08);
  const colPts = [add(c0.p, mul(c0.n, c0.w * 0.7)), add(add(c0.p, mul(c0.n, c0.w * 0.6)), [-4, -8]), add(add(c0.p, mul(c0.n, -c0.w * 0.62)), [-2, -9]), add(c0.p, mul(c0.n, -c0.w * 0.72))];
  s += `<path d="${smooth([colPts[0], colPts[1], colPts[2], colPts[3], add(colPts[3], [4, 8]), add(colPts[0], [0, 8])])}" fill="url(#rib)" stroke="${C.ink}" stroke-width="1.2"/>`;
  // scarf band
  const q = NECK.at(0.24), tg = perp(mul(q.n, -1));
  const a = add(q.p, mul(q.n, q.w * 0.58)), b = add(q.p, mul(q.n, -q.w * 0.62));
  const band = smooth([add(a, mul(tg, 7)), add(lerp2(a, b, 0.5), mul(tg, 9)), add(b, mul(tg, 7)), add(b, mul(tg, -7)), add(lerp2(a, b, 0.5), mul(tg, -5)), add(a, mul(tg, -7))]);
  const knot = add(b, [-4, 2]);
  // tails streaming back (calm follow-through)
  const t1 = [knot, add(knot, [-24, -4]), add(knot, [-54, 0]), add(knot, [-86, -8]), add(knot, [-112, -2])];
  const t2 = [knot, add(knot, [-20, 12]), add(knot, [-44, 20]), add(knot, [-70, 18])];
  const led = (cl, n, off = 0) => { let out = ''; for (let i = 1; i <= n; i++) { const tt = i / (n + 1); const k = tt * (cl.length - 1), i0 = Math.floor(k), p = lerp2(cl[i0], cl[Math.min(cl.length - 1, i0 + 1)], k - i0); const col = [C.cyan, C.mag, C.acid][(i + off) % 3]; out += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="4" fill="${col}" opacity=".25"/><circle cx="${f(p[0])}" cy="${f(p[1])}" r="1.5" fill="${col}"/><circle cx="${f(p[0])}" cy="${f(p[1])}" r=".7" fill="#FFFFFF"/>`; } return out; };
  const fringe = cl => { const e = cl[cl.length - 1], d = norm(sub(e, cl[cl.length - 2])), n = perp(d); return [-2, -1, 0, 1, 2].map(k => { const b0 = add(e, mul(n, k * 2.6)); return neonStroke(`M${pt(b0)}l${pt(mul(d, 7))}`, [C.cyan, C.mag, C.acid][(k + 5) % 3], '#fff', 0.5); }).join(''); };
  s += neonStroke(smooth(t2, false), C.mag, C.magCore, 1, 0.5);
  s += `<path d="${ribbon(t2, 16, 11)}" fill="#4A1A5E" stroke="${C.ink}" stroke-width="1.1"/><path d="${smooth(t2, false)}" stroke="${C.mag}" stroke-width="1" fill="none" opacity=".8"/>` + led(t2, 6, 1) + fringe(t2);
  s += neonStroke(smooth(t1, false), C.cyan, C.cyanCore, 1, 0.45);
  s += `<path d="${ribbon(t1, 19, 13)}" fill="#5A1F6A" stroke="${C.ink}" stroke-width="1.1"/><path d="${smooth(t1, false)}" stroke="${C.cyan}" stroke-width="1" fill="none" opacity=".8"/>` + led(t1, 8) + fringe(t1);
  s += `<path d="${band}" fill="#5A1F6A" stroke="${C.ink}" stroke-width="1.2"/>`;
  s += neonStroke(`M${pt(add(a, mul(tg, 3)))}L${pt(add(b, mul(tg, 3)))}`, C.cyan, C.cyanCore, 0.9);
  s += neonStroke(`M${pt(add(a, mul(tg, -3)))}L${pt(add(b, mul(tg, -3)))}`, C.mag, C.magCore, 0.9);
  s += `<circle cx="${f(knot[0])}" cy="${f(knot[1])}" r="7" fill="#6A2478" stroke="${C.ink}" stroke-width="1.2"/><circle cx="${f(knot[0])}" cy="${f(knot[1])}" r="2.2" fill="${C.acid}"/>`;
  return s;
}
function pouch() {
  const d = smooth([[-8, -2], [20, 0], [60, 0], [100, -1], [112, -2], [104, 4], [82, 14], [56, 25], [30, 32], [8, 31], [-8, 24], [-15, 10]]);
  const circ = `<g fill="none" stroke="${C.cyan}" stroke-width="1.1" opacity=".9"><path d="M6 20h14l6-8h20l5 6h16M18 26h16l5 4M40 12l6-6h22M60 18l8 6h16"/></g>
    <g fill="${C.cyanCore}">${[[6, 20], [67, 18], [34, 26], [68, 6], [84, 24]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6"/>`).join('')}</g>
    <path d="M6 20h14l6-8h20l5 6h16" stroke="${C.cyan}" stroke-width="4" fill="none" opacity=".18"/>
    <path d="M0 10Q40 22 96 4" stroke="#E08A2E" stroke-width="1.2" fill="none" opacity=".6"/>`;
  return rimFill(d, { base: lg('pouchG', 0, 0, 0, 1, [[0, C.pouch0], [1, C.pouch1]]), rot: J.pouch.rot, extra: circ, cy: '#7FE9FF', mg: '#FF6FA8', a: [2.4, 0.4], b: [-2.2, 2] });
}
function billLower() {
  const d = smooth([[-4, -2], [40, -1.5], [90, -1], [122, 0], [126, 3], [110, 4], [60, 4.5], [10, 5], [-4, 4]]);
  return rimFill(d, { base: C.billEdge, rot: J.billLower.rot, a: [2, 0], b: [-2, 1.6] });
}
function billUpper() {
  const d = smooth([[-8, -10], [30, -8.5], [80, -6], [116, -4.5], [126, -3], [128, 2], [120, 3], [80, 3.5], [30, 4], [-6, 5]]);
  const g = lg('billG', 0, 0, 1, 0, [[0, '#F7B8A0'], [0.6, C.bill], [1, '#F19070']]);
  const ex = `<path d="M-2 -5Q60 -5 118 -2.5" stroke="#FFD8C8" stroke-width="1.2" fill="none" opacity=".8"/><path d="M0 3Q60 1.8 120 1.6" stroke="${C.billEdge}" stroke-width="1.4" fill="none"/>`;
  let s = rimFill(d, { base: g, rot: J.billUpper.rot, extra: ex, a: [2, 0.6], b: [-1.4, 2.2] });
  // chrome hooked nail
  s += `<path d="M118 -4.5Q128 -5.5 131 0Q133 6 127 9Q127 4 122 3.4Z" fill="${chromeG}" stroke="${C.ink}" stroke-width="1"/><path d="M121 -3Q127 -3.5 129 0" stroke="#FFFFFF" stroke-width="1" fill="none"/><circle cx="128.6" cy="-1.2" r="4" fill="${C.cyan}" opacity=".3"/>`;
  s += `<path d="M112 -3.5Q108 -1 112 2" stroke="${C.billEdge}" stroke-width=".8" fill="none"/>`;
  return s;
}
function head() {
  const d = smooth([[-30, -4], [-24, -20], [-6, -27], [12, -23], [24, -13], [30, -4], [26, 6], [10, 10], [-10, 12], [-26, 8]]);
  const face = `<path d="${smooth([[-4, -11], [8, -17], [20, -12], [28, -4], [22, 5], [8, 3], [-2, -2]])}" fill="${C.face}" opacity=".95"/>`;
  const sc = [...Array(5)].map((_, i) => `<path d="M${-22 + i * 5} ${-14 + i * 4}q4 3 1 7" stroke="${C.plumeShade}" stroke-width="1" fill="none"/>`).join('');
  let s = rimFill(d, { base: C.plume, rot: J.head.rot, extra: face + sc, a: [3, 0.6], b: [-3, 2.4] });
  // earpiece + antenna
  s += `<path d="M-22 4l-12 -30" stroke="#5A607E" stroke-width="1.4"/><circle cx="-34" cy="-26" r="1.8" fill="${C.mag}"/><circle cx="-34" cy="-26" r="6" fill="${C.mag}" opacity=".3"/>`;
  s += `<rect x="-25" y="2" width="8" height="10" rx="3" fill="${chromeG}" stroke="${C.ink}" stroke-width=".8"/><path d="M-21 4v6" stroke="${C.mag}" stroke-width="1.2"/>`;
  return s;
}
function eye() {
  // eye (half-lidded, confident) + the cyan visor over it
  let s = `<ellipse cx="0" cy="0" rx="7" ry="6.6" fill="#F4D26A"/><circle cx="0.6" cy="0.4" r="4.4" fill="${C.iris}"/><circle cx="0.8" cy="0.4" r="2.1" fill="#0A0508"/><circle cx="-0.8" cy="-1.2" r="1.2" fill="#FFFFFF"/>`;
  s += `<path d="M-7.5 -1.6Q0 -6.4 7.5 -1.8L7.5 -7H-7.5Z" fill="${C.face}"/><path d="M-7.5 -1.6Q0 -6.4 7.5 -1.8" stroke="#8A4A4A" stroke-width="1.3" fill="none"/>`;
  const vd = smooth([[-31, -5], [-12, -10.5], [10, -10.5], [24, -7], [27, -1], [21, 5.5], [0, 7], [-20, 6], [-31, 2.5]]);
  s += `<path d="${vd}" fill="${lg('visor', 0, 0, 1, 0, [[0, '#0E6E8E', 0.8], [0.45, C.cyan, 0.42], [1, '#9FF6FF', 0.62]])}" stroke="${C.cyan}" stroke-width="1.1"/>`;
  s += `<path d="${vd}" fill="none" stroke="${C.cyan}" stroke-width="4" opacity=".22"/>`;
  s += `<path d="M-24 -6.5Q0 -11 20 -7" stroke="#FFFFFF" stroke-width="1.3" fill="none" opacity=".85"/>`;
  s += `<circle cx="0.6" cy="0.4" r="6.2" fill="none" stroke="#E6FDFF" stroke-width=".6" opacity=".9"/><path d="M-7 0.4h-3M8 0.4h3M0.6 -6v-2" stroke="#E6FDFF" stroke-width=".6"/>`;
  s += `<text x="12" y="3.4" font-family="${MONO}" font-size="3.6" fill="#E6FDFF">23▲</text><path d="M-26 2h10M-26 -1h6" stroke="#E6FDFF" stroke-width=".6" opacity=".8"/>`;
  s += `<path d="M-31 -3L-37 -1" stroke="#16131F" stroke-width="3"/>`;
  return s;
}
function crest() {
  // +x back along the nape, +y up (local), shaggy crest with fiber-optic tips
  let s = '';
  const strands = [[[-4, -2], [10, 2], [22, 2], [30, -2]], [[-4, 2], [10, 7], [22, 10], [31, 9]], [[-4, 4], [8, 11], [17, 17], [22, 20]], [[-4, 0], [8, -3], [18, -6], [24, -10]], [[-2, 6], [6, 14], [10, 22]]];
  strands.forEach((st, i) => { s += `<path d="${ribbon(st, 9, 0.6)}" fill="${i % 2 ? '#D8D2EC' : C.plume}" stroke="${C.ink}" stroke-width="1"/><path d="${smooth(st.slice(0, 3), false)}" stroke="${C.plumeShade}" stroke-width=".8" fill="none"/>`; if (i < 3) { const tip = st[st.length - 1]; s += `<circle cx="${tip[0]}" cy="${tip[1]}" r="2.4" fill="${C.cyan}" opacity=".35"/><circle cx="${tip[0]}" cy="${tip[1]}" r=".8" fill="${C.cyanCore}"/>`; } });
  s += `<path d="M6 4Q20 12 30 12" stroke="${C.mag}" stroke-width="1.2" fill="none"/>`;
  return s;
}

// ---- assemble the rider (flat z-ordered slots, rig-spec §0.1)
R.push(slot('wingFarUpper', wingUpper(true)), slot('wingFarLower', wingLower(true)), slot('wingFarHand', wingHand(true)));
R.push(slot('pedalFar', pedal(true)), slot('footFar', foot(true)), slot('shankFar', shank(true)), slot('thighFar', thigh(true)), slot('crankFar', crankArm(true)));
R.push(slot('wheelRear', wheel(false)), slot('wheelFront', wheel(true)), slot('frame', frame()), slot('fork', fork()), slot('bars', bars()), slot('cog', cog()), slot('chain', chain()), slot('chainring', chainring()), slot('crankNear', crankArm(false)));
R.push(slot('neck', neck()), slot('tail', tail()), slot('body', body()), `<g id="scarf">${scarf()}</g>`);
R.push(slot('pedalNear', pedal(false)), slot('shankNear', shank(false)), slot('footNear', foot(false)), slot('thighNear', thigh(false)));
R.push(slot('pouch', pouch()), slot('billLower', billLower()), slot('billUpper', billUpper()), slot('head', head()), slot('eye', eye()), slot('crest', crest()));
R.push(slot('wingNearUpper', wingUpper(false)), slot('wingNearLower', wingLower(false)), slot('wingNearHand', wingHand(false)));

// fx in rider space: underglow pool, headlight laser, holo speedometer, rain spray
const FXB = `<g>${blob(24, 2, 280, 30, C.mag, 1)}${blob(24, 0, 160, 12, '#FF7DB5', 0.8)}${blob(-125, 0, 80, 8, '#FF6FA8', 0.8)}${blob(173, 0, 80, 8, C.cyan, 0.7)}<ellipse cx="24" cy="1" rx="170" ry="5" fill="#07060F" opacity=".55"/>${[[-125, 0], [173, 0]].map(([x, y]) => [1, 2, 3].map(k => `<ellipse cx="${x}" cy="${y + 2}" rx="${14 * k}" ry="${2.4 * k}" fill="none" stroke="#CFE8FF" stroke-width=".8" opacity="${0.5 / k}"/>`).join('')).join('')}</g>`;
const lampP = [BIKE.lamp[0] + 7, BIKE.lamp[1]];
const FXF = `<g>
<path d="M${pt(lampP)}L760 -120L760 -8Z" fill="${lg('beam', 0, 0, 1, 0, [[0, '#E6FDFF', 0.5], [0.4, C.cyan, 0.16], [1, C.cyan, 0]])}"/>
<path d="M${pt(lampP)}L920 -150" stroke="${C.cyan}" stroke-width="3" opacity=".3"/><path d="M${pt(lampP)}L920 -150" stroke="#FFFFFF" stroke-width=".9" opacity=".9"/>
${blob(lampP[0], lampP[1], 26, 10, '#FFFFFF', 0.9)}<path d="M${lampP[0] - 16} ${lampP[1]}h32M${lampP[0]} ${lampP[1] - 7}v14" stroke="#FFFFFF" stroke-width=".8" opacity=".9"/>
${blob(430, -2, 200, 16, C.cyan, 0.5)}
<g transform="translate(152 -334)" opacity=".95">
  <path d="M-24 58L-6 22H6L-14 58Z" fill="${C.cyan}" opacity=".12"/>
  <circle r="24" fill="${C.cyan}" opacity=".08"/><circle r="24" fill="none" stroke="${C.cyan}" stroke-width="1" opacity=".7"/>
  <path d="M-19 14A24 24 0 1 1 19 14" fill="none" stroke="${C.cyan}" stroke-width="3" opacity=".3"/><path d="M-19 14A24 24 0 0 1 8 -22.6" fill="none" stroke="${C.acid}" stroke-width="2.2"/>
  ${[...Array(13)].map((_, i) => { const a = 140 + i * 20.8; const p0 = rot([19, 0], a), p1 = rot([22, 0], a); return `<path d="M${pt(p0)}L${pt(p1)}" stroke="#E6FDFF" stroke-width=".7"/>`; }).join('')}
  <text x="0" y="5" font-family="${MONO}" font-weight="bold" font-size="15" fill="#E6FDFF" text-anchor="middle">23</text>
  <text x="0" y="13" font-family="${MONO}" font-size="4.4" fill="${C.cyan}" text-anchor="middle">KM/H</text>
  <text x="0" y="-9" font-family="${MONO}" font-size="3.6" fill="${C.acid}" text-anchor="middle">060 RPM</text>
  ${[...Array(9)].map((_, i) => `<path d="M-30 ${-20 + i * 5}h60" stroke="${C.cyan}" stroke-width=".4" opacity=".25"/>`).join('')}
</g>
<g fill="none" stroke="#CFE8FF" stroke-width="1.6" stroke-linecap="round" opacity=".6">${(() => { const r = rng(77); let d = ''; for (let i = 0; i < 40; i++) { const a = 196 + r() * 40, rr = 104 + r() * 50, p = add(RH, rot([rr, 0], a)); const dd = rot([1 + r() * 2, 0], a - 80); d += `M${pt(p)}l${f(dd[0])} ${f(dd[1])}`; } return `<path d="${d}"/>`; })()}</g>
</g>`;

// ============================================================================================ FRONT FX + HUD
const FR = [];
// drones
function drone(x, y, s, col, cone = false) {
  let g = `<g transform="translate(${x} ${y}) scale(${s})">`;
  if (cone) g += `<path d="M-8 6L-70 180H70L8 6Z" fill="${lg(uid('dc'), 0, 0, 0, 1, [[0, '#E6FDFF', 0.35], [1, '#E6FDFF', 0]])}"/>`;
  g += `<path d="M-30 -2h60M-30 -2v-5M30 -2v-5" stroke="#0B0918" stroke-width="3"/><ellipse cx="-30" cy="-8" rx="12" ry="2" fill="#3A3F5C" opacity=".8"/><ellipse cx="30" cy="-8" rx="12" ry="2" fill="#3A3F5C" opacity=".8"/>
  <path d="M-12 -4h24l-4 10h-16z" fill="#15121F"/><circle cx="0" cy="3" r="2.6" fill="${col}"/><circle cx="-30" cy="-2" r="2" fill="${C.red}"/><circle cx="30" cy="-2" r="2" fill="${C.acid}"/>
  <circle cx="0" cy="3" r="10" fill="${glowGrad(col)}"/>`;
  return g + '</g>';
}
FR.push(`<g filter="url(#fB1)">${drone(1330, 350, 0.9, C.cyan, true)}</g>`);
FR.push(drone(470, 196, 0.8, C.mag) + `<g transform="translate(470 208)"><path d="M0 -4v10" stroke="#0B0918"/><rect x="-9" y="6" width="18" height="13" fill="#2A2448" stroke="${C.mag}" stroke-width="1"/><text x="0" y="15.5" font-family="${CN}" font-size="6" fill="#fff" text-anchor="middle">外卖</text></g>`);
FR.push(`<g opacity=".7">${drone(1010, 262, 0.45, C.acid)}${drone(250, 120, 0.4, C.cyan)}</g>`);
// rain: far fine layer, mid layer, and a few big foreground streaks
function rain(seed, n, lenMin, lenMax, w, op, col = '#CFE8FF', y0 = 0, y1 = 900) {
  const r = rng(seed); let d = ''; for (let i = 0; i < n; i++) { const x = r() * 1700 - 50, y = y0 + r() * (y1 - y0), L = lenMin + r() * (lenMax - lenMin); d += `M${f(x)} ${f(y)}l${f(-L * 0.16)} ${f(L)}`; }
  return `<path d="${d}" stroke="${col}" stroke-width="${w}" stroke-linecap="round" opacity="${op}"/>`;
}
FR.push(rain(101, 900, 10, 22, 0.7, 0.28));
FR.push(rain(102, 160, 14, 26, 0.9, 0.5, '#9FF6FF', 80, 700));
FR.push(rain(103, 120, 14, 26, 0.9, 0.45, '#FF9CC8', 80, 700));
FR.push(`<g filter="url(#fB1)">${rain(104, 70, 40, 80, 1.8, 0.35)}</g>`);
// splashes on the road
{ const r = rng(105); let d = ''; for (let i = 0; i < 90; i++) { const x = r() * 1600, y = 770 + r() * 128, s = 2 + r() * 5; d += `M${f(x - s)} ${f(y)}a${f(s)} ${f(s * 0.3)} 0 1 0 ${f(2 * s)} 0a${f(s)} ${f(s * 0.3)} 0 1 0 ${f(-2 * s)} 0`; } FR.push(`<path d="${d}" fill="none" stroke="#CFE8FF" stroke-width=".7" opacity=".45"/>`); }
// foreground: bokeh + a blurred foreground bollard and hanging cable
FR.push(`<g filter="url(#fB12)">${[[40, 60, 34, C.mag], [120, 20, 22, C.cyan], [1560, 90, 40, C.amber], [1500, 30, 20, C.mag], [1590, 470, 30, C.cyan]].map(([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity=".35"/>`).join('')}</g>`);
FR.push(`<g filter="url(#fB5)"><path d="M1540 900V730h36v170z" fill="#07060F"/><path d="M1540 760h36M1540 790h36" stroke="${C.acid}" stroke-width="5" opacity=".35"/><circle cx="1558" cy="738" r="5" fill="${C.red}"/></g>`);
FR.push(`<path d="M-10 36Q300 110 640 20" stroke="#050409" stroke-width="3" fill="none" filter="url(#fB2)"/>`);
// vignette + grade + scanlines
FR.push(`<rect width="1600" height="900" fill="${lg('grade', 0, 0, 1, 0.3, [[0, '#19E6FF', 0.5], [0.5, '#7A3C82', 0], [1, '#FF2E88', 0.55]])}" style="mix-blend-mode:soft-light"/>`);
FR.push(`<rect width="1600" height="900" fill="${rgd('vig', [[0.55, '#07060F', 0], [1, '#07060F', 0.7]], 'cx="50%" cy="48%" r="72%"')}"/>`);
FR.push(`<rect width="1600" height="900" fill="url(#scan)" opacity=".2"/>`);
// HUD frame
const HUD = [];
const brk = (x, y, sx, sy) => `<path d="M${x} ${y + sy * 46}V${y}H${x + sx * 46}" stroke="${C.cyan}" stroke-width="2.4" fill="none"/><path d="M${x + sx * 6} ${y + sy * 6}h${sx * 10}" stroke="${C.mag}" stroke-width="2"/>`;
HUD.push(`<rect x="16" y="16" width="1568" height="868" fill="none" stroke="${C.cyan}" stroke-width=".8" opacity=".45"/>`);
HUD.push(brk(16, 16, 1, 1) + brk(1584, 16, -1, 1) + brk(16, 884, 1, -1) + brk(1584, 884, -1, -1));
HUD.push(`<g>${[...Array(30)].map((_, i) => `<path d="M${520 + i * 19} 16v${i % 5 ? 4 : 8}" stroke="${C.cyan}" stroke-width=".8" opacity=".6"/>`).join('')}</g>`);
// title (glitch lettering)
HUD.push(`<g font-family="${BOLD}" font-weight="bold" font-size="38" letter-spacing="3">
<text x="42" y="70" fill="${C.cyan}" opacity=".85">NEON PELICAN</text><text x="46" y="68" fill="${C.mag}" opacity=".85">NEON PELICAN</text><text x="44" y="69" fill="#F4F2FF">NEON PELICAN</text>
<rect x="44" y="52" width="90" height="3" fill="#07060F"/><rect x="200" y="60" width="60" height="2" fill="${C.cyan}"/></g>
<rect x="408" y="38" width="80" height="36" fill="${C.mag}"/><text x="448" y="66" font-family="${CN}" font-size="25" fill="#07060F" text-anchor="middle">鹈鹕湾</text>
<text x="46" y="92" font-family="${MONO}" font-size="11" fill="${C.cyan}" letter-spacing="2">PELICAN BAY · 霓虹区 NEON DISTRICT · ネオン</text>`);
// mission caption
HUD.push(`<g transform="translate(1180 38)"><path d="M0 0H372V58H14L0 44Z" fill="#07060F" opacity=".6"/><path d="M0 0H372V58H14L0 44Z" fill="none" stroke="${C.cyan}" stroke-width="1"/><rect x="0" y="0" width="6" height="30" fill="${C.mag}"/>
<text x="20" y="22" font-family="${MONO}" font-size="11" fill="${C.acid}" letter-spacing="1.5">▶ MISSION ACTIVE</text>
<text x="20" y="44" font-family="${CN}" font-size="16" fill="#F4F2FF">DELIVERY 01 · 鹈鹕湾 / PELICAN BAY</text>
<rect x="232" y="14" width="126" height="5" fill="#1A1630"/><rect x="232" y="14" width="44" height="5" fill="${C.cyan}"/><text x="358" y="30" font-family="${MONO}" font-size="9" fill="${C.cyan}" text-anchor="end">ETA 04:12</text></g>`);
// telemetry
HUD.push(`<g transform="translate(40 772)"><path d="M0 0H300V92H0Z" fill="#07060F" opacity=".62"/><path d="M0 0H286L300 14V92H0Z" fill="none" stroke="${C.cyan}" stroke-width="1"/>
<text x="14" y="22" font-family="${MONO}" font-size="10" fill="${C.cyan}" letter-spacing="1.4">速度 SPEED</text><text x="14" y="58" font-family="${MONO}" font-weight="bold" font-size="36" fill="#F4F2FF">23</text><text x="64" y="58" font-family="${MONO}" font-size="11" fill="${C.cyan}">KM/H</text>
<text x="120" y="22" font-family="${MONO}" font-size="10" fill="${C.cyan}" letter-spacing="1.4">踏频 CADENCE</text><text x="120" y="58" font-family="${MONO}" font-weight="bold" font-size="24" fill="${C.mag}">060</text><text x="170" y="58" font-family="${MONO}" font-size="10" fill="${C.cyan}">RPM</text>
<text x="210" y="22" font-family="${MONO}" font-size="10" fill="${C.cyan}" letter-spacing="1.4">里程 KM</text><text x="210" y="58" font-family="${MONO}" font-weight="bold" font-size="24" fill="${C.acid}">000.3</text>
${[...Array(24)].map((_, i) => `<rect x="${14 + i * 11}" y="${80 - (4 + ((i * 37) % 11))}" width="7" height="${4 + ((i * 37) % 11)}" fill="${i < 17 ? C.cyan : C.mag}" opacity=".7"/>`).join('')}</g>`);
HUD.push(`<g transform="translate(1560 862)" font-family="${MONO}" font-size="11" text-anchor="end"><circle cx="-238" cy="-4" r="4" fill="${C.red}"/><text x="-226" y="0" text-anchor="start" fill="#F4F2FF">REC 20:47:12</text><text x="0" y="0" fill="${C.cyan}">雨 RAIN 72% · 22°C</text><text x="0" y="-18" fill="${C.acid}">SIGNAL ▮▮▮▮▯ · 霓虹网 NEON-NET</text></g>`);
// rider tag callout (points at the courier; kept clear of the silhouette)
HUD.push(`<g><path d="M960 250L1002 214H1112" stroke="${C.acid}" stroke-width="1" fill="none"/><circle cx="960" cy="250" r="3" fill="none" stroke="${C.acid}"/>
<rect x="1004" y="190" width="108" height="22" fill="#07060F" opacity=".6"/><text x="1010" y="205" font-family="${MONO}" font-size="10" fill="${C.acid}">COURIER 鹈鹕 #0719</text>
<path d="M752 236h-10v10M946 236h10v10M752 330h-10v-10M946 330h10v-10" stroke="${C.acid}" stroke-width="1.4" fill="none" opacity=".75"/></g>`);

// ============================================================================================ ASSEMBLE
const riderXf = `translate(${RIDER_X} ${GROUND_Y})`;
const svg = (vb, w, h) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}" height="${h}">
<title>Neon Pelican: concept keyframe (neon dusk)</title>
<defs>${DEFS.join('\n')}
<g id="midStreet">${MID.join('\n')}${SG.join('\n')}${ST.join('\n')}</g>
<g id="rider">${R.join('\n')}</g>
</defs>
<rect width="1600" height="900" fill="${C.void}"/>
<g id="L-sky">${W.join('\n')}</g>
<g id="L-mid">${rain(99, 500, 6, 12, 0.5, 0.18, '#CFE8FF', 0, 760)}<use href="#midStreet"/></g>
<g id="L-road">${ROAD.join('\n')}</g>
<g id="L-rider-refl" clip-path="url(#riderReflClip)"><g filter="url(#fRefl)" opacity=".42"><use href="#rider" transform="translate(${RIDER_X} ${GROUND_Y * 2}) scale(1 -1)"/></g></g>
<g id="L-hero-puddle"><clipPath id="heroPud"><ellipse cx="700" cy="836" rx="300" ry="30"/></clipPath><g clip-path="url(#heroPud)"><rect x="380" y="800" width="640" height="80" fill="#0A0716"/><g filter="url(#fReflS)" opacity=".8"><use href="#midStreet" transform="translate(0 1528) scale(1 -1)"/></g><g filter="url(#fReflS)" opacity=".75"><use href="#rider" transform="translate(${RIDER_X} ${GROUND_Y * 2}) scale(1 -1)"/></g></g><ellipse cx="700" cy="836" rx="300" ry="30" fill="none" stroke="#FFFFFF" stroke-width=".8" opacity=".2"/></g>
<g id="L-shadow" transform="${riderXf}">${FXB}</g>
<g id="L-rider" transform="${riderXf}"><use href="#rider"/></g>
<g id="L-fx-front" transform="${riderXf}">${FXF}</g>
<g id="L-foreground">${FR.join('\n')}</g>
<g id="L-hud">${HUD.join('\n')}</g>
</svg>`;
fs.writeFileSync(path.join(HERE, 'keyframe.svg'), svg('0 0 1600 900', 1600, 900));
fs.writeFileSync(path.join(HERE, 'closeup.svg'), svg('440 220 560 580', 1120, 1160));
console.log('wrote keyframe.svg + closeup.svg', (fs.statSync(path.join(HERE, 'keyframe.svg')).size / 1024).toFixed(0) + ' KB');
