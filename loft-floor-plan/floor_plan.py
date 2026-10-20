#!/usr/bin/env python3
"""
三层平面图（小洋楼 3F：吧台 + 工作 + lounge）——纯代码生成 SVG，无第三方依赖。

    python3 floor_plan.py     # 生成 base.svg / plan_a.svg / plan_b.svg / bar_options.svg

建筑几何按原施工图纸《三层平面图》数字化（DRAWING_* 常量，图纸坐标），
并带上图纸上的铅笔修改：
  - 前室西侧隔墙延长，北端（现为西端）新开入户门
  - 原来靠外墙的前室门封掉
  - 前室里那组横向柜子取消

图纸是横着画的。出图时统一逆时针转 90°，变成上北下南左西右东：
  - 南：L 形大阳台 + 阳台对开门
  - 西：五扇窄窗（北三南二）
  - 东：四扇窄窗，两两一组（原佛龛在两组之间）
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
# 窄窗（图纸上墙体里画三道线的那几段，约 0.6 m 宽，窗间是实墙）
DRAWING_WINDOWS = [
    (3900, 40, 4500, 160), (5090, 40, 5660, 160),            # 西墙南段两扇
    (7240, 40, 7830, 160), (8435, 40, 9020, 160), (9630, 40, 10220, 160),  # 西墙北段三扇（照片里拉百叶的）
    (1180, 1130, 1320, 1690), (1180, 2340, 1320, 2910), (1180, 3490, 1320, 4060),  # 西翼南端三扇
    (4740, 10140, 5330, 10260), (5530, 10140, 6125, 10260),  # 东墙两扇（原佛龛南侧）
    (7300, 10140, 7890, 10260), (8090, 10140, 8685, 10260),  # 东墙两扇（原佛龛北侧）
]
# 朝阳台的落地玻璃（阳台对开门两侧）
DRAWING_GLASS = [(3540, 4950, 3660, 6850), (3540, 8300, 3660, 9900)]
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

# ---------------------------------------------------------------- 方案（家具用平面坐标）
BASE = dict(
    file="base",
    title="三层平面图 · 原图纸 + 铅笔修改（上北下南）",
    subtitle="红色 = 铅笔划掉（取消），橙色 = 铅笔新增",
    pencil="show",
    zones=[], furniture=[], av=None, notes=[],
    labels={"hall": "画室\n（原图纸用途）"},
)

# 三种吧台做法，都以现有水吧的上下水为起点（北墙 = 卫生间南墙，Y 3800；西墙内皮 X 200）。
# 北墙 X 2300–3530 是去卫生间 / 储藏间的过道口，必须留空。
BAR_WALL_L = [   # ① 靠墙大 L：北墙咖啡区 + 西墙调酒区，台面约 5 m，不要岛台和吧凳
    dict(r=(200, 3800, 2250, 4450), label="咖啡机 · 磨豆机 · 水槽", cls="bar"),
    dict(r=(200, 4450, 850, 5150), label="制冰机", cls="bar", rot=True),
    dict(r=(200, 5150, 850, 5800), label="饮料柜", cls="fridge", rot=True),
    dict(r=(200, 5800, 850, 7600), label="调酒台 · 上方酒架", cls="bar", rot=True),
    # 两人小圆桌放在调酒台南侧，台前留 ≥ 0.95 m 操作空间
    dict(c=(2200, 7400, 400), label="", cls="wood"),
    dict(c=(2200, 6770, 230), label="", cls="soft"),
    dict(c=(2200, 8030, 230), label="", cls="soft"),
]

# 玄关：整栋楼是自家的，前室当“自家电梯厅”，门内玄关重点是回家的仪式感和顺手收纳。
# 北墙一组：壁挂换鞋凳 + 镜子 + 钥匙托；正对门一组单面高柜（挂衣 + 鞋），背面木饰面朝吧台。
ENTRY = [
    dict(r=(3700, 3800, 4600, 4200), label="壁挂凳 · 镜子", cls="soft"),
    dict(r=(2900, 4850, 3500, 6050), label="挂衣 · 鞋柜", cls="wood", rot=True),
]
ENTRY_NOTES = [
    (4150, 4650, "玄关", "zone-lbl"),
    (4150, 4950, "落尘区", "lbl"),
    (2600, 5450, "背面木饰面", "lbl"),
    (5500, 4750, "（电梯厅）", "lbl"),
]
# 前室当自家电梯厅：楼梯口换地面材质当分界；玄关柜改 250 深悬空矮柜，上方挂画配壁灯（出电梯正对）；
# 电梯 3F 刷卡；入户门 1.4 m 门扇扫过的范围什么都不放，加闭门器和地吸。
LOBBY = [
    dict(l=(8650, 3620, 8650, 5200), cls="boundary"),
    dict(r=(6130, 4967, 8490, 5217), label="悬空矮柜", cls="art"),
]
LOBBY_ZONES = [dict(r=(4800, 3600, 8650, 5217), label="", cls="z-lobby")]
LOBBY_NOTES = [
    (7300, 4350, "悬空矮柜 250 深\n上方挂画 + 壁灯", "lbl"),
    (9400, 4450, "楼梯口\n地面换材质", "lbl"),
    (7400, 2950, "（3F 刷卡）", "lbl"),
]
BAR_L_COUNTER = [  # ② 后吧台 + L 形前台：人在里面做，客人在外面坐，最有酒吧感
    dict(r=(200, 3800, 1650, 4400), label="咖啡机 · 水槽", cls="bar"),
    dict(r=(1650, 3800, 2250, 4400), label="饮料柜", cls="fridge"),
    dict(r=(200, 5400, 3000, 6050), label="L 形吧台（石材）", cls="counter"),
    dict(r=(2350, 4900, 3000, 5400), label="", cls="counter"),
    dict(c=(650, 6400, 230), label="", cls="stool"),
    dict(c=(1350, 6400, 230), label="", cls="stool"),
    dict(c=(2050, 6400, 230), label="", cls="stool"),
    dict(c=(3350, 5150, 230), label="", cls="stool"),
    dict(c=(3350, 5800, 230), label="", cls="stool"),
]
BAR_PARALLEL = [   # ③ 平行式：后台 L 靠墙，前台平行西墙，客人面朝调酒的人和西窗
    dict(r=(200, 3800, 2250, 4400), label="咖啡机 · 水槽", cls="bar"),
    dict(r=(200, 4400, 800, 5000), label="制冰", cls="bar", rot=True),
    dict(r=(200, 5000, 800, 5600), label="饮料柜", cls="fridge", rot=True),
    dict(r=(200, 5600, 800, 7000), label="酒架 · 调酒", cls="bar", rot=True),
    dict(r=(1700, 4900, 2400, 7200), label="前台（石材）", cls="counter", rot=True),
    dict(c=(2750, 5350, 230), label="", cls="stool"),
    dict(c=(2750, 6050, 230), label="", cls="stool"),
    dict(c=(2750, 6750, 230), label="", cls="stool"),
    dict(c=(2050, 7550, 230), label="", cls="stool"),
]

DESK_STUDIO_EAST = [   # 东半区工作室：人背靠东窗面向西，电视在前，屏幕后面是开敞空间不逆光
    dict(r=(5100, 5317, 10000, 5717), label="整面开放书架（前室隔墙）", cls="wood"),
    dict(r=(7300, 6200, 8500, 9200), label="Massive 实木大桌\n3.0 × 1.2 m", cls="desk", rot=True),
    dict(r=(8700, 7400, 9300, 8000), label="椅", cls="dark"),
    dict(r=(9650, 6000, 10050, 9600), label="窗下矮柜", cls="box", rot=True),
    dict(c=(9600, 10150, 350), label="", cls="plant"),
]
BALCONY_SET = [
    dict(c=(6500, 12300, 650), label="户外桌椅（早咖啡）", cls="soft"),
    dict(r=(8800, 11500, 9500, 13400), label="躺椅", cls="soft", rot=True),
    dict(r=(9800, 11500, 10500, 13400), label="躺椅", cls="soft", rot=True),
    dict(c=(10900, 11300, 200), label="", cls="lamp"),
    dict(c=(10900, 13700, 300), label="", cls="plant"),
]

LIVING_A = [   # 大 L 沙发：长边 3.2 m 面朝东墙电视，短边靠前室墙面朝阳台；背后一张背几 + 台灯
    dict(r=(6000, 5500, 7000, 8700), label="大 L 形沙发", cls="sofa", rot=True),
    dict(r=(7000, 5500, 8200, 6500), label="", cls="sofa"),
    dict(r=(5650, 5800, 5950, 8400), label="背几", cls="wood", rot=True),
    dict(c=(5800, 8650, 180), label="", cls="lamp"),
    dict(r=(7400, 7000, 8600, 8400), label="茶几", cls="wood"),
    # 东墙 2.5 m 深色电视背景板，封住中间两扇窄窗，电视对准东窗对称轴
    dict(r=(9800, 6450, 9900, 8950), label="", cls="panel"),
]
READING_A = [   # 单人椅挪到西翼中段，靠书架北面和西窗，做读书 / 喝咖啡角
    dict(r=(400, 8300, 1250, 9100), label="单人椅", cls="leather"),
    dict(c=(1500, 8500, 200), label="", cls="wood"),
    dict(c=(500, 8050, 180), label="", cls="lamp"),
    dict(c=(4450, 8800, 420), label="", cls="plant"),
]
WORK_A = [   # 书架单面朝北（对着读书角），和书桌对齐；书桌北移，两头都能进
    dict(r=(900, 9300, 3900, 9650), label="书架（单面朝北）", cls="wood"),
    dict(r=(900, 9750, 3900, 10950), label="", cls="desk"),
    dict(r=(1700, 9850, 3100, 9950), label="", cls="tv"),
    dict(r=(2100, 11100, 2700, 11650), label="椅", cls="dark"),
    dict(r=(1100, 12600, 4000, 12950), label="窗下矮柜", cls="wood"),
    dict(c=(4350, 12300, 300), label="", cls="plant"),
]

PLAN_A = dict(
    file="plan_a",
    title="方案 A · 电梯厅 → 玄关 → 靠墙大 L 吧台 · 东半区客厅 · 西翼读书角 + deep work",
    subtitle="前室当自家电梯厅；门内玄关（壁挂凳 + 挂衣鞋柜）；吧台靠墙大 L；大 L 沙发对电视背景板；单人椅做读书角；书桌在最里面",
    pencil="applied",
    zones=[
        dict(r=(200, 3800, 4800, 8300), label="", cls="z-bar"),
        dict(r=(3500, 3800, 4800, 5300), label="", cls="z-foyer"),
    ] + LOBBY_ZONES + [
        dict(r=(5500, 5400, 9300, 9500), label="", cls="z-rug"),
        dict(r=(500, 9200, 4500, 12500), label="", cls="z-work"),
    ],
    furniture=BAR_WALL_L + ENTRY + LOBBY + LIVING_A + READING_A + WORK_A + BALCONY_SET,
    av=dict(tv=(9700, 6830, 9800, 8550), tv_label=(9050, 7690), tv_text='77" 电视\n（背景板）',
            speakers=[(9400, 5835, 9750, 6185), (9400, 9190, 9750, 9540)],
            speaker_labels=[(9575, 5600), (9575, 9800)], listeners=[(6500, 7690)]),
    notes=ENTRY_NOTES + LOBBY_NOTES + [
        (1600, 4800, "吧台 · 靠墙大 L", "zone-lbl"),
        (2200, 7400, "小圆桌", "lbl"),
        (8300, 9200, "客厅 · 看片 / 听歌", "zone-lbl"),
        (2350, 8800, "读书角", "lbl"),
        (4450, 8800, "大绿植", "lbl"),
        (2400, 11900, "Deep work", "zone-lbl"),
        (2400, 10150, "显示器 32\"", "lbl lbl-inv"),
        (2400, 10550, "Massive 实木大桌 3.0 × 1.2 m", "lbl lbl-inv"),
        (2600, 12350, "南窗装调光卷帘", "note-c"),
    ],
    labels={"hall": ""},
)

PLAN_B = dict(
    file="plan_b",
    title="方案 B · 电视墙隔开吧台和 lounge，东半区做工作室",
    subtitle="西翼一条：吧台 → 电视墙（背面可做酒架）→ lounge；东半区阳台光最好，留给白天的 deep work",
    pencil="applied",
    zones=[
        dict(r=(200, 3800, 4800, 7000), label="", cls="z-bar"),
        dict(r=(500, 8600, 4500, 11900), label="", cls="z-rug"),
        dict(r=(5000, 5900, 9500, 10300), label="", cls="z-work"),
    ],
    furniture=BAR_L_COUNTER + [
        dict(r=(200, 7600, 3700, 7850), label="", cls="wall-new"),
        dict(r=(800, 10700, 3400, 11700), label="三人沙发", cls="sofa"),
        dict(r=(1400, 9700, 2800, 10350), label="茶几", cls="wood"),
        dict(r=(250, 9700, 1000, 10550), label="单人椅", cls="leather", rot=True),
        dict(r=(3550, 9700, 4400, 10550), label="单人椅", cls="leather"),
        dict(c=(3750, 11300, 200), label="", cls="lamp"),
        dict(r=(1100, 12600, 4000, 12950), label="窗下矮柜", cls="wood"),
        dict(c=(4350, 12300, 300), label="", cls="plant"),
        # 工作室
        dict(r=(5100, 5317, 10000, 5717), label="整面开放书架（前室隔墙）", cls="wood"),
        dict(r=(7300, 6200, 8500, 9200), label="Massive 实木大桌\n3.0 × 1.2 m", cls="desk", rot=True),
        dict(r=(7400, 7100, 7500, 8300), label="", cls="tv"),
        dict(r=(8700, 7400, 9300, 8000), label="椅", cls="dark"),
        dict(c=(9600, 10150, 350), label="", cls="plant"),
        dict(c=(5400, 6300, 330), label="", cls="plant"),
    ] + BALCONY_SET,
    av=dict(tv=(1200, 7850, 2920, 7950), tv_label=(2060, 8300), tv_text='77" 电视（挂电视墙）',
            speakers=[(550, 8000, 900, 8350), (3250, 8000, 3600, 8350)], speaker_text="4329P",
            speaker_labels=[(725, 8600), (3425, 8600)], listeners=[(2100, 11200)]),
    notes=[
        (3700, 4650, "吧台 ②", "zone-lbl"),
        (1950, 7350, "电视墙（背面做酒架）", "lbl"),
        (2400, 12250, "Lounge · 看片 / 听歌", "zone-lbl"),
        (6000, 9900, "工作室", "zone-lbl"),
        (6650, 7700, "显示器 32\"", "lbl"),
    ],
    labels={"hall": ""},
)

BAR_SHEET = dict(
    file="bar_options",
    title="吧台三种做法（都从现有水吧的上下水长出来，北墙过道口留空）",
    view=(-300, 3200, 5500, 4700),
    panels=[
        ("① 靠墙大 L（推荐）", "台面约 5 m，不要岛台和吧凳；空出来的地方放一张可选小圆桌", BAR_WALL_L),
        ("② 后吧台 + L 形前台", "人在里面做，客人坐外面，最有酒吧感；5 座", BAR_L_COUNTER),
        ("③ 平行式", "客人面朝调酒的人和西侧窄窗；后台最长，4 座", BAR_PARALLEL),
    ],
)

DOOR_EYE = (4750, 4500)   # 站在门口往里看
ENTRY_SHEET = dict(
    file="entry_detail",
    title="入口：电梯厅 → 入户门 → 玄关（整栋楼自家用，重点是回家的仪式感）",
    view=(1200, 2300, 9200, 4300),
    panel_w=640,
    panels=[
        ("现在：开门见吧台", "门一开直接看穿吧台和整个西翼；进门没地方换鞋、挂外套、放钥匙",
         BAR_WALL_L + LIVING_A + [dict(l=(*DOOR_EYE, x, y), cls="sight") for x, y in
                                  ((1300, 3900), (1300, 5600), (1300, 7300), (3000, 7500))],
         [(5500, 4750, "（前室）", "lbl")]),
        ("改后：楼梯口分界 → 电梯厅 → 门内玄关", "出电梯正对挂画和壁灯；门内北墙壁挂凳 + 镜子，正对一组挂衣鞋柜挡住视线，再转进吧台和客厅",
         BAR_WALL_L + ENTRY + LOBBY + LIVING_A + [dict(l=(*DOOR_EYE, x, y), cls="sight") for x, y in
                                                  ((3500, 5000), (3500, 5900), (2500, 3900))],
         ENTRY_NOTES + LOBBY_NOTES, [dict(r=(3500, 3800, 4800, 5300), label="", cls="z-foyer")] + LOBBY_ZONES),
    ],
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
  .window{fill:#cfe8f6;stroke:#2b6f96;stroke-width:1.5}
  .glass{fill:#a9d6ef;stroke:#2b6f96;stroke-width:1}
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
  .wall-new{fill:#4a4a4a;stroke:#222;stroke-width:1}
  .z-foyer{fill:#b9b2a6;fill-opacity:.45;stroke:#8a8277;stroke-width:1;stroke-dasharray:3 2}
  .boundary{stroke:#8a5a34;stroke-width:3;stroke-dasharray:8 4}
  .art{fill:#f1e4cc;stroke:#8a5a34;stroke-width:1.5}
  .z-lobby{fill:#c8a165;fill-opacity:.10;stroke:none}
  .sight{stroke:#c0392b;stroke-width:1.5;stroke-dasharray:5 4}
  .mirror{fill:#e8f4fa;stroke:#59606a;stroke-width:1}
  .panel{fill:#3a3530;stroke:#1f1b18;stroke-width:1}
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
  .panel-title{font-size:15px;font-weight:700}
  .note-c{font-size:11px;fill:#888;text-anchor:middle;dominant-baseline:central}
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
    c.text(7300, 13950, f"L 形阳台（朝南）≈ {area(DRAWING_BALCONY):.0f} ㎡", "room")

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
    for g in DRAWING_GLASS:
        c.rect(*rot_rect(g), "glass")
        x0, y0, x1, y1 = rot_rect(g)
        c.text((x0 + x1) / 2, y1 + 250, "落地玻璃", "note-c")

    # 门
    for d in DRAWING_DOORS:
        draw_door(c, d)
    if plan["pencil"] == "show":
        draw_door(c, DRAWING_DOOR_ORIGINAL_LOBBY)
        draw_door(c, DRAWING_DOOR_PENCIL_NEW, "pencil-add-line", "pencil-add-line")
    else:
        draw_door(c, DRAWING_DOOR_PENCIL_NEW)

    # 固定柜
    # 方案里重做了前室柜子（悬空矮柜）时，就不再画原图纸那组玄关柜
    redone = any(f.get("cls") == "art" for f in plan["furniture"])
    for cab in (DRAWING_FIXED_CABINET,) if redone else (DRAWING_CABINET_KEEP, DRAWING_FIXED_CABINET):
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
    if not redone:
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
        if "l" in f:
            c.line(*f["l"], cls)
            continue
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
    for sx, sy in av["listeners"]:
        for x0, y0, x1, y1 in av["speakers"]:
            c.line((x0 + x1) / 2, (y0 + y1) / 2, sx, sy, "sound")
    for (x0, y0, x1, y1), (lx, ly) in zip(av["speakers"], av["speaker_labels"]):
        c.rect(x0, y0, x1, y1, "speaker", rx=2)
        c.rect(x0 - 50, y0 - 50, x1 + 50, y1 + 50, "ghost")
        c.text(lx, ly, av.get("speaker_text", "JBL 4329P"))
    c.rect(*av["tv"], "tv", rx=2)
    c.text(*av["tv_label"], av.get("tv_text", '55" 架高电视\n（当显示器）'), "lbl")


def draw_zone_labels(c, plan):
    for z in plan["zones"]:
        if not z["label"]:
            continue
        x0, y0, x1, y1 = z["r"]
        tx, ty = z.get("at", ((x0 + x1) / 2, y1 - 250))
        c.text(tx, ty, z["label"], "zone-lbl")
    for x, y, text, cls in plan.get("notes", []):
        c.text(x, y, text, cls)


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


def render_body(c, plan):
    draw_shell(c, plan)
    draw_furniture(c, plan["furniture"])
    draw_av(c, plan["av"])
    draw_zone_labels(c, plan)
    if plan["pencil"] == "show":
        draw_pencil_marks(c)


def render(plan):
    c = Canvas()
    render_body(c, plan)
    draw_dims(c)
    draw_header(c, plan)
    return c.svg()


def render_sheet(sheet):
    """几个局部方案并排放大，每个面板是一个嵌套 <svg>，viewBox 自动裁切。"""
    vx, vy, vw, vh = (v * SCALE for v in sheet["view"])
    panels = sheet["panels"]
    panel_w, gap, top = sheet.get("panel_w", 520), 30, 110
    panel_h = panel_w * vh / vw
    total_w = len(panels) * panel_w + (len(panels) + 1) * gap
    total_h = top + panel_h + 30
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total_w:.0f} {total_h:.0f}" '
           f'width="{total_w:.0f}" height="{total_h:.0f}">', f'<style>{STYLE}</style>',
           '<rect class="bg" width="100%" height="100%"/>',
           f'<text class="title" x="{gap}" y="40">{sheet["title"]}</text>']
    for i, panel in enumerate(panels):
        name, desc, items = panel[:3]
        x = gap + i * (panel_w + gap)
        plan = dict(file=sheet["file"], pencil="applied", zones=panel[4] if len(panel) > 4 else [],
                    furniture=items, av=None, notes=panel[3] if len(panel) > 3 else [], labels={"hall": ""})
        c = Canvas()
        render_body(c, plan)
        out.append(f'<text class="panel-title" x="{x}" y="78">{name}</text>')
        out.append(f'<text class="note" x="{x}" y="98">{desc}</text>')
        out.append(f'<svg x="{x}" y="{top}" width="{panel_w}" height="{panel_h:.0f}" '
                   f'viewBox="{vx:.0f} {vy:.0f} {vw:.0f} {vh:.0f}">')
        out.extend(c.parts)
        out.append('</svg>')
        out.append(f'<rect x="{x}" y="{top}" width="{panel_w}" height="{panel_h:.0f}" '
                   f'fill="none" stroke="#bbb"/>')
    out.append('</svg>\n')
    return "\n".join(out)


def main():
    for plan in (BASE, PLAN_A, PLAN_B):
        path = OUT_DIR / f'{plan["file"]}.svg'
        path.write_text(render(plan), encoding="utf-8")
        print(f"wrote {path}")
    for sheet in (BAR_SHEET, ENTRY_SHEET):
        path = OUT_DIR / f'{sheet["file"]}.svg'
        path.write_text(render_sheet(sheet), encoding="utf-8")
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
