// OWNER: print. Screen-fixed poster furniture in L-letterbox (depth null), STYLE-C §4–§5:
//  · the poster border: P paper margin, N keyline + outer hairline, deco sunburst corners, stepped edge diamonds,
//    crop and registration marks, a printer's strip (imprint, colour bar, halftone tint ramp, edition number);
//  · the intro title card "PELICAN BAY" in stroke-built deco capitals (P face, R inline, N stepped shadow + N hatched
//    cast shadow), the 鹈鹕湾 deco label tablet and the subtitle band. It is PRINTED IN plate by plate (shadow plate,
//    face plate dropping into register, inline plate, the label thunked down, the band rolled on), holds ~3 s, then
//    shrinks into a small corner logo. Every frame the card is fitted into the free space around the rider's screen
//    box (from frame.cam + pose), so it never covers the bird at any camera, aspect, or during a hop;
//  · ephemera: an "ADMIT ONE" coast-railway ticket (guilloche, perforated stub, conductor's punch, matching serials),
//    a perforated postage stamp with an engraved vignette of a pelican on a bicycle, and a 鹈鹕湾 postmark with date;
//  · the cinematic letterbox: the paper margin itself grows into the bars (driven by frame.cam.letterbox); the logo
//    and stamp move into the top bar and the ticket into the bottom bar.
// All lettering is path data (print-glyphs.js, generated offline by print-glyphs.gen.mjs); no runtime fonts.
import { h } from '../core/svg.js';
import { VIEW, RIDER_X, GROUND_Y, CAMERAS } from '../contract.js';
import { LAT, ZH } from './print-glyphs.js';

export const id = 'print';

