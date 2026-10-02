# Brief: an instrumental BGM for each edition (user request: "你给这 3 个版本都写一个纯音乐 bgm 呗", a pure-instrumental BGM for each of the 3 editions)

There is one composer agent per edition. Each works ONLY inside its own project directory. All audio is synthesized with WebAudio; there are no sample files. The rules are the same for every edition; only the style differs.

## What "done" means
1. **A real composition, not a loop of random notes.**
   - Key, tempo, form and chord progression are written down.
   - It has a memorable main melody (the hook) that appears at least twice, and the second time it is varied.
   - The form is something like **Intro (4–8 bars) → A → A' → B (contrast: new key area or texture) → Bridge/breakdown → A'' (fuller, final hook) → Outro/turnaround**, so that the loop back to the Intro is seamless.
   - **Length before it repeats: 2:00–3:30.**
2. **Arrangement and mix** fit the edition's style (below).
   - Instruments are designed and synthesized with care: envelopes, filters, a little detune and chorus, and humanised timing and velocity (±10–20 ms, ±10%).
   - The mix sits clean: bass mono, low cut on pads, a master limiter.
   - **Peak ≤ −1 dBFS, integrated loudness around −16 to −14 LUFS (approximate RMS ok), zero clicks or pops.**
3. **In the page:** it is a background music track under the existing sound effects.
   - **Off by default.** It starts with the existing sound or music toggle.
   - It **adapts gently**: overall tempo stays fixed or moves in quantised musical steps, never jittering with cadence. It may thin or fill with time of day and weather, and it ducks a few dB under events (bell, gulp, eggs).
   - A lookahead scheduler; suspend when the tab is hidden.
   - It must not break anything else. These must still pass: `node tools/check-eggs.mjs`, `node tools/shoot.mjs --dist --set hero` (0 console errors), `node tools/build.mjs`.
4. **A standalone file the user can download and share:** write `tools/render-bgm.mjs`.
   - It renders exactly one full loop (Intro through Outro) with `OfflineAudioContext` in headless Chromium (Playwright at `/opt/node22/lib/node_modules/playwright/index.mjs`).
   - It then encodes to **MP3 at 192 kbps stereo 44.1 kHz** with the already-installed `@breezystack/lamejs` (import it from the node side; `node_modules` is a symlink to `../pelican-bicycle/node_modules`). Do NOT run npm install.
   - Output: `dist/bgm-<edition>.mp3`. Also print peak and RMS.
   - The file needs a short fade-in and a natural ending (the outro resolves; a 1–2 s tail), so it works as a standalone track.
5. **Self-review by listening analysis.** You can't hear it, so verify by measurement:
   - render a 10 s excerpt of each section and check its RMS and spectral balance (low/mid/high band energies);
   - check there are no clipped samples;
   - check the hook's notes match the score you wrote;
   - check that the loop seam is continuous.
   Iterate on the arrangement at least 3 times.
6. **Document it** in `docs/BGM.md`: title (Chinese + English), key, tempo, form with bar numbers, chord chart, instrumentation, and how it adapts in the page.

## Styles
- **pelican-bicycle, edition C, retro travel poster (1930s art deco):**
  - A breezy **seaside swing / jazz-age** tune, around 1930s.
  - **Instruments:** clarinet or muted-trumpet lead, a walking upright bass, brushed snare and ride, a stride or ragtime piano comp, a banjo or rhythm guitar on 2 and 4, an optional vibraphone counter-melody.
  - **Tempo:** about 112–132 bpm swing feel (triplet swing ratio ~0.62).
  - **Mood:** sunny, optimistic, a postcard from the coast.
  - **Title idea:** "鹈鹕湾海滨路 · Coast Road Swing".
  - This edition has NO music yet. Add it to the existing `src/audio/audio.js`. The music plays whenever sound is on, through the existing sound toggle (M). If feasible, also add a separate "音乐 Music" toggle button to the control card, as a minimal edit to `src/ui/ui.js`.
- **pelican-storybook, edition B, warm gouache picture book:**
  - A tender **bedtime-story waltz or lullaby-pop** in 3/4 or 6/8.
  - **Instruments:** plucked ukulele or nylon guitar, celesta or glockenspiel melody, warm felt piano, a soft upright bass, light brushes or shaker, an occasional recorder or whistle counter-melody.
  - **Tempo:** about 84–96 bpm.
  - **Mood:** cosy and gently playful, with a small "page-turn" flourish between sections.
  - **Title idea:** "晚安，鹈鹕 · Goodnight, Pelican".
  - The current music in `src/audio/audio.js` is a placeholder-level loop: **replace it** with the composed piece. Keep the pelican voice and the sound effects.
- **pelican-cyberpunk, Neon Pelican:**
  - A **synthwave / darksynth** track.
  - **Instruments:** a pulsing octave-bass arpeggio, gated reverb snare, four-on-the-floor kick with sidechain-style pumping on the pads, a lush detuned saw pad, a bright lead with portamento for the hook, arpeggiated plucks, and an FM-bell counter-line.
  - **Tempo:** about 100–110 bpm.
  - **Mood:** night drive, cool and heroic, with a big lift into the final chorus.
  - **Title idea:** "霓虹快递 · Neon Delivery".
  - **Replace** the current loop with the composed piece. Keep the ambience, the pelican voice and the mech-egg sounds; the mech suit-up may trigger a short musical sting.

## Constraints
- Never touch other edition directories.
- Never git commit.
- Keep `dist/index.html` within its size budget (see `tools/budgets.json`). The score is data plus synth code; keep it compact.
- After the change, rebuild `dist/index.html` with `node tools/build.mjs`.
- Report: the title, key, tempo, form, length, the peak and RMS of the MP3, and the gate results.
