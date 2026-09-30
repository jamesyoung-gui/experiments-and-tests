export const meta = {
  name: 'pelican-build-fast',
  description: 'Pelican Bay fast build in style C: 12 module builders, integration, 14 rubric judges (13 dimensions + G-DETAIL), one fix round, adversarial verification',
  phases: [
    { title: 'Build', detail: '12 builders, each owning its own files, style C, detail quotas, visual self-check' },
    { title: 'Journey', detail: 'long non-repeating route + easter eggs (new user requirements)' },
    { title: 'Integrate', detail: 'wire modules, zero console errors, dist, bake, perf' },
    { title: 'Review', detail: '4 grouped judges covering all 13 dimensions + G-DETAIL' },
    { title: 'Fix', detail: '≤ 6 owners with blockers/majors' },
    { title: 'Verify', detail: 'final fixer + full gate run' },
  ],
}

const ROOT = '/home/user/experiments-and-tests/pelican-bicycle'
const REF = `${ROOT}/drafts/C-poster`

const COMMON = `You are part of an elite team building "Pelican Bay" (鹈鹕湾): a self-contained HTML page with an interactive SVG animation of a great white pelican riding a bicycle along a seaside road. It will be judged as a showcase of the absolute limit of what AI can make: instantly readable, anatomically convincing, mechanically correct, full of charm and craft, and silky at 60fps.

THE USER CHOSE STYLE C: a retro travel poster (WPA / art-deco screenprint). The user ALSO requires that the final version have FAR MORE DETAIL than the draft.

MANDATORY READING before you write code:
1. ${ROOT}/docs/STYLE-C.md (the style bible: 7 inks, halftone rules, character corrections, composition). Obey it.
2. The reference draft: ${REF}/keyframe.png and ${REF}/closeup.png (Read both images), and the source ${REF}/gen.mjs. Mine it for shapes, the halftone dots() helper, the stroke capitals, and ttf.mjs glyph-to-path. Port and adapt, then go far beyond it.
3. ${ROOT}/CONTRACT.md (module interface, coordinates, colour tokens, the detail-inventory convention, budgets, tools, rules), ${ROOT}/docs/rig-spec.md (geometry), and ${ROOT}/src/contract.js.
4. The rubric criteria for your role: run node ${ROOT}/tools/rubric.mjs <dims> (the dimensions are listed in your brief) and aim for the 10-point anchors. Some anchors mention tools that don't exist yet; satisfy the intent anyway.
5. Your module's current placeholder code.

G-DETAIL (hard gate): tag every distinct detail item with data-detail="<layer>:<O|T>:<name>" and export detailItems. Your quota is in your brief. Check it with node ${ROOT}/tools/detail-inventory.mjs --dev (it counts only visible, un-occluded items ≥ 2 px² in the wide or close view). Detail must be real and legible at 1× and at 3× zoom (shoot --set zoom). No padding: judges audit it. Put dense detail on static or slow layers and merge static detail into few path elements. Tag an element per distinct item kind; don't create one DOM node per dot.

RULES:
- Only edit the files you own (listed below). If you need something from another owner or a contract change, put it in contractRequests in your report. You MAY read any file. Never run npm install and never git commit.
- Colours only via ctx.v(token) / CSS variables. Ink mapping is in STYLE-C §1; add module materials only as style-C inks.
- Self-check visually and often: node ${ROOT}/tools/shoot.mjs --out shots/<your-id> --set hero,frames,tods,cams,events,zoom,mobile --sheet (use --query "solo=<module>" when useful), then Read the PNGs: sheet.png plus several full-size frames and zoom crops. Do at least 4 visual iterations and keep going until a world-class illustrator and animator would be proud of it. shoot.mjs must exit 0 (zero console errors).
- Also run node ${ROOT}/tools/lint.mjs; run node ${ROOT}/tools/check-rig.mjs if you touch rig-related code; run node ${ROOT}/tools/shoot.mjs --perf once at the end (budget: fps ≥ 58, JS p95 ≤ 2 ms, total DOM ≤ 6000 nodes).
- Other builders work in parallel on other files, so the scene may show placeholders or half-finished art; ignore that.
Return the structured report.`

const REPORT = {
  type: 'object',
  properties: {
    owner: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
    detailCount: { type: 'number', description: 'your visible detail items per detail-inventory' },
    features: { type: 'array', items: { type: 'string' } },
    contractRequests: { type: 'array', items: { type: 'string' } },
    knownIssues: { type: 'array', items: { type: 'string' } },
    perf: { type: 'string' },
  },
  required: ['owner', 'files', 'summary'],
}

