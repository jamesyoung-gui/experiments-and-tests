// Shared gouache helpers (STYLE-B §2). Pure (no DOM): markup strings + seeded geometry.
//
// Two families, split by the performance rule:
//   · FILTERS (static / far / translate-only sheets only): paper grain + mottle, painterly edge wobble
//     (feTurbulence -> feDisplacementMap), soft painted edges, horizontal dry-brush streak washes. Every id is
//     prefixed by the caller (gwFilters('sky') -> #sky-gw-soft …) so two modules never collide on an id.
//   · GEOMETRY (the rider, the bike, moving / recycled props): seeded jitter of outlines, offset pencil lines,
//     tapered dry-brush strokes and static <pattern> tiles of painted blotches in the caller's local coordinates.
// Filter colours never read palette variables, so a time-of-day change never re-runs a filter on the paper sheet.
const f = x => String(Math.round(x * 100) / 100);

export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// grey noise: turbulence R channel -> opaque grey around 0.5 with contrast c (unpremultiplied, sRGB)
const grey = (c, res, inp) => `<feColorMatrix${inp ? ` in="${inp}"` : ''} type="matrix" values="${f(c)} 0 0 0 ${f(0.5 - c / 2)} ${f(c)} 0 0 0 ${f(0.5 - c / 2)} ${f(c)} 0 0 0 ${f(0.5 - c / 2)} 0 0 0 0 1"${res ? ` result="${res}"` : ''}/>`;
const CI = 'color-interpolation-filters="sRGB"';

// Painterly filters for far / static content. `p` = id prefix.
//   #p-gw-wob   small hand-drawn edge wobble (2-3 u), crisp
//   #p-gw-soft  far things: bigger wobble + a soft 1.2 u edge (atmospheric)
//   #p-gw-veil  very soft (clouds, haze, glows)
//   #p-gw-brush alpha streak texture: fill the filtered rect with any colour, get horizontal dry-brush streaks
export function gwFilters(p, o = {}) {
  const seed = o.seed || 7;
  return `<filter id="${p}-gw-wob" x="-4%" y="-8%" width="108%" height="116%" ${CI}>`
    + `<feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="${seed}" result="n"/>`
    + `<feDisplacementMap in="SourceGraphic" in2="n" scale="${f(o.wob || 4)}" xChannelSelector="R" yChannelSelector="G"/></filter>`
    + `<filter id="${p}-gw-soft" x="-5%" y="-10%" width="110%" height="120%" ${CI}>`
    + `<feTurbulence type="fractalNoise" baseFrequency="0.022 0.03" numOctaves="3" seed="${seed + 3}" result="n"/>`
    + `<feDisplacementMap in="SourceGraphic" in2="n" scale="${f(o.soft || 9)}" xChannelSelector="R" yChannelSelector="G" result="d"/>`
    + `<feGaussianBlur in="d" stdDeviation="${f(o.blur || 0.9)}"/></filter>`
    + `<filter id="${p}-gw-veil" x="-15%" y="-25%" width="130%" height="150%" ${CI}>`
    + `<feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="3" seed="${seed + 5}" result="n"/>`
    + `<feDisplacementMap in="SourceGraphic" in2="n" scale="18" xChannelSelector="R" yChannelSelector="G" result="d"/>`
    + `<feGaussianBlur in="d" stdDeviation="2.4"/></filter>`
    + `<filter id="${p}-gw-brush" x="0" y="0" width="100%" height="100%" ${CI}>`
    + `<feTurbulence type="fractalNoise" baseFrequency="${o.brushFreq || '0.0035 0.07'}" numOctaves="${o.brushOct || 3}" seed="${seed + 9}"${o.stitch ? ' stitchTiles="stitch"' : ''} result="n"/>`
    + `<feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${f(o.brushK || 3.2)} 0 0 0 ${f(-(o.brushK || 3.2) * 0.52)}" result="a"/>`
    + `<feComposite in="SourceGraphic" in2="a" operator="in"/></filter>`;
}

