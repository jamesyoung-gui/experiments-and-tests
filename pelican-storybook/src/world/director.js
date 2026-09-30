// OWNER: director. "Interesting variation over time": a pure, seeded SCHEDULE of weather, encounters and pacing keyed
// by road distance (so it lines up with the journey's stretches in route.js), plus the runtime that plays it and the
// art of the encounters (the weather art lives in weather.js).
//
// Determinism: everything is a pure function of the road distance D (and the lap index derived from it). Live play
// detects distance crossings and emits rig events; window.__pb.renderAt(t) reconstructs the same auto events from D,
// so a screenshot at a given t is stable. Tests: window.__pb.director = { timeline, at(t), weatherAt(D), paceAt(D) }.
//
// frame.weather (new frame field, written by main from director.pre()):
//   { wind 0..1, gust 0..1 (wind × a slow gust wave), cloud 0..1 (overcast), rain 0..1, fog 0..1, bow 0..1 (rainbow),
//     wet 0..1 (road puddles; lags the rain), squint 0..1 (rider squints), pace 'cruise'|'sprint'|'stroll'|'coast',
//     lap, km (lap km), stretch (route key) }
// frame.director = { enc: [{ kind, u, e }] } — encounters within reach, u = seconds (at 60 rpm) since their mark.
//
// Rules: auto events never fight the user — any ui input (bell/wave/hop/gulp/speed/coast) makes the director back
// off for 10 s; the user's cadence is the base the pacing multiplies; the user's coast wins. ?nodirector disables it.
import { RIDER_X, GROUND_Y, DIST_PER_REV, TILE } from '../contract.js';
import { LAP, KM, STRETCHES, stretchAt, lapPos, lapOf, hash } from './route.js';
import { TIMING } from '../rig/solve.js';
import { GLYPHS } from './director-glyphs.js';

export const id = 'director';
export const materials = {};
const U = DIST_PER_REV;                  // u per second at 60 rpm
const BACKOFF = 10;                      // s of quiet after user input

// ------------------------------------------------------------------------------------------------ helpers (shared)
export const f = x => { const r = Math.round(x * 10) / 10; return (r === 0 ? 0 : r).toString(); };
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const wrap = (x, m) => ((x % m) + m) % m;
export const TAU = Math.PI * 2;
export const circ = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
export const ell = (x, y, rx, ry) => `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
export const poly = (pts, close = true) => 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + (close ? 'Z' : '');
export const rect = (x, y, w, h) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`;
export function dots(x0, x1, y0, y1, s, clip) {
  let d = '';
  for (let j = 0, y = y0; y <= y1; j++, y = y0 + j * s * 0.866)
    for (let x = x0 + (j % 2 ? s / 2 : 0); x <= x1; x += s) if (!clip || clip(x, y)) d += `M${f(x)} ${f(y)}h0`;
  return d;
}
// glyph run -> one merged path (em 1000, y down), anchored on the baseline at (ox, oy)
export function text(str, size, ox = 0, oy = 0, { align = 'middle', track = 40 } = {}) {
  const s = size / 1000; let pen = 0; const parts = [];
  for (const ch of str) {
    if (ch === ' ') { pen += 300 + track; continue; }
    const g = GLYPHS[ch]; if (!g) continue;
    parts.push([pen, g[1]]); pen += g[0] + track;
  }
  const w = (pen - track) * s, x0 = ox - (align === 'middle' ? w / 2 : align === 'end' ? w : 0);
  let d = '';
  for (const [p, gd] of parts) {
    let i = 0;
    d += gd.replace(/-?\d+(\.\d+)?/g, m => { const v = +m; const o = i % 2 === 0 ? x0 + (v + p) * s : oy + v * s; i++; return ' ' + f(o); });
  }
  return { d, w };
}
const tri = (x, a, b, r) => sstep(a - r, a, x) * (1 - sstep(b, b + r, x));     // smooth window
const hsh = (lap, salt) => hash(lap * 7919 + 13, salt);

// ------------------------------------------------------------------------------------------------ the schedule
// Lap 0 is authored; later laps are re-dealt from a seed so the ride doesn't repeat for a long time: the landmarks
// come back (route.js), but the shower moves, the rainbow may or may not show, the breezes and the encounters shuffle.
const SHOWER_AT = [5.5, 15.9, 19.9, 22.2];
const BREEZE_AT = [[2.7, 5.0], [13.3, 15.4], [16.8, 18.0], [22.9, 24.6], [0.4, 1.4]];
const lapCache = new Map();
export function lapScript(lap) {
  if (lapCache.has(lap)) return lapCache.get(lap);
  const r = s => hsh(lap, s);
  const wx = [];   // weather windows {ch, a, b, amp, ra, rb} in lap km
  const enc = [];  // encounters {kind, km, ev, evKm, v}
  const pace = []; // pacing windows {mode, a, b, mul}
  let shower, breezes, bow, fogAmp = 1;
  if (lap === 0) { shower = 5.5; breezes = [BREEZE_AT[0], BREEZE_AT[1]]; bow = true; }
  else {
    shower = SHOWER_AT[Math.floor(r(1) * SHOWER_AT.length)] + (r(2) - 0.5) * 0.4;
    breezes = BREEZE_AT.filter((b, i) => r(10 + i) > 0.45);
    bow = r(3) > 0.3; fogAmp = 0.7 + 0.3 * r(4);
    if (lap % 3 === 2) wx.push({ ch: 'fog', a: 0, b: 0.9, amp: 0.55, ra: 0.01, rb: 0.6 });   // a misty start
  }
  const sb = shower + 1.4;
  for (const [a, b] of breezes) wx.push({ ch: 'wind', a, b, amp: 0.8 + 0.2 * r(a * 10), ra: 0.4, rb: 0.5 }, { ch: 'cloud', a, b, amp: 0.3, ra: 0.5, rb: 0.5 });
  wx.push({ ch: 'wind', a: shower - 0.5, b: shower + 0.2, amp: 0.7, ra: 0.3, rb: 0.5 });   // the squall front
  wx.push({ ch: 'cloud', a: shower - 0.2, b: sb, amp: 1, ra: 0.5, rb: 0.5 });
  wx.push({ ch: 'rain', a: shower, b: sb, amp: 1, ra: 0.18, rb: 0.3 });
  wx.push({ ch: 'wet', a: shower + 0.15, b: sb + 1.2, amp: 1, ra: 0.25, rb: 0.9 });
  if (bow) wx.push({ ch: 'bow', a: sb + 0.35, b: sb + 2.1, amp: 1, ra: 0.3, rb: 0.5 });
  wx.push({ ch: 'fog', a: 10.9, b: 12.9, amp: fogAmp, ra: 0.5, rb: 0.6 });                     // sea fog on the headland
  // ---- encounters (lap 0 authored; later laps jittered + shuffled variants)
  const J = (km, s) => lap === 0 ? km : km + (r(s) - 0.5) * 0.5;
  const V = (s, n) => lap === 0 ? 0 : Math.floor(r(s) * n);
  const add = (kind, km, ev, lead, v = 0) => enc.push({ kind, km, ev, evKm: ev ? km - lead / KM * U : km, v });
  // lead = seconds (at 60 rpm) between the rig event and the encounter mark, so the gag peaks at the right moment
  add('cyclist', J(1.25, 20), 'wave', 0.55, V(21, 2));
  add('cat', J(2.15, 22), 'bell', 0.42, V(23, 2));
  add('gulls', J(3.1, 24), 'gulp', 0, V(25, 2));
  add('fish', J(4.55, 26), 'gulp', 0, 0);
  add('drink', shower + 0.45, 'gulp', 0);
  add('puddle', shower + 1.05, 'hop', TIMING.hop.apex - 0.02, 0);
  add('kites', 8.9, null, 0);
  add('keeper', J(11.75, 27), 'wave', 0.6, 0);
  add('pothole', J(14.8, 28), 'hop', TIMING.hop.apex - 0.02, 0);
  add('friend', J(16.2, 29), 'wave', 1.8, 0);
  add('fish', J(20.3, 30), 'gulp', 0, 1);
  add('cat', J(22.6, 31), 'bell', 0.42, 1 - V(23, 2));
  add('cyclist', J(24.6, 32), 'wave', 0.55, 1 - V(21, 2));
  add('fireworks', 5.5, null, 0);
  if (lap > 0 && r(40) > 0.5) add('gulls', J(19.2, 41), 'gulp', 0, 1);
  // don't let a drink / puddle land on top of another gag: nudge encounters that collide within 0.35 km
  enc.sort((a, b) => a.evKm - b.evKm);
  for (let i = 1; i < enc.length; i++) if (enc[i].ev && enc[i - 1].ev && enc[i].evKm - enc[i - 1].evKm < 0.35) { enc[i].km += 0.4; enc[i].evKm += 0.4; }
  // ---- pacing: race land.js's coast-railway train (route egg 'race' at 7.6 km) on the flat, coast the descents ("wheee"), take it easy in the fog
  pace.push({ mode: 'sprint', a: 7.7, b: 8.85, mul: 1.45, sign: 'race' });
  pace.push({ mode: 'stroll', a: 11.0, b: 12.7, mul: 0.8 });
  pace.push({ mode: 'coast', a: 13.05, b: 13.7, mul: 1, sign: 'down' });
  pace.push({ mode: 'sprint', a: 15.8, b: 16.7, mul: 1.3, sign: 'flat' });
  pace.push({ mode: 'coast', a: 18.05, b: 18.6, mul: 1, sign: 'down' });
  if (lap > 0 && r(50) > 0.4) pace.push({ mode: 'coast', a: 24.2, b: 24.7, mul: 1, sign: 'down' });
  const out = { lap, wx, enc, pace, shower, bow };
  lapCache.set(lap, out);
  return out;
}

