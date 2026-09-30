# 🐦🚲 Pelican Bay: an SVG animation of a pelican riding a bicycle (plan)

## Context
The user wants an **SVG animation of a pelican riding a bicycle, delivered as HTML**, and asks for an extreme, over-delivered result. They explicitly allow many agents working in parallel and "any tool."
- The repo `jamesyoung-gui/experiments-and-tests` is **empty**: no commits, no remote refs. Work goes on branch `claude/gracious-allen-1ksl3j`, which ends in a draft PR.
- Tools checked in this container:
  - **Node 22** and **esbuild 0.28** (the npm registry is reachable).
  - **Playwright 1.56 + headless Chromium**, used as the "render farm" for screenshots, frame strips and a webm preview.
  - ffmpeg that ships with Playwright.
  - **4 CPUs**, so the workflow runs at most about 2 agents at a time.
- What isn't available, stated plainly:
  - **Blender is not installed.** Blender renders raster images, which is also the wrong tool for a vector animation.
  - **"ChatGPT 6 Astra" doesn't exist as any tool or connector here.**
  - Instead we use a procedural SVG rig plus multiple Claude agents, plus Chromium to visually check every step.
- Outcome: one self-contained `index.html` (no external runtime dependencies) that plays a lively, mechanically correct, interactive animation. It also ships a zero-JS animated `.svg`, a poster and a preview video. It is published as a private Artifact so the user can open it right away.

## Deliverables (`pelican-bicycle/`)
| File | What it is |
|---|---|
| `dist/index.html` | Main deliverable. All inline SVG + CSS + JS, bundled from `src/` |
| `dist/pelican-bicycle.svg` | **Zero-JS** animated SVG (SMIL), "baked" from the same rig. Works as an `<img>` too |
| `dist/poster.png`, `dist/contact-sheet.png`, `dist/preview.webm` | Poster frame, strip of 12 frames across one pedal cycle, recorded preview |
| `src/**` | ES-module source (art / rig / world / fx / ui / audio / export) |
| `tools/build.mjs`, `tools/bake.mjs`, `tools/shoot.mjs` | Bundle and inline · bake the SMIL SVG · Playwright screenshots, frame strips, fps and console-error checks |
| `README.md` | Chinese/English notes: features, controls, how it was built |

## Creative direction
- **Scene: "Pelican Bay" (鹈鹕湾), a coastal road.** Pelicans live on coasts. Layers from back to front:
  - sky with sun or moon and stars
  - clouds
  - sea with waves, glints, a lighthouse, sailboats and a distant island
  - hills
  - road with guardrail, palms, lamp posts, a signpost and a fish stand
  - foreground grass and flowers that fly past
- **Time of day:** sunrise → noon → golden hour → night. The whole palette (colour tokens) is interpolated. At night the lighthouse beam sweeps and the bike headlamp comes on.
- **The rider: a great white pelican.**
  - Plumage: white with a faint pink tint, black flight feathers, a messy crest at the back of the head.
  - Bill: long, pinkish-orange, with a hooked tip. Yellow-orange throat pouch that is slightly translucent and jiggles.
  - Legs and feet: orange legs, webbed feet flat on the pedals.
  - Accessories: a small scarf and goggles on the forehead.
- **The bike:** a retro city bike.
  - Frame: diamond frame, fork with rake.
  - Drivetrain: chainring and cog with teeth, a chain that really moves.
  - Wheels: spoked; above a speed threshold the spokes fade into a motion-blur disc.
  - Fittings: saddle, bell, headlamp, reflectors, a **front basket with fish**.
- **Animation principles:** follow-through and overlapping action (pouch, crest, scarf, tail), squash and stretch on a bunny hop, head stabilization (bird head stays steady), body bob synced to pedaling, rhythm from road bumps.
- **Interaction:**
  - Keys: Space = pause · ←/→ = cadence · B = bell · W = wave · J = bunny hop · C = camera (wide / close-up / cinematic letterbox) · T = time of day · M = sound.
  - Click the pelican: it gulps a fish from the basket, the pouch bulges, then it goes back down.
  - Easter egg: pedal fast enough and a seagull flock escorts it for a while.
