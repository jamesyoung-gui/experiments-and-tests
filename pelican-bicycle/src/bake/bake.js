// OWNER: baker. Zero-JS export: bakeSVG(svg, opts) -> a standalone animated SVG string (SMIL + a little CSS, no
// scripts, every CSS variable resolved to its literal ink) that loops seamlessly.
//
// Approach: generic RECORD AND REPLAY. The live runtime is the single source of truth, so the bake cannot drift from
// the page: we drive window.__pb.renderAt(t) over one seamless loop (default 24 s = 24 crank turns at 60 rpm; the
// rig's story schedules — blinks, gaze, gusts — are exactly periodic in it), record every attribute that any module
// writes (MutationObserver with oldValue, so untouched attributes cost nothing), drop the static ones and turn the
// rest into SMIL:
//   · transforms are parsed into canonical component lists (translate / rotate / scale / skew; matrices are
//     decomposed) and emitted as an additive chain of <animateTransform>s on the element itself (first = replace,
//     the rest additive="sum"), so the element keeps its id, z-order, clip-path and <use> references;
//   · rotations and dash offsets are unwrapped; when they advance (wheels, cranks, chain) they become exact
//     two-keyframe linear loops over a whole number of turns (wheel 0→1080°, crank 0→360°, chain 0→−48 links, same
//     dur) — no float drift, ever;
//   · translations that wrap (parallax tiles) are emitted faithfully, with a zero-length break keyframe at each wrap;
//     ones that never close within the loop but wrap over a longer horizon (slow far layers) are split into a linear
//     trend looping on its own period plus a small periodic residual;
//   · each channel group is tested for a shorter exact sub-period (one crank turn, a flap cycle …) and only that is
//     emitted; the rest is reduced with tolerance-bounded keyframe decimation (per-channel error bounds, reported);
//   · discrete attributes (href, visibility, display, clip-path …) become calcMode="discrete" animations.
// Opt-in per-subtree conventions (for owners): data-bake-period="P" records that subtree over its own P seconds
// (slow far layers), data-bake-fps="F" sets its sample rate; data-bake-static freezes a subtree at the t0 frame.
//
// bakeSVG runs synchronously (in-page Download button, tools/bake.mjs). bakeSVGAsync yields to the event loop every
// ~30 ms and reports progress, for UIs that must not block. Both produce byte-identical output.

export const BAKE_DEFAULTS = {
  period: 4,           // seconds in the master loop (whole crank turns at `cadence`); 24 = the rig's full story loop
  start: 24,           // live sim time that maps to baked t = 0 (past the one-shot poster intro; ≡ 0 mod 24)
  fps: 60,             // samples per second for the master loop
  cadence: 60, tod: 0.70, cam: 'wide',
  story: [],           // optional baked events [{type:'wave'|'bell'|'hop'|'gulp', t0: seconds into the loop}]
  toggles: { skeleton: false },
  probe: { horizon: 480, step: 0.25 },   // long horizon to find the wrap width of slow, non-closing layers
  tol: { len: 0.12, ang: 0.08, scale: 0.0015, d: 0.3, opacity: 0.008, dash: 0.05, num: 0.05 },          // rider (u, °)
  tolWorld: { len: 0.3, ang: 0.3, scale: 0.004, d: 0.35, opacity: 0.012, dash: 0.1, num: 0.1 },       // everything else
  blend: 1,            // seconds of seam cross-fade for channels that don't close within the loop
  dGap: 3,             // path-data keyframes at most every 2nd sample (30 Hz); SMIL interpolates in between
  strip: true,         // drop data-* attributes, comments and ids nothing references
  width: 1600, height: 900,
  title: 'Pelican Bay · 鹈鹕湾 — 骑自行车的鹈鹕 · A pelican riding a bicycle',
  desc: null,
};

const NUM_RE = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
const XF_RE = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
const PRESENTATION = new Set(['opacity', 'display', 'visibility', 'fill', 'stroke', 'fill-opacity', 'stroke-opacity',
  'stroke-width', 'stroke-dashoffset', 'stop-color', 'stop-opacity', 'color']);
const DISCRETE_ATTRS = new Set(['href', 'visibility', 'display', 'clip-path', 'mask', 'class', 'fill-rule', 'filter', 'marker-start', 'marker-end']);
const R2D = 180 / Math.PI;
// value of an absent attribute / inline property, for discrete animations
const DEFAULTS = { 'clip-path': 'none', mask: 'none', filter: 'none', display: 'inline', visibility: 'visible', opacity: '1', 'fill-opacity': '1', 'stroke-opacity': '1', transform: 'translate(0 0)', class: '', d: 'M0 0' };

// ------------------------------------------------------------------------------------------------ public API
export function bakeSVG(svg, opts = {}) {
  const it = bakeGen(svg, opts);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}
