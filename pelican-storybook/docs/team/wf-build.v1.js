export const meta = {
  name: 'pelican-build-v1',
  description: 'Pelican Bay build v1 (style C): multi-instance lane pipeline with merge train, targeted duels, detail ladder, evidence-pack judging with Red Court, rolling fix loop and R-final',
  whenToUse: 'One script, many modes. The lead launches one instance per lane/mode and runs several instances at once (TEAM.md section 5.3). args.mode is one of freeze, tools, field, r0, lane, duel, detail, integrate, round, loop, fix, ship.',
  phases: [
    { title: 'Freeze', detail: 'contract v1, walking skeleton, real-load perf canary, director docs' },
    { title: 'Tools', detail: 'tool queue: build each tool, then an independent tool-validity check' },
    { title: 'Field', detail: 'isolated matched-effort baselines, single-shot controls, red-team defects' },
    { title: 'R0', detail: 'tool validity, baseline lock, ink freeze, probes, sealed hold-out' },
    { title: 'Build', detail: 'lane owners iterate through drops against lock points' },
    { title: 'Shadow', detail: 'fresh shadow judges with canaries, Red Court on any >=9' },
    { title: 'Duel', detail: 'entries, gates, blind judges with decoys, Bradley-Terry, harvest, graft' },
    { title: 'Detail', detail: 'read-only scouts, rung metrics, DV and DV-AUDIT, backlog' },
    { title: 'Integrate', detail: 'integration freeze: full T2 green, bake, webm' },
    { title: 'Evidence', detail: 'gate precheck and per-dimension evidence packs' },
    { title: 'Judge', detail: 'fresh isolated J-lens and J-blind per dimension' },
    { title: 'Validate', detail: 'canary recall, outliers, spread, J-valid' },
    { title: 'Red Court', detail: 'adversarial re-check of every criterion with median >=9' },
    { title: 'Score', detail: 'score.mjs aggregation and scorecard' },
    { title: 'Fix', detail: 'rolling fix queue ranked by recoverable points per hour' },
    { title: 'Ship', detail: 'package deliverables; the lead publishes PR and Artifact' },
  ],
}

// ───────────────────────────── constants ─────────────────────────────
const ROOT = '/home/user/experiments-and-tests/pelican-bicycle'
const WTROOT = '/home/user/pb-wt'
const A = args || {}
const MODE = A.mode
const TAG = A.tag || 'v1'                       // label suffix; keep stable for resume
const MAX_ITER = A.maxIter ?? 6                 // agent sessions per owner (the time budget; no clock)
const wt = lane => (lane === 'A' || lane === 'main') ? ROOT : `${WTROOT}/${lane}/pelican-bicycle`

const TARGET = { dimMin: 9.0, totalMin: 92, critMin: 7, coreMin: 8 }            // rubric target (R-final only)
const ENTRY = { dimMin: 9.3, total: 93, coreMin: 8.5, critMin: 7.5 }             // R-final entry, plus measured shadow bias
const CORE = ['C1.3', 'C4.1', 'C5.1', 'C5.2', 'C6.1', 'C6.3', 'C7.1', 'C7.2', 'C7.6', 'C7.7', 'C8.1', 'C13.1', 'C13.2']
const DIMS = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13']
const GROUPS = { A: ['D1', 'D2', 'D3', 'D4'], B: ['D5', 'D6'], C: ['D7', 'D8', 'D13'], D: ['D9', 'D10', 'D11', 'D12'] }
const LOOPS = {
  L1: { dims: ['D1', 'D2', 'D3'], extra: ['C12.8'] },
  L2: { dims: ['D4'], extra: ['C1.3', 'C7.6', 'C13.1', 'C13.2'] },   // D4 + D13 pelican judged on the same build
  L3: { dims: ['D5', 'D6'], extra: [] },
  L4: { dims: ['D7', 'D8'], extra: ['C13.3', 'C13.4', 'C13.5', 'C13.6'] },
  L5: { dims: ['D9', 'D10', 'D11', 'D12'], extra: [] },
}
// judges per dimension (rubric protocol.judgeAllocation); special panels are executed by the pack's protocol files
const LENS_N = { D6: 5, D7: 5 }
const SPECIAL = {
  D1: [{ kind: 'blind', n: 3, protocol: 'canon14' }, { kind: 'blind', n: 5, protocol: 'thumb-species' }, { kind: 'adv', n: 2, protocol: 'occlusion' }],
  D2: [{ kind: 'lens', n: 1, protocol: 'open-mech-faults' }, { kind: 'blind', n: 1, protocol: 'bike-mechanic' }, { kind: 'lens', n: 1, protocol: 'frame-direction' }],
  D3: [{ kind: 'adv', n: 1, protocol: 'seam-hunt' }, { kind: 'adv', n: 1, protocol: 'hop-coast-dense' }],
  D4: [{ kind: 'blind', n: 3, protocol: 'species-id' }, { kind: 'lens', n: 1, protocol: 'fm10-anatomist' }],
  D5: [{ kind: 'blind', n: 3, protocol: 'speed-rank' }, { kind: 'blind', n: 1, protocol: 'name-events-ab' }, { kind: 'adv', n: 1, protocol: 'dense-lag' }],
  D6: [{ kind: 'blind', n: 5, protocol: 'gags-nofx' }, { kind: 'blind', n: 3, protocol: 'adjectives-15c3' }, { kind: 'blind', n: 1, protocol: 'story-retell' }],
  D7: [{ kind: 'blind', n: 5, protocol: 'opening-choice' }, { kind: 'adv', n: 2, protocol: 'zoom3x' }, { kind: 'blind', n: 5, protocol: 'same-style-pairs' }, { kind: 'blind', n: 5, protocol: 'appeal-3c1-delete' }, { kind: 'blind', n: 3, protocol: 'film-sheet' }],
  D8: [{ kind: 'blind', n: 5, protocol: 'field-pairs' }, { kind: 'blind', n: 3, protocol: 'moment-recall' }, { kind: 'user', n: 1, protocol: 'egg-explorer' }],
  D9: [{ kind: 'user', n: 2, protocol: 'cold-start-desktop-touch' }, { kind: 'lens', n: 1, protocol: 'bilingual-copy' }, { kind: 'lens', n: 1, protocol: 'aria-snapshot' }],
  D10: [],
  D11: [{ kind: 'blind', n: 3, protocol: 'baked-canon14' }, { kind: 'blind', n: 3, protocol: 'poster-knockout' }],
  D12: [{ kind: 'lens', n: 1, protocol: 'process-second-reader' }],
  D13: [{ kind: 'detail', n: 2, protocol: 'j-detail' }, { kind: 'blind', n: 5, protocol: 'no-harm-4-regions' }],
}
const RUNGS = {
  '0': { total: 129, parity: true },
  a: { perLayer: 1.5, pelican: 1.8, bike: 1.8, zoomPelican: 0.80, zoomBike: 0.75, fps: 57, dv: 1.5 },
  b: { total: 361, perLayer: 1.8, pelican: 2.3, bike: 2.3, fx: 6, zoomPelican: 0.92, zoomBike: 0.88, dv: 2.2, dvRegionsMore: 6, auditMajor: 0, saliency: 1.4 },
  c: { total: 452, perLayer: 2.0, pelican: 2.0, bike: 2.0, fx: 6, zoomPelican: 0.97, zoomBike: 0.95, dv: 3.0, dvRegionsMore: 7, auditMajor: 0, saliency: 1.4 },
}

// ───────────────────────────── coverage (machine source for tools/coverage.mjs → docs/team/coverage.json) ─────────────────────────────
// criterion: [producers, automated verifiers, judge verifiers, evidence, gates, loop/duel]
const COVERAGE = {
  'C1.1': ['RIG-L,BK,PL', 'check-anchors,check-benchmark', 'J-blind×3 canon14 +RC', 'docs/eval/canon.json', 'G2,G3', 'L1'],
  'C1.2': ['ARCH,PL,BK', 'check-occlusion', 'J-adv×2+J-valid', 'docs/eval/occlusion.json', 'G2', 'L1'],
  'C1.3': ['PB,SK', 'thumb,silhouette', 'J-blind×5 +RC', 'docs/eval/thumb.json', 'G7', 'L2/Dh'],
  'C2.1': ['BK', 'check-bike', 'J-lens×3+mech-faults', 'docs/eval/bike.json', 'G2', 'L1'],
  'C2.2': ['BK,ARCH', 'check-bike --drivetrain', 'J-lens', 'docs/eval/drivetrain.json', '', 'L1'],
  'C2.3': ['RIG-L,LAND', 'check-kinematics,check-noslip', '', 'docs/eval/kinematics.json', 'G4', 'L1'],
  'C2.4': ['BK,DA-drive', 'wagon', 'frame-direction', 'docs/eval/alias.json', 'G4', 'L1'],
  'C2.5': ['BK,DA-drive', 'check-bike --wheels', 'J-lens', 'docs/eval/bike.json', '', 'L1'],
  'C2.6': ['BK,DA-bikehw', 'check-bike --cockpit', 'J-lens', 'docs/eval/bike.json', '', 'L1'],
  'C2.7': ['BK,DA-bikehw,DA-drive,DA-cargo', 'shoot crops', 'J-mech+J-lens', 'docs/eval/mech-assembly.json', 'G-DETAIL', 'L1/Dx'],
  'C3.1': ['RIG-L,PL,BK,LAND', 'check-contacts,contact-probe', 'seam-hunt', 'docs/eval/contacts.json', 'G3', 'L1'],
  'C3.2': ['RIG-L,PB,BK', 'check-rig --seat', 'J-lens', 'docs/eval/seat.json', 'G3', 'L1'],
  'C3.3': ['RIG-L', 'check-rig --biomech', 'J-lens', 'docs/eval/biomech.json', '', 'L1'],
  'C3.4': ['RIG-A', 'motion-audit --events', 'hop-coast-dense', 'docs/eval/dynamics.json', '', 'L1'],
  'C4.1': ['PB,DA-head,DA-plume', 'thumb --head3x', 'J-blind×3+J-anat +RC', 'docs/eval/species.json', 'G7', 'L2/Dh'],
  'C4.2': ['PB,DA-head', 'check-anatomy --head', 'J-lens', 'docs/eval/anatomy-head.json', 'G7', 'L2/Dh'],
  'C4.3': ['PB,RIG-F', 'motion-audit --head', 'J-lens', 'docs/eval/anatomy-neck.json', '', 'L2'],
  'C4.4': ['PL,DA-plume', 'check-rig,check-anatomy --wing', 'J-lens', 'docs/eval/anatomy-wing.json', 'G7', 'L2/Dx'],
  'C4.5': ['PL,DA-legs', 'check-anatomy --legs', 'J-lens', 'docs/eval/anatomy-legs.json', 'G7', 'L2'],
  'C4.6': ['DA-plume,SK', 'check-style --colour', 'J-lens', 'docs/eval/anatomy-colour.json', '', 'L2/Di'],
  'C4.7': ['PB,PL,ARCH', 'check-anatomy --scale', '', 'docs/eval/anatomy-scale.json', '', 'L2'],
  'C5.1': ['RIG-L', 'motion-audit,cycle24', 'J-blind×3 speed-rank +RC', 'docs/eval/motion-audit.json', 'G10', 'L3/Dp'],
  'C5.2': ['RIG-L,RIG-A', 'motion-audit --lag,onion', 'dense-lag+J-lens +RC; user G16', 'docs/eval/motion-audit.json', 'G10', 'L3/Dp'],
  'C5.3': ['RIG-A', 'motion-audit --fuzz', 'J-lens', 'docs/eval/fuzz.json', 'G10', 'L3'],
  'C5.4': ['DIR,RIG-A', 'check-timing', 'name-events-ab', 'docs/eval/events.json', '', 'L3'],
  'C5.5': ['RIG-F,RIG-A', 'motion-audit --face', 'J-lens', 'docs/eval/avian-motion.json', '', 'L3'],
  'C5.6': ['RIG-A,FX,DIR', 'motion-audit --transitions', 'J-lens', 'docs/eval/transitions.json', '', 'L3'],
  'C6.1': ['DIR,PB,RIG-F', 'judge/acting', 'J-blind×3 adjectives+J-lens +RC', 'docs/character.md', '', 'L3'],
  'C6.2': ['RIG-F,PB', 'motion-audit --face', 'J-lens', 'docs/eval/face.json', '', 'L3'],
  'C6.3': ['RIG-A,DIR,FX', 'check-temporal', 'J-blind×5 gags +RC', 'docs/eval/temporal.json', '', 'L3'],
  'C6.4': ['RIG-A,PB,DA-cargo', 'motion-audit --gulp', 'J-lens', 'docs/eval/gulp.json', '', 'L3'],
  'C6.5': ['DIR', 'loop-seam,interact --idle', 'story-retell', 'docs/eval/idle.json', '', 'L3'],
  'C6.6': ['FX,DIR', 'sheet gulls', 'J-lens', 'shots/eval/gulls/', '', 'L3'],
  'C7.1': ['DIR,DA-print,ARCH', 'first-look', 'J-blind×5 opening +RC', 'docs/eval/first-look.json', 'G8', 'L4'],
  'C7.2': ['SK', 'check-style,judge/palette', 'J-lens +RC', 'docs/eval/palette.json', '', 'L4/Di'],
  'C7.3': ['SK,SKY,SEA,LAND,FX', 'judge/saliency', 'J-lens', 'docs/eval/saliency.json', '', 'L4'],
  'C7.4': ['DIR', 'judge/film', 'film-sheet×3', 'docs/eval/camera.json', 'G8', 'L4'],
  'C7.5': ['all art owners', 'judge/seams,judge/edges', 'J-adv×2+J-valid', 'docs/eval/zoom-defects.json', '', 'L4'],
  'C7.6': ['SK,PB,PL', 'check-style', 'J-blind×5 same-style +RC', 'docs/eval/style.json', '', 'L2+L4'],
  'C7.7': ['SK,DIR,DQM', 'judge/saliency', 'J-blind×5 appeal/delete +RC', 'docs/eval/appeal.json', '', 'L4/Dh'],
  'C8.1': ['MOMENT,ARCH,DIR', 'eggs.mjs,?moment=', 'J-blind×3 recall +RC', 'docs/eval/moment.json', 'D8-cap', 'L4/Dm'],
  'C8.2': ['all; FB baselines', 'field.mjs', 'J-blind×5 ≥40 pairs', 'docs/eval/field.json', '', 'L4'],
  'C8.3': ['DIR,ENCORE', 'judge/eggs', 'J-user explorer', 'docs/eval/explorer.json', '', 'L4/Dm'],
  'C8.4': ['AUD', 'audio-check,audio-offline', 'J-lens; user G16', 'docs/eval/audio.json', 'G11,G16', 'L5'],
  'C9.1': ['UI,DIR', 'ux-matrix', 'J-user×2 cold start', 'docs/eval/cold-start.json', '', 'L5'],
  'C9.2': ['UI', 'ux-matrix,contrast,judge/controls', 'J-lens', 'docs/eval/ux-matrix.json', '', 'L5'],
  'C9.3': ['UI,RIG-A', 'interact', 'J-lens', 'docs/eval/interact.json', '', 'L5'],
  'C9.4': ['UI', 'keys', 'J-lens code', 'docs/eval/keys.json', 'G12', 'L5'],
  'C9.5': ['UI,ARCH', 'a11y', 'J-a11y', 'docs/eval/a11y.json', 'G12', 'L5'],
  'C9.6': ['UI,ARCH,FX', 'flash-check,reduced-motion', '', 'docs/eval/flash.json', 'G11', 'L5'],
  'C9.7': ['DIR,UI', 'ux-matrix --mobile', 'J-lens', 'docs/eval/mobile.json', 'G8', 'L5'],
  'C9.8': ['UI,DA-print', 'i18n-lint,cjk-glyph,check-text', 'J-bi', 'docs/eval/i18n.json', 'G12', 'L5'],
  'C10.1': ['ARCH', 'perf', 'J-lens', 'perf/perf.json', 'G9', 'L5'],
  'C10.2': ['ARCH,band owners', 'perf --paint', 'J-lens', 'perf/paint.json', 'G9', 'L5'],
  'C10.3': ['ARCH', 'perf --js', '', 'perf/js.json', '', 'L5'],
  'C10.4': ['ARCH', 'soak', '', 'perf/soak.json', 'G10', 'L5'],
  'C10.5': ['ARCH', 'audit-dist', '', 'perf/dist-audit.json', 'G1', 'L5'],
  'C10.6': ['ARCH', 'xb-audit,xb-webkit', '', 'docs/eval/xb.json', '', 'L5'],
  'C10.7': ['ARCH', 'robust,contexts', '', 'docs/eval/robust.json', '', 'L5'],
  'C10.8': ['ARCH', 'console collector,fault-injection', '', 'docs/eval/console.json', 'G1', 'L5'],
  'C11.1': ['BAKE,MINI', 'check-baked --static,mini', 'J-blind×3 baked canon14; Dn field pairs', 'docs/eval/baked.json', 'G5', 'L5/Dn'],
  'C11.2': ['BAKE', 'check-baked,loop-seam', '', 'docs/eval/baked.json', 'G5', 'L5'],
  'C11.3': ['PKG', 'judge/package', 'J-lens+poster-knockout', 'docs/eval/package.json', 'G13', 'L5'],
  'C11.4': ['UI,BAKE', 'export-check,contexts', '', 'docs/eval/export.json', 'G13', 'L5'],
  'C11.5': ['PKG,Lead', 'check-docs', 'J-lens', 'README.md', 'G13,G15', 'L5'],
  'C12.1': ['ARCH', 'check-contract', 'J-lens', 'docs/eval/contract.json', '', 'L5'],
  'C12.2': ['RIG-L,RIG-F,RIG-A', 'check-rig,mutate-rig', '', 'docs/eval/rig.json', 'G3,G10', 'L1'],
  'C12.3': ['ARCH', 'determinism,vr', '', 'docs/eval/determinism.json', 'G10', 'L5'],
  'C12.4': ['ARCH,TS-judge', 'verify (fresh clone)', '', 'docs/eval/verify.txt', 'G14', 'L5'],
  'C12.5': ['PKG', 'verify-claims,readme-lint', 'J-lens claims audit', 'docs/claims.json', 'G6', 'L5'],
  'C12.6': ['SPEC', 'check-inspect', 'J-lens', 'docs/eval/inspect.json', '', 'L5'],
  'C12.7': ['Lead', 'ownership,coverage,isolation', 'J-lens×2 independent', 'docs/team/coverage.json', 'G14', 'L5'],
  'C12.8': ['TS-geo,RT', 'check-benchmark', 'J-lens', 'docs/eval/benchmark.json', 'G2', 'L1'],
  'C13.1': ['DQM,all DA,form owners', 'detail-inventory,detail-parity,detail-diff', 'J-detail×2; DV; DV-AUDIT; RC', 'docs/eval/detail-inventory.json', 'G-DETAIL', 'L2+L4/Dx'],
  'C13.2': ['DA-head,DA-plume,DA-legs,PL', 'zoom-coverage pelican', 'J-detail+J-lens catalogue +RC', 'docs/eval/zoom-coverage.json', 'G-DETAIL', 'L2/Dx'],
  'C13.3': ['DA-bikehw,DA-drive,DA-cargo', 'zoom-coverage bike,wagon', 'J-detail bike', 'docs/eval/zoom-coverage.json', 'G-DETAIL', 'L4/Dx'],
  'C13.4': ['DA-sea,DA-land,DA-sky', 'detail-inventory,check-scale,saliency', 'J-detail world', 'docs/eval/scale.json', 'G-DETAIL', 'L4'],
  'C13.5': ['DA-print', 'check-text,detail-inventory', 'J-lens', 'docs/eval/in-art-text.json', 'G-DETAIL', 'L4'],
  'C13.6': ['ARCH,SK,DQM', 'check-detail-budget,flicker,perf', 'J-blind×5 no-harm', 'docs/eval/detail-budget.json', 'G9,G-DETAIL', 'L4'],
}
const GATE_OWNERS = {
  G1: 'ARCH', G2: 'RIG-L,BK,PL,PB', G3: 'RIG-L,PL,BK', G4: 'RIG-L,BK,DA-drive,BAKE', G5: 'BAKE,MINI', G6: 'PKG',
  G7: 'PB,DA-head,PL,DA-plume', G8: 'DIR,UI', G9: 'ARCH', G10: 'RIG-L,RIG-F,RIG-A,ARCH', G11: 'UI,ARCH,AUD,FX', G12: 'UI,ARCH',
  G13: 'PKG,BAKE,Lead', G14: 'Lead,TS-judge,EL', G15: 'PKG,DA-print', G16: 'Lead', G17: 'ARCH', 'G-DETAIL': 'DQM,all DA,form owners',
}
const BLOCKING_GATES = ['G1', 'G3', 'G15', 'G17', 'check-benchmark']

