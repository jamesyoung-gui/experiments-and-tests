// Shared neon-lighting helpers (lighting pass, STYLE-X §1 "lighting language" + §2 "glow = filters only on static sheets").
// Pure: markup strings and small math, no DOM, importable from node (the baker, lint, tools).
//
//   glowStroke / glowFill   fake glow for MOVING parts (rider slots, spokes, props that recycle): a wide faint halo
//                           stroke under a mid stroke under a thin bright core. No filter, rasterises like any path.
//   bloomFilter             real bloom for STATIC / FAR content only (a sheet that only translates rasterises it once):
//                           two Gaussian blurs of the source merged under it (a tight halo + a wide soft one).
//   streakFilter            anisotropic blur for wet-road reflections (soft sideways, long vertically), static sheets only.
//   bakedFilter             draws a filtered group as a pattern tile, so the filter runs in raster, not per frame.
//   flicker                 deterministic neon buzz: returns an opacity for time t (drop-outs at low rate, opacity only).
//   rimPair                 dual-colour rim light: a cyan edge on the back/top side, a magenta edge on the front/bottom.
//
// Palette (STYLE-X §1): magenta #FF2E88 primary, cyan #19E6FF secondary, acid #C6FF3D sparing, amber #FFB547 warm.
export const NEON = {
  mag: '#FF2E88', magK: '#FFD3E7', cyan: '#19E6FF', cyanK: '#D8FBFF', acid: '#C6FF3D', acidK: '#F1FFD0',
  amber: '#FFB547', amberK: '#FFF0D2', violet: '#9B5CFF', violetK: '#E4D4FF', red: '#FF3B4E', redK: '#FFD0D6', void: '#07060F',
};

const n2 = x => String(Math.round(x * 100) / 100);
const attrs = o => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => ` ${k}="${v}"`).join('');

// stacked-stroke glow: halo (w·halo, faint) + body (w·1.9, mid) + core (w·0.45, pale). opts: { core, a, halo, cap, extra }
export function glowStroke(d, col, w = 1.2, o = {}) {
  if (!d) return '';
  const a = o.a ?? 1, halo = o.halo ?? 4.2, core = o.core;
  const base = { fill: 'none', 'stroke-linecap': o.cap || 'round', 'stroke-linejoin': 'round', ...(o.extra || {}) };
  return `<g${attrs(base)}>`
    + `<path d="${d}" stroke="${col}" stroke-width="${n2(w * halo)}" opacity="${n2(0.13 * a)}"/>`
    + `<path d="${d}" stroke="${col}" stroke-width="${n2(w * 1.9)}" opacity="${n2(0.42 * a)}"/>`
    + `<path d="${d}" stroke="${core || col}" stroke-width="${n2(core ? w * 0.55 : w)}"${a < 1 ? ` opacity="${n2(a)}"` : ''}/>`
    + '</g>';
}
// a filled shape with a stroked halo around it (neon letters, LED dots)
export function glowFill(d, col, core, w = 1.4, a = 1) {
  if (!d) return '';
  return `<path d="${d}" fill="none" stroke="${col}" stroke-width="${n2(w * 3)}" stroke-linejoin="round" opacity="${n2(0.16 * a)}"/>`
    + `<path d="${d}" fill="none" stroke="${col}" stroke-width="${n2(w)}" stroke-linejoin="round" opacity="${n2(0.5 * a)}"/>`
    + `<path d="${d}" fill="${core || col}"${a < 1 ? ` opacity="${n2(a)}"` : ''}/>`;
}
// dual rim light along one outline: the back/top half in cyan, the front/bottom half in magenta (two open paths)
export function rimPair(dBack, dFront, w = 1.1, a = 1) {
  return glowStroke(dBack, NEON.cyan, w, { core: NEON.cyanK, a, halo: 3.4 }) + glowStroke(dFront, NEON.mag, w, { core: NEON.magK, a, halo: 3.4 });
}

