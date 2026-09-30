export const meta = {
  name: 'pelican-build',
  description: 'Build Pelican Bay in the chosen style: 11 parallel module builders, integration, 6-lens critic panel, fix rounds with re-scoring',
  phases: [
    { title: 'Build', detail: '11 builders, each owning its own files, self-checking via screenshots' },
    { title: 'Integrate', detail: 'wire modules, zero console errors, dist build' },
    { title: 'Critique', detail: '6 critics on renders, one lens each' },
    { title: 'Fix', detail: 'fixers grouped by file owner' },
    { title: 'Score', detail: 'judges re-score after each fix round' },
  ],
}

const ROOT = '/home/user/experiments-and-tests/pelican-bicycle'
const STYLE = args.style          // { key, name, userNotes }
const REF = `${ROOT}/drafts/${STYLE.key}`

const COMMON = `You are part of a team building "Pelican Bay" (鹈鹕湾): an over-the-top, self-contained HTML page with an interactive SVG animation of a great white pelican riding a bicycle along a seaside road. The user expects extreme quality: charming, anatomically convincing, mechanically correct, silky 60fps.

MANDATORY READING before you write code:
- ${ROOT}/CONTRACT.md (module interface, coordinates, colour tokens, budgets, tools, rules)
- ${ROOT}/docs/rig-spec.md (geometry, rig math, rationale)
- ${ROOT}/src/contract.js, and the phase-0 placeholder for your own module(s)
- THE CHOSEN VISUAL STYLE, picked by the user: "${STYLE.name}". Reference files: ${REF}/keyframe.svg (source), ${REF}/keyframe.png, and ${REF}/closeup.png. Read the PNGs, and mine the SVG source for shapes, palette and techniques. Match this style faithfully; you may improve on it. User's notes on the choice: ${STYLE.userNotes || '(none)'}

RULES:
- Only edit the files you own (listed below). If you need something from another owner or a contract change, put it in contractRequests in your report instead of editing their files. You MAY read any file.
- Do not run npm install. Do not git commit (the lead commits).
- Self-check visually: node ${ROOT}/tools/shoot.mjs --out shots/<your-id> --set hero,frames,tods,cams,events --sheet, then Read the PNGs (especially sheet.png and a few full-size frames). Iterate until it looks excellent: at least 3 visual iterations. Also run node ${ROOT}/tools/lint.mjs, and node ${ROOT}/tools/check-rig.mjs if you touch the rig. shoot.mjs must exit 0 (zero console errors).
- Other builders are working in parallel on other modules, so the scene may temporarily show placeholders or half-finished art from them; ignore that.
- Stay within the perf budgets in CONTRACT.md (run --perf once at the end).
Return the structured report.`

const REPORT = {
  type: 'object',
  properties: {
    owner: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
    features: { type: 'array', items: { type: 'string' } },
    contractRequests: { type: 'array', items: { type: 'string' } },
    knownIssues: { type: 'array', items: { type: 'string' } },
    perf: { type: 'string' },
  },
  required: ['owner', 'files', 'summary'],
}

