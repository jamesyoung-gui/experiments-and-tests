// Pelican Bay, style B (warm storybook gouache). Generates keyframe.svg + closeup.svg.
// usage: node gen.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------- helpers ----------
const D = Math.PI / 180;
const f = n => (Math.round(n * 10) / 10).toString();
const P = (x, y) => `${f(x)},${f(y)}`;
const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const rr = (a, b) => a + (b - a) * rnd();

// closed / open Catmull-Rom -> cubic path
function cr(pts, closed = true, k = 1 / 6) {
  const n = pts.length; let d = `M${P(...pts[0])}`;
  const g = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2 = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    d += `C${P(...c1)} ${P(...c2)} ${P(...p2)}`;
  }
  return d + (closed ? 'Z' : '');
}
// blobby cloud outline from circles along a baseline
function puff(cx, cy, w, h, n, flat = 0.25) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = cx - w / 2 + w * t;
    const bump = Math.sin(Math.PI * t) ** 0.8 * h * rr(0.7, 1.15);
    pts.push([x, cy - bump]);
  }
  pts.push([cx + w / 2 + h * 0.2, cy + h * flat * 0.4]);
  for (let i = n; i >= 0; i -= 2) pts.push([cx - w / 2 + w * i / n, cy + h * flat * rr(0.3, 0.6)]);
  pts.push([cx - w / 2 - h * 0.2, cy + h * flat * 0.3]);
  return cr(pts);
}

// ---------- palette (golden hour, grade already folded in) ----------
const C = {
  ink: '#4A2C20', inkSoft: '#6B4632',
  plume: '#FFF6EC', plumeShade: '#E9D3D2', plumeDeep: '#C7AFC2',
  flight: '#231D26', flightSheen: '#4A4458',
  bill: '#F4A284', billEdge: '#D9705A', billDark: '#C25B48', nail: '#E0503A',
  pouch0: '#FAC957', pouch1: '#F29A3A',
  skin: '#F7BBAA', iris: '#8B1E1E',
  foot: '#F08A3C', web: '#F7A860', footDark: '#C9652A',
  frame: '#1F8A8A', frameHi: '#5CC0B2', frameLo: '#146466', cream: '#F6EAD0', creamLo: '#D8C3A0',
  saddle: '#7A4A2A', saddleHi: '#A86C40', basket: '#C89B5E', basketLo: '#9A6E3C', basketHi: '#E4BE80',
  tyre: '#3B2C2A', steel: '#D9D2C8', steelLo: '#9C918C',
  rim: '#FFC47A', scarf: '#D8443A', scarfLo: '#A82E2E', scarfStripe: '#FBE3B8',
};
// far-side variants: darker and cooler (shade of the body)
function far(hex, k = 0.78) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const s = [0.92, 0.9, 1.0];
  const m = [r, g, b].map((v, i) => Math.round(Math.min(255, v * k * s[i] + 10 * (i === 2))));
  return '#' + m.map(v => v.toString(16).padStart(2, '0')).join('');
}

// ---------- rig (spec §1, §2) at crank phi = 0 ----------
const BB = [0, -80], CR = 50;
const PELVIS = [-45, -300];
const HIP_N = [PELVIS[0] + 8, PELVIS[1]], HIP_F = [PELVIS[0] + 4, PELVIS[1] - 3];
const SH_N = [PELVIS[0] + 80, PELVIS[1] - 78], SH_F = [PELVIS[0] + 75, PELVIS[1] - 83];
const GRIP_N = [114, -275], GRIP_F = [111, -277];
const HEAD = [125, -520];
const NECK0 = [PELVIS[0] + 112, PELVIS[1] - 92];

function ik2(h, t, L1, L2, bend) {
  let dx = t[0] - h[0], dy = t[1] - h[1];
  let d = Math.hypot(dx, dy);
  d = Math.max(Math.abs(L1 - L2) + 1, Math.min(0.999 * (L1 + L2), d));
  const base = Math.atan2(dy, dx);
  const a = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d));
  const a1 = base + bend * a;
  const j = [h[0] + L1 * Math.cos(a1), h[1] + L1 * Math.sin(a1)];
  const a2 = Math.atan2(t[1] - j[1], t[0] - j[0]);
  return { a1, a2, j };
}
function legPose(phi, hip) {
  const pedal = [BB[0] + CR * Math.cos(phi), BB[1] + CR * Math.sin(phi)];
  const alpha = (8 + 10 * Math.cos(phi - 135 * D)) * D;
  const o = rot(-17, -9, alpha);
  const ankle = [pedal[0] + o[0], pedal[1] + o[1]];
  const k = ik2(hip, ankle, 142, 134, -1);
  return { pedal, alpha, ankle, ...k };
}
const legN = legPose(0, HIP_N), legF = legPose(Math.PI, HIP_F);
const wingN = ik2(SH_N, GRIP_N, 78, 74, +1), wingF = ik2(SH_F, GRIP_F, 78, 74, +1);
console.log('near knee', legN.j.map(f), 'thigh', f(legN.a1 / D), 'shank', f(legN.a2 / D));
console.log('near elbow', wingN.j.map(f), 'upper', f(wingN.a1 / D), 'lower', f(wingN.a2 / D));

const tr = (x, y, a = 0) => `translate(${f(x)} ${f(y)})${a ? ` rotate(${f(a)})` : ''}`;
const slot = (name, xf, body) => `<g id="j-${name}" transform="${xf}">${body}</g>\n`;
const S = (w = 3) => `stroke="${C.ink}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

// ---------- defs ----------
const defs = `
<linearGradient id="gSky" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#3A5AA3"/><stop offset=".32" stop-color="#7C79B4"/>
  <stop offset=".6" stop-color="#D98A80"/><stop offset=".82" stop-color="#F3AE78"/><stop offset="1" stop-color="#FFD9A0"/>
</linearGradient>
<radialGradient id="gSunGlow" cx="1451" cy="330" r="520" gradientUnits="userSpaceOnUse">
  <stop offset="0" stop-color="#FFF4C8" stop-opacity=".95"/><stop offset=".18" stop-color="#FFD9A0" stop-opacity=".7"/>
  <stop offset=".5" stop-color="#FFB27A" stop-opacity=".25"/><stop offset="1" stop-color="#FFB27A" stop-opacity="0"/>
</radialGradient>
<linearGradient id="gSea" x1="0" y1="470" x2="0" y2="625" gradientUnits="userSpaceOnUse">
  <stop offset="0" stop-color="#8E86BC"/><stop offset=".35" stop-color="#6A78B0"/><stop offset="1" stop-color="#34557F"/>
</linearGradient>
<linearGradient id="gSeaSheen" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#FFC98E" stop-opacity="0"/><stop offset=".6" stop-color="#FFC98E" stop-opacity=".25"/>
  <stop offset=".9" stop-color="#FFE2A8" stop-opacity=".6"/><stop offset="1" stop-color="#FFE2A8" stop-opacity=".3"/>
</linearGradient>
<linearGradient id="gRoad" x1="0" y1="690" x2="0" y2="870" gradientUnits="userSpaceOnUse">
  <stop offset="0" stop-color="#B08E90"/><stop offset=".5" stop-color="#94777F"/><stop offset="1" stop-color="#6F5A68"/>
</linearGradient>
<linearGradient id="gRoadSun" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#FFC98E" stop-opacity="0"/><stop offset="1" stop-color="#FFC98E" stop-opacity=".35"/>
</linearGradient>
<linearGradient id="gSand" x1="0" y1="600" x2="0" y2="700" gradientUnits="userSpaceOnUse">
  <stop offset="0" stop-color="#F2C694"/><stop offset="1" stop-color="#D9A277"/>
</linearGradient>
<linearGradient id="gPouch" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="${C.pouch0}"/><stop offset="1" stop-color="${C.pouch1}"/>
</linearGradient>
<linearGradient id="gPouchF" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#FFE08A"/><stop offset="1" stop-color="#F7B04A"/>
</linearGradient>
<linearGradient id="gBill" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#FAB99A"/><stop offset="1" stop-color="${C.bill}"/>
</linearGradient>
<radialGradient id="gLamp" cx=".5" cy=".5" r=".5">
  <stop offset="0" stop-color="#FFF6D0" stop-opacity="1"/><stop offset=".3" stop-color="#FFE39A" stop-opacity=".6"/>
  <stop offset="1" stop-color="#FFC36A" stop-opacity="0"/>
</radialGradient>
<radialGradient id="gVignette" cx="800" cy="480" r="980" gradientUnits="userSpaceOnUse">
  <stop offset=".55" stop-color="#3A1E2A" stop-opacity="0"/><stop offset="1" stop-color="#3A1E2A" stop-opacity=".38"/>
</radialGradient>
<linearGradient id="gBeam" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#FFF1C0" stop-opacity=".55"/><stop offset="1" stop-color="#FFF1C0" stop-opacity="0"/>
</linearGradient>

<!-- hand-drawn wobble: displaces edges by a couple of px -->
<filter id="wob" x="-10%" y="-10%" width="120%" height="120%">
  <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="2" seed="4" result="n"/>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="4.5" xChannelSelector="R" yChannelSelector="G"/>
</filter>
<filter id="wobBig" x="-5%" y="-5%" width="110%" height="110%">
  <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="11" result="n"/>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="10" xChannelSelector="R" yChannelSelector="G"/>
</filter>
<!-- soft painted edge for distant things -->
<filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
  <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed="2" result="n"/>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="14" xChannelSelector="R" yChannelSelector="G" result="d"/>
  <feGaussianBlur in="d" stdDeviation="1.6"/>
</filter>
<filter id="blur6" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="blur3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="blur12" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
<!-- gouache paper: fine grain + large mottling, applied as soft-light overlays -->
<filter id="grain" x="0" y="0" width="1600" height="900" filterUnits="userSpaceOnUse">
  <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="9"/>
  <feColorMatrix type="saturate" values="0"/>
  <feComponentTransfer><feFuncR type="linear" slope="1.6" intercept="-0.3"/><feFuncG type="linear" slope="1.6" intercept="-0.3"/><feFuncB type="linear" slope="1.6" intercept="-0.3"/><feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer>
