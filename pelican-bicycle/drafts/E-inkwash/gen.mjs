// Pelican Bay — style E: Chinese ink wash (水墨) with colour accents.
// node gen.mjs  -> keyframe.svg + closeup.svg (same art, close-up viewBox)
import fs from 'node:fs';
import { openFont } from './font.mjs';
import { writeColumn } from './write.mjs';

const HERE = new URL('.', import.meta.url).pathname;

import { D, MAIN, P, add, blob, bristles, brush, catmull, clamp, closedCR, cubicPts, f, f2, g, lerp, lineOf, normals, pathOf, prof, rand, resample, rng, rot, rs, smoothClosed, sstep, stroke, vnoise, xf } from './lib.mjs';

// ───────────────────────── palette ─────────────────────────
const C = {
  paper: '#F3ECDD', paperHi: '#FCF9F3', paperShade: '#E6DAC4',
  ink0: '#12100E', ink1: '#26221F', ink2: '#45403A', ink3: '#6F6961', ink4: '#9E978D', ink5: '#C9C1B4',
  verm: '#C0361F', vermL: '#DE6340', ochre: '#B5783C', ochreL: '#E2B679', gold: '#F0C27A',
  indigo: '#3D5C70', indigoL: '#8AA2AE', mist: '#AEB4B2',
  teal: '#1F8A8A', tealD: '#135E60', tealL: '#58ABA5',
  bill: '#F2A48A', billEdge: '#D9705A', nail: '#E0503A', pouch1: '#F9C74F', pouch2: '#F4A340',
  skin: '#F7C1B5', iris: '#8B1E1E', feet: '#F08A3C', web: '#F5A05A', feetFar: '#C06E34',
  plumeShade: '#D8CFD2', plumeDeep: '#BDB4BC', flight: '#1E1B22', sheen: '#3A3A48',
  saddle: '#7A4A2A', basket: '#C89B5E', basketD: '#8C6534', cream: '#F3E9D2', brass: '#C9A04A',
};

// ───────────────────────── rig geometry (rig-spec §1/§2, crank φ = 0) ─────────────────────────
function ik2(h, t, L1, L2, bend) {
  const dx = t[0] - h[0], dy = t[1] - h[1]; const d = Math.hypot(dx, dy);
  const base = Math.atan2(dy, dx);
  const c = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
  const a1 = base + bend * Math.acos(c);
  const j = [h[0] + L1 * Math.cos(a1), h[1] + L1 * Math.sin(a1)];
  const a2 = Math.atan2(t[1] - j[1], t[0] - j[0]);
  return { a1: a1 / D, a2: a2 / D, j };
}
const BB = [0, -80], RH = [-125, -100], FH = [173, -100], WR = 100, CRANK = 50;
const PHI = 0;
const pedalN = [BB[0] + CRANK * Math.cos(PHI), BB[1] + CRANK * Math.sin(PHI)];
const pedalF = [BB[0] - CRANK * Math.cos(PHI), BB[1] - CRANK * Math.sin(PHI)];
const ankl = phi => 8 + 10 * Math.cos(phi - 135 * D);
const alphaN = ankl(PHI), alphaF = ankl(PHI + Math.PI);
const ankleN = add(pedalN, rot([-17, -9], alphaN)), ankleF = add(pedalF, rot([-17, -9], alphaF));
const PELVIS = [-45, -300];
const hipN = add(PELVIS, [8, 0]), hipF = add(PELVIS, [4, -3]);
const legN = ik2(hipN, ankleN, 142, 134, -1), legF = ik2(hipF, ankleF, 142, 134, -1);
const shN = add(PELVIS, [80, -78]), shF = add(PELVIS, [75, -83]);
const gripN = [114, -275], gripF = [111, -277];
const wingN = ik2(shN, gripN, 78, 74, +1), wingF = ik2(shF, gripF, 78, 74, +1);
const NECK0 = add(PELVIS, [112, -92]), HEAD = [125, -520];
const NP = [NECK0, add(NECK0, [30, -58]), add(add(HEAD, [-14, 10]), [-58, 34]), add(HEAD, [-14, 10])];
const BILL_ANG = 14;
const billU0 = add(HEAD, [16, 2]), billL0 = add(HEAD, [16, 6]);
const pouch0 = xf(billL0, BILL_ANG, [6, 5]);
console.log('knee N', legN.j.map(f), 'thigh', f(legN.a1), 'shank', f(legN.a2), '| elbow N', wingN.j.map(f), wingN.a1.toFixed(1), wingN.a2.toFixed(1));

// ───────────────────────── filters ─────────────────────────
function filters() {
  const reg = (id, x, y, w, h, body) => `<filter id="${id}" filterUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}" color-interpolation-filters="sRGB">${body}</filter>`;
  const both = (id, body) => reg(id + 'W', -60, -60, 1720, 1020, body) + reg(id + 'L', -720, -720, 1640, 880, body);
  const inkBody = (fr, sc, halo, ha, seed = 3) => `
    <feTurbulence type="fractalNoise" baseFrequency="${fr}" numOctaves="2" seed="${seed}" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="${sc}" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="${halo}" result="h"/>
    <feComponentTransfer in="h" result="h2"><feFuncA type="linear" slope="${ha}"/></feComponentTransfer>
    <feMerge><feMergeNode in="h2"/><feMergeNode in="d"/></feMerge>`;
  // watercolour pigment: ragged edge, slightly darker rim, granulation
  const wcBody = (fr, sc, seed = 5) => `
    <feTurbulence type="fractalNoise" baseFrequency="${fr}" numOctaves="3" seed="${seed}" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="${sc}" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="2.2" result="b"/>
    <feComposite in="d" in2="b" operator="arithmetic" k1="0" k2="1.7" k3="-0.75" k4="0" result="rim"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="${seed + 9}" result="gr"/>
    <feColorMatrix in="gr" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.1 1.25" result="gra"/>
    <feComposite in="rim" in2="gra" operator="in" result="g1"/>
    <feGaussianBlur in="d" stdDeviation="0.8" result="soft"/>
    <feComponentTransfer in="soft" result="soft2"><feFuncA type="linear" slope="0.35"/></feComponentTransfer>
    <feMerge><feMergeNode in="soft2"/><feMergeNode in="g1"/></feMerge>`;
  return [
    both('ink', inkBody(0.08, 2.2, 1.1, 0.38, 3)),
    both('inkS', inkBody(0.12, 1.3, 0.6, 0.3, 8)),
    both('inkB', inkBody(0.045, 3.5, 2.2, 0.45, 12)),
    both('wc', wcBody(0.04, 5, 5)),
    both('wcS', wcBody(0.07, 2.5, 21)),
    both('soft', `<feGaussianBlur stdDeviation="3"/>`),
    both('soft2', `<feGaussianBlur stdDeviation="7"/>`),
    both('wash', `
      <feTurbulence type="fractalNoise" baseFrequency="0.008 0.022" numOctaves="3" seed="31" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="22" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feGaussianBlur in="d" stdDeviation="2.5" result="b"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.02 0.05" numOctaves="3" seed="44" result="m"/>
      <feColorMatrix in="m" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.6 -0.25" result="ma"/>
      <feComposite in="b" in2="ma" operator="arithmetic" k1="0.35" k2="0.72" k3="0" k4="0"/>`),
    both('mount', `
      <feTurbulence type="fractalNoise" baseFrequency="0.02 0.035" numOctaves="4" seed="17" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="12" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feGaussianBlur in="d" stdDeviation="1.4" result="b"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.05 0.012" numOctaves="3" seed="18" result="m"/>
      <feColorMatrix in="m" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.5 -0.2" result="ma"/>
      <feComposite in="b" in2="ma" operator="arithmetic" k1="0.5" k2="0.65" k3="0" k4="0"/>`),
    // paper grain + fibres, multiplied over everything
    reg('paperTex', 0, 0, 1600, 900, `
      <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="2" result="a"/>
      <feColorMatrix in="a" type="matrix" values="0 0 0 0 0.52  0 0 0 0 0.44  0 0 0 0 0.33  0 0 0 -0.6 0.36" result="a2"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.006 0.012" numOctaves="3" seed="9" result="b"/>
      <feColorMatrix in="b" type="matrix" values="0 0 0 0 0.62  0 0 0 0 0.52  0 0 0 0 0.38  0 0 0 0.55 -0.26" result="b2"/>
      <feMerge><feMergeNode in="b2"/><feMergeNode in="a2"/></feMerge>`),
    // calligraphy: thicken verticals, thin horizontals, ragged ink edges, soft bleed
    reg('callig', 0, 0, 1600, 900, `
      <feMorphology in="SourceAlpha" operator="dilate" radius="2.2 0.4" result="m1"/>
      <feMorphology in="m1" operator="erode" radius="0.2 1.1" result="m2"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="2" seed="4" result="n"/>
      <feDisplacementMap in="m2" in2="n" scale="4.5" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feGaussianBlur in="d" stdDeviation="1.3" result="b"/>
      <feComponentTransfer in="b" result="t"><feFuncA type="table" tableValues="0 0 0.1 0.9 1 1"/></feComponentTransfer>
      <feTurbulence type="fractalNoise" baseFrequency="0.5 0.9" numOctaves="1" seed="14" result="dryn"/>
      <feColorMatrix in="dryn" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 2.1" result="drya"/>
      <feComposite in="t" in2="drya" operator="in" result="t2"/>
      <feFlood flood-color="${C.ink0}"/><feComposite in2="t2" operator="in" result="ink"/>
      <feGaussianBlur in="t" stdDeviation="2.6" result="hb"/>
      <feFlood flood-color="${C.ink2}" flood-opacity="0.22"/><feComposite in2="hb" operator="in" result="halo"/>
      <feMerge><feMergeNode in="halo"/><feMergeNode in="ink"/></feMerge>`),
    reg('calligS', 0, 0, 1600, 900, `
      <feMorphology in="SourceAlpha" operator="dilate" radius="0.9 0.15" result="m1"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.12" numOctaves="2" seed="6" result="n"/>
      <feDisplacementMap in="m1" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feGaussianBlur in="d" stdDeviation="0.6" result="b"/>
      <feComponentTransfer in="b" result="t"><feFuncA type="table" tableValues="0 0 0.3 1 1"/></feComponentTransfer>
      <feFlood flood-color="${C.ink1}"/><feComposite in2="t" operator="in" result="ink"/>
      <feGaussianBlur in="t" stdDeviation="1.4" result="hb"/>
      <feFlood flood-color="${C.ink2}" flood-opacity="0.2"/><feComposite in2="hb" operator="in" result="halo"/>
      <feMerge><feMergeNode in="halo"/><feMergeNode in="ink"/></feMerge>`),
    // seal impression: ragged edge + uneven pressure
    reg('stamp', 0, 0, 1600, 900, `
      <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="23" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="29" result="sp"/>
      <feColorMatrix in="sp" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3.2 2.55" result="spa"/>
      <feComposite in="d" in2="spa" operator="in" result="s1"/>
      <feGaussianBlur in="s1" stdDeviation="0.35"/>`),
  ].join('\n');
}

// ───────────────────────── world ─────────────────────────
const SUN = [1451, 330];
const HORIZON = 470;