// ───────────────────────────── roles ─────────────────────────────
const Q = 'node tools/quick.mjs'
const ROLES = {
  ARCH: { lane: 'A', shadow: false, criteria: ['C1.2', 'C10.1', 'C10.2', 'C12.1', 'C12.3', 'C12.4'],
    files: 'src/contract.js, CONTRACT.md, src/scene.js, src/main.js, src/core/{math,svg,bus,bakekit,bands,hooks,time,parts}.js, src/art/variants.js, src/index.dev.html, src/page.css, tools/{build,serve,merge-static}.mjs, budgets.json, docs/contract/**',
    accept: ['node tools/check-contract.mjs', 'node tools/ux-matrix.mjs --mobile --viewports 390x844,844x390,720x800', 'node tools/perf.mjs --query synthload=draft:3.5 --cams wide,close --runs 3 (≥55 fps, p95 ≤25 ms)', 'node tools/determinism.mjs --quick'],
    brief: 'A1: land all 18 rubric §13.1 contract changes plus TEAM.md §2.4 (parts + PART_Z, data-detail family, merge-static, band budgets, hooks incl. ?variant= ?synthload=draft:k ?solo ?crop, variants registry). A3: walking skeleton on z-bands (each band its own <svg> in a composited div, transform-only), placeholder art migrated to parts, portrait framing, BL-04/05/06/18. The perf canary must use the REAL draft-C path load (halftone dots, long d strings, weave), replicated k times per band — not random shapes. Afterwards: integration on-call, perf owner, contract windows at H6/H10/H14 only.' },
  'DIR': { lane: 'D', shadow: true, criteria: ['C5.4', 'C6.1', 'C6.5', 'C7.1', 'C7.4', 'C9.7'],
    files: 'docs/{character,timing,beats,composition}.md, docs/eggs.json, src/core/camera.js, src/director/{intro,autodirector,eggs,portrait}.js',
    accept: ['node tools/check-timing.mjs', 'node tools/first-look.mjs', 'node tools/loop-seam.mjs (≤1.2)', 'node tools/ux-matrix.mjs --cams wide,cinematic --inframe 1.0', 'node tools/check-docs.mjs --character'],
    brief: 'A2 (stage "A2"): character bible (name, age, temperament, 3 adjectives, none of the 6 generic cartoon words), 60 fps X-sheets per event, a 24 s story loop with ≤5 beats, composition (horizon lock L-horizon), an optional character sketch for the lead to show the user. X3 (stage "X3"): cold open, cameras incl. portrait and Artifact panel, idle auto-director via eventsLog only, eggs. You organise the moment duel but do not enter it. Title card never covers the rider.' },
  SK: { lane: 'D', shadow: true, criteria: ['C7.2', 'C7.6', 'C7.7', 'C4.6'],
    files: 'src/core/palette.js, src/art/kit/*.js, docs/style/{ink-sets.json,review-*.md}',
    accept: ['node tools/check-style.mjs --all', 'node tools/check-style.mjs --palette --tods all', 'node --test src/art/kit', 'node tools/judge/saliency.mjs --quick (≥1.4)'],
    brief: 'Ink sets are decided by the ink duel first (entry A is yours). Then K1: the style-C detail kit (scallop rows, feather fans, hatching, halftone bands for static layers only, weave, scales, rivets/bolts/springs, deco capitals, ticket dashes), every generator pure, seeded, with an LOD parameter, returning paths grouped by ink and wrapped by kit.detail(). Then style duty: every 2 h review the integ contact sheet; you hold a VETO over any detail or harvested item that steals focus or violates STYLE-C (write docs/style/review-<n>.md with the vetoed data-detail names).' },
  'RIG-L': { lane: 'R', shadow: true, criteria: ['C1.1', 'C2.3', 'C3.1', 'C3.2', 'C3.3', 'C5.1', 'C5.2', 'C12.2'],
    files: 'src/rig/{solve,ik,locomotion,secondary,presets}.js, src/rig/locomotion.test.js, src/art/debug-skeleton.js',
    accept: ['node tools/check-rig.mjs --seat --biomech --events', 'node --test src/rig', 'node tools/motion-audit.mjs --lag --quick', 'node tools/check-kinematics.mjs'],
    brief: 'Belly-seat contact ≤1 u on every analytic sample, KOPS, cog ≡ 3×crank incl. coasting, exact 24 s period, measurable pedal-stroke weight (pelvis low point in each downstroke), parent→child lag for pouch/crest/tail/scarf. Publish L-pose-fields v1 by H6. Expose 6 presets in presets.js for the pedal-feel duel (all must pass G3/G10).' },
  'RIG-F': { lane: 'R', shadow: false, criteria: ['C4.3', 'C5.5', 'C6.2'], files: 'src/rig/face.js, src/rig/face.test.js',
    accept: ['node --test src/rig/face.test.js', 'node tools/motion-audit.mjs --face --seconds 120'],
    brief: 'pose.gaze with targets (gulls, fish stand, glitter, camera on wave, cursor); nictitating-membrane blink sweeping front-to-back 100–200 ms, aperiodic 3–8 s; head saccades/holds; expression state machine. A bird, not a person in a bird suit.' },
  'RIG-A': { lane: 'R', shadow: true, criteria: ['C3.4', 'C5.3', 'C5.4', 'C6.3', 'C6.4', 'C9.3'], files: 'src/rig/events.js, src/rig/events.test.js',
    accept: ['node tools/check-rig.mjs --events', 'node tools/motion-audit.mjs --fuzz 300 --events --gulp', 'node tools/check-timing.mjs --events'],
    brief: 'Hop (≥8 frame crouch, parabola R²≥0.98, g within 2885±25%, wheels leave in order, landing overshoot), wave (far wing steers, bars respond 1–3°), bell (thumb/alula flick + nod), gulp (head back ≥40°, fish turns head-first, bulge travels down the neck), coast; events blend and interrupt; timings from docs/timing.md.' },
  FX: { lane: 'R', shadow: false, criteria: ['C6.6', 'C9.6', 'C13.1'], files: 'src/fx/*.js',
    accept: ['node tools/flash-check.mjs', 'node tools/detail-inventory.mjs --layer fx (≥10)', 'node tools/determinism.mjs --fx'],
    brief: 'fx is a pure function of (t, distance, events); species-true gulls (M wings, black tips with white mirrors, 2.5–4 Hz flap + glide); speed lines, dust, landing impact plate, drip droplets, wind bands; at most one screen-print pop per event, ≤6 frames. ≥10 fx detail lines.' },
  PB: { lane: 'P', shadow: true, criteria: ['C1.3', 'C4.1', 'C4.2', 'C4.3', 'C4.7', 'C3.2'], files: 'src/art/pelican-body.js',
    accept: ['node tools/check-anatomy.mjs --head --pouch-all-states', 'node tools/thumb.mjs --notext --sizes 256,128', `${Q} --solo pelican --crop head --pair-draft --dpr 3`, 'node tools/detail-inventory.mjs --owner PB (≥14)'],
    brief: 'Stage "form": L-silhouette by H4.5 (outline + anchor table), enter the head duel as entry A with the seed "faithful refinement of draft C" (see duel head), L-head-form by H7 with the winner, L-body-form by H9 (must pass the early species quick test). Solid paper-white body, content not fierce expression, pouch present in every state, neckD fixed command count. Stage "E2": pouch bulge, neck bulge and expressions for the rig events.' },
  PL: { lane: 'P', shadow: true, criteria: ['C1.2', 'C3.1', 'C4.4', 'C4.5', 'C7.6'], files: 'src/art/pelican-limbs.js',
    accept: ['node tools/check-anatomy.mjs --wing --legs', 'node tools/check-contacts.mjs --phases 12', 'node tools/check-occlusion.mjs --phases 12', 'node tools/detail-inventory.mjs --owner PL (≥11)'],
    brief: 'Feet and tarsus first (independent of the silhouette), then wings after L-silhouette: coverts merge into the flank, secondaries hang like a fringe, navy primaries sweep back from the wrist, ≥4 separate primary tips wrap the grip (no knuckles). Totipalmate feet flat on the pedal. Far side flat B/N. 0 seams over 12 phases.' },
  'DA-legs': { lane: 'P', shadow: false, criteria: ['C4.5', 'C13.2'], files: 'src/art/detail/legs.js',
    accept: ['node tools/detail-inventory.mjs --owner DA-legs (≥13 counted)', 'node tools/zoom-coverage.mjs --owner DA-legs', 'node tools/flicker.mjs --slots thigh*,shank*,foot*'],
    brief: 'Detail artist on legs and feet via parts (z 50–89): trouser feather edges, tarsus scale lines, toe segments, web folds, claws. Far side lines + flat ink only. 0 tears across 12 phases.' },
  'DA-head': { lane: 'P2', shadow: true, criteria: ['C4.2', 'C13.1', 'C13.2'], files: 'src/art/detail/head.js',
    accept: ['node tools/detail-inventory.mjs --owner DA-head (≥36 counted)', 'node tools/zoom-coverage.mjs --region head (≥0.97)', 'node tools/flicker.mjs --slots head,billUpper,billLower,pouch,crest'],
    brief: 'Head/neck detail via parts after L-head-form: culmen and tomium lines, nail highlight and hook, bare facial skin + eyelid + highlight, ≥7 crest filaments, pouch texture that stretches with sy (0 tears), neck plumage flow, scarf stripes/weave/fringe. Kit generators only.' },
  'DA-plume': { lane: 'P2', shadow: true, criteria: ['C4.4', 'C4.6', 'C13.1', 'C13.2'], files: 'src/art/detail/plume.js',
    accept: ['node tools/detail-inventory.mjs --owner DA-plume (≥26 counted)', 'node tools/zoom-coverage.mjs --region body (≥0.97)', 'node tools/check-style.mjs --layer pelican'],
    brief: 'Body/wing/tail detail via parts after L-body-form: ≥3 scallop covert rows overlapping toward the tail (data-tract), ≥8 countable primaries, secondaries with P edges, ≥5 tail feathers. The body stays solid paper white; halftone only as a narrow edge band with spacing ≥5.' },
  BK: { lane: 'B', shadow: false, criteria: ['C2.1', 'C2.2', 'C2.4', 'C2.5', 'C2.6'], files: 'src/art/bike.js',
    accept: ['node tools/check-bike.mjs --all', 'node tools/wagon.mjs --quick', 'node tools/check-benchmark.mjs --quick', 'node tools/detail-inventory.mjs --owner BK (≥44)'],
    brief: 'Frame and mechanics per contract BIKE geometry; integer chain; chainring before chain, spider after chain; spokes fade into a two-ink blur disc while valve and reflector keep true rotation. Publish zone locks frame→cockpit→wheels at H5/H7/H8.5.' },
  'DA-drive': { lane: 'B', shadow: false, criteria: ['C2.4', 'C13.3'], files: 'src/art/detail/drive.js',
    accept: ['node tools/detail-inventory.mjs --owner DA-drive (≥30 counted)', 'node tools/wagon.mjs --quick', 'node tools/flicker.mjs --rotating'],
    brief: 'Nipples, rim eyelets, valve cap, tread and sidewall, chain plates/pins/rollers, pedal cage and reflectors. Periodic detail fades with the spokes; wagon + flicker on every drop.' },
  'DA-bikehw': { lane: 'B', shadow: false, criteria: ['C2.6', 'C2.7', 'C13.3'], files: 'src/art/detail/bikehw.js',
    accept: ['node tools/detail-inventory.mjs --owner DA-bikehw (≥48 counted)', 'node tools/check-bike.mjs --cockpit'],
    brief: 'Lugs, BB shell, headset cups, housing + cable + clips, brake calipers and levers, fender stays and bolts, bell dome and lever, lamp lens and bracket, head badge, saddle springs/rivets/rails/clamp. Mounts must sit on tubes.' },
  'DA-cargo': { lane: 'B', shadow: false, criteria: ['C6.4', 'C13.3'], files: 'src/art/detail/cargo.js',
    accept: ['node tools/detail-inventory.mjs --owner DA-cargo (≥33 counted)', 'node tools/motion-audit.mjs --gulp --quick'],
    brief: 'Over-under basket weave, rim, base; ≥2 fish designs (mullet/tilapia-like: forked tail, dorsal and anal fins, operculum, silver) with scales and eyes; an occasional tail flop hooked to the gulp interface.' },
  SEA: { lane: 'W', shadow: false, criteria: ['C7.3', 'C13.4'], files: 'src/world/sea.js', accept: ['node tools/loop-seam.mjs --layer sea', 'node tools/check-scale.mjs --layer sea'], brief: 'Horizon per L-horizon, ≥3 sea bands, lighthouse beam at night, seamless tiles, data-size-m on every prop. Publish L-world-zones for sea.' },
  LAND: { lane: 'W', shadow: false, criteria: ['C2.3', 'C3.1', 'C13.4'], files: 'src/world/land.js', accept: ['node tools/check-contacts.mjs --foreground', 'node tools/loop-seam.mjs --layer land'], brief: 'Road top = GROUND_Y, TILE-seamless, foreground covers ≤8% of the wheel bottoms, contact region ≥70% visible. Publish L-world-zones for land.' },
  SKY: { lane: 'W', shadow: false, criteria: ['C7.3', 'C13.4'], files: 'src/world/sky.js', accept: ['node tools/check-style.mjs --layer sky', 'node tools/perf.mjs --band B-sky'], brief: 'Rays ~1°/s, glows quantised into 2–3 rings, night sky, no filters.' },
  'DA-sea': { lane: 'W', shadow: false, criteria: ['C13.4'], files: 'src/world/detail/sea.js', accept: ['node tools/detail-inventory.mjs --owner DA-sea (≥24 counted)', 'node tools/judge/saliency.mjs --quick (≥1.4)'], brief: 'Wave marks, foam lines, sun/moon path, pier and piles, rocks and surf, numbered buoys, rigged sailboats with flags, a fishing boat, sea birds; depth-graded density.' },
  'DA-land': { lane: 'W', shadow: false, criteria: ['C13.4'], files: 'src/world/detail/land.js', accept: ['node tools/detail-inventory.mjs --owner DA-land (≥76 counted)', 'node tools/check-scale.mjs --layer land', 'node tools/judge/saliency.mjs --quick (≥1.4)'], brief: 'Harbour town (windows lit at night, roofs, chimneys, clock tower), keeper hut, sea-wall masonry, guardrail/bollards/signs/bench/postbox/milestone, lamp details distinct from the draft, plants by species, cabanas/umbrellas, road markings and kerbs.' },
  'DA-sky': { lane: 'W', shadow: false, criteria: ['C13.4'], files: 'src/world/detail/sky.js', accept: ['node tools/detail-inventory.mjs --owner DA-sky (≥24 counted)'], brief: '≥3 cloud types, sun/moon halos, near and far bird flocks, constellations, a kite or distant plane.' },
  'DA-print': { lane: 'W', shadow: false, criteria: ['C13.5', 'C9.8', 'C7.1'], files: 'src/print/{frame,type,stamp,ticket}.js, src/print/glyphs.json, tools/glyphs.mjs', accept: ['node tools/detail-inventory.mjs --owner DA-print (≥36 counted)', 'node tools/cjk-glyph.mjs', 'node tools/check-text.mjs', 'node tools/first-look.mjs --title'], brief: 'Poster border + inner rule + corner ornaments, correct-glyph title slip (no fake seal carving), ticket notes, title inline + stepped shadow, registration marks and colour bars, small print numbering; all text to paths; letterbox in cinematic.' },
  UI: { lane: 'X', shadow: false, criteria: ['C9.1', 'C9.2', 'C9.3', 'C9.4', 'C9.5', 'C9.6', 'C9.8', 'C11.4'], files: 'src/ui/{ui,styles,keymap,i18n}.js',
    accept: ['node tools/keys.mjs', 'node tools/a11y.mjs --states all', 'node tools/i18n-lint.mjs', 'node tools/ux-matrix.mjs', 'node tools/export-check.mjs --sandbox'], brief: 'keymap.js is the single source for handlers, help and README table; G11/G12; 390 px bottom sheet; 0 overlap with the rider; downloads work or show a visible fallback in sandboxed iframes.' },
  AUD: { lane: 'X', shadow: false, criteria: ['C8.4'], files: 'src/audio/*.js', accept: ['node tools/audio-check.mjs', 'node tools/judge/audio-offline.mjs --seconds 30'], brief: 'createAudio(bus,{context}) with injectable OfflineAudioContext; 0 AudioContext before the user enables sound; bell attack ≤20 ms after the thumb flick; pawl tick rate = wheel rev/s × engagement points.' },
  PKG: { lane: 'X', shadow: false, criteria: ['C11.3', 'C11.5', 'C12.5'], files: 'README.md, docs/handoff.md, docs/THIRD_PARTY.md, LICENSE, docs/claims.json, tools/{webm,poster,contact-sheet,detail-compare}.mjs',
    accept: ['node tools/webm.mjs --sample 3', 'node tools/verify-claims.mjs', 'node tools/readme-lint.mjs', 'node tools/check-docs.mjs', 'node tools/detail-compare.mjs'], brief: 'Deterministic 60 fps webm (frames = duration×60), poster ≥3840×2160, contact sheet, bilingual README (Chinese first), claims.json for every number, font licences (G15), and the draft-vs-build detail comparison sheet for the user checkpoint. Prove the webm pipeline with a 3 s sample before H14.' },
  BAKE: { lane: 'X', shadow: false, criteria: ['C11.1', 'C11.2', 'C11.4'], files: 'src/bake/*.js, tools/bake.mjs', accept: ['node tools/bake.mjs', 'node tools/check-baked.mjs --static --phases 48', 'node tools/loop-seam.mjs --baked'], brief: 'SMIL bake working on placeholder art by H5, then follow real art; G5 in full; head crop mean abs diff vs live ≤6/255; ≤500 KB gzip.' },
  SPEC: { lane: 'X', shadow: false, criteria: ['C12.6'], files: 'src/inspect/*.js, src/mini/** (after the mini duel)', accept: ['node tools/check-inspect.mjs'], brief: 'X-ray inspect mode (skeleton, pivots, IK, detail heatmap, band plates), readouts from rendered DOM or labelled "solver". After the mini duel, wire src/mini/pelican-mini.svg into dist and <noscript>.' },
}
// lane → two slot chains (each chain runs sequentially; the two chains run in parallel)
const LANES = {
  D: [[['DIR', 'X3']], [['SK', 'kit'], ['SK', 'duty']]],
  R: [[['RIG-L'], ['RIG-F'], ['RIG-A']], [['FX']]],
  P: [[['PB', 'form'], ['PB', 'E2']], [['PL'], ['DA-legs']]],
  P2: [[['DA-head']], [['DA-plume']]],
  B: [[['BK'], ['DA-drive']], [['DA-bikehw'], ['DA-cargo']]],
  W: [[['SEA'], ['DA-sea'], ['DA-sky']], [['LAND'], ['SKY'], ['DA-land'], ['DA-print']]],
  X: [[['UI'], ['AUD'], ['PKG']], [['BAKE'], ['SPEC']]],
}
const LOCK_WAITS = {
  PL: ['L-contract-v1', 'L-silhouette (wings only)'], 'DA-head': ['L-head-form', 'L-ink'], 'DA-plume': ['L-body-form', 'L-ink'], 'DA-legs': ['L-body-form'],
  'DA-drive': ['L-bike-zones:wheels'], 'DA-bikehw': ['L-bike-zones:frame'], 'DA-cargo': ['L-bike-zones:cockpit'],
  SEA: ['L-horizon'], LAND: ['L-horizon'], SKY: ['L-horizon', 'L-ink'], 'DA-sea': ['L-world-zones:sea', 'L-ink'], 'DA-land': ['L-world-zones:land', 'L-ink'], 'DA-sky': ['L-world-zones:sky'], 'DA-print': ['L-print-frame'],
  FX: ['L-pose-fields v1'], 'RIG-F': ['L-pose-fields v1'], BAKE: ['walking skeleton'],
}

