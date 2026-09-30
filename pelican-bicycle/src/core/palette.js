// Time-of-day palette. The ONLY place raw colours live.
// Style C (retro screen-print travel poster, docs/STYLE-C.md §1): every surface is one of SEVEN INKS whose ROLES never
// change (P paper · K light-warm · O warm · R accent · B cool · T green · N dark). Time of day is an INK SWAP: each
// keyframe is a complete 7-ink set, plus a role map that says which ink each environment token prints in at that hour
// (e.g. the sky bands are B/R/O/K at golden hour but B/B/B/P at noon and N/N/B/B at night). Keyframes are resolved to
// hex and interpolated in linear RGB. Materials map to ink ROLES (plume -> P, bill -> K ...), so they swap with the
// hour instead of being multiplied by a light grade: the night is a navy/slate/cream night poster, not a darkened day.
import { hexToLin, linToHex, mixLin, smoothstep, clamp, wrap } from './math.js';

export const INK_ROLES = ['P', 'K', 'O', 'R', 'B', 'T', 'N'];
// ---- the seven-ink sets -------------------------------------------------------------------------------------
export const INKS = {
  //        paper      light-warm  warm       accent     cool       green      dark
  golden: { P: '#F4E7CD', K: '#F2AE86', O: '#EB8A33', R: '#D4513A', B: '#56679E', T: '#1D8882', N: '#1A1F35' }, // = the draft
  dawn:   { P: '#F7E6DA', K: '#F3AE9E', O: '#EC9064', R: '#CF5670', B: '#6C5F9F', T: '#2B8784', N: '#26193F' }, // pink-purple + peach
  noon:   { P: '#FBF5E6', K: '#F4BC90', O: '#F29A2E', R: '#D94B38', B: '#4A8BCB', T: '#138F88', N: '#1A2C63' }, // sky blue + white, ultramarine
  sunset: { P: '#F6DEC2', K: '#F09C7C', O: '#E4702F', R: '#BE3A3C', B: '#4C4489', T: '#16727A', N: '#1D1535' }, // deeper vermilion + purple
  dusk:   { P: '#EADDC8', K: '#DF9D8E', O: '#DA7B3B', R: '#A9405C', B: '#3B3D79', T: '#1A6069', N: '#131431' }, // indigo
  night:  { P: '#EFE5C6', K: '#E7AE7E', O: '#E8912F', R: '#B84A3E', B: '#3A4B7E', T: '#1C6663', N: '#0D1127' }, // navy/slate + cream moon + amber lamps
};

