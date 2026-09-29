// Brush calligraphy from glyph skeletons: each skeleton stroke is re-drawn with a pressure
// profile chosen by stroke type (横 竖 撇 捺 点) and a direction-dependent brush width.
import { skeletonStrokes } from './callig.mjs';
import { rng, resample, stroke, bristles, lerp, sstep, clamp, vnoise, f2 } from './lib.mjs';

const cache = new Map();
function strokesFor(font, ch) {
  if (!cache.has(ch)) cache.set(ch, skeletonStrokes(font, ch, 150));
  return cache.get(ch);
}

// Returns SVG path markup (no fill attribute) for one character in a size×size box at (x,y).
export function writeChar(font, ch, x, y, size, { wEm = 0.1, seed = 1, rise = 0.06, dry = 0.35, tilt = 0, squash = 1 } = {}) {
  const r = rng(seed);
  const strokes = strokesFor(font, ch);
  const cr = Math.cos(tilt), sr = Math.sin(tilt);
  const T = ([u, v]) => {
    // em -> page: rising horizontals, slight per-char tilt, horizontal squash
    let a = (u - 0.5) * squash, b = v - 0.5 - rise * (u - 0.5);
    const ra = a * cr - b * sr, rb = a * sr + b * cr;
    return [x + (ra + 0.5) * size, y + (rb + 0.5) * size];
  };
  let out = '';
  for (const s of strokes) {
    const n = clamp(Math.round(s.len * 70), 8, 90);
    const C = resample(s.pts.map(T), n);
    const a = s.pts[0], b = s.pts[s.pts.length - 1];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    let type;
    if (s.len < 0.13) type = 'dot';
    else if (s.horiz) type = 'heng';
    else if (dx < -0.3 * s.len) type = 'pie';
    else if (dx > 0.3 * s.len && dy > 0.2 * s.len) type = 'na';
    else type = 'shu';
    const taperShu = type === 'shu' && s.len > 0.42 && r() < 0.5;
    const W = size * wEm * (0.92 + r() * 0.16);
    const nz = vnoise(Math.floor(r() * 1e5), 4);
    const prof = t => {
      switch (type) {
        case 'heng': return 1.28 - 0.4 * sstep(0, 0.2, t) + 0.34 * sstep(0.8, 0.96, t) - 0.25 * sstep(0.96, 1, t);
        case 'shu': return taperShu ? (1.22 - 0.25 * sstep(0, 0.2, t)) * (1 - 0.9 * sstep(0.6, 1, t)) : 1.22 - 0.25 * sstep(0, 0.2, t) + 0.12 * sstep(0.85, 1, t);
        case 'pie': return (1.25 - 0.2 * sstep(0, 0.2, t)) * (1 - 0.88 * sstep(0.35, 1, t));
        case 'na': return 0.55 + 0.95 * sstep(0.1, 0.82, t) - 1.2 * sstep(0.84, 1, t);
        default: return 0.7 + 0.8 * Math.sin(Math.PI * Math.min(1, t * 1.15));
      }
    };
    // per-point width including direction: horizontals thinner than verticals
    const ws = C.map((p, i) => {
      const q = C[Math.min(C.length - 1, i + 1)], o = C[Math.max(0, i - 1)];
      const ang = Math.atan2(q[1] - o[1], q[0] - o[0]);
      const m = 0.52 + 0.48 * Math.abs(Math.sin(ang));
      return W * m * prof(i / (C.length - 1)) * (1 + 0.1 * nz(i / C.length));
    });
    const wf = t => ws[Math.round(t * (ws.length - 1))];
    out += `<path d="${stroke(C, wf, 0.9)}"/>`;
    // dry-brush streaks on long strokes (飞白)
    if (dry > 0 && s.len > 0.3 && r() < dry) {
      for (const br of bristles(C, t => wf(t) * 1.05, { k: 6, seed: Math.floor(r() * 1e5), runout: 0.5, gap: 0.5 })) out += `<path d="${br.d}" opacity="${f2(br.op * 0.7)}"/>`;
    }
  }
  return out;
}

export function writeColumn(font, text, x, y, size, gap, opts = {}) {
  const r = rng(opts.seed || 7);
  let yy = y, out = '';
  for (const ch of text) {
    if (ch === ' ') { yy += size * 0.5; continue; }
    const s = size * (0.94 + r() * 0.1);
    out += writeChar(font, ch, x - s / 2 + (r() - 0.5) * size * 0.05, yy, s, { ...opts, seed: Math.floor(r() * 1e5), tilt: (r() - 0.5) * 0.06 });
    yy += s + gap;
  }
  return { d: out, end: yy };
}
