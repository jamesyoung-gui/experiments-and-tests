// Offline render of the whole soundscape (src/audio/audio.js) on a scripted ride, for measurement (docs/AUDIO.md §8).
// usage: node tools/render-sound.mjs [--secs 30] [--music] [--tod 0.7] [--rain 0] [--district village] [--solo music]
//        [--wav out.wav]   prints RMS per second, peak, the cue log summary; exits 1 on a page error or a clipped sample
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const opt = { secs: +arg('secs', 30), music: !!arg('music', false), tod: +arg('tod', 0.7), rain: +arg('rain', 0), fog: +arg('fog', 0), district: arg('district', 'village'), solo: arg('solo', null) };
const entry = `export { createAudio } from './src/audio/audio.js'; export { CADENCE, DIST_PER_REV } from './src/contract.js';`;
const lib = (await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'js' }, bundle: true, format: 'iife', globalName: 'SND', write: false })).outputFiles[0].text;
const browser = await chromium.launch(), page = await browser.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
await page.goto('about:blank'); await page.addScriptTag({ content: lib });
const res = await page.evaluate(async o => {
  const sr = 44100, ac = new OfflineAudioContext(2, Math.ceil(o.secs * sr), sr), L = {};
  const bus = { on: (k, f) => { (L[k] = L[k] || []).push(f); }, emit: (k, v) => (L[k] || []).forEach(f => f(v)) };
  let T = 0; const A = SND.createAudio(bus, { context: ac, clock: () => T, seed: 7, music: o.music, solo: o.solo ? [o.solo] : undefined });
  await A.enable();
  const ev = { 3: 'bell', 6: 'hop', 24: 'gulp', 27.5: 'wave' }, dt = 1 / 20;
  const frame = t => {
    const coast = t > 10 && t < 15, sprint = t > 16 && t < 22, cad = coast ? 0 : sprint ? SND.CADENCE.sprint : SND.CADENCE.cruise;
    const events = []; for (const k in ev) if (t <= +k && +k < t + dt) events.push({ type: ev[k], t0: +k });
    return { t, dt, speed: (Math.max(cad, coast ? 30 : 0) / 60) * SND.DIST_PER_REV, cadence: cad, coasting: coast, tod: o.tod, night: o.tod > 0.8 || o.tod < 0.2 ? 0.9 : 0.2,
      weather: { rain: o.rain, fog: o.fog, bow: 0, wind: 0.3, wet: o.rain, stretch: o.district }, events, toggles: { music: o.music } };
  };
  for (let t = 0; t < o.secs - 0.1; t += dt) ac.suspend(Math.round(t * sr / 128) * 128 / sr).then(() => { T = t; A.update(frame(t)); ac.resume(); });
  const buf = await ac.startRendering(), d = [buf.getChannelData(0), buf.getChannelData(1)];
  const per = []; let pk = 0, clip = 0, all = 0;
  for (let s = 0; s < o.secs; s++) { let e = 0, n = 0; for (const c of d) for (let i = s * sr; i < Math.min(c.length, (s + 1) * sr); i++) { e += c[i] * c[i]; n++; const v = Math.abs(c[i]); if (v > pk) pk = v; if (v >= 0.999) clip++; } all += e; per.push(+(10 * Math.log10(e / n + 1e-12)).toFixed(1)); }
  const log = A.debug().log, kinds = {}; for (const c of log) kinds[c.kind] = (kinds[c.kind] || 0) + 1;
  window.__d = d;
  return { per, peak: 20 * Math.log10(pk), rms: 10 * Math.log10(all / (2 * o.secs * sr)), clip, kinds, music: A.debug().music };
}, opt);
console.log(`render-sound ${JSON.stringify(opt)}`);
console.log(`  RMS ${res.rms.toFixed(1)} dBFS, peak ${res.peak.toFixed(2)} dBFS, clipped ${res.clip}`);
console.log(`  RMS per second: ${res.per.join(' ')}`);
console.log(`  cues: ${Object.entries(res.kinds).map(([k, n]) => k + '×' + n).join(' ')}`);
console.log(`  music: ${JSON.stringify(res.music)}`);
const wav = arg('wav', null);
if (wav) {
  const d = await page.evaluate(() => { const [l, r] = window.__d, o = new Int16Array(l.length * 2); for (let i = 0; i < l.length; i++) { o[2 * i] = Math.max(-1, Math.min(1, l[i])) * 32767; o[2 * i + 1] = Math.max(-1, Math.min(1, r[i])) * 32767; } let s = ''; const u = new Uint8Array(o.buffer); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); });
  const pcm = Buffer.from(d, 'base64'), h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(44100, 24); h.writeUInt32LE(44100 * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(wav, Buffer.concat([h, pcm])); console.log('  wrote ' + wav);
}
await browser.close();
if (errors.length) { console.error('errors:\n  ' + errors.join('\n  ')); process.exit(1); }
if (res.clip) process.exit(1);