const BUILDERS = [
  { id: 'rig', files: 'src/rig/solve.js, src/rig/ik.js, src/rig/secondary.js, tools/check-rig.mjs', brief: `Own the motion. solvePose must stay PURE (no DOM, no hidden state) and exactly periodic in crank phase when there are no events (blink and look-around may be periodic in t). Polish and add: a natural pedalling rhythm (bob/sway/lean, hip rock, ankling); head stabilisation with a subtle periodic look-around (glances forward, at the sea, and occasionally at the camera); breathing; wind flutter; a better WAVE (near wing lifts off the bar, waves with follow-through; the far wing keeps steering); BELL (thumb flick + head nod); GULP (head tips back, bill opens, pouch bulges, and the bulge travels down the neck via pose.neck width params; add fields to pose.neck if needed, and report them for pelican-body); HOP (anticipation crouch, squash/stretch via body sx/sy, bike pitch, landing overshoot); COASTING (cranks stop and feet stay level, the body relaxes and leans back slightly). Extend check-rig.mjs to also check events. check-rig must pass. Make wheel direction and chain direction correct. Keep contract slot semantics; add pose fields rather than renaming.` },
  { id: 'bike', files: 'src/art/bike.js', brief: `Own every bike slot: retro city bike in the chosen style. Frame tubes with lugs/joints; fork with rake; swept-back city bars with grips (the pelican's wing-hands wrap the grips); leather sprung saddle; 48T chainring with teeth and a 5-arm spider; 16T cog; crank arms; platform pedals; the chain on CHAIN_D with pathLength=100, plates "1.1 0.9" and pins, dashoffset = pose.chainOffset; 700c wheels (tyre with tread, rim, hub, 32 spokes 3-cross), plus the anti-aliasing rules in rig-spec §3 (spoke opacity 1-smoothstep(pose.spokeBlur), blur wedges fade in, valve and reflector keep real rotation); fenders; a front BASKET full of fish (a tail or two flops occasionally, animated in update); bell; headlamp body (the beam is fx's job); reflectors. Far-side parts (far crank and pedal) use -far tokens. Beautiful at the close-up camera.` },
  { id: 'pelican-body', files: 'src/art/pelican-body.js', brief: `Own slots neck, tail, body, pouch, billLower, billUpper, head, eye, crest, plus neckD(). A great white pelican with star quality: lush layered plumage (body contour feathers, wing coverts on the body side), the tail, the long S-neck (neckD must keep a fixed command count; add feather texture strokes that follow it), the head with pink facial skin around the eye, a dark eye with a highlight and a cheeky expression (eyelid for blinks via sy), the shaggy crest, the long pinkish-orange bill with a ridge line and hooked red nail, and a translucent yellow-orange pouch that jiggles (the pouch slot scales about its hinge). Optional accessories to taste (scarf fluttering from the neck base, goggles pushed up on the forehead). Night readability matters too.` },
  { id: 'pelican-limbs', files: 'src/art/pelican-limbs.js', brief: `Own the leg and wing slots (Near and Far variants; Far uses -far tokens). Legs: feathered thigh "trousers" that blend into the body, orange scaly tarsus with a knee joint that reads well, and pelican feet that are TOTIPALMATE (all four toes webbed) and sit flat on the pedal (ball at local (17,9)). Wings: upper and lower wing with coverts and secondaries, black primaries at the hand wrapping the grip like fingers (wrist pivot on the grip). The wave pose must look good too (render ev-wave). Joints must look continuous at every crank angle: check all 12 frames in the close-up sheet.` },
  { id: 'sky', files: 'src/world/sky.js, src/core/palette.js', brief: `Own the sky layers (L-sky, L-stars, L-sunmoon, L-clouds) AND the palette keyframes in core/palette.js: retune ENV_KEYS/MATERIALS so every time of day matches the chosen style (dawn, noon, golden, sunset, dusk, night). Sky gradient with depth; sun with a layered radial-gradient glow and optional rays; moon with craters and glow at night; twinkling star field (cheap opacity animation, subset per frame); beautiful clouds in the style (parallax depth .03, lit and shade tokens). No filters on moving things.` },
  { id: 'sea', files: 'src/world/sea.js', brief: `Own L-hills-far, L-lighthouse, L-sea, L-boats. Distant headland or islands; a lighthouse with a rotating beam that is visible at night (beacon token, --pb-n-lampOn); the sea from the horizon (y=470) to the shore with depth gradient, animated wave bands, a sun or moon glitter path under frame.sun.x or frame.moon.x; 1-2 sailboats that bob and drift; a distant ship. Parallax per layer depth. Match the chosen style.` },
  { id: 'land', files: 'src/world/land.js', brief: `Own L-shore, L-roadside, L-road, L-foreground. Beach and rocks (depth .6, TILE.shore); roadside (depth .9, TILE.roadside): palms that sway, lamp posts every 848.2 units with glows at night, a guardrail, a signpost reading "鹈鹕湾 Pelican Bay" (system font or paths), a small fish stand; the road (depth 1, TILE.road) with an edge line, dashes every 157.08, and subtle texture; foreground (depth 1.3, TILE.foreground): grass tufts, flowers and rocks that whip past without hiding the rider. Tiles must loop seamlessly (render 3 copies with <use>). The road surface top must meet GROUND_Y=790 so the tyres touch it.` },
  { id: 'fx', files: 'src/fx/fx.js', brief: `Own L-gulls-far, L-shadow, L-fx-back, L-fx-front. Seagull flock (flapping, drifting; escorts the rider when cadence > 85); a soft contact shadow under the bike (shrinks and fades with pose.riderY during a hop; uses --pb-n-shadowAlpha); dust puffs from the rear tyre scaled by speed; a landing dust burst on hop landings; speed lines above cadence 80 (toggle 'speedlines'); occasional drifting feathers; a musical-note or "ding" glyph when the bell rings; sparkle hearts when gulping a fish; the headlamp beam cone on the road at night (--pb-n-lampOn). Particle pools preallocated (no DOM churn), deterministic rng. Respect frame.reduced.` },
  { id: 'ui', files: 'src/ui/ui.js, src/ui/styles.js', brief: `Own the HTML overlay (#ui) and all of its CSS (inject a <style> built from styles.js). An elegant, minimal, collapsible glass panel that doesn't cover the rider; bilingual labels (中文 first, English second). Controls: play/pause; a cadence slider with live km/h readout; a coast toggle; a time-of-day slider with an auto-cycle toggle and sun/moon icons; a camera segmented control (wide/close-up/cinematic); action buttons bell/wave/hop/feed-fish (ui:gulp); a sound toggle; download buttons (animated SVG = ui:download{kind:'svg'}, current frame = kind:'frame'). A small odometer HUD (distance km, speed km/h, cadence rpm). A title card "Pelican Bay · 鹈鹕湾" that fades in and out at start. A keyboard help overlay (? key). Keys: Space=bell, W=wave, H/↑=hop, F=feed fish, C=camera, T=cycle time of day, ←/→=cadence, S=coast, M=sound, P=pause. Must work at 390px phone width (bottom sheet) and be accessible (buttons with labels, focus rings, aria-pressed). Take screenshots with the panel open and collapsed, desktop and mobile (--set mobile).` },
  { id: 'audio', files: 'src/audio/audio.js', brief: `Own procedural WebAudio sound; no sample files. createAudio(bus) -> {enable, disable, update(frame)}. The AudioContext is created in enable() (a user gesture). Sounds: a classic ring-ring bicycle bell (FM or inharmonic partials, two strikes) on rig:event bell; freewheel ticking when coasting (rate proportional to wheel speed); a soft chain whirr while pedalling; wind noise (filtered noise, gain proportional to speed squared); ocean waves (low-passed noise with slow swells); occasional gull calls (pitch-glide chirps); a landing thump; a gulp "gloop"; a master compressor. Suspend when the tab is hidden. Verify with node syntax checks, and in Playwright that enable() then emitting events throws no errors (use an OfflineAudioContext test if useful).` },
  { id: 'baker', files: 'src/bake/bake.js, tools/bake.mjs, tools/check-baked.mjs', brief: `Own the zero-JS export. bakeSVG(svg, opts) returns a standalone animated SVG string (SMIL + CSS only, no scripts, CSS variables resolved to literal colours) that loops seamlessly. Recommended design: generic record-and-replay. Using the page runtime (window.__pb.renderAt), sample the scene over a seamless loop (for example 4 crank turns at 60 rpm = 4 s; near-layer tiles loop per crank turn by construction), record every animated attribute (transform, d, opacity, cx, cy, stroke-dashoffset, style opacity...) on every element, drop static ones, detect linear or rotating ones and emit 2-keyframe animations with unwrapped angles, and decimate the others with tolerance-based keyframe reduction. Slow far-layer motion that can't loop in 4 s: support an opt-in convention (for example data-bake-period on an element) or emit an independent linear loop; describe the convention in contractRequests so world owners can adopt it. tools/bake.mjs opens dist/index.html (or the dev server) in Playwright and writes dist/pelican-bicycle.svg. tools/check-baked.mjs renders the baked SVG as <img> at several times and checks it animates and roughly matches the live frames. Keep the file size reasonable (< 1.5 MB). The in-page Download button calls window.__pb.bakeSVG. Run this after others' art exists: re-run at the end.` },
]

