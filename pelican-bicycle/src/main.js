// Pelican Bay — runtime. The only module that touches the DOM at top level.
import * as C from './contract.js';
import { DIST_PER_REV, LAYERS, SLOTS, RIDER_X, GROUND_Y, BIKE, TOD_DEFAULT, CADENCE } from './contract.js';
import { rng, clamp, wrap } from './core/math.js';
import { mount, xf, h } from './core/svg.js';
import { createBus } from './core/bus.js';
import { samplePalette, applyPalette, v } from './core/palette.js';
import { createCamera, layerTransform } from './core/camera.js';
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
const mods = solo ? ART.filter(m => m.id === solo || ['sky'].includes(m.id) && solo === 'world') : ART;
const { markup, problems } = buildSceneMarkup(mods, ctx);
problems.forEach(p => console.error('[scene] ' + p));
stage.innerHTML = '';
mount(stage, markup);
const svg = stage.querySelector('svg#scene');
const dups = checkIds(svg);
if (dups.length) console.error('[scene] duplicate ids: ' + [...new Set(dups)].join(', '));

// lead-owned layers: atmosphere + vignette + letterbox
mount(svg.querySelector('#L-letterbox'), h('g', { id: 'lead-letterbox' },
  h('rect', { id: 'lead-lb-top', x: -10, y: -10, width: 1620, height: 0, fill: v('inkP') }),
  h('rect', { id: 'lead-lb-bot', x: -10, y: 900, width: 1620, height: 0, fill: v('inkP') })));

const layerEls = LAYERS.map(([id, depth]) => [svg.querySelector('#' + id), depth]);
const riderEl = svg.querySelector('#rider');
const slotEls = SLOTS.map(s => [s, svg.querySelector('#j-' + s)]);
const lbTop = svg.querySelector('#lead-lb-top'), lbBot = svg.querySelector('#lead-lb-bot');

const extraMaterials = Object.assign({}, ...ART.map(m => m.materials || {}));
const modPerf = params.has('modperf') ? {} : null;   // ?modperf: per-module update() ms totals in __pb.modPerf
const attached = mods.map(m => { try { const a = m.attach ? m.attach(svg, ctx) : null; if (a) a.__id = m.id; return a; } catch (e) { console.error(`${m.id}.attach() threw`, e); return null; } }).filter(Boolean);

const camera = createCamera(state.cam);
camera.snap(state.cam);

// ---------- UI / audio ----------
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
svg.querySelector('#L-rider').addEventListener('click', () => bus.emit('ui:gulp', {}));

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
  const cam = camera.update(dt, state.t, reduced);
  // portrait / narrow screens: the slice-fit viewBox crops the sides, so pan toward the rider
  const aspect = innerWidth / Math.max(1, innerHeight);
  if (aspect < 1.5 && cam.mode !== 'close') {
    const k = Math.min(1, (1.5 - aspect) / 0.9);
    cam.fx += (RIDER_X + 24 - cam.fx) * k;
    cam.fy += (GROUND_Y - 300 - cam.fy) * k * 0.7;
    cam.zoom *= 1 - 0.2 * Math.min(1, (1.2 - aspect) / 0.6) * (aspect < 1.2 ? 1 : 0);   // fit the whole bike on phones
  }
  palT += dt;
  if (palDirty && (palT > 0.1 || dt === 0)) { pal = samplePalette(state.tod, extraMaterials); applyPalette(svg, pal); palDirty = false; palT = 0; }
  for (const [el, d] of layerEls) if (el && d !== null) el.setAttribute('transform', layerTransform(cam, d));
  lbTop.setAttribute('height', cam.letterbox + 10); lbBot.setAttribute('y', 900 - cam.letterbox); lbBot.setAttribute('height', cam.letterbox + 10);
  const [rcx, rcy] = BIKE.rearContact;
  riderEl.setAttribute('transform', `translate(${RIDER_X} ${(GROUND_Y + pose.riderY).toFixed(2)}) rotate(${pose.bikePitch.toFixed(3)} ${rcx} ${rcy})`);
  for (const [s, el] of slotEls) { const j = pose.joints[s]; if (j && el) el.setAttribute('transform', xf(j)); }
  const frame = {
    t: state.t, dt, distance: state.distance, speed: state.speed, cadence: state.cadence, coasting: state.coasting,
    tod: state.tod, sun: pal.sun, moon: pal.moon, night: pal.num.night, pal, pose, cam, toggles: state.toggles,
    quality, reduced, events: state.events, weather: dz.weather, director: dz,
  };
  if (modPerf) { let t1 = performance.now(); for (const a of attached) if (a.update) { try { a.update(frame); } catch (e) { console.error(e); a.update = null; } const t2 = performance.now(); modPerf[a.__id] = (modPerf[a.__id] || 0) + t2 - t1; t1 = t2; } ui.update(frame); audio.update(frame); modPerf.ui = (modPerf.ui || 0) + performance.now() - t1; modPerf.n = (modPerf.n || 0) + 1; }
  else { for (const a of attached) if (a.update) try { a.update(frame); } catch (e) { console.error(e); a.update = null; }
  ui.update(frame); audio.update(frame); }
  return frame;
}

// ---------- loop ----------
let last = performance.now(), fpsAcc = [];
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state.playing) { const t0 = performance.now(); step(dt); render(dt); if (params.has('perf')) fpsAcc.push({ dt, js: performance.now() - t0 }); }
  requestAnimationFrame(loop);
}
render(0);
requestAnimationFrame(loop);
document.addEventListener('visibilitychange', () => { last = performance.now(); });

// ---------- export ----------
function download(kind) {
  let blob, name;
  if (kind === 'svg') { blob = new Blob([bakeSVG(svg, { cadence: 60, tod: state.tod, pose: solvePose, state })], { type: 'image/svg+xml' }); name = 'pelican-bicycle.svg'; }
  else { blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }); name = 'pelican-bay-frame.svg'; }
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
    if (o.toggles) Object.assign(state.toggles, o.toggles);
    palDirty = true;
    return render(0);
  },
  play() { state.playing = true; last = performance.now(); },
  perf: () => fpsAcc, modPerf: () => modPerf,
  bakeSVG: opts => bakeSVG(svg, { cadence: 60, tod: state.tod, pose: solvePose, state, ...opts }),
};