function sky() {
  let s = `<rect width="1600" height="900" fill="${C.paper}"/>`;
  s += g(`filter="url(#washW)"`,
    `<rect x="-40" y="-40" width="1680" height="230" fill="url(#gZenith)"/>`,
    `<ellipse cx="${SUN[0] - 80}" cy="${SUN[1] + 40}" rx="880" ry="310" fill="url(#gSunWash)"/>`,
    `<ellipse cx="1180" cy="466" rx="1050" ry="95" fill="url(#gHorizonR)"/>`);
  // high cloud: thin layered bands, fading at both ends, gilded underneath near the sun
  const band = (x0, x1, y, h, col, op) => `<path d="${blob([[x0, y], [lerp(x0, x1, .25), y - h * .7], [lerp(x0, x1, .6), y - h], [x1, y - h * .2], [lerp(x0, x1, .7), y + h * .35], [lerp(x0, x1, .3), y + h * .3]], 8)}" fill="${col}" opacity="${op}"/>`;
  s += g(`filter="url(#soft2W)"`,
    band(600, 1180, 118, 14, '#9F9C9C', .16), band(700, 1060, 132, 8, C.gold, .38),
    band(930, 1500, 60, 12, '#9F9C9C', .12), band(1180, 1560, 72, 7, C.vermL, .2),
    band(520, 860, 150, 6, '#9F9C9C', .1));
  let cd = '';
  for (const [x0, y0, x1, y1, w, op] of [[620, 116, 1160, 124, 2.2, .4], [760, 128, 1040, 131, 1.4, .35], [950, 58, 1470, 66, 1.8, .3], [560, 150, 820, 148, 1.2, .25]]) {
    cd += brush([[x0, y0], [lerp(x0, x1, .3), y0 - 3], [lerp(x0, x1, .7), y1 + 2], [x1, y1]], { w, n: 60, dry: .75, k: 5, a: .4, b: .5, amin: .1, op, runout: .6 });
  }
  s += g(`fill="#8F8683" filter="url(#inkW)"`, cd);
  return s;
}
function sun() {
  let s = `<circle cx="${SUN[0]}" cy="${SUN[1]}" r="170" fill="url(#gSunHalo)"/>`;
  s += g(`filter="url(#wcW)"`, `<circle cx="${SUN[0]}" cy="${SUN[1]}" r="47" fill="url(#gSun)" opacity="0.94"/>`);
  // long mist bands drifting across the sun: soft wash + a dry trailing line
  s += g(`filter="url(#soft2W)" opacity="0.7"`,
    `<ellipse cx="1420" cy="346" rx="230" ry="7" fill="${C.paperHi}" opacity="0.8"/>`,
    `<ellipse cx="1300" cy="318" rx="170" ry="5" fill="#B7A69A" opacity="0.35"/>`,
    `<ellipse cx="1180" cy="182" rx="260" ry="12" fill="${C.ochreL}" opacity="0.35"/>`);
  let cl = '';
  for (const [x0, y0, x1, y1, w, op] of [[1240, 340, 1600, 347, 3.2, .5], [1150, 318, 1440, 322, 2, .4], [1010, 176, 1330, 184, 2.4, .35], [1070, 194, 1240, 199, 1.6, .3]]) {
    cl += brush([[x0, y0], [lerp(x0, x1, .35), y0 - 2.5], [lerp(x0, x1, .7), y1 + 2], [x1, y1]], { w, n: 60, dry: .6, k: 5, a: .35, b: .5, amin: .1, color: '#8F8683', op, runout: .6 });
  }
  s += g(`filter="url(#inkW)"`, cl);
  // gulls — two-stroke ticks
  let gl = '';
  const gulls = [[1045, 228, 11], [1082, 206, 8], [1112, 246, 9.5], [1150, 222, 6], [660, 150, 7], [688, 170, 5.5]];
  for (const [x, y, sz] of gulls) {
    gl += brush([[x - sz, y - sz * .2], [x - sz * .45, y - sz * .5], [x, y]], { w: sz * .3, n: 16, a: .1, b: .5, amin: .2, color: C.ink1 });
    gl += brush([[x, y], [x + sz * .5, y - sz * .6], [x + sz * 1.05, y - sz * .38]], { w: sz * .27, n: 16, a: .1, b: .6, amin: .8, color: C.ink1 });
  }
  s += g(`filter="url(#inkSW)"`, gl);
  return s;
}
function ridgePts(x0, x1, base, peaks, seed, rough = 5, step = 4) {
  const n1 = vnoise(seed, 14), n2 = vnoise(seed + 1, 55), out = [];
  for (let x = x0; x <= x1; x += step) {
    let h = 0;
    for (const p of peaks) { const u = Math.abs((x - p.x) / p.w); h = Math.max(h, p.h * Math.exp(-Math.pow(u, p.s || 2))); }
    const t = (x - x0) / (x1 - x0);
    h += rough * n1(t) + rough * .35 * n2(t);
    out.push([x, base - Math.max(0, h)]);
  }
  return out;
}
function mountainLayer(pts, base, depth, { color, top, bottom = 0, id, ridgeInk = null, ridgeW = 3, cun = 0, dots = 0, seed = 1, cunLen = 50, fade = .55, tints = [] }) {
  const minY = Math.min(...pts.map(p => p[1]));
  const shapeD = pathOf([...pts, [pts[pts.length - 1][0], base + depth], [pts[0][0], base + depth]]);
  let s = `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${f(minY)}" x2="0" y2="${base + depth}"><stop offset="0" stop-color="${color}" stop-opacity="${top}"/><stop offset="${fade}" stop-color="${color}" stop-opacity="${f2(top * .6)}"/><stop offset="1" stop-color="${color}" stop-opacity="${bottom}"/></linearGradient>`;
  s += `<path d="${shapeD}" fill="url(#${id})" filter="url(#mountW)"/>`;
  if (tints.length) {
    // 浅绛: ochre on the sun-facing shoulders, indigo in the shade, clipped to the mountain
    s += `<clipPath id="${id}c"><path d="${shapeD}"/></clipPath>`;
    s += g(`clip-path="url(#${id}c)"`, g(`filter="url(#soft2W)"`, ...tints.map(([x, y, rx, ry, col, op]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${col}" opacity="${op}"/>`)));
  }
  const r = rng(seed);
  if (ridgeInk) {
    let rs2 = '';
    const segN = Math.floor(pts.length / 22);
    for (let i = 0; i < segN; i++) {
      const a = Math.floor(i * pts.length / segN), b = Math.min(pts.length - 1, a + Math.floor(pts.length / segN * (0.55 + 0.4 * r())));
      if (r() < .18) continue;
      const seg = pts.slice(a, b + 1).map(p => [p[0], p[1] + 1.5]);
      if (seg.length < 4) continue;
      rs2 += brush(seg, { w: ridgeW * (.6 + .6 * r()), n: Math.max(12, seg.length), dry: .55, k: 5, a: .2, b: .5, amin: .3, runout: .6, seed: Math.floor(r() * 1e5) });
    }
    s += g(`fill="${ridgeInk}" filter="url(#inkW)" opacity="0.8"`, rs2);
  }
  if (cun) {
    let cs = '';
    for (let i = 0; i < cun; i++) {
      const idx = Math.floor(r() * pts.length), p = pts[idx];
      const q = pts[Math.min(pts.length - 1, idx + 3)], slope = (q[1] - p[1]) / 12;
      if (base - p[1] < 18) continue;
      const len = cunLen * (.4 + r() * .8) * Math.min(1, (base - p[1]) / 90);
      const dir = clamp(-slope * 14, -22, 22);
      cs += brush([[p[0], p[1] + 3], [p[0] + dir * .4, p[1] + len * .5], [p[0] + dir, p[1] + len]], { w: 1.2 + r() * 2.2, n: 18, dry: .7, k: 3, a: .1, b: .6, amin: .5, runout: .5, seed: Math.floor(r() * 1e5) });
    }
    s += g(`fill="${ridgeInk || C.ink2}" filter="url(#inkW)" opacity="0.42"`, cs);
  }
  if (dots) {
    let ds = '';
    for (let i = 0; i < dots; i++) {
      const idx = Math.floor(r() * pts.length), p = pts[idx];
      if (base - p[1] < 25) continue;
      const cx = p[0] + (r() - .5) * 6, cy = p[1] + 1.5 + r() * 4, L = 2.5 + r() * 3.5;
      ds += brush([[cx - L / 2, cy + .4], [cx + L / 2, cy - .4]], { w: 1.6 + r() * 1.2, n: 8, a: .3, b: .5, amin: .5 });
    }
    s += g(`fill="${C.ink0}" filter="url(#inkW)" opacity="0.85"`, ds);
  }
  return s;
}
function mountains() {
  let s = '';
  s += mountainLayer(ridgePts(-20, 1620, HORIZON, [
    { x: 40, h: 78, w: 100 }, { x: 150, h: 46, w: 70 }, { x: 590, h: 66, w: 110 }, { x: 760, h: 40, w: 90 }, { x: 1470, h: 50, w: 110 }, { x: 1610, h: 84, w: 80 },
  ], 11, 5), HORIZON, 4, { color: '#8B9CA4', top: .3, bottom: .02, id: 'gM1', seed: 3 });
  const peaks = [
    { x: 338, h: 245, w: 44, s: 2.5 }, { x: 272, h: 168, w: 42, s: 2.3 }, { x: 408, h: 186, w: 40, s: 2.6 }, { x: 468, h: 118, w: 44, s: 2.2 }, { x: 212, h: 92, w: 44, s: 2 }, { x: 540, h: 66, w: 46 },
  ];
  const base = HORIZON + 10;
  const tints = [];
  for (const p of peaks) {
    const top = base - p.h;
    tints.push([p.x + p.w * .45, top + p.h * .28, p.w * .55, p.h * .38, C.ochre, .42]);
    tints.push([p.x - p.w * .5, top + p.h * .45, p.w * .45, p.h * .4, C.indigo, .28]);
  }
  s += mountainLayer(ridgePts(160, 600, base, peaks, 12, 5, 3), base, 10, { color: '#55534F', top: .6, bottom: .0, id: 'gM2', ridgeInk: C.ink1, ridgeW: 3.4, cun: 46, dots: 16, seed: 5, cunLen: 80, tints });
  s += mountainLayer(ridgePts(900, 1620, HORIZON, [{ x: 990, h: 42, w: 80 }, { x: 1440, h: 34, w: 110 }], 13, 3), HORIZON, 4,
    { color: '#74828A', top: .3, bottom: 0, id: 'gM3', seed: 8 });
  return s;
}
function islets() {
  let s = '';
  const pts = ridgePts(150, 340, 524, [{ x: 228, h: 96, w: 26, s: 2.4 }, { x: 276, h: 58, w: 26, s: 2.3 }, { x: 186, h: 38, w: 26 }, { x: 318, h: 20, w: 20 }], 21, 2.5, 3);
  s += mountainLayer(pts, 524, 6, { color: '#2F2C29', top: .85, bottom: .08, id: 'gI1', ridgeInk: C.ink0, ridgeW: 4, cun: 22, dots: 12, seed: 9, cunLen: 45,
    tints: [[244, 452, 16, 34, C.ochre, .5], [288, 482, 14, 22, C.ochre, .4], [210, 470, 14, 30, C.indigo, .3]] });
  s += g(`opacity="0.16" filter="url(#washW)"`, `<path d="${pathOf(pts.map(p => [p[0], 524 + (524 - p[1]) * .3]).concat([[340, 524], [150, 524]]))}" fill="${C.ink2}"/>`);
  return s;
}
function sea() {
  let s = '';
  s += g(`filter="url(#washW)"`, `<rect x="-40" y="${HORIZON - 1}" width="1680" height="250" fill="url(#gSea)"/>`);
  s += g(`fill="${C.ink3}" opacity="0.5" filter="url(#inkW)"`, brush([[-10, HORIZON], [500, HORIZON + .5], [1100, HORIZON - .3], [1610, HORIZON]], { w: 1.4, n: 120, dry: .5, k: 4, a: .05, b: .1, amin: .8, runout: .2 }));
  // rhythmic wave marks in small stacked clusters (水纹)
  const r = rng(77);
  let rp = '', rg = '';
  for (let c = 0; c < 34; c++) {
    const t = Math.pow(r(), 1.2), y0 = HORIZON + 10 + t * 215, x0 = -30 + r() * 1660;
    if (x0 > 130 && x0 < 360 && y0 < 540) continue;
    if (x0 > 990 && x0 < 1420 && y0 < 535) continue;
    const nearSun = Math.abs(x0 - SUN[0]) < 60 + t * 130;
    const rows = 2 + Math.floor(r() * 3);
    for (let k = 0; k < rows; k++) {
      const y = y0 + k * (4 + t * 7), len = (18 + 90 * t) * (0.5 + r() * .7), x = x0 + (r() - .5) * 18 + k * 6;
      const w = .7 + 2 * t * (.6 + r() * .5);
      const pts = [[x, y], [x + len * .5, y - .8 - t], [x + len, y + .3]];
      const st = brush(pts, { w, n: 18, dry: .55, k: 3, a: .25, b: .55, amin: .2, runout: .5, op: .4 + r() * .4, seed: Math.floor(r() * 1e5) });
      if (nearSun) rg += st; else rp += st;
    }
  }
  s += g(`fill="${C.ink3}" filter="url(#inkW)" opacity="0.75"`, rp);
  // sun glitter path
  let gl = '';
  for (let i = 0; i < 64; i++) {
    const t = Math.pow(r(), 1.1), y = HORIZON + 4 + t * 226;
    const spread = 16 + t * 110, x = SUN[0] + (r() - .5) * 2 * spread * (0.4 + .6 * r());
    const len = 8 + t * 44 * (.5 + r());
    gl += brush([[x - len / 2, y], [x, y - .6], [x + len / 2, y]], { w: 1.3 + 2.8 * t * r(), n: 14, a: .3, b: .5, amin: .2, op: .5 + r() * .5, seed: Math.floor(r() * 1e5) });
  }
  s += g(`filter="url(#soft2W)"`, `<ellipse cx="${SUN[0]}" cy="560" rx="190" ry="110" fill="${C.gold}" opacity="0.22"/>`, `<ellipse cx="${SUN[0]}" cy="490" rx="120" ry="20" fill="${C.gold}" opacity="0.35"/>`);
  s += g(`fill="${C.vermL}" filter="url(#wcW)" opacity="0.72"`, gl);
  s += g(`fill="${C.gold}" filter="url(#inkW)" opacity="0.7"`, rg);
  return s;
}
function headland() {
  let s = '';
  const pts = ridgePts(1000, 1410, 522, [{ x: 1182, h: 100, w: 150, s: 3.2 }, { x: 1292, h: 86, w: 88, s: 2.4 }, { x: 1080, h: 38, w: 60 }], 31, 4, 3);
  s += mountainLayer(pts, 522, 4, { color: '#302C28', top: .9, bottom: .04, id: 'gH', ridgeInk: C.ink0, ridgeW: 4.5, cun: 60, dots: 26, seed: 13, cunLen: 70, fade: .35,
    tints: [[1300, 446, 110, 26, C.ochre, .55], [1370, 470, 50, 30, C.vermL, .3], [1120, 460, 90, 30, C.ochre, .3], [1040, 500, 60, 20, C.indigo, .3]] });
  let fm = '';
  const r = rng(91);
  for (let i = 0; i < 12; i++) { const x = 1000 + r() * 410, y = 518 + r() * 6; fm += brush([[x, y], [x + 18 + r() * 34, y + (r() - .5) * 2]], { w: 1.4 + r() * 1.6, n: 12, a: .3, b: .5, amin: .3, op: .9 }); }
  s += g(`fill="${C.ink3}" filter="url(#inkW)" opacity="0.35"`, fm);
  let tr = '';
  for (const [x, sz] of [[1086, 9], [1112, 12], [1134, 8], [1320, 10], [1338, 13]]) {
    const top = pts.reduce((m, p) => Math.abs(p[0] - x) < Math.abs(m[0] - x) ? p : m, pts[0]);
    const y = top[1] + 2;
    tr += brush([[x, y], [x + 1, y - sz]], { w: 1.4, n: 10, a: .1, b: .3, amin: .8 });
    for (let k = 0; k < 4; k++) { const yy = y - sz * (.35 + k * .2), ww = sz * (.9 - k * .18); tr += brush([[x - ww * .6, yy + 1.5], [x, yy - 1], [x + ww * .7, yy + 1.2]], { w: 2.4 - k * .3, n: 12, a: .2, b: .4, amin: .5 }); }
  }
  s += g(`fill="${C.ink0}" filter="url(#inkW)" opacity="0.9"`, tr);
  s += lighthouse(1206, pts.reduce((m, p) => Math.abs(p[0] - 1206) < Math.abs(m[0] - 1206) ? p : m, pts[0])[1] + 3);
  return s;
}
function lighthouse(x, y) {
  let s = '';
  const H = 104, wb = 13, wt = 8.5, yt = y - H;
  // beam (faint warm wedge), glow
  s += `<path d="M${x} ${yt - 10} L${x - 420} ${yt - 64} L${x - 420} ${yt + 38} Z" fill="url(#gBeam)" opacity="0.5"/>`;
  s += `<circle cx="${x}" cy="${yt - 10}" r="34" fill="url(#gLamp)"/>`;
  // tower body (white pigment), shade, red bands
  const body = `M${x - wb} ${y} L${x - wt} ${yt} L${x + wt} ${yt} L${x + wb} ${y} Z`;
  s += `<path d="${body}" fill="${C.paperHi}"/>`;
  s += g(`filter="url(#wcSW)"`,
    `<path d="M${x + 2} ${y} L${x + 1.5} ${yt} L${x + wt} ${yt} L${x + wb} ${y} Z" fill="${C.plumeShade}" opacity="0.8"/>`,
    `<path d="M${x - lerp(wb, wt, .28)} ${y - H * .28} L${x + lerp(wb, wt, .28)} ${y - H * .28} L${x + lerp(wb, wt, .4)} ${y - H * .4} L${x - lerp(wb, wt, .4)} ${y - H * .4} Z" fill="${C.verm}" opacity="0.85"/>`,
    `<path d="M${x - lerp(wb, wt, .62)} ${y - H * .62} L${x + lerp(wb, wt, .62)} ${y - H * .62} L${x + lerp(wb, wt, .74)} ${y - H * .74} L${x - lerp(wb, wt, .74)} ${y - H * .74} Z" fill="${C.verm}" opacity="0.85"/>`);
  // gallery, lantern, cap
  s += `<rect x="${x - 12}" y="${yt - 3}" width="24" height="3.5" fill="${C.ink1}"/>`;
  s += `<rect x="${x - 6.5}" y="${yt - 17}" width="13" height="14" fill="${C.gold}" opacity="0.95"/>`;
  s += `<path d="M${x - 9} ${yt - 17} Q${x} ${yt - 30} ${x + 9} ${yt - 17} Z" fill="${C.ink1}"/>`;
  s += `<path d="M${x} ${yt - 27} L${x} ${yt - 33}" stroke="${C.ink1}" stroke-width="1.4"/>`;
  s += g(`fill="${C.ink1}" filter="url(#inkSW)"`,
    brush([[x - wb, y], [x - wt, yt]], { w: 2.2, n: 20, a: .1, b: .2, amin: .8, dry: .3, k: 3 }),
    brush([[x + wt, yt], [x + wb, y]], { w: 1.8, n: 20, a: .1, b: .2, amin: .8 }),
    brush([[x - 6.5, yt - 3], [x - 6.5, yt - 17]], { w: 1.2, n: 8, amin: .9, b: .1 }),
    brush([[x + 6.5, yt - 3], [x + 6.5, yt - 17]], { w: 1.2, n: 8, amin: .9, b: .1 }));
  // keeper's cottage
  const hx = x + 22, hy = y + 2;
  s += `<path d="M${hx} ${hy} L${hx} ${hy - 16} L${hx + 30} ${hy - 16} L${hx + 30} ${hy} Z" fill="${C.paperHi}"/>`;
  s += g(`fill="${C.ink1}" filter="url(#inkSW)"`, `<path d="M${hx - 4} ${hy - 15} L${hx + 8} ${hy - 26} L${hx + 34} ${hy - 26} L${hx + 34} ${hy - 15} Z"/>`,
    brush([[hx, hy - 15], [hx, hy]], { w: 1.4, n: 8, amin: .9 }), brush([[hx + 30, hy - 15], [hx + 30, hy]], { w: 1.4, n: 8, amin: .9 }),
    `<rect x="${hx + 12}" y="${hy - 11}" width="5" height="5" fill="${C.gold}"/>`);
  return s;
}

function boats() {
  let s = '';
  // a small junk with a rust battened sail
  const bx = 385, by = 578;
  s += g(`opacity="0.25" filter="url(#washW)"`, `<ellipse cx="${bx + 4}" cy="${by + 8}" rx="46" ry="4" fill="${C.ink2}"/>`);
  const sail = [[bx - 4, by - 8], [bx - 10, by - 44], [bx - 2, by - 74], [bx + 26, by - 66], [bx + 32, by - 12]];
  s += g(`filter="url(#wcW)"`, `<path d="${blob(sail, 6)}" fill="${C.ochre}" opacity="0.85"/>`,
    `<path d="${blob([[bx + 36, by - 10], [bx + 34, by - 40], [bx + 44, by - 56], [bx + 54, by - 38], [bx + 50, by - 10]], 6)}" fill="${C.verm}" opacity="0.6"/>`);
  let bat = '';
  for (let i = 1; i < 6; i++) { const yy = by - 10 - i * 11; bat += brush([[bx - 8 + (i === 5 ? 6 : 0), yy], [bx + 30 - (i > 3 ? 4 : 0), yy + 3]], { w: 1.1, n: 10, amin: .6, b: .4 }); }
  s += g(`fill="${C.ink1}" filter="url(#inkSW)" opacity="0.8"`, bat,
    brush([[bx + 12, by - 2], [bx + 12, by - 80]], { w: 1.8, n: 20, amin: .9, b: .15 }),
    brush([[bx + 44, by - 4], [bx + 44, by - 58]], { w: 1.3, n: 14, amin: .9, b: .15 }),
    // hull
    `<path d="${blob([[bx - 26, by - 10], [bx - 6, by - 4], [bx + 38, by - 4], [bx + 64, by - 13], [bx + 50, by + 3], [bx - 12, by + 3]], 6)}"/>`);
  // distant sails
  s += g(`fill="${C.ink3}" filter="url(#inkSW)" opacity="0.6"`,
    `<path d="M1004 492 L1006 470 L1018 489 Z"/>`, brush([[996, 493], [1022, 493]], { w: 1.6, n: 8, amin: .8 }),
    `<path d="M606 486 L607 474 L614 485 Z" opacity="0.7"/>`, brush([[601, 487], [617, 487]], { w: 1.2, n: 8, amin: .8 }));
  return s;
}

function shore() {
  let s = '';
  s += g(`filter="url(#washW)"`, `<rect x="-40" y="706" width="1680" height="48" fill="url(#gSand)"/>`);
  const r = rng(303);
  let sf = '';
  for (let i = 0; i < 22; i++) {
    const x = -20 + i * 76 + r() * 30, y = 704 + r() * 4, L = 26 + r() * 44;
    if (x > 440 && x < 960) continue;
    sf += brush([[x, y + 2.5], [x + L * .5, y + 3.5], [x + L, y + 2.5]], { w: 1.2 + r(), n: 12, a: .3, b: .5, amin: .3, dry: .5, k: 3 });
  }
  s += g(`fill="${C.indigo}" filter="url(#inkW)" opacity="0.4"`, sf);
  // flat reef stones at the waterline: stacked horizontal strokes, no domes
  let rk = '';
  for (const [x, y, w] of [[60, 732, 70], [1186, 734, 60], [1540, 731, 44]]) {
    rk += brush([[x - w * .5, y + 1], [x - w * .1, y - 3], [x + w * .5, y]], { w: 5, n: 18, dry: .5, k: 5, a: .1, b: .4, amin: .7 });
    rk += brush([[x - w * .3, y + 6], [x + w * .1, y + 4.5], [x + w * .42, y + 6.5]], { w: 3, n: 14, dry: .6, k: 4, a: .1, b: .4, amin: .6, op: .7 });
  }
  s += g(`fill="${C.ink1}" filter="url(#inkW)" opacity="0.7"`, rk);
  return s;
}
function roadside() {
  let s = '';
  const r = rng(404);
  // grasses along the far road edge
  let gr = '';
  for (let i = 0; i < 22; i++) {
    const x = r() * 1600, y = 754;
    if (x > 440 && x < 980) continue; // keep the wheels clean
    for (let k = 0; k < 4; k++) { const a = -80 + (r() - .5) * 60, L = 7 + r() * 13; gr += brush([[x, y], [x + Math.cos(a * D) * L * .5, y + Math.sin(a * D) * L * .6], [x + Math.cos(a * D) * L, y + Math.sin(a * D) * L]], { w: 1.4, n: 10, a: .05, b: .7, amin: .9 }); }
  }
  s += g(`fill="${C.ink2}" filter="url(#inkSW)" opacity="0.65"`, gr);
  // lamp posts with lanterns (848 apart, per the parallax spec)
  for (const lx of [262, 1110]) {
    const ly = 756;
    s += `<circle cx="${lx + 16}" cy="${ly - 146}" r="34" fill="url(#gLamp)"/>`;
    s += g(`fill="${C.ink1}" filter="url(#inkSW)"`,
      brush([[lx, ly], [lx - 1, ly - 90], [lx + 1, ly - 150]], { w: 3.6, n: 30, a: .05, b: .1, amin: .9, dry: .25, k: 4 }),
      brush([[lx, ly - 150], [lx + 4, ly - 161], [lx + 15, ly - 162], [lx + 17, ly - 154]], { w: 2.2, n: 20, amin: .9, b: .2 }),
      `<path d="M${lx + 9} ${ly - 154} L${lx + 25} ${ly - 154} L${lx + 22} ${ly - 137} L${lx + 12} ${ly - 137} Z"/>`,
      brush([[lx - 5, ly], [lx + 6, ly]], { w: 3, n: 8, amin: .9 }));
    s += `<path d="M${lx + 12.4} ${ly - 151.4} L${lx + 21.6} ${ly - 151.4} L${lx + 19.8} ${ly - 139.6} L${lx + 14.2} ${ly - 139.6} Z" fill="${C.gold}"/>`;
  }
  return s;
}
function road() {
  let s = '';
  s += g(`filter="url(#washW)"`, `<rect x="-40" y="754" width="1680" height="112" fill="url(#gRoad)"/>`);
  s += g(`filter="url(#soft2W)"`, `<ellipse cx="1260" cy="800" rx="420" ry="40" fill="${C.gold}" opacity="0.18"/>`);
  const r = rng(505);
  let st = '';
  for (let i = 0; i < 16; i++) {
    const y = 776 + r() * 76, x = -40 + r() * 1680, len = 80 + r() * 240;
    st += brush([[x, y], [x + len / 2, y + (r() - .5) * 1.5], [x + len, y]], { w: 1.4 + r() * 2.6, n: 26, dry: .95, k: 5, a: .2, b: .5, amin: .3, runout: .7, op: .5 + r() * .5 });
  }
  s += g(`fill="${C.ink3}" filter="url(#inkW)" opacity="0.3"`, st);
  s += g(`fill="${C.ink2}" filter="url(#inkW)" opacity="0.5"`,
    brush([[-30, 755], [400, 754], [900, 755.5], [1630, 754.5]], { w: 1.6, n: 160, dry: .7, k: 4, a: .02, b: .05, amin: .8, runout: .3, gap: .6 }));
  // near kerb: several overlapping dry strokes of different weight, not one ruler line
  let kb = '';
  for (const [x0, x1, y, w, dr] of [[-40, 520, 863, 7, .6], [430, 1010, 865, 4.5, .8], [930, 1400, 862.5, 6.5, .65], [1330, 1650, 864, 5, .7], [180, 700, 868, 2.4, .9], [1050, 1480, 867.5, 2.2, .9]]) {
    kb += brush([[x0, y], [lerp(x0, x1, .5), y + (r() - .5) * 2.5], [x1, y + (r() - .5) * 2]], { w, n: Math.round((x1 - x0) / 5), dry: dr, k: 8, a: .04, b: .12, amin: .6, runout: .35, jit: .35, fr: 14 });
  }
  s += g(`fill="${C.ink1}" filter="url(#inkW)" opacity="0.88"`, kb);
  s += g(`filter="url(#softW)" opacity="0.3"`, `<rect x="-40" y="866" width="1680" height="12" fill="${C.ink3}"/>`);
  let ds = '';
  for (let x = -30; x < 1640; x += 157.08) ds += brush([[x, 816], [x + 58, 816.6]], { w: 2.6, n: 12, dry: .6, k: 4, a: .15, b: .3, amin: .5 });
  s += g(`fill="${C.ochre}" filter="url(#inkW)" opacity="0.45"`, ds);
  return s;
}
function foreground() {
  let s = '';
  const r = rng(606);
  // bottom-left rock: wet dark silhouette, paper-white top plane (留白), dry highlight streaks, moss ticks
  s += g(`filter="url(#inkBW)"`, `<path d="${blob([[-40, 906], [-32, 852], [-6, 830], [34, 822], [84, 826], [124, 846], [156, 878], [170, 906]], 8)}" fill="${C.ink1}" opacity="0.93"/>`);
  s += g(`filter="url(#inkW)"`, `<path d="${blob([[-6, 838], [30, 826], [80, 829], [114, 846], [72, 841], [30, 846]], 6)}" fill="${C.paper}" opacity="0.92"/>`,
    `<path d="${blob([[96, 842], [128, 854], [150, 880], [120, 872]], 5)}" fill="${C.ochre}" opacity="0.22"/>`);
  let hs = '';
  for (let i = 0; i < 5; i++) { const x = -20 + i * 30 + r() * 10, y = 856 + r() * 10; hs += brush([[x, y], [x + 22, y + 14], [x + 34, y + 34]], { w: 10, n: 18, dry: 1, k: 6, a: .1, b: .5, amin: .8, runout: .6, gap: .5, seed: Math.floor(r() * 1e5) }); }
  s += g(`fill="${C.ink4}" filter="url(#inkW)" opacity="0.5"`, hs);
  s += g(`fill="${C.ink0}" filter="url(#inkW)"`, brush([[-30, 852], [-4, 830], [34, 822], [84, 826], [124, 846]], { w: 4, n: 40, dry: .5, k: 6, a: .06, b: .3, amin: .7 }));
  let md = '';
  for (const [x, y] of [[8, 828], [22, 824], [100, 836], [112, 842]]) md += brush([[x - 2.6, y + .4], [x + 2.6, y - .4]], { w: 2.6, n: 6, amin: .6 });
  s += g(`fill="${C.ink0}" filter="url(#inkW)"`, md);
  let gr = '';
  const tuft = (x, y, n, H, spread, lean = 0) => {
    for (let k = 0; k < n; k++) {
      const a = -90 + lean + (r() - .5) * spread, L = H * (.5 + r() * .6), bend = (r() - .3) * 20 + lean * .4;
      const p1 = [x + Math.cos(a * D) * L * .5, y + Math.sin(a * D) * L * .5], p2 = [x + Math.cos((a + bend) * D) * L, y + Math.sin((a + bend) * D) * L];
      gr += brush([[x + (r() - .5) * 6, y], p1, p2], { w: 2.4 + r() * 2, n: 18, a: .05, b: .75, amin: .9, dry: .2, k: 3, seed: Math.floor(r() * 1e5) });
    }
  };
  tuft(52, 822, 12, 74, 70, 10); tuft(150, 866, 8, 46, 60, 18); tuft(222, 890, 6, 32, 70, 10);
  tuft(1352, 890, 7, 40, 60, -6); tuft(1432, 874, 9, 56, 60, -10);
  s += g(`fill="${C.ink0}" filter="url(#inkW)"`, gr);
  // a few wild asters on thin stems (vermilion accents)
  let st = '', fl = '';
  for (const [x, y, H, lean] of [[88, 824, 46, 14], [110, 834, 34, 20], [1404, 874, 40, -12], [1384, 888, 28, -18]]) {
    const top = [x + Math.sin(lean * D) * H, y - Math.cos(lean * D) * H];
    st += brush([[x, y], [lerp(x, top[0], .5) + 2, lerp(y, top[1], .5)], top], { w: 1.3, n: 14, a: .05, b: .3, amin: .9 });
    for (let k = 0; k < 5; k++) { const a = k * 72 * D + r(); fl += `<ellipse cx="${f(top[0] + Math.cos(a) * 2.6)}" cy="${f(top[1] + Math.sin(a) * 2)}" rx="2" ry="1.3" transform="rotate(${f(a / D)} ${f(top[0] + Math.cos(a) * 2.6)} ${f(top[1] + Math.sin(a) * 2)})"/>`; }
    fl += `<circle cx="${f(top[0])}" cy="${f(top[1])}" r="1.1" fill="${C.gold}"/>`;
  }
  s += g(`fill="${C.ink1}" filter="url(#inkSW)"`, st);
  s += g(`fill="${C.verm}" filter="url(#wcSW)" opacity="0.95"`, fl);
  let rd = '', pl = '';
  for (let i = 0; i < 9; i++) {
    const x = 1470 + i * 16 + r() * 8, y = 905, H = 170 + r() * 120, lean = -(10 + r() * 18);
    const top = [x + Math.sin(lean * D) * H, y - Math.cos(lean * D) * H];
    rd += brush([[x, y], [lerp(x, top[0], .5) + 4, lerp(y, top[1], .5)], top], { w: 2.4, n: 30, a: .05, b: .3, amin: .9, dry: .2, k: 3, seed: Math.floor(r() * 1e5) });
    const ly = y - H * (.3 + r() * .3), lx = lerp(x, top[0], (y - ly) / H);
    rd += brush([[lx, ly], [lx - 20 - r() * 20, ly - 18 - r() * 20], [lx - 44 - r() * 30, ly - 10 - r() * 30]], { w: 4.5, n: 22, a: .15, b: .8, amin: .4, seed: Math.floor(r() * 1e5) });
    pl += brush([top, [top[0] - 12, top[1] - 16], [top[0] - 30, top[1] - 26]], { w: 9, n: 20, dry: .8, k: 6, a: .2, b: .7, amin: .5, runout: .6, seed: Math.floor(r() * 1e5) });
  }
  s += g(`fill="${C.ink1}" filter="url(#inkW)"`, rd);
  s += g(`fill="${C.ochre}" filter="url(#wcW)" opacity="0.8"`, pl);
  return s;
}
// ───────────────────────── bike ─────────────────────────
function tube(a, b, w, col = C.teal, extra = {}) {
  return brush([a, b], { w, n: 24, a: .06, b: .08, amin: .9, min: .8, jit: .06, color: col, ...extra });
}
function wheel(hub, id) {
  let s = '';
  const [hx, hy] = hub;
  // spokes (3-cross, 32)
  let sp = '';
  for (let i = 0; i < 32; i++) {
    const ar = i * 11.25 + 3, side = i % 2 ? 1 : -1, ah = ar + side * 67.5;
    const rim = [hx + 88 * Math.cos(ar * D), hy + 88 * Math.sin(ar * D)], hb = [hx + 7.5 * Math.cos(ah * D), hy + 7.5 * Math.sin(ah * D)];
    sp += `<path d="M${f(hb[0])} ${f(hb[1])}L${f(rim[0])} ${f(rim[1])}"/>`;
  }
  s += g(`stroke="${C.ink3}" stroke-width="0.8" opacity="0.6" fill="none"`, sp);
  // rim
  s += `<circle cx="${hx}" cy="${hy}" r="89.5" fill="none" stroke="${C.ink3}" stroke-width="2.4" opacity="0.8"/>`;
  s += `<circle cx="${hx}" cy="${hy}" r="86.8" fill="none" stroke="${C.ink4}" stroke-width="0.8" opacity="0.7"/>`;
  // tyre — one brush ring, heavy ink, with a dry-brush skip
  const a0 = id === 'r' ? 200 : 150;
  const ring = Array.from({ length: 150 }, (_, i) => { const a = (a0 + i / 149 * 368) * D; return [hx + 95.5 * Math.cos(a), hy + 95.5 * Math.sin(a)]; });
  s += g(`fill="${C.ink0}" filter="url(#inkL)"`, brush(ring, { w: 9.5, n: 150, pre: true, a: .04, b: .1, amin: .7, min: .5, jit: .18, fr: 9, dry: .35, k: 7, runout: .5, gap: .5 }));
  // inner tyre bead (gumwall accent)
  s += `<circle cx="${hx}" cy="${hy}" r="91" fill="none" stroke="${C.ochreL}" stroke-width="1.1" opacity="0.55"/>`;
  // hub
  s += `<circle cx="${hx}" cy="${hy}" r="7.5" fill="${C.ink4}" opacity="0.7"/><circle cx="${hx}" cy="${hy}" r="4.2" fill="${C.ink1}"/>`;
  // valve + a small orange reflector on the front wheel
  const va = (id === 'r' ? 58 : 238) * D;
  s += `<path d="M${f(hx + 86 * Math.cos(va))} ${f(hy + 86 * Math.sin(va))}L${f(hx + 80 * Math.cos(va))} ${f(hy + 80 * Math.sin(va))}" stroke="${C.ink1}" stroke-width="2.2"/>`;
  if (id === 'f') { const ra = 120 * D; s += `<rect x="-5" y="-2.6" width="10" height="5.2" rx="1.5" fill="${C.pouch2}" transform="translate(${f(hx + 55 * Math.cos(ra))} ${f(hy + 55 * Math.sin(ra))}) rotate(30)"/>`; }
  return `<g id="E-wheel-${id}">${s}</g>`;
}
function fender(hub, a0, a1, r = 108) {
  const pts = Array.from({ length: 40 }, (_, i) => { const a = lerp(a0, a1, i / 39) * D; return [hub[0] + r * Math.cos(a), hub[1] + r * Math.sin(a)]; });
  return brush(pts, { w: 6.5, n: 40, pre: true, a: .05, b: .08, amin: .85, min: .8, jit: .05, color: C.cream }) +
    g(`fill="${C.ink2}" opacity="0.85"`, brush(pts.map(([x, y]) => { const dx = x - hub[0], dy = y - hub[1], l = Math.hypot(dx, dy); return [hub[0] + dx / l * (r + 3.2), hub[1] + dy / l * (r + 3.2)]; }), { w: 1.3, n: 40, pre: true, a: .05, b: .1, amin: .8 }));
}
function bikeBack() {
  // pieces behind the wheels: far crank + far pedal
  const far = g(`id="E-crankFar"`, g(`fill="${C.ink2}"`, brush([BB, pedalF], { w: 6, n: 12, a: .05, b: .05, amin: .9, min: .8 })));
  const fp = g(`id="E-pedalFar" transform="translate(${f(pedalF[0])} ${f(pedalF[1])}) rotate(${f(alphaF)})"`, `<rect x="-12" y="-3.5" width="24" height="7" rx="1.5" fill="${C.ink2}"/><circle r="2" fill="${C.ink4}"/>`);
  return { far, fp };
}
function bikeFrame() {
  let s = '';
  const ST_TOP = [-46.5, -232], HT_T = [112, -245], HT_B = [125.6, -203.2];
  // fenders (cream, retro) + stays
  s += g(`filter="url(#wcSL)"`, fender(RH, 178, 298), fender(FH, 214, 338));
  s += g(`stroke="${C.ink3}" stroke-width="1.2" fill="none" opacity="0.8"`,
    `<path d="M${f(RH[0] + 108 * Math.cos(178 * D))} ${f(RH[1] + 108 * Math.sin(178 * D))}L${RH[0]} ${RH[1]}"/>`,
    `<path d="M${f(FH[0] + 108 * Math.cos(338 * D))} ${f(FH[1] + 108 * Math.sin(338 * D))}L${FH[0]} ${FH[1]}"/>`);
  // frame tubes — teal pigment with an ink edge on the shadow side
  let tb = '';
  tb += tube([-4, -84], [-124, -101], 6.2);                  // chainstay
  tb += tube([-43.5, -222], [-123, -103], 5.2);              // seat stay
  tb += tube([2, -88], [123, -211], 9.4);                    // down tube
  tb += tube([-45, -226], [113.4, -239], 7.4);               // top tube
  tb += tube([0, -80], [-47, -234], 8.4);                    // seat tube
  tb += tube(HT_T, HT_B, 11.5);                              // head tube
  s += g(`filter="url(#wcL)"`, tb);
  // ink contour on the underside of each tube (dry brush)
  let ed = '';
  const edge = (a, b, w, off) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), nx = -dy / l * off, ny = dx / l * off; return brush([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny]], { w, n: 26, a: .1, b: .25, amin: .5, dry: .5, k: 3, runout: .4 }); };
  ed += edge([2, -86], [122, -208], 1.6, 4.6);
  ed += edge([-44, -224], [112, -236], 1.4, 3.7);
  ed += edge([-1, -82], [-46, -228], 1.4, -4.2);
  ed += edge([-6, -83], [-122, -99], 1.2, 3.1);
  ed += edge([112, -245], [125.6, -203], 1.6, -5.8);
  s += g(`fill="${C.ink1}" filter="url(#inkL)" opacity="0.85"`, ed);
  // highlights (paper showing through) on the lit top edges
  s += g(`stroke="${C.paperHi}" stroke-width="1.2" fill="none" opacity="0.65" stroke-linecap="round"`,
    `<path d="M-30 -229 L100 -240"/>`, `<path d="M18 -110 L110 -208"/>`, `<path d="M-8 -104 L-38 -206"/>`);
  // lugs + head badge (cream)
  s += g(`fill="${C.cream}" stroke="${C.ink2}" stroke-width="0.9"`,
    `<path d="M${HT_T[0] - 3} ${HT_T[1] + 1} l6 -1 l2 8 l-7 1 Z"/>`, `<path d="M${HT_B[0] - 4} ${HT_B[1] - 8} l7 -1 l2 8 l-7 1 Z"/>`,
    `<circle cx="0" cy="-80" r="8.5"/>`, `<path d="M-50 -236 l8 -1 l2 10 l-8 1 Z"/>`);
  s += `<path d="M116.5 -234 l6 -1 l3.5 12 l-6 1.2 Z" fill="${C.verm}" opacity="0.9"/>`;
  // seat post + sprung leather saddle
  s += g(`fill="${C.ink3}"`, brush([[-47, -230], [-60.5, -278]], { w: 4.6, n: 12, a: .05, b: .05, amin: .9, min: .9 }));
  let sd = '';
  sd += `<path d="${blob([[-101, -283], [-96, -291], [-70, -292], [-40, -290.5], [-23, -288.5], [-22, -285.5], [-44, -283], [-78, -279], [-99, -278]], 6)}" fill="${C.saddle}"/>`;
  sd += g(`fill="${C.ink1}"`, brush([[-101, -281], [-97, -291], [-70, -292.5], [-40, -291], [-22, -288]], { w: 1.8, n: 30, a: .1, b: .2, amin: .7 }));
  s += g(`filter="url(#wcSL)"`, sd);
  s += g(`stroke="${C.ink2}" stroke-width="1.3" fill="none"`,
    `<path d="M-90 -279 q-3 2 0 3 q3 1 0 3 q-3 1 0 3 q3 1 0 3"/>`, `<path d="M-78 -279 q-3 2 0 3 q3 1 0 3 q-3 1 0 3 q3 1 0 3"/>`,
    `<path d="M-94 -267 L-60 -276 L-30 -285"/>`);
  return g(`id="E-frame"`, s);
}
function bikeFork() {
  let s = '';
  const blade = [[125.6, -203.2], [140, -159], [151, -125], [161, -106], [173, -100]];
  s += g(`filter="url(#wcL)"`, brush(blade, { w: 6.4, n: 30, a: .05, b: .1, amin: .95, min: .7, jit: .05, color: C.teal }));
  s += g(`fill="${C.ink1}" filter="url(#inkL)" opacity="0.8"`, brush(blade.map(p => [p[0] - 2.6, p[1] + .8]), { w: 1.3, n: 30, a: .1, b: .2, amin: .6, dry: .4, k: 3 }));
  // basket struts to the dropouts
  s += g(`stroke="${C.ink2}" stroke-width="1.4" fill="none" opacity="0.9"`, `<path d="M150 -228 L173 -100"/>`, `<path d="M212 -228 L173 -100"/>`);
  return g(`id="E-fork"`, s);
}
function bikeBars() {
  let s = '';
  // steerer, stem (15° rise), swept-back city bar, grip
  s += g(`fill="${C.ink2}"`,
    brush([[112, -245], [106.4, -262.1]], { w: 5, n: 10, amin: .95, min: .9, b: .05 }),
    brush([[106.4, -262.1], [132, -269]], { w: 5, n: 12, amin: .95, min: .9, b: .05 }),
    brush([[132, -269], [141, -272], [141, -280], [130, -281.5], [108, -277]], { w: 3.6, n: 30, amin: .95, min: .9, b: .05 }));
  s += `<path d="M126 -281 L101 -276" stroke="${C.saddle}" stroke-width="6.5" stroke-linecap="round"/>`;
  s += `<path d="M125 -283 L103 -278.5" stroke="${C.ochreL}" stroke-width="1.2" stroke-linecap="round" opacity="0.6"/>`;
  // basket bracket
  s += `<path d="M132 -270 L144 -283" stroke="${C.ink2}" stroke-width="2"/>`;
  // bell (brass) on the bar
  s += g(`filter="url(#wcSL)"`, `<path d="M118.5 -283 Q118.5 -290.5 124 -290.5 Q129.5 -290.5 129.5 -283 Z" fill="${C.brass}"/>`);
  s += `<path d="M117.5 -283 L130.5 -283" stroke="${C.ink1}" stroke-width="1.4"/><circle cx="124" cy="-291.5" r="1.3" fill="${C.ink1}"/>`;
  s += `<path d="M120.5 -287 q2 -2.5 4 -2.2" stroke="${C.paperHi}" stroke-width="1" fill="none"/>`;
  // headlamp (cream shell, warm lens, soft glow)
  s += `<circle cx="150" cy="-218" r="26" fill="url(#gLamp)" opacity="0.8"/>`;
  s += `<path d="M126 -207 L136 -214" stroke="${C.ink2}" stroke-width="2"/>`;
  s += g(`filter="url(#wcSL)"`, `<path d="${blob([[131, -224], [144, -225.5], [147, -218], [144, -210.5], [131, -212]], 5)}" fill="${C.cream}"/>`);
  s += `<path d="${blob([[131, -224], [144, -225.5], [147, -218], [144, -210.5], [131, -212]], 5)}" fill="none" stroke="${C.ink1}" stroke-width="1.2"/>`;
  s += `<ellipse cx="146" cy="-218" rx="2.6" ry="7" fill="${C.gold}" stroke="${C.ink1}" stroke-width="0.9"/>`;
  s += basket();
  return g(`id="E-bars"`, s);
}
function fish(x, y, len, ang, { tailUp = false, worried = false, seed = 1 } = {}) {
  // ink fish in the manner of a quick xieyi sketch; local +x = head
  const r = rng(seed);
  const L = len, H = len * .28;
  let s = '';
  const body = [[L * .5, 0], [L * .32, -H * .55], [0, -H * .62], [-L * .3, -H * .35], [-L * .42, -H * .1], [-L * .42, H * .1], [-L * .3, H * .3], [0, H * .5], [L * .32, H * .42]];
  s += `<path d="${blob(body, 6)}" fill="${C.paperHi}"/>`;
  s += g(`filter="url(#wcSL)"`, `<path d="${blob([[L * .46, -H * .1], [L * .3, -H * .55], [0, -H * .62], [-L * .32, -H * .33], [-L * .4, -H * .05], [-L * .1, -H * .15], [L * .25, -H * .1]], 6)}" fill="${C.indigo}" opacity="0.75"/>`);
  // tail fin
  s += `<path d="${blob([[-L * .4, 0], [-L * .62, -H * .75], [-L * .55, -H * .05], [-L * .62, H * .7]], 5)}" fill="${C.ink2}" opacity="0.85"/>`;
  s += g(`fill="${C.ink1}"`,
    brush([[L * .5, 0], [L * .3, -H * .56], [0, -H * .62], [-L * .3, -H * .36], [-L * .42, -H * .08]], { w: 1.6, n: 24, a: .1, b: .3, amin: .6, dry: .3, k: 3 }),
    brush([[L * .48, H * .08], [L * .3, H * .42], [0, H * .5], [-L * .3, H * .3]], { w: 1.1, n: 20, a: .1, b: .4, amin: .6 }),
    brush([[L * .22, -H * .42], [L * .18, 0], [L * .24, H * .34]], { w: 1.1, n: 10, amin: .6 }), // gill
    brush([[-L * .02, -H * .62], [-L * .14, -H * 1.02], [-L * .26, -H * .42]], { w: 1.4, n: 12, amin: .5 })); // dorsal
  s += `<circle cx="${f(L * .34)}" cy="${f(-H * .12)}" r="${f(H * .17)}" fill="${C.paperHi}" stroke="${C.ink1}" stroke-width="0.8"/>`;
  s += `<circle cx="${f(L * .35 + (worried ? -.9 : .5))}" cy="${f(-H * .15)}" r="${f(H * .09)}" fill="${C.ink0}"/>`;
  if (worried) s += `<path d="M${f(L * .5)} ${f(H * .02)} q-2 2.5 -4.5 1.2" stroke="${C.ink1}" stroke-width="1" fill="${C.verm}" fill-opacity="0.5"/>`;
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(ang)})">${s}</g>`;
}
function basket() {
  let s = '';
  // fish first (behind the front wicker wall)
  s += fish(170, -302, 52, -58, { seed: 3 });                         // tail-up fish at the back
  s += fish(205, -309, 58, -62, { worried: true, seed: 5 });          // head-up fish, peeking at the rider
  // basket body
  const B = [[139, -292], [223, -292], [218, -226], [144, -226]];
  s += g(`filter="url(#wcL)"`, `<path d="M139 -292 L223 -292 L218 -226 L144 -226 Z" fill="${C.basket}" opacity="0.92"/>`);
  let wv = '';
  for (let y = -284; y < -228; y += 7.5) wv += brush([[140.5 + (y + 292) * .08, y], [221.5 - (y + 292) * .08, y + .6]], { w: 1.4, n: 18, dry: .4, k: 3, a: .1, b: .2, amin: .7 });
  for (let x = 146; x < 220; x += 9.5) wv += brush([[x, -291], [x + (x - 181) * .06, -227]], { w: 1.1, n: 12, dry: .3, k: 3, amin: .7 });
  s += g(`fill="${C.basketD}" filter="url(#inkL)" opacity="0.85"`, wv);
  s += g(`fill="${C.ink1}" filter="url(#inkL)"`,
    brush([[137, -293], [180, -294], [225, -293]], { w: 4.4, n: 30, a: .05, b: .1, amin: .9, min: .8, dry: .3, k: 4 }),
    brush([[139, -292], [144, -226]], { w: 1.6, n: 14, amin: .8 }), brush([[223, -292], [218, -226]], { w: 2, n: 14, amin: .8, dry: .3, k: 3 }),
    brush([[144, -226], [218, -226]], { w: 2.2, n: 20, amin: .8 }));
  // a fish tail flopping over the front rim
  s += g(`transform="translate(222 -290) rotate(20)"`, `<path d="${blob([[0, 0], [12, -9], [9, 0], [13, 8]], 5)}" fill="${C.ink2}"/>`);
  return s;
}
function drivetrain() {
  // cog, chain, chainring, near crank (+ near pedal separately)
  let cog = '';
  cog += `<circle cx="${RH[0]}" cy="${RH[1]}" r="10.4" fill="${C.ink3}" opacity="0.9"/><circle cx="${RH[0]}" cy="${RH[1]}" r="4" fill="${C.ink1}"/>`;
  const CHAIN_D = 'M-124.92,-109.57 L0.23,-108.55 A28.556,28.556 0 1 1 -8.69,-52.80 L-127.91,-90.88 A9.573,9.573 0 0 1 -124.92,-109.57 Z';
  const chain = `<path d="${CHAIN_D}" fill="none" stroke="${C.ink2}" stroke-width="2.6" opacity="0.9"/>` +
    `<path d="${CHAIN_D}" pathLength="100" fill="none" stroke="${C.ink0}" stroke-width="2.8" stroke-dasharray="1.1 0.9"/>` +
    `<path d="${CHAIN_D}" pathLength="100" fill="none" stroke="${C.ink4}" stroke-width="1.1" stroke-dasharray="0.3 3.7"/>`;
  let ring = '';
  let teeth = '';
  for (let i = 0; i < 48; i++) { const a = i * 7.5 * D; teeth += `M${f(30.2 * Math.cos(a))} ${f(-80 + 30.2 * Math.sin(a))}L${f(27.8 * Math.cos(a))} ${f(-80 + 27.8 * Math.sin(a))}`; }
  ring += `<circle cx="0" cy="-80" r="28.6" fill="none" stroke="${C.ink2}" stroke-width="3.2"/>`;
  ring += `<path d="${teeth}" stroke="${C.ink3}" stroke-width="1.6"/>`;
  ring += `<circle cx="0" cy="-80" r="24" fill="none" stroke="${C.ink4}" stroke-width="1" opacity="0.8"/>`;
  let spider = '';
  for (let i = 0; i < 5; i++) { const a = (i * 72 + 18) * D; spider += brush([[0, -80], [22 * Math.cos(a), -80 + 22 * Math.sin(a)]], { w: 4.2, n: 8, amin: .9, min: .5, b: .4 }); }
  ring += g(`fill="${C.ink2}"`, spider);
  ring += `<circle cx="0" cy="-80" r="7" fill="${C.cream}" stroke="${C.ink1}" stroke-width="1.2"/>`;
  const crank = g(`fill="${C.ink1}"`, brush([BB, pedalN], { w: 7, n: 12, a: .05, b: .05, amin: .95, min: .75 })) +
    `<circle cx="0" cy="-80" r="3" fill="${C.ink4}"/><circle cx="${f(pedalN[0])}" cy="${f(pedalN[1])}" r="2.4" fill="${C.ink4}"/>`;
  const pedal = g(`id="E-pedalNear" transform="translate(${f(pedalN[0])} ${f(pedalN[1])}) rotate(${f(alphaN)})"`,
    `<rect x="-13" y="-3.8" width="26" height="7.6" rx="1.8" fill="${C.ink1}"/><rect x="-11" y="-1" width="22" height="2" fill="${C.ink3}"/><rect x="-14" y="-4" width="3" height="8" fill="${C.pouch2}" opacity="0.9"/>`);
  return {
    cog: g(`id="E-cog"`, cog), chain: g(`id="E-chain"`, chain), chainring: g(`id="E-chainring" filter="url(#inkSL)"`, ring),
    crankNear: g(`id="E-crankNear"`, crank), pedal,
  };
}

