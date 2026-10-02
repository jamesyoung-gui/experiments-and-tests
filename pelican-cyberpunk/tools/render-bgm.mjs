// Render 霓虹快递 · Neon Delivery (src/audio/bgm.js) offline and encode it to dist/bgm-cyberpunk.mp3 (192 kbps, stereo,
// 44.1 kHz). One full loop, Intro through Outro, with a short fade-in and the outro's natural 2.5 s tail.
// The synth runs in an OfflineAudioContext in headless Chromium (Playwright); mastering (gain to about -15 LUFS, a
// look-ahead peak limiter at -1.5 dBFS), the analysis and the MP3 encode (@breezystack/lamejs) run here in node.
//
// usage: node tools/render-bgm.mjs            render + encode, print peak / RMS / LUFS of the decoded MP3
//        node tools/render-bgm.mjs --check    also the listening analysis (docs/BGM.md §7): per-section 10 s excerpts
//                                             (RMS, low/mid/high balance), clipping, clicks on every tonal stem, the
//                                             hook's pitches against the score, and the loop seam. Exits 1 on a failure.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { build } from 'esbuild';
import { Mp3Encoder } from '@breezystack/lamejs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORM, SECTIONS, BARS, BAR, S16, noteNum } from '../src/audio/bgm.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist/bgm-cyberpunk.mp3');
const SR = 44100, CHECK = process.argv.includes('--check'), T0 = 0.05, TAIL = 2.5;
const CEIL = 10 ** (-1.5 / 20), TARGET_LUFS = -15;
const db = x => 20 * Math.log10(Math.max(1e-12, x));
const fails = [];

// ---------------------------------------------------------------- the browser side
const lib = (await build({ entryPoints: [path.join(ROOT, 'src/audio/bgm.js')], bundle: true, format: 'iife', globalName: 'NeonBGM', write: false })).outputFiles[0].text;
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e => fails.push('pageerror: ' + e.message));
await page.goto('about:blank');
await page.addScriptTag({ content: lib });
await page.evaluate(() => {
  window.renderBGM = async ({ from = 0, secs, inst, dry, loop = false, tail = 2.5, seed = 7, finish = false }) => {
    const B = window.NeonBGM, sr = 44100, len = Math.ceil((0.05 + secs + tail) * sr);
    const ac = new OfflineAudioContext(2, len, sr), E = B.createBGM(ac, ac.destination, { seed, inst, dry, loop });
    // schedule like the live page does (a lookahead pump), not all at once: Chromium's AudioParam timelines slow down
    // quadratically when thousands of events are queued ahead
    const end = 0.05 + secs - 1e-6, pump = t => E.pump(Math.min(end, t + 1));
    E.start(0.05, from); pump(0);
    for (let t = 0.5; t < len / sr - 0.01; t += 0.5) ac.suspend(Math.round(t * sr / 128) * 128 / sr).then(() => { pump(t); ac.resume(); });
    if (finish) E.finish(0.05 + secs - B.BAR * 0.25);
    const buf = await ac.startRendering();
    window.__out = [buf.getChannelData(0), buf.getChannelData(1)]; window.__log = E.log;
    return len;
  };
  window.__get = (c, off, n) => {
    const a = window.__out[c].subarray(off, off + n), u8 = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  };
  window.decodeMp3 = async b64 => {
    const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const ac = new OfflineAudioContext(2, 44100, 44100), buf = await ac.decodeAudioData(u8.buffer);
    window.__out = [buf.getChannelData(0), buf.getChannelData(1 % buf.numberOfChannels)];
    return { len: buf.length, sr: buf.sampleRate, ch: buf.numberOfChannels };
  };
});
async function fetchOut(len) {
  const ch = [new Float32Array(len), new Float32Array(len)], N = 1 << 21;
  for (let c = 0; c < 2; c++) for (let off = 0; off < len; off += N) {
    const b = Buffer.from(await page.evaluate(([c, off, n]) => window.__get(c, off, n), [c, off, Math.min(N, len - off)]), 'base64');
    ch[c].set(new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), off);
  }
  return ch;
}
async function render(o) { const len = await page.evaluate(o => window.renderBGM(o), o); const ch = await fetchOut(len); const log = await page.evaluate(() => window.__log); return { ch, log }; }

