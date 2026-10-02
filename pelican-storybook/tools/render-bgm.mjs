// Render the storybook BGM "晚安，鹈鹕 · Goodnight, Pelican" (docs/BGM.md) as a standalone, shareable MP3.
// usage: node tools/render-bgm.mjs [--out dist/bgm-storybook.mp3] [--wav] [--lufs -15]
// 1. In headless Chromium, the page's own createAudio() (src/audio/audio.js, music bus soloed, opts.bgm 'once') plays
//    exactly one pass, Intro → Outro, into an OfflineAudioContext. The outro resolves with a short ritardando.
// 2. Node side: trim, 0.15 s fade-in, a 1.8 s tail after the last bar with a fade, loudness-normalise (BS.1770
//    K-weighted, gated) to about −15 LUFS, a look-ahead peak limiter at −1.5 dBFS, then MP3 192 kbps stereo 44.1 kHz
//    with @breezystack/lamejs → dist/bgm-storybook.mp3.
// 3. Self-review by measurement ("listening analysis"): a 10 s excerpt per section (RMS + low/mid/high band balance),
//    clipped samples, clicks; the hook's pitches detected from a celesta-only render vs the written score; the loop
//    seam (Outro → Intro, rendered in loop mode) for continuity; and the encoded MP3 decoded again for peak / RMS.
// Exits 1 on page errors, a peak above −1 dBFS, clipping, clicks, a wrong hook note or a broken seam.
const { chromium } = await import(process.env.PB_PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright/index.mjs');
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Mp3Encoder } from '@breezystack/lamejs';
import { serve } from './serve.mjs';
import { BARS, BGM, SCORE } from '../src/audio/audio.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const OUT = path.resolve(ROOT, arg('out', 'dist/bgm-storybook.mp3'));
const LUFS_T = +arg('lufs', -15), CEIL = -1.5, SR = 44100;
const BAR = BGM.beats * 60 / BGM.bpm, T0 = 0.1;              // music starts 0.1 s into each render
const db = x => 20 * Math.log10(x + 1e-12);
const fail = [];

// ------------------------------------------------------------------ render in the browser
const { srv, port } = await serve(0);
const browser = await chromium.launch();
const page = await browser.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
await page.goto(`http://127.0.0.1:${port}/src/index.dev.html?freeze`);
await page.waitForFunction(() => window.__pb && window.__pb.ready, null, { timeout: 20000 });
async function render(name, o) {
  const t = Date.now();
  const r = await page.evaluate(async ([name, o]) => {
    const { createAudio } = await import('/src/audio/audio.js');
    const { DIST_PER_REV } = await import('/src/contract.js');
    const bus = { on: () => () => {}, emit: () => {} }, sr = 44100;
    const ctx = new OfflineAudioContext(2, Math.ceil(sr * o.dur), sr);
    let T = 0;
    const a = createAudio(bus, { context: ctx, clock: () => T, seed: o.seed || 7, solo: ['music'], music: true, bgm: o.bgm, bgmFrom: o.from, inst: o.inst });
    await a.enable();
    const w = { wind: 0.1, cloud: 0, rain: 0, fog: 0, bow: 0, wet: 0, stretch: 'village' };
    for (let i = 0; i < o.dur * 10; i++) {          // 10 Hz frames: the music clock schedules 200 ms ahead
      T = i / 10;
      a.update({ t: T, dt: 1 / 10, speed: DIST_PER_REV, cadence: 60, coasting: false, tod: 0.5, night: 0, weather: w, director: { enc: [] },
        toggles: { music: true }, events: [], pal: { num: { lampOn: 0 } }, reduced: false });
    }
    const buf = await ctx.startRendering();
    (window.__bufs ||= {})[name] = [buf.getChannelData(0), buf.getChannelData(1)];
    return { n: buf.length, log: a.debug().log.filter(e => /^(loop|end|pageturn|tempo)$/.test(e.kind)) };
  }, [name, o]);
  console.log(`rendered ${name}: ${(r.n / SR).toFixed(1)} s in ${((Date.now() - t) / 1000).toFixed(1)} s`);
  return r;
}
async function fetchBuf(name, n) {        // pull the Float32 channels out of the page in 8 s chunks
  const ch = [new Float32Array(n), new Float32Array(n)], C = SR * 8;
  for (let c = 0; c < 2; c++) for (let off = 0; off < n; off += C) {
    const len = Math.min(C, n - off);
    const b64 = await page.evaluate(([name, c, off, len]) => {
      const a = window.__bufs[name][c].subarray(off, off + len), u8 = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
      let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s);
    }, [name, c, off, len]);
    ch[c].set(new Float32Array(new Uint8Array(Buffer.from(b64, 'base64')).buffer), off);
  }
  return ch;
}

