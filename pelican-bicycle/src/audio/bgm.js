// OWNER: audio. Background music: "鹈鹕湾海滨路 · Coast Road Swing", a 1930s seaside swing tune in F major, 126 bpm.
// The score is data (FORM below: chords, melodies, texture per section); every instrument is synthesized here with
// WebAudio (oscillators + procedurally generated buffers; no sample files). Docs: docs/BGM.md.
//
// createBGM(ac, dest, opts?) -> { start(t, bar?), stop(), pump(until), setMood({night, rain, fog}), info(), log, ... }
//   opts.loop    true (page): the outro's last bar is a turnaround back into the intro. false: the final "button" ending.
//   opts.seed    humanisation seed.   opts.gain  output gain.   opts.solo  ['cl', 'bass', ...] schedule only these.
//   opts.log     keep a note log (verification).
// Scheduling is bar-quantised: pump(until) schedules whole bars whose downbeat falls before `until` (call it from a
// lookahead timer); mood changes are applied on bar lines, so the music thins / fills in musical steps.

export const BPM = 126, BEAT = 60 / BPM, BAR = 4 * BEAT, SWING = 0.62;
const TAU = Math.PI * 2;
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const acc = s => (s === '#' ? 1 : s === 'b' ? -1 : 0);
const pcOf = s => (PC[s[0]] + acc(s[1]) + 12) % 12;
export const midiOf = n => { const m = /^([A-G])([#b]?)(\d)$/.exec(n); return 12 * (+m[3] + 1) + PC[m[1]] + acc(m[2]); };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const QUAL = { '6': [0, 4, 7, 9], '7': [0, 4, 7, 10], 'm7': [0, 3, 7, 10], 'maj7': [0, 4, 7, 11], 'dim7': [0, 3, 6, 9] };
function chordOf(s) {
  const m = /^([A-G][#b]?)(maj7|m7|dim7|6|7)(?:\/([A-G][#b]?))?$/.exec(s), r = pcOf(m[1]), q = QUAL[m[2]];
  return { name: s, root: r, bass: m[3] ? pcOf(m[3]) : r, tones: q.map(i => (r + i) % 12), third: (r + q[1]) % 12, fifth: (r + q[2]) % 12, seventh: (r + q[3]) % 12 };
}
// one bar of melody: "C5/1 D5/1 F5/3 r/1 …", durations in swung eighths (a bar is 8)
export function lineOf(s) {
  let p = 0; const out = [];
  for (const tk of s.trim().split(/\s+/)) { const [n, d] = tk.split('/'), l = +d / 2; if (n !== 'r') out.push([p, l, midiOf(n)]); p += l; }
  if (Math.abs(p - 4) > 1e-6) throw new Error(`bgm: bar is ${p} beats: ${s}`);
  return out;
}

// ------------------------------------------------------------------ the score
const CH_A = 'F6|F6|D7|D7|G7|G7|C7|C7|F6|F6|D7|D7|Gm7|C7|F6 D7|Gm7 C7';
const HOOK = 'C5/1 D5/1 F5/3 D5/1 C5/2|A4/1 C5/5 r/2|C5/1 D5/1 F#5/3 D5/1 C5/2|A4/1 C5/5 r/2';
const A_5_8 = 'B4/1 D5/1 F5/3 D5/1 B4/2|G4/1 A4/1 B4/4 r/2|Bb4/1 C5/1 E5/2 G5/2 E5/1 C5/1|Bb4/2 A4/2 G4/3 r/1';
const A2_5_8 = 'B4/1 D5/1 F5/1 G5/2 F5/1 D5/1 B4/1|G4/1 A4/1 B4/1 D5/3 r/2|Bb4/1 C5/1 E5/1 G5/1 Bb5/2 G5/1 E5/1|F5/2 E5/1 Eb5/1 D5/2 r/2';
export const FORM = [
  { id: 'intro', zh: '前奏', ch: 'F6 D7|Gm7 C7|F6 D7|Gm7 C7|Am7 D7|Gm7 C7|F6 D7|Gm7 C7',
    lead: ['cl', 'r/8|r/8|r/8|r/8|r/8|r/8|r/8|r/5 G4/1 A4/1 Bb4/1'],
    vib: 'r/8|r/8|r/8|r/8|r/4 C5/1 D5/1 F#5/2|G5/4 E5/2 r/2|r/4 C5/1 D5/1 F#5/2|G5/2 E5/2 r/4',
    tex: { 0: { bass: 'two', pno: 'stride', bjo: 1, dr: 'brush' }, 4: { dr: 'ride' } } },
  { id: 'A', zh: 'A 主题', ch: CH_A,
    lead: ['cl', `${HOOK}|${A_5_8}|${HOOK}|Bb4/1 D5/1 F5/2 G5/2 F5/2|E5/3 D5/1 C5/2 Bb4/2|A4/1 C5/1 F5/2 D5/2 C5/2|G4/1 A4/1 Bb4/1 B4/1 C5/2 r/2`],
    tex: { 0: { bass: 'walk', pno: 'charl', bjo: 1, dr: 'brush' } } },
  { id: "A'", zh: 'A′ 变奏', ch: CH_A, counter: 'vib',
    lead: ['cl', 'C5/1 D5/1 F5/1 A5/2 F5/1 D5/1 C5/1|A4/1 C5/3 r/1 A4/1 Bb4/1 B4/1|C5/1 D5/1 F#5/1 A5/2 F#5/1 D5/1 C5/1|A4/1 C5/3 r/4|' +
      `${A2_5_8}|C5/1 D5/1 F5/3 D5/1 C5/2|A4/1 C5/5 r/2|C5/1 D5/1 F#5/3 A5/1 F#5/2|D5/1 C5/5 r/2|` +
      'Bb4/1 D5/1 F5/1 G5/1 Bb5/2 A5/1 G5/1|E5/1 G5/1 E5/1 D5/1 C5/2 Bb4/2|A4/1 C5/1 F5/2 A5/2 F#5/2|G5/3 E5/1 C5/2 r/2'],
    tex: { 0: { bass: 'walk', pno: 'charl', bjo: 1, dr: 'ride' } } },
  { id: 'B', zh: 'B 段（降B大调）', ch: 'Bb6|Bb6|Cm7|F7|Dm7|G7|Cm7|F7|Bb6|Bb6|Ebmaj7|Edim7|Bb6/F|G7|C7|C7', counter: 'clLow',
    lead: ['tp', 'D5/4 C5/2 Bb4/2|G4/2 Bb4/2 D5/4|Eb5/3 D5/1 C5/4|A4/2 C5/2 Eb5/4|F5/4 D5/2 C5/2|B4/4 D5/2 F5/2|Eb5/3 D5/1 C5/2 Bb4/2|A4/6 r/2|' +
      'D5/4 C5/2 Bb4/2|G4/2 Bb4/2 D5/2 F5/2|G5/4 F5/2 Eb5/2|Bb4/2 Db5/2 E5/4|F5/4 D5/2 Bb4/2|B4/2 D5/2 G5/4|G5/2 E5/2 C5/2 Bb4/2|G4/2 A4/1 Bb4/1 C5/4'],
    tex: { 0: { bass: 'two', pno: 'sparse', bjo: 0, dr: 'ride', crash: 1 }, 8: { bass: 'walk', bjo: 1 } } },
  { id: 'brk', zh: '间奏（停顿节奏）', ch: 'F6|D7|G7|C7|F6|D7|Gm7 C7|Gm7 C7',
    lead: ['cl', 'r/2 A4/1 C5/1 D5/1 F5/1 G#5/1 A5/1|C6/2 A5/1 F#5/1 D5/2 r/2|r/2 B4/1 D5/1 F5/1 Ab5/1 G5/2|E5/1 G5/1 E5/1 C5/1 Bb4/2 r/2|' +
      'r/8|r/8|Bb4/1 B4/1 C5/1 C#5/1 D5/1 Eb5/1 E5/1 F5/1|G5/2 F5/1 E5/1 G5/3 r/1'],
    vib: 'r/8|r/8|r/8|r/8|r/2 A5/1 C6/1 A5/1 F5/1 D5/1 C5/1|F#5/2 D5/1 A4/1 C5/2 r/2|r/8|r/8',
    tex: { 0: { bass: 'stop', pno: 'stop', bjo: 0, dr: 'stop' }, 6: { bass: 'walk', pno: 'stride', bjo: 1, dr: 'ride', tp: 'dbl', crash: 1 } } },
  { id: "A''", zh: 'A″ 再现（全奏）', ch: CH_A, counter: 'vib',
    lead: ['cl', `${HOOK}|${A2_5_8}|${HOOK}|Bb5/2 A5/1 G5/1 F5/2 D5/2|E5/1 G5/1 Bb5/2 A5/1 G5/1 E5/1 C5/1|F5/3 A5/1 F#5/2 A5/2|G5/2 Bb5/2 E5/2 C5/2`],
    tex: { 0: { bass: 'walk', pno: 'stride', bjo: 1, dr: 'full', tp: 'harm', crash: 1 } } },
  { id: 'outro', zh: '尾声（三连尾句）', ch: 'Gm7 C7|Gm7 C7|Gm7 C7|F6 C7', end: 'F6',
    lead: ['cl', 'Bb4/1 D5/1 G5/2 E5/2 C5/2|Bb4/1 D5/1 G5/2 Bb5/2 G5/1 E5/1|Bb5/2 A5/1 G5/1 E5/1 D5/1 E5/1 G5/1|F5/4 r/4'], endLead: 'F5/8',
    tex: { 0: { bass: 'walk', pno: 'stride', bjo: 1, dr: 'full', tp: 'harm' }, 3: { tp: 0 } } },
];
// flatten to bars (the ending variant only changes the very last bar)
function barsOf(ending) {
  const out = [];
  for (const s of FORM) {
    const chs = s.ch.split('|'), lead = s.lead[1].split('|'), vib = s.vib ? s.vib.split('|') : null;
    let tex = {};
    chs.forEach((c, i) => {
      if (s.tex[i]) tex = { ...tex, crash: 0, ...s.tex[i] };
      const last = i === chs.length - 1, fin = ending && s.end && last;
      const names = (fin ? s.end : c).split(' '), L = 4 / names.length;
      out.push({ sec: s.id, i, n: chs.length, counter: s.counter, segs: names.map((nm, k) => ({ c: chordOf(nm), s: k * L, l: L })),
        inst: s.lead[0], lead: lineOf(fin ? s.endLead : lead[i]), vib: vib ? lineOf(vib[i]) : null,
        tex: { ...tex, crash: s.tex[i] ? tex.crash : 0, fill: last && !fin, fin } });
    });
  }
  return out;
}
export const SONG = { title: '鹈鹕湾海滨路 · Coast Road Swing', key: 'F major (B section in B♭)', bpm: BPM, swing: SWING,
  bars: FORM.reduce((a, s) => a + s.ch.split('|').length, 0) };
SONG.loopSec = SONG.bars * BAR;

// ------------------------------------------------------------------ small DSP for generated buffers
function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function biquad(x, type, f, q, sr) {          // RBJ cookbook, in place
  const w = TAU * f / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q);
  let b0, b1, b2; const a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; } else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; } else { b0 = al; b1 = 0; b2 = -al; }
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const x0 = x[i], y0 = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x0; y2 = y1; y1 = y0; x[i] = y0; }
  return x;
}
const peakNorm = (x, to = 1) => { let p = 0; for (const v of x) p = Math.max(p, Math.abs(v)); if (p) for (let i = 0; i < x.length; i++) x[i] *= to / p; return x; };
const fadeTail = (x, n) => { for (let i = 0; i < n && i < x.length; i++) x[x.length - 1 - i] *= i / n; return x; };

export function createBGM(ac, dest, o = {}) {
  const sr = ac.sampleRate, R = mulberry(o.seed ?? 7), loop = o.loop !== false, solo = o.solo ? new Set(o.solo) : null;
  const BARS = barsOf(!loop), log = o.log ? [] : null;
  const G = (v = 1) => { const g = ac.createGain(); g.gain.value = v; return g; };
  const F = (type, f, q = 0.707, gain = 0) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.gain.value = gain; return b; };
  const O = (type, f) => { const x = ac.createOscillator(); if (type) x.type = type; x.frequency.value = f; return x; };
  const Pan = p => { if (ac.createStereoPanner) { const s = ac.createStereoPanner(); s.pan.value = p; return s; } return G(1); };
  const wire = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
  const reap = (src, nodes) => { src.onended = () => { for (const n of nodes) try { n.disconnect(); } catch { /* gone */ } }; };
  const buffer = (ch, sec, fill) => { const n = Math.floor(sec * sr), b = ac.createBuffer(ch, n, sr); for (let c = 0; c < ch; c++) fill(b.getChannelData(c), c, n); return b; };
  const noiseArr = n => { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = R() * 2 - 1; return a; };

  // ---------------------------------------------------------------- mix: buses → mood tone → out
  const out = G(o.gain ?? 1); out.connect(dest);
  const tone = F('lowpass', 16000, 0.5); tone.connect(out);
  const verb = ac.createConvolver(); verb.normalize = false;
  verb.buffer = buffer(2, 1.5, (d, c, n) => {        // small bright room: early reflections + darkening tail, unit energy
    let lp = 0;
    for (let i = 0; i < n; i++) { const t = i / sr, k = 0.25 + 0.7 * Math.min(1, t / 1.2); lp += (R() * 2 - 1 - lp) * (1 - k); d[i] = t < 0.011 + 0.004 * c ? 0 : lp * Math.exp(-t / 0.32); }
    for (const [dt, a] of [[0.013, 0.5], [0.021, 0.35], [0.029, 0.3], [0.041, 0.22]]) d[Math.floor((dt + c * 0.0023) * sr)] += a * (c ? -1 : 1);
    let e = 0; for (const v of d) e += v * v; const k = 1 / Math.sqrt(e); for (let i = 0; i < n; i++) d[i] *= k;
  });
  wire(verb, G(0.9), tone);
  const BUS = {};
  function bus(name, { pan = 0, hp = 0, lp = 0, send = 0, gain = 1 }) {
    const inp = G(gain), lay = G(1); let x = wire(inp, lay);
    if (hp) x = wire(x, F('highpass', hp, 0.7));
    if (lp) x = wire(x, F('lowpass', lp, 0.7));
    if (pan) x = wire(x, Pan(pan));
    x.connect(tone); if (send) wire(x, G(send), verb);
    BUS[name] = { in: inp, lay };
  }
  bus('cl', { pan: -0.16, hp: 170, send: 0.24, gain: 0.9 });
  bus('tp', { pan: 0.24, hp: 260, send: 0.2, gain: 0.85 });
  bus('bass', { hp: 34, lp: 2600, send: 0.02, gain: 1 });                       // mono, centre
  bus('pno', { pan: -0.26, hp: 110, send: 0.13, gain: 0.8 });
  bus('bjo', { pan: 0.36, hp: 180, send: 0.1, gain: 0.85 });
  bus('vib', { pan: 0.42, hp: 200, send: 0.3, gain: 0.8 });
  bus('ride', { pan: 0.3, hp: 1800, send: 0.08, gain: 0.45 });
  bus('sn', { pan: -0.1, hp: 160, send: 0.1, gain: 0.85 });
  bus('kick', { lp: 600, gain: 0.4 });
  bus('hat', { pan: 0.22, hp: 2500, send: 0.04, gain: 1.1 });
  // vibraphone motor: amplitude tremolo on the vib bus
  const trem = O('sine', 5.4), tremD = G(0.22); wire(trem, tremD, BUS.vib.lay.gain); trem.start(ac.currentTime);
  BUS.vib.lay.gain.value = 0.78;

  // ---------------------------------------------------------------- generated buffers (built lazily, cached)
  const cache = new Map();
  const memo = (k, f) => { let b = cache.get(k); if (!b) cache.set(k, b = f()); return b; };
  const clW = (() => { const n = 16, re = new Float32Array(n), im = new Float32Array(n);   // clarinet: odd harmonics dominate
    [0, 1, 0.04, 0.42, 0.05, 0.24, 0.03, 0.16, 0.02, 0.09, 0.01, 0.05, 0, 0.03, 0, 0.02].forEach((a, i) => { im[i] = a; });
    return ac.createPeriodicWave(re, im); })();
  const breath = memo('breath', () => buffer(1, 1.2, d => { d.set(biquad(noiseArr(d.length), 'bp', 2300, 0.9, sr)); peakNorm(d); fadeTail(d, 2000); }));
  function pianoBuf(m) {                     // two detuned strings per channel, stretched partials, hammer thump
    return memo('p' + m, () => buffer(2, 2.6, (d, c, n) => {
      const f = mtof(m), Bk = 0.00035, bright = Math.max(0.35, 1.25 - (m - 48) / 48);
      for (let s = 0; s < 2; s++) {
        const det = 1 + (s ? 0.0011 : -0.0006) * (c ? 1.3 : 0.8);
        for (let k = 1; k <= 12; k++) {
          const fk = k * f * det * Math.sqrt(1 + Bk * k * k); if (fk > sr * 0.42) break;
          const a = Math.pow(k, -1.25) * (k === 1 ? 1 : bright) * (k % 7 === 0 ? 0.3 : 1) * 0.5;
          const tau = Math.max(0.12, (2.6 - (m - 40) / 30) / (1 + 0.45 * (k - 1)));
          const w = TAU * fk / sr, cw = 2 * Math.cos(w), dec = Math.exp(-1 / (tau * sr));
          let y1 = 0, y2 = -Math.sin(w), g = a;               // sine by recurrence
          for (let i = 0; i < n; i++) { const y = cw * y1 - y2; y2 = y1; y1 = y; d[i] += y * g; g *= dec; }
        }
      }
      const h = biquad(noiseArr(Math.floor(0.012 * sr)), 'bp', 900 + 8 * m, 1.2, sr);
      for (let i = 0; i < h.length; i++) d[i] += h[i] * 0.25 * Math.exp(-i / (0.003 * sr)) * Math.min(1, i / 48);
      for (let i = 0; i < 132; i++) d[i] *= i / 132;
      peakNorm(d, 0.9); fadeTail(d, Math.floor(0.4 * sr));
    }));
  }
  function vibBuf(m) {                       // bar modes 1 : 4 : 10, soft mallet
    return memo('v' + m, () => buffer(1, 3, (d, c, n) => {
      const f = mtof(m);
      for (const [r, a, tau] of [[1, 1, 2.4], [3.99, 0.22, 0.45], [9.9, 0.05, 0.1]]) {
        if (f * r > sr * 0.45) continue;
        const w = TAU * f * r / sr, cw = 2 * Math.cos(w), dec = Math.exp(-1 / (tau * sr)); let y1 = 0, y2 = -Math.sin(w), g = a;
        for (let i = 0; i < n; i++) { const y = cw * y1 - y2; y2 = y1; y1 = y; d[i] += y * g; g *= dec; }
      }
      for (let i = 0; i < 96; i++) d[i] *= i / 96;
      peakNorm(d, 0.9); fadeTail(d, Math.floor(0.3 * sr));
    }));
  }
  function banjoBuf(m) {                     // Karplus–Strong pluck, bright and short
    return memo('b' + m, () => buffer(1, 0.9, (d, c, n) => {
      const N = Math.max(2, Math.round(sr / mtof(m) - 0.5)), ring = noiseArr(N);
      for (let p = 0; p < 3; p++) for (let i = 1; i < N; i++) ring[i] = 0.5 * ring[i] + 0.5 * ring[i - 1];
      for (let i = 0; i < n; i++) { const j = i % N, y = 0.5 * (ring[j] + ring[(j + 1) % N]) * 0.9965; d[i] = ring[j]; ring[j] = y; }
      biquad(biquad(d, 'hp', 140, 0.7, sr), 'lp', 6500, 0.7, sr); peakNorm(d, 0.9); fadeTail(d, Math.floor(0.1 * sr));
      for (let i = 0; i < 132; i++) d[i] *= i / 132;
    }));
  }
  const DR = {};
  function drums() {
    if (DR.ride) return;
    DR.ride = buffer(1, 1.8, (d, c, n) => {               // wash + three bell partials + stick tick
      const ns = biquad(biquad(noiseArr(n), 'hp', 4200, 0.7, sr), 'lp', 11000, 0.7, sr);
      for (let i = 0; i < n; i++) d[i] = ns[i] * 0.55 * Math.exp(-i / (0.6 * sr));
      for (const [f, a, tau] of [[3080, 0.35, 0.55], [4370, 0.22, 0.4], [5630, 0.16, 0.3], [7310, 0.1, 0.2]]) {
        const w = TAU * f / sr; for (let i = 0; i < n; i++) d[i] += Math.sin(w * i) * a * Math.exp(-i / (tau * sr));
      }
      for (let i = 0; i < 0.004 * sr; i++) d[i] += (R() * 2 - 1) * 0.6 * (1 - i / (0.004 * sr)) * Math.min(1, i / 60);
      for (let i = 0; i < 88; i++) d[i] *= i / 88;
      peakNorm(d); fadeTail(d, 4000);
    });
    DR.crash = buffer(2, 3.2, (d, c, n) => {
      const ns = biquad(noiseArr(n), 'hp', 2600, 0.7, sr);
      for (let i = 0; i < n; i++) d[i] = ns[i] * (Math.exp(-i / (1.1 * sr)) + 0.5 * Math.exp(-i / (0.08 * sr)));
      for (const [f, a] of [[2210, 0.1], [3390, 0.08], [4910, 0.07]]) { const w = TAU * f * (1 + c * 0.004) / sr; for (let i = 0; i < n; i++) d[i] += Math.sin(w * i) * a * Math.exp(-i / (0.9 * sr)); }
      for (let i = 0; i < 32; i++) d[i] *= i / 32;
      peakNorm(d); fadeTail(d, 8000);
    });
    DR.tap = buffer(1, 0.3, (d, c, n) => {                // brush slap on the snare head
      const ns = biquad(biquad(noiseArr(n), 'hp', 1500, 0.7, sr), 'lp', 6500, 0.7, sr);
      for (let i = 0; i < n; i++) d[i] = ns[i] * Math.exp(-i / (0.07 * sr)) + Math.sin(TAU * 196 * i / sr) * 0.35 * Math.exp(-i / (0.035 * sr));
      for (let i = 0; i < 100; i++) d[i] *= i / 100;
      peakNorm(d); fadeTail(d, 1200);
    });
    DR.swish = buffer(1, BEAT * 1.15, (d, c, n) => {       // one circular sweep (rises, then fades)
      const ns = biquad(biquad(noiseArr(n), 'bp', 4200, 0.6, sr), 'hp', 1200, 0.7, sr);
      for (let i = 0; i < n; i++) { const u = i / n; d[i] = ns[i] * Math.pow(Math.sin(Math.PI * u), 2) * (0.6 + 0.4 * Math.sin(Math.PI * u * 2)); }
      peakNorm(d);
    });
    DR.kick = buffer(1, 0.35, (d, c, n) => {                // felt beater, "feathered"
      let ph = 0;
      for (let i = 0; i < n; i++) { const t = i / sr, f = 46 + 40 * Math.exp(-t / 0.03); ph += TAU * f / sr; d[i] = Math.sin(ph) * Math.exp(-t / 0.12); }
      for (let i = 0; i < 48; i++) d[i] *= i / 48;
      peakNorm(d); fadeTail(d, 800);
    });
    DR.hat = buffer(1, 0.12, (d, c, n) => {                 // foot "chick"
      const ns = biquad(noiseArr(n), 'hp', 6500, 0.9, sr);
      for (let i = 0; i < n; i++) d[i] = ns[i] * Math.exp(-i / (0.018 * sr)) * Math.min(1, i / (0.003 * sr));
      peakNorm(d); fadeTail(d, 300);
    });
  }

  // ---------------------------------------------------------------- voices
  const on = b => !solo || solo.has(b);
  const note = (b, t, d, m, v) => { if (log) log.push({ b, t: +t.toFixed(4), d: +d.toFixed(3), m, v: +v.toFixed(2) }); };
  function clarinet(t, d, m, v) {
    const f = mtof(m), g = G(0), lp = F('lowpass', f * 3, 0.8), o1 = O(null, f), o2 = O(null, f), end = t + d;
    o1.setPeriodicWave(clW); o2.setPeriodicWave(clW); o1.detune.value = -3; o2.detune.value = 6;
    wire(o1, lp); wire(o2, G(0.6), lp); wire(lp, g, BUS.cl.in);
    const vib = O('sine', 4.9 + R() * 0.6), vd = G(0); wire(vib, vd); vd.connect(o1.detune); vd.connect(o2.detune);
    if (d > 0.42) { vd.gain.setValueAtTime(0, t + 0.2); vd.gain.linearRampToValueAtTime(11, t + Math.min(0.6, d)); }
    if (d >= 0.7) { o1.detune.setValueAtTime(-55, t); o1.detune.linearRampToValueAtTime(-3, t + 0.07); o2.detune.setValueAtTime(-46, t); o2.detune.linearRampToValueAtTime(6, t + 0.07); }   // a lazy scoop into long notes
    const a = 0.2 * v;
    lp.frequency.setValueAtTime(f * 1.6, t); lp.frequency.exponentialRampToValueAtTime(Math.min(9000, f * (4.5 + 2 * v)), t + 0.05); lp.frequency.setTargetAtTime(f * 3.4, t + 0.06, 0.25);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.028); g.gain.setTargetAtTime(a * 0.78, t + 0.03, 0.18);
    g.gain.setTargetAtTime(0, end, d > 2.5 ? 0.35 : 0.04);
    const stop = end + (d > 2.5 ? 2.6 : 0.4);
    for (const x of [o1, o2, vib]) { x.start(t); x.stop(stop); }
    const bs = ac.createBufferSource(), bg = G(0); bs.buffer = breath; wire(bs, bg, BUS.cl.in);
    bg.gain.setValueAtTime(0, t); bg.gain.linearRampToValueAtTime(0.035 * v, t + 0.02); bg.gain.setTargetAtTime(0.006 * v, t + 0.03, 0.08); bg.gain.setTargetAtTime(0, end, 0.03);
    bs.start(t, R() * 0.5); bs.stop(Math.min(end + 0.2, t + 0.65)); reap(bs, [bs, bg]);
    reap(o1, [o1, o2, vib, vd, lp, g]);
  }
  function trumpet(t, d, m, v, wah) {          // harmon-muted: thin, nasal, buzzy (wah: plunger open → closed)
    const f = mtof(m), g = G(0), o1 = O('sawtooth', f), o2 = O('sawtooth', f), end = t + d;
    o1.detune.value = -5; o2.detune.value = 7;
    const hp = F('highpass', 650, 0.7), pk = F('peaking', 1750, 2.2, 9), lp = F('lowpass', 2400, 0.9);
    wire(o1, hp); wire(o2, hp); wire(hp, pk, lp, g, BUS.tp.in);
    const vib = O('sine', 5.5), vd = G(0); wire(vib, vd); vd.connect(o1.detune); vd.connect(o2.detune);
    if (d > 0.42) { vd.gain.setValueAtTime(0, t + 0.18); vd.gain.linearRampToValueAtTime(13, t + Math.min(0.55, d)); }
    const a = 0.13 * v;
    if (wah) { lp.Q.value = 4; lp.frequency.setValueAtTime(450, t); lp.frequency.exponentialRampToValueAtTime(3400, t + d * 0.35); lp.frequency.exponentialRampToValueAtTime(600, t + d); }
    else { lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(3600 + 1200 * v, t + 0.045); lp.frequency.setTargetAtTime(2600, t + 0.05, 0.2); }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.022); g.gain.setTargetAtTime(a * 0.72, t + 0.025, 0.15); g.gain.setTargetAtTime(0, end, 0.04);
    for (const x of [o1, o2, vib]) { x.start(t); x.stop(end + 0.4); }
    reap(o1, [o1, o2, vib, vd, hp, pk, lp, g]);
  }
  function bass(t, d, m, v) {                  // upright: plucked, woody, mono
    const f = mtof(m), g = G(0), o1 = O('triangle', f), o2 = O('sine', f), lp = F('lowpass', 1500, 1.1), end = t + d;
    wire(o1, G(0.55), lp); wire(o2, lp); wire(lp, g, BUS.bass.in);
    lp.frequency.setValueAtTime(1500, t); lp.frequency.setTargetAtTime(360, t + 0.01, 0.07);
    const a = 0.2 * v;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.007); g.gain.setTargetAtTime(a * 0.42, t + 0.008, 0.09); g.gain.setTargetAtTime(a * 0.12, t + 0.3, 0.5);
    g.gain.setTargetAtTime(0, end, d > 2.5 ? 0.5 : 0.045);
    o1.start(t); o2.start(t); const st = end + (d > 2.5 ? 3 : 0.4); o1.stop(st); o2.stop(st);
    const n = ac.createBufferSource(), nb = F('bandpass', 700, 1.2), ng = G(0); n.buffer = breath; wire(n, nb, ng, BUS.bass.in);   // finger "pluck"
    ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(0.12 * v, t + 0.002); ng.gain.setTargetAtTime(0, t + 0.003, 0.008); n.start(t, R() * 0.5); n.stop(t + 0.06);
    reap(o1, [o1, o2, lp, g]); reap(n, [n, nb, ng]);
  }
  function buf(b, bufr, t, d, v, rate = 1, rel = 0.08) {
    const s = ac.createBufferSource(), g = G(v); s.buffer = bufr; s.playbackRate.value = rate; wire(s, g, BUS[b].in);
    s.start(t);
    if (d != null) { g.gain.setValueAtTime(v, t + d); g.gain.setTargetAtTime(0, t + d, rel); s.stop(Math.min(t + bufr.duration / rate, t + d + rel * 9)); }
    reap(s, [s, g]);
  }
  const piano = (t, d, m, v) => buf('pno', pianoBuf(m), t, d, 0.22 * v, 1, 0.07);
  const vibes = (t, d, m, v) => buf('vib', vibBuf(m), t, d + 0.8, 0.3 * v, 1, 0.3);
  const banjo = (t, d, m, v) => buf('bjo', banjoBuf(m), t, d, 0.45 * v, 1, 0.05);
  const VOICE = { cl: clarinet, tp: trumpet, bass, pno: piano, vib: vibes, bjo: banjo };

  // ---------------------------------------------------------------- humanised placement
  const swing = p => { const b = Math.floor(p + 1e-9), f = p - b; return Math.abs(f - 0.5) < 1e-6 ? b + SWING : p; };
  const hum = (ms = 12) => (R() - 0.5) * 2 * ms / 1000;
  const vel = (v, k = 0.1) => v * (1 + (R() - 0.5) * 2 * k);
  let floor = 0;
  function play(b, t0, pos, dur, m, v, o2 = {}) {
    if (!on(b)) return;
    const t = Math.max(floor, t0 + swing(pos) * BEAT + hum(o2.ms ?? 12) + (o2.lag || 0));
    const e = t0 + swing(pos + dur) * BEAT, d = Math.max(0.06, (e - t) * (o2.gate ?? 0.94));
    const vv = vel(v, o2.vk ?? 0.1);
    VOICE[b](t, d, m, vv); note(b, t, d, m, vv);
  }
  function hit(b, name, t0, pos, v, o2 = {}) {
    if (!on(b)) return;
    const t = Math.max(floor, t0 + swing(pos) * BEAT + hum(o2.ms ?? 8)), vv = vel(v);
    buf(b, DR[name], t, o2.d ?? null, vv, o2.rate ?? (1 + (R() - 0.5) * 0.03), o2.rel ?? 0.08);
    if (log) log.push({ b, n: name, t: +t.toFixed(4), v: +vv.toFixed(2) });
  }

  // ---------------------------------------------------------------- arranging helpers (voice leading)
  const near = (pc, ref, lo, hi) => { let best = null; for (let m = lo; m <= hi; m++) if (((m % 12) + 12) % 12 === pc && (best == null || Math.abs(m - ref) < Math.abs(best - ref))) best = m; return best; };
  function voicing(c, prev, lo, hi) {        // close-position, nearest to the previous voicing's centre
    const ref = prev ? prev.reduce((a, b) => a + b, 0) / prev.length : (lo + hi) / 2;
    let best = null, bd = 1e9;
    for (let r = 0; r < c.tones.length; r++) {
      const pcs = c.tones.slice(r).concat(c.tones.slice(0, r));
      for (let base = lo; base < lo + 12; base++) {
        if (base % 12 !== pcs[0]) continue;
        const v = [base]; for (let k = 1; k < pcs.length; k++) { let m = v[k - 1] + 1; while (m % 12 !== pcs[k]) m++; v.push(m); }
        if (v[v.length - 1] > hi) continue;
        const cen = v.reduce((a, b) => a + b, 0) / v.length, dd = Math.abs(cen - ref);
        if (dd < bd) { bd = dd; best = v; }
      }
    }
    return best;
  }
  const segAt = (bar, p) => bar.segs.find(s => p >= s.s - 1e-9 && p < s.s + s.l - 1e-9) || bar.segs[0];
  let pv = null, bv = null, lastBass = 41, lastGuide = 69, lastLow = 60;

  function scheduleBar(k, t0) {
    const bar = BARS[k], X = bar.tex, nextBar = BARS[(k + 1) % BARS.length], fin = X.fin;
    // --- lead (+ trumpet harmony / doubling)
    const lead = bar.inst;
    for (const [p, l, m] of bar.lead) {
      const acc = Math.abs(p % 1 - 0.5) < 1e-6 ? 1.06 : 0.96, v = (0.85 + Math.min(0.15, l * 0.06)) * acc;
      const dd = fin ? 6 : l;
      play(lead, t0, p, dd, m, v, { lag: 0.008, gate: fin ? 1 : 0.94 });
      if (lead === 'cl' && X.tp === 'dbl') play('tp', t0, p, l, m, v * 0.85, { lag: 0.012 });
      if (lead === 'cl' && X.tp === 'harm') {
        const c = segAt(bar, p).c; let h = m - 3; while (h > 50 && !c.tones.includes(h % 12)) h--;
        if (h > 52) play('tp', t0, p, l, h, v * 0.72, { lag: 0.014 });
      }
    }
    // --- vibes: written lines, or a guide-tone counter-melody (3rds / 7ths, voice-led)
    if (bar.vib) for (const [p, l, m] of bar.vib) play('vib', t0, p, l, m, 0.85, { ms: 10 });
    else if (bar.counter === 'vib' && !fin) for (const s of bar.segs) {
      const m = [s.c.third, s.c.seventh].map(pc => near(pc, lastGuide, 64, 81)).sort((a, b) => Math.abs(a - lastGuide) - Math.abs(b - lastGuide))[0];
      lastGuide = m; const p = s.l === 4 ? 2 : s.s + 1; play('vib', t0, p, s.l === 4 ? 2 : 1, m, bar.i % 2 ? 0.75 : 0.55);
    }
    if (bar.counter === 'clLow') for (const s of bar.segs) {
      const m = [s.c.third, s.c.seventh].map(pc => near(pc, lastLow, 55, 67)).sort((a, b) => Math.abs(a - lastLow) - Math.abs(b - lastLow))[0];
      lastLow = m; play('cl', t0, s.s, s.l, m, 0.45, { ms: 15, gate: 0.97 });
    }
    if (fin) {   // final "button": F6/9 hit, vibes arpeggio, everyone rings out
      bv = voicing(bar.segs[0].c, pv, 55, 72); for (const m of bv) play('pno', t0, 0, 6, m, 1.0, { ms: 6 });
      play('pno', t0, 0, 6, 41, 0.9); play('pno', t0, 0, 6, 29, 0.7);
      [72, 74, 77, 81, 86].forEach((m, i) => play('vib', t0, 0.5 + i / 3, 3, m, 0.7 - i * 0.05));
      for (const m of voicing(bar.segs[0].c, null, 60, 74)) play('bjo', t0, 0, 3, m, 0.8, { ms: 4 });
      play('bass', t0, 0, 6, 29, 1);
      hit('kick', 'kick', t0, 0, 0.9); hit('sn', 'tap', t0, 0, 0.9); hit('ride', 'crash', t0, 0, 0.75);
      return;
    }
    // --- bass
    const bm = X.bass;
    bar.segs.forEach((s, si) => {
      const nx = si + 1 < bar.segs.length ? bar.segs[si + 1].c : nextBar.segs[0].c, root = near(s.c.bass, lastBass, 31, 47);
      if (bm === 'stop') { play('bass', t0, 0, 0.5, root, 1); play('bass', t0, 1.5, 0.4, near(s.c.fifth, root, 31, 47), 0.95); lastBass = root; return; }
      if (bm === 'two') {
        play('bass', t0, s.s, Math.min(2, s.l), root, 1, { gate: 0.9 });
        if (s.l === 4) { const f5 = near(s.c.fifth, root - 3, 28, 47); play('bass', t0, 2, 2, f5, 0.92, { gate: 0.9 }); lastBass = f5; } else lastBass = root;
        return;
      }
      // walking: root, chord tones / steps, chromatic approach to the next root
      const tgt = near(nx.bass, root, 31, 47), up = root < 38 || (root < 43 && R() < 0.5), dir = up ? 1 : -1;
      const third = near(s.c.third, root + 4 * dir, root - 9, root + 9), fifth = near(s.c.fifth, root + 7 * dir, root - 9, root + 9);
      const appr = tgt + (tgt > (s.l === 4 ? fifth : root) ? -1 : 1);
      const line = s.l === 4 ? (R() < 0.55 ? [root, third, fifth, appr] : [root, root + 2 * dir, third, appr]) : [root, appr];
      line.forEach((m, i) => play('bass', t0, s.s + i, 1, m, i === 0 ? 1 : i % 2 ? 0.93 : 0.86, { ms: 6, gate: 0.92 }));
      lastBass = line[line.length - 1];
    });
    // --- piano
    const pm = X.pno;
    bar.segs.forEach(s => {
      if (pm === 'stride') {
        const lo = near(s.c.bass, 43, 36, 50); play('pno', t0, s.s, 0.9, lo, 0.75); play('pno', t0, s.s, 0.9, lo + 12, 0.45);
        pv = voicing(s.c, pv, 55, 70); for (const m of pv) play('pno', t0, s.s + 1, 0.55, m, 0.62, { ms: 7, gate: 0.85 });
        if (s.l === 4) { const f5 = near(s.c.fifth, 43, 36, 50); play('pno', t0, 2, 0.9, f5, 0.7); for (const m of pv) play('pno', t0, 3, 0.55, m, 0.66, { ms: 7, gate: 0.85 }); }
      } else if (pm === 'charl' || pm === 'stop') {
        pv = voicing(s.c, pv, 55, 70);
        for (const m of pv) { play('pno', t0, s.s, 0.9, m, pm === 'stop' ? 1 : 0.62, { ms: 6 }); play('pno', t0, s.s + 1.5, 0.45, m, pm === 'stop' ? 0.9 : 0.55, { ms: 6, gate: 0.8 }); }
      } else if (pm === 'sparse') {
        const hv = voicing(s.c, null, 70, 86);
        for (const m of hv.slice(-2)) play('pno', t0, s.s + 1.5, 1.5, m, 0.42, { ms: 8 });
        if (bar.i % 2) hv.slice(0, 3).forEach((m, i) => play('pno', t0, 3 + i / 3, 0.3, m, 0.32, { ms: 4 }));
      }
    });
    // --- banjo on 2 and 4 (down / up strums)
    if (X.bjo) for (const b of [1, 3]) {
      const s = segAt(bar, b); bv = voicing(s.c, bv, 60, 74);
      const order = b === 1 ? bv : [...bv].reverse();
      order.forEach((m, i) => play('bjo', t0, b, 0.35, m, (b === 3 ? 0.85 : 0.95) * (1 - i * 0.08), { lag: i * 0.009, ms: 4, gate: 1 }));
    }
    // --- drums
    const dm = X.dr, fill = X.fill;
    if (X.crash) hit('ride', 'crash', t0, 0, 0.6);
    for (const b of [1, 3]) hit('hat', 'hat', t0, b, 0.75);
    if (dm === 'stop') { hit('kick', 'kick', t0, 0, 0.9); hit('sn', 'tap', t0, 0, 0.75); hit('kick', 'kick', t0, 1.5, 0.75); hit('sn', 'tap', t0, 1.5, 0.85); return; }
    for (let b = 0; b < 4; b++) {
      hit('kick', 'kick', t0, b, dm === 'full' ? 0.5 : 0.38);
      if (fill && b >= 2) continue;
      hit('sn', 'swish', t0, b - 0.08, (dm === 'brush' ? 0.32 : 0.2) * (b % 2 ? 1 : 0.8), { ms: 4 });
      if (b % 2) hit('sn', 'tap', t0, b, dm === 'brush' ? 0.62 : 0.5);
    }
    if (dm !== 'brush') for (const [p, v] of [[0, 0.75], [1, 0.95], [1.5, 0.5], [2, 0.75], [3, 0.95], [3.5, 0.5]]) if (!(fill && p >= 3)) hit('ride', 'ride', t0, p, v * 0.55, { ms: 6 });
    if (dm === 'full' && R() < 0.35) hit('sn', 'tap', t0, R() < 0.5 ? 2.5 : 3.5, 0.28);
    if (fill) for (let i = 0; i < 6; i++) hit('sn', 'tap', t0, 2 + i / 3, 0.3 + 0.1 * i, { ms: 5 });
  }

  // ---------------------------------------------------------------- transport + mood
  let bar = 0, next = 0, running = false, mood = { night: 0, rain: 0, fog: 0 }, applied = '';
  function applyMood(t) {
    const n = mood.night > 0.6 ? 1 : mood.night > 0.3 ? 0.5 : 0, r = mood.rain > 0.3 ? 1 : 0, f = mood.fog > 0.4 ? 1 : 0;   // quantised
    const key = `${n}${r}${f}`; if (key === applied) return; applied = key;
    const L = { bjo: 1 - 0.75 * n - 0.35 * r, ride: 1 - 0.45 * n, vib: 0.78 + 0.25 * n, sn: 1 - 0.2 * r, pno: 1 - 0.1 * n, hat: 1 - 0.3 * n };
    for (const b in L) BUS[b].lay.gain.setTargetAtTime(Math.max(0.05, L[b]), t, 1.2);
    tone.frequency.setTargetAtTime(n ? 6500 : r ? 5200 : f ? 7000 : 16000, t, 1.5);
    tremD.gain.setTargetAtTime(n ? 0.32 : 0.22, t, 1.5);
  }
  return {
    BAR, BEAT, BARS: BARS.length, SONG, log, out,
    start(t, from = bar) { if (running) return; running = true; bar = ((from % BARS.length) + BARS.length) % BARS.length; next = t; drums(); },
    stop() { running = false; },
    get running() { return running; }, get nextTime() { return next; },
    pump(until) {
      if (!running) return;
      while (next < until) {
        applyMood(next); floor = Math.max(ac.currentTime, 0);
        try { scheduleBar(bar, next); } catch (err) { if (typeof console !== 'undefined') console.warn('[bgm]', err); }
        next += BAR; bar++;
        if (bar >= BARS.length) { if (!loop) { running = false; return; } bar = 0; }
      }
    },
    setMood(m) { if (m) mood = { ...mood, ...m }; },
    // event stings in the band's own voices (the page routes this instance to the effects bus)
    sting(kind, t, id = '') {
      drums();
      if (kind === 'choke') buf('ride', DR.crash, t, 0.1, 0.55, 1, 0.022);                                  // cymbal choke (bell)
      else if (kind === 'wah') { trumpet(t, 0.2, 67, 1, true); trumpet(t + 0.23, 0.46, 65, 0.95, true); }   // plunger "wah-wah" (hop)
      else if (kind === 'trill') { for (let i = 0; i < 8; i++) clarinet(t + i * 0.068, 0.072, i % 2 ? 79 : 77, 0.75); clarinet(t + 0.56, 0.42, 84, 0.85); }   // gulp
      else if (kind === 'egg') {                                                                              // a little "ta-da"
        let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
        const M = [[72, 76, 79, 84], [77, 81, 84, 89], [74, 77, 81, 86], [79, 83, 86, 91], [70, 74, 77, 82]][h % 5];
        M.forEach((m, i) => vibes(t + i * 0.085, 0.3, m, 0.8));
        clarinet(t + 0.34, 0.55, M[3] - 12, 0.8); trumpet(t + 0.34, 0.55, M[1], 0.6);
        buf('ride', DR.ride, t + 0.34, null, 0.5);
      }
    },
    info: () => ({ bar, section: BARS[bar].sec, running, next }),
  };
}
