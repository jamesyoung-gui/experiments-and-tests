// Pelican Bay -- style A (flat geometric vector) keyframe generator.
// node gen.mjs  -> keyframe.svg + closeup.svg (same art, tighter viewBox)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

const D = Math.PI / 180;
const f = n => Math.round(n * 10) / 10;
const pt = (x, y) => `${f(x)},${f(y)}`;
const poly = ps => 'M' + ps.map(p => pt(p[0], p[1])).join('L') + 'Z';
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const rotv = (v, deg) => { const c = Math.cos(deg * D), s = Math.sin(deg * D); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; };
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

// Catmull-Rom -> cubic Bezier through points
function smooth(ps, closed = true, k = 1) {
  const n = ps.length;
  const g = i => closed ? ps[(i + n) % n] : ps[Math.max(0, Math.min(n - 1, i))];
  let d = 'M' + pt(...ps[0]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6 * k, p1[1] + (p2[1] - p0[1]) / 6 * k];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6 * k, p2[1] - (p3[1] - p1[1]) / 6 * k];
    d += `C${pt(...c1)} ${pt(...c2)} ${pt(...p2)}`;
  }
  return d + (closed ? 'Z' : '');
}
// tapered limb with round caps
function capsule(a, b, w0, w1) {
  const an = Math.atan2(b[1] - a[1], b[0] - a[0]), nx = -Math.sin(an), ny = Math.cos(an), r0 = w0 / 2, r1 = w1 / 2;
  return `M${pt(a[0] + nx * r0, a[1] + ny * r0)}L${pt(b[0] + nx * r1, b[1] + ny * r1)}A${f(r1)},${f(r1)} 0 0 0 ${pt(b[0] - nx * r1, b[1] - ny * r1)}L${pt(a[0] - nx * r0, a[1] - ny * r0)}A${f(r0)},${f(r0)} 0 0 0 ${pt(a[0] + nx * r0, a[1] + ny * r0)}Z`;
}
function ik(h, t, L1, L2, bend) {
  const dx = t[0] - h[0], dy = t[1] - h[1], d = Math.hypot(dx, dy), base = Math.atan2(dy, dx);
  const a = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)), a1 = base + bend * a;
  const k = [h[0] + L1 * Math.cos(a1), h[1] + L1 * Math.sin(a1)];
  return { k, a1: a1 / D, a2: Math.atan2(t[1] - k[1], t[0] - k[0]) / D };
}
function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
const rgb2hex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mul = (h, k) => rgb2hex(hex2rgb(h).map(v => v * k));
const mix = (a, b, t) => { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A.map((v, i) => v + (B[i] - v) * t)); };
// far-side variant: darker and slightly cooler (sits in shadow)
const far = h => mix(mul(h, 0.82), '#6B4F6B', 0.1);

// ------------------------------------------------------------------ palette
const C = {
  sky: ['#2F4A93', '#44589F', '#6462A3', '#8E6A9E', '#BB7390', '#DD8282', '#EF9C7C', '#F8B880', '#FFD39A'],
  sunCore: '#FFF4D6', sunRing: '#FFE3A8',
  cloudLit: '#FFD7B0', cloudMid: '#F1A99A', cloudShade: '#C9838F',
  hillFar: '#9C78A4', hillMid: '#7E6497', rock: '#5C4B7C', rockDark: '#473C69', rockLit: '#8E6F95',
  sea: ['#8A8DC0', '#7481B8', '#5F74AA', '#4D679B', '#3E5B8E', '#324F83', '#2E4F7F'],
  glint: '#FFE0A6', glint2: '#FFF4D6', foam: '#FDEBDD',
  sand: '#EEB985', sandShade: '#D99A70', sandWet: '#C98C74',
  grass: '#8FA35C', grassLit: '#B8B868', grassDark: '#5E7A52', grassDeep: '#3F5A4C',
  road: '#4C4466', roadFar: '#5B5174', roadNear: '#433C5C', roadLine: '#F6E4C2', curb: '#E3C9AE', curbShade: '#B79A92',
  ink: '#241F33',
  // bike
  frame: '#1F8A8A', frameLit: '#48B6A8', frameDark: '#16625F', accent: '#F3E9D2', accentShade: '#D6C6AE',
  chrome: '#E4DDD6', chromeDark: '#9D95A0', tyre: '#2A2436', tyreLit: '#4A4058',
  saddle: '#7A4A2A', saddleLit: '#A0643A', basket: '#C89B5E', basketLit: '#E2B978', basketDark: '#946A3C',
  // pelican
  plume: '#FFF7EE', plumeShade: '#EEDAD6', plumeDeep: '#CDB6C2', rim: '#FFD08A',
  flight: '#1E1B22', flightSheen: '#3E3B4C',
  bill: '#F2A48A', billLit: '#F9C2A6', billEdge: '#D9705A', nail: '#E0503A',
  pouch: '#F9C74F', pouchShade: '#F4A340',
  skin: '#F7C1B5', iris: '#8B1E1E',
  leg: '#F08A3C', legLit: '#F7A55C', legFar: '#C4622E', webFar: '#CF7440', webShadeFar: '#A9522A', web: '#F5A05A', webShade: '#DE7A3A',
  scarf: '#E4484F', scarfDark: '#B3334A', scarfStripe: '#FFE7C4',
  fish: '#8FB3C9', fishLit: '#CFE3EA', fishDark: '#5E7F9E',
};

// ------------------------------------------------------------------ rig pose (phi = 0)
const BB = [0, -80], RH = [-125, -100], FH = [173, -100];
const pelvis = [-45, -300];
const P = (dx, dy) => add(pelvis, [dx, dy]);
const hipN = P(8, 0), hipF = P(4, -3);
const shN = P(80, -78), shF = P(75, -83);
const gripN = [114, -275], gripF = [111, -277];
const alpha = phi => 8 + 10 * Math.cos(phi - 135 * D);
const pedN = [50, -80], pedF = [-50, -80];
const aN = alpha(0), aF = alpha(Math.PI);
const ankN = add(pedN, rotv([-17, -9], aN)), ankF = add(pedF, rotv([-17, -9], aF));
const legN = ik(hipN, ankN, 142, 134, -1), legF = ik(hipF, ankF, 142, 134, -1);
const wingN = ik(shN, gripN, 78, 74, 1), wingF = ik(shF, gripF, 78, 74, 1);
const neckBase = [67, -392], head = [125, -520];

