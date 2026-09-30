# Style bible · B · Warm storybook gouache (绘本水粉) — the second edition, chosen by the user

Reference: `drafts/B-storybook/keyframe.png`, `closeup.png`, source `gen.mjs`. Techniques to mine: `cr()` Catmull-Rom outlines, `puff()` clouds, the filter set (`wob`, `wobBig`, `soft`, `grain`, `mottle`, `brush`), the palette `C = {…}`.
The goal is **a bedtime picture-book spread that comes alive**. Every frame should look like a painted page from a beloved children's book. It is warm, soft, hand-made, and full of small stories.

This project is a fork of the finished style-C edition (`../pelican-bicycle`). The engine, rig, route, director, eggs logic, baker, UI logic and tools are proven: **reuse them and redraw the art**. Don't break the contracts (slots, layers, data-detail, `window.__pb`, sheets).

## 1. Palette (gouache, warm)
| Role | Hex (golden hour) | Use |
|---|---|---|
| paper | `#FFF6EC` | page, plumage highlights |
| plume shade | `#E9D3D2` | plumage shading (warm rose-grey, never cold grey) |
| line | `#4A2C20` | warm dark-brown hand-drawn outline (NOT black) |
| deep | `#231D26` | primaries, tyres, deepest darks |
| bill | `#F4A284` | bill, facial skin (peach-pink) |
| pouch | `#FAC957` | pouch, sun core, lamp light |
| feet | `#F08A3C` | legs, feet, basket shadows |
| frame | `#1F8A8A` | bicycle frame (teal-green) |
| cream | `#F6EAD0` | fenders, saddle stitching, sails |
| basket | `#C89B5E` | wicker, wood, sand shadow |
| scarf | `#D8443A` | knitted scarf, lighthouse bands, nail |
| sea | `#3A5AA3`, `#6A78B0` | sea deep / mid |
| sky warm | `#F3AE78`, `#FFD9A0` | low sky, sun glow |
| mauve | `#94777F` | far hills, soft shadows |

- Time of day is a **whole-page light grade**. Each keyframe (dawn, noon, golden, sunset, dusk, night) is a complete warm palette interpolated in `core/palette.js`.
- **Night is a "bedtime story" night.** Deep blue-violet paper, warm lamp pools, a big moon with a friendly face-free glow, stars as little painted crosses. It is never cold or grey.
- Shadows are warm (mauve or brown glazes), never neutral grey. Outlines are always the warm brown `line` ink at 1.6–2.4 u. Far layers use a lighter, thinner line or none, which gives atmospheric perspective.

## 2. Texture and the performance rule (important)
The draft's charm came from 19 SVG filters. In this engine every layer is its own composited `<svg>` sheet (`src/core/sheets.js`), moved by a CSS translate. **A filter on a sheet whose content doesn't change is rasterized once and then only composited.** So:

1. **ALLOWED:** painterly filters (`feTurbulence` + `feDisplacementMap` edge wobble, soft `feGaussianBlur` glows, gouache mottling) on **far and static content**: sky, clouds, far hills, the far sea, the distant town, and the static paper-grain overlay. Keep filter regions tight, with `filterUnits` and the region sized to the element.
2. **FORBIDDEN:** filters on the rider (all `#j-*` slots), on rotating parts (wheels, cranks, chain), on anything whose geometry or attributes change every frame, and on streamed near props that recycle often. These get their hand-drawn look **baked into the geometry at build time**:
   - **wobbly outlines**: deterministic jitter of path points (seeded, so the same every frame);
   - **double-stroke "pencil" lines**: a second, offset, thinner, lower-opacity stroke;
   - **dry-brush edges**: short tapered strokes along the silhouette;
   - **gouache texture**: static `<pattern>` fills of painted blotches or brush strokes, pre-generated once, in the object's own local coordinates so the texture moves with the object.
3. **Paper:** ONE full-screen static paper-grain sheet (feTurbulence rendered once) at low opacity with normal blending, plus a subtle vignette. Avoid `mix-blend-mode` on large areas unless you measured that it keeps 60 fps.
4. Measure: `node tools/shoot.mjs --dist --perf` must stay ≥ 58 fps. If a filter costs frames, bake it.

