// Tiny TrueType glyph -> SVG path extractor (glyf outlines, cmap format 4, .ttf/.ttc).
// Used only at generation time so the output SVG carries plain paths and no font references.
import fs from 'node:fs';

export function openFont(file, face = 0) {
  const buf = fs.readFileSync(file);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const tag = o => String.fromCharCode(buf[o], buf[o + 1], buf[o + 2], buf[o + 3]);
  let base = 0;
  if (tag(0) === 'ttcf') base = dv.getUint32(12 + 4 * face);
  const tables = {};
  const nt = dv.getUint16(base + 4);
  for (let i = 0; i < nt; i++) {
    const o = base + 12 + 16 * i;
    tables[tag(o)] = dv.getUint32(o + 8);
  }
  const upem = dv.getUint16(tables.head + 18);
  const longLoca = dv.getInt16(tables.head + 50) === 1;
  const nH = dv.getUint16(tables.hhea + 34);
  const loca = i => longLoca ? dv.getUint32(tables.loca + 4 * i) : 2 * dv.getUint16(tables.loca + 2 * i);
  const advance = g => dv.getUint16(tables.hmtx + 4 * Math.min(g, nH - 1));

  // cmap: find a format-4 unicode subtable
  let sub = -1;
  const cm = tables.cmap, ns = dv.getUint16(cm + 2);
  for (let i = 0; i < ns; i++) {
    const pid = dv.getUint16(cm + 4 + 8 * i), eid = dv.getUint16(cm + 6 + 8 * i);
    const off = cm + dv.getUint32(cm + 8 + 8 * i);
    if (dv.getUint16(off) === 4 && ((pid === 3 && eid === 1) || pid === 0)) { sub = off; if (pid === 3) break; }
  }
  function glyphId(code) {
    const segs = dv.getUint16(sub + 6) / 2;
    const endO = sub + 14, startO = endO + 2 * segs + 2, deltaO = startO + 2 * segs, roO = deltaO + 2 * segs;
    for (let i = 0; i < segs; i++) {
      const end = dv.getUint16(endO + 2 * i);
      if (code > end) continue;
      const start = dv.getUint16(startO + 2 * i);
      if (code < start) return 0;
      const delta = dv.getInt16(deltaO + 2 * i), ro = dv.getUint16(roO + 2 * i);
      if (!ro) return (code + delta) & 0xffff;
      const g = dv.getUint16(roO + 2 * i + ro + 2 * (code - start));
      return g ? (g + delta) & 0xffff : 0;
    }
    return 0;
  }
  function contours(g, M = [1, 0, 0, 1, 0, 0], depth = 0) {
    const s = loca(g), e = loca(g + 1);
    if (s === e || depth > 6) return [];
    let p = tables.glyf + s;
    const nc = dv.getInt16(p); p += 10;
    const tf = (x, y) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];
    const out = [];
    if (nc >= 0) {
      const ends = [];
      for (let i = 0; i < nc; i++) { ends.push(dv.getUint16(p)); p += 2; }
      const n = nc ? ends[nc - 1] + 1 : 0;
      p += 2 + dv.getUint16(p);
      const fl = [];
      while (fl.length < n) { const f = dv.getUint8(p++); fl.push(f); if (f & 8) { let r = dv.getUint8(p++); while (r--) fl.push(f); } }
      const xs = [], ys = [];
      let v = 0;
      for (const f of fl) { if (f & 2) { const d = dv.getUint8(p++); v += (f & 16) ? d : -d; } else if (!(f & 16)) { v += dv.getInt16(p); p += 2; } xs.push(v); }
      v = 0;
      for (const f of fl) { if (f & 4) { const d = dv.getUint8(p++); v += (f & 32) ? d : -d; } else if (!(f & 32)) { v += dv.getInt16(p); p += 2; } ys.push(v); }
      let st = 0;
      for (const en of ends) {
        const c = [];
        for (let i = st; i <= en; i++) { const [x, y] = tf(xs[i], ys[i]); c.push({ x, y, on: !!(fl[i] & 1) }); }
        out.push(c); st = en + 1;
      }
    } else {
      let more = true;
      while (more) {
        const flags = dv.getUint16(p), gi = dv.getUint16(p + 2); p += 4;
        let dx, dy;
        if (flags & 1) { dx = dv.getInt16(p); dy = dv.getInt16(p + 2); p += 4; } else { dx = dv.getInt8(p); dy = dv.getInt8(p + 1); p += 2; }
        let a = 1, b = 0, c = 0, d = 1;
        if (flags & 8) { a = d = dv.getInt16(p) / 16384; p += 2; }
        else if (flags & 64) { a = dv.getInt16(p) / 16384; d = dv.getInt16(p + 2) / 16384; p += 4; }
        else if (flags & 128) { a = dv.getInt16(p) / 16384; b = dv.getInt16(p + 2) / 16384; c = dv.getInt16(p + 4) / 16384; d = dv.getInt16(p + 6) / 16384; p += 8; }
        const m2 = [a, b, c, d, dx, dy];
        const comp = [M[0] * m2[0] + M[2] * m2[1], M[1] * m2[0] + M[3] * m2[1], M[0] * m2[2] + M[2] * m2[3], M[1] * m2[2] + M[3] * m2[3], M[0] * m2[4] + M[2] * m2[5] + M[4], M[1] * m2[4] + M[3] * m2[5] + M[5]];
        out.push(...contours(gi, comp, depth + 1));
        more = !!(flags & 32);
      }
    }
    return out;
  }
  // Returns an SVG path for one character, scaled so 1em = size, origin at the em-box top-left, y down.
  function glyph(ch, size, ox = 0, oy = 0, { sx = 1, sy = 1, skew = 0, rot = 0 } = {}) {
    const g = glyphId(ch.codePointAt(0));
    const k = size / upem;
    const asc = 0.88 * upem; // em-box top (approx for CJK)
    const cx = upem / 2, cy = upem / 2;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const T = (x, y) => {
      // font units -> em box (y down), then local tweaks about the em centre
      let u = x - cx, v = (asc - y) - cy;
      u = u * sx + v * skew; v = v * sy;
      const ru = u * cr - v * sr, rv = u * sr + v * cr;
      return [ox + (ru + cx) * k, oy + (rv + cy) * k];
    };
    let d = '';
    const f = n => (Math.round(n * 10) / 10).toString();
    for (const c of contours(g)) {
      if (!c.length) continue;
      let start = c.findIndex(q => q.on);
      let pts;
      if (start < 0) { const a = c[0], b = c[1] || c[0]; pts = [{ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, on: true }, ...c.slice(1), c[0]]; start = 0; }
      else pts = [...c.slice(start), ...c.slice(0, start)];
      const P = q => T(q.x, q.y);
      let [x0, y0] = P(pts[0]);
      d += `M${f(x0)} ${f(y0)}`;
      const n = pts.length;
      for (let i = 1; i <= n; i++) {
        const q = pts[i % n];
        if (q.on) { const [x, y] = P(q); d += `L${f(x)} ${f(y)}`; }
        else {
          const nx = pts[(i + 1) % n];
          let ex, ey;
          if (nx.on) { [ex, ey] = P(nx); i++; }
          else { [ex, ey] = T((q.x + nx.x) / 2, (q.y + nx.y) / 2); }
          const [qx, qy] = P(q);
          d += `Q${f(qx)} ${f(qy)} ${f(ex)} ${f(ey)}`;
        }
      }
      d += 'Z';
    }
    return { d, adv: advance(g) * k };
  }
  // Flattened outline polygons in em units (0..1, y down) for rasterising.
  function polys(ch, steps = 6) {
    const g = glyphId(ch.codePointAt(0));
    const asc = 0.88 * upem;
    const T = (x, y) => [x / upem, (asc - y) / upem];
    const out = [];
    for (const c of contours(g)) {
      if (!c.length) continue;
      let st = c.findIndex(q => q.on);
      let pts = st < 0 ? [{ x: (c[0].x + c[1].x) / 2, y: (c[0].y + c[1].y) / 2, on: true }, ...c.slice(1), c[0]] : [...c.slice(st), ...c.slice(0, st)];
      const n = pts.length, poly = [T(pts[0].x, pts[0].y)];
      let cur = pts[0];
      for (let i = 1; i <= n; i++) {
        const q = pts[i % n];
        if (q.on) { poly.push(T(q.x, q.y)); cur = q; continue; }
        const nx = pts[(i + 1) % n];
        const e = nx.on ? nx : { x: (q.x + nx.x) / 2, y: (q.y + nx.y) / 2, on: true };
        if (nx.on) i++;
        for (let k = 1; k <= steps; k++) { const t = k / steps, u = 1 - t; poly.push(T(u * u * cur.x + 2 * u * t * q.x + t * t * e.x, u * u * cur.y + 2 * u * t * q.y + t * t * e.y)); }
        cur = e;
      }
      out.push(poly);
    }
    return out;
  }
  return { glyph, polys, upem };
}
