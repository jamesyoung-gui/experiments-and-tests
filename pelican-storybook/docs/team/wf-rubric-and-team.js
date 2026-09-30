export const meta = {
  name: 'pelican-rubric-and-team',
  description: 'Draft an evaluation rubric at the absolute-limit standard from 8 expert lenses, red-team it, then reverse-design the agent team to maximise it',
  phases: [
    { title: 'Lenses', detail: '8 expert perspectives draft rubric criteria' },
    { title: 'Synthesize', detail: 'merge into a weighted rubric with anchors and gates' },
    { title: 'Red team', detail: 'Goodhart attacks, gaps, ambiguity' },
    { title: 'Finalize', detail: 'revise rubric -> RUBRIC.md + rubric.json' },
    { title: 'Team design', detail: '3 architects reverse-design the agent team from the rubric' },
    { title: 'Team judge', detail: 'score designs, synthesize TEAM.md' },
  ],
}

const ROOT = '/home/user/experiments-and-tests/pelican-bicycle'
const CONTEXT = `PROJECT CONTEXT (read carefully):
The user asked (in Chinese): "Generate an SVG animation of a pelican riding a bicycle, output as HTML. You may split into dozens or even hundreds of agents working together, and call any tools and skills. Use all of your abilities to make an extreme, over-delivered answer." Then: "Remember, you represent the peak of world AI, the king of capability. Everyone is waiting to evaluate your performance, so your work must represent your absolute limit. By that standard, draft a detailed rubric, then reverse-design your agent team to maximise the target."
Background: "Generate an SVG of a pelican riding a bicycle" is Simon Willison's famous informal LLM benchmark (since late 2024). Typical failures: the bicycle frame is wrong (not a diamond frame, disconnected tubes, missing chain or pedals); the pelican doesn't read as a pelican (no pouch, wrong bill); the pelican floats instead of sitting on the saddle; feet don't reach the pedals; no animation, or robotic animation. Humans famously draw bicycles wrong too (Gianluca Gimini's "Velocipedia").
Our current state: ${ROOT}. Read ${ROOT}/docs/team/plan.v0.md (the plan), ${ROOT}/CONTRACT.md (module contract), ${ROOT}/docs/rig-spec.md (geometry and rig), ${ROOT}/docs/team/wf-build.v0.js (the current draft of the build workflow: 11 builders, an integrator, a 6-lens critic panel and fix rounds), and skim ${ROOT}/src/ (a phase-0 scaffold: pure pose solver with 2-bone IK validated over the full crank circle, time-of-day palette, camera, a scene builder, placeholder art, and Playwright tools shoot.mjs/check-rig.mjs/lint.mjs/build.mjs/render.mjs). Five style drafts are currently being drawn in ${ROOT}/drafts/ (A flat vector, B storybook, C retro poster, D anime scenery, E Chinese ink wash). The USER will pick the style; the build starts after that.
Constraints: a Linux container with Node 22, Playwright 1.56 + headless Chromium (software rendering), an ffmpeg that only encodes webm/vp8, esbuild, and npm access. No Blender, no GPU, and no other AI models (there is no "ChatGPT 6 Astra"). A workflow runs at most about 2 agents concurrently (4 CPUs), but several workflows can run at once; token cost is NOT a constraint, wall-clock matters moderately. Agents share one filesystem (parallel writers must own disjoint files, or use git worktrees). Agents can read PNG screenshots (they are multimodal), so visual self-checking is possible. Final deliverables: a self-contained dist/index.html (interactive, 60fps), a zero-JS baked animated SVG, poster, contact sheet, webm preview, README, a GitHub branch/PR, and a published claude.ai Artifact.`

const CRITERIA_SCHEMA = {
  type: 'object',
  properties: {
    lens: { type: 'string' },
    criteria: { type: 'array', items: { type: 'object', properties: {
      id: { type: 'string' }, name: { type: 'string' },
      whatExcellentLooksLike: { type: 'string' },
      anchors: { type: 'object', properties: { s2: { type: 'string' }, s5: { type: 'string' }, s8: { type: 'string' }, s10: { type: 'string' } }, required: ['s2', 's5', 's8', 's10'] },
      measurement: { type: 'string', description: 'automated check | visual judge on specific renders | code review | live interaction test; be concrete (which script, which frames, which threshold)' },
      suggestedWeight: { type: 'number', description: 'relative importance 1-10' },
      failureModes: { type: 'array', items: { type: 'string' } },
    }, required: ['id', 'name', 'whatExcellentLooksLike', 'anchors', 'measurement', 'suggestedWeight'] } },
    hardGates: { type: 'array', items: { type: 'string' }, description: 'pass/fail conditions that cap the total score if violated' },
    wowIdeas: { type: 'array', items: { type: 'string' }, description: 'concrete ideas that would make an expert in this lens say "I have never seen this done so well"' },
  },
  required: ['lens', 'criteria', 'hardGates', 'wowIdeas'],
}

