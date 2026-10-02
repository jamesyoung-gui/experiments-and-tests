# 晚安，鹈鹕 · Goodnight, Pelican

**A wonky toy-box bedtime waltz.** Picture a slightly out-of-tune music box that gets wound up, runs down and is wound up again. A kazoo blows the tune, a tuba oom-pahs along with clumsy charm, and the waltz trips over its own feet into 4/4 and stumbles back. Then comes a sudden *"shh…"*: the pelican hums the tune off-key, yawns and snores, wakes with a *boing* and a slide whistle, joins in with everybody, and dozes off before the music box can finish its last phrase.

The score is data (`SCORE` in `src/audio/audio.js`), and every sound is synthesised in WebAudio, with no samples. The same engine plays it in the page and renders `dist/bgm-storybook.mp3` (`node tools/render-bgm.mjs`).

| | |
|---|---|
| **Key** | F major. The Hush is in D minor, and the Wake-up in B♭ major |
| **Metre** | 3/4 waltz, with **4/4 stumbles**: two bars at the end of A′ and one in the middle of the Wake-up |
| **Tempo** | ♩ = 88. The Hush drops to **72** and the Wake-up jumps to **104**. The music box **winds down** (slower and flatter) at the end of the Wind-up, the Hush and the Doze-off |
| **Form** | Wind-up (5) · A, kazoo (16) · A′, melodica (16) · Hush (8) · Wake-up! (12) · A″, everyone (16) · Doze-off (6): **79 bars, deliberately lopsided** |
| **Length** | about 2:48 per pass. The MP3 runs 2:50 (a fade-in, and the last snore rings out) |

## The hook: a leap up a major seventh

`F4 ⟶ E5 – D5 | C5 – A4 B♭4 – C5`, sung as "Good-**night** (leap!), pe-li-can". The major-seventh leap lands on the "wrong" note, the dreamy E over F, and tumbles down. It is the tune's fingerprint, and it changes every time:
- **Wind-up:** a tinny, out-of-tune music box an octave up.
- **A:** a cheeky kazoo, which scoops up into every note.
- **A′:** a stuttered "F-F-leap" on melodica, then a leap of a full octave.
- **Hush:** minor, a leap of a minor seventh (D5→C6), and the pelican hums it a third of a semitone flat.
- **Wake-up:** in B♭ (B♭4→A5) on kazoo, after the bassoon's wake-up arpeggios.
- **A″:** a double leap, F4→E5→**E6**, the kazoo squeaking up an extra octave.
- **Doze-off:** the music box, slowing, sagging flat, and stopping one note short.

## Form, bars and chords

The bar numbers count from the top of the pass.

