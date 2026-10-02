// OWNER: audio. Background music: "鹈鹕大摇摆 · The Pelican Strut", a cheeky 1930s seaside swing number that sounds like
// a found 78-rpm record (wow, flutter, a narrow horn-gramophone band, shellac crackle). The pelican is in the band: its
// honks and bill-clacks answer the muted trumpet, the bicycle bell is a rhythm hit, and a slide whistle, a boing and a
// cymbal choke are woven in. Rubato intro → it kicks in → hook (bent blue note, hiccup rest, a fall) → the trumpet takes
// it → stop-time break with the pelican soloing → drum break → a lazy, dragging bridge → it accelerates → key change up a
// tone → "shave and a haircut … two bits". The score is data (FORM); every sound is synthesized here. Docs: docs/BGM.md.
//
// createBGM(ac, dest, opts?) -> { start(t, bar?), stop(), pump(until), setMood({night, rain, fog}), sting(kind, t, id),
//                                 info(), log, marks, ... }
//   opts.loop    true (page): after the tag the record starts again. false: the final ring-out ending.
//   opts.seed    humanisation seed.  opts.gain  output gain.  opts.solo  ['cl', 'bass', …] schedule only these.
//   opts.log     keep a note log + section marks.  opts.crackle  false = no surface noise (analysis).
//   opts.lofi    false = bypass the gramophone chain (stings use the clean band).
// pump(until) queues whole bars whose downbeat is before `until` (a lookahead timer drives it); the tempo map is part
// of the score (per bar bpm + rubato beat multipliers), never driven by the ride; mood is applied on bar lines.

