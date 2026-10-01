// OWNER: weather. Neon Pelican (style X) weather: a rain-slick megacity. Reads frame.weather (documented in director.js):
// wind, gust, cloud, rain, fog, bow, wet. On top of the director's channels this module derives its own city weather:
//   · drizzle — light rain almost all the time (the neon city is never quite dry), off only in the rare clear moment;
//   · downpour — the director's shower (rain → 1): long heavy streaks, rain sheets sweeping the harbour, road spray,
//     lightning striking among the towers (its own schedule, interleaved with sky.js's flashes);
//   · smog — the director's fog: two sliding smog banks with neon signs bleeding through, low street smog, and the
//     data-spire searchlight turning volumetric in it (synced to sea.js's sweep);
//   · the clear moment — the director's rainbow window (bow) becomes the rain stopping, a pelican asterism showing
//     through the smog and a huge hologram AURORA AD ("雨停了 RAIN BREAK") projected over the skyline;
//   · calm wind — ONE slow holographic data-stream (never curls, never fast).
// Performance (STYLE-X §2): NO filters anywhere. Rain, far rain, rain shafts, rain sheets, smog banks, street smog and the
// aurora are static tiles on their own composited sheets (export `sheets`): per frame they only translate (a compositor
// move, no raster). Glows are stacked strokes and gradients. Short-lived extras (bolts, splashes, puddles, ripples) are
// small pooled elements moved by transform / opacity; groups that are absent are detached from the DOM.
// Reduced motion: rain is a still, lighter screen; no splashes, no ripples, no lightning flashes, static smog.
import { GROUND_Y } from '../contract.js';
import { f, circ, ell, rect, wrap, clamp, sstep, TAU, lapScript } from './director.js';
import { LAP, KM, hash } from './route.js';

export const id = 'weather';
export const materials = {};
export const detailItems = [
  { id: 'sky:T:wx-overcast', layer: 'sky', kind: 'T', what: 'storm overprint: the smog closes over the neon sky as the downpour comes' },
  { id: 'sky:O:wx-rainshafts', layer: 'sky', kind: 'O', what: 'rain shafts hanging from the smog deck between the far towers, lit magenta from below' },
  { id: 'sky:T:wx-shaft-streaks', layer: 'sky', kind: 'T', what: 'fine slanted streak texture inside the rain shafts' },
  { id: 'sky:O:wx-bolt', layer: 'sky', kind: 'O', what: 'forked lightning (3 variants) striking down among the towers, with a lit cloud base' },
  { id: 'sky:O:wx-spider', layer: 'sky', kind: 'O', what: 'spider lightning crawling along the underside of the smog deck' },
  { id: 'sky:O:wx-aurora', layer: 'sky', kind: 'O', what: 'the hologram aurora: two stepped curtains cycling cyan / acid / magenta / violet with bright hems' },
  { id: 'sky:T:wx-aurora-rays', layer: 'sky', kind: 'T', what: 'vertical ray texture of the aurora curtains' },
  { id: 'sky:O:wx-ad', layer: 'sky', kind: 'O', what: 'the aurora ad panel: scanlined holo frame, corner brackets, ハレ tag, segment bar' },
  { id: 'sky:O:wx-ad-logo', layer: 'sky', kind: 'O', what: 'the ad logo: a pelican-head roundel with a fish in the pouch' },
  { id: 'sky:O:wx-ad-type', layer: 'sky', kind: 'O', what: 'ad lettering: 雨停了 / RAIN BREAK / 趁雨停 快送鱼 · DELIVER WHILE DRY, with a magenta ghost' },
  { id: 'sky:O:wx-projectors', layer: 'sky', kind: 'O', what: 'twin projector beams rising from behind the skyline to the aurora ad' },
  { id: 'sky:O:wx-asterism', layer: 'sky', kind: 'O', what: 'through the parted smog: a pelican-shaped asterism tagged IC 5070 · 鹈鹕星云 (the real Pelican Nebula)' },
  { id: 'fx:T:wx-rain', layer: 'fx', kind: 'T', what: 'the drizzle: pooled fine pale streaks, always falling on the city' },
  { id: 'fx:O:wx-rain-neon', layer: 'fx', kind: 'O', what: 'rain streaks catching the neon: magenta, cyan and amber streaks with a stacked-stroke glow' },
  { id: 'fx:T:wx-farrain', layer: 'fx', kind: 'T', what: 'far rain curtain over the harbour, tinted by the city glow' },
  { id: 'fx:T:wx-downpour', layer: 'fx', kind: 'T', what: 'the downpour: long, wind-slanted heavy streaks' },
  { id: 'fx:O:wx-rainsheets', layer: 'fx', kind: 'O', what: 'gusted sheets of rain sweeping across the harbour in the downpour' },
  { id: 'fx:O:wx-splashes', layer: 'fx', kind: 'O', what: 'splash crowns on the wet road (pale, cyan- and magenta-glinting variants)' },
  { id: 'fx:O:wx-flash', layer: 'fx', kind: 'O', what: 'the lightning flash lighting the smog, the skyline and the puddles' },
  { id: 'fx:O:wx-datastream', layer: 'fx', kind: 'O', what: 'the calm wind: one slow holographic data-stream (dashed lanes and packet bits)' },
  { id: 'sea:T:wx-smog', layer: 'sea', kind: 'T', what: 'two sliding smog banks, far violet and near haze, rolling over the harbour' },
  { id: 'sea:O:wx-neonbleed', layer: 'sea', kind: 'O', what: 'neon signs bleeding through the smog as soft magenta / cyan / amber / acid blooms' },
  { id: 'sea:O:wx-fogbeam', layer: 'sea', kind: 'O', what: 'the data-spire searchlight turning volumetric in the smog (synced to its sweep)' },
  { id: 'land:O:wx-puddles', layer: 'land', kind: 'O', what: 'five irregular road puddles mirroring the smog sky, with wet dark lips and lit rims' },
  { id: 'land:T:wx-puddle-reflect', layer: 'land', kind: 'T', what: 'wobbly neon sign reflections (magenta, cyan, amber, acid) inside the puddles' },
  { id: 'land:O:wx-ripples', layer: 'land', kind: 'O', what: 'raindrop ripple rings spreading in the puddles' },
  { id: 'land:T:wx-streetsmog', layer: 'land', kind: 'T', what: 'low street smog drifting over the promenade' },
  { id: 'land:T:wx-spray', layer: 'land', kind: 'T', what: 'road spray: a pale mist of bouncing droplets over the tarmac in the downpour' },
];
// moving strips (core/sheets.js): pure-translate tiles, composited
export const sheets = ['rainA', 'rainB', 'farRainMove', 'gustMove', 'shaftMove', 'fogFarMove', 'fogNearMove', 'mistMove', 'clearMove']
  .map(k => `[data-ref="wx-${k}"]`);