// ───────────────────────────── schemas ─────────────────────────────
const STR = { type: 'string' }, NUM = { type: 'number' }, BOOL = { type: 'boolean' }, STRS = { type: 'array', items: STR }
const REPORT = { type: 'object', properties: {
  owner: STR, files: STRS, drops: STRS, done: BOOL, detailLinesAdded: NUM, summary: STR,
  acceptance: { type: 'array', items: { type: 'object', properties: { cmd: STR, pass: BOOL, out: STR }, required: ['cmd', 'pass'] } },
  locksPublished: STRS, contractRequests: STRS, knownIssues: STRS },
  required: ['owner', 'acceptance', 'done'] }
const PACK = { type: 'object', properties: { dir: STR, criteria: STRS, canaryCount: NUM, decoy: STR, blindPacks: { type: 'array', items: { type: 'object', properties: { protocol: STR, dir: STR }, required: ['protocol', 'dir'] } }, notes: STR }, required: ['dir'] }
const VERDICTS = { type: 'object', properties: {
  judge: STR, rawPath: STR,
  observations: STRS,
  items: { type: 'array', items: { type: 'object', properties: { id: STR, pass: BOOL, evidence: STR, observation: STR }, required: ['id', 'pass', 'evidence'] } },
  flaggedDefects: { type: 'array', items: { type: 'object', properties: { file: STR, desc: STR, severity: STR }, required: ['file', 'desc'] } },
  answers: { type: 'array', items: { type: 'object', properties: { q: STR, a: STR }, required: ['q', 'a'] } },
  ranking: STRS },
  required: ['judge'] }
const PRELIM = { type: 'object', properties: {
  medians: { type: 'object', additionalProperties: NUM }, discardedJudges: STRS, extraJudgesNeeded: NUM,
  outlierDefects: { type: 'array', items: { type: 'object', properties: { criterion: STR, desc: STR, evidence: STR }, required: ['criterion', 'desc'] } },
  highCriteria: STRS },
  required: ['medians', 'highCriteria'] }