const BUILDERS = [
  { id: 'rig', dims: 'D3 D5 D6', files: 'src/rig/solve.js, src/rig/ik.js, src/rig/secondary.js, tools/check-rig.mjs', quota: 'none (motion only)', brief: `Own ALL motion. solvePose stays PURE and exactly periodic in crank phase when there are no events. Known defects from the animation director's probe that you must fix:
- The crest peaks at crank phase 12° while its parent, the head, peaks at 49.5°: the child LEADS the parent, which reverses follow-through. Make children lag their parents (head → crest → tips; body → tail; bill → pouch).
- The crest (12°) and pouch (13.5°) are phase-locked, so they read as one rigid piece: give them different natural frequencies and damping.
- The hop floats (0.58 s airtime for 58 u ≈ 0.45 g): use real-feeling gravity with anticipation, squash/stretch, landing overshoot and a scarf flying up.
- The blink is metronomic every 3.7 s: make it irregular via a deterministic hash, with occasional double blinks.
- There is no gaze: add a gaze/look-around system with quick saccades (≤150 ms) and holds (≥500 ms): look ahead, at the sea, occasionally at the camera, and at the fish basket.
- The bars never rotate: add a tiny steering wobble, and during the wave the far wing keeps steering.
Also polish: pedalling rhythm (bob, sway, hip rock, ankling), breathing, wind flutter, the wave (wing unfolds from the bar with follow-through), the bell (alula or thumb flick + head nod), the gulp (head tips back, bill opens mostly at the lower jaw, the pouch bulges, and the bulge travels down the neck: expose it in pose.neck), coasting (cranks stop, feet level, relaxed lean back), and add pose fields for the scarf (a chain of segment angles with follow-through) so pelican-body can draw it. Extend check-rig.mjs to check events and the rules above (child-lags-parent phase, gravity). check-rig must pass. Don't rename slots; add pose fields and document them in your report for the art owners.` },
  { id: 'pelican-body', dims: 'D1 D4 D6 D7 D13', files: 'src/art/pelican-body.js', quota: '≥ 42 items in layer "pelican" (O and T)', brief: `Own slots neck, tail, body, pouch, billLower, billUpper, head, eye, crest, plus neckD() and the SCARF (draw it inside the body/neck slots, driven by the rig's scarf pose fields when they exist; otherwise animate it in update() from frame.pose). A great white pelican with star quality in style C:
- Paper-white plumage in ink P with a B key line; volume from contour-feather scallops, layered breast and back feathers, and tail feathers. No halftone greying (STYLE-C §2).
- A long S-neck with feather-flow strokes that follow the deformer (neckD keeps a fixed command count).
- Head: pink facial skin around the eye, a dark eye with a highlight, a thick upper eyelid line, a content or cheerful expression (no fierce orange eyeliner), a feathered forehead point on the culmen base, and a shaggy white crest.
- Bill: long peach bill with a culmen ridge and the red hooked nail; the gape line reaches behind the eye; the lower mandible rami frame the pouch.
- Pouch: amber, with R/K texture lines that stretch with sy, extending behind the gape to the throat.
Detail ideas: individual scallop rows, a rim-light edge in K, a breast yellowish patch, and an optional goggles strap. Night must stay readable.` },
  { id: 'pelican-limbs', dims: 'D3 D4 D13', files: 'src/art/pelican-limbs.js', quota: '≥ 30 items in layer "pelican"', brief: `Own the leg and wing slots (Near and Far; Far = flat B/N ink, no red dots).
- WINGS MUST READ AS WINGS, NOT ARMS WITH SLEEVES (a shared defect of all 5 drafts): a broad covert base (propatagium) joining the body side; ≥ 3 rows of P coverts; N secondaries with thin P edges hanging below the arm line like a fringe; N primaries sweeping back and down from the wrist; at the grip, ≥ 4 separate primary tips curling around it like fingers (a feather fan, not knuckles); an alula for bell flicks.
- LEGS: feathered thigh "trousers" merging into the body; an amber tarsus with scale rings and a joint that reads as a bird's intertarsal joint; TOTIPALMATE feet (all four toes webbed, including the hallux web) flat on the pedal (ball at local (17,9)), with toe scutes and claws.
Check every one of the 24 frames and the wave: no seams at the shoulder, elbow, wrist, hip, knee or ankle at 3× zoom.` },
  { id: 'bike', dims: 'D1 D2 D13', files: 'src/art/bike.js', quota: '≥ 95 items in layer "bike"', brief: `Own every bike slot: a retro city bike in style C (T teal frame, N tyres, P accents, R pinstripes), mechanically perfect and lavishly detailed.
- Frame and steering: lugs and brazed joints; a head badge (a pelican emblem); a down-tube decal "鹈鹕 PELICAN" as paths; the fork with rake and crown; swept-back city bars with grips.
- Brakes and controls: brake levers, cables and housing with realistic routing, calliper or rod brakes.
- Saddle: leather sprung saddle with rails, springs and copper rivets.
- Drivetrain: 48T chainring with teeth, a 5-arm spider and bolts; a 16T cog; crank arms with dust caps; platform pedals with reflectors; a chain on CHAIN_D (pathLength 100) with plates, pins and rollers, dashoffset from pose.chainOffset; a chainguard.
- Wheels: 700c, with tyre tread and sidewall text; the rim with its brake track; hubs with flanges; 32 spokes 3-cross with nipples; a valve; spoke reflectors; the anti-aliasing rules (spoke fade by pose.spokeBlur, 2-ink blur wedges).
- Fittings: fenders with stays and a mud flap; a kickstand; a dynamo; a rear rack with a rolled towel; a bell; a headlamp body; a rear light; a front basket with a woven weave texture holding fish with scales, fins, gills and eyes (tails flop occasionally in update); a bottle cage or pump; a license plate "鹈鹕湾 001".
Far-side parts use -far tokens. It must be gorgeous at the close camera and at 3× zoom.` },
  { id: 'sky', dims: 'D7 D13', files: 'src/world/sky.js, src/core/palette.js', quota: '≥ 35 items in layer "sky"', brief: `Own L-sky, L-stars, L-sunmoon and L-clouds, AND the palette in core/palette.js.
- Palette: rewrite ENV_KEYS and MATERIALS as complete 7-ink sets per time of day (STYLE-C §1: dawn, noon, golden = the draft inks, sunset, dusk, night). Keep ink roles consistent; the night must read as a night poster, not a darkened day. Map materials to inks as STYLE-C says.
- Sky: bands of flat inks with halftone transitions (static patterns or pre-generated dot paths).
- Sun: concentric deco rings and radiating rays, rotating very slowly behind and to the right of the rider.
- Moon: craters, deco rings and a halo in quantised rings.
- Stars: star field with a few twinkles (a cheap opacity subset), constellations, shooting stars at night.
- Clouds: several cloud types (deco cumulus with flat bottoms, streaks, a cloud with a speed-line tail), parallax.
- Extras: a distant airship or biplane towing a banner "PELICAN BAY", migrating bird V formations, and sun-dog details.` },
  { id: 'sea', dims: 'D7 D13', files: 'src/world/sea.js', quota: '≥ 45 items in layer "sea"', brief: `Own L-hills-far, L-lighthouse, L-sea and L-boats.
- Headlands and town: distant headlands with a harbour town (houses, a church or tower, a windmill), a pier with pilings, and a harbour wall.
- Lighthouse: gallery railing, lantern, stripes, a keeper's house, and a rotating beam at night (beacon token, --pb-n-lampOn).
- Sea: multiple sea bands from the horizon (y=470) to the shore, with halftone gradations, animated wave-line bands, whitecaps, a sun/moon glitter path under frame.sun.x / frame.moon.x, and rocks with foam.
- On the water: buoys (one with a bell and a gull), several sailboats (a near one with rigging, sails, a flag and a crew figure) that bob and drift, a steamer with smoke, a fishing boat with nets, a seal or dolphin that pops up occasionally, and jumping fish.
Keep it style C (flat inks, halftone only on static or slow layers), with parallax by depth.` },
  { id: 'land', dims: 'D1 D7 D13', files: 'src/world/land.js', quota: '≥ 70 items in layer "land"', brief: `Own L-shore, L-roadside, L-road and L-foreground.
- Beach (depth .6, TILE.shore): striped beach huts (variants: open door, towel on a line), umbrellas, deck chairs, a sandcastle, a crab, footprints, a lifeguard tower, rocks, seaweed, shells.
- Roadside (depth .9, TILE.roadside): palms with coconuts that sway; art-deco lamp posts every 848.2 u with glows at night; a guardrail or balustrade; a signpost "鹈鹕湾 PELICAN BAY 2 km" in deco lettering as paths; a fish stand with an awning and hanging fish; a bus stop with a timetable; a mailbox; a bench with a cat; flower beds; a milestone; a vintage poster on a wall; hedges.
- Road (depth 1, TILE.road; its top must meet GROUND_Y = 790): an edge line, dashes every 157.08, subtle asphalt texture, a manhole, a painted bike lane symbol, kerbstones.
- Foreground (depth 1.3, TILE.foreground): low teal bushes, N grass, flowers and rocks that whip past, covering at most the bottom 8% of the wheels.
Tiles loop seamlessly (3 copies with <use>). Extend art ±400 u beyond the viewBox so camera zoom-out on phones never shows edges.` },
  { id: 'fx', dims: 'D5 D8 D13', files: 'src/fx/fx.js', quota: '≥ 20 items in layer "fx"', brief: `Own L-gulls-far, L-shadow, L-fx-back and L-fx-front.
- Gulls: a flock with flapping and drifting that escorts the rider when cadence > 85.
- Shadow: a crisp flat-ink contact shadow under the wheels plus a body shadow that shrink and fade with pose.riderY during a hop (--pb-n-shadowAlpha).
- Road and air: dust puffs from the rear tyre scaled by speed; a landing dust burst; speed lines above cadence 80 (toggle 'speedlines'); drifting feathers now and then.
- Event pops: screen-print "pops" for events (a letterpress word DING! / HOP! / GULP! with R/O impact rays; a musical note for the bell; little hearts or fish bones after a gulp).
- Night: the headlamp beam cone on the road; fireflies at night.
- Other: butterflies by day.
Pool the particles (no DOM churn), use a deterministic rng, and respect frame.reduced.` },
  { id: 'print', dims: 'D7 D8 D13', files: 'src/world/print.js', quota: '≥ 22 items in layer "typography_frame"', brief: `Own the screen-fixed poster furniture in L-letterbox:
- Frame: a P paper margin with a N frame line and deco corner ornaments.
- Title card: the intro "PELICAN BAY" in the draft's stroke-built deco capitals (red inline, N drop shadow) with the vermilion 鹈鹕湾 seal, subtitle "THE COAST ROAD · BY BICYCLE". It animates in, holds for about 3 s, then shrinks into a small corner logo, and never covers the rider at any camera (read frame.cam and frame.t).
- Ticket-style annotations: an "ADMIT ONE" rail-ticket stub, a postage stamp with a perforated edge and a tiny pelican, a postmark with the date and 鹈鹕湾, printer's registration marks and a colour bar, and a small "Printed at Pelican Bay" imprint.
- A cinematic letterbox that doubles as the poster border, driven by frame.cam.letterbox.
Letters must be paths (port ttf.mjs usage from the draft into a build-time step: generate the path data offline with node and commit it as a JS data module you own, e.g. src/world/print-glyphs.js). No runtime font dependence.` },
  { id: 'ui', dims: 'D9 D8', files: 'src/ui/ui.js, src/ui/styles.js', quota: 'none', brief: `Own the HTML overlay (#ui) and its CSS (inject a <style> from styles.js), styled as a small printed ticket or a deco control card in the style-C inks (not generic glass).
- Panel: collapsible, never covering the rider; bilingual (中文 first, English second).
- Controls: play/pause; cadence slider with a km/h readout; coast; time-of-day slider + auto cycle (sun/moon icons); camera (wide / close-up / cinematic); actions bell / wave / hop / feed a fish (ui:gulp); sound; downloads (animated SVG kind 'svg', current frame kind 'frame').
- HUD: an odometer (km, km/h, rpm) styled as a mechanical counter.
- Help: a keyboard help overlay on '?'.
- Keys: Space = bell, W = wave, H/↑ = hop, F = feed, C = camera, T = time of day, ←/→ = cadence, S = coast, M = sound, P = pause.
- Mobile at 390px: a bottom sheet. Accessibility: labelled buttons, focus rings, aria-pressed, prefers-reduced-motion.
Screenshot the panel open and collapsed, on desktop and mobile. Drive the keys with Playwright and verify they work.` },
  { id: 'audio', dims: 'D8 D9', files: 'src/audio/audio.js', quota: 'none', brief: `Own procedural WebAudio (no samples). createAudio(bus) -> {enable, disable, update(frame)}; create the AudioContext in enable(). Sounds:
- a two-strike ring-ring bell (inharmonic partials)
- freewheel ticking when coasting (rate ∝ wheel speed)
- a soft chain whirr
- wind (filtered noise, gain ∝ speed²)
- ocean swells
- occasional gull calls
- the lighthouse fog horn at night (rare)
- a landing thump
- a gulp "gloop"
- a master compressor
Suspend when the tab is hidden. Verify with Playwright that enable() plus events throws no errors; an OfflineAudioContext render test is a plus.` },
  { id: 'baker', dims: 'D11 D10', files: 'src/bake/bake.js, tools/bake.mjs, tools/check-baked.mjs', quota: 'none', brief: `Own the zero-JS export. bakeSVG(svg, opts) returns a standalone animated SVG (SMIL + CSS only, no scripts, CSS variables resolved to literal inks) that loops seamlessly. Approach: generic record-and-replay through window.__pb.renderAt over a seamless loop (e.g. 4 crank turns at 60 rpm = 4 s; near-layer tiles loop per crank turn by construction). Record every animated attribute on every element, drop static ones, detect linear or rotating ones and emit 2-keyframe animations with unwrapped angles, and decimate the rest with tolerance-based keyframe reduction. Slow far-layer motion gets an opt-in data-bake-period convention (report it in contractRequests). tools/bake.mjs writes dist/pelican-bicycle.svg via Playwright; tools/check-baked.mjs renders it as <img> at several times and checks that it animates and matches the live frames. Keep it under 1.5 MB. The in-page Download button uses window.__pb.bakeSVG. Run at the end, and re-run once other art exists.` },
]

