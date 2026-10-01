// Pelican Bay — runtime. The only module that touches the DOM at top level.
import * as C from './contract.js';
import { DIST_PER_REV, LAYERS, SLOTS, RIDER_X, GROUND_Y, BIKE, TOD_DEFAULT, CADENCE } from './contract.js';
import { rng, clamp, wrap } from './core/math.js';
import { mount, xf, h } from './core/svg.js';
import { createBus } from './core/bus.js';
import { samplePalette, applyPalette, v } from './core/palette.js';
import { createCamera, layerTransform, layerZoom, fitAspect } from './core/camera.js';
import { foldOpacity } from './core/opacity.js';
import { createSheets } from './core/sheets.js';
import { solvePose, TIMING } from './rig/solve.js';
import { buildSceneMarkup, checkIds } from './scene.js';
import * as bike from './art/bike.js';
import * as pelicanBody from './art/pelican-body.js';
import * as pelicanLimbs from './art/pelican-limbs.js';
import * as sky from './world/sky.js';
import * as sea from './world/sea.js';
import * as land from './world/land.js';
import * as fx from './fx/fx.js';
import * as print from './world/print.js';
import * as eggs from './fx/eggs.js';
import * as weather from './world/weather.js';
import * as director from './world/director.js';
import { createUI } from './ui/ui.js';
import { createAudio } from './audio/audio.js';
import { bakeSVG } from './bake/bake.js';

const ART = [sky, sea, land, fx, bike, pelicanBody, pelicanLimbs, print, eggs, weather, director];
const params = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || params.has('reduced');
const freeze = params.has('freeze');
const solo = params.get('solo');         // e.g. ?solo=bike renders only that module (+ rider slots)
const quality = params.get('q') || 'high';

// ---------- state ----------
const state = {
  t: 0, playing: !freeze && !reduced, cadenceTarget: reduced ? CADENCE.stroll : CADENCE.cruise, cadence: 0,
  speed: 0, distance: 0, crank: 0, coasting: false,
  tod: params.has('tod') ? +params.get('tod') : TOD_DEFAULT, todAuto: params.has('autotod'), dayLength: 120,
  events: [], cam: params.get('cam') || 'wide',
  toggles: { sound: false, music: false, speedlines: true, gulls: true, hud: !params.has('nohud'), skeleton: params.has('skeleton') },
};
state.cadence = state.cadenceTarget; state.speed = (state.cadence / 60) * DIST_PER_REV;

const bus = createBus();
const ctx = { C, rng: salt => rng('pelican-bay:' + salt), v, h, quality, reduced };

// ---------- build scene ----------
const stage = document.getElementById('stage');
const drop = (params.get('drop') || '').split(',');   // ?drop=a,b: leave modules out (perf bisection)
const mods = (solo ? ART.filter(m => m.id === solo || ['sky'].includes(m.id) && solo === 'world') : ART).filter(m => !drop.includes(m.id));
const { markup, problems } = buildSceneMarkup(mods, ctx);
problems.forEach(p => console.error('[scene] ' + p));
stage.innerHTML = '';
// #scene is a wrapper <div> holding a stack of composited <svg> sheets (core/sheets.js); modules get the wrapper as
// their root (querySelector finds every element), the single <svg> comes back for the baker / downloads
const svg = stage.appendChild(document.createElement('div'));
svg.id = 'scene';
svg.setAttribute('role', 'img'); svg.setAttribute('aria-labelledby', 'scene-title scene-desc');
mount(svg, markup);
const svgRoot = svg.querySelector('svg#scene');
const dups = checkIds(svg);
if (dups.length) console.error('[scene] duplicate ids: ' + [...new Set(dups)].join(', '));

// lead-owned layers: atmosphere + vignette + letterbox
mount(svg.querySelector('#L-letterbox'), h('g', { id: 'lead-letterbox' },
  h('rect', { id: 'lead-lb-top', x: -10, y: -10, width: 1620, height: 0, fill: v('inkP') }),
  h('rect', { id: 'lead-lb-bot', x: -10, y: 900, width: 1620, height: 0, fill: v('inkP') })));
