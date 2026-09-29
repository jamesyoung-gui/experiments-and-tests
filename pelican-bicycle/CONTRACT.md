# Pelican Bay — module contract (read before editing anything)

Geometry, math and rationale: `docs/rig-spec.md`. Frozen data: `src/contract.js`. **Never edit files you don't own**; ask the lead via your final report.

## Run / check
| Command | What |
|---|---|
| `node tools/shoot.mjs --out shots/<you> --set hero,frames,tods,cams,events,mobile --sheet` | Deterministic screenshots via `window.__pb.renderAt`; exits 1 on any console error. Read the PNGs! |
| `node tools/shoot.mjs --query "solo=bike"` | Only your module (+ rider slots) |
| `node tools/shoot.mjs --perf` | 5 s live run: fps, JS ms/frame, DOM node count |
| `node tools/check-rig.mjs` | IK/feet-on-pedals/hands-on-grips over 3×1440 crank samples |
| `node tools/lint.mjs` | No top-level DOM in pure modules, filter warnings, Math.random warnings |
| `node tools/build.mjs` | Bundles to `dist/index.html` (self-contained, works from file://) |
| `node tools/render.mjs in.svg out.png [w h]` | Render any SVG/HTML file |

Never run `npm install`. Shots go to `shots/<your-id>/` (git-ignored).

## Coordinates
- viewBox `0 0 1600 900`; ground line `GROUND_Y=790`; horizon `470`; rider origin `RIDER_X=680` (ground under the bottom bracket).
- Rider-local: y negative = up. SVG angle convention: degrees, **+ = clockwise**.
- The world scrolls toward −x; the rider faces +x; wheels & cranks rotate clockwise.

## Module interface (art / world / fx)
```js
export const id = 'bike';                       // owner id
export const materials = { chrome: '#…' };      // OPTIONAL extra base colours; graded by light like core materials
export function build(ctx) {                     // pure: returns markup strings
  // ctx = { C: contract, rng(salt) -> ()=>[0,1), v(token,{far}) -> 'var(--pb-token[-far])', h(tag,attrs,...kids), quality, reduced }
  return { defs: '...', slots: { frame: '<g>…</g>' }, layers: { 'L-road': '…' } };
}
export function attach(svg, ctx) {               // DOM refs + per-frame work
  return { update(frame) { … }, bake?(kit) { return [BakeDescriptor…] } };
}
```
- **Slots** (rider parts) are flat, z-ordered groups `#j-<slot>` (order in `SLOTS`). The runtime writes each slot's composed transform `translate(x y) rotate(r) scale(sx sy)` every frame; **draw your slot in joint-local coordinates** with the pivot at (0,0) and the bone along +x. Slot owners: `SLOT_OWNER` in contract.js.
  - Static bike parts (`frame`, `fork`, `bars`, `chain`) have identity transforms: draw them in rider coordinates.
  - `wheelRear`/`wheelFront`/`cog`/`chainring`/`crank*` rotate about their hub/BB; `pedal*` sits at the spindle rotated by the foot angle.
  - Legs: `thigh*` pivot = hip, length 142; `shank*` pivot = knee, length 134; `foot*` pivot = ankle, ball of foot at local (17,9) sits on the pedal spindle, toes to x≈48, heel ≈ −6.
  - Wings: `wing*Upper` pivot = shoulder, length 78; `wing*Lower` pivot = elbow, length 74; `wing*Hand` pivot = wrist ON the grip (wrap primaries around it).
  - Body: `body` pivot = pelvis (body ellipse centre local (32,−50), rx 98, ry 58, rot −18°, bottom sits on saddle). `head` pivot = skull centre (r≈26). `billUpper`/`billLower` pivot at the gape, bill length 128 along +x (already rotated 14° down). `pouch` hangs from `billLower` (+y), scaled by `sx/sy` for jiggle — draw it so scaling about (0,0) looks natural. `eye` scaled `sy` for blinks. `crest` pivot at the back of the skull (rest rot 200° → points back).
  - `neck` is a deformer: `pelican-body.neckD(pose.neck)` returns the outline path each frame (fixed command count).
- **Layers**: draw into `LAYERS` ids; your markup lands in `#<layer>--<owner>`. The runtime applies the camera transform per layer from its depth. **Parallax scrolling is yours**: offset = `frame.distance × depth`, wrapped by your tile width (near layers: use `TILE.*` widths so the baked loop is seamless). Keep art ≥ ±400 units beyond the viewBox so camera zoom/roll never reveals edges.
- **Ids / data-ref**: prefix every id, class and `data-ref` with your module id (`bike-`, `pb-`, `pl-`, `sky-`, `sea-`, `land-`, `fx-`, `ui-`). Get elements via `refs(svg, 'bike-')`.
- **Colour**: markup uses `ctx.v(token)` → CSS variables set by `core/palette.js` at ≤10 Hz. Env tokens (time-of-day keyed): `sky0 sky1 sky2 sunCore sunGlow cloudLit cloudShade seaFar seaNear foam hillFar hillNear sand road roadLine grassFar grassNear foliage trunk rim grade`. Materials (graded by light, each also has `-far` darker variant): see `MATERIALS` + your module's `materials` export. Emissive (not graded): `lamp lampGlow beacon headlamp`. Numeric vars: `--pb-n-night`, `--pb-n-starAlpha`, `--pb-n-lampOn`, `--pb-n-rimAlpha`, `--pb-n-shadowAlpha` (use in `opacity="var(--pb-n-lampOn)"` via style: `style="opacity:var(--pb-n-lampOn)"`).
- **Frame** passed to `update(frame)`: `{ t, dt, distance, speed, cadence, coasting, tod, sun:{x,y,elev}, moon, night, pal, pose, cam, toggles, quality, reduced, events }`. `pose` = `solvePose` output: `joints, neck, chainOffset, wheel, crank, riderY, bikePitch, blink, spokeBlur, pelvisDy`.
- **Events** (bus): UI emits `ui:bell ui:wave ui:hop ui:gulp ui:camera{mode} ui:speed{cadence} ui:coast{on} ui:tod{tod,auto} ui:toggle{key,value} ui:play{on} ui:sound{on} ui:download{kind}`; runtime emits `rig:event{type,t0}` and `rig:land`. Rig events live in `frame.events` as `{type, t0}` (types: hop, wave, bell, gulp).

## Budgets (live page)
- 60 fps at 1600×900 in headless Chromium (`--perf`): JS p95 ≤ 2 ms/frame; DOM ≤ 4000 nodes total (~500 per module).
- Animate **transforms and opacity only** per frame; avoid rewriting large `d` attributes every frame (the neck is the exception).
- SVG filters: none on moving content. A filter on a static, small element is OK; big full-screen blur/turbulence is not. Glows = radial gradients.
- No `Math.random` (use `ctx.rng(salt)`), no external assets, no fonts beyond system stacks (convert lettering to paths if the style needs it).
- Respect `frame.reduced` (prefers-reduced-motion): no shake, fewer particles.
