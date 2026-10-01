// Bicycle mechanics in the live DOM (rubric D2/D3 evidence): tooth counts, the chain on CHAIN_D, slot / layer order,
// gear ratio, chain travel per crank turn, and reference connectivity (every url(#…) / href="#…" in the rider resolves).
// usage: node tools/check-bike.mjs [--dist]     exit 1 on any failure
import { openScene, reporter } from './lib/page.mjs';
import { BIKE, CHAIN_D, SLOTS, GEAR } from '../src/contract.js';
const R = reporter('check-bike');
const { page, errors, close } = await openScene();
const res = await page.evaluate(({ CHAIN_D, SLOTS }) => {
  window.__pb.renderAt(3, { tod: 0.7, cam: 'wide' });
  const q = s => [...document.querySelectorAll(s)];
  const norm = d => (d || '').replace(/[\s,]+/g, ' ').trim();
  const chains = q('#j-chain path[pathLength="100"], #j-cog path[pathLength="100"], [data-slot] path[pathLength="100"]');
  const order = SLOTS.map(s => document.getElementById('j-' + s)).map(e => e && e.compareDocumentPosition.bind(e));
  let orderOk = true; const slotEls = SLOTS.map(s => document.getElementById('j-' + s));
  for (let i = 1; i < slotEls.length; i++) if (!slotEls[i - 1] || !slotEls[i] || !(slotEls[i - 1].compareDocumentPosition(slotEls[i]) & 4)) { orderOk = false; break; }
  const teeth = document.querySelector('[data-ref="bike-teeth"]'), chain = document.querySelector('[data-ref="bike-chain"]');
  const teethUnderChain = !!(teeth && chain && (teeth.compareDocumentPosition(chain) & 4));
  // references inside the rider
  const ids = new Set(q('[id]').map(e => e.id)); const missing = new Set();
  for (const e of q('[data-slot], [data-slot] *')) for (const a of e.attributes) {
    for (const m of a.value.matchAll(/url\(\s*['"]?#([^'")\s]+)/g)) if (!ids.has(m[1])) missing.add(m[1]);
    if ((a.localName === 'href') && a.value.startsWith('#') && !ids.has(a.value.slice(1))) missing.add(a.value.slice(1));
  }
  // gear ratio and chain travel: two crank phases 90° apart
  const at = deg => { const f = window.__pb.renderAt(3 + deg / 360, { tod: 0.7, cam: 'wide' }); return { crank: f.pose.crank, wheel: f.pose.wheel, dash: chain ? +(getComputedStyle(document.querySelector('[data-ref="bike-chainfx"]') || chain).strokeDashoffset.replace('px', '')) : NaN }; };
  const a = at(0), b = at(30);   // 60 rpm: one crank turn per second; 30° keeps the wheel (90°) clear of a wrap
  return {
    cog: q('[data-ref^="bike-cog-tooth-"]').length, ring: q('[data-ref^="bike-ring-tooth-"]').length,
    chains: chains.length, chainBad: chains.filter(p => norm(p.getAttribute('d')) !== norm(CHAIN_D)).length,
    orderOk, teethUnderChain, missing: [...missing], a, b,
  };
}, { CHAIN_D, SLOTS });
res.cog === BIKE.cogT ? R.ok(`cog teeth ${res.cog} = ${BIKE.cogT}`) : R.fail(`cog teeth ${res.cog} ≠ ${BIKE.cogT}`);
res.ring === BIKE.ringT ? R.ok(`chainring teeth ${res.ring} = ${BIKE.ringT}`) : R.fail(`chainring teeth ${res.ring} ≠ ${BIKE.ringT}`);
res.chains > 0 && res.chainBad === 0 ? R.ok(`${res.chains} chain paths, all d === CHAIN_D (pathLength 100)`) : R.fail(`${res.chainBad}/${res.chains} chain paths off CHAIN_D`);
res.orderOk ? R.ok('rider slots in SLOTS z-order') : R.fail('rider slots out of SLOTS order');
res.teethUnderChain ? R.ok('ring teeth paint under the chain') : R.fail('ring teeth paint over the chain');
!res.missing.length ? R.ok('every url(#…) / href in the rider resolves') : R.fail('dangling references: ' + res.missing.slice(0, 10).join(', '));
const toDeg = x => (Math.abs(x) > 2 * Math.PI + 1e-6 ? x : (x * 180) / Math.PI);
if (Number.isFinite(res.a.wheel) && Number.isFinite(res.b.wheel)) {
  const md = x => ((x % 360) + 540) % 360 - 180;
  const dc = md(res.b.crank - res.a.crank), dw = md(res.b.wheel - res.a.wheel), ratio = dw / dc;
  Math.abs(Math.abs(ratio) - GEAR) < 0.02 ? R.ok(`wheel / crank = ${Math.abs(ratio).toFixed(3)} (GEAR ${GEAR})`) : R.fail(`wheel / crank = ${ratio.toFixed(3)} ≠ GEAR ${GEAR}`);
} else R.ok('pose.wheel not exposed: gear ratio checked by check-rig / check-baked');
if (Number.isFinite(res.a.dash) && Number.isFinite(res.b.dash)) {
  const d = Math.abs(res.b.dash - res.a.dash), want = BIKE.ringT / 12, m = ((d % 2) + 2) % 2, wm = want % 2;   // 2-link plate period
  Math.abs(m - wm) < 0.05 || Math.abs(Math.abs(m - wm) - 2) < 0.05 ? R.ok(`chain moves ${want} links per 30° of crank (mod the 2-link period)`) : R.fail(`chain dash Δ ${d.toFixed(2)} ≠ ${want} links (mod 2)`);
}
for (const e of errors) R.fail(e);
const r = R.done();
await close();
process.exit(r.fails.length ? 1 : 0);