// ------------------------------------------------------------------ DSP helpers (node)
function biquad(x, k) {                   // direct form I, k = [b0, b1, b2, a1, a2] (a0 = 1)
  const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = k[0] * x[i] + k[1] * x1 + k[2] * x2 - k[3] * y1 - k[4] * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
  return y;
}
function rbj(type, f, q = Math.SQRT1_2, gainDb = 0) {
  const w = 2 * Math.PI * f / SR, c = Math.cos(w), al = Math.sin(w) / (2 * q), A = Math.pow(10, gainDb / 40); let b, a;
  if (type === 'lp') { b = [(1 - c) / 2, 1 - c, (1 - c) / 2]; a = [1 + al, -2 * c, 1 - al]; }
  else if (type === 'hp') { b = [(1 + c) / 2, -(1 + c), (1 + c) / 2]; a = [1 + al, -2 * c, 1 - al]; }
  else {                                  // high shelf (BS.1770 stage 1)
    const sA = 2 * Math.sqrt(A) * al;
    b = [A * ((A + 1) + (A - 1) * c + sA), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - sA)];
    a = [(A + 1) - (A - 1) * c + sA, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - sA];
  }
  return [b[0] / a[0], b[1] / a[0], b[2] / a[0], a[1] / a[0], a[2] / a[0]];
}
function lufs([L, R]) {                   // ITU-R BS.1770-4 integrated loudness (K-weighting, 400 ms blocks, gates)
  const K = x => biquad(biquad(x, rbj('shelf', 1681.974450955533, 0.7071752369554196, 3.999843853973347)), rbj('hp', 38.13547087602444, 0.5003270373238773));
  const kl = K(L), kr = K(R), B = Math.floor(0.4 * SR), H = Math.floor(0.1 * SR), z = [];
  for (let s = 0; s + B <= kl.length; s += H) { let e = 0; for (let i = s; i < s + B; i++) e += kl[i] * kl[i] + kr[i] * kr[i]; z.push(e / B); }
  const ld = v => -0.691 + 10 * Math.log10(v + 1e-15);
  let g = z.filter(v => ld(v) > -70); const rel = ld(g.reduce((a, b) => a + b, 0) / g.length) - 10;
  g = g.filter(v => ld(v) > rel);
  return ld(g.reduce((a, b) => a + b, 0) / g.length);
}
function stats([L, R], a = 0, b = L.length) {
  let pk = 0, e = 0, clip = 0, clicks = 0;
  for (let i = a; i < b; i++) {
    const l = L[i], r = R[i], m = Math.max(Math.abs(l), Math.abs(r)); if (m > pk) pk = m; if (m >= 0.999) clip++;
    e += l * l + r * r;
    if (i > a + 1 && (Math.abs(l - 2 * L[i - 1] + L[i - 2]) > 0.5 || Math.abs(r - 2 * R[i - 1] + R[i - 2]) > 0.5)) clicks++;   // 2nd-difference spikes
  }
  return { peakDb: +db(pk).toFixed(2), rmsDb: +(10 * Math.log10(e / (2 * (b - a)) + 1e-12)).toFixed(2), clip, clicks };
}
function bands([L, R], a, b) {            // low < 250 Hz < mid < 4 kHz < high (LR4 splits), share of energy in dB
  const mono = new Float32Array(b - a); for (let i = a; i < b; i++) mono[i - a] = 0.5 * (L[i] + R[i]);
  const lp = (x, f) => biquad(biquad(x, rbj('lp', f)), rbj('lp', f)), hp = (x, f) => biquad(biquad(x, rbj('hp', f)), rbj('hp', f));
  const E = x => { let e = 0; for (const v of x) e += v * v; return e; };
  const lo = E(lp(mono, 250)), hi = E(hp(mono, 4000)), mid = E(hp(lp(mono, 4000), 250)), tot = lo + mid + hi;
  return { low: +(10 * Math.log10(lo / tot)).toFixed(1), mid: +(10 * Math.log10(mid / tot)).toFixed(1), high: +(10 * Math.log10(hi / tot)).toFixed(1) };
}
function goertzel(x, a, n, f) {           // power at f in a Hann-windowed segment
  const w = 2 * Math.PI * f / SR, k = 2 * Math.cos(w); let s1 = 0, s2 = 0;
  for (let i = 0; i < n; i++) { const v = (x[a + i] || 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1))); const s = v + k * s1 - s2; s2 = s1; s1 = s; }
  return s1 * s1 + s2 * s2 - k * s1 * s2;
}
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'], nm = m => NAMES[m % 12] + (Math.floor(m / 12) - 1);