// ---------------------------------------------------------------- measurements
function peakRms(ch, a = 0, b = ch[0].length) {
  let pk = 0, s = 0, clip = 0;
  for (const d of ch) for (let i = a; i < b; i++) { const v = Math.abs(d[i]); if (v > pk) pk = v; if (v >= 0.999) clip++; s += d[i] * d[i]; }
  return { peak: db(pk), rms: db(Math.sqrt(s / (2 * (b - a)))), clip };
}
function biquad(x, [b0, b1, b2, a1, a2]) { const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; }
function lufs(ch, sr = SR) {   // ITU-R BS.1770-4 integrated loudness (K-weighting, 400 ms blocks, absolute + relative gates)
  let K = Math.tan(Math.PI * 1681.974450955533 / sr); const Vh = 10 ** (3.999843853973347 / 20), Vb = Vh ** 0.4996667741545416, Qs = 0.7071752369554196;
  let a0 = 1 + K / Qs + K * K; const s1 = [(Vh + Vb * K / Qs + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Qs + K * K) / a0, 2 * (K * K - 1) / a0, (1 - K / Qs + K * K) / a0];
  K = Math.tan(Math.PI * 38.13547087602444 / sr); const Qh = 0.5003270373238773; a0 = 1 + K / Qh + K * K;
  const s2 = [1, -2, 1, 2 * (K * K - 1) / a0, (1 - K / Qh + K * K) / a0];
  const w = ch.map(x => biquad(biquad(x, s1), s2)), B = Math.round(0.4 * sr), H = Math.round(0.1 * sr), z = [];
  for (let s = 0; s + B <= w[0].length; s += H) { let e = 0; for (const d of w) for (let i = s; i < s + B; i++) e += d[i] * d[i]; z.push(e / B); }
  const L = e => -0.691 + 10 * Math.log10(e), g1 = z.filter(e => L(e) > -70), m1 = g1.reduce((a, b) => a + b, 0) / g1.length;
  const g2 = g1.filter(e => L(e) > L(m1) - 10); return L(g2.reduce((a, b) => a + b, 0) / g2.length);
}
function fft(re, im) { const n = re.length; for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a); for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr; re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } } }
function bands(ch, a, b) {      // energy share in low (20-250 Hz) / mid (250 Hz-4 kHz) / high (4-16 kHz)
  const N = 4096, e = [0, 0, 0];
  for (let s = a; s + N <= b; s += N) { const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = (ch[0][s + i] + ch[1][s + i]) * 0.5 * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); fft(re, im);
    for (let k = 1; k < N / 2; k++) { const f = k * SR / N, p = re[k] * re[k] + im[k] * im[k]; if (f < 20 || f > 16000) continue; e[f < 250 ? 0 : f < 4000 ? 1 : 2] += p; } }
  const tot = e[0] + e[1] + e[2]; return e.map(x => +(100 * x / tot).toFixed(1));
}
function yin(x, a, n) {          // fundamental (Hz) by the YIN difference function, 90-1400 Hz
  const lo = Math.floor(SR / 1400), hi = Math.ceil(SR / 90), d = new Float64Array(hi + 1); let run = 0;
  for (let tau = 1; tau <= hi; tau++) { let s = 0; for (let i = 0; i < n; i++) { const v = x[a + i] - x[a + i + tau]; s += v * v; } run += s; d[tau] = s * tau / (run || 1); }
  for (let tau = lo; tau < hi; tau++) if (d[tau] < 0.15) { while (tau + 1 < hi && d[tau + 1] < d[tau]) tau++; const p = d[tau - 1], q = d[tau + 1], c = d[tau], sh = (p - q) / (2 * (p - 2 * c + q) || 1); return SR / (tau + sh); }
  let best = lo; for (let tau = lo; tau < hi; tau++) if (d[tau] < d[best]) best = tau; return SR / best;
}
function clicks(ch) {            // isolated sample steps far above the stem's own steepness + abrupt cut-offs
  let n = 0, cut = 0; const steps = [];
  for (const d of ch) { const hs = new Float32Array(Math.floor(d.length / 7)); for (let i = 1, j = 0; j < hs.length; i += 7, j++) hs[j] = Math.abs(d[i] - d[i - 1]); hs.sort(); steps.push(hs[Math.floor(hs.length * 0.9999)] || 0); }
  ch.forEach((d, c) => { const lim = Math.max(0.01, 3 * steps[c]); for (let i = 1; i < d.length; i++) if (Math.abs(d[i] - d[i - 1]) > lim) n++;
    const W = 441; let prev = 0; for (let s = 0; s + W <= d.length; s += W) { let e = 0; for (let i = s; i < s + W; i++) e += d[i] * d[i]; e = Math.sqrt(e / W); if (prev > 0.01 && e < prev * 0.1) cut++; prev = e; } });
  return { steps: n, cuts: cut };
}

