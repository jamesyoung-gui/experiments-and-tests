// Pelican Bay — runtime. The only module that touches the DOM at top level.
import * as C from './contract.js';
import { DIST_PER_REV, LAYERS, SLOTS, RIDER_X, GROUND_Y, BIKE, TOD_DEFAULT, CADENCE } from './contract.js';
import { rng, clamp, wrap } from './core/math.js';
import { mount, xf, h } from './core/svg.js';
import { createBus } from './core/bus.js';
import { samplePalette, applyPalette, v } from './core/palette.js';
import { createCamera, layerTransform, layerZoom, fitAspect } from './core/camera.js';
import { createSheets, foldOpacity } from './core/sheets.js';
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
import { bakeSVG, bakeSVGAsync } from './bake/bake.js';
import { STRETCH, lapPos } from './world/route.js';

const ART = [sky, sea, land, fx, bike, pelicanBody, pelicanLimbs, print, eggs, weather, director];
const params = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || params.has('reduced');
const freeze = params.has('freeze');
const solo = params.get('solo');         // e.g. ?solo=bike renders only that module (+ rider slots)
const QUALITY = ['high', 'medium', 'low'];
const qLocked = QUALITY.includes(params.get('q'));      // ?q=high|medium|low pins the tier (no adaptation)
let quality = qLocked ? params.get('q') : 'high';       // live tier, see adaptQuality()

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
// judging foils (page.css): ?notext hides the HUD frame, the UI card and the comic lettering; ?silhouette shows the
// rider alone in solid ink on white (thumbnail / silhouette readability tests, tools/shoot.mjs --set thumb)
if (params.has('notext')) { svg.classList.add('pb-notext'); document.documentElement.classList.add('pb-notext'); }
if (params.has('silhouette')) svg.classList.add('pb-silhouette');
mount(svg, markup);
const svgRoot = svg.querySelector('svg#scene');
const dups = checkIds(svg);
if (dups.length) console.error('[scene] duplicate ids: ' + [...new Set(dups)].join(', '));

// lead-owned layers: atmosphere + vignette + letterbox
mount(svg.querySelector('#L-letterbox'), h('g', { id: 'lead-letterbox' },
  h('rect', { id: 'lead-lb-top', x: -10, y: -10, width: 1620, height: 0, fill: v('inkN') }),
  h('rect', { id: 'lead-lb-bot', x: -10, y: 900, width: 1620, height: 0, fill: v('inkN') })));
// split into one <svg> per layer, one per moving strip (module export `sheets`: hoisted translate) and one per busy prop
// (module export `isolate`); the rider is cut into groups of slots (first slot of each group below: far wing · far leg ·
// wheels · static frame/fork · bars · drivetrain · neck/tail/body · near leg · head · near wing), so a moving group
// repaints only its own art; the wheels are CSS-matrix rotors (?affine=…, ?noaffine = painted).
// RIGID slots (core/sheets.js): a slot alone on its sheet whose pose is a compositor move (CSS matrix), so its art
// rasterises once instead of every frame. Chosen per slot from traces on this box: rigid only pays where the art is
// expensive to raster AND static inside (the head, the bills, the pouch, the eye, the near and far upper wing and
// hand, the near thigh, the frame). Slots whose content changes every frame (the bending neck, the breathing jacket
// and LED scarf, the crest, the primaries, the toes, the chain) stay painted in their groups: making every slot rigid
// halved the rider's raster but the software compositor then draws ~33 rotated layers (+5 ms per frame on its single
// thread) and fps dropped. ?rigid=all | ?rigid=none | ?rigid=a,b,c override; ?nosheets keeps the single <svg>.
const RIGID_DEFAULT = ['wingFarUpper', 'wingFarHand', 'frame', 'thighNear', 'pouch', 'billLower', 'billUpper', 'head', 'eye', 'wingNearUpper', 'wingNearHand'];
const rigidArg = params.get('rigid');
const RIGID_SLOTS = rigidArg === 'all' || rigidArg === '' ? SLOTS.slice() : rigidArg === 'none' ? [] : rigidArg ? rigidArg.split(',').filter(x => SLOTS.includes(x)) : RIGID_DEFAULT;
const RIGID = RIGID_SLOTS.length === SLOTS.length;
const RIDER_AFFINE = RIGID || params.has('noaffine') ? [] : (params.get('affine') ?? 'wheelRear,wheelFront').split(',').filter(x => Boolean(x) && !RIGID_SLOTS.includes(x));
const RIDER_SHEETS = ['pedalFar', 'wheelRear', 'frame', 'bars', 'cog', 'neck', 'pedalNear', 'pouch', 'wingNearUpper'].filter(x => !RIDER_AFFINE.includes(x) && !RIGID_SLOTS.includes(x));
const rigidSel = RIGID_SLOTS.map(x => '#j-' + x);
const sheets = createSheets(svg, svgRoot, { layers: LAYERS.map(l => l[0]), sheets: mods.flatMap(m => m.sheets || []), scale: (d, cam) => layerZoom(cam, d),
  cuts: RIGID ? [] : RIDER_SHEETS.map(x => '#j-' + x), rigid: rigidSel,
  isolate: [...mods.flatMap(m => m.isolate || []), ...rigidSel], affine: RIDER_AFFINE.map(x => '#j-' + x) });
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

