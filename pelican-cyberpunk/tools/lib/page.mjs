// Shared harness for the browser checks: serve src/ (or open dist/), launch headless Chromium, collect page errors.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from '../serve.mjs';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export async function openScene({ dist = process.argv.includes('--dist'), query = 'freeze&nohud', w = 1600, h = 900 } = {}) {
  let srv = null, url;
  if (dist) url = pathToFileURL(path.join(ROOT, 'dist/index.html')).href;
  else { const s = await serve(0); srv = s.srv; url = `http://127.0.0.1:${s.port}/src/index.dev.html`; }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(`${url}?${query}`);
  await page.waitForFunction(() => window.__pb && window.__pb.ready, null, { timeout: 20000 });
  return { browser, page, errors, close: async () => { await browser.close(); srv?.close(); } };
}
export function reporter(name) {
  const fails = [], notes = [];
  return {
    fail: m => { fails.push(m); console.log('  FAIL ' + m); },
    ok: m => { notes.push(m); console.log('  ok   ' + m); },
    done(extra = {}) { console.log(`${name}: ${fails.length ? 'FAIL (' + fails.length + ')' : 'PASS'}`); return { fails, notes, ...extra }; },
  };
}
