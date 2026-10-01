// Perf (integrator): fold static group-less `opacity` into fill-opacity / stroke-opacity.
// In Chromium every SVG element with an `opacity` below 1 gets its own effect node, so it becomes a separate paint
// chunk; the gouache art puts translucent glazes, dabs and washes on >1200 leaf shapes, and the per-frame
// Layerize / PaintArtifactCompositor passes scale with the chunk count. A shape that paints ONLY its fill (or ONLY
// its stroke) renders identically with the alpha moved onto that paint, and then needs no effect node.
// Skipped, to stay exact and to never fight a module that animates opacity: shapes painting both fill and stroke,
// anything with data-ref / id / a class (other than the static texture class) / an inline style, and pattern / clip / mask content.
const LEAF = new Set(['path', 'circle', 'ellipse', 'rect', 'polygon', 'polyline', 'line']);
const STATIC_CLASS = /^(gw-tex)?$/;
export function foldOpacity(root) {
  let n = 0;
  for (const el of root.querySelectorAll('[opacity]')) {
    if (!LEAF.has(el.localName) || el.hasAttribute('data-ref') || el.hasAttribute('id') || el.hasAttribute('style')) continue;
    if (!STATIC_CLASS.test((el.getAttribute('class') || '').trim())) continue;
    // symbols (streamed props drawn by <use>) are included; pattern tiles, clips and masks are not (no chunks / other semantics)
    if (el.closest('pattern,clipPath,mask,marker,[data-ref*="egg"]')) continue;
    const o = parseFloat(el.getAttribute('opacity'));
    if (!(o >= 0 && o < 1)) continue;
    const cs = getComputedStyle(el);
    const fillOn = cs.fill !== 'none', strokeOn = cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0;
    if (fillOn === strokeOn) continue;          // both painted (overlap differs) or nothing painted
    const k = fillOn ? 'fill-opacity' : 'stroke-opacity';
    const base = parseFloat(el.getAttribute(k) ?? (fillOn ? cs.fillOpacity : cs.strokeOpacity));
    el.setAttribute(k, +((isFinite(base) ? base : 1) * o).toFixed(4));
    el.removeAttribute('opacity');
    n++;
  }
  return n;
}