// The full-page PAPER (one static sheet, never repainted): large pigment mottle + fine tooth grain + horizontal paper
// fibre, as a grey image turned into a translucent pigment / paper-lift glaze (normal blending), plus a warm vignette. `p` = id prefix.
export function paperDefs(p, o = {}) {
  const kd = o.kd ?? 0.56, kl = o.kl ?? 0.6, DK = [0.36, 0.24, 0.2], LT = [1, 0.97, 0.9];
  return `<filter id="${p}-paper" x="-20" y="-20" width="1640" height="940" filterUnits="userSpaceOnUse" ${CI}>`
    + `<feTurbulence type="fractalNoise" baseFrequency="0.0055 0.009" numOctaves="4" seed="21" result="m0"/>${grey(2.6, 'm', 'm0')}`
    + `<feTurbulence type="fractalNoise" baseFrequency="0.028 0.04" numOctaves="3" seed="33" result="d0"/>${grey(2.2, 'd', 'd0')}`
    + `<feTurbulence type="fractalNoise" baseFrequency="0.42" numOctaves="1" seed="9" result="g0"/>${grey(2.2, 'g', 'g0')}`
    + `<feTurbulence type="fractalNoise" baseFrequency="0.0025 0.11" numOctaves="3" seed="5" result="b0"/>${grey(2.2, 'b', 'b0')}`
    + `<feComposite in="m" in2="d" operator="arithmetic" k2="0.55" k3="0.45" result="md"/>`
    + `<feComposite in="md" in2="g" operator="arithmetic" k2="0.8" k3="0.2" result="mdg"/>`
    + `<feComposite in="mdg" in2="b" operator="arithmetic" k2="0.9" k3="0.1" result="n"/>`
    // normal blending (a soft-light sheet costs a full-screen render surface every frame): the grey image becomes a
    // brown pigment glaze where it is dark and a cream paper lift where it is light, alpha = distance from mid-grey
    + `<feColorMatrix in="n" type="matrix" values="0 0 0 0 ${f(DK[0])} 0 0 0 0 ${f(DK[1])} 0 0 0 0 ${f(DK[2])} ${f(-kd)} 0 0 0 ${f(kd * 0.5)}" result="dk"/>`
    + `<feColorMatrix in="n" type="matrix" values="0 0 0 0 ${f(LT[0])} 0 0 0 0 ${f(LT[1])} 0 0 0 0 ${f(LT[2])} ${f(kl)} 0 0 0 ${f(-kl * 0.5)}" result="lt"/>`
    // + a thin chalky veil of paper over everything (gouache is opaque: every colour is lifted a little toward the
    // page, so nothing reads as a saturated screen colour); baked into the same static sheet (one composited layer)
    + `<feFlood flood-color="#FFF6E8" flood-opacity="${f(o.veil ?? 0.06)}" result="veil"/>`
    + `<feMerge><feMergeNode in="veil"/><feMergeNode in="dk"/><feMergeNode in="lt"/></feMerge></filter>`
    + `<radialGradient id="${p}-vig" cx="800" cy="470" r="980" gradientUnits="userSpaceOnUse" gradientTransform="translate(800 470) scale(1 0.72) translate(-800 -470)">`
    + `<stop offset="0.55" stop-color="#808080" stop-opacity="0"/><stop offset="0.85" stop-color="#5a4a40" stop-opacity="0.35"/><stop offset="1" stop-color="#3a2820" stop-opacity="0.7"/></radialGradient>`;
}
// the paper sheet markup (put it in a screen-fixed layer and isolate its data-ref on its own sheet)
export function paperSheet(p, ref) {
  return `<g data-ref="${ref}" class="gw-tex" pointer-events="none" aria-hidden="true">`
    + `<rect x="-20" y="-20" width="1640" height="940" filter="url(#${p}-paper)"/>`
    + `<rect x="-20" y="-20" width="1640" height="940" fill="url(#${p}-vig)"/></g>`;
}