// ───────────────────────── pelican ─────────────────────────
const inkLine = (pts, o) => brush(pts, { n: 40, a: .12, b: .35, amin: .5, dry: .45, k: 5, runout: .45, ...o });
function slot(id, o, deg, body, extra = '') { return `<g id="E-${id}" transform="translate(${f(o[0])} ${f(o[1])}) rotate(${f(deg)})"${extra}>${body}</g>`; }

function thigh(far) {
  const plume = far ? '#B9B0A8' : C.paperHi, bare = far ? C.feetFar : C.feet;
  let s = '';
  s += g(`filter="url(#wcSL)"`, brush([[66, 0], [108, 0], [146, 0]], { w: 13, n: 22, a: .05, b: .1, amin: .95, min: .85, jit: .05, color: bare }));
  s += g(`fill="${far ? C.ink2 : C.ink1}" filter="url(#inkL)"`, inkLine([[84, 6], [114, 5.8], [140, 5.2]], { w: 1.7, dry: .4, seed: far ? 201 : 202 }));
  if (!far) s += `<path d="M92 -5 L140 -4.4" stroke="${C.gold}" stroke-width="1.4" opacity="0.8" stroke-linecap="round"/>`;
  const shape = [[-12, -17], [30, -19], [62, -16], [84, -11], [96, -5], [93, 3], [82, 10], [56, 16], [20, 19], [-12, 18]];
  s += `<path d="${blob(shape, 7)}" fill="${plume}"/>`;
  if (!far) s += g(`filter="url(#wcSL)"`, `<path d="${blob([[20, 9], [60, 10], [88, 5], [80, 12], [50, 17], [20, 17]], 5)}" fill="${C.plumeShade}" opacity="0.75"/>`);
  let fr = '';
  for (let i = 0; i < 6; i++) { const y = -10 + i * 3.8; fr += brush([[78 + (i % 2) * 3, y], [92 + (i % 3) * 3, y + 1.2], [103 + (i % 2) * 4, y + 2.6]], { w: 3.4, n: 12, a: .1, b: .7, amin: .6, seed: 210 + i + (far ? 9 : 0) }); }
  s += g(`fill="${plume}"`, fr);
  s += g(`fill="${far ? C.ink2 : C.ink3}" filter="url(#inkL)"`,
    inkLine([[28, 19], [58, 16.5], [86, 10.5], [104, 6]], { w: far ? 2 : 2.8, seed: far ? 221 : 222 }),
    inkLine([[58, -16], [80, -12], [98, -6]], { w: 1.6, seed: 223, op: .75 }),
    brush([[90, -3], [100, -1], [106, 2]], { w: 1.1, n: 10, amin: .5, op: .7 }),
    brush([[88, 4], [98, 5], [104, 7]], { w: 1.1, n: 10, amin: .5, op: .7 }),
    brush([[20, -2], [50, 0], [70, 2]], { w: 1, n: 12, amin: .3, op: .45 }));
  return s;
}
function shank(far) {
  const col = far ? C.feetFar : C.feet;
  let s = '';
  s += g(`filter="url(#wcSL)"`, brush([[-4, 0], [60, 0], [136, 0]], { w: 11.5, n: 30, a: .05, b: .12, amin: .95, min: .78, jit: .05, color: col }));
  s += g(`fill="${far ? C.ink2 : C.ink1}" filter="url(#inkL)"`, inkLine([[6, 5.4], [70, 4.8], [132, 4.2]], { w: 1.8, seed: far ? 51 : 52, dry: .5 }));
  if (!far) s += `<path d="M12 -4.4 L128 -3.6" stroke="${C.gold}" stroke-width="1.4" opacity="0.85" stroke-linecap="round"/>`;
  let sc = '';
  for (let x = 30; x < 128; x += 13) sc += brush([[x, -3.6], [x + 3, -1.4]], { w: 1, n: 6, amin: .6, op: .5 });
  s += g(`fill="${far ? C.ink2 : '#A9531F'}"`, sc);
  s += `<ellipse cx="0" cy="0" rx="6.6" ry="6.2" fill="${col}"/>`;
  return s;
}
function foot(far) {
  const web = far ? '#B8693A' : '#F7B274', toe = far ? '#A85A2A' : '#E0782E', ink = far ? C.ink2 : C.ink1;
  let s = '';
  const T1 = [51, 3.5], T2 = [45, 10.5], T3 = [37, 12.5];
  const webShape = [[-7, 1.5], [-3, -6], [8, -5.5], [26, -3.2], [42, -1.2], T1, [46.5, 5.4], T2, [40.5, 8.6], T3, [31, 6.4], [18, 5.6], [4, 5.8], [-5, 5.5]];
  s += g(`filter="url(#wcSL)"`, `<path d="${blob(webShape, 5)}" fill="${web}"/>`);
  s += g(`fill="${toe}"`,
    brush([[2, -2.8], [22, -2.2], [38, -.2], T1], { w: 3.4, n: 20, a: .05, b: .25, amin: .95, min: .5 }),
    brush([[6, 0], [24, 1.6], [36, 5], T2], { w: 3, n: 18, a: .05, b: .25, amin: .95, min: .5 }),
    brush([[6, 2.6], [22, 4.6], [31, 7.5], T3], { w: 2.6, n: 16, a: .05, b: .25, amin: .95, min: .5 }));
  s += `<path d="M10 -4.4 Q28 -3.8 44 -1" stroke="#FFE0B4" stroke-width="1" fill="none" opacity="0.7"/>`;
  s += g(`fill="${ink}" filter="url(#inkSL)"`,
    inkLine([[-7, 1.5], [-3, -6], [10, -5.6], [28, -2.8], [43, -0.8], [51, 3.2]], { w: 2, n: 30, seed: far ? 61 : 62, dry: .2 }),
    brush([T1, [46.2, 6.2], T2], { w: 1.2, n: 10, a: .1, b: .2, amin: .8, op: .85 }),
    brush([T2, [40, 9.4], T3], { w: 1.2, n: 10, a: .1, b: .2, amin: .8, op: .85 }),
    brush([T3, [30, 7], [18, 6.2], [4, 6.2]], { w: 1.1, n: 14, a: .1, b: .3, amin: .8, op: .7 }),
    `<path d="M${T1[0] - .6} ${T1[1] - 1.4} q4 1.2 3.6 4.2 q-2.2 -1.6 -4.2 -1.8 Z"/>`,
    `<path d="M${T2[0] - .8} ${T2[1] - 1.2} q3.6 1.4 2.8 4.4 q-2 -1.8 -3.8 -2.2 Z"/>`,
    `<path d="M${T3[0] - .8} ${T3[1] - 1.2} q3.2 1.6 2.2 4.2 q-1.8 -1.8 -3.4 -2.4 Z"/>`);
  return s;
}
function wingUpper(far) {
  const fill = far ? '#B2AAA3' : C.paperHi;
  let s = '';
  const shape = [[-16, -10], [8, -22], [44, -22], [72, -15], [88, -3], [84, 10], [68, 20], [46, 28], [22, 31], [0, 28], [-16, 16]];
  s += `<path d="${blob(shape, 7)}" fill="${fill}"/>`;
  if (!far) {
    // the arm lies within the body plumage: same white, a shared lavender shade, feather rows
    s += g(`filter="url(#wcSL)"`, `<path d="${blob([[8, 14], [40, 22], [74, 10], [70, 20], [44, 29], [14, 29]], 5)}" fill="${C.plumeShade}" opacity="0.6"/>`);
    s += g(`filter="url(#softL)"`, `<path d="${blob([[10, -18], [44, -20], [74, -12], [60, -8], [30, -10]], 5)}" fill="${C.gold}" opacity="0.3"/>`);
    let sc = '';
    const rows = [{ c: [[18, 4], [40, 8], [60, 4], [78, -2]], n: 5 }, { c: [[12, 18], [34, 23], [56, 17], [74, 8]], n: 5 }];
    for (const row of rows) {
      const pts = resample(catmull(row.c, 40), row.n);
      for (const [x, y] of pts) sc += brush([[x - 6, y - 3], [x - 1, y + 2.6], [x + 5, y + 1]], { w: 1.4, n: 10, a: .2, b: .5, amin: .4 });
    }
    s += g(`fill="${C.ink4}" filter="url(#inkSL)" opacity="0.8"`, sc);
  }
  // a short leading-edge accent near the elbow only
  s += g(`fill="${C.ink3}" filter="url(#inkL)"`,
    inkLine([[46, -21], [70, -15], [86, -5], [89, 4]], { w: far ? 1.6 : 2.4, seed: far ? 71 : 72, a: .4, b: .3, amin: .1, op: .8 }));
  return s;
}
function wingLower(far) {
  const fill = far ? '#B2AAA3' : C.paperHi, blk = far ? '#2E2A2C' : C.flight;
  let s = '';
  let sec = '', vein = '', bloom = '';
  for (let i = 6; i >= 0; i--) {
    const x = -8 + i * 12.6, L = 46 - i * 2.2;
    const dx = -0.78, dy = 0.63;
    const root = [x, 5], mid = [x + dx * L * .5 - 1, 5 + dy * L * .5 + 2.5], tip = [x + dx * L, 5 + dy * L];
    sec += brush([root, mid, tip], { w: 12.5 - i * .3, n: 24, a: .1, b: .3, amin: .85, min: .32, jit: .12, dry: .2, k: 6, runout: .3, gap: .2, seed: 80 + i + (far ? 20 : 0) });
    if (!far) {
      vein += `<path d="M${f(root[0] + 2)} ${f(root[1] + 3)} Q${f(mid[0] + 3)} ${f(mid[1] - 2)} ${f(tip[0] + 4)} ${f(tip[1] - 3)}"/>`;
      if (i % 2 === 0) bloom += `<ellipse cx="${f(lerp(mid[0], tip[0], .45))}" cy="${f(lerp(mid[1], tip[1], .45))}" rx="4" ry="7" transform="rotate(${f(-50)} ${f(lerp(mid[0], tip[0], .45))} ${f(lerp(mid[1], tip[1], .45))})"/>`;
    }
  }
  s += g(`fill="${blk}" filter="url(#inkL)"`, sec);
  // 破墨: lighter ink blooming inside the wet black
  if (!far) s += g(`fill="${C.ink3}" filter="url(#softL)" opacity="0.45"`, bloom);
  if (!far) s += g(`stroke="${C.sheen}" stroke-width="1.1" fill="none" opacity="0.95"`, vein);
  const shape = [[-16, -12], [20, -14.5], [52, -11.5], [82, -6], [84, 3], [60, 9], [30, 12], [0, 15], [-16, 10]];
  s += `<path d="${blob(shape, 7)}" fill="${fill}"/>`;
  let sc = '';
  for (let i = 0; i < 8; i++) { const x = -8 + i * 11; sc += brush([[x - 6, 9.5 - i * .7], [x, 14.5 - i * .8], [x + 6, 10 - i * .7]], { w: 1.5, n: 10, a: .2, b: .5, amin: .4 }); }
  s += g(`fill="${C.ink3}" filter="url(#inkSL)" opacity="0.8"`, sc);
  if (!far) s += g(`filter="url(#softL)"`, `<path d="${blob([[-8, 4], [40, 5], [78, 1], [60, 8], [20, 12]], 5)}" fill="${C.plumeShade}" opacity="0.7"/>`);
  s += g(`fill="${C.ink2}" filter="url(#inkL)"`, inkLine([[-8, -13.5], [26, -15], [56, -11.5], [82, -5.5]], { w: far ? 2 : 3.4, seed: far ? 91 : 92, a: .2, amin: .4 }));
  if (!far) s += `<path d="M6 -11.5 Q40 -14.5 76 -7" stroke="${C.gold}" stroke-width="1.8" fill="none" opacity="0.55" stroke-linecap="round"/>`;
  return s;
}
function wingHand(far) {
  const blk = far ? '#2E2A2C' : C.flight;
  let s = '';
  let pr = '';
  // long primaries splaying forward-down past the grip
  const prim = [[[-10, 1], [6, 13], [24, 29]], [[-11, 4], [0, 18], [12, 36]], [[-12, 7], [-5, 22], [0, 38]]];
  prim.forEach((pts, i) => { pr += brush(pts, { w: 9.5 - i * .6, n: 22, a: .1, b: .62, amin: .8, min: .06, dry: .28, k: 5, runout: .4, seed: 101 + i + (far ? 9 : 0) }); });
  const fingers = [[[-12, -2], [-2, -10.5], [9, -7.5], [11.5, 1.5], [7, 7.5]], [[-10, 1], [0, -7.5], [8, -4], [8.5, 3.5], [4, 7.5]]];
  fingers.forEach((pts, i) => { pr += brush(pts, { w: 7.4 - i * 1.2, n: 22, a: .12, b: .35, amin: .85, min: .35, seed: 110 + i + (far ? 9 : 0) }); });
  s += g(`fill="${blk}" filter="url(#inkL)"`, pr);
  if (!far) s += g(`stroke="${C.sheen}" stroke-width="1.1" fill="none" opacity="0.9"`, `<path d="M-6 -6.5 Q3 -11 9 -5"/>`, `<path d="M-4 5 Q8 15 20 26"/>`, `<path d="M-6 9 Q1 21 9 32"/>`);
  s += `<path d="${blob([[-24, -9], [-10, -11.5], [-3, -6], [-7, 3], [-20, 6], [-27, -1]], 5)}" fill="${far ? '#B2AAA3' : C.paperHi}"/>`;
  s += g(`fill="${C.ink2}" filter="url(#inkSL)"`, brush([[-26, -8], [-12, -11.8], [-3, -6.5]], { w: 2.2, n: 12, amin: .5 }));
  return s;
}
function neckPath() {
  const Cc = cubicPts(...NP, 60);
  const Cn = resample(Cc, 40);
  const N = normals(Cn);
  const wAt = t => lerp(34, 24, t) * (1 + .1 * Math.sin(t * Math.PI));
  const front = Cn.map((p, i) => [p[0] + N[i][0] * wAt(i / 39) / 2, p[1] + N[i][1] * wAt(i / 39) / 2]);
  const back = Cn.map((p, i) => [p[0] - N[i][0] * wAt(i / 39) / 2, p[1] - N[i][1] * wAt(i / 39) / 2]);
  return { Cn, front, back };
}
function neck() {
  const { front, back, Cn } = neckPath();
  let s = '';
  s += `<path d="${pathOf([...front, ...back.slice().reverse()])}" fill="${C.paperHi}"/>`;
  s += g(`filter="url(#softL)"`, brush(back.slice(3, 36).map(p => [p[0] + 5, p[1] + 1]), { w: 10, n: 30, a: .3, b: .4, amin: .2, color: C.plumeShade, op: .9 }));
  s += g(`filter="url(#softL)"`, brush(front.slice(4, 36).map(p => [p[0] - 3.5, p[1]]), { w: 6, n: 30, a: .3, b: .3, amin: .2, color: C.gold, op: .6 }));
  // silk feather strokes along the neck
  s += g(`fill="${C.ink3}" filter="url(#inkSL)"`,
    silk(back.slice(4, 36).map((p, i) => [lerp(p[0], Cn[i + 4][0], .35), lerp(p[1], Cn[i + 4][1], .35)]), { n: 14, len: 12, spread: 6, seed: 301, op: .4, ang: 0 }),
    silk(Cn.slice(8, 34), { n: 8, len: 10, spread: 10, seed: 302, op: .22 }));
  const bk = back.slice(1, 39);
  const C0 = resample(bk, 50);
  const wf = t => 5.2 * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, t * 1.25 + .05))) * (1 - 0.55 * sstep(.6, 1, t));
  s += g(`fill="${C.ink1}" filter="url(#inkL)"`, `<path d="${stroke(C0, wf)}"/>`,
    ...bristles(C0.slice(30), t => 3.4, { k: 5, seed: 133, runout: .5, gap: .4 }).map(b => `<path d="${b.d}" opacity="${f2(b.op * .7)}"/>`));
  s += g(`fill="${C.ink3}" filter="url(#inkL)"`, inkLine(front.slice(10, 30), { w: 1.8, n: 24, seed: 132, op: .7, dry: .6, amin: .2 }));
  return g(`id="E-neck"`, s);
}
function bodyArt() {
  const E = th => add([32, -50], rot([98 * Math.cos(th * D), 58 * Math.sin(th * D)], -18));
  const Ek = (th, k) => add([32, -50], rot([98 * k * Math.cos(th * D), 58 * k * Math.sin(th * D)], -18));
  let s = '';
  const outline = [];
  for (let a = 0; a < 360; a += 10) outline.push(E(a));
  s += `<path d="${blob(outline, 4)}" fill="${C.paperHi}"/>`;
  s += g(`filter="url(#soft2L)"`,
    `<path d="${blob([E(-10), E(40), E(90), E(140), E(190), add(E(170), [16, -12]), add(E(90), [0, -30]), add(E(20), [-12, -8])], 5)}" fill="#F2CFC6" opacity="0.6"/>`,
    `<path d="${blob([E(40), E(80), E(120), E(160), add(E(150), [8, -14]), add(E(100), [0, -18]), add(E(55), [-6, -14])], 5)}" fill="${C.plumeShade}" opacity="0.9"/>`,
    `<path d="${blob([E(-30), E(-60), E(-95), E(-130), add(E(-110), [4, 18]), add(E(-60), [0, 18])], 5)}" fill="${C.gold}" opacity="0.34"/>`,
    `<ellipse cx="108" cy="-80" rx="22" ry="17" fill="${C.pouch1}" opacity="0.5"/>`);
  // a pale ink wash pooled under the belly (hard-edged, like a real wash)
  s += g(`filter="url(#wcL)"`, `<path d="${blob([E(60), E(90), E(125), E(155), Ek(150, .82), Ek(110, .78), Ek(70, .8)], 5)}" fill="${C.plumeDeep}" opacity="0.32"/>`);
  let sp = '';
  for (let k = 0; k < 3; k++) {
    const pts = []; for (let a = -70 - k * 8; a >= -160 + k * 6; a -= 8) pts.push(Ek(a, .8 - k * .12).map((v, j) => j ? v * 1 : v));
    sp += inkLine(pts, { w: 1.6, n: 30, seed: 144 + k, op: .6, dry: .7, a: .3, b: .4, amin: .2 });
  }
  s += g(`fill="${C.ink3}" filter="url(#inkL)"`, sp);
  // silk strokes along the back and flank
  const guide1 = []; for (let a = -50; a >= -170; a -= 10) guide1.push(Ek(a, .9));
  const guide2 = []; for (let a = 150; a >= 60; a -= 10) guide2.push(Ek(a, .88));
  s += g(`fill="${C.ink4}" filter="url(#inkSL)"`, silk(guide1, { n: 16, len: 16, spread: 10, seed: 311, op: .45, ang: 180 }), silk(guide2, { n: 12, len: 12, spread: 8, seed: 312, op: .35, ang: 180 }));
  const back = []; for (let a = -36; a >= -166; a -= 6) back.push(add(E(a), [0, 1.2]));
  const Cb = resample(catmull(back, 120), 60);
  const wb = t => 6.2 * (0.3 + 0.7 * Math.sin(Math.PI * Math.min(1, t * 1.1 + .06))) * (1 - .4 * sstep(.7, 1, t));
  s += g(`fill="${C.ink1}" filter="url(#inkL)"`, `<path d="${stroke(Cb.slice(0, 48), t => wb(t * 48 / 60))}"/>`,
    ...bristles(Cb.slice(40), t => 5.2, { k: 6, seed: 141, runout: .55, gap: .45 }).map(b => `<path d="${b.d}" opacity="${f2(b.op * .8)}"/>`));
  const belly1 = []; for (let a = 170; a >= 116; a -= 6) belly1.push(E(a));
  const belly2 = []; for (let a = 60; a >= 8; a -= 6) belly2.push(E(a));
  s += g(`fill="${C.ink2}" filter="url(#inkL)"`,
    inkLine(belly1, { w: 3, n: 24, seed: 142, op: .85 }),
    inkLine(belly2, { w: 2.6, n: 24, seed: 143, op: .8, dry: .55 }));
  const chest = []; for (let a = 4; a >= -24; a -= 4) chest.push(E(a));
  s += g(`fill="${C.ink3}" filter="url(#inkL)"`, inkLine(chest, { w: 2, n: 14, seed: 148, op: .6 }));
  // golden rim on the sun-facing chest
  const rim = []; for (let a = 34; a >= -30; a -= 4) rim.push(Ek(a, .96));
  s += g(`fill="${C.gold}" filter="url(#softL)"`, brush(rim, { w: 5, n: 20, a: .3, b: .4, amin: .2, op: .7 }));
  let ft = '';
  const r = rng(147);
  for (let i = 0; i < 10; i++) {
    const a = -150 + r() * 110, k = .5 + r() * .3;
    const p = Ek(a, k);
    ft += brush([[p[0] - 6, p[1] - 1], [p[0], p[1] + 2.5], [p[0] + 6, p[1] - .5]], { w: 1.2, n: 10, a: .2, b: .5, amin: .4, op: .6 + r() * .4 });
  }
  s += g(`fill="${C.ink4}" filter="url(#inkSL)" opacity="0.8"`, ft);
  return s;
}
function tailArt() {
  // short rounded fan emerging from the rump; root hidden inside the body
  let s = '';
  const shape = [[16, -12], [-6, -14], [-26, -11], [-42, -6], [-36, -2], [-45, 2], [-35, 6], [-40, 11], [-22, 14], [2, 17], [16, 8]];
  s += `<path d="${blob(shape, 6)}" fill="${C.paperHi}"/>`;
  s += g(`filter="url(#softL)"`, `<path d="${blob([[0, 6], [-22, 7], [-38, 9], [-22, 13], [0, 14]], 4)}" fill="${C.plumeShade}" opacity="0.9"/>`);
  s += g(`fill="${C.ink2}" filter="url(#inkL)"`,
    inkLine([[2, -13.5], [-18, -13], [-34, -9], [-44, -5.5]], { w: 2.8, seed: 151, a: .15, amin: .5, dry: .5 }),
    brush([[-14, -4], [-30, -2.5], [-45, 2]], { w: 1.4, n: 14, amin: .5, op: .75 }),
    brush([[-12, 5], [-28, 7], [-40, 11]], { w: 1.3, n: 14, amin: .5, op: .7 }),
    brush([[-6, 14], [-22, 14.5], [-38, 12]], { w: 1.6, n: 14, amin: .5, op: .7 }));
  return s;
}
function scarf() {
  const { Cn } = neckPath();
  const i0 = 7, c = Cn[i0], nx = normals(Cn)[i0];
  const fr = add(c, [nx[0] * 18, nx[1] * 18]), bk = add(c, [-nx[0] * 18, -nx[1] * 18]);
  let s = '';
  const band = [add(bk, [-4, -8]), add(c, [0, -10]), add(fr, [3, -7]), add(fr, [6, 1]), add(fr, [2, 7]), add(c, [0, 6]), add(bk, [-3, 7]), add(bk, [-6, 0])];
  s += g(`filter="url(#wcL)"`,
    brush([add(bk, [0, -3]), [8, -442], [-30, -428], [-70, -452], [-116, -438]], { w: 16, n: 44, a: .1, b: .3, amin: .9, min: .45, jit: .22, fr: 3, color: C.verm, op: .95 }),
    brush([add(bk, [2, 4]), [12, -420], [-24, -404], [-60, -420], [-96, -408]], { w: 12, n: 40, a: .1, b: .3, amin: .9, min: .45, jit: .22, fr: 3, color: C.vermL, op: .92 }),
    `<path d="${blob(band, 6)}" fill="${C.verm}"/>`);
  // folds and edges
  s += g(`fill="#7E1D10" filter="url(#inkL)" opacity="0.6"`,
    brush([add(bk, [0, -4]), [6, -446], [-30, -432], [-68, -456]], { w: 1.5, n: 30, dry: .6, k: 3, amin: .5, b: .5 }),
    brush([[10, -424], [-24, -409], [-58, -424]], { w: 1.3, n: 24, dry: .6, k: 3, amin: .5, b: .5 }),
    brush([add(fr, [2, -6]), add(c, [0, -9.5]), add(bk, [-3, -7.5])], { w: 1.5, n: 16, amin: .5 }),
    brush([add(fr, [1, 6]), add(c, [0, 5.5]), add(bk, [-2, 6])], { w: 1.2, n: 16, amin: .5 }));
  let fringe = '';
  for (let i = 0; i < 5; i++) fringe += brush([[-114 + i * 1.5, -445 + i * 3.4], [-124 - i * .5, -448 + i * 3.8]], { w: 1.5, n: 6, amin: .8 });
  for (let i = 0; i < 4; i++) fringe += brush([[-94 + i * 1.5, -413 + i * 3], [-103 - i * .5, -415 + i * 3.4]], { w: 1.4, n: 6, amin: .8 });
  s += g(`fill="${C.verm}"`, fringe);
  s += g(`filter="url(#wcSL)"`, `<ellipse cx="${f(fr[0] + 2)}" cy="${f(fr[1])}" rx="7" ry="6" fill="${C.verm}"/>`);
  s += brush([add(fr, [1, 4]), add(fr, [8, 16]), add(fr, [4, 28])], { w: 7, n: 16, amin: .9, b: .4, color: C.vermL, op: .95 });
  return g(`id="E-scarf"`, s);
}
function headArt() {
  let s = '';
  const shape = [[19, -4], [16, -14], [8, -24], [-6, -28.5], [-19, -23], [-26, -10], [-26, 4], [-18, 14], [0, 17], [14, 12], [19, 6]];
  s += `<path d="${blob(shape, 7)}" fill="${C.paperHi}"/>`;
  s += g(`filter="url(#softL)"`, `<path d="${blob([[-24, -6], [-20, 8], [-6, 15], [-14, 4]], 5)}" fill="${C.plumeShade}" opacity="0.9"/>`,
    `<path d="${blob([[2, -27], [14, -17], [8, -19]], 4)}" fill="${C.gold}" opacity="0.55"/>`);
  // bare facial skin (pink → yellow toward the bill)
  s += g(`filter="url(#wcSL)"`, `<path d="${blob([[-4, -9], [2, -15.5], [12, -15], [20, -8], [21.5, 2.5], [14, 3.5], [7, -.5], [-1, -2.5]], 6)}" fill="${C.skin}"/>`,
    `<path d="${blob([[13, -10], [20.5, -6], [21.5, 2], [15, 2]], 4)}" fill="${C.pouch1}" opacity="0.7"/>`);
  // crown contour — confident, heavy at the back of the head
  s += g(`fill="${C.ink1}" filter="url(#inkL)"`,
    inkLine([[18, -12], [9, -24.5], [-6, -29.2], [-20, -23.5], [-26.8, -9], [-25, 5]], { w: 3.8, n: 30, seed: 161, a: .1, b: .4, amin: .5, dry: .3 }),
    brush([[-2, 17], [8, 15], [15, 11]], { w: 1.4, n: 10, amin: .5, op: .6 }));
  // gape: a small upturned line under the eye → a contented smile
  s += g(`fill="${C.billEdge}"`, brush([[21, 4.5], [15, 5.2], [10, 3.2]], { w: 1.8, n: 10, a: .2, b: .5, amin: .6 }));
  return s;
}
function eyeArt() {
  let s = '';
  s += `<circle r="5.2" fill="#6E2419"/><circle r="3.7" fill="${C.ink0}"/><circle cx="1.6" cy="-1.8" r="1.6" fill="#FFFDF8"/><circle cx="-1.5" cy="1.7" r="0.7" fill="#FFFDF8" opacity="0.8"/>`;
  s += g(`fill="${C.ink0}"`,
    brush([[-6.6, -1], [-2.5, -6], [3.5, -6.4], [7.6, -2.6]], { w: 1.9, n: 16, a: .2, b: .5, amin: .5 }),
    brush([[-7.2, -.8], [-10.2, -1.6]], { w: 1.2, n: 6, amin: .7 }),
    brush([[-4.6, 3.2], [0, 5.2], [4.6, 3.6]], { w: 1.1, n: 10, a: .3, b: .4, amin: .3, op: .7 }));
  return s;
}
function crestArt() {
  let s = '';
  const tufts = [[[0, 0], [12, 2], [24, 8], [32, 15]], [[0, -2], [14, -1], [27, 2], [37, 6]], [[-1, 2], [11, 7], [19, 14], [22, 22]], [[2, -4], [13, -6], [22, -5], [28, -2]], [[0, 4], [7, 10], [11, 17]], [[1, -1], [15, 3], [27, 11]], [[2, 1], [10, 4], [17, 10], [19, 16]]];
  tufts.forEach((pts, i) => { s += brush(pts, { w: 3 - (i % 3) * .45, n: 20, a: .08, b: .8, amin: .8, dry: .5, k: 4, runout: .55, seed: 170 + i, op: i % 2 ? .75 : 1 }); });
  return g(`fill="${C.ink3}" filter="url(#inkL)"`, s) +
    g(`fill="${C.ink1}" filter="url(#inkL)"`, brush([[0, 0], [10, 1.5], [20, 6]], { w: 2.4, n: 14, a: .1, b: .7, amin: .8, seed: 179 }), brush([[0, -2], [12, -2], [22, 0]], { w: 2, n: 14, a: .1, b: .7, amin: .8, seed: 178 }));
}
function billUpperArt() {
  let s = '';
  const shape = [[-2, -8.5], [20, -8], [60, -5.8], [100, -3.8], [116, -3.2], [116, 3], [100, 3.2], [60, 3.6], [20, 4.4], [-2, 4.6]];
  s += g(`filter="url(#wcSL)"`, `<path d="${blob(shape, 5)}" fill="url(#gBill)"/>`);
  // hooked nail: the tip curls down over the lower mandible
  const nail = [[114, -3.3], [122, -2.8], [127.5, -1], [130.2, 2.6], [129.4, 7.2], [127.2, 8.8], [126.6, 5.6], [124.6, 3.4], [116, 3.1]];
  s += g(`filter="url(#wcSL)"`, `<path d="${blob(nail, 4)}" fill="${C.nail}"/>`);
  s += g(`fill="${C.ink1}" filter="url(#inkSL)"`,
    inkLine([[0, -8.6], [30, -8], [70, -5.6], [108, -3.7], [122, -2.9], [127.8, -1], [130.4, 2.6], [129.6, 7.2], [127.2, 9]], { w: 2.2, n: 50, seed: 181, a: .08, b: .12, amin: .9, dry: .25, k: 4 }),
    brush([[4, 3.8], [50, 3.2], [100, 2.8], [124.5, 3.4], [126.8, 6]], { w: 1.2, n: 30, a: .1, b: .3, amin: .6, op: .9 }),
    brush([[114.5, -3], [116, 0], [115.6, 3]], { w: .9, n: 8, amin: .6, op: .6 }));
  s += `<path d="M10 -3 Q60 -2.6 112 -0.8" stroke="${C.billEdge}" stroke-width="1" fill="none" opacity="0.6"/>`;
  s += `<path d="M24 -6.2 Q70 -4.8 108 -2.6" stroke="#FFE6D8" stroke-width="1.2" fill="none" opacity="0.55" stroke-linecap="round"/>`;
  return s;
}
function billLowerArt() {
  let s = '';
  s += `<path d="${blob([[-2, -1.4], [60, -1.2], [118, -0.4], [121, 1.8], [60, 3], [-2, 3.4]], 4)}" fill="${C.billEdge}"/>`;
  s += g(`fill="${C.ink1}"`, brush([[0, 3.2], [60, 2.8], [119, 1.8]], { w: 1, n: 20, amin: .6, op: .7 }));
  return s;
}
function pouchArt() {
  let s = '';
  const shape = [[-26, 12], [-14, -4], [10, -3.6], [45, -3.4], [80, -3.2], [106, -3.6], [99, 2.4], [80, 10], [58, 20], [38, 28], [18, 32.5], [2, 31], [-14, 26]];
  s += g(`filter="url(#wcL)"`, `<path d="${blob(shape, 6)}" fill="url(#gPouch)"/>`);
  // skin folds and an ink under-contour, broken
  s += g(`fill="${C.pouch2}" filter="url(#inkSL)" opacity="0.8"`,
    brush([[4, 8], [26, 14], [50, 12]], { w: 1.4, n: 14, a: .2, b: .5, amin: .3 }),
    brush([[-8, 16], [16, 24], [40, 20]], { w: 1.3, n: 14, a: .2, b: .5, amin: .3 }));
  s += g(`fill="${C.ink2}" filter="url(#inkL)"`,
    inkLine([[100, 3], [80, 11], [56, 21.5], [34, 29.5], [16, 33.5], [0, 31.5], [-14, 26]], { w: 2, n: 36, seed: 191, op: .75, dry: .5 }));
  s += `<path d="M20 6 Q40 8 64 4" stroke="#FFF3D6" stroke-width="2.2" fill="none" opacity="0.6" stroke-linecap="round"/>`;
  return s;
}

