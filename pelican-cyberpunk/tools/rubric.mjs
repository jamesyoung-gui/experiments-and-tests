// Print rubric dimensions / gates compactly.  usage: node tools/rubric.mjs D4 D13 [--gates] [--anchors 8,10]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = JSON.parse(fs.readFileSync(path.join(ROOT, 'rubric.json'), 'utf8'));
const args = process.argv.slice(2);
const ids = args.filter(a => /^D\d+$/.test(a));
const ai = args.indexOf('--anchors');
const want = ai >= 0 ? args[ai + 1].split(',') : ['5', '8', '10'];
for (const d of r.dimensions.filter(d => !ids.length || ids.includes(d.id))) {
  console.log(`\n## ${d.id} ${d.name} (${d.en || ''}) — weight ${d.weight}\n${d.intent || ''}`);
  for (const c of d.criteria) {
    console.log(`\n### ${c.id} ${c.name} [w ${c.w}, ${c.type}]`);
    for (const k of want) if (c.anchors?.[k]) console.log(`  ${k}: ${c.anchors[k]}`);
    console.log(`  measure: ${c.measurement}`);
  }
}
if (args.includes('--gates')) for (const g of r.gates) console.log(`\n${g.id} ${g.name}: ${g.rule}  cap=${JSON.stringify(g.cap)}`);
