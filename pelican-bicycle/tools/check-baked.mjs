// Verify the zero-JS SVG (dist/pelican-bicycle.svg) against the live page.
// usage: node tools/check-baked.mjs [--file dist/pelican-bicycle.svg] [--out shots/baker/check] [--phases 48] [--quick]
//   static   bytes / gzip, forbidden tokens (<script, on*=, javascript:, external href, <image, <foreignObject, var(--),
//            <title>/<desc>, XML parse, SMIL sanity (values/keyTimes counts, monotone keyTimes, d command signatures)
//   mechanics wheel/crank/chain loops (same dur, 3.000 ratio, −48 links per crank turn, clockwise)
//   fidelity baked (inline, pauseAnimations + setCurrentTime) vs live renderAt at N loop phases: full-frame and rider
//            SSIM + mean abs diff; live | baked | diff strips for 4 phases
//   rig       240 probe times: every rider slot's CTM (origin + a point 40 u along the bone) baked vs live; ball of
//            foot → pedal spindle and wrist → grip distances in the baked file
//   loop      frame(T) vs frame(0), T−1/60 seam ratio, 10T and 100T drift
//   embeds    <img> (1600×900 and 600×338), CSS background, <object>: frames at 0 / 0.37 / 0.81 s must differ
//   fallback  every <animate*> removed: the base attributes must render the t0 hero pose (SSIM vs live t0)
// Writes <out>/check-baked.json. Exit 1 on a hard failure.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// TEMPORARY shim (contract request to the lead): main.js must forward `loopT` from renderAt() to solvePose() so the
// rig's story schedules (gaze, blinks, gusts) repeat exactly every baked loop. Until it does, the page's main.js is
// patched in flight for this tool only (a no-op once main.js mentions loopT). Disable with --no-loopT-shim.
async function loopTShim(page) {
  if (process.argv.includes('--no-loopT-shim')) return false;
  const src = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');
  if (/loopT/.test(src)) return false;
  const patched = src
    .replace(/coasting: state\.coasting, events: state\.events \}\)/, 'coasting: state.coasting, events: state.events, loopT: state.loopT })')
    .replace(/state\.events = o\.events \|\| \[\];/, 'state.events = o.events || []; state.loopT = o.loopT;');
  if (patched === src) return false;
  await page.route(/\/src\/main\.js(\?.*)?$/, route => route.fulfill({ status: 200, contentType: 'text/javascript', body: patched }));
  console.log('note: main.js does not forward loopT yet — using the in-flight shim (see contractRequests)');
  return true;
}
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const file = path.resolve(ROOT, arg('file', 'dist/pelican-bicycle.svg'));
const out = path.resolve(ROOT, arg('out', 'shots/baker/check'));
const quick = !!arg('quick', false);
const NPH = +arg('phases', quick ? 12 : 48);
fs.mkdirSync(out, { recursive: true });
const svgText = fs.readFileSync(file, 'utf8');
const meta = (() => { try { return JSON.parse(fs.readFileSync(file.replace(/\.svg$/, '.bake.json'), 'utf8')); } catch { return null; } })();
const T = meta?.stats?.period ?? +(svgText.match(/baked loop: ([\d.]+)s/) || [])[1] ?? 4;
const START = meta?.stats?.start ?? 24;
const TOD = meta?.opts?.tod ?? 0.70, CAM = meta?.opts?.cam ?? 'wide', CAD = meta?.opts?.cadence ?? 60;
const report = { file: path.relative(ROOT, file), T, start: START, hard: [], soft: [] };
const hard = m => { report.hard.push(m); console.log('  FAIL ' + m); };
const soft = m => { report.soft.push(m); console.log('  warn ' + m); };

