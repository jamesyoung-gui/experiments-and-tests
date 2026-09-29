// Pelican Bay · style D "anime warm-light scenery" keyframe generator.
// node gen.mjs  -> keyframe.svg + closeup.svg (self-contained, no filters, no rasters)
// Rider parts are drawn in joint-local coordinates and placed with the real rig (src/rig/solve.js),
// so every slot here maps 1:1 onto a SLOTS entry and can be lifted straight into the art modules.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { solvePose } from '../../src/rig/solve.js';
import { BIKE, SKEL, CHAIN_D } from '../../src/contract.js';
import { rng as mkRng, mixHex } from '../../src/core/math.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DETAIL = +(process.env.DETAIL ?? 1);          // scenery density knob (billow bumps); ~0.6 for a live build
const pose = solvePose(0.5, { crank: 0, distance: 0, cadence: 60, speed: 0, events: [] });
const J = pose.joints;

// ---------------------------------------------------------------- helpers
const n = v => (Math.abs(v) < 0.05 ? '0' : (Math.round(v * 10) / 10).toString());
const pt = (x, y) => `${n(x)},${n(y)}`;
const DEGR = Math.PI / 180;
const rotV = ([x, y], deg) => { const c = Math.cos(deg * DEGR), s = Math.sin(deg * DEGR); return [x * c - y * s, x * s + y * c]; };
const mix = (a, b, t) => mixHex(a, b, Math.max(0, Math.min(1, t)));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const defs = [];
let uid = 0;
const nid = p => `pb${p}${uid++}`;

// translate every absolute coordinate pair of a path made of M L C Q Z commands
function shiftD(d, dx, dy) {
  return d.replace(/([MLCQ])([^MLCQZ]*)/g, (m, cmd, args) => {
    const v = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    const o = [];
    for (let i = 0; i < v.length; i += 2) o.push(pt(v[i] + dx, v[i + 1] + dy));
    return cmd + o.join(' ') + ' ';
  });
}
// smooth closed / open curve through points (Catmull-Rom -> cubic Bezier)
function smooth(P, closed = true, k = 1) {
  const N = P.length; if (N < 2) return '';
  const g = i => closed ? P[(i + N) % N] : P[clamp(i, 0, N - 1)];
  let d = `M${pt(...P[0])}`;
  const segs = closed ? N : N - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6 * k, p1[1] + (p2[1] - p0[1]) / 6 * k];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6 * k, p2[1] - (p3[1] - p1[1]) / 6 * k];
    d += ` C${pt(...c1)} ${pt(...c2)} ${pt(...p2)}`;
  }
  return d + (closed ? ' Z' : '');
}
const xf = j => `translate(${n(j.x)} ${n(j.y)}) rotate(${n(j.rot)})` + (j.sx != null || j.sy != null ? ` scale(${n(j.sx ?? 1)} ${n(j.sy ?? 1)})` : '');
const slot = (name, body) => `<g id="j-${name}" transform="${xf(J[name])}">${body}</g>`;

// ---------------------------------------------------------------- palette (golden hour, graded)
const C = {
  line: '#3a2522', lineSoft: '#6d4a45', lineFar: '#3a2733',
  // plumage (warm-lit white) — cel tones
  plLit: '#fff7ea', pl: '#f5e7dc', plShade: '#c7bad0', plDeep: '#a497b5', plRim: '#ffc672',
  plFar: '#c9b8c4', plFarShade: '#9d8fa9',
  prim: '#1f1b24', primSheen: '#4a4556', primRim: '#b0735a', primFar: '#141119',
  bill: '#f4a68a', billShade: '#d9705a', billLit: '#ffd0b0', nail: '#e0503a', billEdge: '#b8563f',
  pouch: '#f9c74f', pouch2: '#f4a340', pouchShade: '#d9822c', pouchLit: '#ffe596',
  skin: '#f7c1b5', skinLit: '#ffdcc6', iris: '#8b1e1e', pupil: '#1c0d10',
  foot: '#f08a3c', footShade: '#c4602a', footLit: '#ffb467', web: '#f5a05a', claw: '#5a3a2a',
  footFar: '#b8652f', footFarShade: '#8f4a26', webFar: '#bd7446',
  scarf: '#d6453c', scarfShade: '#a02f35', scarfLit: '#ff7c5c', scarfStripe: '#f6e6c8', scarfStripeShade: '#cdb9a6',
  // bike
  frame: '#1f8a8a', frameShade: '#12605f', frameLit: '#5cc0b2', frameRim: '#ffd79a', frameFar: '#16605f',
  cream: '#f3e9d2', creamShade: '#c7b89f', creamLit: '#fffaf0',
  saddle: '#7a4a2a', saddleShade: '#52301d', saddleLit: '#b27842',
  basket: '#c89b5e', basketShade: '#8a6234', basketLit: '#ecc583', basketDark: '#6d4a26',
  chrome: '#d6dbe0', chromeShade: '#8b929c', chromeDark: '#555b66', chromeLit: '#ffffff', chromeWarm: '#ffe2b8',
  tyre: '#2b2629', tyreLit: '#5a4c4c', gum: '#c7a172', gumShade: '#9c7a52', spoke: '#d9d4cc',
  chain: '#4b4852', rubber: '#3b3439',
  fish: '#9fb6c9', fishBack: '#4f6f8f', fishBelly: '#f1ede6', fishPink: '#e7b3b0',
};
const LIGHT = [0.85, -0.53];                      // unit vector toward the low sun (world / rider space)
const toLocal = (v, rot) => rotV(v, -rot);

// cel-shaded shape: base fill, shade crescent (away from light), rim crescent (toward light), outline
function cel(d, o) {
  const rot = o.rot || 0;
  const L = toLocal(LIGHT, rot);
  const sh = o.sh ?? 9, rimW = o.rimW ?? 3;
  const id = nid('c');
  defs.push(`<clipPath id="${id}"><path d="${d}"/></clipPath>`);
  let s = `<path d="${d}" fill="${o.base}"/>`;
  s += `<g clip-path="url(#${id})">`;
  if (o.shade) s += `<path d="${d} ${shiftD(d, L[0] * sh, L[1] * sh)}" fill-rule="evenodd" fill="${o.shade}"/>`;
  if (o.deep) s += `<path d="${d} ${shiftD(d, L[0] * sh * 2.1, L[1] * sh * 2.1)}" fill-rule="evenodd" fill="${o.deep}" opacity="${o.deepA ?? 0.55}"/>`;
  if (o.inner) s += o.inner;
  if (o.rim) s += `<path d="${d} ${shiftD(d, -L[0] * rimW, -L[1] * rimW)}" fill-rule="evenodd" fill="${o.rim}"/>`;
  if (o.over) s += o.over;
  s += `</g>`;
  if (o.lw !== 0) s += `<path d="${o.outline || d}" fill="none" stroke="${o.line || C.line}" stroke-width="${o.lw ?? 2.4}" stroke-linejoin="round" stroke-linecap="round"/>`;
  return s;
}
const line = (d, c = C.line, w = 1.4, extra = '') => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;

// Band-mass: a union of circles painted in cel bands that follow the sun-facing silhouette.
// bands = [[colour, shiftAwayFromLight], ...] brightest first; each darker band is the same circle set
// pushed away from the light, so the bright bands hug the lit edge of every billow (clouds, foliage).
function bandMass(circ, bands, L, o = {}) {
  const cid = nid('bm'), gid = nid('bg');
  const cs = circ.map(c => `<circle cx="${n(c.x)}" cy="${n(c.y)}" r="${n(c.r)}"/>`).join('');
  defs.push(`<clipPath id="${cid}">${cs}</clipPath><g id="${gid}">${cs}</g>`);
  let s = `<g clip-path="url(#${cid})">`;
  bands.forEach(([col, sh, op]) => {
    s += `<use href="#${gid}" fill="${col}"${op != null ? ` opacity="${op}"` : ''}${sh ? ` transform="translate(${n(-L[0] * sh)} ${n(-L[1] * sh)})"` : ''}/>`;
  });
  if (o.over) s += o.over;
  s += `</g>`;
  if (o.outline) s += `<use href="#${gid}" fill="none" stroke="${o.outline}" stroke-width="${o.ow ?? 1.2}" opacity="${o.oa ?? 1}"/>`;
  return s;
}

// ---------------------------------------------------------------- SKY
function sky() {
  const g = nid('sky');
  defs.push(`<linearGradient id="${g}" x1="0" y1="0" x2="0" y2="480" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#2553a2"/><stop offset=".22" stop-color="#3a70bd"/><stop offset=".44" stop-color="#6c9ed4"/>
    <stop offset=".62" stop-color="#a8c5dd"/><stop offset=".76" stop-color="#e2dcc9"/><stop offset=".88" stop-color="#fbd6a1"/>
    <stop offset="1" stop-color="#ffc07e"/></linearGradient>`);
  const sg = nid('sun');
  defs.push(`<radialGradient id="${sg}" cx="1451" cy="330" r="720" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fff6d6" stop-opacity="1"/><stop offset=".07" stop-color="#ffe7a8" stop-opacity=".9"/>
    <stop offset=".22" stop-color="#ffcf8a" stop-opacity=".55"/><stop offset=".5" stop-color="#ffbf86" stop-opacity=".2"/>
    <stop offset="1" stop-color="#ffb080" stop-opacity="0"/></radialGradient>`);
  const tg = nid('tl');
  defs.push(`<radialGradient id="${tg}" cx="120" cy="-80" r="700" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#1b3f86" stop-opacity=".55"/><stop offset="1" stop-color="#1b3f86" stop-opacity="0"/></radialGradient>`);
  let s = `<rect x="-400" y="-400" width="2400" height="880" fill="url(#${g})"/>`;
  s += `<rect x="-400" y="-400" width="2400" height="880" fill="url(#${tg})"/>`;
  s += `<rect x="-400" y="-400" width="2400" height="880" fill="url(#${sg})"/>`;
  // high cirrus streaks catching the light
  const R = mkRng('cirrus');
  let cir = '';
  for (let i = 0; i < 11; i++) {
    const y = 60 + R() * 170, x = 700 + R() * 900, w = 120 + R() * 260, th = 2.5 + R() * 5, b = (R() - 0.5) * 18;
    const near = Math.hypot(x + w / 2 - 1451, y - 330) < 420;
    const col = near ? '#ffe7b4' : (R() < 0.5 ? '#fff2e2' : '#fbe0d2');
    cir += `<path d="M${pt(x, y)} Q${pt(x + w * 0.5, y - th + b)} ${pt(x + w, y + b * 0.4)} Q${pt(x + w * 0.55, y + th * 0.4 + b)} ${pt(x, y)} Z" fill="${col}" opacity="${n(0.3 + R() * 0.3)}"/>`;
  }
  s += cir;
  return s;
}
function sun() {
  const g = nid('sd');
  defs.push(`<radialGradient id="${g}"><stop offset="0" stop-color="#fffef6"/><stop offset=".55" stop-color="#fff6d8"/><stop offset=".8" stop-color="#ffe9a8" stop-opacity=".9"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>`);
  let s = `<circle cx="1451" cy="330" r="62" fill="url(#${g})"/>`;
  s += `<circle cx="1451" cy="330" r="27" fill="#fffdf2"/>`;
  return s;
}

// A billow: roughly round union of circles with small bumps on its sun-facing 3/4.
function cluster(cl, R) {
  const C0 = [];
  const { cx, cy, a, b } = cl;
  const bump = cl.bump ?? 0.3;
  C0.push({ x: cx, y: cy + b * 0.08, r: Math.min(a, b) * 0.86 });
  if (a > b * 1.15) { C0.push({ x: cx - (a - b) * 0.6, y: cy + b * 0.1, r: b * 0.84 }); C0.push({ x: cx + (a - b) * 0.6, y: cy + b * 0.1, r: b * 0.84 }); }
  const nb = cl.nb ?? Math.round((5 + 3.4 / bump) * DETAIL);
  for (let i = 0; i < nb; i++) {
    const t = Math.PI * (0.92 + (1.16 * (i + 0.5)) / nb) + (R() - 0.5) * 0.12;
    const br = Math.min(a, b) * bump * (0.7 + R() * 0.6);
    const x = cx + Math.cos(t) * (a - br * 0.9), y = cy + Math.sin(t) * (b - br * 0.9);
    C0.push({ x, y, r: br });
  }
  return C0;
}
// billow mass: rows of round billows inside an envelope; drawn top->bottom, sun side last-covered
function billowMass(o) {
  const R = mkRng(o.seed);
  const L = o.L || [0.9, -0.44];
  const rows = o.rows ?? 6;
  const bl = [];
  for (let k = 0; k < rows; k++) {
    const f = rows === 1 ? 1 : k / (rows - 1);         // 0 top .. 1 bottom
    const hw = (o.w / 2) * (o.topW ?? 0.3) + (o.w / 2) * (1 - (o.topW ?? 0.3)) * Math.pow(f, o.exp ?? 0.8);
    const r0 = lerp(o.rTop, o.rBot, f);
    const y = o.base - o.h + r0 * 0.9 + f * (o.h - r0 * 1.6);
    const cnt = Math.max(1, Math.round((2 * hw) / (r0 * (o.spacing ?? 1.3))));
    const cxk = o.cx + (o.lean || 0) * (1 - f) * o.w;
    for (let i = 0; i < cnt; i++) {
      const u = cnt === 1 ? 0.5 : i / (cnt - 1);
      const r = r0 * (0.62 + R() * 0.5) * (0.8 + 0.45 * Math.sin(u * Math.PI));
      const x = cxk + (u - 0.5) * 2 * (hw - r0 * 0.5) + (R() - 0.5) * r0 * 0.5;
      const yy = y + (R() - 0.5) * r0 * 0.5 - Math.sin(u * Math.PI) * r0 * (o.dome ?? 0.3);
      bl.push({ cx: x, cy: yy, a: r * (1 + R() * 0.3) * (o.squash ?? 1), b: r * (0.86 + R() * 0.14), f, u, bump: o.bump });
    }
  }
  // crown billows
  for (let i = 0; i < (o.crown ?? 0); i++) {
    const r = o.rTop * (0.7 + R() * 0.4);
    bl.push({ cx: o.cx + (o.lean || 0) * o.w + (R() - 0.5) * o.w * 0.18, cy: o.base - o.h + r * 0.4 + R() * 12, a: r, b: r * 0.9, f: 0, u: 0.5, bump: o.bump });
  }
  bl.sort((p, q) => (p.cy - q.cy) + (o.lx ?? 0.35) * (q.cx - p.cx) * Math.sign(L[0]));
  const P = o.pal;
  const sh = o.shifts || [0, 2.4, 0.2, 0.46, 0.8, 1.25];
  const minX = o.cx - o.w / 2, maxX = o.cx + o.w / 2;
  let s = '';
  for (const c of bl) {
    const hx = clamp((c.cx - minX) / (maxX - minX), 0, 1);
    const k = clamp(1 - c.f * (o.vert ?? 0.6) + (hx - 0.5) * (o.horiz ?? 0.4) * Math.sign(L[0]) + (R() - 0.5) * 0.1, 0, 1);
    const r = Math.min(c.a, c.b);
    const con = clamp((o.con0 ?? 0.3) + (1 - (o.con0 ?? 0.3)) * Math.pow(k, 1.2), 0, 1);   // contrast of this billow
    const calm = mix(P.shade, P.mid, 0.4 + 0.4 * k);
    const T = (c1) => mix(calm, c1, con);
    const stops = [
      [sh[0], T(mix(P.lit, P.hi, k))], [sh[1], T(mix(P.lit2, P.lit, k))],
      [r * sh[2], T(mix(P.lit2, P.lit, k * 0.8))], [r * sh[3], T(mix(P.mid, P.lit2, k * 0.8))],
      [r * sh[4], T(mix(P.shade, P.mid, k * 0.7))], [r * sh[5], mix(P.deep, P.shade, k * 0.6)],
    ];
    const bands = [];
    const soft = o.soft ?? 2;
    stops.forEach(([d, col], i) => {
      if (i < 2) { bands.push([col, d]); return; }
      const [pd, pc] = stops[i - 1];
      for (let q = 1; q <= soft; q++) bands.push([mix(pc, col, q / soft), lerp(pd, d, q / soft)]);
    });
    s += bandMass(cluster(c, R), bands, L);
    if (o.out) o.out.push({ ...c, k });
  }
  if (o.flat) {
    const clip = nid('cf');
    defs.push(`<clipPath id="${clip}"><rect x="-400" y="-400" width="2400" height="${n(o.base + 400)}"/></clipPath>`);
    s = `<g clip-path="url(#${clip})">${s}</g>`;
  }
  return s;
}
const CL_FRONT = { hi: '#fffaf0', lit: '#fff0c8', lit2: '#fcdcb8', mid: '#e2c6cc', shade: '#b4b2d6', deep: '#979dca', deep2: '#838bbf' };
const CL_BACK = { hi: '#fffbe0', lit: '#ffe39e', lit2: '#f7c696', mid: '#d9acae', shade: '#b8a0bc', deep: '#9c90b8', deep2: '#8a82b0' };
const CL_FAR = { hi: '#fff4e2', lit: '#ffe8d0', lit2: '#f8d8c6', mid: '#ecd0cc', shade: '#d8c2cc', deep: '#c6b6ca', deep2: '#baaccb' };

