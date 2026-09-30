export const meta = {
  name: 'pelican-build-cyberpunk',
  description: 'Neon Pelican cyberpunk edition: concept keyframe, 13 builders redraw all art on the proven engine, neon lighting pass, integrate, 4 grouped judges, ≤6 fixers, final gatekeeper',
  phases: [
    { title: 'Concept', detail: 'one concept keyframe that sets the cyberpunk visual reference' },
    { title: 'Build', detail: '13 builders redraw every module in cyberpunk, with the same complexity as edition C' },
    { title: 'Neon', detail: 'dedicated neon lighting, glow and wet-reflection pass' },
    { title: 'Integrate', detail: 'wiring, 0 errors, detail gate, bake, 60 fps' },
    { title: 'Review', detail: '4 grouped judges across all 13 rubric dimensions' },
    { title: 'Fix', detail: '≤ 6 owners with blockers/majors' },
    { title: 'Verify', detail: 'final fixer + full gate run' },
  ],
}

const ROOT = '/home/user/experiments-and-tests/pelican-cyberpunk'
const REF = `${ROOT}/drafts/X-concept`
const SB = '/home/user/experiments-and-tests/pelican-storybook'
const CED = '/home/user/experiments-and-tests/pelican-bicycle'

const COMMON = `You are part of an elite team building the CYBERPUNK EDITION, "Neon Pelican", of "Pelican Bay" (鹈鹕湾): a self-contained HTML page with an interactive SVG animation of a great white pelican riding a bicycle along a seaside road. It will be judged as a showcase of the absolute limit of what AI can make.

CONTEXT: an earlier edition in style C (retro travel poster) is finished at ${CED}. DO NOT MODIFY ANYTHING UNDER ${CED} or ${SB} (a storybook edition is being built there at the same time); read them for reference only. This project (${ROOT}) is a FORK of it. The engine is proven and must keep working: the pure rig, the runtime and composited sheets (src/core/sheets.js), the route streaming (src/world/route.js), the director (weather, encounters, pacing), the eggs logic, the baker and all the tools. YOUR JOB: redraw the art of your module as a CYBERPUNK pelican riding through a CYBERPUNK CITY (the user's request), at the same (or higher) complexity and detail as edition C.

MANDATORY READING before you write code:
1. ${ROOT}/docs/STYLE-X.md (the style bible: the neon palette, city moods, the glow/performance rule, the cyber pelican, the bike, the city, the calm-wind rule, sound, the HUD). Obey it.
2. The concept keyframe: ${REF}/keyframe.png and ${REF}/closeup.png (Read both images), and its source ${REF}/gen.mjs. Match its look.
3. ${ROOT}/CONTRACT.md, ${ROOT}/docs/rig-spec.md, ${ROOT}/src/contract.js, and your module's CURRENT code (it is the style-C version: keep its structure, interfaces, data-refs, pose-field usage, streaming and pooling, and change the look).
4. Edition C screenshots for complexity reference: node ${ROOT}/tools/render.mjs isn't needed; just Read ${CED}/shots/final/sheet.png and ${CED}/shots/final/cam-close.png.
5. The rubric for your role: node ${ROOT}/tools/rubric.mjs <dims>. Aim for the 10-point anchors (read "style C" in anchors as "the cyberpunk style / STYLE-X.md").

REQUIREMENTS THE USER GAVE DURING EDITION C, which apply from the start:
- the background must be long and must not repeat quickly (keep the ≥ 4-minute route);
- there must be little easter eggs;
- there must be interesting variation over time (weather and encounters);
- FAR more detail than the draft;
- the wind must be CALM (the user found C's wind curls fast, numerous and noisy: one wind language, slow, sparse);
- 60 fps.

PERFORMANCE RULE (critical): filters are allowed ONLY on far or static content that sits on its own sheet and only translates. NO filters on rider slots, rotating parts, or per-frame-changing or frequently recycled elements. Bake the hand-drawn wobble, double lines and dry-brush edges into geometry (seeded jitter), and use static <pattern> textures in local coordinates.

DETAIL GATE (G-DETAIL for this edition): ≥ edition C's final count per layer (pelican 80, bike 90, sea 50, land 75, sky 34, fx 20, typography_frame 25, total 392). Keep the data-detail="<layer>:<O|T>:<name>" tags on every distinct item and export detailItems. Check with node ${ROOT}/tools/detail-inventory.mjs --dev. Detail must be real and legible at 1× and 3× (shoot --set zoom). No padding.

RULES:
- Only edit the files you own (listed below). You MAY read any file. Never run npm install and never git commit. Never touch ${CED}.
- Self-check visually and often: node ${ROOT}/tools/shoot.mjs --out shots/<your-id> --set hero,frames,tods,cams,events,zoom,mobile --sheet, then Read the PNGs: sheet.png plus several full-size frames and zoom crops. Do at least 4 visual iterations. shoot.mjs must exit 0 (zero console errors).
- Also run node ${ROOT}/tools/lint.mjs and node ${ROOT}/tools/check-rig.mjs, and at the end node ${ROOT}/tools/shoot.mjs --perf (fps ≥ 58).
- Other builders work in parallel on other files, so the scene will temporarily mix style C and cyberpunk art; ignore that. A second workflow (the storybook edition) may be using CPU at the same time, so if --perf is borderline, re-measure.
Return the structured report.`

