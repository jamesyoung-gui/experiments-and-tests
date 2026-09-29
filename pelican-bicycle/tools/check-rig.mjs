// Node-only rig validation over the full crank circle (spec §5.2). Exit 1 on any failure.
import { solvePose } from '../src/rig/solve.js';
import { SKEL, BIKE } from '../src/contract.js';
const fails = [];
let worstFoot = 0, worstHand = 0, maxJump = 0;
const prev = {};
for (const cadence of [40, 60, 90]) for (let i = 0; i <= 1440; i++) {
  const phi = (i / 1440) * 2 * Math.PI;
  const p = solvePose(1.234, { crank: phi, cadence, speed: cadence / 60 * 1884.96, distance: phi * 300, events: [] });
  for (const [k, j] of Object.entries(p.joints)) for (const c of ['x', 'y', 'rot']) if (!Number.isFinite(j[c])) fails.push(`NaN ${k}.${c} @${i}`);
  for (const side of ['Near', 'Far']) {
    const f = p.joints['foot' + side], pe = p.joints['pedal' + side], th = p.joints['thigh' + side], sh = p.joints['shank' + side];
    const r = (f.rot * Math.PI) / 180;
    const bx = f.x + SKEL.footBall[0] * Math.cos(r) - SKEL.footBall[1] * Math.sin(r), by = f.y + SKEL.footBall[0] * Math.sin(r) + SKEL.footBall[1] * Math.cos(r);
    worstFoot = Math.max(worstFoot, Math.hypot(bx - pe.x, by - pe.y));
    const ax = f.x - th.x, ay = f.y - th.y, kx = sh.x - th.x, ky = sh.y - th.y;
    if (ax * ky - ay * kx > 0) fails.push(`knee flip ${side} @${i}`);
    const u = p.joints['wing' + side + 'Hand'], grip = side === 'Near' ? BIKE.gripNear : BIKE.gripFar;
    worstHand = Math.max(worstHand, Math.hypot(u.x - grip[0], u.y - grip[1]));
    for (const k of ['thigh' + side, 'shank' + side]) {
      if (prev[k] !== undefined && i > 0) { let d = Math.abs(p.joints[k].rot - prev[k]); d = Math.min(d, 360 - d); maxJump = Math.max(maxJump, d); }
      prev[k] = p.joints[k].rot;
    }
  }
}
if (worstFoot > 0.5) fails.push(`foot off pedal by ${worstFoot.toFixed(3)}`);
if (worstHand > 0.5) fails.push(`hand off grip by ${worstHand.toFixed(3)}`);
if (maxJump > 1.5) fails.push(`joint jump ${maxJump.toFixed(2)}° between 0.25° steps`);
console.log(`rig: foot err ${worstFoot.toFixed(4)}, hand err ${worstHand.toFixed(4)}, max jump ${maxJump.toFixed(3)}°, ${fails.length} failures`);
if (fails.length) { console.error(fails.slice(0, 20).join('\n')); process.exit(1); }