function clouds() {
  let s = '';
  // low far banks on the horizon
  s += billowMass({ seed: 'bank1', cx: 700, base: 472, w: 700, h: 46, rows: 2, rTop: 14, rBot: 18, topW: .6, pal: CL_FAR, vert: .3, flat: true, dome: .1 });
  s += billowMass({ seed: 'bank2', cx: 1500, base: 472, w: 520, h: 56, rows: 2, rTop: 16, rBot: 22, topW: .5, pal: CL_BACK, L: [1, 0.08], vert: .2, flat: true, dome: .1 });
  // the great tower (left), lit from the right by the low sun
  s += billowMass({ seed: 'towerA', cx: 300, base: 470, w: 700, h: 440, rows: 7, rTop: 46, rBot: 78, spacing: 1.4, topW: .28, exp: .75, lean: .05, crown: 3, pal: CL_FRONT, L: [0.92, -0.38], vert: .55, horiz: .5, flat: true, dome: .35 });
  // backlit tower right of centre (sun on its right)
  s += billowMass({ seed: 'towerB', cx: 1140, base: 444, w: 420, h: 270, rows: 5, rTop: 34, rBot: 56, spacing: 1.4, topW: .3, lean: .05, crown: 2, pal: CL_BACK, L: [0.98, -0.18], vert: .45, horiz: .7, flat: true, shifts: [0, 2.4, 0.12, 0.3, 0.6, 1.1], con0: .45 });
  // drifting puffs higher up
  s += billowMass({ seed: 'puffC', cx: 690, base: 150, w: 190, h: 64, rows: 2, rTop: 22, rBot: 26, topW: .5, pal: CL_FRONT, L: [0.92, -0.38], vert: .4, flat: true });
  s += billowMass({ seed: 'puffD', cx: 1490, base: 212, w: 240, h: 56, rows: 2, rTop: 18, rBot: 22, topW: .55, pal: CL_BACK, L: [0.5, 0.86], vert: -.2, flat: true });
  s += billowMass({ seed: 'puffE', cx: 960, base: 70, w: 120, h: 36, rows: 1, rTop: 16, rBot: 18, topW: .6, pal: CL_FRONT, L: [0.92, -0.38], vert: .2, flat: true });
  s += billowMass({ seed: 'puffF', cx: 1270, base: 58, w: 170, h: 40, rows: 2, rTop: 14, rBot: 17, topW: .6, pal: CL_FRONT, L: [0.92, -0.38], vert: .3, flat: true });
  return s;
}

// ---------------------------------------------------------------- FAR: headlands, town, lighthouse, sea
function farHills() {
  let s = '';
  // far ridge (very hazy)
  s += `<path d="${smooth([[-60, 470], [-60, 380], [60, 356], [150, 360], [260, 392], [360, 430], [470, 470]], false)} Z" fill="#9fb1c8"/>`;
  // headland with the little town
  const hd = smooth([[-60, 474], [-60, 392], [30, 380], [110, 384], [190, 400], [270, 420], [350, 440], [420, 458], [470, 468], [520, 474]], false) + ' Z';
  const hg = nid('hl');
  defs.push(`<linearGradient id="${hg}" x1="0" y1="380" x2="0" y2="474" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#7e9f98"/><stop offset="1" stop-color="#8ea6b8"/></linearGradient>`);
  s += `<path d="${hd}" fill="url(#${hg})"/>`;
  s += `<path d="${smooth([[-60, 392], [30, 380], [110, 384], [190, 400], [270, 420], [350, 440], [420, 458], [470, 468]], false)}" fill="none" stroke="#e7dcb4" stroke-width="3" opacity=".8"/>`;
  // town houses on the slope
  const R = mkRng('town');
  const slopeY = x => 384 + Math.max(0, (x - 60)) * 0.19 + (x > 300 ? (x - 300) * 0.08 : 0);
  let houses = '';
  for (let i = 0; i < 34; i++) {
    const x = 40 + R() * 330, gy = slopeY(x) + 6 + R() * 26;
    if (gy > 468) continue;
    const w = 7 + R() * 9, hh = 5 + R() * 6;
    const roof = ['#c7654b', '#b95a48', '#4f8a8e', '#d98457', '#8a5a6a'][Math.floor(R() * 5)];
    houses += `<rect x="${n(x)}" y="${n(gy - hh)}" width="${n(w)}" height="${n(hh)}" fill="#efe2cf"/><rect x="${n(x)}" y="${n(gy - hh)}" width="${n(w * 0.3)}" height="${n(hh)}" fill="#b6b0c3"/>`;
    houses += `<path d="M${pt(x - 1.2, gy - hh)} L${pt(x + w * 0.45, gy - hh - 4 - R() * 2)} L${pt(x + w + 1.2, gy - hh)} Z" fill="${roof}"/>`;
    if (R() < 0.5) houses += `<rect x="${n(x + w * 0.55)}" y="${n(gy - hh * 0.6)}" width="1.6" height="1.8" fill="#6b6f8f"/>`;
  }
  // trees dotting the town
  for (let i = 0; i < 40; i++) {
    const x = 0 + R() * 420, gy = slopeY(x) + R() * 34;
    if (gy > 470) continue;
    const r = 3 + R() * 5;
    houses += `<ellipse cx="${n(x)}" cy="${n(gy - r * 0.6)}" rx="${n(r * 1.2)}" ry="${n(r)}" fill="${R() < .5 ? '#5f8778' : '#6d9380'}"/><ellipse cx="${n(x + r * .3)}" cy="${n(gy - r)}" rx="${n(r * .7)}" ry="${n(r * .45)}" fill="#a9b98e" opacity=".8"/>`;
  }
  s += houses;
  // haze over the headland
  const hz = nid('hz');
  defs.push(`<linearGradient id="${hz}" x1="0" y1="370" x2="0" y2="474" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#e9d8c8" stop-opacity=".05"/><stop offset="1" stop-color="#f3dcc2" stop-opacity=".55"/></linearGradient>`);
  s += `<path d="${hd}" fill="url(#${hz})"/>`;
  // far cape (right) + lighthouse promontory
  s += `<path d="M1280,471 C1360,462 1450,458 1540,462 C1600,464 1660,466 2000,468 L2000,472 Z" fill="#b7b0c8" opacity=".85"/>`;
  const pr = 'M1060,472 C1090,462 1120,452 1150,446 C1180,440 1205,436 1240,434 C1275,433 1300,437 1325,445 C1348,452 1368,462 1392,472 Z';
  s += `<path d="${pr}" fill="#7f8aa6"/>`;
  s += `<path d="M1150,446 C1180,440 1205,436 1240,434 C1275,433 1300,437 1325,445 C1310,447 1290,444 1270,445 C1240,447 1200,450 1150,452 Z" fill="#96a58a"/>`;
  s += `<path d="M1240,434 C1275,433 1300,437 1325,445 C1348,452 1368,462 1392,472 L1370,472 C1350,462 1330,452 1310,446 Z" fill="#e6b88c" opacity=".75"/>`;
  s += lighthouse(1150, 446);
  // tiny poles + pines along the headland road
  let hp = '';
  const road = x => 392 + (x + 20) * 0.16;
  hp += `<path d="M-20,392 L430,466" stroke="#c8bfae" stroke-width="1.4" opacity=".8"/>`;
  for (let i = 0; i < 6; i++) {
    const x = 10 + i * 70, y = road(x) - 2;
    hp += `<rect x="${x}" y="${n(y - 22)}" width="1.4" height="22" fill="#5a5a6e"/><rect x="${x - 3}" y="${n(y - 21)}" width="7.4" height="1" fill="#5a5a6e"/>`;
    if (i < 5) hp += `<path d="M${x + .7},${n(y - 21)} Q${x + 35},${n(y - 14 + 5.6)} ${x + 70.7},${n(road(x + 70) - 23)}" stroke="#5a5a6e" stroke-width=".6" fill="none" opacity=".8"/>`;
  }
  for (const [x, y, k] of [[48, 386, 1], [64, 384, .8], [216, 404, 1.1], [300, 420, .9], [1270, 436, .9], [1300, 440, .7]]) {
    hp += `<path d="M${x},${y} l0,-${n(14 * k)}" stroke="#4a4050" stroke-width="1.4"/><ellipse cx="${x}" cy="${n(y - 16 * k)}" rx="${n(9 * k)}" ry="${n(3.4 * k)}" fill="#4d6f68"/><ellipse cx="${x + 2}" cy="${n(y - 22 * k)}" rx="${n(6 * k)}" ry="${n(2.8 * k)}" fill="#5d8274"/><ellipse cx="${x + 3}" cy="${n(y - 23 * k)}" rx="${n(3 * k)}" ry="${n(1.2 * k)}" fill="#b9c28a"/>`;
  }
  s += hp;
  return s;
}
function lighthouse(x, y) {
  const H = 92, wb = 11, wt = 7.5;
  let s = '';
  // keeper's cottage
  s += `<rect x="${x + 16}" y="${y - 12}" width="22" height="12" fill="#efe0cc"/><rect x="${x + 16}" y="${y - 12}" width="7" height="12" fill="#b9b1c6"/><path d="M${x + 14},${y - 12} L${x + 27},${y - 20} L${x + 40},${y - 12} Z" fill="#b8574a"/>`;
  const body = `M${x - wb},${y} L${x - wt},${y - H} L${x + wt},${y - H} L${x + wb},${y} Z`;
  const lg = nid('lh');
  defs.push(`<linearGradient id="${lg}" x1="${x - wb}" x2="${x + wb}" y1="0" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#b9b3c8"/><stop offset=".45" stop-color="#e9e2dc"/><stop offset=".8" stop-color="#fff3de"/><stop offset="1" stop-color="#ffd9a0"/></linearGradient>`);
  s += `<path d="${body}" fill="url(#${lg})"/>`;
  const band = (y0, y1) => {
    const f0 = (y - y0) / H, f1 = (y - y1) / H;
    const a0 = wb + (wt - wb) * f0, a1 = wb + (wt - wb) * f1;
    return `<path d="M${n(x - a0)},${n(y0)} L${n(x - a1)},${n(y1)} L${n(x + a1)},${n(y1)} L${n(x + a0)},${n(y0)} Z" fill="#c8453c"/><path d="M${n(x - a0)},${n(y0)} L${n(x - a1)},${n(y1)} L${n(x - a1 * 0.3)},${n(y1)} L${n(x - a0 * 0.3)},${n(y0)} Z" fill="#8f3040" opacity=".6"/>`;
  };
  s += band(y - 22, y - 36) + band(y - 58, y - 72);
  // gallery + lantern
  s += `<rect x="${x - 11}" y="${y - H - 3}" width="22" height="3.5" fill="#3d3440"/>`;
  s += `<rect x="${x - 6}" y="${y - H - 15}" width="12" height="12" fill="#ffe7a6"/><rect x="${x - 6}" y="${y - H - 15}" width="4" height="12" fill="#e7b870"/>`;
  s += `<path d="M${x - 8},${y - H - 15} Q${x},${y - H - 27} ${x + 8},${y - H - 15} Z" fill="#b8453c"/><rect x="${x - 0.7}" y="${y - H - 31}" width="1.4" height="6" fill="#3d3440"/>`;
  // lantern glint
  const gg = nid('lg');
  defs.push(`<radialGradient id="${gg}"><stop offset="0" stop-color="#fff6d0" stop-opacity=".9"/><stop offset="1" stop-color="#ffd890" stop-opacity="0"/></radialGradient>`);
  s += `<circle cx="${x}" cy="${y - H - 9}" r="16" fill="url(#${gg})"/>`;
  return s;
}
function sailboat(x, y, sc = 1, lit = true) {
  const t = (a, b) => pt(x + a * sc, y + b * sc);
  let s = `<g>`;
  s += `<path d="M${t(-16, 0)} L${t(18, 0)} L${t(13, 6)} L${t(-12, 6)} Z" fill="#6a4a4a"/><path d="M${t(-16, 0)} L${t(18, 0)} L${t(17, 2)} L${t(-15, 2)} Z" fill="#f2e8dc"/>`;
  s += `<path d="M${t(1, -1)} L${t(1, -44)}" stroke="#4a3a3a" stroke-width="${n(1 * sc)}"/>`;
  s += `<path d="M${t(2, -43)} Q${t(14, -24)} ${t(16, -3)} L${t(2, -3)} Z" fill="${lit ? '#fff3dc' : '#e8e0e8'}"/><path d="M${t(10, -24)} Q${t(14, -14)} ${t(16, -3)} L${t(12, -3)} Z" fill="#ffd79a" opacity=".8"/>`;
  s += `<path d="M${t(0, -40)} Q${t(-9, -22)} ${t(-12, -4)} L${t(0, -4)} Z" fill="#dcd0dc"/>`;
  s += `<path d="M${t(-20, 8)} L${t(22, 8)}" stroke="#fff0d0" stroke-width="${n(1.2 * sc)}" opacity=".6"/>`;
  return s + `</g>`;
}
function sea() {
  let s = '';
  const g = nid('sea');
  defs.push(`<linearGradient id="${g}" x1="0" y1="466" x2="0" y2="680" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#a7aed0"/><stop offset=".08" stop-color="#8898c6"/><stop offset=".35" stop-color="#5a7cb2"/><stop offset=".7" stop-color="#3b6399"/><stop offset="1" stop-color="#2d5285"/></linearGradient>`);
  s += `<rect x="-400" y="466" width="2400" height="240" fill="url(#${g})"/>`;
  // sun reflection column
  const rg = nid('sr');
  defs.push(`<radialGradient id="${rg}" cx="1451" cy="470" r="300" gradientTransform="translate(1451 470) scale(.55 1) translate(-1451 -470)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffe6b0" stop-opacity=".8"/><stop offset=".5" stop-color="#ffd0a0" stop-opacity=".25"/><stop offset="1" stop-color="#ffd0a0" stop-opacity="0"/></radialGradient>`);
  s += `<rect x="1000" y="466" width="900" height="240" fill="url(#${rg})"/>`;
  // horizon glow line
  s += `<rect x="-400" y="466" width="2400" height="3" fill="#f2d8c0" opacity=".7"/>`;
  const R = mkRng('waves');
  let w = '';
  for (let i = 0; i < 260; i++) {
    const f = Math.pow(R(), 1.6);
    const y = 472 + f * 190;
    const x = -40 + R() * 1680;
    const len = 6 + f * 40 + R() * 16;
    const th = 0.7 + f * 1.8;
    const col = R() < 0.5 ? '#b9c8e6' : '#9fb4dc';
    w += `<path d="M${pt(x, y)} L${pt(x + len, y)}" stroke="${col}" stroke-width="${n(th)}" stroke-linecap="round" opacity="${n(0.35 + 0.3 * R())}"/>`;
  }
  // glitter under the sun (widening toward the viewer)
  for (let i = 0; i < 170; i++) {
    const f = Math.pow(R(), 1.3);
    const y = 470 + f * 180;
    const spread = 40 + f * 220;
    const x = 1451 + (R() - 0.5) * 2 * spread * (0.4 + R() * 0.6);
    const len = 3 + f * 26 * R() + 2;
    w += `<path d="M${pt(x - len / 2, y)} L${pt(x + len / 2, y)}" stroke="${R() < 0.4 ? '#ffffff' : '#ffe2a6'}" stroke-width="${n(0.8 + f * 1.6)}" stroke-linecap="round" opacity="${n(0.5 + 0.5 * R())}"/>`;
  }
  s += w;
  s += sailboat(1015, 498, 1.05);
  s += sailboat(342, 482, 0.55);
  s += sailboat(1392, 494, 0.7, true);
  return s;
}

