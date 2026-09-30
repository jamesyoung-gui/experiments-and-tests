// OWNER: sky. Layers L-sky, L-stars, L-sunmoon, L-clouds (+ the palette in core/palette.js).
// Style C (docs/STYLE-C.md): flat ink bands with halftone seams, a deco sunburst that turns ~1°/s, a sun with
// concentric deco rings, sun dogs and cloud bars, a night poster moon with quantised halo rings, a star field with
// constellations, twinkles and shooting stars, deco cumulus with flat bases, streaks, mares' tails, a mackerel sky,
// a speed-line cloud, a biplane towing a fluttering "PELICAN BAY" banner, a far airship and migrating pelicans.
// Everything is static markup; per frame we only write a handful of transforms / opacities.
import { h, refs } from '../core/svg.js';
import { hash } from './route.js';
import { DIST_PER_REV as DIST_PER_REV_ } from '../contract.js';

export const id = 'sky';

// ---------------------------------------------------------------------------------------------- helpers
const f = x => { const r = Math.round(x * 100) / 100; return (r === 0 ? 0 : r).toString(); };
const f1 = x => (Math.round(x * 10) / 10).toString();
const lerp = (a, b, t) => a + (b - a) * t;
const D2R = Math.PI / 180;
const circ = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const rrect = (x, y, w, hh) => { const r = hh / 2; return `M${f(x + r)} ${f(y)}h${f(w - 2 * r)}a${f(r)} ${f(r)} 0 0 1 0 ${f(hh)}h${f(-(w - 2 * r))}a${f(r)} ${f(r)} 0 0 1 0 ${f(-hh)}Z`; };
const poly = pts => 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z';
const wrap = (x, m) => ((x % m) + m) % m;
// Filled ring (annulus) and a ring of filled dots: real geometry, so hit-tests see exactly what is printed.
const annulus = (r, w) => circ(0, 0, r + w / 2) + circ(0, 0, r - w / 2);
const dotRing = (r, rd, step) => { let d = ''; const n = Math.round((2 * Math.PI * r) / step); for (let i = 0; i < n; i++) { const a = (i / n) * 2 * Math.PI; d += circ(r * Math.cos(a), r * Math.sin(a), rd); } return d; };

// Halftone on a hex grid of pitch s: radius eases r0 (at y0) -> r1 (at y1), `clip(x,y)` rejects dots, `rfn(x,y)`
// overrides the radius. Dots are FILLED circles (far cheaper to rasterise than round-capped zero-length strokes) and
// are split into x-chunks, so a small repaint (the rider, a cloud) only re-processes the chunks it touches.
const CHUNK = 400;
function dots(R, x0, x1, y0, y1, r0, r1, s, fill, o = {}) {
  const { jitter = 0, clip, rfn, q = 0.25, extra = {} } = o;
  const chunks = new Map(); const dy = s * 0.866;
  for (let j = 0, y = y0; y <= y1 + 0.01; j++, y = y0 + j * dy) {
    const tr = (y - y0) / (y1 - y0 || 1);
    for (let x = x0 + (j % 2 ? s / 2 : 0); x <= x1; x += s) {
      const xx = x + (R() - 0.5) * jitter;
      if (clip && !clip(xx, y)) continue;
      const r = rfn ? rfn(xx, y) : lerp(r0, r1, tr);
      if (r < 0.3) continue;
      const k = Math.round(r / q) * q, c = Math.floor(xx / CHUNK);
      if (!chunks.has(c)) chunks.set(c, []);
      chunks.get(c).push(`M${f1(xx - k)} ${f1(y)}a${k} ${k} 0 1 0 ${2 * k} 0a${k} ${k} 0 1 0 ${-2 * k} 0`);
    }
  }
  return [...chunks.values()].map(a => h('path', { d: a.join(''), fill, ...extra })).join('');
}

// Deco capitals (monoline strokes w=24 in a 100-high box, clipped flush to cap & base line) — ported from the draft.
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
function layoutText(str, gap = 13, space = 44) {
  let pen = 0; const out = [];
  for (const ch of str) { if (ch === ' ') { pen += space; continue; } const L = LET[ch]; out.push({ ch, x: pen, w: L.w }); pen += L.w + gap; }
  return { glyphs: out, w: pen - gap };
}
const glyphD = (ch, x) => LET[ch].s.map(([d, sw]) => [d, sw, x]);

// ---------------------------------------------------------------------------------------------- geometry
const HZ = 470;
const BANDS = [[-420, 324, 'sky0'], [324, 374, 'sky1'], [374, 424, 'sky1b'], [424, 476, 'sky2']];  // the sea covers y > 470 at every camera
const RAYS = { sky0: 'ray0', sky1: 'ray1', sky1b: 'ray1b', sky2: 'ray2' };
const RAYDOTS = { sky0: 'ray0', sky1: 'rayDot1', sky1b: 'rayDot1b', sky2: 'rayDot2' };
const X0 = -420, X1 = 2020;
const CLOUD_W = 3200;                  // cloud tile (drawn twice: original + <use>)
const PLANE_SPAN = 3000, PLANE_V = 24; // biplane loop (px) and screen speed (px/s)
const FLOCK_SPAN = 2600, SKEIN_SPAN = 2600, SHIP_SPAN = 2600;

// Sunburst wedges about (sx,sy) turned by `ang` degrees, clipped to each sky band -> one path `d` per band.
const RAY_N = 18, RAY_W = 0.62 * 10;   // 18 lit wedges, each 6.2° wide (period 20°)
function clipY(poly2, y, keepBelow) {
  const out = [];
  for (let i = 0; i < poly2.length; i++) {
    const a = poly2[i], b = poly2[(i + 1) % poly2.length];
    const ina = keepBelow ? a[1] >= y : a[1] <= y, inb = keepBelow ? b[1] >= y : b[1] <= y;
    if (ina) out.push(a);
    if (ina !== inb) { const u = (y - a[1]) / (b[1] - a[1]); out.push([a[0] + (b[0] - a[0]) * u, y]); }
  }
  return out;
}
export function wedgeBands(sx, sy, ang) {
  const tris = [];
  for (let k = 0; k < RAY_N; k++) {
    const a0 = (k * 20 + ang) * D2R, a1 = a0 + RAY_W * D2R;
    tris.push([[sx, sy], [sx + 2900 * Math.cos(a0), sy + 2900 * Math.sin(a0)], [sx + 2900 * Math.cos(a1), sy + 2900 * Math.sin(a1)]]);
  }
  return BANDS.map(([y0, y1], i) => {
    const top = i === 0 ? -60 : y0, bot = i === BANDS.length - 1 ? y1 : y1 + 0.6;
    let d = '';
    for (const t of tris) { const p = clipY(clipY(t, top, true), bot, false); if (p.length > 2) d += poly(p); }
    return d || 'M0 0Z';
  });
}

