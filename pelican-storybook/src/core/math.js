// Small pure math helpers (node + browser).
export const TAU = Math.PI * 2;
export const DEG = 180 / Math.PI;
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const wrap = (x, m) => ((x % m) + m) % m;
export const wrap360 = a => wrap(a, 360);
export const round = (x, p = 2) => { const k = 10 ** p; return Math.round(x * k) / k; };
export const rot = ([x, y], deg) => { const r = deg / DEG, c = Math.cos(r), s = Math.sin(r); return [x * c - y * s, x * s + y * c]; };
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const len = ([x, y]) => Math.hypot(x, y);

// Deterministic PRNG (mulberry32). rng(seed)() -> [0,1)
export function rng(seed) {
  let a = typeof seed === 'string' ? [...seed].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0, 1779033703) : seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Colour: hex <-> linear RGB, mixing in linear space.
const s2l = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const l2s = c => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
export function hexToLin(hex) {
  let h = hex.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join('');
  return [0, 2, 4].map(i => s2l(parseInt(h.slice(i, i + 2), 16) / 255));
}
export function linToHex(rgb) {
  return '#' + rgb.map(c => Math.round(clamp(l2s(clamp(c, 0, 1)), 0, 1) * 255).toString(16).padStart(2, '0')).join('');
}
export const mixLin = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
export const mulLin = (a, b) => a.map((v, i) => v * b[i]);
export const mixHex = (a, b, t) => linToHex(mixLin(hexToLin(a), hexToLin(b), t));

// Fast, exact String(Math.round(x * 100) / 100) and String(Math.round(x * 10) / 10): the per-frame attribute strings are
// built from a rounded integer (≈2.4× faster than formatting the double), byte-identical output (NaN / ±Inf / huge
// values fall back to the double path).
export const fmt2 = x => {
  let r = Math.round(x * 100);
  if (r === 0) return '0';
  if (!(Math.abs(r) < 1e15)) return String(r / 100);
  let s = ''; if (r < 0) { s = '-'; r = -r; }
  const i = Math.floor(r / 100), c = r - i * 100;
  return c === 0 ? s + i : c % 10 === 0 ? s + i + '.' + c / 10 : s + i + (c < 10 ? '.0' : '.') + c;
};
export const fmt1 = x => {
  let r = Math.round(x * 10);
  if (r === 0) return '0';
  if (!(Math.abs(r) < 1e15)) return String(r / 10);
  let s = ''; if (r < 0) { s = '-'; r = -r; }
  const i = Math.floor(r / 10), c = r - i * 10;
  return c === 0 ? s + i : s + i + '.' + c;
};
