// solvePose(t, s): PURE pose function (no DOM, importable in node). See docs/rig-spec.md §2–§3.
// s = { crank: rad (unwrapped ok), distance, cadence (rpm), speed (units/s), coasting, events: [{type, t0}] }
// -> { joints: {slot: {x,y,rot,sx?,sy?}} (rider space, deg), neck: {p0,p1,p2,p3,w0,w1}, chainOffset, wheel, crank,
//      riderY, bikePitch, blink, spokeBlur, pelvisDy }
import { BIKE, SKEL, DIST_PER_REV } from '../contract.js';
import { DEG, TAU, smoothstep, clamp, wrap, rot, add } from '../core/math.js';
import { ik2 } from './ik.js';
import { bobDriven, impulse, kicks } from './secondary.js';

const W = deg => deg / DEG;
// compose a frame {p:[x,y], r:deg} with a child offset in the parent's frame
const at = (F, off) => add(F.p, rot(off, F.r));

function eventWeight(t, events, type, dur, fadeIn = 0.3, fadeOut = 0.4) {
  let w = 0, tau = -1;
  for (const e of events || []) if (e.type === type) {
    const k = t - e.t0; if (k >= 0 && k <= dur) { w = Math.max(w, smoothstep(0, fadeIn, k) * (1 - smoothstep(dur - fadeOut, dur, k))); tau = k; }
  }
  return { w, tau };
}