// ------------------------------------------------------------------ 1. the standalone pass
const full = await render('full', { dur: BGM.bars * BAR + 4.5, bgm: 'once' });
const endT = full.log.find(e => e.kind === 'end')?.at;
if (!endT) fail.push('no end cue');
const raw = await fetchBuf('full', full.n);
const rawStats = stats(raw);
const a0 = Math.round(0.06 * SR), a1 = Math.min(full.n, Math.round((endT + 1.8) * SR));
const trk = [raw[0].slice(a0, a1), raw[1].slice(a0, a1)], n = a1 - a0;
const FI = Math.round(0.15 * SR), FO = Math.round(1.6 * SR);
for (const c of trk) {
  for (let i = 0; i < FI; i++) c[i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / FI);
  for (let i = 0; i < FO; i++) c[n - 1 - i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / FO);
}
const lufs0 = lufs(trk), gain = Math.pow(10, (LUFS_T - lufs0) / 20);
for (const c of trk) for (let i = 0; i < n; i++) c[i] *= gain;
{ // look-ahead peak limiter (4 ms attack backwards, 80 ms release forwards): never exceeds CEIL
  const thr = Math.pow(10, CEIL / 20), need = new Float32Array(n);
  for (let i = 0; i < n; i++) need[i] = Math.min(1, thr / Math.max(1e-9, Math.abs(trk[0][i]), Math.abs(trk[1][i])));
  const ka = Math.exp(-1 / (0.004 * SR)), kr = Math.exp(-1 / (0.08 * SR));
  for (let i = n - 2; i >= 0; i--) need[i] = Math.min(need[i], 1 - (1 - need[i + 1]) * ka);
  let g = 1, red = 0;
  for (let i = 0; i < n; i++) { g = Math.min(need[i], 1 - (1 - g) * kr); if (g < 0.999) red++; trk[0][i] *= g; trk[1][i] *= g; }
  console.log(`limiter active on ${(100 * red / n).toFixed(2)} % of samples`);
}
const lufs1 = lufs(trk), trkStats = stats(trk);

