# Beat sheet · 节拍表

Two clocks run the acting:

1. **The baked loop** (`dist/pelican-bicycle.svg`, src/bake/bake.js): a seamless **4 s** rider loop (4 crank turns at
   60 rpm), with the city on its own **60 s** band (an integer 15 rider loops, so both re-align once a minute) and three
   egg cameos on prime periods (41, 53, 67 s). `BAKE_DEFAULTS.story` is empty, so the zero-JS file has no rig events:
   the loop is pure riding (pedal cycle, breathing, scarf, blinks on the rig's own schedule). A storied bake is
   available: `node tools/bake.mjs --period 24 --story "wave@8,bell@16"`.
2. **The live page** (idle, no input): the director fires beats from encounters on the route (src/world/director.js
   lapScript) and the lead's beat keeper (src/main.js `keepBeats`) fills the holes and breaks up repeats.

## Live idle beat sheet, first lap (measured: `node tools/check-beats.mjs --seconds 250 --json shots/verify/beats.json`)

Targets (rubric C6.5): 5–15 beats per 90 s, no gap above 12 s, never the same type twice in a row.

| t (s) | beat | source |
|---|---|---|
| 11.5 | wave | director |
| 20.3 | bell | director |
| 29.8 | gulp | director |
| 36.7 | bell | keeper:interleave |
| 43.8 | gulp | director |
| 50.4 | wave | keeper:interleave |
| 57.2 | gulp | director |
| 62.6 | hop | director |
| 68.3 | wave | keeper:rainbow |
| 76.8 | bell | keeper:gap |
| 82.2 | wave | keeper:kites |
| 90.7 | bell | keeper:gap |
| 99.3 | hop | keeper:gap |
| 110.4 | wave | director |
| 119.0 | bell | keeper:gap |
| 127.5 | wave | keeper:gap |
| 136.0 | bell | keeper:gap |
| 145.1 | hop | director |
| 153.7 | bell | keeper:gap |
| 156.8 | wave | director |
| 165.4 | bell | keeper:gap |
| 173.9 | wave | keeper:gap |
| 182.4 | hop | keeper:gap |
| 191.0 | bell | keeper:gap |
| 198.2 | gulp | director |
| 206.7 | bell | keeper:gap |
| 213.1 | wave | keeper:interleave |
| 219.9 | bell | director |
| 228.4 | hop | keeper:gap |
| 239.0 | wave | director |
| 247.5 | bell | keeper:gap |

Source key: `director` = an encounter (cyclist → wave, cat → bell, gulls / fish / drink → gulp, puddle / pothole →
hop); `keeper:gap` = the courier's own beat when waiting for the next encounter would leave a gap above 11.5 s;
`keeper:interleave` = a different beat placed halfway between two encounters of the same type; `keeper:kites` /
`keeper:rainbow` / `keeper:fireworks` = reactions to the sky set pieces, which have no rig event of their own.

The keeper backs off for 8 s after any viewer input, never fires within 3 s of another beat or 2.8 s before a
scheduled one, and its filler hop is limited to one per 30 s.

## The signature beat

Lap km 13, entering the neon tunnel: **SIGNAL LOST** (1.6 s, src/main.js `applyGlitch`): tear (0–0.1), wireframe
flash (0.1–0.32), tear (0.32–0.4), wireframe (0.4–0.86), tear out (0.86–1). The HUD drops to NO SIGNAL / UPLINK LOST
for the tunnel (print.js). `node tools/shoot.mjs --set glitch`.
