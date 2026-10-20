#!/usr/bin/env python3
"""
三层平面图（工厂楼上：吧台 + 工作 + lounge）——纯代码生成 SVG，无第三方依赖。

    python3 floor_plan.py     # 生成 base.svg / proposed.svg

建筑几何按原施工图纸《三层平面图》数字化（DRAWING_* 常量，图纸坐标），
并带上图纸上的铅笔修改：
  - 前室西侧隔墙延长，北端（现为西端）新开入户门
  - 原来靠外墙的前室门封掉
  - 前室里那组横向柜子取消

图纸是横着画的。出图时统一逆时针转 90°，变成上北下南左西右东：
  - 南：L 形大阳台 + 阳台对开门
  - 西：两段长窗
  - 东：两扇窗（原佛龛在两窗之间）
  - 北：卫生间、储藏间、前室、电梯、楼梯

坐标：单位毫米。
  - 图纸坐标：原点在图纸左上角，x 向右，y 向下（DRAWING_* 都用这个）
  - 平面坐标：转正后的坐标，原点在西北角，X 向东，Y 向南（家具都用这个）
"""

from pathlib import Path

DRAWING_W = 14400                     # 图纸横向总长，转正后变成南北进深


def rot(x, y):
    """图纸坐标 -> 平面坐标（逆时针 90°，上北下南）。"""
    return y, DRAWING_W - x


def rot_rect(r):
    (ax, ay), (bx, by) = rot(r[0], r[1]), rot(r[2], r[3])
    return min(ax, bx), min(ay, by), max(ax, bx), max(ay, by)


# ---------------------------------------------------------------- 画布
SCALE = 0.06                          # px / mm  -> 1 m = 60 px
VIEW = (-1500, -2900, 15600, 19500)   # X, Y, W, H（mm，平面坐标）
OUT_DIR = Path(__file__).resolve().parent

