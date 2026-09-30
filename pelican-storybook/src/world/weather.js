// OWNER: director. Weather art in style C: flat inks, screen-print rain lines, halftone fog, a deco rainbow.
// Reads frame.weather (documented in director.js): wind, gust, cloud, rain, fog, bow, wet. Everything is built once;
// update() only moves groups (transform) and fades them (opacity). Reduced motion: no rain streaks, static fog.
import { RIDER_X, GROUND_Y, TILE } from '../contract.js';
import { f, circ, ell, rect, dots, wrap, clamp, sstep, TAU } from './director.js';

export const id = 'weather';
export const materials = {};
export const detailItems = [
  { id: 'sky:T:wx-overcast', layer: 'sky', kind: 'T', what: 'overcast: a periwinkle overprint that knocks the sky back as the shower comes' },
  { id: 'sky:O:wx-stormclouds', layer: 'sky', kind: 'O', what: 'deco storm-cloud bank with navy bellies and cream rim lines, racing on the wind' },
  { id: 'sky:O:wx-rainbow', layer: 'sky', kind: 'O', what: 'six-band deco rainbow in the inks R O K P T B with a halftone fringe' },
  { id: 'fx:T:wx-rain', layer: 'fx', kind: 'T', what: 'screen-print rain: slanted cream lines (near) and periwinkle curtain (far)' },
  { id: 'fx:O:wx-splashes', layer: 'fx', kind: 'O', what: 'rain splash crowns on the road' },
  { id: 'land:O:wx-puddles', layer: 'land', kind: 'O', what: 'road puddles reflecting the sky, with rain ripples' },
  { id: 'sea:T:wx-fog', layer: 'sea', kind: 'T', what: 'sea fog bank rolling over the headland: cream halftone crest + solid body' },
  { id: 'land:T:wx-mist', layer: 'land', kind: 'T', what: 'low shore mist band' },
  { id: 'sea:O:wx-fogbeam', layer: 'sea', kind: 'O', what: 'the lighthouse beam cutting through the fog' },
  { id: 'fx:O:wx-wind', layer: 'fx', kind: 'O', what: 'deco wind curls and tumbling leaves on a breezy stretch' },
];
const F = (d, fill, a = {}) => `<path d="${d}" fill="${fill}"${Object.entries(a).map(([k, v]) => ` ${k}="${v}"`).join('')}/>`;
const S = (d, stroke, w, a = {}) => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}"${Object.entries({ 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...a }).map(([k, v]) => ` ${k}="${v}"`).join('')}/>`;
const G = (a, ...kids) => `<g${Object.entries(a).map(([k, v]) => ` ${k}="${v}"`).join('')}>${kids.join('')}</g>`;
const REF = r => ({ 'data-ref': 'wx-' + r, visibility: 'hidden' });
const DD = k => ({ 'data-detail': k });
const CLOUD_W = 2600, FOG_W = 3016, WIND_W = 2600;
// tiny deterministic hash for layout
const hh = (i, s) => { let x = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(s + 7, 0x85ebca6b); x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12; return (x >>> 0) / 4294967296; };

