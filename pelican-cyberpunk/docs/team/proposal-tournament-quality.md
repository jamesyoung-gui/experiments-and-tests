# 团队方案 · 锦标赛质量路线（tournament-quality）

> 设计角度：**用竞争换质量。** 对权重最高、最主观、方差最大的部分做 best-of-N 锦标赛（多名参赛者互不可见地各自完成同一个契约化的部件，按 rubric 自身的感知协议盲评，胜者嫁接进主干，败者的最佳元素按清单"收割"）；对**每一个 ≥9 的分数**（无论出现在锦标赛小计分卡、修复轮还是 R-final）派对抗评审 + 验证者复核。用户的硬性要求"我需要你最终教（交）出来的版本细节比 draft 多很多"由一个专门的**细节密度组**负责：细节规划、逐层细节美术、每个区域一场"细节对决"（细节是可叠加的，所以对决的结果是"胜者 + 败者中不冲突的独有条目"的并集）、独立的细节登记员与反刷量审计员。
>
> 输入：`RUBRIC.md` / `rubric.json` v2.0.0（13 个维度，79 个 criterion，18 个门槛）、`CONTRACT.md`、`docs/rig-spec.md`、`docs/STYLE-C.md`（用户已选风格 C）、`docs/rubric/detail-baseline-C.json`（草稿 129 条）、phase-0 脚手架（`src/`、`tools/`）、`docs/team/wf-build.v0.js`。
> 本文件的所有分数预期都是**同模型自评（same-model self-assessment）**：评审与构建者是同一模型家族的 Claude 子代理，唯一的真人评审是用户（G16）。

---

## 0. 一页摘要

| 项 | 本方案 |
|---|---|
| 核心机制 | 10 场锦标赛（TR1–TR10）+ 7 场细节对决（TR7a–g）+ 修复轮中的"挑战者对决"+ 对所有 ≥9 分的 Red Court 复核 |
| 为什么是这 10 场 | 按"锦标赛价值指数" TVI = 总分权重 × 主观度 × 预期方差 × 可嫁接性 排序选出（§2），覆盖约 38 分的总分权重，其中 13 项感知核心 criterion 中的 11 项 |
| 与 v0 的主要差别 | v0 是 11 名构建者各做一次 + 6 镜头评审 + 2 轮修复；本方案把最主观的部件改为 3 选 1、把评审改为 rubric 原子条目 + 盲评强制选择、加入 R0 工具有效性、细节密度组、修复轮按"可回收分数"排序、R-final 用全新评审 |
| 构建角色 | 约 70 个不同角色：26 名模块构建者、10 名细节美术、10+7 名锦标赛参赛者（部分胜者转正为构建者）、9 名工具匠、约 20 类评审 |
| 代理调用 | 约 520 次（含每轮全新评审；token 不受限，墙钟优先） |
| 并发 | 最多 4 个 workflow 同时运行（每个约 2 个代理），Chromium 统一经 `/tmp/pb-cpu.lock` 排队，perf/soak 独占 |
| 墙钟 | 约 36–45 小时（§7 甘特图），关键路径：契约冻结 → TR1/TR2 → 骑者构建 → 细节对决 → R1 → 修复 → R-final |
| 停止条件 | 达标线（全部门槛含 G-DETAIL 与 G16、每维 ≥9.0、T_final ≥92、单项 ≥7、感知核心 ≥8）或修复轮用满 3 轮；锦标赛各有自己的停止规则（§3.4） |
| 细节目标 | 内部目标比 10 分档再加 15% 余量：登记 ≥520 条、去重后 ≥452（3.5×）、每层 ≥2.0×；zoom-coverage 鹈鹕 ≥97%、自行车 ≥95%（§5） |

---

## 1. 设计原则（从 rubric 反推）

1. **rubric 即赛制。** 锦标赛不另发明"好不好看"的评判：每场比赛都用 rubric 中该部件对应 criterion 的**原协议的缩小版**（同样的去文字、隔离证据包、强制选择、植入缺陷校准、原子条目 + `tools/score.mjs` 机械聚合）。这样选出来的胜者就是在 R-final 中最可能得分的那个，而不是评审最喜欢的那个。
2. **先门槛、后审美。** 参赛作品先跑脚本门槛（check-style、check-anchors、check-contacts、perf 片段）；任何门槛失败直接淘汰，不进入盲评。审美偏好绝不能压过 STYLE-C 与 CANON-14。
3. **契约化的可替换部件。** 所有参赛作品实现同一个模块接口（`build(ctx)` / `attach(svg, ctx)` / `detail(slot, ctx)`），放在各自的候选目录里，由 `?variant=<tourney>:<entry>` 在同一个运行时里渲染。嫁接就是把胜者文件移到正式路径，不需要人工改写。
4. **多样性是强制的。** 同一模型家族的参赛者容易产出相似作品。每名参赛者拿到不同的**设计种子**（例如"忠实精修草稿" / "更大胆的 deco 几何化" / "博物画式的准确"），第一轮看不到彼此的作品；评审盲评时文件名与左右随机。
5. **竞争只用在值得的地方。** 机械正确性（CANON、运动学、构建、a11y）由单一负责人 + 脚本门槛保证，竞争不会让它更对，只会增加合并冲突。竞争用在主观、高权重、高方差、可嫁接的部件上（§2）。
6. **每个 ≥9 都要经得起攻击。** rubric 规定 median ≥9 的 criterion 要经对抗复核；本方案把它扩展到锦标赛的小计分卡与每个修复轮：任何 ≥9 的数字在进入 ledger 之前都要过 Red Court（J-adv 找 ≥5 个缺陷 → J-valid 在重新渲染上核实 → 按严重度封顶）。
7. **细节是一等公民，也是可审计的。** 用户点名要求的细节有自己的规划者、生产者、对决、登记员与审计员；细节条目从第一天起就带 `data-detail` 标注，登记在 `docs/detail/registry.json`，每天由脚本清点；审计员专门找"刷量"（不可见条目、重复条目、1× 下的噪点、违反风格 C）。
8. **构建者永不给自己打分**，评审每轮全新，R-final 评审从未参与过任何轮次（含锦标赛）。

---

## 2. 竞争放在哪里：锦标赛价值指数（TVI）

TVI = 总分权重（rubric.json 折算）× 主观度（1 = 纯脚本，3 = 纯盲评）× 预期方差（同一 brief 下不同代理产出的差异，1–3）× 可嫁接性（能否作为可替换部件，0/1）。

| 部件 | 主要 criterion（总分折算权重） | 主观 | 方差 | 嫁接 | TVI | 决定 |
|---|---|---:|---:|---:|---:|---|
| 鹈鹕头 / 喙 / 喉囊 / 眼 / 冠（角色设计） | C1.3★ 4.28、C4.1★ 2.09、C4.2 1.39、C7.7★ 1.43、C6.2 1.20、C13.2★（头部分）≈0.8 | 3 | 3 | 1 | 最高 | **TR1**：3 选 1 + 可选混合轮 |
| 翼与握把（"翅膀不是袖子"） | C4.4 1.04、G7（羽扇规则）、C7.6★ 的角色修正、C3.1 握把覆盖 | 3 | 3 | 1 | 高 | **TR2**：3 选 1（五份草稿都在这里失败） |
| 角色圣经 + 节拍表（导演） | C6.1★ 1.60、C6.5 1.60、C5.4 1.80、C6.3★ 1.60 | 3 | 3 | 1 | 高 | **TR3**：3 名导演写圣经与节拍，胜者成为导演 |
| 标志性时刻 | C8.1★ 2.88（并且 S_D8 ≤ s_C8.1 + 0.5） | 3 | 3 | 1 | 最高 | **TR4**：3 个概念 → 2 个原型 → 1；亚军转为彩蛋 / encore |
| 开场 3–5 秒 | C7.1★ 1.43、C9.1 0.95 | 3 | 2 | 1 | 中 | **TR5**：导演 vs 1 名挑战者 |
| 手写 pelican-mini.svg | C11.1 3.00 的 8/10 档（对单次对照胜率 ≥60%/≥80%） | 2 | 3 | 1 | 高 | **TR6**：3 名手写者，按 field 协议对单次对照盲评 |
| 各区域细节 | C13.1★ 2.50、C13.2★ 2.08、C13.3 1.67、C13.4 1.67、C13.5 0.83、G-DETAIL | 2 | 3 | 1（可并集） | 最高 | **TR7a–g**：7 场细节对决（RS-detail 的 7 个区域） |
| 6 个时段的墨组 + 海报帧 | C7.2★ 1.43、C7.3 1.43、C11.3 0.50 | 3 | 2 | 1 | 中 | **TR8**：墨组对决（2 选 1）+ 海报淘汰赛（脚本生成 8 个候选帧） |
| 踩踏循环的重量与跟随 | C5.1★ 1.80、C5.2★ 1.80 | 3 | 2 | 参数 | 中 | **TR9**：参数锦标赛（6 组 rig 预设，不需要额外代理） |
| 事件笑点（吞鱼、跳车） | C6.3★ 1.60、C6.4 1.20、C3.4 1.78 | 3 | 2 | 1 | 中 | **TR10**：吞鱼与跳车各 1 场对决（原作者 vs 挑战者） |
| 车架 / 传动 / 运动学 / 接触 | C1.1 4.28、C2.x、C3.1–3.3 | 1 | 1 | — | 低 | 不竞争：单一负责人 + 脚本门槛 + Red Court |
| 烘焙 / 性能 / a11y / 工程 | D10–D12、C11.2 | 1 | 1 | — | 低 | 不竞争 |

**被锦标赛直接覆盖的总分权重 ≈ 38 分**，13 项感知核心 criterion（C1.3、C4.1、C5.1、C5.2、C6.1、C6.3、C7.1、C7.2、C7.6、C7.7、C8.1、C13.1、C13.2）中有 11 项由锦标赛部件决定；另外两项（C7.6 风格保真与 C7.2 统一美术）由 check-style 门槛和墨组对决兜底。T_final = T × min(1, H/9) 使核心集均分直接乘到总分上，这是把竞争集中在这里的理由。

---

## 3. 锦标赛机制（通用赛制）

### 3.1 参赛隔离与可替换部件

- **候选目录**：`src/candidates/<tourney>/<entry>/…`，每名参赛者只拥有自己的目录（与其他所有文件不相交）。
- **变体注册表**：`src/art/variants.js`（LEAD 拥有，phase A 写好）：`?variant=head:B,wing:A` 把对应的 slot owner 换成候选模块；dist 构建只打包已嫁接的正式模块，候选目录不进入 bundle（`tools/build.mjs` 的排除列表 + `check-purity` 中的断言）。
- **需要改运行时钩子的比赛**（TR4 标志性时刻、TR5 开场）：LEAD 在 phase A 提供 `src/moment/registry.js` 与 `src/director/registry.js` 钩子（`{id, schedule(t,state) → active, build(ctx), attach(svg,ctx)}`），参赛者只写自己的模块；实在要改共享文件的原型放进 git worktree（`wt/tr4-<entry>`，分支 `tourney/tr4-<entry>`），胜者再由 GRAFT 代理按接口重写进主干。
- 每名参赛者的截图输出到 `shots/tourney/<tourney>/<entry>/`（不入库）。

### 3.2 参赛者 brief（提纲）

```
COMMON（同 wf-build.v0 的 COMMON，外加）：
- 你在一场锦标赛中与 N−1 名互不可见的参赛者竞争同一个部件。评审是盲评、去文字、随机命名；
  你的作品先跑门槛脚本 <列表>，任何失败直接淘汰。
- 你的设计种子：<seed>。你必须在这个方向上做到极致，而不是向"平均答案"回归。
- 你只能写 src/candidates/<tourney>/<entry>/**；接口见 CONTRACT.md §<n>；用 ?variant=<tourney>:<entry> 预览。
- 自检循环 ≥4 轮：node tools/shoot.mjs --query "variant=…&solo=pelican&notext=1" --set crops,frames …，
  Read 3× 裁图与 RS-cycle24 条带，对照 STYLE-C §2–§3 与本比赛的原子条目清单（附在下面）。
- 交付：模块文件 + candidates/<tourney>/<entry>/NOTES.md（设计理由、已知问题、你认为自己在哪些原子条目上会赢）。
```

