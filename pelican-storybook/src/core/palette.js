// Time-of-day palette. The ONLY place raw colours live.
// Style B (warm storybook gouache, docs/STYLE-B.md §1): time of day is a WHOLE-PAGE LIGHT GRADE. Each keyframe
// (dawn · noon · golden · sunset · dusk · night) is a complete warm palette:
//   · env tokens: the sky wash, clouds, sun, moon, stars, sea, hills, shore, road … painted per keyframe (the sky and
//     sea are hand-picked per hour; everything else is its golden-hour paint put through that hour's light grade);
//   · materials: base paints (the draft's golden-hour colours) put through the hour's light grade = a multiply in
//     linear RGB plus a thin glaze of the hour's tint; their `-far` variant is a cooler, darker glaze of the same paint;
//   · inks: the seven role paints (P paper · K light-warm · O warm · R accent · B cool · T green · N dark) that the
//     UI and older modules still address by role letter, graded the same way.
// Keyframes are interpolated in linear RGB. Night is a BEDTIME-STORY night: blue-violet page, lavender-white feathers,
// a cream moon and amber lamps (emissive, never graded) — never a cold grey darkening of the day.
import { hexToLin, linToHex, mixLin, smoothstep, clamp, wrap } from './math.js';

export const INK_ROLES = ['P', 'K', 'O', 'R', 'B', 'T', 'N'];
const KF = ['golden', 'dawn', 'noon', 'sunset', 'dusk', 'night'];

// ---- the light grade of each hour (linear RGB multiply, then a glaze of `tint` at strength k) ----------------------
const GRADE = {
  golden: { mul: [1, 1, 1], tint: '#FFC98E', k: 0 },            // = the draft (golden hour already folded into the paints)
  dawn:   { mul: [1.0, 0.93, 0.98], tint: '#F6B8C0', k: 0.07 },   // rose-pink morning
  noon:   { mul: [0.99, 1.02, 1.07], tint: '#FFF8EA', k: 0.06 },  // clear, a touch cooler, still warm paper
  sunset: { mul: [1.0, 0.83, 0.74], tint: '#EC7F5C', k: 0.08 },   // deep orange
  dusk:   { mul: [0.72, 0.62, 0.8], tint: '#7C5E98', k: 0.1 },    // lilac
  night:  { mul: [0.46, 0.46, 0.7], tint: '#3C3C80', k: 0.12 },   // bedtime blue-violet
};
// materials (the rider, the bike, the toys) are the subject of the page: at dusk and night they are graded more
// gently, as if held in the lamp- and moonlight, so the rider stays the brightest thing on a bedtime page
const GRADE_MAT = {
  ...GRADE,
  dusk:  { mul: [0.82, 0.74, 0.88], tint: '#9C7EB4', k: 0.1 },
  night: { mul: [0.64, 0.61, 0.82], tint: '#A898D0', k: 0.1 },
};
const lin = {};
const L = hex => (lin[hex] ||= hexToLin(hex));
function gradeLin(hex, kf, G = GRADE) {
  const g = G[kf], c = L(hex);
  const m = [c[0] * g.mul[0], c[1] * g.mul[1], c[2] * g.mul[2]];
  if (!g.k) return m;
  // the glaze sits on the light: it tints in proportion to the paint's luminance, so darks stay dark (no grey lift)
  const Y = 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2], t = L(g.tint);
  return [0, 1, 2].map(i => m[i] * (1 - g.k) + t[i] * g.k * Y);
}
const FAR_MUL = [0.7, 0.66, 0.8], FAR_TINT = '#6A5878';
const farLin = c => mixLin([c[0] * FAR_MUL[0], c[1] * FAR_MUL[1], c[2] * FAR_MUL[2]], L(FAR_TINT), 0.1);

// ---- the seven role paints (golden hour) ---------------------------------------------------------------------------
const INK_GOLDEN = { P: '#FFF6EC', K: '#F7B58A', O: '#F0923C', R: '#D8443A', B: '#5B6FB4', T: '#1F8A8A', N: '#3A2630' };
export const INKS = Object.fromEntries(KF.map(n => [n, Object.fromEntries(INK_ROLES.map(r => [r, linToHex(gradeLin(INK_GOLDEN[r], n))]))]));

