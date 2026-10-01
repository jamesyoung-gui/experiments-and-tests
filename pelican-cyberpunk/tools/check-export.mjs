// "Animated SVG" export from the page (rubric J-product): the bake runs in slices, so the page must stay responsive.
// Checks: progress shows on the button (aria-busy + data-pb-progress) and rises; no long task > 200 ms... reported as
// the longest main-thread task (PerformanceObserver longtask); a download arrives and is a valid animated SVG; a second
// export cancelled after 3 s leaves the live scene split and playing again.
// usage: node tools/check-export.mjs [--dist] [--max-task 200]
import { openScene, reporter } from './lib/page.mjs';
const MAXT = +(process.argv[process.argv.indexOf('--max-task') + 1] || 200) || 200;
const R = reporter('check-export');
const { page, errors, close } = await openScene({ query: 'nohud' });
await page.evaluate(() => { window.__lt = []; new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: false }); window.__pb.play(); });
await page.waitForTimeout(500);
const t0 = Date.now();
const dl = page.waitForEvent('download', { timeout: 300000 });
await page.evaluate(() => window.__pb.bus.emit('ui:download', { kind: 'svg' }));
const prog = [];
let done = false; dl.then(() => { done = true; }, () => { done = true; });
while (!done && Date.now() - t0 < 300000) {
  await page.waitForTimeout(1000);
  prog.push(await page.evaluate(() => { const b = document.querySelector('#ui [data-act="dlSvg"]'); return b ? [b.getAttribute('aria-busy'), b.getAttribute('data-pb-progress')] : null; }));
}
const d = await dl.catch(() => null);
const secs = (Date.now() - t0) / 1000;
const pcts = prog.filter(p => p && p[0] === 'true').map(p => parseInt(p[1]) || 0);
pcts.length >= 2 && pcts[pcts.length - 1] > pcts[0] ? R.ok(`progress on the button: ${pcts.slice(0, 3).join('%, ')}% … ${pcts[pcts.length - 1]}% (aria-busy)`) : R.fail('no rising progress on the button: ' + JSON.stringify(prog.slice(0, 5)));
if (d) {
  const p = await d.path(); const fs = await import('node:fs'); const txt = fs.readFileSync(p, 'utf8');
  /<svg[\s\S]*<animate/.test(txt) && !/<script/i.test(txt) ? R.ok(`download ${d.suggestedFilename()} ${(txt.length / 1024).toFixed(0)} KB after ${secs.toFixed(0)} s (animated, no script)`) : R.fail('download is not an animated, script-free SVG');
} else R.fail(`no download after ${secs.toFixed(0)} s`);
const lt = await page.evaluate(() => window.__lt);
const worst = lt.reduce((m, x) => Math.max(m, x[1]), 0);
const over = lt.filter(x => x[1] > MAXT);
worst <= MAXT ? R.ok(`longest main-thread task ${worst} ms ≤ ${MAXT} ms (${lt.length} long tasks > 50 ms)`) : R.fail(`${over.length} tasks > ${MAXT} ms during export, longest ${worst} ms`);
// cancel
await page.evaluate(() => window.__pb.bus.emit('ui:download', { kind: 'svg' }));
await page.waitForTimeout(3000);
await page.evaluate(() => window.__pb.bus.emit('ui:download', { kind: 'svg' }));
await page.waitForFunction(() => !window.__pb.exporting(), null, { timeout: 30000 }).catch(() => {});
const after = await page.evaluate(async () => { const t = window.__pb.state.t; await new Promise(r => setTimeout(r, 600)); return { exporting: window.__pb.exporting(), split: window.__pb.sheets.isSplit, moved: window.__pb.state.t - t, busy: document.querySelector('#ui [data-act="dlSvg"]')?.getAttribute('aria-busy') }; });
!after.exporting && after.split && after.moved > 0.2 && !after.busy ? R.ok('cancel: export stopped, sheets re-split, the ride plays on') : R.fail('cancel left the page in a bad state: ' + JSON.stringify(after));
for (const e of errors) R.fail(e);
console.log("  long tasks > " + MAXT + " ms (start ms, dur):", JSON.stringify(over.slice(0, 20)), "export ran", (t0 % 1e9) ? "" : "");
const r = R.done({ worstTaskMs: worst, seconds: secs });
await close();
process.exit(r.fails.length ? 1 : 0);