// per-section 10 s excerpts
const secs = []; let bar0 = 0;
for (const S of SCORE) {
  const nb = S.chords.split(' ').length, t = T0 + bar0 * BAR - 0.06, a = Math.round(t * SR), b = Math.min(n, a + 10 * SR);
  secs.push({ section: S.name, bars: `${bar0 + 1}-${bar0 + nb}`, at: +t.toFixed(2), ...stats(trk, a, b), bands: bands(trk, a, b) });
  bar0 += nb;
}

// ------------------------------------------------------------------ 2. the hook, heard back (celesta only, section A)
const A0 = BARS.findIndex(b => b.sec === 'A');
const hookR = await render('hook', { dur: 16 * BAR + 1.5, from: A0, inst: ['cel'] });
const hk = (await fetchBuf('hook', hookR.n))[0];
const hook = []; let wrong = 0;
for (let bi = 0; bi < 16; bi++) for (const nt of BARS[A0 + bi].notes) {
  const on = T0 + bi * BAR + nt.s * BAR / 6, a = Math.round((on + 0.03) * SR), p = Math.round((on - 0.13) * SR), W = Math.round(0.1 * SR);
  let best = 0, bv = -Infinity;
  for (let m = 60; m <= 88; m++) { const f = mtof(m), v = goertzel(hk, a, W, f) - goertzel(hk, p, W, f); if (v > bv) { bv = v; best = m; } }
  if (best !== nt.m) wrong++;
  hook.push(`${nm(nt.m)}${best === nt.m ? '' : '≠' + nm(best)}`);
}

// ------------------------------------------------------------------ 3. the loop seam (Outro → Intro, loop mode)
const seamR = await render('seam', { dur: 8 * BAR + 10, from: BARS.findIndex(b => b.sec === 'Outro') });
const sm = await fetchBuf('seam', seamR.n), loopT = seamR.log.find(e => e.kind === 'loop')?.at;
const seam = { expect: +(T0 + 8 * BAR).toFixed(4), at: loopT };
if (loopT != null) {
  // 0.5 s RMS windows from −6 s to +6 s: the step across the seam must be no bigger than the music's own steps
  const w = Math.round(0.5 * SR), c = Math.round(loopT * SR), win = [];
  for (let k = -12; k < 12; k++) win.push(stats(sm, c + k * w, c + (k + 1) * w).rmsDb);
  let inner = 0; for (let k = 1; k < win.length; k++) if (k !== 12) inner = Math.max(inner, Math.abs(win[k] - win[k - 1]));
  const avg = a => +(a.reduce((x, y) => x + y) / a.length).toFixed(1);
  Object.assign(seam, { gridErrMs: +(1000 * Math.abs(loopT - seam.expect)).toFixed(2), minRms: Math.min(...win), stepDb: +Math.abs(win[12] - win[11]).toFixed(1),
    innerMaxStepDb: +inner.toFixed(1), before4s: avg(win.slice(4, 12)), after4s: avg(win.slice(12, 20)),
    ...(({ clicks, clip }) => ({ clicks, clip }))(stats(sm, c - SR, c + SR)) });
  if (seam.gridErrMs > 1 || seam.minRms < -45 || seam.stepDb > Math.max(3, seam.innerMaxStepDb) || Math.abs(seam.before4s - seam.after4s) > 3 || seam.clicks) fail.push('seam');
} else fail.push('no loop cue');