const REPORT = {
  type: 'object',
  properties: {
    owner: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' },
    detailCount: { type: 'number' }, features: { type: 'array', items: { type: 'string' } },
    contractRequests: { type: 'array', items: { type: 'string' } }, knownIssues: { type: 'array', items: { type: 'string' } }, perf: { type: 'string' },
  },
  required: ['owner', 'files', 'summary'],
}

const BUILDERS = [
  { id: 'pelican-body', dims: 'D1 D4 D6 D7 D13', files: 'src/art/pelican-body.js', quota: 'pelican layer ≥ 50 of the 80 (with limbs)', brief: 'Redraw neck, tail, body, pouch, bills, head, eye and crest as the CYBERPUNK PELICAN (STYLE-X §3): still unmistakably a great white pelican, with a cyan HUD visor (eye visible), a techwear bomber jacket with magenta piping and 鹈鹕 / PELICAN patches, a chrome nail, a glowing circuit tattoo on the pouch, an earpiece antenna, and the LED scarf using the rig scarf pose. Dual-colour neon rim light (magenta and cyan) done with stacked strokes and gradients, NO filters. A cool, confident expression. Keep every rig pose field in use.' },
  { id: 'pelican-limbs', dims: 'D3 D4 D13', files: 'src/art/pelican-limbs.js', quota: 'pelican layer ≥ 30', brief: 'Redraw the legs and wings (Near and Far): wing feathers emerging from the jacket sleeves, reading as wings (covert base, secondaries fringe, ≥ 4 separate curled primary tips at the grip), with neon rim light; legs with techwear knee wraps over feathered trousers, an orange tarsus with scales, totipalmate feet in sneaker-style wraps with the webbing visible, flat on the pedals. The far side is darker and less lit. No seams at 3× in any of the 24 frames or the wave.' },
  { id: 'bike', dims: 'D1 D2 D13', files: 'src/art/bike.js', quota: 'bike layer ≥ 90', brief: 'Redraw the bike as a cyber fixie or city bike (STYLE-X §4): a matte-black carbon frame, a magenta underglow, a cyan LED strip, glowing rims with spoke light trails at speed (the spoke-blur logic), a chrome chain, a holographic speedo above the stem, a laser headlight, and a delivery box "鹈鹕外卖 PELICAN EXPRESS" with glowing fish. Keep ALL of edition C\'s mechanical detail and correctness. Glow comes from stacked strokes and gradients, NO filters on moving parts.' },
  { id: 'sky', dims: 'D7 D13', files: 'src/world/sky.js, src/core/palette.js', quota: 'sky layer ≥ 34', brief: 'Rewrite the palette as cyberpunk city-mood keyframes on tod (STYLE-X §1: smog dawn, overcast noon, neon dusk = the hero, acid-magenta night, deep night; neon tokens are emissive). Redraw the sky: layered smog gradients, a huge far megastructure silhouette, searchlight beams, a blimp with a hologram ad, flying-car traffic lanes (streams of tiny lights, calm and slow), a moon through the smog, rare stars, lightning flashes. Glow filters only on the static sky sheet.' },
  { id: 'sea', dims: 'D7 D13', files: 'src/world/sea.js', quota: 'sea layer ≥ 50', brief: 'Redraw the far layers as the MEGACITY SKYLINE + HARBOUR: several depth layers of towers with thousands of lit windows (static merged paths), rooftop signs and holograms, the data-spire beacon (the ex-lighthouse) with a sweeping beam, megastructure cranes with warning lights, the dark harbour water with long neon reflections and hover-boats, a floating dock with drones. Bloom filters only on static far sheets. Keep the parallax and streaming logic.' },
  { id: 'land', dims: 'D1 D7 D13', files: 'src/world/land.js', quota: 'land layer ≥ 75', brief: 'Redraw every route stretch as the cyberpunk street level (STYLE-X §5): the neon district with noodle stalls and steam, lanterns, vending machines, the neon fish market with hologram fish, the arcade with a giant hologram koi, the maglev train on an elevated track (replaces the steam train), the skybridge, the old temple, the hydroponic garden, a neon tunnel, and holo-marker kilometre stones. Signs in Chinese + English (a little katakana) as paths, witty (鱼丸 FISHBALL, 义体诊所 CYBER CLINIC, 禁止鹈鹕 NO PELICANS). Life: umbrella people, a robot cat, delivery drones, steam vents, cables. The road is wet asphalt with neon reflections, puddles and markings. Keep the route.js stretches and pooled streaming, ≥ 4 min without repetition, and extend art ±400 u.' },
  { id: 'fx', dims: 'D5 D8 D13', files: 'src/fx/fx.js', quota: 'fx layer ≥ 20', brief: 'Redraw the effects: a neon contact shadow and a wet reflection of the rider under the bike, spray from the tyres on the wet road, drones escorting at high cadence (replacing gulls), neon light trails as speed lines (only > 86 rpm, sparse), event pops as glitchy HUD words (DING! HOP! GULP!) with scan lines, sparks, holographic fish bones after a gulp, and a laser headlight cone. WIND: calm rules from edition C (at most one slow data-stream, rare). Pooled, deterministic, no filters on moving things.' },
  { id: 'weather', dims: 'D7 D8', files: 'src/world/weather.js', quota: 'counts toward fx/sky/land', brief: 'Redraw the weather for the city: light rain most of the time (pooled neon-lit streaks, puddle ripples with reflections), a heavy downpour stretch, smog fog banks that slide, lightning over the towers, a rare clear moment, and instead of a rainbow a huge hologram aurora ad. Keep the director hooks (frame.weather), calm wind, and reduced motion.' },
  { id: 'print', dims: 'D7 D8 D13', files: 'src/world/print.js, src/world/print-glyphs.js, src/world/print-glyphs.gen.mjs, src/world/director-glyphs.js, src/world/director-glyphs.gen.mjs', quota: 'typography_frame ≥ 25', brief: 'Replace the poster furniture with a CYBERPUNK HUD FRAME (STYLE-X §8): thin cyan/magenta corner brackets, a static scanline texture, a glitch-lettered "NEON PELICAN" + 鹈鹕湾 title that shrinks into a corner HUD after the intro, a per-stretch mission caption ("DELIVERY 03 · 灯塔角 / DATA SPIRE"), a minimap strip, a signal-strength and battery readout, a timestamp, and a rare brief glitch transition. Regenerate the glyph paths with DejaVu Sans, Sans Mono and Sans Bold plus WenQuanYi via tools/ttf.mjs. Never cover the rider; the letterbox becomes a HUD bar.' },
  { id: 'eggs', dims: 'D8', files: 'src/fx/eggs.js, src/fx/egg-glyphs.js, src/fx/egg-glyphs.gen.mjs, tools/check-eggs.mjs, docs/EGGS.md', quota: 'none', brief: 'Keep all 13 eggs working (check-eggs must pass) and re-theme their visuals as cyberpunk. Add ≥ 2 cyber eggs, e.g. typing "hack" glitches the whole city into wireframe for 3 s; the "禁止鹈鹕 NO PELICANS" sign flickers to "欢迎鹈鹕 PELICANS WELCOME" when you ring the bell next to it; the Konami code gives the pelican a golden chrome suit. Update docs/EGGS.md.' },
  { id: 'ui', dims: 'D9 D8', files: 'src/ui/ui.js, src/ui/styles.js', quota: 'none', brief: 'Restyle the control card, HUD, help and bottom sheet as a translucent cyberpunk HUD panel (thin neon lines, a monospace plus a bold display face as system fonts, glowing active states), keeping every control, key, aria attribute, the mobile bottom sheet (≥ 44 px targets) and the rider avoidance. Add a music toggle (coordinate with audio via the bus). Keep the contrast accessible.' },
  { id: 'audio', dims: 'D8 D9', files: 'src/audio/audio.js', quota: 'none', brief: 'Synthesize (no files) (1) MUSIC: a synthwave/darksynth track (a pulsing bass arpeggio, gated pads, a gated snare and kick, a lead melody) with a real composed progression, 16–32 bars with variations. The tempo follows cadence (quantised), the mood follows weather and district, and it ducks under events. (2) City ambience: rain, distant sirens, neon hum, the maglev whoosh, drone buzz. (3) A pelican voice: vocoder-ish hmm, HUD bleeps, gulp. Re-voice the bell as a cyber chime. Lookahead scheduler, suspend when hidden, a master limiter. Verify with Playwright (enable plus events give zero errors) and an OfflineAudioContext render with non-trivial RMS. Write docs/AUDIO.md.' },
  { id: 'rig', dims: 'D5 D6', files: 'src/rig/solve.js, src/rig/secondary.js, tools/check-rig.mjs', quota: 'none', brief: 'Light tuning only: a cooler, smoother cruising feel (a slightly more relaxed lean, a subtle head nod to the beat, a smooth gaze with occasional HUD-scan glances). Keep everything physically plausible and check-rig passing. Report any pose-field changes.' },
]