export async function bakeSVGAsync(svg, opts = {}, onProgress) {
  const it = bakeGen(svg, opts);
  let r = it.next(), last = now();
  while (!r.done) {
    if (now() - last > 30) { if (onProgress && r.value) onProgress(r.value); await new Promise(res => setTimeout(res, 0)); last = now(); }
    r = it.next();
  }
  return r.value;
}
export let lastBakeStats = null;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// ------------------------------------------------------------------------------------------------ driver
function* bakeGen(svg, opts) {
  const pb = typeof window !== 'undefined' ? window.__pb : null;
  const cfg = { ...BAKE_DEFAULTS, ...pickDefined(opts), tol: { ...BAKE_DEFAULTS.tol, ...(opts.tol || {}) }, tolWorld: { ...BAKE_DEFAULTS.tolWorld, ...(opts.tolWorld || {}) }, probe: { ...BAKE_DEFAULTS.probe, ...(opts.probe || {}) } };
  if (!pb || !pb.renderAt) return new XMLSerializer().serializeToString(svg);   // no runtime: static snapshot
  const t0 = now();
  cfg_minGapD = Math.max(1, Math.round(cfg.dGap || 1));
  const T = cfg.period, Tc = 60 / cfg.cadence, fps = cfg.fps, N = Math.round(T * fps);
  const st = pb.state, saved = st ? snapState(st) : null;
  const story = (cfg.story || []).map(e => ({ type: e.type, t0: cfg.start + e.t0 }));
  const render = t => pb.renderAt(t, { tod: cfg.tod, cam: cfg.cam, cadence: cfg.cadence, loopT: T, toggles: cfg.toggles, events: story.filter(e => e.t0 <= t + 1e-9) });
  const stats = { period: T, fps, start: cfg.start, samples: 0, tracks: 0, animated: 0, anims: 0, keyframes: 0, warnings: [], nonClosing: [], trends: [], subPeriods: {}, errMax: {}, bytesByGroup: {}, ms: {} };
  try {
    // ---- 1. base frame: the static fallback of the baked file is the t0 pose (a proper hero pose, not a collapsed rig)
    render(cfg.start); render(cfg.start);
    const clone = svg.cloneNode(true);
    const origEls = [...svg.querySelectorAll('*')], cloneEls = [...clone.querySelectorAll('*')];
    const indexOf = new Map(origEls.map((e, i) => [e, i]));

    // ---- 2. record: master loop + one pass per data-bake-period subtree
    const ownerP = el => { const h = el.closest('[data-bake-static],[data-bake-period]'); if (!h) return T; if (h.hasAttribute('data-bake-static')) return 0; return +h.getAttribute('data-bake-period') || T; };
    // the master pass starts `blend` seconds early: a channel that doesn't close is cross-faded over the last `blend`
    // seconds into its own motion one loop earlier, so the seam is continuous in value AND velocity
    const M = Math.max(0, Math.min(Math.round(cfg.blend * fps), N >> 1));
    const main = yield* recordPass(svg, render, cfg.start - M / fps, N + M, 1 / fps, stats);
    const groups = [{ P: T, step: 1 / fps, n: N, M, tracks: [...main.tracks.values()].filter(tr => ownerP(tr.el) === T) }];
    const periods = [...new Set([...svg.querySelectorAll('[data-bake-period]')].map(e => +e.getAttribute('data-bake-period')).filter(p => p > 0 && Math.abs(p - T) > 1e-6))];
    for (const P of periods) {
      const host = svg.querySelector(`[data-bake-period="${P}"]`);
      const f = +(host && host.getAttribute('data-bake-fps')) || Math.min(fps, Math.max(4, 1440 / P));
      const n = Math.max(8, Math.round(P * f));
      const pass = yield* recordPass(svg, render, cfg.start, n, P / n, stats);
      groups.push({ P, step: P / n, n, M: 0, tracks: [...pass.tracks.values()].filter(tr => ownerP(tr.el) === P) });
    }
    stats.ms.record = Math.round(now() - t0);

    // ---- 3. expand + parse; find non-closing, never-wrapping channels that need a long-horizon probe
    const units = [];
    for (const g of groups) for (const tr of g.tracks) {
      const vals = expand(tr, g.n + g.M + 1);
      if (tr.attr === 'style') { for (const [prop, pv] of splitStyle(vals)) units.push(makeUnit(tr.el, 'style:' + prop, pv, g, cfg)); }
      else units.push(makeUnit(tr.el, tr.attr, vals, g, cfg, tr.ns));
    }
    const live = units.filter(u => u && !u.constant);
    stats.tracks = units.length; stats.animated = live.length;
    const needProbe = [];
    for (const u of live) for (const c of u.chans || []) if (c.wrapKind === 'tile' && !c.closes && !c.W) needProbe.push([u, c]);
    if (needProbe.length) {
      const H = cfg.probe.horizon, step = cfg.probe.step, n = Math.round(H / step);
      const probe = yield* recordPass(svg, render, cfg.start, n, step, stats, new Set(needProbe.map(([u]) => u.el)));
      for (const [u, c] of needProbe) {
        const tr = findTrack(probe.tracks, u.el, u.attr);
        if (!tr) continue;
        const pv = parseForProbe(u, expand(tr, n + 1), c);
        if (!pv) continue;
        const uw = unwrap(pv, c.tol);
        if (uw.W) { c.W = uw.W; c.lo = Math.min(c.lo, uw.lo); c.hi = Math.max(c.hi, uw.hi); }
      }
    }
    stats.ms.probe = Math.round(now() - t0 - stats.ms.record);

    // ---- 4. analyse + emit
    const cssRules = [];
    let k = 0;
    for (const u of live) {
      const anims = analyseUnit(u, cfg, Tc, stats);
      const target = cloneEls[indexOf.get(u.el)];
      if (!target || !anims.length) continue;
      emit(target, u, anims, cfg, stats, cssRules);
      if (++k % 40 === 0) yield { phase: 'emit', done: k, of: live.length };
    }
    stats.ms.analyse = Math.round(now() - t0 - stats.ms.record - stats.ms.probe);

    // ---- 5. finish the document: resolve inks, strip, title/desc, serialise
    const origOf = new Map(cloneEls.map((e, i) => [e, origEls[i]]));
    const out = finish(svg, clone, cfg, stats, cssRules, origOf);
    stats.bytes = out.length;
    stats.ms.total = Math.round(now() - t0);
    lastBakeStats = stats;
    if (typeof window !== 'undefined') window.__pbBakeStats = stats;
    return out;
  } finally {
    if (saved) restoreState(pb, st, saved);
  }
}

function pickDefined(o) { const r = {}; for (const [k, v] of Object.entries(o || {})) if (v !== undefined && k !== 'pose' && k !== 'state') r[k] = v; return r; }
function snapState(s) { return { t: s.t, cadence: s.cadence, cadenceTarget: s.cadenceTarget, speed: s.speed, distance: s.distance, crank: s.crank, events: s.events, tod: s.tod, cam: s.cam, playing: s.playing, coasting: s.coasting, toggles: { ...s.toggles } }; }
function restoreState(pb, s, v) {
  try {
    pb.renderAt(v.t, { tod: v.tod, cam: v.cam, cadence: v.cadence, toggles: v.toggles, events: v.events });
    Object.assign(s, v, { toggles: Object.assign(s.toggles, v.toggles) });
    if (v.playing && pb.play) pb.play();
  } catch (e) { /* the live page keeps running regardless */ }
}

// ------------------------------------------------------------------------------------------------ recording
// Render n+1 samples t = start + i·step and log every attribute change. Returns Map key -> track
// {el, attr, ns, init (value before the first change), changes: [[i, value]]}.
function* recordPass(svg, render, start, n, step, stats, only) {
  render(start); render(start);
  const mo = new MutationObserver(() => {});
  mo.observe(svg, { attributes: true, attributeOldValue: true, subtree: true, childList: true });
  mo.takeRecords();
  const tracks = new Map();
  let child = 0;
  for (let i = 1; i <= n; i++) {
    render(start + i * step);
    stats.samples++;
    for (const r of mo.takeRecords()) {
      if (r.type !== 'attributes') { child++; continue; }
      const el = r.target;
      if (el === svg || (only && !only.has(el))) continue;
      const key = keyOf(el, r.attributeName, r.attributeNamespace);
      let tr = tracks.get(key);
      if (!tr) tracks.set(key, tr = { el, attr: r.attributeName, ns: r.attributeNamespace, init: r.oldValue, changes: [], lastI: -1 });
      if (tr.lastI === i) continue;
      tr.lastI = i;
      tr.changes.push([i, r.attributeNamespace ? el.getAttributeNS(r.attributeNamespace, r.attributeName) : el.getAttribute(r.attributeName)]);
    }
    if (i % 30 === 0) yield { phase: 'record', done: i, of: n };
  }
  mo.disconnect();
  if (child) stats.warnings.push(`${child} childList mutations while recording (elements created/removed per frame are not baked)`);
  return { tracks };
}
const elKeys = new WeakMap();
let elSeq = 0;
function keyOf(el, attr, ns) { let k = elKeys.get(el); if (k === undefined) elKeys.set(el, k = ++elSeq); return k + '|' + (ns ? ns + ':' : '') + attr; }
function findTrack(tracks, el, attr) {
  const a = attr.startsWith('style:') ? 'style' : attr;
  for (const tr of tracks.values()) if (tr.el === el && tr.attr === a) return tr;
  return null;
}
function expand(tr, len) {
  const out = new Array(len);
  let v = tr.init, j = 0;
  for (let i = 0; i < len; i++) {
    while (j < tr.changes.length && tr.changes[j][0] === i) { v = tr.changes[j][1]; j++; }
    out[i] = v;
  }
  return out;
}
function splitStyle(vals) {
  const maps = vals.map(s => { const m = {}; for (const d of String(s || '').split(';')) { const i = d.indexOf(':'); if (i > 0) m[d.slice(0, i).trim()] = d.slice(i + 1).trim(); } return m; });
  const props = new Set(maps.flatMap(m => Object.keys(m)));
  return [...props].map(p => [p, maps.map(m => m[p] ?? '')]);
}

