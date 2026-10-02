// OWNER: audio. Pelican Bay soundscape: 100 % procedural WebAudio, no samples, no files. Style C = a 1930s seaside
// travel poster, so every voice is period-flavoured and physically modelled: a brass ring-ring bell (rotary clapper,
// doppler glide), a clockwork freewheel ratchet, a wind-up-toy chain whirr, surf drawing back over shingle, gulls, a
// three-chime steam-ship whistle, the lighthouse diaphone ("BEEE-oh") at night or in fog, a carousel band organ at the
// pleasure pier, a tram gong in the village, promenade crowd murmur, rain on the awnings, wind in the pines, a pelican
// that honks like a 1930s cartoon and clacks its bill, swing-band event stings, and the BGM (bgm.js) sitting on a
// gramophone crackle bed. The ambience follows the route stretch (frame.weather.stretch / km), the weather and the hour.
// Full description: docs/BGM.md (§ Soundscape).
//
// createAudio(bus, opts?) -> { enable():Promise<boolean>, disable(), update(frame), setVolume(v), debug() }
//   opts.context  inject an (Offline)AudioContext (tests / judge render). Default: a real AudioContext,
//                 created lazily inside enable() (0 AudioContexts before the user opts in).
//   opts.clock    () => audio time; the offline harness passes the sim clock so update() can schedule ahead.
//   opts.seed     deterministic variation (default: time-seeded).
//   opts.solo     ['amb'|'mech'|'fx'|'far'|'mus'] keep only these buses (analysis renders).
//   opts.volume   0…1 (default 0.8).
//
// Mix:  sources → buses (amb: wind/road/sea · mech: chain/freewheel · fx: bell/thump/gulp · far: gulls/horns/crickets
//       · mus: the BGM "Coast Road Swing", bgm.js — plays while sound is on and the Music toggle is on, under the effects)
//       → master (fade) → glue compressor → brick-wall limiter → trim → out.  Shared procedural plate reverb send.
// Sync: rig events are cued in SIM time from TIMING (rig/solve.js X-sheets) and scheduled from update(frame) with
//       a 120 ms lookahead, compensated for output latency, so the bell rings on the thumb pop and the thump lands
//       on the tyre contact frame. The freewheel tick rate is exactly wheel rev/s × AUDIO.pawls.
import { TIMING } from '../rig/solve.js';
import { BIKE, DIST_PER_REV, CADENCE } from '../contract.js';
import { createBGM } from './bgm.js';

export const AUDIO = {
  pawls: 18,                 // freehub engagement points (coast tick rate = wheel rev/s × pawls)
  teeth: BIKE.ringT,         // chain whirr AM rate = crank rev/s × chainring teeth
  lookahead: 0.12, interval: 25,
  fadeIn: 0.6, fadeOut: 0.45, pauseFade: 0.4, hideFade: 0.08, hideSuspendMs: 100,
  bellStrikes: [TIMING.bell.strike, TIMING.bell.strike + 0.105],
  music: { gain: 0.62, sting: 0.5, duck: 0.6, duckHold: 0.55, duckRelease: 0.9, gateFade: 0.6 },   // duck 0.6 ≈ −4.4 dB under bell / gulp / eggs
};

const TAU = Math.PI * 2;
const V_MAX = (CADENCE.max / 60) * DIST_PER_REV;
// speed-driven levels are normalised to the cruise cadence (s = 0.6 at cruise), so they keep their feel when the
// default cruise moves (60 → 42 rpm); nothing musical follows cadence (the BGM tempo is fixed)
const V_CRUISE = (CADENCE.cruise / 60) * DIST_PER_REV;
const WHEEL_C = TAU * BIKE.R;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const HOP = { takeoff: TIMING.hop.takeoff, land: TIMING.hop.land, hold0: 0.2, hold1: TIMING.hop.land + 0.35 };
const GAP = { hop: TIMING.hop.gap, bell: 0.12, wave: TIMING.wave.gap, gulp: TIMING.gulp.gap };
const CAPTION = {
  bell: ['[bell rings]', '[车铃叮铃]'], land: ['[thump]', '[咚]'], gulp: ['[gulp]', '[咕嘟]'],
  gull: ['[gulls call]', '[海鸥鸣叫]'], horn: ['[distant fog horn]', '[远处雾笛]'], boat: ['[ship\'s whistle]', '[轮船汽笛]'],
  honk: ['[pelican honks]', '[鹈鹕嘎嘎叫]'], clack: ['[bill clacks]', '[鹈鹕嘴壳嗒嗒响]'], tram: ['[tram gong]', '[电车铃]'], organ: ['[carousel organ]', '[旋转木马风琴]'],
};
// per route stretch (route.js): shingle under the surf, crowd murmur by day, gull activity
const PLACE = {
  village: { sh: 1, crowd: 0.8, gull: 1.1 }, pier: { sh: 0.8, crowd: 0.5, gull: 1.4 }, harbour: { sh: 0.6, crowd: 0.4, gull: 1.7 },
  funfair: { sh: 0.7, crowd: 0.9, gull: 1 }, railway: { sh: 0.8, crowd: 0, gull: 0.9 }, lighthouse: { sh: 0.7, crowd: 0, gull: 1 },
  cliffs: { sh: 0.4, crowd: 0, gull: 1.3, boom: 1 }, dunes: { sh: 0.1, crowd: 0, gull: 0.7 }, bridge: { sh: 0.3, crowd: 0.2, gull: 0.9 },
  fort: { sh: 1, crowd: 1, gull: 1 }, pines: { sh: 0.4, crowd: 0, gull: 0.5, pines: 1 }, return: { sh: 1, crowd: 0.8, gull: 1.1 },
};
const FUNFAIR_KM = 6.5, LIGHTHOUSE = 'lighthouse';
// carousel band organ: an 8-bar waltz in C (melody [midi, beats]) over oom-pah-pah (bass, dyad per bar)
const ORGAN = {
  bpm: 168,
  mel: [[76, 1], [79, 1], [84, 1], [83, 2], [81, 1], [79, 2], [76, 1], [77, 3], [74, 1], [77, 1], [81, 1], [79, 2], [77, 1], [76, 2], [74, 1], [72, 3]],
  ch: [[48, 64, 67], [43, 65, 71], [48, 64, 67], [50, 65, 69], [50, 65, 69], [43, 65, 71], [43, 65, 71], [48, 64, 67]],
};