</filter>
<filter id="mottle" x="0" y="0" width="1600" height="900" filterUnits="userSpaceOnUse">
  <feTurbulence type="fractalNoise" baseFrequency="0.006 0.012" numOctaves="4" seed="21"/>
  <feColorMatrix type="saturate" values="0"/>
  <feComponentTransfer><feFuncR type="linear" slope="2.2" intercept="-0.6"/><feFuncG type="linear" slope="2.2" intercept="-0.6"/><feFuncB type="linear" slope="2.2" intercept="-0.6"/><feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer>
</filter>
<filter id="brush" x="0" y="0" width="1600" height="900" filterUnits="userSpaceOnUse">
  <feTurbulence type="fractalNoise" baseFrequency="0.004 0.09" numOctaves="3" seed="5"/>
  <feColorMatrix type="saturate" values="0"/>
  <feComponentTransfer><feFuncR type="linear" slope="2" intercept="-0.5"/><feFuncG type="linear" slope="2" intercept="-0.5"/><feFuncB type="linear" slope="2" intercept="-0.5"/><feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer>
</filter>
`;

// ======================================================================
// SCENE
// ======================================================================
let scene = '';

// ---- sky ----
scene += `<g id="L-sky"><rect width="1600" height="480" fill="url(#gSky)"/>
<rect width="1600" height="480" fill="#FFE3B0" filter="url(#brush)" opacity=".10" style="mix-blend-mode:soft-light"/>
<rect width="1600" height="480" fill="url(#gSunGlow)"/></g>\n`;

// ---- sun ----
scene += `<g id="L-sunmoon">
<circle cx="1451" cy="330" r="92" fill="#FFE7A8" opacity=".45" filter="url(#blur12)"/>
<circle cx="1451" cy="330" r="46" fill="#FFF3C6" filter="url(#soft)"/>
<circle cx="1451" cy="330" r="38" fill="#FFFBE6" opacity=".8" filter="url(#blur3)"/>
</g>\n`;

// ---- clouds ----
function cloud(cx, cy, w, h, n, lit = '#FFD7B0', shade = '#B889A6', mid = '#E7A8A4', s = 1) {
  seed = s;
  const base = puff(cx, cy, w, h, n);
  seed = s + 3;
  const top = puff(cx + w * 0.05, cy - h * 0.18, w * 0.86, h * 0.9, n - 1);
  seed = s + 5;
  const hi = puff(cx + w * 0.12, cy - h * 0.38, w * 0.6, h * 0.65, Math.max(3, n - 3));
  return `<g filter="url(#soft)"><path d="${base}" fill="${shade}"/><path d="${top}" fill="${mid}"/><path d="${hi}" fill="${lit}" opacity=".95"/></g>`;
}
scene += `<g id="L-clouds">
${cloud(300, 205, 520, 95, 9, '#F9D2B6', '#9E86B0', '#D7A4AE', 3)}
${cloud(130, 150, 260, 55, 6, '#F3C9B8', '#8F80AE', '#C99AB0', 17)}
${cloud(890, 118, 380, 62, 7, '#FFD9B6', '#A38AB2', '#DEA6AA', 29)}
${cloud(1250, 222, 300, 44, 6, '#FFE6BE', '#C99098', '#F1B39E', 41)}
${cloud(1560, 150, 260, 50, 5, '#FFE2B6', '#B98CA2', '#EDAEA0', 53)}
<g filter="url(#soft)" opacity=".85">
  <path d="M40,395 C220,385 420,392 560,398 C420,404 200,404 40,395Z" fill="#F6B99A"/>
  <path d="M640,420 C820,412 1010,418 1120,424 C990,430 780,430 640,420Z" fill="#FFD0A0"/>
  <path d="M980,372 C1080,366 1200,368 1290,374 C1200,380 1060,380 980,372Z" fill="#FFD8A8"/>
