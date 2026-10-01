// solvePose(t, s): PURE pose function (no DOM, importable in node). See docs/rig-spec.md §2–§3.
// s = { crank: rad (unwrapped ok), distance, cadence (rpm), speed (units/s), coasting, events: [{type, t0}],
//       loopT?: seconds (baked story loop: blinks/gaze/gusts repeat exactly every loopT), tod?: 0..1 }
// Event types: hop wave bell gulp, plus optional coast / pedal markers ({type:'coast'|'pedal', t0}) that let
// the cranks swing to level smoothly when coasting starts and swing back when pedalling resumes.
//
// Periodicity: with no events the pose depends only on (crank φ, distance mod DIST_PER_REV, t). Crank- and
// distance-driven terms use integer harmonics (exactly periodic per crank turn); time-driven terms
// (breathing, steering drift, blinks, gaze, gusts, gular flutter) are exactly periodic in 24 s (and in loopT
// when given), so the 60 rpm baked 24 s loop closes exactly. Without loopT the blink/gaze/gust schedules are
// hashed on absolute time (aperiodic in the live page).
//
// Structure (every value analytic):
//   1. drives: crank display (coast level / hop hold), cadence effort, wind, gusts
//   2. event X-sheets (TIMING): hop, bell, wave, gulp as monotone keyframe tracks + damped impulses
//   3. gaze + blink scheduler (hash cells, saccade ≤ 90 ms, hold ≥ 500 ms, eye → head → neck breaking)
//   4. body on saddle (analytic belly-ellipse contact), legs IK, wings IK to the steered grips
//   5. secondaries: pedalling part = phasor chain (child lag = parent lag + own ψ), transient part = FIR
//      spring follower of the parent's pure drive signal (lag + 1–2 overshoots on any event or saccade)
import { BIKE, SKEL, DIST_PER_REV } from '../contract.js';
import { DEG, TAU, smoothstep, clamp, wrap, rot, add, lerp } from '../core/math.js';
import { ik2 } from './ik.js';
import { lapScript } from '../world/director.js';
import { LAP, KM, lapOf } from '../world/route.js';
import { phasor, child, evalPh, impulse, impulseSoft, track, hermite, follow, hash01, cellOf, cellKey, gust, smooth01 } from './secondary.js';

const R2D = DEG, D2R = 1 / DEG;
const U60 = DIST_PER_REV;                             // u per second at 60 rpm
const at = (F, off) => add(F.p, rot(off, F.r));
const softMax = (a, x, k) => a + k * Math.log1p(Math.exp((x - a) / k));   // smooth floor (belly never leaves the saddle)

// ------------------------------------------------------------------------------------------------
// Fit (C3.2 / C3.3): pelvis 22 u further back than SKEL.pelvis so the belly contact centres on the saddle
// (x ≈ −64, saddle −101…−23), the hip sits in the middle third and KOPS is ≈ +8 u. The torso carries a
// 3° forward lean at rest (body axis 15° head-up), up to +7.5° when sprinting and −3° when coasting.
// Neon edition: a cooler, laid-back cruise — 2.2° rest lean (was 3), softer hip rock, a half-time head nod.
export const FIT = { dx: -22, lean: 2.2, sit: 2.6, head: [120, -518] };
export const G = 2885;                              // scene gravity, u/s² (1 u = 3.4 mm)
const hopT = (() => {
  const H = 48, v0 = Math.sqrt(2 * G * H), air = 2 * v0 / G, takeoff = 0.24;
  return { H, v0, air, takeoff, land: takeoff + air, frontLift: 0.15, level: 0.2, hold: takeoff + air + 0.1, release: 0.45, gap: 1.2 };
})();
// X-sheet timing (seconds from t0). Audio / fx should key off these (e.g. ring on bell.strike, thud on hop.land).
export const TIMING = {
  hop: { crouch: [0, 0.16], frontLift: hopT.frontLift, takeoff: hopT.takeoff, apex: hopT.takeoff + hopT.air / 2, land: hopT.land, settle: hopT.land + 0.5, height: hopT.H, gap: hopT.gap, dur: 1.3 },
  bell: { cock: [0, 0.085], strike: 0.1, settle: 0.45, dur: 0.6 },
  wave: { dip: [0, 0.14], unfold: [0.14, 0.86], wave: [0.8, 1.65], back: [1.65, 2.37], overshoot: 2.37, dur: 2.7, gap: 2.7 },
  gulp: { reach: [0.14, 0.54], scoop: [0.54, 0.7], lift: [0.7, 1.0], toss: [1.0, 1.32], swallow: [1.32, 1.85], settle: [1.85, 2.5], dur: 2.5, gap: 2.6 },
  coast: { level: 0.5 },
};

// ------------------------------------------------------------------------------------------------
// Event bookkeeping: overlapping re-triggers of the long events are ignored (pure, no pops).
function accepted(events, type, gap, t, horizon) {
  const out = []; let last = -1e9;
  const list = events.filter(e => e.type === type).sort((a, b) => a.t0 - b.t0);
  for (const e of list) if (e.t0 - last >= gap) { last = e.t0; const tau = t - e.t0; if (tau >= 0 && tau < horizon) out.push(tau); }
  return out;
}