// ------------------------------------------------------------------ 4. MP3 (192 kbps stereo 44.1 kHz), decoded back
const enc = new Mp3Encoder(2, SR, 192), parts = [], I16 = x => { const o = new Int16Array(x.length); for (let i = 0; i < x.length; i++) o[i] = Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767))); return o; };
const iL = I16(trk[0]), iR = I16(trk[1]);
for (let i = 0; i < n; i += 1152) { const b = enc.encodeBuffer(iL.subarray(i, i + 1152), iR.subarray(i, i + 1152)); if (b.length) parts.push(Buffer.from(b)); }
parts.push(Buffer.from(enc.flush()));
const mp3 = Buffer.concat(parts);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, mp3);
if (arg('wav', false)) {
  const w = Buffer.alloc(44 + n * 4); w.write('RIFF', 0); w.writeUInt32LE(36 + n * 4, 4); w.write('WAVEfmt ', 8); w.writeUInt32LE(16, 16); w.writeUInt16LE(1, 20); w.writeUInt16LE(2, 22);
  w.writeUInt32LE(SR, 24); w.writeUInt32LE(SR * 4, 28); w.writeUInt16LE(4, 32); w.writeUInt16LE(16, 34); w.write('data', 36); w.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { w.writeInt16LE(iL[i], 44 + i * 4); w.writeInt16LE(iR[i], 46 + i * 4); }
  fs.writeFileSync(OUT.replace(/\.mp3$/, '.wav'), w);
}
const dec = await page.evaluate(async b64 => {
  const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const buf = await new OfflineAudioContext(2, 44100, 44100).decodeAudioData(u8.buffer);
  (window.__bufs ||= {}).mp3 = [buf.getChannelData(0), buf.getChannelData(1)];
  return { n: buf.length, sr: buf.sampleRate, ch: buf.numberOfChannels };
}, mp3.toString('base64'));
const decB = await fetchBuf('mp3', dec.n), mp3Stats = stats(decB), mp3Lufs = lufs(decB);
await browser.close(); srv.close();

// ------------------------------------------------------------------ report
const mmss = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const rep = {
  file: path.relative(ROOT, OUT), kB: +(mp3.length / 1024).toFixed(0), length: mmss(n / SR), decoded: { ...dec, length: mmss(dec.n / dec.sr) },
  title: BGM.title, key: BGM.key, meter: BGM.meter, bpm: BGM.bpm, bars: BGM.bars, loop: mmss(BGM.bars * BAR),
  raw: { ...rawStats, lufs: +lufs(raw).toFixed(1) }, gainDb: +db(gain).toFixed(2),
  master: { ...trkStats, lufs: +lufs1.toFixed(1) }, mp3: { ...mp3Stats, lufs: +mp3Lufs.toFixed(1) },
  hook: { notes: hook.join(' '), wrong }, seam, sections: secs,
};
if (errs.length) fail.push('page errors: ' + errs.join(' | '));
if (mp3Stats.peakDb > -1) fail.push('mp3 peak ' + mp3Stats.peakDb);
if (rawStats.clip || trkStats.clip) fail.push('clipping');
if (trkStats.clicks) fail.push('clicks ' + trkStats.clicks);
if (wrong) fail.push(`hook: ${wrong} wrong notes`);
fs.mkdirSync(path.join(ROOT, 'shots/bgm'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'shots/bgm/analysis.json'), JSON.stringify(rep, null, 1));
console.log(`\n${rep.title} · ${rep.key} · ${rep.meter} · ${rep.bpm} bpm · ${rep.bars} bars (loop ${rep.loop}) → ${rep.file} (${rep.kB} kB, ${rep.length})`);
console.log(`MP3 peak ${mp3Stats.peakDb} dBFS · RMS ${mp3Stats.rmsDb} dBFS · ${rep.mp3.lufs} LUFS · clip ${mp3Stats.clip} · (pre-encode peak ${trkStats.peakDb}, clicks ${trkStats.clicks}; raw render peak ${rawStats.peakDb}, gain ${rep.gainDb} dB)`);
console.table(secs.map(s => ({ section: s.section, bars: s.bars, rms: s.rmsDb, peak: s.peakDb, low: s.bands.low, mid: s.bands.mid, high: s.bands.high })));
console.log('hook (A, celesta, detected):', rep.hook.notes, `→ ${wrong} wrong`);
console.log('seam:', JSON.stringify(seam));
console.log(fail.length ? 'FAIL: ' + fail.join('; ') : 'PASS');
process.exit(fail.length ? 1 : 0);
