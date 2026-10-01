// OWNER: audio. Neon Pelican soundscape: 100 % procedural WebAudio, no samples, no files (docs/AUDIO.md).
//
// createAudio(bus, opts?) -> { enable():Promise<boolean>, disable(), update(frame), setVolume(v), setMusic(on), debug() }
//   opts.context  inject an (Offline)AudioContext (tests / judge render). Default: a real AudioContext,
//                 created lazily inside enable() (0 AudioContexts before the user opts in).
//   opts.clock    () => audio time; the offline harness passes the sim clock so update() can schedule ahead.
//   opts.seed     deterministic variation (default: time-seeded).
//   opts.solo     ['amb'|'mech'|'fx'|'far'|'voice'|'music'] keep only these buses (analysis renders).
//   opts.inst     ['kick','snare','hat','bass','pad','arp','lead','fx'] keep only these music parts (analysis renders).
//   opts.volume   0…1 (default 0.8).
//   opts.music    true: the track starts with the sound (default: follows toggles.music / ui:toggle {key:'music'}).
//
// Mix:  sources → buses (amb: rain/city bed/road/harbour · mech: chain/freewheel · fx: chime/thump/gulp · far: sirens,
//       drones, maglev, thunder, horns, gulls, PA · voice: the pelican's vocoder · music: "Neon Pelican" darksynth)
//       → master (fade) → highpass → glue compressor → brick-wall limiter → trim → out. One procedural plate reverb.
// Sync: rig events are cued in SIM time from TIMING (rig/solve.js X-sheets) and scheduled from update(frame) with a
//       120 ms lookahead, compensated for output latency, so the chime rings on the thumb pop and the thump lands on
//       the tyre-contact frame. The freewheel tick rate is exactly wheel rev/s × AUDIO.pawls.
// Music: a composed 32-bar track in A minor (intro, verse A, pre B, hook C, bridge D) on a 16th-note lookahead clock
//       (200 ms ahead). Persistent mono voices (bass, lead, arp, 8-osc pad) are driven by scheduled envelopes: no node
//       is created per 16th except drums. Tempo = cadence quantised to a ladder, one rung per bar. The arrangement is
//       decided at every bar from the city mood (tod), the weather and the district; it ducks under events, and event
//       stings land on the next beat. While coasting, the pelican hums the hook through its vocoder.
import { TIMING } from '../rig/solve.js';
import { BIKE, DIST_PER_REV, CADENCE } from '../contract.js';
import { hash } from '../world/route.js';

export const AUDIO = {
  pawls: 18,                 // freehub engagement points (coast tick rate = wheel rev/s × pawls)
  teeth: BIKE.ringT,         // chain whirr AM rate = crank rev/s × chainring teeth
  lookahead: 0.12, musicAhead: 0.2, interval: 25,
  fadeIn: 0.6, fadeOut: 0.45, pauseFade: 0.4, hideFade: 0.08, hideSuspendMs: 100,
  bellStrikes: [TIMING.bell.strike, TIMING.bell.strike + 0.105],
  tempi: [84, 92, 100, 108, 116, 124],   // the tempo ladder (bpm): cadence snaps to a rung (60 rpm → 100 bpm)
};

const TAU = Math.PI * 2;
const V_MAX = (CADENCE.max / 60) * DIST_PER_REV;
const WHEEL_C = TAU * BIKE.R;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const HOP = { takeoff: TIMING.hop.takeoff, land: TIMING.hop.land, hold0: 0.2, hold1: TIMING.hop.land + 0.35 };
const GAP = { hop: TIMING.hop.gap, bell: 0.12, wave: TIMING.wave.gap, gulp: TIMING.gulp.gap };
const EV_DUR = { bell: 0.8, hop: 1.4, wave: 2.8, gulp: 3.4 };
const CAPTION = {
  bell: ['[cyber chime: ding-ding]', '[电子车铃：叮叮]'], land: ['[thump]', '[咚]'], gulp: ['[gulp]', '[咕嘟]'],
  gull: ['[gulls over the harbour]', '[港口海鸥鸣叫]'], horn: ['[a deep harbour horn]', '[低沉的港口汽笛]'], barge: ['[hover-barge horn]', '[悬浮驳船鸣笛]'],
  siren: ['[a distant siren]', '[远处警笛]'], maglev: ['[the maglev whooshes past]', '[磁浮列车呼啸而过]'], drone: ['[a delivery drone buzzes by]', '[外卖无人机嗡嗡飞过]'],
  thunder: ['[thunder over the towers]', '[楼群上空雷声]'], pa: ['[a station chime echoes]', '[车站提示音回荡]'],
  hup: ['[pelican: “hup!”]', '[鹈鹕：“嘿！”]'], hmm: ['[pelican, through the vocoder: “hmm-hm”]', '[鹈鹕（变声器）：“嗯哼”]'],
  yo: ['[pelican: “yo!”]', '[鹈鹕：“哟！”]'], mmhm: ['[pelican: “mm-hm!” · pouch: download complete]', '[鹈鹕：“嗯嗯！”· 喉囊：下载完成]'],
  hum: ['[pelican hums the hook through its vocoder]', '[鹈鹕用变声器哼着主旋律]'],
  mission: ['[HUD: bleep-bloop, new waypoint]', '[HUD：哔哔，新路点]'], egg: ['[HUD: secret unlocked]', '[HUD：解锁隐藏彩蛋]'],
  meow: ['[robot cat: “mrrp-meow!”]', '[机器猫：“喵呜！”]'], friend: ['[a friendly vocoder honk overhead]', '[头顶传来友好的电子嘎嘎声]'],
  ding: ['[another courier’s chime]', '[对面骑手的车铃]'], fireworks: ['[neon fireworks pop]', '[霓虹烟花噼啪]'], splash: ['[splash]', '[扑通]'],
  music: ['[♪ synthwave: “Neon Pelican”]', '[♪ 合成器浪潮：《霓虹鹈鹕》]'],
};

