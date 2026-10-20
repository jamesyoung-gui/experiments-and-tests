#!/usr/bin/env python3
"""
工厂楼上大平层（健身房 + 书房）floor plan，纯代码生成 SVG，无第三方依赖。

    python3 floor_plan.py            # 生成 current.svg 和 proposed.svg

坐标系：单位米，原点在大厅西南角。x 向东（向右），y 向北（向上）。
  - 西墙 x=0      ：两扇纱帘窗 + 原佛龛 / 书桌
  - 东墙 x=ROOM_W ：三扇竖长窗（百叶）
  - 北墙 y=ROOM_D ：整面落地窗 + 阳台门，外面是 20㎡ 阳台
  - 南墙 y=0      ：书架墙、入口、卫生间/储藏凹位、水吧（固定不动）

所有尺寸都是根据照片目测估算的，量完真实尺寸后改 ROOM_W / ROOM_D 和下面的
各个常量即可，家具会按坐标重新排。
"""

from pathlib import Path

# ---------------------------------------------------------------- 尺寸（米）
ROOM_W = 13.0          # 东西向长度
ROOM_D = 10.0          # 南北向进深   -> 130 ㎡
WALL = 0.24
BALCONY = dict(x=1.0, w=8.0, d=2.5)          # 8 x 2.5 = 20 ㎡
CEILING_BEAMS_X = [ROOM_W / 3, ROOM_W * 2 / 3]  # 井字格吊顶的梁（虚线）
CEILING_BEAMS_Y = [ROOM_D / 2]

SCALE = 56             # 1 米 = 56 px
MARGIN = 1.2           # 画布四周留白（米）
OUT_DIR = Path(__file__).resolve().parent

# ---------------------------------------------------------------- 固定建筑元素
# 洞口：(墙, 起点, 终点, 类型, 标注)；起终点是沿墙方向的坐标
OPENINGS = [
    ("W", 3.3, 4.5, "window", "纱帘窗"),
    ("W", 5.8, 7.0, "window", "纱帘窗"),
    ("E", 3.6, 4.4, "window", ""),
    ("E", 4.8, 5.6, "window", ""),
    ("E", 7.0, 7.8, "window", "竖长窗×3"),
    ("N", 0.8, 2.0, "glass", ""),
    ("N", 2.0, 3.6, "door2", "阳台门"),
    ("N", 3.6, 9.8, "glass", "落地窗（整面窗帘）"),
    ("N", 10.4, 11.4, "window", ""),
    ("S", 7.0, 7.9, "door", "入口*"),
    ("S", 8.4, 10.2, "open", ""),
]

# 南侧凹进去的附属空间（大厅外）
ANNEXES = [
    dict(x=8.4, y=-2.6, w=1.8, h=2.6, label="卫生间 /\n小储藏室*", cls="annex"),
    dict(x=6.4, y=-2.0, w=2.0, h=2.0, label="门厅/楼梯*", cls="annex"),
]

WET_BAR = dict(x=10.4, y=0.0, w=2.6, h=0.65, label="水吧（固定）")
TILE_ZONE = dict(x=10.2, y=0.0, w=2.8, h=2.4)   # 水吧前的瓷砖地面