const DEFECTS = { type: 'object', properties: { defects: { type: 'array', items: { type: 'object', properties: { criterion: STR, desc: STR, evidence: STR, severity: STR }, required: ['criterion', 'desc', 'evidence'] } }, extrasClaimed: STRS }, required: ['defects'] }
const VALID = { type: 'object', properties: { validated: { type: 'array', items: { type: 'object', properties: { desc: STR, real: BOOL, severity: STR, rerender: STR }, required: ['desc', 'real'] } }, capBySeverity: { type: 'object', additionalProperties: NUM }, falsePositiveCalibrationOk: BOOL }, required: ['validated'] }
const SCORE = { type: 'object', properties: {
  round: STR, dims: { type: 'object', additionalProperties: NUM }, perCriterion: { type: 'object', additionalProperties: NUM },
  T: NUM, H: NUM, Tfinal: NUM, coreMin: NUM, critMin: NUM, gatesFail: STRS, rungC: BOOL, shadowBias: NUM,
  openUserComments: NUM, judgesDiscarded: NUM, scorecardPath: STR },
  required: ['round', 'dims', 'Tfinal', 'gatesFail'] }
const GATES = { type: 'object', properties: { pass: BOOL, failing: STRS, blocking: STRS, evidence: STRS, routed: { type: 'array', items: { type: 'object', properties: { owner: STR, issue: STR }, required: ['owner', 'issue'] } } }, required: ['pass', 'failing'] }
const PERF = { type: 'object', properties: { fpsWide: NUM, fpsClose: NUM, p95ms: NUM, load: STR, tracePath: STR }, required: ['fpsWide', 'fpsClose'] }
const AGG = { type: 'object', properties: { winner: STR, runnerUp: STR, ranking: STRS, projected: { type: 'object', additionalProperties: NUM }, btWinRate: NUM, decoyOk: BOOL, kendallTau: NUM, needMoreJudges: BOOL, judgesDiscarded: STRS, harvestCandidates: STRS }, required: ['winner', 'ranking'] }
const QUEUE = { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { id: STR, owner: STR, criterion: STR, loop: STR, gain: NUM, priority: NUM, stalls: NUM, kind: STR }, required: ['id', 'owner', 'criterion'] } }, stoppedLoops: STRS, stalledCriteria: STRS }, required: ['items'] }
const RUNG = { type: 'object', properties: {
  rung: STR, counts: { type: 'object', additionalProperties: NUM }, multiples: { type: 'object', additionalProperties: NUM },
  parityMissing: STRS, zoomPelican: NUM, zoomBike: NUM, fps: NUM, saliency: NUM, budgetOk: BOOL, flicker: NUM },
  required: ['rung', 'counts', 'multiples'] }
const DV = { type: 'object', properties: { perceivedMultiple: NUM, regionsMore: NUM, regionsBetter: NUM, canaryRecall: NUM, lowRegions: STRS, violations: STRS }, required: ['perceivedMultiple', 'regionsMore'] }
const AUDIT = { type: 'object', properties: { rejected: { type: 'array', items: { type: 'object', properties: { name: STR, reason: STR, severity: STR }, required: ['name', 'reason'] } }, majors: NUM }, required: ['rejected', 'majors'] }

// ───────────────────────────── prompt builders ─────────────────────────────
const STYLE = `风格 C（复古旅行海报，七墨丝网印刷）由用户选定：docs/STYLE-C.md 与 drafts/C-poster/{keyframe.png,closeup.png,gen.mjs}。用户原话："我需要你最终交付的版本细节比 draft 多很多"——细节是硬性要求。`
function commonPrompt(roleId, lane, stage, extra) {
  const r = ROLES[roleId]
  return `你是"鹈鹕湾"（Pelican Bay：一只大白鹈鹕沿海边公路骑自行车的交互式 SVG 动画）团队的 ${roleId}${stage ? `（阶段 ${stage}）` : ''}，车道 ${lane}，worktree ${wt(lane)}（所有命令都在该目录下运行）。
${STYLE}
必读：CONTRACT.md（v1）、docs/rig-spec.md、src/contract.js、docs/character.md、docs/composition.md、docs/locks/*.json、docs/detail/backlog/${roleId}.md（如有）、docs/rubric/creative-brief.md、TEAM.md 中你的那一行。
你拥有的文件：${r.files}。其余文件只读；需要别人改东西，写 docs/contract/requests/${roleId}-<n>.md。
开工前：node tools/governor.mjs wait && node tools/train-watch.mjs；再读 docs/team/lanes/${lane}.json（blockedBy、梯级、merge train 退回给你的失败）与 docs/team/queue/${roleId}.json（如有）。
等待锁点：${(LOCK_WAITS[roleId] || []).join('、') || '无'}（轮询 docs/locks/；等待时先做不依赖锁点的部分）。
循环（≥3 次视觉迭代）：改 → ${Q} --solo <part> --crop <region> --pair-draft --dpr 3 --tods golden,night（Read 生成的 PNG）→ node tools/drop.mjs（T0 + 受影响的 T1；红了就修，不许绕过）。每 3 次 drop 看一次 node tools/cycle24.mjs --lane ${lane}。
禁止：npm install、直接 git commit（只用 drop.mjs）、读 docs/eval/judges/**、运动部件上的 filter 或网点、Math.random、裸 hex、删除任何已登记的 data-detail 条目。
BRIEF：${r.brief}
验收（逐条运行，原样报告 pass/fail）：${r.accept.join(' ; ')}
你的 criterion：${r.criteria.join(', ')}（原子条目见 docs/rubric/items.json）。你永远不给自己打分。
${extra || ''}
本次会话做约 4 次 drop，或在全部验收通过时结束。返回结构化报告。`
}
function packPrompt({ kind, criteria, dims, round, tag, withWild, withHoldout, variants }) {
  return `你是 EL（评估负责人）的打包代理。在 ${ROOT}（integ 的当前提交）上运行：
node tools/judge/pack.mjs --kind ${kind} --tag ${tag}${round ? ` --round ${round}` : ''}${criteria ? ` --criteria ${criteria.join(',')}` : ''}${dims ? ` --dims ${dims.join(',')}` : ''}${variants ? ` --variants ${variants.join(',')}` : ''} --canaries 3 --degraded 1 --decoy draft-C${withWild ? ' --wild' : ''}${withHoldout ? ' --holdout sealed' : ''} --out-random
它会把证据包（按 rubric protocol.renderSets，去文字；canary 答案写进 docs/eval/keys/，不放进包里）复制到一个随机命名的临时目录，并对盲评包跑 blind-lint。检查包内确实没有可辨认文字（?notext=1），再返回 {dir, criteria, canaryCount, decoy, blindPacks[{protocol,dir}]}。不要打分。`
}
function lensPrompt({ dir, criteria, dim, round, adversarialExtra }) {
  return `你是全新的维度评审（J-lens${dim ? ` ${dim}` : ''}${round ? `，轮次 ${round}` : ''}）。你只能读取目录 ${dir}（证据包）以及其中 items.json 列出的原子条目；读包外任何文件都会让你的评判作废。你看不到构建者报告或以前的分数。
只评这些 criterion：${criteria.join(', ')}。规则：先写观察，再逐条目给出 pass/fail，每条都要引用 ≥1 个证据路径 + 一条具体观察；包里混有植入缺陷与一个降级版本，你不知道是哪些——把所有看到的缺陷都列进 flaggedDefects（文件名 + 描述 + 严重度 blocker/major/minor）。图像按原生比例阅读；联系表只用于序列问题。${adversarialExtra || ''}
返回结构化结果（rawPath 留空，由打分代理保存）。不要编辑任何文件。`
}
function blindPrompt({ dir, protocol }) {
  return `你是没有任何项目上下文的盲感知评审。只读目录 ${dir}：其中 QUESTIONS.md 是固定问卷（协议 ${protocol}），图片都是随机命名的 PNG。按 QUESTIONS.md 的顺序作答（先开放式识别，再清单，最后是强制选择 / 排序）；只计你的第一个答案；指出缺陷时必须说出一个可见特征和所在文件。把答案填进 answers[{q,a}]，排序题填 ranking（文件名从好到差）。不要读目录以外的任何东西。`
}
function advPrompt({ dir, criterion, median }) {
  return `你是 Red Court 的对抗评审（J-adv）。criterion ${criterion} 的中位分是 ${median}（≥9）。证据包：${dir}。你可以用 node ${ROOT}/tools/render.mjs 或 node ${ROOT}/tools/shoot.mjs --query "..." 在任意 t / 机位 / 时段重新渲染 dist 以核实（输出到 ${dir}/rerender/）。找出至少 5 个缺陷，每个都指向证据路径或重新渲染的图片，并说明可见特征与严重度。另外，列出任何评审声称通过、但你认为在 1× 下并不可见的 10 分额外项（extrasClaimed）。不要编辑源码。`
}
function validPrompt({ dir, defects }) {
  return `你是验证者（J-valid）。逐条核实下列缺陷是否真实：对照证据，必要时用 node ${ROOT}/tools/render.mjs 重新渲染（输出到 ${dir}/rerender/）。按 rubric scoring.severity 分级（blocker / major / minor）。列表里混入了 EL 植入的假缺陷用于校准你——不要附和。缺陷：${JSON.stringify(defects)}。返回 validated[{desc, real, severity, rerender}]，以及 capBySeverity（criterion → 封顶分：blocker 6、major 8）。`
}

// ───────────────────────────── shared machinery ─────────────────────────────
async function redCourt(dir, criterion, median, phaseName, labelBase) {
  const adv = await agent(advPrompt({ dir, criterion, median }), { label: `${labelBase}:adv:${criterion}`, phase: phaseName, schema: DEFECTS })
  if (!adv || !adv.defects?.length) return { criterion, cap: null, validated: [] }
  const val = await agent(validPrompt({ dir, defects: adv.defects }), { label: `${labelBase}:valid:${criterion}`, phase: phaseName, schema: VALID })
  const real = (val?.validated || []).filter(v => v.real)
  const cap = real.some(v => v.severity === 'blocker') ? 6 : real.some(v => v.severity === 'major') ? 8 : null
  return { criterion, cap, validated: real, extrasRejected: adv.extrasClaimed || [] }
}

// judge a set of criteria on one evidence pack: lens judges + special panels → prelim (recall/outliers/spread) → J-valid → Red Court → score
async function judgeCriteria({ dir, blindPacks, criteria, dim, round, nLens, specials, phases, labelBase, redCourtAll }) {
  const P = phases || { judge: 'Judge', validate: 'Validate', rc: 'Red Court' }
  const thunks = []
  for (let i = 0; i < nLens; i++) thunks.push(() => agent(lensPrompt({ dir, criteria, dim, round }), { label: `${labelBase}:lens${i + 1}`, phase: P.judge, schema: VERDICTS }))
  for (const sp of specials || []) {
    const bp = (blindPacks || []).find(b => b.protocol === sp.protocol)
    for (let i = 0; i < sp.n; i++) {
      if (sp.kind === 'lens' || sp.kind === 'adv' || sp.kind === 'detail') thunks.push(() => agent(lensPrompt({ dir: bp?.dir || dir, criteria, dim, round, adversarialExtra: ` 你的专门协议：${sp.protocol}（见 ${bp?.dir || dir}/PROTOCOL-${sp.protocol}.md）。${sp.kind === 'adv' ? '在"找出至少 5 个缺陷"的框架下工作。' : ''}` }), { label: `${labelBase}:${sp.kind}:${sp.protocol}:${i + 1}`, phase: P.judge, schema: VERDICTS }))
      else if (sp.kind === 'user') thunks.push(() => agent(`你是冷启动 / 探索测试者。只能通过 node ${ROOT}/tools/judge/harness.mjs（截图 + 指针 / 键盘 / 触控；没有 DOM、aria、evaluate 与源码）操作 dist。协议：${sp.protocol}（见 ${bp?.dir || dir}/PROTOCOL-${sp.protocol}.md）。把每一步的观察与截图路径写进 answers。`, { label: `${labelBase}:user:${sp.protocol}:${i + 1}`, phase: P.judge, schema: VERDICTS }))
      else thunks.push(() => agent(blindPrompt({ dir: bp?.dir || dir, protocol: sp.protocol }), { label: `${labelBase}:blind:${sp.protocol}:${i + 1}`, phase: P.judge, schema: VERDICTS }))
    }
  }
  let verdicts = (await parallel(thunks)).filter(Boolean)     // barrier: prelim needs every judge of this pack
  let prelim = null
  for (let pass = 1; pass <= 3; pass++) {
    prelim = await agent(`你是 EL 的打分代理。把下面这些评审输出逐个保存到 ${ROOT}/docs/eval/raw/${round || 'shadow'}/${labelBase}/<judge>-p${pass}.json，然后运行 node tools/score.mjs --prelim --pack ${dir} --raw docs/eval/raw/${round || 'shadow'}/${labelBase} --criteria ${criteria.join(',')}。它会：用 docs/eval/keys/ 中的答案计算每名评审的 canary 召回率（<80%，或没给降级版本低 ≥2 分，就作废）；在盲评中检查诱饵排名；把比中位低 ≥2 分的离群评审引用的缺陷列出来；对极差 >2 的 criterion 要求追加 2 名评审；对 Bradley–Terry 部分做聚类 bootstrap。返回 medians、discardedJudges、extraJudgesNeeded、outlierDefects、highCriteria（中位 ≥9）。评审输出：${JSON.stringify(verdicts)}`,
      { label: `${labelBase}:prelim${pass}`, phase: P.validate, schema: PRELIM, effort: 'low' })
    if (!prelim) break
    const extra = (prelim.extraJudgesNeeded || 0) + (prelim.discardedJudges?.length || 0)
    if (!extra || pass === 3) break
    const more = await parallel(Array.from({ length: Math.min(extra, 4) }, (_, i) => () =>
      agent(lensPrompt({ dir, criteria, dim, round }), { label: `${labelBase}:lens-extra-p${pass}-${i + 1}`, phase: P.judge, schema: VERDICTS })))
    verdicts = verdicts.concat(more.filter(Boolean))
  }
  let outliers = []
  if (prelim?.outlierDefects?.length) {
    const v = await agent(validPrompt({ dir, defects: prelim.outlierDefects }), { label: `${labelBase}:valid-outliers`, phase: P.validate, schema: VALID })
    outliers = (v?.validated || []).filter(x => x.real)
  }
  const high = redCourtAll ? criteria : (prelim?.highCriteria || [])
  const rc = (await parallel(high.map(c => () => redCourt(dir, c, prelim?.medians?.[c] ?? 9, P.rc, labelBase)))).filter(Boolean)
  return { verdicts, prelim, outliers, redCourt: rc }
}

