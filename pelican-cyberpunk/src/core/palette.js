// Time-of-day palette. The ONLY place raw colours live (modules may also keep a local neon table for their own art).
// Style X ("Neon Pelican", docs/STYLE-X.md §1): time of day is a CITY MOOD, not daylight. Six keyframes on tod:
//   dawn   0.27  smog sunrise — orange haze bleeding through the towers
//   noon   0.34–0.62  overcast grey-violet day — the signs dim, the holograms still run
//   golden 0.70  NEON DUSK — the hero: void zenith, violet smog, a hot magenta/coral horizon
//   sunset 0.765 acid-rain magenta night
//   dusk   0.81 (and 0.235 pre-dawn) the late violet night between the two
//   night  0.865+ deep night — maximum neon, the searchlights sweep
// Every keyframe is a complete set of environment tokens (hex), interpolated in linear RGB. NEON tokens are EMISSIVE:
// the same bright hue at every hour (only --pb-n-neon dims them a little at noon). Materials are the style-X base
// colours, graded by the mood's light and tinted toward the smog for their `-far` variant.
// Compatibility: the seven-ink interface of edition C (INK_ROLES / INKS / pal.inks / v('inkP')… and role-letter
// materials) is kept, re-inked as neon roles: P plume-white · K amber · O coral · R magenta · B haze-violet · T cyan · N void.
import { hexToLin, linToHex, mixLin, smoothstep, clamp, wrap } from './math.js';

export const INK_ROLES = ['P', 'K', 'O', 'R', 'B', 'T', 'N'];
// ---- the seven neon roles per mood (compat + UI) -------------------------------------------------------------
export const INKS = {
  //        plume      amber      coral      magenta    haze       cyan       void
  golden: { P: '#E9E6F2', K: '#FFB547', O: '#FF6A5C', R: '#FF2E88', B: '#4A3372', T: '#19D2EE', N: '#0B0918' },
  dawn:   { P: '#F1E8E6', K: '#FFC27A', O: '#FF8A4A', R: '#E8407A', B: '#5A4378', T: '#2FB8C8', N: '#1A1230' },
  noon:   { P: '#EDEBF3', K: '#E8C08A', O: '#D9866A', R: '#D84A8A', B: '#666280', T: '#3AA6B8', N: '#1E1B30' },
  sunset: { P: '#EDE2F2', K: '#FFB547', O: '#FF4F7E', R: '#FF2E88', B: '#4A2566', T: '#19E6FF', N: '#0E0719' },
  dusk:   { P: '#E6E4F2', K: '#FFB547', O: '#E8487A', R: '#F02E88', B: '#2E2352', T: '#19DCF6', N: '#0A0816' },
  night:  { P: '#E4E2F0', K: '#FFB547', O: '#E0457A', R: '#FF2E88', B: '#231A42', T: '#19E6FF', N: '#07060F' },
};

// ---- emissive neon (STYLE-X §1): never graded --------------------------------------------------------------------
export const NEON = {
  magenta: '#FF2E88', magentaCore: '#FFD3E7', cyan: '#19E6FF', cyanCore: '#D8FBFF', acid: '#C6FF3D', acidCore: '#F1FFD0',
  amber: '#FFB547', amberCore: '#FFF0D2', red: '#FF3B4E', redCore: '#FFD0D6', violet: '#9B5CFF', violetCore: '#E4D4FF',
  void: '#07060F', nightA: '#141029', nightB: '#261A45',
  lamp: '#FFB547', lampGlow: '#FF8A4A', beacon: '#19E6FF', headlamp: '#D8FBFF',
};

