// Easter-egg check: triggers every egg deterministically (window.__pb.eggs.trigger) and shoots it into shots/eggs/,
// then exercises the live detectors (Konami keys, typed words, clicks on the sun / moon / bottle, bell spam, gulp at night).
// usage: node tools/check-eggs.mjs [--out shots/eggs] [--sheet]      exits 1 on any console error or failed check
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const out = path.resolve(ROOT, arg('out', 'shots/eggs'));
fs.mkdirSync(out, { recursive: true });
const { srv, port } = await serve(0);
const base = `http://127.0.0.1:${port}/src/index.dev.html`;
const browser = await chromium.launch();
const errors = [], fails = [], shots = [];

async function open(extra = '') {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(`${base}?freeze${extra}`);
  await page.waitForFunction(() => window.__pb && window.__pb.ready && window.__pb.eggs, null, { timeout: 15000 });
  return page;
}
const render = (page, t, o) => page.evaluate(([t, o]) => window.__pb.renderAt(t, o) && 0, [t, o]);
async function snap(page, name, clip) {
  await page.waitForTimeout(40);
  const file = path.join(out, `egg-${name}.png`);
  await page.screenshot({ path: file }); shots.push([name, file]);
  if (clip) { const cf = path.join(out, `egg-${name}-crop.png`); await page.screenshot({ path: cf, clip }); }
}

// ---------------------------------------------------------------- 1. deterministic triggers
const HOP_LAND = 0.62;   // refined from the page below
const plan = {
  brown:    { T: 3.2, tod: 0.7, at: [1.2], cam: 'wide' },
  velo:     { T: 5, tod: 0.7, at: [1.0, 2.45], cam: 'close' },
  cat:      { T: 8.55, tod: 0.7, at: [0.3, 0.7, 1.15], cam: 'wide' },
  km:       { T: 5, tod: 0.7, at: [0.8] },
  fortytwo: { T: 5, tod: 0.5, at: [0.9] },
  sunwink:  { T: 4, tod: 0.7, at: [0.8] },
  moonwink: { T: 4, tod: 0.93, at: [0.8], clip: { x: 380, y: 20, width: 260, height: 200 } },
  ufo:      { T: 6, tod: 0.93, at: [3.0, 4.0], events: t0 => [{ type: 'gulp', t0 }] },
  chorus:   { T: 5, tod: 0.7, at: [1.35], clip: { x: 300, y: 150, width: 1000, height: 260 } },
  splash:   { T: 15.55, tod: 0.7, at: [0.22], events: t0 => [{ type: 'hop', t0: t0 - HOP_LAND }] },
  bottle:   { T: 4, tod: 0.7, at: [1.0] },
  wish:     { T: 4, tod: 0.93, at: [0.4], clip: { x: 1030, y: 60, width: 300, height: 200 } },
  flight:   { T: 5, tod: 0.7, at: [4.5] },
  hack:     { T: 3.2, tod: 0.7, at: [0.15, 1.6], clip: { x: 380, y: 40, width: 840, height: 220 } },
  welcome:  { T: 18.35, tod: 0.81, at: [0.2, 0.62], cam: 'wide' },
  gold:     { T: 3.2, tod: 0.7, at: [1.2], cam: 'close' },
};
const page = await open();
const list = await page.evaluate(() => window.__pb.eggs.list.map(e => e.id));
const land = await page.evaluate(async () => (await import('/src/rig/solve.js')).TIMING.hop.land);
plan.splash.events = t0 => [{ type: 'hop', t0: t0 - land }];
for (const id of list) {
  const p = plan[id];
  if (!p) { fails.push(`no test plan for egg "${id}"`); continue; }
  const o = { tod: p.tod, cam: p.cam || 'wide' };
  await render(page, p.T, { ...o, events: p.events ? p.events(p.T) : [] });
  await page.evaluate(id => { window.__pb.eggs.stopAll(); window.__pb.eggs.trigger(id); }, id);
  for (const [i, dt] of p.at.entries()) {
    await render(page, p.T + dt, { ...o, events: p.events ? p.events(p.T) : [] });
    await snap(page, p.at.length > 1 ? `${id}-${i}` : id, p.clip);
  }
}
const found = await page.evaluate(() => window.__pb.eggs.found());
if (found.length !== list.length) fails.push(`found ${found.length}/${list.length} after triggering all`);
const counter = await page.evaluate(() => { const b = document.querySelector('.ui-eggs'); return b && !b.hidden ? b.textContent : null; });
if (!counter || !counter.includes(`${list.length}/${list.length}`)) fails.push('egg counter not showing ' + counter);
await page.close();