phase('Build')
const reports = (await parallel(BUILDERS.map(b => () =>
  agent(`${COMMON.replaceAll('<your-id>', b.id)}

YOUR ROLE: ${b.id}
FILES YOU OWN: ${b.files}
RUBRIC DIMENSIONS: ${b.dims} (node tools/rubric.mjs ${b.dims})
DETAIL QUOTA: ${b.quota}
BRIEF: ${b.brief}`, { label: `build:${b.id}`, phase: 'Build', schema: REPORT })))).filter(Boolean)
log(`builders done: ${reports.map(r => `${r.owner}(${r.detailCount ?? '-'})`).join(' ')}`)

// ─── New user requirements (added mid-run): the background must be LONG and not visibly repeat; there must be easter eggs.
const USERREQ = `NEW USER REQUIREMENTS (verbatim, in Chinese): "我希望后面的背景足够长，不要很快就开始重复" (the background must be long enough that it doesn't start repeating quickly) and "要有小彩蛋" (there must be little easter eggs) and "要有有趣的变化" (there must be interesting variation and changes over time).`
phase('Journey')
const journey = (await parallel([
  () => agent(`${COMMON.replaceAll('<your-id>', 'journey')}

${USERREQ}
YOUR ROLE: journey (world route). FILES YOU OWN: src/world/land.js, src/world/sea.js, a new src/world/route.js, and (for the far layers only) the cloud and flock placement in src/world/sky.js. You may edit src/contract.js to add route constants.
Problem: every near layer is a single static tile that repeats once per crank turn (TILE.road = 1885 u, about 1 s at 60 rpm), and the far layers repeat within seconds. Viewers notice immediately.
Build a LONG coastal JOURNEY that doesn't repeat:
- ≥ 4 minutes of cruising at 60 rpm before anything repeats exactly (≈ 450,000 u of road). Ideally it never repeats: a deterministic, seeded stream keyed by segment index.
- Structure it as a route script (route.js) of distinct stretches, each with its own set pieces, in style C:
  - the Pelican Bay village with beach huts and a fish market
  - a long pier with fishermen
  - a harbour with moored boats and cranes
  - a lighthouse headland
  - cliffs with a tunnel or rock arch
  - dunes with palms
  - a seaside amusement pier (Ferris wheel, carousel)
  - a railway line with a steam train that races the pelican for a while
  - a bridge over a river mouth
  - an old fort or bathhouse
  - a stretch of pine or cypress trees
  - kilometre stones counting up (鹈鹕湾 0 km → 灯塔角 12 km → …)
  - and then a loop back to the village
- Signposts announce what's coming.
- Near layers (road, roadside, foreground): a pooled STREAMING system. Spawn and recycle a fixed pool of prebuilt <symbol>/<use> props by world position (distance × depth), with per-instance variation (seeded: flips, scale, ink variant, prop choice). No DOM churn per frame: only transforms and href swaps when a pool slot recycles off screen. Road markings and kerbs can stay tiled, but vary the road furniture.
- Far layers (sea, headlands, town skyline, sky clouds, flocks): make them long panoramas (≥ 20,000 u of unique far skyline, sliding slowly by depth) or streamed too, so the horizon changes as you ride (the lighthouse is passed, then the harbour town, then the cliffs, …).
- Keep every existing detail item (don't lose data-detail items). New set pieces add new detail items, but only count items visible in the default hero/close shots; judges check.
- Keep the baked SVG working: in bake mode (window.__pb.renderAt with a bake flag, coordinate via contractRequests; the baker owns src/bake), a short seamless loop is fine. Document how.
- Perf budget unchanged (fps ≥ 58, JS p95 ≤ 2 ms, DOM ≤ 6000).
Verify by rendering many frames far apart (e.g. t = 0, 15, 30, 60, 90, 120, 180, 240 s at 60 rpm via renderAt) into a sheet, reading it, and confirming each looks like a different place with no obvious repetition. Also verify the seams at recycle boundaries.`, { label: 'journey:route', phase: 'Journey', schema: REPORT }),
  () => agent(`${COMMON.replaceAll('<your-id>', 'eggs')}

${USERREQ}
YOUR ROLE: easter eggs. FILES YOU OWN: a new src/fx/eggs.js (register it in src/main.js with a minimal edit, following the module interface: build/attach/update, layers and slots only via the scene), plus a new "found eggs" display, which you may add to src/ui/ui.js with minimal, clearly-scoped edits.
Design and implement ≥ 10 delightful, discoverable, in-style (style C) easter eggs. They should reward curiosity, and be deterministic and testable. Ideas (pick the best, add your own):
1. The Konami code (↑↑↓↓←→←→BA) swaps the rider to Simon Willison's stricter benchmark: a California brown pelican in full breeding plumage (a grey-brown body, chestnut hindneck, yellow crown, red pouch base), via a material/ink override.
2. A "Velocipedia" toggle (typing "velo"): a Gianluca Gimini-style impossible bike (the chain goes to the front hub). The rig visibly jams, the pelican shrugs, then everything snaps back. Credit Gimini in a tiny caption.
3. An orange cat on a bench that snatches a fish from the basket if you ring the bell near it.
4. At the 1.000 km (or 4.2 km) odometer milestone a confetti poster pop appears: "42!".
5. A second pelican on a tandem (or a pelican family on a bike train) overtakes at high cadence and nods.
6. Clicking the sun or moon makes it wink.
7. A UFO at night that beams up a fish.
8. Ringing the bell 7 times fast makes gulls answer in chorus.
9. Hopping over a puddle makes a splash.
10. Coasting 10 s makes the pelican put its wings behind its head ("look, no hands!").
11. A message in a bottle floating in the sea: click it to read a tiny note (bilingual).
12. A shooting-star wish at night.
13. Typing "pelican" makes the title letters do a wave.
14. The lighthouse keeper waves back when you wave (W) near the lighthouse.
Show a small "彩蛋 x/N" counter (in the UI ticket style) that reveals nothing until the first egg is found. Keep an honest list of eggs in docs/EGGS.md (spoilers) for the README. Every egg must be triggerable in tests: expose window.__pb.eggs = {list, trigger(id), found} and add a Playwright check script tools/check-eggs.mjs that triggers each one and screenshots it into shots/eggs/, then Read those shots. Detail items: tag egg visuals with data-detail only if visible in default shots (most aren't; that's fine). Zero console errors. Perf budget unchanged.`, { label: 'journey:eggs', phase: 'Journey', schema: REPORT }),
  () => agent(`${COMMON.replaceAll('<your-id>', 'director')}

${USERREQ}
YOUR ROLE: director of "interesting variation over time". FILES YOU OWN: a new src/world/director.js (a pure, seeded schedule keyed by distance and time, plus its runtime module) and a new src/world/weather.js (weather layer art). Register both in src/main.js with minimal edits. You may emit rig events through the existing event list (frame.events / bus 'rig:event'). Coordinate with the journey agent's src/world/route.js by READING it (don't edit it); if it isn't there yet, read the stretches from its report or define hooks.
Make the ride feel alive and surprising over minutes, not seconds. The rider reacts to what happens. Implement, in style C (flat inks, screen-print rain lines, halftone fog):
- WEATHER that changes along the route: clear → breezy (the scarf streams, palms bend, clouds race) → a passing shower (rain streaks, puddles with ripples; the pelican squints and opens its pouch to drink the rain, a gag) → a rainbow in deco bands → sea fog rolling in on the headland (the lighthouse beam cuts through) → clearing. Wind affects the scarf, crest and palms through frame fields that the art already reads, or through new frame.weather fields (document them).
- ENCOUNTERS scheduled along the route: another cyclist or a pelican friend passes the other way and waves (trigger the rig 'wave' event automatically), a crossing cat makes the pelican ring the bell (auto 'bell'), a puddle or pothole makes it hop (auto 'hop'), a fish leaps from the sea and the pelican gulps it mid-air (auto 'gulp'), gulls try to steal from the basket, a kite festival, a lighthouse keeper, a train racing alongside, fireworks over the amusement pier at night.
- PACING: an automatic, gentle cadence variation (sprint on the flat, coasting "wheee" on a downhill stretch, marked by signage and rider posture; don't tilt the road geometry), and an optional auto time-of-day cycle so the day passes during a long ride (UI toggle exists: ui:tod auto).
- A deterministic schedule (seeded, reproducible via renderAt), so screenshots at a given t are stable, plus window.__pb.director = {timeline, at(t)} for tests.
- Never block the rider, never fight user input (user actions take priority, and auto events back off for 10 s after user input). Respect reduced motion (no rain streaks; static fog).
Verify with a filmstrip of 16 frames across 0–300 s and event close-ups, Read them, and make sure there are zero console errors and the perf budget still holds.`, { label: 'journey:director', phase: 'Journey', schema: REPORT }),
])).filter(Boolean)
reports.push(...journey)

