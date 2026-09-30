// OWNER: director. Weather art in STYLE B (warm storybook gouache, docs/STYLE-B.md §2 + §6): dark painted rain
// clouds with hanging virga, soft tapered rain streaks with round splashes, puddles that mirror the sky, a
// watercolour rainbow, gouache fog veils that slide, and ONE calm wind language (a single slow set of soft breeze
// swirls in the upper sky plus a few painted leaves).
// Reads frame.weather (documented in director.js): wind, gust, cloud, rain, fog, bow, wet. Everything is built once;
// update() only moves groups (transform) and fades them (opacity). NO filters anywhere (the performance rule): every
// soft edge is baked: stacked translucent passes, seeded wobble, gradient-faded veils, tapered brush ribbons.
// Reduced motion: no rain streaks or splashes, no wind, static fog.
import { GROUND_Y, TILE } from '../contract.js';
import { f, wrap, clamp, sstep, TAU } from './director.js';

export const id = 'weather';
export const materials = {};
export const detailItems = [
  { id: 'sky:T:wx-overcast', layer: 'sky', kind: 'T', what: 'overcast: a mauve-grey gouache glaze with dry-brush streaks that dims the sky as the shower comes' },
  { id: 'sky:O:wx-stormclouds', layer: 'sky', kind: 'O', what: 'dark painted rain clouds: three gouache tones, a darker belly glaze and a pale rim on the tops' },
  { id: 'sky:T:wx-cloud-dabs', layer: 'sky', kind: 'T', what: 'short curved brush dabs painted over the storm-cloud bodies' },
  { id: 'sky:O:wx-virga', layer: 'sky', kind: 'O', what: 'soft grey rain curtains (virga) trailing from the storm-cloud bellies' },
  { id: 'sky:O:wx-rainbow', layer: 'sky', kind: 'O', what: 'watercolour rainbow: six wobbly translucent bands that bleed into each other and fade toward the sea' },
  { id: 'sky:T:wx-bow-bloom', layer: 'sky', kind: 'T', what: 'watercolour back-run blooms: pale pigment-free blotches along the rainbow' },
  { id: 'sky:O:wx-bow2', layer: 'sky', kind: 'O', what: 'the faint secondary rainbow outside the main bow, colours reversed' },
  { id: 'sky:T:wx-bow-glow', layer: 'sky', kind: 'T', what: 'the brighter sky inside the rainbow (a pale glaze under the arc)' },
  { id: 'sky:O:wx-sunbeams', layer: 'sky', kind: 'O', what: 'soft golden sunbeams breaking through as the shower clears' },
  { id: 'fx:T:wx-rain-far', layer: 'fx', kind: 'T', what: 'far rain curtain: faint cool painted streaks over the sea' },
  { id: 'sea:T:wx-searain', layer: 'sea', kind: 'T', what: 'rain dimples on the sea: little pale rings and dashes' },
  { id: 'fx:T:wx-rain', layer: 'fx', kind: 'T', what: 'near rain: soft tapered paper-white streaks with round drop heads, in two tones' },
  { id: 'fx:O:wx-splashes', layer: 'fx', kind: 'O', what: 'round rain splashes on the road: a crown of droplets over a ring' },
  { id: 'land:O:wx-puddles', layer: 'land', kind: 'O', what: 'wobbly road puddles mirroring the sky, with a dark wet rim and highlight strokes' },
  { id: 'land:T:wx-ripples', layer: 'land', kind: 'T', what: 'rain rings spreading on the puddles' },
  { id: 'land:T:wx-wetroad', layer: 'land', kind: 'T', what: 'wet road: a darker glaze with long sky-sheen streaks' },
  { id: 'sea:T:wx-fog', layer: 'sea', kind: 'T', what: 'sea fog: three gouache veils with soft gradient tops and dry-brush streaks, sliding over the headland' },
  { id: 'sea:O:wx-fogwisp', layer: 'sea', kind: 'O', what: 'single fog wisps drifting ahead of the bank at their own pace' },
  { id: 'land:T:wx-mist', layer: 'land', kind: 'T', what: 'low shore mist band with a soft top' },
  { id: 'sea:O:wx-fogbeam', layer: 'sea', kind: 'O', what: 'the lighthouse beam cutting a soft glowing path through the fog' },
  { id: 'fx:O:wx-wind', layer: 'fx', kind: 'O', what: 'the calm breeze: one slow set of soft painted swirls in the upper sky with a pencil line' },
  { id: 'fx:O:wx-leaves', layer: 'fx', kind: 'O', what: 'a few two-tone painted leaves (green and autumn) fluttering on the breeze' },
];
// ---- markup helpers
const at = a => Object.entries(a).map(([k, v]) => ` ${k}="${v}"`).join('');
const F = (d, fill, a = {}) => `<path d="${d}" fill="${fill}"${at(a)}/>`;
const S = (d, stroke, w, a = {}) => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}"${at({ 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...a })}/>`;
const G = (a, ...kids) => `<g${at(a)}>${kids.join('')}</g>`;
const REF = r => ({ 'data-ref': 'wx-' + r, visibility: 'hidden' });
const DD = k => ({ 'data-detail': k });
const P = (x, y) => `${f(x)} ${f(y)}`;
const CLOUD_W = 2600, FOG_W = 3016, WIND_W = 3600, SEA_W = 2400;
// tiny deterministic hash for layout
const hh = (i, s) => { let x = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(s + 7, 0x85ebca6b); x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12; return (x >>> 0) / 4294967296; };

