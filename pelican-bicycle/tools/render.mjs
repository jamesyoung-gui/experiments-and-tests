// Render an .svg or .html file to PNG with headless Chromium.
// usage: node tools/render.mjs <input> <out.png> [width=1600] [height=900] [waitMs=300]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const [input, out, w = '1600', h = '900', wait = '300'] = process.argv.slice(2);
if (!input || !out) { console.error('usage: render.mjs <input> <out.png> [w] [h] [waitMs]'); process.exit(2); }
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const url = pathToFileURL(path.resolve(input)).href;
if (input.endsWith('.svg')) {
  // as <img> via data URL (SMIL still runs; scripts don't) -- matches how the baked SVG will be used
  const b64 = fs.readFileSync(input).toString('base64');
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#fff"><img src="data:image/svg+xml;base64,${b64}" style="width:${w}px;height:${h}px;display:block"></body></html>`);
  await page.waitForLoadState('load');
} else {
  await page.goto(url);
}
await page.waitForTimeout(+wait);
await page.screenshot({ path: out });
await browser.close();
if (errors.length) { console.error('console errors:\n' + errors.join('\n')); process.exit(1); }
console.log('wrote', out);
