# Pelican Bay · the sound of the storybook (AUDIO.md)

> The soundscape's character (tiny bell, wooden-bead freewheel, boing, gulp-pop, page rustle and pencil, music-box egg stinger, per-stretch ambience, the pelican's yawns and giggles) is described in **[SOUND.md](SOUND.md)**, and the music in **[BGM.md](BGM.md)**. This file covers the engine: buses, sync, ducking and test hooks. Where it differs from SOUND.md, SOUND.md is current.

Everything you hear is synthesized live in WebAudio by `src/audio/audio.js`. There are no samples and no files. Sound is **off by default**, and no `AudioContext` exists until the reader turns sound on. The **music has its own switch** (`ui:toggle {key:'music'}` → `state.toggles.music`, or `ui:music {on}`, or `audio.setMusic(on)`), so turning sound on gives you the seaside first. The tune comes only when you ask for it.

## 1. The tune: "晚安，鹈鹕 · Goodnight, Pelican" (a wonky toy-box waltz, F major, 79 bars, about 2:48)

The full score, form, chord chart and arrangement are in **[docs/BGM.md](BGM.md)**. The form is Wind-up · A (kazoo) · A′ (melodica, trips into 4/4) · Hush (♩ 72) · Wake-up! (♩ 104) · A″ · Doze-off. The score is data (`SCORE` in `src/audio/audio.js`). The same engine plays it in the page and renders `dist/bgm-storybook.mp3` (`node tools/render-bgm.mjs`).

## 2–4. Instruments, arrangement, tempo
See [BGM.md](BGM.md). In brief: an out-of-tune music box, kazoo, melodica, bassoon, tuba, recorder, felt piano, Karplus-Strong ukulele, brushes and shaker, and a toy box (crank, boings, page hits, "shh", slide whistle, the pelican's hum, yawn and snore). The tempo is the score's own (88, 72 in the Hush, 104 in the Wake-up; ×0.9 at night), switched only on a section's first bar and never by cadence. The page changes **layers** at bar lines (sun / soft / rain / lullaby).

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
- **Signal chain:** buses `amb mech fx far voice music` → master fade → highpass 38 Hz → high-shelf −4 dB at 6.5 kHz (storybook softness) → glue compressor → brick-wall limiter (−3 dB threshold); since SOUND.md, the shelf is −6 dB at 5.5 kHz plus a 10.5 kHz lowpass. One procedural plate reverb.
- **Fades:** in 0.6 s, out 0.45 s, pause 0.4 s. The tab suspends ≤ 100 ms after it is hidden, and the context is only suspended after a fade.
- **Captions:** every audible event emits `audio:caption {en, zh}`, e.g. `[pelican: “hup!”] / [鹈鹕：“嘿哟！”]` or `[pelican hums the tune] / [鹈鹕哼着小曲]`.
- **Measured** (OfflineAudioContext, 44.1 kHz, seed 7, 10–30 s renders):

| Render | Result |
|---|---|
| default 40 s script at cruise 42 rpm, music on (bell, hop, coast, sprint, gulp, wave, page turn) | −17…−28 dBFS RMS per second, peak −4.9 dBFS, 0 clicks |
| music bus alone (tools/render-bgm.mjs, raw) | peak −7.3 dBFS, Hush to A″ spanning 13 dB |
| night (music, lullaby layers) | −17…−26 dBFS, peak −3.9 dBFS |
| rain, no music | −17…−27 dBFS, peak −4.1 dBFS |

- **Test hooks:** `createAudio(bus, {context, clock, seed, solo, inst, music, bgm, bgmFrom})`. `debug().music` reports `{on, bar, step, bpm, mode, section, chords, loops, done, crooning}`, and `debug().log` holds every cue (`tempo`, `arr`, `pageturn`, `loop`, `sting`, `hum`, `hup`, `honk`, `burp`, `meow`, …).