# ---------------------------------------------------------------- 建筑（图纸坐标）
DRAWING_HALL = [
    (1400, 200, 10600, 4800),    # 西翼（含南端窗区）
    (3700, 4800, 9083, 10100),   # 东半区
    (10800, 2300, 13100, 3530),  # 卫生间 / 储藏间门口的小过道
]
DRAWING_BALCONY_OUTLINE = [(100, 4850), (3500, 4850), (3500, 10300), (8900, 10300), (8900, 11500), (100, 11500)]
DRAWING_BALCONY = [(100, 4850, 3500, 11500), (3500, 10300, 8900, 11500)]
DRAWING_PLATFORM = (100, 0, 1100, 4850)
DRAWING_ROOMS = {
    "bath": [(10800, 200, 14200, 2300)],
    "storage": [(10800, 3630, 14200, 6150), (13200, 2300, 14200, 3630)],
    "lobby": [(9183, 4800, 10600, 6250), (9183, 6250, 10800, 10100)],
    "stair": [(10800, 8650, 14200, 10100), (12900, 6330, 14200, 8650)],
    "lift": [(10900, 6250, 12800, 8550)],
}
DRAWING_WALLS = [
    (1100, 0, 14400, 200),        # 西墙（图纸上方）
    (1100, 0, 1400, 4850),        # 西翼南墙
    (1100, 4650, 3700, 4850),     # 西翼东侧（对阳台）
    (3500, 4650, 3700, 10300),    # 南墙（落地玻璃 + 阳台门）
    (3500, 10100, 14400, 10300),  # 东墙
    (14200, 0, 14400, 10300),     # 北墙
    (10600, 200, 10800, 2300),    # 卫生间南墙
    (10600, 2300, 12250, 2480),   # 卫生间东墙（门洞北）
    (12950, 2300, 13200, 2480),   # 卫生间东墙（门洞南）
    (13200, 2150, 14200, 2300),
    (12100, 200, 12150, 2300),
    (13100, 200, 13200, 1450),
    (13100, 2050, 13200, 2300),
    (13100, 2300, 13200, 2420),
    (13100, 3120, 13200, 3630),
    (10600, 3530, 13200, 3630),   # 储藏间西墙
    (10600, 3530, 10800, 6250),   # 储藏间南墙
    (10600, 6150, 14200, 6250),   # 储藏间 / 电梯之间
    (10800, 6250, 10900, 6800),   # 电梯南墙（门洞西）
    (10800, 7700, 10900, 8650),   # 电梯南墙（门洞东）
    (10800, 8550, 12900, 8650),
    (12800, 6250, 12900, 8650),
]
DRAWING_COLUMNS = [
    (1650, 0, 2100, 450), (6270, 0, 6780, 450), (10600, 0, 11050, 450),
    (1650, 4550, 2100, 5000), (3450, 9900, 3900, 10300), (6270, 9900, 6780, 10300),
    (10650, 9900, 11050, 10300), (10600, 4400, 11100, 4900),
]
DRAWING_PARTITION_ORIGINAL = [(9083, 6130, 9183, 8950), (9083, 9980, 9183, 10100)]
DRAWING_PARTITION_PENCIL = [(9083, 4850, 9183, 10100)]
DRAWING_PENCIL_ADDED_WALLS = [(9083, 4850, 9183, 6130), (9083, 8950, 9183, 9980)]
DRAWING_WINDOWS = [
    (3150, 40, 6250, 160), (6800, 40, 10550, 160),           # 西墙两段长窗
    (1180, 1090, 1320, 1700), (1180, 2300, 1320, 2880), (1180, 3500, 1320, 3880),  # 西翼南窗
    (3540, 4950, 3660, 6850), (3540, 8300, 3660, 9900),      # 南面落地玻璃
    (3950, 10140, 6250, 10260), (6800, 10140, 8950, 10260),  # 东墙两扇窗
]
# 门：gap 为墙上开洞；leaves 里每扇门是 (合页点, 门扇打开后的端点, 关门时的端点)
DRAWING_DOORS = [
    dict(gap=(3500, 6850, 3700, 8300), leaves=[((3700, 6850), (4425, 6850), (3700, 7575)),
                                                ((3700, 8300), (4425, 8300), (3700, 7575))]),   # 阳台对开门
    dict(gap=None, leaves=[((12950, 2480), (12950, 3180), (12250, 2480))]),                    # 卫生间
    dict(gap=None, leaves=[((13200, 1450), (13800, 1450), (13200, 2050))]),                    # 马桶间
    dict(gap=None, leaves=[((13200, 2420), (13900, 2420), (13200, 3120))]),                    # 储藏间
]
DRAWING_DOOR_PENCIL_NEW = dict(gap=None, leaves=[((10600, 4800), (10600, 6217), (9183, 4800))])
DRAWING_DOOR_ORIGINAL_LOBBY = dict(gap=(9083, 8950, 9183, 9980),
                                   leaves=[((9183, 9980), (10213, 9980), (9183, 8950))])
DRAWING_CABINET_KEEP = (9183, 6130, 9545, 8490)      # 玄关柜（保留）
DRAWING_CABINET_REMOVED = (9545, 8160, 10760, 8610)  # 前室横向柜（铅笔划掉）
DRAWING_FIXED_CABINET = (2140, 200, 3090, 630)       # 西墙边的固定柜
DRAWING_WET_BAR = (10150, 650, 10600, 2250)          # 现有小水吧

# 尺寸链（图纸坐标），转正后左侧链跑到底边，底边链跑到右侧
DIMS_X = [0, 100, 4850, 10300, 11600]                # 图纸 y -> 平面 X
DIMS_Y = [100, 3500, 3700, 9083, 9183, 10800, 14200]  # 图纸 x -> 平面 Y

# ---------------------------------------------------------------- 两张图（家具用平面坐标）
BASE = dict(
    file="base",
    title="三层平面图 · 原图纸 + 铅笔修改（上北下南）",
    subtitle="红色 = 铅笔划掉（取消），橙色 = 铅笔新增",
    pencil="show",
    zones=[], furniture=[], av=None,
    labels={"hall": "画室\n（原图纸用途）"},
)

