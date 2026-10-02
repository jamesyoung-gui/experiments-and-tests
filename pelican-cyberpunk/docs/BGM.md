# 霓虹快递 · Neon Delivery (BGM.md)

The background music of Neon Pelican: a synthwave / darksynth night drive. It is a composed piece, written out note by note in `src/audio/bgm.js` (score data plus one synth engine, no samples) and played live by `src/audio/audio.js` under the city. `tools/render-bgm.mjs` renders one loop offline to **`dist/bgm-cyberpunk.mp3`**, a standalone track you can download and share.

| | |
|---|---|
| **Title** | 霓虹快递 · Neon Delivery |
| **Key** | A minor (Aeolian). B moves to the relative major (C). The final hook lifts a whole tone to **B minor**, and the outro brings it home to A minor. |
| **Tempo / metre** | 104 bpm, 4/4, straight 16ths. The tempo is fixed and never follows the cadence. |
| **Length** | 64 bars = **2:27.7** per loop. The MP3 is 2:30.3: the loop plus a 2.5 s natural tail. |
| **Mood** | Night drive, cool and heroic. The bridge breaks down and builds, then the key lift opens the final chorus. |

## 1. Form (bar numbers, start times)

| Bars | Time | Section | What happens |
|---|---|---|---|
| 1–8 | 0:00 | **Intro · ignition** | Pad and arpeggio alone, with the filters opening bar by bar. The FM bell hints at the hook's head (bars 3 and 7). The kick, the octave bass and 16th hats come in at bar 5. A snare fill and a riser run into A. |
| 9–16 | 0:18.5 | **A · the hook** | First statement of the hook on the saw lead. Four-on-the-floor kick, gated snare on 2 and 4, octave-bass 8ths, open hats on the off-beats. |
| 17–24 | 0:36.9 | **A′ · hook, varied** | The hook comes back ornamented (a pick-up and an upper-octave answer). It turns to Dm and ends on Esus–E. The FM-bell counter-line enters, the bass doubles to 16ths and the hats fill to 16ths. |
| 25–32 | 0:55.4 | **B · skyline** | Contrast: the C-major key area and a **half-time** groove (kick on 1 and the "and" of 3, snare on 3), 8th-note plucks, long soaring lead notes and a bigger pad. It ends on E, the dominant. |
| 33–40 | 1:13.8 | **Bridge · breakdown and build** | Bars 33–36 drop the drums, hold the bass and close the music bus to 1 kHz. The FM bell plays the hook's head over the borrowed ♭VI colour (Dm · B♭ · F · C). Bars 37–40 build: the kick returns, the snare climbs from quarters to 8ths to 16ths, the filter opens and a riser runs in. The lead picks up over G → F♯ (V of B minor). The drums, bass and plucks stop for the last 8th, a "drop" gap under the lead's pick-up. |
| 41–56 | 1:32.3 | **A″ · final hook (B minor)** | The big lift: A then A′, a whole tone up. The lead is doubled an octave up with a square sub-octave. A clap layers the snare, the hats run in 16ths, the bass in 16ths, the bell counter-line plays throughout, and there are crashes at bars 41 and 49. |
| 57–64 | 2:09.2 | **Outro · home** | The hook's head twice more in B minor, then the turn home: **F → G → Am** (♭VI–♭VII–i). The drums thin out (snare out at bar 61, kick out at bar 63), the bass holds and fades, and the bell plays the head one last time in A minor, landing on a long A. Bar 64 (Am) flows straight into the Am intro. The loop seam is measured below. |

## 2. Chord chart (one chord per bar)

```
Intro   | Am  | F   | C   | G   | Am  | F   | G   | E   |
A       | Am  | F   | C   | G   | Am  | F   | G   | E   |
A'      | Am  | F   | C   | G   | Dm  | F   | Esus| E   |
B       | F   | G   | C   | Am  | F   | G   | C   | E   |      (C major area, half time)
Bridge  | Dm  | Bb  | F   | C   | Dm  | Bb  | G   | F#  |      (bVI colour; F# = V of B minor)
A''     | Bm  | G   | D   | A   | Bm  | G   | A   | F#  |      (A up a tone)
        | Bm  | G   | D   | A   | Em  | G   | F#sus| F# |      (A' up a tone)
Outro   | Bm  | G   | D   | A   | F   | G   | Am  | Am  |      (bVI - bVII - i: home)
```