// ---------- the calm page (STYLE-B §4 "Focus", the draft keyframe): lead-owned ----------
// 1. Atmospheric veils: static, filter-free vertical washes of the hour's low-sky haze paint, laid over the far layers
//    (start of L-atmo: hills, lighthouse, sea, boats) and, thinner, over the shore band (start of L-roadside: the
//    village, beach, harbour). The background gets lighter, softer and lower in contrast as it recedes, so the rider
//    is the brightest, most outlined thing on the page. A veil rides in its layer's (static) root sheet, so it is
//    rasterised once; no extra compositor layer.
const VEIL = [['far', 'L-atmo', [[250, 0], [405, 0.2], [470, 0.4], [560, 0.26], [660, 0.1], [760, 0]]],
  ['mid', 'L-roadside', [[300, 0], [410, 0.16], [500, 0.22], [600, 0.14], [690, 0.05], [735, 0]]]];
mount(svgRoot.querySelector('defs'), VEIL.map(([k, , st]) => h('linearGradient', { id: 'lead-veil-' + k, x1: 0, y1: st[0][0], x2: 0, y2: st[st.length - 1][0], gradientUnits: 'userSpaceOnUse' },
  st.map(([y, o]) => h('stop', { offset: ((y - st[0][0]) / (st[st.length - 1][0] - st[0][0])).toFixed(3), 'stop-color': v('skyHaze'), 'stop-opacity': o })))).join(''));
for (const [k, layer, st] of VEIL) {
  const L = svg.querySelector('#' + layer);
  if (L) L.insertAdjacentHTML('afterbegin', h('g', { id: 'lead-veil-' + k, 'data-pb-veil': '', 'aria-hidden': 'true' },
    h('rect', { x: -900, y: st[0][0], width: 3400, height: st[st.length - 1][0] - st[0][0], fill: `url(#lead-veil-${k})` })));
}
// 2. Ambient movers as rare beats. Edition C put every toy and critter on screen at once (a balloon, an airship, a
//    biplane towing a second "Pelican Bay" banner, a bee, two butterflies, a dragonfly, a fly and dandelion seeds all
//    around the rider). The storybook page shows at most ONE sky toy and ONE small critter at a time (plus the gulls),
//    each fading in and out over 3 s inside its slot (so t = 0 opens on a clean page). The schedule is a pure function of t, so renderAt / shots / the baker agree.
//    Sky toys take turns in 80 s slots after a calm, toy-free opening page (0–80 s: the draft's composition); the
//    critters rotate in 20 s slots. A hidden mover's sheet leaves compositing (opacity 0 → visibility hidden).
const CALM_TOYS = { period: 320, slot: 80, order: [null, 'sky-plane', 'sky-balloonG', 'sky-shipG'] };
const CALM_BUGS = { slot: 20, order: ['fx-bf0', 'fx-flyG', 'fx-dfly', 'fx-bf1', 'fx-seedG', 'fx-beeG'] };
const CALM_FADE = 3;
function calmAlpha(ref, t) {
  const ramp = (a, b) => clamp(Math.min(t - a, b - t) / CALM_FADE, 0, 1);   // 3 s fades inside the slot: slots never overlap
  let i = CALM_TOYS.order.indexOf(ref);
  if (i >= 0) { const P = CALM_TOYS.period, s = CALM_TOYS.slot, c = Math.floor(t / P) * P + i * s; return Math.max(ramp(c, c + s), ramp(c - P, c - P + s), ramp(c + P, c + P + s)); }
  i = CALM_BUGS.order.indexOf(ref);
  if (i >= 0) { const s = CALM_BUGS.slot, P = s * CALM_BUGS.order.length, c = Math.floor(t / P) * P + i * s; return Math.max(ramp(c, c + s), ramp(c - P, c - P + s), ramp(c + P, c + P + s)); }
  return 1;
}
const CALM_REFS = [...CALM_TOYS.order.filter(Boolean), ...CALM_BUGS.order];
// showcase times: one moment inside each mover's beat (tools/detail-inventory.mjs counts the beats there too)
const calmShowcase = () => [...CALM_TOYS.order.map((r, i) => r && { ref: r, t: i * CALM_TOYS.slot + [0, 40, 60, 30][i] }), ...CALM_BUGS.order.map((r, i) => ({ ref: r, t: i * CALM_BUGS.slot + 10 }))].filter(Boolean);
const calmState = new Map();
function applyCalm(t, live) {
  if (params.has('busy')) return;   // ?busy: every mover at once (edition C's behaviour, for comparison)
  for (const ref of CALM_REFS) {
    const el = svg.querySelector(`[data-ref="${ref}"]`);
    if (!el) continue;
    const a = Math.round(calmAlpha(ref, t) * 50) / 50;
    // the mover's own sheet when it has one (a compositor opacity), else the element (a repaint, only during a fade)
    const part = el.closest('svg');
    const own = part && part !== svgRoot && part.getAttribute('data-sheet') === ref;
    const tgt = own ? part : el;
    const st = calmState.get(ref);
    if (st && st.a === a && st.tgt === tgt) continue;
    if (st && st.tgt !== tgt) { st.tgt.style.opacity = ''; st.tgt.style.display = ''; }
    calmState.set(ref, { a, tgt });
    tgt.style.opacity = a >= 1 ? '' : String(a);
    tgt.style.display = a <= 0 ? 'none' : '';
  }
}