// ---------------------------------------------------------------- tiny PNG codec (8-bit RGB/RGBA, non-interlaced)
function decodePNG(buf) {
  let p = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp;
  const px = new Uint8Array(w * h * 4);
  let prev = new Uint8Array(stride), cur = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = row[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[x] = v & 255;
    }
    for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; px[o] = cur[x * bpp]; px[o + 1] = cur[x * bpp + 1]; px[o + 2] = cur[x * bpp + 2]; px[o + 3] = 255; }
    [prev, cur] = [cur, prev];
  }
  return { w, h, px };
}
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = b => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function encodePNG({ w, h, px }) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4, r = y * (w * 3 + 1) + 1 + x * 3; raw[r] = px[o]; raw[r + 1] = px[o + 1]; raw[r + 2] = px[o + 2]; }
  const chunk = (type, data) => { const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length, 0); b.write(type, 4, 'ascii'); data.copy(b, 8); b.writeUInt32BE(crc32(b.subarray(4, 8 + data.length)), 8 + data.length); return b; };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}
// SSIM on luma, 8×8 windows, stride 4 (optionally inside a crop box); mean abs diff over RGB (0..1)
function compare(A, B, box) {
  const { w } = A, [x0, y0, x1, y1] = box || [0, 0, A.w, A.h];
  const L = (img, x, y) => { const o = (y * w + x) * 4; return 0.299 * img.px[o] + 0.587 * img.px[o + 1] + 0.114 * img.px[o + 2]; };
  const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2;
  let s = 0, n = 0, mad = 0, mn = 0;
  for (let y = y0; y + 8 <= y1; y += 4) for (let x = x0; x + 8 <= x1; x += 4) {
    let ma = 0, mb = 0, va = 0, vb = 0, cv = 0;
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const a = L(A, x + i, y + j), b = L(B, x + i, y + j); ma += a; mb += b; va += a * a; vb += b * b; cv += a * b; }
    ma /= 64; mb /= 64; va = va / 64 - ma * ma; vb = vb / 64 - mb * mb; cv = cv / 64 - ma * mb;
    s += ((2 * ma * mb + C1) * (2 * cv + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2)); n++;
  }
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { const o = (y * w + x) * 4; mad += Math.abs(A.px[o] - B.px[o]) + Math.abs(A.px[o + 1] - B.px[o + 1]) + Math.abs(A.px[o + 2] - B.px[o + 2]); mn += 3; }
  return { ssim: n ? s / n : 1, mad: mad / mn / 255 };
}
function diffStrip(A, B, box) {
  const [x0, y0, x1, y1] = box, cw = x1 - x0, ch = y1 - y0, W = cw * 3, px = new Uint8Array(W * ch * 4);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const o = ((y + y0) * A.w + x + x0) * 4;
    const put = (k, r, g, b) => { const q = (y * W + k * cw + x) * 4; px[q] = r; px[q + 1] = g; px[q + 2] = b; px[q + 3] = 255; };
    put(0, A.px[o], A.px[o + 1], A.px[o + 2]); put(1, B.px[o], B.px[o + 1], B.px[o + 2]);
    const d = Math.min(255, 3 * (Math.abs(A.px[o] - B.px[o]) + Math.abs(A.px[o + 1] - B.px[o + 1]) + Math.abs(A.px[o + 2] - B.px[o + 2])) / 3);
    put(2, d, d * 0.35, 255 - d * 0.8 > 0 ? 40 : 0);
  }
  return encodePNG({ w: W, h: ch, px });
}