| Bars | Section | Chords | What happens |
|---|---|---|---|
| 1–5 | **Wind-up**, F, ♩ 88 | F · F · F · Gm · C7 | A wooden ratchet **winds the music box**. It plays the hook, out of tune (each tine has its own ±16 cents error), then **runs down** in bar 4: 70 % slower and 70 cents flat. It stalls; another crank, a boing, and off we go |
| 6–21 | **A (kazoo)**, F | F · F · Gm · C7 · F · Dm · G7 · C7 ‖ F · F · B♭ · B♭m · F/C · C7 · F · F | A kazoo states the hook. The tuba plays "oom" on 1 and the ukulele "pah-pah" on 2 and 3, with brushes. A cheeky G7 brings a B♮ into the tune. A **page turn is played as a rhythm hit** on beat 3 of bar 13. The last bar is a percussion break: boing, page, boing |
| 22–37 | **A′ (melodica)**, F, **trips into 4/4** | … · F/C · **C7 (4/4) · C7 (4/4)** · F | A wheezy melodica plays a stuttered, higher variation, with a recorder counter-line, a finger-picked ukulele, a piano "pah-pah" and the tuba on 1 and 3. In bars 35–36 the waltz **trips into two bars of 4/4**: the tuba lumbers up root–fifth–sixth–seventh and the tune climbs chromatically (G A B♭ B♮ C), boinging on its way back into 3/4 |
| 38–45 | **Hush ("shh…")**, D minor, **♩ 72** | Dm · Dm · B♭ · B♭ · Gm · A7 · Dm · Dm | **Sudden quiet** (about −11 dB): a soft *"shh!"*. Only the music box and a felt-piano pad play, while **the pelican hums the tune off-key** (−38 cents, plus a wobble) and the music box winds down again. Bar 45: **a yawn glissando** (slide whistle down plus a sleepy "haaa-oh") and **a snore** ("hrrrk… pshhh") |
| 46–57 | **Wake-up!**, B♭, **♩ 104** | B♭ · B♭ · E♭ · F7 · B♭ · Gm · **C7 (4/4)** · F7 · B♭ · E♭ · F7 · C7 | **Boing!** plus a slide whistle up. A grumpy bassoon plays wake-up arpeggios, then the kazoo takes the hook in B♭. A strummed ukulele, shaker, tuba oom-pah and one more **4/4 stumble** with three boings |
| 58–73 | **A″ (everyone)**, F, ♩ 88 | F · F · Gm · C7 · F · Dm · G7 · C7 ‖ F · F · B♭ · B♭m · F/C · C7 · F · F | The loudest part: kazoo plus a glockenspiel an octave up, the recorder counter-line, strummed ukulele, piano, tuba on 1 and 3, brushes and shaker, and boings on the page turns. Bar 66 holds the **double leap** up to E6. The B♭→B♭m sigh before the final cadence |
| 74–79 | **Doze-off**, F | F · B♭/F · F · C7 · F · F | The music box plays the hook again over a pad, **winding down** across four bars (up to 110 % slower and 160 cents flat), and **stops mid-phrase** on A–G. Last bar: a tuba **"bwomp"** that sags a minor third, a yawn and a snore. In the page, the next pass starts with the crank winding the box up again |

## Instruments (all procedural)

| Voice | Synthesis |
|---|---|
| **Music box** | inharmonic comb-tine partials (1, 2.756, 5.404) and a mallet tick, played back with a stable per-note detune (±16 cents) plus the wind-down **sag** |
| **Kazoo** | a sawtooth scooping up −70 cents into each note, through three nasal formants (560, 1400, 2600 Hz), with a **membrane buzz** (noise gated by the tone) and a 6 Hz vibrato on long notes |
| **Melodica** | square plus a beating second voice at +9 cents, a soft scoop and a breathy wheeze, formants at 900 and 2100 Hz |
| **Bassoon** | a double-reed sawtooth through formants at 460 and 1150 Hz, woody and slightly grumpy |
| **Tuba** | a sawtooth plus sub, with a lowpass that **blooms open on the attack** (2.5→9→3.5 × f) and a clumsy −90 cents scoop. The "bwomp" falls a minor third |
| **Recorder** | a mostly-fundamental tone, a chiff, breath noise tuned to the pitch, and a late vibrato |
| **Felt piano** | stretched partials, two unison strings, a two-stage decay and a damper release |
| **Ukulele** | Karplus-Strong, plucks damping each other per string (waltz "pah-pah", picked, strummed) |
| **Glockenspiel** | the A″ octave doubling, and the page-turn runs that close sections |
| **The toy box** | the wooden ratchet **crank**; a **boing** (a triangle wobbling 150→390 Hz); **page hits** (a pink-noise swish); **"shh"**; a **slide whistle** (up for the wake-up, down for the yawn); the pelican's **off-key hum**, **yawn** and **snore** (the same formant voice as the pelican in the page) |
| **Brushes / shaker** | a swish on 1, taps on the other beats, a shaker in eighths in the loud sections |

**Humanising:** ±10–15 ms timing on every note and ±10 % velocity, plus the deliberate wonk (out-of-tune tines, scoops, the flat hum). **Mix:** a low cut per voice, and a chorus on ukulele, glockenspiel and piano. Tuba, kazoo, recorder, drums and toys stay dry and centred-ish. The plate reverb send rises in the Hush.

## In the page

