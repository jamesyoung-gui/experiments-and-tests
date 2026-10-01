// Claims check: every number in README.md's generated "Measured" block must match the tool JSON it came from
// (tools/build.mjs --readme writes it; this re-derives it and diffs). Also flags edition-C numbers leaking in.
// usage: node tools/verify-claims.mjs     exit 1 on a mismatch
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const J = f => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch { return null; } };
const fails = [], ok = [];
const block = (readme.split(/## 实测 · Measured/)[1] || '').split(/\n## /)[0];
if (!block) fails.push('README has no generated Measured block');
const want = [];
const P = J('shots/verify/perf/perf.json')?.best; if (P) want.push([`${P.fps} fps`, 'perf.json fps'], [`${P.nodes} DOM nodes`, 'perf.json nodes'], [`${P.cpuMsPerFrame} ms CPU per frame`, 'perf.json cpu']);
const D = J('shots/verify/detail-inventory.json'); if (D) want.push([`${D.total} visible detail items`, 'detail-inventory total']);
const E = J('shots/eggs/check-eggs.json'); if (E) want.push([`${E.eggs} eggs`, 'check-eggs count']);
const CB = J('shots/baker/check/check-baked.json'); if (CB) want.push([`${CB.hard.length} hard, ${CB.soft.length} soft`, 'check-baked']);
for (const [s, src] of want) (block.includes(s) ? ok : fails).push(`${src}: "${s}"${block.includes(s) ? '' : ' not in README (stale: rerun node tools/build.mjs --readme)'}`);
for (const stale of ['59.5 fps', '5948', '13/13 eggs', '2 soft']) if (readme.includes(stale)) fails.push(`edition-C number "${stale}" appears in README`);
ok.forEach(m => console.log('  ok   ' + m)); fails.forEach(m => console.log('  FAIL ' + m));
console.log(`verify-claims: ${fails.length ? 'FAIL' : 'PASS'} (${want.length} numbers checked)`);
process.exit(fails.length ? 1 : 0);