// split into one <svg> per layer, one per moving strip (module export `sheets`: hoisted translate) and one per busy prop
// (module export `isolate`); the rider is cut into groups of slots (first slot of each group below: far wing · far leg ·
// wheels · static frame/fork/bars · drivetrain · neck/tail/body · near leg · head · near wing), so a moving group
// repaints only its own art. ?nosheets keeps the single <svg>.
const RIDER_SHEETS = ['pedalFar', 'wheelRear', 'frame', 'bars', 'cog', 'neck', 'pedalNear', 'pouch', 'wingNearUpper'];   // integrator: bars (steering bob) cut off the static frame/fork sheet
// RIGID rider (default since the gouache restyle; ?norigid = the grouped sheets above): every slot is its own RIGID
// sheet (core/sheets.js): in live play a slot's pose is a compositor move of its sheet, so the rider's art rasterises
// once instead of every frame. Edition C measured the grouped sheets cheaper under software compositing; the storybook
// rider (textured gouache patterns, baked double lines) made raster the bottleneck: grouped 66-78 ms CPU/frame vs
// rigid 61-65 ms, and fps +8-20% in paired runs on this box (lead, /proc CPU per frame).
const RIGID = !params.has('norigid');
const slotSel = SLOTS.map(x => '#j-' + x);
const sheets = createSheets(svg, svgRoot, { layers: LAYERS.map(l => l[0]), sheets: mods.flatMap(m => m.sheets || []), scale: (d, cam) => layerZoom(cam, d),
  cuts: RIGID ? [] : RIDER_SHEETS.map(x => '#j-' + x), rigid: RIGID ? slotSel : [], rigidClip: params.has('rigidclip'),
  isolate: [...mods.flatMap(m => m.isolate || []), ...(RIGID ? slotSel : []), ...CALM_BUGS.order.map(r => `[data-ref="${r}"]`)] });
addEventListener('resize', () => sheets.resize());

const layerEls = LAYERS.map(([id, depth]) => [svg.querySelector('#' + id), depth]);
const riderEl = svg.querySelector('#rider');
const slotEls = SLOTS.map(s => [s, svg.querySelector('#j-' + s)]);
const lbTop = svg.querySelector('#lead-lb-top'), lbBot = svg.querySelector('#lead-lb-bot');
// dirty-checked attribute writes: an unchanged transform string costs no style / paint invalidation
const lastAttr = new WeakMap();
const setA = (el, k, val) => { let m = lastAttr.get(el); if (!m) lastAttr.set(el, m = {}); if (m[k] !== val) { m[k] = val; el.setAttribute(k, val); } };
let insetVB = 0, lastCamKey = '', curCam = null;   // bottom sheet height (viewBox units), reported by the UI on portrait screens

const extraMaterials = Object.assign({}, ...ART.map(m => m.materials || {}));
const modPerf = params.has('modperf') ? {} : null;   // ?modperf: per-module update() ms totals in __pb.modPerf
const attached = mods.map(m => { try { const a = m.attach ? m.attach(svg, ctx) : null; if (a) a.__id = m.id; return a; } catch (e) { console.error(`${m.id}.attach() threw`, e); return null; } }).filter(Boolean);