phase('Integrate')
const integ = await agent(`${COMMON.replaceAll('<your-id>', 'integrator')}

YOUR ROLE: integrator. You MAY edit any file, but keep edits minimal and respect each module's design. Builder reports (including contractRequests): ${JSON.stringify(reports)}
Also honour the new user requirements: ${USERREQ} Check that the route doesn't repeat within 4 minutes (render frames far apart) and that node tools/check-eggs.mjs passes.
Tasks:
1. Satisfy reasonable contractRequests, e.g. new pose fields consumed by the art, bake conventions, main.js wiring.
2. Make these all pass with zero console errors: node tools/check-rig.mjs, node tools/lint.mjs, node tools/build.mjs, node tools/shoot.mjs, and node tools/shoot.mjs --dist --set hero,frames,tods,cams,events,zoom,mobile --sheet.
3. node tools/detail-inventory.mjs must PASS on dist (G-DETAIL). If a layer is short, report exactly which owner is short and by how much; don't pad.
4. node tools/bake.mjs, then node tools/check-baked.mjs.
5. Check cross-module cohesion in the renders and fix it: the rider sits ON the road; inks and palette agree across layers at all 5 times of day; no gaps at the edges on camera moves or on the phone; the title never covers the rider.
6. node tools/shoot.mjs --dist --perf: fps ≥ 58 and JS p95 ≤ 2 ms; fix any violations.
Report what you changed.`, { label: 'integrate', phase: 'Integrate', schema: REPORT })