</g>
</g>\n`;

// gulls (hand-drawn Ms)
const gull = (x, y, s, a = 0) => `<path transform="${tr(x, y, a)} scale(${s})" d="M-14,2 Q-8,-7 0,1 Q8,-7 14,2" fill="none" ${S(2.4 / s)}/>`;
scene += `<g id="L-gulls-far" opacity=".85">${gull(560, 150, 1.3, -4)}${gull(612, 176, 1, 6)}${gull(1040, 205, 0.9)}${gull(1090, 188, 0.7, -8)}</g>\n`;

// ---- far hills ----
scene += `<g id="L-hills-far" filter="url(#soft)">
<path d="M-20,472 C60,440 130,418 210,425 C290,432 340,452 420,462 C470,468 520,470 560,472Z" fill="#9C7FA8"/>
<path d="M-20,472 C40,455 90,448 150,452 C220,456 260,466 320,472Z" fill="#86709E"/>
<path d="M1040,472 C1080,452 1110,420 1160,398 C1200,381 1250,378 1300,386 C1360,396 1420,410 1500,418 C1550,424 1590,430 1620,432 L1620,472Z" fill="#A7789A"/>
<path d="M1150,400 C1200,381 1250,378 1300,386" fill="none" stroke="#FFC98E" stroke-width="4" opacity=".8"/>
<path d="M1090,472 C1120,450 1150,436 1190,430 C1230,425 1265,436 1290,452 L1320,472Z" fill="#8E6A92"/>
</g>\n`;

// ---- lighthouse ----
{
  const x = 1205, base = 393, top = 262;
  const w0 = 17, w1 = 11;
  const band = (y0, y1, col) => {
    const k0 = (base - y0) / (base - top), k1 = (base - y1) / (base - top);
    const a0 = w0 + (w1 - w0) * k0, a1 = w0 + (w1 - w0) * k1;
    return `<path d="M${P(x - a0, y0)} L${P(x + a0, y0)} L${P(x + a1, y1)} L${P(x - a1, y1)}Z" fill="${col}"/>`;
  };
  scene += `<g id="L-lighthouse">
  <path d="M1212,${top - 12} L1560,${top - 56} L1560,${top + 30}Z" fill="url(#gBeam)" opacity=".4" filter="url(#blur6)"/>
  <g filter="url(#wob)">
  ${band(base, 360, '#F4E6DA')}${band(360, 334, '#C9484A')}${band(334, 308, '#F4E6DA')}${band(308, 283, '#C9484A')}${band(283, top, '#F4E6DA')}
  <path d="M${P(x - w0, base)} L${P(x - w1, top)} L${P(x + w1, top)} L${P(x + w0, base)}" fill="none" ${S(2.2)}/>
  <path d="M${P(x + 5, base)} L${P(x + 4, top)} L${P(x + w1, top)} L${P(x + w0, base)}Z" fill="#FFC98E" opacity=".45"/>
  <rect x="${x - 15}" y="${top - 4}" width="30" height="5" rx="1.5" fill="#3B2C34" ${S(1.6)}/>
  <rect x="${x - 9}" y="${top - 19}" width="18" height="15" fill="#FFF0B8" ${S(1.6)}/>
  <path d="M${x - 12},${top - 19} Q${x},${top - 34} ${x + 12},${top - 19}Z" fill="#C9484A" ${S(1.6)}/>
  <circle cx="${x}" cy="${top - 36}" r="2" fill="${C.ink}"/>
  <rect x="${x - 3}" y="${322}" width="6" height="9" rx="2" fill="#3B2C34"/>
  </g>
  <circle cx="${x}" cy="${top - 12}" r="30" fill="url(#gLamp)"/>
  </g>\n`;
}

// ---- sea ----
{
  let waves = '';
  seed = 99;
  for (let i = 0; i < 70; i++) {
    const y = 480 + (i / 70) ** 1.3 * 135;
    const x = rr(-40, 1600);
    const w = 18 + (y - 470) * 0.45 * rr(0.6, 1.3);
    const near = (y - 470) / 150;
    waves += `<path d="M${P(x, y)} q${f(w / 2)},${f(-2 - near * 3)} ${f(w)},0" fill="none" stroke="${rnd() < .5 ? '#A7B2DA' : '#8E9CCB'}" stroke-width="${f(1.4 + near * 2)}" stroke-linecap="round" opacity="${f(0.5 + near * 0.3)}"/>`;
  }
  let glit = '';
  for (let i = 0; i < 46; i++) {
    const y = 474 + (i / 46) ** 1.2 * 138;
    const spread = 18 + (y - 470) * 1.1;
    const x = 1451 + rr(-spread, spread) * 0.9;
    const w = 10 + (y - 470) * 0.5 * rr(.4, 1.2);
    glit += `<path d="M${P(x - w / 2, y)} h${f(w)}" stroke="${rnd() < .4 ? '#FFF6D6' : '#FFD99A'}" stroke-width="${f(1.6 + (y - 470) / 50)}" stroke-linecap="round" opacity="${f(rr(.6, .95))}"/>`;
  }
  // sailboat
  const boat = `<g transform="translate(330 524)" filter="url(#wob)">
    <path d="M-40,0 L38,0 Q30,12 -30,12Z" fill="#8A4A3E" ${S(2)}/>
    <path d="M-2,-4 L-2,-88" ${S(2.4)} fill="none"/>
    <path d="M0,-84 Q32,-44 34,-6 L0,-6Z" fill="#FFE8C6" ${S(2)}/>
    <path d="M-5,-78 Q-30,-40 -34,-6 L-5,-6Z" fill="#F4B48E" ${S(2)}/>
    <path d="M-2,-88 l12,4 l-12,4Z" fill="#D8443A" ${S(1.2)}/>
    <path d="M20,-40 Q30,-24 32,-8" fill="none" stroke="#FFD49A" stroke-width="3" opacity=".8"/>
  </g>
  <path d="M290,538 q20,4 40,0 q20,-4 40,0" fill="none" stroke="#C6CCEA" stroke-width="2" opacity=".6"/>`;
  const tiny = `<g transform="translate(900 486) scale(.45)" opacity=".9"><path d="M-30,0 L30,0 Q24,8 -24,8Z" fill="#6E4460"/><path d="M0,-2 L0,-60 Q24,-30 26,-4Z" fill="#FFD8B8"/><path d="M-3,-54 Q-20,-28 -22,-4 L-3,-4Z" fill="#E9A890"/></g>`;
  scene += `<g id="L-sea"><rect x="0" y="468" width="1600" height="160" fill="url(#gSea)"/>
  <rect x="0" y="468" width="1600" height="160" fill="url(#gSeaSheen)"/>
  <rect x="0" y="468" width="1600" height="3" fill="#FFE0B0" opacity=".7"/>
  ${waves}${glit}</g>
  <g id="L-boats">${boat}${tiny}</g>\n`;
}

// ---- shore: sand, foam, dune grass, fence ----
{
  let grass = '';
  seed = 5;
  for (let i = 0; i < 90; i++) {
    const x = rr(-10, 1610), y = 668 + rr(-4, 18);
    const h = rr(14, 34), lean = rr(-10, 12);
    grass += `<path d="M${P(x, y)} q${f(lean * 0.3)},${f(-h * 0.6)} ${f(lean)},${f(-h)}" fill="none" stroke="${rnd() < .5 ? '#A79A5A' : '#C6B06A'}" stroke-width="${f(rr(1.6, 2.8))}" stroke-linecap="round"/>`;
  }
  let fence = '';
  const posts = [];
  for (let x = 40; x < 1600; x += 118) posts.push(x);
  posts.forEach((x, i) => {
    fence += `<path d="M${x - 5},${700} L${x - 4},${650} Q${x},${644} ${x + 4},${650} L${x + 5},${700}Z" fill="#8A5E44" ${S(2)}/>`;
    fence += `<path d="M${x + 2},${652} L${x + 3},${698}" stroke="#FFC98E" stroke-width="2" opacity=".6"/>`;
    if (i < posts.length - 1) {
      const nx = posts[i + 1];
      fence += `<path d="M${x + 4},${660} Q${(x + nx) / 2},${676} ${nx - 4},${660}" fill="none" stroke="#6B4632" stroke-width="3"/>`;
      fence += `<path d="M${x + 4},${680} Q${(x + nx) / 2},${692} ${nx - 4},${680}" fill="none" stroke="#6B4632" stroke-width="2.5"/>`;
    }
  });
  scene += `<g id="L-shore">
  <path d="M0,612 C200,606 420,616 640,610 C860,604 1100,614 1320,608 C1450,605 1540,610 1600,608 L1600,700 L0,700Z" fill="url(#gSand)" filter="url(#wob)"/>
  <path d="M0,613 C60,606 110,618 170,611 C230,604 280,619 350,612 C420,605 470,618 540,611 C610,604 680,617 750,610 C820,604 880,617 950,610 C1020,604 1090,617 1160,609 C1230,603 1300,616 1370,608 C1440,602 1520,616 1600,608"
     fill="none" stroke="#FFF6E6" stroke-width="5" stroke-linecap="round" filter="url(#wob)" opacity=".95"/>
  <path d="M0,622 C120,618 260,626 400,620 M620,624 C760,618 900,626 1040,620 M1200,622 C1320,617 1460,625 1600,619" fill="none" stroke="#FFF2DE" stroke-width="2" opacity=".6"/>
  <path d="M0,660 C200,640 380,650 560,646 C760,641 960,652 1160,644 C1340,637 1480,648 1600,642 L1600,705 L0,705Z" fill="#C9A06E" filter="url(#wob)"/>
  <path d="M0,661 C200,641 380,651 560,647 C760,642 960,653 1160,645 C1340,638 1480,649 1600,643" fill="none" stroke="#FFD8A0" stroke-width="3" opacity=".7"/>
  ${grass}
  <g filter="url(#wob)">${fence}</g>
  </g>\n`;
}

// ---- roadside: palms, signpost, lamp ----
{
  const palm = (x, y, h, lean, s) => {
    seed = s;
    const top = [x + lean, y - h];
    const trunk = `M${x - 9},${y} C${x - 6},${y - h * .4} ${top[0] - 10},${top[1] + h * .3} ${top[0] - 4},${top[1]} L${top[0] + 4},${top[1]} C${top[0] - 2},${top[1] + h * .3} ${x + 4},${y - h * .4} ${x + 9},${y}Z`;
    let rings = '';
    for (let i = 1; i < 11; i++) {
      const t = i / 11;
      const cx = x + (top[0] - x) * t * t, cy = y - h * t;
      rings += `<path d="M${P(cx - 8 + t * 3, cy)} q${f(8 - t * 3)},4 ${f(16 - t * 6)},0" fill="none" stroke="#5E3A2A" stroke-width="1.6"/>`;
    }
    let fronds = '';
    const angs = [-165, -135, -100, -60, -25, 10, 35, 160];
    angs.forEach((a, i) => {
      const L = rr(70, 95), ar = a * D;
      const ex = top[0] + Math.cos(ar) * L, ey = top[1] + Math.sin(ar) * L * 0.7 + L * 0.35;
      const mx = top[0] + Math.cos(ar) * L * .5, my = top[1] + Math.sin(ar) * L * .45 - 12;
      fronds += `<path d="M${P(...top)} Q${P(mx, my - 8)} ${P(ex, ey)} Q${P(mx + 4, my + 12)} ${P(...top)}Z" fill="${i % 2 ? '#5E8A4E' : '#739A55'}" ${S(2)}/>`;
      fronds += `<path d="M${P(...top)} Q${P(mx, my)} ${P(ex, ey)}" fill="none" stroke="#3F5E36" stroke-width="1.4"/>`;
    });
    return `<g filter="url(#wob)"><path d="${trunk}" fill="#9A6B4C" ${S(2.2)}/>${rings}<path d="M${x + 4},${y - 4} C${x + 4},${y - h * .4} ${top[0] - 2},${top[1] + h * .3} ${top[0] + 2},${top[1] + 6}" fill="none" stroke="#FFC98E" stroke-width="2.4" opacity=".55"/>${fronds}
      <circle cx="${top[0] - 5}" cy="${top[1] + 6}" r="6" fill="#6B4A2A" ${S(1.5)}/><circle cx="${top[0] + 5}" cy="${top[1] + 8}" r="5.5" fill="#7A5430" ${S(1.5)}/></g>`;
  };
  const sign = `<g transform="translate(262 700)" filter="url(#wob)">
    <path d="M-6,0 L-5,-128 L5,-128 L6,0Z" fill="#8A5E44" ${S(2.2)}/>
    <path d="M-78,-122 L66,-126 L88,-108 L66,-90 L-78,-88Z" fill="#E9C58E" ${S(2.4)}/>
    <path d="M-70,-116 L60,-119" stroke="#FFE4B0" stroke-width="2" opacity=".7"/>
    <text x="-4" y="-99" text-anchor="middle" font-family="'WenQuanYi Zen Hei','PingFang SC','Noto Sans CJK SC','Microsoft YaHei',sans-serif" font-size="25" font-weight="700" fill="${C.inkSoft}" letter-spacing="4">鹈鹕湾</text>
    <path d="M70,-80 L-64,-83 L-84,-67 L-64,-51 L70,-49Z" fill="#DDB27A" ${S(2.4)}/>
    <text x="0" y="-60" text-anchor="middle" font-family="Georgia,'DejaVu Serif','Times New Roman',serif" font-style="italic" font-size="19" font-weight="700" fill="${C.inkSoft}">Pelican Bay</text>
    <circle cx="-70" cy="-105" r="2.2" fill="${C.ink}"/><circle cx="58" cy="-65" r="2.2" fill="${C.ink}"/>
    <path d="M-14,-4 q14,-16 28,0" fill="#739A55" ${S(1.8)}/>
  </g>`;
  const lamp = (x, y) => `<g transform="translate(${x} ${y})">
    <circle cx="0" cy="-222" r="70" fill="url(#gLamp)" opacity=".85"/>
    <g filter="url(#wob)">
    <path d="M-10,0 L-7,-18 L7,-18 L10,0Z" fill="#2F4A4E" ${S(2)}/>
    <path d="M-3,-18 L-3,-196 L3,-196 L3,-18Z" fill="#35575B" ${S(2)}/>
    <path d="M3,-150 q18,-6 14,-22" fill="none" ${S(2)}/>
    <path d="M-12,-200 L12,-200 L9,-208 L-9,-208Z" fill="#2F4A4E" ${S(2)}/>
    <path d="M-9,-208 L-11,-236 L11,-236 L9,-208Z" fill="#FFEFB0" ${S(2)}/>
    <path d="M-15,-236 L15,-236 L0,-252Z" fill="#2F4A4E" ${S(2)}/>
    <circle cx="0" cy="-255" r="3" fill="#2F4A4E" ${S(1.5)}/>
    <path d="M2,-190 L2,-30" stroke="#FFC98E" stroke-width="1.6" opacity=".7"/>
    </g></g>`;
  // beach umbrella + hut small on dune, far right
  const umb = `<g transform="translate(1480 650)" filter="url(#wob)">
    <path d="M0,0 L-6,-62" ${S(2.2)}/>
    <path d="M-48,-52 Q-8,-92 36,-66 Q-8,-66 -48,-52Z" fill="#F3E3C8" ${S(2)}/>
    <path d="M-48,-52 Q-26,-70 -12,-80 Q-18,-62 -30,-56Z M-4,-82 Q14,-78 36,-66 Q16,-66 4,-64Z" fill="#D8443A"/>
  </g>`;
  scene += `<g id="L-roadside">${palm(78, 704, 250, 38, 3)}${palm(150, 706, 190, -22, 8)}${sign}${umb}${lamp(1330, 704)}</g>\n`;
}

// ---- road ----
{
  let spk = '';
  seed = 31;
  for (let i = 0; i < 260; i++) {
    const x = rr(0, 1600), y = rr(700, 860);
    spk += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(rr(.8, 2.2))}" fill="${rnd() < .5 ? '#7C6470' : '#C2A2A0'}" opacity=".55"/>`;
  }
  let dash = '';
  for (let x = -20; x < 1600; x += 157.08) dash += `<path d="M${f(x)},748 L${f(x + 70)},747" stroke="#F6E2BC" stroke-width="7" stroke-linecap="round"/>`;
  scene += `<g id="L-road">
  <path d="M0,694 C400,690 800,697 1200,692 C1400,690 1500,693 1600,692 L1600,870 L0,870Z" fill="url(#gRoad)" filter="url(#wob)"/>
  <rect x="0" y="690" width="1600" height="180" fill="url(#gRoadSun)"/>
  <path d="M0,697 C400,693 800,700 1200,695 C1400,693 1500,696 1600,695" fill="none" stroke="#FFD2A0" stroke-width="4" opacity=".7"/>
  ${spk}
  <g filter="url(#wob)">${dash}<path d="M0,852 C400,848 800,855 1200,850 C1400,848 1500,851 1600,850" fill="none" stroke="#F1D9B4" stroke-width="5" opacity=".85"/></g>
  </g>\n`;
}

