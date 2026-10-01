// OWNER: sky. Layers L-sky, L-stars, L-sunmoon, L-clouds (+ the palette in core/palette.js).
// Style X ("Neon Pelican", docs/STYLE-X.md): the sky over a neon megacity. Layered smog gradients with fine strata and
// a city light dome on the horizon; a smog sun and a moon through the smog (craters, a lunar colony, an orbital ring);
// rare stars and a satellite train; the ARCOLOGY — a huge far megastructure with thousands of lit windows, bloomed neon
// tier rings, a vertical 天穹塔 sign, a PELICORP crown, an antenna farm with warning lights and a landing pad — plus far
// megatowers and an orbital lift tether; sweeping searchlights; drifting smog banks with neon-lit bellies; five calm
// flying-car traffic lanes (streams of tiny head / tail lights, underglows, a cargo convoy); a blimp projecting a
// rotating hologram ad; a close hover car, a rare police spinner; lightning in the storms.
// Performance (STYLE-X §2): the only filter (bloom) sits on the static arcology neon inside the L-sunmoon sheet. Every
// moving part is a pure translate on its own composited strip (`sheets`) or a small isolated sheet (`isolate`); glows
// are stacked strokes and gradients. Per frame we only write a handful of transforms / opacities.
import { fmt1, fmt2, clamp } from '../core/math.js';
import { h, refs } from '../core/svg.js';
import { hash, LAP, stretchAt } from './route.js';
import { DIST_PER_REV as DIST_PER_REV_ } from '../contract.js';

export const id = 'sky';

// ---------------------------------------------------------------------------------------------- helpers
const f = fmt2, f1 = fmt1;
const D2R = Math.PI / 180;
const circ = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const rect = (x, y, w, hh) => `M${f1(x)} ${f1(y)}h${f1(w)}v${f1(hh)}h${f1(-w)}Z`;
const rrect = (x, y, w, hh, r = hh / 2) => `M${f(x + r)} ${f(y)}h${f(w - 2 * r)}a${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(r)}v${f(hh - 2 * r)}a${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(r)}h${f(-(w - 2 * r))}a${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(-r)}v${f(-(hh - 2 * r))}a${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(-r)}Z`;
const poly = pts => 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z';
const wrap = (x, m) => ((x % m) + m) % m;
const DD = key => ({ 'data-detail': key });
const NEON = { mag: '#FF2E88', magCore: '#FFD3E7', cyan: '#19E6FF', cyanCore: '#D8FBFF', acid: '#C6FF3D', amber: '#FFB547', amberCore: '#FFF0D2', red: '#FF3B4E', white: '#FFF6E8', violet: '#9B5CFF' };
const NEONV = 'fill-opacity:var(--pb-n-neon);stroke-opacity:var(--pb-n-neon)';   // paint opacity, not group opacity (no offscreen surfaces)

// lettering: glyph outlines generated from DejaVu Sans Bold / Sans Mono Bold + WenQuanYi Zen Hei (tools/ttf.mjs),
// em 100, baseline 0, [advance, d]. See GLY at the end of the file.
const tw = (k, s) => GLY[k][0] * s / 100;
function T(k, x, y, s, attrs = {}, anchor = 'start') {
  const w = tw(k, s), x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  return h('path', { d: GLY[k][1], transform: `translate(${f(x0)} ${f(y)}) scale(${f(s / 100)})`, ...attrs });
}
const fit = (k, s, maxW) => Math.min(s, maxW * 100 / GLY[k][0]);

// ---------------------------------------------------------------------------------------------- geometry
const HZ = 470;
const X0 = -420, X1 = 2020, W = X1 - X0;
const SHIP_SPAN = 3000, CAR_SPAN = 4200, COP_SPAN = 5200, SAT_SPAN = 2800;
// arcology (the far megastructure) — tiers [x0, x1, top]; the rider's white head reads against its dark mass
const ARC_X = 900;
// (fix: the arcology no longer locks behind the rider's head) it is far but not infinitely far: it rides on its own
// composited strip with a slow parallax, one full cycle per lap (ARC_P screen px per LAP of road). It is drawn at
// ARC_S scale (farther, quieter) and sits LEFT of the rider in the hero frame; it slides behind the head only for
// ~50 s of the lap, and the dark SHADOW TOWER (static, very far) is what the white head reads against the rest of the time.
const ARC_S = 0.76, ARC_HERO = 320, ARC_P = 2400, ARC_XS = -520;
const arcT = `translate(${ARC_HERO} ${HZ}) scale(${ARC_S}) translate(${-ARC_X} ${-HZ})`;
// the shadow tower behind the head (x0, x1, top): a near-black monolith with a stepped crown
const SHT = [700, 1004, 128];
const TIERS = [[600, 1200, 392], [652, 1148, 318], [704, 1096, 246], [752, 1048, 184], [800, 1000, 132]];
const CROWN = [[828, 972, 132], [846, 954, 96], [868, 932, 74]];
// flying-car traffic lanes: y, screen speed px/s (+ = to the right), light size, cars, seed
// Two strips (all four lanes sit in the top tile row, so the two composited strips stay cheap): g0 flows left, g1 right.
const LANES = [
  { y: 86, g: 0, s: 0.8, n: 16, a: 0.6 }, { y: 122, g: 1, s: 0.95, n: 14, a: 0.7 },
  { y: 168, g: 0, s: 1.1, n: 12, a: 0.8, convoy: true }, { y: 208, g: 1, s: 1.25, n: 10, a: 0.9 },
  // (fix) a far skyway threading between the far towers: a dense stream of tiny head / tail lights (still in tile row 0)
  { y: 242, g: 0, s: 0.6, n: 34, a: 0.75, far: true },
];
const LANE_V = [-15, 21];                               // screen px/s — calm
// smog strips: [period, parallax, drift px/s]; two periods and speeds so the smog pattern never lines up the same way twice
const SMOG = [[3400, 0.03, 3], [4300, 0.022, 5]];
// x, base°, amp°, rad/s, phase. Integration (perf): two searchlights, crossing over the arcology (each beam is a
// sweeping translucent fan on its own composited sheet; four of them cost ~0.4 screen of compositing every frame)
const BEAMS = [[470, 15, 11, 0.09, 2.1], [1206, -26, 12, 0.13, 4.0]];

// the blimp's district ad per route stretch (ads 3–6: fish market, koi arcade, maglev line 7, old temple)
const DISTRICT_AD = { village: 3, pier: 3, harbour: 3, funfair: 4, railway: 5, lighthouse: 5, cliffs: 6, dunes: 4, bridge: 5, fort: 6, pines: 6, return: 4 };

export const detailItems = [
  ['sky:O:smog-gradient', 'O', 'layered smog gradient: void zenith → violet → hot magenta/coral horizon (per city mood)'],
  ['sky:T:smog-strata', 'T', 'fine horizontal strata of lighter smog across the gradient'],
  ['sky:O:city-light-dome', 'O', 'the city light dome glowing on the horizon, hot spots under the towers'],
  ['sky:O:lane-gate', 'O', 'a holographic toll gate on a traffic lane: an upright neon ring the flying cars thread through'],
  ['sky:O:drone-show', 'O', 'a drone light show drawing a pelican head in the open sky beside the arcology crown'],
  ['sky:O:lantern-drones', 'O', 'festival lantern drones: amber paper-look LED lanterns hanging under tiny quad drones'],
  ['sky:O:lane-beacons', 'O', 'floating skyway beacons (chevrons + SKYWAY 3 / 7 plates) marking the traffic lanes'],
  ['sky:O:stars', 'O', 'rare stars through the smog (only a few, dim at dusk, full at deep night)'],
  ['sky:O:star-glints', 'O', 'four-point glints on the brightest stars'],
  ['sky:O:twinkle-stars', 'O', 'twinkling subset'],
  ['sky:O:satellite-train', 'O', 'a slow satellite train crossing the zenith'],
  ['sky:O:smog-sun', 'O', 'smog sun: a hot disc with a coral glow dome'],
  ['sky:T:sun-smog-bars', 'T', 'dark smog bars striping the sun disc'],
  ['sky:O:sun-halo', 'O', 'wide amber/magenta halo bleeding through the towers'],
  ['sky:O:moon', 'O', 'moon disc with terminator shading'],
  ['sky:O:moon-craters', 'O', 'craters with lit rims'],
  ['sky:T:moon-maria', 'T', 'dark maria'],
  ['sky:O:moon-colony', 'O', 'a lunar colony: tiny amber and cyan city lights on the dark limb'],
  ['sky:O:moon-orbital-ring', 'O', 'a thin cyan orbital ring around the moon'],
  ['sky:T:moon-smog-streaks', 'T', 'smog streaks drawn across the moon'],
  ['sky:O:moon-halo', 'O', 'violet halo around the moon'],
  ['sky:O:far-megatowers', 'O', 'distant megatowers in the smog (spires, stepped crowns, masts)'],
  ['sky:T:far-tower-windows', 'T', 'sparse lit windows on the far megatowers'],
  ['sky:O:far-tower-lights', 'O', 'red aircraft lights on the far tower masts'],
  ['sky:O:far-rooftop-signs', 'O', 'rooftop neon signs on the far towers: 酒吧 BAR, 拉面 RAMEN, 24H'],
  ['sky:O:far-skybridge', 'O', 'lit skybridges strung between the far towers'],
  ['sky:O:arcology', 'O', 'the ARCOLOGY: a stepped far megastructure silhouette with a chamfered crown'],
  ['sky:T:arcology-windows', 'T', 'thousands of lit windows (amber, cyan, magenta, white) in merged paths'],
  ['sky:T:arcology-ribs', 'T', 'vertical structural ribs and floor bands'],
  ['sky:O:arcology-rim', 'O', 'magenta rim light down the lit edges of every tier'],
  ['sky:O:arcology-neon-rings', 'O', 'bloomed cyan / magenta neon rings along each tier edge'],
  ['sky:O:arcology-buttresses', 'O', 'raking buttresses and cantilevered sky-gardens'],
  ['sky:O:arcology-sign', 'O', 'vertical neon sign 天穹塔 on the tier face'],
  ['sky:O:arcology-logo', 'O', 'PELICORP · 鹈鹕集团 crown logo with a pelican-head mark'],
  ['sky:O:arcology-screen', 'O', 'giant NEON COLA / 霓虹可乐 video wall with a can'],
  ['sky:O:arcology-light-strips', 'O', 'vertical neon light strips running down the tier faces'],
  ['sky:O:arcology-halo-rings', 'O', 'three hologram halo rings floating around the spire'],
  ['sky:O:arcology-antennas', 'O', 'antenna farm: masts, dishes and a spire'],
  ['sky:O:arcology-warning-lights', 'O', 'blinking red warning lights on the masts'],
  ['sky:O:arcology-landing-pad', 'O', 'cantilevered landing pad with an H and ring lights'],
  ['sky:O:arcology-label', 'O', 'ARCOLOGY-01 · 天穹 block plate'],
  ['sky:O:shadow-tower', 'O', 'the SHADOW TOWER: a near-black stepped monolith behind the rider\'s head (the dark mass the white head reads against)'],
  ['sky:T:shadow-tower-panels', 'T', 'its floor seams and mullions, faint in the dark'],
  ['sky:O:shadow-tower-crown', 'O', 'cyan setback light lines on its stepped crown'],
  ['sky:O:shadow-tower-beacon', 'O', 'the aircraft beacon on its mast and the setback lamps (blinking with the far lights)'],
  ['sky:O:shadow-tower-roof', 'O', 'rooftop clutter on its crown: water tanks, a dish, AC boxes, a service hut, rim-lit'],
  ['sky:O:shadow-gondola', 'O', 'a window-cleaning gondola hanging on two cables with an amber work lamp'],
  ['sky:O:arcology-gardens', 'O', 'teal sky-gardens on the arcology ledges'],
  ['sky:O:arcology-ticker', 'O', 'an LED stock-ticker band across tier 2: PLCP +3.2%  KOI +12%'],
  ['sky:O:arcology-elevators', 'O', 'glass elevator cabins riding the vertical light strips'],
  ['sky:O:arcology-shuttle', 'O', 'an air taxi docked on the landing pad (canopy, underglow, tail light)'],
  ['sky:T:night-windows', 'T', 'deep night: a second, denser set of lit windows fills the arcology and the far towers'],
  ['sky:O:dawn-smog', 'O', 'dawn: a rolling orange smog sea filling the lower half of the sky'],
  ['sky:O:acid-haze', 'O', 'acid-rain night: a magenta haze hanging over the city'],
  ['sky:T:acid-streaks', 'T', 'heavy slanted acid-rain streaks lit magenta and cyan in the smog'],
  ['sky:O:far-skyway', 'O', 'a far skyway: a dense stream of tiny head and tail lights threading between the far towers'],
  ['sky:O:orbital-lift', 'O', 'orbital lift tether rising out of the smog with marker lights'],
  ['sky:O:lift-anchor', 'O', 'the lift anchor tower with its 轨道电梯 ORBITAL LIFT plate'],
  ['sky:O:lift-capsule', 'O', 'a lit capsule climbing the tether'],
  ['sky:O:searchlights', 'O', 'slowly sweeping searchlight beams through the smog'],
  ['sky:T:searchlight-cores', 'T', 'bright inner cores of the beams'],
  ['sky:O:smog-banks', 'O', 'drifting smog banks with ragged tops'],
  ['sky:T:smog-lit-bellies', 'T', 'magenta / amber city light on the smog bellies'],
  ['sky:O:smog-wisps', 'O', 'long thin high smog wisps'],
  ['sky:O:traffic-lanes', 'O', 'flying-car traffic: streams of head and tail lights, calm and slow'],
  ['sky:T:traffic-trails', 'T', 'short light trails behind the cars'],
  ['sky:O:traffic-underglow', 'O', 'neon underglows on some cars'],
  ['sky:O:cargo-convoy', 'O', 'a cargo-drone convoy of acid-green triplets'],
  ['sky:O:blimp', 'O', 'advertising blimp envelope'],
  ['sky:T:blimp-panels', 'T', 'envelope panel seams and a hull stripe'],
  ['sky:O:blimp-fins', 'O', 'cruciform tail fins with neon edges'],
  ['sky:O:blimp-gondola', 'O', 'gondola with lit windows'],
  ['sky:O:blimp-engines', 'O', 'engine pods with spinning props'],
  ['sky:O:blimp-navlights', 'O', 'nav lights and a nose strobe'],
  ['sky:O:blimp-lettering', 'O', '鹈鹕湾 PB-07 on the hull'],
  ['sky:O:holo-projector', 'O', 'projector cone from the gondola'],
  ['sky:O:holo-ad', 'O', 'hologram ad panel with corner brackets (rotates: 鹈鹕外卖 / 义体诊所 / 寻鸟启事)'],
  ['sky:T:holo-scanlines', 'T', 'hologram scanlines'],
  ['sky:O:holo-ad-icons', 'O', 'ad pictograms: a fish, a cyber beak, a WANTED pelican'],
  ['sky:O:hover-car', 'O', 'a close hover car with canopy and underglow'],
  ['sky:O:hover-car-beam', 'O', 'its headlight beam and tail-light trail'],
  ['sky:O:hover-car-thrusters', 'O', 'amber hover thrusters'],
  ['sky:O:police-spinner', 'O', 'a rare police spinner with a flashing red/blue light bar'],
  ['sky:O:lightning', 'O', 'forked lightning over the towers in the storms (with a sky flash)'],
  ['sky:O:storm-deck', 'O', 'a dark storm smog deck rolling in with the overcast'],
].map(([key, kind, what]) => ({ id: key.split(':')[2], layer: 'sky', kind, what, key }));

