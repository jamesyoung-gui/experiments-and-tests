#!/usr/bin/env python3
"""
三层平面图（工厂楼上，健身房 + 书房）——纯代码生成 SVG，无第三方依赖。

    python3 floor_plan.py     # 生成 base.svg / current.svg / proposed.svg

几何数据按原施工图纸《三层平面图》数字化，并带上图纸上的铅笔修改：
  - 前室（电梯/楼梯口）西侧隔墙向上延长，封闭前室
  - 前室北端新开一扇门，作为进入大厅的入口
  - 原来靠南墙的那扇前室门封掉
  - 前室里那组横向柜子取消

坐标：单位毫米，原点在图纸左上角，x 向右，y 向下，和纸面方向一致。
  - 图纸上方：北墙，两段长窗（照片里的“三扇竖长窗”那面墙）
  - 图纸左侧：落地玻璃和阳台对开门，外面是 L 形阳台
  - 图纸右侧：卫生间、储藏间、前室、电梯、楼梯
"""

from pathlib import Path

# ---------------------------------------------------------------- 画布
SCALE = 0.06                          # px / mm  -> 1 m = 60 px
VIEW = (-1500, -2300, 17600, 15700)   # x, y, w, h（mm）
OUT_DIR = Path(__file__).resolve().parent

# ---------------------------------------------------------------- 建筑：区域（x0, y0, x1, y1）
HALL = [
    (1400, 200, 10600, 4800),    # 北半区（含西北角凹进的窗区）
    (3700, 4800, 9083, 10100),   # 南半区
    (10800, 2300, 13100, 3530),  # 卫生间 / 储藏间门口的小过道
]
BALCONY = [(100, 4850, 3500, 11500), (3500, 10300, 8900, 11500)]
BALCONY_OUTLINE = [(100, 4850), (3500, 4850), (3500, 10300), (8900, 10300), (8900, 11500), (100, 11500)]
PLATFORM = (100, 0, 1100, 4850)                      # 室外空调平台
ROOMS = {
    "bath": (10800, 200, 14200, 2300),
    "storage": [(10800, 3630, 14200, 6150), (13200, 2300, 14200, 3630)],
    "lobby": [(9183, 4800, 10600, 6250), (9183, 6250, 10800, 10100)],
    "stair": (10800, 8650, 14200, 10100),
    "lift": (10900, 6250, 12800, 8550),
    "flight_up": (12900, 6330, 14200, 8650),
}

WALLS = [
    (1100, 0, 14400, 200),        # 北墙
    (1100, 0, 1400, 4850),        # 西北窗区西墙
    (1100, 4650, 3700, 4850),     # 西北窗区南墙
    (3500, 4650, 3700, 10300),    # 西墙（落地玻璃 + 阳台门）
    (3500, 10100, 14400, 10300),  # 南墙
    (14200, 0, 14400, 10300),     # 东墙
    (10600, 200, 10800, 2300),    # 卫生间西墙
    (10600, 2300, 12250, 2480),   # 卫生间南墙（门洞左）
    (12950, 2300, 13200, 2480),   # 卫生间南墙（门洞右）
    (13200, 2150, 14200, 2300),   # 马桶间南墙
    (12100, 200, 12150, 2300),    # 淋浴区 / 浴缸区隔断
    (13100, 200, 13200, 1450),    # 马桶间西墙（门洞上）
    (13100, 2050, 13200, 2300),   # 马桶间西墙（门洞下）
    (13100, 2300, 13200, 2420),   # 储藏间门垛
    (13100, 3120, 13200, 3630),   # 储藏间门洞下
    (10600, 3530, 13200, 3630),   # 储藏间北墙
    (10600, 3530, 10800, 6250),   # 储藏间西墙
    (10600, 6150, 14200, 6250),   # 储藏间南墙 / 电梯北墙
    (10800, 6250, 10900, 6800),   # 电梯西墙（门洞上）
    (10800, 7700, 10900, 8650),   # 电梯西墙（门洞下）
    (10800, 8550, 12900, 8650),   # 电梯南墙
    (12800, 6250, 12900, 8650),   # 电梯东墙
]
COLUMNS = [
    (1650, 0, 2100, 450), (6270, 0, 6780, 450), (10600, 0, 11050, 450),
    (1650, 4550, 2100, 5000), (3450, 9900, 3900, 10300), (6270, 9900, 6780, 10300),
    (10650, 9900, 11050, 10300), (10600, 4400, 11100, 4900),
]