const LENSES = [
  { id: 'benchmark-evaluator', who: 'a frontier-AI evaluation lead who has studied hundreds of "pelican riding a bicycle" outputs across model releases (research the benchmark with WebSearch/WebFetch if useful, e.g. simonwillison.net posts tagged pelican-riding-a-bicycle). What separates the all-time best entries? What would make evaluators say this is a step change? Also: honesty and verifiability of claims, and first-impression impact.' },
  { id: 'animation-director', who: 'a feature-animation director (Pixar/Disney calibre): the 12 principles, acting and appeal, timing and spacing, weight, follow-through, overlapping action, staging, silhouette readability, character personality, the storytelling in a looping scene, and camera language.' },
  { id: 'ornithologist-illustrator', who: 'an ornithologist who is also a natural-history illustrator: great white pelican (Pelecanus onocrotalus) anatomy (bill, nail, pouch, gular skin, facial skin, crest, plumage tracts, black primaries and secondaries, totipalmate feet, leg articulation, the knee hidden in the body and the visible "backward knee" being the ankle), how to stylise without breaking believability, and how a bird would plausibly sit and pedal.' },
  { id: 'bicycle-engineer', who: 'a bicycle frame builder and mechanical engineer: diamond-frame geometry, drivetrain (chainring, cog, chain wrap and tension, chain line), crank phasing (cranks at 180°), wheel and spoke lacing, rotation directions and speed ratios (wheel vs crank vs ground speed), steering geometry, the contact patch, and the biomechanics of pedalling (knee path, ankling, hip stability).' },
  { id: 'creative-coding-judge', who: 'an Awwwards / demoscene / CSS-Design-Awards judge: craft, polish, micro-interactions, delight, easter eggs, the first 5 seconds, sound design, cinematic moments, technical virtuosity visible to a viewer, a signature "how did they do that" moment, and a cohesive art direction.' },
  { id: 'web-performance-engineer', who: 'a senior web-platform and performance engineer: 60fps under software rendering, frame-time p95, DOM size, paint and filter costs, memory stability over 10+ minutes, the file:// self-contained build, size budgets, cross-browser (Chromium/Firefox/Safari) risk, SMIL fidelity of the zero-JS SVG, deterministic rendering, zero console errors, and robustness (tab hidden, resize, DPR, reduced motion).' },
  { id: 'ux-a11y-product', who: 'a product designer and accessibility specialist: onboarding and discoverability of interactions, control design, a bilingual zh/en UI, mobile/portrait layout, keyboard support, screen-reader semantics, prefers-reduced-motion, sound etiquette (off by default), and a clear "share/download" story.' },
  { id: 'engineering-process-reviewer', who: 'a principal engineer reviewing the codebase and process: architecture clarity, a pure testable rig, automated checks (rig invariants, visual regression, perf), reproducibility (a one-command build), documentation (README, how it was made), honesty about tools used and not used, git hygiene, and how the multi-agent process itself is shown as a credible, verifiable showcase.' },
]

phase('Lenses')
const lensOut = (await parallel(LENSES.map(l => () => agent(`${CONTEXT}

You are ${l.who}
Draft the rubric criteria FROM YOUR LENS for judging this deliverable at the "absolute limit of what any AI system or elite human team could produce" standard. Be specific and measurable: every criterion needs anchors at 2/5/8/10 with concrete observable descriptions, and a concrete measurement method (name the script, render set, threshold or interaction). 6-12 criteria. Also list hard gates (pass/fail) and "wow" ideas. Do not edit any files.`,
  { label: `lens:${l.id}`, phase: 'Lenses', schema: CRITERIA_SCHEMA })))).filter(Boolean)
log(`${lensOut.length}/8 lenses returned ${lensOut.reduce((s, l) => s + l.criteria.length, 0)} criteria`)