const TD = 'typography_frame';
const f = x => String(Math.round(x * 100) / 100);
const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - (1 - t) ** 3;
const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
const backOut = t => { const c = 1.9; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };

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
      case 'h': cx += num(); out += 'L' + pt(cx, cy); break;
      case 'v': cy += num(); out += 'L' + pt(cx, cy); break;
      case 'm': case 'l': { cx += num(); cy += num(); out += cmd.toUpperCase() + pt(cx, cy); if (cmd === 'm') cmd = 'l'; break; }
      case 'H': cx = num(); out += 'L' + pt(cx, cy); break;
      case 'V': cy = num(); out += 'L' + pt(cx, cy); break;
      case 'Q': { const a = pt(num(), num()); cx = num(); cy = num(); out += `Q${a} ${pt(cx, cy)}`; break; }
      case 'C': { const a = pt(num(), num()), b = pt(num(), num()); cx = num(); cy = num(); out += `C${a} ${b} ${pt(cx, cy)}`; break; }
      case 'a': case 'A': {
        const rx = num(), ry = num(), rot = num(), la = num(), sw = num();
        if (cmd === 'a') { cx += num(); cy += num(); } else { cx = num(); cy = num(); }
        out += `A${f(rx * sc)} ${f(ry * sc)} ${f(rot + ang)} ${la} ${det < 0 ? 1 - sw : sw} ${pt(cx, cy)}`; break;
      }
      case 'Z': case 'z': out += 'Z'; cmd = ''; break;
      default: throw new Error('print: unsupported path token ' + tok[i]);
    }
  }
  return out;
}
// matrix for translate(tx,ty) rotate(deg) scale(sx,sy)
const mat = (tx, ty, deg = 0, sx = 1, sy = sx) => {
  const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  return [c * sx, s * sx, -s * sy, c * sy, tx, ty];
};
const circ = (x, y, r, ccw = false) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 ${ccw ? 1 : 0} ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 ${ccw ? 1 : 0} ${f(-2 * r)} 0Z`;
const rectD = (x, y, w, hh) => `M${f(x)} ${f(y)}h${f(w)}v${f(hh)}h${f(-w)}Z`;
const rectCCW = (x, y, w, hh) => `M${f(x)} ${f(y)}v${f(hh)}h${f(w)}v${f(-hh)}Z`;
const roundRect = (x, y, w, hh, r) => `M${f(x + r)} ${f(y)}H${f(x + w - r)}A${r} ${r} 0 0 1 ${f(x + w)} ${f(y + r)}V${f(y + hh - r)}A${r} ${r} 0 0 1 ${f(x + w - r)} ${f(y + hh)}H${f(x + r)}A${r} ${r} 0 0 1 ${f(x)} ${f(y + hh - r)}V${f(y + r)}A${r} ${r} 0 0 1 ${f(x + r)} ${f(y)}Z`;
const diamond = (x, y, hw, hh) => `M${f(x - hw)} ${f(y)}L${f(x)} ${f(y - hh)}L${f(x + hw)} ${f(y)}L${f(x)} ${f(y + hh)}Z`;

// Glyph text -> one path d. font = LAT | ZH (em 1000, y down, baseline 0). rot in degrees about (x, y).
const SPACE = { lat: 330, zh: 500 };
function measure(font, str, size, track = 0, sx = 1) {
  const k = size / 1000, ch = [...str];
  return ch.reduce((w, c, i) => w + (font[c] ? font[c][0] : font === ZH ? SPACE.zh : SPACE.lat) * k * sx + (i < ch.length - 1 ? track : 0), 0);
}
function text(font, str, { size = 10, x = 0, y = 0, track = 0, sx = 1, rot = 0, align = 'left' } = {}) {
  const k = size / 1000, w = measure(font, str, size, track, sx);
  const r = rot * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  let pen = align === 'center' ? -w / 2 : align === 'right' ? -w : 0, d = '';
  for (const ch of str) {
    const g = font[ch];
    if (!g && ch !== ' ') throw new Error(`print: no glyph for "${ch}" (add it to print-glyphs.gen.mjs)`);
    if (g) d += tp(g[1], [c * k * sx, s * k * sx, -s * k, c * k, x + c * pen, y + s * pen]);
    pen += (g ? g[0] : font === ZH ? SPACE.zh : SPACE.lat) * k * sx + track;
  }
  return { d, w };
}
// Text along a circle. top: reads clockwise, glyphs stand outward on radius r. bottom: reads left→right along the
// bottom of the circle, glyphs hang inward from radius r.
function arcText(font, str, cx, cy, r, { size = 7, track = 0, bottom = false, mid = bottom ? 90 : -90 } = {}) {
  const k = size / 1000, w = measure(font, str, size, track);
  const span = w / r * 180 / Math.PI;
  let pen = 0, d = '';
  for (const ch of str) {
    const g = font[ch], adv = (g ? g[0] : font === ZH ? SPACE.zh : SPACE.lat) * k;
    const th = bottom ? mid + span / 2 - (pen + adv / 2) / r * 180 / Math.PI : mid - span / 2 + (pen + adv / 2) / r * 180 / Math.PI;
    const a = th * Math.PI / 180, rot = bottom ? th - 90 : th + 90;
    const rr = rot * Math.PI / 180, c = Math.cos(rr), s = Math.sin(rr);
    const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
    if (g) d += tp(g[1], [c * k, s * k, -s * k, c * k, px - c * adv / 2, py - s * adv / 2]);
    pen += adv + track;
  }
  return d;
}
// Halftone patch as zero-length round-capped strokes (one path per radius), hex grid of pitch s.
function dotsD(x0, y0, w, hh, s) {
  let d = '';
  for (let j = 0, y = y0 + s / 2; y < y0 + hh; j++, y += s * 0.866)
    for (let x = x0 + (j % 2 ? s : s / 2); x < x0 + w; x += s) d += `M${f(x)} ${f(y)}h0`;
  return d;
}
// Sine polyline
function wave(x0, x1, y, amp, per, phase = 0, step = 1.5) {
  let d = '';
  for (let x = x0; x <= x1 + 0.01; x += step) d += (x === x0 ? 'M' : 'L') + f(x) + ' ' + f(y + amp * Math.sin((x - x0) / per * 2 * Math.PI + phase));
  return d;
}
// Perforated stamp outline: rectangle whose edges are bitten by semicircles (holes of radius r at pitch p).
function perforated(w, hh, r, p) {
  const nx = Math.round(w / p), ny = Math.round(hh / p), px = w / nx, py = hh / ny;
  let d = `M0 0`;
  for (let i = 0; i < nx; i++) { const c = (i + 0.5) * px; d += `L${f(c - r)} 0A${r} ${r} 0 0 0 ${f(c + r)} 0`; }
  d += `L${f(w)} 0`;
  for (let i = 0; i < ny; i++) { const c = (i + 0.5) * py; d += `L${f(w)} ${f(c - r)}A${r} ${r} 0 0 0 ${f(w)} ${f(c + r)}`; }
  d += `L${f(w)} ${f(hh)}`;
  for (let i = nx - 1; i >= 0; i--) { const c = (i + 0.5) * px; d += `L${f(c + r)} ${f(hh)}A${r} ${r} 0 0 0 ${f(c - r)} ${f(hh)}`; }
  d += `L0 ${f(hh)}`;
  for (let i = ny - 1; i >= 0; i--) { const c = (i + 0.5) * py; d += `L0 ${f(c + r)}A${r} ${r} 0 0 0 0 ${f(c - r)}`; }
  return d + 'Z';
}

// ------------------------------------------------------------------ deco stroke capitals (ported from the draft)
// Monoline strokes (w = 24 in a 100-high box), clipped flush to the cap and base lines. D M O T are new.
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
  D: { w: 80, s: [['M12 -10V110', 24], ['M12 12H36A32 38 0 0 1 36 88H12', 24]] },
  M: { w: 100, s: [['M12 112V-6L50 82L88 -6V112', 24]] },
  O: { w: 84, s: [['M12 50A30 38 0 1 1 72 50A30 38 0 1 1 12 50Z', 24]] },
  T: { w: 72, s: [['M0 12H72', 24], ['M36 -10V110', 24]] },
};
function deco(str, gap = 13) {
  let pen = 0; const byW = {}; let inl = '';
  for (const ch of str) {
    if (ch === ' ') { pen += 44; continue; }
    const L = LET[ch]; if (!L) throw new Error('print: no deco capital ' + ch);
    for (const [d, sw] of L.s) { const dd = tp(d, [1, 0, 0, 1, pen, 0]); byW[sw] = (byW[sw] || '') + dd; inl += dd; }
    pen += L.w + gap;
  }
  return { byW, inl, w: pen - gap };
}

// ------------------------------------------------------------------ geometry constants (screen / viewBox units)
const M = 18, MB = 24;                  // paper margin (sides+top) / bottom margin (holds the printer's strip)
const LB_MAX = CAMERAS.cinematic.letterbox;
const W1 = deco('PELICAN'), W2 = deco('BAY');
const LINE_W = W1.w + 57 + W2.w;       // "PELICAN BAY" on one line (space 44 + gap 13)
const SEAL = { w: 56, h: 140 };
const SUB = { h: 32 };
const SUBTXT = text(LAT, 'THE COAST ROAD  ·  BY BICYCLE', { size: 21, track: 5.2, sx: 0.92 });
const SUB_W = SUBTXT.w + 64;
// Title layouts in card-local units: pose per group {x, y, s}; bbox {x0,y0,x1,y1}.
const LAYOUTS = {
  line: { w1: { x: 0, y: 0 }, w2: { x: W1.w + 57, y: 0 }, seal: { x: LINE_W + 30, y: -4, s: 1 }, sub: { x: 4, y: 130 },
    box: [-6, -8, LINE_W + 30 + SEAL.w + 6, 166] },
  stack: { w1: { x: 0, y: 0 }, w2: { x: 0, y: 118 }, seal: { x: W2.w + 30, y: 112, s: 1 }, sub: { x: 4, y: 262 },
    box: [-6, -8, Math.max(W1.w, W2.w + 30 + SEAL.w, SUB_W) + 18, 300] },
  logo: { w1: { x: 0, y: 0 }, w2: { x: W1.w + 57, y: 0 }, seal: { x: LINE_W + 24, y: -2, s: 0.74 }, sub: { x: 4, y: 110 },
    box: [-4, -6, LINE_W + 24 + SEAL.w * 0.74 + 4, 106] },
  logoBar: { w1: { x: 0, y: 0 }, w2: { x: W1.w + 57, y: 0 }, seal: { x: LINE_W + 24, y: -2, s: 0.74 }, sub: { x: LINE_W + 24 + SEAL.w * 0.74 + 40, y: 30, s: 1.25 },
    box: [-4, -6, LINE_W + 24 + SEAL.w * 0.74 + 40 + SUB_W * 1.25 + 4, 106] },
};
const TICKET = { w: 236, h: 92 };
const SH_N = 5, SH_STEP = 1.52;        // stepped shadow: 5 plates, 7.6 units deep
const ED = text(LAT, 'PLATE C · SEVEN INKS · № 07/120', { size: 7.2, track: 1.05, align: 'right' });
const STAMP = { w: 80, h: 96 };

export const detailItems = [
  ['paper-margin', 'O', 'cream paper margin that becomes the cinematic letterbox bars'],
  ['frame-keyline', 'O', 'navy 3-unit keyline where the print meets the paper'],
  ['frame-hairline', 'O', 'outer navy hairline, a double-rule frame'],
  ['corner-sunburst', 'O', 'deco corner ornament: quarter sun with rays, bead ring and stepped keyline blocks'],
  ['edge-diamond', 'O', 'stepped deco diamond stops at the middle of each frame side'],
  ['crop-marks', 'O', 'printer\'s crop marks in the margin at each corner'],
  ['registration-mark', 'O', 'registration targets (ring, crosshair, filled quadrants) on the margins'],
  ['colour-bar', 'O', 'seven-ink colour bar: one swatch per ink of the hour'],
  ['tint-ramp', 'T', 'halftone tint ramp: five dot sizes of the cool ink'],
  ['imprint', 'O', 'imprint "PRINTED AT PELICAN BAY · 鹈鹕湾印制"'],
  ['edition-number', 'O', 'edition line "PLATE C · SEVEN INKS · № 07/120"'],
  ['title-face', 'O', 'PELICAN BAY in stroke-built deco capitals (paper ink)'],
  ['title-inline', 'T', 'vermilion inline engraved down the centre of every stroke'],
  ['title-stepped-shadow', 'O', 'navy stepped (extruded) drop shadow, 5 plates'],
  ['title-hatch-shadow', 'T', 'hatched cast shadow offset behind the extrusion'],
  ['title-label', 'O', '鹈鹕湾 vertical deco label tablet (vermilion, cream rule, navy offset)'],
  ['subtitle-band', 'O', 'navy band "THE COAST ROAD · BY BICYCLE" in cream'],
  ['band-ornament', 'O', 'swallowtail band ends with diamond studs'],
  ['ticket-card', 'O', 'ADMIT ONE coast-railway ticket: header band, deco caps, keyline'],
  ['ticket-guilloche', 'T', 'guilloche security waves printed under the ticket text'],
  ['ticket-perforation', 'O', 'tear line: dashed rule and punched perforation holes'],
  ['ticket-serial', 'O', 'matching serial numbers on ticket and stub'],
  ['ticket-route', 'O', 'route 鹈鹕湾 → 灯塔角 / PELICAN BAY → LIGHTHOUSE PT and fare class'],
  ['ticket-punch', 'O', 'conductor\'s diamond punch hole through the card'],
  ['ticket-stub', 'O', 'stub with vertical ADMIT ONE'],
  ['stamp-perforated', 'O', 'postage stamp with perforated (bitten) edge and frame rule'],
  ['stamp-vignette', 'O', 'tiny pelican riding a bicycle on the coast road, rising sun, sea'],
  ['stamp-engraving', 'T', 'engraved line shading across sky and sun'],
  ['stamp-value', 'O', 'denomination roundel 5分'],
  ['stamp-legend', 'O', 'legend 鹈鹕湾邮政 / PELICAN BAY POST'],
  ['postmark-ring', 'O', 'double-ring postmark with PELICAN BAY and 鹈鹕湾 set on the arcs'],
  ['postmark-date', 'O', 'postmark date 30 SEP 2026 between bars'],
  ['postmark-cancel', 'T', 'wavy cancellation lines struck across the stamp'],
].map(([name, kind, what]) => ({ id: `${TD}:${kind}:${name}`, layer: TD, kind, what }));
const DD = Object.fromEntries(detailItems.map(d => [d.id.split(':')[2], d.id]));

// ------------------------------------------------------------------ build
export function build({ v }) {
  const I = Object.fromEntries(['P', 'K', 'O', 'R', 'B', 'T', 'N'].map(k => [k, v('ink' + k)]));
  const tag = (name, attrs, ...kids) => h('g', { 'data-detail': DD[name], ...attrs }, ...kids);
  const txt = (s, attrs = {}) => ({ 'data-text': s, ...attrs });
  const defs = [];

  // ---- title glyph plates (defs) ----
  for (const [k, W] of [['w1', W1], ['w2', W2]]) {
    defs.push(h('clipPath', { id: `print-clip-${k}` }, h('rect', { x: -30, y: 0, width: W.w + 60, height: 100 })));
    // squeegee wipes that pull the face and inline plates across the word during the intro
    for (const pl of ['face', 'inl']) defs.push(h('clipPath', { id: `print-wipe-${pl}-${k}` }, h('rect', { 'data-ref': `print-wipe-${pl}-${k}`, x: 0, y: -40, width: 1, height: 190 })));
    defs.push(h('g', { id: `print-g-${k}`, 'clip-path': `url(#print-clip-${k})`, fill: 'none', 'stroke-miterlimit': 12 },
      Object.entries(W.byW).map(([sw, d]) => h('path', { d, 'stroke-width': sw }))));
  }
  defs.push(h('pattern', { id: 'print-hatch', width: 4.2, height: 4.2, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
    h('rect', { width: 1.5, height: 4.2, fill: I.N })));

  const word = (k, W, label) => h('g', { 'data-ref': 'print-' + k, 'data-text': label },
    tag('title-hatch-shadow', { 'data-ref': 'print-hatch-' + k }, h('use', { href: `#print-g-${k}`, transform: 'translate(15 13)', stroke: 'url(#print-hatch)' })),
    tag('title-stepped-shadow', { 'data-ref': 'print-shadow-' + k },
      Array.from({ length: SH_N }, (_, i) => h('use', { href: `#print-g-${k}`, transform: `translate(${f((SH_N - i) * SH_STEP)} ${f((SH_N - i) * SH_STEP)})`, stroke: I.N, 'data-ref': `print-sh-${k}-${SH_N - i}` }))),
    h('g', { 'clip-path': `url(#print-wipe-face-${k})`, 'data-ref': `print-wg-face-${k}` }, h('use', { href: `#print-g-${k}`, stroke: I.P, 'data-detail': DD['title-face'], 'data-ref': 'print-face-' + k })),
    h('g', { 'clip-path': `url(#print-wipe-inl-${k})`, 'data-ref': `print-wg-inl-${k}` }, h('path', { d: W.inl, fill: 'none', stroke: I.R, 'stroke-width': 2.6, 'clip-path': `url(#print-clip-${k})`, 'data-detail': DD['title-inline'], 'data-ref': 'print-inl-' + k })));

  // ---- 鹈鹕湾 label tablet ----
  const sealChars = ['鹈', '鹕', '湾'].map((ch, i) => text(ZH, ch, { size: 40, x: 8, y: 40 + i * 42 }).d).join('');
  const seal = h('g', { 'data-ref': 'print-seal' }, h('g', { 'data-ref': 'print-seal-in' }, tag('title-label', txt('鹈鹕湾'),
    h('rect', { x: 5, y: 5, width: SEAL.w, height: SEAL.h, rx: 6, fill: I.N }),
    h('rect', { x: 0, y: 0, width: SEAL.w, height: SEAL.h, rx: 6, fill: I.R }),
    h('rect', { x: 3.5, y: 3.5, width: SEAL.w - 7, height: SEAL.h - 7, rx: 4, fill: 'none', stroke: I.P, 'stroke-width': 1.6 }),
    h('path', { d: diamond(SEAL.w / 2, 3.5, 5, 3) + diamond(SEAL.w / 2, SEAL.h - 3.5, 5, 3), fill: I.P }),
    h('path', { d: sealChars, fill: I.P, stroke: I.P, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }))));

  // ---- subtitle band ----
  const bw = SUB_W, bh = SUB.h, n = 9;
  const band = `M0 0H${f(bw)}L${f(bw - n)} ${f(bh / 2)}L${f(bw)} ${f(bh)}H0L${n} ${f(bh / 2)}Z`;
  const sub = h('g', { 'data-ref': 'print-sub' }, h('g', { 'data-ref': 'print-sub-in' },
    tag('subtitle-band', txt('THE COAST ROAD · BY BICYCLE'),
      h('path', { d: band, fill: I.N }),
      h('path', { d: tp(SUBTXT.d, [1, 0, 0, 1, 32, 23.5]), fill: I.P })),
    tag('band-ornament', {},
      h('path', { d: `M1.5 3H${f(bw - 1.5)}M1.5 ${f(bh - 3)}H${f(bw - 1.5)}`, stroke: I.O, 'stroke-width': 1, fill: 'none' }),
    ),
    [20, bw - 20].map(x => tag('band-ornament', {}, h('path', { d: diamond(x, bh / 2, 5, 5), fill: I.O }), h('path', { d: diamond(x, bh / 2, 2, 2), fill: I.N })))));

  const title = h('g', { id: 'print-title', 'data-ref': 'print-title' }, word('w1', W1, 'PELICAN'), word('w2', W2, 'BAY'), seal, sub);

  // ---- border: bars (paper), keylines, hairlines (unit rects scaled per frame: filled, so no stroke distortion) ----
  // (each visible piece carries its item tag: the pieces of one item are identical instances, counted once)
  const unit = (ref, fill, item) => h('rect', { 'data-ref': ref, 'data-detail': DD[item], x: 0, y: 0, width: 1, height: 1, fill });
  const bar = (k, x, y, w, hh) => h('rect', { 'data-ref': 'print-bar' + k, 'data-detail': DD['paper-margin'], x, y, width: w, height: hh, fill: I.P });
  const border = h('g', { id: 'print-border' },
    bar('L', -1200, -1200, 1200, 3300), bar('R', 0, -1200, 1200, 3300), bar('T', -1200, -1400, 4000, 1400), bar('B', -1200, 0, 4000, 1400),
    ['hT', 'hB', 'hL', 'hR'].map(k => unit('print-' + k, I.N, 'frame-hairline')),
    ['kT', 'kB', 'kL', 'kR'].map(k => unit('print-' + k, I.N, 'frame-keyline')));

  // deco corner: art lies in +x,+y from the keyline corner at (0,0)
  const q = (r) => `M0 0H${r}A${r} ${r} 0 0 1 0 ${r}Z`;
  const rays = [30, 60].map(a => { const c = Math.cos(a * Math.PI / 180), s = Math.sin(a * Math.PI / 180); return `M0 0L${f(15 * c)} ${f(15 * s)}`; }).join('');
  const beads = [15, 45, 75].map(a => circ(20.5 * Math.cos(a * Math.PI / 180), 20.5 * Math.sin(a * Math.PI / 180), 1.3)).join('');
  const steps = rectD(28, 3, 16, 3) + rectD(28, 6, 8, 3) + rectD(3, 28, 3, 16) + rectD(6, 28, 3, 8) + rectD(48, 3, 4, 3) + rectD(3, 48, 3, 4);
  defs.push(h('g', { id: 'print-corner' },
    h('path', { d: q(26), fill: I.P }),
    h('path', { d: q(14), fill: I.R }),
    h('path', { d: rays, stroke: I.P, 'stroke-width': 1.6, fill: 'none' }),
    h('path', { d: `M26 0A26 26 0 0 1 0 26M17 0A17 17 0 0 1 0 17`, fill: 'none', stroke: I.N, 'stroke-width': 1.3 }),
    h('path', { d: beads + steps + q(4.5), fill: I.N })));
  defs.push(h('g', { id: 'print-crop' },
    h('rect', { x: -17, y: -17, width: 17, height: 17, fill: 'none' }),   // hit area of the mark's corner cell
    h('path', { d: 'M1.5 -17V-10M-17 1.5H-10', stroke: I.N, 'stroke-width': 0.9, fill: 'none' })));
  // stepped edge diamond, centred on the keyline centre (0,0), art toward +y
  defs.push(h('g', { id: 'print-edge' },
    h('path', { d: rectD(-44, 1.5, 28, 3) + rectD(16, 1.5, 28, 3) + rectD(-30, 4.5, 14, 2.5) + rectD(16, 4.5, 14, 2.5), fill: I.N }),
    h('path', { d: diamond(0, 0, 14, 8.5), fill: I.P, stroke: I.N, 'stroke-width': 1.6, 'stroke-linejoin': 'miter' }),
    h('path', { d: diamond(0, 0, 6.5, 4), fill: I.R })));
  defs.push(h('g', { id: 'print-reg' },
    h('circle', { r: 5.2, fill: I.P, stroke: I.N, 'stroke-width': 0.9 }),
    h('path', { d: 'M0 0H3.2A3.2 3.2 0 0 1 0 3.2ZM0 0H-3.2A3.2 3.2 0 0 1 0 -3.2Z', fill: I.N }),
    h('path', { d: 'M-9 0H9M0 -9V9', stroke: I.N, 'stroke-width': 0.8 })));
  const ornaments = h('g', { id: 'print-ornaments' },
    ['TL', 'TR', 'BL', 'BR'].map(k => h('use', { href: '#print-corner', 'data-ref': 'print-c' + k, 'data-detail': DD['corner-sunburst'] })),
    ['TL', 'TR', 'BL', 'BR'].map(k => h('use', { href: '#print-crop', 'data-ref': 'print-crop' + k, 'data-detail': DD['crop-marks'] })),
    ['T', 'B', 'L', 'R'].map(k => h('use', { href: '#print-edge', 'data-ref': 'print-e' + k, 'data-detail': DD['edge-diamond'] })),
    ['L', 'R', 'B'].map(k => h('use', { href: '#print-reg', 'data-ref': 'print-reg' + k, 'data-detail': DD['registration-mark'] })));

  // ---- printer's strip (bottom margin) ----
  const IMPRINT_LAT = text(LAT, 'PRINTED AT PELICAN BAY', { size: 7.2, track: 1.25, x: 0, y: 0 });
  const IMPRINT_ZH = text(ZH, '鹈鹕湾印制', { size: 8.4, track: 0.8, x: IMPRINT_LAT.w + 14, y: 0.6 });
  const imprint = h('g', { 'data-ref': 'print-imprint' }, tag('imprint', txt('PRINTED AT PELICAN BAY · 鹈鹕湾印制'),
    h('path', { d: IMPRINT_LAT.d + IMPRINT_ZH.d + circ(IMPRINT_LAT.w + 7, -2.6, 1.1), fill: I.N })));
  const edition = h('g', { 'data-ref': 'print-edition' }, tag('edition-number', txt('PLATE C · SEVEN INKS · № 07/120'), h('path', { d: ED.d, fill: I.N })));
  const inks = ['P', 'K', 'O', 'R', 'B', 'T', 'N'];
  const SW = 12, SH = 8;
  const colour = h('g', { 'data-ref': 'print-colour' },
    tag('colour-bar', {}, inks.map((k, i) => h('rect', { x: i * SW, y: -SH / 2, width: SW, height: SH, fill: I[k] })),
      h('rect', { x: 0, y: -SH / 2, width: SW * 7, height: SH, fill: 'none', stroke: I.N, 'stroke-width': 0.7 })),
    tag('tint-ramp', { 'data-ref': 'print-tint' },
      h('rect', { x: -6 - 5 * SW, y: -SH / 2, width: 5 * SW, height: SH, fill: I.P, stroke: I.N, 'stroke-width': 0.7 }),
      [0.45, 0.7, 0.95, 1.2, 1.5].map((r, i) => h('path', { d: dotsD(-6 - (5 - i) * SW, -SH / 2, SW, SH, 3), stroke: I.B, 'stroke-width': f(r * 2), 'stroke-linecap': 'round', fill: 'none' }))));
  const strip = h('g', { id: 'print-strip' }, imprint, edition, colour);

  // ---- ADMIT ONE ticket (local 0..236 × 0..92) ----
  const T = TICKET, sx0 = 178;
  let perfHoles = '';
  for (let y = 9; y <= T.h - 8; y += 7.4) perfHoles += circ(sx0, y, 1.35, true);
  const punch = `M156 57L161 63L156 69L151 63Z`;
  const card = roundRect(0, 0, T.w, T.h, 5) + perfHoles + punch;
  let guil = '';
  for (let i = 0; i < 6; i++) { guil += wave(8, 172, 30 + i * 9.5, 2.6, 22, i * 0.9); guil += wave(8, 172, 30 + i * 9.5, 2.6, 22, i * 0.9 + Math.PI); }
  const ADMIT = deco('ADMIT ONE');
  const aS = 0.205, aX = 12, aY = 28;
  const admit = Object.entries(ADMIT.byW).map(([sw, d]) => [sw, tp(d, [aS, 0, 0, aS, aX, aY])]);
  const hdr = text(LAT, 'COAST ROAD RAILWAY', { size: 7.4, track: 1.2, x: 12, y: 18.2 });
  const hdrZh = text(ZH, '海滨路', { size: 9, track: 0.6, x: 167, y: 18.8, align: 'right' });
  const route = text(ZH, '鹈鹕湾', { size: 10, x: 12, y: 64 }).d + text(ZH, '灯塔角', { size: 10, x: 64, y: 64 }).d
    + text(LAT, 'PELICAN BAY → LIGHTHOUSE PT', { size: 5.6, track: 0.55, x: 12, y: 73 }).d;
  const arrow = 'M46 59.5H59M55.5 56.5L59.5 59.5L55.5 62.5';
  const fareL = text(LAT, 'SINGLE · 3RD CLASS', { size: 5.2, track: 0.6, x: 170, y: 84, align: 'right' });
  const fare = fareL.d + text(ZH, '单程', { size: 6.4, x: 170 - fareL.w - 4, y: 84.4, align: 'right' }).d;
  const serialA = text(LAT, '№ 0719', { size: 9.5, track: 0.5, x: 12, y: 85 }).d, serialB = text(LAT, '0719', { size: 8.5, track: 0.6, x: 227.5, y: 46, rot: -90, align: 'center' }).d;
  const stubTxt = text(LAT, 'ADMIT ONE', { size: 8.6, track: 1.2, x: 199, y: 46, rot: -90, align: 'center' }).d;
  const stubMark = text(LAT, '1', { size: 13, x: 206, y: 18, align: 'center' }).d;
  const ticket = h('g', { 'data-ref': 'print-ticket' },
    tag('ticket-card', txt('COAST ROAD RAILWAY 海滨路 · ADMIT ONE'),
      h('path', { d: tp(card, [1, 0, 0, 1, 2.5, 2.5]), fill: I.N, 'fill-rule': 'evenodd' }),
      h('path', { d: card, fill: I.P, 'fill-rule': 'evenodd' }),
      h('path', { d: rectD(4.5, 4.5, sx0 - 9, T.h - 9) + rectD(sx0 + 4.5, 4.5, T.w - sx0 - 9, T.h - 9), fill: 'none', stroke: I.N, 'stroke-width': 0.9 }),
    ),
    tag('ticket-guilloche', {}, h('rect', { x: 8, y: 25, width: sx0 - 16, height: T.h - 33, fill: I.P }), h('path', { d: guil, fill: 'none', stroke: I.K, 'stroke-width': 0.75, 'clip-path': 'url(#print-clip-guil)' })),
    tag('ticket-card', {},
      h('path', { d: rectD(8, 8, sx0 - 16, 14), fill: I.R }),
      h('path', { d: hdr.d + hdrZh.d, fill: I.P }),
      admit.map(([sw, d]) => h('path', { d, fill: 'none', stroke: I.R, 'stroke-width': sw * aS, transform: 'translate(0.9 0.9)', 'clip-path': 'url(#print-clip-admit)' })),
      admit.map(([sw, d]) => h('path', { d, fill: 'none', stroke: I.N, 'stroke-width': sw * aS, 'clip-path': 'url(#print-clip-admit)' }))),
    tag('ticket-route', txt('鹈鹕湾 → 灯塔角 · PELICAN BAY → LIGHTHOUSE PT · SINGLE · 3RD CLASS 单程'),
      h('path', { d: route + fare, fill: I.N }), h('path', { d: arrow, fill: 'none', stroke: I.N, 'stroke-width': 1.3 })),
    tag('ticket-serial', txt('№ 0719'), h('path', { d: serialA, fill: I.R })),
    tag('ticket-serial', txt('0719'), h('path', { d: serialB, fill: I.R })),
    tag('ticket-perforation', {}, h('path', { d: `M${sx0} 4V${T.h - 4}`, stroke: I.N, 'stroke-width': 0.8, 'stroke-dasharray': '2.2 5.2', 'stroke-dashoffset': 3.5, fill: 'none' }),
      h('path', { d: perfHoles.replace(/1\.35/g, '1.9'), fill: 'none', stroke: I.K, 'stroke-width': 0.6 })),
    tag('ticket-punch', {}, h('path', { d: 'M156 55.5L162.5 63L156 70.5L149.5 63Z', fill: 'none', stroke: I.K, 'stroke-width': 1.2 })),
    tag('ticket-stub', txt('ADMIT ONE 1'), h('path', { d: stubTxt + stubMark, fill: I.N })));
  defs.push(h('clipPath', { id: 'print-clip-admit' }, h('rect', { x: 0, y: aY, width: 175, height: 100 * aS })));
  defs.push(h('clipPath', { id: 'print-clip-guil' }, h('rect', { x: 5, y: 23, width: sx0 - 10, height: T.h - 28 })));

  // ---- postage stamp (local 0..80 × 0..96) + postmark ----
  const S = STAMP;
  const vg = { x: 8, y: 8, w: S.w - 16, h: 60 };
  let eng = '', engSun = '';
  for (let y = vg.y + 2; y < vg.y + 36; y += 2.4) eng += `M${vg.x} ${f(y)}H${vg.x + vg.w}`;
  for (let y = vg.y + 28; y < vg.y + 42; y += 2.2) engSun += `M${vg.x + 36} ${f(y)}H${vg.x + vg.w - 2}`;
  const seaY = vg.y + 42, roadY = vg.y + 50;
  const sunC = [vg.x + 46, seaY];
  const bikeR = 6;
  const wR = [vg.x + 17, roadY + 3.2], wF = [vg.x + 37, roadY + 3.2];
  const miniBike = `M${wR[0]} ${wR[1]}L${vg.x + 26} ${wR[1]}L${vg.x + 23.5} ${roadY - 6}M${vg.x + 26} ${wR[1]}L${vg.x + 34} ${roadY - 6.5}L${wF[0]} ${wF[1]}M${vg.x + 23.5} ${roadY - 6}L${vg.x + 34} ${roadY - 6.5}M${wR[0]} ${wR[1]}L${vg.x + 23.5} ${roadY - 6}M${vg.x + 34} ${roadY - 6.5}L${vg.x + 33} ${roadY - 9.5}`;
  const px = vg.x, py = roadY;   // mini pelican anchors
  const pBody = `M${px + 13} ${py - 11}C${px + 14} ${py - 18} ${px + 25} ${py - 20} ${px + 30} ${py - 16}C${px + 32} ${py - 13} ${px + 28} ${py - 9} ${px + 22} ${py - 8.5}C${px + 18} ${py - 8} ${px + 14} ${py - 8.5} ${px + 13} ${py - 11}Z`;
  const pNeck = `M${px + 27} ${py - 16}C${px + 30} ${py - 21} ${px + 27} ${py - 25} ${px + 30} ${py - 29}`;
  const pBill = `M${px + 31} ${py - 31}L${px + 43} ${py - 26.5}L${px + 31} ${py - 28.2}Z`;
  const pPouch = `M${px + 31.5} ${py - 28.4}L${px + 41} ${py - 26.6}Q${px + 34} ${py - 24.2} ${px + 31.5} ${py - 27}Z`;
  const pWing = `M${px + 17} ${py - 14}Q${px + 24} ${py - 16.5} ${px + 31} ${py - 12.5}L${px + 21} ${py - 11}Z`;
  const pLeg = `M${px + 22} ${py - 9}L${px + 26} ${py - 3.5}L${px + 26.5} ${roadY + 3}`;
  const legend = text(ZH, '鹈鹕湾邮政', { size: 8.6, track: 0.5, x: S.w / 2, y: 83, align: 'center' }).d;
  const legendLat = text(LAT, 'PELICAN BAY POST', { size: 4.6, track: 0.6, x: S.w / 2, y: 89.5, align: 'center' }).d;
  const value = text(LAT, '5', { size: 10.5, x: 13.6, y: 21, align: 'center' }).d + text(ZH, '分', { size: 5.6, x: 20.6, y: 21.4, align: 'center' }).d;
  defs.push(h('clipPath', { id: 'print-clip-vg' }, h('rect', { x: vg.x, y: vg.y, width: vg.w, height: vg.h })));
  const stamp = h('g', { 'data-ref': 'print-stamp' },
    h('path', { d: tp(perforated(S.w, S.h, 2.3, 8), [1, 0, 0, 1, 2, 2.2]), fill: I.N }),
    tag('stamp-vignette', { 'clip-path': 'url(#print-clip-vg)' },
      h('path', { d: rectD(vg.x, vg.y, vg.w, vg.h), fill: I.B }),
      h('path', { d: circ(sunC[0], sunC[1], 12), fill: I.K }),
      h('path', { d: rectD(vg.x, seaY, vg.w, roadY - seaY) + rectD(vg.x, roadY + 7, vg.w, vg.h), fill: I.N }),
      h('path', { d: rectD(vg.x, roadY, vg.w, 7), fill: I.O }),
      h('path', { d: wave(vg.x, vg.x + vg.w, seaY + 3, 0.7, 5) + wave(vg.x + 3, vg.x + vg.w, seaY + 6, 0.7, 5, 2), fill: 'none', stroke: I.B, 'stroke-width': 0.7 }),
      h('path', { d: `M${vg.x + 48} ${seaY + 2.6}h14M${vg.x + 50} ${seaY + 5.2}h10`, stroke: I.K, 'stroke-width': 0.9 }),
      h('path', { d: circ(...wR, bikeR) + circ(...wF, bikeR), fill: 'none', stroke: I.N, 'stroke-width': 1.5 }),
      h('path', { d: miniBike, fill: 'none', stroke: I.T, 'stroke-width': 1.25, 'stroke-linecap': 'round' }),
      h('path', { d: `M${px + 8} ${py - 12}Q${px + 14} ${py - 14} ${px + 27} ${py - 16}`, stroke: I.R, 'stroke-width': 1.4, 'stroke-dasharray': '1.6 1.2', fill: 'none' }),
      h('path', { d: pLeg, fill: 'none', stroke: I.O, 'stroke-width': 1 }),
      h('path', { d: pBody + circ(px + 30.5, py - 29.5, 2.7), fill: I.P }),
      h('path', { d: pNeck, fill: 'none', stroke: I.P, 'stroke-width': 2.6, 'stroke-linecap': 'round' }),
      h('path', { d: pWing, fill: I.N }),
      h('path', { d: pBill + pPouch, fill: I.O }),
      h('path', { d: circ(px + 31, py - 30, 0.55), fill: I.N })),
    tag('stamp-engraving', { 'clip-path': 'url(#print-clip-vg)' },
      h('path', { d: eng, stroke: I.P, 'stroke-width': 0.6, 'stroke-opacity': 0.9, fill: 'none', 'clip-path': 'url(#print-clip-sky)' }),
      h('path', { d: engSun, stroke: I.O, 'stroke-width': 0.8, fill: 'none', 'clip-path': 'url(#print-clip-sun)' })),
    tag('stamp-perforated', {},
      h('path', { d: perforated(S.w, S.h, 2.3, 8) + rectCCW(vg.x, vg.y, vg.w, vg.h), fill: I.P }),
      h('path', { d: rectD(5.5, 5.5, S.w - 11, S.h - 11) + rectD(vg.x, vg.y, vg.w, vg.h), fill: 'none', stroke: I.N, 'stroke-width': 0.8 })),
    tag('stamp-value', txt('5分'), h('path', { d: circ(16.5, 17.5, 8), fill: I.R }), h('path', { d: value, fill: I.P })),
    tag('stamp-legend', txt('鹈鹕湾邮政 PELICAN BAY POST'), h('path', { d: legend + legendLat, fill: I.N })));
  defs.push(h('clipPath', { id: 'print-clip-sky' }, h('path', { d: `M${vg.x} ${vg.y}H${vg.x + vg.w}V${vg.y + 16}C${vg.x + 50} ${vg.y + 22} ${vg.x + 20} ${vg.y + 8} ${vg.x} ${vg.y + 26}Z` })));
  defs.push(h('clipPath', { id: 'print-clip-sun' }, h('path', { d: circ(sunC[0], sunC[1], 12) })));

  const PMC = [96, 20], PR = 27;
  const pmTop = arcText(LAT, 'PELICAN BAY', PMC[0], PMC[1], 19.6, { size: 6, track: 1.1 });
  const pmBot = arcText(ZH, '鹈鹕湾', PMC[0], PMC[1], 25.4, { size: 6.4, track: 2.2, bottom: true });
  const pmDate = text(LAT, '30 SEP 2026', { size: 5.4, track: 0.35, x: PMC[0], y: PMC[1] + 2, align: 'center' }).d;
  let cancel = '';
  for (let i = 0; i < 4; i++) cancel += wave(PMC[0] - PR - 70, PMC[0] - PR - 3, PMC[1] - 13 + i * 6.2, 2, 15, 0.4);
  const postmark = h('g', { 'data-ref': 'print-postmark', transform: 'rotate(-9 96 20)' },
    tag('postmark-cancel', {}, h('path', { d: cancel, fill: 'none', stroke: I.N, 'stroke-width': 1.05 })),
    tag('postmark-ring', txt('PELICAN BAY 鹈鹕湾'),
      h('path', { d: circ(PMC[0], PMC[1], PR) + circ(PMC[0], PMC[1], 17.6), fill: 'none', stroke: I.N, 'stroke-width': 1.2 }),
      h('path', { d: pmTop + pmBot + circ(PMC[0] - 24.6, PMC[1] + 5, 1) + circ(PMC[0] + 24.6, PMC[1] + 5, 1), fill: I.N })),
    tag('postmark-date', txt('30 SEP 2026'),
      h('path', { d: pmDate, fill: I.N }), h('path', { d: `M${PMC[0] - 13} ${PMC[1] - 5.5}H${PMC[0] + 13}M${PMC[0] - 13} ${PMC[1] + 5.2}H${PMC[0] + 13}`, stroke: I.N, 'stroke-width': 0.9 })));
  const post = h('g', { 'data-ref': 'print-post' }, h('g', { transform: 'rotate(6 40 48)' }, stamp), postmark);

  const root = h('g', { id: 'print-root', 'data-ref': 'print-root' }, border, ornaments, strip, h('g', { id: 'print-ephemera', 'data-ref': 'print-ephemera' }, ticket, post), title);
  return { defs: defs.join(''), layers: { 'L-letterbox': root } };
}

