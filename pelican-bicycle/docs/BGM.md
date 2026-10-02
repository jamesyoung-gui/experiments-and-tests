# 鹈鹕大摇摆 · The Pelican Strut — BGM and soundscape (edition C, the retro travel poster)

A cheeky 1930s seaside swing number that sounds like a 78-rpm record found in a beach-hut drawer, and a soundscape
built from the same period. Everything is synthesized with WebAudio in `src/audio/bgm.js` (the band) and
`src/audio/audio.js` (the world). There are no sample files. Standalone track: `dist/bgm-poster.mp3`, rendered by
`node tools/render-bgm.mjs`.

## What makes it this edition's tune

- **The pelican is in the band.** Its honks (pitched, cartoon-1930s, reedy) and bill-clacks are written into the score
  as instruments. They answer the clarinet's hook ("honk-honk!"), take a "wrong-note" honk solo in the stop-time break
  (A–C–E♭–D), count the band in with two clacks and a honk, and say "two bits" at the end. **The bicycle bell is a
  rhythm hit**: dings on 2 and 4 in the turnaround bars, and a ding before the last honk.
- **A hook with three quirks.** It goes `C D A♭→A · F D↘`: a blue A♭ that bends up into the A (the "wrong" note that
  gets corrected), a hiccup rest straight after it, then a fall off the D. The turnaround bar hiccups down the
  chromatic scale, `G · G♭ · F · E`, and the pelican clacks in the gaps.
- **The swing leans hard and a little drunk.** Off-beats sit at 0.67–0.70 of the beat. The lead lays back 10–34 ms and
  drifts slowly with the phrase, the bass pushes 4–5 ms ahead, the backbeat drags 8–12 ms, and the ride stays on the
  beat. Every note is also humanised (±12 ms, ±10 % velocity).
- **Tempo pushes and pulls, in musical steps.** A rubato clarinet intro (100 bpm with stretched beats and a fermata),
  then it kicks in at 126. The bridge drags (112 → 110 → 108), the build accelerates (120 → 128), and the last chorus
  bursts in at 132 after a **sudden key change up a tone (F → G)**. The tempo map is part of the score. It never
  follows the bike.
- **Comic Foley in the music**: a swanee slide whistle (up in the intro; up-and-down in the break), a jaw-harp boing
  in the bridge, a cymbal choke, toms and woodblock-like bill clacks in the drum break.
- **A found record.** Every note goes through a gramophone chain: wow (0.55 Hz, about ±10 cents) and flutter (6.2 Hz)
  from a modulated delay, a horn-gramophone band (120 Hz – 5.2 kHz with a +3.5 dB bump at 1.5 kHz) and a gentle tanh
  "shellac" drive. Under it sits a looping surface of hiss, soft ticks, the odd pop and a once-per-turn swish
  (1.3 Hz = 78 rpm). The ticks are smooth micro-bursts (12-sample attack), never digital steps.
- **Dynamics with real contrast**: a soft rubato intro (about −23 dBFS RMS), the groove (−20), a lazy, quiet bridge
  (−23), then the key-change chorus and the tag (about −18). See the measurements below.

## Facts

| | |
|---|---|
| Title | 鹈鹕大摇摆 · The Pelican Strut |
| Key | F major. The bridge is in B♭ (IV) and builds on C7 → D7. The last chorus and the tag are in **G major** (up a tone). |
| Tempo | Rubato intro (100 bpm, stretched) → 126 → bridge 112 / 110 / 108 → build 120, 128 → last chorus 132 |
| Feel | Swing, ratio 0.67 (A), 0.70 (bridge), 0.68 (last chorus); laid-back lead, pushed bass |
| Length | 74 bars, about 2:26 per pass in the page. The MP3 is 2:28 (one pass plus the ring-out). |
| Instruments | Clarinet (lead), harmon-muted trumpet (plunger wah answers, harmony, second lead), upright bass, stride / Charleston piano, banjo on 2 & 4, brushes / ride / sticks, toms, vibraphone counter-line, **pelican honks and bill-clacks, bicycle bell, slide whistle, jaw-harp boing** |

## Form (bar numbers as in the page loop)

