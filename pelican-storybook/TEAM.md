# 鹈鹕湾 · 最终团队设计（TEAM v1）

> **用户原话（最高优先级）**："我需要你最终教出来的版本细节比 draft 多很多"（"教"应为"交"）。本设计把这句话当作一条**硬性、可测、每 20 分钟都会被检查一次**的要求来落实：先做到"草稿的每一条细节都在"（parity，梯级 0），再做到每一层至少 2 倍，全局内部目标 **481 条，是草稿 129 条的 3.73 倍**。另有一张"草稿 vs 成品同位置对照图"，在两次用户检查点（G16）都会发给用户本人看。
>
> **基础**：风格 C（复古旅行海报，由用户选定，见 `docs/STYLE-C.md`）；rubric v2.0.0（`rubric.json`、`RUBRIC.md`、`docs/rubric/items.json`）；`CONTRACT.md`、`docs/rig-spec.md`、`src/contract.js`、phase-0 脚手架。模块接口 `build(ctx)/attach(svg,ctx)` 不变，phase-0 文件在原地演进。
>
> **可运行的编排脚本**：`docs/team/wf-build.v1.js`。它是一个脚本、多个 `mode`，每个 mode 作为一个独立的 workflow 实例启动，由 Lead 让多个实例同时运行（见 §5.3）。
>
> 本文中所有分数、阈值预测与墙钟估计都是规划用的**同模型自评**预估（评审是与构建者同一模型家族的 Claude 子代理），不是测量结果。

---

## 0. 一页结论

**选定的底座：pipeline-throughput（流水线吞吐路线）。** 两轮评审都把它排第一或并列第一：预期得分 85/85，可行性 7/7.5，覆盖 9.5。它的骨架原样保留：
- 车道 workflow，每条车道一个 git worktree；
- merge train 持续集成；
- T0–T4 五级门槛，结果带缓存；
- shotd 渲染池 + 调速器；
- 接口先行的锁点；
- H4 性能金丝雀；
- 共用的风格 C 细节工具包 `src/art/kit/*`；
- 细节梯子；
- 滚动修复队列 + 快照轮。

**嫁接进来的最强点子（10 项）：**

| # | 来源 | 点子 | 放在本设计的哪里 |
|---|---|---|---|
| 1 | 锦标赛 | **Red Court**：任何 ≥9 的分数（轮次、影子评分、对决投影分）都要过 J-adv（找 ≥5 个缺陷）+ J-valid，按严重度封顶（blocker 封 6，major 封 8） | §7.4；脚本 `redCourt()` |
| 2 | 锦标赛 | 每个评审包都混入**诱饵**（草稿 C 的同部件，或 mutant）和 canary。评审没能把诱饵排在最后，或者召回率低于 80%，他的票就作废 | §7.3 |
| 3 | 锦标赛 | 按 TVI 只在"主观、高权重、高方差、可替换"的部件上开对决：头部（在整只鸟上评，不评孤立裁图）、墨组（在草稿上换墨后评）、标志性时刻（3 个概念 → 2 个原型 → 1 个，亚军转为 encore）、pelican-mini（3 名手写者，对照同模型单次生成）、踩踏手感参数（TR9），以及 3 个细节对决区 | §5.5；`mode:'duel'` |
| 4 | 锦标赛 | **并集收割**：细节对决的败者里，独有、可见、合风格、不遮挡、不降低显著性的条目，并入胜者的文件。收割加了 3 道新防线（见 §5.5.3），专门对付评审指出的"缝合怪 / 刷量"风险 | §5.5.3 |
| 5 | 锦标赛 | 候选目录 `src/candidates/<duel>/<entry>/`，通过 `?variant=` 注册表切换；dist 里不打包候选；`graft-check` 要求嫁接前后像素差 ≤0.5% | §2.5、§6 |
| 6 | 纵深专家 | **梯级 0 = parity**：草稿基线的 129 条要逐条重建（现在是带 rig 的），缺一条就算 bug。merge train 会**拒收任何让某个 owner 的细节条目数变少的合并** | §5.4 |
| 7 | 纵深专家 | **只读细节侦察兵**：3 名 DS，每个梯级换新实例。他们把草稿和成品同位置的 1×/3× 裁图并排看，产出按"1× 可见度"排序的 backlog | §4.8 |
| 8 | 纵深专家 | **按维度组的循环状态机**：STOP 条件是维度 ≥9.3、每个 criterion ≥8、核心项 ≥8.5；STALL 条件是连续 2 次提升 <0.3。停滞后升级为：三方分诊 → 挑战者 → 契约变更 → 接受差距。**D4 与 D13 的鹈鹕部分合成一个循环**，用同一个构建一起评 | §5.6 |
| 9 | 纵深专家 | `parts` + `PART_Z` 分段（与吞吐路线的 parts 统一成一个原语），加上每个 band 的节点与光栅预算 | §2.4 |
| 10 | 纵深专家 | 旋转件上的细节要过 flicker/摩尔纹检测；旋转件还要过 wagon 检测 | T1 门槛 |

**修掉的已判定风险（评审点名的风险 → 本设计的修法）：**
- **合成负载可能误报通过** → 金丝雀改用**真实负载**。把草稿 C 的真实路径（网点、长 `d` 串、编织、扇贝）按 3.5× 复制到各 band 里（`?synthload=draft:3.5`）。R-a 时再用真实美术复测一次；之后每 2 小时的安静窗口都复测，形成**持续金丝雀**。
- **merge train、调速器是后台进程，可能悄悄停掉** → 它们每轮写心跳文件 `docs/team/heartbeat.json`。每个车道代理启动前先跑 `node tools/train-watch.mjs`：心跳超过 25 分钟，就由它代跑一轮 `merge-train --once`（持锁，天然幂等）。Lead 每次查看进度时也会检查心跳。
- **shotd 不稳定** → shotd 本身要过 tool-validity。回退路径（每个工具自己起浏览器）也必须经过同一个信号量 `tools/lib/lock.mjs`（上限 3 个浏览器），所以不会退化回 BL-21 那种渲染争抢。
- **峰值 12 个代理挤 4 核** → 目标 ≤10 个并发代理，硬上限 12。车道按松弛时间错峰；field 车道提前到 H4.5 结束（§5.3）。
- **鹈鹕细节压在 2 名美术身上** → 拆成 3 名：DA-head、DA-plume、DA-legs。他们用同一个 kit、同一套条目命名规则，头部和身体各有一场细节对决帮着补量。但**不**采用纵深路线的 10 人拆分，接缝和风格漂移风险太大。
- **影子评审偏宽** → 影子评审也混 canary；影子 ≥9 同样要过 Red Court；记录每轮"影子分 − 轮次分"的偏差，**R-final 入场线 = 9.3 + 实测偏差**（§7.6）。
- **强制设计种子会带着作品偏离草稿 C** → 所有种子都必须是"风格 C 之内"的变体（例如"忠实精修"对"博物准确"），没有"更大胆的 deco"之类偏离草稿的种子。草稿 C 的同部件一律作为诱饵放进评审包。
- **对决在孤立裁图上胜出，整合后却显得差** → 头部对决的参赛作品挂在同一个身体形体上，在**整只鸟的 hero、12 相位 close 与 256 px notext 图**上评，不用孤立的头部裁图。
- **收割拼成缝合怪** → 收割条目只能用 kit 的生成器重写（不许原样粘贴），还要过 check-style、saliency（降幅 ≤0.05）、SK 否决，以及 J-valid 的"同一设计语言"判定。
- **收割变成刷量机器** → 胜负按"更好"定，"更多"只作次要项；收割来的条目也要过 DV-AUDIT；每个区域收割 ≤8 条。
- **数量配额带来 Goodhart 压力** → 配额按"区域 × 1× 可见度"下发，不按 owner 的原始条数；DV-AUDIT 专门查刷量；J-blind 的"你会删掉什么？"每个梯级都跑。
- **契约热点（contract.js、main.js）级联 rebase** → ARCH 是唯一 owner。契约变更只在 3 个**固定契约窗口**（H6、H10、H14）批量落地，窗口之间只收迁移说明。
- **34 h 太乐观** → 典型估计改为 **38 h，区间 33–44 h**。H40 设保险丝：还在修复就直接进 R-final。

**规模**：63 个角色（建造侧 53，评估侧 10 类），整个运行约 380–480 个代理实例。README 按角色分列这些数，不发布单一总数（G6）。

---

## 1. rubric 读回（驱动设计的事实）

- **达标**需要同时满足：
  - 全部门槛通过，包括 G-DETAIL、G16、G17；
  - 每维度 ≥9.0；
  - T_final = T·min(1, H/9) ≥92；
  - 没有 criterion <7；
  - 感知核心 13 项（C1.3 C4.1 C5.1 C5.2 C6.1 C6.3 C7.1 C7.2 C7.6 C7.7 C8.1 C13.1 C13.2）每项 ≥8。
- 只有 R-final 的分数有效。加权平均要 ≥9.2，所以**必须拿到被盲评在 1× 主动看到的 10 分额外项**。
- **维度权重**：D1 11 · D7 10 · D13 10 · D5 9 · D2/D3/D4/D6 各 8 · D11 7 · D8/D9 6 · D12 5 · D10 4。
- **封顶最狠的门槛**（优先防守）：G15 → 0；G1/G6 → 30；G2 → 40；G3/G7/G17 → 50；G5/G9/G10/G11/G-DETAIL → 60；G8/G12/G13/G14 → 70；G16 → 89。
- **感知核心的 13 项里，有 9 项落在鹈鹕、细节与表演上**，这就是关键路径必须给鹈鹕的原因。
- **细节**（G-DETAIL + D13，合计 10 分权重，再加 G-DETAIL 的 60 封顶）是用户点名的要求：
  - 门槛：总数 ≥2.5×（≥323），鹈鹕与车各 ≥2.0×，其余每层 ≥1.5×；
  - zoom-coverage ≥85%，且没有 ≥4 个连续空白格；
  - 2 名 J-detail 在 7 个区域里 ≥6 个判"更多"；
  - 全部细节开启时 G9 仍然成立。
  - 10 分档要 ≥3.5×，以及鹈鹕 ≥97%、车 ≥95% 的覆盖。

---

## 2. 拓扑：车道、实例、worktree、集成、渲染

### 2.1 车道（每条车道 = 一个 `wf-build.v1.js {mode:'lane'}` 实例 + 一个 worktree）

| 车道 | 分支 / worktree | 槽 1（串行链） | 槽 2（串行链） | 活跃时段 |
|---|---|---|---|---|
| **A** 冻结 | `integ`（主树） | ARCH：A1 契约 v1 → A3 步行骨架 + 金丝雀 | DIR：A2 导演文档 | H0–H4.5 |
| **T** 工具 / 评估 | `lane/tools` | 工具队列（偶数项） | 工具队列（奇数项）；H4.5 起为 EL 的 R0 | H0–H18，之后转评估 |
| **F** 隔离 | `lane/field`（不含 rubric 与 docs/team） | FB#1 → FB#3 → 单次生成对照 | FB#2 → RT | H0–H4.5 |
| **D** 导演 / 风格 | `lane/direct` | DIR：X3 开场、机位、竖屏、自动导演、彩蛋 | SK：墨组对决 → kit → 风格值班 | H2.5–H18 |
| **R** rig / fx | `lane/rig` | RIG-L → RIG-F → RIG-A | FX（H6 起） | H2–H18 |
| **P** 鹈鹕形体 | `lane/pelican` | PB：剪影锁 → 头部锁 → 身体锁 → E2 | PL：脚 → 翼 → DA-legs | H2.5–H18 |
| **P2** 鹈鹕细节 | `lane/pelican-detail` | DA-head（H7 起） | DA-plume（H9.5 起） | H7–H18 |
| **B** 自行车 | `lane/bike` | BK → DA-drive | DA-bikehw（H5 起）→ DA-cargo | H2.5–H18 |
| **W** 世界 / 版式 | `lane/world` | SEA → DA-sea → DA-sky | LAND → SKY → DA-land → DA-print | H2.5–H18 |
| **X** 系统 | `lane/systems` | UI → AUD → PKG | BAKE（H4 起）→ SPEC | H2.5–H20 |
| **Duel** 对决 | `src/candidates/**`（与主干文件不相交） | 挑战者 / 参赛者 | 评审 | 见 §5.5 |

