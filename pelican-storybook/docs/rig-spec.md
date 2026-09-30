# Pelican Bay design spec (planning only, nothing written)

**Environment checks:** the repo is empty and on branch `claude/gracious-allen-1ksl3j`. Node is v22.22.2. `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` is set, and Playwright can be imported from `/opt/node22/lib/node_modules/playwright/index.mjs`. The npm registry is reachable: `npm view esbuild` returned 0.28.2, so esbuild is the main bundler, not a maybe. All numbers below come from `node -e` runs.

## 0. Changes to the planned architecture

1. **Don't nest the joints in the DOM.** Far leg → frame → body → near leg → neck → near wing mixes bike and pelican in z-order, and nested `<g>`s tie z-order to the hierarchy. Keep the parent tree in the solver only. The DOM gets a flat, z-ordered list of slots `<g id="j-NAME">`. Each slot gets a transform already composed into rider space: `translate rotate [scale]`. `sx`/`sy` are only allowed on leaf joints, so the composed transform stays that simple.
2. **Keep `solvePose` pure by making secondary motion analytic.**
   - Springs use the steady-state response to the 2×-crank bob, as `A·H(r)·cos(2φ−ψ)`.
   - Events (land, bell) use closed-form damped impulse responses of `t − t0`.
   - The only state lives in a tiny integrator in `main.js` (distance, crank, smoothed speed, time of day, event list).
   - Result: the baked rider loop is exactly periodic, so no warm-up or crossfade is needed.
3. **Use 48T/16T gearing (exactly 3.0).** The wheel turns exactly 3 times per crank turn. The baked wheel is one `animateTransform` with values `0→1080` and `dur = T_c`, which can't drift.
4. **Chain uses `pathLength="100"`, so one dash unit is one link.** Offset = `−48·crank/2π` links. That's 24 two-link periods per crank turn, so the loop is seamless.
5. **Handle day/night in the palette, not with a multiply overlay.**
   - Environment tokens are keyframed by time of day.
   - Pelican and bike colours are fixed base colours × a lighting grade, computed in JS and set as CSS variables (`--pb-*`) on `svg#scene`.
   - This avoids a full-screen blend layer, and glows can sit at any depth.
   - The baker freezes the variables to hex values.
6. **Art modules return markup strings, not DOM nodes.** Strings can be tested in node and are easy to bake.
7. **Run the baker in the browser**, via Playwright or the in-page Download button. That avoids emulating a DOM in node. It samples the rig from the pure solver and gets world animation from descriptors that each module provides.
8. **Near-layer tile width = depth × 1884.96 × k.** Then the baked road, roadside and foreground loop in whole multiples of `T_c`, so the road never slips against the tyres.
9. **The lead writes a working basic 2-bone IK in phase 0**, so art agents preview against real poses from the start.
10. **Wrap angles and offsets mod 360 (or mod the pattern period) before writing to the DOM.** Chromium stores transforms as float32, so large unwrapped angles jitter. Keep unwrapped values only inside the baker.
11. **ES modules don't load from `file://`.** Dev pages must go through `tools/serve.mjs`. The dist build is inline, so it works from `file://`.

---

## 1. Bike geometry

Units: 1 unit = 3.4 mm. Rider-local coordinates, y is negative upward, origin is the ground point under the bottom bracket, ground line is y = 0.

World placement: `RIDER_X = 680`, `GROUND_Y = 790` (viewBox 1600×900). The rider's bounding box is x −225…273, y −546…0, which is x 455…953 and y 244…790 in the world. The sea horizon is at y = 470, so the head sits against sky.