# ---------------------------------------------------------------- 两套布局
# 家具：kind = rect | round
#   rect : x, y, w, h（左下角 + 宽高）
#   round: cx, cy, r
CURRENT = dict(
    title="现状 · Current layout（照片还原，2026-02）",
    zones=[],
    furniture=[
        dict(kind="rect", x=0.3, y=0.05, w=6.2, h=0.4, label="胡桃木书架 / 陶器架", cls="wood"),
        dict(kind="rect", x=0.05, y=4.75, w=0.45, h=0.9, label="佛龛", cls="wood"),
        dict(kind="rect", x=1.0, y=4.3, w=1.6, h=0.8, label="实木书桌", cls="wood"),
        dict(kind="rect", x=0.7, y=2.9, w=0.6, h=0.6, label="藤椅", cls="soft"),
        dict(kind="rect", x=2.2, y=2.6, w=1.2, h=0.7, label="藤编茶几", cls="wood"),
        dict(kind="round", cx=0.6, cy=6.3, r=0.25, label="落地灯", cls="lamp"),
        dict(kind="round", cx=1.0, cy=9.4, r=0.35, label="绿植", cls="plant"),
        dict(kind="round", cx=5.2, cy=6.6, r=1.1, label="圆地毯", cls="rug"),
        dict(kind="round", cx=4.9, cy=6.9, r=0.28, label="", cls="soft"),
        dict(kind="round", cx=5.7, cy=6.3, r=0.28, label="", cls="soft"),
        dict(kind="rect", x=3.6, y=5.0, w=0.75, h=0.75, label="黑色转椅", cls="dark"),
        dict(kind="rect", x=6.4, y=8.6, w=1.1, h=0.9, label="折叠椅(粉毯)", cls="soft"),
        dict(kind="round", cx=8.6, cy=8.1, r=0.4, label="斑马懒人包", cls="soft"),
        dict(kind="rect", x=9.9, y=9.15, w=1.7, h=0.65, label="杂物桌", cls="wood"),
        dict(kind="rect", x=11.8, y=9.2, w=1.0, h=0.6, label="纸箱", cls="box"),
        dict(kind="rect", x=12.25, y=8.0, w=0.6, h=1.1, label="衣架", cls="box"),
        dict(kind="rect", x=12.75, y=7.85, w=0.12, h=0.6, label="", cls="metal"),
        dict(kind="rect", x=12.45, y=6.0, w=0.5, h=1.0, label="矮柜", cls="box"),
        dict(kind="rect", x=12.0, y=5.0, w=0.8, h=1.4, label="SkiErg", cls="dark"),
        dict(kind="rect", x=9.8, y=3.0, w=2.5, h=0.6, label="划船机", cls="dark"),
        dict(kind="rect", x=9.6, y=4.6, w=2.0, h=1.0, label="训练垫", cls="mat"),
        dict(kind="rect", x=11.6, y=4.1, w=0.9, h=0.6, label="哑铃/药球", cls="dark"),
    ],
    tv=None,
)