- 车道边界按"耦合强、需要频繁互看"的部件来划（身体 ↔ 肢体，车架 ↔ 五金），不按 rubric 维度划。
- 同一车道的两个槽共享一个 worktree，零合并成本，能看到彼此的最新作品。

### 2.2 worktree 与分支

```
claude/gracious-allen-1ksl3j   ← 最终 PR 分支，只接受 integ 的快进
  └─ integ                     ← merge train 维护，任何时刻都能构建
       ├─ lane/{tools,direct,rig,pelican,pelican-detail,bike,world,systems}
       └─ lane/field           ← 从 H0 的 integ 分出，永不合并，只导出冻结的基线产物
/home/user/pb-wt/<lane>/pelican-bicycle   ← 每个 worktree；node_modules 是主树的 symlink
```

- `tools/lane.mjs create <lane>` 负责三件事：建 worktree、建 symlink、写 `docs/team/lanes/<lane>.json`（状态、owner 名单、梯级、blockedBy）。
- `tools/drop.mjs` 是构建者**唯一的提交入口**，依次做：
  1. 跑 T0 和受影响的 T1；
  2. 跑 ownership；
  3. 跑 detail-diff（这个 owner 名下的条目数不许变少）；
  4. 提交 `[drop] <agent> <files> gates=<hash> detail=+N`；
  5. 把记录追加到 `docs/team/ledger/<lane>.jsonl`。

  代理自己永远不直接 `git commit`。

### 2.3 merge train（脚本，带自愈）

`tools/merge-train.mjs`，每 20 分钟跑一轮，有新 drop 时也会触发：
1. 按优先级 P、P2、R、B、W、X、D、T，把有新 drop 的车道 rebase 到 integ。有冲突就按 `owners.json` 路由给对应 owner，并写入 `blockedBy`。
2. 在临时 worktree 里跑：T0 全部 + T1 受影响子集（经 gatecache 缓存）、`ownership.mjs`、`vr.mjs --locality`（像素差必须落在改动 owner 自己的 ID-map 区域内）、`detail-diff --no-negative`。
3. 全绿就快进 integ；否则拒收，把报告和截图路径写回车道状态。
4. integ 每前进一次，跑 T2 轻量集，并更新 `docs/detail/dashboard.json` 与燃尽图。
5. 每 2 小时一个**安静窗口**：拿 `/tmp/pb-cpu.lock`，shotd 暂停 5 分钟，跑一次 `perf.mjs`（wide + close，各 20 s），这就是持续金丝雀。fps 比上个窗口掉了 ≥3，就把最近的合并按 band 二分定位，把回归派给该 band 的 owner。
6. **心跳**：每轮写 `docs/team/heartbeat.json {round, integSha, ts}`。`tools/train-watch.mjs` 发现心跳超过 25 分钟，就自己跑一轮 `--once`（持锁、幂等）。车道代理启动前、Lead 每次查看时，都会跑一次 train-watch。

### 2.4 契约 v1 新增的原语（ARCH 在 A1 落地，统一两份提案）

1. **parts**：任何文件都可以导出 `parts = [{target:'slot:body'|'layer:L-shore', z, id, build(ctx), attach?}]`。`src/core/parts.js` 按 target 与 z 把它们组合起来。
   - `PART_Z` 按 owner 分段：形体 0–49，细节 50–89，收割 90–99。
   - z 越界，或者 owner 未在 `owners.json` 里登记这个 target，`check-contract` 就失败。
2. **data-detail / data-tract / data-text / data-size-m / data-stretch / data-rotating**：一律由 `kit.detail(layer, kind, name, markup)` 自动加上。名字必须在 `docs/detail/registry.json` 中登记（T0 lint 检查）。
3. **merge-static**：静态 band 在构建时按"条目内、按墨"合并路径，保留条目根 `<g data-detail>`，重复元素用 `<use>`。
4. **band 预算**（`budgets.json`，merge train 强制执行）：

   | band | 静态 path 上限 | 光栅 p95 预算（ms/帧） |
   |---|---:|---:|
   | B-sky | 200 | 0.6（光芒旋转） |
   | B-far | 200 | 0.8 |
   | B-mid / B-near | 各 200 | 各 1.2 |
   | B-rider | ≤1100 个节点 | 3.5 |
   | B-wheels | 150 | 1.5 |
   | B-front / B-frame | 各 200 | 各 0.8 |

   超预算只能靠工程手段修（合并、`<use>`、LOD、≤4 个合规缓存），**不能删细节**。
5. **钩子**：`?notext ?nofx ?idmap ?silhouette ?skeleton ?inspect ?mutant=<id> ?variant=<slot>:<entry> ?solo=<part|owner> ?crop=<region> ?synthload=draft:<k> ?nocache ?moment= ?detail=heat`，以及 `renderAt(t,{tod,cam,cadenceSchedule,eventsLog,pointerLog,quality,viewport,flags,intro})`。
6. rubric §13.1 的 18 项契约变更（z-band、spider slot、整数链节 125.433、锚点、keymap/i18n 位置、竖屏机位接口……）**全部**在 A1 落地。

### 2.5 候选与嫁接（对决专用）

- 参赛者只拥有 `src/candidates/<duel>/<entry>/**`，经 `src/art/variants.js`（ARCH 拥有）用 `?variant=` 切换。
- `tools/build.mjs` 排除 candidates；`check-purity` 断言 dist 里没有候选内容。
- 胜者由其 owner 按接口搬进正式路径，并跑 `tools/tourney/graft-check.mjs`：在对决证据的全部帧上像素差 ≤0.5%，且全套门槛通过。

### 2.6 渲染池与调速器

- `tools/lib/shotd.mjs`：3 个预热的 Chromium 槽，按 worktree 分别起服务器，缓存键 = (树哈希, URL, 参数)。
- 优先级：merge train > R 轮证据 > P/P2/R > B/W > 对决 > D/X/T。
- `tools/governor.mjs` 读排队时间与 load average。排队 >60 s 时，低优先级车道在开新代理前等待（`governor wait`）。perf 与 soak 独占 `/tmp/pb-cpu.lock`。

---

## 3. 覆盖矩阵（criterion → 产出者 → 验证者 → 证据 → 门槛 → 循环）

**记号**：
- **验证者层级**：T0/T1/T2/T3 为自动门槛，J-* 为 T4 评审（每轮全新）。
- **RC** = Red Court（中位分 ≥9 时触发）。
- **循环**（§5.6）：
  - L1 = 正典 / 机械 / 接触（D1、D2、D3、C12.8）；
  - L2 = 鹈鹕（D4 + C13.1/C13.2 的鹈鹕部分 + C1.3 + C7.6 的角色修正）；
  - L3 = 动作 / 表演（D5、D6）；
  - L4 = 美术 / 细节 / 惊艳（D7、C13.3–C13.6、D8）；
  - L5 = 系统（D9–D12）。
- **对决**（§5.5）：Dh = 头部、Di = 墨组、Dm = 标志性时刻、Dn = mini、Dp = 踩踏手感参数、Dx = 细节。

机器版 `docs/team/coverage.json` 由 `tools/coverage.mjs` 从 `rubric.json` 与 `wf-build.v1.js` 里的 `COVERAGE` 常量生成。任何无主的 criterion 或门槛都会让 G14 失败。

### 3.1 criterion（79 项）

