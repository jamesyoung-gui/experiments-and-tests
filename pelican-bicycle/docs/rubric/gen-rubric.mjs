#!/usr/bin/env node
// Validates rubric.json (the single source of truth) and regenerates RUBRIC.md from it.
// Usage: node docs/rubric/gen-rubric.mjs [--check]   (--check: validate + fail if RUBRIC.md is stale)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const R = JSON.parse(readFileSync(resolve(ROOT, 'rubric.json'), 'utf8'));
const errors = [];
const fail = m => errors.push(m);

// ---------- validation ----------
const dimIds = new Set(), critIds = new Set(), gateIds = new Set(R.gates.map(g => g.id));
let wsum = 0;
for (const d of R.dimensions) {
  if (dimIds.has(d.id)) fail(`duplicate dimension ${d.id}`);
  dimIds.add(d.id); wsum += d.weight;
  if (d.criteria.length < 3 || d.criteria.length > 8) fail(`${d.id}: ${d.criteria.length} criteria (need 3-8)`);
  for (const c of d.criteria) {
    if (critIds.has(c.id)) fail(`duplicate criterion ${c.id}`);
    critIds.add(c.id);
    for (const k of ['2', '5', '8', '10']) if (!c.anchors?.[k]?.trim()) fail(`${c.id}: missing anchor ${k}`);
    if (!c.measurement?.includes('[')) fail(`${c.id}: measurement lacks a [type] tag`);
    if (!c.evidence?.trim()) fail(`${c.id}: missing evidence`);
    if (!(c.w > 0)) fail(`${c.id}: bad weight`);
    const tags = [...c.measurement.matchAll(/\[(script|judge|code-review|live-test)\]/g)].map(m => m[1]);
    for (const t of c.type) if (!tags.includes(t)) fail(`${c.id}: type ${t} not tagged in measurement`);
  }
}
if (Math.abs(wsum - 100) > 1e-9) fail(`dimension weights sum to ${wsum}, not 100`);
for (const g of R.gates) {
  if (typeof g.cap?.total !== 'number') fail(`${g.id}: cap.total missing`);
  for (const k of Object.keys(g.cap?.dimensions || {})) if (!dimIds.has(k)) fail(`${g.id}: unknown dimension ${k}`);
}
const rsIds = new Set(R.protocol.renderSets.map(r => r.id));
for (const a of R.protocol.judgeAllocation) {
  if (!dimIds.has(a.dimension)) fail(`judgeAllocation: unknown ${a.dimension}`);
  for (const b of a.bundle) if (!rsIds.has(b)) fail(`judgeAllocation ${a.dimension}: unknown render set ${b}`);
}
if (R.protocol.judgeAllocation.length !== R.dimensions.length) fail('judgeAllocation must cover every dimension');
for (const b of R.baseline.knownDefects) for (const x of b.affects) {
  if (!(critIds.has(x) || gateIds.has(x) || rsIds.has(x) || x === 'protocol')) fail(`${b.id}: unknown ref ${x}`);
}
if (errors.length) { console.error('rubric.json INVALID:\n  ' + errors.join('\n  ')); process.exit(1); }