async function gatePrecheck(round, labelBase, phaseName) {
  return agent(`你是 EL 的门槛代理。在 ${ROOT} 的 integ 提交上按"便宜的先跑、失败就停"运行：node tools/build.mjs && node tools/gate-run.mjs --tiers T0,T1${round && round !== 'shadow' ? ',T2' : ''}${round === 'Rfinal' ? ',T3' : ''} --report docs/eval/gates-${round}.json（内部依次调用 audit-dist、check-purity、check-rig、check-anchors、check-contacts、check-benchmark、check-docs……，结果走 gatecache）。返回 pass、failing（门槛 id）、blocking（${BLOCKING_GATES.join(', ')} 中失败的）、evidence 路径，以及 routed[{owner, issue}]（按 docs/team/owners.json 把失败派给 owner）。`,
    { label: `${labelBase}:gates`, phase: phaseName, schema: GATES, effort: 'low' })
}

// one owner = a sequence of agent sessions until DoD (+ shadow judge for perceptual-core owners)
async function runOwner(roleId, stage, lane, extraNote) {
  const role = ROLES[roleId]
  let last = null, feedback = ''
  let shadows = 0
  for (let i = 1; i <= MAX_ITER; i++) {
    last = await agent(commonPrompt(roleId, lane, stage, `${extraNote || ''}\n迭代 ${i}/${MAX_ITER}。${feedback}`),
      { label: `${lane}:${roleId}${stage ? ':' + stage : ''}:i${i}:${TAG}`, phase: 'Build', schema: REPORT })
    if (!last) continue
    const accepted = last.done && (last.acceptance || []).every(a => a.pass)
    if (!accepted) { feedback = `上一会话未通过的验收：${JSON.stringify((last.acceptance || []).filter(a => !a.pass))}；已知问题：${JSON.stringify(last.knownIssues || [])}`; continue }
    if (!role.shadow || shadows >= 2) break
    shadows++
    const pk = await agent(packPrompt({ kind: 'shadow', criteria: role.criteria, tag: `${roleId}-s${shadows}-${TAG}` }), { label: `shadow:${roleId}:pack${shadows}`, phase: 'Shadow', schema: PACK, effort: 'low' })
    if (!pk?.dir) break
    const j = await judgeCriteria({ dir: pk.dir, blindPacks: pk.blindPacks, criteria: role.criteria, round: 'shadow', nLens: 1, specials: [], labelBase: `shadow:${roleId}:${shadows}`, phases: { judge: 'Shadow', validate: 'Shadow', rc: 'Shadow' } })
    const med = j.prelim?.medians || {}
    const capped = Object.fromEntries(Object.entries(med).map(([c, s]) => { const rc = j.redCourt.find(r => r.criterion === c); return [c, rc?.cap ? Math.min(s, rc.cap) : s] }))
    const minShadow = Math.min(...Object.values(capped).concat([10]))
    log(`shadow ${roleId}#${shadows}: ${JSON.stringify(capped)}`)
    if (minShadow >= 8.5) break
    feedback = `影子评审（不计分）发现：分数 ${JSON.stringify(capped)}；Red Court 已核实的缺陷 ${JSON.stringify(j.redCourt.flatMap(r => r.validated))}；离群评审核实的缺陷 ${JSON.stringify(j.outliers)}。优先修 <8.5 的条目。`
  }
  return last
}

function rungPass(r, m) {
  const R = RUNGS[r], f = []
  const mult = m.multiples || {}, cnt = m.counts || {}
  if (R.parity && (m.parityMissing || []).length) f.push(`parity missing ${m.parityMissing.length}`)
  if (R.total && (cnt.all || 0) < R.total) f.push(`total ${cnt.all} < ${R.total}`)
  if (R.perLayer) for (const L of ['sea', 'land', 'sky', 'typography_frame']) if ((mult[L] || 0) < R.perLayer) f.push(`${L} ${mult[L]} < ${R.perLayer}`)
  if (R.pelican && (mult.pelican || 0) < R.pelican) f.push(`pelican ${mult.pelican}`)
  if (R.bike && (mult.bike || 0) < R.bike) f.push(`bike ${mult.bike}`)
  if (R.fx && (cnt.fx || 0) < R.fx) f.push(`fx ${cnt.fx}`)
  if (R.zoomPelican && (m.zoomPelican || 0) < R.zoomPelican) f.push(`zoom pelican ${m.zoomPelican}`)
  if (R.zoomBike && (m.zoomBike || 0) < R.zoomBike) f.push(`zoom bike ${m.zoomBike}`)
  if (R.fps && (m.fps || 0) < R.fps) f.push(`fps ${m.fps}`)
  if (R.saliency && (m.saliency || 0) < R.saliency) f.push(`saliency ${m.saliency}`)
  if (R.dv && (m.dv || 0) < R.dv) f.push(`DV multiple ${m.dv}`)
  if (R.dvRegionsMore && (m.dvRegionsMore || 0) < R.dvRegionsMore) f.push(`DV regions ${m.dvRegionsMore}`)
  if (R.auditMajor !== undefined && (m.auditMajors || 0) > R.auditMajor) f.push(`audit majors ${m.auditMajors}`)
  if (r !== '0' && m.budgetOk === false) f.push('detail budget')
  if ((r === 'b' || r === 'c') && (m.flicker || 0) > 0) f.push(`flicker ${m.flicker}`)
  return { pass: f.length === 0, failures: f }
}
function entryOK(s) {
  if (!s) return false
  const bias = Math.max(0, s.shadowBias || 0)
  return (s.gatesFail || []).length === 0 && s.rungC === true && DIMS.every(d => (s.dims?.[d] ?? 0) >= ENTRY.dimMin + bias) &&
    s.Tfinal >= ENTRY.total && (s.coreMin ?? 0) >= ENTRY.coreMin && (s.critMin ?? 0) >= ENTRY.critMin && !(s.openUserComments > 0)
}
function targetMet(s) {
  return !!s && (s.gatesFail || []).length === 0 && DIMS.every(d => (s.dims?.[d] ?? 0) >= TARGET.dimMin) && s.Tfinal >= TARGET.totalMin && (s.critMin ?? 0) >= TARGET.critMin && (s.coreMin ?? 0) >= TARGET.coreMin
}
function loopStop(s, L) {
  const crit = Object.entries(s.perCriterion || {}).filter(([c]) => LOOPS[L].dims.includes(COVERAGE_DIM(c)) || LOOPS[L].extra.includes(c))
  const bias = Math.max(0, s.shadowBias || 0)
  return LOOPS[L].dims.every(d => (s.dims?.[d] ?? 0) >= ENTRY.dimMin + bias) && crit.every(([c, v]) => v >= 8 && (!CORE.includes(c) || v >= ENTRY.coreMin))
}
function COVERAGE_DIM(c) { return 'D' + c.slice(1).split('.')[0] }

// ───────────────────────────── modes ─────────────────────────────
async function modeFreeze() {
  phase('Freeze')
  const [arch, dir] = await parallel([
    async () => {
      let r = await agent(commonPrompt('ARCH', 'A', 'A1', '本会话只做 A1（契约 v1），完成后发布 docs/locks/L-contract-v1.json。'), { label: `A:ARCH:A1:${TAG}`, phase: 'Freeze', schema: REPORT })
      for (let i = 1; i <= 3; i++) {
        r = await agent(commonPrompt('ARCH', 'A', 'A3', `本会话做 A3（步行骨架 + 真实负载金丝雀）。第 ${i} 次尝试。${i > 1 ? '上次金丝雀没过：先修架构（合成层划分、merge-static、骑者带节点数），不要加美术。' : ''}`), { label: `A:ARCH:A3:i${i}:${TAG}`, phase: 'Freeze', schema: REPORT })
        const perf = await agent(`你是独立的性能验证者（不是 ARCH）。在 ${ROOT} 上拿 /tmp/pb-cpu.lock，运行 node tools/perf.mjs --query synthload=draft:3.5 --cams wide,close --runs 3 --dpr 1 --size 1600x900，报告 trace 呈现帧率（Display::DrawAndSwap）的中位数与 p95 帧间隔，并确认负载来自 drafts/C-poster 的真实路径（查看 perf/perf.json 中的 load 字段）。`, { label: `A:canary:i${i}:${TAG}`, phase: 'Freeze', schema: PERF, effort: 'low' })
        log(`canary ${i}: wide ${perf?.fpsWide} close ${perf?.fpsClose} p95 ${perf?.p95ms}`)
        if (perf && perf.fpsWide >= 55 && perf.fpsClose >= 55 && (perf.p95ms ?? 99) <= 25) return { report: r, perf, degraded: false }
      }
      log('canary failed 3×: degrade to ≤4 G17-compliant raster caches for static bands (TEAM.md §5.1)')
      const deg = await agent(commonPrompt('ARCH', 'A', 'A3-degrade', '金丝雀 3 次未过。实现降级：静态 band 预光栅缓存（≤4 个，data-src-hash = SVG 子树哈希，?nocache=1 像素差 ≤0.5%，check-purity 通过），再跑一次金丝雀。'), { label: `A:ARCH:degrade:${TAG}`, phase: 'Freeze', schema: REPORT })
      return { report: deg, perf: null, degraded: true }
    },
    () => runOwner('DIR', 'A2', 'A', '本会话只做 A2（导演文档 + L-horizon），发布 docs/locks/L-horizon.json 与 L-print-frame 草案。'),
  ])
  return { arch, dir }
}

const TOOL_QUEUES = {
  T0: [
    ['TS-perf', 'tools/lib/{shotd,lock,gatecache,console}.mjs + gatemap.json; shoot.mjs uses shotd with a semaphore-guarded fallback; fixes BL-07/BL-16'],
    ['TS-perf', 'tools/quick.mjs, tools/cycle24.mjs, tools/perf.mjs (+ --band --paint --js, synthload=draft:k from real draft paths), tools/live-parity.mjs'],
    ['TS-detail', 'tools/reink.mjs, tools/detail-inventory.mjs (--layer --owner, prints rejection reasons), tools/detail-parity.mjs, tools/detail-diff.mjs (--no-negative), tools/zoom-coverage.mjs, registry lint'],
    ['TS-geo', 'tools/check-anchors.mjs (+ anchor audit), check-occlusion.mjs, check-contacts.mjs, check-benchmark.mjs (+ mutant gallery)'],
    ['TS-motion', 'tools/check-rig.mjs (--seat --biomech --events), determinism.mjs, check-baked.mjs (--static)'],
    ['TS-ux', 'tools/first-look.mjs, ux-matrix.mjs, a11y.mjs (pinned axe-core), keys.mjs, flash-check.mjs'],
    ['TS-perf', 'tools/check-style.mjs is TS-detail; here: check-purity.mjs, audit-dist.mjs, gate-run.mjs (tiers T0–T3 with gatecache)'],
    ['TS-judge', 'tools/score.mjs (--prelim --items-only --owner --subset --merge), coverage.mjs (reads COVERAGE from docs/team/wf-build.v1.js), tool-validity.mjs, verify.mjs'],
    ['TS-judge', 'tools/judge/{pack,harness,canary,redcourt}.mjs, tools/blind-lint.mjs, tools/tourney/{pack,bt,graft-check}.mjs'],
    ['TS-detail', 'tools/check-style.mjs (7 inks + ink-on-ink halftone, --palette relative colour constraints, --layer)'],
  ],
  T1: [
    ['TS-geo', 'tools/wagon.mjs, check-anatomy.mjs, check-scale.mjs'], ['TS-perf', 'tools/flicker.mjs, check-detail-budget.mjs'],
    ['TS-geo', 'tools/check-bike.mjs, check-kinematics.mjs, check-noslip.mjs, contact-probe.mjs'],
    ['TS-motion', 'tools/motion-audit.mjs (--fuzz --events --face --lag --gulp --transitions), filmstrip.mjs --dense, onion.mjs, check-temporal.mjs, check-timing.mjs, mutate-rig.mjs'],
    ['TS-motion', 'tools/vr.mjs (--locality), loop-seam.mjs'], ['TS-judge', 'tools/judge/{palette,saliency,seams,edges,acting,controls,detail-pairs,wild,package}.mjs, thumb.mjs, silhouette.mjs'],
    ['TS-perf', 'tools/soak.mjs, robust.mjs, contexts.mjs, xb-audit.mjs'], ['TS-ux', 'tools/interact.mjs, contrast.mjs, i18n-lint.mjs, cjk-glyph.mjs, check-text.mjs, audio-check.mjs, judge/audio-offline.mjs, export-check.mjs'],
    ['TS-judge', 'tools/check-inspect.mjs, check-docs.mjs, check-contract.mjs, verify-claims.mjs, readme-lint.mjs, field.mjs, predict.mjs'],
  ],
  T2: [['TS-perf', 'tools/xb-webkit.mjs, soak 60 min mode'], ['TS-judge', 'tools/judge/{film,eggs}.mjs'], ['TS-ux', 'audible webm via WebCodecs (optional)']],
}
async function modeTools() {
  phase('Tools')
  const q = TOOL_QUEUES[A.queue || 'T0']
  const res = await pipeline(q,
    ([owner, what], _o, i) => agent(`你是工具匠 ${owner}，在 worktree ${wt('tools')} 工作。${STYLE}
任务 ${i + 1}/${q.length}：实现 ${what}。遵循 rubric.json 中对应工具的 measurement 定义与 CONTRACT.md；工具从自身路径解析 ROOT（不得写死 /home/user 或 /opt/node22）；所有 Playwright 工具通过 tools/lib/shotd.mjs（不可用时走 lock.mjs 3 槽信号量的回退）。为每个工具写 test/fixtures/<tool>/{good,mutants}/ 与 node --test 用例。完成后用 node tools/drop.mjs 提交。返回结构化报告。`,
      { label: `tools:${owner}:${i + 1}:${TAG}`, phase: 'Tools', schema: REPORT }),
    (rep, [owner, what], i) => agent(`你是独立的工具有效性检验者（不是作者）。对刚完成的工具（${what}）运行 node tools/tool-validity.mjs --tools <这些工具>：已知良好 fixture 必须通过、mutant 集必须全部失败、连续两次结论相同。报告每个工具的 pass/fail。作者报告：${JSON.stringify(rep || {})}`,
      { label: `tools:validity:${i + 1}:${TAG}`, phase: 'Tools', schema: REPORT, effort: 'low' }),
    async (val, [owner, what], i) => {
      if (val?.done && (val.acceptance || []).every(a => a.pass)) return val
      return agent(`你是工具匠 ${owner}。tool-validity 未通过：${JSON.stringify((val?.acceptance || []).filter(a => !a.pass))}。修复 ${what} 直到 node tools/tool-validity.mjs 对它们全绿，然后 drop。`, { label: `tools:${owner}:fix${i + 1}:${TAG}`, phase: 'Tools', schema: REPORT })
    })
  return res
}