export const detailItems = [
  ['sky:O:band-zenith', 'O', 'top sky band (cool ink)'],
  ['sky:O:band-mid', 'O', 'mid sky band (accent ink at golden hour)'],
  ['sky:O:band-lower', 'O', 'lower-mid band (warm ink)'],
  ['sky:O:band-horizon', 'O', 'horizon band (light-warm ink)'],
  ['sky:T:band-halftone-seams', 'T', 'hex halftone seams between every pair of bands'],
  ['sky:T:zenith-halftone', 'T', 'dark-ink dots darkening the zenith'],
  ['sky:O:horizon-hairlines', 'O', 'two paper-ink hairlines just above the horizon'],
  ['sky:O:sunburst-wedges', 'O', '18 slowly turning wedges printed one ink lighter'],
  ['sky:T:sunburst-halftone', 'T', 'paper-ink dots inside the wedges on the top band (lower bands too at noon/dusk)'],
  ['sky:T:sun-grooves', 'T', 'engraved hairline grooves in the upper disc'],
  ['sky:T:sun-misregister', 'T', 'static 1–2 px misregistration sliver of the warm ink under the disc'],
  ['sky:O:sun-disc', 'O', 'paper-ink sun disc with deco slits cut into its lower third'],
  ['sky:O:sun-glow-rings', 'O', 'glow quantised into two hard-edged ink rings'],
  ['sky:T:sun-glow-halftone', 'T', 'halftone fringe on the outer glow ring'],
  ['sky:O:sun-deco-ring', 'O', 'solid deco ring'],
  ['sky:O:sun-dotted-ring', 'O', 'outer dotted ring'],
  ['sky:O:sun-corona-teeth', 'O', 'ring of deco teeth counter-rotating around the disc'],
  ['sky:O:sun-bars', 'O', 'two-ink cloud bars across the sun'],
  ['sky:O:sun-dogs', 'O', 'parhelia with a red inner edge and a parhelic tail'],
  ['sky:O:halo-22', 'O', '22-degree halo hairline arc + dotted outer ring through the sun dogs'],
  ['sky:O:cumulus-large', 'O', 'deco cumulus, flat base, two inks'],
  ['sky:O:cumulus-small', 'O', 'second cumulus shape (tall tower)'],
  ['sky:O:cloud-base-bars', 'O', 'flat bars printed under each cumulus'],
  ['sky:T:cloud-rim-light', 'T', 'paper rim-light arcs on the sun-facing lobes'],
  ['sky:T:cloud-creases', 'T', 'deco crease lines where lobes overlap'],
  ['sky:T:cloud-shade-halftone', 'T', 'halftone shade dots above the flat base'],
  ['sky:O:stratus-streaks', 'O', 'long two-ink streak bars'],
  ['sky:O:speed-cloud', 'O', 'puff with a speed-line tail'],
  ['sky:O:cirrus-hooks', 'O', "mares' tails: hooked strokes with thin trailing strands"],
  ['sky:T:mackerel-sky', 'T', 'rows of small scallops (altocumulus)'],
  ['sky:T:virga', 'T', 'dotted rain shafts evaporating under a cloud'],
  ['sky:O:horizon-bank', 'O', 'distant cloud tops sitting on the horizon'],
  ['sky:O:lenticular', 'O', 'stacked lens cloud'],
  ['sky:O:biplane', 'O', 'biplane fuselage + wings'],
  ['sky:O:biplane-struts', 'O', 'interplane struts and bracing wires'],
  ['sky:O:biplane-prop', 'O', 'two-ink propeller blur disc + hub'],
  ['sky:O:biplane-pilot', 'O', 'pelican aviator with goggles and red scarf'],
  ['sky:O:biplane-gear', 'O', 'landing gear and wheel'],
  ['sky:O:biplane-roundel', 'O', 'fuselage roundel'],
  ['sky:T:biplane-rudder-stripes', 'T', 'striped rudder'],
  ['sky:O:biplane-speedlines', 'O', 'speed lines behind the tail'],
  ['sky:T:biplane-wing-ribs', 'T', 'fabric wing rib stitching on both wings'],
  ['sky:O:biplane-exhaust', 'O', 'exhaust stub and trailing puffs'],
  ['sky:O:tow-rope', 'O', 'sagging tow rope and bridle'],
  ['sky:O:banner', 'O', 'fluttering banner cloth with hems (5 panels)'],
  ['sky:O:banner-lettering', 'O', 'PELICAN BAY in deco capitals'],
  ['sky:O:banner-streamers', 'O', 'swallowtail and streamers'],
  ['sky:O:banner-spreader', 'O', 'spreader bar with end caps'],
  ['sky:O:banner-grommets', 'O', 'hem grommets'],
  ['sky:O:airship', 'O', 'far airship envelope'],
  ['sky:T:airship-ribs', 'T', 'panel lines and stripe on the envelope'],
  ['sky:T:airship-shade', 'T', 'halftone underside shade'],
  ['sky:O:airship-fins', 'O', 'tail fins'],
  ['sky:O:airship-pennant', 'O', 'pennant on the tail mast'],
  ['sky:O:airship-gondola', 'O', 'gondola with windows'],
  ['sky:O:airship-engines', 'O', 'two engine pods with spinning props'],
  ['sky:O:pelican-v-formation', 'O', 'migrating pelicans in a V (flapping)'],
  ['sky:O:bird-skein', 'O', 'far skein of small birds'],
  ['sky:O:moon', 'O', 'moon disc'],
  ['sky:T:moon-misregister', 'T', 'static misregistration sliver of the shade ink'],
  ['sky:O:moon-craters', 'O', 'craters with rims'],
  ['sky:T:moon-maria', 'T', 'halftone maria'],
  ['sky:O:moon-halo-rings', 'O', 'halo quantised into rings'],
  ['sky:T:moon-halo-halftone', 'T', 'paper dots in the halo'],
  ['sky:O:moon-deco-rings', 'O', 'deco rings'],
  ['sky:O:stars', 'O', 'star field (3 magnitudes)'],
  ['sky:O:star-sparkles', 'O', 'deco 4-point stars'],
  ['sky:O:twinkle-stars', 'O', 'twinkling subset'],
  ['sky:O:constellations', 'O', 'Big Dipper, Cassiopeia, Orion with dotted lines'],
  ['sky:T:milky-way', 'T', 'halftone Milky Way'],
  ['sky:O:shooting-stars', 'O', 'shooting stars'],
].map(([key, kind, what]) => ({ id: key.split(':')[2], layer: 'sky', kind, what, key }));
const DD = key => ({ 'data-detail': key });

