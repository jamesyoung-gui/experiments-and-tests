// One-command verify: every gate in order, prints a summary (stops at the first hard failure unless --all).
// usage: node tools/verify.mjs [--quick] [--no-perf] [--no-bake] [--all]
//   lint → check-rig → build → shoot dev → shoot dist → detail-inventory → check-eggs → check-bike → check-anchors →
//   check-beats → keys → bake → check-baked → perf (dist) → check-export → build --readme → verify-claims
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const has = k => process.argv.includes('--' + k);
const quick = has('quick');
const set = quick ? 'hero,events' : 'hero,frames,tods,cams,events,zoom,mobile,thumb,glitch';
const steps = [
  ['lint', ['tools/lint.mjs']],
  ['check-rig', ['tools/check-rig.mjs']],
  ['build', ['tools/build.mjs', '--draft']],
  ['shoot dev', ['tools/shoot.mjs', '--out', 'shots/verify/dev', '--set', set, '--sheet']],
  ['shoot dist', ['tools/shoot.mjs', '--dist', '--out', 'shots/verify/dist', '--set', set, '--sheet']],
  ['detail-inventory', ['tools/detail-inventory.mjs', '--dev', '--json', 'shots/verify/detail-inventory.json']],
  ['check-eggs', ['tools/check-eggs.mjs']],
  ['check-bike', ['tools/check-bike.mjs']],
  ['check-anchors', ['tools/check-anchors.mjs', '--json', 'shots/verify/anchors.json']],
  ['check-beats', ['tools/check-beats.mjs', '--json', 'shots/verify/beats.json']],
  ['keys', ['tools/keys.mjs']],
  ...(has('no-bake') ? [] : [['bake', ['tools/bake.mjs']], ['check-baked', ['tools/check-baked.mjs', ...(quick ? ['--quick'] : [])]]]),
  ...(has('no-perf') ? [] : [['perf', ['tools/shoot.mjs', '--dist', '--out', 'shots/verify/perf', '--set', 'none', '--perf']]]),
  ...(quick ? [] : [['check-export', ['tools/check-export.mjs']]]),
  ['readme', ['tools/build.mjs', '--readme']],
  ['verify-claims', ['tools/verify-claims.mjs']],
];
const res = [];
for (const [name, args] of steps) {
  const t0 = Date.now();
  process.stdout.write(`\n=== ${name}: node ${args.join(' ')}\n`);
  const r = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit', env: process.env });
  res.push([name, r.status === 0, ((Date.now() - t0) / 1000).toFixed(0) + ' s']);
  if (r.status !== 0 && !has('all')) break;
}
console.log('\n=== verify summary');
for (const [n, ok, s] of res) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n.padEnd(18)} ${s}`);
const bad = res.filter(r => !r[1]).length || res.length < steps.length;
console.log(bad ? 'VERIFY: FAIL' : 'VERIFY: PASS');
process.exit(bad ? 1 : 0);