function cloudShape(cx, cy, w, s) {
  // flat-bottomed deco cumulus: scallops on top, one flat belly
  let d = '', rim = '';
  const n = 5 + Math.floor(hh(s, 1) * 3), R = w / (n + 1);
  for (let i = 0; i < n; i++) {
    const x = cx - w / 2 + R * (i + 1), r = R * (0.85 + 0.9 * Math.sin((i + 0.5) / n * Math.PI) * (0.7 + 0.3 * hh(s, i)));
    d += circ(x, cy - r * 0.35, r);
    rim += `M${f(x - r * 0.7)} ${f(cy - r * 0.35 - r * 0.72)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r * 0.5)} ${f(cy - r * 1.24)}`;
  }
  d += `M${f(cx - w / 2 + R)} ${f(cy - R * 0.4)}H${f(cx + w / 2 - R)}A${f(R * 0.45)} ${f(R * 0.45)} 0 0 1 ${f(cx + w / 2 - R)} ${f(cy + R * 0.5)}H${f(cx - w / 2 + R)}A${f(R * 0.45)} ${f(R * 0.45)} 0 0 1 ${f(cx - w / 2 + R)} ${f(cy - R * 0.4)}Z`;
  return { d, rim, belly: `M${f(cx - w / 2 + R)} ${f(cy + R * 0.3)}H${f(cx + w / 2 - R)}`, R };
}
export function build(ctx) {
  const v = ctx.v, I = r => v('ink' + r);
  // halftone screens as tiled patterns (one filled shape each; cheaper than thousands of dot segments)
  const pat = (id, s, r, ink) => `<pattern id="${id}" width="${s}" height="${f(s * 1.732)}" patternUnits="userSpaceOnUse"><path d="${circ(0, 0, r) + circ(s, 0, r) + circ(s / 2, s * 0.866, r) + circ(0, s * 1.732, r) + circ(s, s * 1.732, r)}" fill="${ink}"/></pattern>`;
  const defs = `<clipPath id="wx-skyclip"><rect x="-500" y="-400" width="2600" height="872"/></clipPath>` + pat('wx-htP', 8, 1.5, I('P')) + pat('wx-htP7', 7, 1.3, I('P'))
    + pat('wx-htF1', 5, 2.3, I('P')) + pat('wx-htF2', 6, 1.9, I('P')) + pat('wx-htF3', 7, 1.5, I('P'));   // in-ink fog veils: far ~77%, mid ~45%, near ~25% paper coverage
  const band = (y1, y2, amp, per, x0, x1, step) => {
    let a = '', b = '';
    for (let x = x0; x <= x1; x += step) { const w = amp * Math.sin(x / FOG_W * TAU * per); a += `${x === x0 ? 'M' : 'L'}${x} ${f(y1 + w)}`; b = `L${x} ${f(y2 + w)}` + b; }
    return a + b + 'Z';
  };
  // ---- L-clouds: overcast screen, rainbow, storm clouds
  const over = G({ ...REF('over'), ...DD('sky:T:wx-overcast') },
    F(rect(-300, -300, 2200, 776), I('B'), { opacity: 0.45 }));
  let bow = '';
  const bands = ['R', 'O', 'K', 'P', 'T', 'B'], R0 = 600, BW = 17;
  bands.forEach((k, i) => { const r = R0 - i * BW; bow += S(`M${f(1080 - r)} 640A${r} ${r} 0 0 1 ${f(1080 + r)} 640`, I(k), BW + 0.6); });
  const fringe = S(dots(420, 1740, 30, 470, 7, (x, y) => { const d = Math.hypot(x - 1080, y - 640); return d > R0 + 10 && d < R0 + 30; }), I('P'), 2.4);
  const rainbow = G({ ...REF('bow'), ...DD('sky:O:wx-rainbow'), 'clip-path': 'url(#wx-skyclip)' }, bow, fringe,
    S(`M${1080 - R0 + 6 * BW} 640A${R0 - 6 * BW} ${R0 - 6 * BW} 0 0 1 ${1080 + R0 - 6 * BW} 640`, I('N'), 1.4, { opacity: 0.6 }));
  let cl = '', clRim = '', clBelly = '';
  for (let rep = 0; rep < 2; rep++) for (let i = 0; i < 5; i++) {
    const c = cloudShape(i * (CLOUD_W / 5) + 180 + hh(i, 3) * 200 + rep * CLOUD_W, 90 + hh(i, 4) * 170, 300 + hh(i, 5) * 260, i);
    cl += c.d; clRim += c.rim; clBelly += c.belly;
  }
  const clouds = G({ ...REF('clouds'), ...DD('sky:O:wx-stormclouds') }, F(cl, I('N'), { stroke: I('N'), 'stroke-width': 5, transform: 'translate(0 9)' }), F(cl, I('B'), { stroke: I('N'), 'stroke-width': 0 }), S(clRim, I('P'), 2.6), S(clBelly, I('P'), 1.4, { 'stroke-dasharray': '2 9' }));
  // ---- L-atmo: far rain curtain + fog bank + fog beam + sea veil
  let far = '';
  for (let xi = 0, x = -280; x < 1850 + 160; xi++, x += 40) for (let yi = 0, y = 40; y < 600; yi++, y += 70) { const o = hh(xi % 4, yi % 3) * 50; far += `M${f(x + o)} ${f(y + o)}l-9 26`; }
  const farRain = G({ ...REF('farRain'), ...DD('fx:T:wx-rain') }, S(far, I('B'), 1.5, { 'stroke-linecap': 'butt' }));
  let fogTop = '';
  for (let x = -FOG_W; x <= 2 * FOG_W + 800; x += 40) fogTop += `${x === -FOG_W ? 'M' : 'L'}${x} ${f(360 + 16 * Math.sin(x / FOG_W * TAU * 6) + 9 * Math.sin(x / FOG_W * TAU * 17))}`;
  const fogBody = fogTop + `L${2 * FOG_W + 800} 470L${-FOG_W} 470Z`;   // far layer: dense paper screen; mid band below it is sparser
  const fogDots = F(band(318, 362, 16, 6, -FOG_W, 2 * FOG_W + 800, 40), 'url(#wx-htP)');
  const fog = G({ ...REF('fog'), ...DD('sea:T:wx-fog') }, G({ 'data-ref': 'wx-fogMove' }, F(fogBody, 'url(#wx-htF1)'),
    F(band(470, 560, 10, 5, -FOG_W, 2 * FOG_W + 800, 40), 'url(#wx-htF2)'), fogDots,
    S(fogTop.replace(/L(-?\d+) (\d+(\.\d)?)/g, (m, a, b) => `L${a} ${f(+b + 60)}`).replace(/^M(-?\d+) (\d+(\.\d)?)/, (m, a, b) => `M${a} ${f(+b + 60)}`), I('P'), 6, { opacity: 0.6 })));
  const beam = G({ ...REF('beam'), ...DD('sea:O:wx-fogbeam') },
    G({ 'data-ref': 'wx-beamRot' }, F('M0 -4L1000 -70L1000 70L0 4Z', v('beacon'), { opacity: 0.35 }), F('M0 -2L1000 -26L1000 26L0 2Z', v('beacon'), { opacity: 0.55 })),
    F(circ(0, 0, 26), v('beacon'), { opacity: 0.35 }), F(circ(0, 0, 14), v('beacon'), { opacity: 0.6 }), F(circ(0, 0, 6), v('beacon')));
  // ---- L-shore: low mist
  let mTop = '';
  for (let x = -FOG_W; x <= 2 * FOG_W + 800; x += 50) mTop += `${x === -FOG_W ? 'M' : 'L'}${x} ${f(610 + 12 * Math.sin(x / FOG_W * TAU * 9))}`;
  const mist = G({ ...REF('mist'), ...DD('land:T:wx-mist') }, G({ 'data-ref': 'wx-mistMove' }, F(mTop + `L${2 * FOG_W + 800} 700L${-FOG_W} 700Z`, 'url(#wx-htF3)'),
    F(band(586, 610, 12, 9, -FOG_W, 2 * FOG_W + 800, 50), 'url(#wx-htP7)')));
  // ---- L-road: puddles (tile = TILE.road so they loop with the road)
  let pd = '', pr = '', ph = '';
  for (let rep = -1; rep < 3; rep++) for (let i = 0; i < 3; i++) {
    const x = rep * TILE.road + i * 640 + hh(i, 11) * 200, y = GROUND_Y + 22 + hh(i, 12) * 30, w = 60 + hh(i, 13) * 50;
    pd += ell(x, y, w, 7 + hh(i, 14) * 4); pr += ell(x - 4, y - 1.4, w * 0.82, 4.5); ph += `M${f(x - w * 0.5)} ${f(y - 2)}h${f(w * 0.35)}M${f(x + w * 0.1)} ${f(y + 1)}h${f(w * 0.3)}`;
  }
  const puddles = G({ ...REF('puddles'), ...DD('land:O:wx-puddles') }, G({ 'data-ref': 'wx-pudMove' }, F(pd, I('N'), { opacity: 0.35 }), F(pr, I('B')), S(ph, I('P'), 1.6),
    G({ 'data-ref': 'wx-ripple' }, S(pr, I('P'), 0.9, { opacity: 0.8 }))));
  // ---- L-fx-back: ONE disciplined art-deco wind band (poster motion lines), + a few leaves
  // Three parallel streamlines of equal weight, stacked tightly in the upper sky (never over the sea or the rider),
  // one group per half tile, each ending in a single deco curl at its leading (left) end. They drift slowly, as one.
  let wd = '';
  const windBand = (x0, y0) => {
    for (let k = 0; k < 3; k++) {
      const x = x0 + k * 38, y = y0 + k * 17, L = 460 - k * 70;          // stepped lengths: the classic deco "speed stack"
      wd += `M${f(x + L)} ${f(y)}C${f(x + L * 0.66)} ${f(y - 6)} ${f(x + L * 0.33)} ${f(y + 6)} ${f(x + 24)} ${f(y)}`;
      if (k === 0) wd += `c-16 0 -22 -16 -10 -22c9 -4 16 4 10 10`;          // only the top line curls
    }
  };
  for (let rep = 0; rep < 2; rep++) { windBand(rep * WIND_W + 120, 128); windBand(rep * WIND_W + WIND_W / 2 + 260, 168); }
  const leaf = 'M0 0C4 -6 12 -6 16 0C12 6 4 6 0 0Z';
  let leaves = '';
  for (let i = 0; i < 3; i++) leaves += G({ 'data-ref': 'wx-leaf' + i }, F(leaf, i % 2 ? I('T') : I('O'), { stroke: I('N'), 'stroke-width': 0.8 }), S('M1 0H15', I('N'), 0.6));
  const wind = G({ ...REF('wind'), ...DD('fx:O:wx-wind') }, G({ 'data-ref': 'wx-windMove' }, S(wd, I('P'), 2.2, { opacity: 0.8, 'stroke-linecap': 'round' })), leaves);
  // ---- L-fx-front: near rain + splashes
  let nr = '';
  for (let xi = 0, x = -288; x < 1850 + 192; xi++, x += 48) for (let yi = 0, y = -390; y < 920 + 260; yi++, y += 130) { const o = hh(xi % 4 + 50, yi % 2) * 110, L = 24 + hh(xi % 4, yi % 2 + 20) * 30; nr += `M${f(x + o)} ${f(y + o)}l${f(-L * 0.34)} ${f(L)}`; }
  const rain = G({ ...REF('rain'), ...DD('fx:T:wx-rain') }, G({ 'data-ref': 'wx-rainMove' }, S(nr, I('P'), 1.8, { 'stroke-linecap': 'butt' })));
  let sp = '';
  for (let i = 0; i < 8; i++) sp += G({ 'data-ref': 'wx-sp' + i }, S('M-8 0l-4 -8M0 -1v-10M8 0l4 -8', I('P'), 1.6), S(ell(0, 1, 10, 2), I('P'), 1));
  const splashes = G({ ...REF('splashes'), ...DD('fx:O:wx-splashes') }, sp);
  return {
    defs,
    layers: {
      'L-clouds': G({ id: 'wx-sky' }, over, rainbow, clouds),
      'L-atmo': G({ id: 'wx-atmo' }, farRain, fog, beam),
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
  for (const k of ['over', 'bow', 'clouds', 'farRain', 'fog', 'beam', 'mist', 'puddles', 'wind', 'rain', 'splashes']) {
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
      showA(r.over, w.cloud * 0.9);
      showA(r.bow, w.bow * 0.92);
      showA(r.clouds, sstep(0.2, 0.7, w.cloud));
      if (w.cloud > 0.2) set(r.clouds, 'transform', `translate(${f(-wrap(D * 0.03 + t * (20 + 160 * w.wind), CLOUD_W))} ${f(-60 * (1 - sstep(0.2, 0.8, w.cloud)))})`);
      // rain
      const rn = red ? 0 : w.rain;
      showA(r.farRain, rn * 0.9); showA(r.rain, rn);
      if (rn > 0.01) {
        const k = t * 1400;
        set(r.farRain, 'transform', `translate(${f(-wrap(k * 0.34 * 0.5, 160))} ${f(wrap(k * 0.5, 210) - 140)})`);
        set(r.rainMove, 'transform', `translate(${f(-wrap(k * 0.34 + D * 0.2, 192))} ${f(wrap(k, 260))})`);
      }
      showA(r.splashes, red ? 0 : w.rain);
      if (!red && w.rain > 0.01) for (let i = 0; i < 8; i++) {
        const p = wrap(t * 2.3 + i * 0.37, 1), n = Math.floor(t * 2.3 + i * 0.37);
        set(r['sp' + i], 'transform', `translate(${f(hh(n, i) * 1700 - 50)} ${f(GROUND_Y - 30 + hh(n, i + 9) * 70)}) scale(${f(0.3 + p)} ${f(1 - p * 0.5)})`);
        set(r['sp' + i], 'opacity', op(1 - p));
      }
      // puddles
      showA(r.puddles, w.wet);
      if (w.wet > 0.01) {
        set(r.pudMove, 'transform', `translate(${f(-wrap(D, TILE.road))} 0)`);
        const rp = red ? 0.5 : wrap(t * 1.7, 1);
        showA(r.ripple, w.rain * (1 - rp));
        set(r.ripple, 'transform', `translate(0 ${GROUND_Y + 30}) scale(${f(0.6 + rp * 0.5)} 1) translate(0 ${-GROUND_Y - 30})`);
      }
      // fog: rolls in (translation) unless reduced
      showA(r.fog, sstep(0, 0.4, w.fog)); showA(r.mist, sstep(0.1, 0.5, w.fog));   // opaque screens on the plateau: no alpha greys
      if (w.fog > 0.01) {
        set(r.fogMove, 'transform', `translate(${f(-wrap(red ? 800 : D * 0.2 + t * 14, FOG_W))} ${f(40 * (1 - sstep(0, 0.8, w.fog)))})`);
        set(r.mistMove, 'transform', `translate(${f(-wrap(red ? 500 : D * 0.6 + t * 22, FOG_W))} 0)`);
      }
      // beam from the lighthouse lantern (hero lamp 1150, 269 in the cape's frame; cape moves at depth .07)
      let bx = null;
      if (w.fog > 0.05 && cape) {
        const m = /translate\((-?[\d.]+)/.exec(cape.getAttribute('transform') || '');
        const cx = m ? +m[1] : 0;
        bx = 1150 + cx + (fr.cam ? (fr.cam.fx - 800) * (0.2 - 0.07) * 0 : 0);
      }
      const beamOn = bx !== null && bx > -900 && bx < 2500 ? w.fog : 0;
      showA(r.beam, beamOn);
      if (beamOn > 0.01) {
        set(r.beam, 'transform', `translate(${f(bx)} 269)`);
        const th = red ? 2.6 : t * (TAU / 7.5);
        set(r.beamRot, 'transform', `scale(${f(Math.cos(th))} 1)`);
      }
      // wind
      const wn = red ? 0 : sstep(0.3, 0.9, w.wind);
      showA(r.wind, wn);
      if (wn > 0.01) {
        // slow, calm drift: the band glides left at sky pace; a gust only nudges it (no whizzing)
        set(r.windMove, 'transform', `translate(${f(-wrap(t * (140 + 120 * w.gust) + D * 0.04, WIND_W))} ${f(Math.sin(t * 0.6) * 4)})`);
        for (let i = 0; i < 3; i++) {
          // leaves ride the same stream: one gentle path just above the promenade rail, behind the rider
          const p = wrap(t * 0.22 + i / 3, 1);
          set(r['leaf' + i], 'transform', `translate(${f(1900 - p * 2300)} ${f(560 + 18 * i + Math.sin(p * 6.3 + i) * 22)}) rotate(${f(p * 540 + i * 90)})`);
        }
      }
    },
  };
}
