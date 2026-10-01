// OWNER: fx. Layers: L-gulls-far (depth .15), L-shadow, L-fx-back, L-fx-front (depth 1).
// Style B (docs/STYLE-B.md): every effect is a painted storybook mark — soft gouache puffs, warm mauve glazes for
// shadows, warm brown hand-drawn outlines (never black) with a second faint "pencil" line, little hand-lettered
// sound words on cream sticker bubbles with stars and hearts.
//
// PERFORMANCE RULE (STYLE-B §2): nothing here carries a filter. The hand-made look is baked into the geometry at
// build time: seeded point jitter (wobbly outlines), an offset thinner second stroke (pencil double line), short
// tapered dry-brush strokes along edges, and soft light/shadow edges as radial / linear gradients (no blur).
//
// Everything is a PURE function of (t, distance, speed, cadence, events, pose, tod): particles live in fixed pools
// whose slots are re-used by a deterministic spawn schedule (slot k of a stream is born at k·dt, its look and path
// come from a hash of k), so renderAt(t) is exact, the loop can be scrubbed backwards, and there is zero DOM churn
// after build. Per frame we only write transforms / opacities / a few dash offsets, and only when they change.
//
//   L-gulls-far  far gulls (4 painted flap frames by href), distant fireflies over the dunes at night
//   L-shadow     painted contact shadows (soft gradient glaze + dry-brush edge) and a sun-projected mauve cast shadow
//                of bike + rider (shear matrix from the sun / moon position, pelican parts follow the live joints)
//   L-fx-back    headlamp glow cone + road pool (soft gradients), escort gulls, ONE calm set of breeze swirls, dandelion seeds, fireflies,
//                a bumblebee
//   L-fx-front   dust puffs + sand grit, landing puffs + bump marks, feathers, butterflies, dragonfly,
//                a tumbling leaf, a fly and a ladybird on the basket, sparkles, lamp glow + moths, event pops
//                ("Ding!" "Hop!" "Gulp!" on cloud bubbles, with stars / hearts), bell notes, hum notes when coasting,
//                drips, hearts, a fish bone, wave arcs, sparse speed strokes in a real sprint
import { fmt1, fmt2 } from '../core/math.js';
import { GROUND_Y, RIDER_X, BIKE } from '../contract.js';
import { h, refs, xf } from '../core/svg.js';
import { TIMING } from '../rig/solve.js';

export const id = 'fx';

// extra base paints (graded by the hour like every material; night turns them lavender, never grey)
export const materials = {
  fxShadow: '#6E4660', fxDust: '#F6E2C2', fxDustShade: '#D9AE7E',
  fxGullMantle: '#CDBFCB', fxGullTip: '#2E2632', fxGullBill: '#F4B84A', fxGullSpot: '#D8443A',
  fxMonarch: '#F2963E', fxMonarchDeep: '#C4582A', fxBrimstone: '#F7E7A0',
  fxHeart: '#E4574E', fxHeartHi: '#FFC2B0', fxStar: '#FAC957', fxStarDeep: '#E8A23A',
  fxLeaf: '#86A864', fxLeafDeep: '#4F7A48', fxTeal: '#2A9A94', fxTealDeep: '#17656A', fxWing: '#EAF2F2',
  fxBee: '#F6BE3E', fxBeeDark: '#3A2630', fxLady: '#D8443A', fxSky: '#9CC2DE',
  fxDing: '#1F8A8A', fxHop: '#F08A3C', fxGulp: '#D8443A',
};

