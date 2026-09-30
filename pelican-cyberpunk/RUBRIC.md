# 鹈鹕湾（Pelican Bay）总评审 Rubric

> 版本 2.0.0 · 2026-09-29 · 首席评审（v1 由 8 份镜头草稿合并；v2 吸收 2 份红队报告，并纳入用户的两项更新：选定风格 C；成品细节必须远多于草稿）。合并的镜头：E（前沿 AI 评估负责人 / 鹈鹕基准史）、ANIM（长片动画导演）、ORN（鸟类学与博物画）、mech（车架师 / 机械工程 / 踩踏生物力学）、craft（Awwwards / demoscene 评审（cold-open、signature-moment 等））、P（Web 平台与性能工程）、UX（产品设计与无障碍）、ENG（首席工程师）。

> **同模型自评（same-model self-assessment）：本 rubric 的所有分数由与构建者同一模型家族的 Claude 子代理、按本团队自己写的 rubric 打出，不是外部基准结果。任何地方引用总分或维度分都必须带上这句标注。**

**用户更新（已纳入）**：

- 用户选定风格 C（复古旅行海报，WPA / art-deco 丝网印刷）。风格圣经 docs/STYLE-C.md，参考 drafts/C-poster/（keyframe.png、closeup.png、gen.mjs），已在 styleProfiles.C.lock 中按 sha256 锁定。
- 用户原话："我需要你最终教出来的版本细节比 draft 多很多"（"教"应为"交"）。落实为硬门槛 G-DETAIL（细节清单 ≥2.5× 草稿、3× 放大覆盖、2 名评审与草稿并排比较）与新维度 D13"细节密度与工艺"（权重 10）。

> 本文件由 rubric.json 生成（node docs/rubric/gen-rubric.mjs）。rubric.json 是唯一事实源：改 rubric 请改 JSON 再重新生成，不要手改 RUBRIC.md。生成器同时写出 docs/rubric/items.json（每条锚点拆成带 id 的原子条目，评审逐条判 pass/fail，由 tools/score.mjs 机械聚合）、docs/rubric/evidence-manifest.json（每个 criterion 必须由构建流水线产出的证据文件与产出工具）和 docs/rubric/creative-brief.md（只给构建者看的创意示例，维度评审拿不到）。每个 criterion 都有 2/5/8/10 四档锚点、测量方法（[script] 自动脚本 / [judge] 指定渲染集上的视觉评审 / [code-review] 代码审查 / [live-test] 实时交互测试）以及证据文件。文中标注"phase-0"的内容是对当前脚手架的已知基线，不是目标。

**单位与约定**：u = rig 单位，1 u = 3.4 mm；场景尺度重力 g = 2885 u/s²；SVG 角度顺时针为正，TDC = 曲柄 φ=270°；骑者朝 +x，世界向 −x 滚动；viewBox 1600×900，GROUND_Y=790，RIDER_X=680；骑者 bbox 在世界中约 x 455–953、y 244–790（草稿 C 实测）。

## 目录

