// Camera: modes wide / close / cinematic, blended by a critically damped spring. Per-layer transform by depth.
import { CAMERAS, VIEW } from '../contract.js';
import { clamp } from './math.js';

export function createCamera(mode = 'wide') {
  const cur = { ...CAMERAS[mode], roll: 0, letterbox: CAMERAS[mode].letterbox || 0 };
  const vel = { zoom: 0, fx: 0, fy: 0, roll: 0, letterbox: 0 };
  let target = mode;
  return {
    get mode() { return target; },
    set(mode) { if (CAMERAS[mode]) target = mode; },
    snap(mode, t = 0) { target = mode; Object.assign(cur, goal(mode, t)); for (const k in vel) vel[k] = 0; return this.get(); },
    // critically damped spring toward the (possibly moving) goal
    update(dt, t, reduced) {
      const g = goal(reduced && target === 'cinematic' ? 'wide' : target, t, reduced);
      const w = 6, k = w * w, c = 2 * w;
      const h = Math.min(dt, 1 / 20);
      for (const key of Object.keys(vel)) {
        const a = k * (g[key] - cur[key]) - c * vel[key];
        vel[key] += a * h; cur[key] += vel[key] * h;
      }
      return this.get();
    },
    get() { return { zoom: cur.zoom, fx: cur.fx, fy: cur.fy, roll: cur.roll, letterbox: cur.letterbox, mode: target }; },
  };
}

function goal(mode, t, reduced) {
  const c = CAMERAS[mode] || CAMERAS.wide;
  if (mode !== 'cinematic' || reduced) return { zoom: c.zoom, fx: c.fx, fy: c.fy, roll: 0, letterbox: c.letterbox || 0 };
  return {
    zoom: 1.25 + 0.2 * Math.sin((2 * Math.PI * t) / 16),
    fx: c.fx + 60 * Math.sin((2 * Math.PI * t) / 23),
    fy: c.fy + 30 * Math.sin((2 * Math.PI * t) / 19),
    roll: 0.6 * Math.sin((2 * Math.PI * t) / 11),
    letterbox: c.letterbox,
  };
}

// SVG transform for a layer at parallax depth d (null = screen-fixed).
export function layerTransform(cam, d) {
  if (d === null || d === undefined) return '';
  const z = 1 + (cam.zoom - 1) * clamp(d, 0.15, 1);
  const tx = VIEW.cx + (cam.fx - VIEW.cx) * Math.min(d, 1);
  const ty = VIEW.cy + (cam.fy - VIEW.cy) * clamp(d, 0.15, 1);
  const r = Math.round;
  return `translate(${VIEW.cx} ${VIEW.cy}) rotate(${(cam.roll || 0).toFixed(3)}) scale(${z.toFixed(4)}) translate(${-(r(tx * 100) / 100)} ${-(r(ty * 100) / 100)})`;
}