async function modeField() {
  phase('Field')
  const FIELD = `${WTROOT}/field/pelican-bicycle`
  const tasks = [
    ['FB1', '用 60–90 分钟，做一个"鹈鹕骑自行车"的 SVG 动画网页（单个自包含 HTML）。尽你所能做好。'],
    ['FB2', '用 60–90 分钟，做一个"鹈鹕骑自行车"的 SVG 动画网页（单个自包含 HTML）。尽你所能做好。'],
    ['FB3', '用 60–90 分钟，做一个"鹈鹕骑自行车"的 SVG 动画网页（单个自包含 HTML）。尽你所能做好。'],
    ['SS', '一次性（不迭代、不截图）写一个会动的"鹈鹕骑自行车"SVG（单个 .svg 文件，≤16 KB，SMIL 动画）。'],
  ]
  const base = await pipeline(tasks,
    ([id, task]) => agent(`${task} 工作目录：${FIELD}/field/${id === 'SS' ? 'single-shot' : 'baseline/' + id.slice(2)}/（只写这里）。你可以用 Playwright（node_modules 已就绪）截图自检${id === 'SS' ? '——但本任务要求一次成稿，不要自检' : ''}。不要读取 ${FIELD} 之外的任何文件。返回你产出的文件列表与一句说明。`,
      { label: `field:${id}:${TAG}`, phase: 'Field' }),
    (out, [id]) => agent(`你是 TS-judge。把 ${FIELD}/field/ 下 ${id} 的产物复制到 ${ROOT}/docs/eval/field-baseline/${id}/，计算 sha256 写入 MANIFEST.json，并确认产物不引用外部资源。`, { label: `field:freeze:${id}:${TAG}`, phase: 'Field', effort: 'low' }))
  const rt = await agent(`你是红队缺陷作者 RT。你没看过 tools/check-*，只读 CONTRACT.md 与钩子文档。在 ${wt('field')} 之外、主树的 src/mutants/{art,foils}.js 中实现 ≥10 个经 ?mutant= 注册的美术级缺陷（脚美术平移 3 u、前叉旋转 2°、腹部画高 3 u、链条走错一侧、车轮倒转、肩部缝、缺 nail、远腿在前……）与诱饵（nopouch、stork、goose、草稿 C 同部件），写 test/redteam/defects.json（答案，只给 EL）。用 drop.mjs 提交到 lane/tools。`,
    { label: `field:RT:${TAG}`, phase: 'Field', schema: REPORT })
  return { base, rt }
}

async function modeR0() {
  phase('R0')
  const tasks = [
    'tool-validity：对全部 T0 gate 工具运行 node tools/tool-validity.mjs --all，写 docs/eval/tool-validity.json，然后 node tools/tool-lock.mjs 哈希锁定',
    '基线：node tools/detail-inventory.mjs --draft drafts/C-poster 复核 docs/rubric/detail-baseline-C.json 的 129 条，按"取大"规则锁定哈希；核实 baseline.knownDefects（BL-*），已解决的标 resolved-before-R0 并附证据',
    '墨组：把 duel ink 的胜者写入 docs/eval/ink-sets.json 并哈希冻结（之后只能改色值，不能加墨）；给 items.json 的 10 分额外项标注难度',
    '探针：合成面积探针、WebKit 与 librsvg 可用性，按 N/A 政策出 docs/eval/na.json；准备 Artifact 发布探针页 docs/eval/publish-probe.html（由 Lead 发布并回读）',
    '密封留出集：node tools/judge/wild.mjs --seal 生成 R-final 的留出集与野卡包，只把哈希写入 docs/eval/holdout.sha256；确认 RT 的缺陷已入库且 check-benchmark 对它们 100% 标红',
  ]
  const res = await pipeline(tasks, (t, _o, i) => agent(`你是 EL（评估负责人），执行 R0 的第 ${i + 1} 项：${t}。工作目录 ${ROOT}。只写 docs/eval/**（以及锁文件）。返回结构化报告。`, { label: `R0:${i + 1}:${TAG}`, phase: 'R0', schema: REPORT }))
  return res
}

async function modeLane() {
  const lane = A.lane
  const chains = LANES[lane]
  if (!chains) throw new Error(`unknown lane ${lane}`)
  phase('Build')
  const results = await parallel(chains.map(chain => async () => {       // two slot chains, each sequential (pipeline by lock points, no barrier between owners)
    const out = []
    for (const [roleId, stage] of chain) out.push(await runOwner(roleId, stage, lane, A.notes?.[roleId]))
    return out
  }))
  const flat = results.flat().filter(Boolean)
  log(`lane ${lane}: ${flat.map(r => `${r.owner}:${r.done ? 'done' : 'open'}`).join(' ')}`)
  return flat
}

// ── duels ──
const DUELS = {
  ink: { criteria: ['C7.2', 'C4.6', 'C7.6'], blind: { n: 5, protocol: 'ink-print-and-night' }, lensN: 1, harvest: false,
    entrants: [{ id: 'A', role: 'SK', files: 'src/candidates/ink/A/ink-sets.js', seed: '忠实沿用草稿 C 的黄金时刻七墨，并把其余 5 个时段推到"限色印刷"' }, { id: 'B', role: 'INK-CH', files: 'src/candidates/ink/B/ink-sets.js', seed: '同样的七个墨色角色，夜间做成真正的"夜间海报"（不是暗化的白天）' }],
    gates: 'node tools/check-style.mjs --palette --variant ink:<E> && node tools/contrast.mjs --variant ink:<E>',
    context: '在换墨后的草稿 C 上评（node tools/reink.mjs --variant ink:<E> --tods all），不依赖新美术；H6 必须结束。' },
  head: { criteria: ['C1.3', 'C4.1', 'C4.2', 'C7.7', 'C13.2'], blind: { n: 5, protocol: 'whole-bird-species-appeal-expression' }, lensN: 1, harvest: true, harvestMax: 3,
    entrants: [{ id: 'A', role: 'PB', files: 'src/candidates/head/A/*.js', seed: '忠实精修草稿 C：保留桃色长喙、琥珀喉囊、白冠，去掉凶眼线，表情满足' }, { id: 'B', role: 'HEAD-CH', files: 'src/candidates/head/B/*.js', seed: '风格 C 之内的博物准确：P. onocrotalus 的面部裸皮形状、额羽尖、喉囊下缘走向' }],
    gates: 'node tools/check-style.mjs --variant head:<E> && node tools/check-anatomy.mjs --head --variant head:<E> && node tools/check-anatomy.mjs --pouch-sy 0.9,1.2,1.45 --variant head:<E>',
    context: '两个头挂在同一个身体形体（L-silhouette）上，在整只鸟的 hero、12 相位 close 与 256/128 px notext 上评——不评孤立的头部裁图。H6.5 必须结束，胜者成为 L-head-form。' },
  moment: { criteria: ['C8.1', 'C8.3'], blind: { n: 3, protocol: 'moment-open-recall-seen-before' }, lensN: 1, harvest: false, concept: { keep: 2, blindN: 3 }, runnerUp: 'ENCORE',
    entrants: [{ id: 'A', role: 'MOM-A', files: 'src/candidates/moment/A/**', seed: '"分色"：z-band 像七块网版一样按墨错开，骑者穿过错开的网版，在铃声中"咔"地重新对准；只用合成层 transform' }, { id: 'B', role: 'MOM-B', files: 'src/candidates/moment/B/**', seed: '"蓝图化"：画面逐笔变成它自己的工程蓝图，再印回海报' }, { id: 'C', role: 'MOM-C', files: 'src/candidates/moment/C/**', seed: '由你自提：定制、不显然、切题，揭示作品的架构或故事；不得照搬 creative-brief 的示例' }],
    gates: 'node tools/eggs.mjs --variant moment:<E> --contexts idle,hop,tod0.93,390x844 && node tools/perf.mjs --variant moment:<E> --quick (≥55 fps)',
    context: '默认体验中 60 s 内无需输入就会出现。概念阶段只交 docs/candidates/moment/<E>/concept.md + 3 张分镜。' },
  mini: { criteria: ['C11.1'], blind: { n: 5, protocol: 'field-pairs-vs-single-shot' }, lensN: 0, harvest: false,
    entrants: [{ id: 'A', role: 'MINI-A', files: 'src/candidates/mini/A/pelican-mini.svg', seed: '海报剪影' }, { id: 'B', role: 'MINI-B', files: 'src/candidates/mini/B/pelican-mini.svg', seed: '机械精确' }, { id: 'C', role: 'MINI-C', files: 'src/candidates/mini/C/pelican-mini.svg', seed: '表演性' }],
    gates: 'node tools/check-baked.mjs --mini src/candidates/mini/<E>/pelican-mini.svg (≤16 KB, SMIL, animates as <img>) && node tools/check-benchmark.mjs --svg src/candidates/mini/<E>/pelican-mini.svg',
    context: '只能手写（转录哈希记入 ledger）；对照组是 docs/eval/field-baseline/SS（同模型单次生成）。' },
  preset: { criteria: ['C5.1', 'C5.2'], blind: { n: 3, protocol: 'speed-rank-weight' }, lensN: 1, harvest: false, noBuild: true,
    entrants: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'].map(id => ({ id, role: 'RIG-L', files: 'src/rig/presets.js', seed: id })),
    gates: 'node tools/check-rig.mjs --preset <E> && node tools/motion-audit.mjs --fuzz 60 --preset <E>',
    context: '参数锦标赛：RIG-L 的 6 组预设；另 1 名评审看 RS-onion 洋葱皮判滞后与拖曳。' },
}
const DETAIL_REGIONS = [
  { id: 'head', owner: 'DA-head', criteria: ['C13.2', 'C4.2'] },
  { id: 'body', owner: 'DA-plume', criteria: ['C13.2', 'C4.4', 'C4.6'] },
  { id: 'drive', owner: 'DA-drive', criteria: ['C13.3', 'C2.4', 'C2.7'] },
]
function detailDuelSpec(region) {
  return { criteria: region.criteria, blind: { n: 3, protocol: 'detail-draft-A-B-better-then-more' }, lensN: 1, harvest: true, harvestMax: 8, betterFirst: true,
    entrants: [{ id: 'A', role: region.owner, files: `src/art/detail/* (variant detail-${region.id}:A = current trunk)`, seed: '现有主干版本（主作者继续加强）', incumbent: true },
      { id: 'B', role: 'DA-CH', files: `src/candidates/detail-${region.id}/B/*.js`, seed: '风格 C 之内的"印刷装饰"或"博物 / 机械准确"（与主作者取向相反的那一个）' }],
    gates: `node tools/check-style.mjs --variant detail-${region.id}:<E> && node tools/check-detail-budget.mjs --variant detail-${region.id}:<E> --max 1.10 && node tools/wagon.mjs --quick --variant detail-${region.id}:<E> && node tools/flicker.mjs --variant detail-${region.id}:<E>`,
    context: `区域 ${region.id}：两者拿到同样的 docs/detail/plan.json 条目与同样的形体；只用 kit 生成器。` }
}

