# Pelican Bay · the sound of the storybook (AUDIO.md)

Everything you hear is synthesized live in WebAudio by `src/audio/audio.js`. There are no samples and no files. Sound is **off by default**, and no `AudioContext` exists until the reader turns sound on. The **music has its own switch** (`ui:toggle {key:'music'}` → `state.toggles.music`, or `ui:music {on}`, or `audio.setMusic(on)`), so turning sound on gives you the seaside first. The tune comes only when you ask for it.

## 1. The tune: "晚安，鹈鹕 · Goodnight, Pelican" (F major, 3/4 waltz, ♩ = 88, 88 bars, 3:00)

The full score, form, chord chart and arrangement are in **[docs/BGM.md](BGM.md)**. The form is Intro · A · A′ · B (B♭) · Bridge (Dm → C7) · A″ · Outro, and a page-turn flourish closes each section. The score is data (`SCORE` in `src/audio/audio.js`). The same engine plays it in the page and renders `dist/bgm-storybook.mp3` (`node tools/render-bgm.mjs`).

## 2–4. Instruments, arrangement, tempo
See [BGM.md](BGM.md). In brief: celesta, glockenspiel/music box, recorder, felt piano, Karplus-Strong ukulele and upright bass (mono), brushes and shaker, with a gentle chorus on the plucks and pads. The tempo is **fixed** (♩ = 88; one quantised step to 80 at night, taken only on a section's first bar). The page changes **layers** at bar lines (sun / soft / rain / lullaby), never the tempo with cadence. Instrument buffers are pre-rendered in the background, ≤ 2 ms per 25 ms tick, once the music is on.

## 5. The music listens to the story
- **Ducking.** A rig event (bell, hop, wave, gulp) or a found egg ducks the music by −4.4 dB for the event's length, pelican speech by −2.9 dB, and a nearby director gag (cat, cyclist, gulls, fish…) by −1.4 dB. It recovers with a 0.5 s time constant.
- **Stings on the beat.** A gulp adds a glockenspiel "ta-da" (chord 3rd, then top) plus a bass note on the **next beat** after the swallow. A wave adds a rising three-note chord-tone arpeggio on the next beat, and a found egg a three-note "ta-da-ding".
- **The pelican hums the tune.** About 0.6 s into a coast, the lead instrument drops back and the pelican **hums the melody itself**, one octave down. This is a persistent formant voice ("mm", opening to "oo" on long notes) with portamento and delayed vibrato, and it also works with the music switched off. The first pedal stroke stops it.

## 6. The pelican's voice (formant synthesis)
A saw or square glottal source (with an aspirated "h" onset when needed) runs through three parallel band-pass formants taken from a small vowel table (u o a uh e i m n), scaled ×1.1–1.3 for a cartoon bird.
- **Hop:** a breathy **"hup!"** (uh→u, pitch rising 230→310 Hz, clipped by a bill "p") 90 ms before take-off, and a soft **"oof"** on landing.
- **Wave:** a little nasal two-note **honk** ("hon-honk", a→n).
- **Feeding:** after the gulp bubbles comes a satisfied **"mm-hm!"**, then a **small burp** (a low rough 'o' at 92→78 Hz with 29 Hz wobble) and, half the time, a shy **"heh-heh"**.
- **Grunts:** a contented "hm-hm" every 30–55 s, and short effort grunts every 5–10 s in a sprint (> 88 rpm).

## 7. The seaside (existing effects, re-voiced softer)
- **The bell** has fewer bright upper modes, a softer striker and more plate reverb. It still strikes exactly on the thumb pop (sim-time cue, 120 ms lookahead, latency compensated) and ducks wind and road.
- The **freewheel** ticks are lowpassed at 4.6 kHz, at exactly wheel rev/s × 18 pawls.
- The **chain whirr** runs at crank rev/s × 48 teeth.
- The **thump** has a wicker-basket rattle and makes a splash when the road is wet.
- The **wind is calm**: a slow random walk (a third of edition C's rate) scaled by `weather.wind`, with the whistle only on rare strong gusts.
- **Rain bed and drops** follow `weather.rain`; the road hisses when wet.
- **Other sounds:** sea swells with foam, gulls (softer, panned by screen x), a fog horn (at night *or in fog*), a ship's horn, and crickets plus an owl at night.

**Director encounters** get their own sounds: the cat's **meow**, the oncoming cyclist's two-strike bell, the pelican friend's higher **honk** overhead, the thieving gulls arriving and fleeing, the fish's splash, and at night **soft fireworks**. The fireworks run on the same burst clock as `director.js`, and each boom arrives 0.35 s after its flash, as distance would make it.

## 8. Mix and etiquette
- **Signal chain:** buses `amb mech fx far voice music` → master fade → highpass 38 Hz → high-shelf −4 dB at 6.5 kHz (storybook softness) → glue compressor → brick-wall limiter (−3 dB threshold). One procedural plate reverb.
- **Fades:** in 0.6 s, out 0.45 s, pause 0.4 s. The tab suspends ≤ 100 ms after it is hidden, and the context is only suspended after a fade.
- **Captions:** every audible event emits `audio:caption {en, zh}`, e.g. `[pelican: “hup!”] / [鹈鹕：“嘿哟！”]` or `[pelican hums the tune] / [鹈鹕哼着小曲]`.
- **Measured** (OfflineAudioContext, 44.1 kHz, seed 7, 10–30 s renders):

| Render | Result |
|---|---|
| sun music only | about −23 dBFS RMS per second, peak −4 dBFS |
| full 30 s script (cruise, bell, hop, coast, sprint, gulp, wave) | −19…−23 dBFS RMS, peak −3.3 dBFS |
| lullaby | about −25 dBFS |
| rain | about −27 dBFS |

- **Test hooks:** `createAudio(bus, {context, clock, seed, solo, inst, music, bgm, bgmFrom})`. `debug().music` reports `{on, bar, step, bpm, mode, section, chords, loops, done, crooning}`, and `debug().log` holds every cue (`tempo`, `arr`, `pageturn`, `loop`, `sting`, `hum`, `hup`, `honk`, `burp`, `meow`, …).
