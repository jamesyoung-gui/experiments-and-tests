// OWNER: sky (also owns core/palette.js keyframes from phase 2). PLACEHOLDER.
import { h, refs } from '../core/svg.js';
export const id = 'sky';
export function build({ v }) {
  return {
    defs: h('linearGradient', { id: 'sky-grad', x1: 0, y1: 0, x2: 0, y2: 1 },
      h('stop', { offset: 0, 'stop-color': v('sky0') }), h('stop', { offset: 0.6, 'stop-color': v('sky1') }), h('stop', { offset: 1, 'stop-color': v('sky2') })),
    layers: {
      'L-sky': h('rect', { x: -400, y: -200, width: 2400, height: 1300, fill: 'url(#sky-grad)' }),
      'L-sunmoon': h('circle', { 'data-ref': 'sky-sun', r: 46, fill: v('sunCore') }),
    },
  };
}
export function attach(svg) {
  const r = refs(svg, 'sky-');
  return { update(f) { r.sun.setAttribute('cx', f.sun.x.toFixed(1)); r.sun.setAttribute('cy', f.sun.y.toFixed(1)); } };
}