// ---- environment tokens -> ink role, per keyframe -------------------------------------------------------------
// Sky tokens (owned by sky.js): sky0 top band · sky1 mid · sky1b lower-mid · sky2 horizon band · skyZen zenith dots ·
// skyLine horizon hairline · ray0/rayDot1 halftone dots inside the sunburst wedges · ray1/ray1b/ray2 the wedge tint of
// each lower band (one ink lighter) · sun*/moon*/star*/cloud* bodies.
const BASE = {
  sky0: 'B', sky1: 'R', sky1b: 'O', sky2: 'K', skyZen: 'N', skyLine: 'P',
  ray0: 'P', ray1: 'O', ray1b: 'K', ray2: 'P',
  sunCore: 'P', sunGlow: 'O', sunHalo: 'K', sunRing: 'P', sunBar1: 'K', sunBar2: 'O', sunDog: 'P',
  cloudLit: 'K', cloudShade: 'O', cloudDots: 'O', cloudRim: 'P', cloudBank: 'B', cloudHigh: 'P',
  moon: 'P', moonShade: 'B', moonHalo1: 'B', moonHalo2: 'B', moonRing: 'P', star: 'P', starLine: 'B', milky: 'B',
  seaFar: 'B', seaNear: 'N', foam: 'P', hillFar: 'B', hillNear: 'T', sand: 'P', road: 'K', roadLine: 'P',
  grassFar: 'T', grassNear: 'T', foliage: 'T', trunk: 'N', rim: 'P', grade: 'P',
};
const ROLEMAP = {
  golden: {},
  dawn: {
    sky0: 'B', sky1: 'R', sky1b: 'K', sky2: 'P', skyZen: 'N', skyLine: 'P',
    ray0: 'P', ray1: 'K', ray1b: 'P', ray2: 'P',
    sunGlow: 'R', sunHalo: 'K', sunBar1: 'R', sunBar2: 'K',
    cloudLit: 'K', cloudShade: 'R', cloudDots: 'R', cloudRim: 'P', cloudBank: 'B',
  },
  noon: {
    sky0: 'B', sky1: 'B', sky1b: 'B', sky2: 'P', skyZen: 'N', skyLine: 'P',
    ray0: 'P', rayDot1: 'P', rayDot1b: 'P', rayDot2: 'B', ray1: 'B', ray1b: 'B', ray2: 'P',
    sunGlow: 'B', sunHalo: 'P', sunRing: 'P', sunBar1: 'B', sunBar2: 'B',
    cloudLit: 'P', cloudShade: 'P', cloudDots: 'B', cloudRim: 'P', cloudBank: 'P', cloudHigh: 'P',
    sand: 'P', road: 'K',
  },
  sunset: {
    sky0: 'B', sky1: 'R', sky1b: 'O', sky2: 'O', skyZen: 'N', skyLine: 'K',
    ray0: 'O', ray1: 'O', ray1b: 'K', ray2: 'K',
    sunGlow: 'O', sunHalo: 'K', sunBar1: 'R', sunBar2: 'K',
    cloudLit: 'K', cloudShade: 'R', cloudDots: 'R', cloudRim: 'O', cloudBank: 'B', cloudHigh: 'K',
    hillFar: 'B', sand: 'K',
  },
  dusk: {
    sky0: 'N', sky1: 'B', sky1b: 'R', sky2: 'K', skyZen: 'N', skyLine: 'K',
    ray0: 'B', rayDot1: 'R', ray1: 'B', ray1b: 'R', ray2: 'K',
    sunGlow: 'R', sunHalo: 'K', sunBar1: 'R', sunBar2: 'K',
    cloudLit: 'B', cloudShade: 'R', cloudDots: 'R', cloudRim: 'K', cloudBank: 'N', cloudHigh: 'B',
    moonHalo1: 'B', moonHalo2: 'B', starLine: 'B', milky: 'B',
    seaFar: 'B', hillFar: 'N', sand: 'B', road: 'B', rim: 'K',
  },
  night: {
    sky0: 'N', sky1: 'N', sky1b: 'B', sky2: 'B', skyZen: 'N', skyLine: 'B',
    ray0: 'N', ray1: 'N', ray1b: 'B', ray2: 'B',
    sunGlow: 'B', sunHalo: 'B', sunBar1: 'B', sunBar2: 'B',
    cloudLit: 'B', cloudShade: 'N', cloudDots: 'N', cloudRim: 'P', cloudBank: 'N', cloudHigh: 'B',
    moonHalo1: 'B', moonHalo2: 'B', starLine: 'B', milky: 'B',
    seaFar: 'B', hillFar: 'N', sand: 'B', road: 'B', rim: 'P',
  },
};
const resolveEnv = name => {
  const ink = INKS[name], map = { ...BASE, ...ROLEMAP[name] }, out = {};
  // dots inside the lower sunburst wedges default to the wedge ink itself (i.e. no dots) unless a keyframe asks
  for (const [dotTok, rayTok] of [['rayDot1', 'ray1'], ['rayDot1b', 'ray1b'], ['rayDot2', 'ray2']]) map[dotTok] ??= map[rayTok];
  for (const [k, role] of Object.entries(map)) out[k] = ink[role];
  for (const r of INK_ROLES) out['ink' + r] = ink[r];       // raw inks: v('inkP') … v('inkN')
  return out;
};
const SET = Object.fromEntries(Object.keys(INKS).map(n => [n, resolveEnv(n)]));

// [tod, tokens]; wraps around 1.0. 0.27 dawn · 0.34–0.62 noon · 0.70 golden · 0.765 sunset · 0.81 dusk · 0.86+ night.
export const ENV_KEYS = [
  [0.00, SET.night], [0.19, SET.night], [0.235, SET.dusk], [0.27, SET.dawn], [0.34, SET.noon], [0.62, SET.noon],
  [0.70, SET.golden], [0.765, SET.sunset], [0.81, SET.dusk], [0.865, SET.night], [1.00, SET.night],
];
export const ENV_TOKENS = Object.keys(SET.golden);