| ID | w | 产出者 | 自动验证者 | 评审验证者 | 证据 | 门槛 | 循环 / 对决 |
|---|---|---|---|---|---|---|---|
| C1.1 | 3.5 | RIG-L（接触）、BK（车锚点）、PL（足、腕锚点） | T1 check-anchors 12 相位 → T2 全网格 + 锚点审计 + check-benchmark | 3 J-blind CANON-14（notext + canary）+ RC | docs/eval/canon.json, anchor-audit.json | G2 G3 | L1 |
| C1.2 | 2 | ARCH（slot/band 次序）、PL（远侧平涂）、BK（远曲柄） | T1 check-occlusion 12 相位（?idmap）→ T2 72 相位 | 2 J-adv + 1 J-valid | docs/eval/occlusion.json | G2 | L1 |
| C1.3 ★ | 3.5 | PB（剪影、喉囊）、SK（明度） | T2 thumb + silhouette；H9 早期物种快测 | 5 J-blind（开放识别、诱饵、遮头、CVD）+ RC | docs/eval/thumb.json | G7 | L2 / Dh |
| C2.1 | 4 | BK | T1 check-bike（管端 ≤0.5 u，角度 ±0.5°） | D2 J-lens ×3 + 开放式机械找错 | docs/eval/bike.json | G2 | L1 |
| C2.2 | 3 | BK、ARCH（spider、整数链节） | T1 check-bike --drivetrain | D2 J-lens + 传动 4 px/u 裁图 | docs/eval/drivetrain.json | — | L1 |
| C2.3 | 3 | RIG-L、LAND（视差） | T1 check-kinematics；T2 check-noslip | —（纯脚本） | docs/eval/kinematics.json, noslip.json | G4 | L1 |
| C2.4 | 2 | BK、DA-drive | T2 wagon（20–110 rpm）；每次 drop 跑 wagon 快速版 | 1 名逐帧方向评审 | docs/eval/alias.json | G4 | L1 |
| C2.5 | 1.5 | BK、DA-drive | T1 check-bike --wheels（3-cross 67.5°±1°） | D2 J-lens（花鼓裁图） | docs/eval/bike.json | — | L1 |
| C2.6 | 1.5 | BK、DA-bikehw | T1 check-bike --cockpit | D2 J-lens（座舱裁图） | docs/eval/bike.json | — | L1 |
| C2.7 | 1.5 | BK、DA-bikehw、DA-drive、DA-cargo | T2 shoot --set crops（4 px/u） | J-mech（先开放式清点）+ D2 J-lens | docs/eval/mech-assembly.json | G-DETAIL（间接） | L1 / Dx |
| C3.1 | 3 | RIG-L、PL、BK、LAND（前景不遮接触区） | T1 check-contacts；T2 contact-probe | 1 名找缝评审 | docs/eval/contacts.json | G3 | L1 |
| C3.2 | 2 | RIG-L、PB（腹轮廓）、BK（座形） | T0 check-rig --seat；T2 腹座背景像素 | D3 J-lens（座组裁图） | docs/eval/seat.json | G3 | L1 |
| C3.3 | 2 | RIG-L | T0 check-rig --biomech（KOPS、膝角） | D3 J-lens | docs/eval/biomech.json | — | L1 |
| C3.4 | 2 | RIG-A | T1 motion-audit --events（抛物线 R²、g） | 跳车 / 滑行密集帧找缺陷评审 | docs/eval/dynamics.json | — | L1 |
| C4.1 ★ | 3 | PB、DA-head、DA-plume | T2 thumb --head3x；H9 早期快测 | 3 J-blind 物种识别 + J-anat 逐项 FM-10 + RC | docs/eval/species.json | G7 | L2 / Dh |
| C4.2 | 2 | PB、DA-head | T1 check-anatomy --head（喉囊存在率、ΔL*） | D4 J-lens（头 3× 裁图） | docs/eval/anatomy-head.json | G7 | L2 / Dh |
| C4.3 | 1 | PB（neckD）、RIG-F | T1 motion-audit --head | D4 J-lens | docs/eval/anatomy-neck.json | — | L2 |
| C4.4 | 1.5 | PL、DA-plume | T0 check-rig（握把）；T1 check-anatomy --wing（≥4 枚羽尖） | D4 J-lens（wing3x） | docs/eval/anatomy-wing.json | G7 | L2 / Dx |
| C4.5 | 1.5 | PL、DA-legs | T1 check-anatomy --legs（4 趾、蹼、裤管） | D4 J-lens（foot3x） | docs/eval/anatomy-legs.json | G7 | L2 |
| C4.6 | 1.5 | DA-plume（data-tract）、SK（墨组） | T1 check-style --colour（6 时段相对色彩约束） | D4 J-lens | docs/eval/anatomy-colour.json | — | L2 / Di |
| C4.7 | 1 | PB、PL、ARCH | T1 check-anatomy --scale | —（纯脚本） | docs/eval/anatomy-scale.json | — | L2 |
| C5.1 ★ | 2 | RIG-L | T1 motion-audit（骨盆 y 对曲柄）+ cycle24 | 3 J-blind 按速度排序 + RC | docs/eval/motion-audit.json | G10 | L3 / Dp |
| C5.2 ★ | 2 | RIG-L（secondary）、RIG-A | T1 motion-audit --lag + onion | 密集帧找缺陷 + D5 J-lens + RC；用户在 G16 给手感意见 | docs/eval/motion-audit.json | G10 | L3 / Dp |
| C5.3 | 2 | RIG-A | T1 motion-audit --fuzz 300 | D5 J-lens（arcs 图） | docs/eval/fuzz.json | G10 | L3 |
| C5.4 | 2 | DIR（timing.md）、RIG-A | T1 check-timing（±2 帧） | 盲评从 nofx 密集帧命名事件 + A/B | docs/timing.md, docs/eval/events.json | — | L3 |
| C5.5 | 1.5 | RIG-F、RIG-A | T1 motion-audit --face 120 s | D5 J-lens + 代码审查 | docs/eval/avian-motion.json | — | L3 |
| C5.6 | 0.5 | RIG-A、FX、DIR（机位阻尼） | T1 motion-audit --transitions | D5 J-lens | docs/eval/transitions.json | — | L3 |
| C6.1 ★ | 2 | DIR（character.md）、PB（面部）、RIG-F | T2 judge/acting（三联图打包） | 3 J-blind 15 选 3 + D6 J-lens + RC | docs/character.md, judges/character-* | — | L3 |
| C6.2 | 1.5 | RIG-F、PB | T1 motion-audit --face（视线目标） | D6 J-lens | docs/eval/face.json | — | L3 |
| C6.3 ★ | 2 | RIG-A、DIR、FX | T2 check-temporal | 5 J-blind（nofx 描述 + 4 选 1）+ RC | judges/gags-*, docs/eval/temporal.json | — | L3 |
| C6.4 | 1.5 | RIG-A、PB（隆起）、DA-cargo（鱼） | T1 motion-audit --gulp | D6 J-lens（gulp 条带） | docs/eval/gulp.json | — | L3 |
| C6.5 | 2 | DIR（beats.md、自动导演） | T2 loop-seam + interact --idle 90 s | 1 名盲评复述故事条带 + 强制选择 | docs/beats.md, docs/eval/idle.json | — | L3 |
| C6.6 | 1 | FX（鸥群）、DIR | T2 配角条带 | D6 J-lens + 代码审查 | shots/eval/gulls/ | — | L3 |
| C7.1 ★ | 2 | DIR（开场）、DA-print（标题卡）、ARCH（首帧） | T2 first-look（4× 节流） | 5 J-blind 开场强制选择 + RC | docs/eval/first-look.json | G8 | L4 |
| C7.2 ★ | 2 | SK（墨组、kit、风格值班） | T1 check-style + judge/palette | D7 J-lens（grid-30 + wild）+ RC | docs/eval/palette.json, ink-sets.json | — | L4 / Di |
| C7.3 | 2 | SK、SKY、SEA、LAND、FX | T2 judge/saliency 6 时段 | D7 J-lens（tods 包） | docs/eval/saliency.json | — | L4 |
| C7.4 | 2 | DIR（机位、竖屏） | T2 judge/film（45 帧） | 3 名电影联系表强制选择 | docs/eval/camera.json | G8 | L4 |
| C7.5 | 2 | 全部美术 owner | T2 judge/seams + judge/edges | 2 J-adv + 1 J-valid（3× 裁图） | docs/eval/zoom-defects.json | — | L4 |
| C7.6 ★ | 2 | SK、PB、PL | T1 check-style（网点位置、远侧平涂、渐变量化） | 5 J-blind 同风格成对 + 限色印刷判定 + RC | docs/eval/style.json | — | L2+L4 |
| C7.7 ★ | 2 | SK + DIR（克制否决权）、DQM | T2 saliency ≥1.4 | 5 J-blind 3 选 1 +"你会删掉什么" + RC | docs/eval/appeal.json, docs/composition.md | — | L4 / Dh |
| C8.1 ★ | 3 | MOMENT（Dm 胜者）、ARCH（band 机制）、DIR | T2 ?moment= 确定性渲染 + eggs.mjs（≥55 fps） | 3 J-blind 开放式回忆 + RC | README.md#signature, docs/eval/moment.json | D8 特别上限 | L4 / Dm |
| C8.2 | 1.5 | 全队；FB 出匹配投入基线 | T2 field.mjs | 5 J-blind × ≥40 配对 | docs/eval/field.json | — | L4 |
| C8.3 | 1 | DIR（eggs.js）、ENCORE（Dm 亚军） | T2 judge/eggs | J-user 探索者（harness） | docs/eggs.json, docs/eval/explorer.json | — | L4 / Dm |
| C8.4 | 0.75 | AUD | T1 audio-check；T2 audio-offline | D8 J-lens；9–10 分需用户（G16） | docs/eval/audio.json | G11 G16 | L5 |
| C9.1 | 1.5 | UI、DIR（首次提示） | T2 ux-matrix | 2 名冷启动 J-user（桌面 / 390 px） | docs/eval/cold-start-*.json | — | L5 |
| C9.2 | 1.5 | UI | T2 ux-matrix + contrast + judge/controls | D9 J-lens | docs/eval/ux-matrix.json | — | L5 |
| C9.3 | 1 | UI、RIG-A | T2 interact.mjs | D9 J-lens | docs/eval/interact.json | — | L5 |
| C9.4 | 1 | UI（keymap.js） | T1 keys.mjs | D9 J-lens 代码审查 | docs/eval/keys.json | G12 | L5 |
| C9.5 | 1 | UI、ARCH | T1 a11y.mjs（axe 10 状态 + ariaSnapshot） | J-a11y | docs/eval/a11y.json | G12 | L5 |
| C9.6 | 1 | UI、ARCH、FX | T1 flash-check + reduced-motion 对比 | — | docs/eval/flash.json, reduced-motion.json | G11 | L5 |
| C9.7 | 1.5 | DIR（竖屏机位）、UI（底部抽屉） | T1 ux-matrix --mobile | D9 J-lens | docs/eval/mobile.json | G8 | L5 |
| C9.8 | 1 | UI（i18n.js）、DA-print | T0 i18n-lint；T1 cjk-glyph + check-text | J-bi | docs/eval/i18n.json | G12 | L5 |
| C10.1 | 2 | ARCH | T2 perf.mjs（独占锁，3×20 s 中位） | D10 J-lens | perf/perf.json | G9 | L5 |
| C10.2 | 1.5 | ARCH、band owner | T2 perf --paint（合成面积 ≤3.0） | D10 J-lens | perf/paint.json | G9 | L5 |
| C10.3 | 0.5 | ARCH、各 update() owner | T2 perf --js | — | perf/js.json | — | L5 |
| C10.4 | 0.5 | ARCH | T3 soak 12 min（R-final 60 min） | — | perf/soak.json | G10 | L5 |
| C10.5 | 0.5 | ARCH | T0 audit-dist | — | perf/dist-audit.json | G1 | L5 |
| C10.6 | 0.5 | ARCH | T2 xb-audit；T3 xb-webkit（R0 判 N/A 与否） | — | docs/eval/xb.json | — | L5 |
| C10.7 | 1 | ARCH | T2 robust + contexts | — | docs/eval/robust.json | — | L5 |
| C10.8 | 0.5 | ARCH | T1 console 收集器 + T2 故障注入 | — | docs/eval/console.json | G1 | L5 |
| C11.1 | 3 | BAKE、MINI（Dn 胜者） | T2 check-baked --static + mini 检查 | 3 J-blind 对烘焙 6 帧答 CANON-14；Dn 对单次对照 ≥60/80% | docs/eval/baked.json, mini.json | G5 | L5 / Dn |
| C11.2 | 2 | BAKE | T2 check-baked 48 相位 + loop-seam | — | docs/eval/baked.json | G5 | L5 |
| C11.3 | 0.5 | PKG | T2 judge/package（帧数 = 时长×60） | D11 J-lens + 海报淘汰赛 | dist/poster.png, preview.webm | G13 | L5 |
| C11.4 | 0.5 | UI、BAKE | T2 export-check + contexts（沙箱） | — | docs/eval/export.json | G13 | L5 |
| C11.5 | 1 | PKG、Lead | T0 check-docs | D11 J-lens | README.md, docs/handoff.md | G13 G15 | L5 |
| C12.1 | 0.5 | ARCH | T0 check-contract | D12 J-lens | docs/eval/contract.json | — | L5 |
| C12.2 | 1.5 | RIG-L/F/A | T0 check-rig；T1 mutate-rig（100% 杀死） | — | docs/eval/rig.json, mutants.json | G3 G10 | L1 |
| C12.3 | 1 | ARCH | T1 determinism + vr | — | docs/eval/determinism.json | G10 | L5 |
| C12.4 | 0.5 | ARCH、TS-judge | T3 全新克隆 verify + 双构建哈希 | — | docs/eval/verify.txt | G14 | L5 |
| C12.5 | 1.5 | PKG（claims.json） | T0 verify-claims + readme-lint | D12 J-lens 人工审计 | docs/claims.json | G6 | L5 |
| C12.6 | 0.5 | SPEC（X 光检查模式） | T2 check-inspect | D12 J-lens | docs/eval/inspect.json | — | L5 |
| C12.7 | 1 | Lead | T0 ownership；T3 coverage + 隔离审计 | 2 名独立 D12 评审 | docs/team/ledger*, coverage.json | G14 | L5 |
| C12.8 | 1.5 | TS-geo、RT | T1 check-benchmark 对 RT 缺陷 100% 标红 | D12 J-lens | docs/eval/benchmark.json | G2 | L1 |
| C13.1 ★ | 3 | DQM + 全部 DA + 形体 owner | T0 registry lint；T1 inventory --layer；T2 全量 + detail-diff + parity | 2 J-detail；DV 预检；DV-AUDIT；RC | docs/eval/detail-inventory.json | G-DETAIL | L2+L4 / Dx |
| C13.2 ★ | 2.5 | DA-head、DA-plume、DA-legs、PL | T1 zoom-coverage --layer pelican | J-detail 鹈鹕组 + D13 J-lens 对 catalogue + RC | docs/eval/zoom-coverage.json | G-DETAIL | L2 / Dx |
| C13.3 | 2 | DA-bikehw、DA-drive、DA-cargo | T1 zoom-coverage bike + wagon | J-detail 车组（4× 裁图，golden + night） | docs/eval/zoom-coverage.json | G-DETAIL | L4 / Dx |
| C13.4 | 2 | DA-sea、DA-land、DA-sky（+ 形体 owner） | T1 inventory --layer；T2 check-scale + saliency | J-detail 世界组 | docs/eval/scale.json | G-DETAIL | L4 |
| C13.5 | 1 | DA-print | T1 check-text + inventory typography；T2 first-look | D13 J-lens（3× 裁图） | docs/eval/in-art-text.json | G-DETAIL | L4 |
| C13.6 | 1.5 | ARCH（merge-static）、SK、DQM | T1 check-detail-budget + flicker；T2 perf 全细节 + 深度衰减 | 5 J-blind 四区不损美术成对 | docs/eval/detail-budget.json | G9 G-DETAIL | L4 |

★ = 感知核心（进入 H 乘数）。

### 3.2 硬门槛（18 项）

