// OWNER: print. PLACEHOLDER. Screen-fixed poster furniture in L-letterbox (depth null): paper border + frame line,
// the intro title card "PELICAN BAY" + 鹈鹕湾 seal that shrinks to a corner logo, ticket-style annotations.
import { h } from '../core/svg.js';
export const id = 'print';
export const detailItems = [];
export function build({ v }) {
  return { layers: { 'L-letterbox': h('rect', { 'data-detail': 'typography_frame:O:frame-line', x: 12, y: 12, width: 1576, height: 876, fill: 'none', stroke: v('ink'), 'stroke-width': 2 }) } };
}
export function attach() { return { update() {} }; }