// ---- shadow ----
scene += `<g id="L-shadow"><ellipse cx="610" cy="792" rx="230" ry="11" fill="#4A2E4A" opacity=".32" filter="url(#blur3)"/>
<ellipse cx="555" cy="791" rx="60" ry="5" fill="#4A2E4A" opacity=".25"/><ellipse cx="853" cy="791" rx="46" ry="5" fill="#4A2E4A" opacity=".3"/></g>\n`;

// ---- wind swooshes (behind rider) ----
scene += `<g id="L-fx-back" fill="none" stroke="#FFF3DC" stroke-linecap="round" opacity=".75" filter="url(#wob)">
<path d="M330,520 C380,510 420,512 452,522 c16,5 14,22 -2,20 c-10,-2 -8,-12 2,-12" stroke-width="3.5"/>
<path d="M300,590 C350,584 390,586 430,594" stroke-width="3"/>
<path d="M360,452 C400,446 430,448 458,455" stroke-width="2.6"/>
<path d="M400,690 C430,686 450,688 470,692" stroke-width="2.4"/>
</g>\n`;

// ======================================================================
// BIKE
// ======================================================================
const RH = [-125, -100], FH = [173, -100];
function wheel(far = false) {
  const R = 100;
  let spokes = '';
  for (let i = 0; i < 32; i++) {
    const ar = i * 11.25 * D;
    const side = i % 2 ? 1 : -1;
    const ah = ar + side * 67.5 * D;
    const hr = 11;
    spokes += `M${P(Math.cos(ah) * hr, Math.sin(ah) * hr)}L${P(Math.cos(ar) * 88, Math.sin(ar) * 88)}`;
  }
  return `
  <circle r="95.5" fill="none" stroke="${C.tyre}" stroke-width="9"/>
  <circle r="98.6" fill="none" stroke="${C.ink}" stroke-width="2.6"/>
  <circle r="92.6" fill="none" stroke="#E9D6B4" stroke-width="2.2" opacity=".9"/>
  <circle r="89.5" fill="none" stroke="${C.steel}" stroke-width="3.2"/>
  <circle r="87.6" fill="none" stroke="${C.ink}" stroke-width="1.2" opacity=".8"/>
  <path d="${spokes}" stroke="#E8DECF" stroke-width="1.3" opacity=".9"/>
  <path d="${spokes}" stroke="${C.ink}" stroke-width=".5" opacity=".35"/>
  <circle r="13" fill="${C.steel}" ${S(1.8)}/><circle r="6" fill="${C.steelLo}" ${S(1.4)}/>
  <path d="M-88,-6 l-5,0 l0,12 l5,0Z" fill="#E08A3A" ${S(1)} transform="rotate(-40)"/>
  <path d="M0,-89 l0,-6" stroke="${C.steelLo}" stroke-width="3" transform="rotate(130)"/>
  <path d="M-58,-72 A92,92 0 0 1 20,-90" fill="none" stroke="#FFD8A0" stroke-width="2.4" opacity=".55" transform="rotate(30)"/>`;
}
function teeth(n, rp, rt) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = i / n * 2 * Math.PI, h = Math.PI / n * 0.45;
    const p = r => ang => P(Math.cos(ang) * r, Math.sin(ang) * r);
    d += `${i ? 'L' : 'M'}${p(rp - 2)(a - h * 1.6)}L${p(rt)(a - h * .6)}L${p(rt)(a + h * .6)}L${p(rp - 2)(a + h * 1.6)}`;
  }
  return d + 'Z';
}

const bike = {};
bike.wheelRear = slot('wheelRear', tr(...RH), wheel());
bike.wheelFront = slot('wheelFront', tr(...FH), wheel());