const OWNER_FILES = Object.fromEntries(BUILDERS.map(b => [b.id, b.files]))
OWNER_FILES.journey = 'src/world/route.js, src/world/land.js, src/world/sea.js'
OWNER_FILES.eggs = 'src/fx/eggs.js, tools/check-eggs.mjs, docs/EGGS.md'
OWNER_FILES.director = 'src/world/director.js, src/world/weather.js'
OWNER_FILES.lead = 'src/main.js, src/scene.js, src/core/{camera,svg,bus,math,bakekit}.js, src/page.css, src/index.dev.html, tools/{build,shoot,serve,lint,render,sheet,detail-inventory}.mjs, README.md'

const SCORE = {
  type: 'object',
  properties: {
    dim: { type: 'string' },
    score: { type: 'number', description: 'dimension score 0-10, weighted over its criteria' },
    criteria: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, score: { type: 'number' }, evidence: { type: 'string' } }, required: ['id', 'score', 'evidence'] } },
    gatesFailed: { type: 'array', items: { type: 'string' } },
    findings: { type: 'array', items: { type: 'object', properties: {
      owner: { type: 'string', description: 'rig | bike | pelican-body | pelican-limbs | sky | sea | land | fx | print | ui | audio | baker | journey | eggs | director | lead' },
      severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
      issue: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } },
      required: ['owner', 'severity', 'issue', 'fix'] } },
  },
  required: ['dim', 'score', 'criteria', 'findings'],
}
const GROUPS = [
  { id: 'J-canon', dims: 'D1 D2 D3 D4', focus: 'benchmark canon and instant readability, bicycle engineering, contact and riding physics, pelican species and anatomy' },
  { id: 'J-motion', dims: 'D5 D6 D8', focus: 'animation craft, character acting, wow moments, easter eggs (node tools/check-eggs.mjs, docs/EGGS.md), and the director\'s weather and encounters over time' },
  { id: 'J-art', dims: 'D7 D13', focus: 'art direction, style-C fidelity, light, camera, G-DETAIL (node tools/detail-inventory.mjs --json docs/eval/detail-inventory.json; spot-check 15 items for padding; compare 3× crops with the draft), and the long non-repeating route (renderAt t = 0, 30, 60, 120, 240 s)' },
  { id: 'J-product', dims: 'D9 D10 D11 D12', focus: 'interaction and accessibility (drive keys and UI with Playwright; desktop and 390px), performance (--perf), the zero-JS baked SVG (check-baked), and engineering rigour and honesty' },
]

