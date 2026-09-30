// OWNER: eggs. Easter eggs (彩蛋) for Pelican Bay, painted as little picture-book surprises (STYLE-B: warm storybook
// gouache). Spoilers: docs/EGGS.md. Test API: window.__pb.eggs = { list, trigger(id), found() }; tools/check-eggs.mjs
// shoots each one.
//
// Every egg is an X-sheet: a start time t0 (sim time) + a pure function of (frame.t - t0, frame.distance, pose). Live
// detection (keys, clicks, bus events, odometer crossings) only ever sets t0, so window.__pb.renderAt(t) stays exact
// and nothing is created or destroyed at run time: all art is built once and shown / hidden / moved by transform.
//
// The hand-made look is BAKED INTO THE GEOMETRY (STYLE-B §2): every outline is run through a seeded wobble (wobD), gets
// a second offset "pencil" pass, painted fills get static <pattern> gouache blotches in their own local coordinates,
// lettering is glyph outlines with a hand-lettered baseline wander. No filters anywhere in this module (eggs move).
//
//   brown      ↑↑↓↓←→←→BA  the rider becomes Simon Willison's stricter benchmark: a California brown pelican in
//                          breeding plumage (paint override on the rider's slots; the code again turns it back)
//   velo       type GIMINI  a Gimini "Velocipedia" chain bolted to the front hub: the drivetrain jams, the chain SNAPs
//   cat        ring the bell while the ginger cat's bench is on screen: it leaps up and steals a fish
//   km         every whole kilometre on the odometer: a little picture-book plate pops up in petals
//   fortytwo   at 4.2 km: "42! Don't panic" (a falling whale and a bowl of petunias)
//   sunwink    click the sun: it winks
//   moonwink   click the moon: it winks too (and wears a nightcap at bedtime)
//   ufo        feed the pelican at night: a saucer beams a second fish out of the basket
//   chorus     ring the bell 7 times in 3.5 s: five gulls answer in chorus
//   splash     land a hop in a road puddle: SPLASH!
//   bottle     click the message in a bottle bobbing in the bay: a bilingual letter unfolds
//   wish       click a shooting star while it is still glowing: make a wish
//   flight     type BIRD: a V of great white pelicans flies over the bay
//   pageturn   click the dog-eared page corner: the page turns (a paper curl) to the next time of day
//   theend     ride a marathon, 42.195 km: the page irises shut, "The End" … "?"
//   bedtime    coast for 30 s at night: the pelican yawns, a nightcap drops onto its head, Z z z
import { fmt1, fmt2 } from '../core/math.js';
import { GROUND_Y, RIDER_X, BIKE } from '../contract.js';
import { h, refs } from '../core/svg.js';
import { TIMING } from '../rig/solve.js';
import { LAT, ZH } from './egg-glyphs.js';

export const id = 'eggs';
// the eggs' own gouache paints (golden hour), graded by the hour like every material
export const materials = {
  eggGinger: '#EE9A48', eggGingerLo: '#C4652E', eggCream: '#FBEBD0', eggRose: '#F2938C', eggPink: '#F7BBAA',
  eggWood: '#B8814E', eggWoodLo: '#7A4A2A', eggIron: '#4A3438',
  eggFish: '#8FB2DC', eggFishLo: '#5A76B4', eggGull: '#B8B2C8', eggGullTip: '#3A3240',
  eggWater: '#A6C4E4', eggWaterLo: '#6A78B0', eggGlass: '#62B09C', eggGlassHi: '#C8EAD8', eggCork: '#C89B5E',
  eggGold: '#FAC957', eggGoldLo: '#E39A3C', eggRed: '#D8443A', eggRedLo: '#A82E2E', eggTeal: '#1F8A8A', eggTealHi: '#5CC0B2',
  eggHull: '#F1E4CE', eggHullLo: '#C9B79E', eggDome: '#A8D4CF', eggAlien: '#9CCB7A', eggNavy: '#3A5AA3', eggLeaf: '#7FA067',
  eggPetal: '#F2A0B8', eggWhale: '#7C8CC8', eggPot: '#C9703E', eggSky: '#FFD9A0', eggSkyHi: '#F3AE78', eggNight: '#34357A',
  eggUnder: '#D9C3A8',
  // Konami: a California brown pelican in breeding plumage
  eggBrBody: '#8F8378', eggBrShade: '#665850', eggBrDeep: '#3F3436', eggBrNeck: '#6E3524', eggBrCrown: '#F2CF6E',
  eggBrWhite: '#FFF3E2', eggBrPouch: '#4E3F3C', eggBrPouchRed: '#B8433A', eggBrBill: '#CDB7A0', eggBrFoot: '#3A2F31',
};

// ------------------------------------------------------------------------------------------------ list (bilingual)
export const EGGS = [
  ['brown', '褐鹈鹕', 'Brown pelican', '↑↑↓↓←→←→BA'],
  ['velo', '维洛西佩迪亚', 'Velocipedia', 'type GIMINI'],
  ['cat', '偷鱼猫', 'The fish thief', 'ring near the cat'],
  ['km', '一公里', 'First kilometre', 'ride 1 km'],
  ['fortytwo', '四十二', 'Forty-two', 'ride 4.2 km'],
  ['sunwink', '太阳眨眼', 'Winking sun', 'click the sun'],
  ['moonwink', '月亮眨眼', 'Winking moon', 'click the moon'],
  ['ufo', '夜空来客', 'Close encounter', 'feed at night'],
  ['chorus', '海鸥合唱', 'Gull chorus', 'ring 7×'],
  ['splash', '水花', 'Splash', 'hop into a puddle'],
  ['bottle', '漂流瓶', 'Message in a bottle', 'click the bottle'],
  ['wish', '流星许愿', 'Wish upon a star', 'click a shooting star'],
  ['flight', '鹈鹕雁阵', 'Pelican squadron', 'type BIRD'],
  ['pageturn', '翻页', 'Turn the page', 'click the page corner'],
  ['theend', '全剧终？', 'The End?', 'ride 42.195 km'],
  ['bedtime', '晚安', 'Bedtime', 'coast 30 s at night'],
].map(([k, zh, en, how]) => ({ id: k, zh, en, how }));
const DUR = { brown: 6, velo: 3.4, cat: 2.6, km: 3.6, fortytwo: 4.6, sunwink: 2.4, moonwink: 2.4, ufo: 6.8, chorus: 3.6, splash: 1.5, bottle: 7, wish: 2.6, flight: 9, pageturn: 1.5, theend: 9, bedtime: 16 };
const TURN = 1.3;                  // page-turn sweep (s)
const TODS = [0.27, 0.5, 0.7, 0.765, 0.84, 0.93];   // dawn · noon · golden · sunset · dusk · night (the page order)
export const nextTod = tod => TODS.find(x => x > tod + 0.012) ?? TODS[0];
const MARATHON = 42.195;           // km

// the dog-eared corner is always on the page (a visible clue); the rest only appear once found
export const detailItems = [
  { id: 'typography_frame:O:page-dog-ear', layer: 'typography_frame', kind: 'O', what: 'the dog-eared page corner (lifts now and then; click it to turn the page)' },
  { id: 'sea:O:message-bottle', layer: 'sea', kind: 'O', what: 'a green message-in-a-bottle with a rolled letter, bobbing in the bay (glints every 22 s)' },
  { id: 'land:O:cat-bench', layer: 'land', kind: 'O', what: 'a painted wooden bench with iron scrolls, a folded newspaper and a ginger tabby' },
  { id: 'land:O:road-puddle', layer: 'land', kind: 'O', what: 'a road puddle with sky reflections and a floating leaf' },
];
const DD = n => ({ 'data-detail': n });

// ------------------------------------------------------------------------------------------------ helpers
const f = fmt1;   // = String(Math.round(x * 10) / 10), fast (core/math.js)
const f2 = fmt2;
const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
const wrap = (x, m) => ((x % m) + m) % m;
const easeOutBack = u => { const c = 1.9, v = u - 1; return 1 + (c + 1) * v * v * v + c * v * v; };
const easeInOut = u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const hash = (a, b = 0) => {
  let x = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35);
  x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12; x = Math.imul(x, 0x297a2d39); x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
};
const circ = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const ell = (x, y, rx, ry) => `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
const poly = (pts, close = true) => 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + (close ? 'Z' : '');
const rrect = (x, y, w, hh, r) => `M${f(x + r)} ${f(y)}H${f(x + w - r)}Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + r)}V${f(y + hh - r)}Q${f(x + w)} ${f(y + hh)} ${f(x + w - r)} ${f(y + hh)}H${f(x + r)}Q${f(x)} ${f(y + hh)} ${f(x)} ${f(y + hh - r)}V${f(y + r)}Q${f(x)} ${f(y)} ${f(x + r)} ${f(y)}Z`;
// Catmull-Rom -> cubic (the draft's cr())
function smooth(pts, closed = true, k = 1 / 6) {
  const n = pts.length; let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  const g = i => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    d += `C${f(p1[0] + (p2[0] - p0[0]) * k)} ${f(p1[1] + (p2[1] - p0[1]) * k)} ${f(p2[0] - (p3[0] - p1[0]) * k)} ${f(p2[1] - (p3[1] - p1[1]) * k)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + (closed ? 'Z' : '');
}
// smooth deterministic noise field (the "hand" of the painter)
const nz = (x, y, s) => Math.sin(x * 0.19 + y * 0.13 + s * 1.7) * 0.5 + Math.sin(x * 0.047 - y * 0.37 + s * 3.1 + 1) * 0.3 + Math.sin(x * 0.61 + y * 0.53 + s * 0.7 + 2) * 0.2;
// wobD: rewrite a path so every point is displaced by the noise field and long straight edges are resampled into a
// gently wandering brush line (absolute / relative M L H V C S Q T A Z)
let WA = 0.9;
function wobD(d, amp = WA, s = 0, seg = 10) {
  if (!amp || !d) return d;
  const t = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)/g); if (!t) return d;
  let i = 0, cmd = 'M', cx = 0, cy = 0, sx = 0, sy = 0, lq = null, out = '';
  const num = () => +t[i++];
  const jx = (x, y) => x + nz(x, y, s) * amp, jy = (x, y) => y + nz(y + 31.7, x - 17.3, s + 3) * amp;
  const J = (x, y) => f(jx(x, y)) + ' ' + f(jy(x, y));
  const lineTo = (x, y) => {
    const len = Math.hypot(x - cx, y - cy), n = Math.min(16, Math.floor(len / seg));
    if (n < 2) out += 'L' + J(x, y);
    else {
      const P = []; for (let k = 0; k <= n; k++) { const px = lerp(cx, x, k / n), py = lerp(cy, y, k / n); P.push([jx(px, py), jy(px, py)]); }
      for (let k = 1; k < n; k++) { const m = k < n - 1 ? [(P[k][0] + P[k + 1][0]) / 2, (P[k][1] + P[k + 1][1]) / 2] : P[n]; out += 'Q' + f(P[k][0]) + ' ' + f(P[k][1]) + ' ' + f(m[0]) + ' ' + f(m[1]); }
    }
    cx = x; cy = y;
  };
  while (i < t.length) {
    const tk = t[i];
    if ((tk >= 'A' && tk <= 'Z') || (tk >= 'a' && tk <= 'z')) {
      cmd = tk; i++;
      if (cmd === 'Z' || cmd === 'z') { if (Math.abs(cx - sx) + Math.abs(cy - sy) > 0.01) lineTo(sx, sy); out += 'Z'; cx = sx; cy = sy; lq = null; }
      continue;
    }
    const rel = cmd >= 'a', C = rel ? cmd.toUpperCase() : cmd, ox = rel ? cx : 0, oy = rel ? cy : 0;
    if (C === 'M') { const x = num() + ox, y = num() + oy; out += 'M' + J(x, y); cx = sx = x; cy = sy = y; cmd = rel ? 'l' : 'L'; lq = null; }
    else if (C === 'L') { const x = num() + ox, y = num() + oy; lineTo(x, y); lq = null; }
    else if (C === 'H') { const x = num() + ox; lineTo(x, cy); lq = null; }
    else if (C === 'V') { const y = num() + oy; lineTo(cx, y); lq = null; }
    else if (C === 'C' || C === 'S') {
      let x1c, y1c; if (C === 'C') { x1c = num() + ox; y1c = num() + oy; } else { x1c = lq && lq[0] === 'C' ? 2 * cx - lq[1] : cx; y1c = lq && lq[0] === 'C' ? 2 * cy - lq[2] : cy; }
      const x2 = num() + ox, y2 = num() + oy, x = num() + ox, y = num() + oy;
      out += 'C' + J(x1c, y1c) + ' ' + J(x2, y2) + ' ' + J(x, y); lq = ['C', x2, y2]; cx = x; cy = y;
    } else if (C === 'Q' || C === 'T') {
      let x1c, y1c; if (C === 'Q') { x1c = num() + ox; y1c = num() + oy; } else { x1c = lq && lq[0] === 'Q' ? 2 * cx - lq[1] : cx; y1c = lq && lq[0] === 'Q' ? 2 * cy - lq[2] : cy; }
      const x = num() + ox, y = num() + oy;
      out += 'Q' + J(x1c, y1c) + ' ' + J(x, y); lq = ['Q', x1c, y1c]; cx = x; cy = y;
    } else if (C === 'A') {
      const rx = num(), ry = num(), ra = num(), la = num(), sw = num(), x = num() + ox, y = num() + oy;
      out += 'A' + f(rx) + ' ' + f(ry) + ' ' + ra + ' ' + la + ' ' + sw + ' ' + J(x, y); cx = x; cy = y; lq = null;
    } else i++;
  }
  return out;
}
// hand-drawn ellipse (jittered Catmull-Rom)
const blob = (x, y, rx, ry = rx, j = 0.07, s = 0) => {
  const r = Math.max(rx, ry); if (r < 3) return ell(x, y, rx, ry);
  const n = Math.max(8, Math.min(18, Math.round(r * 0.4 + 7))), pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU, k = 1 + nz(x + i * 13.1, y - i * 7.7, s + 9) * j; pts.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k]); }
  return smooth(pts);
};
// tapered brush dab from (x,y), length len, belly half-width w, angle a (deg)
const dab = (x, y, len, w, a = 0) => {
  const c = Math.cos(a * D2R), s = Math.sin(a * D2R), bx = x + len * c, by = y + len * s, mx = (x + bx) / 2, my = (y + by) / 2, nx = -s * w, ny = c * w;
  return `M${f(x)} ${f(y)}Q${f(mx + nx)} ${f(my + ny)} ${f(bx)} ${f(by)}Q${f(mx - nx * 0.45)} ${f(my - ny * 0.45)} ${f(x)} ${f(y)}Z`;
};
// scalloped storybook bubble (a gouache cloud) of radii rx, ry
const puffD = (rx, ry, n, seed) => {
  const pts = [];
  for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * TAU + 0.2, r = i % 2 ? 1.08 + 0.07 * hash(seed, i) : 0.93; pts.push([Math.cos(a) * rx * r, Math.sin(a) * ry * r]); }
  return smooth(pts, true, 0.2);
};
// torn / deckled paper slip (w × hh, centred)
function deckle(w, hh, seed) {
  const pts = [], st = 13;
  const edge = (x0, y0, x1, y1, nx, ny, k) => {
    const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(L / st));
    for (let i = 0; i < n; i++) { const u = i / n, j = (hash(seed + k, i) - 0.5) * 2.6 + (hash(seed + k, i + 50) < 0.08 ? -2.4 : 0); pts.push([lerp(x0, x1, u) + nx * j, lerp(y0, y1, u) + ny * j]); }
  };
  const W = w / 2, H = hh / 2;
  edge(-W, -H, W, -H, 0, -1, 1); edge(W, -H, W, H, 1, 0, 2); edge(W, H, -W, H, 0, 1, 3); edge(-W, H, -W, -H, -1, 0, 4);
  return poly(pts);
}
// four-point painted twinkle
const twinkle = (r, w) => { const p = []; for (let i = 0; i < 8; i++) { const a = (i * 45 - 90) * D2R, rr = i % 2 ? w : r; p.push([Math.cos(a) * rr, Math.sin(a) * rr]); } return smooth(p, true, 0.05); };
// rounded five-point star
const star5 = (r, ri = 0.5) => { const p = []; for (let i = 0; i < 10; i++) { const a = (i * 36 - 90) * D2R, rr = i % 2 ? r * ri : r; p.push([Math.cos(a) * rr, Math.sin(a) * rr]); } return smooth(p, true, 0.06); };