| Part | Value (units) | Real equivalent |
|---|---|---|
| Wheel radius R (outside of tyre) | 100; tyre 9 thick; rim 91→88; hub r = 6; 32 spokes, 3-cross | 700×32c, 680 mm diameter |
| Rear hub | (−125, −100) | chainstay 126.6 = 430 mm |
| Bottom bracket (BB) | (0, −80) | BB drop 68 mm, BB height 272 mm |
| Front hub | (173.0, −100) | wheelbase 298 = 1013 mm; front-centre 592 mm |
| Seat tube | 73°, BB → (−46.5, −232), length 159 | 540 mm |
| Seat-post clamp / saddle top | (−60.5, −278) / top centre (−63, −287); saddle x −101…−23 | saddle height 735 mm |
| Head tube | 72°, top (112, −245), bottom (125.6, −203.2), length 44 | 150 mm; stack 561 mm, reach 381 mm |
| Fork | axis runs from head-tube bottom for 112.8; rake 13.2 perpendicular | 45 mm rake; trail 18.6 = 63 mm |
| Steerer top / stem clamp | (106.4, −262.1) / (132, −269) | 90 mm stem, 15° rise |
| Grips (swept-back city bar) | near (114, −275), far (111, −277) for a small depth cue | saddle nose to grip 470 mm |
| Bell / headlamp / basket | (124, −281) / (140, −218) / box x 140…222, y −292…−226 | |
| Crank length | 50 | 170 mm |
| Chainring 48T | pitch radius 28.556, tooth tips 30.2, 5-arm spider | |
| Cog 16T | pitch radius 9.573, tips 10.8 | |
| Toe clearance | 24 units between front tyre and crank circle | |

**Chain path.** It is drawn in the direction the chain moves, clockwise on both sprockets. The top run moves +x.

```
M-124.92,-109.57 L0.23,-108.55 A28.556,28.556 0 1 1 -8.69,-52.80 L-127.91,-90.88 A9.573,9.573 0 0 1 -124.92,-109.57 Z
```

- Wrap is 197.2° on the chainring and 162.8° on the cog. True length is 375.82, about 100.6 real links.
- Use `pathLength="100"`, so each link is 3.758 units, 0.6% off the real pitch.
- Plate stroke: `dasharray "1.1 0.9"`, fading out above 45 rpm.
- Pin highlight: `"0.3 3.7"`, always shown.
- `stroke-dashoffset = −((48·crank/2π) mod 100)`. A more negative value moves the pattern forward along the path.

---

## 2. Pelican skeleton

Rest values are in the parent's local frame. Bones point along +x; local +y is the underside or trailing side.

| Joint | Parent | Rest offset | Bone length / notes |
|---|---|---|---|
| `pelvis` | rider | (−45, −300) + bob | Body art in the pelvis frame: ellipse centre (32, −50), rx 98, ry 58, rotated −18°. Its lowest point is y = −287, exactly the saddle top. |
| `tail` | pelvis | (−62, −38) | rest rotation 8°, leaf |
| `hipNear` / `hipFar` | pelvis | (8, 0) / (4, −3) | |
| `thigh*` | hip | IK | **142** (width 34 → 18) |
| `shank*` | thigh | (142, 0) | **134** (orange tarsus, width 12 → 9) |
| `foot*` | shank | (134, 0) | Composed rotation = α(φ). Ball on pedal at (17, 9), toes to x 48, heel at −6. |
| `shoulderNear` / `shoulderFar` | pelvis | (80, −78) / (75, −83) | |
| `wing*Upper` | shoulder | IK | **78** |
| `wing*Lower` | upper | (78, 0) | **74**; the wrist lands on the grip |
| `wing*Hand` | lower | (74, 0) | rest composed rotation 15°; black primaries wrap the grip (r = 6) |
| `neckBase` | pelvis | (112, −92), which is rider (67, −392) | Neck is a deformer, not a joint (see below) |
| `head` | **rider** (stabilised) | (125, −520) | head radius ~26 |
| `eye` / `crest` | head | (6, −7) / (−20, −16) | leaf joints; eye blink uses `sy`; crest rest rotation 200° |
| `billUpper` / `billLower` | head | (16, 2) / (16, 6) | **128** at 14°; tip at (265, −487), hooked nail |
| `pouch` | billLower | (6, 5) | leaf; `sx`/`sy` jiggle; hangs up to 34 in +y |