phase('Review')
const judged = (await parallel(GROUPS.map(g => () => agent(`You are a fresh, strict, independent judge for "Pelican Bay" (an interactive SVG animation of a great white pelican riding a bicycle, in style C, the retro travel poster: see ${ROOT}/docs/STYLE-C.md and the draft reference ${REF}/keyframe.png). Project: ${ROOT}. Read CONTRACT.md for tools and ownership. ${USERREQ}
Your dimensions: ${g.dims}. Focus: ${g.focus}.
1. Print them: node ${ROOT}/tools/rubric.mjs ${g.dims} --anchors 5,8,10
2. Evidence: node ${ROOT}/tools/build.mjs && node ${ROOT}/tools/shoot.mjs --dist --out shots/${g.id} --set hero,frames,tods,cams,events,zoom,mobile --sheet, plus whatever your focus needs.
3. READ the images. Score each dimension (0-10) against the anchors, citing evidence. Be calibrated, not generous. Put the dimension scores in criteria[] (id = the dimension id), and the mean in score.
4. Give up to 12 actionable findings, most valuable first, each routed to one owner. Owner-to-file map: ${JSON.stringify(OWNER_FILES)}.
Work efficiently: this is a single review pass. Do NOT edit files except your shots folder (and docs/eval/detail-inventory.json for J-art).`, { label: `judge:${g.id}`, phase: 'Review', schema: SCORE })))).filter(Boolean)
log('scores: ' + judged.map(j => `${j.dim}=${j.score} [${(j.criteria||[]).map(c => c.id + ':' + c.score).join(' ')}]`).join(' | '))

