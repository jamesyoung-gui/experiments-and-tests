// Pelican Bay — runtime. The only module that touches the DOM at top level.
import * as C from './contract.js';
import { DIST_PER_REV, LAYERS, SLOTS, RIDER_X, GROUND_Y, BIKE, TOD_DEFAULT, CADENCE } from './contract.js';
import { rng, clamp, wrap } from './core/math.js';
import { mount, xf, h } from './core/svg.js';
import { createBus } from './core/bus.js';
import { samplePalette, applyPalette, v } from './core/palette.js';
import { createCamera, layerTransform, layerZoom, fitAspect } from './core/camera.js';
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
  toggles: { sound: false, speedlines: true, gulls: true, hud: !params.has('nohud'), skeleton: params.has('skeleton') },
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
// split into one <svg> per layer + one per moving strip (module export `sheets`); ?nosheets keeps the single <svg>
const sheets = createSheets(svg, svgRoot, { layers: LAYERS.map(l => l[0]), sheets: mods.flatMap(m => m.sheets || []), scale: (d, cam) => layerZoom(cam, d) });
if (!params.has('nosheets')) sheets.split();
addEventListener('resize', () => sheets.resize());

const layerEls = LAYERS.map(([id, depth]) => [svg.querySelector('#' + id), depth]);
const riderEl = svg.querySelector('#rider');
const slotEls = SLOTS.map(s => [s, svg.querySelector('#j-' + s)]);
const lbTop = svg.querySelector('#lead-lb-top'), lbBot = svg.querySelector('#lead-lb-bot');
// dirty-checked attribute writes: an unchanged transform string costs no style / paint invalidation
const lastAttr = new WeakMap();
const setA = (el, k, val) => { let m = lastAttr.get(el); if (!m) lastAttr.set(el, m = {}); if (m[k] !== val) { m[k] = val; el.setAttribute(k, val); } };
let insetVB = 0;   // bottom sheet height (viewBox units), reported by the UI on portrait screens

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
  if (e.target.closest && e.target.closest('#L-rider')) { bus.emit('ui:gulp', {}); return; }
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
  const dz = dir.pre(dt);
  // coast / pedal markers for the rig (user, director or eggs may flip state.coasting); live play only, so renderAt stays pure
  if (dt > 0 && state.coasting !== lastCoast) state.events.push({ type: state.coasting ? 'coast' : 'pedal', t0: state.t });
  lastCoast = state.coasting;
  const pose = solvePose(state.t, { crank: state.crank, distance: state.distance, cadence: state.cadence, speed: state.speed, coasting: state.coasting, events: state.events, tod: state.tod, loopT: state.loopT });
  // portrait / narrow screens: fit the rider bbox (wheel to wheel + margin) above the bottom sheet
  const cam = fitAspect(camera.update(dt, state.t, reduced, state.events), innerWidth / Math.max(1, innerHeight), insetVB);
  palT += dt;
  if (palDirty && (palT > 0.1 || dt === 0)) { pal = samplePalette(state.tod, extraMaterials); applyPalette(svg, pal); palDirty = false; palT = 0; }
  for (const [el, d] of layerEls) if (el && d !== null) setA(el, 'transform', layerTransform(cam, d));
  const lb = cam.letterbox.toFixed(2);
  setA(lbTop, 'height', +lb + 10); setA(lbBot, 'y', 900 - lb); setA(lbBot, 'height', +lb + 10);
  const [rcx, rcy] = BIKE.rearContact;
  setA(riderEl, 'transform', `translate(${RIDER_X} ${(GROUND_Y + pose.riderY).toFixed(2)}) rotate(${pose.bikePitch.toFixed(3)} ${rcx} ${rcy})`);
  for (const [s, el] of slotEls) { const j = pose.joints[s]; if (j && el) setA(el, 'transform', xf(j)); }
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
  if (modPerf) { let t1 = performance.now(); for (const a of attached) if (a.update) { try { a.update(frame); } catch (e) { console.error(e); a.update = null; } const t2 = performance.now(); modPerf[a.__id] = (modPerf[a.__id] || 0) + t2 - t1; t1 = t2; } ui.update(frame); audio.update(frame); modPerf.ui = (modPerf.ui || 0) + performance.now() - t1; modPerf.n = (modPerf.n || 0) + 1; }
  else { for (const a of attached) if (a.update) try { a.update(frame); } catch (e) { console.error(e); a.update = null; }
  ui.update(frame); audio.update(frame); }
  sheets.update(cam);
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
  if (modPerf && modPerf.n) txt += '\n' + Object.entries(modPerf).filter(([k]) => k !== 'n').map(([k, v]) => `${k.padEnd(14)}${(v / modPerf.n).toFixed(3)}`).join('\n');
  hudEl.textContent = txt;
}
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state.playing) { const t0 = performance.now(); step(dt); render(dt); if (perfOn) { fpsAcc.push({ dt, js: performance.now() - t0 }); if (fpsAcc.length > 3600) fpsAcc.splice(0, 1800); hud(); } }
  requestAnimationFrame(loop);
}
render(0);
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
};
