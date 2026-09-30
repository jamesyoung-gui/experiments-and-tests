// OWNER: audio. Pelican Bay soundscape: 100 % procedural WebAudio, no samples, no files.
//
// createAudio(bus, opts?) -> { enable():Promise<boolean>, disable(), update(frame), setVolume(v), debug() }
//   opts.context  inject an (Offline)AudioContext (tests / judge render). Default: a real AudioContext,
//                 created lazily inside enable() (0 AudioContexts before the user opts in).
//   opts.clock    () => audio time; the offline harness passes the sim clock so update() can schedule ahead.
//   opts.seed     deterministic variation (default: time-seeded).
//   opts.solo     ['amb'|'mech'|'fx'|'far'] keep only these buses (analysis renders).
//   opts.volume   0…1 (default 0.8).
//
// Mix:  sources → buses (amb: wind/road/sea · mech: chain/freewheel · fx: bell/thump/gulp · far: gulls/horns/crickets)
//       → master (fade) → glue compressor → brick-wall limiter → trim → out.  Shared procedural plate reverb send.
// Sync: rig events are cued in SIM time from TIMING (rig/solve.js X-sheets) and scheduled from update(frame) with
//       a 120 ms lookahead, compensated for output latency, so the bell rings on the thumb pop and the thump lands
//       on the tyre contact frame. The freewheel tick rate is exactly wheel rev/s × AUDIO.pawls.
import { TIMING } from '../rig/solve.js';
import { BIKE, DIST_PER_REV, CADENCE } from '../contract.js';

export const AUDIO = {
  pawls: 18,                 // freehub engagement points (coast tick rate = wheel rev/s × pawls)
  teeth: BIKE.ringT,         // chain whirr AM rate = crank rev/s × chainring teeth
  lookahead: 0.12, interval: 25,
  fadeIn: 0.6, fadeOut: 0.45, pauseFade: 0.4, hideFade: 0.08, hideSuspendMs: 100,
  bellStrikes: [TIMING.bell.strike, TIMING.bell.strike + 0.105],
};