// ---------------------------------------------------------------- 2. live detectors
const live = await open('&tod=0.7');
const hidden0 = await live.evaluate(() => document.querySelector('.ui-eggs').hidden);
if (!hidden0) fails.push('egg counter visible before any egg was found');
await render(live, 4, { tod: 0.7, cam: 'wide' });
for (const k of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']) await live.keyboard.press(k);
await live.keyboard.type('gimini');
await live.keyboard.type('bird');
const cam0 = await live.evaluate(() => window.__pb.state.cam);
await live.keyboard.type('hack');
await live.keyboard.type('888');
const sun = await live.evaluate(() => { const f = window.__pb.renderAt(4, { tod: 0.7, cam: 'wide' }); return f.sun; });
await live.mouse.click(sun.x, sun.y);
const bottle = await live.evaluate(() => { const el = document.querySelector('[data-ref="egg-bottle"]'); const r = el.getBoundingClientRect(); return r.width ? { x: r.x + r.width / 2, y: r.y + r.height / 2 - 4 } : null; });
if (bottle) await live.mouse.click(bottle.x, bottle.y); else fails.push('bottle not on screen at t=4');
const moon = await live.evaluate(() => window.__pb.renderAt(4, { tod: 0.93, cam: 'wide' }).moon);
await live.mouse.click(moon.x, moon.y);
// a neon meteor at night: find one, click its head while it glows
const met = await live.evaluate(() => { for (let t = 4; t < 120; t += 0.05) { const m = window.__pb.eggs.shootAt(t); if (m && m.u > 0.3 && m.u < 0.6) { window.__pb.renderAt(t, { tod: 0.93, cam: 'wide' }); return { x: m.x, y: m.y }; } } return null; });
if (met) await live.mouse.click(met.x, met.y); else fails.push('no shooting star in 120 s');
await live.evaluate(() => { for (let i = 0; i < 7; i++) window.__pb.bus.emit('rig:event', { type: 'bell', t0: 4 + i * 0.3 }); });
await live.evaluate(() => window.__pb.bus.emit('rig:event', { type: 'gulp', t0: 4 }));
// the NO PELICANS sign: ride to the first time it is centred on screen, then ring
const tSign = await live.evaluate(() => { for (let t = 4; t < 90; t += 0.05) { const f = window.__pb.renderAt(t, { tod: 0.7, cam: 'wide' }); const s = window.__pb.eggs.signAt(f.distance)[1]; if (s > 500 && s < 1100) return t; } return -1; });
if (tSign < 0) fails.push('NO PELICANS sign never on screen in 90 s'); else {
  await render(live, tSign, { tod: 0.7, cam: 'wide' });
  await live.evaluate(t => window.__pb.bus.emit('rig:event', { type: 'bell', t0: t }), tSign);
}
await render(live, 4.5, { tod: 0.93, cam: 'wide' });
const liveFound = await live.evaluate(() => window.__pb.eggs.found());
for (const id of ['brown', 'velo', 'flight', 'sunwink', 'bottle', 'moonwink', 'chorus', 'ufo', 'hack', 'gold', 'welcome', 'wish']) if (!liveFound.includes(id)) fails.push(`live detector did not find "${id}"`);
const st = await live.evaluate(() => ({ auto: window.__pb.state.todAuto, sound: window.__pb.state.toggles.sound, cam: window.__pb.state.cam }));
if (st.auto || st.sound || st.cam !== cam0) fails.push('Konami / GIMINI / HACK left a side effect: ' + JSON.stringify(st) + ' (camera was ' + cam0 + ')');
// HACK must hand the city back: no wireframe class and no jittered sheet once it has run out
const after = await live.evaluate(() => { window.__pb.renderAt(40, { tod: 0.7, cam: 'wide' }); const sc = document.querySelector('#scene'); return { cls: sc.className, tr: [...sc.querySelectorAll('svg.pb-sheet')].filter(s => s.style.translate).length }; });
if (/egg-hack|egg-wire/.test(after.cls) || after.tr) fails.push('HACK left the city in wireframe: ' + JSON.stringify(after));
await snap(live, 'live-counter');
await live.close();

// ---------------------------------------------------------------- 3. idle: the director never finds an egg for you
// 60 s of live play at night with no input (fast-forwarded through the real live path): the director's and the beat
// keeper's auto beats (bell, hop, gulp ... with auto: true) must not unlock anything, and an injected auto gulp at night
// must not call the UFO. Only viewer input (ui:*) discovers eggs.
{
  const idle = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  idle.on('pageerror', e => errors.push('pageerror: ' + e.message));
  idle.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await idle.goto(`${base}?tod=0.93`);
  await idle.waitForFunction(() => window.__pb && window.__pb.ready && window.__pb.eggs, null, { timeout: 15000 });
  const r = await idle.evaluate(() => {
    const pb = window.__pb, got = [];
    pb.bus.on('egg:found', e => { if (e && e.id) got.push(e.id); });
    pb.state.playing = false;
    const log = pb.sim(30);
    pb.bus.emit('rig:event', { type: 'gulp', t0: pb.state.t, auto: true });
    for (let i = 0; i < 8; i++) pb.bus.emit('rig:event', { type: 'bell', t0: pb.state.t + i * 0.2, auto: true });
    log.push(...pb.sim(30));
    return { got, beats: pb.keeper().log.length, auto: pb.keeper().log.filter(b => b.src !== 'user').length, t: pb.state.t, night: pb.state.tod };
  });
  if (r.got.length) fails.push(`idle: ${r.got.length} egg(s) found with no input in 60 s: ${r.got.join(', ')}`);
  if (r.auto < 3) fails.push(`idle: only ${r.auto} auto beats in 60 s, the idle test proves nothing`);
  console.log(`idle 60 s: ${r.auto} auto beats, ${r.got.length} eggs found`);
  await idle.close();
}

if (arg('sheet', false)) {
  const sp = await browser.newPage({ viewport: { width: 4 * 416 + 16, height: 400 } });
  const cells = shots.map(([n, f]) => `<figure><img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}"><figcaption>${n}</figcaption></figure>`).join('');
  await sp.setContent(`<style>body{margin:8px;background:#222;display:grid;grid-template-columns:repeat(4,400px);gap:8px;font:12px sans-serif;color:#eee}img{width:400px}figure{margin:0}</style>${cells}`);
  await sp.screenshot({ path: path.join(out, 'eggs-sheet.png'), fullPage: true });
}
await browser.close(); srv.close();
errors.forEach(e => console.error(e)); fails.forEach(e => console.error('FAIL ' + e));
console.log(`eggs: ${list.length} eggs, ${shots.length} shots -> ${path.relative(ROOT, out)}, ${errors.length} console errors, ${fails.length} failures`);
process.exit(errors.length || fails.length ? 1 : 0);