- [1. 10/10 北极星](#1-1010-北极星)
- [2. 达标线](#2-达标线)
- [3. 评分与聚合](#3-评分与聚合)
- [4. 维度与权重一览](#4-维度与权重一览)
- [5. 硬门槛](#5-硬门槛)
- [6. 维度详解](#6-维度详解)
- [7. 评估协议](#7-评估协议)
- [8. 定义](#8-定义)
- [9. 风格 C 档案](#9-风格-c-档案)
- [10. 细节门槛与细节目录](#10-细节门槛与细节目录)
- [11. phase-0 已知基线（预登记缺陷）](#11-phase-0-已知基线预登记缺陷)
- [12. 镜头分歧的裁决](#12-镜头分歧的裁决)
- [13. 对团队设计的反推](#13-对团队设计的反推)
- [14. Changelog / rejected findings（变更记录与未采纳的发现）](#14-changelog--rejected-findings变更记录与未采纳的发现)

## 1. 10/10 北极星

打开链接的第 0.3 秒，画面已经是一张完成的鹈鹕湾旅行海报：七种油墨、网点、纸边与细细的藏青框线，没有白闪，没有 spinner。一只一眼就是大白鹈鹕的鸟——纸白的厚实身体、S 形但粗壮的颈、桃色长喙末端一枚朱红的钩、琥珀色喉囊上几道印刷纹理、枕后一簇蓬松的白冠——稳稳坐在一辆青绿色复古城市车的弹簧皮座上。它的表情是满足的，不是凶的；翅膀是翅膀，不是套着袖子的手臂：覆羽一层层压向后方，次级飞羽像流苏垂在"臂线"下，藏青的初级飞羽从腕部向后扫，前几枚绕住握把。它的头像钉在空气里一样稳，身体却随每一次下踩沉下去；近侧全蹼足平贴踏板，远侧那条腿是平涂的深墨，被牙盘正确地挡住。链条一节一节咬进齿谷，车轮以恰好三倍曲柄转速滚过路面，辐条在速度里化成两色的模糊盘，只剩气门告诉你它往哪转。凑近看，每一处都经得起放大：覆羽的扇贝边、每一枚单独的飞羽、喉囊的纹理、喙脊与钩、车架的接头与线管、条帽与链片、座弹簧与铆钉、编织的车筐和鱼鳞；远处是有窗户和屋顶的港镇、栈桥、礁石、浮标、挂着索具的帆船、成群的鸟、路边的护栏与路牌、层层的海浪带与云带、缓慢转动的太阳光芒，以及像车票一样的印章和注记——而这些细节都安静地待在静态层里，不抢那只鸟的戏，页面依然稳在 60 fps。二十四秒的故事循环里只有几个干净的节拍，节拍之间是安静的巡航，最后一帧严丝合缝地落回第一帧。把那个零 JavaScript 的 SVG 放进同题的网格，它在同等条件下依然最好；手机竖着拿，是一张专门为竖屏构图的海报；关掉 JS，它还在骑；读屏器会用一句好中文告诉你黄昏里发生了什么。README 里的每一个数字都能用一条命令复现，每一句声明都带着证据，每一处没做到的地方都坦白写着；而最终是否"达标"，由用户本人看过之后说了算。

## 2. 达标线

达标 = 所有硬门槛通过（含 G-DETAIL 与 G16 用户检查点）且 每个维度 ≥9.0 且 最终总分 T_final ≥92/100 且 没有任何 criterion <7 且 感知核心集（target.perceptualCore，13 项人眼最先注意到的 criterion）中没有任何一项 <8。T_final = T × min(1, H/9)，H 为感知核心集的平均分：脚本类满分不能掩盖观感上的平庸。只有 R-final 轮（最后一次修复提交之后、由从未参与过的新评审完整执行本协议）的分数可以对外报告，并且必须标注为"同模型自评"（meta.selfAssessmentLabel）。"达标"的最终声明还需要 G16：用户本人看过联系表、webm 与 Artifact 后给出通过，且其列出的前 3 条意见全部解决；用户未回复时只能写"自评达标，待用户确认"。注意：维度全部 ≥9 只能保证总分 ≥90，要到 92 需要加权平均 ≥9.2。

| 条件 | 要求 |
|---|---|
| 硬门槛 | 全部通过（G1、G2、G3、G4、G5、G6、G7、G8、G9、G10、G11、G12、G13、G14、G15、G-DETAIL、G16、G17） |
| 每个维度 | ≥ 9.0 |
| 最终总分 T_final | ≥ 92 / 100（T_final = T × min(1, H/9)） |
| 单个 criterion 底线 | ≥ 7 |
| 感知核心底线 | ≥ 8：C1.3、C4.1、C5.1、C5.2、C6.1、C6.3、C7.1、C7.2、C7.6、C7.7、C8.1、C13.1、C13.2 |
| 真人检查 | G16 通过（用户意见全部解决） |
| 有效轮次 | R-final |

## 3. 评分与聚合

- **分数刻度**：每个 criterion 打 0–10 的整数分，但分数不是评审自由挑的整数，而是由 tools/score.mjs 从原子条目机械算出：生成器把每档锚点按"；"拆成带 id 的原子条目（docs/rubric/items.json，例如 C3.1-8.2），评审对每个条目判 pass / fail / n.a.，并给出证据路径与一句观察。规则：(1) 分数 ≥k 需要锚点 ≤k 的全部 requirement 条目通过；(2) 评审或脚本确认出现了某档（2 或 5）锚点描述的症状，分数封顶在该档；(3) 介于两档之间时，分数 = 低档 + floor((高档 − 低档) × 高档条目通过比例)；(4) 9 分 = 8 分条目全部通过，且 10 分额外项中通过的难度加权比例 ≥60%，其中至少 1 项是"难"项（R0 时由首席评审给每个 10 分额外项标注难度 hard=2 / normal=1，写入 items.json 并在 R1 前冻结）；(5) 10 分 = 10 分全部条目通过，且对抗复核没有被验证的缺陷；(6) 额外项的可见性：一个 10 分额外项只有在 (a) 没见过 rubric 的盲评在 1× 默认视图片段中主动提到它，或 (b) 被声明为"检查模式额外项"（inspect-mode extra，只在 X 光 / 幕后模式里可见）时才计入；(b) 类在每个 criterion 最多贡献 +0.5 分。被任何评审标为"分散注意 / 多余"的额外项必须做有/无 A/B 测试（≥5 名盲评，偏好 ≥60% 且 0 次"分散注意"），否则不计入。
- **机器上限**：凡是 criterion 的锚点里写了数值阈值，自动脚本的结果就是一个上限：脚本证明未达到某档阈值时，评审分不得高于下一档（例如 8 分阈值失败 → 最高 7）。评审可以打得比上限低，不能打得比上限高。纯脚本类 criterion 直接取"所有阈值都成立的最高锚点"。
- **严重度上限**：缺陷严重度（J-valid 必须按此分级，示例见 definitions.severity）：blocker = 基准正典失败或让人一眼出戏（脚离踏板 ≥3 u、远腿画在车架前、车轮倒转、骑者被裁、控制台错误、诡异或吓人的表情）；major = 专业观众会立刻指出的问题（肩部缝隙、明显的抖动或果冻感、吵闹的配色、拥挤的面板、错误的汉字、网点摩尔纹）；minor = 只有放大或逐帧才看得到的瑕疵。任何被验证的 blocker 把相关 criterion 封顶在 6，任何被验证的 major 封顶在 8——无论锚点文字是否提到这类缺陷。
- **solver 不变量**：按解析 solver 构造就必然成立的性质（solver 空间的脚误差、飞轮 ≡ 3×曲柄、链条斜率 −48、曲柄相差 180°、周期误差等）只作为门槛（G3、G10）检查，不再在任何 criterion 中计分；criterion 的分数只给在渲染像素或 DOM 中测到的结果。每个物理性质只在一个 criterion 中计分（去重表见 definitions.dedupe）。检查模式与页内读数若直接回显 solver 数值，必须标注"solver"，不得作为证据。
- **N/A 政策**：某 criterion 或锚点条目在本环境中被证明不可行（例如 WebKitGTK 装不上、推送 .github/workflows 被拒），只能在 R0、在看到任何构建结果之前，由首席评审带证据标为 N/A，写入 docs/eval/na.json；被 N/A 的条目不计入通过比例，整个 criterion 被 N/A 时其维度内权重按比例重新分配。R0 之后不得新增 N/A；verify 对它们输出"未运行（原因）"而不是失败。
- **criterion 分**：`s_c = min( 条目聚合分_c（按 scale 规则，由各评审条目判定的中位结论得出）,  机器上限_c,  严重度上限_c )；取中位前，低分离群评审引用的缺陷必须先送 J-valid 核实，被证实的缺陷对所有评审生效。`
- **维度分**：`S_d = min( Σ w_c·s_c / Σ w_c ,  失败门槛对该维度的上限,  维度特别上限_d )，w_c 为维度内相对权重。维度特别上限：S_D8 ≤ s_C8.1 + 0.5（没有真正的标志性时刻，惊艳维度就不能高）。`
- **总分**：`T = min( Σ W_d·S_d / 10 ,  失败门槛对总分的上限 )；T_final = T × min(1, H/9)，H = 感知核心集（target.perceptualCore）的平均 criterion 分；T_final ∈ [0,100]，保留一位小数。`
- **报告**：每轮输出 docs/eval/rounds/`<round>`/scorecard.json：每个 criterion 的全部条目判定、评审分、机器上限、严重度上限、最终分、引用的证据路径与评审原话；每个维度分、T、H、T_final、门槛通过情况、评审间极差、每名评审的植入缺陷召回率、被对抗复核下调的项与未达标项。scorecard.md 由脚本生成，第一行固定为 meta.selfAssessmentLabel。

## 4. 维度与权重一览

D1–D5 共 44 分，是这道基准本身：一只对的鹈鹕、一辆对的自行车、真的在骑、动得好。D6–D8 与 D13 共 34 分，是让它从一份答卷变成一部作品的东西：表演、风格 C 的美术与镜头、惊艳，以及用户点名要求的细节密度（D13 单独 10 分，并有 G-DETAIL 门槛兜底）。D9–D12 共 22 分，是让它经得起任何人、任何设备、任何怀疑者检验的东西：体验与无障碍、性能、零 JS 交付、工程与诚信。v2 从 D1–D5、D8、D12 各挪出 1 分、从 D9、D10 各挪出 2 分，共 11 分，给 D13（10）与 D11（1）：可由脚本按构造保证的机械项不再重复计分（见 scoring.solverInvariants），分数向人眼真正看得到的东西倾斜。硬门槛负责底线，权重负责上限，感知核心乘数（scoring.total）防止"脚本满分掩盖观感平庸"。

| 维度 | 名称 | English | 权重 | criteria | 受哪些门槛封顶 |
|---|---|---|---:|---:|---|
| [D1](#d1-基准正典与一眼可读) | 基准正典与一眼可读 | Benchmark canon & instant read | 11 | 3 | G2→4、G7→5 |
| [D2](#d2-自行车工程) | 自行车工程 | Bicycle engineering | 8 | 7 | G3→5、G4→3 |
| [D3](#d3-接触骑姿与物理) | 接触、骑姿与物理 | Contacts, fit & physical dynamics | 8 | 4 | G3→4 |
| [D4](#d4-鹈鹕物种与解剖) | 鹈鹕：物种与解剖 | Pelican species & anatomy | 8 | 7 | G7→4 |
| [D5](#d5-动画技艺) | 动画技艺 | Animation craft | 9 | 6 | G10→5 |
| [D6](#d6-角色表演与叙事) | 角色表演与叙事 | Character, acting & story | 8 | 6 | — |
| [D7](#d7-艺术指导风格-c-保真光影与镜头) | 艺术指导、风格 C 保真、光影与镜头 | Art direction, style-C fidelity, light & camera | 10 | 7 | G8→6、G-DETAIL→7 |
| [D8](#d8-惊艳标志性时刻横向对比彩蛋与声音) | 惊艳：标志性时刻、横向对比、彩蛋与声音 | Wow: signature moment, field comparison, delight & sound | 6 | 4 | — |
| [D9](#d9-交互无障碍与产品体验) | 交互、无障碍与产品体验 | Interaction, accessibility & product UX | 6 | 8 | G8→6、G11→5、G12→6 |
| [D10](#d10-性能与平台稳健) | 性能与平台稳健 | Performance & platform robustness | 4 | 8 | G9→4、G17→5 |
| [D11](#d11-零-js-svg-与交付物) | 零 JS SVG 与交付物 | Standalone SVG & deliverables | 7 | 5 | G5→4、G13→6、G17→4 |
| [D12](#d12-工程严谨可验证与诚信) | 工程严谨、可验证与诚信 | Engineering rigor, verifiability & honesty | 5 | 8 | G6→2、G10→5 |
| [D13](#d13-细节密度与工艺) | 细节密度与工艺 | Detail density & craft | 10 | 6 | G-DETAIL→4 |
| | **合计** | | **100** | **79** | |

标 ★ 的 criterion 属于感知核心集（target.perceptualCore）：其平均分 H 进入总分乘数，且单项不得低于 8。

## 5. 硬门槛

任一门槛失败即按"上限"封顶（多个门槛失败时取最低上限）；门槛是底线，对应 criterion 的 8/10 分锚点要求更高。

| 门槛 | 名称 | 规则 | 失败时上限 | 测量 / 证据 |
|---|---|---|---|---|
| **G1** | 构建与自包含 | node tools/build.mjs 成功；dist/index.html 从 file:// 打开时 0 console error、0 console warning、0 pageerror、0 未处理 rejection，并且除自身、data: 与 blob: 之外 0 网络请求；没有外部 `<script src>`、`<link href>`、@import 或 url(http)；≤1 MB gzip 且 ≤3 MB raw（styleProfiles.C.budgets）。 | 总分 ≤30 | shoot.mjs --dist（全集）+ tools/audit-dist.mjs + 共用 console 收集器。<br>证据：docs/eval/console.json；perf/dist-audit.json |
| **G2** | 基准正典 | hero 帧（definitions.hero，notext）与烘焙 SVG 的 t=0 帧经 3 名盲评判定 CANON-14 全部成立：每名评审只计其首个结论；异议必须指出一个可见特征，并由 J-valid 在重新渲染上核实后才生效；#12、#13 可答"无法判断"并以 check-occlusion 为准。check-benchmark.mjs 在 RS-cycle24 上全部通过。 | 总分 ≤40；D1 ≤4 | C1.1 与 C12.8（check-benchmark.mjs）的测量。<br>证据：docs/eval/canon.json；docs/eval/benchmark.json |
| **G3** | 运动学与接触 | check-rig.mjs 通过（solver 空间不变量只在这里检查、不在任何 criterion 中计分）：3×1440 曲柄样本加上 hop/wave/bell/gulp/滑行，脚误差 ≤0.5 u、手误差 ≤0.5 u（挥手窗口内的挥手翼除外，任何时刻至少一只翼在握把上）、0 次膝翻转、0 NaN、每 0.25° 步最大关节跳变 ≤1.5°、任何时刻飞轮 = 3×曲柄（含滑行）、两曲柄 180±0.1°、链条每曲柄转 −48 节；DOM 空间的 check-anchors 通过（脚掌球—踏板轴 ≤0.75 u、腕—握把 ≤0.75 u）且锚点审计通过（每个锚点都在其自身渲染 mask 的正确轮廓上，见 C1.1）；每个解析样本腹—座间隙 ≤1 u 且 frames 00–11 与 ev-hop 中腹座之间 0 个背景像素（definitions.pixel）；跳车以外两胎 \|gap\| ≤1 u、陷入 ≤3 u。 | 总分 ≤50；D2 ≤5；D3 ≤4 | check-rig.mjs（含 --seat、--events）、check-anchors.mjs（含锚点审计）、check-contacts.mjs。phase-0 目前在飞轮与车座两项上失败。<br>证据：docs/eval/rig.json；docs/eval/canon.json；docs/eval/anchor-audit.json；docs/eval/seat.json；docs/eval/contacts.json |
| **G4** | 方向与不倒转 | 在实时页面、烘焙 SVG 与 preview.webm 中：车轮与曲柄顺时针转（骑者朝 +x）、世界向 −x 滚动、链条上段向 +x 移动；默认踏频与 20–110 rpm 下没有任何旋转元素看起来在倒转：wagon.mjs 的像素角向互相关在每个车轮、飞轮、牙盘圆环中最佳匹配为正向，至少一个可见线索跟踪真实旋转，且每个踏频下车轮都有可见结构（轮圈 + 模糊盘）；逐帧评审判断方向全对。 | 总分 ≤50；D2 ≤3 | wagon.mjs（像素法）、check-kinematics.mjs、check-baked.mjs、webm 逐帧评审。<br>证据：docs/eval/alias.json；docs/eval/kinematics.json；docs/eval/baked.json |
| **G5** | 独立 SVG | dist/pelican-bicycle.svg 是良构 XML，0 `<script>`、0 on\* 属性、0 `<foreignObject>`、0 外部引用、0 内嵌位图 `<image>`、0 未解析的 var(--)，≤3 MB raw（styleProfiles.C）；作为 `<img>` 时明显在动（骑者区域在 0、0.37、0.81 s 的截图不同）；循环接缝比 ≤1.5 且各层无漂移；静态回退：删掉全部 `<animate*>`/`<set>` 并禁用 CSS 动画后，基础属性渲染出 hero 姿态并通过 check-benchmark（CANON-14 via data-anchor）；dist/pelican-mini.svg 存在、≤16 KB、会动并通过 CANON-14。 | 总分 ≤60；D11 ≤4 | check-baked.mjs（含 --static）、loop-seam.mjs。<br>证据：docs/eval/baked.json；docs/eval/baked-static.json；docs/eval/mini.json |
| **G6** | 诚信 | README、PR、Artifact 文字、docs/handoff.md 以及 README 链接的每份已提交文档（含本 rubric）中，每一条数字、比较、能力或外部事实声明都在 docs/claims.json 中且 tools/verify-claims.mjs 通过（外部事实带来源 URL，否则删除或标"未核实"）；readme-lint 对未标注的评价性形容词 0 命中；rubric 分数只以"同模型自评"标注出现；代理数按角色分列、不发布单一总数；没有把未使用的工具或模型写成已使用；不对任何其他具名模型声称优劣；披露评审是 Claude 子代理；fps 数字注明是无头软件光栅测量。任何一个捏造或不可验证的数字都触发此上限。 | 总分 ≤30；D12 ≤2 | verify-claims.mjs、readme-lint.mjs、人工声明审计。<br>证据：docs/claims.json；docs/eval/claims.json |
| **G7** | 物种与身体正典 | 去文字（?notext=1）的 256 px hero 上，≥4/5 盲评首先说出"鹈鹕"（只计首个物种），且没有任何人首先说出鹳、白鹭、鹭、鹅、天鹅、鸥或巨嘴鸟（异议须指出可见特征并经 J-valid 核实）；诱饵区分度 P(鹈鹕\|我们) − P(鹈鹕\|无喉囊诱饵) ≥0.4；遮头剪影 ≥3/5 选鹈鹕或"身体厚重的水鸟"；128 px 剪影 ≥4/5 读作"一只鸟在骑自行车"；解剖计数：恰好 2 条腿、2 只翼、1 个带 nail 的喙、侧视 1 只可见的眼、每只脚 4 个带蹼的趾，0 个人类特征（手、指节状分段、牙齿、耳朵、眉毛、睫毛、鼻子、鞋、人脚）；握把处读作羽扇（≥4 枚分开的初级飞羽尖，没有指节状分段）；白色身体配黑色初级 且 黑色次级飞羽；喉囊在 100% 的帧、事件、时段、机位、手机视图、海报与烘焙 SVG 中都在。 | 总分 ≤50；D4 ≤4；D1 ≤5 | C1.3 与 C4.1 的盲评（notext、诱饵、遮头剪影）；解剖评审清单。<br>证据：docs/eval/thumb.json；docs/eval/species.json |
| **G8** | 手机与构图安全 | 首次加载时，在 390×844、844×390 与 720×800 下，整个骑者（车 + 鹈鹕的 bbox，含喙尖、冠、尾尖与两胎）在视口内且边距 ≥3%，与 UI 0 重叠（面板打开与折叠两种状态），没有横向滚动；wide 与 cinematic 机位下 100% 采样帧骑者都在画内；桌面默认视图（1280×720 与 1600×900）骑者 bbox 高度 ≥45% 视口高（8 分锚点要求 ≥50%）；标题卡在任何机位下都不遮住骑者。phase-0 目前失败（slice 构图在 390×844 下切掉后轮与尾巴）。 | 总分 ≤70；D9 ≤6；D7 ≤6 | ux-matrix.mjs、first-look.mjs、contact-probe.mjs。<br>证据：docs/eval/mobile.json；docs/eval/first-look.json |
| **G9** | 流畅 | tools/perf.mjs 基于 trace 的呈现帧率（Display::DrawAndSwap），在 CPU 独占锁下 3 次运行取中位数：1600×900 DPR1、golden、60 rpm、全部细节开启时 wide 与 close 两个机位都 ≥55 fps，且 p95 帧间隔 ≤25 ms；骑者带 DOM 在 ≥98% 的呈现帧上变化，state.t 在每个 rAF 严格递增；perf.json 记录画质档位与 DOM 结构哈希，所有评审渲染都使用这一档；实时帧与 renderAt 一致：截取实时帧、读 \_\_pb.state.t，与 renderAt(t) 的像素差 ≤0.5%；lint 对任何改变渲染的 navigator.webdriver / HeadlessChrome / UA 检测直接失败。（烘焙循环接缝由 G5 负责。） | 总分 ≤60；D10 ≤4 | perf.mjs（CPU 独占锁）、tools/live-parity.mjs、lint.mjs。<br>证据：perf/perf.json；docs/eval/live-parity.json |
| **G10** | 连续与确定 | motion-audit --fuzz（300 条种子日程，240 Hz）中任何非旋转 slot 都没有单样本角变化 >3° 或位移 >2 u；10 分钟 soak 与 fuzz 中从未向 transform、d 或 style 写入 NaN/Infinity；renderAt 与历史无关（≥20 个种子元组新鲜渲染与经历随机历史后渲染哈希相同，dev 与 dist 相同）；在 dt = 1/30、1/60、1/120 下同一 t 的姿态差 ≤0.5° 且 ≤0.5 u；喉囊、冠、尾、头都有相对父级非零滞后的次级动作（不是贴纸）。 | 总分 ≤60；D5 ≤5；D12 ≤5 | motion-audit.mjs --fuzz、soak.mjs、determinism.mjs。<br>证据：docs/eval/fuzz.json；perf/soak.json；docs/eval/determinism.json |
| **G11** | 动效与声音安全 | prefers-reduced-motion 被尊重：交互前 0 s 与 3 s 截图一致，0 s 即显示静态海报帧、UI 与双语"已开启减少动态"说明；播放后没有机位滚转、缩放呼吸、抖动、速度线或自动时段；运行中改变系统设置会实时适配。flash-check 在所有时段、所有踏频直到 max、所有机位与事件下任意 1 s 窗口 ≤3 次一般或红色闪烁（WCAG 2.3.1）。用户显式开启声音之前 0 个 AudioContext 构造、0 次 media play()。每个视口都有可见的暂停 / 播放控件且 ≤2 次 Tab 可达；每个功能（包括喂鱼）都能只用键盘完成，并有可见焦点环。开场类指标（C7.1、C9.1）在 reducedMotion no-preference 下另测。 | 总分 ≤60；D9 ≤5 | flash-check.mjs、audio-check.mjs、keys.mjs、ux-matrix.mjs。<br>证据：docs/eval/flash.json；docs/eval/reduced-motion.json；docs/eval/audio.json；docs/eval/keys.json |
| **G12** | 无障碍底线 | axe-core（wcag2a、wcag2aa、wcag21aa、wcag22aa）在每个测试状态（默认、帮助打开、移动端、两种语言、减少动态、夜间、宿主暗色 / 亮色主题）下 0 个 critical 或 serious 违规；场景由一个 role=img、名称为当前语言的包装元素承载，每个深度带 `<svg>` aria-hidden，场景在无障碍树中恰好是 1 个节点；用户可见字符串 100% 双语，`<html lang>` 与显示语言一致，cjk-glyph.mjs 0 个豆腐块；没有快捷键劫持原生行为（聚焦控件时的 Space/Enter、聚焦滑块时的方向键、Ctrl/Cmd/Alt 组合与 IME 组字都不触发动作）。 | 总分 ≤70；D9 ≤6 | a11y.mjs、i18n-lint.mjs、cjk-glyph.mjs、keys.mjs。<br>证据：docs/eval/a11y.json；docs/eval/i18n.json；docs/eval/keys.json |
| **G13** | 交付完整 | dist/index.html、dist/pelican-bicycle.svg、dist/pelican-mini.svg、poster.png、contact-sheet.png、preview.webm（确定性 60 fps、帧数 = 时长×60、0 丢帧或重复帧）、双语 README、docs/handoff.md、已推送分支上的 draft PR、已发布的 Artifact URL 全部存在并互相链接；Artifact 读回内容与 dist/index.html 一致（除 R0 发布探针记录的宿主包装外）；在按探针发现的沙箱标志配置的 iframe 中，下载要么可用、要么显示可见回退，绝不静默无效。 | 总分 ≤70；D11 ≤6 | tools/judge/package.mjs、export-check.mjs、Artifact read 回读 diff（docs/eval/publish-probe.json）。<br>证据：docs/eval/package.json；docs/eval/export.json；docs/eval/publish.json |
| **G14** | 评估有效性与过程完整 | npm ci && npm run verify 从全新克隆退出码 0（快速版 <10 min；verify:full 只在 R-final 必需）；已提交的 dist/\* 的 sha256 等于从已提交 src 全新构建的结果；tools 中没有写死的 /opt/node22 或 /home/user 路径。评估有效性：每个 gate 工具在 R0 通过工具有效性检验（已知良好 fixture 通过、mutant 集全部失败、连续两次结论相同），结果写入 docs/eval/tool-validity.json，gate 工具在 R0 之后哈希锁定；覆盖矩阵 docs/team/coverage.json 100% 覆盖（每个 criterion 都有产出者、工具、评审位与证据路径；任何无主 criterion 即失败）；每名计分评审的植入缺陷召回率 ≥80%，否则其分数作废并换人；评审隔离审计 0 越界。最终分数来自最后一次修复提交之后的重新评分，使用本 rubric 的原子条目；所有权审计 0 越界；交付时 git status --porcelain 为空，没有 >5 MB 的已提交文件，没有提交任何密钥。 | 总分 ≤70；未通过时不得宣称达标 | 全新克隆 verify；双构建哈希比较；tools/tool-validity.mjs；tools/coverage.mjs；wf-build.vN.js 代码审查；ownership 与 isolation 审计。<br>证据：docs/eval/verify.txt；dist/MANIFEST.json；docs/eval/tool-validity.json；docs/team/coverage.json；docs/team/ledger.json；docs/eval/ownership.json；docs/eval/isolation.json |
| **G15** | 不冒充、有署名 | 页面与 README 不复制 Simon Willison 博客的品牌、不暗示背书，并以链接致谢该基准（以及用到时的 Gianluca Gimini 的 Velocipedia）；发布的名称与文案使用通用风格名（"复古旅行海报"、"WPA / art-deco 丝网印刷风格"），不使用真实 logo、真实机构的海报品牌或真实人名；许可与出处：docs/THIRD_PARTY.md 列出每个字体（WenQuanYi Zen Hei：GPLv2 + 字体嵌入例外；DejaVu）与素材来源及许可，脚本检查 gen / tool 代码中用到的每个字体路径都在其中；第三方基准 SVG（包括 simonw/pelican-bicycle 中的作品）不进入任何已提交或已发布的产物，只给链接；仓库有 LICENSE。 | 总分记 0；一票否决：修正前不得发布，总分记 0 | 代码审查、README/Artifact 文字审查、check-docs.mjs 的字体许可检查、git ls-files 对第三方 SVG 的检查。<br>证据：README.md；docs/THIRD_PARTY.md；LICENSE；dist/index.html；docs/eval/docs.json |
| **G-DETAIL** | 细节远多于草稿（用户硬性要求） | (1) tools/detail-inventory.mjs 的细节清单总数 ≥2.5× 草稿基线（docs/rubric/detail-baseline-C.json，129 条，R0 用同一工具复核后哈希锁定；目标 ≥323 条），鹈鹕与自行车各 ≥2.0×，其余每层 ≥1.5×（fx ≥4 条）；每个计入的条目在 1× 或 3× 裁图中可见。(2) 3× 放大覆盖：tools/zoom-coverage.mjs 在 close 机位、DPR 3、4 个曲柄相位与 hero 上，骑者（鹈鹕 + 车）覆盖的每个 12×12 u 格子中 ≥85% 被判为"有细节"，且不存在连续 ≥4 个格子的空白区。(3) 2 名细节评审（J-detail）把成品与草稿的同位置裁图并排比较：两人都在 7 个区域中 ≥6 个判定成品细节更多，且"感知清单倍数"≥2.0。(4) 细节不以性能为代价：G9 在全部细节开启时成立。 | 总分 ≤60；D13 ≤4；D7 ≤7；用户点名的要求：未通过时不得宣称达标 | detail-inventory.mjs、zoom-coverage.mjs、J-detail 并排评审、perf.mjs。<br>证据：docs/eval/detail-inventory.json；docs/eval/zoom-coverage.json；docs/eval/judges/detail-\*.json；shots/eval/detail/pairs/\*.png |
| **G16** | 用户检查点（唯一的真人评审） | 在 R1 之后与 R-final 之前各一次，把联系表、preview.webm、Artifact 链接与"细节对照"图（成品 vs 草稿同位置裁图）发给用户，请用户给出通过 / 不通过与前 3 条意见，原话记入 docs/eval/user-checkpoint.json。任何未解决的用户意见都阻止"达标"声明；用户对动作手感（C5.2）与声音（C8.4）的意见在本检查点中收集。用户未回复时状态为"待确认"，对外只能写"同模型自评达标，待用户确认"。 | 总分 ≤89；未通过或有未解决的用户意见时不得宣称达标（上限低于达标线 92）；待确认时不封顶，但不得使用"达标"一词 | 负责人向用户发送检查点材料并记录回复；scorecard 读取该文件。<br>证据：docs/eval/user-checkpoint.json |
| **G17** | 真的是 SVG 动画 | 场景中每一个可见像素都来自 DOM 中的 SVG。`<canvas>`、`<img>`、CSS background-image 与光栅 data: URL 只允许作为运行时缓存，由页面自己的 SVG 生成，缓存记录的源哈希必须等于对应 SVG 子树哈希，且数量 ≤4（例如预光栅的静态带）；bundle 中不得出现 image/png、image/webp、image/jpeg、image/avif 的 data: URL 或 base64 位图（海报等下载产物除外，它们不在页面里显示）；关闭全部缓存（?nocache=1）后画面与默认渲染像素差 ≤0.5%。 | 总分 ≤50；D11 ≤4；D10 ≤5 | 新 tools/check-purity.mjs：grep bundle 中的光栅 MIME 与 base64 头；页内枚举 canvas/img/background-image 及其 data-src-hash，与 SVG 子树哈希比较；?nocache=1 对照渲染。<br>证据：docs/eval/purity.json |

## 6. 维度详解

### D1 基准正典与一眼可读

*Benchmark canon & instant read* · **权重 11** · 来源镜头：E1、E2、ANIM-6、ENG-12、ORN-1

Simon Willison 的 "pelican riding a bicycle" 基准真正考的东西：每一帧都必须是"一只能认出来的鹈鹕，正确地骑在一辆正确的自行车上"，并且在缩略图里一眼可读。评审会放大检查的是车架闭合、脚在踏板、身体坐在座上——这些不能只在 hero 帧成立，也不能只在 solver 里成立。v2：识别测试一律去掉文字（?notext=1）并加入对照诱饵（foil），因为画面里的"PELICAN BAY / 鹈鹕湾"与评审对这道基准的先验都会泄露答案；检查器本身（原 C1.4）移到 D12 作为 C12.8。

#### C1.1 CANON-14 在每一帧都成立（按渲染像素与 DOM 计，不只看 solver）

维度内权重 3.5（占本维度 39%，折合总分 4.28 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：hero 帧就有 ≥1 项 CANON-14 不成立，即 2024 年画廊里的典型失败：车架没接到后轴、没有链条、鸟悬在车座上方、脚悬空。
- **5 分**：hero 帧通过，但抽样帧失败：上/下死点附近脚离开踏板；挥手时翼脱离握把；某些相位远侧腿画在车架前面（"leg bleeding through the bicycle"）；跳车落地时骨盆陷进车座 >3 u。
- **8 分**：14 项在种子化网格（72 相位 × {40,60,90,110} rpm × 3 机位，另加 4 事件 × 10 τ，相位偏移按 definitions.sampling）以及烘焙 SVG 的 6 帧中全部通过；check-anchors 全部在阈值内，且锚点审计通过（每个 data-anchor 都落在其自身渲染 alpha mask 的正确轮廓上）；3 名盲评在去文字的逐帧 CANON-14 清单中 0 条被验证的 major/blocker，且每名盲评对证据包中植入缺陷帧的召回率 ≥80%。
- **10 分**：8 分全部满足，另加：在植入缺陷召回率 ≥80% 的前提下 3 名盲评 0 条被验证的意见（含 minor）；DOM 锚点误差 ≤0.25 u；滑行（曲柄停、双脚水平）、110 rpm 与 R-final 的密封留出条件下仍全部成立；踏板平台随 ankling 转动。

**测量**：[script] tools/check-anchors.mjs：各 art 模块放置零尺寸 data-anchor 点（bike-rearHub/frontHub/bb/saddleTop/gripNear/gripFar/pedalNear/pedalFar，pl-footBallNear/Far，pl-wristNear/Far，pb-seatContact），window.\_\_pb.renderAt 之后用 getScreenCTM 经 docs/contract 中记录的辅助函数映射到 rider 空间。阈值：管端到轴心 ≤0.5 u；脚掌球到踏板轴 ≤0.75 u；腕到握把 ≤0.75 u（挥手窗口内的近翼豁免）；座接触点相对座顶 ∈[−1,+2] u；胎底到 GROUND_Y ≤1 u（跳车除外）。锚点审计（防"锚点对、美术偏"）：把每个锚点所属 slot 单独光栅化为 4 px/u alpha mask，脚掌球锚点到脚底轮廓 ≤0.5 u，踏板锚点位于踏板 mask 顶面中点 ±0.5 u，腕锚点在握把 mask 内，座接触点到腹部 mask 下缘 ≤0.5 u。美术级 mutant（由没看过检查器的独立红队代理编写：脚的美术平移 3 u 而锚点不动、前叉美术旋转 2°、腹部画高 3 u）必须全部被标红。[judge] 3 名盲评对 RS-cycle24 + RS-events + 烘焙 6 帧（全部 ?notext=1）逐帧回答 CANON-14 是/否清单；#12、#13 可答"无法判断"，此时以 check-occlusion 结果为准；证据包里混有 2–3 张 ?mutant= 植入缺陷帧（评审不知情）。

**证据**：docs/eval/canon.json（逐帧逐项结果与最坏值）；docs/eval/anchor-audit.json；docs/eval/mutants-art.json；shots/eval/canon/\*.png；docs/eval/judges/canon-\*.json

#### C1.2 远近遮挡正确，两条腿分列车架两侧

维度内权重 2（占本维度 22%，折合总分 2.44 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：远侧腿或远侧翼画在车架前面，或近侧腿被车架挡住；远侧曲柄画在牙盘前面。
- **5 分**：hero 帧正确，但至少一个相位出现远侧腿穿过上管/座管，或远侧曲柄压在牙盘上。
- **8 分**：?idmap=1 ID-buffer 渲染（每个 slot 一种唯一平涂色、关闭描边），在 12 个相位上：(远腿 ∩ 车架) 像素中车架 ID ≥98%；(近大腿/小腿 ∩ 车架/牙盘) 中近腿 ID ≥98%；(远曲柄 ∩ 牙盘) 显示牙盘。
- **10 分**：72 相位 100% 正确，包括跳车、挥手、吞鱼；远侧部件是平涂 B/N（风格 C），并在 3× 裁图中仍能分辨；"只找遮挡错误"的对抗评审在植入缺陷召回率 ≥80% 的前提下 0 条被验证的意见。

**测量**：[script] 新增 ?idmap=1 渲染模式 + 新 tools/check-occlusion.mjs（12 相位入 gate，72 相位计分）。[judge] 2 名对抗评审看 RS-crops 中的 BB 与远足裁图，第 3 个代理逐条裁定有效性。

**证据**：docs/eval/occlusion.json；shots/eval/idmap/\*.png

#### C1.3 缩略图、剪影、去文字与诱饵对照下一眼可读 ★

维度内权重 3.5（占本维度 39%，折合总分 4.28 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：256 px 去文字图上评审首先说出"鸟""鸭""鹳""鹭"；喙读作普通鸟喙；喉囊在缩略图中消失；剪影是一团。
- **5 分**：600 px 能认出鹈鹕，但在 128 px、剪影或遮头剪影下 ≥2/5 评审说鹳 / 鹭 / 鹤（细长腿、细 S 颈是常见原因），或看不出是在"骑"；诱饵区分度 <0.3（没有喉囊的诱饵也被叫作鹈鹕，说明评审是在猜题）；若干相位存在切线（tangent）。
- **8 分**：去文字（notext）的 256 px、剪影、灰度下 ≥4/5 评审首先说出"鹈鹕"且说出"骑自行车"；128 px 下 ≥4/5；诱饵区分度 P(鹈鹕|我们) − P(鹈鹕|无喉囊诱饵) ≥0.6；遮头剪影（喙与喉囊涂掉）从 {鹈鹕, 鹳, 鹭, 鹤, 鹅, 天鹅} 中 ≥3/5 选鹈鹕或"身体厚重的水鸟"；鹳比例诱饵被 ≥3/5 叫作鹳 / 鹭（证明测试有效）；deutan 色觉模拟图 ≥4/5；剪影背景连通域：喙 / 喉囊下方空隙在 ≥11/12 相位出现，前三角 12/12，两轮内圈 12/12；切线 ≤2 处。
- **10 分**：128 px 与剪影 5/5，64 px ≥4/5；诱饵区分度 ≥0.8；遮头剪影 ≥4/5；只保留骑者的裁图（去背景）5/5；0 处切线；6 个时段里鸟与背景的明度分离都满足 styleProfiles.C 的相对约束。

**测量**：[script] tools/thumb.mjs：hero（definitions.hero）+ 3 个种子化曲柄相位，live 与烘焙 SVG（作为 `<img>`）各一套，全部 ?notext=1，尺寸 64×36 / 128×72 / 256×144 / 600×338；变体：?silhouette=1（#L-rider 填 #000、白底、隐藏世界）、遮头剪影（喙、喉囊、头部 slot 以背景色涂掉）、只含骑者的中性背景裁图、灰度、protan/deutan/tritan 模拟（feColorMatrix 只加在截图页）。诱饵（同样渲染）：?mutant=nopouch、?mutant=stork（细颈、长裸腿、瘦身）、?mutant=goose，以及 ?solo=pelican（下车的鸟）。tools/silhouette.mjs 做连通域与切线检测。交付前由另一代理确认每张图没有可辨认文字；盲评提示经 blind-prompt lint（不得出现 pelican|鹈鹕|bicycle|自行车|Pelican Bay），只传 PNG、绝不传 SVG 源码（含 `<title>`）。[judge] 5 名新鲜盲评（隔离证据包，见 protocol），开放式问题："画的是什么？尽可能具体地说出动物，以及它在做什么。"只计首先说出的物种；遮头剪影用 6 选 1。

**证据**：docs/eval/thumb.json（含诱饵区分度与遮头测试）；shots/eval/thumb/\*.png；docs/eval/judges/thumb-\*.json

### D2 自行车工程

*Bicycle engineering* · **权重 8** · 来源镜头：mech-frame、mech-drivetrain、mech-kinematics、mech-aliasing、mech-wheels、mech-frontend、mech-detail、E3、ANIM-10

一辆车架师、机械工程师、轮组师都挑不出毛病的复古城市车：几何按 contract.js，传动与运动学精确耦合，任何速度下都不"倒转"，放大 4× 仍是一件产品插画。

#### C2.1 菱形车架几何与结构完整

维度内权重 4（占本维度 24%，折合总分 1.94 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：Velocipedia 式失败：管件缺失或不相连（座管没到 BB、后下叉悬空、前叉没到轮轴），车架是梯形或单梁，轮子没有勾爪固定。
- **5 分**：菱形完整且相连，但几何漂移：角度偏差 >2°；前叉从头管顶直线拉到轴心、没有 rake 弯（phase-0 占位 bike.js 就是这样）；下管撞在头管底角；座杆偏离座管轴线；近景下接头处有小缝或重叠。
- **8 分**：实测角度 ±0.5°、节点 ±1 u 内符合 contract.js BIKE（ST 73.0°、HT 72.0°、rake 13.2、trail 18.6、轴距 298、BB drop 20）；所有节点连通；前叉沿转向轴走，只在勾爪附近前弯；头碗与立管位置合理。4× 下只剩外观层面的缺失（无接头轮廓、管径均一）。
- **10 分**：4 px/u 下 0 缝隙；五通壳、头碗、座管束与后上叉盖、勾爪与轴螺母在结构上都在（细节密度另见 C13.3）；管径比例对应真实 28.6/31.8/19 mm；上管与下管接入头管长度的内部而非角点；开放式机械找错评审在植入缺陷召回率 ≥80% 的前提下 0 条被验证的意见。

**测量**：[script] tools/check-bike.mjs：打开 dist/index.html?freeze&solo=bike，只保留 frame/fork/bars slot，在页内光栅化为 4 px/u 的 alpha mask。(a) 沿 9 条规格中心线（TT、DT、ST、座杆、SS、CS、HT、转向管→立管、前叉冠→前轴 rake 曲线）各采 40 点，≥98% 着色；(b) 从 BB 做 8-连通 flood fill，必须到达后勾爪、座管束、头管上下端、前勾爪、座杆夹；(c) 对 ST/HT 骨架拟合直线，角度误差 ≤0.5°；(d) 轴心误差 ≤0.5 u。[judge] 无项目上下文的机械找错评审看 cam-close 与 4× 裁图，先开放式列出全部机械错误（证据包含 1–2 张植入 mutant：座管断开、前叉直线），J-valid 核实；锚点映射：0 条有效 → 10，1 条 minor → 8，1 条 major 或 3 条 minor → 5，缺管 → 2。

**证据**：docs/eval/bike.json；shots/eval/mech/frame-\*.png

#### C2.2 传动：齿数、链条包绕、啮合与层序

维度内权重 3（占本维度 18%，折合总分 1.45 分）· 测量方式：自动脚本 + 代码审查 + 视觉评审

- **2 分**：链条缺失、静止、不闭合、指向轴心而不是与齿盘相切，或向后运动；齿盘没有齿或齿数不对。
- **5 分**：链条闭合、路径与方向都对，但画在牙盘齿下面（phase-0 SLOTS 顺序 'cog','chain','chainring' 让牙盘齿盖住链条）；或只是一条虚线，没有链片和销；或齿数不是 48/16；或链罩遮住 >60%。
- **8 分**：48T 牙盘（5 爪 spider、齿距 7.5°、齿尖 r=30.2）与 16T 飞轮（22.5°）齿可数；CHAIN_D 闭合，上段（驱动段）绷直并与两节圆相切（误差 <0.05 u），包角 197°/163°；链片与滚子按真实节距（1 节 = 1 pathLength 单位）；层序为 牙盘齿 < 链条 < spider/近曲柄 < 踏板、飞轮 < 链条；>45 rpm 时链片按规格淡出。（每曲柄转 48 节、飞轮锁定等 solver 不变量只入 G3，不在此计分。）
- **10 分**：8 分全部满足，另加：整数链节（后下叉 125.433 u，后轴移到 (−123.83,−100)，链条恰好 100 节 × 12.7 mm；phase-0 为 100.61 节），并且在渲染像素中 12 个曲柄相位的滚子都落在两齿盘的齿谷里；回程段有 ≤2 u 下垂并在跳车落地时拍打。

**测量**：[code-review] src/art/bike.js 与 SLOTS。[script] check-bike.mjs：(1) data-ref 计数 bike-ring-tooth = 48、bike-cog-tooth = 16；(2) chain 的 d === CHAIN_D 且 pathLength=100；(3) compareDocumentPosition 验证层序；(4) node 中 chainOffset(φ+2π) − chainOffset(φ) ≡ −48 (mod 100)。[judge] 新 shoot 集 'drivetrain'：12 相位的 BB 与后轴 4 px/u 裁图，逐帧检查滚子是否入谷与层序。

**证据**：docs/eval/drivetrain.json；shots/eval/mech/drivetrain-\*.png

#### C2.3 渲染出来的无滑滚动与视差一致

维度内权重 3（占本维度 18%，折合总分 1.45 分）· 测量方式：自动脚本

- **2 分**：渲染中车轮倒转，或转速与路面无关；曲柄与车轮各转各的；路面明显在轮胎下滑动。
- **5 分**：方向与踩踏比正确，但渲染中至少一处耦合断了：滑行时飞轮画面跟着车轮转（phase-0 solve.js:78）；close/cinematic 机位下路面虚线屏幕速度与胎面（气门）屏幕速度差 >2%；HUD 速度对不上；恢复踩踏时相位跳变；视差不一致（前景比路面还慢）。
- **8 分**：在渲染 DOM 与像素中测得：气门屏幕线速度与路面虚线屏幕速度的滑移 <0.5%（40/60/90 rpm × wide/close/cinematic）；前后轮屏幕角速度相同 ±0.5%；每个视差层屏幕位移 = depth × 路程 × scale（mod TILE），误差 ≤0.1 u；滑行时曲柄画面静止、车轮继续转；HUD 与里程表读自同一个路程积分器。
- **10 分**：8 分全部满足，另加：20–110 rpm × 3 机位滑移 <0.1%，滑行减速过程中也一样；烘焙 SVG 中用 getCTM 测得同样比例；恢复踩踏 0 帧相位跳变；机械找错评审（植入缺陷召回率 ≥80%）0 条被验证的意见。

**测量**：[script] tools/check-kinematics.mjs 的 Playwright 部分：renderAt(t) 与 renderAt(t+1/60)，cadence 20/40/60/90/110 × wide/close/cinematic，读带标签路面虚线（land-dash-\*，getBoundingClientRect）与气门（bike-valve，getScreenCTM）的屏幕位移，滑移 = |Δroad − Δvalve_tangential| / |Δroad|；解析 HUD km/h 与 speed·0.0034·3.6 比较。tools/check-noslip.mjs：各层屏幕 translate 对 depth·distance mod TILE.\*，胎底像素 y 对 GROUND_Y。node 部分的 solver 不变量（cog ≡ 3×crank、chainOffset 斜率、2000 条随机序列）只作为 G3 检查，不计分。

**证据**：docs/eval/kinematics.json；docs/eval/noslip.json

#### C2.4 时间混叠：任何速度、任何媒介下都不"倒转"

维度内权重 2（占本维度 12%，折合总分 0.97 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：巡航速度下明显的车轮效应（wagon-wheel）：辐条或齿看起来倒转或静止，看不出车轮往哪转。
- **5 分**：辐条处理了，但 close 机位下飞轮齿（60 rpm 时每帧 0.80 个齿距）、牙盘齿（0.80）或 2 节链条虚线（90 rpm 时 0.60）倒闪；或者辐条隐去后没有任何元素还显示旋转、车轮变成空盘；或 webm 中出现倒转。
- **8 分**：20–110 rpm 下，在 60 fps 实时页面、renderAt 帧序列与 60 fps webm 中，每个车轮、飞轮、牙盘圆环的逐帧角向互相关最佳匹配旋转都是正向；每个旋转件保留 ≥1 个非对称高对比标记（气门、反光片、曲柄臂），其每帧步进 <0.35 个对称周期；每个踏频下都有可见的车轮结构（轮圈 + 两墨模糊盘，不是空盘）；逐帧评审在 20/60/110 rpm 判断方向 100% 正确。
- **10 分**：物理推导的运动模糊：幽灵数与角跨度 = ω × 快门时间（1/60 s，180° 快门），模糊长度随速度增长；实时、烘焙、webm 中方向始终可读；有 stroll 慢速档让 3-cross 编辐清楚可见。

**测量**：[script] tools/wagon.mjs（像素法，取代 DOM 枚举）：从 60 fps renderAt 帧与解码后的 webm 帧中，对每个车轮、飞轮、牙盘所在圆环做极坐标展开，计算相邻帧的角向互相关，最佳匹配旋转必须为正向且与真实角速度的跟踪误差 <0.35 周期（至少一个线索）；圆环内有效像素方差下限保证"不是空盘"。DOM 侧辅助报告：各周期图案的 r = 每帧步进 / 周期（辐条 11.25°、飞轮 22.5°、牙盘 7.5°、spider 72°、链条 dasharray、路面虚线 157.08、灯柱间距 848.2）。[judge] 评审看 12 张连续 webm 帧与 10 张连续 close 机位帧（每张单独、标注像素比例），报告感知到的车轮、飞轮、牙盘、链条方向。preview.webm 必须由 renderAt 逐帧渲染；实时录屏不算。

**证据**：docs/eval/alias.json；shots/eval/wagon/\*.png

#### C2.5 车轮与旋转件保真

维度内权重 1.5（占本维度 9%，折合总分 0.73 分）· 测量方式：代码审查 + 自动脚本 + 视觉评审

- **2 分**：辐条从中心放射（phase-0 占位是 8 根放射线），车轮是空圆，或挡泥板和撑杆随车轮一起转。
- **5 分**：32 根辐条，但放射或交叉方式错误，没有花鼓凸缘偏移，也没有近/远之分；没有气门，所以辐条模糊后就看不出旋转。
- **8 分**：正确的切向 3-cross 编辐：每根辐条自花鼓凸缘切向出发，到轮圈时相差 67.5°±1°（3 × 720°/32），16 根拉、16 根推，近/远凸缘交替，远侧更暗更细；花鼓凸缘 r 6–10、轴螺母；后花鼓驱动侧装 16T；有气门与辐条反光片；静止件（挡泥板、撑杆、刹车、勾爪）都不在旋转 slot 里。4× 下轮圈与条帽细节略薄。
- **10 分**：8 分全部满足，另加（逐项核对清单）：气门位于两根近乎平行的辐条之间；轮圈孔每 11.25° 一个；前后气门相位不同；远侧辐条按 -far 墨变暗；4× 下条帽可见（密度计分见 C13.3）。

**测量**：[code-review] src/art/bike.js。[script] check-bike.mjs 解析每根 data-ref bike-spoke-\*：花鼓端半径 6–10、轮圈端 86–88、从花鼓看两端角偏移 ±67.5°±1°、每轮 32 根且正负各 16。静止件差分：?solo=bike 在曲柄 0° 与 90°（renderAt 时路程保持一致）两帧像素差只允许出现在轮盘内（各轴心 r≤92）、曲柄圆内（BB r≤62）、CHAIN_D ±4 u 带和踏板区；屏蔽车筐内部以排除鱼的抖动；挡泥板、撑杆、车筐框、车灯、车架上任何像素变化都算失败。[judge] 前后花鼓 4× 裁图对照 10 分清单逐项判定（不做"签字"式整体判断）。

**证据**：docs/eval/bike.json；shots/eval/mech/hub-\*.png

#### C2.6 转向几何、座舱与附件的机械挂载

维度内权重 1.5（占本维度 9%，折合总分 0.73 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：车筐、车灯或车铃悬空不连；没有立管；车把不连任何东西；或者前叉在画面平面内转动，导致前轮离地。
- **5 分**：都连上了但很天真：完全没有刹车和线缆（草稿 A、B 都没有）；车筐没装在结构件上；车铃够不着；或者把 solve.js 注释里的"轻微转向摆动"做成画面内 rotate（1° 就让轴心移动约 2.7 u、接地点移动约 1 u）。
- **8 分**：挂载正确，有刹车和合理的线缆走向；转向要么静止，要么只用前轮 scaleX = cos δ（δ≤3°）的透视缩短加接地点横移来表现，绝不做画面内旋转；trail 为正（转向轴在接地点前 18.6 u 触地）；在全部 1440 样本与 wave/bell/hop 事件中 J.fork.rot = J.bars.rot = 0（或整个前组共享一个变换且前接地点距 GROUND_Y ≤0.5 u）；车铃到近握把 ≤15 u（契约值 11.7）。
- **10 分**：8 分全部满足，另加物理自洽的附件运动（按 scoring.scale 的可见性规则计入）：瓶式发电机滚轮以约 30× 轮速转动；车灯亮度随速度变化并有 standlight 渐隐；落地时车筐弹性变形、鱼做解析阻尼弹跳；线管弯曲半径平滑；车铃事件时击锤运动。

**测量**：[script] check-bike.mjs 断言前组变换；每个附件 mask（data-ref bike-basket、bike-lamp、bike-bell、bike-fender-\*、bike-brake-\*）在 4 px/u 下必须经其挂载点 8-连通到车架/前叉/车把 mask；铃—握把距离。[judge] 评审对照清单（刹车、线缆、挂载、灯的朝向、车筐支撑）看 cam-close 与座舱 4× 裁图（x 90…230，y −300…−200）。

**证据**：docs/eval/bike.json；shots/eval/mech/cockpit-\*.png

#### C2.7 4× 放大下的装配正确性（开放式清点）

维度内权重 1.5（占本维度 9%，折合总分 0.73 分）· 测量方式：视觉评审

- **2 分**：玩具车：看不出踏板和曲柄，车座是一团，车把是一条线。
- **5 分**：主要零件都在，但放大后很粗糙：踏板是矩形，没有 spider，没有座弓，没有远侧曲柄。
- **8 分**：开放式清点中认出 ≥18 个真实部件，0 个被验证的装配错误（评审的植入缺陷召回率 ≥80%）：远侧曲柄与踏板正确变暗并被后下叉与车轮挡住；座弓、座夹与弹簧装在座杆上；车把经立管与头碗连接；刹把与线管走向合理；勾爪与轴螺母位置正确。只有 1–2 处骑车的人会注意到的简化。
- **10 分**：无构建上下文的盲评自行车技师在开放式清点中认出 ≥25 个真实部件、0 个被验证的装配错误（召回率 ≥80%）；夜间反光片与车灯可读。

**测量**：[judge] 多模态技师评审看 4 张 4× 裁图（BB 与传动、后花鼓、座舱、座组；黄金时刻与夜间各一套，每张单图、标注像素比例），先开放式列出认得出的全部部件与全部装配错误，提交之后才拿到 25 项参考清单做对照（清单不引导清点）；证据包含 1 张植入装配错误的裁图（例如链条在牙盘外侧、刹把装反）。得分 = 开放式认出的部件数，被验证的错误按 scoring.severity 封顶。证据图由 tools/shoot.mjs --set crops（4 px/u 机械裁图）生成，评审判定写入 docs/eval/mech-assembly.json。

**证据**：shots/eval/mech/detail-\*.png；docs/eval/judges/mech-detail-\*.json；docs/eval/mech-assembly.json

### D3 接触、骑姿与物理

*Contacts, fit & physical dynamics* · **权重 8** · 来源镜头：mech-contacts、ANIM-7、ORN-6、mech-biomech、mech-dynamics、ANIM-4

七处接触（两脚—踏板、两手—握把、腹—车座、两胎—路面）在每一帧都读作真实接触；骑姿是一个合身的骑手；跳车、落地、滑行符合场景尺度的物理（g = 2885 u/s²）。

#### C3.1 脚—踏板、翼—握把、胎—路面：像素级接触

维度内权重 3（占本维度 33%，折合总分 2.67 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：典型的基准失败：脚悬在踏板附近或穿过曲柄，手在半空中，车浮在路上方或陷进路面。
- **5 分**：数学正确（check-rig 误差为 0），但美术露了馅：某些曲柄角下脚底间隙 2–5 u；踏板从脚中穿过（6 u 厚的踏板体以轴为中心，而 footBall (17,9) 让脚底穿过轴心，陷入 3 u）；初级飞羽没包住握把；路面顶边不在 790 而在 788 或 792。
- **8 分**：close 机位 12 帧与事件帧中每一对都在阈值内：脚底到踏板顶面间隙 ≤0.5 u、陷入不超过踏板厚度一半，蹼与趾搭在踏板边缘；握把覆盖 ≥60% 且腕枢轴正好在握把上；两胎触及 GROUND_Y=790，有 1–2 u 的接地平面和接触阴影；并且接触是看得见的：默认视图中近足—踏板、近翼—握把、腹—座三个接触区在 ID-map 中 ≥70% 未被遮挡的帧占 ≥95%。4× 下仍有小问题（例如少数几帧趾尖擦到曲柄臂）。
- **10 分**：48 相位 × {踩踏、滑行、跳车 8 个样本、挥手、摇铃、吞鱼} × 3 机位 0 违规；趾随 ankling 抓握，发力段（曲柄 60–120°）蹼受压；接触阴影随跳车高度变化；4× 找缝评审在植入缺陷召回率 ≥80% 的前提下 0 条被验证的缝隙。

**测量**：[script] tools/check-contacts.mjs：每个姿态样本把单个 slot 在页内光栅化为 4 px/u alpha mask（克隆 svg、只留一个 slot、XMLSerializer → Image → canvas），做距离变换：gap = mask 间最小距离，penetration = 沿接触法线的重叠深度（阈值按 definitions.pixel）。成对与阈值：footNear/pedalNear、footFar/pedalFar（gap ≤0.5，pen ≤3）；wing\*Hand 对车把握把圆（覆盖 ≥60%）；wheelRear/wheelFront 对 L-road 顶边（gap ≤0.5，pen ≤2）；远侧对在 solo 渲染中检查。可见性：?idmap=1 默认视图中，接触区（近足—踏板、近翼—握把、腹—座各自 mask 交界 ±3 u 带）被腹羽、蹼、前景草、车筐、链罩遮挡的比例；前景层只允许在 GROUND_Y 以下与车轮重叠，且至多盖住车轮底部 8%（STYLE-C §4），不得盖住任何接触区。另跑新 tools/contact-probe.mjs（真时间 60 fps × 8 s，wide/close/cinematic/390 px，getScreenCTM）。[judge] 视觉评审在 RS-crops 的近足、远足、握把与胎—路面 4× 裁图上找缝与穿插（含植入缺陷裁图），并看 onion.mjs 的地面接触区洋葱皮。

**证据**：docs/eval/contacts.json（每个样本的最坏对与可见率）；shots/eval/contacts/\*.png

#### C3.2 坐在车座上：体重、承托与平衡

维度内权重 2（占本维度 22%，折合总分 1.78 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：鸟悬在车座上方、中间能看到天空，或车座穿出身体；重心远在车座前方或后方；毫无重量感。
- **5 分**：静止时刚好碰到车座，但在 bob 峰值或跳车蹲伏时闪现 1–4 u 的缝。phase-0 实测：60 rpm 下腹部最低点在"陷入 2.4 u"与"悬空 2.6 u"之间往复，每曲柄转悬空两次，而且只在 x≈−42 的座鼻处单点接触。车座是刚性的；尾巴碰到车轮或车座。
- **8 分**：在每个解析样本（1440 曲柄角 × {40,60,90} rpm、滑行、跳车蹲伏 pelvisDy −4…+6）上腹—座间隙 ≤0.5 u，隐藏的陷入 ≤8 u（接触处重叠 ≥0.5 u），接触长度 ≥25 u 且覆盖 ≥50% 座顶（x −101…−23）；身体轴抬头 10–35°；尾巴离轮胎 ≥10 u；挥手时反向倾 ≥0.5°；像素测试 0 个背景像素（按 definitions.pixel）。
- **10 分**：8 分全部满足，另加：弹簧皮座随 bob 和落地压缩 1–3 u；腹羽垂搭在车座两侧；落地后身体以 ≤2 个周期的阻尼过冲沉降；重心在车座与五通之上。

**测量**：[script] check-rig.mjs 新增 --seat：腹部椭圆（中心 = pelvis + R(sway)·(32,−50)，rx 98，ry 58，旋转 −18°+sway）对 bike 模块实际座顶轮廓做解析测试，覆盖全部样本。像素测试：?freeze&solo=rider 放在纯 #FF00FF 背景上，对 frames 00–11 与 ev-hop，在座 x∈[−101,−23]（getScreenCTM 映射）逐列扫描座顶与腹部之间的品红像素，必须为 0。[judge] 看 ev-hop 与 ev-wave。

**证据**：docs/eval/seat.json；shots/eval/seat/\*.png

#### C3.3 踩踏生物力学与骑行 fit

维度内权重 2（占本维度 22%，折合总分 1.78 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：腿不跟踏板：膝盖反弯或翻转，一条腿伸直另一条乱弯，两个踏板同相，膝盖高过身体。
- **5 分**：IK 有效但 fit 看起来不对：膝盖在踏板轴前 25–35 u（phase-0：近侧 +28.8、远侧 +23.8）；鸟坐在座鼻上（髋 x=−37，有效座管角 80.5°）；腿锁死或蜷缩；踝角从不变化。
- **8 分**：除一项边缘值外全部在带内：BDC 膝内角 140–150°（绝不 >155°），TDC ≥68°；KOPS：3 点钟时膝关节中心在踏板轴 ±10 u（±34 mm）内；髋位于车座中间三分之一；两曲柄精确相差 180.000°；ankling 相位正确（TDC 后 0–120° 脚跟最低，180–300° 脚尖最低，总幅 15–30°）；膝轨迹平滑无尖点（每 0.25° 步的二阶差 <0.2 u）；骨盆竖直位移 ≤3 u、滚转 ≤2°，头保持水平。
- **10 分**：20–110 rpm 及滑行（双脚水平）全部在带内；有随踏频变化的细节（冲刺时 ankling 更大、身体微前倾，滑行时踝放松），并在 110 rpm 与 40 rpm 的数值差中可测；修 KOPS 时重新验证了 reach（远腿在 BDC 已达 L1+L2 的 96.7%，soft IK 会把它拉直并跳变）：1440 样本中 0 次膝角跳变 >0.5°/步。

**测量**：[script] check-rig.mjs 新增 --biomech（纯 node，solvePose 1440 样本 × {20,40,60,90,110} rpm）：BDC/TDC 膝内角、KOPS = shank.x − pedal.x（TDC 后 90°）、髋 x 对车座三等分 [−101,−75,−49,−23]、远近曲柄差、踏板/足角极值的角度与位置、骨盆 y 范围与身体转角范围、膝轨迹最大二阶差；与 phase-0 基线（膝 72.9–141.5° 近 / 74.4–146.5° 远，通过；KOPS 失败；髋失败；ankling 相位通过）对比。[judge] shoot frames 集加 ?skeleton=1 与膝轨迹叠加图；评审只做找缺陷（异常关节、锁膝、跳变），不做"教练称赞"式整体判断。

**证据**：docs/eval/biomech.json；shots/eval/biomech-sheet.png

#### C3.4 事件动力学：跳车、落地、滑行、变踏频、单手骑

维度内权重 2（占本维度 22%，折合总分 1.78 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：跳车是瞬移或绕错误的点旋转；落地时轮子穿过路面；滑行时车轮也停了。
- **5 分**：平滑但不物理（phase-0 现状）：58 u / 0.6 s 的正弦跳车，隐含约 0.45 g（起跳速度 304 u/s，实际需要 578）；两轮同时离地；空中曲柄仍在转；滑行时曲柄停在任意角度。
- **8 分**：对空中段 riderY 做抛物线拟合 R² ≥0.98，拟合 g 在 2885 u/s² ±25% 内（或声明的风格化滞空 ≤1.3× 物理值，顶点悬停 ≤4 帧）；蹲伏 ≥8 帧；前轮比后轮早 3–6 帧（≥60 ms）离地；空中曲柄保持 3/9 点 ±15°；后轮先着地或两轮 50 ms 内平落；最小净空 ≥−2 u；滑行开始后 0.6 s 内曲柄回到水平且车轮 ω 连续；40→90 rpm 时每帧曲柄 ω 变化 <5%；挥手时远翼握把、车直行。
- **10 分**：8 分全部满足，另加：落地时轮胎压扁 2–4 u、座弹簧与身体压缩、链条拍打、车筐里的鱼晚半拍弹起；滑行有与画面同步的棘爪滴答声，以及基于 Crr + 风阻（人车约 25 kg）的真实减速曲线（拟合 R² ≥0.98）；30 张连续 60 fps 编号帧 + riderY(t)/bikePitch(t) 与物理参考曲线的叠加图上，找缺陷评审（召回率 ≥80%）0 条被验证的 major。

**测量**：[script] check-rig.mjs 新增 --events：1 ms 采样跳车，拟合 riderY；由 riderY 与 bikePitch（绕 rearContact）计算两个接地点，求离地 / 着地时序；滑行用无头运行的 main.js step() 逻辑驱动；40→90 爬升测 ω 变化；输出 riderY(t)、pitch(t) 与抛物线参考的叠加图 PNG。[judge] 新 shoot 集 mech：close 机位跳车与滑行各 30 张连续 60 fps 编号单帧（RS-dense）+ 叠加图，做找缺陷。

**证据**：docs/eval/dynamics.json；shots/eval/mech/hop-\*.png；shots/eval/dense/hop-\*.png

### D4 鹈鹕：物种与解剖

*Pelican species & anatomy* · **权重 8** · 来源镜头：ORN-1、ORN-2、ORN-3、ORN-4、ORN-5、ORN-7、ORN-8、ORN-11、E2

一只一眼就是大白鹈鹕（Pelecanus onocrotalus）的鸟：野外特征齐全，头—喙—喉囊构造正确，翼、腿、羽毛都按鸟的解剖来画；风格化是少量、刻意、有记录的，并按 styleProfiles.C 的重释执行（七墨、平涂、少网点）。rig 单位 1 u = 3.4 mm，所以对 700c 车轮的真实尺度检查是精确的。解剖数值带服务于可信度；可爱与克制由 C7.7 单独把关，两者冲突时以 C7.7 的盲评为准并在 docs/character.md 中记录取舍。

#### C4.1 物种辨识与野外特征（FM-10） ★

维度内权重 3（占本维度 26%，折合总分 2.09 分）· 测量方式：视觉评审

- **2 分**：读作鹳、白鹭、鹭、鹅、天鹅、鸥或巨嘴鸟；"喉囊"缺失或画成一条粗的第二下喙；≤3 个特征；盲评说出了非鹈鹕。
- **5 分**：读作"鹈鹕"但是泛泛的（可能是美洲白鹈鹕、褐鹈鹕或卷羽鹈鹕）；5–7 个特征，例如没有面部裸皮、没有额羽尖、只有初级飞羽黑或者整个翅膀白、冠羽长在头顶；盲评 ≥2/3 说"鹈鹕"但从未说出种。
- **8 分**：close 机位 1600×900 去文字图下 FM-10（按 styleProfiles.C 重释）中 ≥9 个正确且可辨；盲评 ≥2/3 首先说出"great white pelican / 白鹈鹕"（或以粉脸 + 黄喉囊为据说"white pelican"）；128 px 剪影 3/3 读作鹈鹕；遮头剪影的身体比例不读作鹳 / 鹭（见 C1.3）。
- **10 分**：FM-10 全部（重释后）；3/3 盲评首先说出 P. onocrotalus，且每人引用 ≥4 个特征；只保留骑者的去背景裁图 3/3；64 px 剪影 3/3；特征在 6 个时段、390 px 手机视图、海报、烘焙 SVG 中都保留。若实现了"加州褐鹈鹕繁殖羽"切换，≥4/5 盲评认出褐鹈鹕。

**测量**：[judge] 盲 ID：cam-close 与剪影一律 ?notext=1 渲染，复制到隔离证据包并随机命名（如 img-a91.png），由另一代理确认无可辨认文字；3 名无上下文评审："图中是什么动物、在做什么？如果是鸟，说出种，并列出支持判断的可见特征。"只计首先说出的种；包内混有无喉囊诱饵以检查区分度。[judge] 解剖评审在 3× 头部裁图上逐项勾选 FM-10（按 styleProfiles.C.anchorReinterpretation）：deviceScaleFactor 3，裁剪 #j-head、#j-billUpper、#j-billLower、#j-pouch、#j-crest 的 getBoundingClientRect 并集，tod 0.5 与 0.70，曲柄 0。证据图由 tools/thumb.mjs 与 tools/shoot.mjs --set crops 生成；打包与去文字确认由 tools/judge/pack.mjs 完成。

**证据**：docs/eval/species.json；shots/eval/head3x/\*.png

#### C4.2 头、喙与喉囊的构造

维度内权重 2（占本维度 17%，折合总分 1.39 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：喙短、弯、呈锥形，或像巨嘴鸟一样粗厚；没有 nail；喉囊缺失或是一块漂浮的独立形状；朝前的大卡通眼带睫毛或眉毛；头和身体一样大。
- **5 分**：长喙、nail、黄喉囊都有，但喉囊在嘴角处止步，是一块刚性月牙（草稿 A、B 那种"香蕉形第二下喙"）；下喙和上喙一样粗；虹膜 ≥35% 头高；没有嘴裂线；喉囊抖动时出现缝或脱离下喙支。
- **8 分**：数值带全部满足：喙长 106–138 u（36–47 cm；rig 的 128 u = 43.5 cm，在雄性范围内）；喙/颅长比 2.3–4.0；放松时喉囊深度为喙长的 12–30%；喉囊后缘在嘴角后 ≥15 u（billLower 局部 x ≤ −15），延伸到喉部；虹膜直径 ≤0.28 × 颅高；嘴角与眼中心齐平或在其后；下喙支—喉囊缝 ≤0.5 u；近景下 culmen 脊与 nail 可读。
- **10 分**：8 分全部满足，另加：喉囊以 O 底 + R/K 纹理线表现，纹理随 sy 拉伸；咬合线干净；张嘴铰链正确（主要是下喙下落，上喙只微抬）；额羽尖压在 culmen 基部；表情只来自眼睑形状、嘴裂弧度与冠羽姿态，且是满足 / 愉快的（STYLE-C §3：去掉厚重橙色眼线）；在全部 12 帧与整个吞鱼过程的 3× 下都成立。

**测量**：[script] 新 tools/check-anatomy.mjs --head（?freeze&solo=pelican-body）：读 #j-billUpper、#j-billLower、#j-pouch、#j-head 子元素在 slot 局部坐标的 getBBox 测数值带；通过 renderAt override 强制喉囊 sx∈{0.9,1.1}、sy∈{0.9,1.0,1.2,1.45}，像素扫描下喙支—喉囊缝中的背景像素（允许 0）。[judge] 3× 头部裁图 @ 曲柄 0/90/180/270 与吞鱼 τ=0.3/0.7。

**证据**：docs/eval/anatomy-head.json；shots/eval/head3x/\*.png

#### C4.3 颈部形态与头部稳定（gaze stabilisation）

维度内权重 1（占本维度 9%，折合总分 0.70 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：像天鹅或白鹭那样笔直竖立的管状颈；头随身体刚性上下；喙朝上。
- **5 分**：有一些 S 曲线，但颈是细而均匀的管子、头像鹭一样高举；头跟随 60–100% 的 bob；四处张望是平滑的正弦。
- **8 分**：颈中心线长 110–170 u；颈基宽 ≥1.3× 喉部宽；中段颈宽 ≥0.45× 颅宽（避免鹭 / 鹳式细管颈）；中心线曲率恰好变号一次；喙低于水平 5–35°，喉囊贴着前颈；40/60/90 rpm 下头的世界竖直位移 ≤ 骨盆的 30%（phase-0 为 0.18，保持）；头转角峰峰值 ≤1.5°；张望是 ≤150 ms 的快速转动 + ≥500 ms 停留；落地时头下沉 ≤ 骨盆的 40%。
- **10 分**：8 分全部满足，另加：颈羽顺颈流动并随变形器拉伸；吞鱼隆起沿颈下行；跳车初段头保持世界位置，随后以小过冲追上；头的峰值竖直加速度 ≤ 骨盆的 50%；1440 样本与所有事件中颈轮廓 0 自相交。

**测量**：[script] check-anatomy.mjs --neck（node：import solvePose 与 neckD，1440 曲柄角 × {40,60,90} rpm，hop/wave/gulp 事件 240 Hz）：头与骨盆的世界位移与加速度比、Bézier 曲率变号次数、颈基 / 喉部 / 中段宽度与颅宽之比、neckD 轮廓多边形自相交测试。[judge] frames 00–11（close）与 ev-hop。

**证据**：docs/eval/anatomy-neck.json

#### C4.4 翼的构造与握把（手臂读作翅膀）

维度内权重 1.5（占本维度 13%，折合总分 1.04 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：人的手臂或一根管子，末端是手套或手指状分段；翼尖是白的；肩部断开；两翼同时离开车把。
- **5 分**：一只带黑边的羽毛袖子（STYLE-C 指出的五份草稿共同问题）；初级飞羽是一团黑色包住握把；次级飞羽缺失或是白的；挥手是折叠翼的刚性旋转。
- **8 分**：有宽阔的覆羽基部接入体侧（前翼膜 propatagium）、≥3 排 P 色覆羽、N 色初级与次级飞羽（次级带 P 细边）像流苏垂在臂线下；初级飞羽从腕部向后下方扫，握把处读作羽扇：≥4 枚分开的初级飞羽尖、没有指节状分段；挥手时肘与腕联动展开（Pearson r(肘内角, 腕伸展) ≥0.8）；腕—握把误差 ≤0.5 u；12 帧与挥手全程肘 / 腕处缝 ≤1 u；远翼平涂 B/N 且握在远侧握把上。
- **10 分**：8 分全部满足，另加：挥手时初级飞羽依次展开，收翼时重新叠放；次级飞羽随肘角叠合与展开；小翼羽（alula，鸟真正的"拇指"）拨动车铃；尾缘羽尖随空速增大而颤动；任何帧 3× 下无缝；挥手露出翼下白色覆羽与黑色飞羽的对比。

**测量**：[script] node tools/check-rig.mjs 得手误差；以 120 Hz 采样 wave 事件的 solvePose，由分段角计算肘腕相关。[judge] 翼与握把 3× 裁图 @ 曲柄 0/90/180/270；ev-wave 在 τ=0.3/0.6/0.9/1.2/1.5 s。

**证据**：docs/eval/anatomy-wing.json；shots/eval/wing3x/\*.png

#### C4.5 腿、全蹼足与踏板

维度内权重 1.5（占本维度 13%，折合总分 1.04 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：从腹部中央长出的细棍腿；裸露的橙色"人类膝盖"；脚是橙色三角、人脚或鞋；某些帧里脚离开了踏板。
- **5 分**：羽毛大腿 + 橙色小腿，但向前弯的关节明显裸露，读作穿鸟装的人；三趾鸭掌（palmate，没有第一趾蹼）；刚性平板蹼；极端膝角下膝部有小缝。
- **8 分**：腿从下腹侧伸出；向前弯的关节藏在羽毛"裤管"里（裸皮起点在膝枢轴下 ≥15 u，12 帧都不露膝）；默认姿态下可见裸腿长度 ≤0.75× 身体长度（避免鹳式长裸腿）；跗跖粗壮，宽 9–14 u（3–4.8 cm），3× 下可见 ≥4 道鳞线；全蹼足（totipalmate）：4 趾含内转的第一趾，外趾最长，爪短，足展 45–60 u，蹼垂搭踏板边缘；踏板局部坐标下鞋底间隙 ≤1 u、陷入 ≤2 u；0 次膝翻转；远腿平涂 B/N 并被车架与牙盘正确遮挡。
- **10 分**：8 分全部满足，另加：趾随 ankling 微屈抓握；发力段蹼受压；3× 可见趾垫与鳞；检查模式中的"真鸟腿"解剖图（按 scoring.scale 属于检查模式额外项，至多 +0.5）；README 有解剖注释："腿被加长约 3×（跗跖 134 u vs 真实 13–14.9 cm）才能够到踏板，这是刻意的自由。"

**测量**：[script] node tools/check-rig.mjs；check-anatomy.mjs --feet：在踏板局部坐标下比较足部 bbox 与踏板平台（脚与踏板都按 ankling 角 α 旋转，所以是静态测试）。[judge] 3× 足部裁图 @ 曲柄 0/90/180/270，以及近膝内角最小/最大时的 3× 膝部裁图（由 solvePose 求出对应曲柄角）；frames 00–11 联系表。

**证据**：docs/eval/anatomy-legs.json；shots/eval/foot3x/\*.png

#### C4.6 羽区结构与物种色彩（风格 C 相对色彩约束，所有时段）

维度内权重 1.5（占本维度 13%，折合总分 1.04 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：看不出羽毛，或是像毛发的排线、朝头部的鳞片；翅膀和身体同一纹理；鹈鹕变灰或变褐，或翅膀全白；夜里鸟消失；身体被大面积网点弄灰（草稿 C 的问题）。
- **5 分**：身上均匀撒满扇贝纹或网点，没有羽区、没有大小梯度、覆羽不区分；物种色关系大体对，但某些时段的墨组让白羽发脏，夜间飞羽融进夜空；远侧部件用红点（STYLE-C 明令禁止）。
- **8 分**：羽区（头、背、腹、肩羽、翼覆羽、飞羽、尾、腿部"裤管"）在近景可读，每排向尾部叠压，≥85% 的 data-tract 扇贝线 / 覆羽排方向在所属羽区流向 ±50° 内，≥3 排覆羽，头:体:飞羽羽长约 1 : 2–3 : 5+；styleProfiles.C 的相对色彩约束在 6 个时段的墨组中全部成立（喉囊最饱和的暖色、面皮与喙比羽毛暖、飞羽最暗、羽毛与相邻背景 ΔL\* ≥25、喉囊与喙 ΔL\* ≥8）；身体是骑者身上平均 L\* 最高的区域；夜间比背后天空高 ≥25 L\*；骑者身上网点只出现在允许的窄边缘带内。
- **10 分**：8 分全部满足，另加：羽毛响应气流（迎风面压平、尾缘羽尖翘起、冠羽后飘幅度与速度² 成正比，幅度受 C5.2 上限约束）；朝太阳一侧有 1 道 K/P rim 线且随太阳翻转；逆光时喉囊换用更亮的墨组合；3× 下细节与风格匹配。

**测量**：[script] check-anatomy.mjs --feathers（带 data-tract 的元素在 rider 空间用 getCTM 求主轴，对比该羽区参考流向）与 --colour（src/core/palette.js 在 6 个时段的墨组转 CIELAB，检查 styleProfiles.C 的相对约束；Playwright 在 tods 集上用 getScreenCTM 映射的 6 个 rider 空间点取样：腹、背、初级飞羽、喉囊、面皮、跗跖；另检查骑者 slot 内 `<pattern>` 填充只出现在允许的边缘带 data-ref）。[judge] 3× 颈 / 身 / 翼裁图 @ tod 0.5 与 0.70。

**证据**：docs/eval/anatomy-colour.json；shots/eval/plumage/\*.png

#### C4.7 风格化完整性与真实尺度一致

维度内权重 1（占本维度 9%，折合总分 0.70 分）· 测量方式：自动脚本

- **2 分**：约定混杂（写实的喙配卡通球身）；比例随意；配饰遮住脸或喉囊；烘焙 SVG 丢了部件。
- **5 分**：风格一致，但有几处无动机的变形：巨眼、小喙、大头；护目镜盖住面部裸皮；手机视图里看不清。
- **8 分**：喙 103–138 u；喙尖到尾尖 412–530 u（140–180 cm）；身长 170–260 u；只有腿和眼超出真实尺度 ±30%；配饰对任一特征的遮挡 ≤20%（护目镜在头顶、不盖额羽尖与面皮；围巾不盖喉囊与喉部）；各机位与烘焙 SVG 的构造一致（头部裁图平均绝对差 ≤6/255）。
- **10 分**：8 分全部满足，另加：README"解剖注释"表列出真实与 rig 的尺寸及来源；每个交付物 3× 下构造一致（与草稿的比较见 C7.6 与 C13.1）。

**测量**：[script] check-anatomy.mjs --scale（rider 空间 getBBox）；分别渲染有 / 无配饰层并计数被遮挡的特征像素；check-baked 头部裁图差。

**证据**：docs/eval/anatomy-scale.json

### D5 动画技艺

*Animation craft* · **权重 9** · 来源镜头：ANIM-1、ANIM-2、ANIM-3、ANIM-4、ANIM-10、ORN-9、motion-feel

十二法则层面的动作质量：重量、跟随与重叠、弧线与间距、预备与时值、鸟类特有的运动方式、状态过渡。评审必须看真时间 filmstrip 与洋葱皮，而不是只改 crankDeg 的姿态扫描（phase-0 shoot.mjs 的 frames 集固定 t=2 只改曲柄角，车轮与时间驱动的动作都不前进，不是真正的动作条带）。

#### C5.1 踩踏循环的重量与发力 ★

维度内权重 2（占本维度 20%，折合总分 1.80 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：身体刚性，只平移或不动；只有腿在动；任何速度下姿态都一样。
- **5 分**：有 2× 踏频的 bob，但幅度与相位不取决于哪条腿在发力；40/60/90 rpm 姿态相同；滑行只是冻住曲柄；身体、头、冠、尾、喉囊由同一个全局 cos(2φ) 驱动，整个骑者像一个机械单元。
- **8 分**：骨盆低点位于各腿下踩段（该腿过顶后 90°±30°）；髋向发力腿轻摆 ≤2°，发力段两翼轻拉车把；40→90 rpm 躯干前倾 ≥4°、颈基前移 ≥10 u、冠羽被风压平；滑行时曲柄回到 3/9 点、身体后坐 2–4°、次级飞羽落定；加速时前倾滞后 80–250 ms，刹车时直起。专家会说"正确但略通用"。
- **10 分**：无 HUD 的 2 s 片段，盲评能分辨哪段是冲刺、闲逛、滑行、加速（3/3 全对）；远侧腿的下踩能透过车架读出；重量转移令人信服到"车在响应鸟"。

**测量**：[script] 新 tools/motion-audit.mjs（node，纯 solvePose，240 Hz）：40/60/90 rpm 各 4 圈、滑行、2 s 内 40→90 爬升；报告每条腿下踩对应的骨盆低点相位（90±30° 通过）、各踏频的躯干俯仰与颈基 x（Δ ≥4° 且 ≥10 u）、前倾滞后（80–250 ms）、滑行腿角（距水平 ≤10°）。[judge] 新 tools/filmstrip.mjs（Playwright，真时间 t0+i/60，绝不用 crankDeg 覆盖）：40/60/90 rpm 与滑行各 2 s，close 机位 + 传动近景，以 RS-dense 形式交付（30 张连续 60 fps 编号单帧 + 骨盆 y 与躯干俯仰随曲柄角的曲线图）；3 名盲评按速度排序并挑出滑行，3/3 全对才通过。

**证据**：docs/eval/motion-audit.json；shots/eval/filmstrip/cycle-\*.png

#### C5.2 跟随、重叠动作与拖曳 ★

维度内权重 2（占本维度 20%，折合总分 1.80 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：次级部件静止，或按与身体无关的 sin(t) 晃动；落地没有反应；一个"贴纸"身体配上会动的腿（不是贴纸：喉囊、冠、尾、头都要有相对父级非零的滞后）。
- **5 分**：有弹簧但顺序错或锁相（phase-0 实测：冠羽峰值在曲柄相位 12°，而它的父级头在 49.5°——子级领先父级；冠羽与喉囊锁相，读作一块刚体）；或者反过来弹簧过度：冠、尾、围巾、喉囊像果冻一样晃，每次沉降过冲 ≥3 次。
- **8 分**：父→子滞后单调增加（pelvis → neck → head → crest/bill → pouch）；冠羽、喉囊、尾、围巾两两峰值相位差 ≥20°；多段部件（冠、围巾）尖端幅度 ≥1.5× 根部；各部件固有频率不同；落地、滑行开始、90→40 rpm 突变后，包络在 0.4–1.5 s 内降到峰值的 10% 以下，且有 1–2 次可见过冲（不多于 2 次）；幅度上限：巡航时冠羽 ≤±12°、尾 ≤±6°、喉囊 sy ≤±8%、围巾尖端 ≤±25°；全部次级部件的 RMS 角速度之和 ≤ 近腿链 RMS 角速度的 35%；风致颤动与速度挂钩。
- **10 分**：8 分全部满足，另加：多段拖曳呈现从根到尖传播的波；一道阵风自右向左穿过场景，按 x 位置依次打到棕榈、海面闪光、围巾、冠羽、初级飞羽（一个原因，多个效果，按屏幕 x 的到达时间单调）；RS-dense 密集帧与角度—时间曲线上，找缺陷评审（召回率 ≥80%）0 条被验证的 major（果冻感、锁相、弹出）。

**测量**：[script] motion-audit.mjs 相位滞后表：4 圈 × 40/60/90 rpm，把每个次级部件的角 / 缩放与父级世界空间加速度做互相关；沉降测试（land 事件、滑行开始、90→40 rpm 突变），统计过冲次数；幅度上限与次级 / 主运动能量比；阵风到达时间对屏幕 x 的单调性。[judge] 新 tools/onion.mjs：close 机位 12 帧洋葱皮（20% 不透明度），头—冠—喉囊一组、尾一组；另给 RS-dense（30 张连续 60 fps 编号单帧 + 每个部件的角度—时间曲线），视觉评审判断拖曳与过度弹簧。R-final 由用户看 webm 对动作手感签字（G16）。

**证据**：docs/eval/motion-audit.json；shots/eval/onion/\*.png；shots/eval/dense/secondary-\*.png

#### C5.3 弧线、间距与连续性（事件可叠加、可打断、无跳变）

维度内权重 2（占本维度 20%，折合总分 1.80 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：事件开始或结束时可见跳变、姿态瞬切、手瞬移回握把、循环回绕时有杂帧；线性 tween。
- **5 分**：单个事件平滑，但叠加或被打断时跳变；有机部件走直线（例如吞鱼时头绕单一固定枢轴旋转，喙尖画圆）；只是普通的 sine in/out。
- **8 分**：种子 fuzz 0 失败；每个表演节拍都有 slow-in/slow-out；7 个关键点（喙尖、冠尖、尾尖、近膝、挥手时的近腕、头心、喉囊底）轨迹平滑无折角、无锯齿、无直线；事件边界角速度连续（相邻 240 Hz 样本间 Δω ≤40°/s、线速度变化 ≤60 u/s，已标注的冲击窗口如落地除外）。间距偶有轻微不均。
- **10 分**：弧线是设计过的形状（挥手手部是干净的弧或 8 字，吞鱼时头走弧线，抛鱼是抛物线）；实测间距与 docs/timing.md 中的间距图误差 ≤10%；任意事件的任意组合都无缝混合。

**测量**：[script] motion-audit.mjs --fuzz：300 条种子随机 12 s 日程（bell、wave、hop、gulp、coast 开关、踏频跳变、机位切换），240 Hz；对每个非旋转 slot，出现单样本角变化 >3°、位移 >2 u、加速度尖峰 >该 slot 99.5 分位的 6×、或事件边界速度不连续（Δv >4× 中位 |Δv|）即 FAIL。[judge] onion.mjs --arcs：在冻结帧上画 7 个关键点的 120 样本折线（每个事件一张 + 基础循环一张），评审检查折角、锯齿与直线运动。[script] 间距对照 docs/timing.md 逐拍图表，误差 ≤10%。

**证据**：docs/eval/fuzz.json；shots/eval/arcs/\*.png

#### C5.4 表演节拍：预备、时值、挤压拉伸与交代（X-sheet）

维度内权重 2（占本维度 20%，折合总分 1.80 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：事件是姿态切换或一个正弦鼓包，没有预备也没有沉降；wide 机位下看不出发生了什么。
- **5 分**：跳车有蹲伏，其余事件都没有预备；挥手只是一只翼抬起，车把冻结不动、没有任何补偿；身体挤压只有 sy（0.96）而 sx=1，损失约 4% 体积。
- **8 分**：docs/timing.md 为每个事件给出 60 fps 帧数时值表（预备、动作、跟随、沉降），实测在 ±2 帧内：铃——拇指（alula）蓄 4–6 帧、2 帧弹出，点头眯眼，声音落在击打帧；挥手——远翼接管转向、车把转 1–3° 并微晃，近翼先沉再离开，飞羽颤动，头转向镜头，回到握把时有小过冲；跳车——蹲伏 ≥8 帧，挤压保体积（sx·sy ∈[0.95,1.05]）；在 ?nofx=1 的 2 s 密集帧序列中，6 个事件（bell、wave、hop、gulp、coast 开始、踏频突变）中 ≥5 个被盲评正确命名（符号叠加不给分）。
- **10 分**：8 分全部满足，另加：每个节拍都带有具体的表演选择；每个表演选择在"有 / 无该选择"的 A/B 片段对比中被 ≥5 名盲评中 ≥60% 偏好，且 0 次被标为"分散注意"；6/6 事件在 nofx 下被命名。

**测量**：[script] motion-audit.mjs --events：从姿态曲线提取节拍时刻（预备起点、极点、接触、过冲、沉降）并与 docs/timing.md 比对（±2 帧）；体积检查 sx·sy ∈[0.95,1.05]（文档化的吞鱼隆起除外）。[judge] filmstrip.mjs：每个事件 2 s @ 60 fps 的密集帧（?nofx=1，close 与 wide），盲评逐事件命名；A/B 片段由 renderAt 加 ?ablate=`<choice>` 生成。

**证据**：docs/timing.md；docs/eval/events.json；shots/eval/filmstrip/ev-\*.png

#### C5.5 鸟类运动词汇（像鸟在动，而不是穿鸟装的人）

维度内权重 1.5（占本维度 15%，折合总分 1.35 分）· 测量方式：自动脚本 + 代码审查 + 视觉评审

- **2 分**：鸟是刚体；用人类竖直眼睑加睫毛眨眼；喉囊不动；没有次级动作。
- **5 分**：通用弹簧让喉囊和冠羽晃动；眨眼是竖直 sy 挤压（phase-0 做法，这是人的眨眼方式）；每 3.7 s 一次、像节拍器；转头是平滑正弦。
- **8 分**：瞬膜眨眼：半透明第三眼睑自前向后水平扫过，100–200 ms，间隔 3–8 s 且在实时模式下非周期；60 rpm 时喉囊抖动滞后骨盆 bob 30–120°、巡航幅度 3–8%，落地后 ≤15% 并在 0.8 s 内衰减到 <2%；冠羽偏转随速度单调增大；视线是扫视式（saccade）。
- **10 分**：8 分全部满足，另加（按可见性规则计入）：只在正午出现喉部颤振（gular flutter，4–6 Hz、≤3%，真实的散热行为）；落地后抖羽（rouse）；每分钟 15–30 次、1–2% 体积的呼吸；滑行时的喉囊伸展 idle；这些在烘焙循环中都保持精确周期。

**测量**：[script] 采样 solvePose：喉囊 sy 与 pelvisDy 的互相关求滞后；land 事件后的冲激衰减；40/60/90 rpm 下冠羽角。[code-review] src/rig/solve.js 与 src/art/pelican-body.js 中的眨眼实现。[judge] 在一次眨眼附近用 renderAt 以 t += 1/60 渲染 60 帧，用 tools/sheet.mjs 拼成条带，判断扫过方向。

**证据**：docs/eval/avian-motion.json；shots/eval/blink-strip.png

#### C5.6 状态过渡、smear 与播放质感

维度内权重 0.5（占本维度 5%，折合总分 0.45 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：机位、时段切换瞬切；UI 过渡全是默认 'ease 300ms' 或干脆没有；掉帧会改变动作本身。
- **5 分**：事件有缓动但机械；时段按钮让调色板跳变，踏频跳变；冲刺时辐条频闪。
- **8 分**：机位切换临界阻尼（过冲 ≤2%，0.6–1.2 s 沉降）；时段切换动画 ≥600 ms；UI 过渡用自定义曲线、120–400 ms，从不 linear；速度变化经身体传递（头与喉囊滞后 100–200 ms）；按 24 帧采样动作依旧读得通。
- **10 分**：高速动作有刻意的 smear / multiples 帧（铃弹、挥手快段、抛鱼，各 1–2 帧，只在速度够时插入，按风格 C 以印刷墨绘制），冲刺时有干笔速度线；在 6 条事件的 RS-dense 密集帧上，找缺陷评审（召回率 ≥80%）0 条被验证的 major（弹出、跳帧、过渡生硬）。

**测量**：[script] 记录 ui:camera 之后 2 s 的 camera.update，计算过冲与沉降；列出 src/ui 中每个 transition/animation 的 timing-function 与时长；smear 帧的插入条件（角速度阈值）由 motion-audit 验证。[judge] onion 与 smear 帧裁图、RS-dense 密集帧上的找缺陷。机位曲线由 tools/motion-audit.mjs --camera 记录。

**证据**：docs/eval/transitions.json；shots/eval/dense/smear-\*.png

### D6 角色表演与叙事

*Character, acting & story* · **权重 8** · 来源镜头：ANIM-5、ANIM-8、E4、ORN-10、ORN-12、character-acting

这只鹈鹕是表演者，不是提线木偶：它有能被说出来的、有辨识度的个性、有视线与表情、事件是能读懂的笑点，烘焙循环是一个会让人看三遍的微短片。幽默来自鸟的行为，而不是道具：可读性一律在 ?nofx=1（去掉符号叠加）下测。

#### C6.1 角色圣经与可被说出的个性 ★

维度内权重 2（占本维度 20%，折合总分 1.60 分）· 测量方式：代码审查 + 视觉评审

- **2 分**：通用吉祥物：死盯的眼神、节拍器式眨眼、全程一个表情；点它每次都是同一个反应。
- **5 分**：设计很可爱，但没有表演；个性只有"可爱"，没有想要的东西，也没有态度；每次触发的反应都一样。
- **8 分**：docs/character.md 写明名字、年龄、气质、三个形容词（不得使用 6 个通用卡通默认词：开心、可爱、快乐、好奇、友好、爱玩 / cheerful、cute、happy、curious、friendly、playful）、它在这个循环里想要什么、它怎么骑车，每个表演选择都能追溯到它；情境反应按质量而不是数量计分：每种反应做 before/peak/after 三联图，盲评质量中位 ≥7（按固定清单：是否在角色内、是否有预备与沉降、是否复用了别的动作）；15 选 3 形容词测试中，3 名盲评选中圣经形容词的比例显著高于随机（≥2/3 的评审至少选中 2 个）。
- **10 分**：8 分全部满足，另加：15 选 3 测试中圣经形容词命中率 ≥67%（随机为 20%），并且从不选中"通用默认词"的评审 ≥2/3；反应有种子变体、从不连续两次完全相同；圣经与表演没有矛盾（例如"端庄"的鸟在挥手时不会乱扑腾）；4 个精做的反应胜过 8 个单薄的反应（每种反应三联图质量中位 ≥8）。

**测量**：[code-review] docs/character.md 对照 rig 的事件与视线实现。[judge] 3 名无项目上下文的评审看 60 fps 事件密集帧（?nofx=1）与 16 帧故事条带，从 15 个形容词中选 3 个：圣经的 3 个 + 6 个通用卡通默认词 + 6 个有辨识度的干扰词（顺序随机），并说出它想要什么；反应三联图由 tools/judge/acting.mjs 生成。

**证据**：docs/character.md；docs/eval/judges/character-\*.json；docs/eval/reactions.json

#### C6.2 视线系统与面部表演

维度内权重 1.5（占本维度 15%，折合总分 1.20 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：眼睛是一个带高光的点，形状从不变化（没有眼睑、没有眉羽）；头转而眼睛锁定前方（死头）。
- **5 分**：除眨眼外没有任何面部变化；头从不看向任何东西；固定 3.7 s 眨眼周期，10 秒内就被看出是机械的。
- **8 分**：分层打破（successive breaking）：眼先于头 50–150 ms，头先于颈；有视线目标：过路的鸥、鱼摊、海面闪光、挥手时的镜头、靠近的光标；眨眼不规则（间隔 2–6 s、变异系数 ≥0.3、10–20% 是双眨、每次 >15° 转头都伴随一次眨眼）；眼睑、眉羽与面皮形状组合出 ≥4 种与状态绑定的表情（巡航满足、冲刺专注、跳车起跳吃惊、吞鱼愉悦），表情表中 ≥3/4 被评审正确命名。
- **10 分**：8 分全部满足，另加（按可见性规则计入）：挥手时有一次打破第四面墙的看镜头；夜间灯塔光束扫过时眯眼；所有反应三联图 100% 保持 on-model（找缺陷评审 0 条被验证的走形）。

**测量**：[script] motion-audit.mjs --face（运行 120 s）：眨眼间隔变异系数、双眨率、眨眼与转头重合率；脚本化张望中的眼→头、头→颈领先时间（50–150 ms 通过）；需要 pose.gaze 字段（契约请求）。[judge] 头部 zoom 4 的表情表（每种状态一张）；新 tools/judge/acting.mjs 生成的 before/peak/after 反应三联图。

**证据**：docs/eval/face.json；shots/eval/expressions.png；shots/eval/acting/\*.png

#### C6.3 事件笑点在无字幕条带中可读 ★

维度内权重 2（占本维度 20%，折合总分 1.60 分）· 测量方式：视觉评审 + 自动脚本

- **2 分**：一只静止的鸟在一辆动的车上，或四肢僵硬、没有次级动作（人体模型）。
- **5 分**：踩踏读得出，有 bob 和眨眼，但事件机械（线性、无预备、无过冲），表情固定；或笑点只靠符号叠加（音符、爱心、"ding"字），去掉之后读不出来。
- **8 分**：在 ?nofx=1 的 2 s 密集帧序列中，≥5/6 个角色节拍各被 ≥4/5 评审正确描述（描述与意图一致才算读懂）；在"这 4 段片段里你最想看哪一段"的强制选择中（我们 + 3 个强对照：同模型同工具的匹配投入基线、所选草稿做成的动画、上一轮版本），我们被选中 ≥50%；0 条被验证的"诡异 / 机器人 / 弹出"标记。
- **10 分**：≥6 个节拍在 nofx 下被 ≥4/5 清楚读懂；"这 4 段里你会分享哪一段"的强制选择中我们 ≥60%；0 条"诡异 / 机器人 / 弹出"标记；笑点的有 / 无 A/B 中被偏好 ≥60%。

**测量**：[judge] 扩展 shoot.mjs --set events：每个事件 2 s @ 60 fps 的密集帧（?nofx=1&notext=1）+ 12 帧 4 s idle 条带 + 滑行条带。5 名盲评（隔离证据包）拿到无字幕材料，回答：(1) 描述每段里角色在做什么；(2) 强制选择：4 段片段中最想看 / 会分享哪一段（左右与顺序随机）；(3) 标出任何诡异、机器人或弹出的地方。不使用 1–10 好感分或"会分享吗"的是 / 否题。[script] 新 tools/check-temporal.mjs 读取 solvePose 姿态曲线：每个事件预备 ≥80 ms 并以阻尼过冲沉降；事件起止处关节角速度阶跃 ≤30°/s，且不超过其中位数的 4×。

**证据**：shots/eval/dense/ev-\*.png；docs/eval/judges/gags-\*.json；docs/eval/temporal.json

#### C6.4 吞鱼：符合生物学的完整进食序列

维度内权重 1.5（占本维度 15%，折合总分 1.20 分）· 测量方式：视觉评审 + 自动脚本 + 代码审查

- **2 分**：什么都没发生，或者鱼瞬移；头往下低；鱼尾巴先下肚。
- **5 分**：头后仰 ≤30°、喉囊鼓起，但鱼没有从车筐转移、颈部没有隆起。phase-0：头只转 −28°，而喙静息时已下垂 14°，所以喙最终只高出水平约 14°。
- **8 分**：完整序列：喙伸进车筐（喙尖在 x 140–222、y −292…−226）→ 舀起 → 头缓缓抬起、上下喙微张沥水 → 鱼在囊内调成头朝前 → 头甩到喙高于水平 ≥45°（理想 60–80°）→ 隆起沿颈下行 0.3–0.6 s → 喉囊回弹并过冲 → 满足地安定下来；鱼像真实猎物（鲻鱼或罗非鱼：叉尾、背鳍与臀鳍、鳃盖、银色，60–90 u 长），不是顶上长眼睛的卡通团。
- **10 分**：8 分全部满足，另加：沥水时水珠从喙两侧流下；逆光的喉囊里能看到鱼的剪影（头朝喉咙）；之后甩头或抖羽；车筐里少了一条鱼（烘焙循环中鱼数守恒以保证闭合）；全程从容，约 1.5–2.5 s，并放进 24 s 循环的节拍表内。

**测量**：[judge] ev-gulp 在 τ = 0.2/0.4/0.6/0.8/1.0/1.2/1.6 s 的 close 机位帧。[script] solvePose 时间序列：喙尖世界位置与喙俯仰角，以及颈宽参数峰值沿颈的位置随时间变化。[code-review] 鱼的画法。时间序列由 tools/motion-audit.mjs --events 输出，帧由 tools/filmstrip.mjs 渲染。

**证据**：shots/eval/gulp/\*.png；docs/eval/gulp.json

#### C6.5 循环叙事、入场与自动导演

维度内权重 2（占本维度 20%，折合总分 1.60 分）· 测量方式：自动脚本 + 视觉评审 + 代码审查

- **2 分**：1 秒踩踏循环无限重复，回绕处可见跳变或漂移。
- **5 分**：无缝的 4 s 纯踩踏循环；事件只在用户输入时发生；没有入场。
- **8 分**：烘焙 SVG 是 T = 24 s（24 整曲柄圈）的故事循环，docs/beats.md 给出节拍表：铺垫 → 发展 → 回报 → 精确回到起始状态，≤5 个主要节拍，节拍之间有 1–3 s 的安静巡航，回绕无缝；实时页面有 idle 自动导演：90 s 无输入时触发 5–15 个节拍、最长间隔 ≤12 s、同一节拍不连续出现；前 3 s 是入场（原地起步或骑入画面），与标题卡同步。
- **10 分**：循环是一部真正的微短片，有铺垫、笑点和回报：盲评在不看节拍表的情况下按顺序复述 ≥4/5 个节拍，并在"4 个循环中最想再看一遍哪个"的强制选择中选我们 ≥60%；最后一帧精确落在第一帧上；照搬创意简报里的示例不获得新颖分（新颖由 C8.1 的盲评判断）。

**测量**：[script] tools/loop-seam.mjs（与 C11.2 共用）；断言 T = 24 s、节拍数 ≤5、节拍间安静段 1–3 s；新 tools/interact.mjs --idle：dist 页面 90 s 无输入，记录 bus rig:event（5–15 个节拍、最长间隔 ≤12 s、无背靠背重复）。[judge] 16 帧故事条带（每 T/16 一帧，?notext=1）交给盲评，按顺序复述节拍；强制选择对照为匹配投入基线的循环与所选草稿做成的动画；前 3 s filmstrip 评入场。[code-review] docs/beats.md 对照烘焙 SVG 中的事件日程；所有时间驱动的眨眼与张望在 T 内精确周期。

**证据**：docs/beats.md；docs/eval/idle.json；shots/eval/story16.png

#### C6.6 配角：鸥、鱼与鹈鹕编队

维度内权重 1（占本维度 10%，折合总分 0.80 分）· 测量方式：视觉评审 + 代码审查

- **2 分**：'M' 字形或蝙蝠形状；对称的正弦扑翼、没有滑翔；卡通团状鱼；护航的鸟按麻雀的比例缩放在 1.5 m 的鹈鹕旁边。
- **5 分**：能认出是鸥，但全部同步扑翼，近看没有腕部弯折。
- **8 分**：物种可信的鸥：白灰身体、带白色 mirror 的黑翼尖、黄喙、翼在腕部弯折成 M 形；2.5–4 Hz 扑翼夹带滑翔、相位各异、头部稳定；鱼的鳍正确。
- **10 分**：物种契合海岸（例如东亚海岸的黑尾鸥 Larus crassirostris）；一队大白鹈鹕以 0.1–0.2 s 的逐只扑翼相位延迟低掠海面、利用地面效应滑翔（致敬 Weimerskirch et al. 2001, Nature，其编队飞行节能研究正是用的这个物种），骑者以扫视抬眼看它们。

**测量**：[judge] L-gulls-far 与 fx 鸥群护航的裁图（renderAt cadence 90 触发护航）；用 tools/sheet.mjs 拼一只鸥的 12 帧条带。[code-review] 扑翼与编队代码。

**证据**：shots/eval/gulls/\*.png

### D7 艺术指导、风格 C 保真、光影与镜头

*Art direction, style-C fidelity, light & camera* · **权重 10** · 来源镜头：E5、E8、cold-open、art-direction-cohesion、cinematic-light、ANIM-9、finish-polish、ORN-8

打开链接的前 3 秒就是成品；每一个像素都说风格 C 的语言（七墨丝网印刷海报）；光有动机；镜头有语法；放大 3× 仍然是完成的插画；角色有吸引力，画面有克制。成品必须忠于用户选中的草稿（同一个角色、同一种风格），同时修掉 STYLE-C 列出的问题，并在细节上远超草稿（细节量由 D13 计分，这里计身份、风格与观感）。

#### C7.1 开场 3–5 秒（cold open 与钩子） ★

维度内权重 2（占本维度 14%，折合总分 1.43 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：加载时白闪或黑闪、spinner、无样式 UI，或 >1 s 空白/占位；第一眼看到的是控制面板或默认字体标题；骑者被裁或被 UI 盖住；页面以未打光的暂停帧打开；有可见的控制台错误。
- **5 分**：1 s 内完整出现并开始踩踏，但首帧平庸：骑者小或偏离中心，UI 与画面同时出现并喧宾夺主，标题盖住鸟，或手机视图裁掉车轮（phase-0 的 mobile-portrait.png：后轮与尾巴被切掉，上半屏是空天）；只有一个通用的标题淡入淡出。
- **8 分**：4× CPU 节流下含骑者的首帧 ≤500 ms，100 ms 截图已是风格 C 墨组内的颜色（无闪）；2–4 s 编排好的构建（图层按深度像印版一样到场，或骑者骑入画面）+ 风格 C 的 PELICAN BAY / 鹈鹕湾标题卡约 3 s 后缩为小标或隐藏，从不遮住鸟；≤3 s 进入稳定踏频；UI 在画面之后 ≥800 ms 淡入，占视口 ≤12%、与骑者 bbox 重叠 0 px；任意按键或点击 1 帧内跳过开场；回放像素一致；在"哪一个开场 3 s 更好"的强制选择中，成品（hero 为默认首屏）对草稿关键帧的同构图静帧版本 ≥4/5，对匹配投入基线 ≥3/5。以上都在 reducedMotion no-preference 下测；减少动态的首屏另按 C9.6 测。
- **10 分**：首帧 ≤300 ms、CLS 0，首次绘制后没有任何一帧缺少骑者；开场 1.5 s 内有一个钩子节拍，3 名盲评中 ≥2 名在开放式回忆中主动提到它（不提示）；开场到循环的衔接 C1 连续（机位速度与踏频）；390×844、844×390、720×800 各有专门构图；强制选择中对草稿 5/5、对匹配投入基线 ≥4/5。

**测量**：[script] 新 tools/first-look.mjs：全新 Chromium context + CDP Emulation.setCPUThrottlingRate(4)；以 file:// 直接打开 dist/index.html，并在 sandbox="allow-scripts" 的 iframe 包装中打开（模拟 Artifact）；视口 1600×900、1280×720、720×800、390×844、844×390；在 0/100/300/500/1000/3000 ms 截图；记录 PerformanceObserver paint 与 layout-shift；计算 #L-rider getBoundingClientRect 与 #ui 控件矩形并集的交集、UI 视口占比、骑者是否在视口内且留 ≥3% 边距；像素标准差 <4 或均色落在风格 C 墨组凸包外的帧判为"闪"；用 renderAt(t,{intro:true}) 每 0.25 s 渲染 0–5 s 共 21 帧的确定性开场表；在 0.5 s 按键，断言下一个 rAF 开场已结束。[judge] 5 名盲评（隔离证据包，notext 版与原版各一组）：3 s 条带之间的强制选择（成品 / 草稿同构图 / 匹配投入基线，左右随机），以及"你记得开场里发生了什么"的开放式回忆。不使用 1–10 绝对分。

**证据**：docs/eval/first-look.json；shots/eval/first-look/\*.png；shots/eval/intro-21.png

#### C7.2 统一的艺术指导：跨模块、跨时段、UI 与 fx 同一语言 ★

维度内权重 2（占本维度 14%，折合总分 1.43 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：各模块像是不同的人画的；UI 是通用的玻璃面板；某些时段配色冲突；夜里骑者消失；fx 是灰色尘圈与白色速度线这类通用默认。
- **5 分**：场景符合风格 C，但 UI、标题、夜间配色、fx 中至少两项退回了通用默认；夜晚只是白天海报叠了一层暗色（STYLE-C 明确要求的是"夜间海报"而不是暗化的白天）。
- **8 分**：6 个时段的每一帧都只用该时段的 7 墨（k-means k=10，面积 >1% 的簇到最近墨的 ΔE2000 ≤6，量化光晕环除外）；UI chrome、焦点环、favicon、标题字形都是风格 C（deco 大写、七墨、平涂），并随时段换墨（面板背景 / 边框在 tod 0.5 与 0.93 下不同，且可回溯到 --pb-\* 变量）；fx 以印刷墨绘制；夜间墨组是完整的 7 墨海报；找缺陷评审（召回率 ≥80%）在 30 张网格中 0 条被验证的"脱离风格"major。
- **10 分**：8 分全部满足，另加：在种子化野卡包（definitions.sampling）的 20 张随机帧中，每一张都能被评审选为"可以直接印成海报"的比例 ≥90%（与 3 张草稿衍生帧混排，逐张判定）；粒子与 fx 也按风格绘制；0 个脱离模型的元素。

**测量**：[script] 新 tools/judge/palette.mjs：在页内 canvas 上对 hero + 6 个时段 + 野卡包渲染做 k-means（k=10），对照 docs/eval/ink-sets.json 输出色板条，标出 ΔE2000 >6 的簇；UI 变量回溯审计（getComputedStyle）。[judge] 并排裁图：UI 对场景、黎明对黄金时刻、夜间海报；30 张（6 视口 × 5 时段）网格与野卡包逐张判定（单图、标注像素比例，不用缩小的大拼图做细节判断）。

**证据**：docs/eval/palette.json；shots/eval/grid-30/\*.png；shots/eval/wild/\*.png

#### C7.3 光影与昼夜：有动机的光

维度内权重 2（占本维度 14%，折合总分 1.43 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：时段只是一层平涂色调；夜里骑者融进暗海；太阳位置与 rim light、阴影毫无关系。
- **5 分**：有夜晚、路灯和灯塔光束，但光只是染色；白羽在正午或夜间被 grade 弄脏；阴影方向固定不变。
- **8 分**：受光侧 rim 线与接触阴影方向随太阳翻转（黎明太阳在左、黄金时刻在右）；阴影长度随太阳高度变化；经过的路灯会扫亮骑者（rim 与路面光池——量化成 2–3 圈硬边环——与视差偏移同步）；灯塔光束扫过画面；海面光路追踪日或月；夜间车灯在路面形成量化光池；黄昏时星星按星等依次浮现；6 个时段骑者显著性比 ≥1.3（骑者 bbox 内局部亮度与色度对比 / 画面其余部分）。
- **10 分**：8 分全部满足，另加表演级的光影时刻：逆光时喉囊换用更亮的墨组合并透出鱼影；灯塔光束短暂给鹈鹕打上 rim；时段过渡没有光栅尖峰也没有跳变；在"这 4 张夜景中哪张最好"的排序中（我们 + 草稿墨组直接暗化版 + 匹配投入基线夜景 + 上一轮版本），5 名盲评中 ≥4 名把我们排第一。

**测量**：[script] 新 tools/judge/saliency.mjs：wide 机位，骑者 bbox，对 6 个时段计算显著性比；对 dawn 与 golden 判断 rim 像素所在侧与阴影方向；检查光晕是否量化（每个光晕 ≤3 个不同墨环）。[judge] 6 个时段的 hero 与 close、夜间路灯经过时的 RS-dense 帧；夜景 4 选排序（notext）。

**证据**：docs/eval/saliency.json；shots/eval/tods/\*.png

#### C7.4 镜头语言与构图

维度内权重 2（占本维度 14%，折合总分 1.43 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：静态居中构图；移动端视图裁掉骑者；三种机位只是三档缩放。
- **5 分**：close 机位在膝盖或踏板处裁切；地平线正好横穿画面中部却没有构图理由，或穿过头部；桌面默认视图里骑者太小（bbox 高度 <40% 视口），细节只在 close 机位里看得见；电影机位的正弦漂移无视剧情，吞鱼时镜头在乱晃。
- **8 分**：每个机位有职责：wide 交代地点与速度，close 承载表演，cinematic 带个性地跟随；桌面默认视图（1280×720 与 1600×900）骑者 bbox 高度 ≥50% 视口高（否则 C4.x 与 C7.5 改用默认机位评分）；前方留白 ≥55%（喙前空白 / 水平总空白）；地平线按 styleProfiles.C.horizon 执行，并且从不穿过头部（屏幕上距眼 ≥20 px）；close 的裁切线距膝、踝、腕、颈基 ≥15 u，并包含喙、喉囊和手；cinematic 在 40→90 rpm 爬升时滞后 100–300 ms、至多一次 ≤2% 的过冲；wide、cinematic 和 390×844 下 100% 帧里骑者 bbox 在 5% 安全区内；有一个能看清脚踏接触的传动近景。
- **10 分**：有镜头语法的电影模式（60–90 s，按 晨 / 午 / 暮 / 夜 分章）：剪切落在动作上，letterbox（海报边框）滑入滑出；除列出的剪切外机位路径 C1 连续；每 12 s 内至少一个新节拍；种子化野卡包中随机抽出的任何一帧都通过构图检查（安全区、留白、地平线不穿头、无切边）；在电影联系表与匹配投入基线的强制选择中 ≥4/5 选我们。

**测量**：[script] contact-probe.mjs 同时导出喙尖、尾尖、冠、头与两胎的屏幕 bbox，从 60 fps 采样中检查安全区、留白比、地平线位置、close 裁切距离、桌面默认视图骑者高度比、机位切换的缩放 / 焦点曲线（至多一次 ≤2% 过冲后单调）、cinematic 跟随滞后。新 tools/judge/film.mjs：以 30 fps 确定性渲染 90 s 电影模式，输出每 2 s 一帧的 45 帧联系表（只用于序列判断）与 bus 节拍日志，计算新节拍最大间隔、剪切表以外的机位路径二阶导尖峰。[judge] cams 集、mobile 集、10 s cinematic 密集帧，判断镜头动机；电影联系表强制选择。

**证据**：docs/eval/camera.json；shots/eval/film-45.png

#### C7.5 对抗式放大下的完成度（3×、接缝、边缘、切线）

维度内权重 2（占本维度 14%，折合总分 1.43 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：肢体与身体、管与管之间有可见缝隙；3× 下脚悬浮在踏板上方；形状在画布边缘被截断。
- **5 分**：1× 下没问题，但 3× 裁图显示 ≥5 处缺陷：某些相位腿段之间有缝、链条没坐在齿上、背景平铺接缝可见、曲线呈多边形、机位滚转露出图层边缘。
- **8 分**：约 45 张 3× 裁图（9 个区域：后花鼓 + 飞轮、BB + 牙盘、前花鼓、近握把 + 翼手、车座 / 骨盆接触、近足 + 踏板、远足、喙尖 / nail、喉囊 / 喉部，各 4 个种子化相位，外加跳车顶点、挥手峰值、吞鱼隆起）合计被验证的缺陷 ≤2 处且都是 minor、0 处 major/blocker（评审召回率 ≥80%）；0 处平铺接缝；0 次边缘暴露；0 个 NaN。
- **10 分**：2 名独立对抗评审在植入缺陷召回率 ≥80% 的前提下 0 个被验证的缺陷；在 DPR 1/2/3 与 4K 下都成立（细节密度另由 D13 计分）。

**测量**：[script] 新 shoot.mjs --set crops（deviceScaleFactor 3）；新 tools/judge/seams.mjs：在每个 TILE.\* 边界两侧（距离 = k·TILE ± 0.5 u）渲染，若某一像素列与相邻列均值差 >12 且覆盖该层高度 >30%，标为发丝缝；新 tools/judge/edges.mjs：wide/close/cinematic 在 t = 0–32 s 每 0.25 s 一帧，加上缩放上限 1.45 与 ±0.6° 滚转，检查 3 px 边框条是否露出页面背景或透明（letterbox 以外），阈值 0 帧。[judge] 2 名对抗评审（"至少找出 5 个缺陷"），第 3 个代理逐条裁定有效或无效，只计有效缺陷。

**证据**：shots/eval/crops/\*.png；docs/eval/zoom-defects.json；docs/eval/seams-edges.json

#### C7.6 风格 C 保真与对所选草稿的忠实 ★

维度内权重 2（占本维度 14%，折合总分 1.43 分）· 测量方式：自动脚本 + 视觉评审 + 代码审查

- **2 分**：成品看不出是用户选的那张海报：换了风格（渐变、写实阴影、滤镜）或换了角色（比例、脸、配色都不同）；或者还带着 STYLE-C 点名的问题：凶的眼线、袖子式翅膀、被网点弄灰的身体、远腿红点。
- **5 分**：风格与角色大体保留，但违反 STYLE-C 的规则 ≥3 条（例如：非七墨表面、未量化的渐变、旋转件上有网点、全屏滤镜、文字没转路径、标题遮住骑者），或 STYLE-C §3 的角色修正只做了一半。
- **8 分**：check-style 0 违规：每个可见表面属于当时段 7 墨或"墨上墨"网点；渐变只出现在量化成 2–3 圈的夜间光晕；网点只在静态 / 缓动层（旋转与变形 slot 内 0 个 `<pattern>` 填充）；骑者身上无大面积网点；远侧部件平涂 B/N；0 个全屏 filter 或 mix-blend-mode；全部文字是路径；海报边框与标题卡行为符合 STYLE-C §4–5。STYLE-C §3 的 5 项角色修正全部在 3× 头部 / 翼 / 腿裁图中成立。盲评成对测试"是否同一个角色、同一种风格？"（成品 vs 草稿同构图帧，notext）≥4/5 答是；用户的每一条风格备注（STYLE.userNotes）都有证据路径。
- **10 分**：8 分全部满足，另加：在"哪一张更像一张真正的 WPA / art-deco 丝网旅行海报"的强制选择中，成品同构图帧对草稿 ≥4/5；套印错位等印刷手法（若使用）在静态元素上且逐帧不闪；6 个时段墨组都被盲评判为"限色印刷"（夜间是夜间海报，不是暗化的白天）；找缺陷评审（召回率 ≥80%）0 条被验证的风格违规。

**测量**：[script] 新 tools/check-style.mjs（对照 styleProfiles.C.rules）：(a) 页内栅格化 hero、close 与 6 个时段，逐像素到最近墨的 ΔE2000（抗锯齿边缘 1 px 豁免），非墨像素比例 ≤0.5%；(b) DOM 审计：linearGradient/radialGradient 只允许在 data-ref 为夜间光晕的元素中且 stop 呈 2–3 段硬边；旋转与变形 slot（wheel\*、crank\*、cog、chainring、pedal\*、thigh\*、shank\*、foot\*、wing\*、neck、pouch、crest、scarf）子树中 0 个 pattern 填充；0 个 `<filter>` 作用于可见元素（静态纸纹层白名单一项）；0 个 mix-blend-mode；0 个 `<text>`；(c) 远侧 slot 填充只用 B/N 墨变量。[code-review] STYLE-C §3 角色修正逐条对照 src/art/pelican-\*.js。[judge] 3× 头 / 翼 / 腿裁图对照 characterCorrections 逐条判定；"同一角色、同一风格"成对盲评（同机位、同时段、同曲柄相位、同裁切，左右随机）；限色印刷判定。

**证据**：docs/eval/style.json；docs/eval/judges/style-\*.json；shots/eval/style/\*.png；docs/eval/user-notes.json

#### C7.7 吸引力与克制（appeal & restraint） ★

维度内权重 2（占本维度 14%，折合总分 1.43 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：鹈鹕不讨喜：诡异、凶、或像一件精确但没有魅力的标本；画面像技术演示：到处是按钮、会动的东西和符号叠加，眼睛不知道看哪里。
- **5 分**：角色可爱但普通，剪影没有设计感；默认状态可见交互入口 >5 个，或在任意 1 s 窗口内骑者之外有 ≥3 个显著运动焦点；有明显可删的东西没人删。
- **8 分**：在 1× 下的 3 选 1 强制选择中（我们的骑者 vs 2 个替代设计：所选草稿的鹈鹕、匹配投入基线的鹈鹕；同尺寸、notext、中性背景），5 名盲评中 ≥3 名选我们；"你会删掉什么？"中被 ≥2/5 评审点名的元素全部被删除或在 docs/composition.md 中给出理由；默认状态可见交互入口 ≤5；UI 占视口 ≤12%；任意 1 s 窗口内骑者之外的显著运动焦点 ≤2（saliency 图）；骑者显著性比 ≥1.3；符号化叠加每个事件至多 1 个、≤6 帧。
- **10 分**：3 选 1 中 ≥4/5 选我们；"你会删掉什么？"中没有任何元素被 ≥2 名评审点名；细节多但不乱：在 C13.1 细节 ≥2.5× 的前提下，"画面是否拥挤 / 焦点是否清楚"的成对比较中对草稿不输（≥50%）。

**测量**：[script] tools/judge/saliency.mjs 的时间模式：60 fps × 10 s，每个 1 s 窗口统计骑者 bbox 之外显著性超过阈值的运动连通域数；DOM 统计默认状态可见交互入口（definitions.visibleAffordance）与 UI 视口占比；统计符号化叠加的数量与持续帧数。[judge] 5 名盲评（隔离、notext）：3 选 1 骑者设计强制选择；"你会删掉什么？"开放式；拥挤度成对比较（成品 vs 草稿同构图）。

**证据**：docs/eval/appeal.json；docs/eval/judges/appeal-\*.json；docs/composition.md

### D8 惊艳：标志性时刻、横向对比、彩蛋与声音

*Wow: signature moment, field comparison, delight & sound* · **权重 6** · 来源镜头：signature-moment、E6、delight-eggs、sound-design、UX8

它必须让人记住并想分享，而且要在公平、分层的盲评中证明自己是"跨越"而非"改良"。v2：标志性时刻的权重最大，并且是本维度的上限（S_D8 ≤ s_C8.1 + 0.5）；横向对比只在最强一层对照上计 8 与 10 分；声音在用户亲耳确认前最高 8 分。

#### C8.1 标志性 "how did they do that" 时刻 ★

维度内权重 3（占本维度 48%，折合总分 2.88 分）· 测量方式：视觉评审 + 自动脚本

- **2 分**：没有任何突出之处，只是称职的视差。
- **5 分**：把熟悉的效果当成高光（昼夜渐变、辐条模糊、视差），网页开发者一眼就能说出技术名。
- **8 分**：一个定制、不显然、切题的时刻，出现在默认体验中（不需要按键或 URL 参数就会在前 60 s 或自动导演中出现），≥55 fps；README 在评审前声明了它；3 名盲评中 ≥2 名在开放式回忆中把它列为最难忘之处；照搬创意简报中的示例不获得本项分数。
- **10 分**：这个时刻重新诠释了整件作品，揭示它的架构或故事；3/3 盲评主动提到它并猜测原理，且在"这是你以前见过的效果吗？"中 ≥2/3 答"没见过"；在跳车中、吞鱼中、夜间、390 px 下被打断都不出故障；另有一个较小的 encore 时刻。

**测量**：[judge] 3 名新鲜盲评（隔离证据包，没见过 rubric 与创意简报）只拿到 preview.webm 的联系表（每 0.5 s 一帧）与 RS-dense 的该时刻密集帧 + 5 张 hero 渲染，回答："你会告诉朋友的那一个时刻是什么？你认为它是怎么做到的？你以前见过这种效果吗？"按与 README 所声明时刻的一致度计分。[script] 新 tools/judge/eggs.mjs 在 4 种上下文（idle、跳车中、tod 0.93、390×844）触发该时刻：0 控制台错误，期间 fps ≥55（trace 计数），输出 before/peak/after 渲染；断言它在默认体验中无输入即出现。

**证据**：README.md#signature；docs/eval/moment.json；shots/eval/moment/\*.png

#### C8.2 分层盲评横向对比（同类比同类）

维度内权重 1.5（占本维度 24%，折合总分 1.44 分）· 测量方式：视觉评审 + 自动脚本

- **2 分**：在 ≥30% 的配对中输给同模型单次生成的对照组或自己的草稿。
- **5 分**：100% 赢过第 3 层（2024 年的历史 SVG），但对第 1 层（匹配投入基线）只赢 50–70%；评审说"不错，但差不多"。
- **8 分**：对第 1 层（同模型、同工具、同截图循环、60–90 分钟、不给 rubric、best-of-3 的匹配投入基线）胜率 ≥75%（按评审与对照聚类的 bootstrap 95% 下界 ≥0.6），静帧对静帧、条带对条带、只含骑者裁图对只含骑者裁图分别报告；对第 2 层（我们自己的 R1 版本）胜率 ≥60%。
- **10 分**：对第 1 层胜率 ≥90%，≥40 个评审配对，聚类 bootstrap 95% 下界 ≥0.85；只含骑者的裁图测试中对第 1 层 ≥80%（证明不是靠背景取胜）；找缺陷评审在我们作品里找到的有效缺陷严格少于任何第 1 层对照。

**测量**：[script] 新 tools/field.mjs：构建匿名 600×338 渲染（SVG 作为 `<img>`，一律 notext），随机 ID、随机左右，按格式分组：静帧组（我们烘焙 SVG 的 t=0 帧 vs 静态单次 SVG）、条带组（我们 6 帧条带 vs 动画对照的 6 帧条带）、骑者组（所有作品的骑者按同尺度裁到中性背景）。场上作品分层：第 1 层 = 匹配投入基线（由新鲜子代理在本环境中生成，设置冻结：thinking 开、token 预算、重试次数写入 field.json，并在 R1 之前对输出求哈希入库）+ 同模型单次对照（原话 ×3、动画原话 ×3）；第 2 层 = 我们的 R1 版本；第 3 层 = github.com/simonw/pelican-bicycle 的历史 SVG（固定该仓库提交 sha，数量从克隆中实时统计，不写死）；可公开下载的 2025–26 前沿模型鹈鹕 SVG 只在许可允许时放入私有评估，绝不入库或发布。[judge] 5 名新鲜评审（不同提问框架、图片尺度与呈现顺序）看每一个配对："哪一个是更好的“鹈鹕骑自行车”？一句话理由。"8/10 分只按第 1 层计；field.json 报告每层、每格式、每对照的胜率、样本量与有效样本量。

**证据**：docs/eval/field.json；shots/eval/field/\*.png（仅私有评估，不发布第三方作品）

#### C8.3 彩蛋层次与"懂行"的致敬

维度内权重 1（占本维度 16%，折合总分 0.96 分）· 测量方式：自动脚本 + 实时交互测试

- **2 分**：没有彩蛋，或唯一的"彩蛋"就写在控制面板上。
- **5 分**：计划中的鸥群护航再加 1–2 个复用现有动画的彩蛋；没有奖励好奇心的东西。
- **8 分**：docs/eggs.json 清单中的彩蛋按质量计分：每个彩蛋做 before/peak/after 三联图，盲评质量中位 ≥7（清单：定制美术或动作、不打破虚构、不复用 toast 或现成动作）；层次：≥1 个有可见线索、1 分钟内人人能发现的，其余在玩耍中发现；全部可从清单触发，任何状态下 0 错误；只用截图与指针 / 键盘 / 触控的探索代理 15 分钟内经由可见线索找到 ≥2 个（从代码或 aria 名称得知的不算）；所有幕后功能（X 光、声明、过程回放、工程笔记、Velocipedia 画廊）只在一个"幕后 / Behind the scenes"入口之后。
- **10 分**：8 分全部满足，另加：彩蛋质量中位 ≥8（4 个精做胜过 8 个单薄）；≥1 个奖励基准知识或中国文化的彩蛋；彩蛋之间可组合；在"探索中你最喜欢的一个时刻"与对照彩蛋（同样投入的通用彩蛋）的强制选择中 ≥60% 选我们的。

**测量**：[script] tools/judge/eggs.mjs 按 docs/eggs.json（触发方式、预期画面、层级）在 1600×900 与 390×844、白天与夜间、跳车中逐个触发，输出 before/peak/after 渲染，断言 0 错误、期间 fps ≥55。[live-test] 一个只能通过截图—输入包装器操作 dist 的新鲜探索代理（没有 DOM、aria、evaluate、源码与 README 访问；每次工具调用记入 ledger）玩 15 分钟，然后列出发现以及发现它的可见线索；按清单计数，读代码得来的一律作废。

**证据**：docs/eggs.json；docs/eval/explorer.json；shots/eval/eggs/\*.png

#### C8.4 程序化声音设计与声音礼仪

维度内权重 0.75（占本维度 12%，折合总分 0.72 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：没有声音；或有咔哒、爆音、削波；或事件不同步；或加载时就创建 AudioContext（控制台 autoplay 警告）；没有静音。
- **5 分**：有铃声和风声并响应事件与速度，但都是单声道、未混音、循环听得出来；开关声音时爆音；没有音量控制；隐藏标签页后仍在响；图标状态含糊。
- **8 分**：全部程序化且同步：铃的起音在视觉拇指弹出后 ≤20 ms（按 rig 事件时间调度）；滑行棘爪滴答率 = 车轮转/秒 × 啮合点数 ±5%；峰值 ≤−1 dBFS（铃 ≤−3 dBFS），3 s 窗 RMS 在 −24…−14 dBFS，0 次咔哒；鸥与船按屏幕 x 声像；每次开 / 关 / 暂停都有 300–800 ms 增益斜坡；有音量；标签隐藏 200 ms 内挂起；默认静音，用户显式开启声音之前 0 个 AudioContext；声音按钮有 aria-pressed 与双语标签，M 键切换且只播报一次；防烦扰：没有短于 30 s 的重复乐句，开声后音乐默认仍关闭（单独开关）。
- **10 分**：只有在用户（G16）亲耳听过并确认之后才可给 9 或 10；在此前提下：自适应配乐（事件量化到拍）、铃声压低风声（ducking）、可选声音字幕（[车铃叮铃] / [bell rings]）、已保存的"开声"偏好从不自动播放而是显示"轻触恢复声音"、WebAudio 不可用时优雅降级、有声版 preview.webm。

**测量**：[script] 新 tools/judge/audio-offline.mjs：要求 createAudio(bus,{context}) 接受注入的 OfflineAudioContext（契约请求），在页内把一段脚本化 30 s 序列（巡航、3 s 铃、6 s 跳车、10–15 s 滑行、冲刺到 95 rpm、吞鱼、关再开声音）渲染成 Float32；计算峰值、每秒 RMS、咔哒检测（没有调度 onset 时 |Δsample| >0.3）、onset 与 bus 事件时间差、滑行期间滴答率频谱、L/R 平衡与鸥 x 轨迹的相关、自相关找最短重复乐句；输出 WAV 与带事件标记的频谱图 PNG。新 tools/audio-check.mjs：addInitScript 包装 AudioContext、webkitAudioContext 与 HTMLMediaElement.prototype.play 计数；加载后等 10 s 并按遍所有非声音控件，构造次数必须为 0；visibilitychange → 200 ms 内 suspended。[judge] 多模态评审阅读频谱图与指标报告（评审听不到声音，只判断同步与混音指标；"听起来好不好"只由用户判断）。

**证据**：docs/eval/audio.json；shots/eval/spectrogram.png；docs/eval/user-checkpoint.json

### D9 交互、无障碍与产品体验

*Interaction, accessibility & product UX* · **权重 6** · 来源镜头：UX1、UX2、UX3、UX4、UX5、UX6、UX7、UX10、ANIM-11、micro-interactions

任何人、在任何设备、用任何输入方式都能在 10 秒内玩起来；控件安静、好用、从不盖住鹈鹕；键盘、读屏、减少动态、光敏、竖屏手机、双语都是一等公民。

#### C9.1 上手与可发现性（前 10 秒，不看 README）

维度内权重 1.5（占本维度 16%，折合总分 0.95 分）· 测量方式：实时交互测试 + 自动脚本

- **2 分**：静态标题卡挡住场景，或没有任何信号表明它可以交互；功能只能靠没文档的按键触发；可点击的鹈鹕没有任何提示；冷启动测试者在 15 项功能中找到 ≤4 项。
- **5 分**：有面板和 '?' 帮助，但提示是大段文字或每次访问都弹出；触屏用户看到的是键盘说明；点鹈鹕喂鱼没有 idle 或 hover 提示；冷启动测试者 25 个动作内找到 7–10/15。
- **8 分**：标题卡 ≤3 s、pointer-events:none、不推迟首帧（DOMContentLoaded 后 ≤500 ms 渲染首帧）；≤5 s 出现一次情境化 idle 提示（例如"点鹈鹕喂鱼 / Tap the pelican to feed it"），第一次交互后消失，刷新后也不再出现（存储用 try/catch）；提示按 pointer:coarse / pointer:fine 适配；默认状态可见交互入口 ≤5、UI ≤12% 视口；只看截图的冷启动测试者找到 ≥12/15，且没有死胡同。
- **10 分**：角色本身就是教程：闲置时鹈鹕看向观众、敲一下铃，喂鱼的 affordance 同步脉动一次；渐进披露（先是骑行控件，"更多"里才是机位、时段、导出，"幕后"入口里才是检查与过程材料）；每个提示都双语、键盘与读屏可达、尊重减少动态；两名只看截图的冷启动测试者（桌面与 390 px 触屏）都在 25 个动作内找到 ≥14/15，且都没有报告令人困惑的控件；默认状态可见交互入口 ≤4。

**测量**：[live-test] 两个新鲜代理只能通过截图—输入包装器（tools/judge/harness.mjs：只暴露截图与指针 / 键盘 / 触控输入，没有 DOM、aria、evaluate、page.content 访问，没有 README 与源码；每次工具调用记入 ledger，越界即作废）操作 dist/index.html：一个 1280×720 鼠标 + 键盘，一个 390×844 hasTouch + isMobile；各有 25 个动作的预算，每个动作后截图，最后列出发现的功能及其可见线索；对照隐藏的 15 项清单计分（播放 / 暂停、踏频、滑行、时段、自动昼夜、机位、铃、挥手、跳车、喂鱼 / 点鹈鹕、声音、下载 SVG、海报 / 分享、帮助 / 快捷键、语言）。[script] tools/ux-matrix.mjs 的计时探针：performance.mark("pb:first-frame") 在 DOMContentLoaded 后 ≤500 ms；标题卡 pointer-events:none 且 3.5 s 时 opacity 0；idle 提示 5 s 可见、首次 pointerdown/keydown 后 300 ms 内消失；刷新后不再出现；默认状态可见交互入口计数。

**证据**：docs/eval/cold-start-desktop.json；docs/eval/cold-start-touch.json；docs/eval/ux-matrix.json

#### C9.2 控件、反馈、微交互与可见性

维度内权重 1.5（占本维度 16%，折合总分 0.95 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：一堵不分组的按钮墙、每个按钮挤着双语标签，还盖住了鹈鹕；开关不显示状态；HUD 以 60 Hz 重写 DOM；backdrop-filter 明显拉低 fps；正午时玻璃面板上的白字读不出来。
- **5 分**：分组且可折叠，但在某个视口或机位下与骑者重叠；部分开关没有可见或 aria 状态；点"挥手"时控件本身没有任何确认；反馈正确但通用（只变色）；对比度在黄金时刻通过、在正午或黎明失败；焦点环细且对比低。
- **8 分**：wide 下 UI 与骑者 0 重叠（close/cinematic 面板折叠时 ≤3% 骑者面积）；机位是真正的 radiogroup；每个控件的 aria 与视觉状态在 1 帧内与 \_\_pb.state 一致；12 个动作从输入到画面变化 ≤20 ms，控件自身反馈 ≤100 ms；每个交互元素都有 rest/hover/:focus-visible/:active 四态且两两不同；≥1 个做得好的 diegetic 控件（例如 UI 铃会摇响车上的铃，质量由盲评三联图判定，中位 ≥7），不按数量计分；HUD ≤10 Hz；面板开 / 合 fps 差 ≤2、JS p95 差 ≤0.3 ms；按实际合成像素测对比度：小字 ≥4.5:1，图标、控件边界与焦点环 ≥3:1（6 时段 × 3 机位 × 2 视口 × 宿主主题 {prefers-color-scheme dark/light} × {:root[data-theme=dark/light]}）；状态不只靠颜色区分；forced-colors 与 prefers-contrast:more 下可用；200% 字号不溢出；文字 UI 在 390 px 下保留 ≥16 px 侧边距，0 横向滚动。
- **10 分**：8 分全部满足，另加：面板根据当前机位与视口计算骑者 bbox，自动停靠到对侧；控件按风格 C 绘制（deco 字形、七墨、车票式标签）并且仍然通过 WCAG；直接操作都有滑块等价物（拖太阳改时段、拖路面改踏频，WCAG 2.5.7）；UI 有自己的动作性格（铃按钮与车铃用同一个弹簧常数）；最差对比度余量仍比阈值高 ≥20%。

**测量**：[script] tools/ux-matrix.mjs：11 视口 × 3 机位 × 面板开 / 合 × 4 种宿主主题状态，计算 #rider.getBoundingClientRect() 与每个可见、非透明 #ui 元素框的交集面积；每个脚本化控件动作后 1 个 rAF 内 aria-pressed/aria-checked/value 与 \_\_pb.state 一致；pointerdown 到控件首次 DOM 变化 ≤100 ms；5 s idle 期间 #ui 上的 MutationObserver 每元素 ≤10 次/s；perf.mjs 面板开 vs 关。新 tools/judge/controls.mjs：事件到场景变换首次变化 ≤20 ms，四态截图两两像素差，390×844 下 getBoundingClientRect ≥44×44。新 tools/contrast.mjs：每种情形拍两张截图，一张正常，一张把 UI 文字与图标设为 color: transparent，比较前景中位像素与局部背景中最差 5% 像素；emulateMedia forcedColors:"active"、contrast:"more"、colorScheme dark/light，并设置 :root[data-theme]；注入 html{font-size:200%} 检查溢出。[judge] 6 个时段的面板截图；diegetic 控件三联图。

**证据**：docs/eval/ux-matrix.json；docs/eval/contrast.json；shots/eval/ui-states/\*.png

#### C9.3 交互即表演：输入得到的是角色化的回应

维度内权重 1（占本维度 11%，折合总分 0.63 分）· 测量方式：实时交互测试 + 自动脚本 + 视觉评审

- **2 分**：按键没反应，或鹈鹕瞬移到某个姿态。
- **5 分**：每个键播放一段预制片段；连按会跳变或奇怪地排队；点哪里都是同一个反应；跳车冷却静默吞掉输入，用户以为坏了。
- **8 分**：每个输入在 2–6 帧内以角色化的预备开始回应（首动延迟 ≤100 ms，从不硬切到极点姿态）；可混合、可打断、防连按（每键 20 次/s 连按 1 s 后，姿态日志送入 motion-audit 连续性检查 0 失败）；被拒绝的跳车有一个小小的"还没好"反应；点鹈鹕或喉囊会在点击处产生局部反应（点车轮不会触发吞鱼）；光标靠近时视线偏向光标（与光标方向夹角 ≤25°）；踏频滑块平滑改变发力姿态；连续点击 ≥3 级升级；≥15 s 无输入触发 idle 行为。
- **10 分**：鹈鹕像是知道有人在看：视线跟随光标；戳喉囊时抖动从点击处向外扩散；被冷落 20 s 会有一个角色化的 idle 行为；在"这两个版本哪个更好玩"的有 / 无交互反应 A/B 强制选择中，5 名只看截图序列的盲评中 ≥4 名选完整版本。

**测量**：[live-test] 新 tools/interact.mjs（dist 实时页面）：按每个键（Space/铃、W、H、F、C、S、←/→）并点击鹈鹕，2.5 s 内每个 rAF 记录 window.\_\_pb.pose()；首动延迟 = 第一个有 slot 偏离无输入基线 >0.5° 的帧；连按测试；光标悬停测试（眼与头朝光标偏转）。[script] 连按测试（每键 20 次/s × 1 s）的姿态日志送入 motion-audit 连续性检查，0 失败。[judge] 反应峰值截图交给视觉评审，判断是否在角色内。

**证据**：docs/eval/interact.json；shots/eval/interact/\*.png

#### C9.4 键盘可操作性与快捷键卫生（单一 keymap 事实源）

维度内权重 1（占本维度 11%，折合总分 0.63 分）· 测量方式：自动脚本 + 代码审查

- **2 分**：Tab 到不了控件，或焦点不可见；快捷键没有文档；Space 会滚动页面或破坏按钮；帮助里列出的键不起作用。
- **5 分**：快捷键大体可用但有冲突：聚焦按钮时 Space 既激活按钮又摇铃；聚焦滑块时 ←/→ 移动两次；Cmd+C 会切机位；按住 J 连发跳车；帮助文本是手写的并已与代码漂移。phase-0 现状：plan.v0.md（Space=暂停、B、J、T）、rig-spec §4（Space=铃、H、N、P）、wf-build 的 UI brief（T、F、S、M、P、?）与 src/ui/ui.js（Space/B=铃、W、H/J/↑）四份键位表互相矛盾，且 ui.js 在 window 级对 Space 无条件 preventDefault，没有焦点、修饰键、repeat 或 IME 守卫。
- **8 分**：处理器、帮助对话框、aria-keyshortcuts 与 README 表都由 src/ui/keymap.js 生成；守卫修饰键、聚焦的表单控件、e.isComposing 以及一次性动作的 e.repeat；Tab 顺序与视觉顺序一致，暂停 ≤2 次 Tab 可达；焦点环 ≥2 px，每个时段对比度 ≥3:1；帮助是原生 `<dialog>`（焦点进入、Tab 在内部循环、Esc 关闭、焦点回到触发者）；可以关闭单字符快捷键（WCAG 2.1.4）；喂鱼有键盘等价按钮；keys.mjs 100% 通过。
- **10 分**：8 分全部满足，另加：radiogroup 使用 roving tabindex 与方向键；:focus-visible 时按钮上显示键位提示；帮助层是一张以艺术风格绘制的键盘，按下的键实时点亮（触屏上变成手势图）；字母快捷键基于 e.key，AZERTY 与 Dvorak 可用；节奏彩蛋：交替敲击 ←/→ 把踏频设为你的节拍（有滑块等价物）。

**测量**：[script] 新 tools/keys.mjs 导入 src/ui/keymap.js，对每一项执行 page.keyboard.press，断言预期的 bus 事件（监听 \_\_pb.bus.emit）与 \_\_pb.state 变化。负例：同样的键按住 Control/Meta/Alt 时 0 事件；聚焦 range 时 ←/→ 只改这个滑块（恰好 1 次 ui:speed）；聚焦按钮时 Space/Enter 只触发该按钮；按住 J/H 1 s 恰好 1 次跳车；isComposing:true 的 keydown 0 事件；关闭快捷键后所有字母键 0 事件。Tab 行走 ≤40 次，记录 document.activeElement 的矩形：每组内顺序单调、所有交互元素都被访问、暂停在 2 次内。5 个时段截图测焦点环像素（≥2 px、≥3:1）。对话框流程。[code-review] 帮助与 README 表是从 keymap.js 派生的，而不是复制的。

**证据**：docs/eval/keys.json

#### C9.5 读屏语义与文本替代

维度内权重 1（占本维度 11%，折合总分 0.63 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：SVG 没有标签，或上千个 `<g>`/`<path>` 泄漏进无障碍树；图标按钮没有名称；axe 报 serious 违规。
- **5 分**：svg 有 role=img 但名称只有一种语言；按钮有名称；什么都不播报，或者 HUD 放在 aria-live 里每帧喋喋不休；滑块读出的是没有单位的原始数字。
- **8 分**：场景由一个 role=img 的包装元素承载，aria-labelledby 指向当前语言的标题与描述；每个深度带 `<svg>` 都 aria-hidden，场景在无障碍树中恰好贡献 1 个节点；每个用户动作恰好 1 次 polite 播报，idle 时 0 次；滑块有 aria-valuetext（"60 转/分 · 23 公里/时" / "60 rpm · 23 km/h"）；页面有 landmark（main + 控制 region）与 h1；axe 在每个状态下 0 违规。
- **10 分**：8 分全部满足，另加：`<details>` 长描述写得像好的 alt 文本散文而不是零件清单；'描述'按钮与 D 键根据实时状态生成一句话（如"黄昏时分，鹈鹕正以每分钟 72 转沿海边公路骑行，已骑 1.3 公里，灯塔还没亮。"）；给聋人与听障用户的可选声音字幕；ariaSnapshot golden 文件入库并 diff；README 有无障碍声明，引用 axe、keys、flash 报告。

**测量**：[script] 新 tools/a11y.mjs 注入 pinned axe-core（新增 devDependency），标签 wcag2a、wcag2aa、wcag21aa、wcag22aa 与 best-practice；10 个状态：默认、面板折叠、帮助打开、390×844、lang=en、lang=zh、reducedMotion、夜间、宿主暗色主题、宿主亮色主题；任何级别违规都计。page.locator("body").ariaSnapshot() 对比入库的 docs/a11y/aria.golden.yml，场景子树必须恰好是一个带当前语言非空名称的 img 节点。live-region 监视：对每个 [aria-live] 与 role=status 节点挂 MutationObserver，12 个动作的脚本恰好 12 次播报，30 s idle 0 次。[judge] a11y 评审把 ariaSnapshot 当作读屏器转录来评清晰度。

**证据**：docs/eval/a11y.json；docs/a11y/aria.golden.yml

#### C9.6 动效安全：减少动态、暂停、光敏与前庭舒适

维度内权重 1（占本维度 11%，折合总分 0.63 分）· 测量方式：自动脚本

- **2 分**：忽略 prefers-reduced-motion；电影机位的滚转与抖动默认开启；没有暂停或暂停被藏起来；夜间最高踏频下路灯频闪却没人测量过。
- **5 分**：减少动态时启动为暂停，但点播放后时段自动循环或电影机位仍在滚转；matchMedia 只在加载时读一次（phase-0 main.js:24）；暂停只能靠按键；没有闪烁测量。
- **8 分**：所有规定的减弱都生效：停在海报帧，播放后 40 rpm，无速度线，cinematic 退回 wide，前景 depth 夹到 1.0，不自动切换时段；减少动态的首屏：0 s 即显示静态海报帧、UI 与提示，无过渡，播放控件 ≤2 次 Tab 可达，并有双语"已开启减少动态 / Reduced motion on"说明；matchMedia change 监听在 1 帧内适配；暂停按钮在每个视口都可见且 ≤2 次 Tab 可达；标签隐藏时自动暂停；flash-check 全部场景通过（任意 1 s 窗口内一般闪烁与红色闪烁都 ≤3 次，WCAG 2.3.1）。
- **10 分**：8 分全部满足，另加：页内动态设置（完整 Full / 柔和 Gentle / 静止 Still），默认取系统设置、可覆盖，也可作为 URL 参数分享；零 JS SVG 内嵌 @media (prefers-reduced-motion: reduce)，切换到静态海报组；README 发布闪烁报告（每场景最大闪烁/秒）；cinematic 从不自动开启；系统设置中途改变时弹出礼貌的双语 toast（'已切换为减少动态效果 / Reduced motion on'）。

**测量**：[script] 新 tools/flash-check.mjs（PEAT-lite），1024×576：每个场景用 renderAt(t) 每 1/60 s 步进 4 s；场景 = 5 时段 × 踏频 {60, max} × 3 机位，加上铃、吞鱼、跳车事件，以及夜间灯塔与路灯；按 341×256 滑窗（步长 64）计算逐像素相对亮度，统计幅度 ≥10% 且较暗态 <0.80 的相反跃迁，另统计饱和红跃迁；任何 1 s 窗口 >3 次即失败。减少动态检查：reducedMotion:'reduce' context 中交互前 0 s 与 3 s 截图像素一致，且有可见的播放入口；播放后 3 s 内采样 \_\_pb.state 与 camera：roll=0、zoom 恒定、speedlines 关、cadence ≤40、todAuto=false；会话中途 page.emulateMedia 切换必须无须刷新即适配。隐藏标签检查：CDP Page.setWebLifecycleState 或 visibilitychange 使 state.t 停止前进。

**证据**：docs/eval/flash.json；docs/eval/reduced-motion.json

#### C9.7 移动端、竖屏、触屏与嵌入视口

维度内权重 1.5（占本维度 16%，折合总分 0.95 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：竖屏手机上骑者被裁掉，或被信箱化成一条细带。phase-0 已核实：scene.js 用 preserveAspectRatio="xMidYMid slice"，在 390×844 下只露出 x≈592–1008 的约 416 u，而骑者占 x 455–953，于是后轮与尾巴被切掉、上半屏是空天。按钮约 28 px 且互相重叠；有横向滚动；面板盖住骑者。
- **5 分**：有竖屏构图，但某个机位或 320 px 下骑者被裁；部分触控目标 <44 px；底部面板只能拖动打开；横屏手机（844×390）上面板盖住半个场景。
- **8 分**：竖屏下骑者高度 ≥35% 视口高，并在每个机位下完整可见；viewport-fit=cover + env(safe-area-inset-\*) + 100dvh；所有触控目标 ≥44×44 CSS px、间距 ≥8 px（硬底线 24×24，WCAG 2.5.8）；面板可点开也可拖开（WCAG 2.5.7）；touch-action:manipulation、overscroll-behavior:none；播放中旋转屏幕后的布局与全新加载一致（截图差 <1%）；鹈鹕点击区 ≥88 px；矩阵中任何尺寸都 0 横向滚动。
- **10 分**：8 分全部满足，另加：专门的竖屏机位（竖向构图，骑者 ≥40% 高度，灯塔与鸥群叠在上方天空）；横屏手机上面板变成侧栏；Artifact 面板尺寸（480×800、640×720、720×800）有专门调过的构图；4× CPU 节流下自动画质保持 ≥45 fps；移动端读起来是"为它设计的"，而不是"适配出来的"。

**测量**：[script] tools/ux-matrix.mjs 用 isMobile + hasTouch 的 context：320×568、360×640、390×844、430×932、844×390、768×1024，外加 Artifact 面板尺寸 480×800、640×720、720×800。检查：(a) document.scrollingElement.scrollWidth ≤ innerWidth；(b) 每个机位下 #rider 矩形完全在去除安全区后的视口内，竖屏骑者高度比 ≥0.35（10 分要 0.40）；(c) 每个交互目标 ≥44×44 CSS px（硬底线 24×24）且间距 ≥8 px；(d) 骑者与 UI 0 重叠；(e) page.touchscreen.tap 点鹈鹕触发吞鱼，面板可点开；(f) 播放中 390×844 → 844×390 旋转与全新加载截图差 <1%；(g) CDP setCPUThrottlingRate(4) + --perf ≥45 fps。[judge] a11y 评审看每一张截图。

**证据**：docs/eval/mobile.json；shots/eval/mobile/\*.png

#### C9.8 双语 zh/en 质量

维度内权重 1（占本维度 11%，折合总分 0.63 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：只有英文，或中文像机翻，或出现豆腐块；`<html lang>` 写死；字符串散落在 ui.js 各处。
- **5 分**：每个控件都塞着双语标签（390 px 下很挤）；有些字符串缺一种语言；aria-label 停留在一种语言；中文里夹着半角标点。
- **8 分**：字符串表 src/ui/i18n.js 两种语言键 100% 对齐，没有硬编码的用户可见字符串；navigator.languages 自动检测 + 持久化切换（try/catch）；`<html lang>`、title、场景标题与描述、aria 名称实时更新；混排 span 带 lang 属性；数字用 Intl.NumberFormat；两种语言在 320 px 下都不溢出；README 双语（中文在前）；下载文件名保持 ASCII；画面内文字清单（每个文字元素带 data-text 记录预期字符串）全部由双语审校在 3× 下核对：字形正确（鹈鹕湾，不是近形字或自造字）、字体与用途相符（仿印章的元素要么是手工构造的篆书轮廓，要么明确做成 deco 题签而不冒充篆刻印章）；CJK 字形检查 0 个豆腐块。
- **10 分**：8 分全部满足，另加：双语审校评为两种语言都地道、有趣、术语一致（喂鱼 / Feed fish、叮铃 / Ring、滑行 / Coast）；画面内的路牌、车票式注记与邮戳以风格 C 字形转为路径并有正确的 CJK 排版；烘焙 SVG 带双语元数据；单位本地化（公里/时 vs km/h）；i18n-lint 0 警告。

**测量**：[script] 新 tools/i18n-lint.mjs 解析 src/ui/i18n.js：键对齐 100%；src/ui/\*.js 中 i18n.js 以外 0 个赋给 textContent、aria-label、title 或 placeholder 的字符串字面量（正则 + esbuild metafile 辅助的 AST 检查）；中文串中与 CJK 字符相邻的 ASCII , . : ; ! ? ( ) 为 0，且除白名单（SVG、PNG、WebM、rpm、km/h）外没有 ≥3 字母的拉丁单词；英文串中 0 个 CJK。locale zh-CN 与 en-US 两个 Playwright context 必须默认到对应语言并设置好 lang、title、场景名称与所有 aria 名称；实时切换语言后 diff ariaSnapshot，每个名称都要变化；两种语言 320 px 溢出检查。新 tools/cjk-glyph.mjs（取代无效的 document.fonts.check——它在本 Chromium 中对不存在的字体也返回 true）：对 i18n.js 与画面内文字中的每个 CJK 码位，用页面字体栈画到 canvas，与 .notdef 方框以及已知缺字的字形比较像素与步进宽度，相同即失败。新 tools/check-text.mjs：收集所有 data-text 元素，输出 3× 裁图清单。[judge] 双语文案评审对照清单给全部字符串与 3× 画面文字裁图打分。

**证据**：docs/eval/i18n.json；docs/eval/in-art-text.json；shots/eval/text/\*.png

### D10 性能与平台稳健

*Performance & platform robustness* · **权重 4** · 来源镜头：P1、P2、P3、P4、P7、P8、P9、P10、E11、UX11、ENG-5、ENG-7

在本容器的软件光栅无头 Chromium 下也稳 60 fps，长跑不泄漏，任何打开方式都不出错。本容器的校准事实：决定帧率的是光栅成本与合成面积，而不是 JS 或 DOM 数量——单个 svg#scene 每帧 setAttribute 时富风格会崩（C-poster 19–22 fps）；同样的美术做成提升层并用 CSS transform 移动可达 56–60 fps；每个全视口移动层约 5 ms（3 层 58.6、6 层 31.2、10 层 18.8 DrawAndSwap/s，1600×900@1），所以预算的是合成面积而不是层数。风格 C 的细节要求（G-DETAIL）不放宽任何性能门槛。

#### C10.1 呈现帧率与帧节奏（全场景矩阵，基于 trace）

维度内权重 2（占本维度 29%，折合总分 1.14 分）· 测量方式：自动脚本

- **2 分**：wide/golden 稳态呈现 <30 fps，或反复出现 >100 ms 卡顿（单个富 SVG 每帧整幅重绘的结果）。
- **5 分**：wide 稳态 ≥55 fps，但 close 或 cinematic 掉到 30–45 fps，或跳车、吞鱼、机位切换、调色板刷新造成可见卡顿（某场景 p95 帧间隔 ≥33 ms）。
- **8 分**：1600×900 DPR1 下每个场景中位 ≥57 swaps/s；p95 帧间隔 ≤18 ms；>25 ms 的间隔 ≤1%；首秒之后没有 >50 ms 的间隔；rAF 频率与 swap 频率相差 ≤3%；骑者带的 DOM 在 ≥98% 的呈现帧上发生变化，且 state.t 在每个 rAF 严格递增（不能用合成器动画掩盖 30 Hz 的骑者更新）。
- **10 分**：所有场景（含 DPR2 与 390×844 DPR3 移动模拟，目标在 R0 按实际分带方案测量后冻结）≥58.5 swaps/s；p99 间隔 ≤20 ms；60 s 内 0 个 >50 ms 的 long-animation-frame；4× CPU 节流下靠自适应画质仍 ≥55 fps，档位切换没有可见跳变，且任何画质档都不降低骑者的更新率。

**测量**：[script] 新 tools/perf.mjs（针对 dist 运行）：每个场景预热 2 s，然后 3 次 × 20 s；CDP Tracing 类别 viz,cc，统计每秒 Display::DrawAndSwap 事件并计算帧间隔 p50/p95/p99；同时记录页内 rAF dt 直方图、PerformanceObserver long-animation-frame、骑者带 MutationObserver 每帧变更与 state.t 单调性；记录画质档位与 DOM 结构哈希（评审渲染必须使用通过 G9 的同一档）。场景矩阵：cam {wide, close, cinematic} × tod {0.70, 0.93} × cadence {60, 90（开鸥群与速度线）}，外加事件风暴、机位循环、自动时段。视口：1600×900@1、1600×900@2、1920×1080@1、390×844@3 isMobile。CPU 锁：所有启动 Chromium 的工具对 /tmp/pb-cpu.lock 取共享 flock，perf 与 soak 取独占锁并等待（最长 30 min）而不是拒绝运行；perf.json 记录前后 loadavg 与 ps 快照，运行中出现新的 chromium PID 则本次作废重跑。禁止用 CDP screencast 或 Playwright video 测 fps。

**证据**：perf/perf.json（traces 不入库，只入摘要）

#### C10.2 合成层架构与光栅成本

维度内权重 1.5（占本维度 21%，折合总分 0.86 分）· 测量方式：自动脚本 + 代码审查

- **2 分**：单个 svg#scene，每帧对每一层 setAttribute 变换（现契约的做法），再加上富美术：每帧整个视口重新光栅化（RasterTask >1000 ms/s）；filter 或 mix-blend 挂在运动内容上。
- **5 分**：仍是单个 SVG，但美术足够简单（类 A-flat：约 1000 节点、无 clipPath 与滤镜），所以 wide 下整幅重绘勉强够；close 或更重的风格就崩；没有层提升，没有路径复杂度预算。
- **8 分**：深度带提升为合成层，每个是 HTML div 里的独立 `<svg>` 根，只用 transform 移动；按合成面积而不是层数预算：Σ(与重绘区相交的层面积)/视口 ≤3.0（1600×900@1，由 LayerTree 边界计算），各带裁到其内容条带，底部是不透明的静态天空；静态带稳态重绘 0 次/s，只有骑者带重绘；RasterTask wide ≤250 ms/s、close ≤450 ms/s；调色板重光栅 ≤2 次/s（量化）或双缓冲；被重绘的内容上没有 filter、mix-blend-mode 或 group opacity；重绘带 ≤10 个 clipPath、≤80 KB 路径数据；静态带不设节点上限，改用结果预算（首帧 ≤400 ms、层内存 ≤150 MB）。
- **10 分**：8 分全部满足，另加：SLOTS 被切成连续的 z 带，车轮、牙盘、飞轮在合成器上旋转，同时远腿、车架、近腿仍正确交错；时段过渡用预光栅副本的合成器 opacity 交叉淡化（0 次 >8 ms 的光栅尖峰）；电影缩放按机位路径最大比例 1.45 光栅，呼吸式缩放不重光栅且清晰（SSIM ≥0.98）；合成面积比 ≤2.0；重绘带 ≤800 节点、≤40 KB 路径；README 附 paint-rect 截图。

**测量**：[script] tools/perf.mjs --paint：trace 类别 cc,viz,disabled-by-default-devtools.timeline 汇总每秒 RasterTask 与 RasterizerTaskImpl 时长；CDP LayerTree.enable 由 layerTreeDidChange 记录层数、边界与 compositingReasons 并计算合成面积比，由 layerPainted 记录每层每秒重绘次数与重绘面积；Overlay.setShowPaintRects(true) 截图给 README；逐带静态复杂度报告（不设上限，供细节预算参考）。R0 先跑一次合成面积探针做校准。[code-review] tools/lint.mjs 把"每帧写属性的模块中出现 `<fe*>`、mix-blend-mode、CSS filter"从 warn 升为 FAIL，并加运行时祖先链检查。需要在构建开始前修改契约（z-band 架构）。

**证据**：perf/paint.json；docs/eval/paint-rects.png

#### C10.3 主线程 JS 与零垃圾帧循环

维度内权重 0.5（占本维度 7%，折合总分 0.29 分）· 测量方式：自动脚本

- **2 分**：JS p95 >8 ms；update() 重建 markup 或 innerHTML，或每帧读布局（getBBox、getBoundingClientRect、getCTM）；每帧 >500 次属性写入；可见的 GC 卡顿。
- **5 分**：JS p95 3–5 ms，每帧约 100 KB 分配（xf() 字符串拼接约 33 个 slot 与 19 个层变换、每帧 state.events.filter、闭包）；未变化的值被重复写入；调色板刷新每次设置约 90 个自定义属性。
- **8 分**：JS p95 ≤2 ms、p99 ≤3 ms（契约值）；每帧 ≤150 次脏检查过的属性/样式写入；每帧分配 ≤20 KB；LoAF forcedStyleAndLayoutDuration 为 0；包括调色板刷新在内，样式重算 p95 ≤1 ms。
- **10 分**：90 rpm + 鸥群 + 速度线 + 事件风暴下 JS p95 ≤1.0 ms、p99 ≤1.5 ms；每帧分配 ≤2 KB（预分配的 Float64Array 姿态缓冲、缓存的数字格式化、没有 DOM 增删的粒子池、transform.baseVal SVGTransform.setMatrix）；60 s 内没有 >1 ms 的 MinorGC；?perf=1 HUD 显示逐模块 ms。

**测量**：[script] ?perf=1 钩子用 performance.now 与 3600 帧环形缓冲给 step()、solvePose、每个 attached[i].update、ui.update、audio.update 计时；测试用 MutationObserver({attributes:true, subtree:true}) 在 600 帧内统计每帧变更数，并标出新旧值相同的写入；CDP HeapProfiler.startSampling({samplingInterval:1024}) 采 20 s 得每帧分配字节；trace 'v8,devtools.timeline' 得 MinorGC/MajorGC 时长；Performance.getMetrics 的 RecalcStyleDuration 与 LayoutDuration 增量；LoAF forcedStyleAndLayoutDuration。场景：cadence 90、自动时段、事件风暴。以上由 tools/perf.mjs --js 执行。

**证据**：perf/js.json

#### C10.4 内存与长跑稳定（≥10 分钟 soak）

维度内权重 0.5（占本维度 7%，折合总分 0.29 分）· 测量方式：自动脚本

- **2 分**：堆或节点数单调增长（每 10 分钟 >10 MB），fps 随时间下降，标签页崩溃或 OOM，音频声部堆积到失真。
- **5 分**：GC 后堆增长 2–10 MB；resize 或开关声音后监听器泄漏；第 12 分钟 fps 比第 2 分钟低至多 10%。
- **8 分**：第 2 与第 12 分钟 GC 后堆差 ≤1 MB，DOM 节点数与 JSEventListeners 完全相等（idle 时采样）；renderer RSS 增长 ≤30 MB；存活音频节点从不超过 64；第 12 分钟 fps 与第 2 分钟相差 ≤2%；从未向 transform、d 或 style 写入 NaN/Infinity。
- **10 分**：GC 后堆差 ≤256 KB，RSS 增长 ≤10 MB；3 次连续 soak 加一次 60 分钟无人值守运行，任何计数器 0 漂移；时间扭曲运行（state.t ≈ 1e6 s）的 fps 与内存相同。

**测量**：[script] 新 tools/soak.mjs：dist 1600×900 实时运行 12 分钟。种子猴子每 0.3–3 s 一个输入：所有快捷键、点击吞鱼、机位循环、拖动时段滑块、20 次声音开关、每 45 s 在 5 个尺寸间 resize、每 3 分钟一次 Page.setWebLifecycleState frozen/active、经 emulateMedia 实时切换减少动态。每 10 s 采样 Performance.getMetrics（JSHeapUsedSize、Nodes、JSEventListeners、LayoutObjects、Documents）、经 SystemInfo.getProcessInfo 或 /proc 的 renderer RSS、\_\_pb.state.events.length 与该分钟 fps；测试垫片包装 BaseAudioContext.prototype.create\*，统计创建与结束/断开的节点数；第 2 与第 12 分钟采样前 HeapProfiler.collectGarbage。

**证据**：perf/soak.json；docs/eval/soak-memory.png

#### C10.5 自包含构建、体积预算与启动

维度内权重 0.5（占本维度 7%，折合总分 0.29 分）· 测量方式：自动脚本

- **2 分**：有外部请求（字体、CDN、图片），从 file:// 打不开，或 index.html 超过 G1 的 1 MB gzip / 3 MB raw。
- **5 分**：自包含，但在 styleProfiles.C 的 8 分预算之上，启动长任务 >500 ms，体积没人追踪。
- **8 分**：除自身、data: 与 blob: 以外 0 个请求；严格 CSP 下 0 违规；在 `<iframe sandbox="allow-scripts">` 中可用；index.html ≤450 KB gzip / ≤2 MB raw（styleProfiles.C.budgets）；首帧 ≤400 ms；最长启动任务 ≤250 ms；预算不得靠删减美术达成（C13.6）。
- **10 分**：≤300 KB gzip / ≤1.2 MB raw；首帧 ≤200 ms；没有 >100 ms 的启动任务（天空与骑者先建，其余带在 idle 回调里建）；poster.png ≤600 KB；≥10 s 的 1080p preview.webm ≤4 MB；预算表写在 budgets.json（noscript 字节单列），由 build.mjs 强制执行，并打印在 README 里。

**测量**：[script] 新 tools/audit-dist.mjs：file:// 下用 page.route('\*\*/\*') 记录每个请求；以 Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src blob: 提供 dist，统计 securitypolicyviolation 事件；分别在 `<iframe sandbox='allow-scripts'>` 与 `<iframe sandbox='allow-scripts allow-downloads'>` 中加载（下载按钮必须优雅降级）；index.html、SVG、海报、webm 的 raw / gzip -9 / brotli 体积；5 次冷启动取首帧标记 \_\_pb.firstFrameAt、FCP 与最长 longtask/LoAF 的中位数。

**证据**：perf/dist-audit.json；budgets.json

#### C10.6 跨引擎：Chromium 与 WebKit 实测，Gecko 静态审计

维度内权重 0.5（占本维度 7%，折合总分 0.29 分）· 测量方式：自动脚本

- **2 分**：依赖 Chromium 独有行为（CSS d: 属性，Safari 不支持）、没有回退的无前缀 API、ES2023+ 语法；Chromium 之外零测试。
- **5 分**：只有静态审计；若干已知风险未处理；esbuild target 保持默认。
- **8 分**：WebKitGTK：0 错误，hero、3 个机位与夜间对 Chromium 的 SSIM ≥0.95，烘焙 SVG 会动；Gecko 审计干净，或每个命中都有显式回退；esbuild target 覆盖 Safari 15+ 与 Firefox 115+。
- **10 分**：WebKitGTK 的 12 帧条带与烘焙 SVG SSIM ≥0.98；WebKitGTK wide ≥50 fps（若 R0 证明 xvfb 软件 GL 下不可测，按 N/A 政策处理）；每个怪癖都连同证明它的测试写进文档；每个特性检测回退都有"删掉该特性"的测试；README 的各引擎特性矩阵每一行都有测试支撑，并写明 WebKitGTK 只是 Safari 的代理。

**测量**：[script] 新 tools/xb-webkit.mjs：R0 先探测 apt 能否安装 libwebkit2gtk-4.1-0 与 webkit2gtk-driver（需要网络并改动容器；全新克隆的 verify 不依赖它，装不上时 verify 输出"xb: 未运行（原因）"并按 N/A 政策处理）；可用时用 npm selenium-webdriver 在 xvfb-run 下驱动 WebKitWebDriver，加载 dist/index.html?freeze，调用 \_\_pb.renderAt 渲染 hero、3 个机位、夜间与 12 个曲柄相位，读回注入的错误收集器，截图与 Chromium 比 SSIM；烘焙 SVG 作为 `<img>` 在 3 个时刻截图。新 tools/xb-audit.mjs grep bundle 与 SVG：CSS d: 属性、未显式设置的 transform-box/transform-origin、@property、mix-blend-mode、calcMode=spline 却没有 keySplines、命令不一致的 d 动画、100vh 与 dvh、没有 webkit 回退的 AudioContext、超出 esbuild target 的语法。

**证据**：docs/eval/xb.json；shots/eval/xb/\*.png

#### C10.7 生命周期与环境鲁棒性

维度内权重 1（占本维度 14%，折合总分 0.57 分）· 测量方式：自动脚本

- **2 分**：在常见环境里坏掉：file:// 空白、localStorage 抛错导致初始化失败、resize 报错；隐藏标签页返回后骑者瞬移或排队的声音一起爆出；?tod=abc 产生 NaN 变换；JS 关闭时一片空白。
- **5 分**：桌面可用，但部分边缘视口（844×390、2560×1080）裁到骑者或在电影滚转时露缝；恢复时 sim 时间跳变被夹在 50 ms，但隐藏时音频仍在跑；暂停时 rAF 仍在跑（phase-0 main.js）；rig:land 用 setTimeout(750) 壁钟定时（phase-0 main.js:72），在暂停或隐藏时照样触发。
- **8 分**：robust.mjs 全部通过：隐藏时 renderer TaskDuration 每 30 s 增长 ≤0.3 s，AudioContext 250 ms 内挂起，恢复后第一帧 sim 时间前进 ≤50 ms；11 个视口 × 3 机位下骑者 bbox 边距 ≥3%，8 个边框像素都不同于页面背景；3 s 内 30 次 resize 风暴后 0.5 s 内恢复并等同全新加载；30 次/s、持续 60 s 的键鼠风暴后姿态有限、events ≤32；JS 关闭时 `<noscript>` 至少显示海报与双语说明；50 个模糊 URL 参数 0 错误；所有存储访问都有 try/catch；事件时序全部基于 sim time（没有 setTimeout）。
- **10 分**：8 分全部满足，另加：JS 关闭时 `<noscript>` 内联 dist/pelican-mini.svg 或低 LOD 烘焙版（0 s 与 1 s 截图不同，字节在 budgets.json 单列）；减少动态的实时变更与跳车中途旋转屏幕都正确；bfcache pagehide/pageshow 往返后干净恢复；在 Artifact iframe 中未获焦点时显示"点击以启用快捷键"提示，滚出视野时暂停（IntersectionObserver）；暂停时 rAF 循环完全停止（0 次回调/s）、CPU ≤1%；DPR 1/1.5/2/3 下清晰度 SSIM ≥0.98。

**测量**：[script] 新 tools/robust.mjs：CDP Page.setWebLifecycleState frozen 30 s 后 active；在 xvfb-run 下的有头 Chromium 中打开第二个页面并 bringToFront，做真实隐藏检查；断言 Performance.getMetrics 的 TaskDuration 增量、rAF 次数、经垫片记录的 AudioContext.state 时间线、恢复后第一帧 state.t 增量。视口：320×568、390×844、844×390、768×1024、1024×768、1280×720、1600×900、1920×1080、2560×1080、3840×2160、1000×300，每个配 3 个机位；实时 resize 风暴；DPR 1/1.5/2/3；emulateMedia({reducedMotion:'reduce'}) 加载时与实时；键鼠风暴后校验 \_\_pb.pose() 与状态边界；暂停 CPU 检查。新 tools/contexts.mjs：file://、本地 http、sandbox='allow-scripts' 的 iframe（Storage.prototype 方法被覆盖为抛错）、javaScriptEnabled:false、50 个模糊查询串（?tod=NaN&cam=`<script>`&cadence=1e9…）。

**证据**：docs/eval/robust.json；docs/eval/contexts.json

#### C10.8 控制台卫生与故障隔离

维度内权重 0.5（占本维度 7%，折合总分 0.29 分）· 测量方式：自动脚本

- **2 分**：正常使用中就出现错误（NaN 变换、找不到元素、加载时的 AudioContext 警告）。
- **5 分**：快乐路径 0 错误，但有警告（autoplay、弃用），或猴子测试、resize、减少动态下出现错误；某个模块的 update() 抛一次错就被静默置为 null，这个功能从此冻结而没人发现。
- **8 分**：dist 全集、移动端、减少动态、沙箱 iframe、12 分钟 soak 与 WebKitGTK 下 0 错误、0 警告、0 未处理 rejection、0 失败请求、0 CSP 违规。
- **10 分**：8 分全部满足，另加：每个模块的故障注入都通过（?inject=throw:`<module>`:`<build|attach|update>`：恰好 1 条 console.error，其余场景继续渲染，fps 稳定，测试还断言哪些功能仍然存活）；能力缺失矩阵通过（无 AudioContext、localStorage 抛错、matchMedia 无 change 监听）；每个工具都打印单行 'errors: 0 across N loads / M interactions'。

**测量**：[script] 所有工具共用一个收集器：console 的 error 与 warning、pageerror、requestfailed、securitypolicyviolation，以及注入的 unhandledrejection 监听。流程：shoot.mjs --dist --set hero,frames,tods,cams,events,mobile；soak.mjs；robust.mjs；audit-dist.mjs 的 iframe 与 CSP；xb-webkit.mjs。故障注入通过 main.js 处理的 URL 标志，依次作用于每个模块的 build、attach、update。

**证据**：docs/eval/console.json；docs/eval/fault-injection.json

### D11 零 JS SVG 与交付物

*Standalone SVG & deliverables* · **权重 7** · 来源镜头：E7、P6、mech-baked、ENG-4、showcase-packaging、UX9、ENG-8

这道基准字面上要的是一个 SVG。dist/pelican-bicycle.svg 单独放进 Simon 的网格里，也必须是其中最好的一个；它必须是同一个 rig 的忠实推导，而不是降级导出。其余交付物（webm、海报、联系表、下载、README、PR、Artifact）要构成一次作品集级别的发布。

#### C11.1 独立 SVG 本身就是最强的参赛作品

维度内权重 3（占本维度 43%，折合总分 3.00 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：缺失、静态、含 `<script>`、或不能作为 `<img>` 渲染；或者是一张套着 SVG 外壳的位图（base64 PNG）——评审会视为作弊。
- **5 分**：在 Chromium 中会动，但循环接缝跳变、N 次循环后路面相对轮胎漂移、或与实时页面明显不同；去掉动画后（静态渲染器、预览器）骨架塌在原点，显示成一只散架的鹈鹕；没有 pelican-mini.svg。
- **8 分**：结构干净：页内 DOMParser 无 parsererror；&lt;script、\\son[a-z]+=、javascript:、href="http、&lt;image、&lt;foreignObject、var(-- 各 0 处；带 `<title>` 与 `<desc>`；≤2 MB raw / ≤500 KB gzip（styleProfiles.C）；作为 `<img>`、CSS background、`<object>` 与直接打开都会动；作为 `<img>` 在软件光栅下 ≥30 swaps/s；静态回退：删掉全部 `<animate*>`/`<set>` 并禁用 CSS 动画后，基础属性渲染出 hero 姿态并通过 check-benchmark；手写的 dist/pelican-mini.svg（≤16 KB、SMIL 动画、按 definitions.handWritten 产生）必须存在并通过 CANON-14，在与第 1 层同模型单次对照同等条件的盲评中胜率 ≥60%。
- **10 分**：≤1.2 MB raw / ≤300 KB gzip；作为 `<img>` 在 1600×900 软件光栅下 ≥55 swaps/s；100 次循环后仍无缝；pelican-mini.svg 对第 1 层单次对照胜率 ≥80%，且在 3 名盲评的 CANON-14 逐项清单中全部通过；可选：用 @property + CSS @keyframes 在 SVG 内实现 24 小时昼夜循环。

**测量**：[script] 扩展 tools/check-baked.mjs 的静态检查（字节与 gzip 体积、上述 grep、xmllint --noout 或页内 DOMParser）与加载方式检查（`<img>` 于 600×338 与 1600×900、background-image、`<object>`、直接导航；骑者 bbox 在 0、0.37、0.81 s 的截图必须不同）；check-baked --static：在 Chromium 中删除动画节点、禁用 CSS 动画，截图并跑 check-benchmark（可选：R0 探测 apt 能否装 librsvg2-bin 以做真正的 rsvg-convert 检查）；tools/perf.mjs 用 viz trace 测 `<img>` 呈现帧率；pelican-mini.svg 的转录哈希对照 ledger.json。[judge] 3 名盲评对烘焙 SVG 的 6 帧（notext）逐项回答 CANON-14；pelican-mini.svg 进入 field.mjs 的静帧组与第 1 层单次对照做同等条件配对。

**证据**：docs/eval/baked.json；docs/eval/baked-static.json；docs/eval/mini.json；dist/pelican-bicycle.svg；dist/pelican-mini.svg

#### C11.2 烘焙保真、循环完整与机械不变量

维度内权重 2（占本维度 29%，折合总分 2.00 分）· 测量方式：自动脚本

- **2 分**：烘焙结果是静态快照或只有轮子在动；循环明显跳变；角度没有展开（350→10 走了短路），轮子因此倒转，或骑者在关键帧之间离开车子。
- **5 分**：骑者会动、世界会滚，但接缝跳变、全帧 SSIM 只有 0.85–0.9、次级动作丢失、关键帧之间脚离踏板 2–5 u、接缝处轮胎打滑、每个循环因角度回绕倒转一次。
- **8 分**：48 个循环相位上对实时 renderAt(t,{tod:0.70,cam:'wide',cadence:60}) 的 SSIM 全帧 ≥0.97、骑者裁剪 ≥0.96；接缝比 ≤1.2（diff(T−1/60, 0) / 相邻帧差中位数）；机械检查全部精确：车轮与曲柄 dur 相同、比例 3.000±0.001，链条 dashoffset 每曲柄循环 −48 节，路面瓦片在 T 处的位移 = 1884.96 × depth × k（整曲柄圈），240 个探测时刻用 getCTM 测得脚掌球到踏板 ≤1 u、腕到握把 ≤1 u，飞轮锁定曲柄，全部顺时针；页内 Download 按钮输出与 node tools/bake.mjs 输出字节一致（sha256）。
- **10 分**：全帧 SSIM ≥0.99、骑者 ≥0.985；次级动作与颈部变形都保留；旋转用展开角的 2 关键帧线性循环；采样部件在 240 个探测时刻误差 ≤0.3 u；frame(T) 与 frame(0) 0 像素差，10T 与 100T 无漂移；关键帧精简有误差上界并报告（精简后的最大关节误差）；WebKitGTK 对 Chromium SSIM ≥0.98；按元素组给出体积拆分；发布 live | baked | diff 热图表。

**测量**：[script] 扩展 tools/check-baked.mjs：把 SVG 内联到测试页，pauseAnimations() 后在 48 个相位与 {0, T/4, T/2, 3T/4, T−1/60, T, 10T, 100T} 调 setCurrentTime(t)，与同参数 renderAt 比 SSIM（或 pixelmatch 平均绝对差），全帧与骑者 bbox 各一次；解析文件：values/keyTimes 数量一致、keySplines 数 = 区间数、每个 d 动画的命令签名一致、每 T_c 的旋转总量与虚线总量、瓦片位移；用 page.on('download') 截获 Download 按钮的 blob 求 sha256；WebKitGTK 上跑同样 48 个相位。新 tools/loop-seam.mjs 做接缝与漂移检查（与 C6.5 共用）。

**证据**：docs/eval/baked.json；shots/eval/baked-parity.png

#### C11.3 确定性预览视频、海报与联系表

维度内权重 0.5（占本维度 7%，折合总分 0.50 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：交付物缺失；或 webm 是实时录屏，有掉帧或倒转；或海报就是一张原始截图。
- **5 分**：文件都在且正确但很平淡：海报是原始截图，联系表没有标注，webm 帧数不等于时长 × 60。
- **8 分**：preview.webm 由 renderAt 逐帧确定性渲染（两条允许的路线：(a) JPEG q100 帧 → ffmpeg mjpeg image2pipe → libvpx_vp8；(b) 优先：页内 WebCodecs VideoEncoder vp8/vp9 + 固定版本的 JS webm muxer，在 file:// 或 localhost 安全上下文中运行），60 fps，帧数 = 时长 × 60、0 重复帧、首尾帧差 <0.5%，开头就是钩子且无缝循环；海报 ≥3840×2160，用风格 C 字形排版；联系表标注每帧曲柄角（24 帧真时间踩踏循环）；有 1200×630 社交卡。
- **10 分**：8 分全部满足，另加：海报帧由 ≥200 个候选经盲评淘汰赛选出，且淘汰赛只在种子化候选集上进行（候选生成规则在 R0 固定）；有声版预览（WebCodecs AudioEncoder opus 编码 OfflineAudioContext 的确定性渲染，与视频同一 muxer 合封，帧数精确）；一个曲柄周期的动画联系表。

**测量**：[script] 新 tools/judge/package.mjs：解析 PNG 头得尺寸；用本地 ffmpeg（libvpx_vp8 解码器 + png 编码器 + image2 muxer 均可用）把 webm 解码成 PNG，逐帧哈希查重，并比较首帧与末帧（Δ <0.5%）；VP9 文件改在 Chromium 中用 `<video>` + requestVideoFrameCallback 逐帧解码。[judge] 海报淘汰赛；视觉评审看海报、联系表与社交卡。

**证据**：dist/poster.png；dist/contact-sheet.png；dist/preview.webm；docs/eval/package.json

#### C11.4 分享与下载：从不静默失效

维度内权重 0.5（占本维度 7%，折合总分 0.50 分）· 测量方式：自动脚本 + 实时交互测试

- **2 分**：下载按钮缺失或静默无效；下载的 SVG 含脚本、作为 `<img>` 不会动；烘焙时页面冻结数秒。
- **5 分**：只有在 file:// 下才能下载 SVG；文件名泛泛（'download.svg'）；没有进度也没有 toast；在 Artifact 里是个死按钮（phase-0：a.click() 的 blob 下载在沙箱 iframe 中可能静默无效，bakeSVG 在点击处理函数中同步执行）；PNG 只有 1×。
- **8 分**：SVG、海报 PNG（≥2×）与"复制链接"都可用；文件名形如 pelican-bay-golden-hour.svg；烘焙 >300 ms 时显示带 aria-busy 的进度，且没有 >100 ms 的长任务；'已保存 / Saved' toast 恰好播报一次；沙箱测试中要么真的下载，要么显示可见的回退；下载的 SVG 通过 check-baked；README 说明如何以 `<img>` 嵌入。
- **10 分**：8 分全部满足，另加：比例预设（16:9 桌面、9:16 手机壁纸并使用竖屏构图、1:1 社交）与可选双语题字；移动端 canShare 时用 navigator.share({files})；深链（hash 编码 tod、cam、cadence、lang、t）能复现同一帧（像素差 <1%）；下载的 SVG 带双语 `<title>`/`<desc>`、署名与减少动态的海报切换；下载前显示文件大小；R0 发布探针确定的 Artifact 沙箱行为下，每个按钮要么可用、要么有可见回退（在已发布 Artifact 中逐个按钮的人工验证是可选的用户检查，只有用户报告后才写进 PR）。

**测量**：[script] 新 tools/export-check.mjs：对每个分享按钮 page.waitForEvent("download")，断言 suggestedFilename 匹配 /^pelican-bay-[a-z0-9-]+\\.(svg|png)$/、SVG 通过 check-baked 的结构检查、有 `<title>` 与 `<desc>`；作为 `<img>` 渲染时 t=0.3 s 与 0.8 s 的帧不同，t=0 与 t=period 差 <0.5%；PNG 尺寸与所选预设一致；烘焙期间 PerformanceObserver longtask 看不到 >100 ms 的任务，>300 ms 时出现 aria-busy 的进度元素；live-region toast 恰好触发一次；深链复现。在 tools/contexts.mjs 的 iframe 中按 R0 发布探针发现的沙箱标志重复全部检查：要么触发 download 事件，要么出现可见回退，绝不能什么都不发生。R0 发布探针：发布一个极小的探针页，读回并与源码 diff，记录宿主改动了什么、哪些 API 抛错（docs/eval/publish-probe.json）。[live-test] 可选的用户检查：用户在已发布 Artifact 中试按钮后的反馈，记入 docs/eval/user-checkpoint.json。

**证据**：docs/eval/export.json；docs/eval/publish-probe.json

#### C11.5 README、PR 与 Artifact 的发布包装

维度内权重 1（占本维度 14%，折合总分 1.00 分）· 测量方式：自动脚本 + 代码审查 + 视觉评审

- **2 分**：没有 README，或只是一段营销文案 / 功能列表；交付物缺失。
- **5 分**：README 有功能与控制说明，但数字是手打的、部分命令已过时、文档互相矛盾（多份键位表）、没有架构或"如何制作"章节。
- **8 分**：双语 README（中文在前）：hero 图 + webm 链接；一行快速开始；由 contract.js 生成的控制表；架构图与 rig 数学摘要；由 perf/\*.json 注入实测值的预算表；带大小与哈希（来自 MANIFEST）的交付物清单；已知局限；"How it was made"（阶段、按角色分列的代理数——构建者与评估者分开、不给单一总数、rubric、分数轨迹、覆盖矩阵、ledger 链接）；署名与许可（Simon Willison 的 pelican 基准、Gianluca Gimini 的 Velocipedia，带链接、不暗示背书；docs/THIRD_PARTY.md 列出 WenQuanYi Zen Hei（GPLv2 + 字体嵌入例外）与 DejaVu 等全部字体与素材来源；仓库有 LICENSE）；tools/check-docs.mjs 在干净克隆中执行 README 的每个 sh 代码块，0 失败。PR 读起来像发布说明：verify 汇总表、hero 图、Artifact 与证据链接、对照硬门槛的清单、已知问题。Artifact 已发布，各交付物互相链接。给用户的交接说明 docs/handoff.md（中文）：Artifact（注明默认私有）、PR 与 dist 文件链接，R-final 总分与各维度分（标注同模型自评）、门槛结果、未达标项，通过 readme-lint 并在 claims.json 范围内。
- **10 分**：8 分全部满足，另加："鹈鹕阶梯"制作花絮（匹配投入基线与同模型单次对照 → 所选草稿 → 零 JS 烘焙 SVG → 完整交互页面，附每轮 rubric 分数与联系表，诚实展示过程增加了什么，也展示没做到的）；README 与 PR 描述中嵌入的动画 SVG 在 GitHub 页面上就会动；给读者的阅读顺序能在 5 分钟内从声明走到证据。

**测量**：[script] 新 tools/check-docs.mjs：抽取 README.md 与 CONTRACT.md 中的 sh/bash 代码块，在临时克隆中执行，非零退出即失败；抓取 README 与 docs/handoff.md 中的每个数字，断言它出现在 perf/\*.json、MANIFEST.json、check-rig JSON 或 ledger.json 中（构建时以 {{…}} 模板注入）；断言 docs/THIRD_PARTY.md 列出所有 gen / tool 代码中出现的字体路径，且 LICENSE 存在。[code-review] 必备章节清单；与 C12.1 的漂移测试交叉比对。[judge] 看渲染后的 README 与 PR 页面。

**证据**：README.md；docs/handoff.md；docs/THIRD_PARTY.md；docs/eval/docs.json；docs/eval/publish.json（PR 与 Artifact URL）

### D12 工程严谨、可验证与诚信

*Engineering rigor, verifiability & honesty* · **权重 5** · 来源镜头：ENG-1、ENG-2、ENG-3、ENG-6、ENG-9、ENG-10、ENG-11、E9、E10、P5、P11

把"最强"变成可以被外人检验的事实：机器强制的契约、被证明的纯 rig、确定性渲染与视觉回归、从全新克隆一条命令复现、每条声明都有证据、页面自己能证明自己、多智能体过程本身就是证据而非叙事。

#### C12.1 架构与契约一致：单一事实源，由机器强制

维度内权重 0.5（占本维度 6%，折合总分 0.31 分）· 测量方式：自动脚本 + 代码审查

- **2 分**：模块互相伸进对方的 DOM 或全局；所有权只写在文字里；几份规格互相矛盾，没人说得清哪份是权威。
- **5 分**：phase-0 现状：contract.js 已冻结，checkIds 在运行时捕获重复 id；但文档互相矛盾（多份键位表；close 机位在 rig-spec 中是 zoom 2.0 / fy −380，而 contract.js 是 1.55 / −285；plan 的文件表已过时），lint 漏掉了裸 hex（main.js 与 fx.js 中的 #000），前缀不做检查。
- **8 分**：tools/check-contract.mjs 0 违规：esbuild metafile 导入图规则（art/world/fx 之间不互相导入，rig/\* 与 contract 只导入 core/math）、slot/layer 所有权、每个 id/class/data-ref 都带模块前缀、hex 只允许出现在 core/palette.js；纯模块在 node:vm 中 document 与 window 未定义的情况下能导入；每张文档表格都与 contract.js 一致。
- **10 分**：8 分全部满足，另加：键位、机位、预算、所有权表在 README、CONTRACT.md 与页内 '?' 帮助层中都由 contract.js 在构建时渲染（任何手改都会让漂移测试失败）；由真实 metafile 生成的架构图（模块、边、字节数）随 docs 与 Artifact 发布；种子"坏模块" fixture 证明每条规则都会真的触发。

**测量**：[script] 新 tools/check-contract.mjs：(a) esbuild metafile:true 断言导入边规则；(b) 在 node:vm 中无 DOM 导入每个纯模块；(c) 在 node 中调用每个 build(ctx)，断言所有 id、class、data-ref 以模块前缀开头；(d) 在 core/palette.js 之外 grep /#[0-9a-f]{3,8}\\b/i，任何命中即失败；(e) 从 README、CONTRACT 与 UI 帮助中抽取键位、机位、预算表，与 contract.js 深比较；外加负例 fixture 测试：违反每条规则的变异模块都必须被拒绝。[code-review]。

**证据**：docs/eval/contract.json；docs/architecture.svg

#### C12.2 纯函数、精确周期、属性测试与变异测试的 rig

维度内权重 1.5（占本维度 19%，折合总分 0.94 分）· 测量方式：自动脚本

- **2 分**：姿态逻辑与 DOM 或隐藏状态纠缠；没有测试，或测试只断言"没有 NaN"。
- **5 分**：phase-0 现状：check-rig 覆盖 3 个踏频 × 1441 个曲柄样本，但只在固定 t=1.234、没有事件；脚、手、膝、跳变检查通过（脚误差 0.0000，最大跳变 0.118°）；事件、滑行、齿比/链条一致性都没测，所以滑行飞轮 bug 与 renderAt crankDeg 失步都漏过去了；不存在任何 node --test 文件。
- **8 分**：node --test src/rig 覆盖全部不变量并在 <10 s 内通过。网格：cadence {20,40,60,90,110} × 曲柄 0..360 步长 0.25° × coasting {0,1} × 事件 {无, hop@k/100, wave@k/100, bell, gulp, hop+wave 重叠} × reduced {0,1}。阈值：脚与腕误差 <0.01；膝的叉积符号恒定；每步关节变化 <0.5°；无事件时周期误差 <1e-9；任何时刻 |cog − 3·crank| mod 360 <1e-6；chainOffset 斜率 −48/2π 每弧度；座接触 1 u 内；膝离腹 ≥30；趾离前胎 ≥0；跳车时 pelvisDy ∈[−4,6]。纯度：对 Object.freeze 过的输入调用两次深相等，Date、performance、Math.random 替换为抛错桩也能运行。输出含每个不变量最坏值的 JSON 报告。
- **10 分**：8 分全部满足，另加：种子属性模糊测试（≥10k 个随机状态），失败用例自动收缩；对 src/rig 做自动 AST 变异（每个算术、比较运算符与常量），在完整变异集上报告变异得分 ≥85%（手挑的变异体只作补充）；生成的 SVG 图（360° 内髋→踏板距离与 IK 可行带、膝与肘角、关节角速度连续性）发布在 docs 中。

**测量**：[script] node --test src/rig；node tools/check-rig.mjs --json out.json；新 tools/mutate-rig.mjs 用 AST（esbuild 或 acorn，pinned）对 src/rig 的每个运算符与常量生成变异体，应用到临时副本上并断言测试套件失败，报告完整集合上的得分与存活变异体清单。

**证据**：docs/eval/rig.json；docs/eval/mutants.json；docs/rig-proof.svg

#### C12.3 确定性渲染与视觉回归

维度内权重 1（占本维度 13%，折合总分 0.63 分）· 测量方式：自动脚本

- **2 分**：截图是在任意 sleep 后从实时播放中抓的，每次运行都不一样；没有基线；帧依赖历史（粒子、机位弹簧或调色板脏标记把状态带进了 renderAt）。
- **5 分**：大体确定（renderAt + 种子 rng），shoot.mjs 遇到控制台错误就失败；但没有基线、没有 diff 工具；frames 集自相矛盾（crankDeg 覆盖只移动链条，不移动车轮与飞轮）；跳车的 land 事件用 setTimeout；CJK 路牌依赖系统字体；30 Hz 与 144 Hz 之间速度差约 2%。
- **8 分**：完整渲染集连跑两次 0 像素差；30 个种子元组（t∈[0,600]、tod、cam、cadence、events）全新渲染与经历 50 次随机 renderAt 之后的渲染 PNG SHA-256 相同；dev 与 dist 一致、两次独立 chromium.launch() 一致；新钩子 \_\_pb.simulate(dtArray) 在 30/60/120/144 Hz 与抖动 dt 下跑 120 s sim 时间，路程误差 ≤1e-3；t = 36,000 s 时连续 20 帧的 getCTM 增量均匀；lint 对纯模块中的 Math.random、Date.now、performance.now 直接 FAIL；test/golden/ 基线由 tools/vr.mjs 检查（YIQ 阈值 0.1，任一帧 >0.05% 像素变化即失败），且故意把 SKEL.hipNear 挪 1 u 会让 VR 失败。
- **10 分**：8 分全部满足，另加：t = 360,000 s 仍通过；积分误差 ≤1e-6（定步长或解析 + 插值）；事件时序完全在 sim time；烘焙 SVG 的 setCurrentTime 也是确定的；golden-hash 清单入库并由脚本检查；VR 为每一次被接受的视觉变更生成 before/after/diff 联系表，每个评审驱动的修复都链接到它的 diff 裁图；基线只能通过 npm run vr:accept 并在 changelog 中写明理由才能重生成。

**测量**：[script] 新 tools/determinism.mjs（检查 a–f：新鲜 vs 历史、dev vs dist、两次 launch、dt 独立性、大 t 精度、强化的 lint）+ 新 tools/vr.mjs --baseline test/golden；grep src 中 main.js 循环与 audio 之外的 setTimeout、setInterval、Date.now、performance.now，每一处都要有理由。

**证据**：docs/eval/determinism.json；test/golden/MANIFEST.json；docs/eval/vr/\*.png

#### C12.4 一键可复现：从全新克隆构建并验证

维度内权重 0.5（占本维度 6%，折合总分 0.31 分）· 测量方式：自动脚本

- **2 分**：手工、没有文档的步骤；只能在这个容器里跑。
- **5 分**：phase-0 现状：分散的脚本（build、shoot、check-rig、lint），npm run check 只覆盖 rig 与 lint；Playwright 从绝对路径 /opt/node22/lib/node_modules/playwright/index.mjs 导入，且不在 devDependencies 里；没有 verify 或 test 脚本；没有任何检查确认已提交的 dist 与 src 一致。
- **8 分**：从 git clone 到临时目录后 npm ci && npm run verify 通过，4 CPU 上 <10 分钟：verify（快速）依次执行 lint → check-contract → node --test → check-rig → build → dist 冒烟截图（file://）→ check-baked 结构检查 → 一次 5 s perf 冒烟 → 确定性子集；所有依赖 pinned（playwright 进 devDependencies，Chromium revision 记录在案）；两次构建的 dist/index.html 与 dist/pelican-bicycle.svg sha256 相同；dist/MANIFEST.json 列出每个文件的 sha256、大小、工具版本、Node 与 Chromium 版本和源提交；有测试证明已提交的 dist = build(已提交的 src)；npm run verify:full 运行全部 MR-\*，只在 R-final 必需，墙钟时间记入 verify.txt。
- **10 分**：8 分全部满足，另加：GitHub Actions（mcr.microsoft.com/playwright:v1.56.x 镜像）跑同一个 verify 并上传渲染、perf 与 VR diff，PR 中链接绿色运行（若推送 workflow 文件被拒，按 N/A 政策在 R0 处理）；verify 打印一张汇总表，原样贴进 PR 与 README；在全新 worktree 中的新代理复现全部数字。

**测量**：[script] rm -rf /tmp/pb && git clone `<repo>` /tmp/pb && cd /tmp/pb/pelican-bicycle && npm ci && time npm run verify（<600 s、退出码 0）；构建两次并比较 sha256sum dist/\*；grep -rn "/opt/node22\\|/home/user" tools src 必须为空；package.json 的 devDependencies 对照 tools/\*.mjs 的导入；校验 dist/MANIFEST.json 的 schema 与哈希；可选：通过 GitHub API 读 CI 运行状态。入口为 tools/verify.mjs（npm run verify / verify:full），汇总表写入 docs/eval/verify.txt。

**证据**：dist/MANIFEST.json；docs/eval/verify.txt；CI 运行链接

#### C12.5 声明溯源与诚信

维度内权重 1.5（占本维度 19%，折合总分 0.94 分）· 测量方式：自动脚本 + 代码审查

- **2 分**：捏造或不可验证的数字（'60fps everywhere'、'hundreds of agents'）；声称用了实际没用的工具或模型（Blender、其他 AI）；暗示这是一个击败具名模型的基准结果。
- **5 分**：声明是真的，但是手抄的，部分已经过时（例如从未重新验证过的机位描述）；性能数字没有测量条件说明；代理数四舍五入往大了报；只报 rAF fps；局限章节很单薄。
- **8 分**：docs/claims.json 把 README、PR 正文、Artifact 文字、docs/handoff.md 以及 README 链接到的每份已提交文档（rubric、计划、ledger 说明）中每一条定量、比较、能力或外部事实声明映射到命令与已提交的证据文件（外部事实需要来源 URL 与访问日期，否则删除或标"未核实（子代理检索）"），tools/verify-claims.mjs 从干净检出通过；tools/readme-lint.mjs 标出任何含数字、fps、%、every/never/zero/best/first/only、"每 / 从不 / 零 / 最 / 首个 / 唯一"或评价性形容词（电影级、令人屏息、世界级、breathtaking、cinema-grade、stunning、the first time…）却没有 [c:id] 或 [opinion] 标签的句子；rubric 分数只能以"同模型自评"标注出现；代理数按角色分列（构建者 vs 评估者），不发布单一总数；"用了 / 没用"清单完整；性能数字注明"无头 Chromium、软件光栅、4 vCPU"；Wilson 等置信区间不得作为总体统计出现在 README 或 Artifact；列出 ≥5 条诚实局限；作品定位为"工具辅助的多智能体制作"。
- **10 分**：8 分全部满足，另加：README 指标块由 npm run verify 重生成并 diff 检查；新代理在干净 worktree 中复现全部数字；评估证据全部公开（评审提示词、field.json 的聚合结果、每轮分数与联系表；第三方作品只给链接）；措辞精确，对任何其他模型不作优劣声明；Artifact 中每个标题数字旁都有"证据"链接；失败与成功并列展示。

**测量**：[script] 新 tools/verify-claims.mjs（执行 docs/claims.json 中的每条命令并检查其谓词；覆盖范围含 rubric.json 与 docs/handoff.md）；新 tools/readme-lint.mjs（含评价性形容词表）；grep "Blender|GPU|Astra|GPT|Gemini|Fable" 只允许出现在"未使用 / 未比较"的语境；代理数对照 ledger.json 按角色统计。[code-review] 人工逐句审计 README、PR 正文、Artifact 文字与交接说明。

**证据**：docs/claims.json；docs/eval/claims.json

#### C12.6 页内自证：X 光检查模式

维度内权重 0.5（占本维度 6%，折合总分 0.31 分）· 测量方式：实时交互测试 + 自动脚本

- **2 分**：什么都没有：所有声明只存在于 README 里。
- **5 分**：只有一个藏在 URL 参数后面的骨架叠加（?skeleton=1），没有读数，也无从发现。
- **8 分**：可发现的检查模式（在"幕后 / Behind the scenes"入口内，X 键或 ?inspect=1，帮助中列出）：骨架、枢轴、IK 可达环、近 / 远肢体分别着色；实时读数从渲染后的 DOM（getScreenCTM）或像素计算，直接回显 solver 的数值一律标注"solver"；读数与 check-anchors / check-noslip 的数值相差 ≤0.05；曲柄角擦洗条、0.1× 慢放与逐帧（, 与 .，±1/60 s），键盘与触控都可用。
- **10 分**：8 分全部满足，另加：擦洗得到的帧与同曲柄角的 renderAt 差 ≤0.5%；检查模式本身按风格 C 设计（蓝图式印版），在每个时段都清晰，开启时 ≥50 fps；包含车架蓝图尺寸线与"真鸟腿"解剖图；页内"声明"抽屉只展示从 DOM 或像素实时测得的项，solver 自检项明确标注为"solver 自检（按构造成立）"。

**测量**：[live-test] 新 tools/check-inspect.mjs（Playwright 实时测试）：按 X，从 DOM 读 HUD 文本，与 check-rig 与 check-noslip 输出比较（|Δ| ≤0.05）；擦洗到 0/90/180/270° 并与 renderAt({crankDeg}) 像素比较；按 ',' 与 '.' 断言 sim 前进 ±1/60 s。[script] 检查模式开启时跑 perf.mjs（≥50 fps）；擦洗帧与 renderAt 的像素差 ≤0.5%。

**证据**：docs/eval/inspect.json；shots/eval/inspect/\*.png

#### C12.7 多智能体过程可验证与 git 卫生

维度内权重 1（占本维度 13%，折合总分 0.63 分）· 测量方式：自动脚本 + 代码审查

- **2 分**：声称有"几十个代理"，却没有任何可检查的东西；一个巨型提交、中间状态是坏的、工作区是脏的、node_modules 或 shots 被提交。
- **5 分**：phase-0 现状：workflow 脚本与计划已提交，但没有 ledger、没有所有权审计、没有 finding→fix 追溯、评分没有锚点；wf-build.v0.js 在第 2 轮修复后直接退出、不再重新评分，所以报告的"最终分"其实是修复前的；构建者对着别人正在编辑的共享树自检；草稿 B 已修改而 C/D/E 未跟踪；代理不能提交，因此没有逐代理的出处。
- **8 分**：docs/team/ 包含：实际运行过的每个 workflow 脚本（v0→vN，附差异说明）、本 rubric、ledger.json（每个代理的标签、角色、提示词哈希、拥有的文件、实际触及的文件、读过的文件、每次工具调用、起止时间、运行的命令与退出码、读过的截图、结构化报告）、每轮评审的条目判定 JSON；覆盖矩阵 docs/team/coverage.json（由 rubric.json 与 wf-build.vN.js 生成：criterion → 产出构建者 → 工具 → 评审位 → 证据路径），脚本断言 100% 覆盖；每个 blocker/major 发现都有状态、提交 sha 与 before/after 裁图；所有权审计 0 越界；评审隔离审计 0 越界（任何读过证据包之外文件的评审作废）；最终分数来自最后一次修复提交之后的重新评分；有每个维度跨轮的分数轨迹；工作区干净；按阶段 / 代理的原子提交（带要求的 Co-Authored-By 与 Claude-Session）；每个提交都能构建并通过快速检查；仓库增量 ≤25 MB、没有 >5 MB 的文件；构建者在 git worktree 中隔离，或 shoot 串行执行。
- **10 分**：8 分全部满足，另加：一个"过程回放"视图（在"幕后"入口内；由 ledger 生成的代理甘特图，可点开提示词、拥有文件、diff、看过的截图与报告），可以用一条命令从已提交的 JSON 重生成；两名独立评审每个维度相差 ≤1 分（否则由第三名裁决并记录）；负面结果公开；仅凭 git log + ledger.json 就能重建过程时间线。

**测量**：[code-review] docs/team/wf-build.vN.js：最终评审在最后一个 fixRound 之后运行；评审拿到锚点条目；盲评提示中不含构建者报告；构建者在隔离 worktree 中工作或 shoot 串行化。[script] ledger.json schema 校验；tools/coverage.mjs 生成并断言覆盖矩阵；所有权审计（每个代理起止提交之间的 git diff 触及文件对照 OWNER_FILES）；评审隔离审计（ledger 中每次文件读取都在其证据包目录内）；追溯检查（每个 sha 都存在于 git log）；git status --porcelain 为空；git rebase -x "npm run verify" 逐提交检查；git ls-files | xargs du -ch 统计体积并标出 >5 MB 的文件。

**证据**：docs/team/ledger.json；docs/team/coverage.json；docs/eval/rounds/\*.json；docs/eval/ownership.json；docs/eval/isolation.json

#### C12.8 可执行、且被证明不空转的基准检查器（Velocipedia-proof；原 C1.4）

维度内权重 1.5（占本维度 19%，折合总分 0.94 分）· 测量方式：自动脚本 + 代码审查

- **2 分**：正确性只靠肉眼判断。
- **5 分**：只在 solver 空间检查（check-rig）；没有任何东西验证渲染出来的画是否真的落在 solver 说的位置——枢轴画偏了的美术也能通过。
- **8 分**：tools/check-benchmark.mjs 在渲染后的 DOM 上逐项断言：菱形车架闭合（各管端 0.5 u 内交汇）、链条与两齿盘相切并按驱动方向包绕、两胎触地（跳车除外）、骨盆在座上、脚掌球在踏板轴上、腕在握把上、喉囊元素位于下喙下方且上喙带 nail、世界向 −x 滚动时车轮顺时针；在 RS-cycle24 与 RS-phase 全集上全部通过，并报告最坏值。
- **10 分**：8 分全部满足，另加"Velocipedia 画廊"：≥8 个故意破坏的 mutant（座管断开、鸟悬浮、链条接前轴、脚离踏板、远腿在前、链条反向、齿比 2.9、没有喉囊），外加 ≥10 个由没看过检查器的独立红队代理在 R1 之前编写的美术级缺陷，每一个都被检查器标红；已知良好的最小 fixture 必须通过；两次运行结论相同；结果表与带测量点标注的叠加图发布在 docs 中（Artifact 里只在"幕后"入口内）。

**测量**：[script] tools/check-benchmark.mjs 在 dist 上运行，通过 data-anchor 与 getScreenCTM 映射到 rider 空间（并先通过 C1.1 的锚点审计），对照 contract.js 目标值；mutant 由 ?mutant= 参数或临时模块副本生成，每个都必须失败；红队缺陷集在 R1 前入库并哈希锁定；R0 之后检查器本身哈希锁定，任何修改都要记录修改前后在所有已完成轮次上的结果。[code-review] 检查器阈值不得比本 rubric 宽松。

**证据**：docs/eval/benchmark.json；docs/eval/velocipedia-gallery.png；docs/eval/redteam-defects.json

### D13 细节密度与工艺

*Detail density & craft* · **权重 10** · 来源镜头：用户更新（细节远多于草稿）、STYLE-C、craft、ORN、mech-detail、finish-polish

用户明确要求最终版本的细节比草稿多很多（原话见 detail.userQuote）。本维度把它变成可数、可看、可证伪的东西：逐层的细节清单对草稿的倍数（G-DETAIL 兜底）、鹈鹕与自行车在 3× 下每一处都有细节、世界与版式按风格 C 的海报语言加满细节——同时细节有层级、守预算、不抢骑者的戏。细节条目的定义与草稿基线见 definitions.detailItem 与 detail.baselineFile。

#### C13.1 细节清单与对草稿的倍数（逐层） ★

维度内权重 3（占本维度 25%，折合总分 2.50 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：细节量与草稿相当或更少（倍数 ≤1.2×）：rig 化让美术退化成占位形状；某些层比草稿还空。
- **5 分**：总量有增加（1.5–2.4×），但集中在一两个层（例如只给背景加了东西），鹈鹕或自行车仍停留在草稿水平（<1.5×）；或新增条目大多是 1× 下看不见的微小重复。
- **8 分**：细节清单总数 ≥2.5× 草稿基线（≥323 条），鹈鹕 ≥2.0×（≥54）、自行车 ≥2.0×（≥84），其余每层 ≥1.5×（fx ≥4 条）；每个新增条目都能在 1× 或 3× 裁图中被看到；2 名细节评审的盲清点"感知清单倍数"≥2.0，并在 7 个区域的并排比较中各自在 ≥6 个区域判定成品细节更多。
- **10 分**：总数 ≥3.5×（≥452 条），每层 ≥2.0×（fx ≥6 条）；感知清单倍数 ≥3.0；两名细节评审在 7/7 个区域都判定成品细节更多且更好，0 条"违反风格 C / 抢骑者戏"的有效意见。

**测量**：[script] tools/detail-inventory.mjs（见 detail.inventoryTool）：在 dist 的 hero、close 机位与 16 帧故事条带上收集全部 data-detail 条目，ID-map 判定可见面积（≥2 px²）与遮挡（<50%），按 definitions.detailItem 去重（64×64 SSIM ≥0.95 的条目合并），与 docs/rubric/detail-baseline-C.json（R0 用同一工具在草稿上复核并哈希锁定）逐层比较。[judge] 2 名 J-detail 评审按 detail.judgeProtocol：先对草稿与成品的同位置裁图分别做开放式盲清点（不知哪张是草稿，左右随机），再逐区并排比较。

**证据**：docs/eval/detail-inventory.json；docs/eval/judges/detail-\*.json；shots/eval/detail/pairs/\*.png

#### C13.2 鹈鹕的细节与工艺（3× 下每一处都有细节） ★

维度内权重 2.5（占本维度 21%，折合总分 2.08 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：鹈鹕是几块平涂大形：看不出羽毛层次、飞羽是一团、喉囊与喙没有任何结构线。
- **5 分**：有一些羽毛与结构线，但 3× 下大片区域是空的平涂（zoom-coverage 中 <70% 的骑者格子有细节）；飞羽不可数；喉囊没有纹理；脚是一块橙色。
- **8 分**：detail.catalogue.pelican 中 ≥9/11 项在 3× 下成立：分层覆羽（≥3 排扇贝边，向尾部叠压）、≥8 枚可数的单独初级飞羽、带 P 细边的次级飞羽、喉囊纹理线（随 sy 拉伸）、喙脊与喙缘线、钩的高光与下钩、冠羽丝 ≥7 缕、尾羽 ≥5 枚、跗跖鳞线与趾节、蹼褶与爪、围巾织纹与流苏；zoom-coverage：鹈鹕覆盖的格子中 ≥90% 被判为"有细节"；所有细节遵守 STYLE-C §2（身体仍是实心纸白，不被网点弄灰）；变形部件上的细节随变形正确拉伸，0 处撕裂。
- **10 分**：11/11 项成立；zoom-coverage ≥97%；在同位置 3× 裁图的成对盲评中，成品对草稿 ≥5/5 判为"更精细且更好"；细节在 6 个时段、事件中与烘焙 SVG 中都保留（烘焙 SVG 头部裁图与实时版平均绝对差 ≤6/255）。

**测量**：[script] tools/zoom-coverage.mjs（见 detail.zoomCoverage），只统计 pelican 层格子；check-style 确认身体区域无大面积网点；变形拉伸测试：强制喉囊 sy∈{0.9,1.2,1.45}、颈部极值姿态下渲染，检查纹理线与轮廓无撕裂（mask 连通性）。[judge] 头颈、身翼、腿脚 3 组 3× 裁图（曲柄 0/90/180/270，单图、标注像素比例），对照 catalogue.pelican 逐项判定；与草稿同位置裁图成对比较。

**证据**：docs/eval/zoom-coverage.json；shots/eval/detail/pelican-\*.png；docs/eval/judges/detail-pelican-\*.json

#### C13.3 自行车与车载物的细节（硬件工艺密度）

维度内权重 2（占本维度 17%，折合总分 1.67 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：车是几根线和两个圈：没有接头、线缆、条帽、链片，车筐是一块橙色方块。
- **5 分**：主要部件有了，但放大后是示意图：线缆缺失、链条是虚线、车座没有弹簧与铆钉、车筐没有编织、鱼没有鳞。
- **8 分**：detail.catalogue.bike 中 ≥11/14 项在 4× 下可辨：接头与五通壳 / 头碗、线管 + 线缆 + 线扣、条帽与轮圈孔、链片 / 销 / 滚子、座弹簧 + 铆钉 + 座弓、踏板笼与反光片、刹车夹器与刹把、挡泥板撑杆螺丝、车铃穹顶与拨杆、车灯镜片与支架、上下交错的编织车筐（筐沿、筐底）、带鳞纹 / 鳍 / 鳃盖的鱼、胎纹与胎侧、车头徽标；zoom-coverage：自行车覆盖的格子中 ≥85% 有细节；旋转件上的细节遵守 C2.4 的淡出与不倒转规则（细节不能制造倒闪）。
- **10 分**：14/14 项成立；zoom-coverage ≥95%；成对盲评中成品对草稿同位置 4× 裁图 ≥5/5 判为"更精细且更好"；夜间车灯与反光片处的细节仍可读。

**测量**：[script] tools/zoom-coverage.mjs 的 bike 层统计；tools/wagon.mjs 对新增的周期细节（条帽、链片、胎纹）复查倒闪；data-detail 条目计数。[judge] BB 与传动、后花鼓、座舱、座组、车筐 5 组 4× 裁图（golden 与 night），对照 catalogue.bike 逐项判定；与草稿成对比较。

**证据**：docs/eval/zoom-coverage.json；shots/eval/detail/bike-\*.png；docs/eval/judges/detail-bike-\*.json

#### C13.4 世界的细节：海、陆、天与港镇

维度内权重 2（占本维度 17%，折合总分 1.67 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：背景是几条色带，与草稿相比没有新增的地点感。
- **5 分**：加了一些物件，但是散点式的装饰：比例不对（路灯像玩具栅栏）、不随深度分级、与海报构图无关。
- **8 分**：detail.catalogue 的 sea、land、sky 三组中各 ≥70% 项成立：≥3 条海带与浪纹、栈桥、礁石、编号浮标、带索具（支索、帆脚索、旗）的帆船、成群的鸟、有窗与屋顶的港镇、路边设施（护栏、柱桩、路牌、长椅）、按种类区分的植物、≥3 条云带、缓慢旋转的光芒；细节按 STYLE-C §4 随深度分级（远层大形 + 少量网点，近层简洁剪影）；每个道具带 data-size-m，渲染尺寸与间距落在按深度缩放的真实范围内（路灯间距 20–40 m、车道虚线约 3 m 长 9 m 间隔、棕榈 6–12 m），或在 docs/composition.md 中写明风格化理由；港镇等地点细节在 6 个时段都成立（夜间窗户亮灯）。
- **10 分**：三组各 ≥90% 项成立；世界细节讲故事（港镇与故事循环中的节拍有关，例如鱼摊、渔船归港）；野卡包中任意一帧的背景都有 ≥3 个可命名的地点细节，且骑者显著性比仍 ≥1.3；成对盲评中各区域成品对草稿 ≥4/5 判为"更丰富且更好"。

**测量**：[script] detail-inventory.mjs 的 sea/land/sky 层统计；新 tools/check-scale.mjs：读每个 data-size-m 道具的屏幕尺寸与 depth，换算成米并对照真实范围表或 docs/composition.md 的风格化声明；tools/judge/saliency.mjs 在加满细节后复查骑者显著性。[judge] 海与港、陆与路、天空 3 组 1× 与 3× 裁图（6 个时段中的 golden 与 night），对照 catalogue 逐项判定；与草稿成对比较。

**证据**：docs/eval/detail-inventory.json；docs/eval/scale.json；shots/eval/detail/world-\*.png；docs/eval/judges/detail-world-\*.json

#### C13.5 印刷、版式与边框细节

维度内权重 1（占本维度 8%，折合总分 0.83 分）· 测量方式：自动脚本 + 视觉评审

- **2 分**：只有一个标题和一条框线；文字是系统字体或位图。
- **5 分**：有标题与边框，但没有印刷语言的细节：没有印章、注记、角饰、色标，或者中文字形错误。
- **8 分**：detail.catalogue.typography_frame 中 ≥4/6 项成立：海报边框与内框线、角饰；中文字形正确的邮戳或题签；车票式注记（票号、站名、票根虚线）；标题的 inline 与阶梯阴影；套印标记或色标条；小字编号与版次；全部是路径、全部在 data-text 清单中且通过 C9.8 的字形审校；标题卡按 STYLE-C §4 在约 3 s 后缩小，任何机位下都不遮住骑者；这些元素在电影模式中正确变为 letterbox。
- **10 分**：6/6 项成立；版式元素随时段换墨并保持限色印刷；成对盲评中成品对草稿的版式 ≥4/5 判为"更像真正的印刷海报"；0 条文字错误。

**测量**：[script] detail-inventory.mjs 的 typography_frame 层统计；check-text.mjs 的 data-text 清单；first-look.mjs 检查标题卡缩小时间与遮挡。[judge] 边框、印章、注记的 3× 裁图对照 catalogue 逐项判定；与草稿成对比较。

**证据**：docs/eval/detail-inventory.json；docs/eval/in-art-text.json；shots/eval/detail/type-\*.png

#### C13.6 细节的纪律：层级、预算与不损美术

维度内权重 1.5（占本维度 13%，折合总分 1.25 分）· 测量方式：自动脚本 + 代码审查 + 视觉评审

- **2 分**：细节把画面变成一团噪点，或者把帧率拖到 G9 以下；或者为了满足预算把草稿已有的美术删掉。
- **5 分**：预算勉强达标，但细节放在运动层上逐帧重绘、静态细节没有合并、重复元素没有复用；某些区域出现网点摩尔纹或细线闪烁。
- **8 分**：静态细节在构建时合并为少量路径（每个静态带 ≤200 个 path 元素，单个 path 可以很长），重复元素用 `<use>` 复用，纹理由种子化的确定性代码生成；骑者带只放必须随动的细节；G9 与 C10.1 的帧率门槛在全部细节下成立；细节不在运动中产生摩尔纹或闪烁（逐帧亮度差检测）；不损美术：草稿与成品在骑者、天空、海、前景四个同位置裁图的成对盲评中各自胜或平 ≥50%。
- **10 分**：8 分全部满足，另加：细节的层级在显著性图中可测：骑者显著性比 ≥1.4，背景细节随深度递减（远层边界密度 < 中层 < 近层的 60%，前景除外）；成对盲评中四个区域各自 ≥80% 胜；细节带来的 gzip 增量有逐层拆分并在 budgets.json 中报告。

**测量**：[script] tools/perf.mjs 在全细节下运行；新 tools/check-detail-budget.mjs：逐带统计 path 数、`<use>` 复用率、gzip 字节按 data-detail 层拆分；逐帧亮度差检测细线与网点在平移时的闪烁（相邻帧像素差的高频能量）；zoom-coverage 的深度分级统计。[code-review] 静态细节是否在构建时合并、纹理是否种子化生成、运动层是否只含必要细节。[judge] 四区域成对盲评（草稿 vs 成品，同构图、同时段）。

**证据**：docs/eval/detail-budget.json；perf/perf.json；docs/eval/judges/detail-regress-\*.json

## 7. 评估协议

### 7.1 原则

- 证据先于意见：先跑脚本、生成本协议规定的渲染集与测量，再让评审看；评审只能依据这些证据包打分，构建者自报的截图与说法不算证据。
- 便宜的先跑、失败就停：先跑全部 gate 相关脚本（分钟级）；G1、G3、G15、G17 或 G2 的脚本部分（check-benchmark）任一失败时不启动评审轮，直接回到修复。
- 构建者永不给自己打分；评审每轮都是全新子代理，不带上一轮分数或记忆。
- 所有评审都是 Claude 多模态子代理（与构建者同一模型家族），分数是"同模型自评"（meta.selfAssessmentLabel），必须在 README、scorecard 与交接说明中如此标注。唯一的真人评审是用户（G16）。
- 隔离：每个证据包复制到随机命名的临时目录；评审只被允许读该目录（提示与工具配置双重限制），UX 与探索测试者只能用截图—输入包装器（tools/judge/harness.mjs：截图与指针 / 键盘 / 触控，没有 DOM、aria、evaluate 与源码访问）；每次文件读取与工具调用记入 ledger，读过包外文件的评判作废。
- 去文字与去符号：识别、可读性与偏好测试图一律 ?notext=1（事件与笑点再加 ?nofx=1），并由另一个代理确认图中无可辨认文字。
- 抽样在冻结之后：相位偏移、τ 抖动与野卡包由代码冻结之后公布的种子生成；R-final 另开 R0 预登记的密封留出集。
- 按原生分辨率看细节：评审图像的长边不超过模型输入上限（约 1568 px、≈1.15 MP）；细节判断用原生比例的单张裁图，联系表只用于序列问题；提示中写明每张图的像素比例。
- 强制选择与找缺陷，而不是打分与表态：不使用 1–10 绝对好感分、"会分享吗"、"有没有意见"式的是 / 否题或角色扮演式签字；改用对照强制选择、排序与带植入缺陷校准的找缺陷。
- 工具分级、预算墙钟：T0 工具（门槛与感知测试框架）先建；T1 与美术并行建；T2 只为 10 分额外项建。完整协议只在 R1 与 R-final 跑，修复轮只跑门槛与受影响的感知测试；构建者墙钟的 ≥40% 预留给带视觉审阅循环的美术与动画迭代，不得挪给工具。
- 所有原始评审输出、评审提示词、随机种子、证据包清单与工具调用日志都入库（docs/eval/）。

### 7.2 评审类型

| 类型 | 名称 | 说明 |
|---|---|---|
| J-lens | 维度评审 | 拿到该维度的 rubric 文本与原子条目（docs/rubric/items.json 中该维度的部分；不含北极星与创意简报）以及该维度的证据包，逐条目判 pass/fail 并引证；code-review 类 criterion 可只读指定文件。不看构建者报告，不看上一轮分数。R-final 另拿到野卡包，并可做 10 分钟只看截图的 Playwright 自由找缺陷。 |
| J-blind | 盲感知评审 | 没有项目上下文、看不到 rubric，只看随机命名的去文字图片、条带或密集帧与固定问卷（强制选择、排序、开放式识别或描述）；用于识别、可读性、偏好、笑点、个性、标志性时刻与横向对比。左右随机，文件名随机；提示经 blind-prompt lint（不得出现 pelican\|鹈鹕\|bicycle\|自行车\|Pelican Bay），只传 PNG。按信息量递增的顺序出题（开放式识别 → 清单 → 偏好比较）。为减少同族相关：变换提问框架、图片尺度与呈现顺序，宿主提供其他模型档位时混用。 |
| J-adv | 对抗评审 | 在"找出至少 5 个缺陷"的框架下工作；用于 3× 放大（C7.5）、遮挡（C1.2）以及所有中位分 ≥9 的 criterion。 |
| J-valid | 验证者 | 逐条核实对抗评审与低分离群评审提出的缺陷是否真实（对照证据、必要时重新渲染），按 scoring.severity 分级；只有被判为有效的缺陷才计入。验证者本身也用植入的真 / 假缺陷校准。 |
| J-detail | 细节评审 | 2 名，按 detail.judgeProtocol 对草稿与成品的同位置裁图做开放式盲清点与逐区并排比较；用于 G-DETAIL 与 D13。 |
| J-user | 冷启动 / 探索测试者 | 只能通过截图—输入包装器操作 dist，看不到 README、源码、DOM 与 aria；用于 C9.1、C8.3 与 C9.3。 |
| U-user | 用户（真人） | 在 R1 之后与 R-final 之前看联系表、webm、Artifact 与细节对照图，给出通过 / 不通过与前 3 条意见（G16）；声音与动作手感只有用户能判断。 |

### 7.3 评审规则

- 引证规则：每个原子条目判定都必须引用 ≥1 个证据路径与一条具体观察；没有引证的判定作废并重评。
- 机器上限与严重度上限：按 scoring.machineCeiling 与 scoring.severity 执行——任何被验证的 blocker 封顶 6、major 封顶 8，无论锚点文字是否提到这类缺陷。
- 植入缺陷校准：每个 J-lens、J-adv 与 J-blind 的清单类证据包都混入 2–3 个评审不知情的 ?mutant= 植入缺陷帧或裁图（例如脚离踏板 3 u、肩部缝、链条在错误一侧、车轮倒转、切线、缺 nail、远腿在前），以及一个预期约 6–7 分的降级版本；评审的分数只有在它标出 ≥80% 的植入缺陷、且给降级版本低 ≥2 分时才计入，否则作废换人。scorecard 公布每名评审的召回率。所有"0 条意见"类锚点都读作"在召回率 ≥80% 的前提下 0 条被验证的意见"。
- ≥9 触发对抗复核：任何中位分 ≥9 的 criterion，另派 1 名 J-adv 与 1 名 J-valid；被验证的缺陷按严重度封顶。
- 低分离群先核实：取中位数之前，任何比中位低 ≥2 分的评审所引用的缺陷先送 J-valid 核实，被证实的缺陷对所有评审生效。
- 分歧规则：同一 criterion 的评审分极差 >2 时，追加 2 名评审并取全部评审的中位数；维度级两名独立评审相差 >1 时，由第三名裁决并记录。
- 物种与正典判定：只计首先说出的物种；异议须指出可见特征并经 J-valid 在重新渲染上核实；CANON #12/#13 允许"无法判断"，以 check-occlusion 为准。
- 统计：所有比例与胜率按评审与对照聚类计算（cluster bootstrap），报告有效样本量；"5/5"类阈值视为小样本，不作总体统计宣称。
- 一致性：评审必须先写观察，再给判定。

### 7.4 渲染集

每一轮都重新生成（旧截图一律作废）。

| 渲染集 | 名称 | 规格 | 工具 |
|---|---|---|---|
| RS-cycle24 | 真时间 24 帧踩踏周期近景 | 60 rpm 下 t = t0 + k/24 s（k = 0…23，恰好一个曲柄周期；t0 按 definitions.sampling 由提交 sha 派生；车轮、链条与所有时间驱动的动作都真实前进，绝不用 crankDeg 覆盖），close 机位，1600×900，DPR 2；40 与 90 rpm 各再出 24 帧；每套另出一份 ?skeleton=1 叠加版。 | tools/filmstrip.mjs |
| RS-phase | 相位数据集（不出图） | DOM 锚点 JSON（乘法网格）：72 个曲柄相位（偏移按 definitions.sampling）× {40,60,90,110} rpm × 3 机位，另加 hop/wave/bell/gulp 各 10 个 τ；node 解析网格：1440 相位 × {20,40,60,90,110} rpm × coasting {0,1} × 事件组合 × reduced {0,1}。 | check-anchors.mjs、check-rig.mjs、motion-audit.mjs |
| RS-tod | 5 个时段 | dawn 0.26、noon 0.50、golden 0.70、sunset 0.76、dusk 0.80、night 0.93 × {wide, close}，1600×900（风格 C 每个时段一整套 7 墨）。 | shoot.mjs --set tods |
| RS-cams | 3 个机位与极值 | wide / close / cinematic @ golden；cinematic 极值 zoom 1.45 与 roll ±0.6°；传动近景（能看见脚踏接触）。 | shoot.mjs --set cams |
| RS-events | 事件条带 | bell、wave、hop、gulp、coast-in、coast-out、踏频突变 90→40：每个一条无字幕 8 帧条带（τ 按事件时长八等分）× close 与 wide；每个一条 60 fps、2.5 s 的 10 列 filmstrip；另有 12 帧 4 s idle 条带与滑行条带。 | shoot.mjs --set events、filmstrip.mjs |
| RS-onion | 洋葱皮与轨迹 | 每个事件与基础循环：12 帧 20% 不透明度洋葱皮（头—冠—喉囊一组、尾一组）；7 个关键点的 120 样本轨迹叠在冻结帧上。 | tools/onion.mjs |
| RS-crops | 放大裁图 | DPR 3 的 3× 裁图：9 个区域 × 4 个种子化相位 + 跳车顶点、挥手峰值、吞鱼隆起（约 45 张，每张单独交付并标注像素比例）；机械 4 px/u 裁图：BB/传动、后花鼓、座舱、座组 × {golden, night}；头部 3× 裁图与 zoom 4 表情表。 | shoot.mjs --set crops、render.mjs |
| RS-thumb | 缩略图、剪影与灰度 | {64×36, 128×72, 256×144, 600×338} × {彩色, 剪影(?silhouette=1), 遮头剪影, 灰度, protan/deutan/tritan 模拟, 只含骑者的中性背景裁图} × {live hero, 3 个种子化相位, 烘焙帧(`<img>`)}，全部 ?notext=1；诱饵同样渲染：?mutant=nopouch、?mutant=stork、?mutant=goose、?solo=pelican；文件名随机化。 | tools/thumb.mjs |
| RS-idmap | ID-buffer | ?idmap=1 渲染：12 个相位（门槛）与 72 个相位（计分），含跳车、挥手、吞鱼。 | check-occlusion.mjs |
| RS-viewports | 视口矩阵 | 320×568、360×640、390×844、430×932、844×390、768×1024、1024×768、1280×720、1600×900、1920×1080、2560×1080、3840×2160、1000×300，以及 Artifact 面板 480×800、640×720、720×800；× 3 机位 × 面板开/合；另出 6 视口 × 5 时段共 30 张的网格。 | ux-matrix.mjs、robust.mjs |
| RS-first | 首屏 | 0/100/300/500/1000/3000 ms × 5 个视口 × {file://, sandbox='allow-scripts' iframe}，CDP 4× CPU 节流；renderAt(t,{intro:true}) 每 0.25 s 共 21 帧的确定性开场表。 | first-look.mjs |
| RS-film | 电影与故事 | 90 s 电影模式 @ 30 fps → 每 2 s 一帧的 45 帧联系表（只用于序列判断）+ 节拍日志；烘焙循环（T = 24 s）每 T/16 一帧的 16 帧故事条带；preview.webm 每 0.5 s 一帧的联系表。 | tools/judge/film.mjs |
| RS-baked | 烘焙对照 | 烘焙 SVG 48 个相位 vs 实时 renderAt；{T−1/60, T, 10T, 100T}；作为 `<img>`、background、`<object>` 在 0/0.37/0.81 s 截图；6 帧 CANON-14 集；live \| baked \| diff 热图。 | check-baked.mjs、loop-seam.mjs |
| RS-acting | 表演 | 头部 zoom 4 表情表（每种状态一张）；每种情境反应的 before/peak/after 三联图；12 帧表演表。 | tools/judge/acting.mjs |
| RS-field | 横向对比网格 | 匿名 600×338（notext），按格式分组：静帧组、条带组、骑者组；分层：第 1 层 = 匹配投入基线（同模型同工具、60–90 分钟、不给 rubric、best-of-3，设置冻结并在 R1 前哈希入库）+ 同模型单次对照；第 2 层 = 我们的 R1 版本；第 3 层 = simonw/pelican-bicycle 历史 SVG（固定提交 sha，数量实时统计）；pelican-mini.svg 进静帧组；随机 ID、随机左右；第三方作品只在私有评估中使用。 | tools/field.mjs |
| RS-webkit | WebKit 对照 | WebKitGTK 下 hero、3 个机位、夜间、12 个相位与烘焙 `<img>`，与 Chromium 并排并标注 SSIM。 | xb-webkit.mjs |
| RS-a11y | 无障碍状态 | 10 个状态（默认、面板折叠、帮助打开、390×844、lang=en、lang=zh、reducedMotion、夜间、宿主暗色主题、宿主亮色主题）的 axe 报告与 ariaSnapshot。 | a11y.mjs |
| RS-dense | 密集帧与曲线 | 每个事件、踩踏循环与次级动作：30 张连续 60 fps 编号单帧（?nofx=1&notext=1，close 机位），外加每个部件的角度—时间曲线、骨盆 y 与躯干俯仰随曲柄角的曲线、跳车 riderY(t) 与物理参考叠加图。用于看不了视频的评审判断动作。 | tools/filmstrip.mjs --dense、motion-audit.mjs --plots |
| RS-detail | 细节对照 | 7 个区域（鹈鹕头颈、鹈鹕身翼腿、车架传动、车把车筐、海与港、陆与路、天与版式）× {草稿同位置裁图, 成品裁图}，同机位、同时段 golden、同曲柄相位 0、同裁切，1× 与 3×，左右随机；zoom-coverage 热图；detail-inventory 条目裁图。 | tools/detail-inventory.mjs、tools/zoom-coverage.mjs、tools/judge/detail-pairs.mjs |
| RS-style | 风格保真 | 成品与草稿在同机位、同时段、同曲柄相位、同裁切下的成对帧（notext）；6 个时段墨组色板条；check-style 违规位置标注图；STYLE-C §3 五项角色修正的 3× 裁图。 | tools/check-style.mjs、tools/judge/palette.mjs |
| RS-wild | 野卡包（R-final） | 代码冻结后由种子生成的 20–40 帧：随机 t、事件阶段（≥50% 在事件中或过渡中）、时段（含过渡中）、机位、视口（含 844×390 电影机位、跳车中暂停、事件中的减少动态、手机上面板打开）；另加 R0 预登记的密封留出集。 | tools/judge/wild.mjs |
| RS-canary | 植入缺陷 | 为每个证据包生成 2–3 张 ?mutant= 植入缺陷帧或裁图与 1 个降级版本（预期 6–7 分），随机混入，评审不知情；清单与答案只存于评估负责人目录。 | tools/judge/canary.mjs |

### 7.5 测量运行

| 运行 | 内容 | 时长 |
|---|---|---|
| MR-rig | node --test src/rig；check-rig.mjs --json（含 --seat、--biomech、--events）；mutate-rig.mjs。 | ≈1 min |
| MR-motion | motion-audit.mjs 基础、--fuzz 300 条日程、--events、--face 120 s；check-temporal.mjs。 | ≈3 min |
| MR-dom | check-anchors（含锚点审计）、check-occlusion、check-contacts、check-benchmark（含 mutant 与红队美术缺陷画廊）、check-bike、check-kinematics、check-noslip、wagon（像素法）、contact-probe、check-anatomy、check-style、check-purity、check-scale。 | ≈10 min |
| MR-perf | perf.mjs 场景矩阵（每场景 3×20 s、/tmp/pb-cpu.lock 独占锁、trace 计数 DrawAndSwap、骑者带更新率、画质档位与 DOM 哈希）、--paint（合成面积比）、JS 与分配采样、live-parity.mjs。 | ≈25 min |
| MR-soak | soak.mjs 12 分钟种子猴子；R-final 另加 60 分钟无人值守与 t≈1e6 s 时间扭曲。 | 12–75 min |
| MR-robust | robust.mjs、contexts.mjs、audit-dist.mjs、xb-webkit.mjs、xb-audit.mjs、故障注入。 | ≈10 min |
| MR-det | determinism.mjs（a–f）、vr.mjs --baseline test/golden。 | ≈5 min |
| MR-baked | check-baked.mjs（48 相位 + 结构 + 机械不变量 + 下载字节一致）、loop-seam.mjs。 | ≈5 min |
| MR-ux | ux-matrix、interact（含 --idle 90 s）、keys、a11y、contrast、flash-check（≥90 个场景）、i18n-lint、audio-check、audio-offline（30 s）、export-check、first-look。 | ≈20 min |
| MR-repro | 全新克隆 npm ci && npm run verify（快速）、R-final 另跑 verify:full、双构建 sha256、check-contract、check-docs、verify-claims、readme-lint、coverage.mjs、所有权与隔离审计、git 卫生检查。 | ≈10 min |
| MR-field | 先由新鲜子代理生成匹配投入基线（best-of-3，60–90 分钟，设置冻结）与同模型单次对照（只做一次、在 R1 前哈希入库、以后复用），再 field.mjs 按层与格式打包，最后派 5 名盲评跑完全部配对（≥40 个评审配对）。 | ≈2–3 h（基线只生成一次，可与构建并行） |
| MR-detail | detail-inventory.mjs（dist 与草稿复核）、zoom-coverage.mjs、check-detail-budget.mjs、detail-pairs 打包、J-detail 评审。 | ≈15 min + 评审 |
| MR-validity | R0 专用：tools/tool-validity.mjs 对每个 gate 工具跑已知良好 fixture（必须通过）、mutant 集（必须失败）与两次重复（结论相同），报告敏感度与特异度；发布探针；合成面积探针；N/A 判定。 | ≈30 min |

### 7.6 各维度评审分配

每个维度的 J-lens 评审各自独立判定原子条目，criterion 分按第 3 节机械聚合；下表"其他评审"是该维度专用的盲评、对抗或测试者。

| 维度 | J-lens 人数 | 其他评审 | 证据包（渲染集） |
|---|---:|---|---|
| D1 | 3 | C1.1：3 名盲评 CANON-14（notext + 植入缺陷）；C1.3：5 名盲评（开放式识别、诱饵、遮头剪影、CVD）；C1.2：2 名对抗 + 1 名验证 | RS-cycle24、RS-phase、RS-events、RS-idmap、RS-thumb、RS-baked、RS-canary |
| D2 | 3 | C2.1：1 名开放式机械找错评审；C2.7：1 名盲评自行车技师（开放式清点在先）；C2.4：1 名逐帧方向评审 | RS-cams、RS-crops、RS-cycle24、RS-phase、RS-dense、RS-canary |
| D3 | 3 | C3.1：1 名找缝评审；C3.4：跳车与滑行密集帧找缺陷评审 | RS-cycle24、RS-events、RS-crops、RS-phase、RS-dense、RS-canary |
| D4 | 3 | C4.1：3 名盲评物种识别；解剖评审逐项勾 FM-10 | RS-crops、RS-thumb、RS-tod、RS-cycle24、RS-events、RS-canary |
| D5 | 3 | C5.1：3 名盲评按速度排序；C5.4：盲评从 nofx 密集帧命名事件与 A/B；C5.2：密集帧找缺陷 | RS-cycle24、RS-events、RS-onion、RS-dense、RS-canary |
| D6 | 5 | C6.3：5 名盲评（nofx 密集帧描述 + 4 选 1 强制选择）；C6.1：3 名盲评 15 选 3 形容词；C6.5：1 名盲评复述故事条带 + 强制选择 | RS-events、RS-acting、RS-film、RS-dense |
| D7 | 5 | C7.1：5 名盲评开场强制选择；C7.5：2 名对抗 + 1 名验证；C7.6：5 名盲评"同一角色同一风格"成对 + 限色印刷判定；C7.7：5 名盲评 3 选 1 与"你会删掉什么"；C7.4：电影联系表强制选择 3 名 | RS-first、RS-tod、RS-cams、RS-crops、RS-film、RS-viewports、RS-style、RS-wild、RS-canary |
| D8 | 3 | C8.2：5 名盲评 × 分层分格式配对（≥40 个评审配对）；C8.1：3 名盲评开放式回忆；C8.3：1 名只看截图的探索者；C8.4 的 9–10 分需要用户（G16） | RS-field、RS-film、RS-dense |
| D9 | 3 | C9.1：2 名冷启动测试者（桌面 / 390 px 触屏）；C9.8：1 名双语文案评审；C9.5：1 名 a11y 评审读 ariaSnapshot | RS-viewports、RS-a11y、RS-first |
| D10 | 3 | 以脚本为主；评审审阅 perf/\*.json、paint-rect 图与代码 | RS-webkit |
| D11 | 3 | C11.1：3 名盲评对烘焙 6 帧回答 CANON-14；海报淘汰赛评审 | RS-baked、RS-film、RS-field |
| D12 | 3 | 以代码审查与脚本为主；C12.7 需 2 名独立评审并报告一致性 | 脚本输出 + 代码 |
| D13 | 3 | G-DETAIL 与 C13.1：2 名 J-detail（盲清点 + 7 区并排）；C13.2–C13.5：逐项对照 detail.catalogue；C13.6：四区域不损美术成对盲评 5 名 | RS-detail、RS-crops、RS-tod、RS-wild、RS-canary |

### 7.7 轮次

| 轮次 | 名称 | 时机 | 范围 |
|---|---|---|---|
| R0 | 基线与工具有效性 | T0 评估工具写完后、构建开始前，对 phase-0 脚手架 + 草稿 C 跑一遍 | (1) 工具有效性：每个 gate 工具通过已知良好 fixture、mutant 集与重复性检验（MR-validity），之后哈希锁定；(2) 重新核实 baseline.knownDefects，已解决的标"resolved-before-R0"并附证据，只有确认存在的缺陷计入工具敏感度；(3) 用 detail-inventory.mjs 复核草稿细节基线并锁定；(4) 冻结墨组 docs/eval/ink-sets.json、原子条目难度标注、密封留出集哈希；(5) Artifact 发布探针、合成面积探针、WebKit 与 librsvg 可用性探测，按 N/A 政策出具 docs/eval/na.json；(6) 独立红队代理在 R1 之前写好 ≥10 个美术级缺陷并入库。得分预期很低，只作参照。 |
| R1 | 集成后 | 集成完成、dist 构建干净之后 | 完整协议（含 MR-field 与 G-DETAIL）；之后执行 G16 的第一次用户检查点。 |
| R2…R4 | 修复轮（至多 3 轮） | 每一轮修复合并之后 | 全部 gate 脚本 + 视觉回归 + 受影响维度的感知测试（新鲜评审）；分数下降 ≥1 的维度必须写明原因（真回归还是评审噪声）。3 轮之后仍未达标时，进入 R-final 并如实报告差距。 |
| R-final | 最终轮 | 最后一次修复提交之后，冻结代码 | 全新评审（从未参与过任何轮次）完整执行本协议，包括 MR-field、G-DETAIL、MR-soak 的 60 分钟运行、野卡包与密封留出集、每个 J-lens 10 分钟自由找缺陷、所有 ≥9 分的对抗复核；随后执行 G16 的第二次用户检查点。这是唯一可以对外报告的分数（标注为同模型自评）。未达标时如实报告差距，不得挑选更早轮次的高分。 |

### 7.8 防分数通胀

1. 构建者永不评分；每轮评审全新、不带上一轮分数；R-final 评审从未参与过任何轮次。
2. 机器上限与严重度上限压住评审分：脚本证伪的阈值直接封顶；被验证的 blocker → 6、major → 8。
3. 分数由原子条目机械聚合（tools/score.mjs），评审不自由挑整数；10 分额外项只有在盲评于 1× 默认视图中主动注意到，或声明为检查模式额外项（≤+0.5）时才计入。
4. 植入缺陷校准：召回率 <80% 或没能压低降级版本的评审作废；验证者同样校准。
5. 所有中位分 ≥9 的 criterion 都要经过对抗评审 + 验证者复核；低分离群评审引用的缺陷在取中位前先核实。
6. 强制选择代替绝对打分；对照是最强一层（匹配投入基线），同类比同类（静帧对静帧、条带对条带、骑者对骑者）。
7. 去文字、去符号、诱饵对照与遮头剪影：防止标题、路牌与"鹈鹕骑车"的先验替评审作答。
8. 隔离：评审与测试者只能读证据包或只能看截图，越界作废；探索者经由代码发现的彩蛋不计。
9. 抽样在冻结之后公布，R-final 有野卡包与密封留出集，防止针对固定帧调优；hero 由定义固定，不可挑选。
10. 感知核心乘数 T_final = T × min(1, H/9) 与核心底线 8：脚本满分不能掩盖观感平庸。
11. 目标 92 分意味着加权平均 ≥9.2：不能靠"8 分全部做对"达标，必须拿到带证据、被看见的 10 分级额外项。
12. 分数只能来自 R-final；报告时同时给出评审间极差、召回率、被对抗复核下调的项与未达标项；统计按评审与对照聚类，报告有效样本量。
13. 同族偏差披露：所有评审都是 Claude，分数是同模型自评；唯一的外部检验是用户（G16），其意见未解决时不得宣称达标。

### 7.9 输出与预算

- **输出**：docs/eval/rounds/`<round>`/scorecard.json 与 scorecard.md（由 tools/score.mjs 从原子条目判定按 scoring 公式聚合生成，首行为同模型自评标注）；docs/eval/judges/`<round>`/\*.json（每名评审的原始输出、提示词哈希、看过的证据清单、植入缺陷召回率）；docs/eval/\*.json（各脚本输出）；docs/eval/user-checkpoint.json（G16）；shots/eval/`<round>`/（证据图，不入库，只入联系表与报告用图）；docs/rubric/items.json 与 evidence-manifest.json 由生成器产出，evidence-manifest 中的每个路径在每轮结束时由 score.mjs 检查存在。
- **预算**：token 成本不受限，墙钟时间中等重要：每个 workflow 同时最多约 2 个代理，但可以并行开多个 workflow；所有启动 Chromium 的工具共享 /tmp/pb-cpu.lock（perf 与 soak 独占）。工具分级：T0（构建前必需）= check-anchors、check-benchmark、check-rig 扩展、check-baked、check-style、check-purity、detail-inventory、zoom-coverage、perf、first-look、ux-matrix、a11y + keys、flash-check、determinism、judge/pack + harness + canary、score.mjs、coverage.mjs、tool-validity.mjs；T1（R1 前）= 其余 8 分工具；T2（只为 10 分额外项）= mutant 画廊、xb-webkit、60 分钟 soak、film、eggs 探索者、有声 webm。修复轮至多 3 轮；每轮脚本部分约 1–1.5 小时，完整评审只在 R1 与 R-final。构建者墙钟的 ≥40% 预留给带视觉审阅循环的美术与动画迭代（其中细节密度工作单列，见 implications.roles），不得挪给工具。plan.vN 为每个阶段写明墙钟上限。

## 8. 定义

**CANON-14** — 鹈鹕骑车基准的 14 项正典清单（每一帧都要成立）

1. 两个同样大小的正圆车轮
2. 闭合的菱形车架：上管、下管、座管齐全，后上叉与后下叉在后轴汇合，前叉到达前轴
3. 车把经立管连到转向管
4. 车座装在座杆上
5. 两根相差 180° 的曲柄，各带一个踏板
6. 链条同时包住牙盘与飞轮
7. 长喙，尖端带下钩的 nail
8. 可见的喉囊
9. 鹈鹕坐在车座上：既不悬浮也不陷入
10. 两只脚都在踏板上
11. 至少一只翼握在握把上
12. 两腿分列车架两侧：近腿在车管与牙盘前，远腿在车架后
13. 远侧曲柄与踏板按物理被牙盘与车架遮挡
14. 骑者与车的 bbox（喙尖、冠、尾尖、两只轮胎）完全在视口之内（适用于 wide、cinematic、竖屏、hero 与烘焙帧；close 机位只按 C7.4 的显式裁切规则检查）

**FM-10** — 大白鹈鹕（Pelecanus onocrotalus）的 10 项必需野外特征 + 1 项可选

1. 长而直、扁平的上喙，带 culmen 脊
2. 红/橙色的下钩 nail，盖过下喙尖
3. 裸露的黄色喉囊挂在下喙上，并延续到喉部
4. 眼周粉色裸皮一直延伸到喙基（若画雌性则为橙色）
5. 额羽在喙基中央收成尖角（区别于羽毛覆盖全头的卷羽鹈鹕）
6. 红褐色虹膜
7. 白色羽毛带玫瑰色晕
8. 黑色初级飞羽 且 黑色次级飞羽（带细白边）
9. 枕部下垂的短而蓬松的冠羽（不是头顶冠）
10. 粉到橙色的腿与全蹼足（totipalmate，4 趾全蹼）
11. （可选）繁殖期胸前黄/浅黄斑

**hero 帧**：hero 帧 = 首次加载的默认视图（不带任何 URL 参数，1600×900@1，默认机位与默认时段 tod 0.70，踏频 60）在 sim 时间 t = 3.2 s 的画面，由 renderAt(3.2, 默认参数) 渲染；R0 之后不可更改。盲评使用时一律加 ?notext=1。

**去文字 / 去符号**：?notext=1：隐藏一切文字与类文字元素——标题、标语、印章 / 题签、路牌、车票式注记、HUD、UI、SFX 字（DING! 等）。?nofx=1：再隐藏一切符号化叠加（冲击放射线、音符、爱心、闪光星）。所有识别、可读性与偏好测试图都用 notext 渲染；事件与笑点可读性测试再加 nofx。每张图在交给盲评前，由另一个代理确认图中没有可辨认的文字。

**抽样种子**：抽样种子：每轮的相位网格偏移 φ_k = kΔ + frac(hash(commit sha))·Δ、τ 抖动、以及 R-final 的"野卡包"（wildcard pack，t、事件阶段、时段、机位、视口随机组合，≥50% 的帧处于事件中或过渡中）都由评估负责人在代码冻结之后公布的种子生成，并记入 scorecard。R0 提交一份密封留出集（sealed hold-out，例如 tod 0.62、cadence 75、1366×768、跳车与吞鱼重叠）的哈希，只在 R-final 打开。RS-phase 的网格是乘法网格（72 相位 × 4 踏频 × 3 机位），事件采样另外相加（4 事件 × 10 τ）。

**纯渲染输入**：纯渲染输入元组：renderAt(t, {tod, cam, cadenceSchedule, eventsLog, pointerLog, quality, viewport, flags})。一切历史（光标视线、升级反应、自动导演、种子变体）都必须经 eventsLog / pointerLog 进入；quality 档位在所有确定性、烘焙、视觉回归与评审渲染中被固定为通过 G9 的那一档；自适应画质只存在于实时模式并写日志。

**像素判定**：像素判定约定：背景像素 = 与 #FF00FF 的 ΔE2000 ≤10，DPR 2；alpha mask 阈值 0.5，4 px/u；每份 JSON 报告打印 DPR 与阈值。需要读作"接触"的形状应重叠 ≥0.5 u（隐藏的陷入允许），而不是刚好相切（相切会在接缝处漏出背景色）。

**细节条目**：细节清单条目（inventory line）：某一层内一种可区分的物体、部件或纹理处理。相同实例的重复只算一条（4 个更衣亭 = 1 条，32 根辐条 = 1 条）；设计上明显不同的变体各算一条（开门的更衣亭、远/近帆船）。条目必须在默认视图或 close 机位中 ≥2 px²（1600×900@1），且被遮挡 <50%（ID-map 判定）。条目分 O（物体/部件）与 T（纹理处理：网点、编织、鳞纹、排线、刻线等）。实现上每个条目的根元素带 data-detail="`<layer>`:`<O|T>`:`<name>`"；7 个层 = pelican、bike、sea、land、sky、fx、typography_frame。草稿基线见 docs/rubric/detail-baseline-C.json（预登记 129 条）。

**手写**："手写"（用于 dist/pelican-mini.svg）：由一个代理在单次回复中直接写出 SVG 文本，期间不运行任何代码、不调用生成脚本；该回复的转录哈希记入 ledger.json。可以事后用工具检查，但不得据检查结果做程序化修改（允许同一代理再手写一版，记为第 2 次尝试，全部尝试都要公开）。

**可见交互入口**：默认状态可见交互入口：首次加载、不交互时屏幕上可见的按钮、滑块、图标与可点击提示的数量。上限 5；"幕后 / Behind the scenes"入口算 1 个。

**符号化叠加**：符号化叠加：爱心、音符、闪光星、"ding"字形、SFX 字、冲击放射线等非物理元素。风格 C 允许大事件时单帧的丝网"pop"（STYLE-C §6），但它们在可读性测试中不给分（用 nofx 测），并计入 C7.7 的克制审查：每个事件至多 1 个、持续 ≤6 帧。

**故事循环**：故事循环长度 T = 24 s = 60 rpm 下 24 整曲柄圈；各近景层 TILE 都是 1 整曲柄圈的整数倍，所以 T 与所有瓦片对齐。一个循环内至多 5 个主要节拍，节拍之间 1–3 s 的安静巡航。

**去重表**：去重表（每个性质只在一处计分）：脚—踏板等接触 → C3.1；车架几何 → C2.1；装配正确性 → C2.7；硬件细节密度 → C13.3；羽毛与喙等鹈鹕细节密度 → C13.2；世界细节 → C13.4；3× 缝隙与边缘等完成度缺陷 → C7.5；风格 C 规则 → C7.6；克制 → C7.7；草稿对比 → C13.1 与 C7.6（前者比细节量，后者比身份与风格一致性）。

**时段**：时段取 src/core/palette.js 的 ENV_KEYS：dawn 0.26、noon 0.50、golden 0.70（默认）、sunset 0.76、night 0.93；对比度检查另加 dusk 0.80。风格 C 中每个时段是一整套 7 墨（STYLE-C §1），墨的角色固定。

**踏频**：踏频取 contract.js CADENCE：min 20、stroll 40、cruise 60、sprint 90、max 110 rpm。

**严重度示例**：

- blocker：近足离踏板 ≥3 u 或穿过曲柄；远腿或远翼画在车架前；任何旋转件看起来倒转；骑者被裁或被 UI 盖住；控制台错误；表情诡异、凶或吓人；可见的图层边缘或平铺接缝横穿画面
- major：肩、肘、髋处 1–3 u 的缝；明显的抖动、弹出或果冻般的过度弹簧；配色脱离风格 C 的七墨；拥挤、盖住场景的面板；错误或自造的汉字；网点在旋转件上或出现摩尔纹；细节抢走骑者的视觉焦点
- minor：只在 3× 或逐帧才可见的小缝、切线或锯齿；单帧的层序小错；文案中的标点小错

## 9. 风格 C 档案

**复古旅行海报（WPA / art-deco 丝网印刷）**（由用户选定）。风格圣经：`docs/STYLE-C.md`；参考：drafts/C-poster/（keyframe.png、closeup.png、gen.mjs、ttf.mjs）。

**锁定的文件（sha256）**：

| 文件 | sha256 |
|---|---|
| `drafts/C-poster/keyframe.png` | `4573b5ffe084c00f3ee13025113738c3802b5e0b3d767e00645994bf3dc99837` |
| `drafts/C-poster/closeup.png` | `bf455f98843e3760dd119d9792ef26c37c4839acf1586a8a3a07892b39d325ba` |
| `drafts/C-poster/gen.mjs` | `7439b65463144b450079666c5830bb51071d3836bed6f7ed2c5d8fa713dde20d` |
| `drafts/C-poster/keyframe.svg` | `33bb3b53fb2174e7dee641fb4afc1413970c403379cc29459cc1008dd223b9ca` |
| `drafts/C-poster/closeup.svg` | `0ec3c73533cd7f7dd7f897f7c48b7f347a3e273f93cd9bd1f4d72c4b492ff934` |
| `docs/STYLE-C.md` | `fed7e1882931f57c43143de3b481600ff74b60cb041c971084ab2b8334207a56` |

**墨组（golden）**：P `#F4E7CD`、K `#F2AE86`、O `#EB8A33`、R `#D4513A`、B `#56679E`、T `#1D8882`、N `#1A1F35`。其余时段各为一整套 7 墨（dawn / noon / sunset / dusk / night），在 R0 从 src/core/palette.js 冻结为 docs/eval/ink-sets.json；此后只能改色值，不能增加墨数。CIELAB（golden）：P L\*92.0、K 76.6、O 66.6、R 52.0、T 51.2、B 44.4、N 12.3。

**风格规则**：

1. 每个表面都是 7 墨之一，或一种墨上叠另一种墨的网点；渐变只允许用于夜间灯光的径向光晕，并且必须量化为 2–3 圈硬边环。
2. 骑者身上不铺大面积网点：羽毛是实心纸白 P，体积来自 B 描边（约 2.2，圆角）、少量 B 扇贝线，至多在腹 / 背边缘有一条窄网点带（点距 ≥5，P 点叠 B）。
3. 远侧腿与远侧翼是实心 B 或 N，形状与近侧一致，绝不用红点。
4. 网点只用于静态或缓动层（天空带、光芒、海带、远山、海岸），以静态 `<pattern>` 或预生成点路径绘制，随所在层整体平移；旋转或变形部件上 0 网点。
5. 旋转件（车轮、牙盘、曲柄）用实色加线条；辐条按 rig-spec §3 淡出，并有两墨的运动模糊盘。
6. 纸纹：至多一层小的、低不透明度、固定在屏幕上的静态纸纹；0 个全屏滤镜或混合模式。套印错位（1–2 px）只用于静态元素且不闪烁。
7. 文字一律转为路径：拉丁字用笔画构造的 deco 大写字母或 DejaVu Sans Bold 转路径，中文用 WenQuanYi Zen Hei 转路径；README 注明字体许可。
8. 海报边框：P 纸边 + 细 N 框线，屏幕固定层；电影模式时变为 letterbox。标题卡开场全尺寸、约 3 s 后缩为左上角小标或隐藏，任何机位下都不遮住骑者。
9. 背景细节按深度分级：远层大形 + 少量网点；近层简洁剪影；前景（depth 1.3）只有低矮的青绿灌木 / N 草，至多盖住车轮底部 8%。
10. 动作语言：机械干净利落；角色是克制的 1930 年代"橡皮管"卡通魅力；环境是"印版"式平移，海带缓慢起伏，光芒约 1°/s 慢转；大事件可有单帧丝网 pop（R/O 放射线 + 小号凸版 SFX 字）。

**角色修正（STYLE-C §3）**：

1. 读作大白鹈鹕：纸白大身体、长 S 颈、桃色长喙带朱红钩、琥珀色喉囊带几道 O/R 纹理、眼周小块桃色裸皮、枕后白色蓬松冠羽。
2. 表情满足、愉快，不凶：去掉厚重的橙色眼线，嘴角可微微上扬。
3. 翅膀是翅膀，不是套袖子的手臂：宽阔的覆羽基部接入体侧；次级飞羽像流苏垂在臂线下；N 色初级飞羽从腕部向后下方扫；握把处前几枚初级飞羽绕住握把（按 G7 的"羽扇"规则，不得出现指节状分段）。
4. 腿：大腿是并入身体的羽毛"裤管"；跗跖琥珀色、带几道鳞线；四趾全蹼，脚平贴踏板。
5. 围巾：红白条纹长围巾系在颈基，高速时向后飘、跳车时向上飞——风格招牌与最好的跟随道具。

**锚点重释**：

| 锚点条目 | 处理 | 说明 |
|---|---|---|
| C4.6 CIELAB 绝对色带 | reinterpreted | 改用相对约束：喉囊是鸟身上最饱和的暖色（O 墨，C\* 最高）；面皮与喙（K 墨）比羽毛（P）更暖；飞羽（N）是鸟身上最暗的；羽毛 P 与相邻背景的 ΔL\* ≥25；喉囊 O 与喙 K 的 ΔL\* ≥8（golden 实测 10.0）；这些关系在 6 个时段的墨组中都成立。 |
| C4.6 羽区方向 data-tract | reinterpreted | 羽区流向由 B 扇贝线与覆羽排的方向体现：每条扇贝线 / 覆羽排带 data-tract，主轴方向在所属羽区参考流向 ±50° 内。 |
| FM-10 #6 红褐色虹膜 | reinterpreted | 深色眼（N 瞳孔 + P 高光），允许一圈 R 墨虹膜环；不强求红褐色。 |
| FM-10 #7 白羽带玫瑰晕 | reinterpreted | 七墨中没有玫瑰色：以纸白 P 为羽色即满足；玫瑰晕项 N/A。 |
| FM-10 #8 次级飞羽白边 | reinterpreted | N 色次级飞羽带 P 细边线。 |
| C4.5 跗跖网状鳞纹 | required | STYLE-C 要求"几道鳞线"：3× 下可见 ≥4 道横向鳞线即满足。 |
| C2.1 / C13.3 接头（lug） | reinterpreted | 接头以平涂形状 + 1 道描线表现，不做立体渲染。 |
| C7.2 描边宽度直方图 | na | 风格 C 以平涂与网点为主，改为 C7.6 的风格保真检查。 |
| C4.2 喉囊半透明与血管 | reinterpreted | 以 O 底 + R/K 纹理线表现，逆光时换为更亮的墨组合；不做半透明混合。 |
| C7.3 光照（rim light、光池） | reinterpreted | 光以墨的替换表现（rim = 受光侧 1 道 K/P 线；光池 = 2–3 圈量化硬边环），不做连续渐变。 |

**预算**：

- note：草稿 keyframe.svg 为 400 KB raw / 88.8 KB gzip；成品细节 ≥2.5× 草稿，所以字节预算按 gzip 给出，并要求静态细节合并路径、用 `<use>` 复用、种子化的确定性运行时生成（由紧凑代码生成的网点与纹理）来控制体积。
- indexHtmlGate：G1：≤1 MB gzip 且 ≤3 MB raw
- indexHtml8：≤450 KB gzip、≤2 MB raw
- indexHtml10：≤300 KB gzip、≤1.2 MB raw
- bakedSvgGate：G5：≤3 MB raw
- bakedSvg8：≤500 KB gzip、≤2 MB raw
- bakedSvg10：≤300 KB gzip、≤1.2 MB raw
- miniSvg：dist/pelican-mini.svg ≤16 KB raw
- noscript：`<noscript>` 内嵌 pelican-mini.svg 或低 LOD 烘焙版，在 budgets.json 中单列一行
- outcome：结果预算（取代静态带的节点数与字节上限）：首帧 ≤400 ms；每帧光栅成本见 C10.2；1600×900@1 层内存 ≤150 MB；合成面积比 Σ(与重绘区相交的层面积)/视口 ≤3.0。

**地平线**：草稿地平线在 y=470（画高 52%），是海报式正面构图。C7.4 的地平线规则对风格 C 放宽为：地平线在 [0.28,0.40]、[0.60,0.72]，或保持 0.52 并在 docs/composition.md 中写明理由（海报惯例）；无论哪种，都不得穿过头部（屏幕上距眼 ≥20 px）。

## 10. 细节门槛与细节目录

门槛 **G-DETAIL**。用户原话："我需要你最终教出来的版本细节比 draft 多很多"。草稿基线文件：`docs/rubric/detail-baseline-C.json`。

| 层 | 草稿基线 | 门槛（×） | 门槛条数 |
|---|---:|---:|---:|
| pelican | 27 | 2.0 | ≥54 |
| bike | 42 | 2.0 | ≥84 |
| sea | 9 | 1.5 | ≥14 |
| land | 30 | 1.5 | ≥45 |
| sky | 10 | 1.5 | ≥15 |
| fx | 1 | — | ≥4 |
| typography_frame | 10 | 1.5 | ≥15 |
| **合计** | **129** | **2.5** | **≥323** |

- **清单工具**：tools/detail-inventory.mjs：在 dist 上（hero + close 机位 + 16 帧故事条带）收集全部 data-detail 条目，用 ID-map 渲染判定可见面积与遮挡，按 definitions.detailItem 去重，输出 docs/eval/detail-inventory.json（每层 O/T 条目清单、与基线的逐层倍数、每个条目的截图裁剪路径）。反作弊：同一 data-detail 名下的元素若像素上与另一条目不可区分（缩略图 64×64 SSIM ≥0.95），合并为一条；新增条目必须在 1× 或 3× 裁图中可见，否则不计。
- **3× 放大覆盖**：tools/zoom-coverage.mjs：DPR 3、close 机位、曲柄 0/90/180/270 与 hero，把骑者（鹈鹕 + 车）bbox 切成 12×12 u 的格子；对每个被骑者覆盖 ≥50% 的格子统计墨色边界长度（相邻像素 ΔE2000 >10 的边）与不同墨数。"有细节"的格子 = 边界长度 ≥ 草稿同位置格子的 1.5 倍，或 ≥ 1.2 u/u²（R0 在草稿上校准后冻结，只能收紧）。输出 docs/eval/zoom-coverage.json 与热图 shots/eval/detail/coverage-\*.png。
- **评审协议**：2 名细节评审（J-detail，彼此独立、没见过构建过程）在 RS-detail 上工作：(1) 盲清点：先分别拿到草稿与成品的同位置裁图（左右随机，不告诉哪张是草稿），各自开放式列出看得到的每一样东西；由脚本计算"感知清单倍数"= 成品列出数 / 草稿列出数；(2) 并排比较：7 个区域（鹈鹕头颈、鹈鹕身翼腿、车架传动、车把车筐、海与港、陆与路、天与版式）逐区回答"哪张细节更多？""哪张更好？""成品里有没有违反风格 C 或抢骑者戏的细节？"。
- **预算规则**：细节必须在性能预算内实现：优先放在静态层；静态细节在构建时合并为少量路径；重复元素用 `<use>` 复用；纹理用种子化的确定性生成；运动层与骑者带只放必须随动的细节。G9、C10.1、C10.2 的门槛不因细节放宽，但也不得靠删减细节来满足：预算只能靠工程手段达成（见 C13.6）。

**细节目录**（用户点名的项目，按层；C13.2–C13.5 逐项核对）：

- **pelican**：分层覆羽（≥3 排，向尾部叠压，每排有扇贝边）；单独成形的初级飞羽（≥8 枚可数）与次级飞羽（带 P 细边）；喉囊纹理线（随 sy 拉伸）；喙脊（culmen）线、喙缘线、钩（nail）的高光与下钩；眼周裸皮形状、眼睑、高光；冠羽丝（≥7 缕）；颈部羽流线；尾羽（≥5 枚）；跗跖鳞线、趾节、蹼褶、爪；"裤管"羽缘；围巾条纹、织纹与流苏
- **bike**：接头（lug）与五通壳、头碗；刹车与变速线：线管、线缆、线扣；条帽（spoke nipples）、轮圈孔、气门帽；链片、销与滚子；座弹簧、铆钉、座弓与座夹；踏板笼与反光片；刹车夹器与刹把；挡泥板撑杆与螺丝；车铃穹顶与拨杆；车灯镜片与支架；编织车筐（上下交错的编织、筐沿、筐底）；鱼（鳞纹、鳍、鳃盖、眼）；胎纹与胎侧；车头徽标
- **sea**：≥3 条海带（远 / 中 / 近）；浪纹、泡沫线；日光或月光路；栈桥与桩；礁石与拍岸浪；浮标（带编号或条纹）；带索具的帆船（支索、帆脚索、旗）；渔船或汽船；海鸟群与水面的鸟
- **land**：港镇（有窗、屋顶、烟囱、钟楼的房屋群）；灯塔及看守人小屋；海堤与石块砌缝；路边设施：护栏、柱桩、路牌、长椅、邮筒、里程碑；路灯（与草稿不同的细部）；棕榈、龙舌兰、罂粟、沙丘草等植物（按种类）；更衣亭、遮阳伞与沙滩物件；路面标线与路缘
- **sky**：≥3 条云带或云型；太阳光芒（缓慢旋转）；日 / 月盘与光环；鸟群（远近不同大小）；夜间星空与星座；飞机或风筝等远景点缀（可选）
- **fx**：速度线；尘土或落叶粒子（按风格绘制）；跳车落地的冲击印版；水花 / 水滴（吞鱼沥水）；风带
- **typography_frame**：海报边框与内框线、角饰；邮戳 / 印章（中文字形正确）；车票式注记（票号、站名、票根虚线）；标题的 inline 与阶梯阴影；套印标记与色标条（印刷装饰）；小字说明、编号、版次

## 11. phase-0 已知基线（预登记缺陷）

R0 轮中先重新核实下列每一项；标为 resolved-before-R0 的不计入工具敏感度，其余每个可自动检出的缺陷都必须被对应工具检出，否则该工具视为空转。

| 编号 | 缺陷 | 来源 | 影响 |
|---|---|---|---|
| BL-01 | 竖屏 390×844 裁掉后轮与尾巴（slice 构图，可见 x≈592–1008），上半屏是空天。 | E、ANIM；首席评审按 scene.js 与 contract.js 核实 | G8、C9.7、C7.1 |
| BL-02 | 滑行时飞轮跟车轮转：solve.js:78 为 J.cog.rot = wrap(wheelDeg)，应为 3×曲柄（实测 344.8° vs 171.9°）。 | mech、ENG；已核实 | G3、C2.3、C12.2 |
| BL-03 | SLOTS 顺序为 'cog','chain','chainring'，牙盘齿画在链条上面。 | mech；已核实（contract.js:49） | C2.2 |
| BL-04 | rig:land 用 setTimeout(750) 壁钟触发（main.js:72），暂停或隐藏时照样触发，破坏确定性。 | ANIM、P、ENG；已核实 | G10、C10.7、C12.3 |
| BL-05 | prefers-reduced-motion 只在加载时读一次（main.js:24），没有 change 监听。 | UX；已核实 | G11、C9.6 |
| BL-06 | ui.js 在 window 级对 Space 无条件 preventDefault，无焦点、修饰键、repeat 与 IME 守卫；四份键位表互相矛盾。 | UX、ENG；已核实（ui.js:3–5） | G12、C9.4 |
| BL-07 | tools/shoot、sheet、render 从 /opt/node22/lib/node_modules/playwright 绝对路径导入，playwright 不在 devDependencies；没有 verify 或 test 脚本。 | ENG；已核实 | G14、C12.4 |
| BL-08 | 腹部在 60 rpm 下于"陷入 2.4 u"与"悬空 2.6 u"之间往复，每曲柄转悬空两次，且只在座鼻 x≈−42 处单点接触。 | ORN、mech（解析测量） | G3、C3.2 |
| BL-09 | KOPS 近 +28.8 / 远 +23.8 u，髋在座鼻（x=−37，有效座管角 80.5°）；远腿在 BDC 已达 L1+L2 的 96.7%。 | mech | C3.3 |
| BL-10 | 跳车是 58 u / 0.6 s 的正弦，约 0.45 g，两轮同时离地，空中曲柄仍转。 | ANIM、mech | C3.4、C5.4 |
| BL-11 | 链条长 100.61 节，不是整数，滚子永远无法精确啮合（后下叉 125.433 u 可得恰好 100 节）。 | mech | C2.2 |
| BL-12 | 60 rpm/60 fps 下辐条每帧 1.60 周期、飞轮与牙盘齿 0.80 周期，不淡出就会倒闪。 | mech、E | G4、C2.4 |
| BL-13 | 冠羽峰值（12°）领先父级头（49.5°），冠羽与喉囊（13.5°）锁相；头部稳定比 0.18 是好的，要保持。 | ANIM、ORN | C5.2、C4.3 |
| BL-14 | 眨眼是每 3.7 s 一次的竖直 sy 挤压（人的眨眼方式、节拍器），没有视线系统；车把在挥手时也从不转动。 | ANIM、ORN | C5.5、C6.2、C5.4 |
| BL-15 | 吞鱼时头只转 −28°，而喙静息已下垂 14°，喙最终只高出水平约 14°；没有鱼的转移与颈部隆起。 | ORN | C6.4 |
| BL-16 | shoot.mjs 的 frames 集固定 t=2 只改 crankDeg：车轮与飞轮停在 0.05°，链条却每帧走 4 节，既不是动作条带，机械证据还自相矛盾。 | ANIM、ENG | C5.1、C12.3、RS-cycle24 |
| BL-17 | 单个 svg#scene 每帧 setAttribute + 约 90 个调色板变量 10 Hz 写在根上：富风格在本容器只有 4–25 fps（D）、19–22（C）、3–7（B），只有 A-flat 达到 60。 | P（probe1–7 实测） | G9、C10.1、C10.2 |
| BL-18 | 暂停时 rAF 循环仍在运行。 | P | C10.7 |
| BL-19 | check-rig 只在 t=1.234、无事件时采样；没有任何 node --test 文件。 | ENG；已核实 | C12.2 |
| BL-20 | lint 没有强制"palette.js 之外不许裸 hex"：main.js 与 fx.js 里有 #000。 | ENG | C12.1 |
| BL-21 | wf-build.v0.js 在第 2 轮修复后直接退出、不再重评分；评审 1–10 分没有锚点；并行构建者对着共享树跑 shoot；没有 ledger。 | ENG；已核实 | G14、C12.7 |
| BL-22 | 草稿 A、B 的喉囊是止于嘴角的"香蕉形第二下喙"，身上是均匀扇贝纹，车上没有刹车与线缆。 | ORN、mech | C4.2、C4.6、C2.6 |
| BL-23 | 下载用 a.click() 触发 blob URL，在沙箱 iframe 里可能静默无效；bakeSVG 在点击处理函数中同步执行。 | UX | G13、C11.4 |
| BL-24 | shots/lead/frame-\*.png 是用旧的 z=2.0 close 机位拍的，已过时；每轮证据必须重新生成。 | E | protocol |
| BL-25 | 文档矛盾：close 机位 rig-spec 写 2.0/−380，contract.js 为 1.55/−285；plan 的文件表（art/pelican.js、world/palette.js、export/\*）与实际文件不符。 | ENG | C12.1、C11.5 |
| BL-26 | resolved-before-R0：v1 记录"drafts/B 已修改、C/D/E 未跟踪"；提交 aee2e61 已加入全部五份草稿，工作区现只剩 rubric 文件的改动。R0 只需复核，不计入工具敏感度。 | 首席评审 v2 复核（git log / git status） | G14、C12.7 |
| BL-27 | 草稿 C 的细节基线为 129 条（鹈鹕 27、自行车 42、海 9、陆 30、天 10、fx 1、版式 10）；这是 G-DETAIL 的分母，不是缺陷。 | 首席评审手工清点 docs/rubric/detail-baseline-C.json，R0 由 detail-inventory.mjs 复核 | G-DETAIL、C13.1 |
| BL-28 | 草稿 C 的角色问题（STYLE-C §2–3）：厚重橙色眼线让表情显凶；翅膀是"套袖子的手臂"；身体大面积网点发灰；远侧腿用红点表现。 | STYLE-C 审阅意见 | C7.6、C4.4、C4.6、C4.2 |
| BL-29 | 草稿 C 地平线在 y=470（画高 52%），穿过画面中部；HORIZON_Y=470 写死在 contract.js。 | 首席评审（gen.mjs、contract.js） | C7.4 |
| BL-30 | document.fonts.check 在本 Chromium 中对不存在的字体（"DefinitelyNotAFont123"、未安装的 PingFang SC）也返回 true，不能用来检测豆腐块。 | 红队 2 实测 | C9.8、G12 |
| BL-31 | 本地 ffmpeg（/opt/pw-browsers/ffmpeg-1011）以 --disable-everything 构建：只有 mjpeg 与 libvpx_vp8 解码器、没有 PNG 解码器与音频编解码器，PNG image2pipe 与 Opus 合封都不可行。 | 红队 2 实测 | C11.3、G13 |
| BL-32 | 草稿 C 的中文题签"鹈鹕湾"用 WenQuanYi Zen Hei（黑体）转路径，放在朱红竖条内；不是篆书印章。 | 首席评审（gen.mjs:748） | C9.8、C13.5 |

## 12. 镜头分歧的裁决

- close 机位是否裁掉脚与踏板：动画镜头根据旧截图说"会裁掉"，E 镜头按当前 1.55 重拍后说"整车在画内"。按 contract.js 计算：zoom 1.55、fy 505 时可见 y 为 214.7–795.3，胎底在 790，只剩约 5 u 余量。结论：当前能框住，但余量极小，C7.4 要求重新验证，旧的 shots/lead 一律作废。
- 390×844 竖屏：UX 镜头说 page.css 用默认 meet，得到 390×219 的细条；核实后 scene.js 用的是 preserveAspectRatio="xMidYMid slice"，结果是裁切：可见 x≈592–1008，而骑者占 x 455–953，后轮与尾巴被切掉（与 E 镜头一致）。G8 按裁切来写。
- UX 镜头说 #stage 没有 role=img：核实后 scene.js 已有 role="img" aria-labelledby="scene-title scene-desc"。C9.5 仍要检查内部节点是否对辅助技术隐藏、名称是否跟随语言。
- 其他模型（GPT、Gemini、Fable 等）：v1 在锚点与本条中引用过未经来源核实的外部事实（某日期的某模型鹈鹕测评、某模型的 MP4 失败）。v2 全部删除：本项目不对任何其他具名模型作任何声明；任何外部事实若要进入已提交文档，必须在 claims.json 中带来源 URL 与访问日期，否则删除或标"未核实（子代理检索）"（C12.5、G6）。
- 键位：plan.v0.md、rig-spec §4、wf-build UI brief、src/ui/ui.js 四份互相矛盾。rubric 不裁决具体键位，只要求 src/ui/keymap.js 成为唯一事实源（C9.4、G12）。
- 帧率门槛：P 镜头建议 ≥50，其余镜头建议 ≥55。G9 取 ≥55（基于 trace、3 次中位数、wide 与 close 都要达到），8 分锚点为 ≥57、10 分为 ≥58.5。
- 循环接缝：E 建议 ≤1.2×，ANIM 建议 ≤1.5，P 建议 ≤2.0，ENG 要求 0 像素差。G5 取 ≤1.5；C11.2 的 8 分取 ≤1.2；10 分取 frame(T) 与 frame(0) 0 像素差。
- 脚—踏板：solver 空间门槛 ≤0.5 u（G3）；DOM 锚点门槛 ≤0.75 u（G3，含美术放置误差）；8 分要求像素级间隙 ≤0.5 u，10 分要求锚点误差 ≤0.25 u。
- 腹—车座：ORN 建议 ≤0.5 u，mech 建议 ≤2 u。G3 取 ≤1 u 且 0 背景像素；C3.2 的 8 分取 ≤0.5 u。
- 别名阈值：E 用"步进落在 (0.4P,0.6P) 或映射为反向"，mech 用"步进 ≥0.35P 就必须淡出"。取更简单、更严格的后者（C2.4、G4）。
- hero 帧：红队 1 建议 t=3 s，红队 2 建议 renderAt(t=3.2)。取默认首屏在 sim t=3.2 s（与现有 shoot.mjs 一致，避开标题卡在约 3 s 的淡出边界），R0 之后不可更改（definitions.hero）。
- SFX 字与可读性：STYLE-C §6 允许大事件的单帧丝网 pop 与"DING!"等凸版字，红队要求符号叠加不给可读性分。两者兼容：保留风格手法，但可读性一律在 ?nofx=1 下测，叠加计入 C7.7 的克制审查（每事件至多 1 个、≤6 帧）；C5.4 不再要求 ding 字形。
- 前景遮挡：红队 1 建议前景层不得覆盖骑者 bbox 的下三分之一；STYLE-C §4 允许前景灌木至多盖住车轮底部 8%。取 STYLE-C 的规则，并加上"接触区 ≥70% 可见"（C3.1）：前景只在 GROUND_Y 以下与车轮重叠，且不得盖住任何接触区。
- 握把"像手指"：STYLE-C 写"前几枚初级飞羽像手指一样绕住握把"，G7 禁止手指。统一为可测规则：握把处读作羽扇，≥4 枚分开的初级飞羽尖，没有指节状分段（G7、C4.4）。
- 篆刻印章：红队 2 要求印章用篆书；本容器只有 WenQuanYi Zen Hei，没有篆书字体。仿印章元素要么用手工构造的篆书轮廓，要么明确做成 deco 题签而不冒充篆刻印章；字形必须正确（C9.8、C13.5）。
- CIELAB 色带与风格 C：v1 的绝对色带（羽 L\*≥92 等）会迫使七墨之外的颜色。风格 C 改用相对约束（styleProfiles.C.anchorReinterpretation）；墨组在 R0 冻结。红队 2 的"喙 / 喉囊 / 面皮两两 ΔL\*≥10"在风格 C 中不成立（喙与面皮同为 K 墨），改为喉囊与喙 ΔL\*≥8（golden 实测 10.0）。
- 历史 SVG 数量：v1 写 23 个，新克隆中为 22 个。改为固定仓库提交 sha、从克隆中实时统计（RS-field）。
- "感知核心底线"：红队 1 建议核心 criterion 底线为 9。采用 8 + 乘数 min(1, H/9)：底线 9 会让 13 项高度相关的同族评审中的任一次中位翻转决定成败，乘数已经惩罚核心均值不足。

## 13. 对团队设计的反推

本节是从 rubric 反推团队设计时必须遵守的约束：哪些契约必须在构建者开工前冻结、哪些角色是 rubric 隐含要求的、哪些评估工具必须先于构建存在。顺序固定为：风格已选定（C）→ z-band 与契约冻结 → 在冻结的 DOM 上写 T0 工具 → R0 → 构建（T1 工具与美术并行）→ R1 → 修复轮 → R-final。

### 13.1 构建开工前必须冻结的契约变更

1. 合成层 z-band 架构：把 LAYERS/SLOTS 切成若干连续深度带，每带是提升为合成层的 HTML div 里的独立 `<svg>` 根，只用 transform 移动；车轮、牙盘、飞轮可以有自己的小带（C10.2、G9）。这影响所有 art/world 模块，必须最先决定。
2. SLOTS：chainring 移到 chain 之前，并在 chain 之后新增旋转的 spider slot（C2.2）。
3. 是否采用整数链节：后下叉 125.433 u，后轴移到 (−123.83,−100)（C2.2 的 10 分项）。这是几何变更，必须在车的美术动工前定下。
4. data-anchor 点规范（bike-\*、pl-\*、pb-\* 锚点列表），供 check-anchors、check-contacts、检查模式读数使用（C1.1、C3.1、C12.6）。
5. 渲染与测试钩子：?idmap=1、?silhouette=1、?inspect=1、?mutant=、?inject=、?moment=、renderAt(t,{intro:true})、\_\_pb.simulate(dtArray)、\_\_pb.firstFrameAt、pose.gaze。
6. rig 语义：飞轮 ≡ 3×曲柄；所有事件时序在 sim time（去掉 setTimeout）；fx 是 (t, distance, events) 的纯函数（这样才能精确倒放与烘焙）。
7. createAudio(bus,{context}) 接受注入的 OfflineAudioContext（C8.4）。
8. src/ui/keymap.js 与 src/ui/i18n.js 作为唯一事实源，帮助与 README 表由它们生成（C9.4、C9.8、C12.1）。
9. 竖屏与 Artifact 面板的专用机位与安全区框定规则（G8、C9.7、C7.4）。
10. （已由 definitions.loop 取代）故事循环长度 T = 24 s，所有时间驱动的动作在 T 内精确周期（C6.5、C11.2）。
11. 导演文档先行：docs/character.md（角色圣经）、docs/timing.md（60 fps 的 X-sheet）、docs/beats.md（节拍表）在构建者开工前写好（C5.4、C6.1、C6.5）。
12. 地平线：HORIZON_Y 改为按风格与机位给出（styleProfiles.C.horizon），海与天空的构建者按契约值绘制（C7.4）。
13. 细节与文字标注：每个细节条目的根元素带 data-detail="`<layer>`:`<O|T>`:`<name>`"；每个文字元素带 data-text；每个道具带 data-size-m；每条扇贝线 / 覆羽排带 data-tract（G-DETAIL、C13.x、C9.8、C4.6）。
14. 评估渲染开关：?notext=1、?nofx=1、?mutant=`<id>`（含 nopouch、stork、goose 与美术级缺陷）、?solo=`<part>`、?ablate=`<choice>`、?nocache=1、?idmap=1、?silhouette=1（C1.3、C5.4、G17）。
15. 纯渲染输入元组 renderAt(t, {tod, cam, cadenceSchedule, eventsLog, pointerLog, quality, viewport, flags})；一切历史经日志输入（definitions.renderTuple）。
16. z-band 之后的无障碍结构：一个 role=img 的包装元素承载场景名称，每个带 `<svg>` aria-hidden（G12）；测量规格通过文档化的辅助函数用 getScreenCTM 映射到 rider 空间。
17. 故事循环长度固定为 T = 24 s（24 整曲柄圈），≤5 个主要节拍（definitions.loop）。
18. 运行时光栅缓存（若使用）必须记录源 SVG 子树哈希并可用 ?nocache=1 关闭（G17）。

### 13.2 rubric 隐含要求的角色

- 评估工具组（phase 0，先于构建者；R0 前完成）：(a) rig/动作 QA 工具匠——motion-audit、filmstrip、onion、check-temporal、check-rig 扩展、mutate-rig；(b) DOM/几何工具匠——check-anchors、check-occlusion、check-contacts、check-benchmark（含 mutant 画廊）、check-bike、check-kinematics、check-noslip、wagon、contact-probe、check-anatomy；(c) 性能/平台工具匠——perf、soak、robust、contexts、audit-dist、determinism、vr、xb-webkit、xb-audit；(d) UX/a11y 工具匠——ux-matrix、interact、judge/controls、keys、a11y（pinned axe-core）、contrast、flash-check、i18n-lint、audio-check、audio-offline、export-check、first-look；(e) 评审系统负责人——盲评打包与随机化、评审 schema、score.mjs 聚合器、field.mjs 与同模型单次对照生成、claims.json/verify-claims/readme-lint。
- 导演（layout + acting director）：写角色圣经、X-sheet、节拍表；负责开场、电影模式、自动导演与标志性时刻。现有 BUILDERS 名单中没有人拥有这些。
- 构建者再拆分：rig 拆为"行进/重量""表演/事件""面部/视线"三个 owner；新增 i18n/keymap owner；新增合成层/性能架构师（与负责人一起改契约）；新增包装 owner（webm、海报淘汰赛、README 模板化）；新增 pelican-mini.svg 手写者。
- 评估组（每轮新鲜）：12 个维度评审、盲感知评审池、对抗评审 + 验证者、冷启动测试者 ×2（桌面 / 触屏）、探索者、双语文案审校、ledger/证据书记。wf-build 中原来的单个 'ux' 评审要拆成 a11y 审计、双语审校与冷启动测试者。
- 流程约束：构建者在 git worktree 中隔离（或 shoot 串行化）；每个 finding 追溯到提交与 before/after；最终评分在最后一次修复之后；perf/soak 独占 CPU 运行。
- 细节密度组（用户硬性要求，G-DETAIL / D13）：细节清单管理者（维护 data-detail 登记表、每日跑 detail-inventory 与 zoom-coverage，拥有 docs/eval/detail-\*）；按层拆分的细节美术——鹈鹕羽毛与飞羽、鹈鹕头喙喉囊、自行车硬件、车筐与鱼、海与港、陆与路边设施、天空与光芒、版式与边框（印章、车票注记、角饰）；每位细节美术以草稿同位置裁图为对照自检，并受 C13.6 的预算约束；1 名独立细节验证者（不参与制作）。
- 独立红队缺陷作者：没看过检查器的代理，在 R1 前写 ≥10 个美术级缺陷与 CANON mutant（C12.8、C1.1）。
- 评估基础设施：证据包隔离与截图—输入包装器、植入缺陷生成器、野卡包与密封留出集、blind-prompt lint、score.mjs 原子条目聚合、coverage.mjs 覆盖矩阵。
- 匹配投入基线生成者：一个与构建团队隔离的代理，在同样工具下 60–90 分钟、不给 rubric、做 3 次，取最佳（C8.2、C6.3、C7.1、C7.7 的对照）。
- 用户联络：负责人在 R1 后与 R-final 前向用户发送检查点材料（中文），记录回复（G16），并撰写交接说明 docs/handoff.md。

### 13.3 必须先于构建存在的评估工具（分级）

- **T0（构建前必需）**：`tools/check-anchors.mjs` · `tools/check-benchmark.mjs` · `tools/check-rig.mjs（扩展）` · `tools/check-baked.mjs（含 --static）` · `tools/check-style.mjs` · `tools/check-purity.mjs` · `tools/detail-inventory.mjs` · `tools/zoom-coverage.mjs` · `tools/perf.mjs` · `tools/live-parity.mjs` · `tools/first-look.mjs` · `tools/ux-matrix.mjs` · `tools/a11y.mjs` · `tools/keys.mjs` · `tools/flash-check.mjs` · `tools/determinism.mjs` · `tools/score.mjs` · `tools/coverage.mjs` · `tools/tool-validity.mjs` · `tools/judge/pack.mjs` · `tools/judge/harness.mjs` · `tools/judge/canary.mjs` · `tools/verify.mjs`
- **T1（R1 前）**：`tools/check-occlusion.mjs` · `tools/check-contacts.mjs` · `tools/contact-probe.mjs` · `tools/check-bike.mjs` · `tools/check-kinematics.mjs` · `tools/check-noslip.mjs` · `tools/wagon.mjs` · `tools/check-anatomy.mjs` · `tools/check-scale.mjs` · `tools/check-detail-budget.mjs` · `tools/check-text.mjs` · `tools/cjk-glyph.mjs` · `tools/thumb.mjs` · `tools/silhouette.mjs` · `tools/motion-audit.mjs` · `tools/filmstrip.mjs` · `tools/onion.mjs` · `tools/check-temporal.mjs` · `tools/mutate-rig.mjs` · `tools/soak.mjs` · `tools/robust.mjs` · `tools/contexts.mjs` · `tools/audit-dist.mjs` · `tools/xb-audit.mjs` · `tools/vr.mjs` · `tools/loop-seam.mjs` · `tools/interact.mjs` · `tools/contrast.mjs` · `tools/i18n-lint.mjs` · `tools/audio-check.mjs` · `tools/export-check.mjs` · `tools/check-inspect.mjs` · `tools/check-contract.mjs` · `tools/check-docs.mjs` · `tools/verify-claims.mjs` · `tools/readme-lint.mjs` · `tools/field.mjs` · `tools/judge/palette.mjs` · `tools/judge/saliency.mjs` · `tools/judge/seams.mjs` · `tools/judge/edges.mjs` · `tools/judge/acting.mjs` · `tools/judge/controls.mjs` · `tools/judge/detail-pairs.mjs` · `tools/judge/wild.mjs` · `tools/judge/audio-offline.mjs` · `tools/judge/package.mjs`
- **T2（只为 10 分额外项）**：`tools/xb-webkit.mjs` · `tools/judge/film.mjs` · `tools/judge/eggs.mjs` · `soak 60 分钟模式` · `有声 webm（WebCodecs）`

创意简报（不给维度评审）：`docs/rubric/creative-brief.md`；原子条目：`docs/rubric/items.json`；证据清单：`docs/rubric/evidence-manifest.json`。

## 14. Changelog / rejected findings（变更记录与未采纳的发现）

**v2.0.0** 相对 v1.0.0 的主要变更：

- 用户更新 1（选定风格 C）：新增 styleProfiles.C（墨组、规则、角色修正、锚点重释、预算、地平线），草稿与风格圣经按 sha256 锁定；新增 C7.6"风格 C 保真与对所选草稿的忠实"；C4.6、C7.2、C7.3 等改为风格 C 的相对约束。
- 用户更新 2（细节远多于草稿）：新增硬门槛 G-DETAIL 与维度 D13"细节密度与工艺"（权重 10，6 个 criterion）；预登记草稿细节基线 129 条（docs/rubric/detail-baseline-C.json）；定义细节条目、清单工具、3× 放大覆盖与 2 名细节评审的并排比较；细节目录覆盖用户点名的全部项目；C13.6 要求细节守预算且不损美术。
- 维度与权重：13 个维度（新增 D13），见第 4 节；原 C1.4 检查器移到 D12 成为 C12.8；D7 新增 C7.6、C7.7。
- 评分机制：原子条目机械聚合、额外项可见性规则、严重度上限、感知核心乘数 T_final = T × min(1, H/9) 与核心底线 8、D8 的上限 s_C8.1 + 0.5、N/A 政策、solver 不变量只入门槛。
- 协议：证据包隔离与截图—输入包装器、去文字与去符号渲染、诱饵对照、植入缺陷校准、强制选择代替绝对打分、冻结后公布的抽样种子、野卡包与密封留出集、工具有效性检验与哈希锁定、工具分级与修复轮上限、CPU 文件锁、按原生分辨率交付细节图。
- 新增门槛 G16（用户检查点）与 G17（真的是 SVG 动画）；G1、G5 的体积改按 gzip 与风格预算；其余门槛按下表修订。

红队发现编号：RT1-xx = Goodhart 攻击者（第 1 份报告，按原顺序 1–40），RT2-xx = 缺口与歧义猎手（第 2 份报告，1–40）。

### 14.1 已采纳（74）

| 发现 | 问题 | 落实到 |
|---|---|---|
| RT1-01 | D8 聚合 | C8.1 w3、C8.2 w1.5；S_D8 ≤ s_C8.1 + 0.5；8/10 分只按最强一层对照计 |
| RT1-02 | C8.2 对照太弱 | 分层对照（匹配投入基线为第 1 层、R1 为第 2 层），设置冻结并在 R1 前哈希，同类比同类，只含骑者的裁图测试，逐层报告（公开前沿模型 SVG 的部分见"部分采纳"） |
| RT1-03 | 没有真人评审 | G16 用户检查点；所有分数标注"同模型自评" |
| RT1-04 | 画面文字泄露答案 | definitions.notext；所有识别 / 可读性 / 偏好测试 notext，另一代理确认无文字；只含骑者的裁图 |
| RT1-05 | 评审隔离 | 证据包复制到随机临时目录；截图—输入包装器；ledger 记录每次读取与工具调用，越界作废（工具白名单的部分见"部分采纳"） |
| RT1-06 | 10 分额外项成了功能堆砌 | 可见性规则（盲评主动注意到，或检查模式额外项 ≤+0.5）；难度标注与"≥60% 难度加权 + ≥1 个难项"（逐项 A/B 的部分见"部分采纳"） |
| RT1-07 | 缺少吸引力与克制 | 新增 C7.7（w2），含 3 选 1、"你会删掉什么"、可见入口 ≤5、显著运动焦点 ≤2、符号叠加计入 |
| RT1-09 | 校准只锚底部、"0 条意见"奖励偷懒 | 植入缺陷与降级版本校准，召回率 ≥80%；所有"0 条意见"锚点改写；验证者同样校准 |
| RT1-10 | 锚点外的大缺陷不封顶、中位丢掉严格评审 | scoring.severity：blocker → 6、major → 8；低分离群评审的缺陷在取中位前核实 |
| RT1-11 | 角色扮演签字与 Likert | 改为强制选择、排序与带校准的找缺陷（C2.1、C2.5、C3.3、C3.4、C5.2、C5.4、C5.6、C6.3、C7.1、C7.3、C7.4、C9.3） |
| RT1-12 | 从静帧判断动作、弹簧无上限 | C5.2 幅度上限、过冲 ≤2 次、次级 / 主运动能量 ≤35%；RS-dense 密集帧与曲线；用户在 G16 对手感签字 |
| RT1-13 | 锚点由被审模块自己放置 | 锚点审计（锚点必须在自身渲染 mask 的正确轮廓上）；独立红队写美术级 mutant |
| RT1-14 | 评审帧与用户看到的帧不同 | G9：记录画质档与 DOM 哈希、评审用同一档；live-parity ≤0.5%；lint 禁止 webdriver / UA 检测 |
| RT1-15 | 可能是位图背景 + SVG 骑者 | 新门槛 G17 |
| RT1-16 | 节点 / 字节上限与所选风格冲突 | styleProfiles.C.budgets 按 gzip 与结果预算；预算不得靠删美术达成（C13.6、G-DETAIL） |
| RT1-17 | hero 可被挑选 | definitions.hero 固定；冻结后公布种子抽样，≥50% 帧在事件或过渡中；与草稿同构图比较；草稿哈希锁定 |
| RT1-18 | 预定义渲染集之外的状态从未被评 | RS-wild 野卡包 + 每个 J-lens 10 分钟只看截图的自由找缺陷 |
| RT1-19 | 可发现性靠读标签与代码 | 截图—输入包装器；可发现性与默认状态极简（≤5 入口、UI ≤12%）一起计；彩蛋必须经可见线索发现 |
| RT1-20 | 数量阈值奖励"技术演示博物馆" | 彩蛋与反应按三联图质量中位计分；幕后功能统一放进"幕后 / Behind the scenes"；C2.7 开放式清点在先；C9.2 diegetic 控件不按数量（资产复用的部分见"部分采纳"） |
| RT1-21 | 单帧可读性奖励夸张与道具笑点 | 可读性用 ?nofx=1 与 2 s 密集帧；C5.4 不再要求 ding 字形；符号叠加计入 C7.7 |
| RT1-22 | 形容词测试可被通用词攻破 | 15 选 3（圣经 3 + 通用 6 + 干扰 6），圣经不得使用通用词，按高于随机的命中率计 |
| RT1-23 | rubric 自己写好了创意答案 | 示例移到 creativeBrief（生成为 docs/rubric/creative-brief.md），维度评审拿不到；照搬示例不得新颖分；标志性时刻必须出现在默认体验中 |
| RT1-24 | 16 s 循环塞不下 | T = 24 s = 24 整曲柄圈，≤5 个主要节拍，间隔 1–3 s；烘焙 SVG 预算按风格给出并拆分报告 |
| RT1-25 | 绝对 LCh 色带与风格冲突 | 风格 C 相对约束；墨组 R0 冻结；描边直方图对风格 C 为 N/A |
| RT1-26 | "鹳的身体 + 鹈鹕的喙" | 遮头剪影 6 选 1；裸腿长度 ≤0.75× 身长；中段颈宽 ≥0.45× 颅宽；鹳诱饵 |
| RT1-27 | DOM 枚举的倒转检测会漏 | wagon.mjs 改为像素角向互相关；要求可见的车轮结构 |
| RT1-28 | 按构造成立的不变量被重复计分 | scoring.solverInvariants：只入门槛；definitions.dedupe；检查模式读数须来自 DOM / 像素或标注 solver；北极星删去"0.00 u" |
| RT1-29 | 基准本体（独立 SVG）权重太低 | C11.1 w3；pelican-mini.svg 在 8 分档必需并与同等条件单次对照盲评；definitions.handWritten |
| RT1-30 | 声音无人能听 | C8.4 w0.75，9–10 分需用户确认；防烦扰（无 <30 s 重复乐句、音乐默认关闭） |
| RT1-31 | 手挑的变异体 | src/rig 自动 AST 变异；R1 前独立红队写 ≥10 个美术级缺陷；gate 工具 R0 后哈希锁定并记录修改前后结果 |
| RT1-32 | 同族评审高度相关 | 变换提问框架 / 尺度 / 顺序、可用时混用其他模型档；按评审与对照聚类的置信区间与有效样本量；禁止在 README 与 Artifact 中把区间当总体统计 |
| RT1-33 | 诚信 lint 漏掉定性吹嘘 | readme-lint 加评价性形容词；分数只以"同模型自评"出现；代理数按角色分列、无单一总数；外部事实需来源 |
| RT1-34 | 桌面默认视图没有骑者尺寸下限 | C7.4 ≥50% 视口高（G8 底线 45%），否则 C4.x 与 C7.5 用默认机位评 |
| RT1-35 | "一半额外项"与插值含糊 | 原子条目 + score.mjs 机械聚合 + 难度标注 + 严重度表 |
| RT1-36 | 协议墙钟不可行 | 工具分级 T0/T1/T2；完整协议只在 R1 与 R-final；修复轮 ≤3；≥40% 构建墙钟留给美术迭代 |
| RT1-37 | 大图被模型降采样 | 细节判断用原生比例单图，联系表只用于序列，提示写明像素比例 |
| RT1-38 | "像手指"与禁止手指矛盾 | 羽扇规则：≥4 枚分开的初级飞羽尖、无指节状分段（G7、C4.4） |
| RT1-39 | DrawAndSwap 不等于内容更新 | G9 与 C10.1：骑者带 ≥98% 呈现帧有变化，state.t 严格递增，画质档不得降低骑者更新率 |
| RT2-01 | webm 管线不可行 | JPEG q100 → mjpeg → vp8，或优先用页内 WebCodecs（安全上下文）+ pinned muxer；用本地 ffmpeg 的 vp8 解码器验证；有声版用 AudioEncoder opus |
| RT2-02 | 预算与 D/E 风格冲突 | styleProfiles（已选 C）：按 gzip 的逐风格预算、种子化运行时纹理、滤镜限制 |
| RT2-03 | "≤12 个提升层"会跌破 G9 | 改为合成面积比 ≤3.0（10 分 ≤2.0），R0 做合成面积探针；DPR2/3 目标在 R0 测后冻结 |
| RT2-04 | verify <10 min 不可能 | verify（快速）与 verify:full 分开；G14 指快速版 |
| RT2-05 | 负载守卫与并行 workflow 冲突 | /tmp/pb-cpu.lock 共享 / 独占 flock，等待而非拒绝；记录 loadavg 与 ps；新 chromium PID 使结果作废 |
| RT2-06 | Artifact 逐按钮人工验证不可测 | R0 发布探针；G13 改为读回 diff + 按探针沙箱标志的 contexts 测试；逐按钮检查改为可选用户检查 |
| RT2-07 | Wilson 下界在 30 对时数学上达不到 | ≥40 个配对、聚类 bootstrap 下界 ≥0.85，逐对照报告 |
| RT2-08 | noscript 内联 SVG 与体积上限冲突 | noscript 嵌 pelican-mini.svg 或低 LOD 版，字节单列 |
| RT2-09 | 环境阻断的项会误触 7 分底线 | scoring.na：只在 R0、看到结果之前带证据判定，权重重新归一 |
| RT2-10 | 物种测试被文字与先验污染 | notext、诱饵（无喉囊 / 鹳 / 鹅 / 下车）、区分度指标、blind-prompt lint、只传 PNG |
| RT2-11 | 静态渲染器下骨架塌陷 | G5 与 C11.1：check-baked --static |
| RT2-12 | 写实向锚点与风格冲突 | styleProfiles.C.anchorReinterpretation（required / reinterpreted / na），冻结并进入每个 J-lens 包 |
| RT2-13 | 缺少"忠于用户所选" | C7.6：同一角色同一风格成对盲评 ≥4/5、墨组检查、userNotes 逐条证据 |
| RT2-15 | 许可与出处 | docs/THIRD_PARTY.md、字体路径检查、LICENSE、第三方 SVG 不入库不发布（G15、C11.5） |
| RT2-16 | 宿主主题未测 | 暗 / 亮 colorScheme × data-theme 进入 a11y、对比度与 ux-matrix；390 px 下 ≥16 px 侧边距 |
| RT2-17 | 工具只测敏感度 | tool-validity：良好 fixture 必须通过、mutant 必须失败、两次重复一致；敏感度与特异度入库 |
| RT2-18 | 评审对高质量作品的敏感度未测 | RS-canary 植入缺陷；召回率不达标的评审作废并公布命中率 |
| RT2-19 | 固定抽样网格可被调优 | 相位偏移由提交 sha 派生；R-final 密封留出集 |
| RT2-20 | hero 未定义 | definitions.hero |
| RT2-22 | CANON #14 与 close 机位冲突 | #14 改为 bbox 在视口内，close 只按 C7.4 裁切规则 |
| RT2-23 | 像素阈值含糊 | definitions.pixel；接触处重叠 ≥0.5 u |
| RT2-24 | 纯函数与实时功能冲突 | definitions.renderTuple：历史经 eventsLog / pointerLog 输入，quality 固定 |
| RT2-25 | 角色扮演、动作手感与声音 | 同 RT1-11 / RT1-12 / RT1-30 |
| RT2-26 | 绝对 LLM 评分 | 同 RT1-11：对固定参考集的强制选择与排序 |
| RT2-27 | 数量锚点、缺少克制 | C7.7 的显著运动焦点 ≤2 与"你会删掉什么" |
| RT2-28 | 世界尺度 | data-size-m + check-scale.mjs，真实范围或在 docs/composition.md 写明风格化（C13.4） |
| RT2-29 | 契约变更遗漏与顺序 | HORIZON_Y 按风格、data-tract / data-detail / data-text / data-size-m、G12 包装元素、顺序：选风格 → z-band 冻结 → 工具 → 构建 |
| RT2-31 | 团队覆盖矩阵 | docs/team/coverage.json 由 rubric 与 wf-build 生成，100% 覆盖进入 G14 |
| RT2-32 | rubric 本身含无来源的外部事实 | 已从锚点与裁决中删除；G6 与 C12.5 的范围扩大到 README 链接的全部文档 |
| RT2-33 | 基线过时 | BL-26 标 resolved-before-R0；历史 SVG 数量从克隆实时统计；R0 复核所有 BL-\* |
| RT2-35 | 条带对静帧不公平 | 同 RT1-02：按格式分组、分别报告 |
| RT2-36 | 一票否决的 LLM 面板 | 只计首个物种、异议须经 J-valid 核实、#12/#13 可"无法判断" |
| RT2-37 | 减少动态与开场冲突 | C7.1、C9.1 在 no-preference 下测；C9.6 与 G11 另定减少动态首屏规格 |
| RT2-38 | document.fonts.check 无效 | cjk-glyph.mjs 用 canvas 对比 .notdef（BL-30） |
| RT2-39 | 协议墙钟 | 同 RT1-36 |
| RT2-40 | 交接说明 | docs/handoff.md（中文），在 claims 范围内、过 readme-lint，列出分数、门槛与未达标项（C11.5） |

### 14.2 部分采纳 / 未采纳的部分及理由（10）

| 发现 | 未采纳的部分 | 理由与替代做法 |
|---|---|---|
| RT1-02 | 公开可下载的 2025–26 前沿模型鹈鹕 SVG 作为计分对照 | 不作为计分层：来源与许可无法在本环境核实，而且一旦放进计分就等于对具名模型作比较声明（G6 禁止）。只在许可明确时放进私有评估作参考，结果不计分、不发布。 |
| RT1-05 | "评审只允许 Read 工具" | 采纳为政策，但不能假设 workflow 能按代理裁剪工具集；以提示限制 + 隔离目录 + ledger 审计 + 越界作废来执行。 |
| RT1-06 | "每个额外项都做有 / 无 A/B" | 约 80 个 criterion × 多个额外项会让协议墙钟翻倍。只对被任一评审标为"分散注意 / 多余"的额外项与 C5.4、C6.3 的表演选择做 A/B；其余靠可见性规则。 |
| RT1-08 | 感知核心底线 9 + 从 D10 / D12 挪 6 分给 D6 / D7 | 底线取 8 并加乘数 min(1, H/9)：13 项高度相关的同族评审，底线 9 会让一次中位翻转决定成败，乘数已惩罚核心均值不足。挪分：D1、D2、D3、D4、D5、D8、D12 各 −1，D9、D10 各 −2，共 11 分，其中 10 分给新的 D13（用户点名的细节），1 分给 D11；D7 保持 10 分，但内部新增了 C7.6、C7.7 两个感知项。 |
| RT1-20 | "惩罚任何复用资产的彩蛋" | 复用资产本身不是缺陷（静态细节正需要 `<use>` 复用）；惩罚的是复用现成动作或 toast 冒充彩蛋、以及打破虚构的彩蛋。 |
| RT1-40 | "前景层不得覆盖骑者 bbox 的下三分之一" | 与用户所选风格的 STYLE-C §4（前景至多盖住车轮底部 8%）冲突；改为前景只在 GROUND_Y 以下与车轮重叠、不得盖住任何接触区，并要求接触区 ≥70% 可见。 |
| RT2-14 | "印章必须是篆书" | 本容器只有 WenQuanYi Zen Hei；仿印章元素要么手工构造篆书轮廓，要么明确做成 deco 题签而不冒充篆刻印章。字形正确性、3× 审校与失败封顶（C9.8）照单全收。 |
| RT2-21 | "把每条锚点重写成 requirements[] / symptoms[]" | 保留可读的散文锚点，由生成器按"；"自动拆成带 id 的原子条目（2/5 档视为症状、8/10 档视为要求），R0 由首席评审标注难度后冻结；避免手工重写 80 个 criterion 时引入新的歧义。 |
| RT2-30 | "D11 6 → 8" | 取 7：C11.1 提到 w3 并要求 pelican-mini.svg，已把基准本体的折合总分从 2.0 提到 3.0；再多就要从感知维度挪分。C8.2 → 1.5、C1.4 移到 D12（w1.5）、C2.1 → 4、C12.7 → 1 均照采。 |
| RT2-34 | "喉囊 / 喙 / 面皮两两 ΔL\* ≥10" | 风格 C 中喙与面皮同为 K 墨，这一条在所选风格下不可能成立；改为喉囊与喙 ΔL\* ≥8（golden 实测 10.0）、喙 / 面皮与羽毛 ΔL\* ≥10，并保留 deutan 模拟下 ≥4/5 的物种识别。 |

### 14.3 完全未采纳（0）

无。两份报告的每一条发现都至少部分采纳；被拒绝的具体部分及理由见 14.2。

---

*由 `node docs/rubric/gen-rubric.mjs` 从 `rubric.json` 生成，请勿手改。*