# 前室西侧隔墙：原图纸 vs 铅笔修改后
PARTITION_ORIGINAL = [(9083, 6130, 9183, 8950), (9083, 9980, 9183, 10100)]
PARTITION_PENCIL = [(9083, 4850, 9183, 10100)]
PENCIL_ADDED_WALLS = [(9083, 4850, 9183, 6130), (9083, 8950, 9183, 9980)]

# 窗：(x0, y0, x1, y1)，画在墙体范围内
WINDOWS = [
    (3150, 40, 6250, 160), (6800, 40, 10550, 160),           # 北墙两段长窗
    (1180, 1090, 1320, 1700), (1180, 2300, 1320, 2880), (1180, 3500, 1320, 3880),  # 西北窗区
    (3540, 4950, 3660, 6850), (3540, 8300, 3660, 9900),      # 西墙落地玻璃
    (3950, 10140, 6250, 10260), (6800, 10140, 8950, 10260),  # 南墙两段窗
]

# 门：gap 为墙上开洞；leaves 里每扇门是 (合页点, 门扇打开后的端点, 关门时的端点)
DOORS = [
    dict(gap=(3500, 6850, 3700, 8300), leaves=[((3700, 6850), (4425, 6850), (3700, 7575)),
                                                ((3700, 8300), (4425, 8300), (3700, 7575))]),   # 阳台对开门
    dict(gap=None, leaves=[((12950, 2480), (12950, 3180), (12250, 2480))]),                    # 卫生间
    dict(gap=None, leaves=[((13200, 1450), (13800, 1450), (13200, 2050))]),                    # 马桶间
    dict(gap=None, leaves=[((13200, 2420), (13900, 2420), (13200, 3120))]),                    # 储藏间
]
DOOR_PENCIL_NEW = dict(gap=None, leaves=[((10600, 4800), (10600, 6217), (9183, 4800))])        # 铅笔新增入户门
DOOR_ORIGINAL_LOBBY = dict(gap=(9083, 8950, 9183, 9980),
                           leaves=[((9183, 9980), (10213, 9980), (9183, 8950))])               # 原前室门

CABINET_KEEP = (9183, 6130, 9545, 8490)        # 前室竖向柜（保留）
CABINET_REMOVED = (9545, 8160, 10760, 8610)    # 前室横向柜（铅笔划掉）
NORTH_CABINET = (2140, 200, 3090, 630)         # 北墙边的固定柜
WET_BAR = (10150, 650, 10600, 2250)            # 图纸上贴卫生间西墙的高柜，现场做成了水吧

DIMS_BOTTOM = [100, 3500, 3700, 9083, 9183, 10800, 14200]
DIMS_LEFT = [0, 100, 4850, 10300, 11600]

# ---------------------------------------------------------------- 三张图
BASE = dict(
    file="base",
    title="三层平面图 · 原图纸 + 铅笔修改",
    subtitle="红色 = 铅笔划掉（取消），橙色 = 铅笔新增",
    pencil="show",
    zones=[], furniture=[], tv=None,
    labels={"hall": "画室（原图纸用途）", "storage": "储藏间"},
)

