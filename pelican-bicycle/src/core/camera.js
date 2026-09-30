// Camera: modes wide / close / cinematic, blended by a critically damped spring. Per-layer transform by depth.
// Lead framing notes (see docs/composition.md):
//  · close is framed looser than contract CAMERAS.close so the crest keeps ≥ 6% headroom under the poster border
//    and the towed sky banner (contract request: adopt these numbers in contract.js).
//  · hop headroom: a separate critically damped "lift" spring rises as soon as a hop event starts (the 0.24 s crouch
//    is the anticipation), so at the apex the camera has caught ~85% of the jump and the bill/crest stay inside the
//    frame; it settles ~0.7 s after landing. It is a pure function of (events, t) via preroll(), so renderAt stays
//    deterministic and matches the live loop.
import { CAMERAS, VIEW, RIDER_X, GROUND_Y } from '../contract.js';
import { clamp } from './math.js';

export const CAMS = {
  ...CAMERAS,
  close: { ...CAMERAS.close, zoom: 1.32, fx: RIDER_X + 34, fy: GROUND_Y - 302 },
};
// how much of the hop lift each mode follows (wide is the static poster: it lets the bird jump)
const LIFT_FOLLOW = { wide: 0, close: 1, cinematic: 0.75 };
const HOP_LIFT = 58, HOP_HOLD = 0.62, LIFT_W = 7.5;

function hopLiftTarget(events, t) {
  let g = 0;
  for (const e of events || []) if (e.type === 'hop' && t >= e.t0 && t - e.t0 < HOP_HOLD) g = HOP_LIFT;
  return g;
}

export function createCamera(mode = 'wide') {
  const cur = { ...CAMS[mode], roll: 0, letterbox: CAMS[mode].letterbox || 0 };
  const vel = { zoom: 0, fx: 0, fy: 0, roll: 0, letterbox: 0 };
  const lift = { x: 0, v: 0 };
  let target = mode;
  const stepLift = (h, g) => { const a = LIFT_W * LIFT_W * (g - lift.x) - 2 * LIFT_W * lift.v; lift.v += a * h; lift.x += lift.v * h; };
  return {
    get mode() { return target; },
    set(mode) { if (CAMS[mode]) target = mode; },
    snap(mode, t = 0) { target = mode; Object.assign(cur, goal(mode, t)); for (const k in vel) vel[k] = 0; return this.get(); },
    // rebuild the lift spring from the event list (deterministic renders / filmstrips)
    preroll(t, events) {
      lift.x = 0; lift.v = 0;
      const h = 1 / 120;
      for (let s = t - 2; s < t - 1e-9; s += h) stepLift(h, hopLiftTarget(events, s));
    },
    // critically damped spring toward the (possibly moving) goal
    update(dt, t, reduced, events) {
      const m = reduced && target === 'cinematic' ? 'wide' : target;
      const g = goal(m, t, reduced);
      const w = 6, k = w * w, c = 2 * w;
      const h = Math.min(dt, 1 / 20);
      for (const key of Object.keys(vel)) {
        const a = k * (g[key] - cur[key]) - c * vel[key];
        vel[key] += a * h; cur[key] += vel[key] * h;
      }
      if (h > 0) { const n = Math.max(1, Math.ceil(h * 120)); for (let i = 0; i < n; i++) stepLift(h / n, reduced ? 0 : hopLiftTarget(events, t)); }
      const out = this.get();
      out.fy -= lift.x * (LIFT_FOLLOW[m] ?? 0);
      return out;
    },
    get() { return { zoom: cur.zoom, fx: cur.fx, fy: cur.fy, roll: cur.roll, letterbox: cur.letterbox, mode: target, lift: lift.x }; },
  };
}

function goal(mode, t, reduced) {
  const c = CAMS[mode] || CAMS.wide;
  if (mode !== 'cinematic' || reduced) return { zoom: c.zoom, fx: c.fx, fy: c.fy, roll: 0, letterbox: c.letterbox || 0 };
  return {
    zoom: 1.2 + 0.15 * Math.sin((2 * Math.PI * t) / 16),
    fx: c.fx + 60 * Math.sin((2 * Math.PI * t) / 23),
    fy: c.fy + 30 * Math.sin((2 * Math.PI * t) / 19),
    roll: 0.6 * Math.sin((2 * Math.PI * t) / 11),
    letterbox: c.letterbox,
  };
}

// Portrait / narrow screens: the slice-fit viewBox crops the sides. Fit the camera to the rider bbox
// (rear tyre → front tyre, plus a 3% margin and the paper border) and sit the road just above the bottom sheet.
// insetVB = height of the bottom UI sheet in viewBox units.
const BIKE_X0 = RIDER_X - 125 - 109, BIKE_X1 = RIDER_X + 173 + 109;   // tyre outer edges
export function fitAspect(cam, aspect, insetVB = 0) {
  if (aspect >= 1.5) return cam;
  const k = Math.min(1, (1.5 - aspect) / 0.9);
  const cx = (BIKE_X0 + BIKE_X1) / 2, span = (BIKE_X1 - BIKE_X0) * 1.06 + 2 * 22;
  const zFit = (VIEW.h * aspect) / span;                      // visible world width = 900·aspect / zoom
  const zoom = Math.min(cam.zoom, cam.zoom + (zFit - cam.zoom) * k);
  const fx = cam.fx + (cx - cam.fx) * k;
  // road line at screen y = 900 - inset - 34 (viewBox units): 450 + (GROUND_Y - fy)·zoom
  const fyFit = GROUND_Y - (VIEW.h - insetVB - 34 - VIEW.cy) / zoom;
  const fy = aspect < 1 ? cam.fy + (Math.min(fyFit, cam.fy + 40) - cam.fy) * k - (cam.lift || 0) * 0.6 : cam.fy + (GROUND_Y - 300 - cam.fy) * k * 0.7;
  return { ...cam, zoom: aspect < 1.2 ? zoom : cam.zoom, fx, fy };
}

// zoom of a layer at parallax depth d
export const layerZoom = (cam, d) => 1 + (cam.zoom - 1) * clamp(d, 0.15, 1);
// SVG transform for a layer at parallax depth d (null = screen-fixed).
export function layerTransform(cam, d) {
  if (d === null || d === undefined) return '';
  const z = layerZoom(cam, d);
  const tx = VIEW.cx + (cam.fx - VIEW.cx) * Math.min(d, 1);
  const ty = VIEW.cy + (cam.fy - VIEW.cy) * clamp(d, 0.15, 1);
  const r = Math.round;
  return `translate(${VIEW.cx} ${VIEW.cy}) rotate(${(cam.roll || 0).toFixed(3)}) scale(${z.toFixed(4)}) translate(${-(r(tx * 100) / 100)} ${-(r(ty * 100) / 100)})`;
}