// ---------------------------------------------------------------- MID: beach, verge, pine, pole, bus stop
function blobPath(cx, cy, rx, ry, R, bumps = 9, amp = 0.18, flatBottom = true) {
  const P = [];
  for (let i = 0; i < bumps; i++) {
    const a = (i / bumps) * Math.PI * 2 + R() * 0.2;
    let r = 1 + (R() - 0.5) * 2 * amp;
    let x = cx + Math.cos(a) * rx * r, y = cy + Math.sin(a) * ry * r;
    if (flatBottom && y > cy) y = cy + (y - cy) * 0.45;
    P.push([x, y]);
  }
  return smooth(P);
}
const FOL = { hi: '#eaf092', lit: '#b6d262', lit2: '#88b450', mid: '#5c9446', shade: '#3c6f40', deep: '#29543a', deep2: '#1e4234' };
const FOL_FG = { hi: '#d6e47e', lit: '#8ab250', lit2: '#609646', mid: '#3f703d', shade: '#2b5337', deep: '#1d3e30', deep2: '#142e25' };
// painted foliage: dome of round leafy clumps, each band-shaded from the sun side
function foliage(x, y, w, h, seed, o = {}) {
  const R = mkRng(seed + 'd');
  const pal = o.pal || FOL;
  let s = `<path d="${blobPath(x, y - h * 0.26, w * 0.4, h * 0.34, R, 12, 0.1)}" fill="${pal.deep2}"/>`;
  const r = o.r ?? clamp(h * 0.26, 10, 60);
  const out = [];
  s += billowMass({ out, seed, cx: x, base: y + r * 0.3, w, h: h + r * 0.3, rows: o.rows ?? Math.max(2, Math.round(h / (r * 1.1))), rTop: r * 0.8, rBot: r, topW: o.topW ?? 0.45, exp: 0.7,
    pal, L: o.L || [0.8, -0.6], vert: o.vert ?? 0.55, horiz: 0.35, bump: o.bump ?? 0.15, spacing: 1.2, dome: 0.4, shifts: [0, 2, 0.22, 0.5, 0.85, 1.3], lx: 0.5, soft: 2, con0: 0.45 });
  // leaf dabs: bright leaves catching the sun on each clump's lit edge, dark ones in the undersides
  const Lf = o.L || [0.8, -0.6];
  const la = Math.atan2(Lf[1], Lf[0]);
  let dabs = '';
  for (const c of out) {
    const rr = Math.min(c.a, c.b);
    const nd = Math.round(clamp(rr / 3.2, 3, 14));
    for (let i = 0; i < nd; i++) {
      const a = la + (R() - 0.5) * 2.4;
      const rad = rr * (0.62 + R() * 0.38);
      const px = c.cx + Math.cos(a) * rad, py = c.cy + Math.sin(a) * rad;
      const len = clamp(rr * 0.2, 3, 9) * (0.7 + R() * 0.6);
      const ang = a * 180 / Math.PI + (R() - 0.5) * 70;
      const col = R() < 0.55 ? pal.hi : pal.lit;
      dabs += `<path transform="translate(${n(px)} ${n(py)}) rotate(${n(ang)})" d="M0,0 Q${n(len * .5)},${n(-len * .32)} ${n(len)},0 Q${n(len * .5)},${n(len * .32)} 0,0 Z" fill="${col}" opacity="${n(0.55 + c.k * 0.45)}"/>`;
    }
    for (let i = 0; i < Math.round(nd * 0.5); i++) {
      const a = la + Math.PI + (R() - 0.5) * 2;
      const rad = rr * (0.7 + R() * 0.3);
      const px = c.cx + Math.cos(a) * rad, py = c.cy + Math.sin(a) * rad;
      const len = clamp(rr * 0.22, 3, 10) * (0.7 + R() * 0.6);
      dabs += `<path transform="translate(${n(px)} ${n(py)}) rotate(${n(a * 180 / Math.PI + (R() - 0.5) * 60)})" d="M0,0 Q${n(len * .5)},${n(-len * .3)} ${n(len)},0 Q${n(len * .5)},${n(len * .3)} 0,0 Z" fill="${pal.deep}" opacity=".8"/>`;
    }
  }
  s += dabs;
  if (o.flowers) s += flowers(x, y, w, h, R, o.flowers);
  return s;
}
function flowers(x, y, w, h, R, f) {
  let s = '';
  for (let i = 0; i < f.n; i++) {
    const cx = x + (R() - 0.5) * w * 0.85, cy = y - h * 0.15 - R() * h * 0.7;
    const col = f.c[Math.floor(R() * f.c.length)];
    const r = f.r * (0.7 + R() * 0.6);
    if (f.kind === 'hyd') {
      // hydrangea head: florets with a lit crown
      s += `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(r)}" ry="${n(r * 0.86)}" fill="${col[2]}"/>`;
      for (let k = 0; k < 11; k++) {
        const a = k * 2.4, rr = r * 0.62 * Math.sqrt((k + 0.5) / 11);
        const fx = cx + Math.cos(a) * rr, fy = cy + Math.sin(a) * rr * 0.8 - r * 0.08;
        const lit = (fx - cx) * 0.8 - (fy - cy) > -r * 0.1;
        const fr = r * 0.3;
        s += `<path d="M${pt(fx - fr, fy)} Q${pt(fx, fy - fr * 0.25)} ${pt(fx, fy - fr)} Q${pt(fx, fy - fr * 0.25)} ${pt(fx + fr, fy)} Q${pt(fx, fy + fr * 0.25)} ${pt(fx, fy + fr)} Q${pt(fx, fy + fr * 0.25)} ${pt(fx - fr, fy)} Z" fill="${lit ? col[1] : col[0]}"/>`;
      }
    } else {
      s += `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${col[0]}"/><circle cx="${n(cx + r * .3)}" cy="${n(cy - r * .3)}" r="${n(r * .5)}" fill="${col[1]}"/>`;
      if (f.eye) s += `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * .35)}" fill="${f.eye}"/>`;
    }
  }
  return s;
}
function grassTuft(x, y, h, R, cols, n0 = 7, lean = -0.2) {
  let s = '';
  for (let i = 0; i < n0; i++) {
    const bx = x + (R() - 0.5) * 12, hh = h * (0.5 + R() * 0.6), l = lean * h + (R() - 0.5) * h * 0.5;
    const tip = [bx + l, y - hh];
    const w = 1.6 + R() * 1.8;
    s += `<path d="M${pt(bx - w, y)} Q${pt(bx + l * 0.3, y - hh * 0.55)} ${pt(...tip)} Q${pt(bx + l * 0.3 + w * .6, y - hh * 0.5)} ${pt(bx + w, y)} Z" fill="${cols[Math.floor(R() * cols.length)]}"/>`;
  }
  return s;
}
function beach() {
  let s = '';
  const sg = nid('sand');
  defs.push(`<linearGradient id="${sg}" x1="0" y1="620" x2="0" y2="700" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#d9b596"/><stop offset=".25" stop-color="#f0cfa2"/><stop offset="1" stop-color="#e2b988"/></linearGradient>`);
  s += `<path d="M-400,640 C0,628 400,634 800,626 C1100,620 1400,630 2000,624 L2000,720 L-400,720 Z" fill="url(#${sg})"/>`;
  // wet sand mirrors the sky
  s += `<path d="M-400,640 C0,628 400,634 800,626 C1100,620 1400,630 2000,624 L2000,636 C1400,642 1100,632 800,638 C400,646 0,640 -400,652 Z" fill="#c8b0b4" opacity=".9"/>`;
  s += `<path d="M1300,628 C1400,626 1500,628 1640,626 L1640,636 C1500,640 1400,638 1300,640 Z" fill="#ffe0a8" opacity=".8"/>`;
  s += `<path d="M-400,636 C0,624 400,630 800,622 C1100,616 1400,626 2000,620" stroke="#fbf6ec" stroke-width="3" fill="none" opacity=".95"/>`;
  s += `<path d="M-400,626 C-100,618 200,622 500,616 C800,611 1150,615 1500,612 C1700,610 1900,612 2000,612" stroke="#eef2f6" stroke-width="1.6" fill="none" opacity=".75" stroke-dasharray="120 30 60 20"/>`;
  s += `<path d="M-400,606 C0,601 500,604 900,600 C1300,596 1700,600 2000,598" stroke="#dfe7f2" stroke-width="1.2" fill="none" opacity=".5" stroke-dasharray="40 26"/>`;
  const R = mkRng('rocks');
  for (const [rx, ry, rw] of [[40, 646, 70], [1080, 638, 40], [1112, 644, 26], [860, 638, 24], [560, 640, 30]]) {
    const circ = [];
    for (let i = 0; i < 5; i++) circ.push({ x: rx + (i - 2) * rw * 0.16, y: ry - rw * 0.08 - Math.sin((i / 4) * Math.PI) * rw * 0.12, r: rw * (0.2 + R() * 0.08) });
    s += `<g>${bandMass(circ, [['#ffcf98', 0], ['#d69c7c', 2], ['#8e7688', rw * 0.12], ['#62587a', rw * 0.26]], [0.85, -0.53])}</g>`;
  }
  return s;
}
function signpost(x, y) {
  let s = '';
  // post
  s += cel(`M${x - 6},${y} L${x - 5},${y - 300} L${x + 5},${y - 300} L${x + 6},${y} Z`, { base: '#8a5e3e', shade: '#5e3c2c', rim: '#f2b777', sh: 5, rimW: 2.4, lw: 2 });
  for (let k = 0; k < 6; k++) s += line(`M${x - 3},${y - 40 - k * 44} l2,-18`, '#5e3c2c', 1);
  // arrow board pointing ahead (+x)
  const bx = x - 70, by = y - 318, bw = 190, bh = 52;
  const board = `M${bx},${by} L${bx + bw - 26},${by} L${bx + bw},${by + bh / 2} L${bx + bw - 26},${by + bh} L${bx},${by + bh} Z`;
  const grain = [10, 22, 34, 44].map(k => line(`M${bx + 4},${by + k} C${bx + 60},${by + k - 2} ${bx + 110},${by + k + 2} ${bx + bw - 30},${by + k}`, '#274f55', 1, 'opacity=".6"')).join('');
  s += cel(board, { base: '#2f6f73', shade: '#214e55', rim: '#ffd08a', sh: 5, rimW: 2.6, inner: grain, lw: 2.4 });
  s += `<path d="M${bx + 5},${by + 5} L${bx + bw - 28},${by + 5} L${bx + bw - 8},${by + bh / 2} L${bx + bw - 28},${by + bh - 5} L${bx + 5},${by + bh - 5} Z" fill="none" stroke="#f3e4c4" stroke-width="1.6" opacity=".9"/>`;
  s += `<text x="${bx + 74}" y="${by + 31}" text-anchor="middle" font-family="'WenQuanYi Zen Hei','Noto Sans CJK SC','PingFang SC','Microsoft YaHei',sans-serif" font-size="24" font-weight="700" fill="#fbf1dc" letter-spacing="3">鹈鹕湾</text>`;
  s += `<text x="${bx + 74}" y="${by + 44}" text-anchor="middle" font-family="'DejaVu Sans','Trebuchet MS',sans-serif" font-size="8.6" font-weight="700" fill="#ffd79a" letter-spacing="2.4">PELICAN BAY</text>`;
  s += `<text x="${bx + 158}" y="${by + 31}" text-anchor="middle" font-family="'DejaVu Sans',sans-serif" font-size="10" font-weight="700" fill="#fbf1dc">1 km</text>`;
  for (const [nx, ny] of [[bx + 10, by + 10], [bx + 10, by + bh - 10]]) s += `<circle cx="${nx}" cy="${ny}" r="1.8" fill="#c9c2b6" stroke="${C.line}" stroke-width=".7"/>`;
  // a little fish silhouette painted on the tip
  s += `<path d="M${bx + 138},${by + 42} q8,-6 16,0 l5,-4 l0,8 l-5,-4 q-8,6 -16,0 z" fill="#ffd79a" opacity=".9"/>`;
  return s;
}
function cat(x, y) {
  // ginger tabby sitting on the curb, eyeing the fish basket (faces left)
  const T = (d) => d;
  const base = '#f0a258', shade = '#b8703f', rim = '#ffd58a', white = '#fff4e8';
  let s = '';
  // tail curling round the paws, tip twitching up
  s += line(`M${x + 20},${y - 4} C${x + 44},${y - 2} ${x + 46},${y - 30} ${x + 36},${y - 44}`, C.line, 9.4);
  s += line(`M${x + 20},${y - 4} C${x + 44},${y - 2} ${x + 46},${y - 30} ${x + 36},${y - 44}`, base, 6.4);
  s += line(`M${x + 40},${y - 22} l6,-2 M${x + 42},${y - 32} l6,0`, shade, 2.4);
  // body
  const body = `M${x - 18},${y} C${x - 26},${y - 20} ${x - 24},${y - 44} ${x - 12},${y - 56} C${x},${y - 64} ${x + 16},${y - 58} ${x + 22},${y - 40} C${x + 28},${y - 24} ${x + 28},${y - 8} ${x + 22},${y} Z`;
  const stripes = [[-2, -50], [8, -46], [16, -36], [20, -24]].map(([dx, dy]) => line(`M${x + dx},${y + dy} q5,3 4,9`, shade, 2.4)).join('');
  s += cel(body, { base, shade, rim, sh: 7, rimW: 3, inner: stripes + `<path d="M${x - 20},${y - 6} C${x - 22},${y - 22} ${x - 18},${y - 40} ${x - 10},${y - 50} C${x - 6},${y - 36} ${x - 6},${y - 16} ${x - 4},${y} Z" fill="${white}"/>`, lw: 2.2 });
  // paws
  s += cel(`M${x - 20},${y} C${x - 22},${y - 7} ${x - 12},${y - 8} ${x - 8},${y - 2} L${x - 8},${y} Z`, { base: white, shade: '#d9c8c8', rim: '#fff', sh: 2, lw: 1.8 });
  // head
  const hx = x - 12, hy = y - 66;
  const head = `M${hx - 20},${hy + 4} C${hx - 22},${hy - 8} ${hx - 12},${hy - 16} ${hx},${hy - 16} C${hx + 12},${hy - 16} ${hx + 18},${hy - 6} ${hx + 17},${hy + 4} C${hx + 16},${hy + 14} ${hx + 6},${hy + 18} ${hx - 4},${hy + 17} C${hx - 14},${hy + 16} ${hx - 20},${hy + 12} ${hx - 20},${hy + 4} Z`;
  const ears = `M${hx - 14},${hy - 10} L${hx - 18},${hy - 30} L${hx - 2},${hy - 16} Z M${hx + 4},${hy - 16} L${hx + 14},${hy - 32} L${hx + 16},${hy - 8} Z`;
  s += cel(ears, { base, shade, rim, sh: 3, rimW: 2, lw: 2, inner: `<path d="M${hx - 14},${hy - 13} L${hx - 16},${hy - 25} L${hx - 7},${hy - 16} Z M${hx + 7},${hy - 16} L${hx + 13},${hy - 26} L${hx + 14},${hy - 12} Z" fill="#f4b0a8"/>` });
  s += cel(head, { base, shade, rim, sh: 6, rimW: 2.6, lw: 2.2, inner:
    `<path d="M${hx - 21},${hy + 6} C${hx - 18},${hy + 16} ${hx - 6},${hy + 18} ${hx + 2},${hy + 14} C${hx - 2},${hy + 8} ${hx - 10},${hy + 4} ${hx - 21},${hy + 6} Z" fill="${white}"/>`
    + line(`M${hx - 2},${hy - 15} l1,6 M${hx + 5},${hy - 14} l-1,6 M${hx + 11},${hy - 10} l-3,4`, shade, 2) });
  // big fixated eyes looking at the fish
  for (const [ex, sc] of [[hx - 11, 1], [hx + 1, 0.9]]) {
    s += `<ellipse cx="${ex}" cy="${hy}" rx="${4.6 * sc}" ry="${5.4 * sc}" fill="#e8f0a8" stroke="${C.line}" stroke-width="1.4"/><ellipse cx="${ex - 1.4 * sc}" cy="${hy + .4}" rx="${2.2 * sc}" ry="${4.2 * sc}" fill="#1c1418"/><circle cx="${ex - 2.6 * sc}" cy="${hy - 2}" r="${1.3 * sc}" fill="#fff"/>`;
  }
  s += `<path d="M${hx - 17},${hy + 7} l3,2 l3,-2 z" fill="#d86a6a" stroke="${C.line}" stroke-width=".9"/>`;
  s += line(`M${hx - 14},${hy + 9} q-2,4 -5,3 M${hx - 14},${hy + 9} q2,4 5,3`, C.line, 1.1);
  s += line(`M${hx - 20},${hy + 8} l-14,-3 M${hx - 20},${hy + 10} l-14,2 M${hx - 8},${hy + 9} l12,-2`, '#fff8ee', 0.9, 'opacity=".9"');
  return s;
}
function verge() {
  let s = '';
  const vg = nid('vg');
  defs.push(`<linearGradient id="${vg}" x1="0" y1="660" x2="0" y2="745" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#9dba58"/><stop offset=".5" stop-color="#5e9146"/><stop offset="1" stop-color="#3a653b"/></linearGradient>`);
  const top = 'M-400,678 C-200,670 0,664 200,672 C400,680 600,666 800,670 C1000,674 1200,662 1400,670 C1600,678 1800,668 2000,672';
  s += `<path d="${top} L2000,760 L-400,760 Z" fill="url(#${vg})"/>`;
  s += `<path d="${top}" stroke="#e0e68a" stroke-width="2.5" fill="none" opacity=".9"/>`;
  const R = mkRng('verge');
  const daisy = { n: 16, r: 2.4, c: [['#fdf8ee', '#ffffff'], ['#f7e27a', '#fff6b0']], eye: '#e8b040' };
  const hyd = { kind: 'hyd', n: 9, r: 8, c: [['#8e8ed8', '#d2ccf6', '#6a6ab8'], ['#a68ad2', '#e0cdf6', '#7c62ae'], ['#7ea2da', '#cfe0f6', '#5a7cb8']] };
  const B = [
    [-60, 724, 220, 110, 'b0', {}], [150, 716, 140, 76, 'b1', { flowers: daisy }], [280, 712, 110, 44, 'b2', {}],
    [420, 712, 190, 84, 'b3', { flowers: daisy }], [610, 706, 120, 40, 'b4', {}], [760, 710, 160, 66, 'b4b', {}],
    [930, 714, 200, 88, 'b5', { flowers: hyd }], [1080, 714, 110, 44, 'b6', {}],
    [1210, 716, 170, 76, 'b7', { flowers: hyd }], [1420, 716, 210, 96, 'b8', { flowers: daisy }], [1620, 720, 180, 110, 'b9', { flowers: hyd }],
  ];
  for (const [x, y, w, h, seed, o] of B) s += foliage(x, y, w, h, seed, o);
  // stone curb along the road
  let wall = '';
  const W = mkRng('wall');
  wall += `<rect x="-400" y="718" width="2400" height="26" fill="#6e6576"/>`;
  let x = -420;
  while (x < 2020) {
    const w = 26 + W() * 30;
    const y0 = 716 + W() * 3, hh = 13 + W() * 3;
    wall += `<path d="${smooth([[x + 2, y0 + hh], [x + 1, y0 + 3], [x + w * 0.5, y0 - 1], [x + w - 1, y0 + 2], [x + w - 1, y0 + hh]], true, 0.8)}" fill="#a79ca4"/>`;
    wall += `<path d="M${pt(x + 4, y0 + 1.5)} Q${pt(x + w * 0.5, y0 - 1.5)} ${pt(x + w - 3, y0 + 2)}" stroke="#f6d4a0" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    wall += `<path d="M${pt(x + w - 3, y0 + 3)} L${pt(x + w - 3, y0 + hh - 1)}" stroke="#e8bf94" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>`;
    const w2 = w * (0.6 + W() * 0.5);
    wall += `<path d="${smooth([[x + 6, 744], [x + 5, y0 + hh + 2], [x + w2 * 0.5 + 6, y0 + hh], [x + w2, y0 + hh + 2], [x + w2, 744]], true, 0.8)}" fill="#877e8e"/>`;
    if (W() < 0.3) wall += `<path d="${blobPath(x + w * 0.3, y0 + 3, 8, 3, W, 7, 0.3, false)}" fill="#7fa84e"/>`;
    x += w + 1;
  }
  wall += `<rect x="-400" y="738" width="2400" height="7" fill="#524a5c" opacity=".6"/>`;
  s += wall;
  let g = '';
  for (let i = 0; i < 90; i++) {
    const gx = -20 + R() * 1640;
    g += grassTuft(gx, 720, 12 + R() * 20, R, ['#4f8a45', '#7fb04e', '#c4da70'], 5, -0.25);
  }
  s += g;
  s += signpost(1290, 742);
  s += cat(1352, 720);
  return s;
}
function road() {
  let s = '';
  const g = nid('rd');
  defs.push(`<linearGradient id="${g}" x1="0" y1="744" x2="0" y2="870" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#9a8a8e"/><stop offset=".15" stop-color="#7f7280"/><stop offset=".6" stop-color="#6a5f6e"/><stop offset="1" stop-color="#584f60"/></linearGradient>`);
  s += `<rect x="-400" y="744" width="2400" height="126" fill="url(#${g})"/>`;
  // curb shadow and far edge line
  s += `<rect x="-400" y="744" width="2400" height="4" fill="#4a4152" opacity=".55"/>`;
  s += `<rect x="-400" y="752" width="2400" height="2.4" fill="#efe3c8" opacity=".85"/>`;
  // dashed centre line (faded)
  for (let x = -380; x < 2000; x += 157.08) s += `<rect x="${n(x)}" y="772" width="70" height="3" fill="#f1dca0" opacity=".55"/>`;
  // near edge line
  s += `<rect x="-400" y="848" width="2400" height="3.4" fill="#efe3c8" opacity=".8"/>`;
  // texture: warm speckles, cracks, tar lines
  const R = mkRng('road');
  let t = '';
  for (let i = 0; i < 420; i++) {
    const x = -20 + R() * 1640, y = 756 + R() * 110;
    t += `<rect x="${n(x)}" y="${n(y)}" width="${n(1 + R() * 2.5)}" height="${n(0.8 + R())}" fill="${R() < 0.5 ? '#b3a1a0' : '#4f4658'}" opacity="${n(0.25 + R() * 0.4)}"/>`;
  }
  for (let i = 0; i < 9; i++) {
    const x = R() * 1600, y = 780 + R() * 70;
    t += `<path d="M${pt(x, y)} q${n(20 + R() * 20)},${n(-3 + R() * 6)} ${n(40 + R() * 40)},${n(-2 + R() * 4)} t${n(30 + R() * 30)},${n(-2 + R() * 4)}" stroke="#463e4e" stroke-width="1.2" fill="none" opacity=".45"/>`;
  }
  s += t;
  // warm light sheen on the far lane (sun glare on asphalt)
  const sh = nid('rs');
  defs.push(`<radialGradient id="${sh}" cx="1350" cy="760" r="520" gradientTransform="translate(1350 760) scale(1 .16) translate(-1350 -760)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffd9a6" stop-opacity=".55"/><stop offset="1" stop-color="#ffd9a6" stop-opacity="0"/></radialGradient>`);
  s += `<rect x="-400" y="744" width="2400" height="126" fill="url(#${sh})"/>`;
  // painterly asphalt strokes: warm lit streaks and cool worn patches
  const R2 = mkRng('road2');
  for (let i = 0; i < 46; i++) {
    const x = -40 + R2() * 1680, y = 758 + R2() * 100, w = 40 + R2() * 160;
    const warm = R2() < 0.5;
    s += `<path d="M${pt(x, y)} C${pt(x + w * .3, y - 1.6)} ${pt(x + w * .7, y + 1.6)} ${pt(x + w, y)}" stroke="${warm ? '#b49c96' : '#5a5064'}" stroke-width="${n(1.4 + R2() * 2.6)}" fill="none" stroke-linecap="round" opacity="${n(0.18 + R2() * 0.2)}"/>`;
  }
  // wind-drifted sand along the curb
  for (let i = 0; i < 14; i++) {
    const x = R2() * 1640 - 20, w = 30 + R2() * 90;
    s += `<path d="M${pt(x, 748)} Q${pt(x + w / 2, 744 + R2() * 2)} ${pt(x + w, 748)} Q${pt(x + w * 0.5, 753 + R2() * 4)} ${pt(x, 748)} Z" fill="#e2c49a" opacity=".75"/>`;
  }
  // long low-sun shadows of the signpost and the cat (toward the viewer, to the left)
  s += `<g transform="translate(1290 745) matrix(1 0 0.3 -0.2 0 0)" fill="#3a2e4c" opacity=".26"><rect x="-6" y="-300" width="12" height="300"/><path d="M-70,-318 L94,-318 L120,-292 L94,-266 L-70,-266 Z"/></g>`;
  s += `<g transform="translate(1352 745) matrix(1 0 0.3 -0.2 0 0)" fill="#3a2e4c" opacity=".24"><ellipse cx="0" cy="-32" rx="24" ry="32"/><circle cx="-12" cy="-86" r="19"/><path d="M-26,-96 L-30,-116 L-14,-102 Z M-8,-102 L2,-118 L4,-94 Z"/></g>`;
  // dappled shade of the verge bushes spilling over the far lane
  for (let i = 0; i < 26; i++) {
    const x = -30 + R2() * 1660, w = 30 + R2() * 90;
    s += `<ellipse cx="${n(x)}" cy="${n(752 + R2() * 6)}" rx="${n(w / 2)}" ry="${n(3 + R2() * 4)}" fill="#3a2e4c" opacity=".16"/>`;
  }
  return s;
}
function sunHaze() {
  const g = nid('hz');
  defs.push(`<radialGradient id="${g}" cx="1451" cy="420" r="1000" gradientTransform="translate(1451 420) scale(1 .62) translate(-1451 -420)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffe2a8" stop-opacity=".42"/><stop offset=".35" stop-color="#ffd49a" stop-opacity=".16"/><stop offset="1" stop-color="#ffc890" stop-opacity="0"/></radialGradient>`);
  const b = nid('bl');
  defs.push(`<radialGradient id="${b}" cx="1451" cy="330" r="260" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff4d0" stop-opacity=".75"/><stop offset=".3" stop-color="#ffe6b0" stop-opacity=".3"/><stop offset="1" stop-color="#ffd8a0" stop-opacity="0"/></radialGradient>`);
  return `<rect x="-400" y="-400" width="2400" height="1400" fill="url(#${g})"/><circle cx="1451" cy="330" r="260" fill="url(#${b})"/><circle cx="1451" cy="330" r="25" fill="#fffef6"/><circle cx="1451" cy="330" r="31" fill="none" stroke="#fff6d0" stroke-width="4" opacity=".6"/>`;
}
function foreground() {
  let s = '';
  s += `<path d="M-400,862 C0,856 400,866 800,860 C1200,854 1500,864 2000,858 L2000,1300 L-400,1300 Z" fill="#2c5634"/>`;
  s += `<path d="M-400,862 C0,856 400,866 800,860 C1200,854 1500,864 2000,858" stroke="#a9c860" stroke-width="2.2" fill="none"/>`;
  const R = mkRng('fg');
  for (let i = 0; i < 80; i++) {
    const x = -30 + R() * 1660;
    s += grassTuft(x, 905, 22 + R() * 40, R, ['#224a2e', '#33663a', '#5f9244', '#b2cf62'], 6, -0.3);
  }
  s += foliage(40, 960, 380, 270, 'fgL', { pal: FOL_FG, r: 44 });
  s += foliage(1580, 965, 400, 300, 'fgR', { pal: FOL_FG, r: 46, flowers: { n: 12, r: 3.6, c: [['#fdf8ee', '#ffffff'], ['#f7d25a', '#fff0a0']], eye: '#e0a030' } });
  for (let i = 0; i < 14; i++) {
    const x = 1330 + R() * 270, y = 860 + R() * 30;
    s += `<path d="M${pt(x, y + 40)} Q${pt(x - 6, y)} ${pt(x - 2 + R() * 8, y - 60 - R() * 50)}" stroke="${R() < .5 ? '#3f7446' : '#9cbc58'}" stroke-width="1.8" fill="none"/>`;
  }
  // dandelion clocks catching the low sun
  for (const [x, y, r] of [[1400, 772, 11], [1452, 790, 8], [210, 800, 9]]) {
    s += `<path d="M${x},${y + 90} Q${x + 3},${y + 40} ${x},${y}" stroke="#4f7a44" stroke-width="1.6" fill="none"/>`;
    s += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff4e0" opacity=".55"/><circle cx="${x}" cy="${y}" r="${r * .55}" fill="#fffaf0"/><path d="M${x + r * .3},${y - r} A${r},${r} 0 0 1 ${x + r},${y}" stroke="#ffd98a" stroke-width="1.6" fill="none"/>`;
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; s += line(`M${pt(x + Math.cos(a) * r * .4, y + Math.sin(a) * r * .4)} L${pt(x + Math.cos(a) * r, y + Math.sin(a) * r)}`, '#fffaf0', .7, 'opacity=".8"'); }
  }
  return s;
}
function atmo() {
  const g = nid('at');
  defs.push(`<linearGradient id="${g}" x1="0" y1="380" x2="0" y2="560" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffe6c8" stop-opacity="0"/><stop offset=".5" stop-color="#ffe6c8" stop-opacity=".28"/><stop offset="1" stop-color="#ffe6c8" stop-opacity="0"/></linearGradient>`);
  let s = `<rect x="-400" y="380" width="2400" height="180" fill="url(#${g})"/>`;
  return s;
}
function gulls() {
  const G = (x, y, s, r = 0) => `<path transform="translate(${x} ${y}) rotate(${r}) scale(${s})" d="M-12,0 Q-6,-7 0,0 Q6,-7 12,0 Q6,-4 0,2 Q-6,-4 -12,0 Z" fill="#fdf6ea" stroke="#4a3e48" stroke-width="${n(1.2 / s)}"/>`;
  return G(1010, 360, 0.9, -6) + G(1045, 338, 0.65, 4) + G(560, 180, 0.7, 8) + G(1330, 250, .55, -4);
}
function motes() {
  // floating light specks (pollen/sea spray) catching the low sun
  const R = mkRng('motes');
  let s = '';
  const g = nid('mt');
  defs.push(`<radialGradient id="${g}"><stop offset="0" stop-color="#fff6d8" stop-opacity=".95"/><stop offset=".4" stop-color="#ffe3a8" stop-opacity=".5"/><stop offset="1" stop-color="#ffd890" stop-opacity="0"/></radialGradient>`);
  for (let i = 0; i < 26; i++) {
    const x = 380 + R() * 1150, y = 330 + R() * 420, r = 2 + R() * 5;
    s += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="url(#${g})"/>`;
  }
  return s;
}
function riderShadow() {
  // low sun behind the scene: shadow falls toward the viewer and to the left
  let s = '';
  s += `<g transform="translate(680 792)">`;
  s += `<ellipse cx="-125" cy="0" rx="46" ry="5" fill="#2d2440" opacity=".45"/><ellipse cx="173" cy="0" rx="46" ry="5" fill="#2d2440" opacity=".45"/>`;
  s += `<g transform="matrix(1 0 0.3 -0.2 0 0)" opacity=".3" fill="#2d2440" stroke="#2d2440" stroke-linecap="round">
      <circle cx="-125" cy="-100" r="95" fill="#2d2440" fill-opacity=".35" stroke-width="12"/><circle cx="173" cy="-100" r="95" fill="#2d2440" fill-opacity=".35" stroke-width="12"/>
      <path d="M0,-80 L-125,-100 L-46,-232 L0,-80 L120,-210 L114,-238 L-44,-226" fill="none" stroke-width="9"/>
      <path d="M125,-203 L173,-100" fill="none" stroke-width="7"/><rect x="140" y="-292" width="82" height="66"/>
      <ellipse cx="-13" cy="-347" rx="98" ry="58" transform="rotate(-18 -13 -347)" stroke="none"/>
      <path d="M67,-390 C97,-448 53,-476 111,-510" fill="none" stroke-width="36"/><circle cx="125" cy="-520" r="27" stroke="none"/>
      <path d="M141,-518 L265,-487 L150,-490 Z" stroke-width="10"/><path d="M-107,-336 L-165,-345" stroke-width="18"/>
      <path d="M-37,-297 L79,-215 L33,-89" fill="none" stroke-width="16"/><path d="M-41,-300 L37,-182 L-64,-93" fill="none" stroke-width="16"/>
    </g>`;
  s += `</g>`;
  return s;
}

// ================================================================ RIDER
// ---- wheels
function wheel(far = false) {
  const R = BIKE.R;
  let s = '';
  // tyre
  s += `<circle r="${R - 4.5}" fill="none" stroke="${C.line}" stroke-width="11"/>`;
  s += `<circle r="${R - 4.5}" fill="none" stroke="${C.tyre}" stroke-width="8.4"/>`;
  s += `<circle r="${R - 8.2}" fill="none" stroke="${C.gum}" stroke-width="2.4"/>`;
  // spokes: 32, 3-cross
  let sp = '';
  for (let side = 0; side < 2; side++) for (let i = 0; i < 16; i++) {
    const hub = (i * 22.5 + side * 11.25) * DEGR;
    const dir = (i % 2 ? 1 : -1);
    const rim = hub + dir * 67.5 * DEGR;
    const hr = 9;
    sp += `<path d="M${pt(Math.cos(hub) * hr, Math.sin(hub) * hr)} L${pt(Math.cos(rim) * 88.5, Math.sin(rim) * 88.5)}" stroke="${side ? '#bdb6b6' : C.spoke}" stroke-width="${side ? 0.9 : 1.1}"/>`;
  }
  s += `<g opacity=".92">${sp}</g>`;
  // rim
  s += `<circle r="89.5" fill="none" stroke="${C.chromeDark}" stroke-width="4.2"/><circle r="89.6" fill="none" stroke="${C.chrome}" stroke-width="2.6"/>`;
  s += `<path d="M${pt(89.5 * Math.cos(-100 * DEGR), 89.5 * Math.sin(-100 * DEGR))} A89.5,89.5 0 0 1 ${pt(89.5 * Math.cos(10 * DEGR), 89.5 * Math.sin(10 * DEGR))}" stroke="${C.chromeLit}" stroke-width="1.2" fill="none"/>`;
  // valve + reflector
  s += `<rect x="-2" y="-92" width="4" height="7" fill="${C.chromeDark}"/>`;
  if (!far) s += `<g transform="rotate(130)"><rect x="46" y="-4" width="16" height="7" rx="2" fill="#e8742f" stroke="${C.line}" stroke-width="1"/><rect x="48" y="-3" width="6" height="2" fill="#ffc07a"/></g>`;
  // hub
  s += `<circle r="10" fill="${C.chromeShade}" stroke="${C.line}" stroke-width="1.4"/><circle r="6" fill="${C.chrome}"/><circle cx="-1.5" cy="-1.5" r="2.2" fill="#fff"/>`;
  return s;
}
function tyreRim() {
  // sun-side rim light on the tyre (world-fixed, drawn un-rotated)
  const R = BIKE.R;
  const a0 = -95 * DEGR, a1 = 5 * DEGR;
  return `<path d="M${pt(Math.cos(a0) * (R - 1.6), Math.sin(a0) * (R - 1.6))} A${R - 1.6},${R - 1.6} 0 0 1 ${pt(Math.cos(a1) * (R - 1.6), Math.sin(a1) * (R - 1.6))}" stroke="${C.plRim}" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".85"/>`;
}
function tube(a, b, w, col, shade, lit) {
  const d = `M${pt(...a)} L${pt(...b)}`;
  return { d, w, col, shade, lit, a, b };
}
function drawTubes(T) {
  let s = '';
  for (const t of T) s += `<path d="${t.d}" stroke="${C.line}" stroke-width="${t.w + 4.4}" stroke-linecap="round"/>`;
  for (const t of T) s += `<path d="${t.d}" stroke="${t.col}" stroke-width="${t.w}" stroke-linecap="round"/>`;
  for (const t of T) {
    // shade on the lower/away side, light on the upper/sun side (offset perpendicular to the tube)
    const dx = t.b[0] - t.a[0], dy = t.b[1] - t.a[1], L = Math.hypot(dx, dy);
    let nx = -dy / L, ny = dx / L;                         // perpendicular
    if (nx * LIGHT[0] + ny * LIGHT[1] < 0) { nx = -nx; ny = -ny; }   // make it point toward the light
    const off = (k) => `M${pt(t.a[0] + nx * k, t.a[1] + ny * k)} L${pt(t.b[0] + nx * k, t.b[1] + ny * k)}`;
    s += `<path d="${off(-t.w * 0.3)}" stroke="${t.shade}" stroke-width="${n(t.w * 0.38)}" stroke-linecap="round"/>`;
    s += `<path d="${off(t.w * 0.26)}" stroke="${t.lit}" stroke-width="${n(t.w * 0.22)}" stroke-linecap="round"/>`;
  }
  return s;
}
function frame() {
  const bb = BIKE.bb, rh = BIKE.rearHub, st = BIKE.seatTubeTop;
  const htT = BIKE.headTop, htB = BIKE.headBottom;
  const hdir = [(htB[0] - htT[0]) / 44, (htB[1] - htT[1]) / 44];
  const onHT = k => [htT[0] + hdir[0] * k, htT[1] + hdir[1] * k];
  const F = C.frame, FS = C.frameShade, FL = C.frameLit;
  let s = '';
  // rear fender (cream) + rack
  const fr = 108;
  const arc = (cx, cy, r, a0, a1) => `M${pt(cx + r * Math.cos(a0 * DEGR), cy + r * Math.sin(a0 * DEGR))} A${r},${r} 0 0 1 ${pt(cx + r * Math.cos(a1 * DEGR), cy + r * Math.sin(a1 * DEGR))}`;
  s += `<path d="${arc(rh[0], rh[1], fr, -178, -38)}" stroke="${C.line}" stroke-width="10.5" fill="none" stroke-linecap="round"/>`;
  s += `<path d="${arc(rh[0], rh[1], fr, -178, -38)}" stroke="${C.cream}" stroke-width="6.5" fill="none" stroke-linecap="round"/>`;
  s += `<path d="${arc(rh[0], rh[1], fr + 1.8, -120, -40)}" stroke="${C.creamLit}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  s += `<path d="${arc(rh[0], rh[1], fr - 2, -178, -120)}" stroke="${C.creamShade}" stroke-width="2.4" fill="none"/>`;
  // fender stays
  s += line(`M${pt(...rh)} L${pt(rh[0] - 98, rh[1] - 34)}`, C.chromeShade, 2);
  // rear rack
  const rack = [[-200, -212], [-66, -218]];
  s += line(`M${pt(-190, -212)} L${pt(-66, -219)}`, C.line, 6.4) + line(`M${pt(-190, -212)} L${pt(-66, -219)}`, C.chrome, 3.2);
  s += line(`M${pt(-176, -212)} L${pt(-130, -104)}`, C.line, 4.2) + line(`M${pt(-176, -212)} L${pt(-130, -104)}`, C.chromeShade, 2);
  s += line(`M${pt(-150, -214)} L${pt(-127, -104)}`, C.line, 4.2) + line(`M${pt(-150, -214)} L${pt(-127, -104)}`, C.chrome, 2);
  // rolled straw beach mat strapped on the rack
  s += `<g transform="translate(-128 -229) rotate(-3)">
      <rect x="-50" y="-11" width="96" height="22" rx="11" fill="#e8c77f" stroke="${C.line}" stroke-width="2"/>
      <rect x="-50" y="-11" width="96" height="7" rx="3.5" fill="#fbe6b0"/><rect x="-50" y="4" width="96" height="7" rx="3.5" fill="#c9a060"/>
      ${[-40, -30, -20, -10, 0, 10, 20, 30, 40].map(x => `<path d="M${x},-10 L${x},10" stroke="#b58c52" stroke-width=".9"/>`).join('')}
      <ellipse cx="46" cy="0" rx="5" ry="11" fill="#d9b06a" stroke="${C.line}" stroke-width="1.6"/><path d="M46,-6 Q43,0 46,6" stroke="#a07a44" stroke-width="1" fill="none"/>
      <rect x="-26" y="-12" width="7" height="24" fill="#c8453c" stroke="${C.line}" stroke-width="1.2"/><rect x="18" y="-12" width="7" height="24" fill="#c8453c" stroke="${C.line}" stroke-width="1.2"/>
    </g>`;
  // kickstand (folded)
  s += line(`M${pt(-22, -86)} L${pt(-96, -76)}`, C.line, 6) + line(`M${pt(-22, -86)} L${pt(-96, -76)}`, C.chromeShade, 3);
  // frame tubes
  const seatCluster = [-44.5, -226];
  const T = [
    tube(bb, rh, 6.2, F, FS, FL),                                   // chainstay
    tube([seatCluster[0] - 2, seatCluster[1] + 4], rh, 5.2, F, FS, FL), // seat stay
    tube(bb, [-46.5, -232], 9, F, FS, FL),                             // seat tube
    tube([-44.5, -226], onHT(8), 8, F, FS, FL),                        // top tube
    tube(bb, onHT(37), 10.5, F, FS, FL),                               // down tube
    tube(htT, htB, 12, F, FS, FL),                                     // head tube
  ];
  s += drawTubes(T);
  // cream head-tube panel + head badge
  s += line(`M${pt(...onHT(9))} L${pt(...onHT(34))}`, C.cream, 7);
  s += `<g transform="translate(${n(onHT(21)[0] + 1)} ${n(onHT(21)[1])}) rotate(-18)"><ellipse rx="4.2" ry="6.4" fill="#c8453c" stroke="${C.line}" stroke-width="1"/><path d="M-1.5,-3 L1.5,-3 L0,3 Z" fill="#fff0c8"/></g>`;
  // cream seat-tube band with pinstripes
  const stp = k => [bb[0] + (-46.5 - bb[0]) * k, bb[1] + (-232 - bb[1]) * k];
  s += line(`M${pt(...stp(0.52))} L${pt(...stp(0.7))}`, C.cream, 7);
  s += line(`M${pt(...stp(0.5))} L${pt(...stp(0.505))}`, C.creamLit, 7.2);
  // lugs
  s += `<circle cx="${bb[0]}" cy="${bb[1]}" r="9" fill="${C.cream}" stroke="${C.line}" stroke-width="2"/><circle cx="${bb[0] + 2}" cy="${bb[1] - 2}" r="3" fill="${C.creamLit}"/>`;
  s += `<circle cx="-45" cy="-229" r="6.2" fill="${C.cream}" stroke="${C.line}" stroke-width="1.8"/>`;
  // rear dropout
  s += `<circle cx="${rh[0]}" cy="${rh[1]}" r="7" fill="${F}" stroke="${C.line}" stroke-width="1.6"/>`;
  // seat post + sprung leather saddle
  s += line(`M${pt(-46.5, -232)} L${pt(-60.5, -278)}`, C.line, 7.4) + line(`M${pt(-46.5, -232)} L${pt(-60.5, -278)}`, C.chrome, 4.4) + line(`M${pt(-45.2, -233)} L${pt(-59.2, -278)}`, C.chromeLit, 1.2);
  s += saddle();
  return s;
}
function saddle() {
  let s = '';
  // coil springs at the back
  for (const x of [-92, -80]) {
    let d = `M${x},-268`;
    for (let i = 0; i < 5; i++) d += ` q4,-1.4 0,-2.8 q-4,-1.4 0,-2.8`;
    s += line(d, C.line, 3.4) + line(d, C.chrome, 1.6);
  }
  s += line(`M-96,-268 L-58,-274 L-30,-282`, C.line, 4) + line(`M-96,-268 L-58,-274 L-30,-282`, C.chromeShade, 2);
  s += `<rect x="-64" y="-281" width="8" height="6" fill="${C.chromeDark}" stroke="${C.line}" stroke-width="1.2"/>`;
  const d = 'M-101,-283 C-102,-292 -88,-296 -66,-294 C-50,-293 -34,-291 -23,-288 C-18,-286 -20,-282 -26,-281 C-40,-279 -54,-276 -68,-274 C-84,-272 -100,-274 -101,-283 Z';
  s += cel(d, { base: C.saddle, shade: C.saddleShade, rim: C.saddleLit, sh: 4, rimW: 2, lw: 2.2 });
  for (const [x, y] of [[-94, -281], [-86, -277], [-76, -276]]) s += `<circle cx="${x}" cy="${y}" r="1.3" fill="${C.chromeWarm}"/>`;
  return s;
}
function fork() {
  const htB = BIKE.headBottom, fh = BIKE.frontHub;
  let s = '';
  // front fender
  const fr = 108;
  const arc = (a0, a1, r = fr) => `M${pt(fh[0] + r * Math.cos(a0 * DEGR), fh[1] + r * Math.sin(a0 * DEGR))} A${r},${r} 0 0 1 ${pt(fh[0] + r * Math.cos(a1 * DEGR), fh[1] + r * Math.sin(a1 * DEGR))}`;
  s += `<path d="${arc(-150, 12)}" stroke="${C.line}" stroke-width="10.5" fill="none" stroke-linecap="round"/><path d="${arc(-150, 12)}" stroke="${C.cream}" stroke-width="6.5" fill="none" stroke-linecap="round"/>`;
  s += `<path d="${arc(-100, 5, fr + 1.8)}" stroke="${C.creamLit}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  s += line(`M${pt(...fh)} L${pt(fh[0] + 100, fh[1] - 30)}`, C.chromeShade, 1.8);
  // fork blade (curved to the rake)
  const blade = `M${pt(htB[0] + 0.5, htB[1] + 2)} C${pt(htB[0] + 14, htB[1] + 46)} ${pt(fh[0] - 16, fh[1] - 12)} ${pt(fh[0], fh[1])}`;
  s += line(blade, C.line, 11) + line(blade, C.frame, 7) + line(shiftD(blade, 2.2, -0.6), C.frameLit, 1.8) + line(shiftD(blade, -2.4, 0.8), C.frameShade, 2.2);
  // crown
  s += `<path d="M${pt(htB[0] - 8, htB[1] - 2)} L${pt(htB[0] + 8, htB[1] - 6)} L${pt(htB[0] + 10, htB[1] + 3)} L${pt(htB[0] - 6, htB[1] + 7)} Z" fill="${C.chrome}" stroke="${C.line}" stroke-width="1.6"/>`;
  s += `<circle cx="${fh[0]}" cy="${fh[1]}" r="5" fill="${C.frame}" stroke="${C.line}" stroke-width="1.4"/>`;
  // headlamp on a bracket
  const L = BIKE.lamp;
  s += line(`M${pt(htB[0] + 4, htB[1] - 6)} L${pt(L[0] - 6, L[1] + 2)}`, C.line, 5) + line(`M${pt(htB[0] + 4, htB[1] - 6)} L${pt(L[0] - 6, L[1] + 2)}`, C.chromeShade, 2.6);
  // bullet headlamp: bowl widening to a chrome bezel, cream lens seen edge-on
  s += `<g transform="translate(${L[0]} ${L[1]}) rotate(-4)">
    <path d="M-13,-5 C-13,-8.6 -9,-10.2 -3,-11 L9,-12 L9,12 L-3,11 C-9,10.2 -13,8.6 -13,5 Z" fill="${C.chrome}" stroke="${C.line}" stroke-width="2"/>
    <path d="M-11,-5.6 C-10,-8 -6,-9 -2,-9.6 L8,-10.4 L8,-6 L-2,-5.8 C-6,-5.6 -9,-5 -11,-3.6 Z" fill="#fff"/>
    <path d="M-12,4 C-9,8 -4,9 8,9.6 L8,12 L-3,11 C-9,10.2 -13,8.6 -13,5 Z" fill="${C.chromeShade}"/>
    <path d="M-3,-11 L9,-12 L9,-10 L-3,-9.4 Z" fill="${C.chromeWarm}"/>
    <ellipse cx="10" cy="0" rx="4" ry="12.6" fill="${C.chromeShade}" stroke="${C.line}" stroke-width="1.8"/>
    <ellipse cx="11" cy="0" rx="2.6" ry="10.4" fill="#fff3cc"/>
    <ellipse cx="11.6" cy="-4" rx="1.1" ry="3.6" fill="#fff"/>
    <rect x="-8" y="-15" width="6" height="4" rx="1" fill="${C.chromeDark}" stroke="${C.line}" stroke-width="1"/>
  </g>`;
  return s;
}
function bars() {
  let s = '';
  const st = BIKE.steererTop, sm = BIKE.stem;
  // steerer + quill stem
  s += line(`M${pt(...BIKE.headTop)} L${pt(...st)}`, C.line, 8.4) + line(`M${pt(...BIKE.headTop)} L${pt(...st)}`, C.chrome, 5);
  s += line(`M${pt(st[0], st[1])} L${pt(...sm)}`, C.line, 8) + line(`M${pt(st[0], st[1])} L${pt(...sm)}`, C.chrome, 4.6) + line(`M${pt(st[0] + 0.5, st[1] - 1.6)} L${pt(sm[0], sm[1] - 1.6)}`, '#fff', 1.2);
  // basket (mounted on the bar, supported by struts to the hub)
  s += basket();
  // swept-back city bar: clamp -> forward/up -> back to the grip
  const bar = `M${pt(...sm)} C${pt(sm[0] + 8, sm[1] - 3)} ${pt(sm[0] + 6, sm[1] - 12)} ${pt(sm[0] - 6, sm[1] - 10)} L${pt(100, -273)}`;
  s += line(bar, C.line, 7.6) + line(bar, C.chrome, 4.2) + line(shiftD(bar, 0.4, -1.4), '#fff', 1.1);
  // grip (cork)
  s += `<g transform="translate(112 -274.6) rotate(-10)"><rect x="-13" y="-4.8" width="24" height="9.6" rx="4.4" fill="#a8744a" stroke="${C.line}" stroke-width="1.8"/><rect x="-11" y="-3.6" width="20" height="2.4" rx="1.2" fill="#e0a870"/></g>`;
  // bell
  const b = BIKE.bell;
  s += line(`M${pt(b[0] - 1, b[1] + 6)} L${pt(b[0] + 2, b[1] + 1)}`, C.line, 3.4) + line(`M${pt(b[0] - 1, b[1] + 6)} L${pt(b[0] + 2, b[1] + 1)}`, C.chromeShade, 1.6);
  s += line(`M${pt(b[0] + 1, b[1] + 1)} L${pt(b[0] + 5, b[1] - 3)}`, C.line, 3.4) + line(`M${pt(b[0] + 1, b[1] + 1)} L${pt(b[0] + 5, b[1] - 3)}`, C.chromeShade, 1.6);
  s += `<g transform="translate(${b[0] + 6} ${b[1] - 5}) scale(1.08)"><path d="M-8,2 C-8,-7 8,-7 8,2 Z" fill="${C.chrome}" stroke="${C.line}" stroke-width="1.8"/><path d="M-5,-2 C-4,-5 0,-5.4 2,-4.6" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M1,-5 C4,-4 6,-2 6.4,0.6" stroke="${C.chromeWarm}" stroke-width="1.4" fill="none"/><circle cx="0" cy="-6.6" r="1.6" fill="${C.chromeShade}" stroke="${C.line}" stroke-width=".9"/></g>`;
  return s;
}
function fish(x, y, rot, len, flip = 1, tailUp = 0) {
  const s = len / 60;
  const d = `M0,0 C10,-9 30,-11 44,-6 C50,-4 54,-2 56,0 C54,2 50,4 44,6 C30,10 10,9 0,0 Z`;
  const tail = `M54,0 L${66},${-9 - tailUp} C${63},${-3} ${63},${3} ${66},${9 - tailUp * 0.3} Z`;
  return `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(rot)}) scale(${n(s * flip)} ${n(s)})">
    <path d="${tail}" fill="${C.fishBack}" stroke="${C.line}" stroke-width="${n(1.6 / s)}" stroke-linejoin="round"/>
    <path d="${d}" fill="${C.fish}"/>
    <path d="M2,-1 C12,-8 30,-10 44,-6 C50,-4 54,-2 56,0 C40,-3 20,-3 2,-1 Z" fill="${C.fishBack}"/>
    <path d="M4,2 C16,7 32,8 46,4 C34,5 18,5 4,2 Z" fill="${C.fishBelly}"/>
    <path d="M14,-4 C24,-2 36,-2 48,-3" stroke="${C.fishPink}" stroke-width="1.6" fill="none" opacity=".8"/>
    ${[18, 24, 30, 36].map(x => `<path d="M${x},-8 l2,4" stroke="#2f4f6f" stroke-width="1.1"/>`).join('')}
    <path d="M24,-7 C28,-11 34,-11 38,-7" fill="${C.fishBack}" stroke="${C.line}" stroke-width="${n(1 / s)}"/>
    <path d="${d}" fill="none" stroke="${C.line}" stroke-width="${n(1.8 / s)}" stroke-linejoin="round"/>
    <path d="M9,-3 Q12,1 9,4" stroke="${C.line}" stroke-width="${n(1 / s)}" fill="none"/>
    <circle cx="6" cy="-1.5" r="2.4" fill="#fff" stroke="${C.line}" stroke-width="${n(0.8 / s)}"/><circle cx="6.4" cy="-1.4" r="1.3" fill="#1a1418"/>
    <path d="M8,-6 C16,-8 26,-9 34,-8" stroke="#fff" stroke-width="1.4" fill="none" opacity=".85"/>
  </g>`;
}
function basket() {
  const B = BIKE.basket;
  let s = '';
  const x0 = B.x0, x1 = B.x1, y0 = B.y0, y1 = B.y1;
  // struts to the hub
  s += line(`M${pt(x0 + 12, y1)} L${pt(173, -100)}`, C.line, 3.6) + line(`M${pt(x0 + 12, y1)} L${pt(173, -100)}`, C.chromeShade, 1.8);
  s += line(`M${pt(x1 - 10, y1)} L${pt(173, -100)}`, C.line, 3.6) + line(`M${pt(x1 - 10, y1)} L${pt(173, -100)}`, C.chrome, 1.8);
  // back of the basket (inside, darker)
  s += `<path d="M${pt(x0 + 2, y0 + 2)} L${pt(x1 - 2, y0 + 2)} L${pt(x1 - 4, y0 + 12)} L${pt(x0 + 4, y0 + 12)} Z" fill="${C.basketDark}"/>`;
  // fish sticking out
  s += fish(x0 + 18, y0 + 8, -58, 58, 1, 4);
  s += fish(x0 + 58, y0 + 12, -110, 62, 1, -6);
  s += fish(x0 + 34, y0 + 4, -18, 66, 1, 2);
  // cloth liner (blue gingham) peeking out
  s += `<path d="M${pt(x0 - 2, y0 + 4)} C${pt(x0 + 10, y0 - 6)} ${pt(x0 + 22, y0 + 6)} ${pt(x0 + 30, y0 + 1)} C${pt(x0 + 40, y0 - 4)} ${pt(x1 - 20, y0 + 8)} ${pt(x1 + 2, y0 + 2)} L${pt(x1 + 1, y0 + 10)} L${pt(x0 - 1, y0 + 10)} Z" fill="#dfe8f2" stroke="${C.line}" stroke-width="1.5"/>`;
  s += `<path d="M${pt(x0 + 4, y0 + 3)} L${pt(x0 + 4, y0 + 10)} M${pt(x0 + 14, y0 + 1)} L${pt(x0 + 14, y0 + 10)} M${pt(x0 + 50, y0 + 3)} L${pt(x0 + 50, y0 + 10)} M${pt(x0 + 64, y0 + 5)} L${pt(x0 + 64, y0 + 10)}" stroke="#6f93c8" stroke-width="3" opacity=".7"/>`;
  // wicker body (slightly tapered)
  const body = `M${pt(x0, y0 + 8)} L${pt(x1, y0 + 8)} L${pt(x1 - 5, y1)} C${pt(x1 - 20, y1 + 3)} ${pt(x0 + 20, y1 + 3)} ${pt(x0 + 5, y1)} Z`;
  const id = nid('bk');
  defs.push(`<clipPath id="${id}"><path d="${body}"/></clipPath>`);
  s += `<path d="${body}" fill="${C.basket}"/>`;
  let weave = '';
  for (let r = 0; r < 8; r++) {
    const y = y0 + 12 + r * 7;
    for (let c = 0; c < 12; c++) {
      const x = x0 + (r % 2 ? 0 : 3.5) + c * 7.2;
      weave += `<ellipse cx="${n(x + 3.4)}" cy="${n(y)}" rx="3.4" ry="2.6" fill="${C.basketLit}" opacity=".9"/><path d="M${pt(x, y + 2)} Q${pt(x + 3.4, y + 3.6)} ${pt(x + 6.8, y + 2)}" stroke="${C.basketShade}" stroke-width="1" fill="none"/>`;
    }
  }
  s += `<g clip-path="url(#${id})">${weave}<path d="${body} ${shiftD(body, 6, -6)}" fill-rule="evenodd" fill="${C.basketShade}" opacity=".55"/><path d="${body} ${shiftD(body, -2.5, 2.5)}" fill-rule="evenodd" fill="#ffdc9a" opacity=".85"/></g>`;
  s += `<path d="${body}" fill="none" stroke="${C.line}" stroke-width="2.2" stroke-linejoin="round"/>`;
  // rolled rim
  s += `<rect x="${x0 - 3}" y="${y0 + 5}" width="${x1 - x0 + 6}" height="8" rx="4" fill="${C.basketLit}" stroke="${C.line}" stroke-width="2"/>`;
  for (let x = x0; x < x1; x += 6) s += `<path d="M${pt(x, y0 + 6)} l4,6" stroke="${C.basketShade}" stroke-width="1.1"/>`;
  // strap to the bar
  s += `<rect x="${x0 - 3}" y="${y0 + 4}" width="7" height="12" rx="1.5" fill="#6a3f2a" stroke="${C.line}" stroke-width="1.2"/>`;
  return s;
}
function chainring() {
  const Rp = BIKE.ringR, Rt = BIKE.ringTip;
  let teeth = 'M';
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * 2 * Math.PI, da = 2 * Math.PI / 48;
    const p = (r, aa) => pt(Math.cos(aa) * r, Math.sin(aa) * r);
    teeth += `${i ? ' L' : ''}${p(Rp - 1.4, a - da * 0.5)} L${p(Rt, a - da * 0.18)} L${p(Rt, a + da * 0.18)}`;
  }
  teeth += ' Z';
  let s = `<path d="${teeth}" fill="${C.chromeShade}" stroke="${C.line}" stroke-width="1.6" stroke-linejoin="round"/>`;
  s += `<circle r="${Rp - 3}" fill="${C.chrome}"/>`;
  s += `<circle r="${Rp - 7.5}" fill="#6a6f78"/>`;
  // 5-arm spider
  for (let i = 0; i < 5; i++) s += `<g transform="rotate(${i * 72 + 18})"><path d="M0,-3.6 L${Rp - 5},-4.6 L${Rp - 5},4.6 L0,3.6 Z" fill="${C.chrome}" stroke="${C.line}" stroke-width="1"/><circle cx="${Rp - 6}" cy="0" r="1.6" fill="${C.chromeDark}"/></g>`;
  s += `<path d="M${pt(Math.cos(-2.3) * (Rp - 3), Math.sin(-2.3) * (Rp - 3))} A${Rp - 3},${Rp - 3} 0 0 1 ${pt(Math.cos(-0.1) * (Rp - 3), Math.sin(-0.1) * (Rp - 3))}" stroke="#fff" stroke-width="1.4" fill="none"/>`;
  s += `<circle r="7" fill="${C.chrome}" stroke="${C.line}" stroke-width="1.4"/>`;
  return s;
}
function cog() {
  let t = 'M';
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * 2 * Math.PI, da = 2 * Math.PI / 16;
    const p = (r, aa) => pt(Math.cos(aa) * r, Math.sin(aa) * r);
    t += `${i ? ' L' : ''}${p(BIKE.cogR - 1.2, a - da * 0.5)} L${p(BIKE.cogTip, a - da * 0.15)} L${p(BIKE.cogTip, a + da * 0.15)}`;
  }
  return `<path d="${t} Z" fill="${C.chromeShade}" stroke="${C.line}" stroke-width="1.2"/><circle r="6.5" fill="${C.chrome}"/>`;
}
function chain() {
  return `<path d="${CHAIN_D}" fill="none" stroke="${C.line}" stroke-width="4.6" stroke-linejoin="round"/>
    <path d="${CHAIN_D}" pathLength="100" fill="none" stroke="${C.chain}" stroke-width="3" stroke-dasharray="1.1 0.9"/>
    <path d="${CHAIN_D}" pathLength="100" fill="none" stroke="#c9c6cf" stroke-width="1.4" stroke-dasharray="0.3 3.7"/>`;
}
function crank(far) {
  const col = far ? C.chromeShade : C.chrome;
  let s = `<path d="M-2,-5.4 L50,-3.8 C55,-3.8 55,3.8 50,3.8 L-2,5.4 C-8,5.4 -8,-5.4 -2,-5.4 Z" fill="${col}" stroke="${C.line}" stroke-width="1.8"/>`;
  if (!far) s += `<path d="M2,-3.2 L48,-2.2" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>`;
  s += `<circle cx="50" cy="0" r="3" fill="${far ? C.chromeDark : C.chromeShade}" stroke="${C.line}" stroke-width="1"/>`;
  if (!far) s += `<circle r="4.6" fill="${C.chromeShade}" stroke="${C.line}" stroke-width="1.2"/>`;
  return s;
}
function pedal(far) {
  const b = far ? '#2c272c' : C.rubber, cap = far ? '#5a5258' : '#8a7f84';
  return `<rect x="-15" y="-3.6" width="30" height="7.2" rx="2" fill="${b}" stroke="${C.line}" stroke-width="1.6"/>
    <rect x="-15" y="-3.6" width="30" height="2.2" rx="1" fill="${cap}"/>
    <rect x="-17" y="-2" width="3" height="4" fill="${far ? C.chromeDark : C.chrome}" stroke="${C.line}" stroke-width=".8"/><rect x="14" y="-2" width="3" height="4" fill="${far ? C.chromeDark : C.chrome}" stroke="${C.line}" stroke-width=".8"/>`;
}