// Catmull-Rom through points -> cubic path (the draft's cr())
function cr(pts, closed = true, k = 1 / 6) {
  const n = pts.length; let d = `M${P(...pts[0])}`;
  const g = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    d += `C${P(p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k)} ${P(p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k)} ${P(...p2)}`;
  }
  return d + (closed ? 'Z' : '');
}
// the draft's puff(): a blobby cloud outline from bumps along a baseline (seeded)
function puffPts(cx, cy, w, h, n, R, flat = 0.25) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push([cx - w / 2 + w * t, cy - Math.sin(Math.PI * t) ** 0.8 * h * (0.7 + 0.45 * R())]); }
  pts.push([cx + w / 2 + h * 0.2, cy + h * flat * 0.4]);
  for (let i = n; i >= 0; i -= 2) pts.push([cx - w / 2 + w * i / n, cy + h * flat * (0.3 + 0.3 * R())]);
  pts.push([cx - w / 2 - h * 0.2, cy + h * flat * 0.3]);
  return pts;
}
// billowy rain-cloud outline: the upper envelope of n round lobes (tallest in the middle) over a softly wobbling
// flat belly; returns the outline points (closed) so shade passes can be derived from the same silhouette
function lobePts(cx, cy, w, h, n, R) {
  const lobes = [];
  for (let i = 0; i < n; i++) { const u = (i + 0.5) / n; lobes.push([cx - w / 2 + w * u + (R() - 0.5) * w / n * 0.5, h * (0.42 + 0.58 * Math.sin(Math.PI * u) ** 0.9) * (0.8 + 0.35 * R())]); }
  const top = [], bot = [], st = w / 46;
  for (let x = cx - w / 2 - h * 0.25; x <= cx + w / 2 + h * 0.25; x += st) {
    let y = 0;
    for (const [lx, r] of lobes) { const d = Math.abs(x - lx); if (d < r) y = Math.max(y, Math.sqrt(r * r - d * d)); }
    top.push([x, cy - Math.max(y, h * 0.12)]);
  }
  for (let i = 8; i >= 0; i--) bot.push([cx - w / 2 + w * i / 8, cy + h * (0.1 + 0.08 * R())]);
  return top.concat(bot);
}
// tapered brush ribbon along a centreline (width profile w(u)), as one filled shape
function ribbon(pts, wf) {
  const L = [], Rt = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const w = wf(i / (n - 1)) / 2;
    L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]); Rt.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
  }
  return cr(L.concat(Rt.reverse()), true);
}
// a soft tapered rain streak: fine tail up-wind, round drop head at (x, y)
const streak = (x, y, L, sl, w) => {
  const l = Math.hypot(sl, 1), dx = sl / l, dy = 1 / l, nx = -dy * w, ny = dx * w;
  return `M${P(x - dx * L, y - dy * L)}L${P(x + nx, y + ny)}Q${P(x + dx * w * 2.2, y + dy * w * 2.2)} ${P(x - nx, y - ny)}Z`;
};
// a wobbly arc (radius jitter baked from a seed) as a polyline through cr
function wobArc(cx, cy, r, a0, a1, amp, seed, n = 28) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * i / n, rr = r + amp * (Math.sin(i * 0.9 + seed) * 0.6 + (hh(i, seed) - 0.5));
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return cr(pts, false);
}
const blob = (cx, cy, rx, ry, R, n = 9, j = 0.22) => cr(Array.from({ length: n }, (_, i) => { const a = i / n * TAU, k = 1 + (R() - 0.5) * 2 * j; return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]; }));

