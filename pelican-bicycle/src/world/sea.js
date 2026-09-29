// OWNER: sea. PLACEHOLDER.
import { HORIZON_Y } from '../contract.js';
import { h } from '../core/svg.js';
export const id = 'sea';
export function build({ v }) {
  return { layers: { 'L-sea': h('rect', { x: -400, y: HORIZON_Y, width: 2400, height: 500, fill: v('seaNear') }) } };
}
export function attach() { return {}; }