phase('Synthesize')
const synth = await agent(`${CONTEXT}

You are the chief evaluator. Merge these expert rubric drafts into ONE rubric: ${JSON.stringify(lensOut)}
Requirements:
- 8-12 top-level DIMENSIONS with weights summing to 100, each with 3-8 criteria (dedupe overlaps; keep the sharpest wording). Each criterion: id, anchors at 2/5/8/10 (concrete and observable), a measurement method (automated script / visual judge on a named render set / code review / live interaction test), and the evidence artefact it's judged from.
- HARD GATES: pass/fail conditions; if any fails, the total is capped (state the cap).
- An evaluation PROTOCOL: which render sets and measurements to produce (e.g. 24-frame pedal cycle close-ups, 5 times of day, 3 cameras, the event shots, mobile 390px, perf trace, a 10-minute soak, the baked-SVG diff), how many independent judges score each dimension, how to aggregate (median), and how to resist score inflation (judges must cite evidence; adversarial second opinions on any score ≥ 9).
- A "10/10 north star": a vivid paragraph describing what the perfect result looks and feels like.
- Target bar: every dimension ≥ 9 and weighted total ≥ 92, with all gates passing.
Write it in Chinese (keep technical terms in English where clearer) to ${ROOT}/RUBRIC.md, and a machine-readable version to ${ROOT}/rubric.json ({dimensions:[{id,name,weight,criteria:[{id,name,anchors:{2,5,8,10},measurement,evidence}]}], gates:[{id,rule,cap}], protocol:{...}, target:{...}}). Return a short summary.`,
  { label: 'synthesize', phase: 'Synthesize' })