### 3.3 评审流程（每场）

1. **门槛**（脚本，分钟级）：check-style（七墨、骑者身上无大面积网点、远侧 B/N、0 filter）、check-anchors / check-contacts（对应 slot）、perf 片段（该部件的 JS ms 与节点增量）、`tools/tourney/graft-check.mjs --dry`（接口一致）。失败 → 淘汰（或允许 1 次 30 分钟的修复重交）。
2. **证据包**：`tools/tourney/pack.mjs` 调 `tools/judge/pack.mjs`：同构图、同时段、同曲柄相位、去文字、随机文件名、随机左右；包内混入 1 个**诱饵**（草稿 C 的同部件裁图，或一个 ?mutant= 降级版本）与 1–2 个植入缺陷图（RS-canary）。
3. **盲评**（J-blind ×5，全新、无项目上下文）：执行该部件对应 criterion 的感知协议（例如 TR1：开放式物种识别 → 3 选 1 骑者设计 → "你会删掉什么？"）。
4. **原子条目评审**（J-lens ×1–2）：只拿该部件相关的 `docs/rubric/items.json` 条目，逐条 pass/fail 并引证；`tools/score.mjs --subset` 算出"投影分"（projected score）。
5. **聚合**：`tools/tourney/bt.mjs` 对强制选择数据做 Bradley–Terry 拟合 + 按评审聚类的 bootstrap；总排名 = 投影分（按 criterion 权重折成总分点数）为主，BT 偏好在投影分相差 <0.3 总分点时决胜。召回植入缺陷 <80% 或没能压低诱饵的评审作废并补人。
6. **Red Court**：胜者任何投影分 ≥9 的 criterion → J-adv（"找出至少 5 个缺陷"）+ J-valid；被验证的缺陷按严重度封顶（blocker → 6，major → 8），并写进胜者的修复清单。
7. **收割（harvest）**：评审在每个败者作品中点名 ≤3 个"应当保留"的元素；GRAFT 代理只收割满足三条的元素：不违反 STYLE-C、不与胜者的设计语言冲突（一个 J-valid 判定）、有明确的独立文件或函数可移植。收割记录写入 `docs/team/ledger.json`（来源、提交、评审原话）。
8. **嫁接**：GRAFT 代理（TS-tourney 兼任）把胜者移到正式路径，跑 `tools/tourney/graft-check.mjs`：在比赛证据包的全部帧上，嫁接后渲染与候选渲染的像素差 ≤0.5%，并且全套门槛通过。

### 3.4 停止规则（每场）

- **直接定胜**：胜者投影分在目标 criterion 上 ≥9，且对每个其他参赛者的 BT 胜率 ≥70%、对诱饵 ≥80%。
- **混合轮**（最多 1 次）：否则前两名拿到评审意见与败者的收割清单，各自再做 60–90 分钟，重新评审（新评审）。
- **兜底**：混合轮之后仍 <9，就接受当前胜者，把差距写进 `docs/team/gaps.json`，作为修复轮的最高优先项。
- **墙钟上限**：每场比赛（含混合轮）≤5 小时；超时按当前排名定胜。

### 3.5 为什么锦标赛不会把 R-final 刷高（防过拟合）

- 锦标赛用的相位、种子和构图与 R1 / R-final 不同；R-final 另有 R0 预登记的密封留出集和野卡包（RS-wild）。
- 锦标赛评审与任何 R 轮评审都不是同一次调用，且 R-final 评审"从未参与过任何轮次"。
- 锦标赛分数**只用于选择**，不进入 scorecard；对外只报告 R-final。

---

## 4. 十场锦标赛的具体规格

### TR1 · 鹈鹕头部角色设计（3 选 1）

- **部件**：slot `head`、`eye`、`crest`、`billUpper`、`billLower`、`pouch`（契约中从 `pelican-body` 拆出，新 owner `PEL-HEAD`）。另交一张"静止剪影"：参赛者可以对 `body` 的轮廓提一个比例建议（写在 NOTES.md，不改文件），由 PEL-BODY 在嫁接后吸收。
- **设计种子**：A "忠实精修草稿 C（保留草稿的桃色长喙、琥珀喉囊、白冠，去掉凶眼线）"；B "更强的 deco 几何化：喙与喉囊用少量大弧，印刷感最强"；C "博物画式准确：Pelecanus onocrotalus 的面部裸皮形状、额羽尖、喉囊下缘在喉部的真实走向"。
- **门槛**：check-style；CANON #7/#8（nail 与喉囊可见）；check-anatomy 头部项；pouch 在 sy ∈ {0.9, 1.2, 1.45} 下无撕裂；眼睛 blink 用 sy 时无穿帮。
- **盲评**：C1.3 协议（notext 256/128/64 px、剪影、遮头剪影、诱饵 nopouch/stork）+ C4.1 协议（开放式物种 ID，是否说出"白鹈鹕"）+ C7.7 协议（3 选 1：三名参赛者的头 + 草稿头作诱饵，第四张）+ 表情读数（"这只鸟的情绪是？"开放式，任何"凶 / 生气"判为 major）。
- **原子条目**：C4.2、C4.1（FM-10 按风格 C 重释）、C13.2 的头部 4 项、C7.6 角色修正 1–2。
- **胜者**：成为 `PEL-HEAD`（继续拥有 `src/art/pelican-head.js`）；两名败者结束。收割：典型的是败者的冠羽形状、喉囊纹理走向或眼部高光。

### TR2 · 翼与握把（3 选 1）

- **部件**：`wingNear*`、`wingFar*` 六个 slot（新 owner `PEL-WING`，从 `pelican-limbs` 拆出；腿给 `PEL-LEGS`）。
- **设计种子**：A "折叠翼的层级：覆羽基部 → 次级飞羽流苏 → 初级飞羽后扫"；B "强剪影：翼作为一个大的 deco 形体，羽扇只在腕部展开"；C "解剖优先：腕关节位置、小翼羽、初级飞羽绕握把 4–5 枚分开的尖"。
- **门槛**：G7 的羽扇规则（≥4 枚分开的初级飞羽尖、没有指节状分段）；wrist—grip ≤0.75 u（check-anchors）；握把覆盖 ≥60%（check-contacts）；挥手事件 ev-wave 渲染无撕裂；远侧翼平涂 B/N。
- **盲评**：5 名 J-blind："这是翅膀还是手臂？"强制二选一（草稿 C 的袖子式翼作诱饵，预期被判"手臂"）+ 3 选 1 + 找缺陷（肩部缝隙）。
- **原子条目**：C4.4 全部、C3.1 的握把部分、C7.6 角色修正 3、C13.2 飞羽项。

### TR3 · 角色圣经与节拍表（导演选拔，3 选 1）

- **产物**：`docs/candidates/tr3-<entry>/{character.md, timing.md, beats.md}`：名字、年龄、三个形容词（禁用 6 个通用卡通默认词）、它想要什么、它怎么骑车、24 s 故事循环的 ≤5 个节拍、每个事件的 60 fps X-sheet、情境反应表（before/peak/after）。
- **评审**：此时还没有动画，所以分两步：(a) 立即评：3 名 J-lens 按 C6.1 / C6.5 / C5.4 的原子条目评文档的"可执行性与可追溯性"，外加 1 名 J-adv 找矛盾（例如"端庄"的鸟却乱扑腾）；(b) 延迟验证：胜者的圣经在 R1 的 15 选 3 形容词测试中被验证，失败则修复轮中重写。
- **胜者**：成为 `DIR`（导演），拥有 `docs/character.md`、`docs/timing.md`、`docs/beats.md`、`docs/composition.md` 与 `src/director/**`；导演还负责 TR5 的一名参赛作品。败者之一成为 **TR10 的挑战者**（他已经写过一套不同的事件节拍）。

### TR4 · 标志性时刻（3 概念 → 2 原型 → 1）

- 权重最高的主观项（C8.1 2.88 分，且 D8 被 s_C8.1 + 0.5 封顶），值得最重的赛制。
- **第一阶段（概念，60 分钟）**：3 名参赛者各交一页概念 + 3 张静态分镜（`docs/candidates/tr4-<entry>/concept.md`）。约束：定制、不显然、切题；在默认体验中 60 s 内无输入出现；≥55 fps；不能照搬 `docs/rubric/creative-brief.md` 中的示例；必须"揭示作品的架构或故事"（10 分档）。3 名 J-blind 对概念分镜做开放式"你会告诉朋友哪一个？"+ 强制排序，淘汰 1 个。
- **第二阶段（原型，3–4 小时）**：2 名入围者在 `src/moment/<entry>.js`（经 moment 钩子）做出可运行原型。门槛：eggs.mjs 在 4 种上下文（idle、跳车中、tod 0.93、390×844）下 0 错误、fps ≥55。3 名 J-blind 看 preview 联系表 + 密集帧，按 C8.1 协议开放式回忆 + "你以前见过这种效果吗？"。
- **胜者** 成为 `MOMENT`；**亚军**不丢弃：转为 `EGGS` 的 encore 时刻 / 彩蛋（C8.1 10 分档要求的"另一个较小的 encore 时刻"与 C8.3 彩蛋层次）。

### TR5 · 开场 3–5 秒（2 选 1）

- 参赛者：`DIR` vs 1 名挑战者（`src/director/intro.<entry>.js`，经 director 钩子）。
- **门槛**：first-look.mjs（4× CPU 节流下首帧 ≤500 ms、100 ms 截图已在墨组内、标题卡不遮骑者、任意按键 1 帧内跳过、回放像素一致）。
- **盲评**：C7.1 协议（5 名 J-blind，3 s 条带强制选择，对照为草稿同构图静帧版本与匹配投入基线的开场）+ "开场 1.5 s 内你注意到了什么？"（10 分档的钩子节拍）。

### TR6 · 手写 pelican-mini.svg（3 选 1）

- C11.1（3.00 分）的 8/10 档要求 ≤16 KB、SMIL 动画、通过 CANON-14，并在同等条件盲评中对"同模型单次对照"胜率 ≥60%/≥80%。这就是原始的鹈鹕基准，值得 3 名手写者。
- 参赛者：3 名 `MINI-<entry>`，只能手写（按 definitions.handWritten；转录哈希记入 ledger），各有设计种子（"海报剪影"、"机械精确"、"表演性"）。
- **门槛**：≤16 KB、G5 的结构检查、check-benchmark（CANON-14 via data-anchor）、作为 `<img>` 会动。
- **盲评**：field.mjs 的静帧组与条带组，对第 1 层单次对照做同等条件配对（每名评审 ≥8 对），另 3 名 J-blind 逐项回答 CANON-14。
- 胜者文件成为 `src/mini/pelican-mini.svg`（BAKER 负责拷到 dist 与 `<noscript>`）。

### TR7a–g · 细节对决（每个区域 2 选 1 + 并集）

见 §5.4。7 个区域 = RS-detail 的 7 个区域：鹈鹕头颈、鹈鹕身翼腿、车架传动、车把车筐、海与港、陆与路、天与版式。

### TR8 · 墨组对决 + 海报淘汰赛

- **墨组**：`SKY`（拥有 `src/core/palette.js`）vs 1 名挑战者，各交 6 个时段的完整 7 墨组（`src/candidates/tr8/<entry>/ink-sets.js`），约束为 styleProfiles.C 的相对色彩约束（喉囊 O 是鸟身上 C* 最高；P 与相邻背景 ΔL* ≥25；O 与 K ΔL* ≥8；夜间是"夜间海报"而非暗化的白天）。门槛：check-anatomy 颜色项 × 6 时段、check-style、contrast。盲评：6 时段 × 2 套的色板条 + 同构图帧，"哪一套更像限色印刷的海报？"与"哪一张夜景是夜间海报？"。胜者墨组在 R0 之后冻结为 `docs/eval/ink-sets.json`（rubric 规定此后只能改色值，不能加墨）——所以 TR8 必须在 R0 之前完成（§7）。
- **海报淘汰赛**（C11.3）：PKG 用脚本从故事循环中挑 8 个候选帧（节拍峰值 × 时段），3 名 J-blind 单淘汰赛选 `dist/poster.png`。