// ---------------------------------------------------------------- geometry helpers (for filter-free parts)
// seeded jitter of a closed/open polyline along its normals (smooth value noise), amplitude a
export function jitter(pts, a, seed, closed = true) {
  const r = rng(seed), n = pts.length, k = [...Array(Math.ceil(n / 3) + 3)].map(() => r() * 2 - 1);
  return pts.map((p, i) => {
    const u = i / 3, j = Math.floor(u), t = u - j, s = t * t * (3 - 2 * t), w = k[j] * (1 - s) + k[j + 1] * s;
    const q = pts[(i + 1) % n], o = pts[(i - 1 + n) % n];
    let tx = q[0] - o[0], ty = q[1] - o[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    if (!closed && (i === 0 || i === n - 1)) return p;
    return [p[0] - ty * w * a, p[1] + tx * w * a];
  });
}
// a tapered dry-brush stroke (filled) from a to b bowed by `bow`, max width w
export function dryStroke(a, b, w, bow = 0) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  const m = [(a[0] + b[0]) / 2 + nx * bow, (a[1] + b[1]) / 2 + ny * bow];
  const p1 = [m[0] + nx * w / 2, m[1] + ny * w / 2], p2 = [m[0] - nx * w / 2, m[1] - ny * w / 2];
  return `M${f(a[0])} ${f(a[1])}Q${f(p1[0])} ${f(p1[1])} ${f(b[0])} ${f(b[1])}Q${f(p2[0])} ${f(p2[1])} ${f(a[0])} ${f(a[1])}Z`;
}
// an irregular round blot (painted dab) at (x, y), radius r
export function blot(x, y, r, seed, sq = 1) {
  const R = rng(seed), n = 7, pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = r * (0.72 + R() * 0.5); pts.push([x + Math.cos(a) * k, y + Math.sin(a) * k * sq]); }
  let d = '';
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; d += (i ? 'Q' : `M${f((pts[n - 1][0] + p[0]) / 2)} ${f((pts[n - 1][1] + p[1]) / 2)}Q`) + `${f(p[0])} ${f(p[1])} ${f(m[0])} ${f(m[1])}`; }
  return d + 'Z';
}
// A static gouache tile (userSpaceOnUse => lives in the referencing element's local coordinates):
// light + dark translucent blotches, a few dry-brush streaks in direction `ang`, fine paper flecks. Transparent base,
// so it is painted OVER a flat fill: `<path d fill=base/><path d fill=url(#id)/>`.
export function gouacheTile(id, o = {}) {
  const S = o.size || 64, R = rng(o.seed || 11), ang = o.ang ?? -18, dark = o.dark || '#6a4038', light = o.light || '#fffaf0';
  const kd = o.kd ?? 0.07, kl = o.kl ?? 0.16;
  let b = '';
  // blotches, wrapped at the tile edges so the tile is seamless
  const put = (fn) => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) b += fn(dx, dy); };
  for (let i = 0; i < (o.nBlot ?? 9); i++) {
    const x = R() * S, y = R() * S, r = S * (0.08 + R() * 0.14), dk = R() < 0.45, op = (dk ? kd : kl) * (0.6 + R() * 0.8), sd = (R() * 1e6) | 0;
    // wrap copies only where they reach into the tile
    const m = r * 1.35;
    if (x - r < 0 || x + r > S || y - r < 0 || y + r > S) put((dx, dy) => (x + dx + m > 0 && x + dx - m < S && y + dy + m > 0 && y + dy - m < S) ? `<path d="${blot(x + dx, y + dy, r, sd, 0.7)}" fill="${dk ? dark : light}" opacity="${f(op)}"/>` : '');
    else b += `<path d="${blot(x, y, r, sd, 0.7)}" fill="${dk ? dark : light}" opacity="${f(op)}"/>`;
  }
  const ca = Math.cos(ang * Math.PI / 180), sa = Math.sin(ang * Math.PI / 180);
  for (let i = 0; i < (o.nStroke ?? 7); i++) {
    const x = R() * S, y = R() * S, l = S * (0.25 + R() * 0.3), w = 0.8 + R() * 1.6, dk = R() < 0.4;
    const a = [x - ca * l / 2, y - sa * l / 2], c = [x + ca * l / 2, y + sa * l / 2];
    if (a[0] < 0 || c[0] > S || Math.min(a[1], c[1]) < 0 || Math.max(a[1], c[1]) > S) continue;
    b += `<path d="${dryStroke(a, c, w, (R() - 0.5) * 3)}" fill="${dk ? dark : light}" opacity="${f((dk ? kd : kl) * 1.4)}"/>`;
  }
  for (let i = 0; i < (o.nFleck ?? 14); i++) b += `<circle cx="${f(R() * S)}" cy="${f(R() * S)}" r="${f(0.35 + R() * 0.6)}" fill="${R() < 0.5 ? dark : light}" opacity="${f(0.1 + R() * 0.12)}"/>`;
  return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${S}" height="${S}"${o.transform ? ` patternTransform="${o.transform}"` : ''}>${b}</pattern>`;
}

// Soft wet-in-wet glazes WITHOUT filters: one radial gradient per paint (objectBoundingBox, so it fits any ellipse),
// then as many ellipses as needed. glazeGrads('pb', { shade: v('plumeDeep') }) -> #pb-gz-shade;
// glaze('pb', 'shade', cx, cy, rx, ry, rot, opacity) -> an ellipse that fades to nothing at its rim.
export function glazeGrads(p, paints) {
  return Object.entries(paints).map(([k, c]) => `<radialGradient id="${p}-gz-${k}"><stop offset="0" stop-color="${c}" stop-opacity="1"/>`
    + `<stop offset="0.45" stop-color="${c}" stop-opacity="0.7"/><stop offset="0.75" stop-color="${c}" stop-opacity="0.25"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`).join('');
}
export function glaze(p, k, cx, cy, rx, ry, rot = 0, op = 1, extra = '') {
  return `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}"${rot ? ` transform="rotate(${f(rot)} ${f(cx)} ${f(cy)})"` : ''} fill="url(#${p}-gz-${k})" class="gw-tex"${op !== 1 ? ` opacity="${f(op)}"` : ''}${extra}/>`;
}