// ---- materials -> ink roles (STYLE-C §1) ----------------------------------------------------------------------
// Each material prints in its ink of the hour; its `-far` variant is the flat dark ink (B or N) per STYLE-C §1.
export const MATERIALS = {
  plume: 'P', plumeShade: 'B', plumeDeep: 'B',
  flight: 'N', flightSheen: 'B',
  bill: 'K', billEdge: 'R', billNail: 'R',
  pouch: 'O', pouchDeep: 'R', skin: 'K', iris: 'R', pupil: 'N',
  foot: 'O', web: 'O',
  bikeFrame: 'T', bikeAccent: 'P', saddle: 'N', basket: 'O',
  tyre: 'N', rim: 'P', steel: 'B', chain: 'N', ink: 'N',
};
const FAR = { P: 'B', K: 'B', O: 'B', R: 'N', B: 'N', T: 'N', N: 'N' };
// Emissive: lamps / lighthouse / headlamp print in the light-warm inks of the hour (not dimmed at night).
export const EMISSIVE = { lamp: 'K', lampGlow: 'O', beacon: 'P', headlamp: 'P' };

// Module `materials` exports are style-C inks: an ink role letter ('T'), 'ink:T', or a golden-set hex (mapped to the
// nearest golden ink so it swaps with the hour like the core materials).
const lin = {};
const L = hex => (lin[hex] ||= hexToLin(hex));
const roleCache = {};
function roleOf(val) {
  if (INK_ROLES.includes(val)) return val;
  if (typeof val === 'string' && val.startsWith('ink:') && INK_ROLES.includes(val[4])) return val[4];
  if (roleCache[val]) return roleCache[val];
  const c = L(val); let best = 'N', bd = Infinity;
  for (const r of INK_ROLES) {
    const g = L(INKS.golden[r]);
    const d = (c[0] - g[0]) ** 2 + (c[1] - g[1]) ** 2 + (c[2] - g[2]) ** 2;
    if (d < bd) { bd = d; best = r; }
  }
  return (roleCache[val] = best);
}

function keyIndex(tod) {
  let i = 0; while (i < ENV_KEYS.length - 2 && ENV_KEYS[i + 1][0] <= tod) i++;
  const [t0] = ENV_KEYS[i], [t1] = ENV_KEYS[i + 1];
  return [i, smoothstep(0, 1, (tod - t0) / (t1 - t0 || 1))];
}
const mixTok = (a, b, u) => linToHex(mixLin(L(a), L(b), u));

// Sun/moon placement (spec §3)
export function sunPos(tod) {
  const a = 2 * Math.PI * (tod - 0.25);
  return { x: 800 - 700 * Math.cos(a), y: 470 - 380 * Math.sin(a), elev: Math.sin(a) };
}

// -> { env:{token:hex}, mat:{name:hex, 'name-far':hex}, num:{night, starAlpha, lampOn, rimAlpha, shadowAlpha}, sun, moon, inks }
export function samplePalette(tod, extraMaterials = {}) {
  tod = wrap(tod, 1);
  const [i, u] = keyIndex(tod);
  const A = ENV_KEYS[i][1], B = ENV_KEYS[i + 1][1];
  const env = {};
  for (const k of ENV_TOKENS) env[k] = mixTok(A[k], B[k], u);
  const inks = {}; for (const r of INK_ROLES) inks[r] = env['ink' + r];
  const mat = {};
  for (const [k, val] of Object.entries({ ...MATERIALS, ...extraMaterials })) {
    const r = roleOf(val);
    mat[k] = inks[r];
    mat[k + '-far'] = inks[FAR[r]];
  }
  for (const [k, r] of Object.entries(EMISSIVE)) mat[k] = inks[r];
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

// Write palette as CSS custom properties on the scene root (call ≤ 10 Hz).
export function applyPalette(svg, pal) {
  const st = svg.style;
  for (const [k, v] of Object.entries(pal.env)) st.setProperty('--pb-' + k, v);
  for (const [k, v] of Object.entries(pal.mat)) st.setProperty('--pb-' + k, v);
  for (const [k, v] of Object.entries(pal.num)) st.setProperty('--pb-n-' + k, v.toFixed(3));
}

// Token reference for markup: v('plume') -> 'var(--pb-plume)'; v('plume',{far:true}) -> 'var(--pb-plume-far)'
export const v = (token, o) => `var(--pb-${token}${o && o.far ? '-far' : ''})`;