// ------------------------------------------------------------------ BIKE
function wheel(c, id, farSide = false) {
  const [cx, cy] = c;
  let spokes = '';
  for (let i = 0; i < 32; i++) {
    const ra = i * 11.25, lead = i % 2 ? 1 : -1, ha = ra + lead * 67.5 + (i % 4 < 2 ? 0 : 5.6);
    const rp = add(c, rotv([87.5, 0], ra)), hp = add(c, rotv([5.5, 0], ha));
    spokes += `M${pt(...hp)}L${pt(...rp)}`;
  }
  const valve = add(c, rotv([84, 0], -58));
  const refl = [add(c, rotv([40, 0], 118)), add(c, rotv([58, 0], 118))];
  return `<g id="j-${id}">
    <circle cx="${cx}" cy="${cy}" r="95.5" fill="none" stroke="${C.tyre}" stroke-width="9"/>
    <path d="M${pt(cx - 92, cy - 18)}A94,94 0 0 1 ${pt(cx + 30, cy - 90)}" fill="none" stroke="${C.tyreLit}" stroke-width="2" stroke-linecap="round" opacity=".8"/>
    <circle cx="${cx}" cy="${cy}" r="89.5" fill="none" stroke="${C.chrome}" stroke-width="3"/>
    <circle cx="${cx}" cy="${cy}" r="87.3" fill="none" stroke="${C.chromeDark}" stroke-width="1.2"/>
    <path d="${spokes}" stroke="${C.chrome}" stroke-width=".9" opacity=".85"/>
    <path d="M${pt(...refl[0])}L${pt(...refl[1])}" stroke="#F28A3A" stroke-width="5" stroke-linecap="round"/>
    <path d="M${pt(...valve)}L${pt(...add(valve, rotv([-7, 0], -58)))}" stroke="${C.chromeDark}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="9" fill="${C.chromeDark}"/>
    <circle cx="${cx}" cy="${cy}" r="6" fill="${C.chrome}"/>
    <circle cx="${cx}" cy="${cy}" r="2.2" fill="${C.chromeDark}"/>
  </g>`;
}
function fender(c, a0, a1) {
  const r = 106, p0 = add(c, rotv([r, 0], a0)), p1 = add(c, rotv([r, 0], a1));
  const q0 = add(c, rotv([r - 3, 0], a0 + 3)), q1 = add(c, rotv([r - 3, 0], a1 - 3));
  return `<path d="M${pt(...p0)}A${r},${r} 0 0 1 ${pt(...p1)}" fill="none" stroke="${C.accent}" stroke-width="8" stroke-linecap="round"/>
  <path d="M${pt(...q0)}A${r - 3},${r - 3} 0 0 1 ${pt(...q1)}" fill="none" stroke="${C.accentShade}" stroke-width="2.4" stroke-linecap="round"/>`;
}
function sprocket(c, teeth, tip, root, fill, id) {
  const ps = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * 360 / teeth, w = 360 / teeth;
    ps.push(add(c, rotv([root, 0], a - w * 0.5)), add(c, rotv([tip, 0], a - w * 0.18)), add(c, rotv([tip, 0], a + w * 0.18)));
  }
  return `<path id="${id}" d="${poly(ps)}" fill="${fill}"/>`;
}
function bike() {
  const ST = [-46.5, -232], HTt = [112, -245], HTb = [125.6, -203.2];
  const TTs = [-44.4, -225], TTe = [113.6, -239.5], DTe = [122.5, -212.5], SSs = [-43.8, -223];
  const htDir = [(HTb[0] - HTt[0]) / 44, (HTb[1] - HTt[1]) / 44];
  const crown = add(HTb, [htDir[0] * 8, htDir[1] * 8]);
  const forkAxisEnd = add(HTb, [htDir[0] * 112.8, htDir[1] * 112.8]);
  const bend = add(HTb, [htDir[0] * 80, htDir[1] * 80]);
  const tube = (a, b, w, col = C.frame) => `<path d="M${pt(...a)}L${pt(...b)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
  const lit = (a, b, w, off) => {
    const an = Math.atan2(b[1] - a[1], b[0] - a[0]), n = [-Math.sin(an) * off, Math.cos(an) * off];
    return `<path d="M${pt(...lerp(add(a, n), add(b, n), 0.1))}L${pt(...lerp(add(a, n), add(b, n), 0.9))}" stroke="${C.frameLit}" stroke-width="${w}" stroke-linecap="round"/>`;
  };
  // chain
  const CHAIN = 'M-124.92,-109.57 L0.23,-108.55 A28.556,28.556 0 1 1 -8.69,-52.80 L-127.91,-90.88 A9.573,9.573 0 0 1 -124.92,-109.57 Z';
  // chainring spider
  let spider = '';
  for (let i = 0; i < 5; i++) spider += `<path d="M0,-80L${pt(...add(BB, rotv([23, 0], i * 72 + 18)))}" stroke="${C.chromeDark}" stroke-width="5" stroke-linecap="round"/>`;
  const parts = {};
  parts.crankFar = `<g id="j-crankFar"><path d="M0,-80L${pt(...pedF)}" stroke="${far(C.chromeDark)}" stroke-width="8" stroke-linecap="round"/></g>`;
  parts.pedalFar = `<g id="j-pedalFar"><rect x="${pedF[0] - 12}" y="${pedF[1] - 4}" width="24" height="8" rx="2.5" fill="${far(C.ink)}"/></g>`;
  parts.wheels = fender(RH, 185, 318) + wheel(RH, 'wheelRear') + fender(FH, 215, 350) + wheel(FH, 'wheelFront');
  // rack struts from basket to front hub (behind the wheel face) + rear fender stay
  parts.frame = `<g id="j-frame">
    ${tube(add(RH, [0, 0]), add(RH, rotv([106, 0], 250)), 2.2, C.chromeDark)}
    ${tube(BB, RH, 7.5)}${tube(SSs, RH, 6.5)}
    ${tube(BB, DTe, 11)}${tube(TTs, TTe, 9)}${tube(BB, ST, 10)}
    ${lit(BB, DTe, 2.2, -3)}${lit(TTs, TTe, 2, -2.5)}${lit(BB, ST, 2, -3)}${lit(SSs, RH, 1.6, -2)}
    <path d="M${pt(-46.5, -232)}L${pt(-60.5, -278)}" stroke="${C.chrome}" stroke-width="6.5" stroke-linecap="round"/>
    <path d="M${pt(-47, -226)}L${pt(-50.5, -238)}" stroke="${C.accent}" stroke-width="12" stroke-linecap="round"/>
    <path d="M${pt(...HTt)}L${pt(...HTb)}" stroke="${C.frame}" stroke-width="14" stroke-linecap="round"/>
    <path d="M${pt(...lerp(HTt, HTb, .22))}L${pt(...lerp(HTt, HTb, .78))}" stroke="${C.accent}" stroke-width="14"/>
    <path d="M${pt(...lerp(HTt, HTb, .3))}L${pt(...lerp(HTt, HTb, .7))}" stroke="${C.frameDark}" stroke-width="1.4" transform="translate(-4 0)"/>
    <circle cx="0" cy="-80" r="10" fill="${C.frameDark}"/>
    <circle cx="${RH[0]}" cy="${RH[1]}" r="5" fill="${C.frameDark}"/>
    <path d="M-30,-105 L-2,-116" stroke="${C.accent}" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>
  </g>`;
  parts.fork = `<g id="j-fork">
    <path d="M${pt(...crown)}L${pt(...bend)}Q${pt(...forkAxisEnd)} ${pt(...FH)}" fill="none" stroke="${C.frame}" stroke-width="7.5" stroke-linecap="round"/>
    <path d="M${pt(...add(crown, [-2.4, 0]))}L${pt(...add(bend, [-2.4, 0]))}" stroke="${C.frameLit}" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M${pt(...add(HTb, [-6, -1]))}L${pt(...add(HTb, [8, 3]))}" stroke="${C.chrome}" stroke-width="5" stroke-linecap="round"/>
    <path d="M${pt(151, -226)}L${pt(...FH)}M${pt(212, -226)}L${pt(...FH)}" stroke="${C.chromeDark}" stroke-width="2.4" stroke-linecap="round"/>
  </g>`;
  // headlamp (faces +x), bracket to head tube
  const lamp = `<g id="j-headlamp">
    <path d="M${pt(126, -214)}L${pt(138, -218)}" stroke="${C.chromeDark}" stroke-width="4" stroke-linecap="round"/>
    <path d="M${pt(133, -228)}L${pt(147, -228)}A10,10 0 0 1 ${pt(147, -208)}L${pt(133, -208)}A10,10 0 0 1 ${pt(133, -228)}Z" fill="${C.chrome}"/>
    <path d="M${pt(133, -216)}L${pt(147, -216)}A10,10 0 0 1 ${pt(147, -208)}L${pt(133, -208)}A10,10 0 0 1 ${pt(124.5, -213)}Z" fill="${C.chromeDark}" opacity=".55"/>
    <ellipse cx="152" cy="-218" rx="4.5" ry="10" fill="#FFF3C4"/>
    <ellipse cx="153" cy="-221" rx="1.8" ry="4" fill="#FFFFFF"/>
    <path d="M156,-226 L178,-236 L178,-200 L156,-210Z" fill="#FFF3C4" opacity=".35"/>
  </g>`;
  // basket with fish
  const bx0 = 140, bx1 = 222, by0 = -292, by1 = -226;
  let weave = '';
  for (let y = by0 + 12; y < by1 - 2; y += 11) weave += `<path d="M${bx0 + 2},${y}L${bx1 - 2},${y}" stroke="${C.basketDark}" stroke-width="1.6"/>`;
  for (let x = bx0 + 10, i = 0; x < bx1 - 4; x += 12, i++) weave += `<path d="M${x},${by0 + 8}L${x + 1},${by1 - 3}" stroke="${C.basketLit}" stroke-width="3" opacity=".75"/>`;
  const fish = (x, y, rot, len, col, lit, dark, face = true) => {
    const L = len;
    return `<g transform="translate(${x} ${y}) rotate(${rot})">
      <path d="M${-L * 0.52},0 L${-L * 0.72},${-L * 0.18} L${-L * 0.68},0 L${-L * 0.72},${L * 0.18}Z" fill="${dark}"/>
      <path d="${smooth([[L * 0.46, 0], [L * 0.2, -L * 0.17], [-L * 0.25, -L * 0.13], [-L * 0.55, 0], [-L * 0.25, L * 0.12], [L * 0.2, L * 0.15]])}" fill="${col}"/>
      <path d="M${L * 0.42},${L * 0.02}Q${L * 0.1},${L * 0.1} ${-L * 0.45},${L * 0.02}Q${-L * 0.1},${L * 0.16} ${L * 0.2},${L * 0.15}Z" fill="${dark}" opacity=".45"/>
      <path d="M${L * 0.3},${-L * 0.1}Q${0},${-L * 0.18} ${-L * 0.3},${-L * 0.1}" fill="none" stroke="${lit}" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M${-L * 0.05},${-L * 0.14}L${-L * 0.18},${-L * 0.27}L${-L * 0.28},${-L * 0.12}Z" fill="${dark}"/>
      ${face ? `<circle cx="${L * 0.3}" cy="${-L * 0.035}" r="${L * 0.05}" fill="#FFFFFF"/><circle cx="${L * 0.31}" cy="${-L * 0.03}" r="${L * 0.025}" fill="${C.ink}"/>
      <path d="M${L * 0.2},${-L * 0.1}Q${L * 0.17},0 ${L * 0.2},${L * 0.1}" fill="none" stroke="${dark}" stroke-width="1.4"/>` : ''}
    </g>`;
  };
  parts.basket = `<g id="j-basket">
    <path d="M${pt(131, -270)}L${pt(146, -262)}" stroke="${C.chromeDark}" stroke-width="3.5" stroke-linecap="round"/>
    ${fish(196, -300, -62, 64, mix(C.fish, C.fishDark, .25), C.fishLit, C.fishDark, false)}
    ${fish(168, -305, -118, 70, C.fish, C.fishLit, C.fishDark, true)}
    <path d="M${bx0},${by0}L${bx1},${by0}L${bx1 - 4},${by1}L${bx0 + 4},${by1}Z" fill="${C.basket}"/>
    ${weave}
    <path d="M${bx1 - 18},${by0 + 4}L${bx1},${by0 + 4}L${bx1 - 4},${by1}L${bx1 - 20},${by1}Z" fill="${C.basketDark}" opacity=".35"/>
    <rect x="${bx0 - 3}" y="${by0 - 4}" width="${bx1 - bx0 + 6}" height="9" rx="4.5" fill="${C.basketLit}"/>
    <rect x="${bx0 - 1}" y="${by1 - 5}" width="${bx1 - bx0 + 2}" height="6" rx="3" fill="${C.basketDark}"/>
    ${fish(210, -289, -18, 46, mix(C.fish, '#E7A07A', .35), '#FBE1C4', '#B77B6A', true)}
  </g>`;
  parts.bars = `<g id="j-bars">
    <path d="M${pt(112, -245)}L${pt(106.4, -262.1)}" stroke="${C.chrome}" stroke-width="7" stroke-linecap="round"/>
    <path d="M${pt(106.4, -262.1)}L${pt(132, -269)}" stroke="${C.chrome}" stroke-width="7" stroke-linecap="round"/>
    <path d="M${pt(132, -269)}C${pt(146, -272)} ${pt(144, -284)} ${pt(128, -281)}L${pt(110, -276)}" fill="none" stroke="${C.chrome}" stroke-width="5" stroke-linecap="round"/>
    <path d="M${pt(98, -273)}L${pt(122, -279)}" stroke="${C.saddle}" stroke-width="9" stroke-linecap="round"/>
    <g id="j-bell"><path d="M${pt(124, -281)}L${pt(124, -286)}" stroke="${C.chromeDark}" stroke-width="2"/>
      <path d="M116.5,-286 A7.5,7.5 0 0 1 131.5,-286Z" fill="#F2C14E"/><rect x="115" y="-287" width="18" height="2.6" rx="1.3" fill="#D99A2B"/>
      <circle cx="121" cy="-290" r="1.6" fill="#FFF3C4"/></g>
  </g>`;
  parts.saddle = `<g id="j-saddle">
    <path d="M-86,-280 q3,5 0,8 q-3,4 0,8 M-38,-280 q3,5 0,8 q-3,4 0,8" fill="none" stroke="${C.chromeDark}" stroke-width="2.4"/>
    <path d="M-90,-266L-60.5,-278L-34,-266" fill="none" stroke="${C.chromeDark}" stroke-width="2.4"/>
    <path d="M-101,-283 C-101,-290 -90,-292 -70,-291 C-50,-290 -34,-288 -23,-285 C-22,-282 -30,-279 -44,-279 L-92,-278 C-99,-278 -101,-280 -101,-283Z" fill="${C.saddle}"/>
    <path d="M-97,-286 C-88,-290 -60,-290 -40,-288" fill="none" stroke="${C.saddleLit}" stroke-width="2" stroke-linecap="round"/>
  </g>`;
  parts.cog = `<g id="j-cog">${sprocket(RH, 16, 10.8, 8.6, C.chromeDark, 'cog-t')}<circle cx="${RH[0]}" cy="${RH[1]}" r="6.5" fill="${C.chrome}"/></g>`;
  parts.chain = `<g id="j-chain"><path d="${CHAIN}" fill="none" stroke="${C.ink}" stroke-width="3.2" pathLength="100" stroke-dasharray="1.1 0.9"/>
    <path d="${CHAIN}" fill="none" stroke="${C.chromeDark}" stroke-width="1.4" pathLength="100" stroke-dasharray="0.3 3.7"/></g>`;
  parts.chainring = `<g id="j-chainring">${sprocket(BB, 48, 30.2, 27.6, C.chromeDark, 'ring-t')}
    <circle cx="0" cy="-80" r="26.5" fill="${C.chrome}"/><circle cx="0" cy="-80" r="19" fill="${C.frameDark}"/>${spider}
    <circle cx="0" cy="-80" r="7" fill="${C.chrome}"/></g>`;
  parts.crankNear = `<g id="j-crankNear"><path d="M0,-80L${pt(...pedN)}" stroke="${C.chrome}" stroke-width="8" stroke-linecap="round"/>
    <path d="M4,-82.5L${pedN[0] - 4},${pedN[1] - 2.5}" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>
    <circle cx="0" cy="-80" r="4" fill="${C.chromeDark}"/><circle cx="${pedN[0]}" cy="${pedN[1]}" r="3.4" fill="${C.chromeDark}"/></g>`;
  parts.pedalNear = `<g id="j-pedalNear"><rect x="${pedN[0] - 12}" y="${pedN[1] - 4}" width="24" height="8" rx="2.5" fill="${C.ink}"/>
    <rect x="${pedN[0] - 9}" y="${pedN[1] - 1.5}" width="7" height="3" rx="1.5" fill="#F28A3A"/><rect x="${pedN[0] + 2}" y="${pedN[1] - 1.5}" width="7" height="3" rx="1.5" fill="#F28A3A"/></g>`;
  parts.lamp = lamp;
  return parts;
}

// ------------------------------------------------------------------ PELICAN
function thigh(h, k, near) {
  const col = near ? C.plume : far(C.plume), sh = near ? C.plumeShade : far(C.plumeShade), dp = near ? C.plumeDeep : far(C.plumeDeep);
  const leg = near ? C.leg : C.legFar, legL = near ? C.legLit : C.legFar;
  const an = Math.atan2(k[1] - h[1], k[0] - h[0]) / D;
  // thigh-local frame, bone along +x (length 142): bare orange tibia below a fluffy feathered "trouser"
  const feather = smooth([[-16, -17], [24, -19], [62, -15], [84, -10], [80, -4], [92, -1], [84, 4], [90, 9], [74, 11], [40, 17], [0, 19], [-20, 4]]);
  return `<g transform="translate(${f(h[0])} ${f(h[1])}) rotate(${f(an)})">
    <path d="${capsule([70, 0], [142, 0], 13, 12)}" fill="${leg}"/>
    ${near ? `<path d="M84,-4.2 L136,-4" stroke="${legL}" stroke-width="2" stroke-linecap="round"/>` : ''}
    <path d="${feather}" fill="${col}"/>
    <path d="M-12,12 C20,13 50,10 74,9 L88,8 C80,11 70,12 40,17 C20,19 0,19 -14,14Z" fill="${sh}"/>
    <path d="M44,-6 L60,-3 L46,0 M60,4 L74,6 L62,8" fill="none" stroke="${dp}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    ${near ? `<path d="M10,-18 C40,-19 64,-15 80,-11" fill="none" stroke="${C.rim}" stroke-width="2.2" stroke-linecap="round"/>` : ''}
  </g>`;
}
function shank(k, a, near) {
  const col = near ? C.leg : C.legFar, lit = near ? C.legLit : C.legFar;
  let scales = '';
  for (let t = 0.25; t < 0.9; t += 0.13) { const p = lerp(k, a, t), an = Math.atan2(a[1] - k[1], a[0] - k[0]); const n = [-Math.sin(an), Math.cos(an)];
    scales += `M${pt(...add(p, [n[0] * -4, n[1] * -4]))}L${pt(...add(p, [n[0] * 3.5, n[1] * 3.5]))}`; }
  return `<g><path d="${capsule(k, a, 13, 9.5)}" fill="${col}"/>
    <path d="${scales}" stroke="${mul(col, 0.85)}" stroke-width="1.2" stroke-linecap="round"/>
    ${near ? `<path d="M${pt(...lerp(k, a, .12).map((v, i) => v + (i ? -1 : 3)))}L${pt(...lerp(k, a, .85).map((v, i) => v + (i ? -1 : 2.5)))}" stroke="${lit}" stroke-width="2" stroke-linecap="round"/>` : ''}
    <circle cx="${f(k[0])}" cy="${f(k[1])}" r="8" fill="${col}"/>
    <circle cx="${f(a[0])}" cy="${f(a[1])}" r="5.6" fill="${col}"/></g>`;
}
function foot(a, rot, near) {
  const col = near ? C.leg : C.legFar, web = near ? C.web : C.webFar, ws = near ? C.webShade : C.webShadeFar;
  // foot frame: origin ankle, ball over pedal spindle at (17,9); sole ~y 5; toes to x 48
  return `<g transform="translate(${f(a[0])} ${f(a[1])}) rotate(${f(rot)})">
    <path d="M-8,5 L-9,-1 C-8,-7 0,-9 8,-7 C20,-6 36,-3 48,1 C53,3 53,7 49,8 C47,6 45,6 43,8 C46,10 47,13 44,15 C42,12 39,12 36,13 C37,15 36,17 33,17 C31,13 30,8 28,5Z" fill="${web}"/>
    <path d="M28,5 C31,9 32,13 33,17 C36,17 37,15 36,13 C39,12 42,12 44,15 C46,12 45,9 43,8 C38,8 32,6 28,5Z" fill="${ws}"/>
    <path d="M4,-3 C20,-3 36,-1 50,4.5 M4,-1 C22,1 36,5 44,14 M4,1 C18,4 28,8 33,16" fill="none" stroke="${col}" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M-9,4 C-9,-8 6,-9 13,-4 C15,-1 14,3 12,5 L-8,5Z" fill="${col}"/>
    <path d="M50,4.5 l3.5,2.8 M44,14 l1,4 M33,16 l-0.5,4" stroke="${C.ink}" stroke-width="1.8" stroke-linecap="round"/>
    ${near ? `<path d="M0,-6.5 C10,-7 24,-5 40,-1" fill="none" stroke="${C.legLit}" stroke-width="1.8" stroke-linecap="round"/>` : ''}
  </g>`;
}
function wing(sh, el, wr, near) {
  const W = near ? C.plume : far(C.plume), S = near ? C.plumeShade : far(C.plumeShade), Dp = near ? C.plumeDeep : far(C.plumeDeep);
  const K = near ? C.flight : far(C.flight), KS = near ? C.flightSheen : far(C.flightSheen);
  const au = Math.atan2(el[1] - sh[1], el[0] - sh[0]) / D, al = Math.atan2(wr[1] - el[1], wr[0] - el[0]) / D;
  const cast = near ? `fill="${C.plumeDeep}"` : '';
  // upper arm frame: origin shoulder, +x toward elbow (78); local +y points backwards (trailing side)
  const upperShape = `M-14,-24 C20,-30 58,-19 84,-12 C92,-3 90,8 81,11 C60,14 30,16 0,17 C-16,14 -24,-12 -14,-24Z`;
  const upper = `<g transform="translate(${f(sh[0])} ${f(sh[1])}) rotate(${f(au)})">
      
      <path d="${upperShape}" fill="${W}"/>
      <path d="M84,-12 C92,-3 90,8 81,11 C60,14 30,16 0,17 C14,10 40,6 62,3 C74,0 82,-5 84,-12Z" fill="${S}"/>
      <path d="M60,-3 q4,6 9,1 q4,6 9,1" fill="none" stroke="${Dp}" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M8,-6 q6,7 12,1 q6,7 12,1 q6,7 12,1 q6,7 12,1" fill="none" stroke="${Dp}" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M24,8 q6,7 12,1 q6,7 12,1" fill="none" stroke="${Dp}" stroke-width="1.6" stroke-linecap="round"/>
    </g>`;
  // forearm frame: origin elbow, +x toward wrist (74), local +y = underside (trailing edge)
  let secs = '', secl = '';
  for (let i = 0; i < 6; i++) {
    const x0 = -8 + i * 13, x1 = x0 + 14, tip = [x0 - 6, 32 - i * 2.4];
    secs += `M${x0},4 C${x0 - 4},14 ${tip[0] - 2},${tip[1] - 6} ${tip[0]},${tip[1]} C${tip[0] + 6},${tip[1] - 4} ${x1 - 2},14 ${x1},4Z`;
    secl += `M${x0 + 4},8 L${tip[0] + 3},${tip[1] - 5}`;
  }
  const foreShape = `M-22,-15 C10,-18 50,-13 76,-8 C83,-4 83,6 75,9 C50,13 20,15 -16,16Z`;
  const forearm = `<g transform="translate(${f(el[0])} ${f(el[1])}) rotate(${f(al)})">
      ${near ? `<path d="${foreShape}" transform="translate(-2 5)" ${cast} opacity=".6"/>` : ''}
      <path d="${secs}" fill="${K}"/>
      <path d="${secl}" stroke="${KS}" stroke-width="1.5" stroke-linecap="round"/>
      <path d="${foreShape}" fill="${W}"/>
      <path d="M-16,16 C20,15 50,13 75,9 C80,7 82,4 82,1 C60,4 30,7 -14,8Z" fill="${S}"/>
      <path d="M6,-3 q5,5 10,0 q5,5 10,0 q5,5 10,0 q5,5 10,0 q5,5 10,0" fill="none" stroke="${Dp}" stroke-width="1.5" stroke-linecap="round"/>
      ${near ? `<path d="M-8,-15 C20,-17 50,-12 72,-8" fill="none" stroke="${C.rim}" stroke-width="2.6" stroke-linecap="round"/>` : ''}
    </g>`;
  // hand: black primaries curl over and around the grip (grip r 6), frame rotated 15 deg
  const hand = `<g transform="translate(${f(wr[0])} ${f(wr[1])}) rotate(15)">
      <path d="M-12,-10 C0,-15 14,-14 22,-7 C27,-1 25,7 18,11 C16,7 13,5 10,6 C14,1 12,-5 6,-6 C-1,-7 -7,-2 -10,4Z" fill="${K}"/>
      <path d="M4,-11 C14,-11 21,-5 21,2 C21,6 19,9 17,10" fill="none" stroke="${KS}" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M-4,-12 C4,-14 10,-13 14,-10" fill="none" stroke="${KS}" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M-18,-12 C-8,-16 0,-15 6,-12 C0,-6 -8,-1 -16,6Z" fill="${W}"/>
    </g>`;
  return { upper, forearm, hand };
}
function neckPath() {
  const P0 = neckBase, P3 = add(head, [-14, 10]), P1 = add(P0, [30, -58]), P2 = add(P3, [-58, 34]);
  const bez = t => { const u = 1 - t; return [0, 1].map(i => u * u * u * P0[i] + 3 * u * u * t * P1[i] + 3 * u * t * t * P2[i] + t * t * t * P3[i]); };
  const L = [], R = [], mid = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = bez(t), q = bez(Math.min(1, t + 0.01)), r = bez(Math.max(0, t - 0.01));
    const an = Math.atan2(q[1] - r[1], q[0] - r[0]), w = (34 + 6 * (1 - t) * (1 - t)) * (1 - t) + 24 * t;
    const n = [-Math.sin(an), Math.cos(an)];
    L.push(add(p, [n[0] * w / 2, n[1] * w / 2])); R.push(add(p, [-n[0] * w / 2, -n[1] * w / 2])); mid.push({ p, n, w });
  }
  // L is the right-hand side of travel => front/throat side (points +y rotated) ; check below
  const outline = smooth([...L, ...R.reverse()], true, 0.9);
  const band = (a, b) => { const A = [], B = []; for (const m of mid) { A.push(add(m.p, [m.n[0] * m.w * a, m.n[1] * m.w * a])); B.push(add(m.p, [m.n[0] * m.w * b, m.n[1] * m.w * b])); } return smooth([...A, ...B.reverse()], true, 0.9); };
  return { outline, band };
}
function pelican() {
  const out = {};
  const neck = neckPath();
  // body in pelvis frame
  out.tail = `<g id="j-tail" transform="translate(${f(pelvis[0] - 62)} ${f(pelvis[1] - 38)}) rotate(8)">
    <path d="M8,-16 C-8,-20 -30,-18 -48,-12 C-40,-8 -38,-6 -36,-4 C-44,-2 -50,2 -52,6 C-42,6 -36,6 -32,7 C-38,10 -42,14 -44,18 C-26,16 -8,14 8,12Z" fill="${C.plumeShade}"/>
    <path d="M-36,-4 C-44,-2 -50,2 -52,6 C-42,6 -36,6 -32,7 C-38,10 -42,14 -44,18 C-26,16 -10,12 0,6Z" fill="${C.plumeDeep}"/>
  </g>`;
  out.body = `<g id="j-body" transform="translate(${pelvis[0]} ${pelvis[1]})">
    <clipPath id="pb-bodyclip"><ellipse cx="32" cy="-50" rx="98" ry="58" transform="rotate(-18 32 -50)"/></clipPath>
    <ellipse cx="32" cy="-50" rx="98" ry="58" transform="rotate(-18 32 -50)" fill="${C.plume}"/>
    <g clip-path="url(#pb-bodyclip)">
      <ellipse cx="18" cy="-8" rx="120" ry="44" transform="rotate(-14 18 -8)" fill="${C.plumeShade}"/>
      <ellipse cx="-4" cy="24" rx="110" ry="30" transform="rotate(-10 -4 24)" fill="${C.plumeDeep}" opacity=".7"/>
      <ellipse cx="150" cy="-118" rx="70" ry="48" fill="${C.rim}" opacity=".0"/>
      <path d="M40,-110 C90,-126 132,-106 140,-72 C120,-96 90,-106 40,-110Z" fill="${C.rim}"/>
      <ellipse cx="112" cy="-88" rx="28" ry="24" fill="#FBE3A6" opacity=".75"/>
    </g>
    <g id="pb-foldwing">
      <path d="${smooth([[92,-92],[40,-104],[-20,-92],[-70,-68],[-104,-48],[-84,-30],[-30,-24],[24,-32],[74,-50],[100,-72]])}" fill="${C.plumeDeep}" transform="translate(-3 5)" opacity=".55"/>
      <path d="M-34,-44 C-60,-46 -96,-46 -132,-38 C-110,-34 -96,-32 -86,-30 C-104,-24 -118,-20 -130,-14 C-104,-14 -86,-16 -70,-20 C-86,-10 -96,-4 -104,4 C-80,-2 -60,-10 -40,-20Z" fill="${C.flight}"/>
      <path d="M-50,-40 C-80,-42 -104,-40 -124,-37 M-60,-28 C-84,-24 -104,-19 -122,-15 M-56,-18 C-72,-12 -86,-5 -98,2" fill="none" stroke="${C.flightSheen}" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M86,-52 C60,-38 20,-28 -30,-26 C-50,-26 -64,-30 -74,-36 C-66,-24 -50,-16 -30,-16 C0,-16 30,-22 50,-30 L44,-24 C60,-30 72,-38 86,-52Z" fill="${C.flight}"/>
      <path d="M40,-32 L34,-22 M14,-27 L10,-17 M-12,-25 L-14,-16" stroke="${C.flightSheen}" stroke-width="1.6" stroke-linecap="round"/>
      <path d="${smooth([[92,-92],[40,-104],[-20,-92],[-70,-68],[-100,-46],[-74,-36],[-30,-28],[24,-36],[74,-54],[100,-72]])}" fill="${C.plume}"/>
      <path d="M-74,-36 C-50,-30 -10,-30 24,-36 C54,-42 80,-56 100,-72 C96,-60 76,-46 50,-40 C10,-32 -40,-30 -74,-36Z" fill="${C.plumeShade}"/>
      <path d="M-40,-60 q7,8 14,0 q7,8 14,0 q7,8 14,0 q7,8 14,0 q7,8 14,0 M-56,-46 q7,8 14,0 q7,8 14,0 q7,8 14,0 q7,8 14,0 q7,8 14,0 q7,8 14,0" fill="none" stroke="${C.plumeDeep}" stroke-width="1.7" stroke-linecap="round"/>
      <path d="M40,-104 C0,-104 -40,-90 -70,-68" fill="none" stroke="${C.rim}" stroke-width="2" stroke-linecap="round" opacity=".7"/>
    </g>
  </g>`;
  // neck: base plumage, back-side shade, front rim light; breast patch
  out.neck = `<g id="j-neck">
    <circle cx="66" cy="-384" r="27" fill="${C.plume}"/>
    <path d="${neck.outline}" fill="${C.plume}"/>
    <path d="${neck.band(-0.5, -0.18)}" fill="${C.plumeShade}"/>
    <path d="${neck.band(0.36, 0.5)}" fill="${C.rim}"/>
  </g>`;
  // scarf around neck base + tails streaming back
  out.scarf = `<g id="j-scarf">
    <path d="M52,-420 C40,-428 10,-432 -18,-424 C-40,-418 -62,-424 -80,-436 C-72,-418 -60,-404 -36,-402 C-12,-400 18,-404 44,-398Z" fill="${C.scarfDark}"/>
    <path d="M52,-414 C30,-410 4,-404 -22,-392 C-44,-382 -64,-384 -86,-394 C-74,-374 -54,-366 -30,-372 C-4,-378 26,-388 50,-398Z" fill="${C.scarf}"/>
    <path d="M-42,-383 L-50,-368 M-62,-385 L-70,-373 M-50,-407 L-56,-396 M-30,-403 L-35,-392" stroke="${C.scarfStripe}" stroke-width="4" stroke-linecap="round"/>
    <path d="M44,-424 C58,-430 84,-428 96,-420 C100,-408 98,-398 92,-392 C76,-392 60,-396 46,-402 C40,-410 40,-418 44,-424Z" fill="${C.scarf}"/>
    <path d="M46,-402 C60,-396 76,-392 92,-392 C90,-387 80,-384 72,-386 C62,-388 52,-394 46,-402Z" fill="${C.scarfDark}"/>
    <path d="M52,-420 L90,-418 M50,-411 L94,-406" stroke="${C.scarfStripe}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M48,-410 C42,-418 46,-426 54,-426 C62,-426 64,-414 58,-406 C54,-402 50,-404 48,-410Z" fill="${C.scarfDark}"/>
  </g>`;
  // head group (head frame: origin head joint)
  const hx = head[0], hy = head[1];
  const billRot = 14;
  out.pouch = `<g id="j-pouch" transform="translate(${hx + 16} ${hy + 6}) rotate(${billRot}) translate(6 5)">
    <path d="M-8,-4 C8,20 30,34 58,32 C84,30 104,16 116,-3 L110,-4 C96,6 70,8 40,4 C20,2 4,-1 -8,-4Z" fill="${C.pouch}"/>
    <path d="M4,12 C24,30 46,34 66,31 C88,27 104,15 116,-3 C100,12 80,20 58,22 C36,23 18,19 4,12Z" fill="${C.pouchShade}"/>
    <path d="M20,6 C40,10 72,10 100,0" fill="none" stroke="#FCE08A" stroke-width="2" stroke-linecap="round"/>
  </g>`;
  out.billLower = `<g id="j-billLower" transform="translate(${hx + 16} ${hy + 6}) rotate(${billRot})">
    <path d="M-2,-2 L118,-3 C121,-2 122,1 118,3 L-2,5Z" fill="${C.billEdge}"/>
  </g>`;
  out.billUpper = `<g id="j-billUpper" transform="translate(${hx + 16} ${hy + 2}) rotate(${billRot})">
    <path d="M-6,-12 C20,-12 60,-8 112,-4 C122,-3 128,0 129,5 C130,10 126,13 122,12 C123,8 120,6 116,6 L-4,6Z" fill="${C.bill}"/>
    <path d="M-4,1 L116,3 C120,3 123,5 122,8 C119,6 116,6 116,6 L-4,6Z" fill="${C.billEdge}"/>
    <path d="M0,-8 C30,-8 70,-5 110,-2" fill="none" stroke="${C.billLit}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M113,-4 C122,-3 128,0 129,5 C130,10 126,13 122,12 C123,8 121,5 116,4Z" fill="${C.nail}"/>
    <path d="M-4,4 C4,6 8,6 12,3" fill="none" stroke="${C.billEdge}" stroke-width="2.4" stroke-linecap="round"/>
  </g>`;
  out.head = `<g id="j-head" transform="translate(${hx} ${hy})">
    <clipPath id="pb-headclip"><path d="${smooth([[34, -12], [22, -26], [0, -30], [-20, -24], [-28, -6], [-22, 12], [-4, 20], [18, 16], [30, 6]])}"/></clipPath>
    <path d="${smooth([[34, -12], [22, -26], [0, -30], [-20, -24], [-28, -6], [-22, 12], [-4, 20], [18, 16], [30, 6]])}" fill="${C.plume}"/>
    <g clip-path="url(#pb-headclip)">
      <path d="M-40,4 C-20,10 0,14 20,10 L40,40 L-40,40Z" fill="${C.plumeShade}"/>
      <path d="M4,-34 C22,-30 34,-20 38,-8 L50,-30Z" fill="${C.rim}"/>
      <path d="M2,-31 C20,-30 32,-20 36,-8 C32,-12 26,-22 2,-28Z" fill="${C.rim}"/>
    </g>
    <path d="${smooth([[-3, -12], [6, -17], [18, -14], [30, -6], [24, 2], [10, 2], [-1, -3]])}" fill="${C.skin}"/>
  </g>`;
  // eye: slightly lidded, content; highlight
  out.eye = `<g id="j-eye" transform="translate(${hx + 6} ${hy - 7})">
    <ellipse cx="8" cy="9" rx="7" ry="3.6" fill="#F59A9A" opacity=".55"/>
    <circle r="6.4" fill="${C.iris}"/>
    <circle cx="1" cy=".4" r="3.8" fill="${C.ink}"/>
    <circle cx="2.6" cy="-1.6" r="1.7" fill="#FFFFFF"/><circle cx="-1.8" cy="2.4" r=".8" fill="#FFFFFF" opacity=".8"/>
    <path d="M-7.6,-2.6 C-5,-7.6 5,-7.6 7.6,-2.6 C4,-4.8 -4,-4.8 -7.6,-2.6Z" fill="${mix(C.skin, C.billEdge, .35)}"/>
    <path d="M-7.8,-2.8 C-4.6,-7.8 4.6,-7.8 7.8,-2.8 L9.8,-4.4" fill="none" stroke="${C.ink}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;
  // crest: shaggy pointed plumes at the back of the head (rest rot 200)
  out.crest = `<g id="j-crest" transform="translate(${hx - 20} ${hy - 16}) rotate(200)">
    <path d="M-6,-12 C6,-16 20,-18 34,-22 C28,-15 24,-11 22,-8 C32,-9 40,-6 46,-2 C36,0 28,0 24,0 C32,3 38,8 42,14 C32,12 24,9 18,7 C22,12 24,16 24,22 C14,16 6,12 0,9 C-6,4 -8,-6 -6,-12Z" fill="${C.plume}"/>
    <path d="M24,0 C32,3 38,8 42,14 C32,12 24,9 18,7 C22,12 24,16 24,22 C14,16 6,12 0,9 C8,6 16,3 24,0Z" fill="${C.plumeShade}"/>
    <path d="M22,-8 C32,-9 40,-6 46,-2 C36,0 28,0 16,-2Z" fill="${C.plumeShade}" opacity=".55"/>
    <path d="M4,-4 L26,-10 M6,2 L30,4" stroke="${C.plumeDeep}" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>
  </g>`;
  return out;
}

