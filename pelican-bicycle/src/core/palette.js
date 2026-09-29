// Time-of-day palette. The ONLY place raw colours live (plus each module's `materials` export).
// Environment tokens are keyframed by tod; material colours are fixed and multiplied by the lighting `grade`.
import { hexToLin, linToHex, mixLin, mulLin, smoothstep, clamp, wrap } from './math.js';

const NIGHT = {
  sky0: '#070B1F', sky1: '#111A3D', sky2: '#243463', sunCore: '#F4F1E6', sunGlow: '#6C7BB8',
  cloudLit: '#3A4775', cloudShade: '#1A2246', seaFar: '#1B2750', seaNear: '#0C1733', foam: '#8C9BD0',
  hillFar: '#1C2548', hillNear: '#141B36', sand: '#3A3A55', road: '#23253A', roadLine: '#9A98A8',
  grassFar: '#1E3040', grassNear: '#152433', foliage: '#122536', trunk: '#2A2230', rim: '#8FA3FF', grade: '#5A6AA0',
};
const DAWN = {
  sky0: '#3C4E8C', sky1: '#C98AA0', sky2: '#FFC7A0', sunCore: '#FFF4D8', sunGlow: '#FFB08A',
  cloudLit: '#FFD2C0', cloudShade: '#8A7AA8', seaFar: '#8C8CC0', seaNear: '#40588E', foam: '#FFE8E0',
  hillFar: '#7A7AA8', hillNear: '#5A5E88', sand: '#E8C6B0', road: '#5C5A6C', roadLine: '#F2E6D8',
  grassFar: '#6F8A7A', grassNear: '#4E6E5C', foliage: '#3F6456', trunk: '#6A4E48', rim: '#FFC0A0', grade: '#FFD8D0',
};
const NOON = {
  sky0: '#3A8DDB', sky1: '#79B8EE', sky2: '#CFE8FA', sunCore: '#FFFDF2', sunGlow: '#FFF3C4',
  cloudLit: '#FFFFFF', cloudShade: '#C3D6EA', seaFar: '#5AA6D6', seaNear: '#1E6FA8', foam: '#FFFFFF',
  hillFar: '#8DB6C8', hillNear: '#6FA27E', sand: '#F3DDB0', road: '#5E6068', roadLine: '#FFFFFF',
  grassFar: '#8CC063', grassNear: '#5FA048', foliage: '#3E8A48', trunk: '#8A6446', rim: '#FFFFFF', grade: '#FFFFFF',
};
const GOLDEN = {
  sky0: '#3B5BA5', sky1: '#E58C6A', sky2: '#FFD39A', sunCore: '#FFF6D6', sunGlow: '#FFB35C',
  cloudLit: '#FFD6A8', cloudShade: '#B0708A', seaFar: '#6E7FB5', seaNear: '#2E4F7F', foam: '#FFE6C0',
  hillFar: '#8A7EA8', hillNear: '#6A6A7E', sand: '#F0C89A', road: '#5A4E58', roadLine: '#FFE9C8',
  grassFar: '#9A9A5A', grassNear: '#6A7A40', foliage: '#4A6A3A', trunk: '#7A4E3A', rim: '#FFC47A', grade: '#FFE9D6',
};
const SUNSET = {
  sky0: '#2A2E6E', sky1: '#D0607A', sky2: '#FF9A5A', sunCore: '#FFE0A0', sunGlow: '#FF7A4A',
  cloudLit: '#FF9A7A', cloudShade: '#6A4070', seaFar: '#5A4E8A', seaNear: '#23305E', foam: '#FFC0A0',
  hillFar: '#5A4A7A', hillNear: '#443C5E', sand: '#C8907A', road: '#443A4A', roadLine: '#F0C8B0',
  grassFar: '#6A5A4A', grassNear: '#4A4A38', foliage: '#3A4632', trunk: '#5A3A30', rim: '#FF9A6A', grade: '#FFC8B0',
};
const DUSK = {
  sky0: '#141A45', sky1: '#4A3C78', sky2: '#A0607A', sunCore: '#FFD0A0', sunGlow: '#A05070',
  cloudLit: '#8A5C80', cloudShade: '#2E2A55', seaFar: '#2E3466', seaNear: '#141E45', foam: '#B0A0C8',
  hillFar: '#2E2E58', hillNear: '#22223F', sand: '#6A5A70', road: '#2E2A3C', roadLine: '#C0B0C0',
  grassFar: '#2E3A45', grassNear: '#222C36', foliage: '#1C2A33', trunk: '#3A2C34', rim: '#C890C0', grade: '#8A80B0',
};