// ---- city moods: every environment token as hex ------------------------------------------------------------------
// Sky tokens (sky.js): sky0 zenith · sky1 upper · sky1b middle · sky2 lower smog · sky3 hot horizon band · skyLine the
// horizon glow line · skyZen fine strata lines · smog0 smog body · smog1 mid smog · smogLit bellies lit by the city ·
// smogHi top edges · mega/megaHi/megaFar the arcology and distant megatowers · megaDeep the shadow tower behind the head · cityGlow the light dome · search the
// searchlight tint · haze the violet atmosphere · sun*/moon*/star.
// World tokens (sea / land / fx): seaFar seaNear foam hillFar hillNear sand road roadLine grassFar grassNear foliage
// trunk rim grade, plus edition-C sky names kept for compatibility (cloud*, sunRing, sunDog, milky …).
const MOOD = {
  golden: {
    sky0: '#07060F', sky1: '#130D2C', sky1b: '#28194C', sky2: '#633079', sky3: '#C63F72', skyLine: '#FF7A5E', skyZen: '#3A2663',
    smog0: '#1C1238', smog1: '#3A2360', smogLit: '#FF5E8E', smogHi: '#8C4BAA',
    mega: '#191132', megaHi: '#3A2A66', megaFar: '#2C1D4E', megaDeep: '#0C0820', cityGlow: '#FF4F7E', search: '#BFEFFF', haze: '#5B3F7A',
    sunCore: '#FFF3D6', sunGlow: '#FF4F7E', sunHalo: '#FFB547', moon: '#F4ECFF', moonShade: '#B3A2D6', moonHalo1: '#8C4BAA', star: '#E9E6F2',
    seaFar: '#1C1434', seaNear: '#0B0918', foam: '#E9E6F2', hillFar: '#2A1C4A', hillNear: '#1C1434',
    sand: '#3A2A5C', road: '#15112A', roadLine: '#E9E6F2', grassFar: '#1A5A6A', grassNear: '#157A8A', foliage: '#1A6A7A', trunk: '#0B0918', rim: '#FF2E88', grade: '#F0E8FF',
  },
  dawn: {
    sky0: '#1E1430', sky1: '#3E2640', sky1b: '#8A4848', sky2: '#D06A3A', sky3: '#F49A48', skyLine: '#FFD08A', skyZen: '#6A4450',
    smog0: '#4A3040', smog1: '#8A5048', smogLit: '#FFA050', smogHi: '#D08A68',
    mega: '#2E1E34', megaHi: '#6A4656', megaFar: '#6A4450', megaDeep: '#24162A', cityGlow: '#FF9A40', search: '#FFE2C0', haze: '#B06A4E',
    sunCore: '#FFF0D2', sunGlow: '#FF8A4A', sunHalo: '#FFB547', moon: '#F4E6E0', moonShade: '#C6A6A8', moonHalo1: '#A06A70', star: '#F1E8E6',
    seaFar: '#3A2A48', seaNear: '#1A1230', foam: '#F1E8E6', hillFar: '#4A3452', hillNear: '#2A1E3C',
    sand: '#5A4262', road: '#221A34', roadLine: '#F1E8E6', grassFar: '#2A6A70', grassNear: '#2A8084', foliage: '#2A7078', trunk: '#1A1230', rim: '#FF8A4A', grade: '#FFE8DC',
  },
  noon: {
    sky0: '#3C3854', sky1: '#524D6A', sky1b: '#69637E', sky2: '#827B92', sky3: '#9C94A6', skyLine: '#B8AEBA', skyZen: '#5E5874',
    smog0: '#4A4560', smog1: '#666080', smogLit: '#A290AA', smogHi: '#A8A2B8',
    mega: '#39354F', megaHi: '#57516F', megaFar: '#5A5470', megaDeep: '#2C2840', cityGlow: '#B08AA0', search: '#E0E0F0', haze: '#7A7490',
    sunCore: '#F4F2FA', sunGlow: '#C8C0D4', sunHalo: '#B0A8BE', moon: '#E4E0EC', moonShade: '#B0A8BE', moonHalo1: '#8A8298', star: '#EDEBF3',
    seaFar: '#4A4560', seaNear: '#262238', foam: '#EDEBF3', hillFar: '#5A5470', hillNear: '#39354F',
    sand: '#6A6480', road: '#2A2640', roadLine: '#EDEBF3', grassFar: '#3A7A84', grassNear: '#3A8A92', foliage: '#3A7C86', trunk: '#1E1B30', rim: '#D84A8A', grade: '#E8E6F0',
  },
  sunset: {
    sky0: '#14051F', sky1: '#33093C', sky1b: '#64105C', sky2: '#A41C74', sky3: '#E8307E', skyLine: '#FF6AA8', skyZen: '#5C1666',
    smog0: '#36093E', smog1: '#6E1662', smogLit: '#FF3E96', smogHi: '#C844AC',
    mega: '#1A0724', megaHi: '#4E1658', megaFar: '#4A1252', megaDeep: '#0E0418', cityGlow: '#FF2E88', search: '#FFB9DE', haze: '#8E1E7A',
    sunCore: '#FFE0EE', sunGlow: '#FF2E88', sunHalo: '#FF6A9C', moon: '#FFE6F4', moonShade: '#C090C8', moonHalo1: '#A03A9A', star: '#EDE2F2',
    seaFar: '#1E0A2E', seaNear: '#0E0719', foam: '#EDE2F2', hillFar: '#2C0E40', hillNear: '#1E0A2E',
    sand: '#3E1A56', road: '#160A26', roadLine: '#EDE2F2', grassFar: '#145868', grassNear: '#10788C', foliage: '#146A7C', trunk: '#0E0719', rim: '#FF2E88', grade: '#FFE0F0',
  },
  dusk: {
    sky0: '#07060F', sky1: '#0E0B22', sky1b: '#1C153E', sky2: '#38215E', sky3: '#732C76', skyLine: '#B03A80', skyZen: '#2A1E4A',
    smog0: '#150F2A', smog1: '#2A1C48', smogLit: '#C83A88', smogHi: '#5E3E8E',
    mega: '#100B21', megaHi: '#2A1E4A', megaFar: '#1E1636', megaDeep: '#07050F', cityGlow: '#C0307A', search: '#C8F4FF', haze: '#3E2A62',
    sunCore: '#FFE8F0', sunGlow: '#C0307A', sunHalo: '#8C3A8A', moon: '#EEEAFF', moonShade: '#A89CD0', moonHalo1: '#5E3E8E', star: '#E6E4F2',
    seaFar: '#150F2A', seaNear: '#0A0816', foam: '#E6E4F2', hillFar: '#1E1636', hillNear: '#150F2A',
    sand: '#2A1E4A', road: '#100C20', roadLine: '#E6E4F2', grassFar: '#12505E', grassNear: '#10687A', foliage: '#125C6C', trunk: '#0A0816', rim: '#19E6FF', grade: '#E0DCF4',
  },
  night: {
    sky0: '#020206', sky1: '#04030C', sky1b: '#070615', sky2: '#0F0B22', sky3: '#22153C', skyLine: '#4E2468', skyZen: '#110D24',
    smog0: '#0A0818', smog1: '#130F2C', smogLit: '#7A2A78', smogHi: '#2A1E4C',
    mega: '#09071A', megaHi: '#1E1840', megaFar: '#120E28', megaDeep: '#040309', cityGlow: '#6A2268', search: '#D8FBFF', haze: '#221A40',
    sunCore: '#FFE8F0', sunGlow: '#8A2E7A', sunHalo: '#5E2E6A', moon: '#F0EEFF', moonShade: '#9C94C4', moonHalo1: '#3E2E6A', star: '#E4E2F0',
    seaFar: '#100C22', seaNear: '#07060F', foam: '#E4E2F0', hillFar: '#17122E', hillNear: '#100C22',
    sand: '#221A42', road: '#0C0A1A', roadLine: '#E4E2F0', grassFar: '#0E4654', grassNear: '#0E6070', foliage: '#0E5262', trunk: '#07060F', rim: '#19E6FF', grade: '#D8D8F0',
  },
};
// numeric mood values (interpolated like the colours)
//   night: how night-like the mood is (lamps, windows) · starAlpha: stars through the smog · lampOn: street practicals
//   rimAlpha: neon rim-light strength · shadowAlpha: contact shadow · neon: sign brightness (emissive, dimmer at noon)
//   search: searchlight strength · smog: smog density · winx: the deep-night window fill (sky) · dawn: the orange smog
//   sea of the dawn mood · acid: the magenta acid-rain haze and streaks of the acid night
const NUM = {
  golden: { night: 0.72, starAlpha: 0.32, lampOn: 1, rimAlpha: 1, shadowAlpha: 0.3, neon: 1, search: 0.75, smog: 0.62, winx: 0, dawn: 0, acid: 0 },
  dawn:   { night: 0.35, starAlpha: 0, lampOn: 0.6, rimAlpha: 0.7, shadowAlpha: 0.35, neon: 0.8, search: 0.3, smog: 0.85, winx: 0, dawn: 1, acid: 0 },
  noon:   { night: 0.08, starAlpha: 0, lampOn: 0.3, rimAlpha: 0.45, shadowAlpha: 0.26, neon: 0.55, search: 0, smog: 1, winx: 0, dawn: 0, acid: 0 },
  sunset: { night: 0.9, starAlpha: 0.12, lampOn: 1, rimAlpha: 1, shadowAlpha: 0.25, neon: 1, search: 0.9, smog: 0.75, winx: 0.35, dawn: 0, acid: 1 },
  dusk:   { night: 0.96, starAlpha: 0.6, lampOn: 1, rimAlpha: 0.9, shadowAlpha: 0.2, neon: 1, search: 1, smog: 0.5, winx: 0.6, dawn: 0, acid: 0 },
  night:  { night: 1, starAlpha: 1, lampOn: 1, rimAlpha: 0.9, shadowAlpha: 0.2, neon: 1, search: 1, smog: 0.4, winx: 1, dawn: 0, acid: 0 },
};
// edition-C token names still read by some modules: aliased to their closest cyberpunk role
const ALIAS = {
  sky: t => ({
    cloudLit: t.smogHi, cloudShade: t.smog1, cloudDots: t.smog1, cloudRim: t.smogLit, cloudBank: t.smog0, cloudHigh: t.smogHi,
    ray0: t.sky1, ray1: t.sky2, ray1b: t.sky3, ray2: t.skyLine, rayDot1: t.sky2, rayDot1b: t.sky3, rayDot2: t.skyLine,
    sunRing: t.sunHalo, sunDog: t.sunCore, sunBar1: t.smog1, sunBar2: t.smogLit,
    moonHalo2: t.haze, moonRing: t.moonShade, starLine: t.skyZen, milky: t.skyZen,
  }),
};
const resolveEnv = name => {
  const t = { ...MOOD[name] };
  Object.assign(t, ALIAS.sky(t));
  const ink = INKS[name];
  for (const r of INK_ROLES) t['ink' + r] = ink[r];     // raw roles: v('inkP') … v('inkN')
  return t;
};
const SET = Object.fromEntries(Object.keys(MOOD).map(n => [n, resolveEnv(n)]));

