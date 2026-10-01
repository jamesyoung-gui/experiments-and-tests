// Idle pacing (rubric C6.5): fast-forward live play with no input (window.__pb.sim, the live path: director + the
// lead's beat keeper) and check the rig beats: 5–15 per 90 s window, no gap > 12 s, no two of the same type in a row.
// usage: node tools/check-beats.mjs [--dist] [--seconds 270] [--json shots/fix-lead/beats.json]
import fs from 'node:fs';
import path from 'node:path';
import { openScene, reporter, ROOT } from './lib/page.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const SEC = +arg('seconds', 270);
const R = reporter('check-beats');
const { page, errors, close } = await openScene({ query: 'freeze&nohud' });
const log = await page.evaluate(sec => { window.__pb.renderAt(0, {}); return window.__pb.sim(sec, 30); }, SEC);
const beats = log.filter(e => e.t <= SEC);
console.log(beats.map(e => `  ${e.t.toFixed(1).padStart(6)} s  ${e.type.padEnd(5)} ${e.src}`).join('\n'));
let maxGap = beats.length ? beats[0].t : SEC, worstAt = 0, repeats = [];
for (let i = 1; i < beats.length; i++) { const g = beats[i].t - beats[i - 1].t; if (g > maxGap) { maxGap = g; worstAt = beats[i - 1].t; } if (beats[i].type === beats[i - 1].type) repeats.push(`${beats[i].type}@${beats[i].t}`); }
if (beats.length) maxGap = Math.max(maxGap, SEC - beats[beats.length - 1].t);
maxGap <= 12 ? R.ok(`max gap ${maxGap.toFixed(1)} s ≤ 12 s`) : R.fail(`gap ${maxGap.toFixed(1)} s after ${worstAt.toFixed(1)} s > 12 s`);
!repeats.length ? R.ok('no type twice in a row') : R.fail('same type back to back: ' + repeats.join(', '));
const windows = [];
for (let w = 0; w + 90 <= SEC; w += 45) windows.push(beats.filter(e => e.t >= w && e.t < w + 90).length);
windows.every(n => n >= 5 && n <= 15) ? R.ok(`beats per 90 s window: ${windows.join(', ')} (5–15)`) : R.fail(`beats per 90 s window out of 5–15: ${windows.join(', ')}`);
const types = {}; for (const e of beats) types[e.type] = (types[e.type] || 0) + 1;
R.ok('mix: ' + JSON.stringify(types) + ' · sources: ' + JSON.stringify(beats.reduce((a, e) => { const k = e.src.split(':')[0]; a[k] = (a[k] || 0) + 1; return a; }, {})));
for (const e of errors) R.fail(e);
const r = R.done({ beats, maxGap, windows });
const j = arg('json'); if (j) { const f = path.resolve(ROOT, j); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(r, null, 1)); }
await close();
process.exit(r.fails.length ? 1 : 0);