async function duelCore(key, spec) {
  const L = `duel:${key}`
  let entrants = spec.entrants
  if (spec.concept) {
    const concepts = await pipeline(entrants, e => agent(`你是 ${e.role}，标志性时刻对决的参赛者（概念阶段，60 分钟）。${STYLE} 设计种子：${e.seed}。${spec.context} 只写 docs/candidates/moment/${e.id}/。返回结构化报告。`, { label: `${L}:concept:${e.id}:${TAG}`, phase: 'Duel', schema: REPORT }))
    const pk = await agent(packPrompt({ kind: 'duel-concept', tag: `${key}-concept-${TAG}`, variants: entrants.map(e => `moment:${e.id}`) }), { label: `${L}:concept-pack`, phase: 'Duel', schema: PACK, effort: 'low' })
    const votes = (await parallel(Array.from({ length: spec.concept.blindN }, (_, i) => () => agent(blindPrompt({ dir: pk?.dir, protocol: 'tell-a-friend-rank' }), { label: `${L}:concept-blind${i + 1}`, phase: 'Duel', schema: VERDICTS })))).filter(Boolean)
    const agg = await agent(`运行 node tools/tourney/bt.mjs --pack ${pk?.dir} --votes '${JSON.stringify(votes)}'（按评审聚类 bootstrap；没把诱饵排最后的评审作废），返回排名。`, { label: `${L}:concept-agg`, phase: 'Duel', schema: AGG, effort: 'low' })
    const keep = (agg?.ranking || entrants.map(e => e.id)).slice(0, spec.concept.keep)
    entrants = entrants.filter(e => keep.includes(e.id))
    log(`${key}: concepts kept ${keep.join(',')} (reports ${concepts.filter(Boolean).length})`)
  }
  // build + gate each entry independently (no barrier until judging)
  const built = spec.noBuild ? entrants.map(e => ({ e, ok: true })) : (await pipeline(entrants,
    e => e.incumbent ? { owner: e.role, done: true, acceptance: [] } : agent(`你是 ${e.role}，在对决 ${key} 中与看不见的对手竞争同一个部件。${STYLE}
评审是盲评、去文字、随机命名，包里有诱饵（草稿 C 的同部件）；门槛脚本失败直接淘汰。设计种子：${e.seed}——在风格 C 之内把这个方向做到极致，不要向"平均答案"回归，也不要偏离所选草稿的角色与风格。
你只能写 ${e.files}；接口见 CONTRACT.md（parts / ?variant=）；用 ?variant=${key}:${e.id} 预览。${spec.context}
自检 ≥4 轮：node tools/shoot.mjs --query "variant=${key}:${e.id}&notext=1" --set crops,frames --sheet，Read 3× 裁图与 cycle24 条带，对照原子条目 ${spec.criteria.join(', ')}。交付文件 + NOTES.md（设计理由、已知问题）。返回结构化报告。`, { label: `${L}:build:${e.id}:${TAG}`, phase: 'Duel', schema: REPORT }),
    async (rep, e) => {
      const g = await agent(`运行对决门槛：${spec.gates.replaceAll('<E>', e.id)}。报告 pass 与失败项。`, { label: `${L}:gate:${e.id}`, phase: 'Duel', schema: GATES, effort: 'low' })
      if (g?.pass || e.incumbent) return { e, ok: !!g?.pass || e.incumbent, rep }
      const re = await agent(`你是 ${e.role}。对决门槛失败：${JSON.stringify(g?.failing)}。你有一次 30 分钟的修复重交机会，只改 ${e.files}。`, { label: `${L}:refix:${e.id}`, phase: 'Duel', schema: REPORT })
      const g2 = await agent(`重新运行对决门槛：${spec.gates.replaceAll('<E>', e.id)}。`, { label: `${L}:gate2:${e.id}`, phase: 'Duel', schema: GATES, effort: 'low' })
      return { e, ok: !!g2?.pass, rep: re }
    })).filter(Boolean)
  const alive = built.filter(b => b.ok).map(b => b.e)
  if (alive.length === 0) { log(`${key}: no entry passed gates; incumbent trunk stays`); return { key, winner: null } }
  if (alive.length === 1) { log(`${key}: walkover ${alive[0].id}`) }
  // judging needs every surviving entry together (barrier justified)
  const pk = await agent(packPrompt({ kind: `duel-${key}`, criteria: spec.criteria, tag: `${key}-${TAG}`, variants: alive.map(e => `${key}:${e.id}`) }), { label: `${L}:pack`, phase: 'Duel', schema: PACK, effort: 'low' })
  const run = async (n, pass) => {
    const th = []
    for (let i = 0; i < n; i++) th.push(() => agent(blindPrompt({ dir: pk?.dir, protocol: spec.blind.protocol }), { label: `${L}:blind${pass}-${i + 1}`, phase: 'Duel', schema: VERDICTS }))
    for (let i = 0; i < (pass === 1 ? spec.lensN : 0); i++) th.push(() => agent(lensPrompt({ dir: pk?.dir, criteria: spec.criteria, adversarialExtra: ' 为每个参赛作品分别判定原子条目（包里每个作品一个子目录）。' }), { label: `${L}:lens${i + 1}`, phase: 'Duel', schema: VERDICTS }))
    return (await parallel(th)).filter(Boolean)
  }
  let votes = await run(spec.blind.n, 1)
  let agg = await agent(`你是 EL。保存评审输出到 docs/eval/duels/${key}/，运行 node tools/tourney/bt.mjs --pack ${pk?.dir} --raw docs/eval/duels/${key}${spec.betterFirst ? ' --better-first' : ''}，再运行 node tools/score.mjs --subset --pack ${pk?.dir} 得到每个作品的投影分。规则：canary 召回 <80% 或没把诱饵排最后的评审作废；总排名以投影分为主，投影分相差 <0.3 总分点时用 BT 决胜；Kendall τ <0.3 时 needMoreJudges=true。${spec.betterFirst ? '胜负先看"更好"，"更多"只作次要项；有被验证的风格违规者直接出局。' : ''} 输出 winner、runnerUp、ranking、projected、btWinRate、decoyOk、kendallTau、needMoreJudges、harvestCandidates（评审在败者作品中点名的 ≤3 个"值得保留"的元素，细节对决则列出败者独有的条目名）。评审输出：${JSON.stringify(votes)}`, { label: `${L}:agg1`, phase: 'Duel', schema: AGG })
  if (agg?.needMoreJudges) {
    votes = votes.concat(await run(2, 2))
    agg = await agent(`同上，加入追加的评审票后重新聚合。全部票：${JSON.stringify(votes)}`, { label: `${L}:agg2`, phase: 'Duel', schema: AGG })
  }
  if (!agg?.winner) return { key, winner: null }
  const W = alive.find(e => e.id === agg.winner) || alive[0]
  // Red Court on any projected ≥9 of the winner
  const high = Object.entries(agg.projected || {}).filter(([c, v]) => v >= 9 && spec.criteria.includes(c)).map(([c]) => c)
  const rc = (await parallel(high.map(c => () => redCourt(pk?.dir, c, agg.projected[c], 'Duel', `${L}:${W.id}`)))).filter(Boolean)
  // harvest (guarded): rewritten with kit by the winner, SK veto + J-valid same-language + DV-AUDIT
  let harvest = null
  if (spec.harvest && agg.harvestCandidates?.length) {
    const cand = agg.harvestCandidates.slice(0, spec.harvestMax)
    harvest = await agent(`你是 ${W.role}（对决 ${key} 的胜者）。收割败者的这些元素：${JSON.stringify(cand)}。规则：用 kit 生成器在你自己的文件里重写（z 90–99），不许原样粘贴对方的代码或路径；每条都要满足：去重后独有（64×64 SSIM <0.95）、check-style 通过、不遮挡你的条目、区域 saliency 降幅 ≤0.05。在 ledger 记录来源。然后 drop。`, { label: `${L}:harvest`, phase: 'Duel', schema: REPORT })
    const [veto, lang, audit] = await parallel([
      () => agent(`你是 SK（风格守护）。审查对决 ${key} 刚收割进来的条目（${JSON.stringify(cand)}）：违反 STYLE-C 或抢骑者戏的，写进 docs/style/review-harvest-${key}.md 并列为 vetoed。`, { label: `${L}:harvest-veto`, phase: 'Duel', schema: AUDIT }),
      () => agent(validPrompt({ dir: pk?.dir, defects: cand.map(c => ({ criterion: 'C7.6', desc: `收割条目 "${c}" 与胜者的设计语言冲突（线宽、墨、形状语法）`, evidence: `node tools/quick.mjs --variant ${key}:${W.id} --crop auto` })) }), { label: `${L}:harvest-lang`, phase: 'Duel', schema: VALID }),
      () => agent(`你是 DV-AUDIT（反刷量审计）。对 ${key} 区域运行 node tools/detail-inventory.mjs --audit --region ${key}：列出不可见（<2 px²）、遮挡 ≥50%、SSIM 重复、只在检查模式可见、1× 噪点、违反 STYLE-C 的收割条目。`, { label: `${L}:harvest-audit`, phase: 'Duel', schema: AUDIT }),
    ])
    const reject = [...(veto?.rejected || []).map(r => r.name), ...(audit?.rejected || []).map(r => r.name)]
    const conflict = (lang?.validated || []).some(v => v.real && v.severity !== 'minor')
    if (conflict || reject.length) {
      await agent(`你是 ${W.role}。撤回以下收割条目${conflict ? '（J-valid 判定整批与设计语言冲突：全部撤回）' : ''}：${JSON.stringify(conflict ? cand : reject)}。然后 drop。`, { label: `${L}:harvest-revert`, phase: 'Duel', schema: REPORT })
    }
  }
  // graft winner into trunk (incumbent winner = nothing to move)
  let graft = null
  if (!W.incumbent && !spec.noBuild) {
    graft = await agent(`你是 ${W.role}（胜者）。把 ${W.files} 按接口移入正式路径（ownership 转移记录在 docs/team/owners.json 的 requests 中，由 Lead 合并），再运行 node tools/tourney/graft-check.mjs --duel ${key} --entry ${W.id}（在对决证据的全部帧上嫁接前后像素差 ≤0.5%，且全套门槛通过）。然后 drop。Red Court 核实的缺陷写进你的修复清单：${JSON.stringify(rc.flatMap(r => r.validated))}`, { label: `${L}:graft`, phase: 'Duel', schema: REPORT })
  } else if (spec.noBuild) {
    graft = await agent(`你是 RIG-L。把预设 ${W.id} 设为 src/rig/presets.js 的默认值，跑 check-rig 与 motion-audit，drop。`, { label: `${L}:graft`, phase: 'Duel', schema: REPORT })
  }
  if (spec.runnerUp && agg.runnerUp) {
    await agent(`你是 ${alive.find(e => e.id === agg.runnerUp)?.role}（标志性时刻的亚军）。把你的原型改造为 encore 时刻 / 彩蛋，写进 src/director/encore.js（新文件，归你所有），挂在自动导演里，比主时刻更小、更少出现；eggs.mjs 与 perf 快速版必须通过。然后 drop。`, { label: `${L}:encore`, phase: 'Duel', schema: REPORT })
  }
  log(`${key}: winner ${W.id} (bt ${agg.btWinRate}, tau ${agg.kendallTau}); RC caps ${JSON.stringify(rc.map(r => [r.criterion, r.cap]))}`)
  return { key, winner: W.id, agg, redCourt: rc, harvest, graft }
}
async function modeDuel() {
  phase('Duel')
  if (A.duel === 'detail') {
    const regions = DETAIL_REGIONS.filter(r => !A.regions || A.regions.includes(r.id))
    return pipeline(regions, r => duelCore(`detail-${r.id}`, detailDuelSpec(r)))
  }
  if (A.duel === 'fix') {            // stall challenger (FIX-CH) for one criterion
    const c = A.criterion, owner = A.owner
    return duelCore(`fix-${c}`, { criteria: [c], blind: { n: 3, protocol: `criterion-${c}` }, lensN: 1, harvest: false,
      entrants: [{ id: 'A', role: owner, files: ROLES[owner]?.files || '', seed: '原 owner 的修复', incumbent: false }, { id: 'B', role: 'FIX-CH', files: `src/candidates/fix-${c}/B/**`, seed: '全新视角，限时 2 小时，只改该 criterion 涉及的部分' }],
      gates: 'node tools/gate-run.mjs --tiers T0,T1 --variant fix-' + c + ':<E>', context: `停滞升级：${c} 连续 2 次修复提升 <0.5。` })
  }
  const spec = DUELS[A.duel]
  if (!spec) throw new Error(`unknown duel ${A.duel}`)
  return duelCore(A.duel, spec)
}

async function modeDetail() {
  const r = A.rung
  phase('Detail')
  const SCOUTS = [['DS-pelican', 'pelican head+neck, body+wings+legs'], ['DS-bike', 'frame+drivetrain, bars+basket'], ['DS-world', 'sea+harbour, land+road, sky+typography']]
  const [scouts, measure] = await parallel([
    () => parallel(SCOUTS.map(([id, regions]) => () => agent(`你是只读细节侦察兵 ${id}（梯级 ${r} 的全新实例），不改任何美术。${STYLE}
对区域 ${regions}：运行 node tools/quick.mjs --crop <region> --pair-draft --dpr 1,3（草稿 | 成品同位置），先分别对两张图做盲自清点，再列出成品中缺失、薄弱或没有区分的条目，每条给出设计句 + 建议 owner + z 段 + 1× 可见度评级（只在检查模式可见的 ≤+0.5）。写 docs/detail/scout/${r}-${id}.md。返回结构化报告（knownIssues 列出最重要的 10 条）。`, { label: `detail:${r}:${id}:${TAG}`, phase: 'Detail', schema: REPORT }))),
    () => agent(`你是 TS-detail 的度量代理。在 integ 上运行：node tools/detail-inventory.mjs --all、node tools/detail-parity.mjs、node tools/zoom-coverage.mjs --phases 0,90,180,270,hero --dpr 3、node tools/check-detail-budget.mjs、node tools/flicker.mjs --all、node tools/judge/saliency.mjs${r === 'a' ? '，并拿 /tmp/pb-cpu.lock 跑 node tools/perf.mjs --cams wide,close --runs 1（真实美术复测金丝雀）' : ''}。返回 counts（每层 + all + fx）、multiples（每层对 129 基线）、parityMissing、zoomPelican、zoomBike、fps、saliency、budgetOk、flicker（闪烁条目数）。`, { label: `detail:${r}:measure:${TAG}`, phase: 'Detail', schema: RUNG, effort: 'low' }),
  ])
  const [dv, audit] = r === '0' ? [null, null] : await parallel([
    () => agent(`你是 DV（独立细节验证者，梯级 ${r} 的全新实例，不参与制作）。按 rubric detail.judgeProtocol 在 node tools/judge/pack.mjs --kind detail --canaries 3 --out-random 生成的包上工作（只读该包）：先对草稿与成品的同位置裁图分别做开放式盲清点，再逐区（7 个区域）回答"哪张细节更多？哪张更好？有没有违反风格 C 或抢戏的细节？"。包里混有"细节缺失"的 canary。返回 perceivedMultiple、regionsMore、regionsBetter、canaryRecall、lowRegions、violations。`, { label: `detail:${r}:DV:${TAG}`, phase: 'Detail', schema: DV }),
    () => agent(`你是 DV-AUDIT（反刷量审计）。运行 node tools/detail-inventory.mjs --audit --all，并在 1× 与 3× 下人工核对可疑条目：不可见（<2 px²）、遮挡 ≥50%、SSIM 重复、只在检查模式可见却被计为 1×、1× 下的噪点区域、违反 STYLE-C §2/§4、为预算删掉的已有美术。写 docs/detail/audit/${r}.json。`, { label: `detail:${r}:AUDIT:${TAG}`, phase: 'Detail', schema: AUDIT }),
  ])
  const m = { ...(measure || {}), dv: dv && (dv.canaryRecall ?? 1) >= 0.8 ? dv.perceivedMultiple : 0, dvRegionsMore: dv?.regionsMore, auditMajors: audit?.majors }
  const verdict = rungPass(r, m)
  const dqm = await agent(`你是 DQM（细节总账）。梯级 ${r} 的判定：${JSON.stringify(verdict)}；度量：${JSON.stringify(m)}；侦察兵报告：docs/detail/scout/${r}-*.md；DV：${JSON.stringify(dv)}；审计驳回：${JSON.stringify(audit?.rejected || [])}。把侦察兵的条目与欠账合并进 docs/detail/{plan.json,quotas.json,backlog/*.md}（按"1× 可见度 × 区域覆盖缺口"排序，配额按区域下发，不按 owner 原始条数），更新 dashboard.json 与 burnup.png；${r === '0' ? '把每条缺失的 parity 条目作为 bug 放进对应 owner 队列的最前面（docs/team/queue/<owner>.json）。' : ''}${verdict.pass ? '' : '梯级未过：按 TEAM.md §5.4 的"未过时"一栏处理（前移欠账层的 backlog；perf 不过先修预算）。'} 然后 drop。`, { label: `detail:${r}:DQM:${TAG}`, phase: 'Detail', schema: REPORT })
  log(`rung ${r}: ${verdict.pass ? 'PASS' : 'FAIL ' + verdict.failures.join('; ')}`)
  return { rung: r, verdict, metrics: m, scouts: scouts?.filter(Boolean).length, dqm }
}