CURRENT = dict(
    file="current",
    title="现状 · Current layout",
    subtitle="家具位置按 2026-02 的现场照片还原（格局已按铅笔修改）",
    pencil="applied",
    zones=[],
    furniture=[
        dict(r=WET_BAR, label="水吧(固定)", cls="bar", rot=True),
        dict(r=(1650, 300, 2600, 1000), label="纸箱", cls="box"),
        dict(r=(1650, 2000, 2350, 3600), label="杂物桌", cls="wood", rot=True),
        dict(r=(3300, 300, 4500, 900), label="衣架", cls="box"),
        dict(r=(4800, 220, 5300, 380), label="", cls="mirror"),
        dict(r=(6000, 220, 7000, 650), label="矮柜", cls="box"),
        dict(r=(8500, 250, 9200, 1050), label="SkiErg", cls="dark"),
        dict(r=(6300, 900, 7100, 1350), label="哑铃/药球", cls="dark"),
        dict(r=(7000, 1600, 8500, 2500), label="训练垫", cls="mat"),
        dict(r=(9300, 1300, 9900, 3700), label="划船机", cls="dark", rot=True),
        dict(c=(3000, 3700, 400), label="斑马懒人包", cls="soft"),
        dict(r=(3850, 5100, 4850, 6000), label="折叠椅", cls="soft"),
        dict(c=(5400, 7400, 1100), label="圆地毯", cls="rug"),
        dict(c=(5100, 7100, 280), label="", cls="soft"),
        dict(c=(5800, 7800, 280), label="", cls="soft"),
        dict(r=(6400, 7700, 7100, 8400), label="转椅", cls="dark"),
        dict(r=(7300, 7100, 8400, 7800), label="藤编茶几", cls="wood"),
        dict(r=(8650, 5000, 9083, 10000), label="胡桃木书架 / 陶器架", cls="wood", rot=True),
        dict(r=(6000, 8900, 7600, 9650), label="实木书桌", cls="wood"),
        dict(r=(6300, 9700, 6800, 10050), label="佛龛", cls="wood"),
        dict(r=(7950, 9300, 8550, 9900), label="藤椅", cls="soft"),
        dict(c=(5000, 9700, 220), label="落地灯", cls="lamp"),
        dict(c=(4050, 9650, 320), label="绿植", cls="plant"),
    ],
    tv=None,
    labels={"hall": "大厅", "storage": "储藏间\n(堆杂物)"},
)

PROPOSED = dict(
    file="proposed",
    title="规划 · Proposed",
    subtitle="上半区健身（靠水吧）· 西北窗区做有氧 · 下半区书房 + 影音 · 储藏间改恢复室",
    pencil="applied",
    zones=[
        dict(r=(1400, 200, 10150, 4650), label="黑色橡胶地垫 2cm", cls="z-gym"),
        dict(r=(4200, 1700, 7400, 4500), label="留白：脚步 / 增强式\n3.2m × 2.8m", cls="z-plyo"),
        dict(r=(4200, 5500, 8500, 10000), label="灰色羊毛地毯", cls="z-rug"),
    ],
    furniture=[
        dict(r=WET_BAR, label="水吧(固定)", cls="bar", rot=True),
        # 健身
        dict(r=(7600, 300, 9600, 1900), label="不锈钢史密斯\n三合一", cls="steel"),
        dict(r=(6000, 300, 7200, 800), label="哑铃架", cls="steel"),
        dict(r=(1650, 1150, 2400, 1950), label="SkiErg", cls="dark"),
        dict(r=(1650, 2400, 4050, 3000), label="划船机（面向窗）", cls="dark"),
        dict(r=(3850, 3200, 4050, 4400), label="", cls="mirror"),
        dict(r=(2600, 3400, 3700, 4400), label="镜子(可移动)\n+ 拍摄机位", cls="ghost"),
        # 书房 + 影音
        dict(r=(8680, 5000, 9083, 10000), label="顶天立地书墙（黑钢 + 实木）", cls="wood", rot=True),
        dict(r=(7400, 6600, 8200, 8200), label="升降桌\n1\" 薄板", cls="metal"),
        dict(r=(8220, 7100, 8660, 7700), label="Aeron", cls="dark", rot=True),
        dict(r=(7550, 6150, 8050, 6500), label="台灯", cls="lamp"),
        dict(r=(4900, 9150, 7200, 10000), label="Maralunga 沙发（黑皮）", cls="leather"),
        dict(r=(7300, 9350, 7850, 9900), label="低音炮", cls="dark"),
        dict(c=(4500, 9100, 260), label="Arco", cls="lamp"),
        dict(r=(3900, 5150, 4700, 5950), label="休闲椅", cls="leather"),
        dict(c=(4000, 6400, 250), label="", cls="plant"),
        # 恢复室
        dict(r=(11300, 4300, 13300, 5000), label="按摩床", cls="soft"),
        # 阳台
        dict(c=(1800, 7600, 600), label="户外桌椅", cls="soft"),
        dict(c=(800, 5600, 350), label="植物", cls="plant"),
        dict(c=(5000, 10900, 300), label="", cls="plant"),
        dict(c=(6500, 10900, 300), label="", cls="plant"),
    ],
    # 移动电视架：办公位朝书桌，原地转 90° 再往前推一点就是观影位
    tv=dict(work=(6100, 6350, 6450, 7650), movie=(5600, 7450, 6900, 7800),
            label="LG C5 55\"\n+ Soundbar"),
    labels={"hall": "", "storage": "恢复室\n(按摩 / 冥想 / 午睡)"},
)