// ---- environment tokens (golden-hour paints) --------------------------------------------------------------------
// Sky (owned by sky.js): skyTop → skyHigh → skyMid → skyLow → skyHaze is the painted wash from the zenith to the
// horizon; skyWash* are the dry-brush streak paints; sun* / moon* / star* / cloud* the bodies.
// Legacy names from edition C (sky0 sky1 sky1b sky2 skyZen skyLine ray* sunBar* sunDog …) stay defined so no module
// that still reads them breaks.
const ENV_BASE = {
  // painted sky wash
  skyTop: '#3A5AA3', skyHigh: '#7C79B4', skyMid: '#D98A80', skyLow: '#F3AE78', skyHaze: '#FFD9A0',
  skyWashCool: '#8C8AC4', skyWashWarm: '#FFD9A8', skyWashRose: '#F2A48A', skyGlow: '#FFE3B0',
  // sun
  sunCore: '#FFFBE6', sunGlow: '#FFE7A8', sunHalo: '#FFD9A0', sunRing: '#FFF3C6', sunBloom: '#FFB27A',
  sunBar1: '#F6B99A', sunBar2: '#FFD0A0', sunDog: '#FFF3C6',
  // clouds (three gouache tones + rim + far bank + high ice cloud)
  cloudLit: '#FFD9B6', cloudMid: '#DEA6AA', cloudShade: '#A38AB2', cloudDots: '#C99AB0', cloudRim: '#FFF1D6',
  cloudBank: '#B08AA8', cloudHigh: '#FFE6C8',
  // moon + stars
  moon: '#FFF4D6', moonShade: '#E6D2AE', moonHalo1: '#FFE8B8', moonHalo2: '#B7A6D8', moonRing: '#FFF8E6',
  star: '#FFF1C8', starLine: '#A69AD6', milky: '#8A84C4',
  // sea, land (painted by the sea / land owners with these paints)
  seaFar: '#6A78B0', seaNear: '#3A5AA3', seaDeep: '#34557F', seaMid: '#8E86BC', seaSheen: '#FFD99A', foam: '#FFF6EC',
  hillFar: '#94777F', hillNear: '#7FA067', sand: '#F2C694', sandShade: '#C9A06E', road: '#A48688', roadLine: '#F6E2BC',
  grassFar: '#9DB872', grassNear: '#739A55', foliage: '#5E8A4E', trunk: '#6B4632', rim: '#FFBE6E', grade: '#FFF6EC',
  // page paints
  line: '#4A2C20', lineSoft: '#8A5A48', paper: '#FFF6EC', mauve: '#94777F',
};
const alias = o => ({ sky0: o.skyTop, sky1: o.skyMid, sky1b: o.skyLow, sky2: o.skyHaze, skyZen: o.skyTop, skyLine: o.skyGlow,
  ray0: o.skyHigh, ray1: o.skyMid, ray1b: o.skyLow, ray2: o.skyHaze, rayDot1: o.skyMid, rayDot1b: o.skyLow, rayDot2: o.skyHaze });