// ---------------------------------------------------------------------------------------------- build
export function build(ctx) {
  const { v, rng } = ctx;
  let defs = '';
  const lg = (id, x1, y1, x2, y2, stops, units = 'userSpaceOnUse') => {
    defs += h('linearGradient', { id, x1, y1, x2, y2, gradientUnits: units },
      stops.map(([o, c, a = 1]) => h('stop', { offset: o, style: `stop-color:${c};stop-opacity:${a}` })));
    return `url(#${id})`;
  };
  const rg = (id, stops, extra = {}) => {
    defs += h('radialGradient', { id, ...extra }, stops.map(([o, c, a = 1]) => h('stop', { offset: o, style: `stop-color:${c};stop-opacity:${a}` })));
    return `url(#${id})`;
  };
  const glowG = (id, c) => rg(id, [[0, c, 0.9], [0.25, c, 0.45], [0.6, c, 0.12], [1, c, 0]]);

  // ======================== L-sky: the smog gradient, strata, the city light dome, skyway beacons
  const Y = y => f((y + 420) / 900);
  const skyFill = lg('sky-grad', 0, -420, 0, 480, [[0, v('sky0')], [Y(-10), v('sky0')], [Y(110), v('sky1')], [Y(240), v('sky1b')], [Y(355), v('sky2')], [Y(432), v('sky3')], [Y(470), v('skyLine')], [1, v('skyLine')]]);
  let openSky = '';   // (integration) small lights in the open sky, drawn over the moon halo
  let sky = h('rect', { ...DD('sky:O:smog-gradient'), x: X0, y: -420, width: W, height: 900, fill: skyFill });
  {
    // strata: broken hairlines of lighter smog, denser toward the horizon
    const R = rng(301); let d = '', d2 = '';
    for (let i = 0; i < 64; i++) {
      const y = 150 + Math.pow(R(), 0.7) * 300, x = X0 + R() * W, len = 120 + R() * 520, th = 0.8 + R() * 1.6;
      const seg = rect(x, y, len, th) + (R() < 0.5 ? rect(x + len + 8 + R() * 30, y + 0.4, 30 + R() * 90, th * 0.7) : ''); if (y > 330) d2 += seg; else d += seg;
    }
    sky += h('path', { ...DD('sky:T:smog-strata'), d, fill: v('skyZen'), opacity: 0.55 });
    sky += h('path', { d: d2, fill: v('smogLit'), opacity: 0.16 });
    // light dome + hot spots
    sky += h('ellipse', { ...DD('sky:O:city-light-dome'), cx: 800, cy: 486, rx: 1500, ry: 210, fill: rg('sky-dome', [[0, v('cityGlow'), 0.6], [0.45, v('cityGlow'), 0.28], [1, v('cityGlow'), 0]]) });
    const hot = rg('sky-hot', [[0, v('smogLit'), 0.55], [1, v('smogLit'), 0]]);
    for (const [x, rx, ry] of [[-120, 300, 90], [380, 260, 80], [900, 420, 110], [1560, 320, 90], [1980, 260, 80]])
      sky += h('ellipse', { cx: x, cy: 478, rx, ry, fill: hot });
  }
  {
    // skyway beacons along the lanes: chevrons with a cyan core, two lane plates
    let chev = '', core = '', plate = '';
    const R = rng(302);
    LANES.forEach((L, li) => {
      if (L.far) return;
      const s = L.s * 1.6;
      for (let x = X0 + 60 + R() * 200; x < X1; x += 250 + R() * 120) {
        const dir = L.g ? 1 : -1;
        chev += `M${f(x - 3 * s * dir)} ${f(L.y - 7 - 3 * s)}l${f(3 * s * dir)} ${f(3 * s)}l${f(-3 * s * dir)} ${f(3 * s)}`;
        core += circ(x, L.y - 7, 0.9 * L.s);
      }
      if (li === 1 || li === 3) {
        const px = li === 1 ? 1062 : 604;   // (integration) SKYWAY 3 left of the HUD mission panel, in open sky
        plate += h('g', { transform: `translate(${px} ${L.y - 22})`, ...(li === 1 ? DD('sky:O:lane-beacons') : {}) },
          h('path', { d: rrect(-2, -9, tw(li === 1 ? 'sky3' : 'sky7', 8) + 4, 12, 2), fill: v('mega'), stroke: NEON.cyan, 'stroke-width': 0.8, opacity: 0.9 }),
          T(li === 1 ? 'sky3' : 'sky7', 0, 0, 8, { fill: NEON.cyanCore }),
          h('path', { d: `M${f(tw('sky3', 8) / 2)} 3v12`, stroke: NEON.cyan, 'stroke-width': 0.8, opacity: 0.7 }));
      }
    });
    sky += h('g', { style: NEONV }, h('path', { d: chev, fill: 'none', stroke: NEON.cyan, 'stroke-width': 1, opacity: 0.5, 'stroke-linejoin': 'round' }),
      h('path', { d: core, fill: NEON.cyanCore, opacity: 0.8 }), plate);
    // (integration) a holographic toll gate on the third lane: an upright neon ring the flying cars thread through
    openSky += h('g', { ...DD('sky:O:lane-gate'), transform: 'translate(424 169)', style: NEONV },
      h('path', { d: 'M-9 0a9 21 0 1 0 18 0a9 21 0 1 0 -18 0Z', fill: NEON.cyan, 'fill-opacity': 0.08, stroke: NEON.cyan, 'stroke-width': 3.4, 'stroke-opacity': 0.25 }),
      h('path', { d: 'M-9 0a9 21 0 1 0 18 0a9 21 0 1 0 -18 0Z', fill: 'none', stroke: NEON.cyan, 'stroke-width': 1.2 }),
      h('path', { d: 'M-7 -14h14M-7 14h14', stroke: NEON.magenta, 'stroke-width': 1.4 }), h('path', { d: circ(0, -22, 1.4) + circ(0, 22, 1.4), fill: NEON.magentaCore }));
  }
  {
    // (integration) a drone light show draws a pelican head in the open sky right of the arcology crown
    const P = [[10, 30], [6, 20], [12, 10], [24, 4], [38, 6], [46, 14], [70, 16], [100, 19], [128, 22], [140, 24], [138, 29], [120, 30], [96, 36], [70, 40], [52, 38], [44, 32], [34, 40], [20, 40]];
    const line = 'M' + P.map(p => p.join(' ')).join('L') + 'Z';
    sky += h('g', { ...DD('sky:O:drone-show'), transform: 'translate(1006 122)', style: NEONV },
      h('path', { d: line, fill: NEON.cyan, 'fill-opacity': 0.07, stroke: NEON.cyan, 'stroke-width': 0.6, 'stroke-opacity': 0.4 }),
      h('path', { d: P.map(([x, y]) => circ(x, y, 1.4)).join(''), fill: NEON.cyanCore }),
      h('path', { d: circ(32, 13, 1.8), fill: NEON.magenta }), h('path', { d: P.filter((_, i) => i % 3 === 0).map(([x, y]) => circ(x, y, 3.2)).join(''), fill: NEON.cyan, opacity: 0.25 }));
    // festival lantern drones: amber lanterns hanging under tiny quad drones, drifting over the old town
    const lant = (x, y, s) => h('g', { transform: `translate(${x} ${y}) scale(${s})` },
      h('path', { d: circ(0, 8, 10), fill: NEON.amber, opacity: 0.22 }), h('path', { d: 'M-7 -1h14', stroke: '#1A1530', 'stroke-width': 1.6 }),
      h('path', { d: circ(-7, -1.5, 1) + circ(7, -1.5, 1), fill: NEON.red }), h('path', { d: 'M0 0v3', stroke: '#1A1530', 'stroke-width': 0.6 }),
      h('path', { d: 'M-3.5 3h7l1 4.5l-1 5.5h-7l-1 -5.5Z', fill: NEON.amber }), h('path', { d: 'M-2.5 6h5M-2.5 9h5', stroke: NEON.amberCore, 'stroke-width': 0.6 }),
      h('path', { d: 'M0 13v3', stroke: NEON.amber, 'stroke-width': 0.8 }));
    openSky += h('g', { ...DD('sky:O:lantern-drones'), style: NEONV }, lant(476, 126, 1.05), lant(548, 146, 1), lant(678, 158, 0.9));
  }

  // ======================== L-stars: rare stars, glints, twinkles, satellite train
  let starsL = '', satL = '';
  {
    const R = rng(311); const mags = ['', '', ''], tw3 = ['', '', '']; let glint = '', patch = '';
    const inPatch = (x, y) => x > 975 && x < 1160 && y > 22 && y < 84;   // open sky right of the arcology crown
    for (let i = 0; i < 70; i++) {
      const x = X0 + R() * W, y = -380 + Math.pow(R(), 1.3) * 640; const m = R() < 0.62 ? 0 : R() < 0.75 ? 1 : 2;
      const r = [0.7, 1.05, 1.5][m];
      if (R() < 0.18) tw3[i % 3] += circ(x, y, r); else if (inPatch(x, y)) patch += circ(x, y, r); else mags[m] += circ(x, y, r);
      if (m === 2 && R() < 0.8) glint += `M${f(x - 5)} ${f(y)}h10M${f(x)} ${f(y - 5)}v10`;
    }
    starsL = h('g', { 'data-ref': 'sky-stars', style: 'fill-opacity:var(--pb-n-starAlpha);stroke-opacity:var(--pb-n-starAlpha)' },
      // a few extra stars in that patch (it sits in the smog-thin zenith band of the hero frame)
      h('path', { ...DD('sky:O:stars'), d: patch + [[992, 38, 1.1], [1018, 61, 0.8], [1047, 30, 1.4], [1083, 52, 0.9], [1121, 34, 1.2], [1146, 66, 0.8]].map(([x, y, r]) => circ(x, y, r)).join(''), fill: v('star'), opacity: 0.85 }),
      h('path', { d: mags[0] + mags[1], fill: v('star'), opacity: 0.7 }),
      h('path', { d: mags[2], fill: v('star') }),
      h('path', { ...DD('sky:O:star-glints'), d: glint, stroke: v('star'), 'stroke-width': 0.7, opacity: 0.8 }),
      tw3.map((d, g) => h('path', { 'data-ref': 'sky-tw' + g, ...(g === 0 ? DD('sky:O:twinkle-stars') : {}), d, fill: NEON.cyanCore })));
    let sat = '';
    for (let i = 0; i < 9; i++) sat += circ(i * 22, i * 2.2, 0.9);
    satL = h('g', { 'data-ref': 'sky-sat', transform: 'translate(300 60)', style: 'fill-opacity:var(--pb-n-starAlpha);stroke-opacity:var(--pb-n-starAlpha)' },
      h('path', { ...DD('sky:O:satellite-train'), d: sat, fill: v('star') }));
  }

  // ======================== L-sunmoon: smog sun, moon, far megatowers, orbital lift, the arcology
  let sunmoon = '';
  {
    const bars = [-30, -16, -4, 8, 19, 30].map((y, i) => rect(-80 + i * 6, y, 160 - i * 8, 2.4 + i * 0.9)).join('');
    sunmoon += h('g', { 'data-ref': 'sky-sun', transform: 'translate(1466 353)' },
      h('circle', { ...DD('sky:O:sun-halo'), r: 330, fill: rg('sky-sunHalo', [[0, v('sunGlow'), 0.55], [0.35, v('sunGlow'), 0.28], [1, v('sunGlow'), 0]]) }),
      h('circle', { r: 150, fill: rg('sky-sunIn', [[0, v('sunHalo'), 0.8], [0.5, v('sunHalo'), 0.3], [1, v('sunHalo'), 0]]) }),
      h('circle', { ...DD('sky:O:smog-sun'), r: 58, fill: rg('sky-sunD', [[0, v('sunCore')], [0.55, v('sunHalo')], [1, v('sunGlow')]]) }),
      h('path', { ...DD('sky:T:sun-smog-bars'), d: bars, fill: v('smog1'), opacity: 0.6 }));
  }
  {
    const R = rng(321);
    let craters = '', rims = '', maria = '', col = '', colC = '';
    for (const [x, y, r] of [[-12, -10, 5], [9, 6, 3.6], [-4, 13, 2.8], [13, -12, 2.4], [-16, 6, 2], [4, -3, 1.6]]) {
      craters += circ(x, y, r);
      rims += `M${f(x - r * 0.8)} ${f(y - r * 0.55)}A${r} ${r} 0 0 1 ${f(x + r * 0.85)} ${f(y - r * 0.45)}`;
    }
    maria = `M-20 -4C-16 -16 -2 -20 6 -14C2 -8 -6 -4 -8 4C-14 6 -20 4 -20 -4ZM2 8C8 2 18 4 20 10C16 18 6 20 2 14Z`;
    // (fix: legible, not padding) the lunar colony: three glass domes on the dark limb, a lit grid of habitats, a mass-driver rail
    let domes = '';
    for (const [a, rd] of [[124, 4.4], [143, 5.8], [162, 4]]) {
      const x = 21 * Math.cos(a * D2R), y = 21 * Math.sin(a * D2R);
      domes += `M${f(x - rd)} ${f(y)}a${rd} ${rd} 0 0 1 ${f(2 * rd)} 0Z`;
      for (let k = 0; k < 4; k++) { const c = circ(x - rd * 0.6 + k * rd * 0.4, y - 0.9 - (k % 2) * 1.1, 0.62); if (k % 2) colC += c; else col += c; }
    }
    for (let i = 0; i < 18; i++) { const a = (118 + R() * 60) * D2R, rr = 14 + R() * 12; const c = circ(rr * Math.cos(a), rr * Math.sin(a), 0.6 + R() * 0.4); if (R() < 0.65) col += c; else colC += c; }
    const shade = rg('sky-moonD', [[0, v('moon')], [0.62, v('moon')], [1, v('moonShade')]], { cx: 0.62, cy: 0.38, r: 0.75 });
    sunmoon += h('g', { 'data-ref': 'sky-moon', transform: 'translate(555 226)' },
      h('circle', { ...DD('sky:O:moon-halo'), r: 150, fill: rg('sky-moonHalo', [[0, v('moonHalo1'), 0.5], [0.3, v('moonHalo1'), 0.22], [1, v('moonHalo1'), 0]]) }),
      h('g', { ...DD('sky:O:moon') }, h('circle', { r: 30, fill: shade }),
      h('path', { ...DD('sky:T:moon-maria'), d: maria, fill: v('moonShade'), opacity: 0.55 }),
      h('path', { ...DD('sky:O:moon-craters'), d: craters, fill: v('moonShade'), opacity: 0.75 }),
      h('path', { d: rims, fill: 'none', stroke: '#FFFFFF', 'stroke-width': 0.7, opacity: 0.7 }),
      h('path', { d: 'M-30 0A30 30 0 0 0 18 24A34 34 0 0 1 -30 0Z', fill: v('moonShade'), opacity: 0.55 }),
      h('g', { ...DD('sky:O:moon-colony') },
        h('path', { d: domes, fill: NEON.cyan, 'fill-opacity': 0.3, stroke: NEON.cyanCore, 'stroke-width': 0.8 }),
        h('path', { d: 'M-27 6L-12 21', stroke: NEON.mag, 'stroke-width': 0.7, opacity: 0.85 }),
        h('path', { d: col, fill: NEON.amberCore }), h('path', { d: colC, fill: NEON.cyanCore })),
      h('path', { ...DD('sky:T:moon-smog-streaks'), d: rect(-64, 6, 128, 2.2) + rect(-50, 14, 90, 1.4) + rect(-44, 22, 100, 1.2), fill: v('smog1'), opacity: 0.65, style: 'pointer-events:none !important' }),
      h('g', { transform: 'rotate(-14)' },
        h('path', { ...DD('sky:O:moon-orbital-ring'), d: 'M-48.6 2A48.6 9.6 0 0 0 48.6 2L47.4 2A47.4 8.4 0 0 1 -47.4 2Z', fill: NEON.cyan, opacity: 0.8, style: 'pointer-events:none !important' }),
        h('path', { d: 'M-48.4 2A48.4 9.4 0 0 1 -30 -6.2L-30 -5.4A47.6 8.6 0 0 0 -47.6 2ZM30 -6.2A48.4 9.4 0 0 1 48.4 2L47.6 2A47.6 8.6 0 0 0 30 -5.4Z', fill: NEON.cyan, opacity: 0.35 }),
        h('circle', { cx: 30, cy: 8.6, r: 1.4, fill: NEON.cyanCore }))));
  }
  let beamsM = '', arcL = '', shadowBeacon = '', shadowLamps = '';      // arcL: the arcology strip (L-stars, in front of the far skyline)
  // (the searchlights are built with L-clouds below, drawn in L-stars)
  // ---- window grid helper (merged paths per colour)
  const WIN = ['#FFB547', '#19E6FF', '#FF2E88', '#FFF3E0'];
  function windows(R, x0, x1, y0, y1, cw, ch, dens, buckets, ww = 1.8, wh = 2.6) {
    for (let y = y0; y < y1 - wh; y += ch) {
      const rowOn = R() < 0.85, band = R();
      if (!rowOn) continue;
      for (let x = x0; x < x1 - ww; x += cw) {
        if (R() > dens * (band < 0.2 ? 2.2 : 1)) continue;
        const k = R(); const i = k < 0.5 ? 0 : k < 0.72 ? 1 : k < 0.86 ? 2 : 3;
        buckets[i] += rect(x, y, ww, wh);
      }
    }
  }
  // ---- the SHADOW TOWER: a near-black monolith right behind the rider's head (static, very far: the arcology slides
  // in front of it). Its dark mass is what isolates the white head and bill, as the dark mid-tower of the keyframe.
  {
    const [x0, x1, top] = SHT, R = rng(335), w = x1 - x0;
    // (the item tag sits on the crown half, the part that rises clear of the rider and the harbour skyline)
    const body = poly([[x0, 300], [x0, top + 70], [x0 + 18, top + 70], [x0 + 18, top + 34], [x0 + 52, top + 34], [x0 + 52, top], [x1 - 52, top], [x1 - 52, top + 34], [x1 - 18, top + 34], [x1 - 18, top + 70], [x1, top + 70], [x1, 300]]);
    // rooftop clutter on the crown: water tanks, a dish, AC boxes, a little service hut (silhouettes with a magenta rim)
    const roof = rect(x0 + 64, top - 12, 16, 12) + rrect(x0 + 86, top - 16, 12, 16, 3) + rect(x0 + 104, top - 7, 22, 7) + rect(x1 - 120, top - 9, 26, 9)
      + rect(x1 - 88, top - 14, 18, 14) + `M${x1 - 64} ${top}l4 -12a9 9 0 0 0 10 -4l-8 0z` + rect(x0 + 30, top + 26, 14, 8) + rect(x1 - 44, top + 26, 14, 8);
    let seams = '', mull = '';
    for (let y = top + 92; y < 470; y += 24) seams += rect(x0 + 2, y, w - 4, 0.9);
    for (let x = x0 + 38; x < x1 - 20; x += 38) mull += rect(x, top + 74, 0.8, 470 - top - 74);
    // windows: sparse and dim, only in the two outer bands and low down (the face behind the head stays dark)
    const wb = ['', '', '', ''];
    windows(R, x0 + 6, x0 + 46, top + 80, 470, 6, 9, 0.2, wb, 1.8, 2.6); windows(R, x1 - 46, x1 - 6, top + 80, 470, 6, 9, 0.2, wb, 1.8, 2.6);
    windows(R, x0 + 50, x1 - 50, 392, 470, 6, 9, 0.12, wb, 1.8, 2.6);
    windows(R, x0 + 58, x1 - 58, top + 8, top + 30, 6, 7, 0.22, wb, 1.8, 2.4);
    // crown: setback light lines, a mast with the aircraft beacon (it blinks with the far lights), a window-cleaning gondola
    const cx = (x0 + x1) / 2;
    shadowBeacon = circ(cx, top - 58, 2.2); shadowLamps = circ(x0 + 52, top - 2, 1.4) + circ(x1 - 52, top - 2, 1.4) + circ(x0 + 18, top + 32, 1.3) + circ(x1 - 18, top + 32, 1.3);
    sunmoon += h('g', {},
      h('path', { ...DD('sky:O:shadow-tower'), d: body + rect(cx - 1, top - 58, 2, 58) + rect(cx - 16, top - 6, 32, 6), fill: lg('sky-shT', 0, top, 0, 480, [[0, v('megaDeep')], [0.6, v('megaDeep')], [1, v('mega')]]) }),
      h('path', { d: rect(x0, 299, w, 181), fill: lg('sky-shT2', 0, 299, 0, 480, [[0, v('megaDeep')], [1, v('mega')]]) }),
      h('path', { ...DD('sky:O:shadow-tower-roof'), d: roof, fill: v('megaDeep'), stroke: v('smogLit'), 'stroke-width': 0.7, 'stroke-opacity': 0.7 }),
      h('path', { ...DD('sky:T:shadow-tower-panels'), d: seams + mull, fill: v('megaHi'), opacity: 0.32 }),
      h('path', { d: `M${x1 - 0.7} ${top + 70}V470M${x1 - 18.7} ${top + 34}V${top + 70}M${x1 - 52.7} ${top}V${top + 34}`, stroke: v('smogLit'), 'stroke-width': 1.4, opacity: 0.55 }),
      h('path', { d: `M${x0 + 0.6} ${top + 70}V470`, stroke: NEON.cyan, 'stroke-width': 0.8, opacity: 0.3 }),
      h('g', { ...DD('sky:O:shadow-tower-crown'), style: NEONV },
        h('path', { d: `M${x0 + 52} ${top + 1}H${x1 - 52}M${x0 + 18} ${top + 35}H${x0 + 52}M${x1 - 52} ${top + 35}H${x1 - 18}M${x0} ${top + 71}H${x0 + 18}M${x1 - 18} ${top + 71}H${x1}`, stroke: NEON.cyan, 'stroke-width': 3.4, opacity: 0.18 }),
        h('path', { d: `M${x0 + 52} ${top + 1}H${x1 - 52}M${x0 + 18} ${top + 35}H${x0 + 52}M${x1 - 52} ${top + 35}H${x1 - 18}M${x0} ${top + 71}H${x0 + 18}M${x1 - 18} ${top + 71}H${x1}`, stroke: NEON.cyanCore, 'stroke-width': 1 })),
      h('g', { opacity: 0.3, style: NEONV }, wb.map((d, i) => h('path', { d, fill: WIN[i] }))),
      h('g', { ...DD('sky:O:shadow-gondola') },
        h('path', { d: `M${x1 - 40} ${top + 34}V${top + 94}M${x1 - 26} ${top + 34}V${top + 94}`, stroke: v('megaHi'), 'stroke-width': 0.6 }),
        h('path', { d: rect(x1 - 43, top + 94, 20, 6), fill: v('megaHi') }), h('path', { d: rect(x1 - 41, top + 95.5, 16, 2), fill: NEON.amberCore, opacity: 0.9 }),
        h('path', { d: circ(x1 - 33, top + 103, 5), fill: rg('sky-gond', [[0, NEON.amber, 0.6], [1, NEON.amber, 0]]) })));
  }
  // ---- far megatowers
  {
    const R = rng(331), RN = rng(332); let body = '', edge = '', mast = '', red = '', redTag = '', bodyT = ''; const b = ['', '', '', ''], bT = ['', '', '', ''], bN = ['', '', '', ''];
    const TW = [[-330, -200, 150, 0], [-40, 70, 176, 1], [128, 176, 232, 2], [300, 338, 300, 0], [372, 470, 290, 1], [1016, 1062, 226, 2], [1078, 1160, 286, 1], [1236, 1310, 262, 2], [1330, 1368, 308, 0], [1484, 1590, 170, 1], [1690, 1790, 214, 2], [1840, 1960, 250, 0]];
    for (const [x0, x1, top, kind] of TW) {
      const w = x1 - x0, cx = (x0 + x1) / 2;
      // the spire at x 1016–1062 (right of the shadow tower) rises clear of the skyline in the hero: it carries the tags
      const tag = x0 === 1016, before = body;
      if (kind === 0) body += poly([[x0, 480], [x0, top + 20], [cx, top], [x1, top + 20], [x1, 480]]);
      else if (kind === 1) body += poly([[x0, 480], [x0, top + 44], [x0 + w * 0.12, top + 44], [x0 + w * 0.12, top + 18], [x0 + w * 0.3, top + 18], [x0 + w * 0.3, top], [x1 - w * 0.3, top], [x1 - w * 0.3, top + 18], [x1 - w * 0.12, top + 18], [x1 - w * 0.12, top + 44], [x1, top + 44], [x1, 480]]);
      else body += poly([[x0, 480], [x0 + 4, top + 10], [cx, top], [x1 - 4, top + 10], [x1, 480]]);
      if (tag) { body = before; bodyT += poly([[x0, 300], [x0 + 4, top + 10], [cx, top], [x1 - 4, top + 10], [x1, 300]]); body += rect(x0, 299, w, 181); }
      edge += `M${f(x1 - 0.6)} ${f(top + 22)}V480`;
      const mh = 30 + R() * 50; mast += rect(cx - 0.8, top - mh, 1.6, mh + 2);
      if (tag) redTag += circ(cx, top - mh, 1.8) + circ(cx, top - mh * 0.45, 1.3); else red += circ(cx, top - mh, 1.8) + circ(cx, top - mh * 0.45, 1.3);
      if (tag) { windows(R, x0 + 6, x1 - 6, top + 22, 300, 6, 8, 0.16, bT, 1.6, 2.2); windows(R, x0 + 4, x1 - 4, 300, 470, 6, 8, 0.1, b, 1.6, 2.2); }
      else windows(R, x0 + 4, x1 - 4, top + 30, 470, 6, 8, 0.1, b, 1.6, 2.2);
      windows(RN, x0 + 4, x1 - 4, top + 26, 470, 6, 8, 0.16, bN, 1.6, 2.2);
    }
    // rooftop signs and a lit skybridge on the far towers (static, emissive)
    const vsign = (x, y, a, b2, lat, col, core) => h('g', {},
      h('path', { d: rrect(x - 9, y, 18, 44, 2), fill: '#10081C', stroke: col, 'stroke-width': 1.1 }),
      T(a, x, y + 18, 14, { fill: core }, 'middle'), T(b2, x, y + 36, 14, { fill: core }, 'middle'),
      h('path', { d: rrect(x - 12, y + 47, 24, 9, 1.5), fill: col }), T(lat, x, y + 54, fit(lat, 7, 20), { fill: '#10081C' }, 'middle'));
    const farSigns = h('g', { style: NEONV },
      vsign(392, 312, 'jiu', 'ba', 'bar', NEON.mag, NEON.magCore),
      h('g', { ...DD('sky:O:far-rooftop-signs') }, vsign(1119, 228, 'jiu', 'ba', 'bar', NEON.mag, NEON.magCore)),
      vsign(1352, 318, 'la', 'mian', 'ramen', NEON.amber, NEON.amberCore),
      h('g', { transform: 'translate(1484 190)' }, h('path', { d: rrect(4, 0, tw('h24', 12) + 10, 16, 3), fill: '#0C0F1E', stroke: NEON.acid, 'stroke-width': 1 }), T('h24', 9, 13, 12, { fill: '#F1FFD0' })),
      h('g', {},
        h('path', { d: rect(470, 330, 132, 6), fill: v('megaHi') }), h('path', { d: 'M470 331.2h132', stroke: NEON.cyan, 'stroke-width': 1, opacity: 0.9 }),
        h('path', { d: [476, 488, 500, 512, 524, 536, 548, 560, 572, 584].map(x => rect(x, 332.6, 6, 2.2)).join(''), fill: NEON.amberCore })),
      h('g', { ...DD('sky:O:far-skybridge') },
        h('path', { d: rect(1310, 344, 20, 7), fill: v('megaHi') }), h('path', { d: 'M1310 345.2h20', stroke: NEON.cyan, 'stroke-width': 1, opacity: 0.9 }),
        h('path', { d: [1313, 1318, 1323].map(x => rect(x, 347, 3, 2.4)).join(''), fill: NEON.amberCore })));
    sunmoon += h('g', {},
      h('path', { d: body + mast, fill: v('megaFar') }), h('path', { ...DD('sky:O:far-megatowers'), d: bodyT, fill: v('megaFar') }),
      h('path', { d: edge, stroke: v('smogLit'), 'stroke-width': 1, opacity: 0.35 }),
      h('g', { opacity: 0.38, style: NEONV }, b.map((d, i) => h('path', { d, fill: WIN[i] }))),
      h('g', { ...DD('sky:T:far-tower-windows'), opacity: 0.38, style: NEONV }, bT.map((d, i) => h('path', { d, fill: WIN[i] }))),
      h('g', { 'data-ref': 'sky-farNight', visibility: 'hidden', style: 'fill-opacity:var(--pb-n-winx)' }, h('g', { opacity: 0.5 }, bN.map((d, i) => h('path', { d, fill: WIN[i] })))),
      h('g', { 'data-ref': 'sky-farRed' }, h('path', { d: red, fill: NEON.red }), h('path', { ...DD('sky:O:far-tower-lights'), d: redTag, fill: NEON.red }), h('path', { ...DD('sky:O:shadow-tower-beacon'), d: shadowBeacon, fill: NEON.red }), h('path', { d: shadowLamps, fill: NEON.red })), farSigns);
  }
  // ---- orbital lift (tether + anchor + marker lights; the capsule climbs on its own strip)
  {
    const TX = 96; let marks = '';
    for (let y = -400; y < 300; y += 46) marks += circ(TX, y, 1.3);
    sunmoon += h('g', {},
      h('path', { ...DD('sky:O:orbital-lift'), d: rect(TX - 1.1, -430, 2.2, 740), fill: v('megaHi') }),
      h('path', { d: `M${TX + 1.1} -430V310`, stroke: NEON.cyan, 'stroke-width': 0.6, opacity: 0.45 }),
      h('path', { d: marks, fill: NEON.cyanCore, style: NEONV }),
      h('path', { ...DD('sky:O:lift-anchor'), d: poly([[TX - 34, 480], [TX - 10, 300], [TX - 6, 250], [TX + 6, 250], [TX + 10, 300], [TX + 34, 480]]) + rect(TX - 22, 296, 44, 6) + rect(TX - 16, 262, 32, 4), fill: v('mega') }),
      h('path', { d: `M${TX - 22} 296h44M${TX - 16} 262h32`, stroke: NEON.mag, 'stroke-width': 1, opacity: 0.8, style: NEONV }),
      h('g', { transform: `translate(${TX + 30} 286)`, style: NEONV },
        h('path', { d: rrect(-3, -9, tw('lift', 7) + 6, 12, 2), fill: v('mega'), stroke: NEON.amber, 'stroke-width': 0.7 }),
        T('lift', 0, 0, 7, { fill: NEON.amberCore })));
  }
  // ---- the ARCOLOGY
  {
    const R = rng(341);
    let body = '', ribs = '', rimM = '', rimC = '', rings = '', ringsC = '', butt = '', gardens = '';
    const b = ['', '', '', ''];
    for (const [x0, x1, top] of TIERS) body += rect(x0, top, x1 - x0, 480 - top);
    for (const [x0, x1, top] of CROWN) body += rect(x0, top, x1 - x0, 12 + (132 - top));
    body += poly([[893, 74], [900, -40], [907, 74]]);       // spire
    const tierWin = [];
    TIERS.forEach(([x0, x1, top], i) => {
      const bot = i === 0 ? 480 : TIERS[i - 1][2];
      const bt = ['', '', '', '']; windows(R, x0 + 6, x1 - 6, top + 10, bot - 2, 5.2, 7.2, 0.19, bt); tierWin.push(bt);
      for (let x = x0 + 26; x < x1 - 10; x += 38 + (i % 2) * 8) ribs += rect(x, top + 4, 1.1, bot - top - 6);
      ribs += rect(x0 + 3, top + 18, x1 - x0 - 6, 1.1);
      rimM += `M${x1 - 0.8} ${top + 1}V${bot}`; rimC += `M${x0 + 0.8} ${top + 1}V${bot}`;
      if (i % 2) ringsC += `M${x0 + 2} ${top + 1.5}H${x1 - 2}`; else rings += `M${x0 + 2} ${top + 1.5}H${x1 - 2}`;
      // raking buttresses at each shoulder, sky-gardens on the ledges
      butt += poly([[x0, top + 40], [x0 - 26, bot], [x0 - 18, bot], [x0 + 4, top + 52]]) + poly([[x1, top + 40], [x1 + 26, bot], [x1 + 18, bot], [x1 - 4, top + 52]]);
      if (i > 0) for (let x = x0 - 46; x < x0 - 6; x += 7) gardens += circ(x + 3, top + (bot - top) - 3 - R() * 3, 3 + R() * 2);
    });
    windows(R, 832, 968, 100, 132, 5.2, 7.2, 0.25, b);
    // deep night: the arcology fills in (a second, denser window set, shown only when the mood asks for it)
    const nw = ['', '', '', ''];
    TIERS.forEach(([x0, x1, top], i) => windows(R, x0 + 8, x1 - 8, top + 12, (i === 0 ? 480 : TIERS[i - 1][2]) - 4, 5.2, 7.2, 0.17, nw));
    // vertical neon light strips on the tier faces (cyan / magenta / amber), and the hologram halo rings on the spire
    let vs = ['', '', ''];
    for (const [x, y0, y1, c] of [[716, 252, 314, 0], [1084, 188, 242, 1], [664, 324, 388, 2], [760, 190, 242, 1], [1040, 138, 180, 0], [1136, 322, 388, 0], [812, 136, 180, 2], [614, 398, 470, 1]]) vs[c] += rect(x, y0, 2.2, y1 - y0);
    const ell = (y, rx, ry) => `M${900 - rx} ${y}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
    const halo = [[30, 58, 7], [52, 44, 5.5], [70, 30, 4]].map(([y, rx, ry]) => ell(y, rx, ry));
    const haloBand = [[30, 58, 7], [52, 44, 5.5], [70, 30, 4]].map(([y, rx, ry]) => ell(y, rx + 0.6, ry + 0.6) + ell(y, rx - 0.6, ry - 0.6));
    // antenna farm on the crown
    let mast = '', dish = '', red = '', mastR = '';
    for (const [x, hgt] of [[836, 40], [850, 62], [948, 54], [962, 34], [880, 26], [920, 30]]) { if (x > 940) mastR += rect(x - 0.7, 96 - hgt, 1.4, hgt); else mast += rect(x - 0.7, 96 - hgt, 1.4, hgt); red += circ(x, 96 - hgt, 1.7); }
    red += circ(900, -40, 2.4) + circ(900, 20, 1.6);
    dish = 'M830 128a9 9 0 0 0 16 -6zM837.4 125.5l-2 6h3zM868 74h64';
    const dishR = 'M970 128a9 9 0 0 1 -16 -6zM962.6 125.5l2 6h-3z';
    // landing pad on the right shoulder of tier 2
    const pad = h('g', { ...DD('sky:O:arcology-landing-pad') },
      h('path', { d: poly([[1148, 318], [1236, 318], [1232, 326], [1148, 330]]) + poly([[1150, 330], [1200, 330], [1150, 356]]), fill: v('megaHi') }),
      h('path', { d: 'M1178 316.6h26', stroke: NEON.amber, 'stroke-width': 1.2, 'stroke-dasharray': '2 3', style: NEONV }),
      h('path', { d: 'M1186 318l2 -4h1v2h6v-2h1l2 4', fill: 'none', stroke: NEON.acid, 'stroke-width': 0.8 }),
      h('path', { d: circ(1234, 318, 1.8), fill: NEON.cyanCore }));
    // vertical 天穹塔 sign on tier 3's right face
    const sx = 1068, sy = 254;
    const sign = h('g', { ...DD('sky:O:arcology-sign'), style: NEONV },
      h('path', { d: rrect(sx - 12, sy, 24, 78, 3), fill: '#12091F', stroke: NEON.mag, 'stroke-width': 1.4 }),
      T('tian', sx, sy + 23, 19, { fill: NEON.magCore }, 'middle'), T('qiong', sx, sy + 47, 19, { fill: NEON.magCore }, 'middle'), T('ta', sx, sy + 71, 19, { fill: NEON.magCore }, 'middle'));
    // PELICORP crown logo + pelican-head mark
    const lw = tw('pelicorp', 13);
    const logo = h('g', { ...DD('sky:O:arcology-logo'), style: NEONV },
      T('pelicorp', 900 + 9, 124, 13, { fill: NEON.cyanCore }, 'middle'),
      h('path', { d: `M${f(900 - lw / 2 - 12)} 116a5 5 0 1 1 0.1 0zM${f(900 - lw / 2 - 9)} 113l10 3l-10 2`, fill: 'none', stroke: NEON.cyan, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }),
      T('jituan', 900, 90, 11, { fill: NEON.magCore }, 'middle'));
    // NEON COLA video wall on tier 2, left face
    const vx = 672, vy = 332, vw = 104, vh = 48;
    const screen = h('g', { ...DD('sky:O:arcology-screen'), style: NEONV },
      h('path', { d: rect(vx, vy, vw, vh), fill: lg('sky-scr', 0, 0, 0, 1, [[0, '#2A0E3E'], [1, '#5A1050']], 'objectBoundingBox'), stroke: NEON.mag, 'stroke-width': 1 }),
      h('path', { d: rrect(vx + 8, vy + 8, 14, 32, 3), fill: NEON.red }), h('path', { d: rect(vx + 8, vy + 18, 14, 6), fill: NEON.white }),
      T('a2a', vx + 64, vy + 24, fit('a2a', 16, 72), { fill: NEON.magCore }, 'middle'),
      T('a2b', vx + 64, vy + 38, fit('a2b', 9, 70), { fill: NEON.cyanCore }, 'middle'));
    // LED stock ticker band across tier 2 (two copies of the tape, a scroll-blur fading at both ends)
    const ticker = h('g', { ...DD('sky:O:arcology-ticker'), style: NEONV },
      h('path', { d: rect(780, 295, 266, 12), fill: '#0A0614', stroke: NEON.amber, 'stroke-width': 0.7 }),
      T('tick', 788, 304.4, 9, { fill: NEON.acid }), T('tick', 914, 304.4, 9, { fill: NEON.acid }),
      h('path', { d: rect(781, 296, 10, 10) + rect(1035, 296, 10, 10), fill: '#0A0614', opacity: 0.7 }),
      h('path', { d: 'M1022 302l3 -4l3 4zM1031 299l3 4l3 -4z', fill: NEON.red }));
    // glass elevator cars riding the light strips (lit cabins with a cyan sill)
    let lift = '', liftC = '';
    for (const [x, y] of [[716, 270], [664, 352], [760, 214], [1136, 340], [614, 430], [1084, 200]]) { lift += rrect(x - 2.2, y, 6.6, 8.4, 1.2); liftC += rect(x - 1.6, y + 7, 5.4, 1.1); }
    const elev = h('g', { ...DD('sky:O:arcology-elevators'), style: NEONV }, h('path', { d: lift, fill: NEON.amberCore }), h('path', { d: liftC, fill: NEON.cyan }));
    // an air taxi docked on the landing pad: hull, cyan canopy, magenta underglow, a red tail light
    const shuttle = h('g', { ...DD('sky:O:arcology-shuttle') },
      h('path', { d: 'M1192 316.4c1 -5 6 -7.6 13 -7.6h9c6 0 10 3 12 7.6Z', fill: v('megaHi') }),
      h('path', { d: 'M1201 309.4c2 -3.6 9 -3.6 12 0Z', fill: '#7EEBFF', opacity: 0.85 }),
      h('path', { d: 'M1194 317.2h31', stroke: NEON.mag, 'stroke-width': 1.3, style: NEONV }),
      h('path', { d: circ(1193, 314.6, 1.2), fill: NEON.red }), h('path', { d: circ(1225, 314, 1.3), fill: NEON.white }));
    const label = h('g', { ...DD('sky:O:arcology-label'), style: NEONV },
      h('path', { d: rrect(764, 190, tw('arco', 6.5) + 8, 10, 2), fill: '#0D0818', stroke: NEON.cyan, 'stroke-width': 0.6 }), T('arco', 768, 198, 6.5, { fill: NEON.cyanCore }));
    arcL = h('g', { 'data-ref': 'sky-arc', transform: 'translate(0 0)' }, h('g', { ...DD('sky:O:arcology'), transform: arcT },
      h('path', { ...DD('sky:O:arcology-buttresses'), d: butt, fill: v('mega') }),
      h('path', { ...DD('sky:O:arcology-gardens'), d: gardens, fill: '#1E7A6E', opacity: 0.8 }),
      h('path', { d: body, fill: v('mega') }),
      h('path', { ...DD('sky:T:arcology-ribs'), d: ribs, fill: v('megaHi'), opacity: 0.55 }),
      h('g', { opacity: 0.56, style: NEONV }, [b, ...tierWin].map(bb => h('g', { ...DD('sky:T:arcology-windows') }, bb.map((d, i) => h('path', { d, fill: WIN[i] }))))),
      h('g', { 'data-ref': 'sky-arcNight', visibility: 'hidden', style: 'fill-opacity:var(--pb-n-winx)' }, h('g', { ...DD('sky:T:night-windows'), opacity: 0.7 }, nw.map((d, i) => h('path', { d, fill: WIN[i] })))),
      h('path', { ...DD('sky:O:arcology-rim'), d: rimM, stroke: v('smogLit'), 'stroke-width': 1.6, opacity: 0.7 }),
      h('path', { d: rimC, stroke: NEON.cyan, 'stroke-width': 1, opacity: 0.3 }),
      // bloom: static, far, on this sheet only
      // bloom as stacked strokes (a filter here re-rasterised the whole sheet far too often in live play)
      h('g', { style: NEONV },
        [[7, 0.12], [3.6, 0.3]].map(([w, a]) => h('g', { opacity: a },
          h('path', { d: rings, stroke: NEON.mag, 'stroke-width': w }), h('path', { d: ringsC, stroke: NEON.cyan, 'stroke-width': w }),
          h('path', { d: vs[0], stroke: NEON.cyan, 'stroke-width': w }), h('path', { d: vs[1], stroke: NEON.mag, 'stroke-width': w }), h('path', { d: vs[2], stroke: NEON.amber, 'stroke-width': w }),
          h('path', { d: halo[0] + halo[2], fill: 'none', stroke: NEON.cyan, 'stroke-width': w }), h('path', { d: halo[1], fill: 'none', stroke: NEON.mag, 'stroke-width': w })))),
      h('g', { style: NEONV }, h('path', { d: vs[0], fill: NEON.cyan }), h('path', { d: vs[1], fill: NEON.mag }), h('path', { d: vs[2], fill: NEON.amber })),
      h('g', { ...DD('sky:O:arcology-light-strips'), style: NEONV }, h('path', { d: vs[0] + vs[1] + vs[2], fill: '#FFFFFF', opacity: 0.55 })),
      h('g', { ...DD('sky:O:arcology-halo-rings'), style: NEONV }, h('path', { d: haloBand[0] + haloBand[2], fill: NEON.cyanCore, 'fill-rule': 'evenodd' }), h('path', { d: haloBand[1], fill: NEON.magCore, 'fill-rule': 'evenodd' })),
      h('g', { ...DD('sky:O:arcology-neon-rings'), style: NEONV }, h('path', { d: rings, stroke: NEON.magCore, 'stroke-width': 1 }), h('path', { d: ringsC, stroke: NEON.cyanCore, 'stroke-width': 1 })),
      h('path', { d: mast + dish, fill: v('megaHi'), stroke: v('megaHi'), 'stroke-width': 0.8 }),
      h('path', { ...DD('sky:O:arcology-antennas'), d: mastR + dishR, fill: v('megaHi'), stroke: v('megaHi'), 'stroke-width': 0.8 }),
      pad, shuttle, sign, logo, screen, ticker, elev, label,
      h('path', { 'data-ref': 'sky-arcRed', ...DD('sky:O:arcology-warning-lights'), d: red, fill: NEON.red }),
      h('rect', { x: 560, y: 360, width: 680, height: 120, fill: lg('sky-veil', 0, 360, 0, 480, [[0, v('haze'), 0], [1, v('haze'), 0.6]]) })));
  }

  // ---- city-mood layers (static, each shown only when its mood asks for it; strength = a palette number)
  {
    // dawn: an orange smog sea filling the lower half of the sky, rolling lenses lit from below by the low sun
    const R = rng(381); let lens = ['', '', ''];
    [[150, 0.35], [235, 0.5], [320, 0.75]].forEach(([y0, a], k) => {
      let d = `M${X0} 480V${y0 + 20}`;
      for (let x = X0; x < X1; x += 80) d += `Q${f(x + 40)} ${f(y0 - 6 - R() * 26)} ${f(x + 80)} ${f(y0 + 8 + R() * 16)}`;
      lens[k] = d + `V480Z`;
    });
    const dawnG = lg('sky-dawnG', 0, 140, 0, 470, [[0, '#FF9A4A', 0.05], [0.5, '#FF8A3A', 0.3], [1, '#FFB060', 0.55]]);
    sunmoon += h('g', { 'data-ref': 'sky-dawn', visibility: 'hidden', style: 'fill-opacity:var(--pb-n-dawn);stroke-opacity:var(--pb-n-dawn)' },
      h('g', { ...DD('sky:O:dawn-smog') }, lens.map(d => h('path', { d, fill: dawnG }))),
      h('path', { d: lens[2], fill: 'none', stroke: '#FFC27A', 'stroke-width': 1.4, opacity: 0.5 }));
    // acid-rain night: a magenta haze and heavy slanted streaks hanging in the lit smog (static, merged)
    const RA = rng(382); let st = '', st2 = '';
    for (let i = 0; i < 520; i++) {
      const x = X0 + RA() * W, y = -60 + RA() * 520, l = 14 + RA() * 30;
      const seg = `M${f1(x)} ${f1(y)}l${f1(-l * 0.22)} ${f1(l)}`; if (RA() < 0.3) st2 += seg; else st += seg;
    }
    sunmoon += h('g', { 'data-ref': 'sky-acid', visibility: 'hidden', style: 'fill-opacity:var(--pb-n-acid);stroke-opacity:var(--pb-n-acid)' },
      h('rect', { ...DD('sky:O:acid-haze'), x: X0, y: 120, width: W, height: 360, fill: lg('sky-acidG', 0, 120, 0, 480, [[0, '#FF2E88', 0], [0.55, '#FF2E88', 0.2], [1, '#FF5AA0', 0.42]]) }),
      h('path', { ...DD('sky:T:acid-streaks'), d: st, stroke: '#FF7AB8', 'stroke-width': 0.8, opacity: 0.32 }),
      h('path', { d: st2, stroke: '#D8FBFF', 'stroke-width': 0.9, opacity: 0.3 }));
  }

  // ======================== L-clouds: searchlights, smog banks, traffic, blimp, hover car, police, lightning, storm
  let clouds = '';
  // searchlights (one isolated sheet inside L-sunmoon; each beam turns slowly about its foot on the horizon)
  {
    const beamG = lg('sky-beam', 0, 0, 0, -760, [[0, v('search'), 0.2], [0.4, v('search'), 0.08], [1, v('search'), 0]]);
    const coreG = lg('sky-beamC', 0, 0, 0, -760, [[0, '#FFFFFF', 0.3], [0.45, v('search'), 0.07], [1, v('search'), 0]]);
    // lighting pass (perf): the beams sit at the END of L-sky (in front of the arcology: the lamps stand in the near
    // city, their feet hide behind the skyline layers). Slotted mid-sheet they cut L-sky into two composited sheets
    // (+0.3 screen of compositing every frame). Shortened to 760 (the gradient is spent long before 1150).
    beamsM = h('g', { 'data-ref': 'sky-beams', style: 'fill-opacity:var(--pb-n-search)' }, BEAMS.map(([x, a0], i) => h('g', { 'data-ref': 'sky-beam' + i, ...(i === 0 ? DD('sky:O:searchlights') : {}), transform: `translate(${x} 486) rotate(${a0})` },
      h('path', { d: poly([[-5, 0], [5, 0], [78, -760], [-78, -760]]), fill: beamG, style: 'pointer-events:none !important' }),
      h('path', { ...(i === 0 ? DD('sky:T:searchlight-cores') : {}), d: poly([[-1.5, 0], [1.5, 0], [16, -760], [-16, -760]]), fill: coreG, style: 'pointer-events:none !important' }))));
  }
  // smog banks (each its own translate strip)
  {
    const gBody = lg('sky-smogG', 0, 0, 0, 1, [[0, v('smogHi'), 0], [0.3, v('smogHi'), 0.3], [0.62, v('smog1'), 0.6], [1, v('smogLit'), 0.5]], 'objectBoundingBox');
    const gHigh = lg('sky-smogW', 0, 0, 0, 1, [[0, v('smogHi'), 0], [0.5, v('smogHi'), 0.4], [1, v('smog1'), 0.12]], 'objectBoundingBox');
    const R = rng(351);
    const BANKS = [[-300, 40, 560, 16, 1], [360, 150, 360, 10, 1], [1060, 36, 560, 18, 1], [1760, 52, 420, 14, 1],
      [-80, 318, 560, 34, 0], [640, 352, 540, 30, 0], [1300, 300, 640, 36, 0], [2220, 250, 520, 32, 0],
      [260, 404, 700, 40, 0], [1180, 412, 820, 44, 0], [2500, 380, 600, 40, 0], [2900, 150, 420, 16, 1]];
    const strip = ['', ''];
    BANKS.forEach(([x, y, w, th, high], i) => {
      // a long lens of smog: a gently rolling top, a soft flat belly (no cauliflower lobes: this is smog, not cumulus)
      const n = Math.max(3, Math.round(w / 90)), ph = R() * 6;
      let top = `M${f(x)} ${f(y + th)}`;
      for (let k = 1; k <= n; k++) {
        const u = k / n, xx = x + w * u, env = Math.pow(Math.sin(Math.PI * u), 0.6);
        const um = (k - 0.5) / n, envm = Math.pow(Math.sin(Math.PI * um), 0.6);
        top += `Q${f(x + w * um)} ${f(y + th - envm * th * (0.75 + 0.35 * Math.sin(k * 1.7 + ph)))} ${f(xx)} ${f(y + th - env * th * (0.55 + 0.25 * Math.sin(k * 2.3 + ph)))}`;
      }
      top += `Q${f(x + w * 0.75)} ${f(y + th * 1.55)} ${f(x + w * 0.5)} ${f(y + th * 1.5)}Q${f(x + w * 0.25)} ${f(y + th * 1.45)} ${f(x)} ${f(y + th)}Z`;
      const belly = `M${f(x + w * 0.12)} ${f(y + th * 1.36)}Q${f(x + w * 0.5)} ${f(y + th * 1.62)} ${f(x + w * 0.88)} ${f(y + th * 1.36)}`;
      // thin strata ribbons inside the bank (baked, static)
      let rib = '';
      if (!high) for (let k = 0; k < 3; k++) { const yy = y + th * (0.7 + k * 0.22), x0 = x + w * (0.1 + R() * 0.2), x1 = x + w * (0.7 + R() * 0.2); rib += rect(x0, yy, x1 - x0, 1 + R()); }
      const k = high || i % 3 === 2 ? 1 : 0, P = SMOG[k][0];
      const one = h('g', {},
        h('path', { ...DD(high ? 'sky:O:smog-wisps' : 'sky:O:smog-banks'), d: top, fill: high ? gHigh : gBody, style: 'pointer-events:none !important' }),
        high ? '' : h('path', { d: rib, fill: v('smogHi'), opacity: 0.35 }),
        high ? '' : h('path', { ...DD('sky:T:smog-lit-bellies'), d: belly, fill: 'none', stroke: v('smogLit'), 'stroke-width': 2.2, opacity: 0.45, 'stroke-linecap': 'round' }));
      // periodic copies: the strip translates by −(0…P), so every bank also sits at x + P (and at x − P if it pokes past X0 + P)
      strip[k] += one + h('g', { transform: `translate(${P} 0)` }, one) + (x + w > X0 + P ? h('g', { transform: `translate(${-P} 0)` }, one) : '');
    });
    strip.forEach((m, k) => { clouds += h('g', { 'data-ref': 'sky-smog' + k, transform: 'translate(0 0)' }, m); });
  }
  // traffic lanes: each lane is one strip, its content repeated at +W so a wrapped translate is seamless
  {
    const R = rng(361);
    const strips = ['', ''];
    LANES.forEach((L, li) => {
      let head = '', tail = '', trail = '', glowM = '', glowC = '', halo = '', convoy = '';
      const dir = L.g ? 1 : -1, s = L.s;
      const cars = [];
      for (let i = 0; i < L.n; i++) cars.push([X0 + (i + R() * 0.7) * (W / L.n), L.y + (R() - 0.5) * 8 * s, R()]);
      for (const rep of [0, W]) for (const [cx0, cy, k] of cars) {
        const cx = cx0 + rep, fx = cx + dir * 3.2 * s, bx = cx - dir * 3.2 * s;
        if (L.convoy && k < 0.25) { for (let j = 0; j < 3; j++) convoy += circ(cx + j * 6 * s * -dir, cy, 1.1 * s); continue; }
        head += circ(fx, cy, 1.4 * s); tail += circ(bx, cy, 1.15 * s);
        halo += circ(fx, cy, 3.8 * s);
        trail += `M${f(bx)} ${f(cy)}h${f(-dir * (10 + k * 18) * s)}`;
        if (k > 0.86) glowM += `M${f(bx)} ${f(cy + 1.8 * s)}H${f(fx)}`; else if (k > 0.72) glowC += `M${f(bx)} ${f(cy + 1.8 * s)}H${f(fx)}`;
      }
      // (perf: the lane alpha sits on each paint, not on the group: a group opacity over a strip-wide lane made the
      // compositor give every lane a layer of its own)
      const a = L.a, fo = k => ({ 'fill-opacity': f(k * a) }), so = k => ({ 'stroke-opacity': f(k * a) });
      strips[L.g] += h('g', { ...DD(L.far ? 'sky:O:far-skyway' : 'sky:O:traffic-lanes') },
        h('path', { ...DD('sky:T:traffic-trails'), d: trail, stroke: NEON.red, 'stroke-width': 1.1 * s, ...so(0.35), fill: 'none', 'stroke-linecap': 'round' }),
        h('path', { d: halo, fill: NEON.white, ...fo(0.14) }),
        h('path', { d: head, fill: NEON.white, ...fo(1) }),
        h('path', { d: tail, fill: NEON.red, ...fo(1) }),
        glowM ? h('path', { ...DD('sky:O:traffic-underglow'), d: glowM, stroke: NEON.mag, 'stroke-width': 1.2 * s, ...so(1), fill: 'none', 'stroke-linecap': 'round' }) : '',
        glowC ? h('path', { ...DD('sky:O:traffic-underglow'), d: glowC, stroke: NEON.cyan, 'stroke-width': 1.2 * s, ...so(1), fill: 'none', 'stroke-linecap': 'round' }) : '',
        convoy ? h('path', { ...DD('sky:O:cargo-convoy'), d: convoy, fill: NEON.acid, ...fo(1) }) : '');
    });
    strips.forEach((m, g) => { clouds += h('g', { 'data-ref': 'sky-lane' + g, transform: 'translate(0 0)' }, m); });
  }
  // ---- the blimp with its hologram ad
  {
    const env = 'M-120 0C-120 -22 -70 -34 0 -34C70 -34 118 -24 124 0C118 24 70 34 0 34C-70 34 -120 22 -120 0Z';
    let seams = '';
    for (const x of [-92, -62, -32, -2, 28, 58, 88]) { const hh = 34 * Math.sqrt(Math.max(0, 1 - (x / 124) ** 2)); seams += `M${x} ${f(-hh)}Q${x + 7} 0 ${x} ${f(hh)}`; }
    const hullG = lg('sky-hull', 0, 0, 0, 1, [[0, v('megaHi')], [0.45, v('mega')], [1, '#07060F']], 'objectBoundingBox');
    const fins = h('g', { ...DD('sky:O:blimp-fins') },
      h('path', { d: 'M-88 -24L-132 -48L-138 -44L-120 -6ZM-88 24L-132 48L-138 44L-120 6Z', fill: v('mega') }),
      h('path', { d: 'M-132 -48L-138 -44M-132 48L-138 44', stroke: NEON.mag, 'stroke-width': 1.6 }),
      h('path', { d: 'M-100 -3L-142 -2L-142 3L-100 4Z', fill: v('megaHi') }));
    const gond = h('g', { ...DD('sky:O:blimp-gondola') },
      h('path', { d: rrect(-34, 30, 64, 15, 5), fill: v('mega'), stroke: NEON.cyan, 'stroke-width': 0.7 }),
      h('path', { d: [-26, -17, -8, 1, 10, 19].map(x => rect(x, 34, 5, 5)).join(''), fill: NEON.amberCore, opacity: 0.9 }));
    const engines = h('g', { ...DD('sky:O:blimp-engines') },
      h('path', { d: rrect(-60, 26, 22, 8, 4) + rrect(40, 26, 22, 8, 4), fill: v('megaHi') }),
      h('ellipse', { 'data-ref': 'sky-prop0', cx: -62, cy: 30, rx: 1.4, ry: 10, fill: v('smogHi'), opacity: 0.8 }),
      h('ellipse', { 'data-ref': 'sky-prop1', cx: 38, cy: 30, rx: 1.4, ry: 10, fill: v('smogHi'), opacity: 0.8 }));
    const nav = h('g', {}, h('path', { ...DD('sky:O:blimp-navlights'), d: circ(-138, -44, 1.8) + circ(-138, 44, 1.8), fill: NEON.red }),
      h('circle', { cx: 0, cy: 34.5, r: 1.8, fill: NEON.red }),
      h('g', { 'data-ref': 'sky-strobe' }, h('circle', { cx: 124, cy: 0, r: 6, fill: NEON.white, opacity: 0.3 }), h('circle', { cx: 124, cy: 0, r: 2, fill: '#FFFFFF' })));
    // hologram panel: projector cone, frame brackets, scanlines, 3 rotating ads
    const PX0 = -96, PX1 = 96, PY0 = 74, PY1 = 150;
    defs += h('pattern', { id: 'sky-scan', width: 4, height: 3, patternUnits: 'userSpaceOnUse' }, h('rect', { width: 4, height: 1.1, fill: NEON.cyan, opacity: 0.35 }));
    const cone = h('path', { ...DD('sky:O:holo-projector'), d: poly([[-4, 46], [4, 46], [PX1, PY0], [PX0, PY0]]), fill: lg('sky-cone', 0, 46, 0, PY0, [[0, NEON.cyan, 0.5], [1, NEON.cyan, 0.08]]) });
    const bk = (x, y, dx, dy) => `M${x} ${y + dy * 10}V${y}H${x + dx * 10}`;
    const frame = h('g', { ...DD('sky:O:holo-ad') },
      h('path', { d: rect(PX0, PY0, PX1 - PX0, PY1 - PY0), fill: NEON.cyan, opacity: 0.13 }),
      h('path', { ...DD('sky:T:holo-scanlines'), d: rect(PX0, PY0, PX1 - PX0, PY1 - PY0), fill: 'url(#sky-scan)' }),
      h('path', { d: bk(PX0, PY0, 1, 1) + bk(PX1, PY0, -1, 1) + bk(PX0, PY1, 1, -1) + bk(PX1, PY1, -1, -1), fill: 'none', stroke: NEON.cyanCore, 'stroke-width': 1.4 }),
      h('path', { d: rrect(PX1 - 22, PY0 + 4, 18, 7, 1.5), fill: NEON.mag }), h('path', { d: `M${PX1 - 18} ${PY0 + 7.5}h10`, stroke: '#FFFFFF', 'stroke-width': 1, 'stroke-dasharray': '1.5 1' }));
    const IC = {
      fish: 'M-86 110c6 -8 18 -10 26 -2l6 -5v14l-6 -5c-8 8 -20 6 -26 -2zM-80 108.6a1.2 1.2 0 1 1 0.1 0z',
      beak: 'M-88 102c4 -6 14 -6 18 -2l14 6l-14 4c-6 4 -14 4 -18 -2zM-72 104h14M-80 106a1.4 1.4 0 1 1 0.1 0z',
      bird: 'M-84 124v-16c0 -6 4 -9 8 -9c3 0 5 2 5 5l14 5l-12 3c-2 2 -5 3 -7 3v9zM-78 103.4a1.2 1.2 0 1 1 0.1 0z',
      koi: 'M-88 110c5 -9 18 -11 26 -3l7 -6v18l-7 -6c-8 8 -21 6 -26 -3zM-82 108.6a1.2 1.2 0 1 1 0.1 0zM-74 104c2 3 2 9 0 12M-68 105c1.6 3 1.6 7 0 10',
      train: 'M-88 116v-12c0 -4 3 -6 8 -6h18c6 0 10 4 12 10l2 8zM-84 104h8v5h-8zM-72 104h8v5h-8zM-90 121h44M-84 116l-3 5M-56 116l3 5',
      pagoda: 'M-86 104h28l-4 -5h-20zM-84 104v6h24v-6M-90 116h36l-5 -6h-26zM-86 116v8h28v-8M-72 99v-6M-76 124v-5h8v5',
    };
    const ad = (i, a, b2, c, icon, col, col2) => h('g', { 'data-ref': 'sky-ad' + i, visibility: i ? 'hidden' : 'visible' },
      h('path', { ...(i === 0 ? DD('sky:O:holo-ad-icons') : {}), d: IC[icon], fill: 'none', stroke: col, 'stroke-width': 1.6, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }),
      T(a, 14, 104, fit(a, 22, 136), { fill: col2 }, 'middle'),
      T(b2, 14, 122, fit(b2, 11, 138), { fill: col }, 'middle'),
      T(c, 0, 140, fit(c, 7.5, 176), { fill: NEON.cyanCore, opacity: 0.85 }, 'middle'),
      i === 2 ? h('path', { d: rect(-90, 100, 22, 28), fill: 'none', stroke: NEON.acid, 'stroke-width': 0.8, 'stroke-dasharray': '2 1.5' }) : '');
    const ads = h('g', { 'data-ref': 'sky-ads' },
      ad(0, 'a1a', 'a1b', 'a1c', 'fish', NEON.cyan, NEON.cyanCore),
      ad(1, 'a3a', 'a3b', 'a3c', 'beak', NEON.mag, NEON.magCore),
      ad(2, 'a4a', 'a4b', 'a4c', 'bird', NEON.acid, '#F1FFD0'),
      // district ads (one per stretch of the route: the blimp sells what the street below sells)
      ad(3, 'm1a', 'm1b', 'm1c', 'fish', NEON.amber, NEON.amberCore),
      ad(4, 'm2a', 'm2b', 'm2c', 'koi', NEON.mag, NEON.magCore),
      ad(5, 'm3a', 'm3b', 'm3c', 'train', NEON.cyan, NEON.cyanCore),
      ad(6, 'm4a', 'm4b', 'm4c', 'pagoda', NEON.amber, '#FFE6B0'));
    const blimp = h('g', {},
      cone, frame, ads,
      fins, engines,
      h('path', { ...DD('sky:O:blimp'), d: env, fill: hullG }),
      h('path', { ...DD('sky:T:blimp-panels'), d: seams + 'M-112 -6H112', fill: 'none', stroke: v('megaHi'), 'stroke-width': 0.8, opacity: 0.9 }),
      h('path', { d: 'M-116 8C-60 14 60 14 118 6', fill: 'none', stroke: NEON.mag, 'stroke-width': 1.4, opacity: 0.85 }),
      h('path', { d: 'M-104 -18C-60 -30 40 -32 100 -20', fill: 'none', stroke: NEON.cyan, 'stroke-width': 1, opacity: 0.55 }),
      T('hull', -46, 3, 12, { ...DD('sky:O:blimp-lettering'), fill: NEON.amberCore }),
      gond, nav);
    clouds += h('g', { 'data-ref': 'sky-ship', transform: 'translate(1300 170)' }, blimp);
  }
  // ---- hover car (close lane) and the rare police spinner
  {
    const carBody = 'M-44 4C-42 -6 -26 -12 -6 -12H16C30 -12 40 -6 46 2L42 9H-38Z';
    const beam = lg('sky-hcB', 0, 0, 1, 0, [[0, NEON.white, 0.45], [1, NEON.white, 0]], 'objectBoundingBox');
    const trail = lg('sky-hcT', 1, 0, 0, 0, [[0, NEON.red, 0.55], [1, NEON.red, 0]], 'objectBoundingBox');
    const thr = rg('sky-thr', [[0, NEON.amber, 0.9], [1, NEON.amber, 0]]);
    const car = (dd, tint) => h('g', {},
      h('path', { ...(dd ? DD('sky:O:hover-car-beam') : {}), d: 'M46 1L230 -20L230 26Z', fill: beam }),
      h('path', { d: 'M-44 3L-230 -3L-230 9Z', fill: trail }),
      h('path', { ...(dd ? DD('sky:O:hover-car') : {}), d: carBody, fill: tint }),
      h('path', { d: 'M-18 -11C-12 -20 10 -20 18 -11Z', fill: '#7EEBFF', opacity: 0.75 }),
      h('path', { d: 'M-40 9H42', stroke: NEON.mag, 'stroke-width': 4, opacity: 0.25 }), h('path', { d: 'M-40 9H42', stroke: NEON.magCore, 'stroke-width': 1.2 }),
      h('path', { d: 'M-30 -2H36', stroke: v('megaHi'), 'stroke-width': 0.8 }),
      h('circle', { cx: 45, cy: 1.5, r: 2.4, fill: '#FFFFFF' }), h('circle', { cx: -43, cy: 3, r: 2, fill: NEON.red }),
      // the lift thrusters glow through the chassis skirt (drawn over the hull's lower edge)
      h('path', { ...(dd ? DD('sky:O:hover-car-thrusters') : {}), d: circ(-24, 11, 7) + circ(26, 11, 7), fill: thr }));
    clouds += h('g', { 'data-ref': 'sky-car', transform: 'translate(330 238)' }, h('g', { transform: 'scale(-0.8 0.8)' }, car(true, '#221A3C')));
    clouds += h('g', { 'data-ref': 'sky-cop', transform: 'translate(-600 150)', visibility: 'hidden' }, h('g', { transform: 'scale(0.62)' },
      car(false, '#1A1E30'),
      h('path', { d: rect(-10, -24, 22, 4), fill: '#0A0816' }),
      h('path', { 'data-ref': 'sky-copR', ...DD('sky:O:police-spinner'), d: rect(-9, -23.5, 9, 3), fill: NEON.red }),
      h('path', { 'data-ref': 'sky-copB', d: rect(1, -23.5, 9, 3), fill: '#3A7BFF' }),
      T('police', 0, 4, 9, { fill: NEON.white }, 'middle')));
  }
  // ---- satellite + orbital-lift capsule strips live in their own layers (L-stars / L-sunmoon), see above and below
  const capsule = h('g', { 'data-ref': 'sky-cap', transform: 'translate(0 0)' },
    h('path', { ...DD('sky:O:lift-capsule'), d: rrect(90, 150, 12, 16, 3), fill: v('megaHi'), stroke: NEON.cyan, 'stroke-width': 0.8 }),
    h('path', { d: rect(92.5, 154, 7, 3), fill: NEON.amberCore }), h('circle', { cx: 96, cy: 170, r: 4, fill: NEON.cyan, opacity: 0.25 }));
  // ---- lightning + sky flash + storm deck (isolated: shown only in the storms)
  {
    const R = rng(371); const bolts = [];
    // each bolt forks down out of the storm deck and strikes a far-tower mast (converging on its tip)
    for (const [x0, tx, ty] of [[470, 421, 262], [1150, 1273, 226], [1500, 1537, 128]]) {
      let x = x0, y = -60, d = `M${x} ${y}`, br = '', glow = '';
      const n = 12;
      for (let k = 1; k <= n; k++) {
        const u = k / n, jit = (1 - u) * 34;
        x = x0 + (tx - x0) * u + (R() - 0.5) * jit; y = -60 + (ty + 60) * u;
        if (k === n) { x = tx; y = ty; }
        d += `L${f(x)} ${f(y)}`;
        if (k > 2 && k < n - 2 && R() < 0.35) { let bx = x, by = y, bd = `M${f(bx)} ${f(by)}`; const sg = R() < 0.5 ? -1 : 1; for (let q = 0; q < 4; q++) { bx += sg * (8 + R() * 18); by += 10 + R() * 16; bd += `L${f(bx)} ${f(by)}`; } br += bd; }
      }
      bolts.push([d, br, tx, ty]);
    }
    clouds += h('g', { 'data-ref': 'sky-storm', opacity: 0, visibility: 'hidden' },
      h('rect', { ...DD('sky:O:storm-deck'), x: X0, y: -420, width: W, height: 840, fill: lg('sky-deck', 0, -420, 0, 420, [[0, v('smog0'), 0.95], [0.72, v('smog0'), 0.6], [1, v('smog0'), 0]]) }));
    const flashG = rg('sky-flG', [[0, '#E4D4FF', 0.6], [0.4, NEON.violet, 0.25], [1, NEON.violet, 0]]);
    clouds += h('g', { 'data-ref': 'sky-flash', visibility: 'hidden' },
      h('rect', { 'data-ref': 'sky-flashR', x: X0, y: -420, width: W, height: 900, fill: lg('sky-fl', 0, -420, 0, 480, [[0, '#C8B8FF', 0.1], [1, '#E4D4FF', 0.32]]) }),
      bolts.map(([d, br, tx, ty], i) => h('g', { 'data-ref': 'sky-bolt' + i, visibility: 'hidden' },
        h('ellipse', { cx: tx, cy: -20, rx: 260, ry: 120, fill: flashG }),
        h('circle', { cx: tx, cy: ty, r: 26, fill: flashG }),
        h('path', { ...(i === 0 ? DD('sky:O:lightning') : {}), d: d + br, fill: 'none', stroke: NEON.violet, 'stroke-width': 8, opacity: 0.28, 'stroke-linejoin': 'round' }),
        h('path', { d: d + br, fill: 'none', stroke: '#E4D4FF', 'stroke-width': 3, opacity: 0.5, 'stroke-linejoin': 'round' }),
        h('path', { d, fill: 'none', stroke: '#FFFFFF', 'stroke-width': 1.8, 'stroke-linejoin': 'round' }),
        h('path', { d: br, fill: 'none', stroke: '#FFFFFF', 'stroke-width': 0.9, 'stroke-linejoin': 'round' }))));
  }

  defs += h('clipPath', { id: 'sky-hzClip', clipPathUnits: 'userSpaceOnUse' }, h('rect', { x: X0 - 600, y: -1400, width: W + 1200, height: 1400 + HZ + 16 }));
  defs += h('clipPath', { id: 'sky-hzClip0', clipPathUnits: 'userSpaceOnUse' }, h('rect', { x: X0 - 600, y: -1400, width: W + 1200, height: 1400 + HZ }));
  return {
    defs,
    layers: {
      // everything static and far lives on the opaque L-sky sheet (one composited layer, repainted only by the slow
      // searchlight sweep, the star twinkle and the warning-light blink); L-stars / L-sunmoon only carry two tiny strips
      // (clipped just below the horizon: the opaque harbour water, drawn by sea at the end of L-sky, covers the rest,
      // so the sheet keeps no tiles of hidden art below the waterline)
      'L-sky': h('g', { 'clip-path': 'url(#sky-hzClip)' }, sky + starsL + sunmoon),
      // the searchlights (an isolated sheet) come right after the sky + the water sea draws at the end of L-sky (same
      // camera transform: L-stars has depth 0 too), so sky and water share one sheet; their feet stop at the horizon
      // (fix) the arcology strip sits in L-stars: it slides (slow parallax) in front of the static far skyline. The
      // open-sky lights (lantern drones, the toll gate) stay ahead of it in the static part of the sheet (perf: no extra
      // sheet between the strip and the beams; they are placed clear of the arcology's hero position)
      'L-stars': h('g', { 'clip-path': 'url(#sky-hzClip0)' }, openSky + arcL + beamsM) + satL,
      'L-sunmoon': capsule,
      'L-clouds': clouds,
    },
  };
}

// ---------------------------------------------------------------------------------------------- attach
// composited strips (core/sheets.js): smog banks, traffic lanes, the blimp, the hover car, the police spinner, the
// satellite train and the lift capsule move by a pure translate every frame (compositor moves, no repaint); the beams
// (slow rotation) and the storm flash get sheets of their own so their repaint never touches the bloomed arcology.
export const sheets = [
  '[data-ref="sky-smog0"]', '[data-ref="sky-smog1"]', '[data-ref="sky-lane0"]', '[data-ref="sky-lane1"]',
  '[data-ref="sky-arc"]', '[data-ref="sky-ship"]', '[data-ref="sky-car"]', '[data-ref="sky-cop"]', '[data-ref="sky-sat"]', '[data-ref="sky-cap"]',
];
export const isolate = ['[data-ref="sky-beams"]', '[data-ref="sky-flash"]'];
export function attach(svg, ctx) {
  const r = refs(svg, 'sky-');
  const st = {};
  const set = (el, k, val, key) => { if (el && st[key] !== val) { st[key] = val; el.setAttribute(k, val); } };
  const vis = (el, on, key) => set(el, 'visibility', on ? 'visible' : 'hidden', key);
  const smog = [r.smog0, r.smog1], lanes = [r.lane0, r.lane1];
  const beams = BEAMS.map((_, i) => r['beam' + i]);
  const ads = [0, 1, 2, 3, 4, 5, 6].map(i => r['ad' + i]);
  const bolts = [0, 1, 2].map(i => r['bolt' + i]);
  const D0 = 3.2 * DIST_PER_REV_;   // the hero frame's road distance (t = 3.2 s at 60 rpm)
  const ARC_R = ARC_P / LAP;         // arcology parallax: screen px per unit of road
  // scheduled flyover: the cycle containing the hero frame is always on; others are seeded on/off
  const flyOn = (el, u, u0, span, seed, p, key) => { const c = Math.floor(u / span), on = c === Math.floor(u0 / span) || hash(c, seed) < p; vis(el, on, key); return on; };
  return {
    update(fr) {
      const t = fr.t, reduced = fr.reduced || ctx.reduced, D = fr.distance || 0;
      const num = (fr.pal && fr.pal.num) || {}, wx = fr.weather || {};
      const tm = reduced ? 3.2 : t;          // reduced motion: the traffic and the sweep hold still
      // sun / moon
      const sun = fr.sun, moon = fr.moon;
      set(r.sun, 'transform', `translate(${f(sun.x)} ${f(sun.y)})`, 'sun');
      vis(r.sun, sun.elev > -0.22, 'sunV');
      set(r.moon, 'transform', `translate(${f(moon.x)} ${f(moon.y)})`, 'moon');
      vis(r.moon, moon.elev > 0 && (num.night ?? fr.night) > 0.3, 'moonV');
      // stars: rare; twinkle stepped at 8 Hz
      const sa = num.starAlpha ?? 0;
      vis(r.stars, sa > 0.02, 'starV'); vis(r.sat, sa > 0.02, 'satV');
      if (sa > 0.02) {
        // perf (lighting pass): each twinkle write repaints the whole L-sky sheet (the stars span it), so the three
        // groups take turns at 3 Hz (3 repaints a second instead of 24) on 5 brightness steps
        const k = Math.floor(t * 3);
        for (let g = 0; g < 3; g++) { const tt = (k - (((k - g) % 3) + 3) % 3) / 3;   // this group's last turn (deterministic)
          set(r['tw' + g], 'opacity', (reduced ? 0.8 : 0.25 + 0.75 * Math.round(4 * (0.5 + 0.5 * Math.sin(tt * (1.7 + g * 0.6) + g * 2.1)) ** 2) / 4).toFixed(2), 'tw' + g); }
        const sx = wrap(950 + 700 + tm * 7, SAT_SPAN) - 700;
        r.sat.setAttribute('transform', `translate(${f(sx)} ${f(96 + (sx - 950) * 0.04)})`);
      }
      // the arcology: slow parallax, one cycle per lap (a pure translate on its own strip)
      set(r.arc, 'transform', `translate(${f(wrap(ARC_HERO - (D - D0) * ARC_R - ARC_XS, ARC_P) + ARC_XS - ARC_HERO)} 0)`, 'arc');
      // city moods: deep-night window fill, the dawn smog sea, the acid-rain haze (visibility flips only at thresholds)
      vis(r.arcNight, (num.winx ?? 0) > 0.02, 'winxA'); vis(r.farNight, (num.winx ?? 0) > 0.02, 'winxF');
      vis(r.dawn, (num.dawn ?? 0) > 0.02, 'dawnV'); vis(r.acid, (num.acid ?? 0) > 0.02, 'acidV');
      // warning lights: slow 1 Hz blink (two phases), opacity only
      const blink = Math.floor(t * 1.1) % 2;
      set(r.arcRed, 'opacity', reduced ? '1' : blink ? '1' : '0.25', 'arcRed');
      set(r.farRed, 'opacity', reduced ? '1' : blink ? '0.3' : '1', 'farRed');
      // lift capsule climbs the tether (6 px/s)
      r.cap.setAttribute('transform', `translate(0 ${f(160 - wrap(tm * 6 + 20, 600))})`);
      // searchlights: slow sweep (periods 45–70 s), stepped at 8 Hz, hidden when the mood has none
      const sOn = (num.search ?? 1) > 0.02;
      vis(r.beams, sOn, 'beamsV');
      if (sOn) {
        const tq = Math.floor(tm * 8) / 8;
        for (let i = 0; i < beams.length; i++) {
          const [x, a0, amp, w, ph] = BEAMS[i];
          set(beams[i], 'transform', `translate(${x} 486) rotate(${f(a0 + amp * Math.sin(tq * w + ph))})`, 'b' + i);
        }
      }
      // smog: two periodic strips, parallax + a slow drift, aligned so the hero frame shows the composed layout
      for (let k = 0; k < 2; k++) {
        const [P, p, dr] = SMOG[k];
        smog[k].setAttribute('transform', `translate(${f(-wrap(D * p + t * dr - (D0 * p + 3.2 * dr), P))} 0)`);
      }
      // traffic: two calm streams (left / right) + a hair of parallax
      for (let g = 0; g < 2; g++) lanes[g].setAttribute('transform', `translate(${f(wrap((tm - 3.2) * LANE_V[g] - (D - D0) * 0.01, W) - W)} 0)`);
      // blimp: drifts +x at 7 px/s, seeded passes; hologram ad rotates every 9 s with a brief glitch
      const SH0 = 1300 + 500 - 3.2 * 7 + D0 * 0.012, bu = SH0 + t * 7 - D * 0.012, bx = wrap(bu, SHIP_SPAN) - 500, bu0 = SH0 + 3.2 * 7 - D0 * 0.012;
      if (flyOn(r.ship, bu, bu0, SHIP_SPAN, 91, 0.55, 'shipV')) {
        const c = Math.floor(bu / SHIP_SPAN), dy = c === Math.floor(bu0 / SHIP_SPAN) ? 0 : (hash(c, 92) - 0.5) * 50;
        r.ship.setAttribute('transform', `translate(${f(bx)} ${f(204 + dy + 3 * Math.sin((t - 3.2) * 0.35))})`);
        const pq = Math.floor(t * 15) / 15;
        set(r.prop0, 'transform', `translate(-62 30) scale(1 ${Math.cos(pq * 9).toFixed(2)}) translate(62 -30)`, 'p0');
        set(r.prop1, 'transform', `translate(38 30) scale(1 ${Math.cos(pq * 9 + 1).toFixed(2)}) translate(-38 -30)`, 'p1');
        set(r.strobe, 'opacity', wrap(t, 1.6) < 0.12 ? '1' : '0', 'strobe');
        const st = stretchAt(D), slot = wrap(Math.floor(t / 9), 3), ph = wrap(t, 9);
        const ai = [0, DISTRICT_AD[st.key] ?? 3, 1 + (st.i % 2)][slot];
        for (let i = 0; i < ads.length; i++) vis(ads[i], i === ai, 'ad' + i);
        const gl = !reduced && ph < 0.3;
        set(r.ads, 'transform', gl ? `translate(${(Math.floor(t * 30) % 3 - 1) * 3} 0)` : '', 'adsT');
        set(r.ads, 'opacity', gl ? (Math.floor(t * 30) % 2 ? '0.45' : '0.9') : '1', 'adsO');
      }
      // hover car: a close pass right → left every ~70 s (screen 60 px/s)
      const cu = 330 + 600 - t * 60 + 3.2 * 60, cx = wrap(cu, CAR_SPAN) - 600;
      if (flyOn(r.car, cu, 330 + 600, CAR_SPAN, 95, 0.6, 'carV')) r.car.setAttribute('transform', `translate(${f(cx)} ${f(238 + 2 * Math.sin(t * 0.8))})`);
      // police spinner: rare, faster, left → right, light bar alternating at 3 Hz
      const pu = t * 110, px = wrap(pu, COP_SPAN) - 600, pc = Math.floor(pu / COP_SPAN);
      const copOn = pc > 0 && hash(pc, 97) < 0.4;
      vis(r.cop, copOn, 'copV');
      if (copOn) {
        r.cop.setAttribute('transform', `translate(${f(px)} ${f(140 + hash(pc, 98) * 90)})`);
        const k = Math.floor(t * 6) % 2;
        set(r.copR, 'opacity', k ? '1' : '0.2', 'cR'); set(r.copB, 'opacity', k ? '0.2' : '1', 'cB');
      }
      // storm: the smog deck follows the overcast; lightning only in the heavy rain / storms
      const cl = Math.max(wx.cloud || 0, (wx.rain || 0) * 1.1);
      // (perf: the deck is a full-width sheet, so it stays out until the overcast really builds: none in the gusty
      // spells at cloud 0.3, rolling in ahead of the downpour)
      const deck = Math.round(clamp((cl - 0.4) / 0.6, 0, 1) * 20) / 20 * 0.8;
      set(r.storm, 'opacity', deck.toFixed(2), 'deck'); vis(r.storm, deck > 0.01, 'deckV');
      let fl = 0, bi = -1;
      if (cl > 0.55) {
        const P = 2.6, n = Math.floor(t / P), u = t - n * P;
        if (hash(n, 81) < 0.32 && u < 0.36) { fl = u < 0.08 ? 1 : u < 0.14 ? 0.25 : u < 0.22 ? 0.8 : Math.max(0, 1 - (u - 0.22) / 0.14) * 0.5; bi = Math.floor(hash(n, 82) * 3); }
      }
      vis(r.flash, fl > 0, 'flV');
      if (fl > 0) {
        set(r.flashR, 'opacity', reduced ? '0' : (fl * 0.9).toFixed(2), 'flO');
        for (let i = 0; i < 3; i++) vis(bolts[i], i === bi, 'bolt' + i);
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------- lettering (generated)
const GLY = {"pelicorp":[551.2,"M9-73L40-73Q54-73 62-67Q69-61 69-49Q69-38 62-31Q54-25 40-25L28-25L28 0L9 0ZM28-59L28-39L38-39Q44-39 47-42Q50-44 50-49Q50-54 47-57Q44-59 38-59ZM82-73L133-73L133-59L101-59L101-45L131-45L131-31L101-31L101-14L134-14L134 0L82 0ZM151-73L170-73L170-14L203-14L203 0L151 0ZM215-73L233-73L233 0L215 0ZM310-4Q304-1 299 0Q293 1 287 1Q269 1 258-9Q248-19 248-36Q248-54 258-64Q269-74 287-74Q293-74 299-73Q304-71 310-69L310-54Q304-57 299-59Q294-61 289-61Q278-61 273-54Q267-48 267-36Q267-25 273-19Q278-12 289-12Q294-12 299-14Q304-16 310-19ZM358-61Q350-61 345-54Q340-48 340-36Q340-25 345-19Q350-12 358-12Q367-12 372-19Q377-25 377-36Q377-48 372-54Q367-61 358-61ZM358-74Q376-74 386-64Q396-54 396-36Q396-19 386-9Q376 1 358 1Q341 1 331-9Q321-19 321-36Q321-54 331-64Q341-74 358-74ZM437-41Q443-41 445-43Q448-45 448-50Q448-55 445-57Q443-59 437-59L429-59L429-41ZM429-28L429 0L410 0L410-73L439-73Q453-73 460-68Q467-63 467-53Q467-46 463-41Q460-36 453-34Q456-33 460-30Q463-27 466-21L476 0L456 0L447-18Q444-24 442-26Q439-28 434-28ZM487-73L518-73Q532-73 540-67Q547-61 547-49Q547-38 540-31Q532-25 518-25L506-25L506 0L487 0ZM506-59L506-39L516-39Q522-39 525-42Q528-44 528-49Q528-54 525-57Q522-59 516-59Z"],"jituan":[416,"M32 12Q28 12 25 12Q25 5 25-1L25-17Q19-6 6 5Q4 3 1 1Q7-4 11-10Q16-16 22-26L9-26L9-47L25-47L25-58L18-58Q13-58 9-57Q9-60 9-62Q13-62 18-62L28-62Q33-70 36-80Q40-79 43-78Q41-71 35-62L48-62L48-43L31-43L31-31L48-31L48-13Q48-10 45-7Q41-5 36-5Q37-10 34-13Q35-13 37-13Q41-12 41-13Q42-13 42-14L42-26L31-26L31-1Q31 5 32 12ZM26-66L20-63L10-78L17-82ZM25-31L25-43L15-43Q15-37 16-31ZM31-47L41-47L41-58L33-58L32-57Q32-58 31-58ZM86-13Q85-10 86-7Q81-8 77-8L64-8Q60-8 56-7Q56-10 56-13Q60-12 64-12L77-12Q81-12 86-13ZM80-51L75-46L68-57L73-61ZM78-33Q79-38 77-41Q79-41 82-41Q85-41 85-41Q86-42 86-43L86-63L72-63L71-62Q71-63 70-63Q69-63 66-63L66-29L96-29L96 4Q96 8 94 11Q90 14 82 14Q83 9 80 6Q83 6 86 6Q90 6 90 5Q91 5 91 3L91-25L61-25L61-68Q65-68 68-68Q72-72 73-78Q76-77 79-76Q78-71 76-68L91-68L91-42Q91-39 89-37Q86-33 78-33ZM153-26L143-26Q144-11 139-2Q134 7 126 12Q125 9 121 7Q137 0 137-22L137-74L160-74L160 1Q160 8 156 10Q152 13 145 12Q146 8 143 5Q145 5 148 5Q151 5 152 4Q153 3 153-3ZM116-2L109-2L109-38Q113-38 117-38L117-54L106-53Q106-56 106-58L117-58L117-69Q117-76 117-82Q120-82 124-82Q123-76 123-69L123-58L136-58Q136-56 136-53L123-54L123-38L132-38L132-2L125-2L125-10L116-10ZM153-52L153-70L143-70L143-52ZM153-30L153-49L143-49L143-30ZM125-34L116-34L116-14L125-14ZM191-13Q190-10 191-7Q187-8 183-8L170-8Q167-8 163-7Q163-10 163-13Q167-12 170-12L183-12Q187-12 191-13ZM185-51L181-46L175-57L179-61ZM184-33Q184-38 182-41Q184-41 187-41Q190-41 190-41Q191-42 191-43L191-63L178-63L177-62Q177-63 176-63Q175-63 172-63L172-29L201-29L201 4Q201 8 198 11Q195 14 187 14Q188 9 185 6Q188 6 191 6Q194 6 195 5Q195 5 195 3L195-25L167-25L167-68Q171-68 175-68Q178-72 179-78Q182-77 185-76Q183-71 182-68L196-68L196-42Q196-39 194-37Q191-33 184-33ZM261-1Q261 5 261 12Q258 12 254 12Q254 5 254-1L254-9Q250-5 245-2Q231 8 215 10Q215 6 212 3Q219 2 228-1Q236-3 242-8Q246-11 249-13L222-13Q218-13 214-13Q214-15 214-18Q218-17 222-17L254-17Q254-18 254-17L254-17Q254-22 254-26L233-26Q233-24 233-21Q229-21 226-21Q226-28 226-34L226-54Q221-48 215-42Q213-45 210-46Q219-54 226-64L226-66L227-66L230-70L237-81Q239-79 243-77Q240-72 236-66L259-66L250-76L256-80L266-69L262-66L283-66Q287-66 292-66Q292-64 292-61Q287-61 283-61L263-61L263-54L281-54Q285-54 289-54Q289-52 289-50Q285-50 281-50L263-50L263-41L281-41Q286-41 290-41Q290-39 290-37Q286-37 281-37L263-37L263-30L284-30Q289-30 293-30Q293-28 293-26Q289-26 284-26L261-26Q261-22 261-17L296-17Q300-17 304-18Q304-15 304-13Q300-13 296-13L266-13Q273-7 279-4Q288 1 302 4Q299 6 299 10Q283 7 267-6Q264-8 261-10ZM257-30L257-37L233-37L233-30ZM257-41L257-50L240-50Q236-50 233-50L233-41ZM257-54L257-61L233-61Q233-58 233-54Q236-54 240-54ZM342-50Q337-50 331-50Q331-53 331-56Q337-55 342-55L368-55Q368-62 367-68Q371-68 375-68Q375-62 375-55L379-55Q385-55 390-56Q390-53 390-50Q385-50 379-50L375-50L375-12Q375-4 366-1L394-1L394-72L328-72L328-1L357-1Q357-6 354-9Q357-9 362-9Q366-9 367-10Q368-11 368-15L368-41Q353-22 335-14Q333-18 330-21Q348-28 357-39Q361-43 365-50ZM328 12Q324 12 321 12Q321 5 321-2L321-77L401-77L401 12L394 12L394 4L328 4Q328 8 328 12Z"],"arco":[1050.9,"M30-60L23-30L37-30ZM21-73L39-73L59 0L44 0L40-18L20-18L16 0L2 0ZM100-34Q102-34 103-32Q105-31 107-26L120 0L105 0L96-18Q95-19 95-21Q91-29 86-29L81-29L81 0L67 0L67-73L88-73Q102-73 108-68Q114-63 114-52Q114-44 110-40Q106-35 100-34ZM81-61L81-41L88-41Q94-41 96-43Q99-46 99-51Q99-56 96-58Q94-61 88-61ZM173-2Q170 0 166 1Q162 1 158 1Q143 1 136-8Q128-18 128-36Q128-55 136-64Q143-74 158-74Q162-74 166-73Q170-72 173-71L173-55Q169-58 166-60Q163-61 159-61Q151-61 147-55Q143-49 143-36Q143-24 147-18Q151-12 159-12Q163-12 166-13Q169-15 173-18ZM211-61Q205-61 203-55Q200-50 200-36Q200-23 203-17Q205-12 211-12Q216-12 219-17Q221-23 221-36Q221-50 219-55Q216-61 211-61ZM185-36Q185-55 192-65Q198-74 211-74Q223-74 230-65Q236-55 236-36Q236-18 230-8Q223 1 211 1Q198 1 192-8Q185-18 185-36ZM252 0L252-73L266-73L266-13L297-13L297 0ZM331-61Q326-61 323-55Q321-50 321-36Q321-23 323-17Q326-12 331-12Q337-12 339-17Q342-23 342-36Q342-50 339-55Q337-61 331-61ZM306-36Q306-55 312-65Q318-74 331-74Q344-74 350-65Q357-55 357-36Q357-18 350-8Q344 1 331 1Q318 1 312-8Q306-18 306-36ZM404-13L404-27L394-27L394-39L416-39L416-6Q412-2 407 0Q402 1 397 1Q382 1 375-8Q367-18 367-36Q367-55 375-64Q383-74 397-74Q402-74 406-73Q410-72 414-69L414-53Q411-57 407-59Q403-61 398-61Q390-61 386-55Q382-49 382-36Q382-24 386-18Q390-12 397-12Q399-12 401-12Q403-12 404-13ZM422-73L437-73L452-44L466-73L481-73L459-29L459 0L444 0L444-29ZM496-36L527-36L527-22L496-22ZM566-36Q566-39 568-41Q569-42 572-42Q575-42 576-41Q578-39 578-36Q578-34 576-32Q575-30 572-30Q569-30 568-32Q566-34 566-36ZM572-62Q567-62 565-56Q562-50 562-36Q562-23 565-17Q567-11 572-11Q577-11 579-17Q582-23 582-36Q582-50 579-56Q577-62 572-62ZM548-36Q548-55 554-65Q560-74 572-74Q584-74 590-65Q596-55 596-36Q596-17 590-8Q584 1 572 1Q560 1 554-8Q548-17 548-36ZM611-13L627-13L627-60L612-56L612-69L627-73L641-73L641-13L657-13L657 0L611 0ZM744-44L761-44L761-26L744-26ZM863-41Q857-41 851-40Q851-44 851-47Q857-47 863-47L888-47L888-71L872-71Q865-71 859-71Q859-75 859-78Q865-78 872-78L913-78Q920-78 926-78Q926-75 926-71Q920-71 913-71L895-71L895-47L922-47Q928-47 935-47Q934-44 935-40Q928-41 922-41L896-41Q901-24 909-14Q920-1 938 3Q935 6 934 10Q920 7 909-4Q899-14 893-29Q889-16 878-5Q868 6 853 11Q851 6 847 4Q864 1 875-12Q886-25 888-41ZM973-34L1016-34L1016-45L980-45Q975-45 970-44Q970-47 970-50Q975-50 980-50L1023-50L1023-29L975-29L973-21L1028-21L1020 5Q1018 9 1014 11Q1010 13 1006 13Q1003 13 1001 13L996 13Q996 11 995 9Q994 7 993 5Q997 6 1000 5Q1011 5 1012 4Q1013 4 1013 2L1019-15L965-15L969-32L969-34L970-34L970-35ZM1034-49L1029-43L1015-51Q1008-55 1001-59L1005-65Q1012-61 1019-57ZM984-65Q987-62 990-60Q980-51 967-45Q963-42 958-40Q957-43 954-45Q966-50 976-58ZM964-57L957-57L957-71L995-71L986-79L992-84L1002-74L998-71L1041-71L1041-57L1034-57L1034-66L964-66Z"],"tian":[104,"M20-41Q14-41 8-40Q8-44 8-47Q14-47 20-47L45-47L45-71L29-71Q22-71 16-71Q17-75 16-78Q22-78 29-78L71-78Q77-78 83-78Q83-75 83-71Q77-71 71-71L52-71L52-47L79-47Q86-47 92-47Q92-44 92-40Q86-41 79-41L53-41Q58-24 66-14Q77-1 96 3Q92 6 91 10Q77 7 67-4Q56-14 50-29Q46-16 36-5Q25 6 10 11Q9 6 4 4Q21 1 32-12Q43-25 45-41Z"],"qiong":[104,"M26-34L69-34L69-45L34-45Q28-45 23-44Q23-47 23-50Q28-50 34-50L76-50L76-29L29-29L26-21L81-21L73 5Q71 9 67 11Q63 13 60 13Q56 13 54 13L49 13Q49 11 48 9Q48 7 46 5Q50 6 53 5Q64 5 65 4Q66 4 67 2L72-15L18-15L22-32L22-34L23-34L23-35ZM87-49L83-43L69-51Q62-55 54-59L58-65Q65-61 72-57ZM38-65Q40-62 43-60Q33-51 20-45Q16-42 11-40Q10-43 7-45Q19-50 29-58ZM17-57L10-57L10-71L48-71L40-79L45-84L55-74L52-71L94-71L94-57L87-57L87-66L17-66Z"],"ta":[104,"M49 12Q45 12 42 12Q42 5 42-1L42-20L83-20L83 12L77 12L77 5L49 5Q49 9 49 12ZM79-33Q79-31 79-28Q74-28 70-28L55-28Q50-28 46-28Q46-30 46-32Q41-27 35-23Q33-26 30-27Q39-34 45-41Q52-49 59-60Q61-58 63-57Q64-58 64-57Q65-57 66-56L65-55Q71-46 78-41Q85-36 96-33Q93-31 92-27Q84-29 75-35Q67-41 61-50Q55-41 47-33Q51-33 55-33L70-33Q74-33 79-33ZM76-55Q73-55 69-55Q69-60 69-65L54-65Q54-60 54-55Q50-55 47-55Q47-60 47-65L41-65Q37-65 32-65Q32-67 32-70Q37-70 41-70L47-70Q47-76 47-82Q50-82 54-82Q54-76 54-70L69-70Q69-76 69-82Q73-82 76-82Q76-76 76-70L86-70Q91-70 95-70Q95-67 95-65Q91-65 86-65L76-65Q76-60 76-55ZM77-15L48-15L48 1L77 1ZM-1-10Q8-12 16-15L16-50L11-50Q6-50 1-50Q1-52 1-55Q6-55 11-55L16-55L16-67Q16-73 16-80Q19-80 23-80Q23-73 23-67L23-55L36-55Q36-52 36-50L23-50L23-18L34-24L35-20Q20-12 13-8L3-2Q2-7-1-10Z"],"hull":[677,"M32 12Q28 12 25 12Q25 5 25-1L25-17Q19-6 6 5Q4 3 1 1Q7-4 11-10Q16-16 22-26L9-26L9-47L25-47L25-58L18-58Q13-58 9-57Q9-60 9-62Q13-62 18-62L28-62Q33-70 36-80Q40-79 43-78Q41-71 35-62L48-62L48-43L31-43L31-31L48-31L48-13Q48-10 45-7Q41-5 36-5Q37-10 34-13Q35-13 37-13Q41-12 41-13Q42-13 42-14L42-26L31-26L31-1Q31 5 32 12ZM26-66L20-63L10-78L17-82ZM25-31L25-43L15-43Q15-37 16-31ZM31-47L41-47L41-58L33-58L32-57Q32-58 31-58ZM86-13Q85-10 86-7Q81-8 77-8L64-8Q60-8 56-7Q56-10 56-13Q60-12 64-12L77-12Q81-12 86-13ZM80-51L75-46L68-57L73-61ZM78-33Q79-38 77-41Q79-41 82-41Q85-41 85-41Q86-42 86-43L86-63L72-63L71-62Q71-63 70-63Q69-63 66-63L66-29L96-29L96 4Q96 8 94 11Q90 14 82 14Q83 9 80 6Q83 6 86 6Q90 6 90 5Q91 5 91 3L91-25L61-25L61-68Q65-68 68-68Q72-72 73-78Q76-77 79-76Q78-71 76-68L91-68L91-42Q91-39 89-37Q86-33 78-33ZM153-26L143-26Q144-11 139-2Q134 7 126 12Q125 9 121 7Q137 0 137-22L137-74L160-74L160 1Q160 8 156 10Q152 13 145 12Q146 8 143 5Q145 5 148 5Q151 5 152 4Q153 3 153-3ZM116-2L109-2L109-38Q113-38 117-38L117-54L106-53Q106-56 106-58L117-58L117-69Q117-76 117-82Q120-82 124-82Q123-76 123-69L123-58L136-58Q136-56 136-53L123-54L123-38L132-38L132-2L125-2L125-10L116-10ZM153-52L153-70L143-70L143-52ZM153-30L153-49L143-49L143-30ZM125-34L116-34L116-14L125-14ZM191-13Q190-10 191-7Q187-8 183-8L170-8Q167-8 163-7Q163-10 163-13Q167-12 170-12L183-12Q187-12 191-13ZM185-51L181-46L175-57L179-61ZM184-33Q184-38 182-41Q184-41 187-41Q190-41 190-41Q191-42 191-43L191-63L178-63L177-62Q177-63 176-63Q175-63 172-63L172-29L201-29L201 4Q201 8 198 11Q195 14 187 14Q188 9 185 6Q188 6 191 6Q194 6 195 5Q195 5 195 3L195-25L167-25L167-68Q171-68 175-68Q178-72 179-78Q182-77 185-76Q183-71 182-68L196-68L196-42Q196-39 194-37Q191-33 184-33ZM285-36L254-36Q250-36 245-35Q246-38 245-40Q250-40 254-40L292-40L292-24L254-23L251-16L297-16L292 5Q290 13 271 13Q272 10 271 8Q270 6 269 5Q272 5 278 5Q284 4 285 4Q285 3 286 2L289-11L243-11L248-26L248-27L248-27L249-29L252-27L285-28ZM299-43Q292-53 282-60L286-66Q297-58 305-47ZM247-62Q250-60 254-59Q251-51 245-40L241-34Q238-37 235-37Q240-44 244-53ZM281-43Q277-43 274-43Q274-49 274-56L274-68L265-68L265-57Q265-50 266-43Q262-44 258-43Q259-50 259-57L259-68L247-68Q242-68 237-68Q238-70 237-73Q242-72 247-72L269-72L259-79L263-85L276-77L273-72L295-72Q300-72 304-73Q304-70 304-68Q300-68 295-68L281-68L281-56Q281-49 281-43ZM219 12Q216 9 212 9Q215 1 218-9Q222-19 228-44L231-42L223-5ZM225-45L220-40L209-53L214-58ZM226-61Q221-69 215-75L220-80Q226-73 231-65ZM356-73L387-73Q401-73 409-67Q416-61 416-49Q416-38 409-31Q401-25 387-25L375-25L375 0L356 0ZM375-59L375-39L385-39Q391-39 394-42Q397-44 397-49Q397-54 394-57Q391-59 385-59ZM458-45Q463-45 465-47Q468-49 468-52Q468-56 465-58Q463-60 458-60L448-60L448-45ZM459-13Q465-13 468-15Q471-18 471-22Q471-27 468-30Q465-32 459-32L448-32L448-13ZM477-39Q483-37 486-33Q489-28 489-21Q489-10 482-5Q475 0 460 0L429 0L429-73L458-73Q473-73 480-68Q486-64 486-54Q486-48 484-45Q481-41 477-39ZM502-36L532-36L532-22L502-22ZM584-37Q584-50 581-56Q579-61 573-61Q567-61 564-56Q561-50 561-37Q561-23 564-17Q567-11 573-11Q579-11 581-17Q584-23 584-37ZM603-36Q603-18 595-8Q587 1 573 1Q558 1 550-8Q543-18 543-36Q543-55 550-64Q558-74 573-74Q587-74 595-64Q603-55 603-36ZM614-73L669-73L669-62L641 0L622 0L649-59L614-59Z"],"a1a":[416,"M32 12Q28 12 25 12Q25 5 25-1L25-17Q19-6 6 5Q4 3 1 1Q7-4 11-10Q16-16 22-26L9-26L9-47L25-47L25-58L18-58Q13-58 9-57Q9-60 9-62Q13-62 18-62L28-62Q33-70 36-80Q40-79 43-78Q41-71 35-62L48-62L48-43L31-43L31-31L48-31L48-13Q48-10 45-7Q41-5 36-5Q37-10 34-13Q35-13 37-13Q41-12 41-13Q42-13 42-14L42-26L31-26L31-1Q31 5 32 12ZM26-66L20-63L10-78L17-82ZM25-31L25-43L15-43Q15-37 16-31ZM31-47L41-47L41-58L33-58L32-57Q32-58 31-58ZM86-13Q85-10 86-7Q81-8 77-8L64-8Q60-8 56-7Q56-10 56-13Q60-12 64-12L77-12Q81-12 86-13ZM80-51L75-46L68-57L73-61ZM78-33Q79-38 77-41Q79-41 82-41Q85-41 85-41Q86-42 86-43L86-63L72-63L71-62Q71-63 70-63Q69-63 66-63L66-29L96-29L96 4Q96 8 94 11Q90 14 82 14Q83 9 80 6Q83 6 86 6Q90 6 90 5Q91 5 91 3L91-25L61-25L61-68Q65-68 68-68Q72-72 73-78Q76-77 79-76Q78-71 76-68L91-68L91-42Q91-39 89-37Q86-33 78-33ZM153-26L143-26Q144-11 139-2Q134 7 126 12Q125 9 121 7Q137 0 137-22L137-74L160-74L160 1Q160 8 156 10Q152 13 145 12Q146 8 143 5Q145 5 148 5Q151 5 152 4Q153 3 153-3ZM116-2L109-2L109-38Q113-38 117-38L117-54L106-53Q106-56 106-58L117-58L117-69Q117-76 117-82Q120-82 124-82Q123-76 123-69L123-58L136-58Q136-56 136-53L123-54L123-38L132-38L132-2L125-2L125-10L116-10ZM153-52L153-70L143-70L143-52ZM153-30L153-49L143-49L143-30ZM125-34L116-34L116-14L125-14ZM191-13Q190-10 191-7Q187-8 183-8L170-8Q167-8 163-7Q163-10 163-13Q167-12 170-12L183-12Q187-12 191-13ZM185-51L181-46L175-57L179-61ZM184-33Q184-38 182-41Q184-41 187-41Q190-41 190-41Q191-42 191-43L191-63L178-63L177-62Q177-63 176-63Q175-63 172-63L172-29L201-29L201 4Q201 8 198 11Q195 14 187 14Q188 9 185 6Q188 6 191 6Q194 6 195 5Q195 5 195 3L195-25L167-25L167-68Q171-68 175-68Q178-72 179-78Q182-77 185-76Q183-71 182-68L196-68L196-42Q196-39 194-37Q191-33 184-33ZM279-3Q279 5 279 12Q275 12 271 12Q271 5 271-3L271-65Q271-72 271-80Q275-79 279-80Q279-72 279-65L279-51L292-41L306-29L301-23L287-35L279-41ZM234-80Q238-79 242-78Q240-69 236-60L263-60Q261-38 248-19Q236-1 217 10Q214 7 210 5Q232-6 245-27L241-24Q234-32 227-40Q222-31 216-24Q213-28 209-29Q224-45 229-60Q232-69 234-80ZM246-29Q253-41 255-54L234-54Q233-51 231-47Q239-39 246-29ZM401 7L397 13L381 3L364-6L368-13L385-3ZM364-49Q367-48 371-49Q371-42 371-35L371-26Q371-23 370-20L397-20Q403-20 408-20Q408-17 408-14Q403-14 397-14L368-14Q363-6 352 1Q338 10 322 13Q321 8 316 6Q334 5 349-5Q356-9 360-14L325-14Q320-14 315-14Q315-17 315-20Q320-20 325-20L363-20Q364-23 364-26L364-35Q364-42 364-49ZM348-27L343-21L331-33L336-38ZM331-54Q326-54 321-54Q321-57 321-59Q326-59 331-59L358-59L358-70L340-70Q335-70 329-69Q330-72 329-75Q335-75 340-75L358-75Q358-79 358-82Q361-82 365-82Q365-78 365-75L385-75Q390-75 395-75Q395-72 395-69Q390-70 385-70L365-70L365-59L403-59L404-53Q403-53 402-52L394-40L388-43L395-54L345-54Q351-46 357-38L351-34Q345-42 338-49L343-54Z"],"a1b":[1019.9,"M9-73L40-73Q54-73 62-67Q69-61 69-49Q69-38 62-31Q54-25 40-25L28-25L28 0L9 0ZM28-59L28-39L38-39Q44-39 47-42Q50-44 50-49Q50-54 47-57Q44-59 38-59ZM82-73L133-73L133-59L101-59L101-45L131-45L131-31L101-31L101-14L134-14L134 0L82 0ZM151-73L170-73L170-14L203-14L203 0L151 0ZM215-73L233-73L233 0L215 0ZM310-4Q304-1 299 0Q293 1 287 1Q269 1 258-9Q248-19 248-36Q248-54 258-64Q269-74 287-74Q293-74 299-73Q304-71 310-69L310-54Q304-57 299-59Q294-61 289-61Q278-61 273-54Q267-48 267-36Q267-25 273-19Q278-12 289-12Q294-12 299-14Q304-16 310-19ZM369-13L340-13L335 0L316 0L343-73L366-73L393 0L374 0ZM345-27L365-27L355-56ZM402-73L423-73L450-23L450-73L468-73L468 0L447 0L420-50L420 0L402 0ZM521-73L572-73L572-59L540-59L540-45L570-45L570-31L540-31L540-14L573-14L573 0L521 0ZM630-37L655 0L636 0L619-25L602 0L582 0L607-37L583-73L603-73L619-49L635-73L654-73ZM666-73L698-73Q712-73 719-67Q726-61 726-49Q726-38 719-31Q712-25 698-25L685-25L685 0L666 0ZM685-59L685-39L696-39Q701-39 704-42Q707-44 707-49Q707-54 704-57Q701-59 696-59ZM766-41Q772-41 775-43Q777-45 777-50Q777-55 775-57Q772-59 766-59L759-59L759-41ZM759-28L759 0L740 0L740-73L768-73Q783-73 790-68Q796-63 796-53Q796-46 793-41Q789-36 782-34Q786-33 789-30Q792-27 795-21L806 0L786 0L777-18Q774-24 771-26Q768-28 764-28ZM817-73L867-73L867-59L836-59L836-45L866-45L866-31L836-31L836-14L869-14L869 0L817 0ZM936-71L936-55Q930-58 924-59Q918-61 913-61Q906-61 903-59Q900-57 900-53Q900-50 902-48Q904-47 910-46L918-44Q930-42 935-37Q941-32 941-22Q941-10 933-4Q926 1 912 1Q905 1 898 0Q891-1 884-4L884-20Q891-16 897-14Q904-12 910-12Q916-12 919-14Q922-16 922-20Q922-24 920-25Q918-27 911-29L904-30Q893-33 888-38Q883-43 883-52Q883-62 890-68Q897-74 910-74Q916-74 923-73Q929-72 936-71ZM1008-71L1008-55Q1002-58 996-59Q990-61 985-61Q979-61 975-59Q972-57 972-53Q972-50 974-48Q976-47 982-46L990-44Q1002-42 1007-37Q1013-32 1013-22Q1013-10 1005-4Q998 1 984 1Q977 1 970 0Q963-1 956-4L956-20Q963-16 969-14Q976-12 982-12Q988-12 991-14Q994-16 994-20Q994-24 992-25Q990-27 983-29L976-30Q965-33 960-38Q955-43 955-52Q955-62 962-68Q969-74 982-74Q988-74 995-73Q1001-72 1008-71Z"],"a1c":[1559.9,"M27-33L19-33L19-45L27-45Q32-45 35-47Q38-50 38-53Q38-57 35-60Q32-62 27-62Q23-62 18-61Q13-60 8-58L8-71Q13-73 18-73Q23-74 28-74Q39-74 46-69Q52-64 52-55Q52-49 48-45Q45-41 38-39Q46-38 50-33Q54-28 54-20Q54-10 47-4Q40 1 27 1Q22 1 16 0Q11 0 6-2L6-16Q11-13 16-12Q21-11 27-11Q33-11 36-14Q40-16 40-21Q40-27 36-30Q33-33 27-33ZM84-36Q84-39 86-41Q88-42 90-42Q93-42 95-41Q96-39 96-36Q96-34 95-32Q93-30 90-30Q88-30 86-32Q84-34 84-36ZM90-62Q85-62 83-56Q81-50 81-36Q81-23 83-17Q85-11 90-11Q95-11 98-17Q100-23 100-36Q100-50 98-56Q95-62 90-62ZM66-36Q66-55 72-65Q78-74 90-74Q102-74 108-65Q114-55 114-36Q114-17 108-8Q102 1 90 1Q78 1 72-8Q66-17 66-36ZM153-34Q147-34 141-34Q141-37 141-40Q147-40 153-40L196-40L196 3Q196 7 193 9Q188 13 177 13Q178 8 174 4Q178 5 182 5Q187 5 188 4Q188 3 188 0L188-34L166-34Q165-18 157-5Q148 8 134 13Q131 8 126 6Q131 6 137 3Q143-1 148-6Q153-11 156-18Q159-26 158-34ZM217-39Q213-37 211-33Q196-41 188-54Q180-65 176-79L182-81Q188-59 203-47Q209-42 217-39ZM153-79Q157-77 162-77Q157-63 150-52Q141-39 128-30Q126-34 122-36Q133-43 141-53Q145-57 146-61Q151-69 153-79ZM300 12Q296 12 293 12Q293 5 293-2L293-24L279-24Q279-21 279-18Q275-19 271-18Q272-25 272-32L272-60L293-60L293-67Q293-74 293-81Q296-81 300-81Q300-74 300-67L300-60L318-60L318-20L311-20L311-24L300-24L300-2Q300 5 300 12ZM300-29L311-29L311-55L300-55ZM293-29L293-55L279-55L279-29ZM241-79Q245-78 249-77Q247-71 245-64L258-64Q263-64 267-64Q267-62 267-59Q263-60 258-60L244-60Q241-53 239-47L255-47Q260-47 265-48Q265-45 265-43Q260-43 255-43L250-43L250-30L258-30Q263-30 268-31Q268-28 268-26Q263-26 258-26L250-26L250-5L263-17L266-14Q265-12 263-11Q254-2 247 8L242 3Q243 1 243-2L243-26L238-26Q233-26 228-26Q228-28 228-31Q233-30 238-30L243-30L243-43L237-43Q235-37 232-32Q229-34 224-34Q227-40 231-47Q238-61 241-79ZM386 9Q363 9 351-3L335 8Q333 5 331 2L348-7L348-47L342-47Q337-47 332-47Q332-49 332-52Q337-52 342-52L355-52L355-7Q363-2 369 0Q374 1 386 1L422 2Q419 4 419 9ZM353-65L347-61L336-75L342-79ZM372-34Q367-34 362-34Q362-37 362-40Q367-39 372-39L383-39L383-54L373-54Q368-54 363-54Q363-57 363-59Q368-59 373-59L377-59Q373-68 368-76L374-80Q380-71 384-62L378-59L388-59Q395-69 400-81Q404-79 407-78Q404-69 397-59L404-59Q409-59 414-59Q414-57 414-54Q409-54 404-54L393-54Q393-54 393-54L390-54L390-39L408-39Q413-39 418-40Q418-37 418-34Q413-34 408-34L390-34Q390-31 389-28L391-30L403-20L415-8L410-3L398-14L387-24Q381-10 367-3Q366-7 362-9Q371-12 377-18Q382-25 383-34ZM489 10Q466 10 454-1L442 9Q440 6 438 3L452-6L452-37L446-37Q440-37 434-37Q434-40 434-43Q440-43 446-43L459-43L459-5Q467 0 472 1Q477 2 489 2L527 3Q523 5 523 10ZM458-60Q452-68 445-75L450-81Q457-73 464-65ZM489-44L489-51L475-51Q469-51 464-50Q464-53 464-57Q469-56 475-56L489-56L489-68Q489-75 489-82Q493-82 497-82Q496-75 496-68L496-56L515-56Q521-56 526-57Q526-53 526-50Q521-51 515-51L496-51L496-42L497-43L511-28L525-13L519-8L505-23L495-34Q492-23 485-15Q478-7 468-3Q466-8 462-9Q474-12 482-22Q489-32 489-44ZM619-44L635-44L635-26L619-26ZM744-33L736-33L736-45L744-45Q749-45 752-47Q755-50 755-53Q755-57 752-60Q749-62 744-62Q740-62 735-61Q730-60 725-58L725-71Q730-73 735-73Q740-74 745-74Q756-74 763-69Q769-64 769-55Q769-49 765-45Q762-41 755-39Q763-38 767-33Q771-28 771-20Q771-10 764-4Q757 1 744 1Q739 1 733 0Q728 0 723-2L723-16Q728-13 733-12Q738-11 744-11Q750-11 754-14Q757-16 757-21Q757-27 754-30Q750-33 744-33ZM801-36Q801-39 803-41Q805-42 807-42Q810-42 812-41Q813-39 813-36Q813-34 812-32Q810-30 807-30Q805-30 803-32Q801-34 801-36ZM807-62Q802-62 800-56Q798-50 798-36Q798-23 800-17Q802-11 807-11Q812-11 815-17Q817-23 817-36Q817-50 815-56Q812-62 807-62ZM783-36Q783-55 789-65Q795-74 807-74Q819-74 825-65Q831-55 831-36Q831-17 825-8Q819 1 807 1Q795 1 789-8Q783-17 783-36ZM902-73L919-73L928-41L936-73L954-73L954 0L941 0L941-58L934-27L922-27L914-58L914 0L902 0ZM966-60L966-73L1010-73L1010-60L995-60L995-13L1010-13L1010 0L966 0L966-13L981-13L981-60ZM1024-73L1039-73L1060-20L1060-73L1072-73L1072 0L1057 0L1037-53L1037 0L1024 0ZM1169-61Q1163-61 1160-55Q1158-50 1158-36Q1158-23 1160-17Q1163-12 1169-12Q1174-12 1177-17Q1179-23 1179-36Q1179-50 1177-55Q1174-61 1169-61ZM1143-36Q1143-55 1149-65Q1156-74 1169-74Q1181-74 1188-65Q1194-55 1194-36Q1194-18 1188-8Q1181 1 1169 1Q1156 1 1149-8Q1143-18 1143-36ZM1238-34Q1240-34 1242-32Q1243-31 1246-26L1259 0L1243 0L1234-18Q1234-19 1233-21Q1229-29 1224-29L1220-29L1220 0L1205 0L1205-73L1226-73Q1240-73 1246-68Q1252-63 1252-52Q1252-44 1249-40Q1245-35 1238-34ZM1220-61L1220-41L1226-41Q1232-41 1235-43Q1237-46 1237-51Q1237-56 1235-58Q1232-61 1226-61ZM1373-60L1342-60L1342-44L1371-44L1371-32L1342-32L1342 0L1328 0L1328-73L1373-73ZM1419-34Q1421-34 1422-32Q1424-31 1426-26L1439 0L1424 0L1415-18Q1414-19 1414-21Q1410-29 1405-29L1400-29L1400 0L1386 0L1386-73L1407-73Q1421-73 1427-68Q1433-63 1433-52Q1433-44 1429-40Q1426-35 1419-34ZM1400-61L1400-41L1407-41Q1413-41 1415-43Q1418-46 1418-51Q1418-56 1415-58Q1413-61 1407-61ZM1493 0L1448 0L1448-73L1493-73L1493-60L1462-60L1462-44L1490-44L1490-32L1462-32L1462-13L1493-13ZM1553 0L1508 0L1508-73L1553-73L1553-60L1522-60L1522-44L1550-44L1550-32L1522-32L1522-13L1553-13Z"],"a2a":[416,"M64 11Q60 11 57 8Q55 6 55 2L55-14L42-14L42-9Q42-5 39-1Q37 2 34 5Q30 7 26 9Q19 12 11 14Q10 9 7 7Q17 6 25 3Q29 1 32-2Q35-5 35-9L35-14L22-14L22-14L16-14L16-40L17-40L17-40Q19-40 22-40Q25-40 32-42Q39-45 42-47Q43-44 45-41Q41-40 33-37Q25-35 22-34Q22-32 22-29L37-29Q41-29 45-30Q45-27 45-25Q41-25 37-25L22-25Q22-22 22-18L75-18L75-26L64-26Q60-26 56-25Q56-27 56-29Q60-29 64-29L75-29L75-36L63-36Q59-36 55-36Q55-38 55-40Q59-40 63-40L81-40L81-14L61-14L61 2Q61 3 62 5Q63 6 64 6L82 6Q84 6 85 3L87-3Q90-1 93 0L89 8Q88 11 85 11ZM82-53Q82-51 82-49Q78-49 74-49L67-49Q63-49 59-49Q59-51 59-53Q63-52 67-52L74-52Q78-52 82-53ZM81-62Q81-60 81-58Q77-59 73-59L67-59Q63-59 59-58Q59-60 59-62Q63-62 67-62L73-62Q77-62 81-62ZM44-52Q44-50 44-48Q40-49 37-49L29-49Q25-49 21-48Q22-50 21-52Q25-52 29-52L37-52Q40-52 44-52ZM44-63Q44-61 44-59Q41-59 37-59L30-59Q26-59 22-59Q22-61 22-63Q26-62 30-62L37-62Q41-62 44-63ZM57-47Q53-47 50-47Q50-53 50-59L50-67L17-67L17-54L10-54Q10-66 10-71L17-71L17-71L50-71L50-76L29-76Q25-76 21-76Q21-78 21-80Q25-80 29-80L77-80Q81-80 85-80Q85-78 85-76Q81-76 77-76L57-76L57-71L94-71L94-54L88-54L88-67L57-67L57-59Q57-53 57-47ZM201 3Q200 6 201 8Q196 8 191 8L157 8Q152 8 147 8Q147 6 147 3Q152 3 157 3L169 3L169-64L161-64Q156-64 151-63Q151-66 151-69Q156-69 161-69L188-69Q194-69 199-69Q198-66 199-63Q194-64 188-64L176-64L176 3L191 3Q196 3 201 3ZM107 3Q116 2 123 0L123-24L115-24L115-18L108-18L108-59L123-59L123-67Q123-74 123-81Q127-81 131-81Q130-74 130-67L130-59L146-59L146-18L139-18L139-24L130-24L130-1L136-3Q134-6 132-9L139-13Q144-5 149 4L142 7Q140 4 138 1Q126 5 121 7Q115 9 110 11Q109 6 107 3ZM130-29L139-29L139-54L130-54ZM123-29L123-54L115-54L115-29ZM278-2L278-70L222-70Q216-70 210-70Q210-73 210-76Q216-76 222-76L292-76Q298-76 304-76Q304-73 304-70Q298-70 292-70L285-70L285 1Q285 8 280 10Q276 13 266 13Q267 8 264 4Q267 5 271 5Q275 5 277 4Q278 3 278-2ZM231-14L224-14L224-56L259-56L259-14L252-14L252-20L231-20ZM252-50L231-50L231-26L252-26ZM406-2L400 3L388-11L375-24L381-30L394-16ZM344-29Q347-26 350-24Q341-11 327 0L319 7Q317 4 314 2Q325-6 334-17ZM363-34L330-34L330-58Q330-65 330-72Q331-72 332-72L332-73Q333-73 336-73Q340-73 340-73Q348-73 366-76Q385-79 394-83Q395-79 396-75Q387-73 369-70Q350-67 338-66L338-40L363-40L363-46Q363-53 362-60Q366-60 370-60Q370-53 370-46L370-40L408-40L408-34L370-34L370 1Q370 7 366 10Q362 13 352 13Q354 8 350 4Q353 5 357 5Q361 5 362 4Q363 3 363-2Z"],"a2b":[655,"M9-73L30-73L57-23L57-73L75-73L75 0L54 0L27-50L27 0L9 0ZM93-73L144-73L144-59L112-59L112-45L142-45L142-31L112-31L112-14L145-14L145 0L93 0ZM194-61Q186-61 181-54Q176-48 176-36Q176-25 181-19Q186-12 194-12Q203-12 208-19Q213-25 213-36Q213-48 208-54Q203-61 194-61ZM194-74Q212-74 222-64Q232-54 232-36Q232-19 222-9Q212 1 194 1Q177 1 167-9Q157-19 157-36Q157-54 167-64Q177-74 194-74ZM246-73L267-73L294-23L294-73L312-73L312 0L291 0L264-50L264 0L246 0ZM423-4Q417-1 412 0Q406 1 400 1Q382 1 371-9Q361-19 361-36Q361-54 371-64Q382-74 400-74Q406-74 412-73Q417-71 423-69L423-54Q417-57 412-59Q407-61 402-61Q391-61 386-54Q380-48 380-36Q380-25 386-19Q391-12 402-12Q407-12 412-14Q417-16 423-19ZM471-61Q463-61 458-54Q453-48 453-36Q453-25 458-19Q463-12 471-12Q480-12 485-19Q490-25 490-36Q490-48 485-54Q480-61 471-61ZM471-74Q489-74 499-64Q509-54 509-36Q509-19 499-9Q489 1 471 1Q454 1 444-9Q434-19 434-36Q434-54 444-64Q454-74 471-74ZM523-73L542-73L542-14L575-14L575 0L523 0ZM631-13L602-13L597 0L578 0L605-73L628-73L655 0L636 0ZM606-27L626-27L616-56Z"],"a3a":[416,"M51-60Q45-70 38-79L44-84Q52-74 58-64ZM96 5Q92 8 91 12Q70 7 52-9Q33 10 6 16Q5 11 3 8Q30 2 47-14Q28-35 20-65L26-67Q30-54 37-41Q43-28 52-19Q56-24 60-30Q63-37 67-50Q72-62 73-71Q77-70 82-70Q80-55 74-40Q67-26 57-14Q73 0 96 5ZM185-13L185-10Q179-10 174-10L166-10L166-2Q166 5 167 12Q163 12 159 12Q159 5 159-2L159-10L154-10Q149-10 143-10Q144-12 144-14Q140-8 135-3Q132-7 128-8Q143-22 149-37Q152-46 154-55L146-55Q140-55 135-55Q135-58 135-61Q140-61 146-61L159-61L159-66Q159-73 159-80Q163-80 167-80Q166-73 166-66L166-61L186-61Q192-61 197-61Q197-58 197-55Q192-55 186-55L174-55Q175-41 181-29Q189-17 201-8Q197-7 194-4Q189-8 185-13ZM166-55L166-15L183-16Q179-21 176-26Q168-41 167-55ZM145-16L159-15L159-46Q158-40 154-32Q151-24 145-16ZM134-77Q131-64 125-52L125 0Q125 6 125 13Q122 13 119 13Q119 6 119 0L119-42Q115-35 109-30Q107-34 104-35Q109-40 113-45Q120-54 123-62Q125-70 127-79Q131-78 134-77ZM292-23Q295-20 298-17Q287-5 272 4Q257 13 236 16Q236 11 233 8Q261 5 277-8Q285-15 292-23ZM280-35Q283-32 286-29Q265-6 242 0Q241-4 238-7Q247-9 255-13Q264-17 269-23Q275-28 280-35ZM270-50Q273-47 276-45Q265-30 244-20Q243-23 240-26Q249-30 256-35Q262-41 270-50ZM299-34Q279-46 266-65Q254-44 236-34Q235-38 231-40Q238-44 246-50Q253-57 257-63Q261-72 265-81Q269-79 273-78Q271-75 270-72Q276-61 284-54Q292-46 304-40Q301-38 299-34ZM208-41Q209-43 208-46Q213-46 218-46L228-46L228-8L234-16L237-20L240-16L237-13L225 4L221 0Q222-1 222-3L222-41ZM223-58Q217-68 211-76L217-81Q223-72 229-62ZM394 12Q390 12 387 12Q387 5 387-2L387-45L372-45L372-32Q372-17 364-5Q356 7 342 12Q341 8 337 7Q349 3 357-7Q365-18 365-32L365-60Q365-67 365-74Q368-73 372-74Q372-73 372-72Q377-72 385-73Q392-75 395-77Q398-78 399-81Q402-78 405-76Q403-73 398-71Q395-70 388-69Q382-67 372-66L372-50L397-50Q403-50 408-50Q408-48 408-45Q403-45 397-45L394-45L394-2Q394 5 394 12ZM327-28L327-71L329-71Q336-72 342-75Q348-78 356-82Q357-79 360-76Q349-69 334-65Q334-62 334-58L356-58L356-25L349-25L349-30L334-30Q334-15 331-6Q328 4 322 11Q319 8 315 8Q321 2 324-7Q327-15 327-28ZM349-35L349-52L334-52L334-35Z"],"a3b":[770.8,"M67-4Q62-1 56 0Q51 1 44 1Q26 1 16-9Q5-19 5-36Q5-54 16-64Q26-74 44-74Q51-74 56-73Q62-71 67-69L67-54Q62-57 57-59Q52-61 46-61Q36-61 30-54Q24-48 24-36Q24-25 30-19Q36-12 46-12Q52-12 57-14Q62-16 67-19ZM72-73L93-73L110-47L126-73L147-73L119-31L119 0L100 0L100-31ZM184-45Q189-45 191-47Q193-49 193-52Q193-56 191-58Q189-60 184-60L174-60L174-45ZM185-13Q190-13 193-15Q196-18 196-22Q196-27 193-30Q191-32 185-32L174-32L174-13ZM202-39Q208-37 212-33Q215-28 215-21Q215-10 208-5Q201 0 186 0L155 0L155-73L183-73Q198-73 205-68Q212-64 212-54Q212-48 210-45Q207-41 202-39ZM231-73L282-73L282-59L250-59L250-45L280-45L280-31L250-31L250-14L283-14L283 0L231 0ZM326-41Q332-41 335-43Q337-45 337-50Q337-55 335-57Q332-59 326-59L318-59L318-41ZM318-28L318 0L300 0L300-73L328-73Q343-73 349-68Q356-63 356-53Q356-46 353-41Q349-36 342-34Q346-33 349-30Q352-27 355-21L365 0L345 0L336-18Q334-24 331-26Q328-28 324-28ZM469-4Q464-1 458 0Q453 1 447 1Q428 1 418-9Q407-19 407-36Q407-54 418-64Q428-74 447-74Q453-74 458-73Q464-71 469-69L469-54Q464-57 459-59Q454-61 448-61Q438-61 432-54Q427-48 427-36Q427-25 432-19Q438-12 448-12Q454-12 459-14Q464-16 469-19ZM485-73L504-73L504-14L537-14L537 0L485 0ZM548-73L567-73L567 0L548 0ZM586-73L607-73L633-23L633-73L651-73L651 0L630 0L603-50L603 0L586 0ZM669-73L688-73L688 0L669 0ZM764-4Q759-1 754 0Q748 1 742 1Q724 1 713-9Q702-19 702-36Q702-54 713-64Q724-74 742-74Q748-74 754-73Q759-71 764-69L764-54Q759-57 754-59Q749-61 743-61Q733-61 728-54Q722-48 722-36Q722-25 728-19Q733-12 743-12Q749-12 754-14Q759-16 764-19Z"],"a3c":[1111.1,"M85 12Q81 12 78 12Q78 5 78-1L78-44L65-44L65-27Q65-1 49 12Q47 8 43 7Q59-2 59-27L59-75L61-75L60-75L67-75Q69-75 76-75Q84-76 86-77Q89-78 90-80Q91-76 93-73Q89-71 82-71L65-69L65-48L87-48Q91-48 96-49Q96-46 96-44L84-44L84-1Q84 5 85 12ZM47-3Q42-12 35-19L41-24Q47-16 53-7ZM18-24Q21-22 25-21Q20-8 7 7Q5 5 2 4Q9-4 14-14Q16-19 18-24ZM29 0L29-28L17-28Q12-28 8-27Q8-30 8-32Q12-32 17-32L29-32L29-43L16-43Q11-43 7-43Q7-46 7-48Q11-48 16-48L29-48L29-48L30-48Q36-57 40-68Q44-67 47-66Q44-57 37-48L47-48Q51-48 56-48Q56-46 56-43Q51-43 47-43L35-43L35-32L46-32Q50-32 55-32Q54-30 55-27Q50-28 46-28L35-28L35 2Q35 6 32 9Q29 12 20 12Q21 8 19 4Q21 5 24 5Q27 5 28 4Q29 4 29 0ZM29-53L23-49L13-64L19-68ZM53-74Q53-71 53-69Q49-69 45-69L18-69Q13-69 9-69Q9-71 9-74Q13-73 18-73L28-73L22-79L27-84L36-75L34-73L45-73Q49-73 53-74ZM145-43Q140-43 135-43Q136-45 135-48Q140-47 145-47L166-47L170-55L140-55L148-72Q151-78 154-84Q157-82 160-81L156-73L186-73L174-47L188-47Q193-47 197-48Q197-45 197-43Q193-43 188-43L167-43Q165-41 164-40Q168-36 171-29Q178-32 186-39Q188-36 191-34Q186-29 178-25Q180-19 183-15Q189-8 200-5Q197-2 196 1Q188-1 183-6Q177-12 174-20Q176-7 171 3Q168 8 165 10Q162 12 156 14Q155 10 151 8Q160 7 164 1Q170-5 168-16Q157 0 136 6Q135 3 133 0Q143-2 150-8Q158-14 165-23L167-22Q166-24 165-27Q158-20 146-13L139-8Q137-12 134-14Q142-18 154-26L162-33Q161-35 160-35Q150-27 136-21Q135-24 132-26Q139-29 144-32Q150-36 156-42L156-42Q156-42 157-42L158-43ZM172-60L177-69L154-69L149-60ZM113-4L108-4L108-74L130-74L130-4L124-4L124-13L113-13ZM124-70L113-70L113-17L124-17ZM274-73L289-73L310-20L310-73L323-73L323 0L307 0L287-53L287 0L274 0ZM382 0L337 0L337-73L382-73L382-60L351-60L351-44L379-44L379-32L351-32L351-13L382-13ZM389-73L401-73L406-19L413-54L425-54L432-19L436-73L449-73L440 0L427 0L419-38L411 0L398 0ZM529-33L529-12L539-12Q546-12 548-14Q551-16 551-22Q551-28 548-31Q545-33 539-33ZM529-62L529-45L539-45Q544-45 546-47Q549-48 549-53Q549-57 546-59Q544-62 539-62ZM515-73L539-73Q551-73 557-68Q563-64 563-55Q563-48 559-44Q556-40 549-39Q557-38 561-33Q566-29 566-20Q566-9 559-5Q553 0 539 0L515 0ZM623 0L577 0L577-73L623-73L623-60L592-60L592-44L620-44L620-32L592-32L592-13L623-13ZM660-60L653-30L666-30ZM651-73L668-73L688 0L674 0L669-18L650-18L645 0L631 0ZM695-73L710-73L710-44L732-73L749-73L726-44L749 0L733 0L716-33L710-25L710 0L695 0ZM775-32Q764-36 760-41Q756-45 756-53Q756-63 762-69Q769-74 780-74Q785-74 790-73Q795-72 800-70L800-56Q795-59 791-61Q786-62 781-62Q776-62 773-60Q770-58 770-54Q770-51 772-49Q774-47 781-45L787-42Q796-39 800-34Q804-29 804-21Q804-9 798-4Q791 1 778 1Q772 1 767 0Q762-1 756-4L756-19Q762-14 768-12Q773-10 778-10Q784-10 787-13Q789-15 789-20Q789-23 787-25Q786-28 782-29ZM885-36L916-36L916-22L885-22ZM964-57L946-28L964-28ZM963-73L978-73L978-28L986-28L986-16L978-16L978 0L964 0L964-16L935-16L935-30ZM1015-36Q1015-39 1016-41Q1018-42 1021-42Q1023-42 1025-41Q1027-39 1027-36Q1027-34 1025-32Q1023-30 1021-30Q1018-30 1016-32Q1015-34 1015-36ZM1021-62Q1016-62 1013-56Q1011-50 1011-36Q1011-23 1013-17Q1016-11 1021-11Q1026-11 1028-17Q1030-23 1030-36Q1030-50 1028-56Q1026-62 1021-62ZM997-36Q997-55 1003-65Q1009-74 1021-74Q1033-74 1039-65Q1045-55 1045-36Q1045-17 1039-8Q1033 1 1021 1Q1009 1 1003-8Q997-17 997-36ZM1052-54Q1052-61 1057-65Q1062-70 1068-70Q1075-70 1079-65Q1084-61 1084-54Q1084-48 1079-43Q1075-39 1068-39Q1062-39 1057-43Q1052-48 1052-54ZM1068-61Q1065-61 1063-59Q1061-57 1061-54Q1061-51 1063-50Q1065-48 1068-48Q1071-48 1073-50Q1075-51 1075-54Q1075-57 1073-59Q1071-61 1068-61ZM1055-27L1106-48L1108-43L1057-23ZM1079-16Q1079-22 1084-27Q1088-31 1095-31Q1101-31 1106-27Q1110-22 1110-16Q1110-9 1106-5Q1101 0 1095 0Q1088 0 1084-5Q1079-9 1079-16ZM1095-22Q1092-22 1090-20Q1088-18 1088-16Q1088-13 1090-11Q1092-9 1095-9Q1098-9 1099-11Q1101-13 1101-16Q1101-18 1099-20Q1097-22 1095-22Z"],"a4a":[416,"M33-4Q28-12 23-19L29-24Q35-16 39-7ZM63 1L63-25L13-25Q8-25 2-24Q2-27 2-31Q8-30 13-30L63-30Q62-34 62-38Q66-37 70-38Q70-34 70-30L84-30Q90-30 96-31Q96-27 96-24Q90-25 84-25L70-25L70 3Q70 7 67 9Q62 13 52 13Q54 8 50 4Q53 5 57 5Q61 5 62 4Q63 4 63 1ZM14-72Q15-75 14-78Q20-78 26-78L80-78L80-41L26-41Q20-41 14-41Q15-44 14-47Q20-47 26-47L73-47L73-58L30-58Q24-58 18-58Q19-61 18-64Q24-63 30-63L73-63L73-72L26-72Q20-72 14-72ZM183-13Q183-10 183-7Q177-7 171-7L118-7Q112-7 106-7Q106-10 106-13Q112-13 118-13L171-13Q177-13 183-13ZM180-73L180-43Q180-40 177-37Q173-33 162-33Q163-38 159-42Q162-42 167-42Q172-42 172-42Q173-43 173-44L173-67L139-67L138-66Q138-67 137-67Q133-67 129-67L129-31L199-31L196 3Q196 7 193 10Q186 14 175 13Q176 8 173 4Q176 5 182 5Q187 4 188 4Q189 3 189 1L192-25L122-25L122-73Q128-73 134-73Q136-75 138-80Q141-79 145-78Q145-75 143-73ZM152-46Q146-54 138-60L144-66Q152-60 158-52ZM251 12Q247 12 243 12Q244 5 244-2L244-29L298-29L298 12L292 12L292 5L251 5Q251 9 251 12ZM228-73L257-73L251-79L256-85L267-75L266-73L298-73L298-41L291-41L291-45L235-45L235-21Q235-9 230 0Q225 8 217 12Q215 9 211 7Q219 4 224-3Q228-10 228-21ZM292-23L250-23L250 0L292 0ZM291-51L291-68L235-68L235-51ZM357-2L357-8L333-8Q328-8 323-8Q323-11 323-14Q328-13 333-13L357-13L357-21L324-21Q319-21 314-21Q314-24 314-26Q319-26 324-26L357-26L357-33L333-33Q328-33 323-33Q323-36 323-38Q328-38 333-38L357-38L357-44L329-44Q330-53 329-62L357-62L357-68L326-68Q321-68 316-68Q316-71 316-73Q321-73 326-73L357-73Q356-78 356-82Q360-82 364-82Q364-78 363-73L394-73Q399-73 404-73Q404-71 404-68Q399-68 394-68L363-68L363-62L391-62Q389-53 391-44L363-44L363-38L393-38L393-26L397-26Q403-26 408-26Q408-24 408-21Q403-21 397-21L393-21L393-8L363-8L363 0Q363 7 360 10Q356 13 346 13Q347 8 344 4Q347 5 351 5Q354 5 355 4Q357 3 357-2ZM363-13L386-13L386-21L363-21ZM363-26L386-26L386-33L363-33ZM363-57L363-49L384-49L384-57ZM357-57L336-57L336-49L357-49Z"],"a4b":[1569.6,"M9-73L28-73L28-45L56-45L56-73L75-73L75 0L56 0L56-31L28-31L28 0L9 0ZM137-13L108-13L103 0L84 0L111-73L134-73L161 0L142 0ZM112-27L132-27L122-56ZM162-73L180-73L200-19L219-73L238-73L211 0L189 0ZM248-73L298-73L298-59L266-59L266-45L296-45L296-31L266-31L266-14L299-14L299 0L248 0ZM341-73L361-73L378-47L394-73L415-73L387-31L387 0L368 0L368-31ZM456-61Q448-61 443-54Q438-48 438-36Q438-25 443-19Q448-12 456-12Q465-12 470-19Q475-25 475-36Q475-48 470-54Q465-61 456-61ZM456-74Q474-74 484-64Q494-54 494-36Q494-19 484-9Q474 1 456 1Q439 1 429-9Q419-19 419-36Q419-54 429-64Q439-74 456-74ZM508-73L527-73L527-29Q527-20 530-16Q533-12 540-12Q546-12 549-16Q552-20 552-29L552-73L571-73L571-29Q571-14 563-6Q556 1 540 1Q524 1 516-6Q508-14 508-29ZM675-71L675-55Q669-58 663-59Q658-61 652-61Q646-61 642-59Q639-57 639-53Q639-50 641-48Q644-47 649-46L657-44Q669-42 675-37Q680-32 680-22Q680-10 673-4Q665 1 651 1Q644 1 637 0Q630-1 623-4L623-20Q630-16 636-14Q643-12 649-12Q655-12 658-14Q662-16 662-20Q662-24 659-25Q657-27 651-29L643-30Q632-33 627-38Q622-43 622-52Q622-62 629-68Q636-74 649-74Q655-74 662-73Q668-72 675-71ZM696-73L747-73L747-59L715-59L715-45L745-45L745-31L715-31L715-14L748-14L748 0L696 0ZM765-73L815-73L815-59L783-59L783-45L813-45L813-31L783-31L783-14L816-14L816 0L765 0ZM833-73L854-73L880-23L880-73L898-73L898 0L877 0L851-50L851 0L833 0ZM943-73L1010-73L1010-59L986-59L986 0L967 0L967-59L943-59ZM1020-73L1038-73L1038-45L1066-45L1066-73L1085-73L1085 0L1066 0L1066-31L1038-31L1038 0L1020 0ZM1103-73L1122-73L1122 0L1103 0ZM1191-71L1191-55Q1185-58 1179-59Q1174-61 1169-61Q1162-61 1159-59Q1156-57 1156-53Q1156-50 1158-48Q1160-47 1166-46L1174-44Q1186-42 1191-37Q1196-32 1196-22Q1196-10 1189-4Q1182 1 1167 1Q1160 1 1153 0Q1146-1 1139-4L1139-20Q1146-16 1153-14Q1159-12 1165-12Q1171-12 1175-14Q1178-16 1178-20Q1178-24 1176-25Q1173-27 1167-29L1160-30Q1149-33 1144-38Q1138-43 1138-52Q1138-62 1146-68Q1153-74 1166-74Q1172-74 1178-73Q1184-72 1191-71ZM1277-45Q1281-45 1283-47Q1286-49 1286-52Q1286-56 1283-58Q1281-60 1277-60L1266-60L1266-45ZM1277-13Q1283-13 1286-15Q1289-18 1289-22Q1289-27 1286-30Q1283-32 1277-32L1266-32L1266-13ZM1295-39Q1301-37 1304-33Q1307-28 1307-21Q1307-10 1300-5Q1293 0 1279 0L1247 0L1247-73L1276-73Q1291-73 1298-68Q1304-64 1304-54Q1304-48 1302-45Q1299-41 1295-39ZM1324-73L1342-73L1342 0L1324 0ZM1387-41Q1393-41 1396-43Q1398-45 1398-50Q1398-55 1396-57Q1393-59 1387-59L1380-59L1380-41ZM1380-28L1380 0L1361 0L1361-73L1389-73Q1404-73 1411-68Q1417-63 1417-53Q1417-46 1414-41Q1410-36 1403-34Q1407-33 1410-30Q1413-27 1416-21L1427 0L1407 0L1398-18Q1395-24 1392-26Q1389-28 1385-28ZM1457-59L1457-14L1463-14Q1475-14 1481-20Q1487-26 1487-37Q1487-47 1481-53Q1475-59 1463-59ZM1438-73L1458-73Q1474-73 1482-71Q1490-68 1496-62Q1501-58 1504-51Q1506-45 1506-37Q1506-28 1504-22Q1501-15 1496-10Q1490-5 1482-2Q1474 0 1458 0L1438 0ZM1546-25L1529-25L1529-27Q1529-31 1530-34Q1532-37 1537-42L1540-45Q1543-47 1544-50Q1545-52 1545-54Q1545-58 1543-59Q1541-61 1537-61Q1533-61 1528-60Q1523-58 1518-55L1518-70Q1524-72 1529-73Q1534-74 1539-74Q1551-74 1557-69Q1563-64 1563-55Q1563-50 1561-47Q1559-43 1555-38L1552-36Q1548-33 1547-31Q1546-29 1546-27ZM1529-17L1546-17L1546 0L1529 0Z"],"a4c":[1171.3,"M39-34Q42-34 43-32Q45-31 47-26L60 0L44 0L36-18Q35-19 35-21Q31-29 25-29L21-29L21 0L6 0L6-73L27-73Q41-73 47-68Q54-63 54-52Q54-44 50-40Q46-35 39-34ZM21-61L21-41L28-41Q34-41 36-43Q39-46 39-51Q39-56 36-58Q34-61 28-61ZM114 0L68 0L68-73L114-73L114-60L83-60L83-44L111-44L111-32L83-32L83-13L114-13ZM120-73L133-73L138-19L145-54L156-54L164-19L168-73L181-73L172 0L159 0L150-38L143 0L129 0ZM211-60L204-30L218-30ZM202-73L220-73L239 0L225 0L220-18L201-18L197 0L182 0ZM280-34Q282-34 284-32Q286-31 288-26L301 0L285 0L276-18Q276-19 275-21Q272-29 266-29L262-29L262 0L247 0L247-73L268-73Q282-73 288-68Q294-63 294-52Q294-44 291-40Q287-35 280-34ZM262-61L262-41L269-41Q274-41 277-43Q280-46 280-51Q280-56 277-58Q274-61 269-61ZM322-60L322-13L326-13Q335-13 338-18Q342-24 342-37Q342-49 338-55Q335-60 326-60ZM308-73L323-73Q341-73 349-64Q357-56 357-37Q357-17 349-9Q341 0 323 0L308 0ZM443-44L460-44L460-26L443-26ZM597-6Q614 1 631 9L628 15Q612 7 595 1ZM588-20Q592-19 596-18Q592-3 580 7Q568 17 553 17Q551 11 547 8Q550 8 556 8Q562 8 564 8Q573 6 580-1Q587-9 588-20ZM560-28L623-28L623-5L616-5L616-23L566-23Q566-9 567-1Q563-2 559-1Q560-7 560-12ZM565-35Q566-44 565-52L615-52Q614-44 615-35ZM552-48L545-48L545-62L587-62L587-69Q587-75 586-82Q590-82 593-82Q593-77 593-73L593-62L604-62Q602-64 600-65Q604-68 607-71Q610-74 613-80Q616-78 620-77Q616-69 607-62L636-62L636-48L629-48L629-58L552-58ZM573-62Q566-69 558-75L563-81Q571-75 578-67ZM572-48L572-40L608-40L609-48ZM698-75Q711-52 741-45Q738-43 737-39Q724-42 713-50Q701-58 694-69Q684-55 672-45Q677-45 681-45L710-45Q715-45 720-45Q720-42 720-39Q715-39 710-39L698-39L698-26L719-26Q725-26 730-26Q730-24 730-21Q725-21 719-21L698-21L698 2L703 2Q706-2 711-11L716-19Q719-17 723-15L720-11L716-4L711 2L728 2Q733 2 739 2Q738 5 739 7Q733 7 728 7L707 7Q707 8 707 7L665 7Q660 7 654 7Q655 5 654 2Q660 2 665 2L676 2Q671-7 665-14L671-19Q677-11 683-1L678 2L691 2L691-21L672-21Q667-21 662-21Q662-24 662-26Q667-26 672-26L691-26L691-39L681-39Q676-39 671-39Q671-42 671-44Q662-37 652-32Q651-36 648-38Q669-48 679-62Q686-71 692-81Q695-79 699-77ZM819-13L835-13L835-60L820-56L820-69L835-73L849-73L849-13L865-13L865 0L819 0ZM985-60L954-60L954-44L982-44L982-32L954-32L954 0L939 0L939-73L985-73ZM999-60L999-73L1042-73L1042-60L1028-60L1028-13L1042-13L1042 0L999 0L999-13L1014-13L1014-60ZM1076-32Q1065-36 1061-41Q1057-45 1057-53Q1057-63 1064-69Q1070-74 1081-74Q1086-74 1091-73Q1096-72 1101-70L1101-56Q1096-59 1092-61Q1087-62 1082-62Q1077-62 1074-60Q1071-58 1071-54Q1071-51 1073-49Q1075-47 1082-45L1088-42Q1097-39 1101-34Q1105-29 1105-21Q1105-9 1099-4Q1092 1 1079 1Q1073 1 1068 0Q1063-1 1057-4L1057-19Q1063-14 1069-12Q1074-10 1079-10Q1085-10 1088-13Q1090-15 1090-20Q1090-23 1089-25Q1087-28 1083-29ZM1118-73L1132-73L1132-45L1150-45L1150-73L1165-73L1165 0L1150 0L1150-32L1132-32L1132 0L1118 0Z"],"sky3":[481.6,"M25-32Q14-36 10-41Q6-45 6-53Q6-63 13-69Q19-74 30-74Q35-74 40-73Q45-72 50-70L50-56Q45-59 41-61Q36-62 31-62Q26-62 23-60Q20-58 20-54Q20-51 22-49Q24-47 31-45L37-42Q46-39 50-34Q54-29 54-21Q54-9 48-4Q41 1 28 1Q23 1 17 0Q12-1 7-4L7-19Q12-14 18-12Q23-10 28-10Q34-10 37-13Q40-15 40-20Q40-23 38-25Q36-28 32-29ZM66-73L80-73L80-44L103-73L119-73L96-44L120 0L104 0L87-33L80-25L80 0L66 0ZM121-73L136-73L150-44L165-73L180-73L158-29L158 0L143 0L143-29ZM181-73L193-73L198-19L205-54L217-54L224-19L228-73L241-73L232 0L219 0L211-38L203 0L190 0ZM271-60L264-30L278-30ZM262-73L280-73L299 0L285 0L281-18L261-18L257 0L242 0ZM301-73L317-73L331-44L345-73L361-73L338-29L338 0L324 0L324-29ZM448-33L441-33L441-45L448-45Q454-45 457-47Q460-50 460-53Q460-57 457-60Q454-62 448-62Q444-62 439-61Q435-60 430-58L430-71Q435-73 440-73Q445-74 449-74Q461-74 467-69Q473-64 473-55Q473-49 470-45Q466-41 459-39Q467-38 471-33Q475-28 475-20Q475-10 468-4Q462 1 449 1Q443 1 438 0Q432 0 428-2L428-16Q432-13 437-12Q443-11 449-11Q454-11 458-14Q461-16 461-21Q461-27 458-30Q454-33 448-33Z"],"sky7":[481.6,"M25-32Q14-36 10-41Q6-45 6-53Q6-63 13-69Q19-74 30-74Q35-74 40-73Q45-72 50-70L50-56Q45-59 41-61Q36-62 31-62Q26-62 23-60Q20-58 20-54Q20-51 22-49Q24-47 31-45L37-42Q46-39 50-34Q54-29 54-21Q54-9 48-4Q41 1 28 1Q23 1 17 0Q12-1 7-4L7-19Q12-14 18-12Q23-10 28-10Q34-10 37-13Q40-15 40-20Q40-23 38-25Q36-28 32-29ZM66-73L80-73L80-44L103-73L119-73L96-44L120 0L104 0L87-33L80-25L80 0L66 0ZM121-73L136-73L150-44L165-73L180-73L158-29L158 0L143 0L143-29ZM181-73L193-73L198-19L205-54L217-54L224-19L228-73L241-73L232 0L219 0L211-38L203 0L190 0ZM271-60L264-30L278-30ZM262-73L280-73L299 0L285 0L281-18L261-18L257 0L242 0ZM301-73L317-73L331-44L345-73L361-73L338-29L338 0L324 0L324-29ZM428-73L474-73L474-63L449 0L435 0L458-60L428-60Z"],"lift":[1198.7,"M56-39L56-52L44-52Q44-55 44-58L56-58L56-67Q56-74 56-81Q60-81 63-81Q63-74 63-67L63-58L82-58L79-4Q79-2 80 0Q81 1 83 1L89 1Q90 1 90 0Q90-2 90-2L92-9Q94-6 97-6L95 5Q94 6 93 7L83 7Q77 7 74 4Q72 1 72-3Q72-6 73-28Q75-49 75-52L63-52L63-39Q63-5 41 11Q39 8 34 7Q56-6 56-39ZM21-81Q24-80 28-79Q26-73 24-67L23-66L32-66Q37-66 42-66Q42-63 42-61Q37-61 32-61L22-61L13-38L23-38L23-41Q23-47 23-54Q27-53 31-54Q31-47 31-41L31-38L46-38L46-34L31-34L31-19Q38-20 47-22L47-18L31-15L31 0Q31 7 31 13Q27 13 23 13Q23 7 23 0L23-13L17-11Q10-10 3-8Q3-12 1-16Q13-16 23-18L23-34L4-34L14-61L1-61Q1-63 1-66L15-66L17-69Q19-75 21-81ZM161 9Q139 9 127-2L110 8Q109 5 107 2L124-6L124-44L117-44Q112-44 107-44Q108-47 107-49Q112-49 117-49L130-49L130-6Q138-1 145 0Q150 1 161 1L198 2Q194 4 195 9ZM129-62L123-57L112-70L117-75ZM143-6Q144-29 143-52L153-52L158-59L144-59Q140-59 135-59Q135-62 135-64Q140-64 144-64L152-64Q148-70 142-76L147-81Q154-74 160-66L157-64L165-64Q167-67 172-75L175-81Q178-79 181-78Q179-73 173-64L186-64Q191-64 195-64Q195-62 195-59Q191-59 186-59L166-59Q163-55 161-52L185-52Q183-29 185-6ZM150-47L150-38L178-38L178-47L158-47L158-47Q157-47 157-47ZM150-34L150-24L178-24L178-34ZM150-20L150-11L178-11L178-20ZM259 11Q254 11 251 8Q248 5 248 0L248-17L223-17L223-7L215-7L215-67L248-67L248-82Q252-82 256-82L255-67L290-67L290-7L283-7L283-17L255-17L255 0Q255 1 256 3Q257 4 259 4L293 4Q295 4 296 3Q297 1 297-2L299-15Q302-13 306-13L304 4Q303 7 302 9Q300 11 298 11ZM255-23L283-23L283-39L255-39ZM248-23L248-39L223-39L223-23ZM255-45L283-45L283-61L255-61ZM248-45L248-61L223-61L223-45ZM376-47L376-58L363-58Q359-58 354-58Q354-60 354-63L367-63L357-76L362-80L374-67L369-63L377-63Q378-65 379-66L389-81Q392-79 395-77Q392-73 385-63L403-63L403-38L397-38L397-42L382-42L382-30L406-30L406-10Q406-7 403-4Q399-1 389-1Q390-6 387-10Q390-9 395-9Q399-9 399-10Q400-10 400-11L400-26L382-26L382-1Q382 5 383 12Q379 12 375 12Q376 5 376-1L376-20Q370-8 358 1Q353 5 347 8Q346 4 343 2Q357-4 365-17Q368-21 371-26L354-26L354-47L360-47L360-47ZM376-30L376-42L360-42L360-30ZM382-47L397-47L397-58L382-58ZM318-4Q316-7 312-7Q315-13 319-21Q323-29 326-38Q329-46 331-55L325-55Q320-55 315-55Q315-58 315-61Q320-61 325-61L333-61L333-67Q333-74 333-81Q336-80 339-81Q339-74 339-67L339-61L351-61Q350-58 351-55L339-55L339-43L342-45Q347-36 352-26L346-22Q344-27 341-32L339-36L339-1Q339 6 339 13Q336 13 333 13Q333 6 333-1L333-38Q326-18 318-4ZM506-61Q501-61 498-55Q496-50 496-36Q496-23 498-17Q501-12 506-12Q512-12 514-17Q517-23 517-36Q517-50 514-55Q512-61 506-61ZM481-36Q481-55 487-65Q494-74 506-74Q519-74 525-65Q532-55 532-36Q532-18 525-8Q519 1 506 1Q494 1 487-8Q481-18 481-36ZM576-34Q578-34 580-32Q581-31 583-26L597 0L581 0L572-18Q572-19 571-21Q567-29 562-29L557-29L557 0L543 0L543-73L564-73Q578-73 584-68Q590-63 590-52Q590-44 586-40Q583-35 576-34ZM557-61L557-41L564-41Q570-41 573-43Q575-46 575-51Q575-56 573-58Q570-61 564-61ZM617-33L617-12L626-12Q633-12 636-14Q639-16 639-22Q639-28 636-31Q633-33 626-33ZM617-62L617-45L626-45Q632-45 634-47Q636-48 636-53Q636-57 634-59Q632-62 626-62ZM603-73L626-73Q638-73 644-68Q651-64 651-55Q651-48 647-44Q643-40 636-39Q645-38 649-33Q653-29 653-20Q653-9 647-5Q641 0 626 0L603 0ZM665-60L665-73L709-73L709-60L694-60L694-13L709-13L709 0L665 0L665-13L680-13L680-60ZM754 0L740 0L740-60L721-60L721-73L773-73L773-60L754-60ZM807-60L801-30L814-30ZM799-73L816-73L836 0L821 0L817-18L798-18L793 0L779 0ZM848 0L848-73L863-73L863-13L894-13L894 0ZM969 0L969-73L983-73L983-13L1014-13L1014 0ZM1026-60L1026-73L1070-73L1070-60L1055-60L1055-13L1070-13L1070 0L1026 0L1026-13L1041-13L1041-60ZM1133-60L1102-60L1102-44L1130-44L1130-32L1102-32L1102 0L1087 0L1087-73L1133-73ZM1176 0L1161 0L1161-60L1143-60L1143-73L1194-73L1194-60L1176-60Z"],"police":[539.7,"M28 12Q24 12 21 12Q21 6 21 2Q21-2 21-8L27-8L27-8L80-8L80 12L73 12L73 5L27 5Q27 9 28 12ZM78-16Q78-14 78-12Q75-12 71-12L29-12Q26-12 22-12Q22-14 22-16Q26-16 29-16L71-16Q75-16 78-16ZM78-24Q78-22 78-20Q75-21 71-21L29-21Q26-21 22-20Q22-22 22-24Q26-24 29-24L71-24Q75-24 78-24ZM92-33Q92-30 92-28Q89-29 85-29L52-29L51-28L51-29L15-29Q11-29 7-28Q7-30 7-33Q11-32 15-32L47-32L44-35L49-40L56-33L56-32L85-32Q89-32 92-33ZM88-71Q92-71 96-71Q96-69 96-67L85-67Q83-58 78-51Q85-45 95-44Q92-41 92-38Q82-40 74-47Q66-40 56-38Q54-41 51-43Q64-44 70-51Q66-56 64-62Q61-57 56-52Q54-55 51-56Q56-61 59-67Q62-72 65-80Q68-79 71-78Q70-74 68-71ZM2-50Q9-56 13-68Q16-66 19-66Q19-68 19-71L12-71Q8-71 4-70Q5-72 4-74Q8-74 12-74L19-74Q19-77 19-79Q22-79 26-79Q26-77 25-74L36-74Q36-77 36-79Q39-79 42-79Q42-77 42-74L55-74Q54-72 55-70L42-71Q42-68 42-66Q39-66 36-66Q36-68 36-71L25-71Q26-68 26-66Q22-66 19-66Q19-64 18-62L51-62L51-44Q51-41 47-39Q44-36 35-36Q36-40 34-43L16-43L16-56L38-56L38-43L34-43Q39-43 44-43Q45-44 45-45L45-59L17-59Q13-53 7-46Q5-49 2-50ZM73-4L27-4L27 2L73 2ZM74-56Q77-61 78-67L68-67Q70-60 74-56ZM22-52L22-47L32-47L32-52ZM148-73L179-73Q193-73 201-67Q208-61 208-49Q208-38 201-31Q193-25 179-25L167-25L167 0L148 0ZM167-59L167-39L177-39Q183-39 186-42Q189-44 189-49Q189-54 186-57Q183-59 177-59ZM255-61Q246-61 241-54Q237-48 237-36Q237-25 241-19Q246-12 255-12Q263-12 268-19Q273-25 273-36Q273-48 268-54Q263-61 255-61ZM255-74Q272-74 282-64Q292-54 292-36Q292-19 282-9Q272 1 255 1Q237 1 227-9Q217-19 217-36Q217-54 227-64Q237-74 255-74ZM306-73L325-73L325-14L358-14L358 0L306 0ZM370-73L389-73L389 0L370 0ZM465-4Q460-1 454 0Q449 1 443 1Q424 1 414-9Q403-19 403-36Q403-54 414-64Q424-74 443-74Q449-74 454-73Q460-71 465-69L465-54Q460-57 455-59Q450-61 444-61Q434-61 428-54Q422-48 422-36Q422-25 428-19Q434-12 444-12Q450-12 455-14Q460-16 465-19ZM481-73L531-73L531-59L499-59L499-45L529-45L529-31L499-31L499-14L532-14L532 0L481 0Z"],"jiu":[104,"M41 12Q38 12 34 12Q34 5 34-2L34-56L51-56L51-70L41-70Q36-70 31-70Q32-73 31-75Q36-75 41-75L86-75Q91-75 96-75Q96-73 96-70Q91-70 86-70L73-70L73-56L90-56L90 12L84 12L84 4L41 4Q41 8 41 12ZM16 13Q12 11 7 10Q12 0 16-11Q20-21 26-39L30-37L20-3ZM15-36Q9-45 1-53L7-58Q15-49 21-40ZM26-61Q19-69 12-77L17-82Q25-74 32-65ZM66-51L58-51Q58-41 55-33Q51-26 45-22Q44-25 41-26L41-18L84-18L84-25L76-25Q72-25 69-27Q66-30 66-34ZM73-51L73-34Q73-32 74-31Q74-29 76-29L84-29L84-51ZM51-51L41-51L41-28Q52-34 51-51ZM84-13L41-13L41-1L84-1ZM66-56L66-70L58-70L58-56Z"],"ba":[104,"M53 11Q48 11 45 8Q42 5 42 0L42-78L90-78L90-33L83-33L83-36L49-36L49 0Q49 2 50 3Q51 4 53 4L86 4Q89 4 90-2L92-19Q95-16 99-17L96 3Q95 11 91 11ZM62-41L62-73L49-73L49-41ZM69-41L83-41L83-73L69-73ZM12-4L4-4L5-74L32-74L32-4L25-4L25-13L12-13ZM25-70L12-70L12-17L25-17Z"],"bar":[230.6,"M38-45Q43-45 45-47Q47-49 47-52Q47-56 45-58Q43-60 38-60L28-60L28-45ZM39-13Q45-13 48-15Q50-18 50-22Q50-27 48-30Q45-32 39-32L28-32L28-13ZM56-39Q63-37 66-33Q69-28 69-21Q69-10 62-5Q55 0 40 0L9 0L9-73L37-73Q53-73 59-68Q66-64 66-54Q66-48 64-45Q61-41 56-39ZM130-13L100-13L96 0L77 0L104-73L126-73L153 0L134 0ZM105-27L125-27L115-56ZM190-41Q195-41 198-43Q201-45 201-50Q201-55 198-57Q195-59 190-59L182-59L182-41ZM182-28L182 0L163 0L163-73L192-73Q206-73 213-68Q219-63 219-53Q219-46 216-41Q212-36 205-34Q209-33 212-30Q215-27 218-21L229 0L209 0L200-18Q197-24 194-26Q192-28 187-28Z"],"la":[104,"M97 3Q96 6 97 9Q91 8 86 8L47 8Q42 8 37 9Q37 6 37 3Q42 3 47 3L63 3Q73-14 75-28Q76-37 76-46Q80-45 84-46Q81-16 72 3L86 3Q91 3 97 3ZM55-46Q59-27 63-7L56-5Q52-25 48-45ZM94-59Q93-56 94-53Q88-54 83-54L55-54Q50-54 44-53Q45-56 44-59Q50-59 55-59L65-59Q61-68 55-77L62-81Q68-71 72-61L67-59L83-59Q88-59 94-59ZM0-28Q11-29 20-33L20-54L13-54Q8-54 2-53Q3-56 2-58Q8-58 13-58L20-58L20-67Q20-73 19-80Q23-80 27-80Q27-73 27-67L27-58L40-58Q39-56 40-53L27-54L27-35L38-40L38-36L27-31L27 2Q27 10 20 12Q14 14 8 14Q9 9 5 6Q9 6 13 6Q17 6 18 5Q20 4 20-1L20-28L15-25L4-20Q4-25 0-28Z"],"mian":[104,"M17 12Q13 12 9 12Q10 5 10-2L10-57L34-57Q38-62 43-72L12-72Q7-72 2-72Q2-75 2-78Q7-77 12-77L86-77Q91-77 96-78Q96-75 96-72Q91-72 86-72L50-72Q48-65 42-57L88-57L88 12L81 12L81 4L17 4Q17 8 17 12ZM64 0L81 0L81-52L64-52ZM57-39L57-52L39-52L39-39ZM57-20L57-34L39-34L39-20ZM57 0L57-15L39-15L39 0ZM32 0L32-52L16-52L16 0Z"],"ramen":[405.9,"M36-41Q42-41 44-43Q47-45 47-50Q47-55 44-57Q42-59 36-59L28-59L28-41ZM28-28L28 0L9 0L9-73L38-73Q52-73 59-68Q66-63 66-53Q66-46 62-41Q59-36 52-34Q56-33 59-30Q62-27 65-21L75 0L55 0L46-18Q43-24 41-26Q38-28 33-28ZM130-13L101-13L96 0L77 0L104-73L127-73L154 0L135 0ZM106-27L126-27L116-56ZM164-73L188-73L204-34L221-73L245-73L245 0L227 0L227-53L210-14L198-14L181-53L181 0L164 0ZM263-73L314-73L314-59L282-59L282-45L312-45L312-31L282-31L282-14L315-14L315 0L263 0ZM331-73L352-73L379-23L379-73L397-73L397 0L376 0L349-50L349 0L331 0Z"],"h24":[222.9,"M29-14L61-14L61 0L8 0L8-14L35-37Q38-41 40-44Q42-47 42-50Q42-55 38-58Q35-61 29-61Q25-61 19-59Q14-58 8-54L8-70Q14-72 21-73Q27-74 33-74Q46-74 53-68Q60-63 60-52Q60-46 57-41Q54-36 44-27ZM106-57L86-27L106-27ZM103-73L124-73L124-27L135-27L135-13L124-13L124 0L106 0L106-13L74-13L74-29ZM148-73L167-73L167-45L195-45L195-73L214-73L214 0L195 0L195-31L167-31L167 0L148 0Z"],"m1a":[400,"M77 12Q73 12 70 12Q70 5 70 -1L70 -14L62 -14Q58 -14 53 -14Q53 -16 53 -18Q58 -18 62 -18L70 -18L70 -33L64 -33Q60 -33 55 -33Q55 -35 55 -38Q60 -37 64 -37L70 -37L70 -53L62 -53Q58 -53 53 -53Q53 -55 53 -57Q58 -57 62 -57L70 -57L79 -73L84 -81Q87 -79 90 -77L85 -70L79 -61L77 -57L88 -57Q92 -57 97 -57Q96 -55 97 -53Q92 -53 88 -53L76 -53L76 -37L84 -37Q89 -37 93 -38Q93 -35 93 -33Q89 -33 84 -33L76 -33L76 -18L88 -18Q93 -18 97 -18Q97 -16 97 -14Q93 -14 88 -14L76 -14L76 -1Q76 5 77 12ZM64 -59Q59 -68 52 -77L58 -81Q65 -72 70 -62ZM7 9Q7 4 4 1Q12 1 21 -1Q30 -2 51 -7L51 -3Q30 2 22 5Q13 7 7 9ZM22 -79Q26 -78 29 -77Q28 -71 25 -64L42 -64L43 -59Q41 -58 41 -58L35 -48L49 -48Q47 -29 48 -10L13 -10Q14 -27 13 -44Q10 -40 7 -36Q4 -38 1 -39Q15 -55 22 -79ZM33 -32L42 -32L42 -43L33 -43ZM26 -32L26 -43L20 -43L20 -32ZM33 -28L33 -15L42 -15L42 -28ZM26 -28L20 -28L20 -15L26 -15ZM34 -60L23 -60Q20 -54 16 -48L29 -48L27 -48ZM196 0Q196 3 196 6Q191 6 185 6L116 6Q110 6 105 6Q106 3 105 0Q110 1 116 1L185 1Q191 1 196 0ZM138 -71L167 -71L168 -65Q166 -64 164 -63L156 -54L180 -54Q179 -32 180 -10L119 -10Q120 -21 120 -30Q120 -40 119 -48Q113 -42 107 -37Q105 -41 101 -43Q118 -54 125 -65Q131 -73 135 -81Q138 -79 142 -77ZM153 -35L173 -35L173 -49L153 -49ZM146 -35L146 -49L126 -49L126 -35ZM153 -30L153 -15L173 -15L173 -30ZM146 -30L126 -30L126 -15L146 -15ZM147 -54L147 -55L157 -65L134 -65Q129 -59 125 -54ZM296 1Q296 4 296 7Q291 7 285 7L212 7Q207 7 202 7Q202 4 202 1Q207 2 212 2L223 2L223 -59L244 -59L244 -67L216 -67Q210 -67 205 -67Q205 -70 205 -73Q210 -73 216 -73L244 -73Q244 -77 244 -82Q248 -82 252 -82Q251 -77 251 -73L283 -73Q288 -73 293 -73Q293 -70 293 -67Q288 -67 283 -67L251 -67L251 -59L275 -59L275 2L285 2Q291 2 296 1ZM268 -44L268 -54L229 -54Q229 -49 229 -44ZM268 -29L268 -38L229 -38L229 -29ZM268 -14L268 -23L229 -23L229 -14ZM268 2L268 -8L229 -8L230 2ZM357 9Q334 9 323 -3L307 8Q305 5 303 2L320 -7L320 -47L313 -47Q308 -47 303 -47Q304 -49 303 -52Q308 -52 313 -52L326 -52L326 -7Q334 -2 341 0Q346 1 357 1L394 2Q390 4 391 9ZM325 -65L319 -61L308 -75L314 -79ZM343 -34Q338 -34 333 -34Q333 -37 333 -40Q338 -39 343 -39L355 -39L355 -54L345 -54Q340 -54 335 -54Q335 -57 335 -59Q340 -59 345 -59L349 -59Q345 -68 340 -76L346 -80Q352 -71 356 -62L349 -59L360 -59Q366 -69 372 -81Q375 -79 379 -78Q375 -69 368 -59L376 -59Q381 -59 386 -59Q386 -57 386 -54Q381 -54 376 -54L365 -54Q364 -54 364 -54L362 -54L362 -39L379 -39Q384 -39 389 -40Q389 -37 389 -34Q384 -34 379 -34L362 -34Q361 -31 360 -28L363 -30L375 -20L387 -8L381 -3L370 -14L359 -24Q353 -10 339 -3Q338 -7 334 -9Q342 -12 348 -18Q354 -25 355 -34Z"],"m1b":[1280.7,"M9 -73L60 -73L60 -59L28 -59L28 -45L58 -45L58 -31L28 -31L28 0L9 0ZM104 -41Q110 -41 113 -43Q115 -45 115 -50Q115 -55 113 -57Q110 -59 104 -59L96 -59L96 -41ZM96 -28L96 0L77 0L77 -73L106 -73Q121 -73 127 -68Q134 -63 134 -53Q134 -46 131 -41Q127 -36 120 -34Q124 -33 127 -30Q130 -27 133 -21L143 0L123 0L114 -18Q112 -24 109 -26Q106 -28 102 -28ZM154 -73L205 -73L205 -59L173 -59L173 -45L203 -45L203 -31L173 -31L173 -14L206 -14L206 0L154 0ZM274 -71L274 -55Q268 -58 262 -59Q256 -61 251 -61Q244 -61 241 -59Q238 -57 238 -53Q238 -50 240 -48Q242 -47 248 -46L256 -44Q268 -42 273 -37Q278 -32 278 -22Q278 -10 271 -4Q264 1 249 1Q242 1 235 0Q228 -1 221 -4L221 -20Q228 -16 235 -14Q241 -12 248 -12Q254 -12 257 -14Q260 -16 260 -20Q260 -24 258 -25Q256 -27 249 -29L242 -30Q231 -33 226 -38Q221 -43 221 -52Q221 -62 228 -68Q235 -74 248 -74Q254 -74 260 -73Q267 -72 274 -71ZM295 -73L314 -73L314 -45L341 -45L341 -73L360 -73L360 0L341 0L341 -31L314 -31L314 0L295 0ZM413 -73L464 -73L464 -59L432 -59L432 -45L462 -45L462 -31L432 -31L432 0L413 0ZM482 -73L500 -73L500 0L482 0ZM570 -71L570 -55Q564 -58 558 -59Q552 -61 547 -61Q540 -61 537 -59Q534 -57 534 -53Q534 -50 536 -48Q538 -47 544 -46L552 -44Q564 -42 569 -37Q574 -32 574 -22Q574 -10 567 -4Q560 1 545 1Q538 1 531 0Q524 -1 517 -4L517 -20Q524 -16 531 -14Q538 -12 544 -12Q550 -12 553 -14Q556 -16 556 -20Q556 -24 554 -25Q552 -27 545 -29L538 -30Q527 -33 522 -38Q517 -43 517 -52Q517 -62 524 -68Q531 -74 544 -74Q550 -74 556 -73Q563 -72 570 -71ZM591 -73L610 -73L610 -45L637 -45L637 -73L656 -73L656 0L637 0L637 -31L610 -31L610 0L591 0ZM739 -45Q743 -45 745 -47Q748 -49 748 -52Q748 -56 745 -58Q743 -60 739 -60L728 -60L728 -45ZM739 -13Q745 -13 748 -15Q751 -18 751 -22Q751 -27 748 -30Q745 -32 739 -32L728 -32L728 -13ZM757 -39Q763 -37 766 -33Q769 -28 769 -21Q769 -10 762 -5Q755 0 741 0L709 0L709 -73L738 -73Q753 -73 760 -68Q766 -64 766 -54Q766 -48 764 -45Q761 -41 757 -39ZM775 -73L796 -73L813 -47L829 -73L850 -73L822 -31L822 0L803 0L803 -31ZM912 -59L912 -14L918 -14Q930 -14 936 -20Q942 -26 942 -37Q942 -47 936 -53Q930 -59 918 -59ZM893 -73L913 -73Q929 -73 937 -71Q946 -68 951 -62Q956 -58 959 -51Q961 -45 961 -37Q961 -28 959 -22Q956 -15 951 -10Q945 -5 937 -2Q929 0 913 0L893 0ZM1003 -41Q1008 -41 1011 -43Q1014 -45 1014 -50Q1014 -55 1011 -57Q1008 -59 1003 -59L995 -59L995 -41ZM995 -28L995 0L976 0L976 -73L1005 -73Q1019 -73 1026 -68Q1032 -63 1032 -53Q1032 -46 1029 -41Q1025 -36 1018 -34Q1022 -33 1025 -30Q1028 -27 1031 -21L1042 0L1022 0L1013 -18Q1010 -24 1007 -26Q1005 -28 1000 -28ZM1086 -61Q1078 -61 1073 -54Q1068 -48 1068 -36Q1068 -25 1073 -19Q1078 -12 1086 -12Q1095 -12 1100 -19Q1104 -25 1104 -36Q1104 -48 1100 -54Q1095 -61 1086 -61ZM1086 -74Q1104 -74 1114 -64Q1124 -54 1124 -36Q1124 -19 1114 -9Q1104 1 1086 1Q1069 1 1059 -9Q1049 -19 1049 -36Q1049 -54 1059 -64Q1069 -74 1086 -74ZM1138 -73L1159 -73L1185 -23L1185 -73L1203 -73L1203 0L1182 0L1156 -50L1156 0L1138 0ZM1222 -73L1272 -73L1272 -59L1240 -59L1240 -45L1270 -45L1270 -31L1240 -31L1240 -14L1273 -14L1273 0L1222 0Z"],"m1c":[621.4,"M57 9Q34 9 23 -3L7 8Q5 5 3 2L20 -7L20 -47L13 -47Q8 -47 3 -47Q4 -49 3 -52Q8 -52 13 -52L26 -52L26 -7Q34 -2 41 0Q46 1 57 1L94 2Q90 4 91 9ZM25 -65L19 -61L8 -75L14 -79ZM43 -34Q38 -34 33 -34Q33 -37 33 -40Q38 -39 43 -39L55 -39L55 -54L45 -54Q40 -54 35 -54Q35 -57 35 -59Q40 -59 45 -59L49 -59Q45 -68 40 -76L46 -80Q52 -71 56 -62L49 -59L60 -59Q66 -69 72 -81Q75 -79 79 -78Q75 -69 68 -59L76 -59Q81 -59 86 -59Q86 -57 86 -54Q81 -54 76 -54L65 -54Q64 -54 64 -54L62 -54L62 -39L79 -39Q84 -39 89 -40Q89 -37 89 -34Q84 -34 79 -34L62 -34Q61 -31 60 -28L63 -30L75 -20L87 -8L81 -3L70 -14L59 -24Q53 -10 39 -3Q38 -7 34 -9Q42 -12 48 -18Q54 -25 55 -34ZM157 10Q134 10 122 -1L110 9Q108 6 105 3L120 -6L120 -37L113 -37Q107 -37 102 -37Q102 -40 102 -43Q107 -43 113 -43L127 -43L127 -5Q134 0 139 1Q145 2 157 2L194 3Q190 5 191 10ZM125 -60Q119 -68 112 -75L117 -81Q125 -73 131 -65ZM157 -44L157 -51L143 -51Q137 -51 131 -50Q132 -53 131 -57Q137 -56 143 -56L157 -56L157 -68Q157 -75 156 -82Q160 -82 164 -82Q164 -75 164 -68L164 -56L182 -56Q188 -56 194 -57Q193 -53 194 -50Q188 -51 182 -51L164 -51L164 -42L165 -43L179 -28L192 -13L186 -8L173 -23L163 -34Q160 -23 153 -15Q146 -7 135 -3Q134 -8 130 -9Q142 -12 149 -22Q157 -32 157 -44ZM269 -13L286 -13L286 -60L271 -56L271 -69L286 -73L300 -73L300 -13L316 -13L316 0L269 0ZM330 -73L369 -73L369 -60L342 -60L342 -47Q343 -47 345 -48Q347 -48 350 -48Q360 -48 367 -41Q374 -34 374 -23Q374 -12 367 -5Q359 1 347 1Q342 1 337 1Q332 0 327 -2L327 -15Q331 -13 336 -12Q340 -11 344 -11Q352 -11 356 -14Q360 -17 360 -23Q360 -29 356 -33Q352 -36 345 -36Q342 -36 338 -35Q334 -34 330 -32ZM445 -73L462 -73L471 -41L480 -73L497 -73L497 0L484 0L484 -58L477 -27L465 -27L457 -58L457 0L445 0ZM509 -60L509 -73L553 -73L553 -60L538 -60L538 -13L553 -13L553 0L509 0L509 -13L524 -13L524 -60ZM567 -73L583 -73L603 -20L603 -73L616 -73L616 0L600 0L580 -53L580 0L567 0Z"],"m2a":[400,"M72 12Q69 12 65 12Q65 5 65 -1L65 -24L51 -24L52 -7Q52 -1 52 6Q48 6 45 6Q45 -1 45 -7L45 -28L65 -28L65 -37L49 -37Q50 -53 49 -69L59 -69Q61 -72 62 -75Q63 -77 65 -79Q68 -78 71 -77Q69 -72 67 -69L90 -69Q89 -53 90 -37L72 -37L72 -28L95 -28L95 -2Q95 1 92 3Q88 7 80 7Q81 2 78 -1Q83 -1 87 -1Q88 -2 88 -3L88 -24L72 -24L72 -1Q72 5 72 12ZM55 -65L55 -55L84 -55L84 -65ZM55 -51L55 -41L84 -41L84 -51ZM16 -79Q20 -78 24 -77Q23 -71 21 -64L33 -64Q38 -64 43 -64Q42 -62 43 -59Q38 -60 33 -60L19 -60Q17 -53 15 -47L31 -47Q35 -47 40 -48Q40 -45 40 -43Q35 -43 31 -43L25 -43L25 -30L34 -30Q38 -30 43 -31Q43 -28 43 -26Q38 -26 34 -26L25 -26L25 -5L39 -17L42 -14Q40 -12 38 -11Q30 -2 22 8L17 3Q19 1 19 -2L19 -26L13 -26Q8 -26 4 -26Q4 -28 4 -31Q8 -30 13 -30L19 -30L19 -43L13 -43Q10 -37 7 -32Q4 -34 0 -34Q3 -40 7 -47Q14 -61 16 -79ZM197 6Q196 8 197 10Q192 10 188 10L150 10Q146 10 142 10Q142 8 142 6Q146 6 150 6L167 6L167 -12L158 -12Q153 -12 149 -12Q149 -14 149 -16Q153 -16 158 -16L167 -16L167 -30L156 -30Q156 -28 156 -25Q153 -26 149 -25Q149 -32 149 -38L149 -72L190 -72L190 -27L184 -27L184 -30L173 -30L173 -16L183 -16Q187 -16 191 -16Q191 -14 191 -12Q187 -12 183 -12L173 -12L173 6L188 6Q192 6 197 6ZM173 -34L184 -34L184 -49L173 -49ZM167 -34L167 -49L156 -49L156 -34ZM173 -53L184 -53L184 -68L173 -68ZM167 -53L167 -68L156 -68L156 -53ZM105 9Q105 4 104 1Q109 1 117 -1Q124 -2 141 -7L141 -3Q124 2 118 5Q111 7 105 9ZM118 -79Q121 -78 124 -77Q122 -71 120 -64L134 -64L134 -59Q133 -58 133 -58L128 -48L139 -48Q138 -29 139 -10L110 -10Q111 -27 110 -44Q108 -40 105 -36Q104 -38 101 -39Q112 -55 118 -79ZM127 -32L134 -32L134 -43L127 -43ZM121 -32L121 -43L116 -43L116 -32ZM127 -28L127 -15L134 -15L134 -28ZM121 -28L116 -28L116 -15L121 -15ZM127 -60L118 -60Q116 -54 113 -48L123 -48L122 -48ZM279 0L279 -43L267 -43Q267 -45 267 -48Q272 -48 276 -48L287 -48Q292 -48 296 -48Q296 -45 296 -43L285 -43L285 3Q285 8 281 10Q278 13 268 13Q269 8 266 5Q269 5 273 5Q277 5 278 4Q279 4 279 0ZM295 -69Q294 -67 295 -64Q290 -64 285 -64L277 -64Q273 -64 268 -64Q268 -67 268 -69Q273 -69 277 -69L285 -69Q290 -69 295 -69ZM246 -23L232 -23Q233 -25 232 -28L246 -27L246 -41L241 -41Q236 -41 231 -41Q232 -43 231 -46Q236 -45 241 -45L246 -45L246 -59L234 -59Q234 -61 234 -64L246 -63L246 -67Q246 -74 245 -81Q249 -80 253 -81Q252 -74 252 -67L252 -63L265 -64Q264 -61 265 -59L252 -59L252 -45L257 -45Q261 -45 266 -46Q266 -43 266 -41Q261 -41 257 -41L252 -41L252 -27L265 -28Q265 -25 265 -23L252 -23L252 -8Q257 -9 267 -11L267 -7Q243 -2 230 2Q231 -2 229 -6Q237 -6 246 -7ZM224 -57Q226 -55 229 -53Q225 -46 220 -39L220 0Q220 7 221 13Q217 13 214 13Q214 7 214 0L214 -31L205 -20Q204 -22 200 -24Q210 -33 218 -47ZM221 -80Q224 -78 227 -76Q222 -64 213 -55Q209 -52 206 -49Q205 -52 202 -54Q210 -60 216 -70Q219 -75 221 -80ZM393 12L381 12Q374 11 371 6Q370 4 370 0Q370 -4 370 -35Q370 -65 370 -70L355 -70L355 -34Q355 -4 336 11Q334 7 329 6Q348 -5 348 -34L348 -75L377 -75L377 0Q377 6 381 6L388 6Q389 6 389 5Q390 3 390 0L391 -14Q394 -11 397 -11L395 9Q395 10 394 11Q394 12 393 12ZM308 -11Q305 -12 300 -12Q307 -24 313 -40L319 -54L304 -53Q304 -56 304 -58L319 -58L319 -69Q319 -75 319 -82Q323 -81 327 -82Q327 -75 327 -69L327 -58L341 -58Q340 -56 341 -53L327 -54L327 -43L330 -45L340 -33L333 -29L327 -37L327 -2Q327 4 327 11Q323 10 319 11Q319 4 319 -2L319 -34Q317 -28 313 -21Z"],"m2b":[691,"M9 -73L28 -73L28 -46L55 -73L77 -73L42 -38L81 0L57 0L28 -29L28 0L9 0ZM120 -61Q111 -61 107 -54Q102 -48 102 -36Q102 -25 107 -19Q111 -12 120 -12Q129 -12 133 -19Q138 -25 138 -36Q138 -48 133 -54Q129 -61 120 -61ZM120 -74Q138 -74 148 -64Q157 -54 157 -36Q157 -19 148 -9Q138 1 120 1Q102 1 92 -9Q82 -19 82 -36Q82 -54 92 -64Q102 -74 120 -74ZM172 -73L190 -73L190 0L172 0ZM288 -13L259 -13L254 0L235 0L262 -73L284 -73L311 0L293 0ZM263 -27L283 -27L273 -56ZM348 -41Q354 -41 356 -43Q359 -45 359 -50Q359 -55 356 -57Q354 -59 348 -59L340 -59L340 -41ZM340 -28L340 0L321 0L321 -73L350 -73Q364 -73 371 -68Q378 -63 378 -53Q378 -46 374 -41Q371 -36 364 -34Q367 -33 371 -30Q374 -27 377 -21L387 0L367 0L358 -18Q355 -24 353 -26Q350 -28 345 -28ZM456 -4Q451 -1 445 0Q440 1 433 1Q415 1 405 -9Q394 -19 394 -36Q394 -54 405 -64Q415 -74 433 -74Q440 -74 445 -73Q451 -71 456 -69L456 -54Q451 -57 446 -59Q441 -61 435 -61Q425 -61 419 -54Q413 -48 413 -36Q413 -25 419 -19Q425 -12 435 -12Q441 -12 446 -14Q451 -16 456 -19ZM516 -13L486 -13L482 0L463 0L490 -73L512 -73L539 0L520 0ZM491 -27L511 -27L501 -56ZM568 -59L568 -14L574 -14Q586 -14 592 -20Q598 -26 598 -37Q598 -47 592 -53Q586 -59 574 -59ZM549 -73L569 -73Q585 -73 593 -71Q602 -68 607 -62Q613 -58 615 -51Q617 -45 617 -37Q617 -28 615 -22Q613 -15 607 -10Q602 -5 593 -2Q585 0 569 0L549 0ZM632 -73L683 -73L683 -59L651 -59L651 -45L681 -45L681 -31L651 -31L651 -14L684 -14L684 0L632 0Z"],"m2c":[922.5,"M46 -34Q46 -37 46 -40Q51 -39 57 -39L84 -39Q82 -22 70 -8Q80 0 96 3Q93 5 92 10Q77 7 66 -3Q53 8 37 10Q35 6 32 3Q40 3 47 0Q55 -3 61 -8Q52 -19 47 -34Q47 -34 46 -34ZM48 -77L80 -77L79 -55Q79 -53 80 -53L84 -53Q89 -53 95 -54Q94 -51 95 -48L80 -48Q77 -48 75 -50Q73 -52 73 -55L73 -72L55 -72L55 -64Q55 -56 52 -49Q49 -42 43 -38Q41 -41 37 -43Q42 -45 45 -51Q48 -56 48 -63ZM75 -34L54 -34Q58 -21 65 -13Q73 -22 75 -34ZM0 -33Q10 -34 19 -38L19 -56L12 -56Q6 -56 1 -55Q1 -59 1 -62Q6 -62 12 -62L19 -62L19 -66Q19 -74 18 -81Q22 -80 26 -81Q26 -74 26 -66L26 -62L30 -62Q36 -62 42 -62Q41 -59 42 -55Q36 -56 30 -56L26 -56L26 -40Q33 -43 41 -46L42 -41L26 -35L26 1Q26 11 18 13Q14 14 9 14Q9 9 6 5Q9 6 13 6Q17 6 18 5Q19 4 19 -1L19 -32L15 -30Q9 -27 3 -24Q2 -29 0 -33ZM156 12Q152 12 148 12Q148 5 148 -3L148 -50L123 -50L123 -17Q123 -9 123 -2Q119 -2 115 -2Q115 -9 115 -17L115 -56L148 -56L148 -72L106 -69L103 -76Q105 -76 109 -76Q124 -75 151 -78Q177 -81 192 -83Q192 -79 193 -75L155 -72L155 -56L189 -56L189 -12Q189 -5 184 -3Q179 -1 173 -1Q174 -6 171 -10Q173 -10 177 -10Q181 -9 181 -10Q182 -11 182 -14L182 -50L155 -50L155 -3Q155 5 156 12ZM269 -60L269 -73L312 -73L312 -60L298 -60L298 -13L312 -13L312 0L269 0L269 -13L283 -13L283 -60ZM326 -73L342 -73L362 -20L362 -73L375 -73L375 0L359 0L339 -53L339 0L326 0ZM406 -32Q395 -36 391 -41Q387 -45 387 -53Q387 -63 393 -69Q400 -74 411 -74Q416 -74 421 -73Q426 -72 431 -70L431 -56Q426 -59 421 -61Q417 -62 412 -62Q407 -62 404 -60Q401 -58 401 -54Q401 -51 403 -49Q405 -47 412 -45L418 -42Q427 -39 431 -34Q435 -29 435 -21Q435 -9 428 -4Q422 1 409 1Q403 1 398 0Q392 -1 387 -4L387 -19Q393 -14 398 -12Q404 -10 409 -10Q414 -10 417 -13Q420 -15 420 -20Q420 -23 418 -25Q416 -28 413 -29ZM494 0L449 0L449 -73L494 -73L494 -60L463 -60L463 -44L492 -44L492 -32L463 -32L463 -13L494 -13ZM540 -34Q543 -34 544 -32Q546 -31 548 -26L561 0L545 0L537 -18Q536 -19 536 -21Q532 -29 527 -29L522 -29L522 0L508 0L508 -73L528 -73Q542 -73 549 -68Q555 -63 555 -52Q555 -44 551 -40Q547 -35 540 -34ZM522 -61L522 -41L529 -41Q535 -41 537 -43Q540 -46 540 -51Q540 -56 537 -58Q535 -61 529 -61ZM599 0L584 0L584 -60L566 -60L566 -73L617 -73L617 -60L599 -60ZM734 -2Q731 0 727 1Q723 1 719 1Q705 1 697 -8Q689 -18 689 -36Q689 -55 697 -64Q705 -74 719 -74Q723 -74 727 -73Q731 -72 734 -71L734 -55Q731 -58 727 -60Q724 -61 720 -61Q712 -61 708 -55Q704 -49 704 -36Q704 -24 708 -18Q712 -12 720 -12Q724 -12 727 -13Q731 -15 734 -18ZM772 -61Q766 -61 764 -55Q761 -50 761 -36Q761 -23 764 -17Q766 -12 772 -12Q777 -12 780 -17Q783 -23 783 -36Q783 -50 780 -55Q777 -61 772 -61ZM746 -36Q746 -55 753 -65Q759 -74 772 -74Q785 -74 791 -65Q798 -55 798 -36Q798 -18 791 -8Q785 1 772 1Q759 1 753 -8Q746 -18 746 -36ZM810 -60L810 -73L854 -73L854 -60L839 -60L839 -13L854 -13L854 0L810 0L810 -13L825 -13L825 -60ZM868 -73L884 -73L904 -20L904 -73L917 -73L917 0L901 0L881 -53L881 0L868 0Z"],"m3a":[469.6,"M85 -42Q88 -41 92 -40Q91 -37 90 -34L73 4L85 0L87 -1Q85 -7 82 -12L89 -15Q94 -4 97 8L90 10Q89 6 88 3Q84 4 76 7Q68 10 66 11L64 8L60 8Q59 5 58 2Q54 3 46 5Q39 8 36 9L35 4Q36 4 37 2Q41 -6 48 -23L36 -23L36 -27Q37 -27 38 -28Q40 -32 44 -41Q47 -51 48 -55Q51 -54 55 -54Q55 -51 52 -44Q49 -38 46 -33Q44 -28 44 -27L50 -27Q54 -37 55 -43Q58 -41 62 -40Q61 -36 56 -25L44 2L56 -2L57 -2Q56 -8 54 -13L60 -16Q64 -6 66 5Q70 -3 78 -22L64 -21L64 -26Q66 -26 66 -27Q69 -31 73 -41Q77 -50 77 -55Q81 -54 84 -54Q84 -51 81 -44Q78 -37 75 -32Q73 -27 72 -26L79 -26Q83 -36 85 -42ZM96 -61Q96 -58 96 -56Q92 -56 88 -56L73 -56L73 -56Q72 -56 72 -56L46 -56Q41 -56 37 -56Q37 -58 37 -61Q41 -60 46 -60L53 -60Q49 -69 44 -77L50 -80Q55 -72 60 -63L54 -60L68 -60Q73 -67 76 -80Q79 -79 83 -79Q81 -70 75 -60L88 -60Q92 -60 96 -61ZM6 -17Q4 -19 0 -19Q10 -43 16 -67L11 -67Q7 -67 3 -67Q3 -69 3 -72Q7 -72 11 -72L28 -72Q32 -72 36 -72Q36 -69 36 -67Q32 -67 28 -67L23 -67L15 -43L33 -43L33 5L27 5L27 -2L18 -2Q18 1 18 5Q15 5 12 5Q12 -1 12 -8L12 -34L10 -27Q8 -22 6 -17ZM27 -39L18 -39L18 -7L27 -7ZM196 -22Q196 -19 196 -17Q192 -17 187 -17L167 -17L167 3Q167 7 164 9Q160 13 150 13Q151 8 147 4Q150 5 155 5Q159 5 160 4Q160 4 160 1L160 -17L141 -17Q136 -17 131 -17Q131 -19 131 -22Q136 -22 141 -22L160 -22L160 -33L172 -40L147 -40Q142 -40 137 -40Q137 -42 137 -45Q142 -45 147 -45L185 -45L186 -39Q183 -39 181 -37L167 -29L167 -22L187 -22Q192 -22 196 -22ZM186 -71Q189 -69 192 -67Q186 -58 177 -48Q175 -51 171 -52Q179 -60 186 -71ZM170 -58L165 -52L152 -66L157 -71ZM151 -53L146 -48L133 -61L138 -66ZM187 -75Q163 -73 137 -70L133 -77Q147 -76 161 -78Q169 -79 175 -80Q182 -82 186 -83Q186 -79 187 -75ZM114 12Q110 9 104 9Q108 1 113 -9Q117 -19 125 -44L129 -42L118 -5ZM121 -45L115 -40L102 -53L107 -58ZM123 -61Q116 -69 109 -75L114 -80Q122 -73 129 -65ZM207 -73L262 -73L262 -62L233 0L215 0L242 -59L207 -59ZM283 -37Q277 -37 271 -36Q272 -39 271 -43Q277 -42 283 -42L354 -42Q360 -42 365 -43Q365 -39 365 -36Q360 -37 354 -37L308 -37L305 -26L350 -26L347 4Q347 7 344 9Q341 11 338 12Q334 13 326 13Q328 8 324 4Q327 5 333 5Q339 4 339 4Q340 3 340 2L342 -20L295 -20L301 -37ZM291 -49Q292 -64 291 -78L345 -78Q344 -64 345 -49ZM298 -72L298 -55L338 -55L338 -72ZM453 -69L448 -64L437 -74L443 -80ZM425 -58L425 -82Q428 -82 432 -82L432 -59L445 -61Q450 -62 456 -62Q456 -60 456 -57Q451 -56 446 -56L432 -54Q432 -47 432 -42L449 -44Q454 -45 459 -46Q460 -43 460 -40Q455 -39 450 -39L433 -37Q435 -27 438 -20Q444 -26 447 -31Q450 -29 454 -27Q448 -19 442 -13Q448 -3 457 3Q458 -6 458 -14Q461 -12 465 -12Q466 -2 464 9Q464 10 463 11Q461 13 459 12Q445 5 437 -8Q420 7 399 11Q399 7 397 3Q410 1 421 -5Q428 -9 433 -14Q428 -24 426 -36L417 -34Q412 -34 407 -33Q407 -36 406 -38Q412 -39 417 -39L426 -41Q425 -46 425 -53L422 -52Q416 -52 411 -51Q411 -53 411 -56Q416 -57 421 -57ZM374 4Q374 -1 371 -4Q378 -5 386 -6Q393 -7 411 -12L412 -7Q394 -3 387 0Q380 2 374 4ZM392 -80Q396 -78 400 -77Q397 -71 391 -62L382 -50L393 -50L396 -51Q399 -56 402 -61Q405 -59 410 -57Q408 -55 406 -52Q404 -49 396 -38Q388 -28 385 -25L403 -27L410 -28L409 -22L404 -22L373 -18L372 -23Q375 -23 376 -25Q383 -33 392 -46L371 -43L371 -48Q373 -48 374 -50Q383 -62 390 -76Q391 -78 392 -80Z"],"m3b":[860.5,"M9 -73L33 -73L50 -34L66 -73L90 -73L90 0L73 0L73 -53L56 -14L44 -14L27 -53L27 0L9 0ZM153 -13L124 -13L119 0L100 0L127 -73L149 -73L176 0L158 0ZM128 -27L148 -27L138 -56ZM252 -5Q245 -2 237 0Q229 1 221 1Q203 1 193 -9Q182 -19 182 -36Q182 -54 193 -64Q204 -74 222 -74Q230 -74 236 -73Q243 -71 249 -69L249 -54Q243 -57 237 -59Q231 -61 225 -61Q213 -61 207 -54Q201 -48 201 -36Q201 -25 207 -19Q213 -12 224 -12Q227 -12 229 -13Q232 -13 234 -14L234 -28L222 -28L222 -40L252 -40ZM268 -73L287 -73L287 -14L320 -14L320 0L268 0ZM332 -73L383 -73L383 -59L351 -59L351 -45L381 -45L381 -31L351 -31L351 -14L384 -14L384 0L332 0ZM392 -73L410 -73L430 -19L449 -73L468 -73L441 0L419 0ZM512 -73L531 -73L531 -14L564 -14L564 0L512 0ZM576 -73L595 -73L595 0L576 0ZM613 -73L634 -73L661 -23L661 -73L679 -73L679 0L658 0L631 -50L631 0L613 0ZM697 -73L748 -73L748 -59L716 -59L716 -45L746 -45L746 -31L716 -31L716 -14L749 -14L749 0L697 0ZM798 -73L853 -73L853 -62L824 0L806 0L833 -59L798 -59Z"],"m3c":[962.3,"M50 -3Q50 5 50 12Q46 12 42 12Q43 5 43 -3L43 -69L15 -69Q8 -69 2 -68Q2 -72 2 -75Q8 -75 15 -75L83 -75Q89 -75 96 -75Q96 -72 96 -68Q89 -69 83 -69L50 -69L50 -49L52 -52L68 -42L84 -30L79 -24L63 -35L50 -44ZM194 -42Q194 -38 194 -34Q187 -35 179 -35L119 -35Q112 -35 105 -34Q105 -38 105 -42Q112 -42 119 -42L179 -42Q187 -42 194 -42ZM296 -4Q296 -2 296 1Q291 1 287 1L262 1Q257 1 252 1Q252 -2 252 -4Q257 -4 262 -4L270 -4L270 -36L258 -36Q258 -38 258 -41L270 -41L270 -68L266 -68Q261 -68 256 -68Q256 -71 256 -73Q261 -73 266 -73L283 -73Q288 -73 293 -73Q293 -71 293 -68Q288 -68 283 -68L277 -68L277 -41L282 -41Q287 -41 292 -41Q292 -38 292 -36Q287 -36 282 -36L277 -36L277 -4L287 -4Q291 -4 296 -4ZM247 -30L247 -69Q247 -75 247 -82Q250 -82 254 -82Q254 -75 254 -69L254 -30Q254 -15 247 -4Q239 7 228 12Q226 8 222 7Q233 3 240 -6Q247 -16 247 -30ZM232 -30Q236 -42 238 -54L246 -53Q243 -40 239 -28ZM200 -9Q208 -10 215 -12L215 -41L202 -40Q202 -43 202 -45L215 -45L215 -70L210 -70Q205 -70 201 -70Q201 -72 201 -75Q205 -74 210 -74L226 -74Q231 -74 235 -75Q235 -72 235 -70Q231 -70 226 -70L222 -70L222 -45L234 -45Q233 -43 234 -40L222 -41L222 -14Q228 -15 235 -18L236 -14Q221 -9 214 -6Q208 -4 203 -1Q202 -6 200 -9ZM366 -73L381 -73L402 -20L402 -73L415 -73L415 0L399 0L379 -53L379 0L366 0ZM474 0L429 0L429 -73L474 -73L474 -60L443 -60L443 -44L471 -44L471 -32L443 -32L443 -13L474 -13ZM540 0L525 0L511 -24L497 0L482 0L503 -37L483 -73L497 -73L511 -50L524 -73L539 -73L518 -37ZM578 0L564 0L564 -60L545 -60L545 -73L597 -73L597 -60L578 -60ZM682 -13L713 -13L713 0L667 0L667 -12L675 -21Q689 -35 692 -39Q695 -43 697 -46Q698 -50 698 -53Q698 -58 695 -60Q693 -63 687 -63Q683 -63 678 -61Q674 -60 668 -57L668 -70Q674 -72 679 -73Q684 -74 688 -74Q700 -74 706 -69Q713 -63 713 -54Q713 -50 712 -46Q710 -42 707 -38Q704 -34 692 -23Q686 -16 682 -13ZM786 -73L803 -73L812 -41L820 -73L838 -73L838 0L825 0L825 -58L818 -27L806 -27L798 -58L798 0L786 0ZM850 -60L850 -73L894 -73L894 -60L879 -60L879 -13L894 -13L894 0L850 0L850 -13L865 -13L865 -60ZM908 -73L923 -73L944 -20L944 -73L956 -73L956 0L941 0L921 -53L921 0L908 0Z"],"m4a":[400,"M19 -34L45 -34L45 -55L14 -55Q8 -55 2 -55Q2 -58 2 -61Q8 -61 14 -61L45 -61L45 -68Q45 -75 45 -82Q49 -82 53 -82Q52 -75 52 -68L52 -61L84 -61Q90 -61 96 -61Q96 -58 96 -55Q90 -55 84 -55L52 -55L52 -34L78 -34L78 12L71 12L71 4L27 4Q27 8 27 12Q23 12 19 12Q20 5 20 -3ZM71 -2L71 -28L27 -28L27 -2ZM133 -45L157 -45L157 -49Q157 -56 156 -63Q160 -62 164 -63Q164 -56 164 -49L164 -45L188 -45Q187 -20 188 5L133 5Q134 -8 134 -20Q134 -32 133 -45ZM117 -72L150 -72L143 -80L149 -85L159 -73L158 -72L185 -72Q191 -72 196 -72Q196 -69 196 -66Q191 -67 185 -67L124 -67L123 -29Q123 -4 110 9Q107 6 103 5Q117 -5 117 -29ZM164 -23L181 -23L181 -40L164 -40ZM157 -23L157 -40L140 -40L140 -23ZM164 -18L164 0L181 0L181 -18ZM157 -18L140 -18L140 0L157 0ZM282 12Q278 12 274 12Q275 5 275 -2L275 -46L256 -46L256 -27Q256 -14 252 -4Q247 6 237 12Q235 8 231 7Q240 3 245 -6Q250 -14 250 -27L250 -74L256 -74L256 -74Q262 -74 272 -77Q283 -80 288 -83Q288 -79 290 -76L286 -75Q268 -70 256 -68L256 -51L286 -51Q291 -51 296 -51Q296 -48 296 -45Q291 -46 286 -46L281 -46L281 -2Q281 5 282 12ZM227 -32L227 -1Q227 6 227 13Q224 13 220 13Q221 6 221 -1L221 -28Q215 -20 207 -14Q205 -16 201 -18Q218 -32 228 -54L214 -54Q209 -54 203 -54Q204 -57 203 -60Q209 -60 214 -60L237 -60Q234 -50 229 -41Q236 -33 242 -24L237 -19Q232 -26 227 -32ZM222 -61Q219 -71 215 -79L221 -83Q225 -74 228 -64ZM350 12Q346 12 342 12Q343 6 343 -1L343 -33L393 -33L393 12L387 12L387 4L349 4Q349 8 350 12ZM348 -41Q349 -52 348 -62L387 -62Q386 -52 387 -41ZM395 -76Q395 -73 395 -71Q390 -71 386 -71L350 -71Q346 -71 341 -71Q342 -73 341 -76Q346 -75 350 -75L386 -75Q390 -75 395 -76ZM371 0L387 0L387 -12L371 -12ZM364 0L364 -12L349 -12L349 0ZM371 -16L387 -16L387 -29L371 -29ZM364 -16L364 -29L349 -29L349 -16ZM355 -58L355 -46L381 -46L381 -58ZM326 -32L326 -1Q326 6 326 13Q322 13 319 13Q319 6 319 -1L319 -28Q314 -21 307 -16Q304 -19 300 -20Q319 -33 329 -55L314 -55Q309 -55 304 -54Q305 -57 304 -60Q309 -60 314 -60L338 -60Q334 -49 328 -39L329 -40L340 -27L334 -22ZM323 -63Q318 -71 313 -78L318 -83Q324 -75 330 -67Z"],"m4b":[1479.8,"M42 -61Q34 -61 29 -54Q24 -48 24 -36Q24 -25 29 -19Q34 -12 42 -12Q51 -12 56 -19Q61 -25 61 -36Q61 -48 56 -54Q51 -61 42 -61ZM42 -74Q60 -74 70 -64Q80 -54 80 -36Q80 -19 70 -9Q60 1 42 1Q25 1 15 -9Q5 -19 5 -36Q5 -54 15 -64Q25 -74 42 -74ZM94 -73L113 -73L113 -14L146 -14L146 0L94 0ZM177 -59L177 -14L183 -14Q195 -14 201 -20Q207 -26 207 -37Q207 -47 201 -53Q195 -59 183 -59ZM158 -73L178 -73Q194 -73 202 -71Q211 -68 216 -62Q222 -58 224 -51Q227 -45 227 -37Q227 -28 224 -22Q222 -15 216 -10Q211 -5 202 -2Q194 0 178 0L158 0ZM267 -73L334 -73L334 -59L310 -59L310 0L291 0L291 -59L267 -59ZM344 -73L395 -73L395 -59L363 -59L363 -45L393 -45L393 -31L363 -31L363 -14L396 -14L396 0L344 0ZM412 -73L436 -73L453 -34L469 -73L493 -73L493 0L476 0L476 -53L459 -14L447 -14L430 -53L430 0L412 0ZM512 -73L543 -73Q557 -73 564 -67Q572 -61 572 -49Q572 -38 564 -31Q557 -25 543 -25L531 -25L531 0L512 0ZM531 -59L531 -39L541 -39Q546 -39 549 -42Q552 -44 552 -49Q552 -54 549 -57Q546 -59 541 -59ZM585 -73L604 -73L604 -14L637 -14L637 0L585 0ZM649 -73L700 -73L700 -59L668 -59L668 -45L698 -45L698 -31L668 -31L668 -14L701 -14L701 0L649 0ZM753 -44L771 -44L771 -25L753 -25ZM825 -73L844 -73L844 -14L877 -14L877 0L825 0ZM888 -73L907 -73L907 -29Q907 -20 910 -16Q913 -12 920 -12Q927 -12 930 -16Q932 -20 932 -29L932 -73L951 -73L951 -29Q951 -14 944 -6Q936 1 920 1Q904 1 896 -6Q888 -14 888 -29ZM1027 -4Q1022 -1 1017 0Q1011 1 1005 1Q987 1 976 -9Q965 -19 965 -36Q965 -54 976 -64Q987 -74 1005 -74Q1011 -74 1017 -73Q1022 -71 1027 -69L1027 -54Q1022 -57 1017 -59Q1012 -61 1006 -61Q996 -61 991 -54Q985 -48 985 -36Q985 -25 991 -19Q996 -12 1006 -12Q1012 -12 1017 -14Q1022 -16 1027 -19ZM1043 -73L1062 -73L1062 -46L1089 -73L1111 -73L1076 -38L1114 0L1091 0L1062 -29L1062 0L1043 0ZM1110 -73L1131 -73L1148 -47L1164 -73L1185 -73L1157 -31L1157 0L1138 0L1138 -31ZM1228 -73L1278 -73L1278 -59L1247 -59L1247 -45L1277 -45L1277 -31L1247 -31L1247 0L1228 0ZM1296 -73L1315 -73L1315 0L1296 0ZM1384 -71L1384 -55Q1378 -58 1372 -59Q1367 -61 1361 -61Q1355 -61 1352 -59Q1348 -57 1348 -53Q1348 -50 1350 -48Q1353 -47 1358 -46L1366 -44Q1379 -42 1384 -37Q1389 -32 1389 -22Q1389 -10 1382 -4Q1374 1 1360 1Q1353 1 1346 0Q1339 -1 1332 -4L1332 -20Q1339 -16 1345 -14Q1352 -12 1358 -12Q1364 -12 1367 -14Q1371 -16 1371 -20Q1371 -24 1368 -25Q1366 -27 1360 -29L1352 -30Q1341 -33 1336 -38Q1331 -43 1331 -52Q1331 -62 1338 -68Q1345 -74 1359 -74Q1365 -74 1371 -73Q1377 -72 1384 -71ZM1405 -73L1424 -73L1424 -45L1452 -45L1452 -73L1471 -73L1471 0L1452 0L1452 -31L1424 -31L1424 0L1405 0Z"],"m4c":[802.1,"M69 12Q65 12 61 12Q62 5 62 -2L62 -27L47 -27Q42 -27 36 -26Q36 -29 36 -32Q42 -32 47 -32L62 -32L62 -55L49 -55Q43 -43 36 -34Q33 -37 28 -38Q37 -49 42 -58Q47 -67 50 -80Q54 -79 58 -78Q55 -69 51 -61L81 -61Q87 -61 93 -61Q93 -58 93 -55Q87 -55 81 -55L69 -55L69 -32L85 -32Q91 -32 96 -32Q96 -29 96 -26Q91 -27 85 -27L69 -27L69 -2Q69 5 69 12ZM1 -43Q1 -46 1 -49Q6 -49 12 -49L22 -49L22 -7L30 -18L33 -23L37 -19L34 -15L19 8L14 4Q15 1 15 -1L15 -43L12 -43Q6 -43 1 -43ZM21 -61Q16 -69 9 -75L13 -82Q22 -75 28 -66ZM154 -16Q152 -15 149 -15Q150 -20 146 -23Q149 -23 153 -23Q157 -22 157 -23Q158 -23 158 -25L158 -43L142 -43L142 -38L135 -38L135 -68L142 -68L142 -67L147 -67Q148 -69 149 -71Q151 -74 152 -75L122 -75L122 -52Q123 -15 110 8Q106 6 103 7Q114 -11 116 -37Q116 -44 116 -52L116 -79L187 -80Q191 -80 196 -80Q195 -78 196 -75Q191 -75 187 -75L153 -75Q155 -73 158 -72Q157 -71 155 -67L185 -67L185 -38L179 -38L179 -43L164 -43L164 -24Q164 -21 162 -19Q160 -16 155 -16L165 -3L160 1L149 -11ZM147 10Q143 10 140 8Q138 5 138 1Q138 -6 137 -12Q141 -11 144 -12Q144 -6 144 1Q144 3 145 4Q146 5 147 5L169 5Q171 5 172 0L173 -12Q175 -11 176 -11L176 -11L181 -16Q190 -7 199 3L193 7Q187 -1 179 -8L177 4Q176 10 173 10ZM124 -12Q127 -11 130 -11Q130 -4 127 2Q125 7 120 11Q119 8 116 7Q117 6 118 4Q122 -2 124 -12ZM170 -38Q182 -30 194 -21L190 -16Q178 -24 166 -32ZM145 -39Q148 -36 151 -34Q141 -22 124 -16Q123 -19 121 -22Q129 -24 134 -28Q139 -32 145 -39ZM179 -56L179 -64L142 -64Q142 -60 142 -56ZM179 -53L142 -53L142 -47L179 -47ZM315 -60L284 -60L284 -44L312 -44L312 -32L284 -32L284 0L269 0L269 -73L315 -73ZM360 -34Q362 -34 364 -32Q365 -31 367 -26L381 0L365 0L356 -18Q356 -19 355 -21Q351 -29 346 -29L341 -29L341 0L327 0L327 -73L348 -73Q362 -73 368 -68Q374 -63 374 -52Q374 -44 370 -40Q367 -35 360 -34ZM341 -61L341 -41L348 -41Q354 -41 357 -43Q359 -46 359 -51Q359 -56 357 -58Q354 -61 348 -61ZM434 0L389 0L389 -73L434 -73L434 -60L403 -60L403 -44L431 -44L431 -32L403 -32L403 -13L434 -13ZM494 0L449 0L449 -73L494 -73L494 -60L463 -60L463 -44L492 -44L492 -32L463 -32L463 -13L494 -13ZM561 -73L574 -73L579 -19L585 -54L597 -54L605 -19L609 -73L621 -73L613 0L600 0L591 -38L584 0L570 0ZM630 -60L630 -73L673 -73L673 -60L659 -60L659 -13L673 -13L673 0L630 0L630 -13L644 -13L644 -60ZM707 -32Q696 -36 692 -41Q688 -45 688 -53Q688 -63 694 -69Q701 -74 712 -74Q717 -74 722 -73Q727 -72 732 -70L732 -56Q727 -59 722 -61Q718 -62 713 -62Q708 -62 705 -60Q702 -58 702 -54Q702 -51 704 -49Q706 -47 713 -45L719 -42Q728 -39 732 -34Q736 -29 736 -21Q736 -9 729 -4Q723 1 710 1Q704 1 699 0Q693 -1 688 -4L688 -19Q694 -14 699 -12Q705 -10 710 -10Q715 -10 718 -13Q721 -15 721 -20Q721 -23 719 -25Q717 -28 714 -29ZM749 -73L763 -73L763 -45L781 -45L781 -73L795 -73L795 0L781 0L781 -32L763 -32L763 0L749 0Z"],"tick":[1204.1,"M22 -61L22 -39L28 -39Q35 -39 38 -42Q41 -44 41 -50Q41 -56 38 -58Q35 -61 28 -61ZM8 -73L28 -73Q43 -73 49 -68Q56 -62 56 -50Q56 -38 49 -33Q43 -27 28 -27L22 -27L22 0L8 0ZM71 0L71 -73L86 -73L86 -13L116 -13L116 0ZM173 -2Q170 0 166 1Q162 1 158 1Q143 1 136 -8Q128 -18 128 -36Q128 -55 136 -64Q143 -74 158 -74Q162 -74 166 -73Q170 -72 173 -71L173 -55Q169 -58 166 -60Q163 -61 159 -61Q151 -61 147 -55Q143 -49 143 -36Q143 -24 147 -18Q151 -12 159 -12Q163 -12 166 -13Q169 -15 173 -18ZM203 -61L203 -39L209 -39Q216 -39 219 -42Q222 -44 222 -50Q222 -56 219 -58Q216 -61 209 -61ZM189 -73L208 -73Q223 -73 230 -68Q237 -62 237 -50Q237 -38 230 -33Q223 -27 208 -27L203 -27L203 0L189 0ZM337 -58L337 -37L358 -37L358 -26L337 -26L337 -4L325 -4L325 -26L304 -26L304 -37L325 -37L325 -58ZM388 -33L380 -33L380 -45L388 -45Q393 -45 396 -47Q399 -50 399 -53Q399 -57 396 -60Q393 -62 388 -62Q384 -62 379 -61Q375 -60 370 -58L370 -71Q375 -73 379 -73Q384 -74 389 -74Q400 -74 407 -69Q413 -64 413 -55Q413 -49 410 -45Q406 -41 399 -39Q407 -38 411 -33Q415 -28 415 -20Q415 -10 408 -4Q401 1 388 1Q383 1 378 0Q372 0 367 -2L367 -16Q372 -13 377 -12Q383 -11 388 -11Q394 -11 398 -14Q401 -16 401 -21Q401 -27 398 -30Q394 -33 388 -33ZM443 -18L460 -18L460 0L443 0ZM503 -13L534 -13L534 0L487 0L487 -12L495 -21Q509 -35 512 -39Q516 -43 517 -46Q519 -50 519 -53Q519 -58 516 -60Q513 -63 508 -63Q504 -63 499 -61Q494 -60 489 -57L489 -70Q494 -72 499 -73Q504 -74 509 -74Q520 -74 527 -69Q533 -63 533 -54Q533 -50 532 -46Q531 -42 527 -38Q524 -34 513 -23Q507 -16 503 -13ZM543 -54Q543 -61 548 -65Q553 -70 559 -70Q566 -70 570 -65Q575 -61 575 -54Q575 -48 570 -43Q566 -39 559 -39Q553 -39 548 -43Q543 -48 543 -54ZM559 -61Q556 -61 554 -59Q552 -57 552 -54Q552 -51 554 -50Q556 -48 559 -48Q562 -48 564 -50Q566 -51 566 -54Q566 -57 564 -59Q562 -61 559 -61ZM546 -27L597 -48L599 -43L548 -23ZM570 -16Q570 -22 575 -27Q579 -31 586 -31Q592 -31 597 -27Q601 -22 601 -16Q601 -9 597 -5Q592 0 586 0Q579 0 575 -5Q570 -9 570 -16ZM586 -22Q583 -22 581 -20Q579 -18 579 -16Q579 -13 581 -11Q583 -9 586 -9Q588 -9 590 -11Q592 -13 592 -16Q592 -18 590 -20Q588 -22 586 -22ZM728 -73L743 -73L743 -44L765 -73L781 -73L758 -44L782 0L766 0L749 -33L743 -25L743 0L728 0ZM813 -61Q807 -61 805 -55Q802 -50 802 -36Q802 -23 805 -17Q807 -12 813 -12Q818 -12 821 -17Q823 -23 823 -36Q823 -50 821 -55Q818 -61 813 -61ZM787 -36Q787 -55 794 -65Q800 -74 813 -74Q825 -74 832 -65Q838 -55 838 -36Q838 -18 832 -8Q825 1 813 1Q800 1 794 -8Q787 -18 787 -36ZM851 -60L851 -73L895 -73L895 -60L880 -60L880 -13L895 -13L895 0L851 0L851 -13L866 -13L866 -60ZM999 -58L999 -37L1020 -37L1020 -26L999 -26L999 -4L988 -4L988 -26L967 -26L967 -37L988 -37L988 -58ZM1033 -13L1049 -13L1049 -60L1034 -56L1034 -69L1049 -73L1063 -73L1063 -13L1079 -13L1079 0L1033 0ZM1105 -13L1136 -13L1136 0L1089 0L1089 -12L1097 -21Q1111 -35 1114 -39Q1118 -43 1119 -46Q1121 -50 1121 -53Q1121 -58 1118 -60Q1115 -63 1110 -63Q1106 -63 1101 -61Q1096 -60 1091 -57L1091 -70Q1096 -72 1101 -73Q1106 -74 1111 -74Q1122 -74 1129 -69Q1136 -63 1136 -54Q1136 -50 1134 -46Q1133 -42 1129 -38Q1127 -34 1115 -23Q1109 -16 1105 -13ZM1146 -54Q1146 -61 1150 -65Q1155 -70 1161 -70Q1168 -70 1172 -65Q1177 -61 1177 -54Q1177 -48 1172 -43Q1168 -39 1161 -39Q1155 -39 1150 -43Q1146 -48 1146 -54ZM1161 -61Q1158 -61 1156 -59Q1154 -57 1154 -54Q1154 -51 1156 -50Q1158 -48 1161 -48Q1164 -48 1166 -50Q1168 -51 1168 -54Q1168 -57 1166 -59Q1164 -61 1161 -61ZM1148 -27L1199 -48L1201 -43L1150 -23ZM1172 -16Q1172 -22 1177 -27Q1181 -31 1188 -31Q1194 -31 1199 -27Q1203 -22 1203 -16Q1203 -9 1199 -5Q1194 0 1188 0Q1181 0 1177 -5Q1172 -9 1172 -16ZM1188 -22Q1185 -22 1183 -20Q1181 -18 1181 -16Q1181 -13 1183 -11Q1185 -9 1188 -9Q1191 -9 1193 -11Q1194 -13 1194 -16Q1194 -18 1192 -20Q1190 -22 1188 -22Z"]};
