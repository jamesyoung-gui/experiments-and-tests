# Courier #0719 · 外卖员 0719 — personality bible

The rider is a great white pelican working the night shift for 鹈鹕外卖 PELICAN EXPRESS (the box on the front rack, the
ID badge `#0719` on the HUD and the box). Every acting choice in the rig (src/rig/solve.js), the beat keeper
(src/main.js) and the art follows from three adjectives.

| Adjective | What it means on screen | Where it lives |
|---|---|---|
| **Unflappable** | Rain, sirens, a city that glitches out in the neon tunnel: the head stays level (the head is stabilised against the body bob), the visor never flinches, the cadence holds. Only the courier stays solid when the city drops into wireframe (SIGNAL LOST). | `head` parented to the rider, not the neck (CONTRACT); `applyGlitch` excludes the rider sheets |
| **Showboating** | It waves at every cyclist and kite, rings the bell at fireworks, and now and then does a bunny-hop for no reason at all (the keeper's filler hop, at most every 30 s). The LED scarf streams behind it like a cape. | `KEEP.react`, `KEEP.fill` in main.js; wave overshoot at 2.37 s (TIMING.wave) |
| **Punctual** | It is always on the clock: ETA countdown on the HUD, the delivery number ticking up per district, pedalling straight through the downpour. Gulps are quick professional snacks between drops, never a stop. | print.js HUD (ETA, DELIVERY nn), director pacing (sprints on the flat) |

**What it wants this loop:** to get the glowing fish in the box across the harbour city before the ETA runs out —
and to be seen doing it. Every lap it passes the same landmarks (the arcology, the data spire, the neon tunnel) and
greets them like regulars.

**What it never does:** panic, look at the camera, stop pedalling (coasting is a choice on descents, not a stall),
or lose the fish.

**Voice of the motion:** economical in the body (small 1 Hz breathing on the crank cycle, a steady head), generous
in the extremities (wings, crest, scarf follow through with overlap and settle), crisp on beats (the bell thumb
cocks in 85 ms and strikes at 100 ms; the hop crouches 0.16 s before take-off).