// ---- pelican
const P = (far) => far
  ? { base: C.plFar, shade: C.plFarShade, rim: '#e8b98a', line: C.lineFar, tex: C.plFarShade }
  : { base: C.pl, shade: C.plShade, rim: C.plRim, line: C.line, tex: C.plShade };
const scallops = (pts, r, col, w = 1.1) => pts.map(([x, y]) => `<path d="M${pt(x - r, y)} Q${pt(x, y + r * 0.95)} ${pt(x + r, y)}" stroke="${col}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`).join('');

function neckOutline(nk) {
  const B = t => {
    const u = 1 - t;
    return [u * u * u * nk.p0[0] + 3 * u * u * t * nk.p1[0] + 3 * u * t * t * nk.p2[0] + t * t * t * nk.p3[0],
            u * u * u * nk.p0[1] + 3 * u * u * t * nk.p1[1] + 3 * u * t * t * nk.p2[1] + t * t * t * nk.p3[1]];
  };
  const N = 12, L = [], Rr = [], mid = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = B(Math.max(0, t - 0.01)), b = B(Math.min(1, t + 0.01));
    const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty);
    const nx = -ty / l, ny = tx / l;                   // right-hand normal (front of the neck)
    const w = lerp(nk.w0, nk.w1, t) / 2 * (1 + 0.08 * Math.sin(t * Math.PI));
    const c = B(t);
    mid.push({ c, nx, ny, tx: tx / l, ty: ty / l, w });
    Rr.push([c[0] + nx * w, c[1] + ny * w]);
    L.push([c[0] - nx * w * (1 + 0.1 * Math.sin(t * Math.PI * 0.9) ** 4), c[1] - ny * w * (1 + 0.1 * Math.sin(t * Math.PI * 0.9) ** 4)]);
  }
  return { front: Rr, back: L, mid, B };
}
function neckArt() {
  const nk = { ...pose.neck, w0: 44, w1: 30 };
  const o = neckOutline(nk);
  const d = smooth([...o.front, ...[...o.back].reverse()], true, 0.9);
  let tex = '';
  for (let i = 3; i < 11; i += 1) {
    const m = o.mid[i];
    const a = [m.c[0] - m.nx * m.w * 0.55, m.c[1] - m.ny * m.w * 0.55];
    tex += `<path d="M${pt(...a)} q${n(m.tx * 5 + m.nx * 3)},${n(m.ty * 5 + m.ny * 3)} ${n(m.tx * 9 + m.nx * 1)},${n(m.ty * 9 + m.ny * 1)}" stroke="${C.plShade}" stroke-width="1.1" fill="none"/>`;
  }
  // soft yellow breeding flush on the fore-neck base
  const blush = `<path d="${smooth([o.front[0], o.front[2], o.front[4], o.mid[4].c, o.mid[1].c], true, 0.8)}" fill="#fbe0a6" opacity=".6"/>`;
  // shadow under the jaw/pouch on the upper neck
  const m9 = o.mid[9], m12 = o.mid[12];
  const inset = i => [o.mid[i].c[0] + o.mid[i].nx * o.mid[i].w * 0.25, o.mid[i].c[1] + o.mid[i].ny * o.mid[i].w * 0.25];
  const jaw = `<path d="${smooth([o.front[8], o.front[10], [o.front[12][0] + 3, o.front[12][1] + 2], inset(12), inset(11), inset(10)], true, 0.9)}" fill="${C.plShade}" opacity=".85"/>`;
  return {
    svg: cel(d, { base: C.pl, shade: C.plShade, rim: C.plRim, sh: 9, rimW: 4, inner: blush + jaw + tex, lw: 0 })
      + line(smooth(o.front, false, 0.9), C.line, 2.5) + line(smooth(o.back, false, 0.9), C.line, 2.5),
    o,
  };
}
function bodyArt() {
  // pelvis-local; ellipse ref: centre (32,-50) rx98 ry58 rot -18, bottom at y≈13
  const d = 'M130,-88 C145,-64 138,-28 108,-8 C82,9 42,16 2,14 C-28,12 -52,2 -66,-14 C-76,-26 -74,-40 -62,-52 C-40,-76 0,-100 44,-108 C70,-112 92,-110 104,-100 C114,-96 122,-92 130,-88 Z';
  const outline = 'M133,-82 C144,-60 136,-26 108,-8 C82,9 42,16 2,14 C-28,12 -52,2 -66,-14 C-76,-26 -74,-40 -62,-52 C-40,-76 0,-100 44,-108 C62,-111 78,-110 90,-106';
  const belly = 'M-72,-24 C-50,-2 -10,6 40,5 C84,4 114,-6 136,-44 C140,-22 128,-6 108,-8 C82,9 42,16 2,14 C-28,12 -52,2 -66,-14 Z';
  const wingCast = 'M50,-86 C70,-66 84,-34 88,2 L66,12 C58,-22 46,-54 32,-82 Z';
  // back scapulars + flank feathering
  const tex = scallops([[-40, -62], [-22, -74], [-4, -84], [14, -92], [32, -98], [-52, -44], [-34, -52], [-16, -62], [2, -72], [-44, -26], [-26, -34]], 10, C.plShade, 1.2)
    + [[118, -44], [110, -30], [100, -18], [124, -58]].map(([x, y]) => `<path d="M${pt(x, y)} q-6,6 -12,4" stroke="${C.plShade}" stroke-width="1.2" fill="none"/>`).join('');
  const breastBlush = `<path d="M104,-94 C124,-80 132,-60 128,-40 C116,-50 106,-70 94,-88 Z" fill="#fde0a2" opacity=".35"/>`;
  return cel(d, {
    base: C.pl, shade: C.plShade, rim: C.plRim, sh: 12, rimW: 3.2,
    inner: breastBlush + `<path d="${belly}" fill="${C.plShade}"/><path d="${wingCast}" fill="${C.plShade}" opacity=".85"/>` + tex,
    outline, lw: 2.6,
  });
}
function tailArt() {
  const d = 'M8,-10 C-10,-19 -34,-21 -54,-13 Q-63,-9 -58,-4 Q-66,0 -58,4 Q-62,10 -50,8 C-40,13 -24,13 -12,12 C0,12 8,6 8,-10 Z';
  const tex = line('M-44,-7 Q-26,-5 -8,-3', C.plShade, 1.2) + line('M-44,2 Q-26,3 -8,4', C.plShade, 1.1);
  return cel(d, { base: C.pl, shade: C.plShade, rim: C.plRim, rot: J.tail.rot, sh: 6, rimW: 3, inner: tex });
}
function thighArt(far) {
  const p = P(far);
  const rot = J[far ? 'thighFar' : 'thighNear'].rot;
  const orange = far ? C.footFar : C.foot;
  let s = '';
  // bare orange lower thigh + knee
  s += cel('M60,-9.5 L138,-8.6 C146,-8.8 151,-4 151,0 C151,5 146,9 138,9 L60,10.5 Z', { base: orange, shade: far ? C.footFarShade : C.footShade, rim: far ? '#d98a50' : C.footLit, rot, sh: 5, rimW: 2.4, line: p.line, lw: 2.2 });
  for (let x = 96; x < 138; x += 10) s += `<path d="M${x},-7 q-2.2,7 0,14" stroke="${far ? C.footFarShade : C.footShade}" stroke-width="1" fill="none" opacity=".7"/>`;
  s += `<path d="M140,-6.6 C145,-6 148,-3.6 149,-1" stroke="${far ? '#d98a50' : C.footLit}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  // feathered drumstick with a shaggy fringe
  const d = 'M-14,-17 C18,-21 56,-18 82,-12 Q90,-10 88,-6 L97,-3.5 L88,-0.5 L96,3.5 L86,5.5 L91,10 L78,11 C54,15 18,19 -12,18 C-24,10 -24,-10 -14,-17 Z';
  const tex = line('M22,-4 q10,5 22,4', p.tex, 1.2) + line('M48,-8 q10,5 20,4', p.tex, 1.2) + line('M56,4 q8,3 16,1', p.tex, 1.2);
  const outline = 'M4,-18.8 C30,-20.2 60,-17 82,-12 Q90,-10 88,-6 L97,-3.5 L88,-0.5 L96,3.5 L86,5.5 L91,10 L78,11 C54,15 26,18.4 4,18.4';
  s += cel(d, { base: p.base, shade: p.shade, rim: p.rim, rot, sh: 9, rimW: 3.4, inner: tex, line: p.line, outline });
  return s;
}
function shankArt(far) {
  const rot = J[far ? 'shankFar' : 'shankNear'].rot;
  const col = far ? C.footFar : C.foot, sh = far ? C.footFarShade : C.footShade, lit = far ? '#d98a50' : C.footLit;
  const d = 'M0,-7 C40,-6.2 90,-5.2 134,-4.8 C139,-4 139,4.6 134,4.8 C90,5.2 40,6.2 0,7 C-6,6 -6,-6 0,-7 Z';
  let tex = '';
  for (let x = 12; x < 130; x += 9) tex += `<path d="M${x},-5.4 q-2.4,5.4 0,10.8" stroke="${sh}" stroke-width="1" fill="none" opacity=".7"/>`;
  return cel(d, { base: col, shade: sh, rim: lit, rot, sh: 4.4, rimW: 2, inner: tex, line: far ? C.lineFar : C.line, lw: 2.3 });
}
function footArt(far) {
  return `<g transform="translate(17 9) scale(1.14) translate(-17 -9)">${footArt0(far)}</g>`;
}
function footArt0(far) {
  const rot = J[far ? 'footFar' : 'footNear'].rot;
  const col = far ? C.footFar : C.foot, web = far ? C.webFar : '#f8b070', sh = far ? C.footFarShade : C.footShade;
  const L = far ? C.lineFar : C.line;
  let s = '';
  // big webbed foot: sole on the pedal top (y≈6), toes drape over the pedal nose, web scallops between the toe tips
  const webD = 'M-7,-4 C4,-8 18,-5 30,-1 C38,1 45,3 50,6.5 C51,8.6 49,10 47,9.6 C44,9.6 42,10.6 43,12.6 C44.6,14 46,15.4 45.6,17 C44,18.4 41.6,18 40.4,17 C38.6,16 37,17 37.4,19 C38,20.6 37,22.4 35,22 C32.4,21.4 30.6,19 29.6,16 C23,10 10,7.4 -3,7.4 C-10,7 -12,-1.4 -7,-4 Z';
  s += cel(webD, { base: web, shade: far ? C.footFarShade : '#e0864a', rim: far ? '#d98a50' : '#ffd08e', rot, sh: 4, rimW: 1.8, line: L, lw: 2.3 });
  // toes with knuckles
  const toes = ['M10,0 C24,1 38,3.4 49.4,7.4', 'M10,2.2 C22,5 34,10 45,16', 'M9,4.4 C18,8 28,14 35.6,21'];
  for (const d of toes) s += line(d, L, 4.6) + line(d, col, 2.8);
  for (const [x, y] of [[26, 2.2], [38, 4.6], [24, 6.2], [34, 11], [20, 8.4], [28, 14.6]]) s += `<circle cx="${x}" cy="${y}" r=".9" fill="${sh}"/>`;
  for (const [x, y, r] of [[49.6, 7.4, 14], [45.2, 16.2, 38], [35.8, 21.2, 62]]) s += `<path d="M${x},${y} c2.4,.4 3.6,1.6 3.4,3 c-1.2,-.8 -2.4,-1 -3.6,-.8 Z" transform="rotate(${r - 14} ${x} ${y})" fill="${C.claw}"/>`;
  // ankle knuckle + heel pad
  s += `<circle cx="0" cy="0.6" r="7.2" fill="${col}" stroke="${L}" stroke-width="2.1"/><path d="M-3.6,-3.6 A5.4,5.4 0 0 1 5,-2.6" stroke="${far ? '#d98a50' : C.footLit}" stroke-width="1.8" fill="none"/>`;
  s += `<path d="M-7,4 C-9,6 -8,8.4 -4,8.2" stroke="${L}" stroke-width="1.6" fill="${col}"/>`;
  return s;
}
function wingUpperArt(far) {
  const p = P(far);
  const rot = J[far ? 'wingFarUpper' : 'wingNearUpper'].rot;
  // shoulder (0,0) -> elbow (78,0); -y = leading edge (front), +y = trailing (back)
  const d = 'M-18,-4 C-18,-18 0,-22 22,-18 C46,-14 68,-12 84,-9 C92,-6 93,5 85,9 Q82,15 74,13 Q72,21 62,18 Q60,27 49,22 Q45,31 34,24 Q28,31 19,24 Q11,29 4,21 Q-8,22 -14,12 C-19,6 -19,0 -18,-4 Z';
  const outline = 'M6.5,-19.6 C12,-19.4 17,-18.8 22,-18 C46,-14 68,-12 84,-9 C92,-6 93,5 85,9 Q82,15 74,13 Q72,21 62,18 Q60,27 49,22 Q45,31 34,24 Q28,31 19,24 Q11,29 4,21';
  const tex = scallops([[14, -10], [28, -9], [42, -8], [56, -7], [70, -5], [20, 0], [34, 1], [48, 2], [62, 2]], 7, p.tex, 1.1)
    + [[22, 10], [36, 14], [50, 12], [64, 8]].map(([x, y]) => `<path d="M${x},${y} q5,4 3,10" stroke="${p.tex}" stroke-width="1.2" fill="none"/>`).join('');
  const taper = `<path d="M4,-19.9 C11,-20 17,-19.4 23,-19.3 L22.4,-16.9 C16,-17.8 10,-18.8 4,-19.9 Z" fill="${p.line}"/>`;
  return cel(d, { base: p.base, shade: p.shade, rim: p.rim, rot, sh: 10, rimW: 3.6, inner: tex, line: p.line, outline: outline.replace('M6.5,-19.6 C12,-19.4 17,-18.8 22,-18', 'M22,-18') }) + taper;
}
function wingLowerArt(far) {
  const p = P(far);
  const rot = J[far ? 'wingFarLower' : 'wingNearLower'].rot;
  const blk = far ? C.primFar : C.prim;
  let s = '';
  // black secondaries hanging along the trailing edge (+y = down here), pointed tips
  const sec = 'M-6,2 L78,2 C81,8 80,14 74,16 C70,19 65,19 63,16 C60,22 53,23 50,19 C46,25 39,25 36,20 C32,25 25,25 22,20 C18,24 11,23 9,18 C5,21 -1,20 -3,15 C-8,14 -9,8 -6,2 Z';
  const secTex = [[9, 7], [22, 8], [36, 8], [50, 8], [63, 7]].map(([x, y]) => `<path d="M${x},${y} L${x + 1},${y + 9}" stroke="${far ? '#2a2530' : C.primSheen}" stroke-width="1.4"/>`).join('');
  s += cel(sec, { base: blk, shade: far ? '#0b0a0f' : '#121015', rim: far ? '#4a3a44' : C.primRim, rot, sh: 4, rimW: 1.8, inner: secTex, line: p.line, lw: 2.2 });
  // white coverts on top with a row of greater-covert scallops
  const cov = 'M-10,-11 C16,-14 50,-11 76,-8 C84,-6 84,5 77,7 Q70,11 63,7 Q56,12 49,7 Q42,12 35,7 Q28,12 21,7 Q14,12 7,7 Q0,10 -8,7 C-14,2 -14,-6 -10,-11 Z';
  const covTex = scallops([[10, -4], [22, -4], [34, -4], [46, -3.5], [58, -3], [70, -2]], 5.5, p.tex, 1.05);
  s += cel(cov, { base: p.base, shade: p.shade, rim: p.rim, rot, sh: 6, rimW: 3, inner: covTex, line: p.line });
  return s;
}
function wingHandArt(far) {
  const p = P(far);
  const rot = J[far ? 'wingFarHand' : 'wingNearHand'].rot;
  const blk = far ? C.primFar : C.prim;
  const sheen = far ? '#2a2530' : C.primSheen;
  let s = '';
  // four long primaries flaring forward past the bar like fingertips
  const prims = [
    'M-2,-11 C14,-15 34,-14 52,-8 C55,-6.6 54,-4 51,-4.4 C34,-6 16,-6 0,-4 Z',
    'M-2,-7 C14,-8 32,-4 48,3 C50.6,4.4 49,7 46.4,6 C30,1.6 14,-1 -1,-1 Z',
    'M-3,-3 C10,-2 25,3.6 38,11.4 C40,13 38,15.6 35.6,14.2 C24,8 11,4 -2,3 Z',
    'M-4,1 C6,3 16,8 25,15.6 C26.6,17.4 24.4,19.6 22.6,18 C15,12 6,8 -3,6 Z',
  ];
  for (const d of prims) s += cel(d, { base: blk, shade: '#0c0a0f', rim: far ? '#4a3a44' : C.primRim, rot, sh: 2.6, rimW: 1.6, line: p.line, lw: 1.9 });
  s += line('M4,-9.6 C20,-11.6 36,-10.4 50,-6.2', sheen, 1.2) + line('M4,-4.8 C18,-4.4 32,-0.8 46,4.6', sheen, 1.2) + line('M2,-0.4 C12,1 24,6 36,12.4', sheen, 1.1);
  // curled 'fist' of feathers wrapped over the grip (r=6 at origin)
  const fist = 'M-15,-4 C-15,-13 -4,-16 4,-14 C12,-12 16,-5.4 15,2 C14,8.4 9.6,11.4 4.4,10.6 C1.4,10 0,8.4 1,6.2 C-4,8.4 -10.6,7.4 -13.6,3.4 C-15,1.4 -15,-1.6 -15,-4 Z';
  s += cel(fist, { base: blk, shade: '#0c0a0f', rim: far ? '#4a3a44' : C.primRim, rot, sh: 3.6, rimW: 2, line: p.line, lw: 2.3 });
  s += `<path d="M-9,-10 C-3,-12.4 6,-11.4 10.6,-6.8" stroke="${sheen}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
  // white carpal coverts where the forearm meets the hand
  s += cel('M-20,-10 C-15,-15.6 -6,-15.4 -4,-10 C-2.6,-4.4 -8,0 -14.6,0 C-20,-1 -22,-6.4 -20,-10 Z', { base: p.base, shade: p.shade, rim: p.rim, rot, sh: 3, rimW: 2, line: p.line, lw: 1.9 });
  return s;
}
function headArt() {
  // head-local: skull centre (0,0) r≈26; bill base/gape at (16,2)
  const d = 'M-8,25 C-26,23 -33,8 -31,-7 C-29,-23 -15,-31 2,-30 C15,-29 24,-22 28.6,-15 L42,-13.2 C34,-8.4 27,-3.4 21,2 C19,9 14,17 8,22 C4,25 -2,26 -8,25 Z';
  const tex = line('M-24,8 q6,4 12,2', C.plShade, 1.2) + line('M-20,16 q6,3 12,0', C.plShade, 1.2) + line('M-26,-4 q5,3 10,2', C.plShade, 1.1);
  // bare facial skin around the eye, running forward to the bill base
  const skin = `<path d="M-7,-8 C-7,-17 4,-20.4 12.4,-17.4 C20.6,-15.4 30,-14.2 38,-13 L23,-4 C15,0 4,1.4 -2.4,-1 C-6,-3 -7.6,-5.4 -7,-8 Z" fill="${C.skin}"/>`
    + `<path d="M4,-18 C12,-18 23,-15.4 36,-13.4 L29.4,-11.6 C21,-12.6 11,-14.6 4,-18 Z" fill="${C.skinLit}"/>`;
  const cheek = `<ellipse cx="3" cy="7" rx="7.4" ry="4.2" fill="#ffab9c" opacity=".5"/>`;
  // content little smile at the gape
  const smile = line('M22,1.6 C18,4.4 13.4,4.4 10.6,1.2', C.line, 1.8);
  return cel(d, { base: C.pl, shade: C.plShade, rim: C.plRim, sh: 8, rimW: 3.6, inner: skin + cheek + tex, lw: 2.5 }) + smile;
}
function eyeArt() {
  return `<ellipse cx="0" cy="0" rx="6.8" ry="7.2" fill="#fff6f0" stroke="${C.line}" stroke-width="1.5"/>
    <circle cx="1.4" cy="0.6" r="5.4" fill="${C.iris}"/><circle cx="1.4" cy="0.8" r="2.4" fill="#e0603f" opacity=".6"/><circle cx="1.8" cy="0.8" r="3.1" fill="${C.pupil}"/>
    <circle cx="3.4" cy="-1.8" r="1.9" fill="#fff"/><circle cx="-0.8" cy="3.2" r=".9" fill="#ffd9c8"/>
    <path d="M-7.8,-1.6 C-6,-8.4 4.4,-9.6 8.6,-3" stroke="${C.line}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <path d="M-7.6,-2.4 l-2.6,-1.4" stroke="${C.line}" stroke-width="1.6" stroke-linecap="round"/>`;
}
function crestArt() {
  // crest-local: +x points back (rest rot 200°); soft wind-combed plumes curling at the tips
  const tufts = [
    'M-2,-5 C10,-12 24,-15 38,-14 C42,-14 44,-11 41,-10 C30,-9 18,-5 8,1 Z',
    'M-2,-2 C12,-5 28,-4 44,0 C47,1 47,4 44,4 C30,3 18,3 6,5 Z',
    'M-2,1 C9,3 22,7 34,14 C36,15.4 35,17.6 32.6,16.6 C22,12 12,10 3,8 Z',
    'M0,4 C8,8 16,13 22,21 C23,23 21,24.4 19.4,23 C14,17 8,14 2,11 Z',
    'M-2,-7 C4,-14 13,-19 24,-22 C26.6,-22.4 27,-20 25,-19 C18,-15 12,-10 7,-4 Z',
  ];
  let s = '';
  for (const d of tufts) s += cel(d, { base: C.pl, shade: C.plShade, rim: C.plRim, rot: J.crest.rot, sh: 3.4, rimW: 1.8, lw: 1.8 });
  return s;
}
function billUpperArt() {
  const rot = J.billUpper.rot;
  // culmen from the forehead to the hooked nail; tomium along y≈2
  const d = 'M-2,-15 C30,-12.6 80,-8 116,-5 C124,-4.6 130,-2.6 131,1.6 C131.6,5.4 128.8,8.2 125.8,7.2 C125.4,5.2 124,3.6 120,3 L60,2.6 C34,2.6 12,3 -2,4 Z';
  const ridge = line('M4,-10 C36,-8 82,-5 118,-2.5', C.billShade, 1.4) + `<path d="M6,-13.6 C40,-11 84,-7 116,-4.8 C84,-6 44,-9 6,-11 Z" fill="${C.billLit}" opacity=".9"/>`;
  const nail = `<path d="M118,-4.4 C124,-4.4 130,-2.4 131,1.6 C131.6,5.4 128.8,8.2 125.8,7.2 C125.4,5.2 124,3.6 120,3 C121,0 120,-2 118,-4.4 Z" fill="${C.nail}"/>`;
  const mottle = [[30, -4], [46, -3], [62, -2.2], [76, -1.6], [90, -1]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3" ry="1.1" fill="${C.billShade}" opacity=".35"/>`).join('');
  return cel(d, { base: C.bill, shade: C.billShade, rim: '#ffe2c4', rot, sh: 4, rimW: 1.8, inner: ridge + mottle + nail, lw: 2.3 })
    + line('M4,3.4 C40,2.6 90,2.6 120,3', C.billEdge, 1.2);
}
function billLowerArt() {
  const rot = J.billLower.rot;
  const d = 'M0,-1 C40,-2 90,-2 122,-1 C125,0 125,3 122,3.2 C90,4 40,5 0,5 Z';
  return cel(d, { base: '#f09a7c', shade: C.billShade, rim: C.billLit, rot, sh: 2, rimW: 1, lw: 2 });
}
function pouchArt() {
  const rot = J.pouch.rot;
  // hangs from the lower bill (+y), deepest ~34 at x≈40, tucks back under the throat
  const d = 'M-18,-2 C-20,12 -12,26 6,31 C26,36 52,32 76,20 C92,12 102,5 112,-3 L0,-4 Z';
  const id = nid('pg');
  defs.push(`<linearGradient id="${id}" x1="0" y1="-4" x2="0" y2="34" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${C.pouch}"/><stop offset="1" stop-color="${C.pouch2}"/></linearGradient>`);
  const shine = `<path d="M4,10 C18,15 36,15 54,10" stroke="#fff6d0" stroke-width="3" fill="none" stroke-linecap="round" opacity=".85"/><path d="M62,8 C68,7 74,5 78,3" stroke="#fff6d0" stroke-width="2" fill="none" stroke-linecap="round" opacity=".7"/>`;
  const veins = line('M-6,6 C10,14 30,18 50,16', C.pouchShade, 1, 'opacity=".5"') + line('M20,24 C40,24 60,18 80,10', C.pouchShade, 1, 'opacity=".5"');
  return cel(d, { base: `url(#${id})`, shade: C.pouchShade, rim: C.pouchLit, rot, sh: 7, rimW: 2.4, inner: veins + shine, lw: 2.3 });
}
// scarf: wrap around the neck + two fluttering tails (drawn over the body, under the near wing)
function scarfArt(neck) {
  const o = neck.o;
  const i0 = 2, i1 = 4;
  const m0 = o.mid[i0], m1 = o.mid[i1];
  const e = 3.2;
  const f0 = [m0.c[0] + m0.nx * (m0.w + e), m0.c[1] + m0.ny * (m0.w + e)], b0 = [m0.c[0] - m0.nx * (m0.w + e), m0.c[1] - m0.ny * (m0.w + e)];
  const f1 = [m1.c[0] + m1.nx * (m1.w + e), m1.c[1] + m1.ny * (m1.w + e)], b1 = [m1.c[0] - m1.nx * (m1.w + e), m1.c[1] - m1.ny * (m1.w + e)];
  const mm = o.mid[3];
  const wrap = `M${pt(...b0)} Q${pt(mm.c[0] + mm.tx * -8 + mm.nx * 2, mm.c[1] + mm.ty * -8 + mm.ny * 2)} ${pt(...f0)} L${pt(...f1)} Q${pt(mm.c[0] + mm.tx * 7, mm.c[1] + mm.ty * 7)} ${pt(...b1)} Z`;
  let s = '';
  // tails from the back of the neck
  const knot = [(b0[0] + b1[0]) / 2 - 2, (b0[1] + b1[1]) / 2 + 2];
  const ribbon = (pts, w0, w1, stripeEvery) => {
    const Ls = [], Rs = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty);
      const nx = -ty / l, ny = tx / l;
      const t = i / (pts.length - 1);
      const w = lerp(w0, w1, t) * (0.62 + 0.38 * Math.abs(Math.cos(t * 4.6 + 0.5)));
      Ls.push([pts[i][0] + nx * w / 2, pts[i][1] + ny * w / 2]);
      Rs.push([pts[i][0] - nx * w / 2, pts[i][1] - ny * w / 2]);
    }
    const d = smooth([...Ls, ...[...Rs].reverse()], true, 0.8);
    let st = '';
    for (let i = 1; i < pts.length - 1; i += stripeEvery) {
      const j = Math.min(pts.length - 1, i + 1);
      st += `<path d="M${pt(...Ls[i])} L${pt(...Ls[j])} L${pt(...Rs[j])} L${pt(...Rs[i])} Z" fill="${C.scarfStripe}"/>`;
    }
    // fringe
    const eL = Ls[Ls.length - 1], eR = Rs[Rs.length - 1], last = pts[pts.length - 1], prev = pts[pts.length - 2];
    const dx = (last[0] - prev[0]), dy = (last[1] - prev[1]), l = Math.hypot(dx, dy);
    let fr = '';
    for (let k = 0; k <= 4; k++) {
      const q = [lerp(eL[0], eR[0], k / 4), lerp(eL[1], eR[1], k / 4)];
      fr += line(`M${pt(...q)} l${n(dx / l * 8 + (k - 2))},${n(dy / l * 8 + (k % 2) * 2)}`, C.scarf, 2);
    }
    return fr + cel(d, { base: C.scarf, shade: C.scarfShade, rim: C.scarfLit, sh: 4, rimW: 2, inner: st, lw: 2.1 });
  };
  const flutter = (len, droop, amp, ph, N = 14) => Array.from({ length: N + 1 }, (_, i) => { const t = i / N; return [knot[0] - len * t, knot[1] + droop * t * t + amp * Math.sin(t * Math.PI * 2.2 + ph) * t]; });
  const tail1 = flutter(132, -22, 9, 0.3);
  const tail2 = flutter(92, 6, 7, 2.1, 11);
  s += ribbon(tail2, 14, 11, 3);
  s += ribbon(tail1, 16, 12, 3);
  // wrap band with knitted ribs
  let ribs = '';
  for (let k = 1; k < 6; k++) {
    const u = k / 6;
    const a = [lerp(b0[0], f0[0], u), lerp(b0[1], f0[1], u)], b = [lerp(b1[0], f1[0], u), lerp(b1[1], f1[1], u)];
    ribs += line(`M${pt(...a)} L${pt(...b)}`, C.scarfShade, 1, 'opacity=".6"');
  }
  const stripe = `<path d="M${pt(lerp(b0[0], b1[0], .4), lerp(b0[1], b1[1], .4))} L${pt(lerp(f0[0], f1[0], .4), lerp(f0[1], f1[1], .4))} L${pt(lerp(f0[0], f1[0], .62), lerp(f0[1], f1[1], .62))} L${pt(lerp(b0[0], b1[0], .62), lerp(b0[1], b1[1], .62))} Z" fill="${C.scarfStripe}"/>`;
  s += cel(wrap, { base: C.scarf, shade: C.scarfShade, rim: C.scarfLit, sh: 5, rimW: 2.2, inner: stripe + ribs, lw: 2.3 });
  // knot
  s += cel(`M${pt(knot[0] - 8, knot[1] - 6)} C${pt(knot[0] - 2, knot[1] - 12)} ${pt(knot[0] + 8, knot[1] - 8)} ${pt(knot[0] + 7, knot[1])} C${pt(knot[0] + 6, knot[1] + 8)} ${pt(knot[0] - 6, knot[1] + 8)} ${pt(knot[0] - 9, knot[1] + 2)} Z`, { base: C.scarf, shade: C.scarfShade, rim: C.scarfLit, sh: 4, rimW: 2, lw: 2.2 });
  return s;
}

