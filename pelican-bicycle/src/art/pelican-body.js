// OWNER: pelican-body. PLACEHOLDER (phase 0). Slots: neck, tail, body, pouch, billLower, billUpper, head, eye, crest.
import { h, refs } from '../core/svg.js';
export const id = 'pelican-body';
export const materials = {};
// Pure neck deformer (also used by the baker): fixed command count so SMIL can morph it.
export function neckD(n) {
  const B = (t, a, b, c, d) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d;
  const pts = [], L = [], R = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const x = B(t, n.p0[0], n.p1[0], n.p2[0], n.p3[0]), y = B(t, n.p0[1], n.p1[1], n.p2[1], n.p3[1]);
    const t2 = Math.min(1, t + 0.01), t1 = Math.max(0, t - 0.01);
    const dx = B(t2, n.p0[0], n.p1[0], n.p2[0], n.p3[0]) - B(t1, n.p0[0], n.p1[0], n.p2[0], n.p3[0]);
    const dy = B(t2, n.p0[1], n.p1[1], n.p2[1], n.p3[1]) - B(t1, n.p0[1], n.p1[1], n.p2[1], n.p3[1]);
    const l = Math.hypot(dx, dy) || 1, w = (n.w0 + (n.w1 - n.w0) * t) / 2;
    L.push([x - dy / l * w, y + dx / l * w]); R.push([x + dy / l * w, y - dx / l * w]);
  }
  const f = p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  return 'M' + L.map(f).join('L') + 'L' + R.reverse().map(f).join('L') + 'Z';
}
export function build({ v }) {
  return {
    slots: {
      neck: h('path', { 'data-ref': 'pb-neck', fill: v('plume'), d: '' }),
      tail: h('path', { d: 'M0,0 L-40,-6 L-38,12 Z', fill: v('plumeShade') }),
      body: h('ellipse', { 'data-detail': 'pelican:O:body', cx: 32, cy: -50, rx: 98, ry: 58, transform: 'rotate(-18 32 -50)', fill: v('plume') }),
      head: h('circle', { r: 26, fill: v('plume') }),
      eye: h('circle', { r: 4, fill: v('pupil') }),
      crest: h('path', { d: 'M0,0 L22,-6 L20,6 Z', fill: v('plumeShade') }),
      billUpper: h('path', { d: 'M0,-5 L128,-2 L134,6 L128,4 L0,5 Z', fill: v('bill') }),
      billLower: h('path', { d: 'M0,0 L126,2 L0,8 Z', fill: v('billEdge') }),
      pouch: h('path', { d: 'M0,0 Q50,34 110,0 Z', fill: v('pouch') }),
    },
  };
}
export function attach(svg) {
  const r = refs(svg, 'pb-');
  return { update(f) { r.neck.setAttribute('d', neckD(f.pose.neck)); } };
}