phase('Red team')
const RED = { type: 'object', properties: { attacks: { type: 'array', items: { type: 'object', properties: {
  kind: { type: 'string', enum: ['goodhart', 'gap', 'ambiguity', 'unmeasurable', 'weighting', 'infeasible'] },
  target: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' } }, required: ['kind', 'problem', 'fix'] } } }, required: ['attacks'] }
const reds = (await parallel([
  'GOODHART ATTACKER: find every way a submission could score ≥ 9 on this rubric while actually being mediocre, gimmicky, or unimpressive to a discerning human evaluator. Propose rubric fixes that close each loophole.',
  'GAP AND AMBIGUITY HUNTER: find missing criteria (what would a world-class judge dock points for that the rubric ignores?), ambiguous anchors two judges would score differently, unmeasurable criteria, wrong weights, and anything infeasible in this environment (no GPU, software rendering, 2 concurrent agents). Propose precise fixes.',
].map((p, i) => () => agent(`${CONTEXT}\n\nRead ${ROOT}/RUBRIC.md and ${ROOT}/rubric.json. ${p} Do not edit files.`, { label: `redteam:${i ? 'gaps' : 'goodhart'}`, phase: 'Red team', schema: RED })))).filter(Boolean)

phase('Finalize')
const final = await agent(`${CONTEXT}

USER UPDATES SINCE THE RUBRIC WAS DRAFTED (must be incorporated): (1) The user CHOSE style C (retro travel poster, WPA / art-deco screenprint). The style bible is ${ROOT}/docs/STYLE-C.md and the reference is ${ROOT}/drafts/C-poster/ (keyframe.png, closeup.png, gen.mjs); add style-fidelity criteria against it. (2) The user explicitly requires that "the final version must have MUCH more detail than the draft". Add a hard gate G-DETAIL: build a detail inventory (itemised objects and texture elements per layer: pelican, bike, sea, land, sky, fx, typography/frame) compared with drafts/C-poster; the target is at least 2.5x the draft's items; at a 3x zoom crop every region of the rider still shows fine detail; 2 judges compare side by side with the draft. Add weighted "detail density and craft" criteria (layered feathers, individual flight feathers, pouch texture, bill ridge and nail, bike lugs, cables, spoke nipples, chain links, saddle springs and rivets, woven basket and fish scales, harbour town, piers, rocks, buoys, boats with rigging, bird flocks, road furniture, flora, several sea and cloud bands, sun rays, frame, stamps, ticket-style annotations), always within the perf budget (spend detail on static layers, pre-merged into paths, reused via <use>).
You are the chief evaluator. Revise ${ROOT}/RUBRIC.md and ${ROOT}/rubric.json to address these red-team findings (accept the ones that improve the rubric; note in a short "Changelog / rejected findings" section at the end of RUBRIC.md why you rejected any): ${JSON.stringify(reds)}
Keep weights summing to 100. Make sure every criterion has a concrete evidence artefact that the build pipeline must produce. Return a summary including the final list of dimensions and weights.`,
  { label: 'finalize-rubric', phase: 'Finalize' })

phase('Team design')
const TEAM = { type: 'object', properties: {
  name: { type: 'string' }, file: { type: 'string' }, summary: { type: 'string' },
  agentCount: { type: 'number' }, wallClockEstimate: { type: 'string' },
  coverage: { type: 'array', items: { type: 'object', properties: { criterion: { type: 'string' }, producer: { type: 'string' }, verifier: { type: 'string' }, gate: { type: 'string' } }, required: ['criterion', 'producer', 'verifier'] } },
}, required: ['name', 'file', 'summary', 'coverage'] }
const ANGLES = [
  { id: 'specialist-depth', angle: 'Maximise depth: many narrow specialists (for example separate agents for the head and bill, the pouch, plumage, feet, wings, wheels, drivetrain, frame, each world layer, lighting, the night scene, sound, UI, baker, perf) with a dedicated verifier per rubric dimension, and loop-until-threshold per dimension.' },
  { id: 'tournament-quality', angle: 'Maximise quality through competition: best-of-N tournaments for the highest-weighted, most subjective parts (for example 3 competing pelican-head or character designs judged against the rubric, then the winner is grafted), plus an adversarial verification pass on every score ≥ 9.' },
  { id: 'pipeline-throughput', angle: 'Maximise quality per wall-clock hour under the 2-concurrent-agents-per-workflow limit: exploit multiple concurrent workflows, pipelines instead of barriers, critical-path scheduling (rig → pelican → limbs...), git-worktree isolation where useful, fast automated gates before expensive visual judges, and early integration to avoid late surprises.' },
]
const teams = (await parallel(ANGLES.map(a => () => agent(`${CONTEXT}

Read the FINAL rubric at ${ROOT}/RUBRIC.md and ${ROOT}/rubric.json. Reverse-design the agent team and workflow that MAXIMISES this rubric. Design angle: ${a.angle}
Requirements: map EVERY rubric criterion to a producer agent, a verifier (agent or automated gate) and the evidence artefact; define each agent's role, owned files (disjoint), inputs, acceptance tests and prompts at outline level; define phases, ordering, concurrency (multiple workflows allowed, about 2 agents each), loops and stop conditions tied to rubric scores; list the new automated tooling needed (for example a 24-frame cycle sheet, a perf soak, a visual diff, a baked-SVG diff, key-press drivers). Build on the existing scaffold, contract and tools; don't restart. The user has ALREADY chosen style C (see ${ROOT}/docs/STYLE-C.md) and requires far more detail than the draft (gate G-DETAIL): design dedicated detail-density producers and verifiers.
Write your proposal to ${ROOT}/docs/team/proposal-${a.id}.md and return the structured summary.`,
  { label: `team:${a.id}`, phase: 'Team design', schema: TEAM })))).filter(Boolean)

phase('Team judge')
const JUDGE = { type: 'object', properties: { scores: { type: 'array', items: { type: 'object', properties: {
  name: { type: 'string' }, expectedRubricScore: { type: 'number' }, coverage: { type: 'number' }, feasibility: { type: 'number' }, risks: { type: 'array', items: { type: 'string' } }, bestIdeas: { type: 'array', items: { type: 'string' } } },
  required: ['name', 'expectedRubricScore', 'feasibility', 'bestIdeas'] } } }, required: ['scores'] }
const judges = (await parallel([0, 1].map(i => () => agent(`${CONTEXT}

Judge these three team designs (files in ${ROOT}/docs/team/proposal-*.md; summaries: ${JSON.stringify(teams)}) against the rubric at ${ROOT}/RUBRIC.md. ${i ? 'Emphasise feasibility in this environment and failure risk (integration conflicts, agents drifting from the chosen style, judges inflating scores).' : 'Emphasise the expected final rubric score and coverage of the highest-weighted dimensions.'} Score each design (expected rubric score 0-100, coverage 0-10, feasibility 0-10), list the risks, and list the best ideas worth grafting. Do not edit files.`,
  { label: `team-judge:${i ? 'feasibility' : 'quality'}`, phase: 'Team judge', schema: JUDGE })))).filter(Boolean)

const teamFinal = await agent(`${CONTEXT}

You are the lead architect. Using the three proposals (${ROOT}/docs/team/proposal-*.md) and the judges' verdicts ${JSON.stringify(judges)}, write the FINAL team design to ${ROOT}/TEAM.md (in Chinese, technical terms in English): take the strongest base design, graft the best ideas from the others, and fix the judged risks. It must contain: (1) a rubric-to-team coverage matrix (every criterion → producer → verifier → evidence artefact → gate); (2) the agent roster (role, owned files, inputs, acceptance tests), about 40-80 agents in total, justified; (3) phases with ordering and concurrency across workflows, loops and stop conditions tied to rubric thresholds (every dimension ≥ 9, total ≥ 92, all gates pass); (4) the new tooling to build first; (5) anti-inflation judging protocol; (6) risk register. Also write a concrete, runnable Workflow script outline for the build to ${ROOT}/docs/team/wf-build.v1.js, following the structure and API of ${ROOT}/docs/team/wf-build.v0.js (JavaScript; agent/parallel/pipeline/phase/log/args; no Date.now or Math.random; meta must be a pure literal). Return a summary.`,
  { label: 'team-final', phase: 'Team judge' })

return { lenses: lensOut.map(l => ({ lens: l.lens, n: l.criteria.length, wow: l.wowIdeas })), synth, reds, final, teams, judges, teamFinal }