phase('Fix')
const byOwner = {}
for (const j of judged) for (const f of j.findings) if (OWNER_FILES[f.owner]) (byOwner[f.owner] ||= []).push({ dim: j.dim, ...f })
const sev = f => f.severity === 'blocker' ? 3 : f.severity === 'major' ? 1 : 0
const owners = Object.keys(byOwner).filter(o => byOwner[o].some(f => sev(f) > 0)).sort((x, y) => byOwner[y].reduce((t, f) => t + sev(f), 0) - byOwner[x].reduce((t, f) => t + sev(f), 0)).slice(0, 6)
const leftovers = Object.keys(byOwner).filter(o => !owners.includes(o)).flatMap(o => byOwner[o].map(f => ({ owner: o, ...f })))
log(`fixing owners: ${owners.join(', ')}; leftovers to final: ${leftovers.length}`)
const fixes = (await parallel(owners.map(o => () => agent(`${COMMON.replaceAll('<your-id>', 'fix-' + o)}

YOUR ROLE: fixer for owner "${o}". FILES YOU OWN: ${OWNER_FILES[o]}
The judges' findings for your files, ranked by severity: ${JSON.stringify(byOwner[o].sort((a, b) => ['blocker', 'major', 'minor'].indexOf(a.severity) - ['blocker', 'major', 'minor'].indexOf(b.severity)))}
Fix every blocker and major, and the minors where they're cheap. If you disagree with a finding, say why in knownIssues. After fixing, rebuild (node tools/build.mjs), re-shoot and visually verify each fix, and make sure these still pass: the dev and --dist shoots exit 0, check-rig, lint, and detail-inventory (your layer must not lose items).`,
  { label: `fix:${o}`, phase: 'Fix', schema: REPORT })))).filter(Boolean)

