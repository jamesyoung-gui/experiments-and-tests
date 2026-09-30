export const meta = {
  name: 'pelican-build-storybook',
  description: 'Pelican Bay storybook edition (style B, warm gouache): 13 builders redraw all art on the proven engine, integrate, 4 grouped judges, ≤6 fixers, final gatekeeper',
  phases: [
    { title: 'Build', detail: '13 builders redraw every module in style B, with the same complexity as edition C' },
    { title: 'Integrate', detail: 'wiring, 0 errors, detail gate, bake, 60 fps' },
    { title: 'Review', detail: '4 grouped judges across all 13 rubric dimensions' },
    { title: 'Fix', detail: '≤ 6 owners with blockers/majors' },
    { title: 'Verify', detail: 'final fixer + full gate run' },
  ],
}

const ROOT = '/home/user/experiments-and-tests/pelican-storybook'
const REF = `${ROOT}/drafts/B-storybook`
const CED = '/home/user/experiments-and-tests/pelican-bicycle'

const COMMON = `You are part of an elite team building the STORYBOOK EDITION of "Pelican Bay" (鹈鹕湾): a self-contained HTML page with an interactive SVG animation of a great white pelican riding a bicycle along a seaside road. It will be judged as a showcase of the absolute limit of what AI can make.

CONTEXT: an earlier edition in style C (retro travel poster) is finished at ${CED}. DO NOT MODIFY ANYTHING UNDER ${CED}; read it for reference only. This project (${ROOT}) is a FORK of it. The engine is proven and must keep working: the pure rig, the runtime and composited sheets (src/core/sheets.js), the route streaming (src/world/route.js), the director (weather, encounters, pacing), the eggs logic, the baker and all the tools. YOUR JOB: redraw the art of your module in STYLE B, the WARM STORYBOOK GOUACHE the user chose, at the same (or higher) complexity and detail as edition C.

MANDATORY READING before you write code:
1. ${ROOT}/docs/STYLE-B.md (the style bible: palette, the texture/performance rule, character fixes, the page, the world, the calm-wind rule, sound). Obey it.
2. The reference draft: ${REF}/keyframe.png and ${REF}/closeup.png (Read both images), and the source ${REF}/gen.mjs. Mine its helpers (cr, puff, the filter set, the palette).
3. ${ROOT}/CONTRACT.md, ${ROOT}/docs/rig-spec.md, ${ROOT}/src/contract.js, and your module's CURRENT code (it is the style-C version: keep its structure, interfaces, data-refs, pose-field usage, streaming and pooling, and change the look).
4. Edition C screenshots for complexity reference: node ${ROOT}/tools/render.mjs isn't needed; just Read ${CED}/shots/final/sheet.png and ${CED}/shots/final/cam-close.png.
5. The rubric for your role: node ${ROOT}/tools/rubric.mjs <dims>. Aim for the 10-point anchors (read "style C" in anchors as "style B / STYLE-B.md").

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
- Other builders work in parallel on other files, so the scene will temporarily mix style C and style B art; ignore that.
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
  { id: 'pelican-body', dims: 'D1 D4 D6 D7 D13', files: 'src/art/pelican-body.js', quota: 'pelican layer ≥ 50 of the 80 (with limbs)', brief: 'Redraw neck, tail, body, pouch, bills, head, eye and crest, plus the knitted scarf, in storybook gouache (STYLE-B §3). Fix draft B\'s goose-like egg body: a deep chest and long back, the pelican silhouette. Warm-white plumage with rose-grey shading and painted scallop feathers; wobbly warm-brown outlines baked into the geometry; a kind, happy face with a blush; a pouch with texture; the gape behind the eye. Keep every rig pose field in use (face, gaze, scarf, neck bulge, fish, bill, crestBend).' },
  { id: 'pelican-limbs', dims: 'D3 D4 D13', files: 'src/art/pelican-limbs.js', quota: 'pelican layer ≥ 30', brief: 'Redraw legs and wings (Near and Far) in gouache. Wings must read as wings: a covert base, a secondaries fringe, primaries that sweep back and that at the grip are ≥ 4 separate curled feather tips, NOT a clump or brush (a draft-B defect). Legs: feathered trousers, an orange tarsus with painted scale rings, totipalmate feet flat on the pedals. The far side gets cooler, darker glazes. No seams at 3× in any of the 24 frames or the wave.' },
  { id: 'bike', dims: 'D1 D2 D13', files: 'src/art/bike.js', quota: 'bike layer ≥ 90', brief: 'Redraw the whole bike as a painted storybook bicycle (teal frame, cream fenders, a brown sprung saddle, a wicker basket full of fish with painted scales), keeping ALL the mechanical detail and correctness of edition C (lugs, cables, chainring teeth, chain plates and pins, 32 spokes with nipples, valve, reflectors, rack with a towel, bell, lamp, kickstand, plate, bottle). Wobbly hand-drawn outlines baked into the geometry; NO filters on moving parts. The decal must sit ON the down tube (a draft-B defect). Keep the spoke-blur rules and the chain dashoffset.' },
  { id: 'sky', dims: 'D7 D13', files: 'src/world/sky.js, src/core/palette.js', quota: 'sky layer ≥ 34', brief: 'Rewrite the palette as warm gouache time-of-day keyframes (STYLE-B §1; night = a bedtime-story night), and redraw the sky: soft painted gradients with a static filter mottling allowed on the sky sheet; a sun with a watercolour glow; a big gentle moon; stars as painted crosses with a few twinkles; puffy painted clouds (use puff() from the draft) with soft edges; the airship and biplane redrawn as storybook toys; bird flocks. Remove any C-style halftone and deco rays, and keep the CALM-wind rule (clouds drift slowly).' },
  { id: 'sea', dims: 'D7 D13', files: 'src/world/sea.js', quota: 'sea layer ≥ 50', brief: 'Redraw every sea element in gouache: soft layered sea bands with painted wave strokes, the glitter path, the lighthouse and keeper cottage, the harbour town, windmill, pier, boats with rigging, steamer, buoys, a whale or dolphin and jumping fish. Soft-edged far layers may use static filters on their own sheets. Keep all the parallax and streaming logic.' },
  { id: 'land', dims: 'D1 D7 D13', files: 'src/world/land.js', quota: 'land layer ≥ 75', brief: 'Redraw every route stretch\'s props in storybook gouache (STYLE-B §5): the village, beach huts, fish market, pier anglers, harbour cranes, headland, cliffs and tunnel, the amusement pier Ferris wheel, steam train, bridge, fort, pine grove, dunes, palms, kilometre stones, signposts in hand-lettered serif paths, the road with a painted texture, and foreground flowers and grass. ADD storybook life: a crab family, a snail, a hedgehog, kite kids, laundry lines, cats in windows, a postman, an ice-cream cart. Keep the route.js stretches and the pooled streaming (no DOM churn), ≥ 4 minutes without repetition, and extend art ±400 u.' },
  { id: 'fx', dims: 'D5 D8 D13', files: 'src/fx/fx.js', quota: 'fx layer ≥ 20', brief: 'Redraw effects as painted storybook marks: soft dust puffs, a painted contact shadow, gulls, butterflies, fireflies, drifting feathers, a headlamp glow, event pops as hand-lettered words (Ding! Hop! Gulp!) with little stars and hearts. WIND: keep edition C\'s calm rules (the user complained about noisy curls): at most one soft breeze swirl, only above 75 rpm, rare, slow; speed lines only above 86 rpm and sparse.' },
  { id: 'weather', dims: 'D7 D8', files: 'src/world/weather.js', quota: 'counts toward fx/sky/land', brief: 'Redraw the weather in watercolour: soft painted rain streaks and round splashes, puddles with ripples, a watercolour rainbow (static soft filter OK), gouache fog veils that slide, dark painted rain clouds, and the calm wind band (one slow set of soft painted breeze swirls in the upper sky plus a few leaves; STYLE-B §6). Keep the director hooks (frame.weather) and reduced motion.' },
  { id: 'print', dims: 'D7 D8 D13', files: 'src/world/print.js, src/world/print-glyphs.js, src/world/print-glyphs.gen.mjs, src/world/director-glyphs.js, src/world/director-glyphs.gen.mjs', quota: 'typography_frame ≥ 25', brief: 'Replace the poster furniture with the PICTURE-BOOK SPREAD (STYLE-B §4): a cream page margin with a soft gutter shadow, page numbers, deckled or torn edges, a hand-lettered serif title "Pelican Bay" + 鹈鹕湾 that shrinks to a corner after the intro, and a story caption line that changes per route stretch (read src/world/route.js stretches; bilingual picture-book sentences), little spot illustrations in the margins (a shell, a fish bone, a star), a bookmark ribbon, a "Chapter 1" plate. Regenerate glyph path data with DejaVu Serif and WenQuanYi via tools/ttf.mjs. Never cover the rider. The cinematic letterbox becomes the book edges.' },
  { id: 'eggs', dims: 'D8', files: 'src/fx/eggs.js, src/fx/egg-glyphs.js, src/fx/egg-glyphs.gen.mjs, tools/check-eggs.mjs, docs/EGGS.md', quota: 'none', brief: 'Keep all 13 eggs working (tools/check-eggs.mjs must pass) and redraw their visuals in the storybook style. Add ≥ 2 storybook-specific eggs, e.g. clicking the page corner turns the page to the next time of day with a page-curl; a "the end" page at 42 km; a bedtime moment where the pelican yawns at night after 30 s of coasting. Update docs/EGGS.md.' },
  { id: 'ui', dims: 'D9 D8', files: 'src/ui/ui.js, src/ui/styles.js', quota: 'none', brief: 'Restyle the control card, HUD, help and bottom sheet as a picture-book object (a paper card with a deckled edge, hand-lettered serif labels, warm inks, a small bookmark tab), keeping every control, key, aria attribute, the mobile bottom sheet (touch targets ≥ 44 px) and the rider-avoidance logic. Add a music toggle next to sound (ui:toggle key music, or extend ui:sound, coordinating with audio via the bus).' },
  { id: 'audio', dims: 'D8 D9', files: 'src/audio/audio.js', quota: 'none', brief: 'NEW, requested by the user: in addition to the existing effects (re-voice them softer), synthesize (no files) (1) MUSIC: a warm acoustic bedtime-story tune (plucked ukulele or guitar voices from Karplus-Strong or filtered saw, soft glockenspiel, upright bass, brushed percussion). Write a real composed melody plus chord progression, 16–32 bars with variations, not random notes. The tempo follows cadence (quantised to musical steps, smooth changes), the arrangement varies with weather and time of day (lullaby at night, fuller in sun, rain = softer and minor-tinged), and it ducks under events. (2) A PELICAN VOICE: soft cartoon grunts (formant-filtered), a hum while coasting, "hup!" on hop, a satisfied gulp plus a small burp after feeding, a little honk on wave. Use a lookahead scheduler; suspend when the tab is hidden; keep a master limiter. Verify with Playwright: enable, trigger events, zero errors; and an OfflineAudioContext render of 10 s of music with non-trivial RMS. Write docs/AUDIO.md describing the score.' },
  { id: 'rig', dims: 'D5 D6', files: 'src/rig/solve.js, src/rig/secondary.js, tools/check-rig.mjs', quota: 'none', brief: 'Light tuning only: keep everything that passes. Give the motion a slightly rounder, bouncier picture-book feel (e.g. a gentle extra bob on the downstroke, a softer head bob, a happy little head tilt in the gaze system, the scarf more floaty) while keeping it physically plausible. check-rig must pass. Report any pose-field changes.' },
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
7. Cohesion across modules: one consistent gouache look, the rider sits on the road, all 5 times of day match, no edge gaps, the page furniture never covers the rider, and the wind stays calm (render t = 36 and 42 s).
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
  { id: 'J-canon', dims: 'D1 D2 D3 D4', focus: 'benchmark canon, bike engineering, contact and physics, pelican species and anatomy (the draft-B defects: goose body, a clump of primaries, the floating decal)' },
  { id: 'J-motion', dims: 'D5 D6 D8', focus: 'animation, acting, wow moments, eggs (node tools/check-eggs.mjs), MUSIC and PELICAN VOICE (read src/audio/audio.js and docs/AUDIO.md; run an OfflineAudioContext render if feasible), the director over time, and calm wind' },
  { id: 'J-art', dims: 'D7 D13', focus: 'style-B fidelity (docs/STYLE-B.md vs drafts/B-storybook), light and the picture-book page, detail (detail-inventory; spot-check 15 items for padding; 3× crops), the long route (renderAt t = 0, 30, 60, 120, 240 s), and compare with edition C for "same complexity" (Read /home/user/experiments-and-tests/pelican-bicycle/shots/final/sheet.png)' },
  { id: 'J-product', dims: 'D9 D10 D11 D12', focus: 'interaction and accessibility (drive keys and UI with Playwright; desktop and 390px), perf (--perf ≥ 58 fps), the baked SVG (check-baked), and engineering' },
]
phase('Review')
const judged = (await parallel(GROUPS.map(g => () => agent(`You are a fresh, strict, independent judge for the STORYBOOK EDITION of "Pelican Bay" (style B, warm gouache: see ${ROOT}/docs/STYLE-B.md and the draft ${REF}/keyframe.png). Project: ${ROOT}. Read CONTRACT.md. Your dimensions: ${g.dims}. Focus: ${g.focus}.
1. node ${ROOT}/tools/rubric.mjs ${g.dims} --anchors 5,8,10 (read "style C" as "style B").
2. node ${ROOT}/tools/build.mjs && node ${ROOT}/tools/shoot.mjs --dist --out shots/${g.id} --set hero,frames,tods,cams,events,zoom,mobile --sheet, plus whatever your focus needs.
3. READ the images. Score each dimension (0-10) against the anchors with evidence, calibrated rather than generous. Put the dimension scores in criteria[] (id = the dimension id) and the mean in score, and set dim = "${g.id}".
4. Up to 12 actionable findings, each routed to one owner. Owner-to-file map: ${JSON.stringify(OWNER_FILES)}.
Do NOT edit files except your shots folder. Don't touch /home/user/experiments-and-tests/pelican-bicycle.`, { label: `judge:${g.id}`, phase: 'Review', schema: SCORE })))).filter(Boolean)
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
3. Take a quick adversarial look (feet on the pedals, limb seams at 3×, page furniture over the rider, edge gaps, repetition over 240 s, calm wind, any leftover style-C look) and fix anything blatant.
Report the final gate results.`, { label: 'verify:final', phase: 'Verify', schema: REPORT })

return { reports: reports.map(r => ({ owner: r.owner, detail: r.detailCount, summary: r.summary, knownIssues: r.knownIssues })), integ, scores: judged.map(j => ({ group: j.dim, score: j.score, dims: j.criteria, gatesFailed: j.gatesFailed, top: j.findings.slice(0, 3) })), fixes: fixes.map(f => ({ owner: f.owner, summary: f.summary, knownIssues: f.knownIssues })), final }
