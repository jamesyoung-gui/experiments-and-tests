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
  let parts = [svg], origOf = new Map(), clonesOf = new Map(), homeOf = new Map(), sheets = [], rigids = [], mo = null, isSplit = false;
  let s = 1, dpr = 1, ox = 0, oy = 0, lastCam = null, handle = null, rotors = [];
  const scratch = doc.createElementNS(NS, 'g');

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

  // ---- hoisting: while split, a strip's transform lives in JS: a pure translate goes to the CSS transform of its
  // <svg> (compositor move); any other transform (a scaled pass of a cloud …) is written to the element as usual and
  // painted, until the next pure translate hoists it again. getAttribute answers the logical value either way.
  function hoist(sh) {
    const el = sh.el;
    if (!el.__pbSheet) {
      el.setAttribute = function (k, v) { const h = this.__pbSheet; if (k === 'transform' && h.live) return put(h, String(v)); return nSet.call(this, k, v); };
      el.getAttribute = function (k) { const h = this.__pbSheet; return k === 'transform' && h.live ? h.attr : nGet.call(this, k); };
      el.removeAttribute = function (k) { const h = this.__pbSheet; if (k === 'transform' && h.live) return put(h, null); return nRem.call(this, k); };
    }
    el.__pbSheet = sh;
    sh.live = true; sh.on = false; sh.attr = undefined;
    sh.part.classList.add('pb-strip');
    put(sh, nGet.call(el, 'transform'));
  }
  function put(sh, v) {
    if (v === sh.attr) return;
    sh.attr = v;
    const m = v === null ? [] : TR.exec(v);
    if (m) {
      if (!sh.on) { sh.on = true; if (nGet.call(sh.el, 'transform') !== null) nRem.call(sh.el, 'transform'); }
      sh.x = +(m[1] || 0); sh.y = +(m[2] || 0);
    } else {
      sh.on = false; sh.x = sh.y = 0;
      nSet.call(sh.el, 'transform', v);
    }
  }
  function unhoist(sh) {
    if (!sh.live) return;
    sh.live = false;
    if (sh.on) { if (sh.attr === null) nRem.call(sh.el, 'transform'); else nSet.call(sh.el, 'transform', sh.attr); }
    sh.on = false; sh.part.style.transform = ''; sh.css = ''; sh.part.style.display = ''; sh.hid = false; sh.part.classList.remove('pb-strip');
  }

  // ---- rigid parts (opts.rigid: the rider slots; same mechanism as the storybook edition's engine): a part that holds
  // exactly ONE listed element. In live play its SVG transform stays at a reference pose and the frame-to-frame motion
  // (slot pose x rider x camera, a similarity) goes to the CSS transform of its <svg>, so a moving rigid slot is a
  // compositor move: its art rasterises once instead of every frame. Content that really changes inside (the neck path,
  // a blink, the LED scarf) repaints as before, in the reference frame. Deterministic renders (update(cam, false):
  // renderAt, shots, bakes) write the true transform and clear the CSS, so stills are pixel-exact; a camera zoom / roll
  // change re-references.
  const XF = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
  const inv = A => { const d = A[0] * A[3] - A[1] * A[2] || 1e-12; return [A[3] / d, -A[1] / d, -A[2] / d, A[0] / d, (A[2] * A[5] - A[3] * A[4]) / d, (A[1] * A[4] - A[0] * A[5]) / d]; };
  const mcache = new Map();
  function matOf(str) {
    if (!str) return [1, 0, 0, 1, 0, 0];
    let m = mcache.get(str); if (m) return m;
    m = [1, 0, 0, 1, 0, 0];
    for (const [, fn, args] of str.matchAll(XF)) {
      const a = args.trim().split(/[\s,]+/).map(Number); let t;
      if (fn === 'translate') t = [1, 0, 0, 1, a[0] || 0, a[1] || 0];
      else if (fn === 'scale') t = [a[0], 0, 0, a.length > 1 ? a[1] : a[0], 0, 0];
      else if (fn === 'rotate') { const r = (a[0] * Math.PI) / 180, c = Math.cos(r), n = Math.sin(r); t = [c, n, -n, c, 0, 0]; if (a.length > 2) t = mul(mul([1, 0, 0, 1, a[1], a[2]], t), [1, 0, 0, 1, -a[1], -a[2]]); }
      else if (fn === 'matrix') t = a;
      else if (fn === 'skewX') t = [1, 0, Math.tan((a[0] * Math.PI) / 180), 1, 0, 0];
      else t = [1, Math.tan((a[0] * Math.PI) / 180), 0, 1, 0, 0];
      m = mul(m, t);
    }
    if (mcache.size > 4000) mcache.clear();
    mcache.set(str, m); return m;
  }
  function rigidify(el, part) {
    const others = [...part.querySelectorAll('*')].some(n => n !== el && !el.contains(n) && !n.contains(el) && !n.closest('defs,title,desc'));
    if (others) return;
    const rs = { el, part, attr: nGet.call(el, 'transform'), dom: nGet.call(el, 'transform'), ref: null, css: '', live: true };
    rs.chain = []; for (let n = el.parentNode; n && n !== part; n = n.parentNode) rs.chain.unshift(n);
    if (!el.__pbRigid) {
      el.setAttribute = function (k, v) { const r = this.__pbRigid; if (k === 'transform' && r.live) { r.attr = String(v); if (!r.hoisting) { r.dom = r.attr; nSet.call(this, k, v); } return; } return nSet.call(this, k, v); };
      el.getAttribute = function (k) { const r = this.__pbRigid; return k === 'transform' && r.live ? r.attr : nGet.call(this, k); };
    }
    el.__pbRigid = rs;
    part.style.transformOrigin = '0 0'; part.classList.add('pb-rigid');
    rigids.push(rs);
  }
  function unrigid(rs) {
    rs.live = false; rs.hoisting = false;
    if (rs.dom !== rs.attr) { rs.attr === null ? nRem.call(rs.el, 'transform') : nSet.call(rs.el, 'transform', rs.attr); }
    rs.part.style.transform = ''; rs.part.style.transformOrigin = ''; rs.part.classList.remove('pb-rigid'); rs.css = ''; rs.ref = null;
  }
  function updateRigid(camChanged, live) {
    for (const rs of rigids) {
      const write = () => { if (rs.dom !== rs.attr) { rs.dom = rs.attr; rs.attr === null ? nRem.call(rs.el, 'transform') : nSet.call(rs.el, 'transform', rs.attr); } if (rs.css) { rs.css = ''; rs.part.style.transform = ''; } };
      if (!live) { rs.hoisting = false; rs.ref = null; write(); continue; }
      rs.hoisting = true;
      let P = [1, 0, 0, 1, 0, 0];
      for (const n of rs.chain) P = mul(P, matOf(nGet.call(n, 'transform')));
      const M = mul(P, matOf(rs.attr));
      if (!rs.ref || camChanged) { write(); rs.ref = M; continue; }
      const D = mul(M, inv(rs.ref));
      // viewBox -> px: q = s·p + o  =>  Dpx = A·D·A⁻¹ (the translation picks up s and o)
      let e = s * D[4] + ox * (1 - D[0]) - oy * D[2], f = s * D[5] + oy * (1 - D[3]) - ox * D[1];
      const still = Math.abs(D[0] - 1) < 1e-4 && Math.abs(D[3] - 1) < 1e-4 && Math.abs(D[1]) < 1e-4 && Math.abs(D[2]) < 1e-4;
      if (still) { e = Math.round(e * dpr) / dpr; f = Math.round(f * dpr) / dpr; }   // pure moves land on device pixels (crisp)
      const css = still ? (e || f ? `translate(${e}px,${f}px)` : '') : `matrix(${D[0].toFixed(5)},${D[1].toFixed(5)},${D[2].toFixed(5)},${D[3].toFixed(5)},${e.toFixed(2)},${f.toFixed(2)})`;
      if (css !== rs.css) { rs.css = css; rs.part.style.transform = css; }
    }
  }

  // ---- affine hoisting (rider slots, opts.affine): the slot sits alone on its own sheet; its transform attribute
  // (any translate / rotate / scale) is kept in JS and applied as the CSS matrix of that <svg>, conjugated by the
  // slot's parent CTM (camera + rider transforms of the clone chain): screen = P·T·P⁻¹ · P·p = P·T·p. A moving slot
  // then costs a compositor move instead of a repaint + raster of its art every frame.
  function hoistA(sh) {
    const el = sh.el;
    if (!el.__pbRotor) {
      el.setAttribute = function (k, v) { const h = this.__pbRotor; if (k === 'transform' && h.live) { if (h.attr !== String(v)) { h.attr = String(v); h.dirty = true; } return; } return nSet.call(this, k, v); };
      el.getAttribute = function (k) { const h = this.__pbRotor; return k === 'transform' && h.live ? h.attr : nGet.call(this, k); };
      el.removeAttribute = function (k) { const h = this.__pbRotor; if (k === 'transform' && h.live) { h.attr = null; h.dirty = true; return; } return nRem.call(this, k); };
    }
    el.__pbRotor = sh;
    sh.attr = nGet.call(el, 'transform'); sh.live = true; sh.dirty = true; sh.css = '';
    if (sh.attr !== null) nRem.call(el, 'transform');
    sh.part.style.transformOrigin = '0 0';
  }
  function unhoistA(sh) {
    if (!sh.live) return;
    sh.live = false;
    if (sh.attr === null) nRem.call(sh.el, 'transform'); else nSet.call(sh.el, 'transform', sh.attr);
    sh.part.style.transform = ''; sh.part.style.transformOrigin = ''; sh.css = '';
  }
  function updateA() {
    for (const sh of rotors) {
      // parent CTM from the clone chain's transform attributes (no forced layout): viewBox -> px (slice fit) · ancestors
      let chain = '';
      for (let n = sh.el.parentNode; n && n !== sh.part; n = n.parentNode) { const t = nGet.call(n, 'transform'); if (t) chain = t + ' ' + chain; }
      const key = sh.attr + '|' + chain + '|' + s + ',' + ox + ',' + oy;
      if (key === sh.key) continue;
      sh.key = key;
      nSet.call(scratch, 'transform', `translate(${ox} ${oy}) scale(${s}) ${chain}`);
      const P = scratch.transform.baseVal.consolidate().matrix;
      let T = null;
      if (sh.attr) { nSet.call(scratch, 'transform', sh.attr); const c = scratch.transform.baseVal.consolidate(); T = c && c.matrix; }
      const M = T ? P.multiply(T).multiply(P.inverse()) : null;
      const css = M ? `matrix(${M.a},${M.b},${M.c},${M.d},${M.e},${M.f})` : '';
      if (css !== sh.css) { sh.css = css; sh.part.style.transform = css; }
    }
  }

  function split() {
    if (isSplit) return;
    const cuts = [];
    for (const id of opts.layers) { const el = svg.querySelector('#' + id); if (el && el.parentNode === svg) cuts.push([el, 'layer', id]); }
    for (const sel of opts.sheets) for (const el of svg.querySelectorAll(sel)) cuts.push([el, 'sheet', el.getAttribute('data-ref') || sel]);
    for (const sel of opts.cuts || []) for (const el of svg.querySelectorAll(sel)) cuts.push([el, 'layer', el.id || el.getAttribute('data-ref') || sel]);
    for (const sel of opts.isolate || []) for (const el of svg.querySelectorAll(sel)) cuts.push([el, 'isolate', el.getAttribute('data-ref') || el.id || sel]);
    for (const sel of opts.affine || []) for (const el of svg.querySelectorAll(sel)) cuts.push([el, 'affine', el.id || sel]);
    cuts.sort((a, b) => (a[0].compareDocumentPosition(b[0]) & 4 ? -1 : 1));
    let cur = svg;
    for (const [el, kind, tag] of cuts) {
      if (kind === 'layer') { cur = cutBefore(cur, el, tag); continue; }
      if (kind === 'affine') {
        cur = cutBefore(cur, el, tag);
        const sh = { el, part: cur, attr: null, live: false, css: '', key: '' };
        hoistA(sh); rotors.push(sh); nSet.call(cur, 'data-move', '');
        const nx = nextAfter(cur, el);
        if (nx) cur = cutBefore(cur, nx, 'rest');
        continue;
      }
      // a strip may sit inside another strip's subtree only if nothing moves in between: skip nested ones
      if (sheets.some(sh => sh.el.contains(el))) continue;
      cur = cutBefore(cur, el, tag);
      const layer = el.closest('[data-depth]');
      if (kind === 'sheet') {
        let bad = false;
        for (let p = el.parentNode; p && p !== layer; p = p.parentNode) if (p.hasAttribute('transform')) bad = true;
        const sh = { el, part: cur, depth: layer ? +layer.getAttribute('data-depth') || 0 : 0, x: 0, y: 0, attr: null, on: false, live: false, css: '' };
        if (bad) console.warn('[sheets] transformed ancestor, not hoisted:', tag); else { hoist(sh); sheets.push(sh); nSet.call(cur, 'data-move', ''); }
      }
      const nx = nextAfter(cur, el);
      if (nx) cur = cutBefore(cur, nx, (layer && (origOf.get(layer) || layer).id) || 'rest');
    }
    // drop parts that ended up holding nothing but empty clone wrappers
    for (const p of parts.slice(1)) if (!p.querySelector(':not([data-pb-clone])')) {
      for (const c of p.querySelectorAll('[data-pb-clone]')) { const o = origOf.get(c); origOf.delete(c); const l = clonesOf.get(o); l.splice(l.indexOf(c), 1); }
      p.remove(); parts.splice(parts.indexOf(p), 1);
    }
    // elide clones that carry nothing (a plain owner / group wrapper: only its id was dropped): their children remember
    // the original parent for unsplit(); saves DOM nodes (the camera transform lives on the layer clones, which stay).
    // Should such an original gain an attribute later, the observer below re-splits (the new clones then carry it).
    const elided = new Set();
    for (const c of [...origOf.keys()]) {
      if (c.attributes.length !== 1) continue;
      const o = origOf.get(c);
      elided.add(o);
      for (const n of c.childNodes) if (!origOf.has(n)) homeOf.set(n, o);
      c.replaceWith(...c.childNodes);
      origOf.delete(c); const l = clonesOf.get(o); l.splice(l.indexOf(c), 1); if (!l.length) clonesOf.delete(o);
    }
    // the first <svg> keeps title / desc / defs (and whatever precedes the first cut); the wrapper is the scene now
    nSet.call(svg, 'id', 'scene-root'); nSet.call(svg, 'role', 'presentation'); nSet.call(svg, 'aria-hidden', 'true');
    nSet.call(svg, 'class', 'pb-sheet'); nSet.call(svg, 'data-sheet', 'defs');
    nSet.call(wrapper, 'id', rootAttrs.id || 'scene');
    mo = new doc.defaultView.MutationObserver(recs => handle(recs));
    handle = recs => {
      let resplit = false;
      for (const r of recs) {
        const k = r.attributeName; if (SKIP.has(k)) continue;
        if (elided.has(r.target)) { resplit = true; continue; }
        const v = nGet.call(r.target, k), l = clonesOf.get(r.target);
        if (l) for (const c of l) v === null ? nRem.call(c, k) : nSet.call(c, k, v);
      }
      if (resplit) { unsplit(); split(); }
    };
    for (const o of new Set([...clonesOf.keys(), ...elided])) mo.observe(o, { attributes: true });
    isSplit = true; wrapper.__pbSplit = true; lastCam = null;
    for (const sel of opts.rigid || []) for (const el of wrapper.querySelectorAll(sel)) { const part = el.closest('svg'); if (part && part !== svg) rigidify(el, part); }
    resize();
  }

  function unsplit() {
    if (!isSplit) return;
    mo.takeRecords(); mo.disconnect(); mo = null;
    for (const sh of sheets) unhoist(sh);
    for (const sh of rotors) unhoistA(sh);
    rotors = [];
    for (const rs of rigids) unrigid(rs);
    rigids = [];
    const merge = (parent, box) => { for (const n of [...box.childNodes]) { const o = origOf.get(n); if (o) merge(o, n); else (homeOf.get(n) || parent).appendChild(n); } };
    for (const p of parts.slice(1)) { merge(svg, p); p.remove(); }
    parts = [svg]; origOf = new Map(); clonesOf = new Map(); homeOf = new Map(); sheets = [];
    nSet.call(wrapper, 'id', 'scene-wrap');
    nRem.call(svg, 'aria-hidden'); nRem.call(svg, 'class'); nRem.call(svg, 'data-sheet');
    rootAttrs.id === null ? nRem.call(svg, 'id') : nSet.call(svg, 'id', rootAttrs.id);
    rootAttrs.role === null ? nRem.call(svg, 'role') : nSet.call(svg, 'role', rootAttrs.role);
    isSplit = false; wrapper.__pbSplit = false;
  }

  // slice fit: viewBox units -> CSS px
  function resize() {
    const w = wrapper.clientWidth || 1600, h = wrapper.clientHeight || 900;
    s = Math.max(w / 1600, h / 900); dpr = doc.defaultView.devicePixelRatio || 1; lastCam = null;
    ox = (w - 1600 * s) / 2; oy = (h - 900 * s) / 2;
  }
  // after the modules' update: write each strip's translate as a CSS transform. On screen a layer maps world p to
  // C + z·R(roll)·(p − T), so a translate (x, y) inside it moves the pixels by z·R·(x, y) (viewBox units) × s px.
  // Rounded to device pixels: a composited layer at a fractional offset would be resampled (soft edges).
  // live: true in real-time play (rigid parts move on the compositor); false for deterministic renders (exact stills)
  function update(cam, live = false) {
    if (!isSplit) return;
    updateA();
    const camChanged = !lastCam || lastCam.zoom !== cam.zoom || lastCam.roll !== cam.roll;
    lastCam = { zoom: cam.zoom, roll: cam.roll };
    updateRigid(camChanged, live);
    const r = ((cam.roll || 0) * Math.PI) / 180, c = Math.cos(r), sn = Math.sin(r);
    for (const sh of sheets) {
      // a strip whose root is hidden (idle weather, a pooled prop between passes) takes its whole sheet out of
      // compositing (display:none on its <svg>): an empty full-size layer still costs compositor work
      const hid = nGet.call(sh.el, 'visibility') === 'hidden' || nGet.call(sh.el, 'display') === 'none';
      if (hid !== !!sh.hid) {
        const can = !hid || !sh.el.querySelector('[visibility="visible"]');
        if (can) { sh.hid = hid; sh.part.style.display = hid ? 'none' : ''; }
      }
      if (!camChanged && sh.x === sh.lx && sh.y === sh.ly) continue;
      sh.lx = sh.x; sh.ly = sh.y;
      const k = opts.scale(sh.depth, cam) * s;
      const px = Math.round(k * (c * sh.x - sn * sh.y) * dpr) / dpr, py = Math.round(k * (sn * sh.x + c * sh.y) * dpr) / dpr;
      const css = `translate(${px}px,${py}px)`;
      if (css !== sh.css) { sh.css = css; sh.part.style.transform = px || py ? css : ''; }
    }
  }
  // mirror pending wrapper changes to their clones NOW (the observer would do it at the next microtask: too late for
  // code that measures in the same task, e.g. the UI docking during renderAt)
  function flush() { if (mo) { const r = mo.takeRecords(); if (r.length) handle(r); } }
  // run fn on the single, unsplit <svg> (bake / download), then split again
  function whole(fn) {
    const was = isSplit;
    unsplit();
    try { return fn(svg); } finally { if (was) split(); }
  }
  return { split, unsplit, update, flush, resize, whole, get parts() { return parts; }, get sheets() { return sheets; }, get rigids() { return rigids; }, get isSplit() { return isSplit; } };
}

