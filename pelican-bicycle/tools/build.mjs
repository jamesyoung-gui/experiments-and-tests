// Bundle src/main.js (esbuild, IIFE) + CSS and inline everything into dist/index.html (works from file://).
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = await build({ entryPoints: [path.join(ROOT, 'src/main.js')], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', legalComments: 'none' });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync(path.join(ROOT, 'src/page.css'), 'utf8');
const dev = fs.readFileSync(path.join(ROOT, 'src/index.dev.html'), 'utf8');
const html = dev
  .replace(/<link rel="stylesheet" href="\.\/page\.css">/, () => `<style>${css}</style>`)
  .replace(/<script type="module" src="\.\/main\.js"><\/script>/, () => `<script>${js}</script>`);
if (html.includes('src="./main.js"')) throw new Error('template substitution failed');
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/index.html'), html);
console.log(`dist/index.html  ${(html.length / 1024).toFixed(1)} KB`);