PROPOSED = dict(
    file="proposed",
    title="规划 · 吧台 + 大桌办公 + Lounge",
    subtitle="进门即吧台（日咖夜酒）· 西翼南段 lounge 朝窗区 · 东半区大桌办公，背靠东窗，电视 + JBL 4329P 在面前",
    pencil="applied",
    zones=[
        dict(r=(200, 3800, 4800, 7000), label="吧台区 · 日咖夜酒", cls="z-bar", at=(3500, 4900)),
        dict(r=(600, 7600, 4200, 10600), label="", cls="z-rug"),
        dict(r=(5000, 5900, 9500, 10300), label="", cls="z-work"),
    ],
    furniture=[
        # 吧台：后吧台沿用现有水电，半岛吧台抵西墙，从东侧进吧台内
        dict(r=(250, 3800, 1650, 4400), label="后吧台\n咖啡机 · 水槽", cls="bar"),
        dict(r=(1650, 3800, 2250, 4400), label="半高\n饮料柜", cls="fridge"),
        dict(r=(200, 5400, 3300, 6350), label="半岛吧台 3.1 × 0.95 m（石材台面）", cls="counter"),
        dict(c=(650, 6750, 230), label="", cls="stool"),
        dict(c=(1400, 6750, 230), label="", cls="stool"),
        dict(c=(2150, 6750, 230), label="", cls="stool"),
        dict(c=(2900, 6750, 230), label="", cls="stool"),
        # Lounge：沙发背对吧台，面向南端窗区；两把单人椅分列两侧
        dict(r=(900, 7800, 3700, 8800), label="三人沙发", cls="sofa"),
        dict(r=(1600, 9150, 3000, 9900), label="茶几", cls="wood"),
        dict(r=(250, 9100, 1100, 9950), label="单人椅", cls="leather"),
        dict(r=(3500, 9100, 4350, 9950), label="单人椅", cls="leather"),
        dict(c=(500, 8100, 200), label="落地灯", cls="lamp"),
        dict(c=(4200, 8100, 200), label="", cls="lamp"),
        dict(r=(1100, 12600, 4400, 12950), label="窗下矮柜 / 黑胶", cls="wood"),
        dict(c=(4150, 11300, 380), label="大绿植", cls="plant"),
        dict(c=(1500, 11600, 300), label="", cls="plant"),
        # 工作区：大桌南北向，人背靠东窗面向西
        dict(r=(5100, 5317, 10000, 5717), label="整面开放书架（前室隔墙）", cls="wood"),
        dict(r=(7300, 6200, 8500, 9200), label="Massive 实木大桌\n3.0 × 1.2 m", cls="desk", rot=True),
        dict(r=(8700, 7400, 9300, 8000), label="椅", cls="dark"),
        dict(r=(9650, 6000, 10050, 9600), label="窗下矮柜（打印 / 文件）", cls="box", rot=True),
        dict(c=(9600, 10150, 350), label="", cls="plant"),
        # 阳台
        dict(c=(7400, 12500, 650), label="户外桌椅", cls="soft"),
        dict(c=(10800, 11400, 300), label="", cls="plant"),
        dict(c=(5600, 13800, 300), label="", cls="plant"),
    ],
    # 架高电视当显示器 + 一对 JBL 4329P（落地架），和桌边构成听音三角
    av=dict(tv=(6850, 7050, 7050, 8350), speakers=[(6780, 6300, 7130, 6650), (6780, 8750, 7130, 9100)],
            seat=(9000, 7700)),
    labels={"hall": ""},
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
  .desk{fill:#7a5236;stroke:#3e2614;stroke-width:1.5}
  .soft{fill:#e9d8c4;stroke:#8a7660;stroke-width:1}
  .sofa{fill:#c9b79c;stroke:#7d6a50;stroke-width:1.5}
  .dark{fill:#3b3b3b;stroke:#111;stroke-width:1}
  .leather{fill:#6b4429;stroke:#3b2414;stroke-width:1}
  .box{fill:#eadcc3;stroke:#8a7660;stroke-width:1}
  .lamp{fill:#fff3c4;stroke:#b89a2e;stroke-width:1}
  .plant{fill:#9cc59a;stroke:#4f7d4c;stroke-width:1}
  .bar{fill:#f5f5f5;stroke:#333;stroke-width:1.5}
  .fridge{fill:#dfe9ef;stroke:#333;stroke-width:1.5}
  .counter{fill:#d9d4cc;stroke:#4a4540;stroke-width:2}
  .stool{fill:#3b3b3b;stroke:#111;stroke-width:1}
  .cabinet{fill:#fff;stroke:#555;stroke-width:1}
  .ghost{fill:none;stroke:#8a8a8a;stroke-width:1;stroke-dasharray:3 3}
  .speaker{fill:#8a5a34;stroke:#2b1a0e;stroke-width:1.5}
  .tv{fill:#111;stroke:#000}
  .z-bar{fill:#c8a165;fill-opacity:.12;stroke:#c8a165;stroke-width:1;stroke-dasharray:4 3}
  .z-rug{fill:#8d96a0;fill-opacity:.18;stroke:#8d96a0;stroke-width:1;stroke-dasharray:4 3}
  .z-work{fill:#7a5236;fill-opacity:.07;stroke:#7a5236;stroke-width:1;stroke-dasharray:4 3}
  .sound{fill:none;stroke:#c0392b;stroke-width:1;stroke-dasharray:3 3}
  .pencil-add{fill:#e67e22;stroke:#e67e22}
  .pencil-add-line{fill:none;stroke:#e67e22;stroke-width:2.5}
  .pencil-del{fill:none;stroke:#d62d20;stroke-width:2;stroke-dasharray:5 3}
  .pencil-x{stroke:#d62d20;stroke-width:2}
  text{font-family:"PingFang SC","Noto Sans CJK SC","WenQuanYi Zen Hei","Microsoft YaHei",sans-serif;fill:#222}
  .lbl{font-size:11px;text-anchor:middle;dominant-baseline:central}
  .lbl-inv{fill:#fff}
  .room{font-size:13px;font-weight:700;fill:#555;text-anchor:middle;dominant-baseline:central;letter-spacing:1px}
  .zone-lbl{font-size:12px;font-weight:600;text-anchor:middle;dominant-baseline:central;fill:#5a4a35}
  .pencil-lbl{font-size:11px;font-weight:600;fill:#c0392b;text-anchor:middle;dominant-baseline:central}
  .title{font-size:20px;font-weight:700}
  .note{font-size:11px;fill:#666}
  .dim{stroke:#777;stroke-width:1;fill:none}
  .dim-txt{font-size:10px;fill:#555;text-anchor:middle;dominant-baseline:central}
"""

DARK_CLASSES = {"dark", "leather", "stool", "tv", "desk"}


# ---------------------------------------------------------------- 绘图工具（平面坐标）
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

    def polygon(self, pts, cls):
        s = " ".join(f"{self.px(x):.1f},{self.px(y):.1f}" for x, y in pts)
        self.add(f'<polygon class="{cls}" points="{s}"/>')

    def text(self, x, y, s, cls="lbl", rotate=False):
        cx, cy = self.px(x), self.px(y)
        rot_attr = f' transform="rotate(-90 {cx:.1f} {cy:.1f})"' if rotate else ""
        lines = s.split("\n")
        if len(lines) == 1:
            self.add(f'<text class="{cls}" x="{cx:.1f}" y="{cy:.1f}"{rot_attr}>{s}</text>')
            return
        first = -(len(lines) - 1) * 0.6
        spans = "".join(f'<tspan x="{cx:.1f}" dy="{first if i == 0 else 1.2}em">{t}</tspan>'
                        for i, t in enumerate(lines))
        self.add(f'<text class="{cls}" x="{cx:.1f}" y="{cy:.1f}"{rot_attr}>{spans}</text>')

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
        c.rect(*rot_rect(door["gap"]), "floor")
    for hinge, leaf, closed in door["leaves"]:
        (hx, hy), (ox, oy), (cx_, cy_) = rot(*hinge), rot(*leaf), rot(*closed)
        c.line(hx, hy, ox, oy, leaf_cls)
        r = ((ox - hx) ** 2 + (oy - hy) ** 2) ** 0.5
        sweep = 1 if (ox - hx) * (cy_ - hy) - (oy - hy) * (cx_ - hx) > 0 else 0
        c.add(f'<path class="{arc_cls}" d="M {c.px(ox):.1f} {c.px(oy):.1f} '
              f'A {c.px(r):.1f} {c.px(r):.1f} 0 0 {sweep} {c.px(cx_):.1f} {c.px(cy_):.1f}"/>')


def draw_shell(c, plan):
    # 室外
    c.rect(*rot_rect(DRAWING_PLATFORM), "platform")
    c.text(2400, 13800, "空调平台", "lbl")
    c.polygon([rot(x, y) for x, y in DRAWING_BALCONY_OUTLINE], "balcony")
    c.text(8600, 13300, f"L 形阳台（朝南）≈ {area(DRAWING_BALCONY):.0f} ㎡", "room")

    # 室内地面
    for r in DRAWING_HALL:
        c.rect(*rot_rect(r), "floor")
    for rects in DRAWING_ROOMS.values():
        for r in rects:
            c.rect(*rot_rect(r), "annex")
    for z in plan["zones"]:
        c.rect(*z["r"], z["cls"])

    # 楼梯踏步（图纸上两跑：一跑横向、一跑竖向）
    for y in range(6330, 8650, 280):
        c.line(*rot(12900, y), *rot(14200, y), "tread")
    for x in range(11000, 12760, 280):
        c.line(*rot(x, 8730), *rot(x, 9950), "tread")
    c.text(*rot(11880, 9340), "楼梯 ↓", "lbl")

    # 电梯
    lx0, ly0, lx1, ly1 = rot_rect(DRAWING_ROOMS["lift"][0])
    c.rect(lx0 + 300, ly0 + 250, lx1 - 300, ly1 - 250, "lift")
    c.cross(lx0 + 300, ly0 + 250, lx1 - 300, ly1 - 250, "lift")
    c.text((lx0 + lx1) / 2, (ly0 + ly1) / 2, "电梯", "room")

    # 卫生间洁具
    c.circle(*rot(11450, 900), 140, "fixture")
    c.rect(*rot_rect((11000, 1750, 12000, 2250)), "fixture")
    c.ellipse(*rot(11500, 2000), 170, 300, "fixture")
    c.rect(*rot_rect((12250, 280, 13050, 1050)), "fixture", rx=10)
    c.ellipse(*rot(13700, 900), 360, 260, "fixture")

    # 墙、柱、窗
    partition = DRAWING_PARTITION_ORIGINAL if plan["pencil"] == "show" else DRAWING_PARTITION_PENCIL
    for w in DRAWING_WALLS + partition:
        c.rect(*rot_rect(w), "wall")
    for col in DRAWING_COLUMNS:
        c.rect(*rot_rect(col), "column")
    for win in DRAWING_WINDOWS:
        c.rect(*rot_rect(win), "window")

    # 门
    for d in DRAWING_DOORS:
        draw_door(c, d)
    if plan["pencil"] == "show":
        draw_door(c, DRAWING_DOOR_ORIGINAL_LOBBY)
        draw_door(c, DRAWING_DOOR_PENCIL_NEW, "pencil-add-line", "pencil-add-line")
    else:
        draw_door(c, DRAWING_DOOR_PENCIL_NEW)

    # 固定柜
    for cab in (DRAWING_CABINET_KEEP, DRAWING_FIXED_CABINET):
        r = rot_rect(cab)
        c.rect(*r, "cabinet")
        c.cross(*r, "lift")
    if plan["pencil"] == "show":
        r = rot_rect(DRAWING_CABINET_REMOVED)
        c.rect(*r, "cabinet")
        c.cross(*r, "lift")
        c.rect(*rot_rect(DRAWING_WET_BAR), "cabinet")
        c.text(1450, 4025, "现有小水吧", "lbl")

    # 房间名
    c.text(1800, 1650, "卫生间", "room")
    c.text(2950, 2400, "过道", "lbl")
    c.text(4900, 1900, "储藏间", "room")
    c.text(5500, 4450, "前室", "room")
    c.text(7300, 5036, "玄关柜", "lbl")
    if plan["labels"]["hall"]:
        c.text(2500, 8500, plan["labels"]["hall"], "room")


def draw_pencil_marks(c):
    for w in DRAWING_PENCIL_ADDED_WALLS:
        c.rect(*rot_rect(w), "pencil-add")
    c.cross(8950, 4187, 9980, 5400, "pencil-x")
    r = rot_rect(DRAWING_CABINET_REMOVED)
    c.rect(*r, "pencil-del")
    c.cross(*r, "pencil-x")
    c.text(2700, 4600, "① 新增入户门", "pencil-lbl")
    c.line(3450, 4600, 4750, 4600, "pencil-add-line")
    c.text(5500, 6400, "② 隔墙延长", "pencil-lbl")
    c.line(5500, 6250, 5500, 5330, "pencil-add-line")
    c.text(9450, 6400, "③ 原门封掉", "pencil-lbl")
    c.line(9450, 6250, 9450, 5330, "pencil-add-line")
    c.text(7400, 7300, "④ 前室横柜取消", "pencil-lbl")
    c.line(7700, 7150, 8380, 4870, "pencil-add-line")


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
                ty = cy + r * 0.6 if r >= 500 else cy + r + 200
                c.text(cx, ty, f["label"])


def draw_av(c, av):
    if not av:
        return
    sx, sy = av["seat"]
    for x0, y0, x1, y1 in av["speakers"]:
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        c.line(mx, my, sx, sy, "sound")
        c.rect(x0, y0, x1, y1, "speaker", rx=2)
        c.rect(x0 - 50, y0 - 50, x1 + 50, y1 + 50, "ghost")
    c.rect(*av["tv"], "tv", rx=2)
    tx0, ty0, tx1, ty1 = av["tv"]
    c.text(tx0 - 750, (ty0 + ty1) / 2, '55" 架高电视\n（当显示器）')
    s0, s1 = av["speakers"]
    c.text(s0[0] - 650, (s0[1] + s0[3]) / 2, "JBL 4329P")
    c.text(s1[0] - 650, (s1[1] + s1[3]) / 2, "JBL 4329P")


def draw_zone_labels(c, plan):
    for z in plan["zones"]:
        if not z["label"]:
            continue
        x0, y0, x1, y1 = z["r"]
        tx, ty = z.get("at", ((x0 + x1) / 2, y1 - 250))
        c.text(tx, ty, z["label"], "zone-lbl")
    if plan["file"] == "proposed":
        c.text(2400, 10350, "Lounge · 地毯", "zone-lbl")
        c.text(6000, 9900, "工作区", "zone-lbl")
        c.text(2600, 12000, "窗区（绿植 · 阅读）", "zone-lbl")


def draw_dims(c):
    # 底边：图纸左侧链（100 / 4750 / 5450 / 1300）
    y = 15100
    xs = DIMS_X
    c.line(xs[0], y, xs[-1], y, "dim")
    for x in xs:
        c.line(x, y - 120, x, y + 120, "dim")
    for a, b in zip(xs, xs[1:]):
        if b - a > 300:
            c.text((a + b) / 2, y - 230, f"{b - a}", "dim-txt")
    # 右侧：图纸底边链（3400 / 200 / 5383 / 100 / 1617 / 3400），总长 14400
    x = 12400
    ys = [DRAWING_W - v for v in DIMS_Y]
    c.line(x, min(ys), x, max(ys), "dim")
    for yy in ys:
        c.line(x - 120, yy, x + 120, yy, "dim")
    for a, b in zip(ys, ys[1:]):
        c.text(x + 280, (a + b) / 2, f"{a - b}", "dim-txt", rotate=True)
    x2 = 13200
    c.line(x2, 0, x2, DRAWING_W, "dim")
    for yy in (0, DRAWING_W):
        c.line(x2 - 120, yy, x2 + 120, yy, "dim")
    c.text(x2 + 280, DRAWING_W / 2, "14400", "dim-txt", rotate=True)


def draw_header(c, plan):
    hall = area(DRAWING_HALL)
    c.add(f'<text class="title" x="{c.px(-1300):.1f}" y="{c.px(-2250):.1f}">{plan["title"]}</text>')
    c.add(f'<text class="note" x="{c.px(-1300):.1f}" y="{c.px(-1750):.1f}">{plan["subtitle"]}</text>')
    c.add(f'<text class="note" x="{c.px(-1300):.1f}" y="{c.px(-1350):.1f}">'
          f'尺寸按原图纸（mm）· 大厅净面积 ≈ {hall:.0f} ㎡ · 整层含卫生间 / 储藏 / 前室 / 电梯楼梯 ≈ 125 ㎡</text>')
    # 指北针
    nx, ny = c.px(13300), c.px(-1700)
    c.add(f'<g transform="translate({nx:.1f},{ny:.1f})"><path d="M0,-16 L7,10 L0,4 L-7,10 Z" fill="#333"/>'
          f'<text class="lbl" x="0" y="-26" style="font-weight:700">N</text></g>')


def render(plan):
    c = Canvas()
    draw_shell(c, plan)
    draw_furniture(c, plan["furniture"])
    draw_av(c, plan["av"])
    draw_zone_labels(c, plan)
    if plan["pencil"] == "show":
        draw_pencil_marks(c)
    draw_dims(c)
    draw_header(c, plan)
    return c.svg()


def main():
    for plan in (BASE, PROPOSED):
        path = OUT_DIR / f'{plan["file"]}.svg'
        path.write_text(render(plan), encoding="utf-8")
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