phase('Build')
const reports = await parallel(BUILDERS.map(b => () =>
  agent(`${COMMON.replaceAll('<your-id>', b.id)}\n\nYOUR ROLE: ${b.id}\nFILES YOU OWN: ${b.files}\nBRIEF: ${b.brief}`,
    { label: `build:${b.id}`, phase: 'Build', schema: REPORT })))
const built = reports.filter(Boolean)
log(`builders finished: ${built.map(r => r.owner).join(', ')}`)

phase('Integrate')
const integ = await agent(`${COMMON.replaceAll('<your-id>', 'integrator')}

YOUR ROLE: integrator. You MAY edit any file, but keep edits minimal and respect each module's design. The builders' reports, including contractRequests between modules, are: ${JSON.stringify(built)}
Tasks: (1) Satisfy reasonable contractRequests (for example new pose fields consumed by art, bake conventions, and main.js wiring such as portrait-phone framing that keeps the rider in view). (2) Make node tools/check-rig.mjs, node tools/lint.mjs, node tools/build.mjs, node tools/shoot.mjs (dev) and node tools/shoot.mjs --dist --set hero,frames,tods,cams,events,mobile --sheet all pass with zero console errors. (3) Run node tools/bake.mjs to produce dist/pelican-bicycle.svg and node tools/check-baked.mjs. (4) Check z-order and cohesion across modules in the renders (does the rider sit ON the road, do the lighting and palette agree across layers, are there gaps at the edges when the camera zooms or rolls?) and fix. (5) Run --perf and fix any budget violations. Report what you changed.`,
  { label: 'integrate', phase: 'Integrate', schema: REPORT })