// ---- brush kit (filled + inked in one element; a pencil pass; glazes; ink lines) --------------------------------
const INK = 'var(--pb-line)', INK2 = 'var(--pb-lineSoft)';
let SEED = 0;
const O = (d, fill, w = 1.8, o = {}) => h('path', { d: wobD(d, WA, SEED), fill, stroke: INK, 'stroke-width': w, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', ...o });
const Pc = (d, w = 1.6) => h('path', { d: wobD(d, WA * 1.4, SEED + 5), fill: 'none', stroke: INK, 'stroke-width': f2(w * 0.5), 'stroke-linecap': 'round', opacity: 0.34, transform: 'translate(0.9 0.7)' });
const Gz = (d, fill, op = 0.5) => h('path', { d: wobD(d, WA, SEED + 2), fill, opacity: op });
const Ln = (d, w = 1.5, o = {}) => h('path', { d: wobD(d, WA, SEED + 1), fill: 'none', stroke: INK, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...o });
const F = (d, fill, o = {}) => h('path', { d, fill, ...o });
const TX = (d, pat = 'egg-gouache') => h('path', { d: wobD(d, WA, SEED), fill: `url(#${pat})` });

// ---- lettering: glyph runs -> one merged path, hand-lettered (per-glyph baseline wander and tilt)
function text(str, size, ox = 0, oy = 0, { align = 'middle', track = 16, wob = 0.05, tilt = 0.05, seed = 3 } = {}) {
  const s = size / 1000;
  let pen = 0; const parts = [];
  for (const ch of str) {
    if (ch === ' ') { pen += 300 + track; continue; }
    const g = LAT[ch] || ZH[ch];
    if (!g) continue;
    parts.push([pen, g]); pen += g[0] + track;
  }
  const w = (pen - track) * s, x0 = ox - (align === 'middle' ? w / 2 : align === 'end' ? w : 0);
  let d = '';
  parts.forEach(([p, g], gi) => {
    const cx = x0 + (p + g[0] / 2) * s, cy = oy - size * 0.35;
    const dy = (hash(gi, seed) - 0.5) * size * wob, a = (hash(gi, seed + 7) - 0.5) * 2 * tilt, ca = Math.cos(a), sa = Math.sin(a);
    let i = 0, px = 0;
    d += g[1].replace(/-?\d+(\.\d+)?/g, m => {
      const v = +m;
      if (i++ % 2 === 0) { px = x0 + (v + p) * s; return ' ' + f(px); }
      const py = oy + v * s + dy, rx = px - cx, ry = py - cy;
      return ' ' + f(cy + rx * sa + ry * ca);   // y after tilt (x is left as is: small angles)
    });
  });
  return { d, w };
}
// painted lettering: warm-brown under-stroke + drop shadow (two paths: [0] shadow, [1] letters)
function letter(str, size, x, y, fill, o) {
  const t = text(str, size, x, y, o), sw = clamp(size * 0.075, 0.9, 3);
  return h('path', { d: t.d, fill: INK, opacity: 0.3, transform: `translate(${f(size * 0.03 + 0.6)} ${f(size * 0.04 + 0.8)})` })
    + h('path', { d: t.d, fill, stroke: INK, 'stroke-width': f2(sw), 'stroke-linejoin': 'round', 'paint-order': 'stroke' });
}
const ink = (str, size, x, y, fill = INK, o) => h('path', { d: text(str, size, x, y, { wob: 0.07, tilt: 0.04, ...o }).d, fill });

// ------------------------------------------------------------------------------------------------ build
let V;
// a paper slip with a soft shadow, fibre + gouache texture and a double hand-drawn edge
function slip(w, hh, seed, fill) {
  const d = deckle(w, hh, seed);
  return F(d, V('mauve'), { opacity: 0.38, transform: 'translate(5 7)' }) + F(d, fill || V('paper')) + F(d, 'url(#egg-fibre)') + F(d, 'url(#egg-gouache)')
    + h('path', { d, fill: 'none', stroke: INK, 'stroke-width': 1.5, 'stroke-linejoin': 'round' })
    + h('path', { d: wobD(d, 1.3, seed), fill: 'none', stroke: INK, 'stroke-width': 0.7, opacity: 0.3, transform: 'translate(1.2 1)' });
}
// washi tape strip (translucent, stripes, torn ends)
function tape(x, y, w, a, tint) {
  const hh = 20, W = w / 2, pts = [];
  for (let i = 0; i <= 4; i++) pts.push([W + (i % 2 ? 3 : 0), -hh / 2 + (hh * i) / 4]);
  for (let i = 0; i <= 4; i++) pts.push([-W - (i % 2 ? 3 : 0), hh / 2 - (hh * i) / 4]);
  const d = poly(pts);
  let st = ''; for (let xx = -W + 4; xx < W; xx += 9) st += `M${f(xx)} ${-hh / 2 + 1}l-6 ${hh - 2}`;
  return h('g', { transform: `translate(${f(x)} ${f(y)}) rotate(${f(a)})` }, F(d, tint, { opacity: 0.72 }), h('path', { d: st, stroke: V('paper'), 'stroke-width': 2.6, opacity: 0.5 }), F(d, 'none', { stroke: INK, 'stroke-width': 0.6, opacity: 0.35 }));
}
// storybook onomatopoeia: a scalloped gouache bubble with painted lettering and a ring of brush flicks
function pop(ref, word, sub, rx, ry, seed, tint) {
  SEED = seed;
  let fl = '', fl2 = '', tw = '';
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * 360 + seed * 17, r0 = 1.16 + 0.05 * hash(seed, i), c = Math.cos(a * D2R), s = Math.sin(a * D2R);
    const d = dab(c * rx * r0, s * ry * r0, (i % 2 ? 16 : 24) * (0.8 + 0.3 * hash(seed, i + 9)), 3.2, a);
    if (i % 2) fl += d; else fl2 += d;
    if (i % 3 === 0) tw += `M0 0` && h('path', { d: twinkle(6, 1.6), transform: `translate(${f(Math.cos((a + 18) * D2R) * rx * 1.42)} ${f(Math.sin((a + 18) * D2R) * ry * 1.42)})`, fill: V('eggGold'), stroke: INK, 'stroke-width': 0.8 });
  }
  const bd = puffD(rx, ry, 9, seed);
  return h('g', { 'data-ref': 'egg-' + ref, visibility: 'hidden' },
    h('g', { 'data-ref': `egg-${ref}Rays` }, F(fl, tint), F(fl2, V('eggGold')), tw),
    F(bd, V('mauve'), { opacity: 0.35, transform: 'translate(4 6)' }),
    F(bd, V('paper')), F(bd, 'url(#egg-gouache)'),
    F(ell(0, ry * 0.42, rx * 0.72, ry * 0.36), tint, { opacity: 0.16 }),
    h('path', { d: bd, fill: 'none', stroke: INK, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }), Pc(bd, 2.2),
    letter(word, sub ? 30 : 34, 0, sub ? 4 : 12, tint, { seed }),
    sub ? letter(sub, 19, 0, 29, V('eggGold'), { seed: seed + 1 }) : '');
}

// ---- art: the ginger cat (sitting, facing +x, origin = between the hind feet on the seat) ----
function catSit(pfx) {
  SEED = 11;
  const G = V('eggGinger'), Gl = V('eggGingerLo'), Cr = V('eggCream');
  const stripes = [[-16, -36, 9, 28], [-22, -26, 9, 14], [-24, -15, 9, 2], [-3, -46, 7, 80], [6, -48, 7, 84]].map(([x, y, l, a]) => dab(x, y, l, 2.2, a)).join('');
  return h('g', {},
    h('g', { 'data-ref': pfx + 'Tail' }, O('M-18 -4C-40 -2 -48 -16 -44 -30C-42 -38 -34 -40 -32 -34C-36 -24 -30 -14 -16 -14Z', G, 1.8),
      F(dab(-43, -22, 8, 2.4, -20) + dab(-39, -32, 7, 2.2, 10), Gl), F(dab(-42, -34, 6, 2, -60), Cr)),
    O('M-22 0C-30 -14 -26 -38 -8 -46C4 -52 16 -48 20 -38C24 -26 22 -10 18 0Z', G, 1.9),
    TX('M-22 0C-30 -14 -26 -38 -8 -46C4 -52 16 -48 20 -38C24 -26 22 -10 18 0Z'),
    Gz('M-20 -4C-24 -16 -20 -28 -12 -34C-14 -22 -12 -10 -6 0Z', Gl, 0.35),
    Ln('M-18 -6C-20 -20 -12 -30 -2 -30C6 -28 8 -16 4 -4', 1.4),
    F(stripes, Gl),
    O('M12 -40C22 -34 22 -12 18 0H6C8 -14 6 -28 12 -40Z', Cr, 1.3),
    O('M4 0C4 -4 8 -5 12 -4C13 -2 13 0 12 0ZM13 0C13 -4 17 -5 21 -4C22 -2 22 0 21 0Z', Cr, 1.2),
    Ln('M8 -1V-3M17 -1V-3', 0.8),
    h('g', { 'data-ref': pfx + 'Head', transform: 'translate(14 -50)' },
      O('M-15 -6L-13 -24L-4 -14ZM6 -15L15 -24L16 -6Z', G, 1.7),
      F('M-11 -12L-11 -20L-6 -14ZM9 -14L13 -20L13 -12Z', V('eggPink')),
      O('M-17 -2C-18 -14 -8 -18 0 -18C8 -18 18 -14 17 -2C16 8 8 12 0 12C-8 12 -16 8 -17 -2Z', G, 1.8),
      TX('M-17 -2C-18 -14 -8 -18 0 -18C8 -18 18 -14 17 -2C16 8 8 12 0 12C-8 12 -16 8 -17 -2Z'),
      F(dab(-5, -17, 7, 1.6, 75) + dab(1, -18, 7, 1.6, 90) + dab(6, -17, 7, 1.6, 105), Gl),
      F('M-7 4C-7 -1 -2 -2 0 1C2 -2 7 -1 7 4C7 10 -7 10 -7 4Z', Cr),
      F(blob(-11, 3, 3.4, 2.4) + blob(11, 3, 3.4, 2.4), V('eggRose'), { opacity: 0.6 }),
      O('M-2.2 1.8L2.2 1.8L0 4.4Z', V('eggRose'), 0.8),
      Ln('M0 4.4V6M0 6Q-2 8 -4 6.6M0 6Q2 8 4 6.6', 0.9),
      h('g', { 'data-ref': pfx + 'Eyes' }, F(ell(-8, -5.5, 2.8, 3.4) + ell(8, -5.5, 2.8, 3.4), INK), F(circ(-7.2, -6.6, 1) + circ(8.8, -6.6, 1), V('paper'))),
      Ln('M-8 5H-22M-8 7L-21 10M8 5H22M8 7L21 10', 0.7, { opacity: 0.8 })));
}
// leaping cat (stretched, facing +x, origin = body centre)
function catLeap() {
  SEED = 13;
  const G = V('eggGinger'), Gl = V('eggGingerLo'), Cr = V('eggCream');
  const body = 'M-32 -6C-30 -18 -10 -22 8 -20C22 -18 30 -12 32 -4C30 6 16 10 0 10C-16 10 -30 6 -32 -6Z';
  return h('g', {},
    O('M-30 -2C-48 -4 -60 -14 -66 -26C-62 -28 -56 -22 -50 -16C-44 -10 -36 -8 -28 -8Z', G, 1.7),
    F(dab(-58, -20, 7, 2, 40), Gl),
    O('M-26 2L-44 14L-40 18L-20 8ZM-18 4L-30 20L-24 22L-10 8Z', G, 1.6),
    O(body, G, 1.9), TX(body),
    F(dab(-20, -18, 9, 2.2, 90) + dab(-10, -20, 9, 2.2, 88) + dab(0, -21, 8, 2.2, 90) + dab(10, -20, 7, 2, 92), Gl),
    O('M10 6L34 16L36 11L22 0ZM20 4L42 6L42 1L26 -4Z', G, 1.6),
    O('M8 8C18 10 26 6 28 0L18 -2C12 2 8 4 8 8Z', Cr, 1.1),
    h('g', { transform: 'translate(40 -12) rotate(8)' },
      O('M-12 -6L-12 -22L-3 -13ZM4 -14L13 -21L14 -5Z', G, 1.6),
      F('M-9 -11L-9 -18L-5 -13Z', V('eggPink')),
      O('M-14 -2C-15 -12 -7 -16 0 -16C8 -16 16 -12 15 -2C14 7 7 10 0 10C-7 10 -13 7 -14 -2Z', G, 1.7),
      F(blob(7, 2, 3.4, 2.2), V('eggRose'), { opacity: 0.6 }),
      Ln('M-6 -9Q-4 -6 -3 -3M4 -9Q4 -6 3 -3', 2.2),
      Ln('M2 3C6 6 12 4 14 1', 1.3),
      Ln('M6 2H22M6 4L20 8', 0.7)));
}
// a storybook fish (facing +x, origin = centre): blue back, cream belly, big kind eye
function fish(len = 34, pfx) {
  SEED = 17;
  const L = len / 2, B = V('eggFish'), Bl = V('eggFishLo');
  const body = `M${f(-L)} 0C${f(-L * 0.4)} -12 ${f(L * 0.5)} -11 ${f(L)} 0C${f(L * 0.5)} 10 ${f(-L * 0.4)} 10 ${f(-L)} 0Z`;
  return h('g', pfx ? { 'data-ref': pfx } : {},
    O(`M${f(-L)} 0L${f(-L - 10)} -8Q${f(-L - 6)} 0 ${f(-L - 10)} 8Z`, Bl, 1.2),
    O(`M${f(-L * 0.2)} -8L${f(L * 0.1)} -14L${f(L * 0.3)} -8Z`, Bl, 1),
    O(body, B, 1.4),
    Gz(`M${f(-L * 0.8)} -2C${f(-L * 0.3)} -9 ${f(L * 0.4)} -9 ${f(L * 0.8)} -2C${f(L * 0.3)} -5 ${f(-L * 0.3)} -5 ${f(-L * 0.8)} -2Z`, Bl, 0.6),
    F(`M${f(-L * 0.8)} 2C${f(-L * 0.2)} 7 ${f(L * 0.4)} 7 ${f(L * 0.85)} 1C${f(L * 0.4)} 4 ${f(-L * 0.2)} 4 ${f(-L * 0.8)} 2Z`, V('eggCream')),
    F(dab(-L * 0.4, -3, 5, 1, 0) + dab(-L * 0.1, -4, 5, 1, 0) + dab(-L * 0.25, 0, 5, 1, 0), V('paper'), { opacity: 0.55 }),
    Ln(`M${f(L * 0.4)} -6C${f(L * 0.26)} -2 ${f(L * 0.26)} 2 ${f(L * 0.4)} 5`, 1),
    F(circ(L * 0.62, -2, 3), V('paper'), { stroke: INK, 'stroke-width': 0.8 }), F(circ(L * 0.66, -1.8, 1.6), INK), F(circ(L * 0.7, -2.6, 0.6), V('paper')));
}
// a gull in glide (facing +x, origin = body); the wings are separate flapping groups
function gull(pfx) {
  SEED = 19;
  const P = V('paper'), G = V('eggGull');
  return h('g', {},
    h('g', { 'data-ref': pfx + 'WingF' }, O('M-6 -4C-12 -14 -18 -24 -24 -30L-40 -36C-32 -24 -26 -14 -20 -8Z', V('eggGull', { far: true }), 1.1)),
    O('M-26 2L-38 -4L-36 6Z', P, 1.1),
    O('M-28 2C-18 -6 4 -8 14 -4C20 -2 22 4 16 7C4 10 -16 9 -28 2Z', P, 1.4),
    Gz('M-24 4C-12 8 4 9 14 6C4 10 -14 9 -24 4Z', V('plumeShade'), 0.9),
    O('M12 -8C18 -12 26 -10 26 -4C26 0 20 2 14 1Z', P, 1.3),
    h('g', { 'data-ref': pfx + 'Beak' }, O('M25 -5L35 -3L25 -1Z', V('eggGold'), 0.9), F('M31 -3.5L33 -3.2L31.5 -2Z', V('eggRed'))),
    h('g', { 'data-ref': pfx + 'Jaw', visibility: 'hidden' }, O('M25 -1L33 5L24 1Z', V('eggGold'), 0.9)),
    F(circ(20, -6, 1.6), INK), F(circ(20.5, -6.6, 0.55), P), F(blob(19, -2, 2.4, 1.6), V('eggRose'), { opacity: 0.55 }),
    h('g', { 'data-ref': pfx + 'Wing' },
      O('M-8 -2C-14 -16 -22 -30 -38 -44C-26 -44 -8 -30 6 -6Z', G, 1.4),
      Gz('M-6 -4C-10 -14 -16 -24 -26 -34C-16 -30 -6 -20 2 -6Z', P, 0.35),
      F('M-26 -34L-38 -44C-32 -44 -26 -41 -20 -36Z', V('eggGullTip')),
      F(circ(-33, -41, 1.4), P)));
}
// great white pelican in flight (facing +x, neck folded; origin = body)
function pelFly(pfx) {
  SEED = 23;
  const P = V('plume'), S = V('plumeShade'), N = V('flight');
  let fingers = ''; for (let i = 0; i < 4; i++) fingers += dab(-30 + i * 3, -48 + i * 3, 20 - i * 2, 2.6, -150 + i * 12);
  return h('g', {},
    h('g', { 'data-ref': pfx + 'WingF' }, F('M-2 -4C-12 -24 -28 -40 -52 -48C-44 -30 -26 -12 -12 -2Z', V('flight', { far: true }))),
    O('M-36 0C-26 -12 4 -14 20 -9C30 -6 32 4 24 8C8 13 -22 11 -36 0Z', P, 1.5),
    Gz('M-30 3C-16 9 10 10 22 6C12 12 -14 12 -30 3Z', S, 0.95),
    O('M-36 0L-46 -5L-45 4Z', P, 1.1),
    O('M20 -4C24 -14 32 -18 40 -14C46 -10 42 -3 34 0Z', P, 1.3),
    O('M40 -13L78 -3L41 -5Z', V('bill'), 1),
    O('M41 -5L74 -2C62 7 48 7 39 1Z', V('pouch'), 1),
    F(circ(77, -3, 1.6), V('billNail')), F(circ(37, -11, 1.4), INK), F(blob(36, -8, 2.2, 1.5), V('eggRose'), { opacity: 0.6 }),
    F('M-14 8L-24 14L-17 15L-9 10Z', V('foot')),
    h('g', { 'data-ref': pfx + 'Wing' },
      O('M-4 -6C-10 -26 -22 -44 -46 -58C-26 -58 0 -34 12 -8Z', P, 1.4),
      Gz('M-2 -8C-8 -22 -16 -34 -30 -46C-16 -40 -4 -26 6 -10Z', S, 0.6),
      F(fingers, N), Ln('M-8 -16C-14 -26 -22 -34 -30 -42', 0.9, { opacity: 0.6 })));
}
// a striped nightcap with a pompom (head-local: head centre (0,0), bill toward +x, drooping back)
function nightcap(s = 1) {
  SEED = 29;
  const R = V('eggRed'), Cr = V('eggCream');
  const cone = 'M-20 -14C-8 -30 12 -32 20 -20C8 -38 -20 -46 -46 -34C-56 -29 -62 -19 -63 -6C-52 -20 -36 -21 -20 -14Z';
  let st = ''; for (let i = 0; i < 4; i++) st += dab(-6 - i * 13, -30 + i * 3 - (i > 2 ? 2 : 0), 12, 2.6, 120 + i * 12);
  return h('g', { transform: s !== 1 ? `scale(${s})` : undefined },
    O(cone, R, 1.8), TX(cone), F(st, Cr, { opacity: 0.9 }),
    Gz('M-24 -18C-36 -24 -50 -24 -60 -10C-50 -30 -34 -34 -20 -26Z', V('eggRedLo'), 0.5),
    O('M-25 -12C-14 -27 8 -30 22 -21L23 -14C8 -23 -12 -20 -22 -6Z', Cr, 1.6),
    F(dab(-18, -14, 10, 1.6, -40) + dab(-4, -22, 10, 1.6, -15) + dab(10, -22, 9, 1.6, 10), V('eggHullLo'), { opacity: 0.8 }),
    O(blob(-63, -4, 8.5, 8, 0.16, 3), Cr, 1.5),
    F(dab(-68, -8, 7, 1.6, 30) + dab(-60, -10, 6, 1.4, -40) + dab(-66, 0, 6, 1.4, 80), V('eggHullLo'), { opacity: 0.8 }));
}

export function build(ctx) {
  const v = ctx.v; V = v;
  const P = v('paper'), R = v('eggRed'), Gd = v('eggGold'), Tl = v('eggTeal'), Nv = v('eggNavy');
  const L = { sun: '', stars: '', clouds: '', sea: '', roadside: '', road: '', front: '', page: '' };
  let defs = '';
  WA = 0.9;

  // ---- static textures (patterns in local coordinates: they move with the object; rasterised as fills, no filter)
  {
    let g = '';
    for (let i = 0; i < 16; i++) {
      const r = 3 + 6 * hash(i, 71), x = r + (48 - 2 * r) * hash(i, 72), y = r + (48 - 2 * r) * hash(i, 73);
      g += h('path', { d: blob(x, y, r, r * (0.6 + 0.4 * hash(i, 74)), 0.2, i), fill: i % 2 ? v('paper') : v('mauve'), opacity: i % 2 ? 0.24 : 0.1 });
    }
    for (let i = 0; i < 5; i++) g += h('path', { d: dab(4 + 40 * hash(i, 75), 6 + 36 * hash(i, 76), 10, 0.9, -20 + 40 * hash(i, 77)), fill: v('mauve'), opacity: 0.14 });
    defs += h('pattern', { id: 'egg-gouache', patternUnits: 'userSpaceOnUse', width: 48, height: 48 }, g);
    let fb = '';
    for (let i = 0; i < 12; i++) fb += `M${f(3 + 34 * hash(i, 81))} ${f(3 + 34 * hash(i, 82))}l${f(2 + 4 * hash(i, 83))} ${f(-1.5 + 3 * hash(i, 84))}`;
    defs += h('pattern', { id: 'egg-fibre', patternUnits: 'userSpaceOnUse', width: 40, height: 40 }, h('path', { d: fb, stroke: v('lineSoft'), 'stroke-width': 0.6, opacity: 0.3, 'stroke-linecap': 'round' }));
    defs += h('radialGradient', { id: 'egg-glow' }, h('stop', { offset: 0, style: 'stop-color:var(--pb-lamp);stop-opacity:.8' }), h('stop', { offset: 0.5, style: 'stop-color:var(--pb-lampGlow);stop-opacity:.25' }), h('stop', { offset: 1, style: 'stop-color:var(--pb-lampGlow);stop-opacity:0' }));
    defs += h('linearGradient', { id: 'egg-beam', x1: 0, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: 0, style: 'stop-color:var(--pb-lamp);stop-opacity:.7' }), h('stop', { offset: 1, style: 'stop-color:var(--pb-lampGlow);stop-opacity:0' }));
  }

  // ---- brown pelican paint override (Konami). Pure CSS: the rider's paint custom properties re-pointed per slot.
  const slotSel = names => names.map(n => `#scene.egg-brown #j-${n}`).join(',');
  const m = n => `var(--pb-${n})`;
  const set = pairs => pairs.map(([k, val]) => `--pb-${k}:${m(val)};--pb-${k}-far:${m(val + '-far')}`).join(';');
  const plumage = [['plume', 'eggBrBody'], ['plumeShade', 'eggBrShade'], ['plumeDeep', 'eggBrDeep'], ['flight', 'eggBrDeep'], ['flightSheen', 'eggBrShade'],
    ['plPaper', 'eggBrBody'], ['plGlow', 'eggBrBody'], ['plRose', 'eggBrShade'], ['plRoseDeep', 'eggBrDeep'], ['plBloom', 'eggBrShade'], ['plDeep', 'eggBrDeep'], ['plSheen', 'eggBrShade'],
    ['plFPaper', 'eggBrShade'], ['plFGlow', 'eggBrShade'], ['plFRose', 'eggBrDeep'], ['plFRoseDeep', 'eggBrDeep'], ['plFBloom', 'eggBrDeep']];
  const feet = ['Foot', 'FootHi', 'FootLo', 'FootDeep', 'Web', 'Pad'].flatMap(k => [['pl' + k, 'eggBrFoot'], ['plF' + k, 'eggBrFoot']]).concat([['foot', 'eggBrFoot'], ['web', 'eggBrFoot']]);
  defs += `<style>${slotSel(['body', 'tail', 'wingNearUpper', 'wingNearLower', 'wingNearHand', 'wingFarUpper', 'wingFarLower', 'wingFarHand', 'thighNear', 'thighFar'])}{${set(plumage)}}`
    + `${slotSel(['neck'])}{${set([['plume', 'eggBrNeck'], ['plumeShade', 'eggBrDeep'], ['plumeDeep', 'eggBrDeep']])}}`
    + `${slotSel(['crest'])}{${set([['plume', 'eggBrCrown'], ['plumeShade', 'eggGoldLo'], ['plumeDeep', 'eggBrShade']])}}`
    + `${slotSel(['head'])}{${set([['plume', 'eggBrWhite'], ['plumeShade', 'eggBrCrown'], ['skin', 'eggBrWhite'], ['pbBlush', 'eggBrCrown']])}}`
    + `${slotSel(['pouch', 'billLower'])}{${set([['pouch', 'eggBrPouch'], ['pouchDeep', 'eggBrPouchRed'], ['pbPouchHi', 'eggBrShade']])}}`
    + `${slotSel(['billUpper', 'billLower'])}{${set([['bill', 'eggBrBill'], ['billEdge', 'eggBrShade'], ['billNail', 'eggBrPouchRed']])}}`
    + `${slotSel(['eye'])}{${set([['iris', 'eggBrWhite'], ['skin', 'eggBrWhite']])}}`
    + `${slotSel(['footNear', 'footFar', 'shankNear', 'shankFar'])}{${set(feet)}}`
    + `</style>`;
  defs += h('symbol', { id: 'egg-catsit', overflow: 'visible' }, catSit('egg-cs'));

  // ---- caption slips (screen-ish, upper left): brown / velo
  const card = (ref, l1, l2, l3, doodle, seed) => {
    const w = 470, hh = 118; SEED = seed;
    return h('g', { 'data-ref': 'egg-' + ref, visibility: 'hidden' },
      slip(w, hh, seed), tape(-w / 2 + 40, -hh / 2 + 2, 70, -24, v('eggTealHi')), tape(w / 2 - 40, -hh / 2 + 2, 70, 22, v('eggPetal')),
      ink(l1, 15, 0, -hh / 2 + 32, v('lineSoft'), { track: 30 }),
      Ln(`M${-w / 2 + 60} ${-hh / 2 + 40}C-80 ${-hh / 2 + 34} 80 ${-hh / 2 + 46} ${w / 2 - 60} ${-hh / 2 + 38}`, 1.1, { opacity: 0.7 }),
      letter(l2, 30, 0, 14, R, { seed }),
      ink(l3, 13.5, 0, 42, INK, { track: 10 }),
      doodle,
      h('path', { d: twinkle(8, 2), fill: Gd, stroke: INK, 'stroke-width': 0.8, transform: `translate(${-w / 2 + 24} 10)` }),
      h('path', { d: twinkle(6, 1.6), fill: Gd, stroke: INK, 'stroke-width': 0.8, transform: `translate(${w / 2 - 22} 24)` }));
  };
  SEED = 41;
  const brownDoodle = h('g', { transform: 'translate(196 6) scale(0.62)' },
    O(blob(0, 0, 16, 14), v('eggBrWhite'), 1.6), O('M-4 -12C0 -22 10 -22 12 -12Z', v('eggBrCrown'), 1.2), O('M12 -2L58 8L12 4Z', v('eggBrBill'), 1.3),
    O('M12 4L54 9C44 22 22 20 10 10Z', v('eggBrPouch'), 1.3), F(circ(5, -3, 2.2), INK), O('M-10 12C-18 26 -14 40 -4 46L10 44C2 34 4 22 8 12Z', v('eggBrNeck'), 1.4));
  const veloDoodle = h('g', { transform: 'translate(-200 8) scale(0.5)' },
    Ln(circ(-26, 10, 20) + circ(30, 10, 20), 2.4), Ln('M-26 10L-4 -18L22 -18L30 10M-4 -18L2 12L-26 10M22 -18L18 -30M-10 -24H4', 2.2),
    Ln('M2 12L30 10', 2.2, { stroke: R, 'stroke-dasharray': '3 3' }), F(circ(2, 12, 5), Gd, { stroke: INK, 'stroke-width': 1.2 }));
  L.front += card('capBrown', "Simon Willison's benchmark", '褐鹈鹕 · 繁殖羽', 'California brown pelican, in breeding plumage', brownDoodle, 41);
  L.front += card('capVelo', 'Velocipedia', '链条接错啦！', 'after Gianluca Gimini · bikes drawn from memory', veloDoodle, 43);

  // ---- sun + moon faces (L-sunmoon, depth 0; placed on the discs every frame while shown)
  const face = (ref, s, extra = '') => {
    SEED = ref.length * 3; WA = 0.5;
    const out = h('g', { 'data-ref': 'egg-' + ref, visibility: 'hidden' }, h('g', { transform: `scale(${s})` },
      F(blob(-44, 14, 14, 9) + blob(44, 14, 14, 9), v('eggRose'), { opacity: 0.62 }),
      F(dab(-50, 12, 8, 1.4, 0) + dab(38, 12, 8, 1.4, 0), P, { opacity: 0.7 }),
      F(ell(-26, -12, 6.5, 9), INK), F(circ(-24, -16, 2.4), P),
      h('g', { 'data-ref': `egg-${ref}Open` }, F(ell(26, -12, 6.5, 9), INK), F(circ(28, -16, 2.4), P)),
      Ln('M14 -10Q26 -22 38 -10', 4.6, { 'data-ref': `egg-${ref}Shut`, visibility: 'hidden' }),
      Ln('M-37 -31Q-26 -39 -15 -33M15 -34Q26 -40 37 -31', 3.2),
      F('M-22 16Q0 38 22 16Q0 26 -22 16Z', R, { opacity: 0.85 }),
      Ln('M-26 14Q0 40 26 14', 4.2), Ln('M-26 14Q-30 10 -33 11M26 14Q30 10 33 11', 2.6),
      extra,
      h('g', { 'data-ref': `egg-${ref}Spark`, transform: 'translate(64 -40)' }, h('path', { d: twinkle(17, 3.6), fill: P, stroke: INK, 'stroke-width': 1.3 }), h('path', { d: twinkle(6, 1.4), fill: Gd, transform: 'translate(20 16)' }))));
    WA = 0.9; return out;
  };
  L.sun += face('sunFace', 1) + face('moonFace', 0.54, h('g', { 'data-ref': 'egg-moonCap', visibility: 'hidden', transform: 'translate(8 -64) rotate(-12) scale(1.9)' }, nightcap()));

  // ---- wish (L-stars, depth 0)
  {
    SEED = 51;
    let rays = ''; for (let i = 0; i < 12; i++) { const a = (i / 12) * 360; rays += dab(Math.cos(a * D2R) * 14, Math.sin(a * D2R) * 14, i % 2 ? 22 : 40, 2.2, a); }
    L.stars += h('g', { 'data-ref': 'egg-wish', visibility: 'hidden' },
      h('circle', { r: 70, fill: 'url(#egg-glow)' }),
      h('g', { 'data-ref': 'egg-wishRays' }, F(rays, Gd, { opacity: 0.85 })),
      O(star5(22, 0.5), Gd, 1.8), F(dab(-6, -8, 9, 2.2, -30), P, { opacity: 0.8 }),
      F(ell(-6, 2, 2, 2.6) + ell(6, 2, 2, 2.6), INK), Ln('M-4 8Q0 11 4 8', 1.2),
      h('g', { 'data-ref': 'egg-wishFall' }, [0, 1, 2, 3, 4].map(i => h('path', { d: twinkle(7 - i, 1.6), fill: i % 2 ? Gd : P, stroke: INK, 'stroke-width': 0.6, transform: `translate(${-i * 16 - 22} ${i * 20 + 22})` }))),
      letter('许个愿 · Make a wish!', 21, 0, 84, v('eggCream'), { seed: 51 }));
  }

  // ---- pelican squadron (L-clouds)
  let sq = '';
  for (let i = 0; i < 7; i++) sq += h('g', { 'data-ref': 'egg-pf' + i }, pelFly('egg-pf' + i));
  L.clouds += h('g', { 'data-ref': 'egg-flight', visibility: 'hidden' }, sq);

  // ---- message in a bottle (L-sea, depth .1)
  SEED = 61;
  const glass = 'M-24 -6C-24 -12 -18 -14 -8 -14H8C12 -14 14 -10 20 -9H28V-3H20C14 -2 12 2 8 2H-8C-18 2 -24 0 -24 -6Z';
  L.sea += h('g', { 'data-ref': 'egg-bottle', visibility: 'hidden', ...DD('sea:O:message-bottle') },
    h('path', { 'data-ref': 'egg-bottleRip', d: wobD('M-42 8Q-30 3 -20 8M18 8Q28 3 40 8M-28 13Q0 9 26 13'), fill: 'none', stroke: v('foam'), 'stroke-width': 2, 'stroke-linecap': 'round' }),
    h('g', { 'data-ref': 'egg-bottleB' },
      F(glass, v('eggGlass'), { opacity: 0.9 }),
      O('M-16 -9C-16 -11 -12 -11 6 -10C8 -9 8 -4 6 -3C-12 -3 -16 -4 -16 -6Z', v('eggCream'), 0.8),
      F('M-6 -10.5V-2.5', 'none', { stroke: R, 'stroke-width': 1.6 }),
      F(glass, 'none', { stroke: INK, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }),
      F(dab(-20, -10, 16, 1.6, -4) + dab(14, -10, 5, 1, 20), v('eggGlassHi'), { opacity: 0.9 }),
      O('M28 -4.5H34V-7.5H28Z', v('eggCork'), 1),
      // visible clue: a four-point glint winks on the glass every ~22 s
      h('path', { 'data-ref': 'egg-bottleGlint', visibility: 'hidden', d: twinkle(16, 2.6), transform: 'translate(-12 -11)', fill: P, stroke: INK, 'stroke-width': 0.7 })));
  {
    const nw = 420, nh = 190; SEED = 63;
    let rule = ''; for (let y = -38; y <= 66; y += 26) rule += `M${-nw / 2 + 26} ${y + 6}H${nw / 2 - 26}`;
    L.sea += h('g', { 'data-ref': 'egg-note', visibility: 'hidden' },
      h('g', { 'data-ref': 'egg-noteIn' },
        slip(nw, nh, 63, v('eggCream')),
        h('path', { d: wobD(rule, 0.8, 4), fill: 'none', stroke: v('eggFishLo'), 'stroke-width': 0.8, opacity: 0.35 }),
        h('path', { d: `M${-nw / 2 + 40} ${-nh / 2 + 12}V${nh / 2 - 12}`, stroke: v('eggRose'), 'stroke-width': 1, opacity: 0.6 }),
        tape(-nw / 2 + 36, -nh / 2 + 4, 64, -30, v('eggPetal')), tape(nw / 2 - 36, -nh / 2 + 4, 64, 28, v('eggTealHi')),
        ink('你好，海边的朋友！', 25, 8, -38, INK),
        ink('来鹈鹕湾，一起骑车吧！', 25, 8, -8, R),
        ink('Hello, friend by the sea!', 19, 8, 22, INK),
        ink('Come ride with us at Pelican Bay.', 15.5, 8, 46, v('lineSoft')),
        ink('— P.', 20, nw / 2 - 34, 76, R, { align: 'end' }),
        // a little painted pelican doodle and a fish "stamp"
        h('g', { transform: `translate(${-nw / 2 + 60} ${nh / 2 - 34}) scale(0.55)` }, O(blob(0, 0, 14, 13), P, 1.6), O('M10 -2L50 6L10 4Z', v('bill'), 1.2), O('M10 4L46 7C36 18 18 16 8 9Z', v('pouch'), 1.2), F(circ(4, -3, 2), INK), F(blob(2, 3, 3, 2), v('eggRose'), { opacity: 0.7 }), O('M-12 -8L-18 -18L-8 -12Z', P, 1)),
        h('g', { transform: `translate(${nw / 2 - 44} ${-nh / 2 + 36}) rotate(8)` }, O(rrect(-18, -14, 36, 28, 2), v('eggSky'), 1.1), F(rrect(-18, -14, 36, 28, 2), 'none', { stroke: v('paper'), 'stroke-width': 2, 'stroke-dasharray': '2 2', transform: 'scale(1.12)' }), h('g', { transform: 'scale(0.5)' }, fish(34))),
        Ln('M-150 72C-140 62 -130 82 -120 72S-100 62 -90 72', 1.3, { stroke: Tl })));
  }

  // ---- bench + cat (L-roadside, depth .9)
  {
    SEED = 71;
    const W = v('eggWood'), Wl = v('eggWoodLo');
    const plank = (y, hh) => O(rrect(-64, y, 128, hh, 2), W, 1.3) + F(dab(-52, y + hh / 2, 30, 0.8, 0) + dab(-4, y + hh / 2 - 1, 24, 0.7, 2) + dab(30, y + hh / 2 + 1, 22, 0.7, -2), Wl, { opacity: 0.6 });
    const bench = h('g', {},
      Ln('M-56 0C-58 -8 -52 -14 -54 -22M56 0C58 -8 52 -14 54 -22', 3.2, { stroke: v('eggIron') }),
      Ln('M-54 -12C-62 -12 -64 -4 -58 -4M54 -12C62 -12 64 -4 58 -4', 1.8, { stroke: v('eggIron') }),
      Ln('M-60 -34V-60M60 -34V-60', 3.2, { stroke: v('eggIron') }),
      plank(-26, 8), plank(-44, 7), plank(-58, 7),
      O(rrect(-10, -56, 20, 5, 1), Gd, 0.8),
      Ln('M-40 -22V-26M0 -22V-26M40 -22V-26', 0.8, { opacity: 0.5 }),
      // a folded newspaper at the far end
      h('g', { transform: 'translate(36 -30) rotate(-6)' }, O('M-14 0L-12 -6H14L12 0Z', v('eggCream'), 0.9), Ln('M-8 -3H8', 0.6, { opacity: 0.6 })));
    L.roadside += h('g', { 'data-ref': 'egg-bench', visibility: 'hidden', ...DD('land:O:cat-bench') }, F('M-70 2C-40 -2 40 -2 70 2C40 6 -40 6 -70 2Z', v('mauve'), { opacity: 0.35 }), bench,
      h('g', { 'data-ref': 'egg-benchCat', transform: 'translate(-18 -30)' }, h('use', { href: '#egg-catsit' })));
    L.front += h('g', { 'data-ref': 'egg-catJump', visibility: 'hidden' },
      h('g', { 'data-ref': 'egg-catLeap' }, catLeap()),
      h('g', { 'data-ref': 'egg-catPerch', visibility: 'hidden' }, h('use', { href: '#egg-catsit', transform: 'translate(0 30)' })),
      h('g', { 'data-ref': 'egg-catFish', visibility: 'hidden' }, fish(30)));
    L.front += pop('popMeow', 'MEOW!', '喵！', 70, 44, 7, v('eggGinger'));
  }

  // ---- puddles (L-road, depth 1) + splash crowns and drops (L-fx-front)
  {
    SEED = 81;
    const pd = 'M-150 2C-140 -12 -60 -16 0 -14C70 -16 150 -10 156 2C150 16 60 18 0 16C-70 18 -150 14 -150 2Z';
    L.road += h('g', { 'data-ref': 'egg-puddle', visibility: 'hidden', ...DD('land:O:road-puddle') },
      O(pd, v('eggWater'), 1.2, { stroke: INK2 }),
      Gz('M-140 6C-80 14 60 16 150 6C100 16 -80 18 -140 6Z', v('eggWaterLo'), 0.55),
      F(dab(-110, -3, 60, 1.6, 0) + dab(-20, -7, 70, 1.6, 0) + dab(80, -1, 46, 1.4, 0) + dab(-70, 6, 70, 1.3, 0), P, { opacity: 0.85 }),
      F(dab(40, 5, 60, 1.2, 0) + dab(-130, -8, 30, 1, 0), v('eggSky'), { opacity: 0.8 }),
      h('g', { transform: 'translate(96 -4) rotate(-20)' }, O('M-8 0Q0 -6 8 0Q0 6 -8 0Z', v('eggGinger'), 0.8), Ln('M-8 0H9', 0.6)));
    const crown = O('M-40 0C-36 -16 -30 -26 -34 -40C-24 -28 -20 -22 -16 -34C-12 -22 -6 -18 0 -46C6 -18 12 -22 16 -34C20 -22 24 -28 34 -40C30 -26 36 -16 40 0Z', v('eggWater'), 1.5)
      + F(dab(-26, -4, 20, 2, -76) + dab(8, -6, 24, 2, -80), P, { opacity: 0.85 }) + F(circ(-34, -44, 3) + circ(0, -51, 3.6) + circ(34, -44, 3), v('eggWater'), { stroke: INK, 'stroke-width': 1 });
    let drops = '';
    for (let i = 0; i < 10; i++) drops += h('path', { 'data-ref': 'egg-dr' + i, d: 'M0 -7C3 -3 4 0 4 2A4 4 0 0 1 -4 2C-4 0 -3 -3 0 -7Z', fill: i % 3 ? v('eggWater') : P, stroke: INK, 'stroke-width': 1 });
    L.front += h('g', { 'data-ref': 'egg-splash', visibility: 'hidden' }, h('g', { 'data-ref': 'egg-crownR' }, crown), h('g', { 'data-ref': 'egg-crownF' }, crown), drops);
    L.front += pop('popSplash', 'SPLASH!', '哗啦！', 96, 48, 11, v('eggNavy'));
  }

  // ---- milestone plates + petal confetti (L-fx-front)
  const plate = (ref, big, l2, l3, scene, seed) => {
    const w = 310, hh = 250; SEED = seed;
    const win = 'M-128 24V-58Q-128 -104 -82 -104H82Q128 -104 128 -58V24Z';
    const clip = 'egg-clip-' + ref;
    defs += h('clipPath', { id: clip }, h('path', { d: win }));
    return h('g', { 'data-ref': 'egg-' + ref, visibility: 'hidden' }, h('g', { 'data-ref': `egg-${ref}In` },
      slip(w, hh, seed), tape(0, -hh / 2 + 2, 90, -3, v('eggPetal')),
      h('g', { 'clip-path': `url(#${clip})` }, scene),
      h('path', { d: wobD(win, 1), fill: 'none', stroke: INK, 'stroke-width': 1.8 }), Pc(win, 1.8),
      h('g', { 'data-ref': `egg-${ref}Big` }, letter(big, 48, 0, 76, R, { seed })),
      ink(l2, 15, 0, 100, INK, { track: 10 }),
      ink(l3, 11.5, 0, 116, v('lineSoft'), { track: 10 })));
  };
  {
    SEED = 91;
    let bunt = ''; for (let i = 0; i < 9; i++) { const x = -116 + i * 29, y = -86 + 7 * Math.sin((i / 8) * Math.PI); bunt += O(`M${f(x - 9)} ${f(y)}L${f(x + 9)} ${f(y + 1)}L${f(x)} ${f(y + 16)}Z`, [R, Gd, Tl][i % 3], 0.8); }
    const kmScene = F('M-140 -110H140V30H-140Z', v('eggSky')) + F('M-140 -110H140V-60H-140Z', v('eggSkyHi'), { opacity: 0.55 })
      + F(circ(70, -46, 20), Gd) + F(circ(70, -46, 30), Gd, { opacity: 0.3 })
      + O('M-140 -8C-90 -40 -40 -34 0 -16C40 -34 100 -44 140 -18V30H-140Z', v('eggLeaf'), 1.2) + TX('M-140 -8C-90 -40 -40 -34 0 -16C40 -34 100 -44 140 -18V30H-140Z')
      + O('M-140 8C-60 0 60 -2 140 6V30H-140Z', v('road'), 1.1) + F('M-120 14H-96M-70 12H-46M-20 11H4M30 11H54M80 12H104', 'none', { stroke: v('roadLine'), 'stroke-width': 2, 'stroke-linecap': 'round' })
      // a Chinese road kilometre stone (white, red cap) and a tiny inked bicycle
      + O('M-96 10V-24Q-96 -34 -84 -34Q-72 -34 -72 -24V10Z', P, 1.2) + O('M-96 -22Q-96 -34 -84 -34Q-72 -34 -72 -22Z', R, 1.1) + ink('1', 14, -84, 2, INK)
      + h('g', { transform: 'translate(20 -2)' }, Ln(circ(-12, 0, 9) + circ(14, 0, 9), 1.6), Ln('M-12 0L-2 -12L10 -12L14 0M-2 -12L0 0L-12 0M10 -12L8 -18', 1.4), O(blob(0, -24, 7, 8), P, 1.1), O('M5 -26L18 -24L5 -22Z', v('bill'), 0.8))
      + h('path', { d: 'M-128 -86C-60 -76 60 -76 128 -86', fill: 'none', stroke: INK, 'stroke-width': 1 }) + bunt;
    L.front += plate('posterKm', '1 km!', '第一公里 · The first kilometre', 'Pelican Bay cycling club', kmScene, 93);
    // 42: a night sky, a surprised whale and a bowl of petunias falling (Hitchhiker's), "Don't panic"
    let stars = ''; for (let i = 0; i < 12; i++) stars += h('path', { d: twinkle(3 + 2 * hash(i, 5), 0.8), fill: v('eggCream'), transform: `translate(${f(-120 + 240 * hash(i, 6))} ${f(-100 + 100 * hash(i, 7))})` });
    const scene42 = F('M-140 -110H140V30H-140Z', v('eggNight')) + F('M-140 -30H140V30H-140Z', v('eggWhale'), { opacity: 0.35 }) + stars
      + h('g', { transform: 'translate(-40 -44) rotate(-18)' },
        O('M-44 0C-40 -20 0 -26 30 -14C40 -10 44 -2 40 6C20 18 -30 18 -44 0Z', v('eggWhale'), 1.4), Gz('M-40 4C-20 14 20 14 38 6C20 16 -24 16 -40 4Z', v('eggCream'), 0.6),
        O('M-44 0L-62 -12L-58 2L-64 14Z', v('eggWhale'), 1.2), F(circ(24, -6, 4), P, { stroke: INK, 'stroke-width': 0.9 }), F(circ(25, -6, 1.8), INK),
        Ln('M30 6Q34 9 38 5', 1), F(blob(30, 1, 3.4, 2.2), v('eggRose'), { opacity: 0.6 }), Ln('M20 -24Q18 -32 24 -36M26 -24Q30 -32 26 -38', 1.1))
      + h('g', { transform: 'translate(70 -54) rotate(12)' },
        O('M-18 0H18L12 18H-12Z', v('eggPot'), 1.3), O(rrect(-20, -4, 40, 6, 2), v('eggPot'), 1.1),
        Ln('M-8 -4C-10 -12 -6 -18 -4 -22M4 -4C6 -14 2 -20 6 -26M0 -4V-18', 1.1, { stroke: v('eggLeaf') }),
        F(blob(-4, -24, 6, 5) + blob(7, -28, 6, 5) + blob(0, -18, 5, 4), v('eggPetal'), { stroke: INK, 'stroke-width': 0.8 }), F(circ(-4, -24, 1.5) + circ(7, -28, 1.5), Gd))
      + ink('Oh no, not again.', 10, 70, -96, v('eggCream')) + h('path', { d: 'M-128 -86C-60 -76 60 -76 128 -86', fill: 'none', stroke: 'none' });
    L.front += plate('poster42', '42!', "别慌 · Don't panic", 'So long, and thanks for all the fish · 4.2 km', scene42, 95);
    let conf = '';
    const CI = [R, Gd, Tl, v('eggPetal'), P, v('eggLeaf')];
    for (let i = 0; i < 28; i++) {
      const k = i % 3, c = CI[i % CI.length];
      const d = k === 0 ? 'M0 -7C5 -3 5 3 0 7C-5 3 -5 -3 0 -7Z' : k === 1 ? twinkle(7, 2) : 'M-6 -4C-2 -8 6 -6 6 0C6 6 -2 8 -6 4C-3 1 -3 -1 -6 -4Z';
      conf += h('path', { 'data-ref': 'egg-cf' + i, d, fill: c, stroke: INK, 'stroke-width': 0.8 });
    }
    L.front += h('g', { 'data-ref': 'egg-confetti', visibility: 'hidden' }, conf);
  }

  // ---- velocipedia chain (rider-attached, L-fx-front) + the UFO's fish + the bedtime nightcap / Zzz
  const ringC = BIKE.bb, hub = BIKE.frontHub, rr = 30, rh = 11;
  const dx = hub[0] - ringC[0], dy = hub[1] - ringC[1], dist = Math.hypot(dx, dy), a0 = Math.atan2(dy, dx), beta = Math.acos((rr - rh) / dist);
  const tp = (c, r, a) => [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r];
  const [p1, p2, p3, p4] = [tp(ringC, rr, a0 - beta), tp(hub, rh, a0 - beta), tp(hub, rh, a0 + beta), tp(ringC, rr, a0 + beta)];
  const chainD = `M${f(p1[0])} ${f(p1[1])}L${f(p2[0])} ${f(p2[1])}A${rh} ${rh} 0 0 1 ${f(p3[0])} ${f(p3[1])}L${f(p4[0])} ${f(p4[1])}A${rr} ${rr} 0 1 1 ${f(p1[0])} ${f(p1[1])}Z`;
  let cog = '';
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; cog += poly([tp(hub, 10, a - 0.16), tp(hub, 14, a - 0.1), tp(hub, 14, a + 0.1), tp(hub, 10, a + 0.16)]); }
  let links = '';
  for (let i = 0; i < 8; i++) links += h('path', { 'data-ref': 'egg-lk' + i, d: rrect(-5.5, -2.8, 11, 5.6, 2.6), fill: v('steel'), stroke: INK, 'stroke-width': 1.1 });
  SEED = 101;
  let zz = '';
  for (let i = 0; i < 3; i++) zz += h('g', { 'data-ref': 'egg-bedZ' + i }, letter('Z', 30 - i * 5, 0, 0, v('eggCream'), { seed: 101 + i }));
  L.front += h('g', { 'data-ref': 'egg-riderF' },
    h('g', { 'data-ref': 'egg-velo', visibility: 'hidden' },
      h('g', { 'data-ref': 'egg-veloChain' },
        h('path', { d: circ(hub[0], hub[1], 11) + cog, fill: Gd, stroke: INK, 'stroke-width': 1.1 }),
        h('path', { d: circ(hub[0], hub[1], 4), fill: INK }),
        h('path', { d: chainD, fill: 'none', stroke: INK, 'stroke-width': 5.6, 'stroke-linejoin': 'round' }),
        h('path', { d: chainD, fill: 'none', stroke: v('steel'), 'stroke-width': 2.4, 'stroke-dasharray': '3.4 2.2' }),
        F(dab(150, -120, 14, 2, -50) + dab(196, -120, 14, 2, 230) + dab(150, -80, 14, 2, 50) + dab(196, -80, 14, 2, 130), R)),
      h('g', { 'data-ref': 'egg-veloLinks' }, links),
      h('g', { 'data-ref': 'egg-veloQ', transform: 'translate(-30 -515)' }, letter('?!', 62, 0, 0, R, { seed: 7 }))),
    h('g', { 'data-ref': 'egg-ufoFish', visibility: 'hidden' }, fish(32)),
    h('g', { 'data-ref': 'egg-bed', visibility: 'hidden' },
      h('g', { 'data-ref': 'egg-bedCap' }, h('g', { 'data-ref': 'egg-bedCapIn' }, nightcap())),
      zz,
      h('g', { 'data-ref': 'egg-bedYawn' }, (() => { SEED = 103; const bd = puffD(70, 34, 8, 103); return F(bd, v('mauve'), { opacity: 0.35, transform: 'translate(3 5)' }) + F(bd, P) + F(bd, 'url(#egg-gouache)') + h('path', { d: bd, fill: 'none', stroke: INK, 'stroke-width': 1.8 }) + O('M-40 26L-58 46L-26 30Z', P, 1.6) + letter('哈欠…', 22, 0, 0, v('eggNavy'), { seed: 104 }) + ink('Yaaawn…', 14, 0, 20, INK); })())));
  L.front += pop('popSnap', 'SNAP!', '啪！', 74, 42, 21, R);

  // ---- UFO (L-fx-front, world)
  {
    SEED = 111;
    let motes = ''; for (let i = 0; i < 9; i++) { const y = 30 + 220 * hash(i, 3), x = (hash(i, 4) - 0.5) * (40 + y * 0.6); motes += h('path', { d: twinkle(4 + 3 * hash(i, 5), 1), fill: P, opacity: 0.85, transform: `translate(${f(x)} ${f(y)})` }); }
    L.front += h('g', { 'data-ref': 'egg-ufo', visibility: 'hidden' },
      h('g', { 'data-ref': 'egg-ufoBeam', transform: 'translate(0 12)' },
        F('M-36 0L36 0L150 270L-150 270Z', 'url(#egg-beam)'), F('M-22 0L22 0L90 270L-90 270Z', 'url(#egg-beam)', { opacity: 0.7 }), motes),
      h('g', { 'data-ref': 'egg-ufoBody' },
        Ln('M0 -40C2 -46 -2 -50 0 -54', 2), h('path', { 'data-ref': 'egg-ufoTip', d: circ(0, -57, 4.4), fill: v('eggRose'), stroke: INK, 'stroke-width': 1.1 }),
        // the little pilot, seen through the glass
        O(blob(0, -24, 10, 9), v('eggAlien'), 1.2), F(ell(-3.6, -25, 2, 2.6) + ell(3.6, -25, 2, 2.6), INK), F(circ(-3, -26, 0.8) + circ(4.2, -26, 0.8), P), Ln('M-2 -19Q0 -17 2 -19', 0.9),
        Ln('M-5 -32L-9 -40M5 -32L9 -40', 1.1), F(circ(-9, -41, 2) + circ(9, -41, 2), Gd, { stroke: INK, 'stroke-width': 0.8 }),
        F('M-34 -12C-34 -34 -18 -42 0 -42C18 -42 34 -34 34 -12Z', v('eggDome'), { opacity: 0.55 }),
        O('M-34 -12C-34 -34 -18 -42 0 -42C18 -42 34 -34 34 -12Z', 'none', 1.9),
        F(dab(-26, -18, 18, 2.6, -64), P, { opacity: 0.85 }),
        O('M-80 0C-60 -18 60 -18 80 0C60 16 -60 16 -80 0Z', v('eggHull'), 1.9), TX('M-80 0C-60 -18 60 -18 80 0C60 16 -60 16 -80 0Z'),
        Ln('M-78 0C-58 8 58 8 78 0', 4.4, { stroke: Tl }),
        F([-60, -40, -20, 0, 20, 40, 60].map(x => circ(x, -9 + Math.abs(x) * 0.06, 1.2)).join(''), INK, { opacity: 0.7 }),
        O('M-60 6C-40 20 40 20 60 6C40 14 -40 14 -60 6Z', v('eggHullLo'), 1.3),
        [0, 1, 2].map(k => h('path', { 'data-ref': 'egg-ufoL' + k, d: [-50, -25, 0, 25, 50].filter((_, j) => j % 3 === k || (k === 2 && j === 4)).map(x => circ(x, 4, 4)).join(''), fill: [Gd, v('eggRose'), v('eggTealHi')][k], stroke: INK, 'stroke-width': 1 }))),
      h('path', { 'data-ref': 'egg-ufoLines', d: dab(100, -10, 70, 2.4, 0) + dab(110, 4, 90, 2.4, 0) + dab(96, 18, 54, 2, 0), fill: P, opacity: 0.85, visibility: 'hidden' }));
    L.front += pop('popBleep', 'BLEEP?', '哔哔？', 78, 44, 31, Tl);
  }

  // ---- gull chorus (L-fx-front)
  {
    let ch = '';
    for (let i = 0; i < 5; i++) {
      SEED = 120 + i; const bd = puffD(34, 20, 6, 40 + i);
      ch += h('g', { 'data-ref': 'egg-g' + i }, gull('egg-g' + i),
        h('g', { 'data-ref': `egg-g${i}Kaw`, visibility: 'hidden', transform: 'translate(48 -32)' },
          F(bd, P), h('path', { d: bd, fill: 'none', stroke: INK, 'stroke-width': 1.4 }), O('M-18 14L-28 26L-8 17Z', P, 1.2),
          letter(i % 2 ? '嘎！' : 'KAW!', i % 2 ? 17 : 15, 0, 6, i % 2 ? Nv : R, { seed: 40 + i })));
    }
    SEED = 131;
    L.front += h('g', { 'data-ref': 'egg-chorus', visibility: 'hidden' }, ch,
      h('g', { 'data-ref': 'egg-chNotes' }, O('M0 0C-2 -5 6 -7 7 -2C8 2 1 4 0 0ZM6 -1.6V-24C9 -21 13 -19 13.4 -13C12 -16 9.4 -17.4 8 -17.6V-1.6Z', Gd, 1.6),
        O('M22 -8C20 -13 28 -15 29 -10C30 -6 23 -4 22 -8ZM28 -9.6V-30H40V-12.6', 'none', 1.8), O('M34 -10C32 -15 40 -17 41 -12C42 -8 35 -6 34 -10Z', v('eggPetal'), 1.3), F(rrect(28, -32, 12, 4, 1), INK)));
  }

  // ---- the page (L-letterbox, screen-fixed): dog-eared corner, the page-turn curl, "The End" iris
  {
    SEED = 141; WA = 0.6;
    const S = 58;
    L.page += h('g', { 'data-ref': 'egg-corner', ...DD('typography_frame:O:page-dog-ear') },
      h('g', { 'data-ref': 'egg-cornerIn' },
        F(`M0 0L${-S} 0L0 ${-S}Z`, v('eggUnder')), F(`M0 0L${-S} 0L0 ${-S}Z`, 'url(#egg-gouache)'),
        F(`M${-S} 0L0 ${-S}L-6 ${-S + 8}L${-S + 8} -6Z`, INK, { opacity: 0.12 }),
        F(`M${-S - 4} 2Q${-S - 6} ${-S * 0.6} ${-S - 3} ${-S - 3}Q${-S * 0.6} ${-S - 6} 2 ${-S - 4}Z`, INK, { opacity: 0.16, transform: 'translate(-3 -2)' }),
        O(`M${-S} 0Q${-S - 3} ${-S * 0.6} ${-S} ${-S}Q${-S * 0.6} ${-S - 3} 0 ${-S}Z`, P, 1.4),
        F(`M${-S} 0Q${-S - 3} ${-S * 0.6} ${-S} ${-S}Q${-S * 0.6} ${-S - 3} 0 ${-S}Z`, 'url(#egg-fibre)'),
        F(`M${-S} 0L0 ${-S}L-12 ${-S + 2}L${-S + 2} -12Z`, v('mauve'), { opacity: 0.28 }),
        F(dab(-S + 10, -S + 8, 24, 1.6, 45), v('paper'), { opacity: 0.7 })));
    // page turn: every d is rewritten per frame for the 1.3 s of the sweep (a few small polygons)
    L.page += h('g', { 'data-ref': 'egg-turn', visibility: 'hidden' },
      h('path', { 'data-ref': 'egg-turnGut', d: '', fill: INK, opacity: 0.14 }),
      h('path', { 'data-ref': 'egg-turnShadow', d: '', fill: INK, opacity: 0.2 }),
      h('path', { 'data-ref': 'egg-turnFlap', d: '', fill: P }),
      h('path', { 'data-ref': 'egg-turnTex', d: '', fill: 'url(#egg-fibre)' }),
      h('path', { 'data-ref': 'egg-turnShade', d: '', fill: v('mauve'), opacity: 0.35 }),
      h('path', { 'data-ref': 'egg-turnLine', d: '', fill: 'none', stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }));
    // The End: a paper iris closing on the rider, with the title lettered on the page
    const hole = blob(0, 0, 900, 900, 0.012, 5);
    L.page += h('g', { 'data-ref': 'egg-end', visibility: 'hidden' },
      h('g', { 'data-ref': 'egg-endIris' },
        h('path', { d: 'M-9000 -9000H9000V9000H-9000Z' + hole, fill: P, 'fill-rule': 'evenodd' }),
        h('path', { d: hole, fill: 'none', stroke: v('mauve'), 'stroke-width': 60, opacity: 0.22 }),
        h('path', { d: hole, fill: 'none', stroke: INK, 'stroke-width': 7 }),
        h('path', { d: blob(0, 0, 930, 930, 0.012, 8), fill: 'none', stroke: INK, 'stroke-width': 3, opacity: 0.35 })),
      h('g', { 'data-ref': 'egg-endText' },
        h('g', { 'data-ref': 'egg-endT1' }, letter('The End', 76, 800, 150, R, { seed: 151, wob: 0.04 }), ink('全剧终', 30, 800, 200, INK, { track: 140 })),
        Ln('M560 120C590 96 620 140 650 114M1040 120C1010 96 980 140 950 114', 2),
        h('path', { d: twinkle(10, 2.4), fill: Gd, stroke: INK, 'stroke-width': 0.9, transform: 'translate(540 128)' }),
        h('path', { d: twinkle(10, 2.4), fill: Gd, stroke: INK, 'stroke-width': 0.9, transform: 'translate(1060 128)' }),
        h('g', { 'data-ref': 'egg-endQ' }, letter('?', 84, 0, 0, Gd, { seed: 155 })),
        h('g', { 'data-ref': 'egg-endB1' }, ink('马拉松 · 42.195 km · a whole marathon!', 24, 800, 842, INK)),
        h('g', { 'data-ref': 'egg-endB2' }, letter('…or is it?  未完待续', 28, 800, 846, Nv, { seed: 157 }))));
    WA = 0.9;
  }

  return {
    defs,
    layers: {
      'L-sunmoon': L.sun, 'L-stars': L.stars, 'L-clouds': L.clouds, 'L-sea': L.sea,
      'L-roadside': L.roadside, 'L-road': L.road, 'L-fx-front': L.front, 'L-letterbox': L.page,
    },
  };
}