function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ======================================================================================== the score (docs/AUDIO.md)
// A minor, 4/4, 16th-note grid (16 steps per bar). Melody tokens: <note>:<sixteenths>, r = rest.
const PC = { C: 0, 'C#': 1, Db: 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, Ab: 8, A: 9, Bb: 10, B: 11 };
const CHORD = {              // pitch classes, root first
  Am: [9, 0, 4], F: [5, 9, 0], C: [0, 4, 7], G: [7, 11, 2], Dm: [2, 5, 9], E: [4, 8, 11], Em: [4, 7, 11],
  Esus: [4, 9, 11], Bb: [10, 2, 5],
};
const COLOR = { Am: 7, F: 4, C: 11, G: 9, Dm: 0, E: 2, Em: 2, Esus: 2, Bb: 9 };   // pad colour tones (m7 / maj7 / add9)
export const SONG = [
  { name: 'A', title: 'rain on chrome', chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E'],
    mel: ['r:4 A4:2 C5:2 E5:4 D5:2 C5:2', 'A4:12 r:4', 'r:4 G4:2 C5:2 E5:4 D5:2 C5:2', 'B4:12 r:4',
      'r:4 A4:2 C5:2 E5:4 G5:2 E5:2', 'F5:8 E5:4 C5:4', 'D5:6 F5:2 A5:4 F5:4', 'E5:4 D5:2 C5:2 B4:8'] },
  { name: 'B', title: 'the climb', chords: ['F', 'G', 'Em', 'Am', 'F', 'G', 'Esus', 'E'],
    mel: ['A4:4 C5:4 F5:4 E5:4', 'D5:4 B4:4 G4:4 B4:4', 'E5:4 G5:4 B5:4 G5:4', 'A5:12 r:4',
      'A5:4 G5:4 F5:4 C5:4', 'D5:4 G5:4 B5:4 D6:4', 'A5:8 B5:8', 'G#5:12 r:4'] },
  { name: 'C', title: 'neon hook', chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'Am'],
    mel: ['E5:6 D5:2 C5:4 A4:4', 'C5:4 D5:4 E5:6 F5:2', 'G5:6 E5:2 C5:4 E5:4', 'D5:12 r:4',
      'E5:6 D5:2 C5:4 A4:4', 'C5:4 D5:4 F5:4 A5:4', 'G5:6 F5:2 E5:4 D5:4', 'C5:4 B4:2 A4:10'] },
  { name: 'D', title: 'skybridge', chords: ['Dm', 'Am', 'Bb', 'F', 'Dm', 'Am', 'Bb', 'E'],
    mel: ['F5:8 A5:8', 'E5:12 C5:4', 'D5:8 F5:4 Bb5:4', 'A5:16', 'A5:4 F5:4 D5:8', 'C5:4 E5:4 A5:8', 'Bb5:8 A5:4 F5:4', 'G#5:8 B5:4 E6:4'] },
];
const INTRO = ['Am', 'Am'];         // two bars of pad + arpeggio before the verse
const noteNum = s => { const m = /^([A-G](?:b|#)?)(-?\d)$/.exec(s); return m ? PC[m[1]] + 12 * (+m[2] + 1) : null; };
const parseBar = str => { let s = 0; const out = []; for (const tok of str.trim().split(/\s+/)) { const [n, d] = tok.split(':'); const dd = +d; if (n !== 'r') out.push({ s, d: dd, m: noteNum(n) }); s += dd; } return out; };
const SONG_P = SONG.map(sec => ({ ...sec, notes: sec.mel.map(parseBar), ch: sec.chords.map(c => c.split(' ')) }));
export const SONG_BARS = SONG.length * 8;
// the city districts (route.js stretch keys → STYLE-X §5 re-theme) and what each does to the arrangement
export const DISTRICT_MIX = {
  village: 'neon district: the full mix', pier: 'drone dock: long ping-pong delay on the lead', harbour: 'neon fish port: long delay, harbour lapping',
  funfair: 'arcade row: the arpeggio turns into a chiptune pulse an octave up', railway: 'maglev line: driving 16th hats',
  lighthouse: 'data spire: the pad filter sweeps like the searchlight', cliffs: 'neon tunnel: low-passed, cavernous reverb',
  dunes: 'scrapyard: an overdriven bass', bridge: 'skybridge: the full mix, wide', fort: 'old temple: a pentatonic koto pluck answers the lead',
  pines: 'hydro garden: no snare, a smooth un-gated pad', return: 'neon district: the full mix',
};

export function createAudio(bus, opts = {}) {
  const offline = !!(opts.context && typeof opts.context.startRendering === 'function');
  const R = mulberry(opts.seed ?? ((Date.now() ^ 0x9e3779b9) >>> 0));
  const rr = (a, b) => a + (b - a) * R();
  const solo = opts.solo ? new Set(opts.solo) : null;
  const inst = opts.inst ? new Set(opts.inst) : null;
  const hasDoc = typeof document !== 'undefined';
  let ac = null, N = null, M = null, timer = 0, wantOn = false, paused = false, hidden = false, vol = clamp(opts.volume ?? 0.8, 0, 1);
  let masterTarget = -1, lastLive = 0, lastCtl = -1, simT = 0, lastFrame = null;
  let tickOn = false, tickRate = 0, nextTick = 0, tickN = 0;
  let nextSwell = 0, nextGull = 0, nextHorn = 0, nextBarge = 0, nextSiren = 0, nextDrone = 0, nextMaglev = 0, nextPA = 0, nextCrackle = 0, nextDrip = 0, nextHmm = 0;
  let gust = 1, gustV = 0, gullsOn = true, night = 0, tod = 0.7, speedN = 0.5, cadence = 60, coasting = false, coastSince = 0, lampOn = 1;
  let wx = {}, district = 'village', lastStretch = null, rainK = 0, heavy = 0, musicWant = opts.music === true ? true : null, musicOn = false;
  let duckUntil = 0, voiceUntil = 0, hudUntil = 0, reduced = false, lastFlashN = null, killTimer = 0;
  const seen = new Set(), lastAcc = {}, cues = [], hops = [], log = [], stings = [], encSeen = new Map(), fwSeen = new Set();
  const now = () => (opts.clock ? opts.clock() : ac.currentTime);
  const logCue = (kind, at, extra) => { log.push({ kind, at: +at.toFixed(4), ...extra }); if (log.length > 500) log.shift(); };
  const caption = k => { if (CAPTION[k]) bus.emit('audio:caption', { kind: k, en: CAPTION[k][0], zh: CAPTION[k][1] }); };
  const live = () => !!(ac && N && wantOn && !paused && !hidden);

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
  const pulseWave = duty => { const n = 48, re = new Float32Array(n), im = new Float32Array(n); for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty); return ac.createPeriodicWave(re, im); };

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
  function plate(sec, decay = 0.55) {   // stereo plate-ish IR: pre-delay, darkening exponential tail
    const sr = ac.sampleRate, n = Math.floor(sec * sr), buf = ac.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c); let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, k = 0.12 + 0.8 * Math.min(1, t / sec);
        lp += (R() * 2 - 1 - lp) * (1 - k);
        d[i] = t < 0.016 + c * 0.004 ? 0 : lp * Math.exp(-t / decay);
      }
      let e = 0; for (let i = 0; i < n; i++) e += d[i] * d[i];
      const k = 1 / Math.sqrt(e || 1); for (let i = 0; i < n; i++) d[i] *= k;             // unit-energy IR (0 dB wet gain)
    }
    return buf;
  }
  function clickBuf(f1, f2, f3) {  // freewheel pawl snap: three damped modes + a grain of noise
    const sr = ac.sampleRate, n = Math.floor(0.008 * sr), buf = ac.createBuffer(1, n, sr), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      d[i] = (0.55 * Math.sin(TAU * f1 * t) * Math.exp(-t / 0.0009) + 0.35 * Math.sin(TAU * f2 * t) * Math.exp(-t / 0.0006) +
        0.25 * Math.sin(TAU * f3 * t) * Math.exp(-t / 0.0014) + (R() * 2 - 1) * 0.3 * Math.exp(-t / 0.00025)) * Math.min(1, i / 6) * (1 - i / n);
    }
    return buf;
  }
  function driveCurve(k) {        // soft clipper for the darksynth bass
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
    return c;
  }

  // ------------------------------------------------------------------ graph
  function build() {
    const out = G(1.0);                                                      // trim after the limiter
    const lim = ac.createDynamicsCompressor();
    lim.threshold.value = -4.5; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.09;
    // safety ceiling after the limiter: a soft clip that tops out at -3 dBFS (the compressor's attack lets the odd
    // transient through; this keeps every peak at or below the documented ceiling)
    const ceil = ac.createWaveShaper(); { const n = 2048, c = new Float32Array(n), K = 0.7079, k0 = 0.56; for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1, a = Math.abs(x); c[i] = Math.sign(x) * (a <= k0 ? a : k0 + (K - k0) * Math.tanh((a - k0) / (K - k0))); } ceil.curve = c; ceil.oversample = '2x'; }
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = 0.006; comp.release.value = 0.25;
    const master = G(0), hpf = F('highpass', 36, 0.6);
    wire(master, hpf, comp, lim, ceil, out, ac.destination);
    const B = n => { const g = G(solo && !solo.has(n) ? 0 : 1); g.connect(master); return g; };
    const amb = B('amb'), mech = B('mech'), fx = B('fx'), far = B('far'), voice = B('voice'), music = B('music');
    const verb = ac.createConvolver(); verb.normalize = false; verb.buffer = plate(2.8, 0.7);
    const verbRet = G(0.8); wire(verb, verbRet, master);
    const vin = {}; for (const b of ['amb', 'mech', 'fx', 'far', 'voice', 'music']) { vin[b] = G(solo && !solo.has(b) ? 0 : 1); vin[b].connect(verb); }
    const duck = G(1); duck.connect(amb);                                   // the chime ducks the road + rain

    const pinkB = noise(9.73, 'pink'), brownB = noise(13.31, 'brown'), whiteB = noise(6.07, 'white');
    // wind (calm: one slow breath, no whistling curls)
    const windSrc = bufSrc(pinkB, true), windBp = F('bandpass', 420, 0.5), windLp = F('lowpass', 2200, 0.5), windG = G(0);
    wire(windSrc, windBp, windLp, windG, duck);
    // road: tyre rumble + wet hiss (gated off while airborne)
    const roadSrc = bufSrc(pinkB, true, 1.13), roadLp = F('bandpass', 300, 0.8), roadG = G(0), tyreGate = G(1);
    wire(roadSrc, roadLp, roadG, tyreGate, duck);
    const gritSrc = bufSrc(whiteB, true, 0.91), gritHp = F('highpass', 3000, 0.7), gritG = G(0);
    wire(gritSrc, gritHp, gritG, tyreGate);
    // the harbour: dark water lapping on the pilings (swells are one-shots on top)
    const seaSrc = bufSrc(brownB, true, 0.87), seaLp = F('lowpass', 170, 0.7), seaG = G(0.07);
    wire(seaSrc, seaLp, seaG, amb);
    // rain: fine hiss on chrome + a mid patter on awnings; both follow the drizzle / downpour
    const rainSrc = bufSrc(whiteB, true, 1.03), rainHp = F('highpass', 3600, 0.5), rainLp = F('lowpass', 11000, 0.5), rainG = G(0);
    wire(rainSrc, rainHp, rainLp, rainG, duck);
    const patSrc = bufSrc(pinkB, true, 1.21), patBp = F('bandpass', 1400, 0.6), patG = G(0), patPan = Pan(0.2);
    wire(patSrc, patBp, patG, patPan, duck);
    // the megacity bed: distant traffic rumble + the mid-band roar of a million air-conditioners
    const citySrc = bufSrc(brownB, true, 1.09), cityLp = F('lowpass', 150, 0.7), cityG = G(0.1);
    wire(citySrc, cityLp, cityG, amb);
    const cmSrc = bufSrc(pinkB, true, 0.83), cmBp = F('bandpass', 380, 0.6), cmG = G(0.015);
    wire(cmSrc, cmBp, cmG, amb);
    // neon hum: the 100 Hz ballast buzz of the signs (harmonics band-passed), a slow flicker on its level
    const nh1 = O('sawtooth', 100), nh2 = O('sawtooth', 100.35), nhBp = F('bandpass', 360, 2.2), nhG = G(0), nhPan = Pan(0.35);
    wire(nh1, nhBp); wire(nh2, nhBp); wire(nhBp, nhG, nhPan, amb);
    // chain whirr: band noise amplitude-modulated at the tooth-engagement rate, plus a low roller hum
    const chSrc = bufSrc(whiteB, true, 1.07), chBp = F('bandpass', 2700, 1.3), chAM = G(0.55), chG = G(0), chPan = Pan(-0.12);
    const chOsc = O('sine', 48), chDepth = G(0.45);
    wire(chOsc, chDepth); chDepth.connect(chAM.gain);
    wire(chSrc, chBp, chAM, chG, chPan, mech);
    const humSrc = bufSrc(pinkB, true, 0.95), humBp = F('bandpass', 620, 3), humAM = G(0.6), humG = G(0);
    const humOsc = O('sine', 2), humDepth = G(0.4); wire(humOsc, humDepth); humDepth.connect(humAM.gain);
    wire(humSrc, humBp, humAM, humG, chPan);
    // freewheel ticks (a little brighter: a carbon hub)
    const tickBus = G(1), tickPan = Pan(-0.22); wire(tickBus, tickPan, mech);
    const clicks = [clickBuf(3350, 5320, 7700), clickBuf(3520, 5090, 7950), clickBuf(3250, 5560, 7500)];
    const pawlAmp = Array.from({ length: AUDIO.pawls }, (_, i) => 0.82 + 0.18 * Math.sin(i * 2.4) * Math.cos(i * 0.7) + 0.08 * R());

    const t0 = now();
    for (const s of [windSrc, roadSrc, gritSrc, seaSrc, rainSrc, patSrc, citySrc, cmSrc, chSrc, humSrc]) s.start(t0, R() * 5);
    for (const o of [chOsc, humOsc, nh1, nh2]) o.start(t0);
    N = { master, amb, mech, fx, far, voice, music, verb, vin, duck, windSrc, windBp, windG, roadSrc, roadLp, roadG, tyreGate, gritG, seaG,
      rainG, rainLp, patG, cityG, cmG, nhG, nhBp, chOsc, chG, chBp, humOsc, humG, tickBus, clicks, pawlAmp, pinkB, brownB, whiteB,
      chip: pulseWave(0.125), drive: driveCurve(3.2) };
    nextSwell = t0 + 0.4; nextGull = t0 + rr(8, 16); nextHorn = t0 + rr(10, 20); nextBarge = t0 + rr(30, 70); nextSiren = t0 + rr(9, 20);
    nextDrone = t0 + rr(5, 12); nextMaglev = t0 + rr(40, 80); nextPA = t0 + rr(35, 70); nextCrackle = t0 + rr(3, 8); nextDrip = t0 + 0.3; nextHmm = t0 + rr(25, 45);
  }

  // ------------------------------------------------------------------ voices: ride + events
  function send(node, amt, b = 'fx') { if (amt > 0) { const s = G(amt); node.connect(s); s.connect(N.vin[b]); return s; } return null; }
  function screenPan(sel, pick) {
    if (!hasDoc || offline) return null;
    try {
      const svg = document.querySelector('#scene'); if (!svg) return null;
      const els = [...svg.querySelectorAll(sel)].filter(e => e.getAttribute('visibility') !== 'hidden');
      const W = innerWidth || 1600;
      const rects = els.map(e => e.getBoundingClientRect()).filter(r => (r.width || r.height) && r.right > 0 && r.left < W);
      if (!rects.length) return null;
      const r = pick ? rects[Math.floor(R() * rects.length)] : rects[0];
      return clamp(((r.left + r.width / 2) / W) * 2 - 1, -1, 1);
    } catch { return null; }
  }

  // the cyber chime (re-voiced bell): FM glass tone, an inharmonic modulator, a digital striker tick and a shimmer
  function chimeStrike(at, midi, amp, pan, dest = N.fx) {
    const f = mtof(midi), pn = Pan(pan), bus = G(amp * 0.16), sv = send(pn, 0.3); wire(bus, pn, dest);
    const car = O('sine', f), mod = O('sine', f * 1.4), mg = G(0), cg = G(0);
    wire(mod, mg); mg.connect(car.frequency); wire(car, cg, bus);
    mg.gain.setValueAtTime(f * 1.6, at); mg.gain.exponentialRampToValueAtTime(f * 0.02, at + 0.35); mg.gain.linearRampToValueAtTime(0, at + 0.5);
    const e1 = envAD(cg.gain, at, 0.8, 0.0015, 1.5);
    const gl = O('sine', f * 2.76), gg = G(0); wire(gl, gg, bus); const e2 = envAD(gg.gain, at, 0.22, 0.001, 0.5);
    const lo = O('sine', f * 0.5), lg = G(0); wire(lo, lg, bus); envAD(lg.gain, at, 0.12, 0.004, 1.1);
    const trem = O('sine', 7.3), tg = G(amp * 0.04); wire(trem, tg); tg.connect(bus.gain);             // digital shimmer
    const tk = O('square', 4200), tkg = G(0); wire(tk, tkg, bus); const e3 = envAD(tkg.gain, at, 0.2, 0.0005, 0.004);
    for (const o of [car, mod, lo, trem]) { o.start(at); o.stop(e1 + 0.02); }
    gl.start(at); gl.stop(e2); tk.start(at); tk.stop(e3);
    reap(car, [car, mod, mg, cg, gl, gg, lo, lg, trem, tg, tk, tkg, bus, pn, sv].filter(Boolean));
  }
  function bell(at) {
    const pan = screenPan('#j-bars') ?? 0.05;
    let m1 = 88, m2 = 95;                                  // E6 → B6
    if (musicOn && M && mus.info) {                        // in tune with the track: the current chord's tones
      const pcs = chordPcs(mus.info.chords[0], mus.arr ? mus.arr.tr : 0, false), v = voicing(pcs, 86, 100, 4);
      if (v.length >= 2) { m1 = v[0]; m2 = v[2] ?? v[1]; }
    }
    chimeStrike(at, m1, 1, pan); chimeStrike(at + (AUDIO.bellStrikes[1] - AUDIO.bellStrikes[0]), m2, 0.75, pan);
    ramp(N.duck.gain, 0.55, at, 0.03); ramp(N.duck.gain, 1, at + 0.4, 0.6);
    logCue('bell', at, { pan, m1, m2 }); caption('bell');
  }
  function thump(at) {
    const pn = Pan(0), g0 = G(1); wire(g0, pn, N.fx); send(pn, 0.08);
    const o = O('sine', 96), og = G(0); o.frequency.setValueAtTime(96, at); o.frequency.exponentialRampToValueAtTime(40, at + 0.16);
    wire(o, og, g0); const e1 = envAD(og.gain, at, 0.55, 0.003, 0.28); o.start(at); o.stop(e1);
    const nb = bufSrc(N.brownB), lp = F('lowpass', 520, 0.8), ng = G(0); wire(nb, lp, ng, g0);
    const e2 = envAD(ng.gain, at, 0.5, 0.002, 0.16); nb.start(at, R() * 8); nb.stop(e2);
    const wet = wx.wet || 0, tb = bufSrc(N.whiteB), bp = F('bandpass', 1300 + 900 * wet, 0.8), tg = G(0); wire(tb, bp, tg, g0);   // tyre "pff" / wet splash
    const e3 = envAD(tg.gain, at, 0.12 + 0.3 * wet, 0.002, 0.09 + 0.2 * wet); tb.start(at, R() * 4); tb.stop(e3);
    // delivery box + fender rattle
    [[0.028, 0.5], [0.05, 0.34], [0.083, 0.42], [0.125, 0.22], [0.18, 0.12]].forEach(([dt, a], i) => {
      const s = bufSrc(N.clicks[i % 3], false, 0.45 + 0.1 * i), f = F('bandpass', 1900 + 300 * i, 2), g = G(a * 0.35);
      wire(s, f, g, g0); s.start(at + dt); reap(s, [s, f, g]);
    });
    reap(o, [o, og]); reap(nb, [nb, lp, ng]); reap(tb, [tb, bp, tg, g0, pn]);
    logCue('land', at); caption('land');
  }
  function whoosh(at, dur, f0, f1, amp, pan = 0, dest = N.fx) {
    const s = bufSrc(N.pinkB), bp = F('bandpass', f0, 1.4), g = G(0), pn = Pan(pan);
    bp.frequency.setValueAtTime(f0, at); bp.frequency.exponentialRampToValueAtTime(f1, at + dur * 0.6); bp.frequency.exponentialRampToValueAtTime(f0 * 0.8, at + dur);
    wire(s, bp, g, pn, dest);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(amp, at + dur * 0.45); g.gain.linearRampToValueAtTime(0, at + dur);
    s.start(at, R() * 6); s.stop(at + dur + 0.02); reap(s, [s, bp, g, pn]);
  }
  function scuff(at) {           // tyre scuff at take-off
    const s = bufSrc(N.whiteB), bp = F('bandpass', 1900, 1), g = G(0); wire(s, bp, g, N.fx);
    const e = envAD(g.gain, at, 0.09, 0.004, 0.07); s.start(at, R() * 4); s.stop(e); reap(s, [s, bp, g]);
  }
  function bubble(at, f0, f1, dur, amp, dest = N.fx) {   // rising-pitch bubble = the "gloop"
    const o = O('sine', f0), o2 = O('triangle', f0 * 2), g = G(0), g2 = G(0.18), lp = F('lowpass', 1600, 0.7), pn = Pan(0.12);
    o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f1, at + dur);
    o2.frequency.setValueAtTime(f0 * 2, at); o2.frequency.exponentialRampToValueAtTime(f1 * 2, at + dur);
    wire(o, g); wire(o2, g2, g); wire(g, lp, pn, dest); send(pn, 0.06);
    const e = envAD(g.gain, at, amp, 0.006, dur * 1.3);
    o.start(at); o2.start(at); o.stop(e); o2.stop(e); reap(o, [o, o2, g, g2, lp, pn]);
  }
  function slap(at) {            // wet fish flop
    const s = bufSrc(N.whiteB), bp = F('bandpass', 950, 1.3), g = G(0), pn = Pan(0.15); wire(s, bp, g, pn, N.fx);
    const e = envAD(g.gain, at, 0.28, 0.002, 0.06); s.start(at, R() * 4); s.stop(e); reap(s, [s, bp, g, pn]);
    bubble(at + 0.01, 240, 150, 0.04, 0.12);
  }
  function clack(at) {           // bill snapping shut (a chrome nail: a brighter click)
    const o = O('sine', 1480), g = G(0), s = bufSrc(N.whiteB), bp = F('bandpass', 3200, 4), g2 = G(0), pn = Pan(0.15);
    wire(o, g, pn); wire(s, bp, g2, pn); pn.connect(N.fx);
    const e = envAD(g.gain, at, 0.16, 0.001, 0.035); envAD(g2.gain, at, 0.35, 0.0006, 0.02);
    o.start(at); o.stop(e); s.start(at, R() * 4); s.stop(e); reap(o, [o, g, s, bp, g2, pn]);
  }
  // HUD bleeps: short square / pulse blips, the language of the visor
  function blip(at, midi, dur, amp, pan = 0.25, type = 'square', dest = N.fx) {
    const o = type === 'chip' ? O('square', mtof(midi)) : O(type, mtof(midi)), lp = F('lowpass', 5200, 0.7), g = G(0), pn = Pan(pan);
    if (type === 'chip') o.setPeriodicWave(N.chip);
    wire(o, lp, g, pn, dest); send(pn, 0.12);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(amp, at + 0.002); g.gain.setValueAtTime(amp, at + dur * 0.6); g.gain.linearRampToValueAtTime(0, at + dur);
    o.start(at); o.stop(at + dur + 0.01); reap(o, [o, lp, g, pn]);
  }
  function hudSeq(at, seq, amp = 0.05, step = 0.065, type = 'square', pan = 0.3) {
    seq.forEach((m, i) => blip(at + i * step, m, step * 0.8, amp * (1 - 0.08 * i), pan, type));
    hudUntil = Math.max(hudUntil, at + seq.length * step + 0.2);
    return at + seq.length * step;
  }
  function gulpSeq(at) {
    const T = TIMING.gulp;
    slap(at + T.scoop[0] + 0.06);
    whoosh(at + T.toss[0], 0.3, 500, 1500, 0.05, 0.1);
    clack(at + T.toss[1] - 0.02);
    bubble(at + T.swallow[0] + 0.06, 190, 560, 0.1, 0.34);
    bubble(at + T.swallow[0] + 0.24, 260, 780, 0.09, 0.28);
    bubble(at + T.swallow[0] + 0.44, 340, 640, 0.07, 0.13);
    // the pouch's circuit tattoo lights up: a little "download complete" chirp, then the pelican approves
    hudSeq(at + T.swallow[0] + 0.62, [81, 86, 93], 0.035, 0.05, 'sine', 0.12);
    say(at + T.swallow[0] + 0.95, VOICE.mmhm, { amp: 0.9 });
    logCue('gulp', at + T.swallow[0] + 0.06); caption('gulp'); caption('mmhm');
    stings.push({ kind: 'gulp', notBefore: at + T.swallow[0] + 0.4 });
  }
  function waveSeq(at) {         // jacket + feather rustle while the wing unfolds and waves, and a "yo!"
    const T = TIMING.wave;
    whoosh(at + T.unfold[0], T.unfold[1] - T.unfold[0], 2200, 3800, 0.03, 0.15);
    for (let i = 0; i < 3; i++) whoosh(at + T.wave[0] + i * 0.28, 0.24, 1700, 3200, 0.02, 0.2);
    say(at + T.wave[0] + 0.05, VOICE.yo, { amp: 0.85 });
    logCue('wave', at); caption('yo');
    stings.push({ kind: 'wave', notBefore: at + T.wave[0] });
  }
  function tick(at) {
    const i = tickN++ % AUDIO.pawls, s = bufSrc(N.clicks[i % 3], false, 0.96 + 0.08 * R()), g = G(N.pawlAmp[i] * (0.9 + 0.2 * R()));
    wire(s, g, N.tickBus); s.start(at); reap(s, [s, g]);
  }

  // ------------------------------------------------------------------ the pelican's voice: a 9-band vocoder
  // A saw + pulse carrier (and breath noise for aspirates) through a bank of fixed band-pass channels whose gains trace
  // the formants of each vowel: the "robot bird" of a cyber pelican. Pitches sit on the song's scale.
  const BANDS = [240, 340, 480, 680, 960, 1350, 1900, 2700, 3800];
  const VOW = {
    m: [[260, 1], [1000, 0.2], [2400, 0.05]], n: [[280, 1], [1500, 0.28], [2500, 0.08]], u: [[320, 1], [800, 0.5], [2300, 0.14]],
    o: [[480, 1], [850, 0.7], [2700, 0.2]], a: [[760, 1], [1150, 0.8], [2600, 0.3]], e: [[520, 1], [1900, 0.6], [2600, 0.35]],
    i: [[300, 0.9], [2400, 0.7], [3100, 0.45]], h: [[900, 0.3], [1900, 0.4], [3000, 0.4]],
  };
  const bandGains = (v, k = 1.12) => BANDS.map(fc => { let s = 0; for (const [Fm, a] of VOW[v] || VOW.m) { const x = Math.log2(fc / (Fm * k)) / 0.38; s += a * Math.exp(-x * x); } return Math.min(1.2, s); });
  const VOICE = {   // segments: v vowel, n MIDI pitch (→ n1 glide), d seconds, a amplitude (0 = a gap), br breath
    hmm: [{ v: 'm', n: 57, d: 0.15, a: 1 }, { v: 'm', d: 0.07, a: 0 }, { v: 'm', n: 55, n1: 52, d: 0.24, a: 0.9 }],
    hup: [{ v: 'h', n: 58, d: 0.03, a: 0.6, br: 1 }, { v: 'u', n: 58, n1: 63, d: 0.11, a: 1 }],
    oof: [{ v: 'o', n: 60, n1: 54, d: 0.14, a: 0.8 }, { v: 'u', n: 54, d: 0.06, a: 0.4 }],
    yo: [{ v: 'i', n: 60, d: 0.07, a: 0.8 }, { v: 'o', n: 64, n1: 67, d: 0.2, a: 1 }],
    mmhm: [{ v: 'm', n: 55, d: 0.16, a: 0.9 }, { v: 'm', d: 0.06, a: 0 }, { v: 'h', n: 60, d: 0.03, a: 0.5, br: 1 }, { v: 'm', n: 60, n1: 62, d: 0.2, a: 1 }],
    honk: [{ v: 'a', n: 67, d: 0.12, a: 1 }, { v: 'n', n: 67, n1: 64, d: 0.1, a: 0.7 }, { v: 'n', d: 0.07, a: 0 }, { v: 'a', n: 69, d: 0.16, a: 1 }, { v: 'n', n: 69, n1: 65, d: 0.1, a: 0.6 }],
    meow: [{ v: 'i', n: 76, n1: 79, d: 0.09, a: 0.7 }, { v: 'a', n: 79, n1: 74, d: 0.22, a: 1 }, { v: 'u', n: 74, n1: 71, d: 0.12, a: 0.6 }],
  };
  function say(at, segs, { amp = 1, pan = 0.08, dest = N.voice, carrier = 'sawtooth' } = {}) {
    const car = O(carrier, mtof(segs[0].n ?? 57)), sq = O('square', mtof(segs[0].n ?? 57)), sqg = G(0.35), mix = G(1);
    const br = bufSrc(N.whiteB), brg = G(0), vca = G(0), pn = Pan(pan), out = G(amp * 0.2);
    wire(car, mix); wire(sq, sqg, mix); wire(br, brg, mix);
    const chans = BANDS.map(fc => { const f = F('bandpass', fc, 5.5), g = G(0); wire(mix, f, g, vca); return [f, g]; });
    wire(vca, out, pn, dest); send(pn, 0.2, 'voice');
    let t = at, n = segs[0].n ?? 57;
    for (const s of segs) {
      const gs = bandGains(s.v);
      chans.forEach(([, g], i) => glide(g.gain, gs[i] * 2.4, t, 0.012));
      if (s.n != null) { n = s.n; for (const o of [car, sq]) o.frequency.setValueAtTime(mtof(n), t); }
      if (s.n1 != null) { for (const o of [car, sq]) o.frequency.exponentialRampToValueAtTime(mtof(s.n1), t + s.d); n = s.n1; }
      glide(vca.gain, s.a, t, 0.012);
      glide(brg.gain, s.br ? 0.8 : 0.05, t, 0.01);
      t += s.d;
    }
    glide(vca.gain, 0, t, 0.02);
    const end = t + 0.15;
    for (const o of [car, sq]) { o.start(at); o.stop(end); }
    br.start(at, R() * 4); br.stop(end);
    reap(car, [car, sq, sqg, mix, br, brg, vca, out, pn, ...chans.flat()]);
    voiceUntil = Math.max(voiceUntil, end);
    return end;
  }

  // ------------------------------------------------------------------ the city
  function swell(at) {           // harbour water slapping the pilings
    const D = rr(4.5, 8), peak = rr(0.07, 0.12), pan = rr(-0.7, 0.2), crest = rr(0.35, 0.5);
    const s = bufSrc(N.pinkB, true), lp = F('lowpass', 200, 0.6), g = G(0), pn = Pan(pan);
    lp.frequency.setValueAtTime(200, at); lp.frequency.exponentialRampToValueAtTime(rr(600, 1100), at + D * crest); lp.frequency.exponentialRampToValueAtTime(240, at + D);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(peak, at + D * crest); g.gain.linearRampToValueAtTime(peak * 0.3, at + D * 0.72); g.gain.linearRampToValueAtTime(0, at + D);
    wire(s, lp, g, pn, N.amb);
    s.start(at, R() * 9); s.stop(at + D + 0.05); reap(s, [s, lp, g, pn]);
    if (R() < 0.5) plip(at + D * crest, rr(380, 620), 0.05, pan, N.amb);        // a hollow slap under the dock
    return D;
  }
  function plip(at, f, amp, pan, dest = N.amb) {   // a raindrop on a chrome awning / a drip in a puddle
    const o = O('sine', f), g = G(0), pn = Pan(pan); wire(o, g, pn, dest);
    o.frequency.setValueAtTime(f * 1.25, at); o.frequency.exponentialRampToValueAtTime(f, at + 0.012);
    const e = envAD(g.gain, at, amp, 0.001, rr(0.03, 0.09)); o.start(at); o.stop(e); reap(o, [o, g, pn]);
  }
  function crackle(at) {         // a failing neon tube: a burst of ballast buzz and arcing ticks
    const pan = rr(-0.9, 0.9), pn = Pan(pan), bus = G(1); wire(bus, pn, N.amb);
    const o = O('sawtooth', 100), bp = F('bandpass', rr(500, 900), 3), og = G(0); wire(o, bp, og, bus);
    const n = 4 + Math.floor(R() * 8); let t = at;
    for (let i = 0; i < n; i++) {
      const d = rr(0.012, 0.05), a = rr(0.006, 0.016);
      og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(a, t + 0.002); og.gain.setValueAtTime(a, t + d); og.gain.linearRampToValueAtTime(0, t + d + 0.004);
      if (R() < 0.5) { const s = bufSrc(N.whiteB), hp = F('highpass', 3000, 0.7), g = G(0); wire(s, hp, g, bus); const e = envAD(g.gain, t, rr(0.01, 0.025), 0.0005, 0.006); s.start(t, R() * 4); s.stop(e); reap(s, [s, hp, g]); }
      t += d + rr(0.01, 0.12);
    }
    o.start(at); o.stop(t + 0.02); reap(o, [o, bp, og, bus, pn]);
  }
  function siren(at) {           // a distant emergency wail somewhere in the canyons, a slow doppler drift
    const D = rr(6.5, 9.5), p0 = rr(-0.9, 0.9), p1 = clamp(p0 + rr(-0.8, 0.8), -1, 1), pn = Pan(p0), lp = F('lowpass', 1500, 0.7), g = G(0);
    const o1 = O('triangle', 800), o2 = O('sine', 1600), o2g = G(0.25), lfo = O(R() < 0.5 ? 'sine' : 'square', R() < 0.5 ? rr(0.22, 0.32) : rr(1.3, 1.7)), lg = G(260);
    wire(lfo, lg); lg.connect(o1.frequency); const lg2 = G(520); lfo.connect(lg2); lg2.connect(o2.frequency);
    o1.frequency.setValueAtTime(820, at); o1.frequency.linearRampToValueAtTime(760, at + D);                       // doppler
    o2.frequency.setValueAtTime(1640, at); o2.frequency.linearRampToValueAtTime(1520, at + D);
    wire(o1, lp); wire(o2, o2g, lp); wire(lp, g, pn, N.far); send(pn, 0.7, 'far');
    if (pn.pan) { pn.pan.setValueAtTime(p0, at); pn.pan.linearRampToValueAtTime(p1, at + D); }
    const a = rr(0.012, 0.022) * (0.7 + 0.5 * night);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(a, at + D * 0.35); g.gain.linearRampToValueAtTime(0, at + D);
    for (const o of [o1, o2, lfo]) { o.start(at); o.stop(at + D + 0.05); }
    reap(o1, [o1, o2, o2g, lfo, lg, lg2, lp, g, pn]);
    logCue('siren', at, { pan: +p0.toFixed(2) }); caption('siren');
  }
  function droneBy(at, near = false) {   // a quad-rotor passing: four detuned rotors, blade-rate AM, doppler, a pan sweep
    const D = near ? rr(3, 4.2) : rr(4, 6.5), dir = R() < 0.5 ? -1 : 1, pn = Pan(-0.85 * dir), bp = F('bandpass', 900, 0.9), hp = F('highpass', 220, 0.7), g = G(0), am = G(0.6);
    const base = rr(150, 210), rot = [0, 1.021, 1.043, 0.985].map(k => O('sawtooth', base * (k || 1)));
    const lfo = O('sine', rr(24, 32)), lg = G(0.4); wire(lfo, lg); lg.connect(am.gain);
    for (const o of rot) { o.frequency.setValueAtTime(o.frequency.value * 1.035, at); o.frequency.linearRampToValueAtTime(o.frequency.value * 0.965, at + D); wire(o, bp); }
    wire(bp, hp, am, g, pn, N.far); send(pn, 0.25, 'far');
    if (pn.pan) { pn.pan.setValueAtTime(-0.85 * dir, at); pn.pan.linearRampToValueAtTime(0.85 * dir, at + D); }
    const a = near ? 0.05 : rr(0.014, 0.028);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(a, at + D * 0.5); g.gain.linearRampToValueAtTime(0, at + D);
    for (const o of [...rot, lfo]) { o.start(at); o.stop(at + D + 0.05); }
    reap(lfo, [...rot, lfo, lg, bp, hp, am, g, pn]);
    logCue('drone', at, { near }); caption('drone');
  }
  function maglev(at) {          // the maglev on its viaduct: an electric whine that drops as it passes, an air-wall, a thrum
    const D = 3.2, dir = R() < 0.7 ? 1 : -1, pn = Pan(-dir), bus = G(1); wire(bus, pn, N.far); send(pn, 0.35, 'far');
    if (pn.pan) { pn.pan.setValueAtTime(-0.95 * dir, at); pn.pan.linearRampToValueAtTime(0.95 * dir, at + D); }
    const s = bufSrc(N.pinkB), bp = F('bandpass', 400, 0.9), ng = G(0); wire(s, bp, ng, bus);
    bp.frequency.setValueAtTime(350, at); bp.frequency.exponentialRampToValueAtTime(2400, at + D * 0.5); bp.frequency.exponentialRampToValueAtTime(500, at + D);
    ng.gain.setValueAtTime(0, at); ng.gain.linearRampToValueAtTime(0.16, at + D * 0.48); ng.gain.linearRampToValueAtTime(0.03, at + D * 0.75); ng.gain.linearRampToValueAtTime(0, at + D);
    const w1 = O('sine', 990), w2 = O('sine', 1485), wg = G(0), w2g = G(0.4); wire(w1, wg); wire(w2, w2g, wg); wg.connect(bus);
    for (const [o, k] of [[w1, 1], [w2, 1.5]]) { o.frequency.setValueAtTime(990 * k * 1.06, at); o.frequency.setTargetAtTime(990 * k * 0.9, at + D * 0.48, 0.12); }
    wg.gain.setValueAtTime(0, at); wg.gain.linearRampToValueAtTime(0.02, at + D * 0.45); wg.gain.linearRampToValueAtTime(0, at + D);
    const th = O('sine', 52), tg = G(0); wire(th, tg, bus);
    tg.gain.setValueAtTime(0, at); tg.gain.linearRampToValueAtTime(0.1, at + D * 0.5); tg.gain.linearRampToValueAtTime(0, at + D);
    s.start(at, R() * 5); s.stop(at + D + 0.05);
    for (const o of [w1, w2, th]) { o.start(at); o.stop(at + D + 0.05); }
    reap(s, [s, bp, ng, w1, w2, wg, w2g, th, tg, bus, pn]);
    logCue('maglev', at, { dir }); caption('maglev');
  }
  function thunder(at, dist) {   // near: a crack then the roll; far: only the roll
    const pan = rr(-0.8, 0.8), pn = Pan(pan), bus = G(1); wire(bus, pn, N.far); send(pn, 0.5, 'far');
    const D = rr(3, 5), s = bufSrc(N.brownB), lp = F('lowpass', 320, 0.8), g = G(0); wire(s, lp, g, bus);
    lp.frequency.setValueAtTime(420 - 200 * dist, at); lp.frequency.exponentialRampToValueAtTime(90, at + D);
    const a = 0.45 * (1 - 0.5 * dist);
    g.gain.setValueAtTime(0, at); let t = at;
    for (let i = 0; i < 4; i++) { t += rr(0.08, 0.5); g.gain.linearRampToValueAtTime(a * rr(0.55, 1), t); }
    g.gain.exponentialRampToValueAtTime(a * 1e-3, at + D); g.gain.linearRampToValueAtTime(0, at + D + 0.05);
    s.start(at, R() * 8); s.stop(at + D + 0.1); reap(s, [s, lp, g, bus, pn]);
    if (dist < 0.4) { const c = bufSrc(N.whiteB), bp = F('bandpass', 1800, 0.6), cg = G(0); wire(c, bp, cg, bus); const e = envAD(cg.gain, at, 0.22, 0.003, 0.25); c.start(at, R() * 4); c.stop(e); reap(c, [c, bp, cg]); }
    logCue('thunder', at, { dist: +dist.toFixed(2) }); caption('thunder');
  }
  function paChime(at) {         // a station chime echoing off the towers ("maglev line 7 arriving")
    const pan = rr(-0.6, 0.6), seq = [76, 72, 79, 84];
    seq.forEach((m, i) => {
      const f = mtof(m), o = O('sine', f), o2 = O('sine', f * 2.01), g = G(0), g2 = G(0.18), lp = F('lowpass', 2600, 0.7), pn = Pan(pan);
      wire(o, g); wire(o2, g2, g); wire(g, lp, pn, N.far); send(pn, 0.9, 'far');
      const t = at + i * 0.42, e = envAD(g.gain, t, 0.022, 0.01, 1.2);
      o.start(t); o2.start(t); o.stop(e); o2.stop(e); reap(o, [o, o2, g, g2, lp, pn]);
    });
    logCue('pa', at); caption('pa');
  }
  function gullNote(at, f0, dur, pan, panV, amp, dist) {
    const o1 = O('sawtooth', f0), o2 = O('square', f0), vib = O('sine', rr(22, 34)), vg = G(f0 * 0.022);
    const m1 = G(0.55), m2 = G(0.18), b1 = F('bandpass', f0 * 2.05, 2.4), b2 = F('bandpass', f0 * 3.7, 3), lp = F('lowpass', 7000 - 4200 * dist, 0.7), g = G(0), pn = Pan(pan);
    o2.detune.value = 22;
    for (const o of [o1, o2]) { const fr = o.frequency; fr.setValueAtTime(f0 * 0.76, at); fr.exponentialRampToValueAtTime(f0 * 1.22, at + dur * 0.3); fr.exponentialRampToValueAtTime(f0 * 0.64, at + dur); }
    wire(vib, vg); vg.connect(o1.frequency); vg.connect(o2.frequency);
    wire(o1, m1); wire(o2, m2); for (const m of [m1, m2]) { m.connect(b1); m.connect(b2); }
    b1.connect(lp); b2.connect(lp); wire(lp, g, pn, N.far); send(pn, 0.12 + 0.3 * dist, 'far');
    if (pn.pan) { pn.pan.setValueAtTime(clamp(pan, -1, 1), at); pn.pan.linearRampToValueAtTime(clamp(pan + panV * dur, -1, 1), at + dur); }
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(amp, at + 0.03); g.gain.linearRampToValueAtTime(amp * 0.8, at + dur * 0.7); g.gain.linearRampToValueAtTime(0, at + dur);
    for (const o of [o1, o2, vib]) { o.start(at); o.stop(at + dur + 0.02); }
    reap(o1, [o1, o2, vib, vg, m1, m2, b1, b2, lp, g, pn]);
  }
  function gullCall(at, near = false, panHint = null) {
    let pan = panHint ?? screenPan('[data-ref^="fx-gfar"]', true);
    if (pan == null) pan = rr(-0.8, 0.8);
    const panV = (2 * (170 - 0.15 * speedN * V_MAX)) / 1600 * (near ? 0.3 : 1);
    const dist = near ? 0.2 : rr(0.5, 0.85), amp = (near ? 0.18 : 0.1) * rr(0.8, 1.1), f0 = rr(820, 1080);
    let t = at, p = pan;
    const n = 2 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) { const d = rr(0.2, 0.3); gullNote(t, f0 * (1 - 0.03 * i), d, p, panV, amp, dist); t += d + rr(0.07, 0.14); p += panV * (d + 0.1); }
    logCue('gull', at, { pan: +pan.toFixed(3), near }); caption('gull');
  }
  function hornBlast(at, f, dur, amp, pan, lpF, verbAmt, fifth = false) {
    const o1 = O('sawtooth', f), o2 = O('sawtooth', f * (fifth ? 1.5 : 1.004)), o3 = O('square', f / 2), m3 = G(0.35), lp = F('lowpass', lpF * 0.4, 1.1), g = G(0), pn = Pan(pan);
    for (const [o, k] of [[o1, 1], [o2, fifth ? 1.5 : 1.004], [o3, 0.5]]) { const fr = o.frequency; fr.setValueAtTime(f * k * 0.93, at); fr.exponentialRampToValueAtTime(f * k, at + 0.22); fr.setValueAtTime(f * k, at + dur); fr.exponentialRampToValueAtTime(f * k * 0.8, at + dur + 0.4); }
    lp.frequency.setValueAtTime(lpF * 0.4, at); lp.frequency.linearRampToValueAtTime(lpF, at + 0.45); lp.frequency.linearRampToValueAtTime(lpF * 0.7, at + dur + 0.5);
    wire(o1, lp); wire(o2, lp); wire(o3, m3, lp); wire(lp, g, pn, N.far); send(pn, verbAmt, 'far');
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(amp, at + 0.4); g.gain.setValueAtTime(amp, at + dur); g.gain.exponentialRampToValueAtTime(amp * 1e-3, at + dur + 0.9); g.gain.linearRampToValueAtTime(0, at + dur + 0.95);
    for (const o of [o1, o2, o3]) { o.start(at); o.stop(at + dur + 1); }
    reap(o1, [o1, o2, o3, m3, lp, g, pn]);
  }
  function harbourHorn(at) {
    const pan = screenPan('[data-ref="sea-lantern"]') ?? 0.45;
    hornBlast(at, 98, 2.4, 0.04, pan, 460, 0.8);
    logCue('horn', at, { pan }); caption('horn');
  }
  function bargeHorn(at) {       // a hover-barge: two synthetic tones a fifth apart
    const pan = rr(-0.7, 0.7);
    hornBlast(at, 147, 0.5, 0.035, pan, 1000, 0.6, true); hornBlast(at + 0.9, 147, 0.9, 0.035, pan, 1000, 0.6, true);
    logCue('barge', at, { pan }); caption('barge');
  }
  // encounter voices
  function splash(at, amp, pan, dest) {
    const s = bufSrc(N.whiteB), bp = F('bandpass', 1100, 0.7), g = G(0), pn = Pan(pan); wire(s, bp, g, pn, dest);
    const e = envAD(g.gain, at, amp, 0.004, 0.22); s.start(at, R() * 4); s.stop(e); reap(s, [s, bp, g, pn]);
    bubble(at + 0.05, 300, 700, 0.06, amp * 0.8, dest);
  }
  function firework(at, pan) {   // neon fireworks: a boom, a synth "pew" and a glittering crackle
    const bus = G(1), pn = Pan(pan); wire(bus, pn, N.far); send(pn, 0.6, 'far');
    const o = O('sine', 70), og = G(0); o.frequency.setValueAtTime(90, at); o.frequency.exponentialRampToValueAtTime(38, at + 0.4); wire(o, og, bus);
    const e = envAD(og.gain, at, 0.16, 0.004, 0.6); o.start(at); o.stop(e);
    const nb = bufSrc(N.brownB), lp = F('lowpass', 500, 0.7), ng = G(0); wire(nb, lp, ng, bus); const e2 = envAD(ng.gain, at, 0.2, 0.003, 0.5); nb.start(at, R() * 8); nb.stop(e2);
    for (let i = 0; i < 9; i++) { const t = at + 0.25 + rr(0, 0.9); plip(t, rr(2600, 5200), rr(0.01, 0.025), clamp(pan + rr(-0.3, 0.3), -1, 1), N.far); }
    reap(o, [o, og]); reap(nb, [nb, lp, ng, bus, pn]);
  }

  // ================================================================== music: "Neon Pelican" (darksynth, A minor)
  const mus = { bar: -INTRO.length, step: 0, nextT: 0, bpm: 100, bpm0: 100, bpm1: 100, arr: null, info: null, lastMode: '', crooning: false, lastLead: -1, verse: 0 };
  function rung(raw, cur) {             // snap to the tempo ladder with hysteresis (85 % of a rung)
    const L = AUDIO.tempi; let best = L[0];
    for (const v of L) if (Math.abs(v - raw) < Math.abs(best - raw)) best = v;
    const i = L.indexOf(cur);
    if (i >= 0 && best !== cur) { const gap = best > cur ? (L[i + 1] ?? cur) - cur : cur - (L[i - 1] ?? cur); if (Math.abs(raw - cur) < gap * 0.85) return cur; }
    return best;
  }
  function moodOf() {
    if (heavy > 0.3) return 'rain';
    const td = ((tod % 1) + 1) % 1;
    if (td >= 0.86 || td < 0.2) return 'dark';
    if (td >= 0.74) return 'acid';
    if (td < 0.62) return 'day';
    return 'drive';
  }
  function tempoTarget() {
    if (coasting) return mus.bpm1;      // a coast holds the pre-coast rung (the coast already strips the drums)
    let raw = 64 + 0.6 * cadence;
    const m = moodOf();
    if (m === 'dark' || m === 'rain') raw *= 0.94;
    return rung(clamp(raw, 80, 128), mus.bpm1);
  }
  // one arrangement per bar: mood × district × song section × pass (verse) × coasting
  function arrangement(bar) {
    const mode = moodOf(), d = district;
    const b = bar < 0 ? -1 : bar % SONG_BARS, sec = bar < 0 ? -1 : Math.floor(b / 8), bi = bar < 0 ? bar + INTRO.length : b % 8;
    const cyc = bar < 0 ? 0 : Math.floor(bar / SONG_BARS);
    const A = { mode, sec, bi, cyc, tr: cyc % 3 === 2 ? 2 : 0, intro: bar < 0, district: d };
    // drums
    A.kick = [0, 4, 8, 12]; A.snare = [4, 12]; A.hat = 'off'; A.clap = false;
    A.bass = 'pulse'; A.gate = [1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1]; A.lead = 'saw'; A.arp = 'saw'; A.arpUp = 0;
    A.lp = 16000; A.drive = 0.15; A.dly = 0.3; A.levels = { kick: 1, snare: 1, hat: 1, bass: 1, pad: 1, arp: 1, lead: 1 }; A.acid = false;
    if (mode === 'dark') { A.kick = [0, 3, 8, 10]; A.snare = [8]; A.bass = 'drive16'; A.drive = 0.8; A.lead = 'square'; A.gate = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0]; A.levels.pad = 0.8; A.lp = 9000; }
    else if (mode === 'acid') { A.acid = true; A.drive = 0.35; }
    else if (mode === 'day') { A.hat = 'off'; A.levels.kick = 0.8; A.levels.snare = 0.7; A.gate = null; A.levels.lead = 0.85; A.drive = 0; A.clap = true; }
    else if (mode === 'rain') { A.kick = [0, 8]; A.snare = [4, 12]; A.levels.snare = 0.55; A.bass = 'eighth'; A.gate = null; A.lp = 3200; A.dly = 0.45; A.levels.lead = 0.8; A.levels.hat = 0.6; }
    // the district
    if (d === 'funfair') { A.arp = 'chip'; A.arpUp = 12; }
    if (d === 'railway') A.hat = '16';
    if (d === 'cliffs') { A.lp = Math.min(A.lp, 1300); A.dly = 0.5; }
    if (d === 'dunes') A.drive = Math.max(A.drive, 0.9);
    if (d === 'pines') { A.snare = []; A.gate = null; A.levels.pad = 1.2; }
    if (d === 'pier' || d === 'harbour') A.dly = Math.max(A.dly, 0.45);
    A.koto = d === 'fort';
    A.sweep = d === 'lighthouse';
    // the song form
    if (A.intro) { A.kick = []; A.snare = []; A.hat = 'none'; A.bass = 'hold'; A.lead = null; A.levels.pad = 1; A.lp = Math.min(A.lp, bi === 0 ? 1200 : 3000); }
    else if (sec === 0) { A.lead = cyc === 0 ? 'pluck' : A.lead; if (bi < 2 && cyc === 0) A.snare = []; }
    else if (sec === 1) { A.riser = bi >= 6; A.fill = bi === 7; }
    else if (sec === 2) { A.crash = bi === 0; A.dbl = cyc >= 1 || mode === 'drive'; A.levels.lead *= 1.05; A.fill = bi === 7; }
    else if (sec === 3) {
      if (cyc % 2 === 1) {             // odd passes: the bridge becomes a breakdown and a build back into the verse
        A.breakdown = true; A.kick = bi < 4 ? [] : bi < 6 ? [0, 8] : [0, 4, 8, 12];
        A.snare = bi < 4 ? [] : bi === 4 ? [0, 4, 8, 12] : bi === 5 ? [0, 2, 4, 6, 8, 10, 12, 14] : Array.from({ length: 16 }, (_, i) => i);
        A.roll = bi >= 4; A.bass = bi < 4 ? 'hold' : A.bass; A.lp = Math.min(A.lp, 700 + bi * 900); A.riser = bi >= 6; A.hat = bi < 4 ? 'none' : A.hat;
      } else { A.kick = [0, 8]; A.snare = [8]; A.lead = A.lead === 'pluck' ? 'saw' : A.lead; A.crash = bi === 0; A.fill = bi === 7; }
    }
    // the pace: a sprint opens the hats up, a coast strips the drums
    if (cadence > 86 && !coasting && A.hat === 'off') A.hat = '16';
    if (coasting) { A.kick = []; A.snare = []; A.bass = 'hold'; A.leadMute = true; A.fill = false; A.riser = false; A.roll = false; }
    // (loudness) the darksynth mood runs hot: trim it ~1.5 dB and ease the bass overdrive (RMS target -24…-14 dBFS)
    if (A.mode === 'dark') { for (const k in A.levels) A.levels[k] *= 0.84; A.levels.lead *= 0.72; A.levels.arp *= 0.85; A.drive = Math.min(A.drive, 0.6); }   // the square lead is the hot part
    return A;
  }
  function barInfo(bar, A) {
    if (bar < 0) { const c = INTRO[bar + INTRO.length]; return { chords: [c, c], notes: [], bi: bar + INTRO.length, sec: 'intro' }; }
    const b = bar % SONG_BARS, sec = SONG_P[Math.floor(b / 8)], bi = b % 8;
    let ch = sec.ch[bi].slice();
    if (ch.length === 1) ch = [ch[0], ch[0]];
    return { chords: ch, notes: sec.notes[bi], bi, sec: sec.name, title: sec.title };
  }
  const chordPcs = (name, tr, color) => { const c = CHORD[name] || CHORD.Am; let p = c.map(x => (x + tr) % 12); if (color && COLOR[name] != null) p = [...p, (COLOR[name] + tr) % 12]; return p; };
  const chordRoot = (name, tr) => ((CHORD[name] || CHORD.Am)[0] + tr) % 12;
  function voicing(pcs, lo, hi, max) { const v = []; for (let m = lo; m <= hi; m++) if (pcs.includes(m % 12)) v.push(m); return v.slice(0, max); }
  const bassMidi = pc => 28 + ((pc - 4 + 12) % 12);     // E1 … D#2

  // --- persistent voices (built when the music is first switched on)
  function buildMusic() {
    const t0 = now();
    const musIn = G(1), musLp = F('lowpass', 16000, 0.5), musDuck = G(1), musLvl = G(0);
    wire(musIn, musLp, musDuck, musLvl, N.music);
    const musSend = G(0.18); musLvl.connect(musSend); musSend.connect(N.vin.music);
    const part = k => { const g = G(inst && !inst.has(k) ? 0 : 1); return g; };
    // sidechain pump (pad + arp breathe with the kick)
    const pump = G(1); pump.connect(musIn);
    // drums bus
    const drums = G(1); drums.connect(musIn);
    const P = { kick: part('kick'), snare: part('snare'), hat: part('hat') };
    for (const k in P) P[k].connect(drums);
    const lv = {};
    // bass: saw + square sub → resonant lowpass (filter env) → VCA → clean / overdriven paths
    const bo1 = O('sawtooth', 55), bo2 = O('square', 27.5), bo2g = G(0.5), bF = F('lowpass', 300, 5), bV = G(0), bClean = G(1), bDrv = ac.createWaveShaper(), bDrvG = G(0);
    bDrv.curve = N.drive; bDrv.oversample = '2x';
    lv.bass = part('bass');
    wire(bo1, bF); wire(bo2, bo2g, bF); wire(bF, bV); wire(bV, bClean, lv.bass); wire(bV, bDrv, bDrvG, lv.bass); lv.bass.connect(musIn);
    // pad: 4 voices × 2 detuned saws, alternately panned → lowpass → gate VCA → pump
    const padF = F('lowpass', 1800, 0.7), padV = G(0); lv.pad = part('pad');
    const pad = [];
    for (let i = 0; i < 4; i++) {
      const pn = Pan(i % 2 ? 0.45 : -0.45), a = O('sawtooth', 220), b = O('sawtooth', 220), vg = G(0.25);
      a.detune.value = -9; b.detune.value = 8; wire(a, vg); wire(b, vg); wire(vg, pn, padF); pad.push([a, b, vg]);
    }
    wire(padF, padV, lv.pad, pump);
    // arpeggio: one saw / chiptune voice → plucky filter env → VCA → pump, + a tempo-synced delay
    const ao = O('sawtooth', 440), aF = F('lowpass', 1200, 4), aV = G(0); lv.arp = part('arp');
    const aDl = ac.createDelay(1.5), aFb = G(0.35), aWet = G(0.35), aDlF = F('lowpass', 3000, 0.7), aPan = Pan(-0.25);
    wire(ao, aF, aV, lv.arp, aPan, pump); wire(lv.arp, aDl, aDlF, aFb, aDl); wire(aDlF, aWet, Pan(0.4), pump);
    // lead: 2 detuned saws (+ an octave saw for the hook), delayed vibrato, legato portamento → filter → VCA → ping-pong
    const l1 = O('sawtooth', 440), l2 = O('sawtooth', 440), l3 = O('sawtooth', 880), l3g = G(0), lF = F('lowpass', 3200, 1.2), lV = G(0);
    l2.detune.value = 11;
    const vib = O('sine', 5.3), vibG = G(0); wire(vib, vibG); vibG.connect(l1.detune); vibG.connect(l2.detune); vibG.connect(l3.detune);
    lv.lead = part('lead');
    wire(l1, lF); wire(l2, lF); wire(l3, l3g, lF); wire(lF, lV, lv.lead, musIn);
    const dL = ac.createDelay(1.5), dR = ac.createDelay(1.5), dFb = G(0.3), dWet = G(0.3), dLp = F('lowpass', 3500, 0.7), pL = Pan(-0.7), pR = Pan(0.7);
    wire(lv.lead, dL, dLp, pL, dWet); wire(dLp, dR, pR, dWet); wire(dR, dFb, dL); dWet.connect(musIn);
    const lSend = G(0.25); lv.lead.connect(lSend); lSend.connect(N.vin.music);
    // the pelican's vocoder croon (persistent carrier + band bank; hums the hook while coasting)
    const cr = O('sawtooth', 220), crSq = O('square', 220), crSqG = G(0.3), crMix = G(1), crV = G(0), crOut = G(0.14), crPan = Pan(0.08);
    wire(cr, crMix); wire(crSq, crSqG, crMix);
    const crGs = bandGains('m');
    const crCh = BANDS.map((fc, i) => { const f = F('bandpass', fc, 5.5), g = G(crGs[i] * 2.4); wire(crMix, f, g, crV); return g; });
    const crVib = O('sine', 5), crVibG = G(0); wire(crVib, crVibG); crVibG.connect(cr.detune); crVibG.connect(crSq.detune);
    wire(crV, crOut, crPan, N.voice); send(crPan, 0.25, 'voice');
    lv.fx = part('fx'); lv.fx.connect(musIn);
    const all = [bo1, bo2, ao, l1, l2, l3, vib, cr, crSq, crVib, ...pad.flatMap(p => [p[0], p[1]])];
    for (const o of all) o.start(t0);
    M = { musIn, musLp, musDuck, musLvl, pump, drums, P, lv, bo1, bo2, bF, bV, bClean, bDrvG, pad, padF, padV, ao, aF, aV, aDl, aFb, aWet,
      l1, l2, l3, l3g, lF, lV, vibG, dL, dR, dFb, dWet, cr, crSq, crV, crVibG, crCh, all, lastBass: -1 };
  }
  function killMusic() {
    if (!M) return;
    for (const o of M.all) try { o.stop(); } catch { /* stopped */ }
    try { M.musLvl.disconnect(); } catch { /* gone */ }
    M = null;
  }

  // --- one-shots: drums, riser, crash, koto, stings
  function kick(at, vel) {
    const o = O('sine', 150), g = G(0), c = O('triangle', 1800), cg = G(0); wire(o, g, M.P.kick); wire(c, cg, M.P.kick);
    o.frequency.setValueAtTime(160, at); o.frequency.exponentialRampToValueAtTime(46, at + 0.09);
    const e = envAD(g.gain, at, vel, 0.002, 0.34); envAD(cg.gain, at, vel * 0.25, 0.0015, 0.008);
    o.start(at); o.stop(e); c.start(at); c.stop(at + 0.02); reap(o, [o, g, c, cg]);
    // sidechain pump on the pad + arp
    const p = M.pump.gain; p.setTargetAtTime(0.35, at, 0.004); p.setTargetAtTime(1, at + 0.05, 0.09);
  }
  function snare(at, vel, gated = true) {   // tone + noise, and the 80s gated reverb: a dense flat tail cut dead
    const pn = Pan(0), bus = G(vel); wire(bus, pn, M.P.snare); send(pn, 0.12, 'music');
    const o = O('triangle', 190), og = G(0); o.frequency.setValueAtTime(210, at); o.frequency.exponentialRampToValueAtTime(165, at + 0.06); wire(o, og, bus);
    const e1 = envAD(og.gain, at, 0.5, 0.001, 0.09);
    const s = bufSrc(N.whiteB), bp = F('bandpass', 2100, 0.6), sg = G(0); wire(s, bp, sg, bus);
    const e2 = envAD(sg.gain, at, 0.7, 0.0025, 0.13);
    const tl = bufSrc(N.pinkB), tlp = F('lowpass', 6500, 0.5), thp = F('highpass', 500, 0.5), tg = G(0); wire(tl, thp, tlp, tg, bus);
    const hold = gated ? 0.21 : 0.06;
    tg.gain.setValueAtTime(0, at + 0.004); tg.gain.linearRampToValueAtTime(0.5, at + 0.015); tg.gain.linearRampToValueAtTime(0.36, at + hold); tg.gain.linearRampToValueAtTime(0, at + hold + 0.014);
    o.start(at); o.stop(e1); s.start(at, R() * 4); s.stop(e2); tl.start(at, R() * 8); tl.stop(at + hold + 0.03);
    reap(o, [o, og]); reap(s, [s, bp, sg]); reap(tl, [tl, tlp, thp, tg, bus, pn]);
  }
  function clap(at, vel) {
    const s = bufSrc(N.whiteB), bp = F('bandpass', 1500, 1.1), g = G(0), pn = Pan(0.05); wire(s, bp, g, pn, M.P.snare); send(pn, 0.2, 'music');
    let t = at; for (let i = 0; i < 3; i++) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.002); g.gain.linearRampToValueAtTime(vel * 0.2, t + 0.009); t += 0.011; }
    g.gain.linearRampToValueAtTime(vel * 0.6, t + 0.002); g.gain.exponentialRampToValueAtTime(vel * 0.001, t + 0.16); g.gain.linearRampToValueAtTime(0, t + 0.17);
    s.start(at, R() * 4); s.stop(t + 0.2); reap(s, [s, bp, g, pn]);
  }
  function hat(at, vel, open) {
    const s = bufSrc(N.whiteB), hp = F('highpass', 7600, 0.7), pk = F('peaking', 10500, 1.5), lp = F('lowpass', 14500, 0.7), g = G(0), pn = Pan(0.22); pk.gain.value = 3;
    vel *= 0.72;   // (no clicks) the bright noise hits stay under a 0.3 sample-to-sample step
    wire(s, hp, pk, lp, g, pn, M.P.hat);
    const e = envAD(g.gain, at, vel, 0.002, open ? 0.13 : 0.035); s.start(at, R() * 5); s.stop(e); reap(s, [s, hp, pk, lp, g, pn]);
  }
  function crash(at, vel) {
    const s = bufSrc(N.whiteB), hp = F('highpass', 4200, 0.6), g = G(0), pn = Pan(-0.15); wire(s, hp, g, pn, M.P.hat); send(pn, 0.3, 'music');
    const e = envAD(g.gain, at, vel, 0.002, 1.8); s.start(at, R() * 2); s.stop(e); reap(s, [s, hp, g, pn]);
  }
  function riser(at, dur, vel) {          // white-noise sweep into the next section, cut dead on the downbeat
    const s = bufSrc(N.whiteB, true), bp = F('bandpass', 300, 1.2), g = G(0), pn = Pan(0.1); wire(s, bp, g, pn, M.lv.fx);
    bp.frequency.setValueAtTime(300, at); bp.frequency.exponentialRampToValueAtTime(7000, at + dur);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vel, at + dur); g.gain.linearRampToValueAtTime(0, at + dur + 0.01);
    s.start(at, R() * 3); s.stop(at + dur + 0.03); reap(s, [s, bp, g, pn]);
  }
  function koto(at, midi, vel) {          // the old temple: a pentatonic pluck (triangle, a bent attack, fast decay)
    const f = mtof(midi), o = O('triangle', f), o2 = O('sine', f * 3.01), g = G(0), g2 = G(0.15), pn = Pan(0.35);
    o.frequency.setValueAtTime(f * 1.03, at); o.frequency.exponentialRampToValueAtTime(f, at + 0.04);
    wire(o, g); wire(o2, g2, g); wire(g, pn, M.lv.fx); send(pn, 0.3, 'music');
    const e = envAD(g.gain, at, vel, 0.002, 0.7); o.start(at); o2.start(at); o.stop(e); o2.stop(e); reap(o, [o, o2, g, g2, pn]);
  }
  function playSting(kind, at, I, A) {
    const pcs = chordPcs(I.chords[0], A.tr, false), top = voicing(pcs, 76, 93, 5);
    if (!top.length) return;
    if (kind === 'gulp') top.forEach((m, i) => blip(at + i * (60 / mus.bpm / 4), m, 0.09, 0.05, 0.2, 'chip', M.lv.fx));      // power-up arpeggio in 16ths
    else if (kind === 'wave') top.slice(0, 3).reverse().forEach((m, i) => blip(at + i * (60 / mus.bpm / 4), m + 12, 0.08, 0.035, -0.2, 'square', M.lv.fx));
    logCue('sting', at, { sting: kind });
  }

  // --- bar line: levels, filters, delay times for this bar
  function barStart(bar, t, beat) {
    const A = mus.arr = arrangement(bar);
    if (A.mode !== mus.lastMode) { logCue('arr', t, { mode: A.mode, district: A.district }); mus.lastMode = A.mode; }
    mus.info = barInfo(bar, A);
    const lv = M.lv, L = A.levels, on = musicOn ? 1 : 0, m = k => (inst && !inst.has(k) ? 0 : 1);
    glide(M.musLvl.gain, on * 0.3, t, musicOn ? 0.6 : 0.3);
    glide(M.musLp.frequency, A.lp, t, A.breakdown ? 0.6 : 0.25);
    glide(lv.bass.gain, m('bass') * L.bass * 0.4, t, 0.2);
    glide(lv.pad.gain, m('pad') * L.pad * (A.intro ? 0.9 : 0.62), t, 0.4);
    glide(lv.arp.gain, m('arp') * L.arp * (A.arp === 'chip' ? 0.36 : 0.5), t, 0.3);
    glide(lv.lead.gain, m('lead') * L.lead * (A.leadMute || !A.lead ? 0 : 0.46), t, 0.25);
    glide(M.P.kick.gain, m('kick') * L.kick, t, 0.1); glide(M.P.snare.gain, m('snare') * L.snare * 2.2, t, 0.1); glide(M.P.hat.gain, m('hat') * L.hat * 1.2, t, 0.1);
    glide(M.bClean.gain, 1 - 0.7 * A.drive, t, 0.3); glide(M.bDrvG.gain, 0.55 * A.drive, t, 0.3);
    glide(M.l3g.gain, A.dbl ? 0.45 : 0, t, 0.3);
    const dly = beat * 0.75;
    glide(M.aDl.delayTime, dly, t, 0.05); glide(M.dL.delayTime, dly, t, 0.05); glide(M.dR.delayTime, dly, t, 0.05);
    glide(M.dFb.gain, A.dly, t, 0.3); glide(M.aFb.gain, A.dly * 0.9, t, 0.3);
    const padCut = A.mode === 'dark' ? 1100 : A.mode === 'day' ? 2600 : A.mode === 'rain' ? 1300 : 1800;
    if (A.sweep) { M.padF.frequency.setTargetAtTime(bar % 2 ? padCut * 0.5 : padCut * 1.8, t, beat * 1.6); }
    else glide(M.padF.frequency, A.intro ? 600 + 900 * (bar + INTRO.length) : padCut, t, A.intro ? beat * 2 : 0.4);
    glide(M.lF.frequency, A.mode === 'dark' ? 1900 : A.mode === 'day' ? 4200 : 3200, t, 0.3);
    for (const o of [M.ao]) { if (A.arp === 'chip') o.setPeriodicWave(N.chip); else o.type = 'sawtooth'; }
    for (const o of [M.l1, M.l2]) o.type = A.lead === 'square' ? 'square' : 'sawtooth';
    // the pad chord changes on the bar (and half bar when split): a smooth voice-led glide
    if (A.crash && musicOn && !coasting) crash(t, 0.22);
    if (A.riser && A.bi === 6 && musicOn) riser(t, beat * 8, 0.1);
  }
  function setPad(t, chord, tr, color) {
    const pcs = chordPcs(chord, tr, color), v = voicing(pcs, 57, 76, 4);
    while (v.length < 4) v.push(v[v.length - 1] + 12);
    M.pad.forEach(([a, b], i) => { const f = mtof(v[i]); glide(a.frequency, f, t, 0.03); glide(b.frequency, f, t, 0.03); });
  }
  // one 16th of the score
  function musicStep(bar, step, t, beat) {
    const A = mus.arr, I = mus.info, tr = A.tr, s16 = beat / 4;
    const half = step < 8 ? 0 : 1, chord = I.chords[half];
    const hum = (v = 1) => v * (0.92 + 0.16 * R());
    if (step === 0 || (step === 8 && I.chords[1] !== I.chords[0])) setPad(t, chord, tr, A.mode !== 'drive' || A.sec === 3);
    // --- pad gate (the 16th trance gate) or a smooth swell
    const pv = M.padV.gain;
    if (A.gate) { const on = A.gate[step]; pv.setTargetAtTime(on ? 1 : 0.12, t, on ? 0.004 : 0.012); }
    else if (step === 0) pv.setTargetAtTime(1, t, 0.08);
    // --- bass
    const root = bassMidi(chordRoot(chord, tr)), bf = M.bF.frequency, bv = M.bV.gain;
    const bassNote = (m, len, vel, cut) => {
      for (const [o, k] of [[M.bo1, 1], [M.bo2, 0.5]]) o.frequency.setValueAtTime(mtof(m) * k, t);
      bv.setTargetAtTime(vel, t, 0.003); bv.setTargetAtTime(0, t + len * 0.72, 0.012);
      bf.setTargetAtTime(cut, t, 0.003); bf.setTargetAtTime(cut * 0.28, t + 0.01, A.acid ? s16 * 1.6 : s16 * 0.6);
    };
    if (A.bass === 'hold') { if (step === 0) { for (const [o, k] of [[M.bo1, 1], [M.bo2, 0.5]]) o.frequency.setTargetAtTime(mtof(root) * k, t, 0.02); bv.setTargetAtTime(0.55, t, 0.05); bf.setTargetAtTime(420, t, 0.05); } if (step === 12) bv.setTargetAtTime(0.25, t, 0.2); }
    else if (A.bass === 'eighth') { if (step % 2 === 0) bassNote(root + (step % 8 === 6 ? 12 : 0), s16 * 2, hum(0.8), 900); }
    else if (A.bass === 'drive16') bassNote(root + (step === 14 ? 12 : 0), s16, hum(step % 4 === 0 ? 0.95 : 0.7), 1500 + (step % 4 === 0 ? 900 : 0));
    else {  // 'pulse': the synthwave octave pulse
      const oct = step % 4 === 2, acc = step % 4 === 0;
      bassNote(root + (oct ? 12 : 0), s16, hum(acc ? 0.95 : 0.72), A.acid ? 700 + 2600 * (0.5 + 0.5 * Math.sin((bar * 16 + step) * 0.2)) : 1300 + (acc ? 700 : 0));
    }
    // --- arpeggio: chord tones up-down in 16ths (the counter pattern changes each pass)
    {
      const tones = voicing(chordPcs(chord, tr, true), 64 + A.arpUp, 88 + A.arpUp, 5);
      if (tones.length) {
        const upDown = [...tones, ...tones.slice(1, -1).reverse()];
        const pat = A.cyc % 2 ? [0, 2, 1, 3, 2, 4, 1, 3] : null;
        const idx = pat ? pat[step % 8] % tones.length : step % upDown.length;
        const m = pat ? tones[idx] : upDown[idx];
        if (!(A.mode === 'rain' && step % 2)) {
          M.ao.frequency.setValueAtTime(mtof(m), t);
          const av = M.aV.gain; av.setTargetAtTime(hum(step % 4 === 0 ? 0.9 : 0.65), t, 0.002); av.setTargetAtTime(0, t + s16 * 0.5, 0.02);
          const af = M.aF.frequency; af.setTargetAtTime(A.arp === 'chip' ? 6000 : 3200, t, 0.002); af.setTargetAtTime(A.arp === 'chip' ? 3000 : 700, t + 0.01, 0.05);
        }
      }
    }
    // --- lead melody (and the pelican's croon on the same notes)
    for (const n of I.notes) if (n.s === step) {
      const m = n.m + tr + (A.lead === 'square' ? -12 : 0), dur = n.d * s16, legato = mus.lastLead >= 0 && Math.abs(m - mus.lastLead) <= 4 && n.s > 0;
      const lv = M.lV.gain, pluck = A.lead === 'pluck';
      for (const [o, k] of [[M.l1, 1], [M.l2, 1], [M.l3, 2]]) { if (legato) o.frequency.setTargetAtTime(mtof(m) * k, t, 0.025); else o.frequency.setValueAtTime(mtof(m) * k, t); }
      lv.setTargetAtTime(pluck ? 0.9 : 0.75, t, legato ? 0.01 : 0.004);
      if (pluck) lv.setTargetAtTime(0.0, t + 0.02, 0.12);
      else lv.setTargetAtTime(0, t + Math.max(s16, dur - 0.04), 0.03);
      M.vibG.gain.setTargetAtTime(0, t, 0.01); if (dur > beat * 0.9) M.vibG.gain.setTargetAtTime(14, t + beat * 0.5, 0.15);
      M.lF.frequency.setTargetAtTime((A.mode === 'dark' ? 1900 : 3400) * 1.5, t, 0.005); M.lF.frequency.setTargetAtTime(A.mode === 'dark' ? 1500 : 2600, t + 0.02, 0.2);
      mus.lastLead = m;
      if (mus.crooning) croonNote(t, n.m + tr - 12, dur);
      if (A.koto && musicOn && n.d >= 4) {             // the temple answers with a pentatonic figure a beat later
        const pent = [57, 60, 62, 64, 67, 69, 72, 74, 76].map(x => x + tr), k = Math.floor(hash(bar * 16 + step, 5) * 5);
        koto(t + beat, pent[k + 2], 0.28); koto(t + beat * 1.5, pent[k + 1], 0.22); if (n.d >= 8) koto(t + beat * 2, pent[k + 3], 0.2);
      }
    }
    // --- drums
    if (A.kick.includes(step)) kick(t, hum(0.9));
    if (A.snare.includes(step)) {
      if (A.roll) snare(t, hum(0.35 + 0.5 * (step / 16)) * (A.bi === 7 ? 1 : 0.7), false);
      else if (A.clap) clap(t, hum(0.5));
      else snare(t, hum(0.85), true);
    }
    if (A.fill && step >= 12 && !A.snare.includes(step)) snare(t, hum(0.25 + 0.12 * (step - 12)), false);
    if (A.hat === 'off' && step % 4 === 2) hat(t, hum(0.35), true);
    else if (A.hat === '16') hat(t, hum(step % 4 === 2 ? 0.34 : step % 2 ? 0.14 : 0.2), step % 4 === 2);
    if (A.intro && step % 4 === 2 && bar + INTRO.length === 1) hat(t, 0.1 + 0.02 * step, false);
    // --- event stings, quantised to the beat
    if (step % 4 === 0) for (let i = stings.length - 1; i >= 0; i--) {
      const s = stings[i];
      if (t >= s.notBefore) { stings.splice(i, 1); if (t - s.notBefore < 1.2) playSting(s.kind, t, I, A); }
    }
  }
  function croonNote(at, midi, dur) {     // "mm" opening to "oo", a lazy portamento, delayed vibrato
    const f = mtof(clamp(midi, 50, 66));
    glide(M.cr.frequency, f, at - 0.01, 0.03); glide(M.crSq.frequency, f, at - 0.01, 0.03);
    glide(M.crV.gain, 0.8, at, 0.03); glide(M.crV.gain, 0.4, at + Math.max(0.05, dur - 0.06), 0.03);
    glide(M.crVibG.gain, 0, at, 0.02); glide(M.crVibG.gain, 16, at + 0.2, 0.12);
    const g1 = bandGains('m'), g2 = bandGains('u');
    M.crCh.forEach((g, i) => { glide(g.gain, g1[i] * 2.4, at, 0.03); if (dur > 0.4) glide(g.gain, g2[i] * 2.4, at + 0.2, 0.1); });
  }
  function musicPump(t) {
    const until = t + AUDIO.musicAhead;
    if (mus.nextT < t - 0.05) mus.nextT = t + 0.03;                       // fell behind (tab away / paused): no backlog
    while (mus.nextT < until) {
      if (mus.step === 0) {          // bar line: one rung of tempo per bar, as an accelerando across the bar
        mus.bpm0 = mus.bpm1; mus.bpm1 = tempoTarget();
        const L = AUDIO.tempi, i0 = L.indexOf(mus.bpm0), i1 = L.indexOf(mus.bpm1);
        if (i0 >= 0 && i1 >= 0 && Math.abs(i1 - i0) > 2) mus.bpm1 = L[i0 + 2 * Math.sign(i1 - i0)];   // up to two rungs a bar: a sprint is an accelerando within ~2 bars
        if (mus.bpm1 !== mus.bpm0) logCue('tempo', mus.nextT, { bpm: mus.bpm1 });
        try { barStart(mus.bar, mus.nextT, 60 / mus.bpm0); } catch (err) { console.warn('[audio] music', err); }
      }
      const k = mus.step / 16, bpm = mus.bpm0 + (mus.bpm1 - mus.bpm0) * k; mus.bpm = bpm;
      const beat = 60 / bpm;
      if (mus.arr) try { musicStep(mus.bar, mus.step, mus.nextT, beat); } catch (err) { console.warn('[audio] music', err); }
      mus.nextT += beat / 4;
      if (++mus.step === 16) { mus.step = 0; mus.bar++; }
    }
  }
  function setMusic(on) {
    const was = musicOn; musicOn = !!on;
    if (!ac || !N) return;
    if (musicOn && !was) {
      if (killTimer) { clearTimeout(killTimer); killTimer = 0; }
      if (!M) buildMusic();
      mus.bar = -INTRO.length; mus.step = 0; mus.nextT = now() + 0.1; mus.bpm1 = rung(64 + 0.6 * cadence, 100); mus.lastLead = -1;
      caption('music'); logCue('music', now(), { on: true });
    }
    if (!musicOn && was && M) {
      const t = now();
      glide(M.musLvl.gain, 0, t, 0.25); glide(M.crV.gain, 0, t, 0.1);
      logCue('music', t, { on: false });
      if (!offline) killTimer = setTimeout(() => { killTimer = 0; if (!musicOn) killMusic(); }, 1600);   // free the voices
    }
  }

  // ------------------------------------------------------------------ rig events → sim-time cues
  const CUES = {
    bell: [[AUDIO.bellStrikes[0], bell]],
    hop: [[0.05, (at) => whoosh(at, 0.2, 300, 700, 0.022)], [HOP.takeoff - 0.09, (at) => { say(at, VOICE.hup, { amp: 0.8 }); caption('hup'); logCue('hup', at); }],
      [HOP.takeoff, (at) => { scuff(at); ramp(N.tyreGate.gain, 0, at, 0.03); whoosh(at, HOP.land - HOP.takeoff, 500, 1200, 0.045); }],
      [HOP.land, (at) => { thump(at); ramp(N.tyreGate.gain, 1, at, 0.02); }], [HOP.land + 0.05, (at) => say(at, VOICE.oof, { amp: 0.55 })]],
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
  // director encounters → sounds (thresholds in director "u" = seconds at 60 rpm since the mark)
  const ENC_CUES = {
    cat: [[-0.32, () => { say(now() + 0.02, VOICE.meow, { amp: 0.5, pan: 0.35, dest: N.far, carrier: 'square' }); caption('meow'); logCue('meow', now()); }]],
    friend: [[-3.55, () => { say(now() + 0.02, VOICE.honk, { amp: 0.45, pan: screenPan('[data-ref^="dir-friend"]') ?? -0.4, dest: N.far }); caption('friend'); logCue('friend', now()); }]],
    cyclist: [[-1.0, () => { const t = now() + 0.02; chimeStrike(t, 91, 0.45, 0.55, N.far); chimeStrike(t + 0.16, 91, 0.35, 0.55, N.far); whoosh(t + 0.6, 0.8, 600, 1600, 0.03, 0.3, N.far); caption('ding'); logCue('ding', t); }]],
    gulls: [[-0.4, () => gullCall(now() + 0.02, true, 0.45)], [0.95, () => gullCall(now() + 0.02, true, -0.2)]],
    fish: [[-0.1, () => { splash(now() + 0.02, 0.1, 0.55, N.far); hudSeq(now() + 0.12, [88, 93], 0.02, 0.04, 'sine', 0.55); caption('splash'); }], [0.72, () => splash(now() + 0.02, 0.06, 0.2, N.far)]],
    kites: [[0, () => droneBy(now() + 0.02, false)]],
  };
  function encounters(fr) {
    const dz = fr.director; if (!dz || !dz.enc || paused) return;
    const seenNow = new Set();
    for (const { kind, u, e } of dz.enc) {
      const key = kind + ':' + Math.round((e && e.D) || 0); seenNow.add(key);
      const prev = encSeen.get(key); encSeen.set(key, u);
      if (prev === undefined || u < prev || u - prev > 1) continue;              // first sight / jump: no retro cues
      for (const [thr, fn] of ENC_CUES[kind] || []) if (prev < thr && u >= thr) { try { fn(e); } catch (err) { console.warn('[audio] enc', err); } }
      if (kind === 'fireworks' && lampOn > 0.3 && u > 0 && u < 2.2 * 250 / 26) {
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
    }
    for (const k of encSeen.keys()) if (!seenNow.has(k)) encSeen.delete(k);
  }
  // thunder on weather.js's lightning clock (the same hash schedule), the roll arriving after the flash
  function lightning(fr) {
    if (heavy <= 0.3 || reduced) { lastFlashN = null; return; }
    const P = 3.1, n = Math.floor((fr.t + 0.7) / P);
    if (lastFlashN === null) { lastFlashN = n; return; }
    if (n !== lastFlashN) {
      lastFlashN = n;
      if (hash(n, 206) < 0.42 && !paused) { const dist = hash(n, 209); thunder(now() + 0.3 + 1.6 * dist, dist); }
    }
  }

  // ------------------------------------------------------------------ scheduler (audio time)
  function pump() {
    if (!ac || !N) return;
    const t = now(), until = t + AUDIO.lookahead;
    if (tickOn && tickRate > 1 && !paused) {
      if (nextTick < t) nextTick = t + 0.004;
      while (nextTick < until) { tick(nextTick); nextTick += 1 / tickRate; }
    } else nextTick = 0;
    if (M && musicOn && !paused) musicPump(t); else mus.nextT = t + 0.05;
    if (paused) return;
    const d = district, waterside = d === 'pier' || d === 'harbour' || d === 'bridge';
    if (nextSwell < until) { const s = Math.max(nextSwell, t); const D = waterside ? swell(s) : 4; nextSwell = s + D * rr(0.6, 1); }
    if (nextGull < until) { const s = Math.max(nextGull, t); if (gullsOn && waterside && night < 0.95 && rainK < 0.5) gullCall(s); nextGull = s + rr(14, 30); }
    if (rainK > 0.03 && nextDrip < until) { const s = Math.max(nextDrip, t); plip(s, rr(1700, 4200), 0.012 + 0.02 * rainK, rr(-0.9, 0.9)); nextDrip = s + rr(0.05, 0.4) / (0.2 + rainK); }
    else if (rainK <= 0.03) nextDrip = t + 0.2;
    if (nextCrackle < until) { const s = Math.max(nextCrackle, t); const neon = d === 'village' || d === 'return' || d === 'funfair' || d === 'harbour'; if (neon || R() < 0.3) crackle(s); nextCrackle = s + rr(6, 16) * (neon ? 1 : 1.6); }
    if (nextSiren < until) { const s = Math.max(nextSiren, t); siren(s); nextSiren = s + rr(38, 80) * (night > 0.85 ? 0.75 : 1); }
    if (nextDrone < until) { const s = Math.max(nextDrone, t); droneBy(s, d === 'pier' && R() < 0.4); nextDrone = s + (d === 'pier' ? rr(9, 18) : rr(20, 42)); }
    if (nextMaglev < until) { const s = Math.max(nextMaglev, t); maglev(s); nextMaglev = s + (d === 'railway' ? rr(22, 38) : rr(80, 150)); }
    if (nextPA < until) { const s = Math.max(nextPA, t); if (d === 'railway' || night > 0.9) paChime(s); nextPA = s + rr(55, 110); }
    if (nextHorn < until) { const s = Math.max(nextHorn, t); if (waterside && ((wx.fog || 0) > 0.35 || night > 0.9)) harbourHorn(s); nextHorn = s + rr(45, 85); }
    if (nextBarge < until) { const s = Math.max(nextBarge, t); if (waterside) bargeHorn(s); nextBarge = s + rr(60, 120); }
    if (nextHmm < until) {                       // the odd contented vocoder "hmm-hm"
      const s = Math.max(nextHmm, t);
      if (s > voiceUntil + 1 && !mus.crooning) { say(s, VOICE.hmm, { amp: 0.7 }); caption('hmm'); logCue('hmm', s); }
      nextHmm = s + rr(32, 60);
    }
  }

  // ------------------------------------------------------------------ continuous controls (≈20 Hz)
  function controls(fr) {
    const t = now();
    const s = clamp(fr.speed / V_MAX, 0, 1.2); speedN = s; cadence = fr.cadence;
    wx = fr.weather || {}; tod = fr.tod ?? tod; night = fr.night || 0; lampOn = fr.pal && fr.pal.num ? (fr.pal.num.lampOn ?? 1) : 1;
    reduced = !!fr.reduced;
    // rain: the city's drizzle (as drawn by weather.js) and the director's downpour
    const clearK = sstep(0.05, 0.55, wx.bow || 0), smog = sstep(0.1, 0.7, wx.fog || 0);
    const lite = 0.34 * (1 - clearK) * (1 - 0.55 * smog);
    rainK = Math.max(wx.rain || 0, lite); heavy = sstep(0.45, 0.95, wx.rain || 0);
    // district + a HUD "new waypoint" bleep when a stretch begins (live riding only)
    const st = wx.stretch || district;
    if (lastStretch !== null && st !== lastStretch && !paused) { const at = t + 0.05; hudSeq(at, [76, 83, 88, 81], 0.04, 0.07); logCue('mission', at, { district: st }); caption('mission'); }
    lastStretch = st; district = st;
    // calm wind: a slow random walk (a third of edition C's rate), no whistle
    const wind = wx.wind ?? 0.2, calm = 0.5 + 0.6 * wind;
    gustV += (R() - 0.5) * 0.03 - (gust - 1) * 0.02; gustV *= 0.95; gust = clamp(gust + gustV, 0.75, 1.3);
    const hold = hops.some(h0 => fr.t - h0 >= HOP.hold0 && fr.t - h0 < HOP.hold1);
    const pedal = !fr.coasting && !hold && fr.cadence > 1;
    const wet = Math.max(wx.wet || 0, rainK * 0.8);
    glide(N.windG.gain, (0.04 + 0.45 * s * s) * gust * calm, t, 0.8);
    glide(N.windBp.frequency, 280 + 600 * s + 120 * (gust - 1), t, 0.9);
    glide(N.roadG.gain, 0.4 * s * (1 + 0.3 * wet), t, 0.2); glide(N.roadLp.frequency, 240 + 480 * s + 600 * wet, t, 0.3);
    glide(N.gritG.gain, 0.02 * s * (1 + 2.2 * wet), t, 0.2);
    glide(N.chG.gain, pedal ? 0.1 * (0.45 + s) : 0, t, 0.05);
    glide(N.humG.gain, pedal ? 0.07 * (0.3 + s) : 0, t, 0.05);
    glide(N.chOsc.frequency, Math.max(1, (fr.cadence / 60) * AUDIO.teeth), t, 0.05);
    glide(N.humOsc.frequency, Math.max(0.5, (fr.cadence / 60) * 2), t, 0.05);         // two pedal strokes per turn
    glide(N.chBp.frequency, 2300 + 900 * s, t, 0.1);
    glide(N.tickBus.gain, 0.4 * (0.6 + 0.5 * Math.min(1, s)), t, 0.1);
    const waterside = district === 'pier' || district === 'harbour' || district === 'bridge';
    glide(N.seaG.gain, waterside ? 0.08 : 0.025, t, 1.5);
    glide(N.rainG.gain, 0.08 * rainK + 0.05 * heavy, t, 0.8); glide(N.rainLp.frequency, 6500 + 1500 * heavy, t, 1);
    glide(N.patG.gain, 0.16 * rainK + 0.3 * heavy, t, 0.8);
    const tunnel = district === 'cliffs';
    glide(N.cityG.gain, (0.21 + 0.06 * night) * (tunnel ? 1.8 : 1), t, 1.5);   // the city bed (+3.5 dB: sound-on cruise sits above the -24 dBFS floor)
    glide(N.cmG.gain, tunnel ? 0.06 : 0.03, t, 1.5);
    const neonD = district === 'village' || district === 'return' || district === 'funfair' || district === 'harbour';
    glide(N.nhG.gain, (0.004 + 0.006 * night) * (neonD ? 1.6 : 0.8) * (0.8 + 0.4 * R()), t, 0.4);
    for (const src of [N.windSrc, N.roadSrc]) glide(src.playbackRate, 0.94 + 0.12 * R(), t, 2.5);   // no audible loop
    gullsOn = !fr.toggles || fr.toggles.gulls !== false;
    // coasting croon: starts ~0.6 s into a coast (music on), stops on the first pedal stroke or when the pelican talks
    if (fr.coasting && !coasting) coastSince = t;
    coasting = !!fr.coasting;
    const croon = !!M && musicOn && coasting && !hold && t - coastSince > 0.6 && t > voiceUntil + 0.3 && !paused;
    if (croon && !mus.crooning) { logCue('hum', t); caption('hum'); }
    if (!croon && mus.crooning && M) { M.crV.gain.cancelScheduledValues(t); glide(M.crV.gain, 0, t, 0.12); }
    mus.crooning = croon;
    // music duck: rig events, the pelican's voice, HUD bleeps, nearby gags
    if (M) {
      let near = false; const dz = fr.director;
      if (dz && dz.enc) for (const { kind, u } of dz.enc) if (kind !== 'kites' && kind !== 'fireworks' && u > -1.5 && u < 2) near = true;
      const dk = t < duckUntil ? 0.5 : t < voiceUntil ? 0.62 : t < hudUntil ? 0.8 : near ? 0.8 : 1;
      glide(M.musDuck.gain, dk, t, dk < 1 ? 0.06 : 0.5);
    }
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

  // ---- mech suit (egg #1, fx/mech.js): servo whirs + latch clicks per plate group, a rising power-up whine, a bass
  // "thoom" when the suit locks, HUD bleeps. Scheduled once at the egg's start from its X-sheet times (MK / STG).
  function servo(at, dur, f0, f1, amp, pan = 0.1) {
    const o = O('sawtooth', f0), bp = F('bandpass', f0 * 3, 3), g = G(0), pn = Pan(pan);
    o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f1, at + dur);
    bp.frequency.setValueAtTime(f0 * 3, at); bp.frequency.exponentialRampToValueAtTime(f1 * 3, at + dur);
    wire(o, bp, g, pn, N.fx); send(pn, 0.1);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(amp, at + 0.02); g.gain.setValueAtTime(amp, at + dur * 0.8); g.gain.linearRampToValueAtTime(0, at + dur);
    o.start(at); o.stop(at + dur + 0.02); reap(o, [o, bp, g, pn]);
  }
  function latch(at, amp = 0.4, rate = 1) {
    const sb = bufSrc(N.clicks[Math.floor(R() * 3)], false, rate), bp = F('bandpass', 2600 * rate, 2.5), g = G(amp), pn = Pan(0.1);
    wire(sb, bp, g, pn, N.fx); sb.start(at); reap(sb, [sb, bp, g, pn]);
  }
  function thoom(at) {
    const o = O('sine', 70), g = G(0); o.frequency.setValueAtTime(70, at); o.frequency.exponentialRampToValueAtTime(34, at + 0.6);
    wire(o, g, N.fx); const e = envAD(g.gain, at, 0.7, 0.006, 0.7); o.start(at); o.stop(e); reap(o, [o, g]);
    ramp(N.duck.gain, 0.5, at, 0.02); ramp(N.duck.gain, 1, at + 0.5, 0.8);
  }
  function mechSeq(at, on) {
    if (!on) { [0, 0.25, 0.5, 0.75, 1.0].forEach((d, i) => { servo(at + d, 0.22, 380 - 40 * i, 160, 0.03); latch(at + d + 0.2, 0.3, 0.8); }); hudSeq(at, [88, 81, 76, 69], 0.035, 0.08); return; }
    hudSeq(at, [81, 88, 81, 88], 0.035, 0.07);                                  // arming: lock-on bleeps
    whoosh(at + 0.05, 0.4, 600, 2400, 0.03, 0);                                 // the scan ring
    [0.4, 0.6, 0.82, 1.02, 1.24, 1.44, 1.66, 1.92].forEach((d, i) => {         // one plate group per stage
      servo(at + d, 0.28, 140 + 30 * i, 420 + 40 * i, 0.028, -0.2 + 0.05 * i);
      latch(at + d + 0.3, 0.42); latch(at + d + 0.36, 0.26, 1.3);
    });
    latch(at + 2.54, 0.6, 0.7);                                                // the visor slams down
    const o = O('sawtooth', 110), lp = F('lowpass', 900, 4), g = G(0);         // rising power-up whine
    o.frequency.setValueAtTime(110, at + 2.5); o.frequency.exponentialRampToValueAtTime(880, at + 3.15);
    lp.frequency.setValueAtTime(600, at + 2.5); lp.frequency.exponentialRampToValueAtTime(4200, at + 3.15);
    wire(o, lp, g, N.fx); g.gain.setValueAtTime(0, at + 2.5); g.gain.linearRampToValueAtTime(0.045, at + 3.1); g.gain.linearRampToValueAtTime(0, at + 3.25);
    o.start(at + 2.5); o.stop(at + 3.3); reap(o, [o, lp, g]);
    thoom(at + 3.2);                                                            // the lock: bass thoom
    hudSeq(at + 3.3, [76, 83, 88, 95], 0.04, 0.06, 'chip');                     // MECH ONLINE bleep
    logCue('mech', at);
  }

  // ------------------------------------------------------------------ bus
  bus.on('rig:event', e => { if (ac) ingest(e); });
  bus.on('ui:play', ({ on } = {}) => { if (!ac) return; if (on === false) { paused = true; applyMaster(); } else if (on === true) { paused = false; lastLive = performance.now(); applyMaster(); } });
  bus.on('ui:volume', ({ value } = {}) => api.setVolume(value));
  bus.on('ui:toggle', ({ key, value } = {}) => {
    if (key === 'music') { musicWant = !!value; if (ac && N) setMusic(musicWant); return; }
    if (live()) hudSeq(now() + 0.01, value ? [84, 91] : [91, 84], 0.03, 0.05);
  });
  bus.on('ui:music', ({ on } = {}) => { musicWant = !!on; if (ac && N) setMusic(musicWant); });
  // HUD feedback for the visor controls (never before the user has opted in to sound)
  bus.on('ui:camera', () => { if (live()) hudSeq(now() + 0.01, [88], 0.03, 0.035); });
  bus.on('ui:tod', ({ tod: td } = {}) => { if (live() && td !== undefined) hudSeq(now() + 0.01, [79, 86], 0.025, 0.04, 'sine'); });
  bus.on('egg:mech', ({ on, stop } = {}) => { if (!stop && live()) mechSeq(now() + 0.02, on); });
  bus.on('egg:found', ({ id } = {}) => {
    if (!id || !live()) return;
    const at = now() + 0.02; hudSeq(at, [69, 76, 81, 88, 93, 100], 0.045, 0.055, 'chip', 0.1);
    duckUntil = Math.max(duckUntil, at + 0.8); logCue('egg', at, { id }); caption('egg');
  });

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
      const isLive = frame.dt > 0;
      if (frame.events) for (const e of frame.events) ingest(e);
      if (!isLive) return;                                                // renderAt(): deterministic stills, no sound
      if (!offline) { lastLive = performance.now(); if (paused) { paused = false; applyMaster(); } }
      const hold = hops.some(h0 => frame.t - h0 >= HOP.hold0 && frame.t - h0 < HOP.hold1);
      tickOn = !!frame.coasting || hold;
      tickRate = (frame.speed / WHEEL_C) * AUDIO.pawls;
      const t = now();
      if (lastCtl < 0 || t - lastCtl >= 0.05 || t < lastCtl) { lastCtl = t; controls(frame); }
      flushCues(frame.t);
      encounters(frame);
      lightning(frame);
      if (offline || opts.clock) pump();
    },
    setVolume(v) { if (typeof v !== 'number' || !isFinite(v)) return; vol = clamp(v, 0, 1); applyMaster(); },
    setMusic(on) { musicWant = !!on; if (ac && N) setMusic(musicWant); },
    // tests / judge: scheduled cue log (kind, audio time, pan), context state, tick rate, the music clock
    debug: () => ({ state: ac ? ac.state : 'none', log: log.slice(), tickRate, tickOn, masterTarget, paused, hidden, pawls: AUDIO.pawls, simT, hasFrame: !!lastFrame,
      district, rain: +rainK.toFixed(3), heavy: +heavy.toFixed(3),
      music: { on: musicOn, built: !!M, bar: mus.bar, step: mus.step, bpm: +mus.bpm.toFixed(2), mode: mus.arr ? mus.arr.mode : null, section: mus.info ? mus.info.sec : null, chords: mus.info ? mus.info.chords : null, crooning: mus.crooning } }),
    get context() { return ac; },
  };
  return api;
}
