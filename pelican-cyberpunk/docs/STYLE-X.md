# Style bible · X · Cyberpunk — "Neon Pelican" (third edition, requested by the user)

The user's words: "再出一个 cyber punk 在 Cyberpunk city 里骑自行车的版本", which asks for a version where a cyberpunk rides a bicycle in a cyberpunk city.
The goal is a rain-slick neon megacity at night, and a cyberpunk pelican cruising through it on a glowing bike. It should look like a frame from a high-end animated cyberpunk film: dense, layered, luminous, full of signage and life. The rider must still read instantly as a great white pelican on a mechanically correct bicycle.

This project is a fork of the finished style-C edition (`../pelican-bicycle`). Reuse the engine, rig, route streaming, director, eggs logic, baker, UI logic and tools. **Redraw all the art.** Don't break the contracts (slots, layers, data-detail, `window.__pb`, sheets). The concept keyframe `drafts/X-concept/keyframe.png` (made first in this workflow) is the visual reference once it exists.

## 1. Palette (neon on dark)
| Role | Hex | Use |
|---|---|---|
| void | `#07060F` | deepest shadow, far sky top |
| night | `#141029` → `#261A45` | sky, building masses (violet-indigo) |
| steel | `#3A3F5C` | metal, concrete, bike parts in shadow |
| haze | `#5B3F7A` | smog, atmospheric glow near the horizon |
| magenta | `#FF2E88` | primary neon (signs, the bike rim light) |
| cyan | `#19E6FF` | secondary neon (holograms, the visor, rain highlights) |
| acid | `#C6FF3D` | sparing accent (warnings, the odometer, eggs) |
| amber | `#FFB547` | warm practicals (noodle stalls, lamps, the pouch glow) |
| plume | `#E9E6F2` | pelican feathers: cool white lit by neon (rim-lit magenta on one side and cyan on the other) |

- **Time of day becomes city moods**, not daylight. They are keyed on the engine's tod:
  - dawn → a smog sunrise (orange haze through towers)
  - noon → an overcast grey-violet day, where the signs are dimmer but the holograms still run
  - golden → a neon dusk (the default hero)
  - sunset → an acid-rain magenta night
  - night → deep night (maximum neon, the searchlights sweep)

  Neon is "emissive": it stays bright at every tod.
- **Lighting language:** dual-colour rim light on the rider and bike (magenta from behind or right, cyan from the front or left), wet reflections on the road (mirrored, blurred neon streaks), volumetric haze bands between building layers, and light cones from signs, drones and searchlights.

## 2. Performance rule (same as the other editions: critical)
- **Glow = filters are allowed only on static or far sheets.** The skyline, signs on far buildings, hologram billboards (whose content may change only rarely), the haze and the static reflections all live on their own sheets and only translate, so their `feGaussianBlur` bloom rasterizes once.
- **Moving and rider parts get NO filters.** Fake the glow with stacked strokes (a wide low-opacity stroke under a thin bright one) and radial gradients. The bike's neon rim and spoke lights use the stacked-stroke glow. The rain is pooled streaks without filters.
- Flicker (neon signs buzzing) = opacity changes only, on a few elements, at low rates.
- `node tools/shoot.mjs --dist --perf` ≥ 58 fps. Note that another workflow (the storybook edition) may be running at the same time, so measure twice.

## 3. The cyberpunk pelican (the rider)
- **Still unmistakably a great white pelican:** the long bill with the hooked nail, the pouch, the white plumage, the black primaries, the crest, the facial skin, the totipalmate feet (keep every anatomical lesson from edition C).
- **Cyber styling (make it cool, not grim):**
  - **Visor:** a sleek cyan visor across the eyes (HUD glyphs on it); the eye is visible through it.
  - **Jacket:** a short techwear bomber over the body (magenta piping, patches reading 鹈鹕 / PELICAN), with the wing feathers emerging from its sleeves.
  - **Augmentation:** the pouch has a subtle glowing circuit tattoo, and the nail is chrome.
  - **Earpiece:** a small earpiece antenna.
  - **Scarf:** the edition-C scarf becomes a glowing LED scarf (it keeps its follow-through pose fields).
  - **Accessories:** optional high-top sneaker-style foot wraps, keeping the webbing visible.
