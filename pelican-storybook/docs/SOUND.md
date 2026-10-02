# 绘本声音 · The storybook soundscape

The goal: **a bedtime picture book read aloud.** Everything is small, rounded and a little toy-like, like the sound effects a storyteller makes while reading, so it can never be mistaken for the poster edition's brass-and-steel seaside or the cyberpunk edition's synths. Everything is procedural WebAudio in `src/audio/audio.js`, with no samples. The music is documented in [BGM.md](BGM.md), and the bus structure and sync rules in [AUDIO.md](AUDIO.md).

**Soft by construction.** The master chain is: highpass 38 Hz → high shelf −6 dB at 5.5 kHz → lowpass 10.5 kHz → glue compressor → limiter. Every transient (bell, ticks, crinkles, drops) has its own lowpass and a ≥ 1 ms attack. Measured with `tools/audio-offline.mjs` (40 s scripted rides), only −22 to −23 dB of the energy lies above 3 kHz and −32 to −34 dB above 6 kHz. The brightest scene is the rain (−16.5 / −25.7 dB, the hiss bed lowpassed at 3.8 kHz).

## Foley: the ride

| Event | Sound |
|---|---|
| **Bell** (thumb pop) | a **tiny brass handbell, "ting-a-ling"**: four partials around 2.6 kHz, three quick strikes, lowpassed at 6.2 kHz. It still lands exactly on the thumb pop (sim-time cue, 120 ms lookahead). The oncoming cyclist rings a smaller, farther one at 3.15 kHz |
| **Freewheel** (coasting) | **wooden beads** clicking: three damped modes at 1.2–3.4 kHz with 1–2.4 ms decays, lowpassed at 3.4 kHz, at exactly wheel rev/s × 18 |
| **Hop** | a breathy "hup!", then a spring **"boing"** (a triangle plus sub sliding 170→470 Hz with a 13 Hz wobble that dies away), a pillowy landing thump with a wicker rattle, an "oof", and sometimes a giggle |
| **Gulp** | a fish flop and a bill clop, then the **"gulp… pop!"**: a round throat slide 300→105 Hz and a cork pop (1100→380 Hz plus a soft click), followed by "mm-hm!", a small burp, and sometimes "hee-hee" |
| **Wave** | feather rustles, a two-note honk hello, and half the time a giggle |
| **Egg found** | a **music-box stinger**: three wind-up clicks, then the BGM's hook on a music box, with its major-seventh leap (F–E′–D′–C′–A… F′), in the current key (B♭ during the Wake-up). It plays on the effects bus, so it is heard with the music off too, and it ducks the music (−4.4 dB) |

## Foley: the book

| Moment | Sound |
|---|---|
| **A page turns** (each new story page: a new route stretch, or the night page) | a soft paper swish swept 0.9→3.2 kHz and panned right to left, with six little crinkles |
| **The caption writes on** (0.7 s later, while the new line fades in) | a **pencil scribble**: 0.9–1.3 s of graphite strokes (band-passed noise, 50–110 ms strokes, each with its own pitch) |
| **The music turns a page** (end of every BGM section) | a glockenspiel run and a paper swish, in time with the tune |

## Ambience per route stretch

Every stretch has a sea bed and **lapping waves** (small sloshes with round drips, and, one time in eight, a bigger swell with foam), scaled by the stretch's `lap` value. On top of that:

| Stretch | Profile |
|---|---|
| Pelican Bay (village, return) | waves; **wind chimes** (tuned tubes C D F G A, the tune's own pentatonic) tinkling in the breeze; now and then **children laughing far away** |
| The Long Pier | louder waves under the boards; **old wood creaking** |
| Fishing Harbour | boats creaking; the ship's horn |
| Pleasure Pier (funfair) | **children laughing and giggling** far off (2–3 small formant voices, panned apart, lots of air) |
| Coast Railway | a **little steam train**: chuffs that speed up while crossing from left to right, and a kettle-like "toot… tooooot" whistle (every 70–120 s) |
| Lighthouse Point | waves; the fog horn in fog or at night |
| The Cliffs, the Dunes, the Pine Walk | wind; chimes in the pines and dunes |
| River Mouth Bridge | a **babbling river** bed |
| Old Fort & Lido | waves and children |

The **weather** layers on top. A **breeze** (`wind > 0.55`) brings chimes anywhere. A **shower** (`rain > 0.25`) brings **rain on a tin roof** (soft metallic ticks at 1.7–2.9 kHz, lowpassed at 4.2 kHz) plus **puddle plops** (round 480–950 Hz drops), over a hiss lowpassed at 3.8 kHz. At **night** come crickets, the owl, the fog horn and soft distant fireworks, while the children and the train go quiet.

## The pelican's voice

The pelican speaks with a formant voice (a saw source through a 2.3 kHz lowpass and three vowel formants scaled for a small bird), so it sounds warm, cute and slightly mumbly:
- **Hums the tune while coasting.** The lead instrument steps back and the pelican hums the melody.
- **Mumbles to itself** now and then, a contented "mm-mm-hmm".
- **Yawns at bedtime.** One big "mmhaaa-ooh" comes when night falls, and later night-time mumbles are sometimes yawns.
- **Giggles** ("hee-hee-hee") after some hops and waves and after feeding, and **honks** hello.
- **Grunts** with effort in a sprint.

## Cadence 42

The cruise cadence is now **42 rpm** (`CADENCE.cruise`, sprint 72). Nothing musical follows cadence any more: the BGM tempo is fixed (♩ = 88, 80 at night). What still follows the pedals is physical: the chain whirr (crank rev/s × teeth), the freewheel beads (wheel rev/s × pawls), and the wind and road levels (speed / max speed, so a calm 42 rpm cruise is quieter and calmer than before). The sprint-only behaviours (gull escort, effort grunts) are keyed to `CADENCE.sprint` (≥ 66 and ≥ 70 rpm) instead of the old fixed 85/88 rpm, so they still happen at the new sprint speed. `tools/audio-offline.mjs` now rides at `CADENCE.cruise` and sprints to `CADENCE.sprint + 8`.

## Audition

`node tools/audio-offline.mjs --dur 40 [--stretch railway|funfair|harbour|bridge|…] [--rain 0.8] [--wind 0.7] [--night 1] [--nomusic]` writes a WAV of the scripted ride. It prints the cues that fired, the peak, the per-second RMS and a click count, and exits 1 on clicks or clipping. All of these scenarios render with **0 clicks**, peaks −3.9…−4.9 dBFS: default, railway, rain, night, funfair, bridge, harbour, and village with a breeze.

Captions: each new sound has an `audio:caption` line (`[boing!] / [嘣——！]`, `[a page turns] / [哗啦，翻页]`, `[a pencil scribbles] / [铅笔沙沙地写]`, `[a music box plays] / [音乐盒叮叮咚]`, `[a little steam train whistles] / [小火车呜——呜]`, `[pelican yawns] / [鹈鹕打了个大哈欠]`, …). Ambient captions (chimes, children, giggles) are rate-limited.
