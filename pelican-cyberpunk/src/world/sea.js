// OWNER: sea. Layers L-hills-far (0.05), L-lighthouse (0.07), L-sea (0.10), L-boats (0.12).
// Style X ("Neon Pelican", docs/STYLE-X.md): the far layers are the MEGACITY SKYLINE and its HARBOUR at night.
//   L-hills-far  one skyline panorama per lap of the route: three depth bands of towers (haze-violet far towers, dark
//                mid towers, a black waterfront) with thousands of lit windows drawn as dashed stroke columns (a
//                whole column of windows is one short sub-path), setbacks, spires, crown LEDs, antennas with red
//                aircraft lights, rooftop billboards, CJK / Latin facade signs, skybridges, rooftop cranes, a volumetric
//                haze band, and district set pieces along the route (refinery flares, a far ferris wheel, the cable-stay
//                skybridge pylons, a temple pagoda, grow-light domes). Two static holograms get the only bloom filter.
//   L-lighthouse the DATA SPIRE (the ex-lighthouse) on its stepped arcology podium, with a sweeping searchlight beam
//                on its own small sheet.
//   L-sea        the dark harbour water: city-glow horizon, long broken neon reflections of the skyline (a strip that
//                scrolls with the skyline), rolling ripple bands that break them up, oil sheen, rain rings, floating
//                litter, the smog-sun / moon glitter, the container port with two megastructure gantry cranes, the
//                port-control tower, the floating drone dock, and the tetrapod breakwater with a nav pylon.
//   L-boats      the PELICAN LINES hover-ferry, a neon junk, a hover-skiff, a neon trawler, the LED-sail catamaran
//                with its waving crew, a water taxi, smart buoys, sensor pods, the dolphin, fish, seal and whale.
// Design coordinates = the hero frame (t = 3.2 s at 60 rpm): every object is drawn where it sits in that frame and is
// scrolled by (distance − D0)·depth, wrapped over its own span. Performance (STYLE-X §2): everything is static markup
// built once; per frame we only write transforms, a few visibility flags and low-rate opacity blinks. Moving parts carry
// no filters (glows are stacked strokes and radial gradients).
import { fmt1, fmt2 } from '../core/math.js';
import { h, refs } from '../core/svg.js';
import { HORIZON_Y, DIST_PER_REV } from '../contract.js';
import { LAP, KM, stretchAt, relTo, hash } from './route.js';

export const id = 'sea';
// extra base colours (graded by the city mood like core materials): containers, harbour steel and concrete, hulls
export const materials = {
  seaCtrM: '#8C2C60', seaCtrT: '#1E6674', seaCtrA: '#A0682A', seaCtrV: '#50307E', seaCtrS: '#4A5070',
  seaSteel: '#3A3F5C', seaConc: '#4C4868', seaHull: '#1C1A32', seaDeck: '#2A2644',
};