### TR9 · 踩踏重量与跟随的参数锦标赛

- `RIG-LOCO` 暴露 6 组预设（`src/rig/presets.js`：骨盆下沉幅度与相位、躯干俯仰、头部稳定比、喉囊 / 冠 / 尾 / 围巾的弹簧频率与阻尼、ankling 幅度），全部必须通过 G3 / G10。
- 3 名 J-blind 按 C5.1 协议对 40/60/90 rpm 的 nofx 密集帧做"按速度排序"与"哪一个更有重量？"；另 1 名看 RS-onion 洋葱皮判 C5.2 的滞后与拖曳。胜出预设成为默认。无需额外构建代理，是最便宜的一场。

### TR10 · 事件笑点对决（吞鱼、跳车）

- 原作者 `RIG-ACT` vs TR3 的败者之一（已有一套不同的事件节拍），各在 `src/candidates/tr10/<entry>/events.<event>.js` 实现同一事件。
- 门槛：check-rig --events、motion-audit（无跳变）、C3.4 的物理参考（跳车抛物线、两轮先后离地、空中曲柄行为）。
- 盲评：C6.3 协议（5 名 J-blind，nofx 密集帧无字幕描述 + 4 选 1），吞鱼另加 ORN 视角的 C6.4 原子条目（头后仰、喙张开、鱼的转移、颈部隆起沿颈下行）。

---

## 5. 细节密度组（G-DETAIL / D13，用户硬性要求）

> 用户原话："我需要你最终教出来的版本细节比 draft 多很多"。rubric 的 8 分档是 2.5×，10 分档是 3.5×；本方案以 10 分档为最低内部目标，并留 15% 去重余量。

### 5.1 目标表（内部目标 = 10 分档 + 余量）

| 层 | 草稿基线 | 门槛（G-DETAIL） | 10 分档 | **内部目标（去重后）** | **登记目标（去重前）** | 生产者 |
|---|---:|---:|---:|---:|---:|---|
| pelican | 27 | ≥54 | ≥54（2.0×）且总数 3.5× | **90**（3.3×） | 104 | DA-PLUME、DA-FACE、DA-LEGS |
| bike | 42 | ≥84 | ≥84 | **140**（3.3×） | 160 | DA-HW、DA-CARGO |
| sea | 9 | ≥14 | ≥18 | **45**（5.0×） | 52 | DA-SEA（海与港） |
| land | 30 | ≥45 | ≥60 | **110**（3.7×） | 126 | DA-LAND |
| sky | 10 | ≥15 | ≥20 | **35**（3.5×） | 40 | DA-SKY |
| fx | 1 | ≥4 | ≥6 | **12** | 14 | DA-FX |
| typography_frame | 10 | ≥15 | ≥20 | **40**（4.0×） | 46 | DA-TYPE |
| **合计** | **129** | **≥323** | **≥452** | **472（3.66×）** | **≥540** | |

另外：zoom-coverage 鹈鹕 ≥97%、自行车 ≥95%，不存在连续 ≥4 个空白格；感知清单倍数（J-detail 盲清点）≥3.0；7 个区域并排比较 7/7 "更多且更好"。

### 5.2 细节规划（phase A，先于任何美术）

- **DETAIL-PLAN**（1 名代理）读草稿 C 的 `gen.mjs`、`keyframe.png`、`closeup.png`、`detail-baseline-C.json` 与 rubric §10 细节目录，写：
  - `docs/detail/plan.md`：每层的细节条目计划（≥540 条，每条：`<layer>:<O|T>:<name>`、所属 slot 或 layer、所属 owner、预期在 1× 还是 3× 可见、对应草稿条目或"新增"、制作方式：静态合并路径 / `<use>` 复用 / 种子化生成 / 随 slot 变形）；
  - `docs/detail/regions.json`：7 个 RS-detail 区域的世界坐标裁切框（草稿与成品共用；草稿 keyframe 与成品 renderAt 的坐标映射由 `tools/detail/draft-crop.mjs` 实现）；
  - 深度分级规则（STYLE-C §4：远层大形 + 少量网点，近层简洁剪影，前景只有低矮灌木 / 草）与每层的"细节预算"（path 数、gzip 字节）。
- 计划由 LEAD 与 PERF-ARCH 审阅（预算是否可行），DV-AUDIT 审阅（条目是否会被判为重复或不可见），然后冻结为 v1（之后可以加条目，不能删计划中已交付的条目来凑预算）。

### 5.3 生产者：10 名细节美术（DA）

细节与基础形体分文件，既保证文件不相交，也让细节对决可以替换：

| ID | 拥有文件 | 负责条目（摘自 rubric 细节目录） | 特别约束 |
|---|---|---|---|
| DA-PLUME | `src/art/detail/plumage.js` | 分层覆羽（≥3 排扇贝边、向尾部叠压、`data-tract`）、≥8 枚可数初级飞羽、带 P 细边的次级飞羽、冠羽丝 ≥7 缕、颈部羽流线、尾羽 ≥5 枚、"裤管"羽缘 | 身体仍是实心纸白（STYLE-C §2）；颈部细节是一个参数化的笔画配方 `neckStrokes(neckParams)`，由 PEL-BODY 的 `neckD` 调用（变形件上的细节归变形的 owner 执行） |
| DA-FACE | `src/art/detail/head.js` | 喙脊（culmen）与喙缘线、nail 高光与下钩、喉囊纹理线（随 sy 拉伸）、眼周裸皮形状、眼睑、高光 | 表情必须保持"满足、不凶"；喉囊纹理在 sy 极值下无撕裂 |
| DA-LEGS | `src/art/detail/legs.js`、`src/art/detail/scarf.js` | 跗跖鳞线（≥4 道横向）、趾节、蹼褶、爪；围巾条纹、织纹、流苏 | 远侧腿的细节只用 B/N 平涂线 |
| DA-HW | `src/art/detail/bike-hw.js` | 接头与五通壳 / 头碗、线管 + 线缆 + 线扣、条帽与轮圈孔、气门帽、链片 / 销 / 滚子、座弹簧 + 铆钉 + 座弓 + 座夹、踏板笼与反光片、刹车夹器与刹把、挡泥板撑杆螺丝、胎纹与胎侧、车头徽标 | 旋转件上的周期细节必须通过 wagon.mjs（不能制造倒闪），>45 rpm 按规格淡出 |
| DA-CARGO | `src/art/detail/cargo.js` | 上下交错的编织车筐（筐沿、筐底）、鱼（鳞纹、鳍、鳃盖、眼，至少 2 种鱼）、车铃穹顶与拨杆、车灯镜片与支架 | 夜间车灯处细节仍可读 |
| DA-SEA | `src/world/detail/sea.js`、`src/world/detail/harbour.js` | ≥3 条海带与浪纹、泡沫线、日 / 月光路、栈桥与桩、礁石与拍岸浪、编号浮标、带索具（支索、帆脚索、旗）的帆船、渔船 / 汽船、港镇（窗、屋顶、烟囱、钟楼）、灯塔与看守人小屋、海堤砌缝 | 按深度分级；`data-size-m` 真实尺度；夜间窗户亮灯 |
| DA-LAND | `src/world/detail/land.js` | 护栏、柱桩、路牌、长椅、邮筒、里程碑、与草稿不同的路灯细部、棕榈 / 龙舌兰 / 罂粟 / 沙丘草、更衣亭与遮阳伞、路面标线与路缘 | 近层简洁剪影；前景至多盖住车轮底部 8%、不盖任何接触区 |
| DA-SKY | `src/world/detail/sky.js` | ≥3 条云带或云型、缓慢旋转的光芒、日 / 月盘与光环、远近不同大小的鸟群、夜间星空与星座、风筝或飞机点缀 | 网点只在静态 / 缓动层 |
| DA-TYPE | `src/world/detail/type.js` | 海报边框与内框线、角饰、中文字形正确的题签 / 邮戳（不冒充篆刻）、车票式注记（票号、站名、票根虚线）、标题 inline 与阶梯阴影、套印标记与色标条、小字编号与版次 | 全部是路径、带 `data-text`；电影模式变 letterbox |
| DA-FX | `src/fx/detail.js` | 速度线、按风格绘制的尘土 / 落叶粒子、跳车落地的冲击印版、吞鱼沥水水滴、风带 | fx 是 (t, distance, events) 的纯函数；尊重 reduced motion |

接口（LEAD 在 phase A 写进契约）：

```js
// src/art/detail/<name>.js
export const id = 'detail-plumage';
export function detail(slot, ctx) {            // pure; returns markup appended inside #j-<slot> (joint-local coords)
  return '<path data-detail="pelican:T:covert-row-2" d="…"/>…';
}
export function layers(ctx) {                  // static world detail per layer; merged at build time
  return { 'L-shore': '<g data-detail="land:O:groyne">…</g>' };
}
```

`src/scene.js` 在每个 slot / layer 组里追加 `ctx.detail(slot)` 的输出；基础形体 owner 不需要知道细节文件的内部。

**工程规则（C13.6 的 8/10 档）**：
- 静态细节在构建时由 `tools/merge-static.mjs` 按"条目 × 墨"合并为一个 `<path>`（保留条目根元素的 `data-detail`，所以 dist 上的清单仍然可数），每个静态带 ≤200 个 path 元素；重复元素用 `<use>`；纹理由种子化确定性代码生成（`ctx.rng(salt)`）。
- 骑者带只放必须随动的细节，每个 slot 的细节按墨合并为 ≤7 个 path。
- 细节增量逐层记入 `budgets.json`（gzip 字节、path 数、`<use>` 复用率）。

### 5.4 细节对决（TR7a–g）

对每个区域，一名**主作者**（上表的 DA）与一名**挑战者**（全新代理，拿到同样的计划、同样的基础形体，不同的设计种子：例如"印刷装饰性更强" / "博物与机械更准确"）在各自的变体文件中实现该区域的细节（`src/art/detail/<name>.js` vs `src/candidates/tr7/<region>/B/<name>.js`，经 `?variant=detail-<region>:B` 切换）。

| 区域 | 主作者 | 对决的原子条目与脚本 |
|---|---|---|
| TR7a 鹈鹕头颈 | DA-FACE（+DA-PLUME 的颈与冠） | C13.2 头部项、zoom-coverage（头颈格子）、C4.2 |
| TR7b 鹈鹕身翼腿 | DA-PLUME + DA-LEGS | C13.2 其余项、C4.4–C4.6、变形拉伸无撕裂 |
| TR7c 车架传动 | DA-HW | C13.3 的车架 / 传动项、wagon.mjs、C2.7 |
| TR7d 车把车筐 | DA-CARGO（+DA-HW 的座舱部分） | C13.3 的车筐 / 鱼 / 铃 / 灯项、夜间可读 |
| TR7e 海与港 | DA-SEA | C13.4 sea 组、check-scale、saliency |
| TR7f 陆与路 | DA-LAND | C13.4 land 组、check-scale、前景遮挡 |
| TR7g 天与版式 | DA-SKY + DA-TYPE | C13.4 sky 组、C13.5、check-text、cjk-glyph |

**评审**（每场，全新）：
1. 门槛：check-style、check-detail-budget（该区域细节的 gzip 与 path 增量不超过计划的 110%）、perf 片段（全细节下该区域相关带的光栅与 JS 成本）、wagon（旋转件）、逐帧亮度差闪烁检测。
2. 脚本计数：detail-inventory（去重后条目数、1×/3× 可见性）、zoom-coverage（该区域格子覆盖率与冷格列表）。
3. 3 名 J-blind 按 rubric 的 J-detail 协议缩小版：草稿 / A / B 三张同位置裁图（1× 与 3×，随机顺序、随机命名）先盲清点，再两两比较"哪张细节更多？哪张更好？有没有违反风格或抢骑者戏的细节？"。
4. 胜者 = 在"更好"上胜出且无有效风格违规者；"更多"只作为次要项（防止用噪点赢）。
5. **并集收割**：细节是可叠加的。败者作品中那些 (a) 在去重（64×64 SSIM ≥0.95）后仍是独有条目、(b) 通过 check-style、(c) 不与胜者条目重叠遮挡、(d) 不让该区域的 saliency 比下降超过 0.05 的条目，由胜者作者移植进正式文件（在 ledger 中记录来源）。**这样，一场细节对决的结果通常多于任何一名参赛者单独的产出**——这是本方案在 G-DETAIL 上领先的主要机制。
6. 停止：胜者 + 收割后该区域达到内部目标且 zoom-coverage 无连续 ≥4 个冷格 → 结束；否则进入细节迭代（§5.6）。