// hand-painted per hour (everything not listed = the golden paint through that hour's grade)
const ENV_PAINT = {
  golden: {},
  dawn: {
    skyTop: '#5A5E9E', skyHigh: '#9A8CC0', skyMid: '#E6A2B2', skyLow: '#F8C2A6', skyHaze: '#FFE4C6',
    skyWashCool: '#A69ACC', skyWashWarm: '#FFE0CC', skyWashRose: '#F4AEB8', skyGlow: '#FFEAD4',
    sunCore: '#FFF8E6', sunGlow: '#FFE0C0', sunHalo: '#FFD0B8', sunRing: '#FFF0DC', sunBloom: '#F7A8A0',
    cloudLit: '#FFE4D8', cloudMid: '#F0B4BE', cloudShade: '#AE98C6', cloudRim: '#FFF4EA', cloudBank: '#B49AC2', cloudHigh: '#FFEAE2',
    moon: '#FFF6E6', moonHalo1: '#FFEEDC', moonHalo2: '#C4B4E0',
    seaFar: '#8C8CC0', seaNear: '#5C66A8', seaMid: '#A89CCC', seaSheen: '#FFD8CC', hillFar: '#A08AAE',
  },
  noon: {
    skyTop: '#5B8CCB', skyHigh: '#82ADDC', skyMid: '#AFCFE8', skyLow: '#D8E6E4', skyHaze: '#FBF0D8',
    skyWashCool: '#9CC0E6', skyWashWarm: '#FFF4E0', skyWashRose: '#E8DCE0', skyGlow: '#FFF8E8',
    sunCore: '#FFFFF6', sunGlow: '#FFF6D0', sunHalo: '#FFF0C4', sunRing: '#FFFBEA', sunBloom: '#FFE6A8',
    sunBar1: '#FFF4E4', sunBar2: '#FFFAF0', sunDog: '#FFFBEA',
    cloudLit: '#FFFCF4', cloudMid: '#F2E8E6', cloudShade: '#BCC0DE', cloudDots: '#D6D4E8', cloudRim: '#FFFFFF', cloudBank: '#C8CCE4', cloudHigh: '#FFFFFA',
    moon: '#FFFCF0', moonShade: '#E4E0D8', moonHalo1: '#F4F4F0', moonHalo2: '#C8D8EE',
    seaFar: '#5E8AC8', seaNear: '#2F62A8', seaDeep: '#264E8C', seaMid: '#86AAD8', seaSheen: '#FFF4D6', foam: '#FFFCF4',
    hillFar: '#8E90B4', hillNear: '#78A864', sand: '#F6D6A2', roadLine: '#FBF0D6', rim: '#FFF4DC',
  },
  sunset: {
    skyTop: '#3B3F8C', skyHigh: '#7A5A9E', skyMid: '#D46A70', skyLow: '#EE8A58', skyHaze: '#FFC078',
    skyWashCool: '#7E6AAE', skyWashWarm: '#FFC890', skyWashRose: '#E8786E', skyGlow: '#FFD08A',
    sunCore: '#FFF0C0', sunGlow: '#FFD08A', sunHalo: '#FFB070', sunRing: '#FFE2A0', sunBloom: '#F08050',
    sunBar1: '#E8866E', sunBar2: '#FFB888', sunDog: '#FFE2A0',
    cloudLit: '#FFC496', cloudMid: '#E88684', cloudShade: '#8E6A9E', cloudDots: '#B8789A', cloudRim: '#FFE4B0', cloudBank: '#9A6E9C', cloudHigh: '#FFD2A8',
    seaFar: '#6A5E9E', seaNear: '#3A3A80', seaDeep: '#2C2E68', seaMid: '#9A74A8', seaSheen: '#FFC080', hillFar: '#7E5E88', rim: '#FFAE6A',
  },
  dusk: {
    skyTop: '#2C2E68', skyHigh: '#4E437E', skyMid: '#8C5E98', skyLow: '#CC8494', skyHaze: '#F0B09A',
    skyWashCool: '#5C5494', skyWashWarm: '#F0B8A4', skyWashRose: '#B8708E', skyGlow: '#F4C0A4',
    sunCore: '#FFE6C0', sunGlow: '#F8B89A', sunHalo: '#E89A94', sunRing: '#FFD6B8', sunBloom: '#C86A84',
    sunBar1: '#B86A8A', sunBar2: '#E89C98', sunDog: '#FFD6B8',
    cloudLit: '#E4A2A8', cloudMid: '#A884A8', cloudShade: '#63588A', cloudDots: '#8A6A96', cloudRim: '#F8C8B4', cloudBank: '#5E4E82', cloudHigh: '#D8A0B0',
    moon: '#FFF0D0', moonShade: '#DCC6A4', moonHalo1: '#F8DCB8', moonHalo2: '#8E7EBE',
    star: '#FFEFC4', starLine: '#8A80C2', milky: '#6A64A8',
    seaFar: '#4E4A88', seaNear: '#2C2C66', seaDeep: '#22244E', seaMid: '#7A5E98', seaSheen: '#F4B89C', hillFar: '#5C4C78', rim: '#F4C0A4',
  },
  night: {
    // the bedtime-story night: deep blue-violet paper with a violet glow low on the horizon
    skyTop: '#1C2052', skyHigh: '#272A68', skyMid: '#34357A', skyLow: '#4A4488', skyHaze: '#6C5C98',
    skyWashCool: '#3E4290', skyWashWarm: '#7A6AA8', skyWashRose: '#6A5896', skyGlow: '#8E7AB4',
    sunCore: '#FFE6B0', sunGlow: '#8A7AB0', sunHalo: '#5E5896', sunRing: '#A898C8', sunBloom: '#4A4488',
    sunBar1: '#3E3E80', sunBar2: '#4A4488', sunDog: '#A898C8',
    cloudLit: '#8C88C4', cloudMid: '#6664A6', cloudShade: '#403F7C', cloudDots: '#54528E', cloudRim: '#E6DCF4', cloudBank: '#343470', cloudHigh: '#7C7AB8',
    moon: '#FFF4D2', moonShade: '#E8D2A6', moonHalo1: '#FFE6AE', moonHalo2: '#6A64AC', moonRing: '#FFF4DA',
    star: '#FFF0C0', starLine: '#8C86D0', milky: '#4E4E9A',
    seaFar: '#343E86', seaNear: '#1E2460', seaDeep: '#171C4A', seaMid: '#4C4C94', seaSheen: '#FFE6AE', foam: '#C8C0E8',
    hillFar: '#2E2E66', rim: '#E6DCF4', line: '#2A1C2A', lineSoft: '#5A4A6E',
  },
};
const resolveEnv = kf => {
  const out = {};
  for (const [k, hex] of Object.entries(ENV_BASE)) out[k] = ENV_PAINT[kf][k] || linToHex(gradeLin(hex, kf));
  Object.assign(out, alias(out));
  for (const r of INK_ROLES) out['ink' + r] = INKS[kf][r];       // role paints: v('inkP') … v('inkN')
  return out;
};
const SET = Object.fromEntries(KF.map(n => [n, resolveEnv(n)]));