// ------------------------------------------------------------------ runtime
function fitScale(zone, box, maxS) {
  const w = box[2] - box[0], hh = box[3] - box[1];
  const zw = zone[2] - zone[0], zh = zone[3] - zone[1];
  if (zw <= 0 || zh <= 0) return 0;
  return Math.min(maxS, zw / w, zh / hh);
}
// Best placement of a layout among free zones: -> {X, Y, S} (card origin in screen units and scale)
function place(layoutNames, zones, maxS, alignRight) {
  let best = null;
  for (const name of layoutNames) {
    const L = LAYOUTS[name];
    for (const z of zones) {
      const s = fitScale(z, L.box, maxS);
      const score = name === 'stack' ? s * 0.62 : s;
      if (!best || score > best.score + 1e-6) {
        const w = (L.box[2] - L.box[0]) * s;
        const slack = z[2] - z[0] - w;
        const x0 = z.right || alignRight ? z[2] - w : z[0] + Math.min(slack, z.inset || 0);
        best = { name, score, S: s, X: x0 - L.box[0] * s, Y: z[1] - L.box[1] * s };
      }
    }
  }
  return best;
}

export function attach(svg, ctx) {
  const doc = svg.ownerDocument, view = doc.defaultView;
  const R = {};
  for (const el of svg.querySelectorAll('[data-ref^="print-"]')) R[el.getAttribute('data-ref').slice(6)] = el;
  // draw above the lead's plain letterbox rects: the paper margin IS the letterbox in style C
  const host = svg.querySelector('#L-letterbox');
  if (R.root && host) host.appendChild(R.root);

  const cache = new Map();
  const set = (el, name, val) => { if (!el) return; const k = el; let c = cache.get(k); if (!c) cache.set(k, c = {}); if (c[name] !== val) { c[name] = val; el.setAttribute(name, val); } };

  // visible viewBox rectangle (preserveAspectRatio slice)
  let V = { x0: 0, y0: 0, x1: VIEW.w, y1: VIEW.h, w: VIEW.w, h: VIEW.h };
  const measureV = () => {
    const r = svg.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const s = Math.max(r.width / VIEW.w, r.height / VIEW.h), w = r.width / s, hh = r.height / s;
    V = { x0: VIEW.cx - w / 2, y0: VIEW.cy - hh / 2, x1: VIEW.cx + w / 2, y1: VIEW.cy + hh / 2, w, h: hh, left: r.left, top: r.top, s };
  };
  measureV();
  // the UI control card (an HTML overlay that docks to a free corner): the ephemera keep clear of it
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

  // skip the intro on any key / click (deterministic: the skip is pinned to the sim time it happened at)
  let skipReq = false, skipAt = Infinity, lastT = 0;
  const skip = () => { skipReq = true; };
  doc.addEventListener('keydown', skip, true);
  doc.addEventListener('pointerdown', skip, true);

  const riderBox = (cam, pose) => {
    const z = cam.zoom, oy = GROUND_Y + (pose ? pose.riderY || 0 : 0);
    const X = x => VIEW.cx + z * (x - cam.fx), Y = y => VIEW.cy + z * (y - cam.fy);
    const pad = 14 + Math.abs(cam.roll || 0) * 8;
    return [X(RIDER_X - 262) - pad, Y(oy - 572) - pad, X(RIDER_X + 305) + pad, Y(oy + 6) + pad];
  };

  return {
    update(frame) {
      const t = frame.t, cam = frame.cam || { zoom: 1, fx: 800, fy: 450, letterbox: 0 };
      if (t + 1e-6 < lastT && t < skipAt) skipAt = Infinity;   // replay from earlier: the intro plays again
      lastT = t;
      if (skipReq) { skipReq = false; if (t < 4.2) skipAt = Math.min(skipAt, t); }
      const reduced = frame.reduced;
      const lb = Math.max(0, cam.letterbox || 0);
      const kc = easeInOut(clamp01((lb - M) / (LB_MAX - M)));      // 0 poster → 1 cinematic bars

      // ---- border ----
      const yT = V.y0 + Math.max(M, lb), yB = V.y1 - Math.max(MB, lb), xL = V.x0 + M, xR = V.x1 - M;
      set(R.barL, 'transform', `translate(${f(xL)} 0)`); set(R.barR, 'transform', `translate(${f(xR)} 0)`);
      set(R.barT, 'transform', `translate(0 ${f(yT)})`); set(R.barB, 'transform', `translate(0 ${f(yB)})`);
      const ur = (el, x, y, w, hh) => set(el, 'transform', `translate(${f(x)} ${f(y)}) scale(${f(w)} ${f(hh)})`);
      ur(R.kT, xL, yT, xR - xL, 3); ur(R.kB, xL, yB - 3, xR - xL, 3); ur(R.kL, xL, yT, 3, yB - yT); ur(R.kR, xR - 3, yT, 3, yB - yT);
      const hg = 7;
      ur(R.hT, xL - hg, yT - hg - 1, xR - xL + 2 * hg, 1); ur(R.hB, xL - hg, yB + hg - 1, xR - xL + 2 * hg, 1);
      ur(R.hL, xL - hg - 1, yT - hg - 1, 1, yB - yT + 2 * hg + 1); ur(R.hR, xR + hg, yT - hg - 1, 1, yB - yT + 2 * hg + 1);
      set(R.cTL, 'transform', `translate(${f(xL)} ${f(yT)})`); set(R.cTR, 'transform', `translate(${f(xR)} ${f(yT)}) scale(-1 1)`);
      set(R.cBL, 'transform', `translate(${f(xL)} ${f(yB)}) scale(1 -1)`); set(R.cBR, 'transform', `translate(${f(xR)} ${f(yB)}) scale(-1 -1)`);
      set(R.cropTL, 'transform', `translate(${f(xL)} ${f(yT)})`); set(R.cropTR, 'transform', `translate(${f(xR)} ${f(yT)}) scale(-1 1)`);
      set(R.cropBL, 'transform', `translate(${f(xL)} ${f(yB)}) scale(1 -1)`); set(R.cropBR, 'transform', `translate(${f(xR)} ${f(yB)}) scale(-1 -1)`);
      const cx = (xL + xR) / 2, cy = (yT + yB) / 2;
      set(R.eT, 'transform', `translate(${f(cx)} ${f(yT + 1.5)})`); set(R.eB, 'transform', `translate(${f(cx)} ${f(yB - 1.5)}) scale(1 -1)`);
      set(R.eL, 'transform', `translate(${f(xL + 1.5)} ${f(cy)}) rotate(-90)`); set(R.eR, 'transform', `translate(${f(xR - 1.5)} ${f(cy)}) rotate(90)`);
      set(R.regL, 'transform', `translate(${f(V.x0 + 7.5)} ${f(cy)})`); set(R.regR, 'transform', `translate(${f(V.x1 - 7.5)} ${f(cy)})`);
      // printer's strip along the bottom edge of the paper
      const sy = V.y1 - 8.6;
      set(R.regB, 'transform', `translate(${f(cx)} ${f(sy)})`);
      const narrow = V.w < 760;
      set(R.imprint, 'transform', `translate(${f(xL + 22)} ${f(sy + 2.7)})`);
      set(R.edition, 'transform', `translate(${f(xR - 22)} ${f(sy + 2.7)})`);
      set(R.edition, 'opacity', narrow ? 0 : 1);
      set(R.regB, 'opacity', narrow ? 0 : 1);
      set(R.tint, 'opacity', V.w < 520 ? 0 : 1);
      set(R.colour, 'transform', `translate(${f(narrow ? xR - 22 - 7 * 12 : xR - 22 - ED.w - 16 - 7 * 12)} ${f(sy)})`);

      // ---- ephemera: ticket + stamp/postmark (bottom-right corner; into the bars in cinematic) ----
      const es = Math.min(1, (V.w - 40) / 330);
      const exR = xR - 26, eyB = yB - 18;
      // wide poses (screen)
      const tW = { x: exR - TICKET.w * es, y: eyB - TICKET.h * es - 2, r: -4, s: es };
      const pW = { x: tW.x - 76 * es, y: eyB - 118 * es, r: 0, s: es };
      // cinematic poses: ticket in the bottom bar, stamp + postmark in the top bar
      const barHb = lb - MB - 12;
      const ts = Math.max(0.3, Math.min(1, barHb / TICKET.h));
      const tC = { x: exR - TICKET.w * ts, y: V.y1 - lb + 10, r: 0, s: ts };
      const pC = { x: tC.x - 80 * ts, y: tC.y - 22 * ts, r: 0, s: ts };   // stamp stuck across the bar's edge
      const mix = (a, b) => ({ x: lerp(a.x, b.x, kc), y: lerp(a.y, b.y, kc), r: lerp(a.r, b.r, kc), s: lerp(a.s, b.s, kc) });
      const tp_ = mix(tW, tC), pp = mix(pW, pC);
      // corner choice: bottom-right, else bottom-left, else hidden (never under the UI card or the rider)
      measureUI(frame.dt === 0);
      const rbE = riderBox(cam, frame.pose);
      const eBox = [pp.x - 4, pp.y - 6, exR + 6, Math.max(tp_.y + (TICKET.h + 12) * tp_.s, eyB + 6)];
      const hit = (a, b) => b && a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
      const shiftL = xL + 26 - eBox[0];
      const boxL = [eBox[0] + shiftL, eBox[1], eBox[2] + shiftL, eBox[3]];
      let dx = 0, show = 1;
      if (hit(eBox, uiBox)) { if (!hit(boxL, uiBox) && !(kc < 0.5 && hit(boxL, rbE))) dx = shiftL; else show = 0; }
      tp_.x += dx; pp.x += dx;
      set(R.ephemera, 'opacity', show);
      set(R.ticket, 'transform', `translate(${f(tp_.x)} ${f(tp_.y)}) rotate(${f(tp_.r)}) scale(${f(tp_.s)})`);
      set(R.post, 'transform', `translate(${f(pp.x)} ${f(pp.y)}) rotate(${f(pp.r)}) scale(${f(pp.s)})`);

      // ---- title card ----
      const rb = riderBox(cam, frame.pose);
      const ti = t >= skipAt ? 99 : t;
      const inset = 38;
      const top = Object.assign([xL + 14, yT + 14, xR - 14, Math.min(rb[1] - 6, yB - 14)], { inset });
      const left = Object.assign([xL + 14, yT + 14, Math.min(rb[0] - 6, xR - 14), yB - 150], { inset: 12 });
      const right = Object.assign([Math.max(rb[2] + 6, xL + 14), yT + 14, xR - 14, pp.y - 8], { right: true });
      const bar = Object.assign([xL + 20, V.y0 + 12, xR - 20, yT - 12], { inset: 10 });
      // poster placement (free space around the rider) and bar placement (inside the cinematic top bar), blended by kc
      const cardP = place(['line', 'stack'], [top, left, right], 1.12), cardB = place(['line'], [bar], 1.12);
      const logoP = place(['logo'], [Object.assign([xL + 14, yT + 12, xR - 14, Math.min(rb[1] - 4, yT + 12 + 42)], { inset: 6 }),
        Object.assign([xL + 14, yT + 12, Math.min(rb[0] - 4, xL + 14 + 330), yT + 12 + 42], { inset: 6 })], 0.31);
      const logoB = place(['logoBar'], [bar], 0.46);

      // intro plates
      const E = reduced ? () => 1 : (a, d) => clamp01((ti - a) / d);
      const shE = easeOut(E(0.12, 0.45)), sealE = E(1.18, 0.32), subE = easeOut(E(1.42, 0.42));
      let shrink = easeInOut(clamp01((ti - 3.55) / 0.62));
      let alpha = 1;
      if (reduced) { shrink = ti < 3.9 ? 0 : 1; alpha = ti < 3.6 ? 1 : ti < 3.9 ? 1 - (ti - 3.6) / 0.3 : Math.min(1, (ti - 3.9) / 0.35); }
      if (ti >= 99) shrink = 1;
      const at = (pl, g) => { const a = LAYOUTS[pl.name][g]; return [pl.X + pl.S * a.x, pl.Y + pl.S * a.y, pl.S * (a.s || 1)]; };
      const mix3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
      const pose = g => {
        const c = mix3(at(cardP, g), at(cardB, g), kc), l = mix3(at(logoP, g), at(logoB, g), kc), p = mix3(c, l, shrink);
        return `translate(${f(p[0])} ${f(p[1])}) scale(${f(p[2])})`;
      };
      set(R.w1, 'transform', pose('w1')); set(R.w2, 'transform', pose('w2'));
      set(R.seal, 'transform', pose('seal')); set(R.sub, 'transform', pose('sub'));
      set(R.title, 'opacity', f(alpha));
      const subRoll = lerp(clamp01(1 - shrink * 1.4), 1, kc);   // the band rolls up into the logo, unrolls in the bar
      const WW = { w1: W1.w, w2: W2.w };
      const wipe = { face: { w1: E(0.42, 0.4), w2: E(0.74, 0.22) }, inl: { w1: E(0.9, 0.3), w2: E(1.08, 0.18) } };
      for (const k of ['w1', 'w2']) {
        for (const pl of ['face', 'inl']) { const e = wipe[pl][k]; set(R[`wipe-${pl}-${k}`], 'transform', `translate(-30 0) scale(${e >= 1 ? 4000 : f(Math.max(0.001, (WW[k] + 60) * e))} 1)`);
          set(R[`wg-${pl}-${k}`], 'clip-path', e >= 1 ? 'none' : `url(#print-wipe-${pl}-${k})`); }   // no clip once pulled
        for (let i = 1; i <= SH_N; i++) set(R[`sh-${k}-${i}`], 'transform', `translate(${f(i * SH_STEP * shE)} ${f(i * SH_STEP * shE)})`);
        set(R['shadow-' + k], 'opacity', f(Math.min(1, shE * 2.5)));
        set(R['hatch-' + k], 'opacity', f(shE));
        set(R['hatch-' + k], 'display', shrink >= 1 && kc < 0.01 ? 'none' : 'inline');   // too fine for the small logo
        const fe = easeOut(wipe.face[k]);
        set(R['face-' + k], 'transform', `translate(${f(-7 * (1 - fe))} ${f(-5 * (1 - fe))})`);   // drops into register
      }
      const sb = sealE > 0 ? backOut(sealE) : 0;
      set(R['seal-in'], 'transform', `translate(28 70) rotate(${f(-10 * (1 - sealE))}) scale(${f(sealE > 0 ? 1.7 - 0.7 * sb : 1.7)}) translate(-28 -70)`);
      set(R['seal-in'], 'opacity', sealE > 0 ? 1 : 0);
      set(R['sub-in'], 'transform', `scale(${f(Math.max(0.001, subE * subRoll))} 1)`);
    },
  };
}