## 3. The hook (the melody that comes back)

The tokens are `pitch:sixteenths`. The motif is a leap up a fifth, then a stepwise fall: **A4 – E5 – D5 – C5**. It is answered by a rising run to G5.

```
A  (bars 9-16)   | A4:3 E5:3 D5:2 C5:6 r:2 | C5:2 D5:2 E5:3 F5:3 E5:2 C5:4 | G4:3 E5:3 D5:2 C5:6 r:2 | B4:2 C5:2 D5:4 G5:8 |
                 | A4:3 E5:3 D5:2 C5:6 r:2 | C5:2 D5:2 E5:3 F5:3 A5:4 G5:2 | G5:3 F5:3 E5:2 D5:4 B4:4 | E5:6 D5:2 B4:4 G#4:4 |
A' (bars 17-24)  | A4:2 C5:1 E5:3 D5:2 C5:2 E5:2 A5:4 | A5:2 F5:2 E5:3 F5:3 A5:4 C6:2 | G5:3 E5:3 D5:2 C5:4 E5:2 G5:2 | B5:4 A5:2 G5:2 D5:8 |
                 | D5:3 A5:3 G5:2 F5:6 E5:2 | F5:2 G5:2 A5:3 C6:3 A5:2 F5:4 | E5:4 A5:4 B5:8 | G#5:12 r:4 |
A'' (bars 41-56) = A then A', transposed +2 (B minor), octave-doubled
```
- **A′** varies the hook. A pick-up C5 is added, the first phrase leaps on to A5, the answer climbs to C6, the motif is sequenced onto Dm (D5–A5–G5–F5), and the phrase ends on the leading tone G♯5.
- **A″** is the fuller, final hook: the same tune a whole tone up, with the full arrangement.
- The FM-bell counter-line answers in the second half of each bar, while the lead holds or moves slowly. For example, it plays C6–E6–A6 over Am and B6–G♯6–E6–B5 over the E turnaround.

## 4. Instrumentation (all synthesized, `src/audio/bgm.js`)

| Part | Design |
|---|---|
| **Octave bass** | A saw plus a square (−7 cents) through a resonant low-pass (Q 4) with a per-note filter envelope. It pulses in 8ths or 16ths between the root and its octave, with a parallel `tanh` drive path for the darker moods. It is mono, with a 32 Hz high-pass. |
| **Kick** | Four on the floor. A 165 → 48 Hz sine sweep with a click transient. Every kick drives the **sidechain pump** (pad, arp and bell dip to −10 dB and recover with τ ≈ 0.1 s). |
| **Gated snare** | A triangle body, a band-passed noise crack, and the 80s **gated reverb**: a dense flat pink-noise tail held 220 ms, then cut in 15 ms. The roll and fill hits use a short gate. |
| **Clap, hats, crash, riser** | A 3-burst clap layered on the A″ snare. Closed and open hats (high-passed noise, 16ths or off-beats). A long noise crash on section downbeats. Band-pass noise risers into A, the bridge build and A″. |
| **Pad** | 4 voices × 2 saws detuned ±8 cents. A **low cut at 210 Hz** and a low-pass that opens through the intro. A stereo chorus (two LFO-swept 11 ms and 16 ms delays panned hard L and R), the sidechain pump, and a plate send. |
| **Arp plucks** | A saw plus a +5 cent square through a plucky Q 3 filter envelope. The pattern is up-down or a leaping 0-2-1-3, in 16ths (8ths in B). A dotted-8th delay, panned against the dry signal. |
| **Lead** | Two saws ±7 cents, plus an octave-up saw (A″ doubling) and a square sub-octave (A″). **Portamento** on every contiguous note (τ 30 ms), delayed vibrato on long notes (5.4 Hz, ±13 cents after 0.3 s), a filter "bite" on each attack, a dotted-8th ping-pong delay and a plate send. |
| **FM bell** | A sine carrier with a **3.5 : 1** sine modulator whose index decays from 2.4 to 0.08 over 0.9 s, plus a 2× partial. The voices are panned alternately ±0.3 and feed the ping-pong delay and the plate. |
| **Stings** | Gulp: a power-up bell arpeggio of the current chord. Wave: three falling bell notes. **Mech suit-up**: a filtered saw power-chord stab (a 300 → 5200 → 700 Hz sweep), a crash and a 4-note bell run. All land on the next beat, in the current chord. |