// [tod, name]; wraps around 1.0. 0.235 pre-dawn · 0.27 dawn · 0.34–0.62 noon · 0.70 neon dusk · 0.765 acid night · 0.81 late · 0.865+ deep night
const KEYS = [[0.00, 'night'], [0.19, 'night'], [0.235, 'dusk'], [0.27, 'dawn'], [0.34, 'noon'], [0.62, 'noon'],
  [0.70, 'golden'], [0.765, 'sunset'], [0.81, 'dusk'], [0.865, 'night'], [1.00, 'night']];
export const ENV_KEYS = KEYS.map(([t, n]) => [t, SET[n]]);
export const ENV_TOKENS = Object.keys(SET.golden);
export const MOODS = Object.keys(MOOD);

// ---- materials (STYLE-X base colours; graded by the mood, `-far` sinks into the smog) ------------------------------
export const MATERIALS = {
  plume: '#E9E6F2', plumeShade: '#B8B0D8', plumeDeep: '#8A80B4',
  flight: '#15121F', flightSheen: '#3E3A5E',
  bill: '#F4A58E', billEdge: '#D9705A', billNail: '#C4CBE6',
  pouch: '#F9C74F', pouchDeep: '#F4A340', skin: '#F7C1B5', iris: '#8B1E1E', pupil: '#0A0816',
  foot: '#F08A3C', web: '#F5A05A',
  bikeFrame: '#14121C', bikeAccent: '#19E6FF', saddle: '#0E0C15', basket: '#1C1932',
  tyre: '#0C0A14', rim: '#C4CBE6', steel: '#3A3F5C', chain: '#8A90B0', ink: '#0A0816',
};
// Emissive: lamps / beacon / headlamp and every NEON token print at full hue at every hour.
export const EMISSIVE = { lamp: NEON.lamp, lampGlow: NEON.lampGlow, beacon: NEON.beacon, headlamp: NEON.headlamp };