const LENSES = [
  { id: 'anatomy', owners: 'pelican-body, pelican-limbs', prompt: 'Pelican anatomy and character: does it read instantly as a great white pelican (bill, nail, pouch, crest, facial skin, black primaries, totipalmate feet)? Proportions, appeal, expression, silhouette, how well the plumage renders, and the far-side limbs.' },
  { id: 'mechanics', owners: 'bike, rig', prompt: 'Bicycle mechanics and physical plausibility: feet stay on the pedals at every crank angle, knees never flip, wings stay on the grips, the chain wraps both sprockets and moves in the right direction, wheels rotate the correct way at a plausible rate vs the ground speed, the bike frame geometry is right, contact with the road, and the hop.' },
  { id: 'animation', owners: 'rig, fx, pelican-body', prompt: 'Animation principles: timing, weight, follow-through, overlapping action, secondary motion (pouch, crest, tail, scarf), head stabilisation, the event animations (wave, bell, gulp, hop), liveliness, and whether anything looks robotic or pops. Compare consecutive frames in the 12-frame close-up sheet, and the event shots.' },
  { id: 'art', owners: 'sky, sea, land, fx', prompt: 'Composition, colour and light across times of day: fidelity to the chosen style, cohesion between layers, focal hierarchy (the rider must pop), atmospheric perspective, the night scene (lamps, lighthouse, headlamp), edge gaps under camera moves, visual clutter.' },
  { id: 'engineering', owners: 'any', prompt: 'Engineering: read the code for bugs (state leaks, per-frame allocations, DOM churn, NaN risks, event pruning, visibilitychange, precision of large angles), run --perf and report fps, JS ms and node count, check console errors in dev and dist, the build size, and whether the dist build works from file://.' },
  { id: 'ux', owners: 'ui, audio, baker', prompt: 'UX, accessibility and exports: the UI panel on desktop and 390px mobile (take your own screenshots with Playwright, panel open and closed), keyboard shortcuts actually work (drive them with Playwright key presses and screenshot the results), labels are clear, aria attributes and focus, reduced motion, sound toggles without errors, the downloaded/baked SVG really animates standalone (check-baked) and looks right.' },
]
const FINDINGS = {
  type: 'object',
  properties: {
    lens: { type: 'string' },
    score: { type: 'number', description: '1-10 for this lens' },
    findings: { type: 'array', items: { type: 'object', properties: {
      owner: { type: 'string', description: 'one of: rig, bike, pelican-body, pelican-limbs, sky, sea, land, fx, ui, audio, baker, lead' },
      severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
      issue: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } },
      required: ['owner', 'severity', 'issue', 'fix'] } },
  },
  required: ['lens', 'score', 'findings'],
}
const OWNER_FILES = Object.fromEntries(BUILDERS.map(b => [b.id, b.files]))
OWNER_FILES.lead = 'src/main.js, src/scene.js, src/core/{camera,svg,bus,math,bakekit}.js, src/page.css, src/index.dev.html, tools/{build,shoot,serve,lint,render,sheet}.mjs'