// ---------------------------------------------------------------------------------------------- helpers
const f = fmt2;   // = String(Math.round(x * 100) / 100), fast (core/math.js)
const f1 = fmt1;   // = String(Math.round(x * 10) / 10), fast (core/math.js)
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap = (x, m) => ((x % m) + m) % m;
const D2R = Math.PI / 180;
const circ = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const ell = (x, y, rx, ry) => `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
const rect = (x, y, w, hh) => `M${f(x)} ${f(y)}h${f(w)}v${f(hh)}h${f(-w)}Z`;
const rrect = (x, y, w, hh, r = hh / 2) => `M${f(x + r)} ${f(y)}h${f(w - 2 * r)}a${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(r)}v${f(hh - 2 * r)}a${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(r)}h${f(-(w - 2 * r))}a${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(-r)}v${f(-(hh - 2 * r))}a${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(-r)}Z`;
const poly = pts => 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z';
const line = pts => 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L');
const DD = key => ({ 'data-detail': key });
const dot = (x, y) => `M${f1(x)} ${f1(y)}h0`;       // a round-capped zero-length stroke = a light (short markup)
// split a multi-subpath d into x-buckets (so the renderer can cull off-screen pieces of long scrolling tiles)
const chunks = (d, size = 700) => {
  const out = new Map();
  for (const sp of d.split(/(?=M)/)) { if (!sp) continue; const x = parseFloat(sp.slice(1)); const k = Math.floor(x / size); out.set(k, (out.get(k) || '') + sp); }
  return [...out.values()];
};
// a CSS opacity (style: the mood-driven --pb-n-* vars) overrides the opacity attribute: fold both into one calc()
const mo = a => {
  if (a.style && a.opacity !== undefined && /^opacity:var\(/.test(a.style)) { const { opacity, ...b } = a; return { ...b, style: `opacity:calc(${a.style.slice(8)} * ${opacity})` }; }
  return a;
};
const S = (d, stroke, w, extra = {}) => d ? h('path', mo({ d, fill: 'none', stroke, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra })) : '';
const F = (d, fill, extra = {}) => d ? h('path', mo({ d, fill, ...extra })) : '';
const G = (attrs, ...kids) => h('g', mo(attrs), ...kids);
// emissive neon (STYLE-X §1): the same hue at every hour; signs dim a little at noon through --pb-n-neon
const N = {
  mag: '#FF2E88', magCore: '#FFD3E7', cyan: '#19E6FF', cyanCore: '#D8FBFF', acid: '#C6FF3D', acidCore: '#F1FFD0',
  amber: '#FFB547', amberCore: '#FFF0D2', red: '#FF3B4E', redCore: '#FFD0D6', violet: '#9B5CFF', violetCore: '#E4D4FF',
  white: '#FFF6E8', green: '#3DFF9A', void: '#07060F',
};
const NEONV = { style: 'opacity:var(--pb-n-neon)' };       // signs
const LITV = { style: 'opacity:var(--pb-n-lampOn)' };      // lit windows / practicals
// neon tube: a wide faint halo stroke, the tube, a pale core (fake glow without filters: safe on moving parts)
const tube = (d, col, core, w = 1.2, a = 1) => d ? S(d, col, f(w * 3.4), { opacity: f(0.16 * a) }) + S(d, col, w, { opacity: f(a) }) + (core ? S(d, core, f(w * 0.38), { opacity: f(a) }) : '') : '';

// lettering: glyph outlines from DejaVu Sans Bold + WenQuanYi Zen Hei (tools/ttf.mjs), em 100, baseline 0, [advance, d]
// (absolute M/L/Q/Z only), transformed straight into the path data so a whole sign is ONE path. See GLY at the end.
const adv = ch => ch === ' ' ? 32 : (GLY[ch] ? GLY[ch][0] : 60);
function txt(str, x, y, size, o = {}) {
  const s = size / 100, tr = o.track || 0;
  let w = -tr; for (const ch of str) w += adv(ch) * s + tr;
  let px = o.anchor === 'middle' ? x - w / 2 : o.anchor === 'end' ? x - w : x, d = '';
  for (const ch of str) {
    const g = GLY[ch];
    if (g) { let i = 0; const ox = px; d += g[1].replace(/-?\d+(?:\.\d+)?/g, m => ' ' + (i++ % 2 ? f1(y + m * s) : f1(ox + m * s))); }
    px += adv(ch) * s + tr;
  }
  return d;
}
const txtW = (str, size, tr = 0) => { let w = -tr; for (const ch of str) w += adv(ch) * size / 100 + tr; return w; };
// vertical CJK column centred on cx, first glyph's top at y
const vtxt = (str, cx, y, size) => [...str].map((ch, i) => txt(ch, cx, y + (i + 0.86) * size * 1.04, size, { anchor: 'middle' })).join('');

// ---------------------------------------------------------------------------------------------- geometry
const HZ = HORIZON_Y;
const T0 = 3.2, D0 = T0 * DIST_PER_REV;      // hero frame = design coordinates
const X0 = -420, X1 = 2020;
const W_H = LAP * 0.05;                       // skyline: ONE panorama per lap of the route (23 562 u, 250 crank turns)
// Far landmarks follow the route (route.js): each is at its hero position when the rider is at one of its anchors
// (road distance within the lap) and slides by depth from there; the nearest anchor wins.
const ANCH = { cape: [D0, 10.4 * KM], harbour: [D0, 4.35 * KM], rocks: [D0, 14.3 * KM, 17.1 * KM, 20.1 * KM] };
const routeX = (D, list, d) => { let best = Infinity; for (const A of list) { const x = -relTo(D, A) * d; if (Math.abs(x) < Math.abs(best)) best = x; } return best; };
// ripple bands: [depth, tile width (= depth·DIST_PER_REV·k, seamless in whole crank turns)]
const BANDS = [[0.10, DIST_PER_REV * 0.10 * 13], [0.12, DIST_PER_REV * 0.12 * 11], [0.14, DIST_PER_REV * 0.14 * 10], [0.17, DIST_PER_REV * 0.17 * 8]];
// single objects: depth, span (wrap), margin
const LH = { d: 0.07, S: DIST_PER_REV * 0.07 * 34, M: 2550 };     // data spire (beam reaches ±1000)
const HB = { d: 0.12, S: DIST_PER_REV * 0.12 * 24, M: 880 };      // container port
const RK = { d: 0.17, S: DIST_PER_REV * 0.17 * 14, M: 760 };      // breakwater
const depthAt = y => 0.1 + (y - HZ) * 0.00045;                     // boats: nearer = faster
const LAMP = { x: 1150, y: 269 };                                  // data-spire beacon (hero coords; weather's fog beam uses it)
// on-the-water objects: hero x, waterline y, scale, own speed (+x = sailing with the rider), span
const BOATS = {
  steamer: { x: 1030, y: 486, s: 1, vx: -9, S: 4300, e: 70 },
  sloop: { x: 1405, y: 491, s: 0.3, vx: 14, S: 3600, e: 30 },
  yawl: { x: 1565, y: 496, s: 0.32, vx: 10, S: 4100, e: 30 },
  trawler: { x: 1262, y: 523, s: 0.45, vx: 5, S: 3900, e: 50 },
  taxi: { x: 520, y: 540, s: 0.62, vx: 62, S: 4700, e: 60 },
  near: { x: 1150, y: 580, s: 0.95, vx: 45, S: 3700, e: 110 },
  can: { x: 1372, y: 566, s: 0.75, vx: 0, S: 3300, e: 20 },
  bell: { x: 1036, y: 596, s: 0.8, vx: 0, S: 3500, e: 30 },
  pots: { x: 1512, y: 592, s: 1, vx: 0, S: 3100, e: 30 },
  dolphin: { x: 1335, y: 562, s: 1, vx: 0, S: 3400, e: 90 },
  fish: { x: 1455, y: 596, s: 1, vx: 0, S: 3000, e: 40 },
  sealhead: { x: 380, y: 592, s: 1, vx: 0, S: 3200, e: 30 },
};
const place = (t, D, x0, d, vx, M, Sp) => wrap(x0 + vx * (t - T0) - (D - D0) * d + M, Sp) - M;
const hillsX = D => -(wrap((D - D0) * 0.05 + 2600, W_H) - 2600);

export const detailItems = [
  // skyline (L-hills-far)
  ['sea:O:far-towers', 'O', 'far band of haze-violet towers: setbacks, spires, chamfered and rounded crowns, twin slabs'],
  ['sea:T:far-windows', 'T', 'thousands of far windows: dashed stroke columns, lit runs in amber / white / cyan / magenta over dim floors'],
  ['sea:O:mid-towers', 'O', 'mid band of dark towers in front of the haze'],
  ['sea:T:mid-windows', 'T', 'mid-tower window columns (bigger, more of them lit)'],
  ['sea:T:office-ribbons', 'T', 'office towers with horizontal ribbon windows'],
  ['sea:O:neon-rim-edges', 'O', 'magenta / cyan neon rim light on tower edges'],
  ['sea:O:rooftop-antennas', 'O', 'rooftop masts and spire needles'],
  ['sea:O:aircraft-warning-lights', 'O', 'red aircraft warning lights with halos on the masts'],
  ['sea:O:crown-leds', 'O', 'LED crown bands along tower tops'],
  ['sea:O:rooftop-tanks', 'O', 'water tanks on legs on flat roofs'],
  ['sea:O:skybridges', 'O', 'skybridges between towers with cyan light strips'],
  ['sea:O:rooftop-billboards', 'O', 'rooftop billboards on stilts with neon panels'],
  ['sea:O:facade-signs-zh', 'O', 'vertical CJK facade signs: 酒店 寿司 拉面 网吧 当铺 银行 …'],
  ['sea:O:facade-signs-en', 'O', 'horizontal Latin signs: HOTEL KTV 24H BANK CLOUD BAR ネオン'],
  ['sea:O:rooftop-cranes', 'O', 'tower cranes on buildings under construction'],
  ['sea:O:haze-band', 'O', 'volumetric violet haze between the far and mid bands, lit by the city glow'],
  ['sea:O:waterfront-blocks', 'O', 'black waterfront sheds along the horizon'],
  ['sea:O:waterfront-shopfronts', 'O', 'lit shopfronts along the waterfront'],
  ['sea:O:promenade-lights', 'O', 'amber promenade lamps on posts along the far shore'],
  ['sea:O:holo-koi', 'O', 'a giant hologram koi over the skyline (static bloom)'],
  ['sea:T:holo-scanlines', 'T', 'scanlines clipped inside the hologram'],
  ['sea:O:holo-projector', 'O', 'the projector tower and its light cone under the koi'],
  ['sea:O:holo-pelican-ad', 'O', 'a magenta pelican-head hologram advert 鹈鹕航运 PELICAN LINES on a mast'],
  // data spire (L-lighthouse)
  ['sea:O:spire-podium', 'O', 'stepped arcology podium (the old cape) with a magenta neon edge'],
  ['sea:T:podium-panels', 'T', 'panel seams on the podium'],
  ['sea:T:podium-windows', 'T', 'window columns on the podium steps'],
  ['sea:O:hazard-edges', 'O', 'acid / black hazard stripes on the step lips'],
  ['sea:O:spire-sign', 'O', '数据塔 DATA SPIRE neon sign'],
  ['sea:O:stair-lights', 'O', 'amber step lights up the podium stairs'],
  ['sea:O:guard-rail', 'O', 'guard rail along the plaza'],
  ['sea:O:control-bunker', 'O', 'control bunker with lit slots, door and dish'],
  ['sea:O:comm-mast', 'O', 'comm mast with yards, bracing and an LED ticker'],
  ['sea:O:holo-flags', 'O', 'translucent hologram flags on the mast'],
  ['sea:O:spire-shaft', 'O', 'tapered spire shaft with shade side and seams'],
  ['sea:O:spire-rim-light', 'O', 'dual rim light: cyan left, magenta right'],
  ['sea:O:spire-collars', 'O', 'three steel collars with cyan / magenta neon rings'],
  ['sea:O:spire-slits', 'O', 'lit maintenance slits and the arched service door'],
  ['sea:O:spire-lift', 'O', 'the lift car climbing its track up the shaft'],
  ['sea:O:observation-ring', 'O', 'observation ring with railing, brackets and LED underglow'],
  ['sea:O:beacon-housing', 'O', 'glass beacon drum with the emitter and astragals'],
  ['sea:O:antenna-crown', 'O', 'antenna crown: cone roof, mast, cross-bars, dish'],
  ['sea:O:spire-warning-lights', 'O', 'blinking red warning lights on the spire and mast'],
  ['sea:O:searchlight-beam', 'O', 'the sweeping cyan searchlight beam and the beacon flare'],
  // water (L-sea)
  ['sea:O:harbour-water', 'O', 'dark harbour water, lit violet near the horizon'],
  ['sea:O:horizon-glow', 'O', 'city glow on the horizon with glare dashes'],
  ['sea:O:skyline-reflections', 'O', 'long broken neon reflections of the skyline signs and windows'],
  ['sea:O:reflection-glow-pools', 'O', 'soft glow pools under the brightest reflections'],
  ['sea:O:spire-reflection', 'O', 'the data spire and podium reflected in the water'],
  ['sea:T:dark-ripples', 'T', 'dark ripple lines that break up the reflections'],
  ['sea:T:ripple-ticks', 'T', 'far ripple ticks lit by the sky'],
  ['sea:O:neon-glints', 'O', 'cyan and magenta glints on the mid ripples'],
  ['sea:T:swell-lines', 'T', 'scalloped swell lines'],
  ['sea:T:sky-sheen', 'T', 'long faint sheen lines where the water mirrors the lit smog'],
  ['sea:O:oil-sheen', 'O', 'iridescent oil sheen rings (violet / cyan / magenta)'],
  ['sea:T:near-chop', 'T', 'near chop lines'],
  ['sea:O:lit-crests', 'O', 'crests lit by the smog'],
  ['sea:O:rain-rings', 'O', 'rain rings on the water'],
  ['sea:O:floating-litter', 'O', 'floating litter: a 外卖 take-away box, a can, a bottle'],
  ['sea:O:smog-sun-glitter', 'O', 'glitter path under the smog sun, swaying'],
  ['sea:O:glitter-sparkles', 'O', 'four-point sparkles in the glitter'],
  ['sea:O:moon-glitter', 'O', 'moon glitter path (night)'],
  // container port
  ['sea:O:container-stacks', 'O', 'stacked shipping containers in five colours'],
  ['sea:T:container-corrugation', 'T', 'corrugation on every container'],
  ['sea:O:container-doors', 'O', 'container door seams and lock bars'],
  ['sea:O:container-labels', 'O', 'container markings PBL NEO PBX CYB'],
  ['sea:O:cold-store', 'O', 'cold store with lit roll-up doors and a 24H sign'],
  ['sea:O:gantry-cranes', 'O', 'two megastructure gantry cranes PB-01 / PB-02: legs, portal, box girder, apex, stays'],
  ['sea:T:crane-lattice', 'T', 'lattice bracing inside the girders and legs'],
  ['sea:O:crane-cabs', 'O', 'lit operator cabs under the girders'],
  ['sea:O:crane-led-strips', 'O', 'cyan LED strips along the girders'],
  ['sea:O:crane-spreaders', 'O', 'trolleys, cables and spreaders lifting containers (sway)'],
  ['sea:O:crane-warning-lights', 'O', 'blinking red warning lights on apex and boom ends'],
  ['sea:O:port-tower', 'O', 'port-control tower with antenna'],
  ['sea:T:port-tower-windows', 'T', 'ribbon windows on the port tower'],
  ['sea:O:port-sign-zh', 'O', 'vertical 渔港 neon sign'],
  ['sea:O:port-sign-en', 'O', 'FISH PORT neon sign'],
  ['sea:O:quay-apron', 'O', 'quay apron with a hazard-striped lip and bollards'],
  ['sea:T:quay-panels', 'T', 'concrete panel joints'],
  ['sea:O:quay-lamps', 'O', 'quay lamp posts with amber glows'],
  ['sea:O:harbour-mole', 'O', 'harbour mole with block joints'],
  ['sea:O:channel-light', 'O', 'green channel light tower'],
  ['sea:O:moored-taxis', 'O', 'water taxis moored at the quay with neon trims and canopies'],
  ['sea:O:dock-ramp', 'O', 'ramp down to the floating dock'],
  ['sea:O:dock-floats', 'O', 'pontoon floats'],
  ['sea:O:dock-pontoon', 'O', 'the floating drone dock deck with cleats'],
  ['sea:O:dock-edge-lights', 'O', 'amber edge lights along the dock'],
  ['sea:O:drone-pads', 'O', 'cyan landing rings on the dock'],
  ['sea:O:charge-pylons', 'O', 'drone charging pylons with cables'],
  ['sea:O:dock-kiosk', 'O', 'dock kiosk with a lit counter'],
  ['sea:O:dock-sign', 'O', '无人机 DRONE PORT neon sign'],
  ['sea:O:delivery-drones', 'O', 'three delivery drones hovering (rotor blur, nav LEDs, parcels, a scan cone)'],
  ['sea:T:port-reflections', 'T', 'broken reflections of the port lights'],
  // breakwater
  ['sea:O:tetrapods', 'O', 'concrete tetrapod breakwater'],
  ['sea:O:tetrapod-rim-light', 'O', 'neon rim light on the tetrapods'],
  ['sea:O:nav-pylon', 'O', 'lattice nav pylon with platform, lamp house and hazard band'],
  ['sea:O:no-feeding-sign', 'O', '请勿喂鹈鹕 DON\'T FEED THE PELICAN sign (an egg)'],
  ['sea:O:seal-basking', 'O', 'seal basking on the tetrapods (head bobs)'],
  ['sea:O:cormorants', 'O', 'cormorants on the pylon, one drying its wings'],
  ['sea:O:breakwater-foam', 'O', 'surging foam collars and spray'],
  // boats (L-boats)
  ['sea:O:ferry-hull', 'O', 'PELICAN LINES hover-ferry hull'],
  ['sea:O:ferry-waterline-neon', 'O', 'magenta waterline tube and cyan deck line'],
  ['sea:O:ferry-portholes', 'O', 'lit portholes'],
  ['sea:O:ferry-decks', 'O', 'superstructure decks and the bridge with its visor'],
  ['sea:O:ferry-screen', 'O', 'LED screen 鹈鹕航运 PELICAN LINES'],
  ['sea:O:ferry-stacks', 'O', 'raked exhaust stacks with neon bands'],
  ['sea:O:ferry-pods', 'O', 'amber escape pods on davits'],
  ['sea:O:ferry-string-lights', 'O', 'LED string lights on the dressing lines'],
  ['sea:O:ferry-vapour', 'O', 'exhaust vapour puffs drifting astern'],
  ['sea:O:hover-skiff', 'O', 'far hover-skiff with a cyan underglow'],
  ['sea:O:neon-junk', 'O', 'far junk with magenta sails and cyan battens'],
  ['sea:O:trawler', 'O', 'neon trawler PB7: hull, wheelhouse, mast'],
  ['sea:O:trawler-worklights', 'O', 'amber work lights on the trawler'],
  ['sea:T:fishing-net', 'T', 'drying net mesh with floats'],
  ['sea:O:fisherman', 'O', 'fisherman in oilskins with a headlamp'],
  ['sea:O:net-gulls', 'O', 'gulls over the net'],
  ['sea:O:water-taxi', 'O', 'water taxi 的士 TAXI with canopy and neon strip'],
  ['sea:O:taxi-wake', 'O', 'long wake and underglow of the taxi'],
  ['sea:O:catamaran-hull', 'O', 'near catamaran hull with neon strips and cabin'],
  ['sea:O:led-mainsail', 'O', 'mainsail with a violet panel and cyan LED battens'],
  ['sea:T:sail-circuits', 'T', 'sail-cloth seams and circuit traces'],
  ['sea:O:sailboat-jib', 'O', 'translucent magenta jib'],
  ['sea:O:sailboat-rigging', 'O', 'forestay, backstay, shrouds, sheets, spreaders'],
  ['sea:O:holo-pennants', 'O', 'fluttering hologram burgee and 鹈 pennant'],
  ['sea:O:sailboat-crew', 'O', 'sailor in an amber poncho and cyan visor at the tiller (waves)'],
  ['sea:O:lifebuoy', 'O', 'lifebuoy ring'],
  ['sea:O:boat-wake', 'O', 'bow wave and wake'],
  ['sea:O:marker-buoy', 'O', 'marker buoy 3 with a glowing number and topmark light'],
  ['sea:O:bell-buoy', 'O', 'smart bell buoy: float, lattice cage, swinging bell, lamp, holo panel'],
  ['sea:O:buoy-gull', 'O', 'gull perched on the bell buoy'],
  ['sea:O:sensor-pods', 'O', 'floating sensor pods with antennas and LEDs'],
  ['sea:O:dolphin', 'O', 'leaping dolphin with neon rim light'],
  ['sea:O:splash', 'O', 'splash crowns and rings'],
  ['sea:O:jumping-fish', 'O', 'fish jumping in the glitter'],
  ['sea:O:seal-head', 'O', 'seal that pops its head out of the water'],
].map(([key, kind, what]) => ({ id: key.split(':')[2], layer: 'sea', kind, what, key }));

// ---------------------------------------------------------------------------------------------- build
export function build(ctx) {
  const { v, rng } = ctx;
  let defs = '';
  // radial glows (static far sheets and small practicals), a hologram bloom (static far sheet only)
  const rg = (id, col, a0 = 0.6) => h('radialGradient', { id }, h('stop', { offset: 0, 'stop-color': col, 'stop-opacity': a0 }),
    h('stop', { offset: 0.35, 'stop-color': col, 'stop-opacity': f(a0 * 0.45) }), h('stop', { offset: 1, 'stop-color': col, 'stop-opacity': 0 }));
  defs += rg('sea-gAmber', N.amber) + rg('sea-gCyan', N.cyan) + rg('sea-gMag', N.mag) + rg('sea-gRed', N.red, 0.7) + rg('sea-gAcid', N.acid, 0.5);
  defs += h('filter', { id: 'sea-bloom', x: '-40%', y: '-40%', width: '180%', height: '180%' },
    h('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: 2.2, result: 'b' }), h('feMerge', {}, h('feMergeNode', { in: 'b' }), h('feMergeNode', { in: 'SourceGraphic' })));
  defs += reflPatterns(rng);
  const water = buildWater(v, rng);
  const sky = buildSkyline(v, rng);
  const lh = buildSpire(v, rng);
  const seaL = buildSea(v, rng, sky.refl, lh.refl);
  const boats = buildBoats(v, rng);
  defs += water.defs + sky.defs + lh.defs + seaL.defs + boats.defs;
  return {
    defs,
    layers: { 'L-hills-far': water.markup + sky.markup, 'L-lighthouse': lh.markup, 'L-sea': seaL.markup, 'L-boats': boats.markup },
  };
}

// reflection shimmer: one static tile of ripple-broken horizontal dashes (denser and wider near the horizon), one
// <pattern> per neon colour; a reflection is then just a narrow rect filled with it (every x shows another phase)
const RP_COL = { amber: N.amber, white: N.white, cyan: N.cyan, mag: N.mag, acid: N.acid, violet: N.violet, red: N.red, green: N.green, core: N.cyanCore };
const rq = (x, y, w, len, c) => F(rect(x - w / 2, y, w, len), `url(#sea-rp-${c})`);
function reflPatterns(rng) {
  const R = rng('sea-reflpat'), TW = 11; let d = '';
  for (let y = 0; y < 150; y += 2.1 + y * 0.016) {
    const t = y / 150; if (R() < 0.12 + t * 0.55) continue;
    for (let k = 0, n = R() < 0.25 ? 2 : 1; k < n; k++) {
      const w = (1.2 + R() * 4.2) * (1 - t * 0.5), x = R() * TW, hh = 0.8 + R() * 0.5 - t * 0.3;
      d += rect(x, y, w, hh); if (x + w > TW) d += rect(x - TW, y, w, hh);
    }
  }
  return Object.entries(RP_COL).map(([c, hex]) => h('pattern', { id: 'sea-rp-' + c, x: 0, y: 474, width: TW, height: 400, patternUnits: 'userSpaceOnUse' }, F(d, hex))).join('');
}

// ============================================================================ L-hills-far: the megacity skyline
// tallness of the skyline behind each stretch of the ride (the neon district, the arcology cliffs, the low dunes …)
const TALL = { village: 1, pier: 0.85, harbour: 0.95, funfair: 0.72, railway: 0.8, lighthouse: 1, cliffs: 1.3, dunes: 0.36, bridge: 0.6, fort: 0.82, pines: 0.58, return: 1 };
// the stretch of road whose skyline sits at panorama x (x crosses screen centre when the rider is at that distance)
const keyAtPano = x => stretchAt(D0 + (x - 800) / 0.05).key;
const panoOf = D => { const x = 800 + (D - D0) * 0.05; return wrap(x + 420, W_H) - 420; };
const DASHC = { amber: '2.2 1.5 2.2 1.5 2.2 5.2', white: '2.2 1.5 2.2 8.9', cyan: '2.2 5.2', mag: '2.2 1.5 2.2 1.5 2.2 1.5 2.2 12.6', acid: '2.2 5.2' };
// merged (non-hero) buckets fold look-alike keys into one element each: fills of the band colour, one path per light colour
const MERGE = k => {
  const [p, a] = k.split(':');
  if (p === 'antA' || p === 'tkA') return 'A';
  if (p === 'antB' || p === 'tkB' || p === 'crn') return 'B';
  if (p === 'rbA' || p === 'rbB') return 'wl' + p[2] + ':' + a;
  if (p === 'rbdA' || p === 'rbdB') return 'wd' + p[3] + ':0';
  if (p === 'wlA' || p === 'wlB') return p + ':' + a;
  if (p === 'redA' || p === 'redB') return 'red';
  if (p === 'redAH' || p === 'redBH') return 'redH';
  if (p === 'rimA') return 'rimA:m';
  if (p === 'crownA') return 'crownA:mag';
  if (p === 'sgvB' || p === 'sghB') return 'sgB';
  if (p === 'sgv' || p === 'sgh') return 'sg:' + a;
  if (p === 'sgvT' || p === 'sghT') return 'sgT:' + a;
  return k;
};
const DASH = ['2.2 1.5', '2.2 1.5 2.2 1.5 2.2 5.2', '2.2 5.2', '2.2 1.5 2.2 8.9', '2.2 1.5 2.2 1.5 2.2 1.5 2.2 12.6'];
function buildSkyline(v, rng) {
  const R = rng('sea-skyline');
  const XA = -420, XB = W_H - 480, BK = 4000;
  const COL = { amber: N.amber, white: N.white, cyan: N.cyan, mag: N.mag, acid: N.acid, violet: N.violet, red: N.red };
  const litCol = () => { const u = R(); return u < 0.44 ? 'amber' : u < 0.62 ? 'white' : u < 0.82 ? 'cyan' : u < 0.95 ? 'mag' : 'acid'; };
  const signCol = () => ['mag', 'cyan', 'amber', 'acid', 'mag', 'cyan'][Math.floor(R() * 6)];
  const winCol = () => { const u = R(); return u < 0.46 ? 'amber' : u < 0.64 ? 'white' : u < 0.86 ? 'cyan' : 'mag'; };
  // z-order of the merged keys (prefix before ':')
  const ORDER = ['A', 'Ahi', 'antA', 'tkA', 'wdA', 'wlA', 'rbdA', 'rbA', 'rimA', 'crownA', 'redAH', 'redA', '|heroA', '|haze',
    'redH', 'red',
    'B', 'Bhi', 'antB', 'tkB', 'crn', 'wdB', 'wlB', 'rbdB', 'rbB', 'rimB', 'crownB', 'brg', 'brgL', 'bbF', 'bb', 'bbX',
    'sgvB', 'sgv', 'sgvT', 'sghB', 'sgh', 'sghT', 'sgB', 'sg', 'sgT', 'redBH', 'redB', '|heroB', 'sp', 'spL', 'spR', 'C', 'Chi', 'shop', 'post', 'promH', 'prom'];
  const rank = k => ORDER.indexOf(k.split(':')[0]);
  const TAG = { A: 'sea:O:far-towers', wdA: 'sea:T:far-windows', wlA: 'sea:T:far-windows', rbA: 'sea:T:office-ribbons', rbdA: 'sea:T:office-ribbons',
    B: 'sea:O:mid-towers', wdB: 'sea:T:mid-windows', wlB: 'sea:T:mid-windows', rbB: 'sea:T:office-ribbons', rbdB: 'sea:T:office-ribbons',
    rimA: 'sea:O:neon-rim-edges', rimB: 'sea:O:neon-rim-edges', antA: 'sea:O:rooftop-antennas', antB: 'sea:O:rooftop-antennas',
    redA: 'sea:O:aircraft-warning-lights', redB: 'sea:O:aircraft-warning-lights', crownA: 'sea:O:crown-leds', crownB: 'sea:O:crown-leds',
    tkA: 'sea:O:rooftop-tanks', tkB: 'sea:O:rooftop-tanks', brg: 'sea:O:skybridges', bb: 'sea:O:rooftop-billboards', bbF: 'sea:O:rooftop-billboards',
    sgv: 'sea:O:facade-signs-zh', sgvT: 'sea:O:facade-signs-zh', sgh: 'sea:O:facade-signs-en', sghT: 'sea:O:facade-signs-en', crn: 'sea:O:rooftop-cranes',
    C: 'sea:O:waterfront-blocks', prom: 'sea:O:promenade-lights', shop: 'sea:O:waterfront-shopfronts' };
  const dash = (k, extra = {}) => ({ 'stroke-dasharray': DASH[+k], 'stroke-linecap': 'butt', ...extra });
  function STY(k, d, tagged) {
    const [p, a, b] = k.split(':'), T = tagged && TAG[p] && p !== 'A' && p !== 'B' ? DD(TAG[p]) : {};
    switch (p) {
      case 'A': return F(d, v('hillFar'), T);
      case 'B': return F(d, v('hillNear'), T);
      case 'C': return F(d, v('mega'), T);
      case 'Ahi': case 'Bhi': return S(d, v('megaHi'), 0.8, { opacity: 0.85 });
      case 'Chi': return S(d, v('smogLit'), 0.7, { opacity: 0.45 });
      case 'wdA': return S(d, v('megaHi'), 1.25, dash(a, { opacity: 0.75, ...T }));
      case 'wdB': return S(d, v('megaHi'), 1.5, dash(a, T));
      case 'wlA': return S(d, COL[a], 1.25, { 'stroke-dasharray': DASHC[a], 'stroke-linecap': 'butt', ...LITV, ...T });
      case 'wlB': return S(d, COL[a], 1.5, { 'stroke-dasharray': DASHC[a], 'stroke-linecap': 'butt', ...LITV, ...T });
      case 'rbdA': case 'rbdB': return S(d, v('megaHi'), p === 'rbdA' ? 1.1 : 1.3, { 'stroke-dasharray': '3.6 1.1', 'stroke-linecap': 'butt', opacity: 0.8, ...T });
      case 'rbA': case 'rbB': return S(d, COL[a], p === 'rbA' ? 1.1 : 1.3, { 'stroke-dasharray': a === 'white' ? '7 1.4' : '3.6 1.1', 'stroke-linecap': 'butt', ...LITV, ...T });
      case 'rimA': case 'rimB': return S(d, a === 'c' ? N.cyan : N.mag, 0.9, { opacity: a === 'c' ? 0.42 : 0.55, ...T });
      case 'antA': return F(d, v('hillFar'), T);
      case 'antB': return F(d, v('hillNear'), T);
      case 'tkA': return F(d, v('hillFar'), T);
      case 'tkB': return F(d, v('hillNear'), T);
      case 'redAH': case 'redBH': return S(d, N.red, 6, { opacity: 0.22 });
      case 'redA': case 'redB': case 'red': return S(d, N.red, 2.3, T);
      case 'redH': return S(d, N.red, 6, { opacity: 0.22 });
      case 'sgB': return F(d, N.void, { opacity: 0.86 });
      case 'sg': return S(d, COL[a], 0.75, NEONV);
      case 'sgT': return F(d, COL[a], NEONV);
      case 'crownA': case 'crownB': return S(d, COL[a], 1, { ...NEONV, ...T });
      case 'crn': return F(d, v('hillNear'), T);
      case 'brg': return F(d, v('hillNear'), T);
      case 'brgL': return S(d, N.cyan, 0.8, { 'stroke-dasharray': '1.4 1.8', 'stroke-linecap': 'butt', ...LITV });
      case 'bbF': return S(d, v('mega'), 0.9, T);
      case 'bb': return F(d, COL[a], { ...NEONV, ...T });
      case 'bbX': return F(d, N.void, { opacity: 0.55 });
      case 'sgvB': case 'sghB': return F(d, N.void, { opacity: 0.86 });
      case 'sgv': case 'sgh': return G({ ...NEONV, ...T }, S(d, COL[a], 2.6, { opacity: 0.18 }), S(d, COL[a], 0.75));
      case 'sgvT': case 'sghT': return F(d, COL[a], { ...NEONV, ...T });
      case 'sp': return F(d, v('hillNear'));
      case 'spL': return S(d, COL[a], a === 'violet' ? 1.6 : 1, { ...NEONV, opacity: 0.9 });
      case 'spR': return F(d, COL[a], NEONV);
      case 'shop': return F(d, COL[a], { ...LITV, ...T });
      case 'post': return S(d, v('mega'), 6.6, { 'stroke-dasharray': '0.6 11.4', 'stroke-linecap': 'butt' });
      case 'promH': return S(d, N.amber, 5.2, { 'stroke-dasharray': '0 12', opacity: 0.24 });
      case 'prom': return S(d, N.amberCore, 1.7, { 'stroke-dasharray': '0 12', ...LITV, ...T });
    }
    return '';
  }
  const emit = (m, tagged, r0, r1) => [...m.keys()].filter(k => rank(k) >= r0 && rank(k) < r1).sort((a, b) => rank(a) - rank(b)).map(k => STY(k, m.get(k), tagged)).join('');
  const buckets = new Map(), refl = new Map(), heroA = [], heroB = [];
  const bucket = x => { const k = Math.floor((x - XA) / BK); let m = buckets.get(k); if (!m) buckets.set(k, m = new Map()); return m; };
  const put = (m, k, d) => { if (d) m.set(k, (m.get(k) || '') + d); };
  // reflections: collected per colour into the L-sea strip (same scroll as the skyline)
  const rput = (x, k, d) => { const b = Math.floor((x - XA) / BK); let m = refl.get(b); if (!m) refl.set(b, m = new Map()); put(m, k, d); };
  const heroWin = x => x > 1370 && x < 1540;
  const reflHero = [];
  const reflect = (x, col, len, w, strong, own) => {
    if (own) { reflHero.push(G(DD('sea:O:skyline-reflections'), S(`M${f1(x)} 474V${f1(474 + len * 1.15)}`, RP_COL[col], 9, { opacity: 0.17, 'stroke-dasharray': '16 3 12 5 8 7 6 9 4 12', 'stroke-linecap': 'butt' }), F(rect(x - w * 1.6, 474, w * 3.2, len), `url(#sea-rp-${col})`))); return; }
    rput(x, `rq:${col}`, rect(x - w * 1.6, 474, w * 3.2, len));
    if (strong) rput(x, `rp:${col}`, `M${f1(x)} 474V${f1(474 + len * 1.15)}`);
  };
  const HERO_ZH = ['酒店', '寿司', '拉面', '网吧', '当铺', '银行', '茶', '药', '云'], HERO_EN = ['HOTEL', 'KTV', '24H', 'BANK', 'CLOUD', 'BAR', 'ネオン'];
  let zi = 0, ei = 0;
  function tower(band, x, w, top, hero) {
    const pc = hero ? new Map() : bucket(x), add = (k, d) => put(pc, hero ? k : MERGE(k), d);
    const base = band === 'A' ? 472 : 473, u = R();
    let body, tiers = [[x, w, top]], flat = false, peak = top;
    if (u < 0.18 && w > 18) {                                    // setback
      const w2 = w * (0.48 + R() * 0.22), x2 = x + (w - w2) * R(), t1 = top + (base - top) * (0.28 + R() * 0.22);
      body = rect(x, t1, w, base - t1) + rect(x2, top, w2, t1 - top + 0.5) + rect(x2 - 0.5, top - 1.2, w2 + 1, 1.2); tiers = [[x, w, t1], [x2, w2, top]];
    } else if (u < 0.32) {                                       // spire
      const sh = w * 0.55; peak = top - sh;
      body = rect(x, top, w, base - top) + poly([[x, top + 0.5], [x + w / 2, top - sh], [x + w, top + 0.5]]);
      const ah = 8 + R() * 18; add('ant' + band, rect(x + w / 2 - 0.5, top - sh - ah, 1, ah)); add('red' + band, dot(x + w / 2, top - sh - ah)); add('red' + band + 'H', dot(x + w / 2, top - sh - ah)); peak -= ah;
    } else if (u < 0.44) {                                       // chamfered crown
      const c = Math.min(w * 0.45, 11); body = poly([[x, base], [x, top + c], [x + c, top], [x + w, top], [x + w, base]]);
    } else if (u < 0.53) {                                       // rounded crown
      body = rect(x, top, w, base - top) + `M${f(x)} ${f(top + 0.5)}A${f(w / 2)} ${f(w * 0.32)} 0 0 1 ${f(x + w)} ${f(top + 0.5)}Z`; peak = top - w * 0.32;
    } else if (u < 0.62 && w > 22) {                             // twin slabs + bridge
      const g = 2 + R() * 3, w1 = (w - g) / 2, t2 = top + 6 + R() * 18, yb = top + (base - top) * (0.3 + R() * 0.2);
      body = rect(x, top, w1, base - top) + rect(x + w1 + g, t2, w1, base - t2); tiers = [[x, w1, top], [x + w1 + g, w1, t2]];
      add('brg', rect(x + w1 - 0.5, yb, g + 1, 2.4)); add('brgL', `M${f(x + w1)} ${f(yb + 1.2)}h${f(g)}`);
    } else { body = rect(x, top, w, base - top) + rect(x - 0.6, top - 1.4, w + 1.2, 1.4); flat = true; }
    add(band, body);
    add(band + 'hi', `M${f(x + 0.4)} ${f(top + 1)}V${f(Math.min(base, top + 30 + R() * 40))}`);
    // windows: dashed columns (a column of windows = one sub-path), split into a lit and a dim run; or office ribbons
    const dark = R() < 0.08, ribbon = !dark && R() < 0.22, sp = band === 'A' ? 3.4 : 3.9, litP = band === 'A' ? 0.36 : 0.48;
    let litX = null, litC = null;
    for (const [tx, tw2, tt] of tiers) {
      if (dark) break;
      if (ribbon) {
        for (let y = tt + 4; y < base - 3; y += band === 'A' ? 3.6 : 4.2) {
          if (R() < 0.25) continue;
          const lit = R() < litP + 0.1, c = winCol();
          add(lit ? `rb${band}:${c}` : `rbd${band}`, `M${f1(tx + 1.8)} ${f1(y)}H${f1(tx + tw2 - 1.8)}`);
          if (lit && litX === null) { litX = tx + tw2 / 2; litC = c; }
        }
        continue;
      }
      for (let cx = tx + 2.2; cx < tx + tw2 - 1.4; cx += sp) {
        const y0 = tt + 4 + Math.floor(R() * 3) * 3.7; if (y0 > base - 6) continue;
        const split = band === 'B' || hero, ym = split ? y0 + Math.floor(R() * ((base - y0) / 3.7)) * 3.7 : base - 2, first = R() < litP, c = winCol(), di = 1 + Math.floor(R() * 3);
        const seg = (a, b, lit) => { if (b - a < 2) return; if (!lit && band === 'A' && !hero && R() < 0.6) return; add(lit ? `wl${band}:${c}` : `wd${band}:0`, `M${f1(cx)} ${f1(a)}V${f1(b)}`); };
        seg(y0, ym, first); if (split) seg(ym, base - 2, !first && R() < litP * 1.2);
        if (first && litX === null) { litX = cx; litC = c; }
      }
    }
    if (band === 'B' && litX !== null && R() < 0.5) reflect(litX, litC, 16 + R() * 40, 1.4, false);
    // rooftops
    const tt = tiers[tiers.length - 1], rx = tt[0], rw = tt[1], rtop = tt[2];
    if (R() < 0.34 && u >= 0.32) { const ax = rx + rw * (0.25 + R() * 0.5), ah = 6 + R() * 22; add('ant' + band, rect(ax - 0.5, rtop - ah, 1, ah) + (R() < 0.4 ? rect(ax - 3, rtop - ah * 0.6, 6, 0.8) : '')); add('red' + band, dot(ax, rtop - ah - 0.6)); add('red' + band + 'H', dot(ax, rtop - ah - 0.6)); peak = Math.min(peak, rtop - ah); }
    if (flat && R() < 0.3) { const kx = rx + rw * (0.15 + R() * 0.5); add('tk' + band, rect(kx, rtop - 5.5, 5, 3.6) + `M${f(kx)} ${f(rtop - 5.5)}a2.5 1.2 0 0 1 5 0Z` + rect(kx + 0.6, rtop - 2, 0.8, 2) + rect(kx + 3.6, rtop - 2, 0.8, 2)); }
    if (R() < 0.3) add(`rim${band}:m`, `M${f(x + w - 0.3)} ${f(tiers[0][2] + 2)}V${f(Math.min(base - 2, tiers[0][2] + 30 + R() * 60))}`);
    else if (R() < 0.2) add(`rim${band}:c`, `M${f(x + 0.4)} ${f(tiers[0][2] + 3)}V${f(Math.min(base - 2, tiers[0][2] + 20 + R() * 50))}`);
    if (R() < 0.2) add(`crown${band}:${R() < 0.55 ? 'mag' : 'cyan'}`, `M${f(rx + 0.6)} ${f(rtop + 1.2)}H${f(rx + rw - 0.6)}` + (R() < 0.5 ? `M${f(rx + 0.6)} ${f(rtop + 4.2)}H${f(rx + rw - 0.6)}` : ''));
    if (band === 'B') {
      if (flat && rw > 16 && R() < 0.14) {
        const c = signCol(), bw = rw - 4, bx = rx + 2, by = rtop - 12;
        add('bbF', `M${f(bx + 2)} ${f(rtop - 1)}V${f(by + 8)}M${f(bx + bw - 2)} ${f(rtop - 1)}V${f(by + 8)}M${f(bx + 1)} ${f(by + 8.6)}H${f(bx + bw - 1)}`);
        add('bb:' + c, rect(bx, by, bw, 8)); add('bbX', rect(bx + 1.5, by + 1.5, bw * 0.3, 5) + rect(bx + bw * 0.42, by + 2, bw * 0.5, 1.4) + rect(bx + bw * 0.42, by + 4.6, bw * 0.34, 1.1));
        reflect(bx + bw / 2, c, 40 + R() * 40, 3, true); peak = Math.min(peak, by);
      } else if (flat && rw > 14 && R() < 0.05) {
        const cx = rx + rw * 0.5; add('crn', rect(cx - 0.6, rtop - 28, 1.2, 28) + rect(cx - 14, rtop - 24.6, 38, 1.2) + poly([[cx - 0.6, rtop - 30], [cx + 24, rtop - 24.6], [cx + 24, rtop - 24], [cx - 0.6, rtop - 29.2]]) + poly([[cx + 0.6, rtop - 30], [cx - 14, rtop - 24.6], [cx - 14, rtop - 24], [cx + 0.6, rtop - 29.2]]) + rect(cx + 16.7, rtop - 24, 0.5, 12) + rect(cx + 15.4, rtop - 12, 3, 2) + rect(cx - 13, rtop - 23.4, 5, 3.4));
        add('redB', dot(cx + 24, rtop - 24)); add('redBH', dot(cx + 24, rtop - 24));
      }
      if (rtop < 452 && w > 12 && R() < (hero ? 0.4 : 0.17)) {             // facade sign: vertical CJK or horizontal Latin
        const c = signCol(), vert = R() < 0.6;
        if (vert) {
          const str = x < 1980 ? HERO_ZH[zi++ % HERO_ZH.length] : '', gs = x < 1980 ? 6.2 : 5, bw = gs + 3, bh = Math.max(str.length, 2) * gs * 1.04 + 4;
          const bx = R() < 0.5 ? x + 1.2 : x + w - bw - 1.2, by = tiers[0][2] + 5;
          if (by + bh < 468) {
            add('sgvB', rect(bx, by, bw, bh)); add('sgv:' + c, rect(bx + 0.4, by + 0.4, bw - 0.8, bh - 0.8));
            add('sgvT:' + c, str ? vtxt(str, bx + bw / 2, by + 1.2, gs) : rect(bx + 2, by + 2.5, bw - 4, 1.5) + rect(bx + 2, by + 5.5, bw - 4, 1.5) + rect(bx + 2, by + 8.5, bw - 4, 1.5));
            reflect(bx + bw / 2, c, 50 + R() * 30, 2.6, true);
          }
        } else {
          const str = x < 1980 ? HERO_EN[ei++ % HERO_EN.length] : '', gs = 5.4, tw0 = str ? txtW(str, gs, 0.4) : w * 0.6, bw = Math.min(w - 2, tw0 + 4), bx = x + (w - bw) / 2, by = rtop + 6;
          if (tw0 + 4 < w) {
            add('sghB', rect(bx, by, bw, 7.4)); add('sgh:' + c, rect(bx + 0.4, by + 0.4, bw - 0.8, 6.6));
            add('sghT:' + c, str ? txt(str, bx + bw / 2, by + 5.9, gs, { anchor: 'middle', track: 0.4 }) : rect(bx + 2, by + 2.6, bw - 4, 2.2));
            reflect(bx + bw / 2, c, 44 + R() * 30, 2.6, true);
          }
        }
      }
    }
    if (hero) (band === 'A' ? heroA : heroB).push(G(DD(TAG[band]), emit(pc, true, 0, ORDER.length)));
    return { x, w, top: tiers[0][2], peak };
  }
  // ---- bands: A far (tall, haze violet), B mid (dark), C waterfront (black, lit shopfronts and promenade lamps)
  const run = (band, wmin, wmax, hmin, hmax, gmin, gmax) => {
    const out = [];
    for (let x = XA + R() * 8; x < XB;) {
      const w = wmin + R() * (wmax - wmin); if (x + w > XB) break;
      const key = keyAtPano(x + w / 2), T = TALL[key] ?? 0.8;
      const env = 0.62 + 0.38 * Math.sin(x / 610 + 1.3) * Math.sin(x / 1730 + 0.4);
      const hg = (hmin + (hmax - hmin) * Math.pow(R(), 1.45)) * T * (0.72 + 0.5 * env);
      out.push(tower(band, x, w, 472 - Math.max(8, hg), heroWin(x + w / 2)));
      x += w + gmin + R() * (gmax - gmin);
    }
    return out;
  };
  run('A', 16, 46, 48, 172, 0, 4);
  const bt = run('B', 14, 40, 20, 104, 3, 22);
  // skybridges between close neighbours of the mid band
  for (let i = 1; i < bt.length; i++) {
    const a = bt[i - 1], b = bt[i], g = b.x - (a.x + a.w);
    if (g > 0 && g < 14 && a.top < 440 && b.top < 440 && R() < 0.5) { const y = Math.max(a.top, b.top) + 8 + R() * 14, m = bucket(a.x); put(m, 'brg', rect(a.x + a.w - 0.5, y, g + 1, 2.2) + rect(a.x + a.w - 0.5, y + 5, g + 1, 1.2)); put(m, 'brgL', `M${f(a.x + a.w)} ${f(y + 1.1)}h${f(g)}`); }
  }
  // waterfront band C
  for (let x = XA; x < XB;) {
    const w = 20 + R() * 50, hh = 4 + R() * 9, m = bucket(x); if (x + w > XB) break;
    put(m, 'C', rect(x, 472 - hh, w, hh + 1) + (R() < 0.3 ? rect(x + w * 0.2, 472 - hh - 3, w * 0.3, 3) : ''));
    put(m, 'Chi', `M${f(x)} ${f(472 - hh + 0.4)}h${f(w)}`);
    for (let sx = x + 3; sx < x + w - 5; sx += 6 + R() * 8) if (R() < 0.45) { const c = litCol(), sw = 2 + R() * 3; put(m, 'shop:' + (c === 'acid' ? 'amber' : c), rect(sx, 469.2, sw, 2.2)); if (R() < 0.4) reflect(sx + sw / 2, c, 10 + R() * 18, 1.4, false); }
    x += w + R() * 3;
  }
  for (let x = XA; x < XB; x += BK / 4) { const m = bucket(x), x1 = Math.min(XB, x + BK / 4); put(m, 'post', `M${f(x)} 468.7H${f(x1)}`); put(m, 'prom', `M${f(x + 0.3)} 465H${f(x1)}`); put(m, 'promH', `M${f(x + 0.3)} 465H${f(x1)}`); }
  for (let x = XA + 0.3; x < XB; x += 12) if (R() < 0.3) reflect(x, 'amber', 8 + R() * 14, 1, false);
  // ---- district set pieces along the route (outside the hero frame; the skyline changes with the ride)
  const SPD = {};
  for (const key of ['dunes', 'funfair', 'bridge', 'fort', 'pines']) {
    const s = { dunes: [15.5, 18], funfair: [5.5, 7.5], bridge: [18, 19.5], fort: [19.5, 21.5], pines: [21.5, 24] }[key];
    SPD[key] = panoOf((s[0] + s[1]) / 2 * KM);
  }
  {
    // refinery on the low dunes skyline: stacks, flares, spherical tanks, a pipe rack
    const x = SPD.dunes, m = bucket(x);
    let d = '', fl = '';
    for (let k = 0; k < 5; k++) { const sx = x - 120 + k * 52, sh = 40 + (k % 2) * 22; d += rect(sx, 472 - sh, 4, sh) + rect(sx - 1, 472 - sh, 6, 2); fl += `M${f(sx + 2)} ${f(472 - sh - 1)}c-4 -5 -1 -10 0 -15c1 5 5 9 0 15Z`; reflect(sx + 2, 'amber', 70, 3, true); }
    for (let k = 0; k < 3; k++) d += circ(x - 60 + k * 50, 462, 9) + rect(x - 62 + k * 50, 462, 4, 10);
    d += rect(x - 140, 452, 280, 2) + rect(x - 140, 458, 280, 1.4);
    put(m, 'sp', d); put(m, 'spR:amber', fl); put(m, 'spL:amber', `M${f(x - 140)} 451.6h280`);
  }
  {
    // arcade district: a far ferris wheel with LED rim and spokes
    const x = SPD.funfair, cy = 404, r = 44, m = bucket(x);
    let sp = '', leds = '';
    for (let k = 0; k < 16; k++) { const a = k * 22.5 * D2R; sp += `M${f(x)} ${cy}L${f(x + Math.cos(a) * r)} ${f(cy + Math.sin(a) * r)}`; leds += circ(x + Math.cos(a) * r, cy + Math.sin(a) * r, 1.4); }
    put(m, 'sp', `M${f(x - 28)} 472L${f(x)} ${cy}L${f(x + 28)} 472L${f(x + 25)} 472L${f(x)} ${cy + 6}L${f(x - 25)} 472Z`);
    put(m, 'spL:violet', circ(x, cy, r)); put(m, 'spL:cyan', sp + circ(x, cy, r * 0.35)); put(m, 'spR:mag', leds);
    reflect(x, 'violet', 80, 3, true); reflect(x - 30, 'mag', 50, 2.4, true); reflect(x + 30, 'cyan', 50, 2.4, true);
  }
  {
    // the cable-stay skybridge far across the river mouth: two pylons, fan cables, a lit deck
    const x = SPD.bridge, m = bucket(x);
    let d = '', cab = '';
    for (const px of [x - 170, x + 170]) {
      d += poly([[px - 12, 472], [px - 2, 300], [px + 2, 300], [px + 12, 472], [px + 8, 472], [px, 330], [px - 8, 472]]);
      for (let k = 1; k <= 7; k++) cab += `M${f(px)} ${f(304 + k * 5)}L${f(px - k * 22)} 452M${f(px)} ${f(304 + k * 5)}L${f(px + k * 22)} 452`;
    }
    d += rect(x - 340, 451, 680, 4);
    put(m, 'sp', d); put(m, 'spL:cyan', cab); put(m, 'spL:amber', `M${f(x - 340)} 453H${f(x + 340)}`); put(m, 'spR:red', circ(x - 170, 298, 1.6) + circ(x + 170, 298, 1.6));
    reflect(x - 170, 'red', 60, 2.4, true); reflect(x + 170, 'red', 60, 2.4, true);
  }
  {
    // the old-town temple between the towers: a five-tier pagoda with red lanterns
    const x = SPD.fort, m = bucket(x);
    let d = '', lan = '';
    for (let k = 0; k < 5; k++) { const y = 470 - k * 17, w = 34 - k * 5; d += rect(x - w / 2 + 3, y - 12, w - 6, 13) + `M${f(x - w / 2 - 6)} ${f(y - 11)}Q${f(x - w / 2)} ${f(y - 13)} ${f(x - w / 2 + 2)} ${f(y - 18)}H${f(x + w / 2 - 2)}Q${f(x + w / 2)} ${f(y - 13)} ${f(x + w / 2 + 6)} ${f(y - 11)}Z`; lan += circ(x - w / 2 - 4, y - 8, 1.6) + circ(x + w / 2 + 4, y - 8, 1.6); }
    d += rect(x - 0.8, 370, 1.6, 16);
    put(m, 'sp', d); put(m, 'spR:red', lan); reflect(x, 'red', 60, 2.4, true);
  }
  {
    // hydroponic garden: glass grow domes under purple grow lights
    const x = SPD.pines, m = bucket(x);
    let d = '', lat = '';
    for (let k = 0; k < 5; k++) { const cx = x - 120 + k * 60, r = 18 + (k % 3) * 6; d += `M${f(cx - r)} 472A${f(r)} ${f(r * 0.8)} 0 0 1 ${f(cx + r)} 472Z`; lat += `M${f(cx)} ${f(472 - r * 0.8)}V472M${f(cx - r * 0.7)} ${f(472 - r * 0.56)}H${f(cx + r * 0.7)}`; reflect(cx, 'violet', 50, 3, true); }
    put(m, 'spR:violet', d); put(m, 'spL:violet', lat);
  }
  // ---- two static holograms over the hero skyline: the only bloom filter of this module (static far sheet)
  let holo = '', koiClip = '', pelClip = '';
  {
    // a giant koi over the right of the hero skyline
    const cx = 1452, cy = 350;
    const koi = `M${cx - 30} ${cy}C${cx - 22} ${cy - 13} ${cx + 4} ${cy - 16} ${cx + 22} ${cy - 6}C${cx + 28} ${cy - 3} ${cx + 30} ${cy + 1} ${cx + 28} ${cy + 3}C${cx + 18} ${cy + 12} ${cx - 10} ${cy + 12} ${cx - 30} ${cy}Z` +
      `M${cx - 28} ${cy}L${cx - 46} ${cy - 13}L${cx - 40} ${cy}L${cx - 46} ${cy + 12}Z` + `M${cx - 4} ${cy - 13}L${cx - 12} ${cy - 22}L${cx + 6} ${cy - 13}Z` + `M${cx + 2} ${cy + 9}L${cx - 4} ${cy + 17}L${cx + 10} ${cy + 8}Z`;
    let scan = ''; for (let y = cy - 20; y < cy + 16; y += 2.2) scan += `M${cx - 48} ${f1(y)}H${cx + 32}`;
    const scales = `M${cx - 14} ${cy - 5}q3 3 0 6M${cx - 8} ${cy - 7}q3 4 0 8M${cx - 2} ${cy - 8}q3 4 0 9M${cx + 4} ${cy - 8}q3 4 0 9M${cx + 10} ${cy - 6}q3 3 0 7`;
    holo += G({ ...DD('sea:O:holo-projector') },
      F(rect(cx - 16, 404, 32, 69), v('hillNear')), F(rect(cx - 18, 402, 36, 3), v('mega')),
      S(`M${cx - 12} 410V470M${cx - 8} 410V470M${cx - 4} 410V470M${cx} 410V470M${cx + 4} 410V470M${cx + 8} 410V470M${cx + 12} 410V470`, N.amber, 1.4, { 'stroke-dasharray': '2.2 1.5 2.2 5.2', 'stroke-linecap': 'butt', ...LITV }),
      F(`M${cx - 6} 402L${cx - 34} ${cy + 8}L${cx + 26} ${cy + 8}L${cx + 6} 402Z`, 'url(#sea-projG)'), F(rect(cx - 7, 398, 14, 4), v('mega')), F(rect(cx - 5, 397, 10, 1.4), N.cyan));
    holo += G({ ...DD('sea:O:holo-koi'), filter: 'url(#sea-bloom)', ...NEONV },
      F(koi, N.cyan, { opacity: 0.2 }), S(koi, N.cyan, 1.1), S(scales, N.cyanCore, 0.7, { opacity: 0.8 }), F(circ(cx + 18, cy - 3, 1.5), N.cyanCore),
      G({ ...DD('sea:T:holo-scanlines'), 'clip-path': 'url(#sea-koiClip)' }, S(scan, N.cyanCore, 0.5, { opacity: 0.55 })));
    reflect(cx, 'cyan', 96, 3.4, true, true); reflect(cx - 16, 'cyan', 60, 1.4, false); reflect(cx + 14, 'cyan', 60, 1.4, false);
    koiClip = h('clipPath', { id: 'sea-koiClip' }, F(koi, '#000'));
  }
  {
    // a pelican-head advert hologram over the left skyline (magenta), projected from a mast
    const cx = 150, cy = 300;
    const head = `M${cx - 14} ${cy + 22}C${cx - 18} ${cy + 4} ${cx - 12} ${cy - 12} ${cx} ${cy - 13}C${cx + 9} ${cy - 13} ${cx + 13} ${cy - 7} ${cx + 14} ${cy - 3}L${cx + 52} ${cy + 6}L${cx + 50} ${cy + 9}C${cx + 38} ${cy + 18} ${cx + 22} ${cy + 20} ${cx + 12} ${cy + 12}C${cx + 8} ${cy + 16} ${cx + 4} ${cy + 22} ${cx + 2} ${cy + 30}Z`;
    const detail = `M${cx + 14} ${cy - 3}C${cx + 26} ${cy + 1} ${cx + 38} ${cy + 3} ${cx + 50} ${cy + 7}M${cx + 12} ${cy + 3}C${cx + 22} ${cy + 12} ${cx + 36} ${cy + 12} ${cx + 48} ${cy + 9}M${cx - 7} ${cy - 12}l-8 -9l6 1l-2 -7l6 6`;
    let scan = ''; for (let y = cy - 22; y < cy + 30; y += 2.2) scan += `M${cx - 22} ${f1(y)}H${cx + 54}`;
    holo += G({ ...DD('sea:O:holo-pelican-ad'), filter: 'url(#sea-bloom)', ...NEONV },
      F(head, N.mag, { opacity: 0.18 }), S(head, N.mag, 1.1), S(detail, N.magCore, 0.8, { opacity: 0.85 }), F(circ(cx + 3, cy - 4, 1.8), N.magCore),
      G({ 'clip-path': 'url(#sea-pelClip)' }, S(scan, N.magCore, 0.5, { opacity: 0.45 })),
      F(txt('鹈鹕航运', cx + 18, cy + 44, 9, { anchor: 'middle' }), N.mag), F(txt('PELICAN LINES', cx + 18, cy + 53, 5, { anchor: 'middle', track: 0.6 }), N.magCore));
    holo += G({}, F(`M${cx - 2} 470L${cx - 3} 360H${cx + 3}L${cx + 2} 470Z`, v('hillNear')), F(`M${cx - 2} 360L${cx - 20} ${cy + 30}L${cx + 30} ${cy + 30}L${cx + 2} 360Z`, 'url(#sea-projGm)'), F(circ(cx, 359, 2), N.mag));
    reflect(cx + 18, 'mag', 80, 3.2, true, true);
    pelClip = h('clipPath', { id: 'sea-pelClip' }, F(head, '#000'));
  }
  const lgv = (id, col, a0, a1) => h('linearGradient', { id, x1: 0, y1: 1, x2: 0, y2: 0 }, h('stop', { offset: 0, 'stop-color': col, 'stop-opacity': a0 }), h('stop', { offset: 1, 'stop-color': col, 'stop-opacity': a1 }));
  let defs = koiClip + pelClip + lgv('sea-projG', N.cyan, 0.34, 0) + lgv('sea-projGm', N.mag, 0.3, 0.02) +
    h('linearGradient', { id: 'sea-hazeG', x1: 0, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: 0, 'stop-color': v('haze'), 'stop-opacity': 0 }), h('stop', { offset: 0.7, 'stop-color': v('haze'), 'stop-opacity': 0.42 }), h('stop', { offset: 1, 'stop-color': v('cityGlow'), 'stop-opacity': 0.45 }));
  // ---- assemble the tile: per bucket A · (hero A towers) · haze · B · (hero B towers + holograms) · specials · C
  let tile = '';
  for (const [k, m] of [...buckets].sort((a, b) => a[0] - b[0])) {
    const bx0 = XA + k * BK, hero = k === 0;
    tile += emit(m, false, 0, rank('|heroA')) + (hero ? heroA.join('') : '') +
      F(rect(bx0, 424, BK, 49), 'url(#sea-hazeG)', hero ? DD('sea:O:haze-band') : {}) +
      emit(m, false, rank('B'), rank('|heroB')) + (hero ? heroB.join('') + holo : '') + emit(m, false, rank('|heroB') + 1, ORDER.length);
  }
  const markup = h('g', { 'data-ref': 'sea-hills' }, h('g', { id: 'sea-pano' }, tile), h('use', { href: '#sea-pano', x: f(-W_H) }));
  // ---- the reflection strip (drawn in L-sea, scrolled like the skyline)
  const RCOL = { amber: N.amber, white: N.white, cyan: N.cyan, mag: N.mag, acid: N.acid, violet: N.violet, red: N.red };
  let rt = '';
  for (const [k, m] of [...refl].sort((a, b) => a[0] - b[0])) {
    for (const [key, d] of m) {
      const [p, c] = key.split(':'), T = k === 0 ? DD('sea:O:skyline-reflections') : {};
      if (p === 'rp') rt += S(d, RCOL[c], 9, { opacity: 0.17, 'stroke-dasharray': '16 3 12 5 8 7 6 9 4 12', 'stroke-linecap': 'butt', ...LITV, ...(k === 0 ? DD('sea:O:reflection-glow-pools') : {}) });
      else if (p === 'rq') rt += F(d, `url(#sea-rp-${c})`, { opacity: c === 'acid' || c === 'white' ? 0.8 : 1, ...LITV, ...T });
    }
  }
  const reflM = h('g', { 'data-ref': 'sea-refl' }, h('g', { id: 'sea-reflpano' }, rt, G(LITV, reflHero.join(''))), h('use', { href: '#sea-reflpano', x: f(-W_H) }));
  return { markup, defs, refl: reflM };
}