// frame (rider-local) incl. fenders, rack, saddle
{
  const ST = [-46.5, -232], HTT = [112, -245], HTB = [125.6, -203.2];
  const tt0 = [-44.5, -226], tt1 = [113.4, -240];
  const dt1 = [123.5, -210];
  const tube = (a, b, w, col = C.frame) =>
    `<path d="M${P(...a)}L${P(...b)}" stroke="${C.ink}" stroke-width="${w + 5}" stroke-linecap="round"/><path d="M${P(...a)}L${P(...b)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
  const hi = (a, b, w) => `<path d="M${P(...a)}L${P(...b)}" stroke="${C.frameHi}" stroke-width="${w}" stroke-linecap="round" opacity=".8"/>`;
  const fender = (c, a0, a1) => {
    const r = 107;
    const p0 = [c[0] + r * Math.cos(a0 * D), c[1] + r * Math.sin(a0 * D)];
    const p1 = [c[0] + r * Math.cos(a1 * D), c[1] + r * Math.sin(a1 * D)];
    return `<path d="M${P(...p0)}A${r},${r} 0 0 1 ${P(...p1)}" fill="none" stroke="${C.ink}" stroke-width="12" stroke-linecap="round"/>
    <path d="M${P(...p0)}A${r},${r} 0 0 1 ${P(...p1)}" fill="none" stroke="${C.cream}" stroke-width="7" stroke-linecap="round"/>
    <path d="M${P(c[0] + (r + 1.5) * Math.cos((a0 + 20) * D), c[1] + (r + 1.5) * Math.sin((a0 + 20) * D))}A${r + 1.5},${r + 1.5} 0 0 1 ${P(c[0] + (r + 1.5) * Math.cos((a1 - 10) * D), c[1] + (r + 1.5) * Math.sin((a1 - 10) * D))}" fill="none" stroke="#FFFFFF" stroke-width="2" opacity=".7"/>`;
  };
  // rear rack + towel roll
  const rack = `<path d="M${P(-44, -222)} L${P(-150, -214)} M${P(-150, -214)} L${P(-125, -100)} M${P(-100, -216)} L${P(-122, -104)}" fill="none" stroke="${C.ink}" stroke-width="6" stroke-linecap="round"/>
  <path d="M${P(-44, -222)} L${P(-150, -214)} M${P(-150, -214)} L${P(-125, -100)} M${P(-100, -216)} L${P(-122, -104)}" fill="none" stroke="${C.steel}" stroke-width="3" stroke-linecap="round"/>
  <g transform="translate(-108 -228) rotate(-4)">
   <rect x="-38" y="-14" width="72" height="26" rx="13" fill="#F3E3C8" ${S(2.4)}/>
   <path d="M-26,-14 v26 M-12,-14 v26 M2,-14 v26 M16,-14 v26" stroke="#3E8FA8" stroke-width="6"/>
   <rect x="-38" y="-14" width="72" height="26" rx="13" fill="none" ${S(2.4)}/>
   <ellipse cx="-38" cy="-1" rx="6" ry="13" fill="#E9D3B4" ${S(2)}/><path d="M-38,-4 q3,3 0,6" fill="none" ${S(1.2)}/>
   <path d="M-4,-15 v28" stroke="#7A4A2A" stroke-width="4"/>
  </g>`;
  const saddle = `<g>
    <path d="M${P(-46.5, -232)} L${P(-60.5, -278)}" stroke="${C.ink}" stroke-width="9" stroke-linecap="round"/>
    <path d="M${P(-46.5, -232)} L${P(-60.5, -278)}" stroke="${C.steel}" stroke-width="5" stroke-linecap="round"/>
    <path d="M-86,-279 q-4,5 0,8 q4,3 0,7 M-76,-279 q-4,5 0,8 q4,3 0,7" fill="none" stroke="${C.steelLo}" stroke-width="2.2"/>
    <path d="M-90,-266 L-58,-268" stroke="${C.ink}" stroke-width="3"/>
    <path d="M-101,-283 C-101,-290 -84,-289 -63,-287 C-45,-286 -30,-286 -23,-284 C-20,-281 -26,-278 -34,-278 C-52,-276 -70,-276 -92,-275 C-100,-275 -102,-279 -101,-283Z" fill="${C.saddle}" ${S(2.4)}/>
    <path d="M-96,-285 C-80,-287 -60,-286 -40,-285" fill="none" stroke="${C.saddleHi}" stroke-width="2.2"/>
  </g>`;
  const cs = [0, -80];
  bike.frame = slot('frame', '', `
  ${fender(RH, 185, 300)}
  ${fender(FH, 228, 350)}
  <path d="M${P(RH[0] - 102, RH[1] + 10)} L${P(RH[0] - 4, RH[1])}" stroke="${C.steelLo}" stroke-width="2.2"/>
  <path d="M${P(FH[0] + 102, FH[1] - 18)} L${P(FH[0] + 4, FH[1])}" stroke="${C.steelLo}" stroke-width="2.2"/>
  ${rack}
  ${tube(RH, ST, 6)}${tube(RH, cs, 7)}
  ${tube(cs, ST, 10)}${tube(tt0, tt1, 9)}${tube(cs, dt1, 11)}
  ${hi([-40, -230], [106, -242], 2.4)}${hi([8, -91], [118, -207], 2.6)}${hi([-4, -96], [-38, -218], 2.2)}
  <path d="M${P(...HTT)} L${P(...HTB)}" stroke="${C.ink}" stroke-width="17" stroke-linecap="round"/>
  <path d="M${P(...HTT)} L${P(...HTB)}" stroke="${C.frame}" stroke-width="12" stroke-linecap="round"/>
  <path d="M${P(111, -236)} L${P(121, -212)}" stroke="${C.cream}" stroke-width="7" stroke-linecap="round"/>
  <path d="M${P(-44, -229)} L${P(-40, -216)}" stroke="${C.cream}" stroke-width="12" stroke-linecap="round"/>
  <g transform="translate(18 -155) rotate(-49)"><text x="0" y="4" font-family="Georgia,'DejaVu Serif',serif" font-style="italic" font-weight="700" font-size="17" fill="${C.cream}" text-anchor="middle">Bayrider</text></g>
  <circle cx="0" cy="-80" r="12" fill="${C.steelLo}" ${S(2)}/>
  ${saddle}
  `);
}
// fork + headlamp
bike.fork = slot('fork', '', `
  <path d="M125.6,-203.2 L149,-131 Q156,-106 173,-100" fill="none" stroke="${C.ink}" stroke-width="12" stroke-linecap="round"/>
  <path d="M125.6,-203.2 L149,-131 Q156,-106 173,-100" fill="none" stroke="${C.frame}" stroke-width="7" stroke-linecap="round"/>
  <path d="M128,-196 L147,-136" stroke="${C.frameHi}" stroke-width="2" opacity=".8"/>
  <path d="M118,-206 L136,-202" stroke="${C.ink}" stroke-width="9" stroke-linecap="round"/>
  <path d="M118,-206 L136,-202" stroke="${C.steel}" stroke-width="5" stroke-linecap="round"/>
  <path d="M130,-216 L140,-220" stroke="${C.ink}" stroke-width="3"/>
  <path d="M149,-228 Q140,-230 134,-224 Q130,-218 134,-212 Q140,-206 149,-208Z" fill="${C.cream}" ${S(2.4)}/>
  <path d="M149,-229 Q156,-218 149,-207" fill="#FFF3B8" ${S(2.4)}/>
  <ellipse cx="151" cy="-218" rx="3" ry="8" fill="#FFFBE0"/>
  <path d="M138,-226 Q136,-220 138,-214" fill="none" stroke="#FFFFFF" stroke-width="2" opacity=".8"/>
  <path d="M190,-113 L178,-222 M214,-126 L196,-226" stroke="${C.ink}" stroke-width="3" opacity=".0"/>
`);
// bars, bell, basket with fish
{
  const fish = (x, y, a, col, s = 1, tail = false) => {
    const body = tail
      ? `<path d="M0,0 C4,-10 4,-20 0,-28 L-10,-40 Q0,-36 2,-32 Q4,-36 14,-40 L4,-28 C0,-20 8,-10 8,0Z" fill="${col}" ${S(2)}/><path d="M2,-10 l2,-6" stroke="#FFFFFF" stroke-width="1.6" opacity=".7"/>`
      : `<path d="M-9,4 C-10,-14 -6,-30 2,-38 C10,-30 12,-14 11,4Z" fill="${col}" ${S(2)}/>
         <circle cx="3" cy="-26" r="3.4" fill="#FFFFFF" ${S(1.2)}/><circle cx="3.6" cy="-26" r="1.7" fill="${C.ink}"/>
         <path d="M-4,-17 Q2,-13 8,-17" fill="none" ${S(1.4)}/><path d="M-5,-4 q6,4 12,0" fill="none" stroke="#FFFFFF" stroke-width="1.6" opacity=".6"/>
         <path d="M-1,-34 q3,-3 6,0" fill="none" stroke="#FFFFFF" stroke-width="1.4" opacity=".8"/>`;
    return `<g transform="${tr(x, y, a)} scale(${s})">${body}</g>`;
  };
  let weave = '';
  for (let y = -286; y < -228; y += 7) weave += `<path d="M142,${y} C170,${y + 3} 195,${y - 2} 220,${y + 1}" fill="none" stroke="${C.basketLo}" stroke-width="2.4"/>`;
  for (let x = 150; x < 220; x += 11) weave += `<path d="M${x},-290 L${x + 1},-228" stroke="${C.basketHi}" stroke-width="2" opacity=".7"/>`;
  bike.bars = slot('bars', '', `
  <path d="M106.4,-262.1 L110,-251" stroke="${C.ink}" stroke-width="10" stroke-linecap="round"/>
  <path d="M106.4,-262.1 L110,-251" stroke="${C.steel}" stroke-width="6" stroke-linecap="round"/>
  <path d="M106.4,-262.1 L132,-269" stroke="${C.ink}" stroke-width="10" stroke-linecap="round"/>
  <path d="M106.4,-262.1 L132,-269" stroke="${C.steel}" stroke-width="6" stroke-linecap="round"/>
  <path d="M132,-269 C150,-272 150,-286 132,-282 L118,-277" fill="none" stroke="${C.ink}" stroke-width="9" stroke-linecap="round"/>
  <path d="M132,-269 C150,-272 150,-286 132,-282 L118,-277" fill="none" stroke="${C.steel}" stroke-width="5" stroke-linecap="round"/>
  <path d="M140,-270 L141,-226" stroke="${C.ink}" stroke-width="5"/>
  <path d="M146,-226 L164,-116 M214,-228 L178,-104" stroke="${C.ink}" stroke-width="5" stroke-linecap="round"/>
  <path d="M146,-226 L164,-116 M214,-228 L178,-104" stroke="${C.steel}" stroke-width="2.4" stroke-linecap="round"/>
  ${fish(170, -284, -16, '#8FB3C9', 1)}
  ${fish(196, -286, 22, '#A9C6D6', .9, true)}
  ${fish(186, -282, 6, '#7FA3BE', 1.12)}
  <path d="M138,-292 L224,-292 L218,-226 L144,-226Z" fill="${C.basket}" ${S(2.8)}/>
  ${weave}
  <path d="M136,-293 C165,-297 200,-297 226,-293" fill="none" stroke="${C.ink}" stroke-width="9" stroke-linecap="round"/>
  <path d="M136,-293 C165,-297 200,-297 226,-293" fill="none" stroke="${C.basketHi}" stroke-width="5" stroke-linecap="round"/>
  <path d="M144,-228 L218,-228" stroke="${C.ink}" stroke-width="3"/>
  <path d="M212,-288 L207,-232" stroke="#FFC98E" stroke-width="3" opacity=".6"/>
  <path d="M124,-278 L124,-284" stroke="${C.ink}" stroke-width="2.4"/>
  <path d="M116,-284 Q116,-296 124,-296 Q132,-296 132,-284Z" fill="#E8C35A" ${S(2)}/>
  <circle cx="124" cy="-297" r="2" fill="#E8C35A" ${S(1.2)}/>
  <path d="M120,-290 q2,-3 5,-3" fill="none" stroke="#FFF6D0" stroke-width="1.6"/>
  `);
}
// drivetrain
bike.cog = slot('cog', tr(...RH), `<path d="${teeth(16, 9.573, 10.8)}" fill="#6C6366" ${S(1.2)}/><circle r="5" fill="${C.steelLo}"/>`);
const CHAIN_D = 'M-124.92,-109.57 L0.23,-108.55 A28.556,28.556 0 1 1 -8.69,-52.80 L-127.91,-90.88 A9.573,9.573 0 0 1 -124.92,-109.57 Z';
bike.chain = slot('chain', '', `<path d="${CHAIN_D}" fill="none" stroke="${C.ink}" stroke-width="4.2"/>
<path d="${CHAIN_D}" pathLength="100" fill="none" stroke="#8C8286" stroke-width="2.6" stroke-dasharray="1.1 .9"/>
<path d="${CHAIN_D}" pathLength="100" fill="none" stroke="#E6DDD4" stroke-width="1.8" stroke-dasharray=".3 3.7"/>`);
{
  let spider = '';
  for (let i = 0; i < 5; i++) {
    const a = i * 72 * D - Math.PI / 2;
    spider += `<path d="M0,0 L${P(Math.cos(a) * 22, Math.sin(a) * 22)}" stroke="${C.steel}" stroke-width="6" stroke-linecap="round"/><circle cx="${f(Math.cos(a) * 22)}" cy="${f(Math.sin(a) * 22)}" r="2" fill="${C.steelLo}"/>`;
  }
  bike.chainring = slot('chainring', tr(...BB), `<path d="${teeth(48, 28.556, 30.2)}" fill="#A69CA0" ${S(1.8)}/>
  <circle r="24.5" fill="none" stroke="${C.steelLo}" stroke-width="2"/>
  <circle r="18" fill="#4B3A38" opacity=".35"/>${spider}<circle r="7" fill="${C.steel}" ${S(1.6)}/>`);
}
const crankArt = (colA, colB) => `<path d="M-4,-5 L50,-3.5 L50,3.5 L-4,5Z" fill="${colA}" ${S(2)}/><circle r="7" fill="${colB}" ${S(1.8)}/><circle cx="50" r="4.5" fill="${colB}" ${S(1.6)}/>`;
bike.crankNear = slot('crankNear', tr(...BB, 0), crankArt(C.steel, C.steelLo));
bike.crankFar = slot('crankFar', tr(...BB, 180), crankArt(far(C.steel), far(C.steelLo)));
const pedalArt = (a, b) => `<rect x="-14" y="-3" width="28" height="8" rx="2.5" fill="${a}" ${S(2)}/><rect x="-10" y="-1" width="6" height="4" rx="1" fill="#E08A3A"/><rect x="4" y="-1" width="6" height="4" rx="1" fill="#E08A3A"/><circle r="2" fill="${b}"/>`;
bike.pedalNear = slot('pedalNear', tr(...legN.pedal, legN.alpha / D), pedalArt('#3A302E', C.steel));
bike.pedalFar = slot('pedalFar', tr(...legF.pedal, legF.alpha / D), pedalArt(far('#3A302E'), far(C.steel)));

// ======================================================================
// PELICAN
// ======================================================================
const pel = {};
// ---- legs ----
function thighArt(farSide) {
  const c = farSide ? far(C.plume) : C.plume, sh = farSide ? far(C.plumeShade) : C.plumeShade;
  const dp = farSide ? far(C.plumeDeep) : C.plumeDeep;
  const k = farSide ? far(C.foot) : C.foot;
  // feathered drumstick: plump at the hip, tapering to a fluffy fringe, bare orange knee
  const d = `M-12,-4 C-14,-18 2,-24 22,-22 C52,-19 86,-12 110,-9
    C116,-9 118,-6 115,-4 L123,-2 L114,1 L122,5 L112,7 L117,11
    C96,12 70,16 46,21 C24,26 4,26 -6,18 C-12,13 -12,4 -12,-4Z`;
  return `<path d="M104,-8 L146,-7 L146,7 L104,9Z" fill="${k}" ${S(2.6)}/>
  <path d="${d}" fill="${c}" ${S(2.8)}/>
  <path d="M6,17 C30,17 60,12 104,6" fill="none" stroke="${sh}" stroke-width="9" stroke-linecap="round" opacity=".9"/>
  <path d="M40,-8 q8,5 16,0 M64,-5 q7,4 14,0 M86,-3 q6,4 12,0 M52,6 q8,5 16,0 M76,5 q6,4 12,0 M20,4 q8,5 16,0" fill="none" stroke="${dp}" stroke-width="1.8" stroke-linecap="round"/>
  ${farSide ? '' : `<path d="M4,-20 C36,-19 70,-13 104,-8" fill="none" stroke="${C.rim}" stroke-width="2.6" opacity=".75" stroke-linecap="round"/>`}`;
}
function shankArt(farSide) {
  const k = farSide ? far(C.foot) : C.foot, kd = farSide ? far(C.footDark) : C.footDark;
  let scales = '';
  for (let x = 22; x < 126; x += 12) scales += `<path d="M${x},-4 q3,4 0,8" fill="none" stroke="${kd}" stroke-width="1.3" opacity=".8"/>`;
  return `<path d="M-2,-7 C40,-6.5 90,-5.5 136,-4.6 L136,4.6 C90,5.5 40,6.5 -2,7Z" fill="${k}" ${S(2.6)}/>
  <path d="M4,3.5 C50,3.5 90,3 132,2.6" fill="none" stroke="${kd}" stroke-width="2.4" opacity=".8"/>${scales}
  ${farSide ? '' : `<path d="M8,-4 C50,-4 90,-3.4 130,-3" fill="none" stroke="#FFC98E" stroke-width="1.8" opacity=".8"/>`}
  <circle r="9" fill="${k}" ${S(2.6)}/><path d="M-4,-4 q4,-3 8,0" fill="none" stroke="#FFD0A0" stroke-width="1.6" opacity=".8"/>`;
}
function footArt(farSide) {
  const k = farSide ? far(C.foot) : C.foot, w = farSide ? far(C.web) : C.web, kd = farSide ? far(C.footDark) : C.footDark;
  // side view of a webbed foot lying on the pedal (sole at y ~ 6 = pedal top), toes to x 48
  return `<path d="M-7,-3 C-6,-9 4,-9 10,-6 C22,-1 36,-1 46,0 C53,1 55,5 51,8 C46,11 42,8 38,11 C34,14 28,10 23,12 C18,14 12,10 6,11 C0,11 -5,9 -8,6 C-10,3 -10,0 -7,-3Z" fill="${w}" ${S(2.6)}/>
  <path d="M4,-3 C18,1 34,2 48,3 M6,1 C18,4 30,7 38,10 M4,4 C12,6 18,9 22,11" fill="none" stroke="${kd}" stroke-width="1.7" stroke-linecap="round"/>
  <path d="M49,3 l6,1.5 M38,10 l5,2.4 M22,11 l3,3" stroke="${C.ink}" stroke-width="2.6" stroke-linecap="round"/>
  ${farSide ? '' : `<path d="M8,-4 C20,-1 32,-1 42,-1" fill="none" stroke="#FFD8A8" stroke-width="1.8" opacity=".9"/>`}
  <circle r="7.5" fill="${k}" ${S(2.4)}/>`;
}
pel.thighNear = slot('thighNear', tr(...HIP_N, legN.a1 / D), thighArt(false));
pel.shankNear = slot('shankNear', tr(...legN.j, legN.a2 / D), shankArt(false));
pel.footNear = slot('footNear', tr(...legN.ankle, legN.alpha / D), footArt(false));
pel.thighFar = slot('thighFar', tr(...HIP_F, legF.a1 / D), thighArt(true));
pel.shankFar = slot('shankFar', tr(...legF.j, legF.a2 / D), shankArt(true));
pel.footFar = slot('footFar', tr(...legF.ankle, legF.alpha / D), footArt(true));

// ---- wings ----
function featherRow(x0, x1, n, y0, len, wid, fill, sw = 2) {
  // a row of rounded feathers hanging on +y from the line y=y0
  let s = '';
  for (let i = n - 1; i >= 0; i--) {
    const x = x0 + (x1 - x0) * (i + .5) / n;
    const l = len * (0.8 + 0.4 * (i / Math.max(1, n - 1)));
    s += `<path d="M${P(x - wid * .55, y0)} C${P(x - wid * .6, y0 + l * .7)} ${P(x - wid * .2, y0 + l)} ${P(x + wid * .15, y0 + l)} C${P(x + wid * .55, y0 + l * .95)} ${P(x + wid * .6, y0 + l * .5)} ${P(x + wid * .5, y0)}Z" fill="${fill}" ${S(sw)}/>`;
  }
  return s;
}
function scallopEdge(pts, bulge) {
  // pts along the trailing edge; each segment bulges outward (+y) by 'bulge'
  let d = '';
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    d += ` Q${P((x0 + x1) / 2, Math.max(y0, y1) + bulge)} ${P(x1, y1)}`;
  }
  return d;
}
function wingUpperArt(farSide) {
  const c = farSide ? far(C.plume) : C.plume, sh = farSide ? far(C.plumeShade) : C.plumeShade, dp = farSide ? far(C.plumeDeep) : C.plumeDeep;
  // local: shoulder at 0, elbow at 78; leading edge -y (faces forward), trailing edge +y (faces back)
  const trail = [[86, 11], [70, 16], [54, 20], [38, 24], [22, 27], [6, 28], [-10, 26]];
  const d = `M-20,-8 C-20,-22 8,-24 40,-18 C60,-14 76,-12 84,-10 C93,-7 93,8 86,11${scallopEdge(trail, 7)} C-20,24 -22,6 -20,-8Z`;
  return `<path d="${d}" fill="${c}" ${S(2.8)}/>
  <path d="M-10,20 C20,22 50,16 80,8" fill="none" stroke="${sh}" stroke-width="10" stroke-linecap="round" opacity=".75"/>
  <path d="${[[0, 8], [16, 10], [32, 10], [48, 8], [64, 6]].map(([x, y]) => `M${x},${y} q7,6 14,0`).join(' ')}" fill="none" stroke="${dp}" stroke-width="1.8" stroke-linecap="round"/>
  <path d="${[[8, -6], [26, -6], [44, -5], [62, -4]].map(([x, y]) => `M${x},${y} q6,5 12,0`).join(' ')}" fill="none" stroke="${dp}" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>
  ${farSide ? '' : `<path d="M-12,-18 C20,-22 52,-14 82,-10" fill="none" stroke="${C.rim}" stroke-width="3" opacity=".6" stroke-linecap="round"/>`}`;
}
function wingLowerArt(farSide) {
  const c = farSide ? far(C.plume) : C.plume, fl = farSide ? far(C.flight, .9) : C.flight, fs = farSide ? far(C.flightSheen) : C.flightSheen;
  const sh = farSide ? far(C.plumeShade) : C.plumeShade;
  // black secondaries hang from the trailing edge like a fringe
  return `${featherRow(-6, 74, 6, 4, 20, 15, fl, 2)}
  <path d="M0,10 q6,6 8,14 M20,10 q5,6 7,14 M40,9 q5,6 6,12" fill="none" stroke="${fs}" stroke-width="1.6" opacity=".9"/>
  <path d="M-14,-14 C20,-17 50,-12 78,-9 C86,-7 86,6 78,7 C50,9 20,11 -12,13 C-22,11 -24,-10 -14,-14Z" fill="${c}" ${S(2.8)}/>
  <path d="${[[-2, 2], [16, 3], [34, 3], [52, 2]].map(([x, y]) => `M${x},${y} q7,6 14,0`).join(' ')}" fill="none" stroke="${farSide ? far(C.plumeDeep) : C.plumeDeep}" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M-6,-8 C20,-11 50,-8 76,-6" fill="none" stroke="${farSide ? far(C.plumeDeep) : '#FFFFFF'}" stroke-width="2" stroke-linecap="round" opacity=".7"/>`;
}
function wingHandArt(farSide) {
  const fl = farSide ? far(C.flight, .9) : C.flight, fs = farSide ? far(C.flightSheen) : C.flightSheen;
  const c = farSide ? far(C.plume) : C.plume;
  // local frame rotated 15 deg (forward-down). Long black primaries fan out from the wrist,
  // the front ones fold over the grip (grip at origin, r=6) like fingers.
  const feathers = [[-4, 58], [20, 60], [44, 56], [68, 50], [92, 40]];
  let out = '';
  feathers.forEach(([a, L], i) => {
    const ar = a * D;
    const dir = [Math.cos(ar), Math.sin(ar)], nrm = [-dir[1], dir[0]];
    const b = [-12, -2];
    const w = 8.4 - i * 0.5;
    const e = [b[0] + dir[0] * L, b[1] + dir[1] * L];
    const m1 = [b[0] + dir[0] * L * .55, b[1] + dir[1] * L * .55];
    out += `<path d="M${P(b[0] - nrm[0] * w * .6, b[1] - nrm[1] * w * .6)} C${P(m1[0] - nrm[0] * w, m1[1] - nrm[1] * w)} ${P(e[0] - nrm[0] * w * .7 - dir[0] * 4, e[1] - nrm[1] * w * .7 - dir[1] * 4)} ${P(...e)} C${P(e[0] + nrm[0] * w * .8 - dir[0] * 8, e[1] + nrm[1] * w * .8 - dir[1] * 8)} ${P(m1[0] + nrm[0] * w, m1[1] + nrm[1] * w)} ${P(b[0] + nrm[0] * w * .6, b[1] + nrm[1] * w * .6)}Z" fill="${fl}" ${S(2.2)}/>`;
    out += `<path d="M${P(b[0] + dir[0] * 8, b[1] + dir[1] * 8)} L${P(e[0] - dir[0] * 8, e[1] - dir[1] * 8)}" fill="none" stroke="${fs}" stroke-width="1.6" stroke-linecap="round" opacity=".95"/>`;
  });
  // wrist covert puff where the lower wing ends
  return `${out}<path d="M-30,-12 C-22,-17 -8,-14 -5,-5 C-2,4 -10,10 -22,10 C-32,9 -38,-6 -30,-12Z" fill="${c}" ${S(2.4)}/>
  <path d="M-24,4 q5,3 10,0" fill="none" stroke="${farSide ? far(C.plumeDeep) : C.plumeDeep}" stroke-width="1.4"/>`;
}
function wingPose(sh, w, grip) {
  return {
    up: tr(...sh, w.a1 / D), lo: tr(...w.j, w.a2 / D), hand: tr(...grip, 15),
  };
}
const wpN = wingPose(SH_N, wingN, GRIP_N), wpF = wingPose(SH_F, wingF, GRIP_F);
pel.wingNearUpper = slot('wingNearUpper', wpN.up, wingUpperArt(false));
pel.wingNearLower = slot('wingNearLower', wpN.lo, wingLowerArt(false));
pel.wingNearHand = slot('wingNearHand', wpN.hand, wingHandArt(false));
pel.wingFarUpper = slot('wingFarUpper', wpF.up, wingUpperArt(true));
pel.wingFarLower = slot('wingFarLower', wpF.lo, wingLowerArt(true));
pel.wingFarHand = slot('wingFarHand', wpF.hand, wingHandArt(true));

