// Screenshot harness. Renders deterministic frames via window.__pb.renderAt and fails on console errors.
// usage: node tools/shoot.mjs [--dist] [--out shots/lead] [--set hero,frames,tods,cams,mobile,events,zoom,strip,thumb,glitch,crops,drivetrain]
//                              [--query "solo=bike"] [--perf] [--sheet]
//   --set strip : acting filmstrips from the CLOSE camera, cropped to the rider (≈900×700), covering the full TIMING
//                 duration of each event (bell, wave, hop, gulp, coast start, cadence jump) at every 3rd 60 fps frame
//                 (?nofx=1), plus a 1:1 inset row of 12 consecutive 60 fps frames around the event's peak, cropped to
//                 the acting part (hand, head, wheels, pedal) -> strip-<event>.png
//   --set thumb : 256 px and 128 px thumbnails of the hero with ?notext=1 (no HUD / typography) and the ?silhouette=1
//                 foil (the rider in solid ink on white, world hidden) -> thumb-*.png, silhouette-*.png
//   --set glitch: the signature moment (SIGNAL LOST at the neon tunnel), 4 phases -> glitch-*.png
//   --set crops / drivetrain : 2× crops of head, hands, feet, drivetrain at 4 crank phases
//   --perf      : live run at 1600×900; waits (≤ 90 s) for the box to be quiet (other tenants < 0.9 core busy), then up
//                 to 3 trials of 5 s, stops at the first that meets tools/budgets.json; reports fps, frame p95, JS
//                 median / p95, CPU ms per frame over the whole browser process tree, DOM nodes, the adaptive quality
//                 tier reached, and the box load; writes <out>/perf.json. Exit 1 when no trial meets the hard budgets.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import os from 'node:os';
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
  const sp = await open(1600, 900, 'nofx=1&nohud');
  const TIMING = await sp.evaluate(() => window.__pb.TIMING || null);
  const DUR = { bell: TIMING?.bell?.dur ?? 0.6, wave: TIMING?.wave?.dur ?? 2.7, hop: TIMING?.hop?.dur ?? 1.3, gulp: TIMING?.gulp?.dur ?? 2.5, coast: 1.5, cadence: 1.5 };
  const PEAK = { bell: TIMING?.bell?.strike ?? 0.1, wave: 1.2, hop: TIMING?.hop?.apex ?? 0.6, gulp: 1.16, coast: 0.5, cadence: 0.5 };
  const PART = { bell: ['j-wingNearHand', 'j-bars'], wave: ['j-wingNearHand', 'j-wingNearLower'], hop: ['j-wheelFront', 'j-wheelRear'], gulp: ['j-head', 'j-pouch'], coast: ['j-pedalNear', 'j-footNear'], cadence: ['j-pedalNear', 'j-footNear'] };
  const STRIPS = [['bell', 6, { events: [{ type: 'bell', t0: 6 }] }], ['wave', 6, { events: [{ type: 'wave', t0: 6 }] }],
    ['hop', 6, { events: [{ type: 'hop', t0: 6 }] }], ['gulp', 6, { events: [{ type: 'gulp', t0: 6 }] }],
    ['coast', 6, { events: [{ type: 'coast', t0: 6 }] }], ['cadence', 6, { cadence: 90 }]];
  const boxOf = ids => sp.evaluate(ids => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const id of ids) { const e = document.getElementById(id); if (!e) continue; const r = e.getBoundingClientRect(); if (!r.width) continue; x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); } return [x0, y0, x1, y1]; }, ids);
  const clampClip = (cx, cy, w, h) => ({ x: Math.max(0, Math.min(1600 - w, Math.round(cx - w / 2))), y: Math.max(0, Math.min(900 - h, Math.round(cy - h / 2))), width: w, height: h });
  for (const [n, t0, o] of STRIPS) {
    // crop: the rider's box (all slots) at the event start, 900×700
    await sp.evaluate(a => window.__pb.renderAt(a.t, a), { ...o, t: t0, tod: 0.7, cam: 'close' });
    const rb = await boxOf(['j-body', 'j-head', 'j-crest', 'j-billUpper', 'j-wheelRear', 'j-wheelFront']);
    const clip = clampClip((rb[0] + rb[2]) / 2, (rb[1] + rb[3]) / 2, 900, 700);
    const cells = [];
    const nF = Math.ceil((DUR[n] + 0.2) * 60);
    for (let i = 0; i <= nF; i += 3) {
      await sp.evaluate(a => window.__pb.renderAt(a.t, a), { ...o, t: t0 + i / 60, tod: 0.7, cam: 'close' });
      cells.push([`+${(i / 60).toFixed(2)} s`, (await sp.screenshot({ clip })).toString('base64')]);
    }
    // 1:1 inset: 12 consecutive 60 fps frames around the peak, cropped to the acting part
    const pk = Math.round(PEAK[n] * 60), inset = [];
    await sp.evaluate(a => window.__pb.renderAt(a.t, a), { ...o, t: t0 + pk / 60, tod: 0.7, cam: 'close' });
    const pb = await boxOf(PART[n]);
    const iclip = clampClip((pb[0] + pb[2]) / 2, (pb[1] + pb[3]) / 2, 220, 220);
    for (let i = pk - 6; i < pk + 6; i++) {
      await sp.evaluate(a => window.__pb.renderAt(a.t, a), { ...o, t: t0 + i / 60, tod: 0.7, cam: 'close' });
      inset.push([`+${i}/60`, (await sp.screenshot({ clip: iclip })).toString('base64')]);
    }
    const cols = 6, cw = 300, ch = Math.round(cw * 700 / 900);
    const cp = await browser.newPage({ viewport: { width: cols * (cw + 4) + 8, height: 300 } });
    await cp.setContent(`<body style="margin:0;background:#15171c;color:#ddd;font:12px system-ui"><div style="padding:6px 6px 0;font-weight:600">${n}: close camera, every 3rd frame of ${DUR[n]} s (60 fps), crop ${clip.width}×${clip.height} at ${clip.x},${clip.y}</div>`
      + `<div style="display:grid;grid-template-columns:repeat(${cols},${cw}px);gap:4px;padding:4px">${cells.map(([l, c]) => `<figure style="margin:0"><img style="width:${cw}px;height:${ch}px;display:block" src="data:image/png;base64,${c}"><figcaption>${l}</figcaption></figure>`).join('')}</div>`
      + `<div style="padding:6px 6px 0;font-weight:600">1:1 inset, 12 consecutive frames around the peak (+${(PEAK[n]).toFixed(2)} s), ${PART[n][0].slice(2)}</div>`
      + `<div style="display:grid;grid-template-columns:repeat(8,220px);gap:4px;padding:4px">${inset.map(([l, c]) => `<figure style="margin:0"><img style="width:220px;height:220px;display:block;image-rendering:pixelated" src="data:image/png;base64,${c}"><figcaption>${l}</figcaption></figure>`).join('')}</div></body>`);
    const file = path.join(out, `strip-${n}.png`);
    await cp.screenshot({ path: file, fullPage: true }); await cp.close();
    console.log('strip', file);
  }
  await sp.close();
}
if (sets.includes('thumb')) {
  for (const [tag, q] of [['thumb', 'notext=1'], ['silhouette', 'silhouette=1&notext=1']]) {
    const tp = await open(1600, 900, q + '&nohud');
    await tp.evaluate(() => window.__pb.renderAt(3.2, { tod: 0.7, cam: 'wide' }));
    await tp.waitForTimeout(40);
    const full = (await tp.screenshot()).toString('base64');
    await tp.close();
    for (const w of [256, 128]) {
      const h = Math.round(w * 9 / 16), cp = await browser.newPage({ viewport: { width: w, height: h } });
      await cp.setContent(`<body style="margin:0"><img style="width:${w}px;height:${h}px;display:block" src="data:image/png;base64,${full}"></body>`);
      const file = path.join(out, `${tag}-${w}.png`); await cp.screenshot({ path: file }); await cp.close(); shots.push([`${tag}-${w}`, file]);
    }
    const file = path.join(out, `${tag}-full.png`); fs.writeFileSync(file, Buffer.from(full, 'base64')); shots.push([`${tag}-full`, file]);
  }
}
if (sets.includes('glitch')) {
  const gt = await page.evaluate(() => window.__pb.glitchStartT);   // neon tunnel entry at 60 rpm
  for (const [n, u] of [['tear', 0.03], ['wire', 0.2], ['tear2', 0.36], ['wire2', 0.62]]) await shot(page, `glitch-${n}`, { t: gt + u * 1.6, tod: 0.70, cam: 'wide' });
}
if (sets.includes('crops') || sets.includes('drivetrain')) {
  const z = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
  z.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await z.goto(`${base}?${['freeze', 'nohud', 'notext=1', query].filter(Boolean).join('&')}`);
  await z.waitForFunction(() => window.__pb && window.__pb.ready, null, { timeout: 15000 });
  const part = async (name, ids, w, h) => {
    const b = await z.evaluate(ids => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const id of ids) { const e = document.getElementById(id); if (!e) continue; const r = e.getBoundingClientRect(); if (!r.width) continue; x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); } return [x0, y0, x1, y1]; }, ids);
    const clip = { x: Math.max(0, Math.min(1600 - w, Math.round((b[0] + b[2]) / 2 - w / 2))), y: Math.max(0, Math.min(900 - h, Math.round((b[1] + b[3]) / 2 - h / 2))), width: w, height: h };
    const file = path.join(out, `crop-${name}.png`); await z.screenshot({ path: file, clip }); shots.push(['crop-' + name, file]);
  };
  if (sets.includes('crops')) {
    await z.evaluate(() => window.__pb.renderAt(3.2, { tod: 0.7, cam: 'close' }));
    await part('head', ['j-head', 'j-crest', 'j-billUpper', 'j-pouch'], 420, 300);
    await part('hands', ['j-wingNearHand', 'j-bars'], 300, 240);
    await part('feet', ['j-footNear', 'j-pedalNear', 'j-footFar'], 360, 260);
  }
  if (sets.includes('drivetrain')) for (const deg of [0, 90, 180, 270]) {
    await z.evaluate(d => window.__pb.renderAt(3, { tod: 0.7, cam: 'close', crankDeg: d }), deg);
    await part(`drivetrain-${deg}`, ['j-chainring', 'j-cog', 'j-chain', 'j-crankNear'], 520, 300);
  }
  await z.close();
}
let perf = null;
if (arg('perf', false)) {
  // CPU accounting: this node process's browser tree (/proc), and the box's other tenants (/proc/stat minus ours)
  const procs = () => { const st = {}; for (const pid of fs.readdirSync('/proc').filter(x => /^\d+$/.test(x))) { try { const t = fs.readFileSync(`/proc/${pid}/stat`, 'utf8'); const r = t.slice(t.lastIndexOf(')') + 2).split(' '); st[pid] = { ppid: +r[1], cpu: +r[11] + +r[12] }; } catch { /* gone */ } } return st; };
  const rootPid = () => { const st = procs(); let best = 0; for (const pid in st) { if (st[pid].ppid !== process.pid) continue; try { const c = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8'); if (!c.includes('--type=') && +pid > best) best = +pid; } catch { /* gone */ } } return best; };
  const ROOTPID = rootPid();
  const treeCpu = () => { const st = procs(); const inTree = pid => { for (let x = pid, i = 0; x && i < 20; x = st[x]?.ppid, i++) if (+x === ROOTPID) return true; return false; }; let s = 0; for (const pid in st) if (inTree(+pid)) s += st[pid].cpu; return s; };
  const boxCpu = () => { const l = fs.readFileSync('/proc/stat', 'utf8').split('\n')[0].trim().split(/\s+/).slice(1).map(Number); return { busy: l[0] + l[1] + l[2] + l[5] + l[6] + l[7], total: l.reduce((a, b) => a + b, 0) }; };
  const otherBusy = async ms => { const a = boxCpu(), ta = treeCpu(); await new Promise(r => setTimeout(r, ms)); const b = boxCpu(), tb = treeCpu(); return Math.max(0, ((b.busy - a.busy) - (tb - ta)) / Math.max(1, b.total - a.total) * os.cpus().length); };
  const B = BUDGET.perf, trials = [];
  for (let k = 0; k < 3; k++) {
    let other = await otherBusy(1000), waited = 0;
    while (other > 0.9 && waited < 90) { await new Promise(r => setTimeout(r, 2000)); waited += 3; other = await otherBusy(1000); }
    const p = await open(1600, 900, 'perf=quiet');
    await p.evaluate(() => { window.__pb.renderAt(0, {}); window.__pb.play(); });
    await p.waitForTimeout(1000);
    const f0 = await p.evaluate(() => window.__pb.perf().length), c0 = treeCpu(), o0 = boxCpu();
    await p.waitForTimeout(5000);
    const c1 = treeCpu(), o1 = boxCpu();
    const r = await p.evaluate(f0 => {
      const a = window.__pb.perf().slice(f0); const dts = a.map(x => x.dt).sort((x, y) => x - y), js = a.map(x => x.js).sort((x, y) => x - y);
      const q = (arr, k) => arr[Math.floor(arr.length * k)] || 0;
      return { frames: a.length, fps: +(1 / (dts.reduce((s, x) => s + x, 0) / dts.length)).toFixed(1), p95dtMs: +(q(dts, 0.95) * 1000).toFixed(1), jsMedMs: +q(js, 0.5).toFixed(2), jsP95Ms: +q(js, 0.95).toFixed(2), nodes: document.querySelectorAll('#scene *').length, quality: window.__pb.quality ? window.__pb.quality() : null };
    }, f0);
    r.cpuMsPerFrame = +(((c1 - c0) * 10) / Math.max(1, r.frames)).toFixed(1);   // USER_HZ = 100
    r.otherCores = +((((o1.busy - o0.busy) - (c1 - c0)) / Math.max(1, o1.total - o0.total)) * os.cpus().length).toFixed(2);
    r.otherCoresBefore = +other.toFixed(2); r.waitedS = waited; r.load = fs.readFileSync('/proc/loadavg', 'utf8').split(' ').slice(0, 3).join(' ');
    r.tierEnd = r.quality ? r.quality.quality : 'n/a';
    await p.close();
    const miss = [];
    if (r.fps < B.fpsMin) miss.push(`fps ${r.fps} < ${B.fpsMin}`);
    if (r.jsP95Ms > B.jsP95MaxMs) miss.push(`JS p95 ${r.jsP95Ms} ms > ${B.jsP95MaxMs}`);
    if (r.nodes > B.domMax) miss.push(`DOM ${r.nodes} > ${B.domMax}`);
    r.miss = miss;
    trials.push(r);
    console.log(`perf trial ${k + 1}: ${JSON.stringify({ fps: r.fps, p95dtMs: r.p95dtMs, jsMedMs: r.jsMedMs, jsP95Ms: r.jsP95Ms, cpuMsPerFrame: r.cpuMsPerFrame, nodes: r.nodes, tier: r.tierEnd, otherCores: r.otherCores, load: r.load })}${miss.length ? '  MISS: ' + miss.join('; ') : '  OK'}`);
    if (!miss.length) break;
  }
  perf = trials.find(t => !t.miss.length) || trials.reduce((a, b) => (b.fps > a.fps ? b : a));
  fs.writeFileSync(path.join(out, 'perf.json'), JSON.stringify({ when: new Date().toISOString(), target: base.startsWith('file:') ? 'dist' : 'dev', budget: B, best: perf, trials }, null, 1));
  console.log('perf', JSON.stringify({ frames: perf.frames, fps: perf.fps, p95dtMs: perf.p95dtMs, jsMedMs: perf.jsMedMs, jsP95Ms: perf.jsP95Ms, nodes: perf.nodes, cpuMsPerFrame: perf.cpuMsPerFrame, tier: perf.tierEnd }));
  if (perf.miss.length) errors.push('PERF BUDGET MISSED (best of ' + trials.length + '): ' + perf.miss.join('; '));
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