// ------------------------------------------------------------------------------------------------ parsing into units
// unit = { el, attr, kind: 'xf'|'num'|'discrete'|'d', comps?, chans?, strings?, n, P, step, constant }
function makeUnit(el, attr, vals, g, cfg, ns) {
  const M = g.M || 0, main = M ? vals.slice(M) : vals;
  const n = main.length, base = { el, attr, ns, n, P: g.P, step: g.step, M };
  if (main.every(v => v === main[0])) return { ...base, constant: true };
  const tol = el.closest('#L-rider') ? cfg.tol : cfg.tolWorld;   // the rider is held tighter than the world
  const prop = attr.startsWith('style:') ? attr.slice(6) : attr;
  if (prop === 'transform' && !attr.startsWith('style:')) {
    const xf = parseTransforms(vals);
    if (xf) {
      const comps = xf.map(c => {
        const chans = c.series.map((s, ci) => chanOf(s, chanTol(c.t, ci, tol), c.t === 'rotate' && ci === 0 ? 'angle' : c.t === 'translate' ? 'tile' : null, M, c.t === 'rotate' && ci === 0 ? 360 : null));
        return { t: c.t, chans, constant: chans.every(ch => ch.constant) };
      });
      if (comps.every(c => c.constant)) return { ...base, constant: true };
      return { ...base, kind: 'xf', comps, chans: comps.flatMap(c => c.chans) };
    }
    return { ...base, kind: 'discrete', strings: main };
  }
  if (DISCRETE_ATTRS.has(prop)) return { ...base, kind: 'discrete', strings: main };
  const tpl = numTemplate(vals);
  if (tpl) {
    const isD = prop === 'd' || prop === 'points';
    const t = isD ? tol.d : prop.includes('opacity') ? tol.opacity : prop === 'stroke-dashoffset' ? tol.dash : /^(x|y|width|height|rx|ry|cx|cy|r|x1|x2|y1|y2|stroke-width)$/.test(prop) ? tol.len : tol.num;
    const dp = prop === 'stroke-dashoffset' ? dashPeriod(el) : null;
    const chans = tpl.series.map(s => chanOf(s, t, prop === 'stroke-dashoffset' ? 'angle' : null, M, dp));
    if (chans.every(c => c.constant)) return { ...base, constant: true };
    return { ...base, kind: isD ? 'd' : 'num', tpl: tpl.parts, chans };
  }
  return { ...base, kind: 'discrete', strings: main };
}
function chanTol(type, ci, tol) {
  if (type === 'translate') return tol.len;
  if (type === 'rotate') return ci === 0 ? tol.ang : tol.len;
  if (type === 'scale') return tol.scale;
  return tol.ang;   // skewX/skewY
}
// A channel: raw series x (Float64Array), tolerance, wrap handling.
//   wrapKind 'angle': values are equivalent mod W (rotation 360°, dash offsets mod the pattern) → unwrap freely;
//   wrapKind 'tile' : translations; wraps are emitted faithfully with break keyframes; a long-horizon trend is only
//                     used when the channel does not close within the loop (parallax art is W-periodic by contract).
function unwrapFixed(x, W) {
  const u = Float64Array.from(x); let off = 0, wraps = 0;
  for (let i = 1; i < x.length; i++) { const d = x[i] - x[i - 1], k = Math.round(d / W); if (k && Math.abs(d) > W / 2) { off -= k * W; wraps++; } u[i] = x[i] + off; }
  return { u, wraps };
}
function chanOf(series, tol, wrapKind, M = 0, W0 = null) {
  const full = Float64Array.from(series), x = full.subarray(M);
  let mn = Infinity, mx = -Infinity;
  for (const v of x) { if (v < mn) mn = v; if (v > mx) mx = v; }
  const c = { x, u: x, preX: full.subarray(0, M + 1), preU: full.subarray(0, M + 1), M, tol, wrapKind, constant: mx - mn <= tol * 0.5, lo: mn, hi: mx, W: null, closes: true };
  if (c.constant) return c;
  c.W0 = W0;
  if (wrapKind === 'angle' && W0) {
    const uf = unwrapFixed(full, W0);
    c.u = uf.u.subarray(M); c.preU = uf.u.subarray(0, M + 1); c.W = W0; c.wraps = uf.wraps;
    const e0 = x[x.length - 1] - x[0];
    c.closes = Math.abs(e0) <= tol || Math.abs(c.u[c.u.length - 1] - c.u[0]) <= tol || Math.abs(e0 - Math.round(e0 / W0) * W0) <= tol && Math.abs(c.u[c.u.length - 1] - c.u[0]) <= tol;
    return c;
  }
  const uw = wrapKind ? unwrap(full, tol) : null;
  c.W = uw && uw.W ? uw.W : null;
  c.wraps = uw && uw.W ? 1 : 0;
  if (c.W) { c.u = uw.u.subarray(M); c.preU = uw.u.subarray(0, M + 1); }
  const e = x[x.length - 1] - x[0];
  c.closes = Math.abs(e) <= tol || (wrapKind === 'angle' && Math.abs(c.u[c.u.length - 1] - c.u[0]) <= tol) || !!(c.W && Math.abs(e - Math.round(e / c.W) * c.W) <= tol);
  return c;
}
function parseForProbe(u, vals, c) {
  // re-parse a probe series for the given channel (same parser as the main pass)
  if (u.kind === 'xf') {
    const xf = parseTransforms(vals); if (!xf) return null;
    const flat = xf.flatMap(cc => cc.series);
    const idx = u.chans.indexOf(c);
    return idx >= 0 && flat[idx] ? Float64Array.from(flat[idx]) : null;
  }
  const tpl = numTemplate(vals); if (!tpl) return null;
  const idx = u.chans.indexOf(c);
  return idx >= 0 && tpl.series[idx] ? Float64Array.from(tpl.series[idx]) : null;
}

// Detect wrap jumps of a consistent size W and unwrap. Returns {u, W, lo, hi} (W null when there are none / inconsistent).
function unwrap(x, tol) {
  const n = x.length; if (n < 3) return { u: x, W: null };
  const d = new Float64Array(n - 1);
  for (let i = 0; i < n - 1; i++) d[i] = x[i + 1] - x[i];
  const m = median(d), dev = Float64Array.from(d, v => Math.abs(v - m)), mad = median(dev);
  const thr = Math.max(40 * tol, 20 * mad, 6 * Math.abs(m));
  const jumps = [];
  for (let i = 0; i < n - 1; i++) if (dev[i] > thr) jumps.push(i);
  if (!jumps.length) return { u: x, W: null };
  let W = median(Float64Array.from(jumps, i => dev[i]));
  if (!jumps.every(i => Math.abs(dev[i] - W) <= Math.max(0.02 * W, 4 * tol + 2 * Math.abs(m)))) return { u: x, W: null };
  if (Math.abs(W - 360) < 1.5) W = 360;
  const u = new Float64Array(n);
  let off = 0, j = 0, lo = Infinity, hi = -Infinity;
  for (let i = 0; i < n; i++) {
    if (i > 0 && j < jumps.length && jumps[j] === i - 1) { off -= Math.sign(d[i - 1] - m) * W; j++; }
    u[i] = x[i] + off;
    if (x[i] < lo) lo = x[i]; if (x[i] > hi) hi = x[i];
  }
  return { u, W, lo, hi };
}
function median(a) { const s = Float64Array.from(a).sort(); const n = s.length; return n ? (n % 2 ? s[(n - 1) >> 1] : 0.5 * (s[n / 2 - 1] + s[n / 2])) : 0; }

