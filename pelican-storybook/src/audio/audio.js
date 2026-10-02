// OWNER: audio. Pelican Bay (storybook edition) soundscape: 100 % procedural WebAudio, no samples, no files.
//
// createAudio(bus, opts?) -> { enable():Promise<boolean>, disable(), update(frame), setVolume(v), setMusic(on), debug() }
//   opts.context  inject an (Offline)AudioContext (tests / judge render). Default: a real AudioContext,
//                 created lazily inside enable() (0 AudioContexts before the user opts in).
//   opts.clock    () => audio time; the offline harness passes the sim clock so update() can schedule ahead.
//   opts.seed     deterministic variation (default: time-seeded).
//   opts.solo     ['amb'|'mech'|'fx'|'far'|'music'|'voice'] keep only these buses (analysis renders).
//   opts.volume   0…1 (default 0.8).
//   opts.music    true: the bedtime tune starts with the sound (default: follows toggles.music / ui:toggle music).
//
// Mix:  sources → buses (amb: wind/road/sea/rain · mech: chain/freewheel · fx: bell/thump/gulp · far: gulls/horns/
//       crickets/owl/fireworks · voice: the pelican · music: the bedtime tune) → master (fade) → glue compressor →
//       brick-wall limiter → trim → out.  One shared procedural plate reverb (sends per bus).
// Sync: rig events are cued in SIM time from TIMING (rig/solve.js X-sheets) and scheduled from update(frame) with a
//       120 ms lookahead, compensated for output latency, so the bell rings on the thumb pop and the thump lands on
//       the tyre-contact frame. The freewheel tick rate is exactly wheel rev/s × AUDIO.pawls.
// Music (docs/BGM.md): "晚安，鹈鹕 · Goodnight, Pelican", a composed 88-bar bedtime waltz in F (3/4, 88 bpm, 3:00 a
//       pass, Intro·A·A'·B·Bridge·A''·Outro) on an 8th-note lookahead clock (200 ms ahead). Celesta, glockenspiel,
//       recorder, felt piano, Karplus-Strong ukulele + upright bass, brushes and shaker. The tempo is fixed (80 at
//       night, switched only on a section's first bar); the page thins or fills the layers by time of day and
//       weather, the music ducks under events, and stings land on the next beat. While coasting, the pelican hums.
//   opts.bgm 'once' plays one pass and resolves (tools/render-bgm.mjs); opts.bgmFrom starts at a bar (seam tests).
import { TIMING } from '../rig/solve.js';
import { BIKE, DIST_PER_REV, CADENCE } from '../contract.js';
import { hash } from '../world/route.js';

export const AUDIO = {
  pawls: 18,                 // freehub engagement points (coast tick rate = wheel rev/s × pawls)
  teeth: BIKE.ringT,         // chain whirr AM rate = crank rev/s × chainring teeth
  lookahead: 0.12, musicAhead: 0.2, interval: 25,
  fadeIn: 0.6, fadeOut: 0.45, pauseFade: 0.4, hideFade: 0.08, hideSuspendMs: 100,
  bellStrikes: [TIMING.bell.strike, TIMING.bell.strike + 0.105],
};

const TAU = Math.PI * 2;
const V_MAX = (CADENCE.max / 60) * DIST_PER_REV;
const WHEEL_C = TAU * BIKE.R;
const U60 = DIST_PER_REV;    // road units per second at 60 rpm (director "u" unit)
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const HOP = { takeoff: TIMING.hop.takeoff, land: TIMING.hop.land, hold0: 0.2, hold1: TIMING.hop.land + 0.35 };
const GAP = { hop: TIMING.hop.gap, bell: 0.12, wave: TIMING.wave.gap, gulp: TIMING.gulp.gap };
const EV_DUR = { bell: 0.7, hop: 1.4, wave: 2.8, gulp: 3.4 };
const CAPTION = {
  bell: ['[a tiny bell: ting-a-ling]', '[小铃铛叮铃铃]'], land: ['[thump]', '[咚]'], gulp: ['[gulp]', '[咕嘟]'],
  gull: ['[gulls call]', '[海鸥鸣叫]'], horn: ['[distant fog horn]', '[远处雾笛]'], boat: ['[ship\'s horn]', '[轮船汽笛]'],
  hup: ['[pelican: “hup!”]', '[鹈鹕：“嘿哟！”]'], honk: ['[pelican honks hello]', '[鹈鹕嘎嘎打招呼]'],
  burp: ['[a small, satisfied burp]', '[心满意足的小饱嗝]'], hum: ['[pelican hums the tune]', '[鹈鹕哼着小曲]'],
  meow: ['[cat: meow!]', '[猫：喵！]'], friend: ['[a friendly honk overhead]', '[头顶传来友好的嘎嘎声]'],
  fireworks: ['[soft distant fireworks]', '[远处轻轻的烟花声]'], owl: ['[an owl hoots]', '[猫头鹰咕咕]'],
  ding: ['[a passing bell]', '[对面车铃叮叮]'],
  boing: ['[boing!]', '[嘣——！]'], gulpPop: ['[gulp… pop!]', '[咕嘟……啵！]'], page: ['[a page turns]', '[哗啦，翻页]'], pencil: ['[a pencil scribbles]', '[铅笔沙沙地写]'],
  egg: ['[a music box plays]', '[音乐盒叮叮咚]'], chimes: ['[wind chimes]', '[风铃叮叮]'], kids: ['[children laughing far away]', '[远处孩子们的笑声]'],
  train: ['[a little steam train whistles]', '[小火车呜——呜]'], yawn: ['[pelican yawns]', '[鹈鹕打了个大哈欠]'], giggle: ['[pelican giggles]', '[鹈鹕咯咯笑]'], music: ['[♪ a bedtime tune]', '[♪ 睡前小曲]'],
};