- **Expression:** confident, cool, a little smug. Never menacing.

## 4. The bike (mechanically correct, like edition C)
A cyber fixie or city bike:
- **Frame:** a matte-black carbon frame with a magenta neon underglow, and a cyan LED strip along the top tube.
- **Wheels:** glowing rims, with light trails on the spokes at speed (use the spoke-blur logic).
- **Drivetrain:** a chrome chain.
- **Front:** a holographic speedometer projected above the stem; a headlight laser beam.
- **Basket:** a delivery box for glowing fish with a "鹈鹕外卖 PELICAN EXPRESS" logo (the pelican is a courier).

Keep all of edition C's mechanical detail: lugs, cables, teeth, chain plates, 32 spokes, valve, pedals, rack.

## 5. The city (the same long journey, redrawn as a megacity)
Keep `route.js` stretches and the streaming. Re-theme them:

| Edition C | Cyberpunk |
|---|---|
| village | the "Pelican Bay" neon district: noodle stalls, ramen steam, lantern strings, vending machines |
| fish market | the neon fish market with hologram fish |
| pier | a floating dock with drones |
| harbour cranes | megastructure cranes with warning lights |
| lighthouse | a data-spire beacon with a sweeping searchlight |
| cliffs/tunnel | a neon tunnel under the arcology |
| amusement pier | an arcade district with a giant rotating hologram koi |
| steam train | a MAGLEV train racing alongside on an elevated track |
| bridge | a cable-stay skybridge |
| fort | the old-town temple squeezed between towers |
| pine grove | a hydroponic garden with purple grow lights |

- Kilometre stones become holo-markers.
- Signs in **Chinese + English** (plus a little katakana for flavour). Keep them readable and witty: "鱼丸 FISHBALL", "外卖 DELIVERY", "禁止鹈鹕 NO PELICANS" (an egg), "义体诊所 CYBER CLINIC".
- **Life:** people with umbrellas, delivery drones, a robot cat, flying cars in far traffic lanes, rain, puddles with neon reflections, steam vents, cables everywhere.
- Parallax layers: far skyline silhouettes with thousands of lit windows (static, merged paths), mid towers with signs, near street props, and the foreground (railings, puddles, cables).
- The **sea** becomes the dark harbour with neon reflections and hover-boats.

## 6. Weather and motion (the lessons still apply)
- **Weather:** frequent light rain (pooled streaks lit by neon), a heavy downpour stretch, smog fog, lightning over the towers, a rare clear night with stars through the smog.
- **Wind is calm:** at most one subtle set of holographic data-streams drifting slowly. No scattered fast curls, which the user explicitly disliked in edition C. Speed lines only above 86 rpm and sparse (neon light trails).
- **Motion:** keep the rig. Tune it slightly: a cooler, smoother, "cruising" feel with a relaxed lean and a subtle head nod to the beat.

## 7. Sound (in the same spirit as the storybook edition)
Synthesized, off by default:
- **Music:** a synthwave/darksynth track (a pulsing bass arpeggio, gated pads, gated snare, a lead melody). It has a real composed progression, its tempo follows the cadence, and the mood changes with weather and district.
- **Ambience:** rain, distant sirens, the hum of the neon, the maglev whoosh, drone buzz.
- **Pelican voice:** a vocoder-ish "hmm", a bleep-bloop HUD sound, the gulp.

## 8. Page and UI
- **HUD aesthetic:** thin cyan and magenta lines, corner brackets, scanlines (static), glitch transitions (rare, brief).
- **Title:** "NEON PELICAN" + 鹈鹕湾 as glitch-lettered paths, shrinking into a corner HUD after the intro.
- **Mission caption per route stretch:** "DELIVERY 03 · 灯塔角 / DATA SPIRE", replacing C's tickets.
- **Control card:** a translucent HUD panel with every existing control, mobile bottom sheet and a11y. Add a music toggle.
- Lettering is paths, extracted with `tools/ttf.mjs` from DejaVu Sans, Sans Mono and Sans Bold plus WenQuanYi.