// Transform lists -> canonical component sequence with per-channel series, or null (then: discrete).
function parseXf(s) {
  const out = []; if (!s) return out;
  XF_RE.lastIndex = 0; let m;
  while ((m = XF_RE.exec(s))) {
    const a = (m[2].match(NUM_RE) || []).map(Number), t = m[1];
    if (t === 'translate') out.push({ t, a: [a[0] || 0, a[1] || 0] });
    else if (t === 'scale') out.push({ t, a: [a[0] ?? 1, a[1] ?? a[0] ?? 1] });
    else if (t === 'rotate') out.push({ t, a: [a[0] || 0, a[1] || 0, a[2] || 0] });
    else if (t === 'matrix') out.push({ t, a: a.length === 6 ? a : [1, 0, 0, 1, 0, 0] });
    else out.push({ t, a: [a[0] || 0] });
  }
  return out;
}
function parseTransforms(vals) {
  let seqs = vals.map(parseXf);
  const hasMatrix = seqs.some(s => s.some(c => c.t === 'matrix'));
  let canon = null;
  if (!hasMatrix) {
    canon = seqs.reduce((a, s) => (s.length > a.length ? s : a), []).map(c => c.t);
    if (!seqs.every(s => isSubseq(s, canon))) canon = null;
  }
  if (!canon) { seqs = seqs.map(s => decompose(s)); canon = ['translate', 'rotate', 'skewX', 'scale']; }
  const len = vals.length;
  const comps = canon.map(t => ({ t, series: [] }));
  // defaults for missing components (rotate keeps the centre it has elsewhere so centre channels stay constant)
  const defs = canon.map((t, k) => {
    if (t === 'translate') return [0, 0];
    if (t === 'scale') return [1, 1];
    if (t === 'rotate') { for (const s of seqs) { const al = align(s, canon); if (al && al[k]) return [0, al[k].a[1], al[k].a[2]]; } return [0, 0, 0]; }
    return [0];
  });
  comps.forEach((c, k) => { for (let ci = 0; ci < defs[k].length; ci++) c.series.push(new Float64Array(len)); });
  for (let i = 0; i < len; i++) {
    const al = align(seqs[i], canon);
    if (!al) return null;
    comps.forEach((c, k) => { const a = al[k] ? al[k].a : defs[k]; for (let ci = 0; ci < c.series.length; ci++) c.series[ci][i] = a[ci]; });
  }
  return comps;
}
function isSubseq(s, canon) { return !!align(s, canon); }
function align(s, canon) {
  const out = new Array(canon.length).fill(null); let j = 0;
  for (let k = 0; k < canon.length && j < s.length; k++) if (s[j].t === canon[k]) out[k] = s[j++];
  return j === s.length ? out : null;
}
function decompose(seq) {
  let M = [1, 0, 0, 1, 0, 0];
  const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
  for (const c of seq) {
    const a = c.a; let B;
    if (c.t === 'matrix') B = a;
    else if (c.t === 'translate') B = [1, 0, 0, 1, a[0], a[1]];
    else if (c.t === 'scale') B = [a[0], 0, 0, a[1], 0, 0];
    else if (c.t === 'rotate') { const r = a[0] / R2D, co = Math.cos(r), si = Math.sin(r); B = mul(mul([1, 0, 0, 1, a[1], a[2]], [co, si, -si, co, 0, 0]), [1, 0, 0, 1, -a[1], -a[2]]); }
    else if (c.t === 'skewX') B = [1, 0, Math.tan(a[0] / R2D), 1, 0, 0];
    else B = [1, Math.tan(a[0] / R2D), 0, 1, 0, 0];
    M = mul(M, B);
  }
  const [a, b, c, d, e, f] = M, sx = Math.hypot(a, b) || 1e-9, r = Math.atan2(b, a), co = Math.cos(r), si = Math.sin(r);
  const c2 = co * c + si * d, d2 = -si * c + co * d;
  return [{ t: 'translate', a: [e, f] }, { t: 'rotate', a: [r * R2D, 0, 0] }, { t: 'skewX', a: [Math.atan2(c2, d2) * R2D] }, { t: 'scale', a: [sx, d2] }];
}
// Numeric template: same text between numbers in every sample -> series per number.
function numTemplate(vals) {
  let parts = null; const series = [];
  for (let i = 0; i < vals.length; i++) {
    const s = String(vals[i] ?? ''), nums = [], p = [];
    let last = 0; NUM_RE.lastIndex = 0; let m;
    while ((m = NUM_RE.exec(s))) { p.push(s.slice(last, m.index)); nums.push(+m[0]); last = m.index + m[0].length; }
    p.push(s.slice(last));
    if (!nums.length) return null;
    if (!parts) { parts = p; for (let k = 0; k < nums.length; k++) series.push(new Float64Array(vals.length)); }
    else if (p.length !== parts.length || p.some((x, k) => x !== parts[k])) return null;
    nums.forEach((v, k) => { series[k][i] = v; });
  }
  return { parts, series };
}

// ------------------------------------------------------------------------------------------------ analysis
// -> [{ type (transform type) | null, values: [string], keyTimes: [number]|null, dur, calcMode }]
function analyseUnit(u, cfg, Tc, stats) {
  const P = u.P, step = u.step, n = u.n - 1;          // samples 0..n, sample n at τ = P
  if (u.kind === 'discrete') {
    const prop = u.attr.replace(/^style:/, '');
    const dflt = DEFAULTS[prop] ?? '';
    const strs = u.strings.map(v => (v === null || v === undefined || v === '' ? dflt : prop === 'd' ? minPath(v, decOf(cfg.tol.d)) : v));
    return [discreteAnim(strs, P, step, stats)];
  }
  if (u.kind === 'xf') {
    const out = [];
    for (const c of u.comps) {
      if (c.constant) { out.push({ type: c.t, values: [fmtComp(c.t, c.chans.map(ch => ch.x[0]), c.chans)], keyTimes: null, dur: P, static: true }); continue; }
      out.push(...analyseGroup(c.chans, c.t, P, step, n, Tc, cfg, stats, u));
    }
    return out;
  }
  return analyseGroup(u.chans, null, P, step, n, Tc, cfg, stats, u);
}