// ------------------------------------------------------------------ SCENE
function cloud(x, y, s, variant = 0) {
  const id = `pb-cl${Math.round(x)}`;
  const shapes = variant === 0
    ? `<rect x="-120" y="-10" width="240" height="30" rx="15"/><circle cx="-60" cy="-12" r="30"/><circle cx="0" cy="-30" r="42"/><circle cx="58" cy="-10" r="30"/>`
    : `<rect x="-90" y="-6" width="180" height="22" rx="11"/><circle cx="-30" cy="-12" r="22"/><circle cx="16" cy="-20" r="28"/>`;
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <clipPath id="${id}">${shapes}</clipPath>
    <g fill="${C.cloudMid}">${shapes}</g>
    <g clip-path="url(#${id})">
      <rect x="-160" y="4" width="320" height="40" fill="${C.cloudShade}"/>
      <circle cx="${variant ? 34 : 60}" cy="${variant ? -40 : -60}" r="${variant ? 44 : 64}" fill="${C.cloudLit}"/>
      <circle cx="${variant ? 70 : 104}" cy="${variant ? -14 : -26}" r="${variant ? 30 : 44}" fill="${C.cloudLit}"/>
    </g>
  </g>`;
}
function gull(x, y, s, flip = 1) {
  return `<path transform="translate(${x} ${y}) scale(${s * flip} ${s})" d="M-14,0 C-10,-6 -4,-6 0,1 C4,-6 10,-6 14,0 C10,-3 4,-2 0,4 C-4,-2 -10,-3 -14,0Z" fill="#4A3F6B"/>`;
}
function scene() {
  const W = 1600;
  let s = '';
  // sky bands
  const bands = [0, 70, 135, 195, 250, 300, 345, 390, 432];
  C.sky.forEach((c, i) => { s += `<rect x="0" y="${bands[i]}" width="${W}" height="${(bands[i + 1] ?? 470) - bands[i] + 1}" fill="${c}"/>`; });
  // sun with concentric flat halos
  const sx = 1440, sy = 330;
  s += `<g id="pb-sun"><circle cx="${sx}" cy="${sy}" r="190" fill="${C.sunRing}" opacity=".12"/><circle cx="${sx}" cy="${sy}" r="140" fill="${C.sunRing}" opacity=".16"/>
    <circle cx="${sx}" cy="${sy}" r="98" fill="${C.sunRing}" opacity=".24"/><circle cx="${sx}" cy="${sy}" r="66" fill="${C.sunCore}"/></g>`;
  // thin streak clouds across sun
  s += `<g fill="${C.cloudMid}" opacity=".9"><rect x="1300" y="352" width="210" height="9" rx="4.5"/><rect x="1370" y="370" width="200" height="7" rx="3.5"/><rect x="1240" y="386" width="120" height="6" rx="3"/></g>`;
  s += `<g fill="#F6C9A0" opacity=".9"><rect x="130" y="150" width="200" height="6" rx="3"/><rect x="1180" y="96" width="150" height="5" rx="2.5"/><rect x="760" y="120" width="220" height="6" rx="3"/></g>`;
  s += cloud(330, 210, 1.05, 0) + cloud(960, 250, 0.8, 1) + cloud(1180, 150, 0.55, 1) + cloud(610, 105, 0.42, 1);
  s += gull(1010, 175, 1.1) + gull(1052, 150, 0.8) + gull(1090, 188, 0.65) + gull(430, 120, 0.7, -1);
  // title
  s += `<g id="pb-title" transform="translate(64 70)">
      <text x="0" y="0" font-family="DejaVu Sans, sans-serif" font-weight="700" font-size="30" letter-spacing="9" fill="#FFF1DC">PELICAN BAY</text>
      <rect x="2" y="16" width="44" height="4" rx="2" fill="${C.pouch}"/>
      <text x="58" y="26" font-family="WenQuanYi Zen Hei, sans-serif" font-size="18" letter-spacing="6" fill="#FFE3C0" opacity=".95">鹈鹕湾</text>
    </g>`;
  // far hills on horizon (left) and island (right)
  s += `<path d="M0,470 L0,418 C60,404 110,396 170,408 C240,420 300,396 380,410 C450,422 500,440 560,470Z" fill="${C.hillFar}"/>`;
  s += `<path d="M1180,470 C1230,452 1270,448 1320,456 C1360,446 1410,448 1470,460 C1510,462 1550,466 1580,470Z" fill="${C.hillFar}" opacity=".9"/>`;
  // sea bands
  const sb = [470, 486, 505, 527, 552, 578, 604];
  C.sea.forEach((c, i) => { s += `<rect x="0" y="${sb[i]}" width="${W}" height="${(sb[i + 1] ?? 640) - sb[i] + 1}" fill="${c}"/>`; });
  // sun glitter column
  seed = 11;
  let gl = '';
  for (let i = 0; i < 46; i++) {
    const y = 474 + Math.pow(i / 46, 1.3) * 140, spread = 30 + (y - 470) * 0.9, w = 8 + (y - 470) * 0.3 * rnd() + 6;
    const x = sx + (rnd() - 0.5) * 2 * spread; gl += `<rect x="${f(x - w / 2)}" y="${f(y)}" width="${f(w)}" height="${f(1.6 + (y - 470) * 0.012)}" rx="1" fill="${rnd() > 0.5 ? C.glint2 : C.glint}" opacity="${f(0.55 + rnd() * 0.45)}"/>`;
  }
  s += gl;
  // soft swell lines
  let sw = '';
  for (let i = 0; i < 26; i++) { const y = 492 + rnd() * 110, x = rnd() * 1300, w = 30 + rnd() * 70; sw += `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="2" rx="1" fill="#A9A6D0" opacity="${f(0.25 + rnd() * 0.3)}"/>`; }
  s += sw;
  // headland + lighthouse (left)
  s += `<path d="M0,560 L0,440 C30,432 70,424 110,428 L150,424 C190,420 220,430 250,446 C290,468 320,500 360,522 C392,540 420,552 440,566Z" fill="${C.rock}"/>
    <path d="M150,424 C190,420 220,430 250,446 C290,468 320,500 360,522 C392,540 420,552 440,566 L380,566 C340,540 300,500 262,470 C230,446 200,432 150,424Z" fill="${C.rockLit}"/>
    <path d="M0,500 C60,510 120,520 180,540 L200,566 L0,566Z" fill="${C.rockDark}"/>
    <path d="M430,562 q-30,-8 -60,0 q-30,-6 -60,2 L310,570 L440,570Z" fill="${C.foam}" opacity=".7"/>`;
  const lx = 236, lb = 441;
  s += `<g id="pb-lighthouse">
    
    <path d="M${lx - 16},${lb} L${lx - 10},${lb - 96} L${lx + 10},${lb - 96} L${lx + 16},${lb}Z" fill="#FBF1E4"/>
    <path d="M${lx + 2},${lb} L${lx + 3},${lb - 96} L${lx + 10},${lb - 96} L${lx + 16},${lb}Z" fill="#E8C7BC"/>
    <path d="M${lx - 14.5},${lb - 22} L${lx - 13.3},${lb - 42} L${lx + 13.3},${lb - 42} L${lx + 14.5},${lb - 22}Z M${lx - 12.2},${lb - 62} L${lx - 11.2},${lb - 80} L${lx + 11.2},${lb - 80} L${lx + 12.2},${lb - 62}Z" fill="${C.scarf}"/>
    <rect x="${lx - 16}" y="${lb - 102}" width="32" height="6" rx="1" fill="${C.ink}"/>
    <rect x="${lx - 8}" y="${lb - 118}" width="16" height="16" fill="#FFE9A8"/>
    <circle cx="${lx}" cy="${lb - 110}" r="18" fill="#FFE9A8" opacity=".3"/>
    <path d="M${lx - 10},${lb - 118} L${lx},${lb - 130} L${lx + 10},${lb - 118}Z" fill="${C.scarf}"/>
    <rect x="${lx - 3}" y="${lb - 30}" width="6" height="10" rx="3" fill="${C.ink}"/>
    <path d="M${lx - 34},${lb + 2} L${lx - 30},${lb - 14} L${lx - 14},${lb - 14} L${lx - 10},${lb + 2}Z" fill="#FBF1E4"/><path d="M${lx - 36},${lb - 14} L${lx - 22},${lb - 24} L${lx - 8},${lb - 14}Z" fill="${C.scarfDark}"/>
  </g>`;
  // sailboat (backlit) + small far sail
  const bxp = 1150, byp = 540;
  s += `<g id="pb-boat">
    <rect x="${bxp - 46}" y="${byp + 12}" width="92" height="4" rx="2" fill="${C.glint}" opacity=".5"/>
    <path d="M${bxp - 44},${byp} L${bxp + 48},${byp} L${bxp + 34},${byp + 12} L${bxp - 36},${byp + 12}Z" fill="#3E3462"/>
    <rect x="${bxp - 1.5}" y="${byp - 96}" width="3" height="96" fill="#3E3462"/>
    <path d="M${bxp - 4},${byp - 92} L${bxp - 4},${byp - 6} L${bxp - 52},${byp - 6}Z" fill="#F6D9C2"/>
    <path d="M${bxp + 4},${byp - 86} L${bxp + 4},${byp - 6} L${bxp + 44},${byp - 6}Z" fill="${C.scarf}"/>
    <path d="M${bxp + 4},${byp - 86} L${bxp + 4},${byp - 6} L${bxp + 12},${byp - 6}Z" fill="${C.scarfDark}"/>
    <path d="M${bxp - 1},${byp - 96} l12,4 l-12,4Z" fill="${C.pouch}"/>
  </g>
  <g transform="translate(1010 488) scale(.33)"><path d="M-44,0 L48,0 L34,12 L-36,12Z" fill="#3E3462"/><path d="M-4,-92 L-4,-6 L-52,-6Z" fill="#F6D9C2"/><path d="M4,-86 L4,-6 L44,-6Z" fill="#F6D9C2" opacity=".8"/></g>`;
  // beach
  s += `<path d="M0,614 C200,604 420,612 700,606 C980,600 1300,610 1600,604 L1600,662 L0,662Z" fill="${C.sand}"/>
    <path d="M0,618 C200,608 420,616 700,610 C980,604 1300,614 1600,608 L1600,620 C1300,626 980,616 700,622 C420,628 200,620 0,628Z" fill="${C.sandWet}"/>
    <path d="M0,612 C120,604 200,614 320,606 C440,600 520,612 660,604 C800,598 900,610 1040,602 C1180,596 1300,608 1440,600 C1520,598 1560,604 1600,600" fill="none" stroke="${C.foam}" stroke-width="4" stroke-linecap="round"/>
    <path d="M60,596 L180,596 M520,594 L610,594 M880,592 L1000,592 M1240,590 L1340,590" stroke="${C.foam}" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>
    <path d="M0,648 C300,642 700,650 1000,644 C1300,638 1450,646 1600,642 L1600,662 L0,662Z" fill="${C.sandShade}"/>`;
  // beach huts
  const huts = [[250, C.scarf], [300, C.frame], [350, '#F2B84B'], [400, '#F6E6D0']];
  for (const [x, col] of huts) {
    s += `<g transform="translate(${x} 644)"><rect x="-19" y="-44" width="38" height="44" fill="${col}"/>
      <rect x="-19" y="-44" width="38" height="44" fill="url(#pb-stripe)" opacity=".35"/>
      <rect x="4" y="-44" width="15" height="44" fill="#000" opacity=".12"/>
      <path d="M-24,-42 L0,-62 L24,-42Z" fill="${mix(col, C.ink, .35)}"/><rect x="-7" y="-26" width="14" height="26" fill="${mix(col, C.ink, .55)}"/></g>`;
  }
  // verge (grass strip between beach and road)
  s += `<path d="M0,662 L1600,662 L1600,700 L0,700Z" fill="${C.grass}"/>
    <path d="M0,662 L1600,662 L1600,670 L0,670Z" fill="${C.grassLit}"/>`;
  seed = 3;
  let tufts = '';
  for (let i = 0; i < 70; i++) { const x = rnd() * 1600, y = 668 + rnd() * 30, h = 8 + rnd() * 14; tufts += `<path d="M${f(x - 5)},${f(y)} L${f(x - 2)},${f(y - h)} L${f(x)},${f(y)} L${f(x + 3)},${f(y - h * 0.8)} L${f(x + 5)},${f(y)}Z" fill="${rnd() > 0.5 ? C.grassDark : C.grassLit}"/>`; }
  s += tufts;
  // railing along verge
  let rail = `<g id="pb-rail"><rect x="0" y="676" width="1600" height="4" fill="#FBEBD8"/><rect x="0" y="688" width="1600" height="3" fill="#E4C8B8"/>`;
  for (let x = 20; x < 1600; x += 72) rail += `<rect x="${x}" y="670" width="6" height="30" rx="1.5" fill="#FBEBD8"/><rect x="${x + 3}" y="670" width="3" height="30" fill="#D7B8AC"/>`;
  s += rail + '</g>';
  // road
  s += `<rect x="0" y="700" width="1600" height="150" fill="${C.road}"/>
    <rect x="0" y="700" width="1600" height="26" fill="${C.roadFar}"/>
    <rect x="0" y="800" width="1600" height="50" fill="${C.roadNear}"/>
    <rect x="0" y="700" width="1600" height="4" fill="${C.curbShade}"/>`;
  let dashes = '';
  for (let x = -40; x < 1600; x += 157.08) dashes += `<rect x="${f(x)}" y="752" width="78" height="6" rx="3" fill="${C.roadLine}" opacity=".85"/>`;
  s += dashes + `<rect x="0" y="834" width="1600" height="4" fill="${C.roadLine}" opacity=".7"/>`;
  // a few road speckles
  seed = 5; let sp = '';
  for (let i = 0; i < 90; i++) sp += `<rect x="${f(rnd() * 1600)}" y="${f(706 + rnd() * 140)}" width="${f(3 + rnd() * 8)}" height="1.6" rx=".8" fill="${rnd() > .5 ? '#6A5F84' : '#3E3754'}" opacity=".7"/>`;
  s += sp;
  return s;
}
function roadsideBack() {
  let s = '';
  // palm tree (left)
  const px = 70, pyb = 700;
  let fronds = '';
  const fr = [[-160, 1], [-128, 1], [-98, 1], [-60, 1], [-26, 1], [8, 1], [-190, 1]];
  for (const [a] of fr) {
    fronds += `<g transform="translate(${px + 26} ${pyb - 262}) rotate(${a})"><path d="M0,0 C30,-14 70,-10 100,14 C70,4 40,2 0,6Z" fill="${C.grassDeep}"/><path d="M0,0 C30,-14 70,-10 100,14 C70,-2 40,-6 0,0Z" fill="${C.grassDark}"/></g>`;
  }
  s += `<g id="pb-palm"><path d="M${px - 8},${pyb} C${px - 6},${pyb - 90} ${px + 4},${pyb - 190} ${px + 26},${pyb - 262} L${px + 36},${pyb - 258} C${px + 16},${pyb - 188} ${px + 8},${pyb - 90} ${px + 8},${pyb}Z" fill="#8A5E56"/>
    <path d="M${px - 6},${pyb - 40} l14,-3 M${px - 5},${pyb - 90} l14,-4 M${px},${pyb - 140} l14,-4 M${px + 8},${pyb - 188} l14,-4 M${px + 16},${pyb - 228} l13,-4" stroke="#6D4747" stroke-width="3" stroke-linecap="round"/>
    ${fronds}<circle cx="${px + 24}" cy="${pyb - 256}" r="6" fill="#6D4747"/><circle cx="${px + 34}" cy="${pyb - 254}" r="6" fill="#6D4747"/></g>`;
  // lamp post (right)
  const lx = 1360;
  s += `<g id="pb-lamp">
    <circle cx="${lx + 50}" cy="444" r="46" fill="#FFE7A0" opacity=".16"/><circle cx="${lx + 50}" cy="444" r="26" fill="#FFE7A0" opacity=".25"/>
    <rect x="${lx - 5}" y="440" width="10" height="262" fill="${C.frameDark}"/><rect x="${lx - 5}" y="440" width="3.5" height="262" fill="${C.frame}"/>
    <rect x="${lx - 11}" y="684" width="22" height="18" rx="3" fill="${C.frameDark}"/>
    <path d="M${lx},450 C${lx},420 ${lx + 50},414 ${lx + 50},432" fill="none" stroke="${C.frameDark}" stroke-width="6" stroke-linecap="round"/>
    <path d="M${lx + 38},432 L${lx + 62},432 L${lx + 58},452 L${lx + 42},452Z" fill="${C.frameDark}"/>
    <rect x="${lx + 43}" y="436" width="14" height="14" fill="#FFE7A0"/>
  </g>`;
  // signpost
  const sx = 1100;
  s += `<g id="pb-sign"><rect x="${sx - 4}" y="604" width="8" height="98" fill="#7A4A2A"/><rect x="${sx + 70}" y="604" width="8" height="98" fill="#7A4A2A"/>
    <path d="M${sx - 34},596 L${sx + 104},596 L${sx + 122},622 L${sx + 104},648 L${sx - 34},648Z" fill="${C.frame}"/>
    <path d="M${sx - 28},601 L${sx + 101},601 L${sx + 115},622 L${sx + 101},643 L${sx - 28},643Z" fill="none" stroke="${C.accent}" stroke-width="2"/>
    <text x="${sx + 36}" y="620" text-anchor="middle" font-family="WenQuanYi Zen Hei, sans-serif" font-size="15" fill="${C.accent}" letter-spacing="3">鹈鹕湾</text>
    <text x="${sx + 36}" y="637" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-weight="700" font-size="9" fill="${C.accent}" letter-spacing="1.5">PELICAN BAY · 2 km</text></g>`;
  return s;
}
function foreground() {
  let s = '';
  s += `<path d="M0,850 L1600,850 L1600,900 L0,900Z" fill="${C.grassDeep}"/>
    <path d="M0,846 L1600,846 L1600,854 L0,854Z" fill="${C.curb}"/><path d="M0,852 L1600,852 L1600,856 L0,856Z" fill="${C.curbShade}"/>`;
  seed = 21;
  let g = '';
  const blade = (x, y, h, lean, col) => `<path d="M${f(x - 4)},${f(y)} Q${f(x + lean * .4)},${f(y - h * .6)} ${f(x + lean)},${f(y - h)} Q${f(x + lean * .2 + 1)},${f(y - h * .5)} ${f(x + 4)},${f(y)}Z" fill="${col}"/>`;
  for (let i = 0; i < 70; i++) {
    const x = rnd() * 1600; const inBike = x > 520 && x < 960; const h = (inBike ? 14 : 26) + rnd() * (inBike ? 12 : 40);
    g += blade(x, 902, h, (rnd() - 0.5) * 24, rnd() > 0.4 ? C.grassDark : C.grass);
  }
  // ice-plant flowers
  const flower = (x, y, r, col) => { let p = ''; for (let k = 0; k < 8; k++) { const a = k * 45; const q = add([x, y], rotv([r, 0], a)); p += `<ellipse cx="${f(q[0])}" cy="${f(q[1])}" rx="${f(r * 0.7)}" ry="${f(r * 0.32)}" transform="rotate(${a} ${f(q[0])} ${f(q[1])})" fill="${col}"/>`; } return p + `<circle cx="${x}" cy="${y}" r="${f(r * 0.4)}" fill="#F9C74F"/>`; };
  const fl = [[80, 872, 8, '#F07AA0'], [130, 884, 6, '#F5A3BF'], [300, 870, 7, '#F07AA0'], [1080, 876, 8, '#F07AA0'], [1140, 866, 6, '#F5A3BF'], [1420, 878, 9, '#F07AA0'], [1500, 868, 6, '#FBE3EC'], [1290, 888, 6, '#F5A3BF']];
  for (const [x, y, r, c] of fl) g += flower(x, y, r, c);
  // rocks
  g += `<path d="M1520,900 C1520,870 1550,856 1580,860 C1600,862 1610,880 1610,900Z" fill="${C.rock}"/><path d="M1540,868 C1552,860 1570,858 1582,862 C1570,866 1556,868 1540,876Z" fill="${C.rockLit}"/>
    <path d="M190,900 C190,882 210,874 232,878 C248,882 252,892 252,900Z" fill="${C.rock}"/>`;
  // corner clumps of dune grass framing the view
  const clump = (cx, n, hmax, dir) => { let c = ''; for (let i = 0; i < n; i++) { const x = cx + (rnd() - 0.5) * 150, h = hmax * (0.45 + rnd() * 0.55), lean = dir * (10 + rnd() * 40) * (rnd() > .2 ? 1 : -1);
      c += blade(x, 904, h, lean, [C.grassDeep, C.grassDark, C.grass, C.grassLit][Math.floor(rnd() * 4)]); } return c; };
  g += clump(70, 26, 120, 1) + clump(1530, 26, 130, -1);
  g += flower(40, 846, 9, '#F07AA0') + flower(118, 830, 7, '#F5A3BF') + flower(1560, 836, 9, '#F07AA0') + flower(1480, 852, 7, '#FBE3EC');
  s += g;
  return s;
}

// ------------------------------------------------------------------ ASSEMBLE
const B = bike(), Pe = pelican();
const wN = wing(shN, wingN.k, gripN, true), wF = wing(shF, wingF.k, gripF, false);
const riderShadow = `<ellipse cx="-20" cy="3" rx="232" ry="11" fill="#241F33" opacity=".32"/><ellipse cx="-30" cy="2" rx="150" ry="7" fill="#241F33" opacity=".22"/>`;
const wind = `<g id="pb-wind" stroke="#FFF1DC" stroke-linecap="round" opacity=".55"><path d="M-170,-430 L-110,-430" stroke-width="3"/><path d="M-196,-404 L-150,-404" stroke-width="2.4"/><path d="M-180,-330 L-140,-330" stroke-width="2.4"/><path d="M-220,-200 L-150,-200" stroke-width="3"/><path d="M-246,-176 L-206,-176" stroke-width="2.2"/></g>`;
const rider = `
  ${wind}
  <g id="L-shadow">${riderShadow}</g>
  <g id="j-wingFar">${wF.upper}${wF.forearm}${wF.hand}</g>
  ${B.pedalFar}
  <g id="j-footFar">${foot(ankF, aF, false)}</g>
  <g id="j-shankFar">${shank(legF.k, ankF, false)}</g>
  <g id="j-thighFar">${thigh(hipF, legF.k, false)}</g>
  ${B.crankFar}
  ${B.wheels}
  ${B.frame}${B.fork}${B.lamp}${B.saddle}${B.basket}
  ${B.cog}${B.chain}${B.chainring}${B.crankNear}
  ${Pe.tail}${Pe.body}${Pe.neck}${Pe.scarf}
  ${B.bars}
  ${B.pedalNear}
  <g id="j-shankNear">${shank(legN.k, ankN, true)}</g>
  <g id="j-footNear">${foot(ankN, aN, true)}</g>
  <g id="j-thighNear">${thigh(hipN, legN.k, true)}</g>
  ${Pe.pouch}${Pe.billLower}${Pe.billUpper}${Pe.head}${Pe.eye}${Pe.crest}
  <g id="j-wingNear">${wN.upper}${wN.forearm}${wN.hand}</g>`;

function svg(viewBox, w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${w}" height="${h}">
<title>Pelican Bay — style A (flat geometric)</title>
<defs>
  <pattern id="pb-stripe" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="5" height="10" fill="#FFFFFF"/></pattern>
</defs>
<g id="L-world">${scene()}${roadsideBack()}</g>
<g id="L-rider" transform="translate(680 790)">${rider}</g>
<g id="L-foreground">${foreground()}</g>
</svg>`;
}
fs.writeFileSync(path.join(HERE, 'keyframe.svg'), svg('0 0 1600 900', 1600, 900));
fs.writeFileSync(path.join(HERE, 'closeup.svg'), svg('440 220 560 580', 1120, 1160));
console.log('ok', { kneeN: legN.k.map(f), elbowN: wingN.k.map(f), ankN: ankN.map(f) });
