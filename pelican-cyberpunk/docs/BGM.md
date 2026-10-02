# 霓虹快递 · Neon Delivery (BGM.md)

This is the theme of Neon Pelican: cyber-Chinatown darksynth that should be recognisable in three seconds. It opens cold on a **talk-box shouting "pe-li-CAN!"** while the tape spins up, over a guzheng glissando and a reese bass. From there it runs through a Phrygian verse sung by an **erhu**, two drops carried by a **screaming portamento lead** and an **FM-growl bass**, and a breakdown where the **city PA announces "next stop… neon delivery"**. A **fake-out ending** follows, and then the final slam.

Everything is synthesized in `src/audio/bgm.js` (score data plus one synth engine, no samples). `src/audio/audio.js` plays it live under the city. `tools/render-bgm.mjs` renders one loop to **`dist/bgm-cyberpunk.mp3`**.

| | |
|---|---|
| **Title** | 霓虹快递 · Neon Delivery |
| **Key** | E minor with a **Phrygian** ♭II (F) in the verse. The pentatonic counter-lines are on E yu (E G A B D). The pre-drop dominant is **B major**. Drop 2 makes a **sudden major lift** into E major (C · D · **E**). The track ends on a bare E5 power chord, neither major nor minor: the mech's chord. |
| **Tempo** | A fixed 96 bpm. The verse grooves half-time; the drops run four-on-the-floor at double-time energy. |
| **Length** | 48 bars = **2:00.0** per loop. The MP3 is 2:02.6, which adds the final hit's tail. |

## 1. The running order

| Bars | Time | Section | What happens |
|---|---|---|---|
| 1–2 | 0:00 | **Cold open** | A **tape-start**: everything spins up from two octaves down in 0.7 s. The talk-box hook **"pe-li-CAN!"** (B4–D5–E5), then **"ne-on de-li-ve-ry"**, under guzheng glissandos and a held reese. There are no drums. This is the 3-second signature. |
| 3–6 | 0:05 | **Intro: cyber-Chinatown** | A half-time beat (kick 1 + "and" of 3, a big gated snare on 3), a syncopated reese, the guzheng ostinato and a first erhu phrase. The talk-box calls back every two bars. |
| 7–14 | 0:15 | **Verse: the erhu** | Em · **F** · Em · D · Em · **F** · G · D. The Phrygian ♭II gives it its dark, old-town colour. The erhu sings the verse with slides into long notes and wide vibrato. The guzheng's pentatonic ostinato bends itself onto each chord (E→F and B→C over F). |
| 15–18 | 0:35 | **Pre: the mech wakes** | C · D · **B · B**. The 16th reese climbs, the snare rolls up, and a riser runs. The screaming lead enters on a B7 arpeggio, the talk-box shouts "pe-li-can" in B major, and **the mech leitmotif** stabs in. The last beat is a **stutter edit**: 32nd chops, bit-crushed, then a silent 8th. |
| 19–26 | 0:45 | **Drop 1: the scream** | Em · C · D · B · Em · C · Am · B. A huge impact, four-on-the-floor with clap and snare, and a **FM-growl bass** wobbling in 8ths (16ths in bars 22 and 26). The scream lead plays the drop hook with heavy portamento, a pitch scoop into every note and wide vibrato. The mech motif hits every four bars. The section ends in a **tape-stop** on its last beat: the whole band dives in pitch and dies. |
| 27–34 | 1:05 | **Breakdown: "next stop"** | Em · Em · C · C · Am · Am · B · B, at about −8 dB against the drops. No drums at first: guzheng tremolo, a big dark pad and a sub. **The city PA** (vocoder on a phone-band horn with a slap echo) announces *"next stop… neon delivery… pelican… 到达"*. In bars 31–32 a **bit-crushed** half-time beat creeps in under a high erhu solo. In bars 33–34 the leitmotif rises, the snare rolls and a riser runs. Then another **tape-stop** at beat 3 of bar 34, and two beats of silence. |
| 35–42 | 1:25 | **Drop 2: the major lift** | C · D · **E · E** · C · D · **E · E**. The minor key flips to **E major** and the scream jumps to G♯5 and E6. The erhu doubles in long tones, the talk-box answers in E major, and the growl switches to triplet wobbles on the E bars. There is a stutter at bar 38. |
| 43–44 | 1:45 | **Fake-out ending** | One huge E hit, a **tape-stop** to silence, then a whole bar of nothing but the PA, quietly asking *"pe-li-can?"*… |
| 45–48 | 1:50 | **Final slam** | …and the drop slams back in (Em · C · D), ending on the talk-box's longest **"pe-li-CAAAN!"**, the mech leitmotif and a final E5 hit with a sub-boom on beat 3. In the page the loop wraps to the cold open's tape-start. |

## 2. Chord chart