// ------------------------------------------------------------------------------------------------ helpers
const f = fmt2;   // = String(Math.round(x * 100) / 100), fast (core/math.js)
const f1 = fmt1;   // = String(Math.round(x * 10) / 10), fast (core/math.js)
const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
const wrap = (x, m) => ((x % m) + m) % m;
const circ = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const poly = (pts, close = true) => 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + (close ? 'Z' : '');
// Catmull-Rom -> cubic (the draft's cr())
function smooth(pts, closed = true, k = 1 / 6) {
  const n = pts.length; const g = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    d += `C${f(p1[0] + (p2[0] - p0[0]) * k)} ${f(p1[1] + (p2[1] - p0[1]) * k)} ${f(p2[0] - (p3[0] - p1[0]) * k)} ${f(p2[1] - (p3[1] - p1[1]) * k)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + (closed ? 'Z' : '');
}
// integer hash -> [0,1): deterministic per particle id (no Math.random)
const hash = (a, b = 0) => {
  let x = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35);
  x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12; x = Math.imul(x, 0x297a2d39); x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
};
const easeOutBack = u => { const c = 1.70158, v = u - 1; return 1 + (c + 1) * v * v * v + c * v * v; };
const DD = key => ({ 'data-detail': key });
// seeded jitter of outline points (the hand-drawn wobble, baked: identical every frame)
const jit = (pts, a, R) => pts.map(([x, y]) => [x + (R() - 0.5) * 2 * a, y + (R() - 0.5) * 2 * a]);
// tapered dry-brush stroke from a to b, width w at its heavy end (a filled sliver, no stroke)
function brush(a, b, w, bend = 0) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const m = [(a[0] + b[0]) / 2 + nx * bend, (a[1] + b[1]) / 2 + ny * bend];
  return `M${f(a[0] + nx * w / 2)} ${f(a[1] + ny * w / 2)}Q${f(m[0] + nx * w * 0.3)} ${f(m[1] + ny * w * 0.3)} ${f(b[0])} ${f(b[1])}Q${f(m[0] - nx * w * 0.3)} ${f(m[1] - ny * w * 0.3)} ${f(a[0] - nx * w / 2)} ${f(a[1] - ny * w / 2)}Z`;
}
// soft rounded star (5 points by default)
function starD(r, ri = 0.48, n = 5, rot = -90) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) { const a = (rot + i * 180 / n) * D2R, rr = i % 2 ? r * ri : r; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
  return smooth(pts, true, 0.06);
}
// 4-point painted sparkle
const sparkle = (r, w) => { const p = []; for (let i = 0; i < 8; i++) { const a = (i * 45 - 90) * D2R, rr = i % 2 ? w : r; p.push([Math.cos(a) * rr, Math.sin(a) * rr]); } return smooth(p, true, 0.04); };
// blobby cloud bubble (scalloped ellipse, seeded bumps)
function bubble(rx, ry, n, R) {
  let d = '';
  const P = i => { const a = (i / n) * TAU; return [Math.cos(a) * rx, Math.sin(a) * ry]; };
  for (let i = 0; i < n; i++) {
    const a0 = P(i), a1 = P(i + 1), am = (i + 0.5) / n * TAU, k = 1.2 + 0.1 * R();
    const c = [Math.cos(am) * rx * k, Math.sin(am) * ry * k];
    d += (i ? '' : `M${f(a0[0])} ${f(a0[1])}`) + `Q${f(c[0])} ${f(c[1])} ${f(a1[0])} ${f(a1[1])}`;
  }
  return d + 'Z';
}
// fly loop around the basket (rider-local): centre + half extents
const FLY_C = [198, -326], FLY_A = [54, 24];
// speed-stroke anchors (rider-local, just behind the trailing silhouette): scarf, back, tail, rear tyre
const SPEEDLINES = [[-150, -402], [-232, -128], [-176, -344], [-205, -36]];
// ladybird crawl on the basket front (rider-local)
const LADY = { x0: 152, x1: 206, y: -262 };

// ------------------------------------------------------------------------------------------------ detail inventory
export const detailItems = [
  ['fx:O:gull-far', 'O', 'far gulls painted small with a soft brown line: white body, rose-grey mantle, dark tips; 4-frame flap cycle'],
  ['fx:O:gull-escort', 'O', 'near companion gull: plump white body with a rose-grey belly glaze, warm brown hand-drawn outline; the flock escorts the rider above 85 rpm'],
  ['fx:T:gull-wingtip-mirrors', 'T', 'underwing with covert line, rose-grey mantle band and a dark hand with painted primary separations and cream "mirror" spots'],
  ['fx:T:gull-pencil-line', 'T', 'second, offset, fainter "pencil" line around the gull body (baked double stroke)'],
  ['fx:O:gull-beak', 'O', 'yellow gull bill with the red gonys spot'],
  ['fx:O:gull-eye', 'O', 'kind dark gull eye with a catch-light and a rosy cheek dab'],
  ['fx:O:gull-feet', 'O', 'orange feet tucked under the belly'],
  ['fx:O:shadow-contact', 'O', 'painted contact shadow under each tyre: a warm mauve core (shrinks / fades in a hop)'],
  ['fx:T:shadow-penumbra', 'T', 'soft gouache glaze around the contact shadow (radial gradient, no blur filter)'],
  ['fx:T:shadow-drybrush', 'T', 'dry-brush strokes dragged along the shadow edge, the painter\'s hand'],
  ['fx:O:shadow-cast-bike', 'O', 'sun-projected mauve cast shadow of the bicycle: wheel rings, hubs, frame tubes, saddle, bars, basket'],
  ['fx:O:shadow-cast-pelican', 'O', 'cast shadow of the pelican: body, neck, head, bill, pouch, crest, tail, wings and legs follow the live pose'],
  ['fx:O:dust-puff', 'O', 'soft gouache dust puffs kicked from the rear tyre (cream puff, sand under-lobe), rate and size scale with speed'],
  ['fx:T:dust-drybrush', 'T', 'broken brown line along the top of each puff and a dry-brush fleck'],
  ['fx:O:dust-grit', 'O', 'sand specks flicked up behind the rear tyre on ballistic arcs'],
  ['fx:O:feather-contour', 'O', 'drifting contour feather: cream vane, rachis, barbs, split notch'],
  ['fx:T:feather-glaze', 'T', 'rose-grey glaze on the lower vane of the drifting feather'],
  ['fx:O:feather-down', 'O', 'drifting down plume (fluffy painted wisps)'],
  ['fx:O:seed-dandelion', 'O', 'dandelion seeds floating on the breeze: pappus rays with dot tips, stalk, brown seed'],
  ['fx:O:butterfly-monarch', 'O', 'orange storybook butterfly fluttering ahead of the bill (flap + glide), blown away when sprinting'],
  ['fx:T:butterfly-monarch-veins', 'T', 'brown veins, deep-orange wing border and cream spots on the orange butterfly'],
  ['fx:O:butterfly-white', 'O', 'pale-lemon brimstone chasing the scarf tail (orange wing dot, brown line)'],
  ['fx:O:dragonfly', 'O', 'dragonfly hovering and darting ahead of the front wheel: teal segmented abdomen, big amber eye'],
  ['fx:T:dragonfly-venation', 'T', 'wing venation, cross-veins and pterostigma spots on the dragonfly wings'],
  ['fx:O:leaf-tumble', 'O', 'a green leaf tumbling past on the breeze (3-D flip by scaleX), painted midrib and veins'],
  ['fx:O:basket-fly', 'O', 'a cartoon fly buzzing figure-eights around the fish basket, wings flickering'],
  ['fx:T:fly-dotted-trail', 'T', 'cartoon dotted flight trail behind the fly'],
  ['fx:O:ladybird', 'O', 'a ladybird crawling along the front of the basket: red shell, black spots and head, cream eye dots'],
  ['fx:O:bumblebee', 'O', 'a round bumblebee bumbling about behind the rider with a dotted trail'],
  ['fx:T:bee-stripes', 'T', 'fuzzy bee stripes painted as short brush hairs'],
  ['fx:O:wind-swirl', 'O', 'ONE calm set of three soft painted breeze swirls high in the sky, drawing on and drifting slowly, at most one set on screen'],
  ['fx:O:glint-bell', 'O', 'painted four-point sparkle twinkling on the bell (sun side)'],
  ['fx:O:glint-rim', 'O', 'sparkle with a halo ring on the rear rim, held on the sun side while the wheel turns under it'],
  ['fx:O:speed-lines', 'O', 'sparse cream dry-brush speed strokes, only in a real sprint (> 86 rpm, toggle "speedlines")'],
  ['fx:O:land-dust-burst', 'O', 'landing dust puffs spreading from both tyres'],
  ['fx:O:land-bump-marks', 'O', 'little hand-drawn bump arcs and yellow sparkles at both contact points on landing'],
  ['fx:O:pop-ding', 'O', 'hand-lettered "Ding!" (叮铃) on a cream cloud bubble with twinkling stars'],
  ['fx:O:pop-hop', 'O', 'hand-lettered "Hop!" (嘿哟) pop at take-off with stars and motion arcs'],
  ['fx:O:pop-gulp', 'O', 'hand-lettered "Gulp!" (咕嘟) pop at the swallow with hearts and bubbles'],
  ['fx:T:pop-sticker-letters', 'T', 'sticker lettering: coloured serif letters, cream band, brown outline, mauve drop shadow, bouncing baseline'],
  ['fx:O:bell-notes', 'O', 'eighth note and beamed pair rising from the bell'],
  ['fx:O:hum-notes', 'O', 'little notes drifting up from the bill while the pelican hums, coasting'],
  ['fx:O:gulp-drips', 'O', 'sea-water drips falling from the bill during the scoop'],
  ['fx:O:gulp-hearts', 'O', 'little painted hearts with a highlight rising after the gulp'],
  ['fx:O:fish-bone', 'O', 'fish bone spat over the shoulder, landing on the road and scrolling away'],
  ['fx:O:wave-arcs', 'O', 'soft action arcs beside the waving wing'],
  ['fx:O:headlamp-beam', 'O', 'night headlamp: a warm cone and road pool painted as soft gradients'],
  ['fx:O:lamp-flare', 'O', 'warm lamp glow and sparkle on the headlamp at night'],
  ['fx:O:moths', 'O', 'moths circling the headlamp at night'],
  ['fx:O:fireflies', 'O', 'fireflies: little bodies with glowing tails in a soft golden glow, blinking out of phase at night'],
  ['fx:O:fireflies-far', 'O', 'distant firefly twinkles over the dunes'],
].map(([key, kind, what]) => ({ id: key.split(':')[2], layer: 'fx', kind, what, key }));

// ------------------------------------------------------------------------------------------------ lettering
// Hand-lettered sound words: DejaVu Serif Bold (Latin) and WenQuanYi Zen Hei (CJK) outlines, extracted at build time
// with tools/ttf.mjs (both licences allow embedding outlines). em = 100, y down, baseline 0. [advance, d, bbox]
const GLYPH_LAT = {"D":[86.7,"M32.8-5.9L39.6-5.9Q51-5.9 56.3-13.2Q61.6-20.6 61.6-36.5Q61.6-52.4 56.4-59.7Q51.1-67 39.6-67L32.8-67ZM4.7 0L4.7-5.9L14-5.9L14-67L4.7-67L4.7-72.9L42.1-72.9Q61.7-72.9 72.1-63.5Q82.5-54.1 82.5-36.5Q82.5-18.8 72.1-9.4Q61.7 0 42.1 0Z",[5,-73,83,0]],"i":[38,"M9.2-66.6Q9.2-70.6 11.9-73.3Q14.7-76 18.6-76Q22.5-76 25.2-73.3Q27.9-70.6 27.9-66.6Q27.9-62.7 25.2-60Q22.5-57.3 18.6-57.3Q14.7-57.3 11.9-60Q9.2-62.7 9.2-66.6ZM28.1-5.9L35.5-5.9L35.5 0L3.4 0L3.4-5.9L10.8-5.9L10.8-46L3.4-46L3.4-51.9L28.1-51.9Z",[3,-76,36,0]],"n":[72.7,"M3.4 0L3.4-5.9L10.8-5.9L10.8-46L3.4-46L3.4-51.9L28.1-51.9L28.1-44.6Q31.2-49.2 35.2-51.3Q39.2-53.3 45.3-53.3Q54.1-53.3 58.5-48.2Q63-43 63-33L63-5.9L70.4-5.9L70.4 0L39.4 0L39.4-5.9L45.7-5.9L45.7-33.5Q45.7-40.1 44-42.6Q42.3-45.2 38.2-45.2Q33-45.2 30.5-41.4Q28.1-37.5 28.1-29.2L28.1-5.9L34.4-5.9L34.4 0Z",[3,-53,70,0]],"g":[69.9,"M60.2-46L60.2-0.7Q60.2 10.3 52.4 16.2Q44.6 22.2 30.4 22.2Q25.2 22.2 19.9 21.4Q14.6 20.6 9 19L9 6.6L14.5 6.6Q15.2 11.7 18.6 14.2Q22 16.7 28.3 16.7Q36.3 16.7 39.6 12.9Q42.9 9 42.9-0.7L42.9-6.6Q40.7-2.5 37-0.6Q33.3 1.4 27.8 1.4Q16.8 1.4 10.4-5.9Q4.1-13.2 4.1-26Q4.1-38.8 10.4-46Q16.8-53.3 27.8-53.3Q33.3-53.3 37-51.3Q40.7-49.4 42.9-45.3L42.9-51.9L67.6-51.9L67.6-46ZM42.9-28.5Q42.9-37.6 40.6-41.6Q38.2-45.7 33.1-45.7Q27.7-45.7 25.6-41.4Q23.4-37.2 23.4-26Q23.4-14.8 25.6-10.5Q27.8-6.2 33.1-6.2Q38.2-6.2 40.6-10.2Q42.9-14.3 42.9-23.4Z",[4,-53,68,22]],"H":[94.5,"M4.7 0L4.7-5.9L14-5.9L14-67L4.7-67L4.7-72.9L42.2-72.9L42.2-67L32.8-67L32.8-42.5L61.8-42.5L61.8-67L52.5-67L52.5-72.9L90-72.9L90-67L80.6-67L80.6-5.9L90-5.9L90 0L52.5 0L52.5-5.9L61.8-5.9L61.8-35.8L32.8-35.8L32.8-5.9L42.2-5.9L42.2 0Z",[5,-73,90,0]],"o":[66.7,"M33.4-4.1Q38.9-4.1 41.1-8.8Q43.3-13.5 43.3-26Q43.3-38.5 41.1-43.1Q38.9-47.8 33.4-47.8Q27.9-47.8 25.6-43.1Q23.4-38.4 23.4-26Q23.4-13.6 25.6-8.8Q27.9-4.1 33.4-4.1ZM33.4 1.4Q19.7 1.4 11.9-5.9Q4.1-13.2 4.1-26Q4.1-38.8 11.9-46.1Q19.7-53.3 33.4-53.3Q47.2-53.3 54.9-46.1Q62.7-38.8 62.7-26Q62.7-13.2 54.9-5.9Q47.1 1.4 33.4 1.4Z",[4,-53,63,1]],"p":[69.9,"M27-28.5L27-23.4Q27-14.3 29.3-10.2Q31.6-6.2 36.8-6.2Q42.1-6.2 44.3-10.5Q46.5-14.8 46.5-26Q46.5-37.2 44.3-41.4Q42.1-45.7 36.8-45.7Q31.6-45.7 29.3-41.6Q27-37.6 27-28.5ZM9.7-46L2.3-46L2.3-51.9L27-51.9L27-45.3Q29.2-49.4 32.9-51.3Q36.6-53.3 42.1-53.3Q53.2-53.3 59.6-46Q65.9-38.7 65.9-26Q65.9-13.2 59.6-5.9Q53.2 1.4 42.1 1.4Q36.6 1.4 32.9-0.6Q29.2-2.5 27-6.6L27 14.9L35 14.9L35 20.8L2.3 20.8L2.3 14.9L9.7 14.9Z",[2,-53,66,21]],"G":[85.4,"M68.8-50Q66.6-59.7 61.5-64Q56.4-68.3 47-68.3Q35.7-68.3 30.4-60.6Q25.1-52.9 25.1-36.4Q25.1-20 30.2-12.2Q35.3-4.5 46-4.5Q50.1-4.5 53.6-5.4Q57.1-6.3 60-8.2L60-28.2L51.2-28.2L51.2-34.1L77.5-34.1L77.5-6.1Q69.3-2.3 61.1-0.4Q52.9 1.4 44.4 1.4Q25.6 1.4 14.9-8.7Q4.2-18.8 4.2-36.4Q4.2-54 14.9-64.1Q25.6-74.2 44.4-74.2Q52.2-74.2 59.8-72.7Q67.3-71.1 75-67.9L75-50Z",[4,-74,77,1]],"u":[72.7,"M61.9-51.9L61.9-5.9L69.3-5.9L69.3 0L44.6 0L44.6-7.3Q41.5-2.7 37.5-0.6Q33.5 1.4 27.4 1.4Q18.7 1.4 14.2-3.7Q9.7-8.9 9.7-18.9L9.7-46L2.3-46L2.3-51.9L27-51.9L27-21.6Q27-11.9 28.6-9.3Q30.2-6.7 34.5-6.7Q39.8-6.7 42.2-10.5Q44.6-14.4 44.6-22.8L44.6-46L38.3-46L38.3-51.9Z",[2,-52,69,1]],"l":[38,"M28.1-5.9L35.5-5.9L35.5 0L3.4 0L3.4-5.9L10.8-5.9L10.8-70.1L3.4-70.1L3.4-76L28.1-76Z",[3,-76,36,0]],"!":[43.9,"M12.7-7.9Q12.7-11.7 15.4-14.4Q18.1-17.2 21.9-17.2Q25.7-17.2 28.5-14.4Q31.2-11.7 31.2-7.9Q31.2-4 28.5-1.3Q25.7 1.4 21.9 1.4Q18.1 1.4 15.4-1.3Q12.7-4 12.7-7.9ZM12.8-72.9L31.1-72.9L25.3-31.8L25.3-22.5L18.5-22.5L18.5-31.8Z",[13,-73,31,1]],"z":[56.8,"M3.5 0L3.5-5.9L33.3-46.2L10.9-46.2L10.9-37.3L5.1-37.3L5.1-51.9L53.4-51.9L53.4-46.1L23.6-5.8L47.6-5.8L47.6-15.2L53.4-15.2L53.4 0Z",[4,-52,53,0]],"Z":[73,"M3.7 0L3.7-6.9L47.2-66.2L12.3-66.2L12.3-55.3L5.6-55.3L5.6-72.9L68.9-72.9L68.9-66L25.9-6.7L62.7-6.7L62.7-16.9L69.4-16.9L69.4 0Z",[4,-73,69,0]]};
const GLYPH_ZH = {"叮":[100,"M66.4-1.8L66.4-71L55.8-71Q49.8-71 43.9-70.7Q44.1-73.9 43.9-77.1Q49.8-76.9 55.8-76.9L84.9-76.9Q90.8-76.9 96.8-77.1Q96.4-73.9 96.8-70.7Q90.8-71 84.9-71L73.6-71L73.6 0.9Q73.6 7.9 69.3 10.5Q64.8 13.2 55.1 13.1Q56.2 8.1 52.7 4.3Q55.9 4.7 60 4.7Q64.2 4.8 65.3 3.9Q66.4 3 66.4-1.8ZM15-0.6L8.3-0.6L8.4-71L37.4-71L37.4-0.6L30.7-0.6L30.7-10L15-10ZM30.7-65.4L15-65.4L15-15.5L30.7-15.5Z",[8,-77,97,13]],"铃":[100,"M57.8-19.5Q52.9-19.5 48.1-19.2Q48.3-21.9 48.1-24.5Q52.9-24.3 57.8-24.3L83.7-24.3L84.7-18.5Q82.5-17.5 80.6-14.7Q78.6-11.9 70 1.2L79 9.2L73.9 14.6L62.7 4.5L51-5L55.5-10.7L64.9-3.1L75.7-19.5ZM72.5-34.3L66.2-30.4L56.7-45.6L63-49.5ZM96.6-40.4Q93-38.8 91.2-35.2Q83.3-39.4 76.2-47.2Q69.1-55.1 65.3-65Q55.1-43.6 43.6-30.9Q40.8-34.1 36.8-35Q48-47.1 53.7-57Q59.4-66.9 63.5-80.5Q67.2-78.7 71.2-77.8L69.1-73.2Q72.1-60.5 79.8-52.6Q86.9-45.2 96.6-40.4ZM16.3-78.8Q20-77.6 24.4-77.3Q22.6-70.7 20.5-64.2L33-64.2Q37.8-64.2 42.6-64.4Q42.3-61.9 42.6-59.4Q37.8-59.7 33-59.7L19-59.7Q16.8-52.7 14.8-47.5L30.6-47.5Q35.4-47.5 40.1-47.7Q39.8-45.2 40.1-42.7Q35.4-43 30.6-43L25.5-43L25.5-30.4L33.5-30.4Q38.3-30.4 43.1-30.6Q42.8-28.1 43.1-25.6Q38.3-25.9 33.5-25.9L25.5-25.9L25.5-5.5L38.6-17.5L41.4-13.7Q39.8-12.3 38.2-10.7Q29.6-1.9 22.1 7.7L17.2 3Q18.7 0.6 18.7-2.1L18.7-25.9L13.2-25.9Q8.4-25.9 3.5-25.6Q3.8-28.1 3.5-30.6Q8.4-30.4 13.2-30.4L18.7-30.4L18.7-43L12.8-43Q10.4-37.3 7.2-32Q4.3-34.3-0.4-34.5Q2.7-39.6 6.6-47.1Q13.8-61 16.3-78.8Z",[0,-80,97,15]],"嘿":[100,"M91.4 13.1Q87.6 2.5 81.1-6.4L86.7-10.5Q93.8-0.7 98 10.6ZM79.6 8.1L73.2 11L65.8-5L72.2-7.9ZM62.2 9.4L55.8 11.8L49.5-4.5L56.1-6.9ZM30.9 10.5Q34.7 1.7 37.2-7.6L44-5.9Q41.2 3.9 37.3 13.2ZM96.5-18.6Q96.2-16.4 96.5-14.2Q92.3-14.4 88-14.4L39.3-14.4Q35.1-14.4 30.9-14.2Q31.1-16.4 30.9-18.6Q35.1-18.5 39.3-18.5L60.9-18.5L60.9-29.3L45.2-29.3Q41-29.3 36.8-29.1Q37.1-31.4 36.8-33.7Q41-33.5 45.2-33.5L60.9-33.5L60.9-43.2L37.7-43.2Q38.9-61.5 37.7-79.8L89.7-79.8Q88.6-61.5 89.7-43.2L67.2-43.2L67.2-33.5L82-33.5Q86.2-33.5 90.4-33.7Q90.2-31.4 90.4-29.1Q86.2-29.3 82-29.3L67.2-29.3L67.2-18.5L88-18.5Q92.2-18.5 96.5-18.6ZM67.2-47.4L83.3-47.4L83.3-75.7L67.2-75.7L67.2-52.6Q68.7-55.5 72.7-65.3L75.7-72.6Q78.8-71 82.1-70L79.1-62.6L73.1-50.3Q70.4-52 67.2-52.1ZM51.6-51.5Q48.5-60.9 44.3-69.9L50.6-72.8Q55.1-63.5 58.2-53.6ZM60.9-75.7L44-75.7L44-47.4L60.9-47.4ZM10-4.2L3.8-4.2L3.8-74.2L27.3-74.2L27.3-4.2L21.1-4.2L21.1-13L10-13ZM21.1-70L10-70L10-16.9L21.1-16.9Z",[4,-80,98,13]],"哟":[100,"M85.6-55.1L73.1-55.1Q71-48.4 69.1-43.7L72.5-45.4Q77.8-34.5 80.3-22.6L73.1-21Q71.1-30.4 67.2-39.2Q65.8-35.8 64-32.3Q60.6-34.8 56.3-34.7Q63-46.9 66.4-56.6Q69.8-66.4 72-80Q75.9-78.8 80-78.4L74.6-60.1L92.4-60.1L92.4 1.8Q92.4 6.5 89.3 9.6Q85.8 12.8 74.9 12.7Q76 8 72.7 4.5Q75.7 4.8 79.7 4.8Q83.7 4.9 84.7 4.1Q85.6 2.8 85.6-1.4ZM30.7-4Q43.9-5.3 54.7-8.6Q58.6-9.8 66.4-12.3L66.6-7.8Q45-0.9 33.3 4.1Q33.2-0.3 30.7-4ZM54.7-61.7Q58.4-60 62.4-59Q61.6-56.6 60-53.5Q58.4-50.3 51.1-38.5Q43.9-26.8 41.1-23L56.2-25.1L61.4-26.5L61.3-21.1L56.8-20.7L31.6-16.6L30.9-21.5Q32.9-22.1 34.2-23.6Q38.7-28.9 45.7-41.4L31.4-40.3L31.1-45.3Q32.8-45.6 33.6-47.3Q35.7-51.9 40.5-63.6Q45.2-75.3 46.8-81Q50.4-79 54.4-77.9L39.6-45.8L48.2-46.2Q53.5-56.3 54.7-61.7ZM10.2-4.2L3.9-4.2L3.9-74.2L27.7-74.2L27.7-4.2L21.5-4.2L21.5-13L10.2-13ZM21.5-70L10.2-70L10.2-16.9L21.5-16.9Z",[4,-81,92,13]],"咕":[100,"M53.2 12Q49.4 11.6 45.6 12Q46 5 46-1.9L46-31L64.6-31L64.6-53.6L50.7-53.6Q45.4-53.6 40.2-53.4Q40.5-56.2 40.2-59.1Q45.4-58.8 50.7-58.8L64.6-58.8L64.6-68.3Q64.6-75.2 64.3-82.1Q68.1-81.7 71.8-82.1Q71.5-75.2 71.5-68.3L71.5-58.8L86.1-58.8Q91.4-58.8 96.7-59.1Q96.4-56.2 96.7-53.4Q91.4-53.6 86.1-53.6L71.5-53.6L71.5-31L89.8-31L89.8 11.8L83 11.8L83 3.1L52.9 3.1Q52.9 7.5 53.2 12ZM83-25.8L52.8-25.8L52.8-2L83-2ZM12.3-4.2L4.7-4.2L4.7-74.2L33.6-74.2L33.6-4.2L26.1-4.2L26.1-13L12.3-13ZM26.1-70L12.3-70L12.3-16.9L26.1-16.9Z",[5,-82,97,12]],"嘟":[100,"M78.7 12Q75.1 11.6 71.6 12Q71.9 5.4 71.9-1.2L71.9-73.1L94.6-73.1L94.6-68.7Q93.4-66.7 92.6-64.4L85.6-44.4Q90.2-40.7 92.9-35.3Q95.5-29.9 95.5-23.8L95.6-15.6Q95.9-7.7 92.4-3.9Q89.9-1.9 87-1Q84-0.1 81.7 0.4Q80.5-2.8 78.3-5.6L78.3-1.2Q78.3 5.4 78.7 12ZM44.5 12Q40.9 11.6 37.4 12Q37.7 5.4 37.7-1.2L37.7-26.4Q33.2-22.4 28.6-19Q26.8-22.6 23.1-24.4Q36.9-33.6 47.3-45.6L36.2-45.6Q31.8-45.6 27.3-45.4Q27.6-47.7 27.3-50.2Q31.8-50 36.2-50L43.4-50L43.4-64.2L31.9-64Q32.2-66.3 31.9-68.7L43.4-68.5L43.1-82.1Q46.6-81.7 50.2-82.1L49.9-68.5L60.8-68.7Q60.6-66.9 60.6-65.3Q62.2-68.3 63.6-71.3Q66.9-69.1 70.5-67.7Q65.1-58.4 59-50L68.8-50.2Q68.6-47.7 68.8-45.4L55.7-45.6Q51.3-40 46.8-35.2L65.1-35.2L65.1 11.8L58.7 11.8L58.7 2.3L44.2 2.3Q44.2 7.1 44.5 12ZM78.3-68.7L78.3-6Q82.7-6.3 85-6.9Q87.3-7.5 88.3-8.7Q89.4-9.9 89.7-11.8Q90-13.8 90-15.4L89.8-23.8Q89.8-30.1 86.8-35.5Q83.9-41 78.8-44.5L87.2-68.7ZM58.7-18.4L58.7-30.9L44.2-30.9L44.2-18.4ZM58.7-14.4L44.2-14.4L44.2-1.7L58.7-1.7ZM60-64L49.9-64.2L49.9-50L50.8-50Q56-56.6 60-64ZM9-4.2L3.4-4.2L3.4-74.2L24.6-74.2L24.6-4.2L19-4.2L19-13L9-13ZM19-70L9-70L9-16.9L19-16.9Z",[3,-82,96,12]]};

function glyphWord(id, text, table, opt = {}) {
  // per-letter bounce + tilt: a hand-lettered, slightly dancing baseline (seeded, static)
  const { bounce = 4, tilt = 5, track = -1, seed = 1 } = opt;
  let pen = 0, d = '', x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, i = 0;
  for (const ch of text) {
    const g = table[ch]; if (!g) continue;
    const [adv, pd, bb] = g;
    const dy = (hash(i, seed) - 0.5) * 2 * bounce - (i % 2 ? bounce * 0.5 : 0), r = (hash(i, seed + 7) - 0.5) * 2 * tilt;
    const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;
    d += `<path transform="translate(${f(pen)} ${f(dy)}) rotate(${f(r)} ${f(cx)} ${f(cy)})" d="${pd}"/>`;
    x0 = Math.min(x0, pen + bb[0]); x1 = Math.max(x1, pen + bb[2]); y0 = Math.min(y0, bb[1] + dy); y1 = Math.max(y1, bb[3] + dy);
    pen += adv + track; i++;
  }
  return { defs: `<g id="${id}">${d}</g>`, w: x1 - x0, x0, y0, y1, h: y1 - y0 };
}

// ------------------------------------------------------------------------------------------------ build
export function build(ctx) {
  const { v, rng } = ctx;
  const LINE = v('line'), SOFT = v('lineSoft'), PAPER = v('paper');
  const M = k => v(k), MF = k => v(k, { far: true });
  let defs = '';
  const L = { far: '', shadow: '', back: '', front: '' };
  // pencil double line: the main warm-brown line plus an offset, thinner, fainter second pass
  const inked = (d, w, attrs = {}, col = LINE) =>
    h('path', { d, fill: 'none', stroke: col, 'stroke-width': w, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', ...attrs });
  const pencil = (d, w, dx = 0.7, dy = -0.6, key) =>
    h('path', { d, fill: 'none', stroke: LINE, 'stroke-width': f(w * 0.45), opacity: 0.4, transform: `translate(${dx} ${dy})`, 'stroke-linecap': 'round', ...(key ? DD(key) : {}) });

  // ---- soft painted gradients (glazes and glows; they replace blur filters)
  const stop = (o, col, op) => h('stop', { offset: o, 'stop-color': col, 'stop-opacity': op });
  defs += h('radialGradient', { id: 'fx-gShadow' }, stop(0, M('fxShadow'), 0.5), stop(0.55, M('fxShadow'), 0.26), stop(1, M('fxShadow'), 0));
  defs += h('radialGradient', { id: 'fx-gGlow' }, stop(0, v('headlamp'), 1), stop(0.22, v('lamp'), 0.75), stop(0.55, v('lampGlow'), 0.25), stop(1, v('lampGlow'), 0));
  defs += h('radialGradient', { id: 'fx-gPool' }, stop(0, v('headlamp'), 0.42), stop(0.6, v('lamp'), 0.16), stop(1, v('lamp'), 0));
  defs += h('linearGradient', { id: 'fx-gBeam', gradientUnits: 'userSpaceOnUse', x1: BIKE.lamp[0], y1: BIKE.lamp[1], x2: 820, y2: 10 },
    stop(0, v('headlamp'), 0.5), stop(0.35, v('lamp'), 0.22), stop(1, v('lamp'), 0));

  // ============================================== gull (side view, facing +x). Wings drawn raised; flap = scaleY.
  const Rg = rng('fx-gullart');
  const GB = jit([[21.5, -4.6], [15, -8.8], [8, -7.4], [-4, -5.2], [-18, -3.4], [-31, -3.2], [-32, 0.8], [-18, 3.8], [-4, 7], [10, 6], [19, 2], [22, 0.4]], 0.35, Rg);
  const GBODY = smooth(GB);
  const GBELLY = smooth([[-27, 1.6], [-14, 4], [-2, 6.4], [9, 5.4], [17, 2], [7, 1.8], [-8, 1.2]]);
  const GBEAK = smooth([[21.2, -4.3], [27, -3.4], [33.6, -1], [32.4, 1.2], [29.6, 0.7], [21.6, 0.8]], true, 0.08);
  const wing = (s, far, farLine) => {
    // raised wing seen from the side: pale underwing arm with a mantle band, dark hand with cream mirrors;
    // pivot = shoulder (0,0). The far wing is the same shape in a cooler, darker glaze (STYLE-B far-side rule).
    const arm = smooth(jit([[6, 0.6], [5, -12], [2.4, -24.5], [-3, -25.5], [-8.6, -24], [-12.4, -13], [-16.5, -2.6], [-6, 1.6]], 0.3, Rg));
    const hand = smooth([[2.4, -24.5], [-4.4, -34], [-11, -42], [-17.6, -48.6], [-19.8, -45.4], [-16.4, -38], [-12, -29.5], [-8.6, -24]], true, 0.1);
    const band = 'M-13 -11C-8 -9.6 -2 -10.4 3.4 -12.6L2.6 -17C-3 -15 -8 -14.6 -12.2 -16Z';
    const primaries = 'M-4.4 -34L-8.8 -30.4M-8 -38.4L-12.2 -34.6M-11.8 -42.6L-15.4 -39.8';
    if (far) return h('g', { transform: `scale(1 ${f(s)})` }, h('path', { d: arm + hand, fill: MF('fxGullMantle'), stroke: farLine || 'none', 'stroke-width': farLine ? 1.4 : 0, 'stroke-linejoin': 'round' }));
    return h('g', { transform: `scale(1 ${f(s)})` },
      h('path', { d: arm, fill: PAPER }),
      h('path', { d: band, fill: M('fxGullMantle') }),
      h('path', { d: arm, fill: 'none', stroke: farLine || LINE, 'stroke-width': farLine ? 1.6 : 1.2, 'stroke-linejoin': 'round' }),
      h('g', DD('fx:T:gull-wingtip-mirrors'),
        h('path', { d: hand, fill: M('fxGullTip') }),
        h('path', { d: primaries, fill: 'none', stroke: M('fxGullMantle'), 'stroke-width': 0.6, 'stroke-linecap': 'round' }),
        h('path', { d: circ(-15.8, -44.4, 1.35) + circ(-11.2, -37.4, 0.95), fill: PAPER })));
  };
  const gullBody = (detail, farLine) => h('g', {},
    h('path', { d: GBODY, fill: PAPER }),
    h('path', { d: GBELLY, fill: M('plumeShade') }),
    h('path', { d: 'M-5 5.8L-13 8.2M-2.4 6.4L-10.4 9.4', fill: 'none', stroke: M('foot'), 'stroke-width': 1.7, 'stroke-linecap': 'round', ...(detail ? DD('fx:O:gull-feet') : {}) }),
    inked(GBODY, farLine ? 1.7 : 1.3, {}, farLine || LINE),
    detail ? pencil(GBODY, 1.3, 0.8, -0.7, 'fx:T:gull-pencil-line') : '',
    h('path', { d: 'M-24 -1.4L-31 -1.1', stroke: farLine || SOFT, 'stroke-width': 0.8, fill: 'none', 'stroke-linecap': 'round' }),
    h('g', detail ? DD('fx:O:gull-beak') : {}, h('path', { d: GBEAK, fill: M('fxGullBill'), stroke: farLine || LINE, 'stroke-width': farLine ? 1.2 : 0.8, 'stroke-linejoin': 'round' }), h('path', { d: circ(30.2, 0.3, 1.05), fill: M('fxGullSpot') })),
    h('g', detail ? DD('fx:O:gull-eye') : {},
      detail ? h('path', { d: circ(12.6, -2.2, 2), fill: M('fxHeartHi'), opacity: 0.55 }) : '',
      h('path', { d: circ(15.2, -4.6, 1.5), fill: M('fxGullTip') }), h('path', { d: circ(15.7, -5.1, 0.5), fill: PAPER })));
  // far gull frames (4 flap positions), used by <use href> swap; far = lighter, softer line (atmospheric perspective)
  const FRAMES = [1, 0.4, -0.35, -0.9];
  FRAMES.forEach((s, i) => {
    defs += h('g', { id: 'fx-gf' + i },
      h('g', { transform: 'translate(3 -4.5) scale(0.86)' }, wing(s, true, SOFT)), gullBody(false, SOFT), h('g', { transform: 'translate(1 -4)' }, wing(s, false, SOFT)));
  });
  const R = rng('fx-gulls');
  const FAR = [];
  for (let i = 0; i < 7; i++) {
    const grp = i < 4 ? 0 : 1;
    FAR.push({ x0: grp * 1300 + i * 70 + R() * 50, y: (grp ? 150 : 205) + (i % 4) * 22 + R() * 18, s: 0.34 + R() * 0.14, f: 2.4 + R() * 1.2, ph: R() * 10, gl: R() * 10 });
  }
  L.far += h('g', { opacity: 0.92 }, FAR.map((g, i) => h('use', { 'data-ref': 'fx-gfar' + i, ...DD('fx:O:gull-far'), href: '#fx-gf1', transform: `translate(${f(g.x0)} ${f(g.y)}) scale(${f(g.s)})` })));
  const ESC = [
    { idle: [400, 262], st: [455, 318], s: 1.15 },
    { idle: [-300, 420], st: [300, 405], s: 1.0 },
    { idle: [-300, 200], st: [612, 178], s: 0.92 },
    { idle: [-300, 120], st: [1115, 168], s: 0.85 },
  ];
  L.back += h('g', { 'data-ref': 'fx-escort' }, ESC.map((g, i) => h('g', { 'data-ref': 'fx-esc' + i, transform: `translate(${g.idle[0]} ${g.idle[1]}) scale(${g.s})`, ...(i === 0 ? DD('fx:O:gull-escort') : {}) },
    h('g', { transform: 'translate(3 -4.5) scale(0.86)' }, h('g', { 'data-ref': 'fx-escWf' + i }, wing(1, true))),
    gullBody(i === 0),
    h('g', { transform: 'translate(1 -4)' }, h('g', { 'data-ref': 'fx-escWn' + i }, wing(1, false))))));

  // ============================================== shadow (L-shadow)
  const [rhx] = BIKE.rearHub, [fhx] = BIKE.frontHub;
  const Rs = rng('fx-shadow');
  const dry = Array.from({ length: 7 }, (_, i) => { const x = -58 + i * 18 + (Rs() - 0.5) * 8, y = 3.4 + Rs() * 2.4, l = 10 + Rs() * 14; return brush([x - l / 2, y], [x + l / 2, y + (Rs() - 0.5) * 1.2], 1.1 + Rs() * 0.8, (Rs() - 0.5) * 1.5); }).join('');
  const contact = (ref, x) => h('g', { 'data-ref': ref, transform: `translate(${RIDER_X + x} ${GROUND_Y + 1})` },
    h('ellipse', { cy: 1.4, rx: 74, ry: 10, fill: 'url(#fx-gShadow)', ...DD('fx:T:shadow-penumbra') }),
    h('path', { d: dry, fill: M('fxShadow'), opacity: 0.32, ...DD('fx:T:shadow-drybrush') }),
    h('path', { d: smooth(jit([[-34, 0], [-18, -3.8], [0, -4.4], [18, -3.8], [34, 0], [18, 3.6], [0, 4.2], [-18, 3.6]], 0.5, Rs)), fill: M('fxShadow'), opacity: 0.6, ...DD('fx:O:shadow-contact') }));
  const B = BIKE;
  const tube = (a, b) => `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`;
  const frameD = [tube(B.rearHub, B.bb), tube(B.rearHub, B.seatTubeTop), tube(B.bb, B.seatClamp), tube(B.seatTubeTop, B.headTop), tube(B.bb, B.headBottom),
    tube(B.headTop, B.frontHub), tube(B.steererTop, B.stem), tube(B.stem, B.gripNear), tube(B.seatClamp, [-60.5, -287])].join('');
  const bikeShadow = h('g', { ...DD('fx:O:shadow-cast-bike') },
    h('path', { d: circ(rhx, -100, 95.5) + circ(fhx, -100, 95.5), fill: 'none', stroke: 'currentColor', 'stroke-width': 10 }),
    h('path', { d: circ(rhx, -100, 7) + circ(fhx, -100, 7) + circ(0, -80, 30), fill: 'currentColor' }),
    h('path', { d: frameD, fill: 'none', stroke: 'currentColor', 'stroke-width': 7, 'stroke-linecap': 'round' }),
    h('path', { d: 'M-101 -287Q-60 -296 -23 -287L-40 -279H-90Z', fill: 'currentColor' }),
    h('path', { d: poly([[B.basket.x0, B.basket.y0], [B.basket.x1, B.basket.y0], [B.basket.x1 - 6, B.basket.y1], [B.basket.x0 + 6, B.basket.y1]]), fill: 'currentColor' }));
  const PSLOTS = ['tail', 'wingFarUpper', 'thighFar', 'shankFar', 'footFar', 'body', 'crest', 'head', 'pouch', 'billLower', 'billUpper', 'thighNear', 'shankNear', 'footNear', 'wingNearUpper', 'wingNearLower'];
  const pelShadow = h('g', { ...DD('fx:O:shadow-cast-pelican') },
    h('path', { 'data-ref': 'fx-shNeck', d: 'M0 0L0 0', fill: 'none', stroke: 'currentColor', 'stroke-width': 34, 'stroke-linecap': 'round' }),
    PSLOTS.map(s => h('g', { 'data-ref': 'fx-sh-' + s }, h('rect', { 'data-ref': 'fx-shr-' + s, x: 0, y: 0, width: 0, height: 0, fill: 'currentColor' }))));
  L.shadow += h('g', { 'data-ref': 'fx-cast', style: 'opacity:calc(var(--pb-n-shadowAlpha) * 1.3)', color: M('fxShadow') },
    h('g', { 'data-ref': 'fx-castM' }, h('g', { 'data-ref': 'fx-castP' }, bikeShadow, pelShadow)));
  L.shadow += h('g', { style: 'opacity:calc(0.55 + var(--pb-n-shadowAlpha))' }, contact('fx-cR', rhx), contact('fx-cF', fhx));

  // ============================================== headlamp glow (L-fx-back, rider-local)
  const lamp = B.lamp;
  const cone = smooth([[lamp[0] + 2, lamp[1] - 6], [330, -120], [640, -26], [900, -2], [760, 16], [480, 18], [300, 4], [lamp[0] + 2, lamp[1] + 6]], true, 0.12);
  L.back += h('g', { 'data-ref': 'fx-riderB' },
    h('g', { 'data-ref': 'fx-beam', style: 'opacity:var(--pb-n-lampOn)', ...DD('fx:O:headlamp-beam') },
      h('path', { d: cone, fill: 'url(#fx-gBeam)' }),
      h('ellipse', { cx: 580, cy: 6, rx: 330, ry: 26, fill: 'url(#fx-gPool)' }),
      h('ellipse', { cx: 500, cy: 5, rx: 170, ry: 13, fill: 'url(#fx-gPool)' })));

  // ============================================== fireflies (L-fx-back) + far twinkles (L-gulls-far)
  const glow = r => h('circle', { r, fill: 'url(#fx-gGlow)' });
  const bug = h('path', { d: 'M-3.6 -0.2C-3 -1.8 1.2 -2 2.6 -0.8C3.4 0.4 1.2 1.6 -1 1.4C-2.4 1.3 -3.8 0.8 -3.6 -0.2Z', fill: M('fxBeeDark') }) +
    h('path', { d: 'M-0.6 -1.2C-2 -4.6 -4.8 -5 -4.8 -3.2C-4.6 -2 -2.6 -1.4 -0.6 -1.2ZM0.6 -1.4C0.8 -4.8 3.2 -5.6 3.4 -3.8C3.4 -2.6 2 -1.8 0.6 -1.4Z', fill: PAPER, opacity: 0.8, stroke: SOFT, 'stroke-width': 0.4 }) +
    h('path', { d: circ(-3.4, 0.2, 1.7), fill: v('headlamp') });
  const FF = [];
  const Rf = rng('fx-ff');
  for (let i = 0; i < 8; i++) FF.push({ x: 180 + i * 150 + Rf() * 60, y: 360 + Rf() * 380, ax: 20 + Rf() * 30, ay: 12 + Rf() * 22, w: 0.4 + Rf() * 0.5, p: 2.2 + Rf() * 2.4, ph: Rf() });
  L.back += h('g', { 'data-ref': 'fx-ffG', visibility: 'hidden' }, FF.map((q, i) => h('g', { 'data-ref': 'fx-ff' + i, ...DD('fx:O:fireflies') }, glow(15), h('g', { transform: 'translate(3 0) scale(1.4)' }, bug))));
  const FFF = [];
  for (let i = 0; i < 6; i++) FFF.push({ x: Rf() * 2600 - 500, y: 500 + Rf() * 70, p: 1.6 + Rf() * 2, ph: Rf() });
  L.far += h('g', { 'data-ref': 'fx-fffG', visibility: 'hidden' }, FFF.map((q, i) => h('g', { 'data-ref': 'fx-fff' + i, ...DD('fx:O:fireflies-far') }, glow(6))));

  // ============================================== ONE calm breeze swirl (L-fx-back, upper sky)
  // A soft painted curl: a cream brush line that draws on slowly, holds, and wipes off, plus a fainter echo line.
  const SW = ['M0 0C-40 -8 -96 6 -140 -4C-176 -12 -186 -52 -156 -58C-130 -62 -122 -34 -144 -32C-152 -31 -156 -38 -152 -42',
    'M-20 16C-54 12 -90 20 -122 14'];
  // ONE set of 3 curls (big, medium, small), drifting together; a warm-brown under-line makes them read on pale sky.
  const SWS = [[0, 0, 1], [175, 34, 0.7], [330, -6, 0.55]];
  const curl = (i, sc) => h('g', { 'data-ref': 'fx-curl' + i, transform: `translate(${SWS[i][0]} ${SWS[i][1]}) scale(${sc})`, ...(i === 0 ? DD('fx:O:wind-swirl') : {}) },
    h('path', { 'data-ref': `fx-curl${i}u`, d: SW[0], pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, fill: 'none', stroke: LINE, 'stroke-width': 6, opacity: 0.22, 'stroke-linecap': 'round', transform: 'translate(0.8 1.6)' }),
    SW.map((d, k) => h('path', { 'data-ref': `fx-curl${i}p${k}`, d, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, fill: 'none', stroke: PAPER, 'stroke-width': k ? 2.6 : 4.2, opacity: k ? 0.6 : 0.9, 'stroke-linecap': 'round' })),
    h('path', { d: SW[0], pathLength: 1, 'data-ref': `fx-curl${i}p2`, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, fill: 'none', stroke: v('skyWashWarm'), 'stroke-width': 1.4, transform: 'translate(1.5 3)', opacity: 0.6, 'stroke-linecap': 'round' }));
  L.back += h('g', { 'data-ref': 'fx-curlG', visibility: 'hidden' }, SWS.map((q, i) => curl(i, q[2])));
  // ============================================== sparse speed strokes (sprint only)
  const SLD = [brush([0, 0], [-100, 0.5], 4.6, 0.6) + brush([-16, 5.4], [-60, 5.8], 1.6, 0.3), brush([0, 0], [-86, -0.4], 3.8, -0.5) + brush([-30, -4.6], [-74, -5], 1.4, -0.2)];
  L.front += h('g', { 'data-ref': 'fx-slG', visibility: 'hidden', ...DD('fx:O:speed-lines') }, SPEEDLINES.map((_, i) => h('path', {
    'data-ref': 'fx-sl' + i, d: SLD[i % 2], fill: PAPER, visibility: 'hidden',
  })));

  // ============================================== bumblebee (L-fx-back, day)
  const beeWing = 'M-1 -3C-3 -9 -9 -11 -9.6 -7.6C-10 -5 -5 -3.2 -1 -3ZM1.4 -3.4C1.6 -10 6.6 -12 7.6 -9C8.2 -6.8 4.8 -4.2 1.4 -3.4Z';
  const Rb0 = rng('fx-bee');
  const fuzz = Array.from({ length: 18 }, (_, i) => { const a = (i / 18) * TAU, r = 5.6 + Rb0() * 0.8; return brush([Math.cos(a) * 4.6 * 1.25, Math.sin(a) * 4.6], [Math.cos(a) * r * 1.25, Math.sin(a) * r], 0.8); }).join('');
  L.back += h('g', { 'data-ref': 'fx-beeG', visibility: 'hidden' },
    h('path', { 'data-ref': 'fx-beeTrail', d: 'M0 0', fill: 'none', stroke: SOFT, 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-dasharray': '0 6', opacity: 0.7 }),
    h('g', { 'data-ref': 'fx-bee', ...DD('fx:O:bumblebee') },
      h('g', { 'data-ref': 'fx-beeW' }, h('path', { d: beeWing, fill: M('fxWing'), opacity: 0.85, stroke: LINE, 'stroke-width': 0.6 })),
      h('ellipse', { rx: 6.8, ry: 5.2, fill: M('fxBee') }),
      h('g', DD('fx:T:bee-stripes'),
        h('path', { d: 'M-1.6 -5.1C-2.6 -2 -2.6 2 -1.6 5.1L0.8 5.1C-0.2 2 -0.2 -2 0.8 -5.1ZM-5.6 -3.2C-6.4 -1 -6.4 1 -5.6 3.2L-3.8 4.4C-4.6 1.6 -4.6 -1.6 -3.8 -4.4Z', fill: M('fxBeeDark') }),
        h('path', { d: fuzz, fill: M('fxBee'), opacity: 0.8 })),
      h('path', { d: 'M-6.8 0C-6.8 -3 -3.6 -5.2 0 -5.2C3.6 -5.2 6.8 -3 6.8 0C6.8 3 3.6 5.2 0 5.2C-3.6 5.2 -6.8 3 -6.8 0Z', fill: 'none', stroke: LINE, 'stroke-width': 0.9 }),
      h('path', { d: circ(6.6, -0.6, 3.1), fill: M('fxBeeDark') }), h('path', { d: circ(7.6, -1.4, 0.8), fill: PAPER }),
      h('path', { d: 'M8 -3Q9 -6.4 11 -7M6.6 -3.4Q6.6 -6.6 8 -7.8M-7 0.4L-9 1.2', fill: 'none', stroke: LINE, 'stroke-width': 0.7, 'stroke-linecap': 'round' })));

  // ============================================== dust + grit + landing (L-fx-front)
  // soft gouache dust puff: a round cluster of overlapping lobes (no flat base, it is airborne), a warm sand
  // under-glaze peeking out below, a paper highlight dab and a broken,
  // faint brown line over the top lobes only — a picture-book "poof", not a heap.
  const Rd = rng('fx-dust');
  const LOBES = [[0, -1.5, 6.2], [-6.4, 0.6, 4.8], [6.2, 0.8, 5], [-2.4, 3.4, 4.2], [3, -5.6, 4.1], [-4.2, -4.4, 3.4]];
  const puffV = [0, 1, 2].map(() => LOBES.map(([x, y, rr]) => [x + (Rd() - 0.5) * 2.2, y + (Rd() - 0.5) * 1.8, rr * (0.85 + 0.3 * Rd())]));
  const lobeArc = ([x, y, rr], a0, a1) => { const p = a => [x + rr * Math.cos(a * D2R), y + rr * Math.sin(a * D2R)]; const s = p(a0), e = p(a1); return `M${f(s[0])} ${f(s[1])}A${f(rr)} ${f(rr)} 0 0 1 ${f(e[0])} ${f(e[1])}`; };
  const puff = (ref, key, vi) => {
    const lb = puffV[vi % 3];
    const body = lb.map(([x, y, rr]) => circ(x, y, rr)).join('');
    const shade = lb.filter(l => l[1] > -1).map(([x, y, rr]) => circ(x + 0.6, y + 1.8, rr * 0.96)).join('');
    const tagT = key === 'fx:O:dust-puff' && vi === 0 ? DD('fx:T:dust-drybrush') : {};
    return h('g', { 'data-ref': ref, visibility: 'hidden', ...DD(key) },
      h('path', { d: shade, fill: M('fxDustShade'), opacity: 0.55 }),
      h('path', { d: body, fill: M('fxDust'), opacity: 0.92 }),
      h('path', { d: lobeArc(lb[4], 200, 300) + lobeArc(lb[0], 250, 330) + lobeArc(lb[2], 280, 350), fill: 'none', stroke: SOFT, 'stroke-width': 0.7, 'stroke-linecap': 'round', opacity: 0.55, ...tagT }),
      h('path', { d: brush([lb[4][0] - 2.4, lb[4][1] - 0.4], [lb[4][0] + 1.4, lb[4][1] - 2.4], 1.3, -0.4) + brush([lb[1][0] - 2, lb[1][1] - 1.2], [lb[1][0] + 0.8, lb[1][1] - 2.6], 1, -0.3), fill: PAPER, opacity: 0.9 }));
  };
  const NDUST = 10, NGRIT = 10, NBURST = 8;
  L.front += h('g', {}, Array.from({ length: NDUST }, (_, i) => puff('fx-dust' + i, 'fx:O:dust-puff', i)));
  L.front += h('g', {}, Array.from({ length: NGRIT }, (_, i) => h('path', {
    'data-ref': 'fx-grit' + i, ...DD('fx:O:dust-grit'), visibility: 'hidden', d: i % 3 ? circ(0, 0, 1.5) : 'M-1.8 -1.2L1.9 -0.6L0.4 1.8Z', fill: i % 3 === 1 ? M('fxDustShade') : SOFT,
  })));
  L.front += h('g', { 'data-ref': 'fx-burstG', visibility: 'hidden' }, Array.from({ length: NBURST }, (_, i) => puff('fx-bp' + i, 'fx:O:land-dust-burst', i)));
  const bumpArcs = [-150, -115, -65, -30].map((a, i) => { const r0 = 16 + (i % 2) * 5, c = Math.cos(a * D2R), s = Math.sin(a * D2R); return brush([c * r0, s * r0], [c * (r0 + 14), s * (r0 + 14)], 2.4, i < 2 ? 1.5 : -1.5); }).join('');
  const impact = ref => h('g', { 'data-ref': ref },
    h('path', { d: bumpArcs, fill: LINE }),
    h('path', { transform: 'translate(-40 -26)', d: sparkle(6, 1.4), fill: M('fxStar'), stroke: LINE, 'stroke-width': 0.6 }),
    h('path', { transform: 'translate(38 -30)', d: sparkle(4.6, 1.1), fill: M('fxStar'), stroke: LINE, 'stroke-width': 0.6 }));
  L.front += h('g', { 'data-ref': 'fx-impG', visibility: 'hidden', ...DD('fx:O:land-bump-marks') }, impact('fx-impR'), impact('fx-impF'));

  // ============================================== feathers (L-fx-front), seeds (L-fx-back, behind the rider)
  const vane = 'M0 0C3 -4 10 -7 18 -6.4C23 -6 26 -3.6 27 -1C24 1.6 19 3.2 12 3.2L10.6 1.2L9 3.2C5 3 2 2 0 0Z';
  const contourFeather = (tag) => h('g', tag ? DD('fx:O:feather-contour') : {},
    h('path', { d: vane, fill: PAPER }),
    h('path', { d: 'M1 0.4C5 1.4 9 2.8 12 3.2L10.6 1.2L9 3.2C12 3.2 19 3 24 1C18 0.4 10 -0.2 1 0.4Z', fill: M('plumeShade'), ...(tag ? DD('fx:T:feather-glaze') : {}) }),
    inked(vane, 1),
    h('path', { d: 'M-4 1.2C4 0 14 -0.8 26.4 -1.2', fill: 'none', stroke: LINE, 'stroke-width': 0.9, 'stroke-linecap': 'round' }),
    h('path', { d: 'M8 -0.4L12 -5M13 -0.7L17 -5.6M18 -0.9L21.4 -5M14 -0.6L17 2.8M20 -1L22.6 1.8', fill: 'none', stroke: SOFT, 'stroke-width': 0.55, 'stroke-linecap': 'round' }));
  const downD = [[0, 0, -8, -9], [0, 0, 0, -12], [0, 0, 8, -9], [0, 0, 11, -2], [0, 0, -11, -2], [0, 0, -5, -11], [0, 0, 5, -11]]
    .map(([x0, y0, x1, y1]) => `M${x0} ${y0}Q${f(x1 * 0.3 + y1 * 0.25)} ${f(y1 * 0.55 - x1 * 0.2)} ${x1} ${y1}`).join('');
  const downFeather = h('g', { ...DD('fx:O:feather-down') },
    h('path', { d: downD + 'M0 0L0.6 5', fill: 'none', stroke: LINE, 'stroke-width': 3.6, 'stroke-linecap': 'round', opacity: 0.6 }),
    h('path', { d: downD + 'M0 0L0.6 5', fill: 'none', stroke: SOFT, 'stroke-width': 2.6, 'stroke-linecap': 'round' }),
    h('path', { d: downD + 'M0 0L0.6 5', fill: 'none', stroke: PAPER, 'stroke-width': 1.8, 'stroke-linecap': 'round' }));
  L.front += h('g', {}, [contourFeather(true), downFeather, contourFeather(false)].map((fe, i) => h('g', { 'data-ref': 'fx-fea' + i, visibility: 'hidden' }, fe)));
  const seedRays = Array.from({ length: 9 }, (_, i) => { const a = (-165 + i * (150 / 8)) * D2R; return [Math.cos(a) * 6, Math.sin(a) * 6]; });
  const seed = h('g', {},
    h('path', { d: seedRays.map(([x, y]) => `M0 0L${f(x)} ${f(y)}`).join('') + 'M0 0L0.4 9', fill: 'none', stroke: LINE, 'stroke-width': 1.7, 'stroke-linecap': 'round', opacity: 0.55 }),
    h('path', { d: seedRays.map(([x, y]) => circ(x, y, 1.25)).join(''), fill: LINE, opacity: 0.5 }),
    h('path', { d: seedRays.map(([x, y]) => `M0 0L${f(x)} ${f(y)}`).join('') + 'M0 0L0.4 9', fill: 'none', stroke: PAPER, 'stroke-width': 0.8, 'stroke-linecap': 'round' }),
    h('path', { d: seedRays.map(([x, y]) => circ(x, y, 0.8)).join(''), fill: PAPER }),
    h('path', { d: seedRays.map(([x, y]) => `M0 0L${f(x)} ${f(y)}`).join(''), fill: 'none', stroke: SOFT, 'stroke-width': 0.3, opacity: 0.6 }),
    h('ellipse', { cx: 0.45, cy: 10.4, rx: 0.95, ry: 2, fill: M('trunk') }));
  L.back += h('g', { 'data-ref': 'fx-seedG' }, [0, 1, 2, 3].map(i => h('g', { 'data-ref': 'fx-seed' + i, ...DD('fx:O:seed-dandelion') }, seed)));

  // ============================================== butterflies, dragonfly, leaf, fly, ladybird (L-fx-front)
  const FW = 'M0.5 -1C2 -6 5 -13 7.5 -17C4 -18.8 -2 -17.8 -5 -14C-4.5 -9 -2.5 -4 0.5 -1Z';
  const HW = 'M-0.5 -0.8C-3 -3 -6 -6 -8.5 -10.4C-10.4 -7 -10.2 -3.4 -7.5 -1.4C-5 -0.4 -2.5 -0.4 -0.5 -0.8Z';
  const bfBody = h('path', { d: 'M-5 0.4C-3 -0.9 3 -1.1 5 -0.2C3 1.1 -3 1.4 -5 0.4Z' + circ(5.9, -0.4, 1.4), fill: LINE }) +
    h('path', { d: 'M6 -1.2Q8.4 -5.4 10.6 -7.2M6.3 -0.8Q9.6 -4.4 12.2 -5.2', fill: 'none', stroke: LINE, 'stroke-width': 0.5, 'stroke-linecap': 'round' }) +
    h('path', { d: circ(10.6, -7.2, 0.65) + circ(12.2, -5.2, 0.65), fill: LINE });
  const monarch = h('g', { 'data-ref': 'fx-bf0', ...DD('fx:O:butterfly-monarch') },
    h('g', { 'data-ref': 'fx-bfw0' },
      h('path', { d: FW + HW, fill: M('fxMonarch') }),
      h('g', { ...DD('fx:T:butterfly-monarch-veins') },
        h('path', { d: 'M7.5 -17C4 -18.8 -2 -17.8 -5 -14L-3.6 -12.6C-1 -15.4 3.6 -16.4 6.6 -15.4ZM-8.5 -10.4C-10.4 -7 -10.2 -3.4 -7.5 -1.4L-6.4 -2.6C-8.4 -4.4 -8.6 -7 -7.6 -9Z', fill: M('fxMonarchDeep') }),
        h('path', { d: 'M0.5 -1.4L6 -15.4M0 -1.6L1.6 -16.8M-0.6 -1.6L-3.6 -14M-0.5 -1L-7.6 -9.2M-0.8 -0.9L-9 -4.6M1.2 -9L4.4 -8.2', fill: 'none', stroke: LINE, 'stroke-width': 0.55, 'stroke-linecap': 'round', opacity: 0.8 }),
        h('path', { d: [[6, -16.4], [3.4, -17.6], [0.4, -17.4], [-2.6, -16.2], [-8.4, -8.2], [-9.2, -5], [-8.2, -2.6]].map(([x, y]) => circ(x, y, 0.5)).join('') + circ(4.4, -14.4, 0.8), fill: PAPER })),
      inked(FW + HW, 1.1)),
    bfBody);
  const white = h('g', { 'data-ref': 'fx-bf1', ...DD('fx:O:butterfly-white') },
    h('g', { 'data-ref': 'fx-bfw1' },
      h('path', { d: FW + HW, fill: M('fxBrimstone') }),
      h('path', { d: circ(1.8, -10, 1.2) + circ(-5.6, -5.8, 0.9), fill: M('fxMonarch') }),
      inked(FW + HW, 1)),
    bfBody);
  L.front += monarch + white;
  const dWing = (x, y, len, w) => `M${x} ${y}C${f(x - w * 0.6)} ${f(y - len * 0.35)} ${f(x - w * 0.5)} ${f(y - len)} ${f(x + w * 0.2)} ${f(y - len)}C${f(x + w * 0.6)} ${f(y - len * 0.8)} ${f(x + w * 0.4)} ${f(y - len * 0.3)} ${x} ${y}Z`;
  const dragonfly = h('g', { 'data-ref': 'fx-dfly', ...DD('fx:O:dragonfly') },
    h('g', { 'data-ref': 'fx-dflyW' },
      h('path', { d: dWing(1, -1, 15, 5) + dWing(-2.4, -1, 13.5, 5), fill: M('fxWing'), stroke: LINE, 'stroke-width': 0.7, 'stroke-linejoin': 'round', opacity: 0.9 }),
      h('path', { ...DD('fx:T:dragonfly-venation'), d: 'M1 -1L0.8 -15M-2.4 -1L-3.2 -13.4M-0.6 -7L2.6 -8.4M-0.6 -11L2.2 -12.6M-3.8 -6.4L-0.6 -7.4M-4 -10.2L-1 -11', fill: 'none', stroke: SOFT, 'stroke-width': 0.5 }),
      h('path', { d: circ(2.3, -13.6, 0.85) + circ(-1.4, -12, 0.85), fill: M('fxTealDeep') })),
    h('path', { d: 'M-2 -1L-22 -0.6L-23.6 0.3L-22 1.1L-2 1.3Z', fill: M('fxTeal'), stroke: LINE, 'stroke-width': 0.6, 'stroke-linejoin': 'round' }),
    h('path', { d: [-5, -8, -11, -14, -17, -20].map(x => `M${x} -0.8V1.1`).join(''), stroke: M('fxTealDeep'), 'stroke-width': 0.9, fill: 'none' }),
    h('path', { d: 'M-2.6 -1.8C0 -2.8 3.6 -2.6 4.6 -0.8C3.8 1.2 0 1.8 -2.6 1.2Z', fill: M('fxTeal'), stroke: LINE, 'stroke-width': 0.6 }),
    h('path', { d: circ(5.6, -0.4, 2.4), fill: M('fxStarDeep'), stroke: LINE, 'stroke-width': 0.6 }), h('path', { d: circ(6.2, -1.1, 0.75), fill: PAPER }));
  L.front += dragonfly;
  L.front += h('g', { 'data-ref': 'fx-leaf', visibility: 'hidden', ...DD('fx:O:leaf-tumble') }, h('g', { 'data-ref': 'fx-leafS' },
    h('path', { d: 'M-12 0C-6 -7 6 -7.6 13 0C6 6.6 -6 6.4 -12 0Z', fill: M('fxLeaf') }),
    h('path', { d: 'M-11 0.4C-5 5.6 6 6 12.4 0.6C6 3.4 -4 3.4 -11 0.4Z', fill: M('fxLeafDeep'), opacity: 0.7 }),
    inked('M-12 0C-6 -7 6 -7.6 13 0C6 6.6 -6 6.4 -12 0Z', 0.9),
    h('path', { d: 'M-15 0.6L12 0M-6 0.3L-2.6 -4.2M-1 0.2L2.6 -4.6M4 0.1L7 -3.6M-4 0.3L-1 4.2M1.6 0.2L4.6 4.2', fill: 'none', stroke: LINE, 'stroke-width': 0.7, 'stroke-linecap': 'round', opacity: 0.85 })));
  const flyPt = u => [FLY_C[0] + FLY_A[0] * Math.sin(TAU * u), FLY_C[1] + FLY_A[1] * Math.sin(2 * TAU * u) - 10 * Math.cos(TAU * u)];
  const FLYN = 120, flyPts = Array.from({ length: FLYN }, (_, i) => flyPt(i / FLYN));
  const flyLen = [0]; for (let i = 1; i <= FLYN; i++) { const a = flyPts[i - 1], b = flyPts[i % FLYN]; flyLen.push(flyLen[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const flyTotal = flyLen[FLYN];
  const flyG = h('g', { 'data-ref': 'fx-flyG' },
    h('path', { 'data-ref': 'fx-flyTrail', d: poly(flyPts), fill: 'none', stroke: SOFT, 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-dasharray': `${'0 5.5 '.repeat(7)}0 ${f(flyTotal - 38.5)}`, ...DD('fx:T:fly-dotted-trail') }),
    h('g', { 'data-ref': 'fx-fly', ...DD('fx:O:basket-fly') },
      h('g', { 'data-ref': 'fx-flyW' }, h('path', { d: 'M-0.5 -1.2C-3 -6 -7 -6.4 -6.4 -3.6C-6 -2 -3 -1.2 -0.5 -1.2ZM0.4 -1.2C0 -6.4 3.2 -7.6 3.6 -4.8C3.8 -3 2 -1.6 0.4 -1.2Z', fill: M('fxWing'), stroke: LINE, 'stroke-width': 0.5, opacity: 0.9 })),
      h('path', { d: 'M-3.4 0C-3.4 -1.6 1.6 -2 2.6 -0.4C2 1.6 -3 1.6 -3.4 0Z' + circ(3.6, -0.6, 1.5), fill: M('fxBeeDark') }),
      h('path', { d: circ(4.3, -1.1, 0.75), fill: M('fxHeart') }), h('path', { d: circ(4.5, -1.3, 0.25), fill: PAPER })));
  // ladybird on the basket front (rider-local): crawls slowly left and right, little legs ticking
  const lady = h('g', { 'data-ref': 'fx-lady', ...DD('fx:O:ladybird') },
    h('g', { 'data-ref': 'fx-ladyL' }, h('path', { d: 'M-2.6 2.6L-3.8 4.4M0 3L0 4.8M2.6 2.6L3.8 4.4', fill: 'none', stroke: LINE, 'stroke-width': 0.6, 'stroke-linecap': 'round' })),
    h('path', { d: 'M-4.6 1.6C-4.6 -2.4 -2 -4 0.4 -4C3 -4 4.6 -2.2 4.6 1.6Z', fill: M('fxLady') }),
    h('path', { d: circ(-2.2, -1.4, 0.9) + circ(1.8, -2, 0.8) + circ(-0.6, 0.4, 0.75) + circ(2.8, 0.2, 0.6), fill: M('fxBeeDark') }),
    h('path', { d: 'M0.2 -4V1.6', stroke: M('fxBeeDark'), 'stroke-width': 0.5 }),
    h('path', { d: 'M4.4 -1.4C6.8 -1.6 7.4 0.2 6.8 1.6L4.4 1.6Z', fill: M('fxBeeDark') }),
    h('path', { d: circ(5.9, -0.4, 0.4) + circ(5.3, 0.3, 0.3), fill: PAPER }),
    inked('M-4.6 1.6C-4.6 -2.4 -2 -4 0.4 -4C3 -4 4.6 -2.2 4.6 1.6Z', 0.6),
    h('path', { d: 'M-2.8 -2.6A3 3 0 0 1 -0.6 -3.4', fill: 'none', stroke: PAPER, 'stroke-width': 0.6, 'stroke-linecap': 'round', opacity: 0.8 }));

  // ============================================== sparkles, lamp glow, moths, wave arcs (L-fx-front, rider-local)
  const flare = h('g', { 'data-ref': 'fx-flare', transform: `translate(${lamp[0] + 5} ${lamp[1]})`, style: 'opacity:var(--pb-n-lampOn)', ...DD('fx:O:lamp-flare') },
    glow(40), h('path', { 'data-ref': 'fx-flareStar', d: sparkle(24, 1.6), fill: v('headlamp'), opacity: 0.9 }));
  const moth = i => h('g', { 'data-ref': 'fx-moth' + i },
    h('g', { 'data-ref': 'fx-mothW' + i }, h('path', { d: 'M1 -0.6C-1 -4 -4 -6.8 -6.2 -4.6C-7 -2.6 -5.6 -0.6 -4.6 -0.4Z', fill: PAPER, stroke: SOFT, 'stroke-width': 0.7, 'stroke-linejoin': 'round' })),
    h('path', { d: 'M-4.2 0.4C-3 -1 2 -1.2 3 0C2 1.1 -3 1.3 -4.2 0.4Z', fill: SOFT }));
  const glintBell = h('g', { 'data-ref': 'fx-glB', ...DD('fx:O:glint-bell') }, h('path', { d: sparkle(12.5, 1.8), fill: PAPER }), h('path', { d: circ(0, 0, 2.2), fill: M('fxStar') }));
  const glintRim = h('g', { 'data-ref': 'fx-glR', ...DD('fx:O:glint-rim') },
    h('path', { d: sparkle(14, 1.7), fill: PAPER }), h('path', { d: sparkle(6.6, 1.2), fill: PAPER, transform: 'rotate(45)' }),
    h('path', { d: circ(0, 0, 3.6), fill: 'none', stroke: M('fxStar'), 'stroke-width': 1 }));
  const waveArcs = h('g', { 'data-ref': 'fx-waveArcs', visibility: 'hidden', ...DD('fx:O:wave-arcs') },
    h('path', { d: brush([-8, -40], [30, -44], 2.6, -8) + brush([-2, -54], [36, -60], 2.6, -10) + brush([14, -30], [34, -32], 2.2, -4), fill: LINE, opacity: 0.85 }),
    h('path', { transform: 'translate(44 -52)', d: sparkle(5, 1.2), fill: M('fxStar'), stroke: LINE, 'stroke-width': 0.5 }));
  L.front += h('g', { 'data-ref': 'fx-riderF' }, flyG, lady, glintBell, glintRim, flare, h('g', { 'data-ref': 'fx-mothG', visibility: 'hidden', ...DD('fx:O:moths') }, [0, 1, 2].map(moth)), waveArcs);

  // ============================================== pops (L-fx-front, world): sticker words on cloud bubbles
  const star = (x, y, r, col = M('fxStar')) => h('path', { transform: `translate(${f(x)} ${f(y)})`, d: starD(r), fill: col, stroke: LINE, 'stroke-width': 1.1, 'stroke-linejoin': 'round' });
  const heartD = 'M0 4.6C-5 1 -8 -1.6 -8 -4.6C-8 -7.2 -6 -8.6 -4 -8.6C-2.2 -8.6 -0.8 -7.6 0 -6C0.8 -7.6 2.2 -8.6 4 -8.6C6 -8.6 8 -7.2 8 -4.6C8 -1.6 5 1 0 4.6Z';
  const heartArt = (sc = 1) => h('g', { transform: `scale(${sc})` },
    h('path', { d: heartD, fill: M('fxHeart'), stroke: LINE, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }),
    h('path', { d: 'M-5.4 -5.2A2.6 2.6 0 0 1 -3 -7', fill: 'none', stroke: M('fxHeartHi'), 'stroke-width': 1.4, 'stroke-linecap': 'round' }));
  const bubbleDot = (x, y, r) => h('g', { transform: `translate(${f(x)} ${f(y)})` }, h('path', { d: circ(0, 0, r), fill: M('fxSky'), opacity: 0.7, stroke: LINE, 'stroke-width': 0.9 }), h('path', { d: `M${f(-r * 0.5)} ${f(-r * 0.2)}A${f(r * 0.55)} ${f(r * 0.55)} 0 0 1 ${f(-r * 0.1)} ${f(-r * 0.6)}`, fill: 'none', stroke: PAPER, 'stroke-width': 0.9, 'stroke-linecap': 'round' }));
  const pop = (spec) => {
    const { word, zh, ref, key, col, rx, ry, sc, extras, seed } = spec;
    const Rp = rng('fx-pop' + ref);
    const W = glyphWord('fx-wd-' + ref, word, GLYPH_LAT, { seed, bounce: 4.5, tilt: 6 });
    const Z = glyphWord('fx-wz-' + ref, zh, GLYPH_ZH, { seed: seed + 3, bounce: 1.5, tilt: 3, track: 2 });
    defs += W.defs + Z.defs;
    const tx = -W.x0 - W.w / 2, ty = -(W.y0 + W.y1) / 2 - 22;
    const use = (a) => h('use', { href: '#fx-wd-' + ref, ...a });
    const letters = h('g', { transform: `scale(${sc}) translate(${f(tx)} ${f(ty)})`, ...DD('fx:T:pop-sticker-letters'), 'stroke-linejoin': 'round' },
      use({ fill: M('fxShadow'), stroke: M('fxShadow'), 'stroke-width': 20, opacity: 0.3, transform: 'translate(5 6)' }),
      use({ fill: LINE, stroke: LINE, 'stroke-width': 19 }),
      use({ fill: PAPER, stroke: PAPER, 'stroke-width': 11 }),
      use({ fill: M(col), stroke: LINE, 'stroke-width': 2.2 }),
      use({ fill: 'none', stroke: PAPER, 'stroke-width': 1.6, opacity: 0.55, transform: 'translate(-1.6 -2)', 'stroke-dasharray': '6 14' }));
    const zs = 0.2, zt = `translate(${f(-(Z.x0 + Z.w / 2) * zs)} ${f(ry * 0.56)}) scale(${zs}) translate(0 ${f(-(Z.y0 + Z.y1) / 2)})`;
    const cloud = bubble(rx, ry, 11, Rp);
    return h('g', { 'data-ref': 'fx-' + ref, visibility: 'hidden', ...DD(key) },
      h('g', { 'data-ref': `fx-${ref}Rays` }, extras),
      h('path', { d: cloud, fill: M('fxShadow'), opacity: 0.25, transform: 'translate(4 5)' }),
      h('path', { d: cloud, fill: PAPER }),
      h('path', { d: bubble(rx * 0.86, ry * 0.8, 9, Rp), fill: M('fxDust'), opacity: 0.45 }),
      inked(cloud, 2.2), pencil(cloud, 2.2, 1.2, -1),
      letters,
      h('g', { transform: zt }, h('use', { href: '#fx-wz-' + ref, fill: LINE })));
  };
  L.front += pop({ word: 'Ding!', zh: '叮铃', ref: 'popDing', key: 'fx:O:pop-ding', col: 'fxDing', rx: 98, ry: 56, sc: 0.52, seed: 11,
    extras: star(-96, -40, 9) + star(92, -46, 7) + star(104, 30, 5.5, M('fxHeartHi')) + h('path', { transform: 'translate(-104 26)', d: sparkle(8, 1.6), fill: M('fxStar'), stroke: LINE, 'stroke-width': 0.7 }) +
      h('path', { d: brush([70, -64], [86, -80], 2.4, -2) + brush([82, -58], [102, -66], 2.2, -1.4), fill: LINE }) });
  L.front += pop({ word: 'Hop!', zh: '嘿哟', ref: 'popHop', key: 'fx:O:pop-hop', col: 'fxHop', rx: 88, ry: 54, sc: 0.54, seed: 23,
    extras: star(-80, -44, 8) + star(84, -38, 6.5, M('fxHeartHi')) + h('path', { transform: 'translate(-90 30)', d: sparkle(7, 1.5), fill: M('fxStar'), stroke: LINE, 'stroke-width': 0.7 }) +
      h('path', { d: brush([-52, 62], [-30, 56], 2.4, 2) + brush([-8, 66], [14, 66], 2.4, 2) + brush([30, 56], [52, 62], 2.4, 2), fill: LINE }) });
  L.front += pop({ word: 'Gulp!', zh: '咕嘟', ref: 'popGulp', key: 'fx:O:pop-gulp', col: 'fxGulp', rx: 100, ry: 56, sc: 0.5, seed: 37,
    extras: h('g', { transform: 'translate(-100 -34) rotate(-14)' }, heartArt(1.2)) + h('g', { transform: 'translate(98 -42) rotate(12)' }, heartArt(0.95)) +
      bubbleDot(-104, 26, 6) + bubbleDot(-116, 10, 3.6) + bubbleDot(106, 22, 4.6) + star(84, 50, 5.5) });
  // bell notes (eighth + beamed pair) and hum notes (quarter notes) — cream heads, warm brown line
  const noteStyle = { fill: PAPER, stroke: LINE, 'stroke-width': 2.2, 'paint-order': 'stroke', 'stroke-linejoin': 'round' };
  const note1 = h('path', { d: 'M-5.4 1.6A5.6 4 -20 1 1 -5.5 1.7ZM-0.8 -0.8V-22.4C2.6 -19.4 6.6 -17.4 7 -11.4C5.6 -14.4 3 -15.8 1.4 -16V-0.8Z', ...noteStyle });
  const note2 = h('path', { d: 'M0 0A5.4 3.9 -20 1 1 -0.1 0.1ZM16 -4A5.4 3.9 -20 1 1 15.9 -3.9ZM4.4 -2.2V-24L20.4 -28V-6.2H18.2V-22.4L6.6 -19.4V-2.2Z', ...noteStyle });
  const note3 = h('path', { d: 'M0 0A5 3.6 -20 1 1 -0.1 0.1ZM4.2 -2V-20H6.2V-2Z', fill: M('fxDing'), stroke: LINE, 'stroke-width': 1.6, 'paint-order': 'stroke', 'stroke-linejoin': 'round' });
  L.front += h('g', {}, h('g', { 'data-ref': 'fx-note0', visibility: 'hidden', ...DD('fx:O:bell-notes') }, h('g', { transform: 'translate(0 3.5)' }, note1)), h('g', { 'data-ref': 'fx-note1', visibility: 'hidden', ...DD('fx:O:bell-notes') }, note2));
  L.front += h('g', {}, [0, 1, 2].map(i => h('g', { 'data-ref': 'fx-hum' + i, visibility: 'hidden', ...DD('fx:O:hum-notes') }, i === 1 ? note1 : note3)));
  // gulp drips, hearts, fish bone
  L.front += h('g', {}, [0, 1, 2, 3].map(i => h('path', { 'data-ref': 'fx-drip' + i, ...DD('fx:O:gulp-drips'), visibility: 'hidden', d: 'M0 -4.6C1.6 -1.8 2.8 -0.2 2.8 1.4A2.8 2.8 0 0 1 -2.8 1.4C-2.8 -0.2 -1.6 -1.8 0 -4.6Z', fill: M('fxSky'), stroke: LINE, 'stroke-width': 0.9 })));
  L.front += h('g', {}, [0, 1, 2].map(i => h('g', { 'data-ref': 'fx-heart' + i, visibility: 'hidden', ...DD('fx:O:gulp-hearts') }, heartArt(1))));
  const boneD = 'M-16 0H13M-10 0L-13 -5M-10 0L-13 5M-4 0L-7 -6M-4 0L-7 6M2 0L-1 -6.4M2 0L-1 6.4M8 0L5 -5.6M8 0L5 5.6M-16 0L-22 -5M-16 0L-22 5';
  L.front += h('g', { 'data-ref': 'fx-bone', visibility: 'hidden', ...DD('fx:O:fish-bone') },
    h('path', { d: boneD, fill: 'none', stroke: LINE, 'stroke-width': 3.8, 'stroke-linecap': 'round' }),
    h('path', { d: 'M12 -5.6C17 -6 21 -3 21.6 0C21 3 17 6 12 5.6Z', fill: PAPER, stroke: LINE, 'stroke-width': 1.5, 'paint-order': 'stroke' }),
    h('path', { d: boneD, fill: 'none', stroke: PAPER, 'stroke-width': 1.7, 'stroke-linecap': 'round' }),
    h('path', { d: circ(16.4, -1.2, 1.3), fill: LINE }));

  return {
    defs,
    layers: {
      'L-gulls-far': L.far,
      'L-shadow': L.shadow,
      'L-fx-back': L.back,
      'L-fx-front': L.front,
    },
  };
}

// ------------------------------------------------------------------------------------------------ attach
// ------------------------------------------------------------------------------------------------ attach
export function attach(svg, ctx) {
  if (typeof location !== 'undefined' && /[?&]fxoff\b/.test(location.search)) { for (const id of ['L-gulls-far--fx', 'L-shadow--fx', 'L-fx-back--fx', 'L-fx-front--fx']) { const g = svg.querySelector('#' + id); if (g) g.setAttribute('display', 'none'); } return {}; }
  const r = refs(svg, 'fx-');
  const cache = new Map();
  const set = (el, k, val) => { if (!el) return; let c = cache.get(el); if (!c) cache.set(el, c = {}); if (c[k] !== val) { c[k] = val; el.setAttribute(k, val); } };
  const vis = (el, on) => set(el, 'visibility', on ? 'visible' : 'hidden');
  const nofx = typeof location !== 'undefined' && /[?&]nofx\b/.test(location.search);

  // same layout constants as build()
  const R = ctx.rng('fx-gulls');
  const FAR = [];
  for (let i = 0; i < 7; i++) { const grp = i < 4 ? 0 : 1; FAR.push({ x0: grp * 1300 + i * 70 + R() * 50, y: (grp ? 150 : 205) + (i % 4) * 22 + R() * 18, s: 0.34 + R() * 0.14, f: 2.4 + R() * 1.2, ph: R() * 10, gl: R() * 10 }); }
  const ESC = [
    { idle: [400, 262], st: [455, 318], s: 1.15 },
    { idle: [-300, 420], st: [300, 405], s: 1.0 },
    { idle: [-300, 200], st: [612, 178], s: 0.92 },
    { idle: [-300, 120], st: [1115, 168], s: 0.85 },
  ];
  const Rf = ctx.rng('fx-ff');
  const FF = []; for (let i = 0; i < 8; i++) FF.push({ x: 180 + i * 150 + Rf() * 60, y: 360 + Rf() * 380, ax: 20 + Rf() * 30, ay: 12 + Rf() * 22, w: 0.4 + Rf() * 0.5, p: 2.2 + Rf() * 2.4, ph: Rf() });
  const FFF = []; for (let i = 0; i < 6; i++) FFF.push({ x: Rf() * 2600 - 500, y: 500 + Rf() * 70, p: 1.6 + Rf() * 2, ph: Rf() });
  const FRAME_SEQ = [0, 1, 2, 3, 2, 1];
  const flyPt = u => [FLY_C[0] + FLY_A[0] * Math.sin(TAU * u), FLY_C[1] + FLY_A[1] * Math.sin(2 * TAU * u) - 10 * Math.cos(TAU * u)];
  const FLYN = 120, flyPts = Array.from({ length: FLYN }, (_, i) => flyPt(i / FLYN));
  const flyLen = [0]; for (let i = 1; i <= FLYN; i++) { const a = flyPts[i - 1], b = flyPts[i % FLYN]; flyLen.push(flyLen[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const flyTotal = flyLen[FLYN];

  // cast-shadow capsules sized from each pelican slot's own art (bbox in joint-local space)
  const PSLOTS = ['tail', 'wingFarUpper', 'thighFar', 'shankFar', 'footFar', 'body', 'crest', 'head', 'pouch', 'billLower', 'billUpper', 'thighNear', 'shankNear', 'footNear', 'wingNearUpper', 'wingNearLower'];
  const shOK = {};
  for (const s of PSLOTS) {
    const el = svg.querySelector('#j-' + s), rect = r['shr-' + s];
    let bb = null;
    try { bb = el && el.getBBox(); } catch (e) { bb = null; }
    if (!bb || !(bb.width > 1 && bb.height > 1) || !rect) { shOK[s] = false; if (r['sh-' + s]) r['sh-' + s].setAttribute('visibility', 'hidden'); continue; }
    // trim the capsule a little (key lines, loose feather tips) so the flattened silhouette stays compact
    const k = s === 'body' ? 0.9 : 0.94, w = bb.width * k, hh = bb.height * k;
    rect.setAttribute('x', f1(bb.x + (bb.width - w) / 2)); rect.setAttribute('y', f1(bb.y + (bb.height - hh) / 2));
    rect.setAttribute('width', f1(w)); rect.setAttribute('height', f1(hh)); rect.setAttribute('rx', f1(Math.min(w, hh) / 2));
    shOK[s] = true;
  }
  const NDUST = 10, NGRIT = 10, NBURST = 8;
  const dust = Array.from({ length: NDUST }, (_, i) => r['dust' + i]);
  const grit = Array.from({ length: NGRIT }, (_, i) => r['grit' + i]);
  const bps = Array.from({ length: NBURST }, (_, i) => r['bp' + i]);
  const RC = BIKE.rearContact;
  const latest = (evs, type, t, win) => { let best = null; for (const e of evs || []) if (e.type === type) { const tau = t - e.t0; if (tau >= 0 && tau < win && (!best || e.t0 > best.t0)) best = e; } return best ? t - best.t0 : -1; };

  return {
    update(fr) {
      const t = fr.t, pose = fr.pose || {}, J = pose.joints || {};
      const reduced = !!(fr.reduced || ctx.reduced);
      const sp = fr.speed || 0, cad = fr.cadence || 0, D = fr.distance || 0;
      const night = fr.night || 0, day = 1 - night;
      const tg = fr.toggles || {};
      const ry = pose.riderY || 0, pitch = pose.bikePitch || 0, pr = pitch * D2R, pc = Math.cos(pr), ps = Math.sin(pr);
      // rider-local -> world
      const W = (x, y) => { const dx = x - RC[0], dy = y - RC[1]; return [RIDER_X + RC[0] + dx * pc - dy * ps, GROUND_Y + ry + RC[1] + dx * ps + dy * pc]; };
      const riderXf = `translate(${RIDER_X} ${f(GROUND_Y + ry)}) rotate(${f(pitch)} ${RC[0]} ${RC[1]})`;
      set(r.riderB, 'transform', riderXf); set(r.riderF, 'transform', riderXf);

      // ================= shadow
      const sun = fr.sun || { x: 1450, y: 330, elev: 0.3 }, moon = fr.moon || { x: 0, y: 0, elev: -1 };
      const src = sun.elev > -0.06 ? sun : (moon.elev > 0 ? moon : { x: RIDER_X + 200, elev: 0.6 });
      const low = 1 - clamp(src.elev, 0, 1);
      const c = clamp((src.x - RIDER_X) / 700, -1.3, 1.3) * (0.18 + 0.82 * low) * 0.8;
      const d = 0.03 + 0.055 * low;
      set(r.castM, 'transform', `matrix(1 0 ${f(c)} ${f(-d)} ${f(RIDER_X + c * ry)} ${f(GROUND_Y - d * ry)})`);
      set(r.castP, 'transform', `rotate(${f(pitch)} ${RC[0]} ${RC[1]})`);
      for (const s of PSLOTS) if (shOK[s] && J[s]) set(r['sh-' + s], 'transform', xf(J[s]));
      if (J.body && J.head) {
        const b = J.body, br = (b.rot || 0) * D2R, nb = [b.x + 112 * Math.cos(br) + 92 * Math.sin(br), b.y + 112 * Math.sin(br) - 92 * Math.cos(br)];
        const hd = J.head, mid = [(nb[0] + hd.x) / 2 + 22, (nb[1] + hd.y) / 2];
        set(r.shNeck, 'd', `M${f1(nb[0])} ${f1(nb[1])}Q${f1(mid[0])} ${f1(mid[1])} ${f1(hd.x)} ${f1(hd.y + 10)}`);
      }
      const lift = clamp(-ry / 48, 0, 1.2);
      set(r.cast, 'opacity', f(1 - 0.3 * lift));
      const hF = clamp(-(ry + 298 * ps) / 48, 0, 1.4);
      const cShadow = (el, x, hh, sq) => {
        const s = 1 - 0.55 * Math.min(1, hh);
        set(el, 'transform', `translate(${f(RIDER_X + x - c * hh * 48)} ${GROUND_Y + 1}) scale(${f(s * (1 + 0.06 * sq))} ${f(s)})`);
        set(el, 'opacity', f(1 - 0.7 * Math.min(1, hh)));
      };
      cShadow(r.cR, BIKE.rearHub[0], lift, (pose.tyre && pose.tyre.rear) || 0);
      cShadow(r.cF, BIKE.frontHub[0], hF, (pose.tyre && pose.tyre.front) || 0);

      // ================= far gulls
      const gullsOn = tg.gulls !== false;
      const escW = gullsOn ? sstep(83, 92, cad) : 0;
      for (let i = 0; i < FAR.length; i++) {
        const g = FAR[i], el = r['gfar' + i];
        if (!gullsOn) { vis(el, false); continue; }
        vis(el, true);
        const x = wrap(g.x0 + 170 * t - 0.15 * D, 2800) - 600;
        const y = g.y + 6 * Math.sin(0.6 * t + g.ph);
        const flapping = reduced ? true : Math.sin(0.35 * t + g.gl) > -0.35;
        const fi = flapping ? FRAME_SEQ[Math.floor(wrap((t * g.f + g.ph) * 6, 6))] : 1;
        set(el, 'href', '#fx-gf' + fi);
        set(el, 'transform', `translate(${f1(x)} ${f1(y)}) scale(${f(g.s)})`);
      }
      // escort gulls: companion glides at cruise; the whole flock swoops in above 85 rpm (staggered)
      for (let i = 0; i < ESC.length; i++) {
        const g = ESC[i], el = r['esc' + i];
        if (!gullsOn) { vis(el, false); continue; }
        const w = i === 0 ? escW : sstep(0, 1, (escW - i * 0.12) / 0.64);
        if (i > 0 && w <= 0.001) { vis(el, false); continue; }
        vis(el, true);
        const ew = w * w * (3 - 2 * w);
        const bobA = lerp(10, 14, ew), bobX = lerp(22, 16, ew);
        let x = lerp(g.idle[0], g.st[0], ew) + bobX * Math.sin(0.55 * t + i * 1.7);
        let y = lerp(g.idle[1], g.st[1], ew) + bobA * Math.sin(0.9 * t + i * 2.3) - 60 * Math.sin(Math.PI * ew) * (i ? 1 : 0.3);
        if (i === 0 && !ew) { x += 30 * Math.sin(0.23 * t); }
        // flap: continuous while escorting / arriving, glide + short bursts at cruise
        const burst = reduced ? 0 : Math.max(ew, sstep(0.55, 0.85, Math.sin(0.42 * t + 1.1 * i)));
        const ph = TAU * (i === 0 && ew < 0.5 ? 2.6 : 3.3) * t + i * 1.3;
        const s = lerp(0.3 + 0.05 * Math.sin(1.7 * t), Math.cos(ph) * 0.95 + 0.05, burst);
        const vy = bobA * 0.9 * Math.cos(0.9 * t + i * 2.3);
        set(el, 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(clamp(vy * 0.35, -6, 6) - 4 * burst * Math.sin(ph))}) scale(${f(g.s)})`);
        set(r['escWn' + i], 'transform', `scale(1 ${f(s)})`); set(r['escWf' + i], 'transform', `scale(1 ${f(s)})`);
      }

      // ================= headlamp / night
      const lampOn = sstep(0.2, 0.55, night);
      vis(r.beam, lampOn > 0.01); vis(r.flare, lampOn > 0.01);
      if (lampOn > 0.01) set(r.flareStar, 'transform', `rotate(${reduced ? 0 : f1(8 * Math.sin(t * 0.9))}) scale(${f(0.8 + 0.2 * Math.sin(t * 3.1))})`);
      vis(r.mothG, lampOn > 0.05); vis(r.ffG, night > 0.3); vis(r.fffG, night > 0.3);
      if (lampOn > 0.05) for (let i = 0; i < 3; i++) {
        const a = t * (2.2 + i * 0.7) + i * 2.1, rr = 22 + 12 * Math.sin(t * 1.3 + i * 4);
        const x = BIKE.lamp[0] + 8 + rr * Math.cos(a) + 6 * Math.sin(t * 7.1 + i), y = BIKE.lamp[1] - 4 + rr * 0.7 * Math.sin(a * 1.3);
        set(r['moth' + i], 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(Math.cos(a) * 25)})`);
        set(r['mothW' + i], 'transform', `scale(1 ${f(0.25 + 0.75 * Math.abs(Math.cos(t * 26 + i * 2)))})`);
      }
      if (night > 0.3) {
        const nf = reduced ? 5 : FF.length;
        for (let i = 0; i < FF.length; i++) {
          const q = FF[i], el = r['ff' + i];
          if (i >= nf) { vis(el, false); continue; }
          const x = wrap(q.x - 36 * t, 1500) + 50 + q.ax * Math.sin(q.w * t * 2.1 + i), y = q.y + q.ay * Math.sin(q.w * t * 1.3 + i * 2);
          const ph = wrap(t / q.p + q.ph, 1), blink = sstep(0, 0.1, ph) * (1 - sstep(0.5, 0.66, ph));
          vis(el, blink > 0.02);
          set(el, 'transform', `translate(${f1(x)} ${f1(y)})`); set(el, 'opacity', f(blink * sstep(0.3, 0.7, night)));
        }
        for (let i = 0; i < FFF.length; i++) {
          const q = FFF[i], el = r['fff' + i];
          const x = wrap(q.x - 0.15 * D * 0.5, 2600) - 500, ph = wrap(t / q.p + q.ph, 1), blink = sstep(0, 0.1, ph) * (1 - sstep(0.25, 0.4, ph));
          set(el, 'transform', `translate(${f1(x)} ${f1(q.y)})`); set(el, 'opacity', f(blink));
        }
      }

      // ================= dust puffs (rear tyre), rate & size by speed
      const sN = clamp(sp / 1885, 0, 1.8);        // 1 at 60 rpm
      const dens = clamp(0.25 + 0.5 * sN, 0, 1) * (reduced ? 0.4 : 1) * (lift > 0.05 ? 0 : 1);
      const DT = 0.085, LIFE = 0.62;
      for (let j = 0; j < NDUST; j++) {
        const k = Math.floor((t - j * DT) / (NDUST * DT)) * NDUST + j, age = t - k * DT, el = dust[j];
        const on = age >= 0 && age < LIFE && hash(k, 7) < dens;
        if (!on) { vis(el, false); continue; }
        vis(el, true);
        const u = age / LIFE, hk = hash(k, 3);
        const x = RIDER_X + RC[0] - 16 - (0.12 + 0.1 * hk) * sp * age * (1 - 0.3 * u) - 40 * age;
        const y = GROUND_Y - 3 - (22 + 30 * hk) * u - 6 * Math.sin(u * 3 + hk * 6);
        const s = (0.6 + 1.1 * Math.sqrt(u)) * (0.75 + 0.45 * Math.min(1.4, sN)) * (0.8 + 0.4 * hash(k, 5));
        // soft gouache puff: swells, thins out and dissolves (opacity), shrinking a little as it goes
        set(el, 'transform', `translate(${f1(x)} ${f1(y)}) scale(${f(s * (1 - 0.35 * sstep(0.55, 1, u)))})`);
        set(el, 'opacity', f(0.82 * sstep(0, 0.08, u) * (1 - sstep(0.35, 1, u))));
      }
      const gdens = clamp(-0.1 + 0.6 * sN, 0, 1) * (reduced ? 0.3 : 1) * (lift > 0.05 ? 0 : 1);
      const GDT = 0.05;
      for (let j = 0; j < NGRIT; j++) {
        const k = Math.floor((t - j * GDT) / (NGRIT * GDT)) * NGRIT + j, age = t - k * GDT, el = grit[j];
        const hk = hash(k, 11), vy0 = 260 + 280 * hash(k, 12), g = 2885;
        const tl = (2 * vy0) / g;
        const on = age >= 0 && age < tl && hash(k, 13) < gdens;
        if (!on) { vis(el, false); continue; }
        vis(el, true);
        const x = RIDER_X + RC[0] - 12 - (0.25 + 0.35 * hk) * sp * age - 90 * age;
        const y = GROUND_Y - 2 - (vy0 * age - 0.5 * g * age * age);
        set(el, 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(age * 900 * (hk - 0.5))})`);
      }

      // ================= landing burst + impact rays
      const tLand = latest(fr.events, 'hop', t, TIMING.hop.land + 1.2);
      const tl = tLand < 0 ? -1 : tLand - TIMING.hop.land;
      vis(r.burstG, tl >= 0 && tl < 0.9);
      if (tl >= 0 && tl < 0.9) {
        const u = tl / 0.9;
        for (let i = 0; i < NBURST; i++) {
          const side = i % 2 ? 1 : -1, wheelX = i < 4 ? BIKE.rearHub[0] : BIKE.frontHub[0];
          const hk = hash(i, 21), spd = (130 + 170 * hk) * side;
          const x = RIDER_X + wheelX + side * 22 + spd * (1 - Math.exp(-tl * 4)) / 4 * 3 - 0.3 * sp * tl;
          const y = GROUND_Y - 4 - (10 + 22 * hk) * (1 - Math.exp(-tl * 5));
          set(bps[i], 'transform', `translate(${f1(x)} ${f1(y)}) scale(${f((1.1 + 1.6 * u) * (0.8 + 0.4 * hk))})`);
          set(bps[i], 'opacity', f(1 - u)); vis(bps[i], true);
        }
      }
      const ti = tl >= 0 && tl < 0.22 && !nofx;
      vis(r.impG, ti);
      if (ti) {
        const u = tl / 0.22, s = reduced ? 1 : 0.7 + 0.5 * u;
        set(r.impR, 'transform', `translate(${RIDER_X + BIKE.rearHub[0]} ${GROUND_Y - 1}) scale(${f(s)})`);
        set(r.impF, 'transform', `translate(${RIDER_X + BIKE.frontHub[0]} ${GROUND_Y - 1}) scale(${f(s)})`);
        set(r.impG, 'opacity', f(1 - u * u));
      }

      // ================= ONE calm breeze swirl (STYLE-B §6, the user's feedback on edition C: slow, sparse, one language)
      // Only when really pedalling hard (> 75 rpm), about one in three 14-second windows, high in the sky; it draws on
      // slowly, holds, drifts a little and wipes off. Never while the weather's wind band is showing.
      {
        const curlOn = !reduced && !((fr.weather && fr.weather.wind) > 0.3);
        const P = 19, k = Math.floor(t / P), age = t - k * P, el = r.curlG, LIFE = 12;
        const act = curlOn && age < LIFE && (k === 0 || hash(k, 30) < 0.65);
        vis(el, act);
        if (act) {
          const u = age / LIFE, hk = hash(k, 40);
          const x = RIDER_X + 400 + 120 * hk - 9 * age, y = 262 + 22 * hash(k, 41) + 4 * Math.sin(age * 0.5);   // under the caption card, clear of the head
          set(el, 'transform', `translate(${f1(x)} ${f1(y)}) scale(${f(0.9 + 0.2 * hk)})`);
          for (let i = 0; i < 3; i++) {
            const d0 = 0.08 * i, draw = sstep(d0, d0 + 0.3, u), wipe = sstep(0.72 + 0.06 * i - 0.12, 0.98 - 0.06 * (2 - i), u);
            const o = f(1 - draw - wipe);
            set(r['curl' + i + 'p0'], 'stroke-dashoffset', o);
            set(r['curl' + i + 'u'], 'stroke-dashoffset', o);
            set(r['curl' + i + 'p2'], 'stroke-dashoffset', o);
            set(r['curl' + i + 'p1'], 'stroke-dashoffset', f(1 - sstep(d0 + 0.1, d0 + 0.42, u) - sstep(0.6, 0.94, u)));
          }
        }
      }
      const slW = (tg.speedlines !== false && !reduced) ? sstep(86, 98, cad) : 0;   // only a real sprint
      vis(r.slG, slW > 0.01);
      if (slW > 0.01) {
        for (let i = 0; i < SPEEDLINES.length; i++) {
          const [ax, ay] = SPEEDLINES[i], [xe, yy] = W(ax, ay);
          const P = 1.1, k = Math.floor((t + i * 0.37) / P), age = t + i * 0.37 - k * P, el = r['sl' + i];
          const on = hash(k, 50 + i) < 0.25 + 0.3 * slW;   // ≤ 4 strokes, slow rhythm, often fewer
          if (!on) { vis(el, false); continue; }
          vis(el, true);
          const u = age / P, hk = hash(k, 60 + i);
          // the stroke is pulled out of the silhouette (grow), then its head lets go and the whole line slides off
          const grow = sstep(0, 0.3, u), go = sstep(0.45, 1, u);
          const len = (110 + 190 * hk) * (0.25 + 0.75 * grow) * (1 - 0.55 * go);
          const x0 = xe - 6 - 14 * hk - 380 * go * go;
          set(el, 'transform', `translate(${f1(x0)} ${f1(yy + 6 * (hk - 0.5))}) scale(${f(len / 100)} ${f(0.8 + 0.5 * hk)})`);
          set(el, 'opacity', f(0.8 * slW * sstep(0, 0.15, u) * (1 - sstep(0.7, 1, u))));
        }
      }

      // ================= feathers (now and then) + seeds
      for (let i = 0; i < 3; i++) {
        const P = 7.4, off = 0.6 + i * 2.5, k = Math.floor((t - off) / P), age = t - off - k * P, el = r['fea' + i];
        const LIFE_F = 5.2;
        const on = age >= 0 && age < LIFE_F && (k === 0 || hash(k, 70 + i) < 0.7) && !(reduced && i === 2);
        if (!on) { vis(el, false); continue; }
        vis(el, true);
        const u = age / LIFE_F, hk = hash(k, 80 + i);
        const vx = 70 + 0.05 * sp + 40 * hk;
        const x = RIDER_X - 215 - vx * age - 14 * Math.sin(age * 2.2 + hk * 5);   // lets go behind the tail, never over the plumage
        const y = GROUND_Y - 350 + (i === 1 ? -30 : 20) - 30 * Math.sin(Math.min(1, age * 0.9) * Math.PI / 2) + 60 * age * age / LIFE_F + 10 * Math.sin(age * 3.1 + hk * 4);
        const rot = (i === 1 ? 0 : -15) + 35 * Math.sin(age * 2.2 + hk * 5);
        set(el, 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(rot)}) scale(${i === 1 ? 1.6 : 1.25})`);
        set(el, 'opacity', f(sstep(0, 0.25, age) * (1 - sstep(0.8, 1, u))));
      }
      for (let i = 0; i < 4; i++) {
        const el = r['seed' + i], hk = hash(i, 90);
        const x = wrap(1700 - (60 + 0.035 * sp + 30 * hk) * t - i * 520, 2000) - 200;
        const y = 190 + 62 * i + 26 * Math.sin(0.5 * t + i * 2) + 8 * Math.sin(1.7 * t + i);   // upper air, behind the rider
        set(el, 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(-20 + 18 * Math.sin(1.1 * t + i))}) scale(${f(1.35 + 0.3 * hk)})`);
        set(el, 'opacity', f(clamp(day * 1.2 - 0.2, 0, 1)));
      }
      vis(r.seedG, day > 0.2);

      // ================= butterflies (day; blown off when sprinting)
      const bfPres = clamp(day * 1.4 - 0.4, 0, 1);
      for (let i = 0; i < 2; i++) {
        const el = r['bf' + i];
        const blow = sstep(70, 90, cad);
        if (bfPres <= 0.01 || blow > 0.98) { vis(el, false); continue; }
        vis(el, true);
        const home = i === 0 ? [1012, 392] : [458, 468];
        const x = home[0] + 34 * Math.sin(0.9 * t + i * 3) + 12 * Math.sin(2.3 * t + i) - blow * blow * 1400;
        const y = home[1] + 22 * Math.sin(1.4 * t + i * 1.3) + 8 * Math.sin(3.7 * t + i * 2) - 40 * blow;
        const glide = reduced ? 1 : sstep(0.6, 0.9, Math.sin(0.7 * t + i * 2.4));
        const flap = 0.2 + 0.8 * (0.5 + 0.5 * Math.cos(TAU * (i ? 9 : 7.5) * t));
        const s = lerp(flap, 0.42, glide);
        const dir = Math.cos(0.9 * t + i * 3) >= -0.2 ? 1 : 1;
        set(el, 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(-8 + 10 * Math.sin(1.4 * t + i))}) scale(${f(dir * (i ? 1.35 : 1.55))} ${i ? 1.35 : 1.55})`);
        set(r['bfw' + i], 'transform', `translate(0 -1) scale(1 ${f(s)}) translate(0 1)`);
        set(el, 'opacity', f(bfPres));
      }

      // ================= dragonfly: hover, then dart to the next hover point (quick ease), wings a blur
      {
        const on = day > 0.3 && cad < 92;
        vis(r.dfly, on);
        if (on) {
          const P = 1.9, k = Math.floor(t / P), u = t / P - k;
          const pt = kk => [1120 + 150 * (hash(kk, 201) - 0.5), 610 + 90 * (hash(kk, 202) - 0.5)];
          const a = pt(k), b = pt(k + 1), dart = sstep(0.72, 0.9, u);
          const x = lerp(a[0], b[0], dart) + 2.5 * Math.sin(t * 5.3), y = lerp(a[1], b[1], dart) + 3 * Math.sin(t * 3.7);
          const tilt = (b[1] - a[1]) * 0.12 * Math.sin(Math.PI * dart);
          set(r.dfly, 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(tilt - 4)}) scale(1.6)`);
          set(r.dflyW, 'transform', `translate(0 -1) scale(1 ${f(reduced ? 0.8 : 0.35 + 0.65 * Math.abs(Math.sin(t * 63)))}) translate(0 1)`);
        }
      }
      // ================= tumbling leaf (every ~9 s, crosses the frame on the breeze)
      {
        const P = 9.3, off = 1.2, k = Math.floor((t - off) / P), age = t - off - k * P, LIFE_L = 4.4;
        const on = day > 0.2 && age < LIFE_L && (k === 0 || hash(k, 210) < 0.75);
        vis(r.leaf, on);
        if (on) {
          const hk = hash(k, 211);
          const x = 1500 - (260 + 0.12 * sp) * age, y = 380 + 120 * hk + 140 * (age / LIFE_L) ** 1.4 + 18 * Math.sin(age * 2.6);
          set(r.leaf, 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(age * 140 + hk * 90)}) scale(1.5)`);
          set(r.leafS, 'transform', `scale(${f(reduced ? 1 : Math.cos(age * 5.2))} 1)`);
        }
      }

      // ================= fly around the basket (with a dotted trail)
      {
        const on = day > 0.25;
        vis(r.flyG, on);
        if (on) {
          const uu = wrap(t * 0.52, 1), p = flyPt(uu);
          const jit = reduced ? 0 : 1.6;
          set(r.fly, 'transform', `translate(${f1(p[0] + jit * Math.sin(t * 41))} ${f1(p[1] + jit * Math.cos(t * 37))}) scale(2)`);
          set(r.flyW, 'transform', `rotate(${f1(reduced ? 0 : 22 * Math.sin(t * 90))} 0 -1.2)`);
          const idx = uu * FLYN, i0 = Math.floor(idx), cur = lerp(flyLen[i0], flyLen[i0 + 1], idx - i0);
          set(r.flyTrail, 'stroke-dashoffset', f1(wrap(-(cur - 46), flyTotal)));
        }
      }

      // ================= bumblebee: bumbles round a lazy loop behind the rider (day), with a short dotted trail
      {
        const on = day > 0.3 && tg.critters !== false;
        vis(r.beeG, on);
        if (on) {
          const bp = tt => [320 + 70 * Math.sin(0.43 * tt) + 26 * Math.sin(1.3 * tt + 1), 712 + 16 * Math.sin(0.71 * tt + 2) + 7 * Math.sin(2.3 * tt)];   // over the kerb verge flowers, not the sea
          const p = bp(t), q = bp(t + 0.05), dir = q[0] >= p[0] ? 1 : -1;
          const bob = reduced ? 0 : 2.2 * Math.sin(t * 9);
          set(r.bee, 'transform', `translate(${f1(p[0])} ${f1(p[1] + bob)}) scale(${dir * 1.15} 1.15) rotate(${f1(clamp((q[1] - p[1]) * 6, -18, 18) * dir)})`);
          set(r.beeW, 'transform', `scale(1 ${f(reduced ? 0.8 : 0.35 + 0.65 * Math.abs(Math.sin(t * 57)))})`);
          let d = '';
          for (let i = 1; i <= 7; i++) { const s = bp(t - i * 0.09); d += `${i === 1 ? 'M' : 'L'}${f1(s[0])} ${f1(s[1] + 4)}`; }
          set(r.beeTrail, 'd', d);
        }
      }
      // ================= ladybird crawling along the basket front (rider-local), stops now and then
      {
        const on = day > 0.2;
        vis(r.lady, on);
        if (on) {
          const P = 16, u = wrap(t / P, 1), tri = u < 0.5 ? u * 2 : 2 - u * 2, e = sstep(0, 1, tri);
          const x = lerp(LADY.x0, LADY.x1, e), dir = u < 0.5 ? 1 : -1, moving = Math.abs(Math.sin(Math.PI * tri)) > 0.08;
          set(r.lady, 'transform', `translate(${f1(x)} ${LADY.y}) scale(${dir * 1.5} 1.5)`);
          set(r.ladyL, 'transform', `translate(${f(moving && !reduced ? 0.5 * Math.sin(t * 22) : 0)} 0)`);
        }
      }
      // ================= hum notes: while coasting the pelican hums; little notes drift up from the bill
      {
        let mk = null; for (const e of fr.events || []) if ((e.type === 'coast' || e.type === 'pedal') && e.t0 <= t && (!mk || e.t0 >= mk.t0)) mk = e;
        const humming = mk ? mk.type === 'coast' : !!fr.coasting;
        const t0 = mk && mk.type === 'coast' ? mk.t0 : (fr.coasting ? -1e3 : 0);
        const hx = J.head ? W(J.head.x, J.head.y) : [RIDER_X + 125, GROUND_Y - 520];
        for (let i = 0; i < 3; i++) {
          const el = r['hum' + i], P = 2.7, off = 0.6 + i * 0.9, tau = wrap(t - t0 - off, P);
          const on = !nofx && humming && t - t0 > off && tau < 2.2;
          vis(el, on);
          if (!on) continue;
          const u = tau / 2.2;
          set(el, 'transform', `translate(${f1(hx[0] + 70 + 18 * i - 30 * tau)} ${f1(hx[1] - 40 - 55 * tau)}) rotate(${f1(-12 + 16 * Math.sin(tau * 3 + i))}) scale(${f(0.9 + 0.2 * (i % 2))})`);
          set(el, 'opacity', f(sstep(0, 0.15, u) * (1 - sstep(0.7, 1, u))));
        }
      }

      // ================= glints on the bell and the rear rim (sun side)
      {
        const gl = clamp(sun.elev * 5 + 0.5, 0, 1) * clamp(1 - night * 2, 0, 1);
        vis(r.glB, gl > 0.02); vis(r.glR, gl > 0.02);
        if (gl > 0.02) {
          const tw = reduced ? 0.85 : 0.5 + 0.5 * Math.max(0, Math.sin(TAU * 0.55 * t)) ** 2;
          set(r.glB, 'transform', `translate(${BIKE.bell[0] + 3} ${BIKE.bell[1] - 9}) rotate(${f1(12 * Math.sin(t * 0.8))}) scale(${f(0.5 + 0.55 * tw)})`);
          set(r.glB, 'opacity', f(gl));
          const hubW = W(BIKE.rearHub[0], BIKE.rearHub[1]), a = Math.atan2(sun.y - hubW[1], sun.x - hubW[0]);
          const tw2 = reduced ? 0.85 : 0.5 + 0.5 * Math.max(0, Math.sin(TAU * 0.43 * t + 2)) ** 2;
          set(r.glR, 'transform', `translate(${f1(BIKE.rearHub[0] + 92 * Math.cos(a))} ${f1(BIKE.rearHub[1] + 92 * Math.sin(a))}) rotate(${f1(-8 * t % 90)}) scale(${f(0.45 + 0.6 * tw2)})`);
          set(r.glR, 'opacity', f(gl));
        }
      }

      // ================= event pops
      const popAnim = (el, rays, tau, dur, x, y, rot) => {
        const on = !nofx && tau >= 0 && tau < dur;
        vis(el, on);
        if (!on) return;
        const uin = clamp(tau / 0.16, 0, 1), uout = sstep(dur - 0.24, dur, tau);
        const s = reduced ? 1 : (uin < 1 ? easeOutBack(uin) : 1) * (1 - 0.35 * uout);
        const wob = reduced ? 0 : 3 * Math.exp(-tau * 5) * Math.sin(tau * 30);
        set(el, 'transform', `translate(${f1(x)} ${f1(y - 14 * uout)}) rotate(${f1(rot + wob)}) scale(${f(Math.max(0.01, s))})`);
        set(el, 'opacity', f(reduced ? Math.min(1, tau / 0.12) * (1 - uout) : 1 - uout));
        const ur = clamp(tau / 0.34, 0, 1);
        vis(rays, ur < 1);
        if (ur < 1) { set(rays, 'transform', `scale(${f(reduced ? 1 : 0.75 + 0.5 * ur)})`); set(rays, 'opacity', f(1 - ur * ur)); }
      };
      const tb = latest(fr.events, 'bell', t, 3);
      popAnim(r.popDing, r.popDingRays, tb - TIMING.bell.strike, 1.0, RIDER_X + 330, GROUND_Y - 360, -7);
      const th = latest(fr.events, 'hop', t, 3);
      popAnim(r.popHop, r.popHopRays, th - TIMING.hop.takeoff + 0.04, 0.95, RIDER_X - 330, GROUND_Y - 190, -9);
      const tgp = latest(fr.events, 'gulp', t, 8);
      popAnim(r.popGulp, r.popGulpRays, tgp - TIMING.gulp.swallow[0], 1.05, RIDER_X + 385, GROUND_Y - 545, 6);
      // bell notes
      for (let i = 0; i < 2; i++) {
        const tau = tb - TIMING.bell.strike - i * 0.18, el = r['note' + i];
        const on = !nofx && tau >= 0 && tau < 1.6;
        vis(el, on);
        if (!on) continue;
        const u = tau / 1.6, bw = W(BIKE.bell[0], BIKE.bell[1]);
        const x = bw[0] + 18 + i * 10 - (60 + 0.02 * sp) * tau + 8 * Math.sin(tau * 6 + i);
        const y = bw[1] - 22 - 95 * tau + 18 * tau * tau;
        set(el, 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(-10 + 14 * Math.sin(tau * 5 + i))}) scale(${f((reduced ? 1 : Math.min(1, easeOutBack(clamp(tau / 0.18, 0, 1)))) * 1.05)})`);
        set(el, 'opacity', f(1 - sstep(0.65, 1, u)));
      }
      // gulp drips (during scoop / lift) from the lower bill tip
      for (let i = 0; i < 4; i++) {
        const tau = tgp - 0.62 - i * 0.13, el = r['drip' + i];
        const on = tau >= 0 && tau < 0.42 && pose.fish;
        vis(el, !!on);
        if (!on) continue;
        const p = W(pose.fish.x, pose.fish.y);
        set(el, 'transform', `translate(${f1(p[0] - 6 + 5 * i - (0.25 * sp + 40) * tau)} ${f1(p[1] + 4 + 0.5 * 1800 * tau * tau)}) scale(${f(0.9 + 0.2 * (i % 2))} ${f(1 + 0.4 * Math.min(1, tau * 5))})`);
        set(el, 'opacity', f(1 - sstep(0.3, 0.42, tau)));
      }
      // hearts after the gulp
      for (let i = 0; i < 3; i++) {
        const tau = tgp - 1.9 - i * 0.28, el = r['heart' + i];
        const on = !nofx && tau >= 0 && tau < 1.9;
        vis(el, on);
        if (!on) continue;
        const u = tau / 1.9, hx = J.head ? W(J.head.x, J.head.y) : [RIDER_X + 125, GROUND_Y - 520];
        const x = hx[0] + 20 + i * 22 + 12 * Math.sin(tau * 3.4 + i * 2), y = hx[1] - 50 - 70 * tau - i * 6;
        const s = (reduced ? 1 : easeOutBack(clamp(tau / 0.22, 0, 1))) * (1.05 - 0.2 * i) * (1 + 0.06 * Math.sin(tau * 12));
        set(el, 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(10 * Math.sin(tau * 3 + i))}) scale(${f(Math.max(0.01, s))})`);
        set(el, 'opacity', f(1 - sstep(0.7, 1, u)));
      }
      // fish bone: spat back over the shoulder, lands on the road, scrolls away
      {
        const tau = tgp - 2.35, el = r.bone;
        const on = !nofx && tau >= 0 && tau < 3.2;
        vis(el, on);
        if (on) {
          const x0 = RIDER_X + 250, y0 = GROUND_Y - 490, vx = -180, vy = -330, g = 1500;
          const tHit = (-vy + Math.sqrt(vy * vy + 2 * g * (GROUND_Y + 8 - y0))) / g;
          let x, y, rot;
          if (tau < tHit) { x = x0 + vx * tau; y = y0 + vy * tau + 0.5 * g * tau * tau; rot = -tau * 620; }
          else { const a = tau - tHit, bounce = Math.abs(Math.sin(a * 9)) * 12 * Math.exp(-a * 6); x = x0 + vx * tHit - sp * a - 60 * (1 - Math.exp(-a * 5)); y = GROUND_Y + 8 - bounce; rot = -tHit * 620 - 40 * (1 - Math.exp(-a * 6)); rot = Math.round(rot / 180) * 180 * sstep(0, 0.3, a) + rot * (1 - sstep(0, 0.3, a)); }
          set(el, 'transform', `translate(${f1(x)} ${f1(y)}) rotate(${f1(rot)}) scale(1.3)`);
          set(el, 'opacity', f(1 - sstep(2.8, 3.2, tau)));
        }
      }
      // wave action arcs beside the waving wing
      {
        const tw = latest(fr.events, 'wave', t, 3);
        const on = !nofx && tw >= TIMING.wave.wave[0] && tw < TIMING.wave.wave[1] && J.wingNearHand;
        vis(r.waveArcs, !!on);
        if (on) {
          const j = J.wingNearHand, u = (tw - TIMING.wave.wave[0]) / (TIMING.wave.wave[1] - TIMING.wave.wave[0]);
          set(r.waveArcs, 'transform', `translate(${f1(j.x + 10)} ${f1(j.y - 20)}) rotate(${f1((j.rot || 0) * 0.3 - 10)})`);
          set(r.waveArcs, 'opacity', f(sstep(0, 0.12, u) * (1 - sstep(0.85, 1, u))));
        }
      }
    },
  };
}
