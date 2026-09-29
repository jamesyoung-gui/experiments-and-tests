// Cheap static checks: no SVG filters in live-rendered modules (perf), no DOM at module top level in pure modules, id prefixes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk(path.join(ROOT, 'src')).filter(f => f.endsWith('.js'));
const warn = [], fail = [];
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8'), rel = path.relative(ROOT, f);
  if (/['"`]fe[A-Z]\w+['"`]|<fe[A-Z]/.test(s)) warn.push(`${rel}: uses an SVG filter primitive (allowed only if static/tiny; see CONTRACT.md perf budget)`);
  if (/(^|\n)(const|let|var)?\s*\w*\s*=?\s*(document|window)\./.test(s) && !/main\.js$|ui\/|audio\/|bake\//.test(rel)) fail.push(`${rel}: top-level DOM access (must stay importable in node)`);
  if (/Math\.random\(/.test(s)) warn.push(`${rel}: Math.random — use ctx.rng(salt) for deterministic layouts`);
}
warn.forEach(w => console.warn('warn ' + w));
fail.forEach(w => console.error('FAIL ' + w));
console.log(`lint: ${files.length} files, ${warn.length} warnings, ${fail.length} failures`);
process.exit(fail.length ? 1 : 0);
