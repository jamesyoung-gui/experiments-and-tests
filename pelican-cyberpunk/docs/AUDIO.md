# Neon Pelican · the sound of the city (AUDIO.md)

Everything you hear is synthesized live in WebAudio by `src/audio/audio.js`. There are no samples and no audio files. Sound is **off by default**, and no `AudioContext` exists until the viewer turns sound on (`M` or the sound button). The **music has its own switch** (`U`, the synth-keyboard button → `ui:toggle {key:'music'}` → `state.toggles.music`; also `ui:music {on}` or `audio.setMusic(on)`). Turning sound on gives you the city first, and the track only plays when you ask for it.

## 1. The track: "Neon Pelican" (A minor, 4/4, 2 + 32 bars)

It is a composed song, not a generator. Two intro bars of pad and arpeggio on Am (the filter opens) lead into four 8-bar sections, one chord per bar. The melody is written out in `SONG` as `note:sixteenths` tokens.

| Section | Chords | Melody idea |
|---|---|---|
| **A** "rain on chrome" (verse) | Am · F · C · G · Am · F · Dm · E | short pick-up phrases (A–C–E, D–C) answered by long held notes, closing on the dominant E |
| **B** "the climb" (pre-chorus) | F · G · Em · Am · F · G · Esus4 · E | quarter-note arpeggios climbing to A5, then to D6, and a sus4 → G♯ half cadence. A noise riser runs through bars 7–8 and a snare fill ends it |
| **C** "neon hook" (chorus) | Am · F · C · G · Am · F · G · Am | the hook E–D–C–A / C–D–E–F / G–E–C–E, resolving to A. A crash marks the downbeat, and the octave-doubled lead comes in |
| **D** "skybridge" (bridge) | Dm · Am · B♭ · F · Dm · Am · B♭ · E | long, high notes over the borrowed ♭VI–♭VII colour (B♭). It ends on E7 (G♯–B–E) and falls back into the verse |

At 100 bpm one pass lasts about 77 s, so no phrase repeats inside 30 s. The pass number (the verse) adds **variations**:
- **Pass 1** plays the verse on a soft plucked lead and keeps the first two verse bars free of snare. **Later passes** give the verse to the full saw lead.
- **Odd passes** turn the bridge into a **breakdown and build**: the drums drop out, the music bus closes to about 700 Hz, then the snare builds in quarters → 8ths → 16ths while the filter opens and a riser runs into the verse.
- **Every third pass** lifts the whole song up a tone (B minor). The next pass comes back home.
- **The arpeggio pattern** alternates between a straight up–down and a leaping 0-2-1-3-2-4 figure on alternate passes.
- The **pad** gets colour tones (m7 / maj7 / add9) outside the default drive mood and in the bridge.

## 2. Instruments (persistent voices, no per-16th nodes)
Each tonal part is **one persistent voice** whose envelopes are scheduled ahead (`setTargetAtTime`), so a 16th-note bassline costs no node allocation. The voices are built when the music is first switched on and freed 1.6 s after it is switched off.
- **Bass:** a saw plus a square sub an octave down, through a resonant low-pass (Q 5) with a per-note filter envelope. The signal splits into a clean path and a `tanh` overdrive path, crossfaded per mood. Patterns: *pulse* (the synthwave octave pulse in 16ths), *drive16* (steady, overdriven 16ths), *eighth*, and *hold* (whole notes).
- **Pad:** 4 voices × 2 detuned saws (−9 / +8 cents), panned alternately, low-passed. They pass through a **16-step trance gate** (the "gated pad") and a **sidechain pump** that dips 9 dB on every kick. Chord changes glide (voice-led).
- **Arpeggio:** a saw voice with a plucky filter envelope, or in the arcade district a **12.5 % pulse wave** (chiptune, `createPeriodicWave`). A tempo-synced dotted-8th delay follows it.
- **Lead:** two detuned saws (+11 cents) plus an octave saw for the hook. It has legato portamento for steps ≤ 4 semitones, delayed vibrato on long notes and a filter "bite" on every note, then a **ping-pong dotted-8th delay** and a plate send. At night it switches to square waves an octave down.
- **Drums:**
  - a **kick** (160 → 46 Hz sine sweep plus a click) that drives the sidechain;
  - a **gated snare** (triangle body, band-passed noise, and the 80s gated reverb: a dense flat noise tail held 210 ms, then cut in 14 ms);
  - a clap (3 bursts + tail) for the daytime mood;
  - closed and open hats;
  - a crash;
  - a noise riser.
- **Koto:** in the old-temple district, a pentatonic triangle pluck (bent attack) answers each long lead note a beat later.