const TAU = Math.PI * 2;
const V_MAX = (CADENCE.max / 60) * DIST_PER_REV;
const WHEEL_C = TAU * BIKE.R;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const HOP = { takeoff: TIMING.hop.takeoff, land: TIMING.hop.land, hold0: 0.2, hold1: TIMING.hop.land + 0.35 };
const GAP = { hop: TIMING.hop.gap, bell: 0.12, wave: TIMING.wave.gap, gulp: TIMING.gulp.gap };
const CAPTION = {
  bell: ['[bell rings]', '[车铃叮铃]'], land: ['[thump]', '[咚]'], gulp: ['[gulp]', '[咕嘟]'],
  gull: ['[gulls call]', '[海鸥鸣叫]'], horn: ['[distant fog horn]', '[远处雾笛]'], boat: ['[ship\'s horn]', '[轮船汽笛]'],
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
  let gust = 1, gustV = 0, gullsOn = true, night = 0, speedN = 0.5, cadence = 60;
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
  function clickBuf(f1, f2, f3) {  // freewheel pawl snap: three damped modes + a grain of noise
    const sr = ac.sampleRate, n = Math.floor(0.008 * sr), buf = ac.createBuffer(1, n, sr), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      d[i] = (0.55 * Math.sin(TAU * f1 * t) * Math.exp(-t / 0.0009) + 0.35 * Math.sin(TAU * f2 * t) * Math.exp(-t / 0.0006) +
        0.25 * Math.sin(TAU * f3 * t) * Math.exp(-t / 0.0014) + (R() * 2 - 1) * 0.3 * Math.exp(-t / 0.00025)) * Math.min(1, i / 6) * (1 - i / n);
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
    const amb = B('amb'), mech = B('mech'), fx = B('fx'), far = B('far');
    const verb = ac.createConvolver(); verb.normalize = false; verb.buffer = plate(2.4);
    const verbRet = G(0.8); wire(verb, verbRet, master);
    const vin = {}; for (const b of ['amb', 'mech', 'fx', 'far']) { vin[b] = G(solo && !solo.has(b) ? 0 : 1); vin[b].connect(verb); }
    const duck = G(1); duck.connect(amb);                                   // bell ducks wind + road

    const pinkB = noise(9.73, 'pink'), brownB = noise(13.31, 'brown'), whiteB = noise(6.07, 'white');
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
    // chain whirr: band noise amplitude-modulated at the tooth-engagement rate, plus a low roller hum
    const chSrc = bufSrc(whiteB, true, 1.07), chBp = F('bandpass', 2700, 1.3), chAM = G(0.55), chG = G(0), chPan = Pan(-0.12);
    const chOsc = O('sine', 48), chDepth = G(0.45);
    wire(chOsc, chDepth); chDepth.connect(chAM.gain);
    wire(chSrc, chBp, chAM, chG, chPan, mech);
    const humSrc = bufSrc(pinkB, true, 0.95), humBp = F('bandpass', 620, 3), humAM = G(0.6), humG = G(0);
    const humOsc = O('sine', 2), humDepth = G(0.4); wire(humOsc, humDepth); humDepth.connect(humAM.gain);
    wire(humSrc, humBp, humAM, humG, chPan);
    // freewheel ticks
    const tickBus = G(1), tickPan = Pan(-0.22); wire(tickBus, tickPan, mech);
    const clicks = [clickBuf(3150, 5120, 7400), clickBuf(3320, 4890, 7650), clickBuf(3050, 5360, 7200)];
    const pawlAmp = Array.from({ length: AUDIO.pawls }, (_, i) => 0.82 + 0.18 * Math.sin(i * 2.4) * Math.cos(i * 0.7) + 0.08 * R());

    const t0 = now();
    for (const s of [windSrc, roadSrc, gritSrc, seaSrc, chSrc, humSrc]) s.start(t0, R() * 5);
    chOsc.start(t0); humOsc.start(t0);
    N = { master, amb, mech, fx, far, verb, vin, duck, windSrc, windBp, windG, whisBp, whisG, roadSrc, roadLp, roadG, tyreGate, gritG, seaG, seaLp,
      chOsc, chG, chBp, humOsc, humG, tickBus, clicks, pawlAmp, pinkB, brownB, whiteB };
    nextSwell = t0 + 0.4; nextGull = t0 + rr(4, 8); nextHorn = t0 + rr(6, 14); nextBoat = t0 + rr(30, 70); nextCricket = t0 + rr(1, 3);
  }

  // ------------------------------------------------------------------ voices
  function send(node, amt, b = 'fx') { if (amt > 0) { const s = G(amt); node.connect(s); s.connect(N.vin[b]); return s; } return null; }
  function screenPan(sel, pick) {
    if (!hasDoc || offline) return null;
    try {
      const svg = document.querySelector('svg#scene'); if (!svg) return null;
      let els = [...svg.querySelectorAll(sel)].filter(e => e.getAttribute('visibility') !== 'hidden');
      const W = innerWidth || 1600;
      const rects = els.map(e => e.getBoundingClientRect()).filter(r => (r.width || r.height) && r.right > 0 && r.left < W);
      if (!rects.length) return null;
      const r = pick ? rects[Math.floor(R() * rects.length)] : rects[0];
      return clamp(((r.left + r.width / 2) / W) * 2 - 1, -1, 1);
    } catch { return null; }
  }

  function bellStrike(at, amp, pan) {
    // bicycle-bell dome: inharmonic partials, each a near-degenerate pair (beating shimmer), upper modes die first
    const f0 = 2215, P = [[1, 1, 2.3], [1.506, 0.42, 1.5], [2.013, 0.5, 1.15], [2.654, 0.26, 0.75], [3.212, 0.2, 0.5], [4.137, 0.11, 0.34], [0.503, 0.07, 1.2]];
    const pn = Pan(pan), bus = G(amp * 0.11), sv = send(pn, 0.22); wire(bus, pn, N.fx);
    let last = null, end = 0;
    P.forEach(([r, a, d], i) => {
      for (const det of [-1, 1]) {
        const o = O('sine', f0 * r + det * (0.7 + 0.45 * i)), g = G(0);
        wire(o, g, bus);
        const e = envAD(g.gain, at, a * (det < 0 ? 0.55 : 0.45), 0.0015, d);
        o.start(at); o.stop(e);
        if (e > end) { if (last) reap(last[0], last); end = e; last = [o, g]; } else reap(o, [o, g]);
      }
    });
    const n = bufSrc(N.whiteB), hp = F('bandpass', 5200, 1.2), g = G(0);          // striker tick
    wire(n, hp, g, bus); const e = envAD(g.gain, at, 0.5 * amp, 0.0008, 0.018);
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
    const D = rr(5.5, 9.5), peak = rr(0.14, 0.22), pan = rr(-0.65, 0.65), crest = rr(0.4, 0.5);
    const s = bufSrc(N.pinkB, true), lp = F('lowpass', 220, 0.6), g = G(0), pn = Pan(pan);
    lp.frequency.setValueAtTime(220, at); lp.frequency.exponentialRampToValueAtTime(rr(900, 1600), at + D * crest); lp.frequency.exponentialRampToValueAtTime(260, at + D);
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
    const panV = (2 * (170 - 0.15 * speedN * V_MAX)) / 1600 * (near ? 0.3 : 1);    // far gulls drift with their layer
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
  function fogHorn(at) {
    const pan = screenPan('[data-ref="sea-lantern"]') ?? 0.45;
    hornBlast(at, 163, 2.6, 0.042, pan, 520, 0.7);
    if (R() < 0.5) hornBlast(at + 4.2, 163, 2.6, 0.036, pan, 480, 0.7);
    logCue('horn', at, { pan }); caption('horn');
  }
  function boatHorn(at) {
    let pan = screenPan('[data-ref="sea-steamlit"]'); if (pan == null) pan = rr(-0.7, 0.7);
    hornBlast(at, 231, 0.55, 0.07, pan, 900, 0.6); hornBlast(at + 1.05, 231, 0.9, 0.07, pan, 900, 0.6);
    logCue('boat', at, { pan }); caption('boat');
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
    hop: [[0.05, (at) => whoosh(at, 0.2, 300, 700, 0.03)], [HOP.takeoff, (at) => { scuff(at); ramp(N.tyreGate.gain, 0, at, 0.03); whoosh(at, HOP.land - HOP.takeoff, 500, 1300, 0.06); }],
      [HOP.land, (at) => { thump(at); ramp(N.tyreGate.gain, 1, at, 0.02); }]],
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
  function pump() {
    if (!ac || !N) return;
    const t = now(), until = t + AUDIO.lookahead;
    if (tickOn && tickRate > 1 && !paused) {
      if (nextTick < t) nextTick = t + 0.004;
      while (nextTick < until) { tick(nextTick); nextTick += 1 / tickRate; }
    } else nextTick = 0;
    if (nextSwell < until) { const s = Math.max(nextSwell, t); const D = swell(s); nextSwell = s + D * rr(0.5, 0.85); }
    if (nextGull < until) {
      const s = Math.max(nextGull, t);
      if (gullsOn && night < 0.55 && !paused) gullCall(s);
      nextGull = s + (cadence > 85 ? rr(5, 11) : rr(9, 24));
    }
    if (night > 0.6) {
      if (!nightOn) { nightOn = true; nextHorn = t + rr(6, 14); }
      if (nextHorn < until) { const s = Math.max(nextHorn, t); if (!paused) fogHorn(s); nextHorn = s + rr(45, 85); }
      if (nextCricket < until) { const s = Math.max(nextCricket, t); const d = cricket(s, rr(4300, 4900), 3 + Math.floor(R() * 6), rr(-0.9, 0.9)); nextCricket = s + d + rr(0.6, 4.5); }
    } else {
      nightOn = false;
      if (nextBoat < until) { const s = Math.max(nextBoat, t); if (!paused && night < 0.3) boatHorn(s); nextBoat = s + rr(70, 140); }
    }
  }

  // ------------------------------------------------------------------ continuous controls (≈20 Hz)
  function controls(fr) {
    const t = now();
    const s = clamp(fr.speed / V_MAX, 0, 1.2); speedN = s; cadence = fr.cadence;
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
    glide(N.humOsc.frequency, Math.max(0.5, (fr.cadence / 60) * 2), t, 0.05);         // two pedal strokes per turn
    glide(N.chBp.frequency, 2300 + 900 * s, t, 0.1);
    glide(N.tickBus.gain, 0.5 * (0.6 + 0.5 * Math.min(1, s)), t, 0.1);
    glide(N.seaG.gain, 0.09 + 0.03 * night, t, 1);
    for (const src of [N.windSrc, N.roadSrc]) glide(src.playbackRate, 0.92 + 0.16 * R(), t, 1.5);   // no audible loop
    night = fr.night || 0;
    gullsOn = !fr.toggles || fr.toggles.gulls !== false;
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
    debug: () => ({ state: ac ? ac.state : 'none', log: log.slice(), tickRate, tickOn, masterTarget, paused, hidden, pawls: AUDIO.pawls, simT, hasFrame: !!lastFrame }),
    get context() { return ac; },
  };
  return api;
}