async function modeIntegrate() {
  phase('Integrate')
  for (let pass = 1; pass <= 3; pass++) {
    const g = await agent(`你是 ARCH（集成冻结值班）。在 integ 上：node tools/build.mjs && node tools/gate-run.mjs --tiers T0,T1,T2 --full --report docs/eval/gates-integrate-${pass}.json；然后 node tools/bake.mjs && node tools/check-baked.mjs --static，node tools/webm.mjs --sample 3。修掉你拥有的文件里的问题；其他 owner 的失败按 owners.json 路由（routed）。`, { label: `integ:ARCH:${pass}:${TAG}`, phase: 'Integrate', schema: GATES })
    if (g?.pass) { log(`integration green after pass ${pass}`); return { pass: true, gates: g } }
    const byOwner = {}
    for (const r of g?.routed || []) (byOwner[r.owner] ||= []).push(r.issue)
    await pipeline(Object.keys(byOwner).filter(o => ROLES[o]), o => agent(commonPrompt(o, ROLES[o].lane, 'integrate', `集成冻结期间的门槛失败（只修这些）：${JSON.stringify(byOwner[o])}。修完重跑受影响的 T2。`), { label: `integ:fix:${o}:${pass}:${TAG}`, phase: 'Integrate', schema: REPORT }))
  }
  return { pass: false }
}

// round core: gate precheck → pipeline over dims (pack → judges → validate → Red Court) → score
async function roundCore(round, dims, labelBase, light) {   // light = snapshot rounds R2–R4: fewer lens judges, halved special panels (keeps one workflow under the 1000-agent cap)
  phase('Evidence')
  const g = await gatePrecheck(round, `${labelBase}`, 'Evidence')
  if (!g || (g.blocking || []).length) { log(`${round}: blocked by ${JSON.stringify(g?.blocking)} — no judges started`); return { round, blocked: g?.blocking || ['gate precheck failed'], gates: g } }
  const final = round === 'Rfinal'
  const perDim = await pipeline(dims,
    d => agent(packPrompt({ kind: 'dimension', dims: [d], round, tag: `${round}-${d}-${TAG}`, withWild: final, withHoldout: final }), { label: `${labelBase}:pack:${d}`, phase: 'Evidence', schema: PACK, effort: 'low' }),
    (pk, d) => pk?.dir ? judgeCriteria({ dir: pk.dir, blindPacks: pk.blindPacks, criteria: pk.criteria?.length ? pk.criteria : Object.keys(COVERAGE).filter(c => COVERAGE_DIM(c) === d), dim: d, round, nLens: light ? 2 : (LENS_N[d] || 3), specials: light ? (SPECIAL[d] || []).map(sp => ({ ...sp, n: Math.max(1, Math.ceil(sp.n / 2)) })) : SPECIAL[d], labelBase: `${labelBase}:${d}` }).then(j => ({ d, dir: pk.dir, ...j })) : null)
  phase('Score')
  const s = await agent(`你是 EL。按 rubric scoring 规则聚合轮次 ${round} 的维度 ${dims.join(',')}：node tools/score.mjs --round ${round} --dims ${dims.join(',')} --raw docs/eval/raw/${round} --redcourt '${JSON.stringify(perDim.filter(Boolean).map(p => ({ d: p.d, rc: p.redCourt.map(r => ({ c: r.criterion, cap: r.cap })), outliers: p.outliers.length })))}'（机器上限、严重度上限、Red Court 封顶、G16 状态、H 乘数都由 score.mjs 计算），再运行 node tools/score.mjs --merge --round ${round} 合并已完成的各组，并更新 docs/eval/shadow-bias.json（影子 / 快照分 − 轮次分）。scorecard 首行标注"同模型自评"。返回 round、dims、perCriterion、T、H、Tfinal、coreMin、critMin、gatesFail、rungC、shadowBias、openUserComments、judgesDiscarded、scorecardPath（merge 还不完整时，只填本组已有的维度）。`, { label: `${labelBase}:score`, phase: 'Score', schema: SCORE })
  return { round, score: s, perDim: perDim.filter(Boolean).map(p => ({ d: p.d, prelim: p.prelim, redCourt: p.redCourt })) }
}
async function modeRound() {
  const round = A.round
  const dims = A.dims || GROUPS[A.group]
  if (!dims) throw new Error('round needs args.group (A-D) or args.dims')
  return roundCore(round, dims, `${round}:${A.group || 'x'}:${TAG}`)
}

async function fixWave(k, owners, lanes) {
  phase('Fix')
  return pipeline(owners, o => agent(commonPrompt(o, ROLES[o]?.lane || 'A', `fix-w${k}`, `你是修复者。认领：node tools/queue.mjs claim --owner ${o} --max 2（按 priority 排序；门槛失败永远第一，其次是用户的 G16 意见）。每个修复项附带证据路径、原子条目、评审原话与 before/after 要求；修完经 drop → merge train → 受影响的 T2，然后 node tools/queue.mjs done <id>，并请求一次定向影子评审（node tools/queue.mjs shadow <id>）。队列空了就返回 done=true 且 drops=[]。`),
    { label: `fix:w${k}:${o}:${TAG}`, phase: 'Fix', schema: REPORT }))
}
async function modeFix() {                       // extra fix capacity; pulls from the same on-disk queue as mode loop
  const lanes = A.lanes || Object.keys(LANES)
  const owners = Object.keys(ROLES).filter(o => lanes.includes(ROLES[o].lane))
  for (let k = 1; k <= (A.maxWaves ?? 12); k++) {
    const stop = await agent(`读 ${ROOT}/docs/team/stop.json（Lead 或 loop 写入）与 node tools/queue.mjs list --lanes ${lanes.join(',')} --open。返回 items（本车道组的开放项）。`, { label: `fix:peek:${k}:${TAG}`, phase: 'Fix', schema: QUEUE, effort: 'low' })
    const open = (stop?.items || []).filter(i => owners.includes(i.owner))
    if (!open.length) { log(`fix(${lanes}): queue empty at wave ${k}`); break }
    await fixWave(k, [...new Set(open.map(i => i.owner))], lanes)
  }
  return { lanes }
}

// the post-R1 controller: fix waves → snapshot rounds (R2..R4) → STOP/STALL → enter R-final
async function modeLoop() {
  let last = A.r1Score || null
  if (!last) {
    const s = await agent(`运行 node ${ROOT}/tools/score.mjs --merge --round R1 --json 并返回合并后的 scorecard。`, { label: `loop:readR1:${TAG}`, phase: 'Score', schema: SCORE, effort: 'low' })
    last = s
  }
  const history = [{ round: 'R1', Tfinal: last?.Tfinal, dims: last?.dims }]
  const stalls = {}
  let reason = 'snapshots exhausted'
  for (let snap = 2; snap <= 4; snap++) {
    if (entryOK(last)) { reason = 'entry condition met'; break }
    const stopped = Object.keys(LOOPS).filter(L => loopStop(last, L))
    for (let w = 1; w <= (A.wavesPerSnapshot ?? 2); w++) {
      const q = await agent(`你是 EL。运行 node tools/predict.mjs --scorecard latest --skip-loops ${stopped.join(',') || 'none'} --write docs/team/queue/：为每个未 STOP 的循环（${Object.keys(LOOPS).filter(L => !stopped.includes(L)).join(',')}）的失败条目计算 gain = W_d·(w_c/Σw_d)/10·(target_c − s_c) + 门槛上限解除 + 核心项对 H 的边际，target_c = max(9.3, 核心项 9.5)，priority = gain × p_fix / cost；门槛失败第一，用户 G16 意见第二（读 docs/eval/user-checkpoint.json）；按 item-owner.json 路由；每个 owner 最多 2 项。返回 items、stoppedLoops、stalledCriteria（同一 criterion 连续 2 次修复后影子分提升 <0.5 的）。`, { label: `loop:s${snap}:predict${w}:${TAG}`, phase: 'Fix', schema: QUEUE, effort: 'low' })
      const items = q?.items || []
      if (!items.length) break
      const owners = [...new Set(items.map(i => i.owner))].filter(o => ROLES[o]).slice(0, A.ownersPerWave ?? 8)
      await fixWave(`${snap}.${w}`, owners)
      for (const c of q?.stalledCriteria || []) {
        stalls[c] = (stalls[c] || 0) + 1
        if (stalls[c] > 3) { log(`accept gap on ${c} (3 stalls) → docs/handoff.md`); continue }
        const owner = items.find(i => i.criterion === c)?.owner
        log(`stall on ${c}: triage + FIX-CH duel (owner ${owner})`)
        await agent(`你是 DIR，与 SK 及 ${owner} 一起分诊停滞的 ${c}：是艺术指导问题、契约问题，还是能力上限？把结论写入 docs/team/loops/triage-${c}.md；如需契约变更，写 docs/contract/requests/triage-${c}.md 等下一个契约窗口。`, { label: `loop:triage:${c}:${snap}`, phase: 'Fix', schema: REPORT })
        if (owner) await duelCore(`fix-${c}`, { criteria: [c], blind: { n: 3, protocol: `criterion-${c}` }, lensN: 1, harvest: false,
          entrants: [{ id: 'A', role: owner, files: ROLES[owner]?.files || '', seed: '原 owner 的最新版本', incumbent: true }, { id: 'B', role: 'FIX-CH', files: `src/candidates/fix-${c}/B/**`, seed: '全新视角，限时 2 小时，只改该 criterion 涉及的部分' }],
          gates: `node tools/gate-run.mjs --tiers T0,T1 --variant fix-${c}:<E>`, context: `停滞升级：${c}。` })
      }
    }
    // snapshot round on affected dimensions (fresh judges)
    const affected = DIMS.filter(d => !stopped.some(L => LOOPS[L].dims.includes(d)))
    const snapRes = A.externalSnapshots
      ? { score: await agent(`运行 node ${ROOT}/tools/score.mjs --merge --round R${snap} --json（Lead 已用 4 个 round 实例跑完快照 R${snap}），返回 scorecard。`, { label: `loop:readR${snap}:${TAG}`, phase: 'Score', schema: SCORE, effort: 'low' }) }
      : await roundCore(`R${snap}`, affected.length ? affected : DIMS, `R${snap}:loop:${TAG}`, true)
    if (snapRes.blocked) { log(`R${snap} blocked by gates; next wave fixes gates first`); continue }
    const s = snapRes.score
    history.push({ round: `R${snap}`, Tfinal: s?.Tfinal, dims: s?.dims })
    const dropped = DIMS.filter(d => last?.dims?.[d] !== undefined && s?.dims?.[d] !== undefined && s.dims[d] <= last.dims[d] - 1)
    if (dropped.length) await agent(`维度 ${dropped.join(',')} 在 R${snap} 掉了 ≥1 分。运行 node tools/vr.mjs --since R${snap - 1} 与 git bisect，判定是真回归还是评审噪声，写入 docs/eval/regressions-R${snap}.md；真回归就回滚并把项放进队列最前面。`, { label: `loop:regress:R${snap}`, phase: 'Fix', schema: REPORT })
    const delta = (s?.Tfinal ?? 0) - (last?.Tfinal ?? 0)
    last = s
    if (snap >= 3 && delta < 0.3) { reason = `stall: ΔT_final ${delta.toFixed(2)} < 0.3`; break }
    if (A.fuse) { reason = 'H40 fuse'; break }       // lead passes fuse:true when the wall-clock fuse fires
  }
  log(`loop exit: ${reason}; entryOK=${entryOK(last)}`)
  return { reason, entryOK: entryOK(last), last, history, next: 'run detail {rung:"c"}, then round {round:"Rfinal", group:A..D} ×4, then G16 #2' }
}

async function modeShip() {
  phase('Ship')
  const verify = await agent(`你是 EL。在 R-final 之后、最后一次修复之后运行：全新克隆到临时目录 → npm ci && npm run verify:full；双构建 sha256 比较；node tools/coverage.mjs（100% 覆盖）；ownership 与隔离审计；git status --porcelain 为空；没有 >5 MB 文件、没有密钥。写 docs/eval/verify.txt。返回 pass 与失败项。`, { label: `ship:verify:${TAG}`, phase: 'Ship', schema: GATES })
  const pkg = await runOwner('PKG', 'ship', 'X', `发布打包：dist/{index.html,pelican-bicycle.svg,pelican-mini.svg,poster.png,contact-sheet.png,preview.webm}、双语 README（hero 图、webm 链接、同模型自评标注、按角色分列的代理数、致谢 Simon Willison 的基准与 Gimini 的 Velocipedia）、docs/handoff.md、detail-compare 对照图；verify-claims 与 readme-lint 0 命中。`)
  const final = await agent(`运行 node ${ROOT}/tools/score.mjs --merge --round Rfinal --json，返回最终 scorecard。`, { label: `ship:score:${TAG}`, phase: 'Ship', schema: SCORE, effort: 'low' })
  const met = targetMet(final)
  log(`R-final: Tfinal ${final?.Tfinal}; target ${met ? 'met (同模型自评；需 G16 用户确认)' : 'NOT met — report the gap honestly'}`)
  return { verify, pkg, final, targetMet: met, leadTodo: ['commit + push claude/gracious-allen-1ksl3j', 'draft PR + subscribe', 'publish dist/index.html as Artifact and read back (G13)', 'send G16 #2 materials to the user in Chinese', 'wording: "同模型自评达标，待用户确认" until the user passes G16'] }
}

// ───────────────────────────── dispatch ─────────────────────────────
const MODES = { freeze: modeFreeze, tools: modeTools, field: modeField, r0: modeR0, lane: modeLane, duel: modeDuel, detail: modeDetail, integrate: modeIntegrate, round: modeRound, loop: modeLoop, fix: modeFix, ship: modeShip }
if (!MODES[MODE]) throw new Error(`args.mode must be one of ${Object.keys(MODES).join(', ')}`)
log(`pelican-build-v1 mode=${MODE} ${JSON.stringify({ lane: A.lane, duel: A.duel, rung: A.rung, round: A.round, group: A.group, queue: A.queue })}`)
return await MODES[MODE]()