export function solvePose(t, s = {}) {
  const cadence = s.cadence ?? 60;
  const phi = s.crank ?? 0;                          // crank angle, clockwise from +x
  const distance = s.distance ?? 0;
  const events = s.events || [];
  const J = {};

  // ---- hop (spec §3) ----
  let riderY = 0, bikePitch = 0, crouch = 0, bodySy = 1;
  for (const e of events) if (e.type === 'hop') {
    const tau = t - e.t0;
    if (tau >= 0 && tau < 0.15) { const u = tau / 0.15; crouch = 6 * Math.sin(u * Math.PI / 2); bodySy = 1 - 0.04 * Math.sin(u * Math.PI / 2); }
    else if (tau >= 0.15 && tau < 0.75) {
      const u = (tau - 0.15) / 0.6;
      riderY = -58 * Math.sin(Math.PI * u);
      bikePitch = -7 * Math.sin(TAU * u) * (u > 0.5 ? 0.6 : 1);
      crouch = 6 * (1 - smoothstep(0, 0.25, u)) - 4 * Math.sin(Math.PI * u);
    }
  }
  const landEvents = events.filter(e => e.type === 'hop').map(e => ({ type: 'land', t0: e.t0 + 0.75 }));
  const allEv = events.concat(landEvents);

  // ---- body bob / sway ----
  const coast = s.coasting ? 0.25 : 1;
  const bob = 2.5 * Math.cos(2 * phi) * coast;
  const sway = 1.5 * Math.sin(phi) * coast;
  const landBump = kicks(t, allEv, 'land', 5, TAU * 3, 0.35);
  const pelvisDy = clamp(bob + crouch + landBump, -4, 6);
  const pelvis = { p: add(SKEL.pelvis, [0, pelvisDy]), r: sway };
  J.body = { x: pelvis.p[0], y: pelvis.p[1], rot: sway, sy: bodySy };

  // ---- tail ----
  const tailSpring = bobDriven(phi, cadence, TAU * 2.4, 0.35, 5) * coast + kicks(t, allEv, 'land', 12, TAU * 2.4, 0.35);
  const tailP = at(pelvis, SKEL.tail);
  J.tail = { x: tailP[0], y: tailP[1], rot: sway + SKEL.tailRot + tailSpring };

  // ---- legs ----
  const legs = [['Near', SKEL.hipNear, 0], ['Far', SKEL.hipFar, Math.PI]];
  for (const [side, hipOff, dphi] of legs) {
    const a = phi + dphi;
    const pedal = add(BIKE.bb, [BIKE.crank * Math.cos(a), BIKE.crank * Math.sin(a)]);
    const alpha = 8 + 10 * Math.cos(a - W(135));     // ankling, deg (+ = toe down)
    const ankle = add(pedal, rot([-SKEL.footBall[0], -SKEL.footBall[1]], alpha));
    const hip = at(pelvis, hipOff);
    const k = ik2(hip[0], hip[1], ankle[0], ankle[1], SKEL.thigh, SKEL.shank, -1);
    J['thigh' + side] = { x: hip[0], y: hip[1], rot: k.a1 * DEG };
    J['shank' + side] = { x: k.joint[0], y: k.joint[1], rot: k.a2 * DEG };
    J['foot' + side] = { x: k.end[0], y: k.end[1], rot: alpha };
    J['pedal' + side] = { x: pedal[0], y: pedal[1], rot: alpha };
    J['crank' + side] = { x: BIKE.bb[0], y: BIKE.bb[1], rot: wrap(a * DEG, 360) };
  }

  // ---- bike rotating parts ----
  const wheelDeg = (distance / BIKE.R) * DEG;
  J.wheelRear = { x: BIKE.rearHub[0], y: BIKE.rearHub[1], rot: wrap(wheelDeg, 360) };
  J.wheelFront = { x: BIKE.frontHub[0], y: BIKE.frontHub[1], rot: wrap(wheelDeg, 360) };
  J.cog = { x: BIKE.rearHub[0], y: BIKE.rearHub[1], rot: wrap(wheelDeg, 360) };
  J.chainring = { x: BIKE.bb[0], y: BIKE.bb[1], rot: wrap(phi * DEG, 360) };
  J.frame = { x: 0, y: 0, rot: 0 };
  // gentle steering wobble on the fork + bars (sub-degree, about the head tube)
  J.fork = { x: 0, y: 0, rot: 0 };
  J.bars = { x: 0, y: 0, rot: 0 };
  J.chain = { x: 0, y: 0, rot: 0 };
  const chainOffset = -wrap((BIKE.ringT * phi) / TAU, 100);

  // ---- wings ----
  const wave = eventWeight(t, events, 'wave', 1.8, 0.3, 0.4);
  const bell = eventWeight(t, events, 'bell', 0.35, 0.05, 0.15);
  const wings = [['Near', SKEL.shoulderNear, BIKE.gripNear], ['Far', SKEL.shoulderFar, BIKE.gripFar]];
  for (const [side, shOff, grip] of wings) {
    const sh = at(pelvis, shOff);
    let target = grip;
    let handRot = SKEL.handRot;
    if (side === 'Near' && wave.w > 0) {
      // polar interpolation about the shoulder (avoids dragging the hand through the chest)
      const g = [grip[0] - sh[0], grip[1] - sh[1]];
      const ga = Math.atan2(g[1], g[0]), gr = Math.hypot(g[0], g[1]);
      const wa = Math.atan2(-115, 55), wr = 127.5;
      const ang = ga + (wa - ga) * wave.w, rad = gr + (wr - gr) * wave.w;
      target = [sh[0] + rad * Math.cos(ang), sh[1] + rad * Math.sin(ang)];
      handRot = SKEL.handRot + wave.w * (-70 + 25 * Math.sin(TAU * 3 * wave.tau));
    }
    if (side === 'Near' && bell.w > 0) handRot += -18 * bell.w;
    const k = ik2(sh[0], sh[1], target[0], target[1], SKEL.wingUpper, SKEL.wingLower, +1);
    J['wing' + side + 'Upper'] = { x: sh[0], y: sh[1], rot: k.a1 * DEG };
    J['wing' + side + 'Lower'] = { x: k.joint[0], y: k.joint[1], rot: k.a2 * DEG };
    J['wing' + side + 'Hand'] = { x: k.end[0], y: k.end[1], rot: handRot };
  }

  // ---- head (stabilised: follows only 25% of the bob, with lag) ----
  const headLag = bobDriven(phi, cadence, TAU * 1.8, 0.6, 0.25 * 2.5) * coast;
  const headLand = kicks(t, allEv, 'land', 6, TAU * 2.2, 0.4);
  const gulp = eventWeight(t, events, 'gulp', 1.4, 0.25, 0.5);
  const nod = kicks(t, events, 'bell', 4, TAU * 3, 0.4) - gulp.w * 28;
  const headP = add(SKEL.head, [0, headLag + headLand + riderY * 0 + crouch * 0.3]);
  const headR = -0.8 * sway + nod;
  const head = { p: headP, r: headR };
  J.head = { x: headP[0], y: headP[1], rot: headR };
  const blinkPh = wrap(t, 3.7);
  const blink = blinkPh < 0.14 ? 1 - Math.sin((blinkPh / 0.14) * Math.PI) : 1;
  const eyeP = at(head, SKEL.eye);
  J.eye = { x: eyeP[0], y: eyeP[1], rot: headR, sx: 1, sy: Math.max(0.08, blink) };
  const crestSpring = bobDriven(phi, cadence, TAU * 4.5, 0.3, 7) * coast + kicks(t, allEv, 'land', 18, TAU * 4.5, 0.3)
    + 3 * Math.sin(7 * TAU * distance / DIST_PER_REV) * clamp(s.speed / 2000, 0, 1.5);
  const crestP = at(head, SKEL.crest);
  J.crest = { x: crestP[0], y: crestP[1], rot: headR + SKEL.crestRot + crestSpring };
  const bu = at(head, SKEL.billUpper), bl = at(head, SKEL.billLower);
  const billOpen = gulp.w * 10 * Math.max(0, Math.sin(Math.PI * clamp(gulp.tau / 0.7, 0, 1)));
  J.billUpper = { x: bu[0], y: bu[1], rot: headR + SKEL.billRot - billOpen * 0.3 };
  J.billLower = { x: bl[0], y: bl[1], rot: headR + SKEL.billRot + billOpen };
  const lower = { p: bl, r: headR + SKEL.billRot + billOpen };
  const pouchP = at(lower, SKEL.pouch);
  const jig = bobDriven(phi, cadence, TAU * 3.0, 0.22, 0.045) * coast + kicks(t, allEv, 'land', 0.12, TAU * 3.0, 0.22);
  const bulge = gulp.w * 0.35 * smoothstep(0.35, 0.7, gulp.tau) * (1 - smoothstep(0.9, 1.4, gulp.tau));
  J.pouch = { x: pouchP[0], y: pouchP[1], rot: lower.r, sx: 1 - jig * 0.4 + bulge * 0.2, sy: 1 + jig + bulge };

  // ---- neck deformer ----
  const p0 = at(pelvis, SKEL.neckBase);
  const p3 = add(headP, rot([-14, 10], headR));
  const neck = { p0, p1: add(p0, [30, -58]), p2: add(p3, [-58, 34]), p3, w0: 34, w1: 24 };
  J.neck = { x: 0, y: 0, rot: 0 };

  const wheelRevPerSec = (s.speed ?? 0) / (TAU * BIKE.R);
  return {
    joints: J, neck, chainOffset, wheel: wheelDeg, crank: phi * DEG, riderY, bikePitch, blink, pelvisDy,
    spokeBlur: smoothstep(0.6, 1.4, wheelRevPerSec),
  };
}