// ---------------------------------- X-sheets (keys: [tau, value]) ----------------------------------
// gulp keys were authored on a 2.4 s sheet; GMAP retimes them (slower reach / toss keeps every joint under
// 2 u and 3° per 240 Hz sample while the beats stay readable)
const GMAP = [[0, 0], [0.14, 0.14], [0.42, 0.54], [0.56, 0.67], [0.68, 0.78], [0.92, 1.0], [1.08, 1.18], [1.22, 1.32], [1.45, 1.55], [1.75, 1.85], [2.05, 2.15], [2.4, 2.5], [9, 9.1]];
const gmap = tau => { let i = 0; while (i < GMAP.length - 2 && tau > GMAP[i + 1][0]) i++; const [a0, b0] = GMAP[i], [a1, b1] = GMAP[i + 1]; return b0 + (tau - a0) * (b1 - b0) / (a1 - a0); };
const K = {
  // hop
  hopPitch: [[0, 0], [hopT.frontLift, 0], [hopT.takeoff + 0.02, -6.5], [hopT.takeoff + 0.1, -5.2], [hopT.land - 0.02, -1.1], [hopT.land + 0.06, 0]],
  hopSit: [[0, 0], [0.13, 5.2], [0.19, 4.2], [hopT.takeoff + 0.02, -1.2], [hopT.takeoff + 0.14, 0], [hopT.land, 0]],
  hopLean: [[0, 0], [0.14, 3], [hopT.takeoff, -1.5], [hopT.takeoff + 0.16, 0.5], [hopT.land, 0]],
  hopHead: [[0, 0], [0.14, 3], [hopT.takeoff + 0.03, 6], [hopT.takeoff + 0.18, -3], [hopT.land - 0.03, -2], [hopT.land, 0]],
  hopSurp: [[0, 0], [0.18, 0], [hopT.takeoff + 0.08, 1], [hopT.land + 0.05, 0.9], [hopT.land + 0.35, 0]],
  hopStretch: [[0, 0], [0.13, -1], [0.19, -0.8], [hopT.takeoff + 0.03, 1], [hopT.takeoff + 0.16, 0], [hopT.land, 0]],
  // bell: 5-frame cock, 2-frame pop, settle
  bellFlick: [[0, 0], [0.07, -1], [0.085, -1.05], [0.118, 1], [0.2, 0.55], [0.32, -0.12], [0.45, 0]],
  bellSquint: [[0, 0], [0.09, 0], [0.13, 0.9], [0.3, 0.55], [0.6, 0]],
  // wave
  waveDip: [[0, 0], [0.08, 1], [0.18, 0.55], [0.32, 0]],
  waveU: [[0, 0], [0.14, 0], [0.26, 0.15], [0.74, 0.88], [0.86, 1], [1.65, 1], [1.77, 0.9], [2.25, 0.1], [2.37, 0]],
  waveHand: [[0, 0], [0.14, 6], [0.55, -45], [0.85, -72], [1.65, -72], [2.05, -30], [2.37, 9], [2.5, -3], [2.62, 0]],
  waveEnv: [[0, 0], [0.8, 0], [0.92, 1], [1.55, 1], [1.67, 0]],
  waveLook: [[0, 0], [0.22, 0], [0.38, 1], [1.9, 1], [2.2, 0]],
  waveLean: [[0, 0], [0.2, 0.4], [0.6, -1.3], [1.8, -1.2], [2.3, 0.3], [2.5, 0]],
  waveSteer: [[0, 0], [0.2, 1], [2.2, 1], [2.5, 0]],
  // gulp (head offset from its stabilised rest; rot = pitch, + = bill down)
  gHx: [[0, 0], [0.14, -4], [0.42, 40], [0.56, 42], [0.68, 34], [0.92, 6], [1.08, -6], [1.22, -8], [1.45, -4], [1.75, 2], [2.05, 0]],
  gHy: [[0, 0], [0.14, -8], [0.42, 100], [0.56, 106], [0.68, 88], [0.92, 20], [1.08, -16], [1.22, -22], [1.45, -12], [1.75, -2], [2.05, 1], [2.4, 0]],
  gHr: [[0, 0], [0.14, -8], [0.42, 62], [0.56, 66], [0.68, 56], [0.92, 8], [1.08, -56], [1.22, -64], [1.45, -40], [1.75, -6], [2.05, 2], [2.4, 0]],
  gOpen: [[0, 0], [0.3, 2], [0.44, 16], [0.56, 14], [0.63, 3], [0.9, 5], [1.03, 20], [1.2, 22], [1.34, 0], [2.4, 0]],
  gPsy: [[0, 1], [0.5, 1], [0.63, 1.32], [0.9, 1.36], [1.1, 1.24], [1.3, 0.84], [1.45, 1.1], [1.62, 0.97], [1.8, 1]],
  gPsx: [[0, 1], [0.63, 1.08], [1.1, 1.06], [1.3, 0.93], [1.45, 1.03], [1.8, 1]],
  gLean: [[0, 0], [0.42, 4], [0.7, 3], [1.1, -2], [1.5, -1], [2.0, 0]],
  gBulgeT: [[1.2, 0.95], [1.75, 0.08]],
  gBulgeA: [[1.15, 0], [1.26, 1], [1.62, 0.85], [1.8, 0]],
  gInBill: [[0.44, 0], [0.5, 1], [0.6, 1], [0.66, 0]],
  gInPouch: [[0.52, 0], [0.63, 1], [1.22, 1], [1.32, 0]],
  gFishRot: [[0.62, 20], [0.98, 180]],
  gTaken: [[0.44, 0], [0.5, 1], [6.5, 1], [7.5, 0]],
  gDrip: [[0.55, 0], [0.63, 1], [0.95, 1], [1.05, 0]],
  gDelight: [[0, 0], [1.45, 0], [1.72, 1], [2.25, 1], [2.7, 0]],
  gLookBasket: [[0, 0], [0.05, 1], [0.6, 1], [0.8, 0]],
  gShake: [[1.85, 0], [1.92, 1], [2.3, 0]],
  // coasting pouch stretch idle
  cStretch: [[0, 0], [0.5, 1], [1.4, 1], [2.1, 0]],
};

for (const k of Object.keys(K)) if (k[0] === 'g' && k !== 'gShake') K[k] = K[k].map(([a, v]) => [gmap(a), v]);
K.gShake = [[1.95, 0], [2.02, 1], [2.4, 0]];

// ---------------------------------- gaze + blinks ----------------------------------
export const GAZE = {
  ahead: { x: 0.6, y: 0.05, turn: 0, pitch: 0 },
  road: { x: 0.5, y: 0.5, turn: 0, pitch: 7 },
  sea: { x: 0.2, y: -0.2, turn: -0.5, pitch: -3 },
  sky: { x: 0.35, y: -0.8, turn: -0.1, pitch: -12 },
  basket: { x: 0.3, y: 0.85, turn: 0.1, pitch: 14 },
  camera: { x: -0.05, y: 0.1, turn: 1, pitch: 2 },
  hud: { x: 0.52, y: 0.62, turn: 0, pitch: 10 },          // the holographic speedometer projected above the stem
};
const GAZE_BAG = [['ahead', 0.3], ['sea', 0.18], ['road', 0.07], ['sky', 0.12], ['basket', 0.09], ['camera', 0.12], ['hud', 0.12]];
// HUD scan: a glance down at the speedometer is a short check, not a stare — after HUD_HOLD the eye saccades back
// 'ahead' (only when the next scheduled change is far enough away that both holds stay ≥ 0.6 s).
const HUD_HOLD = 0.75, HUD_MIN_GAP = 1.5;
const GAZE_CELL = 2.6, BLINK_CELL = 5.0;
function gazeName(key) {
  let u = hash01(key, 11);
  for (const [n, p] of GAZE_BAG) { if (u < p) return n; u -= p; }
  return 'ahead';
}
// the change that happens in cell k: { time, name }
function gazeChange(c, k) {
  const key = cellKey(k, c.n);
  return { time: c.base + k * c.cell + 0.3 + hash01(key, 12) * (c.cell - 0.8), name: gazeName(key) };
}
// scheduled changes of cells k0..k1 plus the HUD-glance returns, in time order
function gazeEvents(c, k0, k1) {
  const out = [];
  for (let k = k0; k <= k1; k++) {
    const ch = gazeChange(c, k);
    out.push(ch);
    if (ch.name === 'hud' && gazeChange(c, k + 1).time - ch.time >= HUD_MIN_GAP) out.push({ time: ch.time + HUD_HOLD, name: 'ahead', scan: true });
  }
  return out;
}
export function gazeAt(t, loopT) {
  const c = cellOf(t, GAZE_CELL, loopT);
  const ev = gazeEvents(c, c.k - 3, c.k);
  let i = ev.length - 1; while (i > 1 && ev[i].time > t) i--;
  const cur = ev[i], prev = ev[i - 1];
  const since = t - cur.time;
  const A = GAZE[prev.name], B = GAZE[cur.name];
  const eye = smooth01(since / 0.07);                    // saccade: 70 ms
  const head = smooth01((since - 0.08) / 0.42);          // head follows 80 ms later over a smooth 420 ms move
  return {
    x: lerp(A.x, B.x, eye), y: lerp(A.y, B.y, eye),
    pitch: lerp(A.pitch, B.pitch, head), turn: lerp(A.turn, B.turn, head),
    target: cur.name, from: prev.name, since, big: Math.abs(A.pitch - B.pitch) >= 12 || Math.abs(A.turn - B.turn) > 0.6, changeT: cur.time,
  };
}
const lidCurve = tau => (tau < 0 || tau > 0.19 ? 0 : tau < 0.055 ? smooth01(tau / 0.055) : 1 - smooth01((tau - 0.055) / 0.135));
const nictCurve = tau => (tau < 0 || tau > 0.16 ? 0 : tau < 0.07 ? smooth01(tau / 0.07) : 1 - smooth01((tau - 0.07) / 0.09));
// Irregular blinks: one per 5 s hash cell (intervals 1–9 s), 15% doubles, plus a lid blink on
// every big gaze shift. Most blinks are the pelican's nictitating membrane (front → back sweep) with a
// partial lid drop; about 40% are full lid blinks.
export function blinkAt(t, loopT, gz) {
  const c = cellOf(t, BLINK_CELL, loopT);
  let lid = 0, nict = 0;
  for (const dk of [0, -1]) {
    const k = c.k + dk, key = cellKey(k, c.n);
    const s0 = c.base + k * c.cell + 0.3 + hash01(key, 21) * (c.cell - 1);
    const full = hash01(key, 22) < 0.4, dbl = hash01(key, 23) < 0.15;
    for (const s of dbl ? [s0, s0 + 0.3] : [s0]) {
      const tau = t - s;
      lid = Math.max(lid, lidCurve(tau) * (full || s !== s0 ? 1 : 0.3));
      nict = Math.max(nict, nictCurve(tau));
    }
  }
  if (gz && gz.big) lid = Math.max(lid, lidCurve(t - gz.changeT + 0.01));
  return { lid, nict };
}