| 门槛 | 产出者 | 自动验证者 | 评审验证者 | 证据 | 何时阻塞 |
|---|---|---|---|---|---|
| G1 构建与自包含 | ARCH | T0 build + audit-dist；T1 console | — | docs/eval/console.json | 任何轮次前；红则不开评审 |
| G2 基准正典 | RIG-L、BK、PL、PB | T1 check-benchmark（RS-cycle24） | 3 J-blind CANON-14 + J-valid | docs/eval/canon.json, benchmark.json | check-benchmark 红则不开评审 |
| G3 运动学与接触 | RIG-L、PL、BK | T0 check-rig --seat --events；T1 anchors + contacts | — | docs/eval/rig.json, seat.json | 红则不开评审 |
| G4 方向与不倒转 | RIG-L、BK、DA-drive、BAKE | T1 kinematics；T2 wagon + check-baked | 逐帧方向评审 | docs/eval/alias.json | 集成冻结 |
| G5 独立 SVG | BAKE、MINI | T2 check-baked --static + loop-seam | — | docs/eval/baked*.json, mini.json | 集成冻结 |
| G6 诚信 | PKG | T0 verify-claims + readme-lint | D12 J-lens 声明审计 | docs/claims.json | 发布前 |
| G7 物种与身体正典 | PB、DA-head、PL、DA-plume | T1 check-anatomy（喉囊 100% 在场） | 5 J-blind（notext、诱饵、遮头、128 px） | docs/eval/species.json | H9 形体锁快测；R1 |
| G8 手机与构图安全 | DIR、UI | T1 ux-matrix --mobile + first-look | — | docs/eval/mobile.json | A3 骨架出口 |
| G9 流畅 | ARCH | H4.5 金丝雀；每 2 h 安静窗口；T2 perf + live-parity | — | perf/perf.json | 金丝雀 < 55 fps 不放美术开工 |
| G10 连续与确定 | RIG-*、ARCH | T1 motion-audit --fuzz + determinism；T3 soak | — | docs/eval/fuzz.json | 集成冻结 |
| G11 动效与声音安全 | UI、ARCH、AUD、FX | T1 flash + audio-check + keys + reduced | — | docs/eval/flash.json | 集成冻结 |
| G12 无障碍底线 | UI、ARCH | T1 a11y + i18n-lint + cjk-glyph + keys | J-a11y | docs/eval/a11y.json | 集成冻结 |
| G13 交付完整 | PKG、BAKE、Lead | T2 judge/package + export-check + Artifact 回读 diff | — | docs/eval/package.json, publish.json | 发布 |
| G14 评估有效性 | Lead、TS-judge、EL | T3 全新克隆 verify + tool-validity + coverage + ownership + isolation | — | docs/eval/tool-validity.json | R0；R-final |
| G15 不冒充、有署名 | PKG、DA-print | T0 check-docs + 第三方 SVG 检查 | D11 J-lens 文案 | README.md, docs/THIRD_PARTY.md | 一票否决：任何发布前 |
| G16 用户检查点 | Lead | — | 用户本人 | docs/eval/user-checkpoint.json | R1 后、R-final 后 |
| G17 真的是 SVG | ARCH | T0 check-purity；T2 ?nocache=1 对照 | — | docs/eval/purity.json | 红则不开评审 |
| G-DETAIL | DQM + 全部 DA + 形体 owner | 每次 drop：inventory + zoom + detail-diff；T2 perf 全细节 | 2 J-detail + DV + DV-AUDIT | docs/eval/detail-*.json | 梯级 0/a/b/c；R1；R-final |

---

## 4. 代理名单（63 个角色）

### 4.0 为什么是 63 个角色、约 400 个实例

- **下限：细节量决定。** 要从 129 条做到 481 条，净新增约 350 条，还要维持风格一致、能在 3× 下经得起看，每名细节美术一次会话大约能稳定交付 30–45 条。这就需要 11 名 DA，外加 3 名形体 owner 承担一部分。再少，每个人的配额就大到会逼出刷量（这是评审点名的风险）。
- **上限：渲染吞吐和接缝决定。** 3 个 Chromium 槽约每分钟 60–150 帧，最多支撑约 10 名同时自检的代理。纵深路线把鹈鹕拆给 10 个人，被两名评审都判为最高的接缝与风格漂移风险。所以本设计的鹈鹕只有 **2 名形体 owner + 3 名细节 owner**，这 5 人共用一个 kit，接缝只出现在 PB ↔ PL 这一对上，而且他们同车道、同 worktree。
- **对决角色**（10 个）只放在 TVI 高的位置（§5.5），每个都有时间上限和"不在关键路径上"的约束。
- **评估侧**是 10 类角色，每轮都用全新实例，构建者永远不给自己打分。

### 4.1 通用提示骨架（所有构建者；脚本中是 `commonPrompt()`）

```
你是"鹈鹕湾"团队的 <ROLE>，在车道 <LANE> 的 worktree <WT> 工作。
风格 C（复古旅行海报，七墨丝网印刷）由用户选定；用户原话要求"最终交付的版本细节比 draft 多很多"。
必读：CONTRACT.md（v1）、docs/rig-spec.md、src/contract.js、docs/STYLE-C.md、
  drafts/C-poster/{keyframe,closeup}.png 与 gen.mjs、docs/character.md、docs/composition.md、
  docs/locks/*.json（与你相关的）、docs/detail/backlog/<你>.md、docs/rubric/creative-brief.md。
你拥有的文件：<FILES>。其余文件只读。需要别人改东西，写 docs/contract/requests/<你>-<n>.md。
循环（≥3 次视觉迭代）：改 → node tools/quick.mjs --solo <part> --crop <region> --pair-draft --dpr 3
  --tods golden,night（Read PNG）→ node tools/drop.mjs（T0 + 受影响的 T1；红了就修，不许绕过）。
  每 3 次 drop 看一次 node tools/cycle24.mjs --lane。
启动前：node tools/governor.mjs wait && node tools/train-watch.mjs。
验收：<ACCEPTANCE>（可运行命令 + 阈值）。你的 criterion：<CRITERIA>。你永远不给自己打分。
禁止：npm install、直接 git commit、读 docs/eval/judges/**、在运动部件上用 filter 或网点、
  Math.random、裸 hex、删除任何已登记的 data-detail 条目（merge train 会拒收）。
返回结构化报告 {owner, files, drops[], acceptance[{cmd,pass,out}], detailLinesAdded, done,
  contractRequests[], knownIssues[]}。
```

### 4.2 负责人、架构与风格（4）

| 角色 | 职责 | 拥有文件 | 输入 | 验收（可运行） |
|---|---|---|---|---|
| **Lead**（主会话，不是子代理） | 按 §5.3 启动 / 监控 workflow 实例；维护 merge train 心跳；用户联络（G16，中文）；PR、Artifact 发布；最终交接 | `tools/{merge-train,train-watch,lane,drop,ownership,governor,queue}.mjs`、`docs/team/{owners.json,lanes/*,ledger/*,heartbeat.json,queue/*,stop.json}` | 本文件 | ownership 审计 0 越界；`git status --porcelain` 为空；G13 的全部链接可达 |
| **ARCH** 契约 / 运行时 / 性能 | A1 契约 v1（含 §2.4 与 rubric §13.1 的 18 项）；A3 步行骨架（z-band、钩子、variants 注册表、真实负载金丝雀、竖屏框定）；之后做集成值班、性能（C10.x）、确定性（C12.3），主持契约窗口 H6/H10/H14 | `src/contract.js`、`CONTRACT.md`、`src/scene.js`、`src/main.js`、`src/core/{math,svg,bus,bakekit,bands,hooks,time,parts}.js`、`src/art/variants.js`、`src/index.dev.html`、`src/page.css`、`tools/{build,serve,merge-static}.mjs`、`budgets.json`、`docs/contract/**` | rubric §13.1、rig-spec | check-contract 绿；G8 在 390×844 / 844×390 / 720×800 下通过；`perf.mjs --query synthload=draft:3.5` 下 wide 与 close 都 ≥55 fps、p95 ≤25 ms；determinism a–c 通过；BL-02/03/04/05/06/17/18/25 关闭 |
| **DIR** 导演 | A2：character.md、timing.md（60 fps X-sheet）、beats.md（24 s 故事循环 ≤5 个节拍）、composition.md、角色草图（可选的 G16 预览）；X3：开场、机位（含竖屏、Artifact 面板）、自动导演、彩蛋，担任标志性时刻对决的组织方 | `docs/{character,timing,beats,composition}.md`、`docs/eggs.json`、`src/core/camera.js`、`src/director/{intro,autodirector,eggs,portrait}.js` | STYLE-C、creative-brief、D6/D7/D8 | check-timing ±2 帧；first-look 0.3 s 首帧完整；loop-seam ≤1.2；wide/cinematic 下骑者 100% 在画内；标题卡在任何机位下 0 遮挡；character.md 不含 6 个通用形容词 |
| **SK** 风格守护 / 墨组 / kit | 墨组对决的主作者；K1：kit（扇贝排、羽扇、排线、网点带（只给静态层）、编织、鳞纹、五金、deco 字形、票根虚线，均带 LOD 参数）；之后风格值班（每 2 h 审一次 integ 联系表），对"抢戏 / 违反 STYLE-C"的条目**有否决权**，对收割条目也有否决权 | `src/core/palette.js`、`src/art/kit/*.js`、`docs/style/{ink-sets.json,review-*.md}` | STYLE-C §1–§6、gen.mjs 的 dots() | check-style 0 违规；check-style --palette 6 时段通过；kit 生成器纯函数且种子化（node 测试）；saliency ≥1.4 |

### 4.3 工具匠（6，车道 T；T0 先于构建，T1 与美术并行）

| 角色 | 拥有（`tools/` 下） | 验收 |
|---|---|---|
| **TS-perf** 平台 | `lib/{shotd,lock,gatecache,gatemap.json,console}.mjs`、`shoot`、`sheet`、`render`、`lint`、`perf`（含 `--band`、`--paint`、`--js`、`synthload=draft:k`）、`live-parity`、`soak`、`robust`、`contexts`、`audit-dist`、`xb-*`、`check-purity`、`check-detail-budget`、`flicker`、`quick`、`cycle24` | tool-validity（fixture 通过、mutant 全失败、两次同结论）；shotd 冷启动 <5 s，缓存命中 <50 ms；**无 shotd 时回退路径仍受 3 槽信号量约束** |
| **TS-geo** 几何 / 正典 | `check-anchors`、`check-occlusion`、`check-contacts`、`contact-probe`、`check-benchmark`（含 mutant 画廊）、`check-bike`、`check-kinematics`、`check-noslip`、`wagon`、`check-anatomy`、`check-scale` | 同上；check-benchmark 对 RT 的 ≥10 个美术缺陷 100% 标红 |
| **TS-motion** 动作 QA | `check-rig`（扩展 --seat --biomech --events）、`mutate-rig`、`motion-audit`（--fuzz --events --face --lag --gulp --transitions）、`filmstrip --dense`、`onion`、`check-temporal`、`check-timing`、`determinism`、`vr`（--locality）、`loop-seam`、`check-baked`（--static） | mutate-rig 杀死率 100%；在 phase-0 的 BL-13/14 上报警 |
| **TS-ux** 体验 / a11y | `ux-matrix`、`first-look`、`interact`、`keys`、`a11y`（锁定版本 axe-core）、`contrast`、`flash-check`、`i18n-lint`、`cjk-glyph`、`check-text`、`audio-check`、`judge/audio-offline`、`export-check` | 在 phase-0 上检出 BL-01/05/06/23 |
| **TS-detail** 细节度量 | `detail-inventory`（--layer 打印被拒原因）、`zoom-coverage`、`detail-diff`（--no-negative）、`detail-parity`（梯级 0：129 个基线名全部在场）、`judge/detail-pairs`、`check-style`、`reink.mjs`（给草稿 C 换墨，供墨组对决用） | R0 在草稿上复核 129 条基线并锁定；zoom 阈值在草稿上校准后冻结 |
| **TS-judge** 评审系统 | `judge/{pack,harness,canary,wild,palette,saliency,seams,edges,acting,controls,film,eggs,package,redcourt}.mjs`、`tourney/{pack,bt,graft-check}.mjs`、`score`、`predict`、`coverage`、`tool-validity`、`field`、`verify`、`verify-claims`、`readme-lint`、`check-docs`、`check-contract`、`check-inspect`、`blind-lint` | score.mjs 对 items.json 的手算样例 100% 一致；harness 不暴露 DOM / aria / evaluate；bt.mjs 在合成偏好数据上恢复已知排序 |

### 4.4 rig（3，车道 R 槽 1 串行）

| 角色 | 拥有文件 | 验收 |
|---|---|---|
| **RIG-L** 行进 / 重量 | `src/rig/{solve,ik,locomotion,secondary,presets}.js`、`src/rig/*.test.js`（locomotion）、`src/art/debug-skeleton.js` | G3 全部（每个解析样本腹—座 ≤1 u；KOPS）；飞轮 ≡ 3×曲柄（含滑行）；24 s 精确周期；下踩期有可测的"发力沉降"；冠、喉囊、尾的滞后 >0；H6 发布 L-pose-fields v1；**`presets.js` 暴露 6 组预设给 Dp 对决** |
| **RIG-F** 视线 / 面部 | `src/rig/face.js`、`face.test.js` | pose.gaze；瞬膜横扫眨眼（100–200 ms，非周期）；头部急动；表情状态机；motion-audit --face 120 s 不呈节拍器式 |
| **RIG-A** 表演 / 事件 | `src/rig/events.js`、`events.test.js` | 跳车（预备蹲 ≥8 帧、抛物线 R² ≥0.98、g ∈ 2885±25%）；挥手时车把有转向响应；吞鱼完整序列（头后仰 ≥40°、颈部隆起下行）；事件可叠加、可打断，fuzz 300 日程 0 跳变 |

