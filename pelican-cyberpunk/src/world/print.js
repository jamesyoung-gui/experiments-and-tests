// OWNER: print. The screen-fixed CYBERPUNK HUD FRAME in L-letterbox (depth null), STYLE-X §8:
//  · the frame: cyan corner brackets with a magenta inner offset, hairline keylines, edge rulers with a centre notch,
//    inward chevrons at the side midpoints, and tiny rotated corner codes along the bracket arms;
//  · the intro title "NEON PELICAN" (DejaVu Sans Bold) + 鹈鹕湾 tag: glitch-lettered as geometry (a chromatic cyan /
//    magenta split, horizontally displaced slices, cut scanlines inside the face). It BOOTS: the brackets snap in, a
//    scan beam sweeps the screen, every letter decodes through scramble glyphs and locks, the split converges, the tag
//    slams in, the subtitle types on. After ~3.5 s it shrinks into the corner HUD logo. Every frame the card is fitted
//    into the free space around the rider's screen box (frame.cam + pose), so it never covers the bird;
//  · the mission panel: "▶ MISSION ACTIVE", ETA to the end of the stretch, a progress bar, the per-stretch caption
//    "DELIVERY 06 · 灯塔角 / DATA SPIRE" + a witty brief line, a barcode; under it the minimap strip of the whole
//    26 km loop (12 districts with pictograms, km scale, current district, the rider's marker, lap + km counters);
//  · the status readouts: signal bars + 霓虹网 NEON-NET, a battery that drains over the lap and charges at home,
//    ● REC with the clock (from the time of day), weather word + humidity + temperature (from frame.weather);
//  · a target reticle that tracks the rider's head (brackets OUTSIDE the head + bill box) with its courier tag;
//  · the cinematic letterbox becomes two HUD BARS (void, scanlines, neon edge, tick ruler, hazard ends); the logo and
//    mission panel dock into the top bar, the readouts and a slow news ticker into the bottom bar;
//  · a rare, brief glitch transition (tear bands + frame jitter + slice jumps), on district changes into / out of
//    the tunnel, at the lap start and at seeded moments (~ every 40 s, 0.24 s long); the caption swaps with a split.
// Performance: no filters anywhere (the glow is stacked strokes); only transforms, opacity and <use> href swaps per
// frame, each written only when its value changes; the scanline texture is a static <pattern> on panels and bars.
// All lettering is path data (print-glyphs.js, generated offline by print-glyphs.gen.mjs); no runtime fonts.
import { fmt2 } from '../core/math.js';
import { h } from '../core/svg.js';
import { VIEW, RIDER_X, GROUND_Y, CAMERAS } from '../contract.js';
import { STRETCHES, LAP, KM, hash } from './route.js';
import * as G from './print-glyphs.js';

export const id = 'print';