// ============================================================================ L-lighthouse: the DATA SPIRE on its podium
function buildSpire(v, rng) {
  const R = rng('sea-spire');
  const X = LAMP.x;
  let g = '', defs = '', q = '', z = '', y = '';
  // stepped arcology podium (the old cape)
  const P = [[925, 472], [925, 452], [948, 440], [990, 440], [990, 420], [1052, 420], [1062, 402], [1250, 402], [1256, 418], [1272, 418], [1276, 440], [1292, 440], [1298, 472]];
  const faces = poly([[1250, 402], [1256, 418], [1262, 418], [1256, 402]]) + poly([[1272, 418], [1276, 440], [1282, 440], [1278, 418]]) + poly([[1292, 440], [1298, 472], [1290, 472]]);
  g += G(DD('sea:O:spire-podium'), F(poly(P) + rect(925, 472, 373, 8), v('mega')), F(faces, v('megaHi')),
    S('M925 452L948 440H990V420H1052L1062 402H1250', v('megaHi'), 1),
    G({ ...NEONV }, tube('M1250 402L1256 418H1272L1276 440H1292L1298 472', N.mag, null, 0.9)), '%%POD%%');
  // panel seams
  let seam = 'M927 456H1296M992 430H1274M1060 411H1252';
  for (let x = 940; x < 1296; x += 36) seam += `M${x} 441V472`;
  for (let x = 1000; x < 1272; x += 30) seam += `M${x} 421V440`;
  q += G(DD('sea:T:podium-panels'), S(seam, v('megaHi'), 0.55, { opacity: 0.6 }));
  // windows: dashed columns on the three step faces
  let dim = '', am = '', cy = '', wh = '';
  const cols = (x0, x1, y0, y1) => { for (let x = x0; x < x1; x += 3.8) { const d = `M${f1(x)} ${y0}V${y1}`, u = R(); if (u < 0.34) am += d; else if (u < 0.52) cy += d; else if (u < 0.6) wh += d; else dim += d; } };
  cols(952, 1288, 444, 470); cols(994, 1268, 424, 438); cols(1066, 1248, 406, 418);
  const wd = { 'stroke-dasharray': '2.2 1.5', 'stroke-linecap': 'butt' };
  q += G(DD('sea:T:podium-windows'), S(dim, v('megaHi'), 1.5, wd), G(LITV, S(am, N.amber, 1.5, wd), S(cy, N.cyan, 1.5, { ...wd, 'stroke-dasharray': '2.2 1.5 2.2 5.2' }), S(wh, N.white, 1.5, wd)));
  // hazard edges on the step lips
  defs += h('pattern', { id: 'sea-hazP', width: 4, height: 4, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, F(rect(0, 0, 4, 4), N.acid), F(rect(0, 0, 2, 4), N.void));
  q += G(DD('sea:O:hazard-edges'), F(rect(948, 439, 42, 2.2) + rect(990, 419, 62, 2.2) + rect(1276, 439, 16, 2.2) + rect(1256, 417, 16, 2.2), 'url(#sea-hazP)'));
  // sign: 数据塔 DATA SPIRE
  g += G({ ...DD('sea:O:spire-sign'), ...NEONV }, F(rect(1000, 423.5, 88, 13.5), N.void, { opacity: 0.9 }), tube(rect(1000.5, 424, 87, 12.5), N.cyan, null, 0.8),
    F(txt('数据塔', 1004, 434.5, 8.6), N.cyan), F(txt('DATA SPIRE', 1037, 433.7, 4.6, { track: 0.5 }), N.cyanCore), F(rect(1037, 426.5, 46, 1), N.mag));
  // stair lights up the podium
  q += G(DD('sea:O:stair-lights'), S('M936 466L984 454L958 446L1000 441M1002 438L1044 428L1016 423L1056 419M1058 416L1066 404', v('megaHi'), 1.4),
    S('M936 466L984 454L958 446L1000 441M1002 438L1044 428L1016 423L1056 419M1058 416L1066 404', N.amber, 1.3, { 'stroke-dasharray': '0.1 3.2', ...LITV }));
  // guard rail along the plaza edge
  let rail = ''; for (let x = 1172; x <= 1234; x += 4.2) rail += `M${f(x)} 401.5v-5.5`;
  g += G(DD('sea:O:guard-rail'), S(rail + 'M1171 397H1235M1171 399.6H1235', v('megaHi'), 0.8), S('M1171 396.8H1235', N.acid, 0.5, { opacity: 0.7 }));
  // control bunker with a dish
  g += G(DD('sea:O:control-bunker'),
    F('M1084 402V388L1090 383H1122L1128 388V402Z', v('seaSteel')), F('M1122 383L1128 388V402H1124V389Z', v('megaHi')),
    F(rect(1089, 389, 7, 4) + rect(1099, 389, 7, 4) + rect(1109, 389, 7, 4), N.cyan, LITV), F(rect(1117, 392, 4, 10), N.amber, LITV),
    S('M1100 383V376M1100 376l-6 -6', v('megaHi'), 1), F('M1090 372a8 4 -40 0 1 12 -9l-2 3Z', v('megaHi')), F(circ(1096, 369, 1), N.acid));
  // comm mast with holo flags and a ticker
  g += G(DD('sea:O:comm-mast'),
    S('M1216 401V346M1206 358H1226M1209 368H1223M1216 372L1206 358M1216 372L1226 358M1212 346H1220', v('megaHi'), 1),
    F(rect(1211, 396, 10, 6), v('seaSteel')), F(rect(1220, 390, 12, 4), N.void), F(rect(1221, 391.2, 10, 1.6), N.acid, { ...NEONV, opacity: 0.9 }), '%%MAST%%');
  y += G({ ...DD('sea:O:holo-flags'), ...NEONV }, F(rect(1201, 359, 5, 6) + rect(1226, 359, 5, 6), N.cyan, { opacity: 0.4 }), S(rect(1201, 359, 5, 6) + rect(1226, 359, 5, 6), N.cyan, 0.6),
    F(rect(1203.5, 369, 5, 5), N.mag, { opacity: 0.4 }), S(rect(1203.5, 369, 5, 5), N.mag, 0.6));
  // the spire: tapered shaft, dual rim light, neon collars, slits, service door, the lift
  const yb = 402, yt = 284, wb = 13, wt = 8.5, tw = y => lerp(wb, wt, (yb - y) / (yb - yt));
  const shaft = poly([[X - wb, yb], [X - wt, yt], [X + wt, yt], [X + wb, yb]]);
  g += G(DD('sea:O:spire-shaft'), F(shaft, v('mega')), F(poly([[X + 2, yb], [X + 1.4, yt], [X + wt, yt], [X + wb, yb]]), v('megaHi'), { opacity: 0.45 }),
    S(`M${X - 4} ${yb - 4}L${X - 2.8} ${yt + 4}M${X + 5} ${yb - 4}L${X + 3.6} ${yt + 4}`, v('megaHi'), 0.6), '%%SHAFT%%');
  z += G({ ...DD('sea:O:spire-rim-light'), ...NEONV }, tube(`M${X - wb + 0.6} ${yb}L${X - wt + 0.5} ${yt}`, N.cyan, N.cyanCore, 0.9), tube(`M${X + wb - 0.6} ${yb}L${X + wt - 0.5} ${yt}`, N.mag, null, 0.9));
  let col = '', colM = '';
  for (const y of [382, 350, 318]) { col += `M${f(X - tw(y))} ${y}H${f(X + tw(y))}`; colM += `M${f(X - tw(y + 3))} ${y + 3}H${f(X + tw(y + 3))}`; }
  z += G({ ...DD('sea:O:spire-collars'), ...NEONV }, F([382, 350, 318].map(y => poly([[X - tw(y + 5), y + 5], [X - tw(y - 3), y - 3], [X + tw(y - 3), y - 3], [X + tw(y + 5), y + 5]])).join(''), v('seaSteel')),
    tube(col, N.cyan, N.cyanCore, 1.1), tube(colM, N.mag, null, 0.7));
  z += G(DD('sea:O:spire-slits'), F(rect(X + 1, 358, 2.6, 6) + rect(X - 3.4, 328, 2.4, 5.5) + rect(X + 1.2, 296, 2.2, 5) + rect(X - 3, 390, 2.4, 5) + rect(X + 0.6, 336, 2.2, 4), N.amber, LITV),
    F(`M${X - 4} ${yb}V${yb - 8}A4 4 0 0 1 ${X + 4} ${yb - 8}V${yb}Z`, N.void), F(`M${X - 2.6} ${yb}V${yb - 7.4}A2.6 2.6 0 0 1 ${X + 2.6} ${yb - 7.4}V${yb}Z`, N.amber, { opacity: 0.8, ...LITV }));
  z += G(DD('sea:O:spire-lift'), S(`M${X + 6.5} ${yb - 2}L${X + 4.6} ${yt + 6}`, v('seaSteel'), 1.2),
    G({ 'data-ref': 'sea-lift', transform: `translate(${X + 5.6} 340)` }, F(rect(-1.8, -3.2, 3.6, 6.4), N.amber), F(rect(-1.2, -2.4, 2.4, 2), N.amberCore)));
  // observation ring
  let posts = ''; for (let x = X - 13; x <= X + 13.1; x += 3.25) posts += `M${f(x)} ${yt - 1}v-6`;
  z += G(DD('sea:O:observation-ring'), F(rect(X - 15, yt - 1, 30, 4) + poly([[X - 12, yt + 3], [X - 7, yt + 3], [X - 7, yt + 8]]) + poly([[X + 12, yt + 3], [X + 7, yt + 3], [X + 7, yt + 8]]), v('seaSteel')),
    S(posts + `M${X - 13.5} ${yt - 7}H${X + 13.5}`, v('megaHi'), 0.7), G(NEONV, tube(`M${X - 14} ${yt + 3.4}H${X + 14}`, N.cyan, N.cyanCore, 0.9)));
  // beacon housing: glass drum, emitter, astragals
  z += G(DD('sea:O:beacon-housing'), F(rect(X - 8, 262, 16, 15), v('mega')), F(rect(X - 8, 262, 16, 15), N.cyan, { opacity: 0.32, ...NEONV }),
    F(rect(X - 3.2, 264, 6.4, 11), N.cyanCore), S(`M${X - 3} 266.5h6M${X - 3} 269.5h6M${X - 3} 272.5h6`, N.cyan, 0.6),
    S(`M${X - 8} 262h16v15h-16ZM${X - 4.5} 262v15M${X + 4.5} 262v15`, v('seaSteel'), 1));
  z += G(DD('sea:O:antenna-crown'), F(`M${X - 10} 262L${X - 3} 250H${X + 3}L${X + 10} 262Z`, v('mega')), S(`M${X - 10} 262L${X - 3} 250H${X + 3}`, N.mag, 0.6, { opacity: 0.8 }),
    S(`M${X} 250V222M${X - 5} 236H${X + 5}M${X - 3} 229H${X + 3}M${X + 5} 250l6 -10`, v('megaHi'), 0.9), F(`M${X + 8} 242a5 2.4 -30 0 1 7 -5l-1 2Z`, v('megaHi')));
  g += G({ 'data-ref': 'sea-spRed' }, G(DD('sea:O:spire-warning-lights'), F(circ(X, 221, 1.5), N.red), F(circ(X, 221, 4.4), N.red, { opacity: 0.25 })), F(circ(1216, 345, 1.3) + circ(925.5, 451, 1.1) + circ(1297, 471, 1.1), N.red),
    F(circ(1216, 345, 3.4), N.red, { opacity: 0.25 }));
  g = g.replace('%%POD%%', q).replace('%%SHAFT%%', z).replace('%%MAST%%', y);
  // the searchlight beam: its own small sheet (a pure translate; the sweep repaints only the beam)
  const beam = h('g', { 'data-ref': 'sea-beam', transform: `translate(${LAMP.x} ${LAMP.y})`, style: 'opacity:var(--pb-n-search)' },
    h('g', { 'data-ref': 'sea-beamRot', ...DD('sea:O:searchlight-beam') },
      F('M0 -3L900 -56L900 56L0 3Z', N.cyanCore, { opacity: 0.09 , style: 'pointer-events:none !important' }),
      F('M0 -2L900 -22L900 22L0 2Z', N.cyanCore, { opacity: 0.16 , style: 'pointer-events:none !important' }),
      S('M6 -2L900 -46M6 -1L900 -30M8 0L900 -10M8 0L900 10M6 1L900 30M6 2L900 46', N.cyan, 1, { opacity: 0.4, 'stroke-dasharray': '60 14 30 10' })),
    h('circle', { 'data-ref': 'sea-lantern', r: 26, fill: 'url(#sea-gCyan)' }));
  // the spire's reflection (in L-sea, scrolled with the spire)
  let am2 = '', cy2 = '';
  for (let x = 956; x < 1288; x += 11 + R() * 18) { const d = rect(x - 2.4, 474, 4.8, 14 + R() * 30); if (R() < 0.65) am2 += d; else cy2 += d; }
  const refl = h('g', { 'data-ref': 'sea-caperefl' }, G({ ...DD('sea:O:spire-reflection'), ...LITV },
    S(`M${X} 474V610`, N.cyan, 11, { opacity: 0.12, 'stroke-dasharray': '18 3 14 5 9 8 6 11', 'stroke-linecap': 'butt' }),
    F(rect(X - 5, 474, 10, 128), 'url(#sea-rp-core)', { opacity: 0.9 }), F(rect(X - 8, 474, 16, 70), 'url(#sea-rp-cyan)', { opacity: 0.6 }),
    S(`M${X - 12} 478h24M${X - 9} 486h18M${X - 7} 495h14M${X - 5} 505h10`, N.cyan, 1, { opacity: 0.6 }),
    F(am2, 'url(#sea-rp-amber)', { opacity: 0.8 }), F(cy2, 'url(#sea-rp-cyan)', { opacity: 0.75 }),
    F(rect(1041, 474, 7, 66) + rect(1061, 474, 6, 56) + rect(1021, 474, 6, 46), 'url(#sea-rp-cyan)', { opacity: 0.8 }),
    F(rect(1294, 474, 6, 46) + rect(1273, 474, 6, 32), 'url(#sea-rp-mag)', { opacity: 0.8 })));
  return { markup: h('g', { 'data-ref': 'sea-cape' }, g) + beam, refl, defs };
}


// the dark water + the city glow on the horizon: x-invariant (only follows the camera), drawn at the back of
// L-hills-far so the podium, the port and every reflection stand in it
function buildWater(v, rng) {
  const R = rng('sea-water');
  let m = '', defs = '';
  defs += h('linearGradient', { id: 'sea-waterG', gradientUnits: 'userSpaceOnUse', x1: 0, y1: HZ, x2: 0, y2: 660 },
    h('stop', { offset: 0, 'stop-color': v('seaFar') }), h('stop', { offset: 0.4, 'stop-color': v('seaNear') }), h('stop', { offset: 1, 'stop-color': v('seaNear') }));
  defs += h('linearGradient', { id: 'sea-hzG', x1: 0, y1: 0, x2: 0, y2: 1 },
    h('stop', { offset: 0, 'stop-color': v('cityGlow'), 'stop-opacity': 0.5 }), h('stop', { offset: 0.3, 'stop-color': v('cityGlow'), 'stop-opacity': 0.22 }), h('stop', { offset: 1, 'stop-color': v('cityGlow'), 'stop-opacity': 0 }));
  const XS = 700, halves = (key, fn) => G(DD(key), fn(X0, XS + 1)) + G(DD(key), fn(XS, X1));
  m += halves('sea:O:harbour-water', (a, b) => F(rect(a, HZ, b - a, 560), 'url(#sea-waterG)'));
  m += G(DD('sea:O:horizon-glow'), F(rect(X0, HZ - 0.5, X1 - X0, 30), 'url(#sea-hzG)'),
    S((() => { let d = ''; for (let x = X0; x < X1; x += 30 + R() * 60) d += `M${f(x)} ${f1(473.5 + R() * 2)}h${f(10 + R() * 40)}`; return d; })(), v('smogLit'), 0.8, { opacity: 0.7 }));
  return { markup: m, defs };
}

// ============================================================================ L-sea: water, reflections, ripples, port
function buildSea(v, rng, skyRefl, capeRefl) {
  const R = rng('sea-surface');
  let m = '', defs = '';
  // ---- long neon reflections of the skyline (a strip scrolled with the skyline) and of the data spire
  m += skyRefl + capeRefl;
  // ---- ripple bands (each scrolls at its own depth; generated periodic over its tile): they break the reflections
  const bandTile = (i, gen) => { const W = BANDS[i][1], d = gen(W); return h('g', { 'data-ref': 'sea-w' + i }, h('g', {}, d), h('g', { transform: `translate(${f(W)} 0)` }, d)); };
  const periodic = (W, x, len, fn) => fn(x) + (x + len > X0 + W ? fn(x - W) : '');
  const CF = (d, ink, o) => chunks(d).map(c => F(c, ink, o)).join(''), CS = (d, ink, w, o) => chunks(d).map(c => S(c, ink, w, o)).join('');
  const lens = (xx, y, len, hh) => `M${f(xx)} ${f(y)}q${f(len / 2)} ${f(-hh * 1.6)} ${f(len)} 0q${f(-len / 2)} ${f(-hh * 0.5)} ${f(-len)} 0Z`;
  // 0: far ripple ticks lit by the city + dark ripple lines
  m += bandTile(0, W => {
    let d = '', dk = '';
    for (let y = 477; y < 503; y += 3.6 + (y - 470) * 0.05) {
      const t = (y - 470) / 40, len = 4 + t * 7;
      for (let x = X0 + R() * 50; x < X0 + W; x += 24 + R() * 58) d += periodic(W, x, len, xx => lens(xx, y, len, 0.7 + t * 1.2));
      for (let x = X0 + R() * 40; x < X0 + W; x += 30 + R() * 60) { const l = 14 + R() * 40; dk += periodic(W, x, l, xx => `M${f(xx)} ${f(y + 1.4)}h${f(l)}`); }
    }
    return G(DD('sea:T:dark-ripples'), CS(dk, v('seaNear'), 1.1)) + G(DD('sea:T:ripple-ticks'), CF(d, v('smogLit'), { opacity: 0.75 }));
  });
  // 1: mid ripples: dark bands, cyan and magenta glints
  m += bandTile(1, W => {
    let dk = '', gc = '', gm = '';
    for (let y = 506; y < 550; y += 5 + (y - 470) * 0.035) {
      const t = (y - 500) / 50;
      for (let x = X0 + R() * 60; x < X0 + W; x += 26 + R() * 50) { const l = 20 + R() * 60; dk += periodic(W, x, l, xx => `M${f(xx)} ${f(y)}q${f(l / 2)} ${f(1.6 + t)} ${f(l)} 0`); }
      for (let x = X0 + R() * 60; x < X0 + W; x += 28 + R() * 60) { const len = 7 + t * 9, hh = 1 + t * 1.2, c = R() < 0.62; const s = periodic(W, x, len, xx => lens(xx, y - 1.4, len, hh)); if (c) gc += s; else gm += s; }
    }
    return G(DD('sea:T:dark-ripples'), CS(dk, v('seaNear'), 1.6)) + G(DD('sea:O:neon-glints'), CF(gc, N.cyan, { opacity: 0.7, ...NEONV }), CF(gm, N.mag, { opacity: 0.65, ...NEONV }));
  });
  // scalloped swell line rows
  const scallops = (W, y0, y1, step, a0, a1, segMin, segMax, gapMin, gapMax) => {
    let d = '';
    for (let y = y0; y < y1; y += step) {
      const t = (y - y0) / (y1 - y0), a = lerp(a0, a1, t);
      for (let x = X0 + R() * 80; x < X0 + W;) {
        const n = segMin + Math.floor(R() * (segMax - segMin + 1)), len = n * 2 * a;
        d += periodic(W, x, len, xx => { let s = `M${f(xx)} ${f(y)}`; for (let k = 0; k < n; k++) s += `q${f(a)} ${f(a * 0.9)} ${f(2 * a)} 0`; return s; });
        x += len + gapMin + R() * (gapMax - gapMin);
      }
    }
    return d;
  };
  // 2: swell lines + oil sheen
  m += bandTile(2, W => {
    let oil = [[], [], []];
    for (let x = X0 + 120 + R() * 200; x < X0 + W - 60; x += 380 + R() * 520) {
      const y = 560 + R() * 26, rx = 22 + R() * 20;
      for (let k = 0; k < 3; k++) oil[k].push(periodic(W, x, rx * 2, xx => ell(xx + rx, y + k * 1.8, rx - k * 5, 3.4 - k * 0.8)));
    }
    let sheen = ''; for (let y = 558; y < 600; y += 6 + R() * 5) for (let x = X0 + R() * 120; x < X0 + W; x += 140 + R() * 220) { const l = 40 + R() * 110; sheen += periodic(W, x, l, xx => `M${f(xx)} ${f1(y)}h${f(l)}`); }
    return G(DD('sea:T:swell-lines'), CS(scallops(W, 556, 592, 7.5, 4, 5.5, 2, 5, 40, 150), v('seaFar'), 1.5)) + G(DD('sea:T:sky-sheen'), CS(sheen, v('smogLit'), 0.8, { opacity: 0.32 })) +
      G(DD('sea:O:oil-sheen'), CS(oil[0].join(''), N.violet, 1, { opacity: 0.42 }), CS(oil[1].join(''), N.cyan, 0.9, { opacity: 0.36 }), CS(oil[2].join(''), N.mag, 0.8, { opacity: 0.36 }));
  });
  // 3: near chop with lit crests, rain rings, floating litter
  m += bandTile(3, W => {
    const lines = scallops(W, 628, 650, 9, 6, 7, 2, 4, 60, 190);
    let crest = '', rings = '';
    for (let y = 598; y < 652; y += 12) for (let x = X0 + R() * 200; x < X0 + W; x += 140 + R() * 240) {
      const len = 12 + R() * 12, hh = 2.4 + R() * 1.6;
      crest += periodic(W, x, len, xx => `M${f(xx)} ${f(y)}q${f(len * 0.45)} ${f(-hh * 1.8)} ${f(len)} ${f(-hh * 0.3)}q${f(-len * 0.3)} ${f(hh * 0.5)} ${f(-len)} ${f(hh * 0.3)}Z`);
    }
    for (let x = X0 + R() * 60; x < X0 + W; x += 40 + R() * 90) { const y = 600 + R() * 50, r = 4 + R() * 6; rings += periodic(W, x, r * 2, xx => ell(xx + r, y, r, r * 0.22) + (R() < 0.5 ? ell(xx + r, y, r * 0.5, r * 0.11) : '')); }
    // floating litter (merged per colour): a 外卖 take-away box, a can, a bottle
    const LB = { box: '', lid: '', band: '', can: '', bot: '', txt: '', wake: '' };
    for (let x = X0 + 300 + R() * 300; x < X0 + W - 80; x += 900 + R() * 900) {
      const y = 612 + R() * 30;
      periodic(W, x, 60, xx => {
        LB.box += `M${f(xx - 7)} ${f(y - 4)}L${f(xx + 7)} ${f(y - 4)}L${f(xx + 6)} ${f(y + 3)}L${f(xx - 6)} ${f(y + 3)}Z`; LB.lid += `M${f(xx - 7)} ${f(y - 4)}L${f(xx - 5)} ${f(y - 7)}L${f(xx + 9)} ${f(y - 7)}L${f(xx + 7)} ${f(y - 4)}Z`;
        LB.band += rect(xx - 4, y - 2.4, 8, 3); LB.txt += txt('外卖', xx, y + 0.2, 3, { anchor: 'middle' });
        LB.can += rrect(xx + 16, y - 2.2, 8, 3.4, 1.4); LB.bot += `M${f(xx + 34)} ${f(y - 1.2)}h9l2 0.8v0.8l-2 0.8h-9Z`;
        LB.wake += `M${f(xx - 10)} ${f(y + 3.6)}q7 -2 14 0M${f(xx + 13)} ${f(y + 1.6)}q6 -1.6 12 0`; return '';
      });
    }
    const lit = F(LB.box, '#E9E6F2') + F(LB.lid, '#B8B0D8') + F(LB.band, N.mag) + F(LB.txt, '#FFFFFF') + F(LB.can, N.cyan, { opacity: 0.85 }) + F(LB.bot, '#2FA66A', { opacity: 0.8 }) + S(LB.wake, '#E9E6F2', 0.6, { opacity: 0.5 });
    return G(DD('sea:T:near-chop'), CS(lines, v('seaFar'), 1.7)) + G(DD('sea:O:lit-crests'), CF(crest, v('smogHi'), { opacity: 0.45 })) +
      G(DD('sea:O:rain-rings'), CS(rings, N.cyanCore, 0.6, { opacity: 0.4 })) + G(DD('sea:O:floating-litter'), lit);
  });
  // ---- glitter paths (positioned under the smog sun / moon each frame)
  const glitter = (seed, w0, w1, inkA, inkB, refp) => {
    const Gr = rng(seed); const rows = [[], [], []];
    for (let y = 474, i = 0; y < 648; i++) {
      const t = (y - 470) / 175, hh = 1.1 + t * 2.6, w = lerp(w0, w1, t) + Gr() * 30;
      const cx = (Gr() - 0.5) * 24, segs = 2 + Math.floor(Gr() * 3);
      let x = cx - w / 2;
      for (let s = 0; s < segs; s++) {
        const sw = Math.max(4, w / segs - 6 - Gr() * 12), r = hh / 2;
        rows[i % 3].push([`M${f(x + r)} ${f(y)}h${f(sw)}a${f(r)} ${f(r)} 0 0 1 0 ${f(hh)}h${f(-sw)}a${f(r)} ${f(r)} 0 0 1 0 ${f(-hh)}Z`, (i + s) % 3 === 1]);
        x += w / segs;
      }
      y += hh + 3.4 + t * 7;
    }
    return rows.map((row, k) => h('g', { 'data-ref': `${refp}${k}` },
      F(row.filter(r => !r[1]).map(r => r[0]).join(''), inkA, { opacity: 0.34 }), F(row.filter(r => r[1]).map(r => r[0]).join(''), inkB, { opacity: 0.5 }))).join('');
  };
  const star = (x, y, r) => `M${f(x)} ${f(y - r)}Q${f(x + r * 0.16)} ${f(y - r * 0.16)} ${f(x + r)} ${f(y)}Q${f(x + r * 0.16)} ${f(y + r * 0.16)} ${f(x)} ${f(y + r)}Q${f(x - r * 0.16)} ${f(y + r * 0.16)} ${f(x - r)} ${f(y)}Q${f(x - r * 0.16)} ${f(y - r * 0.16)} ${f(x)} ${f(y - r)}Z`;
  const sparkles = [[-30, 492, 6], [38, 530, 8], [-12, 584, 9]].map(([x, y, r], k) =>
    h('g', { transform: `translate(${x} ${y})` }, h('g', { 'data-ref': 'sea-spk' + k }, F(star(0, 0, r), v('sunCore'))))).join('');
  m += h('g', { 'data-ref': 'sea-sunG' }, G(DD('sea:O:smog-sun-glitter'), glitter('sea-sunglit', 74, 52, v('sunCore'), v('sunGlow'), 'sea-sg')),
    G(DD('sea:O:glitter-sparkles'), sparkles));
  m += h('g', { 'data-ref': 'sea-moonG', visibility: 'hidden' }, G(DD('sea:O:moon-glitter'), glitter('sea-moonglit', 64, 56, v('moon'), v('moonShade'), 'sea-mg')));
  // ---- the container port, the breakwater
  const hb = buildHarbour(v, rng);
  m += hb.markup; defs += hb.defs;
  m += buildRocks(v, rng);
  return { markup: m, defs };
}

// ---------------------------------------------------------------------------- container port (hero coords, L-sea)
function buildHarbour(v, rng) {
  const R = rng('sea-port');
  let g = '', defs = '', q = '', z = '', y = '', w = '', u = '';
  defs += h('pattern', { id: 'sea-corr', width: 1.8, height: 10, patternUnits: 'userSpaceOnUse' }, F(rect(0, 0, 0.6, 10), '#07060F', { opacity: 0.34 }));
  // ---- containers stacked on the apron (drawn behind the cranes)
  const CC = ['seaCtrM', 'seaCtrT', 'seaCtrA', 'seaCtrV', 'seaCtrS'];
  const byC = Object.fromEntries(CC.map(c => [c, ''])); let all = '', doors = '', labels = '', tops = '';
  const LBL = ['PBL', 'NEO', '7', 'PBX', 'CYB', 'PB'];
  let li = 0;
  for (let x = -150; x < 206; x += 23.4) {
    if (x > 60 && x < 115) continue;                  // the cold store sits here
    const n = 1 + Math.floor(R() * (x > 130 ? 3 : 4.4));
    for (let k = 0; k < n; k++) {
      const y = 503 - (k + 1) * 7.6, c = CC[Math.floor(R() * CC.length)], w = 22.6;
      const d = rect(x, y, w, 7.4); byC[c] += d; all += d;
      doors += `M${f(x + w - 2.2)} ${f(y + 0.8)}V${f(y + 6.6)}M${f(x + w - 4.6)} ${f(y + 0.8)}V${f(y + 6.6)}M${f(x + 1)} ${f(y + 0.4)}H${f(x + w - 1)}`;
      if (R() < 0.3) labels += txt(LBL[li++ % LBL.length], x + 3, y + 5.4, 3.8, { track: 0.3 });
      if (k === n - 1) tops += `M${f(x)} ${f(y + 0.3)}h${f(w)}`;
    }
  }
  g += G(DD('sea:O:container-stacks'), CC.map(c => F(byC[c], v(c))).join(''), S(tops, v('smogLit'), 0.6, { opacity: 0.6 }), '%%CTR%%');
  q += G(DD('sea:T:container-corrugation'), F(all, 'url(#sea-corr)'));
  q += G(DD('sea:O:container-doors'), S(doors, '#07060F', 0.45, { opacity: 0.55 }));
  q += G(DD('sea:O:container-labels'), F(labels, '#E9E6F2', { opacity: 0.8 }));
  // ---- cold store with lit roll-up doors
  g += G(DD('sea:O:cold-store'), F(rect(66, 482, 46, 21), v('seaConc')), F('M63 483L70 476H108L115 483Z', v('seaSteel')),
    F(rect(70, 490, 10, 13) + rect(84, 490, 10, 13) + rect(98, 490, 10, 13), N.amber, { opacity: 0.85, ...LITV }),
    S('M70 493h10M70 496h10M70 499h10M84 493h10M84 496h10M84 499h10M98 493h10M98 496h10M98 499h10', v('seaConc'), 0.5, { opacity: 0.7 }),
    F(rect(74, 478.6, 30, 4.4), N.void), F(txt('24H', 89, 482.2, 3.8, { anchor: 'middle', track: 0.3 }), N.acid, NEONV));
  // ---- two megastructure gantry cranes (STS): legs, portal, box girder with lattice, apex, stays, cab, trolley, spreader
  let crane = '', lat = '', stays = '', cabs = '', led = '', hooks = '', red = '', names = '', rimL = '', rimT = '';
  for (const [ci, xc] of [[0, -8], [1, 142]].map((a, i) => [i, a[1]])) {
    const back = xc - 56, tip = xc + 88, gy = 424;
    crane += poly([[xc - 20, 503], [xc - 17, gy + 5], [xc - 13.6, gy + 5], [xc - 16.4, 503]]) + poly([[xc + 20, 503], [xc + 17, gy + 5], [xc + 13.6, gy + 5], [xc + 16.4, 503]]) +
      rect(xc - 21, 468, 42, 3) + rect(xc - 22, 500, 8, 3) + rect(xc + 14, 500, 8, 3) + rect(back, gy, tip - back, 5.2) +
      poly([[xc - 12, gy], [xc - 2, 386], [xc + 2, 386], [xc + 12, gy], [xc + 8.6, gy], [xc, 392], [xc - 8.6, gy]]) + rect(back + 2, gy - 9, 22, 9) + rect(xc - 4, 382, 8, 5);
    for (let x = back + 2; x < tip - 4; x += 6) lat += `M${f(x)} ${gy + 0.6}L${f(x + 3)} ${gy + 4.6}L${f(x + 6)} ${gy + 0.6}`;
    lat += `M${xc - 18.6} 486L${xc + 18.6} 471M${xc + 18.6} 486L${xc - 18.6} 471`;
    stays += `M${xc} 388L${tip} ${gy}M${xc} 388L${back} ${gy}M${xc} 388L${xc + 44} ${gy}`;
    rimL += `M${xc - 19.6} 502L${xc - 16.8} ${gy + 6}M${xc + 13.8} ${gy + 6}L${xc + 16.6} 502M${xc - 11.6} ${gy}L${xc - 2} 386.6`;
    rimT += `M${back} ${gy - 0.3}H${tip}`;
    cabs += rect(xc + 30, gy + 5.2, 9, 6.4);
    led += `M${back + 1} ${gy + 5.6}H${tip - 1}`;
    red += circ(xc, 381, 1.3) + circ(tip - 1, gy - 1, 1.2) + circ(back + 1, gy - 1, 1.2);
    names += txt(ci ? 'PB-02' : 'PB-01', back + 26, gy + 4.3, 3.6, { track: 0.4 });
    const tx = xc + 60;
    hooks += h('g', { transform: `translate(${tx} ${gy + 5})` }, h('g', { 'data-ref': 'sea-hook' + ci },
      F(rect(-5, -1, 10, 3), v('seaSteel')), S(`M-3 2V${40 + ci * 14}M3 2V${40 + ci * 14}`, v('megaHi'), 0.5),
      F(rect(-12, 40 + ci * 14, 24, 2), v('seaSteel')), F(rect(-11.3, 42 + ci * 14, 22.6, 7.4), v(ci ? 'seaCtrT' : 'seaCtrA')),
      F(rect(-11.3, 42 + ci * 14, 22.6, 7.4), 'url(#sea-corr)'), S(`M-11 ${42.4 + ci * 14}H11`, v('smogLit'), 0.5, { opacity: 0.6 })));
  }
  g += G(DD('sea:O:gantry-cranes'), F(crane, v('seaSteel')), S(stays, v('seaSteel'), 1.1), F(names, '#E9E6F2', { opacity: 0.75 }),
    G(NEONV, S(rimL, N.cyan, 0.7, { opacity: 0.7 }), S(rimT, N.mag, 0.8, { opacity: 0.75 })), '%%CRN%%');
  z += G(DD('sea:T:crane-lattice'), S(lat, v('mega'), 0.55));
  z += G(DD('sea:O:crane-cabs'), F(cabs, N.cyan, { opacity: 0.8, ...LITV }), S(cabs, v('mega'), 0.6));
  z += G({ ...DD('sea:O:crane-led-strips'), ...NEONV }, tube(led, N.cyan, N.cyanCore, 0.8));
  z += G(DD('sea:O:crane-spreaders'), hooks);
  g += G({ 'data-ref': 'sea-craneRed' }, G(DD('sea:O:crane-warning-lights'), F(circ(142, 381, 1.3), N.red), F(circ(142, 381, 4), N.red, { opacity: 0.22 })), F(red, N.red),
    F([[-8, 381], [142, 381]].map(([x, y]) => circ(x, y, 4)).join(''), N.red, { opacity: 0.22 }));
  // ---- port control tower with 渔港 / FISH PORT neon
  let rows = '', rowsC = '';
  for (let y = 412; y < 500; y += 4.4) { const d = `M235 ${f1(y)}H265`; if (R() < 0.55) rows += d; else if (R() < 0.5) rowsC += d; }
  g += G(DD('sea:O:port-tower'), F(rect(232, 406, 36, 97), v('mega')), F(rect(262, 406, 6, 97), v('megaHi'), { opacity: 0.5 }), F(rect(230, 403, 40, 3.4), v('seaSteel')),
    S('M250 403V380M246 388H254', v('megaHi'), 0.9), F(circ(250, 379, 1.3), N.red), '%%PT%%');
  y += G(DD('sea:T:port-tower-windows'), S(rows, N.amber, 1.4, { 'stroke-dasharray': '3.4 1.2', 'stroke-linecap': 'butt', ...LITV }), S(rowsC, N.cyan, 1.4, { 'stroke-dasharray': '6 1.4', 'stroke-linecap': 'butt', ...LITV }));
  g += G({ ...DD('sea:O:port-sign-zh'), ...NEONV }, F(rect(219, 414, 11, 26), N.void, { opacity: 0.92 }), tube(rect(219.5, 414.5, 10, 25), N.mag, null, 0.8), F(vtxt('渔港', 224.5, 415.4, 8.8), N.magCore));
  g += G({ ...DD('sea:O:port-sign-en'), ...NEONV }, F(rect(233, 392, 34, 9), N.void, { opacity: 0.9 }), tube(rect(233.5, 392.5, 33, 8), N.cyan, null, 0.7), F(txt('FISH PORT', 250, 399, 5, { anchor: 'middle', track: 0.3 }), N.cyanCore));
  // ---- quay apron with hazard lip, panel joints, bollards, lamp posts
  let joints = 'M-420 509H300';
  for (let x = -416; x < 300; x += 18) joints += `M${x} 504V515`;
  g += G(DD('sea:O:quay-apron'), F(rect(-420, 503, 720, 12), v('seaConc')), F(rect(-420, 501.4, 720, 2.2), 'url(#sea-hazP)'),
    F([60, 118, 196, 280].map(x => rect(x, 498.4, 2.6, 3) + rect(x - 0.6, 497.8, 3.8, 1)).join(''), v('mega')), '%%QA%%');
  w += G(DD('sea:T:quay-panels'), S(joints, v('mega'), 0.6, { opacity: 0.7 }));
  g += G(DD('sea:O:quay-lamps'), S('M-60 502V466M-60 466h5M40 502V466M40 466h5M200 502V466M200 466h5', v('seaSteel'), 1.1),
    F(rect(-57, 465, 5, 2.4) + rect(43, 465, 5, 2.4) + rect(203, 465, 5, 2.4), N.amberCore, LITV),
    F(circ(-54.5, 470, 12) + circ(45.5, 470, 12) + circ(205.5, 470, 12), 'url(#sea-gAmber)', LITV));
  // ---- mole + channel light
  let mm = 'M-90 520.5H112';
  for (let x = -86; x < 112; x += 8) mm += `M${x} 517.5V520.5M${x + 4} 520.5V523.5`;
  g += G(DD('sea:O:harbour-mole'), F('M-420 517L110 517L114 524L-420 524Z', v('seaConc')), F(rect(-420, 516, 532, 1.8), v('megaHi')), S(mm, v('mega'), 0.6));
  g += G(DD('sea:O:channel-light'), F(rect(100, 494, 9, 23), v('seaSteel')), F(rect(100, 499, 9, 3) + rect(100, 507, 9, 3), N.green, { opacity: 0.8, ...NEONV }), F(rect(99, 491, 11, 3) + 'M100.5 491L104.5 486L108.5 491Z', v('mega')),
    F(rect(102, 487.5, 5, 3.4), N.green), F(circ(104.5, 489, 9), 'url(#sea-gAcid)', LITV));
  // ---- water taxis moored along the quay
  const taxi = (x, w, col) => F(`M${x} 510.5L${x + w} 510L${x + w - 3} 514.6L${x + 3} 514.8Z`, v('seaHull')) + S(`M${x + 1} 511.4L${x + w - 1} 511`, col, 0.9) + F(`M${x + 4} 510.4L${x + 6} 507H${x + w - 6}L${x + w - 4} 510.2Z`, N.cyan, { opacity: 0.45 });
  g += G(DD('sea:O:moored-taxis'), taxi(126, 17, N.mag), taxi(148, 14, N.cyan), taxi(168, 19, N.acid), taxi(194, 15, N.mag), S('M130 511l-5 -6M154 510.5l-5 -5', v('megaHi'), 0.6));
  // ---- the floating drone dock: ramp, pontoon on floats, pads, charge pylons, kiosk, sign, edge lights, drones
  g += G(DD('sea:O:dock-ramp'), F('M298 502L322 508.6L322 510.4L298 504.6Z', v('seaSteel')), S('M298 500.6L322 507.4', v('megaHi'), 0.6));
  let floats = ''; for (let x = 318; x < 456; x += 12) floats += ell(x, 513.6, 5.4, 2.2);
  g += G(DD('sea:O:dock-floats'), F(floats, v('seaSteel')), S(floats, v('megaHi'), 0.4, { opacity: 0.6 }));
  g += G(DD('sea:O:dock-pontoon'), F(rect(310, 508, 150, 4.4), v('seaDeck')), S('M310 508.3H460', v('smogLit'), 0.6, { opacity: 0.6 }), S('M330 508V512.4M360 508V512.4M390 508V512.4M420 508V512.4M450 508V512.4', v('mega'), 0.5), '%%DP%%');
  u += G(DD('sea:O:dock-edge-lights'), F([...Array(13)].map((_, i) => circ(314 + i * 11.6, 510.3, 0.8)).join(''), N.amberCore, LITV));
  u += G({ ...DD('sea:O:drone-pads'), ...NEONV }, S(ell(346, 507.6, 10, 1.6) + ell(384, 507.6, 10, 1.6) + ell(422, 507.6, 10, 1.6), N.cyan, 0.7),
    S('M342 507.6h8M380 507.6h8M418 507.6h8', N.acidCore, 0.6));
  g += G(DD('sea:O:charge-pylons'), F(rect(327, 490, 3, 18) + rect(402, 490, 3, 18), v('seaSteel')), F(rect(326, 488, 5, 2.4) + rect(401, 488, 5, 2.4), N.acid, NEONV),
    S('M330 497q8 6 10 10M405 497q8 6 10 10', v('mega'), 0.6));
  g += G(DD('sea:O:dock-kiosk'), F(rect(436, 494, 22, 14), v('seaSteel')), F('M434 494L438 490H456L460 494Z', v('mega')), F(rect(439, 497, 16, 6), N.amber, { opacity: 0.85, ...LITV }),
    F(rect(442, 498, 3, 5) + rect(449, 498.5, 4, 4.5), v('mega'), { opacity: 0.7 }));
  g += G({ ...DD('sea:O:dock-sign'), ...NEONV }, S('M388 486V508M456 486V490', v('seaSteel'), 0.9), F(rect(384, 477, 76, 10), N.void, { opacity: 0.9 }), tube(rect(384.5, 477.5, 75, 9), N.mag, null, 0.7),
    F(txt('无人机', 388, 485.4, 6.4), N.magCore), F(txt('DRONE PORT', 410, 484.6, 4.6, { track: 0.4 }), N.cyanCore));
  // drones hovering over the pads (tiny bobbing groups: no filters)
  const drone = (k, x, y, pkg, cone) => h('g', { transform: `translate(${x} ${y}) scale(1.35)` }, h('g', { 'data-ref': 'sea-drone' + k },
    cone ? F('M-1.4 3L-9 26H9L1.4 3Z', 'url(#sea-coneG)') : '',
    S('M-8 -1.2L8 -1.2M-6 -2.6L-3 -0.6M6 -2.6L3 -0.6', v('seaSteel'), 0.8), F(rrect(-3.4, -2.4, 6.8, 3.8, 1.4), v('mega')),
    F(ell(-8, -2.6, 3.6, 0.7) + ell(8, -2.6, 3.6, 0.7), '#E9E6F2', { opacity: 0.4 }),
    F(circ(-2, 0.6, 0.7), N.red) + F(circ(2, 0.6, 0.7), N.green) + F(rect(-1, -1.8, 2, 1), k % 2 ? N.mag : N.cyan),
    pkg ? F(rect(-3, 2, 6, 4.4), '#C7A06A') + S('M-3 4.2h6', N.mag, 0.6) + S('M-1.6 1.4V2M1.6 1.4V2', v('megaHi'), 0.4) : ''));
  defs += h('linearGradient', { id: 'sea-coneG', x1: 0, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: 0, 'stop-color': N.cyan, 'stop-opacity': 0.45 }), h('stop', { offset: 1, 'stop-color': N.cyan, 'stop-opacity': 0 }));
  g += G(DD('sea:O:delivery-drones'), drone(0, 346, 474, true, false), drone(1, 386, 462, false, true), drone(2, 424, 480, true, false));
  // ---- broken reflections of the port lights under the waterline
  let rA = '', rC = '', rM = '', rG = '';
  const rs = (x, y0, len) => rect(x - 2.6, y0, 5.2, len);
  for (const x of [-54.5, 45.5, 205.5]) rA += rs(x, 517, 38);
  for (let i = 0; i < 13; i += 2) rA += rs(314 + i * 11.6, 515, 16);
  rA += rs(447, 515, 20) + rs(94, 518, 16) + rs(82, 518, 16);
  rC += rs(20, 525, 30) + rs(60, 525, 30) + rs(170, 525, 30) + rs(210, 525, 30) + rs(250, 516, 28) + rs(346, 515, 22) + rs(384, 515, 22);
  rM += rs(224.5, 516, 44) + rs(422, 515, 24) + rs(436, 515, 24) + rs(130, 516, 12);
  rG += rs(104.5, 525, 26);
  g += G({ ...DD('sea:T:port-reflections'), ...LITV }, F(rA, 'url(#sea-rp-amber)'), F(rC, 'url(#sea-rp-cyan)', { opacity: 0.9 }), F(rM, 'url(#sea-rp-mag)'), F(rG, 'url(#sea-rp-green)', { opacity: 0.9 }),
    S('M216 516V560M250 516V548', N.mag, 7, { opacity: 0.12, 'stroke-dasharray': '12 4 8 6', 'stroke-linecap': 'butt' }));
  g = g.replace('%%CTR%%', q).replace('%%CRN%%', z).replace('%%PT%%', y).replace('%%QA%%', w).replace('%%DP%%', u);
  return { markup: h('g', { 'data-ref': 'sea-harbour' }, g), defs };
}

