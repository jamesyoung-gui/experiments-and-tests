// OWNER: print. The PICTURE-BOOK SPREAD (STYLE-B §4): screen-fixed page furniture in L-letterbox (depth null).
//  · the book: a cloth-bound cover rim and the stacked page edges at the screen edge, the deckled edge of the top page,
//    the cream paper margin (fibre texture) whose inner edge is the painting's dry-brush boundary, the illustrator's
//    ruled pencil frame (double, overshooting at the corners), the gutter shadow down the spread with its sewing
//    stitches, running heads, bilingual page numbers with leaf flourishes, a curled page corner, a red satin bookmark
//    ribbon, a publisher's colophon and little spot illustrations in the margins (shell, fish bone, star, feather,
//    paper boat, a child's crayon heart, a thumbprint);
//  · the hand-lettered title "Pelican Bay" + 鹈鹕湾 (DejaVu Serif Bold / WenQuanYi outlines, every glyph baked with its
//    own baseline wobble and tilt, painted shadow, gouache streaks, pencil double line), a brush swash, twinkles, the
//    subtitle and the "Chapter One · 第一章" plate. The letters pop in one by one, hold ~3 s, then the card shrinks into
//    a small corner title. It is fitted into the free space around the rider's screen box every frame (never covers
//    the bird at any camera, aspect or hop) and keeps clear of the UI card;
//  · the story caption: a bilingual picture-book sentence per route stretch (route.js STRETCHES) with its page header,
//    a red raised initial and a flower divider, on a gouache patch; the page number follows the journey and the
//    chapter the lap. Captions fade across stretch boundaries as a pure function of road distance (renderAt-stable);
//  · cinematic: the letterbox IS the book: the margins grow into the bars, the title moves into the top margin and the
//    caption is printed straight onto the bottom margin, like the text block of a real picture book.
// No filters, no per-frame geometry: the hand-made look (wobble, deckle, dry brush, double lines) is seeded jitter
// baked into the paths; textures are static <pattern>s. After the intro nothing here changes unless the view, the
// letterbox, the UI card, the (coarse) rider box, the stretch or the lap changes.
import { fmt2 } from '../core/math.js';
import { h } from '../core/svg.js';
import { VIEW, RIDER_X, GROUND_Y, CAMERAS } from '../contract.js';
import { LAT, SER, ZH } from './print-glyphs.js';
import { stretchAt, lapOf, lapPos } from './route.js';

export const id = 'print';
// page paints (graded by the hour like every material: the bedtime page at night is a lavender-dusk cream)
export const materials = {
  pgPaper: '#F8EDD8', pgPaperHi: '#FFF8EC', pgPaperLo: '#E6D2B2', pgEdge: '#EADAC0',
  pgCloth: '#7C3A32', pgClothLo: '#5A2622', pgClothHi: '#A45A48',
  pgRibbon: '#C9382F', pgRibbonLo: '#8C2226', pgRibbonHi: '#F2826A',
  pgTitle: '#FFF3DC', pgTitleLo: '#F1D9B4', pgGold: '#FAC957', pgGoldLo: '#E39A3A',
  pgShell: '#F6B79A', pgShellLo: '#D9876C', pgSea: '#6A8FC4', pgLeaf: '#6E9A58', pgBone: '#FFF8EC',
};

const TD = 'typography_frame';
const f = fmt2;
const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - (1 - t) ** 3;
const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
const backOut = t => { const c = 1.9; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };

// seeded PRNG (mulberry32): every wobble is the same on every frame and every load
function srand(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const sgn = r => r() * 2 - 1;

// ------------------------------------------------------------------ path helpers
// Affine-transform an absolute SVG path (M L H V Q C Z). m = [a b c d e f]: x' = a·x + c·y + e, y' = b·x + d·y + f.
function tp(d, m) {
  const tok = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) || [];
  let i = 0, cmd = '', out = '';
  const num = () => +tok[i++];
  const pt = () => { const x = num(), y = num(); return `${f(m[0] * x + m[2] * y + m[4])} ${f(m[1] * x + m[3] * y + m[5])}`; };
  while (i < tok.length) {
    if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
    switch (cmd) {
      case 'M': out += 'M' + pt(); cmd = 'L'; break;
      case 'L': out += 'L' + pt(); break;
      case 'Q': out += 'Q' + pt() + ' ' + pt(); break;
      case 'C': out += 'C' + pt() + ' ' + pt() + ' ' + pt(); break;
      case 'Z': case 'z': out += 'Z'; cmd = ''; break;
      default: throw new Error('print: unsupported path token ' + tok[i - 1]);
    }
  }
  return out;
}
// closed / open Catmull-Rom -> cubic path (the draft's cr())
function cr(pts, closed = true, k = 1 / 6) {
  const n = pts.length; let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  const g = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    d += `C${f(p1[0] + (p2[0] - p0[0]) * k)} ${f(p1[1] + (p2[1] - p0[1]) * k)} ${f(p2[0] - (p3[0] - p1[0]) * k)} ${f(p2[1] - (p3[1] - p1[1]) * k)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + (closed ? 'Z' : '');
}
const circ = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const ell = (x, y, rx, ry) => `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
// wobbly hand-drawn polyline through pts (seeded), open or closed
const wob = (pts, r, amp = 0.8, closed = false) => cr(pts.map(([x, y]) => [x + sgn(r) * amp, y + sgn(r) * amp]), closed);
// tapered brush stroke along a centre line c(t) (t 0..1) with half width w(t) -> closed outline
function brush(c, w, n = 24) {
  const L = [], R = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, [x, y] = c(t), [x2, y2] = c(Math.min(1, t + 0.01)), [x1, y1] = c(Math.max(0, t - 0.01));
    const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, ww = w(t);
    L.push([x + nx * ww, y + ny * ww]); R.push([x - nx * ww, y - ny * ww]);
  }
  return cr([...L, ...R.reverse()], true);
}
// 4-point painted twinkle
const star4 = (x, y, r, k = 0.22) => `M${f(x)} ${f(y - r)}Q${f(x + r * k)} ${f(y - r * k)} ${f(x + r)} ${f(y)}Q${f(x + r * k)} ${f(y + r * k)} ${f(x)} ${f(y + r)}Q${f(x - r * k)} ${f(y + r * k)} ${f(x - r)} ${f(y)}Q${f(x - r * k)} ${f(y - r * k)} ${f(x)} ${f(y - r)}Z`;