// Perf: fold static leaf `opacity` into fill-opacity / stroke-opacity (same rule as the storybook engine). In Chromium
// every SVG element with an `opacity` below 1 gets its own effect node, i.e. a separate paint chunk, and the per-frame
// Layerize / PaintArtifactCompositor passes scale with the chunk count. A shape that paints ONLY its fill (or ONLY its
// stroke) renders identically with the alpha moved onto that paint. Skipped, to stay exact and never fight a module
// that animates opacity: shapes painting both fill and stroke, anything with data-ref / id / class / inline style, and
// pattern / clip / mask / marker / egg content. Returns the number of folded shapes.
const LEAF = new Set(['path', 'circle', 'ellipse', 'rect', 'polygon', 'polyline', 'line']);
export function foldOpacity(root) {
  const win = root.ownerDocument.defaultView;
  let n = 0;
  for (const el of root.querySelectorAll('[opacity]')) {
    if (!LEAF.has(el.localName) || el.hasAttribute('data-ref') || el.hasAttribute('id') || el.hasAttribute('style') || el.hasAttribute('class')) continue;
    if (el.closest('pattern,clipPath,mask,marker,[data-ref*="egg"],[id^="egg"]')) continue;
    const o = parseFloat(el.getAttribute('opacity'));
    if (!(o >= 0 && o < 1)) continue;
    const cs = win.getComputedStyle(el);
    const fillOn = cs.fill !== 'none', strokeOn = cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0;
    if (fillOn === strokeOn) continue;          // both painted (their overlap would differ) or nothing painted
    const k = fillOn ? 'fill-opacity' : 'stroke-opacity';
    const base = parseFloat(el.getAttribute(k) ?? (fillOn ? cs.fillOpacity : cs.strokeOpacity));
    el.setAttribute(k, +((isFinite(base) ? base : 1) * o).toFixed(4));
    el.removeAttribute('opacity');
    n++;
  }
  return n;
}