function analyseGroup(chans, type, P, step, n, Tc, cfg, stats, u) {
  const out = [];
  const label = labelOf(u) + (type ? ':' + type : '');
  const isRot = type === 'rotate', isAngleAttr = u.attr === 'stroke-dashoffset';
  // (a) linear advance of unwrappable channels (rotation angle, dash offset): exact 2-keyframe loop over whole turns
  const res = chans.map(c => c.u.slice());
  const trends = [], rateOf = {};
  chans.forEach((c, ci) => {
    if (c.constant) return;
    const Δ = c.u[n] - c.u[0];
    const angleLike = (isRot && ci === 0) || isAngleAttr;
    if (Math.abs(Δ) <= 2 * c.tol) return;
    if (!angleLike && !(c.wrapKind === 'tile' && c.W && !c.closes)) return;
    const W = angleLike ? (c.W0 || c.W) : c.W;         // rotations: 360°; dash offsets: the whole dash pattern
    if (!W) return;
    const r = Δ / P;
    let resMax = 0;
    for (let i = 0; i <= n; i++) { res[ci][i] = c.u[i] - (c.u[0] + r * i * step); resMax = Math.max(resMax, Math.abs(res[ci][i])); }
    // only genuine advance becomes a trend: wheels, cranks, chains, parallax tiles, drifting far layers. A rocking or
    // bobbing channel that merely fails to close is cross-faded instead; a wrapping translation whose motion is not
    // linear (respawning particles) stays faithful, because its wraps would no longer line up with the ramp's breaks.
    const ok = angleLike ? (c.wraps || Math.abs(Δ) >= W / 4) && resMax <= Math.max(0.5 * Math.abs(Δ), c.tol)
      : resMax / Math.abs(r) <= 0.05;
    if (!ok) { res[ci] = c.u.slice(); return; }
    const D = pickTrendPeriod(r, W, P, Tc, step);
    const turns = Math.round((r * D) / W) || Math.sign(r);
    const amp = turns * W;
    trends.push({ ci, r, D, W, amp, start: c.u[0], tile: !angleLike, lo: c.lo, hi: c.hi });
    rateOf[ci] = r;
    stats.trends.push(`${label}[${ci}] ${fmtN(amp, 3)} per ${fmtN(D, 4)}s (W=${fmtN(W, 3)})`);
  });
  // (b) residual (or the whole signal): tile channels stay wrapped (faithful, break keyframes at the wraps)
  const trended = new Set(trends.map(t => t.ci));
  const sig = chans.map((c, ci) => (trended.has(ci) ? res[ci] : (c.wrapKind === 'tile' ? c.x : c.u)));
  const resConst = sig.every((s, ci) => { let mn = Infinity, mx = -Infinity; for (const v of s) { if (v < mn) mn = v; if (v > mx) mx = v; } return mx - mn <= chans[ci].tol * 0.5; });
  // emit trends: rotations/dash as one additive component each; tile trends need the full vector for translate
  if (trends.length) {
    for (const t of trends) {
      const vals0 = chans.map((c, ci) => (ci === t.ci ? 0 : (type === 'rotate' && ci > 0 ? c.x[0] : 0)));
      const mk = v => { const a = vals0.slice(); a[t.ci] = v; return fmtComp(type, a, chans); };
      let values, keyTimes = null;
      if (t.tile) {
        // break at the coverage boundaries so the tile never leaves the range the module draws for
        const kf = rampWithBreaks(t.start, t.amp, t.lo, t.hi, t.W);
        values = kf.map(k => mk(k[1])); keyTimes = kf.map(k => k[0]);
      } else values = [mk(t.start), mk(t.start + t.amp)];
      out.push({ type: type || null, values, keyTimes, dur: t.D, trend: true });
      stats.keyframes += values.length;
    }
    if (resConst) {
      // fold the (constant) residual in as a static additive term only if it isn't identity
      const v = sig.map(s => s[0]);
      if (type === 'translate' || type === 'rotate') { const nz = v.some((x, ci) => !trended.has(ci) ? Math.abs(x) > 1e-9 : Math.abs(x) > 1e-6) && type !== 'rotate'; if (nz) out.push({ type, values: [fmtComp(type, v, chans)], keyTimes: null, dur: P, static: true }); }
      else if (type === null && sig.some(s => Math.abs(s[0]) > 1e-9)) out.push({ type, values: [fmtNums(u, v)], dur: P, static: true, additiveAttr: true });
      return out;
    }
    if (type === 'rotate') {
      // residual rotation about the same centre (centre channels already in the trend values)
      for (let ci = 1; ci < sig.length; ci++) sig[ci] = chans[ci].x;
    }
  }
  // (c) closure: sample n must equal sample 0 (drift is spread linearly over the loop, and reported)
  let jumpEnd = false;
  sig.forEach((s, ci) => {
    const e = s[n] - s[0], W = chans[ci].wrapKind === 'tile' && !trended.has(ci) ? chans[ci].W : null;
    if (W && Math.abs(e - Math.round(e / W) * W) <= chans[ci].tol) { s[n] = s[0]; return; }   // closes modulo the tile
    if (Math.abs(e) > chans[ci].tol) {
      const nd = neighbourDelta(s, n);
      if (Math.abs(e) > 6 * Math.max(nd, chans[ci].tol)) jumpEnd = true;
      stats.nonClosing.push(`${label}[${ci}] Δ=${fmtN(e, 3)}`);
      const c = chans[ci], M = Math.min(c.M || 0, n);
      if (M > 1) {
        // cross-fade into the channel's own motion one loop earlier (value- and velocity-continuous seam)
        for (let i = n - M; i <= n; i++) {
          const j = i - (n - M), tp = (j - M) * step;         // pre-roll sample at τ − P
          let pre = trended.has(ci) ? c.preU[j] - (c.u[0] + rateOf[ci] * tp) : c.wrapKind === 'tile' ? c.preX[j] : c.preU[j];
          if (!trended.has(ci) && c.wrapKind === 'tile' && c.W) pre += Math.round((s[i] - pre) / c.W) * c.W;
          const w = smooth(j / M);
          s[i] = (1 - w) * s[i] + w * pre;
        }
        stats.blended = (stats.blended || 0) + 1;
      } else {
        const f = s.slice();
        for (let i = 0; i <= n; i++) s[i] = f[i] - e * (i / n);
      }
    }
    s[n] = s[0];
  });
  // (d) shortest exact sub-period (one crank turn, a flap cycle ...)
  const D = subPeriod(sig, chans, n, step, P, trended);
  const m = Math.round(D / step);
  if (D < P - 1e-9) stats.subPeriods[fmtN(D, 3)] = (stats.subPeriods[fmtN(D, 3)] || 0) + 1;
  // (e) break keyframes at jumps (wrapped tiles, respawns) + tolerance-bounded decimation per segment
  const kf = decimateWithBreaks(sig, chans, m, step, stats, u);
  const values = kf.map(k => (type ? fmtComp(type, k.v, chans) : fmtNums(u, k.v)));
  const keyTimes = kf.map(k => k.t / D);
  out.push({ type, values, keyTimes: evenly(keyTimes) ? null : keyTimes, dur: D, residual: trends.length > 0 });
  stats.keyframes += values.length;
  return out;
}
function dashPeriod(el) {
  const a = (el.getAttribute('stroke-dasharray') || getComputedStyle(el).strokeDasharray || '').match(NUM_RE);
  if (!a) return null;
  const v = a.map(Number), sum = v.reduce((x, y) => x + y, 0);
  return sum > 0 ? (v.length % 2 ? 2 * sum : sum) : null;
}
const smooth = x => x * x * (3 - 2 * x);
function neighbourDelta(s, n) { return Math.max(Math.abs(s[n] - s[n - 1] || 0), Math.abs(s[1] - s[0] || 0)); }
function pickTrendPeriod(r, W, P, Tc, step) {
  const cands = [];
  const N = Math.round(P / step);
  for (let k = 1; k <= N; k++) if (N % k === 0) cands.push(P / k);
  cands.sort((a, b) => a - b);
  const ok = D => { const t = (r * D) / W; return Math.abs(t - Math.round(t)) < 1e-3 && Math.round(t) !== 0; };
  const good = cands.filter(ok);
  const geq = good.filter(D => D >= Tc - 1e-9);
  if (geq.length) return geq[0];
  if (good.length) return good[good.length - 1];
  // no whole number of wraps fits the master loop (slow far layers; the chain's master link at 100 links vs 48 per
  // crank turn): the channel gets its own exact loop, seamless forever and independent of the master loop
  return Math.abs(W / r);
}
// Linear ramp start → start+amp over [0,1], wrapped into [lo, hi] (span W) with zero-length breaks at the boundary.
function rampWithBreaks(start, amp, lo, hi, W) {
  const kf = [[0, start]];
  const dir = Math.sign(amp);
  // boundary crossings of start + amp·s for s in (0,1)
  let s = 0, v = start, off = 0;
  const top = lo + W;   // coverage [lo, lo+W]
  let guard = 0;
  while (guard++ < 64) {
    const b = dir > 0 ? top + off : lo + off;          // next boundary in unwrapped space
    const sb = (b - start) / amp;
    if (!(sb > s + 1e-6 && sb < 1 - 1e-6)) break;
    kf.push([sb, b - off]); off += dir * W; kf.push([sb, b - off]);
    s = sb; v = b;
  }
  kf.push([1, start + amp - off]);
  return kf.map(([t, x]) => [t, x]);
}
// Every sample must match the FIRST period (not just its predecessor), so slow drifts can't accumulate.
// Tile channels compare modulo their wrap width.
function subPeriod(sig, chans, n, step, P, trended) {
  for (let k = n; k >= 2; k--) {                         // smallest period first
    if (n % k) continue;
    const m = n / k;
    if (m < 6) continue;
    let ok = true;
    for (let ci = 0; ci < sig.length && ok; ci++) {
      const s = sig[ci], tol = chans[ci].tol * 0.5, W = chans[ci].wrapKind === 'tile' && !trended.has(ci) ? chans[ci].W : null;
      for (let i = m; i <= n; i++) {
        let d = s[i] - s[i % m];
        if (W) d -= Math.round(d / W) * W;
        if (Math.abs(d) > tol) { ok = false; break; }
      }
    }
    if (ok) {
      // the emitted period closes exactly (a wrap at the seam becomes a break keyframe)
      for (let ci = 0; ci < sig.length; ci++) sig[ci][m] = sig[ci][0];
      return m * step;
    }
  }
  return P;
}
// Jumps (|Δ| ≫ neighbours) split the series into segments; each segment is decimated (Ramer–Douglas–Peucker on the
// max normalised channel error, bound = tol); at each jump two keyframes share one time (zero-length transition).
function decimateWithBreaks(sig, chans, m, step, stats, u) {
  const nc = sig.length, jumps = [];
  for (let i = 0; i < m; i++) {
    for (let ci = 0; ci < nc; ci++) {
      const s = sig[ci], d = Math.abs(s[i + 1] - s[i]);
      const nb = Math.max(i > 0 ? Math.abs(s[i] - s[i - 1]) : 0, i + 2 <= m ? Math.abs(s[i + 2] - s[i + 1]) : 0, chans[ci].tol);
      if (d > 6 * nb && d > 20 * chans[ci].tol) { jumps.push(i); break; }
    }
  }
  const kf = [];
  let a = 0;
  const segs = [];
  for (const j of jumps) { segs.push([a, j]); a = j + 1; }
  segs.push([a, m]);
  let errMax = 0;
  segs.forEach(([s0, s1], si) => {
    const keep = rdp(sig, chans, s0, s1, u.kind === 'd' ? cfg_minGapD : 1);
    errMax = Math.max(errMax, keep.err);
    for (const i of keep.idx) kf.push({ t: i * step, v: sig.map(s => s[i]) });
    if (si < segs.length - 1) {
      // zero-length break at mid-interval, values extrapolated from each side
      const j = s1, tm = (j + 0.5) * step;
      const pre = sig.map(s => s[j] + (j > s0 ? (s[j] - s[j - 1]) * 0.5 : 0));
      const post = sig.map(s => s[j + 1] - (j + 2 <= m && j + 1 < segs[si + 1][1] ? (s[j + 2] - s[j + 1]) * 0.5 : 0));
      kf.push({ t: tm, v: pre }); kf.push({ t: tm, v: post });
    }
  });
  const k = u.kind === 'xf' ? 'xf' : u.attr;
  stats.errMax[k] = Math.max(stats.errMax[k] || 0, errMax);
  return kf;
}
// gap > 1: keyframes only on every gap-th sample (a temporal cap for heavy path data); the reported error is still
// measured against every recorded sample.
let cfg_minGapD = 2;
function rdp(sig, chans, a, b, gap = 1) {
  if (b <= a) return { idx: [a], err: 0 };
  const keep = new Uint8Array(b - a + 1); keep[0] = 1; keep[b - a] = 1;
  const stack = [[a, b]]; let errMax = 0;
  while (stack.length) {
    const [i0, i1] = stack.pop();
    let worst = -1, we = 1;
    for (let i = i0 + 1; i < i1; i++) {
      if (gap > 1 && (i - a) % gap) continue;
      const f = (i - i0) / (i1 - i0);
      let e = 0;
      for (let ci = 0; ci < sig.length; ci++) { const s = sig[ci]; const d = Math.abs(s[i] - (s[i0] + (s[i1] - s[i0]) * f)) / chans[ci].tol; if (d > e) e = d; }
      if (e > we) { we = e; worst = i; }
    }
    if (worst >= 0) { keep[worst - a] = 1; stack.push([i0, worst], [worst, i1]); }
  }
  const idx = []; for (let i = 0; i < keep.length; i++) if (keep[i]) idx.push(a + i);
  // achieved error (normalised to tol) for the report
  for (let q = 0; q + 1 < idx.length; q++) {
    const i0 = idx[q], i1 = idx[q + 1];
    for (let i = i0 + 1; i < i1; i++) { const f = (i - i0) / (i1 - i0); for (let ci = 0; ci < sig.length; ci++) { const s = sig[ci]; const d = Math.abs(s[i] - (s[i0] + (s[i1] - s[i0]) * f)) / chans[ci].tol; if (d > errMax) errMax = d; } }
  }
  return { idx, err: errMax };
}
function discreteAnim(strings, P, step, stats) {
  const n = strings.length - 1;
  // shortest exact sub-period
  let m = n;
  for (let k = n; k >= 2; k--) {
    if (n % k) continue; const mm = n / k; if (mm < 2) continue;
    let ok = true; for (let i = mm; i <= n; i++) if (strings[i] !== strings[i % mm]) { ok = false; break; }
    if (ok) { m = mm; break; }
  }
  const values = [], keyTimes = [];
  for (let i = 0; i < m; i++) if (i === 0 || strings[i] !== strings[i - 1]) { values.push(strings[i] ?? ''); keyTimes.push(i === 0 ? 0 : (i - 0.5) / m); }
  stats.keyframes += values.length;
  return { type: null, values, keyTimes, dur: m * step, calcMode: 'discrete' };
}
function evenly(kt) { const n = kt.length - 1; if (n < 1) return true; for (let i = 0; i <= n; i++) if (Math.abs(kt[i] - i / n) > 1e-6) return false; return true; }

