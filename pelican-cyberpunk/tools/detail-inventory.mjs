// G-DETAIL: count distinct, visible detail items (data-detail="<layer>:<O|T>:<name>") vs the draft-C baseline.
// usage: node tools/detail-inventory.mjs [--dev] [--json docs/eval/detail-inventory.json] [--verbose]
// Rules (rubric.json definitions.detailItem): repeated instances count once; an item counts if it covers ≥2 px²
// at 1600×900 in the wide or close view and is visibly un-occluded (sampled hit-test, ≥1 own hit and ≥50% of hits on
// its own geometry among samples that land on it or on something drawn above it).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from './serve.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const has = k => process.argv.includes('--' + k);
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/rubric/detail-baseline-X.json'), 'utf8')).counts;
const LAYERS = ['pelican', 'bike', 'sea', 'land', 'sky', 'fx', 'typography_frame'];
const TARGET = { total: 392, pelican: 80, bike: 90, fxMin: 20, otherRatio: 1.0 };   // cyberpunk: ≥ edition C's final counts

let srv, url;
if (has('dev')) { const s = await serve(0); srv = s.srv; url = `http://127.0.0.1:${s.port}/src/index.dev.html`; }
else url = pathToFileURL(path.join(ROOT, 'dist/index.html')).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(url + '?freeze&nohud');
await page.waitForFunction(() => window.__pb && window.__pb.ready, null, { timeout: 20000 });
// #scene is a stack of full-size <svg> sheets (src/core/sheets.js): their own boxes must not catch the hit tests
await page.addStyleTag({ content: '#scene, #scene * { pointer-events: all !important } #scene > svg { pointer-events: none !important } #ui { display: none !important }' });

const views = [['wide', { t: 3.2, tod: 0.7, cam: 'wide' }], ['close', { t: 3.2, tod: 0.7, cam: 'close' }]];
const found = new Map(); // key -> {views:[], area}
for (const [name, o] of views) {
  await page.evaluate(o => window.__pb.renderAt(o.t, o), o);
  await page.waitForTimeout(50);
  const res = await page.evaluate(() => {
    const out = [];
    const els = [...document.querySelectorAll('#scene [data-detail]')];
    const wk = new Map();
    const weak = e => {
      if (wk.has(e)) return wk.get(e);
      let a = 1; for (let q = e; q && q.tagName !== 'svg'; q = q.parentElement) a *= +getComputedStyle(q).opacity;
      const cs = getComputedStyle(e), fo = cs.fill === 'none' ? 0 : +cs.fillOpacity, so = cs.stroke === 'none' ? 0 : +cs.strokeOpacity * Math.min(1, (parseFloat(cs.strokeWidth) || 0) / 2);
      const w = a * Math.max(fo, so) < 0.35; wk.set(e, w); return w;
    };
    for (const el of els) {
      const key = el.getAttribute('data-detail');
      const r = el.getBoundingClientRect();
      const x0 = Math.max(0, r.left), y0 = Math.max(0, r.top), x1 = Math.min(innerWidth, r.right), y1 = Math.min(innerHeight, r.bottom);
      if (x1 <= x0 || y1 <= y0) continue;
      let own = 0, other = 0, overlay = 0;
      const n = 9;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const px = x0 + (x1 - x0) * (i + 0.5) / n, py = y0 + (y1 - y0) * (j + 0.5) / n;
        // top-down stack at this point: see-through overlays (rain streaks, haze, glows, light washes: effective alpha
        // < 0.35) do not occlude; an untagged overlay of the same part (a rim light, an LED stroke, a glint drawn over
        // the base geometry, in the same rider slot or the same data-ref group) is still this item's own look
        const top = document.elementFromPoint(px, py);
        if (!top) continue;
        if (el === top || el.contains(top)) { own++; continue; }   // fast path: the item itself is on top
        for (const hit of document.elementsFromPoint(px, py)) {
          if (hit.tagName === 'svg' || hit.tagName === 'HTML' || hit.tagName === 'BODY' || hit.id === 'scene' || hit.id === 'stage') continue;
          if (el === hit || el.contains(hit)) { own++; break; }
          const ht = hit.closest('[data-detail]'), slot = el.closest('[data-slot]'), grp = el.closest('[data-ref]');
          const sameGroup = (slot && slot === hit.closest('[data-slot]')) || (grp && grp === hit.closest('[data-ref]'));
          if (sameGroup && (!ht || ht.contains(el))) { own++; overlay++; break; }
          if (weak(hit)) continue;
          if (hit.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING) other++; // el precedes hit => hit is drawn above el
          break;
        }
      }
      // pixel-area estimate: bbox area × own-hit fraction of all samples
      const area = (x1 - x0) * (y1 - y0) * (own / (n * n));
      const style = getComputedStyle(el);
      out.push({ key, own, other, overlay, area, hidden: style.visibility === 'hidden' || style.display === 'none' });
    }
    return out;
  });
  for (const r of res) {
    const ok = !r.hidden && r.own >= 1 && r.area >= 2 && r.own / Math.max(1, r.own + r.other) >= 0.5;
    const cur = found.get(r.key) || { views: [], ok: false };
    if (ok) { cur.ok = true; cur.views.push(name); }
    else if (!cur.ok) cur.why = r.hidden ? 'hidden' : r.own < 1 ? 'no own hit' : r.area < 2 ? '<2px²' : 'occluded';
    found.set(r.key, cur);
  }
}
await browser.close(); srv?.close();

