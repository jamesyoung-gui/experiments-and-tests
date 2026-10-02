# Neon Pelican · the sound of the city (AUDIO.md)

*Sound direction: a dense, cinematic, Blade-Runner neon megacity. Rain beads on glass tubes and drums the puddles in full stereo. Sirens dopple through the street canyons. Drones buzz overhead, the maglev tears past, and a garbled PA echoes down the towers. Signs buzz exactly when they flicker on screen, and steam vents hiss. The pelican is a bird-bot that chirps and hums through a vocoder. Long dark generated reverbs (a 5.2 s "street canyon" plus a 2.8 s plate), wide panning and sidechain ducking keep it spatial and clear.*

Everything you hear is synthesized live in WebAudio by `src/audio/audio.js`. There are no samples and no audio files. Sound is **off by default**, and no `AudioContext` exists until the viewer turns sound on (`M` or the sound button). The **music has its own switch** (`U`, the synth-keyboard button → `ui:toggle {key:'music'}` → `state.toggles.music`; also `ui:music {on}` or `audio.setMusic(on)`). Turning sound on gives you the city first, and the track only plays when you ask for it.

## 1. The music: 霓虹快递 · Neon Delivery (see docs/BGM.md)
A composed 64-bar synthwave piece (2:27.7 per loop) in A minor, 104 bpm, with the form Intro → A → A′ → B (C major, half time) → Bridge (breakdown and build) → A″ (the final hook, lifted to B minor) → Outro (home to A minor). It is written out in `src/audio/bgm.js`: the score data plus one synth engine with an octave bass, four-on-the-floor kick and sidechain pump, gated snare, detuned saw pad with chorus, portamento lead, arp plucks and an FM-bell counter-line. `tools/render-bgm.mjs` renders it to `dist/bgm-cyberpunk.mp3`.
- **The tempo is fixed at 104 bpm.** It no longer follows the pedals (the old tempo ladder is gone), and the slower 42 rpm cruise changes nothing in the music.
- **The city thins or fills it per beat**, through levels and filters:
  - the mood, from `frame.tod` and the weather: day, dusk drive, acid night, deep night, downpour;
  - the district: tunnel, scrapyard, temple, arcade;
  - the pace: a sprint opens the hats, and a coast strips the drums and lead while the pelican croons the hook.
- **It ducks** −4.4 / −3 / −2 dB under events, the voice and HUD bleeps.
- **Stings** (gulp, wave, mech suit-up) land on the next beat in the current chord, and the chime is tuned to that chord too.

BGM.md has the chord chart, the hook, the instrumentation and the measurements.

## 6. The pelican's voice (a 9-band vocoder) and the HUD
The carrier is a saw plus a pulse (and breath noise for aspirates). It runs through **9 fixed band-pass channels** (240 Hz … 3.8 kHz, Q 5.5), whose gains trace the formants of each vowel from a small table (m n u o a e i h), scaled ×1.12 for a bird. The result is a robot-bird voice whose pitches sit on the song's scale. A small **FM "bird-bot" chirp** (a sine carrier with a 2:1 modulator gliding between pitches) punctuates the lines: a rising chirp after "hup!", a three-chirp trill after "yo!", a falling chirp after "mm-hm!", a two-chirp trill after the idle "hmm-hm", and stray trills every 20–45 s.
- **Hop:** a breathy **"hup!"** (h → u, rising) 90 ms before take-off, and a soft **"oof"** on landing.
- **Wave:** **"yo!"** (i → o, rising a third).
- **Feeding:** after the gulp bubbles, the pouch's circuit tattoo chirps (**a three-note "download complete"**), then the pelican says **"mm-hm!"**.
- **Idle:** a contented vocoder **"hmm-hm"** every 32–60 s.
- **Glitch stutters:** a bit-crushed square, re-triggered at random rates and pitches every 12–35 ms, runs before the bleeps of a new stretch, an egg and a camera change, and through the mech and HACK eggs.
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
- **Rain is wide:** two decorrelated hiss layers hard left and right and two patter layers half left and right. On top come scheduled **glassy pings of drops on neon tubes** (2.6–5.6 kHz, with a 2.37× partial and a canyon send) and **puddle "bloops"** (a rising sine), placed anywhere across the stereo field at a rate that follows the rain.
- **Neon hum:** two sign banks (100 Hz ballast buzz, band-passed at 360 Hz left and 610 Hz right), louder at night and in the neon districts. Now and then a **failing tube crackles**.
- **The buzz is synced to the drawn flicker.** `land.js` drops two signs out on a 7 Hz hash schedule (`hash(k, 71+i) < 0.035 || hash(k>>1, 90+i) < 0.02`). The audio computes the same schedule ahead of time. Each drop-out of a sign that is on screen gives a 1/7 s choke of buzz with arc spits, panned to the sign's screen position. This is off under reduced motion.
- **Steam vents:** a valve tick, then a hissing plume (high-passed noise, a falling band, a canyon tail). They come every 7–16 s on the streets (neon district, fish port, maglev line, scrapyard) and rarely elsewhere.
- **The market murmur:** a crowd without words. Pink noise runs through three wandering formant bands (480 / 1150 / 2500 Hz, spread L / C / R), each fluttering at a syllabic 3–6 Hz. It is full in the neon district and the fish port, faint elsewhere, and softer at night and in the downpour.
- **A garbled PA:** after the station chime, 5–10 vocoder syllables run on a square carrier through a tinny horn-speaker chain (a 450 Hz high-pass, a +9 dB peak at 1.8 kHz and drive), with a 310 ms slap echo and the canyon reverb.
- **Megacity bed:** distant traffic rumble plus a mid-band air-conditioner roar, doubled in the tunnel.
- **District beds:**
  - the arcade row: chiptune cabinet jingles and coin chimes from doorways, every 1–4 s;
  - the old temple: a deep inharmonic bronze bell (partials 0.5 / 1 / 2 / 2.76 / 5.4 with a 1.3 Hz beat) every 9–16 s, with a long canyon tail;
  - the scrapyard: metal clanks;
  - the hydro garden: dripping irrigation.