// ---------------------------------------------------------------- mastering
function master(ch) {
  const n = ch[0].length, fi = Math.round(0.25 * SR), fo = Math.round(0.6 * SR);
  for (const d of ch) { for (let i = 0; i < fi; i++) d[i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / fi); for (let i = 0; i < fo; i++) d[n - 1 - i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / fo); }
  let gain = 10 ** ((TARGET_LUFS - lufs(ch)) / 20), out;
  for (let pass = 0; pass < 3; pass++) {
    out = limit(ch.map(d => d.map(v => v * gain)));
    const l = lufs(out); if (Math.abs(l - TARGET_LUFS) < 0.15) break; gain *= 10 ** ((TARGET_LUFS - l) / 20);
  }
  return { out, gain: db(gain) };
}
function limit(ch) {             // look-ahead peak limiter: instant (pre-emptive) attack over 1.5 ms, 120 ms release
  const n = ch[0].length, L = Math.round(0.0015 * SR), rel = 1 - Math.exp(-1 / (0.12 * SR)), a = new Float32Array(n);
  for (let i = 0; i < n; i++) { const p = Math.max(Math.abs(ch[0][i]), Math.abs(ch[1][i])); a[i] = p > CEIL ? CEIL / p : 1; }
  const m = new Float32Array(n), q = []; let h = 0;
  for (let k = 0; k < n; k++) { while (q.length > h && a[q[q.length - 1]] >= a[k]) q.pop(); q.push(k); while (q[h] < k - L) h++; m[k] = a[q[h]]; if (h > 4096) { q.splice(0, h); h = 0; } }
  let r = 1; for (let k = 0; k < n; k++) { r = Math.min(m[k], r + (1 - r) * rel); m[k] = r; }
  const g = new Float32Array(n); let s = 0; for (let k = 0; k <= L && k < n; k++) s += m[k];
  for (let i = 0; i < n; i++) { g[i] = s / (L + 1); s -= m[i]; s += m[Math.min(n - 1, i + L + 1)]; }
  return ch.map(d => { const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = Math.max(-CEIL, Math.min(CEIL, d[i] * g[i])); return o; });
}
function mp3(ch) {
  const enc = new Mp3Encoder(2, SR, 192), parts = [], I = ch.map(d => { const o = new Int16Array(d.length); for (let i = 0; i < d.length; i++) o[i] = Math.round(Math.max(-1, Math.min(1, d[i])) * 32767); return o; });
  for (let i = 0; i < I[0].length; i += 1152) { const b = enc.encodeBuffer(I[0].subarray(i, i + 1152), I[1].subarray(i, i + 1152)); if (b.length) parts.push(Buffer.from(b)); }
  parts.push(Buffer.from(enc.flush())); return Buffer.concat(parts);
}

// ---------------------------------------------------------------- 1. the full loop → MP3
const loopSec = BARS * BAR;
console.log(`霓虹快递 · Neon Delivery: ${BARS} bars at ${(60 / (S16 * 4)).toFixed(0)} bpm = ${loopSec.toFixed(2)} s per loop (${Math.floor(loopSec / 60)}:${(loopSec % 60).toFixed(1).padStart(4, '0')})`);
const full = await render({ from: 0, secs: loopSec, tail: TAIL, finish: true });
const raw = peakRms(full.ch);
console.log(`raw mix     peak ${raw.peak.toFixed(2)} dBFS, RMS ${raw.rms.toFixed(2)} dBFS, ${lufs(full.ch).toFixed(2)} LUFS, samples ≥ 0 dBFS: ${raw.clip}`);
const { out, gain } = master(full.ch);
const mst = peakRms(out);
console.log(`mastered    gain ${gain.toFixed(2)} dB, peak ${mst.peak.toFixed(2)} dBFS, RMS ${mst.rms.toFixed(2)} dBFS, ${lufs(out).toFixed(2)} LUFS`);
const bytes = mp3(out);
fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, bytes);
const dec = await page.evaluate(b64 => window.decodeMp3(b64), bytes.toString('base64'));
const dch = await fetchOut(dec.len), dm = peakRms(dch), dl = lufs(dch);
console.log(`MP3         ${path.relative(ROOT, OUT)}  ${(bytes.length / 1024).toFixed(0)} KB, ${dec.ch} ch, ${dec.sr} Hz, ${(dec.len / dec.sr).toFixed(2)} s`);
console.log(`MP3 decoded peak ${dm.peak.toFixed(2)} dBFS, RMS ${dm.rms.toFixed(2)} dBFS, integrated ${dl.toFixed(2)} LUFS, clipped samples ${dm.clip}`);
if (dm.peak > -1) fails.push(`MP3 peak ${dm.peak.toFixed(2)} dBFS > -1`);
if (dl < -16.5 || dl > -13.5) fails.push(`MP3 loudness ${dl.toFixed(2)} LUFS outside -16…-14 (±0.5)`);