**Neck deformer.** A cubic Bézier: P0 = neckBase, P1 = P0 + (30, −58), P2 = P3 + (−58, 34), P3 = head + (−14, 10). Length is 133, and the control points zigzag, which gives the S-curve. Width goes from 34 to 24. The outline has a fixed command count (9 samples per side), so SMIL can morph it.

**Pedal kinematics.**
- Crank angle φ runs clockwise from +x.
- Pedal position = BB + 50·(cos φ, sin φ); the far pedal uses φ + π.
- Ankling: α(φ) = 8° + 10°·cos(φ − 135°), giving a range of −2°…18° (positive = toe down).
- Ankle target = pedal + R(α)·(−17, −9).

### IK validation

Sampled 1440 crank angles × pelvis vertical offset {−5, −2.5, 0, 2.5, +6} × sway ±1.5°. The offset range covers bob (±2.5) and hop (−4…+6).

| Chain | Hip/shoulder → target distance | Feasible range | Margin at full reach | Interior joint angle |
|---|---|---|---|---|
| Near leg (142 / 134) | 155.3 … 263.6 | (8, 276) | **12.5 (4.5%)** | knee 70…142° |
| Far leg | 158.7 … 266.9 | (8, 276) | **9.1 (3.3%)** | knee 72…147° |
| Near wing (78 / 74) | 121.6 … 137.3 | (4, 152) | **14.7 (9.7%)** | elbow 107…138° |
| Far wing | 125.2 … 140.9 | (4, 152) | **11.1 (7.3%)** | |

- Knee on the wrong side: 0 samples. Largest angle change between neighbouring samples: 0.11° (0.25° steps). End-effector error: 0.
- Knee-forward rule: `thigh = atan2(A−H) − acos((L1² + d² − L2²) / (2·L1·d))`, i.e. bend sign −1.
- Wings use bend sign +1, which puts the elbow below the shoulder→grip line.
- Rest pose at φ = 0:
  - Near knee (77.3, −215.8), thigh 36.4°, shank 109.3°.
  - Near elbow (44.6, −300.6), upper wing 83°, lower wing 20°.
- Clearances:
  - The highest knee point is y −238, 49 below the belly.
  - The elbow is at least 47 above the thigh.
  - The lower wing passes 72 above the knee.
- The wave target is shoulder + (55, −115), distance 127.5.
  - Interpolate it in polar coordinates about the shoulder: angle 52.5° → −64.4°, radius 130 → 127.5.
  - A straight lerp would drag the hand through the chest, getting to within 67 of the shoulder.
- Soft IK kicks in at 0.97·(L1 + L2). Clamp distance to [|L1 − L2| + 1, 0.999·(L1 + L2)].

---

## 3. Motion math

- Wheel angle in degrees = `(distance / 100)·180/π`. Rotation is positive, i.e. clockwise on screen. The rider faces +x and the world moves −x, so this is correct.
- While pedalling, `crank = distance / (3R)`. While coasting, the crank is frozen and the freewheel ticks.
- `DIST_PER_REV = 6πR = 1884.956 units`, which is 6.409 m per crank turn.

| Cadence | Speed (units/s) | km/h | Wheel °/frame @60 fps | Chain links/frame | Road units/frame |
|---|---|---|---|---|---|
| 40 (stroll) | 1257 | 15.4 | 12 | 0.53 | 20.9 |
| **60 (cruise, default)** | 1885 | 23.1 | 18 | 0.80 | 31.4 |
| 90 (sprint) | 2827 | 34.6 | 27 | 1.20 | 47.1 |

**Aliasing.** These rates cause wagon-wheel effects, so:
- Spoke opacity = 1 − smoothstep(0.6, 1.4, wheel rev/s).
- Six curved blur wedges (60° symmetry) fade in as the spokes fade out.
- The valve and reflector show real rotation.
- Chainring teeth are drawn low-contrast; the 5-arm spider (72°) carries the visible rotation.
- The chain uses 2- and 4-link patterns as above.

**Secondary motion.**
- Base terms, as functions of crank phase φ:
  - bobY = 2.5·cos 2φ
  - sway = 1.5°·sin φ