```
Open    | Em  | Em  |
Intro   | Em  | F   | Em  | D   |
Verse   | Em  | F   | Em  | D   | Em  | F   | G   | D   |      F = Phrygian bII
Pre     | C   | D   | B   | B   |                              B = major V (harmonic minor)
Drop 1  | Em  | C   | D   | B   | Em  | C   | Am  | B   |
Break   | Em  | Em  | C   | C   | Am  | Am  | B   | B   |
Drop 2  | C   | D   | E   | E   | C   | D   | E   | E   |      the major lift
Fake    | E   | -   |
Final   | Em  | C   | D   | E5  |                              the mech's bare fifth
```

## 3. The themes

- **The talk-box hook "pe-li-can"**: `B4:2:pe D5:2:li E5:4:kan` (in sixteenths), answered by `G5 A5 G5 E5 D5 E5` "ne-on de-li-ve-ry". It is all pentatonic, and it moves to B major (B–D♯–F♯) and E major (B–E–G♯) when the harmony lifts.
- **The drop hook (scream lead)**: `E5 G5 B5 A5 G5 E5 | G5 E5 D5 B4 | A5 B5 D6 B5 A5 F#5 | F#5 D#5 B4`. Its second half climbs to E6. In drop 2 it is re-voiced for the major lift: G♯5 → E6, F♯6, and a held E6 scream to close.
- **The mech leitmotif** comes from the suit's own "MECH ONLINE" HUD call (E–B–E–B), played as power-chord stabs: `E3 B3 E4 B4` (sixteenth, sixteenth, sixteenth, held). It appears in the pre, at every drop's downbeat, rising in the breakdown, in the fake-out hit and in the final bar. **In the page, the mech suit-up egg plays the same motif as its sting**, on the next beat, transposed to the current chord, with an impact.
- **The pentatonic counter-melodies**:
  - the guzheng ostinato `E4 B4 D5 E5 B4 A4 G4 A4`, fitted to each chord, with a 按音 (press-bend) up a whole tone at the end of every other bar;
  - the erhu's verse line;
  - the breakdown's erhu solo.

## 4. The instruments (`src/audio/bgm.js`)

| Part | Design |
|---|---|
| **Talk-box** | Two detuned saws through **three moving formant band-passes** (Q 6 / 9 / 11) with a vowel table (a e i o u, plus l m n y r). Plosives (p, k, t, d…) are filtered noise bursts with a dip in the voice; "-n" closes the formants nasally. It has portamento, light drive and the ping-pong delay. |
| **City PA** | The same formant voice on a **square** carrier, through a phone-band horn (a 500 Hz high-pass, a +10 dB peak at 1.8 kHz, drive) and a 270 ms slap echo. It **bypasses the tape**, so it can speak over the fake-out silence. |
| **Scream lead** | Three saws at −18 / 0 / +18 cents plus a square sub-octave, driven hard, then low-passed at 5.2 kHz. **Heavy portamento** on contiguous notes (τ 60 ms), a −150 cent scoop into every attack, and a delayed 30 cent vibrato. Ping-pong delay and plate. |
| **Erhu** | Two saws (+5 cents) through a nasal body (a band-pass at 1 kHz and a +7 dB peak at 2.7 kHz). A bowed attack, a slide up from a whole tone below into long notes, a 6.3 Hz vibrato and plate reverb. |
| **Guzheng** | A triangle plus a saw pluck with a bent attack (+20 cents settling in 25 ms), a bright filter decaying to 900 Hz, press-bends, tremolo picking and glissando rolls. Panned by pitch. |
| **Reese bass** | Two saws at ±16 cents plus a sine sub through a resonant low-pass swept by a slow LFO. |
| **FM growl** | A sine carrier and a sine modulator (1:1). An LFO **wobble**, synced at 8ths, 16ths or triplets, drives both the FM index and the filter, through a hard `tanh` drive. Bass is mono with a 30 Hz high-pass. |
| **Mech stabs** | Power chords (root, fifth, octave) of detuned saw pairs, a 400 → 5000 Hz filter snap, and drive. |
| **Drums** | A driven kick that pumps the pad and guzheng (sidechain-style), the 80s gated-reverb snare, a clap, 16th hats with open off-beats, crashes, impacts (a 62 → 27 Hz sub-boom plus a noise blast) and noise risers. |
| **Pad** | 4 × 2 detuned saws, low cut at 200 Hz, a section-dependent low-pass, pumped. |

**Glitch edits, done on the whole mix:**
- a **tape** (one `ConstantSource` driving the detune of every pitched voice): tape-starts and tape-stops with a real speed curve (pitch = 1200·log2(speed)), the mix fading as it slows;
- **stutters** (32nd-note chops at −10 dB, crossfaded into a 5-level **bit-crusher**);
- the **bit-crush drop** in the breakdown;
- silent gaps.

**Humanising:** timing offsets of ±10–15 ms on the melodies and plucks, ±3–6 ms on the kick, bass and snare, and ±10 % velocity everywhere.

## 5. In the page