const camera = createCamera(state.cam);
camera.snap(state.cam);

// ---------- UI / audio ----------
bus.on('ui:inset', ({ bottom }) => { insetVB = (bottom / Math.max(1, innerHeight)) * 900; });
const ui = createUI(document.getElementById('ui'), bus, { state, reduced, bakeAvailable: true });
const audio = createAudio(bus);
const eggsApi = mods.includes(eggs) ? eggs.connect({ bus, state, svg }) : null;   // easter eggs (owner: eggs)
const dir = director.connect({ bus, state, off: params.has('nodirector') });   // weather / encounters / pacing (owner: director)
const emitRig = type => { const e = { type, t0: state.t }; state.events.push(e); bus.emit('rig:event', e); if (type === 'hop') setTimeout(() => bus.emit('rig:land', {}), TIMING.hop.land * 1000); };
let lastHop = -9, lastCoast = false;
bus.on('ui:bell', () => emitRig('bell'));
bus.on('ui:wave', () => emitRig('wave'));
bus.on('ui:gulp', () => emitRig('gulp'));
bus.on('ui:hop', () => { if (state.t - lastHop > TIMING.hop.gap) { lastHop = state.t; emitRig('hop'); } });
bus.on('ui:camera', ({ mode }) => { state.cam = mode; camera.set(mode); });
bus.on('ui:speed', ({ cadence }) => { state.cadenceTarget = clamp(cadence, CADENCE.min, CADENCE.max); });
bus.on('ui:coast', ({ on }) => { state.coasting = !!on; });
bus.on('ui:tod', ({ tod, auto }) => { if (tod !== undefined) state.tod = wrap(tod, 1); if (auto !== undefined) state.todAuto = auto; palDirty = true; });
bus.on('ui:toggle', ({ key, value }) => { state.toggles[key] = value; });
bus.on('ui:play', ({ on }) => { state.playing = on ?? !state.playing; last = performance.now(); });
bus.on('ui:sound', async ({ on }) => { state.toggles.sound = on; if (on) await audio.enable(); else audio.disable(); });
bus.on('ui:download', ({ kind }) => download(kind));
for (const ev of ['ui:tod', 'ui:camera', 'ui:toggle', 'ui:speed']) bus.on(ev, () => { if (!state.playing && !freeze) requestAnimationFrame(() => render(0)); });
// click-to-feed: any hit on the rider, or a near miss (within 12 px of the bird's body, neck, head or bill boxes), on every camera
const birdParts = ['j-body', 'j-neck', 'j-head', 'j-billUpper', 'j-pouch'].map(id => svg.querySelector('#' + id)).filter(Boolean);
svg.addEventListener('click', e => {
  if (e.target.closest && e.target.closest('[id^="j-"]')) { bus.emit('ui:gulp', {}); return; }   // any rider slot (the rider spans several sheets)
  for (const el of birdParts) { const b = el.getBoundingClientRect(), m = 12; if (e.clientX > b.left - m && e.clientX < b.right + m && e.clientY > b.top - m && e.clientY < b.bottom + m) { bus.emit('ui:gulp', {}); return; } }
});

// ---------- frame ----------
let pal = samplePalette(state.tod, extraMaterials), palDirty = true, palT = 0;
function step(dt) {
  state.t += dt;
  if (state.todAuto) { state.tod = wrap(state.tod + dt / state.dayLength, 1); palDirty = true; }
  const k = 1 - Math.exp(-dt * 2.2);
  if (state.coasting) {
    state.speed *= Math.exp(-dt * 0.08);
    state.cadence = (state.speed / DIST_PER_REV) * 60;
  } else {
    state.cadence += (state.cadenceTarget - state.cadence) * k;
    state.speed = (state.cadence / 60) * DIST_PER_REV;
  }
  const dd = state.speed * dt;
  state.distance += dd;
  if (!state.coasting) state.crank += dd / (BIKE.R * C.GEAR);
  const mk = state.events.filter(e => e.type === 'coast' || e.type === 'pedal').pop();   // keep the latest coast/pedal marker
  state.events = state.events.filter(e => state.t - e.t0 < 8 || e === mk);
}

