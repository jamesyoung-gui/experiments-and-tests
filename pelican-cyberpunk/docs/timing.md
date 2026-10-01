# Frame-timing charts · 动作时序

Source of truth: `TIMING` in src/rig/solve.js (also `window.__pb.TIMING`). Times in seconds from the event; frames at
60 fps in brackets. Filmstrips of every chart: `node tools/shoot.mjs --set strip` (close camera, every 3rd frame over
the full duration + a 1:1 inset of 12 consecutive frames around the peak).

## Bell — 0.60 s (36 f)
| phase | t | frames | what |
|---|---|---|---|
| cock | 0 → 0.085 | 0–5 | thumb draws back (anticipation) |
| strike | 0.100 | 6 | thumb hits the dome; head ticks 7° (impulse, 3 Hz damped) |
| settle | 0.10 → 0.45 | 6–27 | thumb returns, ring decays |
| end | 0.60 | 36 | |

## Wave — 2.70 s (162 f), min gap 2.7 s
| phase | t | frames | what |
|---|---|---|---|
| dip | 0 → 0.14 | 0–8 | wing drops (anticipation), head starts to turn (waveLook) |
| unfold | 0.14 → 0.86 | 8–52 | the near wing lifts off the grip and opens |
| wave | 0.80 → 1.65 | 48–99 | two hand flaps; peak at ≈ 1.2 s (72 f) |
| back | 1.65 → 2.37 | 99–142 | the hand returns to the grip |
| overshoot | 2.37 | 142 | settles past the grip and back (follow-through) |

## Hop — 1.30 s (78 f), min gap 1.2 s
| phase | t | frames | what |
|---|---|---|---|
| crouch | 0 → 0.16 | 0–10 | body sinks, knees bend (anticipation) |
| front lift | 0.15 | 9 | front wheel leaves first (pitch −6.5°) |
| take-off | 0.24 | 14 | both wheels off; v0 = √(2·G·H), G = 2885 u/s², H = 48 u |
| apex | 0.422 | 25 | 48 u up; the close camera has already risen since the crouch |
| land | 0.605 | 36 | rear-first landing, squash impulse (11 u, 2.8 Hz) |
| settle | 1.105 | 66 | |

## Gulp — 2.50 s (150 f), min gap 2.6 s
| phase | t | frames | what |
|---|---|---|---|
| reach | 0.14 → 0.54 | 8–32 | head and bill reach forward-down |
| scoop | 0.54 → 0.70 | 32–42 | the pouch opens and scoops |
| lift | 0.70 → 1.00 | 42–60 | head comes up |
| toss | 1.00 → 1.32 | 60–79 | bill flicks up; peak ≈ 1.16 s (70 f) |
| swallow | 1.32 → 1.85 | 79–111 | the lump travels down the neck |
| settle | 1.85 → 2.50 | 111–150 | |

## Coast
Legs level the cranks over 0.5 s (30 f) from the coast marker; pedalling resumes from the same phase.
