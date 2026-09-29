# Team proposal: Specialist Depth (纵深专家制)

> Angle: **maximise depth.** Many narrow specialists, each owning one part of the pelican, the bike, the world, the print frame or one runtime system. Every rubric dimension has its own verifier and its own loop that repeats until the dimension clears its threshold. The user has chosen style C and requires **far more detail than the draft** ("我需要你最终教出来的版本细节比 draft 多很多" (sic; 教 = 交)), so detail density is designed in as a production line of its own. It is not left as a side effect of the art briefs.
>
> Builds on: `CONTRACT.md`, `docs/rig-spec.md`, `src/contract.js`, the phase-0 scaffold (`src/**`, `tools/{shoot,check-rig,lint,build,render,sheet,serve}.mjs`), `docs/STYLE-C.md`, `drafts/C-poster/*`, `RUBRIC.md` / `rubric.json` v2.0.0. Nothing restarts. The phase-0 files become the aggregators that the specialists' part files plug into.
>
> Every score in this document is a **same-model self-assessment** (同模型自评). The judges are Claude subagents from the same model family as the builders.

---

## 0. Thesis in one page

1. **The rubric rewards depth in exactly the places a generalist builder runs out of attention.** D13 detail density (10 points plus the G-DETAIL gate, which caps D13 at 4 if it fails), D4 anatomy (8), D2 bike engineering (8) and the style-C fidelity items in D7 are all scored on **3× and 4× crops, region by region and item by item**. For example: ≥8 individually countable primaries, ≥7 crest strands, ≥4 tarsus scale lines, spoke nipples, rim eyelets, a chain with plates, pins and rollers, a basket with over-under weave, fish with scales, fins and gill covers, a harbour town with windows and chimneys, buoys with numbers, and ticket-stub annotations. The v0 plan gave one agent "pelican body/head/bill/pouch/eye/crest" in a single 40-line file. That agent can't reach 11/11 on the pelican catalogue and 97% zoom coverage while also doing proportions, charm and night readability. **So we split every catalogue region into one specialist who owns one part file** and whose acceptance test *is* that region's catalogue and quota.
2. **Disjoint ownership needs finer files.** v0 ownership was per slot or layer. Depth needs **several owners per slot** (the head slot holds the head, eye, facial skin and goggles; the bars slot holds stem, bars, brakes, cables, bell, lamp and basket). We add one contract primitive, **parts** (§3.1). A part file exports `parts: [{target, z, id, build, attach?}]`. A **captain** owns the aggregator that composes the parts in z order. Specialists never touch each other's files, and captains never draw.
3. **One verifier per dimension, and loops until the threshold is met.** Each of the 13 dimensions has a loop controller `L-<dim>` with a dedicated fresh verifier `V-D<n>`, a fixed script set, and the rubric's atomic items (`docs/rubric/items.json`) scored mechanically by `tools/score.mjs`. A loop stops when its internal score is ≥ 9.3, or after 3 iterations, or when it stalls. The internal target is 9.3, above the 9.0 floor, because fresh R-final judges usually score lower than loop judges.
4. **Detail is its own production line with its own verifiers (G-DETAIL / D13).** A **detail registrar** keeps a machine registry of every `data-detail` line and a quota per specialist. **Seven read-only region scouts** compare draft crops against the build and turn them into a concrete backlog. The specialists add the lines. A **detail ladder** raises the target in rungs (1.5× → 2.5× → 3.5×). An independent **detail QA** plus 2 J-detail judges per round verify the result, and scripts gate it: `detail-inventory`, `zoom-coverage`, `check-detail-budget`, a flicker/moiré detector and saliency. We aim for the **10-point anchor** (≥3.5× overall, every layer ≥2.0×, 11/11 and 14/14 catalogues), not the 2.5× gate.
5. **Detail must never cost appeal or frames.** C13.6 and C7.7 cap us if detail becomes noise, and G9 caps us at 60 if fps drops. Three structural guards: (a) the director and style keeper can veto any detail merge that lowers rider saliency below 1.4; (b) a perf engineer owns a **build-time ink-merge** (`tools/merge-static.mjs`) that folds each static part into roughly one `<path>` per ink, so DOM count stays flat while detail grows; (c) every merge on the merge train re-runs `perf` against per-band budgets.
6. **Concurrency.** Each workflow runs about 2 agents, so depth comes from **several concurrent lane workflows**, one per git worktree: pelican, bike, world plus type, and systems. Each lane has 2 agent slots. Chromium work goes through a shared 3-slot semaphore, and perf and soak take an exclusive CPU lock. On 4 CPUs, 3 lanes run at once and the 4th lane waits in the queue.

Roster: **92 distinct agent roles** plus the lead session (§4). Across the whole run that means roughly 350–450 agent instances, because builders iterate and every judge in every round is fresh. The README gives these counts by role, not as one total (G6).

---

## 1. Constraints this design is shaped around