const LAT = G.LAT || {}, SANS = G.SANS || {}, MONO = G.MONO || {}, ZH = G.ZH || {};
const FACES = { LAT, SANS, MONO, ZH };
const TD = 'typography_frame';
const f = fmt2;
const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - (1 - t) ** 3;
const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
const backOut = t => { const c = 1.9; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
const wrapM = (x, m) => ((x % m) + m) % m;

// ------------------------------------------------------------------ path geometry helpers (build time only)
// Affine-transform an absolute SVG path (M L H V Q C A Z). m = [a b c d e f]: x' = a·x + c·y + e, y' = b·x + d·y + f.
function tp(d, m) {
  const tok = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) || [];
  const P = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const det = m[0] * m[3] - m[1] * m[2], sc = Math.sqrt(Math.abs(det)), ang = Math.atan2(m[1], m[0]) * 180 / Math.PI;
  let i = 0, cmd = '', cx = 0, cy = 0, out = '';
  const num = () => +tok[i++];
  const pt = (x, y) => { const [X, Y] = P(x, y); return `${f(X)} ${f(Y)}`; };
  while (i < tok.length) {
    if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
    switch (cmd) {
      case 'M': case 'L': { cx = num(); cy = num(); out += cmd + pt(cx, cy); if (cmd === 'M') cmd = 'L'; break; }
      case 'H': cx = num(); out += 'L' + pt(cx, cy); break;
      case 'V': cy = num(); out += 'L' + pt(cx, cy); break;
      case 'Q': { const a = pt(num(), num()); cx = num(); cy = num(); out += `Q${a} ${pt(cx, cy)}`; break; }
      case 'C': { const a = pt(num(), num()), b = pt(num(), num()); cx = num(); cy = num(); out += `C${a} ${b} ${pt(cx, cy)}`; break; }
      case 'A': {
        const rx = num(), ry = num(), rot = num(), la = num(), sw = num(); cx = num(); cy = num();
        out += `A${f(rx * sc)} ${f(ry * sc)} ${f(rot + ang)} ${la} ${det < 0 ? 1 - sw : sw} ${pt(cx, cy)}`; break;
      }
      case 'Z': case 'z': out += 'Z'; cmd = ''; break;
      default: throw new Error('print: unsupported path token ' + tok[i]);
    }
  }
  return out;
}
const circ = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const rectD = (x, y, w, hh) => `M${f(x)} ${f(y)}h${f(w)}v${f(hh)}h${f(-w)}Z`;
const poly = pts => 'M' + pts.map(p => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';
const hlines = (x0, x1, y0, y1, step) => { let d = ''; for (let y = y0; y <= y1 + 1e-6; y += step) d += `M${f(x0)} ${f(y)}H${f(x1)}`; return d; };

// ------------------------------------------------------------------ lettering
// Mixed runs: CJK / kana / full-width -> ZH (WenQuanYi), everything else -> the run's Latin face. em 1000, y down.
export const isZH = ch => ch.codePointAt(0) >= 0x2e80;
const SPACE = { LAT: 348, SANS: 318, MONO: 602, ZH: 500 };
const SLOT = '¤';                       // a digit slot in a template: skipped, its pen x is reported
const USED = { LAT: new Set(), SANS: new Set(), MONO: new Set(), ZH: new Set() };
let COLLECT = false;                    // print-glyphs.gen.mjs: collect the characters instead of throwing
function glyph(face, ch) {
  const key = isZH(ch) ? 'ZH' : face;
  USED[key].add(ch);
  const g = FACES[key][ch];
  if (!g && !COLLECT) throw new Error(`print: no ${key} glyph for "${ch}" (run node src/world/print-glyphs.gen.mjs)`);
  return [key, g || [600, '']];
}
// -> { d, w, slots:[x…] }. zs: CJK scale in a Latin run (WenQuanYi's ideographs are taller than the Latin caps).
function text(face, str, { size = 10, x = 0, y = 0, track = 0, sx = 1, align = 'left', zs = 0.9, zy = -0.03 } = {}) {
  const k = size / 1000, ch = [...str];
  const adv = c => {
    if (c === ' ') return SPACE[face] * k * sx;
    if (c === SLOT) return 602 * k * sx;
    const [key, g] = glyph(face, c);
    return g[0] * k * sx * (key === 'ZH' && face !== 'ZH' ? zs : 1);
  };
  const w = ch.reduce((s, c, i) => s + adv(c) + (i < ch.length - 1 ? track : 0), 0);
  let pen = align === 'center' ? -w / 2 : align === 'right' ? -w : 0, d = '';
  const slots = [];
  for (const c of ch) {
    if (c === SLOT) slots.push(x + pen);
    else if (c !== ' ') {
      const [key, g] = glyph(face, c);
      const z = key === 'ZH' && face !== 'ZH' ? zs : 1;
      if (g[1]) d += tp(g[1], [k * sx * z, 0, 0, k * z, x + pen, y + (z !== 1 ? zy * size : 0)]);
    }
    pen += adv(c) + track;
  }
  return { d, w, slots };
}

// ------------------------------------------------------------------ copy (every string the HUD prints)
// per route stretch: [中文, English, brief]; lighthouse keeps its old name 灯塔角 on the caption (STYLE-X brief)
const MISSIONS = {
  village: ['鹈鹕湾', 'PELICAN BAY', 'PICKUP 鱼丸 FISHBALL ×12 · TIP ¥88'],
  pier: ['无人机码头', 'DRONE DOCK', 'HANDOFF TO DRONE 07 · 请勿喂食 NO FEEDING'],
  harbour: ['渔港', 'NEON FISH PORT', 'FRESH CATCH · HOLO-FISH NOT EDIBLE'],
  funfair: ['游戏厅', 'ARCADE ROW', 'DODGE THE KOI · 投币 INSERT COIN'],
  railway: ['磁浮线', 'MAGLEV LINE', 'RACE THE MAGLEV · 请勿追车 DO NOT CHASE'],
  lighthouse: ['灯塔角', 'DATA SPIRE', 'UPLINK 99% · SEARCHLIGHT SWEEP · DUCK'],
  cliffs: ['霓虹隧道', 'NEON TUNNEL', 'NO SIGNAL · 信号弱 · KEEP PEDALLING'],
  dunes: ['废料场', 'SCRAPYARD', 'SALVAGE 1 CHROME NAIL · 小心 MIND THE GAP'],
  bridge: ['天桥', 'SKYBRIDGE', 'WIND 2 KN · CALM AS A KOI POND'],
  fort: ['古庙', 'OLD TEMPLE', 'LIGHT INCENSE · 保佑外卖 BLESS THE FISH'],
  pines: ['水培园', 'HYDRO GARDEN', 'GROW LIGHTS 420NM · 水培 · BREATHE IN'],
  return: ['鹈鹕湾', 'PELICAN BAY', 'DROP-OFF · 30 MIN OR THE FISH IS FREE'],
};
const CAPTION = s => `DELIVERY ${String(s.i + 1).padStart(2, '0')} · ${MISSIONS[s.key][0]} / ${MISSIONS[s.key][1]}`;
const WEATHER = { clear: '晴 CLEAR', drizzle: '小雨 DRIZZLE', fog: '雾 FOG', rain: '雨 RAIN', storm: '暴雨 STORM' };
const CODES = { TL: 'SYS.OK // NP-07', TR: 'CAM A · LIVE FEED', BL: '22.28°N 114.16°E', BR: 'BUILD X.2026.09.30' };
const TICKER = '霓虹快讯 NEON NEWS // FISH PRICES +3% // DRONE LANE 7 CLOSED FOR RAIN // 鹈鹕外卖 PELICAN EXPRESS: 30 MIN OR THE FISH IS FREE // MAGLEV LINE 7 ON TIME 准点 // 禁止鹈鹕 NO PELICANS BEYOND THIS POINT (JUST KIDDING) // ACID RAIN 72% TONIGHT · BRING AN UMBRELLA // ';
const TITLE = 'NEON PELICAN';
const SCRAMBLE = '#%&@$0123456789XZ';

// ------------------------------------------------------------------ geometry constants (screen / viewBox units)
const M = 14;                                      // bracket inset from the visible edge (and from the bars)
const ARM = 46;                                    // bracket arm length
const LB_MAX = CAMERAS.cinematic.letterbox;
const TT = { size: 76, sx: 1.14, track: 5 };       // title face
const TAG = { w: 160, h: 60 };
// title letters (the same pen as text(): positions for the per-letter <use> slots)
function titleLetters() {
  const k = TT.size / 1000; let pen = 0; const out = [];
  for (const c of TITLE) {
    if (c === ' ') { pen += SPACE.LAT * k * TT.sx + TT.track; continue; }
    const [, g] = glyph('LAT', c); out.push({ c, x: pen }); pen += g[0] * k * TT.sx + TT.track;
  }
  return { letters: out, w: pen - TT.track };
}
// glitch slices of the title face: [y0, y1, dx] in word units (baseline 0, cap top ≈ −55)
const BANDS = [[-48, -45, 4], [-37, -31.5, 9], [-20, -16, -6], [-8.5, -6.5, 3]];
const PW = 404, PH = 72, MH = 54, MGAP = 8;        // mission panel / minimap
const BLOCK = { w: PW, h: PH + MGAP + MH };
const RW = 322, RH = 48;                           // readouts
const KMS = 26;

export const detailItems = [
  ['hud-bracket', 'O', 'cyan corner brackets with stacked-stroke glow, a magenta inner offset L, corner nubs and dash ticks'],
  ['frame-keyline', 'O', 'hairline cyan keylines joining the brackets (the frame of the feed)'],
  ['edge-ruler', 'O', 'tick rulers centred on the top and bottom edges: minor/major ticks, magenta centre notch'],
  ['edge-chevron', 'O', 'inward chevron stacks with a bar at the middle of each side'],
  ['corner-codes', 'O', 'rotated micro codes along the bracket arms: SYS.OK // NP-07 · CAM A · LIVE FEED · 22.28°N 114.16°E · BUILD'],
  ['scanlines', 'T', 'static scanline texture on every HUD panel and bar'],
  ['title-face', 'O', 'NEON PELICAN in wide DejaVu Sans Bold capitals, cool white face'],
  ['title-chroma', 'T', 'chromatic aberration: cyan and magenta copies split left/right behind the face'],
  ['title-slice', 'O', 'glitch slices: four horizontal bands of the face displaced sideways'],
  ['title-scan', 'T', 'dark scanlines cut through the title face'],
  ['title-rule', 'O', 'magenta rule under the title with acid data blocks and ticks'],
  ['title-tag', 'O', '鹈鹕湾 tag: chamfered magenta plate, keyline, drop-shadowed CJK'],
  ['title-kana', 'O', 'katakana ペリカン・ベイ under the tag'],
  ['title-sub', 'O', 'monospace subtitle PELICAN BAY · 霓虹区 NEON DISTRICT · ネオン with a block cursor'],
  ['edition-code', 'O', 'edition line EDITION X · 霓虹版 · BUILD 2026.09.30 · NODE 0719'],
  ['mission-panel', 'O', 'chamfered translucent mission panel with neon border, magenta accent bar and acid stud'],
  ['mission-status', 'O', '▶ MISSION ACTIVE status (UPLINK LOST in the tunnel)'],
  ['mission-eta', 'O', 'ETA mm:ss to the end of the district, live digits'],
  ['mission-progress', 'O', 'progress bar through the district with tick scale'],
  ['mission-caption', 'O', 'per-district caption DELIVERY nn · 中文 / ENGLISH (12 districts)'],
  ['mission-brief', 'O', 'per-district brief line (PICKUP 鱼丸 ×12 · TIP ¥88 …)'],
  ['mission-barcode', 'T', 'seeded barcode + parcel number on the mission panel'],
  ['minimap-frame', 'O', 'minimap strip frame: ROUTE // 霓虹环线 NEON LOOP, LAP and KM counters'],
  ['minimap-track', 'O', 'the 26 km loop as 12 district segments with station dots'],
  ['minimap-icons', 'O', 'district pictograms: ramen bowl, drone, crane, koi, maglev, spire, tunnel, scrap, skybridge, temple, leaf, home flag'],
  ['minimap-scale', 'O', 'km ticks and 0 · 5 · 10 · 15 · 20 · 26 labels'],
  ['minimap-current', 'O', 'current district highlight and visited trail'],
  ['minimap-marker', 'O', 'the rider marker: ring, dot and pointer at the live lap position'],
  ['signal-bars', 'O', 'five signal bars (drop to one in the tunnel) + SIGNAL label'],
  ['net-id', 'O', 'carrier 霓虹网 NEON-NET 5G'],
  ['battery', 'O', 'battery with nub, five cells, live %, charging bolt at home'],
  ['rec-time', 'O', '● REC and the clock hh:mm:ss (from the time of day)'],
  ['weather-readout', 'O', 'weather icon + word (晴 CLEAR / 霾 SMOG / 雾 FOG / 雨 RAIN / 暴雨 STORM) + humidity % + °C'],
  ['target-reticle', 'O', 'corner brackets tracking the rider\'s head, outside the head + bill box'],
  ['target-label', 'O', 'courier tag COURIER 鹈鹕 #0719 on a leader line'],
  ['hud-bar', 'O', 'cinematic letterbox as HUD bars: void, neon double edge, tick ruler'],
  ['bar-hazard', 'T', 'hazard stripes at the ends of the HUD bars'],
  ['bar-ticker', 'O', 'slow news ticker in the bottom bar (霓虹快讯 NEON NEWS …)'],
  ['glitch-tear', 'T', 'rare glitch transition: tear bands and scanline blocks'],
].map(([name, kind, what]) => ({ id: `${TD}:${kind}:${name}`, layer: TD, kind, what }));
const DD = Object.fromEntries(detailItems.map(d => [d.id.split(':')[2], d.id]));

// the title layouts, card-local (word baseline at y = 0): pose per group {x, y}; box [x0 y0 x1 y1]
let LAYOUTS = null, TL = null, SUBW = 0, EDW = 0, TICK_W = 1000, CODEW = {};
function layouts() {
  TL = titleLetters();
  const W = TL.w;
  SUBW = text('MONO', 'PELICAN BAY · 霓虹区 NEON DISTRICT · ネオン', { size: 12.5, track: 3.2 }).w + 14;
  EDW = text('MONO', 'EDITION X · 霓虹版 · BUILD 2026.09.30 · NODE 0719', { size: 7.4, track: 1.5 }).w;
  const lineW = Math.max(W + 24 + TAG.w, SUBW, EDW) + 12;
  TICK_W = text('MONO', TICKER, { size: 8.6, track: 1.6 }).w + 30;
  for (const c of ['TL', 'TR', 'BL', 'BR']) CODEW[c] = text('MONO', CODES[c], { size: 6.2, track: 1.1 }).w;
  LAYOUTS = {
    line: { w: { x: 0, y: 0 }, tag: { x: W + 24, y: 0 }, sub: { x: 0, y: 40 }, ed: { x: 0, y: 58 }, box: [-12, -68, lineW, 64] },
    stack: { w: { x: 0, y: 0 }, tag: { x: 0, y: 82 }, sub: { x: 0, y: 128 }, ed: { x: 0, y: 146 }, box: [-12, -68, Math.max(W, SUBW, EDW) + 12, 152] },
    logo: { w: { x: 0, y: 0 }, tag: { x: W + 24, y: 0 }, sub: { x: 0, y: 40 }, ed: { x: 0, y: 58 }, box: [-12, -68, lineW, 46] },
  };
}

// ------------------------------------------------------------------ minimap pictograms (8 × 8, centred, stroke)
const ICON = {
  village: 'M-4 -1H4A4 3.4 0 0 1 -4 -1ZM-2 -3V-5M0 -3.4V-5.6M2 -3V-5M-3 3H3',
  pier: 'M-2 -1H2V1H-2ZM-4.5 -3H-1.5M1.5 -3H4.5M-3 -3V-1M3 -3V-1M0 1V3',
  harbour: 'M-3 4V-4H4M-3 -2.5L-0.5 -4M3 -4V0M2 0H4',
  funfair: 'M-4 0Q-1 -3.4 2.4 0Q-1 3.4 -4 0ZM2.4 0L4.4 -2V2ZM-1.6 -0.6V0.4',
  railway: 'M-4.5 2.5V-1Q-4.5 -3 -2 -3H3Q4.5 -3 4.5 -1V2.5ZM-3 -1H-1M0.5 -1H2.5M-4 4H4',
  lighthouse: 'M-1.4 4L0 -4.5L1.4 4ZM1 -3.5L4.5 -5M1 -2.5L4.5 -1.6M-3 4H3',
  cliffs: 'M-4.5 4V0A4.5 4.5 0 0 1 4.5 0V4M-2.4 4V0.6A2.4 2.4 0 0 1 2.4 0.6V4',
  dunes: 'M-4.5 3.5L-1.5 -1.5L0.5 1L2.5 -2.5L4.5 3.5ZM-4.5 3.5H4.5',
  bridge: 'M-4.5 2H4.5M0 -4V2M0 -4L-4 2M0 -4L4 2M0 -4L-2 2M0 -4L2 2',
  fort: 'M-4.5 -1Q0 -5.4 4.5 -1ZM-3 -1V3.5M3 -1V3.5M-4 3.5H4M-1 3.5V1H1V3.5',
  pines: 'M0 4V-1M0 -1Q-4 -2 -3 -5Q1 -5 0 -1ZM0 0.5Q3.5 0 3.5 -3Q0.5 -2.6 0 0.5Z',
  return: 'M-2.5 4V-4.5M-2.5 -4.5L3.5 -2.6L-2.5 -0.8M-4 4H1',
};

// ------------------------------------------------------------------ build
export function build(ctx) {
  const { v } = ctx;
  if (!LAYOUTS) layouts();
  const C = {
    cyan: v('cyan'), mag: v('magenta'), acid: v('acid'), amber: v('amber'), red: v('red'), core: v('cyanCore'), mcore: v('magentaCore'),
    plume: v('inkP'), void: v('inkN'), haze: v('inkB'),
  };
  const tag = (name, attrs, ...kids) => h('g', { 'data-detail': DD[name], ...attrs }, ...kids);
  const txt = (s, attrs = {}) => ({ 'data-text': s, ...attrs });
  const defs = [];
  const P = (d, attrs) => h('path', { d, ...attrs });

  // ---- shared textures ----
  defs.push(h('pattern', { id: 'print-scan', width: 12, height: 3, patternUnits: 'userSpaceOnUse' },
    h('rect', { width: 12, height: 1, fill: C.cyan, 'fill-opacity': 0.075 })));
  defs.push(h('pattern', { id: 'print-scan-dark', width: 12, height: 3, patternUnits: 'userSpaceOnUse' },
    h('rect', { width: 12, height: 1.1, fill: C.void, 'fill-opacity': 0.5 })));
  defs.push(h('pattern', { id: 'print-ticks', width: 20, height: 8, patternUnits: 'userSpaceOnUse' },
    h('rect', { width: 1, height: 3, fill: C.cyan }), h('rect', { x: 10, width: 1, height: 1.6, fill: C.cyan })));
  defs.push(h('pattern', { id: 'print-hazard', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
    h('rect', { width: 4, height: 8, fill: C.amber })));
  // MONO digit glyphs for the live slots (em 1000; each slot is a <use> scaled to its size)
  for (let dg = 0; dg <= 9; dg++) defs.push(P(glyph('MONO', String(dg))[1][1], { id: 'print-dm-' + dg }));
  const slotUses = (prefix, xs, y, size, attrs = {}) => xs.map((x, i) =>
    h('use', { href: '#print-dm-0', 'data-ref': `print-${prefix}${i}`, transform: `translate(${f(x)} ${f(y)}) scale(${f(size / 1000)})`, ...attrs }));

  // ================================================================ FRAME
  const corner = h('g', { id: 'print-corner' },
    P(`M0 ${ARM}V0H${ARM}`, { fill: 'none', stroke: C.cyan, 'stroke-width': 6, 'stroke-opacity': 0.14 }),
    P(`M0 ${ARM}V0H${ARM}`, { fill: 'none', stroke: C.cyan, 'stroke-width': 2 }),
    P(`M5 ${ARM - 20}V5H${ARM - 20}`, { fill: 'none', stroke: C.mag, 'stroke-width': 1.2 }),
    P(rectD(-2.5, -2.5, 5, 5) + rectD(ARM + 4, -1, 4, 2) + rectD(ARM + 11, -1, 2.5, 2) + rectD(-1, ARM + 4, 2, 4) + rectD(-1, ARM + 11, 2, 2.5), { fill: C.core }),
    P(poly([[9, 9], [15, 9], [9, 15]]), { fill: C.cyan, 'fill-opacity': 0.8 }));
  defs.push(corner);
  // edge ruler: centred at (0,0) on the keyline, ticks toward +y
  let rt = '';
  for (let x = -160; x <= 160; x += 8) { const maj = x % 40 === 0; rt += rectD(x - 0.5, 0, 1, maj ? 7 : 3.5); }
  defs.push(h('g', { id: 'print-ruler' },
    P(rt, { fill: C.cyan, 'fill-opacity': 0.7 }),
    P(rectD(-160, 0, 320, 1), { fill: C.cyan, 'fill-opacity': 0.55 }),
    P(poly([[-7, 0], [7, 0], [0, 9]]), { fill: C.mag }),
    P(rectD(-196, -0.5, 26, 2) + rectD(170, -0.5, 26, 2), { fill: C.mag, 'fill-opacity': 0.8 })));
  // side chevrons: centred at (0,0) on the left keyline, pointing inward (+x)
  const chev = (x) => `M${x} -9L${x + 7} 0L${x} 9L${x + 3} 9L${x + 10} 0L${x + 3} -9Z`;
  defs.push(h('g', { id: 'print-chev' },
    P(chev(6) + chev(15), { fill: C.cyan, 'fill-opacity': 0.75 }),
    P(chev(24), { fill: C.mag }),
    P(rectD(0, -26, 2, 52), { fill: C.cyan }),
    P(rectD(0, -36, 1, 6) + rectD(0, 30, 1, 6), { fill: C.cyan, 'fill-opacity': 0.6 })));
  const codes = {};
  for (const k of ['TL', 'TR', 'BL', 'BR']) codes[k] = text('MONO', CODES[k], { size: 6.2, track: 1.1 });
  const unit = (ref, fill, item, op = 1) => h('rect', { 'data-ref': ref, 'data-detail': DD[item], x: 0, y: 0, width: 1, height: 1, fill, 'fill-opacity': op });
  const frame = h('g', { id: 'print-frame', 'data-ref': 'print-frame' },
    ['kT', 'kB', 'kL', 'kR'].map(k => unit('print-' + k, C.cyan, 'frame-keyline', 0.42)),
    ['TL', 'TR', 'BL', 'BR'].map(k => h('use', { href: '#print-corner', 'data-ref': 'print-c' + k, 'data-detail': DD['hud-bracket'] })),
    ['T', 'B'].map(k => h('use', { href: '#print-ruler', 'data-ref': 'print-r' + k, 'data-detail': DD['edge-ruler'] })),
    ['L', 'R'].map(k => h('use', { href: '#print-chev', 'data-ref': 'print-e' + k, 'data-detail': DD['edge-chevron'] })),
    ['TL', 'TR', 'BL', 'BR'].map(k => tag('corner-codes', txt(CODES[k], { 'data-ref': 'print-code' + k }), P(codes[k].d, { fill: C.cyan, 'fill-opacity': 0.72 }))));

  // ================================================================ CINEMATIC HUD BARS (bar edge at y = 0, bar toward −y)
  const hudBar = k => h('g', { 'data-ref': 'print-bar' + k, display: 'none' },
    tag('hud-bar', {},
      h('rect', { x: -1400, y: -1400, width: 4400, height: 1400, fill: C.void }),
      h('rect', { x: -1400, y: -1400, width: 4400, height: 1400, fill: 'url(#print-scan)' }),
      h('rect', { x: -1400, y: -2.5, width: 4400, height: 1.6, fill: C.cyan }),
      h('rect', { x: -1400, y: -7, width: 4400, height: 1, fill: C.mag, 'fill-opacity': 0.85 }),
      h('rect', { x: -1400, y: -4, width: 4400, height: 5, fill: C.cyan, 'fill-opacity': 0.1 }),
      h('rect', { x: -1400, y: -17, width: 4400, height: 8, fill: 'url(#print-ticks)', opacity: 0.45 })),
    ['L', 'R'].map(s => tag('bar-hazard', { 'data-ref': `print-hz${k}${s}` },
      h('rect', { x: 0, y: -15, width: 64, height: 6, fill: 'url(#print-hazard)' }),
      h('rect', { x: 0, y: -15, width: 64, height: 6, fill: 'none', stroke: C.amber, 'stroke-width': 0.6 }))));
  const tick = text('MONO', TICKER, { size: 8.6, track: 1.6 });
  TICK_W = tick.w + 30;
  defs.push(h('clipPath', { id: 'print-clip-ticker' }, h('rect', { 'data-ref': 'print-tickclip', x: 0, y: 0, width: 1, height: 1 })));
  const ticker = h('g', { 'data-ref': 'print-ticker', 'clip-path': 'url(#print-clip-ticker)', display: 'none' },
    tag('bar-ticker', txt(TICKER), h('g', { 'data-ref': 'print-tickmove' },
      P(tick.d + tp(tick.d, [1, 0, 0, 1, TICK_W, 0]), { fill: C.cyan, 'fill-opacity': 0.85 }))));

  // ================================================================ TITLE
  const W = TL.w, k = TT.size / 1000;
  const glyphChars = [...new Set([...TITLE.replace(/ /g, ''), ...SCRAMBLE])];
  for (const c of glyphChars) defs.push(P(glyph('LAT', c)[1][1], { id: 'print-gl-' + c.charCodeAt(0) }));
  defs.push(h('g', { id: 'print-tw' }, TL.letters.map((L, i) =>
    h('use', { href: '#print-gl-' + L.c.charCodeAt(0), 'data-ref': 'print-tl' + i, transform: `translate(${f(L.x)} 0) scale(${f(k * TT.sx)} ${f(k)})` }))));
  const faceD = text('LAT', TITLE, { size: TT.size, sx: TT.sx, track: TT.track }).d;
  defs.push(h('clipPath', { id: 'print-clip-glyph' }, P(faceD)));
  // complement of the bands
  let bodyClip = '', yPrev = -90;
  for (const [y0, y1] of BANDS) { bodyClip += rectD(-40, yPrev, W + 80, y0 - yPrev); yPrev = y1; }
  bodyClip += rectD(-40, yPrev, W + 80, 40 - yPrev);
  defs.push(h('clipPath', { id: 'print-clip-body' }, P(bodyClip)));
  BANDS.forEach(([y0, y1], i) => defs.push(h('clipPath', { id: 'print-clip-band' + i }, P(rectD(-40, y0, W + 80, y1 - y0)))));
  const ruleBlocks = [0, 1, 2, 3].map(i => rectD(W - 54 + i * 13, 9, 9, 4)).join('');
  let ruleTicks = ''; for (let x = 0; x <= W - 70; x += 24) ruleTicks += rectD(x, 14, 1, 3);
  const word = h('g', { 'data-ref': 'print-w', 'data-text': TITLE },
    h('g', { 'data-ref': 'print-wv' },
      h('use', { href: '#print-tw', fill: 'none', stroke: C.mag, 'stroke-width': 11, 'stroke-opacity': 0.12, 'stroke-linejoin': 'round' }),
      tag('title-chroma', {},
        h('use', { href: '#print-tw', 'data-ref': 'print-chc', fill: C.cyan, transform: 'translate(-3.2 0.6)' }),
        h('use', { href: '#print-tw', 'data-ref': 'print-chm', fill: C.mag, transform: 'translate(3.4 -0.4)' })),
      h('g', { 'clip-path': 'url(#print-clip-body)' }, h('use', { href: '#print-tw', fill: C.core, 'data-detail': DD['title-face'] })),
      tag('title-slice', {}, BANDS.map(([, , dx], i) => h('g', { 'clip-path': `url(#print-clip-band${i})` },
        h('use', { href: '#print-tw', fill: C.core, 'data-ref': 'print-band' + i, transform: `translate(${dx} 0)` })))),
      tag('title-scan', { 'data-ref': 'print-wscan', 'clip-path': 'url(#print-clip-glyph)' },
        P(hlines(-10, W + 10, -56, 2, 5.2), { stroke: C.void, 'stroke-width': 0.8, 'stroke-opacity': 0.26, fill: 'none' }))),
    tag('title-rule', { 'data-ref': 'print-rule' },
      P(rectD(0, 10, W - 70, 2), { fill: C.mag }), P(ruleBlocks, { fill: C.acid }), P(ruleTicks, { fill: C.mag, 'fill-opacity': 0.7 })));
  // 鹈鹕湾 tag (local: top −58, bottom +2) + kana
  const TW = TAG.w, TH = TAG.h;
  const plate = poly([[0, -58], [TW, -58], [TW, 2 - 12], [TW - 12, 2], [0, 2]]);
  const zhTag = text('ZH', '鹈鹕湾', { size: 44, track: 5, x: TW / 2, y: -12, align: 'center' }).d;
  const kana = text('ZH', 'ペリカン・ベイ', { size: 12, track: 2.2, x: 1, y: 20 });
  const tagG = h('g', { 'data-ref': 'print-tag' }, h('g', { 'data-ref': 'print-tagin' },
    tag('title-tag', txt('鹈鹕湾'),
      P(plate, { fill: 'none', stroke: C.mag, 'stroke-width': 9, 'stroke-opacity': 0.16, 'stroke-linejoin': 'round' }),
      P(plate, { fill: C.mag }),
      P(poly([[4, -54], [TW - 4, -54], [TW - 4, -12], [TW - 14, -2], [4, -2]]), { fill: 'none', stroke: C.void, 'stroke-width': 1, 'stroke-opacity': 0.7 }),
      P(tp(zhTag, [1, 0, 0, 1, 2, 2]), { fill: C.void, 'fill-opacity': 0.8 }),
      P(zhTag, { fill: C.mcore }),
      P(rectD(TW - 30, -54, 22, 3), { fill: C.void, 'fill-opacity': 0.75 })),
    tag('title-kana', txt('ペリカン・ベイ'), P(kana.d, { fill: C.mag }), P(rectD(kana.w + 8, 13, TW - kana.w - 8, 1.4), { fill: C.mag, 'fill-opacity': 0.6 }))));
  const subT = text('MONO', 'PELICAN BAY · 霓虹区 NEON DISTRICT · ネオン', { size: 12.5, track: 3.2 });
  defs.push(h('clipPath', { id: 'print-clip-sub' }, h('rect', { 'data-ref': 'print-subclip', x: -4, y: -20, width: SUBW + 10, height: 30 })));
  const subG = h('g', { 'data-ref': 'print-sub' },
    tag('title-sub', txt('PELICAN BAY · 霓虹区 NEON DISTRICT · ネオン'),
      h('g', { 'clip-path': 'url(#print-clip-sub)' }, P(subT.d, { fill: C.cyan })),
      h('rect', { 'data-ref': 'print-cursor', x: subT.w + 5, y: -10.5, width: 7, height: 12.5, fill: C.cyan })));
  const edT = text('MONO', 'EDITION X · 霓虹版 · BUILD 2026.09.30 · NODE 0719', { size: 7.4, track: 1.5 });
  const edG = h('g', { 'data-ref': 'print-ed' }, tag('edition-code', txt('EDITION X · 霓虹版 · BUILD 2026.09.30 · NODE 0719'),
    P(edT.d, { fill: C.cyan, 'fill-opacity': 0.62 }), P(rectD(edT.w + 8, -5, 4, 4) + rectD(edT.w + 14, -5, 4, 4), { fill: C.acid, 'fill-opacity': 0.8 })));
  const title = h('g', { id: 'print-title', 'data-ref': 'print-title' }, word, tagG, subG, edG);

  // ================================================================ MISSION PANEL + MINIMAP (block-local, top-left 0,0)
  const panel = poly([[0, 0], [PW - 12, 0], [PW, 12], [PW, PH], [14, PH], [0, PH - 14]]);
  const capW = Math.max(...STRETCHES.map(s => text('SANS', CAPTION(s), { size: 16, track: 0.4 }).w));
  const capSX = Math.min(1, (PW - 30) / capW);
  for (const s of STRETCHES) {
    const c = text('SANS', CAPTION(s), { size: 16, track: 0.4, sx: capSX, zs: 0.92 });
    const b = text('MONO', MISSIONS[s.key][2], { size: 7.6, track: 0.9 });
    const bsx = Math.min(1, 292 / b.w);
    defs.push(P(c.d, { id: 'print-cap' + s.i }));
    defs.push(P(bsx < 1 ? tp(b.d, [bsx, 0, 0, 1, 0, 0]) : b.d, { id: 'print-brf' + s.i }));
  }
  const status = text('MONO', 'MISSION ACTIVE', { size: 9.5, track: 1.8, x: 27, y: 19 });
  const lost = text('MONO', 'UPLINK LOST · 信号弱', { size: 9.5, track: 1.8, x: 27, y: 19 });
  const eta = text('MONO', `ETA ${SLOT}${SLOT}:${SLOT}${SLOT}`, { size: 8.6, track: 1, x: PW - 16, y: 18.5, align: 'right' });
  let bar = ''; for (let i = 0; i <= 10; i++) bar += rectD(PW - 136 + i * 12, 29, 0.8, i % 5 ? 1.6 : 2.6);
  // barcode (seeded, deterministic)
  let bc = '', bx = PW - 76;
  for (let i = 0; bx < PW - 18; i++) { const w = 0.7 + 1.6 * hash(i, 719); bc += rectD(bx, 50, w, 10); bx += w + 0.8 + 1.2 * hash(i, 83); }
  const bcN = text('MONO', '#0719', { size: 5.6, track: 1.1, x: PW - 47, y: 66.5, align: 'center' }).d;
  // minimap
  const Y0 = PH + MGAP, TX0 = 14, TXW = PW - 28, TY = Y0 + 33;
  const kx = km => TX0 + TXW * km / KMS;
  let seg = '', dots = '', icons = '', kmt = '';
  for (const s of STRETCHES) { seg += rectD(kx(s.kmA) + 1, TY - 1, kx(s.kmB) - kx(s.kmA) - 2, 2); dots += circ(kx(s.kmA), TY, 1.9); icons += tp(ICON[s.key], [1.3, 0, 0, 1.3, (kx(s.kmA) + kx(s.kmB)) / 2, TY - 12.5]); }
  dots += circ(kx(KMS), TY, 1.9);
  for (let km = 0; km <= KMS; km++) kmt += rectD(kx(km) - 0.4, TY + 3.5, 0.8, km % 5 === 0 || km === KMS ? 3 : 1.6);
  const kmLab = [0, 5, 10, 15, 20, 26].map(km => text('MONO', String(km), { size: 6.2, x: kx(km), y: TY + 15.5, align: 'center' }).d).join('');
  const mmLab = text('MONO', 'ROUTE // 霓虹环线 NEON LOOP', { size: 6.8, track: 1.3, x: 10, y: Y0 + 10.5 });
  const mmCnt = text('MONO', `LAP ${SLOT}${SLOT} · KM ${SLOT}${SLOT}.${SLOT}`, { size: 6.8, track: 1.3, x: PW - 10, y: Y0 + 10.5, align: 'right' });
  const mmFrame = poly([[0, Y0], [PW, Y0], [PW, Y0 + MH], [10, Y0 + MH], [0, Y0 + MH - 10]]);
  const mission = h('g', { 'data-ref': 'print-mission' },
    h('g', { 'data-ref': 'print-mpanel' },
      tag('mission-panel', {},
        P(panel, { fill: C.void, 'fill-opacity': 0.76 }),
        P(panel, { fill: 'none', stroke: C.cyan, 'stroke-width': 5, 'stroke-opacity': 0.1 }),
        P(panel, { fill: 'none', stroke: C.cyan, 'stroke-width': 1, 'stroke-opacity': 0.85 }),
        P(rectD(-7.5, 0, 3.6, PH - 18), { fill: C.mag }), P(rectD(-7.5, PH - 12, 3.6, 3.6), { fill: C.acid }),
        P(panel, { fill: 'url(#print-scan)' })),
      tag('mission-status', txt('▶ MISSION ACTIVE'),
        P(poly([[15, 10.5], [22, 14.8], [15, 19]]), { fill: C.acid, 'data-ref': 'print-mtri' }),
        h('g', { 'data-ref': 'print-mok' }, P(status.d, { fill: C.acid })),
        h('g', { 'data-ref': 'print-mlost', display: 'none' }, P(lost.d, { fill: C.red }))),
      tag('mission-eta', txt('ETA mm:ss'), P(eta.d, { fill: C.cyan }), slotUses('eta', eta.slots, 18.5, 8.6, { fill: C.cyan })),
      tag('mission-progress', {},
        P(rectD(PW - 136, 25, 120, 3), { fill: C.cyan, 'fill-opacity': 0.22 }),
        h('rect', { 'data-ref': 'print-prog', x: 0, y: 0, width: 1, height: 1, fill: C.cyan, transform: `translate(${PW - 136} 25) scale(60 3)` }),
        P(bar, { fill: C.cyan, 'fill-opacity': 0.6 })),
      tag('mission-caption', txt('DELIVERY nn · 中文 / ENGLISH'),
        h('use', { href: '#print-cap0', 'data-ref': 'print-capc', fill: C.cyan, x: 14, y: 45, opacity: 0 }),
        h('use', { href: '#print-cap0', 'data-ref': 'print-capm', fill: C.mag, x: 14, y: 45, opacity: 0 }),
        h('use', { href: '#print-cap0', 'data-ref': 'print-capf', fill: C.plume, x: 14, y: 45 })),
      tag('mission-brief', txt('PICKUP 鱼丸 FISHBALL ×12 · TIP ¥88 …'), h('use', { href: '#print-brf0', 'data-ref': 'print-brf', fill: C.cyan, 'fill-opacity': 0.72, x: 14, y: 61.5 })),
      tag('mission-barcode', txt('#0719'), P(bc, { fill: C.plume, 'fill-opacity': 0.75 }), P(bcN, { fill: C.plume, 'fill-opacity': 0.75 }))),
    h('g', { 'data-ref': 'print-mmap' },
      tag('minimap-frame', txt('ROUTE // 霓虹环线 NEON LOOP · LAP · KM'),
        P(mmFrame, { fill: C.void, 'fill-opacity': 0.66 }),
        P(mmFrame, { fill: 'none', stroke: C.cyan, 'stroke-width': 0.8, 'stroke-opacity': 0.6 }),
        P(mmLab.d + mmCnt.d, { fill: C.cyan, 'fill-opacity': 0.8 }),
        slotUses('mm', mmCnt.slots, Y0 + 10.5, 6.8, { fill: C.acid }),
        P(mmFrame, { fill: 'url(#print-scan)' })),
      tag('minimap-track', {}, P(seg, { fill: C.cyan, 'fill-opacity': 0.42 }), P(dots, { fill: C.void, stroke: C.cyan, 'stroke-width': 0.9 })),
      tag('minimap-icons', {}, P(icons, { fill: 'none', stroke: C.cyan, 'stroke-width': 0.8, 'stroke-opacity': 0.95, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' })),
      tag('minimap-scale', txt('0 5 10 15 20 26'), P(kmt + kmLab, { fill: C.cyan, 'fill-opacity': 0.6 })),
      tag('minimap-current', {},
        h('rect', { 'data-ref': 'print-mcur', x: 0, y: 0, width: 1, height: 1, fill: C.mag, transform: `translate(${TX0} ${TY - 1.6}) scale(20 3.2)` }),
        h('rect', { 'data-ref': 'print-mvis', x: 0, y: 0, width: 1, height: 1, fill: C.acid, transform: `translate(${TX0} ${TY - 4.2}) scale(1 1)` })),
      tag('minimap-marker', { 'data-ref': 'print-mark', transform: `translate(${TX0} ${TY})` },
        P(circ(0, 0, 3.6), { fill: 'none', stroke: C.acid, 'stroke-width': 1.3 }),
        P(circ(0, 0, 1.5) + poly([[0, 5], [3.4, 10.5], [-3.4, 10.5]]), { fill: C.acid }))));

  // ================================================================ READOUTS (block-local, top-left 0,0)
  const plateR = poly([[10, 0], [RW, 0], [RW, RH], [0, RH], [0, 10]]);
  const sigL = text('MONO', 'SIGNAL', { size: 7.8, track: 1.3, x: 12, y: 18 });
  const net = text('MONO', '· 霓虹网 NEON-NET 5G', { size: 7.8, track: 1.1, x: 90, y: 18 });
  const pct = text('MONO', `${SLOT}${SLOT}${SLOT}%`, { size: 8.4, track: 0.6, x: RW - 10, y: 18, align: 'right' });
  const bX = RW - 10 - pct.w - 34, bY = 9;
  const rec = text('MONO', `REC ${SLOT}${SLOT}:${SLOT}${SLOT}:${SLOT}${SLOT}`, { size: 10, track: 1.1, x: 24, y: 38.5 });
  const wnum = text('MONO', `${SLOT}${SLOT}% · ${SLOT}${SLOT}°C`, { size: 8.4, track: 0.9, x: RW - 10, y: 38 });
  wnum.slots = wnum.slots.map(x => x - wnum.w); const wnumD = text('MONO', `${SLOT}${SLOT}% · ${SLOT}${SLOT}°C`, { size: 8.4, track: 0.9, x: RW - 10, y: 38, align: 'right' }).d;
  const WX = 162;
  const wIcon = {
    clear: circ(0, 0, 4) + circ(6.5, -5, 0.9) + circ(-6, -4, 0.7),
    drizzle: 'M-3 -3.5L-3.8 -1.4M1 -3.5L0.2 -1.4M-1 0.5L-1.8 2.6M3 0.5L2.2 2.6',
    fog: 'M-6 -3.5H2M-3 -0.5H6M-6 2.5H4',
    rain: 'M-4 -4L-5.4 -0.4M0 -4L-1.4 -0.4M4 -4L2.6 -0.4M-2 1L-3.4 4.6M2 1L0.6 4.6',
    storm: 'M-5 -4L-6.4 -0.4M-1 -4L-2.4 -0.4M3 -4L1.6 -0.4M1 0L-2 3.5H1L-1 7',
  };
  const readouts = h('g', { 'data-ref': 'print-read' },
    P(plateR, { fill: C.void, 'fill-opacity': 0.62 }),
    P(plateR, { fill: 'none', stroke: C.cyan, 'stroke-width': 0.8, 'stroke-opacity': 0.55 }),
    tag('scanlines', {}, P(plateR, { fill: 'url(#print-scan)' })),
    tag('signal-bars', txt('SIGNAL'), P(sigL.d, { fill: C.cyan, 'fill-opacity': 0.8 }),
      [0, 1, 2, 3, 4].map(i => h('rect', { 'data-ref': 'print-sig' + i, x: 57 + i * 5.4, y: 18 - 3 - i * 2.2, width: 3.4, height: 3 + i * 2.2, fill: C.acid }))),
    tag('net-id', txt('· 霓虹网 NEON-NET 5G'), P(net.d, { fill: C.cyan, 'fill-opacity': 0.8 })),
    tag('battery', txt('battery %'),
      P(`M${bX} ${bY + 1.5}Q${bX} ${bY} ${bX + 1.5} ${bY}H${bX + 22.5}Q${bX + 24} ${bY} ${bX + 24} ${bY + 1.5}V${bY + 8.5}Q${bX + 24} ${bY + 10} ${bX + 22.5} ${bY + 10}H${bX + 1.5}Q${bX} ${bY + 10} ${bX} ${bY + 8.5}Z`, { fill: 'none', stroke: C.cyan, 'stroke-width': 1.1 }),
      P(rectD(bX + 24.8, bY + 3, 2, 4), { fill: C.cyan }),
      [0, 1, 2, 3, 4].map(i => h('rect', { 'data-ref': 'print-cell' + i, x: bX + 2 + i * 4.1, y: bY + 2, width: 3.3, height: 6, fill: C.acid })),
      P('M4.2 -5L-1.4 0.6H1.4L-0.8 5L4 -0.8H1.2Z', { 'data-ref': 'print-bolt', fill: C.amber, stroke: C.void, 'stroke-width': 0.6, transform: `translate(${bX + 12} ${bY + 5})`, display: 'none' }),
      P(pct.d, { fill: C.plume }), slotUses('pct', pct.slots, 18, 8.4, { fill: C.plume })),
    tag('rec-time', txt('● REC hh:mm:ss'),
      P(circ(15, 35, 3.4), { fill: C.red, 'data-ref': 'print-recdot' }),
      P(rec.d, { fill: C.plume }), slotUses('clk', rec.slots, 38.5, 10, { fill: C.plume })),
    tag('weather-readout', txt('雨 RAIN 72% · 22°C'),
      Object.entries(wIcon).map(([kk, d]) => h('g', { 'data-ref': 'print-wx-' + kk, display: kk === 'rain' ? 'inline' : 'none' },
        P(d, { transform: `translate(${WX} 34.5)`, fill: kk === 'clear' ? C.amber : 'none', stroke: kk === 'clear' ? 'none' : C.cyan, 'stroke-width': 1.2, 'stroke-linecap': 'round' }),
        P(text('MONO', WEATHER[kk], { size: 8.4, track: 1, x: WX + 11, y: 38 }).d, { fill: C.cyan }))),
      P(wnumD, { fill: C.plume }), slotUses('wx', wnum.slots, 38, 8.4, { fill: C.plume })));

  // ================================================================ TARGET RETICLE (corners drawn at their own origin)
  const rc = (sx, sy) => P(poly([[0, 0], [9 * sx, 0], [0, 9 * sy]]), { fill: C.acid, 'fill-opacity': 0.45 }) +
    P(`M0 ${18 * sy}V0H${18 * sx}`, { fill: 'none', stroke: C.acid, 'stroke-width': 1.6 }) + P(circ(0, 0, 1.6), { fill: C.acid });
  const tlab = text('MONO', 'COURIER 鹈鹕 #0719', { size: 8.4, track: 1.1, x: 34, y: -26 });
  const lock = text('MONO', 'LOCK · 30 MIN', { size: 6, track: 1.2, x: 34, y: -15 });
  const reticle = h('g', { 'data-ref': 'print-ret', display: 'none' },
    [['TL', 1, 1], ['TR', -1, 1], ['BL', 1, -1], ['BR', -1, -1]].map(([kk, sx, sy]) => tag('target-reticle', { 'data-ref': 'print-rt' + kk }, rc(sx, sy))),
    tag('target-label', txt('COURIER 鹈鹕 #0719 · LOCK · 30 MIN'), h('g', { 'data-ref': 'print-rtlab' },
      P('M0 0L22 -22H32', { fill: 'none', stroke: C.acid, 'stroke-width': 1 }), P(circ(0, 0, 2.6), { fill: 'none', stroke: C.acid, 'stroke-width': 1 }),
      // (fix) a solid void plate with an acid hairline: the tag stays legible over a blimp or a sky billboard
      P(rectD(30, -37, tlab.w + 8, 26), { fill: C.void, 'fill-opacity': 0.94 }), P(rectD(30.5, -36.5, tlab.w + 7, 25), { fill: 'none', stroke: C.acid, 'stroke-width': 0.6, 'stroke-opacity': 0.6 }),
      P(tlab.d, { fill: C.acid }), P(lock.d, { fill: C.acid, 'fill-opacity': 0.7 }))));

  // ================================================================ GLITCH + BOOT SCAN
  const glitch = h('g', { 'data-ref': 'print-glitch', display: 'none' }, tag('glitch-tear', {},
    Array.from({ length: 8 }, (_, i) => h('rect', { 'data-ref': 'print-gb' + i, x: 0, y: 0, width: 1, height: 1, fill: [C.cyan, C.mag, C.void, C.acid][i % 4], 'fill-opacity': i % 4 === 2 ? 0.6 : 0.38 })),
    Array.from({ length: 3 }, (_, i) => h('rect', { 'data-ref': 'print-gs' + i, x: 0, y: 0, width: 1, height: 1, fill: 'url(#print-scan-dark)' }))));
  defs.push(h('linearGradient', { id: 'print-boot-g', x1: 0, y1: 0, x2: 0, y2: 1 },
    h('stop', { offset: 0, 'stop-color': C.cyan, 'stop-opacity': 0 }), h('stop', { offset: 1, 'stop-color': C.cyan, 'stop-opacity': 0.22 })));
  const boot = h('g', { 'data-ref': 'print-boot', display: 'none' },
    h('rect', { x: -1400, y: -70, width: 4400, height: 70, fill: 'url(#print-boot-g)' }),
    h('rect', { x: -1400, y: -1.5, width: 4400, height: 2.2, fill: C.core }));

  const root = h('g', { id: 'print-root', 'data-ref': 'print-root' },
    hudBar('T'), hudBar('B'), ticker, frame, mission, readouts, reticle, title, glitch, boot);
  return { defs: defs.join(''), layers: { 'L-letterbox': root } };
}

// print-glyphs.gen.mjs: run build() with a stub context and report every character printed, per face
export function collectText() {
  COLLECT = true;
  try { LAYOUTS = null; build({ v: t => `var(--pb-${t})`, rng: () => () => 0.5 }); } finally { COLLECT = false; LAYOUTS = null; }
  return Object.fromEntries(Object.entries(USED).map(([k, s]) => [k, [...s].join('')]));
}

// ------------------------------------------------------------------ runtime
function fitScale(zone, box, maxS) {
  const w = box[2] - box[0], hh = box[3] - box[1];
  const zw = zone[2] - zone[0], zh = zone[3] - zone[1];
  if (zw <= 0 || zh <= 0) return 0;
  return Math.min(maxS, zw / w, zh / hh);
}
// Best placement of a title layout among free zones: -> {name, X, Y, S}
function place(layoutNames, zones, maxS) {
  let best = null;
  for (const name of layoutNames) {
    const L = LAYOUTS[name];
    for (const z of zones) {
      const s = fitScale(z, L.box, maxS);
      const score = name === 'stack' ? s * 0.62 : s;
      if (!best || score > best.score + 1e-6) {
        const w = (L.box[2] - L.box[0]) * s;
        const slack = z[2] - z[0] - w;
        const x0 = z.right ? z[2] - w : z[0] + Math.min(slack, z.inset || 0);
        best = { name, score, S: s, X: x0 - L.box[0] * s, Y: z[1] - L.box[1] * s };
      }
    }
  }
  return best;
}
const boxOf = (pl, L = LAYOUTS[pl.name]) => [pl.X + L.box[0] * pl.S, pl.Y + L.box[1] * pl.S, pl.X + L.box[2] * pl.S, pl.Y + L.box[3] * pl.S];
const hit = (a, b) => !!b && a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
// largest scale ≤ smax of a w×h box anchored at a corner ('tr' | 'tl' | 'br' | 'bl' at ax, ay) that avoids obstacles
function fitCorner(a, ax, ay, w, hh, obst, smax) {
  let s = smax;
  const right = a[1] === 'r', bottom = a[0] === 'b';
  for (const o of obst) {
    if (!o) continue;
    const box = sc => [right ? ax - w * sc : ax, bottom ? ay - hh * sc : ay, right ? ax : ax + w * sc, bottom ? ay : ay + hh * sc];
    if (!hit(box(s), o)) continue;
    const sx = right ? (ax - o[2]) / w : (o[0] - ax) / w;
    const sy = bottom ? (ay - o[3]) / hh : (o[1] - ay) / hh;
    s = Math.min(s, Math.max(sx, sy));
  }
  return s;
}
const cornerPose = (a, ax, ay, w, hh, s) => ({ x: a[1] === 'r' ? ax - w * s : ax, y: a[0] === 'b' ? ay - hh * s : ay, s });

export function attach(svg, ctx) {
  const doc = svg.ownerDocument, view = doc.defaultView;
  if (!LAYOUTS) layouts();
  const R = {};
  for (const el of svg.querySelectorAll('[data-ref^="print-"]')) R[el.getAttribute('data-ref').slice(6)] = el;
  // draw above the lead's plain letterbox rects: the HUD bars ARE the letterbox in style X
  const host = svg.querySelector('#L-letterbox');
  if (R.root && host) host.appendChild(R.root);

  const cache = new Map();
  const set = (el, name, val) => { if (!el) return; let c = cache.get(el); if (!c) cache.set(el, c = {}); if (c[name] !== val) { c[name] = val; el.setAttribute(name, val); } };
  const show = (el, on) => set(el, 'display', on ? 'inline' : 'none');
  const digitsTo = (prefix, n, str) => { for (let i = 0; i < n; i++) set(R[prefix + i], 'href', '#print-dm-' + str[i]); };

  // visible viewBox rectangle (preserveAspectRatio slice)
  let V = { x0: 0, y0: 0, x1: VIEW.w, y1: VIEW.h, w: VIEW.w, h: VIEW.h };
  const measureV = () => {
    const r = svg.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const s = Math.max(r.width / VIEW.w, r.height / VIEW.h), w = r.width / s, hh = r.height / s;
    V = { x0: VIEW.cx - w / 2, y0: VIEW.cy - hh / 2, x1: VIEW.cx + w / 2, y1: VIEW.cy + hh / 2, w, h: hh, left: r.left, top: r.top, s };
  };
  measureV();
  // the UI control card (an HTML overlay that docks to a free corner): the HUD blocks keep clear of it
  let uiBox = null, uiAt = -1e9;
  const measureUI = force => {
    const now = view.performance.now();
    if (!force && now - uiAt < 400) return;
    uiAt = now; uiBox = null;
    const el = doc.getElementById('ui-card');
    if (!el || !el.getClientRects().length || !V.s) return;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    const X = px => V.x0 + (px - V.left) / V.s, Y = py => V.y0 + (py - V.top) / V.s;
    uiBox = [X(r.left) - 8, Y(r.top) - 8, X(r.right) + 8, Y(r.bottom) + 8];
  };
  view.addEventListener('resize', measureV);
  // measure the card at the START of a frame (this rAF is registered before the runtime's loop), when layout is clean
  const early = () => { measureUI(false); view.requestAnimationFrame(early); };
  view.requestAnimationFrame(early);

  // skip the intro on any key / click (deterministic: the skip is pinned to the sim time it happened at)
  let skipReq = false, skipAt = Infinity, lastT = 0, lastSig = '';
  const skip = () => { skipReq = true; };
  doc.addEventListener('keydown', skip, true);
  doc.addEventListener('pointerdown', skip, true);

  const riderBox = (cam, pose) => {
    const z = cam.zoom, oy = GROUND_Y + (pose ? pose.riderY || 0 : 0);
    const X = x => VIEW.cx + z * (x - cam.fx), Y = y => VIEW.cy + z * (y - cam.fy);
    const pad = 14 + Math.abs(cam.roll || 0) * 8;
    return [X(RIDER_X - 262) - pad, Y(oy - 572) - pad, X(RIDER_X + 305) + pad, Y(oy + 6) + pad];
  };
  const TIP = (s, pose) => `translate(${f(pose.x)} ${f(pose.y)}) scale(${f(pose.s)})`;
  let L = null;   // last layout (block poses for the dynamic part)

  // ---------------------------------------------------------------- layout (only when the view / intro phase changes)
  function layout(frame, cam, ti, kc, lb) {
    const reduced = frame.reduced;
    const yT = V.y0 + M + lb, yB = V.y1 - M - lb, xL = V.x0 + M, xR = V.x1 - M;
    const cx = (xL + xR) / 2, cy = (yT + yB) / 2;
    // ---- bars ----
    const onBars = lb > 0.5;
    show(R.barT, onBars); show(R.barB, onBars);
    set(R.barT, 'transform', `translate(0 ${f(V.y0 + lb)})`);
    set(R.barB, 'transform', `translate(0 ${f(V.y1 - lb)}) scale(1 -1)`);
    for (const k of ['T', 'B']) { set(R[`hz${k}L`], 'transform', `translate(${f(xL)} 0)`); set(R[`hz${k}R`], 'transform', `translate(${f(xR - 64)} 0)`); }
    // ---- frame ----
    const boot = reduced ? 1 : easeOut(clamp01(ti / 0.38));
    const bs = 1 + 0.5 * (1 - boot);
    const cT = (x, y, sx, sy) => `translate(${f(x)} ${f(y)}) scale(${f(sx * bs)} ${f(sy * bs)})`;
    set(R.cTL, 'transform', cT(xL, yT, 1, 1)); set(R.cTR, 'transform', cT(xR, yT, -1, 1));
    set(R.cBL, 'transform', cT(xL, yB, 1, -1)); set(R.cBR, 'transform', cT(xR, yB, -1, -1));
    set(R.frame, 'opacity', f(reduced ? 1 : ti < 0.05 ? 0 : Math.min(1, 0.25 + boot)));
    const codeW = Math.max(...Object.values(CODEW));
    const sideGap = ARM + 22 + codeW + 10;
    const ur = (el, x, y, w, hh) => set(el, 'transform', `translate(${f(x)} ${f(y)}) scale(${f(Math.max(0.01, w))} ${f(Math.max(0.01, hh))})`);
    ur(R.kT, xL + ARM + 22, yT, xR - xL - 2 * (ARM + 22), 1); ur(R.kB, xL + ARM + 22, yB - 1, xR - xL - 2 * (ARM + 22), 1);
    ur(R.kL, xL, yT + sideGap, 1, yB - yT - 2 * sideGap); ur(R.kR, xR - 1, yT + sideGap, 1, yB - yT - 2 * sideGap);
    set(R.rT, 'transform', `translate(${f(cx)} ${f(yT)})`); set(R.rB, 'transform', `translate(${f(cx)} ${f(yB)}) scale(1 -1)`);
    set(R.rT, 'opacity', V.w < 560 ? 0 : 1); set(R.rB, 'opacity', V.w < 560 ? 0 : 1);
    set(R.eL, 'transform', `translate(${f(xL)} ${f(cy)})`); set(R.eR, 'transform', `translate(${f(xR)} ${f(cy)}) scale(-1 1)`);
    const cw = k => CODEW[k];
    set(R.codeTL, 'transform', `translate(${f(xL + 6.5)} ${f(yT + ARM + 22 + cw('TL'))}) rotate(-90)`);
    set(R.codeTR, 'transform', `translate(${f(xR - 6.5)} ${f(yT + ARM + 22)}) rotate(90)`);
    set(R.codeBL, 'transform', `translate(${f(xL + 6.5)} ${f(yB - ARM - 22)}) rotate(-90)`);
    set(R.codeBR, 'transform', `translate(${f(xR - 6.5)} ${f(yB - ARM - 22 - cw('BR'))}) rotate(90)`);

    // ---- title card ----
    const rb = riderBox(cam, frame.pose);
    const top = Object.assign([xL + 16, yT + 16, xR - 16, Math.min(rb[1] - 6, yB - 16)], { inset: 30 });
    const left = Object.assign([xL + 16, yT + 16, Math.min(rb[0] - 6, xR - 16), yB - 160], { inset: 8 });
    const right = Object.assign([Math.max(rb[2] + 6, xL + 16), yT + 150, xR - 16, yB - 80], { right: true });
    const bar = Object.assign([xL + 10, V.y0 + 12, xR - 10, V.y0 + lb - 18], { inset: 8 });
    // keep every zone clear of the UI card: cut the zone on the card's side (left or right of its centre)
    const clip = z => {
      if (!uiBox || !hit(z, uiBox)) return z;
      const c = Object.assign([...z], { inset: z.inset, right: z.right });
      if ((uiBox[0] + uiBox[2]) / 2 < (z[0] + z[2]) / 2) c[0] = Math.max(c[0], uiBox[2] + 8); else c[2] = Math.min(c[2], uiBox[0] - 8);
      return c;
    };
    // (integration) the intro card tops out at 0.8: at full size its 鹈鹕湾 tag sat on the arcology crown, the hero
    // frame's landmark; at 0.8 the crown, its halo rings and the PELICORP logo stay in view
    const cardP = place(['line', 'stack'], [top, left, right].map(clip), 0.8), cardB = place(['line'], [clip(bar)], 1.0);
    const logoP = place(['logo'], [Object.assign([xL + 16, yT + 14, Math.min(xR - 16, xL + 16 + 470), Math.min(rb[1] - 4, yT + 14 + 52)], { inset: 4 }),
      Object.assign([xL + 16, yT + 14, Math.min(rb[0] - 4, xL + 16 + 470), yT + 14 + 52], { inset: 4 })].map(clip), 0.44);
    const logoB = place(['logo'], [clip(bar)], 0.5);
    const E = reduced ? () => 1 : (a, d) => clamp01((ti - a) / d);
    let shrink = easeInOut(clamp01((ti - 3.55) / 0.62));
    let alpha = 1;
    if (reduced) { shrink = ti < 3.9 ? 0 : 1; alpha = ti < 3.6 ? 1 : ti < 3.9 ? 1 - (ti - 3.6) / 0.3 : Math.min(1, (ti - 3.9) / 0.35); }
    if (ti >= 99) shrink = 1;
    const at = (pl, g) => { const a = LAYOUTS[pl.name][g]; return [pl.X + pl.S * a.x, pl.Y + pl.S * a.y, pl.S]; };
    const mix3 = (a, b, kk) => [lerp(a[0], b[0], kk), lerp(a[1], b[1], kk), lerp(a[2], b[2], kk)];
    const gpose = g => { const c = mix3(at(cardP, g), at(cardB, g), kc), l = mix3(at(logoP, g), at(logoB, g), kc), p = mix3(c, l, shrink); return p; };
    const T = p => `translate(${f(p[0])} ${f(p[1])}) scale(${f(p[2])})`;
    set(R.w, 'transform', T(gpose('w'))); set(R.tag, 'transform', T(gpose('tag')));
    set(R.sub, 'transform', T(gpose('sub'))); set(R.ed, 'transform', T(gpose('ed')));
    set(R.title, 'opacity', f(alpha));
    set(R.ed, 'opacity', f(Math.min(E(1.75, 0.3), 1 - shrink)));
    const small = shrink >= 1 && kc < 0.01;
    show(R.wscan, !small);                       // the cut scanlines are too fine for the small logo
    // letters decode through scramble glyphs, then lock (staggered)
    for (let i = 0; i < TL.letters.length; i++) {
      const lockT = 0.28 + i * 0.058;
      let c = TL.letters[i].c;
      if (!reduced && ti < lockT) c = SCRAMBLE[Math.floor(hash(i, Math.floor(ti * 30)) * SCRAMBLE.length)];
      set(R['tl' + i], 'href', '#print-gl-' + c.charCodeAt(0));
    }
    set(R.wv, 'opacity', reduced ? 1 : ti < 0.1 ? 0 : 1);
    const split = reduced ? 0 : 1 - easeOut(E(0.1, 1.0));
    set(R.chc, 'transform', `translate(${f(-3.2 - 18 * split)} ${f(0.6 + 2 * split)})`);
    set(R.chm, 'transform', `translate(${f(3.4 + 18 * split)} ${f(-0.4 - 2 * split)})`);
    const jit = reduced ? 0 : ti < 1.2 ? 2.5 * (1 - ti / 1.2) : 0;
    BANDS.forEach(([, , dx], i) => set(R['band' + i], 'transform', `translate(${f(dx * (1 + jit * (hash(i, Math.floor(ti * 20)) * 2 - 0.4)))} 0)`));
    set(R.rule, 'transform', `scale(${f(Math.max(0.001, easeOut(E(0.7, 0.4))))} 1)`);
    const tagE = E(0.95, 0.3), tb = tagE > 0 ? backOut(tagE) : 0;
    set(R.tagin, 'transform', `translate(${TAG.w / 2} -28) rotate(${f(-6 * (1 - tagE))}) scale(${f(tagE > 0 ? 1.6 - 0.6 * tb : 1.6)}) translate(${-TAG.w / 2} 28)`);
    set(R.tagin, 'opacity', tagE > 0 ? 1 : 0);
    // the subtitle types on, one monospace cell at a time
    const nCh = [...'PELICAN BAY · 霓虹区 NEON DISTRICT · ネオン'].length;
    const typed = reduced ? 1 : Math.floor(E(1.2, 0.62) * nCh) / nCh;
    set(R.subclip, 'width', f((SUBW + 10) * typed));
    set(R.cursor, 'transform', `translate(${f(-(SUBW - 14 + 5) * (1 - typed))} 0)`);

    // ---- HUD blocks: mission (+ minimap) top-right, readouts bottom-right ----
    const logoBox = boxOf(logoP, LAYOUTS.logo);
    const cardBox = boxOf({ ...cardP, name: cardP.name });
    const obst = [rb, uiBox, logoBox];
    let mP = null;
    for (const [a, ax, ay] of [['tr', xR - 10, yT + 10], ['tl', xL + 10, logoBox[3] + 12]]) {
      const s = fitCorner(a, ax, ay, BLOCK.w + 8, BLOCK.h, obst, Math.min(1, (V.w - 2 * M - 20) / (BLOCK.w + 8)));
      if (s >= 0.55) { mP = cornerPose(a, ax, ay, BLOCK.w + 8, BLOCK.h, s); mP.x += 8 * s; break; }
    }
    const mBox = mP && [mP.x - 8 * mP.s, mP.y, mP.x + BLOCK.w * mP.s, mP.y + BLOCK.h * mP.s];
    let rP = null;
    for (const [a, ax, ay] of [['br', xR - 10, yB - 10], ['bl', xL + 10, yB - 10]]) {
      const s = fitCorner(a, ax, ay, RW, RH, [rb, uiBox, mBox, logoBox], Math.min(1, (V.w - 2 * M - 20) / RW));
      if (s >= 0.6) { rP = cornerPose(a, ax, ay, RW, RH, s); break; }
    }
    // cinematic: dock into the bars
    const bh = Math.max(1, lb - 22);
    const mS = Math.min(0.92, bh / BLOCK.h, (V.w * 0.42) / BLOCK.w);
    const mC = { x: xR - 6 - BLOCK.w * mS, y: V.y0 + 11, s: mS };
    const rS = Math.min(1, bh / RH, (V.w * 0.36) / RW);
    const rC = { x: xR - 6 - RW * rS, y: V.y1 - lb + (lb - RH * rS) / 2 + 4, s: rS };
    const mix = (a, b) => a ? { x: lerp(a.x, b.x, kc), y: lerp(a.y, b.y, kc), s: lerp(a.s, b.s, kc) } : b;
    const mBoot = reduced ? 1 : easeOut(E(1.25, 0.4)), rBoot = reduced ? 1 : easeOut(E(1.5, 0.4));
    const mVis = (mP || kc > 0.5) && !(shrink < 1 && kc < 0.5 && hit(mBox || [0, 0, 0, 0], cardBox)) ? 1 : 0;
    const rVis = (rP || kc > 0.5) && !(shrink < 1 && kc < 0.5 && rP && hit([rP.x, rP.y, rP.x + RW * rP.s, rP.y + RH * rP.s], cardBox)) ? 1 : 0;
    const mm = mix(mP, mC), rr = mix(rP, rC);
    set(R.mission, 'transform', TIP(null, mm)); set(R.mission, 'opacity', f(mVis * mBoot));
    set(R.mpanel, 'transform', `translate(${f(PW * (1 - mBoot))} 0) scale(${f(Math.max(0.001, mBoot))} 1)`);
    set(R.read, 'transform', TIP(null, rr)); set(R.read, 'opacity', f(rVis * rBoot));
    // ticker window: the bottom bar between the UI card and the readouts
    let tx0 = xL + 76, tx1 = rC.x - 18;
    const tyc = V.y1 - lb / 2;
    if (uiBox && uiBox[3] > V.y1 - lb && uiBox[1] < V.y1) { if (uiBox[0] < V.x0 + V.w / 2) tx0 = Math.max(tx0, uiBox[2] + 12); else tx1 = Math.min(tx1, uiBox[0] - 12); }
    const tickOn = kc > 0.6 && tx1 - tx0 > 160;
    show(R.ticker, tickOn);
    set(R.tickclip, 'x', f(tx0)); set(R.tickclip, 'width', f(Math.max(1, tx1 - tx0))); set(R.tickclip, 'y', f(tyc - 12)); set(R.tickclip, 'height', 20);
    const mNow = mVis ? [mm.x - 10, mm.y, mm.x + BLOCK.w * mm.s, mm.y + BLOCK.h * mm.s] : null;
    L = { tx0, tyc, xL, xR, yT, yB, mm, kc, cam, shrink, reduced, mBox: mNow, logoBox: shrink >= 1 || kc > 0.5 ? (kc > 0.5 ? boxOf(logoB, LAYOUTS.logo) : logoBox) : cardBox };
  }

  // ---------------------------------------------------------------- per-frame state (values written only on change)
  const clockOf = (tod, t) => { const s = wrapM(Math.floor(tod * 86400 + t), 86400); return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, '0')).join(''); };
  let lastStretch = -1;
  function dynamic(frame, cam, ti) {
    const lb = Math.max(0, cam.letterbox || 0);
    const t = frame.t, D = frame.distance || 0, reduced = frame.reduced;
    const p = wrapM(D, LAP), lap = Math.floor(D / LAP);
    let si = STRETCHES.length - 1; for (const s of STRETCHES) if (p < s.b) { si = s.i; break; }
    const S = STRETCHES[si];
    const speed = Math.max(1, frame.speed || 1);
    // mission
    if (si !== lastStretch) { lastStretch = si; for (const k of ['capc', 'capm', 'capf']) set(R[k], 'href', '#print-cap' + si); set(R.brf, 'href', '#print-brf' + si); }
    const since = (p - S.a) / speed;   // seconds since the district began
    const cg = reduced || ti < 4.3 ? 0 : clamp01(1 - since / 0.5);
    const gq = Math.floor(t * 30);
    set(R.capc, 'opacity', cg > 0 ? 1 : 0); set(R.capm, 'opacity', cg > 0 ? 1 : 0);
    if (cg > 0) {
      set(R.capc, 'transform', `translate(${f(-2 - 7 * cg * hash(1, gq))} 0)`); set(R.capm, 'transform', `translate(${f(2 + 7 * cg * hash(2, gq))} 0)`);
      set(R.capf, 'transform', `translate(${f((hash(3, gq) - 0.5) * 8 * cg)} 0)`);
    } else set(R.capf, 'transform', 'translate(0 0)');
    const tunnel = S.key === 'cliffs';
    show(R.mok, !tunnel); show(R.mlost, tunnel);
    set(R.mtri, 'opacity', reduced || Math.floor(t * 1.6) % 2 === 0 ? 1 : 0.25);
    const rem = Math.min(5999, Math.max(0, Math.round((S.b - p) / speed)));
    digitsTo('eta', 4, String(Math.floor(rem / 60)).padStart(2, '0') + String(rem % 60).padStart(2, '0'));
    const prog = clamp01((p - S.a) / (S.b - S.a));
    set(R.prog, 'transform', `translate(${PW - 136} 25) scale(${f(Math.max(0.01, 120 * Math.round(prog * 240) / 240))} 3)`);
    // minimap
    const TX0 = 14, TXW = PW - 28, TY = PH + MGAP + 33;
    const kx = km => TX0 + TXW * km / KMS;
    set(R.mcur, 'transform', `translate(${f(kx(S.kmA) + 1)} ${TY - 1.6}) scale(${f(kx(S.kmB) - kx(S.kmA) - 2)} 3.2)`);
    const mx = Math.round(kx(p / KM) * 4) / 4;
    set(R.mark, 'transform', `translate(${f(mx)} ${TY})`);
    set(R.mvis, 'transform', `translate(${TX0} ${TY - 4.6}) scale(${f(Math.max(0.01, mx - TX0))} 1)`);
    const kmNow = Math.floor(p / KM * 10);
    digitsTo('mm', 5, String(Math.min(99, lap + 1)).padStart(2, '0') + String(Math.floor(kmNow / 10)).padStart(2, '0') + String(kmNow % 10));
    // readouts
    const flick = Math.floor(t / 2.3);
    const sig = tunnel ? (hash(flick, 5) < 0.5 ? 0 : 1) : S.key === 'lighthouse' ? 5 : S.key === 'dunes' ? 2 : 3 + (hash(si * 31 + flick, 9) < 0.5 ? 0 : 1);
    for (let i = 0; i < 5; i++) set(R['sig' + i], 'fill-opacity', i < sig ? 1 : 0.18);
    const charging = S.key === 'return';
    let pct = Math.round(100 - 72 * (p / STRETCHES[STRETCHES.length - 1].a));
    if (charging) pct = Math.round(lerp(28, 100, clamp01((p - S.a) / (S.b - S.a))));
    pct = Math.max(1, Math.min(100, pct));
    digitsTo('pct', 3, String(pct).padStart(3, '0'));
    set(R.pct0, 'opacity', pct >= 100 ? 1 : 0);
    const cells = Math.ceil(pct / 20);
    for (let i = 0; i < 5; i++) set(R['cell' + i], 'fill-opacity', i < cells ? (cells <= 1 ? 0.95 : 1) : 0.12);
    set(R.cell0, 'fill', cells <= 1 ? 'var(--pb-red)' : 'var(--pb-acid)');
    show(R.bolt, charging);
    digitsTo('clk', 6, clockOf(frame.tod || 0, t));
    set(R.recdot, 'opacity', reduced || (t % 1) < 0.62 ? 1 : 0.2);
    const w = frame.weather || {};
    const rain = w.rain || 0, fog = w.fog || 0, tod = frame.tod || 0.7;
    const cond = (w.bow || 0) > 0.4 ? 'clear' : rain > 0.62 ? 'storm' : fog > 0.3 ? 'fog' : rain > 0.12 ? 'rain' : 'drizzle';
    for (const kk of ['clear', 'drizzle', 'fog', 'rain', 'storm']) show(R['wx-' + kk], kk === cond);
    const hum = Math.min(99, Math.round(cond === 'clear' ? 54 : 70 + 28 * Math.max(rain, fog * 0.8)));
    const temp = Math.round(27 - 16 * Math.abs(wrapM(tod - 0.55 + 0.5, 1) - 0.5) - 3 * rain);
    digitsTo('wx', 4, String(hum).padStart(2, '0') + String(Math.max(0, temp)).padStart(2, '0'));
    // subtitle cursor blink
    set(R.cursor, 'opacity', reduced || ti < 1.9 || (t % 1.1) < 0.6 ? 1 : 0);
    // ticker (cinematic)
    if (L && L.kc > 0.6) {
      const off = reduced ? 0 : wrapM(t * 26, TICK_W);
      set(R.tickmove, 'transform', `translate(${f(L.tx0 - off)} ${f(L.tyc + 3)})`);
    }
    // reticle: brackets outside the head + bill box
    const hb = frame.headBox;
    const rOn = hb && !reduced ? ti > 2.0 : !!hb && ti > 2;
    show(R.ret, rOn);
    if (rOn) {
      const z = cam.zoom || 1;
      const lockK = reduced ? 1 : easeOut(clamp01((ti - 2.0) / 0.45));
      const gw = (1 + 0.8 * (1 - lockK));
      const barB = V.y0 + lb + 6;
      const x0 = hb.x - 126 * z * gw, x1 = hb.x + 118 * z * gw, y0 = Math.max(barB, hb.y - 26 * z * gw), y1 = hb.y + 86 * z * gw;
      const q = x => Math.round(x * 4) / 4;
      set(R.rtTL, 'transform', `translate(${f(q(x0))} ${f(q(y0))})`); set(R.rtTR, 'transform', `translate(${f(q(x1))} ${f(q(y0))})`);
      set(R.rtBL, 'transform', `translate(${f(q(x0))} ${f(q(y1))})`); set(R.rtBR, 'transform', `translate(${f(q(x1))} ${f(q(y1))})`);
      // label up-right of the TR corner, kept on screen (flips left when it would leave the frame)
      const labW = 190;
      const lx = x1 + 4, ly = y0 - 2;
      const lBox = [lx, ly - 40, lx + labW, ly + 4];
      const blocked = lx + labW > V.x1 - M - 6 || ly - 40 < V.y0 + lb + 4 || (L && L.mBox && hit(lBox, L.mBox)) || (L && L.logoBox && hit(lBox, L.logoBox));
      set(R.rtlab, 'transform', `translate(${f(q(lx))} ${f(q(ly))})`);
      set(R.rtlab, 'opacity', blocked ? 0 : f(lockK));
      set(R.ret, 'opacity', f(Math.min(1, lockK * 1.4)));
    }
    // ---- rare glitch transition ----
    let g = 0;
    if (!reduced && ti >= 4.5) {
      const GP = 41, kk = Math.floor(t / GP), o = 10 + 24 * hash(kk, 3), u = t - kk * GP - o;
      if (hash(kk, 11) < 0.7 && u >= 0 && u < 0.24) g = 1 - u / 0.24;
      if ((S.key === 'cliffs' || S.key === 'dunes' || S.key === 'village') && since < 0.3) g = Math.max(g, 1 - since / 0.3);
    }
    show(R.glitch, g > 0);
    const gq24 = Math.floor(t * 24);
    if (g > 0) {
      for (let i = 0; i < 8; i++) {
        const y = V.y0 + V.h * hash(i, gq24), hh = 2 + 20 * hash(i + 9, gq24) ** 2, x = V.x0 + V.w * 0.6 * hash(i + 3, gq24) - 40;
        set(R['gb' + i], 'transform', `translate(${f(x)} ${f(y)}) scale(${f(V.w * (0.3 + 0.7 * hash(i + 5, gq24)))} ${f(hh)})`);
      }
      for (let i = 0; i < 3; i++) set(R['gs' + i], 'transform', `translate(${f(V.x0)} ${f(V.y0 + V.h * hash(i + 20, gq24))}) scale(${f(V.w)} ${f(10 + 30 * hash(i + 23, gq24))})`);
      set(R.glitch, 'opacity', f(0.5 + 0.5 * g));
    }
    const fj = g > 0 ? (hash(7, gq24) - 0.5) * 10 * g : 0;
    set(R.frame, 'transform', `translate(${f(fj)} 0)`);
    if (g > 0) BANDS.forEach(([, , dx], i) => set(R['band' + i], 'transform', `translate(${f(dx * (1 + 3 * g * (hash(i, gq24) * 2 - 0.6)))} 0)`));
    else if (ti >= 4.3) BANDS.forEach(([, , dx], i) => set(R['band' + i], 'transform', `translate(${dx} 0)`));
    if (g > 0) { set(R.capc, 'opacity', 1); set(R.capm, 'opacity', 1); set(R.capc, 'transform', `translate(${f(-3 - 6 * g)} 0)`); set(R.capm, 'transform', `translate(${f(3 + 6 * g)} 0)`); }
    // boot scan beam (intro only)
    const bootOn = !reduced && ti > 0.04 && ti < 1.05;
    show(R.boot, bootOn);
    if (bootOn) set(R.boot, 'transform', `translate(0 ${f(V.y0 + (V.h + 80) * easeInOut(clamp01((ti - 0.04) / 0.95)))})`);
  }

  return {
    update(frame) {
      const t = frame.t, cam = frame.cam || { zoom: 1, fx: 800, fy: 450, letterbox: 0 };
      if (t + 1e-6 < lastT && t < skipAt) skipAt = Infinity;   // replay from earlier: the intro plays again
      lastT = t;
      if (skipReq) { skipReq = false; if (t < 4.2) skipAt = Math.min(skipAt, t); }
      const reduced = frame.reduced;
      const lb = Math.max(0, cam.letterbox || 0);
      const kc = easeInOut(clamp01(lb / LB_MAX));
      if (frame.dt === 0) {
        measureUI(true);
        // a still render (renderAt / freeze): the UI card docks AFTER this update, so re-check it on the next frame
        const before = uiBox ? uiBox.join() : '';
        view.requestAnimationFrame(() => { measureUI(true); if ((uiBox ? uiBox.join() : '') !== before) { lastSig = ''; this.update({ ...frame, dt: 1e-9 }); } });
      }
      const ti = t >= skipAt ? 99 : t;
      const rbQ = riderBox(cam, frame.pose).map(x => Math.round(x / 6));
      const sig = [V.w, V.h, V.x0, V.y0, f(lb), ti >= 4.3 ? 'post' : f(ti), reduced ? 1 : 0, rbQ.join(), uiBox ? uiBox.map(Math.round).join() : ''].join('|');
      if (sig !== lastSig) { lastSig = sig; layout(frame, cam, ti, kc, lb); }
      dynamic(frame, cam, ti);
    },
  };
}