export function build(ctx) {
  const v = ctx.v, I = r => v('ink' + r);
  const stop = (o, tk, op = 1) => `<stop offset="${o}" style="stop-color:${v(tk)};stop-opacity:${op}"/>`;
  const lg = (id, attrs, ...stops) => `<linearGradient id="${id}"${at(attrs)}>${stops.join('')}</linearGradient>`;
  // gradients: veil tops fade in softly (the gouache "wet edge"), the overcast glaze is heavier at the zenith,
  // puddles mirror the sky upside down, the fog beam fades out along its length
  const defs = [
    `<clipPath id="wx-skyclip"><rect x="-500" y="-400" width="2600" height="872"/></clipPath>`,
    lg('wx-overG', { x1: 0, y1: -300, x2: 0, y2: 476, gradientUnits: 'userSpaceOnUse' }, stop(0, 'cloudBank', 0.78), stop(0.55, 'cloudShade', 0.5), stop(1, 'cloudShade', 0.28)),
    lg('wx-veilG', { x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, 'paper', 0), stop(0.2, 'paper', 0.6), stop(0.5, 'paper', 0.82), stop(0.78, 'paper', 0.6), stop(1, 'paper', 0)),
    lg('wx-veilG2', { x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, 'cloudRim', 0), stop(0.25, 'cloudRim', 0.7), stop(0.7, 'skyHaze', 0.62), stop(1, 'skyHaze', 0.35)),
    lg('wx-veilG3', { x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, 'paper', 0), stop(0.35, 'paper', 0.55), stop(0.7, 'paper', 0.35), stop(1, 'paper', 0)),
    lg('wx-pudG', { x1: 0, y1: 0, x2: 0, y2: 1 }, stop(0, 'skyMid', 0.85), stop(0.5, 'skyLow', 0.8), stop(1, 'skyHaze', 0.9)),
    lg('wx-wetG', { x1: 0, y1: 752, x2: 0, y2: 870, gradientUnits: 'userSpaceOnUse' }, stop(0, 'line', 0.05), stop(0.5, 'line', 0.13), stop(1, 'line', 0.18)),
    lg('wx-beamG', { x1: 0, y1: 0, x2: 1, y2: 0 }, stop(0, 'beacon', 0.62), stop(0.45, 'beacon', 0.25), stop(1, 'beacon', 0)),
    `<radialGradient id="wx-shaftFade" cx="0" cy="0" r="1500" gradientUnits="userSpaceOnUse"><stop offset=".04" stop-color="#fff" stop-opacity="0"/><stop offset=".16" stop-color="#fff"/><stop offset=".55" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`,
    `<mask id="wx-shaftM" maskUnits="userSpaceOnUse" x="-1600" y="-1600" width="3200" height="3200"><rect x="-1600" y="-1600" width="3200" height="3200" fill="url(#wx-shaftFade)"/></mask>`,
    lg('wx-bowFadeG', { x1: 0, y1: 40, x2: 0, y2: 480, gradientUnits: 'userSpaceOnUse' }, `<stop offset="0" stop-color="#fff"/><stop offset=".62" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity=".12"/>`),
    `<mask id="wx-bowMask" maskUnits="userSpaceOnUse" x="300" y="-100" width="1600" height="600"><rect x="300" y="-100" width="1600" height="600" fill="url(#wx-bowFadeG)"/></mask>`,
  ].join('');
  const band = (y1, y2, amp, per, x0, x1, step, seed) => {
    const top = [], bot = [];
    for (let x = x0; x <= x1; x += step) {
      const w = amp * (Math.sin(x / FOG_W * TAU * per) * 0.7 + Math.sin(x / FOG_W * TAU * per * 2.7 + seed) * 0.3);
      top.push([x, y1 + w + (hh(wrap(x, FOG_W) / step | 0, seed) - 0.5) * amp * 0.5]); bot.push([x, y2 + w * 0.3]);
    }
    return cr(top, false) + `L${P(...bot[bot.length - 1])}L${P(...bot[0])}Z`;
  };

  // =============================================================== L-clouds: overcast, rainbow, sunbeams, storm clouds
  let ov = '';
  { const R = ctx.rng('wx-over'); for (let i = 0; i < 26; i++) { const x = -300 + R() * 2100, y = -40 + R() * 460, w = 180 + R() * 420;
    ov += S(`M${P(x, y)}c${f(w * 0.3)} ${f((R() - 0.5) * 8)} ${f(w * 0.7)} ${f((R() - 0.5) * 8)} ${f(w)} ${f((R() - 0.5) * 6)}`, R() < 0.55 ? v('cloudBank') : v('mauve'), f(8 + R() * 16), { opacity: f(0.1 + R() * 0.14) }); } }
  const over = G({ ...REF('over'), ...DD('sky:T:wx-overcast') }, F('M-300 -300h2200v776h-2200Z', 'url(#wx-overG)'), ov);

  // watercolour rainbow (fixed on screen: a rainbow is at infinity). Six bands, each three translucent passes of a
  // wobbly arc (wide bleed, body, darker core) so neighbours mix where they overlap; fades toward the horizon.
  const BX = 1080, BY = 640, R0 = 610, BW = 15;
  const bands = [I('R'), I('O'), v('pouch'), v('grassFar'), I('B'), v('skyHigh')];
  let bow = '';
  bands.forEach((c, i) => {
    const r = R0 - i * BW;
    bow += S(wobArc(BX, BY, r, Math.PI * 1.02, Math.PI * 1.98, 2.2, i * 3 + 1), c, BW * 1.9, { opacity: 0.2 });
    bow += S(wobArc(BX, BY, r, Math.PI * 1.03, Math.PI * 1.97, 1.6, i * 3 + 2), c, BW * 0.95, { opacity: 0.5 });
    bow += S(wobArc(BX, BY, r + 1.5, Math.PI * 1.08, Math.PI * 1.9, 1.2, i * 3 + 7), c, BW * 0.38, { opacity: 0.32 });
  });
  const glow = F(`M${BX - R0 + 6 * BW} ${BY}A${R0 - 6 * BW} ${R0 - 6 * BW} 0 0 1 ${BX + R0 - 6 * BW} ${BY}Z`, v('paper'), { opacity: 0.13, ...DD('sky:T:wx-bow-glow') });
  let bloom = '';
  { const R = ctx.rng('wx-bloom'); for (let i = 0; i < 7; i++) { const a = Math.PI * (1.12 + 0.76 * i / 6 + (R() - 0.5) * 0.05), r = R0 - BW * (1 + R() * 3.5);
    const x = BX + r * Math.cos(a), y = BY + r * Math.sin(a);
    const deg = f(a * 180 / Math.PI + 90);
    bloom += G({ transform: `translate(${P(x, y)}) rotate(${deg})` }, F(blob(0, 0, 16 + R() * 12, 5 + R() * 3, R, 9, 0.3), v('paper'), { opacity: f(0.18 + R() * 0.12) }),
      F(blob(2, 0, 7 + R() * 5, 2.5 + R() * 1.5, R), v('paper'), { opacity: 0.22 })); } }
  let bow2 = '';
  [...bands].reverse().forEach((c, i) => { bow2 += S(wobArc(BX, BY, R0 + 70 + i * 8, Math.PI * 1.06, Math.PI * 1.94, 1.8, i + 40), c, 9, { opacity: 0.22 }); });
  const rainbow = G({ ...REF('bow'), 'clip-path': 'url(#wx-skyclip)' }, G({ mask: 'url(#wx-bowMask)' }, glow,
    G(DD('sky:O:wx-bow2'), bow2), G(DD('sky:O:wx-rainbow'), bow), G(DD('sky:T:wx-bow-bloom'), bloom)));
  // sunbeams through the clearing clouds (soft tapered shafts, gradient-faded)
  // (drawn radiating from the origin; update() puts the origin on the sun, so the light is motivated)
  let sh = '';
  for (let i = 0; i < 7; i++) {
    const a = (196 + i * 17 + hh(i, 61) * 8) * Math.PI / 180, L = 1500, hw = (0.035 + hh(i, 62) * 0.03);
    for (const [k, o] of [[1, 0.35], [0.62, 0.45], [0.3, 0.55]]) {   // three nested passes = a soft, feathered shaft
      const w = hw * k, p1 = [Math.cos(a - w) * L, Math.sin(a - w) * L], p2 = [Math.cos(a + w) * L, Math.sin(a + w) * L];
      sh += F(`M0 0L${P(...p1)}L${P(...p2)}Z`, v('sunGlow'), { opacity: f(o * (0.22 + hh(i, 64) * 0.16)) });
    }
  }
  const beams = G({ ...REF('beams'), ...DD('sky:O:wx-sunbeams') }, G({ 'data-ref': 'wx-beamsAt', mask: 'url(#wx-shaftM)' }, sh));

  // storm clouds: gouache cumulus (draft cloud(): base + mid + lit), belly glaze, pale rim, brush dabs, virga
  let cBase = '', cMid = '', cLit = '', cRim = '', cBelly = '', cDab = '', cVir = '';
  for (let rep = 0; rep < 2; rep++) for (let i = 0; i < 5; i++) {
    const R = ctx.rng('wx-cl' + i);
    const w = 420 + R() * 300, h = 80 + R() * 50, cx = i * (CLOUD_W / 5) + 200 + R() * 180 + rep * CLOUD_W, cy = 110 + R() * 150, n = 6 + Math.floor(R() * 3);
    const base = lobePts(cx, cy, w, h, n, R), bY = cy + h * 0.12;
    cBase += cr(base, true, 1 / 5);
    const mid = lobePts(cx + w * 0.05, cy - h * 0.14, w * 0.8, h * 0.82, n - 1, R);
    cMid += cr(mid, true, 1 / 5);
    const lit = lobePts(cx + w * 0.1, cy - h * 0.34, w * 0.52, h * 0.6, Math.max(3, n - 3), R);
    cLit += cr(lit, true, 1 / 5);
    cRim += cr(lit.slice(2, 40).map(([x, y]) => [x - 1.5, y + 3]), false);
    cBelly += cr(base.map(([x, y]) => [x, bY + (y - bY) * 0.34]), true, 1 / 5);
    for (let k = 0; k < 7; k++) { const x = cx - w * 0.36 + R() * w * 0.7, y = cy - h * (0.15 + R() * 0.5), l = 14 + R() * 20;
      cDab += `M${P(x, y)}q${f(l * 0.5)} ${f(-6 - R() * 4)} ${f(l)} 0`; }
    if (i % 2 === 0) for (let k = 0; k < 6; k++) {   // virga under every other cloud: a soft curtain of long tapered drapes
      const x = cx - w * 0.3 + k * w * 0.12 + R() * 14, y = cy + h * 0.12, L = 90 + R() * 110;
      cVir += ribbon([[x, y], [x - L * 0.12, y + L * 0.5], [x - L * 0.3, y + L]], u => (1 - u) ** 0.8 * (26 + R() * 10));
    }
  }
  const clouds = G({ ...REF('clouds') },
    G(DD('sky:O:wx-virga'), F(cVir, v('cloudShade'), { opacity: 0.22 }), F(cVir, v('cloudBank'), { opacity: 0.12, transform: 'translate(10 -4)' })),
    G(DD('sky:O:wx-stormclouds'), F(cBase, v('line'), { opacity: 0.22, transform: 'translate(0 9)' }), F(cBase, v('cloudBank')), F(cBase, v('line'), { opacity: 0.34 }),
      F(cMid, v('cloudBank')), F(cMid, v('cloudShade'), { opacity: 0.55 }), F(cBelly, v('line'), { opacity: 0.2 }), F(cBelly, v('line'), { opacity: 0.14, transform: 'translate(0 4)' }), F(cLit, v('cloudShade')), F(cLit, v('cloudMid'), { opacity: 0.45 }),
      S(cRim, v('cloudLit'), 2.6, { opacity: 0.6 }), S(cBase, v('line'), 1.2, { opacity: 0.18 })),
    G(DD('sky:T:wx-cloud-dabs'), S(cDab, v('cloudLit'), 3.2, { opacity: 0.3 })));

  // =============================================================== L-atmo: far rain + sea dimples + fog + beam
  let far = '';
  for (let xi = 0, x = -280; x < 2010; xi++, x += 36) for (let yi = 0, y = 30; y < 620; yi++, y += 64) {
    const o = hh(xi % 5, yi % 3) * 46, L = 22 + hh(xi % 3, yi % 4 + 9) * 22; far += streak(x + o, y + o, L, 0.3, 1.1);
  }
  const farRain = G({ ...REF('farRain'), ...DD('fx:T:wx-rain-far') }, F(far, v('skyWashCool'), { opacity: 0.55 }));
  let dim = '', dimD = '';
  for (let rep = -1; rep < 2; rep++) { const R = ctx.rng('wx-dim'); for (let i = 0; i < 70; i++) { const x = rep * SEA_W + R() * SEA_W, y = 482 + R() ** 0.8 * 150, s = 0.5 + (y - 480) / 150;
    if (i % 3) dim += `M${P(x - 7 * s, y)}a${f(7 * s)} ${f(1.8 * s)} 0 1 0 ${f(14 * s)} 0a${f(7 * s)} ${f(1.8 * s)} 0 1 0 ${f(-14 * s)} 0Z`;
    else dimD += `M${P(x - 5 * s, y)}h${f(10 * s)}`; } }
  const seaRain = G({ ...REF('seaRain'), ...DD('sea:T:wx-searain') }, G({ 'data-ref': 'wx-seaRainMove' }, S(dim, v('foam'), 1.1, { opacity: 0.55 }), S(dimD, v('foam'), 1.6, { opacity: 0.45 })));
  // fog: three stacked veils; each fades in at its top (gradient) so the edge reads as a wet gouache wash
  const X0 = -FOG_W, X1 = 2 * FOG_W + 800;
  let fb = '';
  for (let k = -1; k < 3; k++) { const R = ctx.rng('wx-fogbrush'); for (let i = 0; i < 34; i++) { const x = k * FOG_W + R() * FOG_W, y = 380 + R() * 150, l = 60 + R() * 160;
    fb += `M${P(x, y)}c${f(l * 0.3)} ${f(-2 - R() * 3)} ${f(l * 0.7)} ${f(-2 + R() * 3)} ${f(l)} 0`; } }
  let wisp = '';
  for (let i = -2; i < 6; i++) { const j = wrap(i, 2), x = i * (FOG_W / 2) + hh(j, 71) * 500, y = 330 + hh(j, 72) * 60, w = 220 + hh(j, 73) * 200;
    wisp += ribbon([[x, y], [x + w * 0.3, y - 8], [x + w * 0.7, y + 4], [x + w, y - 3]], u => Math.sin(Math.PI * u) ** 0.7 * (18 + hh(j, 74) * 12)); }
  const fog = G({ ...REF('fog'), ...DD('sea:T:wx-fog') }, G({ 'data-ref': 'wx-fogMove' },
    F(band(330, 480, 18, 6, X0, X1, 60, 1), 'url(#wx-veilG2)'),
    F(band(372, 500, 14, 9, X0, X1, 60, 2), 'url(#wx-veilG)'),
    S(fb, v('paper'), 5, { opacity: 0.28 }),
    F(band(440, 580, 11, 5, X0, X1, 60, 3), 'url(#wx-veilG)')),
    G({ 'data-ref': 'wx-wispMove', ...DD('sea:O:wx-fogwisp') }, F(wisp, v('paper'), { opacity: 0.4 }), F(wisp, v('paper'), { opacity: 0.3, transform: 'translate(24 -6) scale(1 .7)' })));
  const beam = G({ ...REF('beam'), ...DD('sea:O:wx-fogbeam') },
    G({ 'data-ref': 'wx-beamRot' }, F('M0 -5L1100 -92Q1130 0 1100 92L0 5Z', 'url(#wx-beamG)', { opacity: 0.55 }), F('M0 -3L1000 -40Q1015 0 1000 40L0 3Z', 'url(#wx-beamG)', { opacity: 0.8 })),
    F('M-46 0a46 46 0 1 0 92 0a46 46 0 1 0 -92 0Z', v('beacon'), { opacity: 0.14 }), F('M-26 0a26 26 0 1 0 52 0a26 26 0 1 0 -52 0Z', v('beacon'), { opacity: 0.3 }),
    F('M-12 0a12 12 0 1 0 24 0a12 12 0 1 0 -24 0Z', v('beacon'), { opacity: 0.6 }), F('M-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0Z', v('beacon')));

  // =============================================================== L-shore: low mist
  let mb = '';
  for (let i = 0; i < 48; i++) { const x = (Math.floor(i / 12) - 1) * FOG_W + hh(i % 12, 81) * FOG_W, y = 628 + hh(i % 12, 82) * 50, l = 80 + hh(i % 12, 83) * 140; mb += `M${P(x, y)}c${f(l * 0.3)} -3 ${f(l * 0.7)} 2 ${f(l)} 0`; }
  const mist = G({ ...REF('mist'), ...DD('land:T:wx-mist') }, G({ 'data-ref': 'wx-mistMove' },
    F(band(590, 720, 12, 9, X0, X1, 70, 5), 'url(#wx-veilG3)'), S(mb, v('paper'), 4, { opacity: 0.25 })));

  // =============================================================== L-road: wet glaze, sheen, puddles (tile = TILE.road)
  let sheen = '';
  for (let rep = -1; rep < 3; rep++) { const R = ctx.rng('wx-sheen'); for (let i = 0; i < 9; i++) { const x = rep * TILE.road + R() * TILE.road, y = 770 + R() * 92, l = 120 + R() * 260;
    sheen += ribbon([[x, y], [x + l * 0.5, y - 1], [x + l, y]], u => Math.sin(Math.PI * u) * (2.5 + R() * 3)); } }
  let pd = '', rim = '', hi = '', rp = '', rp2 = '';
  for (let rep = -1; rep < 3; rep++) for (let i = 0; i < 3; i++) {
    const R = ctx.rng('wx-pud' + i), x = rep * TILE.road + i * 640 + hh(i, 11) * 200, y = GROUND_Y + 24 + hh(i, 12) * 28, w = 64 + hh(i, 13) * 50, hgt = 8 + hh(i, 14) * 4;
    const pts = Array.from({ length: 10 }, (_, k) => { const a = k / 10 * TAU, j = 1 + (R() - 0.5) * 0.3; return [x + Math.cos(a) * w * j, y + Math.sin(a) * hgt * (0.8 + 0.4 * R())]; });
    pd += cr(pts); rim += cr(pts.map(([px, py]) => [x + (px - x) * 1.07, y + 1.6 + (py - y) * 1.2]));
    hi += `M${P(x - w * 0.55, y - hgt * 0.25)}q${f(w * 0.2)} -2 ${f(w * 0.38)} 0M${P(x + w * 0.12, y + hgt * 0.2)}q${f(w * 0.12)} -1.5 ${f(w * 0.26)} 0`;
    rp += `M${P(x - w * 0.62, y)}a${f(w * 0.62)} ${f(hgt * 0.5)} 0 1 0 ${f(w * 1.24)} 0a${f(w * 0.62)} ${f(hgt * 0.5)} 0 1 0 ${f(-w * 1.24)} 0`;
    rp2 += `M${P(x + w * 0.1, y)}a${f(w * 0.3)} ${f(hgt * 0.28)} 0 1 0 ${f(w * 0.6)} 0a${f(w * 0.3)} ${f(hgt * 0.28)} 0 1 0 ${f(-w * 0.6)} 0`;
  }
  const puddles = G({ ...REF('puddles') }, F('M-600 756h2800v114h-2800Z', 'url(#wx-wetG)', DD('land:T:wx-wetroad')),
    G({ 'data-ref': 'wx-pudMove' },
      F(sheen, v('skyHaze'), { opacity: 0.3 }),
      G(DD('land:O:wx-puddles'), F(rim, v('line'), { opacity: 0.28 }), F(pd, 'url(#wx-pudG)', { opacity: 0.92 }), S(pd, v('line'), 1.1, { opacity: 0.3 }), S(hi, v('paper'), 1.8, { opacity: 0.85 })),
      G({ 'data-ref': 'wx-ripple', ...DD('land:T:wx-ripples') }, S(rp, v('paper'), 1.1, { opacity: 0.75 })),
      G({ 'data-ref': 'wx-ripple2' }, S(rp2, v('paper'), 0.9, { opacity: 0.7 }))));

  // =============================================================== L-fx-back: ONE calm breeze + a few leaves
  // A single set per WIND_W (wider than the view + margins, so at most one set is ever on screen): three soft tapered
  // brush ribbons stacked in the upper sky; the top one ends in one slow curl; a thin pencil line doubles it.
  const windSet = (x0, y0) => {
    const top = [];
    const L = 520;
    for (let k = 0; k <= 14; k++) { const u = k / 14; top.push([x0 + L * (1 - u), y0 + Math.sin(u * Math.PI * 1.4) * 9]); }
    const e = top[top.length - 1], R0c = 22, c = [e[0], e[1] - R0c];
    for (let k = 1; k <= 12; k++) { const a = Math.PI / 2 + k / 12 * Math.PI * 1.55, r = R0c * (1 - 0.5 * k / 12); top.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]); }
    const n = top.length;
    let d = ribbon(top, u => (u < 0.12 ? u / 0.12 : 1) ** 0.6 * (10 - 7.5 * u));
    let glaze = ribbon(top.slice(0, n - 4), u => (u < 0.15 ? u / 0.15 : 1) ** 0.6 * (22 - 14 * u));
    let pencil = cr(top.slice(1, n - 2).map(([x, y]) => [x + 1.5, y - 4.5]), false);
    for (let s = 1; s <= 2; s++) {
      const pts = []; const Ls = L - 120 * s, xs = x0 + 60 * s, ys = y0 + 26 * s;
      for (let k = 0; k <= 10; k++) { const u = k / 10; pts.push([xs + Ls * (1 - u), ys + Math.sin(u * Math.PI * 1.2 + s) * 6]); }
      d += ribbon(pts, u => Math.sin(Math.PI * u) ** 0.7 * (8 - 1.5 * s));
      glaze += ribbon(pts, u => Math.sin(Math.PI * u) ** 0.7 * (18 - 3 * s));
    }
    const flick = `M${P(x0 + L + 30, y0 + 4)}h18M${P(x0 + L + 64, y0 + 10)}h10M${P(x0 + L - 20, y0 + 44)}h14`;
    return { d, pencil, flick, glaze };
  };
  let wd = '', wp = '', wf = '', wg = '';
  for (let rep = 0; rep < 2; rep++) { const s = windSet(rep * WIND_W + 300, 130); wd += s.d; wp += s.pencil; wf += s.flick; wg += s.glaze; }
  const leafD = 'M0 0C3 -7 13 -8 18 0C13 7 3 7 0 0Z', leafHalf = 'M0 0C3 -7 13 -8 18 0Z';
  const leafCols = [[v('foliage'), v('grassFar')], [I('O'), v('pouch')], [v('grassNear'), v('grassFar')], [I('R'), I('O')]];
  let leaves = '';
  for (let i = 0; i < 4; i++) leaves += G({ 'data-ref': 'wx-leaf' + i }, G({ 'data-ref': 'wx-leafF' + i },
    F(leafD, leafCols[i][0], { stroke: v('line'), 'stroke-width': 0.9 }), F(leafHalf, leafCols[i][1], { opacity: 0.7 }),
    S('M-3 1Q2 0.5 17 0M6 0l3 -3M11 0l3 -3M6 0l3 3', v('line'), 0.7, { opacity: 0.8 })));
  const wind = G({ ...REF('wind') },
    G({ 'data-ref': 'wx-windMove', ...DD('fx:O:wx-wind') }, F(wg, v('paper'), { opacity: 0.16 }), F(wd, v('paper'), { opacity: 0.72 }), S(wp, v('lineSoft'), 1, { opacity: 0.35 }), S(wf, v('paper'), 2.2, { opacity: 0.45 })),
    G(DD('fx:O:wx-leaves'), leaves));

  // =============================================================== L-fx-front: near rain + round splashes
  let nr = '', nr2 = '';
  for (let xi = 0, x = -288; x < 2042; xi++, x += 46) for (let yi = 0, y = -390; y < 1180; yi++, y += 124) {
    const o = hh(xi % 5 + 50, yi % 3) * 104, L = 26 + hh(xi % 4, yi % 2 + 20) * 34;
    if ((xi + yi) % 3) nr += streak(x + o, y + o, L, 0.3, 1.5); else nr2 += streak(x + o, y + o, L * 0.8, 0.3, 1.2);
  }
  const rain = G({ ...REF('rain'), ...DD('fx:T:wx-rain') }, G({ 'data-ref': 'wx-rainMove' }, F(nr, v('paper'), { opacity: 0.6 }), F(nr2, v('skyWashCool'), { opacity: 0.7 })));
  const crown = [[-11, -7, 2.2], [-6, -13, 2.6], [0, -16, 2.8], [6, -13, 2.6], [11, -7, 2.2]].map(([x, y, r]) => `M${P(x - r, y)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`).join('');
  let sp = '';
  for (let i = 0; i < 10; i++) sp += G({ 'data-ref': 'wx-sp' + i },
    F('M-12 1a12 3 0 1 0 24 0a12 3 0 1 0 -24 0Z', v('paper'), { opacity: 0.35 }), S('M-12 1a12 3 0 1 0 24 0a12 3 0 1 0 -24 0Z', v('paper'), 1.1, { opacity: 0.8 }),
    F(crown, v('paper'), { opacity: 0.9 }), S('M-4 0q4 -6 8 0', v('paper'), 1.6));
  const splashes = G({ ...REF('splashes'), ...DD('fx:O:wx-splashes') }, sp);
  return {
    defs,
    layers: {
      'L-clouds': G({ id: 'wx-sky' }, over, beams, rainbow, clouds),
      'L-atmo': G({ id: 'wx-atmo' }, farRain, seaRain, fog, beam),
      'L-shore': G({ id: 'wx-shore' }, mist),
      'L-road': G({ id: 'wx-road' }, puddles),
      'L-fx-back': G({ id: 'wx-back' }, wind),
      'L-fx-front': G({ id: 'wx-front' }, splashes, rain),
    },
  };
}