const F = (d, fill, a = {}) => `<path d="${d}" fill="${fill}"${Object.entries(a).map(([k, v]) => ` ${k}="${v}"`).join('')}/>`;
const S = (d, stroke, w, a = {}) => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}"${Object.entries({ 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...a }).map(([k, v]) => ` ${k}="${v}"`).join('')}/>`;
const G = (a, ...kids) => `<g${Object.entries(a).map(([k, v]) => ` ${k}="${v}"`).join('')}>${kids.join('')}</g>`;
const REF = r => ({ 'data-ref': 'wx-' + r, visibility: 'hidden' });
// translucent washes never catch the pointer (nor hide what is under them from hit tests): inline, so it wins
const NOHIT = { style: 'pointer-events:none !important' };
const nohit = m => m.replace(/<(path|rect|circle|ellipse)(?![^>]*pointer-events)/g, '<$1 style="pointer-events:none !important"');
const DD = k => ({ 'data-detail': k });
// glow = stacked strokes (no filters): a wide faint pass under a thin bright one
const GLOW = (d, c, w, a = 1, core = null) => S(d, c, w * 4, { opacity: f(0.12 * a) }) + S(d, c, w * 2, { opacity: f(0.22 * a) }) + S(d, core || c, w, { opacity: f(Math.min(1, 0.95 * a)) });
const FOG_W = 3016, WIND_W = 3200, SHAFT_W = 3400, GUST_W = 2800;
const PUD_SP = 640, PUD_N = 5;                     // puddle slots along the road (pooled, hashed: no quick repeats)
const AX = 800, AY = 160, APAR = 0.008;            // the aurora ad: centre at mid-window, a slow far drift (clear of the HUD corners)
const hh = (i, s) => { let x = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(s + 7, 0x85ebca6b); x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12; return (x >>> 0) / 4294967296; };
const stop = (o, c, a) => `<stop offset="${o}" style="stop-color:${c};stop-opacity:${a}"/>`;
const lin = (id, x1, y1, x2, y2, stops, user) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${user ? ' gradientUnits="userSpaceOnUse"' : ''}>${stops.join('')}</linearGradient>`;
const rad = (id, stops) => `<radialGradient id="${id}">${stops.join('')}</radialGradient>`;
// smooth closed blob through jittered radii (Catmull-Rom -> cubic)
function blob(cx, cy, rx, ry, n, seed, jit = 0.18) {
  const p = [];
  for (let i = 0; i < n; i++) { const a = i / n * TAU, k = 1 + jit * (hh(i, seed) * 2 - 1); p.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  let d = `M${f(p[0][0])} ${f(p[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + 'Z';
}
// glyph run -> merged path (em 100, y down) anchored on the baseline; falls back to the CJK table
function txt(T, str, size, ox, oy, { align = 'start', track = 4 } = {}) {
  const s = size / 100; let pen = 0; const parts = [];
  for (const ch of str) {
    if (ch === ' ') { pen += 32 + track; continue; }
    const g = T[ch] || GZ[ch]; if (!g) continue;
    parts.push([pen, g[1]]); pen += g[0] + track;
  }
  const w = (pen - track) * s, x0 = ox - (align === 'middle' ? w / 2 : align === 'end' ? w : 0);
  let d = '';
  for (const [p, gd] of parts) { let i = 0; d += gd.replace(/-?\d+(\.\d+)?/g, m => { const v = +m, o = i % 2 === 0 ? x0 + (v + p) * s : oy + v * s; i++; return ' ' + f(o); }); }
  return { d, w };
}
// periodic rain tile: a grid of streaks whose layout repeats every cols·colW × rows·rowH, split into colour buckets
function rainTile({ salt, colW, rowH, cols, rows, x0, x1, y0, y1, slant, L0, L1, mix }) {
  const out = {}, keys = Object.keys(mix);
  for (const k of keys) out[k] = '';
  const nx = Math.ceil((x1 - x0) / colW), ny = Math.ceil((y1 - y0) / rowH);
  for (let xi = 0; xi < nx; xi++) for (let yi = 0; yi < ny; yi++) {
    const a = xi % cols, b = yi % rows, c = a * 97 + b;
    const x = x0 + xi * colW + hh(c, salt) * colW, y = y0 + yi * rowH + hh(c, salt + 1) * rowH, L = L0 + (L1 - L0) * hh(c, salt + 2);
    let u = hh(c, salt + 3), k = keys[keys.length - 1];
    for (const kk of keys) { if (u < mix[kk]) { k = kk; break; } u -= mix[kk]; }
    out[k] += `M${f(x)} ${f(y)}l${f(-L * slant)} ${f(L)}`;
  }
  return out;
}
// jagged lightning channel with side branches (midpoint-ish random walk), deterministic
function bolt(seed, len, dx) {
  const n = 16, pts = [[0, 0]];
  let x = 0;
  for (let i = 1; i <= n; i++) { x += (hh(i, seed) - 0.5) * 30 + dx / n; pts.push([x, len * i / n + (hh(i, seed + 1) - 0.5) * 8]); }
  let d = 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L'), br = '';
  for (let b = 0; b < 3; b++) {
    const s = pts[3 + Math.floor(hh(b, seed + 2) * 9)], dir = hh(b, seed + 3) < 0.5 ? -1 : 1, m = 5 + Math.floor(hh(b, seed + 4) * 3);
    let bx = s[0], by = s[1]; br += `M${f(bx)} ${f(by)}`;
    for (let i = 0; i < m; i++) { bx += dir * (8 + hh(i + b * 9, seed + 5) * 16); by += 9 + hh(i + b * 9, seed + 6) * 14; br += `L${f(bx)} ${f(by)}`; }
  }
  return { d, br, tip: pts[n] };
}

export function build(ctx) {
  const v = ctx.v;
  const C = { mag: v('magenta'), magC: v('magentaCore'), cy: v('cyan'), cyC: v('cyanCore'), ac: v('acid'), acC: v('acidCore'), am: v('amber'),
    vi: v('violet'), viC: v('violetCore'), void: v('void') };
  // ---------------------------------------------------------------- defs: gradients + two static textures
  let defs = ''
    + lin('wx-gFlash', 0, -200, 0, 600, [stop(0, C.viC, 0.75), stop(0.55, C.viC, 0.3), stop(1, C.viC, 0)], true)
    + lin('wx-gOver', 0, -300, 0, 480, [stop(0, v('smog0'), 0.9), stop(0.7, v('smog0'), 0.55), stop(1, v('smog1'), 0.2)], true)
    + lin('wx-gShaft', 0, 0, 0, 1, [stop(0, v('smog1'), 0), stop(0.12, v('smogHi'), 0.32), stop(0.7, v('haze'), 0.4), stop(1, v('smogLit'), 0.45)])
    + lin('wx-gSmogFar', 0, 0, 0, 1, [stop(0, v('smogHi'), 0), stop(0.12, v('smogHi'), 0.55), stop(0.4, v('haze'), 0.85), stop(1, v('haze'), 0.92)])
    + lin('wx-gSmogNear', 0, 0, 0, 1, [stop(0, v('smogHi'), 0), stop(0.18, v('smogHi'), 0.6), stop(0.6, v('haze'), 0.7), stop(1, v('haze'), 0.45)])
    + lin('wx-gMist', 0, 0, 0, 1, [stop(0, v('haze'), 0), stop(0.45, v('haze'), 0.5), stop(1, v('smogHi'), 0.18)])
    + lin('wx-gSpray', 0, 752, 0, 812, [stop(0, C.cyC, 0), stop(0.6, C.cyC, 0.16), stop(1, C.cyC, 0.04)], true)
    + lin('wx-gBeam', 0, 0, 1, 0, [stop(0, C.cyC, 0.55), stop(0.35, C.cy, 0.22), stop(1, C.cy, 0)])
    + lin('wx-gProj', 0, 1, 0, 0, [stop(0, C.cyC, 0.5), stop(0.4, C.cy, 0.16), stop(1, C.cy, 0.04)])
    + lin('wx-gSheet', 0, 0, 0, 1, [stop(0, C.cyC, 0), stop(0.3, C.cyC, 0.1), stop(1, C.cyC, 0.02)])
    + lin('wx-gAur', -1800, 0, 1800, 0, [stop(0, C.vi, 1), stop(0.16, C.cy, 1), stop(0.32, C.ac, 1), stop(0.46, C.cy, 1), stop(0.6, C.mag, 1), stop(0.74, C.vi, 1), stop(0.88, C.cy, 1), stop(1, C.ac, 1)], true)
    + lin('wx-gPud', 0, 0, 0, 1, [stop(0, v('sky3'), 0.9), stop(0.45, v('sky2'), 0.9), stop(1, v('sky1'), 0.95)])
    + rad('wx-rMag', [stop(0, C.mag, 0.42), stop(0.45, C.mag, 0.16), stop(1, C.mag, 0)])
    + rad('wx-rCy', [stop(0, C.cy, 0.4), stop(0.45, C.cy, 0.14), stop(1, C.cy, 0)])
    + rad('wx-rAm', [stop(0, C.am, 0.42), stop(0.45, C.am, 0.15), stop(1, C.am, 0)])
    + rad('wx-rAc', [stop(0, C.ac, 0.45), stop(0.5, C.ac, 0.15), stop(1, C.ac, 0)])
    + rad('wx-rVi', [stop(0, C.viC, 0.8), stop(0.45, C.vi, 0.3), stop(1, C.vi, 0)])
    // textures in local coordinates, only on static / translating sheets
    + `<pattern id="wx-pShaft" width="18" height="46" patternUnits="userSpaceOnUse"><path d="M4 0l-5 20M13 18l-5 20M9 -8l-3 12M9 38l-3 12" stroke="${C.cyC}" stroke-width="1.1" stroke-opacity="0.5" fill="none"/></pattern>`
    + `<pattern id="wx-pSheet" width="26" height="60" patternUnits="userSpaceOnUse"><path d="M6 0l-12 34M19 26l-12 34M32 -8l-12 34" stroke="${C.cyC}" stroke-width="1.2" stroke-opacity="0.35" fill="none"/></pattern>`
    + `<pattern id="wx-pScan" width="8" height="4" patternUnits="userSpaceOnUse"><path d="M0 0.6h8" stroke="${C.cy}" stroke-width="1.1" stroke-opacity="0.35"/></pattern>`;

  // ================================================================ L-clouds (sky): overcast, rain shafts, lightning, clear moment
  const over = G({ ...REF('over'), ...NOHIT, ...DD('sky:T:wx-overcast') }, F(rect(-500, -400, 2600, 880), 'url(#wx-gOver)'));
  // rain shafts: trapezoids hanging from the deck (y≈70) behind the skyline (their feet hide behind the towers)
  let shB = '', shT = '', shL = '';
  for (let rep = -1; rep < 2; rep++) for (let i = 0; i < 8; i++) {
    const x = rep * SHAFT_W + i * (SHAFT_W / 8) + hh(i, 40) * 180, w = 120 + hh(i, 41) * 170, lean = -40 - hh(i, 42) * 70, y0 = 60 + hh(i, 43) * 50;
    const q = `M${f(x)} ${f(y0)}h${f(w)}L${f(x + w + lean + 30)} 480H${f(x + lean - 30)}Z`;
    shB += q; shT += q;
    shL += `M${f(x + w * 0.3)} ${f(y0 + 8)}L${f(x + w * 0.3 + lean)} 470M${f(x + w * 0.72)} ${f(y0 + 14)}L${f(x + w * 0.72 + lean + 10)} 470`;
  }
  const shafts = G({ ...REF('shafts'), ...NOHIT, ...DD('sky:O:wx-rainshafts') }, G({ 'data-ref': 'wx-shaftMove' },
    F(shB, 'url(#wx-gShaft)'), F(shT, 'url(#wx-pShaft)', DD('sky:T:wx-shaft-streaks')), S(shL, v('smogLit'), 2, { opacity: 0.16 })));
  // lightning: 3 forked strikes + 1 spider crawl, each a stacked-stroke glow + a lit cloud base
  let bolts = '';
  for (let i = 0; i < 3; i++) {
    const b = bolt(300 + i * 17, 300 + i * 45, (i - 1) * 60);
    bolts += G({ 'data-ref': 'wx-bolt' + i, visibility: 'hidden', ...DD('sky:O:wx-bolt') },
      F(ell(0, 4, 190, 56), 'url(#wx-rVi)'),
      S(b.br, C.vi, 6, { opacity: 0.16 }), S(b.br, C.viC, 1.6, { opacity: 0.75 }),
      S(b.d, C.vi, 14, { opacity: 0.14 }), S(b.d, C.viC, 5, { opacity: 0.45 }), S(b.d, '#FFFFFF', 1.8),
      F(ell(b.tip[0], b.tip[1], 26, 8), 'url(#wx-rVi)'));
  }
  let sp = 'M-340 0', spB = '';
  for (let i = 1; i <= 22; i++) { const x = -340 + i * 31, y = (hh(i, 350) - 0.5) * 22 + Math.sin(i * 0.7) * 10; sp += `L${f(x)} ${f(y)}`; if (i % 4 === 1) spB += `M${f(x)} ${f(y)}l${f(8 + hh(i, 351) * 14)} ${f(10 + hh(i, 352) * 16)}l${f(10)} ${f(4 + hh(i, 353) * 8)}`; if (i % 5 === 3) spB += `M${f(x)} ${f(y)}l${f(-6 - hh(i, 354) * 12)} ${f(-8 - hh(i, 355) * 10)}`; }
  const spider = G({ 'data-ref': 'wx-spider', visibility: 'hidden', ...DD('sky:O:wx-spider') }, F(ell(0, 0, 420, 70), 'url(#wx-rVi)'),
    S(spB, C.viC, 1.4, { opacity: 0.7 }), S(sp, C.vi, 10, { opacity: 0.16 }), S(sp, C.viC, 3.4, { opacity: 0.5 }), S(sp, '#FFFFFF', 1.3));
  const storm = G({ ...REF('storm') }, bolts, spider);

  // ---- the clear moment: pelican asterism + the hologram aurora ad (anchored at the rainbow window's centre)
  // aurora curtains: three stepped bands above a bright hem, coloured along x by one gradient, rays on top
  const curtain = (seed, hemY, amp, x0, x1, hMid, hTop, alpha) => {
    const hem = x => hemY + amp * Math.sin(x / 520 + seed) + amp * 0.45 * Math.sin(x / 190 + seed * 2.3);
    const top = (x, H) => hem(x) - H * (0.7 + 0.3 * Math.sin(x / 330 + seed * 1.7)) - H * 0.25 * Math.sin(x / 90 + seed);
    const band = (Ha, Hb) => { let a = '', b = ''; for (let x = x0; x <= x1; x += 20) { a += `${x === x0 ? 'M' : 'L'}${x} ${f(Ha ? top(x, Ha) : hem(x))}`; b = `L${x} ${f(top(x, Hb))}` + b; } return a + b + 'Z'; };
    let hemD = '', rays = '';
    for (let x = x0; x <= x1; x += 20) hemD += `${x === x0 ? 'M' : 'L'}${x} ${f(hem(x))}`;
    for (let x = x0, i = 0; x <= x1; x += 6 + hh(i, seed * 10) * 5, i++) { const hy = hem(x), L = 30 + hh(i, seed * 10 + 1) * (hTop * 0.9); rays += `M${f(x)} ${f(hy - 3)}v${f(-L)}`; }
    return F(band(0, 16), 'url(#wx-gAur)', { opacity: f(0.5 * alpha) }) + F(band(16, hMid), 'url(#wx-gAur)', { opacity: f(0.22 * alpha) })
      + F(band(hMid, hTop), 'url(#wx-gAur)', { opacity: f(0.09 * alpha) })
      + S(rays, 'url(#wx-gAur)', 1.3, { opacity: f(0.3 * alpha), 'stroke-linecap': 'butt', 'data-detail': 'sky:T:wx-aurora-rays' })
      + S(hemD, 'url(#wx-gAur)', 9, { opacity: f(0.14 * alpha) }) + S(hemD, 'url(#wx-gAur)', 2.2, { opacity: f(0.85 * alpha) });
  };
  const aurora = G(DD('sky:O:wx-aurora'), curtain(0.6, -80, 22, -1800, 1800, 70, 150, 0.45), curtain(2.1, 20, 30, -1800, 1800, 60, 170, 0.72));
  // projector beams from behind the skyline
  const proj = G(DD('sky:O:wx-projectors'), F(`M-338 ${470 - AY}L-332 ${470 - AY}L-120 88L-230 88Z`, 'url(#wx-gProj)'),
    F(`M332 ${470 - AY}L338 ${470 - AY}L230 88L120 88Z`, 'url(#wx-gProj)'),
    S(`M-335 ${470 - AY}L-175 88M335 ${470 - AY}L175 88`, C.cyC, 1, { opacity: 0.35, 'stroke-dasharray': '3 7' }));
  // the ad panel
  const PW = 470, PH = 180, px0 = -PW / 2, py0 = -PH / 2;
  const brk = (x, y, sx, sy) => `M${f(x)} ${f(y + sy * 22)}V${f(y)}H${f(x + sx * 22)}`;
  const bracket = brk(px0 - 8, py0 - 8, 1, 1) + brk(-px0 + 8, py0 - 8, -1, 1) + brk(px0 - 8, -py0 + 8, 1, -1) + brk(-px0 + 8, -py0 + 8, -1, -1);
  let seg = ''; for (let i = 0; i < 16; i++) seg += rect(-80 + i * 12, 72, 9, 4);
  const tag = txt(GZ, 'ハレ', 17, 196, -58, { align: 'middle', track: 2 });
  const small = txt(GM, 'SKY-AD 07 · 鹈鹕外卖 · LIVE', 10, px0 + 12, py0 + 18, { track: 1 });
  const panel = G(DD('sky:O:wx-ad'),
    F(rect(px0, py0, PW, PH), C.void, { opacity: 0.55 }), F(rect(px0, py0, PW, PH), C.cy, { opacity: 0.07 }), F(rect(px0, py0, PW, PH), 'url(#wx-pScan)'),
    GLOW(rect(px0, py0, PW, PH), C.cy, 1.2, 0.8, C.cyC), S(bracket, C.mag, 2.6), S(bracket, C.mag, 8, { opacity: 0.15 }),
    F(rect(172, -76, 48, 24), C.mag, { opacity: 0.25 }), S(rect(172, -76, 48, 24), C.mag, 1.2), F(tag.d, C.magC),
    F(small.d, C.cyC, { opacity: 0.85 }), F(seg, C.ac, { opacity: 0.8 }));
  // logo: pelican head in a roundel, a fish in the pouch
  const LX = -158, LY = 6;
  const head = `M${LX - 26} ${LY + 30}C${LX - 34} ${LY + 4} ${LX - 30} ${LY - 22} ${LX - 12} ${LY - 28}C${LX + 2} ${LY - 32} ${LX + 12} ${LY - 24} ${LX + 14} ${LY - 16}`
    + `L${LX + 52} ${LY - 6}L${LX + 56} ${LY - 2}L${LX + 50} ${LY}C${LX + 36} ${LY + 18} ${LX + 12} ${LY + 22} ${LX - 2} ${LY + 12}C${LX - 8} ${LY + 20} ${LX - 10} ${LY + 28} ${LX - 8} ${LY + 34}Z`;
  const fish = `M${LX + 10} ${LY + 8}c6 -5 14 -5 18 0c-4 5 -12 5 -18 0Zm18 0l6 -4v8Z`;
  const logo = G(DD('sky:O:wx-ad-logo'), GLOW(circ(LX, LY, 54), C.cy, 1.4, 0.8, C.cyC), S(circ(LX, LY, 47), C.mag, 1, { opacity: 0.7, 'stroke-dasharray': '4 5' }),
    F(head, C.cy, { opacity: 0.22 }), GLOW(head, C.cyC, 1.3, 0.9, '#FFFFFF'), F(circ(LX - 6, LY - 16, 3), C.ac), F(fish, C.am, { opacity: 0.9 }));
  const h1 = txt(GZ, '雨停了', 66, -96, 14, { track: 6 }), h2 = txt(GB, 'RAIN BREAK', 23, -93, 46, { track: 5 });
  const h3 = txt(GZ, '趁雨停 快送鱼', 13, -93, 67, { track: 3 }), h4 = txt(GM, '· DELIVER WHILE DRY', 11.5, -93 + h3.w + 8, 67, { track: 1 });
  const type = G(DD('sky:O:wx-ad-type'), F(h1.d, C.mag, { opacity: 0.55, transform: 'translate(-2.5 1.8)' }), F(h1.d, C.cyC), S(h1.d, C.cy, 3, { opacity: 0.25 }),
    F(h2.d, C.ac), F(h3.d + h4.d, C.cyC, { opacity: 0.9 }));
  const ad = G({ 'data-ref': 'wx-ad' }, panel, logo, type);
  // pelican asterism (Pelecanus isn't an IAU constellation, but IC 5070, the Pelican Nebula, is real)
  const ST = [[0, 0], [22, -10], [40, -6], [96, 10], [60, 16], [34, 26], [8, 32], [-26, 40], [-60, 34], [-84, 18], [-46, 64], [-10, 66]];
  const LN = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0], [6, 7], [7, 8], [8, 9], [7, 10], [10, 11], [11, 6]];
  const SX = 300, SY = 30;   // right of the head box, under the mission HUD
  let sd = '', sl = '', sg = '';
  ST.forEach(([x, y], i) => { const r = i === 0 || i === 3 ? 2.4 : 1.3 + hh(i, 60) * 0.9, X = SX + x, Y = SY + y; sd += circ(X, Y, r); if (i === 0 || i === 3 || i === 7) sg += `M${f(X - r * 3.4)} ${f(Y)}H${f(X + r * 3.4)}M${f(X)} ${f(Y - r * 3.4)}V${f(Y + r * 3.4)}`; });
  for (const [a, b] of LN) sl += `M${f(SX + ST[a][0])} ${f(SY + ST[a][1])}L${f(SX + ST[b][0])} ${f(SY + ST[b][1])}`;
  const lab = txt(GM, 'IC 5070 · 鹈鹕星云', 9, SX - 84, SY + 88, { track: 1 });
  const aster = G(DD('sky:O:wx-asterism'), S(sl, C.cyC, 0.8, { opacity: 0.4, 'stroke-dasharray': '2 3' }), S(sg, v('star'), 0.8, { opacity: 0.8 }), F(sd, v('star')),
    S(brk(SX - 12, SY - 12, 1, 1) + brk(SX + 12, SY - 12, -1, 1) + brk(SX - 12, SY + 12, 1, -1) + brk(SX + 12, SY + 12, -1, -1), C.ac, 1, { opacity: 0.8 }),
    F(lab.d, C.cyC, { opacity: 0.75 }), S(`M${f(SX - 84)} ${f(SY + 92)}h${f(lab.w)}`, C.cy, 0.8, { opacity: 0.5 }));
  const clear = G({ ...REF('clear') }, G({ 'data-ref': 'wx-clearMove', transform: `translate(${AX} ${AY})` }, aster, aurora,
    // (fix) the ad sits in the upper-left third, clear of the rider's head box (x 680-1000, y 200-380) and the title
    G({ transform: 'translate(-385 30) scale(0.78)' }, proj, ad)));

  // ================================================================ L-atmo: far rain, rain sheets, smog banks, the searchlight in smog, flash
  // far streaks on the near tile's period (408 × 384, see `ra`), so they wrap with the wx-rainA translate
  const fr = rainTile({ salt: 70, colW: 17, rowH: 64, cols: 24, rows: 6, x0: -300, x1: 2350, y0: -600, y1: 1060, slant: 0.2, L0: 9, L1: 17, mix: { p: 0.8, m: 0.2 } });
  // Perf (lighting pass): the far rain no longer has a full-screen sheet of its own. Its streaks ride in the near-rain
  // strip (wx-rainA, one composited screen for all the rain): finer, dimmer, smog-tinted, tiled on the near tile's period.
  // The farRain / farRainMove refs stay (empty) so the update code and the sheet list keep working.
  const farRain = G({ ...REF('farRain'), ...NOHIT }, G({ 'data-ref': 'wx-farRainMove' }));
  let gs = '';
  for (let rep = -1; rep < 2; rep++) for (let i = 0; i < 3; i++) { const x = rep * GUST_W + i * GUST_W / 3 + hh(i, 80) * 300, w = 180 + hh(i, 81) * 160; gs += `M${f(x)} -120h${f(w)}L${f(x + w - 330)} 620h${f(-w * 1.3)}Z`; }
  const gusts = G({ ...REF('gusts'), ...NOHIT, ...DD('fx:O:wx-rainsheets') }, G({ 'data-ref': 'wx-gustMove' }, F(gs, 'url(#wx-gSheet)'), F(gs, 'url(#wx-pSheet)')));
  const wav = (y, a1, p1, a2, p2, x0, x1, st = 40) => { let d = ''; for (let x = x0; x <= x1; x += st) d += `${x === x0 ? 'M' : 'L'}${x} ${f(y + a1 * Math.sin(x / FOG_W * TAU * p1) + a2 * Math.sin(x / FOG_W * TAU * p2))}`; return d; };
  const X0 = -600, X1 = FOG_W + 2500;
  let bl = { M: '', C: '', A: '', G: '' };
  for (let rep = 0; rep < 3; rep++) for (let i = 0; i < 9; i++) {
    const x = rep * FOG_W + i * FOG_W / 9 + hh(i, 90) * 200, y = 400 + hh(i, 91) * 110, k = 'MCAMCMCGA'[i];
    if (x > X1 - 100) continue;
    bl[k] += hh(i, 92) < 0.4 ? ell(x, y - 30, 26 + hh(i, 93) * 20, 70 + hh(i, 94) * 40) : ell(x, y, 90 + hh(i, 93) * 90, 30 + hh(i, 94) * 30);
  }
  const fogFar = G({ 'data-ref': 'wx-fogFarMove' }, F(wav(340, 18, 6, 8, 17, X0, X1) + `L${X1} 600L${X0} 600Z`, 'url(#wx-gSmogFar)'),
    G(DD('sea:O:wx-neonbleed'), F(bl.M, 'url(#wx-rMag)'), F(bl.C, 'url(#wx-rCy)'), F(bl.A, 'url(#wx-rAm)'), F(bl.G, 'url(#wx-rAc)')),
    S(wav(350, 18, 6, 8, 17, X0, X1), v('smogLit'), 6, { opacity: 0.12 }), S(wav(350, 18, 6, 8, 17, X0, X1), v('smogLit'), 1.6, { opacity: 0.4 }));
  const fogNear = G({ 'data-ref': 'wx-fogNearMove' }, F(wav(452, 14, 9, 7, 23, X0, X1) + `L${X1} 640L${X0} 640Z`, 'url(#wx-gSmogNear)'),
    S(wav(462, 14, 9, 7, 23, X0, X1), v('smogHi'), 1.4, { opacity: 0.45 }));
  const fog = G({ ...REF('fog'), ...NOHIT, ...DD('sea:T:wx-smog') }, fogFar, fogNear);
  const beam = G({ ...REF('beam'), style: 'opacity:var(--pb-n-search);pointer-events:none !important' }, G({ ...DD('sea:O:wx-fogbeam') },
    G({ 'data-ref': 'wx-beamRot' }, F('M0 -6L1000 -150L1000 150L0 6Z', 'url(#wx-gBeam)', { opacity: 0.7 }), F('M0 -3L1000 -60L1000 60L0 3Z', 'url(#wx-gBeam)'),
      S('M20 -4L1000 -120M20 4L1000 110M30 0L1000 -30', C.cyC, 1, { opacity: 0.25, 'stroke-dasharray': '40 22 12 30' })),
    F(ell(0, 0, 70, 50), 'url(#wx-rCy)')));
  const flash = G({ ...REF('flash'), ...NOHIT, ...DD('fx:O:wx-flash') }, F(rect(-500, -400, 2600, 1000), 'url(#wx-gFlash)'));

  // ================================================================ L-shore: low street smog
  const mist = G({ ...REF('mist'), ...NOHIT, ...DD('land:T:wx-streetsmog') }, G({ 'data-ref': 'wx-mistMove' },
    F(wav(600, 12, 9, 6, 21, X0, X1, 50) + `L${X1} 730L${X0} 730Z`, 'url(#wx-gMist)'),
    F(wav(640, 9, 13, 5, 29, X0, X1, 50) + `L${X1} 720L${X0} 720Z`, 'url(#wx-gMist)', { opacity: 0.7 })));

  // ================================================================ L-road: pooled puddles + downpour spray
  let pud = '';
  for (let i = 0; i < PUD_N; i++) {
    const rx = 84 + hh(i, 100) * 50, ry = 11 + hh(i, 101) * 5, sd = 110 + i * 7, body = blob(0, 0, rx, ry, 9, sd, 0.2), inner = blob(-4, -0.8, rx * 0.84, ry * 0.7, 8, sd + 3, 0.14);
    defs += `<clipPath id="wx-pc${i}"><path d="${body}"/></clipPath>`;
    const st = { m: '', c: '', a: '', g: '' }, ks = 'mcamcmgcma';
    for (let j = 0, x = -rx + 6 + hh(i, 102) * 8; x < rx - 6; j++, x += 9 + hh(j, sd + 5) * 16) {
      let d = `M${f(x)} ${f(-ry - 2)}`;
      for (let y = -ry; y <= ry + 2; y += 4) d += `L${f(x + (hh(j * 13 + y, sd + 6) - 0.5) * 1.4)} ${f(y)}`;   // a faint ripple wobble
      st[ks[(j + i) % ks.length]] += d;
    }
    const W = (hh(i, 103) * 2 + 3).toFixed(1);
    const refl = G({ 'clip-path': `url(#wx-pc${i})`, ...DD('land:T:wx-puddle-reflect') },
      S(st.m, C.mag, W * 2.2, { opacity: 0.22, 'stroke-linecap': 'butt' }), S(st.m, C.mag, W * 0.6, { opacity: 0.85, 'stroke-linecap': 'butt' }),
      S(st.c, C.cy, W * 2.2, { opacity: 0.2, 'stroke-linecap': 'butt' }), S(st.c, C.cyC, W * 0.55, { opacity: 0.85, 'stroke-linecap': 'butt' }),
      S(st.a, C.am, W * 1.8, { opacity: 0.22, 'stroke-linecap': 'butt' }), S(st.a, C.am, W * 0.55, { opacity: 0.8, 'stroke-linecap': 'butt' }),
      S(st.g, C.ac, W * 0.5, { opacity: 0.7, 'stroke-linecap': 'butt' }));
    const rim = `M${f(-rx * 0.86)} ${f(-ry * 0.45)}C${f(-rx * 0.5)} ${f(-ry * 1.12)} ${f(rx * 0.5)} ${f(-ry * 1.12)} ${f(rx * 0.8)} ${f(-ry * 0.5)}`;
    const rip = k => G({ 'data-ref': `wx-rip${i}_${k}` }, S(ell(0, 0, 14, 3.2), C.cyC, 0.9, { opacity: 0.75 }), S(ell(0, 0, 8, 1.8), C.cyC, 0.7, { opacity: 0.45 }));
    pud += G({ 'data-ref': 'wx-pud' + i, visibility: 'hidden' },
      F(body, C.void, { opacity: 0.55, transform: 'translate(1.5 2.2)' }), F(body, 'url(#wx-gPud)'), F(inner, v('sky0'), { opacity: 0.35 }), refl,
      S(rim, C.cyC, 1, { opacity: 0.5 }), S(body, v('road'), 1.4, { opacity: 0.6 }),
      G(DD('land:O:wx-ripples'), rip(0), rip(1)), F(body, C.viC, { 'data-ref': 'wx-pudFl' + i, opacity: 0 }));
  }
  const puddles = G({ ...REF('puddles'), ...DD('land:O:wx-puddles') }, pud);
  let spr = '';
  for (let i = 0; i < 260; i++) spr += `M${f(-300 + hh(i, 120) * 2200)} ${f(GROUND_Y - 30 + Math.pow(hh(i, 121), 0.6) * 40)}h0`;
  const spray = G({ ...REF('spray'), ...NOHIT, ...DD('land:T:wx-spray') }, F(rect(-400, 752, 2400, 60), 'url(#wx-gSpray)'), S(spr, C.cyC, 1.6, { opacity: 0.45 }));

  // ================================================================ L-fx-back: the calm wind (one slow data-stream)
  let wd = '', wb = '';
  for (let rep = 0; rep < 2; rep++) {
    const x0 = rep * WIND_W + 200, y0 = 206;
    for (let k = 0; k < 3; k++) {
      const x = x0 + k * 30, y = y0 + k * 13, L = 620 - k * 90;
      wd += `M${f(x + L)} ${f(y)}C${f(x + L * 0.66)} ${f(y - 8)} ${f(x + L * 0.33)} ${f(y + 8)} ${f(x)} ${f(y)}`;
      for (let j = 0; j < 5; j++) { const u = (j + 0.5 + hh(j + k * 5, 130) * 0.4) / 5.4, bx = x + L * (1 - u); wb += rect(bx, y - 2.5 + 8 * Math.sin(u * TAU) * 0.2, 5 + hh(j, 131 + k) * 7, 4); }
    }
  }
  const wind = G({ ...REF('wind'), ...DD('fx:O:wx-datastream') }, G({ 'data-ref': 'wx-windMove' },
    S(wd, C.cy, 5, { opacity: 0.1 }), S(wd, C.cyC, 1.2, { opacity: 0.7, 'stroke-dasharray': '46 8 6 8' }), F(wb, C.cy, { opacity: 0.6 })));

  // ================================================================ L-fx-front: drizzle, downpour, splashes
  const ra = rainTile({ salt: 200, colW: 34, rowH: 96, cols: 12, rows: 4, x0: -300, x1: 2350, y0: -600, y1: 1060, slant: 0.22, L0: 16, L1: 34, mix: { p: 0.72, c: 0.12, m: 0.12, a: 0.04 } });
  const rb = rainTile({ salt: 260, colW: 22, rowH: 150, cols: 20, rows: 3, x0: -300, x1: 2400, y0: -620, y1: 1080, slant: 0.36, L0: 56, L1: 110, mix: { p: 0.84, c: 0.08, m: 0.08 } });
  const neon = (o, sc) => S(o.c, C.cy, 3.4 * sc, { opacity: 0.13, 'stroke-linecap': 'butt', ...NOHIT }) + S(o.c, C.cy, 1.2 * sc, { opacity: 0.75, 'stroke-linecap': 'butt' })
    + S(o.m, C.mag, 3.4 * sc, { opacity: 0.13, 'stroke-linecap': 'butt', ...NOHIT }) + S(o.m, C.mag, 1.2 * sc, { opacity: 0.75, 'stroke-linecap': 'butt' })
    + (o.a ? S(o.a, C.am, 1.2 * sc, { opacity: 0.7, 'stroke-linecap': 'butt' }) : '');
  const rainL = G({ ...REF('rainL') }, G({ 'data-ref': 'wx-rainA' },
    G(DD('fx:T:wx-farrain'), S(fr.p, v('smogHi'), 0.8, { 'stroke-opacity': 0.42, 'stroke-linecap': 'butt' }), S(fr.m, v('smogLit'), 0.9, { 'stroke-opacity': 0.4, 'stroke-linecap': 'butt' })),
    S(ra.p, C.cyC, 1.1, { opacity: 0.36, 'stroke-linecap': 'butt', ...DD('fx:T:wx-rain') }), G(DD('fx:O:wx-rain-neon'), neon(ra, 1))));
  const rainH = G({ ...REF('rainH'), ...DD('fx:T:wx-downpour') }, G({ 'data-ref': 'wx-rainB' }, S(rb.p, C.cyC, 1.35, { opacity: 0.42, 'stroke-linecap': 'butt' }), neon(rb, 1.1)));
  let spl = '';
  for (let i = 0; i < 12; i++) {
    const g = [C.cyC, C.cy, C.mag][i % 3];
    spl += G({ 'data-ref': 'wx-sp' + i, visibility: 'hidden' },
      S('M-7 -1l-5 -9M-3 -2l-1.5 -12M3 -2l1.5 -12M7 -1l5 -9', C.cyC, 1.3, { opacity: 0.85 }), S('M0 -2v-8', g, 1.6),
      F(circ(-11, -15, 1.3) + circ(12, -13, 1.1) + circ(1, -18, 1), C.cyC), S(ell(0, 0, 11, 2.4), g, 1, { opacity: 0.8 }));
  }
  const splashes = G({ ...REF('splashes'), ...DD('fx:O:wx-splashes') }, spl);

  // washes and rain are see-through overlays: they never catch the pointer or mask what lies under them
  const [over_, shafts_, storm_, farRain_, gusts_, fog_, beam_, flash_, mist_, spray_, rainH_, rainL_, wind_] = [over, shafts, storm, farRain, gusts, fog, beam, flash, mist, spray, rainH, rainL, wind].map(nohit);
  return {
    defs,
    layers: {
      'L-stars': G({ id: 'wx-far' }, over_, shafts_, storm_),       // behind the arcology and the skyline
      'L-clouds': G({ id: 'wx-sky' }, clear),
      'L-atmo': G({ id: 'wx-atmo' }, farRain_, gusts_, fog_, beam_, flash_),
      'L-shore': G({ id: 'wx-shore' }, mist_),
      'L-road': G({ id: 'wx-road' }, spray_, puddles),
      'L-fx-back': G({ id: 'wx-back' }, wind_),
      'L-fx-front': G({ id: 'wx-front' }, splashes, rainH_, rainL_),
    },
  };
}