// ---- body (pelvis frame) ----
{
  const ell = 'M-66,-50 A98,58 0 1 1 130,-50 A98,58 0 1 1 -66,-50Z';
  pel.body = slot('body', tr(...PELVIS), `
  <defs><clipPath id="cBody"><path d="${ell}" transform="rotate(-18 32 -50)"/></clipPath></defs>
  <g transform="rotate(-18 32 -50)">
    <path d="${ell}" fill="${C.plume}"/>
  </g>
  <g clip-path="url(#cBody)">
    <ellipse cx="18" cy="6" rx="120" ry="38" fill="${C.plumeShade}" filter="url(#blur6)" transform="rotate(-18 32 -50)"/>
    <ellipse cx="-30" cy="4" rx="70" ry="22" fill="${C.plumeDeep}" opacity=".7" filter="url(#blur6)" transform="rotate(-18 32 -50)"/>
    <ellipse cx="108" cy="-98" rx="32" ry="26" fill="#FFE2A6" opacity=".85" filter="url(#blur6)"/>
    <path d="M-40,-60 q9,7 18,0 M-18,-70 q9,7 18,0 M4,-80 q9,7 18,0 M-54,-38 q9,7 18,0 M-30,-46 q9,7 18,0 M-6,-56 q9,7 18,0 M18,-66 q9,7 18,0 M40,-76 q8,6 16,0 M-60,-14 q8,6 16,0 M-38,-22 q9,7 18,0 M-12,-30 q9,7 18,0 M14,-40 q9,7 18,0"
      fill="none" stroke="${C.plumeDeep}" stroke-width="1.8" stroke-linecap="round" opacity=".85"/>
    <path d="M-60,-86 C-20,-116 60,-132 120,-112" fill="none" stroke="${C.rim}" stroke-width="8" opacity=".45" filter="url(#blur3)"/>
  </g>
  <g transform="rotate(-18 32 -50)"><path d="${ell}" fill="none" ${S(3)}/></g>
  <path d="M-46,-4 q6,8 14,4 q6,8 14,2" fill="none" ${S(2)}/>
  `);
}
// ---- tail (pelvis frame (-62,-38), rot 8) ----
pel.tail = slot('tail', `${tr(PELVIS[0] - 62, PELVIS[1] - 38)} rotate(8)`, `
  <path d="M6,-14 C-14,-22 -34,-20 -46,-12 C-40,-8 -44,-2 -50,2 C-42,6 -44,12 -48,16 C-34,20 -14,16 6,12Z" fill="${C.plume}" ${S(2.6)}/>
  <path d="M-6,-8 C-20,-8 -30,-6 -38,-3 M-6,4 C-20,5 -30,7 -38,10" fill="none" stroke="${C.plumeDeep}" stroke-width="1.8" stroke-linecap="round"/>
`);

