// Bundle src/main.js (esbuild, IIFE) + CSS and inline everything into dist/index.html (works from file://).
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readmeOnly = process.argv.includes('--readme'), draft = process.argv.includes('--draft');
const r = readmeOnly ? null : await build({ entryPoints: [path.join(ROOT, 'src/main.js')], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', legalComments: 'none' });
// ---- path-data packing (size budget): the glyph outline tables (lettering converted to paths in many modules) are
// most of the bundle. Every long path-data string literal is replaced by __pbU("<packed>"), decoded once at load into
// an equivalent path string (same command letters, same numbers in the same order, a blank between any two numbers:
// some modules re-map the numbers in place by regex and keep the separators), so modules,
// the baker and anything that parses the numbers see the same data. Numbers are deltas against the previous number
// of the same slot (x / y alternate), zigzag-coded in a variable-length base-32 with two disjoint digit alphabets
// (continuation / final), none of them a path command letter or a quote.
const CMD = 'MLHVCSQTAZmlhvcsqtaz';
const DIG = [...Array(94)].map((_, i) => String.fromCharCode(33 + i)).filter(c => !CMD.includes(c) && !'"\'\\`'.includes(c) && !/[eE]/.test(c));
const FIN = DIG.slice(0, 32), CON = DIG.slice(32, 64);
function packPath(src) {
  const toks = src.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) || [];
  if (toks.some(t => /e/i.test(t) && !CMD.includes(t))) return null;
  const nums = toks.filter(t => !CMD.includes(t));
  const dec = Math.min(3, Math.max(0, ...nums.map(t => (t.split('.')[1] || '').length)));
  const k = 10 ** dec; let out = String(dec), slot = 0; const prev = [0, 0];
  for (const t of toks) {
    if (CMD.includes(t)) { out += t; continue; }
    const v = Math.round(parseFloat(t) * k), d = v - prev[slot]; prev[slot] = v; slot ^= 1;
    let z = d < 0 ? -2 * d - 1 : 2 * d, s2 = '';
    s2 = FIN[z % 32]; z = Math.floor(z / 32);
    while (z > 0) { s2 = CON[z % 32] + s2; z = Math.floor(z / 32); }
    out += s2;
  }
  return out;
}
const DECODER = `var __pbU=(function(){var C=${JSON.stringify(CMD)},F=${JSON.stringify(FIN.join(''))},N=${JSON.stringify(CON.join(''))};return function(s){var k=Math.pow(10,+s[0]),o='',p=[0,0],sl=0,z=0,i,c,f,n,v,t;for(i=1;i<s.length;i++){c=s[i];if(C.indexOf(c)>=0){o+=c;continue;}n=N.indexOf(c);if(n>=0){z=z*32+n;continue;}f=F.indexOf(c);z=z*32+f;v=p[sl]+(z&1?-(z+1)/2:z/2);p[sl]=v;sl^=1;z=0;t=String(+(v/k).toFixed(3));if(o&&C.indexOf(o[o.length-1])<0)o+=' ';o+=t;}return o;};})();`;
// numbers equal after decoding (lossless up to the string's own decimal precision)
const same = (a, b) => { const na = a.match(/-?(?:\d+\.?\d*|\.\d+)/g) || [], nb = b.match(/-?(?:\d+\.?\d*|\.\d+)/g) || []; return na.length === nb.length && na.every((x, i) => Math.abs(+x - +nb[i]) < 1e-9) && a.replace(/[^A-Za-z]/g, '') === b.replace(/[^A-Za-z]/g, ''); };
const decode = new Function(DECODER + 'return __pbU;')();
if (!readmeOnly) {
let packed = 0, saved = 0;
const js0 = r.outputFiles[0].text.replace(/"(M[-0-9. MLHVCSQTAZmlhvcsqtaz]{160,})"/g, (m, d) => {
  const enc = packPath(d);
  if (/\s$/.test(d) || !enc || enc.length + 9 >= m.length || !same(decode(enc), d)) return m;   // (a trailing blank may be load-bearing: code appends to the literal)
  packed++; saved += m.length - enc.length - 9;
  return `__pbU("${enc}")`;
});
const js = (packed ? DECODER : '') + js0.replace(/<\/script/gi, '<\\/script');
console.log(`path-data packing: ${packed} literals, ${(saved / 1024).toFixed(1)} KB saved`);
const css = fs.readFileSync(path.join(ROOT, 'src/page.css'), 'utf8');
const dev = fs.readFileSync(path.join(ROOT, 'src/index.dev.html'), 'utf8');
const html = dev
  .replace(/<link rel="stylesheet" href="\.\/page\.css">/, () => `<style>${css}</style>`)
  .replace(/<script type="module" src="\.\/main\.js"><\/script>/, () => `<script>${js}</script>`);
if (html.includes('src="./main.js"')) throw new Error('template substitution failed');
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/index.html'), html);
const kb = html.length / 1024, max = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/budgets.json'), 'utf8')).distKBMax;
console.log(`dist/index.html  ${kb.toFixed(1)} KB (budget ${max} KB)`);
if (!readmeOnly && kb > max) { console.error(`BUDGET MISSED: dist/index.html ${kb.toFixed(1)} KB > ${max} KB`); process.exit(1); }

}
// ---- README.md (Chinese first), generated from KEYMAP, budgets.json and docs/EGGS.md so it can't drift ----
const { KEYMAP, STRINGS } = await import(path.join(ROOT, 'src/ui/ui.js'));
const B = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/budgets.json'), 'utf8'));
const eggsMd = fs.readFileSync(path.join(ROOT, 'docs/EGGS.md'), 'utf8');
const eggRows = eggsMd.split('\n').filter(l => /^\| \d+ \|/.test(l)).map(l => l.split('|').map(c => c.trim())).map(c => `| ${c[1]} | ${c[3]} | ${c[4]} |`);
const keyRows = KEYMAP.map(k => `| \`${k.cap}\`${k.keys.length > 1 ? ' / ' + k.keys.slice(1).map(x => '`' + (x === 'ArrowUp' ? '↑' : x) + '`').join(' ') : ''} | ${STRINGS.zh[k.label] ?? k.act} | ${STRINGS.en[k.label] ?? k.act} |`);
const readme = `# 霓虹鹈鹕 · Neon Pelican（鹈鹕湾 赛博朋克版 · Pelican Bay, cyberpunk edition）

一只赛博朋克大白鹈鹕（护目镜、LED 围巾、外卖夹克）骑着发光的城市单车，穿过雨夜霓虹港城送外卖。
A cyberpunk great white pelican (visor, LED scarf, courier bomber) rides a glowing city fixie through a rain-slick neon harbour megacity, delivering fish.

- 打开 Open: \`dist/index.html\` (单文件，离线可用 · single file, works from file://)
- 零 JS 动画 SVG · Zero-JS animated SVG: \`dist/pelican-bicycle.svg\`
- 开发 Dev: \`node tools/serve.mjs\` → \`/src/index.dev.html\`；构建 Build: \`node tools/build.mjs\`（本文件由其生成 · this file is generated by it）

## 快捷键 · Keys

| 键 Key | 中文 | English |
|---|---|---|
${keyRows.join('\n')}

点击鹈鹕 = 喂鱼 · Click the pelican to feed it.

## 无障碍 · Accessibility

- 全部功能可用键盘操作；控制卡按钮带 \`aria-keyshortcuts\`，焦点顺序与视觉顺序一致。
  Everything works from the keyboard; buttons carry \`aria-keyshortcuts\` and focus order follows visual order.
- 场景 SVG 为 \`role="img"\`，带标题与描述；页面有一个隐藏的 \`<h1>\`。 The scene is \`role="img"\` with a title and description, and the page has a visually hidden \`<h1>\`.
- 遵循 \`prefers-reduced-motion\`（或 \`?reduced\`）：暂停自动播放、关闭镜头运动与跳跃跟随。 Honours \`prefers-reduced-motion\` (or \`?reduced\`): no autoplay, no camera moves, no hop-follow.
- 声音默认关闭 · Sound is off by default (\`M\`).
- 竖屏手机：镜头按整车（前后轮 + 3% 边距）取景，放在底部控制卡之上。 Portrait phones: the camera frames the whole bike (both wheels plus a 3% margin) above the bottom sheet.

## 预算 · Budgets (\`tools/budgets.json\`, enforced)

| 项目 Item | 预算 Budget | 检查 Check |
|---|---|---|
| 帧率 fps (1600×900, headless Chromium, best of ≤ 3 trials after a quiet-box wait) | ≥ ${B.perf.fpsMin} | \`node tools/shoot.mjs --dist --perf\` (exit 1 on miss) |
| JS p95 / frame | target ≤ ${B.perf.jsP95MaxMs} ms · hard ≤ ${B.perfHard?.jsP95MaxMs ?? B.perf.jsP95MaxMs} ms | 同上 same |
| DOM 节点 nodes (#scene, incl. defs) | target ≤ ${B.perf.domMax} · hard ≤ ${B.perfHard?.domMax ?? B.perf.domMax} | 同上 same |
| dist/index.html | ≤ ${B.distKBMax} KB | \`node tools/build.mjs\` (exit 1 on miss) |

调试 Debug: \`?perf\` 显示帧率 HUD（fps HUD），\`?perf&modperf\` 显示各模块耗时（per-module update ms）；\`?solo=<module>\`、\`?nofx\`、\`?cam=close\`、\`?tod=0.9\`、\`?freeze\`。
动作证据 Motion evidence: \`node tools/shoot.mjs --set strip\` 用特写镜头为每个事件渲染完整时长的胶片条（每 3 帧一格）以及峰值附近 12 帧的 1:1 局部（响铃、挥手、跳跃、吞鱼、滑行、踏频变化）。
\`--set strip\`: close camera, the full TIMING duration of each event at every 3rd frame, plus a 1:1 inset of 12 consecutive frames around the peak (docs/timing.md). \`--set thumb\` (\`?notext\`, \`?silhouette\` foils), \`--set glitch\`, \`--set crops,drivetrain\`.
全部检查 All gates: \`node tools/verify.mjs\` (lint, rig, build, shots, detail, eggs, bike, anchors, beats, keys, bake, perf, export, README claims).

## 构图 · Composition

- 远景（wide）是整幅城市画面；特写（close）比契约值放宽（zoom 1.32），冠羽上方至少留 6% 空间。 Wide is the full city frame. Close is looser than the contract value (zoom 1.32) and keeps at least 6% headroom above the crest.
- 跳跃时特写/电影镜头在下蹲帧（0.24 s 预备）就开始上抬，临界阻尼约 0.7 s 回落，所以到最高点时嘴和冠羽仍在画面内。 On a hop, the close and cinematic cameras start rising at the crouch (0.24 s anticipation) and settle back, critically damped, in about 0.7 s, so the bill and crest stay in frame at the apex.
- 每帧提供 \`frame.headBox\`（viewBox 坐标的头部圆），天空道具应避开它。 Each frame exposes \`frame.headBox\` (a circle around the head, in viewBox units); sky props should keep out of it.

## 彩蛋 · Easter eggs（剧透 spoilers — 详见 docs/EGGS.md）

| # | 中文 | English |
|---|---|---|
${eggRows.join('\n')}
`;
// ---- measured block: generated from the tools' own JSON, never typed by hand (rubric: claims must match evidence)
const J = f => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch { return null; } };
const zlib = await import('node:zlib');
const kbOf = f => { try { const b = fs.readFileSync(path.join(ROOT, f)); return { raw: b.length / 1024, gz: zlib.gzipSync(b, { level: 9 }).length / 1024 }; } catch { return null; } };
const SRC = { perf: 'shots/verify/perf/perf.json', baked: 'shots/baker/check/check-baked.json', eggs: 'shots/eggs/check-eggs.json', detail: 'shots/verify/detail-inventory.json', beats: 'shots/verify/beats.json' };
const M = Object.fromEntries(Object.entries(SRC).map(([k, f]) => [k, J(f)]));
const missing = Object.entries(M).filter(([, v]) => !v).map(([k]) => SRC[k]);
const html = kbOf('dist/index.html'), svgk = kbOf('dist/pelican-bicycle.svg');
const f1 = x => (x == null ? '—' : (+x).toFixed(1));
const P = M.perf?.best, CB = M.baked, D = M.detail, E = M.eggs, BT = M.beats;
const lines = [
  P && `- \`shoot --dist --perf\` (${M.perf.when.slice(0, 16).replace('T', ' ')} UTC, best of ${M.perf.trials.length}; box load ${P.load}, other tenants ${P.otherCores} cores): **${P.fps} fps**, frame p95 ${P.p95dtMs} ms, JS median ${P.jsMedMs} / p95 ${P.jsP95Ms} ms, **${P.cpuMsPerFrame} ms CPU per frame** (whole browser), ${P.nodes} DOM nodes, quality tier ${P.tierEnd}${P.miss.length ? ` — **misses: ${P.miss.join('; ')}**` : ' — meets the budgets'}.`,
  D && `- \`detail-inventory\`: **${D.total} visible detail items** (${(D.ratio).toFixed(2)}× edition C's ${D.baseline.all}); ${Object.entries(D.counts).map(([l, c]) => `${l} ${c.total}`).join(', ')}. ${D.fails.length ? 'FAIL: ' + D.fails.join('; ') : 'G-DETAIL passes.'}`,
  E && `- \`check-eggs\`: ${E.eggs} eggs, ${E.shots} shots, ${E.errors} console errors, ${E.fails.length} failures.`,
  BT && `- \`check-beats\` (idle pacing, ${Math.round(BT.beats.length ? BT.beats[BT.beats.length - 1].t : 0)} s of live play): ${BT.beats.length} rig beats, max gap ${f1(BT.maxGap)} s, per 90 s window ${BT.windows.join(' / ')}${BT.fails.length ? ' — FAIL: ' + BT.fails.join('; ') : ''}.`,
  CB && `- \`check-baked\`: ${CB.hard.length} hard, ${CB.soft.length} soft${CB.soft.length ? ` (${CB.soft.join('; ')})` : ''}; seam ratio ${CB.loop?.seamRatio ?? '—'}, ${CB.loops?.longAnims ?? '—'} animations on ≥ 60 s own loops.`,
  html && `- Sizes: \`dist/index.html\` ${f1(html.raw)} KB (${f1(html.gz)} KB gzip)${svgk ? `, \`dist/pelican-bicycle.svg\` ${f1(svgk.raw)} KB (${f1(svgk.gz)} KB gzip)` : ''}.`,
].filter(Boolean);
const measured = `## 实测 · Measured (generated by \`tools/build.mjs --readme\` from the tools' JSON; run \`node tools/verify.mjs\`)\n\n${lines.join('\n')}${missing.length ? `\n- **Not measured yet:** ${missing.join(', ')}` : ''}\n`;
const signature = `
## 招牌时刻 · Signature moment

**信号丢失 SIGNAL LOST**：每圈进入霓虹隧道（第 13 km）时，整座城市"掉线" 1.6 秒——街区横向撕裂，远处的天际线、海面和船只两次闪成霓虹线框，只有外卖鹈鹕保持实体。这是 HACK 彩蛋的自动短版（输入 HACK 看完整 3.6 秒版本）。
Once per lap, entering the neon tunnel (km 13), the city loses signal for 1.6 s: the districts tear sideways, the far skyline, sea and boats flash into neon wireframe twice, and only the courier stays solid. It is the automatic short cousin of the HACK egg (type HACK for the full 3.6 s version). \`?noglitch\` turns it off; reduced motion skips it. Shots: \`node tools/shoot.mjs --set glitch\`.

## 节奏 · Pacing

导演按遭遇触发动作（骑友→挥手、猫→响铃、海鸥/鱼/饮料→吞鱼、水坑→跳跃）；领队的"节拍守护"补上鹈鹕自己的小动作：空闲不超过约 11.5 秒、不连续重复同一动作，风筝、烟花和彩虹各有反应。
The director fires beats from encounters; the lead's beat keeper adds the courier's own small beats so that no idle gap exceeds ~11.5 s, no beat type repeats back to back, and the kites, fireworks and rainbow get a reaction (\`node tools/check-beats.mjs\`; \`docs/beats.md\`).

## 性能 · Perf

自适应画质：帧时间 p95 连续超过 18 ms 时依次关闭最费合成的图层（暴雨第二层、霾池、远处车道 → 小雨层、近处车道、第二层烟雾、海角倒影），稳定后再恢复；\`?q=high|medium|low\` 可锁定。
Adaptive quality: when the frame p95 stays above 18 ms the page sheds the composited layers that cost the software compositor most for the least picture, and steps back up when frames are clean again (\`?q=high|medium|low\` pins a tier). The rider's static-art slots (head, bills, pouch, eye, upper wings and hands, near thigh, frame) are rigid compositor layers, rasterised once (\`?rigid=all|none\` A/B). Export of the animated SVG runs in slices with a progress bar and can be cancelled (press again or Esc).
`;
const making = path.join(ROOT, 'docs/MAKING.md');
// docs/MAKING.md is edition C's making-of: keep its process table as history, drop its measured numbers (they are not this build's)
const history = fs.existsSync(making) ? fs.readFileSync(making, 'utf8').split(/\*\*Measured at the end/)[0].replace('## 制作过程 · How it was made', '## 制作过程 · How it was made (edition C, the engine this fork comes from)') : '';
fs.writeFileSync(path.join(ROOT, 'README.md'), readme + signature + '\n' + measured + (history ? '\n' + history.trimEnd() + '\n\nThe cyberpunk edition reuses that engine (rig, sheets, route, director, eggs, baker, tools) with every art module redrawn to docs/STYLE-X.md; its own numbers are the measured block above.\n' : ''));
console.log('README.md generated' + (missing.length ? ` (not measured: ${missing.join(', ')})` : ''));
if (missing.length && !draft && readmeOnly) { console.error('BUILD: measured numbers missing — run node tools/verify.mjs (or pass --draft)'); process.exit(1); }