- Response formula:
  - ω = 2π·rpm/60 and r = 2ω/ωn.
  - H = 1/√((1 − r²)² + (2ζr)²), ψ = atan2(2ζr, 1 − r²).
  - Response = gain·H·cos(2φ − ψ).

| Part | ωn | ζ | Gain |
|---|---|---|---|
| Pouch (`sy`) | 2π·3.0 | 0.22 | 0.045 |
| Crest | 2π·4.5 | 0.30 | 7° |
| Tail | 2π·2.4 | 0.35 | 5° |

- **Head:** follows only 0.25 of the bob, with its own lag response (ωn = 2π·1.8, ζ = 0.6). Rotation = −0.8·sway.
- **Transients:** A·e^(−ζ·ωn·τ)·sin(ωd·τ). On landing: pouch 0.12, crest 18°, tail 12°, head 6 units. On bell: head nods 4°.
- **Wind flutter** uses ψd = 2π·distance/1884.96 with integer harmonics (7ψd, 11ψd), so it is periodic when baked.
- **Hop:**
  - τ 0…0.15: crouch, pelvisDy +6, body `sy` 0.96.
  - τ 0.15…0.75: riderY = −58·sin(πu), pitch = −7°·sin 2πu (×0.6 in the second half) about the rear contact point (−125, 0).
  - τ = 0.75: `land` event.
  - pelvisDy stays within [−4, +6], which is inside the validated range.
- **Wave:** 1.8 s; weight w = smoothstep(0, .3) · (1 − smoothstep(1.4, 1.8)); hand oscillates ±25° at 3 Hz.
- **Bell:** 0.35 s thumb flick.
- **Blink:** every 3.7 s.

**Baked loop strategy.**
- Bake at 60 rpm, so `T_c = 1.000 s`.
- **Rider:** 60 samples of the pure solver per crank turn. Slots with a constant translate become static; slots whose rotation is linear (residual < 0.01°) get two keyframes.
  - Wheels: `0→1080`, dur `T_c`.
  - Cranks: `0→360`.
  - Chain offset: `0→−48`.
- **Near layers:** tile width = depth·1884.96·k, `dur = k·T_c`.
  - Road: 1884.96, with dashes every 157.08.
  - Roadside (depth 0.9): 1696.46, lamp posts every 848.2.
  - Foreground (depth 1.3): 2450.44.
  - Shore (depth 0.6, k = 2): 2261.95.
  - All widths are ≥ 1600. Render three `<use>` copies.
- **Far layers** loop on their own durations (clouds 120 s, boats 90 s, gulls 12 s, blink 4 s, fish flop 2.3 s).
- **Optional baked day cycle:** register the variables with `@property` and animate them with CSS `@keyframes` over 60 s.
- **Sun path:** x = 800 − 700·cos(2π(tod − .25)), y = 470 − 380·sin(…). Default tod = 0.70 (golden hour) puts the sun at about (1451, 330) as a backlight. The moon uses tod + 0.5.

---

## 4. Module contract