## 3. Arrangement follows the city (decided at every bar line)
**Mood** (from `frame.tod` and the director's weather):

| Mood | When | Arrangement |
|---|---|---|
| **drive** | neon dusk, tod 0.62–0.74 (the default hero) | four-on-the-floor, gated snare on 2 and 4, octave-pulse bass, gated pad, saw lead, octave-doubled hook |
| **acid** | acid-rain night, tod 0.74–0.86 | the same drive with a **squelching acid bass**: a slow cutoff LFO and a longer filter decay |
| **dark** | deep night, tod ≥ 0.86 or < 0.2 | darksynth: a broken kick (1, 1a, 3, 3&), a **half-time snare**, overdriven 16th bass, a sparse halftime gate, a square lead an octave down, a darker pad. 6 % slower |
| **day** | smog sunrise and overcast noon, tod 0.2–0.62 | lighter: a clap instead of the snare, a softer kick, a smooth un-gated pad, no overdrive |
| **rain** | the downpour (`weather.rain` heavy) | kick on 1 and 3 only, soft snare, 8th-note bass, smooth pad, the whole music bus low-passed at 3.2 kHz, longer delays. 6 % slower |

**District** (from `weather.stretch`, the route re-theme):
- arcade row (funfair): the arpeggio turns chiptune, an octave up.
- maglev line (railway): driving 16th hats.
- neon tunnel (cliffs): the music bus is low-passed to 1.3 kHz with longer delay feedback, and the ambience gets a cavernous rumble.
- scrapyard (dunes): overdriven bass.
- hydro garden (pines): no snare, a bigger, un-gated pad.
- old temple (fort): the koto answers the lead.
- data spire (lighthouse): the pad filter sweeps bar by bar like the searchlight.
- drone dock and fish port (pier, harbour): long ping-pong delay feedback.

**Pace:**
- Above 86 rpm the hats open into 16ths.
- **Coasting** strips out the kick, snare and bassline (the bass holds whole notes) and mutes the lead. About 0.6 s into the coast, **the pelican hums the hook through its vocoder**, an octave down. It is a persistent 9-band vocoder voice ("mm" opening to "oo" on long notes) with portamento and delayed vibrato. The first pedal stroke stops it.

## 4. Tempo follows the pedals, musically
`bpm_raw = 64 + 0.6 × cadence` (×0.94 in the dark and rain moods) snaps to the ladder **84 · 92 · 100 · 108 · 116 · 124** with hysteresis (85 % of a rung). The tempo moves **at most one rung per bar**, as a smooth accelerando or ritardando across that bar. 60 rpm gives 100 bpm. A sprint to 95 rpm climbs 100 → 108 → 116 over two bars, and a coast slows gently. The delay times follow the tempo (dotted 8ths).

## 5. The music listens to the story
- **Ducking.** A rig event (chime, hop, wave, gulp) ducks the music to −6 dB for the event's length. The pelican's voice ducks it to −4 dB, and HUD bleeps and nearby director gags duck it to −2 dB. It recovers with a 0.5 s time constant.
- **Stings on the beat.** After the swallow, a gulp adds a chiptune **power-up arpeggio** of the current chord's tones in 16ths, on the **next beat**. A wave adds a falling three-note square flourish on the next beat.
- **The chime is in tune.** With the music on, the two strikes of the bell take the current chord's tones (for example E6 → C7 on Am). With it off, they play E6 → B6.
- **Captions** mark the track's entry: `[♪ synthwave: “Neon Pelican”] / [♪ 合成器浪潮：《霓虹鹈鹕》]`.

## 6. The pelican's voice (a 9-band vocoder) and the HUD
The carrier is a saw plus a pulse (and breath noise for aspirates). It runs through **9 fixed band-pass channels** (240 Hz … 3.8 kHz, Q 5.5), whose gains trace the formants of each vowel from a small table (m n u o a e i h), scaled ×1.12 for a bird. The result is a robot-bird voice whose pitches sit on the song's scale.
- **Hop:** a breathy **"hup!"** (h → u, rising) 90 ms before take-off, and a soft **"oof"** on landing.
- **Wave:** **"yo!"** (i → o, rising a third).
- **Feeding:** after the gulp bubbles, the pouch's circuit tattoo chirps (**a three-note "download complete"**), then the pelican says **"mm-hm!"**.
- **Idle:** a contented vocoder **"hmm-hm"** every 32–60 s.
- **HUD bleeps** (square / sine / pulse blips, the language of the visor):
  - **a new stretch:** "bip-bip-bloop, new waypoint" (with the mission caption);
  - **an egg found:** a rising 6-note chiptune "unlocked" run;
  - **a camera change:** a tick;
  - **a time-of-day change:** a two-note sine;
  - **a toggle:** an up or down pair.

  Bleeps only ever sound after the user has turned sound on.

## 7. The city (ambience)
- **The chime** (the re-voiced bell): an FM glass tone (inharmonic 1.4 modulator ratio with a decaying index), a 2.76× glass partial, a sub partial, a 7 Hz digital shimmer and a square striker tick. There are two strikes, exactly on the thumb pop (sim-time cue, 120 ms lookahead, latency compensated). The chime ducks the road and rain, and peaks ≤ −3 dBFS.
- **Rain:**
  - The drizzle level mirrors `weather.js` (`max(rain, 0.34 × (1 − clear) × (1 − 0.55 × smog))`), so what you see falling is what you hear.
  - There is a fine hiss on chrome, a mid-band patter on awnings, and sparse **drips on metal** whose rate follows the rain.
  - The road hisses when wet, and the landing thump becomes a splash.
- **Thunder** runs on weather.js's own lightning clock (period 3.1 s, the same `hash(n, 206) < 0.42` schedule), so a crack and roll arrive **0.3–1.9 s after the flash**, later for farther strikes. It sounds only in the downpour and never under reduced motion (no flash, no thunder).
- **Neon hum:** the 100 Hz ballast buzz of the signs, band-passed, is louder at night and in the neon districts. Now and then a **failing tube crackles** (buzz bursts with arcing ticks).
- **Megacity bed:** distant traffic rumble plus a mid-band air-conditioner roar, doubled in the tunnel.
- **Distant sirens** (wail or hi-lo) sound every 38–80 s (more often at night), with a slow doppler and a pan drift, heavily reverberated.
- **Delivery drones:** four detuned rotors with blade-rate AM, doppler and a pan sweep. They come every 20–42 s, and every 9–18 s (some close) at the drone dock. The director's kites encounter is voiced as a drone pass.
- **The maglev** whooshes past on its viaduct: an electric whine that drops as it passes, an air-wall of noise and a 52 Hz thrum, panned across. It passes every 22–38 s on the maglev line and every 80–150 s elsewhere.
- **A station chime** (4 notes echoing off the towers) sounds on the maglev line and late at night.
- **The harbour:** water slapping the pilings, a deep harbour horn in smog or at night, the two-tone **hover-barge horn**, and rare gulls, only by the water (pier, harbour, bridge).
- **The calm-wind rule:** a single slow breath of wind (a slow random walk, no whistle) scaled by `weather.wind`.
- **The drivetrain** is kept from edition C and resynced: freewheel ticks at exactly wheel rev/s × 18 pawls (carbon-hub bright), and chain whirr AM at crank rev/s × `BIKE.ringT` teeth.
- **Director encounters:**
  - the street cat → a **robot-cat "mrrp-meow"** (the vocoder on a square carrier);
  - the oncoming cyclist → another courier's two-strike chime and pass-by;
  - the friend → a vocoder honk overhead;
  - gulls → gull calls;
  - the fish → a splash with a two-note holo sparkle;
  - fireworks → neon fireworks (boom, "pew", glitter). These run on the director's burst clock, and each boom arrives 0.35 s after its flash.

## 8. Mix and etiquette
- **Signal chain:** buses `amb mech fx far voice music` → master fade → highpass 36 Hz → glue compressor (−20 dB, 3:1) → brick-wall limiter (−3 dB threshold, 20:1, 1 ms) → out. There is one procedural stereo plate reverb (2.8 s), with sends per bus. The music has its own lowpass (mood / tunnel / breakdown) → duck → level stage.
- **Fades:** in 0.6 s, out 0.45 s, pause 0.4 s, hide 80 ms. The context is **suspended 100 ms after the tab is hidden** and resumed when it is shown. A stopped rAF (paused sim) fades the master out after 250 ms.
- **Scheduler:** a 25 ms `setInterval` pump. It looks 120 ms ahead for the effects and freewheel, and 200 ms ahead on the 16th-note music clock. After a stall it drops the backlog (no burst of late notes).
- **Measured** (OfflineAudioContext, 44.1 kHz, seed 7, a scripted 30 s ride: cruise, chime at 3 s, hop at 6 s, coast 10–15 s, sprint to 95 rpm 16–22 s, gulp at 24 s, wave at 27.5 s):

| Render | RMS per second | Peak |
|---|---|---|
| sound on, music off (the default) | −24…−18 dBFS (−23 cruising) | −2.5 dBFS |
| sound + music, drive mood | −17…−15 dBFS | −2.3 dBFS |
| dark / acid / day / rain moods | −18…−14 dBFS | ≤ −2.2 dBFS |
| music bus only | about −16.5 dBFS | −3 dBFS |
| the chime (fx bus only) | −26 dBFS in its second | −3.9 dBFS |

- Clicks (|Δsample| > 0.3 with no scheduled onset) measure 0, apart from isolated hi-hat noise transients, which are scheduled onsets. L/R balance is within 0.3 dB.
- **Test hooks:** `createAudio(bus, {context, clock, seed, solo, inst, music})`.
  - `debug().music` reports `{on, built, bar, step, bpm, mode, section, chords, crooning}`.
  - `debug().log` holds every cue (`tempo`, `arr`, `sting`, `hum`, `bell` with its pitches, `hup`, `mission`, `egg`, `siren`, `drone`, `maglev`, `thunder`, `pa`, `meow`, …).
  - `debug()` also reports `district`, `rain` and `heavy`.
  - Every audible event emits `audio:caption {kind, en, zh}`.
