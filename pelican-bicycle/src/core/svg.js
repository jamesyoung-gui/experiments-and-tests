// Markup helpers. Art modules return strings (testable in node); the DOM is only touched by main/scene.
export const NS = 'http://www.w3.org/2000/svg';
const esc = v => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
// h('circle', {cx: 0, r: 5, fill: v('bikeFrame')}, ...children) -> '<circle .../>'
export function h(tag, attrs = {}, ...kids) {
  const a = Object.entries(attrs).filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
  const inner = kids.flat(Infinity).filter(k => k !== undefined && k !== null && k !== false).join('');
  return inner ? `<${tag}${a}>${inner}</${tag}>` : `<${tag}${a}/>`;
}
const n = x => Math.round(x * 100) / 100;
// Joint transform -> SVG transform string.
export function xf(j) {
  if (!j) return '';
  let s = `translate(${n(j.x)} ${n(j.y)})`;
  if (j.rot) s += ` rotate(${n(j.rot)})`;
  if ((j.sx ?? 1) !== 1 || (j.sy ?? 1) !== 1) s += ` scale(${n(j.sx ?? 1)} ${n(j.sy ?? 1)})`;
  return s;
}
// Parse markup into the given SVG parent.
export function mount(parent, markup) {
  const doc = new DOMParser().parseFromString(`<svg xmlns="${NS}" xmlns:xlink="http://www.w3.org/1999/xlink">${markup}</svg>`, 'image/svg+xml');
  const err = doc.querySelector('parsererror');
  if (err) throw new Error('SVG parse error: ' + err.textContent.slice(0, 300));
  const frag = document.createDocumentFragment();
  for (const node of [...doc.documentElement.childNodes]) frag.appendChild(document.importNode(node, true));
  parent.appendChild(frag);
}
// All elements with data-ref="<prefix>..." -> { name: el } (prefix stripped)
export function refs(root, prefix) {
  const out = {};
  for (const el of root.querySelectorAll(`[data-ref^="${prefix}"]`)) out[el.getAttribute('data-ref').slice(prefix.length)] = el;
  return out;
}
// Polyline/closed path from points.
export const pathFrom = (pts, close = true) => 'M' + pts.map(p => `${n(p[0])},${n(p[1])}`).join('L') + (close ? 'Z' : '');