// ---------------------------------------------------------------------------- tetrapod breakwater, nav pylon (L-sea)
function buildRocks(v, rng) {
  const R = rng('sea-rocks');
  let g = '', q = '';
  // tetrapods: three visible legs around a hub, a shade facet and a neon rim on the top edge
  let body = '', shade = '', rim = '', rimC = '';
  const tetra = (cx, cy, s, a) => {
    const leg = (ang, L, w) => { const c = Math.cos(ang * D2R), sn = Math.sin(ang * D2R); const px = -sn * w, py = c * w; return poly([[cx + px, cy + py], [cx + c * L * s + px * 0.6, cy + sn * L * s + py * 0.6], [cx + c * L * s - px * 0.6, cy + sn * L * s - py * 0.6], [cx - px, cy - py]]) + circ(cx + c * L * s, cy + sn * L * s, w * 0.6); };
    body += leg(a - 90, 16, 5 * s) + leg(a + 30, 17, 5.4 * s) + leg(a + 150, 16, 5 * s) + circ(cx, cy, 6.4 * s);
    shade += leg(a + 30, 15, 2.6 * s);
    rim += `M${f(cx - 8 * s)} ${f(cy - 5 * s)}Q${f(cx)} ${f(cy - 9 * s)} ${f(cx + 8 * s)} ${f(cy - 6 * s)}`;
    if (R() < 0.4) rimC += `M${f(cx - 10 * s)} ${f(cy + 2 * s)}Q${f(cx - 12 * s)} ${f(cy - 4 * s)} ${f(cx - 7 * s)} ${f(cy - 7 * s)}`;
  };
  for (const [x, y, s, a] of [[70, 628, 1.1, 10], [102, 622, 1.2, -20], [136, 626, 1.15, 35], [168, 624, 1.1, 0], [200, 630, 1, 50], [232, 632, 0.9, -10], [88, 602, 1, 60], [122, 598, 1.05, 15], [156, 600, 1, -35], [190, 606, 0.95, 25], [140, 580, 0.95, -5], [312, 634, 0.8, 20]]) tetra(x, y, s, a);
  g += G(DD('sea:O:tetrapods'), F(body, v('seaConc')), F(shade, v('mega'), { opacity: 0.8 }), '%%TP%%');
  q += G({ ...DD('sea:O:tetrapod-rim-light'), ...NEONV }, S(rim, N.mag, 1.2, { opacity: 0.8 }), S(rimC, N.cyan, 1, { opacity: 0.6 }));
  // nav pylon (lattice tower) with a platform, lamp house and hazard bands
  let lt = 'M262 636L268 556M292 636L286 556M264 556H290';
  for (let y = 636; y > 560; y -= 12) { const w0 = lerp(15, 9, (636 - y) / 80), w1 = lerp(15, 9, (648 - y) / 80); lt += `M${f(277 - w0)} ${y}L${f(277 + w1)} ${y - 12}M${f(277 + w0)} ${y}L${f(277 - w1)} ${y - 12}`; }
  g += G(DD('sea:O:nav-pylon'), S(lt, v('seaSteel'), 1.3), F(rect(260, 552, 34, 4), v('seaSteel')), F(rect(270, 540, 14, 12), v('mega')), F(rect(272, 542, 10, 5), N.acid, NEONV),
    F(rect(268, 536, 18, 4), v('seaSteel')), F(rect(262, 548, 30, 2.4), 'url(#sea-hazP)'), F(circ(277, 544.5, 10), 'url(#sea-gAcid)', LITV));
  // sign: 请勿喂鹈鹕 DON'T FEED THE PELICAN (an egg)
  g += G({ ...DD('sea:O:no-feeding-sign'), ...NEONV }, F(rect(248, 590, 58, 17), N.void, { opacity: 0.92 }), tube(rect(248.5, 590.5, 57, 16), N.cyan, null, 0.7),
    F(txt('请勿喂鹈鹕', 277, 600.6, 8.4, { anchor: 'middle' }), N.cyanCore), F(txt("DON'T FEED THE PELICAN", 277, 605.2, 3, { anchor: 'middle', track: 0.2 }), N.mag));
  // seal basking on the tetrapods (head bobs)
  g += G(DD('sea:O:seal-basking'),
    F('M112 588C116 576 138 572 158 576C168 578 174 580 178 582L170 588C150 590 128 592 112 588Z', '#2A2638'),
    S('M120 584C132 580 148 579 162 580', v('smogLit'), 1, { opacity: 0.5 }), F('M116 587L106 582L110 589Z', '#2A2638'),
    h('g', { transform: 'translate(172 580)' }, h('g', { 'data-ref': 'sea-sealHead' },
      F('M-4 1C-4 -8 2 -14 10 -13C15 -12 17 -8 17 -5C17 -2 13 0 8 1Z', '#2A2638'), F(circ(8.5, -9, 1.1), '#E9E6F2'), F(ell(15.6, -5.4, 1.4, 1), '#07060F'),
      S('M13 -3.5l6 -1M13 -2.8l6 0.6', '#E9E6F2', 0.45), S('M-3 -4C0 -11 6 -14 12 -12.4', N.mag, 0.7, { opacity: 0.8 }))));
  // cormorants on the pylon platform, one drying its wings
  g += G(DD('sea:O:cormorants'),
    F('M266 551C265 545 266 540 268 536C269 533 271 532 272 534C273 536 272 539 271 541C274 543 275 547 274 551Z' +
      'M268 540C262 536 257 531 254 526C259 528 263 530 268 537ZM271 540C277 536 282 531 285 526C280 528 276 530 271 537Z' + 'M272 534L276 535L272 535.8Z', '#07060F'),
    F('M284 551C283 546 285 543 288 543C289 541 291 540 292 541C293 543 292 544 291 545C293 547 293 550 291 551Z M292 541.4L295 542L292 542.6Z', '#07060F'),
    S('M256 527C260 530 264 533 268 537M284 527C280 530 276 533 272 537', N.mag, 0.6, { opacity: 0.7 }), F(circ(271.3, 533.6, 0.5) + circ(291.3, 541.2, 0.45), N.acid));
  // surging foam collars
  let foam = '', spray = '';
  for (const [x0, x1, y] of [[52, 250, 636], [250, 300, 638], [300, 340, 640]]) {
    foam += `M${x0} ${y}`; for (let x = x0; x < x1; x += 6) foam += 'q3 -3.2 6 0'; foam += `L${x1} ${y + 4}L${x0} ${y + 4}Z`;
    for (let k = 0; k < 5; k++) spray += `M${f(x0 + R() * (x1 - x0))} ${f(y - 3 - R() * 7)}h0`;
  }
  g += G(DD('sea:O:breakwater-foam'), h('g', { 'data-ref': 'sea-foam' }, F(foam, v('foam'), { opacity: 0.55 }), S(spray, N.cyanCore, 1.5, { opacity: 0.6 })));
  g = g.replace('%%TP%%', q);
  return h('g', { 'data-ref': 'sea-rocks' }, g);
}