// ---------------------------------- encounter gaze (director) ----------------------------------
// The rider looks at what the director puts beside the road. Pure in (distance, speed, tod): the encounters are
// the director's seeded schedule keyed by road distance, so renderAt(t) and live play agree. Each kind has a look
// window in u (seconds at 60 rpm since its mark) and a target point in rider-origin coordinates (world − (RIDER_X,
// GROUND_Y); every encounter the rider tracks lives on a depth-1 layer or is placed relative to the rider).
// The eye saccades first (80 ms), the head follows ~110 ms later over ~350 ms; a turn over 15° gets a lid blink.
const HEAD0 = [120, -520];
const encTarget = {
  cyclist: (dx) => ({ win: [-3.2, 1.4], p: [40 + dx * 1.35, -275] }),
  cat: (dx) => ({ win: [-3, 0.9], p: [dx + 60, -70] }),
  keeper: (dx) => ({ win: [-3.4, 1.2], p: [dx + 40, -200] }),
  puddle: (dx) => ({ win: [-2.4, -0.45], p: [dx + 30, 0] }),
  pothole: (dx) => ({ win: [-2.4, -0.45], p: [dx + 30, 0] }),
  gulls: (dx, u) => ({ win: [-1.6, 2.4], p: u < -0.2 ? [180 + lerp(520, 40, smooth01((u + 1.8) / 1.6)), -300 + lerp(-360, -70, smooth01((u + 1.8) / 1.6))]
    : u < 0.9 ? [220, -370] : [180 + lerp(40, -700, smooth01((u - 0.9) / 1.9)), -300 + lerp(-70, -520, smooth01((u - 0.9) / 1.9))] }),
  fish: () => ({ win: [-1.1, -0.15], p: [330, 575 - 790] }),
  kites: (dx, u) => ({ win: [0.6, 4.2], p: [260 - u * 34 + [150, 700, 1260][clamp(Math.floor((u - 0.6) / 1.3), 0, 2)] - 680, 140 - 790] }),   // sky-layer kites: the dragon, then the others
  friend: (dx, u) => ({ win: [-4.6, -2.3], p: [-900 + (u + 6) * 190 - 680, 330 - 790] }),
};
const encCache = new Map();
const lapEnc = L => { let a = encCache.get(L); if (!a) { a = lapScript(L).enc.map(e => ({ kind: e.kind, D: L * LAP + e.km * KM })); encCache.set(L, a); if (encCache.size > 6) encCache.delete(encCache.keys().next().value); } return a; };
const dirNear = D => { const L = lapOf(D), out = []; for (const l of [L - 1, L, L + 1]) if (l >= 0) for (const e of lapEnc(l)) if (e.D - D < 8 * U60 && D - e.D < 64 * U60) out.push(e); return out; };
let DIR = dirNear, dirOff = typeof location !== 'undefined' && /[?&]nodirector\b/.test(location.search || '');
export function setEncounterSource(fn) { DIR = fn === undefined ? dirNear : fn; }   // (D) → [{ kind, D }]; null disables
function dirToGaze(p) {
  const dx = p[0] - HEAD0[0], dy = p[1] - HEAD0[1], L = Math.hypot(dx, dy) || 1, h = dx / L, v = dy / L;
  const elev = Math.asin(clamp(v, -1, 1)) * R2D;             // + = below the eye line
  return {
    x: clamp(0.36 + 0.34 * h, 0, 0.72), y: clamp(v * 1.1, -0.85, 0.9),
    turn: h < 0 ? 0.85 * -h : 0.1 * v, pitch: clamp(elev * (h < 0 ? 0.25 : 0.45), -16, 15),
  };
}
// Fixations: like a real bird the rider does not track smoothly; inside a look window it fixates the target every
// `step` (u) — the eye saccades there in 80 ms, the head follows 110 ms later over 350 ms — so a passing cyclist is
// followed in a few readable glances instead of a whip. Road passers are never looked at behind the head (no
// owl turn); flyers from behind (friend, fleeing gulls) get an over-the-shoulder look toward the near side.
const FIX = { cyclist: 0.95, cat: 0.8, keeper: 1.1, puddle: 0.9, pothole: 0.9, gulls: 0.7, fish: 0.5, kites: 1.3, friend: 1.1, fireworks: 0.8 };
const BEHIND = { gulls: 1, friend: 1, fireworks: 1 };
// → { w (head weight), we (eye weight), x, y, turn, pitch (head, eased), kind, lid } or null
export function encounterLook(D, speed, tod, base = GAZE.ahead) {
  if (!DIR || dirOff) return null;
  const sp = Math.max(40, speed), toS = U60 / sp;              // u → real seconds
  const cands = [];
  const night = tod !== undefined && (tod > 0.845 || tod < 0.21);
  for (const e of DIR(D)) {
    const u = (D - e.D) / U60;
    let tgt;
    if (e.kind === 'fireworks') {
      if (!night || u < 0 || u > 60) continue;
      const k = Math.floor(u / 7);                                // a 2.4 s glance up every 7 s of the show
      tgt = { win: [7 * k + 0.4, 7 * k + 2.8], at: () => [220 + hash01(k, 5) * 1200 - 680, 130 + 180 * hash01(k, 6) - 790] };
    } else if (encTarget[e.kind]) { const T0 = encTarget[e.kind](0, 0); tgt = { win: T0.win, at: uu => encTarget[e.kind]((u - uu) * U60 + e.D - D, uu).p }; }
    else continue;
    const [a, b] = tgt.win;
    if (u < a - 0.8 || u > b + 1.2) continue;
    const lead = 0.11 / toS;                                    // eye leads the head by 110 ms
    const rE = 0.08 / toS, hIn = a - rE + lead;                // eye starts at a − 80 ms, head 110 ms after it
    const we = smooth01((u - a + rE) / rE) * (1 - smooth01((u - b) / rE));
    const w = smooth01((u - hIn) / (0.35 / toS)) * (1 - smooth01((u - b - lead) / (0.4 / toS)));
    if (w <= 0 && we <= 0) continue;
    const step = Math.max(FIX[e.kind] || 1, 0.55 / toS), fixG = k => {
      const uk = Math.min(b, a + k * step);
      const p = tgt.at(Math.min(b, uk + 0.25));                 // aim slightly ahead of where it will be
      if (!BEHIND[e.kind]) p[0] = Math.max(p[0], HEAD0[0] + 70);
      return { uk, g: dirToGaze(p) };
    };
    const k = clamp(Math.floor((u - a) / step), 0, Math.ceil((b - a) / step));
    const cur = fixG(k), prv = k > 0 ? fixG(k - 1) : { uk: a - 1, g: cur.g };
    const since = (u - cur.uk) * toS;                           // real seconds since this fixation began
    const se = smooth01(since / 0.08), sh = smooth01((since - 0.11) / 0.35);
    const E = (key, s) => lerp(prv.g[key], cur.g[key], s);
    const A = GAZE.ahead, G0 = prv.g, G1 = cur.g;
    const bigShift = k > 0 && (Math.abs(G1.pitch - G0.pitch) > 11 || Math.abs(G1.turn - G0.turn) > 0.4);
    const bigIn = Math.abs(cur.g.pitch - base.pitch) > 11 || Math.abs(cur.g.turn - base.turn) > 0.4;
    const sIn = (u - hIn) * toS, sOut = (u - b - lead) * toS;
    cands.push({
      start: hIn - u, w, we, kind: e.kind, x: E('x', se), y: E('y', se), turn: E('turn', sh), pitch: E('pitch', sh),
      lid: Math.max(bigShift ? lidCurve(since - 0.1) : 0, bigIn ? Math.max(lidCurve(sIn), lidCurve(sOut)) : 0),
    });
  }
  if (!cands.length) return null;
  // overlapping encounters: the one that started later is laid over the earlier one by its own weights (continuous)
  cands.sort((p, q) => p.start - q.start);
  const A = GAZE.ahead, o = { w: 0, we: 0, x: A.x, y: A.y, turn: 0, pitch: 0, kind: null, lid: 0 };
  let kw = -1;
  for (const c of cands) {
    o.x = lerp(o.x, c.x, c.we); o.y = lerp(o.y, c.y, c.we);
    o.turn = lerp(o.turn, c.turn, c.w); o.pitch = lerp(o.pitch, c.pitch, c.w);
    o.w = 1 - (1 - o.w) * (1 - c.w); o.we = 1 - (1 - o.we) * (1 - c.we);
    o.lid = Math.max(o.lid, c.lid);
    if (c.we >= kw * 0.999) { kw = c.we; o.kind = c.kind; }
  }
  // o.* are already blended against 'ahead' (0 pitch / turn): renormalise so the caller's lerp by w lands on o
  if (o.w > 1e-6) { o.turn /= o.w; o.pitch /= o.w; } else { o.turn = 0; o.pitch = 0; }
  if (o.we > 1e-6) { o.x = A.x + (o.x - A.x) / o.we; o.y = A.y + (o.y - A.y) / o.we; }
  return o;
}