async function critique(round) {
  const out = await parallel(LENSES.map(l => () => agent(`You are a demanding critic (lens: ${l.id}) reviewing "Pelican Bay", an interactive SVG animation of a great white pelican riding a bicycle, built in the style "${STYLE.name}" (reference: ${REF}/keyframe.png). Project: ${ROOT} (read CONTRACT.md for tools and ownership). First run: node ${ROOT}/tools/build.mjs && node ${ROOT}/tools/shoot.mjs --dist --out shots/critic-${l.id}-r${round} --set hero,frames,tods,cams,events,mobile --sheet, then READ the resulting PNGs carefully (the sheet and several full-size frames). You may take extra screenshots with Playwright or read code as your lens requires.
LENS: ${l.prompt}
Likely owners: ${l.owners}. Owner-to-file map: ${JSON.stringify(OWNER_FILES)}.
Give a score from 1 to 10 and concrete, actionable findings (max 10, most important first), each routed to exactly one owner, with evidence (which shot or code line) and a specific fix. Don't nitpick: focus on what most improves the result. Do NOT edit any files.`,
    { label: `critic:${l.id}:r${round}`, phase: 'Critique', schema: FINDINGS })))
  return out.filter(Boolean)
}

async function fixRound(crits, round) {
  const byOwner = {}
  for (const c of crits) for (const f of c.findings) if (f.severity !== 'minor' || round === 1) (byOwner[f.owner] ||= []).push({ lens: c.lens, ...f })
  const owners = Object.keys(byOwner).filter(o => OWNER_FILES[o])
  log(`round ${round}: fixing ${owners.length} owners: ${owners.map(o => `${o}(${byOwner[o].length})`).join(', ')}`)
  return (await parallel(owners.map(o => () => agent(`${COMMON.replaceAll('<your-id>', 'fix-' + o)}

YOUR ROLE: fixer for owner "${o}", round ${round}. FILES YOU OWN: ${OWNER_FILES[o]}
Critics' findings for your files (fix blockers and majors; fix minors when cheap; if you disagree with a finding, say why in knownIssues): ${JSON.stringify(byOwner[o])}
After fixing, rebuild (node tools/build.mjs), re-shoot and visually verify each fix, and make sure the full shoot (dev and --dist) still exits 0 and check-rig and lint pass.`,
    { label: `fix:${o}:r${round}`, phase: 'Fix', schema: REPORT })))).filter(Boolean)
}

const history = []
let crits = await critique(1)
history.push({ round: 1, scores: crits.map(c => [c.lens, c.score]) })
log('round 1 scores: ' + crits.map(c => `${c.lens}=${c.score}`).join(' '))
for (let round = 1; round <= 2; round++) {
  const min = Math.min(...crits.map(c => c.score))
  if (min >= 8.5) break
  await fixRound(crits, round)
  if (round === 2) break
  phase('Score')
  crits = await critique(round + 1)
  history.push({ round: round + 1, scores: crits.map(c => [c.lens, c.score]) })
  log(`round ${round + 1} scores: ` + crits.map(c => `${c.lens}=${c.score}`).join(' '))
}
return { built: built.map(r => ({ owner: r.owner, summary: r.summary, knownIssues: r.knownIssues })), integ, history, lastFindings: crits }