PROPOSED = dict(
    title="规划 · Proposed（右动左静：东侧健身 / 西侧书房+影音）",
    zones=[
        dict(x=8.0, y=2.4, w=5.0, h=7.6, label="黑色橡胶地垫 2cm", cls="z-gym"),
        dict(x=1.2, y=3.2, w=6.2, h=6.0, label="灰色羊毛地毯", cls="z-rug"),
        dict(x=8.2, y=3.0, w=3.0, h=3.4, label="留白：脚步/增强式\n3m × 3.4m", cls="z-plyo"),
    ],
    furniture=[
        # 西侧：书墙 + 岛式书桌（背靠书墙，面向大厅和阳台）
        dict(kind="rect", x=0.05, y=0.3, w=0.4, h=2.8, label="书墙", cls="wood", rot=True),
        dict(kind="rect", x=0.05, y=4.6, w=0.4, h=1.1, label="书架", cls="wood", rot=True),
        dict(kind="rect", x=0.3, y=0.05, w=6.2, h=0.4, label="顶天立地开放书架（黑钢+实木）", cls="wood"),
        dict(kind="rect", x=2.0, y=4.6, w=0.8, h=1.6, label="升降桌\n1\"薄板", cls="metal"),
        dict(kind="rect", x=1.3, y=5.05, w=0.65, h=0.7, label="Aeron", cls="dark"),
        dict(kind="rect", x=2.15, y=3.6, w=0.5, h=0.5, label="台灯", cls="lamp"),
        # 影音：Maralunga 背靠阳台，移动电视架在中间转
        dict(kind="rect", x=3.6, y=8.0, w=2.3, h=1.0, label="Maralunga 沙发（黑皮）", cls="leather"),
        dict(kind="round", cx=6.35, cy=8.6, r=0.3, label="Arco", cls="lamp"),
        dict(kind="rect", x=5.95, y=7.3, w=0.65, h=0.55, label="低音炮", cls="dark"),
        dict(kind="rect", x=1.4, y=7.9, w=0.85, h=0.85, label="休闲椅", cls="leather"),
        dict(kind="round", cx=0.9, cy=9.3, r=0.35, label="绿植", cls="plant"),
        # 东侧：健身
        dict(kind="rect", x=11.3, y=4.1, w=1.65, h=2.2, label="不锈钢史密斯\n三合一", cls="steel"),
        dict(kind="rect", x=12.2, y=7.4, w=0.75, h=1.3, label="SkiErg", cls="dark"),
        dict(kind="rect", x=9.6, y=9.15, w=2.5, h=0.6, label="划船机（面向窗）", cls="dark"),
        dict(kind="rect", x=12.45, y=2.55, w=0.5, h=1.35, label="哑铃架", cls="steel", rot=True),
        dict(kind="rect", x=8.1, y=7.2, w=0.15, h=1.6, label="", cls="mirror"),
        dict(kind="rect", x=8.3, y=7.4, w=1.2, h=1.2, label="镜子(可移动)\n+ 机位", cls="ghost"),
        # 阳台
        dict(kind="round", cx=4.6, cy=11.3, r=0.5, label="户外桌椅", cls="soft"),
        dict(kind="round", cx=7.4, cy=11.9, r=0.3, label="植物", cls="plant"),
        dict(kind="round", cx=8.5, cy=11.9, r=0.3, label="植物", cls="plant"),
    ],
    # 移动电视架：办公位（朝书桌）和观影位（转向沙发）
    tv=dict(
        work=dict(x=4.0, y=4.75, w=0.35, h=1.3, label="LG C5 55\"\n+Soundbar"),
        movie=dict(x=4.1, y=6.35, w=1.3, h=0.35, label="观影位"),
    ),
    annex_override={"卫生间 /\n小储藏室*": "卫生间 /\n恢复室\n(按摩床/冥想)"},
)

# ---------------------------------------------------------------- 渲染
STYLE = """
  .bg{fill:#fbfaf7}
  .floor{fill:#efe6d6}
  .wall{fill:#2b2b2b}
  .annex{fill:#e4e1da;stroke:#2b2b2b;stroke-width:2}
  .balcony{fill:#e3ece4;stroke:#7a8b7c;stroke-width:2;stroke-dasharray:6 4}
  .tile{fill:#dcdcdc}
  .beam{stroke:#b9ad99;stroke-width:1.2;stroke-dasharray:8 6;fill:none}
  .window{fill:#bfe0f2;stroke:#2b6f96;stroke-width:1.5}
  .glass{fill:#d7edf8;stroke:#2b6f96;stroke-width:1.5}
  .door{fill:none;stroke:#555;stroke-width:1.2}
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
  .z-gym{fill:#3a3a3a;fill-opacity:.18;stroke:#3a3a3a;stroke-width:1;stroke-dasharray:4 3}
  .z-rug{fill:#8d96a0;fill-opacity:.16;stroke:#8d96a0;stroke-width:1;stroke-dasharray:4 3}
  .z-plyo{fill:#e07a2f;fill-opacity:.12;stroke:#e07a2f;stroke-width:1.5;stroke-dasharray:6 3}
  .tv{fill:#111;stroke:#000}
  .tv-ghost{fill:none;stroke:#111;stroke-width:1.2;stroke-dasharray:4 3}
  .arrow{fill:none;stroke:#c0392b;stroke-width:1.6}
  text{font-family:"PingFang SC","Noto Sans CJK SC","WenQuanYi Zen Hei","Microsoft YaHei",sans-serif;fill:#222}
  .lbl{font-size:11px;text-anchor:middle;dominant-baseline:central}
  .lbl-inv{fill:#fff}
  .zone-lbl{font-size:12px;font-weight:600;text-anchor:middle;fill:#444}
  .room-lbl{font-size:14px;font-weight:700;fill:#555;letter-spacing:2px}
  .title{font-size:20px;font-weight:700}
  .note{font-size:11px;fill:#666}
  .dim{stroke:#777;stroke-width:1;fill:none}
  .dim-txt{font-size:11px;fill:#555;text-anchor:middle}
"""