### 4.5 鹈鹕（2 形体 + 3 细节）

| 角色 | 拥有文件 | 验收 |
|---|---|---|
| **PB** 身体 / 头 / 喙 / 喉囊形体 | `src/art/pelican-body.js` | H4.5 剪影锁；H6.5 头部对决（与 HEAD-CH）；H7 头部锁；H9 早期物种快测 3/3 首先说出"鹈鹕"；表情满足（去掉厚眼线）；喉囊在所有状态都在；neckD 命令数固定；E2：喉囊隆起、颈部隆起、表情 |
| **PL** 翼 / 腿 / 脚形体 | `src/art/pelican-limbs.js` | 翼读作翼（覆羽根部并入体侧、次级飞羽像流苏垂下、N 色初级飞羽后扫、握把处 ≥4 枚羽尖且没有指节）；全蹼足 4 趾平贴踏板；远侧平涂 B/N；12 相位接缝 0 |
| **DA-head** 头颈细节 | `src/art/detail/head.js`（parts → head/billUpper/billLower/pouch/eye/crest/neck、围巾） | catalogue 头部 6 项（喙脊、喙缘、钩的高光与下钩、眼周裸皮 + 眼睑 + 高光、冠羽丝 ≥7 缕、喉囊纹理随 sy 拉伸 0 撕裂、围巾条纹 / 织纹 / 流苏）；头部 zoom-coverage ≥97%；配额 36 条 |
| **DA-plume** 身 / 翼 / 尾细节 | `src/art/detail/plume.js`（parts → body/tail/wing*） | 覆羽 ≥3 排扇贝边向尾部叠压（data-tract）；≥8 枚可数初级飞羽 + 带 P 细边的次级飞羽；尾羽 ≥5；颈羽流线；身体保持实心纸白，边缘网点窄带间距 ≥5；配额 26 条 |
| **DA-legs** 腿 / 脚细节（PL 链的后半段） | `src/art/detail/legs.js`（parts → thigh*/shank*/foot*） | "裤管"羽缘；跗跖鳞线；趾节、蹼褶、爪；远侧只用平涂 + 线；12 相位 0 撕裂；配额 13 条 |

### 4.6 自行车（1 形体 + 3 细节）

| 角色 | 拥有文件 | 验收 |
|---|---|---|
| **BK** 车形体与机械 | `src/art/bike.js` | CANON 车部分；整数链节；chainring 在 chain 前、spider 在 chain 后；辐条淡出 + 两墨模糊盘，气门与反光片保留真实旋转；check-bike 全部；H5/H7/H8.5 分区锁 |
| **DA-bikehw** 车架与座舱五金 | `src/art/detail/bikehw.js` | lug、五通壳、头碗、线管 + 线缆 + 线扣、刹车夹器与刹把、挡泥板撑杆与螺丝、车铃穹顶与拨杆、车灯镜片与支架、车头徽标、座弹簧 + 铆钉 + 座弓 + 座夹；配额 48 |
| **DA-drive** 轮与传动 | `src/art/detail/drive.js` | 条帽、轮圈孔、气门帽、胎纹与胎侧、链片 / 销 / 滚子、踏板笼与反光片；每次 drop 跑 wagon 快速版 + flicker；配额 30 |
| **DA-cargo** 车筐与鱼 | `src/art/detail/cargo.js` | 上下交错编织、筐沿、筐底；鱼的鳞纹、鳍、鳃盖、眼（≥2 种，鲻鱼或罗非鱼式，不是卡通团子）；鱼尾偶尔甩动；配额 33 |

### 4.7 世界与版式（3 形体 + 4 细节）

| 角色 | 拥有文件 | 验收 |
|---|---|---|
| **SEA** | `src/world/sea.js` | 按 L-horizon；≥3 条海带；灯塔光束（夜间）；瓦片无缝；每个道具有 data-size-m |
| **LAND** | `src/world/land.js` | 路面顶 = GROUND_Y；瓦片无缝；前景至多盖住轮底 8%，接触区 ≥70% 可见 |
| **SKY** | `src/world/sky.js` | 光芒约 1°/s；光晕量化为 2–3 环；夜空；不用 filter |
| **DA-sea** | `src/world/detail/sea.js` | 浪纹、泡沫线、日 / 月光路、栈桥与桩、礁石与拍岸浪、编号浮标、带索具与旗的帆船、渔船、水面鸟群；配额 24 |
| **DA-land** | `src/world/detail/land.js` | 港镇（窗、屋顶、烟囱、钟楼，夜间亮窗）、看守小屋、海堤砌缝、护栏 / 柱桩 / 路牌 / 长椅 / 邮筒 / 里程碑、路灯细部、按种类的植物、更衣亭 / 遮阳伞、路面标线；check-scale 通过；配额 76 |
| **DA-sky** | `src/world/detail/sky.js` | ≥3 种云型、光环、远近鸟群、星座、风筝 / 飞机；配额 24 |
| **DA-print** 版式 / 边框 | `src/print/{frame,type,stamp,ticket}.js`、`src/print/glyphs.json`、`tools/glyphs.mjs` | 边框 + 内框 + 角饰；字形正确的题签；车票式注记；标题 inline + 阶梯阴影；套印标记与色标条；小字编号；全部转为路径；cjk-glyph 0 豆腐块；电影模式下变 letterbox；配额 36 |

### 4.8 fx、系统、特别交付（6）与细节管理（6）

| 角色 | 拥有文件 | 验收 |
|---|---|---|
| **FX** | `src/fx/*.js` | fx 是 (t, distance, events) 的纯函数；鸥群（M 形翼、2.5–4 Hz 扑翼、相位各异）；速度线、尘土、落地冲击印版、沥水水滴、风带（≥10 条）；每个事件至多 1 个"丝网 pop"且 ≤6 帧；flash-check 通过 |
| **UI** | `src/ui/{ui,styles,keymap,i18n}.js` | keymap.js 是唯一事实源；G11/G12 全部通过；390 px 底部抽屉；面板与骑者 0 重叠；沙箱中下载要么可用，要么有可见回退 |
| **AUD** | `src/audio/*.js` | `createAudio(bus,{context})`；用户开启前 0 个 AudioContext；audio-offline 30 s 无削波；铃声起音在拇指弹出后 ≤20 ms |
| **BAKE** | `src/bake/*.js`、`tools/bake.mjs` | H5 在占位美术上跑通 SMIL；G5 全部；烘焙头部裁图与实时版的平均绝对差 ≤6/255；≤500 KB gzip |
| **SPEC** | `src/inspect/*.js`（X 光检查模式）；Dn 之后负责把 `src/mini/pelican-mini.svg` 拷进 dist | check-inspect 通过；读数标注"solver" |
| **PKG** | `README.md`、`docs/handoff.md`、`docs/THIRD_PARTY.md`、`LICENSE`、`docs/claims.json`、`tools/{webm,poster,contact-sheet,detail-compare}.mjs` | webm 确定性 60 fps、帧数 = 时长×60；verify-claims 与 readme-lint 0 命中；字体许可齐全；**`detail-compare.mjs` 产出给用户的草稿 / 成品同位置对照图** |
| **DQM** 细节总账（制作方） | `docs/detail/{plan.json,registry.json,quotas.json,backlog/*.md,dashboard.json,burnup.png}`、`tools/detail-dashboard.mjs` | H5 前发布 plan.json；每 3 h 看一次燃尽图并重新分配；梯级按时达成 |
| **DS-pelican / DS-bike / DS-world** 只读侦察兵（每个梯级换新实例） | `docs/detail/scout/<rung>-<region>.md` | 对 RS-detail 区域做草稿 / 成品 1×、3× 盲自清点；列出缺失、薄弱、没有区分的条目，按 1× 可见度排序，给出设计句 + owner + z；不改任何美术 |
| **DV** 独立细节验证者（每个梯级换新实例） | `docs/detail/qa/<rung>.json` | 按 J-detail 协议给出感知清单倍数预测与 7 区结论；召回"细节缺失" canary ≥80% |
| **DV-AUDIT** 反刷量审计 | `docs/detail/audit/<rung>.json` | 列出不可见（<2 px²）、遮挡 ≥50%、SSIM 重复、只在检查模式可见、1× 噪点、违反 STYLE-C 的条目；被驳回的条目不计数，也会从收割中剔除 |

### 4.9 对决参赛者 / 挑战者（10）与隔离组（2）

| 角色 | 拥有 | 验收 / 约束 |
|---|---|---|
| **INK-CH** 墨组挑战者 | `src/candidates/ink/B/ink-sets.js` | 6 时段 × 7 墨；满足 styleProfiles.C 相对色彩约束；在 `reink.mjs` 换墨后的草稿 C 上评，不依赖新美术 |
| **HEAD-CH** 头部挑战者 | `src/candidates/head/B/*.js` | 与 PB 用同一身体形体；种子"博物准确（P. onocrotalus 面部裸皮、额羽尖、喉囊下缘走向）"，PB 的种子是"忠实精修草稿 C"；门槛同 PB |
| **MOM-A / MOM-B / MOM-C** 标志性时刻 | `docs/candidates/moment/<X>/concept.md`，入围后 `src/candidates/moment/<X>/moment.js` | 种子：①"分色"（ink separation：各 z-band 像网版一样错开，再在铃声中对准）②"蓝图化"（画面逐笔变成自己的工程图）③由参赛者自提、不能照搬 creative-brief；≥55 fps，默认体验 60 s 内出现 |
| **MINI-A / MINI-B / MINI-C** 手写 mini SVG | `src/candidates/mini/<X>/pelican-mini.svg` | 只能手写；≤16 KB；SMIL；通过 CANON-14；种子：海报剪影 / 机械精确 / 表演性 |
| **DA-CH** 细节挑战者（3 个实例：头颈、身翼腿、车架传动） | `src/candidates/detail-<region>/B/*.js` | 与主作者拿到同样的 plan、同样的形体，种子在风格 C 之内（"印刷装饰"对"博物 / 机械准确"）；用 kit 写 |
| **FIX-CH** 停滞挑战者 | `src/candidates/fix-<criterion>/B/**` | 限时 2 h；只改该 criterion 涉及的部分；胜者经 graft-check 合并 |
| **FB** 匹配投入基线 ×3 + 单次生成对照 | `field/baseline/{1,2,3}/`、`field/single-shot/` | 看不到 rubric 和 docs/team；同模型、同工具、60–90 分钟；H4.5 由 TS-judge 冻结哈希 |
| **RT** 红队 | `src/mutants/{art,foils}.js`、`test/redteam/defects.json` | 没看过 tools/check-*；≥10 个美术级缺陷 + 诱饵（nopouch、stork、goose……） |

### 4.10 评估组（每轮全新，由 EL 调度；10 类）

| 角色 | 每轮人数 | 说明 |
|---|---|---|
| **EL** 评估负责人 | 1 | 拥有 `docs/eval/**`；组装证据包；持有 canary 答案；跑 score.mjs 与 predict.mjs；写 scorecard；记录影子偏差 |
| **J-lens** | D6、D7 各 5，其余各 3（共 43） | 只拿本维度的 items + 证据包；先写观察再判定；每条判定都要引证 |
| **J-blind** | 约 25 | 识别、偏好、笑点、个性、横向对比；只看 PNG，经过 blind-lint |
| **J-adv** | 4 + 每个 ≥9 的项各 1 | Red Court 与 C1.2、C7.5 |
| **J-valid** | 3–6 | 在重新渲染上核实；自身也用真 / 假缺陷校准 |
| **J-detail** | 2 | G-DETAIL / C13.1 |
| **J-user** | 3 | 桌面、390 px 触屏、彩蛋探索者（只用 harness） |
| **J-bi / J-a11y / J-mech / J-anat** | 各 1 | C9.8 / C9.5 / C2.7 / C4.1 的 FM-10 |