- **Off by default.** It has its own Music switch (`ui:toggle {key:'music'}`, `ui:music`, `audio.setMusic`) and always starts with the crank.
- **Scheduling:** a lookahead scheduler (eighth notes, 200 ms ahead; 6 steps per 3/4 bar, 8 per 4/4 bar). It suspends when the tab is hidden and skips ahead after a stall.
- **Tempo** is the score's own (88 / 72 / 104), switched only on a section's first bar, and ×0.9 at night. It **never follows the pedals**.
- **Layers follow the page:** the toys, drums and counter-lines thin out at dusk, in rain and at night (sun / soft / rain / lullaby).
- **Ducking:** −4.4 dB under bell, hop, wave, gulp and eggs.
- **Stings:** the gulp and wave stings land on the next beat. The egg stinger (the hook on a music box) and the rest of the foley are described in [SOUND.md](SOUND.md).
- **The pelican hums:** while coasting, the lead steps back and the pelican hums the melody.

## The standalone track and its measurements

`node tools/render-bgm.mjs [--wav]` renders one pass (`opts.bgm: 'once'`, music bus soloed) in an `OfflineAudioContext` in headless Chromium. It applies a 0.15 s fade-in and a tail with a fade, then **peak-normalises only** (to −1.5 dBFS, with no loudness target, so the Hush stays a hush). A safety look-ahead limiter follows. It encodes MP3 at 192 kbps, stereo, 44.1 kHz with `@breezystack/lamejs`, and decodes the MP3 back in Chromium to measure it. It also checks the loop seam (Doze-off → Wind-up) for clicks. The report goes to `shots/bgm/analysis.json`.

**Final measurements:**

| | |
|---|---|
| file | `dist/bgm-storybook.mp3`, 3.99 MB, 192 kbps, stereo, 44.1 kHz, **2:50.2** (one pass is 2:47.9) |
| MP3, decoded again | **peak −1.74 dBFS · RMS −18.8 dBFS** (about −15.9 LUFS, not targeted) · 0 clipped samples |
| before encoding | peak −1.5 dBFS, **0 clicks**. The safety limiter touches 0.3 % of samples. The raw render (in-page level) peaks at −7.3 dBFS |
| loop seam (Doze-off → crank → Wind-up) | 0 clicks, 0 clipping. It is meant to go from snoring to a wind-up, so there is no level-matching test |
| dynamics | **13.2 dB** between the loudest and quietest sections |

| Section | starts | length | RMS dBFS | peak | low | mid | high |
|---|---|---|---|---|---|---|---|
| Wind-up | 0:00 | 10.6 s | −28.2 | −12.5 | −21.2 | −0.0 | −29.8 |
| A (kazoo) | 0:10.6 | 32.7 s | −20.9 | −5.7 | −5.3 | −1.5 | −26.1 |
| A′ (melodica, 4/4 trip) | 0:43.4 | 34.1 s | −16.9 | −3.1 | −6.3 | −1.2 | −30.2 |
| Hush ("shh…") | 1:17.5 | 21.4 s | **−27.8** | −10.6 | −8.2 | −0.7 | −28.6 |
| Wake-up! | 1:38.8 | 21.3 s | −19.0 | −2.1 | −4.6 | −1.9 | −24.4 |
| A″ (everyone) | 2:00.2 | 32.7 s | **−15.0** | −1.5 | −6.9 | −1.0 | −27.6 |
| Doze-off | 2:32.9 | 15.1 s | −27.6 | −11.6 | −13.3 | −0.2 | −31.3 |

(The band columns are each band's share of the excerpt's energy, in dB: low < 250 Hz < mid < 4 kHz < high. RMS and band shares come from the first ≤ 10 s of each section.)

**Iterations of the rewrite:**
1. A per-section audition showed every section playing and every toy event landing as written. But the Hush was as loud as A (−26 dB) because the off-key hum ignored the section dynamics, and the kazoo was timid. The fixes: the hum scaled by the section level, the Hush level at 0.32, and the kazoo +2.4 dB.
2. The full render passed with 13.6 dB of contrast. The tuba made A bottom-heavy (low band −3.9 dB), so the tuba was trimmed 2.3 dB.
3. Final, as above.
