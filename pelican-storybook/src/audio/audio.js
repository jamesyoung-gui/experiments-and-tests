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
// Music (docs/AUDIO.md): a composed 32-bar AA'BA'' tune in F major on an 8th-note lookahead clock (200 ms ahead).
//       Karplus-Strong ukulele + upright bass, additive glockenspiel, a whistled lead, brushes and a felt kick.
//       Tempo = cadence quantised to a ladder of musical tempi, one rung per bar with an accelerando inside the bar.
//       Arrangement per bar from time of day and weather (sun / soft / rain (minor-tinged) / lullaby). It ducks under
//       events, and event "stings" land on the next beat. While coasting, the pelican hums the melody.
import { TIMING } from '../rig/solve.js';
import { BIKE, DIST_PER_REV, CADENCE } from '../contract.js';
import { hash } from '../world/route.js';

export const AUDIO = {
  pawls: 18,                 // freehub engagement points (coast tick rate = wheel rev/s × pawls)
  teeth: BIKE.ringT,         // chain whirr AM rate = crank rev/s × chainring teeth
  lookahead: 0.12, musicAhead: 0.2, interval: 25,
  fadeIn: 0.6, fadeOut: 0.45, pauseFade: 0.4, hideFade: 0.08, hideSuspendMs: 100,
  bellStrikes: [TIMING.bell.strike, TIMING.bell.strike + 0.105],
  tempi: [60, 66, 72, 80, 88, 96, 104, 112],   // the tempo ladder (bpm): cadence snaps to a rung
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
  bell: ['[bell rings]', '[车铃叮铃]'], land: ['[thump]', '[咚]'], gulp: ['[gulp]', '[咕嘟]'],
  gull: ['[gulls call]', '[海鸥鸣叫]'], horn: ['[distant fog horn]', '[远处雾笛]'], boat: ['[ship\'s horn]', '[轮船汽笛]'],
  hup: ['[pelican: “hup!”]', '[鹈鹕：“嘿哟！”]'], honk: ['[pelican honks hello]', '[鹈鹕嘎嘎打招呼]'],
  burp: ['[a small, satisfied burp]', '[心满意足的小饱嗝]'], hum: ['[pelican hums the tune]', '[鹈鹕哼着小曲]'],
  meow: ['[cat: meow!]', '[猫：喵！]'], friend: ['[a friendly honk overhead]', '[头顶传来友好的嘎嘎声]'],
  fireworks: ['[soft distant fireworks]', '[远处轻轻的烟花声]'], owl: ['[an owl hoots]', '[猫头鹰咕咕]'],
  ding: ['[a passing bell]', '[对面车铃叮叮]'], music: ['[♪ a bedtime tune]', '[♪ 睡前小曲]'],
};