const lin = {};
const L = hex => (lin[hex] ||= hexToLin(hex));
const mixTok = (a, b, u) => linToHex(mixLin(L(a), L(b), u));
const mulHex = (a, g) => { const x = L(a), y = L(g); return linToHex([x[0] * y[0], x[1] * y[1], x[2] * y[2]]); };

function keyIndex(tod) {
  let i = 0; while (i < ENV_KEYS.length - 2 && ENV_KEYS[i + 1][0] <= tod) i++;
  const [t0] = ENV_KEYS[i], [t1] = ENV_KEYS[i + 1];
  return [i, smoothstep(0, 1, (tod - t0) / (t1 - t0 || 1))];
}

// Sun/moon placement (spec §3). The cyberpunk moon keeps its own slow arc over the city (it is a composition element,
// not an anti-sun): it rises at the left at tod 0.55, hangs low left of the arcology at the neon-dusk hero, grazes
// its shoulder at the acid night, sits right of it at deep night and sets at the right by tod 0.05; hidden by day.
export function sunPos(tod) {
  const a = 2 * Math.PI * (tod - 0.25);
  return { x: 800 - 700 * Math.cos(a), y: 470 - 380 * Math.sin(a), elev: Math.sin(a) };
}
export function moonPos(tod) {
  const u = wrap(tod - 0.55, 1) / 0.5;
  if (u > 1) return { x: -300, y: 620, elev: -1 };
  const s = Math.sin(Math.PI * u);
  return { x: 150 + 1350 * u, y: 380 - 190 * s, elev: s };
}

