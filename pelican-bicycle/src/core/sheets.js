// Composited scene sheets (perf). scene.js builds the scene as ONE <svg>; the runtime then splits it into a stack of
// sibling <svg> elements (same viewBox / preserveAspectRatio, absolutely positioned inside the #scene wrapper):
//   · one sheet per parallax layer (L-*), so a layer whose content changes repaints only its own pixels;
//   · one sheet per MOVING STRIP: module export `sheets` = selectors of big parallax elements whose per-frame transform
//     is a pure translate (land tiles, hills, sea bands, harbour …). Their translate is hoisted from the SVG attribute to
//     a CSS transform on their own <svg> (will-change: transform), so scrolling them is a compositor move: no paint, no
//     raster. Modules keep calling el.setAttribute('transform', 'translate(x y)') exactly as before.
// Why whole <svg> boxes: Chromium does composite SVG children that have will-change, but it re-layerizes the scene
// every frame as they move (hundreds of short-lived layers, each fully re-rasterised); CSS boxes layerize stably.
//
// The split uses Range.extractContents, which shallow-clones the partially selected ancestor chain of a cut (layer <g>
// with the camera transform, owner <g>). Clones drop id / data-ref / data-detail, carry data-pb-clone, and mirror every
// attribute change of their original (MutationObserver), so modules and the camera keep writing to the elements they
// know. unsplit() puts every node back into the single <svg> (the baker and the SVG download need one standalone tree,
// byte-identical to the unsplit scene); split() can be called again afterwards. Pure DOM, no top-level document access.
const NS = 'http://www.w3.org/2000/svg';
const SKIP = new Set(['id', 'data-ref', 'data-detail']);
const TR = /^\s*translate\(\s*([-+]?[\d.]+(?:e[-+]?\d+)?)(?:[\s,]+([-+]?[\d.]+(?:e[-+]?\d+)?))?\s*\)\s*$/i;

