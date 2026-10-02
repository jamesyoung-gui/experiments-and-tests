# 晚安，鹈鹕 · Goodnight, Pelican

The storybook edition's background music: a bedtime-story waltz for a warm gouache picture book. It is composed, not generated. The score is data in `src/audio/audio.js` (`SCORE`), and every instrument is synthesised in WebAudio. There are no samples. The same code plays it in the page and renders the standalone track `dist/bgm-storybook.mp3` (`node tools/render-bgm.mjs`).

| | |
|---|---|
| **Key** | F major. B moves to B♭ major (IV), and the Bridge to D minor (vi), which turns back through a C7 pedal |
| **Metre / tempo** | 3/4 waltz, ♩ = 88 (80 at night). Straight eighths with humanised timing |
| **Form** | Intro (8) · A (16) · A′ (16) · B (16) · Bridge (8) · A″ (16) · Outro (8): **88 bars** |
| **Length** | **3:00** per loop. The standalone MP3 runs 3:02 with a fade-in, a closing ritardando and a 1.8 s tail |
| **Mood** | cosy and gently playful. A small "page-turn" flourish (a glockenspiel run plus a paper swish) closes every section |

## Form, bars and chords

The bar numbers count from the top of the loop. Each bar has one chord.

| Bars | Section | Chords | What happens |
|---|---|---|---|
| 1–8 | **Intro**, F | F · F · B♭ · C7 · F · Dm · B♭ · C7 | A music box (glockenspiel) plays the hook alone over a felt-piano pad, "once upon a time". The ukulele waltz and bass come in at bar 5. Page turn |
| 9–24 | **A**, F | F · F · Dm · Dm · B♭ · Gm · C · C7 ‖ F · F · Dm · Am · B♭ · C7 · F · F | **The hook** on celesta: an 8-bar question ending on C7, then an 8-bar answer home to F. Ukulele "oom-pah-pah", bass on 1, a brush swish on 1, glockenspiel fills at the phrase ends |
| 25–40 | **A′**, F | F · F · Dm · Dm · B♭ · Gm · C · C7 ‖ F · F · Dm · Am · B♭ · C7 · F · **F7** | The hook **varied**: dotted turns (C–B♭–A, F–G–F–E–C), higher answers up to B♭5, and a recorder counter-line. Ukulele finger-picks, the felt piano plays on 2 and 3, the bass on 1 and 3, brush taps. The F7 in the last bar pivots to B♭ |
| 41–56 | **B**, B♭ | B♭ · Gm · E♭ · F · B♭ · Gm · Cm · F7 ‖ B♭ · Dm · E♭ · Cm · B♭/F · F7 · B♭ · B♭ | **Contrast**: a new key and texture. The recorder takes a lyrical tune (rising F–B♭–D), the celesta plays broken chords, the piano carries the waltz and the ukulele rests |
| 57–64 | **Bridge**, Dm → C | Dm · Dm · B♭ · B♭ · Gm7 · Gm7 · C7sus · C7 | **Breakdown**: no drums and no ukulele. Bass pedals, piano pads, and the hook's head on celesta in minor (A–F, D–C–A). A brush roll swells over bars 63–64, and the pickup E–G leads into… |
| 65–80 | **A″**, F | F · F · Dm · Dm · B♭ · Gm · C · C7 ‖ F · **F7 · B♭ · B♭m · F/C** · C7 · F · F | **The full, final hook**: celesta doubled an octave up by glockenspiel, the recorder counter-line, a strummed ukulele, piano, a two-feel bass, brushes and shaker. The second half is reharmonised (F7 → B♭ → borrowed B♭m → F/C) and climbs to B♭5 |
| 81–88 | **Outro**, F | F · B♭/F · F · B♭/F · Gm7 · C7 · F · F | The music box sings the hook's head twice over a plagal rocking (F–B♭/F), then cadences Gm7–C7–F. In the page, the last bar's page-turn run leads straight back to bar 1 (the same F, so the seam is seamless). The standalone track slows and rings out instead |

### The hook

"Good-night, pe-li-can": `C5 (half) A4 (quarter) | F5 E5 C5 (quarters)`, then `D5 A4 | F4` (A, bars 9–12). It is heard on the music box (Intro, an octave up), on the celesta (A), varied (A′), in minor fragments (Bridge), in full with the octave doubling (A″), and as an echo (Outro).

`tools/render-bgm.mjs` renders the celesta alone through section A, detects each note's pitch (Goertzel on the attack) and compares it with the score. All 31 notes match.

## Instruments (all procedural)