// ============================================================================ L-boats: hover-boats, buoys, dolphin, fish, seal
function buildBoats(v, rng) {
  let m = '', defs = '';
  const wrapObj = (key, inner, extra = {}) => h('g', { 'data-ref': 'sea-o-' + key, ...extra }, inner);
  const PL = '#E9E6F2', VO = '#07060F';
  // ---- PELICAN LINES hover-ferry (bow to the left; heading −x)
  {
    const hull = 'M-58 -10L52 -10L55 -8L49 1L-48 1Q-54 -3 -58 -10Z';
    let ports = ''; for (let x = -42; x <= 44; x += 4.6) ports += `M${f(x)} -5.6h0`;
    let win = ''; for (let x = -26; x <= 30; x += 3.4) win += rect(x, -14.6, 1.8, 2.2);
    let win2 = ''; for (let x = -16; x <= 22; x += 3.4) win2 += rect(x, -20.4, 1.8, 2);
    const smoke = [0, 1, 2, 3, 4].map(k => h('g', { 'data-ref': 'sea-smoke' + k, transform: 'translate(34 -38)' },
      F(circ(0, 0, 4) + circ(3.5, -1.5, 3.2) + circ(-3, 1, 2.8), v('smogHi'), { opacity: 0.55 }))).join('');
    let bulbs = [[], [], []];
    const along = (a, b, n) => { for (let i = 0; i < n; i++) { const u = (i + 0.5) / n; bulbs[i % 3].push(circ(lerp(a[0], b[0], u), lerp(a[1], b[1], u) + Math.sin(u * Math.PI) * 1.6, 0.9)); } };
    along([-56, -10], [-40, -44], 7); along([-40, -44], [44, -42], 16); along([44, -42], [53, -10], 6);
    const art = G(DD('sea:O:ferry-vapour'), smoke) +
      G(DD('sea:O:ferry-hull'), F(hull, v('seaHull')), F('M-50 -9L50 -9L48.6 -6L-47 -6Z', v('seaDeck')), S('M-57 -10H53', v('megaHi'), 0.8)) +
      G({ ...DD('sea:O:ferry-waterline-neon'), ...NEONV }, tube('M-47 -1.4H48', N.mag, N.magCore, 1.1), tube('M-56 -10.4H52', N.cyan, null, 0.6)) +
      G(DD('sea:O:ferry-portholes'), S(ports, N.amber, 1.6, LITV)) +
      G(DD('sea:O:ferry-decks'), F(rect(-30, -16.4, 64, 6.4) + rect(-20, -22.4, 44, 6) + rect(-32, -29, 13, 13), v('seaSteel')), F(rect(-31, -27, 11, 3), N.cyan, { opacity: 0.85, ...LITV }),
        F(rect(-33, -30, 15, 1.4) + rect(-21, -23.4, 46, 1.2) + rect(-31, -17.4, 66, 1.2), v('megaHi')), S('M-26 -29V-36M-29 -34H-23', v('megaHi'), 0.6)) +
      h('g', { 'data-ref': 'sea-steamlit', ...LITV }, F(win, N.amberCore), F(win2, N.cyanCore, { opacity: 0.9 })) +
      G({ ...DD('sea:O:ferry-screen'), ...NEONV }, S('M-4 -22.4V-26M20 -22.4V-26', v('megaHi'), 0.8), F(rect(-8, -37, 32, 11), VO), tube(rect(-7.6, -36.6, 31.2, 10.2), N.mag, null, 0.6),
        F(txt('鹈鹕航运', 8, -29.4, 6.4, { anchor: 'middle' }), N.magCore), F(txt('PELICAN LINES', 8, -27.4, 2.2, { anchor: 'middle', track: 0.2 }), N.cyanCore)) +
      G(DD('sea:O:ferry-stacks'), F(poly([[28, -22.4], [33, -22.4], [35, -37], [30, -37]]) + poly([[36, -22.4], [41, -22.4], [43, -35], [38, -35]]), v('mega')),
        F(poly([[29.3, -31], [34.3, -31], [34.6, -33], [29.6, -33]]) + poly([[37.4, -30], [42.4, -30], [42.6, -32], [37.6, -32]]), N.mag, NEONV)) +
      G(DD('sea:O:ferry-pods'), F(rrect(-14, -25.4, 9, 3, 1.5) + rrect(8, -25.4, 9, 3, 1.5), N.amber, { opacity: 0.9 }), S('M-14 -22.6v-3.6M-5 -22.6v-3.6M8 -22.6v-3.6M17 -22.6v-3.6', v('megaHi'), 0.5)) +
      G({ ...DD('sea:O:ferry-string-lights') }, S('M-40 -10V-44M44 -10V-42', v('megaHi'), 0.6), S('M-56 -10L-40 -44L44 -42L53 -10', v('megaHi'), 0.4, { opacity: 0.7 }),
        G(NEONV, F(bulbs[0].join(''), N.mag), F(bulbs[1].join(''), N.cyan), F(bulbs[2].join(''), N.amber))) +
      F(circ(-57, -9, 1) , N.red) + F(circ(53, -9, 1), N.green);
    m += wrapObj('steamer', art);
  }
  // ---- far hover-skiff and neon junk (drawn at near-boat units, placed small)
  m += wrapObj('sloop', G(DD('sea:O:hover-skiff'),
    F(ell(0, 6, 60, 5), N.cyan, { opacity: 0.25 }), F('M-50 -10L54 -12L42 4L-38 4Z', v('seaHull')), F('M-20 -12L-6 -34H24L36 -12Z', v('seaSteel')),
    F('M-12 -14L-2 -30H20L28 -14Z', N.cyan, { opacity: 0.6 }), tube('M-40 2H40', N.cyan, N.cyanCore, 3), F(circ(-46, -8, 3), PL), S('M-54 12h110M-36 18h70', v('foam'), 3, { opacity: 0.6 })));
  m += wrapObj('yawl', G(DD('sea:O:neon-junk'),
    F('M-46 -12L50 -14Q46 -2 36 4L-34 4Q-42 -2 -46 -12Z', v('seaHull')), S('M-46 -12L50 -14', N.amber, 3),
    S('M4 -12V-120M-34 -12V-80', v('seaSteel'), 5), F('M6 -112L-26 -106L-30 -18L40 -20Z', N.mag, { opacity: 0.8 }), F('M-32 -76L-56 -72L-54 -18L-34 -18Z', N.mag, { opacity: 0.8 }),
    S('M-24 -92L20 -94M-27 -76L28 -78M-29 -58L34 -58M-30 -40L38 -40M-54 -58L-33 -58M-54 -40L-34 -40', N.cyan, 2.6), S('M-50 10h100', v('foam'), 3, { opacity: 0.5 })));
  // ---- neon trawler with drying net, fisherman and gulls
  {
    defs += h('clipPath', { id: 'sea-netclip' }, F('M-52 -50L-20 -64L-18 -22L-44 -18Z', '#000'));
    let mesh = ''; for (let k = -80; k < 60; k += 5) mesh += `M${k} -70L${k + 60} -10M${k + 60} -70L${k} -10`;
    const gull = (x, y, s, ref) => h('g', { transform: `translate(${x} ${y}) scale(${s})` }, h('g', { 'data-ref': ref },
      F('M-14 -3Q-7 -10 0 0Q7 -10 14 -3Q7 -5.5 0 3Q-7 -5.5 -14 -3Z', PL), F('M-14 -3Q-12 -5 -10 -5.6L-11 -3.8ZM14 -3Q12 -5 10 -5.6L11 -3.8Z', VO), F('M-1.2 0.5l1.2 3l1.2 -3Z', N.amber)));
    const art = G(DD('sea:O:trawler'),
      F('M-48 -18L50 -22Q48 -6 36 2L-38 2Q-46 -6 -48 -18Z', v('seaCtrT')), F('M-45 -3L42 -3L38 2L-38 2Z', v('seaHull')), S('M-48 -18L50 -22', PL, 2),
      F(txt('PB7', -34, -6.6, 11, { track: 1 }), PL),
      F(rect(8, -44, 22, 24), v('seaSteel')), F(rect(11, -40, 6, 6) + rect(21, -40, 6, 6), N.amber, LITV), F(rect(26, -54, 3, 7), v('mega')), F(rect(5, -48, 28, 4), N.mag),
      S('M-6 -20V-88M-6 -72L-54 -50M-6 -88L-54 -50', v('seaSteel'), 2.4), S('M-48 -18L-84 4', v('megaHi'), 1.4, { 'stroke-dasharray': '4 3' })) +
      G(DD('sea:O:trawler-worklights'), F(circ(-6, -86, 18) + circ(18, -50, 14), 'url(#sea-gAmber)', LITV), F(rect(-9, -90, 6, 3) + rect(15, -52, 6, 3), N.amberCore)) +
      G(DD('sea:T:fishing-net'), h('g', { 'clip-path': 'url(#sea-netclip)' }, F('M-52 -50L-20 -64L-18 -22L-44 -18Z', v('seaDeck')), S(mesh, v('megaHi'), 1.2)),
        F(circ(-44, -18, 2.6) + circ(-36, -19, 2.6) + circ(-27, -20.5, 2.6) + circ(-19, -22, 2.6), N.amber)) +
      G(DD('sea:O:fisherman'), F(poly([[-24, -20], [-23, -36], [-15, -36], [-14, -20]]), N.amber), F(circ(-19, -40, 3.6), '#F7C1B5'), F('M-25 -41Q-19 -49 -13 -41Z', N.amber),
        F(circ(-15.4, -43, 1.2), N.cyanCore), F('M-14.6 -43L6 -48L6 -38Z', N.cyan, { opacity: 0.2 }), S('M-22 -32L-30 -46M-16 -32L-26 -50', N.amber, 2.6)) +
      G(DD('sea:O:net-gulls'), gull(-40, -104, 1, 'sea-gA'), gull(-8, -124, 0.8, 'sea-gB'));
    m += wrapObj('trawler', art);
  }
  // ---- water taxi (fast, with a long wake)
  m += wrapObj('taxi', G(DD('sea:O:taxi-wake'), S('M-40 3Q-80 1 -140 5M-42 7Q-90 7 -180 12M-38 10Q-70 12 -110 15', v('foam'), 1.6, { opacity: 0.55 }), F(ell(-10, 5, 44, 3.4), N.mag, { opacity: 0.22 })) +
    G(DD('sea:O:water-taxi'), F('M-40 -6L34 -8Q46 -6 48 -2L40 2L-36 2Q-40 -2 -40 -6Z', v('seaHull')), F('M-20 -7L-12 -18H16L26 -8Z', N.cyan, { opacity: 0.55 }), S('M-20 -7L-12 -18H16L26 -8', v('megaHi'), 0.8),
      G(NEONV, tube('M-38 -1H44', N.mag, N.magCore, 1.2)), F(rect(-10, -24, 22, 6), VO), S(rect(-10, -24, 22, 6), N.acid, 0.8),
      F(txt('的士 TAXI', 1, -19.6, 3.8, { anchor: 'middle' }), N.acid), F(circ(47, -3, 1.6), PL), F(circ(-39, -4, 1.2), N.red)));
  // ---- the LED-sail catamaran with rigging, flags, crew and wake
  {
    const xl = y => -56 * ((y + 154) / 123) ** 0.85;
    let seams = ''; for (let y = -142; y < -34; y += 11) seams += `M-1 ${y}L${f(xl(y) + 1)} ${f(y + 1)}`;
    let circuit = ''; for (const [y, l] of [[-120, 10], [-98, 16], [-76, 22], [-54, 30]]) circuit += `M-3 ${y}h${-l * 0.5}v4h${-l * 0.5}` + circ(-3 - l - 1, y + 4, 0.9);
    const art = G(DD('sea:O:boat-wake'), F('M52 -2Q66 -8 76 0Q66 -3 58 2ZM60 1Q72 -3 82 3Q72 1 64 4Z', v('foam'), { opacity: 0.7 }),
      S('M-62 3Q-86 1 -118 4M-64 6Q-92 5 -140 9M-60 9Q-80 10 -100 12', v('foam'), 2, { opacity: 0.6 })) +
      G(DD('sea:O:catamaran-hull'), F('M-58 -16L64 -18Q60 -6 46 3L-46 3Q-56 -4 -58 -16Z', v('seaHull')), F('M-57 -13L62 -15L61 -11.4L-56.4 -9.4Z', v('seaSteel')),
        G(NEONV, tube('M-46 0.4H48', N.cyan, N.cyanCore, 1.2)), S('M-58 -16L64 -18', N.mag, 1),
        F('M-12 -24L20 -24L24 -17L-12 -17Z', v('seaSteel')), F(circ(-4, -20.5, 1.3) + circ(4, -20.5, 1.3) + circ(12, -20.5, 1.3), N.amber, LITV)) +
      G(DD('sea:O:lifebuoy'), F(circ(34, -9, 4.2), N.amber), F(circ(34, -9, 2), VO), S('M34 -13.2v2M34 -4.8v-2M29.8 -9h2M38.2 -9h-2', PL, 2)) +
      G(DD('sea:O:sailboat-jib'), F('M5 -140L60 -19L18 -27Z', N.mag, { opacity: 0.55 }), S('M5 -140L60 -19L18 -27Z', N.mag, 1), S('M9 -128L22 -30', N.magCore, 0.5)) +
      G(DD('sea:O:led-mainsail'), F('M0 -154C-10 -120 -36 -70 -56 -31L-1 -31Z', PL, { opacity: 0.92 }),
        F(poly([[-1, -88], [xl(-88), -88], [xl(-70), -70], [-1, -70]]), N.violet, { opacity: 0.7 }),
        G(NEONV, tube([-128, -106, -56, -40].map(y => `M${f(xl(y) + 1)} ${y}L-1 ${y}`).join(''), N.cyan, null, 1))) +
      G(DD('sea:T:sail-circuits'), S(seams, '#B8B0D8', 0.55), S(circuit, N.cyan, 0.6, { opacity: 0.8 })) +
      G(DD('sea:O:sailboat-rigging'), F(rect(1, -158, 2.6, 142) + 'M3 -30L-60 -26.8L-60 -25L3 -28Z', v('seaSteel')),
        S('M2 -156L63 -18M2 -156L-57 -16M2 -118L-8 -17M2 -118L12 -17M-7 -112H11M-54 -26.5L-50 -16M18 -27L-4 -18M2 -156L-60 -27', v('megaHi'), 0.7)) +
      G(DD('sea:O:holo-pennants'), h('g', { transform: 'translate(3 -158)' }, h('g', { 'data-ref': 'sea-burgee' }, F('M0 0L20 3.6L0 7.2Z', N.cyan, { opacity: 0.6 }), S('M0 0L20 3.6L0 7.2', N.cyan, 0.7)))) +
      G(DD('sea:O:holo-pennants'), S('M-58 -16L-64 -32', v('megaHi'), 1),
        h('g', { transform: 'translate(-64 -32)' }, h('g', { 'data-ref': 'sea-ensign' }, F(rect(-13, 0, 13, 8.5), N.mag, { opacity: 0.75 }), F(txt('鹈', -6.5, 7.4, 7, { anchor: 'middle' }), PL)))) +
      G(DD('sea:O:sailboat-crew'),
        F('M-42 -17L-40 -31H-31L-29 -17Z', N.amber), S('M-41 -24h11', v('seaHull'), 1),
        F(circ(-36, -35, 3.8), '#F7C1B5'), F('M-40.4 -36Q-36 -42 -31.6 -36Z', v('seaHull')), F(rrect(-37, -37, 6.6, 2.2, 1.1), N.cyan),
        S('M-37 -26L-48 -21', N.amber, 2.6), S('M-50 -18.6L-40 -22', v('megaHi'), 1.6),
        h('g', { transform: 'translate(-33 -28)' }, h('g', { 'data-ref': 'sea-crewArm' }, S('M0 0L6 -8', N.amber, 2.6), F(circ(6.6, -8.8, 1.5), '#F7C1B5')))) +
      F(circ(2, -160, 1.8), N.red);
    m += wrapObj('near', art);
  }
  // ---- marker buoy, smart bell buoy with gull, sensor pods
  m += wrapObj('can', G(DD('sea:O:marker-buoy'),
    S('M0 -24V-33', v('seaSteel'), 1.4), F('M-4.4 -32L0 -40L4.4 -32Z', v('seaSteel')), F(circ(0, -42, 1.8), N.acid),
    F('M-8 -24H8V-1Q0 2 -8 -1Z', v('seaCtrM')), F(rect(-8, -8, 16, 3.4), 'url(#sea-hazP)'),
    F(txt('3', 0, -12, 11, { anchor: 'middle' }), N.cyanCore, NEONV), S('M-14 1q7 -3 14 0q7 3 14 0', v('foam'), 1.4, { opacity: 0.6 })));
  {
    let lat = 'M-12 -16L-5 -56M12 -16L5 -56M0 -16V-56';
    for (let k = 0; k < 3; k++) { const y0 = -16 - k * 13, y1 = y0 - 13, w0 = 12 - k * 2.3, w1 = 12 - (k + 1) * 2.3; lat += `M${f(-w0)} ${y0}L${f(w1)} ${y1}M${f(w0)} ${y0}L${f(-w1)} ${y1}`; }
    const gullStand = h('g', { transform: 'translate(0 -64)' }, h('g', { 'data-ref': 'sea-buoyGull', ...DD('sea:O:buoy-gull') },
      S('M-1 -1L-2 4M2 -1L2 4', N.amber, 1), F('M-9 -6C-9 -12 -2 -14 3 -12C6 -16 11 -16 12 -12C13 -10 12 -8 10 -7C8 -2 2 0 -3 -1C-7 -2 -11 -2 -14 -4Z', PL),
      F('M-10 -7C-6 -11 2 -11 6 -8C2 -5 -4 -4 -10 -5Z', '#8A80B4'), F('M-14 -4L-9 -6L-10 -4Z', VO), F('M12 -13l5 1.4l-5 1.2Z', N.amber), F(circ(9.4, -13, 0.8), VO)));
    m += wrapObj('bell', G(DD('sea:O:bell-buoy'),
      S('M-18 1q9 -4 18 0q9 4 18 0M-24 5q12 -3 24 0q12 3 24 0', v('foam'), 1.4, { opacity: 0.6 }),
      F('M-18 -6Q-18 -16 0 -18Q18 -16 18 -6L14 2L-14 2Z', v('seaCtrM')), F('M-17.6 -10L17.6 -10L17.9 -6.6L-17.9 -6.6Z', N.acid),
      S(lat, v('seaSteel'), 1.5), F(rect(-7, -59, 14, 3), v('seaSteel')), F(rect(-3.5, -64, 7, 5), v('mega')), F(rect(-2, -63, 4, 3), N.cyanCore),
      F('M-10 -30L-2 -34V-26L-10 -22Z', N.cyan, { opacity: 0.35 }), S('M-10 -30L-2 -34V-26L-10 -22Z', N.cyan, 0.5),
      h('g', { transform: 'translate(0 -48)' }, h('g', { 'data-ref': 'sea-bell' }, S('M0 0V3', v('megaHi'), 1), F('M-5.4 13Q-5.4 3 0 2.4Q5.4 3 5.4 13L7 15L-7 15Z', N.amber), F('M-3.6 12Q-3.4 5 -0.6 4L0.4 4.2Q-2 6 -2 12Z', N.amberCore), F(circ(0, 16.6, 1.6), v('mega')))),
      h('circle', { cy: -61.5, r: 10, fill: 'url(#sea-gCyan)', ...LITV })) + gullStand);
  }
  m += wrapObj('pots', G(DD('sea:O:sensor-pods'),
    S('M-24 0V-14M2 0V-12M24 0V-16', v('seaSteel'), 1), F(circ(-24, -15, 1.4) + circ(24, -17, 1.4), N.red), F(circ(2, -13, 1.4), N.acid),
    F(ell(-24, 0, 3.6, 2.6) + ell(24, 0, 3.6, 2.6), v('seaSteel')), F(ell(2, 0, 3.6, 2.6), v('seaCtrV')), S('M-27 -0.6h6M-1 -0.6h6M21 -0.6h6', N.cyan, 0.7),
    S('M-30 3q6 -2 12 0M-4 3q6 -2 12 0M18 3q6 -2 12 0', v('foam'), 1.1, { opacity: 0.6 })));
  // ---- dolphin (leaps along an arc), splashes, fish, seal head
  const dolphin = h('g', { 'data-ref': 'sea-dolph' }, G(DD('sea:O:dolphin'),
    F('M-32 0C-24 -7 -4 -11 14 -9C24 -8 30 -5 34 -2L41 -1L34 1C26 4 12 6 -4 5C-16 4 -26 3 -32 0Z' + 'M-2 -10L-11 -20L7 -9Z' + 'M-30 0L-43 -9L-38 0L-43 9Z', '#3A3F5C'),
    F('M-20 3C-6 5 14 5 31 1L29 3C12 7 -6 6 -20 4.5Z', '#B8B0D8'), F(circ(27, -3.4, 1.1), VO),
    S('M4 -8.4C14 -8.4 22 -6.4 29 -3.8M-2 -10L-11 -20', N.mag, 0.9), S('M-24 1.6C-12 4 8 5 30 0.6', N.cyan, 0.7, { opacity: 0.8 })));
  const splash = k => h('g', { 'data-ref': 'sea-spl' + k, visibility: 'hidden' },
    F('M-10 0Q-8 -8 -5 -12Q-5 -5 -3 0ZM-2 0Q0 -14 2 -18Q3 -8 4 0ZM5 0Q8 -9 12 -11Q10 -4 9 0Z', v('foam'), { opacity: 0.8 }), S('M-18 2q9 -3 18 0q9 3 18 0', N.cyanCore, 1.2, { opacity: 0.6 }));
  m += wrapObj('dolphin', G(DD('sea:O:splash'), splash(0), splash(1)) + dolphin);
  const fish = k => h('g', { 'data-ref': 'sea-fish' + k, visibility: 'hidden' },
    F('M-7 0C-4 -3.4 3 -3.6 6 -0.6L9 -3L8.6 0L9 3L6 0.6C3 3.6 -4 3.4 -7 0Z', k ? N.mag : N.amber), S('M-5 0.6C-1 1.6 3 1.2 5 0.2', PL, 0.8), F(circ(-4.2, -0.8, 0.7), VO));
  m += wrapObj('fish', G(DD('sea:O:jumping-fish'), fish(0), fish(1)) + h('g', { 'data-ref': 'sea-fishRing', visibility: 'hidden' }, S('M-10 1q10 -3 20 0', N.cyanCore, 1.2, { opacity: 0.7 })));
  defs += h('clipPath', { id: 'sea-sealclip' }, F(rect(-30, -40, 60, 40.5), '#000'));
  m += wrapObj('sealhead', G(DD('sea:O:seal-head'),
    h('g', { 'clip-path': 'url(#sea-sealclip)' }, h('g', { 'data-ref': 'sea-sealUp' },
      F('M-9 6C-10 -6 -7 -15 0 -16C7 -15 10 -6 9 6Z', '#2A2638', { stroke: VO, 'stroke-width': 1 }),
      F(ell(0, -8, 4.6, 3.2), '#8A80B4'), F(ell(0, -10.2, 1.6, 1.1), VO), F(circ(-3.4, -12.6, 1) + circ(3.4, -12.6, 1), VO),
      S('M-8 -4C-8 -10 -5 -15 0 -16', N.mag, 0.8), S('M2.6 -8.4l7 -1.4M2.6 -7.4l7 0.6M-2.6 -8.4l-7 -1.4M-2.6 -7.4l-7 0.6', PL, 0.45))),
    S('M-14 1q7 -3 14 0q7 3 14 0M-20 5q10 -2.6 20 0q10 2.6 20 0', N.cyanCore, 1.1, { opacity: 0.6 })));
  // (journey easter egg) a whale off the old temple: bioluminescent spots on its back, flukes, a spout every few seconds
  m += h('g', { 'data-ref': 'sea-whale', visibility: 'hidden' },
    F('M-60 0Q-50 -22 -6 -24Q30 -24 44 -6L52 0Z', '#2A2638') + S('M-44 -8Q-20 -18 20 -16', N.cyan, 1.2, { opacity: 0.6 }) + F('M-30 -21l6 -6l4 5z', '#2A2638') +
    F(circ(-34, -12, 1.2) + circ(-24, -16, 1.4) + circ(-12, -18, 1.2) + circ(0, -17, 1.4) + circ(12, -15, 1.1) + circ(22, -11, 1.2), N.cyanCore) +
    F('M70 -4Q76 -22 92 -26Q84 -14 88 -4Q80 -10 70 -4Z', '#2A2638') + S('M-66 1q30 -4 60 0t60 0t40 0', v('foam'), 1.6, { opacity: 0.6 }) +
    h('g', { 'data-ref': 'sea-spout', transform: 'translate(-14 -24)' }, S('M0 0V-26M0 -20q-10 -8 -16 -4M0 -20q10 -8 16 -4M0 -12q-8 -4 -12 0M0 -12q8 -4 12 0', N.cyanCore, 2, { opacity: 0.8 }) +
      F('M-3 -30a3 3 0 0 1 6 0zM-18 -24a2.4 2.4 0 0 1 4.8 0zM13 -24a2.4 2.4 0 0 1 4.8 0z', N.cyanCore)));
  return { markup: m, defs };
}