### 5.5 细节验证者（与生产者完全分开）

| ID | 角色 | 拥有文件 | 每次运行的输出 |
|---|---|---|---|
| DETAIL-REG | 细节登记员：维护登记表，每次合并后跑清单与覆盖率，给每个 DA 发"冷格工单" | `docs/detail/registry.json`、`docs/eval/detail-*.json`（非轮次副本） | 每层条目数与倍数、未兑现的计划条目、冷格列表（按 slot 归属到 DA）、zoom-coverage 热图 |
| DV-AUDIT | 反刷量审计员（Goodhart auditor）：不产细节、专找作弊 | `docs/detail/audit-<n>.json` | 不可见条目（<2 px² 或遮挡 ≥50%）、SSIM 重复条目、只在检查模式可见却被当作 1× 条目、1× 下的噪点区域（高频能量）、违反 STYLE-C §2/§4 的细节、为预算删掉的已有美术 |
| J-detail ×2 | R1 与 R-final 的正式细节评审（rubric 规定的 2 名，每轮全新） | `docs/eval/judges/detail-*.json` | 感知清单倍数、7 区并排结论 |
| J-regress ×5 | C13.6 的"不损美术"四区域成对盲评（草稿 vs 成品） | `docs/eval/judges/detail-regress-*.json` | 骑者、天空、海、前景四区的胜 / 平 / 负 |
| PERF-GUARD（PERF-ARCH 兼任） | 细节的性能守门 | `perf/detail-*.json` | 全细节下 G9 与 C10.1 的帧率；逐层 gzip 增量 |

### 5.6 细节迭代循环与停止条件

```
for iteration in 1..3 per region:
  DETAIL-REG: detail-inventory + zoom-coverage + check-detail-budget → 冷格工单 + 未兑现条目
  DV-AUDIT:   刷量审计 → 被驳回条目（不计数）
  DA(owner):  处理工单（只在自己的文件内）→ 自检 3× 裁图 vs 草稿同位置裁图
  stop if: 该区域去重后条目 ≥ 内部目标 且 0 个连续 ≥4 冷格 且 覆盖率 ≥ 目标
           且 perf 片段在预算内 且 DV-AUDIT 0 条 major
```

全局停止：7 个区域都满足，且全场 detail-inventory ≥472（去重后）、每层 ≥2.0×、zoom-coverage 鹈鹕 ≥97% / 自行车 ≥95%、G9 在全细节下成立。任何一层在 3 次迭代后仍未达标 → 进入修复轮的高优先队列，由该层 DA 与一名新挑战者再做一次对决。

---

## 6. 代理名单（角色、拥有文件、输入、验收）

> 文件所有权在每个阶段内**互不相交**；阶段之间的交接写在 ledger 中。所有代理共享 COMMON 前言（wf-build.v0 的 COMMON，改为：强制读 STYLE-C.md 与 RUBRIC 中本角色相关的 criterion 原子条目；截图到 `shots/<id>/`；Chromium 经 `/tmp/pb-cpu.lock`；不 commit，由 LEAD 合并）。

### 6.1 负责人与架构（phase A）

| ID | 角色 | 拥有文件 | 输入 | 验收 |
|---|---|---|---|---|
| LEAD | 主会话（不是 workflow 内的代理）：契约、合并火车、用户联络（G16）、发布 | `src/contract.js`、`CONTRACT.md`、`src/main.js`、`src/core/{camera,svg,bus,math,bakekit}.js`、`src/art/variants.js`、`src/moment/registry.js`、`src/director/registry.js`、`tools/build.mjs`、`docs/team/*`、`docs/handoff.md` | rubric §13.1 的 18 项契约变更 | check-contract 通过；BL-02/03/04/05/06/18/20/25 修复；所有钩子（?idmap、?silhouette、?notext、?nofx、?mutant、?variant、?inspect、?nocache、renderAt 元组）可用 |
| PERF-ARCH | 合成层 / 性能架构师：z-band 架构（每带一个 `<svg>` 根在合成层 div 中，只用 transform 移动），rAF 循环（暂停停循环）、调色板写入策略（BL-17）；之后兼任性能守门 | `src/scene.js`（phase A；之后交还 LEAD）、`src/core/bands.js`、`src/core/raf.js`、`src/core/palette-apply.js` | BL-17 实测、C10.1–C10.3 | 在占位美术 + 草稿 C 等量的静态细节（用草稿 keyframe.svg 作负载）下 wide 与 close 都 ≥58 fps（trace，3 次中位数） |
| DETAIL-PLAN | 细节规划（§5.2） | `docs/detail/plan.md`、`docs/detail/regions.json` | 草稿 C、baseline、rubric §10 | ≥540 条计划、每条有 owner 与制作方式；LEAD + PERF-ARCH + DV-AUDIT 签核 |
| CONTRACT-REV | 契约审阅（一次性）：对照 rubric §13.1 与 CONTRACT.md 找漏项 | 无（只读） | 契约草案 | 找出的漏项全部关闭或有理由 |

### 6.2 工具匠（T0 先于构建；T1 与美术并行；T2 只为 10 分额外项）

| ID | 拥有文件（全部在 `tools/` 下） | 验收（R0 工具有效性：已知良好 fixture 通过、mutant 集全部失败、两次结论相同） |
|---|---|---|
| TS-rig | `check-rig.mjs`（扩展 --seat/--biomech/--events）、`motion-audit.mjs`（--fuzz/--face/--plots）、`filmstrip.mjs`（RS-cycle24 真时间 24 帧、--dense）、`onion.mjs`、`check-temporal.mjs`、`mutate-rig.mjs` | 检出 BL-02、BL-08、BL-10、BL-13、BL-16；filmstrip 用 t = t0 + k/24，绝不覆盖 crankDeg |
| TS-geom | `check-anchors.mjs`（含锚点审计）、`check-occlusion.mjs`、`check-contacts.mjs`、`contact-probe.mjs`、`check-benchmark.mjs`、`check-bike.mjs`、`check-kinematics.mjs`、`check-noslip.mjs`、`wagon.mjs`、`check-anatomy.mjs`、`check-scale.mjs` | 检出 BL-03、BL-11、BL-12；RT-mutant 的美术级缺陷全部标红 |
| TS-perf | `perf.mjs`（trace DrawAndSwap、CPU 锁、--paint）、`live-parity.mjs`、`soak.mjs`、`robust.mjs`、`contexts.mjs`、`audit-dist.mjs`、`determinism.mjs`、`vr.mjs`、`xb-audit.mjs`、`xb-webkit.mjs`（T2）、`check-purity.mjs`、`check-detail-budget.mjs` | 检出 BL-17、BL-18；vr 基线入 `test/golden/` |
| TS-ux | `ux-matrix.mjs`、`first-look.mjs`、`interact.mjs`、`keys.mjs`（键盘驱动器：修饰键、IME、聚焦控件守卫）、`a11y.mjs`（固定版本 axe-core）、`contrast.mjs`、`flash-check.mjs`、`i18n-lint.mjs`、`cjk-glyph.mjs`（不用 document.fonts.check，见 BL-30）、`check-text.mjs`、`audio-check.mjs`、`export-check.mjs`、`judge/controls.mjs`、`judge/audio-offline.mjs` | 检出 BL-01、BL-05、BL-06、BL-23 |
| TS-judge | `judge/pack.mjs`（隔离证据包、随机命名、blind-prompt lint）、`judge/harness.mjs`（截图—输入包装器）、`judge/canary.mjs`、`judge/wild.mjs`、`judge/saliency.mjs`、`judge/palette.mjs`、`judge/seams.mjs`、`judge/edges.mjs`、`judge/acting.mjs`、`judge/film.mjs`、`judge/eggs.mjs`、`judge/package.mjs`、`thumb.mjs`、`silhouette.mjs`、`field.mjs`、`score.mjs`、`coverage.mjs`、`tool-validity.mjs` | score.mjs 在手工构造的条目判定上复现 rubric §3 的全部规则（含 9/10 分规则、机器上限、严重度上限、T_final 乘数） |
| TS-detail | `detail-inventory.mjs`、`zoom-coverage.mjs`（输出冷格列表与 slot 归属）、`judge/detail-pairs.mjs`、`detail/draft-crop.mjs`、`detail/registry-lint.mjs`、`merge-static.mjs`、`check-style.mjs` | 在草稿 C 上复核基线（R0），与手工 129 条的差异有解释；刷量 fixture（重复、不可见、SSIM 相同）全部不计数 |
| TS-tourney | `tourney/variant-build.mjs`、`tourney/pack.mjs`、`tourney/bt.mjs`（Bradley–Terry + 聚类 bootstrap）、`tourney/graft-check.mjs`、`tourney/harvest.mjs`（并集收割的去重、遮挡与 saliency 检查）；比赛中兼任 GRAFT | 在合成偏好数据上恢复已知排名；graft-check 能检出 1% 像素偏移 |
| TS-repro | `verify.mjs`（npm run verify / verify:full）、`check-contract.mjs`、`check-docs.mjs`、`verify-claims.mjs`、`readme-lint.mjs`、`judge/points.mjs`（可回收分数排序器，§8.2）、`ledger.mjs` | 全新克隆 verify 退出码 0；BL-07 修复（playwright 进 devDependencies、无绝对路径） |
| RT-mutant | 独立红队：没看过任何检查器，写 ≥10 个美术级缺陷与 CANON mutant | `src/mutants/*.js`（经 ?mutant= 加载） | mutant 集入库、哈希锁定 |

### 6.3 构建者（胜者转正 + 单一负责人）

