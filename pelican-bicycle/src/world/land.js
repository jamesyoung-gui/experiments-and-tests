// OWNER: land. PLACEHOLDER. Road tile loops every TILE.road units (= one crank turn).
import { GROUND_Y, TILE } from '../contract.js';
import { h, refs } from '../core/svg.js';
export const id = 'land';
export function build({ v }) {
  const dashes = Array.from({ length: 12 }, (_, i) => h('rect', { x: i * 157.08, y: GROUND_Y + 40, width: 80, height: 6, fill: v('roadLine') })).join('');
  const tile = h('g', {}, dashes);
  return {
    layers: {
      'L-shore': h('rect', { x: -400, y: 600, width: 2400, height: 200, fill: v('sand') }),
      'L-road': h('rect', { x: -400, y: GROUND_Y - 6, width: 2400, height: 200, fill: v('road') }) +
        h('g', { 'data-ref': 'land-roadtile' }, tile, h('g', { transform: `translate(${TILE.road} 0)` }, tile)),
    },
  };
}
export function attach(svg) {
  const r = refs(svg, 'land-');
  return { update(f) { r.roadtile.setAttribute('transform', `translate(${(-(f.distance % TILE.road)).toFixed(2)} 0)`); } };
}