// ---------- beat keeper (lead): pacing of the idle auto-director ----------
// The director fires rig beats from encounters (cyclist → wave, cat → bell, gulls / fish / drink → gulp, puddle /
// pothole → hop). Left alone that is lumpy (three gulps in a row, a ~50 s hole after the puddle). The keeper listens to
// every rig beat (user, director, eggs) and, in live play only, adds the courier's own small beats so that
//   · no gap between beats is longer than ~11.5 s (it fires a filler at ≥ 8.5 s when waiting would overshoot);
//   · a filler hop (the showboat bunny-hop) at most every 30 s;
//   · no two beats of the same type follow each other (a filler goes in halfway when the next scheduled one repeats);
//   · the sky set pieces get a reaction: kites → a wave up at them, fireworks → a bell, the rainbow → a wave.
// It backs off for 8 s after any viewer input and never fires within 3 s of another beat or 2.8 s before a scheduled
// one. Deterministic renders (renderAt, bakes) do not run it. Measured by tools/check-beats.mjs (docs/beats.md).
const BEAT_TYPES = ['bell', 'wave', 'gulp', 'hop'];
const KEEP = { maxGap: 11.5, early: 8.5, hopEvery: 30, minGap: 3, lead: 2.8, user: 8, react: { kites: 'wave', fireworks: 'bell' }, fill: ['bell', 'wave', 'bell', 'wave', 'hop'] };
const keeper = { last: null, lastT: state.t, hopT: -1e9, userT: -1e9, n: 0, seen: new Set(), bow: 0, log: [] };
bus.on('rig:event', e => {
  if (!BEAT_TYPES.includes(e.type)) return;
  keeper.last = e.type; keeper.lastT = state.t; if (e.type === 'hop') keeper.hopT = state.t;
  keeper.log.push({ t: +state.t.toFixed(2), type: e.type, src: e.src || (e.auto ? 'director' : 'user') });
  if (keeper.log.length > 600) keeper.log.shift();
});
for (const k of ['ui:bell', 'ui:wave', 'ui:hop', 'ui:gulp', 'ui:speed', 'ui:coast']) bus.on(k, () => { keeper.userT = state.t; });
const keeperOff = reduced || params.has('nodirector') || params.has('nokeeper');
function keepBeats(dz) {
  const t = state.t, D = state.distance, spd = Math.max(200, state.speed);
  if (t - keeper.userT < KEEP.user) return;
  let tNext = 1e9, nextType = null;   // the next scheduled director beat
  for (const x of dz.enc || []) { const e = x.e; if (!e || !e.ev) continue; const w = (e.De - D) / spd; if (w > 0 && w < tNext) { tNext = w; nextType = e.ev; } }
  const since = t - keeper.lastT;
  const free = since >= KEEP.minGap && tNext >= KEEP.lead;
  const fire = (type, why) => {
    const e = { type, t0: t, auto: true, src: 'keeper:' + why };
    state.events.push(e); bus.emit('rig:event', e); keeper.n++;
    if (type === 'hop') { lastHop = t; setTimeout(() => bus.emit('rig:land', {}), TIMING.hop.land * 1000); }
  };
  const pick = (want, why) => {
    const avoid = new Set([keeper.last, tNext < KEEP.maxGap ? nextType : null]);
    if (want && !avoid.has(want)) return fire(want, why);
    for (let i = 0; i < KEEP.fill.length; i++) { const c = KEEP.fill[(keeper.n + i) % KEEP.fill.length]; if (avoid.has(c) || (c === 'hop' && (t - keeper.hopT < KEEP.hopEvery || state.coasting))) continue; return fire(c, why); }
  };
  // reactions to the sky set pieces (no rig event of their own)
  for (const x of dz.enc || []) {
    const e = x.e; if (!e || e.ev || !KEEP.react[e.kind]) continue;
    const key = e.kind + ':' + Math.round(e.D);
    if (x.u >= 0 && x.u < 1.5 && !keeper.seen.has(key)) { keeper.seen.add(key); if (free) return pick(KEEP.react[e.kind], e.kind); }
  }
  const bow = dz.weather ? dz.weather.bow : 0;
  if (bow > 0.5 && keeper.bow <= 0.5 && free) { keeper.bow = bow; return pick('wave', 'rainbow'); }
  keeper.bow = bow;
  if (!free) return;
  if (nextType && nextType === keeper.last && since >= tNext - 0.3) return pick(null, 'interleave');   // halfway between two of a kind
  if (since >= KEEP.maxGap || (since >= KEEP.early && since + Math.min(tNext, 99) > KEEP.maxGap)) return pick(null, 'gap');
}