| ID | 来源 | 拥有文件 | 主要 criterion | 验收（脚本 + 自检） |
|---|---|---|---|---|
| RIG-LOCO | 单一 | `src/rig/solve.js`、`ik.js`、`secondary.js`、`presets.js`、`src/rig/*.test.js` | C3.2、C3.3、C5.1、C5.2、C12.2、G3、G10 | check-rig 全部（含 BL-02、BL-08、BL-09）；node --test；mutate-rig 杀死率 ≥90%；TR9 的 6 组预设全部过 G3/G10 |
| RIG-ACT | 单一（TR10 中是守擂方） | `src/rig/events.js` | C3.4、C5.3、C5.4、C5.6、C6.3、C6.4、C9.3 | 所有事件在 sim time（BL-04）、可叠加可打断、motion-audit --fuzz 0 跳变；按 DIR 的 timing.md |
| RIG-FACE | 单一 | `src/rig/face.js` | C5.5、C6.2、C4.3 | 视线系统（pose.gaze）、鸟式眨眼（BL-14）、头部稳定比保持 ≈0.18 |
| PEL-HEAD | TR1 胜者 | `src/art/pelican-head.js` | C1.3、C4.1、C4.2、C7.7 | 同 TR1 门槛，在全部时段与事件下 |
| PEL-BODY | 单一 | `src/art/pelican-body.js`（neck、body、tail、新 slot `scarf`） | C4.3、C4.6、C3.2、C5.2 | neckD 固定命令数；腹—座 0 背景像素；围巾跟随 |
| PEL-WING | TR2 胜者 | `src/art/pelican-wings.js` | C4.4、C3.1 | 同 TR2 门槛 |
| PEL-LEGS | 单一 | `src/art/pelican-legs.js` | C4.5、C3.1、C1.2 | 脚底—踏板顶 ≤0.5 u、全蹼 4 趾、远腿 B/N |
| BIKE-FRAME | 单一 | `src/art/bike-frame.js`（frame、fork、bars、fenders、brakes、cables） | C2.1、C2.6 | check-bike 几何 ±0.5°/±1 u、0 缝隙、刹车与线缆 |
| BIKE-DRIVE | 单一 | `src/art/bike-drive.js`（wheels、cog、chain、chainring、新 slot `spider`、cranks、pedals） | C2.2、C2.4、C2.5、C1.2 | 48T/16T 齿可数、整数链节（契约采纳时）、3-cross 编辐、wagon 全正向 |
| BIKE-CARGO | 单一 | `src/art/bike-cargo.js`（新 slot `basket`、fish、bell、lamp、reflectors） | C2.6、C6.4（鱼） | 挂载在结构件上；车铃到近握把 ≤15 u |
| SKY | 单一（TR8 守擂方） | `src/world/sky.js`、`src/core/palette.js` | C7.2、C7.3、C4.6 | 6 时段墨组、光芒 ≈1°/s |
| SEA | 单一 | `src/world/sea.js`（L-sea、L-boats） | C13.4、C7.3 | 平铺无缝、日月光路 |
| HARBOUR | 单一（新） | `src/world/harbour.js`（L-hills-far、L-lighthouse、新 L-harbour） | C13.4、C6.5（渔船归港节拍） | 夜间窗户与灯塔光束 |
| LAND | 单一 | `src/world/land.js` | C2.3、C3.1（路面顶 = 790）、C13.4 | 平铺无缝、路面虚线节距 157.08 |
| FX-CAST | 单一 | `src/fx/fx.js`、`src/fx/cast.js`（鸥群、鹈鹕编队） | C6.6、C9.6 | 纯函数 fx（BL-04 同理）、粒子预分配 |
| TYPE | 单一 | `src/world/frame.js`（L-letterbox，从 LEAD 移交）、`tools/glyphs.mjs`、`src/art/glyphs.gen.js` | C13.5、C9.8、C7.1 | 全部文字为路径、字形审校、标题卡 ≈3 s 缩小 |
| DIR | TR3 胜者 | `docs/character.md`、`docs/timing.md`、`docs/beats.md`、`docs/composition.md`、`src/director/*.js`（intro、auto-director、cameraplan、portrait framing） | C6.1、C6.5、C5.4、C7.1、C7.4、C9.7、G8 | 24 s 循环 ≤5 节拍、loop-seam 0 跳变、竖屏专门构图 |
| MOMENT | TR4 胜者 | `src/moment/<id>.js` | C8.1 | eggs.mjs 4 种上下文 |
| EGGS | TR4 亚军 | `src/eggs/*.js`、`docs/eggs.json` | C8.3、C8.1 encore | 探索者可发现、不经代码 |
| UI | 单一 | `src/ui/ui.js`、`src/ui/styles.js`、`src/ui/a11y.js` | C9.1、C9.2、C9.5、C9.6、C9.7、C11.4 | ux-matrix、a11y 0 serious、减少动态实时适配 |
| I18N-KEYS | 单一（新） | `src/ui/keymap.js`、`src/ui/i18n.js`、生成的帮助表 | C9.4、C9.8、G12 | keys.mjs 全部；i18n-lint 100% 双语 |
| AUDIO | 单一 | `src/audio/*.js` | C8.4、G11 | createAudio(bus,{context}) 接受 OfflineAudioContext；显式开启前 0 个 AudioContext |
| BAKER | 单一 | `src/bake/*.js`、`tools/bake.mjs`、`tools/check-baked.mjs`、`tools/loop-seam.mjs` | C11.1、C11.2、G5 | 48 相位对照、100 次循环无缝、静态回退通过 check-benchmark |
| MINI | TR6 胜者 | `src/mini/pelican-mini.svg` | C11.1 | ≤16 KB、CANON-14 |
| INSPECT | 单一 | `src/inspect/*.js` | C12.6 | check-inspect；读数标注"solver" |
| PKG | 单一 | `tools/webm.mjs`（renderAt 逐帧 → vp8，按 BL-31 走 mjpeg/y4m 管线）、`tools/poster.mjs`、`tools/contact-sheet.mjs`、`README.md`、`docs/THIRD_PARTY.md`、`LICENSE`、`docs/claims.json` | C11.3、C11.5、C12.5、G6、G13、G15 | package.mjs、verify-claims、readme-lint、check-docs |
| DA-* ×10 | 单一（TR7 守擂方） | 见 §5.3 | D13 | 见 §5.6 |
| INTEGRATOR | 单一 | 只改 LEAD 授权的胶水代码（`src/main.js` 的接线段） | G1、C10.8 | dist 干净、全套门槛通过 |

### 6.4 评估组（每轮全新）

| ID | 数量（每轮完整协议） | 说明 |
|---|---:|---|
| EVAL-LEAD | 1（贯穿） | 拥有 `docs/eval/rounds/**`、植入缺陷答案（只在其目录）、密封留出集、ledger 的评审部分；不评分、不构建 |
| J-lens | 43（按 rubric §7.6 的人数） | 逐原子条目判定 |
| J-blind 池 | ≈25 | C1.3、C4.1、C5.1、C6.1、C6.3、C7.1、C7.6、C7.7、C8.1、C8.2、C11.1、C13.6 的盲评 |
| J-adv + J-valid | ≈20（所有 ≥9 + C1.2 + C7.5） | Red Court（§8.3） |
| J-detail | 2 | G-DETAIL、C13.1 |
| J-user | 2（桌面 / 390 px 触屏） + 1 探索者 | C9.1、C9.3、C8.3 |
| 专项 | 双语审校 1、a11y 审计 1、机械找错 1、自行车技师 1、逐帧方向 1 | C9.8、C9.5、C2.1、C2.7、C2.4 |
| BASELINE | 3 次运行（一次性，phase A 并行） | 匹配投入基线：同模型同工具、60–90 分钟、不给 rubric、best-of-3，设置冻结后哈希入库（C8.2 第 1 层、C7.1、C7.7、C11.1 的对照） |
| SINGLE-SHOT | 6 次（一次性） | 同模型单次对照（原话 ×3、动画原话 ×3） |

---

## 7. 阶段、顺序与并发

### 7.1 工作流（workflow）清单

| Workflow | 脚本 | 同时代理数 | 用途 |
|---|---|---:|---|
| WF-A | `wf-contract.v1.js` | 2 | PERF-ARCH + DETAIL-PLAN（LEAD 在主会话改契约），之后 CONTRACT-REV |
| WF-BASE | `wf-baseline.v1.js` | 2 | BASELINE ×3 + SINGLE-SHOT ×6（与我们的仓库隔离，一开始就跑） |
| WF-T0-a / b / c | `wf-tools.v1.js --lane` | 2 × 3 | 工具匠三条线：(rig, geom)、(perf, ux)、(judge, detail)；随后 (tourney, repro)、RT-mutant |
| WF-TR | `wf-tourney.v1.js --spec trN` | 2 | 通用锦标赛脚本，按 spec 实例化（§7.3） |
| WF-B-rider / bike / world / product | `wf-build-lane.v1.js --lane` | 2 × 4 | 构建四条线（各自一个 git worktree `wt/<lane>`，合并火车由 LEAD 每 2–3 小时合并一次） |
| WF-DETAIL | `wf-detail.v1.js --region` | 2 | 细节迭代与 TR7 对决（按区域流水线启动） |
| WF-EVAL-R* | `wf-eval.v1.js --round` | 2 × 4 | R0、R1、R2–R4、R-final（R1 与 R-final 同时开 4 个评审 workflow） |
| WF-FIX | `wf-fix.v1.js --round` | 2 × 2 | 修复轮（按所有者分组，挑战者对决） |

**全局并发上限：同时 ≤4 个 workflow（≤8 个代理）。** 代理大部分时间在推理，Chromium 是突发负载；所有启动 Chromium 的工具经 `/tmp/pb-cpu.lock`（普通渲染共享锁，最多 2 个并发 Chromium；perf / soak 独占锁）。

### 7.2 甘特图（小时，自 phase A 开始）

```
H0 ─ H3    WF-A      契约冻结：z-band、SLOTS（spider、chainring<chain、basket、scarf）、整数链节决定、
                     data-anchor、全部钩子、variants/moment/director 注册表、data-detail 规范、细节计划
H0 ─ H6    WF-BASE   匹配投入基线 + 单次对照（完全隔离）
H3 ─ H10   WF-T0-a/b/c  T0 工具（并行三条线）
H3 ─ H8    WF-TR     TR1 头部 + TR2 翼（在 phase-0 运行时 + ?variant 上比赛；只看骑者裁图）
H3 ─ H6    WF-TR     TR3 导演（纯文档，先评 a 步）
H6 ─ H9    WF-TR     TR8 墨组对决（必须在 R0 冻结墨组之前）
H10 ─ H11  WF-EVAL   R0：工具有效性 + 基线复核 + 草稿细节基线锁定 + 墨组冻结 + N/A 判定 + 发布探针
H9 ─ H20   WF-B-*    四条构建线（rider 线：RIG-LOCO→RIG-ACT/RIG-FACE，PEL-HEAD/PEL-WING 继续，PEL-BODY、PEL-LEGS；
                     bike 线；world 线；product 线：UI、I18N-KEYS、AUDIO、BAKER、INSPECT、PKG）
H10 ─ H16  WF-TR     TR4 标志性时刻（概念 1 h → 原型 3–4 h）、TR6 mini（并行于 H10–H14）
H16 ─ H19  WF-TR     TR9 参数锦标赛、TR5 开场、TR10 吞鱼 / 跳车对决
H14 ─ H26  WF-DETAIL 细节流水线：每个区域在其基础模块通过验收后立即开始（TR7a–g + 迭代），不是屏障
H24 ─ H26  WF-B      集成（INTEGRATOR）+ dist 干净 + 全套门槛
H26 ─ H30  WF-EVAL-R1 ×4  完整协议（含 MR-field、G-DETAIL）→ G16 检查点 #1 发给用户（异步，不阻塞）
H30 ─ H39  WF-FIX + WF-EVAL-R2..R4  至多 3 轮，每轮 ≈3 h
H39 ─ H44  WF-EVAL-Rfinal ×4  全新评审、野卡包、密封留出集、60 分钟 soak → G16 检查点 #2 → 打包、PR、Artifact
```

关键路径：WF-A → TR1/TR2 → rider 线 → TR7a/b（鹈鹕细节）→ 集成 → R1 → 修复 → R-final。其余全部挂在关键路径旁边并行。

### 7.3 通用锦标赛 workflow 提纲（`docs/team/wf-tourney.v1.js`）

