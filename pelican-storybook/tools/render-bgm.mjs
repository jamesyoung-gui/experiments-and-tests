// Render the storybook BGM "晚安，鹈鹕 · Goodnight, Pelican" (docs/BGM.md) as a standalone, shareable MP3.
// usage: node tools/render-bgm.mjs [--out dist/bgm-storybook.mp3] [--wav]
// 1. In headless Chromium, the page's own createAudio() (src/audio/audio.js, music bus soloed, opts.bgm 'once') plays
//    exactly one pass, Wind-up → Doze-off, into an OfflineAudioContext.
// 2. Node side: trim, 0.15 s fade-in, a tail after the last bar with a fade, a PEAK normalisation to −1.5 dBFS (no
//    loudness target: the hush stays a hush), a safety look-ahead limiter, then MP3 192 kbps stereo 44.1 kHz with
//    @breezystack/lamejs → dist/bgm-storybook.mp3.
// 3. Measurement: a ≤ 10 s excerpt per section (RMS, peak, low/mid/high balance), clipped samples, clicks, the loop
//    seam (Doze-off → Wind-up, rendered in loop mode) for clicks, and the encoded MP3 decoded again for peak / RMS.
// Exits 1 on page errors, a decoded peak above −1 dBFS, clipping or clicks.
const { chromium } = await import(process.env.PB_PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright/index.mjs');
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Mp3Encoder } from '@breezystack/lamejs';
import { serve } from './serve.mjs';
import { BARS, BGM } from '../src/audio/audio.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const OUT = path.resolve(ROOT, arg('out', 'dist/bgm-storybook.mp3'));
const CEIL = -1.5, SR = 44100, T0 = 0.1;                   // music starts 0.1 s into each render
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
    return { n: buf.length, log: a.debug().log.filter(e => /^(loop|end|section|tempo)$/.test(e.kind)) };
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

// ------------------------------------------------------------------ 1. the standalone pass
const full = await render('full', { dur: BGM.seconds + 22, bgm: 'once' });
const endT = full.log.find(e => e.kind === 'end')?.at;
if (!endT) fail.push('no end cue');
const raw = await fetchBuf('full', full.n);
const rawStats = stats(raw);
const a0 = Math.round(0.06 * SR), a1 = Math.min(full.n, Math.round((endT + 2.2) * SR));   // the snore's last breath
const trk = [raw[0].slice(a0, a1), raw[1].slice(a0, a1)], n = a1 - a0;
const FI = Math.round(0.15 * SR), FO = Math.round(1.6 * SR);
for (const c of trk) {
  for (let i = 0; i < FI; i++) c[i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / FI);
  for (let i = 0; i < FO; i++) c[n - 1 - i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / FO);
}
const gain = Math.pow(10, (CEIL + 0.2) / 20) / Math.pow(10, stats(trk).peakDb / 20);
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
const trkStats = stats(trk);

// per-section excerpts (≤ 10 s from each section's first downbeat, from the 'section' cues)
const SEC = full.log.filter(e => e.kind === 'section'), secs = [];
SEC.forEach((e, i) => {
  const t = e.at - 0.06, tEnd = (SEC[i + 1] ? SEC[i + 1].at : endT) - 0.06, a = Math.round(t * SR), b = Math.min(n, Math.round(Math.min(tEnd, t + 10) * SR));
  secs.push({ section: e.name, at: +t.toFixed(1), len: +(tEnd - t).toFixed(1), ...stats(trk, a, b), bands: bands(trk, a, b) });
});
const contrast = +(Math.max(...secs.map(s => s.rmsDb)) - Math.min(...secs.map(s => s.rmsDb))).toFixed(1);

// ------------------------------------------------------------------ 3. the loop seam (Doze-off → Wind-up, loop mode)
const D0 = BARS.findIndex(b => b.sec === BARS[BARS.length - 1].sec);
const seamR = await render('seam', { dur: 30, from: D0 });
const sm = await fetchBuf('seam', seamR.n), loopT = seamR.log.find(e => e.kind === 'loop')?.at;
const seam = { at: loopT };
if (loopT != null) { const c = Math.round(loopT * SR); Object.assign(seam, stats(sm, c - 2 * SR, Math.min(sm[0].length, c + 4 * SR))); if (seam.clicks || seam.clip) fail.push('seam clicks'); }
else fail.push('no loop cue');

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
  title: BGM.title, key: BGM.key, meter: BGM.meter, bpm: BGM.bpm, bars: BGM.bars, loop: mmss(endT - T0),
  raw: rawStats, gainDb: +db(gain).toFixed(2), master: trkStats, mp3: { ...mp3Stats, lufs: +mp3Lufs.toFixed(1) },
  contrastDb: contrast, seam, sections: secs,
};
if (errs.length) fail.push('page errors: ' + errs.join(' | '));
if (mp3Stats.peakDb > -1) fail.push('mp3 peak ' + mp3Stats.peakDb);
if (rawStats.clip || trkStats.clip) fail.push('clipping');
if (trkStats.clicks) fail.push('clicks ' + trkStats.clicks);
fs.mkdirSync(path.join(ROOT, 'shots/bgm'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'shots/bgm/analysis.json'), JSON.stringify(rep, null, 1));
console.log(`\n${rep.title} · ${rep.key} · ${rep.meter} · ${rep.bpm} bpm · ${rep.bars} bars (loop ${rep.loop}) → ${rep.file} (${rep.kB} kB, ${rep.length})`);
console.log(`MP3 peak ${mp3Stats.peakDb} dBFS · RMS ${mp3Stats.rmsDb} dBFS (≈ ${rep.mp3.lufs} LUFS, no target) · clip ${mp3Stats.clip} · (pre-encode peak ${trkStats.peakDb}, clicks ${trkStats.clicks}; raw peak ${rawStats.peakDb}, gain ${rep.gainDb} dB) · section contrast ${contrast} dB`);
console.table(secs.map(s => ({ section: s.section, at: s.at, len: s.len, rms: s.rmsDb, peak: s.peakDb, low: s.bands.low, mid: s.bands.mid, high: s.bands.high })));
console.log('seam:', JSON.stringify(seam));
console.log(fail.length ? 'FAIL: ' + fail.join('; ') : 'PASS');
process.exit(fail.length ? 1 : 0);