| Bars | Section | What happens | Chords (one bar each; two chords = 2 beats each) |
|---|---|---|---|
| 1–4 | **Intro**, rubato | Clarinet cadenza with a bent A♭→A and a fermata on high C; rolled piano chords, a bass pedal, a soft cymbal swell. The slide whistle goes up. Count-in: clack · clack · HONK. | F6 \| D7 \| Gm7 \| C7 |
| 5–6 | **Vamp** | It kicks in at 126: walking bass, Charleston piano, banjo, brushes. A bell ding, then the clarinet pickup. | F6 D7 \| Gm7 C7 |
| 7–22 | **A**: the hook | Clarinet hook (bend, hiccup, fall). The pelican answers (honk-honk, then three honks, each lower), the muted trumpet answers with plunger wah, bell dings on 2 and 4, the hiccup turnaround with clacks. | F6 \| F6 \| D7 \| D7 \| G7 \| G7 \| C7 \| C7 \| F6 \| F6 \| D7 \| D7 \| Gm7 \| C7 \| F6 D7 \| Gm7 C7 |
| 23–38 | **A′**: the trumpet takes the hook | The trumpet plays the hook with the plunger; the clarinet answers in the gaps and the vibraphone plays a guide-tone counter-line. The ride comes in. A cymbal choke ends it. | as A |
| 39–44 | **Break**, stop-time | The band hits on 1 and the and-of-2. In the gaps the clarinet licks alternate with the pelican: a honk solo with a wrong-note E♭, six bill-clacks in triplets, a slide whistle up and down. | F6 \| D7 \| G7 \| C7 \| F6 \| D7 |
| 45–46 | **Drum break** | Solo drums: toms, stick snare, a bill-clack, a snare ruff. | (C7) |
| 47–54 | **B**: bridge in B♭ | Lazy and quiet, the tempo drags. Muted-trumpet melody, low clarinet guide tones, sparse high piano, brushes, a two-feel bass, a boing, a sleepy low honk. | B♭6 \| B♭6 \| Cm7 \| F7 \| Dm7 \| G7 \| Cm7 \| F7 |
| 55–56 | **Build** | 120 bpm: a chromatic clarinet run and a snare roll crescendo. 128 bpm: band quarter hits on D7, the clarinet smears up to D, a honk on the and-of-4. | C7 \| D7 |
| 57–72 | **A″**: key change to G, full band | A crash. Clarinet hook up a tone with trumpet close harmony, stride piano, stick backbeat, ride, vibes counter-line, the pelican and the bell as in A. A new high ending phrase. | as A, +2 (G6 \| G6 \| E7 … Am7 \| D7 \| G6 E7 \| Am7 D7) |
| 73–74 | **Tag**: "shave and a haircut … two bits" | The whole band in unison hits `G D D E D`. A long, stretched pause (the record "hiccups"), then "two bits": F♯ → G with a bell ding, a big HONK on the tonic and a cymbal choke. In the MP3 the final chord, the bass and a vibes shimmer ring out under the crackle. In the page, the record starts again. | G6 \| D7 G6 |

## Soundscape (the world, `audio.js`)

Everything is period-flavoured and physically modelled, so it is clearly different from the storybook and cyberpunk
editions:

- **Brass bicycle bell, ring-ring.** Inharmonic dome modes as beating pairs. Each thumb flick spins the rotary clapper
  about 3 times (31 ms apart), two flicks per ring. A doppler glide (±0.6 %) and a pan sweep as the bell passes the
  camera's ear, then a swing-band cymbal choke.
- **Vintage freewheel ratchet.** The pawl snap (three steel modes at 2.1–5.4 kHz) plus the spring's rebound 1.7 ms
  later and a hollow hub-shell "tok" (1.18 kHz). The tick rate is exactly wheel rev/s × 18 pawls.
- **Chain whirr like a wind-up toy.** A clockwork gear train (a resonant metal band gated by a square wave at
  chainring-tooth rate) plus a little motor whine at 6 × the tooth rate that rises with the pedalling.
- **Seaside ambience by route stretch** (`frame.weather.stretch` / `km`):
  - Surf swells with **shingle dragged by the backwash**: hundreds of synthesized pebble ticks after each crest. Strong
    on the shingle beaches (village, lido), faint on the sand dunes. Bigger and deeper surf booms under the cliffs.
  - Gulls, busiest at the harbour and pier and at dawn, fewer in the pines, in fog and in rain.
  - **A tram gong** ("clang-clang") in the village.
  - **A carousel band organ** at the pleasure pier: an 8-bar waltz on flue and reed pipes with oom-pah-pah and a bass
    drum. It gets louder and brighter as you pass the middle of the pier and pans from right to left as you ride by.
  - **A three-chime steam-ship whistle**, more often in the fishing harbour.
  - **The lighthouse diaphone** ("BEEE-oh", the famous grunt at the end) at night or in fog, more often at
    Lighthouse Point.
  - Promenade crowd murmur by day (village, piers, lido), wind in the pines on the Pine Walk, rain on the awnings
    (a bed plus single drips), and crickets at night.
- **The pelican**: cartoon-1930s honks (a reedy buzz, two formants and a throaty flutter): a double honk on the wave,
  a "hup!" on the hop, a contented "hmm" after the gulp, and the occasional idle honk. Real **bill clacks** too
  (pelicans do clack): a woody rattle every half minute or so, and the snap of the bill on the fish.
