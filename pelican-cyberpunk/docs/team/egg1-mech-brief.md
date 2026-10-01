# Brief: replace egg #1 (Konami) with the cyber mech armour assembly (user request)

The user's words: "我希望第一个彩蛋换成鹈鹕换上赛博机甲，类似钢铁侠 3 电影那种机械式的长出来，酷炫的动画". Make the first easter egg the pelican suiting up in cyber mech armour that grows out mechanically, like in the Iron Man 3 film, with a cool animation.

Project: `/home/user/experiments-and-tests/pelican-cyberpunk` (Neon Pelican). Read `CONTRACT.md`, `docs/STYLE-X.md`, `docs/EGGS.md`, `src/fx/eggs.js` (egg #1 `brown`), `src/art/pelican-body.js`, `src/art/pelican-limbs.js`, `src/rig/solve.js` (the slot and pose fields), and `src/core/sheets.js`.
Do not touch `../pelican-bicycle` or `../pelican-storybook`.

## What to build
1. **The trigger stays the Konami code** ↑↑↓↓←→←→BA. Pressing it again (or the Esc key) disassembles the suit in reverse.
2. **The animation is an assembly sequence of about 3.5–4.5 s, while the pelican keeps riding.**
   - Timing is a pure function of (t − t0) so that `renderAt` stays deterministic.
   - The design is ORIGINAL: a pelican-shaped mech suit (no Marvel or Iron-Man likeness, logos or colours copied one-to-one). Use the STYLE-X palette: gunmetal and chrome plates, magenta and cyan energy seams, an acid-green status light.

   | Time (s) | Beat |
   |---|---|
   | 0.0–0.4 | **Arming:** a HUD lock-on reticle frames the rider, then "MECH PROTOCOL 鹈鹕-01 · ENGAGE". A ring of light sweeps down the body (scan lines). |
   | 0.4–2.6 | **Mechanical growth**, staged and overlapping, each plate group arriving with anticipation → overshoot → settle (spring easing). Plates **unfold from compact "seeds"** (hinged segments rotating out, telescoping, sliding along rails, with micro-panels flipping over), rather than just fading in. |
   | 2.6–3.2 | **Power-up:** energy seams light up in a travelling wave from the chest core outward, vents flare, small steam/spark bursts at the joints, a shockwave ring on the road, and the bike gets a matching armour fairing and an upgraded underglow. |
   | 3.2–4.0 | **Hero beat:** a short camera push-in (use the camera via `bus.emit('ui:camera')` only if safe, or a local scale pulse), a visor "eye" glint, a HUD card "MECH ONLINE · 机甲上线 · ARMOR 100%", and a pelican pose accent (head up, a proud bill snap). |
   | after | **Steady state:** the suit stays on; a subtle idle (breathing light on the core, plate micro-shifts that follow the pose, with the thrusters flickering). |

   The order of the growth stage:
   1. feet and boots (wrap around the webbed feet, while the webbing stays visible through slots);
   2. shins and knee caps;
   3. thighs;
   4. the chest core (a glowing reactor shaped like a fish icon, which is ours, not an arc reactor copy) with the ribs closing over it;
   5. back and shoulder plates;
   6. the wing gauntlets (segmented feather-blade plates fanning along the wing);
   7. the neck rings (stacked collars telescoping up the S-neck);
   8. the helmet (plates folding over the skull from the back), with **the bill armoured in segmented sheaths and the pouch covered by a flexible mesh** (the pelican must still read as a pelican, and the bill silhouette must stay iconic);
   9. last, the visor slams down with a flash.
3. **It must follow the rig.** Attach plate groups to the existing joint slots (`#j-*`), drawn in joint-local coordinates, so they ride every pedal stroke, the hop, the wave and the gulp exactly. The neck armour follows `pose.neck` (use `neckD`-style sampling along the Bézier). Nothing may drift off the body at any crank angle: check 24 frames.
4. **Performance:** no filters on moving parts (STYLE-X §2). Glow comes from stacked strokes and gradients; plates are pre-built hidden groups, transform and opacity only, no DOM creation during play. The DOM budget is +≤ 400 nodes. `--perf` must not drop more than 2 fps against before.
5. **Sound** (if `src/audio/audio.js` exposes hooks, add, otherwise emit bus events the audio can use): mechanical clicks and servos per plate group, a rising power-up whine, a bass "thoom" on lock, a HUD bleep. Use the existing synth helpers; no files.
6. **Housekeeping:**
   - Keep the brown-pelican skin by moving it to a new typed code `BROWN`, so the benchmark nod isn't lost. Update `docs/EGGS.md` (row #1 becomes "机甲 · Mech suit", and add the brown pelican's new trigger) and the egg counter total if it changes.
   - Keep `gold` (`888`) combinable: a gold mech.
   - `window.__pb.eggs.trigger('mech')` (or keep id `brown` → rename to `mech` consistently across eggs.js, tools/check-eggs.mjs and the UI tally).
7. **Verification:**
   - `node tools/check-eggs.mjs --sheet` passes with 0 console errors.
   - Make a 12-frame filmstrip of the assembly (t0 + 0, 0.3, … 4.0 s) at the close camera plus the wide steady state, and READ it. Iterate ≥ 5 times until it looks like a film-quality suit-up.
   - Also check: `check-rig`, `lint`, `build`, `shoot --dist` (0 errors), `detail-inventory` PASS, `--perf`.
   - Write the filmstrip to `shots/mech/filmstrip.png`.