phase('Verify')
const final = await agent(`${COMMON.replaceAll('<your-id>', 'final')}

YOUR ROLE: final fixer and gatekeeper. You MAY edit any file (keep changes surgical). ${USERREQ}
1. Fix these leftover findings that no fixer took (blockers and majors first; cheap minors too): ${JSON.stringify(leftovers)}
2. Run the complete gate set and fix whatever fails: check-rig, lint, build, shoot --dist (full sets, 0 errors), detail-inventory (PASS), bake + check-baked, check-eggs, --perf (fps ≥ 58).
3. Do a quick adversarial look at the final renders (feet on the pedals, limb seams at 3×, the title or UI covering the rider, edge gaps, repetition over 240 s) and fix anything blatant.
Report the final gate results.`, { label: 'verify:final', phase: 'Verify', schema: REPORT })
const hunt = null
return { reports: reports.map(r => ({ owner: r.owner, detail: r.detailCount, summary: r.summary, knownIssues: r.knownIssues })), integ, scores: judged.map(j => ({ group: j.dim, score: j.score, dims: j.criteria, gatesFailed: j.gatesFailed, top: j.findings.slice(0, 3) })), fixes: fixes.map(f => ({ owner: f.owner, summary: f.summary, knownIssues: f.knownIssues })), hunt, final }