phase('Concept')
const concept = await agent(`You are the concept artist for "Neon Pelican", the cyberpunk edition of Pelican Bay: a great white pelican riding a bicycle through a cyberpunk city. Read ${ROOT}/docs/STYLE-X.md (the style bible), ${ROOT}/docs/rig-spec.md (geometry) and ${ROOT}/src/contract.js. Look at the finished edition C for complexity: Read /home/user/experiments-and-tests/pelican-bicycle/shots/final/cam-close.png.
Draw ONE stunning static concept keyframe as a hand-authored SVG, generated with a node script: write ${REF}/gen.mjs, which outputs ${REF}/keyframe.svg (viewBox 0 0 1600 900, at the neon-dusk hero mood).
- Follow the rig geometry exactly: the rider in <g transform="translate(680 790)">, the bike and pelican pose at crank phi = 0 as in rig-spec (hubs, bottom bracket, saddle, grips; 2-bone IK legs with the feet on the pedals; wings on the grips). Put the far limbs behind the frame.
- Show the full vision: the cyber pelican (visor, jacket, LED scarf, chrome nail), the cyber bike (underglow, glowing rims, delivery box), the wet street with neon reflections, the district props, a mid-layer of towers full of signs in Chinese and English, the far skyline, haze, searchlights, rain, a maglev in the distance, drones, and the HUD frame.
Render it: node ${ROOT}/tools/render.mjs ${REF}/keyframe.svg ${REF}/keyframe.png 1600 900. Also make a close-up copy with viewBox "440 220 560 580" rendered to closeup.png at 1120x1160. READ the PNGs and iterate at least 5 times until it looks like a frame from a top-tier cyberpunk animated film, while the pelican and bike stay perfectly readable. Only write inside ${REF}/. Return a short summary of the palette and techniques.`, { label: 'concept:keyframe', phase: 'Concept' })