// ---- neck deformer ----
function neckPath(p0, head) {
  const p3 = [head[0] - 14, head[1] + 10];
  const p1 = [p0[0] + 30, p0[1] - 58], p2 = [p3[0] - 58, p3[1] + 34];
  const B = (t) => {
    const u = 1 - t;
    return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
  };
  const dB = (t) => {
    const u = 1 - t;
    return [3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]),
      3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1])];
  };
  const L = [], R = [], mid = [];
  for (let i = 0; i < 9; i++) {
    const t = i / 8, p = B(t), d = dB(t), l = Math.hypot(...d);
    const n = [-d[1] / l, d[0] / l];
    const w = (34 + (24 - 34) * t) / 2;
    L.push([p[0] - n[0] * w, p[1] - n[1] * w]); R.push([p[0] + n[0] * w, p[1] + n[1] * w]);
    mid.push({ p, n, w, t });
  }
  return { d: cr([...L, ...R.reverse()]), mid, B, dB, L, R: R.reverse() };
}
const neck = neckPath(NECK0, HEAD);
{
  const m = neck.mid;
  // front (throat) shading along +n side
  const shade = cr(m.slice(1, 8).map(o => [o.p[0] + o.n[0] * o.w * .45, o.p[1] + o.n[1] * o.w * .45]), false);
  const rim = cr(m.slice(1, 8).map(o => [o.p[0] - o.n[0] * o.w * .6, o.p[1] - o.n[1] * o.w * .6]), false);
  // scarf around t~0.5
  const s = m[4], s2 = m[5];
  const ang = Math.atan2(s.n[1], s.n[0]) / D;
  pel.neck = slot('neck', '', `
  <path d="${neck.d}" fill="${C.plume}" ${S(3)}/>
  <path d="${shade}" fill="none" stroke="${C.plumeShade}" stroke-width="9" stroke-linecap="round" opacity=".9"/>
  <path d="${rim}" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity=".8"/>
  <path d="M${P(m[2].p[0] + 4, m[2].p[1])} q6,5 12,-1 M${P(m[6].p[0] - 2, m[6].p[1] + 4)} q6,5 12,-1" fill="none" stroke="${C.plumeDeep}" stroke-width="1.6" stroke-linecap="round"/>
  `);
  // scarf as its own group (drawn right after neck; tails stream back)
  const cx = s.p[0], cy = s.p[1];
  pel.scarf = `<g id="pb-scarf" transform="${tr(cx, cy, ang)}">
    <path d="M-12,-6 C-34,-14 -58,-6 -82,-16 C-94,-21 -104,-20 -114,-28 C-108,-14 -98,-6 -84,-2 C-64,4 -34,4 -12,6Z" fill="${C.scarf}" ${S(2.6)}/>
    <path d="M-44,-4 C-50,-5 -56,-6 -62,-8 M-78,-8 C-84,-10 -88,-12 -94,-15" fill="none" stroke="${C.scarfStripe}" stroke-width="6"/>
    <path d="M-114,-28 l-7,-5 M-111,-22 l-9,-2 M-106,-16 l-8,2" stroke="${C.scarfStripe}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M-12,2 C-30,6 -46,14 -60,12 C-70,11 -78,16 -86,14 C-76,24 -60,24 -46,20 C-32,16 -20,12 -8,10Z" fill="${C.scarfLo}" ${S(2.4)}/>
    <path d="M-40,12 l-4,7 M-58,13 l-3,7" stroke="${C.scarfStripe}" stroke-width="5"/>
    <path d="M-86,14 l-7,-1 M-84,18 l-7,4" stroke="${C.scarfStripe}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M-21,-9 C-10,-13 10,-13 21,-9 C24,-3 24,4 21,9 C10,13 -10,13 -21,9 C-24,4 -24,-3 -21,-9Z" fill="${C.scarf}" ${S(2.8)}/>
    <path d="M-22,-3 C-10,-6 10,-6 22,-3 M-22,4 C-10,1 10,1 22,4" fill="none" stroke="${C.scarfStripe}" stroke-width="3.4"/>
    <path d="M-14,-11 v22 M-7,-12 v24 M0,-12 v24 M7,-12 v24 M14,-11 v22" stroke="${C.scarfLo}" stroke-width="1.1" opacity=".55"/>
    <path d="M-21,-9 C-10,-13 10,-13 21,-9 C24,-3 24,4 21,9 C10,13 -10,13 -21,9 C-24,4 -24,-3 -21,-9Z" fill="none" ${S(2.8)}/>
    <path d="M-26,-6 C-32,-8 -34,4 -26,6 C-20,6 -20,-5 -26,-6Z" fill="${C.scarfLo}" ${S(2.2)}/>
    <path d="M8,-10 C14,-9 18,-7 20,-4" fill="none" stroke="#FFB08A" stroke-width="2" opacity=".8"/>
  </g>\n`;
}