// wrapper: the #scene element (an HTML block); svg: the mounted scene <svg> inside it.
// opts: { layers: [layer ids], sheets: [selectors], scale(d, cam) -> layer zoom at depth d }
export function createSheets(wrapper, svg, opts) {
  const doc = wrapper.ownerDocument;
  const P = doc.defaultView.Element.prototype;
  const nSet = P.setAttribute, nGet = P.getAttribute, nRem = P.removeAttribute;
  const rootAttrs = { id: svg.getAttribute('id'), role: svg.getAttribute('role') };
  let parts = [svg], origOf = new Map(), clonesOf = new Map(), sheets = [], mo = null, isSplit = false;
  let s = 1, dpr = 1, lastCam = null;

  const newPart = tag => {
    const p = doc.createElementNS(NS, 'svg');
    nSet.call(p, 'viewBox', svg.getAttribute('viewBox'));
    nSet.call(p, 'preserveAspectRatio', svg.getAttribute('preserveAspectRatio'));
    nSet.call(p, 'class', 'pb-sheet');
    nSet.call(p, 'aria-hidden', 'true');
    nSet.call(p, 'data-sheet', tag);
    return p;
  };
  const register = (clone, orig) => {
    const o = origOf.get(orig) || orig;
    for (const k of SKIP) clone.removeAttribute(k);
    nSet.call(clone, 'data-pb-clone', '');
    origOf.set(clone, o);
    (clonesOf.get(o) || clonesOf.set(o, []).get(o)).push(clone);
  };
  const atStart = (cur, node) => { for (let n = node; n !== cur; n = n.parentNode) if (n.previousSibling) return false; return true; };
  // move `node` and everything after it (document order, inside part `cur`) into a new part placed after `cur`
  const cutBefore = (cur, node, tag) => {
    if (atStart(cur, node)) { if (cur !== svg) nSet.call(cur, 'data-sheet', tag); return cur; }
    const anc = [];
    for (let p = node.parentNode; p !== cur; p = p.parentNode) anc.push(p);
    const r = doc.createRange();
    r.setStartBefore(node); r.setEndAfter(cur.lastChild);
    const frag = r.extractContents();
    let c = frag.firstChild;
    for (let i = anc.length - 1; i >= 0; i--) { register(c, anc[i]); c = c.firstChild; }
    const part = newPart(tag);
    part.appendChild(frag);
    cur.after(part); parts.push(part);
    return part;
  };
  const nextAfter = (cur, el) => { let n = el; while (n !== cur && !n.nextSibling) n = n.parentNode; return n === cur ? null : n.nextSibling; };

  // ---- hoisting: the sheet element's translate lives in JS + CSS while split, in the attribute while unsplit
  function hoist(sh) {
    const el = sh.el;
    if (!el.__pbSheet) {
      el.__pbSheet = sh;
      el.setAttribute = function (k, v) { const h = this.__pbSheet; if (k === 'transform' && h.on && isSplit) { const m = TR.exec(v); if (m) { h.x = +m[1]; h.y = +(m[2] || 0); h.attr = String(v); return; } unhoist(h); } return nSet.call(this, k, v); };
      el.getAttribute = function (k) { const h = this.__pbSheet; return k === 'transform' && h.on && isSplit ? h.attr : nGet.call(this, k); };
      el.removeAttribute = function (k) { const h = this.__pbSheet; if (k === 'transform' && h.on && isSplit) { h.x = h.y = 0; h.attr = null; return; } return nRem.call(this, k); };
    } else el.__pbSheet = sh;
    const a = nGet.call(el, 'transform'), m = a === null ? [] : TR.exec(a);
    if (!m) { console.warn('[sheets] not a pure translate, left in the SVG:', el.getAttribute('data-ref'), a); return; }
    sh.x = +(m[1] || 0); sh.y = +(m[2] || 0); sh.attr = a; sh.on = true;
    if (a !== null) nRem.call(el, 'transform');
  }
  function unhoist(sh) {
    if (!sh.on) return;
    sh.on = false;
    if (sh.attr !== null) nSet.call(sh.el, 'transform', sh.attr);
    sh.part.style.transform = ''; sh.css = '';
  }

  function split() {
    if (isSplit) return;
    const cuts = [];
    for (const id of opts.layers) { const el = svg.querySelector('#' + id); if (el && el.parentNode === svg) cuts.push([el, 'layer', id]); }
    for (const sel of opts.sheets) for (const el of svg.querySelectorAll(sel)) cuts.push([el, 'sheet', el.getAttribute('data-ref') || sel]);
    cuts.sort((a, b) => (a[0].compareDocumentPosition(b[0]) & 4 ? -1 : 1));
    let cur = svg;
    for (const [el, kind, tag] of cuts) {
      if (kind === 'layer') { cur = cutBefore(cur, el, tag); continue; }
      // a strip may sit inside another strip's subtree only if nothing moves in between: skip nested ones
      if (sheets.some(sh => sh.el.contains(el))) continue;
      cur = cutBefore(cur, el, tag);
      const layer = el.closest('[data-depth]');
      let bad = false;
      for (let p = el.parentNode; p && p !== layer; p = p.parentNode) if (p.hasAttribute('transform')) bad = true;
      const sh = { el, part: cur, depth: layer ? +layer.getAttribute('data-depth') || 0 : 0, x: 0, y: 0, attr: null, on: false, css: '' };
      if (bad) console.warn('[sheets] transformed ancestor, not hoisted:', tag); else hoist(sh);
      sheets.push(sh);
      const nx = nextAfter(cur, el);
      if (nx) cur = cutBefore(cur, nx, (layer && (origOf.get(layer) || layer).id) || 'rest');
    }
    // drop parts that ended up holding nothing but empty clone wrappers
    for (const p of parts.slice(1)) if (!p.querySelector(':not([data-pb-clone])')) {
      for (const c of p.querySelectorAll('[data-pb-clone]')) { const o = origOf.get(c); origOf.delete(c); const l = clonesOf.get(o); l.splice(l.indexOf(c), 1); }
      p.remove(); parts.splice(parts.indexOf(p), 1);
    }
    // the first <svg> keeps title / desc / defs (and whatever precedes the first cut); the wrapper is the scene now
    nSet.call(svg, 'id', 'scene-root'); nSet.call(svg, 'role', 'presentation'); nSet.call(svg, 'aria-hidden', 'true');
    nSet.call(svg, 'class', 'pb-sheet'); nSet.call(svg, 'data-sheet', 'defs');
    nSet.call(wrapper, 'id', rootAttrs.id || 'scene');
    mo = new doc.defaultView.MutationObserver(recs => {
      for (const r of recs) {
        const k = r.attributeName; if (SKIP.has(k)) continue;
        const v = nGet.call(r.target, k), l = clonesOf.get(r.target);
        if (l) for (const c of l) v === null ? nRem.call(c, k) : nSet.call(c, k, v);
      }
    });
    for (const o of clonesOf.keys()) mo.observe(o, { attributes: true });
    isSplit = true; lastCam = null;
    resize();
  }

  function unsplit() {
    if (!isSplit) return;
    mo.takeRecords(); mo.disconnect(); mo = null;
    for (const sh of sheets) unhoist(sh);
    const merge = (parent, box) => { for (const n of [...box.childNodes]) { const o = origOf.get(n); if (o) merge(o, n); else parent.appendChild(n); } };
    for (const p of parts.slice(1)) { merge(svg, p); p.remove(); }
    parts = [svg]; origOf = new Map(); clonesOf = new Map(); sheets = [];
    nSet.call(wrapper, 'id', 'scene-wrap');
    nRem.call(svg, 'aria-hidden'); nRem.call(svg, 'class'); nRem.call(svg, 'data-sheet');
    rootAttrs.id === null ? nRem.call(svg, 'id') : nSet.call(svg, 'id', rootAttrs.id);
    rootAttrs.role === null ? nRem.call(svg, 'role') : nSet.call(svg, 'role', rootAttrs.role);
    isSplit = false;
  }

  // slice fit: viewBox units -> CSS px
  function resize() {
    const w = wrapper.clientWidth || 1600, h = wrapper.clientHeight || 900;
    s = Math.max(w / 1600, h / 900); dpr = doc.defaultView.devicePixelRatio || 1; lastCam = null;
  }
  // after the modules' update: write each strip's translate as a CSS transform. On screen a layer maps world p to
  // C + z·R(roll)·(p − T), so a translate (x, y) inside it moves the pixels by z·R·(x, y) (viewBox units) × s px.
  // Rounded to device pixels: a composited layer at a fractional offset would be resampled (soft edges).
  function update(cam) {
    if (!isSplit) return;
    const camChanged = !lastCam || lastCam.zoom !== cam.zoom || lastCam.roll !== cam.roll;
    lastCam = { zoom: cam.zoom, roll: cam.roll };
    const r = ((cam.roll || 0) * Math.PI) / 180, c = Math.cos(r), sn = Math.sin(r);
    for (const sh of sheets) {
      if (!sh.on) continue;
      if (!camChanged && sh.x === sh.lx && sh.y === sh.ly) continue;
      sh.lx = sh.x; sh.ly = sh.y;
      const k = opts.scale(sh.depth, cam) * s;
      const px = Math.round(k * (c * sh.x - sn * sh.y) * dpr) / dpr, py = Math.round(k * (sn * sh.x + c * sh.y) * dpr) / dpr;
      const css = `translate(${px}px,${py}px)`;
      if (css !== sh.css) { sh.css = css; sh.part.style.transform = css; }
    }
  }
  // run fn on the single, unsplit <svg> (bake / download), then split again
  function whole(fn) {
    const was = isSplit;
    unsplit();
    try { return fn(svg); } finally { if (was) split(); }
  }
  return { split, unsplit, update, resize, whole, get parts() { return parts; }, get sheets() { return sheets; }, get isSplit() { return isSplit; } };
}
