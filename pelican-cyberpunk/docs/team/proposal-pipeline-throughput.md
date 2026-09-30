# 团队方案 · 流水线吞吐路线（pipeline-throughput）

> **角度**：在"每个 workflow 同时约 2 个代理"的限制下，让**每墙钟小时的质量**最大。做法：多个 workflow 并发（每条"车道"一个 workflow、一个 git worktree）；用流水线代替屏障；按关键路径排程（契约 → rig → 鹈鹕形体 → 肢体 → 鹈鹕细节 → 事件表演）；便宜的自动门槛永远先于昂贵的视觉评审；从第 4 小时起持续集成，不留"最后一天才发现"的意外。
>
> **用户要求**："我需要你最终教出来的版本细节比 draft 多很多"（"教"应为"交"）。本方案把细节密度当作**与关键路径并行的独立生产线**来设计（§7）：10 名细节美术、1 名细节总账（DQM）、1 名独立细节验证者（DV）、每次提交都跑的细节门槛，还有一架"细节梯子"。内部目标定在 D13 的 10 分档（≥3.5×），不是 G-DETAIL 门槛的 2.5×。
>
> **基础**：CONTRACT.md、docs/rig-spec.md、src/contract.js、phase-0 脚手架（src/**、tools/{shoot,check-rig,lint,build,render,sheet,serve}.mjs）、docs/STYLE-C.md、drafts/C-poster/*、RUBRIC.md / rubric.json v2.0.0。不推倒重来：phase-0 文件原地演进，模块接口 `build(ctx)/attach(svg,ctx)` 保持不变。
>
> 本文所有分数与预测都是**同模型自评**（评审是与构建者同一模型家族的 Claude 子代理）。

---

## 0. 一页摘要

1. **墙钟由三件事决定，不由代理数决定**：(a) 关键路径上的串行依赖：角色圣经 → 鹈鹕剪影 → 形体 → 细节 → 事件表演 → 集成 → 评审；(b) 本机 4 核上 Chromium 的渲染吞吐，这是所有自检、门槛与评审证据的共同瓶颈；(c) 评审轮次的屏障。本方案分别处理：(a) 用"**接口先行的锁点**"切短关键路径。例如鹈鹕身体 owner 开工 2 小时就发布"剪影锁"（轮廓 + 肩窝、髋线、颈基等挂点），肢体与细节美术不用等形体完工就能开工。(b) 用**常驻渲染守护进程 shotd**：一个预热的 Chromium 池，3 个槽位，按内容哈希缓存截图。它代替每次调用都冷启动浏览器的 shoot.mjs，另配 CPU 调速器。(c) 用**证据包流水线**：哪个渲染集先出来，就先开哪一组评审，不等全部脚本跑完；修复采用**滚动修复队列**加周期性快照轮，代替"全修完再全评"。
2. **车道拓扑**：峰值 6 条车道 workflow 并发，≤12 个代理。车道是：导演 / 风格（D）、rig / fx（R）、鹈鹕形体（P）、鹈鹕细节（P2）、自行车（B）、世界 / 版式（W）、系统（X）、工具 / 评估（T），外加开局 5 小时的隔离车道 F（匹配投入基线 + 红队）。每条车道在自己的 git worktree 与分支 `lane/<id>` 上工作，同一车道内的 2 个代理拥有互不相交的文件。**merge train**（脚本，不是代理）每 20 分钟、以及每次有 drop 时，把各车道 rebase 到 `integ`，跑 Tier 0/1 门槛，绿则快进合并。首个带真实美术的 `dist/` 出现在约 H8，之后一直可用。
3. **门槛分 5 级**，贵的永远排在便宜的后面：T0（<60 s，纯 node）→ T1（3–5 min，1 个 shotd 槽）→ T2（15–25 min）→ T3（soak、全新克隆、webkit）→ T4（视觉评审代理）。任何一次 drop 或合并都不会在 T0/T1 红的情况下启动任何视觉评审。门槛结果按"相关文件树哈希"缓存，没改过的模块不重跑。
4. **早暴露最大风险**（按"晚发现的代价 × 概率"排序）：① 风格 C 草稿在本机只有 19–22 fps（BL-17），细节再加到 3.5× 必然更慢。所以 H4 的步行骨架必须带一个"性能金丝雀"：z-band 架构加合成的 3.5× 细节负载，trace 测出 ≥55 fps，否则不放美术开工。② 物种可读性（G7 封顶 50）：H9 形体锁之前先做一次早期盲测。③ 腹—座接触（BL-08）与 KOPS（BL-09）：rig 车道第一件事就修。④ 竖屏构图（G8，BL-01）：骨架阶段就修。⑤ SMIL 烘焙：烘焙器 H3 起在占位美术上跑通。⑥ Artifact 发布探针与沙箱下载：R0 就做。⑦ G-DETAIL 倍数：每次 drop 都数，燃尽图每小时更新。
5. **细节生产线**（§7）：SK 在 H2.5–H6 先做一个**风格 C 细节工具包** `src/art/kit/*`（扇贝排、羽扇、排线、网点带、编织、鳞纹、五金件、印刷字形），所有细节美术共用，保证同一种印刷语言、同样的确定性与同样的预算。细节以 **parts** 的形式挂到 slot 或 layer 上（新增契约原语，§6.3），所以细节美术与形体 owner 文件不相交，可以并行。静态细节在构建时按"条目内、按墨合并"（merge-static），DOM 不随细节线性增长。目标 **≥481 条（3.73×）**，按 10% 的反作弊折损计，仍 ≥433；每层 ≥2.0×。
6. **停止条件绑定 rubric 分数**：车道 DoD = 该车道 owner 拥有的 criterion 在脚本类条目上"不回退且达到本阶段梯级"；形体锁 = 早期物种盲测 ≥4/5；细节梯子三级（1.5× → 2.8× → 3.5×）；修复队列按"**每小时可回收分数**"排序；R-final 的入场条件 = 影子评分下全部门槛通过，每维度 ≥9.3（留出 R-final 新评审偏严的余量），T_final ≥93，感知核心每项 ≥8.5。至多 3 个快照轮，停滞（两轮之间 ΔT <0.3）就直接进 R-final 并如实报告。
7. **规模与墙钟**：47 个不同角色（§6），整个运行约 260–340 个代理实例（构建者迭代，加上每轮全新的评审）；README 按角色分列，不发布单一总数（G6）。**墙钟预估：典型 34 h，区间 30–40 h**（§8）。关键路径 ≈ H0 → H17（集成冻结）→ R1 H19–H23 → 两个快照轮 → R-final H31–H35.5 → 发布 H36。

---

## 1. 约束与吞吐模型

| 约束 | 对吞吐的影响 | 本方案的处理 |
|---|---|---|
| 每个 workflow 约 2 个代理，可以多 workflow 并发 | 并行度来自 workflow 数，不来自单个 workflow | 每条车道一个 workflow（`docs/team/wf-lane.v1.js` 参数化），峰值 6 条同时运行；评审轮拆成 4 个并发的 `wf-round` workflow（§12.3） |
| 4 CPU、Chromium 软件光栅 | 渲染是共享瓶颈；perf 测量会被其他渲染污染 | `tools/lib/shotd.mjs`：常驻 Playwright 守护进程，3 个浏览器槽，请求经 unix socket 排队，按 (worktree 树哈希, URL, 参数) 缓存 PNG；`/tmp/pb-cpu.lock` 独占锁给 perf 与 soak；`tools/governor.mjs`：shotd 排队 >60 s 或 load average >6 时，暂停在新车道里启动新代理 |
| 代理共享一个文件系统 | 并行写者冲突；对共享树跑 shoot 会互相污染（BL-21） | 每车道一个 worktree（`../pb-wt/<lane>`），车道内按 `docs/team/owners.json` 分文件；`node_modules` 从主树 symlink，**代理永不 npm install**；截图目录按 worktree 与代理隔离 |
| ffmpeg 只能编码 webm/vp8，没有 PNG 解码器（BL-31） | webm 管线必须早验证 | PKG 在 H14 前用 renderAt → JPEG 帧 → mjpeg 解码 → vp8 跑通一次 3 s 样片；如果失败，改用 WebCodecs 在页内编码（T2 备选） |
| 没有 Blender、没有其他 AI 模型 | 一切靠程序化 SVG + Claude 子代理 | README 如实写明（G6） |
| token 不受限，墙钟中等重要 | 可以用"冗余但并行"换墙钟 | 早期物种盲测、DV 预检、影子评分都用额外的代理实例换取早发现；只在停滞时开"挑战者"（借自锦标赛路线，但只在停滞时用） |
| workflow 脚本 API | `agent / parallel / pipeline / phase / log / args`；meta 是纯字面量；不用 Date.now 或 Math.random | 车道状态全部落盘（`docs/team/lanes/<id>.json`），workflow 可以中断后续跑；时间预算用"迭代次数上限"表达，不读时钟 |

**吞吐算术**（粗估，用于排程，不对外宣称）：shotd 预热后单帧 1600×900@1 的 renderAt + 截图约 0.4–1.2 s，DPR 3 裁图约 1–3 s。3 个槽位约 60–150 帧/分钟。一名构建者一次自检（quick.mjs 单部件 + 4 相位 + 草稿对照）约 10–20 帧，每 5–10 分钟一次。12 名构建者约 24–48 帧/分钟，占池子的 30–50%，剩下的留给 merge train 的 T1 与细节门槛。所以峰值定在 12 个代理；需要更多时，由调速器排队，而不是加车道。

---

## 2. rubric 读回：分数在哪里，风险在哪里

- **达标线**：全部门槛（含 G-DETAIL、G16、G17）通过；每维度 ≥9.0；T_final = T·min(1, H/9) ≥92；没有 criterion <7；感知核心 13 项每项 ≥8。只有 R-final 有效。加权平均必须 ≥9.2，所以必须拿到**被盲评在 1× 中主动看到的** 10 分额外项。8 分全做对不够。
- **权重**：D1 11 · D7 10 · **D13 10** · D5 9 · D2/D3/D4/D6 各 8 · D11 7 · D8/D9 6 · D12 5 · D10 4。
- **封顶最狠的门槛**（先防）：G15 → 0；G1/G6 → 30；G2 → 40；G3/G7/G17 → 50；G5/G9/G10/G11/**G-DETAIL** → 60；G8/G12/G13/G14 → 70；G16 → 89。
- **感知核心**：C1.3、C4.1、C5.1、C5.2、C6.1、C6.3、C7.1、C7.2、C7.6、C7.7、C8.1、**C13.1、C13.2**。其中 7 项落在关键路径上的鹈鹕形体、细节与表演上，这是关键路径必须给鹈鹕的原因。
- **晚发现代价最高的缺陷**（从 §11 基线与 §13.1 冻结项反推）：

| 风险 | 晚发现的代价 | 最早暴露点 | 暴露工具 |
|---|---|---|---|
| 富细节下 fps 崩（BL-17：草稿 C 19–22 fps） | G9 → 60，C13.6 ≤5，还要回炉所有美术 | **H4** 步行骨架的性能金丝雀 | perf.mjs（trace）+ 合成细节负载 `?synthload=3.5` |
| 读不成鹈鹕（G7） | 总分 ≤50，形体返工拖垮关键路径 | **H9** 形体锁前的早期物种快测 | thumb.mjs + 3 名 J-blind（非计分） |
| 腹—座悬空 / 陷入、KOPS（BL-08/09） | G3 → 50，身体轮廓与座形都要改 | **H2–H6** rig 车道第一件事 | check-rig --seat --biomech |
| 飞轮 ≠ 3×曲柄（BL-02）、链条层序（BL-03）、整数链节（BL-11） | G3/C2.2；车的美术要重画 | **H2** 契约 v1 | check-rig、check-bike |
| 竖屏裁切（BL-01）、标题卡遮挡 | G8 → 70 | **H4** 骨架 | ux-matrix --mobile、first-look |
| SMIL 烘焙与 z-band 不兼容 | G5 → 60，交付物返工 | **H5** 在占位美术上烘焙 | check-baked（早期版） |
| Artifact 沙箱下载静默失效（BL-23） | G13 → 70 | **R0（H6.5）** 发布探针 | export-check、publish-probe |
| 细节倍数不足或被反作弊折损 | G-DETAIL → 60，D13 ≤4 | **每次 drop** | detail-inventory --layer、燃尽图 |
| 远侧腿画在车架前（C1.2 blocker） | 封顶 6 | **每次 drop**（T1） | check-occlusion 12 相位 |

---

## 3. 关键路径分析（CPM）

### 3.1 任务图

时长是单个代理的墙钟估计，包含 ≥3 次视觉自检迭代。依赖用 → 表示。"锁点"是接口先行的交付物：一旦发布就不再改变接口，内部可以继续打磨。

| # | 任务 | owner | 时长 | 依赖 | ES | EF | 松弛 |
|---|---|---|---:|---|---:|---:|---:|
| A1 | 契约 v1（z-band、slot 重排 + spider、整数链节、锚点、parts、data-detail、钩子、renderTuple、keymap/i18n 位置、竖屏机位接口） | ARCH | 2.0 | — | 0 | 2.0 | 0 |
| A2 | 角色圣经、X-sheet、节拍表、构图（地平线决定） | DIR | 2.5 | — | 0 | 2.5 | 0 |
| A3 | 步行骨架：z-band 运行时、钩子、占位美术迁移、性能金丝雀、竖屏框定、BL-04/05/06/18 | ARCH | 2.0 | A1 | 2.0 | 4.0 | 0.5 |
| K1 | 细节工具包 kit + 七墨 × 6 时段墨组 | SK | 3.5 | A1 | 2.0 | 5.5 | 1.5 |
| L1 | 行进 / 重量：腹—座、KOPS、飞轮、ankling、24 s 精确周期、sim-time 事件 | RIG-L | 4.0 | A1 | 2.0 | 6.0 | 3.0 |
| P1 | **剪影锁**：身体 / 颈 / 头轮廓 + 挂点表 | PB | 2.0 | A1, A2 | 2.5 | 4.5 | **0** |
| P2 | 鹈鹕身体形体（至头部形体锁 H7，身体形体锁 H8.5） | PB | 4.0 | P1, L1(部分) | 4.5 | 8.5 | **0** |
| P3 | 肢体形体（先脚与跗跖，后翼与羽扇） | PL | 5.5 | P1 | 3.5* | 9.0 | 0.5 |
| P4 | 早期物种快测 + 形体锁审查 | EL/SK | 0.5 | P2, P3 | 9.0 | 9.5 | **0** |
| D1h | 头、喙、喉囊、冠、围巾细节（从头部形体锁开始） | DA-head | 7.5 | P2(头部锁 H7) | 7.0 | 14.5 | 1.0 |
| D1p | 羽区、覆羽、飞羽、尾、裤管、跗跖鳞细节 | DA-plume | 6.5 | P4 | 9.5 | 16.0 | **0** |
| F1 | 视线 / 面部 / 鸟类眨眼 | RIG-F | 3.0 | L1 | 6.0 | 9.0 | 3.5 |
| E1 | 事件表演：跳车物理、挥手、车铃、吞鱼序列、滑行、打断 | RIG-A | 6.0 | F1, A2 | 9.0 | 15.0 | 1.0 |
| E2 | 事件的鹈鹕视觉：喉囊隆起、颈部隆起、表情 | PB（第二段） | 1.5 | E1, D1h | 15.0 | 16.5 | 0.5 |
| B1 | 自行车形体与机械 | BK | 6.0 | A1 | 2.5 | 8.5 | 2.0 |
| B2 | 车五金 / 传动 / 车筐与鱼细节 | DA-bikehw, DA-drive, DA-cargo | 6–7 | B1(分区锁) | 7.0 | 15.5 | 1.5 |
| W1 | 海 / 陆形体、瓦片、视差 | SEA, LAND | 5.5 | A1, A2(地平线) | 2.5 | 8.0 | 3.0 |
| W2 | 天空形体 + 光芒 | SKY | 3.0 | K1 | 5.5 | 8.5 | 3.0 |
| W3 | 海 / 陆 / 天 / 版式细节 | DA-sea, DA-land, DA-sky, DA-print | 6–8 | W1/W2 分区锁, K1 | 7.0 | 15.5 | 1.5 |
| X1 | UI + keymap + i18n + a11y | UI | 7.0 | A1 | 2.5 | 9.5 | 7.5 |
| X2 | 烘焙器（占位 → 真实美术） | BAKE | 5.0 + 1.5 | A3 | 4.0 | 9.0 / 16.5 | 0.5 |
| X3 | 开场、机位、自动导演、标志性时刻、彩蛋 | DIR（第二段） | 9.0 | A2, A3 | 4.0 | 13.0 | 4.0 |
| I1 | **集成冻结 + 稳定化**（T2 全绿、烘焙、perf、细节梯级 R-b） | ARCH + 全体 on-call | 2.0 | 以上全部 | 17.0 | 19.0 | 0 |
| R1 | 完整评审轮（证据包流水线） | EL + 评审池 | 4.0 | I1 | 19.0 | 23.0 | 0 |

\* PL 在 P1 发布之前可以先做脚与跗跖，这部分不依赖身体轮廓；翼根的形状等剪影锁。

**关键路径**：A2 → P1 → P2 → P4 → D1p → I1 → R1 → 修复快照 → R-final，≈H0→H23，外加修复与终评约 13 h。**次关键路径**：L1 → F1 → E1 → E2（松弛 0.5–1 h）与 D1h。因此：
- 鹈鹕是唯一一个给 **2 条车道**（P 形体 + P2 细节）的部件。P2 车道从头部形体锁（H7）就开始，而不是等全部形体完成。
- rig 车道把 RIG-L 排在最前面（H2），因为身体轮廓与腹—座接触要以它为准，而它只依赖契约，是纯 node 工作，不占 Chromium。
- 松弛最大的是 UI（7.5 h）与世界（3 h）：它们让出 Chromium 槽位。调速器排队时，优先级按松弛从小到大分配（§4.4）。

### 3.2 锁点（接口先行的交付物）

| 锁点 | 发布者 | 时刻 | 内容（`docs/locks/<id>.json` + PNG） | 解锁谁 |
|---|---|---|---|---|
| L-contract-v1 | ARCH | H2 | 契约 v1 全文，check-contract 通过 | 所有车道 |
| L-horizon | DIR | H2.5 | 风格 C 地平线值、wide/close/cinematic/portrait 机位框 | SEA、SKY、LAND |
| L-silhouette | PB | H4.5 | 身体 / 颈 / 头轮廓路径；挂点：肩窝、翼根线、髋线、颈基、围巾结、座接触线 | PL（翼根、裤管）、DA-plume（覆羽排布区）、RIG-L（腹—座） |
| L-head-form | PB | H7 | 头、喙、喉囊、眼、冠的形体与局部坐标 | DA-head |
| L-body-form | PB + PL | H8.5–9 | 身体、翼、腿的形体（形体锁需通过 P4 快测） | DA-plume |
| L-bike-zones | BK | H5 / H7 / H8.5 | 分区锁：车架 → 座舱 → 轮与传动 | DA-bikehw → DA-cargo → DA-drive |
| L-world-zones | SEA / LAND / SKY | H5–H8.5 | 每个带的布局框与道具位置表（data-size-m） | DA-sea、DA-land、DA-sky |
| L-print-frame | DIR + DA-print | H6 | 边框、标题卡时序、letterbox 行为 | DA-print 细节 |
| L-pose-fields | RIG-L / RIG-F / RIG-A | H6 / H9 / H12 | 新 pose 字段（gaze、pouchBulge、neckBulge、smear 等）与取值范围 | PB、FX、AUD、BAKE |

锁点后若要改接口，必须走 ARCH 的契约变更请求（`docs/contract/requests/*.md`）。merge train 会拒绝违反 `check-contract` 的合并。

---

## 4. 并发拓扑：车道、worktree、merge train、渲染池

### 4.1 车道一览

| 车道 | workflow | worktree / 分支 | 槽 1 | 槽 2 | 活跃时段 |
|---|---|---|---|---|---|
| **A** 冻结 | `wf-freeze.v1.js` | 主树 / `integ` | ARCH（A1→A3） | DIR（A2） | H0–H4 |
| **T** 工具 / 评估 | `wf-tools.v1.js` | `lane/tools` | 工具匠队列（T0 优先，后 T1） | 工具匠队列 / EL（R0） | H0–H17，之后转评估 |
| **F** 隔离 | `wf-field.v1.js` | `lane/field`（**不含 rubric 与 docs/team**） | FB 基线 #1、#3 | FB 基线 #2 → RT 红队 | H0–H6 |
| **D** 导演 / 风格 | `wf-lane.v1.js {lane:'D'}` | `lane/direct` | DIR（X3） | SK（K1 → 风格审查值班） | H2–H17 |
| **R** rig / fx | `wf-lane {lane:'R'}` | `lane/rig` | RIG-L → RIG-F → RIG-A | FX（H6 起） | H2–H17 |
| **P** 鹈鹕形体 | `wf-lane {lane:'P'}` | `lane/pelican` | PB | PL | H2.5–H17 |
| **P2** 鹈鹕细节 | `wf-lane {lane:'P2'}` | `lane/pelican-detail` | DA-head | DA-plume | H7–H17 |
| **B** 自行车 | `wf-lane {lane:'B'}` | `lane/bike` | BK → DA-drive | DA-bikehw → DA-cargo | H2.5–H17 |
| **W** 世界 / 版式 | `wf-lane {lane:'W'}` | `lane/world` | SEA → DA-sea → DA-sky | LAND → SKY → DA-land → DA-print | H2.5–H17 |
| **X** 系统 | `wf-lane {lane:'X'}` | `lane/systems` | UI → AUD → PKG | BAKE → SPEC | H2.5–H19 |

**同时活跃的车道**：H0–H2.5 为 A、T、F（6 个代理）；H2.5–H7 为 T、F（至 H6）、D、R、P、B、W、X，共 8 条车道。这超出了峰值 6 条的目标，所以 **X 与 W 错峰**：X 在 H2.5–H4.5 只开 1 个槽位（UI）；T 在 H6 之后降为 1 个槽位（EL 做 R0 期间）。调速器实测 shotd 排队时间，超过阈值就暂停松弛最大的车道新开代理。H7–H17 为 T(1)、D、R、P、P2、B、W、X，按调速器实测保持 ≤12 个代理。H17 之后构建车道关闭，只保留 on-call 修复者。

> 为什么是车道，而不是每个部件一个 workflow：车道内的 2 个代理共享一个 worktree，零合并成本就能看到彼此的最新作品（例如 PB 与 PL 之间的肩部接缝）。车道之间通过 merge train 每 20 分钟同步一次。车道边界按"耦合强、需要频繁互看"的部件来划（鹈鹕身体 ↔ 肢体、车架 ↔ 车五金），而不是按 rubric 维度来划。

### 4.2 worktree 与分支

```
main repo (claude/gracious-allen-1ksl3j)   ← 最终 PR 分支，只接受 integ 的快进
  └─ integ                                  ← merge train 维护的集成分支，任何时刻可构建
       ├─ lane/tools ─ lane/direct ─ lane/rig ─ lane/pelican ─ lane/pelican-detail
       ├─ lane/bike ─ lane/world ─ lane/systems
       └─ lane/field（从 H0 的 integ 分出，永不合并；只导出冻结的基线产物）
../pb-wt/<lane>/  每个 worktree；node_modules → 主树 node_modules 的 symlink
```

- `tools/lane.mjs create <lane>`：创建 worktree、symlink node_modules、写 `docs/team/lanes/<lane>.json`（车道状态、owner 名单、当前梯级）。
- `tools/drop.mjs`：构建者的唯一提交入口。它先跑本 worktree 的 T0 + 与 owner 文件相关的 T1，再用结构化提交信息提交到 `lane/<id>`：`[drop] <agent> <files> gates=<hash> detail=+N`。最后把一条记录追加到 `docs/team/ledger/<lane>.jsonl`，按车道分文件，避免写冲突。**代理自己不直接 git commit**。

### 4.3 merge train（持续集成，脚本驱动）

`tools/merge-train.mjs`，由 Lead 在后台运行，不是代理。每 20 分钟一轮，或者某条车道出现新 drop 时触发：

1. 对每条有新 drop 的车道：`git rebase integ`。有冲突时，按 owners.json 把冲突文件路由给 owner，在该车道的 `docs/team/lanes/<id>.json` 里写 `blockedBy`，由车道 workflow 下一轮让 owner 修复。
2. 在临时 worktree 中构建 integ + 该车道，跑 **T0 全部 + T1 受影响子集**（按改动文件映射到门槛，映射表 `tools/lib/gatemap.json`）。另跑 `ownership.mjs`：本次 drop 只触碰 owner 自己的文件。
3. 全绿则快进 `integ`；红则拒绝，把失败报告写回车道，附 T1 截图路径。
4. `integ` 每前进一次：后台跑 **T2 轻量集**（detail-inventory 全量、zoom-coverage 快速版、check-baked 快速版、vr 区域局部性 diff），并更新 `docs/detail/dashboard.json` 与燃尽图。
5. 每 2 小时一个**安静窗口**：merge train 取得 `/tmp/pb-cpu.lock`，shotd 暂停 5 分钟，跑一次 perf（wide + close，1 次 20 s，作为趋势，不计分）。如果 fps 比上一窗口下降 ≥3，把最近合并的 drop 按 band 二分定位，把回归路由给该 band 的 owner。

**早期集成的意义**：H8 起 `integ` 上一直有一个能打开的 dist，含全部模块的最新版本。所有跨模块问题（接缝、z 序、墨色不一致、骑者被前景遮挡、座与腹）在出现后 20 分钟内就能被 T1 发现，不会拖到集成阶段。

### 4.4 渲染池与调速器

- `tools/lib/shotd.mjs`（TS-perf，**T0 第一件**）：一个常驻进程，按 worktree 路径分别起静态服务器，维护 3 个预热的 Chromium 页面池。它接受 `{root, url, renderAt, viewport, dpr, crop, flags}` 请求，返回 PNG 路径；按内容哈希缓存（相关源文件树哈希 + 参数）。所有 Playwright 工具都改为先连 shotd，连不上时回退为自起浏览器。这同时修了 BL-07（去掉 /opt/node22 绝对路径，playwright 进 devDependencies，由 Lead 一次安装）。
- 优先级：merge train > R 轮证据 > 关键路径车道（P、P2、R）> B、W > D、X、T。
- `tools/governor.mjs`：读 shotd 排队时间与 load average，写 `/tmp/pb-governor.json`。车道 workflow 在启动下一个代理前读取它（通过 agent 提示里的一条"先运行 governor wait"指令实现），排队 >60 s 时按优先级让低优先级车道等待。

---

## 5. 门槛分级（便宜的先跑，失败就停）

| 级 | 墙钟 | 需要 Chromium | 内容 | 何时跑 |
|---|---|---|---|---|
| **T0** | <60 s | 否 | lint（含裸 hex、Math.random、UA 检测、`<fe`）、check-contract、ownership、node --test src/rig、check-rig --quick（360 样本）、build、audit-dist（静态部分）、check-purity（bundle grep）、i18n-lint、detail-registry lint（data-detail 格式、层名、唯一性）、check-docs、verify-claims（有文档改动时） | 每次 drop 前（drop.mjs）；merge train 每次合并 |
| **T1** | 3–5 min | 1 槽 | shotd hero + 4 相位 + owner 的 solo 裁图；console 收集器；check-anchors（12 相位）；check-occlusion（12 相位）；check-benchmark 快速版；check-contacts；check-anatomy（与改动 slot 相关的部分）；check-style（改动层）；detail-inventory --layer；zoom-coverage --layer（1 相位）；flicker.mjs（改动的运动层）；wagon 快速版（改动的旋转件）；motion-audit 快速版（rig 改动时）；keys / a11y / flash 快速版（UI 改动时） | drop 前跑受影响子集；merge train 跑并集 |
| **T2** | 15–25 min | 2–3 槽或独占 | MR-dom 全量、motion-audit --fuzz、check-baked 48 相位、loop-seam、perf（独占）、ux-matrix、a11y 10 状态、flash-check ≥90 场景、first-look、determinism、vr、detail 全量（inventory、zoom 4 相位 + hero、budget、saliency、check-scale） | 每次 integ 前进后跑轻量集；集成冻结后跑全量；每个快照轮之前 |
| **T3** | 12–75 min | 独占 | soak 12 min（R-final 另跑 60 min + 时间扭曲）、全新克隆 verify、xb-webkit（如果不是 N/A）、MR-field 配对 | R1、R-final |
| **T4** | 分钟到小时 | 读 PNG | 视觉评审代理：车道内自检 → DV 预检 → 早期物种快测 → 影子评审 → 轮次评审（J-lens / J-blind / J-adv / J-valid / J-detail / J-user） | 只在对应的 T0–T2 全绿之后 |

规则：
- **T0/T1 红时不启动任何 T4**（rubric §7.1："便宜的先跑、失败就停"）。G1、G3、G15、G17 与 check-benchmark 任一失败，就不开评审轮。
- **门槛缓存**：`tools/lib/gatecache.mjs` 以"门槛 id + 该门槛依赖的文件集合的 git 树哈希 + 工具自身哈希"为键，缓存结果 JSON。drop 只重跑依赖集变了的门槛。gate 工具在 R0 之后被哈希锁定，工具哈希不变，缓存就长期有效。
- **视觉回归的"局部性"检查**（新，`vr.mjs --locality`）：每次合并，对 golden 集求像素差，差异区域必须落在本次改动 owner 的 slot/layer 的 ID-map 区域内（来自 ?idmap=1）。越界差异说明有附带损伤，合并被拒。这让细节美术可以放心快速提交，而不会悄悄弄坏别人的区域。

---

## 6. 代理名单

### 6.1 通用提示骨架（所有构建者）

```
你是"鹈鹕湾"团队的 <ROLE>，在车道 <LANE> 的 worktree <WT> 中工作。风格 C（复古旅行海报，限七墨丝网印刷）已由用户选定；用户原话要求"最终交付的版本细节比 draft 多很多"。
必读：CONTRACT.md（v1）、docs/rig-spec.md、src/contract.js、docs/STYLE-C.md、drafts/C-poster/{keyframe,closeup}.png 与 gen.mjs、docs/character.md、docs/composition.md、docs/locks/*.json 中与你相关的锁点、docs/detail/plan.json 中分配给你的条目、docs/rubric/creative-brief.md。
你拥有的文件：<FILES>（其余文件只读）。需要别人改东西时，写 docs/contract/requests/<you>-<n>.md，不要改别人的文件。
工作循环（至少 3 次视觉迭代）：改代码 → node tools/quick.mjs --solo <part> --crop <region> --pair-draft --dpr 3（Read 生成的 PNG）→ node tools/drop.mjs（T0 + 受影响的 T1；红了就修，不许绕过）。每 3 次 drop 看一次车道联系表 node tools/cycle24.mjs --lane。
你的验收标准：<ACCEPTANCE>（全部是可运行的命令与阈值）。你的 criterion：<CRITERIA>。你永远不给自己打分；你的报告里只列命令输出与截图路径。
禁止：npm install、直接 git commit、读 docs/eval/judges/**、在运动部件上用 filter 或网点、Math.random、裸 hex。
开始每个代理任务前先运行 node tools/governor.mjs wait。
返回结构化报告：{owner, files, drops[], acceptance:{cmd,result}[], detailLinesAdded, contractRequests[], knownIssues[]}。
```

### 6.2 名单（47 个角色）

**负责人与架构（3）**

| 角色 | 职责 | 拥有文件 | 输入 | 验收（可运行） | 提示要点 |
|---|---|---|---|---|---|
| **Lead**（主会话） | 启动 / 监控车道；运行 merge train；用户联络（G16，中文）；PR 与 Artifact 发布；最终交接 | `tools/{merge-train,lane,drop,ownership,governor}.mjs`、`docs/team/owners.json`、`docs/team/lanes/*`、`docs/team/ledger/*` | 本方案 | ownership 审计 0 越界；`git status --porcelain` 为空；G13 的全部链接可达 | —（非子代理） |
| **ARCH** 契约 / 运行时 / 性能架构师 | A1 契约 v1；A3 步行骨架（z-band、钩子、性能金丝雀）；之后兼任集成值班 + 性能（C10.x）+ 确定性（C12.3） | `src/contract.js`、`CONTRACT.md`、`src/scene.js`、`src/main.js`、`src/core/{math,svg,bus,bakekit,bands,hooks,time,parts}.js`、`src/index.dev.html`、`src/page.css`、`tools/{build,serve,merge-static}.mjs`、`budgets.json`、`docs/architecture.svg`、`docs/contract/**` | rubric §13.1 的 18 项、rig-spec | check-contract 绿；骨架在 390×844 / 844×390 / 720×800 下 G8 通过；性能金丝雀（`?synthload=3.5`）wide 与 close 下 trace ≥55 fps、p95 ≤25 ms；renderAt 与历史无关（determinism a–c）；BL-02/03/04/05/06/17/18/25 关闭 | "先把 §13.1 的 1–18 全部落进契约再写一行运行时；z-band 的目标是：骑者带以外的带在平移时只做合成层 transform，不重绘" |
| **DIR** 导演 | A2 导演文档先行；X3 开场（cold open）、机位（含竖屏、Artifact 面板）、自动导演、24 s 故事循环、标志性时刻、彩蛋 | `docs/{character,timing,beats,composition}.md`、`docs/eggs.json`、`src/core/camera.js`、`src/director/{intro,autodirector,moment,eggs,portrait}.js` | STYLE-C、creative-brief、rubric D6/D7/D8 | timing.md 中的每个关键帧被 check-timing 实测命中（±2 帧）；first-look 0.3 s 首帧完整；loop-seam ≤1.2；wide/cinematic 下骑者 100% 在画内；标题卡在任何机位下 0 遮挡 | "每个节拍写成 60 fps 的 X-sheet；自动导演只能经 eventsLog 驱动（renderTuple）；标志性时刻必须在 1× 默认视图里被没看过 rubric 的人注意到" |

**风格（1）**

| 角色 | 职责 | 拥有文件 | 输入 | 验收（可运行） | 提示要点 |
|---|---|---|---|---|---|
| **SK** 风格守护 / 墨组 / 细节工具包 | K1：风格 C 细节工具包 + 6 时段七墨墨组；之后值班做风格审查（每 2 h 审一次 integ 联系表），对"抢骑者戏 / 违反 STYLE-C"的细节有**否决权** | `src/core/palette.js`、`src/art/kit/*.js`、`docs/style/{ink-sets.json,review-*.md}` | STYLE-C §1–§6、drafts/C-poster/gen.mjs 的 dots()、字形转路径脚本 | check-style 0 违规（七墨 + 同墨网点、量化光晕 2–3 环）；6 时段 × 7 墨在 check-style --palette 中通过相对色彩约束；kit 的每个生成器是纯函数且种子化（node 测试：同种子同输出）；judge/saliency 骑者显著性 ≥1.4 | "kit 是所有细节美术的共同语言：扇贝排、羽扇、排线、网点带（只给静态层）、编织、鳞纹、铆钉 / 螺栓 / 弹簧、art-deco 描线大写、票根虚线。每个生成器都带 LOD 参数，并返回按墨分组的路径" |

**工具匠（6，车道 T；T0 先于构建，T1 与美术并行）**

| 角色 | 拥有的工具（均在 `tools/`） | 验收 |
|---|---|---|
| **TS-perf** 平台 / 基础设施 | `lib/{shotd,lock,gatecache,gatemap.json,console}.mjs`、`shoot.mjs`（修 BL-07、BL-16）、`sheet.mjs`、`render.mjs`、`lint.mjs`、`perf.mjs`、`live-parity.mjs`、`soak.mjs`、`robust.mjs`、`contexts.mjs`、`audit-dist.mjs`、`xb-audit.mjs`、`xb-webkit.mjs`、`check-purity.mjs`、`check-detail-budget.mjs`、**`flicker.mjs`**（新）、**`quick.mjs`**（新）、**`cycle24.mjs`**（新，RS-cycle24 的快速版） | tool-validity：已知良好 fixture 通过、mutant 全失败、两次重复结论相同；shotd 冷启动 <5 s，缓存命中 <50 ms |
| **TS-geo** 几何 / 正典 | `check-anchors`、`check-occlusion`、`check-contacts`、`contact-probe`、`check-benchmark`（含 mutant 画廊）、`check-bike`、`check-kinematics`、`check-noslip`、`wagon`、`check-anatomy`、`check-scale` | 同上；check-benchmark 在 RT 的 ≥10 个美术缺陷上 100% 标红（C12.8） |
| **TS-motion** 动作 QA | `check-rig`（扩展：--seat --biomech --events）、`mutate-rig`、`motion-audit`（--fuzz --events --face --lag --transitions --plots）、`filmstrip`（--dense）、`onion`、`check-temporal`、**`check-timing`**（新：实测对 timing.md）、`determinism`、`vr`（含 --locality）、`loop-seam`、`check-baked`（含 --static，与 BAKE 分离以保持独立） | mutate-rig 杀死率 100%；motion-audit 在 BL-13/14 的 phase-0 缺陷上报警 |
| **TS-ux** 体验 / a11y | `ux-matrix`、`first-look`、`interact`、`keys`（**按键驱动**）、`a11y`（锁定版本的 axe-core）、`contrast`、`flash-check`、`i18n-lint`、`cjk-glyph`（不用 document.fonts.check，BL-30）、`check-text`、`audio-check`、`judge/audio-offline`、`export-check` | 在 phase-0 上检出 BL-01/05/06/23 |
| **TS-detail** 细节度量（**不是**细节美术） | `detail-inventory`、`zoom-coverage`、`judge/detail-pairs`（草稿同位置裁图配对）、`check-style`、**`detail-diff.mjs`**（新：两个提交之间的新增 / 消失 / 被合并条目） | R0 在草稿上复核 129 条基线（差异按"取大"规则锁定）；zoom-coverage 的阈值在草稿上校准后冻结 |
| **TS-judge** 评审系统 | `judge/{pack,harness,canary,wild,palette,saliency,seams,edges,acting,controls,film,eggs,package}.mjs`、`score.mjs`、`coverage.mjs`、`tool-validity.mjs`、`field.mjs`、`verify.mjs`、`verify-claims.mjs`、`readme-lint.mjs`、`check-docs.mjs`、`check-contract.mjs`、`check-inspect.mjs`、`blind-lint.mjs` | score.mjs 对 items.json 的手算样例 100% 一致；harness 不暴露 DOM / aria / evaluate |

**rig（3）**

| 角色 | 拥有文件 | 验收 | 关键内容 |
|---|---|---|---|
| **RIG-L** 行进 / 重量 | `src/rig/{solve,ik,locomotion,secondary}.js`、`src/rig/locomotion.test.js`、`src/art/debug-skeleton.js` | G3 全部（含 --seat：每个解析样本腹—座 ≤1 u；--biomech：KOPS、座管角进入 fit 区间）；飞轮 ≡ 3×曲柄（含滑行）；24 s 精确周期；motion-audit：骨盆 y 与躯干俯仰在下踩期有可测的"发力沉降"；冠 / 喉囊 / 尾滞后 >0（修 BL-13） | 这是次关键路径的起点：H6 之前先发布 L-pose-fields v1 |
| **RIG-F** 视线 / 面部 | `src/rig/face.js`、`face.test.js` | pose.gaze；瞬膜横扫眨眼（不是竖直 sy，修 BL-14）；头部急动 / 定住；表情状态机；motion-audit --face 120 s 无节拍器化 | "像鸟，不是穿鸟装的人" |
| **RIG-A** 表演 / 事件 | `src/rig/events.js`、`events.test.js` | 跳车：预备蹲、单轮先离地、空中曲柄惯性、落地过冲（修 BL-10，按 g=2885 u/s²）；挥手时车把有转向响应；吞鱼完整序列（头后仰 ≥40°、鱼转移、颈部隆起下行，修 BL-15）；事件可叠加、可打断，fuzz 300 日程 0 跳变 | 以 timing.md 为准；每个事件出 8 帧条带 + 10 列 filmstrip 自检 |

**鹈鹕（2 形体 + 2 细节）**

| 角色 | 拥有文件 | 验收 |
|---|---|---|
| **PB** 身体 / 头 / 喙 / 喉囊形体 | `src/art/pelican-body.js` | H4.5 剪影锁；H7 头部锁；P4 早期物种快测 ≥4/5 首先说"鹈鹕"（256 px notext）；STYLE-C §3：满足的表情（去掉厚眼线）、实心纸白身体；喉囊在所有状态都在（check-anatomy）；neckD 命令数固定 |
| **PL** 翼 / 腿 / 脚形体（近 + 远） | `src/art/pelican-limbs.js` | 翼读作翼：覆羽根部并入身体侧面、次级飞羽垂在"臂线"下、N 初级飞羽从腕部向后扫、握把处 ≥4 枚分开的羽尖且没有指节（G7）；全蹼足 4 趾平贴踏板；远侧平涂 B/N；12 相位接缝 0（check-contacts） |
| **DA-head** 头部细节 | `src/art/detail/head.js`（parts → head / billUpper / billLower / pouch / eye / crest / neck 围巾） | catalogue.pelican 中：喙脊线、喙缘线、钩的高光与下钩、眼周裸皮、眼睑与高光、冠羽丝 ≥7 缕、喉囊纹理线（随 sy 拉伸，0 撕裂）、围巾条纹 / 织纹 / 流苏；头部区 zoom-coverage ≥97% |
| **DA-plume** 羽区 / 飞羽 / 腿脚细节 | `src/art/detail/plume.js`（parts → body / tail / wing* / thigh* / shank* / foot*） | 覆羽 ≥3 排扇贝边向尾叠压（data-tract）；≥8 枚可数初级飞羽 + 带 P 细边的次级飞羽；尾羽 ≥5 枚；颈部羽流线；"裤管"羽缘；跗跖鳞线、趾节、蹼褶、爪；身体仍是实心纸白，网点只在边缘窄带且间距 ≥5；身翼腿区 zoom-coverage ≥97% |

**自行车（1 形体 + 3 细节）**

| 角色 | 拥有文件 | 验收 |
|---|---|---|
| **BK** 车形体与机械 | `src/art/bike.js` | CANON 车部分；整数链节（后下叉 125.433 u，ARCH 在 A1 定稿）；chainring 在 chain 之前、spider 在 chain 之后（BL-03）；辐条淡出 + 两墨模糊盘，气门与反光片保留真实旋转（BL-12）；check-bike 全部；H5/H7/H8.5 分区锁 |
| **DA-bikehw** 车架与座舱五金 | `src/art/detail/bikehw.js` | lug 与五通壳 / 头碗、线管 + 线缆 + 线扣、刹车夹器与刹把、挡泥板撑杆与螺丝、车铃穹顶与拨杆、车灯镜片与支架、车头徽标、座弹簧 + 铆钉 + 座弓 + 座夹 |
| **DA-drive** 轮与传动细节 | `src/art/detail/drive.js` | 条帽、轮圈孔、气门帽、胎纹与胎侧、链片 / 销 / 滚子、踏板笼与反光片；**每次 drop 跑 wagon 快速版**，周期细节随辐条一起淡出，0 倒闪 |
| **DA-cargo** 车筐与鱼 | `src/art/detail/cargo.js` | 上下交错编织、筐沿、筐底；鱼的鳞纹、鳍、鳃盖、眼（≥2 种鱼）；鱼尾偶尔甩动（与 RIG-A 的吞鱼接口对接） |

**世界与版式（3 形体 + 4 细节）**

| 角色 | 拥有文件 | 验收 |
|---|---|---|
| **SEA** | `src/world/sea.js` | 地平线按 L-horizon；≥3 条海带；灯塔光束（夜）；瓦片无缝；每个道具带 data-size-m |
| **LAND** | `src/world/land.js` | 路面顶 = GROUND_Y；瓦片按 TILE 无缝；前景只盖 GROUND_Y 以下、至多轮底 8%，接触区 ≥70% 可见 |
| **SKY** | `src/world/sky.js` | 光芒约 1°/s 缓慢旋转；量化 2–3 环光晕；夜空星座；不用 filter |
| **DA-sea** | `src/world/detail/sea.js` | 浪纹、泡沫线、日 / 月光路、栈桥与桩、礁石与拍岸浪、编号浮标、带支索 / 帆脚索 / 旗的帆船、渔船或汽船、水面鸟群 |
| **DA-land** | `src/world/detail/land.js` | 港镇（窗、屋顶、烟囱、钟楼；夜间窗户亮灯）、灯塔看守小屋、海堤石块砌缝、护栏 / 柱桩 / 路牌 / 长椅 / 邮筒 / 里程碑、与草稿不同的路灯细部、按种类的植物（棕榈、龙舌兰、罂粟、沙丘草）、更衣亭 / 遮阳伞、路面标线与路缘；check-scale 通过 |
| **DA-sky** | `src/world/detail/sky.js` | ≥3 条云带或云型、日 / 月盘光环、远近不同大小的鸟群、夜间星座、风筝 / 远景飞机（可选） |
| **DA-print** 版式 / 边框 / 画内文字 | `src/print/{frame,type,stamp,ticket}.js`、`src/print/glyphs.json`、`tools/glyphs.mjs` | 海报边框 + 内框线 + 角饰；字形正确的 deco 题签（不冒充篆刻，§12 裁决）；车票式注记（票号、站名、票根虚线）；标题 inline + 阶梯阴影；套印标记 / 色标条；小字编号与版次；全部转路径并进 data-text 清单；cjk-glyph 0 豆腐块；电影模式变 letterbox |

**fx、系统与特别项（6）**

| 角色 | 拥有文件 | 验收 |
|---|---|---|
| **FX** | `src/fx/*.js` | fx 是 (t, distance, events) 的纯函数（可倒放、可烘焙）；鸥群护航；速度线、尘土 / 落叶、跳车落地冲击印版、吞鱼沥水水滴、风带（fx ≥10 条细节）；每事件至多 1 个"丝网 pop"且 ≤6 帧；flash-check 通过 |
| **UI** | `src/ui/{ui,styles,keymap,i18n}.js` | keymap.js 是唯一事实源，帮助层与 README 表由它生成；G11/G12 全部；390 px 底部抽屉；面板打开 / 折叠都与骑者 0 重叠；下载在沙箱 iframe 中要么可用、要么有可见回退 |
| **AUD** | `src/audio/*.js` | `createAudio(bus,{context})` 接受注入的 OfflineAudioContext；用户开启前 0 个 AudioContext；audio-offline 30 s 频谱无削波 |
| **BAKE** | `src/bake/*.js`、`tools/bake.mjs` | H5 在占位美术上跑通 SMIL；之后随美术更新；G5 全部；烘焙头部裁图与实时版平均绝对差 ≤6/255（C13.2 的 10 分项）；≤500 KB gzip |
| **SPEC** 特别交付 | `src/mini/pelican-mini.svg`（手写，≤16 KB）、`src/inspect/*.js`（X 光检查模式） | mini 通过 CANON-14；check-inspect 通过；检查模式读数标注"solver" |
| **PKG** 包装 | `README.md`、`docs/handoff.md`、`docs/THIRD_PARTY.md`、`LICENSE`、`docs/claims.json`、`tools/{webm,poster,contact-sheet}.mjs` | webm 确定性 60 fps、帧数 = 时长×60；verify-claims 与 readme-lint 0 命中；字体许可齐全（G15） |

**细节管理（2）**

| 角色 | 拥有文件 | 验收 |
|---|---|---|
| **DQM** 细节总账（制作方） | `docs/detail/{plan.json,registry.json,backlog/*.md,dashboard.json,burnup.png}`、`tools/detail-dashboard.mjs` | H5 前发布 plan.json（每条目：层、O/T、名称、归属 DA、区域、可见机位、墨、带、预估成本）；每 3 h 审一次燃尽图并重新分配 backlog；梯级按时达成 |
| **DV** 独立细节验证者（**不参与制作**，每个检查点换新实例） | `docs/detail/qa/<checkpoint>.json` | 按 J-detail 协议在 RS-detail 上做盲清点与 7 区并排比较，输出"感知清单倍数"预测与低于目标的区域；召回植入的"细节缺失"canary ≥80% |

**隔离组（2）**

| 角色 | 约束 | 产出 |
|---|---|---|
| **FB** 匹配投入基线生成者 ×3（best-of-3） | 在 `lane/field` 中工作，看不到 rubric、docs/team 与本方案；同模型同工具，60–90 分钟 | `field/baseline/{1,2,3}/`；H6 由 TS-judge 冻结哈希并入库到 `docs/eval/field-baseline/`；另加一次同模型单次对照 |
| **RT** 红队缺陷作者 | 没看过 tools/check-*；只读契约与钩子文档 | `src/mutants/{art,foils}.js`（经 ?mutant= 注册：脚美术平移 3 u、前叉旋转 2°、腹部画高 3 u、nopouch、stork、goose……≥10 个）、`test/redteam/defects.json` |

**评估组（每轮全新，由 EL 调度；10 类）**

| 角色 | 人数（每轮） | 说明 |
|---|---|---|
| **EL** 评估负责人 | 1 | 拥有 `docs/eval/**`、`tools/predict.mjs`；组装证据包；持有 canary 答案；跑 score.mjs；写 scorecard |
| **J-lens** 维度评审 | D6/D7 各 5，其余各 3，共 43 | 只拿本维度的 items 与证据包 |
| **J-blind** 盲感知池 | 约 25 个实例 | 识别、偏好、笑点、个性、横向对比 |
| **J-adv** 对抗评审 | 4 + 每个中位分 ≥9 的 criterion 1 名 | C1.2、C7.5 与 ≥9 复核 |
| **J-valid** 验证者 | 3–6 | 核实缺陷，自身也用真 / 假缺陷校准 |
| **J-detail** 细节评审 | 2 | G-DETAIL / C13.1 |
| **J-user** 冷启动 / 探索 | 3 | 桌面、390 px 触屏、彩蛋探索者（harness） |
| **J-bi** 双语文案 | 1 | C9.8 |
| **J-a11y** | 1 | C9.5 |
| **J-mech** 盲评自行车技师 | 1 | C2.7 |

合计：Lead 1 + 架构 / 导演 2 + SK 1 + 工具匠 6 + rig 3 + 鹈鹕 4 + 自行车 4 + 世界 / 版式 7 + fx / 系统 / 特别 6 + 细节管理 2 + 隔离 2 + 评估 10 类 = **48 个角色（不计 Lead 为 47 个）**。

### 6.3 契约 v1 中为吞吐新增的原语

1. **parts**（细节并行的关键）：任何文件都可以导出 `parts = [{ target: 'slot:body' | 'layer:L-shore', z: <int>, id, build(ctx) → markup, attach?(svg, ctx) }]`。`src/core/parts.js`（ARCH）按 target 与 z 组合进 slot / layer；registry 由 `owners.json` 声明，哪个文件可以向哪个 target 贡献都写在里面。这样形体 owner 与细节美术写不同文件，却画在同一个 slot 里，同一时刻可以并行。z 范围按 owner 分段（形体 0–49，细节 50–99），不会互相穿插。
2. **data-detail / data-tract / data-text / data-size-m**：由 kit 的包装函数 `kit.detail(layer, kind, name, markup)` 自动加上，DA 不手写标注。detail-registry lint 在 T0 检查。
3. **merge-static 规则**：构建时对静态带做"**条目内、按墨合并**"。同一 data-detail 条目内、同一墨色的路径合并为一个 path；条目根 `<g data-detail>` 保留，所以 detail-inventory 仍能逐条计数。重复条目用 `<use>`。check-detail-budget 验证每个静态带 ≤200 个 path。
4. **?synthload=k**（ARCH，性能金丝雀）：在每个静态带生成 k × 草稿路径数的合成细节，在骑者带生成 k × 草稿骑者节点数的合成细节，用来在美术存在之前验证帧率上限。
5. **?solo=<part>&crop=<region>**：quick.mjs 与 detail-pairs 共用一个区域表 `docs/contract/regions.json`（与 RS-detail 的 7 个区域、RS-crops 的 9 个区域一致，都在 rider 或 world 坐标中定义）。

---

## 7. 细节密度生产线（G-DETAIL / D13，用户硬性要求）

### 7.1 目标表（内部目标 = 10 分档 + 余量）

| 层 | 草稿 | G-DETAIL（8 分） | 10 分档 | **内部目标** | 产出者（条数） |
|---|---:|---:|---:|---:|---|
| pelican | 27 | ≥54 | ≥54，每层 ≥2.0× | **100（3.7×）** | PB 14 · PL 11 · DA-head 36 · DA-plume 39 |
| bike | 42 | ≥84 | ≥84 | **155（3.7×）** | BK 44 · DA-bikehw 48 · DA-drive 30 · DA-cargo 33 |
| sea | 9 | ≥14 | ≥18 | **34（3.8×）** | SEA 10 · DA-sea 24 |
| land | 30 | ≥45 | ≥60 | **110（3.7×）** | LAND 34 · DA-land 76 |
| sky | 10 | ≥15 | ≥20 | **36（3.6×）** | SKY 12 · DA-sky 24 |
| fx | 1 | ≥4 | ≥6 | **10** | FX 10 |
| typography_frame | 10 | ≥15 | ≥20 | **36（3.6×）** | DA-print 36 |
| **合计** | **129** | **≥323** | **≥452（3.5×）** | **481（3.73×）** | DQM 负总责 |

按 10% 的反作弊折损计（SSIM 合并、<2 px²、遮挡 ≥50%），计入数仍 ≥433（3.36×）。所以 R-c 梯级要求**计入数** ≥452：折损超过预期时，由 DQM 在 R-b 与 R-c 之间追加 backlog，不留到 R-final。

zoom-coverage 目标：鹈鹕 ≥97%、车 ≥95%（10 分档）；门槛 85% 且没有 ≥4 个连续空白格。

### 7.2 流水线（细节美术在锁点后立即开工，而不是等"形体全部完成"）

```
            ┌─ kit + 墨组（SK, H2–H5.5） ───────────────────────────────────────┐
plan.json (DQM, H3–H5) ─┐                                                     │
                        ▼                                                     ▼
 形体 owner:  剪影锁 → 分区锁 z1 → z2 → z3 ─────► 形体打磨（修复轮）
                         │         │      │
 细节美术:               └► 区 z1 细节 L1 ─► z2 L1 ─► z3 L1 ─► 全区 L2（10 分额外项）─► 打磨
                                   │ 每次 drop：T0 registry lint + T1 inventory/zoom/flicker/wagon/style
 merge train:                      └─► integ 前进 → T2 细节全量 → dashboard + 燃尽图（每 20 min）
 DQM:                         每 3 h：燃尽图 → 重新分配 backlog → 追加条目
 DV（每个梯级检查点换新）:           R-a (H11)        R-b (H16)                   R-c（R-final 前）
 J-detail（轮次）:                                              R1                  R-final
```

**每个 DA 的内循环**（每次约 20–40 分钟）：
1. 从 `docs/detail/backlog/<DA>.md` 取下一个区域的 3–6 个条目（按"1× 可见度 × 该区当前覆盖缺口"排序，DQM 给出）。
2. 用 kit 生成器写到自己的 parts 文件，调用 `kit.detail()` 自动加标注。
3. `node tools/quick.mjs --solo <slot|layer> --crop <region> --pair-draft --dpr 3 --tods golden,night`：渲染 1×/3× 的"草稿 | 成品"并排图，加 golden 与 night 两个时段，然后 Read PNG。
4. `node tools/drop.mjs`：T0（registry lint、check-style 本层）+ T1（detail-inventory --layer 看新增条目是否被计入，**打印被拒条目的原因**；zoom-coverage --layer 看本区热图；运动层跑 flicker.mjs；旋转件跑 wagon 快速版；世界层跑 saliency 快速版，要求 ≥1.4）。
5. 每完成一个区域：看一次 `cycle24.mjs --lane` 的 24 帧近景（检查细节随变形正确拉伸、0 撕裂、0 闪烁）。

**被拒条目的即时反馈**是本路线相对"最后才数"的主要吞吐收益：detail-inventory --layer 在 drop 时就告诉 DA"这 3 条因为 SSIM ≥0.95 被合并了，这 1 条 <2 px²"，DA 当场改，不必等到 R1。

### 7.3 细节梯子（停止条件）

| 梯级 | 时刻 | 条件（全部满足才算过） | 未过时 |
|---|---|---|---|
| **R-a** | H11 | 每层计入数 ≥1.5×，鹈鹕与车 ≥1.8×；zoom-coverage 鹈鹕 ≥80%、车 ≥75%；perf 安静窗口 ≥57 fps；DV：感知倍数 ≥1.5 | DQM 把欠账层的 backlog 前移；如果是 perf 不过，ARCH 与该带 owner 先修预算再继续加细节 |
| **R-b** | H16（集成冻结前） | 计入总数 ≥361（2.8×），鹈鹕与车 ≥2.3×，其余每层 ≥1.8×，fx ≥6；zoom-coverage 鹈鹕 ≥92%、车 ≥88%，没有 ≥4 连续空白；check-detail-budget 绿；flicker 0；saliency ≥1.4；DV：感知倍数 ≥2.2，7 区中 ≥6 区"更多" | 集成冻结推迟 ≤1 h 给细节补账；仍不过，就在 R1 前以"G-DETAIL 门槛通过但 D13 目标未达"进入 R1，细节补账成为修复队列首项 |
| **R-c** | R-final 前 | 计入总数 ≥452（3.5×），每层 ≥2.0×；catalogue：鹈鹕 11/11、车 14/14、海 / 陆 / 天 ≥90%、版式 6/6；zoom-coverage ≥97% / ≥95%；细节在 6 时段、事件与烘焙 SVG 中都保留；DV：感知倍数 ≥3.0，7/7 区"更多且更好"，0 条"违反风格 / 抢戏" | 细节项留在修复队列中，按每小时可回收分数与其他项竞争 |

### 7.4 细节的验证者（与制作者完全分开）

| 层级 | 验证者 | 频率 | 失败时 |
|---|---|---|---|
| 自动 T0 | detail-registry lint、check-style | 每次 drop | drop 被拒 |
| 自动 T1 | detail-inventory --layer、zoom-coverage --layer、flicker、wagon、saliency 快速版 | 每次 drop | drop 被拒并给出原因 |
| 自动 T2 | detail-inventory 全量 + detail-diff（发现"消失的条目"，即回归）、zoom-coverage 4 相位 + hero、check-detail-budget、check-scale、perf 安静窗口 | 每次 integ 前进；每 2 h | 回归路由给 owner；perf 回归二分定位到 band |
| 风格否决 | SK（值班审查） | 每 2 h | 标记"抢戏 / 违反 STYLE-C"条目，DA 必须改或删（删掉的条目不计入倍数） |
| 独立预检 | DV（每个梯级一个新实例） | R-a、R-b、R-c | 输出低于目标的区域 → DQM backlog |
| 轮次 | 2 名 J-detail + D13 J-lens ×3 + 5 名 J-blind 不损美术成对 + ≥9 分时的 J-adv | R1、快照轮（受影响时）、R-final | 按 score.mjs 计分 |

### 7.5 细节与性能、美术的纪律（C13.6、C7.7、G9）

- **骑者带**只放必须随动的细节，预算：骑者带 ≤1100 个节点（含细节），每帧只写 slot transform（颈部 d 除外）。DA-head 与 DA-plume 的细节作为 slot 子元素，随 transform 走，不逐帧改 d。喉囊纹理作为 pouch slot 的子元素随 sy 拉伸。
- **静态带**：merge-static 做条目内按墨合并；网点只放在静态或慢速层（STYLE-C §2.3），用静态 `<pattern>` 或预生成的点路径；重复元素（窗、护栏柱、浮标）用 `<use>`。
- **深度分级**：check-detail-budget 统计每个带的边界密度，要求远 < 中 < 近的 60%（前景除外，C13.6 的 10 分项）。DA-land 与 DA-sea 在 L-world-zones 中按深度领取"密度配额"。
- **不损美术**：SK 的否决权 + saliency 自动门槛 + 快照轮中的四区域成对盲评。任何让骑者显著性 <1.4 的合并都被拒。
- **gzip 分层账**：check-detail-budget 按 data-detail 层拆分 gzip 增量，写入 budgets.json（C13.6 的 10 分项）。

---

## 8. 阶段与甘特图（小时，自开工起）

```
H   0    2    4    6    8    10   12   14   16   18   20   22   24   26   28   30   32   34   36
A   [A1][A3]                                              ARCH→集成值班 / 性能 ─────────────────
    [ A2 ]                                                DIR→D 车道
T   [T0 框架 + shotd][T0 DOM 工具][R0][T1 工具……………………][转评估：EL]
F   [FB#1+#2][FB#3][RT]
D        [SK: kit+墨组][SK 风格值班 …………………………………]
         [DIR X3: 开场 / 机位 / 竖屏 / 自动导演 / 分色时刻 / 彩蛋 ……]
R      [ RIG-L ][RIG-F][ RIG-A ………… ]
                [ FX ……………………………… ]
P       [P1][ PB 形体 ][P4][E2]
         [ PL 脚→翼 ………… ]
P2                [ DA-head ……………………… ]
                       [ DA-plume ………………………… ]
B       [ BK 形体 + 机械 ][ DA-drive ……… ]
               [ DA-bikehw ………… ][ DA-cargo …… ]
W       [SEA][ DA-sea ][ DA-sky ……… ]
        [LAND][SKY][ DA-land …………… ][DA-print…]
X       [ UI ………………………… ][AUD][ PKG ……………… ]
         [BAKE 占位][SPEC mini+X光][BAKE 真实美术]
M            merge train 持续 ─────────────────────────────►│
梯级                      R-a(H11)        R-b(H16)
I                                               [I1 冻结 + 稳定]
R                                                        [   R1   ][G16#1]
修                                                                  [滚动修复 + 快照 R2 @H27][R3 @H30.5]
终                                                                                    [ R-final ][发布]
```

| 阶段 | 时段 | 墙钟上限 | 出口条件 |
|---|---|---|---|
| A 冻结 | H0–H4 | 4.5 h | 契约 v1 通过 check-contract；骨架 G8 通过；**性能金丝雀 ≥55 fps**（否则 ARCH 继续改架构，其他车道只做纯 node 或文档工作，最长再等 2 h；仍不过就降级：细节只放静态带并预光栅缓存，按 G17 的规则 ≤4 个缓存） |
| T0 工具 + R0 | H0–H8 | 8.5 h | tool-validity 全绿；基线复核并锁定；N/A 判定；发布探针；RT 的缺陷入库 |
| 构建（流水线） | H2.5–H17 | 15 h | 各车道 DoD（§9.1）；R-b 细节梯级 |
| 集成冻结 + 稳定 | H17–H19 | 2.5 h | T2 全量绿；G1–G5、G9–G12、G17 的脚本部分全绿；烘焙与 webm 产出 |
| R1 | H19–H23 | 4.5 h | scorecard R1；G16 第一次检查点发出（不阻塞修复） |
| 滚动修复 + 快照 | H23–H31 | 9 h（至多 3 个快照） | 影子评分达到 R-final 入场条件，或 3 个快照用完，或停滞 |
| R-final | H31–H35.5 | 5 h | 唯一可报告的分数；G16 第二次检查点 |
| 发布 | H35.5–H36.5 | 1 h | PR、Artifact、交接说明 |

**典型 34–36 h；乐观 30 h**（R2 快照就达到入场条件）；**悲观 40 h**（性能金丝雀要降级，加上 3 个快照）。

---

## 9. 循环与停止条件（绑定 rubric 分数）

### 9.1 车道 DoD（每个 owner 的出口）

owner 的"完成"= 以下全部成立，由 drop.mjs 的报告与 merge train 的 T2 结果机械判定：
1. owner 名下所有 criterion 的**脚本类原子条目**（items.json 中 method 为 script 的条目，由 score.mjs --items-only 计算）达到 8 分档条目全部通过，并且至少有 1 个 10 分档条目通过。
2. 所有相关门槛的脚本部分绿。
3. 细节配额达到当前梯级。
4. 车道内自检：至少 3 次视觉迭代的记录（ledger 中的 quick.mjs 调用与 PNG 路径）。
5. 对感知核心相关的 owner（PB、PL、RIG-L、RIG-A、DIR、SK、DA-head、DA-plume）另加一次**影子评审**：1 名新鲜 J-lens 只看该 criterion 的 items 与证据包，结果只用于决定是否继续迭代，不计分。影子分 ≥8.5 才算完成；否则继续迭代，每个 owner 最多 2 次影子评审，之后交给修复队列。

### 9.2 形体锁（关键路径的质量闸）

P4：3 名 J-blind（非计分，与 R1 的评审互不重叠）看 256 px notext hero、128 px 剪影、遮头剪影与 nopouch 诱饵。G7 的正式阈值是 5 人中 ≥4 人；快测只有 3 人，所以要求更严：**3/3 首先说出"鹈鹕"**，遮头剪影 ≥2/3 选"鹈鹕或身体厚重的水鸟"，并且诱饵图上说"鹈鹕"的人数少于正式图（区分度 ≥0.4 的趋势）。不过时，PB 用 ≤1.5 h 修剪影；P2 车道的 DA-plume 延后开工，DA-head 可以继续头部区域的细节。

### 9.3 滚动修复队列（R1 之后，代替"修复轮屏障"）

- `tools/predict.mjs`（EL）读最新 scorecard + 所有 T2 结果 + 影子评审，输出每个 criterion 的"**每小时可回收分数**"：
  `gain_c = W_d · (w_c/Σw_d) / 10 · (target_c − s_c) + 门槛上限惩罚的解除 + 感知核心乘数 H 的边际效应`，
  `cost_c` = owner 估计的时长（取历史 drop 的中位时长 × 条目数），`priority = gain_c / cost_c`。
  门槛失败永远排在最前（它的 gain 包含总分上限的解除）。
- 每个 owner 同时至多持有 2 个修复项。车道 workflow 在循环里取 `docs/team/queue/<owner>.json` 的下一项。修复经 drop → merge train → T2 受影响子集 → **定向影子评审**（只评该 criterion 的受影响条目，1 名新鲜评审）。
- **快照轮**（R2、R3，至多再加 R4）：当队列中已合并的修复累计的预测增益 ≥1.5 分，或距上一快照 ≥4 h 时，冻结一个 integ 提交，跑全部门槛脚本 + VR + **受影响维度**的感知测试（新鲜评审），完全按 rubric §7.7 R2…R4 的定义。快照评审期间修复车道**不停工**：新修复继续进入下一快照。这就是"流水线代替屏障"。
- **停滞升级**：同一 criterion 连续 2 次修复后影子分提升 <0.5 时，开一个**挑战者**：新代理、独立 worktree，限时 2 h，从 owner 的最新版本出发，只改该 criterion 涉及的部分；由 2 名新鲜评审成对盲比，胜者合并。
- **R-final 入场条件**（影子评分，全部满足）：全部门槛的脚本部分绿，G-DETAIL 的 R-c 梯级通过；每维度影子分 ≥9.3；影子 T_final ≥93；感知核心每项 ≥8.5；没有 criterion <7.5。满足就进 R-final；3 个快照后仍不满足，或两快照之间 ΔT_final <0.3（停滞），也进 R-final 并如实报告差距。
- **G16**：R1 后把联系表、webm、Artifact 链接与细节对照图发给用户（中文）。用户回复不阻塞修复，但用户的前 3 条意见一到就以最高优先级进入队列（gain 按"阻止达标声明"计）。R-final 之后第二次检查点；用户未回复时只能写"同模型自评达标，待用户确认"。

### 9.4 R-final 协议要点

全新评审（从未参与任何轮次、任何影子评审与 DV）；MR-field、G-DETAIL、60 分钟 soak（在评审跑的同时独占运行，评审只读 PNG，不需要 Chromium）、野卡包与密封留出集、每个 J-lens 10 分钟自由找缺陷、所有 ≥9 分项的对抗复核；scorecard 首行为同模型自评标注。

---

## 10. 新工具清单（按级别，含 owner 与完成时刻）

**吞吐基础设施（本路线特有，T0 之前或同时）**

| 工具 | owner | 完成 | 作用 |
|---|---|---|---|
| `tools/lib/shotd.mjs` + `lock.mjs` + `governor.mjs` | TS-perf（governor 归 Lead） | H1.5 | 常驻渲染池、CPU 锁、调速 |
| `tools/lib/gatecache.mjs` + `gatemap.json` | TS-perf | H3 | 按树哈希缓存门槛结果；改动文件 → 门槛映射 |
| `tools/{lane,drop,merge-train,ownership}.mjs` | Lead | H2.5 | worktree、提交入口、持续集成、所有权审计 |
| `tools/quick.mjs` | TS-perf | H3 | solo 部件 + 区域裁图 + 草稿对照 + 多时段，≤20 s |
| `tools/cycle24.mjs` | TS-perf | H4 | RS-cycle24 的快速版（真时间 24 帧，close，DPR 1）+ 骨架叠加 |
| `tools/predict.mjs` | EL（TS-judge 协助） | H19 | 影子评分、每小时可回收分数队列 |
| `tools/detail-dashboard.mjs` | DQM | H5 | 燃尽图（每层对梯级） |
| `tools/detail-diff.mjs` | TS-detail | H8 | 两个提交之间的细节条目增删 |
| `tools/flicker.mjs` | TS-perf | H8 | 相邻帧高频能量：细线与网点在平移时的闪烁 / 摩尔纹 |
| `tools/check-timing.mjs` | TS-motion | H10 | 实测事件曲线对 timing.md 的关键帧 |
| `vr.mjs --locality` | TS-motion | H8 | 差异必须落在改动 owner 的 ID-map 区域内 |

**T0（R0 前，H0–H6.5）**：check-anchors · check-benchmark · check-rig（扩展）· check-baked（含 --static）· check-style · check-purity · detail-inventory · zoom-coverage · perf · live-parity · first-look · ux-matrix · a11y · keys（按键驱动器）· flash-check · determinism · score · coverage · tool-validity · judge/pack · judge/harness · judge/canary · verify。

**T1（R1 前，与美术并行，H6–H16）**：check-occlusion · check-contacts · contact-probe · check-bike · check-kinematics · check-noslip · wagon · check-anatomy · check-scale · check-detail-budget · check-text · cjk-glyph · thumb · silhouette · motion-audit · filmstrip（--dense，即 24 帧周期表与密集帧）· onion · check-temporal · mutate-rig · soak（性能长跑）· robust · contexts · audit-dist · xb-audit · vr（视觉 diff）· loop-seam · interact · contrast · i18n-lint · audio-check · export-check · check-inspect · check-contract · check-docs · verify-claims · readme-lint · field · judge/{palette, saliency, seams, edges, acting, controls, detail-pairs, wild, audio-offline, package} · blind-lint。

**T2（只为 10 分额外项）**：xb-webkit · judge/film · judge/eggs · soak 60 分钟模式 · 有声 webm（WebCodecs）。

工具匠的排序原则：先建阻塞 R0 与 drop 的工具（T0 与吞吐基础设施），再按"它守护的门槛的封顶严重度 × 被触发的频率"排 T1。wagon、check-occlusion、check-anatomy 排在 T1 最前面，因为细节美术每次 drop 都要用。

---

## 11. 覆盖矩阵（每个 criterion → 产出者 → 验证者 → 证据 → 门槛）

验证者一栏的层级见 §5（T0–T3 为自动门槛，评审为 T4）。每个 criterion 都至少有 1 个自动验证者与 1 个产出者；纯判定类的也有自动产出的证据包。`tools/coverage.mjs` 读取本表的机器版 `docs/team/coverage.json`，任何无主 criterion 即 G14 失败。

### 11.1 criterion（79 项）

| criterion | 产出者 | 自动验证者（门槛级） | 评审验证者 | 证据 | 门槛 |
|---|---|---|---|---|---|
| C1.1 | RIG-L（解析接触）+ BK（车锚点）+ PL（足/腕锚点） | T1 check-anchors 12 相位 → T2 check-anchors 全网格 + 锚点审计 + check-benchmark | 3 J-blind CANON-14 清单（notext + canary） | docs/eval/canon.json, anchor-audit.json, mutants-art.json | G2, G3 |
| C1.2 | ARCH（slot/band 次序）+ PL（远侧平涂 B/N）+ BK（远曲柄） | T1 check-occlusion 12 相位（?idmap=1）→ T2 72 相位 | 2 J-adv + 1 J-valid（BB/远足裁图） | docs/eval/occlusion.json, shots/eval/idmap/ | G2 |
| C1.3 | PB（剪影与喉囊）+ SK（明度对比） | T2 thumb.mjs + silhouette.mjs；H9 形体锁前的早期物种快测 | 5 J-blind（开放式识别、诱饵、遮头剪影、CVD） | docs/eval/thumb.json, shots/eval/thumb/ | G7 |
| C2.1 | BK | T1 check-bike（管端到轴 ≤0.5 u） | D2 J-lens ×3 + 1 名开放式机械找错 | docs/eval/bike.json, shots/eval/mech/frame-* | G2 |
| C2.2 | BK + ARCH（spider slot、整数链节几何） | T1 check-bike --drivetrain（齿数、包绕、层序、链节=100） | D2 J-lens 代码审查 + 传动 4 px/u 裁图 | docs/eval/drivetrain.json | — |
| C2.3 | RIG-L（轮/曲柄）+ LAND（瓦片视差） | T1 check-kinematics；T2 check-noslip（像素） | —（纯脚本） | docs/eval/kinematics.json, noslip.json | G4 |
| C2.4 | BK + DA-drive（周期细节淡出） | T2 wagon.mjs（像素角向互相关，20–110 rpm） | 1 名逐帧方向评审 | docs/eval/alias.json, shots/eval/wagon/ | G4 |
| C2.5 | BK + DA-drive | T1 check-bike --wheels | D2 J-lens（代码 + 花鼓裁图） | docs/eval/bike.json, shots/eval/mech/hub-* | — |
| C2.6 | BK + DA-bikehw（刹车、线缆、车铃、车灯挂载） | T1 check-bike --cockpit（挂载点落在管上） | D2 J-lens（座舱裁图） | docs/eval/bike.json, shots/eval/mech/cockpit-* | — |
| C2.7 | BK + DA-bikehw + DA-drive + DA-cargo | T2 shoot --set crops（4 px/u） | 1 名盲评自行车技师（先开放式清点）+ D2 J-lens | docs/eval/mech-assembly.json, judges/mech-detail-* | G-DETAIL（间接） |
| C3.1 | RIG-L + PL（足底轮廓）+ BK + LAND（前景不遮接触区） | T1 check-contacts；T2 contact-probe（像素间隙） | 1 名找缝评审 | docs/eval/contacts.json | G3 |
| C3.2 | RIG-L（腹—座）+ PB（腹部轮廓）+ BK（座形） | T0 check-rig --seat；T2 腹座背景像素检测 | D3 J-lens（座组裁图） | docs/eval/seat.json | G3 |
| C3.3 | RIG-L | T0 check-rig --biomech（KOPS、座管角、膝角范围） | D3 J-lens（biomech 联系表） | docs/eval/biomech.json | — |
| C3.4 | RIG-A | T1 motion-audit --events（跳车 riderY(t) 对物理参考） | 跳车 / 滑行密集帧找缺陷评审 | docs/eval/dynamics.json, shots/eval/dense/hop-* | — |
| C4.1 | PB + DA-head + DA-plume | T2 thumb.mjs（head3x）；H9 早期物种快测 | 3 J-blind 物种识别 + 解剖评审逐项 FM-10 | docs/eval/species.json | G7 |
| C4.2 | PB + DA-head（喙脊、钩、喉囊纹理） | T1 check-anatomy --head（喉囊存在率、喉囊—喙 ΔL*≥8） | D4 J-lens（头部 3× 裁图） | docs/eval/anatomy-head.json | G7 |
| C4.3 | PB（neckD）+ RIG-F（头部稳定、视线） | T1 motion-audit --head（稳定比） | D4 J-lens | docs/eval/anatomy-neck.json | — |
| C4.4 | PL + DA-plume（初级飞羽羽扇） | T0 check-rig（握把）；T1 check-anatomy --wing（≥4 枚分开的羽尖） | D4 J-lens（wing3x） | docs/eval/anatomy-wing.json | G7 |
| C4.5 | PL（全蹼足、跗跖） | T0 check-rig；T1 check-anatomy --legs（4 趾、蹼） | D4 J-lens（foot3x） | docs/eval/anatomy-legs.json | G7 |
| C4.6 | DA-plume（data-tract）+ SK（墨组） | T1 check-style --colour（相对色彩约束，6 时段） | D4 J-lens（plumage 裁图） | docs/eval/anatomy-colour.json | — |
| C4.7 | PB + PL（比例）+ ARCH（骨架常数） | T1 check-anatomy --scale | —（纯脚本） | docs/eval/anatomy-scale.json | — |
| C5.1 | RIG-L | T1 motion-audit（骨盆 y、躯干俯仰对曲柄角）+ filmstrip cycle24 | 3 J-blind 按速度排序 | docs/eval/motion-audit.json, shots/eval/filmstrip/cycle-* | G10 |
| C5.2 | RIG-L（secondary.js）+ RIG-A | T1 motion-audit --lag（冠、喉囊、尾、头相对父级滞后）+ onion.mjs | 密集帧找缺陷评审 + D5 J-lens | docs/eval/motion-audit.json, shots/eval/onion/ | G10 |
| C5.3 | RIG-A（事件叠加与打断） | T1 motion-audit --fuzz 300 日程 | D5 J-lens（arcs 轨迹图） | docs/eval/fuzz.json | G10 |
| C5.4 | DIR（timing.md X-sheet）+ RIG-A | T1 check-timing（实测事件曲线对 timing.md 的关键帧） | 盲评从 nofx 密集帧命名事件 + A/B | docs/timing.md, docs/eval/events.json | — |
| C5.5 | RIG-F（瞬膜眨眼、头部急动）+ RIG-A | T1 motion-audit --face 120 s | D5 J-lens + 代码审查 | docs/eval/avian-motion.json, shots/eval/blink-strip.png | — |
| C5.6 | RIG-A + FX（smear） | T1 motion-audit --transitions | D5 J-lens（smear 密集帧） | docs/eval/transitions.json | — |
| C6.1 | DIR（character.md）+ PB（面部）+ RIG-F | T2 judge/acting.mjs（表情表、反应三联图打包） | 3 J-blind 15 选 3 形容词 + D6 J-lens | docs/character.md, judges/character-* | — |
| C6.2 | RIG-F + PB（眼、眼睑） | T1 motion-audit --face（视线目标、扫视时值） | D6 J-lens（acting 包） | docs/eval/face.json, shots/eval/expressions.png | — |
| C6.3 | RIG-A + DIR + FX | T2 check-temporal（每个笑点的可读窗口） | 5 J-blind（nofx 密集帧描述 + 4 选 1） | judges/gags-*, docs/eval/temporal.json | — |
| C6.4 | RIG-A（进食序列）+ PB（喉囊隆起、颈部隆起）+ DA-cargo（鱼） | T1 motion-audit --gulp（隆起沿颈下行） | D6 J-lens（gulp 条带） | docs/eval/gulp.json | — |
| C6.5 | DIR（beats.md、自动导演） | T2 loop-seam + interact --idle 90 s | 1 名盲评复述 16 帧故事条带 + 强制选择 | docs/beats.md, docs/eval/idle.json, shots/eval/story16.png | — |
| C6.6 | FX（鸥群）+ DA-cargo（鱼）+ DIR（编队彩蛋） | T2 sheet.mjs 配角条带 | D6 J-lens + 代码审查 | shots/eval/gulls/ | — |
| C7.1 | DIR（开场）+ DA-print（标题卡）+ ARCH（首帧 ≤400 ms） | T2 first-look.mjs（RS-first，4× CPU 节流） | 5 J-blind 开场强制选择 | docs/eval/first-look.json, shots/eval/intro-21.png | G8 |
| C7.2 | SK（墨组、kit、风格审查） | T1 check-style（每个可见面都是七墨之一）+ judge/palette | D7 J-lens（grid-30 + wild） | docs/eval/palette.json | — |
| C7.3 | SK + SKY + SEA + LAND + FX（车灯光束） | T2 judge/saliency（6 时段骑者显著性） | D7 J-lens（tods 包） | docs/eval/saliency.json | — |
| C7.4 | DIR（机位、地平线、竖屏专用机位） | T2 judge/film（电影 45 帧联系表） | 3 名电影联系表强制选择 | docs/eval/camera.json, shots/eval/film-45.png | G8 |
| C7.5 | 全部美术 owner + DA-* | T2 judge/seams + judge/edges（接缝、边缘、切线） | 2 J-adv + 1 J-valid（3× 裁图） | docs/eval/zoom-defects.json, seams-edges.json | — |
| C7.6 | SK（STYLE-C 五项角色修正的把关）+ PB + PL | T1 check-style（网点位置、远侧平涂、渐变量化） | 5 J-blind 同风格成对 + 限色印刷判定 | docs/eval/style.json, judges/style-* | — |
| C7.7 | SK + DIR（克制否决权） | T2 judge/saliency（骑者显著性 ≥1.4） | 5 J-blind 3 选 1 +"你会删掉什么" | docs/eval/appeal.json, docs/composition.md | — |
| C8.1 | DIR（"分色"时刻编排）+ ARCH（band 分离机制）+ SK | T2 ?moment= 确定性渲染 + eggs.mjs | 3 J-blind 开放式回忆 | README.md#signature, docs/eval/moment.json | D8 特别上限 |
| C8.2 | 全队（R1 版本）；FB 产出匹配投入基线 | T2 field.mjs（分层分格式打包） | 5 J-blind × ≥40 配对 | docs/eval/field.json | — |
| C8.3 | DIR（src/director/eggs.js） | T2 judge/eggs（彩蛋清单对照） | 1 名只看截图的探索者（harness） | docs/eggs.json, docs/eval/explorer.json | — |
| C8.4 | AUD | T1 audio-check；T2 audio-offline（30 s，频谱图） | D8 J-lens；9–10 分需用户（G16） | docs/eval/audio.json, shots/eval/spectrogram.png | G11, G16 |
| C9.1 | UI + DIR（首次提示） | T2 ux-matrix | 2 名冷启动测试者（桌面 / 390 px 触屏，harness） | docs/eval/cold-start-*.json | — |
| C9.2 | UI | T2 ux-matrix + contrast + judge/controls | D9 J-lens | docs/eval/ux-matrix.json, contrast.json | — |
| C9.3 | UI + RIG-A（角色化反应） | T2 interact.mjs（按键驱动 → 反应三联图） | D9 J-lens | docs/eval/interact.json | — |
| C9.4 | UI（keymap.js 唯一事实源） | T1 keys.mjs（焦点、修饰键、IME、repeat 守卫） | D9 J-lens 代码审查 | docs/eval/keys.json | G12 |
| C9.5 | UI + ARCH（role=img 包装、各带 aria-hidden） | T1 a11y.mjs（axe 10 状态 + ariaSnapshot 对照 golden） | 1 名 a11y 评审读 ariaSnapshot | docs/eval/a11y.json, docs/a11y/aria.golden.yml | G12 |
| C9.6 | UI + ARCH（reduced-motion 实时监听）+ FX | T1 flash-check + reduced-motion 截图对比 | —（纯脚本） | docs/eval/flash.json, reduced-motion.json | G11 |
| C9.7 | DIR（竖屏与面板机位）+ UI（底部抽屉） | T1 ux-matrix --mobile（骑者 bbox 边距 ≥3%） | D9 J-lens（mobile 包） | docs/eval/mobile.json | G8 |
| C9.8 | UI（i18n.js）+ DA-print（画内文字） | T0 i18n-lint；T1 cjk-glyph + check-text | 1 名双语文案评审 | docs/eval/i18n.json, in-art-text.json | G12 |
| C10.1 | ARCH（性能架构师） | T2 perf.mjs（trace，CPU 独占锁，3×20 s 中位） | D10 J-lens 审阅 | perf/perf.json | G9 |
| C10.2 | ARCH + 所有 band owner | T2 perf --paint（合成面积比 ≤3.0）+ lint | D10 J-lens 代码审查 | perf/paint.json | G9 |
| C10.3 | ARCH + 所有 update() owner | T2 perf --js（分配采样） | — | perf/js.json | — |
| C10.4 | ARCH | T3 soak.mjs 12 min（R-final 60 min + 时间扭曲） | — | perf/soak.json | G10 |
| C10.5 | ARCH（build、merge-static） | T0 audit-dist（体积、外部引用） | — | perf/dist-audit.json, budgets.json | G1 |
| C10.6 | ARCH | T2 xb-audit；T3 xb-webkit（R0 探针决定是否 N/A） | — | docs/eval/xb.json | — |
| C10.7 | ARCH（暂停停 rAF、visibilitychange） | T2 robust + contexts | — | docs/eval/robust.json, contexts.json | — |
| C10.8 | ARCH | T1 共用 console 收集器 + T2 故障注入（?inject=） | — | docs/eval/console.json, fault-injection.json | G1 |
| C11.1 | BAKE + SPEC（pelican-mini.svg） | T2 check-baked（含 --static）+ perf（img 模式） | 3 J-blind 对烘焙 6 帧答 CANON-14 + 海报淘汰赛 | docs/eval/baked.json, baked-static.json, mini.json | G5 |
| C11.2 | BAKE | T2 check-baked 48 相位 + loop-seam | — | docs/eval/baked.json, shots/eval/baked-parity.png | G5 |
| C11.3 | PKG（webm、海报、联系表） | T2 judge/package（帧数 = 时长×60、无重复帧） | D11 J-lens | dist/poster.png, contact-sheet.png, preview.webm, docs/eval/package.json | G13 |
| C11.4 | UI（下载回退）+ BAKE（bakeSVG 异步） | T2 export-check + contexts（沙箱 iframe） | — | docs/eval/export.json, publish-probe.json | G13 |
| C11.5 | PKG + Lead（PR、Artifact） | T0 check-docs（链接、字体许可） | D11 J-lens | README.md, docs/handoff.md, docs/eval/publish.json | G13, G15 |
| C12.1 | ARCH | T0 check-contract（contract.js 与 CONTRACT.md、owners.json 一致） | D12 J-lens 代码审查 | docs/eval/contract.json, docs/architecture.svg | — |
| C12.2 | RIG-L / RIG-F / RIG-A（node --test 属性测试） | T0 check-rig；T1 mutate-rig（TS-motion，变异必须被杀死） | — | docs/eval/rig.json, mutants.json | G3, G10 |
| C12.3 | ARCH | T1 determinism（a–f）+ vr.mjs（区域局部性 diff） | — | docs/eval/determinism.json, test/golden/MANIFEST.json | G10 |
| C12.4 | ARCH + TS-judge（verify.mjs） | T3 全新克隆 npm ci && npm run verify + 双构建 sha256 | — | docs/eval/verify.txt, dist/MANIFEST.json | G14 |
| C12.5 | PKG（claims.json） | T0 verify-claims + readme-lint | D12 J-lens 人工声明审计 | docs/claims.json, docs/eval/claims.json | G6 |
| C12.6 | SPEC（X 光检查模式） | T2 check-inspect | D12 J-lens（live-test） | docs/eval/inspect.json | — |
| C12.7 | Lead（merge train、ledger、owners.json） | T0 ownership.mjs 每次合并；T3 coverage.mjs + 隔离审计 | 2 名独立 D12 评审（报告一致性） | docs/team/ledger.json, coverage.json, docs/eval/ownership.json | G14 |
| C12.8 | TS-geo（check-benchmark）+ RT（红队缺陷画廊） | T1 check-benchmark 对 RT 的 ≥10 个美术缺陷与 CANON mutant 全部标红 | D12 J-lens 代码审查 | docs/eval/benchmark.json, redteam-defects.json | G2 |
| C13.1 | DQM（总账）+ 全部 DA + 形体 owner | T1 detail-inventory --layer（每次 drop）→ T2 全量（每次合并） | 2 J-detail（盲清点 + 7 区并排）；预检 DV | docs/eval/detail-inventory.json, judges/detail-* | G-DETAIL |
| C13.2 | DA-plume + DA-head + PL（足部细节） | T1 zoom-coverage --layer pelican（4 相位 + hero） | J-detail 鹈鹕组 + D13 J-lens 对照 catalogue.pelican | docs/eval/zoom-coverage.json, judges/detail-pelican-* | G-DETAIL |
| C13.3 | DA-bikehw + DA-drive + DA-cargo | T1 zoom-coverage --layer bike + wagon（周期细节） | J-detail 自行车组（5 组 4× 裁图，golden + night） | docs/eval/zoom-coverage.json, judges/detail-bike-* | G-DETAIL |
| C13.4 | DA-sea + DA-land + DA-sky（+ SEA/LAND/SKY 形体） | T1 detail-inventory --layer；T2 check-scale + judge/saliency | J-detail 世界组（3 组 1×/3×） | docs/eval/detail-inventory.json, scale.json, judges/detail-world-* | G-DETAIL |
| C13.5 | DA-print | T1 check-text + detail-inventory --layer typography_frame；T2 first-look（标题卡缩小与遮挡） | D13 J-lens（边框、印章、注记 3× 裁图） | docs/eval/in-art-text.json, shots/eval/detail/type-* | G-DETAIL |
| C13.6 | ARCH（merge-static）+ SK（层级）+ DQM（预算） | T1 check-detail-budget + flicker.mjs；T2 perf 全细节 + saliency 深度衰减 | 5 J-blind 四区域不损美术成对 | docs/eval/detail-budget.json, judges/detail-regress-* | G9, G-DETAIL |

### 11.2 硬门槛（18 项）

| 门槛 | 产出者 | 自动验证者 | 评审验证者 | 证据 |
|---|---|---|---|---|
| G1 | ARCH（build、自包含） | T0 build + audit-dist；T1 console 收集器 | — | docs/eval/console.json, perf/dist-audit.json |
| G2 | RIG-L + BK + PL + PB | T1 check-benchmark（RS-cycle24） | 3 J-blind CANON-14（hero notext + 烘焙 t=0）+ J-valid | docs/eval/canon.json, benchmark.json |
| G3 | RIG-L + PL + BK | T0 check-rig --seat --events；T1 check-anchors + check-contacts | — | docs/eval/rig.json, anchor-audit.json, seat.json, contacts.json |
| G4 | RIG-L + BK + DA-drive + BAKE | T1 check-kinematics；T2 wagon + check-baked | 逐帧方向评审 | docs/eval/alias.json, kinematics.json |
| G5 | BAKE + SPEC | T2 check-baked --static + loop-seam | — | docs/eval/baked.json, baked-static.json, mini.json |
| G6 | PKG | T0 verify-claims + readme-lint | 人工声明审计（D12 J-lens） | docs/claims.json, docs/eval/claims.json |
| G7 | PB + DA-head + PL + DA-plume | T1 check-anatomy（喉囊 100% 存在） | 5 J-blind（notext、诱饵、遮头、128 px 剪影） | docs/eval/thumb.json, species.json |
| G8 | DIR（机位、竖屏）+ UI | T1 ux-matrix --mobile + first-look | — | docs/eval/mobile.json, first-look.json |
| G9 | ARCH | T2 perf.mjs（独占锁）+ live-parity | — | perf/perf.json, docs/eval/live-parity.json |
| G10 | RIG-* + ARCH | T1 motion-audit --fuzz + determinism；T3 soak | — | docs/eval/fuzz.json, perf/soak.json, determinism.json |
| G11 | UI + ARCH + AUD + FX | T1 flash-check + audio-check + keys + reduced-motion | — | docs/eval/flash.json, reduced-motion.json, audio.json |
| G12 | UI + ARCH | T1 a11y + i18n-lint + cjk-glyph + keys | a11y 评审 | docs/eval/a11y.json, i18n.json, keys.json |
| G13 | PKG + BAKE + Lead | T2 judge/package + export-check + Artifact 回读 diff | — | docs/eval/package.json, export.json, publish.json |
| G14 | Lead + TS-judge + EL | T3 全新克隆 verify + tool-validity + coverage + ownership + isolation | — | docs/eval/verify.txt, tool-validity.json, docs/team/coverage.json |
| G15 | PKG + DA-print（字体许可） | T0 check-docs + git ls-files 第三方 SVG 检查 | D11 J-lens 文案审查 | README.md, docs/THIRD_PARTY.md, LICENSE |
| G17 | ARCH | T0 check-purity（bundle 光栅 MIME）；T2 ?nocache=1 对照 | — | docs/eval/purity.json |
| G-DETAIL | DQM + 全部 DA + 形体 owner | T1 detail-inventory + zoom-coverage（每次 drop）；T2 perf 全细节 | 2 J-detail + DV 预检 | docs/eval/detail-inventory.json, zoom-coverage.json, judges/detail-* |
| G16 | Lead（用户联络） | — | 用户本人（唯一真人评审） | docs/eval/user-checkpoint.json |


---

## 12. Workflow 脚本提纲

### 12.1 `docs/team/wf-lane.v1.js`（参数化车道，最核心）

```js
export const meta = {
  name: 'pelican-lane',
  description: 'One build lane: two owners in one git worktree, drop-based pipeline, lane DoD and detail rungs',
  phases: [
    { title: 'Start', detail: 'owners start from their lock points' },
    { title: 'Iterate', detail: 'drop loop: self-check, T0/T1 gates, merge train' },
    { title: 'Shadow', detail: 'fresh shadow judges on perceptual-core owners' },
    { title: 'Queue', detail: 'post-R1 rolling fix queue' },
  ],
}
const ROOT = '/home/user/experiments-and-tests/pelican-bicycle'
const LANE = args.lane                          // 'P' | 'P2' | 'R' | 'B' | 'W' | 'X' | 'D'
const SLOTS = args.slots                        // [[ownerA, ownerA2, ...], [ownerB, ...]]  sequential per slot
const MAX_ITER = args.maxIter ?? 6              // per-owner agent sessions (the time budget, not a clock)
const REPORT = { type: 'object', properties: {
  owner: { type: 'string' }, drops: { type: 'array', items: { type: 'string' } },
  acceptance: { type: 'array', items: { type: 'object', properties: { cmd: { type: 'string' }, pass: { type: 'boolean' }, out: { type: 'string' } }, required: ['cmd', 'pass'] } },
  detailLinesAdded: { type: 'number' }, done: { type: 'boolean' },
  contractRequests: { type: 'array', items: { type: 'string' } }, knownIssues: { type: 'array', items: { type: 'string' } } },
  required: ['owner', 'acceptance', 'done'] }

async function runOwner(ownerId) {
  const role = args.roles[ownerId]              // { files, acceptance, criteria, brief, lockWaits, shadow }
  let last = null
  for (let i = 1; i <= MAX_ITER; i++) {
    phase(i === 1 ? 'Start' : 'Iterate')
    last = await agent(`${args.common}
ROLE: ${ownerId} (lane ${LANE}, iteration ${i}/${MAX_ITER}). WORKTREE: ${ROOT}/../pb-wt/${LANE}
FILES YOU OWN: ${role.files}
FIRST: node tools/governor.mjs wait; read docs/team/lanes/${LANE}.json (blockedBy, rung, merge-train failures for you) and docs/team/queue/${ownerId}.json if present.
WAIT FOR LOCKS: ${role.lockWaits.join(', ') || 'none'} (poll docs/locks/; while waiting, work on the parts that do not depend on them).
BRIEF: ${role.brief}
ACCEPTANCE (run every command, report pass/fail verbatim): ${role.acceptance.join(' ; ')}
Work in drops (node tools/drop.mjs). Stop this session after ~4 drops or when all acceptance passes.`,
      { label: `${LANE}:${ownerId}:i${i}`, phase: 'Iterate', schema: REPORT })
    if (last?.done && role.shadow) {
      phase('Shadow')
      const sh = await agent(`You are a fresh shadow judge (not scored). Score ONLY these rubric items: ${role.criteria.join(', ')} from ${ROOT}/docs/rubric/items.json, using the evidence pack built by: node tools/judge/pack.mjs --criteria ${role.criteria.join(',')} --out <tmp>. Read only that pack. Write observations first, then pass/fail per item with evidence paths. Do not edit files.`,
        { label: `${LANE}:${ownerId}:shadow${i}`, phase: 'Shadow', schema: args.itemVerdictSchema })
      // score.mjs --items-only is run by the next owner session; the shadow verdict file path goes into the lane state
      if (sh && sh.predicted >= 8.5) break
    } else if (last?.done) break
  }
  return last
}
// two slots in parallel, each slot is a sequential chain of owners (pipeline by lock points, not barriers)
const results = await parallel(SLOTS.map(chain => async () => {
  const out = []
  for (const o of chain) out.push(await runOwner(o))
  return out
}))
log(`lane ${LANE} build done: ${results.flat().filter(Boolean).map(r => `${r.owner}:${r.done ? 'done' : 'open'}`).join(' ')}`)

// post-R1: rolling fix queue (same lane, same worktree); stops when predict.mjs says the queue for this lane is empty
if (args.queueMode) {
  phase('Queue')
  for (let k = 0; k < (args.maxFixes ?? 12); k++) {
    const r = await agent(`${args.common}
ROLE: fixer for lane ${LANE}. Read docs/team/queue/*.json for owners in this lane (${SLOTS.flat().join(', ')}); take the highest-priority open item you own; fix it via drops; mark it merged with the merge-train result. If no open items remain, reply done=true without changes.`,
      { label: `${LANE}:fix:${k}`, phase: 'Queue', schema: REPORT })
    if (r?.done && r.drops?.length === 0) break
  }
}
return results
```

说明：`parallel` 的两个元素是两条**串行链**，所以同一车道内槽 1 做完 RIG-L 立刻接 RIG-F，不等槽 2。锁点等待写在提示里（轮询 docs/locks/），脚本本身没有屏障。如果运行时提供 `pipeline(items, ...stages)`，细节车道可以把"区域"作为 item，把"L1 细节 → L2 细节 → 打磨"作为 stage，让不同区域处在不同阶段。上面的串行链写法是它的等价退路。

### 12.2 `docs/team/wf-freeze.v1.js` 与 `wf-tools.v1.js`

- wf-freeze：`parallel([ARCH A1→A3 串行, DIR A2])`；结束条件：check-contract 绿 + 性能金丝雀报告 + docs/locks/L-contract-v1.json、L-horizon.json 已发布。
- wf-tools：一个工具任务队列（数组，按 §10 排序），2 个槽位各取下一项。每个工具任务的验收 = tool-validity 对该工具的 fixture / mutant / 重复性检验。H6 时插入 R0 任务（EL），之后继续 T1 队列。

### 12.3 `docs/team/wf-round.v1.js`（评审轮：证据包流水线，4 个并发实例）

```js
// args: { round: 'R1'|'R2'|'R3'|'Rfinal', group: 'A'|'B'|'C'|'D', dims: [...], affected?: [...] }
// group A = D1–D4 (机械 / 解剖，证据最早就绪：RS-phase、RS-idmap、RS-crops)
// group B = D5, D6 (动作 / 表演：RS-dense、RS-onion、RS-acting)
// group C = D7, D8, D13 (美术 / 惊艳 / 细节：RS-tod、RS-style、RS-detail、RS-field)
// group D = D9–D12 (体验 / 性能 / 交付 / 工程：以脚本为主)
phase('Evidence')      // EL: node tools/judge/pack.mjs --group ${group} (只打本组的渲染集；每个包完成就写 ready 标记)
phase('Judges')        // 对每个维度：等它的包 ready → parallel(J-lens × n, 专用盲评 …)，每名评审全新、隔离目录
phase('Validate')      // J-valid 核实低分离群与 J-adv 的缺陷；≥9 的 criterion 追加 J-adv + J-valid
phase('Score')         // node tools/score.mjs --round ${round} --group ${group}；canary 召回率 <80% 的评审作废并补人
```

4 个组各自就是一个 workflow（每个 2 个代理槽），**同时运行**。组 A 的证据最早就绪（纯 DOM 数据与裁图），它的评审在组 C 的渲染集还在生成时就开始了。一轮完整评审约 100 个评审实例，按 8 个并发槽、每个 10–15 分钟，约 2.5 h 评审时间，加上 1–1.5 h 脚本，其中一部分与评审重叠，所以一轮约 3.5–4.5 h。

### 12.4 merge train（脚本）

```
loop every 20 min or on new drop:
  for lane in lanes with new drops (priority: P, P2, R, B, W, X, D, T):
    rebase lane onto integ in tmp worktree; on conflict → route to owners, mark blocked
    run T0 all + T1 affected (gatecache); ownership.mjs; vr --locality
    green → fast-forward integ; ledger append; else → write failure to lane state
  on integ advance → background T2-light; dashboard; every 2 h → quiet-window perf
```

---

## 13. 风险登记

| # | 风险 | 概率 | 影响 | 缓解 | 触发与应对 |
|---|---|---|---|---|---|
| 1 | 3.5× 细节下 fps 达不到 55（BL-17） | 中高 | G9 → 60；C13.6 | H4 性能金丝雀；merge-static；骑者带节点预算；每 2 h 安静窗口 perf + 二分定位 | 金丝雀不过：静态带预光栅缓存（≤4 个，记录源哈希，?nocache=1 对照，G17 合规） |
| 2 | 太多车道挤爆 Chromium 池，自检变慢 | 中 | 构建者迭代次数下降 | shotd 缓存 + 调速器 + 按松弛排优先级 | 排队 >60 s 持续 30 min：暂停 X 与 D 车道新代理 |
| 3 | 锁点后接口仍要改（例如剪影锁后发现物种读不出） | 中 | 下游细节返工 | 细节挂在 slot 局部坐标上；P4 快测在 DA-plume 开工前 | 改锁点必须走契约请求，ARCH 评估下游影响后批 |
| 4 | merge train 冲突频繁 | 低中 | 集成延迟 | 严格的文件所有权 + parts 原语，冲突只可能出现在契约与 main.js | 冲突文件永远只有一个 owner，路由即可 |
| 5 | 并行细节导致风格漂移、画面变噪 | 中 | C7.2、C7.7、C13.6 | 共用 kit；SK 否决权；saliency 自动门槛；check-style 每次 drop | SK 发现漂移：冻结该 DA 的 drop，直到修正 |
| 6 | 反作弊折损超过 10% | 中 | G-DETAIL / D13 | drop 时就打印被拒原因；481 条目标留余量；R-b 与 R-c 之间补账 | DQM 在 R-b 追加 backlog |
| 7 | 影子评审与 R-final 评审偏差（同族偏宽） | 中 | R-final 低于预测 | 入场阈值 9.3 / 93；影子评审也混入 canary；影子评审人与轮次评审人不重叠 | R-final 仍未达标：如实报告差距，不挑更早的高分 |
| 8 | 工具匠抢走构建者墙钟 | 低 | 违反 §7.9 的 ≥40% 规则 | 工具匠是独立角色、独立车道；ledger 统计构建者的美术迭代时长 | ledger 显示 <40%：推迟 T1 的非关键工具 |
| 9 | webm 管线不可行（BL-31） | 低中 | G13 | PKG 在 H14 前做 3 s 样片 | 备选：WebCodecs 页内编码 |
| 10 | 用户在 G16 提出结构性意见（例如"鹈鹕太卡通"） | 低中 | 关键路径返工 | R1 后立刻发 G16，修复队列并行；DIR 的角色圣经在 A2 就附一张角色草图，给用户早看一眼（可选，不阻塞） | 用户意见以最高优先级入队；必要时对 PB 开挑战者 |
| 11 | 车道 workflow 中断（容器重启） | 低 | 进度丢失 | 状态全部落盘（lanes/*.json、queue、ledger）；每次 drop 都是提交 | 以 args.resume 续跑 |
| 12 | 评审隔离被破坏（评审读到 docs/eval 或源码） | 低 | 该评审作废 | 证据包复制到随机临时目录；harness 只给截图与输入；ledger 记录读取 | isolation 审计发现越界：换人重评 |

---

## 14. 与 v0 的差异，以及值得从其他路线嫁接的点

**相对 wf-build.v0.js 修正的问题**（BL-21 等）：v0 是"11 个构建者并行 → 1 个集成 → 6 个评审 → 修复 → 退出"。这是 3 道屏障，集成发生在最后；并行构建者对着共享树跑 shoot；第 2 轮修复后不再重评；评审打没有锚点的 1–10 分；没有 ledger。本方案改为：车道 worktree + merge train 持续集成；门槛分级 + 缓存；items.json 原子条目 + score.mjs 机械聚合；滚动修复 + 快照轮；最终分数一定来自最后一次修复之后的 R-final。

**可以从其他两份方案嫁接**（不改变本路线的骨架）：
- 纵深专家路线的 **parts / captain 原语**：本方案 §6.3 的 parts 与之同构，可以直接统一。它的鹈鹕细分（头、喙、喉囊、冠分别由不同专家负责）可以在 P2 车道放不下时作为第三条鹈鹕车道。
- 锦标赛路线的**局部锦标赛**：只用在停滞升级（§9.3 的挑战者）与标志性时刻（C8.1 权重 3，且有 D8 特别上限），在 D 车道开 2 个概念原型、限时 2 h，由 3 名盲评选择。这不在关键路径上。

**标志性时刻的建议**（C8.1，由 DIR 编排，ARCH 提供机制）："**分色**"（ink separation）。在故事循环的一个节拍里，画面像丝网印刷的七块网版一样沿深度方向短暂分开：每个 z-band 按自己的墨色平移出套印错位，骑者穿过这组错开的"网版"，然后网版在车铃声中"咔"地重新对准。它只用合成层 transform，所以不花帧率；它是风格 C 独有的语言；在 1× 默认视图中一定会被注意到；在 X 光模式里还能看到每块网版的名称（检查模式额外项）。

---

*本文件中的所有分数、阈值预测与墙钟估计都是规划用的同模型自评预估，不是测量结果。*