```js
export const meta = {
  name: 'pelican-tourney',
  description: 'Best-of-N tournament for one contract-shaped part: gated entries, blind rubric-protocol judging, Red Court, harvest, graft',
  phases: [
    { title: 'Enter', detail: 'N isolated entrants with different design seeds' },
    { title: 'Gate', detail: 'scripts disqualify gate failures' },
    { title: 'Judge', detail: 'blind forced choice + rubric atoms + canaries' },
    { title: 'Court', detail: 'adversarial check of every projected score >= 9' },
    { title: 'Graft', detail: 'promote winner, harvest losers, graft-check' },
  ],
}
const S = args.spec   // { id, part, entrants:[{id, seed}], gates:[cmd], protocol, atoms:[itemIds], criteria:[ids], remix:true }
phase('Enter')
const entries = (await parallel(S.entrants.map(e => () => agent(
  `${COMMON}\nTOURNAMENT ${S.id} — you are entrant ${e.id}. Design seed: ${e.seed}. Own only src/candidates/${S.id}/${e.id}/**. ` +
  `Atoms you will be judged on: ${JSON.stringify(S.atoms)}. Gates: ${S.gates.join('; ')}. ≥4 visual self-check iterations.`,
  { label: `enter:${S.id}:${e.id}`, phase: 'Enter', schema: ENTRY })))).filter(Boolean)
phase('Gate')
const gated = await agent(`Run ${S.gates.join(' && ')} for each variant ${entries.map(x => x.id)}; report pass/fail with logs.`,
  { label: `gate:${S.id}`, phase: 'Gate', schema: GATES })
const alive = entries.filter(x => gated.pass[x.id])
phase('Judge')
await agent(`Build packs: node tools/tourney/pack.mjs --spec ${S.id} --entries ${alive.map(x => x.id)} --decoy draft --canary 2`,
  { label: `pack:${S.id}`, phase: 'Judge' })
const blind = (await parallel([1, 2, 3, 4, 5].map(i => () => agent(BLIND_PROMPT(S, i), { label: `blind:${S.id}:${i}`, phase: 'Judge', schema: BLIND })))).filter(Boolean)
const atoms = (await parallel([1, 2].map(i => () => agent(ATOM_PROMPT(S, i), { label: `atoms:${S.id}:${i}`, phase: 'Judge', schema: ATOMS })))).filter(Boolean)
const ranking = await agent(`node tools/tourney/bt.mjs + node tools/score.mjs --subset ${S.criteria} on ${JSON.stringify({ blind, atoms })}; drop judges with canary recall < 0.8.`,
  { label: `rank:${S.id}`, phase: 'Judge', schema: RANK })
phase('Court')
const nines = ranking.winner.projected.filter(p => p.score >= 9)
const court = nines.length ? await pipeline(nines, [
  p => agent(ADV_PROMPT(S, p), { label: `adv:${S.id}:${p.criterion}`, phase: 'Court', schema: DEFECTS }),
  d => agent(VALID_PROMPT(S, d), { label: `valid:${S.id}`, phase: 'Court', schema: VERDICT }),
]) : []
// stop rule §3.4: decide, optionally one remix round with the top two
phase('Graft')
return agent(`GRAFT: promote ${ranking.winner.id}; harvest per tools/tourney/harvest.mjs from ${ranking.harvest}; run graft-check.`,
  { label: `graft:${S.id}`, phase: 'Graft', schema: REPORT })
```

（完整脚本在构建前由 LEAD 按 workflow-authoring 规范写成：`meta` 为纯字面量，不使用 Date.now / Math.random。）

---

## 8. 评估、循环与停止条件（与 rubric 分数绑定）

### 8.1 轮次

| 轮次 | 进入条件 | 内容 | 退出条件 |
|---|---|---|---|
| R0 | T0 工具写完 | rubric §7.7 的 R0 全部（工具有效性、基线复核、细节基线锁定、墨组冻结、难度标注、密封留出集、N/A、发布探针、红队 mutant 入库） | 每个 T0 工具敏感度 = 100%（对可自动检出的预登记缺陷）、特异度 = 100%（对良好 fixture）；否则该工具重写，重写之前不开始 R1 |
| R1 | 集成完成、dist 干净、G1/G3/G15/G17 与 check-benchmark 通过 | 完整协议（4 个评审 workflow 并行）+ MR-field + G-DETAIL | 产出 scorecard；G16 检查点 #1 |
| R2–R4 | 每轮修复合并之后 | 全部门槛脚本 + vr + 受影响维度的感知测试（全新评审）+ 所有 ≥9 的 Red Court | 达标线（§8.4）或 3 轮用完 |
| R-final | 代码冻结 | 全新评审完整协议 + 野卡包 + 密封留出集 + 60 分钟 soak + 每名 J-lens 10 分钟自由找缺陷 + 所有 ≥9 的 Red Court | 唯一对外报告的分数；G16 检查点 #2 |

"便宜的先跑、失败就停"：每轮先跑门槛（分钟级），G1、G3、G15、G17 或 check-benchmark 任一失败就不启动评审，直接回修复。

### 8.2 修复轮：按"可回收分数"排序，卡住的项开挑战者对决

`tools/judge/points.mjs` 从 scorecard 计算每个 criterion 的可回收分数：

```
gain_c = W_d · (w_c / Σw_d) · (target_c − s_c) / 10          target_c = max(9.2, 核心项 9.5)
       + 核心项加成：若 c ∈ perceptualCore，∂T_final/∂s_c = T/9 · (1/13) 的贡献（H < 9 时）
       + 门槛解锁：若 c 是某失败门槛的唯一原因，gain = 门槛上限释放的总分
priority_c = gain_c × p_fix（按缺陷类型的历史修复成功率）/ 预计墙钟
```

- 每轮取优先级最高的缺陷，按文件所有者分组派给原 owner（fixer 的 brief 附带证据路径、原子条目、评审原话、before/after 要求）。
- **挑战者对决**：某个 criterion 在一轮修复后仍 <8.5（或核心项 <9），下一轮不再只派原 owner：原 owner 与一名新挑战者各在一个变体里修同一处（`?variant=fix-<c>:A|B`），按该 criterion 的原协议小规模盲评，胜者合并。这把锦标赛机制延伸到了修复阶段，专门对付"同一个代理反复修不好"的情况。
- 分数下降 ≥1 的维度必须说明原因（真回归 / 评审噪声）；真回归由 vr 与 git bisect 定位并回滚。

### 8.3 Red Court：对每一个 ≥9 的分数做对抗复核

- **范围**：任何中位分 ≥9 的 criterion（rubric 的要求），外加本方案扩展的：锦标赛胜者的投影 ≥9、修复轮中新出现的 ≥9、任何维度 ≥9.5。
- **流程**：J-adv 拿到该 criterion 的证据包与原子条目，提示为"这个 criterion 被打了 ≥9。找出至少 5 个缺陷，每个都要指向证据路径与可见特征；可以用 render.mjs 重新渲染任何 t / 机位 / 时段"；J-valid 在重新渲染上逐条核实并按 scoring.severity 分级；被验证的 blocker → 封顶 6、major → 封顶 8、minor 进入 10 分额外项判定（10 分要求"对抗复核没有被验证的缺陷"）。
- **校准**：J-adv 与 J-valid 的证据包也混入植入的真 / 假缺陷；验证者对假缺陷的误判率 >20% 则作废。
- **反向检查（steelman-the-9）**：J-lens 给出 ≥9 时必须列出它认为通过的 10 分额外项及其可见性证据（盲评在 1× 下主动提到，或声明为检查模式额外项 ≤+0.5）；Red Court 同时核实这些证据，不成立的额外项不计。

### 8.4 全局停止条件

- **达标**：全部门槛通过（G1–G17、G-DETAIL；G16 为"用户通过且前 3 条意见解决"）、每维 ≥9.0、T_final ≥92、单项 ≥7、感知核心 13 项 ≥8——且全部来自 R-final。
- **轮数上限**：修复轮至多 3 轮（R2–R4），之后进入 R-final 并如实报告差距；不得挑选更早轮次的高分。
- **G16 未回复**：只能写"同模型自评达标，待用户确认"。
- **墙钟保险丝**：若 H40 仍在修复轮，R4 取消，直接 R-final。

---

## 9. 覆盖矩阵：每个 criterion 与门槛 → 生产者 → 验证者 → 证据

> 验证者列：脚本（门槛或机器上限）+ 评审位（rubric §7.6 的人数，全新）；"RC" = Red Court（≥9 时触发）。锦标赛列：该项由哪一场锦标赛决定其主要部件。

### D1 基准正典与一眼可读（11）

| criterion | 生产者 | 验证者 | 证据 | 门槛 | 锦标赛 |
|---|---|---|---|---|---|
| C1.1 CANON-14 每帧成立 | RIG-LOCO、PEL-LEGS、PEL-WING、BIKE-FRAME/DRIVE（锚点）、LEAD（SLOTS 层序） | check-anchors（含锚点审计）、check-benchmark；3 J-blind CANON 清单 + canary；RC | docs/eval/canon.json、anchor-audit.json、mutants-art.json | G2、G3 | — |
| C1.2 远近遮挡 | LEAD（SLOTS）、BIKE-DRIVE、PEL-LEGS | check-occlusion（?idmap）；2 J-adv + J-valid | docs/eval/occlusion.json、shots/eval/idmap/ | G2 | — |
| C1.3 ★ 缩略图 / 剪影 / 诱饵 | PEL-HEAD、PEL-BODY、PEL-WING、DIR（构图） | thumb.mjs、silhouette.mjs；5 J-blind（开放 ID、诱饵、遮头剪影、CVD）；RC | docs/eval/thumb.json | G7 | TR1、TR2 |

### D2 自行车工程（8）

| criterion | 生产者 | 验证者 | 证据 | 门槛 | 锦标赛 |
|---|---|---|---|---|---|
| C2.1 菱形车架几何 | BIKE-FRAME | check-bike（mask、flood fill、角度）；机械找错 J + J-valid | docs/eval/bike.json | G2 | — |
| C2.2 传动 | BIKE-DRIVE、LEAD（SLOTS spider、整数链节） | check-bike 传动项；drivetrain 裁图 J | docs/eval/drivetrain.json | G3 | — |
| C2.3 无滑滚动与视差 | RIG-LOCO、LAND、LEAD（路程积分器）、SEA/HARBOUR/SKY（视差） | check-kinematics、check-noslip | docs/eval/kinematics.json、noslip.json | G3、G4 | — |
| C2.4 时间混叠 | BIKE-DRIVE、DA-HW（周期细节）、PKG（webm 逐帧） | wagon.mjs（像素法，实时 / renderAt / webm）；逐帧方向 J | docs/eval/alias.json | G4 | — |
| C2.5 车轮保真 | BIKE-DRIVE、DA-HW | check-bike 辐条解析 + 静止件差分；花鼓清单 J | docs/eval/bike.json | — | — |
| C2.6 转向与挂载 | BIKE-FRAME、BIKE-CARGO | check-bike 挂载项；座舱裁图 J | docs/eval/bike.json | — | — |
| C2.7 4× 装配正确性 | BIKE-*、DA-HW、DA-CARGO | 盲评自行车技师（开放清点在先）+ J-valid | docs/eval/mech-assembly.json | — | TR7c/d |

### D3 接触、骑姿与物理（8）

| criterion | 生产者 | 验证者 | 证据 | 门槛 | 锦标赛 |
|---|---|---|---|---|---|
| C3.1 像素级接触 | PEL-LEGS、PEL-WING、BIKE-DRIVE（踏板）、LAND（路面顶）、FX-CAST（接触阴影） | check-contacts、contact-probe、onion；找缝 J；RC | docs/eval/contacts.json | G3 | TR2 |
| C3.2 坐在车座上 | RIG-LOCO、PEL-BODY | check-rig --seat；0 背景像素检查 | docs/eval/seat.json | G3 | — |
| C3.3 踩踏生物力学 | RIG-LOCO | check-rig --biomech（KOPS、座管角、伸展比，BL-09）；机械 J | docs/eval/biomech.json | — | TR9 |
| C3.4 事件动力学 | RIG-ACT | check-rig --events；跳车 / 滑行密集帧找缺陷 J | docs/eval/dynamics.json | G3 | TR10 |

### D4 鹈鹕：物种与解剖（8）

| criterion | 生产者 | 验证者 | 证据 | 门槛 | 锦标赛 |
|---|---|---|---|---|---|
| C4.1 ★ 物种辨识 FM-10 | PEL-HEAD、PEL-BODY、PEL-WING、DA-FACE | 3 J-blind 物种 ID（含诱饵）；解剖 J 逐项 FM-10；RC | docs/eval/species.json | G7 | TR1 |
| C4.2 头喙喉囊构造 | PEL-HEAD、DA-FACE | check-anatomy；3× 头部裁图 J | docs/eval/anatomy-head.json | — | TR1、TR7a |
| C4.3 颈部与头部稳定 | PEL-BODY（neckD）、RIG-FACE、RIG-LOCO | check-anatomy（颈形）、motion-audit（稳定比） | docs/eval/anatomy-neck.json | — | — |
| C4.4 翼构造与握把 | PEL-WING、DA-PLUME | check-anatomy 羽扇、check-rig 握把；翼 3× J | docs/eval/anatomy-wing.json | G7 | TR2、TR7b |
| C4.5 腿、全蹼足 | PEL-LEGS、DA-LEGS | check-anatomy、check-rig；足 3× J | docs/eval/anatomy-legs.json | — | TR7b |
| C4.6 羽区与物种色彩 | PEL-BODY、DA-PLUME（data-tract）、SKY（墨组） | check-anatomy 相对色彩 × 6 时段；羽区 J | docs/eval/anatomy-colour.json | — | TR8 |
| C4.7 风格化与尺度 | PEL-*、DIR | check-anatomy scale | docs/eval/anatomy-scale.json | — | TR1 |

### D5 动画技艺（9）

| criterion | 生产者 | 验证者 | 证据 | 门槛 | 锦标赛 |
|---|---|---|---|---|---|
| C5.1 ★ 踩踏重量 | RIG-LOCO | motion-audit、filmstrip（RS-cycle24 真时间）；3 J-blind 速度排序；RC | docs/eval/motion-audit.json | G10 | TR9 |
| C5.2 ★ 跟随与拖曳 | RIG-LOCO（secondary）、PEL-BODY（围巾、尾）、PEL-HEAD（喉囊、冠） | motion-audit（滞后 ≠0）、onion；密集帧找缺陷 J；RC | docs/eval/motion-audit.json、shots/eval/onion/ | G10 | TR9 |
| C5.3 弧线与连续 | RIG-ACT、RIG-LOCO | motion-audit --fuzz（300 日程） | docs/eval/fuzz.json | G10 | — |
| C5.4 表演节拍 X-sheet | DIR（timing.md）、RIG-ACT | motion-audit --events；盲评 nofx 命名事件 + A/B | docs/timing.md、docs/eval/events.json | — | TR3 |
| C5.5 鸟类运动词汇 | RIG-FACE、RIG-ACT | sheet（眨眼条带）、motion-audit --face；ORN J | docs/eval/avian-motion.json | — | — |
| C5.6 过渡与 smear | RIG-ACT、PEL-*（smear 形） | motion-audit transitions | docs/eval/transitions.json | — | — |

### D6 角色表演与叙事（8）

| criterion | 生产者 | 验证者 | 证据 | 门槛 | 锦标赛 |
|---|---|---|---|---|---|
| C6.1 ★ 角色圣经 | DIR | code-review 圣经 vs rig；3 J-blind 15 选 3；acting.mjs 三联图；RC | docs/character.md、docs/eval/judges/character-*.json | — | TR3 |
| C6.2 视线与面部 | RIG-FACE、PEL-HEAD | motion-audit --face；acting 表情表 J | docs/eval/face.json | — | TR1 |
| C6.3 ★ 笑点可读 | RIG-ACT、DIR | check-temporal；5 J-blind（nofx 描述 + 4 选 1）；RC | docs/eval/judges/gags-*.json | — | TR10 |
| C6.4 吞鱼序列 | RIG-ACT、PEL-HEAD、PEL-BODY（颈部隆起）、BIKE-CARGO（鱼） | motion-audit、filmstrip；ORN J | docs/eval/gulp.json | — | TR10 |
| C6.5 循环叙事与自动导演 | DIR、HARBOUR（归港节拍） | loop-seam、interact --idle；1 J-blind 复述故事条带 | docs/beats.md、docs/eval/idle.json | — | TR3 |
| C6.6 配角 | FX-CAST、BIKE-CARGO（鱼） | sheet；配角 J | shots/eval/gulls/ | — | — |

### D7 艺术指导、风格 C、光影与镜头（10）

| criterion | 生产者 | 验证者 | 证据 | 门槛 | 锦标赛 |
|---|---|---|---|---|---|
| C7.1 ★ 开场 | DIR（intro）、TYPE（标题卡） | first-look.mjs；5 J-blind 强制选择（vs 草稿、vs 基线）；RC | docs/eval/first-look.json | G8 | TR5 |
| C7.2 ★ 统一美术 | SKY（墨组）、全部美术、UI、FX | judge/palette（30 格网格）、check-style；5 J；RC | docs/eval/palette.json | — | TR8 |
| C7.3 有动机的光 | SKY、HARBOUR（灯塔、窗）、FX-CAST（车灯光束）、LAND（路灯） | saliency、量化光晕检查；光影 J | docs/eval/saliency.json | — | TR8 |
| C7.4 镜头与构图 | DIR（cameraplan、竖屏构图）、LEAD（camera.js） | contact-probe、judge/film；3 J 电影联系表强制选择 | docs/eval/camera.json | G8 | — |
| C7.5 3× 完成度 | 全部美术 + DA-* | judge/seams、judge/edges；2 J-adv + J-valid | docs/eval/zoom-defects.json | — | TR7 |
| C7.6 ★ 风格 C 保真 | 全部美术（STYLE-C §3 修正由 PEL-HEAD/PEL-WING/PEL-LEGS/PEL-BODY 落实） | check-style（非墨像素 ≤0.5%、DOM 审计）；5 J-blind 同一角色 / 同一风格 + WPA 强制选择；RC | docs/eval/style.json、user-notes.json | G8 | TR1、TR2、TR8 |
| C7.7 ★ 吸引力与克制 | PEL-HEAD、DIR、UI、FX-CAST | saliency 时间模式、可见入口计数；5 J-blind 3 选 1 +"你会删掉什么"；RC | docs/eval/appeal.json | — | TR1 |

### D8 惊艳（6）

| criterion | 生产者 | 验证者 | 证据 | 门槛 | 锦标赛 |
|---|---|---|---|---|---|
| C8.1 ★ 标志性时刻 | MOMENT、EGGS（encore） | judge/eggs.mjs 4 种上下文；3 J-blind 开放回忆；RC | docs/eval/moment.json、README#signature | — | TR4 |
| C8.2 分层横向对比 | 全体；BASELINE / SINGLE-SHOT（对照） | field.mjs；5 J-blind ≥40 配对、聚类 bootstrap | docs/eval/field.json | — | 全部 |
| C8.3 彩蛋与致敬 | EGGS（TR4 亚军） | 探索者（只看截图的 harness） | docs/eggs.json、docs/eval/explorer.json | — | TR4 |
| C8.4 程序化声音 | AUDIO | audio-offline（30 s 频谱）、audio-check；9–10 分需 G16 用户意见 | docs/eval/audio.json | G11、G16 | — |

### D9 交互、无障碍与产品体验（6）

| criterion | 生产者 | 验证者 | 证据 | 门槛 |
|---|---|---|---|---|
| C9.1 上手与可发现性 | UI、DIR | 2 J-user 冷启动（桌面 / 390 px 触屏）经 harness | docs/eval/cold-start-*.json | — |
| C9.2 控件与微交互 | UI | ux-matrix、contrast、judge/controls | docs/eval/ux-matrix.json | — |
| C9.3 交互即表演 | RIG-ACT、UI | interact.mjs | docs/eval/interact.json | — |
| C9.4 键盘与快捷键卫生 | I18N-KEYS | keys.mjs（修饰键、IME、聚焦守卫） | docs/eval/keys.json | G11、G12 |
| C9.5 读屏语义 | UI（a11y.js）、LEAD（role=img 包装、各带 aria-hidden） | a11y.mjs（10 状态）；a11y 审计 J 读 ariaSnapshot | docs/eval/a11y.json | G12 |
| C9.6 动效安全 | UI、FX-CAST、LEAD | flash-check（≥90 场景）、reduced-motion 检查 | docs/eval/flash.json | G11 |
| C9.7 移动端与嵌入视口 | DIR（竖屏构图）、UI、LEAD | ux-matrix（RS-viewports） | docs/eval/mobile.json | G8 |
| C9.8 双语质量 | I18N-KEYS、TYPE | i18n-lint、cjk-glyph、check-text；双语审校 J | docs/eval/i18n.json、in-art-text.json | G12 |

### D10 性能与平台稳健（4）

| criterion | 生产者 | 验证者 | 证据 | 门槛 |
|---|---|---|---|---|
| C10.1 呈现帧率 | PERF-ARCH、全体（预算） | perf.mjs（trace、CPU 锁、3 次中位） | perf/perf.json | G9 |
| C10.2 合成层与光栅 | PERF-ARCH | perf --paint、lint | perf/paint.json | — |
| C10.3 零垃圾帧循环 | PERF-ARCH、LEAD（main loop） | perf JS 与分配采样 | perf/js.json | — |
| C10.4 内存与 soak | PERF-ARCH | soak.mjs（12 min；R-final 60 min + 时间扭曲） | perf/soak.json | G10 |
| C10.5 构建体积与启动 | LEAD、PERF-ARCH、DETAIL-REG（逐层 gzip） | audit-dist | perf/dist-audit.json、budgets.json | G1 |
| C10.6 跨引擎 | PERF-ARCH | xb-audit、xb-webkit（T2；R0 判定可行性） | docs/eval/xb.json | — |
| C10.7 生命周期 | LEAD、PERF-ARCH | robust、contexts | docs/eval/robust.json | — |
| C10.8 控制台卫生 | LEAD、INTEGRATOR | shoot / soak / robust / audit-dist 的共用 console 收集器 | docs/eval/console.json | G1 |

### D11 零 JS SVG 与交付物（7）

| criterion | 生产者 | 验证者 | 证据 | 门槛 | 锦标赛 |
|---|---|---|---|---|---|
| C11.1 独立 SVG | BAKER、MINI | check-baked（含 --static）、perf（`<img>` swaps/s）、field（mini 对单次对照）；3 J-blind CANON；RC | docs/eval/baked.json、mini.json | G5、G17 | TR6 |
| C11.2 烘焙保真与循环 | BAKER | check-baked 48 相位、loop-seam | docs/eval/baked.json | G5 | — |
| C11.3 webm / 海报 / 联系表 | PKG | judge/package.mjs；海报淘汰赛 3 J | dist/poster.png、contact-sheet.png、preview.webm | G13 | TR8 |
| C11.4 分享与下载 | UI、BAKER | export-check、contexts（沙箱 iframe） | docs/eval/export.json | G13 | — |
| C11.5 README / PR / Artifact | PKG、LEAD | check-docs | README.md、docs/handoff.md | G6、G13、G15 | — |

### D12 工程严谨、可验证与诚信（5）

| criterion | 生产者 | 验证者 | 证据 | 门槛 |
|---|---|---|---|---|
| C12.1 契约一致 | LEAD | check-contract | docs/eval/contract.json | — |
| C12.2 rig 属性 / 变异测试 | RIG-LOCO | check-rig、mutate-rig | docs/eval/mutants.json | G3 |
| C12.3 确定性与视觉回归 | LEAD、全体 | determinism、vr | docs/eval/determinism.json | G10 |
| C12.4 一键复现 | LEAD、TS-repro | verify.mjs 全新克隆、双构建 sha256 | docs/eval/verify.txt、dist/MANIFEST.json | G14 |
| C12.5 声明溯源 | PKG、LEAD | verify-claims、readme-lint | docs/claims.json | G6 |
| C12.6 X 光检查模式 | INSPECT | check-inspect | docs/eval/inspect.json | — |
| C12.7 多代理过程可验证 | EVAL-LEAD、LEAD（ledger、锦标赛与收割记录） | coverage.mjs、所有权与隔离审计；2 名独立评审 | docs/team/ledger.json、coverage.json | G14 |
| C12.8 不空转的基准检查器 | TS-geom、RT-mutant | check-benchmark + mutant 画廊（tool-validity） | docs/eval/benchmark.json | G2、G14 |

### D13 细节密度与工艺（10）

| criterion | 生产者 | 验证者 | 证据 | 门槛 | 锦标赛 |
|---|---|---|---|---|---|
| C13.1 ★ 清单倍数 | DETAIL-PLAN、DA-* ×10 | detail-inventory（DETAIL-REG 运行）、DV-AUDIT；2 J-detail 盲清点 + 7 区并排；RC | docs/eval/detail-inventory.json、judges/detail-*.json | G-DETAIL | TR7a–g |
| C13.2 ★ 鹈鹕细节 | DA-PLUME、DA-FACE、DA-LEGS（+ PEL-* 形体） | zoom-coverage（鹈鹕格子）、变形拉伸无撕裂；3 组 3× 裁图 J；RC | docs/eval/zoom-coverage.json | G-DETAIL | TR7a/b |
| C13.3 自行车细节 | DA-HW、DA-CARGO | zoom-coverage（自行车）、wagon（周期细节）；5 组 4× 裁图 J | docs/eval/zoom-coverage.json | G-DETAIL | TR7c/d |
| C13.4 世界细节 | DA-SEA、DA-LAND、DA-SKY、HARBOUR | detail-inventory、check-scale、saliency；3 组裁图 J | docs/eval/scale.json | G-DETAIL | TR7e/f/g |
| C13.5 版式与边框 | TYPE、DA-TYPE | detail-inventory、check-text、first-look；3× 裁图 J | docs/eval/in-art-text.json | G-DETAIL | TR7g |
| C13.6 细节纪律 | PERF-ARCH、DETAIL-REG、DA-* | check-detail-budget、perf（全细节）、闪烁检测；5 J-regress 四区成对 | docs/eval/detail-budget.json | G9、G-DETAIL | — |

### 门槛

| 门槛 | 生产者 | 验证者 | 证据 |
|---|---|---|---|
| G1 构建与自包含 | LEAD、INTEGRATOR | build、shoot --dist、audit-dist | docs/eval/console.json、perf/dist-audit.json |
| G2 基准正典 | RIG-LOCO、PEL-*、BIKE-* | check-benchmark；3 J-blind CANON（J-valid 核实异议） | docs/eval/canon.json、benchmark.json |
| G3 运动学与接触 | RIG-LOCO、PEL-LEGS、PEL-WING、PEL-BODY | check-rig、check-anchors、check-contacts | docs/eval/rig.json、seat.json、contacts.json |
| G4 方向与不倒转 | BIKE-DRIVE、LAND、BAKER、PKG | wagon、check-kinematics、check-baked | docs/eval/alias.json |
| G5 独立 SVG | BAKER、MINI | check-baked（含 --static）、loop-seam | docs/eval/baked.json、mini.json |
| G6 诚信 | PKG、LEAD | verify-claims、readme-lint、人工声明审计 | docs/claims.json |
| G7 物种与身体正典 | PEL-HEAD、PEL-WING、PEL-LEGS、PEL-BODY | 5 J-blind（notext、诱饵、遮头剪影）+ 解剖清单 | docs/eval/thumb.json、species.json |
| G8 手机与构图安全 | DIR、UI、LEAD | ux-matrix、first-look、contact-probe | docs/eval/mobile.json |
| G9 流畅 | PERF-ARCH、全体 | perf、live-parity、lint | perf/perf.json |
| G10 连续与确定 | RIG-*、LEAD、FX-CAST | motion-audit --fuzz、soak、determinism | docs/eval/fuzz.json |
| G11 动效与声音安全 | UI、AUDIO、FX-CAST | flash-check、audio-check、keys、ux-matrix | docs/eval/flash.json、audio.json |
| G12 无障碍底线 | UI、I18N-KEYS、LEAD | a11y、i18n-lint、cjk-glyph、keys | docs/eval/a11y.json |
| G13 交付完整 | PKG、LEAD、BAKER | judge/package、export-check、Artifact 回读 diff | docs/eval/package.json、publish.json |
| G14 评估有效性与过程 | EVAL-LEAD、TS-*、LEAD | verify、tool-validity、coverage、所有权与隔离审计 | docs/eval/verify.txt、tool-validity.json、docs/team/coverage.json |
| G15 不冒充、有署名 | PKG、TYPE（字体许可） | check-docs、git ls-files 第三方 SVG 检查 | README.md、docs/THIRD_PARTY.md、LICENSE |
| G16 用户检查点 | LEAD（用户联络） | 用户本人 | docs/eval/user-checkpoint.json |
| G17 真的是 SVG 动画 | PERF-ARCH、LEAD | check-purity（?nocache 对照、光栅 MIME grep） | docs/eval/purity.json |
| G-DETAIL 细节远多于草稿 | DETAIL-PLAN、DA-* ×10 | detail-inventory、zoom-coverage、DV-AUDIT、2 J-detail、perf（全细节） | docs/eval/detail-inventory.json、zoom-coverage.json |

`tools/coverage.mjs` 以本表（转为 `docs/team/coverage.json`）为输入，断言每个 criterion 都有生产者、工具、评审位与证据路径（G14）。

---

## 10. 需要新建的自动化工具

rubric §13.3 的 T0 / T1 / T2 全部工具由 §6.2 的工具匠建造。本方案额外需要：

| 工具 | 拥有者 | 作用 |
|---|---|---|
| `tools/tourney/variant-build.mjs` | TS-tourney | 按 `?variant=` 组合构建 / 渲染候选；dist 永远排除 `src/candidates/**` |
| `tools/tourney/pack.mjs` | TS-tourney | 生成锦标赛证据包（同构图、去文字、随机命名、诱饵 + canary），复用 judge/pack 的隔离 |
| `tools/tourney/bt.mjs` | TS-tourney | Bradley–Terry 排名 + 按评审聚类的 bootstrap；召回率过滤 |
| `tools/tourney/graft-check.mjs` | TS-tourney | 嫁接前后在比赛帧上像素差 ≤0.5%、接口一致、全套门槛 |
| `tools/tourney/harvest.mjs` | TS-tourney | 并集收割：SSIM 去重、遮挡、saliency 下降 ≤0.05、check-style |
| `tools/detail/draft-crop.mjs` | TS-detail | 草稿 keyframe 与成品 renderAt 的同位置裁图（7 区域 × 1×/3×） |
| `tools/detail/registry-lint.mjs` | TS-detail | `data-detail` 命名规范、层、O/T、owner 与计划一致 |
| `tools/merge-static.mjs` | TS-detail | 构建时把静态细节按"条目 × 墨"合并为路径，保留 `data-detail` 根；每带 ≤200 path |
| `tools/zoom-coverage.mjs --coldcells` | TS-detail | 冷格列表按 slot 归属给 DA（细节迭代的工单来源） |
| `tools/judge/points.mjs` | TS-repro | 可回收分数排序器（§8.2） |
| `tools/ledger.mjs` | TS-repro | 记录每次代理调用、锦标赛、收割、嫁接、评审读取的文件（隔离审计） |
| `tools/filmstrip.mjs`（24 帧周期表） | TS-rig | RS-cycle24：t = t0 + k/24，close 机位，DPR 2，另出 ?skeleton=1 叠加 |
| `tools/soak.mjs` | TS-perf | 12 分钟种子猴子 + 60 分钟无人值守 + t≈1e6 时间扭曲 |
| `tools/vr.mjs` | TS-perf | 视觉回归：test/golden 基线 + 差异热图（修复轮用来抓回归） |
| `tools/check-baked.mjs` diff | BAKER | 烘焙 vs 实时 48 相位的 live \| baked \| diff 热图 |
| `tools/keys.mjs` | TS-ux | 键盘驱动器（全部快捷键、修饰键、IME 组字、聚焦控件守卫） |
| `tools/webm.mjs` | PKG | renderAt 逐帧 → libvpx_vp8（本机 ffmpeg 只有 mjpeg/vp8，按 BL-31 走 mjpeg 或 y4m 管线） |

---

## 11. 反通胀（在 rubric §7.8 之上，锦标赛专用）

1. 锦标赛分数只用于选择，不进 scorecard；对外只报 R-final（标注同模型自评）。
2. 每个锦标赛证据包都有诱饵（草稿同部件）与植入缺陷；评审没压低诱饵或召回 <80% 即作废。
3. 设计种子强制多样性；BT 排名报告评审间一致性，一致性过低（Kendall τ < 0.3）时加 2 名评审。
4. 门槛否决权：审美票永远不能救回一个违反 STYLE-C 或 CANON 的作品。
5. 收割必须经 J-valid 判定"不冲突"，并记录来源——防止把几个作品拼成风格不统一的缝合怪（C7.2 的风险）。
6. 细节刷量由 DV-AUDIT 专门审计；只有 detail-inventory 去重后且 1×/3× 可见的条目计数。
7. Red Court 覆盖每一个 ≥9，并核实 10 分额外项的可见性证据。
8. R-final 评审从未参与过任何轮次或锦标赛；使用密封留出集与野卡包。

---

## 12. 风险登记

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| 同模型参赛者产出雷同，锦标赛失去意义 | 中 | 中 | 设计种子、互不可见、诱饵检查；若三件作品两两 BT 差异不显著，直接取原子条目最高者并省掉混合轮 |
| 锦标赛占用墙钟，拖慢关键路径 | 中 | 高 | TR1/TR2/TR3/TR8 与 T0 工具并行（此时构建本来就在等工具）；每场 ≤5 h；TR9 不需要额外代理 |
| 胜者嫁接时与契约不符 | 低 | 中 | 所有参赛作品实现同一接口；graft-check 像素一致；LEAD 在 phase A 冻结 slot 语义 |
| 墨组在 R0 冻结，TR8 来不及 | 中 | 中 | TR8 排在 H6–H9，R0 在 H10；若超时，按 SKY 的版本冻结，挑战者的色值只能以"改色值不加墨"的方式在修复轮进入 |
| 细节拖垮帧率（BL-17：风格 C 在旧架构只有 19–22 fps） | 高 | 高 | PERF-ARCH 在 phase A 先做 z-band 架构并用草稿 C 的全部静态细节作负载验收 ≥58 fps；静态细节合并；每区对决都有 perf 门槛；PERF-GUARD 每次合并后跑 |
| 细节变成噪点，损害吸引力（C7.7、C13.6） | 中 | 高 | 对决中"更好"优先于"更多"；saliency 比 ≥1.4；四区不损美术成对盲评；DV-AUDIT 找 1× 噪点 |
| 细节刷量被 R 轮识破，G-DETAIL 失败 | 中 | 高 | 内部目标高于 10 分档 15%；DV-AUDIT 每次迭代审计；SSIM 去重与可见性在 detail-inventory 中由脚本强制 |
| 共享文件树上并行 shoot 互相干扰（BL-21） | 高 | 中 | 每条构建线一个 git worktree；合并火车；截图目录按代理分开；Chromium 锁 |
| 评审通胀（同族评审偏爱同族作品） | 高 | 高 | canary 校准、诱饵、强制选择、Red Court、匹配投入基线作最强对照、G16 用户检查点 |
| TR4 的时刻在默认体验中不可靠 | 中 | 高（D8 上限） | eggs.mjs 4 种上下文门槛；亚军作为 encore 备份；R1 后若 s_C8.1 <8，修复轮对 C8.1 开挑战者对决 |
| 用户在 G16 提出与 rubric 冲突的意见 | 中 | 高 | 用户意见优先于 rubric；LEAD 把意见转成修复工单，必要时改 rubric（记入 changelog）并重跑受影响项 |

---

## 13. 与现有资产的衔接（不推倒重来）

- **保留**：`src/rig/solve.js` 的纯函数 2 骨 IK 与解析次级动作、`src/core/palette.js` 的时段插值、`camera.js`、`scene.js` 的 slot / layer 装配、`tools/shoot.mjs`、`check-rig.mjs`、`lint.mjs`、`build.mjs`、`render.mjs`、`sheet.mjs`、`serve.mjs`；草稿 C 的 `gen.mjs`（网点 `dots()`、笔画 deco 大写、`ttf.mjs` 字形转路径）作为 TYPE、DA-SKY、DA-SEA 的起点。
- **修改**：`contract.js` 按 rubric §13.1 冻结新版（SLOTS 加 spider / basket / scarf、chainring 在 chain 之前、SLOT_OWNER 拆分 PEL-HEAD / PEL-BODY / PEL-WING / PEL-LEGS 与 BIKE-FRAME / BIKE-DRIVE / BIKE-CARGO、LAYERS 加 L-harbour、HORIZON 按风格与机位给出）；`wf-build.v0.js` 被本方案的 7 个 workflow 脚本取代（v0 的 COMMON 与 REPORT schema 沿用）。
- **修复**：BL-01–BL-32 中所有可修的预登记缺陷分配到 §6 的 owner（BL-02/08/09/10/13/16/19 → RIG-LOCO / TS-rig；BL-03/11/12 → LEAD + BIKE-DRIVE；BL-04/05/06/18/20/25 → LEAD / UI / I18N-KEYS；BL-07/21 → TS-repro / LEAD；BL-14/15 → RIG-FACE / RIG-ACT；BL-17 → PERF-ARCH；BL-22/28 → TR1 / TR2 门槛；BL-23 → UI + BAKER；BL-29 → DIR；BL-31 → PKG；BL-32 → TYPE）。

---

*同模型自评声明：本方案中的全部"预期分数"与"达标"判断都将由与构建者同一模型家族的 Claude 子代理按本团队自己写的 rubric 给出，不是外部基准结果；唯一的真人评审是用户（G16）。*