```js
// src/contract.js (lead, frozen after phase 0): VIEW, GROUND_Y=790, RIDER_X=680, BIKE{...table §1},
//   SKEL{...table §2}, DIST_PER_REV, LAYERS, SLOTS, ENV_TOKENS, MATERIALS, CHAIN_D
export const SLOTS = ['wingFarUpper','wingFarLower','wingFarHand','pedalFar','footFar','shankFar','thighFar','crankFar',
 'wheelRear','wheelFront','frame','fork','bars','cog','chain','chainring','crankNear','neck','tail','body',
 'pedalNear','shankNear','footNear','thighNear','pouch','billLower','billUpper','head','eye','crest',
 'wingNearUpper','wingNearLower','wingNearHand'];           // back→front inside #L-rider
export const LAYERS = [ // {id, depth, owners}; each owner gets its own sub-group #<id>--<owner>
 ['L-sky',0,'sky'],['L-stars',0,'sky'],['L-sunmoon',0,'sky'],['L-clouds',.03,'sky'],['L-hills-far',.05,'sea'],
 ['L-lighthouse',.07,'sea'],['L-sea',.1,'sea'],['L-boats',.12,'sea'],['L-gulls-far',.15,'fx'],['L-atmo',.2,'lead'],
 ['L-shore',.6,'land'],['L-roadside',.9,'land'],['L-road',1,'land'],['L-shadow',1,'fx'],['L-fx-back',1,'fx'],
 ['L-rider',1,'bike|pelican-body|pelican-limbs'],['L-fx-front',1,'fx'],['L-foreground',1.3,'land'],['L-letterbox',null,'lead']];

// Pose (rig/solve.js): pure, no DOM, importable in node
export function solvePose(t, s) /* s: {crank:rad, distance, cadence, speed, coasting, events:[{type:'hop'|'wave'|'bell'|'land',t0}]} */
  // -> { joints: Record<Slot,{x,y,rot,sx?,sy?}>  (rider-space, deg, wrapped), local: {...},
  //      neck:{p0,p1,p2,p3,w0,w1}, chainOffset, wheel, crank, riderY, bikePitch, blink, spokeBlur, riderXf }
export function ik2(hx,hy,tx,ty,L1,L2,bend, soft=0.97) // -> {a1,a2,d,clamped} radians, absolute

// Every art/world/fx module (bike, pelican-body, pelican-limbs, sky, sea, land, fx):
export const id = 'bike';
export function build(ctx)  // ctx {C, rng(salt), v(token,{far}) -> 'var(--pb-x[-far])', quality}
  // -> { defs?: string, slots?: {[slot]: markupInJointLocalCoords}, layers?: {[layerId]: markup} }
export function attach(svg, ctx) // -> { update(frame), bake(kit, spec) -> BakeDescriptor[] }
// Pure deformers exported for the baker: pelican-body `neckD(neck) -> d`; bike `CHAIN_D`.

// Frame passed to update(): {t, dt, distance, speed, cadence, tod, sun:{x,y,elev}, night, pal:{env,mat,num},
//   pose, cam:{fx,fy,zoom,roll,mode}, toggles, quality, reduced}
// BakeDescriptor: {el, kind:'transform'|'attr', type?, attr?, values[], keyTimes?, dur, additive?, calcMode?}
// core/bakekit.js (lead): linearLoop(el, type|attr, from, to, dur); sampled(el, attr, fn(phase), dur, n)

// core: svg.js h(tag,attrs,...kids)->string, xf(j)->string, mount(parent, markup), refs(root,prefix)
//       bus.js createBus() -> {on(type,fn)->off, emit(type,p), once}
//       palette.js samplePalette(tod) -> {env, mat(×grade, plus -far ×0.8), num:{night,starAlpha,lampOn,rimAlpha,shadowAlpha}}
//                  applyPalette(svg, pal)  // ≤10 Hz, CSS vars on svg#scene
//       camera.js per layer: translate(800,450) scale(1+(z-1)·clamp(d,.15,1)) translate(-(800+(fx-800)d), -fy)
export function createUI(host, bus, init)      // -> {update(frame)}  HTML overlay; CSS as a JS string
export function createAudio(bus)               // -> {enable():Promise, disable(), update(frame)}
export function bakeSVG(scene, {cadence=60, tod=.70, cam='wide', samples=60, resolveVars=true}) // -> string
// window.__pb = {ready, renderAt(t,{tod,cam,cadence,events}), setState, pose(), bakeSVG}
// URL params: ?freeze&t=&tod=&cam=&solo=<module>&skeleton=1&perf=1
```

**Bus events.**
- From the UI: `ui:bell`, `ui:wave`, `ui:hop`, `ui:camera{mode}`, `ui:speed{cadence}`, `ui:coast{on}`, `ui:tod{tod,auto}`, `ui:toggle{key,value}`, `ui:sound{on}`, `ui:download{kind}`.
- From `main.js` to audio and fx: `rig:event{type,t0}`, `rig:land`.
- Per-frame data is passed by direct `update()` calls, not the bus.