export function attach(svg, ctx) {
  const r = {};
  for (const el of svg.querySelectorAll('[data-ref^="wx-"]')) r[el.getAttribute('data-ref').slice(3)] = el;
  const cape = svg.querySelector('[data-ref="sea-cape"]');
  const cache = new WeakMap();
  const set = (el, k, val) => { if (!el) return; let m = cache.get(el); if (!m) cache.set(el, (m = {})); if (m[k] !== val) { m[k] = val; el.setAttribute(k, val); } };
  const op = a => a > 0.97 ? '1' : (Math.round(clamp(a, 0, 1) * 50) / 50).toString();   // steady = opaque group (no offscreen layer)
  // root groups are detached from the DOM while a weather is absent (most of the ride), re-inserted when it comes
  const slots = new Map();
  for (const k of ['over', 'beams', 'bow', 'clouds', 'farRain', 'seaRain', 'fog', 'beam', 'mist', 'puddles', 'wind', 'rain', 'splashes']) {
    const el = r[k]; if (!el) continue; const ph = document.createComment(k); el.parentNode.insertBefore(ph, el); el.remove(); slots.set(el, ph);
  }
  const showA = (el, a) => {
    const on = a > 0.01, ph = slots.get(el);
    if (ph) { if (on && !el.isConnected) { ph.parentNode.insertBefore(el, ph); set(el, 'visibility', 'inherit'); } else if (!on && el.isConnected) el.remove(); }
    else set(el, 'visibility', on ? 'inherit' : 'hidden');
    if (on) set(el, 'opacity', op(a));
  };
  return {
    update(fr) {
      const w = fr.weather; if (!w) return;
      const t = fr.t, D = fr.distance, red = fr.reduced || ctx.reduced;
      // sky
      showA(r.over, w.cloud * 0.85);
      showA(r.bow, w.bow * 0.9);
      showA(r.beams, w.bow * (1 - w.cloud) * 0.8);
      showA(r.clouds, sstep(0.2, 0.7, w.cloud));
      if (w.cloud > 0.2) set(r.clouds, 'transform', `translate(${f(-wrap(D * 0.03 + t * 26, CLOUD_W))} ${f(-70 * (1 - sstep(0.2, 0.8, w.cloud)))})`);
      // rain: soft streaks fall a little slower than C's (a painted drizzle, not a sheet of needles)
      const rn = red ? 0 : w.rain;
      showA(r.farRain, rn * 0.85); showA(r.rain, rn); showA(r.seaRain, w.rain * 0.9);
      if (rn > 0.01) {
        const k = t * 1100;
        set(r.farRain, 'transform', `translate(${f(-wrap(k * 0.3 * 0.45, 180))} ${f(wrap(k * 0.45, 192) - 140)})`);
        set(r.rainMove, 'transform', `translate(${f(-wrap(k * 0.3 + D * 0.2, 230))} ${f(wrap(k, 372))})`);
      }
      if (w.rain > 0.01) set(r.seaRainMove, 'transform', `translate(${f(-wrap(D * 0.1, 2400))} 0)`);
      showA(r.splashes, red ? 0 : w.rain);
      if (!red && w.rain > 0.01) for (let i = 0; i < 10; i++) {
        const p = wrap(t * 1.9 + i * 0.31, 1), n = Math.floor(t * 1.9 + i * 0.31);
        set(r['sp' + i], 'transform', `translate(${f(hh(n, i) * 1700 - 50)} ${f(GROUND_Y - 26 + hh(n, i + 9) * 72)}) scale(${f(0.35 + p * 0.8)} ${f(1 - p * 0.45)})`);
        set(r['sp' + i], 'opacity', op(1 - p * p));
      }
      // puddles + rain rings
      showA(r.puddles, w.wet);
      if (w.wet > 0.01) {
        set(r.pudMove, 'transform', `translate(${f(-wrap(D, TILE.road))} 0)`);
        const rp = red ? 0.5 : wrap(t * 1.3, 1), rq = red ? 0.2 : wrap(t * 1.3 + 0.5, 1), cy = GROUND_Y + 38;
        showA(r.ripple, w.rain * (1 - rp)); showA(r.ripple2, w.rain * (1 - rq));
        set(r.ripple, 'transform', `translate(0 ${cy}) scale(${f(0.55 + rp * 0.5)} ${f(0.8 + rp * 0.4)}) translate(0 ${-cy})`);
        set(r.ripple2, 'transform', `translate(0 ${cy}) scale(${f(0.5 + rq * 0.6)} 1) translate(0 ${-cy})`);
      }
      // fog veils slide (translation) unless reduced
      showA(r.fog, sstep(0, 0.5, w.fog)); showA(r.mist, sstep(0.1, 0.6, w.fog));
      if (w.fog > 0.01) {
        set(r.fogMove, 'transform', `translate(${f(-wrap(red ? 800 : D * 0.2 + t * 10, FOG_W))} ${f(40 * (1 - sstep(0, 0.8, w.fog)))})`);
        set(r.wispMove, 'transform', `translate(${f(-wrap(red ? 400 : D * 0.24 + t * 22, FOG_W))} ${f(40 * (1 - sstep(0, 0.8, w.fog)))})`);
        set(r.mistMove, 'transform', `translate(${f(-wrap(red ? 500 : D * 0.6 + t * 16, FOG_W))} 0)`);
      }
      // beam from the lighthouse lantern (hero lamp 1150, 269 in the cape's frame; cape moves at depth .07)
      let bx = null;
      if (w.fog > 0.05 && cape) {
        const m = /translate\((-?[\d.]+)/.exec(cape.getAttribute('transform') || '');
        bx = 1150 + (m ? +m[1] : 0);
      }
      const beamOn = bx !== null && bx > -900 && bx < 2500 ? w.fog : 0;
      showA(r.beam, beamOn);
      if (beamOn > 0.01) {
        set(r.beam, 'transform', `translate(${f(bx)} 269)`);
        const th = red ? 2.6 : t * (TAU / 9);
        set(r.beamRot, 'transform', `scale(${f(Math.cos(th))} 1)`);
      }
      // wind: calm. One set glides left at sky pace; a gust only nudges it; leaves drift slowly behind the rider
      const wn = red ? 0 : sstep(0.3, 0.9, w.wind);
      showA(r.wind, wn);
      if (wn > 0.01) {
        // (the speed is constant: multiplying t by a varying gust made the band jump; the gust only breathes the bob)
        set(r.windMove, 'transform', `translate(${f(-wrap(t * 58 + D * 0.03 + 24 * Math.sin(t * 0.21), WIND_W))} ${f(Math.sin(t * 0.4) * (4 + 5 * w.gust))})`);
        for (let i = 0; i < 4; i++) {
          const p = wrap(t * 0.075 + i / 4 + 0.13 * Math.sin(i * 2.1), 1);
          set(r['leaf' + i], 'transform', `translate(${f(1950 - p * 2400)} ${f(540 + 22 * i + Math.sin(p * 7.5 + i) * 26)}) rotate(${f(Math.sin(p * 9 + i) * 70 + i * 50)})`);
          set(r['leafF' + i], 'transform', `scale(1 ${f(0.35 + 0.65 * Math.abs(Math.cos(p * 11 + i)))})`);
        }
      }
    },
  };
}