// ---------- signature moment (lead): SIGNAL LOST at the neon tunnel ----------
// Once per lap, on entering the neon tunnel (the cliffs stretch; the HUD drops to NO SIGNAL there), the city
// glitches for ~1.6 s: the sheets tear sideways in bands, the far city (sky, skyline, sea, boats) flashes into its
// neon wireframe twice, and only the courier stays solid. A short, automatic cousin of the HACK egg (type HACK for the
// full 3.6 s version). Pure of road distance, so renderAt / shots see it too (?noglitch turns it off; reduced motion
// skips it). Only CSS classes + CSS translate on whole sheets: no per-element writes.
const GLITCH = { at: STRETCH.cliffs ? STRETCH.cliffs.a : 0, len: 1.6 * DIST_PER_REV };
const glitchOff = reduced || params.has('noglitch');
const glitchU = D => { const u = (lapPos(D) - GLITCH.at) / GLITCH.len; return u >= 0 && u < 1 ? u : -1; };
const ghash = (i, k) => { let x = Math.imul(i * 374761393 + k * 668265263, 1274126177); x ^= x >>> 13; x = Math.imul(x, 1103515245); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
let glitch = { on: false, wire: false, jit: null, mine: false };
function applyGlitch(u) {
  const on = u >= 0 && !glitchOff;
  if (on && !glitch.on && svg.classList.contains('egg-hack')) return;    // the HACK egg is running: let it have the stage
  const wire = on && ((u > 0.1 && u < 0.32) || (u > 0.4 && u < 0.86));
  const tear = on && !wire;
  if (on !== glitch.on) { svg.classList.toggle('pb-glitch', on); glitch.on = on; bus.emit('lead:glitch', { on }); }
  if (wire !== glitch.wire) { svg.classList.toggle('pb-glitch-wire', wire); glitch.wire = wire; }
  // band tear: whole non-rider sheets jump sideways (compositor translate), re-rolled every 2 frames
  const parts = sheets.isSplit ? sheets.parts.filter(p => !/^(defs|j-|L-rider$|L-letterbox$)/.test(p.getAttribute('data-sheet') || '')) : [];
  const fr = Math.floor(u * 48);
  if (tear || (glitch.jit && glitch.jit.size)) {
    glitch.jit ||= new Map();
    parts.forEach((p, i) => {
      const r = ghash(fr >> 1, i), v = tear && r < 0.6 ? `${Math.round((ghash(fr, i + 99) - 0.5) * 2 * (10 + 80 * r))}px 0` : '';
      if ((glitch.jit.get(p) || '') !== v) { glitch.jit.set(p, v); p.style.translate = v; }
    });
    if (!tear) glitch.jit.clear();
  }
}
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
for (const ev of ['ui:tod', 'ui:camera', 'ui:toggle', 'ui:speed']) bus.on(ev, () => { if (!state.playing && !freeze && !exportJob) requestAnimationFrame(() => render(0)); });
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
  if (dt > 0 && state.playing && !keeperOff) keepBeats(dz);
  // coast / pedal markers for the rig (user, director or eggs may flip state.coasting); live play only, so renderAt stays pure
  if (dt > 0 && state.coasting !== lastCoast) state.events.push({ type: state.coasting ? 'coast' : 'pedal', t0: state.t });
  lastCoast = state.coasting;
  const pose = solvePose(state.t, { crank: state.crank, distance: state.distance, cadence: state.cadence, speed: state.speed, coasting: state.coasting, events: state.events, tod: state.tod, loopT: state.loopT, mech: state.mechT0 });
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
    ui.update(frame); audio.update(frame); sheets.flush(); sheets.update(cam, dt > 0); fr.ui = performance.now() - t1;
    for (const k in fr) modPerf[k] = (modPerf[k] || 0) + fr[k];
    modPerf.n = (modPerf.n || 0) + 1; (modPerf.frames ||= []).push(fr); if (modPerf.frames.length > 600) modPerf.frames.shift();
    return frame;
  }
  else { for (const a of attached) if (a.update) try { a.update(frame); } catch (e) { console.error(e); a.update = null; }
  ui.update(frame); audio.update(frame); }
  sheets.flush(); sheets.update(cam, dt > 0);
  applyGlitch(glitchU(state.distance));
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
// ---------- adaptive quality (lead) ----------
// The live tier steps down when the frame time p95 (rAF deltas, 1 s windows) stays above 18 ms for 2 windows, and back
// up after 10 clean windows (p95 ≤ 17.4 ms); a tier that failed again within 30 s of stepping up is held for 60 s. The
// tier is frame.quality for the modules and #scene[data-quality] for page.css, which sheds the composited layers that
// cost the software compositor the most for the least picture (docs: README · perf): medium = the downpour's second
// rain sheet, the haze pools and the far traffic lane; low = also the light-rain sheet (the far rain stays), the near
// traffic lane, the second smog band and the cape reflection. ?q=high|medium|low pins a tier.
const Q = { dts: [], n: 0, bad: 0, good: 0, changedAt: 0, upAt: -1e9, holdUntil: 0, log: [] };
function setQuality(q, why) {
  if (q === quality) return;
  quality = q; svg.setAttribute('data-quality', q);
  Q.log.push({ t: +(performance.now() / 1000).toFixed(1), q, why }); if (Q.log.length > 50) Q.log.shift();
  bus.emit('lead:quality', { quality: q });
}
if (qLocked) svg.setAttribute('data-quality', quality);
function adaptQuality(now, rawMs) {
  if (qLocked || reduced) return;
  Q.dts.push(rawMs); if (Q.dts.length > 60) Q.dts.shift();
  if (++Q.n % 60 || Q.dts.length < 60 || now - Q.changedAt < 2000 || performance.now() < 3000) return;
  const a = [...Q.dts].sort((x, y) => x - y), p95 = a[Math.floor(a.length * 0.95)];
  Q.bad = p95 > 18 ? Q.bad + 1 : 0; Q.good = p95 <= 17.4 ? Q.good + 1 : 0;
  const i = QUALITY.indexOf(quality);
  if (Q.bad >= 2 && i < QUALITY.length - 1) {
    if (now - Q.upAt < 30000) Q.holdUntil = now + 60000;
    setQuality(QUALITY[i + 1], `p95 ${p95.toFixed(1)} ms`); Q.changedAt = now; Q.bad = Q.good = 0;
  } else if (Q.good >= 10 && i > 0 && now > Q.holdUntil) {
    setQuality(QUALITY[i - 1], `p95 ${p95.toFixed(1)} ms`); Q.changedAt = Q.upAt = now; Q.bad = Q.good = 0;
  }
}
function loop(now) {
  const rawMs = now - last;
  const dt = Math.min(0.05, rawMs / 1000); last = now;
  if (state.playing && !exportJob) adaptQuality(now, rawMs);
  if (state.playing && !exportJob) { const t0 = performance.now(); step(dt); render(dt); if (perfOn) { fpsAcc.push({ dt, js: performance.now() - t0 }); if (fpsAcc.length > 3600) fpsAcc.splice(0, 1800); hud(); } }
  requestAnimationFrame(loop);
}
render(0);
performance.mark('pb:first-frame');   // first full scene render (sheets split right after)
if (!params.has('nofold')) foldOpacity(svg);   // perf: static leaf opacity -> fill / stroke-opacity (core/sheets.js)
// split after the first render: every wrapper already carries the attributes the runtime writes (rider, layers)
if (!params.has('nosheets')) { sheets.split(); sheets.update(curCam); }
requestAnimationFrame(loop);
document.addEventListener('visibilitychange', () => { last = performance.now(); Q.dts.length = 0; });