function rider() {
  const neck = neckArt();
  const S = {
    wingFarUpper: wingUpperArt(true), wingFarLower: wingLowerArt(true), wingFarHand: wingHandArt(true),
    pedalFar: pedal(true), footFar: footArt(true), shankFar: shankArt(true), thighFar: thighArt(true), crankFar: crank(true),
    wheelRear: wheel(), wheelFront: wheel(), frame: frame(), fork: fork(), bars: bars(), cog: cog(), chain: chain(), chainring: chainring(), crankNear: crank(false),
    neck: neck.svg, tail: tailArt(), body: bodyArt(),
    pedalNear: pedal(false), shankNear: shankArt(false), footNear: footArt(false), thighNear: thighArt(false),
    pouch: pouchArt(), billLower: billLowerArt(), billUpper: billUpperArt(), head: headArt(), eye: eyeArt(), crest: crestArt(),
    wingNearUpper: wingUpperArt(false), wingNearLower: wingLowerArt(false), wingNearHand: wingHandArt(false),
  };
  const order = ['wingFarUpper', 'wingFarLower', 'wingFarHand', 'pedalFar', 'footFar', 'shankFar', 'thighFar', 'crankFar',
    'wheelRear', 'wheelFront', 'frame', 'fork', 'bars', 'cog', 'chain', 'chainring', 'crankNear',
    'neck', 'tail', 'body', 'pedalNear', 'shankNear', 'footNear', 'thighNear',
    'pouch', 'billLower', 'billUpper', 'head', 'eye', 'crest', 'wingNearUpper', 'wingNearLower', 'wingNearHand'];
  let s = '';
  for (const k of order) {
    s += slot(k, S[k]);
    if (k === 'wheelRear') s += `<g transform="translate(${BIKE.rearHub[0]} ${BIKE.rearHub[1]})">${tyreRim()}</g>`;
    if (k === 'wheelFront') s += `<g transform="translate(${BIKE.frontHub[0]} ${BIKE.frontHub[1]})">${tyreRim()}</g>`;
    if (k === 'body') s += `<g id="pb-scarf">${scarfArt(neck)}</g>`;
  }
  // sun glints on chrome and on the wet bill tip
  const glint = (x, y, r) => `<path d="M${x},${y - r} Q${x + r * .16},${y - r * .16} ${x + r},${y} Q${x + r * .16},${y + r * .16} ${x},${y + r} Q${x - r * .16},${y + r * .16} ${x - r},${y} Q${x - r * .16},${y - r * .16} ${x},${y - r} Z" fill="#fffbe8"/>`;
  s += `<g id="pb-glints">${glint(134, -293, 7)}${glint(153, -229, 6)}${glint(173 + 62, -100 - 62, 6)}${glint(-125 + 62, -100 - 62, 5)}${glint(262, -492, 4.5)}</g>`;
  return s;
}