**Humanising:** each note's timing gets a seeded random offset. The lead and bell move ±15 ms (legato notes ±6 ms), the arp and hats ±8–10 ms, the snare ±6 ms, and the kick and bass ±4 ms, so the four-on-the-floor stays locked as the style wants. Every hit also gets a velocity offset of ±10 %.

**Mix:** parts → sidechain pump (pad, arp, bell) → bus high-pass 28 Hz → mood low-pass → duck → level. The engine has its own plate reverb (2.4 s, generated). In the page, the music feeds the page's master compressor and limiter (ceiling −3 dBFS). For the MP3, `render-bgm.mjs` masters in node: the gain is set to −15 LUFS integrated (ITU-R BS.1770), then a look-ahead peak limiter (1.5 ms, 120 ms release) runs. Its ceiling is lowered until the *decoded* MP3 peaks at or below −1.3 dBFS.

## 5. In the page (`src/audio/audio.js`)

- **Off by default.** It starts with the existing music switch (`U`, or the synth-keyboard button in the control card; the music switch also opens the sound) and always starts from the intro. Turning it off fades it in 0.25 s and frees the voices 1.6 s later.
- **Scheduling:** a lookahead scheduler, a 25 ms pump that schedules 200 ms ahead on the 16th grid. Persistent voices are driven by scheduled envelopes. After a stall it resyncs with no backlog. The context is suspended 100 ms after the tab is hidden.
- **The tempo never moves** (104 bpm), whatever the cadence. The default cruise is now 42 rpm and nothing in the music is keyed to the cadence.
- **It adapts gently, per beat** (levels and filters only):
  - **dusk drive** (the default): the full mix;
  - **day**: lighter drums and bass, a brighter pad and bell;
  - **acid night**: the bass drive opens;
  - **deep night**: the bus closes to 6.5 kHz, with fewer hats and a driven bass;
  - **downpour**: the bus closes to 3.2 kHz, with soft drums;
  - **neon tunnel**: the bus closes to 1.5 kHz;
  - **scrapyard**: a driven bass;
  - **temple**: the bells come forward;
  - **arcade**: the plucks come forward;
  - **sprint** (≥ 90 % of the sprint cadence): hats +30 %;
  - **coasting**: the kick, snare and lead drop out, and the pelican croons the hook through its vocoder, an octave down.
- **Ducking:**
  - −4.4 dB under rig events (the bell, hop, wave and gulp) and under eggs (the mech suit-up holds it for 3.9 s);
  - −3 dB under the pelican's voice;
  - −2 dB under HUD bleeps and nearby gags.

  It recovers with a 0.5 s time constant.
- **Stings on the beat**:
  - the gulp, the wave and the mech suit-up (at the visor lock, 3.2 s into the suit-up);
  - **the chime is in tune**: its two strikes take the current chord's tones.
- `debug().music` reports `{on, built, bar, step, bpm, mode, section, chords, crooning}`.

## 6. Rendering the file