function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ======================================================================================== the score (docs/BGM.md)
// "晚安，鹈鹕 · Goodnight, Pelican": a bedtime waltz in F major, 3/4, 88 bpm, 88 bars = 3:00 a pass.
// Intro(8) · A(16) · A'(16) · B(16, in B♭) · Bridge(8, D minor → C7) · A''(16) · Outro(8). One chord per bar.
// Melody / counter tokens: <note>:<eighths> (6 eighths to the bar), bars separated by '|', r = rest.
// Arrangement keys: lead cel|glk|rec · dbl glock octave · ctr recorder counter-line · uke waltz|pick|strum ·
// pno pad|waltz · bass one|onethree|pedal · dr 0 / 0.5 swish / 1 +taps / 2 +shaker · arp celesta broken chords ·
// spark glock fills at phrase ends · enter: bar where uke + bass come in · roll: bar where the ending begins.
const PC = { C: 0, Db: 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };
const QUAL = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], '7sus': [0, 5, 7, 10] };
const HOOK = 'C5:4 A4:2|F5:2 E5:2 C5:2';                 // the hook: "good-night, pe-li-can"
const CTR = 'r:2 A4:4|G4:2 A4:4|r:2 F4:4|A4:6|r:2 F4:4|Bb4:6|G4:4 F4:2|Bb4:6|';
export const SCORE = [
  { name: 'Intro', key: 'F', chords: 'F F Bb C7 F Dm Bb C7', lvl: 0.8,
    mel: 'C6:4 A5:2|F6:2 E6:2 C6:2|D6:4 Bb5:2|G5:6|r:6|r:6|r:2 D6:2 F6:2|E6:4 r:2',
    arr: { lead: 'glk', uke: 'waltz', pno: 'pad', bass: 'one', dr: 0, enter: 4 } },
  { name: 'A', key: 'F', chords: 'F F Dm Dm Bb Gm C C7 F F Dm Am Bb C7 F F', lvl: 0.9,
    mel: HOOK + '|D5:4 A4:2|F4:6|D5:4 Bb4:2|G5:2 F5:2 D5:2|E5:4 D5:2|C5:6|' + HOOK + '|D5:4 F5:2|E5:4 C5:2|F5:4 D5:2|C5:4 Bb4:2|A4:6|F4:4 r:2',
    arr: { lead: 'cel', uke: 'waltz', bass: 'one', dr: 1, spark: 1 } },
  { name: "A'", key: 'F', chords: 'F F Dm Dm Bb Gm C C7 F F Dm Am Bb C7 F F7', lvl: 1,
    mel: 'C5:3 Bb4:1 A4:2|F5:2 G5:1 F5:1 E5:1 C5:1|D5:4 A4:2|F5:4 E5:2|D5:3 C5:1 Bb4:2|G5:2 A5:2 Bb5:2|A5:2 G5:2 E5:2|G5:4 r:2|' + HOOK + '|D5:4 F5:2|A5:4 E5:2|Bb5:2 A5:2 F5:2|G5:2 E5:2 C5:2|F5:6|Eb5:2 D5:2 C5:2',
    ctr: CTR + 'r:2 A4:4|G4:2 A4:4|r:2 A4:4|C5:6|r:2 D5:4|Bb4:6|A4:4 C5:2|A4:2 Bb4:2 C5:2',
    arr: { lead: 'cel', uke: 'pick', pno: 'waltz', bass: 'onethree', dr: 1 } },
  { name: 'B', key: 'Bb', chords: 'Bb Gm Eb F Bb Gm Cm F7 Bb Dm Eb Cm Bb/F F7 Bb Bb', lvl: 0.95,
    mel: 'F4:2 Bb4:2 D5:2|F5:4 D5:2|Eb5:4 G4:2|C5:6|F4:2 Bb4:2 D5:2|G5:4 F5:2|Eb5:2 D5:2 C5:2|A4:4 C5:2|D5:2 F5:2 Bb5:2|A5:4 F5:2|G5:4 Eb5:2|C5:4 Eb5:2|D5:4 F5:2|Eb5:2 C5:2 A4:2|Bb4:6|r:6',
    arr: { lead: 'rec', arp: 1, pno: 'waltz', bass: 'onethree', dr: 1 } },
  { name: 'Bridge', key: 'Dm', chords: 'Dm Dm Bb Bb Gm7 Gm7 C7sus C7', lvl: 0.8,
    mel: 'A4:4 F4:2|D5:2 C5:2 A4:2|Bb4:4 F4:2|D5:2 C5:2 Bb4:2|Bb4:4 G4:2|D5:2 C5:2 Bb4:2|C5:6|r:2 E4:2 G4:2',
    arr: { lead: 'cel', pno: 'pad', bass: 'pedal', dr: 0, spark: 1, swell: 6 } },
  { name: "A''", key: 'F', chords: 'F F Dm Dm Bb Gm C C7 F F7 Bb Bbm F/C C7 F F', lvl: 1.12,
    mel: HOOK + '|D5:4 A4:2|F5:4 E5:2|D5:4 Bb4:2|G5:2 F5:2 D5:2|E5:4 D5:2|C5:6|' + HOOK.split('|')[0] + '|F5:2 G5:2 A5:2|Bb5:4 F5:2|F5:4 Db5:2|A4:2 C5:2 F5:2|G5:4 E5:2|F5:6|r:6',
    ctr: CTR + 'r:2 A4:4|r:2 Eb5:4|D5:6|Bb4:6|C5:6|Bb4:4 G4:2|A4:6|r:6',
    arr: { lead: 'cel', dbl: 1, uke: 'strum', pno: 'waltz', bass: 'onethree', dr: 2 } },
  { name: 'Outro', key: 'F', chords: 'F Bb/F F Bb/F Gm7 C7 F F', lvl: 0.85,
    mel: 'C6:4 A5:2|D6:4 Bb5:2|C6:4 A5:2|D6:4 Bb5:2|Bb5:2 A5:2 G5:2|E5:2 G5:2 Bb5:2|A5:6|F5:6',
    arr: { lead: 'glk', uke: 'pick', pno: 'pad', bass: 'one', dr: 0, roll: 6 } },
];
const noteNum = s => { const m = /^([A-G](?:b|#)?)(-?\d)$/.exec(s); return m ? PC[m[1]] + 12 * (+m[2] + 1) : null; };
const parseBar = str => { let s = 0; const out = []; for (const tok of str.trim().split(/\s+/)) { const [n, d] = tok.split(':'); if (n !== 'r') out.push({ s, d: +d, m: noteNum(n) }); s += +d; } out.len = s; return out; };
const chordOf = name => {
  const m = /^([A-G][b#]?)(m7|7sus|m|7|)(?:\/([A-G][b#]?))?$/.exec(name), r = PC[m[1]];
  return { name, pcs: QUAL[m[2]].map(x => (x + r) % 12), bass: m[3] ? PC[m[3]] : r };
};
// the score flattened to bars: { sec, si, bi, ch, notes, ctr, A, lvl, last, next (first chord of the next section) }
export const BARS = [];
SCORE.forEach((S, si) => {
  const ch = S.chords.split(' ').map(chordOf), mel = S.mel.split('|').map(parseBar), ctr = S.ctr ? S.ctr.split('|').map(parseBar) : null;
  ch.forEach((c, bi) => BARS.push({ sec: S.name, key: S.key, si, bi, ch: c, notes: mel[bi] || [], ctr: ctr ? ctr[bi] : null, A: S.arr, lvl: S.lvl, last: bi === ch.length - 1, mlen: mel.length, clen: ctr ? ctr.length : 0 }));
});
BARS.forEach((b, i) => { b.next = BARS[(i + 1) % BARS.length].ch; });
export const BGM = { title: '晚安，鹈鹕 · Goodnight, Pelican', key: 'F major', meter: '3/4', bpm: 88, night: 80, bars: BARS.length, beats: 3 };

export function createAudio(bus, opts = {}) {
  const offline = !!(opts.context && typeof opts.context.startRendering === 'function');
  const R = mulberry(opts.seed ?? ((Date.now() ^ 0x9e3779b9) >>> 0));
  const rr = (a, b) => a + (b - a) * R();
  const solo = opts.solo ? new Set(opts.solo) : null;
  const hasDoc = typeof document !== 'undefined';
  let ac = null, N = null, timer = 0, wantOn = false, paused = false, hidden = false, vol = clamp(opts.volume ?? 0.8, 0, 1);
  let masterTarget = -1, lastLive = 0, lastCtl = -1, simT = 0, lastFrame = null;
  let tickOn = false, tickRate = 0, nextTick = 0, tickN = 0;
  let nextKids = 0, nextTrain = 0, nextChime = 0, nextCreak = 0, nextTink = 0, lastStretch = null, lastPage = null, yawned = false;
  let nextSwell = 0, nextGull = 0, nextHorn = 0, nextBoat = 0, nextCricket = 0, nextOwl = 0, nextGrunt = 0, nextDrop = 0, nightOn = false;
  let gust = 1, gustV = 0, gullsOn = true, night = 0, speedN = 0.5, cadence = 60, coasting = false, coastSince = 0;
  let wx = {}, musicWant = opts.music === true ? true : null, musicOn = false, duckUntil = 0, voiceUntil = 0, reduced = false;
  const seen = new Set(), lastAcc = {}, cues = [], hops = [], log = [], stings = [], encSeen = new Map(), fwSeen = new Set();
  const now = () => (opts.clock ? opts.clock() : ac.currentTime);
  const logCue = (kind, at, extra) => { log.push({ kind, at: +at.toFixed(4), ...extra }); if (log.length > 400) log.shift(); };
  const capAt = {}, CAP_GAP = { chimes: 25, kids: 25, giggle: 8, page: 2, pencil: 2, gull: 6 };   // ambient captions stay rare
  const caption = k => { if (!CAPTION[k]) return; const n = Date.now() / 1000; if (CAP_GAP[k] && n - (capAt[k] || -1e9) < CAP_GAP[k]) return; capAt[k] = n; bus.emit('audio:caption', { kind: k, en: CAPTION[k][0], zh: CAPTION[k][1] }); };

  // ------------------------------------------------------------------ node helpers
  const G = (v = 1) => { const g = ac.createGain(); g.gain.value = v; return g; };
  const F = (type, f, q = 0.707) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const Pan = p => { if (ac.createStereoPanner) { const s = ac.createStereoPanner(); s.pan.value = clamp(p, -1, 1); return s; } return G(1); };
  const O = (type, f) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; return o; };
  const wire = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
  const bufSrc = (buf, loop = false, rate = 1) => { const s = ac.createBufferSource(); s.buffer = buf; s.loop = loop; s.playbackRate.value = rate; return s; };
  // tidy one-shot graphs: disconnect everything once the driving source ends
  const reap = (src, nodes) => { src.onended = () => { for (const n of nodes) try { n.disconnect(); } catch { /* already gone */ } }; };
  // linear ramps from the value the param really has at t (tracked analytically: param.value is useless when
  // scheduling ahead, e.g. into an OfflineAudioContext, and cancelAndHold is not implemented everywhere)
  const RAMPS = new WeakMap();
  const ramp = (p, v, t, d) => {
    const r = RAMPS.get(p), v0 = !r ? p.value : t <= r.t0 ? r.from : t >= r.t1 ? r.to : r.from + (r.to - r.from) * (t - r.t0) / (r.t1 - r.t0);
    p.cancelScheduledValues(t); p.setValueAtTime(v0, t); p.linearRampToValueAtTime(v, t + d);
    RAMPS.set(p, { from: v0, to: v, t0: t, t1: t + d });
  };
  const glide = (p, v, t, tc) => p.setTargetAtTime(v, t, tc);
  // attack (linear) → exponential decay to −80 dB over d → exact 0 (no clicks)
  const envAD = (p, at, peak, a, d) => { p.setValueAtTime(0, at); p.linearRampToValueAtTime(peak, at + a); p.exponentialRampToValueAtTime(peak * 1e-4 + 1e-7, at + a + d); p.linearRampToValueAtTime(0, at + a + d + 0.01); return at + a + d + 0.02; };

  // ------------------------------------------------------------------ procedural buffers
  function noise(sec, kind, ch = 2) {
    const sr = ac.sampleRate, n = Math.floor(sec * sr), X = Math.floor(0.08 * sr), buf = ac.createBuffer(ch, n, sr);
    for (let c = 0; c < ch; c++) {
      const g = new Float32Array(n + X); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, br = 0;
      for (let i = 0; i < n + X; i++) {
        const w = R() * 2 - 1;
        if (kind === 'white') g[i] = w * 0.5;
        else if (kind === 'pink') { b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; g[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; }
        else { br = (br + 0.02 * w) / 1.02; g[i] = br * 3.2; }
      }
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = g[i];
      for (let i = 0; i < X; i++) { const k = i / X; d[i] = g[i] * Math.sqrt(k) + g[n + i] * Math.sqrt(1 - k); }   // seamless loop
    }
    return buf;
  }
  function plate(sec) {             // stereo plate-ish IR: pre-delay, darkening exponential tail
    const sr = ac.sampleRate, n = Math.floor(sec * sr), buf = ac.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c); let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, k = 0.15 + 0.8 * Math.min(1, t / sec);
        lp += (R() * 2 - 1 - lp) * (1 - k);
        d[i] = t < 0.014 + c * 0.003 ? 0 : lp * Math.exp(-t / 0.62);
      }
      let e = 0; for (let i = 0; i < n; i++) e += d[i] * d[i];
      const k = 1 / Math.sqrt(e || 1); for (let i = 0; i < n; i++) d[i] *= k;             // unit-energy IR (0 dB wet gain)
    }
    return buf;
  }
  function clickBuf(f1, f2, f3) {  // freewheel tick: a wooden bead knocking (three damped modes, a little grain)
    const sr = ac.sampleRate, n = Math.floor(0.014 * sr), buf = ac.createBuffer(1, n, sr), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      d[i] = (0.65 * Math.sin(TAU * f1 * t) * Math.exp(-t / 0.0024) + 0.28 * Math.sin(TAU * f2 * t) * Math.exp(-t / 0.0013) +
        0.1 * Math.sin(TAU * f3 * t) * Math.exp(-t / 0.0008) + (R() * 2 - 1) * 0.08 * Math.exp(-t / 0.0003)) * Math.min(1, i / 14) * (1 - i / n);
    }
    return buf;
  }
  // Karplus-Strong plucked string, tuned exactly by playbackRate (the loop period is an integer number of samples).
  // kind 'uke': nylon, 2-tap loop filter; 'bass': upright, 3-tap (darker) loop filter, soft thumb excitation.
  const KS = new Map();
  function ks(midi, kind) {
    const key = kind + midi; let e = KS.get(key); if (e) return e;
    const sr = ac.sampleRate, f = mtof(midi), bass = kind === 'bass';
    const tap3 = bass, extra = tap3 ? 1 : 0.5;
    const P = Math.max(3, Math.floor(sr / f - extra)), fGen = sr / (P + extra);
    const sec = bass ? 2.0 : kind === 'mel' ? 1.6 : 1.3, n = Math.floor(sec * sr);
    const t60 = bass ? 2.6 : clamp((kind === 'mel' ? 1.7 : 1.35) - (midi - 60) * 0.02, 0.55, 2);
    const rho = Math.pow(0.001, 1 / (fGen * t60));
    const ring = new Float32Array(P), exc = bass ? 0.07 : kind === 'mel' ? 0.5 : 0.38;
    let lp = 0; for (let i = 0; i < P; i++) { lp += ((R() * 2 - 1) - lp) * exc; ring[i] = lp; }
    const pp = Math.max(1, Math.round(P * (bass ? 0.22 : 0.16))), cp = Float32Array.from(ring);   // pluck position comb
    for (let i = 0; i < P; i++) ring[i] = cp[i] - 0.85 * cp[(i + pp) % P];
    let mean = 0; for (let i = 0; i < P; i++) mean += ring[i]; mean /= P; for (let i = 0; i < P; i++) ring[i] -= mean;
    const buf = ac.createBuffer(1, n, sr), d = buf.getChannelData(0);
    let idx = 0, peak = 1e-6, hp = 0, prev = 0;
    for (let i = 0; i < n; i++) {
      const a = ring[idx], i1 = idx + 1 === P ? 0 : idx + 1;
      if (tap3) { const i2 = i1 + 1 === P ? 0 : i1 + 1; ring[idx] = rho * (0.25 * a + 0.5 * ring[i1] + 0.25 * ring[i2]); }
      else ring[idx] = rho * 0.5 * (a + ring[i1]);
      idx = i1;
      hp = 0.995 * (hp + a - prev); prev = a;                                        // DC blocker
      d[i] = hp; if (Math.abs(hp) > peak) peak = Math.abs(hp);
    }
    const A = Math.floor(sr * (bass ? 0.004 : 0.0025)), Z = Math.floor(sr * 0.05);
    for (let i = 0; i < n; i++) d[i] = d[i] / peak * 0.9 * Math.min(1, i / A) * Math.min(1, (n - i) / Z);
    e = { buf, rate: f / fGen }; KS.set(key, e);
    return e;
  }
  // glockenspiel / music-box bar: additive inharmonic partials + a felt mallet tick
  const GLK = new Map();
  function glk(midi) {
    let e = GLK.get(midi); if (e) return e;
    const sr = ac.sampleRate, f = mtof(midi), sec = 1.5, n = Math.floor(sec * sr), buf = ac.createBuffer(1, n, sr), d = buf.getChannelData(0);
    const P = [[1, 1, 0.95], [2.756, 0.24, 0.26], [5.404, 0.07, 0.09], [0.5, 0.03, 0.5]], k = clamp(1 - (midi - 74) * 0.02, 0.55, 1.2);
    for (let i = 0; i < n; i++) {
      const t = i / sr; let s = 0;
      for (const [r, a, dc] of P) if (f * r < sr * 0.45) s += a * Math.sin(TAU * f * r * t) * Math.exp(-t / (dc * k));
      d[i] = (s + (R() * 2 - 1) * 0.12 * Math.exp(-t / 0.0015)) * Math.min(1, i / (sr * 0.0015)) * Math.min(1, (n - i) / (sr * 0.03)) * 0.7;
    }
    e = { buf }; GLK.set(midi, e);
    return e;
  }

  // ------------------------------------------------------------------ graph
  function build() {
    const out = G(1.0);                                                      // trim after the limiter: peaks ≤ −1.5 dBFS
    const lim = ac.createDynamicsCompressor();
    lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.09;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 10; comp.ratio.value = 2.5; comp.attack.value = 0.008; comp.release.value = 0.3;
    const master = G(0), hpf = F('highpass', 38, 0.6);                    // keep sub-rumble out of laptop speakers
    const warm = F('highshelf', 5500, 0.7); warm.gain.value = -6;            // storybook softness: a gentle top roll-off
    const soft = F('lowpass', 10500, 0.5);                                   // … and nothing sharp above it
    wire(master, hpf, warm, soft, comp, lim, out, ac.destination);
    const B = n => { const g = G(solo && !solo.has(n) ? 0 : 1); g.connect(master); return g; };
    const amb = B('amb'), mech = B('mech'), fx = B('fx'), far = B('far'), voice = B('voice'), music = B('music');
    const verb = ac.createConvolver(); verb.normalize = false; verb.buffer = plate(2.6);
    const verbRet = G(0.75); wire(verb, verbRet, master);
    const vin = {}; for (const b of ['amb', 'mech', 'fx', 'far', 'voice', 'music']) { vin[b] = G(solo && !solo.has(b) ? 0 : 1); vin[b].connect(verb); }
    const duck = G(1); duck.connect(amb);                                   // bell ducks wind + road

    const pinkB = noise(7.13, 'pink'), brownB = noise(8.31, 'brown'), whiteB = noise(6.07, 'white');
    // wind: broad, calm band that brightens with speed + a rare gust-driven soft whistle
    const windSrc = bufSrc(pinkB, true), windBp = F('bandpass', 500, 0.5), windLp = F('lowpass', 2000, 0.5), windG = G(0);
    wire(windSrc, windBp, windLp, windG, duck);
    const whisBp = F('bandpass', 1100, 7), whisG = G(0);
    wire(windSrc, whisBp, whisG, duck);
    // road: tyre rumble + grit (gated off while airborne)
    const roadSrc = bufSrc(pinkB, true, 1.13), roadLp = F('bandpass', 300, 0.8), roadG = G(0), tyreGate = G(1);
    wire(roadSrc, roadLp, roadG, tyreGate, duck);
    const gritSrc = bufSrc(whiteB, true, 0.91), gritHp = F('highpass', 3000, 0.7), gritLp = F('lowpass', 6000, 0.7), gritG = G(0);
    wire(gritSrc, gritHp, gritLp, gritG, tyreGate);
    // sea bed (swells are one-shots on top)
    const seaSrc = bufSrc(brownB, true, 0.87), seaLp = F('lowpass', 170, 0.7), seaG = G(0.1);
    wire(seaSrc, seaLp, seaG, amb);
    // rain bed: soft hiss on leaves and the road (level from frame.weather.rain; drops are one-shots)
    const rainSrc = bufSrc(pinkB, true, 1.31), rainHp = F('highpass', 900, 0.5), rainLp = F('lowpass', 3800, 0.5), rainG = G(0);
    wire(rainSrc, rainHp, rainLp, rainG, amb);
    // river mouth: a babbling bed (gain per stretch)
    const rivSrc = bufSrc(pinkB, true, 1.21), rivBp = F('bandpass', 1300, 0.9), rivLp = F('lowpass', 3000, 0.6), riverG = G(0);
    const rivAM = O('sine', 0.7), rivAMg = G(0.012); wire(rivAM, rivAMg); rivAMg.connect(riverG.gain);
    wire(rivSrc, rivBp, rivLp, riverG, amb);
    // chain whirr: band noise amplitude-modulated at the tooth-engagement rate, plus a low roller hum
    const chSrc = bufSrc(whiteB, true, 1.07), chBp = F('bandpass', 2400, 1.3), chAM = G(0.55), chG = G(0), chPan = Pan(-0.12);
    const chOsc = O('sine', 48), chDepth = G(0.45);
    wire(chOsc, chDepth); chDepth.connect(chAM.gain);
    wire(chSrc, chBp, chAM, chG, chPan, mech);
    const humSrc = bufSrc(pinkB, true, 0.95), humBp = F('bandpass', 620, 3), humAM = G(0.6), humG = G(0);
    const humOsc = O('sine', 2), humDepth = G(0.4); wire(humOsc, humDepth); humDepth.connect(humAM.gain);
    wire(humSrc, humBp, humAM, humG, chPan);
    // freewheel ticks (a soft wooden-ish tick: lowpassed)
    const tickBus = G(1), tickLp = F('lowpass', 3400, 0.6), tickPan = Pan(-0.22); wire(tickBus, tickLp, tickPan, mech);
    const clicks = [clickBuf(1250, 2080, 3350), clickBuf(1340, 2190, 3150), clickBuf(1180, 1990, 3420)];   // wooden beads
    const pawlAmp = Array.from({ length: AUDIO.pawls }, (_, i) => 0.82 + 0.18 * Math.sin(i * 2.4) * Math.cos(i * 0.7) + 0.08 * R());

    // the pelican's voice bus + the coasting croon (a persistent formant voice that follows the melody)
    const vPan = Pan(0.08); wire(vPan, voice); const vSend = G(0.14); vPan.connect(vSend); vSend.connect(vin.voice);
    const crOsc = O('sawtooth', 175), crLp = F('lowpass', 1400, 0.5), crF1 = F('bandpass', 270, 3.2), crF2 = F('bandpass', 1050, 6), crF2g = G(0.22), crSum = G(2.2), crG = G(0);
    const crVib = O('sine', 5.1), crVibG = G(0); wire(crVib, crVibG); crVibG.connect(crOsc.frequency);
    wire(crOsc, crLp); crLp.connect(crF1); wire(crLp, crF2, crF2g, crSum); crF1.connect(crSum); wire(crSum, crG, vPan);

    // music: instrument buses → musIn → duck → level → music bus (+ plate send)
    // (the bass stays mono in the centre and skips the chorus; pads and plucks get a low cut and a gentle chorus)
    const musIn = G(1), musHp = F('highpass', 40, 0.6), musDuck = G(1), musLvl = G(0);
    wire(musIn, musHp, musDuck, musLvl, music); const musSend = G(0.22); musLvl.connect(musSend); musSend.connect(vin.music);
    const wide = G(1); wide.connect(musIn);                                   // stereo chorus: two slow modulated taps
    for (const [d0, lfoF, p] of [[0.011, 0.27, -0.7], [0.016, 0.33, 0.7]]) {
      const dl = ac.createDelay(0.05), lfo = O('sine', lfoF), dep = G(0.0014), pn = Pan(p), wg = G(0.32);
      dl.delayTime.value = d0; wire(lfo, dep); dep.connect(dl.delayTime); wire(wide, dl, pn, wg, musIn); lfo.start(now());
    }
    const inst = (pan, hpF, lpF, dest = wide) => { const p = Pan(pan), hp = F('highpass', hpF, 0.7), lp = F('lowpass', lpF, 0.6); wire(hp, lp, p, dest); return hp; };
    const IN = { uke: inst(-0.3, 140, 3800), cel: inst(0.12, 200, 7000), glk: inst(0.34, 300, 9000), pno: inst(-0.12, 110, 5000),
      rec: inst(0.22, 220, 6000, musIn), bass: inst(0, 30, 900, musIn), dr: inst(-0.1, 200, 12000, musIn) };
    const lv = {}; for (const k in IN) { lv[k] = G(0); lv[k].connect(IN[k]); }

    const t0 = now();
    for (const s of [windSrc, roadSrc, gritSrc, seaSrc, rainSrc, chSrc, humSrc, rivSrc]) s.start(t0, R() * 5);
    rivAM.start(t0); chOsc.start(t0); humOsc.start(t0); crOsc.start(t0); crVib.start(t0);
    const blip = ac.createBuffer(1, 1, ac.sampleRate);
    N = { blip, riverG, master, amb, mech, fx, far, voice, music, verb, vin, duck, windSrc, windBp, windG, whisBp, whisG, roadSrc, roadLp, roadG, tyreGate, gritG, seaG, seaLp,
      rainG, chOsc, chG, chBp, humOsc, humG, tickBus, clicks, pawlAmp, pinkB, brownB, whiteB,
      vPan, crOsc, crF1, crG, crVibG, musIn, musDuck, musLvl, musSend, lv };
    nextSwell = t0 + 0.4; nextGull = t0 + rr(4, 8); nextHorn = t0 + rr(6, 14); nextBoat = t0 + rr(30, 70); nextCricket = t0 + rr(1, 3);
    nextOwl = t0 + rr(15, 30); nextGrunt = t0 + rr(18, 35); nextDrop = t0 + 0.2;
    mus.nextT = t0 + 0.15; mus.bar = opts.bgmFrom || 0; mus.step = 0;
  }

  // ------------------------------------------------------------------ small helpers for one-shots
  function send(node, amt, b = 'fx') { if (amt > 0) { const s = G(amt); node.connect(s); s.connect(N.vin[b]); return s; } return null; }
  function screenPan(sel, pick) {
    if (!hasDoc || offline) return null;
    try {
      const svg = document.querySelector('#scene'); if (!svg) return null;
      let els = [...svg.querySelectorAll(sel)].filter(e => e.getAttribute('visibility') !== 'hidden');
      const W = innerWidth || 1600;
      const rects = els.map(e => e.getBoundingClientRect()).filter(r => (r.width || r.height) && r.right > 0 && r.left < W);
      if (!rects.length) return null;
      const r = pick ? rects[Math.floor(R() * rects.length)] : rects[0];
      return clamp(((r.left + r.width / 2) / W) * 2 - 1, -1, 1);
    } catch { return null; }
  }

  // ================================================================== effects (re-voiced softer for the storybook)
  function bellStrike(at, amp, pan, f0 = 2215, lvl = 0.085) {
    // bicycle-bell dome: inharmonic partials, each a near-degenerate pair (beating shimmer), upper modes die first
    const P = [[1, 1, 2.3], [1.506, 0.34, 1.4], [2.013, 0.36, 1.0], [2.654, 0.15, 0.6], [3.212, 0.09, 0.4], [0.503, 0.08, 1.2]];
    const pn = Pan(pan), bus = G(amp * lvl), sv = send(pn, 0.3); wire(bus, pn, N.fx);
    let last = null, end = 0;
    P.forEach(([r, a, d], i) => {
      for (const det of [-1, 1]) {
        const o = O('sine', f0 * r + det * (0.7 + 0.45 * i)), g = G(0);
        wire(o, g, bus);
        const e = envAD(g.gain, at, a * (det < 0 ? 0.55 : 0.45), 0.002, d);
        o.start(at); o.stop(e);
        if (e > end) { if (last) reap(last[0], last); end = e; last = [o, g]; } else reap(o, [o, g]);
      }
    });
    const n = bufSrc(N.whiteB), hp = F('bandpass', 4200, 1.2), g = G(0);          // striker tick (soft)
    wire(n, hp, g, bus); const e = envAD(g.gain, at, 0.25 * amp, 0.001, 0.014);
    n.start(at, R() * 3); n.stop(e); reap(n, [n, hp, g]);
    reap(last[0], [...last, bus, pn, sv].filter(Boolean));
  }
  function bell(at) {
    const pan = screenPan('#j-bars') ?? 0.05;
    tinyBell(at, 1, pan); tinyBell(at + (AUDIO.bellStrikes[1] - AUDIO.bellStrikes[0]), 0.7, pan, 2700);
    ramp(N.duck.gain, 0.5, at, 0.03); ramp(N.duck.gain, 1, at + 0.4, 0.6);
    logCue('bell', at, { pan }); caption('bell');
  }
  function thump(at) {
    const pn = Pan(0), g0 = G(0.75); wire(g0, pn, N.fx); send(pn, 0.1);
    const o = O('sine', 92), og = G(0); o.frequency.setValueAtTime(92, at); o.frequency.exponentialRampToValueAtTime(42, at + 0.16);
    wire(o, og, g0); const e1 = envAD(og.gain, at, 0.5, 0.004, 0.26); o.start(at); o.stop(e1);
    const nb = bufSrc(N.brownB), lp = F('lowpass', 440, 0.8), ng = G(0); wire(nb, lp, ng, g0);
    const e2 = envAD(ng.gain, at, 0.4, 0.003, 0.15); nb.start(at, R() * 6); nb.stop(e2);
    const tb = bufSrc(N.whiteB), bp = F('bandpass', 1200, 0.8), tg = G(0); wire(tb, bp, tg, g0);   // tyre "pff"
    const e3 = envAD(tg.gain, at, 0.08, 0.003, 0.09); tb.start(at, R() * 4); tb.stop(e3);
    // basket + fender rattle (wicker: softer, lower)
    [[0.028, 0.4], [0.05, 0.26], [0.083, 0.3], [0.125, 0.16]].forEach(([dt, a], i) => {
      const s = bufSrc(N.clicks[i % 3], false, 0.42 + 0.08 * i), f = F('bandpass', 1500 + 250 * i, 1.6), g = G(a * 0.3);
      wire(s, f, g, g0); s.start(at + dt); reap(s, [s, f, g]);
    });
    if ((wx.wet || 0) > 0.3) splash(at + 0.01, 0.12 * wx.wet, 0);        // landing in the wet: a little splash
    reap(o, [o, og]); reap(nb, [nb, lp, ng]); reap(tb, [tb, bp, tg, g0, pn]);
    logCue('land', at); caption('land');
  }
  function splash(at, amp, pan, dest = N.fx) {
    const s = bufSrc(N.whiteB), bp = F('bandpass', 1400, 0.7), g = G(0), pn = Pan(pan); wire(s, bp, g, pn, dest);
    bp.frequency.setValueAtTime(900, at); bp.frequency.exponentialRampToValueAtTime(2600, at + 0.12);
    const e = envAD(g.gain, at, amp, 0.006, 0.35); s.start(at, R() * 4); s.stop(e); reap(s, [s, bp, g, pn]);
    for (let i = 0; i < 4; i++) plip(at + 0.05 + i * rr(0.03, 0.08), rr(900, 1800), amp * 0.35, pan, dest);
  }
  function plip(at, f, amp, pan = 0, dest = N.amb) {        // one water drop: a tiny rising sine
    const o = O('sine', f), g = G(0), pn = Pan(pan); wire(o, g, pn, dest);
    o.frequency.setValueAtTime(f, at); o.frequency.exponentialRampToValueAtTime(f * 1.6, at + 0.03);
    const e = envAD(g.gain, at, amp, 0.001, 0.045); o.start(at); o.stop(e); reap(o, [o, g, pn]);
  }
  function whoosh(at, dur, f0, f1, amp, pan = 0, dest = N.fx) {
    const s = bufSrc(N.pinkB), bp = F('bandpass', f0, 1.4), g = G(0), pn = Pan(pan);
    bp.frequency.setValueAtTime(f0, at); bp.frequency.exponentialRampToValueAtTime(f1, at + dur * 0.6); bp.frequency.exponentialRampToValueAtTime(f0 * 0.8, at + dur);
    wire(s, bp, g, pn, dest);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(amp, at + dur * 0.45); g.gain.linearRampToValueAtTime(0, at + dur);
    s.start(at, R() * 6); s.stop(at + dur + 0.02); reap(s, [s, bp, g, pn]);
  }
  function scuff(at) {           // tyre scuff at take-off
    const s = bufSrc(N.whiteB), bp = F('bandpass', 1700, 1), g = G(0); wire(s, bp, g, N.fx);
    const e = envAD(g.gain, at, 0.06, 0.005, 0.07); s.start(at, R() * 4); s.stop(e); reap(s, [s, bp, g]);
  }
  function bubble(at, f0, f1, dur, amp) {   // rising-pitch bubble = the "gloop"
    const o = O('sine', f0), o2 = O('triangle', f0 * 2), g = G(0), g2 = G(0.14), lp = F('lowpass', 1300, 0.7), pn = Pan(0.12);
    o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f1, at + dur);
    o2.frequency.setValueAtTime(f0 * 2, at); o2.frequency.exponentialRampToValueAtTime(f1 * 2, at + dur);
    wire(o, g); wire(o2, g2, g); wire(g, lp, pn, N.fx); send(pn, 0.08);
    const e = envAD(g.gain, at, amp, 0.008, dur * 1.3);
    o.start(at); o2.start(at); o.stop(e); o2.stop(e); reap(o, [o, o2, g, g2, lp, pn]);
  }
  function slap(at) {            // wet fish flop
    const s = bufSrc(N.whiteB), bp = F('bandpass', 850, 1.3), g = G(0), pn = Pan(0.15); wire(s, bp, g, pn, N.fx);
    const e = envAD(g.gain, at, 0.2, 0.003, 0.06); s.start(at, R() * 4); s.stop(e); reap(s, [s, bp, g, pn]);
    bubble(at + 0.01, 240, 150, 0.04, 0.1);
  }
  function clack(at) {           // bill snapping shut on the fish (a soft wooden clop)
    const o = O('sine', 980), g = G(0), s = bufSrc(N.whiteB), bp = F('bandpass', 1900, 4), g2 = G(0), pn = Pan(0.15);
    wire(o, g, pn); wire(s, bp, g2, pn); pn.connect(N.fx);
    const e = envAD(g.gain, at, 0.12, 0.0015, 0.04); envAD(g2.gain, at, 0.2, 0.001, 0.02);
    o.start(at); o.stop(e); s.start(at, R() * 4); s.stop(e); reap(o, [o, g, s, bp, g2, pn]);
  }
  function gulpSeq(at) {
    const T = TIMING.gulp;
    slap(at + T.scoop[0] + 0.06);
    whoosh(at + T.toss[0], 0.3, 500, 1400, 0.04, 0.1);
    clack(at + T.toss[1] - 0.02);
    gulpPop(at + T.swallow[0] + 0.06);
    bubble(at + T.swallow[0] + 0.5, 340, 640, 0.07, 0.08);
    // the satisfied voice: "mm-hm!" … then a small burp (and sometimes a shy giggle)
    mmm(at + T.swallow[1] + 0.08);
    burp(at + T.settle[1] + 0.12);
    if (R() < 0.5) giggle(at + T.settle[1] + 0.62);
    stings.push({ kind: 'tada', notBefore: at + T.swallow[1] });
    logCue('gulp', at + T.swallow[0] + 0.06); caption('gulp');
  }
  function waveSeq(at) {         // feather rustle while the wing unfolds and waves, and a little honk hello
    const T = TIMING.wave;
    whoosh(at + T.unfold[0], T.unfold[1] - T.unfold[0], 2200, 3800, 0.028, 0.15);
    for (let i = 0; i < 3; i++) whoosh(at + T.wave[0] + i * 0.28, 0.24, 1700, 3100, 0.02, 0.2);
    honk(at + T.wave[0] + 0.02, 1); honk(at + T.wave[0] + 0.3, 1.12); if (R() < 0.5) giggle(at + T.wave[0] + 0.75);
    stings.push({ kind: 'wave', notBefore: at + T.wave[0] });
    logCue('wave', at);
  }
  function tick(at) {
    const i = tickN++ % AUDIO.pawls, s = bufSrc(N.clicks[i % 3], false, 0.96 + 0.08 * R()), g = G(N.pawlAmp[i] * (0.9 + 0.2 * R()));
    wire(s, g, N.tickBus); s.start(at); reap(s, [s, g]);
  }
  function swell(at) {
    const D = rr(6, 10), peak = rr(0.13, 0.2), pan = rr(-0.65, 0.65), crest = rr(0.4, 0.5);
    const s = bufSrc(N.pinkB, true), lp = F('lowpass', 220, 0.6), g = G(0), pn = Pan(pan);
    lp.frequency.setValueAtTime(220, at); lp.frequency.exponentialRampToValueAtTime(rr(800, 1300), at + D * crest); lp.frequency.exponentialRampToValueAtTime(260, at + D);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(peak, at + D * crest); g.gain.linearRampToValueAtTime(peak * 0.35, at + D * 0.72); g.gain.linearRampToValueAtTime(0, at + D);
    wire(s, lp, g, pn, N.amb);
    const f = bufSrc(N.whiteB, true), hp = F('highpass', 1900, 0.5), flp = F('lowpass', 6000, 0.5), fg = G(0);        // foam hiss on the sand
    fg.gain.setValueAtTime(0, at + D * (crest - 0.05)); fg.gain.linearRampToValueAtTime(peak * 0.22, at + D * (crest + 0.06)); fg.gain.exponentialRampToValueAtTime(1e-5, at + D); fg.gain.linearRampToValueAtTime(0, at + D + 0.02);
    wire(f, hp, flp, fg, pn);
    s.start(at, R() * 9); s.stop(at + D + 0.05); f.start(at, R() * 5); f.stop(at + D + 0.05);
    reap(s, [s, lp, g]); reap(f, [f, hp, flp, fg, pn]);
    return D;
  }
  function gullNote(at, f0, dur, pan, panV, amp, dist) {
    const o1 = O('sawtooth', f0), o2 = O('triangle', f0), vib = O('sine', rr(22, 30)), vg = G(f0 * 0.02);
    const m1 = G(0.4), m2 = G(0.3), b1 = F('bandpass', f0 * 2.05, 2.4), b2 = F('bandpass', f0 * 3.7, 3), lp = F('lowpass', 4600 - 2600 * dist, 0.7), g = G(0), pn = Pan(pan);
    o2.detune.value = 22;
    for (const o of [o1, o2]) { const fr = o.frequency; fr.setValueAtTime(f0 * 0.78, at); fr.exponentialRampToValueAtTime(f0 * 1.18, at + dur * 0.3); fr.exponentialRampToValueAtTime(f0 * 0.66, at + dur); }
    wire(vib, vg); vg.connect(o1.frequency); vg.connect(o2.frequency);
    wire(o1, m1); wire(o2, m2); for (const m of [m1, m2]) { m.connect(b1); m.connect(b2); }
    b1.connect(lp); b2.connect(lp); wire(lp, g, pn, N.far); send(pn, 0.14 + 0.3 * dist, 'far');
    if (pn.pan) { pn.pan.setValueAtTime(clamp(pan, -1, 1), at); pn.pan.linearRampToValueAtTime(clamp(pan + panV * dur, -1, 1), at + dur); }
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(amp, at + 0.04); g.gain.linearRampToValueAtTime(amp * 0.8, at + dur * 0.7); g.gain.linearRampToValueAtTime(0, at + dur);
    for (const o of [o1, o2, vib]) { o.start(at); o.stop(at + dur + 0.02); }
    reap(o1, [o1, o2, vib, vg, m1, m2, b1, b2, lp, g, pn]);
  }
  function gullCall(at, forceNear = false, panHint = null) {
    const escort = cadence > CADENCE.sprint - 6, near = forceNear || (escort && R() < 0.6);
    let pan = panHint ?? screenPan(near ? '[data-ref^="fx-esc"]' : '[data-ref^="fx-gfar"]', true);
    if (pan == null) pan = rr(-0.8, 0.8);
    const panV = (2 * (170 - 0.15 * speedN * V_MAX)) / 1600 * (near ? 0.3 : 1);    // far gulls drift with their layer
    const dist = near ? 0.15 : rr(0.45, 0.8), amp = (near ? 0.15 : 0.1) * rr(0.8, 1.1);
    const kind = R(), f0 = rr(820, 1040);
    let t = at, p = pan;
    if (kind < 0.45) { const n = 2 + Math.floor(R() * 3); for (let i = 0; i < n; i++) { const d = rr(0.2, 0.3); gullNote(t, f0 * (1 - 0.03 * i), d, p, panV, amp, dist); t += d + rr(0.07, 0.14); p += panV * (d + 0.1); } }
    else if (kind < 0.8) { const n = 4 + Math.floor(R() * 3); for (let i = 0; i < n; i++) { const d = rr(0.09, 0.13); gullNote(t, f0 * (1.15 - 0.045 * i), d, p, panV, amp * (1 - 0.06 * i), dist); t += d + rr(0.04, 0.07); p += panV * (d + 0.05); } }
    else gullNote(t, f0 * 0.9, rr(0.45, 0.6), p, panV, amp * 0.8, dist);
    if (R() < 0.35) gullNote(t + rr(0.3, 0.8), rr(760, 980), rr(0.2, 0.28), clamp(pan + rr(-0.4, 0.4), -1, 1), panV, amp * 0.6, Math.min(1, dist + 0.1));   // a reply
    logCue('gull', at, { pan: +pan.toFixed(3), panV: +panV.toFixed(4), near });
    caption('gull');
  }
  function hornBlast(at, f, dur, amp, pan, lpF, verbAmt) {
    const o1 = O('sawtooth', f), o2 = O('sawtooth', f * 1.004), o3 = O('square', f / 2), m3 = G(0.35), lp = F('lowpass', lpF * 0.4, 1.1), g = G(0), pn = Pan(pan);
    for (const [o, k] of [[o1, 1], [o2, 1.004], [o3, 0.5]]) { const fr = o.frequency; fr.setValueAtTime(f * k * 0.93, at); fr.exponentialRampToValueAtTime(f * k, at + 0.22); fr.setValueAtTime(f * k, at + dur); fr.exponentialRampToValueAtTime(f * k * 0.8, at + dur + 0.4); }
    lp.frequency.setValueAtTime(lpF * 0.4, at); lp.frequency.linearRampToValueAtTime(lpF, at + 0.45); lp.frequency.linearRampToValueAtTime(lpF * 0.7, at + dur + 0.5);
    wire(o1, lp); wire(o2, lp); wire(o3, m3, lp); wire(lp, g, pn, N.far); send(pn, verbAmt, 'far');
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(amp, at + 0.45); g.gain.setValueAtTime(amp, at + dur); g.gain.exponentialRampToValueAtTime(amp * 1e-3, at + dur + 0.9); g.gain.linearRampToValueAtTime(0, at + dur + 0.95);
    for (const o of [o1, o2, o3]) { o.start(at); o.stop(at + dur + 1); }
    reap(o1, [o1, o2, o3, m3, lp, g, pn]);
  }
  function fogHorn(at) {
    const pan = screenPan('[data-ref="sea-lantern"]') ?? 0.45;
    hornBlast(at, 163, 2.6, 0.034, pan, 460, 0.7);
    if (R() < 0.5) hornBlast(at + 4.2, 163, 2.6, 0.03, pan, 430, 0.7);
    logCue('horn', at, { pan }); caption('horn');
  }
  function boatHorn(at) {
    let pan = screenPan('[data-ref="sea-steamlit"]'); if (pan == null) pan = rr(-0.7, 0.7);
    hornBlast(at, 231, 0.55, 0.05, pan, 800, 0.6); hornBlast(at + 1.05, 231, 0.9, 0.05, pan, 800, 0.6);
    logCue('boat', at, { pan }); caption('boat');
  }
  function cricket(at, f, n, pan) {
    const o = O('sine', f), g = G(0), pn = Pan(pan); wire(o, g, pn, N.far);
    let t = at;
    for (let i = 0; i < n; i++) { for (let k = 0; k < 3; k++) { const s = t + k * 0.034; g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.022, s + 0.004); g.gain.linearRampToValueAtTime(0, s + 0.016); } t += rr(0.38, 0.46); }
    o.start(at); o.stop(t + 0.05); reap(o, [o, g, pn]);
    return t - at;
  }
  function firework(at, pan) {    // a soft far "pom" and a sprinkle of crackles, lots of air (bedtime-safe)
    const o = O('sine', 70), og = G(0), pn = Pan(pan); wire(o, og, pn, N.far); send(pn, 0.5, 'far');
    o.frequency.setValueAtTime(70, at); o.frequency.exponentialRampToValueAtTime(38, at + 0.3);
    const e = envAD(og.gain, at, 0.12, 0.01, 0.4); o.start(at); o.stop(e);
    const nb = bufSrc(N.brownB), lp = F('lowpass', 300, 0.7), ng = G(0); wire(nb, lp, ng, pn);
    const e2 = envAD(ng.gain, at, 0.14, 0.008, 0.35); nb.start(at, R() * 6); nb.stop(e2);
    const cr = bufSrc(N.whiteB), hp = F('highpass', 3500, 0.7), cg = G(0); wire(cr, hp, cg, pn);
    let t = at + 0.25; for (let i = 0; i < 14; i++) { t += rr(0.02, 0.07); cg.gain.setValueAtTime(0, t); cg.gain.linearRampToValueAtTime(0.03 * (1 - i / 16), t + 0.002); cg.gain.linearRampToValueAtTime(0, t + 0.012); }
    cr.start(at, R() * 3); cr.stop(t + 0.05);
    reap(o, [o, og]); reap(nb, [nb, lp, ng]); reap(cr, [cr, hp, cg, pn]);
  }
  function dingDing(at, pan) {   // the oncoming cyclist's little bell (higher, far, two quick strikes)
    tinyBell(at, 0.6, pan, 3150, 0.05, N.far); tinyBell(at + 0.16, 0.5, pan, 3150, 0.05, N.far);
    logCue('ding', at, { pan }); caption('ding');
  }

  // ================================================================== storybook foley (docs/SOUND.md)
  // A bedtime picture book read aloud: small, rounded, slightly toy-like sounds. Every transient is low-passed.
  function reapAt(at, nodes) {    // disconnect a sub-bus once its last voice has rung out (audio-clock, offline-safe)
    const s = ac.createBufferSource(), z = G(0); s.buffer = N.blip; wire(s, z, N.master); s.start(at); reap(s, [s, z, ...nodes]);
  }
  function tinyBell(at, amp, pan, f0 = 2640, lvl = 0.07, dest = N.fx) {   // a tiny brass handbell: ting-a-ling
    const pn = Pan(pan), lp = F('lowpass', 6200, 0.5), bus = G(amp * lvl), sv = send(pn, 0.34, dest === N.far ? 'far' : 'fx'); wire(bus, lp, pn, dest);
    const P = [[1, 1, 0.75], [2.0, 0.22, 0.42], [2.92, 0.16, 0.3], [4.1, 0.05, 0.16]];
    let last = null, end = 0;
    for (const [dt, k, a] of [[0, 1, 1], [0.048, 1.06, 0.42], [0.097, 0.97, 0.3]]) P.forEach(([r, pa, d], i) => {
      const o = O('sine', f0 * k * r + (i ? rr(-3, 3) : 0)), g = G(0); wire(o, g, bus);
      const e = envAD(g.gain, at + dt, pa * a, 0.0015, d); o.start(at + dt); o.stop(e);
      if (e > end) { if (last) reap(last[0], last); end = e; last = [o, g]; } else reap(o, [o, g]);
    });
    reap(last[0], [...last, bus, lp, pn, sv].filter(Boolean));
  }
  function boing(at) {             // the hop: a spring "boyoyoing" (triangle + sub, a wobble that dies away)
    const o = O('triangle', 170), s = O('sine', 85), wob = O('sine', 13), wg = G(0), g = G(0), sg = G(0.5), lp = F('lowpass', 2200, 0.6), pn = Pan(0.04);
    o.frequency.setValueAtTime(170, at); o.frequency.exponentialRampToValueAtTime(470, at + 0.22); o.frequency.exponentialRampToValueAtTime(390, at + 0.55);
    s.frequency.setValueAtTime(85, at); s.frequency.exponentialRampToValueAtTime(235, at + 0.22);
    wire(wob, wg); wg.connect(o.frequency); wg.gain.setValueAtTime(60, at); wg.gain.exponentialRampToValueAtTime(2, at + 0.55);
    wire(o, g); wire(s, sg, g); wire(g, lp, pn, N.fx); send(pn, 0.12);
    const e = envAD(g.gain, at, 0.14, 0.012, 0.5);
    for (const x of [o, s, wob]) { x.start(at); x.stop(e); }
    reap(o, [o, s, wob, wg, g, sg, lp, pn]);
    logCue('boing', at); caption('boing');
  }
  function gulpPop(at) {           // feeding: a round throat "gulp" sliding down, then a cork "pop!"
    const o = O('sine', 260), g = G(0), lp = F('lowpass', 900, 0.7), pn = Pan(0.12);
    o.frequency.setValueAtTime(300, at); o.frequency.exponentialRampToValueAtTime(105, at + 0.14); o.frequency.exponentialRampToValueAtTime(150, at + 0.2);
    wire(o, g, lp, pn, N.fx); const e = envAD(g.gain, at, 0.32, 0.01, 0.17); o.start(at); o.stop(e);
    const p = at + 0.27, po = O('sine', 1100), pg = G(0); po.frequency.setValueAtTime(1100, p); po.frequency.exponentialRampToValueAtTime(380, p + 0.045);
    wire(po, pg, pn); const e2 = envAD(pg.gain, p, 0.2, 0.001, 0.06); po.start(p); po.stop(e2);
    const n = bufSrc(N.brownB), nl = F('lowpass', 2400, 0.7), ng = G(0); wire(n, nl, ng, pn); envAD(ng.gain, p, 0.18, 0.0008, 0.012); n.start(p, R() * 5); n.stop(p + 0.03);
    send(pn, 0.12); reap(o, [o, g, lp]); reap(po, [po, pg, n, nl, ng, pn]);
    caption('gulpPop');
  }
  function paperRustle(at, amp = 1) {   // a page turning: a soft swish across the stereo and a few paper crinkles
    const s = bufSrc(N.pinkB), bp = F('bandpass', 900, 0.9), lp = F('lowpass', 5200, 0.6), g = G(0), pn = Pan(0.55);
    bp.frequency.setValueAtTime(900, at); bp.frequency.exponentialRampToValueAtTime(3200, at + 0.32); bp.frequency.exponentialRampToValueAtTime(1500, at + 0.6);
    if (pn.pan) { pn.pan.setValueAtTime(0.55, at); pn.pan.linearRampToValueAtTime(-0.45, at + 0.55); }
    wire(s, bp, lp, g, pn, N.fx); send(pn, 0.12);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.07 * amp, at + 0.16); g.gain.linearRampToValueAtTime(0.025 * amp, at + 0.4); g.gain.linearRampToValueAtTime(0, at + 0.62);
    s.start(at, R() * 5); s.stop(at + 0.65); reap(s, [s, bp, lp, g]);
    for (let i = 0, t = at + 0.05; i < 6; i++, t += rr(0.04, 0.1)) {
      const c = bufSrc(N.whiteB), cb = F('bandpass', rr(1800, 3600), 2.5), cg = G(0); wire(c, cb, cg, pn);
      envAD(cg.gain, t, 0.05 * amp * rr(0.5, 1), 0.002, rr(0.012, 0.03)); c.start(t, R() * 5); c.stop(t + 0.06); reap(c, [c, cb, cg]);
    }
    logCue('page', at); caption('page');
  }
  function pencil(at, dur = 1.1) {  // the story text writing on: graphite strokes on paper, soft and dry
    const s = bufSrc(N.whiteB, true), bp = F('bandpass', 2600, 1.4), lp = F('lowpass', 4800, 0.6), g = G(0), pn = Pan(-0.18);
    wire(s, bp, lp, g, pn, N.fx); g.gain.setValueAtTime(0, at);
    let t = at;
    while (t < at + dur) {
      const d = rr(0.05, 0.11), f = rr(2000, 3400);
      bp.frequency.setValueAtTime(f, t); bp.frequency.linearRampToValueAtTime(f * rr(0.85, 1.15), t + d);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(rr(0.02, 0.035), t + d * 0.3); g.gain.linearRampToValueAtTime(0, t + d);
      t += d + rr(0.01, 0.06);
    }
    s.start(at, R() * 5); s.stop(t + 0.05); reap(s, [s, bp, lp, g, pn]);
    logCue('pencil', at); caption('pencil');
  }
  function musicBox(at, top = 84) { // the egg stinger: a wind-up click, then the hook on a music box, quick, and a ding
    for (let i = 0; i < 3; i++) { const c = bufSrc(N.clicks[i % 3], false, 0.7), cg = G(0.12); wire(c, cg, N.fx); c.start(at + i * 0.06); reap(c, [c, cg]); }
    const save = N.lv.glk, mbx = G(0.34), pn = Pan(0.2); wire(mbx, pn, N.fx); send(pn, 0.3);
    [[0, 0], [0.16, -3], [0.27, 5], [0.38, 4], [0.49, 0], [0.7, 5]].forEach(([dt, iv], i) => bell2(at + 0.22 + dt, top + iv, i === 5 ? 1 : 0.75, mbx));
    reapAt(at + 4, [mbx, pn]); void save; logCue('musicbox', at); caption('egg');
  }
  // ---- ambience per route stretch (route.js STRETCHES): lapping waves, children far away, a kettle-whistle steam
  // train, wind chimes, wood creaks, a river; rain on a tin roof with puddle plops; crickets and the owl at night
  const AMB = {
    village: { lap: 1, chimes: 1, kids: 0.5 }, pier: { lap: 1.2, creak: 0.7 }, harbour: { lap: 1, creak: 1 }, funfair: { lap: 0.5, kids: 1.5 },
    railway: { lap: 0.3, train: 1 }, lighthouse: { lap: 0.9 }, cliffs: { lap: 0.4 }, dunes: { lap: 0.5, chimes: 0.2 },
    bridge: { lap: 0.3, river: 1 }, fort: { lap: 1, kids: 1 }, pines: { lap: 0.2, chimes: 0.6 }, return: { lap: 1, chimes: 1 },
  };
  const amb = () => AMB[wx.stretch] || AMB.village;
  function lapWave(at, k) {        // a small wave lapping on the sand: a slosh, then a few round drips
    const D = rr(1.3, 2.4), pk = rr(0.07, 0.11) * k, pan = rr(-0.6, 0.6);
    const s = bufSrc(N.brownB), bp = F('bandpass', 320, 0.8), g = G(0), pn = Pan(pan);
    bp.frequency.setValueAtTime(320, at); bp.frequency.exponentialRampToValueAtTime(rr(650, 900), at + D * 0.35); bp.frequency.exponentialRampToValueAtTime(280, at + D);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(pk, at + D * 0.35); g.gain.linearRampToValueAtTime(0, at + D);
    wire(s, bp, g, pn, N.amb); s.start(at, R() * 7); s.stop(at + D + 0.05); reap(s, [s, bp, g, pn]);
    for (let i = 0; i < 3; i++) plop(at + D * rr(0.3, 0.7), rr(520, 900), 0.025 * k, pan + rr(-0.2, 0.2));
    return D;
  }
  function plop(at, f, amp, pan = 0, dest = N.amb) {   // a round water drop / puddle plop (rising, then a bubble)
    const o = O('sine', f), g = G(0), lp = F('lowpass', 2400, 0.7), pn = Pan(clamp(pan, -1, 1)); wire(o, g, lp, pn, dest);
    o.frequency.setValueAtTime(f, at); o.frequency.exponentialRampToValueAtTime(f * 1.9, at + 0.05);
    const e = envAD(g.gain, at, amp, 0.002, 0.07); o.start(at); o.stop(e); reap(o, [o, g, lp, pn]);
  }
  function tink(at, amp, pan) {    // a raindrop on a tin roof: a tiny, softened metallic tick
    const f = rr(1700, 2900), o = O('sine', f), o2 = O('sine', f * 2.63), g = G(0), g2 = G(0.3), lp = F('lowpass', 4200, 0.6), pn = Pan(pan);
    wire(o, g); wire(o2, g2, g); wire(g, lp, pn, N.amb);
    const e = envAD(g.gain, at, amp, 0.001, 0.035); o.start(at); o2.start(at); o.stop(e); o2.stop(e); reap(o, [o, o2, g, g2, lp, pn]);
  }
  function chimes(at, n) {         // wind chimes: tuned tubes (C D F G A, the tune's pentatonic), a few touches
    const T = [84, 86, 89, 91, 93], pn = Pan(rr(-0.7, -0.2)), g = G(0.16); wire(g, pn, N.far); send(pn, 0.5, 'far');
    let t = at; for (let i = 0; i < n; i++) { bell2(t, T[Math.floor(R() * T.length)], rr(0.4, 1), g); t += rr(0.12, 0.5); }
    reapAt(t + 3, [g, pn]);
    logCue('chimes', at, { n }); caption('chimes');
  }
  function kids(at) {              // children laughing far away on the beach
    const n = 2 + Math.floor(R() * 2);
    for (let k = 0; k < n; k++) {
      const pan = rr(-0.9, 0.9), f = rr(400, 560), t0 = at + rr(0, 0.6), syl = 3 + Math.floor(R() * 3);
      for (let i = 0; i < syl; i++) vox(t0 + i * rr(0.13, 0.17), { dest: N.far, pan, dur: 0.1, f0: [[0, f * (1 - 0.04 * i)], [0.1, f * (0.92 - 0.04 * i)]], vow: [[0, R() < 0.5 ? 'a' : 'e']], amp: 0.03, h: 0.03, breath: 0.4, shift: 1.35, mute: true });
    }
    logCue('kids', at); caption('kids');
  }
  function steamTrain(at) {        // a little steam train: chuffs that speed up, a kettle whistle, far and soft
    const pn = Pan(-0.8), bus = G(1); wire(bus, pn, N.far); send(pn, 0.4, 'far');
    if (pn.pan) { pn.pan.setValueAtTime(-0.8, at); pn.pan.linearRampToValueAtTime(0.7, at + 7); }
    let t = at;
    for (let i = 0; i < 22; i++) {
      const s = bufSrc(N.pinkB), bp = F('bandpass', i % 2 ? 520 : 680, 1.2), g = G(0); wire(s, bp, g, bus);
      envAD(g.gain, t, (i % 2 ? 0.05 : 0.07) * Math.min(1, 0.3 + i / 8), 0.01, 0.12); s.start(t, R() * 6); s.stop(t + 0.2); reap(s, [s, bp, g]);
      t += 0.42 - 0.012 * Math.min(i, 14);
    }
    for (const [dt, d] of [[1.6, 0.45], [2.25, 1.1]]) {            // "toot … tooooot", a kettle-like breathy whistle
      const w = at + dt, f = 1480, o = O('sine', f), o2 = O('sine', f * 1.19), wob = O('sine', 6.5), wg = G(f * 0.012), g = G(0), lp = F('lowpass', 2800, 0.6);
      const ns = bufSrc(N.whiteB), nb = F('bandpass', f, 6), ng = G(0.5);
      for (const x of [o, o2]) { x.frequency.setValueAtTime(x === o ? f * 0.85 : f * 1.0, w); x.frequency.exponentialRampToValueAtTime(x === o ? f : f * 1.19, w + 0.12); }
      wire(wob, wg); wg.connect(o.frequency); wire(o, g); wire(o2, g); wire(ns, nb, ng, g); wire(g, lp, bus);
      g.gain.setValueAtTime(0, w); g.gain.linearRampToValueAtTime(0.022, w + 0.08); g.gain.setValueAtTime(0.022, w + d - 0.12); g.gain.linearRampToValueAtTime(0, w + d);
      for (const x of [o, o2, wob]) { x.start(w); x.stop(w + d + 0.02); } ns.start(w, R() * 4); ns.stop(w + d + 0.02);
      reap(o, [o, o2, wob, wg, g, lp, ns, nb, ng]);
    }
    reapAt(at + 14, [bus, pn]);
    logCue('train', at); caption('train');
  }
  function creak(at) {             // old wood (boats, the pier's boards): a slow friction creak
    const o = O('sawtooth', rr(90, 140)), am = O('square', rr(28, 45)), amg = G(0.5), g0 = G(0.5), bp = F('bandpass', rr(600, 900), 3), g = G(0), pn = Pan(rr(-0.8, 0.8));
    o.frequency.linearRampToValueAtTime(o.frequency.value * rr(1.1, 1.4), at + 0.4);
    wire(am, amg); amg.connect(g0.gain); wire(o, g0, bp, g, pn, N.far);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.03, at + 0.12); g.gain.linearRampToValueAtTime(0, at + 0.45);
    for (const x of [o, am]) { x.start(at); x.stop(at + 0.5); } reap(o, [o, am, amg, g0, bp, g, pn]);
    logCue('creak', at);
  }
  function yawn(at) {              // bedtime: a big, sleepy pelican yawn ("mmhaaa-ooh")
    vox(at, { dur: 1.5, f0: [[0, 290], [0.25, 330], [0.85, 245], [1.5, 170]], vow: [[0, 'm'], [0.18, 'a'], [0.85, 'o'], [1.3, 'u']], amp: 0.12, h: 0.08, breath: 0.5, attack: 0.12, release: 0.35 });
    logCue('yawn', at); caption('yawn');
  }

  // ================================================================== the pelican's voice (formant synthesis)
  // Vowels as three formants (Hz); a cartoon bird is a small resonator: formants ×1.1 over an adult voice.
  const VOW = { u: [330, 820, 2300], o: [480, 860, 2600], a: [760, 1180, 2500], uh: [620, 1150, 2450], e: [520, 1800, 2520], i: [300, 2250, 2950], m: [260, 1050, 2300], n: [280, 1700, 2600] };
  const FGAIN = { m: [1, 0.12, 0.04], n: [1, 0.18, 0.06] };
  // spec: { dur, f0: [[t, Hz]…], vow: [[t, 'a']…], amp, breath 0..1, h (aspirated onset s), rough 0..1, src, pan, dest, shift, stop }
  function vox(at, sp) {
    const dur = sp.dur, dest = sp.dest || N.vPan, shift = sp.shift || 1.1;
    const src = O(sp.src || 'sawtooth', sp.f0[0][1]), sg = G(1), lp = F('lowpass', 2300, 0.5), sum = G(1), env = G(0), pn = sp.pan != null ? Pan(sp.pan) : null;
    src.frequency.setValueAtTime(sp.f0[0][1], at);
    for (let i = 1; i < sp.f0.length; i++) src.frequency.linearRampToValueAtTime(sp.f0[i][1], at + sp.f0[i][0]);
    const nodes = [src, sg, lp, sum, env];
    let rough = null;
    if (sp.rough) {       // burp / croak: a low, wobbly frequency modulation
      rough = O('square', sp.roughF || 31); const rg = G(sp.f0[0][1] * 0.22 * sp.rough); wire(rough, rg); rg.connect(src.frequency); nodes.push(rough, rg);
    }
    wire(src, sg, lp);
    const fs = [0, 1, 2].map(k => { const b = F('bandpass', 500, 5); const g = G(1); wire(lp, b, g, sum); nodes.push(b, g); return [b, g]; });
    const setV = (tt, v, jump) => {
      const V = VOW[v], FG = FGAIN[v] || [1, 0.55, 0.28];
      fs.forEach(([b, g], k) => {
        const fq = V[k] * shift, q = fq / [85, 110, 160][k];
        if (jump) { b.frequency.setValueAtTime(fq, at + tt); b.Q.setValueAtTime(q, at + tt); g.gain.setValueAtTime(FG[k] * 3, at + tt); }
        else { b.frequency.linearRampToValueAtTime(fq, at + tt); b.Q.linearRampToValueAtTime(q, at + tt); g.gain.linearRampToValueAtTime(FG[k] * 3, at + tt); }
      });
    };
    sp.vow.forEach(([tt, v], i) => setV(tt, v, i === 0));
    const amp = sp.amp, a = sp.attack ?? 0.02, rel = sp.stop ? 0.012 : sp.release ?? 0.06;
    sum.connect(env);
    let hs = null;
    if (sp.h) {           // aspirated onset "h": breath noise through the same formants, just before the voice
      hs = bufSrc(N.whiteB); const hg = G(0); wire(hs, hg, lp); nodes.push(hs, hg);
      hg.gain.setValueAtTime(0, at - sp.h); hg.gain.linearRampToValueAtTime(0.6, at - sp.h * 0.4); hg.gain.linearRampToValueAtTime(0, at + 0.02);
      env.gain.setValueAtTime(0, at - sp.h); env.gain.linearRampToValueAtTime(amp * 0.5, at - sp.h * 0.5);
      hs.start(Math.max(0, at - sp.h), R() * 4); hs.stop(at + 0.05);
    } else env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(amp, at + a);
    env.gain.setValueAtTime(amp, at + Math.max(a, dur - rel));
    env.gain.linearRampToValueAtTime(0, at + dur);
    if (sp.breath) { const bs = bufSrc(N.whiteB), bg = G(sp.breath * 0.35); wire(bs, bg, lp); bs.start(at, R() * 4); bs.stop(at + dur + 0.02); nodes.push(bs, bg); }
    if (pn) { wire(env, pn, dest); nodes.push(pn); if (dest === N.far) send(pn, 0.3, 'far'); } else env.connect(dest);
    src.start(Math.max(0, at - (sp.h || 0))); src.stop(at + dur + 0.03);
    if (rough) { rough.start(at); rough.stop(at + dur + 0.03); }
    reap(src, nodes);
    if (!sp.mute) voiceUntil = Math.max(voiceUntil, at + dur);
    return at + dur;
  }
  function pop(at, amp = 0.12) {  // lips / bill closing: a tiny low click
    const s = bufSrc(N.brownB), lp = F('lowpass', 700, 0.8), g = G(0); wire(s, lp, g, N.vPan);
    const e = envAD(g.gain, at, amp, 0.001, 0.02); s.start(at, R() * 5); s.stop(e); reap(s, [s, lp, g]);
  }
  function hup(at) {        // "hup!": breathy h, a short rising u, clipped by the bill closing on the p
    const p = rr(0.96, 1.06);
    vox(at, { dur: 0.13, f0: [[0, 230 * p], [0.1, 310 * p], [0.13, 300 * p]], vow: [[0, 'uh'], [0.1, 'u']], amp: 0.16, h: 0.05, breath: 0.2, stop: true });
    pop(at + 0.135, 0.1);
    logCue('hup', at); caption('hup');
  }
  function oof(at) {        // soft landing grunt
    vox(at, { dur: 0.17, f0: [[0, 175], [0.17, 128]], vow: [[0, 'u'], [0.15, 'o']], amp: 0.1, h: 0.025, breath: 0.25 });
  }
  function honk(at, k = 1) { // a little nasal pelican honk ("hon-")
    vox(at, { dur: 0.16 * k, f0: [[0, 330 * k], [0.05, 360 * k], [0.16 * k, 300 * k]], vow: [[0, 'a'], [0.1 * k, 'n']], amp: 0.12, src: 'square', breath: 0.05, shift: 1.2, attack: 0.012 });
    if (k === 1) { logCue('honk', at); caption('honk'); }
  }
  function mmm(at) {        // satisfied "mm-hm!"
    vox(at, { dur: 0.22, f0: [[0, 200], [0.12, 250], [0.22, 235]], vow: [[0, 'm']], amp: 0.14, attack: 0.03 });
    vox(at + 0.27, { dur: 0.3, f0: [[0, 270], [0.1, 280], [0.3, 190]], vow: [[0, 'm'], [0.12, 'm']], amp: 0.13, h: 0.03, attack: 0.02 });
  }
  function burp(at) {       // a small, satisfied burp: low rough 'o' with a closing 'p'
    vox(at, { dur: 0.3, f0: [[0, 92], [0.08, 104], [0.3, 78]], vow: [[0, 'uh'], [0.12, 'o'], [0.26, 'u']], amp: 0.18, rough: 0.5, roughF: 29, breath: 0.1, attack: 0.03, shift: 1.0 });
    pop(at + 0.31, 0.06);
    logCue('burp', at); caption('burp');
  }
  function giggle(at) {     // "hee-hee-hee" (shy, a little toy-like)
    for (let i = 0; i < 3; i++) vox(at + i * 0.12, { dur: 0.08, f0: [[0, 380 - i * 22], [0.08, 340 - i * 22]], vow: [[0, 'i'], [0.05, 'e']], amp: 0.065, h: 0.03, breath: 0.32, src: 'triangle', shift: 1.25 });
    logCue('giggle', at); caption('giggle');
  }
  function grunt(at, kind) {
    if (kind === 'effort') vox(at, { dur: 0.13, f0: [[0, 150], [0.13, 132]], vow: [[0, 'uh'], [0.1, 'n']], amp: 0.08, h: 0.03, breath: 0.35, attack: 0.015 });
    else {                   // a contented, mumbly "mm-mm-hmm" (as if telling itself the story)
      const p = rr(0.95, 1.08);
      vox(at, { dur: 0.13, f0: [[0, 235 * p], [0.13, 250 * p]], vow: [[0, 'm'], [0.07, 'o']], amp: 0.08 });
      vox(at + 0.16, { dur: 0.12, f0: [[0, 225 * p], [0.12, 215 * p]], vow: [[0, 'u'], [0.08, 'm']], amp: 0.07 });
      vox(at + 0.32, { dur: 0.24, f0: [[0, 210 * p], [0.24, 185 * p]], vow: [[0, 'm']], amp: 0.07, h: 0.02 });
    }
    logCue('grunt', at, { kind });
  }
  function friendHonk(at, pan) {   // the pelican friend overhead, a higher, farther voice (the "嘎!")
    const d = { dest: N.far, pan };
    vox(at, { ...d, dur: 0.18, f0: [[0, 400], [0.06, 430], [0.18, 360]], vow: [[0, 'a'], [0.12, 'n']], amp: 0.09, src: 'square', shift: 1.3 });
    vox(at + 0.24, { ...d, dur: 0.22, f0: [[0, 420], [0.07, 450], [0.22, 350]], vow: [[0, 'a'], [0.15, 'n']], amp: 0.08, src: 'square', shift: 1.3 });
    logCue('friend', at, { pan }); caption('friend');
  }
  function meow(at, pan) {
    vox(at, { dest: N.far, pan, dur: 0.42, f0: [[0, 560], [0.15, 760], [0.42, 520]], vow: [[0, 'i'], [0.12, 'e'], [0.25, 'a'], [0.4, 'u']], amp: 0.07, shift: 1.45, attack: 0.03 });
    logCue('meow', at, { pan }); caption('meow');
  }
  function owl(at) {
    const pan = rr(-0.8, 0.8), d = { dest: N.far, pan, src: 'triangle', shift: 1.0 };
    vox(at, { ...d, dur: 0.35, f0: [[0, 360], [0.1, 380], [0.35, 330]], vow: [[0, 'u']], amp: 0.05, attack: 0.08 });
    vox(at + 0.55, { ...d, dur: 0.6, f0: [[0, 370], [0.2, 385], [0.6, 320]], vow: [[0, 'u']], amp: 0.045, attack: 0.1, release: 0.25 });
    logCue('owl', at); caption('owl');
  }

  // ================================================================== music: "Goodnight, Pelican" (docs/BGM.md)
  const NB = BARS.length, once = opts.bgm === 'once';
  const mus = { bar: 0, step: 0, nextT: 0, bpm: BGM.bpm, mode: 'sun', strings: [], lastMode: '', crooning: false, done: false, loops: 0 };
  // the page adapts by layers (never by tempo jitter): drums, shaker, recorder and doubling thin out at dusk, in rain,
  // and at night; the tempo only steps between two rungs (88 day / 80 night), and only at a section's first bar.
  const MODES = {
    sun: { dr: 1, shk: 1, taps: 1, uke: 1, pno: 1, rec: 1, glk: 1, lvl: 1 },
    soft: { dr: 0.65, shk: 0, taps: 1, uke: 0.9, pno: 1, rec: 0.9, glk: 0.9, lvl: 0.92 },
    rain: { dr: 0.5, shk: 0, taps: 0, uke: 0.85, pno: 1.05, rec: 0.8, glk: 0.8, lvl: 0.88 },
    lullaby: { dr: 0, shk: 0, taps: 0, uke: 0.7, pno: 0.85, rec: 0.55, glk: 0.75, lvl: 0.85 },
  };
  function modeNow() {
    const rain = wx.rain || 0, fog = wx.fog || 0, cloud = wx.cloud || 0;
    return night > 0.6 ? 'lullaby' : rain > 0.3 ? 'rain' : (fog > 0.4 || cloud > 0.55 || night > 0.3) ? 'soft' : 'sun';
  }
  function voicing(pcs, lo = 55, hi = 70, max = 4) { const v = []; for (let m = lo; m <= hi; m++) if (pcs.includes(m % 12)) v.push(m); return v.slice(0, max); }
  const bassMidi = pc => 33 + ((pc - 9 + 12) % 12);       // A1 … G#2

  // --- instruments (one-shots)
  function pluck(at, midi, vel, kind, dest, stringIx = -1, dur = 0) {
    const e = ks(midi, kind), s = bufSrc(e.buf, false, e.rate), g = G(vel);
    wire(s, g, dest); s.start(at);
    const end = dur > 0 ? at + dur : at + e.buf.duration / e.rate;
    if (dur > 0) { g.gain.setValueAtTime(vel, end); g.gain.linearRampToValueAtTime(0, end + 0.08); s.stop(end + 0.1); }
    if (stringIx >= 0) {              // a string can only ring once: damp the previous pluck on it
      const prev = mus.strings[stringIx];
      if (prev && prev.end > at) { try { prev.g.gain.setValueAtTime(prev.vel, at); prev.g.gain.linearRampToValueAtTime(0, at + 0.03); prev.s.stop(at + 0.04); } catch { /* stopped */ } }
      mus.strings[stringIx] = { s, g, vel, end };
    }
    reap(s, [s, g]);
  }
  function bell2(at, midi, vel, dest = N.lv.glk) {
    const e = glk(midi), s = bufSrc(e.buf), g = G(vel); wire(s, g, dest); s.start(at); reap(s, [s, g]);
  }
  // celesta: hammered steel bar over a resonator. A strong fundamental with a slow 0.4 Hz shimmer pair, a faint
  // octave, the bright 4th partial that dies fast, and a felt hammer tick. Pre-rendered with a rotating phasor.
  const CEL = new Map();
  function addPartial(d, sr, f, a, tau) {
    if (f >= sr * 0.45) return;
    const w = TAU * f / sr, c = Math.cos(w), s = Math.sin(w), k = Math.exp(-1 / (tau * sr));
    let x = 0, y = 1, e = a;
    for (let i = 0; i < d.length; i++) { d[i] += x * e; const nx = x * c + y * s; y = y * c - x * s; x = nx; e *= k; }
  }
  function cel(midi) {
    let e = CEL.get(midi); if (e) return e;
    const sr = ac.sampleRate, f = mtof(midi), n = Math.floor(2.2 * sr), buf = ac.createBuffer(1, n, sr), d = buf.getChannelData(0);
    const k = clamp(1 - (midi - 72) * 0.025, 0.5, 1.3);
    for (const [r, a, t] of [[1, 1, 1.5], [1.0008, 0.32, 1.3], [2, 0.05, 0.5], [3.98, 0.22, 0.2], [9.8, 0.03, 0.05]]) addPartial(d, sr, f * r, a, t * k);
    const A = Math.floor(sr * 0.0012), Z = Math.floor(sr * 0.04);
    for (let i = 0; i < n; i++) d[i] = (d[i] + (R() * 2 - 1) * 0.1 * Math.exp(-i / (sr * 0.0012))) * Math.min(1, i / A) * Math.min(1, (n - i) / Z) * 0.62;
    e = { buf }; CEL.set(midi, e);
    return e;
  }
  function celesta(at, midi, vel) { const e = cel(midi), s = bufSrc(e.buf), g = G(vel); wire(s, g, N.lv.cel); s.start(at); reap(s, [s, g]); }
  // felt piano: live partials (slightly stretched, two detuned unison strings), a fast-then-slow two-stage decay,
  // a soft hammer thump, a velocity-dependent felt lowpass and a damper release at the note's end
  function piano(at, midi, dur, vel) {
    const f = mtof(midi), lp = F('lowpass', 1100 + 1600 * vel, 0.5), env = G(0), kt = clamp(1.7 - (midi - 60) * 0.03, 0.6, 2.4);
    wire(lp, env, N.lv.pno);
    const end = at + Math.max(0.12, dur), nodes = [lp, env], oscs = [];
    for (const [n, a, det] of [[1, 0.62, -0.9], [1, 0.5, 0.9], [2, 0.34, 0.4], [3, 0.13, -0.3], [4, 0.06, 0]]) {
      const o = O('sine', f * n * Math.sqrt(1 + 0.0004 * n * n)), g = G(0); o.detune.value = det;
      wire(o, g, lp); nodes.push(o, g); oscs.push(o);
      g.gain.setValueAtTime(a, at); g.gain.setTargetAtTime(a * 0.4, at + 0.004, 0.11 / n); g.gain.setTargetAtTime(0, at + 0.3, kt / n);
    }
    env.gain.setValueAtTime(0, at); env.gain.linearRampToValueAtTime(vel, at + 0.005);
    env.gain.setValueAtTime(vel, end); env.gain.setTargetAtTime(0, end, 0.09);
    const th = bufSrc(N.brownB), tl = F('lowpass', 900, 0.7), tg = G(0); wire(th, tl, tg, N.lv.pno); nodes.push(th, tl, tg);
    envAD(tg.gain, at, vel * 0.18, 0.002, 0.03); th.start(at, R() * 5); th.stop(at + 0.06);
    for (const o of oscs) { o.start(at); o.stop(end + 0.5); }
    reap(oscs[0], nodes);
  }
  // recorder: a breathy, mostly-fundamental tone with a chiff on the attack, a small scoop up to pitch and a
  // vibrato that only arrives on long notes
  let recWave = null;
  function recorder(at, midi, dur, vel, dest = N.lv.rec) {
    if (!recWave) recWave = ac.createPeriodicWave(new Float32Array(6), new Float32Array([0, 1, 0.16, 0.1, 0.03, 0.015]));
    const f = mtof(midi), o = ac.createOscillator(); o.setPeriodicWave(recWave);
    const vib = O('sine', rr(4.6, 5.4)), vg = G(0), env = G(0), lp = F('lowpass', Math.min(5200, f * 5), 0.5);
    const ns = bufSrc(N.whiteB), cb = F('bandpass', f * 2.3, 2.5), cg = G(0), bb = F('bandpass', f, 9), bg = G(0.07);
    const end = at + Math.max(0.1, dur * 0.96);
    o.frequency.setValueAtTime(f * 0.988, at); o.frequency.exponentialRampToValueAtTime(f, at + 0.045);
    wire(vib, vg); vg.connect(o.frequency);
    vg.gain.setValueAtTime(0, at); if (dur > 0.5) { vg.gain.setValueAtTime(0, at + 0.25); vg.gain.linearRampToValueAtTime(f * 0.0045, at + Math.min(dur, 0.7)); }
    wire(o, lp, env); wire(ns, cb, cg, env); wire(ns, bb, bg, env); env.connect(dest);
    envAD(cg.gain, at, 0.5, 0.004, 0.035);
    env.gain.setValueAtTime(0, at); env.gain.linearRampToValueAtTime(vel, at + 0.04);
    env.gain.setValueAtTime(vel * 0.9, Math.max(at + 0.05, end - 0.07)); env.gain.linearRampToValueAtTime(0, end);
    for (const x of [o, vib]) { x.start(at); x.stop(end + 0.02); }
    ns.start(at, R() * 4); ns.stop(end + 0.02);
    reap(o, [o, vib, vg, env, lp, ns, cb, cg, bb, bg]);
  }
  function brush(at, vel, long) {       // brush swish (long) or tap
    const s = bufSrc(N.whiteB), bp = F('bandpass', long ? 4200 : 5600, long ? 0.5 : 0.9), g = G(0); wire(s, bp, g, N.lv.dr);
    if (long) { g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vel, at + 0.07); g.gain.exponentialRampToValueAtTime(vel * 0.01, at + 0.36); g.gain.linearRampToValueAtTime(0, at + 0.38); s.start(at, R() * 5); s.stop(at + 0.4); }
    else { const e = envAD(g.gain, at, vel, 0.002, 0.045); s.start(at, R() * 5); s.stop(e); }
    reap(s, [s, bp, g]);
  }
  function brushSwell(at, dur, vel) {   // a slow brush roll crescendo into the last A (bridge bars 7–8)
    const s = bufSrc(N.whiteB, true), bp = F('bandpass', 3000, 0.6), g = G(0); wire(s, bp, g, N.lv.dr);
    bp.frequency.setValueAtTime(2200, at); bp.frequency.exponentialRampToValueAtTime(5200, at + dur);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vel, at + dur - 0.03); g.gain.linearRampToValueAtTime(0, at + dur + 0.06);
    s.start(at, R() * 5); s.stop(at + dur + 0.1); reap(s, [s, bp, g]);
  }
  function shaker(at, vel) {
    const s = bufSrc(N.whiteB), hp = F('highpass', 6000, 0.7), g = G(0); wire(s, hp, g, N.lv.dr);
    const e = envAD(g.gain, at, vel, 0.008, 0.035); s.start(at, R() * 5); s.stop(e); reap(s, [s, hp, g]);
  }
  // the page-turn flourish: a quick glockenspiel run up the next section's chord and a paper swish across the stereo
  function pageTurn(at, ch, beat) {
    const run = voicing(ch.pcs, 79, 98, 6), sp = beat * 0.9 / run.length;
    run.forEach((m, i) => bell2(at + i * sp, m, 0.18 + 0.05 * i));
    const s = bufSrc(N.pinkB), bp = F('bandpass', 1400, 1.1), g = G(0), pn = Pan(-0.5); wire(s, bp, g, pn, N.musIn);
    bp.frequency.setValueAtTime(1400, at); bp.frequency.exponentialRampToValueAtTime(5200, at + 0.42);
    if (pn.pan) { pn.pan.setValueAtTime(-0.5, at); pn.pan.linearRampToValueAtTime(0.5, at + 0.45); }
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.05, at + 0.12); g.gain.linearRampToValueAtTime(0, at + 0.46);
    s.start(at, R() * 5); s.stop(at + 0.5); reap(s, [s, bp, g, pn]);
    logCue('pageturn', at);
  }
  function croonNote(at, midi, dur) {    // the pelican hums the melody (legato, a lazy portamento, "mm" opening to "oo")
    let m = midi - 12; while (m > 64) m -= 12;
    const f = mtof(m);
    glide(N.crOsc.frequency, f, at - 0.01, 0.03);
    glide(N.crG.gain, 0.08, at, 0.03);
    glide(N.crG.gain, 0.035, at + Math.max(0.05, dur - 0.06), 0.03);
    glide(N.crVibG.gain, 0, at, 0.02); glide(N.crVibG.gain, f * 0.006, at + 0.18, 0.12);
    glide(N.crF1.frequency, 270, at, 0.03); if (dur > 0.5) glide(N.crF1.frequency, 360, at + 0.22, 0.12);
  }
  function croonStop(at) { glide(N.crG.gain, 0, at, 0.12); }

  function playSting(kind, at, B) {
    const top = voicing(B.ch.pcs, 77, 93, 3);
    if (!top.length) return;
    if (kind === 'tada' || kind === 'egg') { bell2(at, top[0], 0.8); bell2(at + 0.11, top[top.length - 1], 0.9); if (kind === 'egg') bell2(at + 0.22, top[0] + 12, 0.7); pluck(at, bassMidi(B.ch.bass), 0.7, 'bass', N.lv.bass); }
    else if (kind === 'wave') top.forEach((m, i) => bell2(at + i * 0.07, m, 0.6 + 0.1 * i));
    logCue('sting', at, { kind });
  }

  // bar line: pick the arrangement layer levels for the page's mood; tempo only moves on a section's first bar
  function barStart(bar, t) {
    const B = BARS[bar], mode = modeNow();
    if (mode !== mus.lastMode) { logCue('arr', t, { mode }); mus.lastMode = mode; }
    mus.mode = mode;
    if (B.bi === 0 && !once) { const bpm = mode === 'lullaby' ? BGM.night : BGM.bpm; if (bpm !== mus.bpm) { mus.bpm = bpm; logCue('tempo', t, { bpm }); } }
    const M = MODES[mode], lv = N.lv, on = musicOn ? 1 : 0, lead = B.A.lead;
    const m = k => on * (opts.inst ? +opts.inst.includes(k) : 1) * (k === lead && coasting ? 0.3 : 1);   // the lead steps back for the croon
    glide(lv.cel.gain, m('cel') * 0.5, t, 0.3);
    glide(lv.glk.gain, m('glk') * 0.24 * M.glk, t, 0.3);
    glide(lv.rec.gain, m('rec') * (lead === 'rec' ? 1 : M.rec), t, 0.3);
    glide(lv.uke.gain, m('uke') * 0.5 * M.uke, t, 0.4);
    glide(lv.pno.gain, m('pno') * 0.36 * M.pno, t, 0.4);
    glide(lv.bass.gain, m('bass') * 0.55, t, 0.4);
    glide(lv.dr.gain, m('dr') * M.dr * (coasting ? 0.5 : 1) * 0.4, t, 0.4);
    glide(N.musLvl.gain, on * M.lvl * 0.26, t, musicOn ? 0.8 : 0.4);      // sits about −22 dBFS under the effects
    glide(N.musSend.gain, mode === 'rain' || mode === 'lullaby' ? 0.32 : 0.22, t, 1);
    mus.info = B;
  }
  // one 8th-note step of the score (6 per bar)
  function musicStep(bar, step, t, beat) {
    const B = BARS[bar], A = B.A, M = MODES[mus.mode], ch = B.ch, sv = B.lvl;
    const hv = v => v * sv * (0.9 + 0.2 * R());               // ±10 % velocity
    const ht = (ms = 15) => (R() * 2 - 1) * ms / 1000;         // ±10–20 ms timing
    const ending = A.roll != null && B.bi >= A.roll, entered = B.bi >= (A.enter || 0);
    // --- melody (+ croon) and the recorder counter-line
    for (const n of B.notes) if (n.s === step) {
      const dur = n.d * beat / 2, at = t + ht(12), acc = step === 0 ? 1 : step % 2 ? 0.82 : 0.92;
      if (musicOn) {
        if (A.lead === 'glk') bell2(at, n.m, hv(0.8 * acc));
        else if (A.lead === 'rec') recorder(at, n.m, dur, hv(0.2 * acc));
        else celesta(at, n.m, hv(0.85 * acc));
        if (A.dbl) bell2(at + 0.006, n.m + 12, hv(0.34));
      }
      if (mus.crooning) croonNote(t, n.m, dur);
    }
    if (!musicOn) return;
    if (B.ctr) for (const n of B.ctr) if (n.s === step) recorder(t + ht(14), n.m, n.d * beat / 2, hv(0.12));
    const pcs = ch.pcs;
    // --- celesta broken chords (B section)
    if (A.arp) { const v = voicing(pcs, 74, 90, 4); celesta(t + ht(10), v[[0, 1, 2, 3, 2, 1][step] % v.length], hv(step === 0 ? 0.3 : 0.22)); }
    // --- ukulele
    if (A.uke && entered) {
      const v = voicing(pcs, 57, 72, 4);
      const strum = (vel, up, spread = 0.012) => { const vs = up ? v.slice(1).reverse() : v; vs.forEach((m, i) => pluck(t + i * spread + ht(8), m, hv(vel), 'uke', N.lv.uke, up ? v.length - 1 - i : i)); };
      if (ending) { if (step === 0 && B.bi === A.roll) strum(0.42, false, 0.045); }
      else if (A.uke === 'waltz') { if (step === 2 || step === 4) strum(step === 2 ? 0.4 : 0.34, false); }
      else if (A.uke === 'pick') { const k = [0, 2, 1, 3, 2, 1][step]; pluck(t + ht(10), v[k % v.length], hv(step === 0 ? 0.5 : 0.38), 'uke', N.lv.uke, k); }
      else if (A.uke === 'strum') { const P = { 0: [0.46, 0], 2: [0.4, 0], 3: [0.24, 1], 4: [0.38, 0], 5: [0.22, 1] }[step]; if (P) strum(P[0], P[1]); }
    }
    // --- felt piano
    if (A.pno) {
      if (A.pno === 'pad' || ending) { if (step === 0) voicing(pcs, 57, 72, 4).forEach((m, i) => piano(t + i * 0.01 + ht(8), m, 3 * beat * 0.98, hv(0.26))); }
      else if (step === 2 || step === 4) voicing(pcs, 57, 72, 3).forEach((m, i) => piano(t + i * 0.006 + ht(8), m, beat * 0.8, hv(step === 2 ? 0.26 : 0.22)));
    }
    // --- upright bass (mono, centre)
    if (A.bass && entered) {
      const root = bassMidi(ch.bass);
      if (step === 0) pluck(t + ht(6), root, hv(0.95), 'bass', N.lv.bass, 10, (A.bass === 'pedal' || ending ? 3 : 2) * beat * 0.95);
      else if (step === 4 && A.bass === 'onethree' && !ending) pluck(t + ht(6), root + 7 <= 47 ? root + 7 : root - 5, hv(0.7), 'bass', N.lv.bass, 10, beat * 0.9);
    }
    // --- glockenspiel fills where the melody rests at a phrase end
    if (A.spark && !B.last && B.bi % 4 === 3 && step >= 3) { const v = voicing(pcs, 79, 93, 4).reverse(); bell2(t + ht(10), v[(step - 3) % v.length], hv(0.42 - 0.08 * (step - 3))); }
    // --- brushes / shaker
    if (A.dr && M.dr) {
      if (step === 0) brush(t + ht(10), hv(0.32), true);
      if (A.dr >= 1 && M.taps && (step === 2 || step === 4)) brush(t + ht(10), hv(0.16), false);
      if (A.dr >= 2 && M.shk) shaker(t + ht(8), hv(step % 2 ? 0.08 : 0.13));
    }
    if (A.swell != null && B.bi === A.swell && step === 0 && M.dr) brushSwell(t, 6 * beat, 0.22);
    // --- the page-turn flourish on the last beat of every section (and of the loop)
    if (B.last && step === 4 && !(once && bar === NB - 1)) pageTurn(t, B.next, beat);
    // --- event stings, quantised to the beat
    if (step % 2 === 0) for (let i = stings.length - 1; i >= 0; i--) {
      const s = stings[i];
      if (t >= s.notBefore) { stings.splice(i, 1); if (t - s.notBefore < 1.2) playSting(s.kind, t, B); }
    }
  }
  function musicPump(t) {
    const until = t + AUDIO.musicAhead;
    if (mus.nextT < t - 0.05) mus.nextT = t + 0.03;                       // fell behind (tab away / paused): no backlog
    while (mus.nextT < until && !mus.done) {
      if (mus.step === 0) {
        if (mus.bar >= NB) { if (once) { mus.done = true; logCue('end', mus.nextT); break; } mus.bar = 0; mus.loops++; logCue('loop', mus.nextT); }
        try { barStart(mus.bar, mus.nextT); } catch (err) { console.warn('[audio] music', err); }
      }
      let beat = 60 / mus.bpm;
      if (once && mus.bar >= NB - 2) beat *= 1 + 0.16 * ((mus.bar - NB + 2) * 6 + mus.step) / 12;    // the standalone track's ritardando
      try { musicStep(mus.bar, mus.step, mus.nextT, beat); } catch (err) { console.warn('[audio] music', err); }
      mus.nextT += beat / 2;
      if (++mus.step === 6) { mus.step = 0; mus.bar++; }
    }
  }
  // pre-render the instrument buffers a few per tick while idle, so no strum ever pays for a Karplus-Strong loop
  let warmQ = null;
  function warm() {
    if (!ac || !N || !musicOn) return;
    if (!warmQ) { warmQ = []; for (let m = 57; m <= 72; m++) warmQ.push(['uke', m]); for (let m = 28; m <= 47; m++) warmQ.push(['bass', m]); for (let m = 64; m <= 90; m++) warmQ.push(['cel', m]); for (let m = 72; m <= 100; m++) warmQ.push(['glk', m]); }
    const t0 = performance.now();
    while (warmQ.length && performance.now() - t0 < 2) { const [k, m] = warmQ.shift(); if (k === 'glk') glk(m); else if (k === 'cel') cel(m); else ks(m, k); }
  }
  function setMusic(on) {
    const was = musicOn; musicOn = !!on;
    if (!ac || !N) return;
    if (musicOn && !was) { mus.bar = opts.bgmFrom || 0; mus.step = 0; mus.done = false; mus.nextT = now() + 0.1; caption('music'); logCue('music', now(), { on: true }); }
    if (!musicOn && was) { glide(N.musLvl.gain, 0, now(), 0.3); for (const k in N.lv) glide(N.lv[k].gain, 0, now() + 0.9, 0.2); logCue('music', now(), { on: false }); }
  }

  // ------------------------------------------------------------------ rig events → sim-time cues
  const CUES = {
    bell: [[AUDIO.bellStrikes[0], bell]],
    hop: [[HOP.takeoff - 0.09, hup], [HOP.takeoff, (at) => { boing(at); ramp(N.tyreGate.gain, 0, at, 0.03); whoosh(at, HOP.land - HOP.takeoff, 400, 900, 0.025); }],
      [HOP.land, (at) => { thump(at); ramp(N.tyreGate.gain, 1, at, 0.02); }], [HOP.land + 0.04, oof], [HOP.land + 0.4, (at) => { if (R() < 0.35) giggle(at); }]],
    wave: [[0, waveSeq]],
    gulp: [[0, gulpSeq]],
  };
  function ingest(e) {
    if (!e || !CUES[e.type]) return;
    const key = e.type + ':' + e.t0; if (seen.has(key)) return; seen.add(key); if (seen.size > 200) seen.delete(seen.values().next().value);
    const last = lastAcc[e.type];
    if (last !== undefined && e.t0 >= last && e.t0 - last < GAP[e.type]) return;       // the rig ignores it too
    lastAcc[e.type] = e.t0;
    if (e.type === 'hop') { hops.push(e.t0); if (hops.length > 8) hops.shift(); }
    for (const [tau, fn] of CUES[e.type]) cues.push({ at: e.t0 + tau, fn, t0: e.t0 });
    duckUntil = Math.max(duckUntil, now() + (EV_DUR[e.type] || 1));
  }
  const latencyComp = () => (offline || opts.clock ? 0 : clamp(0.016 - (ac.outputLatency || ac.baseLatency || 0), -0.05, 0.03));
  function flushCues(frameT) {
    const nowA = now(), comp = latencyComp();
    for (let i = cues.length - 1; i >= 0; i--) {
      const c = cues[i];
      if (c.t0 > frameT + 1) { cues.splice(i, 1); continue; }                        // sim time jumped back
      if (c.at <= frameT + AUDIO.lookahead) {
        cues.splice(i, 1);
        const late = frameT - c.at;
        if (late > 0.25) continue;                                                  // stale (tab was away)
        try { c.fn(Math.max(nowA, nowA + (c.at - frameT) + comp)); } catch (err) { console.warn('[audio] cue', err); }
      }
    }
  }
  // director encounters → far sounds (thresholds in director "u" = seconds at 60 rpm since the mark)
  const ENC_CUES = {
    cat: [[-0.32, e => meow(now() + 0.02, 0.35)]],
    friend: [[-3.55, e => friendHonk(now() + 0.02, screenPan('[data-ref^="dir-friend"]') ?? -0.4)]],
    cyclist: [[-1.0, e => dingDing(now() + 0.02, 0.55)]],
    gulls: [[-0.4, e => gullCall(now() + 0.02, true, 0.45)], [0.95, e => gullCall(now() + 0.02, true, -0.2)]],
    fish: [[-0.1, e => splash(now() + 0.02, 0.1, 0.55, N.far)], [0.72, e => splash(now() + 0.02, 0.06, 0.2, N.far)]],
  };
  function encounters(fr) {
    const dz = fr.director; if (!dz || !dz.enc || paused) return;
    const live = new Set();
    for (const { kind, u, e } of dz.enc) {
      const key = kind + ':' + Math.round((e && e.D) || 0); live.add(key);
      const prev = encSeen.get(key); encSeen.set(key, u);
      if (prev === undefined || u < prev || u - prev > 1) continue;              // first sight / jump: no retro cues
      for (const [thr, fn] of ENC_CUES[kind] || []) if (prev < thr && u >= thr) { try { fn(e); } catch (err) { console.warn('[audio] enc', err); } }
      if (kind === 'fireworks' && (fr.pal && fr.pal.num ? fr.pal.num.lampOn : night) > 0.3 && u > 0) {
        for (let i = 0; i < 4; i++) {       // the same burst clock as director.js: burst i flashes at cyc 0.08
          const n = Math.floor(fr.t / 1.9 + i * 0.27 - 0.08) + 1, tb = (n + 0.08 - i * 0.27) * 1.9, fk = n * 4 + i;
          if (tb - fr.t < AUDIO.lookahead + 0.02 && tb >= fr.t && !fwSeen.has(fk)) {
            fwSeen.add(fk); if (fwSeen.size > 64) fwSeen.delete(fwSeen.values().next().value);
            const x = 220 + hash(fk, 7) * 1200;
            firework(now() + (tb - fr.t) + 0.35, clamp(x / 800 - 1, -0.9, 0.9));       // sound arrives after the flash
            if (i === 0 && R() < 0.3) caption('fireworks');
          }
        }
      }
      if (kind === 'fireworks' && u > 0 && u < 0.2 && prev <= 0) logCue('fireworks', now());
    }
    for (const k of encSeen.keys()) if (!live.has(k)) encSeen.delete(k);
  }

  // ------------------------------------------------------------------ scheduler (audio time)
  function pump() {
    if (!ac || !N) return;
    const t = now(), until = t + AUDIO.lookahead;
    if (tickOn && tickRate > 1 && !paused) {
      if (nextTick < t) nextTick = t + 0.004;
      while (nextTick < until) { tick(nextTick); nextTick += 1 / tickRate; }
    } else nextTick = 0;
    if (!paused) musicPump(t); else mus.nextT = t + 0.05;
    const A = amb(), day = night < 0.45 && (wx.rain || 0) < 0.3, wind = wx.wind ?? 0.3;
    if (nextSwell < until) {                     // lapping waves (and, rarely, a bigger swell with foam)
      const s = Math.max(nextSwell, t), k = A.lap || 0.15;
      if (R() < 0.12) { const D = swell(s); nextSwell = s + D * rr(0.5, 0.8); } else nextSwell = s + lapWave(s, k) * rr(0.8, 1.3) + rr(0.3, 1.6) / (0.4 + k);
    }
    if (nextKids < until) { const s = Math.max(nextKids, t); if (!paused && day && A.kids) kids(s); nextKids = s + rr(14, 30) / Math.max(0.4, A.kids || 0.4); }
    if (nextTrain < until) { const s = Math.max(nextTrain, t); if (!paused && A.train && night < 0.7) { steamTrain(s); nextTrain = s + rr(70, 120); } else nextTrain = s + 2; }
    if (nextChime < until) {                     // wind chimes, more of them in the breeze
      const s = Math.max(nextChime, t), w = (A.chimes || 0) * (0.25 + wind) + (wind > 0.55 ? 0.5 : 0);
      if (!paused && w > 0.05) chimes(s, 2 + Math.floor(R() * 4 * Math.min(1, w)));
      nextChime = s + rr(5, 12) / Math.max(0.12, w);
    }
    if (nextCreak < until) { const s = Math.max(nextCreak, t); if (!paused && A.creak) creak(s); nextCreak = s + rr(7, 16) / Math.max(0.5, A.creak || 0.5); }
    glide(N.riverG.gain, A.river ? 0.05 : 0, t, 2);
    if (nextGull < until) {
      const s = Math.max(nextGull, t);
      if (gullsOn && night < 0.55 && !paused && (wx.rain || 0) < 0.5) gullCall(s);
      nextGull = s + (cadence > CADENCE.sprint - 6 ? rr(6, 12) : rr(11, 26));
    }
    const rain = wx.rain || 0;
    if (rain > 0.05 && nextDrop < until) {       // sparse, soft drops (plinks) on top of the rain bed
      const s = Math.max(nextDrop, t); if (!paused) plop(s, rr(480, 950), 0.03 * rain, rr(-0.8, 0.8));      // puddle plops
      nextDrop = s + rr(0.08, 0.45) / (0.3 + rain);
    } else if (rain <= 0.05) nextDrop = t + 0.2;
    if (rain > 0.25 && nextTink < until) {      // rain on a tin roof: soft little ticks
      const s = Math.max(nextTink, t); if (!paused) tink(s, 0.016 * rain * rr(0.5, 1), rr(-0.7, 0.7));
      nextTink = s + rr(0.03, 0.14) / rain;
    } else if (rain <= 0.25) nextTink = t + 0.1;
    if (nextGrunt < until) {                     // the odd contented "hm-hm", and effort grunts in a sprint
      const s = Math.max(nextGrunt, t), sprint = cadence > CADENCE.sprint - 2 && !coasting;
      if (!paused && s > voiceUntil + 1 && !mus.crooning) { if (night > 0.6 && R() < 0.4) yawn(s); else grunt(s, sprint ? 'effort' : 'content'); }
      nextGrunt = s + (sprint ? rr(5, 10) : rr(28, 55));
    }
    const fog = wx.fog || 0;
    if (night > 0.6 || fog > 0.45) {
      if (!nightOn) { nightOn = true; nextHorn = t + rr(6, 14); }
      if (nextHorn < until) { const s = Math.max(nextHorn, t); if (!paused) fogHorn(s); nextHorn = s + rr(45, 85); }
      if (night > 0.6 && nextCricket < until) { const s = Math.max(nextCricket, t); const d = cricket(s, rr(4300, 4900), 3 + Math.floor(R() * 6), rr(-0.9, 0.9)); nextCricket = s + d + rr(0.8, 5); }
      if (night > 0.6 && nextOwl < until) { const s = Math.max(nextOwl, t); if (!paused) owl(s); nextOwl = s + rr(40, 80); }
    } else {
      nightOn = false;
      if (nextBoat < until) { const s = Math.max(nextBoat, t); if (!paused && night < 0.3) boatHorn(s); nextBoat = s + rr(70, 140); }
    }
  }

  // ------------------------------------------------------------------ continuous controls (≈20 Hz)
  function controls(fr) {
    const t = now();
    const s = clamp(fr.speed / V_MAX, 0, 1.2); speedN = s; cadence = fr.cadence;
    wx = fr.weather || {};
    const wind = wx.wind ?? 0.3, calm = 0.55 + 0.7 * wind;
    // calm wind: a slow random walk (the C edition's gusts were fast; the storybook breathes)
    gustV += (R() - 0.5) * 0.03 - (gust - 1) * 0.02; gustV *= 0.95; gust = clamp(gust + gustV, 0.7, 1.4);
    const hold = hops.some(h0 => fr.t - h0 >= HOP.hold0 && fr.t - h0 < HOP.hold1);
    const pedal = !fr.coasting && !hold && fr.cadence > 1;
    glide(N.windG.gain, (0.06 + 0.62 * s * s) * gust * calm, t, 0.6);
    glide(N.windBp.frequency, 260 + 700 * s + 160 * (gust - 1), t, 0.8);
    glide(N.whisG.gain, 0.025 * Math.max(0, gust - 1.15) * s * calm, t, 0.8);
    glide(N.whisBp.frequency, 1000 + 400 * s + 250 * (gust - 1), t, 0.8);
    glide(N.roadG.gain, 0.24 * s * (1 + 0.4 * (wx.wet || 0)), t, 0.2); glide(N.roadLp.frequency, 220 + 480 * s + 500 * (wx.wet || 0), t, 0.3);
    glide(N.gritG.gain, 0.022 * s * (1 + 1.5 * (wx.wet || 0)), t, 0.2);
    glide(N.chG.gain, pedal ? 0.09 * (0.45 + s) : 0, t, 0.05);
    glide(N.humG.gain, pedal ? 0.07 * (0.3 + s) : 0, t, 0.05);
    glide(N.chOsc.frequency, Math.max(1, (fr.cadence / 60) * AUDIO.teeth), t, 0.05);
    glide(N.humOsc.frequency, Math.max(0.5, (fr.cadence / 60) * 2), t, 0.05);         // two pedal strokes per turn
    glide(N.chBp.frequency, 2100 + 800 * s, t, 0.1);
    glide(N.tickBus.gain, 0.36 * (0.6 + 0.5 * Math.min(1, s)), t, 0.1);
    glide(N.seaG.gain, 0.085 + 0.03 * night, t, 1);
    glide(N.rainG.gain, 0.16 * (wx.rain || 0), t, 0.8);
    for (const src of [N.windSrc, N.roadSrc]) glide(src.playbackRate, 0.94 + 0.12 * R(), t, 2.5);   // no audible loop
    night = fr.night || 0;
    const pg = (wx.stretch || '') + (night > 0.5 ? ':n' : ':d');
    if (pg !== lastPage) {                       // the story turns a page and writes its new line
      if (lastPage !== null && !paused && wantOn) { paperRustle(t + 0.03); pencil(t + 0.7, rr(0.9, 1.3)); }
      lastPage = pg;
    }
    if (night > 0.6 && !yawned && lastStretch !== null && !paused) { yawned = true; yawn(t + rr(1.5, 3)); }
    if (night < 0.4) yawned = false;
    lastStretch = wx.stretch || '';
    gullsOn = !fr.toggles || fr.toggles.gulls !== false;
    reduced = !!fr.reduced;
    // coasting croon: starts ~0.6 s into a coast, stops on the first pedal stroke or when the pelican talks
    if (fr.coasting && !coasting) coastSince = t;
    coasting = !!fr.coasting;
    const croon = coasting && !hold && t - coastSince > 0.6 && t > voiceUntil + 0.3 && !paused;
    if (croon && !mus.crooning) { logCue('hum', t); caption('hum'); }
    if (!croon && mus.crooning) croonStop(t);
    mus.crooning = croon;
    // music duck: events (rig + voice) and nearby gags
    let near = false; const dz = fr.director;
    if (dz && dz.enc) for (const { kind, u } of dz.enc) if (kind !== 'kites' && kind !== 'fireworks' && u > -1.5 && u < 2) near = true;
    const vz = solo && !solo.has('voice') ? 0 : voiceUntil;                // a muted voice never ducks (analysis renders)
    const dk = t < duckUntil ? 0.6 : t < vz ? 0.72 : near ? 0.85 : 1;      // −4.4 / −2.9 / −1.4 dB
    glide(N.musDuck.gain, dk, t, dk < 1 ? 0.08 : 0.5);
    // music toggle (ui:toggle key music → state.toggles.music); opts.music / setMusic() win when given
    const want = musicWant !== null ? musicWant : !!(fr.toggles && fr.toggles.music === true);
    if (want !== musicOn) setMusic(want);
  }

  function applyMaster(force) {
    if (!ac || !N) return;
    const target = wantOn && !paused && !hidden ? vol : 0;
    if (!force && Math.abs(target - masterTarget) < 1e-4) return;
    const dur = target > masterTarget ? AUDIO.fadeIn : hidden ? AUDIO.hideFade : paused ? AUDIO.pauseFade : AUDIO.fadeOut;
    masterTarget = target;
    ramp(N.master.gain, target, now(), dur);
  }

  let visHandler = null;
  function onVisibility() {
    hidden = document.visibilityState === 'hidden';
    if (!ac) return;
    if (hidden) { applyMaster(); setTimeout(() => { if (hidden && ac.state === 'running') ac.suspend().catch(() => {}); }, AUDIO.hideSuspendMs); }
    else if (wantOn) { ac.resume().then(() => { lastLive = performance.now(); applyMaster(); }).catch(() => {}); }
  }

  // ------------------------------------------------------------------ bus
  bus.on('rig:event', e => { if (ac) ingest(e); });
  bus.on('ui:play', ({ on } = {}) => { if (!ac) return; if (on === false) { paused = true; applyMaster(); } else if (on === true) { paused = false; lastLive = performance.now(); applyMaster(); } });
  bus.on('ui:volume', ({ value } = {}) => api.setVolume(value));
  bus.on('ui:toggle', ({ key, value } = {}) => { if (key === 'music') { musicWant = !!value; if (ac && N) setMusic(musicWant); } });
  bus.on('ui:music', ({ on } = {}) => { musicWant = !!on; if (ac && N) setMusic(musicWant); });
  bus.on('egg:found', ({ id } = {}) => { if (!ac || !N || !id || paused) return; duckUntil = Math.max(duckUntil, now() + 2.4); const B = musicOn && mus.info; musicBox(now() + 0.03, B && B.key === 'Bb' ? 89 : 84); });

  const api = {
    async enable() {
      wantOn = true;
      if (!ac) {
        try {
          const AC = opts.context ? null : (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext));
          if (!opts.context && !AC) { wantOn = false; bus.emit('audio:unavailable', {}); return false; }
          ac = opts.context || new AC({ latencyHint: 'interactive' });
          build();
          if (musicWant) setMusic(true);
        } catch (err) { console.warn('[audio] WebAudio unavailable', err); ac = null; N = null; wantOn = false; bus.emit('audio:unavailable', {}); return false; }
        if (hasDoc && !offline) { visHandler = onVisibility; document.addEventListener('visibilitychange', visHandler); hidden = document.visibilityState === 'hidden'; }
      }
      paused = false; lastLive = typeof performance !== 'undefined' ? performance.now() : 0;
      if (!offline && !timer) timer = setInterval(() => {
        if (wantOn && !paused && !hidden && performance.now() - lastLive > 250) { paused = true; applyMaster(); }   // rAF stopped: sim paused
        pump();
        warm();
      }, AUDIO.interval);
      applyMaster(true);
      if (!offline && ac.state !== 'running' && !hidden) { try { await ac.resume(); } catch { /* gesture policy */ } }
      return true;
    },
    disable() {
      wantOn = false;
      if (!ac) return;
      applyMaster();
      if (offline) return;
      setTimeout(() => { if (!wantOn && ac.state === 'running') { ac.suspend().catch(() => {}); clearInterval(timer); timer = 0; } }, AUDIO.fadeOut * 1000 + 120);
    },
    update(frame) {
      if (!ac || !N || !frame) return;
      lastFrame = frame; simT = frame.t;
      const live = frame.dt > 0;
      if (frame.events) for (const e of frame.events) ingest(e);
      if (!live) return;                                                  // renderAt(): deterministic stills, no sound
      if (!offline) { lastLive = performance.now(); if (paused) { paused = false; applyMaster(); } }
      const hold = hops.some(h0 => frame.t - h0 >= HOP.hold0 && frame.t - h0 < HOP.hold1);
      tickOn = !!frame.coasting || hold;
      tickRate = (frame.speed / WHEEL_C) * AUDIO.pawls;
      const t = now();
      if (lastCtl < 0 || t - lastCtl >= 0.05 || t < lastCtl) { lastCtl = t; controls(frame); }
      flushCues(frame.t);
      encounters(frame);
      if (offline || opts.clock) pump();
    },
    setVolume(v) { if (typeof v !== 'number' || !isFinite(v)) return; vol = clamp(v, 0, 1); applyMaster(); },
    setMusic(on) { musicWant = !!on; if (ac && N) setMusic(musicWant); },
    // tests / judge: scheduled cue log (kind, audio time, pan), context state, tick rate, the music clock
    debug: () => ({ state: ac ? ac.state : 'none', log: log.slice(), tickRate, tickOn, masterTarget, paused, hidden, pawls: AUDIO.pawls, simT, hasFrame: !!lastFrame,
      music: { on: musicOn, bar: mus.bar, step: mus.step, bpm: +mus.bpm.toFixed(2), mode: mus.mode, section: mus.info ? mus.info.sec : null, chords: mus.info ? mus.info.ch.name : null, loops: mus.loops, done: mus.done, crooning: mus.crooning } }),
    get context() { return ac; },
  };
  return api;
}