DARK_CLASSES = {"dark", "leather", "mat", "tv"}


class Canvas:
    def __init__(self):
        self.x0 = -MARGIN
        self.y_top = ROOM_D + BALCONY["d"] + MARGIN + 0.6
        self.w = ROOM_W + 2 * MARGIN + 0.8
        self.h = self.y_top - (-2.6 - MARGIN - 1.4)
        self.parts = []

    # 米 -> 像素
    def px(self, x):
        return (x - self.x0) * SCALE

    def py(self, y):
        return (self.y_top - y) * SCALE

    def add(self, s):
        self.parts.append(s)

    def rect(self, x, y, w, h, cls, rx=0):
        self.add(f'<rect class="{cls}" x="{self.px(x):.1f}" y="{self.py(y + h):.1f}" '
                 f'width="{w * SCALE:.1f}" height="{h * SCALE:.1f}" rx="{rx}"/>')

    def circle(self, cx, cy, r, cls):
        self.add(f'<circle class="{cls}" cx="{self.px(cx):.1f}" cy="{self.py(cy):.1f}" r="{r * SCALE:.1f}"/>')

    def line(self, x1, y1, x2, y2, cls):
        self.add(f'<line class="{cls}" x1="{self.px(x1):.1f}" y1="{self.py(y1):.1f}" '
                 f'x2="{self.px(x2):.1f}" y2="{self.py(y2):.1f}"/>')

    def text(self, x, y, s, cls="lbl", rotate=False):
        lines = s.split("\n")
        cx, cy = self.px(x), self.py(y)
        rot = f' transform="rotate(-90 {cx:.1f} {cy:.1f})"' if rotate else ""
        if len(lines) == 1:
            self.add(f'<text class="{cls}" x="{cx:.1f}" y="{cy:.1f}"{rot}>{s}</text>')
            return
        first = -(len(lines) - 1) * 0.6
        spans = "".join(f'<tspan x="{cx:.1f}" dy="{first if i == 0 else 1.2}em">{t}</tspan>'
                        for i, t in enumerate(lines))
        self.add(f'<text class="{cls}" x="{cx:.1f}" y="{cy:.1f}"{rot}>{spans}</text>')

    def svg(self):
        W, H = self.w * SCALE, self.h * SCALE
        body = "\n  ".join(self.parts)
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.0f} {H:.0f}" '
                f'width="{W:.0f}" height="{H:.0f}">\n<style>{STYLE}</style>\n'
                f'<rect class="bg" width="100%" height="100%"/>\n  {body}\n</svg>\n')


def draw_shell(c, plan):
    # 阳台
    b = BALCONY
    c.rect(b["x"], ROOM_D, b["w"], b["d"], "balcony")
    c.text(b["x"] + b["w"] / 2, ROOM_D + b["d"] - 0.35, f'阳台 ≈ {b["w"] * b["d"]:.0f} ㎡', "room-lbl")

    # 南侧附属空间
    override = plan.get("annex_override", {})
    for a in ANNEXES:
        c.rect(a["x"], a["y"], a["w"], a["h"], a["cls"])
        c.text(a["x"] + a["w"] / 2, a["y"] + a["h"] / 2, override.get(a["label"], a["label"]))

    # 地面 + 吊顶梁
    c.rect(0, 0, ROOM_W, ROOM_D, "floor")
    t = TILE_ZONE
    c.rect(t["x"], t["y"], t["w"], t["h"], "tile")
    for z in plan["zones"]:
        c.rect(z["x"], z["y"], z["w"], z["h"], z["cls"])
    for bx in CEILING_BEAMS_X:
        c.line(bx, 0, bx, ROOM_D, "beam")
    for by in CEILING_BEAMS_Y:
        c.line(0, by, ROOM_W, by, "beam")

    # 墙
    c.rect(-WALL, -WALL, ROOM_W + 2 * WALL, WALL, "wall")
    c.rect(-WALL, ROOM_D, ROOM_W + 2 * WALL, WALL, "wall")
    c.rect(-WALL, 0, WALL, ROOM_D, "wall")
    c.rect(ROOM_W, 0, WALL, ROOM_D, "wall")

    # 洞口
    for wall, a, b2, kind, label in OPENINGS:
        draw_opening(c, wall, a, b2, kind, label)

    # 水吧
    c.rect(**{k: WET_BAR[k] for k in "xywh"}, cls="bar")
    c.text(WET_BAR["x"] + 1.0, WET_BAR["y"] + WET_BAR["h"] / 2, WET_BAR["label"])
    c.circle(WET_BAR["x"] + 2.0, 0.33, 0.14, "window")  # 水槽


