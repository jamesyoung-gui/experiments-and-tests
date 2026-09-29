// Screenshot harness. Renders deterministic frames via window.__pb.renderAt and fails on console errors.
// usage: node tools/shoot.mjs [--dist] [--out shots/lead] [--set hero,frames,tods,cams,mobile,events] [--query "solo=bike"] [--perf] [--sheet]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from './serve.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const out = path.resolve(ROOT, arg('out', 'shots/lead'));
const sets = String(arg('set', 'hero,frames,tods,cams')).split(',');
const query = arg('query', '');
fs.mkdirSync(out, { recursive: true });

let srv, base;
if (arg('dist', false)) base = pathToFileURL(path.join(ROOT, 'dist/index.html')).href;
else { const s = await serve(0); srv = s.srv; base = `http://127.0.0.1:${s.port}/src/index.dev.html`; }

const browser = await chromium.launch();
const errors = [];
async function open(w, h, extra = '') {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const q = ['freeze', query, extra].filter(Boolean).join('&');
  await page.goto(`${base}?${q}`);
  await page.waitForFunction(() => window.__pb && window.__pb.ready, null, { timeout: 15000 });
  return page;
}
const shots = [];
async function shot(page, name, opts) {
  await page.evaluate(o => window.__pb.renderAt(o.t ?? 0, o), opts);
  await page.waitForTimeout(30);
  const file = path.join(out, name + '.png');
  await page.screenshot({ path: file });
  shots.push([name, file]);
}

const page = await open(1600, 900);
if (sets.includes('hero')) await shot(page, 'hero', { t: 3.2, tod: 0.70, cam: 'wide' });
if (sets.includes('frames')) for (let i = 0; i < 12; i++) await shot(page, `frame-${String(i).padStart(2, '0')}`, { t: 2, crankDeg: i * 30, tod: 0.70, cam: 'close' });
if (sets.includes('tods')) for (const [n, tod] of [['dawn', 0.27], ['noon', 0.5], ['golden', 0.70], ['sunset', 0.765], ['night', 0.93]]) await shot(page, `tod-${n}`, { t: 4, tod, cam: 'wide' });
if (sets.includes('cams')) for (const cam of ['wide', 'close', 'cinematic']) await shot(page, `cam-${cam}`, { t: 5, tod: 0.70, cam });
if (sets.includes('events')) {
  await shot(page, 'ev-hop', { t: 6.45, tod: 0.7, cam: 'close', events: [{ type: 'hop', t0: 6.0 }] });
  await shot(page, 'ev-wave', { t: 6.8, tod: 0.7, cam: 'close', events: [{ type: 'wave', t0: 6.0 }] });
  await shot(page, 'ev-gulp', { t: 6.6, tod: 0.7, cam: 'close', events: [{ type: 'gulp', t0: 6.0 }] });
}
if (sets.includes('mobile')) {
  const m = await open(390, 844);
  await shot(m, 'mobile-portrait', { t: 3, tod: 0.7, cam: 'wide' });
  await m.close();
}
let perf = null;
if (arg('perf', false)) {
  const p = await open(1600, 900, 'perf=1');
  await p.evaluate(() => { window.__pb.renderAt(0, {}); window.__pb.play(); });
  await p.waitForTimeout(5000);
  perf = await p.evaluate(() => {
    const a = window.__pb.perf().slice(30); const dts = a.map(x => x.dt).sort((x, y) => x - y), js = a.map(x => x.js).sort((x, y) => x - y);
    const q = (arr, k) => arr[Math.floor(arr.length * k)] || 0;
    return { frames: a.length, fps: +(1 / (dts.reduce((s, x) => s + x, 0) / dts.length)).toFixed(1), p95dtMs: +(q(dts, 0.95) * 1000).toFixed(1), jsMedMs: +q(js, 0.5).toFixed(2), jsP95Ms: +q(js, 0.95).toFixed(2), nodes: document.querySelectorAll('#scene *').length };
  });
  console.log('perf', JSON.stringify(perf));
}
if (arg('sheet', false) && shots.length > 1) {
  const sp = await browser.newPage({ viewport: { width: 4 * 416 + 16, height: 400 } });
  await sp.setContent(`<body style="margin:0;background:#15171c;color:#eee;font:14px system-ui"><div style="display:grid;grid-template-columns:repeat(4,400px);gap:16px;padding:8px">${shots.map(([n, f]) => `<figure style="margin:0"><img style="width:400px;display:block" src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}"><figcaption>${n}</figcaption></figure>`).join('')}</div></body>`);
  await sp.screenshot({ path: path.join(out, 'sheet.png'), fullPage: true });
  console.log('sheet', path.join(out, 'sheet.png'));
}
await browser.close(); srv?.close();
console.log(`${shots.length} shots -> ${path.relative(ROOT, out)}`);
if (errors.length) { console.error('ERRORS:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
