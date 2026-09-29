// OWNER: bike. PLACEHOLDER (phase 0) — replace with the final art. Draw each slot in joint-local coords.
import { BIKE, CHAIN_D } from '../contract.js';
import { h, refs } from '../core/svg.js';
export const id = 'bike';
export const materials = {};
export function build({ v }) {
  const wheel = h('g', {}, h('circle', { r: BIKE.R - 4.5, fill: 'none', stroke: v('tyre'), 'stroke-width': 9 }),
    ...Array.from({ length: 8 }, (_, i) => h('line', { x1: 0, y1: 0, x2: 88 * Math.cos(i * Math.PI / 4), y2: 88 * Math.sin(i * Math.PI / 4), stroke: v('steel'), 'stroke-width': 1.5 })));
  const [bx, by] = BIKE.bb, [rx, ry] = BIKE.rearHub, [st, sty] = BIKE.seatTubeTop, [ht, hty] = BIKE.headTop, [hb, hby] = BIKE.headBottom, [fx, fy] = BIKE.frontHub;
  const tube = (a, b) => h('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: v('bikeFrame'), 'stroke-width': 7, 'stroke-linecap': 'round' });
  return {
    slots: {
      wheelRear: wheel, wheelFront: wheel,
      frame: h('g', {}, tube([bx, by], [st, sty]), tube([bx, by], [hb, hby]), tube([st, sty], [ht, hty]), tube([bx, by], [rx, ry]), tube([st, sty], [rx, ry]), tube(BIKE.seatClamp, [st, sty]),
        h('rect', { x: -101, y: -291, width: 78, height: 8, rx: 4, fill: v('saddle') })),
      fork: tube([ht, hty], [fx, fy]),
      bars: h('path', { d: `M${BIKE.steererTop[0]},${BIKE.steererTop[1]} L${BIKE.stem[0]},${BIKE.stem[1]} L${BIKE.gripNear[0]},${BIKE.gripNear[1]}`, fill: 'none', stroke: v('steel'), 'stroke-width': 5 }),
      chain: h('path', { d: CHAIN_D, pathLength: 100, fill: 'none', stroke: v('chain'), 'stroke-width': 2.5, 'stroke-dasharray': '1.1 0.9', 'data-ref': 'bike-chain' }),
      chainring: h('circle', { r: BIKE.ringR, fill: 'none', stroke: v('steel'), 'stroke-width': 4 }),
      cog: h('circle', { r: BIKE.cogR, fill: 'none', stroke: v('steel'), 'stroke-width': 3 }),
      crankNear: h('line', { x1: 0, y1: 0, x2: BIKE.crank, y2: 0, stroke: v('steel'), 'stroke-width': 6, 'stroke-linecap': 'round' }),
      crankFar: h('line', { x1: 0, y1: 0, x2: BIKE.crank, y2: 0, stroke: v('steel', { far: true }), 'stroke-width': 6 }),
      pedalNear: h('rect', { x: -12, y: -3, width: 24, height: 6, fill: v('ink') }),
      pedalFar: h('rect', { x: -12, y: -3, width: 24, height: 6, fill: v('ink', { far: true }) }),
    },
  };
}
export function attach(svg) {
  const r = refs(svg, 'bike-');
  return { update(f) { r.chain.setAttribute('stroke-dashoffset', f.pose.chainOffset.toFixed(2)); } };
}