// ---------------------------------------------------------------------------------------------- attach
// composited strips (see core/sheets.js): the skyline and its reflections, the data spire, its beam and its reflection,
// the four rolling ripple bands, the port and the breakwater move by a pure translate every frame; the runtime moves each
// one as its own compositor layer instead of repainting it
export const sheets = ['hills', 'cape', 'beam', 'refl', 'caperefl', 'w0', 'w1', 'w2', 'w3', 'harbour', 'rocks'].map(k => `[data-ref="sea-${k}"]`);
export function attach(svg, ctx) {
  const r = refs(svg, 'sea-');
  const st = new WeakMap();
  const set = (el, k, val) => {
    if (!el) return;
    let m = st.get(el); if (!m) st.set(el, (m = {}));
    if (m[k] !== val) { m[k] = val; el.setAttribute(k, val); }
  };
  const vis = (el, on) => set(el, 'visibility', on ? 'visible' : 'hidden');
  const obj = Object.fromEntries(Object.keys(BOATS).map(k => [k, r['o-' + k]]));
  const since = (fr, type) => { let best = Infinity; for (const e of fr.events || []) if (e.type === type && fr.t >= e.t0) best = Math.min(best, fr.t - e.t0); return best; };
  return {
    update(fr) {
      const t = fr.t, D = fr.distance || 0, red = fr.reduced || ctx.reduced;
      const cam = fr.cam || { fx: 800 };
      const num = (fr.pal && fr.pal.num) || {};
      const lampOn = num.lampOn ?? fr.night ?? 0, search = num.search ?? lampOn;
      // ---- skyline + its reflections (same scroll)
      const sx = f(hillsX(D));
      set(r.hills, 'transform', `translate(${sx} 0)`);
      set(r.refl, 'transform', `translate(${sx} 0)`);
      // ---- data spire, its reflection and the searchlight
      const cx = clamp(routeX(D, ANCH.cape, LH.d), -6000, 6000), spOn = cx > -1500 && cx < 1900;
      set(r.cape, 'transform', `translate(${f(cx)} 0)`);
      set(r.caperefl, 'transform', `translate(${f(cx)} 0)`);
      const beamOn = search > 0.04 && cx > -2400 && cx < 2800;
      vis(r.beam, beamOn);
      if (beamOn) {
        set(r.beam, 'transform', `translate(${f(cx + LAMP.x)} ${LAMP.y})`);
        const th = red ? 0.35 : t * (Math.PI * 2 / 9), c = Math.cos(th);
        set(r.beamRot, 'transform', `scale(${f(c)} 1)`);
        set(r.lantern, 'transform', `scale(${f(0.7 + Math.max(0, 1 - Math.abs(c) * 3) * 1.4)})`);
      }
      if (spOn) {
        set(r.spRed, 'opacity', Math.floor(t * 1.25) % 2 ? '0.3' : '1');
        const u = wrap(t / 17, 1), tri = u < 0.5 ? u * 2 : 2 - u * 2, e = tri * tri * (3 - 2 * tri);
        set(r.lift, 'transform', `translate(${LAMP.x + 5.6} ${f1(395 - e * 100)})`);
      }
      // ---- ripple bands roll: each band scrolls at its own depth and bobs a little
      for (let i = 0; i < BANDS.length; i++) {
        const [d, W] = BANDS[i];
        const bob = red ? 0 : Math.sin(t * (0.9 + i * 0.23) + i * 1.7) * (0.5 + i * 0.35);
        const drift = red ? 0 : t * (3 + i * 2);
        set(r['w' + i], 'transform', `translate(${f(-wrap(D * d + drift, W))} ${f(bob)})`);
      }
      // ---- glitter paths under the smog sun / the moon
      const sun = fr.sun || { x: 1465, elev: 0.3 }, moon = fr.moon || { x: 500, elev: -1 };
      const sunOn = sun.elev > -0.24;
      vis(r.sunG, sunOn);
      if (sunOn) {
        const gx = sun.x + (cam.fx - 800) * 0.1, len = clamp(0.45 + Math.abs(sun.elev - 0.1) * 1.4, 0.45, 1);
        set(r.sunG, 'transform', `translate(${f(gx)} ${HZ}) scale(${f(0.9 + 0.4 * (1 - len))} ${f(len)}) translate(0 ${-HZ})`);
        for (let k = 0; k < 3; k++) set(r['sg' + k], 'transform', `translate(${red ? 0 : f(Math.sin(t * (1.3 + k * 0.4) + k * 2.1) * 5)} 0)`);
        for (let k = 0; k < 3; k++) { const p = red ? 0.8 : Math.max(0, Math.sin(t * (1.7 + k * 0.6) + k * 1.9)); set(r['spk' + k], 'transform', `scale(${f(p)})`); }
      }
      const moonOn = moon.elev > 0.02 && lampOn > 0.2;
      vis(r.moonG, moonOn);
      if (moonOn) {
        set(r.moonG, 'transform', `translate(${f(moon.x + (cam.fx - 800) * 0.1)} 0)`);
        for (let k = 0; k < 3; k++) set(r['mg' + k], 'transform', `translate(${red ? 0 : f(Math.sin(t * (1.1 + k * 0.5) + k) * 4)} 0)`);
      }
      // ---- container port + breakwater
      const hx = clamp(routeX(D, ANCH.harbour, HB.d), -6000, 6000);
      set(r.harbour, 'transform', `translate(${f(hx)} 0)`);
      if (hx > -900 && hx < 1700) {
        set(r.craneRed, 'opacity', Math.floor(t * 1.1 + 0.5) % 2 ? '0.3' : '1');
        if (!red) {
          for (let k = 0; k < 2; k++) set(r['hook' + k], 'transform', `rotate(${f1(Math.sin(t * (0.55 + k * 0.13) + k * 2) * 1.6)})`);
          for (let k = 0; k < 3; k++) set(r['drone' + k], 'transform', `translate(${f1(Math.sin(t * 0.4 + k * 2.1) * 3)} ${f1(Math.sin(t * (1.1 + k * 0.2) + k) * 1.6)})`);
        }
      }
      const rx = clamp(routeX(D, ANCH.rocks, RK.d), -6000, 6000);
      set(r.rocks, 'transform', `translate(${f(rx)} -16)`);
      if (!red && rx > -600 && rx < 1700) {
        set(r.foam, 'transform', `translate(0 ${f1(Math.sin(t * 2.1) * 1.4)})`);
        set(r.sealHead, 'transform', `rotate(${f1(Math.sin(t * 0.9) * 6 - 2)})`);
      }
      // ---- boats and buoys
      for (const [k, B] of Object.entries(BOATS)) {
        const el = obj[k]; if (!el) continue;
        const d = depthAt(B.y), x = place(t, D, B.x, d, B.vx, B.e + 400, B.S);
        // each pass of a boat is a different day on the water: seeded by its wrap cycle, thinned by the stretch
        const cyc = Math.floor((B.x + B.vx * (t - T0) - (D - D0) * d + B.e + 400) / B.S), cyc0 = Math.floor((B.x + B.e + 400) / B.S);
        const busy = { harbour: 0.05, village: 0.2, return: 0.2, pier: 0.25, funfair: 0.3, cliffs: 0.6, lighthouse: 0.5, dunes: 0.45 }[stretchAt(D).key] ?? 0.4;
        const here = cyc === cyc0 || hash(cyc, k.length * 7 + B.x) > busy;
        if (el.__here !== here) { el.__here = here; el.setAttribute('visibility', here ? 'visible' : 'hidden'); }
        if (!here) continue;
        const w = 0.8 + (B.y - 470) * 0.004, ph = B.x * 0.013;
        const bob = red ? 0 : Math.sin(t * w * 1.6 + ph) * (0.6 + B.s * 1.4) * (k === 'taxi' || k === 'sloop' ? 0.4 : 1);
        const rot = red ? 0 : Math.sin(t * w + ph) * (k === 'near' ? 2.2 : k === 'bell' || k === 'can' ? 4 : k === 'taxi' ? 0.6 : 1.4);
        const on = x > -B.e - 60 && x < 1600 + B.e + 60;
        if (k === 'dolphin' || k === 'fish' || k === 'sealhead') { set(el, 'transform', `translate(${f(x)} ${B.y})`); continue; }
        set(el, 'transform', `translate(${f(x)} ${f(B.y + bob)}) rotate(${f(rot)}) scale(${B.s})`);
        if (!on) continue;
        if (k === 'steamer') for (let i = 0; i < 5; i++) {
          const u = wrap(t / 4.2 + i / 5, 1);
          set(r['smoke' + i], 'transform', `translate(${f(34 + u * 50)} ${f(-38 - u * 18 - Math.sin(u * 5) * 2)}) scale(${f(0.35 + u * 1.2)})`);
          set(r['smoke' + i], 'opacity', f(u < 0.7 ? 1 : (1 - u) / 0.3));
        }
        if (k === 'near' && !red) {
          const fl = Math.sin(t * 7) * 0.1;
          set(r.burgee, 'transform', `scale(${f(1 + fl)} ${f(1 - fl * 0.6)})`);
          set(r.ensign, 'transform', `skewY(${f(Math.sin(t * 6 + 1) * 6)})`);
          const wv = since(fr, 'wave'), wa = wv < 3 ? Math.sin(Math.min(1, wv / 0.3) * Math.PI / 2) * (1 - smooth01((wv - 2.4) / 0.6)) : 0;
          set(r.crewArm, 'transform', `rotate(${f(wa ? wa * (-40 + Math.sin(wv * 12) * 16) : 0)})`);
        }
        if (k === 'trawler' && !red) {
          set(r.gA, 'transform', `scale(1 ${f(0.7 + 0.5 * Math.sin(t * 7))})`);
          set(r.gB, 'transform', `scale(1 ${f(0.7 + 0.5 * Math.sin(t * 6.3 + 2))})`);
        }
        if (k === 'bell') {
          const be = since(fr, 'bell'), ring = be < 2.5 ? 22 * Math.exp(-be * 1.6) * Math.sin(be * 14) : 0;
          set(r.bell, 'transform', `rotate(${f(red ? 0 : ring + Math.sin(t * 2.3) * 7)})`);
          const hop = Math.min(since(fr, 'bell'), since(fr, 'hop'));
          const hy = hop < 0.6 && !red ? -Math.sin(hop / 0.6 * Math.PI) * 7 : 0;
          set(r.buoyGull, 'transform', `translate(0 ${f(hy)})`);
        }
      }
      // whale (journey easter egg, off the old temple)
      {
        const wx = routeX(D, [20.5 * KM], 0.12) + 1060, on = wx > -200 && wx < 1800;
        vis(r.whale, on);
        if (on) {
          set(r.whale, 'transform', `translate(${f(wx)} ${f(548 + (red ? 0 : Math.sin(t * 0.8) * 1.5))})`);
          const ph = wrap(t, 5.2), sp = red ? 0.8 : ph < 1.4 ? Math.sin(ph / 1.4 * Math.PI) : 0;
          set(r.spout, 'transform', `translate(-14 -24) scale(${f(0.2 + sp)} ${f(sp)})`);
        }
      }
      // dolphin leap: every 12 s, 1.3 s arc (one is mid-air in the hero frame)
      {
        const P = 12, dur = 1.3, ph = wrap(t - (T0 - 0.62), P), cy = Math.floor((t - (T0 - 0.62)) / P), up = !red && ph < dur && (cy === 0 || hash(cy, 5) < 0.6);
        vis(r.dolph, up);
        if (up) {
          const u = ph / dur, x = (u - 0.5) * 120, y = -58 * Math.sin(Math.PI * u) + 6;
          const ang = Math.atan2(-58 * Math.PI * Math.cos(Math.PI * u) / dur, 120 / dur) / D2R;
          set(r.dolph, 'transform', `translate(${f(x)} ${f(y)}) rotate(${f(ang)})`);
        }
        const s0 = !red && ph < dur * 0.3, s1 = !red && ph > dur * 0.72 && ph < dur + 0.5;
        vis(r.spl0, s0); vis(r.spl1, s1);
        if (s0) set(r.spl0, 'transform', `translate(-58 0) scale(${f(0.5 + ph / (dur * 0.3) * 0.7)})`);
        if (s1) set(r.spl1, 'transform', `translate(58 0) scale(${f(0.4 + clamp((ph - dur * 0.72) / 0.6, 0, 1) * 0.9)})`);
      }
      // jumping fish (two, offset)
      for (let k = 0; k < 2; k++) {
        const P = 4.3 + k * 1.9, dur = 0.7, ph = wrap(t - (T0 - 0.3) + k * 2.2, P), up = !red && ph < dur;
        vis(r['fish' + k], up);
        if (up) { const u = ph / dur; set(r['fish' + k], 'transform', `translate(${f(k * 34 + (u - 0.5) * 30)} ${f(-24 * Math.sin(Math.PI * u) - k * 6)}) rotate(${f(-50 + 100 * u)})`); }
        if (k === 0) vis(r.fishRing, !red && ph < dur + 0.6);
      }
      // seal head: pops up every 9 s for ~3.4 s
      {
        const P = 9, ph = wrap(t - (T0 - 1.6), P), u = clamp(Math.min(ph / 0.5, (3.4 - ph) / 0.5), 0, 1);
        set(r.sealUp, 'transform', `translate(0 ${f(red ? 0 : (1 - u) * 18 + Math.sin(t * 1.4) * 0.8)})`);
      }
    },
  };
}
const smooth01 = x => { const u = clamp(x, 0, 1); return u * u * (3 - 2 * u); };

