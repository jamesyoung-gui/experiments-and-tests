// Compose PNGs into a labelled grid.
// usage: node tools/sheet.mjs <out.png> <cols> <tileWidth> "Label=path.png" ...
// Playwright: $PB_PLAYWRIGHT (a path or package name) overrides this box's global install
const { chromium } = await import(process.env.PB_PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright/index.mjs');
import fs from 'node:fs';

const [out, cols = '2', tw = '800', ...items] = process.argv.slice(2);
const tiles = items.map(it => { const i = it.indexOf('='); return { label: it.slice(0, i), src: it.slice(i + 1) }; });
const html = `<!doctype html><html><body style="margin:0;background:#15171c;font:600 22px system-ui,'Noto Sans CJK SC',sans-serif;color:#f4efe6">
<div style="display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:16px;padding:16px">
${tiles.map(t => `<figure style="margin:0"><img style="width:${tw}px;display:block;border-radius:8px" src="data:image/png;base64,${fs.readFileSync(t.src).toString('base64')}"><figcaption style="padding:8px 2px">${t.label}</figcaption></figure>`).join('')}
</div></body></html>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 16 + cols * (+tw + 16), height: 400 } });
await page.setContent(html);
await page.waitForLoadState('load');
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('wrote', out);