// ------------------------------------------------------------------ lettering (glyph outlines -> one path)
const HAN = /[　-〿一-鿿＀-￯]/;
const advOf = (font, ch) => font[ch] ? font[ch][0] : ch === ' ' ? (font === ZH ? 500 : 300) : 0;
// mixed-script run: Han characters from ZH (zs = relative size), everything else from `lat`
function measure(str, size, { lat = SER, track = 0, zs = 1 } = {}) {
  let w = 0; const ch = [...str];
  ch.forEach((c, i) => { const zh = HAN.test(c); w += advOf(zh ? ZH : lat, c) * size * (zh ? zs : 1) / 1000 + (i < ch.length - 1 ? track : 0); });
  return w;
}
// -> {d, w}. jit = seeded rng for hand-lettering wobble (per-glyph tilt ± rotJ°, baseline ± dyJ, size ± sJ)
function text(str, { size = 12, x = 0, y = 0, lat = SER, track = 0, zs = 1, align = 'left', jit = null, rotJ = 1.6, dyJ = 0.05, sJ = 0.02 } = {}) {
  const w = measure(str, size, { lat, track, zs });
  let pen = x - (align === 'center' ? w / 2 : align === 'right' ? w : 0), d = '';
  for (const c of str) {
    const zh = HAN.test(c), font = zh ? ZH : lat, g = font[c], sz = size * (zh ? zs : 1), a = advOf(font, c) * sz / 1000;
    if (!g && c !== ' ') throw new Error(`print: no glyph for "${c}" (rerun print-glyphs.gen.mjs)`);
    if (g) {
      let k = sz / 1000, rr = 0, dy = 0;
      if (jit) { rr = sgn(jit) * rotJ * Math.PI / 180; dy = sgn(jit) * dyJ * size; k *= 1 + sgn(jit) * sJ; }
      const c0 = Math.cos(rr), s0 = Math.sin(rr), cx = pen + a / 2;
      d += tp(g[1], [c0 * k, s0 * k, -s0 * k, c0 * k, cx - c0 * a / 2, y + dy - s0 * a / 2]);
    }
    pen += a + track;
  }
  return { d, w };
}
// greedy wrap. Latin by words, Han by characters (no line may start with closing punctuation)
function wrap(str, size, maxW, opt = {}) {
  const han = HAN.test(str), units = han ? [...str] : str.split(' ');
  const lines = []; let cur = '';
  for (const u of units) {
    const cand = cur ? (han ? cur + u : cur + ' ' + u) : u;
    if (cur && measure(cand, size, opt) > maxW && !(han && /[，。！？、：；”）]/.test(u))) { lines.push(cur); cur = u; } else cur = cand;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ------------------------------------------------------------------ the story (one picture-book sentence per stretch)
const STORY = {
  village: ['鹈鹕系好红围巾，骑上自行车出发啦。', 'Pelican ties on the red scarf and sets off along the coast road.'],
  pier: ['长长的栈桥上，钓鱼的爷爷们挥手问好。', 'On the long pier, the old anglers wave hello.'],
  harbour: ['渔船回港了，海鸥们都盼着分到一条鱼。', 'The fishing boats come home, and every gull hopes for a fish.'],
  funfair: ['摩天轮慢慢地转，音乐叮叮咚咚。', 'The Ferris wheel turns slowly, and the music goes plink, plonk.'],
  railway: ['小火车呜呜地叫，鹈鹕要和它比一比。', 'The little train toots, and Pelican races it along the shore.'],
  lighthouse: ['鹈鹕向灯塔守护人挥挥翅膀。', 'Pelican waves to the lighthouse keeper.'],
  cliffs: ['高高的断崖下，浪花在唱歌。', 'Under the tall cliffs, the waves sing their song.'],
  dunes: ['沙丘上，小螃蟹一家排着队去散步。', 'On the dunes, the crab family goes for a walk, all in a row.'],
  bridge: ['过了河口桥，风儿轻轻地吹。', 'Over the river bridge, the breeze blows soft and slow.'],
  fort: ['古堡旁边，大家在海里扑通扑通地游泳。', 'By the old fort, everybody splashes in the sea.'],
  pines: ['松林里静悄悄，只听见车铃叮铃铃。', 'The pine wood is hushed, all but the ring-a-ding of the bell.'],
  return: ['绕了一大圈，又回到了鹈鹕湾。明天再来！', 'All the way round and home to Pelican Bay. Again tomorrow!'],
};
// the bedtime-story night has its own lines for a few pages
const STORY_NIGHT = {
  village: ['星星亮了，鹈鹕打开车灯出发啦。', 'The stars come out, so Pelican switches on the lamp and sets off.'],
  lighthouse: ['灯塔的光一圈又一圈，照亮回家的路。', 'Round and round goes the lighthouse beam, lighting the way home.'],
  pines: ['松林里黑黑的，萤火虫提着小灯笼。', 'The pine wood is dark, and the fireflies carry little lanterns.'],
  return: ['月亮升起来了，鹈鹕湾就要睡着啦。', 'The moon is up, and Pelican Bay is falling asleep.'],
};
const ZH_DIG = '零一二三四五六七八九';
const zhNum = n => n <= 10 ? (n === 10 ? '十' : ZH_DIG[n]) : n < 20 ? '十' + (n % 10 ? ZH_DIG[n % 10] : '')
  : n < 100 ? ZH_DIG[Math.floor(n / 10)] + '十' + (n % 10 ? ZH_DIG[n % 10] : '') : [...String(n)].map(d => ZH_DIG[+d]).join('');
const EN_NUM = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
const titleCase = s => s.toLowerCase().split(' ').map((w, i) => (i && /^(the|of|and)$/.test(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const chapterOf = lap => ({ zh: `第${zhNum(lap + 1)}章`, en: `Chapter ${EN_NUM[lap + 1] || lap + 1}` });
function pageOf(D, night) {
  const s = stretchAt(D), lap = Math.max(0, lapOf(D)), n = lap * 12 + s.i + 1;
  const [zh, en] = (night && STORY_NIGHT[s.key]) || STORY[s.key];
  return { key: `${lap}:${s.i}:${night && STORY_NIGHT[s.key] ? 'n' : 'd'}`, n, lap, s, zh, en,
    headZh: `第${zhNum(n)}页 · ${s.cn}`, headEn: `Page ${n} · ${titleCase(s.en)}` };
}

// ------------------------------------------------------------------ geometry constants (screen / viewBox units)
const RIM = 9;                       // cover cloth (0..5) + stacked page edges (5..9) at every screen edge
const MS = 26, MT = 26, MB = 36;     // paper margin: sides / top / bottom (holds page numbers and the colophon)
const LB_MAX = CAMERAS.cinematic.letterbox;
// title card, card-local units (Latin at size 100: cap height 73, descender 23)
const TS = 100, ZS = 46, SUBS = 20;
const W1 = measure('Pelican', TS, { lat: LAT }), W2 = measure('Bay', TS, { lat: LAT }), GAP = 30, LINE_W = W1 + GAP + W2;
const ZHW = measure('鹈鹕湾', ZS, { track: 5 });
const SUB_TXT = 'a seaside picture book · 海边的图画书';
const SUBW = measure(SUB_TXT, SUBS, { zs: 0.95 });
const PW = 286, PH = 46;              // chapter plate
const LAYOUTS = {
  line: { w1: [0, 0], w2: [W1 + GAP, 0], zh: [4, 76], sw: [0, 76], sub: [ZHW + 36, 70], plate: [LINE_W - PW + 20, 100],
    box: [-16, -96, LINE_W + 46, 150], k: 1 },
  stack: { w1: [0, 0], w2: [0, 104], zh: [W2 + 26, 104], sw: [W2 + 22, 104], sub: [2, 152], plate: [0, 172],
    box: [-16, -96, Math.max(W1 + 30, W2 + 26 + ZHW + 20, SUBW + 8, PW) + 10, 224], k: 0.74 },
  logo: { w1: [0, 0], w2: [W1 + GAP, 0], zh: [LINE_W + 34, 0], sw: [LINE_W + 30, 0], sub: [ZHW + 36, 70], plate: [LINE_W + 34 + ZHW + 30, -52, 0.92],
    box: [-12, -90, LINE_W + 34 + ZHW + 30 + PW * 0.92 + 8, 30], k: 1 },
};
const RIBBON = { w: 15, len: 62 };   // hangs this far into the picture below the top margin

export const detailItems = [
  ['book-cover', 'O', 'cloth-bound cover rim at the very edge of the screen (the book lies open on the table)'],
  ['cloth-weave', 'T', 'book-cloth weave texture (warp and weft threads) on the cover rim'],
  ['page-stack', 'O', 'stacked page edges between the cover and the open page, fine page lines'],
  ['deckled-edge', 'O', 'deckled (hand-torn) outer edge of the top page, with its soft shadow on the stack'],
  ['page-margin', 'O', 'cream paper margin around the painting; it grows into the cinematic letterbox bars'],
  ['paper-fibre', 'T', 'paper fibres, flecks and pale blotches in the margin'],
  ['painting-drybrush', 'T', 'dry-brush boundary of the painting: bristle drags and skipped specks where the gouache ends'],
  ['pencil-frame', 'O', 'the illustrator\'s ruled pencil frame, double-struck in places, overshooting at the corners'],
  ['gutter-shadow', 'O', 'soft gutter shadow down the centre of the spread (fades out above the rider)'],
  ['gutter-stitch', 'O', 'sewing thread stitches visible in the gutter of the margins'],
  ['running-head-left', 'O', 'left running head "鹈鹕湾 · Pelican Bay"'],
  ['running-head-right', 'O', 'right running head: chapter of the lap and "海滨路 · The Coast Road"'],
  ['page-number-zh', 'O', 'left page number in Chinese numerals (follows the journey)'],
  ['page-number-arabic', 'O', 'right page number in serif figures'],
  ['page-flourish', 'O', 'little leaf flourishes either side of the page numbers'],
  ['corner-curl', 'O', 'curled-up page corner showing the paper underside and the next page, with a cast shadow'],
  ['bookmark-ribbon', 'O', 'red satin bookmark ribbon with a swallowtail end and frayed threads'],
  ['ribbon-sheen', 'T', 'satin sheen and fold shading painted down the ribbon'],
  ['title-lettering', 'O', 'hand-lettered serif title "Pelican Bay": every glyph tilted and set off its baseline'],
  ['title-gouache', 'T', 'gouache brush streaks inside the cream title letters'],
  ['title-shadow', 'O', 'painted mauve shadow behind the title letters'],
  ['title-pencil', 'T', 'offset pencil double line along the title letters'],
  ['title-zh', 'O', '鹈鹕湾 in scarf red with a brown outline'],
  ['title-swash', 'O', 'yellow gouache brush swash under 鹈鹕湾, ending in a little wave curl'],
  ['title-twinkles', 'O', 'three painted twinkles that pop around the title'],
  ['title-subtitle', 'O', 'subtitle "a seaside picture book · 海边的图画书"'],
  ['chapter-plate', 'O', 'chapter plate with notched corners, double rule and the chapter of the lap'],
  ['plate-sprigs', 'O', 'leaf sprigs and berries at both ends of the chapter plate'],
  ['caption-patch', 'O', 'paper-white gouache patch behind the story text, brushy edges'],
  ['caption-wash', 'T', 'dry-brush streak texture on the caption patch'],
  ['caption-header', 'O', 'page header "第三页 · 灯塔角 · Page 3 · Lighthouse Point"'],
  ['caption-divider', 'O', 'hand-drawn wave-and-flower divider under the header'],
  ['caption-zh', 'O', 'the Chinese story sentence of this stretch'],
  ['caption-en', 'O', 'the English story sentence of this stretch'],
  ['caption-initial', 'O', 'red raised initial letter of the English sentence'],
  ['spot-shell', 'O', 'margin spot illustration: a ribbed scallop shell'],
  ['spot-fishbone', 'O', 'margin spot illustration: a fish bone (Pelican\'s lunch)'],
  ['spot-star', 'O', 'margin spot illustration: a golden star with two twinkles'],
  ['spot-feather', 'O', 'margin spot illustration: a pelican feather with rachis and barbs'],
  ['spot-boat', 'O', 'margin spot illustration: a folded paper boat on a wavelet'],
  ['crayon-heart', 'O', 'a child\'s red crayon heart and tick doodled in the margin'],
  ['thumbprint', 'T', 'a faint gouache thumbprint left on the margin by the painter'],
  ['colophon', 'O', 'publisher\'s colophon: pelican roundel and "鹈鹕湾出版社 · Pelican Bay Press"'],
].map(([name, kind, what]) => ({ id: `${TD}:${kind}:${name}`, layer: TD, kind, what }));
const DD = Object.fromEntries(detailItems.map(d => [d.id.split(':')[2], d.id]));

// ------------------------------------------------------------------ runtime-built shapes (pure, seeded)
// rim along one screen edge; local frame: u along the edge, q inward from the screen edge (q = 0 at the edge)
function rimD(u0, u1, seed) {
  const r = srand(seed), step = 6;
  let cloth = `M${f(u0)} -60`, band = '', deck = '', lines = '';
  const dk = [];
  for (let u = u0; u <= u1 + 0.01; u += step) dk.push([u, RIM + sgn(r) * 0.9 + Math.sin(u / 23) * 0.5]);
  cloth += `L${f(u1)} -60L${f(u1)} 5` + dk.slice().reverse().map(([u]) => `L${f(u)} ${f(5 + Math.sin(u / 71) * 0.25)}`).join('') + 'Z';
  band = `M${f(u0)} 4.6` + dk.map(([u]) => `L${f(u)} 4.6`).join('') + dk.slice().reverse().map(([u, q]) => `L${f(u)} ${f(q)}`).join('') + 'Z';
  deck = 'M' + dk.map(([u, q]) => `${f(u)} ${f(q)}`).join('L');
  for (const q of [6.1, 7.4]) lines += `M${f(u0)} ${q}` + dk.filter((_, i) => i % 4 === 0).map(([u]) => `L${f(u)} ${f(q + Math.sin(u / 37 + q) * 0.18)}`).join('');
  return { cloth, band, deck, lines };
}
// the ruled pencil frame round the painting (yT..yB, xL..xR), 5 u out in the margin, overshooting at the corners
function pencilD(xL, yT, xR, yB, show) {
  const r = srand(77), o = 5, ov = 11;
  const seg = (x0, y0, x1, y1) => {
    const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 60)), pts = [];
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push([lerp(x0, x1, t) + (y0 === y1 ? 0 : sgn(r) * 0.5), lerp(y0, y1, t) + (y0 === y1 ? sgn(r) * 0.5 : 0)]); }
    return cr(pts, false);
  };
  let a = '', b = '';
  const L = [[xL - ov - o, yT - o, xR + ov + o, yT - o, show.t], [xL - ov - o, yB + o, xR + ov + o, yB + o, show.b],
    [xL - o, yT - ov - o, xL - o, yB + ov + o, true], [xR + o, yT - ov - o, xR + o, yB + ov + o, true]];
  for (const [x0, y0, x1, y1, on] of L) {
    if (!on) continue;
    a += seg(x0, y0, x1, y1);
    // second, lighter pass over a stretch of each line (the double-struck pencil)
    const t0 = 0.1 + r() * 0.3, t1 = t0 + 0.25 + r() * 0.3, dx = y0 === y1 ? 0 : 1.3, dy = y0 === y1 ? 1.3 : 0;
    b += seg(lerp(x0, x1, t0) + dx, lerp(y0, y1, t0) + dy, lerp(x0, x1, t1) + dx, lerp(y0, y1, t1) + dy);
  }
  return { a, b };
}
// gouache patch behind the caption: jittered rounded rectangle + bristle drags at the ends
function patchD(w, hh, seed) {
  const r = srand(seed), R = 16, pts = [];
  const per = [[R, 0, w - R, 0], [w, R, w, hh - R], [w - R, hh, R, hh], [0, hh - R, 0, R]];
  per.forEach(([x0, y0, x1, y1], si) => {
    const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 26));
    for (let i = 0; i < n; i++) { const t = i / n; pts.push([lerp(x0, x1, t) + sgn(r) * 2, lerp(y0, y1, t) + sgn(r) * 2]); }
    const cx = [w - R * 0.3, w - R * 0.3, R * 0.3, R * 0.3][si], cy = [R * 0.3, hh - R * 0.3, hh - R * 0.3, R * 0.3][si];
    pts.push([cx + sgn(r), cy + sgn(r)]);
  });
  let bristle = '';
  for (const side of [0, 1]) for (let i = 0; i < 7; i++) {
    const y = 8 + r() * (hh - 16), L = 5 + r() * 13, x = side ? w - 1 : 1, dir = side ? 1 : -1, ww = 0.7 + r() * 1.4;
    bristle += `M${f(x)} ${f(y - ww)}Q${f(x + dir * L * 0.6)} ${f(y - ww * 0.4 + sgn(r))} ${f(x + dir * L)} ${f(y + sgn(r))}Q${f(x + dir * L * 0.5)} ${f(y + ww * 0.5)} ${f(x)} ${f(y + ww)}Z`;
  }
  let streak = '';
  for (let i = 0; i < Math.round(w * hh / 1400); i++) {
    const x = 10 + r() * (w - 40), y = 6 + r() * (hh - 12), L = 18 + r() * 50;
    streak += brush(t => [x + L * t, y + Math.sin(t * 3 + i) * 1.2], t => 0.35 + 0.8 * Math.sin(Math.PI * t) ** 0.6, 6);
  }
  return { patch: cr(pts, true) + bristle, streak };
}
const DIV_W = 74;
const dividerD = (x, y) => {
  let d = '';
  for (let i = 0; i <= 18; i++) { const t = i / 18; d += `${i ? 'L' : 'M'}${f(x + t * DIV_W)} ${f(y + Math.sin(t * Math.PI * 4) * 1.6)}`; }
  return d;
};
const flowerD = (x, y) => [0, 1, 2, 3, 4].map(i => { const a = i * 72 * Math.PI / 180 - Math.PI / 2; return circ(x + Math.cos(a) * 2.7, y + Math.sin(a) * 2.7, 1.9); }).join('');
// caption text blocks. mode 'line' | 'col' (on the gouache patch, left aligned) | 'bar' (printed on the margin, centred)
const CAP = { head: 12, zh: 21, zhLH: 31, en: 16.5, enLH: 23.5, init: 30, pad: 18 };
function captionLayout(pg, mode) {
  const maxW = mode === 'line' ? 600 : mode === 'col' ? 270 : 1300;
  const centre = mode === 'bar', P = mode === 'bar' ? 0 : CAP.pad;
  const heads = mode === 'col' ? [pg.headZh, pg.headEn] : [`${pg.headZh}  ·  ${pg.headEn}`];
  const zhL = wrap(pg.zh, CAP.zh, maxW), init = pg.en[0], rest = pg.en.slice(1);
  const initW = measure(init, CAP.init, { lat: LAT }) + 1.5;
  // English: the first line is shortened by the raised initial
  const words = rest.split(' '), enL = []; let cur = '', lim = maxW - initW;
  for (const wd of words) {
    const cand = cur ? cur + ' ' + wd : wd;
    if (cur && measure(cand, CAP.en) > lim) { enL.push(cur); cur = wd; lim = maxW; } else cur = cand;
  }
  if (cur) enL.push(cur);
  const wOf = [...heads.map(s => measure(s, CAP.head, { zs: 1.02 })), ...zhL.map(s => measure(s, CAP.zh)), ...enL.map((s, i) => measure(s, CAP.en) + (i ? 0 : initW)), DIV_W];
  const tw = Math.max(...wOf), W = tw + 2 * P;
  const X = (lw) => centre ? P + (tw - lw) / 2 : P;
  const r = srand(pg.n * 31 + (mode === 'bar' ? 7 : mode === 'col' ? 3 : 1));
  let y = P + 10, head = '', zh = '', en = '', ini = '', div = '', flw = '';
  for (const s of heads) { head += text(s, { size: CAP.head, x: X(measure(s, CAP.head, { zs: 1.02 })), y, zs: 1.02, track: 0.2 }).d; y += 16; }
  const dx = X(DIV_W); div = dividerD(dx, y - 4); flw = flowerD(dx + DIV_W / 2, y - 4); y += 26;
  for (const s of zhL) { zh += text(s, { size: CAP.zh, x: X(measure(s, CAP.zh)), y, jit: r, rotJ: 1.2, dyJ: 0.035, sJ: 0.015 }).d; y += CAP.zhLH; }
  y += 1;
  enL.forEach((s, i) => {
    let x = X(measure(s, CAP.en) + (i ? 0 : initW));
    if (!i) { ini = text(init, { size: CAP.init, x, y: y + 1, lat: LAT, jit: r, rotJ: 3 }).d; x += initW; }
    en += text(s, { size: CAP.en, x, y, jit: r, rotJ: 0.9, dyJ: 0.03, sJ: 0.01 }).d; y += CAP.enLH;
  });
  const H = y - CAP.enLH + (mode === 'bar' ? 6 : P + 6);
  const out = { w: W, h: H, head, zh, en, ini, div, flw };
  if (mode !== 'bar') Object.assign(out, patchD(W, H, pg.n * 13 + (mode === 'col' ? 5 : 1)));
  return out;
}
// running head (right) for a lap, and the chapter plate text
const headR = lap => { const c = chapterOf(lap); return `${c.zh} · 海滨路  ·  ${c.en} · The Coast Road`; };
function plateText(lap) {
  const c = chapterOf(lap), zw = measure(c.zh, 18), ew = measure(c.en, 18, { lat: LAT }), sep = 22, w = zw + sep + ew, x0 = (PW - w) / 2;
  return { zh: text(c.zh, { size: 18, x: x0, y: PH / 2 + 6.4 }).d, en: text(c.en, { size: 18, x: x0 + zw + sep, y: PH / 2 + 6.4, lat: LAT }).d, dot: circ(x0 + zw + sep / 2, PH / 2, 2) };
}
// page number with its leaf flourishes (centred at 0, baseline 0)
function pageNum(str, zh) {
  const t = text(str, { size: zh ? 13 : 14, lat: LAT, align: 'center' });
  const hw = t.w / 2 + 9;
  const leaf = (x, dir) => {
    const s = `M${f(x)} -4.5C${f(x + dir * 5)} -4.5 ${f(x + dir * 9)} -7 ${f(x + dir * 13)} -3.5`;
    return { stem: s, leaf: `M${f(x + dir * 6)} -5.4Q${f(x + dir * 8.5)} -10.5 ${f(x + dir * 11.8)} -9.6Q${f(x + dir * 10)} -5.8 ${f(x + dir * 6)} -5.4Z` + circ(x + dir * 14.2, -3.2, 1.2) };
  };
  const a = leaf(-hw, -1), b = leaf(hw, 1);
  return { d: t.d, stem: a.stem + b.stem, leaf: a.leaf + b.leaf, w: t.w };
}