// ---------------------------------------------------------------- 1. static checks
console.log(`check-baked ${report.file}  (T=${T}s, start=${START}, tod=${TOD}, cam=${CAM})`);
const bytes = Buffer.byteLength(svgText), gz = zlib.gzipSync(svgText, { level: 9 }).length;
report.bytes = bytes; report.gzip = gz;
console.log(`static: ${(bytes / 1024).toFixed(1)} KB raw · ${(gz / 1024).toFixed(1)} KB gzip`);
if (bytes > 1.5 * 1024 * 1024) hard(`size ${(bytes / 1024).toFixed(0)} KB > 1536 KB`);
else if (bytes > 1.2 * 1024 * 1024) soft(`size ${(bytes / 1024).toFixed(0)} KB > 1229 KB (10-point target)`);
if (gz > 500 * 1024) hard(`gzip ${(gz / 1024).toFixed(0)} KB > 500 KB`); else if (gz > 300 * 1024) soft(`gzip ${(gz / 1024).toFixed(0)} KB > 300 KB (10-point target)`);
const FORBID = { '<script': /<script/gi, 'on*=': /\son[a-z]+=/gi, 'javascript:': /javascript:/gi, 'href="http': /href="http/gi, '<image': /<image\b/gi, '<foreignObject': /<foreignObject/gi, 'var(--': /var\(--/g };
report.forbidden = {};
for (const [k, re] of Object.entries(FORBID)) { const n = (svgText.match(re) || []).length; report.forbidden[k] = n; if (n) hard(`${n}× ${k}`); }
if (!/<title[^>]*>[^<]+<\/title>/.test(svgText)) hard('no <title>');
if (!/<desc[^>]*>[^<]+<\/desc>/.test(svgText)) hard('no <desc>');

let srv, base;
{ const s = await serve(0); srv = s.srv; base = `http://127.0.0.1:${s.port}`; }
const browser = await chromium.launch();
const errors = [];
const newPage = async (w = 1600, h = 900) => { const p = await browser.newPage({ viewport: { width: w, height: h } }); p.on('pageerror', e => errors.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); }); return p; };