function render(dt) {
  const tR0 = modPerf ? performance.now() : 0;
  const dz = dir.pre(dt);
  // coast / pedal markers for the rig (user, director or eggs may flip state.coasting); live play only, so renderAt stays pure
  if (dt > 0 && state.coasting !== lastCoast) state.events.push({ type: state.coasting ? 'coast' : 'pedal', t0: state.t });
  lastCoast = state.coasting;
  const pose = solvePose(state.t, { crank: state.crank, distance: state.distance, cadence: state.cadence, speed: state.speed, coasting: state.coasting, events: state.events, tod: state.tod, loopT: state.loopT });
  // portrait / narrow screens: fit the rider bbox (wheel to wheel + margin) above the bottom sheet
  const cam = fitAspect(camera.update(dt, state.t, reduced, state.events), innerWidth / Math.max(1, innerHeight), insetVB);
  curCam = cam;
  palT += dt;
  if (palDirty && (palT > 0.1 || dt === 0)) { pal = samplePalette(state.tod, extraMaterials); applyPalette(svg, pal); palDirty = false; palT = 0; }
  // layer camera transforms: rebuilt only when the camera moved (wide / close are static between moves)
  const camKey = `${cam.zoom} ${cam.fx} ${cam.fy} ${cam.roll}`;
  if (camKey !== lastCamKey) { lastCamKey = camKey; for (const [el, d] of layerEls) if (el && d !== null) setA(el, 'transform', layerTransform(cam, d)); }
  const lb = cam.letterbox.toFixed(2);
  setA(lbTop, 'height', +lb + 10); setA(lbBot, 'y', 900 - lb); setA(lbBot, 'height', +lb + 10);
  const [rcx, rcy] = BIKE.rearContact;
  setA(riderEl, 'transform', `translate(${RIDER_X} ${(GROUND_Y + pose.riderY).toFixed(2)}) rotate(${pose.bikePitch.toFixed(3)} ${rcx} ${rcy})`);
  for (const [s, el] of slotEls) { const j = pose.joints[s]; if (j && el) setA(el, 'transform', xf(j)); }
  sheets.flush();   // camera / rider transforms reach the wrapper clones of the other sheets before any module measures
  // head focus in viewBox coords (depth-1 layers): sky / fx props should keep out of this circle (no-overlap zone)
  const hj = pose.joints.head, pr = (pose.bikePitch * Math.PI) / 180;
  const hx = hj ? hj.x - rcx : 0, hy = hj ? hj.y - rcy : 0;
  const hwx = RIDER_X + rcx + hx * Math.cos(pr) - hy * Math.sin(pr), hwy = GROUND_Y + pose.riderY + rcy + hx * Math.sin(pr) + hy * Math.cos(pr);
  const headBox = { x: 800 + (hwx + 40 - cam.fx) * cam.zoom, y: 450 + (hwy - 30 - cam.fy) * cam.zoom, r: 150 * cam.zoom };
  const frame = {
    t: state.t, dt, distance: state.distance, speed: state.speed, cadence: state.cadence, coasting: state.coasting,
    tod: state.tod, sun: pal.sun, moon: pal.moon, night: pal.num.night, pal, pose, cam, toggles: state.toggles,
    quality, reduced, events: state.events, weather: dz.weather, director: dz, headBox,
  };
  if (modPerf) {   // per-module totals, plus the last 600 frames' per-module ms in __pb.modPerf().frames (spike hunting)
    const fr = { core: performance.now() - tR0 }; let t1 = performance.now();
    for (const a of attached) if (a.update) { try { a.update(frame); } catch (e) { console.error(e); a.update = null; } const t2 = performance.now(); fr[a.__id] = t2 - t1; t1 = t2; }
    ui.update(frame); audio.update(frame); applyCalm(state.t, dt > 0); sheets.flush(); sheets.update(cam, dt > 0); fr.ui = performance.now() - t1;
    for (const k in fr) modPerf[k] = (modPerf[k] || 0) + fr[k];
    modPerf.n = (modPerf.n || 0) + 1; (modPerf.frames ||= []).push(fr); if (modPerf.frames.length > 600) modPerf.frames.shift();
    return frame;
  }
  else { for (const a of attached) if (a.update) try { a.update(frame); } catch (e) { console.error(e); a.update = null; }
  ui.update(frame); audio.update(frame); }
  applyCalm(state.t, dt > 0);
  sheets.flush(); sheets.update(cam, dt > 0);
  return frame;
}