export function attach(svg, ctx) {
  const r = {};
  for (const el of svg.querySelectorAll('[data-ref^="wx-"]')) r[el.getAttribute('data-ref').slice(3)] = el;
  const seaBeam = svg.querySelector('[data-ref="sea-beam"]'), seaRot = svg.querySelector('[data-ref="sea-beamRot"]');
  const cache = new WeakMap();
  const set = (el, k, val) => { if (!el) return; let m = cache.get(el); if (!m) cache.set(el, (m = {})); if (m[k] !== val) { m[k] = val; el.setAttribute(k, val); } };
  const op = a => a > 0.97 ? '1' : (Math.round(clamp(a, 0, 1) * 50) / 50).toString();   // steady = opaque group (no offscreen layer)
  const vis = (el, on) => set(el, 'visibility', on ? 'inherit' : 'hidden');
  // groups that are absent most of the ride are detached from the DOM (re-inserted when they come). The composited
  // strips (export `sheets`) and their roots stay in the tree (the sheet split needs them) and are only hidden.
  const slots = new Map();
  for (const k of ['over', 'storm', 'flash', 'beam', 'spray', 'wind', 'splashes']) {
    const el = r[k]; if (!el) continue; const ph = document.createComment(k); el.parentNode.insertBefore(ph, el); el.remove(); slots.set(el, ph);
  }
  const showA = (el, a) => {
    if (!el) return;
    const on = a > 0.01, ph = slots.get(el);
    if (ph) { if (on && !el.isConnected) { ph.parentNode.insertBefore(el, ph); set(el, 'visibility', 'inherit'); } else if (!on && el.isConnected) el.remove(); }
    else set(el, 'visibility', on ? 'inherit' : 'hidden');
    if (on) set(el, 'opacity', op(a));
    return on;
  };
  // the clear moment is anchored at the centre of the director's rainbow window (so the ad drifts through the sky
  // with the far parallax, centred on screen mid-window)
  const mid = new Map();
  const bowMid = L => { if (!mid.has(L)) { const s = lapScript(L); mid.set(L, s.bow ? L * LAP + (s.shower + 1.4 + 1.225) * KM : null); } return mid.get(L); };
  const PRX = Array.from({ length: PUD_N }, (_, i) => 84 + hh(i, 100) * 50), PRY = Array.from({ length: PUD_N }, (_, i) => 11 + hh(i, 101) * 5);
  const BOLT_X = x => (x > 560 && x < 1000 ? x + 470 : x);   // never strike right behind the pelican's head
  return {
    update(fr) {
      const w = fr.weather; if (!w) return;
      const t = fr.t, D = fr.distance, red = fr.reduced || ctx.reduced;
      const clearK = sstep(0.05, 0.55, w.bow || 0), smog = sstep(0.1, 0.7, w.fog || 0);
      const lite = 0.34 * (1 - clearK) * (1 - 0.55 * smog);      // the drizzle
      const R = Math.max(w.rain || 0, lite), heavy = sstep(0.45, 0.95, w.rain || 0);
      const RK = red ? 0.55 : 1;                                 // reduced motion: a still, lighter rain screen

      // ---- sky: overcast, rain shafts, clear moment
      showA(r.over, sstep(0.35, 1, w.cloud || 0) * 0.32);
      // rain shafts hang from the storm deck: they come with the building overcast and the downpour, not the drizzle
      // (a full-width composited strip: off most of the ride)
      if (showA(r.shafts, clamp(heavy * 0.7 + 0.45 * sstep(0.4, 1, w.cloud || 0), 0, 1) * (1 - clearK)))
        set(r.shaftMove, 'transform', `translate(${f(-wrap(D * 0.03 + (red ? 0 : t * 6), SHAFT_W))} 0)`);
      if (showA(r.clear, clearK)) {
        let best = null;
        for (const L of [w.lap, w.lap - 1, w.lap + 1]) { if (!(L >= 0)) continue; const m = bowMid(L); if (m !== null && (best === null || Math.abs(D - m) < Math.abs(D - best))) best = m; }
        set(r.clearMove, 'transform', `translate(${f(AX - (best === null ? 0 : D - best) * APAR)} ${AY})`);
        const gl = !red && Math.floor(t / 4.7) % 3 === 1 && wrap(t, 4.7) < 0.12;   // a rare, brief hologram glitch
        set(r.ad, 'opacity', gl ? '0.45' : '1');
      }

      // ---- lightning (downpour only; its own schedule, interleaved with sky.js's flashes)
      let fl = 0, kind = -1, bx = 0;
      if (heavy > 0.3 && !red) {
        const P = 3.1, n = Math.floor((t + 0.7) / P), u = t + 0.7 - n * P;
        if (hash(n, 206) < 0.42 && u < 0.34) {
          fl = u < 0.06 ? 1 : u < 0.11 ? 0.2 : u < 0.2 ? 0.85 : Math.max(0, 1 - (u - 0.2) / 0.14) * 0.5;
          kind = hash(n, 207) < 0.65 ? Math.floor(hash(n, 208) * 3) : 3; bx = BOLT_X(160 + hash(n, 209) * 1280);
        }
      }
      if (showA(r.storm, fl)) {
        for (let i = 0; i < 3; i++) { vis(r['bolt' + i], kind === i); if (kind === i) set(r['bolt' + i], 'transform', `translate(${f(bx)} 64)`); }
        vis(r.spider, kind === 3); if (kind === 3) set(r.spider, 'transform', `translate(${f(380 + wrap(bx, 460))} 128)`);   // under the deck, clear of the HUD
      }
      showA(r.flash, fl * 0.3 * heavy);

      // ---- rain: pooled streak tiles on composited sheets (a translate per frame)
      // fall speeds and slants chosen so both tiles wrap a whole number of times in 4 s at 60 rpm (the baked loop):
      // rain A 13 × 384 down, 3 × 408 across; rain B 17 × 450 down, 6 × 440 across
      const kA = red ? 0 : t * 1248, kB = red ? 0 : t * 1912.5, dS = red ? 0 : D * 0.1;
      if (showA(r.rainL, clamp(R / 0.34, 0, 1) * RK)) set(r.rainA, 'transform', `translate(${f(-wrap(kA * 0.09415 + dS, 408))} ${f(wrap(kA, 384))})`);
      if (showA(r.rainH, heavy * RK)) set(r.rainB, 'transform', `translate(${f(-wrap(kB * 0.24654 + dS, 440))} ${f(wrap(kB, 450))})`);
      if (showA(r.farRain, clamp(R * 1.8, 0, 1) * 0.85 * RK)) { const k = red ? 0 : t * 700; set(r.farRainMove, 'transform', `translate(${f(-wrap(k * 0.2 + (red ? 0 : D * 0.02), 160))} ${f(wrap(k, 256))})`); }
      if (showA(r.gusts, heavy * 0.9 * RK)) set(r.gustMove, 'transform', `translate(${f(-wrap(red ? 900 : t * 240 + D * 0.2, GUST_W))} 0)`);
      showA(r.spray, heavy * 0.9);
      const nSp = red || R < 0.05 ? 0 : Math.round(3 + 9 * R);
      if (showA(r.splashes, nSp ? 1 : 0)) for (let i = 0; i < 12; i++) {
        const el = r['sp' + i];
        if (i >= nSp) { vis(el, false); continue; }
        const q = t * 2.3 + i * 0.37, p = wrap(q, 1), c = Math.floor(q);
        const y = GROUND_Y + 5 + Math.pow(hh(c, i + 9), 1.4) * 84, sc = 0.55 + (y - GROUND_Y) / 84 * 0.8;
        vis(el, true);
        set(el, 'transform', `translate(${f(hh(c, i) * 1700 - 50)} ${f(y)}) scale(${f(sc * (0.35 + p * 0.9))} ${f(sc * (1 - p * 0.5))})`);
        set(el, 'opacity', op(1 - p * p));
      }

      // ---- puddles: hashed slots along the road (pooled; no quick repeats), ripples while it rains, lightning flash
      // the group alpha goes on each puddle (a group opacity over two far-apart puddles = two cc layers = an offscreen pass)
      const pudA = op(clamp(0.62 + 0.38 * (w.wet || 0), 0, 1));
      if (showA(r.puddles, 1)) for (let i = 0; i < PUD_N; i++) {
        const m = Math.floor((D + 2000 - i * PUD_SP) / (PUD_N * PUD_SP)), k = i + PUD_N * m, sx = k * PUD_SP + hash(k, 502) * 280 - D;
        const el = r['pud' + i], on = hash(k, 501) < 0.62 && sx > -300 && sx < 1950;
        vis(el, on); if (!on) continue;
        const y = GROUND_Y + 22 + hash(k, 503) * 58, sc = 0.7 + (y - GROUND_Y - 22) / 58 * 0.55;
        set(el, 'transform', `translate(${f(sx)} ${f(y)}) scale(${f(sc * (0.8 + 0.45 * hash(k, 504)))} ${f(sc)})`);
        set(el, 'opacity', pudA);
        for (let j = 0; j < 2; j++) {
          const rp = r[`rip${i}_${j}`], P = 0.8 + 0.25 * j, q = (t + j * 0.41 + i * 0.29) / P, c = Math.floor(q), u = red ? 0.5 : q - c;
          const ron = R > 0.05 && (red ? j === 0 : true);
          vis(rp, ron); if (!ron) continue;
          set(rp, 'transform', `translate(${f((hh(c * 7 + i, 510 + j) - 0.5) * 1.3 * PRX[i])} ${f((hh(c * 7 + i, 520 + j) - 0.5) * 0.9 * PRY[i])}) scale(${f(0.3 + 1.1 * u)})`);
          set(rp, 'opacity', op((1 - u) * clamp(R * 2.2, 0, 1)));
        }
        set(r['pudFl' + i], 'opacity', op(fl * 0.4 * heavy));
      }

      // ---- smog: two banks slide (translation), street smog, the searchlight turns volumetric
      if (showA(r.fog, sstep(0, 0.4, w.fog || 0))) {
        const roll = 1 - sstep(0, 0.8, w.fog || 0);
        set(r.fogFarMove, 'transform', `translate(${f(-wrap(red ? 600 : D * 0.1 + t * 9, FOG_W))} ${f(40 * roll)})`);
        set(r.fogNearMove, 'transform', `translate(${f(-wrap(red ? 1300 : D * 0.22 + t * 16, FOG_W))} ${f(70 * roll)})`);
      }
      if (showA(r.mist, Math.max(sstep(0.1, 0.5, w.fog || 0), heavy * 0.45))) set(r.mistMove, 'transform', `translate(${f(-wrap(red ? 500 : D * 0.6 + t * 20, FOG_W))} 0)`);
      const sOn = smog > 0.02 && seaBeam && seaBeam.isConnected && seaBeam.getAttribute('visibility') !== 'hidden';
      if (showA(r.beam, sOn ? smog * 0.9 : 0)) {
        set(r.beam, 'transform', seaBeam.getAttribute('transform') || 'translate(0 0)');
        if (seaRot) set(r.beamRot, 'transform', seaRot.getAttribute('transform') || 'scale(1 1)');
      }

      // ---- the calm wind: one slow data-stream glides left (a gust only nudges it)
      if (showA(r.wind, red ? 0 : sstep(0.3, 0.9, w.wind || 0) * 0.85))
        set(r.windMove, 'transform', `translate(${f(-wrap(t * (46 + 40 * (w.gust || 0)) + D * 0.04, WIND_W))} ${f(Math.sin(t * 0.4) * 3)})`);
    },
  };
}

