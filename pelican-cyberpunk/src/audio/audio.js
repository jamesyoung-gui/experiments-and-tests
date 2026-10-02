// OWNER: audio. Neon Pelican soundscape: 100 % procedural WebAudio, no samples, no files (docs/AUDIO.md).
//
// createAudio(bus, opts?) -> { enable():Promise<boolean>, disable(), update(frame), setVolume(v), setMusic(on), debug() }
//   opts.context  inject an (Offline)AudioContext (tests / judge render). Default: a real AudioContext,
//                 created lazily inside enable() (0 AudioContexts before the user opts in).
//   opts.clock    () => audio time; the offline harness passes the sim clock so update() can schedule ahead.
//   opts.seed     deterministic variation (default: time-seeded).
//   opts.solo     ['amb'|'mech'|'fx'|'far'|'voice'|'music'] keep only these buses (analysis renders).
//   opts.inst     ['kick','snare','hat','bass','pad','zheng','erhu','lead','talk','stab','pa','fx'] keep only these music parts (analysis renders).
//   opts.volume   0…1 (default 0.8).
//   opts.music    true: the track starts with the sound (default: follows toggles.music / ui:toggle {key:'music'}).
//
// Mix:  sources → buses (amb: rain/city bed/road/harbour · mech: chain/freewheel · fx: chime/thump/gulp · far: sirens,
//       drones, maglev, thunder, horns, gulls, PA, temple bells · voice: the pelican's vocoder · music: "Neon Delivery")
//       → master (fade) → highpass → glue compressor → brick-wall limiter → trim → out. One procedural plate reverb.
// Sync: rig events are cued in SIM time from TIMING (rig/solve.js X-sheets) and scheduled from update(frame) with a
//       120 ms lookahead, compensated for output latency, so the chime rings on the thumb pop and the thump lands on
//       the tyre-contact frame. The freewheel tick rate is exactly wheel rev/s × AUDIO.pawls.
// Music: 霓虹快递 · Neon Delivery (src/audio/bgm.js, docs/BGM.md), the 48-bar cyber-Chinatown theme at a fixed 96 bpm on
//       a 16th-note lookahead clock (200 ms ahead). The city thins or fills it per beat (mood, district, pace), it ducks
//       under events, and event stings (gulp, wave, mech suit-up) land on the next beat. While coasting, the pelican
//       hums the hook through its vocoder.
// City: a Blade-Runner megacity: stereo rain with glass-tube pings and puddle bloops, doppler sirens, drones, the
//       maglev, a garbled PA, sign buzz synced to the drawn flicker, steam vents, the market murmur, district beds
//       (arcade, temple, scrapyard), an e-bike motor whine, glitch stutters, a 5.2 s generated street-canyon reverb.
import { TIMING } from '../rig/solve.js';
import { BIKE, DIST_PER_REV, CADENCE } from '../contract.js';
import { hash } from '../world/route.js';
import { createBGM, voicing, BPM } from './bgm.js';

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
  music: ['[♪ synthwave: “Neon Delivery”]', '[♪ 合成器浪潮：《霓虹快递》]'],
  steam: ['[a steam vent hisses]', '[蒸汽口嘶嘶作响]'], temple: ['[a temple bell booms between the towers]', '[楼宇间传来古寺钟声]'],
  hack: ['[data glitch: the city crashes to wireframe]', '[数据故障：城市崩成线框]'],
};