// weather at road distance D (pure)
export function weatherAt(D, t = 0) {
  const lap = lapOf(D), km = lapPos(D) / KM;
  const w = { wind: 0.08, cloud: 0, rain: 0, fog: 0, bow: 0, wet: 0 };
  for (const L of [lap - 1, lap, lap + 1]) {
    if (L < 0) continue;
    const s = lapScript(L), k = km + (lap - L) * 26;
    for (const x of s.wx) w[x.ch] = Math.max(w[x.ch], x.amp * sstep(x.a - x.ra, x.a, k) * (1 - sstep(x.b, x.b + x.rb, k)));
  }
  const gust = clamp(w.wind * (0.72 + 0.28 * Math.sin(t * 1.3) * Math.sin(t * 0.37 + 1)), 0, 1);
  const pc = paceAt(D);
  return { ...w, gust, squint: Math.max(w.rain, w.wind > 0.6 ? 0.35 * (w.wind - 0.6) / 0.4 : 0), pace: pc.mode, lap, km, stretch: stretchAt(D).key };
}
// pacing at D: { mode, mul, k (0..1 into the window), sign }
export function paceAt(D) {
  const s = lapScript(lapOf(D)), km = lapPos(D) / KM;
  for (const p of s.pace) if (km >= p.a && km < p.b) {
    const k = tri(km, p.a, p.b, 0.15);
    return { mode: p.mode, mul: lerp(1, p.mul, k), k, sign: p.sign, a: p.a, b: p.b };
  }
  return { mode: 'cruise', mul: 1, k: 0 };
}
// absolute trigger distance of encounters of lap L
const absCache = new Map();
const absEnc = L => { let a = absCache.get(L); if (!a) { a = lapScript(L).enc.map(e => ({ ...e, lap: L, D: L * LAP + e.km * KM, De: L * LAP + e.evKm * KM })); absCache.set(L, a); if (absCache.size > 8) absCache.delete(absCache.keys().next().value); } return a; };
function encNear(D, back, ahead) {
  const lap = lapOf(D), out = [];
  for (const L of [lap - 1, lap, lap + 1]) if (L >= 0) for (const e of absEnc(L)) if (e.D > D - back && e.D < D + ahead) out.push(e);
  return out;
}
// timeline for tests: every encounter and pacing change of the first `laps` laps, with t at 60 rpm
export function timeline(laps = 2) {
  const out = [];
  for (let L = 0; L < laps; L++) {
    const s = lapScript(L);
    for (const e of absEnc(L)) out.push({ t: +(e.De / U).toFixed(2), km: +e.km.toFixed(2), lap: L, kind: e.kind, event: e.ev || null, variant: e.v });
    for (const p of s.pace) out.push({ t: +((L * LAP + p.a * KM) / U).toFixed(2), km: p.a, lap: L, kind: 'pace:' + p.mode, event: null });
    for (const w of s.wx) out.push({ t: +((L * LAP + w.a * KM) / U).toFixed(2), km: +w.a.toFixed(2), lap: L, kind: 'weather:' + w.ch, event: null });
  }
  return out.sort((a, b) => a.t - b.t);
}
export function at(t) { const D = t * U; return { t, D, weather: weatherAt(D, t), pace: paceAt(D), encounters: encNear(D, 2 * KM, 2 * KM).map(e => ({ kind: e.kind, km: e.km, lap: e.lap, event: e.ev, variant: e.v })) }; }

// ------------------------------------------------------------------------------------------------ runtime
// main.js calls connect() once and dir.pre(dt) at the top of every render, BEFORE solvePose (auto events and the
// pacing posture must be in the pose). Returns { weather, enc } for the frame.
export function connect({ bus, state, off = false }) {
  let lastUser = -1e9, userCoast = false, base = state.cadenceTarget, autoCoast = false, lastD = state.distance, lastT = state.t;
  const user = () => { lastUser = state.t; };
  for (const k of ['ui:bell', 'ui:wave', 'ui:hop', 'ui:gulp']) bus.on(k, user);
  bus.on('ui:speed', ({ cadence }) => { user(); base = cadence; });
  bus.on('ui:coast', ({ on }) => { user(); userCoast = !!on; autoCoast = false; });
  if (!off) state.dayLength = LAP / U;           // with ui:tod auto, one lap of the coast road = one day
  const out = { weather: weatherAt(0), enc: [] };
  const push = (type, t0, live) => {
    const e = { type, t0, auto: true };
    state.events.push(e);
    if (live) { bus.emit('rig:event', e); if (type === 'hop') setTimeout(() => bus.emit('rig:land', {}), 750); }
  };
  function pre(dt) {
    const D = state.distance, t = state.t;
    out.weather = weatherAt(D, t);
    if (off) { out.enc = []; return out; }
    const pc = paceAt(D);
    const spd = Math.max(200, state.speed);
    const jump = dt === 0 || t < lastT || Math.abs(D - lastD) > spd * 0.3 + 400;
    if (jump) {
      // deterministic reconstruction (renderAt): the auto events of the last 8 s of road, timed by distance
      state.events = state.events.filter(e => !e.auto);
      for (const e of encNear(D, 8 * spd + 3 * KM, 2 * KM)) if (e.ev && e.De <= D && D - e.De < 8 * spd) push(e.ev, t - (D - e.De) / spd, false);
      // posture of the pacing (renderAt keeps D = t·U; only the effort changes)
      if (pc.mode === 'coast') { state.coasting = true; autoCoast = true; }
      else if (autoCoast) { state.coasting = false; autoCoast = false; }
      if (pc.mul !== 1) { state.cadence *= pc.mul; state.speed *= pc.mul; }
    } else {
      const quiet = t - lastUser >= BACKOFF;
      if (quiet) for (const e of encNear(D, 3 * KM, KM)) if (e.ev && e.De > lastD && e.De <= D) {
        const busy = state.events.some(x => x.type === e.ev && t - x.t0 < 2.8);
        if (!busy) push(e.ev, t, true);
      }
      if (quiet && !userCoast) {
        state.cadenceTarget = clamp(base * pc.mul, 20, 110);
        if (pc.mode === 'coast' && !state.coasting) { state.coasting = true; autoCoast = true; }
        else if (pc.mode !== 'coast' && autoCoast) { state.coasting = false; autoCoast = false; }
      }
    }
    lastD = D; lastT = t;
    out.enc = encNear(D, 6 * KM / 2, 1.2 * KM).map(e => ({ kind: e.kind, v: e.v, u: (D - e.D) / U, e }));
    out.pace = pc;
    return out;
  }
  const api = { timeline: timeline(3), at, weatherAt, paceAt, lapScript, pre };
  return { pre, api, out };
}

