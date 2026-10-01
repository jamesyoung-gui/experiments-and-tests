// Mech suit (egg #1) review shots: the 12-frame assembly filmstrip (t0 + 0 … 4.0 s, close camera, labelled with the
// beat), the steady state (close + wide), plus optional extras for review (24 crank angles, rewind, gold mech).
// usage: node tools/mech-film.mjs [--out shots/mech] [--extra] [--T 6]      exits 1 on any console error
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const out = path.resolve(ROOT, arg('out', 'shots/mech'));
fs.mkdirSync(out, { recursive: true });
const T = +arg('T', 6), tod = +arg('tod', 0.7);
const { srv, port } = await serve(0);
const browser = await chromium.launch();
const errors = [];
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(`http://127.0.0.1:${port}/src/index.dev.html?freeze&nohud`);
await page.waitForFunction(() => window.__pb && window.__pb.ready && window.__pb.eggs, null, { timeout: 15000 });
const render = (t, o) => page.evaluate(([t, o]) => { window.__pb.renderAt(t, o); return 0; }, [t, o]);
const arm = async (t0, o, extra = '') => { await render(t0, o); await page.evaluate(x => { const e = window.__pb.eggs; e.stopAll(); e.trigger('mech'); if (x === 'gold') e.setGold(true); }, extra); };
const shot = async (file, clip) => { await page.waitForTimeout(40); await page.screenshot({ path: file, clip }); return file; };
const CLIP = { x: 420, y: 40, width: 780, height: 840 };   // the rider in the close camera
const beat = a => (a < 0.4 ? 'ARMING · lock-on + scan' : a < 0.6 ? 'GROWTH · boots' : a < 0.82 ? 'GROWTH · greaves' : a < 1.02 ? 'GROWTH · cuisses'
  : a < 1.24 ? 'GROWTH · reactor + ribs' : a < 1.44 ? 'GROWTH · back + pauldron' : a < 1.66 ? 'GROWTH · wing blades' : a < 1.92 ? 'GROWTH · neck collars'
  : a < 2.36 ? 'GROWTH · helmet + bill' : a < 2.6 ? 'VISOR SLAM' : a < 3.2 ? 'POWER-UP · seams + thrusters' : 'HERO · push-in + MECH ONLINE');
const o = { tod, cam: 'close' };

// ---- 1. filmstrip
const times = Array.from({ length: 12 }, (_, i) => +(i * 4 / 11).toFixed(3));
await arm(T, o);
const cells = [];
for (const [i, a] of times.entries()) {
  await render(T + a, o);
  const file = await shot(path.join(out, `film-${String(i).padStart(2, '0')}.png`), CLIP);
  cells.push([a, file]);
}
// ---- 2. steady state (close + wide), 5 s after the hero beat
await render(T + 9, o); await shot(path.join(out, 'steady-close.png'));
await render(T + 9, { tod, cam: 'wide' }); await shot(path.join(out, 'steady-wide.png'));
// ---- 3. extras: 24 crank angles of the steady suit (does it follow the rig?), the rewind, the gold mech, events
if (arg('extra', false)) {
  const rig = [];
  for (let i = 0; i < 24; i++) { await render(T + 7 + i / 24, o); rig.push([`crank ${i * 15}°`, await shot(path.join(out, `rig-${String(i).padStart(2, '0')}.png`), CLIP)]); }
  for (const [ev, dt] of [['hop', 0.45], ['wave', 0.9], ['gulp', 0.7], ['bell', 0.1]]) {
    await render(T + 8 + dt, { ...o, events: [{ type: ev, t0: T + 8 }] }); rig.push([ev, await shot(path.join(out, `ev-${ev}.png`), CLIP)]);
  }
  fs.writeFileSync(path.join(out, 'rig.json'), JSON.stringify(rig));
  // rewind: Konami again at T + 9 → frames through the disassembly
  await render(T + 9, o);
  await page.evaluate(() => window.__pb.eggs.setMech(false));
  const rew = [];
  for (const dt of [0.1, 0.4, 0.7, 1.0, 1.3, 1.6]) { await render(T + 9 + dt, o); rew.push([`rewind +${dt}s`, await shot(path.join(out, `rew-${dt}.png`), CLIP)]); }
  fs.writeFileSync(path.join(out, 'rew.json'), JSON.stringify(rew));
  await arm(T, o, 'gold'); await render(T + 9, o); await shot(path.join(out, 'gold-close.png'));
  await page.evaluate(() => window.__pb.eggs.stopAll());
}
// ---- compose the labelled filmstrip
const sp = await browser.newPage({ viewport: { width: 4 * 606 + 10, height: 400 } });
const fig = ([a, fl]) => `<figure><img src="data:image/png;base64,${fs.readFileSync(fl).toString('base64')}"><figcaption><b>t0 + ${a.toFixed(2)} s</b><span>${beat(a)}</span></figcaption></figure>`;
await sp.setContent(`<style>body{margin:0;padding:6px;background:#07060F;display:grid;grid-template-columns:repeat(4,600px);gap:6px;font:13px/1.25 'DejaVu Sans Mono',monospace;color:#D8FBFF}
figure{margin:0;border:1px solid #19E6FF55}img{width:600px;display:block}figcaption{padding:4px 7px 6px;background:#141029;display:flex;justify-content:space-between;gap:8px}b{color:#C6FF3D}span{color:#FFD3E7;text-align:right}
h1{grid-column:1/-1;margin:2px 4px 4px;font-size:15px;color:#19E6FF;letter-spacing:1px}</style><h1>EGG #1 · 机甲 MECH SUIT · assembly filmstrip (close camera, 60 rpm, golden-hour mood) — the pelican keeps riding</h1>${cells.map(fig).join('')}`);
await sp.screenshot({ path: path.join(out, 'filmstrip.png'), fullPage: true });
if (arg('extra', false)) for (const name of ['rig', 'rew']) {
  const list = JSON.parse(fs.readFileSync(path.join(out, name + '.json'), 'utf8'));
  await sp.setContent(`<style>body{margin:0;padding:6px;background:#07060F;display:grid;grid-template-columns:repeat(7,280px);gap:4px;font:12px monospace;color:#D8FBFF}img{width:280px;display:block}figure{margin:0}</style>${list.map(([n, fl]) => `<figure><img src="data:image/png;base64,${fs.readFileSync(fl).toString('base64')}"><figcaption>${n}</figcaption></figure>`).join('')}`);
  await sp.screenshot({ path: path.join(out, name + '-sheet.png'), fullPage: true });
}
await browser.close(); srv.close();
errors.forEach(e => console.error(e));
console.log(`mech-film: ${cells.length} frames -> ${path.relative(ROOT, out)}/filmstrip.png, steady-close.png, steady-wide.png; ${errors.length} console errors`);
process.exit(errors.length ? 1 : 0);