const TAU = Math.PI * 2;
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const acc = s => (s === '#' ? 1 : s === 'b' ? -1 : 0);
const pcOf = s => (PC[s[0]] + acc(s[1]) + 12) % 12;
export const midiOf = n => { const m = /^([A-G])([#b]?)(\d)$/.exec(n); return 12 * (+m[3] + 1) + PC[m[1]] + acc(m[2]); };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const QUAL = { '6': [0, 4, 7, 9], '7': [0, 4, 7, 10], 'm7': [0, 3, 7, 10], 'maj7': [0, 4, 7, 11], 'dim7': [0, 3, 6, 9] };
function chordOf(s, tr = 0) {
  const m = /^([A-G][#b]?)(maj7|m7|dim7|6|7)(?:\/([A-G][#b]?))?$/.exec(s), r = (pcOf(m[1]) + tr) % 12, q = QUAL[m[2]];
  return { name: s, root: r, bass: m[3] ? (pcOf(m[3]) + tr) % 12 : r, tones: q.map(i => (r + i) % 12), third: (r + q[1]) % 12, fifth: (r + q[2]) % 12, seventh: (r + q[3]) % 12 };
}
// one bar of melody, durations in (swung) eighths, a bar is 8:  "C5/1 D5/1 ^A5/2 r/1 F5/1 D5/2>"
//   ^ = bend up from a semitone below (the "wrong" blue note that gets corrected), ~ = smear up from a 4th below,
//   > (after the duration) = fall off the end of the note
export function lineOf(s, tr = 0) {
  let p = 0; const out = [];
  for (const tk of s.trim().split(/\s+/)) {
    const m = /^([~^]?)([A-Gr][#b]?\d?)\/([\d.]+)(>?)$/.exec(tk); if (!m) throw new Error('bgm: bad token ' + tk);
    const l = +m[3] / 2; if (m[2] !== 'r') out.push([p, l, midiOf(m[2]) + tr, (m[1] === '^' ? 'b' : m[1] === '~' ? 's' : '') + (m[4] ? 'f' : '')]); p += l;
  }
  if (Math.abs(p - 4) > 1e-6) throw new Error(`bgm: bar is ${p} beats: ${s}`);
  return out;
}
// one bar of Foley / band-hits: "honk:C4@0.5 clack:3@2 bellx@3 slide:up:2@0 tom:hi@1 crash@3.5 choke@3.5 boing@2"
function fxOf(s, tr = 0) {
  if (!s || !s.trim()) return [];
  return s.trim().split(/\s+/).map(tk => { const [a, p] = tk.split('@'), [k, x, y] = a.split(':'); return { k, x: x && /^[A-G]/.test(x) ? midiOf(x) + tr : x, y, p: +p }; });
}

// ------------------------------------------------------------------ the score (written in F; the last chorus is +2)
const CH_A = 'F6|F6|D7|D7|G7|G7|C7|C7|F6|F6|D7|D7|Gm7|C7|F6 D7|Gm7 C7';
const H1 = 'C5/1 D5/1 ^A5/2 r/1 F5/1 D5/2>', H3 = 'C5/1 D5/1 ^F#5/2 r/1 A5/1 F#5/2>', H5 = 'B4/1 D5/1 F5/1 Ab5/1 G5/3 r/1', H7 = 'Bb4/1 C5/1 E5/1 G5/1 ~Bb5/3 A5/1';
const HIC = 'G5/1 r/1 Gb5/1 r/1 F5/1 r/1 E5/2';            // hic · hic · hic
const R8 = 'r/8';
const A_LEAD = [H1, R8, H3, R8, H5, R8, H7, HIC, H1, R8, 'C5/1 D5/1 ^F#5/2 r/1 A5/1 C6/2', R8, 'Bb4/1 D5/1 F5/2 G5/2 ^Bb5/2', 'A5/1 G5/1 E5/1 C5/1 Bb4/2 G4/2', 'A4/1 C5/1 F5/2 r/1 ^F#5/1 A5/2', 'G5/3 r/1 E5/1 r/1 C5/2'];
const A_FX = ['', 'honk:C4@0.5 honk:A3@1.5', '', 'clack:3@3', '', 'bellx@1 bellx@3', '', 'clack:1@1 clack:1@3', '',
  'honk:C4@0.5 honk:A3@1.5 honk:F3@2.5', '', 'slide:dn:1@3', '', '', '', 'bellx@3.5'];
const A_TP = [R8, R8, R8, 'r/1 A4/1 G4/2 F#4/2 r/2', R8, 'r/4 D5/1 B4/1 G4/2', R8, R8, R8, R8, R8, 'r/1 C5/1 A4/1 F#4/1 D4/2 r/2', R8, R8, R8, R8];
const join = a => a.join('|');
export const FORM = [
  { id: 'intro', zh: '前奏（自由速度）', bpm: 100, sw: 0.5, dyn: 0.55, ch: 'F6|D7|Gm7|C7',
    rub: [[1.3, 1.1, 1, 1.25], [1.1, 1, 1, 1.35], [1, 0.95, 0.9, 0.85], [1.9, 2.3, 1, 1]],
    lead: ['cl', 'r/2 C5/1 D5/1 F5/1 ^A5/3|F#5/2 A5/2 C6/3 r/1|Bb5/1 A5/1 G5/1 F5/1 D5/2 Bb4/2|C6/4 r/4'],
    fx: ['', 'slide:up:1.4@2.4', '', 'clack:1@2 clack:1@3 honk:C4@3.5'],
    tex: { 0: { bass: 'pedal', pno: 'roll', bjo: 0, dr: 'swell' }, 3: { dr: 'none' } } },
  { id: 'vamp', zh: '起奏', bpm: 126, sw: 0.67, dyn: 0.8, ch: 'F6 D7|Gm7 C7', lead: ['cl', 'r/8|r/6 A4/1 Bb4/1'], fx: ['', 'bellx@3'],
    tex: { 0: { bass: 'walk', pno: 'charl', bjo: 1, dr: 'brush' } } },
  { id: 'A', zh: 'A 主题（单簧管 × 鹈鹕）', bpm: 126, sw: 0.67, dyn: 0.85, ch: CH_A, lead: ['cl', join(A_LEAD)], tp: join(A_TP), fx: A_FX,
    tex: { 0: { bass: 'walk', pno: 'charl', bjo: 1, dr: 'brush' } } },
  { id: "A'", zh: 'A′ 小号接过主题', bpm: 126, sw: 0.67, dyn: 0.9, ch: CH_A, counter: 'vib', wah: 1,
    lead: ['tp', join([H1, R8, H3, R8, H5, R8, H7, HIC, H1, R8, A_LEAD[10], R8, A_LEAD[12], A_LEAD[13], A_LEAD[14], 'G5/3 r/1 E5/1 r/1 C5/2'])],
    resp: join([R8, 'r/4 A5/1 G5/1 F5/1 D5/1', R8, 'r/2 C6/2 A5/1 F#5/1 D5/2', R8, 'r/2 G5/1 F5/1 D5/1 B4/1 G4/2', R8, R8,
      R8, 'r/4 ~F5/2 D5/1 C5/1', R8, 'r/1 C6/1 A5/1 F#5/1 D5/2 r/2', R8, R8, R8, R8]),
    fx: ['', '', '', 'honk:D4@3.5', '', 'bellx@1 bellx@3', '', 'clack:1@1 clack:1@3', '', 'honk:C4@0.5', '', 'honk:F3@3.5', '', '', 'bellx@3.5', 'choke@3.5'],
    tex: { 0: { bass: 'walk', pno: 'charl', bjo: 1, dr: 'ride' } } },
  { id: 'break', zh: '停顿节奏 + 鼓独奏', bpm: 126, sw: 0.67, dyn: 0.85, ch: 'F6|D7|G7|C7|F6|D7|C7|C7',
    lead: ['cl', 'r/3 A4/1 C5/1 D5/1 ^F5/2|r/8|r/3 B4/1 D5/1 F5/1 Ab5/1 G5/1|r/8|r/3 C6/1 A5/1 F5/1 D5/1 C5/1|r/8|r/8|r/8'],
    fx: ['', 'honk:A3@2 honk:C4@2.5 honk:Eb4@3 honk:D4@3.5', '', 'clack:6@2', '', 'slide:up:1@2 slide:dn:1@3',
      'tom:hi@0 tom:hi@0.5 tom:lo@1 snare@1.5 tom:lo@2 tom:hi@2.5 snare@3 snare@3.33 snare@3.67',
      'kick@0 snare@0.5 tom:hi@1 tom:lo@1.5 snare@2 clack:1@2.5 snare@3 snare@3.25 snare@3.5 snare@3.75'],
    tex: { 0: { bass: 'stop', pno: 'stop', bjo: 0, dr: 'stop' }, 6: { bass: 'none', pno: 'none', dr: 'solo' } } },
  { id: 'B', zh: 'B 桥段（降B，慵懒拖拍）', bpm: 112, sw: 0.7, dyn: 0.55, ch: 'Bb6|Bb6|Cm7|F7|Dm7|G7|Cm7|F7|C7|D7', counter: 'clLow',
    bpms: [112, 112, 110, 110, 112, 112, 110, 108, 120, 128],
    lead: ['tp', 'D5/4 C5/2 Bb4/2|G4/2 Bb4/2 D5/4|Eb5/3 D5/1 C5/4|A4/2 C5/2 Eb5/4|F5/4 D5/2 C5/2|B4/4 D5/2 F5/2|Eb5/3 D5/1 C5/2 Bb4/2|A4/6 r/2|r/8|r/8'],
    resp: 'r/8|r/8|r/8|r/8|r/8|r/8|r/8|r/8|G4/1 A4/1 Bb4/1 B4/1 C5/1 C#5/1 D5/1 Eb5/1|E5/2 F#5/2 A5/2 ~D6/2',
    fx: ['', '', '', 'boing@3', '', '', '', 'honk:F3@3', '', 'honk:D4@3.5'],
    tex: { 0: { bass: 'two', pno: 'sparse', bjo: 0, dr: 'brush' }, 8: { bass: 'walk', pno: 'charl', bjo: 1, dr: 'roll', counter: 0 }, 9: { bass: 'hits4', pno: 'hits4', dr: 'hits4' } } },
  { id: "A''", zh: 'A″ 升调全奏（G大调）', bpm: 132, sw: 0.68, dyn: 1.15, tr: 2, ch: CH_A, counter: 'vib',
    lead: ['cl', join([H1, R8, H3, R8, H5, R8, H7, HIC, H1, R8, A_LEAD[10], R8, 'Bb5/2 A5/1 G5/1 F5/2 D5/2', 'E5/1 G5/1 Bb5/2 A5/1 G5/1 E5/1 C5/1', 'F5/3 A5/1 F#5/2 A5/2', 'G5/2 Bb5/2 r/1 E5/1 C5/2'])],
    tp: join(A_TP), fx: A_FX.map((f, i) => i === 15 ? 'crash@3.5' : f).map((f, i) => i === 0 ? 'crash@0 ' + f : f),
    tex: { 0: { bass: 'walk', pno: 'stride', bjo: 1, dr: 'full', tp: 'harm', crash: 0 } } },
  { id: 'tag', zh: '尾句 "Shave and a haircut … two bits"', bpm: 132, sw: 0.68, dyn: 1.2, tr: 2, ch: 'F6|C7 F6', rub: [[1, 1, 1, 1], [1, 1.6, 1, 1]],
    lead: ['cl', 'F5/2 C5/1 C5/1 D5/2 C5/2|r/4 E5/2 F5/2'],
    fx: ['', 'bellx@2 honk:F3@3 choke@3.3'], end: 1,
    tex: { 0: { bass: 'hits', pno: 'hits', bjo: 1, dr: 'hits', tp: 'dbl' } } },
];
function barsOf(ending) {
  const out = [];
  for (const s of FORM) {
    const tr = s.tr || 0, chs = s.ch.split('|'), split = x => (x ? x.split('|') : null);
    const lead = split(s.lead[1]), tp = split(s.tp), resp = split(s.resp);
    let tex = { counter: s.counter };
    chs.forEach((c, i) => {
      if (s.tex[i]) tex = { ...tex, crash: 0, ...s.tex[i] };
      const last = i === chs.length - 1, fin = ending && s.end && last, names = c.split(' '), L = 4 / names.length;
      const bpm = s.bpms ? s.bpms[i] : s.bpm, rub = s.rub ? s.rub[i] : [1, 1, 1, 1], beats = rub.map(k => (60 / bpm) * k);
      if (fin) beats[3] *= 1.4;                                                        // a breath before "two bits"
      out.push({ sec: s.id, i, n: chs.length, tr, sw: s.sw, dyn: s.dyn, wah: s.wah, bpm, beats, dur: beats.reduce((a, b) => a + b, 0),
        segs: names.map((nm, k) => ({ c: chordOf(nm, tr), s: k * L, l: L })), inst: s.lead[0], lead: lineOf(lead[i], tr),
        tp: tp ? lineOf(tp[i], tr) : [], resp: resp ? lineOf(resp[i], tr) : [], fx: fxOf(s.fx && s.fx[i], tr),
        tex: { ...tex, crash: s.tex[i] ? tex.crash : 0, fill: last && !s.end && s.id !== 'intro' && tex.dr !== 'solo', fin, end: s.end && last } });
    });
  }
  return out;
}
const BARS_LOOP = barsOf(false);
export const SONG = { title: '鹈鹕大摇摆 · The Pelican Strut', key: 'F major → B♭ (bridge) → G major (last chorus)', bpm: '100 rubato → 126 → 112 → 132',
  bars: BARS_LOOP.length, sections: FORM.map(s => s.id) };
SONG.loopSec = BARS_LOOP.reduce((a, b) => a + b.dur, 0);
SONG.finalSec = barsOf(true).reduce((a, b) => a + b.dur, 0);

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
const fadeHead = (x, n) => { for (let i = 0; i < n && i < x.length; i++) x[i] *= i / n; return x; };

export function createBGM(ac, dest, o = {}) {
  const sr = ac.sampleRate, R = mulberry(o.seed ?? 7), loop = o.loop !== false, solo = o.solo ? new Set(o.solo) : null;
  const BARS = loop ? BARS_LOOP : barsOf(true), log = o.log ? [] : null, marks = [];
  const G = (v = 1) => { const g = ac.createGain(); g.gain.value = v; return g; };
  const F = (type, f, q = 0.707, gain = 0) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.gain.value = gain; return b; };
  const O = (type, f) => { const x = ac.createOscillator(); if (type) x.type = type; x.frequency.value = f; return x; };
  const Pan = p => { if (ac.createStereoPanner) { const s = ac.createStereoPanner(); s.pan.value = p; return s; } return G(1); };
  const wire = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
  const reap = (src, nodes) => { src.onended = () => { for (const n of nodes) try { n.disconnect(); } catch { /* gone */ } }; };
  const buffer = (ch, sec, fill) => { const n = Math.floor(sec * sr), b = ac.createBuffer(ch, n, sr); for (let c = 0; c < ch; c++) fill(b.getChannelData(c), c, n); return b; };
  const noiseArr = n => { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = R() * 2 - 1; return a; };
  const t00 = ac.currentTime;

  // ---------------------------------------------------------------- mix: buses → mood tone → gramophone → out
  const out = G(o.gain ?? 1); out.connect(dest);
  const tone = F('lowpass', 16000, 0.5);
  if (o.lofi === false) tone.connect(out);
  else {   // a found 78: wow (0.55 Hz) + flutter (6.2 Hz) by a modulated delay, horn-gramophone band, a little shellac grit
    const wow = ac.createDelay(0.05); wow.delayTime.value = 0.014;
    for (const [f, d] of [[0.55, 0.0017], [6.2, 0.00009]]) { const l = O('sine', f), g = G(d); wire(l, g, wow.delayTime); l.start(t00); }
    const hp = F('highpass', 120, 0.6), lp = F('lowpass', 5200, 0.6), horn = F('peaking', 1500, 0.9, 3.5), sat = ac.createWaveShaper();
    const curve = new Float32Array(1025); for (let i = 0; i < 1025; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(1.6 * x) / Math.tanh(1.6); }
    sat.curve = curve; sat.oversample = '2x';
    wire(tone, wow, hp, lp, horn, G(0.45), sat, G(1.9), out);          // gentle drive: warmth, not squash
    if (o.crackle !== false) {     // shellac surface: hiss, soft ticks (smooth micro-bursts, not digital steps), a pop, the swish per turn
      const cr = buffer(2, 6.13, (d, c, n) => {
        let lp1 = 0; for (let i = 0; i < n; i++) { lp1 += ((R() * 2 - 1) - lp1) * 0.3; d[i] = lp1 * 0.03 * (1 + 0.4 * Math.sin(TAU * 1.3 * i / sr)); }
        for (let k = 0; k < 6.13 * 22; k++) {
          const at = Math.floor(R() * (n - 800)), big = R() < 0.06, a = (big ? 0.35 : 0.12) * (0.3 + R() * R()), tau = (big ? 0.0011 : 0.0004) * sr, f = 1500 + 2500 * R();
          for (let i = 0; i < 7 * tau && at + i < n; i++) d[at + i] += a * Math.sin(TAU * f * i / sr) * Math.exp(-i / tau) * Math.min(1, i / 12);
        }
        const X = Math.floor(0.05 * sr); for (let i = 0; i < X; i++) { const k = i / X; d[i] = d[i] * k + d[n - X + i] * (1 - k); }
      });
      const s = ac.createBufferSource(); s.buffer = cr; s.loop = true; const g = G(o.crackleGain ?? 0.5), l = F('lowpass', 5500, 0.6);
      wire(s, l, g, out); s.start(t00);
    }
  }
  const verb = ac.createConvolver(); verb.normalize = false;
  verb.buffer = buffer(2, 1.5, (d, c, n) => {        // a small bright studio room, unit energy
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
  bus('tp', { pan: 0.24, hp: 260, send: 0.2, gain: 0.95 });
  bus('bass', { hp: 34, lp: 2600, send: 0.02, gain: 1 });                       // mono, centre
  bus('pno', { pan: -0.26, hp: 110, send: 0.13, gain: 0.8 });
  bus('bjo', { pan: 0.36, hp: 180, send: 0.1, gain: 0.85 });
  bus('vib', { pan: 0.42, hp: 200, send: 0.3, gain: 0.8 });
  bus('ride', { pan: 0.3, hp: 1800, send: 0.08, gain: 0.45 });
  bus('sn', { pan: -0.1, hp: 160, send: 0.1, gain: 0.85 });
  bus('kick', { lp: 600, gain: 0.4 });
  bus('hat', { pan: 0.22, hp: 2500, send: 0.04, gain: 1.1 });
  bus('tom', { pan: 0.12, hp: 60, send: 0.12, gain: 0.7 });
  bus('foley', { pan: 0.18, hp: 120, send: 0.15, gain: 0.9 });                  // the pelican, the bell, slide whistle, boing
  const trem = O('sine', 5.4), tremD = G(0.22); wire(trem, tremD, BUS.vib.lay.gain); trem.start(t00);
  BUS.vib.lay.gain.value = 0.78;

  // ---------------------------------------------------------------- generated buffers (built lazily, cached)
  const cache = new Map();
  const memo = (k, f) => { let b = cache.get(k); if (!b) cache.set(k, b = f()); return b; };
  const clW = (() => { const re = new Float32Array(16), im = new Float32Array(16);   // clarinet: odd harmonics dominate
    [0, 1, 0.04, 0.42, 0.05, 0.24, 0.03, 0.16, 0.02, 0.09, 0.01, 0.05, 0, 0.03, 0, 0.02].forEach((a, i) => { im[i] = a; });
    return ac.createPeriodicWave(re, im); })();
  const breath = memo('breath', () => buffer(1, 1.2, d => { d.set(biquad(noiseArr(d.length), 'bp', 2300, 0.9, sr)); peakNorm(d); fadeTail(d, 2000); fadeHead(d, 200); }));
  const partials = (d, n, f, P) => {          // decaying sines by recurrence: P = [[ratio, amp, tau]]
    for (const [r, a, tau] of P) {
      if (f * r > sr * 0.45) continue;
      const w = TAU * f * r / sr, cw = 2 * Math.cos(w), dec = Math.exp(-1 / (tau * sr)); let y1 = 0, y2 = -Math.sin(w), g = a;
      for (let i = 0; i < n; i++) { const y = cw * y1 - y2; y2 = y1; y1 = y; d[i] += y * g; g *= dec; }
    }
  };
  function pianoBuf(m) {                     // two detuned strings per channel, stretched partials, hammer thump
    return memo('p' + m, () => buffer(2, 2.6, (d, c, n) => {
      const f = mtof(m), Bk = 0.00035, bright = Math.max(0.35, 1.25 - (m - 48) / 48);
      for (let s = 0; s < 2; s++) {
        const det = 1 + (s ? 0.0011 : -0.0006) * (c ? 1.3 : 0.8), P = [];
        for (let k = 1; k <= 12; k++) P.push([k * det * Math.sqrt(1 + Bk * k * k), Math.pow(k, -1.25) * (k === 1 ? 1 : bright) * (k % 7 === 0 ? 0.3 : 1) * 0.5, Math.max(0.12, (2.6 - (m - 40) / 30) / (1 + 0.45 * (k - 1)))]);
        partials(d, n, f, P);
      }
      const h = biquad(noiseArr(Math.floor(0.012 * sr)), 'bp', 900 + 8 * m, 1.2, sr);
      for (let i = 0; i < h.length; i++) d[i] += h[i] * 0.25 * Math.exp(-i / (0.003 * sr)) * Math.min(1, i / 48);
      fadeHead(d, 132); peakNorm(d, 0.9); fadeTail(d, Math.floor(0.4 * sr));
    }));
  }
  const vibBuf = m => memo('v' + m, () => buffer(1, 3, (d, c, n) => { partials(d, n, mtof(m), [[1, 1, 2.4], [3.99, 0.22, 0.45], [9.9, 0.05, 0.1]]); fadeHead(d, 96); peakNorm(d, 0.9); fadeTail(d, Math.floor(0.3 * sr)); }));
  function banjoBuf(m) {                     // Karplus–Strong pluck, bright and short
    return memo('b' + m, () => buffer(1, 0.9, (d, c, n) => {
      const N = Math.max(2, Math.round(sr / mtof(m) - 0.5)), ring = noiseArr(N);
      for (let p = 0; p < 3; p++) for (let i = 1; i < N; i++) ring[i] = 0.5 * ring[i] + 0.5 * ring[i - 1];
      for (let i = 0; i < n; i++) { const j = i % N, y = 0.5 * (ring[j] + ring[(j + 1) % N]) * 0.9965; d[i] = ring[j]; ring[j] = y; }
      biquad(biquad(d, 'hp', 140, 0.7, sr), 'lp', 6500, 0.7, sr); peakNorm(d, 0.9); fadeTail(d, Math.floor(0.1 * sr)); fadeHead(d, 132);
    }));
  }
  const DR = {};
  function drums() {
    if (DR.ride) return;
    DR.ride = buffer(1, 1.8, (d, c, n) => {               // wash + bell partials + stick tick
      const ns = biquad(biquad(noiseArr(n), 'hp', 4200, 0.7, sr), 'lp', 11000, 0.7, sr);
      for (let i = 0; i < n; i++) d[i] = ns[i] * 0.55 * Math.exp(-i / (0.6 * sr));
      partials(d, n, 1, [[3080, 0.35, 0.55], [4370, 0.22, 0.4], [5630, 0.16, 0.3], [7310, 0.1, 0.2]]);
      for (let i = 0; i < 0.004 * sr; i++) d[i] += (R() * 2 - 1) * 0.6 * (1 - i / (0.004 * sr)) * Math.min(1, i / 60);
      fadeHead(d, 88); peakNorm(d); fadeTail(d, 4000);
    });
    DR.crash = buffer(2, 3.2, (d, c, n) => {
      const ns = biquad(noiseArr(n), 'hp', 2600, 0.7, sr);
      for (let i = 0; i < n; i++) d[i] = ns[i] * (Math.exp(-i / (1.1 * sr)) + 0.5 * Math.exp(-i / (0.08 * sr)));
      partials(d, n, 1 + c * 0.004, [[2210, 0.1, 0.9], [3390, 0.08, 0.9], [4910, 0.07, 0.9]]);
      fadeHead(d, 64); peakNorm(d); fadeTail(d, 8000);
    });
    DR.tap = buffer(1, 0.3, (d, c, n) => {                // brush slap on the snare head
      const ns = biquad(biquad(noiseArr(n), 'hp', 1500, 0.7, sr), 'lp', 6500, 0.7, sr);
      for (let i = 0; i < n; i++) d[i] = ns[i] * Math.exp(-i / (0.07 * sr)) + Math.sin(TAU * 196 * i / sr) * 0.35 * Math.exp(-i / (0.035 * sr));
      fadeHead(d, 100); peakNorm(d); fadeTail(d, 1200);
    });
    DR.snare = buffer(1, 0.35, (d, c, n) => {             // stick on the snare (drum break): crack + wires + shell
      const ns = biquad(biquad(noiseArr(n), 'hp', 900, 0.7, sr), 'lp', 7000, 0.7, sr);
      for (let i = 0; i < n; i++) d[i] = ns[i] * (0.7 * Math.exp(-i / (0.11 * sr)) + 0.5 * Math.exp(-i / (0.012 * sr))) + Math.sin(TAU * 185 * i / sr) * 0.6 * Math.exp(-i / (0.05 * sr));
      fadeHead(d, 66); peakNorm(d); fadeTail(d, 1500);
    });
    DR.swish = buffer(1, 0.55, (d, c, n) => {             // one circular brush sweep
      const ns = biquad(biquad(noiseArr(n), 'bp', 4200, 0.6, sr), 'hp', 1200, 0.7, sr);
      for (let i = 0; i < n; i++) { const u = i / n; d[i] = ns[i] * Math.pow(Math.sin(Math.PI * u), 2) * (0.6 + 0.4 * Math.sin(Math.PI * u * 2)); }
      peakNorm(d);
    });
    DR.kick = buffer(1, 0.35, (d, c, n) => {              // felt beater, "feathered"
      let ph = 0;
      for (let i = 0; i < n; i++) { const t = i / sr, f = 46 + 40 * Math.exp(-t / 0.03); ph += TAU * f / sr; d[i] = Math.sin(ph) * Math.exp(-t / 0.12); }
      fadeHead(d, 48); peakNorm(d); fadeTail(d, 800);
    });
    DR.hat = buffer(1, 0.12, (d, c, n) => {               // foot "chick"
      const ns = biquad(noiseArr(n), 'hp', 6500, 0.9, sr);
      for (let i = 0; i < n; i++) d[i] = ns[i] * Math.exp(-i / (0.018 * sr)) * Math.min(1, i / (0.003 * sr));
      peakNorm(d); fadeTail(d, 300);
    });
    for (const [k, f] of [['tomhi', 165], ['tomlo', 104]]) DR[k] = buffer(1, 0.7, (d, c, n) => {   // calf-skin toms, pitch drop
      let ph = 0; const ns = biquad(noiseArr(n), 'bp', 800, 0.8, sr);
      for (let i = 0; i < n; i++) { const t = i / sr; ph += TAU * f * (1 + 0.25 * Math.exp(-t / 0.04)) / sr; d[i] = Math.sin(ph) * Math.exp(-t / 0.2) + ns[i] * 0.25 * Math.exp(-t / 0.02); }
      fadeHead(d, 60); peakNorm(d); fadeTail(d, 1500);
    });
  }

  // ---------------------------------------------------------------- band voices
  const on = b => !solo || solo.has(b);
  const note = (b, t, d, m, v) => { if (log) log.push({ b, t: +t.toFixed(4), d: +d.toFixed(3), m, v: +v.toFixed(2) }); };
  // pitch gestures shared by the horns: bend (blue note corrected), smear (slide in from below), fall (off the end)
  function gesture(det, t, d, fl, base) {
    if (fl.includes('b')) { det.setValueAtTime(base - 100, t); det.setValueAtTime(base - 100, t + 0.05); det.linearRampToValueAtTime(base, t + Math.min(0.24, d * 0.6)); }
    else if (fl.includes('s')) { det.setValueAtTime(base - 500, t); det.linearRampToValueAtTime(base, t + Math.min(0.13, d * 0.5)); }
    else if (d >= 0.7) { det.setValueAtTime(base - 50, t); det.linearRampToValueAtTime(base, t + 0.07); }
    if (fl.includes('f')) { det.setValueAtTime(base, t + d * 0.6); det.linearRampToValueAtTime(base - 700, t + d + 0.04); }
  }
  function clarinet(t, d, m, v, fl = '') {
    const f = mtof(m), g = G(0), lp = F('lowpass', f * 3, 0.8), o1 = O(null, f), o2 = O(null, f), end = t + d, longEnd = d > 2.5;
    o1.setPeriodicWave(clW); o2.setPeriodicWave(clW); o1.detune.value = -3; o2.detune.value = 6;
    wire(o1, lp); wire(o2, G(0.6), lp); wire(lp, g, BUS.cl.in);
    const vib = O('sine', 4.9 + R() * 0.6), vd = G(0); wire(vib, vd); vd.connect(o1.detune); vd.connect(o2.detune);
    if (d > 0.42) { vd.gain.setValueAtTime(0, t + 0.2); vd.gain.linearRampToValueAtTime(14, t + Math.min(0.6, d)); }   // a wide, wobbly 30s vibrato
    gesture(o1.detune, t, d, fl, -3); gesture(o2.detune, t, d, fl, 6);
    const a = 0.2 * v;
    lp.frequency.setValueAtTime(f * 1.6, t); lp.frequency.exponentialRampToValueAtTime(Math.min(9000, f * (4.5 + 2 * v)), t + 0.05); lp.frequency.setTargetAtTime(f * 3.4, t + 0.06, 0.25);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.028); g.gain.setTargetAtTime(a * 0.78, t + 0.03, 0.18);
    g.gain.setTargetAtTime(0, end + (fl.includes('f') ? 0.03 : 0), longEnd ? 0.35 : 0.04);
    const stop = end + (longEnd ? 2.6 : 0.45);
    for (const x of [o1, o2, vib]) { x.start(t); x.stop(stop); }
    const bs = ac.createBufferSource(), bg = G(0); bs.buffer = breath; wire(bs, bg, BUS.cl.in);
    bg.gain.setValueAtTime(0, t); bg.gain.linearRampToValueAtTime(0.035 * v, t + 0.02); bg.gain.setTargetAtTime(0.006 * v, t + 0.03, 0.08); bg.gain.setTargetAtTime(0, end, 0.03);
    bs.start(t, R() * 0.5); bs.stop(Math.min(end + 0.25, t + 0.7)); reap(bs, [bs, bg]);
    reap(o1, [o1, o2, vib, vd, lp, g]);
  }
  function trumpet(t, d, m, v, fl = '', wah = false) {   // harmon-muted: thin, nasal, buzzy (wah: plunger open → closed)
    const f = mtof(m), g = G(0), o1 = O('sawtooth', f), o2 = O('sawtooth', f), end = t + d;
    o1.detune.value = -5; o2.detune.value = 7;
    const hp = F('highpass', 650, 0.7), pk = F('peaking', 1750, 2.2, 9), lp = F('lowpass', 2400, 0.9);
    wire(o1, hp); wire(o2, hp); wire(hp, pk, lp, g, BUS.tp.in);
    const vib = O('sine', 5.5), vd = G(0); wire(vib, vd); vd.connect(o1.detune); vd.connect(o2.detune);
    if (d > 0.42) { vd.gain.setValueAtTime(0, t + 0.18); vd.gain.linearRampToValueAtTime(15, t + Math.min(0.55, d)); }
    gesture(o1.detune, t, d, fl, -5); gesture(o2.detune, t, d, fl, 7);
    const a = 0.13 * v;
    if (wah) { lp.Q.value = 4; lp.frequency.setValueAtTime(450, t); lp.frequency.exponentialRampToValueAtTime(3400, t + Math.max(0.06, d * 0.35)); lp.frequency.exponentialRampToValueAtTime(600, t + Math.max(0.1, d)); }
    else { lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(3600 + 1200 * v, t + 0.045); lp.frequency.setTargetAtTime(2600, t + 0.05, 0.2); }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.022); g.gain.setTargetAtTime(a * 0.72, t + 0.025, 0.15); g.gain.setTargetAtTime(0, end + (fl.includes('f') ? 0.03 : 0), 0.04);
    for (const x of [o1, o2, vib]) { x.start(t); x.stop(end + 0.45); }
    reap(o1, [o1, o2, vib, vd, hp, pk, lp, g]);
  }
  function bass(t, d, m, v) {                  // upright: plucked, woody, mono (slaps a little when it digs in)
    const f = mtof(m), g = G(0), o1 = O('triangle', f), o2 = O('sine', f), lp = F('lowpass', 1500, 1.1), end = t + d;
    wire(o1, G(0.55), lp); wire(o2, lp); wire(lp, g, BUS.bass.in);
    lp.frequency.setValueAtTime(1500 + 900 * Math.max(0, v - 0.9), t); lp.frequency.setTargetAtTime(360, t + 0.01, 0.07);
    const a = 0.2 * v;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.007); g.gain.setTargetAtTime(a * 0.42, t + 0.008, 0.09); g.gain.setTargetAtTime(a * 0.12, t + 0.3, 0.5);
    g.gain.setTargetAtTime(0, end, d > 2.5 ? 0.5 : 0.045);
    o1.start(t); o2.start(t); const st = end + (d > 2.5 ? 3 : 0.45); o1.stop(st); o2.stop(st);
    const n = ac.createBufferSource(), nb = F('bandpass', 700, 1.2), ng = G(0); n.buffer = breath; wire(n, nb, ng, BUS.bass.in);
    ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(0.12 * v, t + 0.002); ng.gain.setTargetAtTime(0, t + 0.003, 0.008); n.start(t, R() * 0.5); n.stop(t + 0.08);
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

  // ---------------------------------------------------------------- the pelican + Foley, played as instruments
  function honk(t, m = 55, v = 1, dur = 0.24) {   // cartoon 1930s pelican "hronk": reedy buzz, two formants, throaty flutter
    const f = mtof(m), o1 = O('sawtooth', f), o2 = O('square', f * 1.006), fl = O('sine', 31 + 6 * R()), fd = G(f * 0.035);
    wire(fl, fd); fd.connect(o1.frequency); fd.connect(o2.frequency);
    for (const [x, k] of [[o1, 1], [o2, 1.006]]) { const fr = x.frequency; fr.setValueAtTime(f * k * 0.94, t); fr.linearRampToValueAtTime(f * k * 1.04, t + dur * 0.3); fr.linearRampToValueAtTime(f * k * 0.86, t + dur); }
    const f1 = F('bandpass', 700, 3.2), f2 = F('bandpass', 1380, 4.5), nasal = F('peaking', 2500, 2.5, 7), m1 = G(1), m2 = G(0.5), m3 = G(0.75), g = G(0);
    wire(o1, m1); wire(o2, m2, m1); m1.connect(f1); m1.connect(f2); f1.connect(nasal); wire(f2, m3, nasal); wire(nasal, g, BUS.foley.in);
    const A = 0.5 * v; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(A, t + 0.02); g.gain.linearRampToValueAtTime(A * 0.85, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur);
    for (const x of [o1, o2, fl]) { x.start(t); x.stop(t + dur + 0.03); }
    reap(o1, [o1, o2, fl, fd, f1, f2, nasal, m1, m2, m3, g]);
  }
  function clack(t, v = 1) {                  // the bill snapping shut: a woody mode + a dry snap
    const s = ac.createBufferSource(), bp = F('bandpass', 1800 + 500 * R(), 5), x = O('sine', 980 + 200 * R()), g = G(0), og = G(0);
    s.buffer = breath; wire(s, bp, g, BUS.foley.in); wire(x, og, BUS.foley.in);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1.3 * v, t + 0.0012); g.gain.setTargetAtTime(0, t + 0.0015, 0.006);
    og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.35 * v, t + 0.001); og.gain.setTargetAtTime(0, t + 0.0012, 0.008);
    s.start(t, R() * 0.5); s.stop(t + 0.09); x.start(t); x.stop(t + 0.09); reap(x, [s, bp, g, x, og]);
  }
  function bellHit(t, v = 1, ring = false) {   // the bicycle bell as a rhythm instrument: "ding" or ring-ring
    const P = [[1, 1, 1.4], [1.52, 0.48, 0.9], [2.03, 0.4, 0.7], [2.71, 0.26, 0.45], [0.51, 0.12, 1]];
    const hits = ring ? [0, 0.031, 0.06, 0.105, 0.136] : [0];
    hits.forEach((dt, j) => {
      const a = v * (ring ? [1, 0.6, 0.42, 0.75, 0.45][j] : 1) * 0.07;
      for (const [r, pa, tau] of P) {
        const x = O('sine', 2040 * r * (1 + 0.004 * (R() - 0.5))), g = G(0); wire(x, g, BUS.foley.in);
        g.gain.setValueAtTime(0, t + dt); g.gain.linearRampToValueAtTime(a * pa, t + dt + 0.0015); g.gain.setTargetAtTime(0, t + dt + 0.002, tau / 4);
        x.start(t + dt); x.stop(t + dt + tau * 2.4); reap(x, [x, g]);
      }
    });
  }
  function slide(t, d, up = true, v = 1) {     // swanee slide whistle
    const x = O('sine', 600), vb = O('sine', 7), vg = G(18), g = G(0), lp = F('lowpass', 4000, 0.7);
    wire(vb, vg, x.detune); wire(x, lp, g, BUS.foley.in);
    x.frequency.setValueAtTime(up ? 520 : 1700, t); x.frequency.exponentialRampToValueAtTime(up ? 1700 : 480, t + d);
    const A = 0.13 * v; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(A, t + 0.04); g.gain.setValueAtTime(A, t + d - 0.06); g.gain.linearRampToValueAtTime(0, t + d);
    x.start(t); vb.start(t); x.stop(t + d + 0.02); vb.stop(t + d + 0.02); reap(x, [x, vb, vg, g, lp]);
  }
  function boing(t, v = 1) {                   // jaw-harp "boing"
    const x = O('triangle', 110), wob = O('sine', 18), wg = G(40), g = G(0), bp = F('bandpass', 900, 3);
    wire(wob, wg, x.frequency); wire(x, bp, g, BUS.foley.in);
    x.frequency.setValueAtTime(90, t); x.frequency.exponentialRampToValueAtTime(240, t + 0.5);
    wg.gain.setValueAtTime(60, t); wg.gain.exponentialRampToValueAtTime(4, t + 0.5);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5 * v, t + 0.01); g.gain.setTargetAtTime(0, t + 0.02, 0.15);
    x.start(t); wob.start(t); x.stop(t + 0.9); wob.stop(t + 0.9); reap(x, [x, wob, wg, g, bp]);
  }
  function foley(e, t, v) {
    if (!on('foley') && !['tom', 'snare', 'kick', 'crash', 'choke'].includes(e.k)) return;
    if (log) log.push({ b: 'fx', n: e.k, t: +t.toFixed(4) });
    const k = e.k;
    if (k === 'honk') honk(t, e.x ?? 55, v);
    else if (k === 'clack') { const n = +(e.x || 1); for (let i = 0; i < n; i++) clack(t + i * BEAT_NOW / 3, v * (1 - 0.06 * i)); }
    else if (k === 'bellx') bellHit(t, v);
    else if (k === 'bell') bellHit(t, v, true);
    else if (k === 'slide') slide(t, +(e.y || 1) * BEAT_NOW, e.x !== 'dn', v);
    else if (k === 'boing') boing(t, v);
    else if (k === 'crash' && on('ride')) buf('ride', DR.crash, t, null, 0.7 * v);
    else if (k === 'choke' && on('ride')) buf('ride', DR.crash, t, 0.1, 0.6 * v, 1, 0.022);
    else if (k === 'tom' && on('tom')) buf('tom', DR[e.x === 'lo' ? 'tomlo' : 'tomhi'], t, null, 0.9 * v);
    else if (k === 'snare' && on('sn')) buf('sn', DR.snare, t, null, 0.75 * v);
    else if (k === 'kick' && on('kick')) buf('kick', DR.kick, t, null, 1.1 * v);
  }

  // ---------------------------------------------------------------- time: tempo map, lean, drunk swing
  let BEAT_NOW = 60 / 126, floor = 0;
  function T(bar, t0, pos) {     // swung position → seconds inside this bar (per-beat durations = tempo map + rubato)
    if (pos < 0) return t0 + pos * bar.beats[0];                      // a pickup a hair before the bar line
    const b = Math.min(3, Math.floor(pos + 1e-9)), f = pos - b, sf = Math.abs(f - 0.5) < 1e-6 ? bar.sw : f;
    let t = t0; for (let k = 0; k < b; k++) t += bar.beats[k];
    return t + sf * bar.beats[b] + (pos >= 4 - 1e-9 ? bar.beats[3] * (1 - sf) : 0);
  }
  const Tend = (bar, t0, pos) => (pos >= 4 - 1e-9 ? t0 + bar.dur + (pos - 4) * bar.beats[3] : T(bar, t0, pos));
  const hum = (ms = 12) => (R() - 0.5) * 2 * ms / 1000;
  const vel = (v, k = 0.1) => v * (1 + (R() - 0.5) * 2 * k);
  let barNo = 0;
  function play(b, bar, t0, pos, dur, m, v, o2 = {}) {
    if (!on(b)) return;
    // the lead leans back and drifts (a little drunk): 10–34 ms late, wandering slowly with the phrase
    const lean = o2.lead ? 0.022 + 0.012 * Math.sin(barNo * 1.7 + pos * 0.9) : (o2.lag || 0);
    const t = Math.max(floor, T(bar, t0, pos) + hum(o2.ms ?? 12) + lean);
    const e = Tend(bar, t0, pos + dur), d = Math.max(0.06, (e - t) * (o2.gate ?? 0.94));
    const vv = vel(v * bar.dyn, o2.vk ?? 0.1);
    if (b === 'cl' || b === 'tp') VOICE[b](t, d, m, vv, o2.fl || '', o2.wah); else VOICE[b](t, d, m, vv);
    note(b, t, d, m, vv);
  }
  function hit(b, name, bar, t0, pos, v, o2 = {}) {
    if (!on(b)) return;
    const t = Math.max(floor, T(bar, t0, pos) + hum(o2.ms ?? 8) + (o2.lag || 0)), vv = vel(v * bar.dyn);
    buf(b, DR[name], t, o2.d ?? null, vv, o2.rate ?? (1 + (R() - 0.5) * 0.03), o2.rel ?? 0.08);
    if (log) log.push({ b, n: name, t: +t.toFixed(4), v: +vv.toFixed(2) });
  }

  // ---------------------------------------------------------------- arranging helpers (voice leading)
  const near = (pc, ref, lo, hi) => { let best = null; for (let m = lo; m <= hi; m++) if (((m % 12) + 12) % 12 === pc && (best == null || Math.abs(m - ref) < Math.abs(best - ref))) best = m; return best; };
  function voicing(c, prev, lo, hi) {
    const ref = prev ? prev.reduce((a, b) => a + b, 0) / prev.length : (lo + hi) / 2;
    let best = null, bd = 1e9;
    for (let r = 0; r < c.tones.length; r++) {
      const pcs = c.tones.slice(r).concat(c.tones.slice(0, r));
      for (let base = lo; base < lo + 12; base++) {
        if (base % 12 !== pcs[0]) continue;
        const v = [base]; for (let k = 1; k < pcs.length; k++) { let m = v[k - 1] + 1; while (m % 12 !== pcs[k]) m++; v.push(m); }
        if (v[v.length - 1] > hi) continue;
        const dd = Math.abs(v.reduce((a, b) => a + b, 0) / v.length - ref); if (dd < bd) { bd = dd; best = v; }
      }
    }
    return best;
  }
  const segAt = (bar, p) => bar.segs.find(s => p >= s.s - 1e-9 && p < s.s + s.l - 1e-9) || bar.segs[0];
  let pv = null, bv = null, lastBass = 41, lastGuide = 69, lastLow = 60;

  function scheduleBar(k, t0) {
    const bar = BARS[k], X = bar.tex, nextBar = BARS[(k + 1) % BARS.length], fin = X.fin;
    barNo = k; BEAT_NOW = bar.beats[0];
    // --- lead + answers (trumpet / clarinet), trumpet harmony or doubling
    const lead = bar.inst;
    for (const [p, l, m, fl] of bar.lead) {
      const acc = Math.abs(p % 1 - 0.5) < 1e-6 ? 1.08 : 0.95, v = (0.85 + Math.min(0.15, l * 0.06)) * acc;
      play(lead, bar, t0, p, fin && p >= 3 ? 4 : l, m, v, { lead: 1, fl, wah: lead === 'tp' && bar.wah, gate: fin && p >= 3 ? 1 : 0.94 });
      if (lead === 'cl' && X.tp === 'dbl') play('tp', bar, t0, p, l, m, v * 0.85, { lag: 0.026, fl });
      if (lead === 'cl' && X.tp === 'harm') {
        const c = segAt(bar, p).c; let h = m - 3; while (h > 50 && !c.tones.includes(h % 12)) h--;
        if (h > 52) play('tp', bar, t0, p, l, h, v * 0.72, { lag: 0.03, fl });
      }
    }
    for (const [p, l, m, fl] of bar.tp) play('tp', bar, t0, p, l, m, 0.95, { lag: 0.02, fl, wah: true });           // plunger answers
    for (const [p, l, m, fl] of bar.resp) play('cl', bar, t0, p, l, m, 0.85, { lead: 1, fl });
    for (const e of bar.fx) foley(e, Math.max(floor, T(bar, t0, e.p) + hum(6)), bar.dyn);
    // --- vibes guide-tone counter-melody, low clarinet pads in the bridge
    if (X.counter === 'vib' && !fin) for (const s of bar.segs) {
      const m = [s.c.third, s.c.seventh].map(pc => near(pc, lastGuide, 64, 83)).sort((a, b) => Math.abs(a - lastGuide) - Math.abs(b - lastGuide))[0];
      lastGuide = m; play('vib', bar, t0, s.l === 4 ? 2 : s.s + 1, s.l === 4 ? 2 : 1, m, bar.i % 2 ? 0.75 : 0.55);
    }
    if (X.counter === 'clLow') for (const s of bar.segs) {
      const m = [s.c.third, s.c.seventh].map(pc => near(pc, lastLow, 55, 67)).sort((a, b) => Math.abs(a - lastLow) - Math.abs(b - lastLow))[0];
      lastLow = m; play('cl', bar, t0, s.s, s.l, m, 0.45, { ms: 15, gate: 0.97 });
    }
    if (fin) {   // after "two bits": the band's final chord rings out under the crackle
      const c = segAt(bar, 3).c; bv = voicing(c, pv, 55, 72); for (const m of bv) play('pno', bar, t0, 3, 5, m, 0.9, { ms: 6 });
      play('pno', bar, t0, 3, 5, near(c.root, 41, 36, 47), 0.8); play('bass', bar, t0, 3, 5, near(c.root, 31, 28, 40), 1);
      [0, 4, 7, 12, 16].forEach((iv, i) => play('vib', bar, t0, 3.25 + i / 6, 3, near(c.root, 72, 67, 78) + iv, 0.6 - i * 0.05));
    }
    // --- rhythm section
    const bm = X.bass, pm = X.pno, dm = X.dr;
    if (bm === 'hits' || pm === 'hits' || dm === 'hits') {      // the band plays the tag riff in unison hits
      for (const [p, l, m] of bar.lead) {
        if (fin && p >= 3) continue;
        const c = segAt(bar, p).c;
        if (bm === 'hits') play('bass', bar, t0, p, Math.min(l, 0.9), near(m % 12, 36, 31, 47), 1, { ms: 4 });
        if (pm === 'hits') { pv = voicing(c, pv, 55, 70); for (const x of pv) play('pno', bar, t0, p, Math.min(l, 0.8), x, 0.8, { ms: 4 }); }
        if (dm === 'hits') { hit('sn', 'snare', bar, t0, p, 0.65); hit('kick', 'kick', bar, t0, p, 0.9); }
        if (X.bjo) { bv = voicing(c, bv, 60, 74); bv.forEach((x, i) => play('bjo', bar, t0, p, 0.3, x, 0.9 - i * 0.08, { lag: i * 0.008, ms: 3, gate: 1 })); }
      }
      return;
    }
    if (bm === 'pedal') play('bass', bar, t0, 0, 4, near(bar.segs[0].c.bass, 36, 28, 40), 0.7, { gate: 1 });
    else if (bm === 'hits4') for (let b = 0; b < 4; b++) play('bass', bar, t0, b, 0.7, near(bar.segs[0].c.bass, 38, 31, 47) + (b === 3 ? 12 : 0), 0.85 + 0.08 * b, { ms: 3 });
    else if (bm !== 'none') bar.segs.forEach((s, si) => {
      const nx = si + 1 < bar.segs.length ? bar.segs[si + 1].c : nextBar.segs[0].c, root = near(s.c.bass, lastBass, 31, 47);
      if (bm === 'stop') { play('bass', bar, t0, 0, 0.5, root, 1.05, { lag: -0.004 }); play('bass', bar, t0, 1.5, 0.4, near(s.c.fifth, root, 31, 47), 1, { lag: -0.004 }); lastBass = root; return; }
      if (bm === 'two') {
        play('bass', bar, t0, s.s, Math.min(2, s.l), root, 1, { gate: 0.9 });
        if (s.l === 4) { const f5 = near(s.c.fifth, root - 3, 28, 47); play('bass', bar, t0, 2, 2, f5, 0.92, { gate: 0.9 }); lastBass = f5; } else lastBass = root;
        return;
      }
      const tgt = near(nx.bass, root, 31, 47), up = root < 38 || (root < 43 && R() < 0.5), dir = up ? 1 : -1;
      const third = near(s.c.third, root + 4 * dir, root - 9, root + 9), fifth = near(s.c.fifth, root + 7 * dir, root - 9, root + 9);
      const appr = tgt + (tgt > (s.l === 4 ? fifth : root) ? -1 : 1);
      const line = s.l === 4 ? (R() < 0.55 ? [root, third, fifth, appr] : [root, root + 2 * dir, third, appr]) : [root, appr];
      line.forEach((m, i) => play('bass', bar, t0, s.s + i, 1, m, i === 0 ? 1 : i % 2 ? 0.93 : 0.86, { ms: 6, gate: 0.92, lag: -0.005 }));   // the bass pushes
      lastBass = line[line.length - 1];
    });
    if (pm === 'roll') { const c = bar.segs[0].c; pv = voicing(c, pv, 52, 72); [near(c.bass, 40, 33, 45), ...pv].forEach((m, i) => play('pno', bar, t0, i * 0.12, 3.6 - i * 0.12, m, 0.55, { ms: 4, gate: 1 })); }
    else if (pm === 'hits4') { pv = voicing(bar.segs[0].c, pv, 55, 72); for (let b = 0; b < 4; b++) for (const m of pv) play('pno', bar, t0, b, 0.5, m, 0.7 + 0.1 * b, { ms: 3 }); }
    else if (pm !== 'none') bar.segs.forEach(s => {
      if (pm === 'stride') {
        const lo = near(s.c.bass, 43, 36, 50); play('pno', bar, t0, s.s, 0.9, lo, 0.75); play('pno', bar, t0, s.s, 0.9, lo + 12, 0.45);
        pv = voicing(s.c, pv, 55, 70); for (const m of pv) play('pno', bar, t0, s.s + 1, 0.55, m, 0.62, { ms: 7, gate: 0.85 });
        if (s.l === 4) { play('pno', bar, t0, 2, 0.9, near(s.c.fifth, 43, 36, 50), 0.7); for (const m of pv) play('pno', bar, t0, 3, 0.55, m, 0.66, { ms: 7, gate: 0.85 }); }
      } else if (pm === 'charl' || pm === 'stop') {
        pv = voicing(s.c, pv, 55, 70);
        for (const m of pv) { play('pno', bar, t0, s.s, 0.9, m, pm === 'stop' ? 1.05 : 0.62, { ms: 6 }); play('pno', bar, t0, s.s + 1.5, 0.45, m, pm === 'stop' ? 0.95 : 0.55, { ms: 6, gate: 0.8 }); }
      } else if (pm === 'sparse') {
        const hv = voicing(s.c, null, 70, 86);
        for (const m of hv.slice(-2)) play('pno', bar, t0, s.s + 1.5, 1.5, m, 0.42, { ms: 8 });
        if (bar.i % 2) hv.slice(0, 3).forEach((m, i) => play('pno', bar, t0, 3 + i / 3, 0.3, m, 0.32, { ms: 4 }));
      }
    });
    if (X.bjo && pm !== 'roll' && dm !== 'stop' && dm !== 'solo') for (const b of [1, 3]) {     // banjo on 2 and 4
      const s = segAt(bar, b); bv = voicing(s.c, bv, 60, 74);
      (b === 1 ? bv : [...bv].reverse()).forEach((m, i) => play('bjo', bar, t0, b, 0.35, m, (b === 3 ? 0.85 : 0.95) * (1 - i * 0.08), { lag: i * 0.009, ms: 4, gate: 1 }));
    }
    // --- drums: backbeat leans late, the ride sits on the beat
    if (X.crash) hit('ride', 'crash', bar, t0, 0, 0.6);
    if (dm === 'none' || dm === 'solo') return;
    if (dm === 'swell') { hit('ride', 'crash', bar, t0, 0, 0.18, { rate: 0.7 }); return; }
    if (dm !== 'hits4') for (const b of [1, 3]) hit('hat', 'hat', bar, t0, b, 0.75, { lag: 0.008 });
    if (dm === 'stop') { hit('kick', 'kick', bar, t0, 0, 0.9); hit('sn', 'tap', bar, t0, 0, 0.75); hit('kick', 'kick', bar, t0, 1.5, 0.75); hit('sn', 'tap', bar, t0, 1.5, 0.85); return; }
    if (dm === 'roll') { for (let i = 0; i < 16; i++) hit('sn', 'tap', bar, t0, i / 4, 0.25 + 0.045 * i, { ms: 3 }); return; }
    if (dm === 'hits4') { for (let b = 0; b < 4; b++) { hit('kick', 'kick', bar, t0, b, 1); hit('sn', 'snare', bar, t0, b, 0.5 + 0.12 * b); } return; }
    for (let b = 0; b < 4; b++) {
      hit('kick', 'kick', bar, t0, b, dm === 'full' ? 0.5 : 0.38);
      if (X.fill && b >= 2) continue;
      hit('sn', 'swish', bar, t0, b - 0.08, (dm === 'brush' ? 0.32 : 0.2) * (b % 2 ? 1 : 0.8), { ms: 4 });
      if (b % 2) hit('sn', dm === 'full' ? 'snare' : 'tap', bar, t0, b, dm === 'brush' ? 0.62 : dm === 'full' ? 0.32 : 0.5, { lag: 0.012 });
    }
    if (dm !== 'brush') for (const [p, v] of [[0, 0.75], [1, 0.95], [1.5, 0.5], [2, 0.75], [3, 0.95], [3.5, 0.5]]) if (!(X.fill && p >= 3)) hit('ride', 'ride', bar, t0, p, v * 0.55, { ms: 6 });
    if (dm === 'full' && R() < 0.4) hit('sn', 'tap', bar, t0, R() < 0.5 ? 2.5 : 3.5, 0.3);
    if (X.fill) for (let i = 0; i < 6; i++) hit('sn', 'tap', bar, t0, 2 + i / 3, 0.3 + 0.1 * i, { ms: 5 });
  }

  // ---------------------------------------------------------------- transport + mood
  let bar = 0, next = 0, running = false, mood = { night: 0, rain: 0, fog: 0 }, applied = '';
  function applyMood(t) {
    const n = mood.night > 0.6 ? 1 : mood.night > 0.3 ? 0.5 : 0, r = mood.rain > 0.3 ? 1 : 0, f = mood.fog > 0.4 ? 1 : 0;   // quantised
    const key = `${n}${r}${f}`; if (key === applied) return; applied = key;
    const L = { bjo: 1 - 0.75 * n - 0.35 * r, ride: 1 - 0.45 * n, vib: 0.78 + 0.25 * n, sn: 1 - 0.2 * r, pno: 1 - 0.1 * n, hat: 1 - 0.3 * n, foley: 1 - 0.3 * n };
    for (const b in L) BUS[b].lay.gain.setTargetAtTime(Math.max(0.05, L[b]), t, 1.2);
    tone.frequency.setTargetAtTime(n ? 6500 : r ? 5200 : f ? 7000 : 16000, t, 1.5);
    tremD.gain.setTargetAtTime(n ? 0.32 : 0.22, t, 1.5);
  }
  return {
    BARS: BARS.length, SONG, log, marks, out,
    start(t, from = bar) { if (running) return; running = true; bar = ((from % BARS.length) + BARS.length) % BARS.length; next = t; drums(); },
    stop() { running = false; },
    get running() { return running; }, get nextTime() { return next; },
    pump(until) {
      if (!running) return;
      while (next < until) {
        applyMood(next); floor = Math.max(ac.currentTime, 0);
        if (BARS[bar].i === 0) marks.push({ sec: BARS[bar].sec, t: +next.toFixed(4) });
        if (marks.length > 64) marks.shift();
        try { scheduleBar(bar, next); } catch (err) { if (typeof console !== 'undefined') console.warn('[bgm]', err); }
        next += BARS[bar].dur; bar++;
        if (bar >= BARS.length) { if (!loop) { running = false; return; } bar = 0; }
      }
    },
    setMood(m) { if (m) mood = { ...mood, ...m }; },
    // event stings for the page, in the band's own voices
    sting(kind, t, id = '') {
      drums(); floor = 0;
      if (kind === 'choke') buf('ride', DR.crash, t, 0.1, 0.55, 1, 0.022);                                       // bell
      else if (kind === 'wah') { trumpet(t, 0.2, 67, 1, '', true); trumpet(t + 0.23, 0.46, 65, 0.95, 'f', true); }   // hop
      else if (kind === 'trill') { for (let i = 0; i < 8; i++) clarinet(t + i * 0.068, 0.072, i % 2 ? 79 : 77, 0.75); clarinet(t + 0.56, 0.42, 84, 0.85, 'f'); }   // gulp
      else if (kind === 'egg') {                                                                                   // a little "ta-da"
        let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
        const M = [[72, 76, 79, 84], [77, 81, 84, 89], [74, 77, 81, 86], [79, 83, 86, 91], [70, 74, 77, 82]][h % 5];
        M.forEach((m, i) => vibes(t + i * 0.085, 0.3, m, 0.8));
        clarinet(t + 0.34, 0.55, M[3] - 12, 0.8, 'b'); trumpet(t + 0.34, 0.55, M[1], 0.6, '', true); bellHit(t + 0.34, 0.8);
      }
    },
    info: () => ({ bar, section: BARS[bar].sec, running, next }),
  };
}