- **Off by default.** It starts with the music switch (`U`, or the synth-keyboard button) from the cold open, and frees its voices 1.6 s after it is switched off.
- **The tempo never moves:** it is 96 bpm at any cadence, including the new 42 rpm cruise.
- **It thins or fills per beat:**
  - **day**: lighter drums, the erhu and guzheng forward;
  - **acid night**: more bass and stabs;
  - **deep night**: the bus closes to 6.5 kHz, with fewer hats;
  - **downpour**: the bus closes to 3.2 kHz, with soft drums;
  - **neon tunnel**: the bus closes to 1.5 kHz;
  - **old temple**: the erhu and guzheng +30 %;
  - **arcade**: the talk-box forward;
  - **sprint**: hats +30 %;
  - **coasting**: the drums, the lead and the talk-box drop out, and the pelican croons the hook through its vocoder.
- **Ducking:** −4.4 dB under rig events and eggs, −3 dB under the voice, −2 dB under the HUD.
- **Stings on the beat:**
  - gulp: a guzheng run up;
  - wave: three falling plucks;
  - mech suit-up: **the leitmotif**.

  The chime is tuned to the current chord.
- **Level:** the music bus alone measures −18.0 dBFS RMS. Sound plus music measures −16.3 dBFS, peaking at −3.1 dBFS (`tools/render-sound.mjs --music`).

## 6. The file, and the checks that remain

```
node tools/render-bgm.mjs           # dist/bgm-cyberpunk.mp3 (192 kbps, stereo, 44.1 kHz) + its peak / RMS / LUFS
node tools/render-bgm.mjs --check   # + per-section levels, clicks per stem, the loop seam (exits 1 on a failure)
```
The tool renders in headless Chromium with an `OfflineAudioContext`, scheduling like the page does. It masters in node: gain, then a look-ahead limiter whose ceiling is lowered until the decoded MP3 peaks at or below −1.3 dBFS. It encodes with `@breezystack/lamejs`, then decodes the MP3 back to measure it.

**The MP3:** 2873 KB, 122.6 s, **peak −1.34 dBFS, RMS −18.42 dBFS** (−15.4 LUFS integrated, reported but not a target). 0 clipped samples.

Only the technical rules are gates now: **no clipping, no clicks, peak ≤ −1 dBFS.** The final run:
- **The raw mix** peaks at −0.94 dBFS, with 0 samples at or above full scale. The MP3 has 0 clipped samples and peaks at −1.34 dBFS.
- **Clicks:** 0 on every tonal stem (bass, pad, guzheng, erhu, lead, talk-box, stabs), each rendered alone through the full glitch chain. Two tests were run:
  - sample steps above 3 × the stem's 99.99th percentile;
  - cut-offs: a drop of more than 20 dB within 10 ms that stays down. A single-window phase null of the beating reese is not a cut.

  The stutters chop to −10 dB with 4 ms ramps, the tape-stops fade with the speed curve, and the plosives dip rather than gate.
- **The loop seam** (the final bar into the cold open): the largest |Δx| is 0.015, against the excerpt's 99.9th percentile of 0.17.
- **The tape is restored** after every stop: a measured guzheng E5 is 658 Hz in the breakdown, and the lead's F♯ sub is 370.6 Hz in drop 2.
- **Dynamics** (mastered RMS per section, up to 10 s each):

| Open | Intro | Verse | Pre | Drop 1 | Break | Drop 2 | Fake-out | Final |
|---|---|---|---|---|---|---|---|---|
| −20.3 | −20.1 | −21.2 | −18.7 | **−16.2** | −23.7 | **−15.4** | −22.5 | **−15.9** |

The breakdown sits 8 dB under drop 2, and the fake-out bar is silent apart from the PA.

**How it got here:** the first version was competent, generic synthwave: an A-minor saw lead, an FM bell and a tidy intro-A-A′-B-bridge-A″-outro form, checked note for note against its score. On the user's note ("more personality") it was rewritten from scratch around a talk-box name-hook, Chinese instruments, Phrygian and major-lift harmony, glitch edits, a PA breakdown, a fake-out and the mech leitmotif.

These were the mixing passes after the rewrite:
1. **Stray notes.** A parsing bug gave every empty track a stray note at each section start. Fixed.
2. **Balance.**
   - The talk-box (−2 dBFS peaks) and the PA (+3 dBFS) were far too loud: −10 and −16 dB.
   - The kick and bass were dominating, so they came down.
   - The snare, hats and stabs came up.
   - The breakdown was trimmed to 0.55 of the drop level for contrast.
3. **The fake-out PA** resonated on its formants (−6 dBFS): moved an octave down and halved.
4. **Over-sharp edits.** The stutter and plosive dips were too abrupt, so they now chop and dip rather than gate. The cut detector was taught the difference between a phase null and a cut.
5. **Headroom.** A 0.55 trim keeps the raw mix under 0 dBFS (it had peaked at +4 dBFS). The page gain went from 0.8 to 1.35 to compensate.