// ================================================================ assemble
function build(viewBox, w, h) {
  defs.length = 0; uid = 0;
  const layers = [
    ['L-sky', sky()], ['L-sunmoon', sun()], ['L-clouds', clouds()], ['L-hills-far', farHills()], ['L-sea', sea()],
    ['L-gulls-far', gulls()], ['L-atmo', atmo()], ['L-shore', beach()], ['L-roadside', verge()], ['L-road', road()],
    ['L-fx-back', sunHaze()], ['L-shadow', riderShadow()],
    ['L-rider', `<g transform="translate(680 790)">${rider()}</g>`],
    ['L-fx-front', motes()], ['L-foreground', foreground()],
  ];
  const body = layers.map(([id, m]) => `<g id="${id}">${m}</g>`).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${w}" height="${h}">
<title>Pelican Bay · 鹈鹕湾 — style D (anime warm-light scenery)</title>
<defs>${defs.join('\n')}</defs>
${body}
</svg>`;
}
fs.writeFileSync(path.join(HERE, 'keyframe.svg'), build('0 0 1600 900', 1600, 900));
fs.writeFileSync(path.join(HERE, 'closeup.svg'), build('440 220 560 580', 1120, 1160));
console.log('ok', fs.statSync(path.join(HERE, 'keyframe.svg')).size, 'bytes');