// ---- static-sheet filters (STYLE-X §2). id must carry the owner's prefix.
// bloom: tight halo (std s) + wide halo (std 3.2·s), merged under nothing: the element using it is the GLOW LAYER
// (draw it behind the sharp sign: <use href="#sign" filter="url(#…)"/>), so the sharp art stays crisp on top.
export function bloomFilter(id, s = 3, gain = 1.35, region = null) {
  const reg = region ? `filterUnits="userSpaceOnUse" x="${region[0]}" y="${region[1]}" width="${region[2]}" height="${region[3]}"` : 'x="-60%" y="-60%" width="220%" height="220%"';
  return `<filter id="${id}" ${reg} color-interpolation-filters="sRGB">`
    + `<feGaussianBlur in="SourceGraphic" stdDeviation="${n2(s)}" result="b1"/>`
    + `<feGaussianBlur in="SourceGraphic" stdDeviation="${n2(s * 3.2)}" result="b2"/>`
    + `<feComponentTransfer in="b2" result="b2g"><feFuncA type="linear" slope="${n2(gain)}"/></feComponentTransfer>`
    + '<feMerge><feMergeNode in="b2g"/><feMergeNode in="b1"/></feMerge></filter>';
}
// bright-pass bloom (a real "bloom pass" for a whole static sheet): only pixels brighter than `thr` glow. The pass
// keys alpha on luminance (feColorMatrix), keeps the source alpha (feComposite in), blurs twice and merges; draw the
// element using it BEHIND the sharp art (<use href="#static-copy" filter="url(#…)"/>). Static / far sheets only.
export function brightBloom(id, o = {}) {
  const thr = o.thr ?? 0.36, s = o.s ?? 3, gain = o.gain ?? 1.2, k = o.k ?? 2.6;
  const reg = o.region ? `filterUnits="userSpaceOnUse" x="${o.region[0]}" y="${o.region[1]}" width="${o.region[2]}" height="${o.region[3]}"` : 'x="-10%" y="-10%" width="120%" height="120%"';
  const t = n2(-k * thr);
  return `<filter id="${id}" ${reg} color-interpolation-filters="sRGB">`
    + `<feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  ${n2(0.3 * k)} ${n2(0.59 * k)} ${n2(0.11 * k)} 0 ${t}" result="lum"/>`
    + `<feComposite in="lum" in2="SourceAlpha" operator="in" result="hi"/>`
    + `<feGaussianBlur in="hi" stdDeviation="${n2(s)}" result="b1"/>`
    + `<feGaussianBlur in="hi" stdDeviation="${n2(s * 3.4)}" result="b2"/>`
    + `<feComponentTransfer in="b2" result="b2g"><feFuncA type="linear" slope="${n2(gain)}"/></feComponentTransfer>`
    + '<feMerge><feMergeNode in="b2g"/><feMergeNode in="b1"/></feMerge></filter>';
}
// wet-road streaks: sx sideways, sy vertically (sy ≫ sx gives the long neon smear of a rain-slick street)
// region [x, y, w, h] (user space) pins the filter region, so a repaint elsewhere in the sheet never re-runs the blur
// gain > 1 lifts the neon in the blurred copy (dark silhouettes stay dark)
export function streakFilter(id, sx = 1.2, sy = 7, region = null, gain = 1) {
  const reg = region ? `filterUnits="userSpaceOnUse" x="${region[0]}" y="${region[1]}" width="${region[2]}" height="${region[3]}"` : 'x="-10%" y="-40%" width="120%" height="180%"';
  const g = gain !== 1 ? `<feComponentTransfer><feFuncR type="linear" slope="${n2(gain)}"/><feFuncG type="linear" slope="${n2(gain)}"/><feFuncB type="linear" slope="${n2(gain)}"/></feComponentTransfer>` : '';
  return `<filter id="${id}" ${reg} color-interpolation-filters="sRGB">`
    + `<feGaussianBlur in="SourceGraphic" stdDeviation="${n2(sx)} ${n2(sy)}"/>${g}</filter>`;
}

// Baked filter (integration, perf): an SVG filter on a group inside a composited sheet becomes a compositor render
// surface whose blur the (single-threaded, software) display compositor re-runs EVERY frame, even when the sheet only
// translates. Drawing the filtered group as the tile of a <pattern> instead moves the filter into raster: the pattern
// picture is rasterised with its blur once per tile and then only composited. Returns { def, el }: put `def` in defs and
// draw `el` (a rect filled with the pattern, exactly one pattern tile) where the filtered group was. The pattern uses
// user space, so it follows the element (and every <use> of it); keep [x, y, w, h] around everything the blur touches.
export function bakedFilter(id, [x, y, w, h], filterId, content, el = {}) {
  const box = `x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}"`;
  return {
    // pattern content is laid out from the tile's corner: shift it back so it keeps its user coordinates
    def: `<pattern id="${id}" patternUnits="userSpaceOnUse" ${box}><g transform="translate(${n2(-x)} ${n2(-y)})"><g filter="url(#${filterId})">${content}</g></g></pattern>`,
    // the rect is only the pattern's frame, not the shape: it takes no pointer / hit-test events
    el: `<rect ${box} fill="url(#${id})" pointer-events="none" style="pointer-events:none !important;${el.style || ''}"${attrs({ ...el, style: undefined })}/>`,
  };
}