function pelicanParts() {
  const kneeN = legN.j, kneeF = legF.j;
  return {
    // far limbs
    wingFarUpper: slot('wingFarUpper', shF, wingF.a1, wingUpper(true)),
    wingFarLower: slot('wingFarLower', wingF.j, wingF.a2, wingLower(true)),
    wingFarHand: slot('wingFarHand', gripF, 15, wingHand(true)),
    footFar: slot('footFar', ankleF, alphaF, foot(true)),
    shankFar: slot('shankFar', kneeF, legF.a2, shank(true)),
    thighFar: slot('thighFar', hipF, legF.a1, thigh(true)),
    neck: neck(),
    tail: slot('tail', add(PELVIS, [-62, -38]), 8, tailArt()),
    body: slot('body', PELVIS, 0, bodyArt()),
    shankNear: slot('shankNear', kneeN, legN.a2, shank(false)),
    footNear: slot('footNear', ankleN, alphaN, foot(false)),
    thighNear: slot('thighNear', hipN, legN.a1, thigh(false)),
    pouch: slot('pouch', pouch0, BILL_ANG, pouchArt()),
    billLower: slot('billLower', billL0, BILL_ANG, billLowerArt()),
    billUpper: slot('billUpper', billU0, BILL_ANG, billUpperArt()),
    head: slot('head', HEAD, 0, headArt()),
    eye: slot('eye', add(HEAD, [6, -7]), 0, eyeArt()),
    crest: slot('crest', add(HEAD, [-20, -16]), 200, crestArt()),
    scarf: scarf(),
    wingNearUpper: slot('wingNearUpper', shN, wingN.a1, wingUpper(false)),
    wingNearLower: slot('wingNearLower', wingN.j, wingN.a2, wingLower(false)),
    wingNearHand: slot('wingNearHand', gripN, 15, wingHand(false)),
  };
}