// [tod, keyframe]; wraps around 1.0. 0.27 dawn · 0.34–0.62 noon · 0.70 golden · 0.765 sunset · 0.81 dusk · 0.86+ night.
const KEYS = [[0.00, 'night'], [0.19, 'night'], [0.235, 'dusk'], [0.27, 'dawn'], [0.34, 'noon'], [0.62, 'noon'],
  [0.70, 'golden'], [0.765, 'sunset'], [0.81, 'dusk'], [0.865, 'night'], [1.00, 'night']];
export const ENV_KEYS = KEYS.map(([t, n]) => [t, SET[n]]);
export const ENV_TOKENS = Object.keys(SET.golden);

// ---- materials (golden-hour base paints, STYLE-B §1 + the draft's palette `C`) -----------------------------------
// A value is a hex paint (graded by the hour), a role letter 'T' or 'ink:T' (that role's paint, graded).
export const MATERIALS = {
  plume: '#FFF6EC', plumeShade: '#E9D3D2', plumeDeep: '#C7AFC2',
  flight: '#231D26', flightSheen: '#4A4458',
  bill: '#F4A284', billEdge: '#D9705A', billNail: '#E0503A',
  pouch: '#FAC957', pouchDeep: '#F29A3A', skin: '#F7BBAA', iris: '#8B1E1E', pupil: '#231D26',
  foot: '#F08A3C', web: '#F7A860',
  bikeFrame: '#1F8A8A', bikeAccent: '#F6EAD0', saddle: '#7A4A2A', basket: '#C89B5E',
  tyre: '#3B2C2A', rim: '#FFE3B8', steel: '#D9D2C8', chain: '#5A4A48', ink: '#4A2C20',
};
// Emissive: lamps / lighthouse / headlamp glow in their own warm light at every hour (never graded).
export const EMISSIVE = { lamp: '#FFE7A0', lampGlow: '#FAC957', beacon: '#FFF1C0', headlamp: '#FFF6D0' };