| Constraint | Consequence in this design |
|---|---|
| About 2 agents per workflow, 4 CPUs, several workflows allowed | Four **lane workflows** (`wf-lane-{pelican,bike,world,systems}.js`), each in its own git worktree and at most 2 concurrent agents. 3 lanes run at once. The lead runs `wf-merge-train.js` between lane waves. Judge rounds are separate workflows (`wf-round.js`). |
| Chromium is software-rendered and CPU-heavy | `tools/lib/lock.mjs`: a counting semaphore over `/tmp/pb-shoot.sem` with 3 slots, used by every Playwright tool, plus the exclusive `/tmp/pb-cpu.lock` for `perf` and `soak` (the rubric's lock). Self-check shots are cheap part sheets (`?solo=` on one part) instead of full scene sets. |
| Shared filesystem | One worktree per lane (`../pb-wt/<lane>`, branch `lane/<lane>`). File ownership is enforced by `tools/ownership.mjs` (diff against `docs/team/owners.json`) on every merge. A foreign-file edit rejects the merge. |
| ffmpeg only encodes vp8/webm and has no PNG decoder (BL-31) | `preview.webm` is encoded from JPEG frames produced by `renderAt`. Frames are verified by decoding the webm back through mjpeg-free paths (Chromium `<video>` + canvas grab). |
| No Blender, no other AI models | Everything is procedural SVG, and all judges are Claude subagents. The README states this plainly (G6). |
| Token cost doesn't matter, wall clock matters moderately | Depth costs wall clock. The estimate is ~38–46 h end to end (§6.9). We spend it on visual iteration: at least 40% of builder time goes to art and animation iteration with visual review loops (protocol 7.1). |
| The workflow script API (see `wf-build.v0.js`) | `agent / parallel / pipeline / phase / log / args`; `meta` is a pure literal. No `Date.now` and no `Math.random`. Loop state lives in files (`docs/team/loops/<dim>.json`), so a lane workflow can be resumed. |

---

## 2. What the rubric forces (read-back)

- **Pass line:** every gate passes (including G-DETAIL, G16 and G17), every dimension ≥ 9.0, T_final ≥ 92 with T_final = T·min(1, H/9), no criterion < 7, and every perceptual-core criterion ≥ 8. Only R-final counts. The consequence: the weighted mean must be **≥ 9.2**, so we need **visible 10-point extras** in the heavy dimensions. The 8-point items alone can't reach it (rubric 7.8 #11).
- **Where the points sit:** D1 11 · D7 10 · **D13 10** · D5 9 · D2/D3/D4/D6 8 each · D11 7 · D8/D9 6 · D12 5 · D10 4. Detail density shows up directly in D13 (10), and indirectly in C2.7, C4.x, C7.5, C7.6, C7.7 and G-DETAIL (cap 60 if it fails).
- **Perceptual core (13):** C1.3, C4.1, C5.1, C5.2, C6.1, C6.3, C7.1, C7.2, C7.6, C7.7, C8.1, **C13.1, C13.2**. Two of the thirteen are detail criteria. Their mean H multiplies the total.
- **Detail quotas (definitions.detailItem, detail.catalogue):**

| Layer | Draft | Gate (8-pt) | 10-pt anchor | **Our target** | Owners |
|---|---:|---:|---:|---:|---|
| pelican | 27 | ≥54 (2.0×) | ≥54 and total ≥3.5× | **≥95 (3.5×)** | PL-head, PL-bill, PL-pouch, PL-crest, PL-body, PL-wing, PL-hand, PL-leg, PL-foot, PL-scarf |
| bike | 42 | ≥84 | ≥84 | **≥150 (3.6×)** | BK-frame, BK-cockpit, BK-wheels, BK-drive, BK-saddle, BK-basket, BK-fit |
| sea | 9 | ≥14 | ≥18 | **≥32** | WD-sea, WD-boats, WD-shore (buoys, pier) |
| land | 30 | ≥45 | ≥60 | **≥105** | WD-town, WD-shore, WD-roadside, WD-flora, WD-road |
| sky | 10 | ≥15 | ≥20 | **≥35** | WD-sky, WD-cloud |
| fx | 1 | ≥4 | ≥6 | **≥9** | SY-fx, SY-cast |
| typography_frame | 10 | ≥15 | ≥20 | **≥35** | TY-frame, TY-letter |
| **total** | **129** | **≥323** | **≥452** | **≥461 (3.57×), stretch 500** | REG is accountable |

  The target carries a margin because the inventory's anti-cheat rules (SSIM merge, visibility and occlusion tests) will throw out some lines. We plan for about 10% to be rejected.
- **zoom-coverage:** ≥97% of pelican cells and ≥95% of bike cells rated "detailed" at 3× (10-point anchors); the gate is 85% with no blank run of 4 or more cells.
- **Detail discipline:** ≤200 path elements per static band, `<use>` for repeats, seeded generation, rider saliency ≥1.4, and depth falloff (far edge density < mid < 60% of near). No moiré or flicker. Paired blind "detail vs draft" comparisons must win ≥80% of the time in the 4 regions.

---

## 3. Contract v1 (frozen in phase C0, before any builder starts)

The rubric (13.1) lists 18 contract changes. All 18 are adopted. The architect (ARCH) and the lead implement them in phase C0. The depth design adds the following items, marked **[D]**.

### 3.1 [D] Parts: many owners per slot or layer

```js
// src/art/pelican/bill.js (owner PL-bill)
export const id = 'pl-bill';
export const parts = [
  { target: 'slot:billUpper', z: 10, id: 'bill-upper', build(ctx) { return markup } },
  { target: 'slot:billLower', z: 10, id: 'bill-lower', build(ctx) { … } },
  { target: 'slot:billUpper', z: 30, id: 'bill-nail',  build(ctx) { … } },
];
export function attach(svg, ctx) { return { update(frame) {}, bake(kit) { return [] } } } // optional
```

- A **captain's aggregator** (for example `src/art/pelican-body.js`) imports its part files, sorts each target's parts by `z`, concatenates them, and still exports the CONTRACT.md module interface (`id, materials, build, attach`). `scene.js` stays unchanged.
- **z-range allocation per slot** lives in `src/contract.js` under `PART_Z` (for example head: skin 0–9 PL-head, eye 20–29 PL-head, goggles 40–49 PL-head, crest-root 50–59 PL-crest). A part whose z falls outside its owner's range fails `check-contract`.
- **New slots:** `spider` (after `chain`, rubric 13.1 #2), `scarfBack` (before `neck`) and `scarfFront` (after `body`), `fishFlop` (inside the bars group, after the basket). The SLOTS order is fixed to `… 'cog','chainring','chain','spider','crankNear' …` (fixes BL-03).
- **Geometry changes decided now:** use an integer chain (chainstay 125.433, rear hub (−123.83, −100); 10-point item for C2.2). `HORIZON_Y` becomes per-style and per-camera (BL-29, styleProfiles.C.horizon).

### 3.2 [D] Detail registration

- Every inventory line's root element carries `data-detail="<layer>:<O|T>:<name>"`, a stable name listed in `docs/detail/registry.json` (owned by REG) with `{owner, region, catalogueItem?, variantOf?, addedIn}`.
- `tools/lint.mjs` fails on any `data-detail` name not in the registry. `tools/detail-backlog.mjs` fails a specialist's acceptance test when their registered lines are fewer than their quota, or when a registered line isn't visible in the inventory run.
- Deformed or rotating parts declare `data-stretch="sy|neck"` or `data-rotating`. zoom-coverage then applies the tear test to them, and wagon applies the alias test.
- Props carry `data-size-m`, text carries `data-text`, and feather rows and scallops carry `data-tract` (C4.6, C9.8, C13.4).

### 3.3 [D] Per-band budgets (with SY-perf)

z-bands (rubric 13.1 #1): `B-sky` (static except a slow rotation of the rays), `B-far` (hills, lighthouse, sea, boats, town), `B-mid` (shore), `B-near` (roadside, road), `B-rider` (slots), `B-wheels` (rotating parts get their own small layers), `B-front` (foreground, fx-front), and `B-frame` (screen-fixed print frame and UI). Each band is its own `<svg>` in a composited div and moves only by transform.

| Band | Path elements after ink-merge | Raster budget (p95 ms/frame @1600×900 golden, measured by `perf --band`) | Notes |
|---|---:|---:|---|
| B-sky | ≤200 | 0 (static layer) + ray rotation ≤0.6 | halftone as `<pattern>` or pre-merged dot paths |
| B-far | ≤200 | ≤0.8 (translate only) | the town, boats and pier live here, so this band can take the most detail |
| B-mid / B-near | ≤200 each | ≤1.2 each | tiles via `<use>` ×3 |
| B-rider | ≤900 nodes | ≤3.5 | only moving-part detail; each slot is ink-merged into roughly 1 path per ink |
| B-wheels | ≤150 | ≤1.5 | spokes fade; nipple and eyelet rings are pre-merged |
| B-front, B-frame | ≤200 each | ≤0.8 | |

The perf gate on the merge train fails a merge that pushes any band over its budget. That merge goes back to its owner, whose fix must use engineering means (merge, `<use>`, caching or LOD), **never deleting detail** (C13.6).

### 3.4 Hooks (rubric 13.1 #5, #14, #15)
`?notext ?nofx ?idmap ?silhouette ?inspect ?mutant=<id> ?solo=<part|owner> ?ablate= ?nocache ?moment= ?skeleton ?detail=heat` (the heatmap of zoom coverage) and `renderAt(t,{tod,cam,cadenceSchedule,eventsLog,pointerLog,quality,viewport,flags,intro})`. Other hooks: `__pb.simulate(dtArray)`, `__pb.firstFrameAt`, `pose.gaze`. The `?solo=` hook now accepts an owner id (`solo=pl-bill`), so every specialist can render only their own part over the rider skeleton.

---

## 4. Roster (92 roles plus the lead)

Conventions:
- "Owns" lists files the role may write (after C0, `docs/team/owners.json` is the source of truth).
- "Accept" is the acceptance test the role must pass before its report counts. The lane controller checks it by running the scripts itself. The agent's own claims don't count (protocol 7.1).
- Every producer's report uses the v0 REPORT schema plus `detailLines[]`, `before/after crop paths` and `budgetDelta`.

### 4.1 Direction (4 plus the lead)

| ID | Role | Owns | Inputs | Accept | Prompt outline |
|---|---|---|---|---|---|
| LEAD | Orchestrating session: runs the workflows, merge train, G16 contact with the user, commits, PR, Artifact | `docs/team/*`, `docs/team/ledger.json`, `docs/eval/user-checkpoint.json` | everything | G13, G14, G16 | n/a |
| DIR | Director (layout and acting). Writes the character bible, 60 fps X-sheet, beat sheet, composition, signature moment. Can veto any merge that hurts appeal or saliency | `docs/character.md`, `docs/timing.md`, `docs/beats.md`, `docs/composition.md`, `docs/signature.md` | STYLE-C, drafts, rubric D5–D8 | docs exist before B1; saliency ≥1.4 on every merge-train build; signs off on each rung of the detail ladder | "You are the film's director. Write the docs builders will follow… 24 s loop, ≤5 beats, 1–3 s quiet cruise between beats… for every detail rung, rank the regions by where the eye should go and veto anything that competes with the rider." |
| ARCH | Contract and runtime architect: z-bands, parts, hooks, pure `renderAt`, lifecycle, build | `src/contract.js`, `CONTRACT.md`, `src/main.js`, `src/scene.js`, `src/rig/solve.js` (composition only), `src/core/{svg,bus,math,bakekit}.js`, `src/page.css`, `src/index.dev.html`, `tools/{build,serve}.mjs` | rubric 13.1, BL-01…BL-25 | check-contract, determinism (a–f), live-parity, G1, BL-04/05/18 fixed | "Freeze contract v1 exactly as in proposal §3… every change needs a migration note in CONTRACT.md… keep renderAt history-free." |
| INK | Style keeper and ink master: 6 ink sets, the style-C rules engine, reviews style on every merge | `src/core/palette.js`, `src/core/inks/{dawn,noon,golden,sunset,dusk}.js`, `docs/eval/ink-sets.json` (frozen at R0), `tools/check-style.mjs` rule table (the tool itself belongs to TS-detail) | STYLE-C, draft C | check-style 0 violations; relative colour constraints hold in all tods (C4.6); every palette is a "limited-colour print" (a J-blind pair test at R1) | "You are the print-shop foreman. Seven inks, fixed roles… reject any gradient that isn't a quantised glow… night is a night poster, not a darkened day poster." |
| REG | Detail registrar: registry, quotas, detail-ladder controller, the daily inventory | `docs/detail/{registry,quotas,regions}.json`, `docs/detail/ladder.json`, `docs/eval/detail-*.json` | detail-baseline-C, catalogue, scout backlogs | inventory totals and layer multiples at each rung; 0 orphan registry names | "Keep the books. Every detail line has an owner, a region, a catalogue link and a visible crop… refuse lines that are pixel-duplicates (SSIM ≥0.95)." |

### 4.2 Tooling (9)

Each tool-smith owns disjoint tool files and must pass `tool-validity` (known-good fixture passes, mutant set fails, two runs agree) before R0.

| ID | Owns (tools/…) | Tier |
|---|---|---|
| TS-rig | `check-rig.mjs` (extended: `--seat --biomech --events`), `mutate-rig.mjs`, `motion-audit.mjs`, `filmstrip.mjs` (**cycle24 sheet** + `--dense`), `onion.mjs`, `check-temporal.mjs`, `test/rig/harness.mjs` | T0/T1 |
| TS-dom | `check-anchors.mjs` (+ anchor audit), `check-benchmark.mjs`, `check-occlusion.mjs`, `check-contacts.mjs`, `contact-probe.mjs`, `check-bike.mjs`, `check-kinematics.mjs`, `check-noslip.mjs`, `wagon.mjs`, `check-anatomy.mjs`, `check-scale.mjs`, `thumb.mjs`, `silhouette.mjs`, `tools/lib/page.mjs` | T0/T1 |
| TS-perf | `perf.mjs` (+ `--band`, `--paint`), `soak.mjs`, `robust.mjs`, `contexts.mjs`, `audit-dist.mjs`, `determinism.mjs`, `vr.mjs`, **`vdiff.mjs`**, `live-parity.mjs`, `check-purity.mjs`, `xb-webkit.mjs`, `xb-audit.mjs`, `tools/lib/lock.mjs` | T0/T1/T2 |
| TS-ux | `ux-matrix.mjs`, `interact.mjs`, **`keys.mjs` (key-press driver)**, `a11y.mjs` (pinned axe-core), `contrast.mjs`, `flash-check.mjs`, `i18n-lint.mjs`, `cjk-glyph.mjs`, `check-text.mjs`, `audio-check.mjs`, `export-check.mjs`, `first-look.mjs`, `judge/harness.mjs`, `judge/controls.mjs` | T0/T1 |
| TS-judge | `score.mjs`, `coverage.mjs`, `tool-validity.mjs`, `verify.mjs`, `judge/{pack,canary,wild,palette,saliency,seams,edges,acting,film,eggs,audio-offline,package}.mjs`, `field.mjs`, `check-contract.mjs`, `check-docs.mjs`, `verify-claims.mjs`, `readme-lint.mjs`, **`quick-score.mjs`**, **`loop.mjs`** | T0/T1 |
| TS-detail | `detail-inventory.mjs`, `zoom-coverage.mjs`, `check-detail-budget.mjs` (+ **flicker/moiré detector**), `judge/detail-pairs.mjs`, **`region-crop.mjs`**, **`part-sheet.mjs`**, **`detail-backlog.mjs`**, `check-style.mjs` (engine; INK owns the rules) | **T0** |
| TS-bake | `check-baked.mjs` (+ `--static`), `loop-seam.mjs`, **`baked-diff.mjs`**, `webm-check.mjs`, `inspect` checks `check-inspect.mjs` | T0/T1 |
| RED | Independent red-team defect author. Never sees the checkers. Writes ≥10 art-level defects and CANON mutants as `?mutant=` patches in `src/mutants/*.js` (owned by RED; loaded only with `?mutant`) | before R1 |
| BASE | Matched-effort baseline generator, isolated in its own worktree, no rubric, 60–90 min, best of 3. Output hash-locked before R1 | `eval-private/baseline/*` |

### 4.3 Rig specialists (4), lane: systems (the pelican lane's art depends on it)

| ID | Owns | Brief (outline) | Accept |
|---|---|---|---|
| RG-ride | `src/rig/ride.js`, `src/rig/ik.js`, `test/rig/ride.test.js` | Pedalling weight: pelvis bob in phase with the downstroke, hip rock, ankling, seat contact band ≤0.5 u (BL-08), KOPS and fit (BL-09), cog locked to 3× crank including coasting (BL-02), coasting pose, cadence changes without a phase jump | G3 (all), check-contacts, C5.1 blind speed ranking ≥4/5 in loop, BL-02/08/09 closed |
| RG-events | `src/rig/events.js`, `test/rig/events.test.js` | Hop with g = 2885 u/s², rear wheel lifting after the front, cranks level in the air, landing overshoot (BL-10); wave with the far wing steering; bell thumb-flick; **gulp as a full feeding sequence** (head back more than 28°, bill opens, fish transfers, bulge travels down the neck: BL-15); interruptible and stackable events; all in sim time | check-rig --events, motion-audit --fuzz, check-temporal, C6.4 checklist |
| RG-face | `src/rig/face.js`, `test/rig/face.test.js` | `pose.gaze` system (road, sea, gulls, camera, pointer via pointerLog); avian blink with a nictitating-membrane sweep instead of the human sy squash (BL-14); head-bob stabilisation ratio kept ≤0.2; expression states from character.md | expression sheet (judge/acting), motion-audit --face 120 s, C5.5 items |
| RG-second | `src/rig/secondary.js`, `test/rig/secondary.test.js` | Pouch, crest, tail, scarf (a new chain deformer with a fixed command count), wattles of the far wing; phase lag behind the parent (fixes BL-13's crest leading its parent), wind speed-dependent, hop flings the scarf up | G10 non-zero lag, onion sheets, no jelly (major cap) |

### 4.4 Pelican lane: 1 captain and 10 part specialists

The captain PL-cap owns `src/art/pelican-body.js`, `src/art/pelican-limbs.js` (aggregators), `src/art/pelican/common.js` (shared feather primitives: `scallop()`, `featherRow()`, `keyLine()`, `webbing()`, so every specialist draws in one hand), plus proportions and silhouette. PL-cap doesn't draw parts. PL-cap runs the lane loop and is accountable for C1.3, C4.1, C4.7 and the pelican half of C7.6.

The **detail backlog** column lists the named inventory lines each specialist must deliver (added to the registry at C0 and extended by the scouts). These sum to the pelican target of ≥95.

| ID | Owns (`src/art/pelican/…`) | Detail backlog (inventory lines, target count) | Specific accept |
|---|---|---|---|
| PL-head | `head.js` | skull mass; forehead feather point at the bill base (FM-10 #5); bare facial skin K patch; eye R ring; N pupil; P highlight; secondary glint; upper lid (thick, content, **no fierce orange liner**: BL-28); lower lid; blink nictitating membrane (art for RG-face); cheek scallop edge; ear-covert tuft; nape edge; goggles strap, rim, lens glint, buckle; smile crease (**≥17**) | head3x crops at 4 phases and zoom-4 expression sheet; "content not fierce" J-blind adjective pass in loop |
| PL-bill | `bill.js` | upper mandible; culmen ridge line; tomium (bill edge) line; nostril slit; nail hook; nail highlight; nail under-hook; lower mandible; ramus line; gape or smile corner; growth ticks; bill-tip shadow (**≥12**) | FM-10 #1/#2 in check-anatomy; bill reads at 128 px (thumb) |
| PL-pouch | `pouch.js` | pouch body; O/R stretch texture lines (tagged `data-stretch=sy`); rim fold; highlight crescent; throat continuation into the neck; gulp-bulge variant; drip droplets (**≥7**) | tear test at sy ∈ {0.9, 1.2, 1.45}; pouch present in 100% of frames (G7); ΔL\* pouch vs bill ≥8 |
| PL-crest | `crest.js`, `neck.js` (neck outline art on `neckD`) | ≥7 crest strands (2 designs); nape tuft; crest shadow line; neck mass; feather-flow lines along the neck; front crease; collar ruff under the scarf (**≥8**) | crest count at 3×; neck width 34→24 kept; bulge art lines up with RG-events' bulge param |
| PL-body | `body.js`, `tail.js` | body mass; B key line; contour scallops; coverts rows 1/2/3 (3 variants, overlapping toward the tail); breast buff patch (FM-10 #11, optional); narrow belly-edge halftone band (P dots over B, spacing ≥5); back band; flank shadow; K/P rim-light line; feather-shaft ticks; data-tract rows; ≥5 rectrices; tail coverts; undertail line (**≥16**) | check-style: no large halftone on the body (STYLE-C §2.1); data-tract directions within ±50° |
| PL-wing | `wing.js` | marginal coverts; lesser coverts row; greater coverts row; secondaries N with P edges (FM-10 #8); tertials; alula; wrist bend; far wing flat B silhouette; far-wing coverts line; wave-pose spread variant (**≥11**) | "wing, not a sleeved arm" (STYLE-C §3) in J-anat loop; broad covert base joins the body with no shoulder gap ≥1 u |
| PL-hand | `hand.js` | ≥8 individually countable primaries (N); primary shafts; emargination notches; the fan of ≥4 separate tips around the grip (**no knuckle segmentation**: G7); far-hand primaries; grip-wrap shadow (**≥7**) | G7 fan rule; wrist anchor ≤0.75 u; fan-tip count by check-anatomy |
| PL-leg | `leg.js` | trouser feather edge scallops; thigh tuck; tarsus; ≥4 scale lines (C4.5); ankle knob ("backward knee"); far leg flat B or N (no red dots: BL-28) (**≥7**) | occlusion 12/72 phases; scale lines at 3× |
| PL-foot | `foot.js` | 4 toes, with the hallux as a distinct design; toe segments; 4-toe webbing (totipalmate); web folds; claws; heel pad; far foot flat (**≥7**) | foot-ball anchor ≤0.25 u (10-pt); web count; flat on pedal through ankling |
| PL-scarf | `scarf.js` (slots scarfBack/scarfFront; shape from RG-second's deformer) | scarf body; R/P stripes; knit texture; fringe tassels; knot; trailing-end variant; shadow on body (**≥7**) | follow-through in onion sheets; no halftone on the moving scarf |

Pelican total planned: 17+12+7+8+16+11+7+7+7+7 = **99** (target ≥95).

### 4.5 Bike lane: 1 captain and 7 part specialists

BK-cap owns `src/art/bike.js` (aggregator), `src/art/bike/common.js` (tube, lug, bolt and cable primitives, far-side darkening) and **all `data-anchor` placement** for bike anchors. BK-cap also owns the integer-chain geometry migration with ARCH, and C2.7.

| ID | Owns (`src/art/bike/…`) | Detail backlog | Specific accept |
|---|---|---|---|
| BK-frame | `frame.js` | head, seat and BB lugs (flat plus one line, per styleProfiles.C); BB shell; rear dropouts; front dropouts are BK-cockpit's; tube highlights; tube shadow lines; head badge with a pelican emblem; head-tube bands; lug pinstripe lining; bottle bosses; cable guides; pump pegs; down-tube decal (letters as paths); chainstay protector; seat-stay caps; seat binder bolt; seat-stay bridge (**≥20**) | check-bike angles ±0.5°, nodes ±1 u, 0 gaps at 4 px/u; tube-diameter ratio 28.6/31.8/19 |
| BK-cockpit | `cockpit.js`, `brakes.js` | fork blades; crown plus lining; rake curve; front dropouts; axle nuts and washers; headset cups (top and bottom); locknut; quill stem; stem bolt; swept bar; ribbed grips; bar-end plugs; brake levers with clamps; cable housing; cable; ferrules; cable clips; front and rear calipers; pads; caliper springs (**≥25**) | J.fork.rot = J.bars.rot = 0 across all samples; cable bend radius smooth; mounts 8-connected |
| BK-wheels | `wheels.js` | tyre; tread pattern; sidewall band with a label; rim (2 inks); rim eyelets every 11.25°; spoke nipples; tangential 3-cross spokes (near and far, far ones darker and thinner); hub flanges; hub shell; axle nuts; valve and valve cap (placed between near-parallel spokes); spoke reflector; front and rear valves at different phases; 2-ink blur disc; rim joint (**≥18**) | check-bike spoke parse (67.5°±1°, 16/16); wagon on nipples and tread (no reverse flicker); static-part diff |
| BK-drive | `drivetrain.js` | 48T teeth; 5-arm spider (new slot); chainring bolts; crank arms with highlight; crank bolt caps; pedal bodies; pedal cages; pedal reflectors; spindle nuts; chain plates; pins; rollers; return-run sag; 16T cog teeth; cog lockring; freewheel body; kickstand (**≥17**) | teeth counts; CHAIN_D and pathLength; order ring < chain < spider; rollers seated in tooth valleys in 12 phases (10-pt); fade >45 rpm |
| BK-saddle | `saddle.js` | leather top; rivets; coil springs with coil lines; rails; saddle clip; seatpost; seatpost shadow; saddle bag with straps and buckle; tool roll (**≥10**) | seat-contact anchor; belly-on-saddle pixel test with PL-body |
| BK-basket | `basket.js` (incl. `fishFlop`) | over-under weave; basket rim; base; stays; strap mount; fish ×3 designs (each: scales, fin, gill cover, eye, tail); newspaper wrap; ice glints; fish-flop animation (**≥16**) | basket mounted on structure (C2.6); fish flop deterministic and analytic; gulp handoff position for RG-events |
| BK-fit | `fittings.js` | front and rear fenders; fender pinstripes; stays; stay bolts; mudflap; rear reflector with facets; headlamp body, lens, lens ring, glint, bracket; bottle dynamo with a roller turning at about 30× wheel speed; dynamo wire; bell dome and bell lever (bell clamp is BK-cockpit's); bottle cage and bottle; licence plaque "鹈鹕湾 001" (**≥22**) | 10-pt accessory physics (dynamo speed, lamp brightness vs speed, standlight fade); fittings not in rotating slots |

Bike total planned: 20+25+18+17+10+16+22 = **128** from specialists. Captain-level lines (far crank variant, far pedal, night reflector states, rim light) plus scout backlog top-ups bring it to ≥150.

### 4.6 World lane: 1 captain and 10 specialists (plus the type pair, which rides this lane)

WD-cap owns the aggregators `src/world/{sky,sea,land}.js`, tile maths (`TILE.*` and bake periods `data-bake-period`), depth grading (C13.6 10-pt falloff), and `docs/composition.md` together with DIR (DIR's file; WD-cap proposes via report).

| ID | Owns (`src/world/…`) | Detail backlog | Accept |
|---|---|---|---|
| WD-sky | `sky/bands.js`, `sky/sun.js` | ≥4 sky bands; transition halftone; sunburst wedges; slow rays at about 1°/s; sun disc; quantised sun rings; streak bars; moon disc, craters and 3-ring halo; horizon haze bar (**≥12**) | halftone only as static pattern; ray rotation baked as one animateTransform |
| WD-cloud | `sky/clouds.js`, `sky/life.js` | deco cumulus ×3 designs; cloud base bars; cirrus streaks; far gull flock (distant sizes); kite with tail; biplane towing a bilingual banner (letters via TY-letter's glyph API); stars (2 sizes); constellations, with the Pelican Nebula as an egg for SY-eggs; shooting star; hot-air balloon (**≥14**) | sky ≥35 together with WD-sky and captain lines; nothing competes with the head silhouette (saliency) |
| WD-sea | `sea/bands.js` | ≥3 sea bands (far, mid, near); sea halftone; light and dark wave ticks; foam lines; swell crests; sun glitter path; moon path; horizon line; shore-break surf line (**≥12**) | bands roll gently; glitter tracks `frame.sun.x`; no moiré (flicker detector) |
| WD-boats | `sea/boats.js` | near sailboat (mast, boom, main, jib, forestay and backstay, sheets, pennant, hull stripe, wake); far sailboat; fishing trawler (wheelhouse, outriggers, nets, gulls following); steamer (funnel, smoke band); rowboat; birds on water (**≥12**) | bob and drift analytic; scale per data-size-m |
| WD-town | `land/town.js`, `land/lighthouse.js` | harbour-town house variants ×3; windows (lit at night: `data-light` anchors); roofs; chimneys with smoke; clock tower; church; warehouse; awnings; lighthouse stripes, gallery rail, lamp room, cap, vane; keeper's cottage, door, window, fence (**≥20**) | place detail present in all 6 tods; far-layer "big shapes + a little halftone" rule |
| WD-shore | `land/shore.js` | pier with piles, railing and end lamp; rocks with surf splash; numbered buoys (2 designs); channel marker; sea-wall blocks with mortar joints, coping, drains, stairs; beach: cabanas closed and open, parasols, towels, deck chairs, lifeguard tower, sand castle and bucket, flags (**≥22**) | buoys, pier and rocks are sea-layer or land-layer lines per registry; tile seamless |
| WD-roadside | `land/roadside.js` | guardrail posts, rails and reflectors; bollards; bilingual signpost (paths); bench; mailbox; milestone "鹈鹕湾 3 km"; deco lamp posts (finial, glass, bracket, plinth; different from the draft); phone box; fish stand (striped awning, counter, fish display, price board) (**≥18**) | lamp spacing 20–40 m (check-scale); signage glyphs pass cjk-glyph |
| WD-flora | `land/flora.js` | palms: trunk rings, 2-ink fronds, coconuts, young-palm variant; agave; poppies; dune-grass fans; oleander bushes; bougainvillea on walls (**≥10**) | palms 6–12 m; per-species distinction; sway analytic |
| WD-road | `land/road.js`, `land/foreground.js` | road; road halftone; dashes (about 3 m on, 9 m gap); kerb and kerb stones; drain grates; manhole; road-stud reflectors; painted bike symbol; foreground shrubs; N grass; near poppies; pebbles; fence posts (**≥14**) | tyres meet GROUND_Y; foreground covers ≤8% of the wheels, contact zones ≥70% visible |
| WD-night | `world/night.js`, `src/core/inks/night.js` | quantised 2–3 ring lamp pools; beacon beam sweep; headlamp beam cone and road pool; lit-window glow instanced at `data-light` anchors; star twinkle subset; night reflector glints (**≥8**, counted in the owning layers via the registry) | C7.3 motivated light; night reads as a night poster (J-blind); flash-check safe |
| TY-frame | `src/frame/frame.js` | paper margin; N frame line; inner frame; corner ornaments; registration marks; 7-ink colour bar; paper-speck layer (static); fold crease (static); cinematic letterbox styling; mini logo state (**≥12**) | layer is screen-fixed; letterbox in cinematic; 0 full-screen filters |
| TY-letter | `src/frame/type.js`, `src/frame/glyphs/*` (generated), `tools/glyphs.mjs` | stroke-built deco caps title; inline R; stepped N shadow; tagline bar and tagline; diamond ornaments; 鹈鹕湾 cartouche; round postmark with date ring (correct glyphs; deco label, not pretending to be seal script); ticket stub (ticket No., station names 起点/终点, perforation); edition "No. 07/100"; printer's imprint; small-print caption; route-map inset; scale bar; compass rose; SFX word plates DING!/GULP!/HOP! (**≥18**) | cjk-glyph 0 tofu; all text in the `data-text` manifest; the title card shrinks at about 3 s and never covers the rider (first-look) |

World planned: sea 12+12+(shore sea lines ≈6)+captain ≈ **32**; land 20+(shore ≈16)+18+10+14+captain ≈ **105**; sky 12+14+captain ≈ **35**; type 12+18+captain ≈ **35**.

### 4.7 Systems lane (12)

| ID | Owns | Brief and accept |
|---|---|---|
| SY-fx | `src/fx/fx.js`, `src/fx/particles.js` | Pure `fx(t, distance, events)` (rubric 13.1 #6). Speed lines, dust puffs, landing print-pop impact (≤6 frames, ≤1 per event), gulp droplets, wind ribbons, drifting feathers, bell rings. **≥9 fx lines.** Accept: nofx hides all symbolic overlays; flash-check; reduced-motion honoured |
| SY-cast | `src/fx/cast.js` | Gull flock with a flap cycle, an escort easter egg above 85 rpm, a pelican formation fly-by as a story beat, a gull stealing a fish (optional beat). Accept: C6.6 sheets; deterministic |
| SY-audio | `src/audio/*` | `createAudio(bus,{context})` with injectable OfflineAudioContext: FM bell, freewheel ticks, chain whirr, wind ∝ v², waves, gulls, thump, gloop, compressor; 0 AudioContext before the user gesture. Accept: audio-check, audio-offline spectrogram, G11 |
| SY-ui | `src/ui/ui.js`, `src/ui/styles.js` | Poster-language UI (the same inks, deco lettering via TY-letter's glyph API); ≤5 visible entry points; bottom sheet on phones; visible pause within ≤2 Tabs; download with a visible fallback (BL-23). Accept: ux-matrix, contrast, judge/controls, export-check |
| SY-i18n | `src/ui/keymap.js`, `src/ui/i18n.js`, `src/a11y/*` | Single sources of truth (BL-06); help and README tables generated from them; role=img wrapper name follows language; guards for focus, modifiers and IME. Accept: keys, a11y (axe 0 critical or serious in 10 states), i18n-lint |
| SY-bake | `src/bake/*`, `tools/bake.mjs` | Record-and-replay baker with a T = 24 s loop, SMIL, resolved vars, static fallback (base attributes = hero pose), ≤500 KB gzip target. Accept: check-baked 48 phases, loop-seam 0 px (10-pt), baked-diff heatmap mean ≤6/255 on head crops (C13.2 10-pt) |
| SY-mini | `src/mini/pelican-mini.svg` | **Hand-written** by definition (single reply, no code run; transcript hash in the ledger); ≤16 KB; animated; passes CANON-14. Accept: mini checks |
| SY-perf | `src/core/bands.js`, `src/core/raster-cache.js` (optional, G17-compliant), `tools/merge-static.mjs` | Owns z-band runtime and build-time ink-merge, per-band budgets, LOD tiers, and fixes budget breaches on others' behalf **without deleting detail** (by reporting to the owner if art changes are needed). Accept: G9 (≥55, 10-pt ≥58.5), C10.2 compositing ratio ≤3.0, soak |
| SY-story | `src/story/*`, `src/core/camera.js` | Cold open (first frame in ≤400 ms, no white flash), the 24 s loop with ≤5 beats from beats.md, auto-director, cinematic mode, portrait framing (BL-01), Artifact-panel framing. Accept: first-look, ux-matrix framing, loop-seam, film sheet |
| SY-inspect | `src/inspect/*` | X-ray mode: skeleton, anchors, IK circles, solver readouts labelled "solver", a detail heatmap toggle. Accept: check-inspect |
| SY-eggs | `src/eggs/*` | Egg ladder (Velocipedia nod: a "wrong bike" dream sequence on a key; Pelican Nebula; a gull heist); every egg discoverable without source. Accept: J-explore finds at least 2 by screenshots only |
| SY-pack | `README.md`, `docs/handoff.md`, `docs/claims.json`, `docs/THIRD_PARTY.md`, `LICENSE`, `tools/package.mjs` | Bilingual README, claims with sources, font licences (WenQuanYi, DejaVu), Simon Willison and Gimini credits (G15), poster knockout, contact sheet, deterministic webm. Accept: check-docs, verify-claims, readme-lint, G13 |

### 4.8 Detail production line (7 scouts; REG from 4.1; SY-perf's ink-merge)

| ID | Region (`docs/detail/regions.json`, frozen at C0) | Owns | Job |
|---|---|---|---|
| DS-head | pelican head and neck (rider x 40…290, y −560…−380) | `docs/detail/backlog/head.md` | Read-only. Render `region-crop --region head --vs draft` at 1× and 3×. Do a blind self-inventory of both. List every **missing, weak or undifferentiated** line with a target design sentence, owner and z. Rank by visibility at 1× (lines only visible in inspect mode are worth ≤+0.5) |
| DS-body | pelican body, wings, legs (x −130…130, y −420…−60) | `backlog/body.md` | same |
| DS-drive | frame and drivetrain (x −140…140, y −240…−40) | `backlog/drive.md` | same, plus a "25-part mechanic inventory" check against C2.7 |
| DS-cockpit | bars and basket (x 90…230, y −300…−200) | `backlog/cockpit.md` | same |
| DS-sea | sea and harbour (world y 300…620) | `backlog/sea.md` | same, plus a depth-grading audit |
| DS-land | land and road (world y 620…900) | `backlog/land.md` | same, plus scale plausibility (data-size-m) |
| DS-sky | sky and typography (world y 0…330, plus the frame) | `backlog/sky.md` | same, plus print-language items |

Scouts never edit art. REG merges their backlogs into `quotas.json` (owner → required new lines). Specialists implement those lines. **Detail QA** (an instance of V-D13) verifies them.

### 4.9 Verifiers (13 dimension verifiers and 11 judge pools)

- **V-D1…V-D13**: dedicated per dimension. A fresh instance for every loop iteration and every round, never reused. Each one gets only its dimension's items (from `items.json`), its evidence pack (copied to a random temp dir), the canaries, and read access to the named code files for code-review items. It outputs item judgments with citations, `score.mjs` aggregates them, and each failing item is routed to an owner via `docs/team/owners.json` → `item-owner.json` (that map is part of this proposal's coverage matrix).
- **Pools** (fresh per use):
  - J-blind: perception pool, blind-prompt lint, PNG only
  - J-adv: find ≥5 defects
  - J-valid: validator, calibrated
  - J-detail ×2: blind inventory plus 7-region pairs
  - J-user ×2: cold start on desktop and on 390 px touch, through the screenshot-input harness only
  - J-explore: explorer for eggs
  - J-copy: bilingual copy and glyph review
  - J-a11y: reads the ariaSnapshot
  - J-mech: blind bike mechanic, open inventory first
  - J-anat: ornithologist, FM-10 checklist
  - CLAIMS: claims auditor for README, PR and Artifact text
- Loop verifiers and R-round judges are **different instances**, and R-final judges have never taken part in any earlier round (protocol 7.8 #1).

Role count: direction 4, tooling 9, rig 4, pelican 11, bike 8, world 11, type 2, systems 12, scouts 7, dimension verifiers 13, pools 11. **Total 92**, plus the lead.

---

## 5. Coverage matrix: every criterion → producer → verifier → gate/tool → evidence → loop

Evidence paths are copied verbatim from `rubric.json` (`criteria[].evidence`). Loop ids refer to §6.5. ★ = perceptual core. A machine-readable version is written by `tools/coverage.mjs` at C0 to `docs/team/coverage.json` (G14 requires 100%; this table is the seed).

#### D1 Benchmark canon & instant read (基准正典与一眼可读), weight 11

| Criterion | w | Producer(s) | Verifier (agents) | Automated gate / tool | Evidence artefact | Loop |
|---|---:|---|---|---|---|---|
| C1.1 CANON-14 在每一帧都成立（按渲染像素与 DOM 计，不只看 solver） | 3.5 | RG-ride, BK-cap, PL-foot, PL-hand (anchors) | V-D1 + 3 J-blind CANON + J-valid | check-anchors (+audit), check-benchmark, mutants-art by RED | docs/eval/canon.json（逐帧逐项结果与最坏值）; docs/eval/anchor-audit.json; docs/eval/mutants-art.json; shots/eval/canon/\*.png; docs/eval/judges/canon-\*.json | L-canon |
| C1.2 远近遮挡正确，两条腿分列车架两侧 | 2 | ARCH (SLOTS order), PL-leg, BK-drive, PL-cap | V-D1 + 2 J-adv + J-valid | check-occlusion (?idmap=1) | docs/eval/occlusion.json; shots/eval/idmap/\*.png | L-canon |
| C1.3 ★ 缩略图、剪影、去文字与诱饵对照下一眼可读 | 3.5 | PL-cap (silhouette), PL-bill, PL-pouch, DIR | V-D1 + 5 J-blind (notext, foils, head-mask) | thumb, silhouette, blind-prompt lint | docs/eval/thumb.json（含诱饵区分度与遮头测试）; shots/eval/thumb/\*.png; docs/eval/judges/thumb-\*.json | L-canon |

#### D2 Bicycle engineering (自行车工程), weight 8

| Criterion | w | Producer(s) | Verifier (agents) | Automated gate / tool | Evidence artefact | Loop |
|---|---:|---|---|---|---|---|
| C2.1 菱形车架几何与结构完整 | 4 | BK-frame, BK-cockpit (fork) | V-D2 + J-mech (open fault-find) | check-bike (mask/flood/fit) | docs/eval/bike.json; shots/eval/mech/frame-\*.png | L-mech |
| C2.2 传动：齿数、链条包绕、啮合与层序 | 3 | BK-drive, ARCH (spider slot, integer chain) | V-D2 + code-review | check-bike (teeth, CHAIN_D, order), drivetrain crops | docs/eval/drivetrain.json; shots/eval/mech/drivetrain-\*.png | L-mech |
| C2.3 渲染出来的无滑滚动与视差一致 | 3 | RG-ride (coast), WD-road, WD-cap (tiles), SY-ui (HUD) | V-D2 | check-kinematics, check-noslip | docs/eval/kinematics.json; docs/eval/noslip.json | L-mech |
| C2.4 时间混叠：任何速度、任何媒介下都不"倒转" | 2 | BK-wheels, BK-drive, SY-bake (webm frames) | V-D2 + frame-by-frame direction judge | wagon (pixel), alias report | docs/eval/alias.json; shots/eval/wagon/\*.png | L-mech |
| C2.5 车轮与旋转件保真 | 1.5 | BK-wheels | V-D2 + J-mech hub checklist | check-bike spoke parse + static-part diff | docs/eval/bike.json; shots/eval/mech/hub-\*.png | L-mech |
| C2.6 转向几何、座舱与附件的机械挂载 | 1.5 | BK-cockpit, BK-fit, BK-basket | V-D2 + cockpit checklist judge | check-bike mounts/connectivity | docs/eval/bike.json; shots/eval/mech/cockpit-\*.png | L-mech |
| C2.7 4× 放大下的装配正确性（开放式清点） | 1.5 | BK-cap + all BK-* | J-mech (blind open inventory first) | shoot --set crops (4 px/u) | shots/eval/mech/detail-\*.png; docs/eval/judges/mech-detail-\*.json; docs/eval/mech-assembly.json | L-mech |

#### D3 Contacts, fit & physical dynamics (接触、骑姿与物理), weight 8

| Criterion | w | Producer(s) | Verifier (agents) | Automated gate / tool | Evidence artefact | Loop |
|---|---:|---|---|---|---|---|
| C3.1 脚—踏板、翼—握把、胎—路面：像素级接触 | 3 | PL-foot, PL-hand, RG-ride, BK-wheels, WD-road | V-D3 + seam-finder judge | check-contacts, contact-probe | docs/eval/contacts.json（每个样本的最坏对与可见率）; shots/eval/contacts/\*.png | L-contact |
| C3.2 坐在车座上：体重、承托与平衡 | 2 | RG-ride (BL-08 seat), PL-body (belly contour) | V-D3 | check-rig --seat, seat pixel test | docs/eval/seat.json; shots/eval/seat/\*.png | L-contact |
| C3.3 踩踏生物力学与骑行 fit | 2 | RG-ride (fit, BL-09 KOPS) | V-D3 | check-rig --biomech, biomech sheet | docs/eval/biomech.json; shots/eval/biomech-sheet.png | L-contact |
| C3.4 事件动力学：跳车、落地、滑行、变踏频、单手骑 | 2 | RG-events (hop physics BL-10, coast, cadence change, one-hand) | V-D3 + dense-frame fault-finder | motion-audit --events, dynamics plots | docs/eval/dynamics.json; shots/eval/mech/hop-\*.png; shots/eval/dense/hop-\*.png | L-contact |

#### D4 Pelican species & anatomy (鹈鹕：物种与解剖), weight 8

| Criterion | w | Producer(s) | Verifier (agents) | Automated gate / tool | Evidence artefact | Loop |
|---|---:|---|---|---|---|---|
| C4.1 ★ 物种辨识与野外特征（FM-10） | 3 | PL-cap, PL-bill, PL-pouch, PL-head, PL-wing, PL-foot | V-D4 + 3 J-blind species + J-anat FM-10 | thumb, check-anatomy | docs/eval/species.json; shots/eval/head3x/\*.png | L-anat |
| C4.2 头、喙与喉囊的构造 | 2 | PL-head, PL-bill, PL-pouch | V-D4 + J-anat | check-anatomy (head), head3x crops | docs/eval/anatomy-head.json; shots/eval/head3x/\*.png | L-anat |
| C4.3 颈部形态与头部稳定（gaze stabilisation） | 1 | PL-crest (neck art), RG-face (stabilisation), ARCH (neckD) | V-D4 | motion-audit head-stab ratio, neck width checks | docs/eval/anatomy-neck.json | L-anat |
| C4.4 翼的构造与握把（手臂读作翅膀） | 1.5 | PL-wing, PL-hand | V-D4 + J-anat | check-rig (grip), wing3x crops, fan-tip count | docs/eval/anatomy-wing.json; shots/eval/wing3x/\*.png | L-anat |
| C4.5 腿、全蹼足与踏板 | 1.5 | PL-leg, PL-foot | V-D4 + J-anat | check-rig, foot3x crops, toe/web count | docs/eval/anatomy-legs.json; shots/eval/foot3x/\*.png | L-anat |
| C4.6 羽区结构与物种色彩（风格 C 相对色彩约束，所有时段） | 1.5 | PL-body, PL-wing, INK (6 ink sets) | V-D4 | check-style relative-colour constraints, data-tract audit | docs/eval/anatomy-colour.json; shots/eval/plumage/\*.png | L-anat |
| C4.7 风格化完整性与真实尺度一致 | 1 | PL-cap | V-D4 (script) | check-anatomy scale ratios | docs/eval/anatomy-scale.json | L-anat |

#### D5 Animation craft (动画技艺), weight 9

| Criterion | w | Producer(s) | Verifier (agents) | Automated gate / tool | Evidence artefact | Loop |
|---|---:|---|---|---|---|---|
| C5.1 ★ 踩踏循环的重量与发力 | 2 | RG-ride | V-D5 + 3 J-blind speed ranking | motion-audit, filmstrip (cycle24) | docs/eval/motion-audit.json; shots/eval/filmstrip/cycle-\*.png | L-motion |
| C5.2 ★ 跟随、重叠动作与拖曳 | 2 | RG-second, PL-scarf, PL-pouch, PL-crest | V-D5 + dense-frame fault-finder | onion, motion-audit lag/phase | docs/eval/motion-audit.json; shots/eval/onion/\*.png; shots/eval/dense/secondary-\*.png | L-motion |
| C5.3 弧线、间距与连续性（事件可叠加、可打断、无跳变） | 2 | RG-events, RG-second | V-D5 | motion-audit --fuzz, arcs overlay | docs/eval/fuzz.json; shots/eval/arcs/\*.png | L-motion |
| C5.4 表演节拍：预备、时值、挤压拉伸与交代（X-sheet） | 2 | DIR (timing.md X-sheet), RG-events | V-D5 + J-blind name-the-event | check-temporal, filmstrip ev-* | docs/timing.md; docs/eval/events.json; shots/eval/filmstrip/ev-\*.png | L-motion |
| C5.5 鸟类运动词汇（像鸟在动，而不是穿鸟装的人） | 1.5 | RG-face, RG-second | V-D5 + J-anat (avian motion) | blink strip, head-bob metrics | docs/eval/avian-motion.json; shots/eval/blink-strip.png | L-motion |
| C5.6 状态过渡、smear 与播放质感 | 0.5 | RG-events, SY-story | V-D5 | motion-audit transitions, smear dense frames | docs/eval/transitions.json; shots/eval/dense/smear-\*.png | L-motion |

#### D6 Character, acting & story (角色表演与叙事), weight 8

| Criterion | w | Producer(s) | Verifier (agents) | Automated gate / tool | Evidence artefact | Loop |
|---|---:|---|---|---|---|---|
| C6.1 ★ 角色圣经与可被说出的个性 | 2 | DIR (character.md), RG-face, PL-head | V-D6 + 3 J-blind adjective pick | judge/acting | docs/character.md; docs/eval/judges/character-\*.json; docs/eval/reactions.json | L-acting |
| C6.2 视线系统与面部表演 | 1.5 | RG-face, PL-head (eye/lid art) | V-D6 | judge/acting expression sheet, gaze metrics | docs/eval/face.json; shots/eval/expressions.png; shots/eval/acting/\*.png | L-acting |
| C6.3 ★ 事件笑点在无字幕条带中可读 | 2 | DIR, RG-events, SY-fx (nofx safe) | V-D6 + 5 J-blind gag readout | check-temporal, dense ev strips | shots/eval/dense/ev-\*.png; docs/eval/judges/gags-\*.json; docs/eval/temporal.json | L-acting |
| C6.4 吞鱼：符合生物学的完整进食序列 | 1.5 | RG-events (gulp), PL-pouch, PL-crest (neck bulge), BK-basket | V-D6 + J-anat | motion-audit gulp, gulp filmstrip | shots/eval/gulp/\*.png; docs/eval/gulp.json | L-acting |
| C6.5 循环叙事、入场与自动导演 | 2 | DIR (beats.md), SY-story (auto-director, intro, 24 s loop) | V-D6 + J-blind story retell | loop-seam, interact --idle | docs/beats.md; docs/eval/idle.json; shots/eval/story16.png | L-acting |
| C6.6 配角：鸥、鱼与鹈鹕编队 | 1 | SY-cast, BK-basket (fish) | V-D6 | gull sheets | shots/eval/gulls/\*.png | L-acting |

#### D7 Art direction, style-C fidelity, light & camera (艺术指导、风格 C 保真、光影与镜头), weight 10

| Criterion | w | Producer(s) | Verifier (agents) | Automated gate / tool | Evidence artefact | Loop |
|---|---:|---|---|---|---|---|
| C7.1 ★ 开场 3–5 秒（cold open 与钩子） | 2 | DIR, SY-story (cold open), TY-letter (title card), ARCH (first frame) | V-D7 + 5 J-blind forced choice | first-look | docs/eval/first-look.json; shots/eval/first-look/\*.png; shots/eval/intro-21.png | L-art |
| C7.2 ★ 统一的艺术指导：跨模块、跨时段、UI 与 fx 同一语言 | 2 | INK, WD-cap, SY-ui, SY-fx, TY-frame | V-D7 | judge/palette, check-style | docs/eval/palette.json; shots/eval/grid-30/\*.png; shots/eval/wild/\*.png | L-art |
| C7.3 光影与昼夜：有动机的光 | 2 | WD-night, INK, WD-sky | V-D7 | judge/saliency, tods set | docs/eval/saliency.json; shots/eval/tods/\*.png | L-art |
| C7.4 镜头语言与构图 | 2 | SY-story (camera), DIR (composition.md) | V-D7 + 3 J-blind film sheet | judge/film, ux-matrix framing | docs/eval/camera.json; shots/eval/film-45.png | L-art |
| C7.5 对抗式放大下的完成度（3×、接缝、边缘、切线） | 2 | all art owners (captains route) | 2 J-adv + J-valid | judge/seams, judge/edges, crops | shots/eval/crops/\*.png; docs/eval/zoom-defects.json; docs/eval/seams-edges.json | L-art |
| C7.6 ★ 风格 C 保真与对所选草稿的忠实 | 2 | INK (style keeper), PL-cap, all art | V-D7 + 5 J-blind same-style pairs | check-style | docs/eval/style.json; docs/eval/judges/style-\*.json; shots/eval/style/\*.png; docs/eval/user-notes.json | L-art |
| C7.7 ★ 吸引力与克制（appeal & restraint） | 2 | DIR, INK, REG (detail restraint) | V-D7 + 5 J-blind 3-way / what-to-delete | judge/saliency | docs/eval/appeal.json; docs/eval/judges/appeal-\*.json; docs/composition.md | L-art |

#### D8 Wow: signature moment, field comparison, delight & sound (惊艳：标志性时刻、横向对比、彩蛋与声音), weight 6

| Criterion | w | Producer(s) | Verifier (agents) | Automated gate / tool | Evidence artefact | Loop |
|---|---:|---|---|---|---|---|
| C8.1 ★ 标志性 "how did they do that" 时刻 | 3 | DIR (signature.md), SY-story, RG-events | V-D8 + 3 J-blind open recall | judge/eggs (?moment=) | README.md#signature; docs/eval/moment.json; shots/eval/moment/\*.png | L-wow |
| C8.2 分层盲评横向对比（同类比同类） | 1.5 | whole team; BASE builds matched baseline | 5 J-blind field pairs (>=40) | field.mjs | docs/eval/field.json; shots/eval/field/\*.png（仅私有评估，不发布第三方作品） | R-rounds only |
| C8.3 彩蛋层次与"懂行"的致敬 | 1 | SY-eggs | J-explore (screenshot-only) | judge/eggs, explorer log | docs/eggs.json; docs/eval/explorer.json; shots/eval/eggs/\*.png | L-wow |
| C8.4 程序化声音设计与声音礼仪 | 0.75 | SY-audio | V-D8 + U-user (G16) | audio-check, judge/audio-offline (spectrogram) | docs/eval/audio.json; shots/eval/spectrogram.png; docs/eval/user-checkpoint.json | L-wow |

#### D9 Interaction, accessibility & product UX (交互、无障碍与产品体验), weight 6

| Criterion | w | Producer(s) | Verifier (agents) | Automated gate / tool | Evidence artefact | Loop |
|---|---:|---|---|---|---|---|
| C9.1 上手与可发现性（前 10 秒，不看 README） | 1.5 | SY-ui, SY-story (onboarding hint) | 2 J-user cold start (desktop/touch) | judge/harness, ux-matrix | docs/eval/cold-start-desktop.json; docs/eval/cold-start-touch.json; docs/eval/ux-matrix.json | L-ux |
| C9.2 控件、反馈、微交互与可见性 | 1.5 | SY-ui | V-D9 | ux-matrix, judge/controls, contrast | docs/eval/ux-matrix.json; docs/eval/contrast.json; shots/eval/ui-states/\*.png | L-ux |
| C9.3 交互即表演：输入得到的是角色化的回应 | 1 | SY-ui, RG-events, RG-face (reactions) | V-D9 + J-user | interact | docs/eval/interact.json; shots/eval/interact/\*.png | L-ux |
| C9.4 键盘可操作性与快捷键卫生（单一 keymap 事实源） | 1 | SY-i18n (keymap.js) | V-D9 (code-review) | keys | docs/eval/keys.json | L-ux |
| C9.5 读屏语义与文本替代 | 1 | SY-i18n (aria), ARCH (role=img wrapper) | V-D9 + J-a11y | a11y (axe + ariaSnapshot golden) | docs/eval/a11y.json; docs/a11y/aria.golden.yml | L-ux |
| C9.6 动效安全：减少动态、暂停、光敏与前庭舒适 | 1 | SY-ui, ARCH (reduced-motion live, BL-05), SY-fx | V-D9 (script) | flash-check, reduced-motion shots | docs/eval/flash.json; docs/eval/reduced-motion.json | L-ux |
| C9.7 移动端、竖屏、触屏与嵌入视口 | 1.5 | SY-story (portrait camera, BL-01), SY-ui | V-D9 | ux-matrix (viewports) | docs/eval/mobile.json; shots/eval/mobile/\*.png | L-ux |
| C9.8 双语 zh/en 质量 | 1 | SY-i18n, TY-letter (in-art CJK) | J-copy (bilingual) | i18n-lint, cjk-glyph, check-text | docs/eval/i18n.json; docs/eval/in-art-text.json; shots/eval/text/\*.png | L-ux |

#### D10 Performance & platform robustness (性能与平台稳健), weight 4

| Criterion | w | Producer(s) | Verifier (agents) | Automated gate / tool | Evidence artefact | Loop |
|---|---:|---|---|---|---|---|
| C10.1 呈现帧率与帧节奏（全场景矩阵，基于 trace） | 2 | SY-perf, ARCH (z-bands) | V-D10 (script review) | perf (trace, CPU lock) | perf/perf.json（traces 不入库，只入摘要） | L-perf |
| C10.2 合成层架构与光栅成本 | 1.5 | SY-perf | V-D10 | perf --paint, lint | perf/paint.json; docs/eval/paint-rects.png | L-perf |
| C10.3 主线程 JS 与零垃圾帧循环 | 0.5 | SY-perf, ARCH (main loop) | V-D10 | perf js sampling | perf/js.json | L-perf |
| C10.4 内存与长跑稳定（≥10 分钟 soak） | 0.5 | SY-perf | V-D10 | soak (12 min; 60 min R-final) | perf/soak.json; docs/eval/soak-memory.png | L-perf |
| C10.5 自包含构建、体积预算与启动 | 0.5 | ARCH (build), SY-perf | V-D10 | audit-dist | perf/dist-audit.json; budgets.json | L-perf |
| C10.6 跨引擎：Chromium 与 WebKit 实测，Gecko 静态审计 | 0.5 | SY-perf | V-D10 | xb-webkit (or N/A at R0), xb-audit | docs/eval/xb.json; shots/eval/xb/\*.png | L-perf |
| C10.7 生命周期与环境鲁棒性 | 1 | ARCH (lifecycle, BL-04/BL-18) | V-D10 | robust, contexts | docs/eval/robust.json; docs/eval/contexts.json | L-perf |
| C10.8 控制台卫生与故障隔离 | 0.5 | ARCH (fault isolation per module) | V-D10 | console collector, fault injection | docs/eval/console.json; docs/eval/fault-injection.json | L-perf |

#### D11 Standalone SVG & deliverables (零 JS SVG 与交付物), weight 7

| Criterion | w | Producer(s) | Verifier (agents) | Automated gate / tool | Evidence artefact | Loop |
|---|---:|---|---|---|---|---|
| C11.1 独立 SVG 本身就是最强的参赛作品 | 3 | SY-bake, SY-mini | V-D11 + 3 J-blind CANON on baked frames | check-baked (--static), mini checks | docs/eval/baked.json; docs/eval/baked-static.json; docs/eval/mini.json; dist/pelican-bicycle.svg; dist/pelican-mini.svg | L-bake |
| C11.2 烘焙保真、循环完整与机械不变量 | 2 | SY-bake, WD-cap (bake periods) | V-D11 (script) | check-baked, loop-seam, baked-diff | docs/eval/baked.json; shots/eval/baked-parity.png | L-bake |
| C11.3 确定性预览视频、海报与联系表 | 0.5 | SY-pack, SY-bake | V-D11 + poster knockout judge | judge/package, webm-check | dist/poster.png; dist/contact-sheet.png; dist/preview.webm; docs/eval/package.json | L-bake |
| C11.4 分享与下载：从不静默失效 | 0.5 | SY-ui (download fallback, BL-23), SY-bake | V-D11 | export-check, contexts (sandbox iframe) | docs/eval/export.json; docs/eval/publish-probe.json | L-bake |
| C11.5 README、PR 与 Artifact 的发布包装 | 1 | SY-pack | V-D11 + CLAIMS | check-docs | README.md; docs/handoff.md; docs/THIRD_PARTY.md; docs/eval/docs.json; docs/eval/publish.json（PR 与 Artifact URL） | L-bake |

#### D12 Engineering rigor, verifiability & honesty (工程严谨、可验证与诚信), weight 5

| Criterion | w | Producer(s) | Verifier (agents) | Automated gate / tool | Evidence artefact | Loop |
|---|---:|---|---|---|---|---|
| C12.1 架构与契约一致：单一事实源，由机器强制 | 0.5 | ARCH | V-D12 (code-review) | check-contract, lint (no bare hex) | docs/eval/contract.json; docs/architecture.svg | L-eng |
| C12.2 纯函数、精确周期、属性测试与变异测试的 rig | 1.5 | RG-* (per-file property tests), TS-rig (mutate-rig) | V-D12 | check-rig, mutate-rig, node --test | docs/eval/rig.json; docs/eval/mutants.json; docs/rig-proof.svg | L-eng |
| C12.3 确定性渲染与视觉回归 | 1 | ARCH (pure renderAt), TS-perf | V-D12 | determinism, vr | docs/eval/determinism.json; test/golden/MANIFEST.json; docs/eval/vr/\*.png | L-eng |
| C12.4 一键可复现：从全新克隆构建并验证 | 0.5 | ARCH, TS-judge (verify script) | V-D12 | verify.mjs from fresh clone, dual-build sha | dist/MANIFEST.json; docs/eval/verify.txt; CI 运行链接 | L-eng |
| C12.5 声明溯源与诚信 | 1.5 | SY-pack | CLAIMS auditor | verify-claims, readme-lint | docs/claims.json; docs/eval/claims.json | L-eng |
| C12.6 页内自证：X 光检查模式 | 0.5 | SY-inspect | V-D12 + live test | check-inspect | docs/eval/inspect.json; shots/eval/inspect/\*.png | L-eng |
| C12.7 多智能体过程可验证与 git 卫生 | 1 | LEAD (ledger, worktrees), TS-judge (coverage) | 2 independent V-D12 | coverage, ownership + isolation audits | docs/team/ledger.json; docs/team/coverage.json; docs/eval/rounds/\*.json; docs/eval/ownership.json; docs/eval/isolation.json | L-eng |
| C12.8 可执行、且被证明不空转的基准检查器（Velocipedia-proof；原 C1.4） | 1.5 | TS-dom (check-benchmark), RED (defect gallery) | V-D12 | check-benchmark vs red-team gallery | docs/eval/benchmark.json; docs/eval/velocipedia-gallery.png; docs/eval/redteam-defects.json | L-eng |

#### D13 Detail density & craft (细节密度与工艺), weight 10

| Criterion | w | Producer(s) | Verifier (agents) | Automated gate / tool | Evidence artefact | Loop |
|---|---:|---|---|---|---|---|
| C13.1 ★ 细节清单与对草稿的倍数（逐层） | 3 | REG (registry/quotas) + all detail producers | 2 J-detail (blind inventory + 7-region pairs) | detail-inventory, detail-pairs | docs/eval/detail-inventory.json; docs/eval/judges/detail-\*.json; shots/eval/detail/pairs/\*.png | L-detail |
| C13.2 ★ 鹈鹕的细节与工艺（3× 下每一处都有细节） | 2.5 | PL-head, PL-bill, PL-pouch, PL-crest, PL-body, PL-wing, PL-hand, PL-leg, PL-foot, PL-scarf | V-D13 + J-detail pelican pairs | zoom-coverage (pelican), tear test | docs/eval/zoom-coverage.json; shots/eval/detail/pelican-\*.png; docs/eval/judges/detail-pelican-\*.json | L-detail |
| C13.3 自行车与车载物的细节（硬件工艺密度） | 2 | BK-frame, BK-cockpit, BK-wheels, BK-drive, BK-saddle, BK-basket, BK-fit | V-D13 + J-mech (4x) pairs | zoom-coverage (bike), wagon re-check | docs/eval/zoom-coverage.json; shots/eval/detail/bike-\*.png; docs/eval/judges/detail-bike-\*.json | L-detail |
| C13.4 世界的细节：海、陆、天与港镇 | 2 | WD-sky, WD-cloud, WD-sea, WD-boats, WD-town, WD-shore, WD-roadside, WD-flora, WD-road, WD-night | V-D13 + J-detail world pairs | detail-inventory (world), check-scale, saliency | docs/eval/detail-inventory.json; docs/eval/scale.json; shots/eval/detail/world-\*.png; docs/eval/judges/detail-world-\*.json | L-detail |
| C13.5 印刷、版式与边框细节 | 1 | TY-frame, TY-letter | V-D13 + J-copy (glyphs) | detail-inventory (type), check-text, first-look | docs/eval/detail-inventory.json; docs/eval/in-art-text.json; shots/eval/detail/type-\*.png | L-detail |
| C13.6 细节的纪律：层级、预算与不损美术 | 1.5 | SY-perf (merge-static), REG, INK | V-D13 + 5 J-blind regress pairs | check-detail-budget, perf, flicker/moire detector | docs/eval/detail-budget.json; perf/perf.json; docs/eval/judges/detail-regress-\*.json | L-detail |

### 5.1 Gates → owner → verifier → evidence

| Gate | Accountable producer(s) | Verifier / tool | Evidence | Checked when |
|---|---|---|---|---|
| G1 build & self-contained | ARCH, SY-perf | `shoot --dist` full set, `audit-dist` | docs/eval/console.json; perf/dist-audit.json | every merge-train build |
| G2 benchmark canon | RG-ride, BK-cap, PL-cap | `check-benchmark`, 3 J-blind CANON on hero and baked t=0 | docs/eval/canon.json; docs/eval/benchmark.json | every merge (script), rounds (judges) |
| G3 kinematics & contact | RG-ride, RG-events, PL-foot, PL-hand, PL-body, BK-saddle | `check-rig --seat --events`, `check-anchors` + audit, `check-contacts` | rig.json; canon.json; anchor-audit.json; seat.json; contacts.json | every merge |
| G4 direction / no reversal | BK-wheels, BK-drive, SY-bake | `wagon`, `check-kinematics`, `check-baked`, webm frame review | alias.json; kinematics.json; baked.json | every merge (wagon on detail changes to rotating parts) |
| G5 standalone SVG | SY-bake, SY-mini | `check-baked --static`, `loop-seam`, mini checks | baked.json; baked-static.json; mini.json | nightly bake + rounds |
| G6 honesty | SY-pack | CLAIMS, `verify-claims`, `readme-lint` | docs/claims.json; docs/eval/claims.json | package phase + R-final |
| G7 species & body canon | PL-cap, PL-bill, PL-pouch, PL-hand, PL-foot | 5 J-blind (notext, foils), J-anat | thumb.json; species.json | L-canon, L-anat, rounds |
| G8 phone & framing | SY-story, SY-ui | `ux-matrix`, `first-look`, `contact-probe` | mobile.json; first-look.json | every merge (3 viewports), rounds (full matrix) |
| G9 smooth | SY-perf, ARCH | `perf` (trace, CPU lock, 3× median) + `live-parity` + lint | perf/perf.json; live-parity.json | every merge-train wave (exclusive lock) |
| G10 continuity & determinism | RG-*, ARCH | `motion-audit --fuzz`, `soak`, `determinism` | fuzz.json; perf/soak.json; determinism.json | every rig merge; soak nightly |
| G11 motion & sound safety | SY-ui, ARCH, SY-audio, SY-fx | `flash-check`, `audio-check`, `keys`, `ux-matrix` | flash.json; reduced-motion.json; audio.json; keys.json | L-ux + rounds |
| G12 a11y floor | SY-i18n, ARCH | `a11y`, `i18n-lint`, `cjk-glyph`, `keys` | a11y.json; i18n.json; keys.json | L-ux + rounds |
| G13 deliverables | SY-pack, LEAD | `judge/package`, `export-check`, Artifact read-back diff | package.json; export.json; publish.json | package phase |
| G14 eval validity & process | LEAD, TS-judge | fresh-clone `verify`, dual build sha, `tool-validity`, `coverage`, ownership/isolation audits | verify.txt; MANIFEST.json; tool-validity.json; coverage.json; ledger.json; ownership.json; isolation.json | R0 (validity), every round, R-final |
| G15 no impersonation, attribution | SY-pack, TY-letter (fonts) | `check-docs` font-licence scan, git ls-files check | README.md; THIRD_PARTY.md; LICENSE; dist/index.html; docs.json | package phase |
| **G-DETAIL** | **REG + all 36 art specialists** | `detail-inventory`, `zoom-coverage`, `check-detail-budget`, `perf`, **2 J-detail** | detail-inventory.json; zoom-coverage.json; judges/detail-*.json; shots/eval/detail/pairs/*.png | each detail rung (script) + R1 + R-final (judges) |
| G16 user checkpoint | LEAD | the user | docs/eval/user-checkpoint.json | after R1, before R-final |
| G17 really SVG | SY-perf, ARCH | `check-purity`, `?nocache=1` diff | docs/eval/purity.json | every merge |

---

## 6. Phases, ordering, concurrency, loops

### 6.1 Timeline (wall clock, 3 concurrent lanes)

```
C0 contract v1 + director docs ─┐ (ARCH, DIR, INK, REG; 1 wf, 2 slots)                     ~3 h
T0 tools  ───────────────────────┤ 3 wfs × 2 tool-smiths (TS-*) in parallel with C0 tail     ~5 h
R0 baseline + tool validity ─────┘ wf-round R0 (+ RED writes mutants, BASE starts)            ~1.5 h
B1 lanes: base build ────────────  wf-lane-{pelican,bike,world(+type)} run, systems queued      ~8 h
          (systems lane runs as the 4th lane when a CPU slot frees; rig first)
M  merge train (after each lane wave)                                                    ~0.5 h each
B2 detail ladder rungs 1→2→3 ──── scouts → quotas → specialists → detail QA                  ~7 h
I  integration + dist + bake ──── ARCH + SY-bake + captains                                   ~2 h
R1 full protocol (incl. MR-field, G-DETAIL judges) → G16 #1 to user (workflow split)          ~4 h + user
L  per-dimension loops (R2..R4 scope), 13 loops over 4 lanes                                  ~3 × 3 h
RF R-final (fresh judges, wild pack, sealed hold-out, 60 min soak) → G16 #2                   ~5 h
P  package: webm, poster, README, PR, Artifact                                                 ~2 h
                                                                                   total ≈ 38–46 h
```

### 6.2 Workflow files (all new; v0 is kept for history)

| File | Purpose | Concurrency |
|---|---|---|
| `docs/team/wf-c0.js` | ARCH freezes contract v1 (parts, z-bands, hooks, slots, integer chain); DIR writes docs; INK writes ink sets; REG writes registry, quotas, regions | 2 |
| `docs/team/wf-tools.js --group {dom,rig+bake,perf+ux,judge+detail}` | tool-smiths build T0, then T1; each tool ends with `tool-validity` | 2 per wf, 3 wfs |
| `docs/team/wf-round.js --round R0/R1/R2../RF --scope all/dims` | runs MR-* scripts, builds evidence packs, spawns judge pools, `score.mjs` → scorecard | 2 (judges queue) |
| `docs/team/wf-lane.js --lane pelican/bike/world/systems --stage B1/B2/L` | lane controller: runs specialists 2 at a time in critical-path order, runs acceptance tests itself, calls lane verifiers | 2 |
| `docs/team/wf-detail.js --rung 1/2/3` | scouts → REG quotas → dispatch to lanes (by writing `docs/detail/quotas.json`; lanes pick them up) → detail QA | 2 |
| `docs/team/wf-merge-train.js` | ownership audit → merge lane branches → build → gates (G1, G3, G4, G9, G17, check-style, detail-inventory, vdiff vs previous build) → accept or bounce per branch | 1–2 |
| `docs/team/wf-dim-loop.js --dim D4` | one dimension loop (§6.5) | 2 |
| `docs/team/wf-package.js` | package, PR, Artifact | 2 |

### 6.3 Critical path inside lanes

- **Pelican lane:** PL-cap (proportions, silhouette, `common.js` primitives; needs RG-ride's pose) → {PL-head ∥ PL-bill} → {PL-pouch ∥ PL-crest} → {PL-body ∥ PL-wing} → {PL-hand ∥ PL-leg} → {PL-foot ∥ PL-scarf} → PL-cap cohesion pass. Head and bill come first because C1.3, C4.1 and C6.1 (all perceptual core) depend on them.
- **Bike lane:** BK-cap (integer chain geometry, anchors, `common.js`) → {BK-frame ∥ BK-wheels} → {BK-drive ∥ BK-cockpit} → {BK-saddle ∥ BK-basket} → BK-fit → BK-cap assembly pass (C2.7).
- **World lane:** WD-cap (tiles, bands, depth grading) → {WD-sky ∥ WD-sea} → {WD-town ∥ WD-shore} → {WD-roadside ∥ WD-flora} → {WD-road ∥ WD-cloud} → {WD-boats ∥ TY-letter} → {TY-frame ∥ WD-night} → WD-cap cohesion pass.
- **Systems lane:** {RG-ride ∥ SY-perf} run first, at the very start of B1, because the pelican lane needs poses and everyone needs band budgets. Then {RG-events ∥ RG-second} → {RG-face ∥ SY-story} → {SY-ui ∥ SY-i18n} → {SY-fx ∥ SY-cast} → {SY-audio ∥ SY-bake} → {SY-inspect ∥ SY-eggs} → SY-mini (hand-written, after the final art exists) → SY-pack (in phase P).

A specialist who finishes early takes the next item from the lane queue. Two agents per lane are always busy. Each specialist does **at least 3 visual iterations** on `part-sheet` (12 phases × {golden, night} at 3×) and on `region-crop --vs draft`.

### 6.4 Merge train and regression protection

After each lane wave (about every 2–3 specialists), `wf-merge-train` merges branches in the order systems → bike → pelican → world, then runs:
1. `ownership.mjs` (foreign edits → bounce).
2. `build`, `lint`, `check-contract`, `check-style`, `check-purity`.
3. The G3/G4 scripts (check-rig, check-anchors, wagon).
4. `detail-inventory` delta and `check-detail-budget`.
5. `perf --quick`: the exclusive lock, 1 run per scene, used as a quick gate. The full 3× median runs nightly.
6. **`vdiff`** against the previous accepted build, masked by owner. Pixel changes outside the merging owner's regions get flagged and sent to the captain, which catches accidental regressions to other people's art.
7. A saliency check (rider saliency ≥1.4, DIR veto).

A failed step bounces only the offending branch, with the report routed to its owner.

### 6.5 Per-dimension loops (loop-until-threshold)

Each loop `L-<name>` (from the matrix) is a `wf-dim-loop.js` run with this state machine:

```
state = docs/team/loops/<dim>.json  {iter, scores[], openItems[], stalls}
repeat (max 3 judged iterations; script-only fix passes don't count):
  1. run the dimension's script set (MR subset) → machine ceilings; any gate fail → route to owner → fix → rerun (≤2 script passes)
  2. build evidence pack for the dim (+2–3 canaries from judge/canary, +1 degraded version)
  3. fresh V-D<n> judges atomic items → quick-score.mjs → s_c per criterion, S_d
     (judge discarded & replaced if canary recall < 80% or degraded version not ≥2 lower)
  4. perceptual-core criteria in dim → also run their blind panels (reduced n=3 in loops; full n=5 in rounds)
  5. STOP if S_d ≥ 9.3 AND every criterion ≥ 8 AND core criteria ≥ 8.5 AND no validated major
     STALL if ΔS_d < 0.3 on 2 consecutive iterations → escalate (6.6)
  6. route failing items (item-owner.json) → producers (≤2 concurrently) with the items, citations, crops
  7. producers fix in their lane worktree → merge train → goto 1
```

Loop schedule, by dependencies and weight:

| Wave | Loops (parallel wfs) | Why this order |
|---|---|---|
| L-wave 1 | **L-canon (D1)**, **L-mech (D2)**, **L-contact (D3)** | A canon or contact failure caps the total (G2 ≤40, G3 ≤50), so these loops run first |
| L-wave 2 | **L-anat (D4)**, **L-detail (D13)**, L-perf (D10) | Detail and anatomy share the pelican files, so they run as **one combined pelican loop pass**: V-D4 and V-D13 judge the same build and their failures merge per owner. L-perf checks straight away that the detail didn't break G9 |
| L-wave 3 | **L-motion (D5)**, **L-acting (D6)**, **L-art (D7)** | Motion and acting sit on top of settled art; D7 judges the fully detailed frame |
| L-wave 4 | L-wow (D8), L-ux (D9), L-bake (D11), L-eng (D12) | Mostly systems-lane owners; they can overlap with wave 3 on free lanes |

Thresholds: internal target **9.3 per dimension** (floor 9.0). Detail loop: inventory ≥3.5× overall and ≥2.0× per layer, zoom-coverage ≥97% (pelican) / ≥95% (bike), J-detail 7/7 regions "more and better", perceived inventory multiple ≥3.0.

### 6.6 Escalation when a loop stalls

1. **Triage by DIR and the captain.** Is the item blocked by art direction, by the contract, or by a skill ceiling?
2. **Best-of-2 part tournament.** A second fresh specialist builds the same part file on a branch (`?ablate=` switches between the versions). 3 J-blind forced-choice picks decide, the winner is merged, and the loser is archived. This is used only for perceptual-core parts (head, bill, pouch, wing hand, pedal-stroke weight, cold open).
3. **Contract change** via ARCH, re-freezing the affected files and re-running the other loops' scripts.
4. After 3 stalls: accept the gap, record it in `docs/handoff.md` and in the honest scorecard.

### 6.7 Detail ladder (G-DETAIL / D13 in depth)

| Rung | Target (inventory vs draft 129) | Entry | Work | Exit gate (scripts) | Verifier |
|---|---|---|---|---|---|
| Rung 0 (B1) | parity with the draft (1.0×) and every draft line re-created | B1 specialists | re-create every baseline line from `detail-baseline-C.json`, now rigged; **no regressions**: a missing draft line is a bug | inventory ≥129 and all baseline names present | REG script only |
| Rung 1 | **1.8×** (≈232), pelican ≥1.8×, bike ≥1.8× | scouts' first backlog | catalogue items first (pelican 11, bike 14, world lists, type 6) | catalogues ≥80% present; zoom-coverage ≥80% | Detail QA (V-D13 instance) + DIR veto |
| Rung 2 | **2.7×** (≈348, clears the gate with margin), pelican ≥2.5×, bike ≥2.5×, others ≥2.0× | scouts' second pass on the rung-1 build | the scout backlog is ranked by 1× visibility; variants (open cabana, far or near boats); texture treatments (weave, scales, hatching) | G-DETAIL (1)(2) scripts pass; perf per band within budget | Detail QA + 2 J-detail (a rehearsal; the result doesn't count) |
| Rung 3 | **3.57×** (≥461, 10-pt), every layer ≥2.0×, fx ≥6 | the rehearsal J-detail findings | fill weak regions; storytelling details tied to beats (fish stand, trawler coming home); night-state details | 10-pt script anchors; `check-detail-budget` 10-pt (gzip per layer in budgets.json; depth falloff) | L-detail loop |

Rules the scouts, specialists and QA share:
- **Visibility first.** A line counts only if it's ≥2 px² at 1×/close and <50% occluded (ID-map). Scouts rank candidates by 1× visibility, because 10-pt extras count only if a blind judge notices them at 1×, or if they're inspect-mode extras capped at +0.5.
- **The anti-cheat rules apply to us too.** A variant must be visibly different (64×64 SSIM <0.95). REG rejects "numbered clones".
- **Style C always holds.** Detail uses the 7 inks, lines and flat shapes. Halftone only on static layers, never on the rider body in bulk. Rotating parts get detail only if wagon stays green.
- **Hierarchy.** Far layers get big shapes plus a little halftone; near layers get simple silhouettes. The rider always has the highest edge density per area. zoom-coverage and saliency enforce this on every rung.
- **Budget through engineering.** Ink-merge static parts, `<use>` for repeats, seeded generators. A fix that deletes a detail line fails the merge train (inventory delta < 0 for that owner → bounce).
- **Every specialist's self-check** = `part-sheet` + `region-crop --vs draft` at 1× and 3× + `detail-backlog --owner <id>` (quota met, all lines visible) + `zoom-coverage --owner <id>` (cells in the owner's region).

### 6.8 Rounds and stop conditions

- **R0:** the tool-validity pass (every T0 tool: known-good passes, mutant set fails, two runs agree). Also re-verify BL-01…BL-32, re-count the draft baseline and hash-lock it, freeze ink sets, publish probe, file N/A and sealed hold-out hashes, and have RED's ≥10 art defects committed. **No builder starts until R0 passes.**
- **R1:** full protocol, including MR-field, G-DETAIL judges and the blind panels at full n. Then the **workflow ends** and LEAD sends the G16 checkpoint to the user (contact sheet, webm, Artifact link, detail comparison sheet), in Chinese.
- **R2…R4:** the per-dimension loops of §6.5, plus the user's top 3 comments. A comment is routed like a failing item with severity "user" and blocks STOP for its dimension until it's resolved.
- **Global STOP (go to R-final)** when one of these holds:
  - (a) every loop has STOPPED, all gate scripts pass, and `score.mjs` on the last loop scores shows T_internal ≥ 93.5 with every dimension ≥ 9.3;
  - (b) 3 loop waves are done (the rubric's cap of 3 fix rounds);
  - (c) no dimension improved by ≥0.3 in the last wave.
- **R-final:** fresh judges only, with the wild pack, the sealed hold-out, the 60 min soak, a 10 min free fault-hunt per J-lens, and adversarial re-checks on every criterion scoring ≥9. The score is reported as is, never cherry-picked. Then G16 #2.
- **Pass claim** only if the target holds **and** G16 passes. Otherwise the wording is "同模型自评达标，待用户确认" or an honest statement of the gap.

### 6.9 Concurrency and CPU accounting

- **Lanes:** 3 concurrent lane workflows (6 agents) + LEAD. The 4th lane runs when a slot frees. Judge rounds run while lanes are idle (R1, RF) or in place of a lane (loops).
- **Chromium:** at most 3 browsers through the `pb-shoot` semaphore; perf and soak take the exclusive lock and pause the others. Self-check sheets use `?solo=<owner>` at a small size, about 3× cheaper than full scenes.
- **Worktrees:** `git worktree add ../pb-wt/<lane> lane/<lane>`. `node_modules` is symlinked, never installed per worktree. Shots go to `shots/<owner>/` inside each worktree (git-ignored).

---

## 7. New automated tooling (beyond the phase-0 tools)

All tools from rubric 13.3 (T0/T1/T2) are in scope and owned as in §4.2. The depth design adds these, all of them T0 except where noted:

| Tool | Owner | What it does | Used by |
|---|---|---|---|
| `tools/part-sheet.mjs` | TS-detail | `?solo=<owner>` over the rider skeleton, 12 crank phases × {golden, night} × {1×, 3×}, plus event peaks → one sheet and single native-scale crops | every specialist's self-check |
| `tools/region-crop.mjs` | TS-detail | same-position crops of **draft vs build** at 1×/3× for the 7 frozen regions (draft rendered from `drafts/C-poster/keyframe.svg` with a registration transform) | scouts, specialists, J-detail |
| `tools/detail-backlog.mjs` | TS-detail | registry vs quotas vs inventory → per-owner remaining list; fails when the quota isn't met or a line is invisible | lane acceptance |
| `tools/detail-inventory.mjs`, `zoom-coverage.mjs`, `check-detail-budget.mjs` (with the **flicker/moiré detector**: high-frequency energy of adjacent-frame diffs during a pan) | TS-detail | the rubric tools | G-DETAIL, D13 |
| `tools/filmstrip.mjs` **cycle24 sheet** | TS-rig | RS-cycle24 true-time 24 frames per crank turn at 40/60/90 rpm, plus the `?skeleton=1` overlay | D1, D3, D5 |
| `tools/vdiff.mjs` | TS-perf | visual diff between two builds or commits, per-owner masks (from `?idmap`), heatmap plus changed-region list | merge train |
| `tools/baked-diff.mjs` | TS-bake | live `renderAt` vs baked SVG (as `<img>`) at 48 phases, heatmap, per-region mean abs diff (head crop ≤6/255) | L-bake, C13.2 10-pt |
| `tools/keys.mjs` (key-press driver) | TS-ux | drives every keymap entry with Playwright (focus states, modifiers, IME composition, repeat); screenshots before and after; checks the reaction | G11, G12, C9.4 |
| `tools/soak.mjs` (perf soak) | TS-perf | 12 min seeded monkey, 60 min at R-final, a t≈1e6 s time warp; heap, nodes, listeners; NaN watch | G10, C10.4 |
| `tools/merge-static.mjs` | SY-perf | build-time ink-merge: flatten each static part group into one `<path>` per (fill, stroke, width), keeping the `data-detail` roots as zero-size markers with bbox metadata so the inventory still works | C13.6, G9 |
| `tools/ownership.mjs` | TS-judge | git diff vs `docs/team/owners.json` → ownership.json | merge train, G14 |
| `tools/quick-score.mjs` | TS-judge | `score.mjs` restricted to one dimension, for loop decisions (marked "internal, not reportable") | loops |
| `tools/loop.mjs` | TS-judge | reads and writes `docs/team/loops/<dim>.json`, computes the STOP/STALL decision | wf-dim-loop |
| `tools/lib/lock.mjs` | TS-perf | the 3-slot Chromium semaphore plus the exclusive CPU lock | all Playwright tools |
| `tools/glyphs.mjs` | TY-letter | font → path glyph cache for DejaVu and WenQuanYi, with licence manifest output | TY-letter, SY-ui, WD-roadside |

---

## 8. Prompt outlines

### 8.1 COMMON v1 preamble (all producers)

```
You are <ID>, one of ~90 specialists building "Pelican Bay" (鹈鹕湾), style C (WPA/art-deco screen-print
travel poster). The user demands FAR more detail than the draft ("我需要你最终教出来的版本细节比 draft 多很多").
READ FIRST: CONTRACT.md (v1: parts, bands, hooks), docs/STYLE-C.md, docs/rig-spec.md, src/contract.js,
docs/character.md, docs/composition.md, drafts/C-poster/{keyframe,closeup}.png (and gen.mjs for technique),
your backlog in docs/detail/quotas.json (owner=<ID>), and ONLY the rubric items listed below.
YOU OWN: <files>. Never edit anything else; put requests in contractRequests.
WORKTREE: <path>. Shots: shots/<ID>/. Acquire Chromium via tools/lib/lock.mjs (automatic in tools).
LOOP (≥3 visual iterations): build → node tools/part-sheet.mjs --owner <ID> → node tools/region-crop.mjs
--owner <ID> --vs draft → READ the PNGs at native scale → fix. Then run your acceptance commands:
<list>. Every detail line: root has data-detail="<layer>:<O|T>:<name>" with a registered name, visible at 1×
or 3×, style-C inks only, no halftone on moving parts, drawn with src/art/<group>/common.js primitives.
BUDGET: your band's path/raster allotment is <n>; use <use>, seeded generation; never delete detail to fit.
REPORT (schema): files, summary, detailLines[{name, crop}], before/after crops, acceptance outputs,
budgetDelta, contractRequests, knownIssues. You never score yourself.
```

### 8.2 Role-specific outlines (examples; the others follow the same template)

- **PL-bill:** "Own `src/art/pelican/bill.js` (slots billUpper and billLower, z 10–39). Deliver the 12 lines in your backlog. FM-10 #1 (long, straight, flat upper mandible with a culmen ridge) and #2 (R hooked nail overlapping the lower tip) must read at 128 px *and* at 3×. The gape line turns up slightly, so the expression stays content (character.md). Acceptance: `check-anatomy --part bill`, `thumb --size 128 --notext`, `detail-backlog --owner pl-bill`, `zoom-coverage --owner pl-bill ≥97%`."
- **PL-hand:** "Own `hand.js`. At the grip, the ≥8 N primaries fan into ≥4 separated tips wrapping the grip. They must never read as fingers: no knuckle segmentation (G7). Primary shafts and emarginations are 3× lines. Wrist anchor `pl-wristNear/Far` ≤0.75 u (≤0.25 is the 10-pt). Check the wave-pose release frames in `part-sheet --events wave`."
- **BK-wheels:** "Own `wheels.js`. Tangential 3-cross spokes (67.5°±1° hub-to-rim offset, 16 pulling and 16 pushing, near and far flanges alternating, far spokes use `-far` ink). Eyelets every 11.25°, nipples, valve between near-parallel spokes, a valve phase on the front wheel different from the rear, and a 2-ink blur disc with physically derived ghost span. Every periodic detail you add must keep `wagon.mjs` positive at 20–110 rpm; ring details must be pre-merged into one path per ring."
- **WD-town:** "Own `town.js` and `lighthouse.js` (layer L-hills-far/L-lighthouse via WD-cap's aggregator). The harbour town is the poster's second read. Keep it large and simple, with a little halftone, 3 house designs, windows as `data-light` anchors for WD-night, chimneys with baked smoke. Scale via `data-size-m`. Detail must lose to the rider in `judge/saliency` (ratio ≥1.4)."
- **DS-* scout:** "Read-only. Run `region-crop --region <r> --vs draft` at 1× and 3×. First list everything you see in each crop blind, without knowing which is the draft. Then list every line that is missing, weak or undifferentiated compared with the catalogue and the style bible. For each line give {name, layer, O|T, one-sentence design in style C, owner, z, expected 1× visibility, risk to saliency}. Write `docs/detail/backlog/<r>.md`. Don't propose anything that breaks STYLE-C §2 or §4."
- **V-D13 (Detail QA / dimension verifier):** "You judge only D13 items from items.json using the evidence pack at <tmp>. The pack contains canaries you aren't told about. First write observations per region, then pass/fail per atomic item with an evidence path. Count catalogue items yourself from the crops; don't trust the inventory JSON. Flag any detail that violates style C or competes with the rider. No 1–10 impressions."
- **J-detail:** "You see pairs of images of the same region, randomly placed left and right. (1) List everything visible in image A, then in image B. (2) For each region: which has more detail, which is better, and does either contain detail that breaks the limited-ink print style or pulls the eye from the main subject?"
- **Captains (PL-cap, BK-cap, WD-cap):** "You don't draw parts. You own the aggregator and common primitives, the silhouette and proportion (PL-cap), assembly correctness (BK-cap), depth grading (WD-cap). After each wave, run the lane's cohesion review (part-sheet for all owners, vdiff), then write fix tickets to owners via the lane controller."
- **Lane controller (wf-lane.js, script, not an agent):** it runs each specialist's acceptance commands itself, rejects a report whose commands fail, and re-dispatches with the failure output (≤2 retries before escalating to the captain).

---

## 9. Anti-inflation measures specific to this design

1. **Producers never verify their own dimension.** A specialist's acceptance tests are scripts, and the dimension verifiers are separate fresh instances. Captains triage but never score.
2. **Loop scores are internal.** They're labelled "internal, not reportable" and computed with `quick-score`. Only the R-final scorecard gets published.
3. **Canaries in every loop pack.** A loop verifier with recall below 80% gets discarded, same as in rounds.
4. **The loop target (9.3) is above the reporting floor (9.0).** This budgets for fresh-judge regression; R-final judges have never seen the loop builds.
5. **The detail count is verified three ways:** the inventory script, zoom-coverage, and J-detail's blind listing (perceived multiple). REG is the producer's bookkeeper, never the verifier.
6. **Sealed hold-out and wild pack** stop the team tuning details to the fixed crops. Scouts use RS-detail regions, and R-final also judges wild frames.
7. **Visible extras only.** Inspect-only details are capped at +0.5 per criterion, and scouts rank by 1× visibility.

---

## 10. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | **Style drift across 36 art hands** (each specialist draws "their" way) | High | C7.2, C7.6 (core) | shared `common.js` primitives per group; INK runs check-style on every merge; the captain runs a cohesion pass after every wave; DIR veto; RS-style pairs judged in L-art |
| 2 | **Detail becomes noise** and appeal drops (C7.7, C13.6 cap) | High | core H multiplier | saliency gate per merge (≥1.4), depth falloff metric, DIR veto per rung, ablation A/B for any line flagged "distracting" |
| 3 | **Perf collapse** under 3.5× detail with software rasterisation (BL-17: C at 19–22 fps in phase-0) | High | G9 → cap 60 | z-bands first (C0), ink-merge, per-band budgets gated on every merge, rider-band detail ink-merged per slot, LOD tier fixed for evaluation, SY-perf as a dedicated owner |
| 4 | Integration conflicts between parts sharing a slot (z fights, seams at joins) | Medium | C7.5, C3.1 | PART_Z ranges, anchors owned by the captain, vdiff owner masks, J-adv seam hunts in L-art |
| 5 | Wall clock (~40 h) | Medium | moderate | 3 concurrent lanes, critical-path ordering, script gates before judges, full protocol only at R1/RF |
| 6 | Loop thrash (fix one dimension, regress another) | Medium | several dims | merge train runs all gate scripts + vdiff every time; loops in dependency waves; a drop ≥1 in any dimension must be explained |
| 7 | Same-family judge correlation and inflation | High | honesty | canaries, forced choice, fresh instances, G16 user checkpoint, the self-assessment label |
| 8 | Specialists over-fit to crops (details only visible in RS-detail) | Medium | 10-pt extras don't count | visibility ranking, wild pack, sealed hold-out |
| 9 | Contract churn after C0 | Low–Med | many files | ARCH-only changes, migration notes, affected loops re-run |
| 10 | Shared-FS accidents (tools run against the wrong worktree) | Medium | false evidence | tools resolve ROOT from their own path; the ledger records the worktree and sha for every evidence file |

---

## 11. Why this design maximises the rubric

- **D13 (10) and G-DETAIL (cap 60):** 36 art specialists each carry a named, registered quota. Seven scouts keep the backlog grounded in same-position draft comparisons. A three-rung ladder aims at the 10-point anchors (≥461 lines, every layer ≥2.0×), and three independent checks (inventory, zoom-coverage, J-detail) verify the count.
- **D1, D2, D3, D4 (35):** each catalogue region, contact and mechanism has one owner whose acceptance test *is* the relevant script (check-anchors, check-bike, check-contacts, check-anatomy). The loops for these dimensions run first.
- **D5, D6, D7 (27):** the rig is split into ride, events, face and secondary. The director's documents come before any build. The style keeper and the captains protect cohesion against the fragmentation that depth creates.
- **D8–D12 (28):** one systems owner per concern, tools built and validated before builders start, and an honest packaging owner.
- **Stop conditions tie directly to the rubric's pass line.** The internal margin is 9.3, and the reportable score comes from R-final plus the user's own G16 approval.