- **Far sounds go through the canyon.** The `far` bus (sirens, drones, maglev, thunder, horns, PA, temple bells) feeds a 5.2 s dark generated IR. A haze / smog low-pass (9 → 2.5 kHz with `weather.fog`) closes the far city in.
- **Distant sirens** (wail or hi-lo) sound every 38–80 s, more often at night. Each one makes a **doppler pass**: the pitch sits 3.5–7 % sharp on approach and falls through the closest point to the same amount flat, with a pan drift and the canyon reverb.
- **Delivery drones:** four detuned rotors with blade-rate AM, doppler and a pan sweep. They come every 20–42 s, and every 9–18 s (some close) at the drone dock. The director's kites encounter is voiced as a drone pass.
- **The maglev** whooshes past on its viaduct: an electric whine that drops as it passes, an air-wall of noise and a 52 Hz thrum, panned across. It passes every 22–38 s on the maglev line and every 80–150 s elsewhere.
- **A station chime** (4 notes echoing off the towers) sounds on the maglev line and late at night.
- **The harbour:** water slapping the pilings, a deep harbour horn in smog or at night, the two-tone **hover-barge horn**, and rare gulls, only by the water (pier, harbour, bridge).
- **The calm-wind rule:** a single slow breath of wind (a slow random walk, no whistle) scaled by `weather.wind`.
- **The e-bike hub motor:** a saw plus a triangle at an octave, through a resonant band, whose whine climbs with speed (120 + 520 × speed/vmax Hz). There is also the inverter's faint high PWM tone (2.6–4.8 kHz). It assists while pedalling and drops to a faint spin when coasting.
- **The drivetrain** is kept from edition C and resynced: freewheel ticks at exactly wheel rev/s × 18 pawls (carbon-hub bright), and chain whirr AM at crank rev/s × `BIKE.ringT` teeth.
- **Director encounters:**
  - the street cat → a **robot-cat "mrrp-meow"** (the vocoder on a square carrier);
  - the oncoming cyclist → another courier's two-strike chime and pass-by;
  - the friend → a vocoder honk overhead;
  - gulls → gull calls;
  - the fish → a splash with a two-note holo sparkle;
  - fireworks → neon fireworks (boom, "pew", glitter). These run on the director's burst clock, and each boom arrives 0.35 s after its flash.

## 7b. The eggs
- **The mech suit-up** (`egg:mech`), now bigger:
  - lock-on bleeps and a HUD-wake glitch;
  - the scan-ring whoosh;
  - eight servo whirs that walk across the stereo field, with latch clicks;
  - a **2 s riser** (band-pass noise plus a detuned saw pair climbing 55 → 440 Hz, hard left and right) into the visor slam;
  - the power-up whine;
  - the **lock**: a driven **sub-boom** (a 58 → 24 Hz sine through a `tanh`), a mid punch and an air blast down the canyon. The ambience ducks to −9 dB and the music to −4.4 dB;
  - MECH ONLINE bleeps;
  - with the music on, the track answers on the next beat with a power-chord stab, a crash and a bell run.

  Disarming plays the reverse servo run and falling bleeps.