- **Sound (WebAudio, fully procedural, off by default):** FM bell, freewheel ticking when coasting, wind that rises with speed, waves, gull calls.
- **Quality baseline:**
  - Fits at 390px (phone) up to 4K.
  - Respects `prefers-reduced-motion`.
  - SVG `<title>`/`<desc>` and ARIA labels.
  - Target 60fps: animate transforms only, reuse tiles with `<use>`, a light filter budget.
  - Zero console errors.

## Technical architecture
- **Coordinates:** viewBox `0 0 1600 900`. The rider group is fixed in local coordinates. The world moves via parallax: `offset = distance × depth mod tileWidth`.
- **Rig:**
  - Every moving part is a nested `<g id="j-…">` joint, with `transform = translate(x,y) rotate(a) scale(sx,sy)` relative to its parent.
  - Art modules only draw each part in its own local coordinates, with the joint pivot at the origin.
  - Driving everything is a **pure function** `solvePose(t, state) → {joint: {x,y,rot,sx,sy}}`, with no DOM access:
    - wheel angle = distance / R; crank angle = wheel angle × cog / chainring
    - two-bone IK for the legs (thigh + shank, knee forward, foot flat on the pedal). The near leg is drawn in front of the frame, the far leg behind it and darker.
    - IK for the wings to reach the handlebar grips; a lifted wing for the wave
    - Bézier S-curve for the neck, head stabilization
    - spring-dampers for secondary motion
  - The chain uses `stroke-dashoffset` = crank angle × chainring radius.
- **Baking:** because the rig is pure, `bake.mjs` samples it over one crank cycle (N keyframes). It emits a SMIL `animateTransform` per joint, and each background layer loops on its own `dur`. The page's "Download SVG" button calls the same code.
- **State and events:** one central `state` (speed, time of day, camera, flags) plus a small event bus (`bell` / `wave` / `hop` / `gulp`), consumed by the ui, audio and fx modules.
- **Build:** esbuild bundles to an IIFE, then everything is inlined into `dist/index.html`. For development, `src/index.html` loads the ES modules directly (`npx serve`).
- **Rig spec:** a background design agent is working out the exact geometry numbers (wheel/hub/bottom-bracket/crank/grip coordinates, the pelican joint table and bone lengths, node-verified IK reachability) and the module interface signatures. In Phase 0 these go straight into `pelican-bicycle/CONTRACT.md`. Hard constraint: over the full 360° crank rotation, the hip-to-pedal distance must stay within `(|L1−L2|+margin, L1+L2−margin)`. If it doesn't, we adjust the saddle height or bone lengths.

## Multi-agent execution (Workflow; about 30–35 agents in total, 2 running at a time)
This runs as 2–3 separate Workflow runs, split at the style checkpoint (Phase 1) and optionally before the fix loop, so I can review results and step in at each split.
We use dozens, not hundreds. Parallel builders must each own separate files. With a 2-agent concurrency cap, more agents only adds conflicts and waiting. Every agent below has a distinct job.

**Phase 0 (me, done directly):**
- Write `CONTRACT.md` (coordinates, joint table, palette tokens, layer IDs, module signatures, file-ownership map).
- Write a runnable scaffold: placeholder shapes for every module, plus `build` / `shoot` / `bake` tools. Every agent can then render and **Read screenshots to check its own work visually.**

**Phase 1: style drafts → the user picks (4 + 1 agents, then a checkpoint).**
- 4 agents each draw a complete static keyframe (pelican + bike + scene) in a different style:
  - A. flat geometric vector
  - B. warm storybook illustration (gouache texture through SVG filters)
  - C. retro travel poster (limited palette, strong shapes)
  - D. Ghibli-style warm light