function rider() {
  const pz = pelicanParts();
  const dt = drivetrain();
  const bb = bikeBack();
  // soft ground shadow (sun low on the right → shadow stretches back-left)
  const shadow = g(`filter="url(#soft2L)"`, `<ellipse cx="-150" cy="4" rx="330" ry="10" fill="${C.ink2}" opacity="0.22"/>`, `<ellipse cx="-20" cy="2" rx="190" ry="6" fill="${C.ink1}" opacity="0.28"/>`) +
    g(`fill="${C.ink3}" filter="url(#inkL)" opacity="0.35"`, brush([[120, 3], [-100, 5], [-420, 6]], { w: 5, n: 60, dry: .8, k: 6, a: .05, b: .7, amin: .9, runout: .6 }));
  // motion: dry streaks trailing the rider, a few dust specks by the rear tyre
  let mo = '';
  const r = rng(808);
  for (const [x, y, L, w] of [[-250, -150, 120, 3], [-235, -78, 90, 2.4], [-300, -220, 70, 2], [-260, -360, 100, 2.4], [-215, -420, 60, 1.8]]) mo += brush([[x + L, y], [x + L * .5, y - 1], [x, y + 1]], { w, n: 30, dry: .9, k: 4, a: .05, b: .6, amin: .9, runout: .7 });
  const motion = g(`fill="${C.ink4}" filter="url(#inkL)" opacity="0.55"`, mo) +
    g(`fill="${C.ink4}" filter="url(#softL)" opacity="0.4"`, ...Array.from({ length: 6 }, () => `<circle cx="${f(-240 + r() * 60)}" cy="${f(-6 - r() * 14)}" r="${f(2 + r() * 4)}"/>`));
  // 烘托: a faint grey-warm wash around the white bird so the paper-white plumage reads
  const halo = g(`filter="url(#soft2L)" opacity="0.55"`,
    `<ellipse cx="60" cy="-430" rx="150" ry="120" fill="url(#gHalo)"/>`, `<ellipse cx="130" cy="-520" rx="70" ry="54" fill="url(#gHalo)"/>`);
  return `<g id="E-rider" transform="translate(680 790)">` + shadow + motion + halo + windScrolls() +
    pz.wingFarUpper + pz.wingFarLower + pz.wingFarHand +
    bb.fp + pz.footFar + pz.shankFar + pz.thighFar + bb.far +
    wheel(RH, 'r') + wheel(FH, 'f') + bikeFrame() + bikeFork() + bikeBars() + dt.cog + dt.chain + dt.chainring + dt.crankNear +
    pz.neck + pz.tail + pz.body +
    dt.pedal + pz.shankNear + pz.footNear + pz.thighNear +
    pz.pouch + pz.billLower + pz.billUpper + pz.head + pz.eye + pz.crest + pz.scarf +
    pz.wingNearUpper + pz.wingNearLower + pz.wingNearHand + `</g>`;
}