// ---- head (rider-stabilised, origin (125,-520)) ----
pel.head = slot('head', tr(...HEAD), `
  <path d="M-32,4 C-36,-14 -24,-31 -4,-32 C12,-33 22,-26 26,-16 C28,-10 30,-6 32,-2 L30,10 C20,20 6,24 -8,24 C-22,23 -30,15 -32,4Z" fill="${C.plume}" ${S(3)}/>
  <path d="M-28,10 C-20,19 -6,22 8,20" fill="none" stroke="${C.plumeShade}" stroke-width="7" stroke-linecap="round"/>
  <path d="M-24,-22 C-14,-30 4,-31 16,-24" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity=".9"/>
  <path d="M0,-28 C10,-29 20,-24 26,-15" fill="none" stroke="${C.rim}" stroke-width="3.4" stroke-linecap="round" opacity=".8"/>
  <path d="M-3,-12 C3,-17 12,-15 20,-9 C26,-5 31,-1 32,2 C24,5 14,5 6,3 C-2,1 -8,-5 -3,-12Z" fill="${C.skin}"/>
  <ellipse cx="-6" cy="6" rx="8" ry="4.5" fill="#F59A94" opacity=".6" filter="url(#blur3)"/>
`);
pel.eye = slot('eye', tr(HEAD[0] + 6, HEAD[1] - 7), `
  <ellipse rx="7" ry="7.8" fill="${C.iris}" ${S(2.2)}/>
  <ellipse cx=".6" cy=".8" rx="5" ry="5.6" fill="#170B0D"/>
  <circle cx="-1.6" cy="-2.8" r="2.6" fill="#FFFFFF"/><circle cx="2.6" cy="3" r="1.2" fill="#FFFFFF" opacity=".85"/>
  <path d="M-9,-11 C-4,-15.5 4,-16 9,-12.5" fill="none" ${S(2.2)}/>
  
`);
{
  let w = '';
  [[-26, 30, -10], [-12, 40, -6], [0, 44, -1], [12, 38, 4], [24, 30, 8]].forEach(([a, L, curl]) => {
    const ar = a * D, dx = Math.cos(ar), dy = Math.sin(ar), nx = -dy, ny = dx;
    const e = [dx * L, dy * L + curl], m = [dx * L * .5 + nx * 3, dy * L * .5 + ny * 3];
    w += `<path d="M${P(nx * 6, ny * 6)} Q${P(m[0] + nx * 5, m[1] + ny * 5)} ${P(...e)} Q${P(m[0] - nx * 3, m[1] - ny * 3)} ${P(-nx * 6, -ny * 6)}Z" fill="${C.plume}" ${S(2.2)}/>`;
  });
  pel.crest = slot('crest', `translate(${HEAD[0] - 20} ${HEAD[1] - 16}) rotate(200)`, w +
    `<path d="M-2,-4 C8,-6 16,-6 24,-5 M-2,2 C8,2 16,3 26,5" fill="none" stroke="${C.plumeDeep}" stroke-width="1.3" stroke-linecap="round"/>`);
}
// bills: head-local origin (16,2)/(16,6), 14 deg
{
  const hx = HEAD[0], hy = HEAD[1];
  pel.billUpper = slot('billUpper', `translate(${hx + 16} ${hy + 2}) rotate(14)`, `
  <path d="M-4,-11 C30,-10 80,-7 114,-5 C123,-5 130,-2 131,5 C131,10 128,13 123,14 C123,10 121,7 117,6 C80,5 30,5 -4,5Z" fill="url(#gBill)" ${S(2.8)}/>
  <path d="M114,-5 C123,-5 130,-2 131,5 C131,10 128,13 123,14 C123,10 121,7 117,6 C118,2 117,-2 114,-5Z" fill="${C.nail}" ${S(2.2)}/>
  <path d="M8,-7 C40,-6 76,-4 108,-3" fill="none" stroke="#FFE3CC" stroke-width="2.6" stroke-linecap="round" opacity=".75"/>
  <path d="M8,2.5 C40,3 76,3.5 110,4" fill="none" stroke="${C.billEdge}" stroke-width="2" stroke-linecap="round" opacity=".7"/>
  <path d="M-4,5 C2,8 8,6 11,2" fill="none" stroke="${C.billDark}" stroke-width="2.6" stroke-linecap="round"/>
  `);
  pel.billLower = slot('billLower', `translate(${hx + 16} ${hy + 6}) rotate(14)`, `
  <path d="M-4,-1 C30,-1 80,0 118,1 C120,3 118,6 114,6 C80,6 30,6 -4,5Z" fill="${C.billEdge}" ${S(2.4)}/>
  `);
  pel.pouch = slot('pouch', `translate(${hx + 16} ${hy + 6}) rotate(14) translate(6 5)`, `
  <path d="M-24,12 C-18,30 10,38 40,36 C66,34 90,24 104,10 C108,6 110,2 110,-2 L-4,-4 C-14,-2 -22,4 -24,12Z" fill="url(#gPouch)" ${S(2.8)}/>
  <path d="M-12,18 C10,28 40,30 70,24 M8,8 C30,14 54,14 80,8" fill="none" stroke="#E08A30" stroke-width="1.6" stroke-linecap="round" opacity=".75"/>
  <path d="M20,2 C40,5 62,5 84,2" fill="none" stroke="#FFF0B0" stroke-width="3" stroke-linecap="round" opacity=".8"/>
  `);
}

// ======================================================================
// foreground
// ======================================================================
{
  let fg = '';
  seed = 77;
  const tuft = (x, y, n, h, col) => {
    let s = '';
    for (let i = 0; i < n; i++) {
      const bx = x + rr(-20, 20), hh = h * rr(.6, 1.1), lean = rr(-22, 22);
      s += `<path d="M${P(bx - 4, y)} Q${P(bx + lean * .3, y - hh * .6)} ${P(bx + lean, y - hh)} Q${P(bx + lean * .2 + 4, y - hh * .5)} ${P(bx + 4, y)}Z" fill="${col[i % col.length]}" ${S(1.8)}/>`;
    }
    return s;
  };
  const flower = (x, y, r, col, c2) => {
    let p = '';
    for (let i = 0; i < 5; i++) {
      const a = i * 72 * D;
      p += `<ellipse cx="${f(x + Math.cos(a) * r)}" cy="${f(y + Math.sin(a) * r)}" rx="${f(r * .8)}" ry="${f(r * .55)}" transform="rotate(${f(i * 72)} ${f(x + Math.cos(a) * r)} ${f(y + Math.sin(a) * r)})" fill="${col}" ${S(1.6)}/>`;
    }
    return p + `<circle cx="${x}" cy="${y}" r="${f(r * .5)}" fill="${c2}" ${S(1.4)}/>`;
  };
  const thrift = (x, y, h) => `<path d="M${x},${y} q2,${-h / 2} 0,${-h}" fill="none" stroke="#5E7A44" stroke-width="2.4"/><circle cx="${x}" cy="${y - h}" r="7" fill="#EE8DA8" ${S(1.6)}/><circle cx="${x - 2}" cy="${y - h - 2}" r="2.4" fill="#FFC6D4"/>`;
  const G = ['#6E8E4A', '#86A456', '#5A7A42', '#9CB262'];
  fg += `<path d="M-20,900 L-20,858 C40,846 120,838 200,848 C260,856 300,868 330,900Z" fill="#6E8A4A" ${S(2.6)}/>`;
  fg += `<path d="M1620,900 L1620,846 C1560,836 1480,834 1400,846 C1340,856 1300,872 1280,900Z" fill="#6E8A4A" ${S(2.6)}/>`;
  fg += `<path d="M330,900 C500,888 700,892 900,888 C1050,885 1200,890 1280,900Z" fill="#7F9A52" ${S(2.4)}/>`;
  fg += tuft(40, 868, 9, 58, G) + tuft(150, 872, 8, 46, G) + tuft(250, 882, 6, 34, G);
  fg += tuft(1560, 866, 9, 62, G) + tuft(1450, 872, 8, 48, G) + tuft(1350, 884, 5, 32, G);
  fg += tuft(620, 898, 4, 22, G) + tuft(980, 898, 4, 20, G);
  fg += thrift(90, 850, 44) + thrift(120, 858, 30) + thrift(200, 862, 36) + thrift(1500, 846, 48) + thrift(1530, 856, 34) + thrift(1420, 860, 28);
  fg += flower(60, 830, 7, '#FFE08A', '#E08A3A') + flower(170, 846, 6, '#FFFFFF', '#F2B84A') + flower(1580, 826, 7, '#FFE08A', '#E08A3A') + flower(1470, 838, 6, '#FFFFFF', '#F2B84A') + flower(1390, 852, 5, '#FFE08A', '#E08A3A');
  scene += `<g id="L-foreground-pre"></g>`;
  var FOREGROUND = `<g id="L-foreground" filter="url(#wob)">${fg}</g>\n`;
}

// ======================================================================
// assemble rider in slot order (back -> front)
// ======================================================================
const order = ['wingFarUpper', 'wingFarLower', 'wingFarHand', 'pedalFar', 'footFar', 'shankFar', 'thighFar', 'crankFar',
  'wheelRear', 'wheelFront', 'frame', 'fork', 'bars', 'cog', 'chain', 'chainring', 'crankNear', 'neck', 'tail', 'body', 'scarf',
  'pedalNear', 'shankNear', 'footNear', 'thighNear', 'pouch', 'billLower', 'billUpper', 'head', 'eye', 'crest',
  'wingNearUpper', 'wingNearLower', 'wingNearHand'];
const all = { ...bike, ...pel };
let rider = '';
for (const k of order) { if (!all[k]) throw new Error('missing ' + k); rider += all[k]; }

// rim light glow behind the pelican (sun from the right)
const glow = `<ellipse cx="60" cy="-380" rx="150" ry="120" fill="#FFE2B0" opacity=".22" filter="url(#blur12)"/>`;

const title = `<g id="pb-title" transform="translate(64 78)">
  <text font-family="Georgia,'DejaVu Serif','Times New Roman',serif" font-style="italic" font-weight="700" font-size="46" fill="#FFF3DC" stroke="${C.ink}" stroke-width="6" paint-order="stroke" stroke-linejoin="round">Pelican Bay</text>
  <text y="38" x="4" font-family="'WenQuanYi Zen Hei','PingFang SC','Noto Sans CJK SC','Microsoft YaHei',sans-serif" font-size="22" letter-spacing="10" fill="#FFE2B8" stroke="${C.ink}" stroke-width="4" paint-order="stroke">鹈鹕湾</text>
</g>`;

function svg(viewBox) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="1600" height="900">
<title>Pelican Bay: a pelican on a bicycle (storybook style)</title>
<defs>${defs}</defs>
<rect width="1600" height="900" fill="#F3C9A0"/>
${scene}
<g id="L-rider" transform="translate(680 790)">
${glow}
<g filter="url(#wob)">
${rider}
</g>
</g>
${FOREGROUND}
<g id="pb-paper" pointer-events="none">
<rect width="1600" height="900" filter="url(#mottle)" opacity=".24" style="mix-blend-mode:soft-light"/>
<rect width="1600" height="900" filter="url(#grain)" opacity=".26" style="mix-blend-mode:soft-light"/>
<rect width="1600" height="900" fill="url(#gVignette)"/>
</g>
${title}
</svg>`;
}
fs.writeFileSync(path.join(HERE, 'keyframe.svg'), svg('0 0 1600 900'));
fs.writeFileSync(path.join(HERE, 'closeup.svg'), svg('440 220 560 580').replace('width="1600" height="900"', 'width="1120" height="1160"'));
console.log('ok');