- **Swing-band event stings**, played by the BGM's own voices through the effects bus: a plunger **wah-wah** on the
  hop, a **clarinet trill** up to a fall on the gulp, a **cymbal choke** after the bell, and a little **ta-da** for every
  easter egg (vibes arpeggio, bent clarinet, plunger trumpet, a bell ding; one of five motifs, chosen by the egg's id).

## In the page

- **Off by default.** The music plays whenever sound is on (`M`, or 声音 Sound). The control card's More tab has a
  separate **音乐 Music** toggle. Turning Music on also turns the sound on; turning it off leaves the effects playing.
- **Mix**: the BGM runs on its own `mus` bus (gate → duck → bus) into the shared master chain (42 Hz high-pass, glue
  compressor, brick-wall limiter), at about −4 dB under the world (`AUDIO.music.gain`). The bass is mono and centred;
  every other instrument has a low-cut.
- **Ducking**: −4.4 dB under the bell, the gulp and each easter egg (40 ms down, 0.55 s hold, 0.9 s back up).
- **Adapting gently, on bar lines only**: the tempo map belongs to the score and never follows cadence. At night the
  banjo nearly drops out, the ride and the hats thin, the vibes come forward with a deeper motor tremolo, and the band
  darkens. In rain the banjo and the snare thin and the band is muffled; in fog it softens. Mood values are quantised
  (night 0 / ½ / 1, rain and fog on / off), so changes land as steps at the next bar line.
- **Lookahead scheduler**: the existing 25 ms timer queues whole bars once their downbeat enters the 0.12 s (+0.1 s)
  window. It stops queuing while the sim is paused, the tab is hidden (the context is suspended) or Music is off.
  When it resumes it picks up at the next free bar line.
- **Cadence**: the default cruise is now 42 rpm. Speed-driven levels (wind, road, chain) are normalised to the cruise
  cadence, so they feel the same as before. The freewheel and chain rates stay physically tied to the wheel and crank,
  and nothing in the music follows cadence.

## How it was checked

`node tools/render-bgm.mjs --analyze` renders the full record and decodes the MP3 again in Chromium. It then reports:

- the MP3's real peak and RMS
- clipped samples
- per-section level and low/mid/high balance
- a click scan of a crackle-free render: a second-difference spike against its ±5 ms local mean, with a self-test
  that must find a −26 dBFS step injected mid-chorus

The surface noise is excluded from the click scan because it is the intended texture.

Iteration log, first arrangement ("Coast Road Swing"):

1. A scheduling bug (`stop()` before `start()`) silently dropped bass and piano in A′/A″. The bass stem was 8 dB too
   hot, and the piano and banjo were 10–15 dB too low.
2. Rebalanced the stems.
3. Click flags turned out to be fast attacks. I softened the attacks, lowpassed the banjo pluck, and fixed a
   gain-stepping bug in my own look-ahead limiter.

Iteration log, the rewrite ("The Pelican Strut", after the user asked for more personality):

4. A negative pickup position broke the tempo map.
5. The shellac drive was squashing the crest (the peak landed at −7 dBFS after loudness makeup) and the 170 Hz band
   was too thin, so I halved the drive and moved the band to 120 Hz.
6. The Δ² click detector could not see a −26 dBFS step inside a busy chorus. A 12 kHz high-pass residual can (the
   record's band ends at 5.2 kHz, and a step is broadband), so the self-test now finds the injected step.

### Measurements (`node tools/render-bgm.mjs --analyze`, final render)

`dist/bgm-poster.mp3`: 192 kbps, stereo, 44.1 kHz, **2:28.1**, 3.4 MB. After decoding: **peak −2.75 dBFS, RMS
−18.87 dBFS, 0 clipped samples**. Before encoding, the mastered track measures −15.0 LUFS integrated (informational
only). Clicks in a crackle-free render: **0** (the detector self-test finds the injected step). There is a 0.4 s
fade-in and a 2.2 s ring-out after "two bits".

| Section | Starts | Length | RMS dBFS | Peak dBFS | low < 250 Hz | mid | high > 4 kHz (dB share of energy) |
|---|---|---|---|---|---|---|---|
| intro (rubato) | 0:00 | 11.4 s | −22.4 | −8.1 | −10.3 | −0.5 | −18.9 |
| vamp | 0:11 | 3.8 s | −19.4 | −5.1 | −3.7 | −2.7 | −14.9 |
| A | 0:15 | 30.5 s | −19.0 | −4.7 | −5.0 | −1.8 | −14.9 |
| A′ | 0:46 | 30.5 s | −18.1 | −4.1 | −6.6 | −1.5 | −11.6 |
| break + drum break | 1:16 | 15.2 s | −19.2 | −3.4 | −2.9 | −3.3 | −17.0 |
| B + build | 1:32 | 21.2 s | −21.8 | −5.0 | −7.6 | −1.0 | −14.0 |
| A″ (G major) | 1:53 | 29.1 s | −16.6 | −2.9 | −5.7 | −1.8 | −11.8 |
| tag + ring-out | 2:22 | 6.3 s | −17.4 | −3.4 | −6.5 | −1.2 | −20.5 |

Mids carry the record (the gramophone band). Contrast: about 6 dB between the quiet intro and bridge and the
key-change chorus.
