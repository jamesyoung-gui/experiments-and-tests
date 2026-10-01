// Contact anchors in screen space (rubric D3 evidence): every data-anchor point mapped through getScreenCTM over a
// pedal stroke + the event poses. Ball of foot ↔ pedal spindle, wrist ↔ grip, belly ↔ saddle, both hubs on the road
// contact line. Distances in viewBox units (1600×900 wide camera).
// usage: node tools/check-anchors.mjs [--dist] [--json shots/fix-lead/anchors.json]
import fs from 'node:fs';
import path from 'node:path';
import { openScene, reporter, ROOT } from './lib/page.mjs';
import { SKEL, BIKE, GROUND_Y } from '../src/contract.js';
const R = reporter('check-anchors');
const { page, errors, close } = await openScene();
const cases = [...Array(12)].map((_, i) => ({ t: 3, crankDeg: i * 30, tag: `crank ${i * 30}°` }))
  .concat([['bell', 6.1], ['wave', 7.2], ['gulp', 7.1], ['hop', 6.5]].map(([type, t]) => ({ t, tag: type, events: [{ type, t0: 6 }] })));
const rows = await page.evaluate(({ cases, SKEL, BIKE }) => {
  const svgEl = document.querySelector('#scene svg');
  const toVB = (el, x, y) => { const m = el.getScreenCTM(); const p = new DOMPoint(x, y).matrixTransform(m); const s = Math.max(innerWidth / 1600, innerHeight / 900), ox = (innerWidth - 1600 * s) / 2, oy = (innerHeight - 900 * s) / 2; return [(p.x - ox) / s, (p.y - oy) / s]; };
  const anchor = n => { const e = document.querySelector(`[data-anchor="${n}"]`); if (!e) return null; const cx = +(e.getAttribute('cx') || 0), cy = +(e.getAttribute('cy') || 0); return toVB(e, cx, cy); };
  const slotPt = (slot, x, y) => { const e = document.getElementById('j-' + slot); return e ? toVB(e, x, y) : null; };
  const d = (a, b) => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : NaN);
  const out = [];
  for (const c of cases) {
    window.__pb.renderAt(c.t, { tod: 0.7, cam: 'wide', crankDeg: c.crankDeg, events: c.events || [] });
    const r = { tag: c.tag };
    for (const side of ['Near', 'Far']) {
      r['foot' + side] = d(slotPt('foot' + side, SKEL.footBall[0], SKEL.footBall[1]), anchor('bike-pedal' + side));
      r['hand' + side] = d(slotPt('wingFarHand'.replace('Far', side), 0, 0), anchor('bike-grip' + side));
    }
    const rh = anchor('bike-rearHub'), fh = anchor('bike-frontHub');
    r.rearHubToRoad = rh ? Math.abs(rh[1] + BIKE.R - (window.__pb.state ? 790 : 790)) : NaN;
    r.frontHubToRoad = fh ? Math.abs(fh[1] + BIKE.R - 790) : NaN;
    r.seat = d(anchor('pb-seatContact'), anchor('bike-saddleTop'));
    r.anchors = document.querySelectorAll('[data-anchor]').length;
    out.push(r);
  }
  return out;
}, { cases, SKEL, BIKE });
const worst = k => Math.max(...rows.filter(r => Number.isFinite(r[k])).map(r => r[k]), 0);
const pedalRows = rows.filter(r => r.tag.startsWith('crank'));
const wf = Math.max(...pedalRows.map(r => Math.max(r.footNear || 0, r.footFar || 0)));
wf <= 1.5 ? R.ok(`ball of foot ↔ pedal spindle ≤ ${wf.toFixed(2)} u over the stroke`) : R.fail(`ball of foot leaves the pedal by ${wf.toFixed(2)} u`);
const wh = Math.max(...pedalRows.map(r => r.handFar || 0));
Number.isFinite(wh) && wh <= 3 ? R.ok(`far wrist ↔ grip ≤ ${wh.toFixed(2)} u while pedalling`) : R.fail(`far wrist off the grip by ${wh.toFixed(2)} u`);
const hub = Math.max(worst('rearHubToRoad'), worst('frontHubToRoad'));
const hubRows = rows.filter(r => r.tag.startsWith('crank'));
const hubP = Math.max(...hubRows.map(r => Math.max(r.rearHubToRoad || 0, r.frontHubToRoad || 0)));
hubP <= 1.5 ? R.ok(`tyres on the road line (hub − R vs y ${GROUND_Y}) ≤ ${hubP.toFixed(2)} u while pedalling (hop excluded; worst incl. events ${hub.toFixed(1)} u)`) : R.fail(`tyres off the road by ${hubP.toFixed(2)} u while pedalling`);
const seat = worst('seat');
Number.isFinite(seat) && seat <= 12 ? R.ok(`belly contact ↔ saddle top ≤ ${seat.toFixed(2)} u`) : R.fail(`belly contact off the saddle by ${seat.toFixed(2)} u`);
console.log(`  ${rows[0].anchors} anchors; per-pose table: --json`);
for (const e of errors) R.fail(e);
const r = R.done();
const j = process.argv.indexOf('--json'); if (j > 0) { const f = path.resolve(ROOT, process.argv[j + 1]); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify({ rows, ...r }, null, 1)); }
await close();
process.exit(r.fails.length ? 1 : 0);