const counts = Object.fromEntries(LAYERS.map(l => [l, { O: 0, T: 0, total: 0, rejected: [] }]));
const bad = [];
for (const [key, v] of found) {
  const [layer, kind] = key.split(':');
  if (!counts[layer] || !['O', 'T'].includes(kind) || key.split(':').length < 3) { bad.push(key); continue; }
  if (v.ok) { counts[layer][kind]++; counts[layer].total++; } else counts[layer].rejected.push(key);
}
const total = LAYERS.reduce((s, l) => s + counts[l].total, 0);
const fails = [];
if (total < TARGET.total) fails.push(`total ${total} < ${TARGET.total}`);
if (counts.pelican.total < TARGET.pelican) fails.push(`pelican ${counts.pelican.total} < ${TARGET.pelican}`);
if (counts.bike.total < TARGET.bike) fails.push(`bike ${counts.bike.total} < ${TARGET.bike}`);
if (counts.fx.total < TARGET.fxMin) fails.push(`fx ${counts.fx.total} < ${TARGET.fxMin}`);
for (const l of ['sea', 'land', 'sky', 'typography_frame']) { const need = Math.ceil(baseline[l].total * TARGET.otherRatio); if (counts[l].total < need) fails.push(`${l} ${counts[l].total} < ${need}`); }
console.log('layer              draft  now   ×');
for (const l of LAYERS) console.log(`${l.padEnd(18)} ${String(baseline[l].total).padStart(5)} ${String(counts[l].total).padStart(4)}  ${(counts[l].total / baseline[l].total).toFixed(2)}${counts[l].rejected.length ? `   (${counts[l].rejected.length} rejected: hidden/occluded/<2px²)` : ''}`);
console.log(`${'ALL'.padEnd(18)} ${String(baseline.all).padStart(5)} ${String(total).padStart(4)}  ${(total / baseline.all).toFixed(2)}  (gate ≥ 1.00 × edition C)`);
if (bad.length) console.log('malformed data-detail keys (need <layer>:<O|T>:<name>):', bad.slice(0, 20).join(', '));
if (has('verbose')) for (const l of LAYERS) console.log(l, 'rejected:', counts[l].rejected.map(k => `${k} (${found.get(k).why || '?'})`).join(', '));
{ const why = {}; for (const [, v] of found) if (!v.ok) why[v.why || '?'] = (why[v.why || '?'] || 0) + 1; console.log('rejections by reason (an item may be counted in either view):', JSON.stringify(why)); }
const out = arg('json') || 'shots/verify/detail-inventory.json';
if (out) { fs.mkdirSync(path.dirname(path.resolve(ROOT, out)), { recursive: true }); fs.writeFileSync(path.resolve(ROOT, out), JSON.stringify({ baseline, counts, total, ratio: total / baseline.all, fails, items: Object.fromEntries(found) }, null, 1)); }
if (errors.length) console.error('page errors:', errors.join('\n'));
console.log(fails.length ? 'G-DETAIL: FAIL — ' + fails.join('; ') : 'G-DETAIL: PASS');
process.exit(fails.length ? 1 : 0);
