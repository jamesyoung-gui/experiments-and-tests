// OWNER: audio. 霓虹快递 · Neon Delivery: the composed synthwave BGM of Neon Pelican (docs/BGM.md).
// Self-contained (no imports): src/audio/audio.js plays it live under the city; tools/render-bgm.mjs bundles it alone
// and renders one loop offline (OfflineAudioContext) to dist/bgm-cyberpunk.mp3.
//
// createBGM(ac, dest, opts) -> { start(t, bar), pump(until), resync(t), stop(t), finish(t), dispose(), info(),
//                                nextBeat(t), sting(kind, t), duck, level, log, nextT }
//   opts.seed   humanisation seed (timing ±4…15 ms, velocity ±10 %)
//   opts.inst   ['kick','snare','hat','bass','pad','arp','lead','bell','fx'] keep only these parts (stems)
//   opts.dry    no delays and no reverb (analysis renders: the hook pitch check)
//   opts.mood   (bar, beat) -> multipliers {kick,snare,hat,bass,pad,arp,lead,bell, lp, drive} (the page's city mood)
//   opts.onLead (midi, t, dur) for every lead note (the pelican's croon)
//   opts.loop   false: stop after the outro (the MP3); default true (wraps back to the intro)
//   opts.gain   output level (default 1)
export const BPM = 104, S16 = 60 / BPM / 4, BAR = S16 * 16;
const PC = { C: 0, 'C#': 1, Db: 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const Q = { '': [0, 4, 7], m: [0, 3, 7], sus: [0, 5, 7], 7: [0, 4, 7, 10] };
export const noteNum = s => { const m = /^([A-G](?:b|#)?)(-?\d)$/.exec(s); return m ? PC[m[1]] + 12 * (+m[2] + 1) : null; };
export const chordPcs = name => { const m = /^([A-G][b#]?)(m|sus|7)?$/.exec(name) || [0, 'A', 'm']; return Q[m[2] || ''].map(x => (PC[m[1]] + x) % 12); };
export const voicing = (pcs, lo, hi, max) => { const v = []; for (let m = lo; m <= hi && v.length < max; m++) if (pcs.includes(m % 12)) v.push(m); return v; };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

// ============================================================================ the score (docs/BGM.md)
// One token per note: <pitch>:<sixteenths>; r = rest ('r' alone = a whole bar); bars split by '|'.
const MEL = {
  A: 'A4:3 E5:3 D5:2 C5:6 r:2|C5:2 D5:2 E5:3 F5:3 E5:2 C5:4|G4:3 E5:3 D5:2 C5:6 r:2|B4:2 C5:2 D5:4 G5:8|' +
     'A4:3 E5:3 D5:2 C5:6 r:2|C5:2 D5:2 E5:3 F5:3 A5:4 G5:2|G5:3 F5:3 E5:2 D5:4 B4:4|E5:6 D5:2 B4:4 G#4:4',
  A1: 'A4:2 C5:1 E5:3 D5:2 C5:2 E5:2 A5:4|A5:2 F5:2 E5:3 F5:3 A5:4 C6:2|G5:3 E5:3 D5:2 C5:4 E5:2 G5:2|B5:4 A5:2 G5:2 D5:8|' +
      'D5:3 A5:3 G5:2 F5:6 E5:2|F5:2 G5:2 A5:3 C6:3 A5:2 F5:4|E5:4 A5:4 B5:8|G#5:12 r:4',
  B: 'A5:8 G5:4 F5:4|G5:12 D5:4|E5:4 G5:4 C6:8|B5:4 A5:4 E5:8|F5:4 A5:4 C6:8|D6:6 C6:2 B5:4 G5:4|C6:4 B5:2 A5:2 G5:8|G#5:4 B5:4 E5:8',
  Br: 'r|r|r|r|r|r|r:8 B4:4 D5:4|C#5:4 E5:4 F#5:4 A#4:4',
  Out: 'B4:3 F#5:3 E5:2 D5:8|r|A4:3 F#5:3 E5:2 D5:8|C#5:4 E5:4 A5:8|A5:6 G5:2 F5:4 C5:4|D5:4 G5:4 B5:8|r|r',
};
const BEL = {   // the FM-bell counter-line
  In: 'r|r|A5:3 E6:3 D6:2 C6:8|r|r|r|G5:3 D6:3 C6:2 B5:8|r',
  A: 'r:8 C6:2 E6:2 A6:4|r:8 F6:4 C6:4|r:8 E6:2 G6:2 C7:4|r:8 B6:2 G6:2 D6:4|r:8 E6:4 C6:4|r:8 C7:4 A6:4|r:8 B6:4 G6:4|B6:4 G#6:4 E6:4 B5:4',
  A1: 'r:8 C6:2 E6:2 A6:4|r:8 F6:4 C6:4|r:8 E6:2 G6:2 C7:4|r:8 B6:2 G6:2 D6:4|r:8 A6:4 F6:4|r:8 C7:4 A6:4|r:8 B6:4 A6:4|B6:4 G#6:4 E6:4 B5:4',
  B: 'r|r|r|r:8 C6:4 E6:4|r|r|r|r:8 B5:4 E6:4',
  Br: 'D5:3 A5:3 G5:2 F5:8|F5:3 D6:3 C6:2 Bb5:8|C5:3 A5:3 G5:2 F5:8|G5:3 E6:3 D6:2 C6:8|D6:3 A6:3 G6:2 F6:8|D6:3 F6:3 C6:2 Bb5:8|r|r',
  Out: 'r|r|r|r|r|r:8 B5:2 D6:2 G6:4|A5:3 E6:3 D6:2 C6:8|A5:16',
};
export const FORM = [
  { id: 'Intro', name: 'Intro · ignition', ch: 'Am F C G Am F G E', bell: BEL.In },
  { id: 'A', name: 'A · the hook', ch: 'Am F C G Am F G E', lead: MEL.A },
  { id: 'A1', name: "A' · hook, varied", ch: 'Am F C G Dm F Esus E', lead: MEL.A1, bell: BEL.A1 },
  { id: 'B', name: 'B · skyline (C major)', ch: 'F G C Am F G C E', lead: MEL.B, bell: BEL.B },
  { id: 'Br', name: 'Bridge · breakdown & build', ch: 'Dm Bb F C Dm Bb G F#', lead: MEL.Br, bell: BEL.Br },
  { id: 'A2', name: "A'' · final hook (B minor)", ch: 'Bm G D A Bm G A F# Bm G D A Em G F#sus F#', lead: MEL.A + '|' + MEL.A1, bell: BEL.A + '|' + BEL.A1, tr: 2 },
  { id: 'Out', name: 'Outro · home (A minor)', ch: 'Bm G D A F G Am Am', lead: MEL.Out, bell: BEL.Out },
];
const parseBars = (str, tr = 0) => (str || '').split('|').map(b => {
  let s = 0; const out = [];
  for (const tok of b.trim().split(/\s+/)) { const [n, d] = tok.split(':'); const dd = d ? +d : 16; if (n !== 'r') out.push({ s, d: dd, m: noteNum(n) + tr }); s += dd; }
  return out;
});
// the flattened loop: one record per bar
const K4 = [0, 4, 8, 12], SN = [4, 12], E8 = [0, 2, 4, 6, 8, 10, 12, 14], X16 = [...Array(16).keys()];
function arrange(id, bi) {
  const A = { kick: K4, snare: SN, hat: 'off', bass: '8', arp: 16, pad: 1, padLp: 3800, lead: 1, leadLp: 3600, dbl: 0, sub: 0, bell: 1,
    crash: bi === 0, lp: 20000, fill: false, riser: 0, roll: false, gap: 16, clap: false, arpLp: 4000, pat: 0 };
  if (id === 'Intro') {
    A.crash = false; A.lead = 0; A.fill = bi === 7; A.riser = bi === 6 ? 2 : 0;
    if (bi < 4) { A.kick = []; A.snare = []; A.hat = 'none'; A.bass = 'none'; A.padLp = 500 + 420 * bi; A.arpLp = 700 + 450 * bi; A.pad = 1.35; }
    else if (bi < 6) { A.snare = []; A.hat = '16s'; }
  } else if (id === 'A') { A.fill = bi === 7; }
  else if (id === 'A1') { A.hat = '16'; A.bass = '16'; A.fill = bi === 7; A.leadLp = 4400; A.pat = 1; A.arpLp = 4800; }
  else if (id === 'B') { A.kick = [0, 10]; A.snare = [8]; A.hat = '8'; A.bass = 'half'; A.arp = 8; A.padLp = 4600; A.pad = 1.2; A.leadLp = 4000; A.riser = bi === 7 ? 1 : 0; }
  else if (id === 'Br') {
    A.crash = false;
    if (bi < 4) { A.kick = []; A.snare = []; A.hat = 'none'; A.bass = 'hold'; A.lp = 1000; A.pad = 1.1; }
    else {
      A.lp = 1400 + 4200 * (bi - 4); A.kick = bi === 4 ? [0, 8] : K4; A.roll = true; A.hat = bi >= 5 ? '8' : 'none';
      A.snare = bi === 4 ? [] : bi === 5 ? K4 : bi === 6 ? E8 : X16; A.riser = bi === 6 ? 2 : 0; A.gap = bi === 7 ? 14 : 16;
    }
  } else if (id === 'A2') { A.hat = '16'; A.bass = '16'; A.clap = true; A.dbl = 1; A.sub = 1; A.crash = bi % 8 === 0; A.fill = bi === 15; A.leadLp = 5200; A.pad = 1.15; A.pat = 1; A.arpLp = 5600; }
  else if (id === 'Out') {
    if (bi >= 4) { A.snare = []; A.hat = bi < 6 ? 'off' : 'none'; }
    if (bi >= 6) { A.kick = []; A.bass = 'hold'; A.pad = bi === 6 ? 0.9 : 0.7; A.padLp = bi === 6 ? 2400 : 1400; A.fade = bi === 7; }
  }
  return A;
}
export const LOOP = [];
for (const sec of FORM) {
  const ch = sec.ch.split(' '), lead = parseBars(sec.lead, sec.tr), bell = parseBars(sec.bell, sec.tr);
  ch.forEach((c, bi) => LOOP.push({ sec: sec.id, bi, nb: ch.length, chord: c, pcs: chordPcs(c), lead: lead[bi] || [], bell: bell[bi] || [], A: arrange(sec.id, bi) }));
}
export const BARS = LOOP.length, LOOP_SEC = BARS * BAR;
{ // legato flags for the lead (contiguous notes glide: portamento), across the loop seam too
  const all = []; LOOP.forEach((b, i) => b.lead.forEach(n => all.push(Object.assign(n, { abs: i * 16 + n.s }))));
  all.forEach((n, i) => { const p = all[(i - 1 + all.length) % all.length], q = all[(i + 1) % all.length], L = BARS * 16;
    n.leg = (p.abs + p.d) % L === n.abs; n.nextLeg = (n.abs + n.d) % L === q.abs; });
}
export const SECTIONS = (() => { let b = 0; return FORM.map(s => { const n = s.ch.split(' ').length, r = { id: s.id, name: s.name, from: b, bars: n }; b += n; return r; }); })();

// ============================================================================ the synth
const BASE = { kick: 0.4, snare: 0.8, hat: 1.9, bass: 0.13, pad: 0.095, arp: 0.09, lead: 0.1, bell: 0.2, fx: 0.12 };
export function createBGM(ac, dest, o = {}) {
  let seed = (o.seed ?? 7) >>> 0;
  const R = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const jit = ms => (R() * 2 - 1) * ms / 1000, hum = v => v * (0.9 + 0.2 * R());
  const inst = o.inst ? new Set(o.inst) : null, dry = !!o.dry, loop = o.loop !== false, log = [];
  const G = (v = 1) => { const g = ac.createGain(); g.gain.value = v; return g; };
  const F = (type, f, q = 0.707) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const O = (type, f) => { const x = ac.createOscillator(); x.type = type; x.frequency.value = f; return x; };
  const Pan = p => { const s = ac.createStereoPanner(); s.pan.value = p; return s; };
  const wire = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
  const tg = (p, v, t, tc) => p.setTargetAtTime(v, t, tc);
  const reap = (src, nodes) => { src.onended = () => { for (const n of nodes) try { n.disconnect(); } catch { /* gone */ } }; };
  const env = (p, at, peak, a, d) => { p.setValueAtTime(0, at); p.linearRampToValueAtTime(peak, at + a); p.exponentialRampToValueAtTime(peak * 1e-4 + 1e-7, at + a + d); p.linearRampToValueAtTime(0, at + a + d + 0.01); return at + a + d + 0.02; };
  const sr = ac.sampleRate;
  const noiseBuf = (sec, pink) => { const n = Math.floor(sec * sr), b = ac.createBuffer(1, n, sr), d = b.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) { const w = R() * 2 - 1; if (pink) { b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; } else d[i] = w * 0.5; } return b; };
  const white = noiseBuf(2.3, false), pink = noiseBuf(2.9, true);
  const plate = (sec, dec) => { const n = Math.floor(sec * sr), b = ac.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let lp = 0, e = 0;
      for (let i = 0; i < n; i++) { const t = i / sr, k = 0.15 + 0.8 * Math.min(1, t / sec); lp += (R() * 2 - 1 - lp) * (1 - k); d[i] = t < 0.02 + c * 0.005 ? 0 : lp * Math.exp(-t / dec) * Math.min(1, (n - i) / (0.05 * sr)); e += d[i] * d[i]; }
      const k = 1 / Math.sqrt(e || 1); for (let i = 0; i < n; i++) d[i] *= k; }
    return b; };
  const curve = k => { const c = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 1023 * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); } return c; };

  // ---- the mix: parts → (pad/arp/bell through the sidechain pump) → bus HP → mood LP → duck → level → dest
  const level = G(0), duck = G(1), busLp = F('lowpass', 20000, 0.5), busHp = F('highpass', 28, 0.7), mix = G(1), pump = G(1);
  wire(mix, busHp, busLp, duck, level, dest); pump.connect(mix);
  const verb = ac.createConvolver(); verb.normalize = false; verb.buffer = plate(2.4, 0.62);
  const vRet = G(dry ? 0 : 0.7); wire(verb, vRet, mix);
  const send = (node, amt) => { if (dry || amt <= 0) return; const s = G(amt); node.connect(s); s.connect(verb); };
  const part = {}; for (const k in BASE) part[k] = G(0);
  const on = k => (inst && !inst.has(k) ? 0 : 1);
  for (const k of ['kick', 'snare', 'hat', 'bass', 'lead', 'fx']) part[k].connect(mix);
  for (const k of ['pad', 'arp', 'bell']) part[k].connect(pump);
  send(part.snare, 0.06); send(part.fx, 0.3);

  // bass: saw + square (−7 ct) → resonant LP with a per-note envelope → VCA; clean + tanh-drive paths. Mono.
  const b1 = O('sawtooth', 55), b2 = O('square', 55), b2g = G(0.4), bF = F('lowpass', 300, 4), bV = G(0), bCl = G(1), bDr = ac.createWaveShaper(), bDrG = G(0), bHp = F('highpass', 32, 0.7);
  b2.detune.value = -7; bDr.curve = curve(3); bDr.oversample = '2x';
  wire(b1, bF); wire(b2, b2g, bF); wire(bF, bV, bCl, bHp); wire(bV, bDr, bDrG, bHp); bHp.connect(part.bass);
  // pad: 4 voices × 2 saws (−8/+8 ct) → low cut 210 Hz → LP → VCA → stereo chorus (two LFO-swept delays) → pump
  const padHp = F('highpass', 210, 0.6), padLp = F('lowpass', 2400, 0.6), padV = G(0), pad = [];
  for (let i = 0; i < 4; i++) { const a = O('sawtooth', 220), b = O('sawtooth', 220), g = G(0.22); a.detune.value = -8; b.detune.value = 8; wire(a, g); wire(b, g); g.connect(padHp); pad.push(a, b); }
  wire(padHp, padLp, padV);
  const chL = ac.createDelay(0.05), chR = ac.createDelay(0.05), cLfo = O('sine', 0.31), cDep = G(0.0022), cDepR = G(-0.0022);
  chL.delayTime.value = 0.011; chR.delayTime.value = 0.016; wire(cLfo, cDep); cDep.connect(chL.delayTime); cLfo.connect(cDepR); cDepR.connect(chR.delayTime);
  const padDry = G(0.7); wire(padV, padDry, part.pad); wire(padV, chL, Pan(-0.8), part.pad); wire(padV, chR, Pan(0.8), part.pad); send(part.pad, 0.16);
  // arp plucks: saw + square (+5 ct) → LP (Q 3, plucky env) → VCA → low cut → pan, + a dotted-8th delay
  const a1 = O('sawtooth', 440), a2 = O('square', 440), a2g = G(0.35), aF = F('lowpass', 1200, 3), aV = G(0), aHp = F('highpass', 260, 0.7), aPan = Pan(-0.22);
  a2.detune.value = 5; wire(a1, aF); wire(a2, a2g, aF); wire(aF, aV, aHp, aPan, part.arp);
  const aDl = ac.createDelay(1), aFb = G(0.32), aLp = F('lowpass', 2600, 0.7), aWet = G(dry ? 0 : 0.4);
  wire(aHp, aDl, aLp, aFb, aDl); wire(aLp, aWet, Pan(0.45), part.arp); aDl.delayTime.value = S16 * 3; send(part.arp, 0.1);
  // lead: 2 saws (±7 ct) + an octave-up saw (doubling) + a square sub-octave, portamento, delayed vibrato, filter bite
  const l1 = O('sawtooth', 440), l2 = O('sawtooth', 440), l3 = O('sawtooth', 880), l4 = O('square', 220), l3g = G(0), l4g = G(0), lF = F('lowpass', 2400, 1.4), lV = G(0);
  l1.detune.value = -7; l2.detune.value = 7;
  const vib = O('sine', 5.4), vibG = G(0); wire(vib, vibG); for (const x of [l1, l2, l3, l4]) vibG.connect(x.detune);
  wire(l1, lF); wire(l2, lF); wire(l3, l3g, lF); wire(l4, l4g, lF); wire(lF, lV, part.lead);
  const dL = ac.createDelay(1), dR = ac.createDelay(1), dFb = G(0.32), dWet = G(dry ? 0 : 0.26), dLp = F('lowpass', 3600, 0.7);
  dL.delayTime.value = dR.delayTime.value = S16 * 3;
  wire(part.lead, dL, dLp, Pan(-0.75), dWet); wire(dLp, dR, Pan(0.75), dWet); wire(dR, dFb, dL); dWet.connect(mix); send(part.lead, 0.2);
  part.bell.connect(dL); send(part.bell, 0.35);
  const oscs = [b1, b2, a1, a2, l1, l2, l3, l4, vib, cLfo, ...pad];

  // ---- one-shots
  function kick(t, v) {
    const x = O('sine', 150), g = G(0), c = O('triangle', 2400), cg = G(0); wire(x, g, part.kick); wire(c, cg, part.kick);
    x.frequency.setValueAtTime(165, t); x.frequency.exponentialRampToValueAtTime(48, t + 0.085);
    const e = env(g.gain, t, v, 0.0015, 0.36); env(cg.gain, t, v * 0.22, 0.001, 0.007);
    x.start(t); x.stop(e); c.start(t); c.stop(t + 0.02); reap(x, [x, g, c, cg]);
    const p = pump.gain; p.setTargetAtTime(0.32, t, 0.004); p.setTargetAtTime(1, t + 0.06, 0.1);   // sidechain-style pump
  }
  function snare(t, v, gated = true) {   // body + crack, and the 80s gated reverb: a dense flat tail cut dead
    const bus = G(v); bus.connect(part.snare);
    const x = O('triangle', 200), xg = G(0); x.frequency.setValueAtTime(215, t); x.frequency.exponentialRampToValueAtTime(170, t + 0.05); wire(x, xg, bus);
    const e1 = env(xg.gain, t, 0.55, 0.001, 0.08);
    const s = ac.createBufferSource(), bp = F('bandpass', 3000, 0.5), sg = G(0); s.buffer = white; wire(s, bp, sg, bus);
    const e2 = env(sg.gain, t, 0.75, 0.002, 0.12);
    const tl = ac.createBufferSource(), thp = F('highpass', 600, 0.5), tlp = F('lowpass', 10000, 0.5), tgn = G(0); tl.buffer = pink; wire(tl, thp, tlp, tgn, bus);
    const hold = gated ? 0.22 : 0.05;
    tgn.gain.setValueAtTime(0, t + 0.004); tgn.gain.linearRampToValueAtTime(0.5, t + 0.016); tgn.gain.linearRampToValueAtTime(0.34, t + hold); tgn.gain.linearRampToValueAtTime(0, t + hold + 0.015);
    x.start(t); x.stop(e1); s.start(t, R() * 1.5); s.stop(e2); tl.start(t, R() * 2); tl.stop(t + hold + 0.04);
    reap(tl, [x, xg, s, bp, sg, tl, thp, tlp, tgn, bus]);
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
    wire(s, hp, g, pn, part.hat); send(pn, 0.25); const e = env(g.gain, t, v, 0.002, 1.9); s.start(t, R() * 2); s.stop(e); reap(s, [s, hp, g, pn]);
  }
  function riser(t, dur, v) {             // noise sweep into the next section, gone by the downbeat
    const s = ac.createBufferSource(), bp = F('bandpass', 300, 1.5), g = G(0); s.buffer = white; s.loop = true; wire(s, bp, g, part.fx);
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(8000, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + dur - 0.02); g.gain.linearRampToValueAtTime(0, t + dur);
    s.start(t); s.stop(t + dur + 0.03); reap(s, [s, bp, g]);
  }
  let bellSide = 1;
  function bell(t, m, v, dest2 = part.bell) {   // FM bell: sine carrier, 3.5:1 modulator, decaying index; a 2× sine partial
    const f = mtof(m), c = O('sine', f), md = O('sine', f * 3.5), mg = G(0), cg = G(0), h = O('sine', f * 2), hg = G(0), pn = Pan(0.3 * (bellSide = -bellSide));
    wire(md, mg); mg.connect(c.frequency); wire(c, cg, pn); wire(h, hg, pn); pn.connect(dest2);
    mg.gain.setValueAtTime(f * 2.4, t); mg.gain.exponentialRampToValueAtTime(f * 0.08, t + 0.9);
    const e = env(cg.gain, t, v, 0.002, 1.7); env(hg.gain, t, v * 0.12, 0.002, 0.5);
    for (const x of [c, md, h]) { x.start(t); x.stop(e); } reap(c, [c, md, mg, cg, h, hg, pn]);
  }
  function stab(t, pcs, root) {           // the mech suit-up sting: a filtered saw power-chord stab
    const g = G(0), lp = F('lowpass', 300, 3), pn = G(1); wire(lp, g, pn, part.fx);
    const ns = [root, root + 7, root + 12, root + 12 + ((pcs[1] - pcs[0] + 12) % 12)];
    const xs = ns.flatMap(m => [O('sawtooth', mtof(m)), O('sawtooth', mtof(m) * 1.006)]); xs.forEach(x => x.connect(lp));
    lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(5200, t + 0.12); lp.frequency.exponentialRampToValueAtTime(700, t + 0.9);
    const e = env(g.gain, t, 0.22, 0.004, 1.1); xs.forEach(x => { x.start(t); x.stop(e); }); reap(xs[0], [...xs, lp, g, pn]);
  }

  // ---- the clock
  const S = { bar: 0, step: 0, nextT: 0, running: false };
  let lastMood = null;
  const moodAt = (bar, beat) => Object.assign({ kick: 1, snare: 1, hat: 1, bass: 1, pad: 1, arp: 1, lead: 1, bell: 1, fx: 1, lp: 20000, drive: 0 }, o.mood ? o.mood(bar, beat) : null);
  function levels(B, t, md) {
    const A = B.A, lv = { ...BASE };
    lv.lead *= A.lead; lv.pad *= A.pad; lv.bell *= A.bell; lv.arp *= A.arp ? 1 : 0; lv.bass *= A.bass === 'none' ? 0 : 1;
    for (const k in lv) tg(part[k].gain, on(k) * lv[k] * (md[k] ?? 1) * (o.gain ?? 1), t, 0.06);
    tg(busLp.frequency, Math.min(A.lp, md.lp), t, A.lp < 20000 ? 0.5 : 0.2);
    tg(bCl.gain, 1 - 0.6 * md.drive, t, 0.2); tg(bDrG.gain, 0.5 * md.drive, t, 0.2);
    lastMood = md;
  }
  function barStart(i, t) {
    const B = LOOP[i], A = B.A;
    levels(B, t, moodAt(i, 0));
    tg(padLp.frequency, A.padLp, t, B.sec === 'Intro' && B.bi < 4 ? BAR * 0.4 : 0.3);
    tg(padV.gain, 1, t, 0.05);
    tg(l3g.gain, A.dbl * 0.42, t, 0.1); tg(l4g.gain, A.sub * 0.3, t, 0.1);
    const v = voicing(B.pcs, 55, 76, 4); while (v.length < 4) v.push(v[v.length - 1] + 12);
    v.forEach((m, k) => { const f = mtof(m); tg(pad[2 * k].frequency, f, t, 0.035); tg(pad[2 * k + 1].frequency, f, t, 0.035); });
    if (A.crash) crash(t + jit(4), hum(0.2));
    if (A.riser) riser(t, BAR * A.riser, 0.07);
    if (i === BARS - 1 && !loop) { tg(padV.gain, 0, t + BAR * 0.5, 0.7); }
  }
  function step(i, s, t) {
    const B = LOOP[i], A = B.A, pcs = B.pcs, s16 = S16, mute = s >= A.gap;
    if (s % 4 === 0 && s) levels(B, t, moodAt(i, s / 4));
    // bass
    const root = 28 + ((pcs[0] - 4 + 12) % 12), tb = t + jit(4);
    const bn = (m, len, vel, cut) => {
      b1.frequency.setValueAtTime(mtof(m), tb); b2.frequency.setValueAtTime(mtof(m), tb);
      tg(bV.gain, vel, tb, 0.0025); tg(bV.gain, 0, tb + len * 0.7, 0.012);
      tg(bF.frequency, cut, tb, 0.002); tg(bF.frequency, cut * 0.3, tb + 0.008, s16 * 0.7);
    };
    if (!mute) {
      if (A.bass === 'hold') { if (s === 0) { b1.frequency.setTargetAtTime(mtof(root), t, 0.02); b2.frequency.setTargetAtTime(mtof(root), t, 0.02); tg(bV.gain, 0.6, t, 0.05); tg(bF.frequency, 380, t, 0.05); } if (s === 12) tg(bV.gain, 0.3, t, 0.2); if (A.fade && s === 4) tg(bV.gain, 0, t, 0.5); }
      else if (A.bass === '8') { if (s % 2 === 0) bn(root + (s % 4 === 2 ? 12 : 0), s16 * 2, hum(s % 4 ? 0.75 : 0.95), s % 4 ? 1500 : 1900); }
      else if (A.bass === '16') bn(root + (s % 4 === 2 ? 12 : 0), s16, hum(s % 4 === 0 ? 0.95 : 0.72), s % 4 === 0 ? 2000 : 1400);
      else if (A.bass === 'half') { if (s % 2 === 0) bn(root + (s === 14 ? 12 : 0), s16 * 2.6, hum(s % 8 ? 0.7 : 0.9), 900); }
    } else if (s === A.gap) tg(bV.gain, 0, t, 0.01);
    // arp plucks: chord tones (an up-down or a leaping 0-2-1-3 pattern), 16ths or 8ths
    if (A.arp && !mute && (A.arp === 16 || s % 2 === 0)) {
      const tones = voicing(pcs, 64, 88, 5), pat = A.pat ? [0, 2, 1, 3, 2, 4, 1, 3] : [0, 1, 2, 3, 4, 3, 2, 1];
      const m = tones[pat[(A.arp === 16 ? s : s / 2) % 8] % tones.length], ta = t + jit(8);
      a1.frequency.setValueAtTime(mtof(m), ta); a2.frequency.setValueAtTime(mtof(m), ta);
      tg(aV.gain, hum(s % 4 === 0 ? 0.9 : 0.62), ta, 0.002); tg(aV.gain, 0, ta + s16 * 0.45, 0.02);
      tg(aF.frequency, A.arpLp * 1.6, ta, 0.002); tg(aF.frequency, A.arpLp * 0.25, ta + 0.006, 0.05);
    }
    // lead (hook) with portamento on contiguous notes
    for (const n of B.lead) if (n.s === s) {
      const tl = t + (n.leg ? jit(6) : jit(15)), dur = n.d * s16, f = mtof(n.m), vel = hum(0.8);
      for (const [x, k] of [[l1, 1], [l2, 1], [l3, 2], [l4, 0.5]]) { if (n.leg) x.frequency.setTargetAtTime(f * k, tl, 0.03); else x.frequency.setValueAtTime(f * k, tl); }
      if (n.leg) tg(lV.gain, vel, tl, 0.03);
      else { tg(lV.gain, vel, tl, 0.005); tg(lF.frequency, A.leadLp * 2.2, tl, 0.003); tg(lF.frequency, A.leadLp, tl + 0.03, 0.2); }
      tg(vibG.gain, 0, tl, 0.02); if (dur > 0.45) tg(vibG.gain, 13, tl + 0.3, 0.2);
      if (!n.nextLeg) tg(lV.gain, 0, t + dur - 0.03, 0.03);
      log.push({ k: 'lead', t: tl, m: n.m, d: dur });
      if (o.onLead) o.onLead(n.m, tl, dur);
    }
    for (const n of B.bell) if (n.s === s) { const tt = t + jit(15); bell(tt, n.m, hum(0.7)); log.push({ k: 'bell', t: tt, m: n.m }); }
    // drums
    if (mute) return;
    if (A.kick.includes(s)) kick(t + jit(4), hum(0.92));
    if (A.snare.includes(s)) {
      const ts = t + jit(6);
      if (A.roll) snare(ts, hum(0.28 + 0.55 * ((B.bi - 4) * 16 + s) / 64), false);
      else { snare(ts, hum(0.9), true); if (A.clap) clap(ts + 0.004, hum(0.35)); }
    }
    if (A.fill && s >= 12 && !A.snare.includes(s)) snare(t + jit(6), hum(0.3 + 0.12 * (s - 12)), false);
    const th = t + jit(10);
    if (A.hat === 'off' && s % 4 === 2) hat(th, hum(0.5), true);
    else if (A.hat === '8' && s % 2 === 0) hat(th, hum(s % 4 ? 0.5 : 0.3), s % 4 === 2);
    else if (A.hat === '16') hat(th, hum(s % 4 === 2 ? 0.5 : s % 2 ? 0.22 : 0.32), s % 4 === 2);
    else if (A.hat === '16s') hat(th, hum(s % 4 === 2 ? 0.3 : 0.12), false);
  }
  const api = {
    log, BARS, BAR, BPM, LOOP_SEC, duck, level,
    get nextT() { return S.nextT; },
    start(t, bar = 0) { S.bar = bar % BARS; S.step = 0; S.nextT = t; S.running = true; tg(level.gain, 1, t - 0.01, 0.05); },
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
    finish(t) { for (const g of [padV.gain, aV.gain, lV.gain, bV.gain]) tg(g, 0, t, 0.5); },
    dispose() { for (const x of oscs) try { x.stop(); } catch { /* stopped */ } try { level.disconnect(); } catch { /* gone */ } },
    info() { const b = (S.bar - (S.step === 0 ? 1 : 0) + BARS) % BARS, B = LOOP[b]; return { bar: b, step: S.step, sec: B.sec, chord: B.chord, pcs: B.pcs, bpm: BPM, mood: lastMood }; },
    nextBeat(t) { const b0 = S.nextT + ((4 - S.step % 4) % 4) * S16, k = Math.ceil((t - b0) / (S16 * 4) - 1e-6); return b0 + k * S16 * 4; },
    sting(kind, t) {                        // event stings on the beat, in the current chord
      const { pcs } = api.info(), top = voicing(pcs, 76, 93, 5);
      if (kind === 'gulp') top.forEach((m, k) => bell(t + k * S16, m, 0.55, part.fx));                 // power-up arpeggio
      else if (kind === 'wave') top.slice(0, 3).reverse().forEach((m, k) => bell(t + k * S16, m + 12, 0.4, part.fx));
      else if (kind === 'mech') { stab(t, pcs, 45 + ((pcs[0] - 9 + 12) % 12)); crash(t, 0.22); top.slice(0, 4).forEach((m, k) => bell(t + 0.02 + k * S16, m, 0.5, part.fx)); }
      log.push({ k: 'sting', t, kind });
    },
  };
  const t0 = ac.currentTime; for (const x of oscs) x.start(t0);
  return api;
}