function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ======================================================================================== the score (docs/AUDIO.md)
// F major, 4/4, 8th-note grid (8 steps per bar). Melody tokens: <note>:<eighths>, r = rest.
const PC = { C: 0, Db: 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };
const CHORD = {              // pitch classes, root first; bass = slash-chord bass
  F: [5, 9, 0], Dm: [2, 5, 9], Bb: [10, 2, 5], C: [0, 4, 7], C7: [0, 4, 7, 10], Am: [9, 0, 4], Gm: [7, 10, 2],
  Bbm: [10, 1, 5], D7: [2, 6, 9, 0], 'F/A': [5, 9, 0],
};
const BASS = { 'F/A': 9 };
const COLOR = { F: 4, Dm: 0, Bb: 9, C: 2, Am: 7, Gm: 5, C7: 2, D7: 4 };   // lullaby colour tones (maj7 / m7 / add9)
export const SONG = [
  { name: 'A', chords: ['F', 'Dm', 'Bb', 'C', 'F', 'Am', 'Bb C', 'F'],
    mel: ['C5:3 A4:1 F4:2 A4:2', 'D5:3 C5:1 A4:4', 'Bb4:2 D5:2 F5:3 D5:1', 'C5:6 r:2', 'C5:3 A4:1 F4:2 A4:2', 'E5:3 D5:1 C5:2 A4:2', 'Bb4:2 D5:2 C5:2 E4:2', 'F4:6 r:2'] },
  { name: "A'", chords: ['F', 'Dm', 'Gm', 'C7', 'F', 'Am', 'Bb C7', 'F'],
    mel: ['A4:2 C5:2 F5:3 E5:1', 'D5:2 F5:2 A5:3 G5:1', 'G5:3 F5:1 D5:2 Bb4:2', 'C5:4 E5:2 G5:2', 'A5:3 G5:1 F5:2 C5:2', 'E5:2 G5:2 E5:2 C5:2', 'D5:2 Bb4:2 C5:2 E5:2', 'F5:6 r:2'] },
  { name: 'B', chords: ['Bb', 'C', 'Am', 'Dm', 'Gm', 'C', 'F/A Bb', 'C7'],
    mel: ['F5:3 D5:1 Bb4:4', 'G5:3 E5:1 C5:4', 'A5:2 G5:2 E5:2 C5:2', 'D5:6 r:2', 'Bb4:2 D5:2 G5:3 F5:1', 'E5:2 G5:2 C5:4', 'A4:2 C5:2 D5:2 F5:2', 'E5:3 D5:1 C5:2 Bb4:2'] },
  { name: "A''", chords: ['F', 'Dm', 'Bb', 'C', 'Dm', 'Bb', 'C7', 'F'],
    mel: ['C5:3 A4:1 F4:2 A4:2', 'D5:3 C5:1 A4:2 F5:2', 'F5:3 D5:1 Bb4:2 D5:2', 'C5:4 G4:2 C5:2', 'D5:2 F5:2 A5:2 F5:2', 'G5:2 F5:2 D5:2 Bb4:2', 'G5:2 E5:2 C5:2 E5:2', 'F5:6 r:2'] },
];
const LIFT_B8 = { chord: 'D7', mel: 'F#5:3 E5:1 D5:2 C5:2' };   // odd verses: pivot to G major for the last A''
const INTRO = ['C7'];                 // a one-bar vamp on the dominant before 'once upon a time'
const noteNum = s => { const m = /^([A-G](?:b|#)?)(-?\d)$/.exec(s); return m ? PC[m[1]] + 12 * (+m[2] + 1) : null; };
const parseBar = str => { let s = 0; const out = []; for (const tok of str.trim().split(/\s+/)) { const [n, d] = tok.split(':'); const dd = +d; if (n !== 'r') out.push({ s, d: dd, m: noteNum(n) }); s += dd; } return out; };
const SONG_P = SONG.map(sec => ({ ...sec, notes: sec.mel.map(parseBar), ch: sec.chords.map(c => c.split(' ')) }));
const LIFT_P = parseBar(LIFT_B8.mel);
export const SONG_BARS = SONG.length * 8;

export function createAudio(bus, opts = {}) {
  const offline = !!(opts.context && typeof opts.context.startRendering === 'function');
  const R = mulberry(opts.seed ?? ((Date.now() ^ 0x9e3779b9) >>> 0));
  const rr = (a, b) => a + (b - a) * R();
  const solo = opts.solo ? new Set(opts.solo) : null;
  const hasDoc = typeof document !== 'undefined';
  let ac = null, N = null, timer = 0, wantOn = false, paused = false, hidden = false, vol = clamp(opts.volume ?? 0.8, 0, 1);
  let masterTarget = -1, lastLive = 0, lastCtl = -1, simT = 0, lastFrame = null;
  let tickOn = false, tickRate = 0, nextTick = 0, tickN = 0;
  let nextSwell = 0, nextGull = 0, nextHorn = 0, nextBoat = 0, nextCricket = 0, nextOwl = 0, nextGrunt = 0, nextDrop = 0, nightOn = false;
  let gust = 1, gustV = 0, gullsOn = true, night = 0, speedN = 0.5, cadence = 60, coasting = false, coastSince = 0;
  let wx = {}, musicWant = opts.music === true ? true : null, musicOn = false, duckUntil = 0, voiceUntil = 0, reduced = false;
  const seen = new Set(), lastAcc = {}, cues = [], hops = [], log = [], stings = [], encSeen = new Map(), fwSeen = new Set();
  const now = () => (opts.clock ? opts.clock() : ac.currentTime);
  const logCue = (kind, at, extra) => { log.push({ kind, at: +at.toFixed(4), ...extra }); if (log.length > 400) log.shift(); };
  const caption = k => { if (CAPTION[k]) bus.emit('audio:caption', { kind: k, en: CAPTION[k][0], zh: CAPTION[k][1] }); };

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
  function clickBuf(f1, f2, f3) {  // freewheel pawl snap: three damped modes + a grain of noise (softened)
    const sr = ac.sampleRate, n = Math.floor(0.008 * sr), buf = ac.createBuffer(1, n, sr), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      d[i] = (0.6 * Math.sin(TAU * f1 * t) * Math.exp(-t / 0.0011) + 0.3 * Math.sin(TAU * f2 * t) * Math.exp(-t / 0.0006) +
        0.15 * Math.sin(TAU * f3 * t) * Math.exp(-t / 0.0012) + (R() * 2 - 1) * 0.18 * Math.exp(-t / 0.0002)) * Math.min(1, i / 10) * (1 - i / n);
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
    const warm = F('highshelf', 6500, 0.7); warm.gain.value = -4;            // storybook softness: a gentle top roll-off
    wire(master, hpf, warm, comp, lim, out, ac.destination);
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
    const rainSrc = bufSrc(pinkB, true, 1.31), rainHp = F('highpass', 900, 0.5), rainLp = F('lowpass', 5200, 0.5), rainG = G(0);
    wire(rainSrc, rainHp, rainLp, rainG, amb);
    // chain whirr: band noise amplitude-modulated at the tooth-engagement rate, plus a low roller hum
    const chSrc = bufSrc(whiteB, true, 1.07), chBp = F('bandpass', 2400, 1.3), chAM = G(0.55), chG = G(0), chPan = Pan(-0.12);
    const chOsc = O('sine', 48), chDepth = G(0.45);
    wire(chOsc, chDepth); chDepth.connect(chAM.gain);
    wire(chSrc, chBp, chAM, chG, chPan, mech);
    const humSrc = bufSrc(pinkB, true, 0.95), humBp = F('bandpass', 620, 3), humAM = G(0.6), humG = G(0);
    const humOsc = O('sine', 2), humDepth = G(0.4); wire(humOsc, humDepth); humDepth.connect(humAM.gain);
    wire(humSrc, humBp, humAM, humG, chPan);
    // freewheel ticks (a soft wooden-ish tick: lowpassed)
    const tickBus = G(1), tickLp = F('lowpass', 4600, 0.6), tickPan = Pan(-0.22); wire(tickBus, tickLp, tickPan, mech);
    const clicks = [clickBuf(2950, 4700, 6900), clickBuf(3120, 4490, 7150), clickBuf(2850, 4960, 6700)];
    const pawlAmp = Array.from({ length: AUDIO.pawls }, (_, i) => 0.82 + 0.18 * Math.sin(i * 2.4) * Math.cos(i * 0.7) + 0.08 * R());

    // the pelican's voice bus + the coasting croon (a persistent formant voice that follows the melody)
    const vPan = Pan(0.08); wire(vPan, voice); const vSend = G(0.14); vPan.connect(vSend); vSend.connect(vin.voice);
    const crOsc = O('sawtooth', 175), crLp = F('lowpass', 1400, 0.5), crF1 = F('bandpass', 270, 3.2), crF2 = F('bandpass', 1050, 6), crF2g = G(0.22), crSum = G(2.2), crG = G(0);
    const crVib = O('sine', 5.1), crVibG = G(0); wire(crVib, crVibG); crVibG.connect(crOsc.frequency);
    wire(crOsc, crLp); crLp.connect(crF1); wire(crLp, crF2, crF2g, crSum); crF1.connect(crSum); wire(crSum, crG, vPan);

    // music: instrument buses → musIn → duck → level → music bus (+ plate send)
    const musIn = G(1), musHp = F('highpass', 55, 0.6), musDuck = G(1), musLvl = G(0);
    wire(musIn, musHp, musDuck, musLvl, music); const musSend = G(0.22); musLvl.connect(musSend); musSend.connect(vin.music);
    const inst = (pan, lpF) => { const p = Pan(pan); if (lpF) { const lp = F('lowpass', lpF, 0.6); wire(lp, p, musIn); return { in: lp, g: null }; } p.connect(musIn); return { in: p }; };
    const ukeI = inst(-0.28, 3600), melI = inst(0.05, 4200), bassI = inst(0.02, 900), glkI = inst(0.32, 0), whiI = inst(0.12, 0), drI = inst(-0.08, 0);
    const lv = {}; for (const [k, i] of Object.entries({ uke: ukeI, mel: melI, bass: bassI, glk: glkI, whi: whiI, dr: drI })) { lv[k] = G(0); lv[k].connect(i.in); }

    const t0 = now();
    for (const s of [windSrc, roadSrc, gritSrc, seaSrc, rainSrc, chSrc, humSrc]) s.start(t0, R() * 5);
    chOsc.start(t0); humOsc.start(t0); crOsc.start(t0); crVib.start(t0);
    N = { master, amb, mech, fx, far, voice, music, verb, vin, duck, windSrc, windBp, windG, whisBp, whisG, roadSrc, roadLp, roadG, tyreGate, gritG, seaG, seaLp,
      rainG, chOsc, chG, chBp, humOsc, humG, tickBus, clicks, pawlAmp, pinkB, brownB, whiteB,
      vPan, crOsc, crF1, crG, crVibG, musDuck, musLvl, lv };
    nextSwell = t0 + 0.4; nextGull = t0 + rr(4, 8); nextHorn = t0 + rr(6, 14); nextBoat = t0 + rr(30, 70); nextCricket = t0 + rr(1, 3);
    nextOwl = t0 + rr(15, 30); nextGrunt = t0 + rr(18, 35); nextDrop = t0 + 0.2;
    mus.nextT = t0 + 0.15; mus.bar = -INTRO.length; mus.step = 0;
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
    bellStrike(at, 1, pan); bellStrike(at + (AUDIO.bellStrikes[1] - AUDIO.bellStrikes[0]), 0.72, pan);
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
    bubble(at + T.swallow[0] + 0.06, 190, 560, 0.1, 0.3);
    bubble(at + T.swallow[0] + 0.24, 260, 780, 0.09, 0.24);
    bubble(at + T.swallow[0] + 0.44, 340, 640, 0.07, 0.11);
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
    honk(at + T.wave[0] + 0.02, 1); honk(at + T.wave[0] + 0.3, 1.12);
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
    const escort = cadence > 85, near = forceNear || (escort && R() < 0.6);
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
    const save = N.fx; N.fx = N.far;
    try { bellStrike(at, 0.6, pan, 2890, 0.06); bellStrike(at + 0.16, 0.5, pan, 2890, 0.06); } finally { N.fx = save; }
    logCue('ding', at, { pan }); caption('ding');
  }

  // ================================================================== the pelican's voice (formant synthesis)
  // Vowels as three formants (Hz); a cartoon bird is a small resonator: formants ×1.1 over an adult voice.
  const VOW = { u: [330, 820, 2300], o: [480, 860, 2600], a: [760, 1180, 2500], uh: [620, 1150, 2450], e: [520, 1800, 2520], i: [300, 2250, 2950], m: [260, 1050, 2300], n: [280, 1700, 2600] };
  const FGAIN = { m: [1, 0.12, 0.04], n: [1, 0.18, 0.06] };
  // spec: { dur, f0: [[t, Hz]…], vow: [[t, 'a']…], amp, breath 0..1, h (aspirated onset s), rough 0..1, src, pan, dest, shift, stop }
  function vox(at, sp) {
    const dur = sp.dur, dest = sp.dest || N.vPan, shift = sp.shift || 1.1;
    const src = O(sp.src || 'sawtooth', sp.f0[0][1]), sg = G(1), lp = F('lowpass', 3200, 0.5), sum = G(1), env = G(0), pn = sp.pan != null ? Pan(sp.pan) : null;
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
    voiceUntil = Math.max(voiceUntil, at + dur);
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
  function giggle(at) {     // "heh-heh" (shy)
    for (let i = 0; i < 2; i++) vox(at + i * 0.13, { dur: 0.08, f0: [[0, 330 - i * 20], [0.08, 300 - i * 20]], vow: [[0, 'e']], amp: 0.07, h: 0.03, breath: 0.3 });
  }
  function grunt(at, kind) {
    if (kind === 'effort') vox(at, { dur: 0.13, f0: [[0, 150], [0.13, 132]], vow: [[0, 'uh'], [0.1, 'n']], amp: 0.08, h: 0.03, breath: 0.35, attack: 0.015 });
    else {                   // contented "hm-hm" on a falling third
      vox(at, { dur: 0.14, f0: [[0, 240], [0.14, 245]], vow: [[0, 'm']], amp: 0.09 });
      vox(at + 0.19, { dur: 0.2, f0: [[0, 205], [0.2, 190]], vow: [[0, 'm']], amp: 0.08 });
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

  // ================================================================== music
  const mus = { bar: -1, step: 0, nextT: 0, bpm: 84, bpm0: 84, bpm1: 84, arr: null, strings: [], lastMode: '', started: false, crooning: false, lastRoot: 41 };
  function rung(raw, cur) {             // snap to the tempo ladder with hysteresis (±35 % of a rung)
    const L = AUDIO.tempi; let best = L[0];
    for (const v of L) if (Math.abs(v - raw) < Math.abs(best - raw)) best = v;
    const i = L.indexOf(cur);
    if (i >= 0 && best !== cur) { const gap = best > cur ? (L[i + 1] ?? cur) - cur : cur - (L[i - 1] ?? cur); if (Math.abs(raw - cur) < gap * 0.85) return cur; }
    return best;
  }
  function tempoTarget() {
    let raw = 58 + 0.5 * cadence;
    if (night > 0.6) raw *= 0.86; else if (night > 0.3) raw *= 0.94;
    if ((wx.rain || 0) > 0.3) raw *= 0.94;
    return rung(clamp(raw, 60, 116), mus.bpm1);
  }
  function arrangement(bar) {
    const rain = wx.rain || 0, fog = wx.fog || 0, cloud = wx.cloud || 0;
    const mode = night > 0.6 ? 'lullaby' : rain > 0.3 ? 'rain' : (fog > 0.4 || cloud > 0.55 || night > 0.3) ? 'soft' : 'sun';
    const b = ((bar % SONG_BARS) + SONG_BARS) % SONG_BARS, sec = Math.floor(b / 8), cyc = Math.max(0, Math.floor(bar / SONG_BARS));
    const A = { mode, sec, cyc, minor: mode === 'rain', color: mode === 'lullaby', swing: mode === 'sun' ? 0.57 : mode === 'soft' ? 0.54 : 0.5 };
    if (mode === 'lullaby') Object.assign(A, { mel: 'glk', melUp: 12, pat: 'pick2', bass: 'whole', drums: 0, kick: false, glkFill: true, level: 0.8 });
    else if (mode === 'rain') Object.assign(A, { mel: 'uke', melUp: 0, pat: 'pick', bass: 'two', drums: 0.45, kick: false, glkFill: false, level: 0.72 });
    else if (mode === 'soft') Object.assign(A, { mel: cyc % 2 ? 'whi' : 'uke', melUp: 0, pat: 'pick', bass: 'two', drums: 0.55, kick: false, glkFill: true, level: 0.82 });
    else {
      const rot = [['uke', 'whi', 'uke', 'whi'], ['whi', 'uke', 'glk', 'whi']][cyc % 2];
      Object.assign(A, { mel: rot[sec], melUp: rot[sec] === 'glk' ? 12 : 0, pat: 'strum', bass: 'walk', drums: 1, kick: true, glkFill: true, dbl: sec === 3, level: 1 });
    }
    A.shaker = mode !== 'lullaby' && cadence > 86 && !coasting;
    A.lift = cyc % 2 === 1 && mode !== 'rain';                 // odd verses modulate the last A'' up a tone
    A.tr = A.lift && sec === 3 ? 2 : 0;
    A.orn = cyc >= 1;
    return A;
  }
  function barInfo(bar, A) {            // chords (per half bar) and melody of this bar, with the variations applied
    if (bar < 0) { const c = INTRO[bar + INTRO.length]; return { chords: [c, c], notes: [], intro: true }; }
    const b = ((bar % SONG_BARS) + SONG_BARS) % SONG_BARS, sec = SONG_P[Math.floor(b / 8)], bi = b % 8;
    let ch = sec.ch[bi].slice(), notes = sec.notes[bi];
    if (A.lift && sec.name === 'B' && bi === 7) { ch = [LIFT_B8.chord]; notes = LIFT_P; }
    if (ch.length === 1) ch = [ch[0], ch[0]];
    if (A.minor) {                     // rain: borrowed iv (Bb → Bbm) and I → vi in the middle of the phrase
      ch = ch.map(c => c === 'Bb' ? 'Bbm' : c);
      if (bi === 4 && ch[0] === 'F') ch = ['Dm', 'Dm'];
      notes = notes.map(n => (ch[n.s < 4 ? 0 : 1] === 'Bbm' && (n.m % 12) === 2) ? { ...n, m: n.m - 1 } : n);
    }
    return { chords: ch, notes, bi, sec: sec.name };
  }
  const chordPcs = (name, tr, color) => { const c = CHORD[name] || CHORD.F; let p = c.map(x => (x + tr) % 12); if (color && COLOR[name] != null) p = [...p, (COLOR[name] + tr) % 12]; return p; };
  const chordRoot = (name, tr) => ((BASS[name] ?? (CHORD[name] || CHORD.F)[0]) + tr) % 12;
  function voicing(pcs, lo = 55, hi = 70, max = 4) { const v = []; for (let m = lo; m <= hi; m++) if (pcs.includes(m % 12)) v.push(m); return v.slice(0, max); }
  const bassMidi = pc => 33 + ((pc - 9 + 12) % 12);

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
  function whistle(at, midi, dur, vel) {
    const f = mtof(midi), o = O('sine', f), h2 = O('sine', f * 2), h2g = G(0.06), vib = O('sine', rr(4.8, 5.6)), vg = G(0), env = G(0);
    const ns = bufSrc(N.whiteB), nb = F('bandpass', f, 6), ng = G(0.25);
    o.frequency.setValueAtTime(f * 0.975, at); o.frequency.exponentialRampToValueAtTime(f, at + 0.05);
    h2.frequency.setValueAtTime(f * 1.95, at); h2.frequency.exponentialRampToValueAtTime(f * 2, at + 0.05);
    wire(vib, vg); vg.connect(o.frequency); vg.gain.setValueAtTime(0, at); vg.gain.linearRampToValueAtTime(f * 0.007, at + Math.min(0.35, dur));
    wire(o, env); wire(h2, h2g, env); wire(ns, nb, ng, env); env.connect(N.lv.whi);
    const rel = 0.07, end = at + Math.max(0.09, dur);
    env.gain.setValueAtTime(0, at); env.gain.linearRampToValueAtTime(vel, at + 0.035); env.gain.setValueAtTime(vel * 0.85, end - rel); env.gain.linearRampToValueAtTime(0, end);
    for (const x of [o, h2, vib]) { x.start(at); x.stop(end + 0.02); }
    ns.start(at, R() * 4); ns.stop(end + 0.02);
    reap(o, [o, h2, h2g, vib, vg, env, ns, nb, ng]);
  }
  function brush(at, vel, long) {       // brush swish (long) or tap
    const s = bufSrc(N.whiteB), bp = F('bandpass', long ? 3800 : 5200, long ? 0.5 : 0.9), g = G(0); wire(s, bp, g, N.lv.dr);
    if (long) { g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vel, at + 0.06); g.gain.exponentialRampToValueAtTime(vel * 0.01, at + 0.3); g.gain.linearRampToValueAtTime(0, at + 0.32); s.start(at, R() * 5); s.stop(at + 0.34); }
    else { const e = envAD(g.gain, at, vel, 0.002, 0.045); s.start(at, R() * 5); s.stop(e); }
    reap(s, [s, bp, g]);
  }
  function kick(at, vel) {              // felt kick: a round, short thud
    const o = O('sine', 88), g = G(0); wire(o, g, N.lv.dr);
    o.frequency.setValueAtTime(88, at); o.frequency.exponentialRampToValueAtTime(46, at + 0.12);
    const e = envAD(g.gain, at, vel, 0.004, 0.2); o.start(at); o.stop(e); reap(o, [o, g]);
  }
  function shaker(at, vel) {
    const s = bufSrc(N.whiteB), hp = F('highpass', 6000, 0.7), g = G(0); wire(s, hp, g, N.lv.dr);
    const e = envAD(g.gain, at, vel, 0.008, 0.035); s.start(at, R() * 5); s.stop(e); reap(s, [s, hp, g]);
  }
  function croonNote(at, midi, dur) {    // the pelican hums the melody (legato, a lazy portamento, "mm" opening to "oo")
    const f = mtof(midi - 12);
    glide(N.crOsc.frequency, f, at - 0.01, 0.03);
    glide(N.crG.gain, 0.08, at, 0.03);
    glide(N.crG.gain, 0.035, at + Math.max(0.05, dur - 0.06), 0.03);
    glide(N.crVibG.gain, 0, at, 0.02); glide(N.crVibG.gain, f * 0.006, at + 0.18, 0.12);
    glide(N.crF1.frequency, 270, at, 0.03); if (dur > 0.5) glide(N.crF1.frequency, 360, at + 0.22, 0.12);
  }
  function croonStop(at) { glide(N.crG.gain, 0, at, 0.12); }

  function playSting(kind, at, info, A) {
    const tr = A.tr, c = info.chords[0], pcs = chordPcs(c, tr, false), top = voicing(pcs, 77, 91, 3);
    if (!top.length) return;
    if (kind === 'tada') { bell2(at, top[0], 0.9); bell2(at + 0.11, top[top.length - 1], 1); pluck(at, bassMidi(chordRoot(c, tr)), 0.7, 'bass', N.lv.bass); }
    else if (kind === 'wave') top.forEach((m, i) => bell2(at + i * 0.07, m, 0.7 + 0.1 * i));
    logCue('sting', at, { kind });
  }

  // one 8th-note step of the score
  function barStart(bar, t) {
      mus.arr = arrangement(bar);
      const A = mus.arr;
      if (A.mode !== mus.lastMode) { logCue('arr', t, { mode: A.mode }); mus.lastMode = A.mode; }
      const lv = N.lv, on = musicOn ? 1 : 0, coast = coasting ? 0.3 : 1;
      const m = k => on * (opts.inst ? +opts.inst.includes(k) : 1);          // opts.inst: per-instrument analysis renders
      glide(lv.uke.gain, m('uke') * (A.pat === 'strum' ? 0.5 : 0.66), t, 0.4);
      glide(lv.bass.gain, m('bass') * (A.mode === 'lullaby' ? 0.36 : 0.42), t, 0.4);
      glide(lv.mel.gain, m('mel') * coast * 1.1, t, 0.3);
      glide(lv.glk.gain, m('glk') * (A.mode === 'lullaby' ? coast * 0.24 + 0.06 : 0.2), t, 0.3);
      glide(lv.whi.gain, m('whi') * coast * 0.6, t, 0.3);
      glide(lv.dr.gain, m('dr') * A.drums * (coasting ? 0.5 : 1) * 0.34, t, 0.4);
      glide(N.musLvl.gain, on * A.level * 0.62, t, musicOn ? 0.8 : 0.4);
      mus.info = barInfo(bar, A);
  }
  function musicStep(bar, step, t, beat) {
    const A = mus.arr, I = mus.info, tr = A.tr, half = step < 4 ? 0 : 1, chord = I.chords[half];
    const pcs = chordPcs(chord, tr, A.color), voice = voicing(pcs, 55, 70, A.color ? 5 : 4);
    const hum = (v = 1) => v * (0.9 + 0.2 * R());
    const jit = () => rr(-0.004, 0.006);
    // --- melody + croon
    for (const n of I.notes) if (n.s === step) {
      const m = n.m + tr, dur = n.d * beat / 2;
      if (musicOn) {
        const accent = step === 0 ? 1 : step % 2 ? 0.8 : 0.9;
        if (A.mel === 'whi') whistle(t, m + 12, dur * 0.95, 0.19 * accent);
        else if (A.mel === 'glk') bell2(t + jit(), m + A.melUp, 0.9 * accent);
        else pluck(t + jit(), m, 0.85 * accent, 'mel', N.lv.mel, -1);
        if (A.mel === 'uke' && n.d >= 3 && A.mode !== 'lullaby') pluck(t + beat, m, 0.35, 'mel', N.lv.mel);   // a soft re-pluck under long notes
        if (A.dbl && A.mel !== 'glk') bell2(t + jit(), m + 12, 0.5);
        if (A.orn && n.d >= 3 && n.s > 0 && hash(bar * 7 + n.s, 3) < 0.55 && A.mel !== 'glk') {       // grace note from the upper neighbour
          const up = [2, 1, 2, 2, 1, 2, 2]; const deg = [5, 7, 9, 10, 0, 2, 4].map(x => (x + tr) % 12).indexOf(m % 12);
          const g = m + (deg >= 0 ? up[deg] : 2), gt = t - Math.min(0.07, beat * 0.12);
          if (A.mel === 'whi') whistle(gt, g + 12, 0.06, 0.12); else pluck(gt, g, 0.4, 'mel', N.lv.mel);
        }
      }
      if (mus.crooning) croonNote(t, m, dur);
    }
    if (!musicOn) return;
    // --- ukulele accompaniment
    if (A.pat === 'strum') {
      const PAT = { 0: [1, 'D'], 2: [0.75, 'D'], 3: [0.45, 'U'], 5: [0.5, 'U'], 6: [0.7, 'D'], 7: [0.42, 'U'] };
      const p = PAT[step];
      if (p) { const vs = p[1] === 'D' ? voice : voice.slice(1).reverse(); vs.forEach((m, i) => pluck(t + i * (p[1] === 'D' ? 0.012 : 0.009) + jit(), m, hum(p[0]) * (p[1] === 'D' ? 0.55 : 0.4), 'uke', N.lv.uke, p[1] === 'D' ? i : voice.length - 1 - i)); }
    } else {
      const ORD = A.pat === 'pick2' ? { 0: 0, 2: 2, 4: 3, 6: 1 } : { 0: 0, 1: 2, 2: 1, 3: 3, 4: 0, 5: 2, 6: 1, 7: 3 };
      const k = ORD[step];
      if (k != null) { const m = voice[Math.min(k, voice.length - 1)]; pluck(t + jit(), m, hum(step === 0 ? 0.62 : 0.46), 'uke', N.lv.uke, k); if (A.color && step === 4 && voice[4]) pluck(t + 0.02, voice[4] + 12, 0.25, 'uke', N.lv.uke, 4); }
    }
    // --- upright bass
    const root = bassMidi(chordRoot(chord, tr));
    if (step === 0) { pluck(t, root, hum(0.95), 'bass', N.lv.bass, 10, A.bass === 'whole' ? 4 * beat : 0); mus.lastRoot = root; }
    else if (step === 4 && A.bass !== 'whole') { const r2 = I.chords[1] !== I.chords[0] ? root : (root + 7 <= 48 ? root + 7 : root - 5); pluck(t, r2, hum(0.75), 'bass', N.lv.bass, 10); }
    else if (step === 6 && A.bass === 'walk' && I.chords[1] === I.chords[0]) {
      const nb = barInfo(bar + 1, A), nr = bassMidi(chordRoot(nb.chords[0], tr));
      const ap = nr === root ? root + 7 - 12 * (root + 7 > 48) : nr + (nr > root ? -1 : 2);   // approach the next root
      pluck(t, ap, hum(0.55), 'bass', N.lv.bass, 10);
    }
    // --- glockenspiel fills at the phrase ends
    if (A.glkFill && (I.bi === 3 || I.bi === 7) && step >= 4 && step <= 6) {
      const top = voicing(chordPcs(chord, tr, false), 76, 91, 4); const seq = A.mode === 'lullaby' ? top : top.slice().reverse();
      const m = seq[(step - 4) % seq.length]; if (m) bell2(t + jit(), m, 0.55 - 0.08 * (step - 4));
    }
    // --- brushes / kick / shaker
    if (A.drums > 0) {
      if (step === 2 || step === 6) brush(t, hum(0.5), true);
      if (A.mode === 'sun' && step % 2 === 1) brush(t, hum(0.18), false);
      if (A.kick && (step === 0 || step === 4)) kick(t, hum(0.55));
      if (A.shaker) shaker(t, step % 2 ? 0.12 : 0.07);
    }
    // --- event stings, quantised to this beat
    if (step % 2 === 0) for (let i = stings.length - 1; i >= 0; i--) {
      const s = stings[i];
      if (t >= s.notBefore) { stings.splice(i, 1); if (t - s.notBefore < 1.2) playSting(s.kind, t, I, A); }
    }
  }
  function musicPump(t) {
    const until = t + AUDIO.musicAhead;
    if (mus.nextT < t - 0.05) mus.nextT = t + 0.03;                       // fell behind (tab away / paused): no backlog
    while (mus.nextT < until) {
      if (mus.step === 0) {          // bar line: one rung of tempo per bar, as an accelerando across the bar
        mus.bpm0 = mus.bpm1; mus.bpm1 = tempoTarget();
        const L = AUDIO.tempi, i0 = L.indexOf(mus.bpm0), i1 = L.indexOf(mus.bpm1);
        if (i0 >= 0 && i1 >= 0 && Math.abs(i1 - i0) > 1) mus.bpm1 = L[i0 + Math.sign(i1 - i0)];
        if (mus.bpm1 !== mus.bpm0) logCue('tempo', mus.nextT, { bpm: mus.bpm1 });
        try { barStart(mus.bar, mus.nextT); } catch (err) { console.warn('[audio] music', err); }
      }
      const k = mus.step / 8, bpm = mus.bpm0 + (mus.bpm1 - mus.bpm0) * k; mus.bpm = bpm;
      const beat = 60 / bpm, sw = mus.arr ? mus.arr.swing : 0.55;
      const stepDur = mus.step % 2 === 0 ? beat * sw : beat * (1 - sw);
      if (mus.arr) try { musicStep(mus.bar, mus.step, mus.nextT, beat); } catch (err) { console.warn('[audio] music', err); }
      mus.nextT += stepDur;
      if (++mus.step === 8) { mus.step = 0; mus.bar++; }
    }
  }
  // pre-render the instrument buffers a few per tick while idle, so no strum ever pays for a Karplus-Strong loop
  let warmQ = null;
  function warm() {
    if (!ac || !N || !musicOn) return;
    if (!warmQ) { warmQ = []; for (let m = 55; m <= 70; m++) warmQ.push(['uke', m]); for (let m = 28; m <= 48; m++) warmQ.push(['bass', m]); for (let m = 62; m <= 84; m++) warmQ.push(['mel', m]); for (let m = 72; m <= 96; m++) warmQ.push(['glk', m]); }
    const t0 = performance.now();
    while (warmQ.length && performance.now() - t0 < 2) { const [k, m] = warmQ.shift(); if (k === 'glk') glk(m); else ks(m, k); }
  }
  function setMusic(on) {
    const was = musicOn; musicOn = !!on;
    if (!ac || !N) return;
    if (musicOn && !was) { mus.bar = -INTRO.length; mus.step = 0; mus.nextT = now() + 0.1; caption('music'); logCue('music', now(), { on: true }); }
    if (!musicOn && was) { glide(N.musLvl.gain, 0, now(), 0.3); for (const k in N.lv) glide(N.lv[k].gain, 0, now() + 0.9, 0.2); logCue('music', now(), { on: false }); }
  }

  // ------------------------------------------------------------------ rig events → sim-time cues
  const CUES = {
    bell: [[AUDIO.bellStrikes[0], bell]],
    hop: [[0.05, (at) => whoosh(at, 0.2, 300, 700, 0.022)], [HOP.takeoff - 0.09, hup], [HOP.takeoff, (at) => { scuff(at); ramp(N.tyreGate.gain, 0, at, 0.03); whoosh(at, HOP.land - HOP.takeoff, 500, 1200, 0.045); }],
      [HOP.land, (at) => { thump(at); ramp(N.tyreGate.gain, 1, at, 0.02); }], [HOP.land + 0.04, oof]],
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
    if (nextSwell < until) { const s = Math.max(nextSwell, t); const D = swell(s); nextSwell = s + D * rr(0.55, 0.9); }
    if (nextGull < until) {
      const s = Math.max(nextGull, t);
      if (gullsOn && night < 0.55 && !paused && (wx.rain || 0) < 0.5) gullCall(s);
      nextGull = s + (cadence > 85 ? rr(6, 12) : rr(11, 26));
    }
    const rain = wx.rain || 0;
    if (rain > 0.05 && nextDrop < until) {       // sparse, soft drops (plinks) on top of the rain bed
      const s = Math.max(nextDrop, t); if (!paused) plip(s, rr(1800, 3600), 0.02 * rain, rr(-0.8, 0.8));
      nextDrop = s + rr(0.04, 0.3) / (0.3 + rain);
    } else if (rain <= 0.05) nextDrop = t + 0.2;
    if (nextGrunt < until) {                     // the odd contented "hm-hm", and effort grunts in a sprint
      const s = Math.max(nextGrunt, t), sprint = cadence > 88 && !coasting;
      if (!paused && s > voiceUntil + 1 && !mus.crooning) grunt(s, sprint ? 'effort' : 'content');
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
    const dk = t < duckUntil ? 0.5 : t < voiceUntil ? 0.62 : near ? 0.78 : 1;
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
      music: { on: musicOn, bar: mus.bar, step: mus.step, bpm: +mus.bpm.toFixed(2), mode: mus.arr ? mus.arr.mode : null, section: mus.info ? mus.info.sec : null, chords: mus.info ? mus.info.chords : null, crooning: mus.crooning } }),
    get context() { return ac; },
  };
  return api;
}