# ---------------------------------------------------------------- 样式
STYLE = """
  .bg{fill:#fbfaf7}
  .floor{fill:#efe6d6}
  .annex{fill:#e6e3dc}
  .balcony{fill:#e3ece4;stroke:#7a8b7c;stroke-width:3}
  .platform{fill:#eeeeee;stroke:#9a9a9a;stroke-width:1;stroke-dasharray:4 3}
  .wall{fill:#2b2b2b}
  .column{fill:#111}
  .window{fill:#cfe8f6;stroke:#2b6f96;stroke-width:1}
  .door{fill:none;stroke:#555;stroke-width:1.2}
  .door-leaf{stroke:#555;stroke-width:2}
  .tread{stroke:#888;stroke-width:1}
  .lift{fill:none;stroke:#666;stroke-width:1}
  .fixture{fill:#fff;stroke:#666;stroke-width:1}
  .wood{fill:#a87b55;stroke:#5d3d22;stroke-width:1}
  .soft{fill:#e9d8c4;stroke:#8a7660;stroke-width:1}
  .dark{fill:#3b3b3b;stroke:#111;stroke-width:1}
  .leather{fill:#1f1f1f;stroke:#000;stroke-width:1}
  .steel{fill:#c9ced3;stroke:#59606a;stroke-width:1.5}
  .metal{fill:#d9dde1;stroke:#59606a;stroke-width:1}
  .mirror{fill:#e8f4fa;stroke:#59606a;stroke-width:1}
  .ghost{fill:none;stroke:#8a8a8a;stroke-width:1;stroke-dasharray:3 3}
  .box{fill:#eadcc3;stroke:#8a7660;stroke-width:1}
  .mat{fill:#2a2a2a;stroke:#000;stroke-width:1}
  .lamp{fill:#fff3c4;stroke:#b89a2e;stroke-width:1}
  .plant{fill:#9cc59a;stroke:#4f7d4c;stroke-width:1}
  .rug{fill:#f3f1ec;stroke:#a9a39a;stroke-width:1}
  .bar{fill:#f5f5f5;stroke:#333;stroke-width:1.5}
  .cabinet{fill:#fff;stroke:#555;stroke-width:1}
  .z-gym{fill:#3a3a3a;fill-opacity:.16;stroke:#3a3a3a;stroke-width:1;stroke-dasharray:4 3}
  .z-rug{fill:#8d96a0;fill-opacity:.16;stroke:#8d96a0;stroke-width:1;stroke-dasharray:4 3}
  .z-plyo{fill:#e07a2f;fill-opacity:.12;stroke:#e07a2f;stroke-width:1.5;stroke-dasharray:6 3}
  .tv{fill:#111;stroke:#000}
  .tv-ghost{fill:none;stroke:#111;stroke-width:1.2;stroke-dasharray:4 3}
  .arrow{fill:none;stroke:#c0392b;stroke-width:1.6}
  .pencil-add{fill:#e67e22;stroke:#e67e22}
  .pencil-add-line{fill:none;stroke:#e67e22;stroke-width:2.5}
  .pencil-del{fill:none;stroke:#d62d20;stroke-width:2;stroke-dasharray:5 3}
  .pencil-x{stroke:#d62d20;stroke-width:2}
  text{font-family:"PingFang SC","Noto Sans CJK SC","WenQuanYi Zen Hei","Microsoft YaHei",sans-serif;fill:#222}
  .lbl{font-size:11px;text-anchor:middle;dominant-baseline:central}
  .lbl-inv{fill:#fff}
  .room{font-size:13px;font-weight:700;fill:#555;text-anchor:middle;dominant-baseline:central;letter-spacing:1px}
  .zone-lbl{font-size:12px;font-weight:600;text-anchor:middle;dominant-baseline:central;fill:#444}
  .pencil-lbl{font-size:11px;font-weight:600;fill:#c0392b;text-anchor:middle;dominant-baseline:central}
  .title{font-size:20px;font-weight:700}
  .note{font-size:11px;fill:#666}
  .dim{stroke:#777;stroke-width:1;fill:none}
  .dim-txt{font-size:10px;fill:#555;text-anchor:middle;dominant-baseline:central}
"""

DARK_CLASSES = {"dark", "leather", "mat", "tv"}