// ------------------------------------------------------------------ build
export function build({ v }) {
  const c = {
    line: v('line'), soft: v('lineSoft'), mauve: v('mauve'), paper: v('paper'),
    pp: v('pgPaper'), pHi: v('pgPaperHi'), pLo: v('pgPaperLo'), edge: v('pgEdge'),
    cl: v('pgCloth'), clLo: v('pgClothLo'), clHi: v('pgClothHi'),
    rb: v('pgRibbon'), rbLo: v('pgRibbonLo'), rbHi: v('pgRibbonHi'),
    ti: v('pgTitle'), tiLo: v('pgTitleLo'), gold: v('pgGold'), goldLo: v('pgGoldLo'),
    sh: v('pgShell'), shLo: v('pgShellLo'), sea: v('pgSea'), leaf: v('pgLeaf'), bone: v('pgBone'), lamp: v('lampGlow'),
  };
  const tag = (name, attrs, ...kids) => h('g', { 'data-detail': DD[name], ...attrs }, ...kids);
  const P = (d, attrs) => h('path', { d, ...attrs });
  const LN = (w, col = c.line) => ({ fill: 'none', stroke: col, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  const defs = [];

  // ---- static textures (local coordinates of the element that uses them) ----
  {
    const r = srand(11); let fib = '', fleck = '', blot = '';
    for (let i = 0; i < 34; i++) { const x = r() * 150, y = r() * 150, a = r() * Math.PI, L = 4 + r() * 9; fib += `M${f(x)} ${f(y)}q${f(Math.cos(a) * L / 2 + sgn(r) * 2)} ${f(Math.sin(a) * L / 2 + sgn(r) * 2)} ${f(Math.cos(a) * L)} ${f(Math.sin(a) * L)}`; }
    for (let i = 0; i < 18; i++) fleck += circ(r() * 150, r() * 150, 0.35 + r() * 0.5);
    for (let i = 0; i < 5; i++) blot += ell(r() * 150, r() * 150, 8 + r() * 16, 5 + r() * 10);
    defs.push(h('pattern', { id: 'print-paper', width: 150, height: 150, patternUnits: 'userSpaceOnUse' },
      h('rect', { width: 150, height: 150, fill: c.pp }), P(blot, { fill: c.pHi, opacity: 0.55 }),
      P(fib, { fill: 'none', stroke: c.pLo, 'stroke-width': 0.55, opacity: 0.75 }), P(fleck, { fill: c.soft, opacity: 0.3 })));
    defs.push(h('pattern', { id: 'print-cloth', width: 3, height: 3, patternUnits: 'userSpaceOnUse' },
      h('rect', { width: 3, height: 3, fill: c.cl }), P('M0 0.75H3M0 2.25H3', { stroke: c.clLo, 'stroke-width': 0.7, opacity: 0.8 }),
      P('M0.75 0V3M2.25 0V3', { stroke: c.clHi, 'stroke-width': 0.5, opacity: 0.45 })));
    // gouache streaks for the title letters (title-local units: letters are 100 high)
    const r2 = srand(23); let st = '', hi = '';
    for (let i = 0; i < 9; i++) { const x = r2() * 70, y = r2() * 44, L = 16 + r2() * 30; st += brush(t => [x + L * t, y - L * 0.12 * t], t => 0.8 + 1.8 * Math.sin(Math.PI * t) ** 0.7, 6); }
    for (let i = 0; i < 5; i++) { const x = r2() * 70, y = r2() * 44, L = 10 + r2() * 20; hi += brush(t => [x + L * t, y - L * 0.12 * t], t => 0.5 + 1.1 * Math.sin(Math.PI * t) ** 0.7, 6); }
    defs.push(h('pattern', { id: 'print-brush', width: 70, height: 44, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(-8)' },
      P(st, { fill: c.tiLo, opacity: 0.75 }), P(hi, { fill: c.pHi, opacity: 0.9 })));
  }
  // gutter: horizontal falloff (unit rect scaled per frame) and the vertical fade mask for the stretch over the picture
  defs.push(h('linearGradient', { id: 'print-ggrad', x1: 0, x2: 1, y1: 0, y2: 0 },
    h('stop', { offset: 0, 'stop-color': c.mauve, 'stop-opacity': 0 }), h('stop', { offset: 0.38, 'stop-color': c.mauve, 'stop-opacity': 0.16 }),
    h('stop', { offset: 0.5, 'stop-color': c.soft, 'stop-opacity': 0.34 }), h('stop', { offset: 0.56, 'stop-color': c.pHi, 'stop-opacity': 0.22 }),
    h('stop', { offset: 0.7, 'stop-color': c.mauve, 'stop-opacity': 0.08 }), h('stop', { offset: 1, 'stop-color': c.mauve, 'stop-opacity': 0 })));
  defs.push(h('linearGradient', { id: 'print-gfade', x1: 0, x2: 0, y1: 0, y2: 1 },
    h('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0.75 }), h('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 })));
  defs.push(h('mask', { id: 'print-gmask', maskContentUnits: 'objectBoundingBox' }, h('rect', { width: 1, height: 1, fill: 'url(#print-gfade)' })));
  defs.push(h('radialGradient', { id: 'print-lamp', cx: 0.5, cy: 0.5, r: 0.5 },
    h('stop', { offset: 0, 'stop-color': c.lamp, 'stop-opacity': 0.2 }), h('stop', { offset: 0.55, 'stop-color': c.lamp, 'stop-opacity': 0.07 }), h('stop', { offset: 1, 'stop-color': c.lamp, 'stop-opacity': 0 })));
  defs.push(h('linearGradient', { id: 'print-curl', x1: 0, y1: 0, x2: 1, y2: 1 },
    h('stop', { offset: 0, 'stop-color': c.pHi }), h('stop', { offset: 0.55, 'stop-color': c.pp }), h('stop', { offset: 1, 'stop-color': c.pLo })));

  // ---- the paper margin: four long strips whose inner edge is the painting's dry-brush boundary ----
  // local frame: the painting edge runs along u at n = 0, paper on n < 0 (outward). m maps (u, n) -> (x, y).
  const strip = (k, u0, u1, m, seed) => {
    const r = srand(seed), step = 5, pts = [];
    for (let u = u0; u <= u1 + 0.01; u += step) pts.push([u, 0.9 * Math.sin(u / 47 + seed) + 0.6 * Math.sin(u / 13.7) + sgn(r) * 0.45]);
    const M = ([u, n]) => m(u, n).map(f).join(' ');
    let paper = 'M' + M([u0, -1500]) + 'L' + M([u1, -1500]) + pts.slice().reverse().map(p => 'L' + M(p)).join('') + 'Z';
    // bristle drags into the painting + skipped specks just inside it
    let dry = '';
    for (let u = u0 + r() * 40; u < u1; u += 26 + r() * 90) {
      const nB = 2 + Math.floor(r() * 4);
      for (let j = 0; j < nB; j++) {
        const uu = u + j * (2.2 + r() * 2.5), L = 3 + r() * 11, w = 0.6 + r() * 1.1;
        dry += 'M' + M([uu - w, -1]) + 'Q' + M([uu - w * 0.3, L * 0.6]) + ' ' + M([uu + sgn(r) * 1.5, L]) + 'Q' + M([uu + w * 0.4, L * 0.5]) + ' ' + M([uu + w, -1]) + 'Z';
      }
      if (r() < 0.6) for (let j = 0; j < 3; j++) { const [x, y] = m(u + 8 + r() * 20, 2 + r() * 7); dry += circ(x, y, 0.4 + r() * 0.7); }
    }
    return h('g', { 'data-ref': 'print-m' + k },
      tag('page-margin', {}, P(paper, { fill: 'url(#print-paper)' })),
      tag('painting-drybrush', {}, P(dry, { fill: c.pp })));
  };
  const margins = h('g', { id: 'print-margins' },
    strip('T', -60, 1660, (u, n) => [u, n], 3), strip('B', -60, 1660, (u, n) => [u, -n], 5),
    strip('L', -60, 960, (u, n) => [n, u], 7), strip('R', -60, 960, (u, n) => [-n, u], 9),
    tag('paper-fibre', {}, h('rect', { 'data-ref': 'print-fibre', x: 0, y: 0, width: 1, height: 1, fill: 'none' })));

  // ---- rim: cover cloth + page stack + deckled page edge (paths rebuilt on resize) ----
  const rim = h('g', { id: 'print-rim' },
    ['T', 'B', 'L', 'R'].map(k => h('g', { 'data-ref': 'print-rim' + k },
      tag('book-cover', {}, P('', { 'data-ref': `print-rim${k}-cloth`, fill: c.cl })),
      tag('cloth-weave', {}, P('', { 'data-ref': `print-rim${k}-weave`, fill: 'url(#print-cloth)', opacity: 0.9 })),
      tag('page-stack', {}, P('', { 'data-ref': `print-rim${k}-band`, fill: c.edge }), P('', { 'data-ref': `print-rim${k}-lines`, ...LN(0.45, c.soft), opacity: 0.7 })),
      tag('deckled-edge', {}, P('', { 'data-ref': `print-rim${k}-deck`, ...LN(0.9, c.soft), opacity: 0.8 })))));

  // ---- pencil frame, gutter ----
  const pencil = tag('pencil-frame', {}, P('', { 'data-ref': 'print-pencilA', ...LN(0.85, c.soft), opacity: 0.55 }), P('', { 'data-ref': 'print-pencilB', ...LN(0.6, c.soft), opacity: 0.35 }));
  const unit = (ref, attrs) => h('rect', { 'data-ref': ref, x: 0, y: 0, width: 1, height: 1, ...attrs });
  const stitch = 'M-0.9 -5C-0.4 -1.5 0.6 1.5 0.9 5M-0.9 -5C-2 -5.4 -2.6 -4.2 -1.6 -3.6M0.9 5C2 5.4 2.6 4.2 1.6 3.6';
  const gutter = h('g', { id: 'print-gutter' },
    tag('gutter-shadow', {}, unit('print-gutT', { fill: 'url(#print-ggrad)' }), unit('print-gutP', { fill: 'url(#print-ggrad)', mask: 'url(#print-gmask)' }),
      unit('print-gutB', { fill: 'url(#print-ggrad)' })),
    tag('gutter-stitch', { 'data-ref': 'print-stitch' },
      P(stitch, { ...LN(1.9, c.pLo) }), P(stitch, { ...LN(1.1, c.pHi) }),
      P(tp(stitch, [1, 0, 0, 1, 0.6, 14]), { ...LN(1.9, c.pLo) }), P(tp(stitch, [1, 0, 0, 1, 0.6, 14]), { ...LN(1.1, c.pHi) })));

  // ---- running heads, page numbers, colophon ----
  const hl = text('鹈鹕湾 · Pelican Bay', { size: 9.5, align: 'center', track: 0.3 });
  const hr0 = text(headR(0), { size: 9.5, align: 'center', track: 0.3 });
  const heads = h('g', {},
    h('g', { 'data-ref': 'print-headL' }, tag('running-head-left', { 'data-text': '鹈鹕湾 · Pelican Bay' }, P(hl.d, { fill: c.soft }))),
    h('g', { 'data-ref': 'print-headR' }, tag('running-head-right', { 'data-text': headR(0), 'data-ref': 'print-headR-t' }, P(hr0.d, { fill: c.soft, 'data-ref': 'print-headR-d' }))));
  const pnZ = pageNum(zhNum(1), true), pnA = pageNum('1', false);
  const pnum = (k, pn, name) => h('g', { 'data-ref': 'print-pn' + k },
    tag(name, { 'data-ref': `print-pn${k}-t` }, P(pn.d, { 'data-ref': `print-pn${k}-d`, fill: c.line })),
    tag('page-flourish', {}, P(pn.stem, { 'data-ref': `print-pn${k}-stem`, ...LN(0.9, c.soft) }), P(pn.leaf, { 'data-ref': `print-pn${k}-leaf`, fill: c.leaf, stroke: c.line, 'stroke-width': 0.5 })));
  const colo = (() => {
    // pelican roundel: head, long bill with pouch, S-neck, in an oval with a double rule
    const pel = 'M-3.6 5.8C-4.8 2.6 -2.2 0.6 -2.6 -2.2C-3 -4.6 -1.4 -6.4 0.6 -6.2C2.2 -6.1 3 -5.1 3.2 -4.3L9.6 -2.4L3 -2.1C2 -2 0.8 -2.8 0.5 -3.6C-0.4 -1.2 1.6 1.4 1 4.4C0.6 5.8 -2.8 6.8 -3.6 5.8Z';
    const pouch = 'M3 -2.1L9 -2.3C7 -0.4 4.6 0.1 3.2 -1.2Z';
    const zh = text('鹈鹕湾出版社', { size: 8.4, x: 15, y: 3.1, track: 0.6 }), en = text('Pelican Bay Press', { size: 7.6, x: 15 + zh.w + 7, y: 3, track: 0.35 });
    return h('g', { 'data-ref': 'print-colo' }, tag('colophon', { 'data-text': '鹈鹕湾出版社 · Pelican Bay Press', transform: `translate(${f(-(15 + zh.w + 7 + en.w) / 2)} 0)` },
      P(ell(0, 0, 8.6, 8.6), { fill: c.pHi, ...{ stroke: c.line, 'stroke-width': 0.8 } }), P(ell(0, 0, 7, 7), { ...LN(0.4, c.soft) }),
      P(pel, { fill: c.line }), P(pouch, { fill: c.gold }), P(circ(1.2, -4.7, 0.45), { fill: c.pHi }),
      P(zh.d + en.d + circ(15 + zh.w + 3.5, 0, 0.9), { fill: c.soft })));
  })();

  // ---- spot illustrations (local, centred at 0,0; hand-wobbled once) ----
  const spots = (() => {
    const r = srand(41);
    // scallop shell: fan with ribs, hinge ears
    const fan = []; for (let i = 0; i <= 12; i++) { const a = Math.PI * (1.08 + 0.84 * i / 12), rr = 11 + (i % 2 ? -0.9 : 0.6); fan.push([Math.cos(a) * rr, 5 + Math.sin(a) * rr]); }
    const shellOut = cr([[-2.6, 7.2], ...fan, [2.6, 7.2], [0, 8.4]].map(([x, y]) => [x + sgn(r) * 0.3, y + sgn(r) * 0.3]), true);
    let ribs = ''; for (let i = 1; i < 7; i++) { const a = Math.PI * (1.12 + 0.76 * i / 7); ribs += `M0 7Q${f(Math.cos(a) * 5)} ${f(5 + Math.sin(a) * 5)} ${f(Math.cos(a) * 9.6)} ${f(5 + Math.sin(a) * 9.6)}`; }
    const ears = 'M-2.6 7.2L-5.4 8.6L-4.8 5.6ZM2.6 7.2L5.4 8.6L4.8 5.6Z';
    const shell = tag('spot-shell', {}, P(shellOut, { fill: c.sh, stroke: c.line, 'stroke-width': 0.9, 'stroke-linejoin': 'round' }),
      P(ears, { fill: c.shLo, stroke: c.line, 'stroke-width': 0.7, 'stroke-linejoin': 'round' }), P(ribs, LN(0.6, c.shLo)),
      P('M-7 -1.6Q-5 -4.6 -1.6 -5.2', { ...LN(1.1, c.pHi), opacity: 0.9 }));
    // fish bone: head, eye, spine, ribs, tail
    const head = 'M8 -0.2C9.5 -4.6 14.6 -5.2 17.6 -2.4C18.6 -1.4 18.6 0.8 17.6 1.8C14.6 4.6 9.5 4.2 8 -0.2Z';
    let rib = ''; for (let i = 0; i < 5; i++) { const x = 5 - i * 3.3; rib += `M${f(x)} -0.2Q${f(x - 1)} ${f(-3.2 + i * 0.25)} ${f(x - 2.4)} ${f(-4.6 + i * 0.4)}M${f(x)} -0.2Q${f(x - 1)} ${f(2.8 - i * 0.25)} ${f(x - 2.4)} ${f(4.2 - i * 0.4)}`; }
    const tail = 'M-12.6 -0.2L-17 -4.4Q-15.4 -0.2 -17 4L-12.6 -0.2Z';
    const bone = tag('spot-fishbone', {}, P(wob([[8, -0.2], [0, 0.2], [-8, -0.4], [-12.6, -0.2]], r, 0.25), LN(1.3)), P(rib, LN(0.9)),
      P(head, { fill: c.bone, stroke: c.line, 'stroke-width': 1 }), P(tail, { fill: c.bone, stroke: c.line, 'stroke-width': 0.9, 'stroke-linejoin': 'round' }),
      P(circ(13.6, -1, 1.1), { fill: c.line }), P('M10.6 1.6Q12.6 2.8 15 2', LN(0.6)));
    // golden star + twinkles
    const sp = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 4.2 : 9.4; sp.push([Math.cos(a) * rr + sgn(r) * 0.3, Math.sin(a) * rr + sgn(r) * 0.3]); }
    const starP = 'M' + sp.map(p => p.map(f).join(' ')).join('L') + 'Z';
    const star = tag('spot-star', {}, P(starP, { fill: c.gold, stroke: c.line, 'stroke-width': 1, 'stroke-linejoin': 'round' }),
      P('M-2 -4.2L-0.6 -6.8', LN(1, c.pHi)), P(star4(13, -7, 3.4) + star4(-12.5, 5, 2.6), { fill: c.gold, stroke: c.line, 'stroke-width': 0.6 }));
    // pelican feather: vane + rachis + barbs
    const vane = cr([[-16, 0.4], [-8, -4.2], [4, -5.4], [14, -2.4], [17, 0.2], [13, 2.8], [2, 4.4], [-9, 3.4]], true);
    let barbs = ''; for (let i = 0; i < 9; i++) { const x = -11 + i * 3; barbs += `M${f(x)} ${f(0.1)}Q${f(x + 2)} ${f(-2)} ${f(x + 3.6)} ${f(-3.6 + Math.abs(i - 4) * 0.25)}M${f(x)} 0.2Q${f(x + 2)} 1.8 ${f(x + 3.4)} ${f(3.2 - Math.abs(i - 4) * 0.2)}`; }
    const feather = tag('spot-feather', {}, P(vane, { fill: c.bone, stroke: c.line, 'stroke-width': 0.8 }), P('M-12 1.5Q-4 -1.2 8 -1.4', { ...LN(1.2, c.pLo), opacity: 0.8 }),
      P(barbs, { ...LN(0.45, c.soft), opacity: 0.8 }), P('M-21 1.6Q-10 0.6 16 -0.3', LN(0.8)), P('M-7 -3.4L-6 -1.4M3 -4.3L3.6 -2', LN(0.6)));
    // paper boat on a wavelet
    const boat = tag('spot-boat', {}, P('M-12 1L12 1L8 6.2L-8 6.2Z', { fill: c.pHi, stroke: c.line, 'stroke-width': 0.9, 'stroke-linejoin': 'round' }),
      P('M-6.6 1L0 -9.6L6.6 1Z', { fill: c.pp, stroke: c.line, 'stroke-width': 0.9, 'stroke-linejoin': 'round' }), P('M0 -9.6L0 1M-3.4 -3.8L0 1', LN(0.5, c.soft)),
      P('M-16 8.4Q-12 5.8 -8 8.4T0 8.4T8 8.4T16 8.4', LN(1.1, c.sea)));
    // a child's crayon heart (drawn twice round, a tick beside it)
    const heart = t => `M0 ${f(3.8 + t)}C${f(-6 - t)} ${f(-0.2)} ${f(-6.4 - t)} ${f(-6.6 - t)} ${f(-2.4)} ${f(-6.4 - t * 0.5)}C${f(-0.8)} ${f(-6.3)} 0 ${f(-4.8)} 0 ${f(-3.6 + t * 0.4)}C0 ${f(-4.8)} ${f(0.9)} ${f(-6.4 - t)} ${f(2.6 + t * 0.3)} ${f(-6.4)}C${f(6.6 + t)} ${f(-6.2)} ${f(6 + t)} ${f(-0.4)} 0 ${f(3.8 + t)}`;
    const crayon = tag('crayon-heart', {}, P(heart(0) + heart(0.9), { ...LN(1.3, c.rb), opacity: 0.85 }), P('M9 -1L11 2L16 -5', { ...LN(1.1, c.leaf), opacity: 0.85 }));
    // thumbprint: concentric wobbly loops
    let tpd = ''; for (let i = 0; i < 6; i++) { const rx = 2 + i * 1.25, ry = 2.8 + i * 1.55, pts = []; for (let k = 0; k < 11; k++) { const a = k / 11 * Math.PI * 2 * 0.92 + i; pts.push([Math.cos(a) * rx + sgn(r) * 0.2, Math.sin(a) * ry + sgn(r) * 0.2]); } tpd += cr(pts, false); }
    const thumb = tag('thumbprint', {}, P(tpd, { ...LN(0.75, c.mauve), opacity: 0.4 }));
    const g = (k, el) => h('g', { 'data-ref': 'print-sp-' + k }, el);
    return [g('shell', shell), g('bone', bone), g('star', star), g('feather', feather), g('boat', boat), g('heart', crayon), g('thumb', thumb)];
  })();

  // ---- corner curl (bottom-right page corner at 0,0; the page lies toward -x,-y) ----
  const A = 40;
  const curl = h('g', { 'data-ref': 'print-curl' }, h('g', { 'data-ref': 'print-curl-in' }, tag('corner-curl', {},
    P(`M0 0L${-A} 0L0 ${-A}Z`, { fill: c.edge }),
    P(`M${-A + 4} -1.5L-1.5 ${-A + 4}M${-A + 9} -1.5L-1.5 ${-A + 9}`, { ...LN(0.4, c.soft), opacity: 0.6 }),
    P(`M${-A} 0C${-A * 0.86} ${-A * 0.34} ${-A * 0.8} ${-A * 0.6} ${-A * 0.68} ${-A * 0.72}C${-A * 0.58} ${-A * 0.82} ${-A * 0.34} ${-A * 0.88} 0 ${-A}Z`, { fill: c.mauve, opacity: 0.28, transform: 'translate(-4 -3.5)' }),
    P(`M${-A} 0C${-A * 0.88} ${-A * 0.34} ${-A * 0.82} ${-A * 0.6} ${-A * 0.7} ${-A * 0.7}C${-A * 0.6} ${-A * 0.82} ${-A * 0.34} ${-A * 0.88} 0 ${-A}Z`, { fill: 'url(#print-curl)', stroke: c.line, 'stroke-width': 0.9, 'stroke-linejoin': 'round' }),
    P(`M${-A * 0.84} ${-A * 0.2}Q${-A * 0.66} ${-A * 0.62} ${-A * 0.2} ${-A * 0.84}`, { ...LN(0.7, c.pLo), opacity: 0.8 }))));

  // ---- bookmark ribbon: local end at y = 0 (the swallowtail), runs up 460 u under the top edge ----
  const ribbon = (() => {
    const W = RIBBON.w, cx = y => 1.8 * Math.sin(y / 70) + 0.6 * Math.sin(y / 23);
    const side = (x0) => { const pts = []; for (let y = -460; y <= -9; y += 20) pts.push([x0 + cx(y), y]); return pts; };
    const Lp = side(-W / 2), Rp = side(W / 2);
    const out = cr([...Lp, [-W / 2 + cx(0), 0], [cx(-9), -9.5], [W / 2 + cx(0), 0], ...Rp.reverse()], false) + 'Z';
    const shade = cr(side(-W / 2 + 0.8).concat([[-W / 2 + 1 + cx(0), -1], [-W / 2 + 4.6 + cx(-4), -5.2]]).concat(side(-W / 2 + 4.8).reverse()), false) + 'Z';
    const shine = cr(side(W / 2 - 4.4), false);
    const fray = `M${f(-W / 2 + cx(0))} 0l-1 3.4M${f(-W / 2 + 2 + cx(0))} -1.8l-.4 3.6M${f(W / 2 + cx(0))} 0l1 3.4M${f(W / 2 - 2 + cx(0))} -1.8l.4 3.6`;
    return h('g', { 'data-ref': 'print-ribbon' },
      P(out, { fill: c.mauve, opacity: 0.3, transform: 'translate(3.5 2.5)' }),
      tag('bookmark-ribbon', {}, P(out, { fill: c.rb, stroke: c.rbLo, 'stroke-width': 0.9, 'stroke-linejoin': 'round' }), P(fray, LN(0.7, c.rbLo))),
      tag('ribbon-sheen', {}, P(shade, { fill: c.rbLo, opacity: 0.55 }), P(shine, { ...LN(1.6, c.rbHi), opacity: 0.8 }),
        P(cr(side(0.5).filter((_, i) => i % 3 === 1), false), { ...LN(0.6, c.rbHi), opacity: 0.35 })));
  })();

  // ---- title card ----
  const titleWord = (k, str, font, size, seed, x0 = 0) => {
    const r = srand(seed); let pen = x0; const gl = [];
    for (const ch of str) {
      const a = advOf(font, ch) * size / 1000;
      const rot = sgn(r) * 2.4, dy = sgn(r) * 2.6, s = 1 + sgn(r) * 0.025;
      const k0 = size / 1000 * s, rr = rot * Math.PI / 180, c0 = Math.cos(rr), s0 = Math.sin(rr), cx = pen + a / 2;
      gl.push({ d: tp(font[ch][1], [c0 * k0, s0 * k0, -s0 * k0, c0 * k0, cx - c0 * a / 2, dy - s0 * a / 2]), cx, a });
      pen += a + (font === ZH ? 5 : 0);
    }
    return gl;
  };
  const glyphG = (k, i, g, zh) => h('g', { 'data-ref': `print-gl-${k}${i}` },
    tag('title-shadow', {}, P(g.d, { fill: c.mauve, stroke: c.mauve, 'stroke-width': zh ? 5 : 7, 'stroke-linejoin': 'round', opacity: 0.6, transform: 'translate(5 6)' })),
    tag(zh ? 'title-zh' : 'title-lettering', {}, P(g.d, { fill: zh ? c.rb : c.ti, stroke: c.line, 'stroke-width': zh ? 4.6 : 6.5, 'stroke-linejoin': 'round', 'paint-order': 'stroke' })),
    zh ? '' : tag('title-gouache', {}, P(g.d, { fill: 'url(#print-brush)' })),
    tag('title-pencil', {}, P(g.d, { fill: 'none', stroke: zh ? c.pHi : c.soft, 'stroke-width': zh ? 0.9 : 1.1, opacity: zh ? 0.7 : 0.6, transform: zh ? 'translate(-1.4 -1.2)' : 'translate(-2.4 -1.8)' })));
  const G1 = titleWord('a', 'Pelican', LAT, TS, 101), G2 = titleWord('b', 'Bay', LAT, TS, 202), GZ = titleWord('z', '鹈鹕湾', ZH, ZS, 303);
  const tw = (k, G, zh, extra = '') => G.map((g, i) => glyphG(k, i, g, zh)).join('') + extra;
  const twinkle = (ref, x, y, r) => h('g', { 'data-ref': ref, transform: `translate(${x} ${y})` },
    P(star4(0, 0, r), { fill: c.gold, stroke: c.line, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }), P(star4(0, 0, r * 0.35), { fill: c.pHi }));
  const w1 = h('g', { 'data-ref': 'print-w1', 'data-text': 'Pelican' }, tw('a', G1, false), tag('title-twinkles', {}, twinkle('print-tw0', -20, -78, 10)));
  const w2 = h('g', { 'data-ref': 'print-w2', 'data-text': 'Bay' }, tw('b', G2, false), tag('title-twinkles', {}, twinkle('print-tw1', W2 + 22, -66, 13), twinkle('print-tw2', W2 + 40, -30, 7)));
  const zhG = h('g', { 'data-ref': 'print-zh', 'data-text': '鹈鹕湾' }, tw('z', GZ, true));
  // swash under 鹈鹕湾: tapered yellow gouache stroke with streaks, a wave curl at the end
  const SWL = ZHW + 18;
  const swC = t => [lerp(-6, SWL, t), 13 + Math.sin(t * Math.PI * 1.1) * 3.2 - t * 2];
  const swash = brush(swC, t => 5.4 * Math.sin(Math.PI * Math.min(1, t * 1.05)) ** 0.55 + 0.3, 28);
  const curlD = `M${f(SWL - 2)} 9C${f(SWL + 8)} 3 ${f(SWL + 16)} 10 ${f(SWL + 11)} 15C${f(SWL + 7)} 18 ${f(SWL + 3)} 13 ${f(SWL + 8)} 11`;
  defs.push(h('clipPath', { id: 'print-swclip' }, h('rect', { 'data-ref': 'print-swwipe', x: -14, y: -10, width: SWL + 40, height: 40 })));
  const sw = h('g', { 'data-ref': 'print-sw' }, h('g', { 'clip-path': 'url(#print-swclip)' }, tag('title-swash', {},
    P(swash, { fill: c.gold, stroke: c.line, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }),
    P(brush(t => [lerp(4, SWL - 14, t), 12 + Math.sin(t * Math.PI * 1.1) * 3 - t * 2], t => 1 * Math.sin(Math.PI * t), 12), { fill: c.pHi, opacity: 0.75 }),
    P(brush(t => [lerp(10, SWL - 30, t), 15.5 + Math.sin(t * Math.PI * 1.1) * 3 - t * 2], t => 0.8 * Math.sin(Math.PI * t), 12), { fill: c.goldLo, opacity: 0.8 }),
    P(curlD, LN(2.2, c.line)))));
  const subT = text(SUB_TXT, { size: SUBS, zs: 0.95, jit: srand(404), rotJ: 1.2, dyJ: 0.04 });
  const sub = h('g', { 'data-ref': 'print-sub' }, tag('title-subtitle', { 'data-text': SUB_TXT }, P(subT.d, { fill: c.line })));
  // chapter plate: notched corners, double rule, sprigs
  const n = 8, plateOut = `M${n} 0H${PW - n}Q${PW - n} ${n} ${PW} ${n}V${PH - n}Q${PW - n} ${PH - n} ${PW - n} ${PH}H${n}Q${n} ${PH - n} 0 ${PH - n}V${n}Q${n} ${n} ${n} 0Z`;
  const plateIn = `M${n + 3} 4H${PW - n - 3}Q${PW - n - 2} ${n + 2} ${PW - 4} ${n + 3}V${PH - n - 3}Q${PW - n - 2} ${PH - n - 2} ${PW - n - 3} ${PH - 4}H${n + 3}Q${n + 2} ${PH - n - 2} 4 ${PH - n - 3}V${n + 3}Q${n + 2} ${n + 2} ${n + 3} 4Z`;
  const sprig = (x, dir) => ({
    stem: `M${f(x)} ${PH / 2}C${f(x + dir * 8)} ${PH / 2 - 2} ${f(x + dir * 14)} ${PH / 2 - 6} ${f(x + dir * 22)} ${PH / 2 - 5}M${f(x + dir * 9)} ${PH / 2 - 1.6}C${f(x + dir * 14)} ${PH / 2 + 3} ${f(x + dir * 18)} ${PH / 2 + 5} ${f(x + dir * 23)} ${PH / 2 + 4}`,
    leaf: [[10, -3, -35], [17, -6.5, -15], [15, 3.4, 30], [21, 4.8, 10]].map(([dx, dy, a]) => {
      const X = x + dir * dx, Y = PH / 2 + dy, rr = (dir > 0 ? a : 180 - a) * Math.PI / 180, L = 7;
      return `M${f(X)} ${f(Y)}Q${f(X + Math.cos(rr - 0.5) * L * 0.6)} ${f(Y + Math.sin(rr - 0.5) * L * 0.6)} ${f(X + Math.cos(rr) * L)} ${f(Y + Math.sin(rr) * L)}Q${f(X + Math.cos(rr + 0.5) * L * 0.6)} ${f(Y + Math.sin(rr + 0.5) * L * 0.6)} ${f(X)} ${f(Y)}Z`;
    }).join(''),
    berry: circ(x + dir * 24.5, PH / 2 - 5.4, 1.9) + circ(x + dir * 25, PH / 2 + 4, 1.6),
  });
  const sA = sprig(-1, -1), sB = sprig(PW + 1, 1), pt0 = plateText(0);
  const plate = h('g', { 'data-ref': 'print-plate' }, h('g', { 'data-ref': 'print-plate-in' },
    tag('plate-sprigs', {}, P(sA.stem + sB.stem, LN(1.1, c.line)), P(sA.leaf + sB.leaf, { fill: c.leaf, stroke: c.line, 'stroke-width': 0.7 }), P(sA.berry + sB.berry, { fill: c.rb, stroke: c.line, 'stroke-width': 0.6 })),
    tag('chapter-plate', { 'data-text': 'Chapter One · 第一章', 'data-ref': 'print-plate-t' },
      P(plateOut, { fill: c.mauve, opacity: 0.35, transform: 'translate(3 3.5)' }),
      P(plateOut, { fill: c.pHi, stroke: c.line, 'stroke-width': 1.7, 'stroke-linejoin': 'round' }), P(plateIn, { ...LN(0.8, c.soft) }),
      P(pt0.zh + pt0.dot, { 'data-ref': 'print-plate-zh', fill: c.rb }), P(pt0.en, { 'data-ref': 'print-plate-en', fill: c.line }))));
  const title = h('g', { id: 'print-title', 'data-ref': 'print-title' }, plate, sub, sw, zhG, w1, w2);

  // ---- captions: on a gouache patch (poster) and printed on the margin (cinematic bar) ----
  const pg0 = pageOf(0, false), cl0 = captionLayout(pg0, 'line'), cb0 = captionLayout(pg0, 'bar');
  const capG = (k, L, patch) => h('g', { 'data-ref': 'print-' + k, 'data-text': `${pg0.headZh} · ${pg0.headEn} · ${pg0.zh} ${pg0.en}` }, h('g', { 'data-ref': `print-${k}-in` },
    patch ? P(L.patch, { 'data-ref': `print-${k}-sh`, fill: c.mauve, opacity: 0.22, transform: 'translate(4 5)' }) : '',
    patch ? tag('caption-patch', {}, P(L.patch, { 'data-ref': `print-${k}-patch`, fill: c.paper, opacity: 0.94 })) : '',
    patch ? tag('caption-wash', {}, P(L.streak, { 'data-ref': `print-${k}-wash`, fill: c.pLo, opacity: 0.4 })) : '',
    tag('caption-header', {}, P(L.head, { 'data-ref': `print-${k}-head`, fill: c.soft })),
    tag('caption-divider', {}, P(L.div, { 'data-ref': `print-${k}-div`, ...LN(1, c.soft) }), P(L.flw, { 'data-ref': `print-${k}-flw`, fill: c.rb, stroke: c.line, 'stroke-width': 0.5 })),
    tag('caption-zh', {}, P(L.zh, { 'data-ref': `print-${k}-zh`, fill: c.line })),
    tag('caption-en', {}, P(L.en, { 'data-ref': `print-${k}-en`, fill: c.line })),
    tag('caption-initial', {}, P(L.ini, { 'data-ref': `print-${k}-ini`, fill: c.rb, stroke: c.line, 'stroke-width': 0.6 }))));
  const captions = h('g', { id: 'print-captions' }, capG('cap', cl0, true), capG('bar', cb0, false));

  const lampGlow = h('ellipse', { 'data-ref': 'print-lampglow', cx: 0, cy: 0, rx: 1, ry: 1, fill: 'url(#print-lamp)', style: 'opacity:var(--pb-n-lampOn)', 'pointer-events': 'none' });
  const root = h('g', { id: 'print-root', 'data-ref': 'print-root' },
    lampGlow, margins, gutter, pencil, rim, heads, pnum('Z', pnZ, 'page-number-zh'), pnum('A', pnA, 'page-number-arabic'), colo,
    h('g', { id: 'print-spots' }, spots), curl, ribbon, captions, title);
  return { defs: defs.join(''), layers: { 'L-letterbox': root } };
}

// ------------------------------------------------------------------ runtime
// free rectangles of `area` around obstacles (maximal-rectangle split)
function freeRects(area, obs) {
  let rs = [area];
  for (const o of obs) {
    if (!o) continue;
    const next = [];
    for (const r of rs) {
      if (!(o[0] < r[2] && o[2] > r[0] && o[1] < r[3] && o[3] > r[1])) { next.push(r); continue; }
      if (o[0] > r[0]) next.push([r[0], r[1], o[0], r[3]]);
      if (o[2] < r[2]) next.push([o[2], r[1], r[2], r[3]]);
      if (o[1] > r[1]) next.push([r[0], r[1], r[2], o[1]]);
      if (o[3] < r[3]) next.push([r[0], o[3], r[2], r[3]]);
    }
    rs = next.filter(r => r[2] - r[0] > 24 && r[3] - r[1] > 20);
  }
  return rs;
}
// best placement of boxes (w×h at scale 1, weight k) among rects -> {i, S, X, Y} (top-left in screen units)
function placeBox(boxes, rects, maxS, right) {
  let best = null;
  boxes.forEach(([bw, bh, k], i) => {
    for (const r of rects) {
      const s = Math.min(maxS, (r[2] - r[0]) / bw, (r[3] - r[1]) / bh);
      if (s <= 0) continue;
      const score = s * k - r[1] * 1e-4 + (right ? r[2] : -r[0]) * 1e-5;
      if (!best || score > best.score) best = { i, score, S: s, X: right ? r[2] - bw * s : r[0], Y: r[1] };
    }
  });
  return best;
}
const hit = (a, b) => a && b && a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

export function attach(svg) {
  const doc = svg.ownerDocument, view = doc.defaultView;
  const R = {};
  for (const el of svg.querySelectorAll('[data-ref^="print-"]')) R[el.getAttribute('data-ref').slice(6)] = el;
  // draw above the lead's plain letterbox rects: the paper margin IS the letterbox in the picture book
  const host = svg.querySelector('#L-letterbox');
  if (R.root && host) host.appendChild(R.root);

  const cache = new Map();
  const set = (el, name, val) => { if (!el) return; let c = cache.get(el); if (!c) cache.set(el, c = {}); if (c[name] !== val) { c[name] = val; el.setAttribute(name, val); } };

  // visible viewBox rectangle (preserveAspectRatio slice)
  let V = { x0: 0, y0: 0, x1: VIEW.w, y1: VIEW.h, w: VIEW.w, h: VIEW.h };
  const measureV = () => {
    const r = svg.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const s = Math.max(r.width / VIEW.w, r.height / VIEW.h), w = r.width / s, hh = r.height / s;
    V = { x0: VIEW.cx - w / 2, y0: VIEW.cy - hh / 2, x1: VIEW.cx + w / 2, y1: VIEW.cy + hh / 2, w, h: hh, left: r.left, top: r.top, s };
  };
  measureV();
  // the UI control card (an HTML overlay that docks to a free corner): title and caption keep clear of it
  let uiBox = null, uiAt = -1e9;
  const measureUI = force => {
    const now = view.performance.now();
    if (!force && now - uiAt < 400) return;
    uiAt = now; uiBox = null;
    const el = doc.getElementById('ui-card');
    if (!el || !el.getClientRects().length || !V.s) return;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    const X = px => V.x0 + (px - V.left) / V.s, Y = py => V.y0 + (py - V.top) / V.s;
    uiBox = [X(r.left) - 10, Y(r.top) - 10, X(r.right) + 10, Y(r.bottom) + 10];
  };
  view.addEventListener('resize', measureV);
  // live: measure the card at the START of a frame (registered before the runtime's loop), when layout is clean
  const early = () => { measureUI(false); view.requestAnimationFrame(early); };
  view.requestAnimationFrame(early);

  // skip the intro on any key / click (deterministic: the skip is pinned to the sim time it happened at)
  let skipReq = false, skipAt = Infinity, lastT = 0, lastSig = '', rimKey = '', pencilKey = '';
  const skip = () => { skipReq = true; };
  doc.addEventListener('keydown', skip, true);
  doc.addEventListener('pointerdown', skip, true);

  const riderBox = (cam, pose, pad = 14 + Math.abs(cam.roll || 0) * 8) => {
    const z = cam.zoom, oy = GROUND_Y + (pose ? pose.riderY || 0 : 0);
    const X = x => VIEW.cx + z * (x - cam.fx), Y = y => VIEW.cy + z * (y - cam.fy);
    return [X(RIDER_X - 262) - pad, Y(oy - 572) - pad, X(RIDER_X + 305) + pad, Y(oy + 6) + pad];
  };

  // runtime text caches (a stretch / lap change rebuilds a few paths, once)
  const capCache = new Map();
  const capFor = (pg, mode) => { const k = pg.key + mode; let L = capCache.get(k); if (!L) { if (capCache.size > 40) capCache.clear(); capCache.set(k, L = captionLayout(pg, mode)); } return L; };
  let curCap = { cap: '', bar: '' }, curLap = 0, curPn = '';
  const fillCap = (k, L, pg) => {
    if (curCap[k] === pg.key + L.w) return;
    curCap[k] = pg.key + L.w;
    if (L.patch !== undefined) { set(R[k + '-sh'], 'd', L.patch); set(R[k + '-patch'], 'd', L.patch); set(R[k + '-wash'], 'd', L.streak); }
    for (const p of ['head', 'div', 'flw', 'zh', 'en', 'ini']) set(R[`${k}-${p}`], 'd', L[p === 'ini' ? 'ini' : p]);
    set(R[k], 'data-text', `${pg.headZh} · ${pg.headEn} · ${pg.zh} ${pg.en}`);
  };

  return {
    update(frame) {
      const t = frame.t, cam = frame.cam || { zoom: 1, fx: 800, fy: 450, letterbox: 0 };
      if (t + 1e-6 < lastT && t < skipAt) skipAt = Infinity;   // replay from earlier: the intro plays again
      lastT = t;
      if (skipReq) { skipReq = false; if (t < 4.2) skipAt = Math.min(skipAt, t); }
      const reduced = frame.reduced;
      const lb = Math.max(0, cam.letterbox || 0);
      const kc = easeInOut(clamp01((lb - MB) / (LB_MAX - MB)));      // 0 page → 1 cinematic book edges
      if (frame.dt === 0) measureUI(true);
      const ti = t >= skipAt ? 99 : t;
      // the page: which stretch / lap, and the caption fade across stretch boundaries (pure function of distance)
      const D = frame.distance || 0, night = (frame.night || 0) > 0.6;
      const pg = pageOf(D, night), p = lapPos(D);
      let capA = Math.min(clamp01((pg.s.b - p) / 1500), pg.lap === 0 && pg.s.i === 0 ? clamp01((ti - 1.85) / 0.5) : clamp01((p - pg.s.a) / 1800));
      if (reduced) capA = capA > 0.5 ? 1 : 0;
      const turn = clamp01((p - pg.s.a) / 2400);          // the corner curl lifts as the page turns
      const rb = riderBox(cam, frame.pose), rbQ = rb.map(x => Math.round(x / 6));
      const sig = [V.w, V.h, V.x0, V.y0, f(lb), ti >= 4.3 ? 'post' : f(ti), reduced ? 1 : 0, rbQ.join(), uiBox ? uiBox.map(Math.round).join() : '',
        pg.key, f(capA), turn < 1 ? f(turn) : 1].join('|');
      if (sig === lastSig) return;
      lastSig = sig;

      // ---- page geometry: margins shrink where the rider would otherwise be covered (close camera) ----
      const rTop = riderBox(cam, frame.pose, 0)[1], rBot = riderBox(cam, frame.pose, -2)[3];
      const mT = Math.max(RIM + 2, Math.min(MT, rTop - 3 - V.y0)), mB = Math.max(RIM + 2, Math.min(MB, V.y1 - rBot));
      const yT = V.y0 + Math.max(mT, lb), yB = V.y1 - Math.max(mB, lb), xL = V.x0 + MS, xR = V.x1 - MS;
      const cx = (V.x0 + V.x1) / 2, cy = (yT + yB) / 2;
      set(R.mT, 'transform', `translate(0 ${f(yT)})`); set(R.mB, 'transform', `translate(0 ${f(yB)})`);
      set(R.mL, 'transform', `translate(${f(xL)} 0)`); set(R.mR, 'transform', `translate(${f(xR)} 0)`);
      set(R.fibre, 'transform', `translate(${f(V.x0)} ${f(V.y0)}) scale(${f(V.w)} ${f(V.h)})`);
      // rim (cloth + page stack + deckle) along the four screen edges: rebuilt only when the view changes
      const rk = [V.x0, V.y0, V.w, V.h].map(Math.round).join();
      if (rk !== rimKey) {
        rimKey = rk;
        const E = { T: [V.x0, V.x1, 0], B: [V.x0, V.x1, 1], L: [V.y0, V.y1, 2], R: [V.y0, V.y1, 3] };
        for (const [k, [a, b, i]] of Object.entries(E)) {
          const d = rimD(Math.floor(a) - 20, Math.ceil(b) + 20, 90 + i);
          for (const part of ['cloth', 'band', 'lines', 'deck']) set(R[`rim${k}-${part}`], 'd', d[part]);
          set(R[`rim${k}-weave`], 'd', d.cloth);
        }
      }
      set(R.rimT, 'transform', `translate(0 ${f(V.y0)})`);
      set(R.rimB, 'transform', `translate(0 ${f(V.y1)}) scale(1 -1)`);
      set(R.rimL, 'transform', `translate(${f(V.x0)} 0) matrix(0 1 1 0 0 0)`);
      set(R.rimR, 'transform', `translate(${f(V.x1)} 0) matrix(0 1 -1 0 0 0)`);
      // pencil frame
      const pk = [xL, yT, xR, yB].map(x => Math.round(x * 2)).join();
      if (pk !== pencilKey) {
        pencilKey = pk;
        const pd = pencilD(xL, yT, xR, yB, { t: yT - V.y0 > 18, b: V.y1 - yB > 18 });
        set(R.pencilA, 'd', pd.a); set(R.pencilB, 'd', pd.b);
      }
      // gutter: margins full strength; over the picture only down to above the rider, fading
      const GW = 64;
      const ur = (el, x, y, w, hh) => { set(el, 'transform', `translate(${f(x)} ${f(y)}) scale(${f(w)} ${f(Math.max(0.01, hh))})`); set(el, 'opacity', hh > 1 ? 1 : 0); };
      ur(R.gutT, cx - GW / 2, V.y0, GW, yT - V.y0 + 1);
      ur(R.gutB, cx - GW / 2, yB - 1, GW, V.y1 - yB + 1);
      const gEnd = Math.min(rb[1] - 24, yT + 300);
      ur(R.gutP, cx - GW / 2, yT, GW, (cx > rb[0] - GW && cx < rb[2] + GW) ? gEnd - yT : yB - yT - 40);
      set(R.stitch, 'transform', `translate(${f(cx)} ${f(V.y0 + RIM + 6)})`);
      set(R.stitch, 'opacity', yT - V.y0 > 30 ? 1 : 0);

      // ---- margin furniture ----
      const topMid = (V.y0 + RIM + yT) / 2, botMid = (yB + V.y1 - RIM) / 2;
      const topOn = yT - V.y0 > 19 ? 1 : 0, botOn = V.y1 - yB > 24 ? 1 : 0;
      const halfW = (xR - xL) / 2;
      const headS = Math.min(1, (halfW - 70) / 250);
      set(R.headL, 'transform', `translate(${f(xL + halfW / 2 + 10)} ${f(V.y0 + RIM + 11.5)}) scale(${f(Math.max(0.5, headS))})`);
      set(R.headR, 'transform', `translate(${f(cx + halfW / 2 - 10)} ${f(V.y0 + RIM + 11.5)}) scale(${f(Math.max(0.5, headS))})`);
      set(R.headL, 'opacity', topOn && headS > 0.5 ? 1 : 0); set(R.headR, 'opacity', topOn && headS > 0.5 ? 1 : 0);
      if (pg.lap !== curLap) {
        curLap = pg.lap;
        const hr = text(headR(pg.lap), { size: 9.5, align: 'center', track: 0.3 });
        set(R['headR-d'], 'd', hr.d); set(R['headR-t'], 'data-text', headR(pg.lap));
        const pt = plateText(pg.lap);
        set(R['plate-zh'], 'd', pt.zh + pt.dot); set(R['plate-en'], 'd', pt.en);
        const ch = chapterOf(pg.lap); set(R['plate-t'], 'data-text', `${ch.en} · ${ch.zh}`);
      }
      if (curPn !== String(pg.n)) {
        curPn = String(pg.n);
        for (const [k, s, zh] of [['Z', zhNum(pg.n), true], ['A', String(pg.n), false]]) {
          const pn = pageNum(s, zh);
          set(R[`pn${k}-d`], 'd', pn.d); set(R[`pn${k}-stem`], 'd', pn.stem); set(R[`pn${k}-leaf`], 'd', pn.leaf);
          set(R[`pn${k}-t`], 'data-text', s);
        }
      }
      const pnY = kc > 0.5 ? V.y1 - RIM - 14 : botMid + 5;
      set(R.pnZ, 'transform', `translate(${f(xL + 34)} ${f(pnY)})`); set(R.pnA, 'transform', `translate(${f(xR - 34)} ${f(pnY)})`);
      set(R.pnZ, 'opacity', botOn); set(R.pnA, 'opacity', botOn);
      set(R.colo, 'transform', `translate(${f(cx + halfW / 2)} ${f(kc > 0.5 ? V.y1 - RIM - 14 : botMid + 1)})`);
      set(R.colo, 'opacity', botOn && halfW > 330 ? 1 : 0);
      const sp = (k, x, y, s, on, rot = 0) => { set(R['sp-' + k], 'transform', `translate(${f(x)} ${f(y)}) rotate(${rot}) scale(${f(s)})`); set(R['sp-' + k], 'opacity', on ? 1 : 0); };
      const sb = Math.min(1, (V.y1 - yB - RIM) / 24);
      sp('shell', xL + 72, botMid + 1.5, Math.max(0.6, sb), botOn, -12);
      sp('star', xR - 74, botMid + 0.5, Math.max(0.6, sb), botOn, 8);
      sp('boat', xL + halfW / 2, botMid + 0.5, Math.max(0.6, sb), botOn && halfW > 300 && kc < 0.5);
      sp('heart', xR - 118, botMid + 1, Math.max(0.6, sb), botOn && halfW > 380, -6);
      const st = Math.min(1, (yT - V.y0 - RIM) / 16);
      sp('bone', xL + 44, topMid + 0.5, Math.max(0.55, st * 0.9), topOn, -4);
      sp('feather', xR - 64, topMid + 0.5, Math.max(0.55, st * 0.9), topOn && halfW > 260, 5);
      sp('thumb', V.x0 + RIM + (MS - RIM) / 2 + 1, cy + (yB - yT) * 0.28, 1, V.h > 500, 14);
      // curled corner (bottom right of the page); it lifts a little higher as a new page arrives
      const lift = reduced ? 1 : 1 + 0.45 * Math.sin(Math.PI * clamp01(turn * 1.6)) * (pg.s.i || pg.lap ? 1 : 0);
      set(R.curl, 'transform', `translate(${f(V.x1 - RIM + 1)} ${f(V.y1 - RIM + 1)}) scale(${f(Math.min(1, (V.y1 - yB) / 30 + 0.4) * lift)})`);
      // night: the bedside lamp's warm pool over the top-left of the page
      set(R.lampglow, 'transform', `translate(${f(V.x0 + 140)} ${f(V.y0 + 90)}) scale(${f(V.w * 0.42)} ${f(V.h * 0.5)})`);

      // ---- ribbon: hangs from the top edge into the picture, clear of the rider and the UI ----
      const rbX = xR - 150 - (V.w < 900 ? 0 : 20);
      let rEnd = yT + RIBBON.len;
      const rBox = [rbX - 12, V.y0, rbX + 12, rEnd + 6];
      if (hit(rBox, rb)) rEnd = Math.max(yT + 6, Math.min(rEnd, rb[1] - 6));
      set(R.ribbon, 'transform', `translate(${f(rbX)} ${f(rEnd)})`);
      const ribbonBox = [rbX - 14, V.y0, rbX + 16, rEnd + 8];

      // ---- title card: placed in the free space around the rider (and the UI card) ----
      const area = [xL + 14, yT + 12, xR - 14, yB - 12];
      const obs = [rb, uiBox, ribbonBox];
      const rects = freeRects(area, obs);
      const LB = k => LAYOUTS[k].box, bw = k => LB(k)[2] - LB(k)[0], bh = k => LB(k)[3] - LB(k)[1];
      const pc = placeBox([[bw('line'), bh('line'), 1], [bw('stack'), bh('stack'), LAYOUTS.stack.k]], rects, 0.92, false)
        || { i: 0, S: 0.3, X: area[0], Y: area[1] };
      const cardName = pc.i ? 'stack' : 'line';
      const cardP = { name: cardName, S: pc.S, X: pc.X - LB(cardName)[0] * pc.S, Y: pc.Y - LB(cardName)[1] * pc.S };
      const lrects = freeRects([xL + 12, yT + 10, xR - 12, Math.min(yT + 10 + 44, yB)], obs);
      const pl = placeBox([[bw('logo'), bh('logo'), 1]], lrects, 0.3, false) || { S: 0.22, X: xL + 12, Y: yT + 10 };
      const logoP = { name: 'logo', S: pl.S, X: pl.X - LB('logo')[0] * pl.S, Y: pl.Y - LB('logo')[1] * pl.S };
      const barH = lb - (RIM + 22) - 12;
      const bS = Math.max(0.05, Math.min(0.5, barH / bh('logo'), (halfW * 1.2) / bw('logo')));
      const barP = { name: 'logo', S: bS, X: xL + 20 - LB('logo')[0] * bS, Y: V.y0 + RIM + 22 + (barH - bh('logo') * bS) / 2 - LB('logo')[1] * bS };

      // intro beats
      const E = reduced ? () => 1 : (a, d) => clamp01((ti - a) / d);
      let shrink = easeInOut(clamp01((ti - 3.55) / 0.62)), alpha = 1;
      if (reduced) { shrink = ti < 3.9 ? 0 : 1; alpha = ti < 3.6 ? 1 : ti < 3.9 ? 1 - (ti - 3.6) / 0.3 : Math.min(1, (ti - 3.9) / 0.35); }
      if (ti >= 99) shrink = 1;
      const at = (pl, g) => { const a = LAYOUTS[pl.name][g]; return [pl.X + pl.S * a[0], pl.Y + pl.S * a[1], pl.S * (a[2] || 1)]; };
      const mix3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
      const pose = g => { const q = mix3(mix3(at(cardP, g), at(barP, g), kc), mix3(at(logoP, g), at(barP, g), kc), shrink); return `translate(${f(q[0])} ${f(q[1])}) scale(${f(q[2])})`; };
      for (const g of ['w1', 'w2', 'zh', 'sw', 'sub', 'plate']) set(R[g], 'transform', pose(g));
      set(R.title, 'opacity', f(alpha));
      set(R.sub, 'opacity', f(E(1.35, 0.45) * (1 - Math.max(shrink, kc))));
      // letters pop in one by one (a squash-and-settle), then the 鹈鹕湾 stamp, the swash, the twinkles, the plate
      const pop = (el, e, cxx, rot) => {
        if (e >= 1) { set(el, 'transform', ''); set(el, 'opacity', 1); return; }
        const b = e > 0 ? backOut(e) : 0;
        set(el, 'opacity', e > 0 ? f(Math.min(1, e * 3)) : 0);
        set(el, 'transform', `translate(${f(cxx)} 0) rotate(${f(rot * (1 - e))}) scale(${f(Math.max(0.01, 0.35 + 0.65 * b))} ${f(Math.max(0.01, 0.2 + 0.8 * b))}) translate(${f(-cxx)} 0)`);
      };
      const glyphs = [['a', 7], ['b', 3], ['z', 3]];
      let gi = 0;
      for (const [k, nG] of glyphs) for (let i = 0; i < nG; i++, gi++) {
        const el = R[`gl-${k}${i}`]; if (!el) continue;
        const t0 = k === 'z' ? 0.98 + i * 0.1 : 0.16 + gi * 0.075;
        pop(el, E(t0, 0.34), 0, (gi % 2 ? 1 : -1) * 9);
      }
      set(R.swwipe, 'transform', `translate(0 0) scale(${f(Math.max(0.001, easeOut(E(1.2, 0.4))))} 1)`);
      for (let i = 0; i < 3; i++) { const e = E(1.3 + i * 0.09, 0.3); const b = e > 0 ? backOut(e) : 0; set(R['tw' + i], 'opacity', e > 0 ? 1 : 0); set(R['tw' + i], 'transform', `${['translate(-20 -78)', `translate(${f(W2 + 22)} -66)`, `translate(${f(W2 + 40)} -30)`][i]} rotate(${f(90 * (1 - e))}) scale(${f(Math.max(0.01, b))})`); }
      const pe = E(1.5, 0.42), pb = pe > 0 ? backOut(pe) : 0;
      set(R['plate-in'], 'opacity', pe > 0 ? f(Math.min(1, pe * 2.5)) : 0);
      set(R['plate-in'], 'transform', pe >= 1 ? '' : `translate(${PW / 2} ${PH / 2}) rotate(${f(-5 * (1 - pe))}) scale(${f(1.35 - 0.35 * pb)}) translate(${-PW / 2} ${-PH / 2})`);

      // ---- the story caption ----
      const titleBox = s => { const q = s === 'card' ? cardP : logoP, b = LB(q.name); return [q.X + b[0] * q.S - 8, q.Y + b[1] * q.S - 8, q.X + b[2] * q.S + 8, q.Y + b[3] * q.S + 8]; };
      const crects = freeRects(area, [...obs, titleBox('card'), titleBox('logo')]);
      const Lline = capFor(pg, 'line'), Lcol = capFor(pg, 'col');
      const pcap = placeBox([[Lline.w, Lline.h, 1], [Lcol.w, Lcol.h, 0.9]], crects, 1, true);
      const capOn = pcap && pcap.S > 0.42;
      if (pcap) {
        const L = pcap.i ? Lcol : Lline;
        fillCap('cap', L, pg);
        set(R.cap, 'transform', `translate(${f(pcap.X)} ${f(pcap.Y)}) scale(${f(pcap.S)})`);
      }
      set(R.cap, 'opacity', capOn ? f(capA * (1 - kc)) : 0);
      set(R['cap-in'], 'transform', capA >= 1 || reduced ? '' : `translate(0 ${f(6 * (1 - easeOut(capA)))})`);
      if (kc > 0.001) {
        const Lb = capFor(pg, 'bar');
        fillCap('bar', Lb, pg);
        const zone = [xL + 110, yB + 8, xR - 110, V.y1 - RIM - 28];
        const s = Math.max(0.05, Math.min(1, (zone[2] - zone[0]) / Lb.w, (zone[3] - zone[1]) / Lb.h));
        set(R.bar, 'transform', `translate(${f((zone[0] + zone[2]) / 2 - Lb.w * s / 2)} ${f(zone[1] + ((zone[3] - zone[1]) - Lb.h * s) / 2)}) scale(${f(s)})`);
      }
      set(R.bar, 'opacity', kc > 0.001 ? f(capA * kc) : 0);
    },
  };
}
