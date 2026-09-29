// OWNER: fx. PLACEHOLDER. Layers: L-gulls-far, L-shadow, L-fx-back, L-fx-front.
import { GROUND_Y, RIDER_X } from '../contract.js';
import { h } from '../core/svg.js';
export const id = 'fx';
export function build() {
  return { layers: { 'L-shadow': h('ellipse', { cx: RIDER_X + 20, cy: GROUND_Y + 4, rx: 190, ry: 10, fill: '#000', opacity: 0.25 }) } };
}
export function attach() { return {}; }