- The drafts are rendered with Playwright into a side-by-side comparison, `dist/style-drafts.png`, plus a separate large image per draft.
- 1 reviewer only annotates each draft's anatomy and animatability risks, for your reference. **It does not choose.**
- **Checkpoint:** I send you the comparison, and **you pick** (or mix, e.g. "pelican from A + scene from D").
- The chosen draft becomes the visual reference, and only then does Phase 2 start. The workflow is split in two at this checkpoint.

**Phase 2: parallel build (11 agents, each owning only its own files).** Each builder must self-check through screenshots.

| # | Owner | Files |
|---|---|---|
| 1 | Pelican body / head / bill / pouch / eye / crest | `src/art/pelican.js` |
| 2 | Legs, webbed feet, wings, tail feathers | `src/art/limbs.js` |
| 3 | Rig solver (IK / springs / neck / bunny hop / gulp) + node unit tests | `src/rig/*` |
| 4 | Bike + drivetrain (chain, spokes, motion-blur disc, basket with fish, headlamp) | `src/art/bike.js` |
| 5 | Sky / sun and moon / stars / clouds / time-of-day palette | `src/world/sky.js`, `src/world/palette.js` |
| 6 | Sea / waves / glints / lighthouse / sailboats | `src/world/sea.js` |
| 7 | Road / palms / lamp posts / signpost / foreground | `src/world/land.js` |
| 8 | FX (gull flock, dust, speed lines, feathers, butterflies, headlamp beam) | `src/fx/*` |
| 9 | UI panel / keyboard / camera / a11y / bilingual labels | `src/ui/*`, `src/styles.css` |
| 10 | Procedural WebAudio | `src/audio/*` |
| 11 | SMIL baker + Download button logic | `src/export/*`, `tools/bake.mjs` |

**Phase 3: integration (1 agent).** Wire the modules together, fix contract mismatches, make `dist/` build cleanly with zero console errors.

**Phase 4: critic panel (6 agents, run on renders).** Inputs are a 12-frame pedal-cycle strip, four times of day, three camera modes, a 390px phone view, and fps/node-count/console measurements. Each critic uses one lens:
1. pelican anatomy and charm
2. bike mechanics: feet never leave the pedals, wheel direction and chain are correct, no IK flips
3. animation principles
4. composition, colour and light
5. performance and code bugs
6. UX / a11y / fidelity of the baked SVG

Output: structured, prioritized findings tagged with the files they concern.

**Phase 5: fix loop (grouped by file ownership, about 4 to 6 fixers per round, at most 2 rounds).** After each round, re-render, and 2 judges re-score. Stop when every lens scores ≥ 8/10 or the round cap is hit.

**Phase 6 (me):**
- Check the final renders myself.
- Build `dist/`, record the webm, write the README.
- Commit and push to `claude/gracious-allen-1ksl3j`, open a draft PR and subscribe to it.
- **Publish `dist/index.html` as a private Artifact** (load the `artifact-design` skill before publishing) and send the file to the user.

## Verification
- `node tools/build.mjs` succeeds. `dist/index.html` is ≤ 1MB and has no external `<script src>`.
- `node --test pelican-bicycle/src/rig` passes. Across the full 360° crank rotation:
  - pedal-to-foot distance < 0.5 units
  - knees stay in front of the hips (no flips)
  - hands stay on the grips
  - wheel rotation matches the direction of travel
- `node tools/shoot.mjs`:
  - zero console errors; 12 frames + 4 times of day + 3 cameras + 390px screenshots come out
  - measured fps ≥ 55 (headless Chromium, 1600×900)
  - keyboard shortcuts respond
- `dist/pelican-bicycle.svg` shows motion when loaded in Chromium as an `<img>`: screenshots taken at different times differ.
- I check the contact sheet and final screenshots myself.
