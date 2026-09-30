## 制作过程 · How it was made

**Everything was made by one model, `claude-opus-5-5` (Claude Code, effort xhigh), in one cloud session.** This includes all sub-agents and all "judges". There are no other AI models or services, and in particular no "ChatGPT 6 Astra", which doesn't exist as a tool here. **Blender was not used either**: it isn't installed, and it would produce raster frames rather than vector art. The "independent judges" are fresh contexts of the same model with no shared memory. They are **not** different models or human evaluators.

The toolchain is Node 22, esbuild, and Playwright with headless Chromium (software rendering, 4 CPUs). Chromium served as the render farm and the test harness. The fonts are DejaVu Sans Bold and WenQuanYi Zen Hei, turned into glyph outlines at build time, so the pages carry no font files.

| Stage | Agents | What |
|---|---|---|
| Rig design | 1 | Geometry, IK reach checks, module contract (`docs/rig-spec.md`) |
| Phase 0 (lead) | — | Contract, pure pose solver, palette, camera, runtime, tools |
| Style drafts | 5 + 1 | Five full keyframes in different styles. **The user chose C (retro travel poster).** |
| Rubric | 8 + 1 + 2 + 1 | 8 expert lenses → synthesis → 2 red-team passes → final rubric (`RUBRIC.md`, `rubric.json`: 13 dimensions, 18 gates, including G-DETAIL ≥ 2.5× the draft's detail) |
| Team design | 3 + 2 + 1 | 3 designs derived backward from the rubric → 2 judges → `TEAM.md`. The user chose the **fast** variant over the full 38-hour plan. |
| Build | 12 | Rig, pelican body, limbs, bike, sky + palette, sea, land, fx, print, UI, audio, baker (disjoint file ownership) |
| Journey | 3 | Long non-repeating route, 13 easter eggs, weather/encounter director (added at the user's request) |
| Integrate → review → fix → final | 1 → 4 → 6 → 1 | The 4 grouped judges scored all 13 dimensions, and the fixes went to the owners who had blockers or majors |
| Perf | 1 | Split the scene into 42 composited `<svg>` sheets: 40 → 60 fps |

**Measured at the end (`node tools/…`, headless Chromium 1600×900):**
- `check-rig`: foot-to-pedal and wing-to-grip error 0.0000 over 3 × 1440 crank samples, 0 failures.
- `detail-inventory`: **392 visible detail items vs the draft's 129 (3.04×)**. G-DETAIL passes.
- `check-eggs`: 13/13 eggs trigger, with 0 console errors.
- `bake` + `check-baked`: pass (0 hard, 2 soft).
- `shoot --dist`: 43 shots, 0 console errors.
- `--perf`: **59.5 fps**, frame p95 16.8 ms, 5948 DOM nodes. JS p95 is **2.6 ms, which misses the 2 ms budget**.

**Known gaps (honest list):**
- JS p95 is above budget.
- The baked SVG is 2.6 MB, over the 1.5 MB target.
- The last rubric review was run before the final fix round and the perf pass, and the build did not re-score afterwards. The pre-fix scores were: D1 7.5, D2 8, D3 7, D4 8, D5 6, D6 6.5, D7 6.2, D8 7, D9 6.5, D10 3.5, D11 6.5, D12 5.5, D13 7.4. Those scores are below the rubric's target of 9. The fast variant intentionally ran only one fix round.
