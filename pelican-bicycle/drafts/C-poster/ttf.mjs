// Minimal TrueType (glyf) outline extractor -> SVG path strings. Supports .ttf and .ttc (first font).
import fs from 'node:fs';
export function loadFont(file, index = 0) {
  const buf = fs.readFileSync(file);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let base = 0;
  if (buf.toString('latin1', 0, 4) === 'ttcf') base = dv.getUint32(12 + 4 * index);
  const numTables = dv.getUint16(base + 4);
  const tables = {};
  for (let i = 0; i < numTables; i++) {
    const o = base + 12 + i * 16;
    tables[buf.toString('latin1', o, o + 4)] = { off: dv.getUint32(o + 8), len: dv.getUint32(o + 12) };
  }
  const head = tables.head.off;
  const upem = dv.getUint16(head + 18);
  const locFmt = dv.getInt16(head + 50);
  const numGlyphs = dv.getUint16(tables.maxp.off + 4);
  const hhea = tables.hhea.off; const numH = dv.getUint16(hhea + 34);
  const hmtx = tables.hmtx.off;
  const adv = g => dv.getUint16(hmtx + 4 * Math.min(g, numH - 1));
  const loca = i => locFmt ? dv.getUint32(tables.loca.off + 4 * i) : 2 * dv.getUint16(tables.loca.off + 2 * i);
  // cmap format 4 (BMP)
  const cmap = tables.cmap.off; const nsub = dv.getUint16(cmap + 2); let sub = -1;
  for (let i = 0; i < nsub; i++) {
    const pid = dv.getUint16(cmap + 4 + 8 * i), eid = dv.getUint16(cmap + 6 + 8 * i), off = dv.getUint32(cmap + 8 + 8 * i);
    if (dv.getUint16(cmap + off) === 4 && (pid === 3 && eid === 1 || pid === 0)) { sub = cmap + off; if (pid === 3) break; }
  }
  function gid(code) {
    const segX2 = dv.getUint16(sub + 6); const ends = sub + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ros = deltas + segX2;
    for (let i = 0; i < segX2 / 2; i++) {
      const end = dv.getUint16(ends + 2 * i); if (code > end) continue;
      const start = dv.getUint16(starts + 2 * i); if (code < start) return 0;
      const delta = dv.getInt16(deltas + 2 * i), ro = dv.getUint16(ros + 2 * i);
      if (!ro) return (code + delta) & 0xffff;
      const g = dv.getUint16(ros + 2 * i + ro + 2 * (code - start));
      return g ? (g + delta) & 0xffff : 0;
    }
    return 0;
  }
  function contours(g, m = [1, 0, 0, 1, 0, 0]) {
    const o = tables.glyf.off + loca(g); if (loca(g + 1) === loca(g)) return [];
    const nc = dv.getInt16(o); let p = o + 10; const out = [];
    const T = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
    if (nc >= 0) {
      const ends = []; for (let i = 0; i < nc; i++) { ends.push(dv.getUint16(p)); p += 2; }
      const n = ends[nc - 1] + 1; const il = dv.getUint16(p); p += 2 + il;
      const flags = []; while (flags.length < n) { const f = dv.getUint8(p++); flags.push(f); if (f & 8) { let r = dv.getUint8(p++); while (r--) flags.push(f); } }
      const xs = [], ys = []; let v = 0;
      for (const f of flags) { if (f & 2) { const d = dv.getUint8(p++); v += f & 16 ? d : -d; } else if (!(f & 16)) { v += dv.getInt16(p); p += 2; } xs.push(v); }
      v = 0;
      for (const f of flags) { if (f & 4) { const d = dv.getUint8(p++); v += f & 32 ? d : -d; } else if (!(f & 32)) { v += dv.getInt16(p); p += 2; } ys.push(v); }
      let s = 0;
      for (const e of ends) { const c = []; for (let i = s; i <= e; i++) { const [x, y] = T(xs[i], ys[i]); c.push({ x, y, on: !!(flags[i] & 1) }); } out.push(c); s = e + 1; }
    } else {
      let more = true;
      while (more) {
        const fl = dv.getUint16(p), gi = dv.getUint16(p + 2); p += 4; let dx, dy;
        if (fl & 1) { dx = dv.getInt16(p); dy = dv.getInt16(p + 2); p += 4; } else { dx = dv.getInt8(p); dy = dv.getInt8(p + 1); p += 2; }
        let a = 1, b = 0, c = 0, d = 1;
        if (fl & 8) { a = d = dv.getInt16(p) / 16384; p += 2; } else if (fl & 64) { a = dv.getInt16(p) / 16384; d = dv.getInt16(p + 2) / 16384; p += 4; } else if (fl & 128) { a = dv.getInt16(p) / 16384; b = dv.getInt16(p + 2) / 16384; c = dv.getInt16(p + 4) / 16384; d = dv.getInt16(p + 6) / 16384; p += 8; }
        const mm = [a * m[0] + b * m[2], a * m[1] + b * m[3], c * m[0] + d * m[2], c * m[1] + d * m[3], ...T(dx, dy)];
        out.push(...contours(gi, mm)); more = !!(fl & 32);
      }
    }
    return out;
  }
  // text -> path d; size = em size in px; returns {d, width}
  function text(str, { size = 100, x = 0, y = 0, track = 0, sx = 1 } = {}) {
    const k = size / upem; let pen = 0; let d = '';
    const f = v => (Math.round(v * 100) / 100).toString();
    for (const ch of str) {
      const g = gid(ch.codePointAt(0));
      for (const c of contours(g)) {
        const P = c.map(q => ({ x: x + (pen + q.x * sx) * k, y: y - q.y * k, on: q.on }));
        // quadratic spline -> path
        let start = P.findIndex(q => q.on); let pts;
        if (start < 0) { const a = P[0], b = P[1]; pts = [{ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, on: true }, ...P.slice(1), P[0]]; start = 0; }
        else pts = [...P.slice(start), ...P.slice(0, start)];
        d += `M${f(pts[0].x)} ${f(pts[0].y)}`;
        for (let i = 1; i <= pts.length; i++) {
          const q = pts[i % pts.length];
          if (q.on) { if (i === pts.length) break; d += `L${f(q.x)} ${f(q.y)}`; continue; }
          const nx = pts[(i + 1) % pts.length]; let e;
          if (nx.on) { e = nx; i++; } else e = { x: (q.x + nx.x) / 2, y: (q.y + nx.y) / 2 };
          d += `Q${f(q.x)} ${f(q.y)} ${f(e.x)} ${f(e.y)}`;
          if (e === pts[0] || i >= pts.length) break;
        }
        d += 'Z';
      }
      pen += adv(g) * sx + track / k;
    }
    return { d, width: pen * k - track };
  }
  return { upem, gid, text, adv };
}