// ---------------------------------- helpers ----------------------------------
function hopCrankOffset(tau, phi, omega) {
  // Cranks swing to level before takeoff, stay level in the air, then re-engage. Display = phiA + S(τ);
  // S is C1 (Hermite), starts with slope ω and ends with slope ω, and the total re-engagement differs
  // from the true crank by a whole turn (2πk), so after the window the offset is invisible.
  const { level: t1, hold: t2, release } = hopT, tb = t2 + release;
  if (tau < 0 || tau >= tb) return 0;
  const phiA = phi - omega * tau;
  const n = Math.round((phiA + omega * t1 / 2) / Math.PI);
  const r1 = n * Math.PI - phiA;
  const k = Math.round((r1 + omega * release / 2 - omega * tb) / TAU);
  const rEnd = omega * tb + TAU * k;
  let S;
  if (tau < t1) S = hermite(0, omega, r1, 0, t1, tau / t1);
  else if (tau < t2) S = r1;
  else S = hermite(r1, 0, rEnd, omega, release, (tau - t2) / release);
  return S - omega * tau;
}
// Belly ellipse (body slot art, pelvis-local centre (32,−50), rx 98, ry 58, rot −18°), scaled by (sx, sy)
// in slot-local space, rotated by the body rotation. Returns the lowest point relative to the pelvis.
export function bellyLow(bodyRot, sx = 1, sy = 1) {
  const a = -18 * D2R, b = bodyRot * D2R;
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  // local = S·(c + Ra·(rx cosθ, ry sinθ)); world = Rb·local
  const cx = 32 * sx, cy = -50 * sy;
  const m = [[sx * ca * 98, -sx * sa * 58], [sy * sa * 98, sy * ca * 58]];     // columns: cosθ, sinθ
  const y0 = sb * cx + cb * cy, y1 = sb * m[0][0] + cb * m[1][0], y2 = sb * m[0][1] + cb * m[1][1];
  const x0 = cb * cx - sb * cy, x1 = cb * m[0][0] - sb * m[1][0], x2 = cb * m[0][1] - sb * m[1][1];
  const r = Math.hypot(y1, y2), c = y1 / r, s = y2 / r;
  return { x: x0 + x1 * c + x2 * s, y: y0 + r, curv: r };
}