// ------------------------------------------------------------------------------------------------ formatting
function decOf(tol) { return Math.max(0, Math.min(5, Math.ceil(-Math.log10(tol)))); }
function fmtN(x, dec) {
  if (!Number.isFinite(x)) return '0';
  let s = x.toFixed(dec);
  if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
  if (s === '-0') s = '0';
  return s;
}
function fmtComp(type, v, chans) {
  const f = v.map((x, i) => fmtN(x, decOf(chans[i] ? chans[i].tol : 0.01)));
  if (type === 'rotate') return f[1] === '0' && f[2] === '0' ? f[0] : f.join(' ');
  if (type === 'scale') return f[0] === f[1] ? f[0] : f.join(' ');
  return f.join(' ');
}
function fmtNums(u, v) {
  if (!u.tpl) return v.map(x => fmtN(x, 3)).join(' ');
  if (u.kind === 'd' && u.attr === 'd') {
    // decimated on ABSOLUTE numbers (error-bounded), emitted all-relative on a rounded grid: same segment types in
    // every keyframe (so SMIL interpolates), smaller numbers, and linear interpolation of the relative form equals
    // interpolation of the absolute one
    let abs = u.tpl[0];
    for (let k = 0; k < v.length; k++) abs += fmtN(v[k], 4) + u.tpl[k + 1];
    return minPath(abs, decOf(u.chans[0].tol), true);
  }
  if (u.kind === 'd') {
    // points: minimal separators (the structure is identical in every keyframe, so interpolation holds)
    u.tplMin ||= u.tpl.map(p => p.replace(/[\s,]+/g, ''));
    let s = u.tplMin[0], prev = '';
    for (let k = 0; k < v.length; k++) {
      const x = short(fmtN(v[k], decOf(u.chans[k].tol)));
      if (u.tplMin[k] === '' && k > 0 && needsSep(prev, x)) s += ' ';
      s += x + u.tplMin[k + 1]; prev = u.tplMin[k + 1] === '' ? x : '';
    }
    return s;
  }
  let s = u.tpl[0];
  for (let k = 0; k < v.length; k++) s += fmtN(v[k], decOf(u.chans[k].tol)) + u.tpl[k + 1];
  return s;
}
const short = x => x.replace(/^(-?)0\./, '$1.');
const needsSep = (prev, x) => prev !== '' && !(x[0] === '-' || (x[0] === '.' && /[.eE]/.test(prev)));
// Static path data: same geometry, minimal text. Every segment is re-emitted absolute or relative, whichever is
// shorter, with coordinates on a fixed decimal grid (`dec`; relative deltas are taken between ROUNDED absolute points,
// so rounding never accumulates), arc radii one decimal finer, no leading zeros and no redundant separators.
// Unknown syntax (compact arc flags, garbage) returns the input untouched.
const ARGN = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
export function minPath(d, dec = 2, forceRel = false) {
  const toks = String(d).match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?|[^\s,]/g);
  if (!toks) return d;
  const q = 10 ** dec, qa = 10 ** Math.min(5, dec + 1);
  const R = v => Math.round(v * q);                    // integer grid
  let out = '', prev = '', lastCmd = '';
  let cx = 0, cy = 0, sx = 0, sy = 0;                 // current / subpath start, exact (source) coordinates
  let gx = 0, gy = 0, gsx = 0, gsy = 0;               // same on the rounded grid (integers)
  let i = 0, cmd = '';
  const num = () => { const t = toks[i]; if (t === undefined || /[A-Za-z]/.test(t)) return NaN; i++; return +t; };
  const put = (letter, parts) => {
    if (letter !== lastCmd || letter === 'M' || letter === 'm') { out += letter; prev = ''; }
    for (const x of parts) { if (needsSep(prev, x)) out += ' '; out += x; prev = x; }
    lastCmd = letter === 'M' ? 'L' : letter === 'm' ? 'l' : letter;
  };
  const f = (n, scale = q) => short(fmtN(n / scale, scale === q ? dec : Math.min(5, dec + 1)));
  const emitPts = (U, pts, isMove) => {               // pts: exact absolute points; last one is the new current point
    const G = pts.map(([x, y]) => [R(x), R(y)]);
    const abs = G.flatMap(([x, y]) => [f(x), f(y)]), rel = G.flatMap(([x, y]) => [f(x - gx), f(y - gy)]);
    const len = a => a.join(' ').length;
    if (forceRel || len(rel) < len(abs)) put(U.toLowerCase(), rel); else put(U, abs);
    const [ex, ey] = pts[pts.length - 1];
    cx = ex; cy = ey; [gx, gy] = G[G.length - 1];
    if (isMove) { sx = cx; sy = cy; gsx = gx; gsy = gy; }
  };
  try {
    while (i < toks.length) {
      const t = toks[i];
      if (/^[A-Za-z]$/.test(t)) { cmd = t; i++; if (!(cmd.toUpperCase() in ARGN)) return d; }
      else if (!cmd) return d;
      const U = cmd.toUpperCase(), relIn = cmd !== U, bx = relIn ? cx : 0, by = relIn ? cy : 0;
      if (U === 'Z') { put('z', []); cx = sx; cy = sy; gx = gsx; gy = gsy; cmd = ''; continue; }
      const n = ARGN[U], a = [];
      for (let k = 0; k < n; k++) { const v = num(); if (Number.isNaN(v)) return d; a.push(v); }
      if (U === 'M') { emitPts('M', [[a[0] + bx, a[1] + by]], true); cmd = relIn ? 'l' : 'L'; }
      else if (U === 'L' || U === 'T') emitPts(U, [[a[0] + bx, a[1] + by]]);
      else if (U === 'H' || U === 'V') {
        const x = U === 'H' ? a[0] + (relIn ? cx : 0) : cx, y = U === 'V' ? a[0] + (relIn ? cy : 0) : cy;
        const gxn = R(x), gyn = R(y);
        const ab = f(U === 'H' ? gxn : gyn), rl = f(U === 'H' ? gxn - gx : gyn - gy);
        if (forceRel || rl.length < ab.length) put(U.toLowerCase(), [rl]); else put(U, [ab]);
        cx = x; cy = y; gx = gxn; gy = gyn;
      }
      else if (U === 'C') emitPts('C', [[a[0] + bx, a[1] + by], [a[2] + bx, a[3] + by], [a[4] + bx, a[5] + by]]);
      else if (U === 'S' || U === 'Q') emitPts(U, [[a[0] + bx, a[1] + by], [a[2] + bx, a[3] + by]]);
      else if (U === 'A') {
        if (!(a[3] === 0 || a[3] === 1) || !(a[4] === 0 || a[4] === 1)) return d;
        const ex = a[5] + bx, ey = a[6] + by, G = [R(ex), R(ey)];
        const head = [short(fmtN(a[0], Math.min(5, dec + 1))), short(fmtN(a[1], Math.min(5, dec + 1))), short(fmtN(a[2], 1)), String(a[3]), String(a[4])];
        const abs = [...head, f(G[0]), f(G[1])], rel = [...head, f(G[0] - gx), f(G[1] - gy)];
        if (forceRel || rel.join(' ').length < abs.join(' ').length) put('a', rel); else put('A', abs);
        cx = ex; cy = ey; [gx, gy] = G;
      }
      void qa;
    }
  } catch (e) { return d; }
  return out;
}
function labelOf(u) { const e = u.el; return (e.id || e.getAttribute('data-ref') || e.tagName) + '.' + u.attr; }
const ktStr = (kt, dec = 5) => kt.map(t => short(fmtN(Math.min(1, Math.max(0, t)), dec))).join(';');
const durStr = d => fmtN(d, 6) + 's';

