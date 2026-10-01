// One-command verify: every gate in order, stops at the first hard failure, prints a summary.
// usage: node tools/verify.mjs [--quick] [--no-perf] [--no-bake]
//   lint → check-rig → build → shoot (dev) → shoot --dist → detail-inventory → check-eggs → bake → check-baked → perf
//   --quick   : hero + events shots only, check-baked --quick
// Playwright comes from $PB_PLAYWRIGHT or this box's global install (see the tools' import line).
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const has = k => process.argv.includes('--' + k);
const quick = has('quick');
const set = quick ? 'hero,events' : 'hero,frames,tods,cams,events,zoom,mobile';
const steps = [
  ['lint', ['tools/lint.mjs']],
  ['check-rig', ['tools/check-rig.mjs']],
  ['build', ['tools/build.mjs']],
  ['shoot dev', ['tools/shoot.mjs', '--out', 'shots/verify/dev', '--set', set + ',compare', '--sheet']],
  ['shoot dist', ['tools/shoot.mjs', '--dist', '--out', 'shots/verify/dist', '--set', set, '--sheet']],
  ['detail-inventory', ['tools/detail-inventory.mjs', '--dev']],
  ['check-eggs', ['tools/check-eggs.mjs']],
  ...(has('no-bake') ? [] : [['bake', ['tools/bake.mjs']], ['check-baked', ['tools/check-baked.mjs', ...(quick ? ['--quick'] : [])]]]),
  ...(has('no-perf') ? [] : [['perf', ['tools/shoot.mjs', '--dist', '--out', 'shots/verify/perf', '--set', 'none', '--perf']]]),
];
const res = [];
for (const [name, args] of steps) {
  const t0 = Date.now();
  process.stdout.write(`\n=== ${name}: node ${args.join(' ')}\n`);
  const r = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit', env: process.env });
  res.push([name, r.status === 0, ((Date.now() - t0) / 1000).toFixed(0) + ' s']);
  if (r.status !== 0) break;
}
console.log('\n=== verify summary');
for (const [n, ok, s] of res) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(18)} ${s}`);
const bad = res.filter(r => !r[1]).length || res.length < steps.length;
console.log(bad ? 'VERIFY: FAIL' : 'VERIFY: PASS');
process.exit(bad ? 1 : 0);