// -> { env:{token:hex}, mat:{name:hex, 'name-far':hex}, num:{…}, sun, moon, inks, mood }
export function samplePalette(tod, extraMaterials = {}) {
  tod = wrap(tod, 1);
  const [i, u] = keyIndex(tod);
  const A = ENV_KEYS[i][1], B = ENV_KEYS[i + 1][1];
  const env = {};
  for (const k of ENV_TOKENS) env[k] = mixTok(A[k], B[k], u);
  for (const k in NEON) env[k] = NEON[k];
  const inks = {}; for (const r of INK_ROLES) inks[r] = env['ink' + r];
  const nA = NUM[KEYS[i][1]], nB = NUM[KEYS[i + 1][1]];
  const num = {};
  for (const k in nA) num[k] = nA[k] + (nB[k] - nA[k]) * u;
  const mat = {};
  const far = env.megaFar;
  for (const [k, val] of Object.entries({ ...MATERIALS, ...extraMaterials })) {
    let base = val;
    if (INK_ROLES.includes(val)) base = inks[val];
    else if (typeof val === 'string' && val.startsWith('ink:') && INK_ROLES.includes(val[4])) base = inks[val[4]];
    const lit = INK_ROLES.includes(val) || String(val).startsWith('ink:') ? base : mulHex(base, env.grade);
    mat[k] = lit;
    mat[k + '-far'] = mixTok(lit, far, 0.55);
  }
  for (const [k, hex] of Object.entries(EMISSIVE)) mat[k] = hex;
  const sun = sunPos(tod), moon = moonPos(tod);
  return { env, mat, sun, moon, inks, num, mood: KEYS[u < 0.5 ? i : i + 1][1] };
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