// ---------------------------------------------------------------------------------------------- build
export function build(ctx) {
  const { v, rng } = ctx;
  let defs = '';

  // ======================== L-sky: bands + seams + zenith + hairlines + sunburst
  let sky = '';
  // Halftone rows as one-row <pattern>s: a full-width row of equal dots is one rect (tiny markup, cheap to raster).
  let rowN = 0;
  const htRows = (y0, y1, rOf, s2, tok) => {
    const dy = s2 * 0.866; let out = '';
    for (let j = 0, y = y0; y <= y1 + 0.01; j++, y = y0 + j * dy) {
      const r = Math.min(rOf(y), dy / 2 - 0.05); if (r < 0.3) continue;
      const pid = 'sky-ht' + rowN++;
      defs += h('pattern', { id: pid, x: f(X0 + (j % 2 ? s2 / 2 : 0) - s2 / 2), y: f(y - dy / 2), width: s2, height: f(dy), patternUnits: 'userSpaceOnUse' },
        h('circle', { cx: s2 / 2, cy: f(dy / 2), r: f(r), fill: v(tok) }));
      out += h('rect', { x: X0, y: f(y - dy / 2), width: X1 - X0, height: f(dy), fill: `url(#${pid})` });
    }
    return out;
  };
  // flat bands; each band's tag sits on its clean (seam-free) part so hit-tests see the band itself
  const SEAM = [34, 26, 26];
  BANDS.forEach(([y0, y1, tok], i) => {
    const key = ['sky:O:band-zenith', 'sky:O:band-mid', 'sky:O:band-lower', 'sky:O:band-horizon'][i];
    const top = i === 0 ? y0 : y0 + SEAM[i - 1] + 1, pureTop = i === 0 ? 124 : top;
    if (pureTop > y0) sky += h('rect', { x: X0, y: y0, width: X1 - X0, height: pureTop - y0 + 0.5, fill: v(tok) });
    sky += h('rect', { ...DD(key), x: X0, y: pureTop, width: X1 - X0, height: y1 - pureTop + (i < 3 ? 1 : 0), fill: v(tok) });
  });
  // sunburst: alternate wedges print each lower band one ink lighter, and paper dots over the top band. The wedges
  // are real geometry (triangles clipped to each band in JS, no clip-path), re-cut only when the stepped angle changes.
  {
    const pat = (pid, tok, r, s2, ang) => h('pattern', { id: pid, width: s2, height: s2, patternUnits: 'userSpaceOnUse', patternTransform: `rotate(${ang})` },
      h('circle', { cx: s2 / 2, cy: s2 / 2, r, fill: v(tok) }));
    defs += pat('sky-ht-ray0', 'ray0', 1.55, 6.5, 30) + pat('sky-ht-ray1', 'rayDot1', 1.35, 6.5, 30) + pat('sky-ht-ray1b', 'rayDot1b', 1.2, 6.5, 30) + pat('sky-ht-ray2', 'rayDot2', 1.05, 6.5, 30);
    const D0 = wedgeBands(1451, 330, 0);
    let r = h('path', { ...DD('sky:T:sunburst-halftone'), 'data-ref': 'sky-w0', d: D0[0], fill: 'url(#sky-ht-ray0)' });
    BANDS.slice(1).forEach(([, , tok], i) => {
      r += h('path', { 'data-ref': 'sky-w' + (i + 1), d: D0[i + 1], fill: v(RAYS[tok]) });
      // lower-band wedge dots print only at hours whose role map asks for them (toggled on palette change)
      r += h('path', { 'data-ref': 'sky-rp' + tok, d: D0[i + 1], fill: `url(#sky-ht-${RAYDOTS[tok].replace('rayDot', 'ray')})`, visibility: 'hidden' });
    });
    sky += h('g', { 'data-ref': 'sky-raysG', ...DD('sky:O:sunburst-wedges') }, r);
  }
  // halftone seams (upper-band ink as shrinking dots over the lower band), printed over the wedges too
  let seam = '';
  for (let i = 0; i < 3; i++) { const y = BANDS[i][1]; seam += htRows(y + 3.2, y + SEAM[i], yy => lerp(3.2, 0.35, (yy - y - 3.2) / (SEAM[i] - 3.2)), 7.5, BANDS[i][2]); }
  sky += h('g', DD('sky:T:band-halftone-seams'), seam);
  // zenith: dark ink dots fading down from the top
  sky += h('g', DD('sky:T:zenith-halftone'), h('rect', { x: X0, y: -420, width: X1 - X0, height: 422, fill: v('skyZen') }),
    htRows(6, 120, yy => 4.6 * Math.pow(1 - (yy - 2) / 122, 1.6), 10, 'skyZen'));
  sky += h('path', { ...DD('sky:O:horizon-hairlines'), d: rrect(X0, 452.5, X1 - X0, 2.4) + rrect(X0, 460.5, X1 - X0, 3.2), fill: v('skyLine') });

  // ======================== L-sunmoon: sun group (local coords, centre 0,0) and moon group
  const SR = 80;
  let sun = '';
  {
    // disc with deco slits in its lower third
    let clip = `M${-SR - 2} ${-SR - 2}H${SR + 2}V26H${-SR - 2}Z`;
    let y = 26; for (const [gap, bar] of [[2.2, 11], [2.8, 9], [3.4, 7.5], [4, 6], [4.6, 5], [5.2, 4.2]]) { y += gap; clip += `M${-SR - 2} ${f(y)}H${SR + 2}V${f(y + bar)}H${-SR - 2}Z`; y += bar; }
    defs += h('clipPath', { id: 'sky-sun-slits' }, h('path', { d: clip }));
    sun += h('circle', { ...DD('sky:T:sun-misregister'), cx: 1.8, cy: 1.6, r: SR, fill: v('sunGlow'), 'clip-path': 'url(#sky-sun-slits)' });
    sun += h('circle', { ...DD('sky:O:sun-disc'), r: SR, fill: v('sunCore'), 'clip-path': 'url(#sky-sun-slits)' });
    // glow quantised into two hard rings, with a halftone fringe
    sun += h('g', DD('sky:O:sun-glow-rings'), h('path', { d: annulus(112.5, 23), fill: v('sunGlow'), 'fill-rule': 'evenodd' }), h('path', { d: annulus(90.25, 21.5), fill: v('sunHalo'), 'fill-rule': 'evenodd' }));
    // engraved grooves in the upper disc (light-warm hairline arcs)
    { let d = ''; for (const r of [70, 60, 50]) { const a0 = 205 * D2R, a1 = 335 * D2R, w = 0.8;
        d += `M${f((r + w) * Math.cos(a0))} ${f((r + w) * Math.sin(a0))}A${r + w} ${r + w} 0 0 1 ${f((r + w) * Math.cos(a1))} ${f((r + w) * Math.sin(a1))}L${f((r - w) * Math.cos(a1))} ${f((r - w) * Math.sin(a1))}A${r - w} ${r - w} 0 0 0 ${f((r - w) * Math.cos(a0))} ${f((r - w) * Math.sin(a0))}Z`; }
      sun += h('path', { ...DD('sky:T:sun-grooves'), d, fill: v('sunHalo') }); }
    sun += h('g', DD('sky:T:sun-glow-halftone'), dots(rng('sunfringe'), -170, 170, -170, 170, 0, 0, 7, v('sunGlow'), {
      clip: (x, y) => { const d = Math.hypot(x, y); return d > 125 && d < 152; },
      rfn: (x, y) => 2.8 * (1 - (Math.hypot(x, y) - 125) / 27),
    }));
    sun += h('path', { ...DD('sky:O:sun-dotted-ring'), d: dotRing(140, 2.1, 11), fill: v('sunRing') });
    sun += h('path', { ...DD('sky:O:sun-deco-ring'), d: annulus(111, 3), fill: v('sunRing'), 'fill-rule': 'evenodd' });
    // corona teeth (counter-rotating)
    let teeth = '';
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * 360 * D2R;
      const p = (r, da) => [r * Math.cos(a + da), r * Math.sin(a + da)];
      teeth += poly([p(87, -0.07), p(97, 0), p(87, 0.07)]);
    }
    sun += h('path', { ...DD('sky:O:sun-corona-teeth'), 'data-ref': 'sky-corona', d: teeth, fill: v('sunRing') });
    // cloud bars across the sun
    const bars1 = [[-300, -40, 22, 6.5], [70, 260, -40, 5], [-360, -170, -10, 4], [-120, 210, 66, 5]];
    const bars2 = [[-250, -60, 38, 4.5], [40, 230, 52, 4], [-320, -130, 6, 3]];
    sun += h('g', DD('sky:O:sun-bars'),
      h('path', { d: bars1.map(([a, b, yy, hh]) => rrect(a, yy - hh / 2, b - a, hh)).join(''), fill: v('sunBar1') }),
      h('path', { d: bars2.map(([a, b, yy, hh]) => rrect(a, yy - hh / 2, b - a, hh)).join(''), fill: v('sunBar2') }));
    // 22° halo + sun dogs
    { // 22° halo: a hairline arc over the top (the sea hides the rest) with ticks at the sun dogs
      const arc = (r, a0, a1) => { const p = a => [r * Math.cos(a * D2R), r * Math.sin(a * D2R)]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return [x0, y0, x1, y1]; };
      const [ax0, ay0, ax1, ay1] = arc(183.2, 196, 344), [bx0, by0, bx1, by1] = arc(180.8, 196, 344);
      sun += h('path', { ...DD('sky:O:halo-22'), d: `M${f(ax0)} ${f(ay0)}A183.2 183.2 0 0 1 ${f(ax1)} ${f(ay1)}L${f(bx1)} ${f(by1)}A180.8 180.8 0 0 0 ${f(bx0)} ${f(by0)}Z` + dotRing(192, 1.3, 11), fill: v('sunDog') });
    }
    const dog = sgn => h('g', { transform: `translate(${sgn * 182} 0) scale(${sgn} 1)` },
      h('path', { d: 'M0 -17L5 0L0 17L-5 0Z', fill: v('sunDog') }),
      h('path', { d: 'M1.2 -11L5 0L1.2 11L2.6 0Z', fill: v('inkR') }),
      h('path', { d: rrect(-40, -1.2, 30, 2.4) + rrect(-62, -0.8, 16, 1.6), fill: v('sunDog') }));
    sun += h('g', DD('sky:O:sun-dogs'), dog(-1), dog(1));
  }

  let moon = '';
  {
    const MR = 44;
    moon += h('g', DD('sky:O:moon-halo-rings'), h('circle', { r: 100, fill: v('moonHalo1') }), h('circle', { r: 74, fill: v('moonHalo2') }));
    moon += h('g', DD('sky:T:moon-halo-halftone'), dots(rng('moonht'), -100, 100, -100, 100, 0, 0, 6.5, v('moon'), {
      clip: (x, y) => { const d = Math.hypot(x, y); return d > 50 && d < 99; },
      rfn: (x, y) => { const d = Math.hypot(x, y); return d < 74 ? 1.9 * (1 - (d - 50) / 30) : 1.3 * (1 - (d - 74) / 25); },
    }));
    moon += h('path', { ...DD('sky:O:moon-deco-rings'), d: annulus(86, 1.6) + dotRing(112, 0.9, 8), fill: v('moonRing'), 'fill-rule': 'evenodd' });
    moon += h('circle', { ...DD('sky:T:moon-misregister'), cx: -1.6, cy: -1.4, r: MR, fill: v('moonShade') });
    moon += h('circle', { ...DD('sky:O:moon'), r: MR, fill: v('moon') });
    // maria as halftone
    const maria = [[-12, -10, 15], [10, 8, 12], [-6, 16, 8], [16, -14, 7]];
    moon += h('g', DD('sky:T:moon-maria'), dots(rng('maria'), -MR, MR, -MR, MR, 0, 0, 3.6, v('moonShade'), {
      clip: (x, y) => Math.hypot(x, y) < MR - 3 && maria.some(([mx, my, mr]) => Math.hypot(x - mx, y - my) < mr),
      rfn: (x, y) => { let best = 0; for (const [mx, my, mr] of maria) best = Math.max(best, 1 - Math.hypot(x - mx, y - my) / mr); return 0.5 + 1.1 * best; },
    }));
    const craters = [[18, 20, 6], [-24, 12, 4.5], [4, -26, 5], [-4, 30, 3.2], [28, -2, 3.6], [-30, -12, 3]];
    moon += h('g', DD('sky:O:moon-craters'),
      h('path', { d: craters.map(([x, y2, r]) => circ(x, y2, r)).join(''), fill: 'none', stroke: v('moonShade'), 'stroke-width': 1.5 }),
      h('path', { d: craters.map(([x, y2, r]) => `M${f(x - r * 0.7)} ${f(y2 + r * 0.35)}A${f(r)} ${f(r)} 0 0 0 ${f(x + r * 0.7)} ${f(y2 + r * 0.35)}A${f(r * 1.2)} ${f(r * 1.2)} 0 0 1 ${f(x - r * 0.7)} ${f(y2 + r * 0.35)}Z`).join(''), fill: v('moonShade') }));
  }
  const sunmoon = h('g', { 'data-ref': 'sky-sun', transform: 'translate(1451 330)' }, sun) +
    h('g', { 'data-ref': 'sky-moon', transform: 'translate(134 587)', visibility: 'hidden' }, moon);

  // ======================== L-stars
  let stars = '';
  {
    const R = rng('stars'); const b = [[], [], []];
    for (let i = 0; i < 330; i++) {
      const x = X0 + R() * (X1 - X0), y = -80 + Math.pow(R(), 1.35) * 520, m = R();
      if (y > 445) continue;
      b[m < 0.62 ? 0 : m < 0.9 ? 1 : 2].push(`M${f1(x)} ${f1(y)}h0`);
    }
    stars += h('g', DD('sky:O:stars'), b.map((a, i) => h('path', { d: a.join(''), stroke: v('star'), 'stroke-width': [1.4, 2.2, 3.1][i], 'stroke-linecap': 'round', fill: 'none' })));
    const spark = (x, y, r) => `M${f(x)} ${f(y - r)}Q${f(x + r * 0.16)} ${f(y - r * 0.16)} ${f(x + r)} ${f(y)}Q${f(x + r * 0.16)} ${f(y + r * 0.16)} ${f(x)} ${f(y + r)}Q${f(x - r * 0.16)} ${f(y + r * 0.16)} ${f(x - r)} ${f(y)}Q${f(x - r * 0.16)} ${f(y - r * 0.16)} ${f(x)} ${f(y - r)}Z`;
    const R2 = rng('spark'); let sp = '';
    for (let i = 0; i < 14; i++) sp += spark(X0 + 420 + R2() * 1600, 20 + R2() * 300, 4 + R2() * 5);
    stars += h('path', { ...DD('sky:O:star-sparkles'), d: sp, fill: v('star') });
    const R3 = rng('tw');
    for (let g = 0; g < 3; g++) {
      let d = '';
      for (let i = 0; i < 6; i++) { const x = 20 + R3() * 1560, y = 30 + R3() * 330; d += spark(x, y, 3 + R3() * 3.5) + circ(x, y, 1.2); }
      stars += h('path', { ...(g === 0 ? DD('sky:O:twinkle-stars') : {}), 'data-ref': 'sky-tw' + g, d, fill: v('star') });
    }
    // constellations (screen-space sky positions chosen away from the rider's head)
    const CONS = {
      dipper: [[1060, 110], [1112, 98], [1160, 112], [1206, 132], [1224, 186], [1290, 196], [1300, 142]],
      cass: [[170, 92], [212, 60], [252, 94], [292, 66], [336, 84]],
      orion: [[1392, 236], [1466, 248], [1414, 300], [1430, 305], [1446, 310], [1384, 372], [1476, 362]],
    };
    const lines = [
      ...CONS.dipper.slice(0, 6).map((p, i) => [p, CONS.dipper[i + 1]]), [CONS.dipper[6], CONS.dipper[3]],
      ...CONS.cass.slice(0, 4).map((p, i) => [p, CONS.cass[i + 1]]),
      [CONS.orion[0], CONS.orion[2]], [CONS.orion[1], CONS.orion[4]], [CONS.orion[2], CONS.orion[3]], [CONS.orion[3], CONS.orion[4]], [CONS.orion[2], CONS.orion[5]], [CONS.orion[4], CONS.orion[6]],
    ];
    const shrink = ([a, b2]) => { const dx = b2[0] - a[0], dy = b2[1] - a[1], L = Math.hypot(dx, dy), k = 7 / L; return `M${f(a[0] + dx * k)} ${f(a[1] + dy * k)}L${f(b2[0] - dx * k)} ${f(b2[1] - dy * k)}`; };
    const cstars = Object.values(CONS).flat();
    stars += h('g', DD('sky:O:constellations'),
      h('path', { d: lines.map(shrink).join(''), stroke: v('starLine'), 'stroke-width': 1.6, 'stroke-dasharray': '3 4', fill: 'none', 'stroke-linecap': 'round' }),
      h('path', { d: cstars.map(([x, y]) => spark(x, y, 5.5)).join(''), fill: v('star') }),
      h('path', { d: cstars.map(([x, y]) => `M${x} ${y}h0`).join(''), stroke: v('star'), 'stroke-width': 3.4, 'stroke-linecap': 'round' }));
    // Milky Way: halftone band from lower left to upper right
    const mw = (x, y) => { const u = (x - 200) * 0.34 + (y - 120) * 0.94; return Math.abs(u + 20 * Math.sin(x / 160)); };
    stars += h('g', DD('sky:T:milky-way'), dots(rng('milky'), X0, X1, -20, 440, 0, 0, 9.5, v('milky'), {
      jitter: 3, clip: (x, y) => mw(x, y) < 70, rfn: (x, y) => 2.4 * (1 - mw(x, y) / 70) + 0.2,
    }));
    // shooting stars (animated along +x -> down-left direction; local streak points to +x)
    const streak = h('path', { d: 'M0 0L-70 -2.2L-70 2.2Z' + rrect(-96, -1, 18, 2) + rrect(-116, -0.7, 12, 1.4) + circ(0, 0, 2.6), fill: v('star') });
    stars += h('g', { ...DD('sky:O:shooting-stars'), 'data-ref': 'sky-shoot0', opacity: 0 }, streak) + h('g', { 'data-ref': 'sky-shoot1', opacity: 0 }, streak);
  }
  const starsL = h('g', { 'data-ref': 'sky-stars', style: 'opacity:var(--pb-n-starAlpha)', visibility: 'hidden' }, stars);

  // ======================== L-clouds
  const drift = []; let still = '';
  let clipN = 0;
  // deco cumulus: lobes (lit), flat base band (shade), rim arcs, shade dots, base bars
  function cumulus(x, y, s, lobes, key, seed) {
    const L = lobes.map(([dx, dy, r]) => [x + dx * s, y + dy * s, r * s]);
    const minX = Math.min(...L.map(l => l[0] - l[2])), maxX = Math.max(...L.map(l => l[0] + l[2]));
    const minY = Math.min(...L.map(l => l[1] - l[2]));
    const base = y + 30 * s;
    const cid = 'sky-cl' + (clipN++);
    defs += h('clipPath', { id: cid }, h('rect', { x: f(minX - 2), y: f(minY - 2), width: f(maxX - minX + 4), height: f(base - minY + 2) }));
    const lob = L.map(([cx, cy, r]) => circ(cx, cy, r)).join('');
    const inside = (px, py, skip = -1) => L.some(([cx, cy, r], i) => i !== skip && Math.hypot(px - cx, py - cy) < r - 0.5);
    let g = h('g', { 'clip-path': `url(#${cid})` }, h('path', { d: lob, fill: v('cloudLit') }),
      h('rect', { x: f(minX - 2), y: f(base - 14 * s), width: f(maxX - minX + 4), height: f(16 * s), fill: v('cloudShade') }));
    // shade halftone just above the base band
    g += h('g', DD('sky:T:cloud-shade-halftone'), dots(rng('cd' + seed), minX, maxX, base - 34 * s, base - 15 * s, 0.4, 2.4 * s + 0.4, 5.5, v('cloudDots'), {
      clip: (px, py) => inside(px, py) && py < base - 14 * s,
    }));
    // rim light on the sun-facing (upper right) side, only where the arc is on the cloud's outline
    let rim = '';
    L.forEach(([cx, cy, r], i) => {
      let seg = []; const segs = [];
      for (let a = -150; a <= -10; a += 5) {
        const px = cx + (r - 3.2 * s) * Math.cos(a * D2R), py = cy + (r - 3.2 * s) * Math.sin(a * D2R);
        const ox = cx + (r + 1) * Math.cos(a * D2R), oy = cy + (r + 1) * Math.sin(a * D2R);
        if (!inside(ox, oy, i) && py < base - 16 * s) seg.push([px, py]); else { if (seg.length > 2) segs.push(seg); seg = []; }
      }
      if (seg.length > 2) segs.push(seg);
      for (const sg of segs) rim += 'M' + sg.map(p => f(p[0]) + ' ' + f(p[1])).join('L');
    });
    // deco crease lines: the lower arc of each upper lobe where it overlaps the lobes below
    let crease = '';
    L.forEach(([cx, cy, r], i) => {
      let seg = []; const segs = [];
      for (let a = 15; a <= 165; a += 5) {
        const px = cx + r * Math.cos(a * D2R), py = cy + r * Math.sin(a * D2R);
        if (inside(px, py, i) && py < base - 16 * s && py > minY + 6) seg.push([px, py]); else { if (seg.length > 2) segs.push(seg); seg = []; }
      }
      if (seg.length > 2) segs.push(seg);
      for (const sg of segs) crease += 'M' + sg.map(p => f(p[0]) + ' ' + f(p[1])).join('L');
    });
    if (crease) g += h('path', { ...DD('sky:T:cloud-creases'), d: crease, fill: 'none', stroke: v('cloudShade'), 'stroke-width': f(1.6 * s + 0.5), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    g += h('path', { ...DD('sky:T:cloud-rim-light'), d: rim, fill: 'none', stroke: v('cloudRim'), 'stroke-width': f(2.4 * s + 0.6), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    g += h('path', { ...DD('sky:O:cloud-base-bars'), d: rrect(minX + 16 * s, base + 5 * s, maxX - minX - 10 * s, 6.5 * s) + rrect(minX + 52 * s, base + 16 * s, (maxX - minX) * 0.55, 4 * s), fill: v('cloudLit') });
    return h('g', DD(key), g);
  }
  const LOBES_A = [[0, 0, 34], [38, -14, 42], [84, -4, 36], [118, 6, 26], [-34, 8, 24]];
  const LOBES_B = [[0, 4, 26], [26, -22, 30], [52, -52, 30], [76, -26, 32], [104, 0, 26], [-26, 10, 18], [130, 12, 16]];
  const LOBES_C = [[0, 0, 30], [44, -8, 40], [92, 0, 30], [-30, 10, 20], [126, 10, 20]];
  // tile content: x in [-400, CLOUD_W-400]; at the inventory frame (t≈3.2) the tile has scrolled ≈200 px
  drift.push([620, cumulus(700, 250, 0.66, LOBES_A, 'sky:O:cumulus-large', 'a')]);
  drift.push([2700, cumulus(2756, 214, 0.5, LOBES_B, 'sky:O:cumulus-small', 'b')]);
  drift.push([2240, cumulus(2300, 236, 0.74, LOBES_C, 'sky:O:cumulus-large', 'c')]);
  drift.push([-300, cumulus(-260, 300, 0.46, LOBES_A, 'sky:O:cumulus-large', 'd')]);
  // virga under the small cumulus
  {
    const bx = 2756, by = 214 + 30 * 0.5 + 18;
    drift.push([2700, h('g', DD('sky:T:virga'), dots(rng('virga'), bx - 30, bx + 70, by, by + 64, 1.9, 0.35, 6, v('cloudLit'), {
      clip: (x, y) => { const u = (x - bx + (y - by) * 0.35); return (Math.round(u / 9) % 2 === 0) && u > -26 && u < 64; },
    }))]);
  }
  // stratus streaks (two inks)
  const streaks = (x, y, rows) => h('g', DD('sky:O:stratus-streaks'),
    h('path', { d: rows.map(([dx, dy, w, hh]) => rrect(x + dx, y + dy, w, hh)).join(''), fill: v('cloudLit') }),
    h('path', { d: rows.map(([dx, dy, w, hh]) => rrect(x + dx + 18, y + dy + hh + 2, w * 0.6, Math.max(2, hh * 0.45))).join(''), fill: v('cloudShade') }));
  drift.push([1130, streaks(1170, 346, [[0, 0, 170, 6], [60, 13, 190, 5], [-40, 25, 120, 4]])]);
  drift.push([2650, streaks(2650, 390, [[0, 0, 220, 6], [80, 14, 150, 4.5]])]);
  // speed-line cloud: a puff racing +x with a tail of rounded bars
  {
    const x = 560, y = 338, s = 0.55;
    const L = [[0, 0, 26], [30, -12, 30], [60, -2, 24], [-22, 6, 18]].map(([dx, dy, r]) => [x + dx * s, y + dy * s, r * s]);
    const base = y + 20 * s;
    const cid = 'sky-cl' + (clipN++);
    defs += h('clipPath', { id: cid }, h('rect', { x: x - 60, y: y - 60, width: 140, height: base - y + 60 }));
    const tail = [[-150, -10, 118, 6], [-190, 0, 150, 5], [-120, 10, 96, 4], [-160, -20, 60, 3.4]];
    drift.push([360, h('g', DD('sky:O:speed-cloud'),
      h('path', { 'clip-path': `url(#${cid})`, d: L.map(([cx, cy, r]) => circ(cx, cy, r)).join(''), fill: v('cloudLit') }),
      h('path', { d: tail.map(([dx, dy, w, hh]) => rrect(x + dx, y + dy + 4, w, hh)).join(''), fill: v('cloudLit') }),
      h('path', { d: rrect(x - 26, base - 3, 64, 3) + rrect(x - 200, y + 2, 34, 2.4), fill: v('cloudShade') }),
      h('path', { d: `M${f(x + 8)} ${f(y - 16)}A16 16 0 0 1 ${f(x + 34)} ${f(y - 8)}`, stroke: v('cloudRim'), 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round' }))]);
  }
  // mares' tails (cirrus hooks) with thinner trailing strands, high in the top band (far: static)
  {
    const R = rng('cirrus'); let d = '', d2 = '';
    const hook = (x, y, L2, k) => `M${f(x)} ${f(y)}q${f(L2 * 0.5)} ${f(-4 * k)} ${f(L2)} ${f(-2 * k)}q${f(10 * k)} ${f(0.5)} ${f(13 * k)} ${f(-8 * k)}`;
    for (const [x, y] of [[410, 96], [500, 124], [580, 72], [680, 104], [760, 60], [1480, 40]]) {
      const L2 = 50 + R() * 50, k = 0.8 + R() * 0.6;
      d += hook(x, y, L2, k);
      d2 += `M${f(x + L2 * 0.18)} ${f(y + 4.2)}q${f(L2 * 0.35)} ${f(-2.6 * k)} ${f(L2 * 0.7)} ${f(-1.8 * k)}` + `M${f(x - 14)} ${f(y - 3)}q${f(L2 * 0.2)} ${f(-1.4 * k)} ${f(L2 * 0.42)} ${f(-1.6 * k)}`;
    }
    still += h('g', DD('sky:O:cirrus-hooks'), h('path', { d, fill: 'none', stroke: v('cloudHigh'), 'stroke-width': 2.2, 'stroke-linecap': 'round' }),
      h('path', { d: d2, fill: 'none', stroke: v('cloudHigh'), 'stroke-width': 1.1, 'stroke-linecap': 'round' }));
  }
  // mackerel sky (altocumulus): rows of tiny flat-based two-lobe cloudlets, smaller toward the top (perspective)
  {
    const R = rng('mack'); let d = '', u = '';
    for (let row = 0; row < 4; row++) {
      const y = 204 - row * 13, r = 7 - row * 1.35;
      for (let x = 1330 + row * 16 + R() * 10; x < 1700 - row * 26;) {
        const r1 = r * (0.8 + R() * 0.35), r2 = r1 * (0.55 + R() * 0.25);
        d += `M${f(x)} ${f(y)}A${f(r1)} ${f(r1 * 0.9)} 0 0 1 ${f(x + 2 * r1)} ${f(y)}A${f(r2)} ${f(r2 * 0.9)} 0 0 1 ${f(x + 2 * r1 + 2 * r2)} ${f(y)}Z`;
        u += rrect(x + r1 * 0.4, y + 1.6, 2 * r1 + r2, Math.max(1.4, r * 0.3));
        x += 2 * r1 + 2 * r2 + 5 + R() * 9;
      }
    }
    drift.push([1320, h('g', DD('sky:T:mackerel-sky'), h('path', { d, fill: v('cloudLit') }), h('path', { d: u, fill: v('cloudShade') }))]);
  }
  // distant cloud tops sitting on the horizon (flat bottom)
  {
    const R = rng('bank'); let d = '';
    for (let x = 600; x < 1700;) {
      const w = 140 + R() * 170, hh = 7 + R() * 8; const n = 4 + Math.floor(R() * 4);
      let p = `M${f(x)} ${HZ + 2}`;
      for (let i = 0; i < n; i++) { const x1 = x + (w * (i + 1)) / n, hh2 = hh * (0.6 + R() * 0.5); p += `A${f(w / n / 2)} ${f(hh2)} 0 0 1 ${f(x1)} ${HZ + 2}`; }
      d += p + 'Z'; x += w + 30 + R() * 160;
    }
    still += h('path', { ...DD('sky:O:horizon-bank'), d, fill: v('cloudBank') });
  }
  // lenticular (stacked lens) — comes into view later in the loop
  {
    const x = 330, y = 178;
    drift.push([240, h('g', DD('sky:O:lenticular'),
      h('path', { d: `M${x - 90} ${y}Q${x} ${y - 30} ${x + 90} ${y}Q${x} ${y + 8} ${x - 90} ${y}Z M${x - 70} ${y - 16}Q${x} ${y - 38} ${x + 72} ${y - 16}Q${x} ${y - 11} ${x - 70} ${y - 16}Z`, fill: v('cloudLit') }),
      h('path', { d: `M${x - 90} ${y}Q${x} ${y + 8} ${x + 90} ${y}Q${x} ${y + 14} ${x - 90} ${y}Z`, fill: v('cloudShade') }))]);
  }
  // each drifting cloud is its own element wrapped independently (keeps repaint rects local; no tile copies needed)
  const clouds = still + drift.map(([ax, mk], i) => h('g', { 'data-ref': 'sky-cl' + i, 'data-ax': ax }, mk)).join('');

  // ---- migrating pelicans (V) and far skein
  // flying great white pelican, side view facing +x: white coverts, black primaries + secondaries (the whole rear
  // half of the wing), neck folded, long bill resting on the breast. Three flap frames swapped by href.
  const birdSym = (bid, W, T, back) => {
    // W = wrist, T = wing tip (bird-local, facing +x); arm = white coverts, hand + trailing edge = black flight feathers
    const S0 = [5, -0.8], R0 = [-9.5, -0.2], M = [(W[0] + R0[0]) / 2 - back, (W[1] + R0[1]) / 2];
    const arm = poly([S0, W, M, R0]);
    const hand = `M${f(W[0])} ${f(W[1])}Q${f((W[0] + T[0]) / 2 + 1)} ${f((W[1] + T[1]) / 2 - Math.sign(T[1]) * 1.2)} ${f(T[0])} ${f(T[1])}L${f(T[0] + 2.6)} ${f(T[1] * 0.78)}L${f(M[0] + 1)} ${f(M[1] * 0.9)}Z`;
    const trail = poly([M, [M[0] + 1.8, M[1] * 0.92], [R0[0] + 1.6, R0[1] - Math.sign(W[1]) * 1.4], R0]);
    return h('g', { id: bid },
      h('path', { d: 'M-13 0.6Q-6 -4 5 -3.4Q8.5 -3.6 9.5 -1.6Q9 0.8 5 1.6Q-5 3.6 -13 0.6Z', fill: v('inkP') }),   // body, folded neck
      h('path', { d: 'M8.6 -2.6L23 0.2L9 0.6Z', fill: v('inkK') }), h('path', { d: 'M9 0.4L21 0.4Q15 2.6 9.2 1.6Z', fill: v('inkO') }),
      h('path', { d: arm, fill: v('inkP') }), h('path', { d: hand + trail, fill: v('inkN') }));
  };
  defs += birdSym('sky-bird0', [-1, -10], [-10, -17], 1) + birdSym('sky-bird1', [-3, -3.2], [-17, -4.6], 0.5) + birdSym('sky-bird2', [-1, 7.5], [-9, 13], 1);
  const V = [[0, 0], [-38, -16], [-34, 18], [-74, -31], [-68, 36], [-110, -45], [-102, 54]];
  const flock = h('g', { 'data-ref': 'sky-flock', ...DD('sky:O:pelican-v-formation') },
    V.map(([x, y], i) => h('use', { 'data-ref': 'sky-b' + i, href: '#sky-bird' + (i % 3), transform: `translate(${x} ${y}) scale(${f(1.05 - i * 0.04)})` })));
  let skein = '';
  for (let i = 0; i < 11; i++) {
    const x = i * 14 + (i % 2) * 4, y = i * 4.2 - (i % 3) * 2.2, w = 5.8 - i * 0.16, up = i % 2 ? 2.4 : 3.8;
    skein += `M${f(x - w)} ${f(y - up + 0.6)}Q${f(x - w / 2)} ${f(y - up - 1)} ${f(x)} ${f(y + 0.6)}Q${f(x + w / 2)} ${f(y - up - 1)} ${f(x + w)} ${f(y - up + 0.6)}Q${f(x + w / 2)} ${f(y - up + 0.4)} ${f(x)} ${f(y + 1.9)}Q${f(x - w / 2)} ${f(y - up + 0.4)} ${f(x - w)} ${f(y - up + 0.6)}Z`;
  }
  const skeinG = h('g', { 'data-ref': 'sky-skein' }, h('path', { ...DD('sky:O:bird-skein'), d: skein, fill: v('inkN') }));

  // ---- far airship (drifting +x)
  const ship = h('g', { 'data-ref': 'sky-ship' },
    h('path', { ...DD('sky:O:airship-pennant'), d: 'M-50 -18V-30M-50 -30L-36 -27L-50 -24Z', fill: v('inkR'), stroke: v('inkN'), 'stroke-width': 0.9, 'stroke-linejoin': 'round' }),
    h('path', { ...DD('sky:O:airship-fins'), d: 'M-40 -4L-52 -18L-44 -18L-30 -7Z M-40 4L-52 17L-44 17L-30 7Z', fill: v('inkN') }),
    h('ellipse', { ...DD('sky:O:airship'), rx: 44, ry: 13, fill: v('inkP') }),
    h('g', DD('sky:T:airship-ribs'),
      h('path', { d: [-24, -8, 8, 24].map(x => `M${x} ${f(-13 * Math.sqrt(1 - (x / 44) ** 2))}Q${x + 3} 0 ${x} ${f(13 * Math.sqrt(1 - (x / 44) ** 2))}`).join(''), fill: 'none', stroke: v('inkB'), 'stroke-width': 1 }),
      h('path', { d: rrect(-36, -2.2, 72, 4.4), fill: v('inkR') })),
    h('g', DD('sky:T:airship-shade'), dots(rng('ship'), -42, 42, 1, 13, 0.3, 2, 3.4, v('inkB'), { clip: (x, y) => (x / 43) ** 2 + (y / 12.4) ** 2 < 1 })),
    h('g', DD('sky:O:airship-engines'), h('path', { d: rrect(-24, 9, 10, 4.4) + rrect(16, 9, 10, 4.4), fill: v('inkN') }),
      h('path', { d: 'M-25.4 6.8v8.8M14.6 6.8v8.8', stroke: v('inkK'), 'stroke-width': 1.4, 'stroke-linecap': 'round' })),
    h('g', DD('sky:O:airship-gondola'), h('path', { d: rrect(-10, 13, 22, 6) + 'M-6 13L-2 11M8 13L4 11', fill: v('inkN'), stroke: v('inkN'), 'stroke-width': 1 }),
      h('path', { d: 'M-6 15h2v2h-2zM-1 15h2v2h-2zM4 15h2v2h-2z', fill: v('inkK') })));

  // ---- biplane (+x) towing the banner (plane-local: nose at +x)
  const S = 1.2;
  const planeArt = h('g', { transform: `scale(${S})` },
    h('path', { ...DD('sky:O:biplane-speedlines'), d: rrect(-78, -8, 18, 1.8) + rrect(-86, 3, 24, 1.8) + rrect(-70, 10, 12, 1.5), fill: v('inkP') }),
    h('path', { ...DD('sky:O:biplane-exhaust'), d: rrect(-12, 4.2, 9, 2.2) + circ(-17, 8, 2.1) + circ(-25.5, 10, 2.7) + circ(-35, 11.4, 2.2) + circ(-43, 12.3, 1.6), fill: v('inkP') }),
    h('g', DD('sky:O:biplane-gear'), h('path', { d: 'M4 6L9 16M18 6L11 16', stroke: v('inkN'), 'stroke-width': 1.6, fill: 'none' }),
      h('circle', { cx: 10, cy: 17, r: 4.2, fill: v('inkN') }), h('circle', { cx: 10, cy: 17, r: 1.4, fill: v('inkP') })),
    h('g', { ...DD('sky:O:biplane'), fill: v('inkR') },
      h('path', { d: 'M-50 -1L-56 -17L-46 -17L-37 -5Z' }),                                            // fin
      h('path', { d: 'M34 -6.5L-30 -4L-50 -1.5L-50 2L-30 4.5L34 6.5Z' }),                              // fuselage
      h('path', { d: rrect(-58, -2.6, 20, 3.4), fill: v('inkN') }),                                     // tailplane
      h('path', { d: rrect(-8, 5, 40, 5), fill: v('inkP') }),                                           // lower wing
      h('path', { d: rrect(-14, -24, 48, 5.5), fill: v('inkP') }),                                      // upper wing
      h('path', { d: 'M-12 -18.5H33M-6 10H31', stroke: v('inkN'), 'stroke-width': 1, fill: 'none' }),
      h('path', { ...DD('sky:T:biplane-wing-ribs'), d: [-8, -2, 4, 10, 16, 22, 28].map(x => `M${x} -23.2v4`).join(''), stroke: v('inkK'), 'stroke-width': 1.1, fill: 'none' }),
      h('path', { ...DD('sky:T:biplane-wing-ribs'), d: [-2, 4, 10, 16, 22, 28].map(x => `M${x} 5.7v3.6`).join(''), stroke: v('inkK'), 'stroke-width': 1.1, fill: 'none' }),
      h('path', { d: 'M-30 -1H30', stroke: v('inkP'), 'stroke-width': 1.4 })),                        // cheat line
    h('path', { ...DD('sky:T:biplane-rudder-stripes'), d: 'M-52.5 -8L-54.3 -13L-51.6 -13L-49.8 -8Z M-49 -8L-50.6 -13L-48 -13L-46.4 -8Z', fill: v('inkP') }),
    h('g', DD('sky:O:biplane-roundel'), h('circle', { cx: -22, cy: 0.3, r: 3.6, fill: v('inkP') }), h('circle', { cx: -22, cy: 0.3, r: 1.7, fill: v('inkN') })),
    h('g', DD('sky:O:biplane-struts'),
      h('path', { d: 'M-2 -18.5L-0.5 6M24 -18.5L25.5 6M10 -18.5L12 -6M16 -18.5L17 -6', stroke: v('inkN'), 'stroke-width': 1.6, fill: 'none' }),
      h('path', { d: 'M-2 -18L25 5.5M24 -18L-0.5 5.5', stroke: v('inkN'), 'stroke-width': 0.6, fill: 'none' })),
    h('g', DD('sky:O:biplane-pilot'),
      h('path', { d: 'M-5 -9.5Q-12 -14 -22 -11.5Q-16 -10.8 -20 -8.2Q-12 -9.8 -6 -6.5Z', fill: v('inkR') }),  // scarf
      h('circle', { cx: -1.5, cy: -9.2, r: 4.4, fill: v('inkP') }),
      h('path', { d: 'M-5.9 -9.6A4.4 4.4 0 0 1 2.9 -9.6Z', fill: v('inkN') }),                           // leather cap
      h('circle', { cx: 1.4, cy: -9.8, r: 1.5, fill: v('inkK'), stroke: v('inkN'), 'stroke-width': 0.8 }),
      h('path', { d: 'M1.8 -7.8L15 -6.6L2 -5.6Z', fill: v('inkK') })),                                  // bill
    h('path', { d: 'M28 -7.5h9a2 2 0 0 1 2 2v11a2 2 0 0 1 -2 2h-9Z', fill: v('inkN') }),               // cowling
    h('g', DD('sky:O:biplane-prop'), h('ellipse', { cx: 42, cy: 0, rx: 2.6, ry: 17, fill: v('inkP') }), h('ellipse', { cx: 42, cy: 0, rx: 1.5, ry: 11, fill: v('inkK') }),
      h('circle', { cx: 42, cy: 0, r: 2.2, fill: v('inkN') })));
  // banner: 5 panels skewed about their front edge (a travelling wave), letters distributed per panel
  const BL = 200, BH = 30, NP = 5, PW = BL / NP, BX = -178;       // banner front edge at plane-x BX (plane units ×S)
  const txt = layoutText('PELICAN BAY'); const ts = 0.168, tx0 = -BL + 18;
  defs += h('clipPath', { id: 'sky-capclip' }, h('rect', { x: -40, y: 0, width: 1200, height: 100 }));
  let panels = '';
  for (let i = 0; i < NP; i++) {
    const xa = -(i + 1) * PW, xb = -i * PW; const last = i === NP - 1;
    let cloth = last ? `M${f(xb + 0.6)} ${-BH / 2}L${xa - 12} ${-BH / 2}L${xa - 3} 0L${xa - 12} ${BH / 2}L${f(xb + 0.6)} ${BH / 2}Z` : `M${f(xb + 0.6)} ${-BH / 2}H${f(xa - 0.6)}V${BH / 2}H${f(xb + 0.6)}Z`;
    const hemD = rrect(xa - (last ? 8 : 0.6), -BH / 2 + 2.2, PW + (last ? 8 : 1.2), 2.4) + rrect(xa - (last ? 8 : 0.6), BH / 2 - 4.6, PW + (last ? 8 : 1.2), 2.4);
    const mine = txt.glyphs.filter(g => { const cx = tx0 + (g.x + g.w / 2) * ts; return cx >= xa && cx < xb; });
    const strokes = mine.flatMap(g => glyphD(g.ch, g.x)).map(([d, sw, x]) => h('path', { transform: `translate(${x} 0)`, d, 'stroke-width': sw }));
    panels += h('g', { 'data-ref': 'sky-pan' + i },
      h('path', { ...(i === 0 ? DD('sky:O:banner') : {}), d: cloth, fill: v('inkP'), stroke: v('inkN'), 'stroke-width': 1.1, 'stroke-linejoin': 'round' }),
      h('path', { d: hemD, fill: v('inkR') }),
      mine.length ? h('g', { ...(i === 2 ? DD('sky:O:banner-lettering') : {}), transform: `translate(${f(tx0)} ${f(-8.4)}) scale(${ts})` },
        h('g', { 'clip-path': 'url(#sky-capclip)', fill: 'none', stroke: v('inkN'), 'stroke-miterlimit': 12 }, strokes)) : '',
      h('path', { ...(i === 1 ? DD('sky:O:banner-grommets') : {}), d: [xa + PW * 0.25, xa + PW * 0.75].map(x => circ(x, -BH / 2 + 7.8, 1.25) + circ(x, BH / 2 - 7.8, 1.25)).join(''), fill: v('inkN') }),
      last ? h('path', { ...DD('sky:O:banner-streamers'), d: `M${xa - 12} ${-BH / 2 + 1}q-14 -2 -28 4q10 -1 26 -1Z M${xa - 12} ${BH / 2 - 1}q-16 4 -30 0q12 -1 28 -3Z`, fill: v('inkR') }) : '');
  }
  const banner = h('g', { transform: `translate(${BX} 4)` }, panels,
    h('path', { ...DD('sky:O:banner-spreader'), d: rrect(-1.6, -BH / 2 - 3, 4, BH + 6) + circ(0.4, -BH / 2 - 3, 2.2) + circ(0.4, BH / 2 + 3, 2.2), fill: v('inkN') }));
  const rope = h('path', { ...DD('sky:O:tow-rope'), d: `M${BX + 1} ${4 - BH / 2}L${BX + 26} 4L${BX + 1} ${4 + BH / 2}M${BX + 26} 4Q${f((BX + 26 - 60 * S) / 2)} 12 ${f(-60 * S)} 1`, fill: 'none', stroke: v('inkN'), 'stroke-width': 1.2, 'stroke-linejoin': 'round' });
  const plane = h('g', { 'data-ref': 'sky-plane', transform: 'translate(1270 104)' }, h('g', { 'data-ref': 'sky-planeBody' }, rope, banner, planeArt));

  return {
    defs,
    layers: {
      'L-sky': sky,
      'L-stars': starsL,
      'L-sunmoon': sunmoon,
      'L-clouds': h('g', { 'data-ref': 'sky-shipG' }, ship) + skeinG + clouds + h('g', { 'data-ref': 'sky-flockG' }, flock) + plane,
    },
  };
}

// ---------------------------------------------------------------------------------------------- attach
export function attach(svg, ctx) {
  const r = refs(svg, 'sky-');
  const st = { sun: '', moon: '', moonVis: '', starVis: '', flap: [], sunVis: '' };
  const set = (el, k, val, key) => { if (el && st[key] !== val) { st[key] = val; el.setAttribute(k, val); } };
  const pan = [0, 1, 2, 3, 4].map(i => r['pan' + i]);
  const wv = [0, 1, 2, 3].map(i => r['w' + i]), rp = ['sky1', 'sky1b', 'sky2'].map(k => r['rp' + k]);
  const birds = [0, 1, 2, 3, 4, 5, 6].map(i => r['b' + i]);
  const clouds = Object.keys(r).filter(k => /^cl\d+$/.test(k)).map(k => [r[k], +r[k].getAttribute('data-ax')]);
  return {
    update(fr) {
      const t = fr.t, reduced = fr.reduced || ctx.reduced, D = fr.distance || 0;
      const sun = fr.sun, moon = fr.moon;
      // sun + slowly turning sunburst (~1°/s); hidden once the sun is well below the sea
      set(r.sun, 'transform', `translate(${f(sun.x)} ${f(sun.y)})`, 'sun');
      const sunVis = sun.elev < -0.42 ? 'hidden' : 'visible';
      set(r.sun, 'visibility', sunVis, 'sunVis'); set(r.raysG, 'visibility', sunVis, 'raysVis');
      if (sunVis === 'visible') {
        // the sunburst turns 0.6°/s, stepped at 6 Hz (0.1°: ≤2.5 px at the far edge): each step repaints the whole sky
        const tq = Math.floor(t * 6) / 6;
        const a = reduced ? 0 : wrap(tq * 0.6, 20);
        const key = a.toFixed(3) + '|' + f(sun.x) + '|' + f(sun.y);
        if (st.rayKey !== key) {
          st.rayKey = key; const D = wedgeBands(sun.x, sun.y, a);
          for (let i = 0; i < 4; i++) { wv[i].setAttribute('d', D[i]); if (i) rp[i - 1].setAttribute('d', D[i]); }
          r.corona.setAttribute('transform', `rotate(${(reduced ? 0 : -wrap(tq * 2.2, 360)).toFixed(2)})`);
        }
      }
      const env = fr.pal && fr.pal.env;
      if (env) for (const [tok, a2, b2] of [['sky1', 'rayDot1', 'ray1'], ['sky1b', 'rayDot1b', 'ray1b'], ['sky2', 'rayDot2', 'ray2']])
        set(r['rp' + tok], 'visibility', env[a2] !== env[b2] ? 'visible' : 'hidden', 'rp' + tok);
      // moon
      set(r.moon, 'transform', `translate(${f(moon.x)} ${f(moon.y)})`, 'moon');
      set(r.moon, 'visibility', moon.elev > -0.32 && fr.night > 0.02 ? 'visible' : 'hidden', 'moonVis');
      // stars
      const sa = fr.pal && fr.pal.num ? fr.pal.num.starAlpha : fr.night;
      const starVis = sa > 0.01 ? 'visible' : 'hidden';
      set(r.stars, 'visibility', starVis, 'starVis');
      if (starVis === 'visible') {
        const tt = Math.floor(t * 8) / 8;             // twinkle stepped at 8 Hz (the groups span the whole sky)
        for (let g = 0; g < 3; g++) {
          const o = reduced ? 0.8 : 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(tt * (2.1 + g * 0.83) + g * 2.1)) ** 2;
          r['tw' + g].setAttribute('opacity', o.toFixed(2));
        }
        for (let k = 0; k < 2; k++) {
          const P = k ? 11.3 : 7.1, dur = 0.8, ph = wrap(t + k * 3.7, P);
          const el = r['shoot' + k];
          if (reduced || ph > dur || sa < 0.5) { set(el, 'opacity', '0', 'sh' + k); continue; }
          const n = Math.floor((t + k * 3.7) / P), u = ph / dur;
          const x0 = 300 + wrap(n * 523 + k * 311, 1000), y0 = 40 + wrap(n * 97, 120), ang = 152 + (n % 3) * 6;
          const x = x0 + Math.cos(ang * D2R) * 260 * u, y = y0 + Math.sin(ang * D2R) * 260 * u;
          el.setAttribute('transform', `translate(${f(x)} ${f(y)}) rotate(${ang}) scale(${f(0.6 + 0.6 * Math.sin(Math.PI * u))} 1)`);
          el.setAttribute('opacity', Math.sin(Math.PI * u).toFixed(2)); st['sh' + k] = '';
        }
      }
      // clouds: parallax (depth .03) + a light wind
      // (journey) every pass of a cloud is a new cloud: its wrap cycle seeds a height, a size and whether it is there
      // at all, so the sky never repeats every 53 s (the hero cycle keeps its composed layout)
      const off = D * 0.03 + t * 4, off0 = 3.2 * DIST_PER_REV_ * 0.03 + 3.2 * 4;
      for (let i = 0; i < clouds.length; i++) {
        const [el, ax] = clouds[i], u = ax - off + 700, dx = wrap(u, CLOUD_W) - 700 - ax;
        const cyc = Math.floor(u / CLOUD_W), cyc0 = Math.floor((ax - off0 + 700) / CLOUD_W);
        let dy = 0, sc = 1, on = true;
        if (cyc !== cyc0) { dy = (hash(cyc, i * 3 + 1) - 0.5) * 56; sc = 0.8 + hash(cyc, i * 3 + 2) * 0.4; on = hash(cyc, i * 3 + 3) > 0.22; }
        const vis = on ? 'visible' : 'hidden';
        if (el.__vis !== vis) { el.__vis = vis; el.setAttribute('visibility', vis); }
        el.setAttribute('transform', sc === 1 ? `translate(${f(dx)} ${f(dy)})` : `translate(${f(dx + ax)} ${f(dy)}) scale(${f(sc)}) translate(${f(-ax)} 0)`);
      }
      // airship: far (depth ~.012), drifting +x
      const sx = wrap(290 + 200 + t * 7 - D * 0.012, SHIP_SPAN) - 200;
      r.shipG.setAttribute('transform', `translate(${f(sx)} ${f(250 + 3 * Math.sin(t * 0.4))})`);
      // skein of far birds (drifting -x)
      const kx = wrap(370 + 300 - t * 9 - D * 0.015, SKEIN_SPAN) - 300;
      r.skein.setAttribute('transform', `translate(${f(kx)} ${f(150 + 4 * Math.sin(t * 0.3))})`);
      // pelican V: flies +x, slower than the rider (net drift -x)
      const fu = 1175 + 400 + t * 22 - D * 0.02, fx = wrap(fu, FLOCK_SPAN) - 400, fc = Math.floor(fu / FLOCK_SPAN), fc0 = Math.floor((1175 + 400 + 3.2 * 22 - 3.2 * DIST_PER_REV_ * 0.02) / FLOCK_SPAN);
      const fdy = fc === fc0 ? 0 : (hash(fc, 71) - 0.5) * 120, fsc = fc === fc0 ? 1 : 0.75 + hash(fc, 72) * 0.45;
      r.flockG.setAttribute('transform', `translate(${f(fx)} ${f(318 + fdy + 5 * Math.sin(t * 0.5))})${fsc === 1 ? '' : ` scale(${f(fsc)})`}`);
      for (let i = 0; i < birds.length; i++) {
        const ph = wrap(t * 2.6 + i * 0.37, 1); const fr3 = ph < 0.33 ? 0 : ph < 0.55 ? 1 : ph < 0.85 ? 2 : 1;
        if (st.flap[i] !== fr3) { st.flap[i] = fr3; birds[i].setAttribute('href', '#sky-bird' + fr3); }
      }
      // biplane loop (+x, screen speed PLANE_V) with a gentle bob; banner flutter = travelling skew wave
      const px = wrap(1270 + 700 + t * PLANE_V, PLANE_SPAN) - 700;
      const py = 104 + 5 * Math.sin(t * 0.55), pr = 1.2 * Math.cos(t * 0.55);
      r.plane.setAttribute('transform', `translate(${f(px)} ${f(py)}) rotate(${f(pr)})`);
      let yy = 0; const amp = reduced ? 0.3 : 1;
      for (let i = 0; i < pan.length; i++) {
        const th = amp * (1.4 + 1.9 * i) * Math.sin(t * 7.2 - i * 1.05) * D2R, tn = Math.tan(th);
        const pxv = -i * 40;                                // panel front edge (banner-local)
        pan[i].setAttribute('transform', `matrix(1 ${tn.toFixed(4)} 0 1 0 ${(yy - pxv * tn).toFixed(2)})`);
        yy -= 40 * tn;                                      // offset at this panel's tail edge (x = pxv - 40)
      }
    },
  };
}