- **HACK** (the wireframe city): the audio watches `#scene.egg-hack`.
  - **In:** a bit-crushed noise **data crunch** sweeping 6 → 0.4 kHz, an 880 → 55 Hz power-down saw, four stutter glitches across the 3.6 s, and BREACH beeps. The ambience and the music duck.
  - **Out:** a rising "rez-in" sweep and a last stutter.
- **An egg found:** a glitch, then the 6-note chiptune "unlocked" run.

## 8. Mix and etiquette
- **Signal chain:** buses `amb mech fx far voice music` → master fade → highpass 36 Hz → glue compressor (−20 dB, 3:1) → brick-wall limiter (−4.5 dB threshold, 20:1, 1 ms) → soft-clip ceiling at −3 dBFS → out.
  - **Reverbs:** two procedural stereo IRs. A 2.8 s plate takes sends per bus. The 5.2 s dark **street canyon** takes the whole `far` bus, the murmur, the steam and the egg blasts.
  - **The far bus** passes through the haze low-pass.
  - **Sidechain-style ducking:** the chime, the HACK crunch and the mech lock duck the road, rain and wind bed (the `duck` stage). The music ducks under events, the voice and the HUD. Inside the track, the kick pumps the pad, arp and bell.
  - **The music** (`bgm.js`) has its own mood low-pass → duck → level stage, then feeds the `music` bus.
- **Fades:** in 0.6 s, out 0.45 s, pause 0.4 s, hide 80 ms. The context is **suspended 100 ms after the tab is hidden** and resumed when it is shown. A stopped rAF (paused sim) fades the master out after 250 ms.
- **Scheduler:** a 25 ms `setInterval` pump. It looks 120 ms ahead for the effects and freewheel, and 200 ms ahead on the 16th-note music clock. After a stall it drops the backlog (no burst of late notes).
- **Cadence:** the default cruise is now **42 rpm**, and the sprint 72 rpm (`CADENCE`).
  - Nothing tempo-like is keyed to the cadence any more: the music runs at a fixed 104 bpm.
  - The things that should follow the pedals still do, and are physically derived: the freewheel tick rate (wheel rev/s × 18 pawls), the chain whirr (crank rev/s × teeth), the motor whine and the road and wind levels (speed).
  - The sprint threshold for the music's hats is relative (90 % of `CADENCE.sprint`).
- **Measured** with `node tools/render-sound.mjs [--music] [--tod] [--rain] [--fog] [--district] [--solo]`: an OfflineAudioContext at 44.1 kHz, seed 7, on a scripted 30 s ride. The ride cruises at 42 rpm, with the chime at 3 s, a hop at 6 s, a coast at 10–15 s, a sprint to 72 rpm at 16–22 s, the gulp at 24 s and the wave at 27.5 s.

| Render | RMS (30 s) | Peak |
|---|---|---|
| sound on, music off (the default), neon district | −20.5 dBFS | −3.3 dBFS |
| sound + music, dusk drive | −16.6 dBFS | −2.6 dBFS |
| sound + music, deep night / day / downpour | −16.7 / −16.7 / −15.3 dBFS | ≤ −2.8 dBFS |
| sound + music, old temple (temple bells) | −16.6 dBFS | −2.6 dBFS |
| fish port in smog, music off | −20.0 dBFS | −3.3 dBFS |
| music bus only | −18.0 dBFS | −2.7 dBFS |

- No render clips. The music's own stems measure 0 clicks (docs/BGM.md §7).
- **Test hooks:** `createAudio(bus, {context, clock, seed, solo, inst, music})`.
  - `debug().music` reports `{on, built, bar, step, bpm, mode, section, chords, crooning}`.
  - `debug().log` holds every cue (`music`, `sting`, `hum`, `bell` with its pitches, `hup`, `mission`, `egg`, `mech`, `hack`, `steam`, `flicker`, `temple`, `paVoice`, `siren`, `drone`, `maglev`, `thunder`, `pa`, `meow`, …).
  - `debug()` also reports `district`, `rain` and `heavy`.
  - Every audible event emits `audio:caption {kind, en, zh}`.