// [tod, tokens]; wraps around 1.0
export const ENV_KEYS = [
  [0.00, NIGHT], [0.20, NIGHT], [0.26, DAWN], [0.34, NOON], [0.62, NOON],
  [0.70, GOLDEN], [0.76, SUNSET], [0.80, DUSK], [0.86, NIGHT], [1.00, NIGHT],
];
export const ENV_TOKENS = Object.keys(NIGHT);

// Core materials (fixed base colours; graded by light). Modules may add their own via `export const materials`.
export const MATERIALS = {
  plume: '#FBF8F4', plumeShade: '#E6DFE0', plumeDeep: '#C9C2CC',
  flight: '#1E1B22', flightSheen: '#3A3A48',
  bill: '#F2A48A', billEdge: '#D9705A', billNail: '#E0503A',
  pouch: '#F9C74F', pouchDeep: '#F4A340', skin: '#F7C1B5', iris: '#8B1E1E', pupil: '#120E12',
  foot: '#F08A3C', web: '#F5A05A',
  bikeFrame: '#1F8A8A', bikeAccent: '#F3E9D2', saddle: '#7A4A2A', basket: '#C89B5E',
  tyre: '#26232A', rim: '#C9CDD3', steel: '#9AA0A8', chain: '#4A4A52', ink: '#2A1F24',
};
// Emissive (not graded): lamps, lighthouse, headlamp.
export const EMISSIVE = { lamp: '#FFE7A8', lampGlow: '#FFC870', beacon: '#FFF2C0', headlamp: '#FFF6D8' };

const lin = {};
const L = hex => (lin[hex] ||= hexToLin(hex));

function envAt(tod) {
  tod = wrap(tod, 1);
  let i = 0; while (i < ENV_KEYS.length - 2 && ENV_KEYS[i + 1][0] <= tod) i++;
  const [t0, a] = ENV_KEYS[i], [t1, b] = ENV_KEYS[i + 1];
  const u = smoothstep(0, 1, (tod - t0) / (t1 - t0 || 1));
  const out = {};
  for (const k of ENV_TOKENS) out[k] = mixLin(L(a[k]), L(b[k]), u);
  return out;
}

// Sun/moon placement (spec §3)
export function sunPos(tod) {
  const a = 2 * Math.PI * (tod - 0.25);
  return { x: 800 - 700 * Math.cos(a), y: 470 - 380 * Math.sin(a), elev: Math.sin(a) };
}

// -> { env:{token:hex}, mat:{name:hex, 'name-far':hex}, num:{night, starAlpha, lampOn, rimAlpha, shadowAlpha}, sun, moon }
export function samplePalette(tod, extraMaterials = {}) {
  const e = envAt(tod);
  const grade = e.grade;
  const env = {}; for (const k of ENV_TOKENS) env[k] = linToHex(e[k]);
  const mat = {};
  for (const [k, hex] of Object.entries({ ...MATERIALS, ...extraMaterials })) {
    const g = mulLin(L(hex), grade);
    mat[k] = linToHex(g);
    mat[k + '-far'] = linToHex(g.map(c => c * 0.62));   // ≈ ×0.8 in sRGB
  }
  for (const [k, hex] of Object.entries(EMISSIVE)) mat[k] = hex;
  const sun = sunPos(tod), moon = sunPos(tod + 0.5);
  const night = clamp(1 - smoothstep(-0.12, 0.12, sun.elev), 0, 1);
  return {
    env, mat, sun, moon,
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
