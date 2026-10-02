// Render the BGM "鹈鹕大摇摆 · The Pelican Strut" (src/audio/bgm.js) to a standalone MP3: exactly one pass of the record,
// rubato intro → tag "shave and a haircut … two bits" with its ring-out, rendered by OfflineAudioContext in headless
// Chromium (the gramophone character and crackle are part of the render), then mastered in node (makeup to ≈ −15 LUFS
// — informational, the piece is deliberately dynamic — look-ahead brick-wall limiter at −1.6 dBFS, 0.4 s fade-in) and
// encoded with lamejs (192 kbps, stereo, 44.1 kHz). The MP3 is decoded again in Chromium for its real peak / RMS.
// usage: node tools/render-bgm.mjs [--out dist/bgm-poster.mp3] [--analyze]
//   gates (always): MP3 peak ≤ −1 dBFS, no clipped samples, length 2:00–3:30.
//   --analyze: per-section level + low/mid/high balance (from the full render), and a click scan of a crackle-free
//              render (the surface noise is the intended record texture) with a self-test of the detector.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { Mp3Encoder } from '@breezystack/lamejs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';
import { SONG } from '../src/audio/bgm.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const OUT = path.resolve(ROOT, arg('out', 'dist/bgm-poster.mp3'));
const SR = 44100, LEAD = 0.05, TAIL = 2.2, TARGET_LUFS = -15, CEIL_DB = -1.6;
const db = x => 20 * Math.log10(Math.max(1e-9, x));
const fail = [];

const { srv, port } = await serve(0);
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e => fail.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') fail.push('console: ' + m.text()); });
await page.goto(`http://127.0.0.1:${port}/src/audio/bgm.js`);

// ------------------------------------------------------------------ render in Chromium, pull the floats back in chunks
async function render({ from = 0, sec, loop = true, solo = null, crackle = true }) {
  const meta = await page.evaluate(async o => {
    const m = await import('/src/audio/bgm.js');
    const len = Math.ceil(o.sec * o.sr), ac = new OfflineAudioContext(2, len, o.sr);
    const glue = ac.createDynamicsCompressor();          // bus glue (the page uses its own master chain)
    glue.threshold.value = -18; glue.knee.value = 8; glue.ratio.value = 2.2; glue.attack.value = 0.015; glue.release.value = 0.22;
    glue.connect(ac.destination);
    const bgm = m.createBGM(ac, glue, { seed: 7, loop: o.loop, solo: o.solo, log: true, crackle: o.crackle });
    bgm.start(o.lead, o.from); bgm.pump(o.sec);
    const b = await ac.startRendering();
    window.__R = [b.getChannelData(0), b.getChannelData(1)];
    return { len, log: bgm.log, marks: bgm.marks };
  }, { from, sec, loop, solo, crackle, sr: SR, lead: LEAD });
  const ch = [new Float32Array(meta.len), new Float32Array(meta.len)], N = 1 << 20;
  for (let off = 0; off < meta.len; off += N) {
    const parts = await page.evaluate(([off, n]) => [0, 1].map(c => {
      const a = window.__R[c].subarray(off, off + n), u8 = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); let s = '';
      for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return btoa(s);
    }), [off, N]);
    parts.forEach((p, c) => { const b = Buffer.from(p, 'base64'); ch[c].set(new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), off); });
  }
  return { L: ch[0], R: ch[1], log: meta.log, marks: meta.marks };
}