// ---------- export ----------
// 'frame': the current frame, synchronous (fast). 'svg': the zero-JS animated SVG, baked on the main thread in slices
// (bakeSVGAsync yields every ~30 ms), so the page stays responsive: the button shows aria-busy + a percentage, a live
// region reads the progress every 10 %, and pressing the button again (or Esc) cancels. The live scene pauses while
// the baker scrubs the loop and resumes where it was.
let exportJob = null;
function saveBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const exportUI = {
  btn: () => document.querySelector('#ui [data-act="dlSvg"]'),
  say(msg) { const r = document.querySelector('#ui [data-announcer]'); if (r) r.textContent = msg; },
  busy(pct) {
    const b = exportUI.btn(); if (!b) return;
    if (pct === null) { b.removeAttribute('aria-busy'); b.removeAttribute('data-pb-progress'); b.style.removeProperty('--pb-progress'); b.removeAttribute('aria-valuenow'); return; }
    b.setAttribute('aria-busy', 'true'); b.setAttribute('data-pb-progress', pct + '%'); b.style.setProperty('--pb-progress', String(pct / 100));
  },
};
const zh = () => (document.documentElement.lang || '').startsWith('zh');
async function download(kind) {
  if (kind !== 'svg') { saveBlob(new Blob([sheets.whole(s => new XMLSerializer().serializeToString(s))], { type: 'image/svg+xml' }), 'pelican-bay-frame.svg'); return; }
  if (exportJob) { exportJob.abort = true; return; }          // a second press cancels the running export
  const job = exportJob = { abort: false, pct: 0, said: -10 };
  const onKey = e => { if (e.key === 'Escape') job.abort = true; };
  addEventListener('keydown', onKey);
  queueMicrotask(() => exportUI.busy(0));                       // the UI clears aria-busy right after its emit
  const wasSplit = sheets.isSplit;
  sheets.unsplit();
  let out = null;
  try {
    out = await bakeSVGAsync(svgRoot, { cadence: 60, tod: state.tod, pose: solvePose, state }, p => {
      const pct = Math.min(99, Math.floor((p && p.frac || 0) * 100));
      if (pct > job.pct) { job.pct = pct; exportUI.busy(pct); }
      if (pct - job.said >= 10) { job.said = pct; exportUI.say((zh() ? '正在导出动画 SVG：' : 'Exporting animated SVG: ') + pct + '%' + (zh() ? '（再按一次或 Esc 取消）' : ' (press again or Esc to cancel)')); }
    }, () => job.abort);
  } catch (e) {
    if (!job.abort) { console.error('export failed', e); exportUI.say(zh() ? '导出失败' : 'Export failed'); }
  } finally {
    if (wasSplit) { sheets.split(); sheets.update(curCam || camera.update(0, state.t, reduced, state.events)); }
    removeEventListener('keydown', onKey);
    exportUI.busy(null); exportJob = null;
  }
  if (out) { saveBlob(new Blob([out], { type: 'image/svg+xml' }), 'pelican-bicycle.svg'); exportUI.say(zh() ? '已下载 pelican-bicycle.svg' : 'Downloaded pelican-bicycle.svg'); }
  else if (job.abort) exportUI.say(zh() ? '已取消导出' : 'Export cancelled');
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
  // fast-forward live play by `sec` seconds of sim time in fixed steps (tests: the beat keeper, the director); the live
  // path (dt > 0) runs, so auto events fire exactly as when watching
  sim(sec, fps = 30) { const dt = 1 / fps; state.playing = true; for (let i = 0, n = Math.round(sec * fps); i < n; i++) { step(dt); render(dt); } state.playing = false; return keeper.log.slice(); },
  keeper: () => ({ log: keeper.log.slice(), n: keeper.n }),
  quality: () => ({ quality, locked: qLocked, log: Q.log.slice() }),
  glitchAt: D => glitchU(D), glitchStartT: GLITCH.at / DIST_PER_REV, TIMING,
  exporting: () => (exportJob ? { pct: exportJob.pct } : null),
  perf: () => fpsAcc, modPerf: () => modPerf,
  bakeSVG: opts => sheets.whole(s => bakeSVG(s, { cadence: 60, tod: state.tod, pose: solvePose, state, ...opts })),
  sheets,
};