**Keyboard:** Space bell, W wave, H/↑ hop, C camera, N time of day, ←/→ cadence, M mute, P pause.

**Cameras.**
- Wide: z = 1, focus (800, 450).
- Close: z = 2.0, focus (RIDER_X + 60, GROUND_Y − 380). Shows the head down to the knees and the whole bike.
- Cinematic: z = 1.25 + 0.2·sin(2πt/16), with the focus drifting on 23 s and 19 s sinusoids, roll 0.6°, and 2.39:1 letterbox bars of 115.3 each.
- Switching between modes uses a critically damped spring, ω = 6.

**Palette.** Environment tokens:

`sky0 sky1 sky2 sunCore sunGlow cloudLit cloudShade seaFar seaNear foam hillFar hillNear sand road roadLine grassFar grassNear foliage trunk rim grade`

- Keyframes at tod 0 / .20 night, .26 dawn, .34–.62 noon, .70 golden, .76 sunset, .80 dusk, .86 night, interpolated in linear RGB.
- Starting values:
  - Golden: sky `#3B5BA5 / #E58C6A / #FFD39A`, sea `#6E7FB5 / #2E4F7F`, grade `#FFE9D6`, rim `#FFC47A`.
  - Night: sky `#070B1F / #111A3D / #243463`, grade `#5A6AA0`.

Material colours (fixed, multiplied by grade):

| Material | Colours |
|---|---|
| Plumage | `#FBF8F4`, shade `#E6DFE0`, deep `#C9C2CC` |
| Flight feathers | `#1E1B22`, sheen `#3A3A48` |
| Bill | `#F2A48A`, edge `#D9705A`, nail `#E0503A` |
| Pouch | `#F9C74F` → `#F4A340` |
| Face skin / iris | `#F7C1B5` / `#8B1E1E` |
| Feet | `#F08A3C`, web `#F5A05A` |
| Bike | frame `#1F8A8A`, accent `#F3E9D2`, saddle `#7A4A2A`, basket `#C89B5E` |

- Lights (lamps, headlamp, lighthouse) are emissive and are not multiplied by the grade.
- Rule: no raw hex anywhere except `palette.js`. `tools/lint.mjs` checks this.

### File ownership

All paths are under `pelican-bicycle/`.

| Owner | Files |
|---|---|
| Lead (phase 0, then integration) | `package.json` + lockfile (esbuild 0.28.2 pinned; installed once, **agents never run npm**), `src/contract.js`, `src/core/{math,svg,bus,palette,camera,bakekit}.js`, `src/scene.js`, `src/main.js`, `src/index.dev.html`, `src/index.html` template, `tools/{build,serve,shoot,sheet,perf,lint}.mjs`, stubs for every module, basic IK in `rig/solve.js` (then handed over) |
| rig | `src/rig/{solve,ik,secondary}.js`, `src/art/debug-skeleton.js`, `tools/check-rig.mjs` |
| pelican-body | `src/art/pelican-body.js` (neck, tail, body, pouch, bills, head, eye, crest) |
| pelican-limbs | `src/art/pelican-limbs.js` (legs and wings, with far-side variants) |
| bike | `src/art/bike.js` (all bike slots, basket with fish, headlamp body) |
| sky | `src/world/sky.js` |
| sea | `src/world/sea.js` (hills, lighthouse with beam, sea, boats) |
| land | `src/world/land.js` (shore, palms, lamps with glows, road, foreground) |
| fx | `src/fx/fx.js` (gulls, dust, speed lines, feathers, headlamp beam, shadow) |
| ui (+ audio if you want 10 agents) | `src/ui/ui.js`, `src/ui/styles.js`; `src/audio/audio.js` |
| baker | `src/bake/bake.js`, `tools/bake.mjs`, `tools/check-baked.mjs` |