// ------------------------------------------------------------------ measurement
function biquadK(x, b, a) { const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; }
function kweight(x) {   // BS.1770 K-weighting (high shelf + RLB high-pass), coefficients for any sample rate
  const shelf = (() => { const G = 4, Q = 1 / Math.SQRT2, f = 1500, A = Math.pow(10, G / 40), w = 2 * Math.PI * f / SR, al = Math.sin(w) / (2 * Q), c = Math.cos(w);
    const b0 = A * ((A + 1) + (A - 1) * c + 2 * Math.sqrt(A) * al), b1 = -2 * A * ((A - 1) + (A + 1) * c), b2 = A * ((A + 1) + (A - 1) * c - 2 * Math.sqrt(A) * al);
    const a0 = (A + 1) - (A - 1) * c + 2 * Math.sqrt(A) * al, a1 = 2 * ((A - 1) - (A + 1) * c), a2 = (A + 1) - (A - 1) * c - 2 * Math.sqrt(A) * al;
    return [[b0 / a0, b1 / a0, b2 / a0], [1, a1 / a0, a2 / a0]]; })();
  const hp = (() => { const f = 38, Q = 0.5, w = 2 * Math.PI * f / SR, al = Math.sin(w) / (2 * Q), c = Math.cos(w), a0 = 1 + al;
    return [[(1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0], [1, -2 * c / a0, (1 - al) / a0]]; })();
  return biquadK(biquadK(x, ...shelf), ...hp);
}
function lufs(L, R) {
  const kl = kweight(L), kr = kweight(R), blk = Math.floor(0.4 * SR), hop = Math.floor(0.1 * SR), z = [];
  for (let s = 0; s + blk <= L.length; s += hop) { let a = 0; for (let i = s; i < s + blk; i++) a += kl[i] * kl[i] + kr[i] * kr[i]; z.push(a / blk); }
  const Lk = v => -0.691 + 10 * Math.log10(v), abs = z.filter(v => Lk(v) > -70);
  const rel = Lk(abs.reduce((a, b) => a + b, 0) / abs.length) - 10, g = abs.filter(v => Lk(v) > rel);
  return Lk(g.reduce((a, b) => a + b, 0) / g.length);
}
const stats = (L, R, a = 0, b = L.length) => { let p = 0, s = 0; for (let i = a; i < b; i++) { p = Math.max(p, Math.abs(L[i]), Math.abs(R[i])); s += L[i] * L[i] + R[i] * R[i]; } return { peak: db(p), rms: 10 * Math.log10(s / (2 * (b - a)) + 1e-18) }; };
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const w = -2 * Math.PI / len; for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) {
    const cr = Math.cos(w * k), ci = Math.sin(w * k), ar = re[i + k + len / 2], ai = im[i + k + len / 2], tr = ar * cr - ai * ci, ti = ar * ci + ai * cr;
    re[i + k + len / 2] = re[i + k] - tr; im[i + k + len / 2] = im[i + k] - ti; re[i + k] += tr; im[i + k] += ti; } }
}
function bands(L, R) {   // share of spectral energy: low < 250 Hz, mid 250–4000, high > 4000
  const n = 4096, e = [0, 0, 0];
  for (let s = 0; s + n <= L.length; s += n) {
    const re = new Float64Array(n), im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = (L[s + i] + R[s + i]) * 0.5 * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / n));
    fft(re, im);
    for (let k = 1; k < n / 2; k++) { const f = k * SR / n, p = re[k] * re[k] + im[k] * im[k]; e[f < 250 ? 0 : f < 4000 ? 1 : 2] += p; }
  }
  const t = e[0] + e[1] + e[2]; return e.map(v => 10 * Math.log10(v / t));
}
function pitchOf(x, a, b) {   // YIN-style cumulative-mean-normalised difference, 150–1400 Hz
  const W = b - a, minT = Math.floor(SR / 1400), maxT = Math.floor(SR / 150), d = new Float64Array(maxT + 2);
  for (let T = 1; T <= maxT + 1; T++) { let s = 0; for (let i = a; i < b - maxT - 2; i++) { const v = x[i] - x[i + T]; s += v * v; } d[T] = s; }
  let run = 0, best = -1; const cm = new Float64Array(maxT + 2); cm[0] = 1;
  for (let T = 1; T <= maxT + 1; T++) { run += d[T]; cm[T] = d[T] * T / (run || 1); }
  for (let T = minT; T <= maxT; T++) if (cm[T] < 0.15 && cm[T] <= cm[T - 1] && cm[T] <= cm[T + 1]) { best = T; break; }
  if (best < 0) { let m = 1e9; for (let T = minT; T <= maxT; T++) if (cm[T] < m) { m = cm[T]; best = T; } }
  const y0 = cm[best - 1], y1 = cm[best], y2 = cm[best + 1], sh = (y0 - y2) / (2 * (y0 - 2 * y1 + y2) || 1);
  void W; return SR / (best + sh);
}