// ---- deterministic flicker (no Math.random): integer hash -> [0,1)
export function nhash(a, b = 0) {
  let x = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35);
  x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12; x = Math.imul(x, 0x297a2d39); x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
}
// neon buzz: at `rate` Hz a slot may drop out (probability p) to `low`; a rare double-blink every other slot.
// Returns an opacity string (few distinct values, so dirty-checked writes stay rare).
export function flicker(t, seed, rate = 7, p = 0.04, low = 0.28) {
  const k = Math.floor(t * rate);
  if (nhash(k, seed) < p) return String(low);
  if (nhash(k >> 1, seed + 17) < p * 0.5 && (k & 1)) return String(Math.min(1, low + 0.35));
  return '1';
}

// ---- compositor hygiene (lighting pass, perf). Chromium gives an element `opacity` its own effect node; on a big
// shape that effect is often not folded back into the sheet's layer, so the shape gets a cc layer of its own (each one
// costs its full visible area every frame in the software compositor), and a group effect spanning several such layers
// needs an offscreen render pass. Paint opacity (fill-opacity / stroke-opacity) is part of the drawing itself: no
// effect node, no extra layer. flattenOpacity(root) rewrites the static `opacity` of every LEAF shape into paint
// opacity (×fill-opacity / ×stroke-opacity already there; style="opacity:…" likewise) and patches the element so a
// later setAttribute('opacity', v) from a module's update() lands on the paint opacities (getAttribute answers the
// logical value). Groups and <use> keep their opacity (an effect over a whole subtree is not a paint property).
// Visual difference: where a shape's stroke overlaps its own fill, the fill shows through the stroke a little.
const LEAF = 'path,rect,circle,ellipse,line,polyline,polygon';
export function flattenOpacity(root) {
  const P = root.ownerDocument.defaultView.Element.prototype, nSet = P.setAttribute, nGet = P.getAttribute, nRem = P.removeAttribute;
  let n = 0;
  const num = x => (x === null || x === '' ? 1 : +x);
  for (const el of root.querySelectorAll(LEAF)) {
    const a = nGet.call(el, 'opacity');
    const st = nGet.call(el, 'style') || '';
    const m = /(^|;)\s*opacity\s*:\s*([^;]+)/.exec(st);
    if (a === null && !m) continue;
    const fo = num(nGet.call(el, 'fill-opacity')), so = num(nGet.call(el, 'stroke-opacity'));
    if (!Number.isFinite(fo) || !Number.isFinite(so)) continue;
    if (m) {   // CSS opacity (often a var() mood value): move it into paint opacity, in the style
      const e = m[2].trim();
      if (/!important/.test(e)) continue;
      const rest = st.replace(m[0], m[1]).replace(/^;+/, '');
      nSet.call(el, 'style', `${rest ? rest.replace(/;?\s*$/, ';') : ''}fill-opacity:calc(${fo} * (${e}) * ${a === null ? 1 : +a});stroke-opacity:calc(${so} * (${e}) * ${a === null ? 1 : +a})`);
      if (a !== null) nRem.call(el, 'opacity');
      n++; continue;
    }
    const k = +a; if (!Number.isFinite(k)) continue;
    const st0 = { fo, so, v: a };
    const put = v => { const x = Math.max(0, Math.min(1, +v)); nSet.call(el, 'fill-opacity', String(Math.round(st0.fo * x * 1e4) / 1e4)); nSet.call(el, 'stroke-opacity', String(Math.round(st0.so * x * 1e4) / 1e4)); };
    nRem.call(el, 'opacity'); put(k);
    el.setAttribute = function (key, v) { if (key === 'opacity') { if (String(v) !== st0.v) { st0.v = String(v); put(v); } return; } return nSet.call(this, key, v); };
    el.getAttribute = function (key) { return key === 'opacity' ? st0.v : nGet.call(this, key); };
    el.removeAttribute = function (key) { if (key === 'opacity') { st0.v = null; put(1); return; } return nRem.call(this, key); };
    n++;
  }
  return n;
}