phase('Build')
const reports = (await parallel(BUILDERS.map(b => () =>
  agent(`${COMMON.replaceAll('<your-id>', b.id)}

YOUR ROLE: ${b.id}
FILES YOU OWN: ${b.files}
RUBRIC DIMENSIONS: ${b.dims} (node tools/rubric.mjs ${b.dims})
DETAIL QUOTA: ${b.quota}
BRIEF: ${b.brief}`, { label: `build:${b.id}`, phase: 'Build', schema: REPORT })))).filter(Boolean)
log(`builders done: ${reports.map(r => `${r.owner}(${r.detailCount ?? '-'})`).join(' ')}`)

phase('Neon')
const gouache = await agent(`${COMMON.replaceAll('<your-id>', 'neon')}

YOUR ROLE: NEON LIGHTING DIRECTOR. The builders redrew the shapes. Now make the whole frame LUMINOUS and cinematic like the concept (Read ${REF}/keyframe.png and compare it side by side with the current shots): dual-colour rim light on the rider and bike, wet-road reflections of every neon source (a mirrored, blurred and streaked copy on a static or slow sheet), volumetric haze bands between the city layers, light cones from signs and searchlights, bloom on the far signs (filters on static sheets only), subtle neon flicker (opacity only, a few elements), and a colour grade so nothing looks flat or daylight-ish.
You MAY edit any art/world/fx file and src/page.css, and add a shared helper src/art/neon.js (stacked-stroke glow helpers and static bloom defs). Keep every data-ref, data-detail, slot and interface intact.
Verify: hero, close-up, zoom and all 5 moods; iterate at least 5 times. Then --perf (fps ≥ 58; if not, move the glow to static sheets or bake it), shoot --dist with 0 errors, and detail-inventory still PASS.`, { label: 'neon:lighting', phase: 'Neon', schema: REPORT })
reports.push(gouache)

