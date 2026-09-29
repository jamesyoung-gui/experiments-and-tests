#!/usr/bin/env node
// Validates rubric.json (the single source of truth) and regenerates, from it:
//   RUBRIC.md                          human-readable rubric
//   docs/rubric/items.json             every anchor split into atomic, id'd items (judges mark pass/fail; tools/score.mjs aggregates)
//   docs/rubric/evidence-manifest.json per criterion/gate: evidence paths the pipeline must produce + tools named in the measurement
//   docs/rubric/creative-brief.md      builder-only creative examples (never given to dimension judges)
// Usage: node docs/rubric/gen-rubric.mjs [--check]   (--check: validate + fail if any generated file is stale)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const R = JSON.parse(readFileSync(resolve(ROOT, 'rubric.json'), 'utf8'));
const errors = [];
const fail = m => errors.push(m);

// ---------- helpers shared by validation and generation
const PATH_RE = /(?:docs|shots|perf|dist|test)\/[^\s；，、（）()"'`]+|README\.md|LICENSE|budgets\.json|CONTRACT\.md/g;
const TOOL_RE = /(?<![\w\/.-])(?:tools\/)?(?:judge\/)?[a-z][\w-]*\.mjs/g;
const NOT_TOOLS = new Set(['gen.mjs', 'ttf.mjs', 'gen-rubric.mjs', 'font.mjs', 'callig.mjs']);
const uniq = xs => [...new Set(xs)];
const pathsOf = s => uniq((String(s).match(PATH_RE) || []).map(p => p.replace(/[。.]+$/, '')));
const toolsOf = s => uniq((String(s).match(TOOL_RE) || []).filter(x => !NOT_TOOLS.has(x)).map(x => x.startsWith('tools/') ? x : 'tools/' + x));
// split on the full-width semicolon at bracket depth 0
function splitItems(s) {
  const out = []; let depth = 0, cur = '';
  for (const ch of String(s)) {
    if ('（(【['.includes(ch)) depth++;
    if ('）)】]'.includes(ch)) depth = Math.max(0, depth - 1);
    if (ch === '；' && depth === 0) { if (cur.trim()) out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// ---------- validation
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
    if (!pathsOf(c.evidence).length) fail(`${c.id}: evidence names no artefact path the pipeline must produce`);
    if (!toolsOf(c.measurement).length) fail(`${c.id}: measurement names no tool that produces the evidence`);
    if (!(c.w > 0)) fail(`${c.id}: bad weight`);
    const tags = [...c.measurement.matchAll(/\[(script|judge|code-review|live-test)\]/g)].map(m => m[1]);
    for (const t of c.type) if (!tags.includes(t)) fail(`${c.id}: type ${t} not tagged in measurement`);
  }
}
if (Math.abs(wsum - 100) > 1e-9) fail(`dimension weights sum to ${wsum}, not 100`);
for (const g of R.gates) {
  if (typeof g.cap?.total !== 'number') fail(`${g.id}: cap.total missing`);
  for (const k of Object.keys(g.cap?.dimensions || {})) if (!dimIds.has(k)) fail(`${g.id}: unknown dimension ${k}`);
  if (!pathsOf(g.evidence).length) fail(`${g.id}: evidence names no artefact path`);
}
for (const id of R.target.perceptualCore || []) if (!critIds.has(id)) fail(`target.perceptualCore: unknown ${id}`);
if (R.target.humanCheckpoint && !gateIds.has(R.target.humanCheckpoint)) fail(`target.humanCheckpoint: unknown gate ${R.target.humanCheckpoint}`);
if (R.detail && !gateIds.has(R.detail.gate)) fail(`detail.gate: unknown gate ${R.detail.gate}`);
if (R.detail && !existsSync(resolve(ROOT, R.detail.baselineFile))) fail(`detail.baselineFile missing: ${R.detail.baselineFile}`);
if (R.detail) {
  const B = JSON.parse(readFileSync(resolve(ROOT, R.detail.baselineFile), 'utf8'));
  for (const [layer, n] of Object.entries(R.detail.baselineCounts)) {
    const got = layer === 'all' ? B.counts.all : B.counts[layer]?.total;
    if (got !== n) fail(`detail.baselineCounts.${layer} = ${n} but ${R.detail.baselineFile} says ${got}`);
    if (layer !== 'all') { const L = B.layers[layer]; if (L.O.length + L.T.length !== n) fail(`baseline ${layer}: ${L.O.length + L.T.length} listed lines vs count ${n}`); }
  }
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

// ---------- derived artefacts
const items = { $schema: 'pelican-bay-rubric-items/1', rubricVersion: R.meta.version, note: '由 gen-rubric.mjs 从 rubric.json 的锚点按顶层"；"拆出。kind：symptom（2/5 档，出现即封顶在该档）、requirement（8/10 档，须全部通过）、ref（"8 分全部满足"之类的引用，不单独判定）。difficulty 只用于 10 档额外项，R0 由首席评审标注（hard=2 / normal=1）后冻结；visibility 由评审标注 default | inspect。', criteria: {} };
for (const d of R.dimensions) for (const c of d.criteria) {
  const out = [];
  for (const k of ['2', '5', '8', '10']) {
    const parts = splitItems(c.anchors[k]);
    const m = /^(\d+ 分全部满足)[，,]?\s*(?:另加[^：:]{0,12}[：:])?\s*/.exec(parts[0] || '');
    if (m) { parts[0] = parts[0].slice(m[0].length); parts.unshift(m[1]); if (!parts[1]) parts.splice(1, 1); }
    parts.forEach((text, i) => {
      const kind = /^\d+ 分全部满足$/.test(text) ? 'ref' : (k === '2' || k === '5') ? 'symptom' : 'requirement';
      out.push({ id: `${c.id}-${k}.${i + 1}`, level: +k, kind, text, ...(k === '10' && kind === 'requirement' ? { difficulty: null } : {}) });
    });
  }
  items.criteria[c.id] = { dimension: d.id, w: c.w, core: (R.target.perceptualCore || []).includes(c.id), items: out };
}
const manifest = { $schema: 'pelican-bay-evidence-manifest/1', rubricVersion: R.meta.version, note: '每个 criterion 与门槛必须由构建流水线产出的证据文件（从 evidence 字段解析）以及测量中点名的工具。tools/score.mjs 在每轮结束时断言这些路径存在；tools/coverage.mjs 断言每个工具在 R1 之前存在。', criteria: {}, gates: {} };
for (const d of R.dimensions) for (const c of d.criteria) manifest.criteria[c.id] = { dimension: d.id, evidence: pathsOf(c.evidence), tools: toolsOf(c.measurement) };
for (const g of R.gates) manifest.gates[g.id] = { evidence: pathsOf(g.evidence), tools: toolsOf(g.rule + ' ' + g.measurement) };
const brief = R.creativeBrief ? ['# 创意简报（仅供构建者与导演）', '', `> ${R.creativeBrief.note}`, '', ...R.creativeBrief.items.map(x => `- ${x}`), '', '---', '', '*由 `node docs/rubric/gen-rubric.mjs` 从 `rubric.json` 的 creativeBrief 生成，请勿手改。*', ''].join('\n') : null;

// ---------- markdown
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
const CORE = new Set(R.target.perceptualCore || []);

const L = [];
const p = (...xs) => L.push(...xs);
p(`# ${t(R.meta.title)}`, '');
p(`> 版本 ${R.meta.version} · ${R.meta.date} · ${t(R.meta.author)}。合并的镜头：${R.meta.lenses.map(l => `${l.id}（${t(l.name)}）`).join('、')}。`, '');
if (R.meta.selfAssessmentLabel) p(`> **${t(R.meta.selfAssessmentLabel)}**`, '');
if (R.meta.userUpdates) p('**用户更新（已纳入）**：', '', ...R.meta.userUpdates.map(x => `- ${t(x)}`), '');
p(`> ${t(R.meta.howToUse)}`, '');
p(`**单位与约定**：${t(R.meta.units)}`, '');
const TOC = [
  ['1. 10/10 北极星', '1-1010-北极星'], ['2. 达标线', '2-达标线'], ['3. 评分与聚合', '3-评分与聚合'],
  ['4. 维度与权重一览', '4-维度与权重一览'], ['5. 硬门槛', '5-硬门槛'], ['6. 维度详解', '6-维度详解'],
  ['7. 评估协议', '7-评估协议'], ['8. 定义', '8-定义'], ['9. 风格 C 档案', '9-风格-c-档案'],
  ['10. 细节门槛与细节目录', '10-细节门槛与细节目录'], ['11. phase-0 已知基线（预登记缺陷）', '11-phase-0-已知基线预登记缺陷'],
  ['12. 镜头分歧的裁决', '12-镜头分歧的裁决'], ['13. 对团队设计的反推', '13-对团队设计的反推'],
  ['14. Changelog / rejected findings（变更记录与未采纳的发现）', '14-changelog--rejected-findings变更记录与未采纳的发现'],
];
p('## 目录', '', ...TOC.map(([a, h]) => `- [${a}](#${h})`), '');

p('## 1. 10/10 北极星', '', t(R.northStar), '');

p('## 2. 达标线', '', t(R.target.text), '',
  `| 条件 | 要求 |`, `|---|---|`,
  `| 硬门槛 | 全部通过（${R.gates.map(g => g.id).join('、')}） |`,
  `| 每个维度 | ≥ ${R.target.perDimensionMin.toFixed(1)} |`,
  `| 最终总分 T_final | ≥ ${R.target.totalMin} / 100（T_final = T × min(1, H/9)） |`,
  `| 单个 criterion 底线 | ≥ ${R.target.noCriterionBelow} |`,
  `| 感知核心底线 | ≥ ${R.target.coreFloor}：${R.target.perceptualCore.join('、')} |`,
  `| 真人检查 | ${R.target.humanCheckpoint} 通过（用户意见全部解决） |`,
  `| 有效轮次 | ${R.target.validRound} |`, '');

const S = R.scoring;
p('## 3. 评分与聚合', '',
  `- **分数刻度**：${t(S.scale)}`,
  `- **机器上限**：${t(S.machineCeiling)}`,
  `- **严重度上限**：${t(S.severity)}`,
  `- **solver 不变量**：${t(S.solverInvariants)}`,
  `- **N/A 政策**：${t(S.na)}`,
  `- **criterion 分**：\`${S.criterion}\``,
  `- **维度分**：\`${S.dimension}\``,
  `- **总分**：\`${S.total}\``,
  `- **报告**：${t(S.reporting)}`, '');

p('## 4. 维度与权重一览', '', t(R.meta.weightRationale || ''), '', '| 维度 | 名称 | English | 权重 | criteria | 受哪些门槛封顶 |', '|---|---|---|---:|---:|---|');
for (const d of R.dimensions) p(`| [${d.id}](#${d.id.toLowerCase()}-${slug(d.name)}) | ${esc(d.name)} | ${esc(d.en)} | ${d.weight} | ${d.criteria.length} | ${(capsByDim[d.id] || []).join('、') || '—'} |`);
p(`| | **合计** | | **${R.dimensions.reduce((s, d) => s + d.weight, 0)}** | **${R.dimensions.reduce((s, d) => s + d.criteria.length, 0)}** | |`, '');
p('标 ★ 的 criterion 属于感知核心集（target.perceptualCore）：其平均分 H 进入总分乘数，且单项不得低于 ' + R.target.coreFloor + '。', '');

p('## 5. 硬门槛', '', '任一门槛失败即按"上限"封顶（多个门槛失败时取最低上限）；门槛是底线，对应 criterion 的 8/10 分锚点要求更高。', '',
  '| 门槛 | 名称 | 规则 | 失败时上限 | 测量 / 证据 |', '|---|---|---|---|---|');
for (const g of R.gates) p(`| **${g.id}** | ${esc(g.name)} | ${esc(g.rule)} | ${esc(capText(g))} | ${esc(g.measurement)}<br>证据：${esc(g.evidence)} |`);
p('');

p('## 6. 维度详解', '');
for (const d of R.dimensions) {
  const ws = d.criteria.reduce((s, c) => s + c.w, 0);
  p(`### ${d.id} ${t(d.name)}`, '', `*${t(d.en)}* · **权重 ${d.weight}** · 来源镜头：${d.sources.join('、')}`, '', t(d.intent), '');
  for (const c of d.criteria) {
    const eff = (d.weight * c.w / ws).toFixed(2);
    p(`#### ${c.id} ${t(c.name)}${CORE.has(c.id) ? ' ★' : ''}`, '', `维度内权重 ${c.w}（占本维度 ${Math.round(100 * c.w / ws)}%，折合总分 ${eff} 分）· 测量方式：${c.type.map(t => TYPE[t]).join(' + ')}`, '');
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
p('### 7.6 各维度评审分配', '', '每个维度的 J-lens 评审各自独立判定原子条目，criterion 分按第 3 节机械聚合；下表"其他评审"是该维度专用的盲评、对抗或测试者。', '',
  '| 维度 | J-lens 人数 | 其他评审 | 证据包（渲染集） |', '|---|---:|---|---|',
  ...P.judgeAllocation.map(a => `| ${a.dimension} | ${a.lensJudges} | ${esc(a.extra)} | ${a.bundle.join('、') || '脚本输出 + 代码'} |`), '');
p('### 7.7 轮次', '', '| 轮次 | 名称 | 时机 | 范围 |', '|---|---|---|---|', ...P.rounds.map(r => `| ${r.id} | ${esc(r.name)} | ${esc(r.when)} | ${esc(r.scope)} |`), '');
p('### 7.8 防分数通胀', '', ...P.antiInflation.map((x, i) => `${i + 1}. ${t(x)}`), '');
p('### 7.9 输出与预算', '', `- **输出**：${t(P.outputs)}`, `- **预算**：${t(P.budget)}`, '');

const DF = R.definitions;
p('## 8. 定义', '');
for (const k of ['canon14', 'fieldMarks']) {
  const D = DF[k];
  p(`**${D.id}** — ${t(D.text)}`, '', ...D.items.map((x, i) => `${i + 1}. ${t(x)}`), '');
}
const DEFN = { hero: 'hero 帧', notext: '去文字 / 去符号', sampling: '抽样种子', renderTuple: '纯渲染输入', pixel: '像素判定', detailItem: '细节条目', handWritten: '手写', visibleAffordance: '可见交互入口', symbolicOverlay: '符号化叠加', loop: '故事循环', dedupe: '去重表', tod: '时段', cadence: '踏频' };
for (const [k, name] of Object.entries(DEFN)) if (DF[k]) p(`**${name}**：${t(DF[k])}`, '');
if (DF.severity) p('**严重度示例**：', '', ...Object.entries(DF.severity).map(([k, xs]) => `- ${k}：${xs.map(t).join('；')}`), '');

const SC = R.styleProfiles?.C;
p('## 9. 风格 C 档案', '');
if (SC) {
  p(`**${t(SC.name)}**（由${t(SC.chosenBy)}选定）。风格圣经：\`${SC.bible}\`；参考：${t(SC.reference)}。`, '',
    '**锁定的文件（sha256）**：', '', '| 文件 | sha256 |', '|---|---|', ...Object.entries(SC.lock).map(([f, h]) => `| \`${f}\` | \`${h}\` |`), '',
    '**墨组（golden）**：' + Object.entries(SC.inks.golden).map(([k, v]) => `${k} \`${v}\``).join('、') + '。' + t(SC.inks.note), '',
    '**风格规则**：', '', ...SC.rules.map((x, i) => `${i + 1}. ${t(x)}`), '',
    '**角色修正（STYLE-C §3）**：', '', ...SC.characterCorrections.map((x, i) => `${i + 1}. ${t(x)}`), '',
    '**锚点重释**：', '', '| 锚点条目 | 处理 | 说明 |', '|---|---|---|', ...SC.anchorReinterpretation.map(a => `| ${esc(a.item)} | ${a.mode} | ${esc(a.text)} |`), '',
    '**预算**：', '', ...Object.entries(SC.budgets).map(([k, v]) => `- ${k}：${t(v)}`), '',
    `**地平线**：${t(SC.horizon)}`, '');
}

const DT = R.detail;
p('## 10. 细节门槛与细节目录', '');
if (DT) {
  p(`门槛 **${DT.gate}**。用户原话："${t(DT.userQuote)}"。草稿基线文件：\`${DT.baselineFile}\`。`, '',
    '| 层 | 草稿基线 | 门槛（×） | 门槛条数 |', '|---|---:|---:|---:|',
    ...DT.layers.map(l => { const n = DT.baselineCounts[l]; const x = l === 'pelican' || l === 'bike' ? 2.0 : 1.5; return `| ${l} | ${n} | ${l === 'fx' ? '—' : x.toFixed(1)} | ${l === 'fx' ? '≥4' : '≥' + Math.ceil(n * x)} |`; }),
    `| **合计** | **${DT.baselineCounts.all}** | **2.5** | **≥${Math.ceil(DT.baselineCounts.all * 2.5)}** |`, '',
    `- **清单工具**：${t(DT.inventoryTool)}`, `- **3× 放大覆盖**：${t(DT.zoomCoverage)}`, `- **评审协议**：${t(DT.judgeProtocol)}`, `- **预算规则**：${t(DT.budgetRule)}`, '',
    '**细节目录**（用户点名的项目，按层；C13.2–C13.5 逐项核对）：', '', ...Object.entries(DT.catalogue).map(([l, xs]) => `- **${l}**：${xs.map(t).join('；')}`), '');
}

p('## 11. phase-0 已知基线（预登记缺陷）', '', 'R0 轮中先重新核实下列每一项；标为 resolved-before-R0 的不计入工具敏感度，其余每个可自动检出的缺陷都必须被对应工具检出，否则该工具视为空转。', '',
  '| 编号 | 缺陷 | 来源 | 影响 |', '|---|---|---|---|', ...R.baseline.knownDefects.map(b => `| ${b.id} | ${esc(b.text)} | ${esc(b.source)} | ${b.affects.join('、')} |`), '');

p('## 12. 镜头分歧的裁决', '', ...R.reconciled.map(x => `- ${t(x)}`), '');

const I = R.implications;
const tiers = {};
for (const x of I.tools) { const m = /^(T\d):\s*(.*)$/.exec(x); (tiers[m ? m[1] : '—'] ||= []).push(m ? m[2] : x); }
const TIERN = { T0: 'T0（构建前必需）', T1: 'T1（R1 前）', T2: 'T2（只为 10 分额外项）' };
p('## 13. 对团队设计的反推', '', t(I.intro), '', '### 13.1 构建开工前必须冻结的契约变更', '', ...I.contractChangesBeforeBuild.map((x, i) => `${i + 1}. ${t(x)}`), '',
  '### 13.2 rubric 隐含要求的角色', '', ...I.roles.map(x => `- ${t(x)}`), '',
  '### 13.3 必须先于构建存在的评估工具（分级）', '', ...Object.entries(tiers).map(([k, xs]) => `- **${TIERN[k] || k}**：${xs.map(x => `\`${x}\``).join(' · ')}`), '',
  `创意简报（不给维度评审）：\`docs/rubric/creative-brief.md\`；原子条目：\`docs/rubric/items.json\`；证据清单：\`docs/rubric/evidence-manifest.json\`。`, '');

const CL = R.changelog;
p('## 14. Changelog / rejected findings（变更记录与未采纳的发现）', '');
if (CL) {
  p(`**v${CL.version}** 相对 v1.0.0 的主要变更：`, '', ...CL.summary.map(x => `- ${t(x)}`), '',
    '红队发现编号：RT1-xx = Goodhart 攻击者（第 1 份报告，按原顺序 1–40），RT2-xx = 缺口与歧义猎手（第 2 份报告，1–40）。', '',
    `### 14.1 已采纳（${CL.accepted.length}）`, '', '| 发现 | 问题 | 落实到 |', '|---|---|---|', ...CL.accepted.map(([id, a, b]) => `| ${id} | ${esc(a)} | ${esc(b)} |`), '',
    `### 14.2 部分采纳 / 未采纳的部分及理由（${CL.partial.length}）`, '', '| 发现 | 未采纳的部分 | 理由与替代做法 |', '|---|---|---|', ...CL.partial.map(([id, a, b]) => `| ${id} | ${esc(a)} | ${esc(b)} |`), '',
    `### 14.3 完全未采纳（${CL.rejected.length}）`, '', CL.rejected.length ? CL.rejected.map(([id, a, b]) => `- ${id}：${t(a)}——${t(b)}`).join('\n') : '无。两份报告的每一条发现都至少部分采纳；被拒绝的具体部分及理由见 14.2。', '');
}
p('---', '', `*由 \`node docs/rubric/gen-rubric.mjs\` 从 \`rubric.json\` 生成，请勿手改。*`, '');

function slug(s) { return s.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-'); }

const outputs = [
  ['RUBRIC.md', L.join('\n')],
  ['docs/rubric/items.json', JSON.stringify(items, null, 2) + '\n'],
  ['docs/rubric/evidence-manifest.json', JSON.stringify(manifest, null, 2) + '\n'],
  ...(brief ? [['docs/rubric/creative-brief.md', brief]] : []),
];
if (process.argv.includes('--check')) {
  const stale = outputs.filter(([f, s]) => !existsSync(resolve(ROOT, f)) || readFileSync(resolve(ROOT, f), 'utf8') !== s).map(([f]) => f);
  if (stale.length) { console.error(`stale: ${stale.join(', ')}; run node docs/rubric/gen-rubric.mjs`); process.exit(1); }
  console.log('rubric.json valid; generated files up to date');
} else {
  for (const [f, s] of outputs) writeFileSync(resolve(ROOT, f), s);
  const nItems = Object.values(items.criteria).reduce((s, c) => s + c.items.length, 0);
  console.log(`rubric.json valid (${R.dimensions.length} dimensions, ${critIds.size} criteria, ${R.gates.length} gates, ${nItems} anchor items); wrote ${outputs.map(o => o[0]).join(', ')} (RUBRIC.md ${outputs[0][1].length} chars)`);
}