// ---------------------------------------------------------------- 2. the listening analysis
if (CHECK) {
  const at = s => Math.round((T0 + s) * SR);
  console.log('\nsections (10 s excerpts of the mastered mix, from each section start): RMS, low / mid / high energy %');
  for (const s of SECTIONS) {
    const a = at(s.from * BAR), b = Math.min(out[0].length, a + 10 * SR), pr = peakRms(out, a, b), bd = bands(out, a, b);
    console.log(`  ${s.id.padEnd(6)} bars ${String(s.from + 1).padStart(2)}-${String(s.from + s.bars).padEnd(2)}  RMS ${pr.rms.toFixed(1).padStart(6)} dBFS  peak ${pr.peak.toFixed(1)}  bands ${bd.join(' / ')}`);
    if (pr.clip) fails.push(`${s.id}: ${pr.clip} clipped samples`);
  }
  console.log('\nclicks per stem (full loop; |Δx| outliers > 3 × the stem\'s 99.99th-percentile step, and cut-offs: a > 20 dB drop between adjacent 10 ms windows)');
  for (const k of ['bass', 'pad', 'arp', 'lead', 'bell']) {
    const st = await render({ from: 0, secs: loopSec, tail: TAIL, inst: [k], finish: true }), c = clicks(st.ch), pr = peakRms(st.ch);
    console.log(`  ${k.padEnd(5)} RMS ${pr.rms.toFixed(1)} dBFS  steps ${c.steps}  cut-offs ${c.cuts}`);
    if (c.steps || c.cuts) fails.push(`${k}: ${c.steps} step clicks, ${c.cuts} cut-offs`);
  }
  console.log('\nthe hook against the score (lead stem, dry; YIN pitch 90 ms into each note)');
  const want = {}; for (const sec of FORM) want[sec.id] = sec;
  for (const id of ['A', 'A1', 'A2']) {
    const s = SECTIONS.find(x => x.id === id), bars = id === 'A2' ? 8 : s.bars, st = await render({ from: s.from, secs: bars * BAR, tail: 0.5, inst: ['lead'], dry: true });
    const mono = st.ch[0], notes = st.log.filter(e => e.k === 'lead');
    // the expected pitches, re-read from the written score text (independent of the engine's tables)
    const score = want[id].lead.split('|').slice(0, bars).flatMap(b => b.trim().split(/\s+/).filter(t => !t.startsWith('r')).map(t => noteNum(t.split(':')[0]) + (want[id].tr || 0)));
    let ok = 0; const bad = [];
    notes.forEach((nt, i) => {
      const a = Math.round((nt.t + 0.09) * SR), f = yin(mono, a, 1400), got = Math.round(69 + 12 * Math.log2(f / 440));
      const exp = score[i], match = id === 'A2' ? ((got - exp) % 12 + 12) % 12 === 0 : got === exp;   // A'' adds a sub-octave square
      if (match) ok++; else bad.push(`#${i + 1} want ${exp} got ${got}`);
    });
    const countOk = notes.length === score.length;
    console.log(`  ${id.padEnd(3)} ${ok}/${score.length} notes match${countOk ? '' : ` (scheduled ${notes.length})`}${bad.length ? '  ' + bad.slice(0, 6).join(', ') : ''}`);
    if (!countOk || ok !== score.length) fails.push(`hook ${id}: ${ok}/${score.length}`);
  }
  console.log('\nthe loop seam (outro → intro, the engine looping by itself)');
  {
    const out0 = SECTIONS.find(x => x.id === 'Out'), st = await render({ from: out0.from, secs: (out0.bars + 4) * BAR, tail: 0.3, loop: true });
    const seam = at(out0.bars * BAR), win = Math.round(0.02 * SR), d = st.ch;
    const all = []; for (let i = 1; i < d[0].length; i += 5) all.push(Math.abs(d[0][i] - d[0][i - 1])); all.sort((x, y) => x - y);
    let mx = 0; for (const c of d) for (let i = seam - win; i < seam + win; i++) mx = Math.max(mx, Math.abs(c[i] - c[i - 1]));
    const p999 = all[Math.floor(all.length * 0.999)], pre = peakRms(d, seam - 2 * SR, seam), post = peakRms(d, seam, seam + 2 * SR);
    const bPre = bands(d, seam - 2 * SR, seam), bPost = bands(d, seam, seam + 2 * SR);
    console.log(`  max |Δx| within ±20 ms of the seam ${mx.toFixed(4)} (excerpt 99.9th pct ${p999.toFixed(4)})`);
    console.log(`  2 s before: RMS ${pre.rms.toFixed(1)} dBFS, bands ${bPre.join(' / ')} · 2 s after: RMS ${post.rms.toFixed(1)} dBFS, bands ${bPost.join(' / ')}`);
    if (mx > Math.max(p999 * 2, 0.02)) fails.push('seam discontinuity');
    if (Math.abs(pre.rms - post.rms) > 4) fails.push(`seam level jump ${(post.rms - pre.rms).toFixed(1)} dB`);
  }
}
await browser.close();
if (fails.length) { console.error('\nFAIL\n  ' + fails.join('\n  ')); process.exit(1); }
console.log(CHECK ? '\nall checks pass' : '');
