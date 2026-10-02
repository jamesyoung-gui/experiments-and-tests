// OWNER: audio. 霓虹快递 · Neon Delivery: the theme of Neon Pelican (docs/BGM.md). A cyber-Chinatown darksynth track
// with a talk-box "pe-li-can!" hook, a screaming portamento lead, an erhu-like synth and guzheng plucks on the
// pentatonic, a reese / FM-growl bass, the mech suit-up motif as a leitmotif, tape-stops, stutters, bit-crush drops,
// a city-PA vocoder breakdown and a fake-out ending.
// Self-contained (no imports): src/audio/audio.js plays it live under the city; tools/render-bgm.mjs bundles it alone
// and renders one loop offline (OfflineAudioContext) to dist/bgm-cyberpunk.mp3.
//
// createBGM(ac, dest, opts) -> { start(t, bar), pump(until), resync(t), stop(t), finish(t), dispose(), info(),
//                                nextBeat(t), sting(kind, t), duck, level, log, nextT }
//   opts.seed   humanisation seed (timing ±4…15 ms, velocity ±10 %)
//   opts.inst   parts to keep: kick snare hat bass pad zheng erhu lead talk stab pa fx (stems)
//   opts.dry    no delays and no reverb (analysis renders)
//   opts.mood   (bar, beat) -> per-part multipliers + {lp, drive} (the page's city mood)
//   opts.onLead (midi, t, dur) for every hook note (lead + talk-box; the pelican's croon)
//   opts.loop   false: stop after the last bar (the MP3); default true
//   opts.gain   output level (default 1)
export const BPM = 96, S16 = 60 / BPM / 4, BAR = S16 * 16;
const PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const Q = { '': [0, 4, 7], m: [0, 3, 7], sus: [0, 5, 7], 7: [0, 4, 7, 10], 5: [0, 7] };
export const noteNum = s => { const m = /^([A-G](?:b|#)?)(-?\d)$/.exec(s); return m ? PC[m[1]] + 12 * (+m[2] + 1) : null; };
export const chordPcs = name => { const m = /^([A-G][b#]?)(m|sus|7|5)?$/.exec(name) || [0, 'E', 'm']; return Q[m[2] || ''].map(x => (PC[m[1]] + x) % 12); };
export const voicing = (pcs, lo, hi, max) => { const v = []; for (let m = lo; m <= hi && v.length < max; m++) if (pcs.includes(m % 12)) v.push(m); return v; };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

// ============================================================================ the score (docs/BGM.md)
// tokens: <pitch>:<sixteenths>[:<syllable>]; r = rest ('r' alone = a whole bar); bars split by '|'
const PEL = 'B4:2:pe D5:2:li E5:4:kan', NEON = 'G5:2:ne A5:2:on G5:2:de E5:2:li D5:4:ve E5:4:ri';
const TALK = {
  Open: `r:4 B4:2:pe D5:2:li E5:6:kan r:2|${NEON}`,
  Intro: `r|r:8 ${PEL}|r|${NEON}`,
  Verse: `r|r|r|r|r|r|r|r:8 ${PEL}`,
  Pre: 'r|r|r|r:8 B4:2:pe D#5:2:li F#5:4:kan',
  Drop1: 'r|r|r|r:8 B4:2:pe D#5:2:li F#5:4:kan|r|r|r|r:8 B4:2:pe D#5:2:li F#5:4:kan',
  Drop2: 'r|r|r|r:8 B4:2:pe E5:2:li G#5:4:kan|r|r|r|G#5:2:ne B5:2:on G#5:2:de E5:2:li F#5:4:ve E5:4:ri',
  Final: 'r|r|r|B4:2:pe D5:2:li E5:12:kan',
};
const HOOK1 = 'E5:3 G5:3 B5:2 A5:4 G5:2 E5:2|G5:6 E5:2 D5:4 B4:4|A5:3 B5:3 D6:2 B5:4 A5:2 F#5:2|F#5:6 D#5:2 B4:8';
const LEAD = {
  Pre: 'r|r|B4:4 D#5:4 F#5:4 A5:4|B5:12 r:4',
  Drop1: HOOK1 + '|E5:3 G5:3 B5:2 E6:6 D6:2|D6:3 B5:3 G5:2 E5:8|C6:3 B5:3 A5:2 E5:4 G5:4|F#5:4 A5:4 D#5:4 B4:4',
  Drop2: 'E5:3 G5:3 C6:2 B5:4 G5:4|F#5:3 A5:3 D6:2 E6:8|G#5:6 B5:2 E6:8|F#6:4 E6:4 B5:8|E6:3 D6:3 C6:2 G5:8|A5:3 B5:3 D6:2 F#6:8|G#5:6 B5:2 E6:8|E6:16',
  Final: 'E5:3 G5:3 B5:2 A5:4 G5:2 E5:2|G5:6 E5:2 D5:4 B4:4|A5:3 B5:3 D6:2 B5:8|r',
};
const ERHU = {
  Intro: 'E5:16|F5:8 E5:4 D5:4|E5:16|D5:8 B4:8',
  Verse: 'B4:4 E5:8 D5:2 E5:2|F5:8 E5:4 D5:4|E5:12 r:4|D5:4 A4:4 B4:8|B4:4 E5:4 G5:4 A5:4|C6:6 A5:2 F5:8|G5:4 B5:4 D6:4 B5:4|A5:8 F#5:4 D5:4',
  Pre: 'C6:8 B5:8|D6:8 C6:4 A5:4|r|r',
  Break: 'r|r|r|r|E6:8 D6:4 B5:4|A5:8 G5:8|B5:12 A5:4|F#5:8 D#5:8',
  Drop2: 'E5:8 G5:8|F#5:8 A5:8|G#5:16|B5:16|G5:8 E5:8|F#5:8 D5:8|E5:4 G#5:4 B5:8|E6:16',
};
const MECH = 'E3:2 B3:2 E4:2 B4:10';   // the leitmotif: the suit's "MECH ONLINE" call (E–B–E–B) as power-chord stabs
const STAB = {
  Pre: 'r|r|r|B2:2 F#3:2 B3:2 F#4:2 r:8',
  Drop1: `${MECH}|r|r|r|${MECH}|r|r|r`,
  Break: 'r|r|r|r|r|r|B2:2 F#3:2 B3:2 F#4:10|B2:1 F#3:1 B3:1 F#4:1 B2:1 F#3:1 B3:1 F#4:1 r:8',
  Drop2: `C3:2 G3:2 C4:2 G4:10|r|${MECH}|r|C3:2 G3:2 C4:2 G4:10|r|${MECH}|r`,
  Fake: 'E3:4 r:12|r',
  Final: `${MECH}|r|r|E3:2 B3:2 E4:2 B4:2 E3:8`,
};
const PA = {   // the city PA (vocoder, phone-band): "next stop · neon delivery · pelican · 到达"
  Break: 'r:2 E4:2:ne E4:2:ks E4:4:to r:6|G4:2:ne A4:2:on E4:2:de E4:2:li D4:4:ve E4:4:ri|r:4 E4:2:pe E4:2:li E4:4:kan r:4|B3:2:da B3:2:o D4:4:da r:8',
  Fake: 'r|r:4 B3:3:pe D4:3:li G4:6:kan',
};
const x = (s, n) => Array(n).fill(s).join(' ');
export const FORM = [
  { id: 'Open', name: 'Cold open · “pe-li-can!”', ch: 'Em Em', zh: 'roll roll', dr: 'none none', bs: 'hold hold', dyn: 0.85, padLp: 900, lvl: { pad: 1.3 } },
  { id: 'Intro', name: 'Intro · cyber-Chinatown', ch: 'Em F Em D', zh: x('ost', 4), dr: x('half', 4), bs: x('syn', 4), dyn: 0.8, padLp: 1400 },
  { id: 'Verse', name: 'Verse · the erhu (E Phrygian)', ch: 'Em F Em D Em F G D', zh: x('ost', 8), dr: x('half', 8), bs: x('syn', 8), dyn: 0.78, padLp: 1700 },
  { id: 'Pre', name: 'Pre · the mech wakes', ch: 'C D B B', zh: 'ost ost roll none', dr: 'half16 half16 roll8 roll16', bs: 'r16 r16 r16 hold', dyn: 0.9, padLp: 2600 },
  { id: 'Drop1', name: 'Drop 1 · the scream', ch: 'Em C D B Em C Am B', zh: x('ost', 8), dr: x('drop', 8), bs: x('growl', 8), dyn: 1, padLp: 3000, lvl: { pad: 0.8 } },
  { id: 'Break', name: 'Breakdown · “next stop”', ch: 'Em Em C C Am Am B B', zh: 'trem trem trem trem ost ost roll none', dr: 'none none none none crush crush roll8 roll16', bs: 'sub sub sub sub syn syn r16 r16', dyn: 0.55, padLp: 1100, lvl: { pad: 1.5, zheng: 1.2, pa: 0.7 } },
  { id: 'Drop2', name: 'Drop 2 · the major lift', ch: 'C D E E C D E E', zh: x('ost', 8), dr: x('drop', 8), bs: x('growl', 8), dyn: 1.1, padLp: 3600 },
  { id: 'Fake', name: 'Fake-out ending', ch: 'E E', zh: 'none none', dr: 'hit none', bs: 'hit none', dyn: 1, padLp: 3000, lvl: { pa: 0.5 } },
  { id: 'Final', name: 'Final slam', ch: 'Em C D E5', zh: 'ost ost ost none', dr: 'drop drop drop end', bs: 'growl growl growl end', dyn: 1.1, padLp: 3600 },
];
// bar-level edits (1-based bar numbers): tape start / stop [step, sixteenths], stutters, gaps, crush, risers, hits
const FX = {
  1: { tapeStart: 1 }, 14: { fill: 1 }, 17: { riser: 2 }, 18: { stutter: [12, 2], gap: 14 },
  19: { crash: 1, impact: 0 }, 22: { fill: 1, wob: 4 }, 23: { crash: 1 }, 26: { tapeStop: [12, 4], wob: 4 },
  27: { restore: 1 }, 31: { crush: 0.8 }, 32: { crush: 0.8 }, 33: { riser: 2 }, 34: { tapeStop: [8, 6] },
  35: { restore: 1, crash: 1, impact: 0 }, 37: { wob: 3 }, 38: { wob: 3, stutter: [12, 4] }, 39: { crash: 1 }, 41: { wob: 4 }, 42: { wob: 4, fill: 1 },
  43: { crash: 1, impact: 0, tapeStop: [2, 6] }, 44: { silent: 1 }, 45: { restore: 1, crash: 1, impact: 0 }, 48: { impact: 8, end: 1 },
};
const parseBars = str => !str ? [] : str.split('|').map(b => {
  let s = 0; const out = [];
  for (const tok of b.trim().split(/\s+/)) { const [n, d, syl] = tok.split(':'); const dd = d ? +d : 16; if (n !== 'r') out.push({ s, d: dd, m: noteNum(n), syl }); s += dd; }
  return out;
});
export const LOOP = [];
for (const sec of FORM) {
  const ch = sec.ch.split(' '), zh = sec.zh.split(' '), dr = sec.dr.split(' '), bs = sec.bs.split(' ');
  const tr = k => parseBars(k[sec.id]);
  const T = { talk: tr(TALK), lead: tr(LEAD), erhu: tr(ERHU), stab: tr(STAB), pa: tr(PA) };
  ch.forEach((c, bi) => {
    const n = LOOP.length + 1, f = FX[n] || {};
    LOOP.push({ sec: sec.id, bi, n, chord: c, pcs: chordPcs(c), zh: zh[bi], dr: dr[bi], bs: bs[bi], dyn: sec.dyn, padLp: sec.padLp, lvl: sec.lvl || {},
      talk: T.talk[bi] || [], lead: T.lead[bi] || [], erhu: T.erhu[bi] || [], stab: T.stab[bi] || [], pa: T.pa[bi] || [],
      wob: f.wob || (bs[bi] === 'end' ? 1 : 2), ...f });
  });
}
export const BARS = LOOP.length, LOOP_SEC = BARS * BAR;
for (const k of ['talk', 'lead', 'erhu', 'pa']) {   // contiguous notes glide (portamento), across the loop seam too
  const all = []; LOOP.forEach((b, i) => b[k].forEach(nt => all.push(Object.assign(nt, { abs: i * 16 + nt.s }))));
  all.forEach((nt, i) => { const p = all[(i - 1 + all.length) % all.length], q = all[(i + 1) % all.length], L = BARS * 16;
    nt.leg = all.length > 1 && (p.abs + p.d) % L === nt.abs; nt.nextLeg = all.length > 1 && (nt.abs + nt.d) % L === q.abs; });
}
export const SECTIONS = (() => { let b = 0; return FORM.map(s => { const n = s.ch.split(' ').length, r = { id: s.id, name: s.name, from: b, bars: n }; b += n; return r; }); })();
const PENT = [52, 59, 62, 64, 59, 57, 55, 57];         // the guzheng ostinato on E yu (E G A B D)
const PENT_UP = [52, 55, 57, 59, 62, 64, 67, 69, 71, 74, 76];
const fit = (m, pcs) => (!pcs.includes(m % 12) && pcs.includes((m + 1) % 12) ? m + 1 : m);   // bend the scale to the chord (F, C, D#, G#)
const FORMANT = { a: [750, 1250, 2600], e: [480, 1850, 2600], i: [300, 2250, 3000], o: [480, 850, 2500], u: [330, 750, 2300],
  n: [280, 1500, 2500], m: [280, 1000, 2300], l: [380, 1100, 2600], y: [280, 2200, 3000], r: [420, 1300, 1700] };
const BURST = { p: 1200, b: 900, t: 4000, d: 3000, k: 2200, g: 1800, x: 4500, s: 6000, j: 3500 };

// ============================================================================ the synth
const BASE = { kick: 0.4, snare: 1.0, hat: 2.0, bass: 0.11, pad: 0.1, zheng: 0.17, erhu: 0.13, lead: 0.085, talk: 0.15, stab: 0.14, pa: 0.08, fx: 0.16 };
export function createBGM(ac, dest, o = {}) {
  let seed = (o.seed ?? 7) >>> 0;
  const R = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const jit = ms => (R() * 2 - 1) * ms / 1000, hum = v => v * (0.9 + 0.2 * R());
  const inst = o.inst ? new Set(o.inst) : null, dry = !!o.dry, loop = o.loop !== false, log = [];
  const G = (v = 1) => { const g = ac.createGain(); g.gain.value = v; return g; };
  const F = (type, f, q = 0.707) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const O = (type, f) => { const z = ac.createOscillator(); z.type = type; z.frequency.value = f; return z; };
  const Pan = p => { const s = ac.createStereoPanner(); s.pan.value = Math.max(-1, Math.min(1, p)); return s; };
  const wire = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
  const tg = (p, v, t, tc) => p.setTargetAtTime(v, t, tc);
  const sr = ac.sampleRate;
  const noiseBuf = (sec, pink) => { const n = Math.floor(sec * sr), b = ac.createBuffer(1, n, sr), d = b.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) { const w = R() * 2 - 1; if (pink) { b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; } else d[i] = w * 0.5; } return b; };
  const white = noiseBuf(2.3, false), pink = noiseBuf(2.9, true);
  const plate = (sec, dec) => { const n = Math.floor(sec * sr), b = ac.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let lp = 0, e = 0;
      for (let i = 0; i < n; i++) { const t = i / sr, k = 0.15 + 0.8 * Math.min(1, t / sec); lp += (R() * 2 - 1 - lp) * (1 - k); d[i] = t < 0.02 + c * 0.005 ? 0 : lp * Math.exp(-t / dec) * Math.min(1, (n - i) / (0.05 * sr)); e += d[i] * d[i]; }
      const k = 1 / Math.sqrt(e || 1); for (let i = 0; i < n; i++) d[i] *= k; }
    return b; };
  const curve = k => { const c = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const v = i / 1023 * 2 - 1; c[i] = Math.tanh(k * v) / Math.tanh(k); } return c; };
  const crushCurve = lv => { const c = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const v = i / 1023 * 2 - 1; c[i] = Math.round(v * lv) / lv; } return c; };
  const WS = (c, os = '2x') => { const w = ac.createWaveShaper(); w.curve = c; w.oversample = os; return w; };
  // the tape: one offset (cents) on the detune of every pitched voice → tape-stops and tape-starts
  const tape = ac.createConstantSource(); tape.offset.value = 0;
  const tp = z => { tape.connect(z.detune); z.__tp = 1; return z; };
  const reap = (src, nodes) => { src.onended = () => { for (const n of nodes) { if (n.__tp) try { tape.disconnect(n.detune); } catch { /* gone */ } try { n.disconnect(); } catch { /* gone */ } } }; };
  const env = (p, at, peak, a, d) => { p.setValueAtTime(0, at); p.linearRampToValueAtTime(peak, at + a); p.exponentialRampToValueAtTime(peak * 1e-4 + 1e-7, at + a + d); p.linearRampToValueAtTime(0, at + a + d + 0.01); return at + a + d + 0.02; };

  // ---- the mix: parts → mix → stutter chop → (dry | bit-crush) → tape gain → bus HP → mood LP → duck → level → dest
  const level = G(0), duck = G(1), busLp = F('lowpass', 20000, 0.5), busHp = F('highpass', 28, 0.7), mix = G(1), pump = G(1), chop = G(1), dryG = G(1), crushG = G(0), tapeG = G(1);
  const crushLp = F('lowpass', 3800, 0.7);
  wire(mix, chop, dryG, tapeG); wire(chop, WS(crushCurve(5), 'none'), crushLp, crushG, tapeG); wire(tapeG, busHp, busLp, duck, level, dest); pump.connect(mix);
  const verb = ac.createConvolver(); verb.normalize = false; verb.buffer = plate(2.6, 0.7);
  const vRet = G(dry ? 0 : 0.7); wire(verb, vRet, mix);
  const send = (node, amt) => { if (dry || amt <= 0) return; const s = G(amt); node.connect(s); s.connect(verb); };
  const part = {}; for (const k in BASE) part[k] = G(0);
  const on = k => (inst && !inst.has(k) ? 0 : 1);
  const kDrv = WS(curve(1.8)); wire(part.kick, kDrv, mix);
  for (const k of ['snare', 'hat', 'bass', 'erhu', 'lead', 'talk', 'stab', 'fx']) part[k].connect(mix);
  for (const k of ['pad', 'zheng']) part[k].connect(pump);
  send(part.snare, 0.06); send(part.fx, 0.35); send(part.erhu, 0.3); send(part.zheng, 0.22); send(part.talk, 0.12); send(part.stab, 0.18);
  // the PA bypasses the tape (it speaks over the fake-out silence): phone band, drive, a slap echo
  const paHp = F('highpass', 500, 0.7), paPk = F('peaking', 1800, 1.2), paDl = ac.createDelay(1), paFb = G(0.32), paWet = G(dry ? 0 : 0.45);
  paPk.gain.value = 10; paDl.delayTime.value = 0.27;
  wire(part.pa, paHp, paPk, WS(curve(2.5)), busHp); wire(paPk, paDl, paFb, paDl); wire(paDl, paWet, busHp);

  // bass: a reese (two saws ±16 ct + a sine sub, a moving resonant LP) and an FM growl (sine on sine, wobbling index
  // and filter, heavy drive), both → soft drive → mono out
  const r1 = tp(O('sawtooth', 41)), r2 = tp(O('sawtooth', 41)), r3 = tp(O('sine', 41)), r3g = G(0.7), rLp = F('lowpass', 500, 3), rL = O('sine', 0.21), rLg = G(240), rV = G(0);
  r1.detune.value = -16; r2.detune.value = 16; wire(rL, rLg, rLp.frequency);
  wire(r1, rLp); wire(r2, rLp); wire(rLp, rV); wire(r3, r3g, rV);
  const gc = tp(O('sine', 82)), gm = tp(O('sine', 82)), gmG = G(100), wob = O('sine', 3.2), wobG = G(120), wobF = G(900), gLp = F('lowpass', 1300, 4), gV = G(0);
  wire(gm, gmG, gc.frequency); wire(wob, wobG, gmG.gain); wire(wob, wobF, gLp.frequency); wire(gc, WS(curve(6)), gLp, gV);
  const bOut = WS(curve(1.6)), bHp = F('highpass', 30, 0.7), bLpF = F('lowpass', 7000, 0.7); wire(rV, bOut); wire(gV, bOut); wire(bOut, bHp, bLpF, part.bass);
  // pad: 4 voices × 2 saws (±9 ct) → low cut → LP → VCA → stereo spread → pump
  const padHp = F('highpass', 200, 0.6), padLp = F('lowpass', 1500, 0.6), padV = G(0), pad = [];
  for (let i = 0; i < 4; i++) { const a = tp(O('sawtooth', 220)), b = tp(O('sawtooth', 220)), g = G(0.22), pn = Pan(i % 2 ? 0.55 : -0.55); a.detune.value = -9; b.detune.value = 9; wire(a, g); wire(b, g); wire(g, pn, padHp); pad.push(a, b); }
  wire(padHp, padLp, padV, part.pad); send(part.pad, 0.2);
  // the scream lead: three saws (−18/0/+18 ct) + a square sub → drive → LP → VCA; scoops, heavy portamento, wide vibrato
  const L = [tp(O('sawtooth', 440)), tp(O('sawtooth', 440)), tp(O('sawtooth', 440)), tp(O('square', 220))], lSubG = G(0.3), lPre = G(1.4), lLp = F('lowpass', 5200, 0.8), lHp = F('highpass', 220, 0.7), lV = G(0);
  L[0].detune.value = -18; L[2].detune.value = 18;
  wire(L[0], lPre); wire(L[1], lPre); wire(L[2], lPre); wire(L[3], lSubG, lPre); wire(lPre, WS(curve(3)), lLp, lHp, lV, part.lead);
  const lVib = O('sine', 5.6), lVibG = G(0); wire(lVib, lVibG); L.forEach(z => lVibG.connect(z.detune));
  const dL = ac.createDelay(1), dR = ac.createDelay(1), dFb = G(0.34), dWet = G(dry ? 0 : 0.28), dLp = F('lowpass', 3800, 0.7);
  dL.delayTime.value = dR.delayTime.value = S16 * 3;
  wire(part.lead, dL, dLp, Pan(-0.8), dWet); wire(dLp, dR, Pan(0.8), dWet); wire(dR, dFb, dL); dWet.connect(mix); send(part.lead, 0.2); part.talk.connect(dL);
  // the erhu: two saws (+5 ct) → a nasal body (BP 1 kHz + a +7 dB peak at 2.7 kHz) → VCA; bowed attack, slides, vibrato
  const e1 = tp(O('sawtooth', 440)), e2 = tp(O('sawtooth', 440)), eBp = F('bandpass', 1000, 1.1), ePk = F('peaking', 2700, 1.5), eHp = F('highpass', 350, 0.7), eV = G(0), ePan = Pan(0.3);
  e2.detune.value = 5; ePk.gain.value = 7; wire(e1, eBp); wire(e2, eBp); wire(eBp, ePk, eHp, eV, ePan, part.erhu);
  const eVib = O('sine', 6.3), eVibG = G(0); wire(eVib, eVibG); eVibG.connect(e1.detune); eVibG.connect(e2.detune);
  // talk-box voices: a carrier through three moving formant band-passes (the hook: saws; the city PA: squares, no tape)
  function talkVoice(type, out, tape0) {
    const a = O(type, 220), b = O(type, 220), mx = G(1), V = G(0), dryC = G(0.04);
    if (tape0) { tp(a); tp(b); } b.detune.value = 9;
    const fs = [F('bandpass', 500, 6), F('bandpass', 1500, 9), F('bandpass', 2500, 11)], gs = [2.4, 1.8, 1.1];
    wire(a, mx); wire(b, mx); fs.forEach((f, i) => wire(mx, f, G(gs[i]), V)); wire(mx, dryC, V); V.connect(out);
    const vib = O('sine', 5.2), vibG = G(0); wire(vib, vibG); vibG.connect(a.detune); vibG.connect(b.detune);
    return { a, b, fs, V, out, vibG, oscs: [a, b, vib] };
  }
  const talkHp = F('highpass', 160, 0.7); wire(talkHp, WS(curve(1.5)), part.talk);
  const TK = talkVoice('sawtooth', talkHp, true), PV = talkVoice('square', part.pa, false);
  const oscs = [r1, r2, r3, rL, gc, gm, wob, ...pad, ...L, lVib, e1, e2, eVib, ...TK.oscs, ...PV.oscs];

  // ---- one-shots
  function kick(t, v) {
    const k = O('sine', 170), g = G(0), c = O('triangle', 2600), cg = G(0); wire(k, g, part.kick); wire(c, cg, part.kick);
    k.frequency.setValueAtTime(180, t); k.frequency.exponentialRampToValueAtTime(44, t + 0.09);
    const e = env(g.gain, t, v, 0.0015, 0.38); env(cg.gain, t, v * 0.25, 0.001, 0.008);
    k.start(t); k.stop(e); c.start(t); c.stop(t + 0.02); reap(k, [k, g, c, cg]);
    const p = pump.gain; p.setTargetAtTime(0.3, t, 0.004); p.setTargetAtTime(1, t + 0.07, 0.1);
  }
  function snare(t, v, gated = true) {   // body + crack + the 80s gated reverb tail
    const bus = G(v); bus.connect(part.snare);
    const k = O('triangle', 200), kg = G(0); k.frequency.setValueAtTime(220, t); k.frequency.exponentialRampToValueAtTime(170, t + 0.05); wire(k, kg, bus);
    const e1 = env(kg.gain, t, 0.55, 0.001, 0.08);
    const s = ac.createBufferSource(), bp = F('bandpass', 3000, 0.5), sg = G(0); s.buffer = white; wire(s, bp, sg, bus);
    const e2 = env(sg.gain, t, 0.75, 0.002, 0.12);
    const tl = ac.createBufferSource(), thp = F('highpass', 600, 0.5), tlp = F('lowpass', 10000, 0.5), tgn = G(0); tl.buffer = pink; wire(tl, thp, tlp, tgn, bus);
    const hold = gated ? 0.24 : 0.05;
    tgn.gain.setValueAtTime(0, t + 0.004); tgn.gain.linearRampToValueAtTime(0.5, t + 0.016); tgn.gain.linearRampToValueAtTime(0.34, t + hold); tgn.gain.linearRampToValueAtTime(0, t + hold + 0.015);
    k.start(t); k.stop(e1); s.start(t, R() * 1.5); s.stop(e2); tl.start(t, R() * 2); tl.stop(t + hold + 0.04);
    reap(tl, [k, kg, s, bp, sg, tl, thp, tlp, tgn, bus]);
  }
  function clap(t, v) {
    const s = ac.createBufferSource(), bp = F('bandpass', 1400, 1.2), g = G(0), pn = Pan(0.08); s.buffer = white; wire(s, bp, g, pn, part.snare);
    let u = t; for (let i = 0; i < 3; i++) { g.gain.setValueAtTime(0, u); g.gain.linearRampToValueAtTime(v, u + 0.002); g.gain.linearRampToValueAtTime(v * 0.2, u + 0.009); u += 0.011; }
    g.gain.linearRampToValueAtTime(v * 0.6, u + 0.002); g.gain.exponentialRampToValueAtTime(v * 0.001, u + 0.15); g.gain.linearRampToValueAtTime(0, u + 0.16);
    s.start(t, R() * 1.5); s.stop(u + 0.2); reap(s, [s, bp, g, pn]);
  }
  function hat(t, v, open) {
    const s = ac.createBufferSource(), hp = F('highpass', 7000, 0.7), lp = F('lowpass', 15000, 0.7), g = G(0), pn = Pan(0.25); s.buffer = white;
    wire(s, hp, lp, g, pn, part.hat); const e = env(g.gain, t, v, 0.0015, open ? 0.14 : 0.04); s.start(t, R() * 2); s.stop(e); reap(s, [s, hp, lp, g, pn]);
  }
  function crash(t, v) {
    const s = ac.createBufferSource(), hp = F('highpass', 4500, 0.6), g = G(0), pn = Pan(-0.2); s.buffer = white; s.loop = true;
    wire(s, hp, g, pn, part.hat); send(pn, 0.25); const e = env(g.gain, t, v, 0.002, 2.2); s.start(t, R() * 2); s.stop(e); reap(s, [s, hp, g, pn]);
  }
  function riser(t, dur, v) {
    const s = ac.createBufferSource(), bp = F('bandpass', 300, 1.8), g = G(0); s.buffer = white; s.loop = true; wire(s, bp, g, part.fx);
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(9000, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + dur - 0.02); g.gain.linearRampToValueAtTime(0, t + dur);
    s.start(t); s.stop(t + dur + 0.03); reap(s, [s, bp, g]);
  }
  function impact(t, v = 1) {             // the drop: a sub boom (62 → 27 Hz) and a dark noise blast
    const k = O('sine', 62), g = G(0); k.frequency.setValueAtTime(62, t); k.frequency.exponentialRampToValueAtTime(27, t + 1.4); wire(k, g, part.fx);
    const e = env(g.gain, t, 0.9 * v, 0.004, 1.6); k.start(t); k.stop(e);
    const s = ac.createBufferSource(), lp = F('lowpass', 1400, 0.7), sg = G(0); s.buffer = pink; wire(s, lp, sg, part.fx);
    lp.frequency.setValueAtTime(2400, t); lp.frequency.exponentialRampToValueAtTime(200, t + 0.9);
    const e2 = env(sg.gain, t, 0.7 * v, 0.003, 0.9); s.start(t, R()); s.stop(e2); reap(s, [k, g, s, lp, sg]);
  }
  function pluck(t, m, v, press = false, dest2 = part.zheng) {   // guzheng: a bent attack, a bright decaying body; 按音: a press-bend up
    const f = mtof(m), a = tp(O('triangle', f)), b = tp(O('sawtooth', f)), bg = G(0.3), lp = F('lowpass', 5000, 1.2), g = G(0), pn = Pan((m - 66) / 22);
    for (const z of [a, b]) { z.frequency.setValueAtTime(f * 1.012, t); z.frequency.exponentialRampToValueAtTime(f, t + 0.025); if (press) { z.frequency.setValueAtTime(f, t + 0.22); z.frequency.exponentialRampToValueAtTime(f * 1.1225, t + 0.38); } }
    lp.frequency.setValueAtTime(6000, t); lp.frequency.setTargetAtTime(900, t + 0.01, 0.15);
    wire(a, lp); wire(b, bg, lp); wire(lp, g, pn, dest2);
    const e = env(g.gain, t, v, 0.0015, press ? 1.4 : 1.0); a.start(t); b.start(t); a.stop(e); b.stop(e); reap(a, [a, b, bg, lp, g, pn]);
  }
  function stab(t, root, dur, v) {        // a power-chord stab (root, fifth, octave) of detuned saws, swept and driven
    const g = G(0), lp = F('lowpass', 400, 2.5), sh = WS(curve(2.2)), zs = [];
    for (const m of [root, root + 7, root + 12]) for (const d of [-10, 10]) { const z = tp(O('sawtooth', mtof(m))); z.detune.value = d; z.connect(lp); zs.push(z); }
    lp.frequency.setValueAtTime(400, t); lp.frequency.exponentialRampToValueAtTime(5000, t + 0.04); lp.frequency.setTargetAtTime(1300, t + 0.05, Math.max(0.05, dur * 0.4));
    wire(lp, sh, g, part.stab);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.setTargetAtTime(v * 0.6, t + 0.05, 0.08); g.gain.setTargetAtTime(0, t + dur, 0.05);
    const end = t + dur + 0.35; zs.forEach(z => { z.start(t); z.stop(end); }); reap(zs[0], [...zs, lp, sh, g]);
  }
  function burst(t, c, v, out) {           // talk-box consonants: a filtered noise breath
    const s = ac.createBufferSource(), bp = F('bandpass', BURST[c], 1.5), g = G(0); s.buffer = white; wire(s, bp, g, out);
    const d = c === 's' || c === 'x' ? 0.07 : 0.022; env(g.gain, t, v, 0.002, d); s.start(t, R()); s.stop(t + d + 0.05); reap(s, [s, bp, g]);
  }
  function talkNote(V, t, n, vel) {        // one syllable: consonant, vowel, a nasal close on "-n"
    const f = mtof(n.m), dur = n.d * S16, syl = n.syl || 'a', c = /^[pbtdkgxsjlmnyr]/.test(syl) ? syl[0] : '', v = (syl.match(/[aeiou]/) || ['a'])[0];
    const nasal = /[aeiou]n$/.test(syl), plos = c && BURST[c], ta = plos ? t + 0.028 : t;
    for (const z of [V.a, V.b]) { if (n.leg) z.frequency.setTargetAtTime(f, t, 0.04); else { z.frequency.setValueAtTime(f * 0.96, t); z.frequency.setTargetAtTime(f, t, 0.02); } }
    const F0 = FORMANT[c] || null, FV = FORMANT[v];
    V.fs.forEach((fl, i) => { if (F0) { fl.frequency.setTargetAtTime(F0[i], t, 0.006); fl.frequency.setTargetAtTime(FV[i], t + 0.035, 0.02); } else fl.frequency.setTargetAtTime(FV[i], ta, 0.012); });
    if (plos) { burst(t, c, vel * 0.6, V.out); tg(V.V.gain, vel * 0.2, t, 0.008); }
    tg(V.V.gain, vel, ta, n.leg ? 0.02 : 0.006);
    tg(V.vibG.gain, 0, t, 0.02); if (dur > 0.5) tg(V.vibG.gain, 18, t + 0.3, 0.15);
    if (nasal) { V.fs.forEach((fl, i) => fl.frequency.setTargetAtTime(FORMANT.n[i], t + dur - 0.09, 0.02)); tg(V.V.gain, vel * 0.55, t + dur - 0.09, 0.02); }
    if (!n.nextLeg) tg(V.V.gain, 0, t + dur - 0.03, 0.025);
  }

  // ---- glitch edits
  function tapeStop(t, dur) {
    try { tape.offset.cancelScheduledValues(t); const c = new Float32Array(32); for (let i = 0; i < 32; i++) c[i] = 1200 * Math.log2(Math.max(0.05, 1 - (i / 31) * 0.95)); tape.offset.setValueCurveAtTime(c, t, dur); } catch { /* overlapping curve */ }
    tg(tapeG.gain, 0, t + dur * 0.5, dur * 0.16);
    for (const g of [padV.gain, rV.gain, gV.gain, lV.gain, eV.gain, TK.V.gain]) tg(g, 0, t + dur, 0.03);
    log.push({ k: 'tapeStop', t });
  }
  function restore(t) {
    try { tape.offset.cancelScheduledValues(t); tape.offset.setValueAtTime(0, t); } catch { /* overlapping curve */ }
    tg(tapeG.gain, 1, t, 0.004);
  }
  function tapeStart(t, dur) {
    try { tape.offset.cancelScheduledValues(t); const c = new Float32Array(32); for (let i = 0; i < 32; i++) c[i] = 1200 * Math.log2(0.25 + 0.75 * Math.pow(i / 31, 0.6)); tape.offset.setValueCurveAtTime(c, t, dur); } catch { /* overlapping curve */ }
    tg(tapeG.gain, 0.3, t, 0.006); tg(tapeG.gain, 1, t + 0.02, dur * 0.3);
    log.push({ k: 'tapeStart', t });
  }
  function stutter(t, steps) {             // 32nd-note chops of the whole mix, bit-crushed while they last
    for (let k = 0; k < steps * 2; k++) tg(chop.gain, k % 2 ? 0.3 : 1, t + k * S16 / 2, 0.004);
    tg(chop.gain, 1, t + steps * S16, 0.004);
    tg(crushG.gain, 0.7, t, 0.006); tg(dryG.gain, 0.5, t, 0.006); tg(crushG.gain, 0, t + steps * S16, 0.01); tg(dryG.gain, 1, t + steps * S16, 0.01);
    log.push({ k: 'stutter', t });
  }

  // ---- the clock
  const S = { bar: 0, step: 0, nextT: 0, running: false, stopAt: 99, silent: false };
  let lastMood = null;
  const moodAt = (bar, beat) => Object.assign({ lp: 20000, drive: 0 }, o.mood ? o.mood(bar, beat) : null);
  function levels(B, t, md) {
    for (const k in BASE) tg(part[k].gain, on(k) * BASE[k] * (B.lvl[k] ?? 1) * (md[k] ?? 1) * B.dyn * (o.gain ?? 1), t, 0.05);
    tg(busLp.frequency, md.lp, t, 0.3);
    lastMood = md;
  }
  function barStart(i, t) {
    const B = LOOP[i];
    if (B.restore) restore(t);
    if (B.tapeStart) tapeStart(t, 0.7);
    S.stopAt = B.tapeStop ? B.tapeStop[0] : 99; S.silent = !!B.silent;
    levels(B, t, moodAt(i, 0));
    tg(padLp.frequency, B.padLp, t, 0.3);
    if (!S.silent) tg(padV.gain, B.n === BARS ? 0 : 1, t, B.n === BARS ? 0.6 : 0.05);
    const v = voicing(B.pcs.length > 2 ? B.pcs : [...B.pcs, B.pcs[0]], 52, 71, 4); while (v.length < 4) v.push(v[v.length - 2] + 12);
    v.forEach((m, k) => { const f = mtof(m); tg(pad[2 * k].frequency, f, t, 0.03); tg(pad[2 * k + 1].frequency, f, t, 0.03); });
    tg(wob.frequency, (BPM / 60) * B.wob, t, 0.01);
    const cr = B.crush || 0; tg(crushG.gain, cr, t, 0.02); tg(dryG.gain, 1 - cr * 0.8, t, 0.02);
    if (B.crash) crash(t + jit(4), hum(0.24));
    if (B.riser) riser(t, BAR * B.riser - S16 * 2, 0.08);
    if (B.impact === 0) impact(t);
    if (B.stutter) stutter(t + B.stutter[0] * S16, B.stutter[1]);
    if (B.tapeStop) tapeStop(t + B.tapeStop[0] * S16, B.tapeStop[1] * S16 * 0.94);
  }
  const root = B => 28 + ((B.pcs[0] - 4 + 12) % 12);
  function step(i, s, t) {
    const B = LOOP[i], pcs = B.pcs, gap = s >= (B.gap ?? 99) || s > S.stopAt, mute = S.silent || gap;
    if (s % 4 === 0 && s) levels(B, t, moodAt(i, s / 4));
    // ---- bass
    if (!mute) {
      const r = root(B), tb = t + jit(3);
      const reese = (m, len, vel, cut) => {
        for (const z of [r1, r2, r3]) z.frequency.setValueAtTime(mtof(m), tb);
        tg(rV.gain, vel, tb, 0.004); if (len) tg(rV.gain, 0, tb + len, 0.02);
        tg(rLp.frequency, cut, tb, 0.004); tg(rLp.frequency, cut * 0.45, tb + 0.01, S16 * 1.5);
      };
      const growl = (m, len, vel) => {
        const f = mtof(m); gc.frequency.setValueAtTime(f, tb); gm.frequency.setValueAtTime(f, tb); tg(gmG.gain, f * 1.3, tb, 0.005); tg(wobG.gain, f * 1.6, tb, 0.005);
        tg(gV.gain, vel, tb, 0.004); tg(gV.gain, 0, tb + len, 0.02);
      };
      const bs = B.bs;
      if (bs === 'hold' || bs === 'sub') { if (s === 0) { for (const z of [r1, r2, r3]) z.frequency.setTargetAtTime(mtof(r), t, 0.03); tg(rV.gain, bs === 'sub' ? 0.5 : 0.75, t, 0.06); tg(rLp.frequency, bs === 'sub' ? 160 : 600, t, 0.1); tg(gV.gain, 0, t, 0.03); } }
      else if (bs === 'syn') { tg(gV.gain, 0, t, 0.03); const P = [0, 3, 6, 8, 11, 14]; if (P.includes(s)) reese(r + (s === 14 ? 12 : 0), S16 * (s === 0 || s === 8 ? 2.5 : 1.6), hum(s % 8 ? 0.7 : 0.95), s % 8 ? 900 : 1400); }
      else if (bs === 'r16') { tg(gV.gain, 0, t, 0.03); reese(r + (s % 4 === 2 ? 12 : 0), S16 * 0.7, hum(s % 4 ? 0.7 : 0.95), 700 + 140 * s); }
      else if (bs === 'growl') { tg(rV.gain, 0, t, 0.02); const P = [0, 3, 6, 10, 12]; const k = P.indexOf(s); if (k >= 0) growl(r + 12 + (s === 12 ? 12 : 0), ((P[k + 1] ?? 16) - s) * S16 - 0.03, hum(0.9)); }
      else if (bs === 'hit') { if (s === 0) { tg(rV.gain, 0, t, 0.02); growl(r + 12, S16 * 6, 1); } }
      else if (bs === 'end') { if (s === 0 || s === 8) { tg(rV.gain, 0, t, 0.02); growl(r + 12, s ? BAR * 0.45 : S16 * 6, 1); } }
      else if (bs === 'none' && s === 0) { tg(rV.gain, 0, t, 0.05); tg(gV.gain, 0, t, 0.05); }
    }
    // ---- guzheng
    if (!mute) {
      if (B.zh === 'ost' && s % 2 === 0) pluck(t + jit(8), fit(PENT[(s / 2) % 8] + (B.sec === 'Drop2' || B.sec === 'Final' ? 12 : 0), pcs), hum(s % 4 ? 0.55 : 0.75), s === 14 && B.bi % 2 === 1);
      else if (B.zh === 'roll' && s === 0) PENT_UP.forEach((m, k) => pluck(t + k * S16 / 2, fit(m, pcs), 0.35 + 0.04 * k, k === PENT_UP.length - 1));
      else if (B.zh === 'trem') { const m = fit(B.bi % 2 ? 71 : 76, pcs); pluck(t + jit(4), m, 0.18 + 0.12 * Math.sin(Math.PI * s / 16)); pluck(t + S16 / 2 + jit(4), m, 0.14 + 0.1 * Math.sin(Math.PI * s / 16)); }
    }
    // ---- melodies (notes that start on the tape-stop step still play: they dive with the tape)
    if (!S.silent) {
      for (const n of B.talk) if (n.s === s && s <= S.stopAt) { const tt = t + jit(n.leg ? 4 : 10); talkNote(TK, tt, n, hum(0.85)); if (o.onLead) o.onLead(n.m, tt, n.d * S16); }
      for (const n of B.lead) if (n.s === s && s <= S.stopAt) {
        const tl = t + jit(n.leg ? 5 : 12), dur = n.d * S16, f = mtof(n.m);
        for (const [z, k] of [[L[0], 1], [L[1], 1], [L[2], 1], [L[3], 0.5]]) { if (n.leg) z.frequency.setTargetAtTime(f * k, tl, 0.06); else { z.frequency.setValueAtTime(f * k * 0.917, tl); z.frequency.setTargetAtTime(f * k, tl, 0.035); } }
        tg(lV.gain, hum(0.85), tl, n.leg ? 0.03 : 0.006);
        tg(lVibG.gain, 0, tl, 0.03); if (dur > 0.45) tg(lVibG.gain, 30, tl + 0.25, 0.25);
        if (!n.nextLeg) tg(lV.gain, 0, tl + dur - 0.03, 0.03);
        log.push({ k: 'lead', t: tl, m: n.m, d: dur }); if (o.onLead) o.onLead(n.m, tl, dur);
      }
      for (const n of B.erhu) if (n.s === s && s <= S.stopAt) {
        const te = t + jit(12), dur = n.d * S16, f = mtof(n.m);
        for (const z of [e1, e2]) { if (n.leg) z.frequency.setTargetAtTime(f, te, 0.05); else if (n.d >= 8) { z.frequency.setValueAtTime(f * 0.891, te); z.frequency.setTargetAtTime(f, te + 0.04, 0.07); } else z.frequency.setValueAtTime(f, te); }
        tg(eV.gain, hum(0.85), te, n.leg ? 0.04 : 0.05);
        tg(eVibG.gain, 0, te, 0.04); if (dur > 0.4) tg(eVibG.gain, 32, te + 0.18, 0.15);
        if (!n.nextLeg) tg(eV.gain, 0, te + dur - 0.05, 0.05);
      }
      for (const n of B.stab) if (n.s === s && s <= S.stopAt) stab(t + jit(4), n.m, n.d * S16 * 0.85, hum(n.d >= 8 ? 1 : 0.8));
    }
    for (const n of B.pa) if (n.s === s) talkNote(PV, t, n, 0.9);   // the PA speaks even in the silence
    // ---- drums
    if (mute) return;
    const dr = B.dr, K = t + jit(4);
    if (dr === 'half' || dr === 'half16' || dr === 'crush') {
      if (s === 0 || s === 10) kick(K, hum(0.95)); if (s === 8) snare(t + jit(6), hum(0.95), true);
      if (dr === 'half16') hat(t + jit(8), hum(s % 4 === 2 ? 0.5 : 0.25), s % 8 === 4);
      else if (s % 2 === 0) hat(t + jit(8), hum(s % 4 ? 0.45 : 0.25), s % 8 === 4);
    } else if (dr === 'drop') {
      if (s % 4 === 0) kick(K, hum(1)); if (s === 4 || s === 12) { snare(t + jit(5), hum(0.95), true); clap(t + 0.004, hum(0.4)); }
      hat(t + jit(8), hum(s % 4 === 2 ? 0.55 : s % 2 ? 0.22 : 0.32), s % 4 === 2);
      if (s === 15 && R() < 0.5) snare(t + jit(5), 0.25, false);
    } else if (dr === 'roll8' || dr === 'roll16') {
      if (s % (dr === 'roll8' ? 8 : 4) === 0) kick(K, hum(0.9));
      if (dr === 'roll16' || s % 2 === 0) snare(t + jit(4), hum(0.25 + 0.6 * s / 16), false);
    } else if (dr === 'hit') { if (s === 0) { kick(K, 1); snare(t, 0.9, true); } }
    else if (dr === 'end') { if (s === 0 || s === 8) { kick(K, 1); snare(t, 0.9, true); if (s === 8) { crash(t, 0.3); impact(t, 1); } } }
    if (B.fill && s >= 12) snare(t + jit(5), hum(0.3 + 0.13 * (s - 12)), false);
  }
  const api = {
    log, BARS, BAR, BPM, LOOP_SEC, duck, level,
    get nextT() { return S.nextT; },
    start(t, bar = 0) { S.bar = bar % BARS; S.step = 0; S.nextT = t; S.running = true; restore(t - 0.005); tg(level.gain, 1, t - 0.01, 0.05); },
    resync(t) { S.nextT = Math.max(S.nextT, t); },
    pump(until) {
      while (S.running && S.nextT < until) {
        if (S.step === 0) barStart(S.bar, S.nextT);
        step(S.bar, S.step, S.nextT);
        S.nextT += S16;
        if (++S.step === 16) { S.step = 0; S.bar++; if (S.bar >= BARS) { if (loop) S.bar = 0; else S.running = false; } }
      }
    },
    stop(t) { S.running = false; tg(level.gain, 0, t, 0.25); },
    finish(t) { for (const g of [padV.gain, rV.gain, gV.gain, lV.gain, eV.gain, TK.V.gain]) tg(g, 0, t, 0.4); },
    dispose() { for (const z of [...oscs, tape]) try { z.stop(); } catch { /* stopped */ } try { level.disconnect(); } catch { /* gone */ } },
    info() { const b = (S.bar - (S.step === 0 ? 1 : 0) + BARS) % BARS, B = LOOP[b]; return { bar: b, step: S.step, sec: B.sec, chord: B.chord, pcs: B.pcs, bpm: BPM, mood: lastMood }; },
    nextBeat(t) { const b0 = S.nextT + ((4 - S.step % 4) % 4) * S16, k = Math.ceil((t - b0) / (S16 * 4) - 1e-6); return b0 + k * S16 * 4; },
    sting(kind, t) {                         // event stings on the beat, in the current chord
      const { pcs } = api.info(), r = 52 + ((pcs[0] - 4 + 12) % 12);
      if (kind === 'gulp') PENT_UP.slice(3, 9).forEach((m, k) => pluck(t + k * S16 / 2, fit(m + 12, pcs), 0.5, k === 5, part.fx));   // a guzheng run up
      else if (kind === 'wave') [76, 71, 69].forEach((m, k) => pluck(t + k * S16, fit(m, pcs), 0.45, false, part.fx));
      else if (kind === 'mech') { [r, r + 7, r + 12, r + 19].forEach((m, k) => stab(t + k * S16 * 2, m, k === 3 ? S16 * 6 : S16 * 1.6, k === 3 ? 1 : 0.8)); crash(t + S16 * 6, 0.25); impact(t + S16 * 6, 0.7); }   // the leitmotif
      log.push({ k: 'sting', t, kind });
    },
  };
  const t0 = ac.currentTime; for (const z of oscs) z.start(t0); tape.start(t0);
  return api;
}