**名单合计**：
- 负责人与风格 4 + 工具 6 + rig 3 + 鹈鹕 5 + 车 4 + 世界 7 + 系统 6 + 细节管理 6（DQM、3 名 DS、DV、DV-AUDIT）= 41；
- 加对决 10 + 隔离 2 = 53（建造侧）；
- 加评估 10 类 = **63**。

---

## 5. 阶段、顺序、并发与循环

### 5.1 甘特（小时，H0 = 构建开工；风格 C 已选定）

```
H    0    2    4    6    8    10   12   14   16   18   20   22   24   26   28   30   32   34   36   38   40
A   [A1 ][A3 金丝雀]
    [ A2  ]
T   [T0 + shotd + 吞吐基础设施][R0 ][ T1 工具 …………………………………… ][EL 评估]
F   [FB1+2][FB3+单次][RT]
D        [墨组对决][ SK kit ][ SK 风格值班 ………………………………………]
         [ DIR X3：开场 / 机位 / 竖屏 / 自动导演 / 彩蛋 ……………… ]
R     [ RIG-L ][RIG-F][ RIG-A ………… ]
               [ FX …………………………………… ]
P       [P1][头对决][ PB 形体 ][快测][E2]
        [ PL 脚→翼 ……… ][ DA-legs …… ]
P2                [ DA-head …………………………… ]
                       [ DA-plume ………………………… ]
B       [ BK 形体 + 机械 ][ DA-drive ………… ]
             [ DA-bikehw ………… ][ DA-cargo …… ]
W       [SEA][ DA-sea ][ DA-sky …… ]
        [LAND][SKY][ DA-land …………… ][DA-print …]
X       [ UI …………………… ][AUD][ PKG …………………… ]
          [BAKE 占位][ BAKE 真实美术 …… ][SPEC]
Duel     Di(H2.5–6)  Dh(H3–6.5)  Dm概念(H5–6) Dm原型(H9–13) Dn(H7–11) Dp(H11–12) Dx(H11.5–15.5)
梯级                 R-0(H9)   R-a(H11)      R-b(H16)                               R-c(R-final 前)
契约窗口                 W1(H6)    W2(H10)   W3(H14)
I                                                 [I 冻结 + 稳定]
R                                                           [   R1   ][G16#1]
修                                                                     [ L 循环 + 快照 R2 ][R3][R4?]
终                                                                                           [ R-final ][发布]
```

| 阶段 | 时段 | 墙钟上限 | 出口条件（机器判定） |
|---|---|---|---|
| A 冻结 | H0–H4.5 | 5 h | check-contract 绿；G8 骨架通过；**真实负载金丝雀 ≥55 fps**。不过：其他车道只做纯 node / 文档工作，ARCH 最多再用 2 h 改架构；仍不过就降级为静态带预光栅缓存（≤4 个、源哈希可查、?nocache 像素差 ≤0.5%，符合 G17） |
| T0 + R0 | H0–H7 | 7.5 h | tool-validity 全绿；基线 129 条复核并哈希锁定；墨组冻结（Di 胜者）；N/A 判定；发布探针；RT 缺陷入库；密封留出集哈希入库 |
| 构建（流水线） | H2.5–H18 | 15.5 h | 各车道 DoD（§5.4.1）；梯级 R-b |
| 集成冻结 + 稳定 | H18–H20 | 2.5 h | T2 全量绿；G1–G5、G9–G12、G17 的脚本部分全绿；烘焙与 webm 产出 |
| R1 | H20–H24.5 | 5 h | scorecard R1；G16 #1 发出（不阻塞修复） |
| 循环 + 快照 | H24.5–H34 | 10 h（快照 ≤3 个，即 R2–R4） | R-final 入场条件（§5.6.4），或 3 个快照用完，或停滞 |
| R-final | H34–H39 | 5 h | 唯一可报告的分数；G16 #2 |
| 发布 | H39–H40 | 1 h | PR、Artifact、交接说明 |

**典型 38 h；乐观 33 h**（R2 快照就达到入场条件）；**悲观 44 h**（金丝雀降级 + 3 个快照）。**H40 保险丝**：H40 时仍在循环，取消剩余快照，直接进 R-final。

### 5.2 锁点（接口先行）

| 锁点 | 发布者 | 时刻 | 内容（`docs/locks/<id>.json` + PNG） | 解锁谁 |
|---|---|---|---|---|
| L-contract-v1 | ARCH | H2 | 契约 v1，check-contract 通过 | 全部 |
| L-horizon | DIR | H2.5 | 地平线、四种机位框 | SEA、SKY、LAND |
| L-ink | SK（Di 胜者） | H6 | 6 时段 × 7 墨，R0 冻结后只能改色值 | 全部美术 |
| L-silhouette | PB | H4.5 | 身体 / 颈 / 头轮廓；挂点（肩窝、翼根线、髋线、颈基、围巾结、座接触线） | PL、DA-plume、RIG-L、HEAD-CH |
| L-head-form | PB（Dh 胜者） | H7 | 头、喙、喉囊、眼、冠的形体与局部坐标 | DA-head |
| L-body-form | PB + PL | H9 | 形体锁（需通过 H9 快测） | DA-plume、DA-legs |
| L-bike-zones | BK | H5 / H7 / H8.5 | 车架 → 座舱 → 轮与传动 | DA-bikehw → DA-cargo → DA-drive |
| L-world-zones | SEA / LAND / SKY | H5–H8.5 | 布局框 + 道具位置表 + 深度密度配额 | DA-sea、DA-land、DA-sky |
| L-print-frame | DIR + DA-print | H6 | 边框、标题卡时序、letterbox | DA-print |
| L-pose-fields | RIG-L / F / A | H6 / H9 / H12 | 新 pose 字段与取值范围 | PB、FX、AUD、BAKE |

锁点发布之后，接口只能在契约窗口（H6、H10、H14）由 ARCH 批量修改，并附迁移说明。merge train 拒收违反 check-contract 的合并。

### 5.3 workflow 实例的排程与并发（Lead 执行）

每一行是一次 `Workflow({scriptPath:'docs/team/wf-build.v1.js', args:{mode, ...}})`。"代理数"是该实例同时运行的代理数上限。

| 时段 | 同时运行的实例（mode · 参数 · 代理数） | 峰值代理 |
|---|---|---:|
| H0–H2.5 | `freeze`·2，`tools {queue:'T0'}`·2，`field`·2 | 6 |
| H2.5–H4.5 | `tools`·2，`field`·2，`lane D`·1（DIR X3），`duel ink`·1–2，`lane R`·1，`lane P`·2，`lane B`·1，`lane W`·1 | 11–12 |
| H4.5–H7 | `r0`·1，`tools`·1，`duel head`·1–2，`lane D`·2，`lane R`·1，`lane P`·2，`lane B`·2，`lane W`·1，`lane X`·1（UI；H4 起 BAKE 也启动时 X 为 2） | 10–12 |
| H7–H11 | `tools {queue:'T1'}`·1，`lane D`·2，`lane R`·2，`lane P`·2，`lane P2`·2，`lane B`·1，`lane W`·1，`duel mini`·1（轮流用评审槽）；`detail {rung:'0'}` 在 H9 占用 1 | 10–12 |
| H11–H16 | `lane`×7（每条按调速器 1–2），`duel moment`·1，`duel preset`·1（H11–12），`duel detail`·1（H11.5–15.5），`detail {rung:'a'}`（H11） | ≤12 |
| H16–H20 | `detail {rung:'b'}`·2，`integrate`·2，`lane X`·1（PKG） | 5 |
| H20–H24.5 | `round {round:'R1', group:A/B/C/D}` 4 个实例 × 2 | 8 |
| H24.5–H34 | `loop`·2（控制器：修复波 + 快照），另加 `fix {lanes:[...]}` 2–3 个实例（从同一个磁盘队列认领）；快照时用 `round {round:'R2'…, dims:受影响}` | ≤10 |
| H34–H39 | `round {round:'Rfinal', group:A/B/C/D}` 4 × 2；soak 60 min 独占运行（评审只读 PNG） | 8 |
| H39–H40 | `ship`·1；Lead 做 push、PR、Artifact | 1 |

**调速规则**：governor 看到 shotd 排队 >60 s 持续 30 分钟，就按"松弛最大者先等"的顺序暂停新代理：先 X，再 D、W、T；P、P2、R 不暂停。

### 5.4 细节生产线与梯子（G-DETAIL / D13）

**目标表**（内部目标 = 10 分档 + 余量）：

| 层 | 草稿 | 门槛 | 10 分档 | **内部目标** | 产出者（条数） |
|---|---:|---:|---:|---:|---|
| pelican | 27 | ≥54 | ≥54 | **100（3.7×）** | PB 14 · PL 11 · DA-head 36 · DA-plume 26 · DA-legs 13 |
| bike | 42 | ≥84 | ≥84 | **155（3.7×）** | BK 44 · DA-bikehw 48 · DA-drive 30 · DA-cargo 33 |
| sea | 9 | ≥14 | ≥18 | **34** | SEA 10 · DA-sea 24 |
| land | 30 | ≥45 | ≥60 | **110** | LAND 34 · DA-land 76 |
| sky | 10 | ≥15 | ≥20 | **36** | SKY 12 · DA-sky 24 |
| fx | 1 | ≥4 | ≥6 | **10** | FX 10 |
| typography_frame | 10 | ≥15 | ≥20 | **36** | DA-print 36 |
| **合计** | **129** | **≥323** | **≥452** | **481（3.73×）** | DQM 负总责；Dx 的收割是额外余量 |

按 10% 的反作弊折损算，计入数仍 ≥433。R-c 要求**计入数** ≥452。

**DA 内循环**（每次 20–40 分钟）：
1. 从 backlog 取 3–6 条。backlog 由 DQM 合并侦察兵的报告后排序，排序依据是 1× 可见度 × 覆盖缺口。
2. 用 kit 写到自己的 parts 文件。
3. 跑 `quick.mjs --pair-draft --dpr 3 --tods golden,night`，Read PNG。
4. 跑 `drop.mjs`。T1 会**当场打印被拒条目的原因**，例如 SSIM 合并、<2 px²、遮挡。
5. 每完成一个区域，看一次 `cycle24.mjs --lane`，确认 0 撕裂、0 闪烁。

**梯子**（`mode:'detail'` 执行：侦察兵 → DQM → DV + DV-AUDIT → 判定）：

| 梯级 | 时刻 | 条件（全部满足才算过） | 未过时 |
|---|---|---|---|
| **R-0 parity** | H9 | `detail-parity`：129 个基线名全部在场且可见（每条都已带 rig 重建）；inventory ≥129；merge train 在此之后强制 `--no-negative` | 缺失的每条都是 bug，进入对应 owner 队列的最前面 |
| **R-a** | H11 | 每层 ≥1.5×，鹈鹕与车 ≥1.8×；zoom 鹈鹕 ≥80%、车 ≥75%；**用真实美术复测金丝雀 ≥57 fps**；DV 感知倍数 ≥1.5 | DQM 前移欠账层的 backlog；perf 不过时，先修预算再加细节 |
| **R-b** | H16 | 计入 ≥361（2.8×），鹈鹕与车 ≥2.3×，其余每层 ≥1.8×，fx ≥6；zoom 鹈鹕 ≥92%、车 ≥88%，没有 ≥4 个连续空白格；budget 绿；flicker 0；saliency ≥1.4；DV 感知倍数 ≥2.2 且 7 区中 ≥6 区"更多"；DV-AUDIT 0 条 major | 集成冻结推迟 ≤1 h；仍不过，就以"门槛过、D13 目标未达"进入 R1，细节补账排在队列首位 |
| **R-c** | R-final 前 | 计入 ≥452，每层 ≥2.0×；catalogue 鹈鹕 11/11、车 14/14、海 / 陆 / 天 ≥90%、版式 6/6；zoom ≥97% / ≥95%；6 时段、事件、烘焙 SVG 中细节都保留；DV 感知倍数 ≥3.0，7/7 区"更多且更好"；J-blind"你会删掉什么"中被 ≥2/5 点名的元素都已处理 | 留在修复队列里，按每小时可回收分数与其他项竞争 |

#### 5.4.1 车道 DoD（每个 owner 的出口，机械判定）