// baked page: the SVG inlined (so SMIL can be paused and scrubbed)
const bp = await newPage();
await bp.setContent(`<!doctype html><html><body style="margin:0;background:#000;overflow:hidden"><div id="host" style="width:1600px;height:900px"></div></body></html>`);
const parse = await bp.evaluate(txt => {
  const doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
  const perr = doc.querySelector('parsererror');
  if (perr) return { error: perr.textContent.slice(0, 300) };
  const host = document.getElementById('host');
  host.appendChild(document.importNode(doc.documentElement, true));
  const svg = host.querySelector('svg'); svg.setAttribute('width', '1600'); svg.setAttribute('height', '900'); svg.id = 'baked';
  svg.pauseAnimations();
  const anims = [...svg.querySelectorAll('animate,animateTransform,animateMotion,set')];
  const issues = [];
  const sig = d => (d.match(/[MmLlHhVvCcSsQqTtAaZz]/g) || []).join('');
  for (const a of anims) {
    const vals = (a.getAttribute('values') || '').split(';'), kt = a.getAttribute('keyTimes');
    const name = (a.parentElement.id || a.parentElement.tagName) + ' ' + a.getAttribute('attributeName');
    if (kt) {
      const k = kt.split(';').map(Number);
      if (k.length !== vals.length) issues.push(`${name}: ${vals.length} values vs ${k.length} keyTimes`);
      if (k[0] !== 0) issues.push(`${name}: keyTimes must start at 0`);
      if (a.getAttribute('calcMode') !== 'discrete' && Math.abs(k[k.length - 1] - 1) > 1e-9) issues.push(`${name}: keyTimes must end at 1`);
      for (let i = 1; i < k.length; i++) if (k[i] < k[i - 1]) { issues.push(`${name}: keyTimes decrease`); break; }
    }
    if (a.getAttribute('calcMode') === 'spline' && !a.getAttribute('keySplines')) issues.push(`${name}: spline without keySplines`);
    if (a.getAttribute('attributeName') === 'd' && a.getAttribute('calcMode') !== 'discrete') { const s0 = sig(vals[0]); if (!vals.every(v => sig(v) === s0)) issues.push(`${name}: d command signatures differ`); }
  }
  // mechanics: wheel / crank / chain loops
  const rot = id => { const e = svg.querySelector('#' + id); if (!e) return null; const a = [...e.children].find(c => c.tagName === 'animateTransform' && c.getAttribute('type') === 'rotate' && (c.getAttribute('values') || '').split(';').length === 2); if (!a) return null; const v = a.getAttribute('values').split(';').map(s => +s.trim().split(/\s+/)[0]); return { deg: v[1] - v[0], dur: parseFloat(a.getAttribute('dur')) }; };
  const chainA = [...svg.querySelectorAll('#j-chain animate[attributeName="stroke-dashoffset"]')].map(a => { const v = a.getAttribute('values').split(';').map(Number); return { d: v[v.length - 1] - v[0], dur: parseFloat(a.getAttribute('dur')), n: v.length }; });
  const layerRange = [...svg.querySelectorAll('[id^="L-"]')].length;
  return { nAnims: anims.length, issues, wheelR: rot('j-wheelRear'), wheelF: rot('j-wheelFront'), crank: rot('j-crankNear'), crankF: rot('j-crankFar'), chainring: rot('j-chainring'), cog: rot('j-cog'), chain: chainA, layerRange };
}, svgText);
if (parse.error) { hard('XML parse error: ' + parse.error); }
else {
  report.smil = { animations: parse.nAnims, issues: parse.issues.length };
  console.log(`smil: ${parse.nAnims} animation elements, ${parse.issues.length} structural issues`);
  parse.issues.slice(0, 10).forEach(i => hard(i));
  const m = report.mechanics = { wheelRear: parse.wheelR, wheelFront: parse.wheelF, crankNear: parse.crank, crankFar: parse.crankF, chainring: parse.chainring, cog: parse.cog, chain: parse.chain };
  const rate = r => (r ? r.deg / r.dur : NaN);
  const ratioR = rate(parse.wheelR) / rate(parse.crank), ratioF = rate(parse.wheelF) / rate(parse.crank);
  m.ratioRear = ratioR; m.ratioFront = ratioF;
  console.log(`mechanics: crank ${parse.crank ? `${parse.crank.deg}°/${parse.crank.dur}s` : 'n/a'} · wheels ${parse.wheelR ? `${parse.wheelR.deg}°/${parse.wheelR.dur}s` : 'n/a'} (ratio ${ratioR.toFixed(4)}, ${ratioF.toFixed(4)}) · chain ${parse.chain.map(c => `${c.d}/${c.dur}s`).join(', ') || 'n/a'}`);
  if (!parse.crank || !parse.wheelR || !parse.wheelF) hard('wheel / crank rotation is not a 2-keyframe linear loop');
  else {
    if (Math.abs(ratioR - 3) > 0.001 || Math.abs(ratioF - 3) > 0.001) hard(`wheel:crank ratio ${ratioR.toFixed(4)} / ${ratioF.toFixed(4)} ≠ 3.000`);
    if (parse.wheelR.dur !== parse.crank.dur || parse.wheelF.dur !== parse.crank.dur) soft('wheel and crank loops have different dur');
    if (parse.crank.deg <= 0 || parse.wheelR.deg <= 0) hard('rotation is not clockwise');
  }
  if (parse.crankF && parse.crank && Math.abs(rate(parse.crankF) - rate(parse.crank)) > 1e-6) hard('far crank rate differs from near crank');
  for (const c of parse.chain) if (c.n === 2 && Math.abs(c.d / c.dur * (60 / CAD) + 48) > 1e-6) hard(`chain moves ${c.d}/${c.dur}s, expected −48 links per crank turn`);
}