// ───────────────────────── inscription & seals ─────────────────────────
const FONT = openFont('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', 0);
function column(text, x, y, size, gap, seed, { skew = -0.04 } = {}) {
  const r = rng(seed);
  let d = '', yy = y;
  for (const ch of text) {
    if (ch === ' ') { yy += size * .5; continue; }
    const s = size * (0.94 + r() * 0.12);
    const gl = FONT.glyph(ch, s, x - s / 2 + (r() - .5) * size * .06, yy, { rot: (r() - .5) * 0.07, sx: 0.92 + r() * .08, skew });
    d += gl.d;
    yy += s + gap;
  }
  return { d, end: yy };
}
function seal(x, y, w, h, chars, { yin = true, size, seed = 1, rot: rr = 0 } = {}) {
  // yin (白文): white characters cut from a red block; yang (朱文): red characters in a red frame
  let s = '';
  const cx = x + w / 2, cy = y + h / 2;
  if (yin) {
    const n = chars.length;
    const gs = size || Math.min(w * .86, h / n * .92);
    let d = '';
    chars.split('').forEach((ch, i) => { d += FONT.glyph(ch, gs, cx - gs / 2, y + h * .06 + i * (h * .88 / n) + (h * .88 / n - gs) / 2, { sx: 1.08, sy: 1.02 }).d; });
    s += `<mask id="sealM${seed}" maskUnits="userSpaceOnUse" x="0" y="0" width="1600" height="900"><rect x="0" y="0" width="1600" height="900" fill="#fff"/><path d="${d}" fill="#000" stroke="#000" stroke-width="${f(gs * .035)}"/></mask>`;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2.5" fill="${C.verm}" mask="url(#sealM${seed})"/>`;
  } else {
    const n = chars.length;
    const gs = size || Math.min(w * .78, h / n * .82);
    let d = '';
    chars.split('').forEach((ch, i) => { d += FONT.glyph(ch, gs, cx - gs / 2, y + h * .09 + i * (h * .82 / n) + (h * .82 / n - gs) / 2).d; });
    s += `<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4}" rx="${f(w * .3)}" fill="none" stroke="${C.verm}" stroke-width="2.6"/>`;
    s += `<path d="${d}" fill="${C.verm}"/>`;
  }
  return `<g filter="url(#stamp)" transform="rotate(${rr} ${f(cx)} ${f(cy)})" opacity="0.93">${s}</g>`;
}
function inscription() {
  let s = '';
  const t1 = writeColumn(FONT, '鹈鹕湾', 196, 64, 80, 5, { seed: 3, wEm: 0.118, dry: .55 });
  s += `<g fill="${C.ink0}" filter="url(#inkW)">${t1.d}</g>`;
  const t2 = writeColumn(FONT, '晚风斜照载鱼归', 116, 88, 29, 4, { seed: 9, wEm: 0.09, dry: .2 });
  s += `<g fill="${C.ink1}" filter="url(#inkSW)">${t2.d}</g>`;
  const t3 = writeColumn(FONT, '丙午秋', 116, t2.end + 12, 20, 3, { seed: 12, wEm: 0.09, dry: 0 });
  s += `<g fill="${C.ink1}" filter="url(#inkSW)">${t3.d}</g>`;
  s += seal(95, t3.end + 8, 42, 70, '鹈鹕', { seed: 1, rot: -1.2 });
  s += seal(244, 60, 22, 42, '逍遥', { yin: false, seed: 2, rot: 1.5 });
  return s;
}
// ───────────────────────── gradients ─────────────────────────
function gradients() {
  return `
  <linearGradient id="gZenith" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.indigoL}" stop-opacity="0.3"/><stop offset="0.6" stop-color="${C.indigoL}" stop-opacity="0.08"/><stop offset="1" stop-color="${C.indigoL}" stop-opacity="0"/></linearGradient>
  <radialGradient id="gHorizonR" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${C.gold}" stop-opacity="0.6"/><stop offset="0.6" stop-color="${C.ochreL}" stop-opacity="0.18"/><stop offset="1" stop-color="${C.ochreL}" stop-opacity="0"/></radialGradient>
  <radialGradient id="gSunWash" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${C.gold}" stop-opacity="0.9"/><stop offset="0.35" stop-color="${C.vermL}" stop-opacity="0.3"/><stop offset="0.7" stop-color="${C.ochreL}" stop-opacity="0.12"/><stop offset="1" stop-color="${C.ochreL}" stop-opacity="0"/></radialGradient>
  <linearGradient id="gHorizon" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.ochreL}" stop-opacity="0"/><stop offset="0.8" stop-color="${C.gold}" stop-opacity="0.38"/><stop offset="1" stop-color="${C.vermL}" stop-opacity="0.2"/></linearGradient>
  <radialGradient id="gSun" cx="0.45" cy="0.42" r="0.6"><stop offset="0" stop-color="#E9673E"/><stop offset="0.7" stop-color="${C.verm}"/><stop offset="1" stop-color="#A92C1A"/></radialGradient>
  <radialGradient id="gSunHalo" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${C.gold}" stop-opacity="0.7"/><stop offset="0.45" stop-color="${C.gold}" stop-opacity="0.22"/><stop offset="1" stop-color="${C.gold}" stop-opacity="0"/></radialGradient>
  <linearGradient id="gSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.indigo}" stop-opacity="0.32"/><stop offset="0.3" stop-color="${C.indigoL}" stop-opacity="0.12"/><stop offset="0.7" stop-color="${C.indigoL}" stop-opacity="0.02"/><stop offset="1" stop-color="${C.indigoL}" stop-opacity="0.12"/></linearGradient>
  <linearGradient id="gSand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.ochreL}" stop-opacity="0.15"/><stop offset="0.5" stop-color="${C.ochreL}" stop-opacity="0.42"/><stop offset="1" stop-color="${C.ochre}" stop-opacity="0.22"/></linearGradient>
  <linearGradient id="gRoad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.ink3}" stop-opacity="0.2"/><stop offset="0.4" stop-color="${C.ink4}" stop-opacity="0.05"/><stop offset="1" stop-color="${C.ink3}" stop-opacity="0.2"/></linearGradient>
  <radialGradient id="gLamp" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#FFE3A0" stop-opacity="0.9"/><stop offset="0.4" stop-color="${C.gold}" stop-opacity="0.35"/><stop offset="1" stop-color="${C.gold}" stop-opacity="0"/></radialGradient>
  <linearGradient id="gBeam" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#FFE3A0" stop-opacity="0.7"/><stop offset="1" stop-color="#FFE3A0" stop-opacity="0"/></linearGradient>
  <radialGradient id="gHalo" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#8F8C8A" stop-opacity="0.34"/><stop offset="0.6" stop-color="#9A928A" stop-opacity="0.2"/><stop offset="1" stop-color="#9A928A" stop-opacity="0"/></radialGradient>
  <linearGradient id="gBill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#EE9A82"/><stop offset="0.6" stop-color="${C.bill}"/><stop offset="1" stop-color="#F0B08F"/></linearGradient>
  <linearGradient id="gPouch" x1="0" y1="0" x2="0.25" y2="1"><stop offset="0" stop-color="${C.pouch1}"/><stop offset="1" stop-color="${C.pouch2}"/></linearGradient>
  <radialGradient id="gVig" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#8A7458" stop-opacity="0"/><stop offset="1" stop-color="#8A7458" stop-opacity="0.2"/></radialGradient>`;
}

function windScrolls() {
  // one 云纹 wind scroll peeling off the scarf tails
  const pts = [];
  const x = -126, y = -452, len = 96, R = 13, turns = 1.3;
  for (let i = 0; i <= 14; i++) pts.push([x - len * i / 14, y + Math.sin(i / 14 * Math.PI) * 4]);
  const cx = x - len, cy = y - R;
  for (let i = 1; i <= 30; i++) { const t = i / 30, a = Math.PI / 2 + t * turns * 2 * Math.PI, rr = R * (1 - .75 * t); pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); }
  const pts2 = [];
  for (let i = 0; i <= 10; i++) pts2.push([-150 - 60 * i / 10, -426 + Math.sin(i / 10 * Math.PI) * 3]);
  return g(`fill="${C.ink3}" filter="url(#inkL)" opacity="0.55"`,
    brush(pts, { w: 3, n: 70, dry: .45, k: 4, a: .05, b: .3, amin: .9, runout: .35 }),
    brush(pts2, { w: 2, n: 20, dry: .7, k: 3, a: .1, b: .5, amin: .6, runout: .5 }));
}
function silk(C0, { n = 10, len = 14, spread = 8, seed = 1, w = .8, op = .35, ang = 0 } = {}) {
  // 丝毛 hairline feather strokes following a guide curve
  const r = rng(seed); const pts = resample(C0, n); const N = normals(pts);
  let s = '';
  pts.forEach((p, i) => {
    const q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
    let tx = q[0] - o[0], ty = q[1] - o[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const [cx, cy] = rot([tx, ty], ang);
    const off = (r() - .5) * spread, L = len * (.6 + r() * .6);
    const a = [p[0] + N[i][0] * off, p[1] + N[i][1] * off];
    s += brush([a, [a[0] + cx * L * .5 + N[i][0] * 1, a[1] + cy * L * .5 + N[i][1] * 1], [a[0] + cx * L, a[1] + cy * L]], { w: w * (.7 + r() * .6), n: 8, a: .2, b: .6, amin: .4, op: op * (.6 + r() * .6) });
  });
  return s;
}

// ───────────────────────── assemble ─────────────────────────
function svg(viewBox) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="1600" height="900">
<title>Pelican Bay 鹈鹕湾 — ink wash</title>
<defs>${gradients()}${filters()}</defs>
<g id="L-sky">${sky()}</g>
<g id="L-sunmoon">${sun()}</g>
<g id="L-hills-far">${mountains()}</g>
<g id="L-sea">${sea()}${islets()}</g>
<g id="L-lighthouse">${headland()}</g>
<g id="L-boats">${boats()}</g>
<g id="L-shore">${shore()}</g>
<g id="L-roadside">${roadside()}</g>
<g id="L-road">${road()}</g>
${rider()}
<g id="L-foreground">${foreground()}</g>
<g id="L-inscription">${inscription()}</g>
<g id="L-paper" style="mix-blend-mode:multiply" pointer-events="none"><rect width="1600" height="900" filter="url(#paperTex)" opacity="0.4"/><rect width="1600" height="900" fill="url(#gVig)"/></g>
</svg>`;
}
// capture everything drawn once; both files share the same art (seeds are consumed once)
const full = svg('0 0 1600 900');
fs.writeFileSync(HERE + 'keyframe.svg', full);
fs.writeFileSync(HERE + 'closeup.svg', full.replace('viewBox="0 0 1600 900" width="1600" height="900"', 'viewBox="440 220 560 580" width="1120" height="1160"'));
console.log('bytes', full.length);