phase('Integrate')
const integ = await agent(`${COMMON.replaceAll('<your-id>', 'integrator')}

YOUR ROLE: integrator. You MAY edit any file in ${ROOT} (keep edits minimal). Builder reports: ${JSON.stringify(reports)}
Tasks:
1. Satisfy the reasonable contractRequests.
2. Remove any remaining style-C look: grep for halftone, deco, poster, ticket or stamp leftovers, and check every screenshot.
3. These must all pass with 0 console errors: check-rig, lint, build, shoot (dev) and shoot --dist --set hero,frames,tods,cams,events,zoom,mobile --sheet.
4. detail-inventory must PASS on dist.
5. bake, then check-baked.
6. check-eggs.
7. Cohesion across modules: one consistent neon-cyberpunk look, the rider sits on the road, all 5 times of day match, no edge gaps, the page furniture never covers the rider, and the wind stays calm (render t = 36 and 42 s).
8. The route must not repeat within 240 s (render frames far apart).
9. --perf must reach fps ≥ 58. If filters cost frames, move them to static sheets or bake them.
Report what you changed.`, { label: 'integrate', phase: 'Integrate', schema: REPORT })

const OWNER_FILES = Object.fromEntries(BUILDERS.map(b => [b.id, b.files]))
OWNER_FILES.lead = 'src/main.js, src/scene.js, src/core/{camera,svg,bus,math,bakekit,sheets}.js, src/page.css, src/index.dev.html, src/bake/bake.js, tools/*.mjs, README.md'
const SCORE = {
  type: 'object',
  properties: {
    dim: { type: 'string' }, score: { type: 'number' },
    criteria: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, score: { type: 'number' }, evidence: { type: 'string' } }, required: ['id', 'score', 'evidence'] } },
    gatesFailed: { type: 'array', items: { type: 'string' } },
    findings: { type: 'array', items: { type: 'object', properties: {
      owner: { type: 'string', description: Object.keys(OWNER_FILES).join(' | ') },
      severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, issue: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } },
      required: ['owner', 'severity', 'issue', 'fix'] } },
  },
  required: ['dim', 'score', 'criteria', 'findings'],
}
const GROUPS = [
  { id: 'J-canon', dims: 'D1 D2 D3 D4', focus: 'benchmark canon, bike engineering, contact and physics, pelican species and anatomy (it must still read instantly as a great white pelican under the cyber costume)' },
  { id: 'J-motion', dims: 'D5 D6 D8', focus: 'animation, acting, wow moments, eggs (node tools/check-eggs.mjs), MUSIC and PELICAN VOICE (read src/audio/audio.js and docs/AUDIO.md; run an OfflineAudioContext render if feasible), the director over time, and calm wind' },
  { id: 'J-art', dims: 'D7 D13', focus: 'cyberpunk fidelity (docs/STYLE-X.md vs drafts/X-concept: is it a dense, luminous, cinematic neon megacity?), lighting and the HUD frame, detail (detail-inventory; spot-check 15 items for padding; 3× crops), the long route (renderAt t = 0, 30, 60, 120, 240 s), and compare with edition C for "same complexity" (Read /home/user/experiments-and-tests/pelican-bicycle/shots/final/sheet.png)' },
  { id: 'J-product', dims: 'D9 D10 D11 D12', focus: 'interaction and accessibility (drive keys and UI with Playwright; desktop and 390px), perf (--perf ≥ 58 fps), the baked SVG (check-baked), and engineering' },
]
phase('Review')
const judged = (await parallel(GROUPS.map(g => () => agent(`You are a fresh, strict, independent judge for the CYBERPUNK EDITION "Neon Pelican" of "Pelican Bay" (see ${ROOT}/docs/STYLE-X.md and the concept ${REF}/keyframe.png). Project: ${ROOT}. Read CONTRACT.md. Your dimensions: ${g.dims}. Focus: ${g.focus}.
1. node ${ROOT}/tools/rubric.mjs ${g.dims} --anchors 5,8,10 (read "style C" as "the cyberpunk style").
2. node ${ROOT}/tools/build.mjs && node ${ROOT}/tools/shoot.mjs --dist --out shots/${g.id} --set hero,frames,tods,cams,events,zoom,mobile --sheet, plus whatever your focus needs.
3. READ the images. Score each dimension (0-10) against the anchors with evidence, calibrated rather than generous. Put the dimension scores in criteria[] (id = the dimension id) and the mean in score, and set dim = "${g.id}".
4. Up to 12 actionable findings, each routed to one owner. Owner-to-file map: ${JSON.stringify(OWNER_FILES)}.
Do NOT edit files except your shots folder. Don't touch /home/user/experiments-and-tests/pelican-bicycle or pelican-storybook.`, { label: `judge:${g.id}`, phase: 'Review', schema: SCORE })))).filter(Boolean)
log('scores: ' + judged.map(j => `${j.dim}=${j.score} [${(j.criteria || []).map(c => c.id + ':' + c.score).join(' ')}]`).join(' | '))