// live page
const lp = await newPage();
await loopTShim(lp);
await lp.goto(`${base}/src/index.dev.html?freeze&nohud`);
await lp.waitForFunction(() => window.__pb && window.__pb.ready, null, { timeout: 20000 });
await lp.addStyleTag({ content: '#ui{display:none!important}' });
const liveAt = async tau => { await lp.evaluate(o => window.__pb.renderAt(o.t, { tod: o.tod, cam: o.cam, cadence: o.cad, loopT: o.T, toggles: { skeleton: false } }), { t: START + tau, tod: TOD, cam: CAM, cad: CAD, T }); return decodePNG(await lp.screenshot()); };
const bakedAt = async tau => { await bp.evaluate(t => { const s = document.getElementById('baked'); s.pauseAnimations(); s.setCurrentTime(t); }, tau); await bp.waitForTimeout(16); return decodePNG(await bp.screenshot()); };
const riderBox = await lp.evaluate(() => { const r = document.querySelector('#rider').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(Math.round); });
const RB = [Math.max(0, riderBox[0] - 20), Math.max(0, riderBox[1] - 20), Math.min(1600, riderBox[2] + 20), Math.min(900, riderBox[3] + 10)];

if (!parse.error) {
  // ---------------------------------------------------------------- 2. fidelity at N phases
  const phases = []; for (let i = 0; i < NPH; i++) phases.push(+(i * T / NPH).toFixed(4));
  const rows = [];
  let worst = null;
  for (const [k, tau] of phases.entries()) {
    const L = await liveAt(tau), B = await bakedAt(tau);
    const f = compare(L, B), r = compare(L, B, RB);
    rows.push({ tau, ssim: +f.ssim.toFixed(4), mad: +f.mad.toFixed(4), riderSsim: +r.ssim.toFixed(4) });
    if (!worst || r.ssim < worst.r) worst = { tau, r: r.ssim, L, B };
    if (k % Math.max(1, Math.floor(NPH / 4)) === 0) fs.writeFileSync(path.join(out, `lbd-${String(k).padStart(2, '0')}.png`), diffStrip(L, B, RB));
  }
  if (worst) fs.writeFileSync(path.join(out, 'lbd-worst.png'), diffStrip(worst.L, worst.B, RB));
  const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
  const fid = report.fidelity = { phases: NPH, ssimMean: +mean(rows.map(r => r.ssim)).toFixed(4), ssimMin: Math.min(...rows.map(r => r.ssim)), riderMean: +mean(rows.map(r => r.riderSsim)).toFixed(4), riderMin: Math.min(...rows.map(r => r.riderSsim)), madMean: +mean(rows.map(r => r.mad)).toFixed(4), worstTau: worst?.tau, rows };
  console.log(`fidelity (${NPH} phases): full SSIM mean ${fid.ssimMean} min ${fid.ssimMin.toFixed(4)} · rider SSIM mean ${fid.riderMean} min ${fid.riderMin.toFixed(4)} · MAD ${fid.madMean} · worst τ=${fid.worstTau}`);
  if (fid.ssimMean < 0.9) hard(`full-frame SSIM ${fid.ssimMean} < 0.90`); else if (fid.ssimMean < 0.97) soft(`full-frame SSIM ${fid.ssimMean} < 0.97 target`);
  if (fid.riderMean < 0.9) hard(`rider SSIM ${fid.riderMean} < 0.90`); else if (fid.riderMean < 0.96) soft(`rider SSIM ${fid.riderMean} < 0.96 target`);

  // ---------------------------------------------------------------- 3. rig probe (CTM of every slot)
  const probeN = quick ? 60 : 240;
  const slotPts = `(() => { const out = {}; const root = document.querySelector(SEL); const R = root.getScreenCTM().inverse();
    for (const g of root.querySelectorAll('[id^="j-"]')) { const m = R.multiply(g.getScreenCTM()); const P = (x, y) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]; out[g.id] = [P(0, 0), P(40, 0), P(17, 9)]; }
    return out; })()`;
  let maxErr = 0, worstSlot = '', footErr = 0, footErrLive = 0, handErr = 0;
  const bars = [114, -275];
  for (let i = 0; i < probeN; i++) {
    const tau = (i + 0.37) * T / probeN;
    await lp.evaluate(o => window.__pb.renderAt(o.t, { tod: o.tod, cam: o.cam, cadence: o.cad, loopT: o.T, toggles: { skeleton: false } }), { t: START + tau, tod: TOD, cam: CAM, cad: CAD, T });
    const Lp = await lp.evaluate(slotPts.replace('SEL', '"#scene"'));
    await bp.evaluate(t => { const s = document.getElementById('baked'); s.setCurrentTime(t); }, tau);
    const Bp = await bp.evaluate(slotPts.replace('SEL', '"#baked"'));
    for (const id of Object.keys(Lp)) {
      if (!Bp[id]) continue;
      for (let k = 0; k < 2; k++) { const e = Math.hypot(Lp[id][k][0] - Bp[id][k][0], Lp[id][k][1] - Bp[id][k][1]); if (e > maxErr) { maxErr = e; worstSlot = `${id}@${tau.toFixed(3)}`; } }
    }
    for (const s of ['Near', 'Far']) {
      const fb = Bp['j-foot' + s]?.[2], pd = Bp['j-pedal' + s]?.[0], fl = Lp['j-foot' + s]?.[2], pl = Lp['j-pedal' + s]?.[0];
      if (fb && pd) footErr = Math.max(footErr, Math.hypot(fb[0] - pd[0], fb[1] - pd[1]));
      if (fl && pl) footErrLive = Math.max(footErrLive, Math.hypot(fl[0] - pl[0], fl[1] - pl[1]));
    }
    const hb = Bp['j-wingNearHand']?.[0], hl = Lp['j-wingNearHand']?.[0];
    if (hb && hl) handErr = Math.max(handErr, Math.hypot(hb[0] - hl[0], hb[1] - hl[1]));
  }
  void bars;
  report.rig = { probes: probeN, maxSlotErr: +maxErr.toFixed(3), worstSlot, footToPedalBaked: +footErr.toFixed(3), footToPedalLive: +footErrLive.toFixed(3), wristErr: +handErr.toFixed(3) };
  console.log(`rig (${probeN} probes): max slot error ${maxErr.toFixed(3)} u (${worstSlot}) · ball→pedal baked ${footErr.toFixed(3)} u (live ${footErrLive.toFixed(3)}) · wrist error ${handErr.toFixed(3)} u`);
  if (maxErr > 1) hard(`slot error ${maxErr.toFixed(2)} u > 1 u`); else if (maxErr > 0.3) soft(`slot error ${maxErr.toFixed(2)} u > 0.3 u target`);
  if (footErr > footErrLive + 1) hard(`ball of foot leaves the pedal by ${footErr.toFixed(2)} u in the bake`);

  // ---------------------------------------------------------------- 4. loop seam and drift
  const F0 = await bakedAt(0), FT = await bakedAt(T), FTm = await bakedAt(T - 1 / 60), F1 = await bakedAt(1 / 60), F2 = await bakedAt(2 / 60);
  const F10 = await bakedAt(10 * T), F100 = await bakedAt(100 * T);
  const d = (a, b) => compare(a, b).mad;
  const adj = [d(F0, F1), d(F1, F2)].sort((a, b) => a - b)[0] || 1e-6;
  const loop = report.loop = { T0: +d(FT, F0).toFixed(5), T10: +d(F10, F0).toFixed(5), T100: +d(F100, F0).toFixed(5), seamRatio: +(d(FTm, F0) / adj).toFixed(3) };
  console.log(`loop: |f(T)−f(0)| ${loop.T0} · 10T ${loop.T10} · 100T ${loop.T100} · seam ratio ${loop.seamRatio} (target ≤ 1.2)`);
  if (loop.T0 > 0.002 || loop.T100 > 0.002) hard('loop does not return to frame 0');
  if (loop.seamRatio > 2) soft(`seam ratio ${loop.seamRatio} > 2`);

  // ---------------------------------------------------------------- 5. static fallback (no animation at all)
  await bp.evaluate(() => { const s = document.getElementById('baked'); window.__bk = s.cloneNode(true); for (const a of [...s.querySelectorAll('animate,animateTransform,animateMotion,set')]) a.remove(); });
  await bp.waitForTimeout(30);
  const FS = decodePNG(await bp.screenshot()), L0 = await liveAt(0);
  const fb = compare(L0, FS), fbr = compare(L0, FS, RB);
  report.fallback = { ssim: +fb.ssim.toFixed(4), riderSsim: +fbr.ssim.toFixed(4) };
  fs.writeFileSync(path.join(out, 'fallback.png'), encodePNG(FS));
  console.log(`static fallback: SSIM vs live t0 ${fb.ssim.toFixed(4)} · rider ${fbr.ssim.toFixed(4)}`);
  if (fbr.ssim < 0.9) hard('static fallback does not show the hero pose');
}