// ---------- markdown ----------
// Escape text for Markdown: HTML-tag-like tokens (<img>, <title>, <round>...) become code spans so they read
// cleanly and never render as HTML; elsewhere keep backslashes and neutralise emphasis markers.
const t = s => {
  const toks = [];
  let x = String(s).replace(/<\/?[A-Za-z!?][^<>\n]{0,80}>/g, m => `\u0000${toks.push(m) - 1}\u0000`);
  x = x.replace(/\\/g, '\\\\').replace(/\*/g, '\\*').replace(/__/g, '\\_\\_').replace(/<(?=[A-Za-z\/!?])/g, '&lt;');
  return x.replace(/\u0000(\d+)\u0000/g, (_, i) => '`' + toks[i] + '`');
};
const esc = s => t(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const TYPE = { script: '自动脚本', judge: '视觉评审', 'code-review': '代码审查', 'live-test': '实时交互测试' };
const capText = g => {
  const parts = [g.cap.total === 0 ? '总分记 0' : `总分 ≤${g.cap.total}`];
  for (const [d, v] of Object.entries(g.cap.dimensions || {})) parts.push(`${d} ≤${v}`);
  if (g.cap.note) parts.push(g.cap.note);
  return parts.join('；');
};
const capsByDim = {};
for (const g of R.gates) for (const [d, v] of Object.entries(g.cap.dimensions || {})) (capsByDim[d] ||= []).push(`${g.id}→${v}`);

const L = [];
const p = (...xs) => L.push(...xs);
p(`# ${t(R.meta.title)}`, '');
p(`> 版本 ${R.meta.version} · ${R.meta.date} · ${t(R.meta.author)}。合并的镜头：${R.meta.lenses.map(l => `${l.id}（${t(l.name)}）`).join('、')}。`, '');
p(`> ${t(R.meta.howToUse)}`, '');
p(`**单位与约定**：${t(R.meta.units)}`, '');
p('## 目录', '',
  '1. [10/10 北极星](#1-1010-北极星)',
  '2. [达标线](#2-达标线)',
  '3. [评分与聚合](#3-评分与聚合)',
  '4. [维度与权重一览](#4-维度与权重一览)',
  '5. [硬门槛](#5-硬门槛)',
  '6. [维度详解](#6-维度详解)',
  '7. [评估协议](#7-评估协议)',
  '8. [定义：CANON-14 与 FM-10](#8-定义canon-14-与-fm-10)',
  '9. [phase-0 已知基线（预登记缺陷）](#9-phase-0-已知基线预登记缺陷)',
  '10. [镜头分歧的裁决](#10-镜头分歧的裁决)',
  '11. [对团队设计的反推](#11-对团队设计的反推)', '');

p('## 1. 10/10 北极星', '', t(R.northStar), '');

p('## 2. 达标线', '', t(R.target.text), '',
  `| 条件 | 要求 |`, `|---|---|`,
  `| 硬门槛 | 全部通过（G1–G${R.gates.length}） |`,
  `| 每个维度 | ≥ ${R.target.perDimensionMin.toFixed(1)} |`,
  `| 加权总分 | ≥ ${R.target.totalMin} / 100 |`,
  `| 单个 criterion 底线 | ≥ ${R.target.noCriterionBelow} |`,
  `| 有效轮次 | ${R.target.validRound} |`, '');

p('## 3. 评分与聚合', '',
  `- **分数刻度**：${t(R.scoring.scale)}`,
  `- **机器上限**：${t(R.scoring.machineCeiling)}`,
  `- **criterion 分**：\`${R.scoring.criterion}\``,
  `- **维度分**：\`${R.scoring.dimension}\``,
  `- **总分**：\`${R.scoring.total}\``,
  `- **报告**：${t(R.scoring.reporting)}`, '');

p('## 4. 维度与权重一览', '', t(R.meta.weightRationale || ''), '', '| 维度 | 名称 | English | 权重 | criteria | 受哪些门槛封顶 |', '|---|---|---|---:|---:|---|');
for (const d of R.dimensions) p(`| [${d.id}](#${d.id.toLowerCase()}-${slug(d.name)}) | ${esc(d.name)} | ${esc(d.en)} | ${d.weight} | ${d.criteria.length} | ${(capsByDim[d.id] || []).join('、') || '—'} |`);
p(`| | **合计** | | **${R.dimensions.reduce((s, d) => s + d.weight, 0)}** | **${R.dimensions.reduce((s, d) => s + d.criteria.length, 0)}** | |`, '');

p('## 5. 硬门槛', '', '任一门槛失败即按"上限"封顶（多个门槛失败时取最低上限）；门槛是底线，对应 criterion 的 8/10 分锚点要求更高。', '',
  '| 门槛 | 名称 | 规则 | 失败时上限 | 测量 / 证据 |', '|---|---|---|---|---|');
for (const g of R.gates) p(`| **${g.id}** | ${esc(g.name)} | ${esc(g.rule)} | ${esc(capText(g))} | ${esc(g.measurement)}<br>证据：${esc(g.evidence)} |`);
p('');

p('## 6. 维度详解', '');
for (const d of R.dimensions) {
  const ws = d.criteria.reduce((s, c) => s + c.w, 0);
  p(`### ${d.id} ${t(d.name)}`, '', `*${t(d.en)}* · **权重 ${d.weight}** · 来源镜头：${d.sources.join('、')}`, '', t(d.intent), '');
  for (const c of d.criteria) {
    p(`#### ${c.id} ${t(c.name)}`, '', `维度内权重 ${c.w}（占本维度 ${Math.round(100 * c.w / ws)}%）· 测量方式：${c.type.map(t => TYPE[t]).join(' + ')}`, '');
    for (const k of ['2', '5', '8', '10']) p(`- **${k} 分**：${t(c.anchors[k])}`);
    p('', `**测量**：${t(c.measurement)}`, '', `**证据**：${t(c.evidence)}`, '');
  }
}

const P = R.protocol;
p('## 7. 评估协议', '', '### 7.1 原则', '', ...P.principles.map(x => `- ${t(x)}`), '');
p('### 7.2 评审类型', '', '| 类型 | 名称 | 说明 |', '|---|---|---|', ...P.judgeTypes.map(j => `| ${j.id} | ${esc(j.name)} | ${esc(j.text)} |`), '');
p('### 7.3 评审规则', '', ...P.judgeRules.map(x => `- ${t(x)}`), '');
p('### 7.4 渲染集', '', '每一轮都重新生成（旧截图一律作废）。', '', '| 渲染集 | 名称 | 规格 | 工具 |', '|---|---|---|---|', ...P.renderSets.map(r => `| ${r.id} | ${esc(r.name)} | ${esc(r.spec)} | ${esc(r.tool)} |`), '');
p('### 7.5 测量运行', '', '| 运行 | 内容 | 时长 |', '|---|---|---|', ...P.measurementRuns.map(m => `| ${m.id} | ${esc(m.spec)} | ${esc(m.time)} |`), '');
p('### 7.6 各维度评审分配', '', '每个维度的 J-lens 评审各自独立打分，criterion 分取中位数；下表"其他评审"是该维度专用的盲评、对抗或测试者。', '',
  '| 维度 | J-lens 人数 | 其他评审 | 证据包（渲染集） |', '|---|---:|---|---|',
  ...P.judgeAllocation.map(a => `| ${a.dimension} | ${a.lensJudges} | ${esc(a.extra)} | ${a.bundle.join('、') || '脚本输出 + 代码'} |`), '');
p('### 7.7 轮次', '', '| 轮次 | 名称 | 时机 | 范围 |', '|---|---|---|---|', ...P.rounds.map(r => `| ${r.id} | ${esc(r.name)} | ${esc(r.when)} | ${esc(r.scope)} |`), '');
p('### 7.8 防分数通胀', '', ...P.antiInflation.map((x, i) => `${i + 1}. ${t(x)}`), '');
p('### 7.9 输出与预算', '', `- **输出**：${t(P.outputs)}`, `- **预算**：${t(P.budget)}`, '');

p('## 8. 定义：CANON-14 与 FM-10', '');
for (const k of ['canon14', 'fieldMarks']) {
  const D = R.definitions[k];
  p(`**${D.id}** — ${t(D.text)}`, '', ...D.items.map((x, i) => `${i + 1}. ${t(x)}`), '');
}
p(`**时段**：${t(R.definitions.tod)}`, '', `**踏频**：${t(R.definitions.cadence)}`, '');

p('## 9. phase-0 已知基线（预登记缺陷）', '', 'R0 轮中，下列每个可自动检出的缺陷都必须被对应工具检出，否则该工具视为空转。', '',
  '| 编号 | 缺陷 | 来源 | 影响 |', '|---|---|---|---|', ...R.baseline.knownDefects.map(b => `| ${b.id} | ${esc(b.text)} | ${esc(b.source)} | ${b.affects.join('、')} |`), '');

p('## 10. 镜头分歧的裁决', '', ...R.reconciled.map(x => `- ${t(x)}`), '');

const I = R.implications;
p('## 11. 对团队设计的反推', '', t(I.intro), '', '### 11.1 构建开工前必须冻结的契约变更', '', ...I.contractChangesBeforeBuild.map((x, i) => `${i + 1}. ${t(x)}`), '',
  '### 11.2 rubric 隐含要求的角色', '', ...I.roles.map(x => `- ${t(x)}`), '',
  '### 11.3 必须先于构建存在的评估工具', '', I.tools.map(t => `\`${t}\``).join(' · '), '');
p('---', '', `*由 \`node docs/rubric/gen-rubric.mjs\` 从 \`rubric.json\` 生成，请勿手改。*`, '');

function slug(s) { return s.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-'); }

const md = L.join('\n');
const out = resolve(ROOT, 'RUBRIC.md');
if (process.argv.includes('--check')) {
  if (!existsSync(out) || readFileSync(out, 'utf8') !== md) { console.error('RUBRIC.md is stale; run node docs/rubric/gen-rubric.mjs'); process.exit(1); }
  console.log('rubric.json valid; RUBRIC.md up to date');
} else {
  writeFileSync(out, md);
  console.log(`rubric.json valid (${R.dimensions.length} dimensions, ${critIds.size} criteria, ${R.gates.length} gates); wrote RUBRIC.md (${md.length} chars)`);
}