// ------------------------------------------------------------------------------------------------ emission
function emit(target, u, anims, cfg, stats, cssRules) {
  const doc = target.ownerDocument, NS = 'http://www.w3.org/2000/svg';
  let attr = u.attr, viaCss = false;
  if (attr.startsWith('style:')) {
    const prop = attr.slice(6);
    if (PRESENTATION.has(prop)) {
      // the inline style would override the animated presentation attribute: move the base value to the attribute
      const base = target.style.getPropertyValue(prop);
      target.style.removeProperty(prop);
      if (!target.getAttribute('style')) target.removeAttribute('style');
      if (base !== '') target.setAttribute(prop, base);
      attr = prop;
    } else viaCss = true;
  }
  const group = groupOf(u.el);
  let bytes = 0;
  if (viaCss) {
    const prop = attr.slice(6);
    if (!target.id) target.id = 'bk' + (++stats.anims).toString(36);
    const a = anims[anims.length - 1];
    const name = 'bk-' + target.id;
    const kt = a.keyTimes || a.values.map((_, i) => i / Math.max(1, a.values.length - 1));
    const frames = a.values.map((v, i) => `${fmtN(kt[i] * 100, 3)}%{${prop}:${v}}`).join('');
    const rule = `@keyframes ${name}{${frames}}#${target.id}{animation:${name} ${durStr(a.dur)} ${a.calcMode === 'discrete' ? 'step-end' : 'linear'} infinite}`;
    cssRules.push(rule); bytes += rule.length;
  } else {
    anims.forEach((a, i) => {
      const isXf = u.kind === 'xf';
      const el = doc.createElementNS(NS, isXf ? 'animateTransform' : 'animate');
      el.setAttribute('attributeName', attr);
      if (isXf) el.setAttribute('type', a.type);
      el.setAttribute('values', a.values.join(';'));
      if (a.keyTimes && a.values.length > 1) el.setAttribute('keyTimes', ktStr(a.keyTimes, Math.min(6, Math.ceil(Math.log10(a.dur * cfg.fps * 4)) + 1)));
      if (a.calcMode) el.setAttribute('calcMode', a.calcMode);
      el.setAttribute('dur', durStr(a.dur));
      el.setAttribute('repeatCount', 'indefinite');
      if ((isXf && i > 0) || a.residual || a.additiveAttr) el.setAttribute('additive', 'sum');
      target.appendChild(el);
      stats.anims++;
      bytes += 90 + a.values.join(';').length + (a.keyTimes ? a.keyTimes.length * 7 : 0);
    });
  }
  stats.bytesByGroup[group] = (stats.bytesByGroup[group] || 0) + bytes;
  (stats.byUnit ||= []).push([labelOf(u), bytes, anims.map(a => a.values.length + '@' + fmtN(a.dur, 3)).join(',')]);
}
function groupOf(el) {
  const slot = el.closest('[data-slot]');
  if (slot) return 'slot:' + slot.getAttribute('data-slot');
  const L = el.closest('[id^="L-"]');
  return L ? L.id.replace(/--.*/, '') : 'other';
}

