// Turn font glyphs into brush strokes: rasterise -> Zhang-Suen skeleton -> trace -> merge through
// junctions -> split at sharp corners. Returns polylines in em units (0..1, y down) with a
// direction-normalised order (horizontals left→right, others top→bottom), ready for a brush.

export function skeletonStrokes(font, ch, res = 140) {
  const polys = font.polys(ch);
  const W = res, H = res;
  const img = new Uint8Array(W * H);
  // scanline fill, nonzero winding
  const edges = [];
  for (const p of polys) for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    if (a[1] === b[1]) continue;
    edges.push([a[0] * res, a[1] * res, b[0] * res, b[1] * res]);
  }
  for (let y = 0; y < H; y++) {
    const sy = y + 0.5, xs = [];
    for (const [x0, y0, x1, y1] of edges) {
      if ((sy >= y0 && sy < y1) || (sy >= y1 && sy < y0)) xs.push([x0 + (sy - y0) / (y1 - y0) * (x1 - x0), y1 > y0 ? 1 : -1]);
    }
    xs.sort((p, q) => p[0] - q[0]);
    let wind = 0;
    for (let i = 0; i < xs.length - 1; i++) {
      wind += xs[i][1];
      if (wind !== 0) for (let x = Math.max(0, Math.ceil(xs[i][0] - 0.5)); x < Math.min(W, xs[i + 1][0] - 0.5); x++) img[y * W + x] = 1;
    }
  }
  // Zhang–Suen thinning
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : img[y * W + x];
  let changed = true;
  while (changed) {
    changed = false;
    for (const step of [0, 1]) {
      const del = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!img[y * W + x]) continue;
        const p = [at(x, y - 1), at(x + 1, y - 1), at(x + 1, y), at(x + 1, y + 1), at(x, y + 1), at(x - 1, y + 1), at(x - 1, y), at(x - 1, y - 1)];
        const B = p.reduce((s, v) => s + v, 0);
        if (B < 2 || B > 6) continue;
        let A = 0; for (let i = 0; i < 8; i++) if (!p[i] && p[(i + 1) % 8]) A++;
        if (A !== 1) continue;
        if (step === 0 ? (p[0] * p[2] * p[4] === 0 && p[2] * p[4] * p[6] === 0) : (p[0] * p[2] * p[6] === 0 && p[0] * p[4] * p[6] === 0)) del.push(y * W + x);
      }
      for (const i of del) img[i] = 0;
      if (del.length) changed = true;
    }
  }
  // m-adjacency neighbours (no diagonal when an orthogonal path exists)
  const nb = (x, y) => {
    const o = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (at(x + dx, y + dy)) o.push([x + dx, y + dy]);
    for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) if (at(x + dx, y + dy) && !at(x + dx, y) && !at(x, y + dy)) o.push([x + dx, y + dy]);
    return o;
  };
  const key = (x, y) => y * W + x;
  const deg = new Map();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (img[key(x, y)]) deg.set(key(x, y), nb(x, y).length);
  const isNode = k => deg.get(k) !== 2;
  const used = new Set();
  const ek = (a, b) => a < b ? a + ',' + b : b + ',' + a;
  const segs = [];
  const walk = (sx, sy, nx, ny) => {
    const path = [[sx, sy]];
    let px = sx, py = sy, cx = nx, cy = ny;
    used.add(ek(key(px, py), key(cx, cy)));
    while (true) {
      path.push([cx, cy]);
      if (isNode(key(cx, cy))) break;
      const nn = nb(cx, cy).filter(([x, y]) => !(x === px && y === py) && !used.has(ek(key(cx, cy), key(x, y))));
      if (!nn.length) break;
      used.add(ek(key(cx, cy), key(nn[0][0], nn[0][1])));
      px = cx; py = cy; [cx, cy] = nn[0];
    }
    return path;
  };
  for (const [k, d] of deg) {
    if (d === 2) continue;
    const x = k % W, y = Math.floor(k / W);
    for (const [nx, ny] of nb(x, y)) if (!used.has(ek(k, key(nx, ny)))) segs.push(walk(x, y, nx, ny));
  }
  // loops without nodes
  for (const [k, d] of deg) {
    if (d !== 2) continue;
    const x = k % W, y = Math.floor(k / W);
    for (const [nx, ny] of nb(x, y)) if (!used.has(ek(k, key(nx, ny)))) segs.push(walk(x, y, nx, ny));
  }
  // prune short spurs (one free end)
  const endDeg = p => deg.get(key(p[0], p[1]));
  let S = segs.filter(s => {
    const len = s.length;
    const free = (endDeg(s[0]) === 1) + (endDeg(s[s.length - 1]) === 1);
    if (free === 1 && len < res * 0.07) return false;
    if (free === 0 && len < 3) return false;
    return true;
  });
  // merge through junctions: pair segments whose directions continue straight
  const dirAt = (s, atStart) => {
    const n = Math.min(s.length - 1, Math.round(res * 0.08));
    const a = atStart ? s[0] : s[s.length - 1], b = atStart ? s[n] : s[s.length - 1 - n];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l];
  };
  const close = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= 3.5;
  let merged = true;
  while (merged) {
    merged = false;
    let best = null;
    for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
      for (const ea of [0, 1]) for (const eb of [0, 1]) {
        const pa = ea ? S[i][S[i].length - 1] : S[i][0], pb = eb ? S[j][S[j].length - 1] : S[j][0];
        if (!close(pa, pb) || endDeg(pa) === 1 || endDeg(pb) === 1) continue;
        const da = dirAt(S[i], !ea), db = dirAt(S[j], !eb);
        // outgoing directions from the junction; straight continuation = opposite
        const dot = da[0] * db[0] + da[1] * db[1];
        if (dot < -0.86 && (!best || dot < best.dot)) best = { i, j, ea, eb, dot };
      }
    }
    if (best) {
      const { i, j, ea, eb } = best;
      const A = ea ? S[i] : S[i].slice().reverse(); // A ends at junction
      const B = eb ? S[j].slice().reverse() : S[j]; // B starts at junction
      const m = [...A, ...B.slice(1)];
      S = S.filter((_, k) => k !== i && k !== j); S.push(m); merged = true;
    }
  }
  // smooth, split at sharp corners, normalise direction
  const out = [];
  for (const s of S) {
    let pts = s.map(p => [(p[0] + 0.5) / res, (p[1] + 0.5) / res]);
    // moving average
    const sm = pts.map((_, i) => { let x = 0, y = 0, c = 0; for (let k = -2; k <= 2; k++) { const q = pts[Math.max(0, Math.min(pts.length - 1, i + k))]; x += q[0]; y += q[1]; c++; } return [x / c, y / c]; });
    sm[0] = pts[0]; sm[sm.length - 1] = pts[pts.length - 1];
    pts = sm;
    // split where direction turns sharply
    const pieces = []; let cur = [pts[0]];
    const win = Math.max(2, Math.round(res * 0.035));
    for (let i = 1; i < pts.length; i++) {
      cur.push(pts[i]);
      if (i >= win && i < pts.length - win) {
        const a = pts[i - win], b = pts[i], c = pts[i + win];
        const u = [b[0] - a[0], b[1] - a[1]], v = [c[0] - b[0], c[1] - b[1]];
        const cs = (u[0] * v[0] + u[1] * v[1]) / ((Math.hypot(...u) * Math.hypot(...v)) || 1);
        if (cs < 0.45 && cur.length > win) {
          // local minimum check: split only at the sharpest point in the window
          let ok = true;
          for (let k = Math.max(win, i - 2); k <= Math.min(pts.length - win - 1, i + 2); k++) {
            if (k === i) continue;
            const a2 = pts[k - win], b2 = pts[k], c2 = pts[k + win];
            const u2 = [b2[0] - a2[0], b2[1] - a2[1]], v2 = [c2[0] - b2[0], c2[1] - b2[1]];
            const cs2 = (u2[0] * v2[0] + u2[1] * v2[1]) / ((Math.hypot(...u2) * Math.hypot(...v2)) || 1);
            if (cs2 < cs) ok = false;
          }
          if (ok) { pieces.push(cur); cur = [pts[i]]; }
        }
      }
    }
    pieces.push(cur);
    for (let p of pieces) {
      if (p.length < 2) continue;
      const a = p[0], b = p[p.length - 1];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const horiz = Math.abs(dx) > Math.abs(dy) * 1.25;
      if (horiz ? dx < 0 : dy < 0) p = p.slice().reverse();
      const len = p.reduce((s, q, i) => i ? s + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0, 0);
      if (len < 0.025) continue;
      out.push({ pts: p, horiz, len });
    }
  }
  return out;
}