// ---- lettering as paths (em 100, y down). Latin: DejaVu Sans Bold / Sans Mono (Bitstream Vera / DejaVu licence);
// CJK + katakana: WenQuanYi Zen Hei (GPL v2 + font embedding exception). Extracted with tools/ttf.mjs.
const GB = {"0":[70,"M46-37Q46-50 43-56Q41-61 35-61Q29-61 26-56Q24-50 24-37Q24-23 26-17Q29-11 35-11Q41-11 43-17Q46-23 46-37ZM65-36Q65-18 57-8Q49 1 35 1Q20 1 13-8Q5-18 5-36Q5-55 13-64Q20-74 35-74Q49-74 57-64Q65-55 65-36Z"],"1":[70,"M12-13L28-13L28-60L11-57L11-69L28-73L46-73L46-13L63-13L63 0L12 0Z"],"2":[70,"M29-14L61-14L61 0L8 0L8-14L35-37Q38-41 40-44Q42-47 42-50Q42-55 38-58Q35-61 29-61Q25-61 19-59Q14-58 8-54L8-70Q14-72 21-73Q27-74 33-74Q46-74 53-68Q60-63 60-52Q60-46 57-41Q54-36 44-27Z"],"3":[70,"M47-39Q54-37 58-33Q62-28 62-21Q62-10 53-4Q45 1 29 1Q23 1 18 1Q12 0 7-2L7-17Q12-14 17-13Q22-11 27-11Q35-11 39-14Q43-17 43-21Q43-26 39-29Q35-31 27-31L19-31L19-44L27-44Q34-44 38-46Q41-48 41-53Q41-57 38-59Q34-61 28-61Q24-61 19-60Q14-59 10-57L10-71Q15-73 21-73Q26-74 32-74Q46-74 53-70Q60-65 60-56Q60-49 57-45Q53-41 47-39Z"],"4":[70,"M37-57L16-27L37-27ZM34-73L55-73L55-27L65-27L65-13L55-13L55 0L37 0L37-13L4-13L4-29Z"],"5":[70,"M11-73L57-73L57-59L26-59L26-48Q28-48 30-49Q32-49 34-49Q48-49 55-42Q63-36 63-24Q63-12 55-5Q46 1 32 1Q26 1 20 0Q14-1 8-3L8-18Q14-15 19-13Q24-11 29-11Q36-11 40-15Q44-18 44-24Q44-30 40-33Q36-36 29-36Q25-36 20-35Q16-34 11-32Z"],"6":[70,"M36-36Q31-36 29-33Q26-30 26-23Q26-17 29-14Q31-10 36-10Q41-10 44-14Q46-17 46-23Q46-30 44-33Q41-36 36-36ZM59-71L59-58Q55-60 51-61Q47-62 43-62Q34-62 30-57Q25-52 24-43Q27-46 31-47Q35-48 39-48Q50-48 57-42Q64-35 64-24Q64-13 57-6Q49 1 36 1Q22 1 14-8Q6-18 6-35Q6-53 15-64Q24-74 40-74Q45-74 50-73Q55-73 59-71Z"],"7":[70,"M7-73L62-73L62-62L33 0L15 0L42-59L7-59Z"],"8":[70,"M35-33Q30-33 27-30Q24-27 24-21Q24-16 27-13Q30-10 35-10Q40-10 43-13Q46-16 46-21Q46-27 43-30Q40-33 35-33ZM21-39Q14-41 11-45Q8-49 8-55Q8-65 15-69Q21-74 35-74Q48-74 55-69Q62-65 62-55Q62-49 58-45Q55-41 48-39Q56-37 60-32Q63-28 63-21Q63-10 56-4Q49 1 35 1Q21 1 13-4Q6-10 6-21Q6-28 10-32Q14-37 21-39ZM25-53Q25-49 28-47Q30-44 35-44Q39-44 42-47Q44-49 44-53Q44-58 42-60Q39-62 35-62Q30-62 28-60Q25-58 25-53Z"],"9":[70,"M10-2L10-15Q15-13 19-12Q23-11 27-11Q35-11 40-16Q44-20 45-29Q42-27 38-26Q34-25 30-25Q19-25 12-31Q5-38 5-48Q5-60 13-67Q20-74 33-74Q48-74 55-64Q63-55 63-37Q63-19 54-9Q45 1 29 1Q24 1 19 1Q15 0 10-2ZM33-37Q38-37 41-40Q43-43 43-50Q43-56 41-59Q38-62 33-62Q28-62 26-59Q23-56 23-50Q23-43 26-40Q28-37 33-37Z"],"A":[77,"M53-13L24-13L19 0L0 0L27-73L50-73L77 0L58 0ZM29-27L49-27L39-56Z"],"B":[76,"M38-45Q43-45 45-47Q47-49 47-52Q47-56 45-58Q43-60 38-60L28-60L28-45ZM39-13Q45-13 48-15Q50-18 50-22Q50-27 48-30Q45-32 39-32L28-32L28-13ZM56-39Q63-37 66-33Q69-28 69-21Q69-10 62-5Q55 0 40 0L9 0L9-73L37-73Q53-73 59-68Q66-64 66-54Q66-48 64-45Q61-41 56-39Z"],"C":[73,"M67-4Q62-1 56 0Q51 1 44 1Q26 1 16-9Q5-19 5-36Q5-54 16-64Q26-74 44-74Q51-74 56-73Q62-71 67-69L67-54Q62-57 57-59Q52-61 46-61Q36-61 30-54Q24-48 24-36Q24-25 30-19Q36-12 46-12Q52-12 57-14Q62-16 67-19Z"],"D":[83,"M28-59L28-14L35-14Q46-14 52-20Q58-26 58-37Q58-47 52-53Q46-59 35-59ZM9-73L29-73Q46-73 54-71Q62-68 68-62Q73-58 75-51Q78-45 78-37Q78-28 75-22Q73-15 68-10Q62-5 54-2Q45 0 29 0L9 0Z"],"E":[68,"M9-73L60-73L60-59L28-59L28-45L58-45L58-31L28-31L28-14L61-14L61 0L9 0Z"],"F":[68,"M9-73L60-73L60-59L28-59L28-45L58-45L58-31L28-31L28 0L9 0Z"],"G":[82,"M75-5Q68-2 60 0Q53 1 44 1Q26 1 16-9Q5-19 5-36Q5-54 16-64Q27-74 46-74Q53-74 59-73Q66-71 72-69L72-54Q66-57 60-59Q54-61 48-61Q37-61 30-54Q24-48 24-36Q24-25 30-19Q36-12 47-12Q50-12 52-13Q55-13 57-14L57-28L45-28L45-40L75-40Z"],"H":[84,"M9-73L28-73L28-45L56-45L56-73L75-73L75 0L56 0L56-31L28-31L28 0L9 0Z"],"I":[37,"M9-73L28-73L28 0L9 0Z"],"J":[37,"M9-73L28-73L28-7Q28 7 21 13Q13 20-2 20L-6 20L-6 6L-3 6Q3 6 6 3Q9-1 9-7Z"],"K":[77,"M9-73L28-73L28-46L55-73L77-73L42-38L81 0L57 0L28-29L28 0L9 0Z"],"L":[64,"M9-73L28-73L28-14L61-14L61 0L9 0Z"],"M":[100,"M9-73L33-73L50-34L66-73L90-73L90 0L73 0L73-53L56-14L44-14L27-53L27 0L9 0Z"],"N":[84,"M9-73L30-73L57-23L57-73L75-73L75 0L54 0L27-50L27 0L9 0Z"],"O":[85,"M42-61Q34-61 29-54Q24-48 24-36Q24-25 29-19Q34-12 42-12Q51-12 56-19Q61-25 61-36Q61-48 56-54Q51-61 42-61ZM42-74Q60-74 70-64Q80-54 80-36Q80-19 70-9Q60 1 42 1Q25 1 15-9Q5-19 5-36Q5-54 15-64Q25-74 42-74Z"],"P":[73,"M9-73L40-73Q54-73 62-67Q69-61 69-49Q69-38 62-31Q54-25 40-25L28-25L28 0L9 0ZM28-59L28-39L38-39Q44-39 47-42Q50-44 50-49Q50-54 47-57Q44-59 38-59Z"],"Q":[85,"M44 1L43 1Q25 1 15-9Q5-19 5-36Q5-54 15-64Q25-74 42-74Q60-74 70-64Q80-54 80-36Q80-24 75-15Q69-6 60-2L74 15L56 15ZM42-61Q34-61 29-54Q24-48 24-36Q24-25 29-18Q34-12 42-12Q51-12 56-19Q61-25 61-36Q61-48 56-54Q51-61 42-61Z"],"R":[77,"M36-41Q42-41 44-43Q47-45 47-50Q47-55 44-57Q42-59 36-59L28-59L28-41ZM28-28L28 0L9 0L9-73L38-73Q52-73 59-68Q66-63 66-53Q66-46 62-41Q59-36 52-34Q56-33 59-30Q62-27 65-21L75 0L55 0L46-18Q43-24 41-26Q38-28 33-28Z"],"S":[72,"M60-71L60-55Q54-58 48-59Q42-61 37-61Q31-61 27-59Q24-57 24-53Q24-50 26-48Q29-47 34-46L42-44Q54-42 60-37Q65-32 65-22Q65-10 58-4Q50 1 36 1Q29 1 22 0Q15-1 8-4L8-20Q15-16 21-14Q28-12 34-12Q40-12 43-14Q47-16 47-20Q47-24 44-25Q42-27 36-29L28-30Q17-33 12-38Q7-43 7-52Q7-62 14-68Q21-74 34-74Q40-74 47-73Q53-72 60-71Z"],"T":[68,"M0-73L68-73L68-59L44-59L44 0L25 0L25-59L0-59Z"],"U":[81,"M9-73L28-73L28-29Q28-20 31-16Q34-12 41-12Q47-12 50-16Q53-20 53-29L53-73L72-73L72-29Q72-14 64-6Q56 1 41 1Q25 1 17-6Q9-14 9-29Z"],"V":[77,"M0-73L19-73L39-19L58-73L77-73L50 0L27 0Z"],"W":[110,"M3-73L21-73L34-20L46-73L64-73L77-20L89-73L107-73L90 0L68 0L55-55L42 0L20 0Z"],"X":[77,"M50-37L75 0L56 0L38-25L22 0L2 0L27-37L3-73L23-73L38-49L54-73L74-73Z"],"Y":[72,"M-1-73L20-73L36-47L53-73L73-73L46-31L46 0L27 0L27-31Z"],"Z":[73,"M6-73L67-73L67-62L28-14L68-14L68 0L4 0L4-11L44-59L6-59Z"],"'":[31,"M21-73L21-46L10-46L10-73Z"],"-":[42,"M5-36L36-36L36-22L5-22Z"],".":[38,"M10-19L28-19L28 0L10 0Z"]};
const GM = {"0":[60,"M24-37Q24-39 25-41Q27-43 30-43Q33-43 35-41Q37-39 37-37Q37-34 35-32Q33-30 30-30Q27-30 25-32Q24-34 24-37ZM30-66Q23-66 20-59Q16-52 16-36Q16-21 20-14Q23-6 30-6Q37-6 40-14Q44-21 44-36Q44-52 40-59Q37-66 30-66ZM30-74Q42-74 48-65Q54-55 54-36Q54-18 48-8Q42 1 30 1Q18 1 12-8Q6-18 6-36Q6-55 12-65Q18-74 30-74Z"],"1":[60,"M13-8L29-8L29-64L12-60L12-69L28-73L38-73L38-8L53-8L53 0L13 0Z"],"2":[60,"M18-8L52-8L52 0L7 0L7-8Q17-18 23-25Q30-33 33-36Q38-42 39-45Q41-49 41-53Q41-59 38-62Q34-66 28-66Q23-66 18-64Q13-63 8-59L8-69Q13-72 18-73Q23-74 27-74Q38-74 45-69Q51-63 51-54Q51-49 49-44Q47-40 42-34Q39-31 34-25Q29-19 18-8Z"],"3":[60,"M38-39Q45-37 49-32Q53-27 53-20Q53-10 46-4Q39 1 27 1Q22 1 17 0Q12 0 7-2L7-12Q12-9 17-8Q21-7 26-7Q34-7 39-11Q43-14 43-21Q43-27 39-31Q34-35 27-35L19-35L19-43L27-43Q34-43 37-46Q41-49 41-54Q41-60 38-63Q34-66 28-66Q23-66 19-65Q14-64 9-62L9-71Q15-73 19-73Q24-74 28-74Q38-74 45-69Q51-64 51-55Q51-49 48-45Q44-41 38-39Z"],"4":[60,"M36-64L13-25L36-25ZM34-73L46-73L46-25L55-25L55-17L46-17L46 0L36 0L36-17L5-17L5-27Z"],"5":[60,"M10-73L47-73L47-65L19-65L19-47Q21-47 23-48Q25-48 28-48Q39-48 46-41Q52-35 52-23Q52-12 45-5Q38 1 26 1Q20 1 16 1Q11 0 7-2L7-12Q11-9 16-8Q21-7 25-7Q33-7 38-11Q42-15 42-23Q42-31 38-36Q33-40 25-40Q21-40 17-39Q14-38 10-36Z"],"6":[60,"M48-71L48-62Q45-64 42-65Q38-66 35-66Q25-66 20-59Q16-52 16-38Q18-43 22-46Q26-48 32-48Q42-48 48-42Q54-35 54-23Q54-12 48-5Q42 1 31 1Q18 1 12-8Q6-17 6-36Q6-55 14-65Q21-74 34-74Q38-74 41-73Q45-73 48-71ZM31-40Q25-40 21-36Q17-31 17-23Q17-15 21-11Q25-6 31-6Q37-6 41-11Q44-15 44-23Q44-32 41-36Q37-40 31-40Z"],"7":[60,"M7-73L53-73L53-69L27 0L16 0L42-65L7-65Z"],"8":[60,"M30-35Q23-35 20-31Q16-27 16-21Q16-14 20-10Q24-6 30-6Q37-6 40-10Q44-14 44-21Q44-27 40-31Q37-35 30-35ZM21-39Q15-40 12-45Q8-49 8-55Q8-64 14-69Q20-74 30-74Q40-74 46-69Q52-64 52-55Q52-49 49-45Q45-40 39-39Q46-37 50-32Q54-27 54-20Q54-10 48-4Q41 1 30 1Q19 1 13-4Q6-10 6-19Q6-27 10-32Q14-37 21-39ZM18-54Q18-49 21-45Q24-42 30-42Q36-42 39-45Q42-49 42-54Q42-60 39-63Q36-67 30-67Q24-67 21-63Q18-60 18-54Z"],"9":[60,"M29-32Q35-32 39-37Q43-41 43-49Q43-57 39-62Q35-66 29-66Q23-66 19-62Q16-58 16-49Q16-41 19-37Q23-32 29-32ZM12-2L12-11Q15-9 18-8Q22-7 25-7Q35-7 39-14Q44-21 44-35Q42-30 38-27Q34-25 28-25Q18-25 12-31Q6-38 6-50Q6-61 12-68Q18-74 29-74Q42-74 48-65Q53-56 53-36Q53-18 46-8Q39 1 26 1Q22 1 19 1Q15 0 12-2Z"],"A":[60,"M30-64L20-27L40-27ZM24-73L36-73L58 0L48 0L43-19L17-19L12 0L2 0Z"],"B":[60,"M18-35L18-8L30-8Q38-8 42-11Q46-14 46-21Q46-28 42-31Q38-35 30-35ZM18-65L18-43L29-43Q37-43 40-46Q43-48 43-54Q43-60 40-62Q37-65 29-65ZM8-73L30-73Q41-73 47-68Q53-63 53-54Q53-48 50-44Q47-40 40-39Q47-38 51-33Q56-28 56-20Q56-10 49-5Q43 0 30 0L8 0Z"],"C":[60,"M52-3Q49-1 45 0Q41 1 36 1Q22 1 15-8Q7-18 7-36Q7-54 15-64Q22-74 36-74Q41-74 45-73Q49-72 52-70L52-60Q49-63 45-65Q40-66 36-66Q27-66 22-59Q17-51 17-36Q17-21 22-14Q27-7 36-7Q41-7 45-8Q49-10 52-13Z"],"D":[60,"M21-8Q34-8 39-14Q44-20 44-36Q44-53 39-59Q34-65 21-65L17-65L17-8ZM21-73Q38-73 46-64Q54-55 54-36Q54-18 46-9Q38 0 21 0L7 0L7-73Z"],"E":[60,"M10-73L53-73L53-65L19-65L19-43L51-43L51-35L19-35L19-8L54-8L54 0L10 0Z"],"F":[60,"M11-73L54-73L54-65L21-65L21-43L51-43L51-35L21-35L21 0L11 0Z"],"G":[60,"M54-6Q50-2 45 0Q40 1 34 1Q20 1 13-9Q5-18 5-36Q5-54 13-64Q21-74 35-74Q39-74 43-73Q48-72 51-69L51-59Q47-63 43-64Q39-66 35-66Q25-66 20-59Q15-51 15-36Q15-21 20-14Q25-7 34-7Q38-7 40-7Q42-8 44-10L44-29L34-29L34-37L54-37Z"],"H":[60,"M7-73L17-73L17-43L44-43L44-73L54-73L54 0L44 0L44-35L17-35L17 0L7 0Z"],"I":[60,"M10-73L50-73L50-65L35-65L35-8L50-8L50 0L10 0L10-8L25-8L25-65L10-65Z"],"J":[60,"M5-3L5-14Q10-11 15-9Q19-7 24-7Q31-7 34-10Q37-14 37-24L37-65L18-65L18-73L47-73L47-24Q47-10 42-4Q36 1 24 1Q20 1 15 0Q10-1 5-3Z"],"K":[60,"M7-73L17-73L17-40L47-73L59-73L31-43L60 0L48 0L24-37L17-29L17 0L7 0Z"],"L":[60,"M11-73L20-73L20-8L56-8L56 0L11 0Z"],"M":[60,"M4-73L17-73L30-36L43-73L56-73L56 0L47 0L47-64L34-26L26-26L13-64L13 0L4 0Z"],"N":[60,"M7-73L19-73L44-13L44-73L53-73L53 0L41 0L16-60L16 0L7 0Z"],"O":[60,"M44-36Q44-52 41-59Q38-66 30-66Q23-66 19-59Q16-52 16-36Q16-20 19-13Q23-7 30-7Q38-7 41-13Q44-20 44-36ZM54-36Q54-17 48-8Q42 1 30 1Q18 1 12-8Q6-17 6-36Q6-55 12-65Q18-74 30-74Q42-74 48-65Q54-55 54-36Z"],"P":[60,"M19-65L19-37L31-37Q38-37 42-41Q45-45 45-51Q45-58 42-61Q38-65 31-65ZM10-73L31-73Q43-73 49-67Q56-62 56-51Q56-40 49-35Q43-29 31-29L19-29L19 0L10 0Z"],"R":[60,"M37-34Q41-33 44-31Q46-28 50-20L60 0L50 0L41-18Q37-26 34-29Q31-31 26-31L17-31L17 0L7 0L7-73L27-73Q39-73 46-67Q52-62 52-52Q52-45 48-40Q44-35 37-34ZM17-65L17-39L28-39Q35-39 38-42Q42-45 42-52Q42-58 38-61Q34-65 27-65Z"],"S":[60,"M49-70L49-60Q45-63 40-65Q36-66 31-66Q24-66 20-63Q16-60 16-54Q16-49 19-47Q22-44 29-43L34-41Q44-39 49-34Q54-29 54-20Q54-10 47-4Q41 1 28 1Q23 1 18 0Q13-1 8-3L8-13Q13-10 18-8Q23-7 28-7Q36-7 40-10Q44-13 44-19Q44-25 41-28Q38-31 31-32L26-33Q16-36 11-40Q7-45 7-53Q7-62 13-68Q20-74 31-74Q35-74 40-73Q44-72 49-70Z"],"T":[60,"M2-73L58-73L58-65L35-65L35 0L25 0L25-65L2-65Z"],"U":[60,"M7-28L7-73L17-73L17-23Q17-18 17-16Q18-14 18-12Q20-10 23-8Q26-7 30-7Q34-7 37-8Q40-10 42-12Q43-14 43-16Q43-18 43-23L43-73L53-73L53-28Q53-17 52-12Q50-7 47-4Q44-1 39 0Q35 1 30 1Q25 1 21 0Q17-1 13-4Q10-7 9-12Q7-17 7-28Z"],"V":[60,"M30-8L47-73L57-73L36 0L24 0L3-73L13-73Z"],"W":[60,"M0-73L10-73L17-14L25-53L35-53L44-14L51-73L60-73L49 0L40 0L30-43L20 0L11 0Z"],"X":[60,"M4-73L15-73L31-45L47-73L58-73L36-39L59 0L49 0L31-31L12 0L1 0L25-39Z"],"Y":[60,"M2-73L12-73L30-41L48-73L58-73L35-33L35 0L25 0L25-33Z"],"Z":[60,"M9-73L56-73L56-65L18-8L57-8L57 0L8 0L8-8L45-65L9-65Z"],"·":[60,"M24-42L36-42L36-27L24-27Z"],":":[60,"M24-52L36-52L36-37L24-37ZM24-15L36-15L36 0L24 0Z"],".":[60,"M24-15L36-15L36 0L24 0Z"],"-":[60,"M17-31L43-31L43-23L17-23Z"],"/":[60,"M43-73L53-73L14 9L5 9Z"],"%":[60,"M34-16Q34-12 37-9Q39-7 43-7Q47-7 49-9Q52-12 52-16Q52-19 49-22Q47-25 43-25Q39-25 37-22Q34-19 34-16ZM27-16Q27-22 32-27Q36-31 43-31Q46-31 49-30Q52-29 54-27Q56-24 57-21Q59-19 59-16Q59-9 54-5Q50 0 43 0Q36 0 32-4Q27-9 27-16ZM6-23L4-27L55-48L57-43ZM8-54Q8-50 11-48Q13-45 17-45Q21-45 24-48Q26-51 26-54Q26-58 24-61Q21-63 17-63Q13-63 11-61Q8-58 8-54ZM2-54Q2-61 6-65Q11-70 17-70Q20-70 23-69Q26-68 28-65Q30-63 32-60Q33-57 33-54Q33-48 28-43Q24-39 17-39Q11-39 6-43Q2-48 2-54Z"]};
const GZ = {"雨":[100,"M69-6Q64-14 57-21L62-26Q69-19 75-11ZM69-29Q64-37 57-43L62-49Q69-42 75-33ZM34-6Q28-14 21-21L27-26Q34-19 40-11ZM34-29Q28-37 21-43L27-49Q34-42 40-33ZM52 12Q48 12 45 12Q45 5 45-2L45-54L16-54L16-2Q16 5 16 12Q13 11 9 12Q9 5 9-2L9-59L45-59L45-72L12-72Q7-72 2-71Q2-74 2-77Q7-77 12-77L85-77Q91-77 96-77Q96-74 96-71Q91-72 85-72L52-72L52-59L88-59L88 2Q88 8 84 10Q79 13 70 13Q71 8 68 4Q71 5 75 5Q79 5 80 4Q81 3 81-1L81-54L52-54L52-2Q52 5 52 12Z"],"停":[100,"M61 2L61-18L48-18Q43-18 39-18Q39-20 39-23Q43-23 48-23L77-23Q81-23 86-23Q86-20 86-18Q81-18 77-18L68-18L68 4Q68 7 65 9Q61 13 51 13Q52 8 49 5Q52 5 56 5Q60 5 61 4Q61 4 61 2ZM34-22L28-22L28-36L95-36L95-22L88-22L88-31L34-31ZM40-42Q42-51 40-59L83-59Q82-51 83-42ZM92-70Q92-68 92-65Q88-65 83-65L42-65Q37-65 32-65Q33-68 32-70Q37-70 42-70L57-70L52-76L57-81L67-70L66-70L83-70Q88-70 92-70ZM47-55L47-47L76-47L76-55ZM31-77Q27-64 21-52L21 0Q21 6 21 13Q18 13 15 13Q15 6 15 0L15-42Q11-35 5-30Q3-34 0-35Q5-40 9-45Q16-54 19-62Q22-70 24-79Q27-78 31-77Z"],"了":[100,"M45-3L45-49L70-66L22-66Q15-66 9-66Q9-70 9-73Q15-73 22-73L84-73L85-66Q80-65 77-62L52-45L52 0Q52 4 49 7Q45 11 33 11Q34 5 31 2Q34 2 39 2Q43 2 44 1Q45 1 45-3Z"],"趁":[100,"M87-27Q89-24 93-22Q69-1 45 3Q45-1 43-4Q62-7 73-15Q80-21 87-27ZM77-41Q80-38 83-36Q70-22 50-13Q49-16 46-18Q55-22 62-27Q69-32 77-41ZM71-55Q73-52 76-50Q66-38 48-28Q47-32 44-33Q51-37 57-42Q64-47 71-55ZM92-47Q77-54 68-67Q60-54 46-46Q45-49 42-51Q50-56 56-63Q62-70 67-81Q70-79 73-78Q72-75 71-73Q75-66 80-61Q87-56 96-52Q93-50 92-47ZM3 9Q13 1 12-18Q12-25 12-31Q15-31 19-31Q19-25 19-18L19-14Q21-9 25-5L25-39L16-39Q11-39 7-39Q7-41 7-44Q11-43 16-43L25-43L25-58L18-58Q13-58 9-58Q9-60 9-63Q13-63 18-63L25-63L25-68Q25-74 25-81Q28-80 32-81Q32-74 32-68L32-63L45-63Q44-60 45-58L32-58L32-43L36-43Q41-43 45-44Q45-41 45-39Q41-39 36-39L31-39L31-24Q40-25 44-25Q44-22 44-20Q42-20 31-20L31 0L31 0Q39 4 53 5Q57 5 72 6Q88 7 92 7Q90 9 89 14Q80 13 69 13Q58 13 52 12Q28 10 17-3Q15 6 9 13Q7 10 3 9Z"],"快":[100,"M41-28Q36-28 31-27Q31-30 31-33Q36-33 41-33L54-33L54-57L48-57Q43-57 37-57Q38-60 37-63Q43-62 48-62L54-62L54-68Q54-75 54-82Q58-82 62-82Q61-75 61-68L61-62L84-62L84-33L96-33Q95-30 96-27Q90-28 85-28L66-28Q71-16 78-8Q85 0 97 6Q93 8 91 11Q81 6 73-4Q65-13 61-24Q58-12 51-2Q43 8 32 12Q30 8 26 7Q37 3 45-6Q53-15 54-28ZM77-33L77-57L61-57L61-33ZM22 0Q22 7 22 13Q18 13 14 13Q15 7 15 0L15-67Q15-74 14-81Q18-80 22-81Q22-74 22-67L22-59L25-61L36-47L30-42L22-53ZM-3-37Q1-47 5-58L12-56Q9-45 4-34Z"],"送":[100,"M57 9Q34 9 23-3L7 8Q5 5 3 2L20-7L20-47L13-47Q8-47 3-47Q4-49 3-52Q8-52 13-52L26-52L26-7Q34-2 41 0Q46 1 57 1L94 2Q90 4 91 9ZM25-65L19-61L8-75L14-79ZM43-34Q38-34 33-34Q33-37 33-40Q38-39 43-39L55-39L55-54L45-54Q40-54 35-54Q35-57 35-59Q40-59 45-59L49-59Q45-68 40-76L46-80Q52-71 56-62L49-59L60-59Q66-69 72-81Q75-79 79-78Q75-69 68-59L76-59Q81-59 86-59Q86-57 86-54Q81-54 76-54L65-54Q64-54 64-54L62-54L62-39L79-39Q84-39 89-40Q89-37 89-34Q84-34 79-34L62-34Q61-31 60-28L63-30L75-20L87-8L81-3L70-14L59-24Q53-10 39-3Q38-7 34-9Q42-12 48-18Q54-25 55-34Z"],"鱼":[100,"M96 0Q96 3 96 6Q91 6 85 6L16 6Q10 6 5 6Q6 3 5 0Q10 1 16 1L85 1Q91 1 96 0ZM38-71L67-71L68-65Q66-64 64-63L56-54L80-54Q79-32 80-10L19-10Q20-21 20-30Q20-40 19-48Q13-42 7-37Q5-41 1-43Q18-54 25-65Q31-73 35-81Q38-79 42-77ZM53-35L73-35L73-49L53-49ZM46-35L46-49L26-49L26-35ZM53-30L53-15L73-15L73-30ZM46-30L26-30L26-15L46-15ZM47-54L47-55L57-65L34-65Q29-59 25-54Z"],"鹈":[100,"M32 12Q28 12 25 12Q25 5 25-1L25-17Q19-6 6 5Q4 3 1 1Q7-4 11-10Q16-16 22-26L9-26L9-47L25-47L25-58L18-58Q13-58 9-57Q9-60 9-62Q13-62 18-62L28-62Q33-70 36-80Q40-79 43-78Q41-71 35-62L48-62L48-43L31-43L31-31L48-31L48-13Q48-10 45-7Q41-5 36-5Q37-10 34-13Q35-13 37-13Q41-12 41-13Q42-13 42-14L42-26L31-26L31-1Q31 5 32 12ZM26-66L20-63L10-78L17-82ZM25-31L25-43L15-43Q15-37 16-31ZM31-47L41-47L41-58L33-58L32-57Q32-58 31-58ZM86-13Q85-10 86-7Q81-8 77-8L64-8Q60-8 56-7Q56-10 56-13Q60-12 64-12L77-12Q81-12 86-13ZM80-51L75-46L68-57L73-61ZM78-33Q79-38 77-41Q79-41 82-41Q85-41 85-41Q86-42 86-43L86-63L72-63L71-62Q71-63 70-63Q69-63 66-63L66-29L96-29L96 4Q96 8 94 11Q90 14 82 14Q83 9 80 6Q83 6 86 6Q90 6 90 5Q91 5 91 3L91-25L61-25L61-68Q65-68 68-68Q72-72 73-78Q76-77 79-76Q78-71 76-68L91-68L91-42Q91-39 89-37Q86-33 78-33Z"],"鹕":[100,"M49-26L39-26Q40-11 35-2Q30 7 22 12Q21 9 17 7Q33 0 33-22L33-74L56-74L56 1Q56 8 52 10Q48 13 41 12Q42 8 39 5Q41 5 44 5Q47 5 48 4Q49 3 49-3ZM12-2L5-2L5-38Q9-38 13-38L13-54L2-53Q2-56 2-58L13-58L13-69Q13-76 13-82Q16-82 20-82Q19-76 19-69L19-58L32-58Q32-56 32-53L19-54L19-38L28-38L28-2L21-2L21-10L12-10ZM49-52L49-70L39-70L39-52ZM49-30L49-49L39-49L39-30ZM21-34L12-34L12-14L21-14ZM87-13Q86-10 87-7Q83-8 79-8L66-8Q63-8 59-7Q59-10 59-13Q63-12 66-12L79-12Q83-12 87-13ZM81-51L77-46L71-57L75-61ZM80-33Q80-38 78-41Q80-41 83-41Q86-41 86-41Q87-42 87-43L87-63L74-63L73-62Q73-63 72-63Q71-63 68-63L68-29L97-29L97 4Q97 8 94 11Q91 14 83 14Q84 9 81 6Q84 6 87 6Q90 6 91 5Q91 5 91 3L91-25L63-25L63-68Q67-68 71-68Q74-72 75-78Q78-77 81-76Q79-71 78-68L92-68L92-42Q92-39 90-37Q87-33 80-33Z"],"外":[100,"M71-3Q71 5 71 12Q67 12 63 12Q63 5 63-3L63-65Q63-72 63-80Q67-79 71-80Q71-72 71-65L71-51L84-41L98-29L93-23L79-35L71-41ZM26-80Q30-79 34-78Q32-69 28-60L55-60Q53-38 40-19Q28-1 9 10Q6 7 2 5Q24-6 37-27L33-24Q26-32 19-40Q14-31 8-24Q5-28 1-29Q16-45 21-60Q24-69 26-80ZM38-29Q45-41 47-54L26-54Q25-51 23-47Q31-39 38-29Z"],"卖":[100,"M89 7L85 13L69 3L52-6L56-13L73-3ZM52-49Q55-48 59-49Q59-42 59-35L59-26Q59-23 58-20L85-20Q91-20 96-20Q96-17 96-14Q91-14 85-14L56-14Q51-6 40 1Q26 10 10 13Q9 8 4 6Q22 5 37-5Q44-9 48-14L13-14Q8-14 3-14Q3-17 3-20Q8-20 13-20L51-20Q52-23 52-26L52-35Q52-42 52-49ZM36-27L31-21L19-33L24-38ZM19-54Q14-54 9-54Q9-57 9-59Q14-59 19-59L46-59L46-70L28-70Q23-70 17-69Q18-72 17-75Q23-75 28-75L46-75Q46-79 46-82Q49-82 53-82Q53-78 53-75L73-75Q78-75 83-75Q83-72 83-69Q78-70 73-70L53-70L53-59L91-59L92-53Q91-53 90-52L82-40L76-43L83-54L33-54Q39-46 45-38L39-34Q33-42 26-49L31-54Z"],"星":[100,"M96 2Q96 5 96 7Q91 7 86 7L16 7Q11 7 5 7Q6 5 5 2Q11 2 16 2L47 2L47-11L30-11Q25-11 20-11Q20-14 20-17Q25-16 30-16L47-16L47-29L23-29Q17-19 8-7Q5-10 2-10Q10-20 17-33L22-44L28-42Q27-37 25-34L47-34L47-43L54-43L54-34L77-34Q82-34 88-34Q87-32 88-29Q82-29 77-29L54-29L54-16L73-16Q78-16 83-17Q83-14 83-11Q78-11 73-11L54-11L54 2L86 2Q91 2 96 2ZM25-44L18-44L18-80L81-80L81-44L74-44L74-47L25-47ZM74-66L74-75L25-75Q25-70 25-66ZM74-61L25-61L25-52L74-52Z"],"云":[100,"M17-37Q11-37 5-37Q5-40 5-44Q11-43 17-43L81-43Q87-43 93-44Q93-40 93-37Q87-37 81-37L47-37Q45-34 38-24L22 1L65-3L71-3L58-23L65-28L76-10L88 9L81 13L74 2L65 3L12 8L11 2Q13 2 15 0Q18-5 26-17Q34-29 38-37ZM82-73Q82-70 82-66Q76-67 70-67L27-67Q21-67 15-66Q15-70 15-73Q21-72 27-72L70-72Q76-72 82-73Z"],"晴":[100,"M80 1L80-7L50-7L50-2Q50 5 51 12Q47 11 43 12Q44 5 44-2L44-37L50-37L50-37L87-37L87 3Q87 7 84 10Q81 13 71 13Q72 8 69 5Q72 5 75 5Q79 5 80 4Q80 4 80 1ZM96-48Q96-45 96-43Q92-43 88-43L43-43Q39-43 35-43Q35-45 35-48Q39-47 43-47L62-47L62-55L49-55Q45-55 40-55Q41-58 40-60Q45-60 49-60L62-60L62-68L46-68Q42-68 37-67Q38-70 37-72Q42-72 46-72L62-72Q62-77 62-82Q65-82 69-82Q69-77 69-72L85-72Q90-72 94-72Q94-70 94-67Q90-68 85-68L69-68L69-60L82-60Q86-60 90-60Q90-58 90-55Q86-55 82-55L69-55L69-47L88-47Q92-47 96-48ZM80-24L80-33L50-33Q50-28 50-24ZM80-11L80-20L50-20L50-11ZM12-3L5-3L5-73L30-73L30-3L23-3L23-9L12-9ZM23-44L23-68L12-68L12-44ZM23-39L12-39L12-14L23-14Z"],"ハ":[102,"M95-6L86-3Q83-18 69-41Q65-48 61-53L67-57Q86-31 95-6ZM38-49Q38-49 36-47L35-46Q27-22 12-6Q10-4 8-1L-1-5Q10-11 21-32Q27-44 29-55L36-52Q38-50 38-49Z"],"レ":[102,"M89-36Q73-21 51-9Q37 0 26 3Q25 3 22 6Q20 6 17 2Q14 0 14-1Q14-2 15-2L15-68L22-68Q24-68 25-67Q25-67 24-64Q23-63 23-62L23-4Q48-12 73-32Q78-37 83-42Z"]};