## 3. The pelican (character design fixes over draft B)
- **Species first.** It must read instantly as a great white pelican:
  - **Body:** a deep chest and long back, **not a goose/egg body**.
  - **Neck:** a long S-neck.
  - **Head and bill:** a long peach bill with a culmen ridge and a red hooked nail; the gape line reaches behind the eye.
  - **Pouch:** yellow, textured, hanging under the lower mandible and extending behind the gape.
  - **Face:** pink bare facial skin around the eye; a dark, kind eye with a highlight; a shaggy white crest.
- **Expression:** gentle, happy, a little proud (a soft smile at the gape, rosy cheek blush). Picture-book appeal.
- **Plumage:** warm white with rose-grey shading, layered scallop feathers painted with little brush marks, a warm rim light at golden hour.
- **Wings must read as wings** (the lesson from C). There is a broad covert base joining the body, layered coverts, and secondaries as a fringe. The deep-dark primaries sweep back from the wrist, and at the grip they are **≥ 4 separate feather tips curled like fingers. Not a clump or brush** (a draft-B defect).
- **Legs:** feathered thigh "trousers"; an orange tarsus with painted scale rings; **totipalmate** feet (all four toes webbed) flat on the pedals.
- **Costume:** the red-and-cream **knitted** scarf (visible knit texture, fringe; it flutters with the rig's scarf pose); optional little goggles or a flat cap. The scarf is the signature follow-through prop.
- The **far leg and far wing** are painted in cooler, darker glazes (same shapes), never flat black.

## 4. Composition and the page
- The picture-book **spread**: a cream paper margin with a soft gutter shadow down the page centre (subtle, off the rider), and page numbers in the corners.
- A hand-lettered serif title "Pelican Bay" with 鹈鹕湾, which shrinks to a small corner title after the intro.
- A **story caption** line that changes with each route stretch, like picture-book text: e.g. "第三页 · 灯塔角 — 鹈鹕向灯塔守护人挥挥翅膀。" / "Page 3 · Lighthouse Point — Pelican waves to the keeper." Captions come from `src/world/route.js` stretches.
- These replace C's ticket stubs and stamps. The page must never cover the rider.
- **Focus:** the rider is the brightest, most detailed and most outlined thing on the page. The background is softer, lighter and less outlined as it recedes.
- **Lettering is paths** (DejaVu Serif or Serif Bold for Latin, WenQuanYi Zen Hei for Chinese, extracted at build time with `tools/ttf.mjs`; both licences allow embedding outlines). Signs and captions are hand-lettered in feel: slight baseline wobble, warm brown ink.

## 5. The world (the same long journey, redrawn)
Keep `route.js` stretches and the streaming or pooling logic. Redraw every prop as a storybook painting: the village, beach huts, fish market, pier and anglers, harbour, cranes, lighthouse headland, cliffs and tunnel, amusement pier with a Ferris wheel, steam train, bridge, old fort, pine grove, dunes and palms, kilometre stones. Add storybook life:
- a little crab family
- a snail on the kerb
- a hedgehog
- kids flying kites
- laundry on lines
- cats in windows
- a postman
- an ice-cream cart

## 6. Weather, wind and motion (lessons from edition C: the user's explicit feedback)
- **Wind must be calm and legible.** ONE wind language: a few soft painted breeze swirls in the upper sky that drift slowly, at most one set on screen, plus leaves. No fast, scattered or overlapping curls. Speed lines only in a real sprint (> 86 rpm), sparse.
- **Weather:** the rain is soft painted streaks with round splashes. The rainbow is watercolour bands with soft edges (a static filter is OK). The fog is soft gouache veils (static filtered shapes that slide).
- **Motion feel:** keep the proven rig. It may be tuned slightly rounder or bouncier for picture-book charm, but check-rig must pass.

## 7. Sound (new in this edition, requested by the user)
Everything is synthesized in WebAudio (no files), off by default and enabled from the UI:
- **Music:** a warm acoustic bedtime-story tune (plucked ukulele or guitar, soft glockenspiel, upright bass, brushed percussion). The tempo follows the cadence (quantised so it stays musical), the arrangement changes with weather and time of day (lullaby at night, fuller in sun), and it ducks under events.
- **Pelican voice:** soft cartoon grunts, a happy hum when coasting, a surprised "hup!" on the hop, a satisfied "gulp" plus a burp after feeding, and a little honk when waving.
- The existing effects (bell, freewheel, wind, waves, gulls) stay, re-voiced to feel softer.