# ---------------------------------------------------------------- 绘图工具
class Canvas:
    def __init__(self):
        self.parts = []

    @staticmethod
    def px(v):
        return v * SCALE

    def add(self, s):
        self.parts.append(s)

    def rect(self, x0, y0, x1, y1, cls, rx=0):
        self.add(f'<rect class="{cls}" x="{self.px(x0):.1f}" y="{self.px(y0):.1f}" '
                 f'width="{self.px(x1 - x0):.1f}" height="{self.px(y1 - y0):.1f}" rx="{rx}"/>')

    def circle(self, cx, cy, r, cls):
        self.add(f'<circle class="{cls}" cx="{self.px(cx):.1f}" cy="{self.px(cy):.1f}" r="{self.px(r):.1f}"/>')

    def ellipse(self, cx, cy, rx, ry, cls):
        self.add(f'<ellipse class="{cls}" cx="{self.px(cx):.1f}" cy="{self.px(cy):.1f}" '
                 f'rx="{self.px(rx):.1f}" ry="{self.px(ry):.1f}"/>')

    def line(self, x1, y1, x2, y2, cls):
        self.add(f'<line class="{cls}" x1="{self.px(x1):.1f}" y1="{self.px(y1):.1f}" '
                 f'x2="{self.px(x2):.1f}" y2="{self.px(y2):.1f}"/>')

    def cross(self, x0, y0, x1, y1, cls):
        self.line(x0, y0, x1, y1, cls)
        self.line(x0, y1, x1, y0, cls)

    def text(self, x, y, s, cls="lbl", rotate=False):
        cx, cy = self.px(x), self.px(y)
        rot = f' transform="rotate(-90 {cx:.1f} {cy:.1f})"' if rotate else ""
        lines = s.split("\n")
        if len(lines) == 1:
            self.add(f'<text class="{cls}" x="{cx:.1f}" y="{cy:.1f}"{rot}>{s}</text>')
            return
        first = -(len(lines) - 1) * 0.6
        spans = "".join(f'<tspan x="{cx:.1f}" dy="{first if i == 0 else 1.2}em">{t}</tspan>'
                        for i, t in enumerate(lines))
        self.add(f'<text class="{cls}" x="{cx:.1f}" y="{cy:.1f}"{rot}>{spans}</text>')

    def svg(self):
        x, y, w, h = (v * SCALE for v in VIEW)
        body = "\n  ".join(self.parts)
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x:.0f} {y:.0f} {w:.0f} {h:.0f}" '
                f'width="{w:.0f}" height="{h:.0f}">\n<style>{STYLE}</style>\n'
                f'<rect class="bg" x="{x:.0f}" y="{y:.0f}" width="100%" height="100%"/>\n  {body}\n</svg>\n')


def area(rects):
    return sum((x1 - x0) * (y1 - y0) for x0, y0, x1, y1 in rects) / 1e6


# ---------------------------------------------------------------- 建筑
def draw_door(c, door, leaf_cls="door-leaf", arc_cls="door"):
    if door["gap"]:
        c.rect(*door["gap"], "floor")
    for (hx, hy), (ox, oy), (cx_, cy_) in door["leaves"]:
        c.line(hx, hy, ox, oy, leaf_cls)
        r = ((ox - hx) ** 2 + (oy - hy) ** 2) ** 0.5
        sweep = 1 if (ox - hx) * (cy_ - hy) - (oy - hy) * (cx_ - hx) > 0 else 0
        c.add(f'<path class="{arc_cls}" d="M {c.px(ox):.1f} {c.px(oy):.1f} '
              f'A {c.px(r):.1f} {c.px(r):.1f} 0 0 {sweep} {c.px(cx_):.1f} {c.px(cy_):.1f}"/>')