// ---------- loop ----------
let last = performance.now(), fpsAcc = [];
// ?perf HUD: fps, JS ms (median / p95), DOM nodes, and with ?modperf the per-module update() ms
const perfOn = params.has('perf');
const hudEl = perfOn && params.get('perf') !== 'quiet' ? document.body.appendChild(Object.assign(document.createElement('pre'), { id: 'perf-hud' })) : null;
let hudN = 0;
function hud() {
  if (!hudEl || ++hudN % 30) return;
  const a = fpsAcc.slice(-120), dts = a.map(x => x.dt), js = a.map(x => x.js).sort((x, y) => x - y);
  const fps = 1 / (dts.reduce((s, x) => s + x, 0) / dts.length);
  let txt = `fps ${fps.toFixed(1)}  js ${js[js.length >> 1].toFixed(2)} / p95 ${js[Math.floor(js.length * 0.95)].toFixed(2)} ms  dom ${svg.getElementsByTagName('*').length}`;
  if (modPerf && modPerf.n) txt += '\n' + Object.entries(modPerf).filter(([k]) => k !== 'n' && k !== 'frames').map(([k, v]) => `${k.padEnd(14)}${(v / modPerf.n).toFixed(3)}`).join('\n');
  hudEl.textContent = txt;
}
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state.playing) { const t0 = performance.now(); step(dt); render(dt); if (perfOn) { fpsAcc.push({ dt, js: performance.now() - t0 }); if (fpsAcc.length > 3600) fpsAcc.splice(0, 1800); hud(); } }
  requestAnimationFrame(loop);
}
render(0);
if (!params.has('nofold')) foldOpacity(svg);   // perf: static leaf opacity -> fill/stroke-opacity (core/opacity.js)
// split after the first render: every wrapper already carries the attributes the runtime writes (rider, layers)
if (!params.has('nosheets')) { sheets.split(); sheets.update(curCam); }
requestAnimationFrame(loop);
document.addEventListener('visibilitychange', () => { last = performance.now(); });

// ---------- export ----------
function download(kind) {
  let blob, name;
  if (kind === 'svg') { blob = new Blob([sheets.whole(s => bakeSVG(s, { cadence: 60, tod: state.tod, pose: solvePose, state }))], { type: 'image/svg+xml' }); name = 'pelican-bicycle.svg'; }
  else { blob = new Blob([sheets.whole(s => new XMLSerializer().serializeToString(s))], { type: 'image/svg+xml' }); name = 'pelican-bay-frame.svg'; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- test / tooling API ----------
window.__pb = {
  ready: true, state, bus, svg, audio, eggs: eggsApi, director: dir.api,
  pose: () => solvePose(state.t, state),
  // Deterministic render at sim time t (pauses the loop).
  renderAt(t, o = {}) {
    state.playing = false;
    const cad = o.cadence ?? 60;
    state.t = t; state.cadence = cad; state.cadenceTarget = cad; state.speed = (cad / 60) * DIST_PER_REV;
    state.distance = state.speed * t; state.crank = state.distance / (BIKE.R * C.GEAR);
    if (o.crankDeg !== undefined) state.crank = (o.crankDeg * Math.PI) / 180;
    state.events = o.events || [];
    state.loopT = o.loopT;
    if (o.tod !== undefined) state.tod = o.tod;
    if (o.cam) { state.cam = o.cam; camera.snap(o.cam, t); }
    camera.preroll(t, state.events);
    if (o.toggles) Object.assign(state.toggles, o.toggles);
    palDirty = true;
    return render(0);
  },
  play() { state.playing = true; last = performance.now(); },
  perf: () => fpsAcc, modPerf: () => modPerf,
  bakeSVG: opts => sheets.whole(s => bakeSVG(s, { cadence: 60, tod: state.tod, pose: solvePose, state, ...opts })),
  sheets,
  calm: { alpha: calmAlpha, showcase: calmShowcase, refs: CALM_REFS },
};
