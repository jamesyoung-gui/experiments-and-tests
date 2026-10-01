// OWNER: fx (lighting pass, "Neon Pelican" STYLE-X §1 lighting language). Built and attached through fx.js.
// The frame-wide light that no single prop owns:
//   L-atmo        VOLUMETRIC HAZE between the city layers: the smog band the far skyline stands in (lit from below by
//                 the city, tinted by the mood), a slow drift of coloured haze pools over the harbour (magenta / cyan /
//                 amber, one composited strip that only translates), and the cold mist lying on the water.
//   L-shore       the street-level glow: warm neon air rising from the night market behind the pavement.
//   L-letterbox   the colour grade: a cinematic vignette (void corners, a violet lift at the top, a magenta floor
//                 bounce at the bottom) so no mood reads flat or daylight-ish.
// Performance (STYLE-X §2): everything here is static markup with gradients; the haze pools translate as one hoisted
// strip (a compositor move); nothing repaints per frame. The only per-frame write is that strip's translate.
import { fmt2 } from '../core/math.js';
import { h, refs } from '../core/svg.js';
import { NEON, flattenOpacity } from '../art/neon.js';

const f = fmt2;
const wrap = (x, m) => ((x % m) + m) % m;
const DD = key => ({ 'data-detail': key });
const NH = { style: 'pointer-events:none !important' };
const POOL_W = 3200;           // haze-pool strip period (layer units) at depth 0.2
const POOL_D = 0.2;

export const detailItems = [
  { id: 'fx:O:horizon-haze', layer: 'fx', kind: 'O', what: 'volumetric smog band at the foot of the skyline, lit from below by the city (mood-tinted)' },
  { id: 'fx:O:haze-pools', layer: 'fx', kind: 'O', what: 'drifting coloured haze pools over the harbour: magenta, cyan and amber light caught in the smog' },
  { id: 'fx:O:water-mist', layer: 'fx', kind: 'O', what: 'cold mist lying on the harbour water between the sea and the night market' },
  { id: 'fx:O:street-glow', layer: 'fx', kind: 'O', what: 'warm neon air rising from the night market behind the pavement' },
];
export const sheets = ['[data-ref="fx-hazePools"]'];

export function build(ctx) {
  const { v } = ctx;
  let defs = '';
  const stop = (o, c, a) => h('stop', { offset: o, 'stop-color': c, 'stop-opacity': a });
  const lin = (id, list, a = { x1: 0, y1: 0, x2: 0, y2: 1 }) => { defs += h('linearGradient', { id, ...a }, list.map(s => stop(...s)).join('')); };
  const rad = (id, list) => { defs += h('radialGradient', { id }, list.map(s => stop(...s)).join('')); };
  // horizon band: transparent → city glow → haze → transparent (y-down)
  // (retuned: less milky violet, more coloured light at the foot of the towers, so the skyline keeps its blacks)
  lin('fx-lHz', [[0, v('haze'), 0], [0.4, v('haze'), 0.16], [0.74, v('cityGlow'), 0.3], [0.9, NEON.mag, 0.1], [1, v('cityGlow'), 0]]);
  lin('fx-lMist', [[0, v('haze'), 0], [0.5, v('smogHi'), 0.11], [1, v('haze'), 0]]);
  lin('fx-lStreet', [[0, v('cityGlow'), 0], [0.7, v('cityGlow'), 0.16], [1, NEON.amber, 0.2]]);
  for (const [n, c] of [['M', NEON.mag], ['C', NEON.cyan], ['A', NEON.amber], ['V', NEON.violet]]) rad('fx-lP' + n, [[0, c, 0.26], [0.5, c, 0.1], [1, c, 0]]);
  // vignette: edges only (the middle of the frame stays untouched, and so do its tiles)
  lin('fx-lVt', [[0, NEON.void, 0.62], [0.55, '#261A45', 0.18], [1, '#261A45', 0]]);
  lin('fx-lVb', [[0, NEON.void, 0], [0.6, '#3A0F3A', 0.16], [1, NEON.void, 0.55]]);
  lin('fx-lVl', [[0, NEON.void, 0.55], [1, NEON.void, 0]], { x1: 0, y1: 0, x2: 1, y2: 0 });
  lin('fx-lVr', [[0, NEON.void, 0], [1, NEON.void, 0.55]], { x1: 0, y1: 0, x2: 1, y2: 0 });

  // every shape carries the inline no-hit style itself (a washed overlay must never win a hit test, not even when a tool
  // forces pointer-events on every element: the detail inventory does)
  const R = (x, y, w, hh, fill, o = {}) => h('rect', { x: f(x), y: f(y), width: f(w), height: f(hh), fill, ...NH, ...o });
  const E = (cx, cy, rx, ry, fill, o = {}) => h('ellipse', { cx: f(cx), cy: f(cy), rx: f(rx), ry: f(ry), fill, ...NH, ...o });
  const smogOp = 'opacity:calc(0.55 + 0.45 * var(--pb-n-smog, 0.6));pointer-events:none !important';

  // ---- L-atmo: horizon smog band (x covers any camera zoom / roll) + mist on the water
  let atmo = h('g', { ...DD('fx:O:horizon-haze'), style: smogOp }, R(-600, 360, 2800, 124, 'url(#fx-lHz)'));
  // haze pools: one strip, two periods side by side so the translate wraps seamlessly
  const Rp = ctx.rng('fx-hazepools');
  let pools = '';
  const cols = ['M', 'C', 'A', 'M', 'V', 'C', 'A', 'M'];
  for (let i = 0; i < cols.length; i++) {
    const x = (i + 0.2 + Rp() * 0.6) * POOL_W / cols.length, y = 452 + Rp() * 70, rx = 150 + Rp() * 170, ry = 30 + Rp() * 26;
    for (const k of [-1, 0, 1]) pools += E(x + k * POOL_W, y, rx, ry, `url(#fx-lP${cols[i]})`);
  }
  atmo += h('g', { 'data-ref': 'fx-hazePools', ...DD('fx:O:haze-pools'), ...NH }, pools);
  atmo += h('g', { ...DD('fx:O:water-mist'), ...NH }, R(-600, 574, 2800, 58, 'url(#fx-lMist)'));

  // ---- L-shore: street-level glow over the night market, rising behind the pavement railing
  const shore = h('g', { ...DD('fx:O:street-glow'), style: 'opacity:var(--pb-n-lampOn, 1);pointer-events:none !important' }, R(-600, 640, 2800, 114, 'url(#fx-lStreet)'));

  // ---- L-letterbox: grade / vignette (edge bands only)
  const grade = h('g', { ...NH }, R(-600, -200, 2800, 330, 'url(#fx-lVt)'), R(-600, 790, 2800, 310, 'url(#fx-lVb)'),
    R(-600, -200, 820, 1300, 'url(#fx-lVl)'), R(1380, -200, 820, 1300, 'url(#fx-lVr)'));

  return { defs, layers: { 'L-atmo': atmo, 'L-shore': shore, 'L-letterbox': grade } };
}

export function attach(svg) {
  // compositor hygiene for the whole frame (art/neon.js): leaf opacity -> paint opacity, before the sheets split
  flattenOpacity(svg);
  const r = refs(svg, 'fx-');
  let last = null;
  return {
    update(fr) {
      const o = wrap((fr.distance || 0) * POOL_D, POOL_W);
      const xf = `translate(${f(-o)} 0)`;
      if (xf !== last && r.hazePools) { last = xf; r.hazePools.setAttribute('transform', xf); }
    },
  };
}