function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function createAudio(bus, opts = {}) {
  const offline = !!(opts.context && typeof opts.context.startRendering === 'function');
  const R = mulberry(opts.seed ?? ((Date.now() ^ 0x9e3779b9) >>> 0));
  const rr = (a, b) => a + (b - a) * R();
  const solo = opts.solo ? new Set(opts.solo) : null;
  const inst = opts.inst ? new Set(opts.inst) : null;
  const hasDoc = typeof document !== 'undefined';
  let ac = null, N = null, timer = 0, wantOn = false, paused = false, hidden = false, vol = clamp(opts.volume ?? 0.8, 0, 1);
  let masterTarget = -1, lastLive = 0, lastCtl = -1, simT = 0, lastFrame = null;
  let tickOn = false, tickRate = 0, nextTick = 0, tickN = 0;
  let nextSwell = 0, nextGull = 0, nextHorn = 0, nextBarge = 0, nextSiren = 0, nextDrone = 0, nextMaglev = 0, nextPA = 0, nextCrackle = 0, nextDrip = 0, nextHmm = 0;
  let nextSteam = 0, nextTink = 0, nextBed = 0, nextChirp = 0, flickN = -1, hackOn = false, sceneEl = null;
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
  function plate(sec, decay = 0.55, dark = 0.8, pre = 0.016) {   // stereo IR: pre-delay, darkening exponential tail
    const sr = ac.sampleRate, n = Math.floor(sec * sr), buf = ac.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c); let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, k = 0.12 + dark * Math.min(1, t / sec);
        lp += (R() * 2 - 1 - lp) * (1 - k);
        d[i] = t < pre + c * 0.004 ? 0 : lp * Math.exp(-t / decay) * Math.min(1, (n - i) / (0.04 * sr));
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
  function crushCurve(levels) {   // bit-crusher staircase for the glitches
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.round(x * levels) / levels; }
    return c;
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
    const canyon = ac.createConvolver(); canyon.normalize = false; canyon.buffer = plate(5.2, 1.6, 0.86, 0.045);   // the street canyon
    const canRet = G(0.55); wire(canyon, canRet, master);
    const farLp = F('lowpass', 9000, 0.6); far.disconnect(); wire(far, farLp, master); far.connect(canyon);  // haze / smog darken the far city
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
    // rain in stereo: two decorrelated hiss layers hard left / right, two patter layers half left / right
    const rainG = G(0), patG = G(0), rainLps = [], rainSrcs = [];
    wire(rainG, duck); wire(patG, duck);
    for (const [k, p] of [[1.03, -0.85], [0.97, 0.85]]) {
      const s = bufSrc(whiteB, true, k), hp = F('highpass', 3600, 0.5), lp = F('lowpass', 11000, 0.5); wire(s, hp, lp, Pan(p), rainG); rainLps.push(lp); rainSrcs.push(s);
      const q = bufSrc(pinkB, true, k * 1.17), bp = F('bandpass', 1400 / k, 0.6); wire(q, bp, Pan(p * 0.55), patG); rainSrcs.push(q);
    }
    const rainLp = { frequency: { setTargetAtTime: (v, t, c) => rainLps.forEach(l => l.frequency.setTargetAtTime(v, t, c)) } };
    // market murmur: pink noise through three wandering formant bands with a syllabic flutter (a crowd, no words)
    const murG = G(0), murB = [];
    for (const [fc, p] of [[480, -0.6], [1150, 0.15], [2500, 0.65]]) {
      const s = bufSrc(pinkB, true, 0.9 + 0.1 * murB.length), bp = F('bandpass', fc, 2.6), g = G(0.3), fl = O('sine', 3.1 + 1.3 * murB.length), fd = G(0.18);
      wire(fl, fd); fd.connect(g.gain); wire(s, bp, g, Pan(p), murG); murB.push({ s, bp, g, fl, fc }); rainSrcs.push(s);
    }
    wire(murG, amb); murG.connect(canyon);
    // the e-bike hub motor: a whine that rises with speed (two partials through a resonant band), and the inverter's high PWM tone
    const mo1 = O('sawtooth', 160), mo2 = O('triangle', 320), mo2g = G(0.5), moBp = F('bandpass', 480, 4), moG = G(0), pwm = O('sine', 3200), pwmG = G(0);
    wire(mo1, moBp); wire(mo2, mo2g, moBp); wire(moBp, moG, Pan(-0.05), mech); wire(pwm, pwmG, Pan(0.1), mech);
    // the megacity bed: distant traffic rumble + the mid-band roar of a million air-conditioners
    const citySrc = bufSrc(brownB, true, 1.09), cityLp = F('lowpass', 150, 0.7), cityG = G(0.1);
    wire(citySrc, cityLp, cityG, amb);
    const cmSrc = bufSrc(pinkB, true, 0.83), cmBp = F('bandpass', 380, 0.6), cmG = G(0.015);
    wire(cmSrc, cmBp, cmG, amb);
    // neon hum: the 100 Hz ballast buzz of the signs (harmonics band-passed), a slow flicker on its level
    const nh1 = O('sawtooth', 100), nh2 = O('sawtooth', 100.35), nhBp = F('bandpass', 360, 2.2), nhBp2 = F('bandpass', 610, 3), nhG = G(0);
    wire(nh1, nhBp, Pan(-0.5), nhG); wire(nh2, nhBp2, Pan(0.55), nhG); wire(nhG, amb);              // two sign banks, left and right
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
    for (const s of [windSrc, roadSrc, gritSrc, seaSrc, ...rainSrcs, citySrc, cmSrc, chSrc, humSrc]) s.start(t0, R() * 5);
    for (const o of [chOsc, humOsc, nh1, nh2, mo1, mo2, pwm, ...murB.map(b => b.fl)]) o.start(t0);
    N = { master, amb, mech, fx, far, voice, music, verb, vin, duck, canyon, farLp, murG, murB, mo1, mo2, moBp, moG, pwm, pwmG, windSrc, windBp, windG, roadSrc, roadLp, roadG, tyreGate, gritG, seaG,
      rainG, rainLp, patG, cityG, cmG, nhG, nhBp, chOsc, chG, chBp, humOsc, humG, tickBus, clicks, pawlAmp, pinkB, brownB, whiteB,
      chip: pulseWave(0.125), drive: driveCurve(3.2), crush: crushCurve(6) };
    nextSwell = t0 + 0.4; nextGull = t0 + rr(8, 16); nextHorn = t0 + rr(10, 20); nextBarge = t0 + rr(30, 70); nextSiren = t0 + rr(9, 20);
    nextSteam = t0 + rr(4, 9); nextTink = t0 + 0.2; nextBed = t0 + rr(2, 5); nextChirp = t0 + rr(18, 30);
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
    if (musicOn && E) {                                    // in tune with the track: the current chord's tones
      const v = voicing(E.info().pcs, 86, 100, 4);
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
    say(at + T.swallow[0] + 0.95, VOICE.mmhm, { amp: 0.9 }); chirp(at + T.swallow[0] + 1.48, 2400, 1500, 0.09, 0.035);
    logCue('gulp', at + T.swallow[0] + 0.06); caption('gulp'); caption('mmhm');
    stings.push({ kind: 'gulp', notBefore: at + T.swallow[0] + 0.4 });
  }
  function waveSeq(at) {         // jacket + feather rustle while the wing unfolds and waves, and a "yo!"
    const T = TIMING.wave;
    whoosh(at + T.unfold[0], T.unfold[1] - T.unfold[0], 2200, 3800, 0.03, 0.15);
    for (let i = 0; i < 3; i++) whoosh(at + T.wave[0] + i * 0.28, 0.24, 1700, 3200, 0.02, 0.2);
    say(at + T.wave[0] + 0.05, VOICE.yo, { amp: 0.85 }); trill(at + T.wave[0] + 0.36, 3, 2100, 0.035);
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
    const pass = at + D * rr(0.4, 0.6), dop = rr(0.035, 0.07);                                        // doppler through the pass
    for (const [o, f] of [[o1, 800], [o2, 1600]]) { o.frequency.setValueAtTime(f * (1 + dop), at); o.frequency.setTargetAtTime(f * (1 - dop), pass, D * 0.07); }
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
    garbledPA(at + 1.9);
    logCue('pa', at); caption('pa');
  }
  // ---- the Blade-Runner layer: rain on glass tubes and puddles, steam vents, a garbled PA, sign buzz synced to the
  // drawn flicker, district beds (market murmur, arcade bleeps, temple bells, scrapyard clanks), glitch stutters
  const sendC = (node, amt) => { if (amt > 0) { const s = G(amt); node.connect(s); s.connect(N.canyon); } };
  function tink(at) {            // a raindrop on a neon tube: a short glassy ping, anywhere across the stereo field
    const f = rr(2600, 5600), pan = rr(-1, 1), o = O('sine', f), o2 = O('sine', f * 2.37), g = G(0), g2 = G(0.3), pn = Pan(pan);
    wire(o, g); wire(o2, g2, g); wire(g, pn, N.amb); sendC(pn, 0.25);
    const e = envAD(g.gain, at, rr(0.004, 0.012) * (0.5 + rainK), 0.0008, rr(0.03, 0.09)); o.start(at); o2.start(at); o.stop(e); o2.stop(e); reap(o, [o, o2, g, g2, pn]);
  }
  function puddle(at) {          // a drop into a puddle: a rising "bloop" and a splash grain
    const f = rr(500, 900), pan = rr(-0.95, 0.95), o = O('sine', f), g = G(0), pn = Pan(pan); wire(o, g, pn, N.amb);
    o.frequency.setValueAtTime(f, at); o.frequency.exponentialRampToValueAtTime(f * rr(1.8, 2.6), at + 0.025);
    const e = envAD(g.gain, at, rr(0.01, 0.024) * (0.4 + rainK), 0.002, 0.03); o.start(at); o.stop(e); reap(o, [o, g, pn]);
  }
  function steamVent(at, pan = rr(-0.8, 0.8)) {   // a street vent: a valve tick, then a hissing plume
    const D = rr(1.2, 2.8), s = bufSrc(N.whiteB), hp = F('highpass', 1300, 0.7), bp = F('bandpass', rr(2600, 4200), 0.7), g = G(0), pn = Pan(pan);
    wire(s, hp, bp, g, pn, N.amb); sendC(pn, 0.5);
    const a = rr(0.03, 0.06) * (0.6 + 0.6 * night);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(a, at + 0.12); g.gain.setTargetAtTime(a * 0.55, at + 0.2, D * 0.3); g.gain.linearRampToValueAtTime(0, at + D);
    bp.frequency.setTargetAtTime(bp.frequency.value * 0.7, at + 0.2, D * 0.4);
    s.start(at, R() * 5); s.stop(at + D + 0.05); reap(s, [s, hp, bp, g, pn]);
    latch(at, 0.12, 0.6);
    logCue('steam', at, { pan: +pan.toFixed(2) }); caption('steam');
  }
  function glitch(at, dur = 0.18, amp = 0.03, pan = rr(-0.4, 0.4), dest = N.fx) {   // a data stutter: a crushed square re-triggered at random rates
    const o = O('square', 400), cr = ac.createWaveShaper(), g = G(0), hp = F('highpass', 300, 0.7), pn = Pan(pan);
    cr.curve = N.crush; wire(o, cr, hp, g, pn, dest);
    let t = at; while (t < at + dur) { const d = rr(0.012, 0.035); o.frequency.setValueAtTime(rr(180, 2400), t); g.gain.setValueAtTime(R() < 0.75 ? amp * rr(0.5, 1) : 0, t); t += d; }
    g.gain.setValueAtTime(0, t); o.start(at); o.stop(t + 0.01); reap(o, [o, cr, g, hp, pn]);
    hudUntil = Math.max(hudUntil, t + 0.1);
  }
  function hackCrunch(at) {      // the HACK egg: the city drops to its wireframe; a data crunch, a power-down, stutters
    const s = bufSrc(N.whiteB), cr = ac.createWaveShaper(), lp = F('lowpass', 5000, 0.8), g = G(0); cr.curve = N.crush; wire(s, cr, lp, g, N.fx); sendC(g, 0.3);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.09, at + 0.01); g.gain.exponentialRampToValueAtTime(0.004, at + 0.5); g.gain.linearRampToValueAtTime(0, at + 0.55);
    lp.frequency.setValueAtTime(6000, at); lp.frequency.exponentialRampToValueAtTime(400, at + 0.5);
    s.start(at, R() * 4); s.stop(at + 0.6); reap(s, [s, cr, lp, g]);
    const o = O('sawtooth', 880), og = G(0), ol = F('lowpass', 3000, 3); wire(o, ol, og, N.fx);          // the power-down
    o.frequency.setValueAtTime(880, at); o.frequency.exponentialRampToValueAtTime(55, at + 0.7); ol.frequency.setValueAtTime(3000, at); ol.frequency.exponentialRampToValueAtTime(200, at + 0.7);
    const e = envAD(og.gain, at, 0.05, 0.005, 0.7); o.start(at); o.stop(e); reap(o, [o, og, ol]);
    glitch(at + 0.05, 0.35, 0.04, -0.5); glitch(at + 0.9, 0.2, 0.025, 0.6); glitch(at + 1.7, 0.25, 0.03, -0.2); glitch(at + 2.6, 0.15, 0.025, 0.4);
    hudSeq(at + 1.2, [64, 63, 64, 63], 0.03, 0.09, 'chip', 0.2);                                      // BREACH beeps
    duckUntil = Math.max(duckUntil, at + 0.8); ramp(N.duck.gain, 0.4, at, 0.02); ramp(N.duck.gain, 1, at + 0.6, 1.4);
    logCue('hack', at); caption('hack');
  }
  function hackOut(at) {         // the city rezzes back in: a rising sweep and a last stutter
    const o = O('sawtooth', 110), lp = F('lowpass', 400, 4), g = G(0); wire(o, lp, g, N.fx);
    o.frequency.setValueAtTime(110, at); o.frequency.exponentialRampToValueAtTime(1320, at + 0.35); lp.frequency.setValueAtTime(400, at); lp.frequency.exponentialRampToValueAtTime(6000, at + 0.35);
    const e = envAD(g.gain, at, 0.035, 0.25, 0.12); o.start(at); o.stop(e); reap(o, [o, lp, g]);
    glitch(at + 0.3, 0.12, 0.025, 0.1);
  }
  function neonBuzz(at, pan, dur) {   // a sign tube dropping out (the drawn flicker): the hum chokes, the arc spits
    const pn = Pan(pan), bus = G(1); wire(bus, pn, N.amb);
    const o = O('sawtooth', 100), bp = F('bandpass', 700, 2.5), og = G(0); wire(o, bp, og, bus);
    og.gain.setValueAtTime(0, at); og.gain.linearRampToValueAtTime(0.03, at + 0.004); og.gain.setValueAtTime(0.03, at + dur * 0.6); og.gain.linearRampToValueAtTime(0, at + dur);
    for (let i = 0; i < 3; i++) { const t = at + rr(0, dur), sb = bufSrc(N.whiteB), hp = F('highpass', 2500, 0.7), g = G(0); wire(sb, hp, g, bus); const e = envAD(g.gain, t, rr(0.02, 0.05), 0.0004, 0.006); sb.start(t, R() * 4); sb.stop(e); reap(sb, [sb, hp, g]); }
    o.start(at); o.stop(at + dur + 0.02); reap(o, [o, bp, og, bus, pn]);
  }
  function garbledPA(at) {       // "…attention…line seven…": vocoder syllables through a tinny horn speaker, echoing down the canyon
    const pan = rr(-0.6, 0.6), hp = F('highpass', 450, 0.7), bp = F('peaking', 1800, 1), sh = ac.createWaveShaper(), g = G(0.5), pn = Pan(pan), dl = ac.createDelay(1), dg = G(0.35);
    bp.gain.value = 9; sh.curve = N.drive; wire(hp, bp, sh, g, pn, N.far); wire(g, dl, dg, pn); dl.delayTime.value = 0.31;
    const V = 'aoeiau', segs = []; let n = 57 + Math.floor(R() * 5);
    for (let i = 0, k = 5 + Math.floor(R() * 5); i < k; i++) {
      n += R() < 0.5 ? 0 : R() < 0.5 ? 2 : -2;
      segs.push({ v: 'n', n, d: 0.03, a: 0.6 }, { v: V[Math.floor(R() * V.length)], n, d: rr(0.08, 0.2), a: 1 }, { v: 'm', d: rr(0.02, 0.09), a: R() < 0.4 ? 0 : 0.4 });
    }
    const vu = voiceUntil, end = say(at, segs, { amp: 0.55, pan: 0, dest: hp, carrier: 'square' }); voiceUntil = vu;   // not the pelican: no duck
    setTimeout(() => { for (const x of [hp, bp, sh, g, pn, dl, dg]) try { x.disconnect(); } catch { /* gone */ } }, (end - now() + 1.5) * 1000);
    logCue('paVoice', at, { pan: +pan.toFixed(2) });
  }
  function templeBell(at) {      // the old temple: a deep inharmonic bronze bell, a long canyon tail
    const m = [45, 48, 50, 52][Math.floor(R() * 4)], f = mtof(m), pan = rr(-0.5, 0.5), pn = Pan(pan), bus = G(1); wire(bus, pn, N.far);
    for (const [k, a, d] of [[1, 0.06, 5], [2.0, 0.03, 3], [2.76, 0.02, 2.2], [5.4, 0.008, 1.1], [0.5, 0.03, 4]]) {
      const o = O('sine', f * k), g = G(0); wire(o, g, bus); const e = envAD(g.gain, at, a, 0.004, d); o.start(at); o.stop(e); reap(o, [o, g]);
    }
    const tr = O('sine', 1.3), tg = G(0.25); wire(tr, tg); tg.connect(bus.gain); tr.start(at); tr.stop(at + 5);       // the beat of a big bell
    logCue('temple', at); caption('temple');
  }
  function arcade(at) {          // the arcade row: a cabinet's chiptune jingle or a coin chime from a doorway
    const pan = rr(-0.9, 0.9), base = 72 + [0, 2, 4, 7, 9][Math.floor(R() * 5)];
    const seq = R() < 0.3 ? [83, 88] : Array.from({ length: 3 + Math.floor(R() * 4) }, () => base + [0, 2, 4, 7, 9, 12][Math.floor(R() * 6)]);
    seq.forEach((m, i) => blip(at + i * 0.075, m, 0.06, 0.016, pan, 'chip', N.far));
  }
  function chirp(at, f0, f1, d, amp = 0.05, pan = 0.08) {   // the bird-bot: an FM chirp gliding f0 → f1
    const c = O('sine', f0), md = O('sine', f0 * 2), mg = G(0), g = G(0), pn = Pan(pan);
    wire(md, mg); mg.connect(c.frequency); wire(c, g, pn, N.voice); send(pn, 0.15, 'voice');
    for (const [o, k] of [[c, 1], [md, 2]]) { o.frequency.setValueAtTime(f0 * k, at); o.frequency.exponentialRampToValueAtTime(f1 * k, at + d); }
    mg.gain.setValueAtTime(f0 * 1.2, at); mg.gain.linearRampToValueAtTime(f0 * 0.1, at + d);
    const e = envAD(g.gain, at, amp, 0.004, d); c.start(at); md.start(at); c.stop(e); md.stop(e); reap(c, [c, md, mg, g, pn]);
    voiceUntil = Math.max(voiceUntil, e);
  }
  const trill = (at, n = 3, f = 2200, amp = 0.04) => { for (let i = 0; i < n; i++) chirp(at + i * 0.07, f * (1 + 0.12 * i), f * (1.35 + 0.1 * i), 0.05, amp); };
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

  // ================================================================== music: 霓虹快递 · Neon Delivery (src/audio/bgm.js, docs/BGM.md)
  // The composed loop runs on its own fixed 96 bpm clock (it never follows the cadence). The city only thins or fills
  // it, per beat: levels and filters from the mood, the district and the pace; a coast strips the drums and the lead
  // while the pelican croons the hook through its vocoder.
  let E = null, CR = null;
  const mus = { crooning: false };
  function moodOf() {
    if (heavy > 0.3) return 'rain';
    const td = ((tod % 1) + 1) % 1;
    if (td >= 0.86 || td < 0.2) return 'dark';
    if (td >= 0.74) return 'acid';
    if (td < 0.62) return 'day';
    return 'drive';
  }
  function musicMood() {
    const m = moodOf(), X = {};
    if (m === 'day') Object.assign(X, { kick: 0.85, snare: 0.8, bass: 0.85, pad: 1.1, erhu: 1.15, zheng: 1.1 });
    else if (m === 'acid') Object.assign(X, { bass: 1.1, stab: 1.15 });
    else if (m === 'dark') Object.assign(X, { lp: 6500, hat: 0.6, zheng: 0.8, pad: 0.9, erhu: 0.85, bass: 1.1 });
    else if (m === 'rain') Object.assign(X, { lp: 3200, kick: 0.8, hat: 0.5, snare: 0.75 });
    if (district === 'cliffs') X.lp = Math.min(X.lp ?? 2e4, 1500);          // the neon tunnel
    if (district === 'dunes') X.bass = (X.bass ?? 1) * 1.15;                 // the scrapyard
    if (district === 'fort') { X.erhu = (X.erhu ?? 1) * 1.3; X.zheng = (X.zheng ?? 1) * 1.3; }   // the temple: the Chinese voices forward
    if (district === 'funfair') X.talk = (X.talk ?? 1) * 1.2;               // the arcade: the talk-box forward
    if (!coasting && cadence >= CADENCE.sprint * 0.9) X.hat = (X.hat ?? 1) * 1.3;
    if (coasting) Object.assign(X, { kick: 0, snare: 0, hat: 0.3, lead: 0, talk: 0, bass: 0.6 });
    return X;
  }
  function buildMusic() {
    E = createBGM(ac, N.music, { seed: (R() * 4294967296) >>> 0, inst: inst ? [...inst] : null, mood: musicMood, gain: 1.35,
      onLead: (m, t, d) => { if (mus.crooning) croonNote(t, m - 12, d); } });
    // the pelican's vocoder croon (persistent carrier + band bank; hums the hook while coasting)
    const cr = O('sawtooth', 220), sq = O('square', 220), sqG = G(0.3), mix = G(1), V = G(0), out = G(0.14), pn = Pan(0.08);
    wire(cr, mix); wire(sq, sqG, mix);
    const gs = bandGains('m'), ch = BANDS.map((fc, i) => { const f = F('bandpass', fc, 5.5), g = G(gs[i] * 2.4); wire(mix, f, g, V); return g; });
    const vib = O('sine', 5), vibG = G(0); wire(vib, vibG); vibG.connect(cr.detune); vibG.connect(sq.detune);
    wire(V, out, pn, N.voice); send(pn, 0.25, 'voice');
    for (const o of [cr, sq, vib]) o.start(now());
    CR = { cr, sq, V, vibG, ch, all: [cr, sq, vib], out };
  }
  function killMusic() {
    if (E) E.dispose(); E = null;
    if (CR) { for (const o of CR.all) try { o.stop(); } catch { /* stopped */ } try { CR.out.disconnect(); } catch { /* gone */ } CR = null; }
  }
  function croonNote(at, midi, dur) {     // "mm" opening to "oo", a lazy portamento, delayed vibrato
    if (!CR) return;
    const f = mtof(clamp(midi, 50, 66));
    glide(CR.cr.frequency, f, at - 0.01, 0.03); glide(CR.sq.frequency, f, at - 0.01, 0.03);
    glide(CR.V.gain, 0.8, at, 0.03); glide(CR.V.gain, 0.4, at + Math.max(0.05, dur - 0.06), 0.03);
    glide(CR.vibG.gain, 0, at, 0.02); glide(CR.vibG.gain, 16, at + 0.2, 0.12);
    const g1 = bandGains('m'), g2 = bandGains('u');
    CR.ch.forEach((g, i) => { glide(g.gain, g1[i] * 2.4, at, 0.03); if (dur > 0.4) glide(g.gain, g2[i] * 2.4, at + 0.2, 0.1); });
  }
  function musicPump(t) {
    if (E.nextT < t - 0.05) E.resync(t + 0.03);                       // fell behind (tab away / paused): no backlog
    E.pump(t + AUDIO.musicAhead);
    for (let i = stings.length - 1; i >= 0; i--) {                     // event stings land on the next beat
      const s = stings[i]; if (t < s.notBefore - AUDIO.musicAhead) continue;
      stings.splice(i, 1);
      if (t - s.notBefore < 1.2) { const at = E.nextBeat(Math.max(s.notBefore, t + 0.02)); E.sting(s.kind, at); logCue('sting', at, { sting: s.kind }); }
    }
  }
  function setMusic(on) {
    const was = musicOn; musicOn = !!on;
    if (!ac || !N) return;
    if (musicOn && !was) {
      if (killTimer) { clearTimeout(killTimer); killTimer = 0; }
      if (!E) buildMusic();
      E.start(now() + 0.1, 0);
      caption('music'); logCue('music', now(), { on: true });
    }
    if (!musicOn && was && E) {
      const t = now();
      E.stop(t); if (CR) glide(CR.V.gain, 0, t, 0.1);
      logCue('music', t, { on: false });
      if (!offline) killTimer = setTimeout(() => { killTimer = 0; if (!musicOn) killMusic(); }, 1600);   // free the voices
    }
  }

  // ------------------------------------------------------------------ rig events → sim-time cues
  const CUES = {
    bell: [[AUDIO.bellStrikes[0], bell]],
    hop: [[0.05, (at) => whoosh(at, 0.2, 300, 700, 0.022)], [HOP.takeoff - 0.09, (at) => { say(at, VOICE.hup, { amp: 0.8 }); chirp(at + 0.16, 1800, 3200, 0.07, 0.04); caption('hup'); logCue('hup', at); }],
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
    if (E && musicOn && !paused) musicPump(t); else if (E) E.resync(t + 0.05);
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
    // rain on the neon tubes and in the puddles (rates follow the rain), steam vents on the street
    if (rainK > 0.05 && nextTink < until) { const s = Math.max(nextTink, t); if (R() < 0.6) tink(s); else puddle(s); nextTink = s + rr(0.04, 0.3) / (0.15 + rainK); }
    else if (rainK <= 0.05) nextTink = t + 0.2;
    if (nextSteam < until) { const s = Math.max(nextSteam, t), street = d === 'village' || d === 'return' || d === 'harbour' || d === 'railway' || d === 'dunes'; if (street || R() < 0.25) steamVent(s); nextSteam = s + (street ? rr(7, 16) : rr(20, 40)); }
    // the district beds: arcade cabinets, the temple bell, scrapyard clanks, grow-light drips
    if (nextBed < until) {
      const s = Math.max(nextBed, t);
      if (d === 'funfair') { arcade(s); nextBed = s + rr(1.2, 4); }
      else if (d === 'fort') { templeBell(s); nextBed = s + rr(9, 16); }
      else if (d === 'dunes') { latch(s, rr(0.15, 0.3), rr(0.35, 0.6)); if (R() < 0.5) latch(s + rr(0.1, 0.3), 0.15, 0.4); nextBed = s + rr(2, 6); }
      else if (d === 'pines') { plip(s, rr(900, 1600), 0.02, rr(-0.8, 0.8)); nextBed = s + rr(0.3, 1.2); }
      else nextBed = s + 1;
    }
    if (nextChirp < until) { const s = Math.max(nextChirp, t); if (s > voiceUntil + 1 && !mus.crooning) trill(s, 2 + Math.floor(R() * 3), rr(1700, 2600), 0.022); nextChirp = s + rr(20, 45); }
    if (nextHmm < until) {                       // the odd contented vocoder "hmm-hm"
      const s = Math.max(nextHmm, t);
      if (s > voiceUntil + 1 && !mus.crooning) { say(s, VOICE.hmm, { amp: 0.7 }); trill(s + 0.55, 2, 1900, 0.025); caption('hmm'); logCue('hmm', s); }
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
    if (lastStretch !== null && st !== lastStretch && !paused) { const at = t + 0.05; glitch(at, 0.1, 0.02); hudSeq(at + 0.1, [76, 83, 88, 81], 0.04, 0.07); logCue('mission', at, { district: st }); caption('mission'); }
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
    // the e-bike hub motor: assists while pedalling, its whine climbing with the speed (cadence 42 rpm cruise ≈ s 0.42)
    const mf = 120 + 520 * s;
    glide(N.mo1.frequency, mf, t, 0.15); glide(N.mo2.frequency, mf * 2, t, 0.15); glide(N.moBp.frequency, mf * 3, t, 0.2);
    glide(N.moG.gain, (pedal ? 0.05 : 0.012) * Math.min(1, s * 1.6), t, 0.25);
    glide(N.pwm.frequency, 2600 + 2200 * s, t, 0.2); glide(N.pwmG.gain, pedal ? 0.0025 * Math.min(1, s * 2) : 0, t, 0.2);
    // the market murmur (the neon district and the fish port), quieter late at night and in the downpour
    const market = district === 'village' || district === 'return' || district === 'harbour' ? 1 : district === 'fort' || district === 'funfair' ? 0.4 : 0.12;
    glide(N.murG.gain, 0.09 * market * (1 - 0.5 * night) * (1 - 0.6 * heavy), t, 1.2);
    for (const b of N.murB) { glide(b.g.gain, 0.2 + 0.25 * R(), t, 0.3); glide(b.bp.frequency, b.fc * (0.85 + 0.3 * R()), t, 0.4); }
    // haze and smog darken and soften the far city
    glide(N.farLp.frequency, 9000 - 6500 * smog, t, 1.5);
    // the drawn sign flicker (land.js: 7 Hz slots, the same hash): each drop-out of an on-screen sign buzzes
    if (!reduced && hasDoc && !offline && !paused) {
      const k = Math.floor((fr.t + AUDIO.lookahead) * 7);
      if (flickN < 0 || k < flickN || k - flickN > 3) flickN = k;
      for (; flickN < k; flickN++) {
        const kk = flickN + 1;
        for (let i = 0; i < 2; i++) if (hash(kk, 71 + i) < 0.035 || hash(Math.floor(kk / 2), 90 + i) < 0.02) {
          const pan = screenPan('.land-a-flick' + i); if (pan == null) continue;
          const at = Math.max(t + 0.005, t + (kk / 7 - fr.t)); neonBuzz(at, pan, 1 / 7); logCue('flicker', at, { sign: i });
        }
      }
    }
    // the HACK egg: the scene drops to its wireframe (#scene.egg-hack) → the data crunch; it rezzes back in
    if (hasDoc && !offline) {
      if (!sceneEl) sceneEl = document.querySelector('#scene');
      const hk = !!(sceneEl && sceneEl.classList.contains('egg-hack'));
      if (hk && !hackOn && !paused) hackCrunch(t + 0.01); else if (!hk && hackOn && !paused) hackOut(t + 0.01);
      hackOn = hk;
    }
    // coasting croon: starts ~0.6 s into a coast (music on), stops on the first pedal stroke or when the pelican talks
    if (fr.coasting && !coasting) coastSince = t;
    coasting = !!fr.coasting;
    const croon = !!E && musicOn && coasting && !hold && t - coastSince > 0.6 && t > voiceUntil + 0.3 && !paused;
    if (croon && !mus.crooning) { logCue('hum', t); caption('hum'); }
    if (!croon && mus.crooning && CR) { CR.V.gain.cancelScheduledValues(t); glide(CR.V.gain, 0, t, 0.12); }
    mus.crooning = croon;
    // music duck: rig events, the pelican's voice, HUD bleeps, nearby gags
    if (E) {             // −4.4 dB under rig events and eggs, −3 dB under the voice, −2 dB under HUD bleeps and nearby gags
      let near = false; const dz = fr.director;
      if (dz && dz.enc) for (const { kind, u } of dz.enc) if (kind !== 'kites' && kind !== 'fireworks' && u > -1.5 && u < 2) near = true;
      const dk = t < duckUntil ? 0.6 : t < voiceUntil ? 0.7 : t < hudUntil ? 0.8 : near ? 0.8 : 1;
      glide(E.duck.gain, dk, t, dk < 1 ? 0.06 : 0.5);
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
  function thoom(at) {            // the lock: a sub-boom (a driven 58 → 24 Hz sine), a mid punch and an air blast down the canyon
    const o = O('sine', 58), sh = ac.createWaveShaper(), g = G(0); sh.curve = N.drive; o.frequency.setValueAtTime(58, at); o.frequency.exponentialRampToValueAtTime(24, at + 1.3);
    wire(o, sh, g, N.fx); const e = envAD(g.gain, at, 0.55, 0.006, 1.6); o.start(at); o.stop(e); reap(o, [o, sh, g]);
    const p = O('sine', 140), pg = G(0); p.frequency.setValueAtTime(160, at); p.frequency.exponentialRampToValueAtTime(60, at + 0.12);
    wire(p, pg, N.fx); const e2 = envAD(pg.gain, at, 0.35, 0.002, 0.18); p.start(at); p.stop(e2); reap(p, [p, pg]);
    const s = bufSrc(N.brownB), lp = F('lowpass', 900, 0.7), sg = G(0); wire(s, lp, sg, N.fx); sendC(sg, 0.9);
    const e3 = envAD(sg.gain, at, 0.4, 0.004, 0.9); s.start(at, R() * 8); s.stop(e3); reap(s, [s, lp, sg]);
    ramp(N.duck.gain, 0.35, at, 0.02); ramp(N.duck.gain, 1, at + 0.7, 1.2);
  }
  function mechRiser(at, dur) {   // noise + a detuned saw pair climbing into the lock, wide in stereo
    const s = bufSrc(N.whiteB, true), bp = F('bandpass', 400, 1.4), g = G(0); wire(s, bp, g, N.fx); sendC(g, 0.3);
    bp.frequency.setValueAtTime(400, at); bp.frequency.exponentialRampToValueAtTime(7000, at + dur);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.05, at + dur - 0.02); g.gain.linearRampToValueAtTime(0, at + dur);
    s.start(at); s.stop(at + dur + 0.03); reap(s, [s, bp, g]);
    for (const p of [-0.7, 0.7]) {
      const o = O('sawtooth', 55), lp = F('lowpass', 300, 5), og = G(0), pn = Pan(p); o.detune.value = p * 14; wire(o, lp, og, pn, N.fx);
      o.frequency.setValueAtTime(55, at); o.frequency.exponentialRampToValueAtTime(440, at + dur); lp.frequency.setValueAtTime(300, at); lp.frequency.exponentialRampToValueAtTime(5000, at + dur);
      og.gain.setValueAtTime(0, at); og.gain.linearRampToValueAtTime(0.025, at + dur - 0.02); og.gain.linearRampToValueAtTime(0, at + dur);
      o.start(at); o.stop(at + dur + 0.03); reap(o, [o, lp, og, pn]);
    }
  }
  function mechSeq(at, on) {
    if (!on) { [0, 0.25, 0.5, 0.75, 1.0].forEach((d, i) => { servo(at + d, 0.22, 380 - 40 * i, 160, 0.03); latch(at + d + 0.2, 0.3, 0.8); }); hudSeq(at, [88, 81, 76, 69], 0.035, 0.08); return; }
    hudSeq(at, [81, 88, 81, 88], 0.035, 0.07);                                  // arming: lock-on bleeps
    whoosh(at + 0.05, 0.4, 600, 2400, 0.03, 0);                                 // the scan ring
    glitch(at + 0.02, 0.2, 0.025, 0.3);                                         // the HUD wakes up
    mechRiser(at + 1.2, 2.0);                                                   // the build into the lock
    [0.4, 0.6, 0.82, 1.02, 1.24, 1.44, 1.66, 1.92].forEach((d, i) => {         // one plate group per stage, walking across the stereo field
      servo(at + d, 0.28, 140 + 30 * i, 420 + 40 * i, 0.034, (i % 2 ? 0.6 : -0.6) * (1 - i / 10));
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
    duckUntil = Math.max(duckUntil, at + 3.9);
    if (musicOn && E) stings.push({ kind: 'mech', notBefore: at + 3.2 });        // the track answers on the beat
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
  bus.on('ui:camera', () => { if (live()) { hudSeq(now() + 0.01, [88], 0.03, 0.035); glitch(now() + 0.05, 0.06, 0.012); } });
  bus.on('ui:tod', ({ tod: td } = {}) => { if (live() && td !== undefined) hudSeq(now() + 0.01, [79, 86], 0.025, 0.04, 'sine'); });
  bus.on('egg:mech', ({ on, stop } = {}) => { if (!stop && live()) mechSeq(now() + 0.02, on); });
  bus.on('egg:found', ({ id } = {}) => {
    if (!id || !live()) return;
    const at = now() + 0.02; glitch(at, 0.12, 0.03, -0.2); hudSeq(at + 0.12, [69, 76, 81, 88, 93, 100], 0.045, 0.055, 'chip', 0.1);
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
      music: (() => { const I = E && E.info(); return { on: musicOn, built: !!E, bar: I ? I.bar : null, step: I ? I.step : null, bpm: BPM, mode: moodOf(), section: I ? I.sec : null, chords: I ? [I.chord] : null, crooning: mus.crooning }; })() }),
    get context() { return ac; },
  };
  return api;
}
