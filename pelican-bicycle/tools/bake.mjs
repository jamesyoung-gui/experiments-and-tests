// Bake the zero-JS animated SVG: drives window.__pb.bakeSVG in headless Chromium and writes dist/pelican-bicycle.svg
// (+ dist/pelican-bicycle.bake.json with the bake report: animations, keyframes, error bounds, sub-periods, size split).
// usage: node tools/bake.mjs [--dist] [--out dist/pelican-bicycle.svg] [--period 24] [--tod 0.70] [--cam wide]
//                            [--story "wave@8,bell@16"] [--fps 60]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from './serve.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// TEMPORARY shim (contract request to the lead): main.js must forward `loopT` from renderAt() to solvePose() so the
// rig's story schedules (gaze, blinks, gusts) repeat exactly every baked loop. Until it does, the page's main.js is
// patched in flight for this tool only (a no-op once main.js mentions loopT). Disable with --no-loopT-shim.
async function loopTShim(page) {
  if (process.argv.includes('--no-loopT-shim')) return false;
  const src = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');
  if (/loopT/.test(src)) return false;
  const patched = src
    .replace(/coasting: state\.coasting, events: state\.events \}\)/, 'coasting: state.coasting, events: state.events, loopT: state.loopT })')
    .replace(/state\.events = o\.events \|\| \[\];/, 'state.events = o.events || []; state.loopT = o.loopT;');
  if (patched === src) return false;
  await page.route(/\/src\/main\.js(\?.*)?$/, route => route.fulfill({ status: 200, contentType: 'text/javascript', body: patched }));
  console.log('note: main.js does not forward loopT yet — using the in-flight shim (see contractRequests)');
  return true;
}
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const out = path.resolve(ROOT, arg('out', 'dist/pelican-bicycle.svg'));
const opts = {};
for (const k of ['period', 'start', 'fps', 'tod', 'cadence']) if (arg(k) !== undefined) opts[k] = +arg(k);
if (arg('cam')) opts.cam = arg('cam');
if (arg('story')) opts.story = String(arg('story')).split(',').map(s => { const [type, t0] = s.split('@'); return { type, t0: +t0 }; });

let srv, url;
if (arg('dist', false)) url = pathToFileURL(path.join(ROOT, 'dist/index.html')).href + '?freeze&nohud';
else { const s = await serve(0); srv = s.srv; url = `http://127.0.0.1:${s.port}/src/index.dev.html?freeze&nohud`; }

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
if (!arg('dist', false)) await loopTShim(page);
await page.goto(url);
await page.waitForFunction(() => window.__pb && window.__pb.ready, null, { timeout: 20000 });
const t0 = Date.now();
const svg = await page.evaluate(o => window.__pb.bakeSVG(o), opts);
const stats = await page.evaluate(() => window.__pbBakeStats || null);
await browser.close(); srv?.close();

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, svg);
const gz = zlib.gzipSync(Buffer.from(svg), { level: 9 }).length;
const sha = crypto.createHash('sha256').update(svg).digest('hex');
const report = { file: path.relative(ROOT, out), bytes: Buffer.byteLength(svg), gzip: gz, sha256: sha, bakeMs: Date.now() - t0, opts, stats };
fs.writeFileSync(out.replace(/\.svg$/, '.bake.json'), JSON.stringify(report, null, 1));
const kb = b => (b / 1024).toFixed(1) + ' KB';
console.log(`${report.file}  ${kb(report.bytes)} raw · ${kb(gz)} gzip · sha256 ${sha.slice(0, 12)} · ${(report.bakeMs / 1000).toFixed(1)} s`);
if (stats) {
  console.log(`loop ${stats.period}s @ ${stats.fps} fps · ${stats.samples} renders · ${stats.animated}/${stats.tracks} animated attrs · ${stats.anims} animations · ${stats.keyframes} keyframes`);
  console.log('max decimation error (× tol):', JSON.stringify(Object.fromEntries(Object.entries(stats.errMax).map(([k, v]) => [k, +v.toFixed(3)]))));
  console.log('sub-periods (s: count):', JSON.stringify(stats.subPeriods));
  const top = Object.entries(stats.bytesByGroup).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k} ${kb(v)}`).join(' · ');
  console.log('animation bytes by group:', top);
  if (stats.nonClosing.length) console.log(`non-closing (drift spread over the loop): ${stats.nonClosing.length}\n  ` + stats.nonClosing.slice(0, 30).join('\n  '));
  if (stats.warnings.length) console.log('warnings:\n  ' + [...new Set(stats.warnings)].join('\n  '));
}
if (errors.length) { console.error('ERRORS:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
if (report.bytes > 1.5 * 1024 * 1024) { console.error(`FAIL: ${kb(report.bytes)} > 1.5 MB budget`); process.exit(1); }