// ================================================================================================
export function solvePose(t, s = {}) {
  const cadence = s.cadence ?? 60;
  const phiRaw = s.crank ?? 0;
  const speed = s.speed ?? (cadence / 60) * DIST_PER_REV;
  const distance = s.distance ?? 0;
  const events = s.events || [];
  const loopT = s.loopT;
  // 24 s drift terms: k cycles per 24 s live; with a baked loop the nearest whole number of cycles per loopT, so every
  // drift closes exactly at the bake seam (no seam cross-fade on the bars / head / feathers)
  const W24 = k => loopT ? TAU * Math.max(1, Math.round(k * loopT / 24)) / loopT : TAU * k / 24;
  const coasting = !!s.coasting;
  const J = {};
  const omega = coasting ? 0 : (TAU * cadence) / 60;          // crank rad/s

  // ---------------- 1. drives ----------------
  // coast / pedal markers → crank level weight
  let coastW = coasting ? 1 : 0, crankOff = 0, coastT = coasting ? 99 : 0;
  {
    let last = null;
    for (const e of events) if ((e.type === 'coast' || e.type === 'pedal') && e.t0 <= t && (!last || e.t0 >= last.t0)) last = e;
    const lvl = TIMING.coast.level;
    if (coasting) {
      if (last && last.type === 'coast') { coastT = t - last.t0; coastW = smooth01(coastT / lvl); }
      const L = Math.round(phiRaw / Math.PI) * Math.PI;
      crankOff = (L - phiRaw) * coastW;
    } else if (last && last.type === 'pedal' && t - last.t0 < lvl) {
      const tp = t - last.t0, wp = smooth01(tp / lvl), phiC = phiRaw - omega * tp;
      crankOff = (Math.round(phiC / Math.PI) * Math.PI - phiC) * (1 - wp);
      coastW = 1 - wp;
    }
  }
  const hops = accepted(events, 'hop', hopT.gap, t, TIMING.hop.dur + 1);
  for (const tau of hops) crankOff += hopCrankOffset(tau, phiRaw, omega);
  const phi = phiRaw + crankOff;
  const pedalling = 1 - coastW;
  const cadN = smoothstep(40, 90, cadence) * pedalling;       // 0 stroll … 1 sprint (pedalling only)
  const sprint = smoothstep(62, 96, cadence) * pedalling;
  const wind = clamp(speed / 1885, 0, 1.6);                   // relative airspeed
  const psiD = (TAU * distance) / DIST_PER_REV;               // distance phase: integer harmonics only
  const gRider = gust(t, 760, loopT);

  // ---------------- 2. events ----------------
  let riderY = 0, bikePitch = 0, sitEv = 0, leanEv = 0, surprise = 0, stretch = 0, tyre = 0, airborne = 0;
  let landKick = 0, landKickSlow = 0, basket = 0;
  for (const tau of hops) {
    const u = tau - hopT.takeoff;
    const tl = tau - hopT.land;
    if (u > 0 && u < hopT.air) riderY += -(hopT.v0 * u - 0.5 * G * u * u);
    airborne = Math.max(airborne, smooth01((u + 0.08) / 0.1) * (1 - smooth01(tl / 0.15)));
    const squash = impulse(tl, 3.2, TAU * 7, 0.55);           // tyres: ~2 u flat spot, one small rebound
    riderY += squash; tyre = Math.max(tyre, squash);
    bikePitch += track(K.hopPitch, tau) + impulse(tl - 0.05, 0.5, TAU * 6, 0.45);
    sitEv += track(K.hopSit, tau) + impulse(tl, 10.2, TAU * 2.6, 0.42);
    leanEv += track(K.hopLean, tau) + impulse(tl, 3, TAU * 2.2, 0.4);
    surprise = Math.max(surprise, track(K.hopSurp, tau));
    stretch += track(K.hopStretch, tau) - impulse(tl, 1.5, TAU * 3, 0.4);
    landKick += impulse(tl, 1, TAU * 3.2, 0.32);
    landKickSlow += impulse(tl, 1, TAU * 1.8, 0.3);
    basket += impulse(tl - 0.07, 6, TAU * 4.5, 0.3);          // fish in the basket bounce half a beat late
  }
  // vertical velocity of the rider (world, + = down) for the scarf / crest drag
  const vRider = tt => { let v = 0; for (const e of events) if (e.type === 'hop') { const u = tt - e.t0 - hopT.takeoff; if (u > 0 && u < hopT.air) v += -(hopT.v0 - G * u); } return v; };

  const bells = accepted(events, 'bell', 0.12, t, TIMING.bell.dur);
  let flick = 0, squint = 0, steerEv = 0;
  for (const tau of bells) { flick += track(K.bellFlick, tau); squint = Math.max(squint, track(K.bellSquint, tau)); steerEv += impulse(tau - 0.1, 0.8, TAU * 6, 0.3); }
  const waves = accepted(events, 'wave', TIMING.wave.gap, t, TIMING.wave.dur);
  const wv = { u: 0, dip: 0, hand: 0, env: 0, look: 0, lean: 0, steer: 0, tau: 0 };
  for (const tau of waves) Object.assign(wv, { u: track(K.waveU, tau), dip: track(K.waveDip, tau), hand: track(K.waveHand, tau), env: track(K.waveEnv, tau), look: track(K.waveLook, tau), lean: track(K.waveLean, tau), steer: track(K.waveSteer, tau), tau });
  const gulps = accepted(events, 'gulp', TIMING.gulp.gap, t, 8);
  const gl = { open: 0, psy: 1, psx: 1, lean: 0, bulgeT: 0, bulgeA: 0, inBill: 0, inPouch: 0, fishRot: 20, taken: 0, drip: 0, delight: 0, look: 0, tau: -1 };
  for (const tau of gulps) {
    gl.taken = Math.max(gl.taken, track(K.gTaken, tau));
    if (tau > TIMING.gulp.dur + 0.4) continue;
    Object.assign(gl, {
      open: track(K.gOpen, tau), psy: track(K.gPsy, tau), psx: track(K.gPsx, tau), lean: track(K.gLean, tau),
      bulgeT: track(K.gBulgeT, tau), bulgeA: track(K.gBulgeA, tau), inBill: track(K.gInBill, tau), inPouch: track(K.gInPouch, tau),
      fishRot: track(K.gFishRot, tau), drip: track(K.gDrip, tau), delight: track(K.gDelight, tau), look: track(K.gLookBasket, tau), tau,
    });
  }
  // coasting idle: every 9 s of coasting the pelican stretches its pouch
  let pStretch = 0;
  if (coasting && coastT < 90 && coastT > 1.5) pStretch = track(K.cStretch, wrap(coastT - 1.5, 9));

  // Non-periodic head drive (events + gaze), pure in time → followers can sample its past.
  const gz0 = gazeAt(t, loopT);
  // director encounters (live / renderAt only: the baked loop keeps its exact 24 s periodicity)
  const encAt = tt => (loopT || s.director === false ? null : encounterLook(distance - (t - tt) * speed, speed, s.tod));
  const enc0 = loopT || s.director === false ? null : encounterLook(distance, speed, s.tod, gz0);
  const lookW = Math.max(wv.look, gl.look);
  const headDrive = tt => {
    let dx = 0, dy = 0, r = 0;
    for (const e of events) {
      const tau = tt - e.t0;
      if (tau < 0) continue;
      if (e.type === 'gulp' && gulps.includes(t - e.t0) && tau < 2.7) {
        dx += track(K.gHx, tau); dy += track(K.gHy, tau); r += track(K.gHr, tau);
        const sh = track(K.gShake, tau); if (sh) r += 4 * sh * Math.sin(TAU * 6.5 * (tau - 1.95));
      } else if (e.type === 'bell' && tau < 0.8) { r += impulseSoft(tau - 0.1, 7, TAU * 3, 0.45); dy += impulseSoft(tau - 0.1, 2, TAU * 3, 0.45); }
      else if (e.type === 'hop' && tau < 1.4) { dy += track(K.hopHead, tau) + impulse(tau - hopT.land, 11, TAU * 2.8, 0.4); r += impulse(tau - hopT.land, 5, TAU * 2.4, 0.4); }
      else if (e.type === 'wave' && tau < 2.7) r += -4 * track(K.waveLook, tau);
    }
    const g = tt === t ? gz0 : gazeAt(tt, loopT);
    const lw = tt === t ? lookW : 0;
    const E = tt === t ? enc0 : encAt(tt);
    const ew = E ? E.w : 0;
    r += lerp(g.pitch, E ? E.pitch : 0, ew) * (1 - lw) * (1 - 0.6 * sprint);
    return { dx, dy, r, turn: lerp(g.turn, E ? E.turn : 0, ew) };
  };
  const memo = new Map();
  const HD = tt => { let v = memo.get(tt); if (!v) { v = headDrive(tt); memo.set(tt, v); } return v; };
  const hd = HD(t);
  const fHeadR = (wn, z, sp) => follow(tt => HD(tt).r, t, wn, z, 10, sp);
  const fHeadY = (wn, z, sp) => follow(tt => HD(tt).dy, t, wn, z, 10, sp);

  // ---------------- 3. gaze, face ----------------
  let gz = { ...gz0 };
  const over = (target, w) => { if (w <= 0) return; const T = GAZE[target]; gz.x = lerp(gz.x, T.x, w); gz.y = lerp(gz.y, T.y, w); gz.turn = lerp(gz.turn, T.turn, w); };
  if (enc0) { gz.x = lerp(gz.x, enc0.x, enc0.we); gz.y = lerp(gz.y, enc0.y, enc0.we); gz.turn = lerp(gz.turn, enc0.turn, enc0.w); if (enc0.we > 0.5) gz0.target = enc0.kind; }
  over('ahead', 0.6 * sprint);
  over('camera', wv.look);
  over('basket', gl.look);
  if (gl.tau > 0.6 && gl.tau < 1.4) over('sky', smooth01((gl.tau - 0.6) / 0.25) * (1 - smooth01((gl.tau - 1.2) / 0.2)));
  if (airborne) over('road', 0.6 * surprise);
  const bl = blinkAt(t, loopT, gz0);
  // Birds blink through a fast head turn: the lid closes with the rate of the combined gaze-driven head move
  // (base schedule + encounters) over the last 120 ms, so any turn over ~15° gets a full blink and small ones none.
  if (enc0 || encAt(t - 0.3)) {
    const gh = tt => { const g = gazeAt(tt, loopT), E = tt === t ? enc0 : encAt(tt), w = E ? E.w : 0; return [lerp(g.pitch, E ? E.pitch : 0, w), lerp(g.turn, E ? E.turn : 0, w)]; };
    const [p1, u1] = gh(t), [p0, u0] = gh(t - 0.12);
    bl.lid = Math.max(bl.lid, smooth01((Math.max(Math.abs(p1 - p0), 16 * Math.abs(u1 - u0)) - 3.2) / 2.8));
  }
  const breath = Math.sin(W24(7) * t);             // 17.5 breaths / min, loop-exact
  const delight = gl.delight;
  const focus = sprint * (1 - delight);
  const content = clamp(1 - focus - surprise - delight, 0, 1);
  const lidRest = 0.14 * content + 0.38 * focus + 0.85 * delight + 0.45 * squint - 0.14 * surprise;
  const lid = clamp(Math.max(lidRest, bl.lid), 0, 1);
  const face = {
    lid, nict: bl.nict, squint, brow: clamp(0.25 * content - 0.7 * focus + 1.0 * surprise + 0.35 * delight - 0.3 * squint, -1, 1),
    smile: clamp(0.35 * content + 0.1 * focus + 1.0 * delight + 0.6 * wv.look + 0.3 * squint, 0, 1),
    mood: { content, focus, surprise, delight }, pupil: 1 + 0.18 * surprise - 0.1 * focus,
  };
  if (enc0) { face.brow = clamp(face.brow + 0.3 * enc0.we, -1, 1); face.pupil += 0.08 * enc0.we; }   // interest: brow up, pupil wide

  // ---------------- 4a. body on the saddle ----------------
  const bobA = (0.8 + 0.6 * smoothstep(30, 90, cadence)) * pedalling;
  const w2 = 2 * Math.max(omega, TAU * 20 / 60);               // bob drive frequency (rad/s)
  const th0 = 20 * D2R;                                        // pelvis low point 10° after 3 o'clock (near) / 9 o'clock (far)
  const phi2 = 2 * phi;
  const bobP = phasor(bobA, th0);
  const lean = FIT.lean + 4.5 * cadN - 3 * coastW + leanEv + wv.lean + gl.lean + 0.5 * bobA * Math.cos(phi2 - th0 - 0.4);
  const rock = 0.95 * (0.6 + 0.6 * sprint) * pedalling * Math.cos(phi - 10 * D2R);   // hip rocks toward the pushing leg
  const bodyRot = lean + rock;
  const sq = stretch, bodySy = (1 + 0.045 * sq) * (1 + 0.011 * breath), bodySx = (1 - 0.045 * sq) * (1 + 0.005 * breath);
  const depth = softMax(0.6, FIT.sit + evalPh(bobP, phi2) + sitEv + 0.35 * sprint, 0.35);
  const low = bellyLow(bodyRot, bodySx, bodySy);
  const pelvisY = BIKE.saddleTop[1] + depth - low.y;
  const pelvis = { p: [SKEL.pelvis[0] + FIT.dx - 1.5 * cadN, pelvisY], r: bodyRot };
  const pelvisDy = pelvisY - SKEL.pelvis[1];
  J.body = { x: pelvis.p[0], y: pelvis.p[1], rot: bodyRot, sx: bodySx, sy: bodySy };

  // ---------------- 4b. bike: rotating parts + steering ----------------
  const wheelDeg = (distance / BIKE.R) * R2D;
  J.wheelRear = { x: BIKE.rearHub[0], y: BIKE.rearHub[1], rot: wrap(wheelDeg, 360) };
  J.wheelFront = { x: BIKE.frontHub[0], y: BIKE.frontHub[1], rot: wrap(wheelDeg, 360) };
  J.cog = { x: BIKE.rearHub[0], y: BIKE.rearHub[1], rot: wrap(3 * phi * R2D, 360) };   // freehub body turns with the chain
  J.chainring = { x: BIKE.bb[0], y: BIKE.bb[1], rot: wrap(phi * R2D, 360) };
  J.frame = { x: 0, y: 0, rot: 0 };
  J.fork = { x: 0, y: 0, rot: 0 };
  J.chain = { x: 0, y: 0, rot: 0 };
  const chainOffset = -wrap((BIKE.ringT * phi) / TAU, 100);
  // steering: once-per-crank correction against the pedal torque + slow loop-exact drift; the far wing
  // takes over the steering during the wave (bigger, slower corrections)
  const steer = (0.35 * Math.sin(phi - 0.6) * pedalling
    + 0.28 * Math.sin(W24(7) * t + 1.1) + 0.16 * Math.sin(W24(17) * t + 2.3)) * (0.5 + 0.5 * clamp(wind, 0, 1.2))
    + wv.steer * (1.3 * Math.sin(TAU * 1.3 * wv.tau) + 0.5 * Math.sin(TAU * 2.9 * wv.tau + 1)) + steerEv + 0.6 * gRider * Math.sin(W24(42) * t);
  const piv = [BIKE.steererTop[0], BIKE.steererTop[1]];
  const steerAt = P => add(piv, rot([P[0] - piv[0], P[1] - piv[1]], steer));
  const barsO = steerAt([0, 0]);
  J.bars = { x: barsO[0], y: barsO[1], rot: steer };
  const grips = { Near: steerAt(BIKE.gripNear), Far: steerAt(BIKE.gripFar) };

  // ---------------- 4c. legs ----------------
  const ankAmp = (9 + 4 * sprint - 1.5 * (1 - cadN)) * pedalling * (1 - airborne * 0.7);
  const ankBase = lerp(8, 3, coastW);
  const feet = {};
  const legs = [['Near', SKEL.hipNear, 0], ['Far', SKEL.hipFar, Math.PI]];
  for (const [side, hipOff, dphi] of legs) {
    const a = phi + dphi;
    const pedal = add(BIKE.bb, [BIKE.crank * Math.cos(a), BIKE.crank * Math.sin(a)]);
    const alpha = ankBase + ankAmp * Math.cos(a - 135 * D2R);     // + = toe down
    const ankle = add(pedal, rot([-SKEL.footBall[0], -SKEL.footBall[1]], alpha));
    const hip = at(pelvis, hipOff);
    const k = ik2(hip[0], hip[1], ankle[0], ankle[1], SKEL.thigh, SKEL.shank, -1);
    J['thigh' + side] = { x: hip[0], y: hip[1], rot: k.a1 * R2D };
    J['shank' + side] = { x: k.joint[0], y: k.joint[1], rot: k.a2 * R2D };
    J['foot' + side] = { x: k.end[0], y: k.end[1], rot: alpha };
    J['pedal' + side] = { x: pedal[0], y: pedal[1], rot: alpha };
    J['crank' + side] = { x: BIKE.bb[0], y: BIKE.bb[1], rot: wrap(a * R2D, 360) };
    const afterTDC = wrap(a * R2D + 90, 360);                   // 0 = top dead centre
    const press = pedalling * Math.max(0, Math.sin((afterTDC / 180) * Math.PI)) ** 1.5 * (0.7 + 0.3 * sprint);
    feet[side] = { press, curl: clamp(0.25 + 0.6 * press + 0.3 * airborne + 0.2 * landKick, 0, 1), afterTDC };
  }

  // ---------------- 4d. wings ----------------
  const wing = {};
  const wings = [['Near', SKEL.shoulderNear], ['Far', SKEL.shoulderFar]];
  for (const [side, shOff] of wings) {
    const sh = at(pelvis, shOff);
    const grip = grips[side];
    let target = grip, handRot = SKEL.handRot + steer + 0.8 * bobA * Math.cos(phi2 - th0 - 0.9);
    let open = 0, primLag = 0;
    if (side === 'Near' && (wv.u > 0 || wv.dip > 0)) {
      // polar arc about the shoulder (never drags the hand through the chest); the anticipation dip sinks the wrist
      const g = [grip[0] - sh[0], grip[1] - sh[1]];
      const ga = Math.atan2(g[1], g[0]), gr = Math.hypot(g[0], g[1]);
      const osc = wv.env * Math.sin(TAU * 2.4 * (wv.tau - 0.8));
      const wa = Math.atan2(-68, 106) + 0.14 * osc, wr = 124 - 4 * Math.abs(osc);   // raised forward of the chest, clear of the neck
      const u = wv.u, arcIn = Math.sin(Math.PI * u) * 10;           // radius tucks mid-arc → a real arc, not a lerp
      const ang = ga + (wa - ga) * u, rad = gr + (wr - gr) * u - arcIn;
      target = [sh[0] + rad * Math.cos(ang) - 3 * wv.dip, sh[1] + rad * Math.sin(ang) + 7 * wv.dip];
      open = clamp(u * 1.1, 0, 1); primLag = -wv.env * 14 * Math.cos(TAU * 2.4 * (wv.tau - 0.8) - 1.2);
    }
    // the hand lags the wrist by ~70° of the wave cycle (follow-through in the primaries); additive so the
    // hand rotation is continuous in and out of the wave
    if (side === 'Near') handRot += wv.hand + wv.env * 24 * Math.sin(TAU * 2.4 * (wv.tau - 0.8) - 1.2);
    if (side === 'Near') handRot += 4 * flick;
    const k = ik2(sh[0], sh[1], target[0], target[1], SKEL.wingUpper, SKEL.wingLower, +1);
    J['wing' + side + 'Upper'] = { x: sh[0], y: sh[1], rot: k.a1 * R2D };
    J['wing' + side + 'Lower'] = { x: k.joint[0], y: k.joint[1], rot: k.a2 * R2D };
    J['wing' + side + 'Hand'] = { x: k.end[0], y: k.end[1], rot: handRot };
    const flutter = wind * (0.8 * Math.sin(5 * psiD + (side === 'Near' ? 0 : 1.3)) + 0.5 * Math.sin(9 * psiD + 0.7)) + 3 * gust(t, 794, loopT) * Math.sin(W24(99) * t);
    wing[side] = {
      open, primLag: primLag + flutter, thumb: side === 'Near' ? flick : 0,
      grip: side === 'Near' ? clamp(1 - wv.u * 1.2, 0, 1) : 1, relax: coastW,
      covertLift: 1.2 * gust(t, 740, loopT) + 0.4 * wind * Math.sin(3 * psiD + 2),
    };
  }

  // ---------------- 5. head, face slots ----------------
  const headBob = child(phasor(0.25 * bobA, th0), w2, TAU * 1.8, 0.6);          // stabilised head: 25% of the bob, lagged
  const headP = add(FIT.head, [hd.dx + 10 * cadN - 4 * coastW, hd.dy + evalPh(headBob, phi2) + 7 * cadN - 0.6 * breath]);
  // half-time nod to the beat: the head dips 25° of crank after the near leg's push (once per crank turn, so it
  // reads as nodding along to the cadence-locked track); the crest and pouch lag it. Fades while sprinting,
  // looking at something, airborne or coasting.
  const nodA = 1.8 * pedalling * (1 - 0.6 * sprint) * (1 - lookW) * (1 - airborne) * (1 - 0.5 * (enc0 ? enc0.w : 0));
  const nodTh = 25 * D2R, nod = nodA * (0.85 * Math.cos(phi - nodTh) + 0.15 * Math.cos(2 * (phi - nodTh)));
  const nodLag = nodA * Math.cos(phi - nodTh - 0.55);
  const headR = hd.r + nod - 0.5 * rock + 2 * cadN - 2 * coastW + 2 * delight * Math.sin(TAU * 0.9 * (gl.tau - 1.7)) * (gl.tau > 1.7 ? 1 : 0);
  const head = { p: headP, r: headR };
  J.head = { x: headP[0], y: headP[1], rot: headR };
  const eyeP = at(head, SKEL.eye);
  const blink = 1 - 0.92 * lid;
  J.eye = { x: eyeP[0], y: eyeP[1], rot: headR, sx: 1 + 0.1 * surprise - 0.05 * squint, sy: Math.max(0.08, blink * (1 + 0.1 * surprise)) };

  // head-drive followers (transients): angle (deg) and vertical (u) lags at several stiffnesses
  const fR1 = fHeadR(TAU * 3.2, 0.32, 0.5), fR2 = fHeadR(TAU * 2.2, 0.3, 0.7), fR3 = fHeadR(TAU * 1.6, 0.28, 0.9);
  const fY1 = fHeadY(TAU * 3.2, 0.32, 0.5), fYp = fHeadY(TAU * 2.0, 0.25, 0.8);

  // crest: root + 2 bend segments (tips lag the root). Pedalling part = phasor chain from the head.
  const crestRootP = child(headBob, w2, TAU * 2.2, 0.28, 16), crestMidP = child(crestRootP, w2, TAU * 2.6, 0.3, 0.8), crestTipP = child(crestMidP, w2, TAU * 3.0, 0.3, 0.8);
  const vFall = tt => vRider(tt);
  const fV = follow(vFall, t, TAU * 2.4, 0.3, 28, 0.7) + vFall(t);            // lagged world vertical velocity
  const crestFlat = -(3 + 5 * clamp(wind, 0, 1.6)) - 6 * gRider;              // wind presses the crest flat (monotonic in speed)
  const crestFlut = wind * 1.2 * Math.sin(7 * psiD) + gRider * 4 * Math.sin(W24(126) * t);
  const crestRoot = crestFlat - 0.8 * nodLag + evalPh(crestRootP, phi2) + 0.8 * fR1 - 1.1 * fY1 + 12 * surprise + 0.012 * fV + 5 * landKick + crestFlut;
  const crestBend = [
    evalPh(crestMidP, phi2) + 0.5 * (fR2 - fR1) + 0.008 * fV + 4 * landKickSlow + 1.4 * crestFlut + 3 * surprise,
    evalPh(crestTipP, phi2) + 0.6 * (fR3 - fR2) + 0.01 * fV + 3 * landKickSlow + 1.8 * crestFlut + 2 * surprise,
  ];
  const crestP = at(head, SKEL.crest);
  J.crest = { x: crestP[0], y: crestP[1], rot: headR + SKEL.crestRot + crestRoot };

  // bill: the gulp opens mostly the LOWER jaw; gular flutter at noon; coasting pouch stretch
  const noon = s.tod !== undefined ? smoothstep(0.38, 0.45, s.tod) * (1 - smoothstep(0.55, 0.62, s.tod)) : 0;
  const flutterG = noon * pedalling * 0.028 * Math.sin(TAU * 5 * t);
  const billOpen = gl.open + 10 * pStretch + 2 * noon + 3 * surprise * airborne;
  const bu = at(head, SKEL.billUpper), blp = at(head, SKEL.billLower);
  J.billUpper = { x: bu[0], y: bu[1], rot: headR + SKEL.billRot - billOpen * 0.22 };
  const lowerR = headR + SKEL.billRot + billOpen;
  J.billLower = { x: blp[0], y: blp[1], rot: lowerR };
  const lower = { p: blp, r: lowerR };
  const pouchP = at(lower, SKEL.pouch);
  // pouch: heavier and slower than the crest (different ωn / ζ, so the two never phase-lock)
  const pouchPh = child(headBob, w2, TAU * 1.6, 0.22, 0.05);
  const jig = evalPh(pouchPh, phi2) + 0.01 * fYp + 0.1 * landKickSlow - 0.0002 * fV;
  J.pouch = {
    x: pouchP[0], y: pouchP[1], rot: lowerR - 0.4 * nodLag + 0.35 * follow(tt => HD(tt).r, t, TAU * 1.6, 0.25, 10, 0.8),
    sx: gl.psx * (1 - 0.35 * jig) * (1 - 0.08 * pStretch), sy: gl.psy * (1 + jig + flutterG) * (1 + 0.3 * pStretch),
  };

  // ---------------- tail ----------------
  const tailP0 = child(bobP, w2, TAU * 3.2, 0.5, 1.6);
  const bodyDriveR = tt => { let r = 0; for (const e of events) { const tau = tt - e.t0; if (tau < 0) continue; if (e.type === 'hop') r += track(K.hopLean, tau); else if (e.type === 'gulp' && tau < 2.7) r += track(K.gLean, tau); else if (e.type === 'wave' && tau < 2.7) r += track(K.waveLean, tau); } return r; };
  const tailSpring = evalPh(tailP0, phi2) + 1.2 * follow(bodyDriveR, t, TAU * 2.6, 0.35, 10, 0.6) - 0.01 * fV + 7 * landKick
    + wind * 0.8 * Math.sin(4 * psiD + 0.5) + gust(t, 600, loopT) * 3 * Math.sin(W24(90) * t);
  const tailP = at(pelvis, SKEL.tail);
  J.tail = { x: tailP[0], y: tailP[1], rot: bodyRot + SKEL.tailRot + tailSpring };

  // ---------------- neck deformer ----------------
  const p0 = add(at(pelvis, SKEL.neckBase), [6 * cadN, 2 * cadN]);
  const p3 = add(headP, rot([-14, 10], headR));
  const headRLag = headR + 0.7 * fR1;                             // the neck follows the head (successive breaking)
  const reach = smooth01(clamp((headP[1] - FIT.head[1]) / 90, 0, 1));
  const p1 = add(p0, rot([30 + 12 * reach, -58 - 6 * reach], 0.4 * (bodyRot - FIT.lean)));
  const p2 = add(p3, rot([-58, 34], 0.6 * headRLag - 40 * reach));
  const neck = {
    p0, p1, p2, p3, w0: 34 + 0.6 * breath, w1: 24 + 0.3 * breath,
    bulgeT: gl.bulgeT, bulgeA: gl.bulgeA, bulgeW: 13 * gl.bulgeA,     // swallowed-fish bulge travelling DOWN (t: 1 = head → 0 = base)
  };
  J.neck = { x: 0, y: 0, rot: 0 };

  // ---------------- scarf (knot at the neck base, two tails) ----------------
  const B = (u, a, b, c, d) => (1 - u) ** 3 * a + 3 * (1 - u) ** 2 * u * b + 3 * (1 - u) * u * u * c + u ** 3 * d;
  const nb = u => [B(u, p0[0], p1[0], p2[0], p3[0]), B(u, p0[1], p1[1], p2[1], p3[1])];
  const kn = nb(0.16), kn2 = nb(0.19), tan = Math.atan2(kn2[1] - kn[1], kn2[0] - kn[0]);
  const nrm = [Math.sin(tan), -Math.cos(tan)];                  // points to the back of the neck (left of travel)
  const wK = lerp(neck.w0, neck.w1, 0.16) / 2;
  const stream = smoothstep(0, 1.1, wind);
  const liftV = clamp(0.075 * fV, -35, 60);                      // falls → streams up; rises → trails down
  const scarfPh = child(bobP, w2, TAU * 1.4, 0.3, 3.2);
  const gS = gust(t, 730, loopT);
  const mkTail = (n, len, base, droop, ph0, salt) => {
    const a = [];
    let prevLag = scarfPh;
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1);
      prevLag = i === 0 ? prevLag : child(prevLag, w2, TAU * 3.5, 0.45, 1.12);
      const baseA = lerp(droop - 7 * i, base + 2 * i, stream);
      const flut = (0.8 + 2.4 * f) * wind * Math.sin(3 * psiD - 0.9 * i + ph0) + (0.4 + 1.6 * f) * wind * Math.sin(8 * psiD - 1.4 * i + salt)
        + gS * (6 + 10 * f) * Math.sin(W24(75) * t - 1.1 * i + salt);
      const lift = liftV * (0.35 + 0.65 * f) - 8 * landKickSlow * f + 6 * gS * f;
      a.push(baseA + evalPh(prevLag, phi2) * (0.4 + f) + flut + lift - 3 * coastW * f);
    }
    return { a, len };
  };
  const tA = mkTail(6, 19, 184, 118, 0, 0.3), tB = mkTail(4, 15, 160, 100, 1.9, 2.1);
  const scarf = {
    x: kn[0], y: kn[1], neckAng: tan * R2D, wrapW: 2 * wK,
    tails: [
      { x: kn[0] + nrm[0] * wK * 0.9, y: kn[1] + nrm[1] * wK * 0.9, ...tA },
      { x: kn[0] - nrm[0] * wK * 0.2, y: kn[1] - nrm[1] * wK * 0.2 + 4, ...tB },
    ],
  };

  // ---------------- fish (gulp) ----------------
  const tipLocal = rot([112, 7], lowerR);
  const fish = {
    taken: gl.taken, inBill: gl.inBill, inPouch: gl.inPouch, pouchRot: gl.fishRot, drip: gl.drip,
    x: blp[0] + tipLocal[0], y: blp[1] + tipLocal[1], rot: lowerR + 90,
  };

  const wheelRevPerSec = speed / (TAU * BIKE.R);
  return {
    joints: J, neck, chainOffset, wheel: wheelDeg, crank: phi * R2D, riderY, bikePitch, blink, pelvisDy,
    spokeBlur: smoothstep(0.6, 1.4, wheelRevPerSec),
    // ---- added fields (documented in the rig report) ----
    steer, gaze: { x: gz.x, y: gz.y, turn: gz.turn, target: lookW > 0.5 ? (wv.look > gl.look ? 'camera' : 'basket') : gz0.target },
    nod, face, crestBend, scarf, fish, wing, feet, breath,
    bill: { open: billOpen, flutter: flutterG },
    hop: { air: airborne, surprise, compress: sitEv }, tyre: { rear: Math.max(0, tyre), front: Math.max(0, tyre) * 0.8 },
    saddle: clamp(depth, 0, 8), belly: { x: pelvis.p[0] + low.x, depth }, basket, bell: { flick, strike: bells.some(tau => tau >= 0.1 && tau < 0.135) },
    coast: coastW, sprint, effort: cadN, wind, gust: gRider, freewheel: coasting || Math.abs(crankOff) > 1e-6,
  };
}
