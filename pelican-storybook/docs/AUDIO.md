# Pelican Bay · the sound of the storybook (AUDIO.md)

Everything you hear is synthesized live in WebAudio by `src/audio/audio.js`. There are no samples and no files. Sound is **off by default**, and no `AudioContext` exists until the reader turns sound on. The **music has its own switch** (`ui:toggle {key:'music'}` → `state.toggles.music`, or `ui:music {on}`, or `audio.setMusic(on)`), so turning sound on gives you the seaside first. The tune comes only when you ask for it.

## 1. The tune: "Pelican Bay Lullaby" (F major, 4/4, 32 bars, AA′BA″)

This is a real composed song, not a generator. A 1-bar vamp on C7 opens it ("once upon a time…"). Then come four 8-bar phrases. The melody is written in `SONG` as note:eighths tokens.

| Phrase | Chords (one per bar, two where split) | Melody idea |
|---|---|---|
| **A** | F · Dm · B♭ · C · F · Am · B♭ C · F | the lullaby motif C–A–F–A, answered by D–C–A, and a question on C that resolves home on low F |
| **A′** | F · Dm · Gm · C7 · F · Am · B♭ C7 · F | the same shape an octave-ish higher (A–C–F–E, D–F–A–G), and a brighter answer ending on high F |
| **B** (bridge) | B♭ · C · Am · Dm · Gm · C · F/A B♭ · C7 | calmer and falling (F–D–B♭, G–E–C), resting on D, then climbing to a half cadence on C7 |
| **A″** | F · Dm · B♭ · C · Dm · B♭ · C7 · F | the motif returns, the second half reharmonized (Dm, B♭) and climbing to the final F |

At 88 bpm one pass takes about 87 s, so no phrase repeats inside 30 s. The pass number (the verse) adds **variations**:
- **The instrument rotates in the sun.** The lead passes between ukulele and whistle across the sections, verse 2 gives the bridge to the glockenspiel, and the glockenspiel doubles the last A″.
- **Ornaments.** From verse 2 on, long notes get an upper-neighbour grace note (a hammer-on on the uke, a flick on the whistle), chosen by a seeded hash, so the same bars stay stable.
- **A key lift on odd verses.** The last bar of the bridge becomes D7 (melody F♯–E–D–C) and pivots the final A″ up a tone into G major. The next verse steps home to F.
- **Glockenspiel fills.** Bars 4 and 8 of every phrase answer the sustained melody note with falling chord tones (rising at night).

## 2. Instruments (all procedural)
- **Ukulele / nylon guitar:** Karplus-Strong with a 2-tap loop filter, a pluck-position comb and a noise excitation shaped per voice. The loop period is an integer number of samples, and `playbackRate` corrects the tuning exactly. Each string damps its previous pluck (≤ 6 strings), so strums don't turn to mud.
- **Upright bass:** Karplus-Strong with a darker 3-tap loop, a soft thumb excitation and a 900 Hz lowpass. It is monophonic.
- **Glockenspiel / music box:** additive inharmonic bar partials (1, 2.756, 5.404) plus a felt mallet tick.
- **Whistle:** a sine with a scooped attack, delayed vibrato and breath noise tuned to the pitch.
- **Brushes and felt kick:** band-passed noise swishes on beats 2 and 4, soft tapped off-beats, a round 88→46 Hz thud, and a shaker in a sprint.
- The buffers are pre-rendered in the background, ≤ 2 ms per 25 ms tick, once the music is on. Nothing on the frame path pays for synthesis.

## 3. Arrangement follows the page (decided at every bar line)
| Mode | When | Arrangement |
|---|---|---|
| **sun** | day, clear | strummed uke (D-DU-UDU), walking bass with approach notes, brushes and felt kick, whistle or uke lead, glock fills, light swing (0.57) |
| **soft** | dusk, dawn haze, fog, overcast | finger-picked uke, two-feel bass, brushes without the kick, swing 0.54 |
| **rain** | `weather.rain > 0.3` | **minor-tinged**: B♭ → B♭m (borrowed iv) with the melody's D flattened to D♭, and I → vi in bar 5. Plucked uke lead, quiet swish-only brushes, 6 % slower |
| **lullaby** | night (`night > 0.6`) | the melody moves to the **music-box glockenspiel**, the uke picks quarter-note arpeggios with maj7/m7/add9 colour tones, the bass is whole notes, no drums, straight time, 14 % slower |

## 4. Tempo follows the pedals, musically
`bpm_raw = 58 + 0.5 × cadence` (×0.86 at night, ×0.94 at dusk or in rain) snaps to the ladder **60 · 66 · 72 · 80 · 88 · 96 · 104 · 112**. Hysteresis is 85 % of a rung. The tempo moves **at most one rung per bar**, as a smooth accelerando or ritardando across that bar. A sprint to 100 rpm climbs 88 → 96 → 104 over two bars, and a coast slows gently.

## 5. The music listens to the story
- **Ducking.** A rig event (bell, hop, wave, gulp) ducks the music to −6 dB for the event's length, pelican speech ducks it to −4 dB, and a nearby director gag (cat, cyclist, gulls, fish…) to −2 dB. It recovers with a 0.5 s time constant.
- **Stings on the beat.** A gulp adds a glockenspiel "ta-da" (chord 3rd, then top) plus a bass note on the **next beat** after the swallow. A wave adds a rising three-note chord-tone arpeggio on the next beat.
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

- **Test hooks:** `createAudio(bus, {context, clock, seed, solo, inst, music})`. `debug().music` reports `{on, bar, step, bpm, mode, section, chords, crooning}`, and `debug().log` holds every cue (`tempo`, `arr`, `sting`, `hum`, `hup`, `honk`, `burp`, `meow`, …).