1. `score.mjs --items-only --owner <id>`：该 owner 名下 criterion 的脚本类原子条目，8 分档全部通过，且至少 1 个 10 分档条目通过。
2. 相关门槛的脚本部分全绿。
3. 细节配额达到当前梯级，且 detail-diff 没有负数。
4. ledger 中有 ≥3 次视觉迭代的记录。
5. 感知核心相关的 owner（PB、PL、RIG-L、RIG-A、DIR、SK、DA-head、DA-plume、MOMENT）另需**影子评审**：1 名新鲜 J-lens，证据包含 canary，≥8.5 才算完成；影子分 ≥9 还要过 Red Court。每个 owner 最多 2 次影子评审，之后转进修复队列。

### 5.5 对决（只放在 TVI 高的位置）

#### 5.5.1 对决清单

| 对决 | 时段 | 参赛者 | 门槛（失败即淘汰，可 1 次 30 分钟重交） | 评审 | 停止规则 | 败者的去向 |
|---|---|---|---|---|---|---|
| **Di 墨组** | H2.5–H6 | SK vs INK-CH | check-style --palette、contrast、相对色彩约束 × 6 时段 | 5 J-blind 看"换墨后的草稿 C × 6 时段"：哪套更像限色印刷？哪张是夜间海报？ | BT 胜率 ≥70% 就定胜，否则投影分高者胜；H6 必须结束（R0 要冻结墨组） | 最佳的 1–2 个时段墨组可经 J-valid 判定后替换进来 |
| **Dh 头部** | H3–H6.5 | PB vs HEAD-CH（同一身体） | check-style、CANON #7/#8、check-anatomy 头部、喉囊在 sy∈{0.9,1.2,1.45} 下 0 撕裂 | 5 J-blind：256/128 px notext 整只鸟的开放识别 + 3 选 1（诱饵 = 草稿 C 的头）+ 表情读数；1 J-lens 看 C4.2 与 C13.2 头部项 | 投影分为主，BT 在投影分相差 <0.3 时决胜；H6.5 必须结束 | ≤3 个元素经收割规则进入 |
| **Dm 标志性时刻** | 概念 H5–6；原型 H9–13 | MOM-A/B/C → 2 个入围 | eggs.mjs 在 idle、跳车中、夜、390×844 下 0 错误且 ≥55 fps | 概念：3 J-blind 看分镜，"你会告诉朋友哪一个？"；原型：3 J-blind 开放回忆 +"见过吗？" | 胜者成为 MOMENT（把 `src/director/moment.js` 的所有权转给它）；混合轮至多 1 次 | **亚军转为 ENCORE**（`src/director/encore.js`，C8.1 的 10 分档要求 + C8.3） |
| **Dn mini** | H7–H11 | MINI-A/B/C | ≤16 KB、G5 结构、check-benchmark、作为 `<img>` 会动 | field.mjs 同等条件配对（每名评审 ≥8 对）对照同模型单次生成；3 J-blind 答 CANON-14 | 对单次对照胜率 ≥60%（10 分档要 ≥80%） | — |
| **Dp 踩踏手感** | H11–H12 | RIG-L 的 6 组预设 | G3、G10 | 3 J-blind 按速度排序 +"哪个更有重量"；1 名看洋葱皮 | 胜出预设成为默认值 | — |
| **Dx 细节 ×3**（头颈、身翼腿、车架传动） | H11.5–H15.5 | 主作者 DA vs DA-CH | check-style、check-detail-budget（≤110%）、wagon、flicker | 3 J-blind：草稿 / A / B 同位置 1×、3× 盲清点 + "哪张更好？有没有违反风格或抢戏的？" | **先比"更好"，再比"更多"**；有有效风格违规者直接出局 | 并集收割（§5.5.3），每区 ≤8 条 |
| 世界区细节（海港、陆路、天与版式） | 只在停滞时开 | DA vs DA-CH | 同上 | 同上 | 同上 | 同上 |

#### 5.5.2 所有对决共用的规则

- 每场对决都是一个 `mode:'duel'` 实例。
- 每个证据包都含**诱饵**（草稿 C 的同部件，或 mutant）+ 2 个 canary。评审没把诱饵排在最后，或 canary 召回 <80%，他的票作废并补人。
- Kendall τ <0.3 时，追加 2 名评审。
- 胜者任何 ≥9 的投影分都要过 Red Court。
- 对决分数**只用于选择**，永远不进 scorecard。

#### 5.5.3 收割的三道新防线（修"缝合怪"与"刷量机器"）

候选条目先得通过基本条件：去重后仍独有（64×64 SSIM <0.95）、通过 check-style、不遮挡胜者条目、saliency 降幅 ≤0.05。在此之上再加三道：
1. **重写**：由胜者作者用 kit 生成器重写，不许原样粘贴对方的代码或路径，这样线宽和墨一定一致。
2. **两道判定**：SK 否决 + J-valid 判"同一设计语言"，两道都要过。
3. **审计**：收割来的条目也要过 DV-AUDIT；每区上限 8 条；来源记入 ledger。

### 5.6 循环与停止条件（R1 之后）

#### 5.6.1 修复队列

- `tools/predict.mjs` 为每个 criterion 算 `gain_c`：
  ```
  gain_c = W_d·(w_c/Σw_d)/10·(target_c − s_c) + 门槛上限的解除 + 感知核心对 H 的边际
  ```
  - `target_c = max(9.3, 核心项 9.5)`；
  - `priority = gain_c × p_fix / cost_c`。
- **门槛失败永远排第一；用户的 G16 意见排第二**，它的 gain 按"阻止达标声明"计算。
- 每个 owner 同时至多持有 2 项。认领通过 `tools/queue.mjs claim`，带锁。

#### 5.6.2 维度组循环（5 个，状态记在 `docs/team/loops/<L>.json`）

| 循环 | 覆盖 | 波次 | 原因 |
|---|---|---|---|
| L1 正典 / 机械 / 接触 | D1 D2 D3 + C12.8 | 第 1 波 | 失败会封顶 40–50 分 |
| L2 鹈鹕 | D4 + C13.1/C13.2 鹈鹕部分 + C1.3 + C7.6 角色修正 | 第 1 波（与 L1 共享 RIG 以外的 owner，不冲突） | 感知核心最密集；**V-D4 与 V-D13 评同一个构建**，失败按 owner 合并，避免在共享文件上来回拉扯 |
| L3 动作 / 表演 | D5 D6 | 第 2 波 | 要在定稿的美术上评 |
| L4 美术 / 细节 / 惊艳 | D7 + C13.3–C13.6 + D8 | 第 2 波 | 评全细节画面 |
| L5 系统 | D9 D10 D11 D12 | 第 1–2 波，占空闲槽 | 以脚本为主 |

每次迭代：
1. 跑该组的脚本集。门槛失败 → 修复 → 重跑，最多 2 次纯脚本修复。
2. 出证据包：canary + 1 个降级版本。
3. 新鲜评审按原子条目判定，接着跑 score.mjs。
4. ≥9 的项过 Red Court。
5. 判定 **STOP / STALL**：
   - **STOP**：组内每个维度 ≥9.3（加上实测影子偏差）、每个 criterion ≥8、核心项 ≥8.5、0 条被验证的 major。
   - **STALL**：连续 2 次迭代 ΔS <0.3。
6. 把失败条目经 `item-owner.json` 路由给 owner。

**停滞升级**：
1. DIR + SK + 相关 owner 三方分诊：是艺术指导问题、契约问题，还是能力上限？
2. 开 FIX-CH 挑战者，限时 2 h，按原协议小规模盲评，胜者合并。
3. 在下一个契约窗口做契约变更。
4. 3 次停滞之后接受差距，写进 `docs/handoff.md` 与 scorecard。

任一维度掉了 ≥1 分，必须说明原因（真回归还是评审噪声）。真回归由 vr + bisect 定位后回滚。

#### 5.6.3 快照轮（R2、R3、R4，与 rubric 的 3 轮上限一致）

当已合并修复的预测增益累计 ≥1.5 分，或距上次快照已 ≥4 个修复波时，冻结一个 integ 提交，跑：全部门槛脚本 + vr + **受影响维度**的感知测试（新鲜评审）+ Red Court。快照评审期间，修复实例不停工。

快照在 `mode:'loop'` 内部以**轻量档**运行：每个维度 2 名 J-lens，专门评审组人数减半（最少 1 人），Red Court 不减。这样一个 workflow 的代理总数不会碰到 1000 的上限。如果要满员快照、提高墙钟并行度，Lead 可以传 `externalSnapshots:true`，自己用 4 个 `round {round:'R<k>'}` 实例跑快照，loop 只读合并后的 scorecard。

#### 5.6.4 R-final 入场条件（影子 / 快照评分，全部满足）

- 全部门槛的脚本部分绿；梯级 R-c 通过；
- 每维度 ≥ 9.3 + bias（bias = 最近两轮"影子或快照分 − 轮次分"的中位数，至少为 0）；
- 预测 T_final ≥93；
- 核心项每项 ≥8.5；
- 没有 criterion <7.5；
- 0 条未解决的用户意见（如果用户已经回复）。

**直接进 R-final 的情况**：3 个快照用完、停滞（两次快照之间 ΔT_final <0.3）、或 H40 保险丝触发。这些情况下都如实报告差距。

#### 5.6.5 全局达标（只看 R-final）

全部门槛通过（含 G-DETAIL；G16 = 用户通过，且其前 3 条意见都已解决）、每维度 ≥9.0、T_final ≥92、单项 ≥7、核心项 ≥8。
- G16 未回复时，只能写"同模型自评达标，待用户确认"。
- 不得挑选更早轮次的高分。

---

## 6. 先建的工具（按阻塞顺序）

**第 0 批（H0–H2.5，阻塞一切；TS-perf + Lead）**

| 工具 | owner | 完成 | 作用 |
|---|---|---|---|
| `tools/lib/shotd.mjs`、`lock.mjs`（3 槽信号量，回退路径也用） | TS-perf | H1.5 | 常驻渲染池 |
| `tools/governor.mjs` | Lead | H1.5 | 调速 |
| `tools/{lane,drop,merge-train,train-watch,ownership,queue}.mjs` | Lead | H2.5 | worktree、提交入口、持续集成、心跳自愈、所有权、队列认领 |
| `tools/lib/gatecache.mjs` + `gatemap.json` | TS-perf | H3 | 门槛结果按树哈希缓存 |
| `tools/quick.mjs`、`tools/cycle24.mjs` | TS-perf | H3 / H4 | 构建者的自检（≤20 s） |
| `perf.mjs` + `?synthload=draft:k`（真实负载） | TS-perf + ARCH | H4 | 金丝雀 |
| `tools/reink.mjs` | TS-detail | H2.5 | 墨组对决 |

**第 1 批（T0，R0 之前，H2.5–H7）**：
- 正典与运动：check-anchors · check-benchmark · check-rig（扩展）· check-occlusion · check-contacts；
- 风格与纯度：check-style · check-purity · check-contract；
- 细节：detail-inventory（--layer）· detail-parity · detail-diff · zoom-coverage · registry lint；
- 导出与性能：check-baked（--static）· live-parity；
- 体验：first-look · ux-matrix · a11y · keys · flash-check · determinism；
- 评审系统：score · coverage · tool-validity · judge/pack · judge/harness · judge/canary · judge/redcourt · blind-lint · tourney/{pack,bt,graft-check} · verify。

**第 2 批（T1，与美术并行，H7–H16）**：
- 最先建（细节美术每次 drop 都要用）：wagon · flicker · check-anatomy · check-detail-budget · check-scale；
- 然后：check-bike · check-kinematics · check-noslip · contact-probe · motion-audit · filmstrip --dense · onion · check-temporal · check-timing · mutate-rig · vr --locality · loop-seam；
- 评审与度量：thumb · silhouette · judge/{palette,saliency,seams,edges,acting,controls,detail-pairs,wild,audio-offline,package}；
- 长跑与环境：soak · robust · contexts · audit-dist · xb-audit；
- 体验、文档与交付：interact · contrast · i18n-lint · cjk-glyph · check-text · audio-check · export-check · check-inspect · check-docs · verify-claims · readme-lint · field · predict · detail-dashboard · detail-compare。

**第 3 批（T2，只为 10 分额外项）**：xb-webkit · judge/film · judge/eggs · soak 60 分钟模式 · 有声 webm（WebCodecs）。