// ------------------------------------------------------------------ master (node side): makeup, limiter, fades
function master(L, R, gain) {
  const n = L.length, ceil = Math.pow(10, CEIL_DB / 20), la = Math.floor(0.005 * SR), rel = 1 - Math.exp(-1 / (0.09 * SR));
  const req = new Float32Array(n);
  for (let i = 0; i < n; i++) { const p = Math.max(Math.abs(L[i]), Math.abs(R[i])) * gain; req[i] = p > ceil ? ceil / p : 1; }
  const h = new Float32Array(n), dq = []; // sliding minimum over [i, i + la]
  for (let i = n - 1; i >= 0; i--) { while (dq.length && req[dq[dq.length - 1]] >= req[i]) dq.pop(); dq.push(i); while (dq[0] > i + la) dq.shift(); h[i] = req[dq[0]]; }
  let r = 1; const s = new Float32Array(n);
  for (let i = 0; i < n; i++) { r = h[i] < r ? h[i] : r + (h[i] - r) * rel; s[i] = r; }
  let acc = 0; const g = new Float32Array(n);   // moving average over the look-ahead: smooth attack, still ≤ the requirement
  for (let i = 0; i < n; i++) { acc += s[i]; if (i > la) acc -= s[i - la - 1]; g[i] = acc / Math.min(i + 1, la + 1); }
  const fi = Math.floor(0.4 * SR), fo = Math.floor(0.3 * SR);
  for (let i = 0; i < n; i++) {
    let k = gain * g[i];
    if (i < fi) k *= Math.sin(0.5 * Math.PI * i / fi) ** 2;
    if (i > n - fo) k *= (n - i) / fo;
    L[i] *= k; R[i] *= k;
  }
}
function toMp3(L, R) {
  const enc = new Mp3Encoder(2, SR, 192), toI16 = x => { const o = new Int16Array(x.length); for (let i = 0; i < x.length; i++) { const d = (Math.random() - Math.random()) / 32768; o[i] = Math.max(-32768, Math.min(32767, Math.round((x[i] + d) * 32767))); } return o; };
  const l = toI16(L), r = toI16(R), parts = [];
  for (let i = 0; i < l.length; i += 1152) { const b = enc.encodeBuffer(l.subarray(i, i + 1152), r.subarray(i, i + 1152)); if (b.length) parts.push(Buffer.from(b)); }
  const f = enc.flush(); if (f.length) parts.push(Buffer.from(f));
  return Buffer.concat(parts);
}

// ------------------------------------------------------------------ 1. the full track
const fullSec = LEAD + SONG.finalSec + TAIL;
console.log(`render: ${SONG.title}  ${SONG.bars} bars, tempo ${SONG.bpm} bpm, ${SONG.finalSec.toFixed(1)} s (+ ${TAIL} s ring-out)`);
const full = await render({ sec: fullSec, loop: false });
const raw = stats(full.L, full.R), rawLufs = lufs(full.L, full.R);
const makeup = Math.pow(10, (TARGET_LUFS - rawLufs) / 20);
console.log(`raw mix:   peak ${raw.peak.toFixed(2)} dBFS  rms ${raw.rms.toFixed(2)} dBFS  ${rawLufs.toFixed(2)} LUFS -> makeup ${db(makeup).toFixed(2)} dB`);
master(full.L, full.R, makeup);
const fin = stats(full.L, full.R), finLufs = lufs(full.L, full.R);
let clipped = 0; for (let i = 0; i < full.L.length; i++) if (Math.abs(full.L[i]) >= 0.999 || Math.abs(full.R[i]) >= 0.999) clipped++;
console.log(`mastered:  peak ${fin.peak.toFixed(2)} dBFS  rms ${fin.rms.toFixed(2)} dBFS  ${finLufs.toFixed(2)} LUFS  clipped samples ${clipped}`);
const mp3 = toMp3(full.L, full.R);
fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, mp3);
const dec = await page.evaluate(async b64 => {
  const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const ac = new OfflineAudioContext(2, 1, 44100), b = await ac.decodeAudioData(u8.buffer);
  let p = 0, s = 0, n = 0, clip = 0;
  for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > p) p = v; if (v >= 0.999) clip++; s += d[i] * d[i]; n++; } }
  return { dur: b.duration, ch: b.numberOfChannels, sr: b.sampleRate, peak: 20 * Math.log10(p), rms: 10 * Math.log10(s / n), clip };
}, mp3.toString('base64'));
const mm = Math.floor(dec.dur / 60), ss = (dec.dur % 60).toFixed(1).padStart(4, '0');
console.log(`MP3 ${path.relative(ROOT, OUT)}: ${(mp3.length / 1024).toFixed(0)} KB, 192 kbps, ${dec.ch} ch, ${dec.sr} Hz, ${mm}:${ss}  ` +
  `peak ${dec.peak.toFixed(2)} dBFS  RMS ${dec.rms.toFixed(2)} dBFS  clipped ${dec.clip}`);
