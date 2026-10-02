// Offline render of the soundscape (so a person can LISTEN: judges cannot hear).
// usage: node tools/audio-offline.mjs [--out shots/audio] [--name pelican-bay] [--dur 45] [--tod 0.7] [--nomusic]
//        [--stretch railway] [--rain 0.8] [--wind 0.7] [--night 1]   (audition one stretch / weather / bedtime)
// Harness: an OfflineAudioContext is injected into createAudio (opts.context), its clock = the sim time t, and the
// scripted ride (cruise, bell at 3 s, hop at 6 s, coast 10–15 s, sprint to 95 rpm 16–22 s, gulp 24 s, wave 27.5 s,
// cruise on) is pushed as frames at 60 Hz before startRendering(). Writes <name>.wav (16-bit stereo 44.1 kHz) and
// prints peak dBFS, per-second RMS, a click count (|Δsample| > 0.3) and the L/R balance. Exits 1 on page errors,
// clipping (peak > -0.3 dBFS) or clicks.
const { chromium } = await import(process.env.PB_PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright/index.mjs');
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const out = path.resolve(ROOT, arg('out', 'shots/audio'));
const name = arg('name', 'pelican-bay');
const scen = { dur: +arg('dur', 45), tod: +arg('tod', 0.7), music: !arg('nomusic', false), stretch: arg('stretch', null), rain: +arg('rain', 0), wind: +arg('wind', 0.1), night: +arg('night', 0) };
fs.mkdirSync(out, { recursive: true });

const { srv, port } = await serve(0);
const browser = await chromium.launch();
const page = await browser.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
await page.goto(`http://127.0.0.1:${port}/src/index.dev.html?freeze`);
await page.waitForFunction(() => window.__pb && window.__pb.ready, null, { timeout: 20000 });
const res = await page.evaluate(async (scen) => {
  const { createAudio } = await import('/src/audio/audio.js');
  const { DIST_PER_REV, CADENCE } = await import("/src/contract.js");
  const L = {}; const bus = { on: (k, f) => ((L[k] ||= []).push(f), () => {}), emit: (k, v) => (L[k] || []).forEach(f => f(v)) };
  const dur = scen.dur, sr = 44100;
  const ctx = new OfflineAudioContext(2, sr * dur, sr);
  let T = 0;
  const a = createAudio(bus, { context: ctx, clock: () => T, seed: 7, music: scen.music });
  await a.enable();
  const ev = [[3, 'bell'], [6, 'hop'], [24, 'gulp'], [27.5, 'wave'], [36, 'bell']];
  const events = [];
  let cad = CADENCE.cruise, speed = cad / 60 * DIST_PER_REV;
  for (let i = 0; i < dur * 60; i++) {
    const t = i / 60; T = t;
    for (const [te, ty] of ev) if (t >= te && t - 1 / 60 < te) events.push({ type: ty, t0: te });
    const coast = t >= 10 && t < 15;
    const tgt = t >= 16 && t < 22 ? CADENCE.sprint + 8 : CADENCE.cruise;
    if (coast) speed *= Math.exp(-(1 / 60) * 0.08); else { cad += (tgt - cad) * (1 - Math.exp(-2.2 / 60)); speed = cad / 60 * DIST_PER_REV; }
    const w = { wind: scen.wind, cloud: 0, rain: scen.rain, fog: 0, bow: 0, wet: scen.rain, stretch: scen.stretch || (t < 20 ? 'village' : 'pier') };
    a.update({ t, dt: 1 / 60, speed, cadence: coast ? speed / DIST_PER_REV * 60 : cad, coasting: coast, tod: scen.tod, night: scen.night,
      weather: w, director: { enc: [] }, toggles: { music: scen.music }, events: events.filter(e => t - e.t0 < 8), pal: { num: { lampOn: 0 } }, reduced: false });
  }
  const cues = {}; for (const e of a.debug().log) cues[e.kind] = (cues[e.kind] || 0) + 1;
  const buf = await ctx.startRendering();
  const L0 = buf.getChannelData(0), R0 = buf.getChannelData(1), n = L0.length;
  let peak = 0, clicks = 0, eL = 0, eR = 0; const rms = [];
  for (let s = 0; s < dur; s++) { let e = 0; for (let i = s * sr; i < (s + 1) * sr; i++) e += L0[i] * L0[i] + R0[i] * R0[i]; rms.push(+(10 * Math.log10(e / (2 * sr) + 1e-12)).toFixed(1)); }
  for (let i = 0; i < n; i++) {
    const x = Math.max(Math.abs(L0[i]), Math.abs(R0[i])); if (x > peak) peak = x;
    if (i && (Math.abs(L0[i] - L0[i - 1]) > 0.3 || Math.abs(R0[i] - R0[i - 1]) > 0.3)) clicks++;
    eL += L0[i] * L0[i]; eR += R0[i] * R0[i];
  }
  const wav = new DataView(new ArrayBuffer(44 + n * 4));
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) wav.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); wav.setUint32(4, 36 + n * 4, true); ws(8, 'WAVE'); ws(12, 'fmt '); wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 2, true);
  wav.setUint32(24, sr, true); wav.setUint32(28, sr * 4, true); wav.setUint16(32, 4, true); wav.setUint16(34, 16, true); ws(36, 'data'); wav.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) { wav.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L0[i])) * 32767, true); wav.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R0[i])) * 32767, true); }
  const bytes = new Uint8Array(wav.buffer); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return { cues, peakDb: +(20 * Math.log10(peak + 1e-12)).toFixed(2), rms, clicks, lrDb: +(10 * Math.log10((eL + 1e-12) / (eR + 1e-12))).toFixed(2), wav: btoa(bin) };
}, scen);
const file = path.join(out, `${name}.wav`);
fs.writeFileSync(file, Buffer.from(res.wav, 'base64')); delete res.wav;
console.log(JSON.stringify({ file: path.relative(ROOT, file), ...scen, ...res }));
await browser.close(); srv.close();
const bad = errs.length || res.peakDb > -0.3 || res.clicks > 0;
if (errs.length) console.log('ERRORS', errs);
process.exit(bad ? 1 : 0);