function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function createAudio(bus, opts = {}) {
  const offline = !!(opts.context && typeof opts.context.startRendering === 'function');
  const R = mulberry(opts.seed ?? ((Date.now() ^ 0x9e3779b9) >>> 0));
  const rr = (a, b) => a + (b - a) * R();
  const solo = opts.solo ? new Set(opts.solo) : null;
  const hasDoc = typeof document !== 'undefined';
  let ac = null, N = null, timer = 0, wantOn = false, paused = false, hidden = false, vol = clamp(opts.volume ?? 0.8, 0, 1);
  let masterTarget = -1, lastLive = 0, lastCtl = -1, simT = 0, lastFrame = null;
  let tickOn = false, tickRate = 0, nextTick = 0, tickN = 0;
  let nextSwell = 0, nextGull = 0, nextHorn = 0, nextBoat = 0, nextCricket = 0, nightOn = false;
  let nextTram = 0, nextOrgan = 0, nextClack = 0, nextHonk = 0, nextDrip = 0, tod = 0.7, wx = {}, place = PLACE.village, stretch = 'village', km = 0, speedU = 0;
  let gust = 1, gustV = 0, gullsOn = true, night = 0, speedN = 0.5, cadence = 60;
  let musicOn = true, musicRun = false;
  const seen = new Set(), lastAcc = {}, cues = [], hops = [], log = [];
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
        d[i] = t < 0.014 + c * 0.003 ? 0 : lp * Math.exp(-t / 0.55);
      }
      let e = 0; for (let i = 0; i < n; i++) e += d[i] * d[i];
      const k = 1 / Math.sqrt(e || 1); for (let i = 0; i < n; i++) d[i] *= k;             // unit-energy IR (0 dB wet gain)
    }
    return buf;
  }
  function clickBuf(f1, f2, f3) {  // vintage freewheel ratchet: pawl snap (three steel modes + grit), a hollow hub-shell
    const sr = ac.sampleRate, n = Math.floor(0.012 * sr), buf = ac.createBuffer(1, n, sr), d = buf.getChannelData(0);   // "tok", and the
    for (let i = 0; i < n; i++) {                                                                                      // spring's rebound
      const t = i / sr, t2 = t - 0.0017, snap = tt => tt < 0 ? 0 : 0.5 * Math.sin(TAU * f1 * tt) * Math.exp(-tt / 0.0011) + 0.3 * Math.sin(TAU * f2 * tt) * Math.exp(-tt / 0.0007) + 0.2 * Math.sin(TAU * f3 * tt) * Math.exp(-tt / 0.0012);
      d[i] = (snap(t) + 0.38 * snap(t2) + 0.28 * Math.sin(TAU * 1180 * t) * Math.exp(-t / 0.0028) + (R() * 2 - 1) * 0.25 * Math.exp(-t / 0.0003)) * Math.min(1, i / 6) * (1 - i / n);
    }
    return buf;
  }
  function crackleBuf(sec) {        // 78-rpm shellac: soft hiss, ticks, the odd pop, a once-per-turn swish (1.3 Hz)
    const sr = ac.sampleRate, n = Math.floor(sec * sr), buf = ac.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c); let lp = 0;
      for (let i = 0; i < n; i++) { lp += ((R() * 2 - 1) - lp) * 0.35; d[i] = lp * 0.035 * (1 + 0.35 * Math.sin(TAU * 1.3 * i / sr)); }
      const ev = Math.floor(sec * 26);
      for (let k = 0; k < ev; k++) {
        const at = Math.floor(R() * (n - 400)), big = R() < 0.05, a = (big ? 0.5 : 0.18) * (0.3 + R() * R()), tau = (big ? 0.0009 : 0.00025) * sr, f = 1800 + 3000 * R();
        for (let i = 0; i < 6 * tau && at + i < n; i++) d[at + i] += a * Math.exp(-i / tau) * Math.sin(TAU * f * i / sr + 0.5) * Math.min(1, i / 3);
      }
      const X = Math.floor(0.05 * sr); for (let i = 0; i < X; i++) { const k = i / X; d[i] = d[i] * k + d[n - X + i] * (1 - k); }   // loopable
    }
    return buf;
  }
  function shingleBuf(sec) {        // pebbles knocking as the backwash drags them: hundreds of tiny stone "tik"s
    const sr = ac.sampleRate, n = Math.floor(sec * sr), buf = ac.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let k = 0; k < sec * 340; k++) {
        const at = Math.floor(R() * (n - 600)), f = 1700 + 4800 * R() * R(), tau = (0.0005 + 0.0018 * R()) * sr, a = 0.08 + 0.5 * R() ** 3;
        for (let i = 0; i < 5 * tau && at + i < n; i++) d[at + i] += a * Math.exp(-i / tau) * Math.sin(TAU * f * i / sr) * Math.min(1, i / 4);
      }
      for (let i = 0; i < 400; i++) { d[i] *= i / 400; d[n - 1 - i] *= i / 400; }
    }
    return buf;
  }

  // ------------------------------------------------------------------ graph
  function build() {
    const out = G(1.0);                                                      // trim after the limiter: peaks ≤ −1.5 dBFS
    const lim = ac.createDynamicsCompressor();
    lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.09;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = 0.006; comp.release.value = 0.25;
    const master = G(0), hpf = F('highpass', 42, 0.6);                    // keep sub-rumble out of laptop speakers
    wire(master, hpf, comp, lim, out, ac.destination);
    const B = n => { const g = G(solo && !solo.has(n) ? 0 : 1); g.connect(master); return g; };
    const amb = B('amb'), mech = B('mech'), fx = B('fx'), far = B('far'), mus = B('mus');
    const musDuck = G(1), musGate = G(0); wire(musGate, musDuck, mus);       // BGM: on/off gate → event duck → bus
    const verb = ac.createConvolver(); verb.normalize = false; verb.buffer = plate(2.4);
    const verbRet = G(0.8); wire(verb, verbRet, master);
    const vin = {}; for (const b of ['amb', 'mech', 'fx', 'far']) { vin[b] = G(solo && !solo.has(b) ? 0 : 1); vin[b].connect(verb); }
    const duck = G(1); duck.connect(amb);                                   // bell ducks wind + road

    const pinkB = noise(9.73, 'pink'), brownB = noise(13.31, 'brown'), whiteB = noise(6.07, 'white'), shingleB = shingleBuf(3.1);
    // wind: broad band that brightens with speed + a gust-driven narrow whistle
    const windSrc = bufSrc(pinkB, true), windBp = F('bandpass', 500, 0.55), windLp = F('lowpass', 2600, 0.5), windG = G(0);
    wire(windSrc, windBp, windLp, windG, duck);
    const whisBp = F('bandpass', 1300, 9), whisG = G(0);
    wire(windSrc, whisBp, whisG, duck);
    // road: tyre rumble + grit (gated off while airborne)
    const roadSrc = bufSrc(pinkB, true, 1.13), roadLp = F('bandpass', 300, 0.8), roadG = G(0), tyreGate = G(1);
    wire(roadSrc, roadLp, roadG, tyreGate, duck);
    const gritSrc = bufSrc(whiteB, true, 0.91), gritHp = F('highpass', 3200, 0.7), gritG = G(0);
    wire(gritSrc, gritHp, gritG, tyreGate);
    // sea bed (swells are one-shots on top)
    const seaSrc = bufSrc(brownB, true, 0.87), seaLp = F('lowpass', 170, 0.7), seaG = G(0.1);
    wire(seaSrc, seaLp, seaG, amb);
    // chain whirr like a wind-up toy: a clockwork gear-train (resonant metal band, square-gated at the tooth rate),
    // a little motor whine that rises with the pedalling, plus the low roller hum (two pedal strokes per turn)
    const chSrc = bufSrc(whiteB, true, 1.07), chBp = F('bandpass', 2900, 5), chAM = G(0.5), chG = G(0), chPan = Pan(-0.12);
    const chOsc = O('square', 34), chDepth = G(0.5);
    const whine = O('sawtooth', 200), whineBp = F('bandpass', 1150, 3), whineG = G(0);
    wire(whine, whineBp, whineG, chPan);
    wire(chOsc, chDepth); chDepth.connect(chAM.gain);
    wire(chSrc, chBp, chAM, chG, chPan, mech);
    const humSrc = bufSrc(pinkB, true, 0.95), humBp = F('bandpass', 620, 3), humAM = G(0.6), humG = G(0);
    const humOsc = O('sine', 2), humDepth = G(0.4); wire(humOsc, humDepth); humDepth.connect(humAM.gain);
    wire(humSrc, humBp, humAM, humG, chPan);
    // freewheel ticks
    const tickBus = G(1), tickPan = Pan(-0.22); wire(tickBus, tickPan, mech);
    const clicks = [clickBuf(2150, 3480, 5200), clickBuf(2290, 3610, 5450), clickBuf(2080, 3390, 5050)];
    // promenade crowd murmur (day; village, piers, lido): babble formants on slow, uneven swells
    const murSrc = bufSrc(pinkB, true, 0.81), murA = F('bandpass', 480, 1.4), murB = F('bandpass', 1250, 2.2), murAM = G(0.6), murG = G(0), murPan = Pan(-0.35);
    const murL1 = O('sine', 0.73), murL2 = O('sine', 2.3), murD1 = G(0.25), murD2 = G(0.15);
    wire(murL1, murD1); wire(murL2, murD2); murD1.connect(murAM.gain); murD2.connect(murAM.gain);
    wire(murSrc, murA, murAM); wire(murSrc, murB, G(0.6), murAM); wire(murAM, murG, murPan, far);
    // rain on the awnings (bed; the drips are one-shots) and wind in the pines
    const rainSrc = bufSrc(whiteB, true, 0.77), rainHp = F('highpass', 1600, 0.6), rainLp = F('lowpass', 6800, 0.6), rainG = G(0);
    wire(rainSrc, rainHp, rainLp, rainG, amb);
    const pineSrc = bufSrc(pinkB, true, 1.21), pineBp = F('bandpass', 4600, 0.6), pineG = G(0);
    wire(pineSrc, pineBp, pineG, duck);
    // gramophone bed the BGM sits on (inside the music gate, so it comes and goes with the music)
    const crSrc = bufSrc(crackleBuf(6.13), true), crG = G(0.55), crLp = F('lowpass', 7000, 0.6);
    wire(crSrc, crLp, crG, musGate);
    const pawlAmp = Array.from({ length: AUDIO.pawls }, (_, i) => 0.82 + 0.18 * Math.sin(i * 2.4) * Math.cos(i * 0.7) + 0.08 * R());

    const t0 = now();
    for (const s of [windSrc, roadSrc, gritSrc, seaSrc, chSrc, humSrc, murSrc, rainSrc, pineSrc, crSrc]) s.start(t0, R() * 5);
    for (const o of [chOsc, humOsc, whine, murL1, murL2]) o.start(t0);
    N = { master, amb, mech, fx, far, verb, vin, duck, windSrc, windBp, windG, whisBp, whisG, roadSrc, roadLp, roadG, tyreGate, gritG, seaG, seaLp,
      chOsc, chG, chBp, humOsc, humG, tickBus, clicks, pawlAmp, pinkB, brownB, whiteB, shingleB, musDuck, musGate, bgm: null, sting: null,
      whine, whineG, murG, rainG, pineG };
    nextSwell = t0 + 0.4; nextGull = t0 + rr(4, 8); nextHorn = t0 + rr(6, 14); nextBoat = t0 + rr(30, 70); nextCricket = t0 + rr(1, 3);
    nextTram = t0 + rr(6, 15); nextOrgan = t0 + 1; nextClack = t0 + rr(12, 25); nextHonk = t0 + rr(30, 60); nextDrip = t0 + 1;
  }

  // ------------------------------------------------------------------ voices
  function duckMusic(at) {      // a few dB under the bell, the gulp and the easter eggs
    if (!N || !musicRun) return;
    const M = AUDIO.music; ramp(N.musDuck.gain, M.duck, at, 0.04); ramp(N.musDuck.gain, 1, at + M.duckHold, M.duckRelease);
  }
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

  // modal one-shot: sine partials [ratio, amp, decay s, beat Hz] (beat > 0 = a near-degenerate pair that shimmers);
  // bend = doppler glide (+bend → −bend over 0.45 s)
  function modal(at, f0, P, amp, pan, dest, vb, vbBus, bend = 0, lpF = 0) {
    const pn = Pan(pan), bus = G(amp), nodes = [bus, pn]; let x = bus;
    if (lpF) { const lp = F('lowpass', lpF, 0.7); wire(bus, lp); x = lp; nodes.push(lp); }
    wire(x, pn, dest); const sv = send(pn, vb, vbBus); if (sv) nodes.push(sv);
    let end = 0, last = null;
    P.forEach(([r, a, d, beat = 0]) => {
      for (const det of beat ? [-1, 1] : [0]) {
        const f = f0 * r + det * beat, o = O('sine', f), g = G(0); wire(o, g, bus);
        if (bend) { o.frequency.setValueAtTime(f * (1 + bend), at); o.frequency.linearRampToValueAtTime(f * (1 - bend), at + 0.45); }
        const e = envAD(g.gain, at, a * (beat ? (det < 0 ? 0.55 : 0.45) : 1), 0.0015, d); o.start(at); o.stop(e);
        if (e > end) { if (last) reap(last[0], last); end = e; last = [o, g]; } else reap(o, [o, g]);
      }
    });
    reap(last[0], [...last, ...nodes]);
    return pn;
  }
  function bellStrike(at, amp, pan, bend) {
    // brass bicycle-bell dome: inharmonic modes, each a beating pair; the warm low "hum" mode rings longest
    const P = [[1, 1, 2.4, 0.8], [1.52, 0.48, 1.5, 1.2], [2.03, 0.4, 1.1, 1.6], [2.71, 0.26, 0.7, 2], [3.31, 0.14, 0.45], [0.51, 0.12, 1.6]];
    const pn = modal(at, 2040, P, amp * 0.1, pan, N.fx, 0.24, 'fx', bend);
    if (pn.pan) { pn.pan.setValueAtTime(clamp(pan - 0.1, -1, 1), at); pn.pan.linearRampToValueAtTime(clamp(pan + 0.1, -1, 1), at + 0.5); }
    const n = bufSrc(N.whiteB), hp = F('bandpass', 5200, 1.2), g = G(0);          // clapper tick
    wire(n, hp, g, pn); const e = envAD(g.gain, at, 0.045 * amp, 0.0008, 0.016);
    n.start(at, R() * 3); n.stop(e); reap(n, [n, hp, g]);
  }
  function bell(at) {
    // ring-ring: each thumb flick spins the rotary clapper ~3 times (the period "dring"), two flicks; a slight doppler
    // glide (the bell sweeps past the camera's ear) and a swing-band cymbal choke right after
    const pan = screenPan('#j-bars') ?? 0.05;
    AUDIO.bellStrikes.forEach((st, k) => {
      const t = at + st - AUDIO.bellStrikes[0];
      [0, 0.031, 0.06].forEach((dt, j) => bellStrike(t + dt, (k ? 0.74 : 1) * [1, 0.6, 0.42][j], pan, 0.006 - 0.002 * k));
    });
    ramp(N.duck.gain, 0.5, at, 0.03); ramp(N.duck.gain, 1, at + 0.4, 0.6); duckMusic(at);
    sting('choke', at + AUDIO.bellStrikes[1] - AUDIO.bellStrikes[0] + 0.26);
    logCue('bell', at, { pan }); caption('bell');
  }
  // swing-band stings in the BGM's own voices (a second, never-started bgm instance routed to the effects bus)
  function sting(kind, at, id) {
    try { if (!N.sting) N.sting = createBGM(ac, N.fx, { seed: 11, gain: AUDIO.music.sting }); N.sting.sting(kind, at, id); logCue('sting:' + kind, at); }
    catch (err) { console.warn('[audio] sting', err); }
  }
  // the pelican: honks like a 1930s cartoon (reedy buzz, two formants, a throaty flutter) and clacks its bill
  const HONK = { honk: [[0, 0.26, 1, 1.12, 0.84]], double: [[0, 0.17, 1.04, 1.16, 0.9], [0.23, 0.27, 0.98, 1.1, 0.78]], hup: [[0, 0.13, 0.9, 1.32, 1.2]], hmm: [[0, 0.34, 0.8, 0.86, 0.7]] };
  function honk(at, kind = 'honk', amp = 1) {
    const pan = 0.14, f0 = 232 * (0.95 + 0.1 * R());
    for (const [dt, dur, a, b, c] of HONK[kind]) {
      const t = at + dt, o1 = O('sawtooth', f0), o2 = O('square', f0 * 1.006), fl = O('sine', 31 + 6 * R()), fd = G(f0 * 0.035);
      wire(fl, fd); fd.connect(o1.frequency); fd.connect(o2.frequency);
      for (const o of [o1, o2]) { const fr = o.frequency, k = o === o2 ? 1.006 : 1; fr.setValueAtTime(f0 * k * a, t); fr.linearRampToValueAtTime(f0 * k * b, t + dur * 0.35); fr.linearRampToValueAtTime(f0 * k * c, t + dur); }
      const f1 = F('bandpass', 700, 3.2), f2 = F('bandpass', 1380, 4.5), nasal = F('peaking', 2500, 2.5, 7), m = G(1), m2 = G(0.5), m3 = G(0.75), g = G(0), pn = Pan(pan);
      wire(o1, m); wire(o2, m2, m); m.connect(f1); m.connect(f2); f1.connect(nasal); wire(f2, m3, nasal); wire(nasal, g, pn, N.fx); send(pn, 0.1);
      const A = 0.2 * amp; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(A, t + 0.022); g.gain.linearRampToValueAtTime(A * 0.85, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur);
      for (const o of [o1, o2, fl]) { o.start(t); o.stop(t + dur + 0.03); }
      reap(o1, [o1, o2, fl, fd, f1, f2, nasal, m, m2, m3, g, pn]);
    }
    logCue('honk', at, { voice: kind }); caption('honk');
  }
  function woodClack(at, a) {      // two keratin plates meeting: a woody mode + a dry snap
    const s = bufSrc(N.whiteB), bp = F('bandpass', 1800 + 500 * R(), 5), o = O('sine', 980 + 200 * R()), g = G(0), og = G(0), pn = Pan(0.15);
    wire(s, bp, g, pn); wire(o, og, pn); pn.connect(N.fx);
    const e = envAD(g.gain, at, 0.4 * a, 0.0008, 0.022); envAD(og.gain, at, 0.1 * a, 0.0006, 0.03);
    s.start(at, R() * 4); s.stop(e); o.start(at); o.stop(at + 0.06); reap(o, [s, bp, g, o, og, pn]);
  }
  function clackRoll(at, n) {      // pelicans really do clack: a quick wooden rattle of the bill
    for (let i = 0; i < n; i++) woodClack(at + i * (0.072 + 0.012 * R()), 0.9 - 0.09 * i);
    logCue('clack', at, { n }); caption('clack');
  }
  function thump(at) {
    const pn = Pan(0), g0 = G(1); wire(g0, pn, N.fx); send(pn, 0.08);
    const o = O('sine', 96), og = G(0); o.frequency.setValueAtTime(96, at); o.frequency.exponentialRampToValueAtTime(40, at + 0.16);
    wire(o, og, g0); const e1 = envAD(og.gain, at, 0.55, 0.003, 0.28); o.start(at); o.stop(e1);
    const nb = bufSrc(N.brownB), lp = F('lowpass', 520, 0.8), ng = G(0); wire(nb, lp, ng, g0);
    const e2 = envAD(ng.gain, at, 0.5, 0.002, 0.16); nb.start(at, R() * 8); nb.stop(e2);
    const tb = bufSrc(N.whiteB), bp = F('bandpass', 1300, 0.8), tg = G(0); wire(tb, bp, tg, g0);   // tyre "pff"
    const e3 = envAD(tg.gain, at, 0.12, 0.002, 0.09); tb.start(at, R() * 4); tb.stop(e3);
    // basket + fender rattle
    [[0.028, 0.5], [0.05, 0.34], [0.083, 0.42], [0.125, 0.22], [0.18, 0.12]].forEach(([dt, a], i) => {
      const s = bufSrc(N.clicks[i % 3], false, 0.55 + 0.1 * i), f = F('bandpass', 2300 + 300 * i, 2), g = G(a * 0.35);
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
  function bubble(at, f0, f1, dur, amp) {   // rising-pitch bubble = the "gloop"
    const o = O('sine', f0), o2 = O('triangle', f0 * 2), g = G(0), g2 = G(0.18), lp = F('lowpass', 1600, 0.7), pn = Pan(0.12);
    o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f1, at + dur);
    o2.frequency.setValueAtTime(f0 * 2, at); o2.frequency.exponentialRampToValueAtTime(f1 * 2, at + dur);
    wire(o, g); wire(o2, g2, g); wire(g, lp, pn, N.fx); send(pn, 0.06);
    const e = envAD(g.gain, at, amp, 0.006, dur * 1.3);
    o.start(at); o2.start(at); o.stop(e); o2.stop(e); reap(o, [o, o2, g, g2, lp, pn]);
  }
  function slap(at) {            // wet fish flop
    const s = bufSrc(N.whiteB), bp = F('bandpass', 950, 1.3), g = G(0), pn = Pan(0.15); wire(s, bp, g, pn, N.fx);
    const e = envAD(g.gain, at, 0.28, 0.002, 0.06); s.start(at, R() * 4); s.stop(e); reap(s, [s, bp, g, pn]);
    bubble(at + 0.01, 240, 150, 0.04, 0.12);
  }
  function clack(at) {           // bill snapping shut on the fish
    const o = O('sine', 1180), g = G(0), s = bufSrc(N.whiteB), bp = F('bandpass', 2400, 4), g2 = G(0), pn = Pan(0.15);
    wire(o, g, pn); wire(s, bp, g2, pn); pn.connect(N.fx);
    const e = envAD(g.gain, at, 0.16, 0.001, 0.035); envAD(g2.gain, at, 0.35, 0.0006, 0.02);
    o.start(at); o.stop(e); s.start(at, R() * 4); s.stop(e); reap(o, [o, g, s, bp, g2, pn]);
  }
  function gulpSeq(at) {
    const T = TIMING.gulp;
    slap(at + T.scoop[0] + 0.06);
    whoosh(at + T.toss[0], 0.3, 500, 1500, 0.05, 0.1);
    clack(at + T.toss[1] - 0.02);
    bubble(at + T.swallow[0] + 0.06, 190, 560, 0.1, 0.34);
    bubble(at + T.swallow[0] + 0.24, 260, 780, 0.09, 0.28);
    bubble(at + T.swallow[0] + 0.44, 340, 640, 0.07, 0.13);
    sting('trill', at + T.swallow[0] + 0.1);
    honk(at + T.settle[0] + 0.1, 'hmm', 0.55);
    duckMusic(at + T.scoop[0]);
    logCue('gulp', at + T.swallow[0] + 0.06); caption('gulp');
  }
  function waveSeq(at) {         // feather rustle while the wing unfolds and waves
    const T = TIMING.wave;
    whoosh(at + T.unfold[0], T.unfold[1] - T.unfold[0], 2400, 4200, 0.035, 0.15);
    for (let i = 0; i < 3; i++) whoosh(at + T.wave[0] + i * 0.28, 0.24, 1800, 3400, 0.025, 0.2);
    logCue('wave', at);
  }
  function tick(at) {
    const i = tickN++ % AUDIO.pawls, s = bufSrc(N.clicks[i % 3], false, 0.96 + 0.08 * R()), g = G(N.pawlAmp[i] * (0.9 + 0.2 * R()));
    wire(s, g, N.tickBus); s.start(at); reap(s, [s, g]);
  }
  function swell(at) {
    const boom = place.boom ? 1.35 : 1, D = rr(5.5, 9.5), peak = rr(0.14, 0.22) * boom, pan = rr(-0.65, 0.65), crest = rr(0.4, 0.5);
    const s = bufSrc(N.pinkB, true), lp = F('lowpass', 220, 0.6), g = G(0), pn = Pan(pan);
    lp.frequency.setValueAtTime(220, at); lp.frequency.exponentialRampToValueAtTime(rr(900, 1600) / boom, at + D * crest); lp.frequency.exponentialRampToValueAtTime(260, at + D);
    if (place.sh > 0.05) {          // the backwash drags the shingle: a rattle that swells after the crest and dies away
      const sh = bufSrc(N.shingleB, true, rr(0.85, 1.15)), shBp = F('bandpass', 3400, 0.5), shG = G(0), a = peak * 0.75 * place.sh;
      shG.gain.setValueAtTime(0, at + D * crest); shG.gain.linearRampToValueAtTime(a, at + D * (crest + 0.16)); shG.gain.linearRampToValueAtTime(a * 0.4, at + D * 0.8); shG.gain.linearRampToValueAtTime(0, at + D);
      wire(sh, shBp, shG, pn); sh.start(at + D * crest, R() * 2); sh.stop(at + D + 0.05); reap(sh, [sh, shBp, shG]);
    }
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(peak, at + D * crest); g.gain.linearRampToValueAtTime(peak * 0.35, at + D * 0.72); g.gain.linearRampToValueAtTime(0, at + D);
    wire(s, lp, g, pn, N.amb);
    const f = bufSrc(N.whiteB, true), hp = F('highpass', 1900, 0.5), fg = G(0);        // foam hiss on the sand
    fg.gain.setValueAtTime(0, at + D * (crest - 0.05)); fg.gain.linearRampToValueAtTime(peak * 0.3, at + D * (crest + 0.06)); fg.gain.exponentialRampToValueAtTime(1e-5, at + D); fg.gain.linearRampToValueAtTime(0, at + D + 0.02);
    wire(f, hp, fg, pn);
    s.start(at, R() * 9); s.stop(at + D + 0.05); f.start(at, R() * 5); f.stop(at + D + 0.05);
    reap(s, [s, lp, g]); reap(f, [f, hp, fg, pn]);
    return D;
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
  function gullCall(at) {
    const escort = cadence > 85, near = escort && R() < 0.6;
    let pan = screenPan(near ? '[data-ref^="fx-esc"]' : '[data-ref^="fx-gfar"]', true);
    if (pan == null) pan = rr(-0.8, 0.8);
    const panV = (2 * (170 - 0.15 * speedU)) / 1600 * (near ? 0.3 : 1);    // far gulls drift with their layer
    const dist = near ? 0.15 : rr(0.45, 0.8), amp = (near ? 0.24 : 0.16) * rr(0.8, 1.1);
    const kind = R(), f0 = rr(820, 1080);
    let t = at, p = pan;
    if (kind < 0.45) { const n = 2 + Math.floor(R() * 3); for (let i = 0; i < n; i++) { const d = rr(0.2, 0.3); gullNote(t, f0 * (1 - 0.03 * i), d, p, panV, amp, dist); t += d + rr(0.07, 0.14); p += panV * (d + 0.1); } }
    else if (kind < 0.8) { const n = 4 + Math.floor(R() * 4); for (let i = 0; i < n; i++) { const d = rr(0.09, 0.13); gullNote(t, f0 * (1.15 - 0.045 * i), d, p, panV, amp * (1 - 0.06 * i), dist); t += d + rr(0.04, 0.07); p += panV * (d + 0.05); } }
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
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(amp, at + 0.4); g.gain.setValueAtTime(amp, at + dur); g.gain.exponentialRampToValueAtTime(amp * 1e-3, at + dur + 0.9); g.gain.linearRampToValueAtTime(0, at + dur + 0.95);
    for (const o of [o1, o2, o3]) { o.start(at); o.stop(at + dur + 1); }
    reap(o1, [o1, o2, o3, m3, lp, g, pn]);
  }
  function diaphone(at, amp, pan) {   // lighthouse diaphone: a long "BEEE" that drops into its famous grunt, "-oh"
    const f = 176, D = 1.9, Gr = 0.75, o1 = O('sawtooth', f), o2 = O('sawtooth', f * 1.003), o3 = O('square', f / 2), m3 = G(0.35), lp = F('lowpass', 300, 1.1), g = G(0), pn = Pan(pan);
    for (const [o, k] of [[o1, 1], [o2, 1.003], [o3, 0.5]]) { const fr = o.frequency; fr.setValueAtTime(f * k * 0.9, at); fr.exponentialRampToValueAtTime(f * k, at + 0.15); fr.setValueAtTime(f * k, at + D); fr.exponentialRampToValueAtTime(f * k * 0.66, at + D + 0.16); }
    lp.frequency.setValueAtTime(300, at); lp.frequency.linearRampToValueAtTime(700, at + 0.4); lp.frequency.linearRampToValueAtTime(560, at + D); lp.frequency.linearRampToValueAtTime(420, at + D + Gr);
    wire(o1, lp); wire(o2, lp); wire(o3, m3, lp); wire(lp, g, pn, N.far); send(pn, 0.7, 'far');
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(amp, at + 0.3); g.gain.setValueAtTime(amp, at + D); g.gain.linearRampToValueAtTime(amp * 1.15, at + D + 0.12);
    g.gain.setValueAtTime(amp * 1.15, at + D + Gr); g.gain.exponentialRampToValueAtTime(amp * 1e-3, at + D + Gr + 0.8); g.gain.linearRampToValueAtTime(0, at + D + Gr + 0.85);
    for (const o of [o1, o2, o3]) { o.start(at); o.stop(at + D + Gr + 0.9); }
    reap(o1, [o1, o2, o3, m3, lp, g, pn]);
  }
  function fogHorn(at) {
    const pan = screenPan('[data-ref="sea-lantern"]') ?? 0.45, a = stretch === LIGHTHOUSE ? 0.055 : 0.04;
    diaphone(at, a, pan);
    if (R() < 0.5) diaphone(at + 4.6, a * 0.88, pan);
    logCue('horn', at, { pan }); caption('horn');
  }
  function steamWhistle(at, dur, f, amp, pan, lpF) {   // three-chime steam whistle: a chord of pipes + steam, slurps up
    const lp = F('lowpass', lpF, 0.7), g = G(0), pn = Pan(pan), nodes = [lp, g, pn], os = [];
    wire(lp, g, pn, N.far); send(pn, 0.6, 'far');
    for (const [r, a] of [[1, 0.5], [1.26, 0.38], [1.5, 0.3]]) for (const h of [1, 2]) {
      const fh = f * r * h * (1 + 0.002 * R()), o = O(h === 1 ? 'triangle' : 'sine', fh), og = G(a / (h * h)); wire(o, og, lp); os.push(o); nodes.push(o, og);
      o.frequency.setValueAtTime(fh * 0.94, at); o.frequency.exponentialRampToValueAtTime(fh, at + 0.22); o.frequency.setValueAtTime(fh, at + dur); o.frequency.exponentialRampToValueAtTime(fh * 0.93, at + dur + 0.35);
    }
    const ns = bufSrc(N.whiteB, true), nb = F('bandpass', f * 2.6, 1.4), ng = G(0.22); wire(ns, nb, ng, lp); nodes.push(ns, nb, ng); os.push(ns);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(amp, at + 0.2); g.gain.setValueAtTime(amp, at + dur); g.gain.exponentialRampToValueAtTime(amp * 1e-3, at + dur + 0.5); g.gain.linearRampToValueAtTime(0, at + dur + 0.55);
    for (const o of os) { o.start(at); o.stop(at + dur + 0.6); }
    reap(os[0], nodes);
  }
  function boatHorn(at) {
    let pan = screenPan('[data-ref="sea-steamlit"]'); if (pan == null) pan = rr(-0.7, 0.7);
    steamWhistle(at, 0.6, 196, 0.06, pan, 1500); steamWhistle(at + 1.0, 1.25, 196, 0.06, pan, 1500);
    logCue('boat', at, { pan }); caption('boat');
  }
  function tramBell(at) {          // the village tram's foot gong: "clang-clang"
    const pan = rr(-0.8, 0.8), P = [[1, 1, 1.5, 0.6], [2.0, 0.5, 0.9], [2.76, 0.42, 0.65], [5.4, 0.18, 0.3], [0.5, 0.22, 1.7]];
    modal(at, 640, P, 0.05, pan, N.far, 0.35, 'far', 0, 3600); modal(at + 0.3, 640, P, 0.043, pan, N.far, 0.35, 'far', 0, 3600);
    logCue('tram', at, { pan }); caption('tram');
  }
  function organ(at, near) {       // carousel band organ at the pleasure pier: flue + reed pipes, waltz, bass drum
    const bt = 60 / ORGAN.bpm, len = ORGAN.ch.length * 3 * bt, dist = 1 - near;
    const bus = G(0.05 * (0.35 + 0.65 * near)), lp = F('lowpass', 1500 + 1700 * near, 0.7), pn = Pan(0);
    const p0 = clamp((FUNFAIR_KM - km) * 0.9, -0.9, 0.9), p1 = clamp(p0 - 0.5, -0.9, 0.9);
    if (pn.pan) { pn.pan.setValueAtTime(p0, at); pn.pan.linearRampToValueAtTime(p1, at + len); }      // we ride past it
    wire(bus, lp, pn, N.far); const sv = send(pn, 0.25 + 0.35 * dist, 'far');
    const vib = O('sine', 6.3), vd = G(9); wire(vib, vd); vib.start(at); vib.stop(at + len + 0.5);
    const pipe = (t, d, m, v) => {
      const f = 440 * Math.pow(2, (m - 69) / 12), o1 = O('square', f), o2 = O('sawtooth', f * 2), g = G(0), m2 = G(0.25);
      vd.connect(o1.detune); vd.connect(o2.detune); wire(o1, g); wire(o2, m2, g); g.connect(bus);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.018); g.gain.setValueAtTime(v, t + d); g.gain.linearRampToValueAtTime(0, t + d + 0.05);
      o1.start(t); o2.start(t); o1.stop(t + d + 0.08); o2.stop(t + d + 0.08); reap(o1, [o1, o2, g, m2]);
    };
    let t = at; for (const [m, b] of ORGAN.mel) { pipe(t + (R() - 0.5) * 0.01, b * bt * 0.9, m, 0.3); t += b * bt; }
    ORGAN.ch.forEach(([b, x, y], i) => {
      const t0 = at + i * 3 * bt; pipe(t0, bt * 0.8, b, 0.4); for (const k of [1, 2]) { pipe(t0 + k * bt, bt * 0.45, x, 0.17); pipe(t0 + k * bt, bt * 0.45, y, 0.17); }
      const o = O('sine', 70), g = G(0); wire(o, g, bus); const e = envAD(g.gain, t0, 0.9, 0.004, 0.18); o.frequency.setValueAtTime(90, t0); o.frequency.exponentialRampToValueAtTime(52, t0 + 0.1); o.start(t0); o.stop(e); reap(o, [o, g]);
    });
    const end = O('sine', 1); end.start(at); end.stop(at + len + 0.6); reap(end, [end, vib, vd, bus, lp, pn, sv].filter(Boolean));
    logCue('organ', at, { near: +near.toFixed(2) }); caption('organ');
    return len;
  }
  function drip(at) {             // rain on the promenade awnings: a single drop
    const o = O('sine', rr(1800, 4200)), g = G(0), pn = Pan(rr(-0.9, 0.9)); wire(o, g, pn, N.amb);
    o.frequency.setValueAtTime(o.frequency.value, at); o.frequency.exponentialRampToValueAtTime(o.frequency.value * 1.35, at + 0.012);
    const e = envAD(g.gain, at, rr(0.01, 0.03), 0.001, 0.012); o.start(at); o.stop(e); reap(o, [o, g, pn]);
  }
  function cricket(at, f, n, pan) {
    const o = O('sine', f), g = G(0), pn = Pan(pan); wire(o, g, pn, N.far);
    let t = at;
    for (let i = 0; i < n; i++) { for (let k = 0; k < 3; k++) { const s = t + k * 0.034; g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.03, s + 0.004); g.gain.linearRampToValueAtTime(0, s + 0.016); } t += rr(0.38, 0.46); }
    o.start(at); o.stop(t + 0.05); reap(o, [o, g, pn]);
    return t - at;
  }

  // ------------------------------------------------------------------ rig events → sim-time cues
  const CUES = {
    bell: [[AUDIO.bellStrikes[0], bell]],
    hop: [[0.05, (at) => whoosh(at, 0.2, 300, 700, 0.03)], [HOP.takeoff, (at) => { scuff(at); ramp(N.tyreGate.gain, 0, at, 0.03); whoosh(at, HOP.land - HOP.takeoff, 500, 1300, 0.06); honk(at, 'hup', 0.6); sting('wah', at + 0.02); }],
      [HOP.land, (at) => { thump(at); ramp(N.tyreGate.gain, 1, at, 0.02); }]],
    wave: [[0, waveSeq], [TIMING.wave.unfold[1] - 0.1, (at) => honk(at, 'double', 0.9)]],
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

  // ------------------------------------------------------------------ scheduler (audio time)
  // BGM transport: bar-quantised lookahead (whole bars are queued as their downbeat enters the window); stops while
  // the sim is paused / the tab is hidden / music is toggled off, and picks up again on the next free bar line
  function music(t, until) {
    const want = musicOn && wantOn && !paused && !hidden && (!solo || solo.has('mus'));
    if (want) {
      if (!N.bgm) N.bgm = createBGM(ac, N.musGate, { seed: (R() * 1e9) | 0, loop: true, gain: AUDIO.music.gain });
      if (!musicRun) { musicRun = true; N.bgm.start(Math.max(t + 0.08, N.bgm.nextTime)); ramp(N.musGate.gain, 1, t, 0.05); }
      N.bgm.pump(until + 0.1);
    } else if (musicRun) { musicRun = false; N.bgm.stop(); ramp(N.musGate.gain, 0, t, AUDIO.music.gateFade); }
  }
  function pump() {
    if (!ac || !N) return;
    const t = now(), until = t + AUDIO.lookahead;
    music(t, until);
    if (tickOn && tickRate > 1 && !paused) {
      if (nextTick < t) nextTick = t + 0.004;
      while (nextTick < until) { tick(nextTick); nextTick += 1 / tickRate; }
    } else nextTick = 0;
    if (nextSwell < until) { const s = Math.max(nextSwell, t); const D = swell(s); nextSwell = s + D * rr(0.5, 0.85); }
    if (nextGull < until) {
      const s = Math.max(nextGull, t), dawn = tod > 0.22 && tod < 0.36 ? 1.4 : 1, k = place.gull * dawn * (wx.fog > 0.4 ? 0.6 : 1) * (wx.rain > 0.4 ? 0.5 : 1);
      if (gullsOn && night < 0.55 && !paused) gullCall(s);
      nextGull = s + (cadence > 85 ? rr(5, 11) : rr(9, 24)) / Math.max(0.3, k);
    }
    // the place: tram gong in the village, the carousel organ at the pleasure pier, rain drips, the pelican idling
    if (nextTram < until) { const s = Math.max(nextTram, t); if (!paused && (stretch === 'village' || stretch === 'return') && night < 0.7) tramBell(s); nextTram = s + rr(22, 55); }
    if (nextOrgan < until) {
      const s = Math.max(nextOrgan, t), near = stretch === 'funfair' ? clamp(1 - Math.abs(km - FUNFAIR_KM), 0, 1) : 0;
      nextOrgan = near > 0.05 && !paused ? s + organ(s, near) + rr(1.5, 4) : s + 1;
    }
    if (wx.rain > 0.2 && nextDrip < until) { const s = Math.max(nextDrip, t); if (!paused) drip(s); nextDrip = s + rr(0.04, 0.25) / wx.rain; }
    if (nextClack < until) { const s = Math.max(nextClack, t); if (!paused && wantOn) clackRoll(s, 3 + Math.floor(R() * 4)); nextClack = s + rr(28, 60) * (night > 0.6 ? 2 : 1); }
    if (nextHonk < until) { const s = Math.max(nextHonk, t); if (!paused && wantOn && night < 0.6) honk(s, R() < 0.4 ? 'double' : 'honk', 0.8); nextHonk = s + rr(55, 120); }
    const foggy = wx.fog > 0.4;
    if (night > 0.6 || foggy) {
      if (!nightOn) { nightOn = true; nextHorn = t + rr(6, 14); }
      if (nextHorn < until) { const s = Math.max(nextHorn, t); if (!paused) fogHorn(s); nextHorn = s + (stretch === LIGHTHOUSE ? rr(22, 40) : rr(45, 85)); }
    }
    if (night > 0.6) {
      if (nextCricket < until) { const s = Math.max(nextCricket, t); const d = cricket(s, rr(4300, 4900), 3 + Math.floor(R() * 6), rr(-0.9, 0.9)); nextCricket = s + d + rr(0.6, 4.5); }
    } else {
      if (!foggy) nightOn = false;
      if (nextBoat < until) { const s = Math.max(nextBoat, t); if (!paused && night < 0.3) boatHorn(s); nextBoat = s + (stretch === 'harbour' ? rr(30, 60) : rr(70, 140)); }
    }
  }

  // ------------------------------------------------------------------ continuous controls (≈20 Hz)
  function controls(fr) {
    const t = now();
    const s = clamp((fr.speed / V_CRUISE) * 0.6, 0, 1.2); speedN = s; speedU = fr.speed; cadence = fr.cadence;
    wx = fr.weather || {}; tod = fr.tod ?? tod;
    if (wx.stretch && PLACE[wx.stretch]) { stretch = wx.stretch; place = PLACE[stretch]; }
    km = wx.km ?? km;
    const day = clamp(1 - (fr.night || 0) * 1.6, 0, 1);
    gustV += (R() - 0.5) * 0.09 - (gust - 1) * 0.05; gustV *= 0.92; gust = clamp(gust + gustV, 0.55, 1.7);
    const hold = hops.some(h0 => fr.t - h0 >= HOP.hold0 && fr.t - h0 < HOP.hold1);
    const pedal = !fr.coasting && !hold && fr.cadence > 1;
    glide(N.windG.gain, (0.07 + 1.05 * s * s) * gust, t, 0.3);
    glide(N.windBp.frequency, 280 + 950 * s + 260 * (gust - 1), t, 0.3);
    glide(N.whisG.gain, 0.05 * Math.max(0, gust - 1.08) * s, t, 0.35);
    glide(N.whisBp.frequency, 1100 + 500 * s + 400 * (gust - 1), t, 0.4);
    glide(N.roadG.gain, 0.3 * s, t, 0.2); glide(N.roadLp.frequency, 220 + 520 * s, t, 0.3);
    glide(N.gritG.gain, 0.035 * s, t, 0.2);
    glide(N.chG.gain, pedal ? 0.13 * (0.45 + s) : 0, t, 0.05);
    glide(N.humG.gain, pedal ? 0.09 * (0.3 + s) : 0, t, 0.05);
    glide(N.chOsc.frequency, Math.max(1, (fr.cadence / 60) * AUDIO.teeth), t, 0.05);
    glide(N.whine.frequency, Math.max(20, (fr.cadence / 60) * AUDIO.teeth * 6), t, 0.08);              // wind-up motor whine
    glide(N.whineG.gain, pedal ? 0.018 * (0.4 + s) : 0, t, 0.06);
    glide(N.murG.gain, 0.05 * place.crowd * day * (wx.rain > 0.3 ? 0.3 : 1), t, 2);
    glide(N.rainG.gain, 0.16 * (wx.rain || 0), t, 1.5);
    glide(N.pineG.gain, place.pines ? 0.05 * (0.4 + (wx.wind || 0) + 0.5 * s) : 0, t, 2);
    glide(N.humOsc.frequency, Math.max(0.5, (fr.cadence / 60) * 2), t, 0.05);         // two pedal strokes per turn
    glide(N.chBp.frequency, 2300 + 900 * s, t, 0.1);
    glide(N.tickBus.gain, 0.5 * (0.6 + 0.5 * Math.min(1, s)), t, 0.1);
    glide(N.seaG.gain, 0.09 + 0.03 * night, t, 1);
    for (const src of [N.windSrc, N.roadSrc]) glide(src.playbackRate, 0.92 + 0.16 * R(), t, 1.5);   // no audible loop
    night = fr.night || 0;
    gullsOn = !fr.toggles || fr.toggles.gulls !== false;
    musicOn = !fr.toggles || fr.toggles.music !== false;
    if (N.bgm) { const w = fr.weather || {}; N.bgm.setMood({ night, rain: w.rain || 0, fog: w.fog || 0 }); }   // applied on bar lines
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
  bus.on('ui:toggle', ({ key, value } = {}) => { if (key === 'music') { musicOn = value !== false; if (ac && N) pump(); } });
  bus.on('egg:found', e => { if (ac && N && wantOn && e && e.id) { const t = now() + 0.04; duckMusic(t); sting('egg', t, e.id); } });   // each egg: a little ta-da

  const api = {
    async enable() {
      wantOn = true;
      if (!ac) {
        try {
          const AC = opts.context ? null : (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext));
          if (!opts.context && !AC) { wantOn = false; bus.emit('audio:unavailable', {}); return false; }
          ac = opts.context || new AC({ latencyHint: 'interactive' });
          build();
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
      if (offline || opts.clock) pump();
    },
    setVolume(v) { if (typeof v !== 'number' || !isFinite(v)) return; vol = clamp(v, 0, 1); applyMaster(); },
    // tests / judge: scheduled cue log (kind, audio time, pan), context state, tick rate
    debug: () => ({ state: ac ? ac.state : 'none', log: log.slice(), tickRate, tickOn, masterTarget, paused, hidden, pawls: AUDIO.pawls, simT, hasFrame: !!lastFrame,
      music: { on: musicOn, running: musicRun, ...(N && N.bgm ? N.bgm.info() : {}) } }),
    get context() { return ac; },
  };
  return api;
}