**工具规则**：
- 每个 gate 工具在 R0 过 tool-validity 后哈希锁定。
- 构建者墙钟的 ≥40% 留给美术与动画迭代，ledger 会统计。

---

## 7. 反通胀评审协议

1. **证据先于意见。** 先跑脚本、生成证据包，再让评审看。构建者自报的截图与说法都不算证据。G1、G3、G15、G17 或 check-benchmark 任一红，就不开任何评审。
2. **隔离。** 证据包复制到随机命名的临时目录，评审只能读这个目录。UX 评审只能用截图—输入 harness（没有 DOM、aria、evaluate、源码）。每次读取都记入 ledger，越界的评判作废。
3. **全新实例，角色互不重叠。** 构建者永不给自己打分。影子评审、DV、对决评审、快照评审、R-final 评审是彼此不相交的调用集合；R-final 评审从未参与过任何轮次、影子评审或对决。
4. **Red Court。** 覆盖一切 ≥9：轮次中位分、影子分、快照分、对决投影分、任何维度 ≥9.5。
   - J-adv 在"找出至少 5 个缺陷"的框架下工作，可以用 render.mjs 重新渲染。
   - J-valid 在重新渲染上逐条核实，并按严重度封顶：blocker 封 6，major 封 8。minor 会让相关 10 分额外项不成立。
   - **steelman-the-9**：给出 ≥9 的评审必须列出他认为通过的 10 分额外项和可见性证据（盲评在 1× 下主动提到的，或声明为检查模式额外项、每项 ≤+0.5）。Red Court 同时核实，不成立的不计。
5. **校准。**
   - 每个清单类证据包都混入 2–3 个 canary（?mutant= 植入缺陷）和 1 个降级版本。召回 <80%，或给降级版本的分没有低 ≥2，评审作废并补人。
   - 每个偏好类证据包都放 1 个诱饵（草稿 C 同部件）。
   - J-adv 与 J-valid 也用真 / 假缺陷校准：把假缺陷误判为真的比例 >20%，作废。
   - scorecard 公布每名评审的召回率。
6. **强制选择与找缺陷，而不是打好感分。** 不用 1–10 的绝对好感分，不用"会分享吗"这种是 / 否题。偏好统计用 Bradley–Terry + 按评审聚类的 bootstrap，并报告有效样本量。
7. **分歧规则。**
   - 取中位数之前，比中位低 ≥2 分的离群评审所引用的缺陷先送 J-valid 核实；证实的缺陷对全体生效。
   - 同一 criterion 极差 >2 时，加 2 名评审。
   - 维度级两名评审相差 >1 时，由第三名裁决。
8. **去文字、去符号。** 识别、偏好、笑点类证据一律 ?notext=1（事件类再加 ?nofx=1）；提示经 blind-lint 检查（不得出现 pelican、鹈鹕、bicycle、自行车、Pelican Bay）；另由一个代理确认图中没有可辨认的文字。
9. **防过拟合。**
   - 抽样种子在代码冻结之后才公布。
   - R-final 使用 R0 预登记的密封留出集与野卡包。
   - 对决与影子评审使用与 R1、R-final 不同的相位和构图。
   - 细节侦察兵按 1× 可见度排序 backlog，防止只在固定裁图里堆细节。
10. **影子偏差校正**（新增，修"影子评审偏宽"）。EL 在每个轮次后记录 `bias_d = 影子或快照分 − 轮次分`，并写入 `docs/eval/shadow-bias.json`。R-final 入场线 = 9.3 + max(0, 中位 bias)。
11. **标注与诚信。** 所有分数都标注"同模型自评"；README 披露评审是 Claude 子代理；fps 注明是无头软件光栅测量；代理数按角色分列。
12. **唯一的真人评审是用户（G16）。** 第一次检查点在 R1 之后，第二次在 R-final 之后。每次都发：联系表、webm、Artifact 链接、**草稿 / 成品细节对照图**（PKG 的 detail-compare.mjs 生成）。用户原话记入 `docs/eval/user-checkpoint.json`。任何未解决的用户意见都阻止"达标"声明。
13. **全部入库。** 原始评审输出、提示词、种子、证据包清单、工具调用日志都存进 `docs/eval/`。

---

## 8. 风险登记

| # | 风险 | 概率 | 影响 | 缓解 | 触发与应对 |
|---|---|---|---|---|---|
| 1 | 3.5× 细节下 fps <55（BL-17：草稿 19–22 fps） | 中高 | G9 → 60；C13.6 | 真实负载金丝雀（H4.5）；R-a 用真实美术复测；每 2 h 持续金丝雀 + 按 band 二分；merge-static；band 预算；骑者带 ≤1100 节点 | 金丝雀不过：静态带预光栅缓存（≤4 个，G17 合规）；复测不过：先修预算再加细节 |
| 2 | merge train、调速器后台进程悄悄停掉 | 中 | 集成冻结不自知 | 心跳 + train-watch 自愈（代理启动前与 Lead 查看时都跑）；状态全部落盘 | 心跳 >25 min：train-watch 代跑 `--once`；>60 min：Lead 重启并在 ledger 记录 |
| 3 | shotd 早期不稳定 | 中 | 所有自检都卡住 | shotd 本身过 tool-validity；回退路径同样受 3 槽信号量约束 | 连续 3 次失败：自动切换到回退模式，governor 把代理上限降到 8 |
| 4 | 代理过多，挤爆 4 核 | 中 | 迭代变慢 | 目标 ≤10、硬上限 12；错峰；field 提前到 H4.5 结束；按松弛排优先级 | 排队 >60 s 持续 30 min：先暂停 X，再暂停 D、W、T |
| 5 | 风格漂移、细节变成噪点 | 中 | C7.2、C7.6、C7.7、C13.6（核心） | 共用 kit；SK 否决权；saliency 门槛；check-style 每次 drop 都跑；每个梯级都跑 J-blind"你会删掉什么" | SK 发现漂移：冻结该 DA 的 drop 直到修正 |
| 6 | 数量配额逼出刷量 | 中 | C7.7、C13.6 | 配额按区域 × 可见度下发；DV-AUDIT；对决"先比更好"；收割上限 8 条 | DV-AUDIT 的 major：该条目不计数，DA 必须替换 |
| 7 | 收割拼成缝合怪 | 低中 | C7.2、C7.6 | 三道防线（§5.5.3） | J-valid 判冲突：整批收割撤回 |
| 8 | 对决的胜者整合后变差 | 低中 | 关键路径返工 | Dh 在整只鸟上评；graft-check；在 H7 头部锁之前完成 | graft-check 失败：退回 PB 的版本（它一直在主干里） |
| 9 | 同模型参赛作品趋同，对决白费 | 中 | 墙钟 | 只有 5 场主动对决 + 3 个细节区；每场有时间上限；BT 差异不显著时直接按投影分定胜，不开混合轮 | Kendall τ <0.3 加 2 名评审；仍不显著就结束 |
| 10 | 锁点之后接口仍要改 | 中 | 下游返工 | 细节挂在 slot 局部坐标上；H9 快测在 DA-plume 开工前完成；契约窗口批量修改 | 必须改锁点：ARCH 评估下游影响后，在下个契约窗口批准 |
| 11 | contract.js、main.js 成为 rebase 热点 | 低中 | 冲突级联 | ARCH 唯一 owner；3 个契约窗口；parts 原语让其他人不必碰这两个文件 | 冲突只可能落在 ARCH 的文件上，直接路由给 ARCH |
| 12 | 影子评审与 R-final 有偏差 | 中 | R-final 低于预测 | 影子评审混 canary；影子 ≥9 过 Red Court；bias 校正入场线 | R-final 仍未达标：如实报告差距 |
| 13 | 物种读不出（G7 → 50） | 低中 | 关键路径 | Dh 的盲评本身就测物种识别；H9 快测要求 3/3 | 快测不过：PB 用 ≤1.5 h 修剪影，DA-plume 延后开工 |
| 14 | 墨组对决拖到 R0 之后 | 低 | 美术开工后还在改色 | 在换墨后的草稿上评（不依赖新美术）；H6 硬截止 | 超时：按当前排名定胜 |
| 15 | webm 管线不可行（BL-31） | 低中 | G13 | PKG 在 H14 前出 3 s 样片 | 改用 WebCodecs 在页内编码 |
| 16 | 用户在 G16 提出结构性意见 | 低中 | 返工 | R1 后立刻发出检查点；A2 附角色草图，让用户可以提前看一眼 | 用户意见以最高优先级入队；必要时对 PB 开 FIX-CH |
| 17 | 评审隔离被破坏 | 低 | 该评审作废 | 随机临时目录；harness；ledger 记录读取 | 隔离审计发现越界：换人重评 |
| 18 | 墙钟超出 44 h | 中 | 中等 | 关键路径排程；保险丝 H40；快照 ≤3 | H40：直接进 R-final |
| 19 | 容器重启、workflow 中断 | 低 | 进度丢失 | 每次 drop 都是提交；状态全部在磁盘；workflow 以 resumeFromRunId 续跑 | Lead 查看心跳和车道状态后续跑 |

---

## 9. 与三份提案的对应

- **保留（pipeline-throughput 骨架）**：车道 + worktree + merge train；T0–T4 + gatecache；shotd + governor；锁点；H4 金丝雀；kit；DQM + DV；细节梯子 a/b/c；滚动修复队列 + 快照轮；predict.mjs；"分色"作为 Dm 的一个种子；vr --locality；drop.mjs 作为唯一提交入口。
- **嫁接（tournament-quality）**：Red Court；诱饵 + canary 的评审作废规则；Dh、Di、Dm（3 → 2 → 1，亚军转 encore）、Dn、Dp、Dx 并集收割；candidates + variants + graft-check；DV-AUDIT；BT + 聚类 bootstrap；Kendall τ 规则。
- **嫁接（specialist-depth）**：梯级 0 parity；detail-diff 负增量拒收；只读侦察兵（从 7 名缩为 3 名，每个梯级换新实例）；STOP/STALL 状态机与升级梯；D4 + D13 合并为同一循环；PART_Z；band 预算表；flicker 检测。
- **明确不采用**：
  - 纵深路线把鹈鹕拆给 10 名专家：接缝与风格漂移风险最高。
  - 纵深路线让 13 个维度各跑一个循环：合并为 5 个维度组，降低编排负担与来回拉扯。
  - 锦标赛路线"更大胆 deco"之类偏离草稿的种子：违反 D7 的"保持所选风格"。
  - 锦标赛路线对 7 个细节区全部开对决：只保留 3 个高权重区，其余只在停滞时开。
  - 锦标赛路线在 R0 之前跑 3 场对决：只保留不依赖新美术的墨组对决。

---

## 10. 运行手册（Lead）

```
H0     Workflow wf-build.v1 {mode:'freeze'} ∥ {mode:'tools', queue:'T0'} ∥ {mode:'field'}
H2.5   {mode:'lane', lane:'R'|'P'|'B'|'W'|'D'}；{mode:'duel', duel:'ink'}
H3     {mode:'duel', duel:'head'}；H4 {mode:'lane', lane:'X'}；H4.5 {mode:'r0'}
H5     {mode:'duel', duel:'moment'}（概念 → 原型，同一个实例内部先后进行）
H7     {mode:'lane', lane:'P2'}；{mode:'duel', duel:'mini'}；{mode:'tools', queue:'T1'}
H9     {mode:'detail', rung:'0'}；H11 {mode:'detail', rung:'a'}；{mode:'duel', duel:'preset'}
H11.5  {mode:'duel', duel:'detail'}；H16 {mode:'detail', rung:'b'}
H18    {mode:'integrate'}
H20    {mode:'round', round:'R1', group:'A'|'B'|'C'|'D'}（4 个实例）→ 发 G16 #1
H24.5  {mode:'loop'} ∥ {mode:'fix', lanes:[...]} ×2–3（满员快照时：{mode:'loop', externalSnapshots:true} + 4 个 round 实例）
入场   {mode:'detail', rung:'c'} → {mode:'round', round:'Rfinal', group:A..D} → 发 G16 #2
发布   {mode:'ship'} → Lead：push、draft PR、subscribe、发布 Artifact、交接
```

每次查看进度，Lead 都要做这几件事：跑 `node tools/train-watch.mjs`；读 `docs/team/lanes/*.json` 与 `docs/detail/dashboard.json`；把用户的中文回复原样写进 `docs/eval/user-checkpoint.json`。