const baseHex = val => {
  if (INK_ROLES.includes(val)) return INK_GOLDEN[val];
  if (typeof val === 'string' && val.startsWith('ink:') && INK_ROLES.includes(val[4])) return INK_GOLDEN[val[4]];
  return val;
};
// graded material tables per keyframe, cached per material set (main passes the same object every call)
const matCache = new WeakMap();
function matTables(extra) {
  let t = matCache.get(extra);
  if (t) return t;
  const all = { ...MATERIALS, ...extra };
  t = {};
  for (const n of KF) {
    const m = {};
    for (const [k, val] of Object.entries(all)) { const c = gradeLin(baseHex(val), n, GRADE_MAT); m[k] = c; m[k + '-far'] = farLin(c); }
    t[n] = m;
  }
  matCache.set(extra, t);
  return t;
}

function keyIndex(tod) {
  let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1][0] <= tod) i++;
  const [t0] = KEYS[i], [t1] = KEYS[i + 1];
  return [i, smoothstep(0, 1, (tod - t0) / (t1 - t0 || 1))];
}
const mixTok = (a, b, u) => (a === b ? a : linToHex(mixLin(L(a), L(b), u)));

// Sun/moon placement (spec §3)
export function sunPos(tod) {
  const a = 2 * Math.PI * (tod - 0.25);
  return { x: 800 - 700 * Math.cos(a), y: 470 - 380 * Math.sin(a), elev: Math.sin(a) };
}

// -> { env:{token:hex}, mat:{name:hex, 'name-far':hex}, num:{night, starAlpha, lampOn, rimAlpha, shadowAlpha}, sun, moon, inks }
const NOEXTRA = {};
export function samplePalette(tod, extraMaterials = NOEXTRA) {
  tod = wrap(tod, 1);
  const [i, u] = keyIndex(tod);
  const na = KEYS[i][1], nb = KEYS[i + 1][1];
  const A = SET[na], B = SET[nb];
  const env = {};
  for (const k of ENV_TOKENS) env[k] = mixTok(A[k], B[k], u);
  env.rimLight = env.rim;   // the sun-side rim light (the material 'rim' = the bike's wheel rims shares --pb-rim)
  const inks = {}; for (const r of INK_ROLES) inks[r] = env['ink' + r];
  const T = matTables(extraMaterials), MA = T[na], MB = T[nb], mat = {};
  for (const k in MA) mat[k] = linToHex(na === nb ? MA[k] : mixLin(MA[k], MB[k], u));
  for (const [k, hex] of Object.entries(EMISSIVE)) mat[k] = hex;
  const sun = sunPos(tod), moon = sunPos(tod + 0.5);
  // night is 0 through sunset (sun just under the sea) and reaches 1 by full night
  const night = clamp(1 - smoothstep(-0.45, -0.05, sun.elev), 0, 1);
  return {
    env, mat, sun, moon, inks,
    num: {
      night,
      starAlpha: smoothstep(0.35, 0.9, night),
      lampOn: smoothstep(0.2, 0.55, night),
      rimAlpha: clamp(1 - Math.abs(sun.elev - 0.18) * 2.2, 0.15, 1) * (1 - night * 0.6),
      shadowAlpha: clamp(0.35 * (1 - night) + 0.12, 0.1, 0.45),
    },
  };
}

// Write palette as CSS custom properties on the scene root (call ≤ 10 Hz). Only changed values are written: a custom
// property write restyles the whole scene subtree, so an unchanged palette costs nothing.
const written = new WeakMap();
export function applyPalette(svg, pal) {
  const st = svg.style;
  let last = written.get(svg); if (!last) written.set(svg, last = {});
  const put = (k, v) => { if (last[k] !== v) { last[k] = v; st.setProperty(k, v); } };
  for (const k in pal.env) put('--pb-' + k, pal.env[k]);
  for (const k in pal.mat) put('--pb-' + k, pal.mat[k]);
  for (const k in pal.num) put('--pb-n-' + k, pal.num[k].toFixed(3));
}

// Token reference for markup: v('plume') -> 'var(--pb-plume)'; v('plume',{far:true}) -> 'var(--pb-plume-far)'
export const v = (token, o) => `var(--pb-${token}${o && o.far ? '-far' : ''})`;