def draw_opening(c, wall, a, b, kind, label):
    if wall in "NS":
        y = ROOM_D if wall == "N" else -WALL
        c.rect(a, y, b - a, WALL, "bg")
        if kind in ("window", "glass"):
            c.rect(a, y + WALL * 0.3, b - a, WALL * 0.4, kind)
        elif kind == "door":
            # 单开门，门扇开向室内
            hinge_y = 0 if wall == "S" else ROOM_D
            sgn = 1 if wall == "S" else -1
            r = b - a
            c.line(a, hinge_y, a, hinge_y + sgn * r, "door")
            c.add(f'<path class="door" d="M {c.px(a):.1f} {c.py(hinge_y + sgn * r):.1f} '
                  f'A {r * SCALE:.1f} {r * SCALE:.1f} 0 0 {1 if wall == "S" else 0} '
                  f'{c.px(b):.1f} {c.py(hinge_y):.1f}"/>')
        elif kind == "door2":
            # 对开门
            half = (b - a) / 2
            for hinge, end, sweep in ((a, a + half, 0), (b, b - half, 1)):
                c.line(hinge, ROOM_D, hinge, ROOM_D - half, "door")
                c.add(f'<path class="door" d="M {c.px(hinge):.1f} {c.py(ROOM_D - half):.1f} '
                      f'A {half * SCALE:.1f} {half * SCALE:.1f} 0 0 {sweep} '
                      f'{c.px(end):.1f} {c.py(ROOM_D):.1f}"/>')
        if label:
            ly = ROOM_D + WALL + 0.25 if wall == "N" else -WALL - 0.3
            if wall == "N" and BALCONY["x"] <= (a + b) / 2 <= BALCONY["x"] + BALCONY["w"]:
                ly = ROOM_D + WALL + 0.3
            c.text((a + b) / 2, ly, label, "note" if kind != "door" else "lbl")
    else:
        x = -WALL if wall == "W" else ROOM_W
        c.rect(x, a, WALL, b - a, "bg")
        c.rect(x + WALL * 0.3, a, WALL * 0.4, b - a, kind)
        if label:
            lx = -WALL - 0.55 if wall == "W" else ROOM_W + WALL + 0.55
            c.text(lx, (a + b) / 2, label, "note", rotate=True)


def draw_furniture(c, items):
    for f in items:
        cls = f["cls"]
        lbl_cls = "lbl lbl-inv" if cls in DARK_CLASSES else "lbl"
        if f["kind"] == "rect":
            c.rect(f["x"], f["y"], f["w"], f["h"], cls, rx=3)
            cx, cy = f["x"] + f["w"] / 2, f["y"] + f["h"] / 2
            if f.get("label"):
                c.text(cx, cy, f["label"], lbl_cls, rotate=f.get("rot", False))
        else:
            c.circle(f["cx"], f["cy"], f["r"], cls)
            if f.get("label"):
                below = f["r"] < 0.45 and cls not in ("rug",)
                ty = f["cy"] - f["r"] - 0.2 if below else f["cy"] - f["r"] * 0.55
                c.text(f["cx"], ty, f["label"], "lbl")


