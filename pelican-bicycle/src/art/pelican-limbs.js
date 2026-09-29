// OWNER: pelican-limbs. PLACEHOLDER (phase 0). Bones along +x: thigh 142, shank 134, wing upper 78, lower 74.
import { SKEL } from '../contract.js';
import { h } from '../core/svg.js';
export const id = 'pelican-limbs';
export const materials = {};
const bone = (L, w0, w1, fill) => h('path', { d: `M0,${-w0 / 2} L${L},${-w1 / 2} L${L},${w1 / 2} L0,${w0 / 2} Z`, fill });
export function build({ v }) {
  const s = {};
  for (const side of ['Near', 'Far']) {
    const far = { far: side === 'Far' };
    s['thigh' + side] = bone(SKEL.thigh, 34, 18, v('plumeShade', far));
    s['shank' + side] = bone(SKEL.shank, 12, 9, v('foot', far));
    s['foot' + side] = h('path', { d: 'M-6,0 L48,6 L44,12 L-4,10 Z', fill: v('web', far) });
    s['wing' + side + 'Upper'] = bone(SKEL.wingUpper, 30, 22, v('plume', far));
    s['wing' + side + 'Lower'] = bone(SKEL.wingLower, 22, 16, v('plumeShade', far));
    s['wing' + side + 'Hand'] = h('path', { d: 'M0,-8 L40,0 L0,8 Z', fill: v('flight', far) });
  }
  return { slots: s };
}
export function attach() { return {}; }