// ------------------------------------------------------------------------------------------------ document
// Halftone dots drawn as two-arc circles ("M x y a r r 0 1 0 2r 0 a r r 0 1 0 −2r 0", ~40 bytes each) are re-encoded
// as zero-length round-capped strokes ("m dx dy h0", ~9 bytes): the same discs in the same ink. Only for paths that are
// nothing but such dots, painted with a flat fill and no stroke/class/animation, outside clip paths.
function dotsToStrokes(clone, origOf, stats) {
  const N = '([-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?)', S = '[\\s,]*';
  const DOT = new RegExp(`^${S}([Mm])${S}${N}${S}${N}${S}[Aa]${S}${N}${S}${N}${S}${N}${S}([01])${S}([01])${S}${N}${S}${N}${S}[Aa]?${S}${N}${S}${N}${S}${N}${S}([01])${S}([01])${S}${N}${S}${N}${S}[Zz]?`);
  let n = 0, saved = 0;
  for (const p of [...clone.querySelectorAll('path[d]')]) {
    if (p.closest('clipPath') || p.id || p.getAttribute('class') || p.getAttribute('style') || p.querySelector('animate,animateTransform,set')) continue;
    const o = origOf.get(p); if (!o) continue;
    let d = p.getAttribute('d');
    if (!/[Aa]/.test(d) || d.length < 200) continue;
    const cs = getComputedStyle(o);
    if (cs.stroke !== 'none' || !/^(rgb|#)/.test(cs.fill)) continue;
    // absolute-arc and relative-arc both describe relative endpoints here only when lowercase; require lowercase arcs
    const dots = []; let cx = 0, cy = 0, ok = true, rest = d;
    while (rest.trim().length) {
      const m = DOT.exec(rest);
      if (!m) { ok = false; break; }
      const [, M, x, y, rx, ry, , , , dx, dy, rx2, ry2, , , , dx2, dy2] = m;
      const arcs = m[0].match(/[Aa]/g);
      if (arcs.some(a => a === 'A')) { ok = false; break; }
      const X = +x + (M === 'm' ? cx : 0), Y = +y + (M === 'm' ? cy : 0), r = +rx;
      if (Math.abs(+ry - r) > 1e-6 || Math.abs(+rx2 - r) > 1e-6 || Math.abs(+ry2 - r) > 1e-6 || Math.abs(Math.abs(+dx) - 2 * r) > 0.02 || Math.abs(+dy) > 0.01 || Math.abs(+dx2 + +dx) > 0.02 || Math.abs(+dy2) > 0.01) { ok = false; break; }
      dots.push([X + +dx / 2, Y, r]);
      cx = X + +dx + +dx2; cy = Y;             // after the two arcs the pen is back at the start
      if (/[Zz]\s*$/.test(m[0])) { cx = X; cy = Y; }
      rest = rest.slice(m[0].length);
    }
    if (!ok || !dots.length) continue;
    const byR = new Map();
    for (const [x, y, r] of dots) { const k = +r.toFixed(3); if (!byR.has(k)) byR.set(k, []); byR.get(k).push([x, y]); }
    const fo = parseFloat(cs.fillOpacity);
    let bytes = 0;
    for (const [r, pts] of byR) {
      let dd = '', px = 0, py = 0;
      pts.forEach(([x, y], i) => { dd += (i ? `m${x - px} ${y - py}` : `M${x} ${y}`) + 'h0'; px = x; py = y; });
      const q = p.cloneNode(false);
      for (const a of ['fill', 'fill-rule', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-opacity']) q.removeAttribute(a);
      q.setAttribute('d', minPath(dd, 2));
      q.setAttribute('fill', 'none'); q.setAttribute('stroke', cs.fill); q.setAttribute('stroke-width', fmtN(2 * r, 3)); q.setAttribute('stroke-linecap', 'round');
      if (fo < 1) q.setAttribute('stroke-opacity', fmtN(fo, 3));
      p.parentNode.insertBefore(q, p); origOf.set(q, o);
      bytes += q.getAttribute('d').length + 60;
    }
    saved += d.length - bytes; n++;
    p.remove();
  }
  stats.dots = { paths: n, savedBytes: saved };
}
function finish(svg, clone, cfg, stats, cssRules, origOf) {
  // 1. inks: every var(--x) resolved from the live root (palette) / computed style
  const vars = {};
  const cs = getComputedStyle(svg);
  for (let i = 0; i < svg.style.length; i++) { const k = svg.style[i]; if (k.startsWith('--')) vars[k] = svg.style.getPropertyValue(k).trim(); }
  const resolve = s => {
    let guard = 0;
    while (s.includes('var(') && guard++ < 8) s = s.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (m, k, fb) => { const v = vars[k] ?? (cs.getPropertyValue(k).trim() || fb); if (v === undefined || v === '') { stats.warnings.push('unresolved ' + k); return fb || 'none'; } return v; });
    return s;
  };
  clone.removeAttribute('style');
  const refd = new Set(['scene-title', 'scene-desc']);
  const all = [clone, ...clone.querySelectorAll('*')];
  const styleText = [...clone.querySelectorAll('style')].map(s => s.textContent).join('\n');
  for (const m of styleText.matchAll(/#([\w-]+)/g)) refd.add(m[1]);
  for (const el of all) {
    for (const a of [...el.attributes]) {
      let v = a.value;
      if (v.includes('var(')) { v = resolve(v); el.setAttribute(a.name, v); }
      for (const m of v.matchAll(/url\(\s*['"]?#([^'")\s]+)/g)) refd.add(m[1]);
      if ((a.localName === 'href') && v.startsWith('#')) refd.add(v.slice(1));
      if (a.name === 'values' && a.ownerElement && a.ownerElement.getAttribute('attributeName') === 'href') for (const x of v.split(';')) if (x.startsWith('#')) refd.add(x.slice(1));
      if (a.name === 'aria-labelledby') for (const x of v.split(/\s+/)) refd.add(x);
    }
  }
  for (const s of clone.querySelectorAll('style')) if (s.textContent.includes('var(')) s.textContent = resolve(s.textContent);
  // static geometry on a decimal grid chosen from the element's on-screen scale (≤ 0.05 u error at the wide camera)
  let dBefore = 0, dAfter = 0, rootScale = 1;
  try { const r = svg.getScreenCTM(); rootScale = Math.sqrt(Math.abs(r.a * r.d - r.b * r.c)) || 1; } catch (e) { /* 1 */ }
  if (cfg.dots !== false) dotsToStrokes(clone, origOf, stats);
  for (const p of clone.querySelectorAll('path[d]')) {
    const o = origOf.get(p), d0 = p.getAttribute('d');
    let dec = 2;
    try { const m = o && o.getScreenCTM && o.getScreenCTM(); if (m) { const sc = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) / rootScale; dec = sc <= 1.05 ? 1 : sc <= 10.5 ? 2 : 3; } } catch (e) { /* keep 2 */ }
    if (p.closest('clipPath,mask,pattern,symbol,marker')) dec = Math.max(dec, 2);
    const d1 = minPath(d0, dec); dBefore += d0.length; dAfter += d1.length;
    p.setAttribute('d', d1);
  }
  stats.pathBytes = { before: dBefore, after: dAfter };
  if (cfg.strip) {
    for (const el of all) {
      for (const a of [...el.attributes]) if (a.name.startsWith('data-') || /^on/i.test(a.name)) el.removeAttribute(a.name);
      if (el.id && !refd.has(el.id) && !/^(j-|L-|rider$|scene$)/.test(el.id)) el.removeAttribute('id');
    }
    const walker = clone.ownerDocument.createTreeWalker(clone, 128 /* SHOW_COMMENT */);
    const cm = []; while (walker.nextNode()) cm.push(walker.currentNode); cm.forEach(c => c.remove());
  }
  for (const s of clone.querySelectorAll('script,foreignObject')) s.remove();
  // 2. root: intrinsic size, title/desc
  clone.setAttribute('width', cfg.width); clone.setAttribute('height', cfg.height);
  const title = clone.querySelector('title'), desc = clone.querySelector('desc');
  if (title) title.textContent = cfg.title;
  if (desc) desc.textContent = cfg.desc || `一只大白鹈鹕在黄金时刻沿鹈鹕湾的海滨公路骑车。零 JavaScript 的 SVG：${stats.period} 秒无缝循环（60 rpm 下 ${Math.round(stats.period * cfg.cadence / 60)} 圈曲柄），由实时骨架逐帧烘焙为 SMIL。 `
    + `A great white pelican rides a bicycle along the seaside road at Pelican Bay. Zero-JavaScript SVG: a seamless ${stats.period} s SMIL loop (${Math.round(stats.period * cfg.cadence / 60)} crank turns at ${cfg.cadence} rpm) baked frame by frame from the live rig.`;
  if (cssRules.length) {
    const st = clone.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'style');
    st.textContent = cssRules.join('\n');
    (clone.querySelector('defs') || clone).appendChild(st);
  }
  let out = new XMLSerializer().serializeToString(clone);
  if (out.includes('var(')) out = resolve(out);
  out = out.replace(/>\s*\n\s*</g, '><');
  const head = `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Pelican Bay · 鹈鹕湾 — zero-JS baked loop: ${stats.period}s @ ${cfg.cadence} rpm, ${stats.anims} animations, ${stats.keyframes} keyframes. Generated by src/bake/bake.js -->\n`;
  return head + out;
}