def draw_tv(c, tv):
    if not tv:
        return
    w, m = tv["work"], tv["movie"]
    c.rect(w["x"], w["y"], w["w"], w["h"], "tv", rx=2)
    c.text(w["x"] + w["w"] + 0.55, w["y"] + w["h"] / 2, w["label"])
    c.rect(m["x"], m["y"], m["w"], m["h"], "tv-ghost", rx=2)
    c.text(m["x"] + m["w"] / 2, m["y"] + m["h"] + 0.22, m["label"], "lbl")
    # 转向箭头：办公位 -> 观影位
    sx, sy = c.px(w["x"] + w["w"] / 2), c.py(w["y"] + w["h"])
    ex, ey = c.px(m["x"] + 0.2), c.py(m["y"])
    c.add(f'<path class="arrow" d="M {sx:.1f} {sy:.1f} Q {sx:.1f} {ey:.1f} {ex:.1f} {ey:.1f}" '
          f'marker-end="url(#arrow)"/>')


def draw_zone_labels(c, plan):
    for z in plan["zones"]:
        if z["cls"] == "z-plyo":
            c.text(z["x"] + z["w"] / 2, z["y"] + z["h"] / 2, z["label"], "zone-lbl")
        else:
            c.text(z["x"] + z["w"] / 2, z["y"] + 0.25, z["label"], "zone-lbl")


def draw_dims(c):
    y = -2.6 - 0.7
    c.line(0, y, ROOM_W, y, "dim")
    for x in (0, ROOM_W):
        c.line(x, y - 0.15, x, y + 0.15, "dim")
    c.text(ROOM_W / 2, y - 0.3, f"≈ {ROOM_W:.1f} m", "dim-txt")
    x = ROOM_W + WALL + 1.0
    c.line(x, 0, x, ROOM_D, "dim")
    for yy in (0, ROOM_D):
        c.line(x - 0.15, yy, x + 0.15, yy, "dim")
    c.text(x + 0.3, ROOM_D / 2, f"≈ {ROOM_D:.1f} m", "dim-txt", rotate=True)


def draw_header_footer(c, plan):
    c.add(f'<text class="title" x="{c.px(-MARGIN + 0.3):.1f}" y="{c.py(c.y_top - 0.5):.1f}">{plan["title"]}</text>')
    area = ROOM_W * ROOM_D
    c.add(f'<text class="note" x="{c.px(-MARGIN + 0.3):.1f}" y="{c.py(c.y_top - 0.9):.1f}">'
          f'大厅 ≈ {area:.0f} ㎡ · 层高约 3.5 m · 虚线 = 井字格吊顶梁 · 灰色 = 水吧前瓷砖区</text>')
    # 指北针
    nx, ny = c.px(ROOM_W + MARGIN - 0.5), c.py(c.y_top - 0.7)
    c.add(f'<g transform="translate({nx:.1f},{ny:.1f})"><path d="M0,-16 L7,10 L0,4 L-7,10 Z" fill="#333"/>'
          f'<text class="lbl" x="0" y="-24">阳台侧</text></g>')
    foot = c.py(-2.6 - MARGIN - 1.1)
    c.add(f'<text class="note" x="{c.px(-MARGIN + 0.3):.1f}" y="{foot:.1f}">'
          f'* 入口 / 卫生间 / 储藏室位置由照片推断，尺寸为目测估算，请用实测值修改 floor_plan.py 顶部常量。</text>')


def render(plan):
    c = Canvas()
    c.add('<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" '
          'orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#c0392b"/></marker></defs>')
    draw_shell(c, plan)
    draw_furniture(c, plan["furniture"])
    draw_tv(c, plan["tv"])
    draw_zone_labels(c, plan)
    draw_dims(c)
    draw_header_footer(c, plan)
    return c.svg()


def main():
    for name, plan in (("current", CURRENT), ("proposed", PROPOSED)):
        path = OUT_DIR / f"{name}.svg"
        path.write_text(render(plan), encoding="utf-8")
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