```
node tools/render-bgm.mjs           # dist/bgm-cyberpunk.mp3 + peak / RMS / LUFS of the decoded MP3
node tools/render-bgm.mjs --check   # + the listening analysis below (exits 1 on any failure)
```
The tool bundles `src/audio/bgm.js` with esbuild and renders it in headless Chromium (Playwright) with an `OfflineAudioContext`. It schedules like the live page, suspending every 0.5 s and pumping 1 s ahead, because queuing thousands of `AudioParam` events up front slows Chromium down quadratically. It renders one loop (bars 1–64, `loop: false`), lets the outro's voices release over a 2.5 s tail, and applies a 0.25 s fade-in and a 0.6 s raised-cosine fade at the very end. It then encodes in node with `@breezystack/lamejs` (192 kbps, stereo, 44.1 kHz) and decodes the MP3 back in Chromium to measure what a listener actually gets.

**The MP3:** 3522 KB, 150.3 s. **Peak −1.70 dBFS, RMS −18.08 dBFS, integrated −15.39 LUFS**, 0 clipped samples.

## 7. Self-review by measurement (I can't listen, so I measured)

The final `--check` (seed 7) gave these results.

| Section (10 s from its start, mastered) | RMS dBFS | Low / mid / high energy % (<250 Hz / 250 Hz–4 kHz / 4–16 kHz) |
|---|---|---|
| Intro | −22.4 | 31 / 68 / 0.5 |
| A | −17.1 | 52 / 44 / 4.9 |
| A′ | −17.2 | 45 / 49 / 6.0 |
| B | −17.2 | 49 / 46 / 4.9 |
| Bridge | −20.2 | 51 / 49 / 0 (the breakdown, low-passed) |
| A″ | −16.9 | 44 / 50 / 6.1 |
| Outro | −17.6 | 56 / 40 / 5.0 |

- **Clipping:** 0 samples at or above 0 dBFS in the raw mix (peak −0.02 dBFS before mastering) and 0 in the MP3.
- **Clicks:** 0 on every tonal stem (bass, pad, arp, lead, bell, each rendered alone for the full loop). Two tests were run: isolated sample steps above 3 × the stem's own 99.99th-percentile step, and drops of more than 20 dB between adjacent 10 ms windows.
- **The hook against the score:** each lead note was rendered dry and solo, and its pitch measured by YIN 90 ms into the note. The expected pitches are re-read from the written score text. **A: 37/37, A′: 38/38, A″: 37/37** notes match. A″ is compared by pitch class, because its square sub-octave sits an octave below.
- **The loop seam** (outro → intro, rendered with the engine looping by itself): the largest |Δx| within ±20 ms of the seam is 0.014, against the excerpt's 99.9th percentile of 0.198, so there is no discontinuity. The level is −26.2 dBFS in the 2 s before the seam and −24.1 dBFS in the 2 s after.

**Iterations** (each a full render and `--check`):
1. **First pass.** The raw mix peaked at +4.6 dBFS, with 6307 samples over full scale. All part levels came down 5 dB.
2. **Too dark.** The 4–16 kHz band held 0.2 % of the energy and low frequencies 60–65 %. The lead, pad and arp filters opened (lead 3.6–5.2 kHz, pad 3.8–4.6 kHz, arp 4–5.6 kHz). The bass fades out over the last outro bar, so the outro hands over to the bass-less intro smoothly. The click detector's 1 ms windows were swapped for 10 ms windows: 1 ms cannot judge a 41 Hz bass.
3. **A quiet intro and buried plucks.** The intro pad came up +2.6 dB and the arp +1.6 dB.
4. **The hats and snare were still inaudible.** A per-part stem probe measured the hats at −52 dBFS and the snare at −39 dBFS, against a lead at −23. The snare came up +10 dB, the hats +16 dB and the bell +4.4 dB. The highs went from 1–2 % to 5–6 %, and the low band settled at 44–52 %.
5. **The MP3's peak overshot.** The encoder's low-pass rings on the sharpest transients, so the decoded peak landed about 0.55 dB above the PCM peak. The limiter ceiling now iterates against the decoded MP3 until it peaks at or below −1.3 dBFS. In the final render, −1.8 → −2.21 dBFS PCM gave −1.70 dBFS decoded.