// ------------------------------------------------------------------------------------------------ schedules (pure)
const BENCH = { P: 34000, X0: 15600, d: 0.9 };       // roadside coords
const PUDDLE = { P: 21000, X0: 30000 };              // road coords
const BOTTLE = { P: 2700, X0: 2100, d: 0.1, y: 526 }; // sea coords
const nearest = (S, dd) => { const k = Math.max(0, Math.round((dd - S.X0 + 800) / S.P)); return [k, S.X0 + k * S.P - dd]; };
export const benchAt = distance => nearest(BENCH, distance * BENCH.d);
export const puddleAt = distance => nearest(PUDDLE, distance);
export const bottleAt = (distance, t) => { const [k, x] = nearest(BOTTLE, distance * BOTTLE.d); return [k, x + 8 * Math.sin(t * 0.4 + k)]; };
const KM_UNITS = 1000 / (0.34 / BIKE.R);            // odometer: wheel R = 100 units ≈ 0.34 m (as ui.js)

// page-turn geometry (screen / viewBox units): the fold line n·(p − C) = s sweeps from the bottom-right corner C
const TN = (() => { const x = -1, y = -0.42, l = Math.hypot(x, y); return [x / l, y / l]; })();
function clipHalf(pts, keep) {           // Sutherland–Hodgman against one half-plane; keep(p) -> signed value (≥ 0 kept)
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], va = keep(a), vb = keep(b);
    if (va >= 0) out.push(a);
    if ((va >= 0) !== (vb >= 0)) { const u = va / (va - vb); out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); }
  }
  return out;
}
const pd = pts => (pts.length > 2 ? poly(pts) : '');
export function turnGeom(s, box) {
  const [X0, Y0, X1, Y1] = box, C = [X1, Y1];
  const rect = [[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1]];
  const q = p => TN[0] * (p[0] - C[0]) + TN[1] * (p[1] - C[1]);
  const refl = p => { const k = 2 * (s - q(p)); return [p[0] + k * TN[0], p[1] + k * TN[1]]; };
  const turned = clipHalf(rect, p => s - q(p));                    // the corner side: already turned (the new page)
  const flap = turned.map(refl);                                   // the page's back, folded over onto the old side
  const shadeBand = clipHalf(turned, p => q(p) - (s - 46)).map(refl);   // the fold's rounding, on the flap
  const gut = clipHalf(turned, p => q(p) - (s - 30));                    // soft gutter shadow on the new page
  const shadow = flap.map(p => [p[0] + TN[0] * 14 + 4, p[1] + TN[1] * 14 + 8]);
  return { flap: pd(flap), shade: pd(shadeBand), gut: pd(gut), shadow: pd(shadow) };
}