// ------------------------------------------------------------------------------------------------ encounter art
export const detailItems = [
  { id: 'fx:O:dir-cyclist-boater', layer: 'fx', kind: 'O', what: 'oncoming cyclist in a boater and striped jersey on a vermilion roadster, waves back' },
  { id: 'fx:O:dir-cyclist-beret', layer: 'fx', kind: 'O', what: 'second oncoming cyclist: beret, baguette in the basket, teal bike' },
  { id: 'land:O:dir-cat-ginger', layer: 'land', kind: 'O', what: 'ginger crossing cat: sits, arches at the bell, leaps away with a 喵!' },
  { id: 'land:O:dir-cat-tux', layer: 'land', kind: 'O', what: 'tuxedo crossing cat (second variant)' },
  { id: 'fx:O:dir-gulls', layer: 'fx', kind: 'O', what: 'two thieving herring gulls swoop at the basket, flee when the pelican gulps first' },
  { id: 'sea:O:dir-fish', layer: 'sea', kind: 'O', what: 'a mackerel leaps from the bay in an arc into the bill' },
  { id: 'sea:O:dir-splash', layer: 'sea', kind: 'O', what: 'splash crown + ring where the fish left the water' },
  { id: 'land:O:dir-puddle', layer: 'land', kind: 'O', what: 'big rain puddle the pelican hops over' },
  { id: 'land:O:dir-pothole', layer: 'land', kind: 'O', what: 'cliff-road pothole with cracks and a striped roadworks cone' },
  { id: 'sky:O:dir-kites', layer: 'sky', kind: 'O', what: 'kite festival: diamond, box, carp streamer, delta, bird and a dragon kite with banner' },
  { id: 'land:O:dir-keeper', layer: 'land', kind: 'O', what: 'lighthouse keeper in oilskins and sou’wester, lantern in hand, waving' },
  { id: 'sky:O:dir-friend', layer: 'sky', kind: 'O', what: 'a pelican friend in a red scarf flies alongside (neck folded, as pelicans fly) and calls 嘎!' },
  { id: 'sky:O:dir-fireworks', layer: 'sky', kind: 'O', what: 'night fireworks over the pleasure pier: chrysanthemum, ring, willow and palm bursts' },
  { id: 'land:O:dir-signs', layer: 'land', kind: 'O', what: 'pacing signs: 下坡 DOWNHILL descent sign, 冲刺 SPRINT flat sign' },
  { id: 'fx:O:dir-pops', layer: 'fx', kind: 'O', what: 'letterpress pop words: WHEEE!, RACE!, 喵!, 嘎!' },
  { id: 'fx:O:dir-drops', layer: 'fx', kind: 'O', what: 'raindrops falling into the open pouch (the drinking gag)' },
];
let I, V;
const F = (d, fill, a = {}) => `<path d="${d}" fill="${fill}"${Object.entries(a).map(([k, v]) => ` ${k}="${v}"`).join('')}/>`;
const S = (d, stroke, w, a = {}) => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${Object.entries(a).map(([k, v]) => ` ${k}="${v}"`).join('')}/>`;
const G = (a, ...kids) => `<g${Object.entries(a).map(([k, v]) => ` ${k}="${v}"`).join('')}>${kids.join('')}</g>`;
const DD = k => ({ 'data-detail': k });
const REF = (r, a = {}) => ({ 'data-ref': 'dir-' + r, ...a });
const HID = { visibility: 'hidden' };

function wheel(ref, r, tyre, rim) {
  let sp = '';
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; sp += `M0 0L${f(Math.cos(a) * (r - 4))} ${f(Math.sin(a) * (r - 4))}`; }
  return G({}, S(circ(0, 0, r), tyre, 6), G(REF(ref), S(sp, rim, 0.9), S(`M0 0L${f(r - 5)} 0`, rim, 2.2)), S(circ(0, 0, r - 4.5), rim, 1.4), F(circ(0, 0, 3.5), rim));
}
// oncoming cyclist (faces −x). Ground y 0. v0 boater/stripes/vermilion bike; v1 beret/teal bike/baguette.
function cyclist(v) {
  const frameInk = v ? I('T') : I('R'), shirt = v ? I('B') : I('P'), pants = v ? I('N') : I('B');
  const W = 44, xr = 62, xf = -66, yh = -W;
  const frame = S(`M${xr} ${yh}L0 ${yh + 8}L-44 -108L${xf} ${yh}M0 ${yh + 8}L22 -104L${xr} ${yh}M22 -104L-44 -108M-44 -108l-6 -14`, frameInk, 4.4)
    + S('M22 -104l3 -12M14 -118h20', I('N'), 3.4) + S('M-50 -122l-10 -3', I('N'), 3);
  const basket = v ? F(rect(-92, -110, 26, 18), I('O'), { stroke: I('N'), 'stroke-width': 1 }) + S('M-90 -106l24 0M-90 -100l24 0M-86 -110v18M-78 -110v18M-70 -110v18', I('N'), 0.6)
    + F('M-94 -112l30 -30l5 4l-30 30Z', I('K'), { stroke: I('N'), 'stroke-width': 0.8 }) + S('M-85 -121l4 3M-79 -127l4 3M-73 -133l4 3', I('O'), 1)
    : F(rect(70, -84, 28, 6), I('N')) + F(rect(72, -98, 22, 14), I('O'), { stroke: I('N'), 'stroke-width': 0.8 });
  const torso = F('M20 -112C24 -140 18 -164 8 -176C-4 -178 -12 -170 -12 -160C-10 -144 0 -126 8 -112Z', shirt, { stroke: I('N'), 'stroke-width': 1.4 })
    + (v ? '' : S('M18 -128C12 -128 4 -126 -2 -122M16 -142C8 -142 -2 -140 -8 -136M12 -156C4 -156 -4 -154 -10 -150M8 -168C2 -170 -6 -168 -10 -164', I('R'), 3.4));
  const head = F(circ(-6, -192, 13), I('K'), { stroke: I('N'), 'stroke-width': 1.2 }) + F(circ(-14, -193, 1.6), I('N')) + S('M-19 -187q3 2 6 0', I('N'), 1)
    + (v ? F('M-20 -198C-18 -214 6 -214 8 -200C0 -204 -12 -204 -20 -198Z', I('N')) + S('M-2 -212l2 -5', I('N'), 1.6)
      : F(ell(-6, -202, 19, 3.2), I('P'), { stroke: I('N'), 'stroke-width': 1 }) + F(rect(-17, -214, 22, 12), I('P'), { stroke: I('N'), 'stroke-width': 1 }) + F(rect(-17, -208, 22, 4), I('R')))
    + (v ? '' : S('M4 -186c4 2 6 6 4 10', I('N'), 1.2));
  const armNear = S('M-2 -164L-26 -140L-52 -124', shirt, 7) + F(circ(-53, -123, 4.2), I('K'));
  const armWave = G(REF(`cyc${v}-arm`, { transform: 'translate(6 -166)' }), S('M0 0L18 -26L12 -54', shirt, 6.4), F(circ(12, -58, 5), I('K'), { stroke: I('N'), 'stroke-width': 0.8 }));
  const legs = G({}, S('M0 0', pants, 9, REF(`cyc${v}-legF`)), S('M0 0', pants, 9, REF(`cyc${v}-legN`)));
  const shoes = '';
  return G({ ...REF(`cyc${v}`), ...HID, ...DD(v ? 'fx:O:dir-cyclist-beret' : 'fx:O:dir-cyclist-boater') },
    F(ell(0, 2, 118, 6), I('N'), { opacity: 0.25 }),
    G({ transform: `translate(${xr} ${yh})` }, wheel(`cyc${v}-wr`, W, I('N'), I('P'))),
    G({ transform: `translate(${xf} ${yh})` }, wheel(`cyc${v}-wf`, W, I('N'), I('P'))),
    legs, armWave, frame, basket, torso, head, armNear, shoes,
    S(circ(0, yh + 8, 11), I('N'), 2.4), G(REF(`cyc${v}-crank`, { transform: `translate(0 ${yh + 8})` }), S('M0 -18L0 18', I('N'), 3)));
}
// crossing cat, sits facing +x (toward the rider... the camera), ground 0
function cat(v) {
  const fur = v ? I('N') : I('O'), mark = v ? I('P') : I('R');
  const sit = G(REF(`cat${v}-sit`),
    F('M-14 0C-18 -14 -16 -30 -6 -38C2 -44 14 -40 16 -28C18 -16 16 -6 14 0Z', fur, { stroke: I('N'), 'stroke-width': 1.2 }),
    F('M-2 -40C-6 -52 0 -60 8 -60C16 -60 22 -52 18 -42C14 -36 2 -34 -2 -40Z', fur, { stroke: I('N'), 'stroke-width': 1.2 }),
    F('M0 -56l-2 -12l9 7ZM14 -57l4 -11l3 12Z', fur, { stroke: I('N'), 'stroke-width': 1 }),
    v ? F('M4 -44C6 -38 12 -38 14 -44C12 -40 6 -40 4 -44ZM2 -26C0 -14 2 -6 4 0H12C12 -10 10 -22 8 -30Z', mark) : S('M-12 -20c5 1 8 -1 10 -4M-14 -12c5 1 9 -1 11 -4M4 -58l1 6M10 -58l0 6', mark, 1.6),
    F(circ(5, -49, 1.7) + circ(14, -49, 1.7), I('T')), F(circ(5.4, -49, 0.7) + circ(14.4, -49, 0.7), I('N')),
    S('M9 -45l0 2M6 -42q3 2 6 0M-2 -46l-8 -1M-2 -44l-8 2M20 -46l8 -1M20 -44l8 2', I('N'), 0.7),
    S('M-14 -4C-28 -4 -32 -14 -26 -22', fur, 4.5));
  const leap = G({ ...REF(`cat${v}-leap`), ...HID },
    F('M-30 -10C-24 -26 -2 -34 18 -28C28 -26 34 -20 34 -14C24 -12 10 -10 -4 -8C-14 -6 -24 -4 -30 -10Z', fur, { stroke: I('N'), 'stroke-width': 1.2 }),
    F('M26 -22C28 -32 36 -36 42 -32C48 -28 46 -20 40 -18Z', fur, { stroke: I('N'), 'stroke-width': 1.2 }),
    F('M30 -32l0 -9l7 6ZM40 -33l5 -8l1 10Z', fur),
    F(circ(40, -27, 2.2), I('P')), F(circ(40.4, -27, 1), I('N')),
    S('M-2 -8l-10 12M8 -10l6 13M-24 -8l-14 8M22 -16l14 10', fur, 4),
    S('M-30 -12C-44 -18 -48 -30 -44 -40', fur, 4.5),
    v ? '' : S('M-10 -26l-3 8M0 -30l-2 8M10 -30l-1 7', mark, 1.6));
  const pop = G({ ...REF(`cat${v}-pop`), ...HID, transform: 'translate(34 -84)' },
    F('M-30 0C-30 -16 30 -16 30 0C30 12 10 14 0 12L-8 22L-6 12C-20 12 -30 8 -30 0Z', I('P'), { stroke: I('N'), 'stroke-width': 1.4 }),
    F(text('喵!', 20, 0, 7).d, I('R')));
  return G({ ...REF(`cat${v}`), ...HID, ...DD(v ? 'land:O:dir-cat-tux' : 'land:O:dir-cat-ginger') }, F(ell(0, 1, 18, 3.5), I('N'), { opacity: 0.25 }), sit, G(REF(`cat${v}-air`), leap), pop);
}
function gull(i) {
  return G(REF(`gull${i}`),
    G(REF(`gull${i}-wf`), F('M-4 -2C-14 -18 -30 -28 -46 -26C-34 -20 -22 -10 -10 2Z', I('B'), { stroke: I('N'), 'stroke-width': 0.8 })),
    F('M-26 2C-18 -8 6 -10 18 -4C24 -2 26 2 22 4C10 10 -14 10 -26 2Z', I('P'), { stroke: I('N'), 'stroke-width': 1 }),
    F('M-26 2l-12 -4l2 8Z', I('P'), { stroke: I('N'), 'stroke-width': 0.8 }), F('M-38 -2l4 3l-2 3Z', I('N')),
    F(circ(18, -4, 6.5), I('P'), { stroke: I('N'), 'stroke-width': 0.9 }), F(circ(20, -5.5, 1.3), I('N')),
    F('M23 -4l11 1l-2 3l-9 0Z', I('O'), { stroke: I('N'), 'stroke-width': 0.5 }), F(circ(30, -1.5, 1), I('R')),
    G(REF(`gull${i}-wn`), F('M-2 -2C-12 -22 -24 -36 -44 -40C-30 -30 -20 -12 -12 4Z', I('P'), { stroke: I('N'), 'stroke-width': 1 }), F('M-44 -40C-38 -36 -34 -32 -32 -28L-26 -30C-30 -34 -36 -38 -44 -40Z', I('N'))));
}
function fishShape() {
  return F('M-22 0C-12 -9 8 -10 18 -3C22 0 22 2 18 4C8 10 -12 9 -22 0Z', I('B'), { stroke: I('N'), 'stroke-width': 1 })
    + F('M-18 1C-8 6 8 7 18 3C10 4 -6 4 -18 1Z', I('P')) + S('M-12 -4l4 -3M-6 -6l4 -3M0 -7l4 -3M6 -6l4 -3', I('N'), 1.2)
    + F('M-22 0l-10 -8l2 8l-2 8Z', I('B'), { stroke: I('N'), 'stroke-width': 0.8 }) + F(circ(13, -1.5, 1.8), I('P')) + F(circ(13.3, -1.5, 0.8), I('N'));
}
function kites() {
  const K = [
    // [x, y, markup, stringTo]
    [150, 170, F('M0 -34L22 0L0 40L-22 0Z', I('R'), { stroke: I('N'), 'stroke-width': 1.4 }) + F('M0 -34L22 0L0 0Z', I('P')) + F('M0 40L-22 0L0 0Z', I('P')) + S('M0 -34V40M-22 0H22', I('N'), 1) + S('M0 40q10 16 -2 30q-12 14 2 30', I('N'), 1) + F('M-6 58l6 4l-6 4ZM6 80l-6 4l6 4Z', I('O'))],
    [420, 120, F(rect(-16, -30, 32, 20) + rect(-16, 8, 32, 20), I('T'), { stroke: I('N'), 'stroke-width': 1.3 }) + S('M-16 -10V8M16 -10V8M-16 -30L16 28M16 -30L-16 28', I('N'), 1.2) + F(rect(-16, -24, 32, 6) + rect(-16, 14, 32, 6), I('P'))],
    [700, 90, F('M-40 0C-30 -16 10 -18 34 -8L44 -14L40 0L44 14L34 8C10 18 -30 16 -40 0Z', I('O'), { stroke: I('N'), 'stroke-width': 1.3 }) + S('M-14 -12q4 12 0 24M2 -14q4 14 0 28M18 -12q4 12 0 24', I('R'), 2) + F(circ(-28, -2, 5), I('P')) + F(circ(-28, -2, 2.3), I('N')) + F('M-40 0C-44 -6 -44 6 -40 0Z', I('R'))],
    [980, 150, F('M0 -26L36 20L0 12L-36 20Z', I('B'), { stroke: I('N'), 'stroke-width': 1.3 }) + F('M0 -26L0 12L-36 20Z', I('O')) + S('M0 12q-4 20 6 36', I('R'), 2.4)],
    [1260, 110, F('M-44 -2C-26 -18 -10 -6 0 -2C10 -6 26 -18 44 -2C28 -6 12 2 6 6L0 18L-6 6C-12 2 -28 -6 -44 -2Z', I('P'), { stroke: I('N'), 'stroke-width': 1.3 }) + F('M-44 -2C-38 -6 -32 -8 -26 -8L-30 -4Z M44 -2C38 -6 32 -8 26 -8L30 -4Z', I('N')) + F('M-3 -6l3 -8l3 8Z', I('K'))],
  ];
  // dragon kite: head + 9 segments (the segments sway in update)
  let segs = '';
  for (let i = 0; i < 9; i++) segs += G(REF('kseg' + i), F(circ(0, 0, 11 - i * 0.6), i % 2 ? I('O') : I('R'), { stroke: I('N'), 'stroke-width': 1 }), S(`M0 ${-12 + i * 0.6}v-8M0 ${12 - i * 0.6}v8`, I('N'), 1.2));
  const dragon = G({ transform: 'translate(560 250)' }, G(REF('kdragon'), segs,
    G({}, F('M-18 -14C-6 -22 12 -16 16 -4C18 6 10 16 -4 16C-16 16 -22 4 -18 -14Z', I('R'), { stroke: I('N'), 'stroke-width': 1.3 }), F(circ(4, -4, 4), I('P')) + F(circ(5, -4, 1.8), I('N')), S('M-12 -16l-8 -12M-4 -18l-2 -14', I('O'), 2), S('M14 6q10 4 18 -2', I('O'), 1.6))),
    G({ transform: 'translate(0 60)' }, S('M0 -44V0', I('N'), 0.8), F('M0 0h130l-10 12l10 12h-130Z', I('P'), { stroke: I('N'), 'stroke-width': 1.2 }), F(text('风筝节 KITES', 15, 62, 18.5).d, I('R'))));
  let body = '', strings = '';
  K.forEach(([x, y, mk], i) => { body += G({ ...REF('kite' + i), transform: `translate(${x} ${y})` }, mk); strings += `M${x} ${y + 20}Q${x + 60} ${y + 260} ${x + 150} 560`; });
  strings += 'M560 262Q620 420 700 560';
  return G({ ...REF('kites'), ...HID, ...DD('sky:O:dir-kites') }, S(strings, I('N'), 0.7, { opacity: 0.7 }), body, dragon);
}
function keeper() {
  return G({ ...REF('keeper'), ...HID, ...DD('land:O:dir-keeper') },
    F(ell(0, 2, 30, 5), I('N'), { opacity: 0.25 }),
    S('M-8 -2L-8 -50M8 -2L8 -50', I('N'), 9), F('M-16 -2h14v-6h-12ZM4 -2h16v-6h-14Z', I('N')),
    F('M-20 -50C-22 -80 -18 -106 0 -112C18 -106 22 -80 20 -50Z', I('O'), { stroke: I('N'), 'stroke-width': 1.5 }), S('M0 -110V-52M-6 -96h4M-6 -82h4M-6 -68h4', I('N'), 1.2),
    F(circ(0, -126, 13), I('K'), { stroke: I('N'), 'stroke-width': 1.2 }), F('M-12 -122C-14 -108 -2 -104 0 -106C4 -104 14 -108 12 -122C6 -116 -6 -116 -12 -122Z', I('P'), { stroke: I('N'), 'stroke-width': 0.8 }),
    F(circ(-5, -129, 1.4) + circ(5, -129, 1.4), I('N')), F('M-22 -132C-20 -148 20 -148 22 -132C28 -128 28 -124 22 -126C10 -130 -10 -130 -22 -126C-28 -124 -28 -128 -22 -132Z', I('O'), { stroke: I('N'), 'stroke-width': 1.2 }),
    S('M-16 -98L-28 -70L-30 -52', I('O'), 7), G({ transform: 'translate(-30 -40)' },
      F('M-6 -12h12v16h-12Z', I('N')), F(rect(-4.5, -9, 9, 11), I('K')), F('M-7 -12Q0 -20 7 -12Z', I('N')), S('M0 -20v-6', I('N'), 1.2),
      F(circ(0, -3, 18), I('K'), { 'data-ref': 'dir-kLamp', opacity: 0.35 }), F(circ(0, -3, 11), I('O'), { opacity: 0.35 })),
    G(REF('kArm', { transform: 'translate(15 -98)' }), S('M0 0L16 -24L14 -48', I('O'), 7), F(circ(14, -52, 5), I('K'), { stroke: I('N'), 'stroke-width': 0.8 })),
    G({ ...REF('kPop'), transform: 'translate(40 -170)' }, F('M-38 0C-38 -18 38 -18 38 0C38 12 16 14 6 13L-6 24L-4 13C-26 13 -38 9 -38 0Z', I('P'), { stroke: I('N'), 'stroke-width': 1.4 }), F(text('AHOY!', 15, 0, 5).d, I('B'))));
}
function friend() {
  return G({ ...REF('friend'), ...HID, ...DD('sky:O:dir-friend') },
    G(REF('frWf'), F('M-10 -6C-20 -40 -40 -66 -70 -76C-52 -54 -40 -28 -30 0Z', I('B'), { stroke: I('N'), 'stroke-width': 1 }), F('M-70 -76C-60 -66 -54 -58 -50 -48L-44 -54C-50 -64 -58 -72 -70 -76Z', I('N'))),
    F('M-46 4C-40 -10 -10 -16 18 -12C30 -10 36 -2 32 6C20 16 -24 18 -46 4Z', I('P'), { stroke: I('B'), 'stroke-width': 1.6 }),
    F('M-46 4l-14 -4l2 8Z', I('P'), { stroke: I('B'), 'stroke-width': 1 }), S('M-40 12l-14 6M-34 14l-12 8', I('O'), 3),
    F('M18 -12C26 -22 38 -22 42 -14C46 -8 40 0 32 0Z', I('P'), { stroke: I('B'), 'stroke-width': 1.4 }),
    F('M40 -16L96 -6L94 -3L42 -8Z', I('K'), { stroke: I('N'), 'stroke-width': 0.8 }), F('M42 -9C60 -4 80 -2 94 -3C80 4 56 6 44 -2Z', I('O'), { stroke: I('N'), 'stroke-width': 0.8 }), F('M94 -6l4 2l-4 3Z', I('R')),
    F(circ(36, -14, 2.2), I('N')), F('M14 -10C18 -2 22 2 30 2L28 8C18 6 12 0 10 -6Z', I('R')), S('M22 6l-8 14M26 6l-2 16', I('R'), 3),
    G(REF('frWn'), F('M-6 -8C-10 -48 -24 -84 -54 -102C-40 -76 -34 -44 -30 -4Z', I('P'), { stroke: I('B'), 'stroke-width': 1.4 }), F('M-54 -102C-44 -92 -38 -82 -36 -70L-28 -76C-34 -88 -42 -98 -54 -102Z', I('N')), S('M-12 -30C-18 -32 -24 -30 -28 -26M-10 -46C-16 -48 -22 -46 -26 -42', I('B'), 1.1)),
    G({ ...REF('frPop'), ...HID, transform: 'translate(70 -58)' }, F('M-26 0C-26 -16 26 -16 26 0C26 10 10 12 2 11L-6 22L-4 11C-18 11 -26 8 -26 0Z', I('P'), { stroke: I('N'), 'stroke-width': 1.4 }), F(text('嘎!', 18, 0, 6).d, I('R'))));
}
function burst(i) {
  const inks = [['R', 'P'], ['O', 'K'], ['P', 'R'], ['K', 'O']][i];
  let rays = '', tips = '';
  const n = [18, 14, 22, 12][i];
  for (let k = 0; k < n; k++) {
    const a = k / n * TAU, c = Math.cos(a), s = Math.sin(a);
    if (i === 2) { rays += `M${f(c * 20)} ${f(s * 20)}Q${f(c * 60)} ${f(s * 60 - 10)} ${f(c * 70)} ${f(s * 70 + 30)}`; }   // willow
    else rays += `M${f(c * 16)} ${f(s * 16)}L${f(c * 64)} ${f(s * 64)}`;
    tips += circ(c * 74, s * 74 + (i === 2 ? 32 : 0), i === 1 ? 3.4 : 2.4);
  }
  return G({ ...REF('fw' + i), ...HID }, S(rays, I(inks[0][0]), i === 3 ? 3.4 : 2.2), F(tips, I(inks[0][1])), i === 1 ? S(circ(0, 0, 40), I('P'), 1.6, { 'stroke-dasharray': '2 7' }) : '', F(circ(0, 0, 7), I('P')));
}
function signPost(kind) {
  const up = kind === 'down' ? '下坡 DOWNHILL' : '冲刺 SPRINT';
  const icon = kind === 'down' ? F('M-56 -148l40 0l-40 -22Z', I('N')) : S('M-56 -160h26M-50 -152h22M-44 -144h18', I('N'), 3);
  return G({ ...REF('sign-' + kind), ...HID },
    F(rect(-4, -130, 8, 130), I('N')), F(rect(-72, -178, 144, 48), kind === 'down' ? I('O') : I('T'), { stroke: I('N'), 'stroke-width': 2 }),
    S(rect(-66, -172, 132, 36), I('P'), 1.4), icon, F(text(up, 15, 14, -148.5).d, I('P')), F(rect(-12, -134, 24, 6), I('N')));
}
function popWord(ref, word, ink) {
  let rays = '';
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, c = Math.cos(a), s = Math.sin(a); rays += poly([[c * 70 - s * 5, s * 34 + c * 3], [c * (i % 2 ? 96 : 110), s * (i % 2 ? 46 : 54)], [c * 70 + s * 5, s * 34 - c * 3]]); }
  const t = text(word, 34, 0, 12);
  return G({ ...REF(ref), ...HID }, F(rays, I('O')), F(ell(0, 0, 76, 36), I(ink), { stroke: I('N'), 'stroke-width': 2 }),
    F(t.d, I('N'), { transform: 'translate(2.4 2.4)' }), F(t.d, I('P'), { stroke: I('N'), 'stroke-width': 1.2, 'paint-order': 'stroke' }));
}

export function build(ctx) {
  V = ctx.v; I = r => V('ink' + r);
  const back = G({ id: 'dir-back' }, cyclist(0), cyclist(1), cat(0), cat(1), keeper(), signPost('down'), signPost('flat'));
  const front = G({ id: 'dir-front' },
    G({ ...REF('gulls'), ...HID, ...DD('fx:O:dir-gulls') }, gull(0), gull(1)),
    G({ ...REF('fish'), ...HID, ...DD('sea:O:dir-fish') }, G(REF('fishRot'), fishShape())),
    G({ ...REF('drops'), ...HID, ...DD('fx:O:dir-drops') }, ...[0, 1, 2, 3, 4].map(i => F('M0 -7C3 -2 4 1 4 3A4 4 0 0 1 -4 3C-4 1 -3 -2 0 -7Z', I('P'), { stroke: I('B'), 'stroke-width': 1, 'data-ref': 'dir-drop' + i }))),
    G({ ...DD('fx:O:dir-pops') }, popWord('popWheee', 'WHEEE!', 'R'), popWord('popRace', 'RACE!', 'T')));
  const road = G({ id: 'dir-road' },
    G({ ...REF('puddle'), ...HID, ...DD('land:O:dir-puddle') }, F(ell(0, 0, 120, 13), I('B')), F(ell(-6, -2, 104, 9), V('sky1')), S('M-70 -3q20 -4 40 0M20 2q24 -4 44 0', I('P'), 1.6),
      G(REF('pRip'), S(ell(-30, 0, 16, 3) + ell(40, 1, 12, 2.4), I('P'), 1))),
    G({ ...REF('pothole'), ...HID, ...DD('land:O:dir-pothole') }, F('M-44 0C-40 -8 -10 -10 10 -8C34 -6 46 -2 40 4C30 10 -30 10 -44 0Z', I('N')), F('M-40 1C-30 -4 20 -6 36 -1C20 -3 -20 -2 -40 1Z', I('K')),
      S('M40 0l16 -4l8 3M-44 0l-12 3l-8 -2M10 8l6 6', I('N'), 1.2),
      G({ transform: 'translate(90 0)' }, F('M-12 0L-4 -40H4L12 0Z', I('O'), { stroke: I('N'), 'stroke-width': 1.2 }), F('M-8 -16h16l-2 -8h-12ZM-5 -30h10l-1 -5h-8Z', I('P')), F(rect(-16, -3, 32, 5), I('N')))));
  const sky = G({ id: 'dir-sky' }, kites(), G({ ...REF('fws'), ...DD('sky:O:dir-fireworks') }, burst(0), burst(1), burst(2), burst(3)));
  const gullsFar = G({ id: 'dir-far' }, friend());
  const boats = G({ id: 'dir-boats' }, G({ ...REF('splash'), ...HID, ...DD('sea:O:dir-splash') }, S(ell(0, 0, 26, 5), I('P'), 2), F('M-12 0l-6 -16l8 12ZM0 0l0 -22l4 20ZM12 0l8 -15l-5 14Z', I('P'))));
  return { layers: { 'L-fx-back': back, 'L-fx-front': front, 'L-road': road, 'L-clouds': sky, 'L-gulls-far': gullsFar, 'L-boats': boats } };
}

// ------------------------------------------------------------------------------------------------ attach / update
export function attach(svg, ctx) {
  const r = {};
  for (const el of svg.querySelectorAll('[data-ref^="dir-"]')) r[el.getAttribute('data-ref').slice(4)] = el;
  const cache = new WeakMap();
  const set = (el, k, val) => { if (!el) return; let m = cache.get(el); if (!m) cache.set(el, (m = {})); if (m[k] !== val) { m[k] = val; el.setAttribute(k, val); } };
  const vis = (el, on) => set(el, 'visibility', on ? 'inherit' : 'hidden');
  // Encounters are off stage most of the time: their root groups are detached from the DOM while unused (keeps the
  // live node count and style/layout work down) and re-inserted at a placeholder when they come on.
  const slots = new Map();
  const ROOTS = ['cyc0', 'cyc1', 'cat0', 'cat1', 'keeper', 'sign-down', 'sign-flat', 'gulls', 'fish', 'drops', 'popWheee', 'popRace', 'puddle', 'pothole', 'kites', 'fws', 'friend', 'splash'];
  for (const k of ROOTS) { const el = r[k]; if (!el) continue; const ph = document.createComment(k); el.parentNode.insertBefore(ph, el); el.remove(); slots.set(el, ph); }
  const stage = (el, on) => {
    const ph = slots.get(el);
    if (!ph) return vis(el, on);
    if (on && !el.isConnected) { ph.parentNode.insertBefore(el, ph); vis(el, true); }
    else if (!on && el.isConnected) el.remove();
  };
  const T = (el, s) => set(el, 'transform', s);
  const eye = svg.querySelector('#j-eye');
  const shown = new Set();
  return {
    update(fr) {
      const D = fr.distance, t = fr.t, red = fr.reduced || ctx.reduced, dz = fr.director || { enc: [] };
      const wx = fr.weather || {};
      const on = new Set();
      const lampOn = fr.pal && fr.pal.num ? fr.pal.num.lampOn : fr.night || 0;
      const J = fr.pose && fr.pose.joints;
      for (const { kind, v, u, e } of dz.enc) {
        const dx = e.D - D;                                // road units ahead of the mark (depth-1 layers)
        if (kind === 'cyclist') {
          // oncoming at ~0.35 of our speed: relative motion 1.35·D; crossing at the mark
          const x = RIDER_X + 40 + dx * 1.35;   // (scaled 1.5: a person beside a great white pelican)
          if (x < -500 || x > 2200) continue;
          const k = `cyc${v}`; on.add(k);
          T(r[k], `translate(${f(x)} ${GROUND_Y - 32}) scale(1.5)`);
          const ph = (D * 0.35 + (e.D % 1000)) / (TAU * 44);  // wheel turns for their own road distance
          T(r[k + '-wr'], `rotate(${f(-ph * 360)})`); T(r[k + '-wf'], `rotate(${f(-ph * 360)})`);
          const ca = -ph / 3 * TAU, cr = 18, hip = [8, -114];
          const legPath = s => { const px = Math.sin(ca + s) * cr, py = -36 - Math.cos(ca + s) * cr; const dx2 = px - hip[0], dy2 = py - hip[1], L = Math.hypot(dx2, dy2), l1 = 46, l2 = 44;
            const a = Math.atan2(dy2, dx2), c = clamp((l1 * l1 + L * L - l2 * l2) / (2 * l1 * L), -1, 1), kn = a + Math.acos(c);
            return `M${hip[0]} ${hip[1]}L${f(hip[0] + Math.cos(kn) * l1)} ${f(hip[1] + Math.sin(kn) * l1)}L${f(px)} ${f(py)}l-8 1`; };
          set(r[k + '-legN'], 'd', legPath(0)); set(r[k + '-legF'], 'd', legPath(Math.PI));
          T(r[k + '-crank'], `translate(0 -36) rotate(${f(ca * 180 / Math.PI)})`);
          const wv = u > -0.9 && u < 1.2 ? Math.sin(t * 14) * 18 : 40;
          T(r[k + '-arm'], `translate(6 -166) rotate(${f(u > -0.9 && u < 1.2 ? wv - 10 : 115)})`);
        } else if (kind === 'cat') {
          const x = RIDER_X + dx + 60;
          if (x < -300 || x > 2100) continue;
          const k = `cat${v}`; on.add(k);
          const tb = u + 0.42;                             // seconds since the bell
          const jump = sstep(0.12, 0.62, tb);
          T(r[k], `translate(${f(x)} ${GROUND_Y - 36}) scale(${f(1.7 - 0.6 * jump)})`);
          vis(r[k + '-sit'], tb < 0.12); vis(r[k + '-leap'], tb >= 0.12);
          T(r[k + '-air'], `translate(${f(jump * 40)} ${f(-Math.sin(jump * Math.PI) * 60 - jump * 30)})`);
          vis(r[k + '-pop'], tb > 0.1 && tb < 1.6);
        } else if (kind === 'gulls') {
          if (u < -1.8 || u > 2.8 || !J) continue;
          on.add('gulls');
          const bx = RIDER_X + 180, by = GROUND_Y - 300;
          T(r.gulls, `translate(${bx} ${by})`);
          for (let i = 0; i < 2; i++) {
            const s = i ? 1 : -1;
            let gx, gy;
            if (u < -0.2) { const k = sstep(-1.8, -0.2, u); gx = lerp(520 + i * 160, 40 + i * 70, k); gy = lerp(-360 - i * 60, -70 - i * 34, k); }
            else if (u < 0.9) { gx = 40 + i * 70 + Math.sin(t * 5 + i) * 8; gy = -70 - i * 34 + Math.sin(t * 7 + i * 2) * 6; }
            else { const k = sstep(0.9, 2.8, u); gx = lerp(40 + i * 70, -700 + i * 200, k); gy = lerp(-70 - i * 34, -520 - i * 60, k * k); }
            const flap = red ? 0.6 : Math.sin(t * (u > 0.9 ? 22 : 16) + i * 2);
            T(r['gull' + i], `translate(${f(gx)} ${f(gy)}) scale(${u > 0.9 ? -1.25 : 1.25} 1.25) rotate(${f(u > 0.9 ? -18 : s * 4)})`);
            T(r[`gull${i}-wn`], `scale(1 ${f(0.25 + 0.75 * Math.abs(flap))})`); T(r[`gull${i}-wf`], `scale(1 ${f(0.3 + 0.7 * Math.abs(flap))})`);
          }
        } else if (kind === 'fish') {
          if (u < -0.1 || u > 0.75 || !J) continue;
          on.add('fish'); on.add('splash');
          const bu = J.billUpper, a = (bu.rot || 0) * Math.PI / 180;
          const tx = RIDER_X + bu.x + Math.cos(a) * 70, ty = GROUND_Y + (fr.pose.riderY || 0) + bu.y + Math.sin(a) * 70 + 10;
          const sx = RIDER_X + 330, sy = 575, k = clamp((u + 0.1) / 0.72, 0, 1);
          const x = lerp(sx, tx, k), y = lerp(sy, ty, k) - Math.sin(k * Math.PI) * 190;
          T(r.fish, `translate(${f(x)} ${f(y)}) scale(${f(1.5 + 0.2 * k)})`);
          T(r.fishRot, `rotate(${f(-150 - 200 * k)})`);
          vis(r.fish, k < 0.97);
          // splash in L-boats (depth .12): fixed on screen near the launch point
          const sk = clamp((u + 0.1) / 0.6, 0, 1);
          T(r.splash, `translate(${f(sx - 40)} ${sy - 30}) scale(${f(0.5 + sk * 1.3)} ${f(1 - sk * 0.6)})`);
          set(r.splash, 'opacity', f(1 - sk));
        } else if (kind === 'drink') {
          if (u < -0.3 || u > 1.3 || !J || red) continue;
          on.add('drops');
          const bu = J.billUpper, a = (bu.rot || 0) * Math.PI / 180;
          const tx = RIDER_X + bu.x + Math.cos(a) * 80, ty = GROUND_Y + (fr.pose.riderY || 0) + bu.y + Math.sin(a) * 80 + 14;
          T(r.drops, `translate(${f(tx)} ${f(ty)})`);
          for (let i = 0; i < 5; i++) { const p = wrap(t * 1.6 + i / 5, 1); T(r['drop' + i], `translate(${f((i - 2) * 12)} ${f(-120 + p * 120)}) scale(${f(1.2 - p * 0.3)})`); }
        } else if (kind === 'puddle' || kind === 'pothole') {
          const x = RIDER_X + dx + 30;
          if (x < -400 || x > 2100) continue;
          on.add(kind);
          T(r[kind], `translate(${f(x)} ${GROUND_Y + 8})`);
          if (kind === 'puddle') T(r.pRip, `scale(${f(1 + wrap(t * 1.4, 1) * 0.8)} 1)`);
        } else if (kind === 'keeper') {
          const x = RIDER_X + dx + 40;
          if (x < -300 || x > 2100) continue;
          on.add('keeper');
          T(r.keeper, `translate(${f(x)} ${GROUND_Y - 32}) scale(1.45)`);
          T(r.kArm, `translate(15 -98) rotate(${f(red ? 0 : Math.sin(t * 9) * 16)})`);
          set(r.kLamp, 'opacity', f(0.25 + 0.3 * Math.max(wx.fog || 0, lampOn)));
        } else if (kind === 'kites') {
          if (u < -1 || u > 22) continue;
          on.add('kites');
          const k = sstep(-1, 1.5, u) * (1 - sstep(19, 22, u));
          T(r.kites, `translate(${f(260 - u * 34)} ${f(260 * (1 - k))})`);
          for (let i = 0; i < 5; i++) T(r['kite' + i], `translate(${f([150, 420, 700, 980, 1260][i] + (red ? 0 : Math.sin(t * 0.9 + i) * 8))} ${f([170, 120, 90, 150, 110][i] + (red ? 0 : Math.sin(t * 1.3 + i * 2) * 6))}) rotate(${f(red ? 0 : Math.sin(t * 1.1 + i) * 9)})`);
          for (let i = 0; i < 9; i++) T(r['kseg' + i], `translate(${f(-24 - i * 20)} ${f(red ? i * 3 : Math.sin(t * 2.2 - i * 0.7) * (6 + i * 1.5))})`);
        } else if (kind === 'friend') {
          if (u < -6 || u > 6) continue;
          on.add('friend');
          const x = RIDER_X - 900 + (u + 6) * 190, y = 330 + Math.sin(u * 0.8) * 30;
          const flap = red ? 0.5 : Math.sin(t * 6);
          T(r.friend, `translate(${f(x)} ${f(y)}) rotate(${f(-4 + flap * 2)}) scale(1.35)`);
          T(r.frWn, `scale(1 ${f(0.45 + 0.55 * (0.5 + 0.5 * flap))})`); T(r.frWf, `scale(1 ${f(0.5 + 0.5 * (0.5 + 0.5 * flap))})`);
          vis(r.frPop, u > -3.6 && u < -1.2);
        } else if (kind === 'fireworks') {
          const night = lampOn > 0.3;
          if (!night || u < 0 || u > 2.2 * KM / U) continue;
          on.add('fws');
          for (let i = 0; i < 4; i++) {
            const cyc = red ? 0.4 : wrap(t / 1.9 + i * 0.27, 1), n = Math.floor(t / 1.9 + i * 0.27);
            const x = 220 + hash(n * 4 + i, 7) * 1200, y = 130 + hash(n * 4 + i, 9) * 180;
            const sc = 0.4 + 1.1 * Math.sqrt(sstep(0, 0.45, cyc));
            T(r['fw' + i], `translate(${f(x)} ${f(y + cyc * 30)}) scale(${f(sc * (0.8 + hash(n, i) * 0.6))})`);
            set(r['fw' + i], 'opacity', f(cyc < 0.08 ? 0 : 1 - sstep(0.5, 1, cyc)));
            on.add('fw' + i);
          }
        }
      }
      // pacing: signs before the window, pop words inside it
      const pc = dz.pace || { mode: 'cruise' };
      const lap = lapOf(D);
      let sDown = null, sFlat = null;
      for (const L of [lap, lap + 1]) for (const p of lapScript(L).pace) if (p.sign === 'down' || p.sign === 'flat') {
        const Dp = L * LAP + (p.a - 0.06) * KM, x = RIDER_X + (Dp - D);
        if (x > -300 && x < 2100) { if (p.sign === 'down') sDown = x; else sFlat = x; }
      }
      if (sDown !== null) { on.add('sign-down'); T(r['sign-down'], `translate(${f(sDown)} ${GROUND_Y - 34})`); }
      if (sFlat !== null) { on.add('sign-flat'); T(r['sign-flat'], `translate(${f(sFlat)} ${GROUND_Y - 34})`); }
      if (pc.mode === 'coast' && pc.k > 0.3 && fr.coasting) { on.add('popWheee'); const w = red ? 0 : Math.sin(t * 9) * 3; T(r.popWheee, `translate(420 ${f(330 + w)}) rotate(-8) scale(${f(0.9 + 0.1 * pc.k)})`); }
      if (pc.mode === 'sprint' && pc.sign === 'race' && (D - (lap * LAP + pc.a * KM)) / U < 3.2) { on.add('popRace'); T(r.popRace, `translate(430 330) rotate(-6)`); }
      // rider squints in the rain / a hard breeze (eye slot is written by main every frame; scale it on top)
      if (eye && (wx.squint || 0) > 0.05) eye.setAttribute('transform', eye.getAttribute('transform') + ` scale(1 ${f(1 - 0.6 * wx.squint)})`);
      // visibility diff
      for (const k of shown) if (!on.has(k)) stage(r[k], false);
      for (const k of on) if (!shown.has(k)) stage(r[k], true);
      shown.clear(); for (const k of on) shown.add(k);
      if (!on.has('fws')) for (let i = 0; i < 4; i++) vis(r['fw' + i], false); else for (let i = 0; i < 4; i++) vis(r['fw' + i], true);
    },
  };
}