if (dec.peak > -1) fail.push(`MP3 peak ${dec.peak.toFixed(2)} dBFS > -1`);
if (clipped || dec.clip) fail.push('clipped samples');
if (dec.dur < 120 || dec.dur > 210) fail.push(`length ${dec.dur.toFixed(1)} s outside 2:00-3:30`);

// ------------------------------------------------------------------ 2. listening analysis
if (arg('analyze', false)) {
  // per section, from the mastered full track: level and spectral balance (the dynamic arc of the record)
  console.log('\nsection     start    len   RMS dBFS   peak    low<250  mid  high>4k  (dB share of energy)');
  const mk = full.marks, end = full.L.length;
  mk.forEach((m, i) => {
    const a = Math.floor(m.t * SR), b = i + 1 < mk.length ? Math.floor(mk[i + 1].t * SR) : end, st = stats(full.L, full.R, a, b), bd = bands(full.L.subarray(a, b), full.R.subarray(a, b));
    console.log(`${m.sec.padEnd(9)} ${m.t.toFixed(1).padStart(6)}s ${((b - a) / SR).toFixed(1).padStart(5)}s ${st.rms.toFixed(1).padStart(8)} ${st.peak.toFixed(1).padStart(7)}   ${bd.map(v => v.toFixed(1).padStart(6)).join(' ')}`);
  });
  // clicks: a step is broadband, the record is not (its band stops at 5.2 kHz). So high-pass at 12 kHz (two RBJ
  // sections) and flag a residual spike far above its ±5 ms local mean (prefix sums).
  function clickScan(x, at = []) {
    const n = x.length, w = Math.floor(0.005 * SR), hpc = (() => { const f = 12000, Q = 0.7071, w0 = 2 * Math.PI * f / SR, al = Math.sin(w0) / (2 * Q), c = Math.cos(w0), a0 = 1 + al;
      return [[(1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0], [1, -2 * c / a0, (1 - al) / a0]]; })();
    const y = biquadK(biquadK(x, ...hpc), ...hpc), e = new Float64Array(n), cs = new Float64Array(n + 1); let c = 0;
    for (let i = 0; i < n; i++) { e[i] = Math.abs(y[i]); cs[i + 1] = cs[i] + e[i]; }
    for (let i = w; i < n - w; i++) {
      if (e[i] < 0.004) continue;
      const mean = (cs[i + w] - cs[i - w] - e[i]) / (2 * w - 1);
      if (e[i] > 10 * mean + 0.004) { c++; if (at.length < 12) at.push((i / SR).toFixed(3)); i += w; }
    }
    return c;
  }
  const clean = await render({ sec: fullSec, loop: false, crackle: false });
  for (let i = 0; i < clean.L.length; i++) { clean.L[i] *= makeup; clean.R[i] *= makeup; }
  const at = []; let clicks = 0; for (const x of [clean.L, clean.R]) clicks += clickScan(x, at);
  const seg = clean.L.slice(Math.floor(40 * SR), Math.floor(41 * SR)), base = clickScan(seg);
  for (let i = 22050; i < 22050 + 300; i++) seg[i] += 0.05 * (1 - (i - 22050) / 300);       // inject a −26 dBFS step
  const found = clickScan(seg) - base;
  console.log(`\nclick scan (crackle-free render, both channels): ${clicks}${at.length ? ' at ' + at.join(', ') + ' s' : ''}; detector self-test (−26 dBFS step injected mid-chorus): ${found === 1 ? 'found' : 'MISSED'}`);
  if (clicks) fail.push(`${clicks} clicks`); if (found !== 1) fail.push('click detector self-test');
  let pc = 0; for (let i = 0; i < clean.L.length; i++) if (Math.abs(clean.L[i]) >= 0.999 || Math.abs(clean.R[i]) >= 0.999) pc++;
  console.log(`pre-limiter clip check (clean render × makeup): ${pc} samples ≥ 0 dBFS (the limiter catches these)`);
}

await browser.close(); srv.close();
fail.forEach(f => console.error('FAIL ' + f));
console.log(fail.length ? `render-bgm: ${fail.length} failures` : 'render-bgm: all gates passed');
process.exit(fail.length ? 1 : 0);