// ------------------------------------------------------------------------------------------------ attach
let inst = null;
export function attach(svg, ctx) {
  const r = refs(svg, 'egg-');
  const st = new WeakMap();    // last written attribute values per element (write only on change)
  const set = (el, k, val) => { let m = st.get(el); if (!m) st.set(el, m = {}); if (m[k] !== val) { m[k] = val; el.setAttribute(k, val); } };
  const vis = (el, on) => set(el, 'visibility', on ? 'inherit' : 'hidden');   // 'inherit': a shown child never overrides a hidden egg group
  const reduced = ctx.reduced;
  const E = {};                  // id -> { t0, ...params }
  const found = new Set();
  let catTaken = -1, lastFrame = null, onFound = () => {};
  try { for (const k of JSON.parse(localStorage.getItem('pb-eggs') || '[]')) if (DUR[k]) found.add(k); } catch (e) { /* storage blocked */ }
  const markFound = k => {
    if (found.has(k)) return;
    found.add(k);
    try { localStorage.setItem('pb-eggs', JSON.stringify([...found])); } catch (e) { /* ignore */ }
    onFound(k);
  };
  const start = (k, p = {}) => { E[k] = { t0: lastFrame ? lastFrame.t : 0, ...p }; markFound(k); };
  const tau = (k, t) => (E[k] ? t - E[k].t0 : -1);
  let brown = false;
  // the visible part of the 1600×900 viewBox (the scene is slice-fitted): the page corner lives at its bottom right
  let box = [0, 0, 1600, 900];
  const measure = () => {
    const w = svg.clientWidth || 1600, hh = svg.clientHeight || 900, s = Math.max(w / 1600, hh / 900);
    const vw = w / s, vh = hh / s; box = [800 - vw / 2, 450 - vh / 2, 800 + vw / 2, 450 + vh / 2];
  };
  measure();
  const win = svg.ownerDocument && svg.ownerDocument.defaultView;
  if (win) win.addEventListener('resize', measure);

  const api = {
    start, E, found, get brown() { return brown; },
    setBrown(on) { brown = on; svg.classList.toggle('egg-brown', on); if (on) start('brown'); },
    frame: () => lastFrame,
    onFound(fn) { onFound = fn; },
    catTake(k) { catTaken = k; },
    box: () => box,
    // layer-space anchors (an egg element's parent in each layer: its screen CTM maps clicks into layer coords)
    anchor: { 'L-sunmoon': r.sunFace.parentNode, 'L-stars': r.wish.parentNode, 'L-sea': r.bottle.parentNode },
  };
  inst = api;

  // depth-1 layers carry the camera: screen point -> layer coords (+ 1/zoom), so cards keep their screen size and place
  const scr = (fr, sx, sy) => { const c = fr.cam || { zoom: 1, fx: 800, fy: 450 }, z = c.zoom || 1; return [(sx - 800) / z + c.fx, (sy - 450) / z + c.fy, 1 / z]; };
  const toScr = (fr, wx, wy) => { const c = fr.cam || { zoom: 1, fx: 800, fy: 450 }, z = c.zoom || 1; return [(wx - c.fx) * z + 800, (wy - c.fy) * z + 450]; };
  function riderXf(fr) {
    const [rcx, rcy] = BIKE.rearContact;
    return `translate(${RIDER_X} ${f2(GROUND_Y + fr.pose.riderY)}) rotate(${f2(fr.pose.bikePitch)} ${rcx} ${rcy})`;
  }

  return {
    update(fr) {
      lastFrame = fr;
      const t = fr.t, D = fr.distance;
      // odometer milestones (live only)
      if (fr.dt > 0 && api.prevD !== undefined) {
        const a = Math.floor(api.prevD / KM_UNITS), b = Math.floor(D / KM_UNITS);
        if (b > a && b >= 1) start('km', { n: b });
        if (api.prevD < 4.2 * KM_UNITS && D >= 4.2 * KM_UNITS) start('fortytwo');
        if (api.prevD < MARATHON * KM_UNITS && D >= MARATHON * KM_UNITS) start('theend');
      }
      api.prevD = D;
      // bedtime: 30 s of coasting at night (sim time, so a scrub with the rider coasting finds it too)
      if (fr.coasting && fr.night > 0.6) {
        if (api.coastSince === undefined || t < api.coastSince) api.coastSince = t;
        if (t - api.coastSince >= 30 && !api.bedDone) { api.bedDone = true; start('bedtime'); }
      } else {
        api.coastSince = undefined; api.bedDone = false;
        if (E.bedtime && E.bedtime.t1 === undefined && fr.dt > 0) { const u = t - E.bedtime.t0; if (u > 0 && u < DUR.bedtime - 1) E.bedtime.t1 = t; }   // pedalling again: the cap flies off
      }
      // splash: a pending hop lands in a puddle
      if (api.hopT0 !== undefined && t >= api.hopT0 + TIMING.hop.land && t < api.hopT0 + TIMING.hop.land + 0.3) {
        const [, px] = puddleAt(D);
        if (Math.abs(px - (RIDER_X + 24)) < 270) start('splash', { d0: D, x0: px });
        api.hopT0 = undefined;
      }
      set(r.riderF, 'transform', riderXf(fr));

      // ---- brown caption / velo caption (upper left)
      const capAnim = (el, k, x, y) => {
        const u = tau(k, t), on = u >= 0 && u < DUR[k];
        vis(el, on); if (!on) return;
        const s = reduced ? 1 : easeOutBack(clamp(u / 0.35, 0, 1)), o = 1 - sstep(DUR[k] - 0.4, DUR[k], u);
        const [wx, wy, iz] = scr(fr, x, y);
        set(el, 'transform', `translate(${f(wx)} ${f(wy)}) rotate(${f(-2 + (reduced ? 0 : Math.sin(u * 2) * 0.6))}) scale(${f2(Math.max(0.01, s) * iz)})`); set(el, 'opacity', f2(o));
      };
      capAnim(r.capBrown, 'brown', 360, 190);
      capAnim(r.capVelo, 'velo', 360, 190);

      // ---- sun / moon wink
      const bedOn = E.bedtime && tau('bedtime', t) >= 0 && tau('bedtime', t) < DUR.bedtime && (E.bedtime.t1 === undefined || t < E.bedtime.t1);
      const faceAnim = (el, k, pos, pfx) => {
        const u = tau(k, t), on = u >= 0 && u < DUR[k];
        vis(el, on); if (!on) return;
        const o = sstep(0, 0.25, u) * (1 - sstep(DUR[k] - 0.4, DUR[k], u));
        set(el, 'transform', `translate(${f(pos.x)} ${f(pos.y)})`); set(el, 'opacity', f2(o));
        const shut = (u > 0.6 && u < 1.05) || (u > 1.35 && u < 1.55);
        vis(r[pfx + 'Open'], !shut); vis(r[pfx + 'Shut'], shut);
        const sp = sstep(0.62, 0.8, u) * (1 - sstep(1.1, 1.4, u));
        vis(r[pfx + 'Spark'], sp > 0.02);
        if (sp > 0.02) set(r[pfx + 'Spark'], 'transform', `translate(64 -40) rotate(${f(u * 90)}) scale(${f2(sp)})`);
      };
      faceAnim(r.sunFace, 'sunwink', fr.sun, 'sunFace');
      faceAnim(r.moonFace, 'moonwink', fr.moon, 'moonFace');
      vis(r.moonCap, bedOn);   // combo: at bedtime the moon wears a nightcap too

      // ---- wish
      {
        const u = tau('wish', t), on = u >= 0 && u < DUR.wish;
        vis(r.wish, on);
        if (on) {
          const p = E.wish;
          const s = reduced ? 1 : easeOutBack(clamp(u / 0.3, 0, 1));
          set(r.wish, 'transform', `translate(${f(p.x)} ${f(p.y)}) scale(${f2(Math.max(0.01, s) * 1.35)})`);
          set(r.wish, 'opacity', f2(1 - sstep(DUR.wish - 0.5, DUR.wish, u)));
          set(r.wishRays, 'transform', `rotate(${f(u * 30)}) scale(${f2(0.85 + 0.15 * Math.sin(u * 5))})`);
          set(r.wishFall, 'transform', `translate(${f(-u * 30)} ${f(u * 60)})`);
        }
      }

      // ---- pelican squadron: a V from the left, overtaking the rider, flying +x across the upper sky
      {
        const u = tau('flight', t), on = u >= 0 && u < DUR.flight;
        vis(r.flight, on);
        if (on) {
          const lead = -250 + u * 250;
          for (let i = 0; i < 7; i++) {
            const side = i === 0 ? 0 : (i % 2 ? 1 : -1), rank = Math.ceil(i / 2);
            const x = lead - rank * 84, y = 132 + side * rank * 22 + 6 * Math.sin(u * 1.3 + i);
            const ph = u * 4.2 - rank * 0.5;
            const flap = reduced ? 1 : Math.cos(ph);
            const s = 0.95 - rank * 0.04;
            set(r['pf' + i], 'transform', `translate(${f(x)} ${f(y)}) scale(${f2(s)})`);
            set(r[`pf${i}Wing`], 'transform', `scale(1 ${f2(0.2 + 0.8 * flap)})`);
            set(r[`pf${i}WingF`], 'transform', `scale(1 ${f2(0.25 + 0.75 * flap)})`);
          }
        }
      }

      // ---- message in a bottle
      {
        const [k, bx] = bottleAt(D, t);
        const show = bx > -200 && bx < 1800;
        vis(r.bottle, show);
        api.bottle = show ? { k, x: bx, y: BOTTLE.y } : null;
        if (show) {
          set(r.bottle, 'transform', `translate(${f(bx)} ${f(BOTTLE.y + 2.5 * Math.sin(t * 2.1))})`);
          set(r.bottleB, 'transform', `rotate(${f(-8 + 7 * Math.sin(t * 2.1 + 0.6))})`);
          set(r.bottleRip, 'transform', `scale(${f2(1 + 0.12 * Math.sin(t * 2.1))} 1)`);
          const gp = t % 22, gOn = !fr.reduced && gp < 0.9;
          vis(r.bottleGlint, gOn);
          if (gOn) set(r.bottleGlint, 'transform', `translate(-12 -11) scale(${f2(0.25 + Math.sin(Math.PI * gp / 0.9))})`);
        }
        const u = tau('bottle', t), on = u >= 0 && u < DUR.bottle;
        vis(r.note, on);
        if (on) {
          const p = E.bottle;
          set(r.note, 'transform', `translate(${f(p.nx)} ${f(p.ny)}) rotate(-1.5)`);
          const sy = reduced ? 1 : easeOutBack(clamp(u / 0.45, 0, 1));
          set(r.noteIn, 'transform', `scale(${f2(clamp(u / 0.2, 0.1, 1))} ${f2(Math.max(0.02, sy))})`);
          set(r.note, 'opacity', f2(1 - sstep(DUR.bottle - 0.5, DUR.bottle, u)));
        }
      }

      // ---- bench + cat
      {
        const [k, bx] = benchAt(D);
        const show = bx > -300 && bx < 1900;
        vis(r.bench, show);
        api.bench = show ? { k, x: bx } : null;
        const u = tau('cat', t), jumping = u >= 0 && u < DUR.cat;
        if (show) {
          set(r.bench, 'transform', `translate(${f(bx)} 750)`);
          const gone = catTaken === k && (!jumping || u > 0.05);
          vis(r.benchCat, !gone);
          const look = clamp((RIDER_X - bx) / 900, -1, 1);
          set(r.csHead, 'transform', `translate(14 -50) rotate(${f(look * 8 + 3 * Math.sin(t * 1.3))})`);
          set(r.csTail, 'transform', `rotate(${f(reduced ? 0 : 10 * Math.sin(t * 1.6))} -18 -8)`);
          vis(r.csEyes, wrap(t, 3.1) > 0.12);
        }
        vis(r.catJump, jumping);
        if (jumping) {
          const p = E.cat, basket = [RIDER_X + 172, GROUND_Y + fr.pose.riderY - 300];
          let x, y, pose = 'leap', flip = 1, rot = 0;
          const bench = [p.x0, 700];
          if (u < 0.5) { const s = sstep(0, 0.5, u); x = lerp(bench[0], basket[0], s); y = lerp(bench[1], basket[1], s) - 180 * Math.sin(Math.PI * s); flip = basket[0] >= bench[0] ? 1 : -1; rot = -20 + 40 * s; }
          else if (u < 0.85) { x = basket[0] - 6; y = basket[1] - 6; pose = 'perch'; }
          else if (u < 1.45) { const s = sstep(0.85, 1.45, u); x = lerp(basket[0], RIDER_X - 380, s); y = lerp(basket[1], GROUND_Y - 30, s) - 160 * Math.sin(Math.PI * s); flip = -1; rot = -10 + 40 * s; }
          else { const s = u - 1.45; x = RIDER_X - 380 - s * 900; y = GROUND_Y - 30 - Math.abs(Math.sin(s * 14)) * 10; flip = -1; rot = 0; }
          set(r.catJump, 'transform', `translate(${f(x)} ${f(y)}) scale(${flip} 1) rotate(${f(rot)})`);
          vis(r.catLeap, pose === 'leap'); vis(r.catPerch, pose === 'perch');
          vis(r.catFish, u > 0.7);
          set(r.catFish, 'transform', pose === 'perch' ? 'translate(30 -26) rotate(80)' : 'translate(50 -2) rotate(90) scale(0.9)');
        }
        popAnim(r.popMeow, r.popMeowRays, u - 0.5, 1.1, RIDER_X + 380, GROUND_Y - 470, 5);
      }

      // ---- puddle + splash
      {
        const [, px] = puddleAt(D);
        const show = px > -300 && px < 1900;
        vis(r.puddle, show);
        if (show) set(r.puddle, 'transform', `translate(${f(px)} ${GROUND_Y + 14})`);
        const u = tau('splash', t), on = u >= 0 && u < DUR.splash;
        vis(r.splash, on);
        if (on) {
          const p = E.splash, sx = -(D - p.d0);
          set(r.splash, 'transform', `translate(${f(sx)} 0)`);
          const cs = Math.sin(Math.PI * clamp(u / 0.7, 0, 1));
          set(r.crownR, 'transform', `translate(${RIDER_X - 125} ${GROUND_Y + 6}) scale(${f2(0.4 + 1.2 * cs)} ${f2(Math.max(0.01, cs * 1.4))})`);
          set(r.crownF, 'transform', `translate(${RIDER_X + 173} ${GROUND_Y + 6}) scale(${f2(0.4 + 1.1 * cs)} ${f2(Math.max(0.01, cs * 1.2))})`);
          for (let i = 0; i < 10; i++) {
            const w = i < 5 ? RIDER_X - 125 : RIDER_X + 173, a = (-150 + 120 * hash(i, 3)) * D2R, sp = 340 + 260 * hash(i, 5);
            const x = w + Math.cos(a) * sp * u, y = GROUND_Y + Math.sin(a) * sp * u + 900 * u * u;
            vis(r['dr' + i], y < GROUND_Y + 10);
            set(r['dr' + i], 'transform', `translate(${f(x)} ${f(y)}) rotate(${f(Math.atan2(Math.sin(a) * sp + 1800 * u, Math.cos(a) * sp) / D2R + 90)})`);
          }
        }
        popAnim(r.popSplash, r.popSplashRays, u, 1.2, RIDER_X + 430, GROUND_Y - 150, -5);
      }

      // ---- milestones + petal confetti
      {
        const uk = tau('km', t), u42 = tau('fortytwo', t);
        const [PX, PY, PZ] = scr(fr, 330, 360);
        const posterAnim = (el, inner, u, dur) => {
          const on = u >= 0 && u < dur;
          vis(el, on); if (!on) return;
          const s = reduced ? 1 : easeOutBack(clamp(u / 0.4, 0, 1));
          set(el, 'transform', `translate(${f(PX)} ${f(PY)}) rotate(${f(-3 + (reduced ? 0 : 1.5 * Math.sin(u * 2.2)))}) scale(${f2(PZ)})`);
          set(inner, 'transform', `scale(${f2(Math.max(0.01, s))})`);
          set(el, 'opacity', f2(1 - sstep(dur - 0.4, dur, u)));
        };
        posterAnim(r.posterKm, r.posterKmIn, uk, DUR.km);
        posterAnim(r.poster42, r.poster42In, u42, DUR.fortytwo);
        if (E.km && uk >= 0 && uk < DUR.km && E.km.n !== api.kmShown) {
          api.kmShown = E.km.n;
          const big = r.posterKmBig;
          const tt = text(`${E.km.n} km!`, 48, 0, 76, { seed: 93 });
          big.children[0].setAttribute('d', tt.d); big.children[1].setAttribute('d', tt.d);
        }
        const uc = Math.max(uk >= 0 && uk < DUR.km ? uk : -1, u42 >= 0 && u42 < DUR.fortytwo ? u42 : -1);
        const con = uc >= 0 && uc < 3.4 && !reduced;
        vis(r.confetti, con);
        if (con) for (let i = 0; i < 28; i++) {
          const a = (-90 + (hash(i, 1) - 0.5) * 220) * D2R, sp = 240 + 300 * hash(i, 2);
          const drag = 1 - Math.exp(-uc * 2.2);
          // petals flutter down slowly (a calm fall, like leaves)
          const x = PX + PZ * (Math.cos(a) * sp * drag / 2.2 + 18 * Math.sin(uc * (2 + 1.5 * hash(i, 4)) + i));
          const y = PY + PZ * (Math.sin(a) * sp * drag / 2.2 + 46 * uc * uc);
          set(r['cf' + i], 'transform', `translate(${f(x)} ${f(y)}) rotate(${f(uc * 120 * (hash(i, 6) - 0.5) * 3 + i * 40)}) scale(${f2(1 - 0.6 * Math.abs(Math.sin(uc * 3 + i)))} 1)`);
          set(r['cf' + i], 'opacity', f2(1 - sstep(2.6, 3.4, uc)));
        }
      }

      // ---- velocipedia
      {
        const u = tau('velo', t), on = u >= 0 && u < DUR.velo;
        vis(r.velo, on);
        if (on) {
          const snap = u > 2.3;
          vis(r.veloChain, !snap);
          const sh = snap || reduced ? 0 : 1.6 * Math.sin(u * 70) * sstep(0.3, 0.6, u);
          set(r.veloChain, 'transform', `translate(${f(sh)} ${f(-sh * 0.5)})`);
          vis(r.veloLinks, snap);
          if (snap) for (let i = 0; i < 8; i++) {
            const s = u - 2.3, a = (-160 + 140 * hash(i, 8)) * D2R, sp = 260 + 200 * hash(i, 9);
            set(r['lk' + i], 'transform', `translate(${f(90 + Math.cos(a) * sp * s)} ${f(-90 + Math.sin(a) * sp * s + 700 * s * s)}) rotate(${f(s * 720 * (hash(i, 10) - 0.5))})`);
          }
          const q = sstep(0.4, 0.6, u) * (1 - sstep(2.1, 2.3, u));
          vis(r.veloQ, q > 0.02);
          if (q > 0.02) set(r.veloQ, 'transform', `translate(-30 -515) rotate(${f(8 * Math.sin(u * 6))}) scale(${f2(q)})`);
        }
        popAnim(r.popSnap, r.popSnapRays, u - 2.3, 0.9, RIDER_X + 330, GROUND_Y - 260, -6);
      }

      // ---- UFO
      {
        const u = tau('ufo', t) - 2.0, on = u >= 0 && u < DUR.ufo - 2;   // arrives once the pelican's GULP! has cleared
        vis(r.ufo, on);
        const fishOn = on && u > 1.3 && u < 2.9;
        vis(r.ufoFish, fishOn);
        if (on) {
          const hover = [RIDER_X + 180, 230];
          let x, y, tilt = 0;
          if (u < 1.1) { const s = sstep(0, 1.1, u); x = lerp(1500, hover[0], s); y = lerp(-120, hover[1], s) + 30 * Math.sin(s * Math.PI); tilt = -12 * (1 - s); }
          else if (u < 3.6) { x = hover[0] + 6 * Math.sin(u * 3); y = hover[1] + 5 * Math.sin(u * 4.3); tilt = 3 * Math.sin(u * 2.6); }
          else { const s = (u - 3.6) / 1.2; x = hover[0] - 1800 * s * s; y = hover[1] - 400 * s * s; tilt = -18; }
          set(r.ufo, 'transform', `translate(${f(x)} ${f(y)}) rotate(${f(tilt)})`);
          const bOn = u > 1.1 && u < 3.0;
          vis(r.ufoBeam, bOn);
          if (bOn) set(r.ufoBeam, 'transform', `translate(0 12) scale(1 ${f2(sstep(1.1, 1.3, u) * (1 - sstep(2.85, 3.0, u)))})`);
          vis(r.ufoLines, u > 3.6);
          const blink = Math.floor(u * 4) % 3;
          for (let k = 0; k < 3; k++) set(r['ufoL' + k], 'opacity', k === blink ? '1' : '0.5');
          if (fishOn) {
            const s = sstep(1.3, 2.8, u);
            const by = -300 - s * (GROUND_Y + fr.pose.riderY - 300 - hover[1] - 10);
            set(r.ufoFish, 'transform', `translate(${f(184 + 6 * Math.sin(u * 7))} ${f(by)}) rotate(${f(-30 + 70 * Math.sin(u * 5))}) scale(${f2(1 - 0.5 * s)})`);
          }
        }
        popAnim(r.popBleep, r.popBleepRays, u - 3.0, 1.0, RIDER_X + 420, 330, 5);
      }

      // ---- gull chorus
      {
        const u = tau('chorus', t), on = u >= 0 && u < DUR.chorus;
        vis(r.chorus, on);
        if (on) {
          const POS = [[380, 330], [520, 262], [650, 214], [1030, 236], [1170, 300]];
          for (let i = 0; i < 5; i++) {
            const [hx, hy] = POS[i];
            const inU = sstep(0 + i * 0.08, 0.8 + i * 0.08, u), outU = sstep(2.8, 3.6, u);
            const x = lerp(1800 + i * 80, hx, inU) - outU * 1900, y = hy - 60 * (1 - inU) + 4 * Math.sin(u * 4 + i) - outU * 120;
            set(r['g' + i], 'transform', `translate(${f(x)} ${f(y)}) scale(${f2(1.45 - 0.05 * i)})`);
            const flapping = inU < 1 || outU > 0;
            const fl = reduced ? 1 : flapping ? Math.cos(u * 11 + i) : 0.25 + 0.1 * Math.sin(u * 3 + i);
            set(r[`g${i}Wing`], 'transform', `scale(1 ${f2(fl)})`);
            set(r[`g${i}WingF`], 'transform', `scale(1 ${f2(fl)})`);
            const beat = u - 0.9 - i * 0.28, sing = beat > 0 && wrap(beat, 1.4) < 0.45 && u < 2.9;
            vis(r[`g${i}Jaw`], sing); vis(r[`g${i}Kaw`], sing);
          }
          const nu = wrap(u, 1.2);
          set(r.chNotes, 'transform', `translate(${f(820 + 40 * nu)} ${f(210 - 60 * nu)}) rotate(${f(-8 + 10 * nu)})`);
          set(r.chNotes, 'opacity', f2(u < 2.9 ? Math.sin(Math.PI * nu / 1.2) : 0));
        }
      }

      // ---- bedtime: yawn bubble, nightcap drop, Z z z (rider space; follows the head joint)
      {
        const u = tau('bedtime', t), on = u >= 0 && u < DUR.bedtime;
        vis(r.bed, on);
        if (on) {
          const hj = fr.pose.joints.head || { x: 125, y: -520, rot: 0 };
          const off = E.bedtime.t1 !== undefined ? t - E.bedtime.t1 : -1;      // pedalling again: the cap flies off
          const endU = off >= 0 ? off : u - (DUR.bedtime - 1.2);
          // yawn bubble (0.2 – 2.4 s)
          const yu = u - 0.2, yOn = yu >= 0 && yu < 2.2 && off < 0;
          vis(r.bedYawn, yOn);
          if (yOn) { const s = reduced ? 1 : easeOutBack(clamp(yu / 0.3, 0, 1)) * (1 - 0.3 * sstep(1.9, 2.2, yu)); set(r.bedYawn, 'transform', `translate(${f(hj.x + 120)} ${f(hj.y - 96)}) scale(${f2(Math.max(0.01, s))})`); set(r.bedYawn, 'opacity', f2(1 - sstep(1.9, 2.2, yu))); }
          // nightcap: drops in from above at 1.4 s with a squashy bounce, stays until the ride resumes
          const cu = u - 1.4;
          vis(r.bedCap, cu >= 0 && endU < 1.2);
          if (cu >= 0) {
            const fall = sstep(0, 0.45, cu), bounce = cu > 0.45 ? Math.exp(-(cu - 0.45) * 7) * Math.sin((cu - 0.45) * 22) : 0;
            let ox = 0, oy = -160 * (1 - fall) + 6 * bounce, rot = -16 * (1 - fall) + 4 * bounce, sq = 1 - 0.08 * bounce;
            if (endU >= 0) { const s = sstep(0, 1.2, endU); ox = -260 * s; oy = -200 * s + 60 * s * s; rot = -60 * s; }
            set(r.bedCap, 'transform', `translate(${f(hj.x)} ${f(hj.y)}) rotate(${f(hj.rot || 0)})`);
            set(r.bedCapIn, 'transform', `translate(${f(ox)} ${f(oy)}) rotate(${f(rot)}) scale(${f2(1 / sq)} ${f2(sq)})`);
            set(r.bedCap, 'opacity', f2(1 - sstep(0.8, 1.2, endU)));
          }
          // Z z z: float up and back from the bill, one every 0.9 s, calm and slow
          for (let i = 0; i < 3; i++) {
            const zu = wrap(u - 2.2 - i * 0.9, 2.7), zOn = u > 2.2 + i * 0.9 && endU < 0 && !reduced;
            vis(r['bedZ' + i], zOn);
            if (zOn) set(r['bedZ' + i], 'transform', `translate(${f(hj.x + 40 - 70 * zu + 10 * Math.sin(zu * 3))} ${f(hj.y - 40 - 70 * zu)}) rotate(${f(-12 + 8 * Math.sin(zu * 2))}) scale(${f2(0.6 + 0.4 * zu)})`), set(r['bedZ' + i], 'opacity', f2(sstep(0, 0.3, zu) * (1 - sstep(2.1, 2.7, zu))));
          }
        }
      }

      // ---- the page: dog-eared corner (a flutter every 12 s: the visible clue), page-turn curl, The End
      {
        const [X0, Y0, X1, Y1] = box;
        const tu = tau('pageturn', t), turning = tu >= 0 && tu < DUR.pageturn;
        vis(r.corner, !(turning && tu < TURN + 0.1));
        if (!turning) {
          const fp = wrap(t, 12), lift = reduced ? 0 : Math.sin(Math.PI * clamp(fp / 1.1, 0, 1)) * (fp < 1.1 ? 1 : 0);
          set(r.corner, 'transform', `translate(${f(X1)} ${f(Y1)})`);
          set(r.cornerIn, 'transform', lift > 0.01 ? `scale(${f2(1 + 0.45 * lift)})` : 'scale(1)');
        } else {
          const back = sstep(TURN, DUR.pageturn, tu);   // the corner curls back in after the turn
          set(r.corner, 'transform', `translate(${f(X1)} ${f(Y1)})`);
          set(r.cornerIn, 'transform', `scale(${f2(Math.max(0.01, back))})`);
          vis(r.corner, tu > TURN);
        }
        vis(r.turn, turning && tu < TURN);
        if (turning && tu < TURN) {
          const smax = Math.abs(TN[0] * (X0 - X1) + TN[1] * (Y0 - Y1)) * 2 + 80;   // flap fully off the page
          const s = 60 + (smax - 60) * easeInOut(clamp(tu / TURN, 0, 1));
          const g = turnGeom(s * 0.5, [X0 - 20, Y0 - 20, X1 + 2, Y1 + 2]);
          set(r.turnFlap, 'd', g.flap); set(r.turnTex, 'd', g.flap); set(r.turnLine, 'd', g.flap);
          set(r.turnShade, 'd', g.shade); set(r.turnGut, 'd', g.gut); set(r.turnShadow, 'd', g.shadow);
        }
        // The End: the page irises shut on the rider, "The End" … "?" … "…or is it?", and opens again
        const eu = tau('theend', t), eOn = eu >= 0 && eu < DUR.theend;
        vis(r.end, eOn);
        if (eOn) {
          const [cx, cy] = toScr(fr, RIDER_X + 40, GROUND_Y + fr.pose.riderY - 290);
          const close = easeInOut(clamp(eu / 1.6, 0, 1)), open = easeInOut(clamp((eu - 7.0) / 1.6, 0, 1));
          const k = lerp(1.35, 0.33, close) + (1.4 - 0.33) * open;
          set(r.endIris, 'transform', `translate(${f(cx)} ${f(cy)}) scale(${f2(k)})`);
          const tx = sstep(1.1, 1.7, eu) * (1 - sstep(6.6, 7.2, eu));
          const vw = X1 - X0, ks = Math.min(1, vw / 640);
          set(r.endText, 'transform', `translate(800 ${f(Y0)}) scale(${f2(ks)}) translate(-800 0)`);
          set(r.endText, 'opacity', f2(tx));
          const q = clamp((eu - 3.4) / 0.3, 0, 1);
          vis(r.endQ, q > 0);
          if (q > 0) set(r.endQ, 'transform', `translate(${f(958 + 6 * Math.sin(eu * 3))} 152) rotate(${f(10 + 6 * Math.sin(eu * 2))}) scale(${f2(Math.max(0.01, reduced ? 1 : easeOutBack(q)))})`);
          const b2 = eu > 4.2;
          vis(r.endB1, !b2); vis(r.endB2, b2);
        }
      }
    },
  };

  function popAnim(el, rays, u, dur, x, y, rot) {
    const on = u >= 0 && u < dur;
    vis(el, on);
    if (!on) return;
    const uin = clamp(u / 0.18, 0, 1), uout = sstep(dur - 0.26, dur, u);
    const s = reduced ? 1 : (uin < 1 ? easeOutBack(uin) : 1) * (1 - 0.3 * uout);
    const wob = reduced ? 0 : 2.4 * Math.exp(-u * 5) * Math.sin(u * 24);
    set(el, 'transform', `translate(${f(x)} ${f(y - 14 * uout)}) rotate(${f(rot + wob)}) scale(${f2(Math.max(0.01, s))})`);
    set(el, 'opacity', f2(1 - uout));
    const ur = clamp(u / 0.4, 0, 1);
    vis(rays, ur < 1);
    if (ur < 1) { set(rays, 'transform', `scale(${f2(0.8 + 0.4 * ur)})`); set(rays, 'opacity', f2(1 - ur * ur)); }
  }
}