| Voice | Synthesis | Role |
|---|---|---|
| **Celesta** | additive steel bar: a fundamental with a 0.08 % detuned shimmer pair (≈0.4 Hz beat), a faint octave, the bright 4th partial (fast decay), a 9.8× ping and a felt hammer tick. Pre-rendered with a rotating phasor | the lead in A, A′, the Bridge and A″, plus the broken chords in B |
| **Glockenspiel / music box** | inharmonic bar partials (1, 2.756, 5.404) and a mallet tick | the Intro and Outro lead, the A″ octave doubling, phrase-end fills, page-turn runs and event stings |
| **Recorder** | a mostly-fundamental periodic wave, a chiff noise burst at 2.3·f, breath noise tuned to the pitch, a 1.2 % scoop up to pitch, and a vibrato that arrives only on notes longer than 0.5 s | the B lead and the counter-line in A′ and A″ |
| **Felt piano** | live partials (slightly stretched, two unison strings ±0.9 cent), a fast-then-slow two-stage decay, a lowpass that opens with velocity, a soft hammer thump and a damper release | pads in the Intro, Bridge and Outro; the waltz "pah-pah" in A′, B and A″ |
| **Ukulele** | Karplus-Strong (2-tap loop, pluck-position comb), with each string damping its previous pluck | the waltz (beats 2 and 3), finger-picked eighths, a D-DU-DU strum, and a final roll |
| **Upright bass** | Karplus-Strong with a darker 3-tap loop and a thumb excitation, lowpassed at 900 Hz, **mono in the centre** | the root on 1, the fifth on 3, and pedals |
| **Brushes / shaker** | band-passed noise: a swish on 1, taps on 2 and 3, a 6 kHz shaker in eighths, and a two-bar roll swell | light time-keeping |
| **Page turn** | a glockenspiel run (six chord tones of the *next* section, over one beat) plus a pink-noise "paper" swish swept 1.4→5.2 kHz and panned L→R | the last beat of every section |

**Humanising:** every note gets ±10–15 ms of timing (±6 ms on the bass) and ±10 % velocity, with beat accents (1 > 3 > 2). **Mix:** each voice has its own low cut (bass 30 Hz, piano 110 Hz, ukulele 140 Hz, celesta 200 Hz, glockenspiel 300 Hz) and a lowpass. The ukulele, celesta, glockenspiel and piano share a gentle stereo chorus (two slow modulated taps at 11 and 16 ms, about ±5 cents). The bass, recorder and drums stay dry. Then come the music bus, the shared plate reverb (send 0.22, 0.32 in rain and at night), the master glue compressor and a brick-wall limiter.

## In the page

- **Off by default.** No `AudioContext` exists until sound is turned on, and the music has its own switch (the 音乐 Music button, `ui:toggle {key:'music'}`, `ui:music`, or `audio.setMusic(on)`). It always starts at bar 1.
- **Lookahead scheduler.** An eighth-note clock schedules 200 ms ahead from a 25 ms timer. When the tab is hidden, the master fades and the context suspends (≤ 100 ms). After a stall, the clock skips ahead instead of bursting.
- **The tempo never follows the pedals.** It is ♩ = 88, with one quantised step to ♩ = 80 at night (`night > 0.6`). The step is taken only on the first bar of a section.
- **The layers follow the page**, re-chosen at every bar line:

| Mode | When | Change |
|---|---|---|
| sun | day, clear | the full arrangement as written |
| soft | dusk, fog, overcast | brushes ×0.65, no shaker, ukulele and recorder a touch softer |
| rain | `weather.rain > 0.3` | swish only (no taps or shaker), more plate reverb, recorder ×0.8 |
| lullaby | night | no drums, ukulele ×0.7, recorder ×0.55, more reverb, ♩ = 80 |

- **Ducking.** Rig events (bell, hop, wave, gulp) and found **eggs** duck the music by −4.4 dB, pelican speech by −2.9 dB and a nearby director gag by −1.4 dB, recovering with a 0.5 s time constant.
- **Stings on the beat.** A gulp gives a glockenspiel "ta-da" (chord tones plus a bass note), a wave a rising chord-tone arpeggio, and an egg a three-note "ta-da-ding". Each lands on the next beat in the current chord.
- **The pelican hums the tune.** While coasting, the lead steps back (×0.3) and the pelican's formant voice hums the melody, folded into its range. This also works with the music off.

## The standalone track and the self-review

`node tools/render-bgm.mjs [--wav]` renders one pass (`opts.bgm: 'once'`, music bus soloed) in an `OfflineAudioContext` in headless Chromium. It then applies a 0.15 s fade-in and a 1.6 s fade over the 1.8 s tail, normalises BS.1770 loudness to −15 LUFS, and runs a look-ahead limiter at −1.5 dBFS. It encodes MP3 at 192 kbps, stereo, 44.1 kHz (`@breezystack/lamejs`) and decodes the MP3 back in Chromium to measure it. The full report goes to `shots/bgm/analysis.json`.

RESULTS