def draw_shell(c, plan):
    # 室外
    c.rect(*PLATFORM, "platform")
    c.text((PLATFORM[0] + PLATFORM[2]) / 2, 2400, "空调平台", "lbl", rotate=True)
    pts = " ".join(f"{c.px(x):.1f},{c.px(y):.1f}" for x, y in BALCONY_OUTLINE)
    c.add(f'<polygon class="balcony" points="{pts}"/>')
    c.text(1800, 10800, f"L 形阳台 ≈ {area(BALCONY):.0f} ㎡", "room")

    # 室内地面
    for r in HALL:
        c.rect(*r, "floor")
    for key in ("bath", "lift", "stair", "flight_up"):
        c.rect(*ROOMS[key], "annex")
    for key in ("storage", "lobby"):
        for r in ROOMS[key]:
            c.rect(*r, "annex")

    # 分区（地垫、地毯等）
    for z in plan["zones"]:
        c.rect(*z["r"], z["cls"])

    # 楼梯踏步
    x0, y0, x1, y1 = ROOMS["flight_up"]
    for y in range(y0, y1, 280):
        c.line(x0, y, x1, y, "tread")
    for x in range(11000, 12760, 280):
        c.line(x, 8730, x, 9950, "tread")
    c.text(11880, 9340, "楼梯 ↓", "lbl")

    # 电梯
    lx0, ly0, lx1, ly1 = ROOMS["lift"]
    c.rect(lx0 + 250, ly0 + 300, lx1 - 250, ly1 - 300, "lift")
    c.cross(lx0 + 250, ly0 + 300, lx1 - 250, ly1 - 300, "lift")
    c.text((lx0 + lx1) / 2, (ly0 + ly1) / 2, "电梯", "room")

    # 卫生间洁具
    c.circle(11450, 900, 140, "fixture")
    c.rect(11000, 1750, 12000, 2250, "fixture")
    c.ellipse(11500, 2000, 300, 170, "fixture")
    c.rect(12250, 280, 13050, 1050, "fixture", rx=10)
    c.ellipse(13700, 900, 260, 360, "fixture")

    # 墙、柱、窗
    for w in WALLS:
        c.rect(*w, "wall")
    partition = PARTITION_ORIGINAL if plan["pencil"] == "show" else PARTITION_PENCIL
    for w in partition:
        c.rect(*w, "wall")
    for col in COLUMNS:
        c.rect(*col, "column")
    for win in WINDOWS:
        c.rect(*win, "window")

    # 门
    for d in DOORS:
        draw_door(c, d)
    if plan["pencil"] == "show":
        draw_door(c, DOOR_ORIGINAL_LOBBY)
        draw_door(c, DOOR_PENCIL_NEW, "pencil-add-line", "pencil-add-line")
    else:
        draw_door(c, DOOR_PENCIL_NEW)

    # 固定柜
    c.rect(*CABINET_KEEP, "cabinet")
    c.cross(*CABINET_KEEP, "lift")
    c.rect(*NORTH_CABINET, "cabinet")
    c.cross(*NORTH_CABINET, "lift")
    if plan["pencil"] == "show":
        c.rect(*CABINET_REMOVED, "cabinet")
        c.cross(*CABINET_REMOVED, "lift")
        c.rect(*WET_BAR, "cabinet")
        c.line(WET_BAR[0], WET_BAR[1], WET_BAR[2], WET_BAR[3], "lift")

    # 房间名
    labels = plan["labels"]
    c.text(12600, 1650, "卫生间", "room")
    c.text(12000, 3000, "过道", "lbl")
    c.text(12300, 5300 if plan["file"] == "proposed" else 4800, labels["storage"], "room")
    c.text(9890, 5450, "前室", "room")
    c.text(9890, 5800, "（玄关）", "lbl")
    c.text(9364, 7300, "玄关柜", "lbl", rotate=True)
    if labels["hall"]:
        c.text(6400, 6000, labels["hall"], "room")


def draw_pencil_marks(c):
    for w in PENCIL_ADDED_WALLS:
        c.rect(*w, "pencil-add")
    x0, y0, x1, y1 = DOOR_ORIGINAL_LOBBY["gap"]
    c.cross(x0 - 150, y0, x1 + 900, y1, "pencil-x")
    c.rect(*CABINET_REMOVED, "pencil-del")
    c.cross(*CABINET_REMOVED, "pencil-x")
    c.text(7300, 4400, "① 新增入户门", "pencil-lbl")
    c.line(8000, 4480, 9600, 4950, "pencil-add-line")
    c.text(7300, 5500, "② 隔墙向上延长", "pencil-lbl")
    c.line(8100, 5500, 9083, 5500, "pencil-add-line")
    c.text(7300, 9450, "③ 原门封掉", "pencil-lbl")
    c.line(7900, 9450, 9083, 9450, "pencil-add-line")
    c.text(10150, 8900, "④ 柜子取消", "pencil-lbl")
    c.text(10375, 1450, "高柜（现为水吧）", "lbl", rotate=True)