// Glyph outlines (em 100, y down, baseline 0), [advance, d]. DejaVu Sans Bold (Bitstream Vera / DejaVu licence), WenQuanYi Zen Hei (GPL v2 + font embedding exception).
const GLY = {"0":[69.6,"M46-37Q46-50 43-56Q41-61 35-61Q29-61 26-56Q24-50 24-37Q24-23 26-17Q29-11 35-11Q41-11 43-17Q46-23 46-37ZM65-36Q65-18 57-8Q49 1 35 1Q20 1 13-8Q5-18 5-36Q5-55 13-64Q20-74 35-74Q49-74 57-64Q65-55 65-36Z"],"1":[69.6,"M12-13L28-13L28-60L11-57L11-69L28-73L46-73L46-13L63-13L63 0L12 0Z"],"2":[69.6,"M29-14L61-14L61 0L8 0L8-14L35-37Q38-41 40-44Q42-47 42-50Q42-55 38-58Q35-61 29-61Q25-61 19-59Q14-58 8-54L8-70Q14-72 21-73Q27-74 33-74Q46-74 53-68Q60-63 60-52Q60-46 57-41Q54-36 44-27Z"],"3":[69.6,"M47-39Q54-37 58-33Q62-28 62-21Q62-10 53-4Q45 1 29 1Q23 1 18 1Q12 0 7-2L7-17Q12-14 17-13Q22-11 27-11Q35-11 39-14Q43-17 43-21Q43-26 39-29Q35-31 27-31L19-31L19-44L27-44Q34-44 38-46Q41-48 41-53Q41-57 38-59Q34-61 28-61Q24-61 19-60Q14-59 10-57L10-71Q15-73 21-73Q26-74 32-74Q46-74 53-70Q60-65 60-56Q60-49 57-45Q53-41 47-39Z"],"4":[69.6,"M37-57L16-27L37-27ZM34-73L55-73L55-27L65-27L65-13L55-13L55 0L37 0L37-13L4-13L4-29Z"],"5":[69.6,"M11-73L57-73L57-59L26-59L26-48Q28-48 30-49Q32-49 34-49Q48-49 55-42Q63-36 63-24Q63-12 55-5Q46 1 32 1Q26 1 20 0Q14-1 8-3L8-18Q14-15 19-13Q24-11 29-11Q36-11 40-15Q44-18 44-24Q44-30 40-33Q36-36 29-36Q25-36 20-35Q16-34 11-32Z"],"6":[69.6,"M36-36Q31-36 29-33Q26-30 26-23Q26-17 29-14Q31-10 36-10Q41-10 44-14Q46-17 46-23Q46-30 44-33Q41-36 36-36ZM59-71L59-58Q55-60 51-61Q47-62 43-62Q34-62 30-57Q25-52 24-43Q27-46 31-47Q35-48 39-48Q50-48 57-42Q64-35 64-24Q64-13 57-6Q49 1 36 1Q22 1 14-8Q6-18 6-35Q6-53 15-64Q24-74 40-74Q45-74 50-73Q55-73 59-71Z"],"7":[69.6,"M7-73L62-73L62-62L33 0L15 0L42-59L7-59Z"],"8":[69.6,"M35-33Q30-33 27-30Q24-27 24-21Q24-16 27-13Q30-10 35-10Q40-10 43-13Q46-16 46-21Q46-27 43-30Q40-33 35-33ZM21-39Q14-41 11-45Q8-49 8-55Q8-65 15-69Q21-74 35-74Q48-74 55-69Q62-65 62-55Q62-49 58-45Q55-41 48-39Q56-37 60-32Q63-28 63-21Q63-10 56-4Q49 1 35 1Q21 1 13-4Q6-10 6-21Q6-28 10-32Q14-37 21-39ZM25-53Q25-49 28-47Q30-44 35-44Q39-44 42-47Q44-49 44-53Q44-58 42-60Q39-62 35-62Q30-62 28-60Q25-58 25-53Z"],"9":[69.6,"M10-2L10-15Q15-13 19-12Q23-11 27-11Q35-11 40-16Q44-20 45-29Q42-27 38-26Q34-25 30-25Q19-25 12-31Q5-38 5-48Q5-60 13-67Q20-74 33-74Q48-74 55-64Q63-55 63-37Q63-19 54-9Q45 1 29 1Q24 1 19 1Q15 0 10-2ZM33-37Q38-37 41-40Q43-43 43-50Q43-56 41-59Q38-62 33-62Q28-62 26-59Q23-56 23-50Q23-43 26-40Q28-37 33-37Z"],"A":[77.4,"M53-13L24-13L19 0L0 0L27-73L50-73L77 0L58 0ZM29-27L49-27L39-56Z"],"B":[76.2,"M38-45Q43-45 45-47Q47-49 47-52Q47-56 45-58Q43-60 38-60L28-60L28-45ZM39-13Q45-13 48-15Q50-18 50-22Q50-27 48-30Q45-32 39-32L28-32L28-13ZM56-39Q63-37 66-33Q69-28 69-21Q69-10 62-5Q55 0 40 0L9 0L9-73L37-73Q53-73 59-68Q66-64 66-54Q66-48 64-45Q61-41 56-39Z"],"C":[73.4,"M67-4Q62-1 56 0Q51 1 44 1Q26 1 16-9Q5-19 5-36Q5-54 16-64Q26-74 44-74Q51-74 56-73Q62-71 67-69L67-54Q62-57 57-59Q52-61 46-61Q36-61 30-54Q24-48 24-36Q24-25 30-19Q36-12 46-12Q52-12 57-14Q62-16 67-19Z"],"D":[83,"M28-59L28-14L35-14Q46-14 52-20Q58-26 58-37Q58-47 52-53Q46-59 35-59ZM9-73L29-73Q46-73 54-71Q62-68 68-62Q73-58 75-51Q78-45 78-37Q78-28 75-22Q73-15 68-10Q62-5 54-2Q45 0 29 0L9 0Z"],"E":[68.3,"M9-73L60-73L60-59L28-59L28-45L58-45L58-31L28-31L28-14L61-14L61 0L9 0Z"],"F":[68.3,"M9-73L60-73L60-59L28-59L28-45L58-45L58-31L28-31L28 0L9 0Z"],"G":[82.1,"M75-5Q68-2 60 0Q53 1 44 1Q26 1 16-9Q5-19 5-36Q5-54 16-64Q27-74 46-74Q53-74 59-73Q66-71 72-69L72-54Q66-57 60-59Q54-61 48-61Q37-61 30-54Q24-48 24-36Q24-25 30-19Q36-12 47-12Q50-12 52-13Q55-13 57-14L57-28L45-28L45-40L75-40Z"],"H":[83.7,"M9-73L28-73L28-45L56-45L56-73L75-73L75 0L56 0L56-31L28-31L28 0L9 0Z"],"I":[37.2,"M9-73L28-73L28 0L9 0Z"],"J":[37.2,"M9-73L28-73L28-7Q28 7 21 13Q13 20-2 20L-6 20L-6 6L-3 6Q3 6 6 3Q9-1 9-7Z"],"K":[77.5,"M9-73L28-73L28-46L55-73L77-73L42-38L81 0L57 0L28-29L28 0L9 0Z"],"L":[63.7,"M9-73L28-73L28-14L61-14L61 0L9 0Z"],"M":[99.5,"M9-73L33-73L50-34L66-73L90-73L90 0L73 0L73-53L56-14L44-14L27-53L27 0L9 0Z"],"N":[83.7,"M9-73L30-73L57-23L57-73L75-73L75 0L54 0L27-50L27 0L9 0Z"],"O":[85,"M42-61Q34-61 29-54Q24-48 24-36Q24-25 29-19Q34-12 42-12Q51-12 56-19Q61-25 61-36Q61-48 56-54Q51-61 42-61ZM42-74Q60-74 70-64Q80-54 80-36Q80-19 70-9Q60 1 42 1Q25 1 15-9Q5-19 5-36Q5-54 15-64Q25-74 42-74Z"],"P":[73.3,"M9-73L40-73Q54-73 62-67Q69-61 69-49Q69-38 62-31Q54-25 40-25L28-25L28 0L9 0ZM28-59L28-39L38-39Q44-39 47-42Q50-44 50-49Q50-54 47-57Q44-59 38-59Z"],"Q":[85,"M44 1L43 1Q25 1 15-9Q5-19 5-36Q5-54 15-64Q25-74 42-74Q60-74 70-64Q80-54 80-36Q80-24 75-15Q69-6 60-2L74 15L56 15ZM42-61Q34-61 29-54Q24-48 24-36Q24-25 29-18Q34-12 42-12Q51-12 56-19Q61-25 61-36Q61-48 56-54Q51-61 42-61Z"],"R":[77,"M36-41Q42-41 44-43Q47-45 47-50Q47-55 44-57Q42-59 36-59L28-59L28-41ZM28-28L28 0L9 0L9-73L38-73Q52-73 59-68Q66-63 66-53Q66-46 62-41Q59-36 52-34Q56-33 59-30Q62-27 65-21L75 0L55 0L46-18Q43-24 41-26Q38-28 33-28Z"],"S":[72,"M60-71L60-55Q54-58 48-59Q42-61 37-61Q31-61 27-59Q24-57 24-53Q24-50 26-48Q29-47 34-46L42-44Q54-42 60-37Q65-32 65-22Q65-10 58-4Q50 1 36 1Q29 1 22 0Q15-1 8-4L8-20Q15-16 21-14Q28-12 34-12Q40-12 43-14Q47-16 47-20Q47-24 44-25Q42-27 36-29L28-30Q17-33 12-38Q7-43 7-52Q7-62 14-68Q21-74 34-74Q40-74 47-73Q53-72 60-71Z"],"T":[68.2,"M0-73L68-73L68-59L44-59L44 0L25 0L25-59L0-59Z"],"U":[81.2,"M9-73L28-73L28-29Q28-20 31-16Q34-12 41-12Q47-12 50-16Q53-20 53-29L53-73L72-73L72-29Q72-14 64-6Q56 1 41 1Q25 1 17-6Q9-14 9-29Z"],"V":[77.4,"M0-73L19-73L39-19L58-73L77-73L50 0L27 0Z"],"W":[110.3,"M3-73L21-73L34-20L46-73L64-73L77-20L89-73L107-73L90 0L68 0L55-55L42 0L20 0Z"],"X":[77.1,"M50-37L75 0L56 0L38-25L22 0L2 0L27-37L3-73L23-73L38-49L54-73L74-73Z"],"Y":[72.4,"M-1-73L20-73L36-47L53-73L73-73L46-31L46 0L27 0L27-31Z"],"Z":[72.5,"M6-73L67-73L67-62L28-14L68-14L68 0L4 0L4-11L44-59L6-59Z"],"-":[41.5,"M5-36L36-36L36-22L5-22Z"],"·":[38,"M10-44L28-44L28-25L10-25Z"],".":[38,"M10-19L28-19L28 0L10 0Z"],"/":[36.5,"M26-73L37-73L11 9L0 9Z"],"#":[83.8,"M44-72L40-53L53-53L57-72L68-72L63-53L77-53L77-43L61-43L58-29L71-29L71-19L55-19L50 0L40 0L44-19L31-19L27 0L16 0L20-19L7-19L7-29L23-29L26-43L12-43L12-53L29-53L34-72ZM50-43L37-43L34-29L47-29Z"],"'":[30.6,"M21-73L21-46L10-46L10-73Z"],"酒":[100,"M41 12Q38 12 34 12Q34 5 34-2L34-56L51-56L51-70L41-70Q36-70 31-70Q32-73 31-75Q36-75 41-75L86-75Q91-75 96-75Q96-73 96-70Q91-70 86-70L73-70L73-56L90-56L90 12L84 12L84 4L41 4Q41 8 41 12ZM16 13Q12 11 7 10Q12 0 16-11Q20-21 26-39L30-37L20-3ZM15-36Q9-45 1-53L7-58Q15-49 21-40ZM26-61Q19-69 12-77L17-82Q25-74 32-65ZM66-51L58-51Q58-41 55-33Q51-26 45-22Q44-25 41-26L41-18L84-18L84-25L76-25Q72-25 69-27Q66-30 66-34ZM73-51L73-34Q73-32 74-31Q74-29 76-29L84-29L84-51ZM51-51L41-51L41-28Q52-34 51-51ZM84-13L41-13L41-1L84-1ZM66-56L66-70L58-70L58-56Z"],"店":[100,"M41 12Q37 12 33 12Q34 5 34-2L34-26L53-26L53-53Q53-60 53-66Q57-66 61-66Q60-60 60-53L60-48L80-48Q85-48 90-49Q90-46 90-43Q85-43 80-43L60-43L60-26L85-26L85 12L79 12L79 3L41 3Q41 8 41 12ZM18-26L18-74L51-74L45-79L50-85L61-76L59-74L85-74Q91-74 96-74Q96-72 96-69Q91-69 85-69L25-69L25-26Q25-1 9 12Q7 8 3 7Q18-2 18-26ZM79-2L79-21L41-21L40-2Z"],"银":[100,"M70-10Q79 2 96 5Q93 8 92 12Q82 10 73 3Q65-4 61-14Q56-24 56-35L49-35L49 2L65-5L67 0Q63 1 56 5Q49 9 44 12L41 6Q42 3 42 0L42-74L82-74L82-32L76-32L76-35L62-35Q62-24 67-16Q72-19 77-25L84-31Q87-29 89-27Q82-18 70-10ZM49-39L76-39L76-52L49-52ZM49-57L76-57L76-69L49-69ZM17-79Q20-78 25-77Q23-71 21-64L33-64Q38-64 43-64Q43-62 43-59Q38-60 33-60L19-60Q17-53 15-47L31-47Q36-47 41-48Q40-45 41-43Q36-43 31-43L26-43L26-30L34-30Q39-30 44-31Q43-28 44-26Q39-26 34-26L26-26L26-5L39-17L42-14Q40-12 39-11Q30-2 22 8L17 3Q19 1 19-2L19-26L13-26Q9-26 4-26Q4-28 4-31Q9-30 13-30L19-30L19-43L13-43Q10-37 7-32Q4-34 0-34Q3-40 7-47Q14-61 17-79Z"],"行":[100,"M69 0L69-41L51-41Q45-41 40-40Q40-44 40-47Q45-46 51-46L85-46Q91-46 97-47Q96-44 97-40Q91-41 85-41L76-41L76 3Q76 7 73 9Q69 13 58 13Q59 8 55 4Q59 5 63 5Q67 5 68 4Q69 4 69 0ZM91-73Q91-70 91-67Q85-67 80-67L57-67Q51-67 46-67Q46-70 46-73Q51-73 57-73L80-73Q85-73 91-73ZM30-57Q34-55 38-53Q32-46 26-39L26 0Q26 7 26 13Q22 13 18 13Q18 7 18 0L18-31L7-20Q5-22 1-24Q12-33 22-47ZM27-80Q31-78 35-76Q28-64 16-55Q12-52 8-49Q6-52 2-54Q12-60 20-70Q24-75 27-80Z"],"寿":[100,"M15-36Q10-36 4-36Q5-39 4-42Q10-41 15-41L36-41Q37-46 39-50L25-50Q20-50 14-49Q15-52 14-55Q20-55 25-55L40-55Q41-59 42-65L21-65Q16-65 10-64Q11-67 10-70Q16-70 21-70L42-70Q43-76 43-79Q47-79 52-79Q51-75 51-70L81-70Q87-70 92-70Q92-67 92-64Q87-65 81-65L50-65Q49-60 48-55L71-55Q76-55 82-55Q81-52 82-49Q76-50 71-50L46-50Q45-45 43-41L85-41Q90-41 96-42Q96-39 96-36Q90-36 85-36L40-36Q38-31 35-27L68-27Q68-30 68-34Q72-33 75-34Q75-30 75-27L84-27Q90-27 95-27Q95-24 95-21Q90-21 84-21L75-21L75 3Q75 7 72 9Q68 13 58 13Q59 8 56 4Q59 5 63 5Q67 5 67 4Q68 4 68 1L68-21L43-21L51-8L45-4L35-19L39-21Q35-21 31-21Q21-7 7 3Q5-1 1-3Q11-9 19-18Q27-26 33-36Z"],"司":[100,"M19-6L12-6L12-43L56-43L56-6L49-6L49-12L19-12ZM66-59Q66-56 66-53Q60-53 54-53L13-53Q7-53 2-53Q2-56 2-59Q7-59 13-59L54-59Q60-59 66-59ZM76-2L76-72L20-72Q14-72 8-71Q9-75 8-78Q14-78 20-78L83-78L83 1Q83 8 79 10Q74 13 64 13Q65 8 62 4Q65 5 69 5Q73 5 75 4Q76 3 76-2ZM49-37L19-37L19-18L49-18Z"],"云":[100,"M17-37Q11-37 5-37Q5-40 5-44Q11-43 17-43L81-43Q87-43 93-44Q93-40 93-37Q87-37 81-37L47-37Q45-34 38-24L22 1L65-3L71-3L58-23L65-28L76-10L88 9L81 13L74 2L65 3L12 8L11 2Q13 2 15 0Q18-5 26-17Q34-29 38-37ZM82-73Q82-70 82-66Q76-67 70-67L27-67Q21-67 15-66Q15-70 15-73Q21-72 27-72L70-72Q76-72 82-73Z"],"药":[100,"M62-11Q57-19 52-27L58-31Q64-23 69-14ZM82 0L82-42L59-42Q53-31 46-20Q43-23 39-24Q45-31 49-39Q53-47 58-59Q61-57 65-56Q63-51 61-47L89-47L89 3Q89 7 86 10Q81 14 71 13Q72 8 69 5Q72 5 76 5Q80 5 81 5Q82 4 82 0ZM5-1Q20-1 32-3Q36-4 46-6L45-1Q20 4 6 7Q7 3 5-1ZM36-49Q39-46 43-44Q42-42 39-40Q37-37 29-29Q20-20 17-18L35-20L42-21L42-16L36-15L5-11L4-16Q6-16 8-18Q17-25 25-34L2-33L2-38Q4-38 6-40Q9-42 15-49Q22-56 24-60Q27-57 30-55Q29-53 23-47Q16-41 14-39L27-39L29-39Q34-45 36-49ZM69-62Q65-62 61-62Q62-66 62-69L33-69Q33-65 34-62Q30-62 26-62Q26-66 26-69L13-69Q8-69 2-69Q2-71 2-74Q8-74 13-74L26-74Q26-78 26-83Q30-83 34-83Q33-78 33-74L62-74Q62-78 61-83Q65-83 69-83Q69-78 69-74L84-74Q90-74 96-74Q96-71 96-69Q90-69 84-69L69-69Q69-65 69-62Z"],"渔":[100,"M94 3Q94 6 94 9Q90 8 85 8L38 8Q33 8 28 9Q29 6 28 3Q33 4 38 4L85 4Q90 4 94 3ZM46-4L39-4L39-43Q36-39 32-36Q30-39 26-40Q36-50 42-59Q48-68 52-81Q56-79 60-78L56-70L78-70L79-64Q77-64 76-62Q75-61 70-53L90-53L90-4L83-4L83-9L46-9ZM67-13L83-13L83-29L67-29ZM60-13L60-29L46-29L46-13ZM67-34L83-34L83-48L67-48ZM60-34L60-48L46-48L46-34ZM46-53L62-53L70-65L53-65Q50-59 46-53ZM14 12Q10 9 4 9Q8 1 13-9Q17-19 25-44L29-42L18-5ZM21-45L15-40L2-53L7-58ZM23-61Q16-69 9-75L14-80Q22-73 29-65Z"],"港":[100,"M50 10Q45 10 42 8Q40 5 40 1L40-24Q33-16 24-10Q23-13 20-15Q28-20 33-27Q39-33 44-43L36-43Q32-43 27-43Q27-46 27-48Q32-48 36-48L44-48L44-61L40-61Q35-61 31-60Q31-63 31-65Q35-65 40-65L44-65L44-69Q44-76 44-82Q48-82 51-82Q51-76 51-69L51-65L66-65L66-69Q66-76 66-82Q69-82 73-82Q73-76 73-69L73-65L79-65Q84-65 88-65Q88-63 88-60Q84-61 79-61L73-61L73-48L83-48Q88-48 93-48Q92-46 93-43Q88-43 83-43L71-43Q76-35 82-30Q87-25 96-20Q93-18 91-15Q82-19 74-29L74-7L67-7L67-9L46-9L46 1Q46 2 47 4Q48 5 50 5L74 5Q76 5 77 4Q77 2 78 1L79-9Q82-7 86-7L83 5Q83 7 82 9Q81 10 79 10ZM46-14L67-14L67-25L46-25ZM45-30L74-30Q68-36 65-43L51-43Q49-36 45-30ZM66-48L66-61L51-61L51-48ZM12 12Q9 9 4 9Q7 1 11-9Q15-19 22-44L25-42L16-5ZM18-45L13-40L1-53L6-58ZM20-61Q14-69 8-75L13-80Q20-73 25-65Z"],"码":[100,"M85-19Q85-16 85-13Q80-13 74-13L50-13Q45-13 39-13Q40-16 39-19Q45-19 50-19L74-19Q80-19 85-19ZM88 1L88-32L49-32L52-54Q52-61 53-68Q57-68 60-68Q59-61 59-54L57-37L74-37L79-73L56-73Q51-73 45-72Q46-75 45-78Q51-78 56-78L86-78L81-37L95-37L95 3Q95 7 92 9Q88 13 77 13Q78 8 75 4Q78 5 82 5Q87 5 87 4Q88 4 88 1ZM11-47L11-48L11-48Q14-56 16-69L5-68Q5-71 5-74Q10-74 15-74L30-74Q35-74 41-74Q40-71 41-68Q35-69 30-69L23-69Q23-59 19-48L38-48L38 0L31 0L31-9L18-9L18 0L11 0L11-32Q9-29 8-27Q5-29 1-30Q7-38 11-47ZM31-43L18-43L18-14L31-14Z"],"头":[100,"M17-28Q11-28 5-27Q5-30 5-34Q11-33 17-33L50-33L50-68Q50-75 50-82Q54-82 58-82Q57-75 57-68L57-33L84-33Q90-33 96-34Q96-30 96-27Q90-28 84-28L57-28Q56-24 55-21L58-25L77-9L96 7L91 13L72-3L54-18Q49-7 36 2Q24 10 10 13Q9 8 4 6Q15 5 25 0Q35-4 41-12Q48-19 50-28ZM34-37Q23-46 11-54L15-60Q27-52 39-42ZM39-58Q31-67 21-74L26-80Q36-73 45-64Z"],"鹈":[100,"M32 12Q28 12 25 12Q25 5 25-1L25-17Q19-6 6 5Q4 3 1 1Q7-4 11-10Q16-16 22-26L9-26L9-47L25-47L25-58L18-58Q13-58 9-57Q9-60 9-62Q13-62 18-62L28-62Q33-70 36-80Q40-79 43-78Q41-71 35-62L48-62L48-43L31-43L31-31L48-31L48-13Q48-10 45-7Q41-5 36-5Q37-10 34-13Q35-13 37-13Q41-12 41-13Q42-13 42-14L42-26L31-26L31-1Q31 5 32 12ZM26-66L20-63L10-78L17-82ZM25-31L25-43L15-43Q15-37 16-31ZM31-47L41-47L41-58L33-58L32-57Q32-58 31-58ZM86-13Q85-10 86-7Q81-8 77-8L64-8Q60-8 56-7Q56-10 56-13Q60-12 64-12L77-12Q81-12 86-13ZM80-51L75-46L68-57L73-61ZM78-33Q79-38 77-41Q79-41 82-41Q85-41 85-41Q86-42 86-43L86-63L72-63L71-62Q71-63 70-63Q69-63 66-63L66-29L96-29L96 4Q96 8 94 11Q90 14 82 14Q83 9 80 6Q83 6 86 6Q90 6 90 5Q91 5 91 3L91-25L61-25L61-68Q65-68 68-68Q72-72 73-78Q76-77 79-76Q78-71 76-68L91-68L91-42Q91-39 89-37Q86-33 78-33Z"],"鹕":[100,"M49-26L39-26Q40-11 35-2Q30 7 22 12Q21 9 17 7Q33 0 33-22L33-74L56-74L56 1Q56 8 52 10Q48 13 41 12Q42 8 39 5Q41 5 44 5Q47 5 48 4Q49 3 49-3ZM12-2L5-2L5-38Q9-38 13-38L13-54L2-53Q2-56 2-58L13-58L13-69Q13-76 13-82Q16-82 20-82Q19-76 19-69L19-58L32-58Q32-56 32-53L19-54L19-38L28-38L28-2L21-2L21-10L12-10ZM49-52L49-70L39-70L39-52ZM49-30L49-49L39-49L39-30ZM21-34L12-34L12-14L21-14ZM87-13Q86-10 87-7Q83-8 79-8L66-8Q63-8 59-7Q59-10 59-13Q63-12 66-12L79-12Q83-12 87-13ZM81-51L77-46L71-57L75-61ZM80-33Q80-38 78-41Q80-41 83-41Q86-41 86-41Q87-42 87-43L87-63L74-63L73-62Q73-63 72-63Q71-63 68-63L68-29L97-29L97 4Q97 8 94 11Q91 14 83 14Q84 9 81 6Q84 6 87 6Q90 6 91 5Q91 5 91 3L91-25L63-25L63-68Q67-68 71-68Q74-72 75-78Q78-77 81-76Q79-71 78-68L92-68L92-42Q92-39 90-37Q87-33 80-33Z"],"航":[100,"M93 11L84 11Q80 11 78 9Q75 6 75 0L75-45L62-45L62-19Q62-6 57 2Q53 8 48 11Q46 8 42 6Q56 0 56-19L55-50L81-50L81 0Q81 6 85 6L89 6Q90 6 90 5Q90 4 90 2L91-7Q94-5 97-5L95 10Q94 11 93 11ZM94-64Q93-62 94-59Q89-59 84-59L57-59Q52-59 47-59Q47-62 47-64Q52-64 57-64L84-64Q89-64 94-64ZM75-69L68-65L60-81L66-85ZM9 11Q6 8 1 8Q5 4 8-2Q11-8 11-20L11-38Q7-38 4-38Q4-40 4-43Q7-42 11-42L11-70Q14-70 17-70Q20-74 23-79Q27-78 31-76Q29-73 26-70L42-70L42-1Q42 3 39 6Q36 10 27 10Q28 5 25 1Q27 2 29 2Q33 2 34 1Q34 1 34-5L34-38L18-38L18-29L24-31L32-18L25-15L18-26Q19-3 9 11ZM34-42L34-65L22-65L21-64Q21-65 20-65Q19-65 18-65Q18-61 18-56L23-60L33-50L26-45L18-55L18-42Z"],"运":[100,"M18-38L14-38Q9-38 3-38Q3-41 3-44Q9-44 14-44L25-44L25-6Q32 0 39 2Q45 4 56 4L94 4Q90 7 91 11L56 11Q33 11 21-2L7 10Q5 7 2 4L18-6ZM22-61Q17-69 10-77L16-82Q23-74 28-65ZM94-53Q93-50 94-47Q88-47 83-47L57-47Q60-45 64-43Q61-40 54-30L45-17L72-19L75-20Q72-25 68-30L75-35Q83-22 90-10L83-6L78-15L72-15L35-10L34-16Q36-16 38-17Q41-21 47-31Q54-41 56-47L43-47Q38-47 32-47Q33-50 32-53Q38-52 43-52L83-52Q88-52 94-53ZM88-76Q87-73 88-70Q82-70 77-70L52-70Q47-70 41-70Q42-73 41-76Q47-76 52-76L77-76Q82-76 88-76Z"],"无":[100,"M67 11Q63 11 60 8Q57 5 57 0L57-42L49-42Q49-31 46-23Q43-14 37-8Q27 5 10 11Q9 7 4 5Q15 3 24-4Q32-11 37-20Q42-30 42-42L18-42Q11-42 5-41Q5-45 5-48Q11-48 18-48L42-48L42-71L25-71Q19-71 13-70Q13-74 13-77Q19-77 25-77L73-77Q79-77 85-77Q85-74 85-70Q79-71 73-71L49-71L49-48L81-48Q87-48 93-48Q93-45 93-41Q87-42 81-42L64-42L64 0Q64 2 65 3Q66 4 67 4L86 4Q88 4 88 3Q89 2 89 0L91-12Q95-10 98-10L95 8Q95 9 94 10Q93 11 92 11Z"],"人":[100,"M45-79Q49-79 54-79Q54-70 53-62Q54-51 57-39Q67-7 96 6Q92 8 90 12Q74 4 64-11Q54-24 50-42Q39-1 7 16Q5 11 1 9Q12 3 21-5Q30-13 35-24Q41-35 43-48Q45-62 45-79Z"],"机":[100,"M93 12L81 12Q74 11 71 6Q70 4 70 0Q70-4 70-35Q70-65 70-70L55-70L55-34Q55-4 36 11Q34 7 29 6Q48-5 48-34L48-75L77-75L77 0Q77 6 81 6L88 6Q89 6 89 5Q90 3 90 0L91-14Q94-11 97-11L95 9Q95 10 94 11Q94 12 93 12ZM8-11Q5-12 0-12Q7-24 13-40L19-54L4-53Q4-56 4-58L19-58L19-69Q19-75 19-82Q23-81 27-82Q27-75 27-69L27-58L41-58Q40-56 41-53L27-54L27-43L30-45L40-33L33-29L27-37L27-2Q27 4 27 11Q23 10 19 11Q19 4 19-2L19-34Q17-28 13-21Z"],"数":[100,"M4-23Q4-26 4-28Q9-28 13-28L18-28Q20-33 21-37Q25-36 29-36L26-28L43-28Q43-14 34-4Q39 1 44 5Q40 8 38 10Q34 5 29 1Q20 9 8 11Q6 8 4 4Q15 4 24-3Q18-8 12-11Q14-17 17-24ZM32-37Q29-37 25-37Q25-44 25-50L25-55Q23-50 19-45Q15-39 6-32Q4-35 1-36Q10-44 17-55L12-55Q7-55 3-55Q3-58 3-60L16-60L5-73L11-78L22-63L18-60L25-60L25-66Q25-73 25-80Q29-79 32-80Q32-73 32-66L32-63Q37-70 42-79Q45-77 48-76Q44-68 38-60L49-60Q49-58 49-55L36-55L47-43L41-38L32-49Q32-43 32-37ZM29-8Q35-15 36-24L24-24L20-14Q25-11 29-8ZM32-55L32-53L35-55ZM32-60L35-60Q33-61 32-61ZM60-79Q63-78 67-77Q65-69 63-60L63-59L84-59Q89-59 94-59Q93-56 94-53L84-53Q83-30 75-14Q83-2 97 5Q94 7 93 11Q80 4 71-8Q63 7 47 14Q46 10 43 7Q59 1 68-14Q60-28 59-46Q55-37 50-28Q48-31 44-32Q47-38 51-46Q55-54 57-62Q59-71 60-79ZM64-53Q64-44 66-35Q68-26 71-20Q77-34 77-53Z"],"据":[100,"M27 8Q41-2 41-25L41-76L91-76L91-54L47-54L47-40L66-40Q65-45 65-50Q69-50 72-50Q72-45 72-40L87-40Q92-40 96-41Q96-38 96-35Q92-36 87-36L72-36L72-23L89-23L89 12L83 12L83 3L56 3Q56 8 56 12Q52 12 49 12Q49 5 49-1L49-23L66-23L66-36L47-36L47-25Q47-1 34 12Q31 8 27 8ZM83-18L56-18L56-1L83-1ZM47-58L84-58L84-71L47-71ZM0-28Q9-29 17-33L17-54L11-54Q6-54 2-53Q2-56 2-58Q6-58 11-58L17-58L17-67Q17-73 17-80Q20-80 23-80Q23-73 23-67L23-58L34-58Q34-56 34-53L23-54L23-35L32-40L33-36L23-31L23 2Q23 10 17 12Q12 14 7 14Q8 9 5 6Q8 6 11 6Q15 6 16 5Q17 4 17-1L17-28L13-25L4-20Q3-25 0-28Z"],"塔":[100,"M49 12Q45 12 42 12Q42 5 42-1L42-20L83-20L83 12L77 12L77 5L49 5Q49 9 49 12ZM79-33Q79-31 79-28Q74-28 70-28L55-28Q50-28 46-28Q46-30 46-32Q41-27 35-23Q33-26 30-27Q39-34 45-41Q52-49 59-60Q61-58 63-57Q64-58 64-57Q65-57 66-56L65-55Q71-46 78-41Q85-36 96-33Q93-31 92-27Q84-29 75-35Q67-41 61-50Q55-41 47-33Q51-33 55-33L70-33Q74-33 79-33ZM76-55Q73-55 69-55Q69-60 69-65L54-65Q54-60 54-55Q50-55 47-55Q47-60 47-65L41-65Q37-65 32-65Q32-67 32-70Q37-70 41-70L47-70Q47-76 47-82Q50-82 54-82Q54-76 54-70L69-70Q69-76 69-82Q73-82 76-82Q76-76 76-70L86-70Q91-70 95-70Q95-67 95-65Q91-65 86-65L76-65Q76-60 76-55ZM77-15L48-15L48 1L77 1ZM-1-10Q8-12 16-15L16-50L11-50Q6-50 1-50Q1-52 1-55Q6-55 11-55L16-55L16-67Q16-73 16-80Q19-80 23-80Q23-73 23-67L23-55L36-55Q36-52 36-50L23-50L23-18L34-24L35-20Q20-12 13-8L3-2Q2-7-1-10Z"],"水":[100,"M55 0Q55 9 48 11Q44 13 37 13Q38 8 35 4Q38 4 41 5Q45 5 46 4Q47 3 47-4L47-67Q47-75 47-82Q51-82 55-82Q55-75 55-67L55-62Q57-53 61-43Q68-49 76-57L84-65Q86-61 89-59Q79-48 63-37Q66-32 69-28Q79-13 96-4Q92-2 90 2Q67-11 55-40ZM6-50Q6-53 6-57Q12-57 19-57L39-57Q38-38 30-23Q22-7 9 3Q5 0 1-1Q16-10 24-26Q30-37 31-50L19-50Q12-50 6-50Z"],"上":[100,"M96-2Q96 2 96 5Q89 5 83 5L15 5Q8 5 2 5Q2 2 2-2Q8-2 15-2L45-2L45-67Q45-75 45-82Q49-82 53-82Q53-75 53-67L53-46L74-46Q80-46 87-47Q87-43 87-40Q80-40 74-40L53-40L53-2L83-2Q89-2 96-2Z"],"的":[100,"M67-17Q61-27 53-37L59-42Q67-32 74-21ZM84-57L63-57Q56-41 47-30Q45-32 43-33L43 12L36 12L36 5L14 5Q14 9 14 12Q10 12 7 12Q7 5 7-2L7-60Q12-60 18-60Q21-66 25-80Q29-79 32-78Q31-70 25-60L43-60L43-37Q53-49 56-60Q59-69 61-80Q65-79 69-79Q67-70 64-62L91-62L91 2Q91 7 88 10Q85 13 74 13Q75 8 71 4Q74 5 78 5Q83 5 84 4Q84 3 84-1ZM36-30L36-54L14-54L14-30ZM36-25L14-25L14 0L36 0Z"],"士":[100,"M89-1Q89 3 89 6Q83 6 76 6L22 6Q15 6 8 6Q9 3 8-1Q15-1 22-1L45-1L45-41L15-41Q8-41 2-41Q2-44 2-48Q8-48 15-48L45-48L45-67Q45-75 45-82Q49-82 53-82Q53-75 53-67L53-48L83-48Q89-48 96-48Q96-44 96-41Q89-41 83-41L53-41L53-1L76-1Q83-1 89-1Z"],"请":[100,"M76 1L76-6L46-6L46-2Q46 5 46 12Q42 11 39 12Q39 5 39-2L39-37L82-37L82 3Q82 9 77 11Q73 13 66 13Q67 8 64 4Q67 5 71 5Q74 5 75 4Q76 4 76 1ZM96-47Q96-45 96-42Q92-42 87-42L38-42Q34-42 29-42Q29-45 29-47Q34-47 38-47L57-47L57-55L46-55Q41-55 37-55Q37-58 37-60Q41-60 46-60L57-60L57-68L41-68Q36-68 31-68Q31-71 31-73Q36-73 41-73L57-73Q57-78 57-82Q61-82 64-82Q64-78 64-73L83-73Q88-73 92-73Q92-71 92-68Q88-68 83-68L64-68L64-60L77-60Q82-60 87-60Q87-58 87-55Q82-55 77-55L64-55L64-47L87-47Q92-47 96-47ZM76-24L76-32L46-32Q46-28 46-24ZM76-11L76-19L46-19L46-11ZM1-41Q1-43 1-46Q5-46 10-46L22-46L22-8L29-16L31-20L35-16L32-13L19 4L14 0Q15-1 15-3L15-41ZM16-58Q10-68 3-76L9-81Q17-72 23-62Z"],"勿":[100,"M90-61L90 2Q90 8 86 11Q81 13 71 13Q73 8 69 4Q72 5 77 5Q81 5 82 4Q83 3 83-2L83-55L71-55Q60-19 58-13Q54-3 39 4Q27 11 14 13Q14 9 11 5Q23 3 35-2Q49-9 52-18Q53-20 55-26L63-55L51-55Q49-36 37-22Q24-7 6-3Q6-8 3-11Q14-13 24-20Q33-26 38-36Q41-44 43-55L31-55Q21-38 7-29Q5-33 1-35Q14-42 22-54Q25-59 28-67Q31-75 32-80Q36-79 41-78Q38-69 34-61Z"],"喂":[100,"M47-17L47 2L61-5L63-1Q60 0 53 4Q47 9 42 12L39 7Q41 5 41 3L41-17Q41-23 40-29Q36-29 32-29Q32-32 32-34Q37-34 41-34L83-34Q88-34 93-34Q92-32 93-29Q88-29 83-29L62-29Q66-21 70-15L77-22L83-27Q85-24 88-22Q85-19 79-14Q74-10 74-10Q82 0 96 5Q93 7 92 11Q80 6 70-5Q61-15 56-29L47-29Q47-23 47-17ZM38-42Q39-61 38-79L87-79Q86-61 87-42ZM66-63L80-63L80-75L66-75ZM59-63L59-75L44-75L44-63ZM66-59L66-47L80-47L80-59ZM59-59L44-59L44-47L59-47ZM10-4L4-4L4-74L28-74L28-4L22-4L22-13L10-13ZM22-70L10-70L10-17L22-17Z"],"禁":[100,"M90 3L85 9L74-1L62-11L66-16L78-7ZM32-16Q35-13 38-11Q27 3 8 11Q7 7 4 5Q13 2 19-3Q26-8 32-16ZM48 3L48-17L16-17Q12-17 7-17Q7-19 7-22Q12-22 16-22L84-22Q89-22 93-22Q93-19 93-17Q89-17 84-17L54-17L54 4Q54 7 52 9Q48 13 40 13Q41 8 38 5Q43 5 47 5Q48 4 48 3ZM77-35Q77-32 77-30Q73-30 68-30L31-30Q26-30 22-30Q22-32 22-35Q26-34 31-34L68-34Q73-34 77-35ZM72-66Q79-51 96-46Q92-44 91-40Q78-46 70-57L70-52Q70-45 71-39Q67-39 63-39Q64-45 64-52L64-56Q57-46 45-38Q43-41 40-42Q47-47 51-52Q56-58 61-66L52-65Q52-68 52-70L64-70Q64-76 63-82Q67-82 71-82Q70-76 70-70L83-70Q88-70 92-70Q92-68 92-65Q88-66 83-66ZM31-39Q27-39 24-39L24-53Q18-44 7-36Q5-39 2-40Q8-45 13-50Q18-56 23-66L15-66Q11-66 6-65Q6-68 6-70Q11-70 15-70L24-70Q24-76 24-82Q27-82 31-82Q31-76 31-70L38-70Q42-70 47-70Q46-68 47-65Q42-66 38-66L31-66L31-64Q39-59 46-53L42-48Q37-52 31-55L31-52Q31-45 31-39Z"],"止":[100,"M96-1Q96 2 96 5Q90 5 83 5L14 5Q8 5 2 5Q2 2 2-1Q8-1 14-1L21-1L21-45Q21-52 21-59Q25-59 29-59Q28-52 28-45L28-1L50-1L50-68Q50-75 50-82Q54-82 58-82Q57-75 57-68L57-47L74-47Q80-47 87-47Q86-44 87-40Q80-40 74-40L57-40L57-1L83-1Q90-1 96-1Z"],"游":[100,"M56-46Q66-59 67-79Q71-79 75-79Q74-71 72-63L86-63Q91-63 95-63Q95-61 95-58Q91-58 86-58L70-58Q68-54 66-49Q70-49 75-49L91-49L92-43Q90-43 89-42L82-33L82-26L87-26Q92-26 96-26Q96-23 96-21Q92-21 87-21L82-21L82 3Q82 7 79 9Q75 13 65 13Q66 8 63 5Q66 5 70 5Q74 5 75 4Q75 4 75 1L75-21L71-21Q66-21 62-21Q62-23 62-26Q66-26 71-26L75-26L75-36L82-44L75-44Q70-44 66-44Q66-46 66-48Q64-46 63-43Q60-46 56-46ZM52-1L52-36L42-36Q42-8 29 10Q26 8 22 9Q30-2 33-13Q36-25 36-41L36-54Q31-54 27-54Q27-56 27-59Q31-59 36-59L52-59Q56-59 61-59Q61-56 61-54Q56-54 52-54L42-54L42-41L58-41L58 1Q58 5 56 7Q52 11 41 11Q42 6 39 3Q42 3 46 3Q50 3 51 2Q52 2 52-1ZM50-65L44-61L36-77L43-80ZM13 12Q9 9 4 9Q8 1 11-9Q15-19 23-44L26-42L17-5ZM19-45L14-40L1-53L7-58ZM21-61Q15-69 8-75L13-80Q20-73 26-65Z"],"泳":[100,"M65 1Q65 8 61 10Q56 13 47 13Q48 8 45 4Q48 5 52 5Q56 5 57 4Q58 3 58-2L58-60L40-60Q40-63 40-65Q45-65 51-65L65-65L65-57Q67-49 68-43Q73-46 76-50Q79-54 82-60Q85-58 89-57Q84-45 71-37Q75-26 81-17Q88-9 97-2Q93-1 90 3Q74-11 65-35ZM33-39Q34-42 33-45Q39-45 44-45L52-45Q51-40 51-36Q50-33 50-28Q49-24 48-20Q47-17 45-13Q43-9 41-6Q36 1 29 7Q25 4 21 3Q42-10 45-39ZM64-67Q58-73 50-79L54-85Q63-79 70-72ZM12 12Q9 9 4 9Q8 1 11-9Q15-19 22-44L26-42L16-5ZM19-45L14-40L1-53L7-58ZM20-61Q15-69 8-75L13-80Q20-73 26-65Z"],"湾":[100,"M77-36L46-36Q42-36 37-35Q38-38 37-40Q42-40 46-40L84-40L84-24L46-23L43-16L89-16L84 5Q82 13 63 13Q64 10 63 8Q62 6 61 5Q64 5 70 5Q76 4 77 4Q77 3 78 2L81-11L35-11L40-26L40-27L40-27L41-29L44-27L77-28ZM91-43Q84-53 74-60L78-66Q89-58 97-47ZM39-62Q42-60 46-59Q43-51 37-40L33-34Q30-37 27-37Q32-44 36-53ZM73-43Q69-43 66-43Q66-49 66-56L66-68L57-68L57-57Q57-50 58-43Q54-44 50-43Q51-50 51-57L51-68L39-68Q34-68 29-68Q30-70 29-73Q34-72 39-72L61-72L51-79L55-85L68-77L65-72L87-72Q92-72 96-73Q96-70 96-68Q92-68 87-68L73-68L73-56Q73-49 73-43ZM11 12Q8 9 4 9Q7 1 10-9Q14-19 20-44L23-42L15-5ZM17-45L12-40L1-53L6-58ZM18-61Q13-69 7-75L12-80Q18-73 23-65Z"],"号":[100,"M14-37Q8-37 2-36Q2-39 2-43Q8-42 14-42L84-42Q90-42 96-43Q96-39 96-36Q90-37 84-37L39-37L35-26L80-26L78 4Q77 7 75 9Q72 11 68 12Q65 13 57 13Q58 8 54 4Q58 5 63 5Q69 4 70 4Q70 3 71 2L73-20L25-20L31-37ZM21-49Q23-64 21-78L76-78Q74-64 75-49ZM28-72L28-55L68-55L68-72Z"],"拉":[100,"M97 3Q96 6 97 9Q91 8 86 8L47 8Q42 8 37 9Q37 6 37 3Q42 3 47 3L63 3Q73-14 75-28Q76-37 76-46Q80-45 84-46Q81-16 72 3L86 3Q91 3 97 3ZM55-46Q59-27 63-7L56-5Q52-25 48-45ZM94-59Q93-56 94-53Q88-54 83-54L55-54Q50-54 44-53Q45-56 44-59Q50-59 55-59L65-59Q61-68 55-77L62-81Q68-71 72-61L67-59L83-59Q88-59 94-59ZM0-28Q11-29 20-33L20-54L13-54Q8-54 2-53Q3-56 2-58Q8-58 13-58L20-58L20-67Q20-73 19-80Q23-80 27-80Q27-73 27-67L27-58L40-58Q39-56 40-53L27-54L27-35L38-40L38-36L27-31L27 2Q27 10 20 12Q14 14 8 14Q9 9 5 6Q9 6 13 6Q17 6 18 5Q20 4 20-1L20-28L15-25L4-20Q4-25 0-28Z"],"面":[100,"M17 12Q13 12 9 12Q10 5 10-2L10-57L34-57Q38-62 43-72L12-72Q7-72 2-72Q2-75 2-78Q7-77 12-77L86-77Q91-77 96-78Q96-75 96-72Q91-72 86-72L50-72Q48-65 42-57L88-57L88 12L81 12L81 4L17 4Q17 8 17 12ZM64 0L81 0L81-52L64-52ZM57-39L57-52L39-52L39-39ZM57-20L57-34L39-34L39-20ZM57 0L57-15L39-15L39 0ZM32 0L32-52L16-52L16 0Z"],"茶":[100,"M89 4L84 9L73-3L61-14L66-19L78-8ZM32-20Q35-17 38-15Q29 0 10 10Q9 7 6 4Q14 0 20-5Q26-11 32-20ZM48 1L48-23L28-23Q23-23 18-22Q18-25 18-28Q23-28 28-28L48-28Q48-34 47-40Q51-40 55-40Q54-34 54-28L73-28Q78-28 83-28Q83-25 83-22Q78-23 73-23L54-23L54 3Q54 9 50 11Q45 13 39 13Q40 9 37 5Q40 5 43 5Q46 5 47 5Q48 4 48 1ZM52-61Q58-50 69-44Q79-37 94-36Q92-33 91-29Q80-30 68-37Q57-43 49-53Q30-31 6-23Q5-27 2-30Q10-33 19-37Q28-41 34-47Q41-54 46-61L49-59ZM69-57Q65-58 61-57Q62-62 62-66L33-66Q33-62 34-57Q30-58 26-57Q26-62 26-66L13-66Q8-66 2-66Q2-69 2-72Q8-72 13-72L26-72Q26-77 26-82Q30-82 34-82Q33-77 33-72L62-72Q62-77 61-82Q65-82 69-82Q69-77 69-72L84-72Q90-72 96-72Q96-69 96-66Q90-66 84-66L69-66Q69-62 69-57Z"],"网":[100,"M16-3Q16 5 17 12Q13 11 9 12Q9 5 9-3L9-77L89-77L89 1Q89 10 81 12Q78 13 72 13Q73 8 70 4Q73 4 77 5Q80 5 81 4Q82 3 82-2L82-72L16-72L16-15Q27-27 32-39Q27-49 20-59L26-63Q31-56 36-49Q38-58 39-66Q44-65 48-64Q45-51 40-40Q45-30 49-19Q56-29 60-37Q55-48 49-58L56-62Q61-54 64-46Q68-56 70-64Q74-62 78-62Q74-49 69-38Q74-25 78-13L71-10Q68-20 64-29Q57-15 48-5Q45-8 40-9Q45-14 49-19L42-17Q39-24 36-31Q30-18 22-9Q20-11 16-12Z"],"吧":[100,"M53 11Q48 11 45 8Q42 5 42 0L42-78L90-78L90-33L83-33L83-36L49-36L49 0Q49 2 50 3Q51 4 53 4L86 4Q89 4 90-2L92-19Q95-16 99-17L96 3Q95 11 91 11ZM62-41L62-73L49-73L49-41ZM69-41L83-41L83-73L69-73ZM12-4L4-4L5-74L32-74L32-4L25-4L25-13L12-13ZM25-70L12-70L12-17L25-17Z"],"当":[100,"M10-37Q10-40 10-43Q15-43 21-43L45-43L45-68Q45-75 45-82Q48-81 52-82Q52-75 52-68L52-43L85-43L85 11L78 11L78 5L21 5Q16 5 11 6Q11 3 11 0Q16 0 21 0L78 0L78-15L26-15Q21-15 16-15Q16-18 16-21Q21-21 26-21L78-21L78-37L21-37Q15-37 10-37ZM74-73Q78-72 82-71Q78-55 64-43Q62-46 59-47Q64-52 68-58Q72-64 74-73ZM29-45Q22-57 15-69L22-73Q29-61 35-48Z"],"铺":[100,"M89-70L83-66L75-75L80-80ZM70 12Q66 12 62 12Q63 5 63-1L63-12L50-12L50-2Q50 5 50 12Q47 11 43 12Q44 5 44-2L43-51L50-51L50-51L63-51L63-59L54-59Q49-59 45-59Q45-62 45-64Q49-64 54-64L63-64L63-65Q63-72 62-79Q66-78 70-79Q69-72 69-65L69-64L88-64Q92-64 97-64Q96-62 97-59Q92-59 88-59L69-59L69-51L91-51L91 2Q90 9 85 11Q81 13 76 12Q77 8 74 4Q76 5 79 5Q83 5 83 4Q84 4 84-1L84-12L69-12L69-1Q69 5 70 12ZM69-16L84-16L84-29L69-29ZM63-16L63-29L50-29L50-16ZM69-33L84-33L84-47L69-47ZM63-33L63-47L50-47L50-33ZM15-79Q18-78 22-77Q21-71 19-64L30-64Q34-64 39-64Q39-62 39-59Q34-60 30-60L17-60Q15-53 13-47L28-47Q32-47 37-48Q36-45 37-43Q32-43 28-43L23-43L23-30L31-30Q35-30 39-31Q39-28 39-26Q35-26 31-26L23-26L23-5L35-17L38-14Q36-12 35-11Q27-2 20 8L16 3Q17 1 17-2L17-26L12-26Q8-26 3-26Q4-28 3-31Q8-30 12-30L17-30L17-43L12-43Q9-37 7-32Q4-34 0-34Q3-40 6-47Q13-61 15-79Z"],"ネ":[102.3,"M91-15L84-10Q76-19 64-27L69-32Q83-22 91-15ZM79-52Q79-52 79-52Q79-51 76-49Q75-49 68-41Q66-39 65-39Q59-34 53-30L53 13L46 13L46-24Q28-14 12-9L5-15Q19-17 41-30Q59-41 67-50L17-50L17-57Q21-57 32-57Q41-57 46-57L46-74Q54-73 55-72L55-72L53-69L53-68L53-57L71-58Z"],"オ":[102.3,"M88-45L62-45L62 2Q62 10 49 11Q49 11 43 11L39 3L51 3Q54 3 54 1Q54 0 54-1L54-45L9-45L9-51L54-51L54-71L61-70Q63-69 63-68L62-65L62-65L62-51L88-51ZM53-37Q44-24 28-12Q20-5 13-1L6-6Q17-10 31-23Q44-34 48-43Z"],"ン":[102.3,"M38-52L32-46Q29-51 19-59Q15-62 12-63L18-67Q24-64 36-54Q37-53 38-52ZM92-41Q62-12 25 4Q22 5 21 6L20 6Q20 7 19 7Q18 7 12-1Q48-10 80-40Q84-44 88-48Z"],"タ":[102.3,"M83-53Q83-53 81-50L80-49Q71-30 64-21Q63-20 63-20Q72-12 79-4L73 2Q71-2 60-13Q60-13 59-15Q42 4 20 15L14 9Q29 4 46-12Q50-16 54-20Q43-31 35-37L40-41Q44-38 55-27Q57-26 58-25Q69-39 74-54L41-54Q29-39 19-32L12-36Q22-41 34-56Q43-67 46-75Q52-72 53-71Q53-70 53-70Q53-69 51-68Q51-68 46-61L46-59L72-59L76-60L76-60Q78-60 81-56Q83-54 83-53Z"],"ワ":[102.3,"M85-58Q85-30 68-7Q60 3 51 11L43 5Q58-4 67-21Q77-38 77-55L77-61L21-61L21-32L13-32L13-68L85-68Z"],"ー":[100,"M9-33L9-43L91-43L91-33Z"]};