**Isolation rules:**
- All ids, classes and `data-ref`s are prefixed with the module id; `scene.js` reports duplicates as errors.
- Each module only touches its own slots and layer sub-groups.
- Screenshots go to `shots/<owner>/`. `shoot.mjs` serves on port 0 and exits non-zero on any console error.

**Build.**
- esbuild: `src/main.js` bundled as an IIFE, with `</script` escaped, inlined into `dist/index.html`.
- Fallback: rewrite relative imports to bare `pb/...` specifiers and inline each module as a `data:` URL in an import map. Smoke-test this in phase 0.
- Import rules: relative imports with `.js` extensions, static imports only, and no top-level DOM access outside `main.js`, so rig, contract and palette can be imported in node.

---

## 5. Top risks and mitigations

1. **Filter cost.** Chromium re-rasterises filters on moving content. Use zero `<fe*>` in live mode; do glows with `radialGradient` and cloud softness with stacked transparent ellipses; `lint.mjs` greps for `<fe`.
   - Budgets: ≤ 4000 DOM nodes, ≤ 60 transform writes per frame, JS p95 ≤ 2 ms (`?perf=1`), palette updates ≤ 10 Hz.
   - `perf.mjs` reads CDP script and style times with 4× CPU throttling. Headless here renders in software, so GPU timings aren't meaningful.
2. **IK flip or pop.** The margins above, fixed bend signs, clamping plus soft IK, and polar interpolation for the wave. `check-rig.mjs` runs in node and fails on any NaN, a knee on the wrong side, end-effector error > 0.01, a joint jump > 1° between 0.25° steps, or distance > 0.97·(L1 + L2).
3. **Far leg vs frame z-order.** Solved by the flat slot list. Far parts use `-far` material tokens (×0.8) instead of CSS filters. The wheels hide the far foot naturally.
4. **Bundling.** Pinned esbuild, the import-map fallback, CSS kept as JS strings, `</script` escaping, and a phase-0 check that `dist/index.html` opens from `file://` with no console errors.
5. **SMIL fidelity.**
   - Wrap each slot as nested `<g>` (translate / rotate / scale) rather than stacking `additive` animations on one element.
   - Unwrap angles in the baker.
   - Use exact integer ratios (wheel 0→1080, chain −48 links) so nothing drifts.
   - Give neck paths a fixed command count so `d` can be animated.
   - Resolve CSS variables to hex by default, and include no scripts.
   - `check-baked.mjs` renders the baked SVG with `setCurrentTime(t)` and diffs it against `renderAt(t)` on a canvas, with a mean-difference threshold.
6. **Aliasing and precision.** The spoke, chainring and chain rules in §3, plus wrapping DOM angles and offsets.
7. **Parallel conflicts.** `contract.js` is frozen, and change requests go to the lead. Id prefixes, per-owner shot folders, a single npm install, and `rng(seed)` for deterministic layouts.
8. **Audio and accessibility.**
   - Audio: the `AudioContext` is created only on a user gesture, with a 100 ms lookahead scheduler on a 25 ms interval, suspended when the tab is hidden.
   - Reduced motion: start paused on a golden-hour poster frame; when played, use 40 rpm, no speed lines or shake, cinematic falls back to wide, and foreground depth is clamped to 1.0.

**Phases.**
- Phase 0 (lead): scaffold and basic IK.
- Phase 1: parallel agents, each accepting their own work via screenshots, `check-rig`, lint and the perf budget.
- Phase 2: integration, with contact sheets of 8 crank phases × 4 times of day × 3 cameras.
- Phase 3: critic panel (pelican anatomy, bike mechanics, cinematography and colour), with issues routed to the owning file.

### Critical Files for Implementation
All are planned paths; none exist yet.
- /home/user/experiments-and-tests/pelican-bicycle/src/contract.js
- /home/user/experiments-and-tests/pelican-bicycle/src/rig/solve.js
- /home/user/experiments-and-tests/pelican-bicycle/src/scene.js
- /home/user/experiments-and-tests/pelican-bicycle/src/core/palette.js
- /home/user/experiments-and-tests/pelican-bicycle/tools/build.mjs