// ---------------------------------------------------------------- 6. embeds animate (<img>, background, <object>)
const url = 'data:image/svg+xml;base64,' + Buffer.from(svgText).toString('base64');
fs.copyFileSync(file, path.join(out, 'embed.svg'));
const embeds = {
  'img 1600x900': [1600, 900, `<img src="${url}" style="width:1600px;height:900px;display:block">`],
  'img 600x338': [600, 338, `<img src="${url}" style="width:600px;height:338px;display:block">`],
  'css background': [800, 450, `<div style="width:800px;height:450px;background:url('${url}') center/cover"></div>`],
  'object': [800, 450, `<object data="${base}/shots/baker/check/embed.svg" type="image/svg+xml" style="width:800px;height:450px;display:block"></object>`],
};
report.embeds = {};
for (const [name, [w, h, html]] of Object.entries(embeds)) {
  const p = await newPage(w, h);
  await p.setContent(`<!doctype html><html><body style="margin:0;background:#222">${html}</body></html>`);
  await p.waitForLoadState('load'); await p.waitForTimeout(250);
  const t0 = Date.now(), shots = [];
  for (const at of [0, 370, 810]) { const wait = at - (Date.now() - t0); if (wait > 0) await p.waitForTimeout(wait); shots.push(decodePNG(await p.screenshot())); }
  const box = [Math.round(RB[0] * w / 1600), Math.round(RB[1] * h / 900), Math.round(RB[2] * w / 1600), Math.round(RB[3] * h / 900)];
  const m01 = compare(shots[0], shots[1], box).mad, m12 = compare(shots[1], shots[2], box).mad;
  const blank = compare(shots[0], { w, h, px: new Uint8Array(w * h * 4).map((_, i) => (i % 4 === 3 ? 255 : 34)) }).mad < 0.02;
  report.embeds[name] = { moves: m01 > 0.002 && m12 > 0.002, mad: [+m01.toFixed(4), +m12.toFixed(4)], blank };
  if (name === 'img 1600x900') fs.writeFileSync(path.join(out, 'img-1600.png'), encodePNG(shots[1]));
  console.log(`embed ${name}: ${report.embeds[name].moves ? 'animates' : 'STATIC'} (rider Δ ${m01.toFixed(4)}, ${m12.toFixed(4)})${blank ? ' BLANK' : ''}`);
  if (!report.embeds[name].moves || blank) hard(`${name} does not animate`);
  await p.close();
}

await browser.close(); srv.close();
if (errors.length) { [...new Set(errors)].slice(0, 10).forEach(e => hard(e)); }
fs.writeFileSync(path.join(out, 'check-baked.json'), JSON.stringify(report, null, 1));
console.log(`${report.hard.length ? 'FAIL' : 'PASS'}: ${report.hard.length} hard, ${report.soft.length} soft → ${path.relative(ROOT, path.join(out, 'check-baked.json'))}`);
process.exit(report.hard.length ? 1 : 0);