def draw_furniture(c, items):
    for f in items:
        cls = f["cls"]
        lbl_cls = "lbl lbl-inv" if cls in DARK_CLASSES else "lbl"
        if "r" in f:
            x0, y0, x1, y1 = f["r"]
            c.rect(x0, y0, x1, y1, cls, rx=3)
            if f["label"]:
                c.text((x0 + x1) / 2, (y0 + y1) / 2, f["label"], lbl_cls, rotate=f.get("rot", False))
        else:
            cx, cy, r = f["c"]
            c.circle(cx, cy, r, cls)
            if f["label"]:
                if r >= 500:
                    ty = cy + r * 0.8
                elif cy + r + 400 > 9950:      # 贴南墙的放上面，免得压到墙
                    ty = cy - r - 200
                else:
                    ty = cy + r + 200
                c.text(cx, ty, f["label"])


def draw_tv(c, tv):
    if not tv:
        return
    wx0, wy0, wx1, wy1 = tv["work"]
    mx0, my0, mx1, my1 = tv["movie"]
    c.rect(wx0, wy0, wx1, wy1, "tv", rx=2)
    c.text(wx0 - 650, (wy0 + wy1) / 2, tv["label"])
    c.rect(mx0, my0, mx1, my1, "tv-ghost", rx=2)
    c.text((mx0 + mx1) / 2, my1 + 220, "观影位（转 90°）")
    sx, sy = c.px(wx1), c.px(wy0 + 300)
    ex, ey = c.px(mx1 - 100), c.px(my0)
    c.add(f'<path class="arrow" d="M {sx:.1f} {sy:.1f} Q {ex + 20:.1f} {sy:.1f} {ex:.1f} {ey:.1f}" '
          f'marker-end="url(#arrow)"/>')


def draw_zone_labels(c, plan):
    for z in plan["zones"]:
        x0, y0, x1, y1 = z["r"]
        if z["cls"] == "z-plyo":
            c.text((x0 + x1) / 2, (y0 + y1) / 2, z["label"], "zone-lbl")
        elif z["cls"] == "z-gym":
            c.text(5800, 1400, z["label"], "zone-lbl")
        else:
            c.text((x0 + x1) / 2, y0 + 250, z["label"], "zone-lbl")


def draw_dims(c):
    y = 12200
    xs = DIMS_BOTTOM
    for a, b in zip(xs, xs[1:]):
        c.text((a + b) / 2, y - 220, f"{b - a}", "dim-txt")
    c.line(xs[0], y, xs[-1], y, "dim")
    for x in xs:
        c.line(x, y - 120, x, y + 120, "dim")
    y2 = 12900
    c.line(0, y2, 14400, y2, "dim")
    for x in (0, 14400):
        c.line(x, y2 - 120, x, y2 + 120, "dim")
    c.text(7200, y2 - 220, "14400", "dim-txt")

    x = -700
    ys = DIMS_LEFT
    c.line(x, ys[0], x, ys[-1], "dim")
    for yy in ys:
        c.line(x - 120, yy, x + 120, yy, "dim")
    for a, b in zip(ys, ys[1:]):
        if b - a > 300:
            c.text(x - 250, (a + b) / 2, f"{b - a}", "dim-txt", rotate=True)


def draw_header(c, plan):
    hall = area(HALL)
    c.add(f'<text class="title" x="{c.px(-1300):.1f}" y="{c.px(-1650):.1f}">{plan["title"]}</text>')
    c.add(f'<text class="note" x="{c.px(-1300):.1f}" y="{c.px(-1150):.1f}">{plan["subtitle"]}</text>')
    c.add(f'<text class="note" x="{c.px(-1300):.1f}" y="{c.px(-750):.1f}">'
          f'尺寸按原图纸（mm）· 大厅净面积 ≈ {hall:.0f} ㎡ · '
          f'整层含卫生间 / 储藏 / 前室 / 电梯楼梯 ≈ 125 ㎡</text>')


def render(plan):
    c = Canvas()
    c.add('<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" '
          'orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#c0392b"/></marker></defs>')
    draw_shell(c, plan)
    draw_furniture(c, plan["furniture"])
    draw_tv(c, plan["tv"])
    draw_zone_labels(c, plan)
    if plan["pencil"] == "show":
        draw_pencil_marks(c)
    draw_dims(c)
    draw_header(c, plan)
    return c.svg()


def main():
    for plan in (BASE, CURRENT, PROPOSED):
        path = OUT_DIR / f'{plan["file"]}.svg'
        path.write_text(render(plan), encoding="utf-8")
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