// ------------------------------------------------------------------------------------------------ connect (runtime)
// Called once by main.js after attach: wires keys, clicks and bus events to the X-sheets; returns the test API.
export function connect({ bus, state, svg }) {
  const A = inst;
  if (!A) return null;
  const win = svg.ownerDocument.defaultView;
  const now = () => (A.frame() ? A.frame().t : state.t);
  const emitFound = id => {
    const e = EGGS.find(x => x.id === id);
    bus.emit('egg:found', { id, zh: e.zh, en: e.en, count: A.found.size, total: EGGS.length });
  };
  // the rider reacts to a discovery (live play only; screenshot mode stays deterministic)
  const REACT = { km: ['ui:bell', 250], fortytwo: ['ui:wave', 400], bottle: ['ui:wave', 900], wish: ['ui:bell', 300], sunwink: ['ui:wave', 300], theend: ['ui:wave', 2600] };
  const live = !new URLSearchParams(win.location.search).has('freeze');
  A.onFound(id => { emitFound(id); const rc = live && REACT[id]; if (rc) win.setTimeout(() => bus.emit(rc[0], {}), rc[1]); });
  if (A.found.size) queueMicrotask(() => bus.emit('egg:found', { id: null, count: A.found.size, total: EGGS.length }));
  // clue tier: after a minute of riding, show the empty tally so players know there is something to find
  else if (live) win.setTimeout(() => { if (!A.found.size) bus.emit('egg:found', { id: null, count: 0, total: EGGS.length }); }, 60000);

  // keys: Konami + typed words (never steals keys: the ride shortcuts still fire; side effects are undone on success)
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let seq = [], typed = '';
  let autoBeforeA = null;
  win.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    const tg = e.target; if (tg && (tg.isContentEditable || (tg.tagName === 'INPUT' && !/range|checkbox|radio|button/.test(tg.type)) || tg.tagName === 'TEXTAREA')) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 'b') autoBeforeA = state.todAuto;   // 'a' (auto day) fires next: remember the value to restore
    seq.push(k); if (seq.length > KONAMI.length) seq.shift();
    if (seq.length === KONAMI.length && seq.every((x, i) => x === KONAMI[i])) {
      seq = [];
      queueMicrotask(() => { if (autoBeforeA !== null && state.todAuto !== autoBeforeA) bus.emit('ui:tod', { auto: autoBeforeA }); });
      A.setBrown(!A.brown);
    }
    if (k.length === 1) {
      typed = (typed + k).slice(-8);
      if (typed.endsWith('gimini')) {
        typed = '';
        queueMicrotask(() => bus.emit('ui:sound', { on: !state.toggles.sound }));   // 'm' toggled the sound on the way: put it back
        velo();
      }
      if (typed.endsWith('bird')) { typed = ''; A.start('flight'); }
    }
  });
  function velo() {
    A.start('velo');
    if (state.coasting) return;
    bus.emit('ui:coast', { on: true });                  // the drivetrain jams: the cranks lock, the bike rolls on
    setTimeout(() => bus.emit('ui:coast', { on: false }), 2300);   // SNAP! the chain flies off and we pedal again
  }

  // bus: bell (cat, chorus), hop (puddle), gulp (UFO at night)
  const bells = [];
  bus.on('rig:event', ev => {
    const t = ev.t0;
    if (ev.type === 'bell') {
      bells.push(t); while (bells.length && t - bells[0] > 3.5) bells.shift();
      if (bells.length >= 7) { bells.length = 0; A.start('chorus'); }
      const b = A.bench;
      if (b && b.x > 60 && b.x < 1560 && b.k !== undefined && !(A.E.cat && t - A.E.cat.t0 < DUR.cat)) { A.catTake(b.k); A.start('cat', { x0: b.x }); }
    }
    if (ev.type === 'hop') A.hopT0 = t;
    if (ev.type === 'gulp') { const fr = A.frame(); if (fr && fr.night > 0.6 && !(A.E.ufo && t - A.E.ufo.t0 < DUR.ufo + 4)) A.start('ufo'); }
  });

  // clicks on the sky and the sea, hit-tested in each layer's own coordinates. The anchor is an egg element's parent
  // in that layer (never a hoisted strip, whose sheet carries a CSS translate), so its screen CTM is the layer's.
  const layerPt = (lid, e) => { const el = A.anchor[lid]; const m = el && el.getScreenCTM(); if (!m) return null; return new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()); };
  const shoots = [...svg.querySelectorAll('[data-ref^="sky-shoot"]')];
  const shootSeen = [];
  const watchShoots = () => {
    for (let i = 0; i < shoots.length; i++) {
      const o = +(shoots[i].getAttribute('opacity') || 0);
      if (o > 0.15) shootSeen[i] = { t: now(), box: shoots[i].getBoundingClientRect() };
    }
    win.requestAnimationFrame(watchShoots);
  };
  win.requestAnimationFrame(watchShoots);
  // the page corner: a click (or tap) in the bottom-right corner of the picture, unless it lands on a UI control
  const toVB = e => { const rc = svg.getBoundingClientRect(), [X0, Y0, X1, Y1] = A.box(); const s = rc.width / (X1 - X0 || 1); return [X0 + (e.clientX - rc.left) / s, Y0 + (e.clientY - rc.top) / s]; };
  const onCorner = e => { const [x, y] = toVB(e), [, , X1, Y1] = A.box(); return x > X1 - 96 && y > Y1 - 96 && (X1 - x) + (Y1 - y) < 130; };
  const isControl = el => el && el.closest && el.closest('button,a,input,select,textarea,label,[role="button"],[role="slider"],[role="switch"],[role="dialog"]');
  win.addEventListener('click', e => {
    if (isControl(e.target) || !onCorner(e)) return;
    turnPage();
  });
  win.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; const c = !isControl(e.target) && onCorner(e); if (c !== A.hot) { A.hot = c; svg.style.cursor = c ? 'pointer' : ''; } });
  let turnRaf = 0;
  function turnPage() {
    if (A.E.pageturn && now() - A.E.pageturn.t0 < DUR.pageturn) return;
    const tod0 = state.tod, tod1 = nextTod(tod0);
    A.start('pageturn', { tod0, tod1 });
    if (!live) return;                    // screenshot mode: renderAt owns the time of day
    // the new page's light comes in with the sweep of the curl
    const p0 = performance.now(), span = wrap(tod1 - tod0, 1);
    win.cancelAnimationFrame(turnRaf);
    const step = () => {
      const u = clamp((performance.now() - p0) / 1000 / TURN, 0, 1);
      bus.emit('ui:tod', { tod: wrap(tod0 + span * easeInOut(u), 1) });
      if (u < 1) turnRaf = win.requestAnimationFrame(step);
    };
    turnRaf = win.requestAnimationFrame(step);
  }
  svg.addEventListener('click', e => {
    const fr = A.frame(); if (!fr) return;
    if (onCorner(e)) return;
    for (const s of shootSeen) {
      if (!s || now() - s.t > 0.7) continue;
      const b = s.box, m = 70;
      if (e.clientX > b.left - m && e.clientX < b.right + m && e.clientY > b.top - m && e.clientY < b.bottom + m) {
        const p = layerPt('L-stars', e); if (p) { A.start('wish', { x: p.x, y: p.y }); return; }
      }
    }
    const ps = layerPt('L-sunmoon', e);
    if (ps) {
      if (fr.sun.elev > -0.08 && Math.hypot(ps.x - fr.sun.x, ps.y - fr.sun.y) < 95) { A.start('sunwink'); return; }
      if (fr.night > 0.3 && Math.hypot(ps.x - fr.moon.x, ps.y - fr.moon.y) < 60) { A.start('moonwink'); return; }
    }
    const b = A.bottle;
    if (b) {
      const p = layerPt('L-sea', e);
      if (p && Math.hypot(p.x - b.x, p.y - b.y) < 46) { openNote(b); }
    }
  });
  function openNote(b) {
    let nx = clamp(b.x, 230, 1370);
    if (nx > 510 && nx < 1070) nx = nx < 790 ? 510 : 1070;
    A.start('bottle', { nx, ny: 370 });
  }

  // ---- test API
  const trig = {
    brown: () => A.setBrown(true),
    velo: () => velo(),
    cat: () => { const b = A.bench; A.catTake(b ? b.k : -2); A.start('cat', { x0: b ? b.x : 1150 }); },
    km: () => A.start('km', { n: 1 }),
    fortytwo: () => A.start('fortytwo'),
    sunwink: () => A.start('sunwink'),
    moonwink: () => A.start('moonwink'),
    ufo: () => A.start('ufo'),
    chorus: () => A.start('chorus'),
    splash: () => { const fr = A.frame(); A.start('splash', { d0: fr ? fr.distance : 0, x0: RIDER_X }); },
    bottle: () => openNote(A.bottle || { x: 300, y: BOTTLE.y }),
    wish: () => A.start('wish', { x: 1180, y: 150 }),
    flight: () => A.start('flight'),
    pageturn: () => turnPage(),
    theend: () => A.start('theend'),
    bedtime: () => A.start('bedtime'),
  };
  return {
    list: EGGS.map(e => ({ ...e })),
    trigger(id) { if (!trig[id]) throw new Error('unknown egg ' + id); trig[id](); return [...A.found]; },
    found: () => [...A.found],
    stopAll() { for (const k in A.E) delete A.E[k]; if (A.brown) A.setBrown(false); },   // end running eggs (keeps found)
    reset() { A.found.clear(); try { localStorage.removeItem('pb-eggs'); } catch (e) { /* ignore */ } for (const k in A.E) delete A.E[k]; if (A.brown) A.setBrown(false); },
    setBrown: on => A.setBrown(on),
  };
}