phase('Fix')
const byOwner = {}
for (const j of judged) for (const f of j.findings) if (OWNER_FILES[f.owner]) (byOwner[f.owner] ||= []).push({ dim: j.dim, ...f })
const sev = f => f.severity === 'blocker' ? 3 : f.severity === 'major' ? 1 : 0
const owners = Object.keys(byOwner).filter(o => byOwner[o].some(f => sev(f) > 0)).sort((x, y) => byOwner[y].reduce((t, f) => t + sev(f), 0) - byOwner[x].reduce((t, f) => t + sev(f), 0)).slice(0, 6)
const leftovers = Object.keys(byOwner).filter(o => !owners.includes(o)).flatMap(o => byOwner[o].map(f => ({ owner: o, ...f })))
log(`fixing owners: ${owners.join(', ')}; leftovers to final: ${leftovers.length}`)
const fixes = (await parallel(owners.map(o => () => agent(`${COMMON.replaceAll('<your-id>', 'fix-' + o)}

YOUR ROLE: fixer for owner "${o}". FILES YOU OWN: ${OWNER_FILES[o]}
Findings (blockers first): ${JSON.stringify(byOwner[o].sort((a, b) => sev(b) - sev(a)))}
Fix every blocker and major, and cheap minors. Then rebuild, re-shoot and verify visually, and keep every gate passing (shoot dev and --dist exit 0, check-rig, lint, detail-inventory, check-eggs).`, { label: `fix:${o}`, phase: 'Fix', schema: REPORT })))).filter(Boolean)

phase('Verify')
const final = await agent(`${COMMON.replaceAll('<your-id>', 'final')}

YOUR ROLE: final fixer and gatekeeper. You MAY edit any file in ${ROOT} (surgical changes).
1. Fix these leftover findings: ${JSON.stringify(leftovers)}
2. Run the full gate set and fix whatever fails: check-rig, lint, build, shoot --dist (full, 0 errors), detail-inventory PASS, bake + check-baked, check-eggs, --perf fps ≥ 58.
3. Take a quick adversarial look (feet on the pedals, limb seams at 3×, page furniture over the rider, edge gaps, repetition over 240 s, calm wind, any leftover style-C look or daylight look) and fix anything blatant.
Report the final gate results.`, { label: 'verify:final', phase: 'Verify', schema: REPORT })

return { reports: reports.map(r => ({ owner: r.owner, detail: r.detailCount, summary: r.summary, knownIssues: r.knownIssues })), integ, scores: judged.map(j => ({ group: j.dim, score: j.score, dims: j.criteria, gatesFailed: j.gatesFailed, top: j.findings.slice(0, 3) })), fixes: fixes.map(f => ({ owner: f.owner, summary: f.summary, knownIssues: f.knownIssues })), final }
