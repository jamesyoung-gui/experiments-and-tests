// Screenshot harness. Renders deterministic frames via window.__pb.renderAt and fails on console errors.
// usage: node tools/shoot.mjs [--dist] [--out shots/lead] [--set hero,frames,tods,cams,mobile,events,zoom,strip] [--query "solo=bike"] [--perf] [--sheet]
//   --set strip : real-time filmstrips, 30 consecutive 60 fps frames (renderAt(t0 + i/60), ?nofx=1) per event
//                 (bell, wave, hop, gulp, coast start, cadence jump) -> strip-<event>.png contact sheets
//   --perf      : 5 s live run; exits non-zero when tools/budgets.json perf budgets are missed
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

// Raster threads = core count (as desktop Chrome does); headless defaults to fewer and the scene is raster-bound.
const browser = await chromium.launch({ args: [`--num-raster-threads=${Math.min(4, (await import('node:os')).cpus().length)}`] });
const BUDGET = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/budgets.json'), 'utf8'));
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
// true motion strip: sim time advances with the crank (60 rpm => one crank turn per second), so wheels,
// secondary motion and world parallax all move between frames
if (sets.includes('frames')) for (let i = 0; i < 24; i++) await shot(page, `frame-${String(i).padStart(2, '0')}`, { t: 2 + i / 24, tod: 0.70, cam: 'close' });
if (sets.includes('tods')) for (const [n, tod] of [['dawn', 0.27], ['noon', 0.5], ['golden', 0.70], ['sunset', 0.765], ['night', 0.93]]) await shot(page, `tod-${n}`, { t: 4, tod, cam: 'wide' });
if (sets.includes('cams')) for (const cam of ['wide', 'close', 'cinematic']) await shot(page, `cam-${cam}`, { t: 5, tod: 0.70, cam });
if (sets.includes('events')) {
  await shot(page, 'ev-hop', { t: 6.45, tod: 0.7, cam: 'close', events: [{ type: 'hop', t0: 6.0 }] });
  await shot(page, 'ev-wave', { t: 6.8, tod: 0.7, cam: 'close', events: [{ type: 'wave', t0: 6.0 }] });
  await shot(page, 'ev-gulp', { t: 6.6, tod: 0.7, cam: 'close', events: [{ type: 'gulp', t0: 6.0 }] });
}
// 3× zoom crops (G-DETAIL): wide camera, re-rasterised at deviceScaleFactor 3, 533×300 regions around the rider
if (sets.includes('zoom')) {
  const z = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 3 });
  z.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await z.goto(`${base}?${['freeze', 'nohud', query].filter(Boolean).join('&')}`);
  await z.waitForFunction(() => window.__pb && window.__pb.ready, null, { timeout: 15000 });
  await z.evaluate(() => window.__pb.renderAt(3.2, { tod: 0.7, cam: 'wide' }));
  const R = [['head', 860, 290], ['body', 690, 410], ['legs', 700, 630], ['wheel-rear', 560, 690], ['wheel-front', 850, 690], ['basket', 880, 500]];  // region centres (world = screen at 1600×900)
  for (const [n, cx, cy] of R) { const file = path.join(out, `zoom-${n}.png`); await z.screenshot({ path: file, clip: { x: cx - 266, y: cy - 150, width: 533, height: 300 } }); shots.push(['zoom-' + n, file]); }
  await z.close();
}
if (sets.includes('mobile')) {
  const m = await open(390, 844);
  await shot(m, 'mobile-portrait', { t: 3, tod: 0.7, cam: 'wide' });
  await m.close();
}
if (sets.includes('strip')) {
  const sp = await open(800, 450, 'nofx=1&nohud');
  const STRIPS = [['bell', 6, { events: [{ type: 'bell', t0: 6 }] }], ['wave', 6.1, { events: [{ type: 'wave', t0: 6 }] }],
    ['hop', 6.1, { events: [{ type: 'hop', t0: 6 }] }], ['gulp', 6.1, { events: [{ type: 'gulp', t0: 6 }] }],
    ['coast', 6, { events: [{ type: 'coast', t0: 6 }] }], ['cadence', 6, { cadence: 90 }]];
  for (const [n, t0, o] of STRIPS) {
    const cells = [];
    for (let i = 0; i < 30; i++) {
      await sp.evaluate(a => window.__pb.renderAt(a.t, a), { ...o, t: t0 + i / 60, tod: 0.7, cam: 'close' });
      cells.push((await sp.screenshot()).toString('base64'));
    }
    const cp = await browser.newPage({ viewport: { width: 6 * 324 + 8, height: 200 } });
    await cp.setContent(`<body style="margin:0;background:#15171c;color:#ddd;font:11px system-ui"><div style="display:grid;grid-template-columns:repeat(6,320px);gap:4px;padding:4px">${cells.map((c, i) => `<figure style="margin:0"><img style="width:320px;display:block" src="data:image/png;base64,${c}"><figcaption>${n} +${i}/60 s</figcaption></figure>`).join('')}</div></body>`);
    const file = path.join(out, `strip-${n}.png`);
    await cp.screenshot({ path: file, fullPage: true }); await cp.close();
    console.log('strip', file);
  }
  await sp.close();
}
let perf = null;
if (arg('perf', false)) {
  const p = await open(1600, 900, 'perf=quiet');
  await p.evaluate(() => { window.__pb.renderAt(0, {}); window.__pb.play(); });
  await p.waitForTimeout(5000);
  perf = await p.evaluate(() => {
    const a = window.__pb.perf().slice(30); const dts = a.map(x => x.dt).sort((x, y) => x - y), js = a.map(x => x.js).sort((x, y) => x - y);
    const q = (arr, k) => arr[Math.floor(arr.length * k)] || 0;
    return { frames: a.length, fps: +(1 / (dts.reduce((s, x) => s + x, 0) / dts.length)).toFixed(1), p95dtMs: +(q(dts, 0.95) * 1000).toFixed(1), jsMedMs: +q(js, 0.5).toFixed(2), jsP95Ms: +q(js, 0.95).toFixed(2), nodes: document.querySelectorAll('#scene *').length };
  });
  console.log('perf', JSON.stringify(perf));
  const B = BUDGET.perf, miss = [];
  if (perf.fps < B.fpsMin) miss.push(`fps ${perf.fps} < ${B.fpsMin}`);
  if (perf.jsP95Ms > B.jsP95MaxMs) miss.push(`JS p95 ${perf.jsP95Ms} ms > ${B.jsP95MaxMs}`);
  if (perf.nodes > B.domMax) miss.push(`DOM ${perf.nodes} > ${B.domMax}`);
  if (miss.length) errors.push('PERF BUDGET MISSED: ' + miss.join('; '));
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
