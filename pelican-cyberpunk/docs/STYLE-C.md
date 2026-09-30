# Style bible: C · Retro travel poster (chosen by the user)

Reference: `drafts/C-poster/keyframe.png`, `closeup.png`, source `gen.mjs` (inks, halftone `dots()`, the stroke capitals, glyph-to-path via `ttf.mjs`). **Match this poster, and fix the reviewer's issues below.** The goal is "a WPA / art-deco screen-printed travel poster that comes to life": every frame should hold up as a printable poster.

## 1. Inks (limited palette, the soul of the style)
The golden-hour set (default tod 0.70) = the draft's 7 inks:

| Ink | hex | Use |
|---|---|---|
| P paper cream | `#F4E7CD` | Plumage, sun, sails, lettering, paper |
| K peach | `#F2AE86` | Low sky, bill, facial skin, road |
| O amber | `#EB8A33` | Legs, feet, pouch, sun rays, basket |
| R vermilion | `#D4513A` | Mid sky, scarf, bill nail, lighthouse stripes, title inner line, seal |
| B periwinkle | `#56679E` | Upper sky, far sea, plumage shade + key line |
| T teal | `#1D8882` | Bike frame, palms, dune grass |
| N navy ink | `#1A1F35` | Primaries, tyres, deepest darks, title shadow |

- **Every surface must be one of the inks** (plus halftone of one ink over another). Gradients are only allowed as radial-gradient "glows" for night lights, and even those must be **quantised into 2–3 hard-edged rings** to keep the screen-print feel.
- **Time of day = ink swap.** Each tod keyframe is a complete 7-ink set, interpolated in linear RGB (core/palette.js). The "roles" of the inks (paper / light / warm / accent / cool / green / dark) stay fixed. Reference sets:
  - dawn: pink-purple and peach
  - noon: sky blue + white, sea ultramarine
  - golden: the table above
  - sunset: deeper vermilion / purple
  - dusk: indigo
  - night: navy / slate blue / cream moonlight + amber lights

  Each palette must still look like a "limited-colour print". The night version should read like a "night poster", **not a daytime poster with a dark overlay**.
- Material → ink mapping: `plume→P`, `plumeShade→B` (only as line/hatching, see §2), `flight→N`, `bill→K`, `billEdge/nail→R`, `pouch→O`, `skin→K`, `foot/web→O`, `bikeFrame→T`, `tyre→N`, `saddle→N`, `basket→O`. Far-side parts use the `-far` variant: **flat dark ink (B or N), never red dots.**

## 2. Halftone and texture rules (fixing the review's "grey, dirty" and moiré problems)
1. **No large halftone on the rider.** The plumage is solid paper white P. Volume comes from:
   - a B key line (width about 2.2, rounded joints)
   - a few B contour-feather "scallop" lines
   - at most a thin, narrow band of halftone at the belly/back edges, with dot spacing ≥ 5 and dots in P over B, so it doesn't grey the whole body
2. **The far leg / far wing:** solid B or N, with the same shapes as the near side. No red dots.
3. **Halftone may only be used on static or slowly moving layers:** sky bands, sun rays, sea bands, far hills, shore. Draw it as a static `<pattern>` or pre-generated dot paths. It moves with its layer's translate as a whole, **never** on rotating or deforming parts.
4. **Rotating parts** (wheels, chainring, cranks) use solid colour + lines. **Spokes** follow rig-spec §3 (fade out, with a motion-blur disc in 2 inks).
5. **Paper grain:** one static paper-texture layer (small, low-opacity, fixed to the screen), or none at all. **No full-screen filters or blend modes.**
6. **Registration shift** (optional flourish): on static elements, a 1–2 px offset between the ink layers gives a hint of misregistered screen printing. It must not flicker in animation.

## 3. The pelican (character design corrections)
- **It must read as a great white pelican:**
  - big paper-white body; long S-neck; long peach bill with a vermilion hooked nail
  - amber pouch hanging under the bill with a few O/R lines for its texture; small peach bare skin around the eye
  - dark eye with a highlight; the eyelid is a thick upper line, but the expression must be **content/cheerful, not fierce**. Remove the heavy orange eye liner; the corner of the mouth can turn up slightly.
  - a white (P) shaggy crest at the back of the head
- **Wings must look like wings, not arms with sleeves** (a shared problem in all 5 drafts):
  - A broad wing base (coverts) connects into the side of the body.
  - Secondaries hang below the "arm line" like a fringe.
  - **N primaries sweep back from the wrist**, like a folded wing tip trailing back and down.
  - "Hand" holding the grip: the leading primaries curl around the grip like fingers.
- **Legs:**
  - the thigh is a feathered "trouser" merging into the body
  - the tarsus (the visible lower leg, whose joint looks like a "backward knee") is amber, with a few scale lines
  - **all four toes webbed** (totipalmate), the foot flat on the pedal
- **Scarf:** the long red-and-cream striped scarf is this style's signature and the best follow-through prop. It is attached at the base of the neck, flutters behind at speed, and flies up during the hop.

## 4. Composition and focus (fixing "busy background swallows the character")
- The rider always has the **strongest contrast in the frame**: the paper-white body is set against the medium-dark B / sea bands.
- The sun rays radiate from behind and to the right of the rider, as a subtle frame.
- The **title "PELICAN BAY" + the 鹈鹕湾 seal:**
  - intro title card: full size, fades after about 3 s
  - afterwards: shrinks to a small top-left logo, or hides
  - it must never block the rider, at any camera
- **Background detail follows depth:**
  - far layers: large shapes + a little halftone
  - near layers: simple silhouettes
  - foreground (depth 1.3): only low teal bushes / N grass, allowed to cover at most the bottom 8% of the wheels
- **Poster border:** P paper margin + a thin N frame line, as a lead-owned screen-fixed layer. In cinematic mode it becomes the letterbox.

## 5. Lettering
Letters are always converted to paths:
- Latin: stroke-built art-deco capitals (see `gen.mjs`), or DejaVu Sans Bold → path via `ttf.mjs`.
- Chinese: WenQuanYi Zen Hei → path.

The font licences allow embedding outlines; the README must credit them. Signposts use the same art-deco lettering.

## 6. Motion language
- **Mechanics:** clean and crisp.
- **Character:** exaggerated "rubber-hose / 1930s cartoon" charm, at a restrained level, with the bob and follow-through in rig-spec.
- **Environment:** "print layer" motion. Layers slide flat and cleanly, the sea bands roll gently, and the sun rays rotate very slowly (about 1°/s).
- **Big events** (hop, gulp) may get a single-frame "screen-print pop": R/O impact rays + a small letterpress-style sound-effect word such as "DING!", "GULP!", "HOP!".
